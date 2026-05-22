# Implementation Plan: Booking Heatmap

## Overview

This plan implements a 24-hour geographic heatmap visualization for the SaktoGo admin dashboard. The backend (Python) loads and aggregates the ride-hailing CSV dataset into grid cells per hour, exposing an API endpoint. The frontend (vanilla JS) renders the heatmap on the existing Leaflet map with a time slider, intensity legend, and peak-hour indicators. The feature integrates as a view toggle in admin mode.

## Tasks

- [x] 1. Implement backend HeatmapDataLoader and API endpoint
  - [x] 1.1 Create HeatmapDataLoader class in app.py
    - Add `HeatmapDataLoader` class with `GRID_SIZE_DEGREES = 0.002` and `REQUIRED_COLUMNS = {"pickup_latitude", "pickup_longitude", "pickup_time"}`
    - Implement `_load_and_aggregate()` to parse CSV, validate required columns, skip malformed rows, extract hour from `pickup_time` (HH:MM:SS), and aggregate pickup coordinates into grid cells per hour (0–23)
    - Implement `_snap_to_grid(lat, lng)` to snap coordinates to grid cell centers
    - Implement `get_heatmap_data(hour)` to return `{"hour": N, "points": [{lat, lng, count}], "totalBookings": M}` for a valid hour
    - Instantiate `HeatmapDataLoader` at module level with path to `ride_hailing_dataset.csv`
    - _Requirements: 1.1, 1.2, 1.4, 7.1, 7.2, 7.3, 7.4_

  - [x] 1.2 Add GET `/api/heatmap-data` endpoint to the HTTP handler
    - Parse `hour` query parameter, validate it is an integer in [0, 23]
    - Return 400 with error message for invalid hour values
    - Return 404 with error message if CSV file was not found during loading
    - Return 400 with error message if required columns are missing
    - Return 200 with JSON heatmap data for valid requests
    - _Requirements: 1.5, 1.6, 1.7, 7.5_

  - [ ]* 1.3 Write property tests for backend heatmap logic (Python/Hypothesis)
    - **Property 1: Grid cell aggregation preserves total count**
    - **Property 2: Malformed row resilience**
    - **Property 3: Invalid hour rejection**
    - **Property 7: Hour extraction from time string**
    - **Property 8: Missing column detection**
    - **Validates: Requirements 1.2, 1.4, 1.6, 7.2, 7.4, 7.5**

- [x] 2. Checkpoint - Ensure backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement frontend heatmap renderer and view toggle
  - [x] 3.1 Add Leaflet.heat plugin and heatmap state to app.js
    - Add `<script>` tag for Leaflet.heat CDN in index.html
    - Add heatmap state properties to the global `state` object: `heatmapView`, `heatmapLayer`, `heatmapHour`, `heatmapCache`
    - Define `HEATMAP_GRADIENT` color configuration (blue → green → yellow → red, 4 stops)
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 Implement heatmap data fetching and rendering functions
    - Implement `fetchHeatmapData(hour)` to call `/api/heatmap-data?hour=N`, cache responses in `state.heatmapCache`
    - Implement `renderHeatmapLayer(points)` to create/update `L.heatLayer` with points transformed to `[lat, lng, count]` format using `HEATMAP_GRADIENT`
    - Implement `removeHeatmapLayer()` to remove the heat layer from the map
    - Handle empty data (remove layer, show "No bookings for this hour" notice)
    - Handle fetch failure (retain previous layer, show "Data update failed" notice)
    - _Requirements: 2.1, 2.3, 2.4, 2.5_

  - [x] 3.3 Implement admin navigation toggle for heatmap view
    - Add "Booking Heatmap" button to admin panel HTML in index.html
    - Implement `activateHeatmapView()` to hide ride-request controls, driver markers, and show heatmap controls (slider, legend)
    - Implement `deactivateHeatmapView()` to remove heat layer, restore ride-request controls, driver markers, and default map legend
    - Preserve map center and zoom when switching views
    - Handle data load failure on activation (show error notice, keep nav accessible)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 3.4 Write property tests for frontend heatmap logic (JavaScript/fast-check)
    - **Property 4: Heatmap data transformation preserves coordinates and intensity**
    - **Property 5: 12-hour time format correctness**
    - **Property 6: Peak hour classification correctness**
    - **Validates: Requirements 2.1, 3.3, 5.2, 5.3**

- [x] 4. Implement time slider and intensity legend controls
  - [x] 4.1 Create time slider Leaflet control
    - Implement `createHeatmapSliderControl()` as an `L.control` at `topright`
    - Add HTML range input (min=0, max=23, step=1) with time label display
    - Implement `formatHour(hour)` to display 12-hour format with AM/PM
    - Default slider to current hour in Asia/Manila timezone
    - Wire `input`/`change` events to trigger `fetchHeatmapData` and `renderHeatmapLayer`
    - Ensure keyboard arrow key operability (native range input behavior)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 4.2 Create intensity scale legend control
    - Implement `createHeatmapLegendControl()` as an `L.control` at `bottomright`
    - Render gradient bar matching `HEATMAP_GRADIENT` with min-width 200px
    - Label minimum end as "Low" and maximum end as "High"
    - Ensure legend remains visible during data updates without flickering
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 4.3 Add peak hour indicators to the time slider
    - Render orange background segment for morning peak hours (6–8, i.e., hours 6, 7, 8)
    - Render red-orange background segment for evening peak hours (17–19, i.e., hours 17, 18, 19)
    - Implement `getPeakLabel(hour)` returning "Morning Peak", "Evening Peak", or empty string
    - Display peak label alongside time display when a peak hour is selected
    - Ensure peak segments are visible regardless of slider thumb position
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 5. Add CSS styles for heatmap controls
  - [x] 5.1 Add heatmap control styles to styles.css
    - Style `.heatmap-slider-control` container (padding, border-radius, background matching existing controls)
    - Style range input with peak-hour colored track segments
    - Style `.heatmap-legend-control` with gradient bar (min-width 200px) and "Low"/"High" labels
    - Style error/notice toast overlay for the map area (auto-dismiss pattern)
    - Ensure styles work in admin mode layout
    - _Requirements: 4.4, 5.1, 5.4_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Integration wiring and final validation
  - [x] 7.1 Wire all components together and verify end-to-end flow
    - Ensure `generate_dataset.py` output is consumed without modification
    - Verify admin nav toggle activates/deactivates heatmap view correctly
    - Verify slider changes update heatmap within 500ms
    - Verify API responds within 2 seconds
    - Verify view switch preserves map center/zoom
    - _Requirements: 1.7, 2.4, 6.2, 7.1_

  - [ ]* 7.2 Write integration tests
    - Test full round-trip: dataset → server → fetch → render
    - Test API response time < 2 seconds for all hours
    - Test slider change triggers heatmap update within 500ms
    - _Requirements: 1.7, 2.4, 3.2, 7.1_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The backend uses Python (app.py) and the frontend uses vanilla JavaScript (app.js)
- Leaflet.heat plugin is added via CDN to match the existing Leaflet setup

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "3.1"] },
    { "id": 2, "tasks": ["1.3", "3.2", "3.3"] },
    { "id": 3, "tasks": ["3.4", "4.1", "4.2", "4.3"] },
    { "id": 4, "tasks": ["5.1"] },
    { "id": 5, "tasks": ["7.1"] },
    { "id": 6, "tasks": ["7.2"] }
  ]
}
```
