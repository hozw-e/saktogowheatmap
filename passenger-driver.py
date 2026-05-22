from __future__ import annotations

import math
from copy import deepcopy
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo


MATCH_DEFAULT_RADIUS_METERS = 3000
MATCH_EXPANDED_RADIUS_METERS = 5000
MATCH_TRAFFIC_FALLBACK_RATIO = 0.72
MATCH_TRAFFIC_SAMPLE_COUNT = 3
DRIVER_SPEED_KPH = 25
USER_POINT_NODE_ID = "__user_point__"
DROPOFF_POINT_NODE_ID = "__dropoff_point__"
OLONGAPO_TIMEZONE = "Asia/Manila"


def rank_drivers(
    service: Any,
    *,
    pickup_lat: float,
    pickup_lng: float,
    dropoff_lat: float,
    dropoff_lng: float,
    vehicle_type: str,
    drivers: list[dict[str, Any]],
) -> dict[str, Any]:
    service.ensure_bootstrapped()
    weather_context = build_weather_context(service)

    pickup_snapped = service.get_nearest_road_point(pickup_lat, pickup_lng)
    if not pickup_snapped:
        return {
            "rankedCandidates": [],
            "baselineCandidate": None,
            "radiusMeters": MATCH_DEFAULT_RADIUS_METERS,
            "reasonTitle": "No nearby street for pickup",
            "reasonDetail": "The pickup point could not be snapped to a routable road segment.",
            "offerTitle": "Pickup is not on a routable road",
            "offerDetail": "Choose a pickup closer to a mapped street segment inside Olongapo.",
            "statusMessage": "The pickup point could not be snapped to a routable road segment.",
            "matchingMode": "backend_primary",
        }

    dropoff_snapped = service.get_nearest_road_point(dropoff_lat, dropoff_lng)
    if not dropoff_snapped:
        return {
            "rankedCandidates": [],
            "baselineCandidate": None,
            "radiusMeters": MATCH_DEFAULT_RADIUS_METERS,
            "reasonTitle": "No nearby street for drop-off",
            "reasonDetail": "The drop-off point could not be snapped to a routable road segment.",
            "offerTitle": "Drop-off is not on a routable road",
            "offerDetail": "Choose a drop-off closer to a mapped street segment inside Olongapo.",
            "statusMessage": "The drop-off point could not be snapped to a routable road segment.",
            "matchingMode": "backend_primary",
        }

    graph, node_index = clone_base_graph(service)
    add_temporary_point_to_graph(
        service, graph, node_index, pickup_snapped, USER_POINT_NODE_ID)
    add_temporary_point_to_graph(
        service, graph, node_index, dropoff_snapped, DROPOFF_POINT_NODE_ID)

    trip_path = service.run_a_star(
        USER_POINT_NODE_ID, DROPOFF_POINT_NODE_ID, graph=graph, node_index=node_index)
    if not trip_path:
        return {
            "rankedCandidates": [],
            "baselineCandidate": None,
            "radiusMeters": MATCH_DEFAULT_RADIUS_METERS,
            "reasonTitle": "Pickup and drop-off are not connected",
            "reasonDetail": "No route was found between the snapped pickup and drop-off points.",
            "offerTitle": "Pickup and drop-off are not connected",
            "offerDetail": "Choose a different drop-off point inside the routable street network.",
            "statusMessage": "No road route was found between the pickup and drop-off points.",
            "matchingMode": "backend_primary",
        }

    eligible_drivers: list[dict[str, Any]] = []
    radius_meters = MATCH_DEFAULT_RADIUS_METERS
    pickup_node = node_index[USER_POINT_NODE_ID]

    for search_radius in (MATCH_DEFAULT_RADIUS_METERS, MATCH_EXPANDED_RADIUS_METERS):
        eligible_drivers = [
            driver
            for driver in drivers
            if is_driver_eligible(service, driver, vehicle_type, pickup_node, search_radius)
        ]
        radius_meters = search_radius
        if eligible_drivers:
            break

    if not eligible_drivers:
        vehicle_label = "car" if vehicle_type == "car" else "motorcycle"
        return {
            "rankedCandidates": [],
            "baselineCandidate": None,
            "radiusMeters": radius_meters,
            "reasonTitle": "No nearby eligible driver",
            "reasonDetail": f"No {vehicle_label} driver passed the current availability rules within 5.0 km.",
            "offerTitle": "No driver found within service range",
            "offerDetail": "We checked 3 km first, then expanded to 5 km, but no nearby driver met the vehicle, radius, route, and availability requirements.",
            "statusMessage": "No eligible driver met the matching rules within 5 km.",
            "matchingMode": "backend_primary",
        }

    baseline_candidate = get_baseline_nearest_driver(
        service, eligible_drivers, pickup_node)
    ranked_candidates = []

    for driver in eligible_drivers:
        candidate = evaluate_candidate(
            service,
            driver,
            pickup_node,
            trip_path,
            graph,
            node_index,
            weather_context,
        )
        if candidate:
            ranked_candidates.append(candidate)

    if not ranked_candidates:
        return {
            "rankedCandidates": [],
            "baselineCandidate": baseline_candidate,
            "radiusMeters": radius_meters,
            "reasonTitle": "No connected driver",
            "reasonDetail": "Nearby drivers were found, but none had a connected A* pickup route.",
            "offerTitle": "No connected driver available",
            "offerDetail": "Nearby drivers passed the filters, but each one was skipped because no A* route to your pickup was found.",
            "statusMessage": "Nearby drivers were found, but none had a connected A* route to your pickup.",
            "matchingMode": "backend_primary",
        }

    apply_relative_scores(ranked_candidates)
    ranked_candidates.sort(
        key=lambda candidate: (
            -candidate["finalScore"],
            candidate["pickupEtaMinutes"],
            candidate["pickupDistanceMeters"],
        )
    )

    for index, candidate in enumerate(ranked_candidates, start=1):
        candidate["rank"] = index
        candidate["selectionReason"] = build_selection_reason(
            candidate, baseline_candidate)

    return {
        "rankedCandidates": ranked_candidates,
        "baselineCandidate": baseline_candidate,
        "radiusMeters": radius_meters,
        "matchingMode": "backend_primary",
        "trafficSource": determine_result_traffic_source(ranked_candidates),
        "weatherSource": str(weather_context["source"]),
        "trafficNotice": determine_result_traffic_notice(ranked_candidates),
        "weatherNotice": str(weather_context["notice"]),
        "reasonTitle": "",
        "reasonDetail": "",
        "offerTitle": "",
        "offerDetail": "",
        "statusMessage": "",
    }


