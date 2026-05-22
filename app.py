from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import math
import os
import sys
import threading
import time
from dataclasses import asdict, dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen

from pricing import FUEL_PRICE_PROVIDER, calculate_fare


NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
TOMTOM_FLOW_STYLE = "relative"
TOMTOM_FLOW_ZOOMS = [17, 15, 13]
TOMTOM_FLOW_URL_TEMPLATE = "https://api.tomtom.com/traffic/services/4/flowSegmentData/{style}/{zoom}/json"
# Demo fallback only. Prefer TOMTOM_API_KEY from the environment when available.
DEFAULT_TOMTOM_API_KEY = "JwU0poCWdD2wx6Pq63HE8Qrz7izN663J"
INITIAL_CENTER = (14.8386, 120.2842)
STREET_EXCLUDE_REGEX = "footway|path|steps|cycleway|bridleway|corridor|construction|proposed"
LANDMARK_QUERY_REGEX = "school|college|university|kindergarten|marketplace|townhall|courthouse|community_centre|post_office|police|fire_station|bus_station|hospital"
LANDMARK_SHOP_REGEX = "mall|department_store|supermarket"
LANDMARK_LEISURE_REGEX = "park|garden|sports_centre|stadium"
LANDMARK_TOURISM_REGEX = "attraction|museum|hotel"
TRAFFIC_NEARBY_RADIUS_METERS = 500
TRAFFIC_CACHE_TTL_SECONDS = 45
TRAFFIC_REQUEST_TIMEOUT_SECONDS = 8
USER_POINT_NODE_ID = "__user_point__"
DROPOFF_POINT_NODE_ID = "__dropoff_point__"
STATIC_ROOT = Path(__file__).resolve().parent
PASSENGER_DRIVER_MODULE_PATH = STATIC_ROOT / "passenger-driver.py"


