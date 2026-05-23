# Fare Pricing Reviewer

## Feature Overview

The Fare Pricing feature calculates an estimated ride fare before the passenger accepts a driver. It uses route distance, vehicle fuel efficiency, current or fallback fuel price, base fare, distance rate, service fee, pickup billing rules, minimum fare, and optional night surge.

The core pricing logic is implemented in `pricing.py`. The backend exposes this logic through `/api/pricing/estimate`, and the frontend displays the result in the rider fare UI and admin pricing details panel.

## Algorithm Used

The pricing engine uses a deterministic rule-based cost-plus fare algorithm.

It is not a machine learning model. It does not predict prices from training data. Instead, it applies a fixed formula using configured business rules and live or fallback fuel price data.

At a high level:

1. Convert pickup and trip distances from meters to kilometers.
2. Compute the real physical route distance.
3. Compute the billable route distance.
4. Select vehicle-specific pricing rules.
5. Apply night surge if the ride is between 10 PM and before 5 AM.
6. Estimate fuel consumed from kilometers per liter.
7. Compute the fuel cost and fuel markup.
8. Compute distance fee and subtotal.
9. Enforce the minimum fare.
10. Return a full fare breakdown.

## Fuel Price Source

Fuel price is handled by `FuelPriceProvider`.

The provider checks the environment variable:

```text
SAKTOGO_FUEL_PRICE_API_URL
```

If this variable is set, the app requests JSON from that URL and tries to extract a fuel price per liter.

Supported JSON fields include:

```text
pricePerLiter
price_per_liter
gasoline
gasoline91
gasoline_91
ron91
RON91
unleaded
unleaded91
regular
regularGasoline
prices
fuelPrices
fuel_prices
```

If the payload is a list of station prices, the system averages the valid prices.

If the API is missing, unavailable, or returns an unsupported response, the system uses this fallback:

```text
DEFAULT_FUEL_PRICE_PER_LITER = 86.8
```

The fuel price result is cached for:

```text
FUEL_PRICE_CACHE_TTL_SECONDS = 3600
```

This means the app avoids repeatedly calling the fuel API within one hour.

## Pricing Configuration

Default values are stored in the `PricingConfig` dataclass.

```text
Motorcycle fuel efficiency: 40.0 km/L
Car fuel efficiency:        11.0 km/L

Motorcycle base fare:       PHP 40.00
Car base fare:              PHP 70.00

Motorcycle rate per km:     PHP 10.00
Car rate per km:            PHP 18.00

Service fee:                PHP 10.00
Fuel markup multiplier:     1.15x
Pickup multiplier:          0.5x
Night surge multiplier:     1.5x

Motorcycle minimum fare:    PHP 55.00
Car minimum fare:           PHP 85.00
```

## Main Formula

The main function is:

```python
calculate_fare(
    vehicle_type,
    pickup_distance_meters,
    trip_distance_meters,
    fuel_price_per_liter,
    hour_of_day=None,
    config=None,
)
```

### Step 1: Convert Distance

```text
pickup_km = pickup_distance_meters / 1000
trip_km = trip_distance_meters / 1000
route_km = pickup_km + trip_km
```

`route_km` is the real total distance traveled by the driver.

### Step 2: Compute Billable Distance

The app does not bill the full pickup distance. Pickup distance is discounted using `pickup_multiplier`.

```text
billed_route_km = (pickup_km * pickup_multiplier) + trip_km
```

With the default value:

```text
billed_route_km = (pickup_km * 0.5) + trip_km
```

This means only half of the driver's pickup-to-passenger distance is charged, while the full passenger trip distance is charged.

### Step 3: Select Vehicle Profile

If `vehicle_type` is `"car"`, the car rules are used.

Otherwise, the system defaults to motorcycle rules.

```text
Car:
km_per_liter = 11.0
base_fare = 70.0
rate_per_km = 18.0
minimum_fare = 85.0

Motorcycle:
km_per_liter = 40.0
base_fare = 40.0
rate_per_km = 10.0
minimum_fare = 55.0
```

### Step 4: Apply Night Surge

Night surge is applied if `hour_of_day` is provided and the hour is:

```text
hour_of_day >= 22
or
hour_of_day < 5
```

That means night surge applies from 10:00 PM to 4:59 AM.

When active, only the base fare and minimum fare are multiplied:

```text
base_fare = base_fare * night_surge_multiplier
minimum_fare = minimum_fare * night_surge_multiplier
```

With the default value:

```text
night_surge_multiplier = 1.5
```

