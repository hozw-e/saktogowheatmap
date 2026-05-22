"""
Synthetic Motorcycle Ride-Hailing Dataset Generator
For calculating demand for ride hailing in Olongapo City & Subic Bay, Zambales.

- Coordinates sourced from OpenStreetMap Overpass API (same query as app.py)
- Weather categories from Open-Meteo API (same codes as describe_weather_code in app.py)
- Peak hour patterns aligned with codebase's DRIVER_ACTIVITY_SCHEDULE
"""

import csv
import random
import math
from datetime import datetime, timedelta

# --- Configuration ---
NUM_RIDES = 10000
OUTPUT_FILE = "ride_hailing_dataset.csv"
DATE_RANGE_START = datetime(2024, 1, 1)
DATE_RANGE_END = datetime(2024, 12, 31)

# Peak hours (aligned with codebase DRIVER_ACTIVITY_SCHEDULE)
MORNING_PEAK = (6, 9)    # 6:00 AM - 9:00 AM
EVENING_PEAK = (17, 20)  # 5:00 PM - 8:00 PM

# --- Weather Codes from Open-Meteo API (used in app.py describe_weather_code) ---
# Weighted by realistic Olongapo climate (tropical, rainy season Jun-Nov)
WEATHER_CONDITIONS = [
    # (code, label, probability_dry_season, probability_wet_season)
    (0, "Clear", 0.30, 0.10),
    (1, "Mostly Clear", 0.25, 0.10),
    (2, "Partly Cloudy", 0.20, 0.15),
    (3, "Cloudy", 0.10, 0.15),
    (45, "Fog", 0.02, 0.03),
    (48, "Rime Fog", 0.01, 0.01),
    (51, "Light Drizzle", 0.04, 0.08),
    (53, "Drizzle", 0.02, 0.06),
    (55, "Dense Drizzle", 0.01, 0.04),
    (61, "Light Rain", 0.03, 0.10),
    (63, "Rain", 0.01, 0.08),
    (65, "Heavy Rain", 0.005, 0.04),
    (80, "Rain Showers", 0.01, 0.03),
    (81, "Heavy Rain Showers", 0.003, 0.02),
    (82, "Violent Rain Showers", 0.001, 0.005),
    (95, "Thunderstorm", 0.001, 0.02),
    (96, "Thunderstorm with Hail", 0.0005, 0.005),
    (99, "Severe Thunderstorm with Hail", 0.0001, 0.001),
]

# --- Establishments from OpenStreetMap Overpass API ---
# Queried using the SAME Overpass query as app.py (landmark categories)
# Coordinates are exact OSM node/way center positions (the blue dots on the map)
# Format: (name, category, latitude, longitude, weight)