def clone_base_graph(service: Any) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    graph = {node_id: [dict(neighbor) for neighbor in neighbors]
             for node_id, neighbors in service.graph.items()}
    node_index = dict(service.node_index)
    return graph, node_index


def add_temporary_point_to_graph(
    service: Any,
    graph: dict[str, list[dict[str, Any]]],
    node_index: dict[str, Any],
    snapped: Any,
    node_id: str,
) -> None:
    temp_node = type(next(iter(node_index.values())))(
        id=node_id,
        lat=snapped.lat,
        lng=snapped.lng,
    )
    graph[node_id] = []
    node_index[node_id] = temp_node

    from_node = node_index.get(snapped.from_node_id)
    to_node = node_index.get(snapped.to_node_id)
    if not from_node or not to_node:
        return

    if service.has_directed_edge(from_node.id, to_node.id):
        graph.setdefault(from_node.id, []).append(
            {"id": node_id, "distance": snapped.distance_from_start})
        graph[node_id].append(
            {"id": to_node.id, "distance": snapped.distance_to_end})

    if service.has_directed_edge(to_node.id, from_node.id):
        graph.setdefault(to_node.id, []).append(
            {"id": node_id, "distance": snapped.distance_to_end})
        graph[node_id].append(
            {"id": from_node.id, "distance": snapped.distance_from_start})


