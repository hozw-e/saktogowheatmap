const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const INITIAL_CENTER = [14.8386, 120.2842];
const INITIAL_ZOOM = 13;
const STREET_EXCLUDE_REGEX = "footway|path|steps|cycleway|bridleway|corridor|construction|proposed";
const OLONGAPO_TIMEZONE = "Asia/Manila";
const TRAFFIC_POINT_NEARBY_CANDIDATES = 4;
const TRAFFIC_ROUTE_NEARBY_CANDIDATES = 2;
const TRAFFIC_NEARBY_RADIUS_METERS = 500;
const DRIVER_TRAFFIC_REFRESH_INTERVAL_MS = 12000;
const DRIVER_TRAFFIC_REFRESH_BATCH_SIZE = 20;
const DRIVER_TRAFFIC_NEARBY_CANDIDATES = 1;
const DRIVER_SEGMENT_TRAFFIC_REFRESH_COOLDOWN_MS = 3500;
const MATCH_DEBUG_ENABLED = new URLSearchParams(window.location.search).has("debugMatch");
const DRIVER_TOTAL = 100;
const DRIVER_CAR_COUNT = 60;
const DRIVER_MOTORCYCLE_COUNT = 40;
const DRIVER_SPEED_KPH = 25;
const DRIVER_RECONCILE_INTERVAL_MS = 2500;
const MOCK_DRIVER_RANDOM_SEED = 20260522;
const MATCH_DEFAULT_RADIUS_METERS = 3000;
const MATCH_EXPANDED_RADIUS_METERS = 5000;
const MATCH_TRAFFIC_FALLBACK_RATIO = 0.72;
const DEFAULT_FUEL_PRICE_PER_LITER = 86.8;
const PRICING_FALLBACK_CONFIG = {
  motorcycleKmPerLiter: 40,
  carKmPerLiter: 11,
  motorcycleBaseFare: 40,
  carBaseFare: 70,
  motorcycleRatePerKm: 10,
  carRatePerKm: 18,
  serviceFee: 10,
  fuelMarkupMultiplier: 1.15,
  pickupMultiplier: 0.5,
  nightSurgeMultiplier: 1.5,
  minimumMotorcycleFare: 55,
  minimumCarFare: 85
};
const LOCATION_NEAR_OLONGAPO_RADIUS_METERS = 8000;
const DRIVER_ACTIVITY_SCHEDULE = [
  { hour: 0, active: 25, assignedMin: 0.10, assignedMax: 0.20 },
  { hour: 4, active: 85, assignedMin: 0.25, assignedMax: 0.35 },
  { hour: 8, active: 100, assignedMin: 0.35, assignedMax: 0.45 },
  { hour: 12, active: 70, assignedMin: 0.20, assignedMax: 0.30 },
  { hour: 16, active: 95, assignedMin: 0.30, assignedMax: 0.40 },
  { hour: 20, active: 50, assignedMin: 0.15, assignedMax: 0.25 },
  { hour: 24, active: 25, assignedMin: 0.10, assignedMax: 0.20 }
];
const DRIVER_STANDBY_RATIO_RANGE = { min: 0.50, max: 0.70 };
const LANDMARK_QUERY_REGEX = "school|college|university|kindergarten|marketplace|townhall|courthouse|community_centre|post_office|police|fire_station|bus_station|hospital";
const LANDMARK_SHOP_REGEX = "mall|department_store|supermarket";
const LANDMARK_LEISURE_REGEX = "park|garden|sports_centre|stadium";
const LANDMARK_TOURISM_REGEX = "attraction|museum|hotel";
const LANDMARK_SEARCH_RADIUS_METERS = 900;
const USER_POINT_NODE_ID = "__user_point__";
const DROPOFF_POINT_NODE_ID = "__dropoff_point__";
const HEATMAP_GRADIENT = {
  0.0: '#0000ff',   // Blue (low)
  0.33: '#00ff00',  // Green
  0.66: '#ffff00',  // Yellow
  1.0: '#ff0000'    // Red (high)
};

function getCurrentManilaHour() {
  const hourStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', hour12: false });
  return parseInt(hourStr, 10);
}

let mockDriverRandomState = MOCK_DRIVER_RANDOM_SEED;

const statusText = document.getElementById("status-text");
const timeText = document.getElementById("time-text");
const weatherText = document.getElementById("weather-text");
const userLocationText = document.getElementById("point-a-text");
const dropoffLocationText = document.getElementById("point-c-text");
const bestDriverText = document.getElementById("point-b-text");
const userTrafficText = document.getElementById("traffic-a-text");
const dropoffTrafficText = document.getElementById("traffic-c-text");
const driverTrafficText = document.getElementById("traffic-b-text");
const routeText = document.getElementById("route-text");
const routeTrafficText = document.getElementById("route-traffic-text");
const driverSummaryText = document.getElementById("driver-summary-text");
const driverBreakdownText = document.getElementById("driver-breakdown-text");
const requestModeText = document.getElementById("request-mode-text");
const requestHintText = document.getElementById("request-hint-text");
const selectionGuideText = document.getElementById("selection-guide-text");
const offerTitleText = document.getElementById("offer-title-text");
const offerDetailText = document.getElementById("offer-detail-text");
const matcherSourceRow = document.getElementById("matcher-source-row");
const offerScoreText = document.getElementById("offer-score-text");
const offerEtaText = document.getElementById("offer-eta-text");
const fareTotalText = document.getElementById("fare-total-text");
const fareVehicleText = document.getElementById("fare-vehicle-text");
const fareBreakdownText = document.getElementById("fare-breakdown-text");
const fareBreakdownDetail = document.getElementById("fare-breakdown-detail");
const fareFuelText = document.getElementById("fare-fuel-text");
const fareFuelDetail = document.getElementById("fare-fuel-detail");
const fareRouteText = document.getElementById("fare-route-text");
const fareRouteDetail = document.getElementById("fare-route-detail");
const offerBaselineText = document.getElementById("offer-baseline-text");
const offerBaselineDistanceText = document.getElementById("offer-baseline-distance-text");
const offerReasonList = document.getElementById("offer-reason-list");
const rideTypeText = document.getElementById("ride-type-text");
const pickMeBtn = document.getElementById("pick-me-btn");
const findDriverBtn = document.getElementById("find-driver-btn");
const resetBtn = document.getElementById("reset-btn");
const chooseCarBtn = document.getElementById("choose-car-btn");
const chooseMotorcycleBtn = document.getElementById("choose-motorcycle-btn");
const rideTypePicker = document.querySelector('.ride-type-picker');
const acceptDriverBtn = document.getElementById("accept-driver-btn");
const otherDriverBtn = document.getElementById("other-driver-btn");
const cancelRequestBtn = document.getElementById("cancel-request-btn");
const stepVehicle = document.getElementById("step-vehicle");
const stepPickup = document.getElementById("step-pickup");
const stepDropoff = document.getElementById("step-dropoff");
const stepReview = document.getElementById("step-review");
const tabRequestBtn = document.getElementById("tab-request-btn");
const tabDriverBtn = document.getElementById("tab-driver-btn");
const tabTripBtn = document.getElementById("tab-trip-btn");
const tabFareBtn = document.getElementById("tab-fare-btn");
const entryOverlay = document.getElementById("entry-overlay");
const enterUserBtn = document.getElementById("enter-user-btn");
const enterAdminBtn = document.getElementById("enter-admin-btn");
const loadingOverlay = document.getElementById("loading-overlay");
const loadingStatusText = document.getElementById("loading-status-text");
const desktopShellHost = document.getElementById("desktop-shell-host");
const heatmapNavBtn = document.getElementById("heatmap-nav-btn");
const adminPricingDetailsBtn = document.getElementById("admin-pricing-details-btn");
const pricingDetailsPanel = document.getElementById("pricing-details-panel");
const pricingDetailsTitle = document.getElementById("pricing-details-title");
const pricingDetailsText = document.getElementById("pricing-details-text");
const phoneFrame = document.querySelector(".phone-frame");
const phoneShell = document.querySelector(".phone-shell");
const phoneScreen = document.querySelector(".phone-screen");
const appShell = document.querySelector(".shell");

const map = L.map("map", {
  zoomControl: true,
  minZoom: 12,
  maxZoom: 18
}).setView(INITIAL_CENTER, INITIAL_ZOOM);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

const networkLayer = L.layerGroup().addTo(map);
const boundaryLayer = L.layerGroup().addTo(map);
const landmarkLayer = L.layerGroup().addTo(map);
const driverLayer = L.layerGroup().addTo(map);
const markerLayer = L.layerGroup().addTo(map);
const routeLayer = L.layerGroup().addTo(map);
const mapLegendControl = createMapLegendControl();
const locateMapControl = createLocateMapControl();

const state = {
  boundaryGeometry: null,
  boundaryRings: [],
  bounds: null,
  graph: new Map(),
  nodeIndex: new Map(),
  roadSegments: [],
  routeCache: new Map(),
  trafficCache: new Map(),
  landmarks: [],
  drivers: [],
  driverAnimationHandle: null,
  driverTrafficRefreshHandle: null,
  driverTrafficRefreshCursor: 0,
  isRefreshingDriverTraffic: false,
  lastDriverTick: null,
  usingPythonBackend: false,
  browserLocation: null,
  browserLocationCentered: false,
  browserLocationMarker: null,
  browserLocationAccuracyCircle: null,
  userPoint: null,
  userMarker: null,
  dropoffPoint: null,
  dropoffMarker: null,
  selectionMode: null,
  selectedVehicleType: null,
  pendingDriverOffer: null,
  rankedDriverSuggestions: [],
  rejectedDriverIds: new Set(),
  suggestionCursor: 0,
  suggestionSearchRadiusMeters: MATCH_DEFAULT_RADIUS_METERS,
  baselineNearestSuggestion: null,
  baselineDriverMarker: null,
  ridePhase: "idle",
  offeredDriverId: null,
  selectedDriverId: null,
  matchingRequestSerial: 0,
  isRankingDrivers: false,
  viewMode: null,
  userPanelTab: "request",
  appReady: false,
  weatherContext: {
    label: "Weather unavailable right now.",
    multiplier: 1,
    raw: null,
    source: "weather_fallback",
    notice: "Weather source: fallback because live weather was unavailable."
  },
  backendSupportsIntelligentMatch: true,
  backendSupportsTrafficProxy: false,
  centerPoint: {
    lat: INITIAL_CENTER[0],
    lng: INITIAL_CENTER[1]
  },
  heatmapView: false,
  heatmapLayer: null,
  heatmapHour: getCurrentManilaHour(),
  heatmapCache: {},
  heatmapCurrentPoints: [],
  heatmapHoverOverlay: null,
  heatmapMeta: {
    datasetName: "",
    totalBookings: 0,
    renderMode: "aggregated",
  },
  heatmapSliderControl: null,
  heatmapLegendControl: null,
  lastPricingEstimate: null
};

if (pickMeBtn) pickMeBtn.addEventListener("click", () => setSelectionMode("pickup"));
if (findDriverBtn) findDriverBtn.addEventListener("click", () => setSelectionMode("dropoff"));
resetBtn.addEventListener("click", () => resetSelections());
chooseCarBtn.addEventListener("click", () => setVehicleType("car"));
chooseMotorcycleBtn.addEventListener("click", () => setVehicleType("motorcycle"));
acceptDriverBtn.addEventListener("click", () => acceptPendingDriverOffer());
otherDriverBtn.addEventListener("click", () => suggestOtherDriver());
cancelRequestBtn.addEventListener("click", () => resetSelections());
enterUserBtn.addEventListener("click", () => setEntryMode("user"));
enterAdminBtn.addEventListener("click", () => setEntryMode("admin"));
tabRequestBtn.addEventListener("click", () => setUserPanelTab("request"));
tabDriverBtn.addEventListener("click", () => setUserPanelTab("driver"));
tabTripBtn.addEventListener("click", () => setUserPanelTab("trip"));
if (tabFareBtn) tabFareBtn.addEventListener("click", () => setUserPanelTab("fare"));
if (heatmapNavBtn) heatmapNavBtn.addEventListener("click", () => toggleHeatmapView());
if (adminPricingDetailsBtn) adminPricingDetailsBtn.addEventListener("click", () => togglePricingDetailsPanel());

map.on("click", (event) => {
  if (!state.graph.size) {
    setStatus("Street network is still loading.");
    return;
  }

  handleUserRoadSelection(event.latlng);
});
map.on("locationfound", handleManualLocationFound);
map.on("locationerror", handleManualLocationError);
map.on("zoomend", () => {
  if (state.heatmapView) {
    refreshHeatmapForCurrentView();
  }
});

initialize().catch((error) => {
  console.error(error);
  setStatus("Failed to load Olongapo data. Please try again.");
  state.appReady = false;
  hideLoadingOverlay();
});

function createMapLegendControl() {
  return L.control({
    position: "bottomright"
  });
}

function createLocateMapControl() {
  return L.control({
    position: "bottomleft"
  });
}

function applyInitialViewMode() {
  document.body.classList.add("view-mode-admin");
  syncShellPlacement("admin");
}

function syncShellPlacement(mode) {
  if (!appShell || !phoneScreen || !desktopShellHost) {
    return;
  }

  const targetParent = mode === "user" ? phoneScreen : desktopShellHost;
  if (appShell.parentElement !== targetParent) {
    targetParent.appendChild(appShell);
  }

  if (phoneFrame) {
    phoneFrame.hidden = mode !== "user";
    phoneFrame.inert = mode !== "user";
    phoneFrame.setAttribute("aria-hidden", mode === "user" ? "false" : "true");
  }

  desktopShellHost.hidden = mode === "user";
}

