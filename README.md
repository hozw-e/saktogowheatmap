# Olongapo Route Finder

Interactive route-finder and driver-simulation demo for Olongapo City, Philippines.

The project has:

- a static frontend in [index.html](/E:/SaktoGov3/index.html:1), [app.js](/E:/SaktoGov3/app.js:1), and [styles.css](/E:/SaktoGov3/styles.css:1)
- a lightweight Python server in [app.py](/E:/SaktoGov3/app.py:1)
- live data pulled from OpenStreetMap, Open-Meteo, and optionally TomTom Traffic

This README is written so a teammate can copy the folder to another laptop and run it with minimal setup.

## Files

- [app.py](/E:/SaktoGov3/app.py:1): serves the frontend and exposes `/api/*` endpoints for bootstrap, weather, routing, and best-driver lookup
- [app.js](/E:/SaktoGov3/app.js:1): Leaflet map UI, driver simulation, browser-side fallback data loading, and optional TomTom traffic lookups
- [index.html](/E:/SaktoGov3/index.html:1): page structure
- [styles.css](/E:/SaktoGov3/styles.css:1): styling

## What Teammates Need

For the easiest setup on another device:

1. Install Python `3.10+`.
2. Use a modern browser such as Chrome, Edge, or Firefox.
3. Make sure the device has internet access.

No `npm install`, `pip install`, virtual environment, or database setup is required for the current version. The Python backend uses only the standard library.

## Quick Start On Another Device

1. Copy or clone this project folder to the teammate's machine.
2. Open a terminal in the project folder.
3. Run:

```powershell
python app.py --port 8000
```

4. Open `http://127.0.0.1:8000` in the browser.

That is the recommended mode because the frontend will automatically use the Python backend when running on port `8000` or `8001`.

## Share It To Other Devices On The Same Network

If one teammate wants to host it and others should open it from their own phones or laptops on the same Wi-Fi/LAN:

1. Start the server on the host machine with:

```powershell
python app.py --host 0.0.0.0 --port 8000
```

2. Find the host machine's local IP address:

```powershell
ipconfig
```

Look for the IPv4 address of the active network adapter, for example `192.168.1.25`.

3. On teammate devices connected to the same network, open:

```text
http://192.168.1.25:8000
```

Replace the sample IP with the real host IP.

If teammates cannot connect:

- allow Python through the Windows firewall on the host machine
- confirm everyone is on the same network
- keep using port `8000` unless you also update the URL teammates open

## Static-Only Mode

If someone wants to run only the frontend without `app.py`, that also works.

Example:

```powershell
python -m http.server 8080
```

Then open `http://127.0.0.1:8080`.

Important behavior in static-only mode:

- the app loads boundary, road, landmark, and weather data directly from the browser
- there is no local `/api/*` backend
- the frontend automatically stays in browser mode on ports other than `8000` and `8001`
- you can also force browser mode with `?backend=browser`

Examples:

- `http://127.0.0.1:8080/?backend=browser`
- `http://192.168.1.25:8080/?backend=browser`

## Available Backend Routes

When running `app.py`, these routes are available:

- `GET /api/health`
- `GET /api/bootstrap`
- `GET /api/weather`
- `POST /api/nearest-road-point`
- `POST /api/route`
- `POST /api/best-driver`

## External Services The App Depends On

This project is not fully offline. It depends on these live services:

- OpenStreetMap tiles for the basemap
- Nominatim for the Olongapo boundary
- Overpass API for roads and landmarks
- Open-Meteo for weather
- TomTom Traffic for optional live traffic lookups

If any of those services are slow, blocked, or rate-limited, parts of the app may load slowly or fail temporarily.

## TomTom Traffic Note

`app.js` currently contains a hard-coded `TOMTOM_API_KEY` near the top of the file. That means:

- traffic features are controlled from the frontend
- the key is exposed to anyone who can view the shipped JavaScript
- teammates can run the project as-is, but this is not safe for public deployment

If you want to disable traffic on teammate machines, set the value to an empty string in [app.js](/E:/SaktoGov3/app.js:7):

```js
const TOMTOM_API_KEY = "";
```

With no key, the rest of the app still works. Only live traffic summaries are disabled.

## How The App Works

1. It finds the Olongapo City boundary.
2. It fetches OSM roads inside that boundary.
3. It builds a routable graph with distance-based edges and one-way support where tagged.
4. It loads landmark-style hotspots and uses them as anchors for simulated drivers.
5. It lets the user choose pickup and drop-off points on the map.
6. It snaps those points to the nearest routable road segment.
7. It finds the best available driver using A* path distance.

## Troubleshooting

- If `python` is not recognized, install Python and make sure it is added to `PATH`.
- If the page opens but stays on loading, check the browser console and confirm the device has internet access.
- If another device cannot open the app over LAN, check firewall permissions and confirm the host used `--host 0.0.0.0`.
- If map tiles appear but routing data fails, an external API request may have timed out or been rate-limited.

## Current Limitations

- Driver activity is simulated, not connected to a real ride-hailing service.
- The project uses live third-party APIs, so startup time depends on network conditions.
- Traffic data is optional and currently configured in frontend code rather than a protected backend secret.
