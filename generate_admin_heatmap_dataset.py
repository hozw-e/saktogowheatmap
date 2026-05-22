import csv
import math
import random
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, time, timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parent
ESTABLISHMENTS_FILE = ROOT / "ADMIN_MAP_ESTABLISHMENTS.md"
SOURCE_STREET_DATASET = ROOT / "ride_hailing_dataset.csv"
OUTPUT_FILE = ROOT / "admin_heatmap_dataset.csv"
BASE_DATE = date(2026, 4, 1)
RANDOM_SEED = 20260523

SECTIONS = [
    "Other Big Establishments",
    "Parks",
    "Public Markets",
    "Schools / Academic Establishments",
    "Supermalls",
    "Transport & Civic Centers",
]

SECTION_TOTALS = {
    "Other Big Establishments": 68000,
    "Parks": 8000,
    "Public Markets": 6000,
    "Schools / Academic Establishments": 36000,
    "Supermalls": 28000,
    "Transport & Civic Centers": 54000,
}

DAY_ROWS = [
    ("Day 1", "Partly cloudy", [2445, 286, 217, 1295, 1007, 1944]),
    ("Day 2", "Sunny", [2329, 273, 205, 1231, 957, 1848]),
    ("Day 3", "Cloudy", [2515, 300, 222, 1335, 1039, 1999]),
    ("Day 4", "Light rain", [3027, 357, 266, 1605, 1246, 2402]),
    ("Day 5", "Rain", [3377, 396, 298, 1785, 1390, 2681]),
    ("Day 6", "Partly cloudy", [2445, 286, 217, 1295, 1007, 1943]),
    ("Day 7", "Sunny", [2328, 273, 205, 1231, 957, 1848]),
    ("Day 8", "Cloudy", [2515, 300, 222, 1335, 1039, 1999]),
    ("Day 9", "Light drizzle", [2679, 314, 238, 1416, 1101, 2127]),
    ("Day 10", "Light rain", [3027, 357, 266, 1605, 1246, 2402]),
    ("Day 11", "Rain", [3377, 396, 298, 1785, 1390, 2681]),
    ("Day 12", "Heavy rain", [3960, 465, 350, 2095, 1628, 3143]),
    ("Day 13", "Cloudy", [2515, 300, 222, 1335, 1038, 1999]),
    ("Day 14", "Partly cloudy", [2445, 286, 217, 1295, 1007, 1943]),
    ("Day 15", "Sunny", [2328, 273, 205, 1231, 957, 1848]),
    ("Day 16", "Rain", [3377, 396, 298, 1785, 1390, 2681]),
    ("Day 17", "Cloudy", [2515, 300, 222, 1333, 1038, 1999]),
    ("Day 18", "Light rain", [3027, 357, 266, 1605, 1246, 2402]),
    ("Day 19", "Thunderstorm", [4308, 504, 380, 2279, 1774, 3421]),
    ("Day 20", "Partly cloudy", [2445, 286, 217, 1295, 1007, 1943]),
    ("Day 21", "Sunny", [2328, 273, 204, 1231, 957, 1848]),
    ("Day 22", "Drizzle", [2796, 329, 245, 1480, 1151, 2219]),
    ("Day 23", "Rain", [3377, 396, 298, 1785, 1390, 2681]),
    ("Day 24", "Cloudy", [2515, 297, 222, 1333, 1038, 1999]),
]