Distance fee, fuel component, and service fee are not surge-multiplied in the current implementation.

### Step 5: Estimate Fuel Use

The app tracks two fuel-related values:

```text
liters_used = route_km / km_per_liter
billed_liters = billed_route_km / km_per_liter
```

`liters_used` represents the estimated physical fuel consumed for the whole route.

`billed_liters` represents the fuel amount used for fare computation, because pickup distance is only partially billed.

### Step 6: Compute Fuel Component

```text
fuel_cost = billed_liters * fuel_price_per_liter
fuel_component = fuel_cost * fuel_markup_multiplier
```

With the default markup:

```text
fuel_component = fuel_cost * 1.15
```

The markup gives the app a small buffer above raw fuel cost.

### Step 7: Compute Distance Fee

```text
distance_fee = billed_route_km * rate_per_km
```

The rate per kilometer depends on vehicle type.

### Step 8: Compute Subtotal

```text
subtotal = base_fare + distance_fee + fuel_component + service_fee
```

### Step 9: Enforce Minimum Fare

```text
total_fare = max(minimum_fare, subtotal)
```

This prevents very short trips from becoming too cheap.

## Example Calculation

Example input:

```text
Vehicle: Motorcycle
Pickup distance: 1.2 km
Trip distance: 3.5 km
Fuel price: PHP 86.80/L
Hour: daytime, no night surge
```

Distance:

```text
route_km = 1.2 + 3.5
route_km = 4.7 km

billed_route_km = (1.2 * 0.5) + 3.5
billed_route_km = 4.1 km
```

Fuel:

```text
liters_used = 4.7 / 40
liters_used = 0.1175 L

billed_liters = 4.1 / 40
billed_liters = 0.1025 L

fuel_cost = 0.1025 * 86.8
fuel_cost = PHP 8.90

fuel_component = 8.90 * 1.15
fuel_component = PHP 10.23
```

Fare:

```text
distance_fee = 4.1 * 10
distance_fee = PHP 41.00

subtotal = 40 + 41.00 + 10.23 + 10
subtotal = PHP 101.23

total_fare = max(55, 101.23)
total_fare = PHP 101.23
```

## Returned Fare Breakdown

`calculate_fare()` returns a dictionary with:

```text
isNightSurge
vehicleType
routeKm
billedRouteKm
pickupKm
tripKm
kmPerLiter
fuelPricePerLiter
litersUsed
fuelCost
fuelComponent
baseFare
distanceFee
serviceFee
minimumFare
totalFare
config
```

The backend then adds:

```text
fuelPrice
sourceNote
```

## Backend Flow

1. Frontend sends ride data to `/api/pricing/estimate`.
2. `app.py` reads:
   - vehicle type
   - pickup distance
   - trip distance
   - hour of day
3. `app.py` gets the current fuel price from `FUEL_PRICE_PROVIDER`.
4. `app.py` calls `calculate_fare()`.
5. Backend returns the fare breakdown as JSON.

## Frontend Flow

The frontend calls the backend before the user accepts the driver.

The fare estimate is shown in:

```text
Suggested Driver card
Fare tab
Admin Pricing Details panel
```

The Accept Driver button is disabled while the fare is calculating.

If the backend is unavailable, the frontend has a fallback calculation mirror in `app.js` so the mockup can still function.

## Reviewer Notes

This algorithm is suitable for a prototype because it is simple, explainable, and easy to tune.

Strengths:

- Transparent formula
- Vehicle-specific fuel efficiency
- Current or fallback fuel pricing
- Minimum fare protection
- Pickup-distance discount
- Night surge support
- Full fare breakdown for admin review

Limitations:

- Fuel efficiency values are averages, not driver-specific.
- Fuel price depends on a configured API or fallback value.
- Traffic and demand surge are not part of this pricing formula.
- Night surge only affects base fare and minimum fare.
- It estimates fuel cost, but does not account for maintenance, insurance, driver incentives, or platform commissions.

## Summary

The Fare Pricing feature uses a deterministic cost-plus algorithm:

```text
total_fare = max(
    minimum_fare,
    base_fare + distance_fee + fuel_component + service_fee
)
```

Where:

```text
distance_fee = billed_route_km * rate_per_km
fuel_component = (billed_route_km / km_per_liter) * fuel_price_per_liter * fuel_markup_multiplier
billed_route_km = (pickup_km * pickup_multiplier) + trip_km
```

Night surge can increase the base fare and minimum fare during late-night hours.
