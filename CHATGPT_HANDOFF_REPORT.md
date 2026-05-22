# ChatGPT Handoff Report

Date: 2026-05-22
Project: SaktoGov3 / Olongapo Route Finder

## 1. Executive Summary

This app is currently a working ride-request and route-visualization demo focused on Olongapo City. It combines:

- a single-page frontend in [index.html](/E:/SaktoGov3/index.html:1), [app.js](/E:/SaktoGov3/app.js:1), and [styles.css](/E:/SaktoGov3/styles.css:1)
- a lightweight Python backend in [app.py](/E:/SaktoGov3/app.py:1)
- a dedicated intelligent matching module in [passenger-driver.py](/E:/SaktoGov3/passenger-driver.py:1)

The "intelligent system" is not machine learning. It is a deterministic, rule-based, multi-factor driver ranking engine that uses road-graph routing, weather impact, time-of-day traffic estimation, driver quality attributes, and movement behavior to choose the best driver for a passenger request.

The app already supports:

- map-based pickup and drop-off selection
- OSM-based road graph creation for Olongapo
- A* routing on the local graph
- simulated drivers with live movement on the map
- intelligent driver ranking through a backend endpoint
- browser-side fallback ranking if backend matching is unavailable
- user mode and admin mode UIs

## 2. Current Architecture

### Frontend

The frontend lives mostly in [app.js](/E:/SaktoGov3/app.js:1) and is responsible for:

- loading or receiving the Olongapo boundary, road graph, landmarks, and weather
- rendering the Leaflet map and UI
- simulating 100 drivers
- handling user pickup/drop-off selection
- calling the backend intelligent matcher when available
- falling back to browser-side driver ranking when needed

Important frontend entry points:

- startup and backend/browser mode selection: [app.js](/E:/SaktoGov3/app.js:840)
- backend intelligent matching request: [app.js](/E:/SaktoGov3/app.js:1793)
- browser-side ranking fallback: [app.js](/E:/SaktoGov3/app.js:1925)
- ranked offer presentation: [app.js](/E:/SaktoGov3/app.js:2177)
- driver lifecycle after acceptance: [app.js](/E:/SaktoGov3/app.js:2373) and [app.js](/E:/SaktoGov3/app.js:3235)

### Backend

The backend in [app.py](/E:/SaktoGov3/app.py:1) is a standard-library HTTP server. It:

- bootstraps the city boundary, road network, landmarks, and weather
- builds and stores the routable graph in memory
- exposes API routes for bootstrap, weather, routing, snapping, and intelligent matching
- imports the intelligent matching logic from `passenger-driver.py`

Important backend pieces:

- dynamic import of the matcher module: [app.py](/E:/SaktoGov3/app.py:44)
- route service class: [app.py](/E:/SaktoGov3/app.py:84)
- graph build: [app.py](/E:/SaktoGov3/app.py:215)
- landmark build: [app.py](/E:/SaktoGov3/app.py:270)
- A* routing: [app.py](/E:/SaktoGov3/app.py:404)
- intelligent ranking bridge: [app.py](/E:/SaktoGov3/app.py:486)
- bootstrap payload: [app.py](/E:/SaktoGov3/app.py:505)
- intelligent match endpoint handler: [app.py](/E:/SaktoGov3/app.py:801)

### Intelligent Matcher Module

The main passenger-driver intelligence is isolated in [passenger-driver.py](/E:/SaktoGov3/passenger-driver.py:1). The primary entry point is:

- driver ranking entry: [passenger-driver.py](/E:/SaktoGov3/passenger-driver.py:19)

This is the best file to inspect if the goal is to improve the decision logic.

## 3. Current Intelligent System State

### What It Actually Does

For a passenger request, the matcher:

1. Ensures the road graph and landmarks are loaded.
2. Snaps the pickup and drop-off coordinates onto the routable road network.
3. Clones the base graph and injects temporary pickup and drop-off nodes.
4. Uses A* to verify there is a connected route between pickup and drop-off.
5. Filters drivers by vehicle type, availability state, and radius.
6. Expands the search radius from 3 km to 5 km if needed.
7. Builds a baseline "nearest eligible driver" for comparison.
8. Evaluates each eligible driver using route-based and quality-based features.
9. Applies a weighted final score.
10. Sorts candidates, ranks them, and returns a human-readable selection reason.

### Eligibility Rules

Current eligibility rules in [passenger-driver.py](/E:/SaktoGov3/passenger-driver.py:224):