def load_passenger_driver_module() -> Any:
    spec = importlib.util.spec_from_file_location("passenger_driver_module", PASSENGER_DRIVER_MODULE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load passenger matcher module from {PASSENGER_DRIVER_MODULE_PATH}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


PASSENGER_DRIVER_MODULE = load_passenger_driver_module()


@dataclass
class Node:
    id: str
    lat: float
    lng: float


@dataclass
class RoadSegment:
    from_node_id: str
    to_node_id: str
    distance: float


@dataclass
class Landmark:
    id: str
    name: str
    category: str
    category_label: str
    weight: float
    lat: float
    lng: float
    node_id: str


@dataclass
class SnappedRoadPoint:
    lat: float
    lng: float
    from_node_id: str
    to_node_id: str
    distance_to_segment: float
    distance_from_start: float
    distance_to_end: float


class OlongapoRouteService:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.boundary: dict[str, Any] | None = None
        self.boundary_rings: list[list[list[float]]] = []
        self.center_point = {"lat": INITIAL_CENTER[0], "lng": INITIAL_CENTER[1]}
        self.graph: dict[str, list[dict[str, Any]]] = {}
        self.node_index: dict[str, Node] = {}
        self.road_segments: list[RoadSegment] = []
        self.landmarks: list[Landmark] = []
        self.route_cache: dict[tuple[str, str], dict[str, Any] | None] = {}
        self.traffic_flow_cache: dict[str, dict[str, Any]] = {}

    def ensure_bootstrapped(self) -> None:
        if self.boundary and self.graph and self.landmarks:
            return

        with self._lock:
            if self.boundary and self.graph and self.landmarks:
                return

            boundary = self.fetch_boundary()
            self.boundary = boundary
            self.boundary_rings = self.extract_boundary_rings(boundary["geojson"])

            south, north, west, east = map(float, boundary["boundingbox"])
            self.center_point = {
                "lat": (south + north) / 2,
                "lng": (west + east) / 2,
            }

            road_payload = self.fetch_road_network(boundary["boundingbox"])
            self.build_graph(road_payload)

            landmark_payload = self.fetch_landmark_data(boundary["boundingbox"])
            self.build_landmarks(landmark_payload)

    def fetch_json(
        self,
        url: str,
        *,
        method: str = "GET",
        headers: dict[str, str] | None = None,
        data: bytes | None = None,
        timeout: float = 60,
    ) -> Any:
        request = Request(
            url,
            method=method,
            headers={
                "Accept": "application/json",
                "User-Agent": "OlongapoRouteFinderPython/1.0",
                **(headers or {}),
            },
            data=data,
        )
        with urlopen(request, timeout=timeout) as response:
            return json.load(response)

    def fetch_boundary(self) -> dict[str, Any]:
        params = urlencode(
            {
                "q": "Olongapo City, Philippines",
                "format": "jsonv2",
                "polygon_geojson": "1",
                "limit": "1",
            }
        )
        results = self.fetch_json(f"{NOMINATIM_URL}?{params}")
        if not results or "geojson" not in results[0]:
            raise RuntimeError("No Olongapo boundary was returned.")
        return results[0]

    def fetch_road_network(self, boundingbox: list[str]) -> dict[str, Any]:
        south, north, west, east = map(float, boundingbox)
        query = f"""
        [out:json][timeout:60];
        (
          way["highway"]["highway"!~"{STREET_EXCLUDE_REGEX}"]({south},{west},{north},{east});
        );
        (._;>;);
        out body;
        """.strip()
        return self.fetch_json(
            OVERPASS_URL,
            method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"},
            data=f"data={urlencode({'': query})[1:]}".encode("utf-8"),
        )

    def fetch_landmark_data(self, boundingbox: list[str]) -> dict[str, Any]:
        south, north, west, east = map(float, boundingbox)
        query = f"""
        [out:json][timeout:60];
        (
          nwr["amenity"~"{LANDMARK_QUERY_REGEX}"]({south},{west},{north},{east});
          nwr["shop"~"{LANDMARK_SHOP_REGEX}"]({south},{west},{north},{east});
          nwr["leisure"~"{LANDMARK_LEISURE_REGEX}"]({south},{west},{north},{east});
          nwr["tourism"~"{LANDMARK_TOURISM_REGEX}"]({south},{west},{north},{east});
          nwr["office"="government"]({south},{west},{north},{east});
          nwr["building"~"transportation|civic|public|commercial"]({south},{west},{north},{east});
        );
        out center tags;
        """.strip()
        return self.fetch_json(
            OVERPASS_URL,
            method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"},
            data=f"data={urlencode({'': query})[1:]}".encode("utf-8"),
        )

    def load_weather(self) -> dict[str, Any]:
        self.ensure_bootstrapped()
        params = urlencode(
            {
                "latitude": str(self.center_point["lat"]),
                "longitude": str(self.center_point["lng"]),
                "current": "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day",
                "timezone": "Asia/Manila",
            }
        )
        payload = self.fetch_json(f"{OPEN_METEO_URL}?{params}")
        current = payload.get("current")
        if not current:
            raise RuntimeError("Weather payload missing current data.")

        return {
            "raw": current,
            "summary": f"{describe_weather_code(current['weather_code'], current.get('is_day', 1))}, "
            f"{round(current['temperature_2m'])} deg C, feels like {round(current['apparent_temperature'])} deg C, "
            f"wind {round(current['wind_speed_10m'])} km/h",
            "source": "open_meteo_live",
        }

    def get_tomtom_api_key(self) -> str:
        return os.environ.get("TOMTOM_API_KEY", "").strip() or DEFAULT_TOMTOM_API_KEY

    def has_live_traffic_enabled(self) -> bool:
        return bool(self.get_tomtom_api_key())

    def lookup_live_traffic(
        self,
        lat: float,
        lng: float,
        *,
        node_id: str | None = None,
        nearby_candidate_limit: int = 0,
        node_index: dict[str, Node] | None = None,
    ) -> dict[str, Any] | None:
        self.ensure_bootstrapped()
        api_key = self.get_tomtom_api_key()
        if not api_key:
            return None

        candidates = self.get_traffic_candidate_points(
            lat,
            lng,
            node_id=node_id,
            nearby_candidate_limit=nearby_candidate_limit,
            node_index=node_index,
        )
        last_error: Exception | None = None

        for candidate in candidates:
            for zoom in TOMTOM_FLOW_ZOOMS:
                try:
                    traffic = self.fetch_traffic_segment_at_zoom(
                        candidate["lat"],
                        candidate["lng"],
                        zoom,
                        api_key,
                    )
                    return {
                        "traffic": traffic,
                        "matchedPoint": {"lat": candidate["lat"], "lng": candidate["lng"]},
                        "matchedNode": candidate.get("node"),
                        "zoom": zoom,
                        "source": "tomtom_live",
                    }
                except Exception as error:  # noqa: BLE001
                    last_error = error
                    if is_traffic_point_miss_error(error):
                        break
                    if not is_retryable_traffic_error(error):
                        raise

        if is_traffic_coverage_unavailable_error(last_error):
            return None

        if last_error:
            raise last_error

        return None

    def lookup_live_traffic_samples(self, samples: list[dict[str, Any]]) -> list[dict[str, Any]]:
        results = []
        for sample in samples:
            lat = float(sample["lat"])
            lng = float(sample["lng"])
            node_id = str(sample["nodeId"]) if sample.get("nodeId") is not None else None
            nearby_candidate_limit = int(sample.get("nearbyCandidateLimit") or 0)
            try:
                result = self.lookup_live_traffic(
                    lat,
                    lng,
                    node_id=node_id,
                    nearby_candidate_limit=nearby_candidate_limit,
                )
                if result:
                    results.append(
                        {
                            **result,
                            "error": "",
                            "notice": "Traffic source: TomTom live traffic.",
                        }
                    )
                    continue

                results.append(
                    {
                        "traffic": None,
                        "matchedPoint": {"lat": lat, "lng": lng},
                        "matchedNode": None,
                        "zoom": None,
                        "source": "heuristic_fallback",
                        "error": "",
                        "notice": "Traffic source: heuristic fallback because live traffic was unavailable.",
                    }
                )
            except Exception as error:  # noqa: BLE001
                results.append(
                    {
                        "traffic": None,
                        "matchedPoint": {"lat": lat, "lng": lng},
                        "matchedNode": None,
                        "zoom": None,
                        "source": "heuristic_fallback",
                        "error": str(error),
                        "notice": "Traffic source: heuristic fallback because live traffic was unavailable.",
                    }
                )

        return results

    def get_traffic_candidate_points(
        self,
        lat: float,
        lng: float,
        *,
        node_id: str | None = None,
        nearby_candidate_limit: int = 0,
        node_index: dict[str, Node] | None = None,
    ) -> list[dict[str, Any]]:
        working_index = node_index or self.node_index
        candidates: list[dict[str, Any]] = [{"lat": lat, "lng": lng, "node": None}]
        seen: set[str] = {f"point:{round(lat, 6)}:{round(lng, 6)}"}

        preferred_nodes: list[Node] = []
        if node_id:
            preferred_node = working_index.get(str(node_id))
            if preferred_node:
                preferred_nodes.append(preferred_node)

        nearest_node = self.get_nearest_node(lat, lng, node_index=working_index)
        if nearest_node:
            preferred_nodes.append(nearest_node)

        for node in preferred_nodes:
            key = f"node:{node.id}"
            if key in seen:
                continue
            seen.add(key)
            candidates.append({"lat": node.lat, "lng": node.lng, "node": asdict(node)})

        if not nearby_candidate_limit:
            return candidates

        nearby_nodes: list[tuple[float, Node]] = []
        for node in working_index.values():
            if node.id in {USER_POINT_NODE_ID, DROPOFF_POINT_NODE_ID}:
                continue

            distance = haversine_distance(Node(id="query", lat=lat, lng=lng), node)
            if distance <= TRAFFIC_NEARBY_RADIUS_METERS:
                nearby_nodes.append((distance, node))

        nearby_nodes.sort(key=lambda item: item[0])
        for _, node in nearby_nodes:
            key = f"node:{node.id}"
            if key in seen:
                continue
            seen.add(key)
            candidates.append({"lat": node.lat, "lng": node.lng, "node": asdict(node)})
            if len(candidates) >= nearby_candidate_limit + 1 + len(preferred_nodes):
                break

        return candidates

    def fetch_traffic_segment_at_zoom(self, lat: float, lng: float, zoom: int, api_key: str) -> dict[str, Any]:
        cache_key = f"{round(lat, 6)}:{round(lng, 6)}:{zoom}"
        cached = self.traffic_flow_cache.get(cache_key)
        now = time.time()
        if cached and (now - float(cached["timestamp"])) < TRAFFIC_CACHE_TTL_SECONDS:
            return dict(cached["traffic"])

        params = urlencode(
            {
                "key": api_key,
                "point": f"{lat},{lng}",
                "unit": "kmph",
                "thickness": "10",
            }
        )
        url = TOMTOM_FLOW_URL_TEMPLATE.replace("{style}", TOMTOM_FLOW_STYLE).replace("{zoom}", str(zoom))

        try:
            payload = self.fetch_json(
                f"{url}?{params}",
                timeout=TRAFFIC_REQUEST_TIMEOUT_SECONDS,
            )
        except HTTPError as error:
            raise build_traffic_error(error) from error
        except URLError as error:
            raise RuntimeError("traffic service temporarily unavailable") from error

        traffic = payload.get("flowSegmentData")
        if not traffic:
            raise RuntimeError("no traffic segment returned for this point")

        self.traffic_flow_cache[cache_key] = {
            "timestamp": now,
            "traffic": dict(traffic),
        }
        return dict(traffic)

    def build_graph(self, overpass_data: dict[str, Any]) -> None:
        raw_nodes: dict[int, Node] = {}
        ways: list[dict[str, Any]] = []

        for element in overpass_data.get("elements", []):
            if element.get("type") == "node":
                raw_nodes[element["id"]] = Node(
                    id=str(element["id"]),
                    lat=element["lat"],
                    lng=element["lon"],
                )
            elif element.get("type") == "way" and isinstance(element.get("nodes"), list):
                ways.append(element)

        self.graph.clear()
        self.node_index.clear()
        self.road_segments.clear()
        self.route_cache.clear()

        for way in ways:
            tags = way.get("tags", {})
            is_one_way = tags.get("oneway") in {"yes", "1"} or tags.get("junction") == "roundabout"

            way_nodes = way["nodes"]
            for index in range(len(way_nodes) - 1):
                from_node = raw_nodes.get(way_nodes[index])
                to_node = raw_nodes.get(way_nodes[index + 1])
                if not from_node or not to_node:
                    continue

                midpoint_lat = (from_node.lat + to_node.lat) / 2
                midpoint_lng = (from_node.lng + to_node.lng) / 2
                if not self.is_point_inside_boundary(midpoint_lat, midpoint_lng):
                    continue

                distance = haversine_distance(from_node, to_node)
                self.road_segments.append(
                    RoadSegment(
                        from_node_id=from_node.id,
                        to_node_id=to_node.id,
                        distance=distance,
                    )
                )
                self.add_edge(from_node, to_node, distance)

                if not is_one_way:
                    self.add_edge(to_node, from_node, distance)

    def add_edge(self, from_node: Node, to_node: Node, distance: float) -> None:
        self.graph.setdefault(from_node.id, [])
        self.graph.setdefault(to_node.id, [])
        self.node_index.setdefault(from_node.id, from_node)
        self.node_index.setdefault(to_node.id, to_node)
        self.graph[from_node.id].append({"id": to_node.id, "distance": distance})

    def build_landmarks(self, overpass_data: dict[str, Any]) -> None:
        landmarks: list[Landmark] = []
        dedupe: set[str] = set()

        for element in overpass_data.get("elements", []):
            tags = element.get("tags", {})
            landmark = classify_landmark(element, tags)
            if not landmark:
                continue

            nearest_node = self.get_nearest_node(landmark["lat"], landmark["lng"])
            if not nearest_node:
                continue

            key = f"{landmark['category']}:{nearest_node.id}"
            if key in dedupe:
                continue

            dedupe.add(key)
            landmarks.append(
                Landmark(
                    id=landmark["id"],
                    name=landmark["name"],
                    category=landmark["category"],
                    category_label=landmark["categoryLabel"],
                    weight=landmark["weight"],
                    lat=landmark["lat"],
                    lng=landmark["lng"],
                    node_id=nearest_node.id,
                )
            )

        if not landmarks:
            fallback_node = self.get_nearest_node(self.center_point["lat"], self.center_point["lng"])
            if fallback_node:
                landmarks.append(
                    Landmark(
                        id="fallback-center",
                        name="Olongapo City Center",
                        category="civic",
                        category_label="Transport & Civic Centers",
                        weight=4.5,
                        lat=fallback_node.lat,
                        lng=fallback_node.lng,
                        node_id=fallback_node.id,
                    )
                )

        self.landmarks = sorted(landmarks, key=lambda item: item.weight, reverse=True)

    def extract_boundary_rings(self, geometry: dict[str, Any]) -> list[list[list[float]]]:
        geometry_type = geometry.get("type")
        if geometry_type == "Polygon":
            return [geometry["coordinates"][0]]
        if geometry_type == "MultiPolygon":
            return [polygon[0] for polygon in geometry["coordinates"]]
        return []

    def is_point_inside_boundary(self, lat: float, lng: float) -> bool:
        return any(is_point_in_ring(lat, lng, ring) for ring in self.boundary_rings)

    def get_nearest_node(self, lat: float, lng: float, *, node_index: dict[str, Node] | None = None) -> Node | None:
        nearest_node = None
        nearest_distance = float("inf")
        working_index = node_index or self.node_index

        for node in working_index.values():
            if node.id in {USER_POINT_NODE_ID, DROPOFF_POINT_NODE_ID}:
                continue

            distance = haversine_distance(Node(id="query", lat=lat, lng=lng), node)
            if distance < nearest_distance:
                nearest_distance = distance
                nearest_node = node

        return nearest_node

    def get_nearest_road_point(self, lat: float, lng: float) -> SnappedRoadPoint | None:
        point = Node(id="query", lat=lat, lng=lng)
        best_snap = None

        for segment in self.road_segments:
            from_node = self.node_index.get(segment.from_node_id)
            to_node = self.node_index.get(segment.to_node_id)
            if not from_node or not to_node:
                continue

            candidate = project_point_onto_segment(point, from_node, to_node, segment.distance)
            if not candidate:
                continue

            snapped = SnappedRoadPoint(
                lat=candidate["lat"],
                lng=candidate["lng"],
                from_node_id=from_node.id,
                to_node_id=to_node.id,
                distance_to_segment=candidate["distance_to_segment"],
                distance_from_start=candidate["distance_from_start"],
                distance_to_end=candidate["distance_to_end"],
            )

            if best_snap is None or snapped.distance_to_segment < best_snap.distance_to_segment:
                best_snap = snapped

        return best_snap

    def add_user_point_to_graph(
        self,
        snapped: SnappedRoadPoint,
    ) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Node]]:
        graph = {node_id: list(neighbors) for node_id, neighbors in self.graph.items()}
        node_index = dict(self.node_index)
        user_node = Node(id=USER_POINT_NODE_ID, lat=snapped.lat, lng=snapped.lng)

        graph[USER_POINT_NODE_ID] = []
        node_index[USER_POINT_NODE_ID] = user_node

        from_node = node_index.get(snapped.from_node_id)
        to_node = node_index.get(snapped.to_node_id)
        if not from_node or not to_node:
            return graph, node_index

        if self.has_directed_edge(snapped.from_node_id, snapped.to_node_id):
            graph.setdefault(snapped.from_node_id, []).append({"id": USER_POINT_NODE_ID, "distance": snapped.distance_from_start})
            graph[USER_POINT_NODE_ID].append({"id": snapped.to_node_id, "distance": snapped.distance_to_end})

        if self.has_directed_edge(snapped.to_node_id, snapped.from_node_id):
            graph.setdefault(snapped.to_node_id, []).append({"id": USER_POINT_NODE_ID, "distance": snapped.distance_to_end})
            graph[USER_POINT_NODE_ID].append({"id": snapped.from_node_id, "distance": snapped.distance_from_start})

        return graph, node_index

    def has_directed_edge(self, from_id: str, to_id: str) -> bool:
        return any(neighbor["id"] == to_id for neighbor in self.graph.get(from_id, []))

    def run_a_star(
        self,
        start_id: str,
        goal_id: str,
        *,
        graph: dict[str, list[dict[str, Any]]] | None = None,
        node_index: dict[str, Node] | None = None,
    ) -> dict[str, Any] | None:
        graph = graph or self.graph
        node_index = node_index or self.node_index
        cache_key = (start_id, goal_id)

        if graph is self.graph and node_index is self.node_index and cache_key in self.route_cache:
            return self.route_cache[cache_key]

        open_set = {start_id}
        came_from: dict[str, str] = {}
        g_score = {start_id: 0.0}
        f_score = {start_id: estimate_cost(node_index, start_id, goal_id)}

        while open_set:
            current_id = min(open_set, key=lambda node_id: f_score.get(node_id, float("inf")))
            if current_id == goal_id:
                path = reconstruct_path(came_from, current_id, g_score.get(goal_id, 0.0))
                if graph is self.graph and node_index is self.node_index:
                    self.route_cache[cache_key] = path
                return path

            open_set.remove(current_id)
            for neighbor in graph.get(current_id, []):
                tentative_g_score = g_score.get(current_id, float("inf")) + neighbor["distance"]
                if tentative_g_score >= g_score.get(neighbor["id"], float("inf")):
                    continue

                came_from[neighbor["id"]] = current_id
                g_score[neighbor["id"]] = tentative_g_score
                f_score[neighbor["id"]] = tentative_g_score + estimate_cost(node_index, neighbor["id"], goal_id)
                open_set.add(neighbor["id"])

        if graph is self.graph and node_index is self.node_index:
            self.route_cache[cache_key] = None
        return None

    def find_best_driver(self, lat: float, lng: float, drivers: list[dict[str, Any]]) -> dict[str, Any] | None:
        self.ensure_bootstrapped()

        snapped = self.get_nearest_road_point(lat, lng)
        if not snapped:
            return None

        graph, node_index = self.add_user_point_to_graph(snapped)
        best_match = None

        for driver in drivers:
            if driver.get("lockedToUser"):
                continue
            if driver.get("status") not in {"standby_available", "moving_available"}:
                continue

            start_node = self.get_nearest_node(driver["lat"], driver["lng"])
            if not start_node:
                continue

            path = self.run_a_star(start_node.id, USER_POINT_NODE_ID, graph=graph, node_index=node_index)
            if not path:
                continue

            if not best_match or path["distance"] < best_match["path"]["distance"]:
                best_match = {
                    "driver": driver,
                    "start_node": asdict(start_node),
                    "path": path,
                }

        if not best_match:
            return None

        return {
            "user_point": asdict(snapped),
            "best_match": best_match,
        }

    def rank_intelligent_drivers(
        self,
        pickup_lat: float,
        pickup_lng: float,
        dropoff_lat: float,
        dropoff_lng: float,
        vehicle_type: str,
        drivers: list[dict[str, Any]],
    ) -> dict[str, Any]:
        return PASSENGER_DRIVER_MODULE.rank_drivers(
            self,
            pickup_lat=pickup_lat,
            pickup_lng=pickup_lng,
            dropoff_lat=dropoff_lat,
            dropoff_lng=dropoff_lng,
            vehicle_type=vehicle_type,
            drivers=drivers,
        )

    def bootstrap_payload(self) -> dict[str, Any]:
        self.ensure_bootstrapped()
        weather = self.load_weather()

        roads = [
            {
                "fromNodeId": segment.from_node_id,
                "toNodeId": segment.to_node_id,
                "distance": segment.distance,
                "from": asdict(self.node_index[segment.from_node_id]),
                "to": asdict(self.node_index[segment.to_node_id]),
            }
            for segment in self.road_segments
            if segment.from_node_id in self.node_index and segment.to_node_id in self.node_index
        ]

        return {
            "boundary": self.boundary,
            "centerPoint": self.center_point,
            "weather": weather,
            "liveTrafficEnabled": self.has_live_traffic_enabled(),
            "graphSummary": {
                "nodes": len(self.node_index),
                "directedEdges": sum(len(neighbors) for neighbors in self.graph.values()),
                "roadSegments": len(self.road_segments),
            },
            "nodes": [asdict(node) for node in self.node_index.values()],
            "graph": self.graph,
            "roads": roads,
            "landmarks": [asdict(landmark) for landmark in self.landmarks],
        }