def build_weather_context(service: Any) -> dict[str, float | str]:
    try:
        weather = service.load_weather()
        raw = weather.get("raw", {})
    except Exception:  # noqa: BLE001
        return {
            "label": "Weather unavailable right now.",
            "multiplier": 1.0,
            "source": "weather_fallback",
            "notice": "Weather source: fallback because live weather was unavailable.",
        }

    multiplier = 1.0
    precipitation = float(raw.get("precipitation", 0) or 0)
    wind_speed = float(raw.get("wind_speed_10m", 0) or 0)
    weather_code = int(raw.get("weather_code", 0) or 0)

    if precipitation >= 5:
        multiplier += 0.2
    elif precipitation > 0:
        multiplier += 0.1

    if wind_speed >= 30:
        multiplier += 0.08

    if weather_code in {65, 67, 81, 82, 95, 96, 99}:
        multiplier += 0.18
    elif weather_code in {61, 63, 80}:
        multiplier += 0.1
    elif weather_code in {45, 48, 51, 53, 55}:
        multiplier += 0.06

    return {
        "label": weather.get("summary", "Weather unavailable right now."),
        "multiplier": multiplier,
        "source": "open_meteo_live",
        "notice": "Weather source: Open-Meteo live weather.",
    }


def is_driver_eligible(
    service: Any,
    driver: dict[str, Any],
    vehicle_type: str,
    pickup_node: Any,
    radius_meters: float,
) -> bool:
    if driver.get("type") != vehicle_type:
        return False
    if driver.get("lockedToUser") or driver.get("heldForOffer"):
        return False
    if driver.get("status") not in {"standby_available", "moving_available"}:
        return False

    distance_to_pickup = service_distance(service, driver, pickup_node)
    return distance_to_pickup <= radius_meters


def get_baseline_nearest_driver(service: Any, drivers: list[dict[str, Any]], pickup_node: Any) -> dict[str, Any] | None:
    if not drivers:
        return None

    best_driver = min(drivers, key=lambda driver: service_distance(
        service, driver, pickup_node))
    return {
        "driverId": best_driver["id"],
        "type": best_driver.get("type"),
        "directDistanceMeters": service_distance(service, best_driver, pickup_node),
    }


def evaluate_candidate(
    service: Any,
    driver: dict[str, Any],
    pickup_node: Any,
    trip_path: dict[str, Any],
    graph: dict[str, list[dict[str, Any]]],
    node_index: dict[str, Any],
    weather_context: dict[str, float | str],
) -> dict[str, Any] | None:
    start_node = get_driver_route_start_node(service, driver)
    if not start_node:
        return None

    pickup_path = service.run_a_star(
        start_node.id, USER_POINT_NODE_ID, graph=graph, node_index=node_index)
    if not pickup_path:
        return None

    start_offset_meters = service_distance(service, driver, start_node)
    pickup_distance_meters = pickup_path["distance"] + start_offset_meters
    direct_distance_meters = service_distance(service, driver, pickup_node)
    weather_multiplier = float(weather_context["multiplier"])
    traffic_context = build_traffic_context(
        service,
        start_node,
        pickup_path,
        pickup_distance_meters,
        node_index,
        weather_multiplier,
    )
    traffic_ratio = float(traffic_context["ratio"])
    speed_kph = float(driver.get("speedKph") or DRIVER_SPEED_KPH)
    pickup_eta_minutes = get_eta_minutes(
        pickup_distance_meters, speed_kph, traffic_ratio, weather_multiplier)
    trip_eta_minutes = get_eta_minutes(
        float(trip_path["distance"]), speed_kph, traffic_ratio, weather_multiplier)
    rating = float(driver.get("rating") or 4.2)
    cancellation_rate = float(driver.get("cancellationRate") or 0.08)
    route_efficiency_score = clamp_value(
        direct_distance_meters / max(pickup_distance_meters, 1), 0, 1)
    movement_score = get_movement_score(
        service, driver, pickup_node, direct_distance_meters)
    traffic_score = clamp_value(traffic_ratio, 0, 1)

    return {
        "driver": deepcopy(driver),
        "startNode": node_to_payload(start_node),
        "pickupPath": deepcopy(pickup_path),
        "tripPath": deepcopy(trip_path),
        "pickupDistanceMeters": pickup_distance_meters,
        "directDistanceMeters": direct_distance_meters,
        "pickupEtaMinutes": pickup_eta_minutes,
        "tripEtaMinutes": trip_eta_minutes,
        "trafficRatio": traffic_ratio,
        "weatherMultiplier": weather_multiplier,
        "trafficSource": str(traffic_context["source"]),
        "trafficNotice": str(traffic_context["notice"]),
        "trafficSamplesUsed": int(traffic_context.get("sampleCount", 0) or 0),
        "weatherSource": str(weather_context["source"]),
        "weatherNotice": str(weather_context["notice"]),
        "trafficScore": traffic_score,
        "ratingScore": clamp_value((rating - 4) / 1, 0, 1),
        "cancellationScore": clamp_value(1 - (cancellation_rate / 0.25), 0, 1),
        "routeEfficiencyScore": route_efficiency_score,
        "movementScore": movement_score,
        "distanceScore": 0.0,
        "finalScore": 0.0,
        "matchingMode": "backend_primary",
        "scoreBreakdown": {},
        "debug": {},
        "selectionReason": "",
        "rank": 0,
    }