function setEntryMode(mode) {
  state.viewMode = mode;
  state.userPanelTab = "request";
  document.body.classList.remove("mode-selection-open", "view-mode-user", "view-mode-admin");
  document.body.classList.add(mode === "user" ? "view-mode-user" : "view-mode-admin");
  document.body.dataset.userPanel = state.userPanelTab;
  syncShellPlacement(mode);
  if (mode !== "admin" && pricingDetailsPanel) {
    pricingDetailsPanel.hidden = true;
    adminPricingDetailsBtn?.classList.remove("is-active");
  }

  if (entryOverlay) {
    if (entryOverlay.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    entryOverlay.classList.add("is-hidden");
    entryOverlay.inert = true;
    entryOverlay.hidden = true;
    entryOverlay.style.display = "none";
  }

  if (!state.appReady) {
    showLoadingOverlay();
  } else {
    hideLoadingOverlay();
  }

  syncLocateControlVisibility();
  updateMapPrivacyLayers();
  syncSharedDriverStateAcrossViews();

  window.setTimeout(() => {
    map.invalidateSize();
    if (mode === "user" && centerUserModeOnBrowserLocation()) {
      return;
    }

    if (state.userPoint) {
      map.panTo([state.userPoint.lat, state.userPoint.lng], { animate: false });
      return;
    }

    if (state.bounds) {
      map.fitBounds(state.bounds, {
        padding: [24, 24]
      });
      return;
    }

    map.setView(INITIAL_CENTER, INITIAL_ZOOM);
  }, 60);

  setStatus(mode === "user"
    ? "User mode selected. Phone-style layout is now active."
    : "Admin mode selected. Full web layout is now active.");
  updateRequestUI();
}

function syncSharedDriverStateAcrossViews() {
  if (state.pendingDriverOffer?.driver) {
    const liveDriver = state.drivers.find((driver) => driver.id === state.pendingDriverOffer.driver.id);
    if (liveDriver) {
      state.pendingDriverOffer.driver = liveDriver;
      syncPendingDriverOfferToHeldDriver(state.pendingDriverOffer);

      if (state.pendingDriverOffer.startNode && state.pendingDriverOffer.pickupPath && state.pendingDriverOffer.tripPath) {
        drawSuggestedDriverPreview(
          liveDriver,
          state.pendingDriverOffer.startNode,
          state.pendingDriverOffer.pickupPath,
          state.pendingDriverOffer.tripPath
        );
      }
    }
  } else if (state.selectedDriverId && (state.ridePhase === "driver_to_pickup" || state.ridePhase === "on_trip")) {
    syncMatchedDriverRoute();
  }

  for (const driver of state.drivers) {
    updateDriverMarker(driver);
  }

  updateMapLegend();
}

function setUserPanelTab(tab) {
  state.userPanelTab = tab;
  if (state.viewMode === "user") {
    document.body.dataset.userPanel = tab;
  }

  updateUserPanelTabs();
}

function showLoadingOverlay(message = null) {
  if (!loadingOverlay) {
    return;
  }

  if (message) {
    loadingStatusText.textContent = message;
  }

  loadingOverlay.hidden = false;
  loadingOverlay.classList.remove("is-hidden");
  loadingOverlay.style.display = "flex";
}

function hideLoadingOverlay() {
  if (!loadingOverlay) {
    return;
  }

  loadingOverlay.hidden = true;
  loadingOverlay.classList.add("is-hidden");
  loadingOverlay.style.display = "none";
}

mapLegendControl.onAdd = () => {
  const container = L.DomUtil.create("div", "map-legend");
  L.DomEvent.disableClickPropagation(container);
  renderMapLegend(container);
  return container;
};

locateMapControl.onAdd = () => {
  const container = L.DomUtil.create("div", "leaflet-bar locate-control");
  const button = L.DomUtil.create("button", "locate-control__button", container);
  button.type = "button";
  button.setAttribute("aria-label", "Find my location");
  button.title = "Find my location";
  button.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2.75a.75.75 0 0 1 .75.75v1.6a6.9 6.9 0 0 1 6.15 6.15h1.6a.75.75 0 0 1 0 1.5h-1.6a6.9 6.9 0 0 1-6.15 6.15v1.6a.75.75 0 0 1-1.5 0v-1.6a6.9 6.9 0 0 1-6.15-6.15H3.5a.75.75 0 0 1 0-1.5h1.6a6.9 6.9 0 0 1 6.15-6.15V3.5a.75.75 0 0 1 .75-.75Zm0 3.8a5.45 5.45 0 1 0 0 10.9 5.45 5.45 0 0 0 0-10.9Zm0 3.15a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6Z"></path>
    </svg>
  `;
  L.DomEvent.disableClickPropagation(container);
  L.DomEvent.on(button, "click", (event) => {
    L.DomEvent.stop(event);
    locateCurrentUserOnMap();
  });
  return container;
};

mapLegendControl.addTo(map);
applyInitialViewMode();
syncLocateControlVisibility();
updateRequestUI();

function renderMapLegend(container) {
  if (!container) {
    return;
  }

  const counts = getMapLegendCounts();
  const matchedLabel = state.ridePhase === "driver_to_pickup" || state.ridePhase === "on_trip"
    ? "Matched to you"
    : state.pendingDriverOffer
      ? "Suggested to you"
      : "Selected driver";

  if (state.viewMode === "user") {
    container.innerHTML = `
      <div class="map-legend__item">
        <span class="map-legend__dot map-legend__dot--matched"></span>
        <span>${matchedLabel}</span>
      </div>
      <div class="map-legend__item">
        <span class="map-legend__dot map-legend__dot--user"></span>
        <span>My location</span>
      </div>
      <div class="map-legend__item">
        <span class="map-legend__dot map-legend__dot--pickup-point"></span>
        <span>Pickup</span>
      </div>
      <div class="map-legend__item">
        <span class="map-legend__dot map-legend__dot--dropoff-point"></span>
        <span>Drop-off</span>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="map-legend__item">
      <span class="map-legend__dot map-legend__dot--hotspot"></span>
      <span>Hotspots (${counts.hotspots.toLocaleString()})</span>
    </div>
    <div class="map-legend__item">
      <span class="map-legend__dot map-legend__dot--available"></span>
      <span>Available drivers (${counts.availableDrivers.toLocaleString()})</span>
    </div>
    <div class="map-legend__item">
      <span class="map-legend__dot map-legend__dot--pickup"></span>
      <span>Going to passenger (${counts.assignedPickupDrivers.toLocaleString()})</span>
    </div>
    <div class="map-legend__item">
      <span class="map-legend__dot map-legend__dot--ontrip"></span>
      <span>On-trip drivers (${counts.assignedOnTripDrivers.toLocaleString()})</span>
    </div>
  `;
}

function updateMapPrivacyLayers() {
  if (state.viewMode === "user") {
    if (map.hasLayer(landmarkLayer)) {
      map.removeLayer(landmarkLayer);
    }
  } else if (!map.hasLayer(landmarkLayer)) {
    landmarkLayer.addTo(map);
  }

   if (state.viewMode === "user") {
    updateBrowserLocationMarker();
  } else {
    clearBrowserLocationMarker();
  }

  for (const driver of state.drivers) {
    updateDriverMarker(driver);
  }
}

function syncLocateControlVisibility() {
  if (state.viewMode === "user") {
    if (!locateMapControl._map) {
      locateMapControl.addTo(map);
    }
    return;
  }

  if (locateMapControl._map) {
    locateMapControl.remove();
  }
}

function updateMapLegend() {
  if (!mapLegendControl._container) {
    return;
  }

  renderMapLegend(mapLegendControl._container);
}

function getMapLegendCounts() {
  const counts = summarizeDrivers();
  return {
    hotspots: state.landmarks.length,
    availableDrivers: counts.availableStandby + counts.availableMoving,
    assignedPickupDrivers: counts.assignedPickup,
    assignedOnTripDrivers: counts.assignedOnTrip,
    matchedDriver: state.selectedDriverId ? 1 : 0,
    userLocation: state.userPoint ? 1 : 0
  };
}

function setSelectionMode(mode) {
  // Enforce strict order: choose ride first, then pickup, then drop-off
  if (mode === "pickup" && !state.selectedVehicleType) {
    setStatus("Please choose a ride type first.");
    updateOfferCard("", "");
    return;
  }

  if (mode === "dropoff" && !state.userPoint) {
    setStatus("Please set your pickup first.");
    return;
  }

  state.selectionMode = mode;
  updateRequestUI();

  if (mode === "pickup") {
    setStatus(state.userPoint
      ? "Tap the map to update your pickup point."
      : "Tap the map to set your pickup point.");
    return;
  }

  setStatus(state.dropoffPoint
    ? "Tap the map to update your drop-off point."
    : "Tap the map to set your drop-off point.");
}

function setVehicleType(type) {
  state.isRankingDrivers = false;
  state.selectedVehicleType = type;
  state.rejectedDriverIds.clear();
  clearDriverSuggestionRanking();
  clearPendingDriverOffer();
  // After selecting a ride type, move the flow to pickup selection
  state.selectionMode = "pickup";
  updateRequestUI();
  setStatus(`${type === "car" ? "Car" : "Motorcycle"} selected. Tap the map to set your pickup point.`);

  if (state.userPoint && state.dropoffPoint && state.ridePhase === "idle") {
    void prepareDriverSuggestion();
  }
}

function clearDriverSuggestionRanking() {
  state.rankedDriverSuggestions = [];
  state.suggestionCursor = 0;
  state.baselineNearestSuggestion = null;
  state.suggestionSearchRadiusMeters = MATCH_DEFAULT_RADIUS_METERS;
  removeBaselineDriverMarker();
  updateMapLegend();
}

function updateRequestUILegacy() {
  queueMicrotask(normalizeUiCopy);
  pickMeBtn.classList.toggle("is-active", state.selectionMode === "pickup");
  findDriverBtn.classList.toggle("is-active", state.selectionMode === "dropoff");
  chooseCarBtn.classList.toggle("is-active", state.selectedVehicleType === "car");
  chooseMotorcycleBtn.classList.toggle("is-active", state.selectedVehicleType === "motorcycle");

  const hasPickup = Boolean(state.userPoint);
  const hasDropoff = Boolean(state.dropoffPoint);
  const hasOffer = Boolean(state.pendingDriverOffer);
  const activeRide = state.ridePhase === "driver_to_pickup" || state.ridePhase === "on_trip";

  pickMeBtn.disabled = activeRide || !state.selectedVehicleType;
  findDriverBtn.disabled = activeRide || (!hasPickup && state.selectionMode !== "dropoff");
  chooseCarBtn.disabled = activeRide;
  chooseMotorcycleBtn.disabled = activeRide;
  acceptDriverBtn.disabled = !hasOffer || activeRide || Boolean(state.pendingDriverOffer?.pricingLoading);
  otherDriverBtn.disabled = !hasOffer || activeRide;
  cancelRequestBtn.disabled = !hasPickup && !hasDropoff && !hasOffer && !activeRide;
  rideTypeText.textContent = state.selectedVehicleType
    ? `Ride type selected: ${state.selectedVehicleType === "car" ? "Car" : "Motorcycle"}`
    : "";

  if (activeRide) {
    requestModeText.textContent = state.ridePhase === "driver_to_pickup"
      ? "Driver accepted. They are now heading to your pickup point."
      : "You are on-trip. The driver is now carrying you to your drop-off.";
    requestHintText.textContent = state.ridePhase === "driver_to_pickup"
      ? "You can watch the driver approach on the map."
      : "Your route is live until the driver reaches your drop-off point.";
    return;
  }

  if (hasOffer) {
    requestModeText.textContent = "Review the suggested driver before dispatch.";
    requestHintText.textContent = "Accept to send the driver to your pickup, suggest another driver, or cancel the whole request.";
    return;
  }

  if (!state.selectedVehicleType) {
    requestModeText.textContent = "";
    requestHintText.textContent = "";
    return;
  }

  if (!hasPickup) {
    requestModeText.textContent = "";
    requestHintText.textContent = "";
    return;
  }

  if (!hasDropoff) {
    requestModeText.textContent = "Pickup saved. Now choose your drop-off point.";
    requestHintText.textContent = "After both points are set, the app will rank nearby eligible drivers before suggesting one for review.";
    return;
  }

  if (!state.selectedVehicleType) {
    requestModeText.textContent = "Pickup and drop-off are ready. Choose car or motorcycle next.";
    requestHintText.textContent = "Your vehicle choice is required before the app can suggest a driver.";
    return;
  }

  requestModeText.textContent = "Pickup and drop-off are ready.";
  requestHintText.textContent = "Request a driver suggestion or change either point on the map.";
}

function updateOfferCard(title, detail) {
  offerTitleText.textContent = title;
  offerDetailText.textContent = detail;
  offerDetailText.hidden = !detail;
  clearOfferMatchSummary();
  updateRequestUI();
}

function clearOfferMatchSummary() {
  if (offerScoreText) offerScoreText.textContent = "--";
  if (offerEtaText) offerEtaText.textContent = "--";

  if (offerBaselineText) offerBaselineText.textContent = "--";
  if (offerBaselineDistanceText) offerBaselineDistanceText.textContent = "--";
  if (matcherSourceRow) {
    matcherSourceRow.hidden = true;
    matcherSourceRow.replaceChildren();
  }
  if (offerReasonList) {
    offerReasonList.replaceChildren();
  }
}

function renderOfferMatchSummary(offer) {
  if (!offer) {
    clearOfferMatchSummary();
    return;
  }

  const baseline = state.baselineNearestSuggestion;
  const scoreText = typeof offer.finalScore === "number" ? offer.finalScore.toFixed(2) : "--";
  const etaText = typeof offer.pickupEtaMinutes === "number" ? `${offer.pickupEtaMinutes} min` : "--";
  const baselineDriverText = baseline ? `Driver ${baseline.driverId}` : "No baseline";
  const baselineDistanceText = baseline
    ? `${(baseline.directDistanceMeters / 1000).toFixed(2)} km straight-line`
    : `${(state.suggestionSearchRadiusMeters / 1000).toFixed(1)} km service range`;

  if (offerScoreText) offerScoreText.textContent = scoreText;
  if (offerEtaText) offerEtaText.textContent = etaText;
  updateFareTab(offer.pricingEstimate, Boolean(offer.pricingLoading));
  if (offerBaselineText) offerBaselineText.textContent = baselineDriverText;
  if (offerBaselineDistanceText) offerBaselineDistanceText.textContent = baselineDistanceText;
  renderMatcherSourceBadges(offer);

  if (!offerReasonList) {
    return;
  }

  offerReasonList.replaceChildren(buildOfferReasonTable(offer));
}

function renderMatcherSourceBadges(offer) {
  if (!matcherSourceRow) {
    return;
  }
  matcherSourceRow.hidden = true;
  matcherSourceRow.replaceChildren();
}

function createMatcherSourceBadge(label, className) {
  const badge = document.createElement("span");
  badge.className = className;
  badge.textContent = label;
  return badge;
}

function buildOfferReasonTable(offer) {
  const table = document.createElement("table");
  table.className = "offer-score-table";

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th scope="col">Factor</th>
      <th scope="col">Score</th>
      <th scope="col">Actual Value</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const rows = [
    buildOfferMetricRow("Distance", offer.distanceScore, formatDistanceValue(offer.pickupDistanceMeters)),
    buildOfferMetricRow("Traffic", offer.trafficScore, formatTrafficValue(offer)),
    buildOfferMetricRow("Rating", offer.ratingScore, formatRatingValue(offer)),
    buildOfferMetricRow("Cancellation Risk", offer.cancellationScore, formatCancellationValue(offer)),
    buildOfferMetricRow("Route Efficiency", offer.routeEfficiencyScore, formatRouteEfficiencyValue(offer)),
    buildOfferMetricRow("Movement", offer.movementScore, formatMovementValue(offer))
  ];

  tbody.replaceChildren(...rows);
  table.appendChild(tbody);
  return table;
}

function buildOfferMetricRow(label, score, actualValue) {
  const row = document.createElement("tr");

  const factorCell = document.createElement("th");
  factorCell.scope = "row";
  factorCell.textContent = label;

  const scoreCell = document.createElement("td");
  scoreCell.textContent = formatScoreValue(score);

  const valueCell = document.createElement("td");
  if (actualValue && typeof actualValue === "object") {
    valueCell.textContent = actualValue.text || "--";
    if (actualValue.className) {
      valueCell.className = actualValue.className;
    }
  } else {
    valueCell.textContent = actualValue;
  }

  row.append(factorCell, scoreCell, valueCell);
  return row;
}

function formatScoreValue(value) {
  return typeof value === "number" ? value.toFixed(2) : "--";
}

function formatDistanceValue(distanceMeters) {
  return typeof distanceMeters === "number"
    ? `${(distanceMeters / 1000).toFixed(2)} km pickup route`
    : "--";
}

function formatTrafficValue(offer) {
  if (typeof offer?.trafficRatio !== "number") {
    return "--";
  }

  return {
    text: `${describeTrafficRatio(offer.trafficRatio)} (${offer.trafficRatio.toFixed(2)})`,
    className: offer.trafficSource === "tomtom_live"
      ? "offer-score-table__traffic offer-score-table__traffic--live"
      : "offer-score-table__traffic offer-score-table__traffic--fallback"
  };
}

function formatRatingValue(offer) {
  return offer?.driver && typeof offer.driver.rating === "number"
    ? `${offer.driver.rating.toFixed(2)} stars`
    : "--";
}

function formatCancellationValue(offer) {
  if (!offer?.driver || typeof offer.driver.cancellationRate !== "number") {
    return "--";
  }

  return `${formatCancellationRisk(offer.driver.cancellationRate)} (${Math.round(offer.driver.cancellationRate * 100)}%)`;
}

function formatRouteEfficiencyValue(offer) {
  return typeof offer?.routeEfficiencyScore === "number"
    ? `${Math.round(offer.routeEfficiencyScore * 100)}% efficient`
    : "--";
}

function formatMovementValue(offer) {
  return offer?.driver && typeof offer.movementScore === "number"
    ? describeMovementBehavior(offer.driver, offer.movementScore)
    : "--";
}

function formatPeso(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `PHP ${number.toFixed(2)}` : "--";
}

function formatDecimal(value, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "--";
}

function roundTo(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }

  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function buildPricingRequest(offer) {
  return {
    vehicleType: offer?.driver?.type || state.selectedVehicleType || "motorcycle",
    pickupDistanceMeters: Number(offer?.pickupDistanceMeters || 0),
    tripDistanceMeters: Number(offer?.tripPath?.distance || 0),
    hourOfDay: getCurrentManilaHour()
  };
}

async function fetchPricingEstimate(offer) {
  const request = buildPricingRequest(offer);

  if (state.usingPythonBackend) {
    try {
      const response = await fetch("/api/pricing/estimate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(request)
      });

      if (response.ok) {
        const estimate = await response.json();
        if (estimate && typeof estimate.totalFare === "number") {
          return { ...estimate, request };
        }
      } else {
        console.warn("Pricing API returned an error, using browser fallback.", response.status);
      }
    } catch (error) {
      console.warn("Pricing API unavailable, using browser fallback.", error);
    }
  }

  return buildFallbackPricingEstimate(offer, request);
}

function buildFallbackPricingEstimate(offer, request = buildPricingRequest(offer)) {
  const vehicleType = request.vehicleType === "car" ? "car" : "motorcycle";
  const config = PRICING_FALLBACK_CONFIG;
  const pickupKm = Math.max(0, request.pickupDistanceMeters / 1000);
  const tripKm = Math.max(0, request.tripDistanceMeters / 1000);
  const routeKm = pickupKm + tripKm;
  const billedRouteKm = (pickupKm * (config.pickupMultiplier || 0.5)) + tripKm;
  const isCar = vehicleType === "car";
  const kmPerLiter = isCar ? config.carKmPerLiter : config.motorcycleKmPerLiter;
  let baseFare = isCar ? config.carBaseFare : config.motorcycleBaseFare;
  const ratePerKm = isCar ? config.carRatePerKm : config.motorcycleRatePerKm;
  let minimumFare = isCar ? config.minimumCarFare : config.minimumMotorcycleFare;
  
  let isNightSurge = false;
  const hourOfDay = request.hourOfDay ?? getCurrentManilaHour();
  if (hourOfDay >= 22 || hourOfDay < 5) {
    isNightSurge = true;
    baseFare *= (config.nightSurgeMultiplier || 1.5);
    minimumFare *= (config.nightSurgeMultiplier || 1.5);
  }
  
  // Actual fuel consumed uses the real physical route
  const litersUsed = routeKm / Math.max(kmPerLiter, 1);
  
  // Billing uses the discounted billed route
  const billedLiters = billedRouteKm / Math.max(kmPerLiter, 1);
  const fuelCost = billedLiters * DEFAULT_FUEL_PRICE_PER_LITER;
  const fuelComponent = fuelCost * config.fuelMarkupMultiplier;
  const distanceFee = billedRouteKm * ratePerKm;
  const subtotalBeforeWeather = Math.max(minimumFare, baseFare + distanceFee + fuelComponent + config.serviceFee);
  const weatherAdjustment = buildBrowserWeatherPricingAdjustment(state.weatherContext);
  const weatherSurcharge = subtotalBeforeWeather * (weatherAdjustment.surchargeRate || 0);
  const totalFare = subtotalBeforeWeather + weatherSurcharge;

  return {
    isNightSurge,
    vehicleType,
    routeKm: roundTo(routeKm, 2),
    billedRouteKm: roundTo(billedRouteKm, 2),
    pickupKm: roundTo(pickupKm, 2),
    tripKm: roundTo(tripKm, 2),
    kmPerLiter,
    fuelPricePerLiter: roundTo(DEFAULT_FUEL_PRICE_PER_LITER, 2),
    litersUsed: roundTo(litersUsed, 3),
    fuelCost: roundTo(fuelCost, 2),
    fuelComponent: roundTo(fuelComponent, 2),
    baseFare: roundTo(baseFare, 2),
    distanceFee: roundTo(distanceFee, 2),
    serviceFee: roundTo(config.serviceFee, 2),
    minimumFare: roundTo(minimumFare, 2),
    subtotalBeforeWeather: roundTo(subtotalBeforeWeather, 2),
    weatherSurcharge: roundTo(weatherSurcharge, 2),
    weatherSurchargeRate: roundTo(weatherAdjustment.surchargeRate || 0, 4),
    weatherAdjustment,
    totalFare: roundTo(totalFare, 2),
    config,
    request,
    fuelPrice: {
      pricePerLiter: DEFAULT_FUEL_PRICE_PER_LITER,
      source: "browser_fallback",
      location: "Olongapo",
      updatedAt: null,
      note: "Python pricing API unavailable; using browser fallback fuel price."
    },
    sourceNote: "Browser fallback pricing is active because the Python pricing endpoint was unavailable. Weather surcharge still uses the current Open-Meteo weather state when available."
  };
}

function buildBrowserWeatherPricingAdjustment(weatherContext = state.weatherContext) {
  const raw = weatherContext?.raw || null;
  const source = weatherContext?.source || "weather_fallback";
  const summary = weatherContext?.label || "Weather unavailable right now.";

  if (!raw || source !== "open_meteo_live") {
    return {
      label: summary,
      summary,
      source,
      category: "unknown",
      weatherCode: null,
      precipitationMm: 0,
      windSpeedKph: 0,
      surchargeRate: 0,
      note: "Live weather was unavailable, so no weather surcharge was applied."
    };
  }

  const weatherCode = Number.isFinite(Number(raw.weather_code)) ? Number(raw.weather_code) : null;
  const precipitationMm = Number(raw.precipitation || 0);
  const windSpeedKph = Number(raw.wind_speed_10m || 0);
  const [baseRate, category, label] = classifyWeatherPricing(weatherCode);
  const surchargeRate = clampValue(
    baseRate + getPrecipitationSurchargeBump(precipitationMm) + getWindSurchargeBump(windSpeedKph),
    0,
    0.28
  );

  return {
    label,
    summary,
    source,
    category,
    weatherCode,
    precipitationMm: roundTo(precipitationMm, 2),
    windSpeedKph: roundTo(windSpeedKph, 2),
    surchargeRate: roundTo(surchargeRate, 4),
    note: surchargeRate > 0
      ? `Live Olongapo weather added a ${Math.round(surchargeRate * 100)}% surcharge.`
      : "Current Olongapo weather is fair, so no weather surcharge was applied."
  };
}

function classifyWeatherPricing(weatherCode) {
  if (weatherCode === 0 || weatherCode === 1) {
    return [0, "fair", "Sunny"];
  }
  if (weatherCode === 2) {
    return [0, "fair", "Partly cloudy"];
  }
  if (weatherCode === 3) {
    return [0.02, "cloudy", "Cloudy"];
  }
  if ([45, 48, 51, 53, 55].includes(weatherCode)) {
    return [0.05, "drizzle_or_fog", "Drizzle or fog"];
  }
  if ([61, 80].includes(weatherCode)) {
    return [0.08, "light_rain", "Light rain"];
  }
  if ([63, 81].includes(weatherCode)) {
    return [0.12, "rain", "Rain"];
  }
  if ([65, 82].includes(weatherCode)) {
    return [0.18, "heavy_rain", "Heavy rain"];
  }
  if ([95, 96, 99].includes(weatherCode)) {
    return [0.24, "thunderstorm", "Thunderstorm"];
  }
  return [0.03, "unclassified", "Unsettled weather"];
}

function getPrecipitationSurchargeBump(precipitationMm) {
  if (precipitationMm >= 10) {
    return 0.04;
  }
  if (precipitationMm >= 5) {
    return 0.03;
  }
  if (precipitationMm >= 2) {
    return 0.02;
  }
  if (precipitationMm > 0) {
    return 0.01;
  }
  return 0;
}

function getWindSurchargeBump(windSpeedKph) {
  if (windSpeedKph >= 35) {
    return 0.03;
  }
  if (windSpeedKph >= 25) {
    return 0.02;
  }
  if (windSpeedKph >= 15) {
    return 0.01;
  }
  return 0;
}

async function refreshOfferPricing(offer) {
  if (!offer) {
    return null;
  }

  offer.pricingLoading = true;
  offer.pricingError = null;
  renderOfferMatchSummary(offer);
  updateRequestUI();

  try {
    const estimate = await fetchPricingEstimate(offer);
    offer.pricingLoading = false;
    offer.pricingEstimate = estimate;

    if (state.pendingDriverOffer === offer) {
      state.lastPricingEstimate = estimate;
      renderOfferMatchSummary(offer);
      updatePricingDetailsPanel(estimate, { onlyIfOpen: true });
      updateRequestUI();
    }

    return estimate;
  } catch (error) {
    offer.pricingLoading = false;
    offer.pricingError = error;
    if (state.pendingDriverOffer === offer) {
      renderOfferMatchSummary(offer);
      updateRequestUI();
      setStatus("Fare estimate is unavailable right now. Please try another suggestion or refresh pricing.");
    }
    return null;
  }
}

async function ensureOfferPricing(offer) {
  if (offer?.pricingEstimate) {
    return offer.pricingEstimate;
  }

  const estimate = await refreshOfferPricing(offer);
  if (estimate || !offer) {
    return estimate;
  }

  const fallbackEstimate = buildFallbackPricingEstimate(offer);
  offer.pricingLoading = false;
  offer.pricingEstimate = fallbackEstimate;
  state.lastPricingEstimate = fallbackEstimate;
  renderOfferMatchSummary(offer);
  updatePricingDetailsPanel(fallbackEstimate, { onlyIfOpen: true });
  return fallbackEstimate;
}

function togglePricingDetailsPanel() {
  if (!pricingDetailsPanel || state.viewMode !== "admin") {
    return;
  }

  const shouldOpen = pricingDetailsPanel.hidden;
  pricingDetailsPanel.hidden = !shouldOpen;
  if (adminPricingDetailsBtn) {
    adminPricingDetailsBtn.classList.toggle("is-active", shouldOpen);
  }

  if (!shouldOpen) {
    return;
  }

  const activeEstimate = state.pendingDriverOffer?.pricingEstimate || state.lastPricingEstimate;
  updatePricingDetailsPanel(activeEstimate);

  if (state.pendingDriverOffer && !state.pendingDriverOffer.pricingEstimate && !state.pendingDriverOffer.pricingLoading) {
    void refreshOfferPricing(state.pendingDriverOffer);
  }
}

function updatePricingDetailsPanel(estimate, options = {}) {
  if (!pricingDetailsPanel || !pricingDetailsTitle || !pricingDetailsText) {
    return;
  }

  if (options.onlyIfOpen && pricingDetailsPanel.hidden) {
    return;
  }

  if (!estimate) {
    pricingDetailsTitle.textContent = "Fare calculation";
    pricingDetailsText.textContent = "No fare has been calculated yet. Generate a driver suggestion to see route distance, fuel use, and fare components.";
    return;
  }

  const vehicleLabel = estimate.vehicleType === "car" ? "Car" : "Motorcycle";
  const fuelSource = getPricingSourceLabel(estimate);
  const sourceNote = estimate.sourceNote || estimate.fuelPrice?.note || "";
  const nightSurgeTag = estimate.isNightSurge ? " [NIGHT SURGE APPLIED 1.5x]" : "";
  const weatherLabel = estimate.weatherAdjustment?.label || "Weather unavailable";
  const weatherRatePercent = formatDecimal((estimate.weatherSurchargeRate || 0) * 100, 1);
  pricingDetailsTitle.textContent = `${vehicleLabel} fare: ${formatPeso(estimate.totalFare)}${nightSurgeTag}`;
  pricingDetailsText.textContent = `Route ${formatDecimal(estimate.routeKm, 2)} km: pickup ${formatDecimal(estimate.pickupKm, 2)} km (billed at ${estimate.config?.pickupMultiplier || estimate.config?.pickup_multiplier || 0.5}x) plus trip ${formatDecimal(estimate.tripKm, 2)} km. Fuel ${formatDecimal(estimate.litersUsed, 3)} L at ${formatPeso(estimate.fuelPricePerLiter)}/L using ${formatDecimal(estimate.kmPerLiter, 1)} km/L. Fare parts: base ${formatPeso(estimate.baseFare)}, distance ${formatPeso(estimate.distanceFee)}, fuel ${formatPeso(estimate.fuelComponent)}, weather ${formatPeso(estimate.weatherSurcharge || 0)}, service ${formatPeso(estimate.serviceFee)}, minimum ${formatPeso(estimate.minimumFare)}. Weather: ${weatherLabel} at ${weatherRatePercent}% surcharge. ${estimate.weatherAdjustment?.note || "No weather surcharge note available."} Source: ${fuelSource}${sourceNote ? `. ${sourceNote}` : ""}`;
}

function getPricingSourceLabel(estimate) {
  const source = estimate?.fuelPrice?.source || "fallback_config";
  if (source === "configured_api") {
    return "configured Olongapo fuel API";
  }
  if (source === "browser_fallback") {
    return "browser fallback";
  }
  return "local fallback fuel price";
}

function updateRequestUI() {
  queueMicrotask(normalizeUiCopy);
  pickMeBtn.classList.toggle("is-active", state.selectionMode === "pickup");
  findDriverBtn.classList.toggle("is-active", state.selectionMode === "dropoff");
  chooseCarBtn.classList.toggle("is-active", state.selectedVehicleType === "car");
  chooseMotorcycleBtn.classList.toggle("is-active", state.selectedVehicleType === "motorcycle");

  const hasPickup = Boolean(state.userPoint);
  const hasDropoff = Boolean(state.dropoffPoint);
  const hasOffer = Boolean(state.pendingDriverOffer);
  const activeRide = state.ridePhase === "driver_to_pickup" || state.ridePhase === "on_trip";

  pickMeBtn.disabled = activeRide || !state.selectedVehicleType;
  findDriverBtn.disabled = activeRide || (!hasPickup && state.selectionMode !== "dropoff");
  chooseCarBtn.disabled = activeRide;
  chooseMotorcycleBtn.disabled = activeRide;
  acceptDriverBtn.disabled = !hasOffer || activeRide || Boolean(state.pendingDriverOffer?.pricingLoading);
  otherDriverBtn.disabled = !hasOffer || activeRide;
  cancelRequestBtn.disabled = !hasPickup && !hasDropoff && !hasOffer && !activeRide;
  pickMeBtn.textContent = hasPickup ? "Change Pickup" : "Set Pickup";
  findDriverBtn.textContent = hasDropoff ? "Change Drop-off" : "Set Drop-off";
  resetBtn.textContent = hasPickup || hasDropoff || hasOffer || activeRide ? "Clear Request" : "Reset";
  acceptDriverBtn.textContent = state.pendingDriverOffer?.pricingLoading ? "Calculating Fare" : "Accept Driver";
  otherDriverBtn.textContent = hasOffer ? "See Next Driver" : "Suggest Other Driver";
  cancelRequestBtn.textContent = activeRide ? "Ride Active" : "Cancel Request";
  if (state.viewMode === "user") {
    document.body.dataset.userPanel = state.userPanelTab;
  }
  updateUserPanelTabs();
  rideTypeText.textContent = state.selectedVehicleType
    ? `Ride type selected: ${state.selectedVehicleType === "car" ? "Car" : "Motorcycle"}`
    : "";
  updateFlowStepsUI({ hasPickup, hasDropoff, hasOffer, activeRide });
  updateSelectionGuideText({ hasPickup, hasDropoff, hasOffer, activeRide });

  // Show ride type picker only when choosing ride (no ride selected yet)
  if (rideTypePicker) {
    rideTypePicker.style.display = state.selectedVehicleType ? "none" : "grid";
  }

  if (chooseCarBtn) {
    chooseCarBtn.setAttribute('aria-pressed', state.selectedVehicleType === 'car' ? 'true' : 'false');
  }

  if (chooseMotorcycleBtn) {
    chooseMotorcycleBtn.setAttribute('aria-pressed', state.selectedVehicleType === 'motorcycle' ? 'true' : 'false');
  }

  if (activeRide) {
    requestModeText.textContent = state.ridePhase === "driver_to_pickup"
      ? "Driver accepted. They are now heading to your pickup point."
      : "You are on-trip. The driver is now carrying you to your drop-off.";
    requestHintText.textContent = state.ridePhase === "driver_to_pickup"
      ? "You can watch the driver approach on the map."
      : "Your route is live until the driver reaches your drop-off point.";
    return;
  }

  if (hasOffer) {
    requestModeText.textContent = "Review the suggested driver before dispatch.";
    requestHintText.textContent = "Accept to send the driver to your pickup, see the next ranked driver, or cancel the whole request.";
    return;
  }

  if (state.isRankingDrivers) {
    requestModeText.textContent = "Finding the best available driver for you.";
    requestHintText.textContent = "The app is ranking nearby drivers now. You can still change your pickup, drop-off, or ride type.";
    return;
  }

  if (!state.selectedVehicleType) {
    requestModeText.textContent = "";
    requestHintText.textContent = "";
    return;
  }

  if (!hasPickup) {
    requestModeText.textContent = "";
    requestHintText.textContent = "";
    return;
  }

  if (!hasDropoff) {
    requestModeText.textContent = "Pickup saved. Now choose your drop-off point.";
    requestHintText.textContent = "After both points are set, the app will rank nearby eligible drivers before suggesting one for review.";
    return;
  }

  if (!state.selectedVehicleType) {
    requestModeText.textContent = "Pickup and drop-off are ready. Choose car or motorcycle next.";
    requestHintText.textContent = "Your vehicle choice is required before the app can suggest a driver.";
    return;
  }

  requestModeText.textContent = "Pickup and drop-off are ready.";
  requestHintText.textContent = "A ranked driver suggestion will appear automatically. You can still change either point if needed.";
}

function updateUserPanelTabs() {
  const tabMap = {
    request: tabRequestBtn,
    driver: tabDriverBtn,
    fare: tabFareBtn,
    trip: tabTripBtn
  };

  for (const [tabName, button] of Object.entries(tabMap)) {
    if (!button) {
      continue;
    }

    button.classList.toggle("is-active", state.userPanelTab === tabName);
  }
}

function updateFareTab(estimate, isLoading) {
  if (isLoading) {
    if (fareTotalText) fareTotalText.textContent = "Calculating...";
    if (fareVehicleText) fareVehicleText.textContent = "Fetching fare estimate from the pricing engine.";
    if (fareBreakdownText) fareBreakdownText.textContent = "Calculating...";
    if (fareBreakdownDetail) fareBreakdownDetail.textContent = "";
    if (fareFuelText) fareFuelText.textContent = "Calculating...";
    if (fareFuelDetail) fareFuelDetail.textContent = "";
    if (fareRouteText) fareRouteText.textContent = "Calculating...";
    if (fareRouteDetail) fareRouteDetail.textContent = "";
    return;
  }

  if (!estimate) {
    if (fareTotalText) fareTotalText.textContent = "--";
    if (fareVehicleText) fareVehicleText.textContent = "Select pickup and drop-off to calculate fare.";
    if (fareBreakdownText) fareBreakdownText.textContent = "--";
    if (fareBreakdownDetail) fareBreakdownDetail.textContent = "Base fare, distance fee, fuel component, and service fee will appear here.";
    if (fareFuelText) fareFuelText.textContent = "--";
    if (fareFuelDetail) fareFuelDetail.textContent = "Fuel consumption and price per liter will appear here.";
    if (fareRouteText) fareRouteText.textContent = "--";
    if (fareRouteDetail) fareRouteDetail.textContent = "Pickup and trip distance breakdown will appear here.";
    return;
  }

  const vehicleLabel = estimate.vehicleType === "car" ? "Car" : "Motorcycle";
  const nightSurgeTag = estimate.isNightSurge ? " \u2014 Night Surge 1.5x Applied" : "";
  if (fareTotalText) fareTotalText.textContent = formatPeso(estimate.totalFare);
  if (fareVehicleText) fareVehicleText.textContent = `${vehicleLabel} ride \u2014 minimum fare ${formatPeso(estimate.minimumFare)}${nightSurgeTag}`;
  if (fareBreakdownText) fareBreakdownText.textContent = `Base ${formatPeso(estimate.baseFare)} + Distance ${formatPeso(estimate.distanceFee)} + Fuel ${formatPeso(estimate.fuelComponent)} + Weather ${formatPeso(estimate.weatherSurcharge || 0)} + Service ${formatPeso(estimate.serviceFee)}`;
  if (fareBreakdownDetail) fareBreakdownDetail.textContent = `Fuel markup multiplier: ${estimate.config?.fuelMarkupMultiplier || estimate.config?.fuel_markup_multiplier || 1.15}x \u2014 Pickup distance multiplier: ${estimate.config?.pickupMultiplier || estimate.config?.pickup_multiplier || 0.5}x \u2014 Weather: ${estimate.weatherAdjustment?.label || "Unavailable"} at ${formatDecimal((estimate.weatherSurchargeRate || 0) * 100, 1)}%`;
  if (fareFuelText) fareFuelText.textContent = `${formatDecimal(estimate.litersUsed, 3)} L at ${formatPeso(estimate.fuelPricePerLiter)}/L`;
  if (fareFuelDetail) fareFuelDetail.textContent = `${vehicleLabel} efficiency: ${formatDecimal(estimate.kmPerLiter, 1)} km/L \u2014 Source: ${getPricingSourceLabel(estimate)}`;
  if (fareRouteText) fareRouteText.textContent = `${formatDecimal(estimate.routeKm, 2)} km total`;
  if (fareRouteDetail) fareRouteDetail.textContent = `Pickup ${formatDecimal(estimate.pickupKm, 2)} km (billed at ${estimate.config?.pickupMultiplier || estimate.config?.pickup_multiplier || 0.5}x) + Trip ${formatDecimal(estimate.tripKm, 2)} km = Billed ${formatDecimal(estimate.billedRouteKm, 2)} km`;
}

function updateFlowStepsUI({ hasPickup, hasDropoff, hasOffer, activeRide }) {
  // Ensure exactly one current step is highlighted and steps are followed in order:
  // vehicle -> pickup -> dropoff -> review
  let currentStep = "vehicle";
  if (!state.selectedVehicleType) {
    currentStep = "vehicle";
  } else if (!hasPickup) {
    currentStep = "pickup";
  } else if (!hasDropoff) {
    currentStep = "dropoff";
  } else {
    currentStep = "review";
  }

  setFlowStepState(stepVehicle, Boolean(state.selectedVehicleType), currentStep === "vehicle");
  setFlowStepState(stepPickup, Boolean(hasPickup), currentStep === "pickup");
  setFlowStepState(stepDropoff, Boolean(hasDropoff), currentStep === "dropoff");
  const reviewIsCurrent = (!activeRide) && (state.isRankingDrivers || hasOffer || currentStep === "review");
  setFlowStepState(stepReview, activeRide, reviewIsCurrent);
}

function setFlowStepState(element, isComplete, isCurrent) {
  if (!element) {
    return;
  }

  element.classList.toggle("is-complete", Boolean(isComplete));
  element.classList.toggle("is-current", Boolean(isCurrent));
}

function updateSelectionGuideText({ hasPickup, hasDropoff, hasOffer, activeRide }) {
  // Clear selection guide text — helper sentences removed per user preference.
  selectionGuideText.textContent = "";
}

function normalizeUiCopy() {
  requestModeText.textContent = requestModeText.textContent
    .replaceAll("â€œ", '"')
    .replaceAll("â€", '"')
    .replaceAll("“", '"')
    .replaceAll("”", '"');
  for (const target of [offerDetailText, offerTitleText]) {
    target.textContent = target.textContent
      .replaceAll("â€¢", "|")
      .replaceAll("•", "|");
  }
}

async function initialize() {
  startClock();
  setWeatherText("Loading weather...");
  requestBrowserLocation();

  if (shouldUsePythonBackend()) {
    try {
    setStatus("Loading data from the backend...");
    const bootstrap = await fetchBootstrap();
    applyBootstrapPayload(bootstrap);
    drawRoadNetwork();
    drawLandmarks();
    initializeDrivers();
    startDriverSimulation();
    window.setInterval(() => loadWeather(), 600000);
    state.appReady = true;
    state.heatmapSliderControl = createHeatmapSliderControl();
    state.heatmapLegendControl = createHeatmapLegendControl();
    setStatus(`Ready. Loaded ${state.graph.size.toLocaleString()} routable road nodes and ${state.landmarks.length.toLocaleString()} driver hotspots.`);
    hideLoadingOverlay();
    return;
    } catch (error) {
      console.warn("Python backend bootstrap unavailable, falling back to browser-side loading.", error);
      state.usingPythonBackend = false;
    }
  }

  setStatus("Loading city boundary...");
  const boundary = await fetchBoundary();
  applyBoundary(boundary);
  await loadWeather(boundary);
  window.setInterval(() => loadWeather(), 600000);

  setStatus("Loading street network...");
  const overpassData = await fetchRoadNetwork(boundary.boundingbox);
  buildGraph(overpassData);
  drawRoadNetwork();

  setStatus("Loading landmark hotspots for the driver simulation...");
  const landmarkData = await fetchLandmarkData(boundary.boundingbox);
  buildLandmarks(landmarkData);
  drawLandmarks();
  initializeDrivers();
  startDriverSimulation();

  state.appReady = true;
  state.heatmapSliderControl = createHeatmapSliderControl();
  state.heatmapLegendControl = createHeatmapLegendControl();
  setStatus(`Ready. Loaded ${state.graph.size.toLocaleString()} routable road nodes and ${state.landmarks.length.toLocaleString()} driver hotspots.`);
  hideLoadingOverlay();
}

function shouldUsePythonBackend() {
  const params = new URLSearchParams(window.location.search);
  const backendMode = params.get("backend");

  if (backendMode === "python") {
    return true;
  }

  if (backendMode === "browser") {
    return false;
  }

  return ["8000", "8001"].includes(window.location.port);
}

async function fetchBootstrap() {
  const response = await fetch("/api/bootstrap", {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Bootstrap request failed with ${response.status}`);
  }

  state.usingPythonBackend = true;
  return response.json();
}

