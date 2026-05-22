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


@dataclass
class WeatherPricingAdjustment:
    label: str
    summary: str
    source: str
    category: str
    weather_code: int | None
    precipitation_mm: float
    wind_speed_kph: float
    surcharge_rate: float
    note: str


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
    weather_payload: dict[str, Any] | None = None,
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
    subtotal_before_weather = max(minimum_fare, subtotal)
    weather_adjustment = build_weather_pricing_adjustment(weather_payload)
    weather_surcharge = subtotal_before_weather * weather_adjustment.surcharge_rate
    total = subtotal_before_weather + weather_surcharge

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
        "subtotalBeforeWeather": round(subtotal_before_weather, 2),
        "weatherSurcharge": round(weather_surcharge, 2),
        "weatherSurchargeRate": round(weather_adjustment.surcharge_rate, 4),
        "weatherAdjustment": asdict(weather_adjustment),
        "totalFare": round(total, 2),
        "config": asdict(config),
    }


def build_weather_pricing_adjustment(weather_payload: dict[str, Any] | None) -> WeatherPricingAdjustment:
    if not isinstance(weather_payload, dict):
        return WeatherPricingAdjustment(
            label="Weather unavailable",
            summary="Weather unavailable right now.",
            source="weather_fallback",
            category="unknown",
            weather_code=None,
            precipitation_mm=0.0,
            wind_speed_kph=0.0,
            surcharge_rate=0.0,
            note="No live weather surcharge was applied.",
        )

    raw = weather_payload.get("raw") if isinstance(weather_payload.get("raw"), dict) else {}
    summary = str(weather_payload.get("summary") or "Weather unavailable right now.")
    source = str(weather_payload.get("source") or "weather_fallback")
    weather_code = parse_weather_code(raw.get("weather_code"))
    precipitation_mm = parse_weather_float(raw.get("precipitation"))
    wind_speed_kph = parse_weather_float(raw.get("wind_speed_10m"))

    base_rate, category, label = classify_weather_surcharge(weather_code)
    surcharge_rate = base_rate + get_precipitation_surcharge_bump(precipitation_mm) + get_wind_surcharge_bump(wind_speed_kph)
    surcharge_rate = clamp_value(surcharge_rate, 0.0, 0.28)

    if source != "open_meteo_live" or not raw:
        surcharge_rate = 0.0
        note = "Live Open-Meteo weather was unavailable, so no weather surcharge was applied."
    elif surcharge_rate <= 0:
        note = "Current Olongapo weather is fair, so no weather surcharge was applied."
    else:
        note = f"Live Olongapo weather added a {round(surcharge_rate * 100)}% surcharge."

    return WeatherPricingAdjustment(
        label=label,
        summary=summary,
        source=source,
        category=category,
        weather_code=weather_code,
        precipitation_mm=round(precipitation_mm, 2),
        wind_speed_kph=round(wind_speed_kph, 2),
        surcharge_rate=round(surcharge_rate, 4),
        note=note,
    )


def classify_weather_surcharge(weather_code: int | None) -> tuple[float, str, str]:
    if weather_code in {0, 1}:
        return (0.0, "fair", "Sunny")
    if weather_code == 2:
        return (0.0, "fair", "Partly cloudy")
    if weather_code == 3:
        return (0.02, "cloudy", "Cloudy")
    if weather_code in {45, 48, 51, 53, 55}:
        return (0.05, "drizzle_or_fog", "Drizzle or fog")
    if weather_code in {61, 80}:
        return (0.08, "light_rain", "Light rain")
    if weather_code in {63, 81}:
        return (0.12, "rain", "Rain")
    if weather_code in {65, 82}:
        return (0.18, "heavy_rain", "Heavy rain")
    if weather_code in {95, 96, 99}:
        return (0.24, "thunderstorm", "Thunderstorm")
    return (0.03, "unclassified", "Unsettled weather")


def get_precipitation_surcharge_bump(precipitation_mm: float) -> float:
    if precipitation_mm >= 10:
        return 0.04
    if precipitation_mm >= 5:
        return 0.03
    if precipitation_mm >= 2:
        return 0.02
    if precipitation_mm > 0:
        return 0.01
    return 0.0


def get_wind_surcharge_bump(wind_speed_kph: float) -> float:
    if wind_speed_kph >= 35:
        return 0.03
    if wind_speed_kph >= 25:
        return 0.02
    if wind_speed_kph >= 15:
        return 0.01
    return 0.0


def parse_weather_code(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def parse_weather_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def clamp_value(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


FUEL_PRICE_PROVIDER = FuelPriceProvider()