- driver type must match requested vehicle type
- driver must not be `lockedToUser`
- driver must not be `heldForOffer`
- driver status must be `standby_available` or `moving_available`
- straight-line distance from driver to pickup must be within the active radius

The system checks `3000 m` first, then `5000 m`.

### Candidate Evaluation Features

The candidate scoring path is implemented mainly in:

- weather context: [passenger-driver.py](/E:/SaktoGov3/passenger-driver.py:191)
- candidate evaluation: [passenger-driver.py](/E:/SaktoGov3/passenger-driver.py:254)
- route-start selection: [passenger-driver.py](/E:/SaktoGov3/passenger-driver.py:308)
- relative scoring: [passenger-driver.py](/E:/SaktoGov3/passenger-driver.py:335)
- explanation generation: [passenger-driver.py](/E:/SaktoGov3/passenger-driver.py:353)

Each candidate currently uses these signals:

- routed pickup distance
- direct distance to pickup
- estimated traffic ratio
- weather multiplier
- driver rating
- cancellation rate
- route efficiency
- movement score
- pickup ETA
- trip ETA

Important detail: ETA is calculated and shown to the user, but it is explicitly not scored directly.

### Final Weighted Score

Current final score weights in [passenger-driver.py](/E:/SaktoGov3/passenger-driver.py:335):

- distance score: `0.30`
- traffic score: `0.20`
- weather score: `0.10`
- rating score: `0.10`
- cancellation score: `0.10`
- route efficiency score: `0.15`
- movement score: `0.05`

This means the current system is most driven by pickup distance and traffic-adjusted quality, with reliability and route shape as secondary factors.

### Traffic Model

Backend traffic is currently heuristic, not live. In [passenger-driver.py](/E:/SaktoGov3/passenger-driver.py:371), the system estimates traffic ratio from:

- time of day in `Asia/Manila`
- pickup distance penalty
- weather penalty

This is a rule-based congestion estimate, not a real traffic API lookup.

By contrast, the browser fallback ranking in [app.js](/E:/SaktoGov3/app.js:2030) and [app.js](/E:/SaktoGov3/app.js:2074) can use live TomTom traffic samples if the API key is present.

### Weather Model

Weather impact is currently based on:

- precipitation
- wind speed
- weather code severity

Backend weather scoring logic: [passenger-driver.py](/E:/SaktoGov3/passenger-driver.py:191)

The weather multiplier is used to worsen effective speed and weaken the weather score under poor conditions.

### Movement Model

The system gives a better movement score when:

- the driver is on standby in a stable position
- or the driver is already moving in a direction that reduces distance to the pickup

Current movement logic: [passenger-driver.py](/E:/SaktoGov3/passenger-driver.py:394)

### Explanation Output

The matcher already returns human-readable reasoning. It explains:

- whether the driver is also the nearest baseline option
- traffic condition quality
- weather impact level
- routed pickup distance
- route efficiency
- driver rating
- cancellation risk
- movement behavior

This is useful because the intelligence is not a black box; it is explainable.

## 4. Driver Simulation State

The frontend simulation is fairly developed.

Current simulation constants in [app.js](/E:/SaktoGov3/app.js:15):

- total drivers: `100`
- cars: `60`
- motorcycles: `40`
- nominal speed: `25 kph`

Driver initialization begins at [app.js](/E:/SaktoGov3/app.js:2807).

Driver statuses currently include:

- `inactive`
- `standby_available`
- `moving_available`
- `assigned_pickup`
- `assigned_ontrip`

The simulation also includes:

- deterministic seeded mock randomness
- weighted landmark-based standby placement
- landmark-to-landmark repositioning
- time-of-day active driver target changes
- state transitions from standby to pickup to on-trip and back to standby

The arrival logic for matched rides is in [app.js](/E:/SaktoGov3/app.js:3235).

## 5. Current User Flow

The current user-facing ride flow is:

1. Choose `User` or `Admin` mode.
2. Choose ride type: car or motorcycle.
3. Tap the map to set pickup.
4. Tap the map to set drop-off.
5. The app automatically ranks nearby drivers.
6. The user can accept the suggested driver, request another ranked driver, or cancel.
7. After acceptance, the selected simulated driver moves to the pickup.
8. After pickup, the same driver moves along the trip path to the drop-off.

This flow is already integrated end-to-end across frontend, backend, and simulation.

## 6. Current Strengths