function applyBootstrapPayload(payload) {
  applyBoundary(payload.boundary);
  buildGraphFromPayload(payload.nodes || [], payload.graph || {}, payload.roads || []);
  loadLandmarksFromPayload(payload.landmarks || []);
  applyWeatherPayload(payload.weather || null);
  state.backendSupportsTrafficProxy = Object.prototype.hasOwnProperty.call(payload || {}, "liveTrafficEnabled");
}

async function fetchBoundary() {
  const params = new URLSearchParams({
    q: "Olongapo City, Philippines",
    format: "jsonv2",
    polygon_geojson: "1",
    limit: "1"
  });

  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Boundary request failed with ${response.status}`);
  }

  const results = await response.json();
  if (!results.length || !results[0].geojson) {
    throw new Error("No Olongapo boundary was returned.");
  }

  return results[0];
}

function applyBoundary(boundary) {
  state.boundaryGeometry = boundary.geojson;
  state.boundaryRings = extractBoundaryRings(boundary.geojson);

  const [south, north, west, east] = boundary.boundingbox.map(Number);
  const bounds = L.latLngBounds(
    [south, west],
    [north, east]
  );

  state.bounds = bounds;
  state.centerPoint = {
    lat: (south + north) / 2,
    lng: (west + east) / 2
  };

  boundaryLayer.clearLayers();
  L.geoJSON(boundary.geojson, {
    style: {
      color: "#0b6e4f",
      weight: 3,
      fillColor: "#78c7a3",
      fillOpacity: 0.08
    }
  }).addTo(boundaryLayer);

  map.fitBounds(bounds, { padding: [20, 20] });
  maybeCenterMapOnBrowserLocation();
}

function requestBrowserLocation() {
  if (!("geolocation" in navigator)) {
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      state.browserLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy ?? null
      };
      updateBrowserLocationMarker();
      maybeCenterMapOnBrowserLocation();
    },
    (error) => {
      console.warn("Browser geolocation unavailable.", error);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000
    }
  );
}

function locateCurrentUserOnMap() {
  if (!map.locate) {
    setStatus("This device does not support location access.");
    return;
  }

  setStatus("Finding your current location...");
  map.stopLocate();
  map.locate({
    setView: false,
    watch: false,
    enableHighAccuracy: true,
    maxZoom: 18,
    timeout: 10000,
    maximumAge: 0
  });
}

function maybeCenterMapOnBrowserLocation() {
  if (state.browserLocationCentered || !state.browserLocation || !state.bounds) {
    return;
  }

  if (!isLocationInsideOrNearOlongapo(state.browserLocation)) {
    return;
  }

  focusMapOnBrowserLocation({ animate: true });
}

function centerUserModeOnBrowserLocation() {
  if (state.viewMode !== "user" || !state.browserLocation || !state.bounds) {
    return false;
  }

  if (!isLocationInsideOrNearOlongapo(state.browserLocation)) {
    return false;
  }

  return focusMapOnBrowserLocation({ animate: false, zoom: 17 });
}

function zoomToBrowserLocation(animate = true, forcedZoom = null, requireBounds = false) {
  if (!state.browserLocation) {
    return false;
  }

  const browserLatLng = L.latLng(state.browserLocation.lat, state.browserLocation.lng);
  if (requireBounds && (!state.bounds || !state.bounds.contains(browserLatLng))) {
    return false;
  }

  const targetZoom = forcedZoom ?? (state.viewMode === "user" ? 17 : Math.max(map.getZoom(), 15));
  if (animate) {
    map.flyTo(browserLatLng, targetZoom, {
      animate: true,
      duration: 0.8
    });
  } else {
    map.setView(browserLatLng, targetZoom, {
      animate: false
    });
  }
  state.browserLocationCentered = true;
  return true;
}

function focusMapOnBrowserLocation({ animate = true, zoom = null, requireBounds = false } = {}) {
  if (!zoomToBrowserLocation(animate, zoom, requireBounds)) {
    return false;
  }

  if (state.browserLocationMarker) {
    state.browserLocationMarker.openPopup();
  }

  return true;
}

function updateBrowserLocationMarker() {
  if (state.viewMode !== "user") {
    clearBrowserLocationMarker();
    return;
  }

  if (!state.browserLocation) {
    clearBrowserLocationMarker();
    return;
  }

  const latLng = [state.browserLocation.lat, state.browserLocation.lng];
  if (!state.browserLocationMarker) {
    state.browserLocationMarker = L.circleMarker(latLng, {
      radius: 9,
      color: "#ffffff",
      weight: 3,
      fillColor: "#111111",
      fillOpacity: 0.95
    }).bindPopup("Current location");
    state.browserLocationMarker.addTo(markerLayer);
    state.browserLocationMarker.bringToFront();
  } else {
    state.browserLocationMarker.setLatLng(latLng);
    state.browserLocationMarker.bringToFront();
  }

  const accuracyRadiusMeters = Math.max(20, Math.min(state.browserLocation.accuracy ?? 40, 120));
  if (!state.browserLocationAccuracyCircle) {
    state.browserLocationAccuracyCircle = L.circle(latLng, {
      radius: accuracyRadiusMeters,
      color: "#111111",
      weight: 1.5,
      opacity: 0.28,
      fillColor: "#111111",
      fillOpacity: 0.08
    }).addTo(markerLayer);
  } else {
    state.browserLocationAccuracyCircle.setLatLng(latLng);
    state.browserLocationAccuracyCircle.setRadius(accuracyRadiusMeters);
  }

  state.browserLocationAccuracyCircle.bringToBack();
}

function isBrowserLocationInsideOlongapo() {
  return isLocationInsideOlongapo(state.browserLocation);
}

function handleManualLocationFound(event) {
  const detectedLocation = {
    lat: event.latlng.lat,
    lng: event.latlng.lng,
    accuracy: event.accuracy ?? null
  };
  state.browserLocation = detectedLocation;
  state.browserLocationCentered = false;

  if (!isLocationInsideOrNearOlongapo(detectedLocation)) {
    clearBrowserLocationMarker();
    showOutsideOlongapoLocationPopup();
    setStatus("Detected location is outside or too far from Olongapo City, so the map stayed in the city view.");
    return;
  }

  updateBrowserLocationMarker();

  if (!focusMapOnBrowserLocation({ animate: true, zoom: 18 })) {
    setStatus("Unable to center the map on your current location right now.");
    return;
  }

  const locationText = isBrowserLocationInsideOlongapo()
    ? "Map centered on your current Olongapo location."
    : "Map centered on your current location. Pickup and drop-off still need to stay inside Olongapo City.";
  setStatus(locationText);
}

function handleManualLocationError(error) {
  console.warn("Leaflet location lookup unavailable.", error);
  const denied = error && error.code === 1;
  setStatus(denied
    ? "Location access was denied."
    : "Unable to get your current location right now.");
}

function isLocationInsideOrNearOlongapo(location) {
  if (!location) {
    return false;
  }

  if (isLocationInsideOlongapo(location)) {
    return true;
  }

  const nearestNode = getNearestNode(location.lat, location.lng);
  if (nearestNode) {
    return haversineDistance(location, nearestNode) <= LOCATION_NEAR_OLONGAPO_RADIUS_METERS;
  }

  if (state.bounds) {
    return state.bounds.pad(0.25).contains(L.latLng(location.lat, location.lng));
  }

  return false;
}

function isLocationInsideOlongapo(location) {
  if (!location) {
    return false;
  }

  if (state.boundaryRings.length) {
    return isPointInsideBoundary(location.lat, location.lng, state.boundaryRings);
  }

  if (!state.bounds) {
    return false;
  }

  return state.bounds.contains(L.latLng(location.lat, location.lng));
}

function showOutsideOlongapoLocationPopup() {
  const popupPoint = state.centerPoint
    ? [state.centerPoint.lat, state.centerPoint.lng]
    : map.getCenter();

  L.popup({
    maxWidth: 270,
    closeButton: true,
    autoClose: true,
    className: "location-warning-popup"
  })
    .setLatLng(popupPoint)
    .setContent("Detected location is outside or too far from Olongapo City. The map stayed in Olongapo.")
    .openOn(map);
}

function clearBrowserLocationMarker() {
  if (state.browserLocationMarker) {
    markerLayer.removeLayer(state.browserLocationMarker);
    state.browserLocationMarker = null;
  }

  if (state.browserLocationAccuracyCircle) {
    markerLayer.removeLayer(state.browserLocationAccuracyCircle);
    state.browserLocationAccuracyCircle = null;
  }
}

async function fetchRoadNetwork(boundingbox) {
  const [south, north, west, east] = boundingbox.map(Number);
  const query = `
    [out:json][timeout:60];
    (
      way["highway"]["highway"!~"${STREET_EXCLUDE_REGEX}"](${south},${west},${north},${east});
    );
    (._;>;);
    out body;
  `.trim();

  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
    },
    body: `data=${encodeURIComponent(query)}`
  });

  if (!response.ok) {
    throw new Error(`Road network request failed with ${response.status}`);
  }

  return response.json();
}

async function fetchLandmarkData(boundingbox) {
  const [south, north, west, east] = boundingbox.map(Number);
  const query = `
    [out:json][timeout:60];
    (
      nwr["amenity"~"${LANDMARK_QUERY_REGEX}"](${south},${west},${north},${east});
      nwr["shop"~"${LANDMARK_SHOP_REGEX}"](${south},${west},${north},${east});
      nwr["leisure"~"${LANDMARK_LEISURE_REGEX}"](${south},${west},${north},${east});
      nwr["tourism"~"${LANDMARK_TOURISM_REGEX}"](${south},${west},${north},${east});
      nwr["office"="government"](${south},${west},${north},${east});
      nwr["building"~"transportation|civic|public|commercial"](${south},${west},${north},${east});
    );
    out center tags;
  `.trim();

  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
    },
    body: `data=${encodeURIComponent(query)}`
  });

  if (!response.ok) {
    throw new Error(`Landmark request failed with ${response.status}`);
  }

  return response.json();
}

function buildGraph(overpassData) {
  const rawNodes = new Map();
  const ways = [];

  for (const element of overpassData.elements) {
    if (element.type === "node") {
      rawNodes.set(element.id, {
        id: element.id,
        lat: element.lat,
        lng: element.lon
      });
    }

    if (element.type === "way" && Array.isArray(element.nodes)) {
      ways.push(element);
    }
  }

  state.graph.clear();
  state.nodeIndex.clear();
  state.roadSegments = [];
  state.routeCache.clear();

  for (const way of ways) {
    const tags = way.tags || {};
    const isOneWay = tags.oneway === "yes" || tags.oneway === "1" || tags.junction === "roundabout";

    for (let index = 0; index < way.nodes.length - 1; index += 1) {
      const fromNode = rawNodes.get(way.nodes[index]);
      const toNode = rawNodes.get(way.nodes[index + 1]);

      if (!fromNode || !toNode) {
        continue;
      }

      const midpointLat = (fromNode.lat + toNode.lat) / 2;
      const midpointLng = (fromNode.lng + toNode.lng) / 2;
      if (!isPointInsideBoundary(midpointLat, midpointLng, state.boundaryRings)) {
        continue;
      }

      const distance = haversineDistance(fromNode, toNode);
      state.roadSegments.push({
        fromNodeId: fromNode.id,
        toNodeId: toNode.id,
        distance
      });
      addEdge(fromNode, toNode, distance);

      if (!isOneWay) {
        addEdge(toNode, fromNode, distance);
      }
    }
  }
}

function buildGraphFromPayload(nodes, graph, roads) {
  state.graph.clear();
  state.nodeIndex.clear();
  state.roadSegments = [];
  state.routeCache.clear();

  for (const node of nodes) {
    state.nodeIndex.set(String(node.id), {
      id: String(node.id),
      lat: Number(node.lat),
      lng: Number(node.lng)
    });
  }

  for (const [nodeId, neighbors] of Object.entries(graph)) {
    state.graph.set(String(nodeId), (neighbors || []).map((neighbor) => ({
      id: String(neighbor.id),
      distance: Number(neighbor.distance)
    })));
  }

  for (const road of roads) {
    state.roadSegments.push({
      fromNodeId: String(road.fromNodeId),
      toNodeId: String(road.toNodeId),
      distance: Number(road.distance)
    });
  }
}

function buildLandmarks(overpassData) {
  const landmarks = [];
  const dedupe = new Set();

  for (const element of overpassData.elements || []) {
    const tags = element.tags || {};
    const landmark = classifyLandmark(element, tags);
    if (!landmark) {
      continue;
    }

    const nearestNode = getNearestNode(landmark.lat, landmark.lng);
    if (!nearestNode) {
      continue;
    }

    const key = `${landmark.category}:${nearestNode.id}`;
    if (dedupe.has(key)) {
      continue;
    }

    dedupe.add(key);
    landmarks.push({
      ...landmark,
      nodeId: nearestNode.id
    });
  }

  if (!landmarks.length) {
    const fallbackNode = getNearestNode(state.centerPoint.lat, state.centerPoint.lng);
    if (fallbackNode) {
      landmarks.push({
        id: "fallback-center",
        name: "Olongapo City Center",
        category: "civic",
        categoryLabel: "Transport & Civic Centers",
        weight: 4.5,
        lat: fallbackNode.lat,
        lng: fallbackNode.lng,
        nodeId: fallbackNode.id
      });
    }
  }

  state.landmarks = landmarks.sort(compareLandmarksForMockData);
}

function loadLandmarksFromPayload(landmarks) {
  state.landmarks = landmarks
    .map((landmark) => ({
      id: landmark.id,
      name: landmark.name,
      category: landmark.category,
      categoryLabel: landmark.categoryLabel || landmark.category_label,
      weight: Number(landmark.weight),
      lat: Number(landmark.lat),
      lng: Number(landmark.lng),
      nodeId: String(landmark.nodeId || landmark.node_id)
    }))
    .sort(compareLandmarksForMockData);
}

function compareLandmarksForMockData(left, right) {
  const weightDifference = right.weight - left.weight;
  if (weightDifference !== 0) {
    return weightDifference;
  }

  const leftKey = `${left.category}|${left.nodeId}|${left.id}|${left.name}`;
  const rightKey = `${right.category}|${right.nodeId}|${right.id}|${right.name}`;
  if (leftKey < rightKey) {
    return -1;
  }

  if (leftKey > rightKey) {
    return 1;
  }

  return 0;
}

function drawLandmarks() {
  landmarkLayer.clearLayers();

  for (const landmark of state.landmarks) {
    L.circleMarker([landmark.lat, landmark.lng], {
      radius: 4 + Math.round(landmark.weight),
      color: "#ffffff",
      weight: 1.5,
      fillColor: "#216869",
      fillOpacity: 0.7
    })
      .bindPopup(`<span class="landmark-popup">${landmark.name}</span><br>${landmark.categoryLabel}`)
      .addTo(landmarkLayer);
  }

  updateMapPrivacyLayers();
  updateMapLegend();
}

function addEdge(fromNode, toNode, distance) {
  if (!state.graph.has(fromNode.id)) {
    state.graph.set(fromNode.id, []);
    state.nodeIndex.set(fromNode.id, fromNode);
  }

  if (!state.graph.has(toNode.id)) {
    state.graph.set(toNode.id, []);
    state.nodeIndex.set(toNode.id, toNode);
  }

  state.graph.get(fromNode.id).push({
    id: toNode.id,
    distance
  });
}

function drawRoadNetwork() {
  networkLayer.clearLayers();

  const drawnPairs = new Set();
  for (const [nodeId, neighbors] of state.graph.entries()) {
    const fromNode = state.nodeIndex.get(nodeId);
    for (const neighbor of neighbors) {
      const pairKey = [nodeId, neighbor.id].sort((a, b) => a - b).join(":");
      if (drawnPairs.has(pairKey)) {
        continue;
      }

      drawnPairs.add(pairKey);
      const toNode = state.nodeIndex.get(neighbor.id);
      const latLngs = [
        [fromNode.lat, fromNode.lng],
        [toNode.lat, toNode.lng]
      ];
      const segmentMeta = {
        fromNodeId: fromNode.id,
        toNodeId: toNode.id,
        distance: haversineDistance(fromNode, toNode)
      };
      const handleSegmentClick = (event) => handleUserRoadSelection(event.latlng, segmentMeta);

      L.polyline(latLngs, {
        color: "#267a5c",
        weight: 2,
        opacity: 0.28,
        interactive: false
      }).addTo(networkLayer);

      L.polyline(latLngs, {
        color: "#267a5c",
        weight: 14,
        opacity: 0.01,
        interactive: true,
        bubblingMouseEvents: false
      })
        .on("click", handleSegmentClick)
        .addTo(networkLayer);
    }
  }
}

function handleUserRoadSelection(latlng, preferredSegment = null) {
  if (!state.selectionMode) {
    setStatus("Please choose a ride type first.");
    return;
  }

  if (state.selectionMode === "pickup" && !state.selectedVehicleType) {
    setStatus("Please choose a ride type first.");
    return;
  }

  if (!isPointInsideBoundary(latlng.lat, latlng.lng)) {
    setStatus("Please choose a point inside the Olongapo City boundary.");
    return;
  }

  let snappedRoadPoint = null;

  if (preferredSegment) {
    const fromNode = state.nodeIndex.get(preferredSegment.fromNodeId);
    const toNode = state.nodeIndex.get(preferredSegment.toNodeId);
    if (fromNode && toNode) {
      const projectedPoint = projectPointOntoSegment(latlng, fromNode, toNode, preferredSegment.distance);
      if (projectedPoint) {
        snappedRoadPoint = {
          ...projectedPoint,
          fromNodeId: fromNode.id,
          toNodeId: toNode.id
        };
      }
    }
  }

  if (!snappedRoadPoint) {
    snappedRoadPoint = getNearestRoadPoint(latlng.lat, latlng.lng);
  }

  if (!snappedRoadPoint) {
    setStatus("No nearby routable street segment was found.");
    return;
  }

  if (state.selectionMode === "pickup") {
    setPickupLocation(snappedRoadPoint);
    state.selectionMode = "dropoff";
    setStatus(preferredSegment
      ? "Pickup snapped to the selected road segment. Now choose your drop-off."
      : "Pickup snapped to the nearest road segment. Now choose your drop-off.");
    updateOfferCard("Choose your drop-off next", "Your pickup point is saved. Set the destination to review a driver suggestion.");
    updateRequestUI();
    return;
  }

  setDropoffLocation(snappedRoadPoint);
  state.selectionMode = null;
  setStatus(preferredSegment
    ? "Drop-off snapped to the selected road segment. Reviewing a suggested driver..."
    : "Drop-off snapped to the nearest road segment. Reviewing a suggested driver...");
  state.rejectedDriverIds.clear();
  clearDriverSuggestionRanking();
  void prepareDriverSuggestion();
}

function setPickupLocation(point) {
  state.matchingRequestSerial += 1;
  state.isRankingDrivers = false;
  state.userPanelTab = "request";
  clearDriverSuggestionRanking();
  const pickupNode = addTemporaryPointToGraph(point, USER_POINT_NODE_ID);
  const marker = L.circleMarker([pickupNode.lat, pickupNode.lng], {
    radius: 8,
    color: "#ffffff",
    weight: 2,
    fillColor: "#0b6e4f",
    fillOpacity: 1
  }).bindPopup('<span class="point-popup">Pickup</span>');

  if (state.userMarker) {
    markerLayer.removeLayer(state.userMarker);
  }

  state.userMarker = marker.addTo(markerLayer);
  state.userPoint = pickupNode;
  userLocationText.textContent = formatLatLng(pickupNode);
  userTrafficText.textContent = "Traffic: loading...";
  state.pendingDriverOffer = null;
  state.ridePhase = "idle";
  updateMapLegend();
  loadTrafficForPoint("user", pickupNode);
}

function setDropoffLocation(point) {
  state.matchingRequestSerial += 1;
  state.isRankingDrivers = false;
  state.userPanelTab = "request";
  clearDriverSuggestionRanking();
  const dropoffNode = addTemporaryPointToGraph(point, DROPOFF_POINT_NODE_ID);
  const marker = L.circleMarker([dropoffNode.lat, dropoffNode.lng], {
    radius: 8,
    color: "#ffffff",
    weight: 2,
    fillColor: "#4f46e5",
    fillOpacity: 1
  }).bindPopup('<span class="point-popup">Drop-off</span>');

  if (state.dropoffMarker) {
    markerLayer.removeLayer(state.dropoffMarker);
  }

  state.dropoffMarker = marker.addTo(markerLayer);
  state.dropoffPoint = dropoffNode;
  dropoffLocationText.textContent = formatLatLng(dropoffNode);
  dropoffTrafficText.textContent = "Traffic: loading...";
  state.pendingDriverOffer = null;
  state.ridePhase = "idle";
  updateMapLegend();
  loadTrafficForPoint("dropoff", dropoffNode);
}

function resetSelections() {
  state.matchingRequestSerial += 1;
  state.isRankingDrivers = false;
  state.userPanelTab = "request";
  clearPendingDriverOffer();
  clearDriverSuggestionRanking();
  releaseSelectedDriver();
  removeTemporaryPointFromGraph(USER_POINT_NODE_ID);
  removeTemporaryPointFromGraph(DROPOFF_POINT_NODE_ID);
  state.userPoint = null;
  state.dropoffPoint = null;
  state.selectedVehicleType = null;
  state.pendingDriverOffer = null;
  state.rejectedDriverIds.clear();
  state.selectionMode = null;
  state.ridePhase = "idle";
  state.offeredDriverId = null;
  state.selectedDriverId = null;
  userLocationText.textContent = "Not selected";
  dropoffLocationText.textContent = "Not selected";
  bestDriverText.textContent = "Waiting for driver suggestion";
  userTrafficText.textContent = "Traffic: waiting for pickup selection";
  dropoffTrafficText.textContent = "Traffic: waiting for drop-off selection";
  driverTrafficText.textContent = "Driver profile appears after pickup and drop-off are set";
  routeText.textContent = "Waiting for pickup and drop-off";
  routeTrafficText.textContent = "Route traffic: unavailable until a driver is accepted";
  routeLayer.clearLayers();
  updateOfferCard("", "");

  if (state.userMarker) {
    markerLayer.removeLayer(state.userMarker);
    state.userMarker = null;
  }

  if (state.dropoffMarker) {
    markerLayer.removeLayer(state.dropoffMarker);
    state.dropoffMarker = null;
  }

  for (const driver of state.drivers) {
    updateDriverMarker(driver);
  }

  updateMapLegend();
  updateRequestUI();
  setStatus("Request cleared. Choose a ride to begin.");
}

async function prepareDriverSuggestion() {
  const requestSerial = ++state.matchingRequestSerial;
  state.isRankingDrivers = false;

  if (!state.userPoint || !state.dropoffPoint) {
    setStatus("Set both pickup and drop-off first.");
    return;
  }

  if (!state.selectedVehicleType) {
    updateOfferCard("Choose a ride type first", "Select car or motorcycle before the app suggests a driver.");
    updateRequestUI();
    setStatus("Choose car or motorcycle before requesting a driver.");
    return;
  }

  clearPendingDriverOffer();
  clearDriverSuggestionRanking();
  releaseSelectedDriver();

  const tripPath = getPathBetweenNodes(state.userPoint.id, state.dropoffPoint.id);

  if (!tripPath) {
    routeLayer.clearLayers();
    state.pendingDriverOffer = null;
    routeText.textContent = "No trip route found";
    routeTrafficText.textContent = "Route traffic: unavailable";
    updateOfferCard("Pickup and drop-off are not connected", "Choose a different drop-off point inside the routable street network.");
    updateRequestUI();
    setStatus("No road route was found between your pickup and drop-off.");
    return;
  }

  try {
    state.isRankingDrivers = true;
    state.userPanelTab = "driver";
    updateRequestUI();
    bestDriverText.textContent = "Ranking nearby drivers";
    driverTrafficText.textContent = "Checking route distance, traffic, reliability, and route efficiency";
    routeText.textContent = `Trip preview: ${(tripPath.distance / 1000).toFixed(2)} km after pickup`;
    routeTrafficText.textContent = "Route traffic: preview only until you accept a driver";
    updateOfferCard(
      "Finding the best driver",
      ""
    );

    const ranking = state.usingPythonBackend
      ? await fetchBackendDriverSuggestion(tripPath)
      : await buildDriverSuggestionRanking(tripPath);
    if (requestSerial !== state.matchingRequestSerial) {
      state.isRankingDrivers = false;
      return;
    }

    state.isRankingDrivers = false;
    state.rankedDriverSuggestions = ranking.rankedCandidates;
    state.suggestionCursor = 0;
    state.baselineNearestSuggestion = ranking.baselineCandidate;
    state.suggestionSearchRadiusMeters = ranking.radiusMeters;
    syncBaselineDriverMarker();
    updateMapLegend();
    if (MATCH_DEBUG_ENABLED) {
      for (const candidate of ranking.rankedCandidates || []) {
        console.debug(`Driver ${candidate.driver?.id} intelligent-match debug`, candidate.debug || {});
      }
    }

    if (!ranking.rankedCandidates.length) {
      routeLayer.clearLayers();
      state.pendingDriverOffer = null;
      bestDriverText.textContent = ranking.reasonTitle;
      driverTrafficText.textContent = ranking.reasonDetail;
      routeText.textContent = "No pickup preview route found";
      routeTrafficText.textContent = "Route traffic: unavailable";
      updateOfferCard(ranking.offerTitle, ranking.offerDetail);
      updateRequestUI();
      setStatus(ranking.statusMessage);
      return;
    }

    presentRankedDriverSuggestion();
  } catch (error) {
    console.error(error);
    routeLayer.clearLayers();
    state.pendingDriverOffer = null;
    bestDriverText.textContent = "Driver ranking failed";
    driverTrafficText.textContent = "The intelligent matcher could not finish this request";
    routeText.textContent = "No pickup preview route found";
    routeTrafficText.textContent = "Route traffic: unavailable";
    updateOfferCard("Driver ranking failed", "Something went wrong while scoring nearby drivers. Please try selecting the drop-off again.");
    updateRequestUI();
    setStatus("The intelligent matcher could not finish this request.");
  } finally {
    state.isRankingDrivers = false;
  }
}

async function fetchBackendDriverSuggestion(tripPath) {
  try {
    const response = await fetch("/api/intelligent-match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        pickup: {
          lat: state.userPoint.lat,
          lng: state.userPoint.lng
        },
        dropoff: {
          lat: state.dropoffPoint.lat,
          lng: state.dropoffPoint.lng
        },
        vehicleType: state.selectedVehicleType,
        drivers: state.drivers.map(serializeDriverForMatching)
      })
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }

    if (response.status === 404) {
      state.backendSupportsIntelligentMatch = false;
      setStatus("The running Python server does not have /api/intelligent-match yet. Using browser fallback mode for driver ranking.");
      return buildDriverSuggestionRanking(tripPath);
    }

    if (!response.ok && !Array.isArray(payload?.rankedCandidates)) {
      console.warn("Backend intelligent match failed, switching to browser fallback mode.", payload?.error || response.status);
      setStatus("Backend intelligent matching is unavailable right now. Using browser fallback mode.");
      return buildDriverSuggestionRanking(tripPath);
    }

    state.backendSupportsIntelligentMatch = true;
    payload.matchingMode = payload.matchingMode || "backend_primary";
    return payload;
  } catch (error) {
    console.warn("Backend intelligent match request failed, switching to browser fallback mode.", error);
    setStatus("Backend intelligent matching is unavailable right now. Using browser fallback mode.");
    return buildDriverSuggestionRanking(tripPath);
  }
}

function serializeDriverForMatching(driver) {
  return {
    id: driver.id,
    type: driver.type,
    status: driver.status,
    lat: driver.lat,
    lng: driver.lng,
    speedKph: driver.speedKph,
    rating: driver.rating,
    cancellationRate: driver.cancellationRate,
    currentNodeId: driver.currentNodeId,
    routeNodeIds: [...driver.routeNodeIds],
    routeSegmentIndex: driver.routeSegmentIndex,
    lockedToUser: driver.lockedToUser,
    heldForOffer: driver.heldForOffer
  };
}

function releaseSelectedDriver() {
  if (!state.selectedDriverId) {
    return;
  }

  const selectedDriver = state.drivers.find((driver) => driver.id === state.selectedDriverId);
  if (selectedDriver && selectedDriver.lockedToUser) {
    stopDriverAtNearestNode(selectedDriver);
  }

  state.selectedDriverId = null;
}

function holdDriverForOffer(driver) {
  if (!driver) {
    return;
  }

  driver.resumeAfterOffer = driver.status === "moving_available";

  if (driver.status === "moving_available") {
    stopDriverAtNearestNode(driver);
  }

  driver.heldForOffer = true;
  state.offeredDriverId = driver.id;
  state.selectedDriverId = driver.id;
  for (const candidate of state.drivers) {
    updateDriverMarker(candidate);
  }
  updateMapLegend();
}

function clearPendingDriverOffer(clearSelection = true) {
  const offeredDriver = state.drivers.find((driver) => driver.id === state.offeredDriverId);
  if (offeredDriver) {
    releaseDriverOfferHold(offeredDriver);
  }

  state.offeredDriverId = null;
  state.pendingDriverOffer = null;
  state.lastPricingEstimate = null;

  if (clearSelection && state.selectedDriverId && !state.drivers.find((driver) => driver.id === state.selectedDriverId)?.lockedToUser) {
    state.selectedDriverId = null;
  }

  for (const driver of state.drivers) {
    updateDriverMarker(driver);
  }
  updateMapLegend();
}

function releaseDriverOfferHold(driver) {
  if (!driver) {
    return;
  }

  const shouldResumeMovement = Boolean(driver.resumeAfterOffer)
    && !driver.lockedToUser
    && driver.status === "standby_available";

  driver.heldForOffer = false;
  driver.resumeAfterOffer = false;

  if (shouldResumeMovement) {
    sendDriverToReposition(driver);
    return;
  }

  updateDriverMarker(driver);
}

async function buildDriverSuggestionRanking(tripPath) {
  const serviceRadii = [MATCH_DEFAULT_RADIUS_METERS, MATCH_EXPANDED_RADIUS_METERS];
  let eligibleDrivers = [];
  let radiusMeters = MATCH_DEFAULT_RADIUS_METERS;

  for (const radius of serviceRadii) {
    eligibleDrivers = state.drivers.filter((driver) => isDriverEligibleForSuggestion(driver, radius));
    radiusMeters = radius;
    if (eligibleDrivers.length) {
      break;
    }
  }

  if (!eligibleDrivers.length) {
    return {
      rankedCandidates: [],
      baselineCandidate: null,
      radiusMeters,
      matchingMode: "browser_fallback",
      trafficSource: "heuristic_fallback",
      weatherSource: state.weatherContext?.source || "weather_fallback",
      trafficNotice: "Traffic source: heuristic fallback because live traffic was unavailable.",
      weatherNotice: state.weatherContext?.notice || "Weather source: fallback because live weather was unavailable.",
      reasonTitle: "No nearby eligible driver",
      reasonDetail: `No ${state.selectedVehicleType === "car" ? "car" : "motorcycle"} driver passed the quality checks within 5.0 km.`,
      offerTitle: "No driver found within service range",
      offerDetail: "We checked 3 km first, then expanded to 5 km, but no nearby driver met the vehicle, route, radius, and availability requirements.",
      statusMessage: "No eligible driver met the matching rules within 5 km."
    };
  }

  const baselineCandidate = getBaselineNearestDriverCandidate(eligibleDrivers);
  const candidateResults = await Promise.allSettled(
    eligibleDrivers.map((driver) => evaluateDriverCandidate(driver, tripPath))
  );
  const rankedCandidates = candidateResults
    .filter((result) => result.status === "fulfilled" && result.value)
    .map((result) => result.value);

  if (!rankedCandidates.length) {
    return {
      rankedCandidates: [],
      baselineCandidate,
      radiusMeters,
      matchingMode: "browser_fallback",
      trafficSource: "heuristic_fallback",
      weatherSource: state.weatherContext?.source || "weather_fallback",
      trafficNotice: "Traffic source: heuristic fallback because live traffic was unavailable.",
      weatherNotice: state.weatherContext?.notice || "Weather source: fallback because live weather was unavailable.",
      reasonTitle: "No connected driver",
      reasonDetail: "Nearby drivers were found, but none had a connected A* pickup route.",
      offerTitle: "No connected driver available",
      offerDetail: "Nearby drivers passed the filters, but each one was skipped because no A* route to your pickup was found.",
      statusMessage: "Nearby drivers were found, but none had a connected A* route to your pickup."
    };
  }

  applyRelativeScoresToCandidates(rankedCandidates);
  rankedCandidates.sort((left, right) => {
    if (right.finalScore !== left.finalScore) {
      return right.finalScore - left.finalScore;
    }

    if (left.pickupEtaMinutes !== right.pickupEtaMinutes) {
      return left.pickupEtaMinutes - right.pickupEtaMinutes;
    }

    return left.pickupDistanceMeters - right.pickupDistanceMeters;
  });

  for (const [index, candidate] of rankedCandidates.entries()) {
    candidate.rank = index + 1;
    candidate.selectionReason = buildDriverSelectionReason(candidate, baselineCandidate);
  }

  return {
    rankedCandidates,
    baselineCandidate,
    radiusMeters,
    matchingMode: "browser_fallback",
    trafficSource: rankedCandidates.some((candidate) => candidate.trafficSource === "tomtom_live")
      ? "tomtom_live"
      : "heuristic_fallback",
    weatherSource: state.weatherContext?.source || "weather_fallback",
    trafficNotice: "Traffic source: heuristic fallback because live traffic was unavailable.",
    weatherNotice: state.weatherContext?.notice || "Weather source: fallback because live weather was unavailable.",
    reasonTitle: "",
    reasonDetail: "",
    offerTitle: "",
    offerDetail: "",
    statusMessage: ""
  };
}

function isDriverEligibleForSuggestion(driver, radiusMeters) {
  return isDriverAvailableForMatching(driver)
    && driver.type === state.selectedVehicleType
    && !state.rejectedDriverIds.has(driver.id)
    && haversineDistance(driver, state.userPoint) <= radiusMeters;
}

function getBaselineNearestDriverCandidate(drivers) {
  if (!drivers.length) {
    return null;
  }

  let bestCandidate = null;

  for (const driver of drivers) {
    const directDistanceMeters = haversineDistance(driver, state.userPoint);
    if (!bestCandidate || directDistanceMeters < bestCandidate.directDistanceMeters) {
      bestCandidate = {
        driverId: driver.id,
        type: driver.type,
        directDistanceMeters
      };
    }
  }

  return bestCandidate;
}

async function evaluateDriverCandidate(driver, tripPath) {
  const startNode = getDriverRouteStartNode(driver);
  if (!startNode) {
    return null;
  }

  const pickupPath = getPathBetweenNodes(startNode.id, state.userPoint.id);
  if (!pickupPath) {
    return null;
  }

  const startOffsetMeters = haversineDistance(driver, startNode);
  const pickupDistanceMeters = pickupPath.distance + startOffsetMeters;
  const directDistanceMeters = haversineDistance(driver, state.userPoint);
  const trafficContext = estimateDriverTrafficFallbackContext(pickupDistanceMeters, state.weatherContext?.multiplier || 1);
  const trafficRatio = trafficContext.ratio;
  const weatherMultiplier = state.weatherContext?.multiplier || 1;
  const weatherSource = state.weatherContext?.source || "weather_fallback";
  const speedKph = driver.speedKph || DRIVER_SPEED_KPH;
  const pickupEtaMinutes = getEtaMinutes(pickupDistanceMeters, speedKph, trafficRatio, weatherMultiplier);
  const tripEtaMinutes = getEtaMinutes(tripPath.distance, speedKph, trafficRatio, weatherMultiplier);
  const trafficScore = clampValue(trafficRatio, 0, 1);

  return {
    driver,
    startNode,
    pickupPath,
    tripPath,
    pickupDistanceMeters,
    directDistanceMeters,
    pickupEtaMinutes,
    tripEtaMinutes,
    trafficRatio,
    trafficSource: trafficContext.source,
    trafficNotice: trafficContext.notice,
    weatherMultiplier,
    weatherSource,
    weatherNotice: state.weatherContext?.notice || "Weather source: fallback because live weather was unavailable.",
    trafficScore,
    ratingScore: clampValue((driver.rating - 4) / 1, 0, 1),
    cancellationScore: clampValue(1 - (driver.cancellationRate / 0.25), 0, 1),
    routeEfficiencyScore: clampValue(directDistanceMeters / Math.max(pickupDistanceMeters, 1), 0, 1),
    movementScore: getDriverMovementScore(driver),
    distanceScore: 0,
    finalScore: 0,
    matchingMode: "browser_fallback",
    scoreBreakdown: {},
    debug: {},
    selectionReason: "",
    rank: 0
  };
}

function estimateDriverTrafficFallbackContext(pickupDistanceMeters, weatherMultiplier) {
  return {
    ratio: estimateHeuristicTrafficRatio(pickupDistanceMeters, weatherMultiplier),
    source: "heuristic_fallback",
    notice: "Traffic source: heuristic fallback because live traffic was unavailable."
  };
}

function getTrafficRatioFromSegment(traffic) {
  if (!traffic) {
    return MATCH_TRAFFIC_FALLBACK_RATIO;
  }

  if (traffic.roadClosure) {
    return 0.15;
  }

  return clampValue(traffic.currentSpeed / Math.max(traffic.freeFlowSpeed, 1), 0.15, 1);
}

function estimateHeuristicTrafficRatio(pickupDistanceMeters, weatherMultiplier) {
  const currentHour = getManilaHourValue();
  let baseRatio = 0.86;

  if (currentHour >= 7 && currentHour < 10 || currentHour >= 16 && currentHour < 20) {
    baseRatio = 0.58;
  } else if (currentHour >= 10 && currentHour < 16) {
    baseRatio = 0.72;
  } else if (currentHour >= 5 && currentHour < 7 || currentHour >= 20 && currentHour < 22) {
    baseRatio = 0.66;
  }

  const distancePenalty = Math.min((pickupDistanceMeters / 1000) * 0.015, 0.08);
  const weatherPenalty = Math.min(Math.max(weatherMultiplier - 1, 0) * 0.18, 0.12);
  return clampValue(baseRatio - distancePenalty - weatherPenalty, 0.15, 1);
}

function getEtaMinutes(distanceMeters, speedKph, trafficRatio, weatherMultiplier) {
  const adjustedSpeedKph = Math.max(8, speedKph * Math.max(trafficRatio, 0.2)) / Math.max(weatherMultiplier, 0.8);
  return Math.max(1, Math.round((distanceMeters / 1000 / adjustedSpeedKph) * 60));
}

function getEffectiveDriverSpeedKph(driver, remainingDistanceMeters = 0) {
  const baseSpeedKph = driver.speedKph || DRIVER_SPEED_KPH;
  const weatherMultiplier = state.weatherContext?.multiplier || driver.movementWeatherMultiplier || 1;
  const trafficRatio = typeof driver.movementTrafficRatio === "number"
    ? driver.movementTrafficRatio
    : estimateHeuristicTrafficRatio(remainingDistanceMeters || 0, weatherMultiplier);

  return Math.max(8, baseSpeedKph * Math.max(trafficRatio, 0.2)) / Math.max(weatherMultiplier, 0.8);
}

function getDriverMoveDistanceMeters(driver, deltaSeconds) {
  const remainingDistance = getDriverRemainingDistance(driver);
  const effectiveSpeedKph = getEffectiveDriverSpeedKph(driver, remainingDistance);
  return (effectiveSpeedKph * 1000 / 3600) * deltaSeconds;
}

function getDriverMovementScore(driver) {
  if (driver.status === "standby_available") {
    return 0.82;
  }

  const nextNodeId = driver.routeNodeIds[driver.routeSegmentIndex + 1];
  const nextNode = nextNodeId ? state.nodeIndex.get(nextNodeId) : null;
  const directDistanceMeters = haversineDistance(driver, state.userPoint);

  if (nextNode && haversineDistance(nextNode, state.userPoint) < directDistanceMeters) {
    return 1;
  }

  return 0.58;
}

function applyRelativeScoresToCandidates(candidates) {
  const distanceValues = candidates.map((candidate) => candidate.pickupDistanceMeters);
  const distanceMin = Math.min(...distanceValues);
  const distanceMax = Math.max(...distanceValues);

  for (const candidate of candidates) {
    candidate.distanceScore = getInverseRelativeScore(candidate.pickupDistanceMeters, distanceMin, distanceMax);
    candidate.finalScore = (
      (candidate.distanceScore * 0.35)
      + (candidate.trafficScore * 0.25)
      + (candidate.ratingScore * 0.1)
      + (candidate.cancellationScore * 0.1)
      + (candidate.routeEfficiencyScore * 0.15)
      + (candidate.movementScore * 0.05)
    );
    candidate.scoreBreakdown = {
      distance_score: candidate.distanceScore,
      traffic_score: candidate.trafficScore,
      rating_score: candidate.ratingScore,
      cancellation_score: candidate.cancellationScore,
      route_efficiency_score: candidate.routeEfficiencyScore,
      movement_score: candidate.movementScore,
      final_score: candidate.finalScore
    };
    candidate.debug = {
      traffic_ratio: candidate.trafficRatio,
      traffic_source: candidate.trafficSource,
      weather_multiplier: candidate.weatherMultiplier,
      weather_source: candidate.weatherSource,
      distance_score: candidate.distanceScore,
      traffic_score: candidate.trafficScore,
      rating_score: candidate.ratingScore,
      cancellation_score: candidate.cancellationScore,
      route_efficiency_score: candidate.routeEfficiencyScore,
      movement_score: candidate.movementScore,
      final_score: candidate.finalScore
    };
  }
}

function getInverseRelativeScore(value, min, max) {
  if (max === min) {
    return 1;
  }

  return clampValue(1 - ((value - min) / (max - min)), 0, 1);
}

function buildDriverSelectionReason(candidate, baselineCandidate) {
  const reasonParts = [];

  if (!baselineCandidate || baselineCandidate.driverId === candidate.driver.id) {
    reasonParts.push("also the nearest eligible driver");
  } else {
    reasonParts.push(`beat the nearest baseline driver with a stronger overall score (${candidate.finalScore.toFixed(2)})`);
  }

  reasonParts.push(`${describeTrafficRatio(candidate.trafficRatio)} traffic`);
  reasonParts.push(candidate.trafficSource === "tomtom_live" ? "used TomTom live traffic" : "used heuristic traffic fallback");
  reasonParts.push(`${(candidate.pickupDistanceMeters / 1000).toFixed(2)} km routed pickup distance`);
  reasonParts.push(`${Math.round(candidate.routeEfficiencyScore * 100)}% route efficiency`);
  reasonParts.push(`${candidate.driver.rating.toFixed(2)} rating`);
  reasonParts.push(`${formatCancellationRisk(candidate.driver.cancellationRate)} cancellation risk`);
  reasonParts.push(describeMovementBehavior(candidate.driver, candidate.movementScore));
  return `ETA is shown for user understanding but not scored directly. Selected because it ${reasonParts.join(", ")}.`;
}

function presentRankedDriverSuggestion() {
  clearPendingDriverOffer();

  while (state.suggestionCursor < state.rankedDriverSuggestions.length) {
    const rankedCandidate = state.rankedDriverSuggestions[state.suggestionCursor];
    const liveDriver = state.drivers.find((driver) => driver.id === rankedCandidate.driver.id);

    if (!liveDriver || !isDriverEligibleForRankedOffer(liveDriver)) {
      state.suggestionCursor += 1;
      continue;
    }

    rankedCandidate.driver = liveDriver;
    state.pendingDriverOffer = rankedCandidate;
    state.userPanelTab = "driver";
    holdDriverForOffer(liveDriver);
    syncPendingDriverOfferToHeldDriver(rankedCandidate);
    drawSuggestedDriverPreview(liveDriver, rankedCandidate.startNode, rankedCandidate.pickupPath, rankedCandidate.tripPath);
    updateSuggestedDriverInfo(rankedCandidate);
    void refreshOfferPricing(rankedCandidate);
    return true;
  }

  routeLayer.clearLayers();
  state.pendingDriverOffer = null;
  bestDriverText.textContent = "No more ranked drivers";
  driverTrafficText.textContent = "Every ranked driver has already been reviewed or is no longer available";
  routeText.textContent = "No preview route found";
  routeTrafficText.textContent = "Route traffic: unavailable";
  updateOfferCard(
    "No more suggested drivers",
    "You have already reviewed the ranked drivers for this request. Reset the request or wait for a new driver to become available."
  );
  updateRequestUI();
  setStatus("No more ranked driver suggestions are available for this request.");
  return false;
}

function isDriverEligibleForRankedOffer(driver) {
  return isDriverAvailableForMatching(driver)
    && driver.type === state.selectedVehicleType
    && !state.rejectedDriverIds.has(driver.id)
    && haversineDistance(driver, state.userPoint) <= state.suggestionSearchRadiusMeters;
}

function runAStar(startId, goalId) {
  const openSet = new Set([startId]);
  const cameFrom = new Map();
  const gScore = new Map([[startId, 0]]);
  const fScore = new Map([[startId, estimateCost(startId, goalId)]]);

  while (openSet.size) {
    const currentId = getLowestScoreNode(openSet, fScore);
    if (currentId === goalId) {
      return reconstructPath(cameFrom, currentId, gScore.get(goalId) ?? 0);
    }

    openSet.delete(currentId);
    const neighbors = state.graph.get(currentId) || [];

    for (const neighbor of neighbors) {
      const tentativeGScore = (gScore.get(currentId) ?? Infinity) + neighbor.distance;
      if (tentativeGScore >= (gScore.get(neighbor.id) ?? Infinity)) {
        continue;
      }

      cameFrom.set(neighbor.id, currentId);
      gScore.set(neighbor.id, tentativeGScore);
      fScore.set(neighbor.id, tentativeGScore + estimateCost(neighbor.id, goalId));
      openSet.add(neighbor.id);
    }
  }

  return null;
}

function getPathBetweenNodes(startId, goalId) {
  const cacheKey = `${startId}:${goalId}`;
  if (state.routeCache.has(cacheKey)) {
    return state.routeCache.get(cacheKey);
  }

  const path = runAStar(startId, goalId);
  state.routeCache.set(cacheKey, path);
  return path;
}

function getDriverRouteStartNode(driver) {
  const nearestNode = getNearestNode(driver.lat, driver.lng);

  if (driver.routeNodeIds.length > 1) {
    const currentNode = driver.currentNodeId
      ? state.nodeIndex.get(driver.currentNodeId)
      : null;
    const nextNodeId = driver.routeNodeIds[driver.routeSegmentIndex + 1];
    const nextNode = nextNodeId ? state.nodeIndex.get(nextNodeId) : null;
    const candidates = [currentNode, nextNode, nearestNode].filter(Boolean);

    if (candidates.length) {
      return candidates.reduce((best, candidate) => (
        haversineDistance(driver, candidate) < haversineDistance(driver, best)
          ? candidate
          : best
      ));
    }
  }

  if (driver.currentNodeId) {
    return state.nodeIndex.get(driver.currentNodeId) || nearestNode;
  }

  return nearestNode;
}

function isDriverAvailableForMatching(driver) {
  return !driver.lockedToUser
    && !driver.heldForOffer
    && (driver.status === "standby_available" || driver.status === "moving_available");
}

function syncPendingDriverOfferToHeldDriver(offer) {
  if (!offer?.driver || !state.userPoint) {
    return offer;
  }

  const actualStartNode = getDriverRouteStartNode(offer.driver);
  if (!actualStartNode) {
    return offer;
  }

  const actualPickupPath = getPathBetweenNodes(actualStartNode.id, state.userPoint.id);
  if (!actualPickupPath) {
    return offer;
  }

  const startOffsetMeters = haversineDistance(offer.driver, actualStartNode);
  const pickupDistanceMeters = actualPickupPath.distance + startOffsetMeters;
  const speedKph = offer.driver.speedKph || DRIVER_SPEED_KPH;

  offer.startNode = actualStartNode;
  offer.pickupPath = actualPickupPath;
  offer.pickupDistanceMeters = pickupDistanceMeters;
  offer.pickupEtaMinutes = getEtaMinutes(
    pickupDistanceMeters,
    speedKph,
    offer.trafficRatio || MATCH_TRAFFIC_FALLBACK_RATIO,
    offer.weatherMultiplier || 1
  );

  return offer;
}

function buildRouteLine(startLatLng, startNode, path) {
  const line = [startLatLng];
  const startPoint = [startNode.lat, startNode.lng];

  if (Math.abs(startLatLng[0] - startPoint[0]) > 0.00001 || Math.abs(startLatLng[1] - startPoint[1]) > 0.00001) {
    line.push(startPoint);
  }

  for (const nodeId of path.nodeIds) {
    const node = state.nodeIndex.get(nodeId);
    if (node) {
      line.push([node.lat, node.lng]);
    }
  }

  return line;
}

function drawSuggestedDriverPreview(driver, startNode, pickupPath, tripPath) {
  routeLayer.clearLayers();

  L.polyline(buildRouteLine([driver.lat, driver.lng], startNode, pickupPath), {
    color: "#f4a261",
    weight: 5,
    opacity: 0.92,
    dashArray: "12 10"
  }).addTo(routeLayer);

  L.polyline(buildRouteLine([state.userPoint.lat, state.userPoint.lng], state.userPoint, tripPath), {
    color: "#4f46e5",
    weight: 5,
    opacity: 0.84
  }).addTo(routeLayer);
}

function updateSuggestedDriverInfoLegacy(driver, pickupPath, tripPath) {
  const pickupEtaMinutes = Math.max(1, Math.round((pickupPath.distance / 1000 / DRIVER_SPEED_KPH) * 60));
  const tripEtaMinutes = Math.max(1, Math.round((tripPath.distance / 1000 / DRIVER_SPEED_KPH) * 60));
  bestDriverText.textContent = `Driver ${driver.id} (${driver.type === "car" ? "car" : "motorcycle"})`;
  driverTrafficText.textContent = `Pickup in about ${pickupEtaMinutes} min over ${(pickupPath.distance / 1000).toFixed(2)} km`;
  routeText.textContent = `Trip preview: ${(tripPath.distance / 1000).toFixed(2)} km, about ${tripEtaMinutes} min after pickup`;
  routeTrafficText.textContent = "Route traffic: preview only until you accept this driver";
  updateOfferCard(
    `Driver ${driver.id} is ready for review`,
    `${driver.type === "car" ? "Car" : "Motorcycle"} • ${(pickupPath.distance / 1000).toFixed(2)} km to pickup • ${(tripPath.distance / 1000).toFixed(2)} km after pickup`
  );
  setStatus(`Suggested Driver ${driver.id}. Review the driver profile before dispatch.`);
  updateRequestUI();
}

function updateSuggestedDriverInfo(offer) {
  const { driver, tripPath, pickupDistanceMeters, pickupEtaMinutes, tripEtaMinutes } = offer;
  const driverTypeLabel = driver.type === "car" ? "Car" : "Motorcycle";
  bestDriverText.textContent = `${driverTypeLabel} driver ${driver.id} is ready for review`;
  driverTrafficText.textContent = `ETA ${pickupEtaMinutes} min | ${(pickupDistanceMeters / 1000).toFixed(2)} km to pickup | rating ${driver.rating.toFixed(2)} | cancellation ${formatCancellationRisk(driver.cancellationRate)}`;
  routeText.textContent = `Trip preview: ${(tripPath.distance / 1000).toFixed(2)} km, about ${tripEtaMinutes} min after pickup`;
  routeTrafficText.textContent = "Route traffic: preview only until you accept this driver";
  updateOfferCard(
    `${driverTypeLabel} driver ${driver.id} is ready for review`,
    ""
  );
  renderOfferMatchSummary(offer);
  setStatus(`Suggested Driver ${driver.id}. Review the driver profile before dispatch.`);
  updateRequestUI();
}

function assignMatchedDriverToUser(driver, startNode, path, offer) {
  driver.status = "assigned_pickup";
  driver.currentNodeId = startNode.id;
  driver.routeNodeIds = path.nodeIds;
  driver.routeSegmentIndex = 0;
  driver.routeSegmentProgress = 0;
  driver.targetLandmarkId = null;
  driver.targetUserNodeId = state.userPoint?.id || null;
  driver.lockedToUser = true;
  driver.lat = startNode.lat;
  driver.lng = startNode.lng;
  driver.movementTrafficRatio = typeof offer?.trafficRatio === "number"
    ? offer.trafficRatio
    : estimateHeuristicTrafficRatio(path.distance || 0, offer?.weatherMultiplier || state.weatherContext?.multiplier || 1);
  driver.movementTrafficSource = offer?.trafficSource || "heuristic_fallback";
  driver.movementWeatherMultiplier = offer?.weatherMultiplier || state.weatherContext?.multiplier || 1;
  driver.movementWeatherSource = offer?.weatherSource || state.weatherContext?.source || "weather_fallback";
}

async function acceptPendingDriverOffer() {
  const offer = state.pendingDriverOffer;
  if (!offer) {
    return;
  }

  const pricingEstimate = await ensureOfferPricing(offer);
  if (state.pendingDriverOffer !== offer) {
    return;
  }

  if (offer.driver) {
    offer.driver.heldForOffer = false;
    offer.driver.resumeAfterOffer = false;
  }

  state.offeredDriverId = null;
  state.selectedDriverId = offer.driver.id;
  state.ridePhase = "driver_to_pickup";
  state.userPanelTab = "trip";
  assignMatchedDriverToUser(offer.driver, offer.startNode, offer.pickupPath, offer);
  routeLayer.clearLayers();
  L.polyline(buildRouteLine([offer.driver.lat, offer.driver.lng], offer.startNode, offer.pickupPath), {
    color: "#f4a261",
    weight: 6,
    opacity: 0.92
  }).addTo(routeLayer);
  bestDriverText.textContent = `Driver ${offer.driver.id} (${offer.driver.type === "car" ? "car" : "motorcycle"})`;
  driverTrafficText.textContent = "Driver accepted and now heading to your pickup point";
  routeText.textContent = `Driver to pickup: ${(offer.pickupPath.distance / 1000).toFixed(2)} km`;
  routeTrafficText.textContent = "Route traffic: pickup leg is now active";
  const acceptedDetail = pricingEstimate
    ? `Your driver is now heading to the pickup point. Estimated fare ${formatPeso(pricingEstimate.totalFare)}. You will switch to the drop-off trip after pickup.`
    : "Your driver is now heading to the pickup point. You will switch to the drop-off trip after pickup.";
  updateOfferCard("Driver accepted", acceptedDetail);
  renderOfferMatchSummary(offer);
  updatePricingDetailsPanel(pricingEstimate, { onlyIfOpen: true });
  loadTrafficForPoint("driver", getDriverRouteStartNode(offer.driver));
  loadRouteTrafficSummary(offer.pickupPath.nodeIds, offer.driver, offer.pickupPath.distance);

  for (const candidate of state.drivers) {
    updateDriverMarker(candidate);
  }

  updateMapLegend();
  updateRequestUI();
  setStatus(`Driver ${offer.driver.id} accepted. They are now heading to your pickup point.`);
}

function suggestOtherDriverLegacy() {
  if (!state.pendingDriverOffer) {
    return;
  }

  state.rejectedDriverIds.add(state.pendingDriverOffer.driver.id);
  clearPendingDriverOffer();
  bestDriverText.textContent = "Looking for another driver";
  driverTrafficText.textContent = "Checking the next best available A* match";
  updateOfferCard("Suggesting another driver", "Trying the next closest available driver to your pickup.");
  prepareDriverSuggestion();
}

function suggestOtherDriver() {
  if (!state.pendingDriverOffer) {
    return;
  }

  state.rejectedDriverIds.add(state.pendingDriverOffer.driver.id);
  clearPendingDriverOffer();
  state.suggestionCursor += 1;
  bestDriverText.textContent = "Looking for another driver";
  driverTrafficText.textContent = "Checking the next ranked driver";
  updateOfferCard("Suggesting another driver", "Trying the next highest-ranked driver for your pickup.");
  presentRankedDriverSuggestion();
}

function syncMatchedDriverRoute() {
  if (!state.selectedDriverId || !state.userPoint) {
    return;
  }

  const driver = state.drivers.find((candidate) => candidate.id === state.selectedDriverId);
  if (!driver || !driver.lockedToUser) {
    return;
  }

  routeLayer.clearLayers();

  const activeColor = state.ridePhase === "on_trip" ? "#d1495b" : "#f4a261";
  const activeLabel = state.ridePhase === "on_trip" ? "On-trip" : "Driver to pickup";
  const line = buildActiveDriverRouteLine(driver);

  L.polyline(line, {
    color: activeColor,
    weight: 6,
    opacity: 0.92
  }).addTo(routeLayer);

  const remainingDistance = getDriverRemainingDistance(driver);
  const effectiveSpeedKph = getEffectiveDriverSpeedKph(driver, remainingDistance);
  const etaMinutes = Math.max(1, Math.round((remainingDistance / 1000 / effectiveSpeedKph) * 60));
  routeText.textContent = `${activeLabel}: ${(remainingDistance / 1000).toFixed(2)} km, approx ${etaMinutes} min`;
}

function buildActiveDriverRouteLine(driver) {
  const line = [[driver.lat, driver.lng]];

  if (!driver.routeNodeIds.length) {
    return line;
  }

  for (const nodeId of driver.routeNodeIds.slice(driver.routeSegmentIndex + 1)) {
    const node = state.nodeIndex.get(nodeId);
    if (node) {
      line.push([node.lat, node.lng]);
    }
  }

  return line;
}

function getDriverRemainingDistance(driver) {
  if (!driver.routeNodeIds.length || driver.routeSegmentIndex >= driver.routeNodeIds.length - 1) {
    return 0;
  }

  let remainingDistance = 0;
  const currentNode = state.nodeIndex.get(driver.routeNodeIds[driver.routeSegmentIndex]);
  const nextNode = state.nodeIndex.get(driver.routeNodeIds[driver.routeSegmentIndex + 1]);

  if (currentNode && nextNode) {
    remainingDistance += Math.max(0, haversineDistance(currentNode, nextNode) - driver.routeSegmentProgress);
  }

  for (let index = driver.routeSegmentIndex + 1; index < driver.routeNodeIds.length - 1; index += 1) {
    const fromNode = state.nodeIndex.get(driver.routeNodeIds[index]);
    const toNode = state.nodeIndex.get(driver.routeNodeIds[index + 1]);
    if (fromNode && toNode) {
      remainingDistance += haversineDistance(fromNode, toNode);
    }
  }

  return remainingDistance;
}

function getLowestScoreNode(openSet, fScore) {
  let bestId = null;
  let bestScore = Infinity;

  for (const nodeId of openSet) {
    const score = fScore.get(nodeId) ?? Infinity;
    if (score < bestScore) {
      bestScore = score;
      bestId = nodeId;
    }
  }

  return bestId;
}

function reconstructPath(cameFrom, currentId, distance) {
  const nodeIds = [currentId];
  let workingId = currentId;

  while (cameFrom.has(workingId)) {
    workingId = cameFrom.get(workingId);
    nodeIds.unshift(workingId);
  }

  return { nodeIds, distance };
}

function estimateCost(fromId, toId) {
  const fromNode = state.nodeIndex.get(fromId);
  const toNode = state.nodeIndex.get(toId);
  return haversineDistance(fromNode, toNode);
}

function getNearestNode(lat, lng) {
  let nearestNode = null;
  let nearestDistance = Infinity;

  for (const node of state.nodeIndex.values()) {
    if (node.id === USER_POINT_NODE_ID || node.id === DROPOFF_POINT_NODE_ID) {
      continue;
    }

    const distance = haversineDistance({ lat, lng }, node);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestNode = node;
    }
  }

  return nearestNode;
}

function getNearestRoadPoint(lat, lng) {
  let bestSnap = null;

  for (const segment of state.roadSegments) {
    const fromNode = state.nodeIndex.get(segment.fromNodeId);
    const toNode = state.nodeIndex.get(segment.toNodeId);
    if (!fromNode || !toNode) {
      continue;
    }

    const candidate = projectPointOntoSegment({ lat, lng }, fromNode, toNode, segment.distance);
    if (!candidate) {
      continue;
    }

    if (!bestSnap || candidate.distanceToSegment < bestSnap.distanceToSegment) {
      bestSnap = {
        ...candidate,
        fromNodeId: fromNode.id,
        toNodeId: toNode.id
      };
    }
  }

  return bestSnap;
}

function projectPointOntoSegment(point, fromNode, toNode, segmentDistance = haversineDistance(fromNode, toNode)) {
  const pointPixel = map.latLngToLayerPoint([point.lat, point.lng]);
  const fromPixel = map.latLngToLayerPoint([fromNode.lat, fromNode.lng]);
  const toPixel = map.latLngToLayerPoint([toNode.lat, toNode.lng]);
  const pointX = pointPixel.x - fromPixel.x;
  const pointY = pointPixel.y - fromPixel.y;
  const segmentX = toPixel.x - fromPixel.x;
  const segmentY = toPixel.y - fromPixel.y;
  const segmentLengthSquared = (segmentX * segmentX) + (segmentY * segmentY);

  if (!segmentLengthSquared) {
    return null;
  }

  const projection = ((pointX * segmentX) + (pointY * segmentY)) / segmentLengthSquared;
  const ratio = Math.max(0, Math.min(1, projection));
  const snappedX = segmentX * ratio;
  const snappedY = segmentY * ratio;
  const snappedLatLng = map.layerPointToLatLng(L.point(
    fromPixel.x + snappedX,
    fromPixel.y + snappedY
  ));

  return {
    lat: snappedLatLng.lat,
    lng: snappedLatLng.lng,
    distanceToSegment: Math.hypot(pointX - snappedX, pointY - snappedY),
    distanceFromStart: segmentDistance * ratio,
    distanceToEnd: segmentDistance * (1 - ratio)
  };
}

function addTemporaryPointToGraph(point, nodeId) {
  removeTemporaryPointFromGraph(nodeId);

  const tempNode = {
    id: nodeId,
    lat: point.lat,
    lng: point.lng
  };

  state.nodeIndex.set(tempNode.id, tempNode);
  state.graph.set(tempNode.id, []);

  const fromNode = state.nodeIndex.get(point.fromNodeId);
  const toNode = state.nodeIndex.get(point.toNodeId);

  if (!fromNode || !toNode) {
    return tempNode;
  }

  if (hasDirectedEdge(fromNode.id, toNode.id)) {
    addEdge(fromNode, tempNode, point.distanceFromStart);
    addEdge(tempNode, toNode, point.distanceToEnd);
  }

  if (hasDirectedEdge(toNode.id, fromNode.id)) {
    addEdge(toNode, tempNode, point.distanceToEnd);
    addEdge(tempNode, fromNode, point.distanceFromStart);
  }

  state.routeCache.clear();
  return tempNode;
}

function removeTemporaryPointFromGraph(nodeId) {
  if (!state.nodeIndex.has(nodeId) && !state.graph.has(nodeId)) {
    return;
  }

  state.graph.delete(nodeId);
  state.nodeIndex.delete(nodeId);

  for (const [graphNodeId, neighbors] of state.graph.entries()) {
    state.graph.set(
      graphNodeId,
      neighbors.filter((neighbor) => neighbor.id !== nodeId)
    );
  }

  state.routeCache.clear();
}

function hasDirectedEdge(fromId, toId) {
  return (state.graph.get(fromId) || []).some((neighbor) => neighbor.id === toId);
}

function extractBoundaryRings(geometry) {
  if (geometry.type === "Polygon") {
    return [geometry.coordinates[0]];
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.map((polygon) => polygon[0]);
  }

  return [];
}

function isPointInsideBoundary(lat, lng, rings = state.boundaryRings) {
  return rings.some((ring) => isPointInRing(lat, lng, ring));
}

function isPointInRing(lat, lng, ring) {
  let inside = false;

  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [xi, yi] = [ring[index][0], ring[index][1]];
    const [xj, yj] = [ring[previous][0], ring[previous][1]];

    const intersects = ((yi > lat) !== (yj > lat))
      && (lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi);

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function haversineDistance(from, to) {
  const earthRadius = 6371000;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function formatLatLng(point) {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

function setStatus(message) {
  statusText.textContent = message;
  if (!state.appReady && loadingStatusText) {
    loadingStatusText.textContent = message;
  }
}

function classifyLandmark(element, tags) {
  const coordinates = getElementCoordinates(element);
  if (!coordinates) {
    return null;
  }

  let category = null;
  let categoryLabel = "";
  let weight = 1;

  if (["school", "college", "university", "kindergarten"].includes(tags.amenity)) {
    category = "education";
    categoryLabel = "Schools / Academic Establishments";
    weight = 4.9;
  } else if (["mall", "department_store", "supermarket"].includes(tags.shop)) {
    category = "supermall";
    categoryLabel = "Supermalls";
    weight = 5.5;
  } else if (tags.amenity === "marketplace") {
    category = "market";
    categoryLabel = "Public Markets";
    weight = 5.1;
  } else if (["park", "garden", "sports_centre", "stadium"].includes(tags.leisure)) {
    category = "park";
    categoryLabel = "Parks";
    weight = 3.7;
  } else if ([
    "townhall",
    "courthouse",
    "community_centre",
    "post_office",
    "police",
    "fire_station",
    "bus_station",
    "hospital"
  ].includes(tags.amenity) || tags.office === "government" || ["transportation", "civic", "public"].includes(tags.building)) {
    category = "civic";
    categoryLabel = "Transport & Civic Centers";
    weight = 4.6;
  } else if (["attraction", "museum", "hotel"].includes(tags.tourism) || tags.building === "commercial") {
    category = "big-establishment";
    categoryLabel = "Other Big Establishments";
    weight = 4.1;
  }

  if (!category) {
    return null;
  }

  return {
    id: `${element.type}-${element.id}`,
    name: tags.name || tags.official_name || tags.brand || categoryLabel,
    category,
    categoryLabel,
    weight,
    lat: coordinates.lat,
    lng: coordinates.lng
  };
}

function getElementCoordinates(element) {
  if (typeof element.lat === "number" && typeof element.lon === "number") {
    return { lat: element.lat, lng: element.lon };
  }

  if (element.center && typeof element.center.lat === "number" && typeof element.center.lon === "number") {
    return { lat: element.center.lat, lng: element.center.lon };
  }

  return null;
}

function initializeDrivers() {
  resetMockDriverRandomState();
  state.drivers = [];
  driverLayer.clearLayers();

  const driverTypes = [
    ...Array.from({ length: DRIVER_CAR_COUNT }, () => "car"),
    ...Array.from({ length: DRIVER_MOTORCYCLE_COUNT }, () => "motorcycle")
  ];
  shuffleArray(driverTypes);

  for (let index = 0; index < DRIVER_TOTAL; index += 1) {
    const marker = L.circleMarker(INITIAL_CENTER, getDriverMarkerStyle("inactive", driverTypes[index]))
      .bindPopup("")
      .addTo(driverLayer);
    marker.on("popupopen", () => {
      const driver = state.drivers.find((candidate) => candidate.marker === marker);
      if (driver && state.viewMode === "admin") {
        refreshDriverTrafficContext(driver, { force: true });
      }
    });

    state.drivers.push({
      id: index + 1,
      type: driverTypes[index],
      status: "inactive",
      marker,
      speedKph: buildDriverSpeedKph(index + 1, driverTypes[index]),
      rating: buildDriverRating(index + 1),
      cancellationRate: buildDriverCancellationRate(index + 1),
      currentNodeId: null,
      routeNodeIds: [],
      routeSegmentIndex: 0,
      routeSegmentProgress: 0,
      movementTrafficRatio: null,
      movementTrafficSource: "",
      movementWeatherMultiplier: null,
      movementWeatherSource: "",
      movementTrafficSegmentKey: "",
      movementTrafficRefreshPending: false,
      lastMovementTrafficRefreshAt: 0,
      targetLandmarkId: null,
      targetUserNodeId: null,
      heldForOffer: false,
      resumeAfterOffer: false,
      lockedToUser: false,
      lat: INITIAL_CENTER[0],
      lng: INITIAL_CENTER[1]
    });
  }

  reconcileDriverTargets(true);
  updateDriverSummary();
}

function startDriverSimulation() {
  if (state.driverAnimationHandle) {
    cancelAnimationFrame(state.driverAnimationHandle);
  }
  if (state.driverTrafficRefreshHandle) {
    window.clearInterval(state.driverTrafficRefreshHandle);
  }

  state.lastDriverTick = null;
  const animate = (timestamp) => {
    if (state.lastDriverTick === null) {
      state.lastDriverTick = timestamp;
    }

    const deltaSeconds = Math.min((timestamp - state.lastDriverTick) / 1000, 0.25);
    state.lastDriverTick = timestamp;
    updateDriverPositions(deltaSeconds);
    state.driverAnimationHandle = requestAnimationFrame(animate);
  };

  state.driverAnimationHandle = requestAnimationFrame(animate);
  window.setInterval(() => reconcileDriverTargets(false), DRIVER_RECONCILE_INTERVAL_MS);
  refreshMovingDriverTrafficContexts();
  state.driverTrafficRefreshHandle = window.setInterval(
    () => refreshMovingDriverTrafficContexts(),
    DRIVER_TRAFFIC_REFRESH_INTERVAL_MS
  );
}

function reconcileDriverTargets(force) {
  const targets = getDriverTargets();
  const maxChanges = force ? DRIVER_TOTAL : 4;
  let changes = 0;

  while (changes < maxChanges) {
    const counts = summarizeDrivers();

    if (counts.active < targets.active) {
      const inactiveDriver = state.drivers.find((driver) => driver.status === "inactive");
      if (!inactiveDriver) {
        break;
      }

      placeDriverIntoStandby(inactiveDriver, pickWeightedLandmark());
      changes += 1;
      continue;
    }

    if (counts.active > targets.active) {
      const driverToDeactivate = findDriverToDeactivate();
      if (!driverToDeactivate) {
        break;
      }

      deactivateDriver(driverToDeactivate);
      changes += 1;
      continue;
    }

    if (counts.assigned < targets.assigned) {
      const standbyDriver = state.drivers.find((driver) => driver.status === "standby_available" && !driver.heldForOffer);
      if (!standbyDriver) {
        break;
      }

      sendDriverOnTrip(standbyDriver);
      changes += 1;
      continue;
    }

    if (counts.assigned > targets.assigned) {
      const assignedDriver = state.drivers.find((driver) => driver.status === "assigned_ontrip" && !driver.lockedToUser && !driver.heldForOffer)
        || state.drivers.find((driver) => driver.status === "assigned_pickup" && !driver.lockedToUser && !driver.heldForOffer);
      if (!assignedDriver) {
        break;
      }

      convertAssignedDriverToStandby(assignedDriver);
      changes += 1;
      continue;
    }

    if (counts.assignedPickup < targets.assignedPickup) {
      const onTripDriver = state.drivers.find((driver) => driver.status === "assigned_ontrip" && !driver.lockedToUser && !driver.heldForOffer);
      if (onTripDriver) {
        onTripDriver.status = "assigned_pickup";
        updateDriverMarker(onTripDriver);
        changes += 1;
        continue;
      }
    }

    if (counts.assignedPickup > targets.assignedPickup) {
      const pickupDriver = state.drivers.find((driver) => driver.status === "assigned_pickup" && !driver.lockedToUser && !driver.heldForOffer);
      if (pickupDriver) {
        pickupDriver.status = "assigned_ontrip";
        updateDriverMarker(pickupDriver);
        changes += 1;
        continue;
      }
    }

    if (counts.availableStandby < targets.availableStandby) {
      const movingDriver = state.drivers.find((driver) => driver.status === "moving_available" && !driver.heldForOffer);
      if (!movingDriver) {
        break;
      }

      stopDriverAtNearestNode(movingDriver);
      changes += 1;
      continue;
    }

    if (counts.availableStandby > targets.availableStandby) {
      const standbyDriver = state.drivers.find((driver) => driver.status === "standby_available" && !driver.heldForOffer);
      if (!standbyDriver) {
        break;
      }

      sendDriverToReposition(standbyDriver);
      changes += 1;
      continue;
    }

    break;
  }

  updateDriverSummary(targets);
}

function updateDriverPositions(deltaSeconds) {
  if (!deltaSeconds) {
    return;
  }

  for (const driver of state.drivers) {
    if (!isMovingDriver(driver)) {
      continue;
    }

    advanceDriverAlongRoute(driver, getDriverMoveDistanceMeters(driver, deltaSeconds));
  }

  syncMatchedDriverRoute();
}

function getDriverTargets() {
  const hourValue = getManilaHourValue();
  const segmentIndex = DRIVER_ACTIVITY_SCHEDULE.findIndex((entry, index) => {
    const nextEntry = DRIVER_ACTIVITY_SCHEDULE[index + 1];
    return nextEntry && hourValue >= entry.hour && hourValue < nextEntry.hour;
  });

  const current = DRIVER_ACTIVITY_SCHEDULE[Math.max(segmentIndex, 0)];
  const next = DRIVER_ACTIVITY_SCHEDULE[Math.min((segmentIndex >= 0 ? segmentIndex : DRIVER_ACTIVITY_SCHEDULE.length - 2) + 1, DRIVER_ACTIVITY_SCHEDULE.length - 1)];
  const span = Math.max(next.hour - current.hour, 1);
  const progress = current === next ? 0 : (hourValue - current.hour) / span;
  const active = Math.round(lerp(current.active, next.active, progress));
  const assignedMin = lerp(current.assignedMin, next.assignedMin, progress);
  const assignedMax = lerp(current.assignedMax, next.assignedMax, progress);
  const dayWave = 0.5 + 0.5 * Math.sin((hourValue / 24) * Math.PI * 2 - Math.PI / 2);
  const assignedRatio = lerp(assignedMin, assignedMax, dayWave);
  const standbyRatio = lerp(DRIVER_STANDBY_RATIO_RANGE.min, DRIVER_STANDBY_RATIO_RANGE.max, 0.5 + 0.5 * Math.cos((hourValue / 24) * Math.PI * 4));
  const assigned = Math.min(active, Math.max(0, Math.round(active * assignedRatio)));
  const available = Math.max(0, active - assigned);
  const availableStandby = Math.min(available, Math.max(0, Math.round(available * standbyRatio)));
  const assignedPickup = Math.ceil(assigned / 2);
  const assignedOnTrip = Math.max(0, assigned - assignedPickup);

  return {
    active,
    assigned,
    assignedPickup,
    assignedOnTrip,
    availableStandby,
    availableMoving: available - availableStandby
  };
}

function summarizeDrivers() {
  const counts = {
    active: 0,
    assigned: 0,
    assignedPickup: 0,
    assignedOnTrip: 0,
    availableStandby: 0,
    availableMoving: 0,
    inactive: 0,
    cars: 0,
    motorcycles: 0
  };

  for (const driver of state.drivers) {
    if (driver.type === "car") {
      counts.cars += 1;
    } else {
      counts.motorcycles += 1;
    }

    switch (driver.status) {
      case "inactive":
        counts.inactive += 1;
        break;
      case "standby_available":
        counts.active += 1;
        counts.availableStandby += 1;
        break;
      case "moving_available":
        counts.active += 1;
        counts.availableMoving += 1;
        break;
      case "assigned_pickup":
        counts.active += 1;
        counts.assigned += 1;
        counts.assignedPickup += 1;
        break;
      case "assigned_ontrip":
        counts.active += 1;
        counts.assigned += 1;
        counts.assignedOnTrip += 1;
        break;
      default:
        break;
    }
  }

  return counts;
}

function updateDriverSummary(targets = getDriverTargets()) {
  const counts = summarizeDrivers();
  if (driverSummaryText) {
    driverSummaryText.textContent = `${counts.active} active now: ${counts.availableStandby} standby, ${counts.availableMoving} repositioning, ${counts.assignedPickup} going to passenger, ${counts.assignedOnTrip} on-trip`;
  }
  if (driverBreakdownText) {
    driverBreakdownText.textContent = `Target now: ${targets.active} active. 60 cars, 40 motorcycles.`;
  }
  updateMapLegend();
}

function findDriverToDeactivate() {
  return state.drivers.find((driver) => driver.status === "standby_available" && !driver.lockedToUser && !driver.heldForOffer)
    || state.drivers.find((driver) => driver.status === "moving_available" && !driver.lockedToUser && !driver.heldForOffer)
    || state.drivers.find((driver) => driver.status === "assigned_ontrip" && !driver.lockedToUser && !driver.heldForOffer)
    || state.drivers.find((driver) => driver.status === "assigned_pickup" && !driver.lockedToUser && !driver.heldForOffer);
}

function deactivateDriver(driver) {
  driver.status = "inactive";
  driver.routeNodeIds = [];
  driver.routeSegmentIndex = 0;
  driver.routeSegmentProgress = 0;
  driver.targetLandmarkId = null;
  driver.targetUserNodeId = null;
  driver.heldForOffer = false;
  driver.resumeAfterOffer = false;
  driver.lockedToUser = false;
  clearDriverMovementContext(driver);
  updateDriverMarker(driver);
}

function placeDriverIntoStandby(driver, landmark) {
  const targetLandmark = landmark || pickWeightedLandmark();
  if (!targetLandmark) {
    return;
  }

  const node = state.nodeIndex.get(targetLandmark.nodeId);
  if (!node) {
    return;
  }

  driver.status = "standby_available";
  driver.currentNodeId = node.id;
  driver.routeNodeIds = [];
  driver.routeSegmentIndex = 0;
  driver.routeSegmentProgress = 0;
  driver.targetLandmarkId = targetLandmark.id;
  driver.targetUserNodeId = null;
  driver.heldForOffer = false;
  driver.resumeAfterOffer = false;
  driver.lockedToUser = false;
  clearDriverMovementContext(driver);
  driver.lat = node.lat;
  driver.lng = node.lng;
  updateDriverMarker(driver);
}

function sendDriverToReposition(driver) {
  assignDriverRoute(driver, "moving_available");
}

function sendDriverOnTrip(driver) {
  const counts = summarizeDrivers();
  const targets = getDriverTargets();
  const nextStatus = counts.assignedPickup < targets.assignedPickup
    ? "assigned_pickup"
    : "assigned_ontrip";
  assignDriverRoute(driver, nextStatus);
}

function convertAssignedDriverToStandby(driver) {
  stopDriverAtNearestNode(driver);
}

function stopDriverAtNearestNode(driver) {
  const node = getDriverRouteStartNode(driver);

  if (!node) {
    deactivateDriver(driver);
    return;
  }

  driver.status = "standby_available";
  driver.currentNodeId = node.id;
  driver.routeNodeIds = [];
  driver.routeSegmentIndex = 0;
  driver.routeSegmentProgress = 0;
  driver.targetLandmarkId = null;
  driver.targetUserNodeId = null;
  driver.heldForOffer = false;
  driver.resumeAfterOffer = false;
  driver.lockedToUser = false;
  clearDriverMovementContext(driver);
  driver.lat = node.lat;
  driver.lng = node.lng;
  updateDriverMarker(driver);
}

function assignDriverRoute(driver, status) {
  const originNodeId = driver.currentNodeId || pickWeightedLandmark()?.nodeId;
  if (!originNodeId) {
    return;
  }

  const destination = pickWeightedLandmark(originNodeId);
  if (!destination) {
    placeDriverIntoStandby(driver, pickWeightedLandmark());
    return;
  }

  const path = getPathBetweenNodes(originNodeId, destination.nodeId);
  if (!path || path.nodeIds.length < 2) {
    placeDriverIntoStandby(driver, destination);
    return;
  }

  const originNode = state.nodeIndex.get(originNodeId);
  driver.status = status;
  driver.currentNodeId = originNodeId;
  driver.routeNodeIds = path.nodeIds;
  driver.routeSegmentIndex = 0;
  driver.routeSegmentProgress = 0;
  driver.targetLandmarkId = destination.id;
  driver.targetUserNodeId = null;
  driver.heldForOffer = false;
  driver.resumeAfterOffer = false;
  driver.lockedToUser = false;
  clearDriverMovementContext(driver);
  driver.lat = originNode.lat;
  driver.lng = originNode.lng;
  updateDriverMarker(driver);
}

function clearDriverMovementContext(driver) {
  driver.movementTrafficRatio = null;
  driver.movementTrafficSource = "";
  driver.movementWeatherMultiplier = null;
  driver.movementWeatherSource = "";
  driver.movementTrafficSegmentKey = "";
  driver.movementTrafficRefreshPending = false;
  driver.lastMovementTrafficRefreshAt = 0;
}

function advanceDriverAlongRoute(driver, moveDistanceMeters) {
  while (moveDistanceMeters > 0 && driver.routeSegmentIndex < driver.routeNodeIds.length - 1) {
    const fromNodeId = driver.routeNodeIds[driver.routeSegmentIndex];
    const toNodeId = driver.routeNodeIds[driver.routeSegmentIndex + 1];
    const fromNode = state.nodeIndex.get(fromNodeId);
    const toNode = state.nodeIndex.get(toNodeId);

    if (!fromNode || !toNode) {
      break;
    }

    const segmentDistance = haversineDistance(fromNode, toNode);
    const remainingSegmentDistance = segmentDistance - driver.routeSegmentProgress;

    if (moveDistanceMeters >= remainingSegmentDistance) {
      moveDistanceMeters -= remainingSegmentDistance;
      driver.routeSegmentIndex += 1;
      driver.routeSegmentProgress = 0;
      driver.currentNodeId = toNode.id;
      driver.lat = toNode.lat;
      driver.lng = toNode.lng;
      scheduleDriverSegmentTrafficRefresh(driver);
      continue;
    }

    driver.routeSegmentProgress += moveDistanceMeters;
    const progress = segmentDistance ? driver.routeSegmentProgress / segmentDistance : 1;
    driver.lat = lerp(fromNode.lat, toNode.lat, progress);
    driver.lng = lerp(fromNode.lng, toNode.lng, progress);
    moveDistanceMeters = 0;
  }

  if (driver.routeSegmentIndex >= driver.routeNodeIds.length - 1) {
    handleDriverArrival(driver);
  }

  updateDriverMarker(driver);
}

function scheduleDriverSegmentTrafficRefresh(driver) {
  if (!isMovingDriver(driver)) {
    return;
  }

  const segmentKey = getDriverCurrentSegmentKey(driver);
  if (!segmentKey || driver.movementTrafficSegmentKey === segmentKey) {
    return;
  }

  const now = Date.now();
  if (driver.movementTrafficRefreshPending || now - (driver.lastMovementTrafficRefreshAt || 0) < DRIVER_SEGMENT_TRAFFIC_REFRESH_COOLDOWN_MS) {
    return;
  }

  refreshDriverTrafficContext(driver, { segmentKey });
}

function handleDriverArrival(driver) {
  if (driver.lockedToUser && state.ridePhase === "driver_to_pickup") {
    const tripPath = state.pendingDriverOffer?.tripPath || (state.userPoint && state.dropoffPoint
      ? getPathBetweenNodes(state.userPoint.id, state.dropoffPoint.id)
      : null);

    if (tripPath && state.dropoffPoint && state.userPoint) {
      driver.status = "assigned_ontrip";
      driver.currentNodeId = state.userPoint.id;
      driver.routeNodeIds = tripPath.nodeIds;
      driver.routeSegmentIndex = 0;
      driver.routeSegmentProgress = 0;
      driver.targetUserNodeId = state.dropoffPoint.id;
      driver.lat = state.userPoint.lat;
      driver.lng = state.userPoint.lng;
      applyHeuristicMovementTraffic(driver, tripPath.distance);
      state.ridePhase = "on_trip";
      state.userPanelTab = "trip";
      routeText.textContent = `On-trip: ${(tripPath.distance / 1000).toFixed(2)} km remaining`;
      routeTrafficText.textContent = "Route traffic: drop-off leg is now active";
      driverTrafficText.textContent = `Driver ${driver.id} picked you up and is now taking you to the drop-off`;
      updateOfferCard("On-trip now", "Pickup complete. Your driver is now carrying you to the drop-off point.");
      loadRouteTrafficSummary(tripPath.nodeIds, driver, tripPath.distance);
      setStatus(`Driver ${driver.id} picked you up. Heading to your drop-off point now.`);
      updateDriverMarker(driver);
      updateMapLegend();
      updateRequestUI();
      return;
    }
  }

  if (driver.lockedToUser && state.ridePhase === "on_trip") {
    const dropoffNode = state.dropoffPoint;
    state.selectedDriverId = null;
    state.ridePhase = "idle";
    state.pendingDriverOffer = null;
    routeLayer.clearLayers();
    routeText.textContent = "Ride complete";
    routeTrafficText.textContent = "Route traffic: trip complete";
    bestDriverText.textContent = `Driver ${driver.id} completed your ride`;
    driverTrafficText.textContent = "Trip finished. You can start a new request anytime.";
    state.userPanelTab = "trip";
    updateOfferCard("Ride complete", "Your driver reached the drop-off point. Set a new pickup to request another ride.");
    setStatus(`Driver ${driver.id} reached your drop-off point.`);
    driver.lockedToUser = false;
    placeDriverIntoStandby(driver, dropoffNode ? {
      id: "dropoff-location",
      name: "Your Drop-off",
      category: "dropoff",
      categoryLabel: "Drop-off Point",
      weight: 1,
      lat: dropoffNode.lat,
      lng: dropoffNode.lng,
      nodeId: dropoffNode.id
    } : pickWeightedLandmark());
    updateMapLegend();
    updateRequestUI();
    return;
  }

  const landmark = getLandmarkById(driver.targetLandmarkId);
  if (driver.status === "assigned_pickup") {
    assignDriverRoute(driver, "assigned_ontrip");
    updateMapLegend();
    return;
  }

  if (driver.status === "assigned_ontrip") {
    placeDriverIntoStandby(driver, landmark || pickWeightedLandmark());
    updateMapLegend();
    return;
  }

  if (driver.status === "moving_available") {
    placeDriverIntoStandby(driver, landmark || pickWeightedLandmark());
    updateMapLegend();
  }
}

function pickWeightedLandmark(excludeNodeId = null) {
  let candidates = state.landmarks.filter((landmark) => landmark.nodeId !== excludeNodeId);
  if (excludeNodeId) {
    const originNode = state.nodeIndex.get(excludeNodeId);
    const nearbyCandidates = originNode
      ? candidates.filter((landmark) => haversineDistance(originNode, landmark) <= LANDMARK_SEARCH_RADIUS_METERS)
      : [];

    if (nearbyCandidates.length) {
      candidates = nearbyCandidates;
    }
  }

  if (!candidates.length) {
    return null;
  }

  const totalWeight = candidates.reduce((sum, landmark) => sum + landmark.weight, 0);
  let threshold = getMockDriverRandomValue() * totalWeight;

  for (const landmark of candidates) {
    threshold -= landmark.weight;
    if (threshold <= 0) {
      return landmark;
    }
  }

  return candidates[candidates.length - 1];
}

function getLandmarkById(landmarkId) {
  return state.landmarks.find((landmark) => landmark.id === landmarkId) || null;
}

function getDriverMarkerStyle(status, type, isSelected = false) {
  const isCar = type === "car";
  const baseRadius = isCar ? 7 : 5;
  const outlineColor = isSelected ? "#7a4d00" : "#ffffff";
  const outlineWeight = isSelected ? 3 : 1.5;
  const selectedFillColor = "#ffd166";
  const hideForUserPrivacy = state.viewMode === "user" && !isSelected;

  if (hideForUserPrivacy) {
    return {
      radius: baseRadius,
      color: outlineColor,
      weight: 1,
      opacity: 0,
      fillColor: "#ffffff",
      fillOpacity: 0
    };
  }

  if (status === "inactive") {
    return {
      radius: baseRadius,
      color: outlineColor,
      weight: 1,
      opacity: 0,
      fillColor: "#ffffff",
      fillOpacity: 0
    };
  }

  if (isSelected) {
    return {
      radius: baseRadius + 1,
      color: outlineColor,
      weight: outlineWeight,
      opacity: 1,
      fillColor: selectedFillColor,
      fillOpacity: 0.95
    };
  }

  if (status === "assigned_pickup") {
    return {
      radius: baseRadius,
      color: outlineColor,
      weight: outlineWeight,
      opacity: 1,
      fillColor: "#f4a261",
      fillOpacity: 0.92
    };
  }

  if (status === "assigned_ontrip") {
    return {
      radius: baseRadius,
      color: outlineColor,
      weight: outlineWeight,
      opacity: 1,
      fillColor: "#d1495b",
      fillOpacity: 0.95
    };
  }

  return {
    radius: baseRadius,
    color: outlineColor,
    weight: outlineWeight,
    opacity: 1,
    fillColor: "#0b8f65",
    fillOpacity: status === "moving_available" ? 0.9 : 0.75
  };
}

function getBaselineDriverMarkerStyle(driver) {
  const isCar = driver?.type === "car";
  return {
    radius: isCar ? 11 : 9,
    color: "#2563eb",
    weight: 3,
    opacity: 0.95,
    fillColor: "#ffffff",
    fillOpacity: 0.08,
    dashArray: "5 3"
  };
}

function removeBaselineDriverMarker() {
  if (!state.baselineDriverMarker) {
    return;
  }

  markerLayer.removeLayer(state.baselineDriverMarker);
  state.baselineDriverMarker = null;
}

function syncBaselineDriverMarker() {
  removeBaselineDriverMarker();
}

function buildBaselineDriverPopup(driver) {
  const baselineDistanceMeters = state.baselineNearestSuggestion?.directDistanceMeters;
  const baselineDistanceText = typeof baselineDistanceMeters === "number"
    ? `${(baselineDistanceMeters / 1000).toFixed(2)} km straight-line`
    : "Distance unavailable";
  return `<strong>Baseline driver</strong><br>Driver ${driver.id}<br>${baselineDistanceText}`;
}

function updateDriverMarker(driver) {
  driver.marker.setLatLng([driver.lat, driver.lng]);
  driver.marker.setStyle(getDriverMarkerStyle(driver.status, driver.type, driver.id === state.selectedDriverId));
  driver.marker.setPopupContent(buildDriverPopup(driver));
  if (state.viewMode === "user" && driver.id !== state.selectedDriverId) {
    driver.marker.closePopup();
  }
  if (state.baselineNearestSuggestion?.driverId === driver.id) {
    syncBaselineDriverMarker();
  }
}

function buildDriverPopup(driver) {
  const stateLabelMap = {
    inactive: "Inactive",
    standby_available: "Available standby",
    moving_available: "Available moving",
    assigned_pickup: "Going to passenger",
    assigned_ontrip: "On-trip with passenger"
  };

  const landmark = getLandmarkById(driver.targetLandmarkId);
  const selectedText = driver.id === state.selectedDriverId
    ? `<br>${driver.lockedToUser ? "Matched to you" : "Suggested to you"}`
    : "";
  const baselineText = driver.id === state.baselineNearestSuggestion?.driverId
    ? "<br>Baseline driver (straight-line nearest)"
    : "";
  const landmarkText = landmark ? `<br>Target: ${landmark.name}` : "";
  const movementSpeedText = state.viewMode === "admin"
    ? `<br>Movement speed: ${formatDriverMovementSpeed(driver)}`
    : "";
  return `<strong>Driver ${driver.id}</strong><br>${driver.type === "car" ? "Car" : "Motorcycle"}<br>${stateLabelMap[driver.status] || driver.status}${selectedText}${baselineText}${landmarkText}${movementSpeedText}`;
}

function formatDriverMovementSpeed(driver) {
  if (!isMovingDriver(driver)) {
    return "Stopped";
  }

  const remainingDistance = getDriverRemainingDistance(driver);
  const effectiveSpeedKph = getEffectiveDriverSpeedKph(driver, remainingDistance);
  const sourceLabel = driver.movementTrafficSource === "tomtom_live"
    ? "TomTom live traffic + weather"
    : "traffic estimate + weather";
  return `${effectiveSpeedKph.toFixed(1)} km/h (${sourceLabel})`;
}

function isMovingDriver(driver) {
  return driver.status === "moving_available"
    || driver.status === "assigned_pickup"
    || driver.status === "assigned_ontrip";
}

function getManilaHourValue() {
  const timeParts = new Intl.DateTimeFormat("en-US", {
    timeZone: OLONGAPO_TIMEZONE,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23"
  }).formatToParts(new Date());

  const parts = Object.fromEntries(
    timeParts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  return parts.hour + (parts.minute / 60) + (parts.second / 3600);
}

function lerp(start, end, amount) {
  return start + ((end - start) * amount);
}

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function resetMockDriverRandomState() {
  mockDriverRandomState = MOCK_DRIVER_RANDOM_SEED;
}

function getMockDriverRandomValue() {
  mockDriverRandomState = (Math.imul(mockDriverRandomState, 1664525) + 1013904223) >>> 0;
  return mockDriverRandomState / 0x100000000;
}

function getSeededUnitValue(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function buildDriverSpeedKph(driverId, type) {
  const baseSpeed = type === "car" ? 24 : 28;
  return baseSpeed + Math.round(getSeededUnitValue(driverId + 101) * 6);
}

function buildDriverRating(driverId) {
  return 4 + (getSeededUnitValue(driverId + 401) * 0.95);
}

function buildDriverCancellationRate(driverId) {
  return 0.02 + (getSeededUnitValue(driverId + 509) * 0.18);
}

function formatCancellationRisk(cancellationRate) {
  if (cancellationRate <= 0.06) {
    return "low";
  }

  if (cancellationRate <= 0.12) {
    return "medium";
  }

  return "high";
}

function formatWeatherScoreLabel(weatherMultiplier) {
  if (weatherMultiplier <= 1.02) {
    return "minimal";
  }

  if (weatherMultiplier <= 1.12) {
    return "light";
  }

  if (weatherMultiplier <= 1.22) {
    return "moderate";
  }

  return "strong";
}

function describeWeatherSource(source) {
  if (source === "open_meteo_live") {
    return "Open-Meteo live weather";
  }
  return "fallback because live weather was unavailable";
}

function describeMovementBehavior(driver, movementScore) {
  if (driver.status === "standby_available") {
    return "stable standby positioning";
  }

  if (movementScore >= 0.95) {
    return "movement already trending toward the pickup";
  }

  return "movement direction less favorable than the top candidates";
}

function shuffleArray(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(getMockDriverRandomValue() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }

  return items;
}

function startClock() {
  renderClock();
  window.setInterval(renderClock, 1000);
}

function renderClock() {
  const formatter = new Intl.DateTimeFormat("en-PH", {
    timeZone: OLONGAPO_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "medium"
  });

  if (timeText) {
    timeText.textContent = formatter.format(new Date());
  }
}

async function loadWeather(boundary) {
  if (state.usingPythonBackend) {
    try {
      const response = await fetch("/api/weather", {
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`Weather request failed with ${response.status}`);
      }

      const payload = await response.json();
      applyWeatherPayload(payload);
    } catch (error) {
      console.error(error);
      state.weatherContext = {
        label: "Weather unavailable right now.",
        multiplier: 1,
        raw: null,
        source: "weather_fallback",
        notice: "Weather source: fallback because live weather was unavailable."
      };
      setWeatherText("Weather unavailable right now.");
    }

    return;
  }

  const latitude = boundary
    ? (Number(boundary.boundingbox[0]) + Number(boundary.boundingbox[1])) / 2
    : state.centerPoint.lat;
  const longitude = boundary
    ? (Number(boundary.boundingbox[2]) + Number(boundary.boundingbox[3])) / 2
    : state.centerPoint.lng;
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day",
    timezone: OLONGAPO_TIMEZONE
  });

  try {
    const response = await fetch(`${OPEN_METEO_URL}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Weather request failed with ${response.status}`);
    }

    const payload = await response.json();
    const current = payload.current;
    if (!current) {
      throw new Error("Weather payload missing current data.");
    }

    const weatherLabel = describeWeatherCode(current.weather_code, current.is_day);
    state.weatherContext = buildWeatherContext(current, weatherLabel);
    if (weatherText) {
      weatherText.textContent = `${weatherLabel}, ${Math.round(current.temperature_2m)} deg C, feels like ${Math.round(current.apparent_temperature)} deg C, wind ${Math.round(current.wind_speed_10m)} km/h`;
    }
  } catch (error) {
    console.error(error);
    state.weatherContext = {
      label: "Weather unavailable right now.",
      multiplier: 1,
      raw: null,
      source: "weather_fallback",
      notice: "Weather source: fallback because live weather was unavailable."
    };
    setWeatherText("Weather unavailable right now.");
  }
}

function applyWeatherPayload(payload) {
  if (!payload?.raw) {
    state.weatherContext = {
      label: payload?.summary || "Weather unavailable right now.",
      multiplier: 1,
      raw: null,
      source: payload?.source || "weather_fallback",
      notice: payload?.source === "open_meteo_live"
        ? "Weather source: Open-Meteo live weather."
        : "Weather source: fallback because live weather was unavailable."
    };
    setWeatherText(payload?.summary || "Weather unavailable right now.");
    return;
  }

  const weatherLabel = describeWeatherCode(payload.raw.weather_code, payload.raw.is_day);
  state.weatherContext = buildWeatherContext(payload.raw, weatherLabel, payload.source || "open_meteo_live");
  setWeatherText(payload.summary || "Weather unavailable right now.");
}

function buildWeatherContext(current, weatherLabel, source = "open_meteo_live") {
  let multiplier = 1;

  if ((current.precipitation || 0) >= 5) {
    multiplier += 0.2;
  } else if ((current.precipitation || 0) > 0) {
    multiplier += 0.1;
  }

  if ((current.wind_speed_10m || 0) >= 30) {
    multiplier += 0.08;
  }

  if ([65, 67, 81, 82, 95, 96, 99].includes(current.weather_code)) {
    multiplier += 0.18;
  } else if ([61, 63, 80].includes(current.weather_code)) {
    multiplier += 0.1;
  } else if ([45, 48, 51, 53, 55].includes(current.weather_code)) {
    multiplier += 0.06;
  }

  return {
    label: weatherLabel,
    multiplier,
    raw: current,
    source,
    notice: source === "open_meteo_live"
      ? "Weather source: Open-Meteo live weather."
      : "Weather source: fallback because live weather was unavailable."
  };
}

function setWeatherText(message) {
  if (weatherText) {
    weatherText.textContent = message;
  }
}

async function refreshMovingDriverTrafficContexts() {
  if (state.isRefreshingDriverTraffic) {
    return;
  }

  const movingDrivers = state.drivers.filter(isMovingDriver);
  if (!movingDrivers.length) {
    return;
  }

  const batch = getDriverTrafficRefreshBatch(movingDrivers);
  state.isRefreshingDriverTraffic = true;

  try {
    await refreshDriverTrafficContextBatch(batch);
  } catch (error) {
    console.warn("Driver traffic refresh unavailable, using heuristic movement traffic.", error);
    for (const driver of batch) {
      applyHeuristicMovementTraffic(driver);
    }
  } finally {
    state.isRefreshingDriverTraffic = false;
  }
}

async function refreshDriverTrafficContext(driver, options = {}) {
  if (!isMovingDriver(driver) || driver.movementTrafficRefreshPending) {
    return;
  }

  driver.movementTrafficRefreshPending = true;
  try {
    await refreshDriverTrafficContextBatch([driver], options);
  } finally {
    driver.movementTrafficRefreshPending = false;
  }
}

async function refreshDriverTrafficContextBatch(drivers, options = {}) {
  const entries = drivers
    .filter((driver) => isMovingDriver(driver))
    .map((driver) => ({
      driver,
      routeKey: driver.routeNodeIds.join("|"),
      segmentKey: options.segmentKey || getDriverCurrentSegmentKey(driver),
      force: Boolean(options.force),
      sample: {
        nodeId: getDriverTrafficSampleNodeId(driver),
        lat: driver.lat,
        lng: driver.lng,
        nearbyCandidateLimit: DRIVER_TRAFFIC_NEARBY_CANDIDATES
      }
    }));

  if (!entries.length) {
    return;
  }

  if (!state.usingPythonBackend || !state.backendSupportsTrafficProxy) {
    for (const entry of entries) {
      applyHeuristicMovementTraffic(entry.driver, null, entry.routeKey, entry.segmentKey);
    }
    return;
  }

  const results = await fetchTrafficSamplesFromBackend(entries.map((entry) => entry.sample));
  entries.forEach((entry, index) => {
    const result = results[index];
    if (result?.traffic) {
      applyLiveMovementTraffic(entry.driver, getTrafficRatioFromSegment(result.traffic), entry.routeKey, entry.segmentKey);
      return;
    }

    applyHeuristicMovementTraffic(entry.driver, null, entry.routeKey, entry.segmentKey);
  });
}

function getDriverTrafficRefreshBatch(movingDrivers) {
  const batchSize = Math.min(DRIVER_TRAFFIC_REFRESH_BATCH_SIZE, movingDrivers.length);
  const startIndex = state.driverTrafficRefreshCursor % movingDrivers.length;
  const batch = [];

  for (let index = 0; index < batchSize; index += 1) {
    batch.push(movingDrivers[(startIndex + index) % movingDrivers.length]);
  }

  state.driverTrafficRefreshCursor = (startIndex + batchSize) % movingDrivers.length;
  return batch;
}

function getDriverTrafficSampleNodeId(driver) {
  return driver.currentNodeId
    || driver.routeNodeIds[driver.routeSegmentIndex]
    || driver.routeNodeIds[driver.routeSegmentIndex + 1]
    || null;
}

function getDriverCurrentSegmentKey(driver) {
  if (!driver) {
    return "";
  }

  const fromNodeId = driver.routeNodeIds[driver.routeSegmentIndex];
  const toNodeId = driver.routeNodeIds[driver.routeSegmentIndex + 1];
  return fromNodeId && toNodeId ? `${fromNodeId}->${toNodeId}` : "";
}

async function loadTrafficForPoint(pointLabel, node) {
  const target = pointLabel === "user"
    ? userTrafficText
    : pointLabel === "dropoff"
      ? dropoffTrafficText
      : driverTrafficText;

  if (!node) {
    applyTrafficSourceTone(target);
    target.textContent = "Traffic: unavailable for this point";
    return;
  }

  applyTrafficSourceTone(target);
  target.textContent = "Traffic: loading...";

  try {
    const result = await fetchTrafficForNode(node, TRAFFIC_POINT_NEARBY_CANDIDATES);
    if (!result?.traffic) {
      applyTrafficSourceTone(target, result?.source || "");
      target.textContent = result?.source === "heuristic_fallback"
        ? "Traffic: estimated conditions near this road right now"
        : "Traffic: unavailable near this road right now";
      return;
    }
    applyTrafficSourceTone(target, result?.source || "");
    target.textContent = formatTrafficLookupResult(result, node);
  } catch (error) {
    console.error(error);
    applyTrafficSourceTone(target);
    target.textContent = `Traffic: ${error.message || "unavailable for this point"}`;
  }
}

async function loadRouteTrafficSummary(nodeIds, movementDriver = null, routeDistanceMeters = null) {
  applyTrafficSourceTone(routeTrafficText);
  routeTrafficText.textContent = "Route traffic: loading...";
  const routeKey = nodeIds.join("|");

  const sampleIds = sampleRouteNodeIds(nodeIds, 6);
  const sampleNodes = sampleIds
    .map((nodeId) => state.nodeIndex.get(nodeId))
    .filter(Boolean);

  if (!sampleNodes.length) {
    applyTrafficSourceTone(routeTrafficText);
    routeTrafficText.textContent = "Route traffic: unavailable near this route right now";
    applyHeuristicMovementTraffic(movementDriver, routeDistanceMeters, routeKey, getDriverCurrentSegmentKey(movementDriver));
    return;
  }

  const results = await fetchTrafficSamplesFromBackend(
    sampleNodes.map((node) => ({
      nodeId: node.id,
      lat: node.lat,
      lng: node.lng,
      nearbyCandidateLimit: TRAFFIC_ROUTE_NEARBY_CANDIDATES
    }))
  );

  const validSamples = results
    .filter((result) => result?.traffic)
    .map((result) => result.traffic);

  if (!validSamples.length) {
    applyTrafficSourceTone(routeTrafficText, "heuristic_fallback");
    routeTrafficText.textContent = "Route traffic: estimated conditions right now";
    applyHeuristicMovementTraffic(movementDriver, routeDistanceMeters, routeKey, getDriverCurrentSegmentKey(movementDriver));
    return;
  }

  const averageRatio = validSamples.reduce((sum, sample) => {
    const freeFlow = Math.max(sample.freeFlowSpeed, 1);
    return sum + sample.currentSpeed / freeFlow;
  }, 0) / validSamples.length;

  const failedSamples = results.length - validSamples.length;
  const failureSuffix = failedSamples ? `, ${failedSamples} sample(s) failed` : "";
  applyTrafficSourceTone(routeTrafficText, "tomtom_live");
  routeTrafficText.textContent = `Route traffic: ${describeTrafficRatio(averageRatio)} from ${validSamples.length} live road samples${failureSuffix}.`;
  applyLiveMovementTraffic(movementDriver, averageRatio, routeKey, getDriverCurrentSegmentKey(movementDriver));
}

function applyLiveMovementTraffic(driver, trafficRatio, routeKey = "", segmentKey = "") {
  if (!isMovementContextStillActive(driver, routeKey)) {
    return;
  }

  driver.movementTrafficRatio = clampValue(trafficRatio, 0.15, 1);
  driver.movementTrafficSource = "tomtom_live";
  driver.movementWeatherMultiplier = state.weatherContext?.multiplier || driver.movementWeatherMultiplier || 1;
  driver.movementWeatherSource = state.weatherContext?.source || driver.movementWeatherSource || "weather_fallback";
  driver.movementTrafficSegmentKey = segmentKey || getDriverCurrentSegmentKey(driver);
  driver.lastMovementTrafficRefreshAt = Date.now();
  updateDriverMarker(driver);
}

function applyHeuristicMovementTraffic(driver, routeDistanceMeters = null, routeKey = "", segmentKey = "") {
  if (!isMovementContextStillActive(driver, routeKey)) {
    return;
  }

  const weatherMultiplier = state.weatherContext?.multiplier || driver.movementWeatherMultiplier || 1;
  const distanceMeters = typeof routeDistanceMeters === "number"
    ? routeDistanceMeters
    : getDriverRemainingDistance(driver);
  driver.movementTrafficRatio = estimateHeuristicTrafficRatio(distanceMeters, weatherMultiplier);
  driver.movementTrafficSource = "heuristic_fallback";
  driver.movementWeatherMultiplier = weatherMultiplier;
  driver.movementWeatherSource = state.weatherContext?.source || driver.movementWeatherSource || "weather_fallback";
  driver.movementTrafficSegmentKey = segmentKey || getDriverCurrentSegmentKey(driver);
  driver.lastMovementTrafficRefreshAt = Date.now();
  updateDriverMarker(driver);
}

function isMovementContextStillActive(driver, routeKey = "") {
  if (!driver) {
    return false;
  }

  return !routeKey || driver.routeNodeIds.join("|") === routeKey;
}

function sampleRouteNodeIds(nodeIds, maxSamples) {
  if (nodeIds.length <= maxSamples) {
    return nodeIds;
  }

  const sampled = [];
  const step = (nodeIds.length - 1) / (maxSamples - 1);
  for (let index = 0; index < maxSamples; index += 1) {
    sampled.push(nodeIds[Math.round(index * step)]);
  }

  return [...new Set(sampled)];
}

async function fetchTrafficSegment(node) {
  const result = await fetchTrafficForNode(node, 0);
  return result?.traffic || null;
}

async function fetchTrafficForNode(node, nearbyCandidateLimit = 0) {
  if (!node) {
    return null;
  }

  const cacheKey = `${node.id}:${nearbyCandidateLimit}`;
  if (state.trafficCache.has(cacheKey)) {
    return state.trafficCache.get(cacheKey);
  }

  const request = fetchTrafficSamplesFromBackend([
    {
      nodeId: node.id,
      lat: node.lat,
      lng: node.lng,
      nearbyCandidateLimit
    }
  ]).then((results) => results[0] || null);

  state.trafficCache.set(cacheKey, request);
  return request;
}

async function fetchTrafficSamplesFromBackend(samples) {
  if (!samples.length) {
    return [];
  }

  if (!state.usingPythonBackend || !state.backendSupportsTrafficProxy) {
    return samples.map(() => ({
      traffic: null,
      source: "heuristic_fallback",
      notice: "Traffic source: heuristic fallback because live traffic was unavailable."
    }));
  }

  let response;
  try {
    response = await fetch("/api/traffic-samples", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ samples })
    });
  } catch (error) {
    state.backendSupportsTrafficProxy = false;
    return samples.map(() => ({
      traffic: null,
      source: "heuristic_fallback",
      notice: "Traffic source: heuristic fallback because live traffic was unavailable."
    }));
  }

  if (response.status === 404) {
    state.backendSupportsTrafficProxy = false;
    return samples.map(() => ({
      traffic: null,
      source: "heuristic_fallback",
      notice: "Traffic source: heuristic fallback because live traffic was unavailable."
    }));
  }

  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }
    throw new Error(payload?.error || `traffic request failed with ${response.status}`);
  }

  const payload = await response.json();
  state.backendSupportsTrafficProxy = true;
  return Array.isArray(payload?.samples) ? payload.samples : [];
}

function formatTrafficSummary(traffic) {
  if (!traffic) {
    return "Traffic: unavailable";
  }

  const ratio = traffic.currentSpeed / Math.max(traffic.freeFlowSpeed, 1);
  if (traffic.roadClosure) {
    return `Traffic: road closed, reported ${traffic.currentSpeed}/${traffic.freeFlowSpeed} km/h, confidence ${Math.round((traffic.confidence || 0) * 100)}%`;
  }
  return `Traffic: ${traffic.currentSpeed}/${traffic.freeFlowSpeed} km/h, ${describeTrafficRatio(ratio)}, confidence ${Math.round((traffic.confidence || 0) * 100)}%`;
}

function applyTrafficSourceTone(element, source = "") {
  if (!element) {
    return;
  }

  element.classList.remove("traffic-source-live", "traffic-source-fallback");
  if (source === "tomtom_live") {
    element.classList.add("traffic-source-live");
  } else if (source === "heuristic_fallback") {
    element.classList.add("traffic-source-fallback");
  }
}

function formatTrafficLookupResult(result, originNode) {
  const summary = formatTrafficSummary(result.traffic);
  const matchedTarget = result.matchedNode || result.matchedPoint || null;
  if (!matchedTarget || result.matchedNode?.id === originNode.id) {
    return summary;
  }

  const fallbackDistance = haversineDistance(originNode, matchedTarget);
  return `${summary}, nearby segment ${Math.round(fallbackDistance)} m away.`;
}

function isRetryableTrafficError(error) {
  const message = error?.message || "";
  return isTrafficPointMissError(error)
    || message.includes("no traffic segment returned for this point");
}

function isTrafficPointMissError(error) {
  const message = error?.message || "";
  return message.includes("Point too far from nearest existing segment");
}

function isTrafficCoverageUnavailableError(error) {
  if (!error) {
    return false;
  }

  const message = error?.message || "";
  return isTrafficPointMissError(error)
    || message.includes("no traffic segment returned for this point");
}

function describeTrafficRatio(ratio) {
  if (ratio >= 0.85) {
    return "free flowing";
  }

  if (ratio >= 0.6) {
    return "moderate";
  }

  if (ratio >= 0.35) {
    return "slow";
  }

  return "heavy";
}

function describeTrafficSource(source) {
  if (source === "tomtom_live") {
    return "TomTom live traffic";
  }
  return "heuristic fallback because live traffic was unavailable";
}

function describeWeatherCode(code, isDay = 1) {
  const weatherCodes = {
    0: isDay ? "Sunny" : "Clear night",
    1: isDay ? "Mostly sunny" : "Mostly clear night",
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
    99: "Severe thunderstorm with hail"
  };

  return weatherCodes[code] || "Unknown weather";
}

// ─── Heatmap Time Slider and Peak Hour Indicators ───────────────────────────

/**
 * Format an hour (0-23) into 12-hour format with AM/PM.
 * e.g., 0 → "12:00 AM", 6 → "6:00 AM", 12 → "12:00 PM", 17 → "5:00 PM"
 */
function formatHour(hour) {
  if (hour === 0) return "12:00 AM";
  if (hour < 12) return `${hour}:00 AM`;
  if (hour === 12) return "12:00 PM";
  return `${hour - 12}:00 PM`;
}

/**
 * Return a peak label for the given hour.
 * Hours 6, 7, 8 → "Morning Peak"
 * Hours 17, 18, 19 → "Evening Peak"
 * All other hours → "" (empty string)
 */
function getPeakLabel(hour) {
  if (hour >= 6 && hour <= 8) return "Morning Peak";
  if (hour >= 17 && hour <= 19) return "Evening Peak";
  return "";
}

/**
 * Create the heatmap time slider Leaflet control.
 * Includes range input, time label, peak label, and peak track overlay.
 */
function createHeatmapSliderControl() {
  const control = L.control({ position: "topright" });

  control.onAdd = function () {
    const container = L.DomUtil.create("div", "heatmap-slider-control");
    L.DomEvent.disableClickPropagation(container);

    // Time display row (time label + peak label)
    const timeRow = L.DomUtil.create("div", "heatmap-slider-time-row", container);
    const timeLabel = L.DomUtil.create("span", "heatmap-slider-time-label", timeRow);
    timeLabel.textContent = formatHour(state.heatmapHour);

    const peakLabelEl = L.DomUtil.create("span", "peak-label", timeRow);
    const initialPeak = getPeakLabel(state.heatmapHour);
    peakLabelEl.textContent = initialPeak;
    peakLabelEl.style.display = initialPeak ? "inline" : "none";

    // Slider wrapper (contains peak track + range input)
    const sliderWrapper = L.DomUtil.create("div", "heatmap-slider-wrapper", container);

    // Peak track overlay (colored segments behind the range input)
    const peakTrack = L.DomUtil.create("div", "peak-track", sliderWrapper);

    // Morning peak segment: hours 6-8 → positions 6/24 to 9/24 (25% to 37.5%)
    const morningSegment = L.DomUtil.create("div", "peak-track__segment peak-track__segment--morning", peakTrack);
    morningSegment.style.left = ((6 / 24) * 100).toFixed(2) + "%";
    morningSegment.style.width = ((3 / 24) * 100).toFixed(2) + "%";

    // Evening peak segment: hours 17-19 → positions 17/24 to 20/24 (70.83% to 83.33%)
    const eveningSegment = L.DomUtil.create("div", "peak-track__segment peak-track__segment--evening", peakTrack);
    eveningSegment.style.left = ((17 / 24) * 100).toFixed(2) + "%";
    eveningSegment.style.width = ((3 / 24) * 100).toFixed(2) + "%";

    // Range input
    const slider = L.DomUtil.create("input", "heatmap-slider-input", sliderWrapper);
    slider.type = "range";
    slider.min = "0";
    slider.max = "23";
    slider.step = "1";
    slider.value = String(state.heatmapHour);
    slider.setAttribute("aria-label", "Select hour of day for heatmap");

    // Event handler for slider input - update label immediately while dragging
    slider.addEventListener("input", function () {
      const hour = parseInt(this.value, 10);

      // Update time label
      timeLabel.textContent = formatHour(hour);

      // Update peak label
      const peakLabel = getPeakLabel(hour);
      peakLabelEl.textContent = peakLabel;
      peakLabelEl.style.display = peakLabel ? "inline" : "none";
    });

    // Event handler for slider change - fetch and render data when released
    slider.addEventListener("change", async function () {
      const hour = parseInt(this.value, 10);
      state.heatmapHour = hour;
      const result = await fetchHeatmapData(hour, getHeatmapRenderMode());
      if (result?.points) renderHeatmapLayer(result.points, result.renderMode);
    });

    return container;
  };

  return control;
}

// ─── Heatmap Data Fetching and Rendering ────────────────────────────────────

/**
 * Display a temporary notice overlay on the map area.
 * Auto-dismisses after 5 seconds.
 */
function showMapNotice(message) {
  const existing = document.querySelector(".map-notice-overlay");
  if (existing) {
    existing.remove();
  }

  const notice = document.createElement("div");
  notice.className = "map-notice-overlay";
  notice.textContent = message;
  notice.setAttribute("role", "alert");

  const mapContainer = document.getElementById("map");
  if (mapContainer) {
    mapContainer.appendChild(notice);
  } else {
    document.body.appendChild(notice);
  }

  setTimeout(() => {
    if (notice.parentElement) {
      notice.remove();
    }
  }, 5000);
}

function getHeatmapHoverOverlay() {
  if (state.heatmapHoverOverlay) {
    return state.heatmapHoverOverlay;
  }

  const mapContainer = document.getElementById("map");
  if (!mapContainer) {
    return null;
  }

  const overlay = document.createElement("div");
  overlay.className = "heatmap-hover-overlay";
  overlay.hidden = true;
  mapContainer.appendChild(overlay);
  state.heatmapHoverOverlay = overlay;
  return overlay;
}

function hideHeatmapHoverOverlay() {
  if (state.heatmapHoverOverlay) {
    state.heatmapHoverOverlay.hidden = true;
  }
}

/**
 * Fetch heatmap data for a given hour from the backend API.
 * Caches responses in state.heatmapCache to avoid re-fetching.
 * Returns the API payload on success, or null on failure.
 */
function getHeatmapRenderMode() {
  return "raw";
}

function getHeatmapCacheKey(hour, renderMode) {
  return `${hour}:${renderMode}`;
}

async function fetchHeatmapData(hour, renderMode = getHeatmapRenderMode()) {
  const cacheKey = getHeatmapCacheKey(hour, renderMode);
  if (state.heatmapCache[cacheKey]) {
    updateHeatmapLegendMeta(state.heatmapCache[cacheKey]);
    return state.heatmapCache[cacheKey];
  }

  try {
    const response = await fetch(`/api/heatmap-data?hour=${hour}&mode=${encodeURIComponent(renderMode)}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const payload = {
      points: data.points || [],
      totalBookings: data.totalBookings || 0,
      datasetName: data.datasetName || "",
      renderMode: data.renderMode || renderMode,
    };
    state.heatmapCache[cacheKey] = payload;
    updateHeatmapLegendMeta(payload);
    return payload;
  } catch (error) {
    console.error("Failed to fetch heatmap data:", error);
    updateHeatmapLegendMeta({ datasetName: "Unavailable", totalBookings: 0 });
    showMapNotice("Data update failed");
    return null;
  }
}

