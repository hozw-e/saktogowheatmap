from __future__ import annotations

import os
import time
from dataclasses import asdict, dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import json


DEFAULT_FUEL_PRICE_PER_LITER = 86.8
FUEL_PRICE_CACHE_TTL_SECONDS = 3600
OLONGAPO_FUEL_PRICE_API_URL = os.environ.get("SAKTOGO_FUEL_PRICE_API_URL", "").strip()


@dataclass
class PricingConfig:
    motorcycle_km_per_liter: float = 40.0
    car_km_per_liter: float = 11.0
    motorcycle_base_fare: float = 40.0
    car_base_fare: float = 70.0
    motorcycle_rate_per_km: float = 10.0
    car_rate_per_km: float = 18.0
    service_fee: float = 10.0
    fuel_markup_multiplier: float = 1.15
    pickup_multiplier: float = 0.5
    night_surge_multiplier: float = 1.5
    minimum_motorcycle_fare: float = 55.0
    minimum_car_fare: float = 85.0


class FuelPriceProvider:
    def __init__(self) -> None:
        self._cache: dict[str, Any] | None = None
        self._cache_time = 0.0

    def get_current_price(self) -> dict[str, Any]:
        now = time.monotonic()
        if self._cache and now - self._cache_time < FUEL_PRICE_CACHE_TTL_SECONDS:
            return dict(self._cache)

        payload = self._fetch_configured_api_price() if OLONGAPO_FUEL_PRICE_API_URL else None
        if not payload:
            payload = {
                "pricePerLiter": DEFAULT_FUEL_PRICE_PER_LITER,
                "source": "fallback_config",
                "location": "Olongapo",
                "updatedAt": None,
                "note": "Set SAKTOGO_FUEL_PRICE_API_URL to use a live Olongapo fuel-price provider.",
            }

        self._cache = payload
        self._cache_time = now
        return dict(payload)

    def _fetch_configured_api_price(self) -> dict[str, Any] | None:
        try:
            request = Request(
                OLONGAPO_FUEL_PRICE_API_URL,
                headers={
                    "Accept": "application/json",
                    "User-Agent": "SaktoGoPricing/1.0",
                },
            )
            with urlopen(request, timeout=8) as response:
                payload = json.load(response)
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, OSError):
            return None

        price = extract_price_per_liter(payload)
        if price is None:
            return None

        return {
            "pricePerLiter": price,
            "source": "configured_api",
            "location": payload.get("location") or payload.get("city") or "Olongapo",
            "updatedAt": payload.get("updatedAt") or payload.get("updated_at") or payload.get("date"),
            "note": payload.get("note") or "",
        }


def extract_price_per_liter(payload: Any) -> float | None:
    if isinstance(payload, list):
        values = [extract_price_per_liter(item) for item in payload]
        prices = [value for value in values if value is not None and value > 0]
        if prices:
            return sum(prices) / len(prices)
        return None

    if not isinstance(payload, dict):
        return None

    candidates = [
        payload.get("pricePerLiter"),
        payload.get("price_per_liter"),
        payload.get("gasoline"),
        payload.get("gasoline91"),
        payload.get("gasoline_91"),
        payload.get("ron91"),
        payload.get("RON91"),
        payload.get("unleaded"),
        payload.get("unleaded91"),
        payload.get("regular"),
        payload.get("regularGasoline"),
    ]

    for candidate in candidates:
        try:
            value = float(candidate)
        except (TypeError, ValueError):
            continue
        if value > 0:
            return value

    prices = payload.get("prices") or payload.get("fuelPrices") or payload.get("fuel_prices")
    if isinstance(prices, (dict, list)):
        return extract_price_per_liter(prices)

    return None


def calculate_fare(
    *,
    vehicle_type: str,
    pickup_distance_meters: float,
    trip_distance_meters: float,
    fuel_price_per_liter: float,
    hour_of_day: int | None = None,
    config: PricingConfig | None = None,
) -> dict[str, Any]:
    config = config or PricingConfig()
    pickup_km = max(0.0, pickup_distance_meters / 1000)
    trip_km = max(0.0, trip_distance_meters / 1000)
    route_km = pickup_km + trip_km
    billed_route_km = (pickup_km * config.pickup_multiplier) + trip_km

    vehicle = vehicle_type if vehicle_type == "car" else "motorcycle"

    if vehicle == "car":
        km_per_liter = config.car_km_per_liter
        base_fare = config.car_base_fare
        rate_per_km = config.car_rate_per_km
        minimum_fare = config.minimum_car_fare
    else:
        km_per_liter = config.motorcycle_km_per_liter
        base_fare = config.motorcycle_base_fare
        rate_per_km = config.motorcycle_rate_per_km
        minimum_fare = config.minimum_motorcycle_fare

    is_night_surge = False
    if hour_of_day is not None and (hour_of_day >= 22 or hour_of_day < 5):
        is_night_surge = True
        base_fare *= config.night_surge_multiplier
        minimum_fare *= config.night_surge_multiplier

    # Actual fuel consumed uses the real physical route
    liters_used = route_km / max(km_per_liter, 1)
    
    # Billing uses the discounted billed route
    billed_liters = billed_route_km / max(km_per_liter, 1)
    fuel_cost = billed_liters * fuel_price_per_liter
    distance_fee = billed_route_km * rate_per_km
    
    fuel_component = fuel_cost * config.fuel_markup_multiplier
    subtotal = base_fare + distance_fee + fuel_component + config.service_fee
    total = max(minimum_fare, subtotal)

    return {
        "isNightSurge": is_night_surge,
        "vehicleType": vehicle,
        "routeKm": round(route_km, 2),
        "billedRouteKm": round(billed_route_km, 2),
        "pickupKm": round(pickup_km, 2),
        "tripKm": round(trip_km, 2),
        "kmPerLiter": km_per_liter,
        "fuelPricePerLiter": round(fuel_price_per_liter, 2),
        "litersUsed": round(liters_used, 3),
        "fuelCost": round(fuel_cost, 2),
        "fuelComponent": round(fuel_component, 2),
        "baseFare": round(base_fare, 2),
        "distanceFee": round(distance_fee, 2),
        "serviceFee": round(config.service_fee, 2),
        "minimumFare": round(minimum_fare, 2),
        "totalFare": round(total, 2),
        "config": asdict(config),
    }


FUEL_PRICE_PROVIDER = FuelPriceProvider()