def haversine_distance(from_node: Node, to_node: Node) -> float:
    earth_radius = 6371000
    d_lat = to_radians(to_node.lat - from_node.lat)
    d_lng = to_radians(to_node.lng - from_node.lng)
    lat1 = to_radians(from_node.lat)
    lat2 = to_radians(to_node.lat)
    a = math.sin(d_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(d_lng / 2) ** 2
    return 2 * earth_radius * math.asin(math.sqrt(a))


def to_radians(value: float) -> float:
    return (value * math.pi) / 180


def project_point_onto_segment(point: Node, from_node: Node, to_node: Node, segment_distance: float) -> dict[str, float] | None:
    ref_lat = (point.lat + from_node.lat + to_node.lat) / 3
    meters_per_lat = 111320
    meters_per_lng = 111320 * math.cos(to_radians(ref_lat))
    point_x = (point.lng - from_node.lng) * meters_per_lng
    point_y = (point.lat - from_node.lat) * meters_per_lat
    segment_x = (to_node.lng - from_node.lng) * meters_per_lng
    segment_y = (to_node.lat - from_node.lat) * meters_per_lat
    segment_length_squared = (segment_x * segment_x) + (segment_y * segment_y)

    if not segment_length_squared:
        return None

    projection = ((point_x * segment_x) + (point_y * segment_y)) / segment_length_squared
    ratio = max(0.0, min(1.0, projection))
    snapped_x = segment_x * ratio
    snapped_y = segment_y * ratio

    return {
        "lat": from_node.lat + (to_node.lat - from_node.lat) * ratio,
        "lng": from_node.lng + (to_node.lng - from_node.lng) * ratio,
        "distance_to_segment": math.hypot(point_x - snapped_x, point_y - snapped_y),
        "distance_from_start": segment_distance * ratio,
        "distance_to_end": segment_distance * (1 - ratio),
    }


def reconstruct_path(came_from: dict[str, str], current_id: str, distance: float) -> dict[str, Any]:
    node_ids = [current_id]
    while current_id in came_from:
        current_id = came_from[current_id]
        node_ids.insert(0, current_id)
    return {"nodeIds": node_ids, "distance": distance}


def estimate_cost(node_index: dict[str, Node], from_id: str, to_id: str) -> float:
    from_node = node_index[from_id]
    to_node = node_index[to_id]
    return haversine_distance(from_node, to_node)


def is_point_in_ring(lat: float, lng: float, ring: list[list[float]]) -> bool:
    inside = False
    previous = len(ring) - 1

    for index in range(len(ring)):
        xi, yi = ring[index]
        xj, yj = ring[previous]
        intersects = ((yi > lat) != (yj > lat)) and (
            lng < ((xj - xi) * (lat - yi)) / ((yj - yi) or float.fromhex("0x1.0p-52")) + xi
        )
        if intersects:
            inside = not inside
        previous = index

    return inside


def classify_landmark(element: dict[str, Any], tags: dict[str, Any]) -> dict[str, Any] | None:
    coordinates = get_element_coordinates(element)
    if not coordinates:
        return None

    category = None
    category_label = ""
    weight = 1.0

    if tags.get("amenity") in {"school", "college", "university", "kindergarten"}:
        category = "education"
        category_label = "Schools / Academic Establishments"
        weight = 4.9
    elif tags.get("shop") in {"mall", "department_store", "supermarket"}:
        category = "supermall"
        category_label = "Supermalls"
        weight = 5.5
    elif tags.get("amenity") == "marketplace":
        category = "market"
        category_label = "Public Markets"
        weight = 5.1
    elif tags.get("leisure") in {"park", "garden", "sports_centre", "stadium"}:
        category = "park"
        category_label = "Parks"
        weight = 3.7
    elif (
        tags.get("amenity") in {"townhall", "courthouse", "community_centre", "post_office", "police", "fire_station", "bus_station", "hospital"}
        or tags.get("office") == "government"
        or tags.get("building") in {"transportation", "civic", "public"}
    ):
        category = "civic"
        category_label = "Transport & Civic Centers"
        weight = 4.6
    elif tags.get("tourism") in {"attraction", "museum", "hotel"} or tags.get("building") == "commercial":
        category = "big-establishment"
        category_label = "Other Big Establishments"
        weight = 4.1

    if not category:
        return None

    return {
        "id": f"{element['type']}-{element['id']}",
        "name": tags.get("name") or tags.get("official_name") or tags.get("brand") or category_label,
        "category": category,
        "categoryLabel": category_label,
        "weight": weight,
        "lat": coordinates["lat"],
        "lng": coordinates["lng"],
    }


def get_element_coordinates(element: dict[str, Any]) -> dict[str, float] | None:
    if isinstance(element.get("lat"), (int, float)) and isinstance(element.get("lon"), (int, float)):
        return {"lat": float(element["lat"]), "lng": float(element["lon"])}

    center = element.get("center")
    if center and isinstance(center.get("lat"), (int, float)) and isinstance(center.get("lon"), (int, float)):
        return {"lat": float(center["lat"]), "lng": float(center["lon"])}

    return None


def describe_weather_code(code: int, is_day: int = 1) -> str:
    weather_codes = {
        0: "Sunny" if is_day else "Clear night",
        1: "Mostly sunny" if is_day else "Mostly clear night",
        2: "Partly cloudy", 
        3: "Cloudy",
        45: "Fog",
        48: "Rime fog",
        51: "Light drizzle",
        53: "Drizzle",
        55: "Dense drizzle",
        56: "Freezing drizzle",
        57: "Dense freezing drizzle",
        61: "Light rain",
        63: "Rain",
        65: "Heavy rain",
        66: "Freezing rain",
        67: "Heavy freezing rain",
        71: "Light snow",
        73: "Snow",
        75: "Heavy snow",
        77: "Snow grains",
        80: "Rain showers",
        81: "Heavy rain showers",
        82: "Violent rain showers",
        85: "Snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with hail",
        99: "Severe thunderstorm with hail",
    }
    return weather_codes.get(code, "Unknown weather")


def build_traffic_error(error: HTTPError) -> RuntimeError:
    details = ""

    try:
        payload = json.loads(error.read().decode("utf-8") or "{}")
        details = str(payload.get("detailedError", {}).get("message") or payload.get("error") or "")
    except Exception:  # noqa: BLE001
        details = ""

    if error.code == 401:
        return RuntimeError("TomTom API key is invalid, expired, or not authorized for Traffic API")
    if error.code == 403:
        return RuntimeError("API key rejected or not enabled for Traffic API")
    if "missing valid authentication credentials" in details:
        return RuntimeError("TomTom API key is invalid, expired, or not authorized for Traffic API")
    if error.code == 429:
        return RuntimeError("traffic API rate limit reached")
    if error.code == 503:
        return RuntimeError("traffic service temporarily unavailable")
    if error.code == 400 and details:
        return RuntimeError(details)
    return RuntimeError(details or f"traffic request failed with {error.code}")


def is_retryable_traffic_error(error: Exception | None) -> bool:
    message = str(error or "")
    return is_traffic_point_miss_error(error) or "no traffic segment returned for this point" in message


def is_traffic_point_miss_error(error: Exception | None) -> bool:
    message = str(error or "")
    return "Point too far from nearest existing segment" in message


def is_traffic_coverage_unavailable_error(error: Exception | None) -> bool:
    if not error:
        return False
    message = str(error)
    return is_traffic_point_miss_error(error) or "no traffic segment returned for this point" in message


SERVICE = OlongapoRouteService()


class HeatmapDataLoader:
    """Loads the admin heatmap CSV and pre-aggregates pickup density by grid cell and hour."""

    GRID_SIZE_DEGREES = 0.00035
    REQUIRED_COLUMNS = {"pickup_latitude", "pickup_longitude", "pickup_time"}

    def __init__(self, csv_path: Path):
        self.csv_path = csv_path
        self.hourly_aggregated_data: dict[int, list[dict]] = {}  # hour -> [{lat, lng, count}]
        self.hourly_raw_data: dict[int, list[dict]] = {}  # hour -> [{lat, lng, count, ...}]
        self.load_error: str | None = None
        self._load_and_aggregate()

    def _snap_to_grid(self, lat: float, lng: float) -> tuple[float, float]:
        """Snap a coordinate to the center of its grid cell."""
        grid = self.GRID_SIZE_DEGREES
        grid_lat = (math.floor(lat / grid) + 0.5) * grid
        grid_lng = (math.floor(lng / grid) + 0.5) * grid
        return (round(grid_lat, 6), round(grid_lng, 6))

    def _load_and_aggregate(self) -> None:
        """Parse CSV, validate columns, skip malformed rows, aggregate into grid cells per hour."""
        if not self.csv_path.exists():
            self.load_error = f"Dataset file not found: {self.csv_path.name}"
            return

        try:
            with open(self.csv_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                if reader.fieldnames is None:
                    self.load_error = f"Dataset file is empty: {self.csv_path.name}"
                    return

                header_set = set(reader.fieldnames)
                missing_columns = self.REQUIRED_COLUMNS - header_set
                if missing_columns:
                    self.load_error = f"Dataset missing required columns: {', '.join(sorted(missing_columns))}"
                    return

                # hourly_grid: hour -> {(grid_lat, grid_lng): count}
                hourly_grid: dict[int, dict[tuple[float, float], int]] = {}
                hourly_raw: dict[int, list[dict[str, Any]]] = {}

                for row_num, row in enumerate(reader, start=2):
                    # Validate required fields are present and non-empty
                    pickup_lat_str = row.get("pickup_latitude", "").strip()
                    pickup_lng_str = row.get("pickup_longitude", "").strip()
                    pickup_time_str = row.get("pickup_time", "").strip()

                    if not pickup_lat_str or not pickup_lng_str or not pickup_time_str:
                        print(f"Warning: Skipping row {row_num}: missing required field(s)", file=sys.stderr)
                        continue

                    # Validate numeric lat/lng
                    try:
                        lat = float(pickup_lat_str)
                        lng = float(pickup_lng_str)
                    except ValueError:
                        print(f"Warning: Skipping row {row_num}: non-numeric latitude/longitude", file=sys.stderr)
                        continue

                    # Extract hour from pickup_time (HH:MM:SS format)
                    try:
                        hour_str = pickup_time_str.split(":")[0]
                        hour = int(hour_str)
                        if hour < 0 or hour > 23:
                            print(f"Warning: Skipping row {row_num}: hour out of range ({hour})", file=sys.stderr)
                            continue
                    except (ValueError, IndexError):
                        print(f"Warning: Skipping row {row_num}: invalid pickup_time format", file=sys.stderr)
                        continue

                    if hour not in hourly_raw:
                        hourly_raw[hour] = []
                    hourly_raw[hour].append(
                        {
                            "lat": round(lat, 6),
                            "lng": round(lng, 6),
                            "count": 1,
                            "pickupTime": pickup_time_str,
                            "pickupDay": row.get("pickup_day", "").strip(),
                            "pickupDate": row.get("pickup_date", "").strip(),
                            "weatherCondition": row.get("weather_condition", "").strip(),
                            "establishmentName": row.get("establishment_name", "").strip(),
                            "section": row.get("section", "").strip(),
                        }
                    )

                    # Snap to grid and aggregate
                    grid_cell = self._snap_to_grid(lat, lng)
                    if hour not in hourly_grid:
                        hourly_grid[hour] = {}
                    hourly_grid[hour][grid_cell] = hourly_grid[hour].get(grid_cell, 0) + 1

                # Convert hourly data to list format
                for hour in range(24):
                    self.hourly_raw_data[hour] = hourly_raw.get(hour, [])

                    cells = hourly_grid.get(hour, {})
                    self.hourly_aggregated_data[hour] = [
                        {"lat": cell[0], "lng": cell[1], "count": count}
                        for cell, count in cells.items()
                    ]

        except Exception as e:  # noqa: BLE001
            self.load_error = f"Error loading dataset: {e}"

    def get_heatmap_data(self, hour: int, mode: str = "aggregated") -> dict:
        """Return aggregated or raw heatmap data for a specific hour (0-23)."""
        if self.load_error:
            return {"error": self.load_error}

        if not isinstance(hour, int) or hour < 0 or hour > 23:
            return {"error": "Invalid hour parameter. Must be an integer between 0 and 23."}

        normalized_mode = "raw" if mode == "raw" else "aggregated"
        points = (
            self.hourly_raw_data.get(hour, [])
            if normalized_mode == "raw"
            else self.hourly_aggregated_data.get(hour, [])
        )
        total_bookings = sum(p["count"] for p in points)
        return {
            "hour": hour,
            "points": points,
            "totalBookings": total_bookings,
            "datasetName": self.csv_path.name,
            "renderMode": normalized_mode,
        }


heatmap_loader = HeatmapDataLoader(STATIC_ROOT / "admin_heatmap_dataset.csv")


class AppHandler(BaseHTTPRequestHandler):
    server_version = "OlongapoRouteFinderPython/1.0"

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self.respond_json({"status": "ok"})
            return

        if parsed.path == "/api/bootstrap":
            self.handle_bootstrap()
            return

        if parsed.path == "/api/weather":
            self.handle_weather()
            return

        if parsed.path == "/api/pricing/fuel":
            self.handle_fuel_price()
            return

        if parsed.path == "/api/heatmap-data":
            self.handle_heatmap_data(parsed.query)
            return

        self.serve_static(parsed.path)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        body = self.read_json_body()

        if parsed.path == "/api/nearest-road-point":
            self.handle_nearest_road_point(body)
            return

        if parsed.path == "/api/route":
            self.handle_route(body)
            return

        if parsed.path == "/api/intelligent-match":
            self.handle_intelligent_match(body)
            return

        if parsed.path == "/api/traffic-samples":
            self.handle_traffic_samples(body)
            return

        if parsed.path == "/api/pricing/estimate":
            self.handle_pricing_estimate(body)
            return

        if parsed.path == "/api/best-driver":
            self.handle_best_driver(body)
            return

        self.respond_json({"error": "Not found"}, status=HTTPStatus.NOT_FOUND)

    def handle_bootstrap(self) -> None:
        try:
            self.respond_json(SERVICE.bootstrap_payload())
        except Exception as error:  # noqa: BLE001
            self.respond_error_payload(error)

    def handle_weather(self) -> None:
        try:
            self.respond_json(SERVICE.load_weather())
        except Exception as error:  # noqa: BLE001
            self.respond_error_payload(error)

    def handle_fuel_price(self) -> None:
        try:
            self.respond_json(FUEL_PRICE_PROVIDER.get_current_price())
        except Exception as error:  # noqa: BLE001
            self.respond_error_payload(error)

    def handle_pricing_estimate(self, body: dict[str, Any]) -> None:
        try:
            fuel = FUEL_PRICE_PROVIDER.get_current_price()
            hour_val = body.get("hourOfDay")
            hour_of_day = int(hour_val) if hour_val is not None else None
            
            estimate = calculate_fare(
                vehicle_type=str(body.get("vehicleType", "motorcycle")),
                pickup_distance_meters=float(body.get("pickupDistanceMeters", 0) or 0),
                trip_distance_meters=float(body.get("tripDistanceMeters", 0) or 0),
                fuel_price_per_liter=float(fuel["pricePerLiter"]),
                hour_of_day=hour_of_day,
            )
            estimate["fuelPrice"] = fuel
            estimate["sourceNote"] = (
                "Uses SAKTOGO_FUEL_PRICE_API_URL when configured; otherwise uses the local fallback price."
            )
            self.respond_json(estimate)
        except Exception as error:  # noqa: BLE001
            self.respond_error_payload(error)

    def handle_heatmap_data(self, query_string: str) -> None:
        params = parse_qs(query_string)
        hour_values = params.get("hour", [])
        mode_values = params.get("mode", [])

        if not hour_values:
            self.respond_json(
                {"error": "Invalid hour parameter. Must be an integer between 0 and 23."},
                status=HTTPStatus.BAD_REQUEST,
            )
            return

        hour_str = hour_values[0]
        try:
            hour = int(hour_str)
        except (ValueError, TypeError):
            self.respond_json(
                {"error": "Invalid hour parameter. Must be an integer between 0 and 23."},
                status=HTTPStatus.BAD_REQUEST,
            )
            return

        if hour < 0 or hour > 23:
            self.respond_json(
                {"error": "Invalid hour parameter. Must be an integer between 0 and 23."},
                status=HTTPStatus.BAD_REQUEST,
            )
            return

        # Check for load errors
        if heatmap_loader.load_error:
            if "not found" in heatmap_loader.load_error.lower():
                self.respond_json(
                    {"error": heatmap_loader.load_error},
                    status=HTTPStatus.NOT_FOUND,
                )
                return
            if "missing required columns" in heatmap_loader.load_error.lower():
                self.respond_json(
                    {"error": heatmap_loader.load_error},
                    status=HTTPStatus.BAD_REQUEST,
                )
                return
            # Other load errors
            self.respond_json(
                {"error": heatmap_loader.load_error},
                status=HTTPStatus.INTERNAL_SERVER_ERROR,
            )
            return

        mode = mode_values[0].strip().lower() if mode_values else "aggregated"
        data = heatmap_loader.get_heatmap_data(hour, mode)
        self.respond_json(data)

    def handle_nearest_road_point(self, body: dict[str, Any]) -> None:
        try:
            lat = float(body["lat"])
            lng = float(body["lng"])
            SERVICE.ensure_bootstrapped()
            snapped = SERVICE.get_nearest_road_point(lat, lng)
            if not snapped:
                self.respond_json({"error": "No nearby routable street segment was found."}, status=HTTPStatus.NOT_FOUND)
                return
            self.respond_json(asdict(snapped))
        except Exception as error:  # noqa: BLE001
            self.respond_error_payload(error)

    def handle_route(self, body: dict[str, Any]) -> None:
        try:
            SERVICE.ensure_bootstrapped()
            start_id = str(body["startNodeId"])
            goal_id = str(body["goalNodeId"])
            path = SERVICE.run_a_star(start_id, goal_id)
            if not path:
                self.respond_json({"error": "No route found."}, status=HTTPStatus.NOT_FOUND)
                return
            self.respond_json(path)
        except Exception as error:  # noqa: BLE001
            self.respond_error_payload(error)

    def handle_best_driver(self, body: dict[str, Any]) -> None:
        try:
            lat = float(body["lat"])
            lng = float(body["lng"])
            drivers = body.get("drivers", [])
            result = SERVICE.find_best_driver(lat, lng, drivers)
            if not result:
                self.respond_json({"error": "No connected available driver route was found."}, status=HTTPStatus.NOT_FOUND)
                return
            self.respond_json(result)
        except Exception as error:  # noqa: BLE001
            self.respond_error_payload(error)

    def handle_intelligent_match(self, body: dict[str, Any]) -> None:
        try:
            pickup = body["pickup"]
            dropoff = body["dropoff"]
            vehicle_type = str(body["vehicleType"])
            drivers = body.get("drivers", [])
            result = SERVICE.rank_intelligent_drivers(
                float(pickup["lat"]),
                float(pickup["lng"]),
                float(dropoff["lat"]),
                float(dropoff["lng"]),
                vehicle_type,
                drivers,
            )

            if result.get("rankedCandidates"):
                self.respond_json(result)
                return

            self.respond_json(result, status=HTTPStatus.NOT_FOUND)
        except Exception as error:  # noqa: BLE001
            self.respond_error_payload(error)

    def handle_traffic_samples(self, body: dict[str, Any]) -> None:
        try:
            samples = body.get("samples", [])
            if not isinstance(samples, list):
                self.respond_json({"error": "samples must be a list"}, status=HTTPStatus.BAD_REQUEST)
                return

            self.respond_json(
                {
                    "samples": SERVICE.lookup_live_traffic_samples(samples),
                    "liveTrafficEnabled": SERVICE.has_live_traffic_enabled(),
                }
            )
        except Exception as error:  # noqa: BLE001
            self.respond_error_payload(error)

    def serve_static(self, request_path: str) -> None:
        relative_path = "index.html" if request_path in {"", "/"} else request_path.lstrip("/")
        file_path = (STATIC_ROOT / relative_path).resolve()

        if STATIC_ROOT not in file_path.parents and file_path != STATIC_ROOT:
            self.respond_json({"error": "Forbidden"}, status=HTTPStatus.FORBIDDEN)
            return

        if not file_path.exists() or not file_path.is_file():
            self.respond_json({"error": "Not found"}, status=HTTPStatus.NOT_FOUND)
            return

        content_type = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
        }.get(file_path.suffix.lower(), "application/octet-stream")

        payload = file_path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def read_json_body(self) -> dict[str, Any]:
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length) if content_length else b"{}"
        return json.loads(raw_body.decode("utf-8") or "{}")

    def respond_json(self, payload: Any, *, status: HTTPStatus = HTTPStatus.OK) -> None:
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def respond_error_payload(self, error: Exception) -> None:
        status = HTTPStatus.BAD_GATEWAY if isinstance(error, (HTTPError, URLError)) else HTTPStatus.INTERNAL_SERVER_ERROR
        self.respond_json({"error": str(error)}, status=status)

    def log_message(self, format: str, *args: Any) -> None:
        return


def main() -> None:
    parser = argparse.ArgumentParser(description="Python backend for the Olongapo Route Finder.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), AppHandler)
    print(f"Serving Olongapo Route Finder on http://{args.host}:{args.port}")
    print(f"Heatmap dataset path: {heatmap_loader.csv_path}")
    if heatmap_loader.load_error:
        print(f"Heatmap dataset error: {heatmap_loader.load_error}")
    else:
        print("Heatmap dataset loaded successfully.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