/**
 * Render a heatmap layer on the map using the given points.
 * Points are expected as [{lat, lng, count}, ...] from the API.
 * Removes any existing heatmap layer first, then creates a new one.
 */
function getHeatmapLayerConfig(renderMode = getHeatmapRenderMode(), zoom = map.getZoom()) {
  if (renderMode === "raw") {
    if (zoom >= 18) {
      return { radius: 78, blur: 72, minOpacity: 0.1, maxZoom: 19, weightScale: 0.16 };
    }
    if (zoom >= 17) {
      return { radius: 64, blur: 58, minOpacity: 0.11, maxZoom: 19, weightScale: 0.18 };
    }
    if (zoom >= 16) {
      return { radius: 52, blur: 46, minOpacity: 0.12, maxZoom: 19, weightScale: 0.2 };
    }
    if (zoom >= 15) {
      return { radius: 42, blur: 36, minOpacity: 0.14, maxZoom: 19, weightScale: 0.22 };
    }
    return { radius: 34, blur: 30, minOpacity: 0.16, maxZoom: 19, weightScale: 0.24 };
  }

  if (zoom >= 17) {
    return { radius: 32, blur: 28, minOpacity: 0.2, maxZoom: 19, weightScale: 1 };
  }
  if (zoom >= 15) {
    return { radius: 26, blur: 22, minOpacity: 0.22, maxZoom: 19, weightScale: 1 };
  }
  return { radius: 20, blur: 18, minOpacity: 0.24, maxZoom: 19, weightScale: 1 };
}