def get_driver_route_start_node(service: Any, driver: dict[str, Any]) -> Any | None:
    nearest_node = service.get_nearest_node(
        float(driver["lat"]), float(driver["lng"]))
    candidates = []

    current_node_id = driver.get("currentNodeId")
    if current_node_id:
        current_node = service.node_index.get(str(current_node_id))
        if current_node:
            candidates.append(current_node)

    route_node_ids = driver.get("routeNodeIds") or []
    route_segment_index = int(driver.get("routeSegmentIndex") or 0)
    next_index = route_segment_index + 1
    if next_index < len(route_node_ids):
        next_node = service.node_index.get(str(route_node_ids[next_index]))
        if next_node:
            candidates.append(next_node)

    if nearest_node:
        candidates.append(nearest_node)

    if not candidates:
        return None

    return min(candidates, key=lambda node: service_distance(service, driver, node))


def apply_relative_scores(candidates: list[dict[str, Any]]) -> None:
    distance_values = [candidate["pickupDistanceMeters"]
                       for candidate in candidates]
    distance_min = min(distance_values)
    distance_max = max(distance_values)

    for candidate in candidates:
        candidate["distanceScore"] = inverse_relative_score(
            candidate["pickupDistanceMeters"], distance_min, distance_max)
        candidate["finalScore"] = (
            (candidate["distanceScore"] * 0.35)
            + (candidate["trafficScore"] * 0.25)
            + (candidate["ratingScore"] * 0.10)
            + (candidate["cancellationScore"] * 0.10)
            + (candidate["routeEfficiencyScore"] * 0.15)
            + (candidate["movementScore"] * 0.05)
        )
        candidate["scoreBreakdown"] = {
            "distance_score": candidate["distanceScore"],
            "traffic_score": candidate["trafficScore"],
            "rating_score": candidate["ratingScore"],
            "cancellation_score": candidate["cancellationScore"],
            "route_efficiency_score": candidate["routeEfficiencyScore"],
            "movement_score": candidate["movementScore"],
            "final_score": candidate["finalScore"],
        }
        candidate["debug"] = {
            "traffic_ratio": candidate["trafficRatio"],
            "traffic_source": candidate["trafficSource"],
            "weather_multiplier": candidate["weatherMultiplier"],
            "weather_source": candidate["weatherSource"],
            "distance_score": candidate["distanceScore"],
            "traffic_score": candidate["trafficScore"],
            "rating_score": candidate["ratingScore"],
            "cancellation_score": candidate["cancellationScore"],
            "route_efficiency_score": candidate["routeEfficiencyScore"],
            "movement_score": candidate["movementScore"],
            "final_score": candidate["finalScore"],
        }