ESTABLISHMENTS = [
    # === SUPERMALLS (weight 5.5) — highest demand generators ===
    ("SM City Olongapo Central", "supermall", 14.836288, 120.283262, 5.5),
    ("SM City Olongapo Downtown", "supermall", 14.826419, 120.283144, 5.5),
    ("Harbor Point Mall", "supermall", 14.824903, 120.280203, 5.5),
    ("Robinsons Supermarket", "supermall", 14.839097, 120.284294, 5.5),
    ("Puregold Barretto", "supermall", 14.851642, 120.256323, 5.5),
    ("Puregold Duty Free", "supermall", 14.822008, 120.298431, 5.5),
    ("Royal Duty Free Subic", "supermall", 14.822716, 120.301585, 5.5),
    ("Duty Free Superstore", "supermall", 14.817737, 120.2841, 5.5),
    ("167 Hypermart", "supermall", 14.839732, 120.285059, 5.5),
    ("Park N Shop", "supermall", 14.824752, 120.283038, 5.5),
    ("Freeport Exchange", "supermall", 14.819093, 120.28398, 5.5),
    ("Happy Valley Supermarket", "supermall", 14.841365, 120.286453, 5.5),

    # === PUBLIC MARKETS (weight 5.1) ===
    ("Olongapo Public Market", "market", 14.840478, 120.286718, 5.1),
    ("Magsaysay Public Market Brgy. Asinan", "market", 14.829195, 120.287204, 5.1),
    ("Pagasa Public Market", "market", 14.829166, 120.287156, 5.1),
    ("West Bajac-Bajac Public Market", "market", 14.843461, 120.286105, 5.1),
    ("Public Market Subic", "market", 14.877094, 120.232961, 5.1),

    # === EDUCATION (weight 4.9) — commuter demand ===
    ("Gordon College", "education", 14.832944, 120.28215, 4.9),
    ("Columban College - Basic Ed Campus", "education", 14.827689, 120.281861, 4.9),
    ("St. Joseph's College", "education", 14.838131, 120.285717, 4.9),
    ("City of Olongapo National High School", "education", 14.835312, 120.282066, 4.9),
    ("Lyceum of Subic Bay", "education", 14.823848, 120.279109, 4.9),
    ("Ateneo", "education", 14.824968, 120.277301, 4.9),
    ("Celtech College", "education", 14.83666, 120.277998, 4.9),
    ("Kolehiyo ng Subic", "education", 14.877061, 120.231908, 4.9),
    ("Brent International School Subic", "education", 14.805891, 120.322788, 4.9),
    ("East Bajac-Bajac Elementary School", "education", 14.836462, 120.290196, 4.9),
    ("Gordon Heights National High School", "education", 14.856774, 120.28999, 4.9),
    ("Kalalake National High School", "education", 14.830542, 120.289197, 4.9),
    ("Subic National High School", "education", 14.887537, 120.237542, 4.9),

    # === CIVIC / TRANSPORT / GOVERNMENT / HOSPITALS (weight 4.6) ===
    ("Olongapo City Hall", "civic", 14.842483, 120.287602, 4.6),
    ("Olongapo Bus Terminal", "civic", 14.83758, 120.278759, 4.6),
    ("James Gordon Memorial Hospital", "civic", 14.827059, 120.279957, 4.6),
    ("Olongapo City Fire Department", "civic", 14.842793, 120.287219, 4.6),
    ("Olongapo City Police", "civic", 14.828758, 120.281764, 4.6),
    ("SBMA Main Gate (Tipo)", "civic", 14.815725, 120.283494, 4.6),
    ("SBMA Law Enforcement Department", "civic", 14.820026, 120.284228, 4.6),
    ("Victory Liner - Olongapo Terminal", "civic", 14.839638, 120.2841, 4.6),
    ("Saulog Transit - Olongapo Terminal", "civic", 14.838428, 120.283446, 4.6),
    ("Blue Jeepney Terminal", "civic", 14.839636, 120.283487, 4.6),
    ("P2P Bus", "civic", 14.824231, 120.279787, 4.6),
    ("UV Express Balanga - Harbor Point", "civic", 14.825044, 120.281867, 4.6),
    ("St. Jude's Hospital", "civic", 14.836135, 120.286578, 4.6),
    ("Subic Bay Medical Center", "civic", 14.776133, 120.307897, 4.6),
    ("Subic Municipal Hall", "civic", 14.877586, 120.235075, 4.6),
    ("Subic Bay Exhibition and Convention Center", "civic", 14.829694, 120.298674, 4.6),
    ("Philippine Economic Zone Authority", "civic", 14.817896, 120.281262, 4.6),
    ("Land Transportation Office", "civic", 14.826409, 120.27276, 4.6),

    # === BIG ESTABLISHMENTS / HOTELS / COMMERCIAL (weight 4.1) ===
    ("Subic Bay Yacht Club", "big-establishment", 14.823152, 120.287423, 4.1),
    ("Subic Grand Harbour Hotel", "big-establishment", 14.820339, 120.275804, 4.1),
    ("Subic Park Hotel", "big-establishment", 14.821487, 120.273839, 4.1),
    ("The Lighthouse Marina Resort", "big-establishment", 14.821441, 120.271743, 4.1),
    ("Wild Orchid", "big-establishment", 14.848904, 120.254635, 4.1),
    ("Subic Bay Peninsular Hotel", "big-establishment", 14.821023, 120.283551, 4.1),
    ("Court Meridian Hotels and Suites", "big-establishment", 14.819072, 120.278621, 4.1),
    ("Ocean Adventure", "big-establishment", 14.764473, 120.253032, 4.1),
    ("Inflatable Island", "big-establishment", 14.8374, 120.267846, 4.1),
    ("JEST Camp", "big-establishment", 14.792078, 120.294393, 4.1),
    ("Kamana Sanctuary", "big-establishment", 14.772238, 120.258218, 4.1),
    ("Moonbay Marina The Villas", "big-establishment", 14.822299, 120.272442, 4.1),

    # === CAFES & RESTAURANTS inside Subic Bay Freeport (weight 4.0) ===
    ("Starbucks Subic", "cafe", 14.824231, 120.279787, 4.0),
    ("Xtremely Xpresso Cafe", "cafe", 14.823649, 120.30058, 4.0),
    ("Meat Plus Cafe Subic", "cafe", 14.823978, 120.289402, 4.0),
    ("El Paso Cafe Subic", "cafe", 14.820474, 120.276563, 4.0),
    ("Vasco's Resort & Restaurant", "cafe", 14.821207, 120.278648, 4.0),
    ("Sit-N-Bull Steakhouse", "cafe", 14.828315, 120.285437, 4.0),
    ("Arizona Diner Subic", "cafe", 14.849236, 120.264856, 4.0),
    ("Bodega Wine Bar", "cafe", 14.823978, 120.289402, 4.0),
    ("Rali's Grill & Steakhouse", "cafe", 14.821091, 120.275431, 4.0),
    ("Bo's Coffee Subic", "cafe", 14.824903, 120.280203, 4.0),
    ("Trader Vic's", "cafe", 14.84807, 120.254589, 4.0),
    ("Jem's Island Grill", "cafe", 14.820597, 120.27536, 4.0),

    # === OFFICES / BPO inside Subic Bay Freeport (weight 4.3) ===
    ("SourceHOV", "office", 14.828189, 120.294847, 4.3),
    ("Subic Technopark", "office", 14.817896, 120.281262, 4.3),
    ("Subic Bay Gateway Park", "office", 14.819093, 120.28398, 4.3),
    ("Toshiba Information Equipment", "office", 14.820689, 120.284004, 4.3),
    ("Ceragon Networks Subic", "office", 14.828973, 120.28042, 4.3),
    ("SBMA Revenue Building", "office", 14.820075, 120.284087, 4.3),
    ("Bureau of Internal Revenue", "office", 14.820689, 120.284004, 4.3),
    ("SBMA Building 657", "office", 14.820075, 120.284087, 4.3),
    ("Port of Subic Administration", "office", 14.815725, 120.283494, 4.3),
    ("Subic Drydock Corporation", "office", 14.764762, 120.293171, 4.3),
    ("SBMA Ecology Center", "office", 14.789777, 120.282036, 4.3),
    ("Wistron InfoComm Subic", "office", 14.805891, 120.322788, 4.3),

    # === PARKS & LEISURE (weight 3.7) ===
    ("Rizal Triangle", "park", 14.841523, 120.286881, 3.7),
    ("Tappan Park", "park", 14.819672, 120.278749, 3.7),
    ("SBFZ Sports Complex", "park", 14.822817, 120.282973, 3.7),
    ("Subic Bay Yacht Club Marina", "park", 14.823152, 120.287423, 3.7),
    ("Subic International Raceway", "park", 14.797807, 120.271916, 3.7),
    ("Subic Golf Club", "park", 14.815509, 120.316673, 3.7),
    ("Marikit Park", "park", 14.837346, 120.283272, 3.7),

    # === RESIDENTIAL AREAS (weight 2.5) — origin/destination for commuters ===
    ("Gordon Heights", "residential", 14.868039, 120.292318, 2.5),
    ("Kalaklan", "residential", 14.830412, 120.273882, 2.5),
    ("East Bajac-Bajac", "residential", 14.835218, 120.287839, 2.5),
    ("West Bajac-Bajac", "residential", 14.841685, 120.282805, 2.5),
    ("Barretto", "residential", 14.851427, 120.263075, 2.5),
    ("New Kalalake", "residential", 14.830891, 120.289016, 2.5),
    ("Old Cabalan", "residential", 14.84878, 120.315093, 2.5),
    ("East Tapinac", "residential", 14.83289, 120.285533, 2.5),
    ("Pag-asa", "residential", 14.826994, 120.287391, 2.5),
    ("Asinan", "residential", 14.828152, 120.286339, 2.5),
    ("Santa Rita", "residential", 14.848917, 120.290934, 2.5),
    ("Mabayuan", "residential", 14.842978, 120.281866, 2.5),
    ("Calapandayan (Subic)", "residential", 14.873549, 120.235327, 2.5),
    ("Ilwas (Subic)", "residential", 14.882036, 120.236399, 2.5),
    ("Magsaysay Drive", "residential", 14.829195, 120.287204, 2.8),
]