function renderHeatmapLayer(points, renderMode = getHeatmapRenderMode()) {
  removeHeatmapLayer();
  state.heatmapCurrentPoints = points || [];

  if (!points || points.length === 0) {
    showMapNotice("No bookings for this hour");
    hideHeatmapHoverOverlay();
    return;
  }

  const layerConfig = getHeatmapLayerConfig(renderMode);
  const heatPoints = points.map((p) => {
    const baseWeight = typeof p.count === "number" ? p.count : 1;
    return [p.lat, p.lng, baseWeight * (layerConfig.weightScale || 1)];
  });

  state.heatmapLayer = L.heatLayer(heatPoints, {
    radius: layerConfig.radius,
    blur: layerConfig.blur,
    minOpacity: layerConfig.minOpacity,
    maxZoom: layerConfig.maxZoom,
    gradient: HEATMAP_GRADIENT
  }).addTo(map);
}

/**
 * Remove the heatmap layer from the map and clear the reference.
 */
function removeHeatmapLayer() {
  if (state.heatmapLayer) {
    map.removeLayer(state.heatmapLayer);
    state.heatmapLayer = null;
  }
  state.heatmapCurrentPoints = [];
  hideHeatmapHoverOverlay();
}

// ─── Heatmap Legend Control ──────────────────────────────────────────────────