def build_selection_reason(candidate: dict[str, Any], baseline_candidate: dict[str, Any] | None) -> str:
    parts = []

    if not baseline_candidate or baseline_candidate["driverId"] == candidate["driver"]["id"]:
        parts.append("also the nearest eligible driver")
    else:
        parts.append(
            f"beat the nearest baseline driver with a stronger overall score ({candidate['finalScore']:.2f})")

    parts.append(
        f"{describe_traffic_ratio(candidate['trafficRatio'])} traffic")
    parts.append(describe_traffic_source_reason(candidate["trafficSource"]))
    parts.append(
        f"{candidate['pickupDistanceMeters'] / 1000:.2f} km routed pickup distance")
    parts.append(
        f"{round(candidate['routeEfficiencyScore'] * 100)}% route efficiency")
    parts.append(
        f"{float(candidate['driver'].get('rating') or 4.2):.2f} rating")
    parts.append(
        f"{format_cancellation_risk(float(candidate['driver'].get('cancellationRate') or 0.08))} cancellation risk")
    parts.append(describe_movement_behavior(
        candidate["driver"], candidate["movementScore"]))
    return "ETA is shown for user understanding but not scored directly. Selected because it " + ", ".join(parts) + "."


def build_traffic_context(
    service: Any,
    start_node: Any,
    pickup_path: dict[str, Any],
    pickup_distance_meters: float,
    node_index: dict[str, Any],
    weather_multiplier: float,
) -> dict[str, Any]:
    sample_node_ids = [
        start_node.id, *sample_route_node_ids(pickup_path["nodeIds"], MATCH_TRAFFIC_SAMPLE_COUNT)]
    ratios: list[float] = []

    try:
        for sample_node_id in dict.fromkeys(sample_node_ids):
            sample_node = node_index.get(sample_node_id)
            if not sample_node:
                continue

            result = service.lookup_live_traffic(
                float(sample_node.lat),
                float(sample_node.lng),
                node_id=str(sample_node.id),
                nearby_candidate_limit=2,
                node_index=node_index,
            )
            if not result or not result.get("traffic"):
                continue

            ratios.append(get_live_traffic_ratio(result["traffic"]))

        if ratios:
            return {
                "ratio": sum(ratios) / len(ratios),
                "source": "tomtom_live",
                "notice": "Traffic source: TomTom live traffic.",
                "sampleCount": len(ratios),
            }
    except Exception:  # noqa: BLE001
        pass

    return {
        "ratio": estimate_traffic_ratio(pickup_distance_meters, weather_multiplier),
        "source": "heuristic_fallback",
        "notice": "Traffic source: heuristic fallback because live traffic was unavailable.",
        "sampleCount": 0,
    }


def sample_route_node_ids(node_ids: list[str], max_samples: int) -> list[str]:
    if not node_ids or max_samples <= 0:
        return []
    if len(node_ids) <= max_samples:
        return list(node_ids)

    sampled = []
    step = (len(node_ids) - 1) / max(max_samples - 1, 1)
    for index in range(max_samples):
        sampled.append(node_ids[round(index * step)])
    return list(dict.fromkeys(sampled))


def get_live_traffic_ratio(traffic: dict[str, Any]) -> float:
    free_flow_speed = max(float(traffic.get("freeFlowSpeed") or 0), 1.0)
    current_speed = max(float(traffic.get("currentSpeed") or 0), 0.0)
    raw_ratio = current_speed / free_flow_speed

    if traffic.get("roadClosure"):
        return 0.15
    if raw_ratio <= 0.30:
        return 0.15
    return clamp_value(raw_ratio, 0.15, 1.0)


def estimate_traffic_ratio(pickup_distance_meters: float, weather_multiplier: float) -> float:
    current_hour = datetime.now(ZoneInfo(OLONGAPO_TIMEZONE)).hour

    if 7 <= current_hour < 10 or 16 <= current_hour < 20:
        base_ratio = 0.58
    elif 10 <= current_hour < 16:
        base_ratio = 0.72
    elif 5 <= current_hour < 7 or 20 <= current_hour < 22:
        base_ratio = 0.66
    else:
        base_ratio = 0.86

    distance_penalty = min((pickup_distance_meters / 1000) * 0.015, 0.08)
    weather_penalty = min(max(weather_multiplier - 1, 0) * 0.18, 0.12)
    ratio = base_ratio - distance_penalty - weather_penalty
    return clamp_value(ratio, 0.25, 1.0)