def get_weighted_location():
    """Select a random location weighted by popularity/traffic generation."""
    weights = [loc[4] for loc in ESTABLISHMENTS]
    return random.choices(ESTABLISHMENTS, weights=weights, k=1)[0]


def add_noise(lat, lon, radius_km=0.08):
    """Add random noise to coordinates within a radius (simulates nearby streets)."""
    angle = random.uniform(0, 2 * math.pi)
    distance = random.uniform(0, radius_km)
    lat_offset = distance * math.cos(angle) * 0.009
    lon_offset = distance * math.sin(angle) * 0.011
    return round(lat + lat_offset, 6), round(lon + lon_offset, 6)


def haversine_km(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in km."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def is_peak_hour(hour):
    """Check if a given hour falls within peak hours."""
    return (MORNING_PEAK[0] <= hour < MORNING_PEAK[1] or
            EVENING_PEAK[0] <= hour < EVENING_PEAK[1])


def is_wet_season(month):
    """June-November is wet season in Zambales."""
    return 6 <= month <= 11


def get_weather_condition(month):
    """
    Generate a weather condition based on season.
    Uses the same weather codes as Open-Meteo API / describe_weather_code in app.py.
    """
    wet = is_wet_season(month)
    if wet:
        codes = [(wc[0], wc[1], wc[3]) for wc in WEATHER_CONDITIONS]
    else:
        codes = [(wc[0], wc[1], wc[2]) for wc in WEATHER_CONDITIONS]

    labels = [c[1] for c in codes]
    weights = [c[2] for c in codes]
    return random.choices(labels, weights=weights, k=1)[0]


def generate_pickup_time(ride_date):
    """
    Generate a pickup time with peak hour bias.
    ~60% of rides happen during peak hours.
    """
    is_peak = random.random() < 0.60

    if is_peak:
        if random.random() < 0.45:
            hour = random.randint(MORNING_PEAK[0], MORNING_PEAK[1] - 1)
        else:
            hour = random.randint(EVENING_PEAK[0], EVENING_PEAK[1] - 1)
    else:
        off_peak_hours = [h for h in range(5, 23)
                         if not (MORNING_PEAK[0] <= h < MORNING_PEAK[1])
                         and not (EVENING_PEAK[0] <= h < EVENING_PEAK[1])]
        hour = random.choice(off_peak_hours)

    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    return ride_date.replace(hour=hour, minute=minute, second=second)


def get_peak_biased_locations(hour):
    """
    During morning peak: residential → office/education
    During evening peak: office/education → residential/mall/cafe
    """
    if MORNING_PEAK[0] <= hour < MORNING_PEAK[1]:
        pickup_categories = ["residential", "market", "cafe"]
        dropoff_categories = ["office", "education", "civic", "supermall"]
    elif EVENING_PEAK[0] <= hour < EVENING_PEAK[1]:
        pickup_categories = ["office", "education", "civic"]
        dropoff_categories = ["residential", "supermall", "cafe", "big-establishment"]
    else:
        return None, None
    return pickup_categories, dropoff_categories


def get_location_by_categories(preferred_categories):
    """Select a location biased toward certain categories (70% chance)."""
    if preferred_categories and random.random() < 0.70:
        filtered = [loc for loc in ESTABLISHMENTS if loc[1] in preferred_categories]
        if filtered:
            weights = [loc[4] for loc in filtered]
            return random.choices(filtered, weights=weights, k=1)[0]
    return get_weighted_location()


def generate_dataset():
    """Generate the full synthetic dataset."""
    rides = []

    for ride_id in range(1, NUM_RIDES + 1):
        # Random date within range
        days_range = (DATE_RANGE_END - DATE_RANGE_START).days
        ride_date = DATE_RANGE_START + timedelta(days=random.randint(0, days_range))

        # Generate pickup time (peak-biased)
        pickup_datetime = generate_pickup_time(ride_date)
        hour = pickup_datetime.hour

        # Get directional bias based on time of day
        pickup_cats, dropoff_cats = get_peak_biased_locations(hour)

        # Select pickup and dropoff locations
        pickup_loc = get_location_by_categories(pickup_cats)
        dropoff_loc = get_location_by_categories(dropoff_cats)

        # Ensure pickup and dropoff are different
        attempts = 0
        while dropoff_loc[0] == pickup_loc[0] and attempts < 10:
            dropoff_loc = get_location_by_categories(dropoff_cats)
            attempts += 1

        # Add realistic noise to coordinates
        pickup_lat, pickup_lon = add_noise(pickup_loc[2], pickup_loc[3])
        dropoff_lat, dropoff_lon = add_noise(dropoff_loc[2], dropoff_loc[3])

        # Calculate dropoff time (based on distance and traffic)
        straight_distance = haversine_km(pickup_lat, pickup_lon, dropoff_lat, dropoff_lon)
        road_factor = random.uniform(1.3, 1.6)
        ride_distance = max(straight_distance * road_factor, 0.5)

        speed = 25.0 + random.uniform(-8, 8)
        speed = max(speed, 10.0)
        if is_peak_hour(hour):
            speed *= random.uniform(0.6, 0.85)

        duration_minutes = (ride_distance / speed) * 60 + random.uniform(1, 3)
        dropoff_datetime = pickup_datetime + timedelta(minutes=duration_minutes)

        # Weather condition for this ride
        weather = get_weather_condition(ride_date.month)

        rides.append({
            "ride_id": ride_id,
            "ride_date": ride_date.strftime("%Y-%m-%d"),
            "pickup_latitude": pickup_lat,
            "pickup_longitude": pickup_lon,
            "dropoff_latitude": dropoff_lat,
            "dropoff_longitude": dropoff_lon,
            "pickup_time": pickup_datetime.strftime("%H:%M:%S"),
            "dropoff_time": dropoff_datetime.strftime("%H:%M:%S"),
            "weather_condition": weather,
        })

    return rides


def write_csv(rides):
    """Write rides to CSV file."""
    fieldnames = [
        "ride_id", "ride_date", "pickup_latitude", "pickup_longitude",
        "dropoff_latitude", "dropoff_longitude", "pickup_time", "dropoff_time",
        "weather_condition"
    ]

    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rides)

    print(f"Generated {len(rides)} rides -> {OUTPUT_FILE}")


if __name__ == "__main__":
    random.seed(42)  # Reproducible results
    rides = generate_dataset()
    write_csv(rides)

    # Print summary stats
    peak_rides = sum(1 for r in rides if is_peak_hour(int(r["pickup_time"].split(":")[0])))

    print(f"\n--- Dataset Summary ---")
    print(f"Total rides: {len(rides)}")
    print(f"Peak hour rides: {peak_rides} ({peak_rides/len(rides)*100:.1f}%)")
    print(f"Date range: {rides[0]['ride_date']} to {rides[-1]['ride_date']}")

    # Weather breakdown
    from collections import Counter
    weather_counts = Counter(r["weather_condition"] for r in rides)
    print(f"\n--- Weather Condition Distribution ---")
    for condition, count in weather_counts.most_common():
        print(f"  {condition}: {count} ({count/len(rides)*100:.1f}%)")

    # Category breakdown
    print(f"\n--- Establishment Categories ---")
    categories = set(loc[1] for loc in ESTABLISHMENTS)
    for cat in sorted(categories):
        count = sum(1 for loc in ESTABLISHMENTS if loc[1] == cat)
        print(f"  {cat}: {count} locations")