/**
 * Create the intensity scale legend control for the heatmap.
 * Renders a gradient bar matching HEATMAP_GRADIENT with "Low" and "High" labels.
 * The control is created once and reused — it is NOT recreated on data updates,
 * which prevents flickering.
 */
function createHeatmapLegendControl() {
  const control = L.control({ position: "bottomright" });

  control.onAdd = function () {
    const container = L.DomUtil.create("div", "heatmap-legend-control");
    L.DomEvent.disableClickPropagation(container);

    const labels = L.DomUtil.create("div", "legend-labels", container);
    const lowLabel = L.DomUtil.create("span", "", labels);
    lowLabel.textContent = "Low";
    const highLabel = L.DomUtil.create("span", "", labels);
    highLabel.textContent = "High";

    const gradientBar = L.DomUtil.create("div", "legend-gradient-bar", container);
    gradientBar.style.background = "linear-gradient(to right, #0000ff 0%, #00ff00 33%, #ffff00 66%, #ff0000 100%)";
    gradientBar.style.minWidth = "200px";
    gradientBar.style.height = "16px";
    gradientBar.style.borderRadius = "4px";

    const datasetText = L.DomUtil.create("div", "heatmap-legend-meta", container);
    datasetText.textContent = "Dataset: loading...";

    const bookingsText = L.DomUtil.create("div", "heatmap-legend-meta", container);
    bookingsText.textContent = "Hour bookings: --";

    state.heatmapDatasetText = datasetText;
    state.heatmapBookingsText = bookingsText;
    updateHeatmapLegendMeta(state.heatmapMeta);

    return container;
  };

  return control;
}