def get_eta_minutes(distance_meters: float, speed_kph: float, traffic_ratio: float, weather_multiplier: float) -> int:
    adjusted_speed_kph = max(
        8, speed_kph * max(traffic_ratio, 0.2)) / max(weather_multiplier, 0.8)
    return max(1, round((distance_meters / 1000 / adjusted_speed_kph) * 60))


def get_movement_score(service: Any, driver: dict[str, Any], pickup_node: Any, direct_distance_meters: float) -> float:
    if driver.get("status") == "standby_available":
        return 0.82

    route_node_ids = driver.get("routeNodeIds") or []
    route_segment_index = int(driver.get("routeSegmentIndex") or 0)
    next_index = route_segment_index + 1
    if next_index < len(route_node_ids):
        next_node = service.node_index.get(str(route_node_ids[next_index]))
        if next_node and service_distance(service, next_node, pickup_node) < direct_distance_meters:
            return 1.0

    return 0.58


def service_distance(service: Any, from_point: Any, to_point: Any) -> float:
    from_lat = float(from_point.lat if hasattr(
        from_point, "lat") else from_point["lat"])
    from_lng = float(from_point.lng if hasattr(
        from_point, "lng") else from_point["lng"])
    to_lat = float(to_point.lat if hasattr(
        to_point, "lat") else to_point["lat"])
    to_lng = float(to_point.lng if hasattr(
        to_point, "lng") else to_point["lng"])
    return haversine_distance(from_lat, from_lng, to_lat, to_lng)


def haversine_distance(from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> float:
    earth_radius = 6371000
    delta_lat = math.radians(to_lat - from_lat)
    delta_lng = math.radians(to_lng - from_lng)
    start_lat_radians = math.radians(from_lat)
    end_lat_radians = math.radians(to_lat)
    arc = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(start_lat_radians) * math.cos(end_lat_radians) *
        math.sin(delta_lng / 2) ** 2
    )
    return 2 * earth_radius * math.asin(math.sqrt(arc))


def inverse_relative_score(value: float, min_value: float, max_value: float) -> float:
    if max_value == min_value:
        return 1.0
    return clamp_value(1 - ((value - min_value) / (max_value - min_value)), 0, 1)


def clamp_value(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def format_cancellation_risk(cancellation_rate: float) -> str:
    if cancellation_rate <= 0.06:
        return "low"
    if cancellation_rate <= 0.12:
        return "medium"
    return "high"


def describe_weather_impact(weather_multiplier: float) -> str:
    if weather_multiplier <= 1.02:
        return "minimal"
    if weather_multiplier <= 1.12:
        return "light"
    if weather_multiplier <= 1.22:
        return "moderate"
    return "strong"


def describe_movement_behavior(driver: dict[str, Any], movement_score: float) -> str:
    if driver.get("status") == "standby_available":
        return "stable standby positioning"
    if movement_score >= 0.95:
        return "movement already trending toward the pickup"
    return "movement direction less favorable than the top candidates"


def describe_traffic_source_reason(source: str) -> str:
    if source == "tomtom_live":
        return "used TomTom live traffic"
    return "used heuristic traffic fallback"


def describe_weather_source_reason(source: str) -> str:
    if source == "open_meteo_live":
        return "used Open-Meteo live weather"
    return "used weather fallback"


def determine_result_traffic_source(candidates: list[dict[str, Any]]) -> str:
    return "tomtom_live" if any(candidate.get("trafficSource") == "tomtom_live" for candidate in candidates) else "heuristic_fallback"


def determine_result_traffic_notice(candidates: list[dict[str, Any]]) -> str:
    if any(candidate.get("trafficSource") == "tomtom_live" for candidate in candidates):
        return "Traffic source: TomTom live traffic."
    return "Traffic source: heuristic fallback because live traffic was unavailable."


def describe_traffic_ratio(ratio: float) -> str:
    if ratio >= 0.85:
        return "free flowing"
    if ratio >= 0.6:
        return "moderate"
    if ratio >= 0.35:
        return "slow"
    return "heavy"


def node_to_payload(node: Any) -> dict[str, Any]:
    if hasattr(node, "__dict__"):
        return {"id": node.id, "lat": node.lat, "lng": node.lng}
    return dict(node)