- The intelligent matching logic is separated into its own Python module, which makes it easier to iterate on.
- The system uses a real routable road graph rather than pure straight-line matching.
- Pickup and drop-off are snapped to actual road segments before routing.
- The matching result is explainable and not just a raw score.
- There is a working browser fallback if backend matching is unavailable.
- The driver simulation is rich enough to demonstrate dispatch, pickup, trip, and return-to-standby behavior.
- The app already exposes useful backend APIs for future expansion.

## 7. Current Limitations And Risks

### 7.1 Intelligence Is Heuristic, Not ML

The current "AI" is actually a hand-crafted scoring system. It does not learn from data, historical trips, acceptance behavior, or real demand patterns.

### 7.2 Frontend And Backend Ranking Logic Are Duplicated

There is now a Python ranking implementation in [passenger-driver.py](/E:/SaktoGov3/passenger-driver.py:19) and a parallel browser ranking implementation in [app.js](/E:/SaktoGov3/app.js:1925). They are conceptually aligned, but this creates drift risk.

### 7.3 Traffic Logic Differs By Execution Path

- Backend matching uses a heuristic traffic estimator.
- Browser fallback ranking can use live TomTom samples.

Because of this, the same request can rank drivers differently depending on which execution path is active.

### 7.4 No Persistence

There is no database. Everything is in memory:

- no saved drivers
- no trip history
- no request history
- no analytics
- no user accounts

Restarting the app resets the world.

### 7.5 No Test Suite

I confirmed the Python files compile, but there is no visible automated test suite for:

- route graph correctness
- matcher correctness
- scoring regressions
- frontend ranking parity

### 7.6 External Dependency Fragility

The app depends on live third-party services:

- Nominatim
- Overpass
- Open-Meteo
- TomTom traffic
- OpenStreetMap tiles

If any of these are slow, blocked, or rate-limited, startup or matching quality can degrade.

### 7.7 Exposed TomTom API Key

There is currently a hard-coded TomTom key in the frontend at [app.js](/E:/SaktoGov3/app.js:7). This is fine for demo use but not safe for public deployment.

### 7.8 Fallback Weather Scoring Gap

When the app is running in Python-backend mode, frontend weather state is reduced to a summary string plus multiplier `1` in [app.js](/E:/SaktoGov3/app.js:3569). If the backend intelligent endpoint were unavailable and the app fell back to browser-side ranking during that same session, the fallback scorer would not retain the richer backend weather multiplier logic.

This is a smaller issue than the traffic drift, but it is worth noting.

### 7.9 Repo Hygiene

Current git status shows:

- modified tracked file: `__pycache__/passenger-driver.cpython-313.pyc`
- untracked file: `.gitignore`

That suggests generated bytecode is still part of the repo history or at least not fully cleaned up yet.

## 8. Recommended Next Priorities

If the goal is to improve the intelligent system, the most useful next steps are:

1. Make the Python matcher the single source of truth and reduce frontend/backend drift.
2. Move live traffic lookup into the backend so ranking logic uses one traffic model everywhere.
3. Add a small regression test set for driver ranking scenarios.
4. Externalize secrets like the TomTom API key.
5. Add persistence if the project is moving beyond demo status.
6. Decide whether future intelligence should stay heuristic or move toward data-driven scoring.

## 9. Best Short Description For Another ChatGPT Session

You can describe the project like this:

"This is a ride-matching and route-finding demo for Olongapo City. The frontend is a Leaflet single-page app with user/admin modes and a simulated 100-driver fleet. The backend is a Python standard-library HTTP server that loads OSM roads, landmarks, and weather, builds an in-memory routable graph, and exposes intelligent driver matching APIs. The core intelligent logic is in `passenger-driver.py`, where a rule-based multi-factor scorer ranks drivers using routed pickup distance, heuristic traffic, weather impact, driver rating, cancellation risk, route efficiency, and movement behavior. ETA is displayed but not directly scored. There is also a browser fallback ranking path in `app.js`, but it duplicates the backend logic and can diverge, especially because frontend fallback may use live TomTom traffic while the backend currently uses a heuristic traffic ratio." 

## 10. Validation Status

What I validated directly:

- Python files compile successfully: `python -m py_compile app.py passenger-driver.py`
- backend/frontend structure and intelligent matching flow were inspected directly in source

What I did not fully validate in this pass:

- live API behavior against Nominatim, Overpass, Open-Meteo, and TomTom
- end-to-end browser interaction runtime
- parity between backend ranking and frontend fallback ranking in live scenarios