function updateHeatmapLegendMeta(meta = {}) {
  state.heatmapMeta = {
    datasetName: meta.datasetName || state.heatmapMeta.datasetName || "",
    totalBookings: typeof meta.totalBookings === "number" ? meta.totalBookings : (state.heatmapMeta.totalBookings || 0),
    renderMode: meta.renderMode || state.heatmapMeta.renderMode || "aggregated",
  };

  if (state.heatmapDatasetText) {
    const modeLabel = state.heatmapMeta.renderMode === "raw" ? "Forecast surface" : "Aggregated forecast";
    state.heatmapDatasetText.textContent = `Dataset: ${state.heatmapMeta.datasetName || "loading..."} | View: ${modeLabel}`;
  }
  if (state.heatmapBookingsText) {
    state.heatmapBookingsText.textContent = `Hour bookings: ${Number(state.heatmapMeta.totalBookings || 0).toLocaleString()}`;
  }
}

async function refreshHeatmapForCurrentView() {
  if (!state.heatmapView) {
    return;
  }

  const renderMode = getHeatmapRenderMode();
  const result = await fetchHeatmapData(state.heatmapHour, renderMode);
  if (result?.points) {
    renderHeatmapLayer(result.points, result.renderMode);
  }
}

// ─── Heatmap View Toggle (Admin Navigation) ─────────────────────────────────