HOUR_ROWS = [
    ("00:00-01:00", 0, [1590, 50, 24, 103, 66, 351]),
    ("01:00-02:00", 1, [1304, 26, 0, 60, 41, 253]),
    ("02:00-03:00", 2, [924, 24, 0, 39, 26, 209]),
    ("03:00-04:00", 3, [725, 24, 33, 39, 26, 253]),
    ("04:00-05:00", 4, [581, 58, 164, 103, 41, 701]),
    ("05:00-06:00", 5, [868, 478, 546, 616, 66, 2111]),
    ("06:00-07:00", 6, [1729, 723, 694, 3695, 114, 3934]),
    ("07:00-08:00", 7, [2894, 478, 651, 4111, 209, 4640]),
    ("08:00-09:00", 8, [3182, 205, 507, 2462, 491, 4215]),
    ("09:00-10:00", 9, [2747, 148, 344, 1232, 982, 2536]),
    ("10:00-11:00", 10, [2455, 148, 273, 1027, 1687, 2111]),
    ("11:00-12:00", 11, [2747, 178, 238, 2462, 1970, 1832]),
    ("12:00-13:00", 12, [3035, 205, 219, 2667, 1832, 1832]),
    ("13:00-14:00", 13, [3035, 242, 219, 2051, 1687, 2111]),
    ("14:00-15:00", 14, [2747, 327, 253, 1232, 1832, 2388]),
    ("15:00-16:00", 15, [3035, 478, 344, 1644, 2110, 2811]),
    ("16:00-17:00", 16, [3759, 809, 467, 3695, 2671, 4215]),
    ("17:00-18:00", 17, [4916, 989, 437, 4111, 2946, 4640]),
    ("18:00-19:00", 18, [5496, 869, 273, 2462, 2807, 4356]),
    ("19:00-20:00", 19, [5200, 660, 140, 1027, 2533, 3508]),
    ("20:00-21:00", 20, [4916, 416, 75, 511, 1970, 2111]),
    ("21:00-22:00", 21, [4332, 242, 49, 307, 1122, 1406]),
    ("22:00-23:00", 22, [3468, 148, 26, 204, 562, 914]),
    ("23:00-00:00", 23, [2315, 75, 24, 140, 209, 562]),
]


@dataclass(frozen=True)
class Establishment:
    section: str
    name: str
    lat: float
    lng: float

    @property
    def key(self) -> str:
        return f"{self.name}|{self.lat:.6f}|{self.lng:.6f}"


@dataclass(frozen=True)
class StreetPoint:
    lat: float
    lng: float


class StreetPointSelector:
    def __init__(self, points: list[StreetPoint]) -> None:
        if not points:
            raise ValueError("StreetPointSelector requires at least one point.")
        self.points = list(points)
        self.cursor = 0
        random.shuffle(self.points)

    def next_point(self) -> StreetPoint:
        if self.cursor >= len(self.points):
            random.shuffle(self.points)
            self.cursor = 0
        point = self.points[self.cursor]
        self.cursor += 1
        return point


def parse_establishments() -> dict[str, list[Establishment]]:
    if not ESTABLISHMENTS_FILE.exists():
        raise FileNotFoundError(f"Missing establishments file: {ESTABLISHMENTS_FILE}")

    section_heading = re.compile(r"^## (.+?) \(\d+\)$")
    item_pattern = re.compile(r"^- (.+) \(([-0-9.]+), ([-0-9.]+)\)$")
    establishments: dict[str, list[Establishment]] = defaultdict(list)
    current_section = None

    for raw_line in ESTABLISHMENTS_FILE.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        heading_match = section_heading.match(line)
        if heading_match:
            section_name = heading_match.group(1)
            current_section = section_name if section_name in SECTIONS else None
            continue

        item_match = item_pattern.match(line)
        if item_match and current_section:
            establishments[current_section].append(
                Establishment(
                    section=current_section,
                    name=item_match.group(1),
                    lat=float(item_match.group(2)),
                    lng=float(item_match.group(3)),
                )
            )

    missing_sections = [section for section in SECTIONS if not establishments.get(section)]
    if missing_sections:
        raise RuntimeError(f"Missing establishments for sections: {', '.join(missing_sections)}")

    return establishments


def haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius_m = 6371000
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlat = lat2_rad - lat1_rad
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng / 2) ** 2
    )
    return radius_m * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def load_street_points() -> list[StreetPoint]:
    if not SOURCE_STREET_DATASET.exists():
        raise FileNotFoundError(f"Missing source street dataset: {SOURCE_STREET_DATASET}")

    unique_points: dict[tuple[float, float], StreetPoint] = {}
    with SOURCE_STREET_DATASET.open("r", encoding="utf-8", newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        for row in reader:
            for lat_key, lng_key in (
                ("pickup_latitude", "pickup_longitude"),
                ("dropoff_latitude", "dropoff_longitude"),
            ):
                lat_raw = (row.get(lat_key) or "").strip()
                lng_raw = (row.get(lng_key) or "").strip()
                if not lat_raw or not lng_raw:
                    continue
                lat = round(float(lat_raw), 6)
                lng = round(float(lng_raw), 6)
                unique_points[(lat, lng)] = StreetPoint(lat=lat, lng=lng)

    if not unique_points:
        raise RuntimeError("No usable street points were found in ride_hailing_dataset.csv")

    return list(unique_points.values())


def build_establishment_street_selectors(
    establishments_by_section: dict[str, list[Establishment]],
) -> dict[str, dict[str, StreetPointSelector]]:
    street_points = load_street_points()
    selectors_by_section: dict[str, dict[str, StreetPointSelector]] = defaultdict(dict)
    search_radii_meters = (45, 70, 100, 140, 180, 240, 320, 450)

    for section, establishments in establishments_by_section.items():
        for establishment in establishments:
            nearby_points: list[StreetPoint] = []

            for radius_meters in search_radii_meters:
                nearby_points = [
                    point
                    for point in street_points
                    if haversine_meters(establishment.lat, establishment.lng, point.lat, point.lng) <= radius_meters
                ]
                if len(nearby_points) >= 18:
                    break

            if not nearby_points:
                ranked_points = sorted(
                    street_points,
                    key=lambda point: haversine_meters(establishment.lat, establishment.lng, point.lat, point.lng),
                )
                nearby_points = ranked_points[:24]

            selectors_by_section[section][establishment.key] = StreetPointSelector(nearby_points)

    return selectors_by_section


def build_day_assignments() -> dict[str, list[tuple[int, str, str, date]]]:
    by_section: dict[str, list[tuple[int, str, str, date]]] = defaultdict(list)
    for day_idx, (day_label, weather_condition, _) in enumerate(DAY_ROWS):
        current_date = BASE_DATE + timedelta(days=day_idx)
        for section_idx, section in enumerate(SECTIONS):
            count = DAY_ROWS[day_idx][2][section_idx]
            by_section[section].extend([(day_idx + 1, day_label, weather_condition, current_date)] * count)

    return by_section


def build_hour_assignments() -> dict[str, list[int]]:
    by_section: dict[str, list[int]] = defaultdict(list)
    for hour_idx, (_, start_hour, _) in enumerate(HOUR_ROWS):
        for section_idx, section in enumerate(SECTIONS):
            count = HOUR_ROWS[hour_idx][2][section_idx]
            by_section[section].extend([start_hour] * count)

    return by_section


def build_records() -> list[dict[str, str]]:
    random.seed(RANDOM_SEED)
    establishments = parse_establishments()
    street_selectors = build_establishment_street_selectors(establishments)
    day_assignments = build_day_assignments()
    hour_assignments = build_hour_assignments()
    records: list[dict[str, str]] = []

    for section in SECTIONS:
        section_establishments = establishments[section]
        days = day_assignments[section]
        hours = hour_assignments[section]

        if len(days) != SECTION_TOTALS[section] or len(hours) != SECTION_TOTALS[section]:
            raise RuntimeError(f"Allocation mismatch for {section}")

        random.shuffle(days)
        random.shuffle(hours)

        for record_index in range(SECTION_TOTALS[section]):
            _, day_label, weather_condition, pickup_date = days[record_index]
            pickup_hour = hours[record_index]
            minute = random.randint(0, 59)
            second = random.randint(0, 59)
            pickup_clock = time(hour=pickup_hour, minute=minute, second=second)
            establishment = random.choice(section_establishments)
            street_point = street_selectors[section][establishment.key].next_point()

            records.append(
                {
                    "record_id": str(len(records) + 1),
                    "section": section,
                    "establishment_name": establishment.name,
                    "pickup_latitude": f"{street_point.lat:.6f}",
                    "pickup_longitude": f"{street_point.lng:.6f}",
                    "pickup_day": day_label,
                    "pickup_date": pickup_date.isoformat(),
                    "pickup_time": pickup_clock.strftime("%H:%M:%S"),
                    "weather_condition": weather_condition,
                }
            )

    random.shuffle(records)
    return records


def write_csv(records: list[dict[str, str]]) -> None:
    fieldnames = [
        "record_id",
        "section",
        "establishment_name",
        "pickup_latitude",
        "pickup_longitude",
        "pickup_day",
        "pickup_date",
        "pickup_time",
        "weather_condition",
    ]
    with OUTPUT_FILE.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)


def main() -> None:
    records = build_records()
    write_csv(records)
    print(f"Wrote {len(records):,} records to {OUTPUT_FILE.name}")


if __name__ == "__main__":
    main()