/**
 * Toggle between the default admin view and the heatmap view.
 */
function toggleHeatmapView() {
  if (state.heatmapView) {
    deactivateHeatmapView();
  } else {
    activateHeatmapView();
  }
}

/**
 * Activate the heatmap view:
 * - Hide ride-request controls and driver markers
 * - Show heatmap controls (slider, legend)
 * - Fetch and render heatmap data for the current hour
 * - Preserve map center and zoom
 */
async function activateHeatmapView() {
  state.heatmapView = true;
  state.heatmapCache = {};
  removeBaselineDriverMarker();

  // Update nav button to indicate active state
  if (heatmapNavBtn) {
    heatmapNavBtn.classList.add("is-active");
    heatmapNavBtn.textContent = "Exit Heatmap";
  }

  // Hide ride-request controls
  const requestSection = document.querySelector('[data-mobile-section="request"]');
  const driverSection = document.querySelector('[data-mobile-section="driver"]');
  if (requestSection) requestSection.style.display = "none";
  if (driverSection) driverSection.style.display = "none";

  // Hide driver markers by removing driverLayer from map
  if (map.hasLayer(driverLayer)) {
    map.removeLayer(driverLayer);
  }

  // Add heatmap controls to the map (slider and legend will be populated by tasks 4.1/4.2)
  if (state.heatmapSliderControl) {
    state.heatmapSliderControl.addTo(map);
  }
  if (state.heatmapLegendControl) {
    state.heatmapLegendControl.addTo(map);
  }

  // Hide the default map legend
  if (mapLegendControl && mapLegendControl._container) {
    mapLegendControl._container.style.display = "none";
  }

  // Fetch and render heatmap data for the current hour
  try {
    const result = await fetchHeatmapData(state.heatmapHour, getHeatmapRenderMode());
    if (result?.points) {
      renderHeatmapLayer(result.points, result.renderMode);
    }
  } catch (error) {
    console.error("Failed to load heatmap data on activation:", error);
    showMapNotice("Heatmap data is unavailable. Please try again.");
  }
}

/**
 * Deactivate the heatmap view:
 * - Remove heat layer from the map
 * - Restore ride-request controls and driver markers
 * - Remove heatmap controls (slider, legend)
 * - Restore the default map legend
 * - Preserve map center and zoom
 */
function deactivateHeatmapView() {
  state.heatmapView = false;

  // Update nav button to indicate inactive state
  if (heatmapNavBtn) {
    heatmapNavBtn.classList.remove("is-active");
    heatmapNavBtn.textContent = "Booking Heatmap";
  }

  // Remove heatmap layer
  removeHeatmapLayer();

  // Remove heatmap controls from the map
  if (state.heatmapSliderControl && state.heatmapSliderControl._map) {
    state.heatmapSliderControl.remove();
  }
  if (state.heatmapLegendControl && state.heatmapLegendControl._map) {
    state.heatmapLegendControl.remove();
  }

  // Restore ride-request controls
  const requestSection = document.querySelector('[data-mobile-section="request"]');
  const driverSection = document.querySelector('[data-mobile-section="driver"]');
  if (requestSection) requestSection.style.display = "";
  if (driverSection) driverSection.style.display = "";

  // Restore driver markers by adding driverLayer back to map
  if (!map.hasLayer(driverLayer)) {
    driverLayer.addTo(map);
  }

  syncBaselineDriverMarker();

  // Restore the default map legend
  if (mapLegendControl && mapLegendControl._container) {
    mapLegendControl._container.style.display = "";
  }

  // Refresh the map legend to show current driver counts
  updateMapLegend();
}
