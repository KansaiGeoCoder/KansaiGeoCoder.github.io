// ===== CONFIG =====
// Build an absolute URL from /shotengai/map.html to the data file:
const DATA_PATH = "../data/testdata.geojson";             // change to ../data/testdata.geojson if needed
const DATA_URL = new URL(DATA_PATH, window.location.href).href;
// Add cache-busting while you iterate:
const FETCH_URL = DATA_URL + (DATA_URL.includes("?") ? "&" : "?") + "v=" + Date.now();

// ===== COORDINATE NORMALIZATION =====
function toNum(n) { return (typeof n === "string") ? parseFloat(n) : n; }
function fixPair(pair) {
  let a = toNum(pair[0]), b = toNum(pair[1]);
  const looksLatLon = Math.abs(a) <= 90 && Math.abs(b) > 90 && Math.abs(b) <= 180;
  return looksLatLon ? [b, a] : [a, b];
}
function normalizeGeometry(geom) {
  if (!geom || !geom.type) return geom;
  const T = geom.type;
  if (T === "Point") return { type: "Point", coordinates: fixPair(geom.coordinates) };
  if (T === "MultiPoint") return { type: "MultiPoint", coordinates: geom.coordinates.map(fixPair) };
  if (T === "LineString") return { type: "LineString", coordinates: geom.coordinates.map(fixPair) };
  if (T === "MultiLineString") return {
    type: "MultiLineString",
    coordinates: geom.coordinates.map(line => line.map(fixPair))
  };
  if (T === "Polygon") return {
    type: "Polygon",
    coordinates: geom.coordinates.map(ring => ring.map(fixPair))
  };
  if (T === "MultiPolygon") return {
    type: "MultiPolygon",
    coordinates: geom.coordinates.map(poly => poly.map(ring => ring.map(fixPair)))
  };
  return geom;
}

// ===== UI HELPERS =====
function featureName(p) { return p.Name || p.name_en || p.name_ja || p.name || "Unnamed Shotengai"; }
function featureCity(p) { return p.AddressEn || p.Address || [p.city, p.prefecture].filter(Boolean).join(", "); }
function formatLength(m) { if (!m && m !== 0) return null; const km = m / 1000; return m >= 1000 ? `${km.toFixed(2)} km` : `${m} m`; }
function cardHTML(p) {
  const title = featureName(p);
  const city = featureCity(p);
  const status = p.status ? `<span class="pill">${p.status}</span>` : "";
  const len = formatLength(Number(p.length_m));
  const est = p.established ? `Since ${p.established}` : "";
  const url = p.url ? `<a href="${p.url}" target="_blank" rel="noopener">Official site</a>` : "";
  const note = p.notes ? `<p style="margin-top:8px;color:#cbd5e1">${p.notes}</p>` : "";
  return `
    <h3>${title} ${status}</h3>
    <div class="meta">${city}</div>
    <div class="meta" style="margin-top:6px">${[len, est].filter(Boolean).join(" · ")}</div>
    <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">${url}</div>
    ${note}
  `;
}

// ===== MAP & BASEMAPS =====
const basemaps = {
  light: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }),
  dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap &copy; CARTO' })
};
const map = L.map("map", { center: [36.2048, 137.2529], zoom: 5, layers: [basemaps.dark] });
L.control.layers({ "Light": basemaps.light, "Dark": basemaps.dark }).addTo(map);
L.Control.geocoder({ defaultMarkGeocode: false }).on("markgeocode", e => map.fitBounds(e.geocode.bbox)).addTo(map);

// Styles
const lineStyle = { color: "#7aa2ff", weight: 3.5, opacity: 0.95 };
const lineStyleHover = { color: "#14b8a6", weight: 4.5, opacity: 1.0 };
function pointCircleStyle(feature) {
  const status = (feature.properties?.status || "").toLowerCase();
  const color = status === "active" ? "#22c55e" : status === "declining" ? "#f59e0b" : "#9ca3af";
  return { radius: 6, color: "#0b1220", weight: 1, fillColor: color, fillOpacity: 0.95 };
}
// MarkerCluster cannot cluster circleMarker → use a DivIcon
const dotIcon = L.divIcon({
  className: "sg-dot",
  html: '<div style="width:10px;height:10px;border-radius:999px;background:#9ca3af;border:1px solid #0b1220"></div>',
  iconSize: [10, 10], iconAnchor: [5, 5]
});

// ===== DOM REFS =====
const elSearch = document.getElementById("search");
const elResults = document.getElementById("results");
const elResultCount = document.getElementById("resultCount");
const elTogglePoints = document.getElementById("togglePoints");
const elToggleLines = document.getElementById("toggleLines");
const elToggleCluster = document.getElementById("toggleCluster");
const elToggleActive = document.getElementById("toggleActive");
const elPrefFilter = document.getElementById("prefFilter");
const infoPanel = document.getElementById("infopanel");
const infoCard = document.getElementById("info");

// ===== STATE =====
let rawFeatures = [];
let linesLayer, pointsStandalone, clusterLayer, fuse;

// ===== LOAD DATA (robust) =====
(async function init() {
  try {
    console.log("[Atlas] Fetching:", FETCH_URL);
    const res = await fetch(FETCH_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} at ${res.url}`);
    const ctype = (res.headers.get("content-type") || "").toLowerCase();
    const text = await res.text();

    let geojson;
    try {
      geojson = JSON.parse(text);
    } catch (e) {
      console.error("[Atlas] Non-JSON response head:", text.slice(0, 200));
      throw new Error(`Response was not JSON (content-type: ${ctype || "unknown"})`);
    }

    let features = geojson.type === "FeatureCollection" ? geojson.features : [geojson];
    // Normalize coords & numeric strings
    features = features.map(f => ({ ...f, geometry: normalizeGeometry(f.geometry) }));
    rawFeatures = features;

    // Prefecture filter (hide if none)
    const prefs = [...new Set(features.map(f => f.properties?.prefecture).filter(Boolean))].sort();
    if (prefs.length) {
      for (const p of prefs) {
        const opt = document.createElement("option");
        opt.value = p; opt.textContent = p; elPrefFilter.appendChild(opt);
      }
    } else {
      const lab = document.querySelector('label[for="prefFilter"]');
      if (lab) lab.style.display = "none";
      elPrefFilter.style.display = "none";
    }

    // Search index
    fuse = new Fuse(features.map((f, i) => ({
      idx: i,
      Name: f.properties?.Name || "",
      Address: f.properties?.Address || "",
      AddressEn: f.properties?.AddressEn || "",
      name: featureName(f.properties || {}),
      city: f.properties?.city || "",
      prefecture: f.properties?.prefecture || "",
      kana: f.properties?.name_kana || "",
      romaji: f.properties?.name_romaji || ""
    })), {
      includeScore: true, threshold: 0.3,
      keys: ["Name", "Address", "AddressEn", "name", "city", "prefecture", "kana", "romaji"]
    });

    // Split by geometry
    const pointFeats = features.filter(f => ["Point", "MultiPoint"].includes(f.geometry?.type));
    const lineFeats = features.filter(f => ["LineString", "MultiLineString"].includes(f.geometry?.type));
    console.log("[Atlas] features:", features.length, "points:", pointFeats.length, "lines:", lineFeats.length);

    // Lines
    linesLayer = L.geoJSON(lineFeats, {
      style: lineStyle,
      onEachFeature: (f, layer) => {
        layer.on({
          mouseover: () => layer.setStyle(lineStyleHover),
          mouseout: () => layer.setStyle(lineStyle),
          click: () => {
            try { showInfo(f, layer.getBounds().getCenter()); }
            catch { showInfo(f, null); }
          }
        });
      }
    }).addTo(map);

    // Points (non-cluster)
    pointsStandalone = L.geoJSON(pointFeats, {
      pointToLayer: (f, latlng) => L.circleMarker(latlng, pointCircleStyle(f)),
      onEachFeature: (f, layer) => layer.on("click", () => showInfo(f, layer.getLatLng()))
    });

    // Points (cluster)
    clusterLayer = L.markerClusterGroup({
      disableClusteringAtZoom: 15,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      chunkedLoading: true
    });
    const clusterPoints = L.geoJSON(pointFeats, {
      pointToLayer: (f, latlng) => L.marker(latlng, { icon: dotIcon })
    });
    clusterLayer.addLayer(clusterPoints).addTo(map);

    // Fit to all
    try {
      const b = L.latLngBounds();
      features.forEach(f => { const g = L.geoJSON(f); if (g.getBounds) b.extend(g.getBounds()); });
      if (b.isValid()) map.fitBounds(b.pad(0.06));
    } catch (e) { console.warn("[Atlas] Bounds error", e); }

    // Render list + wire UI
    renderList(features);
    elSearch.addEventListener("input", handleFilter);
    elPrefFilter.addEventListener("change", handleFilter);
    elToggleActive.addEventListener("change", handleFilter);

    elTogglePoints.addEventListener("change", ensureLayerVisibility);
    elToggleLines.addEventListener("change", ensureLayerVisibility);
    elToggleCluster.addEventListener("change", ensureLayerVisibility);

    // Initial visibility
    elToggleLines.checked = true;
    elTogglePoints.checked = pointFeats.length > 0;
    ensureLayerVisibility();

  } catch (err) {
    console.error("[Atlas] Failed to load GeoJSON:", err);
    L.marker([35.0116, 135.7681]).addTo(map).bindPopup("Couldn't load data").openPopup();
  }
})();

// ===== UI FUNCS =====
function showInfo(feature, center) {
  const p = feature.properties || {};
  infoCard.innerHTML = cardHTML(p);
  document.getElementById("infopanel").style.display = "block";
  if (center) map.panTo(center);
}
function handleFilter() {
  const q = (elSearch.value || "").trim();
  const pref = elPrefFilter.value;
  const onlyActive = elToggleActive.checked;

  let list = rawFeatures.slice();
  if (pref) list = list.filter(f => (f.properties?.prefecture || "") === pref);
  if (onlyActive) list = list.filter(f => (f.properties?.status || "").toLowerCase() === "active");

  if (q && window.Fuse) {
    const hits = fuse.search(q).map(h => rawFeatures[h.item.idx]);
    const idset = new Set(list.map(f => rawFeatures.indexOf(f)));
    list = hits.filter(f => idset.has(rawFeatures.indexOf(f)));
  }
  renderList(list);
}
function renderList(features) {
  elResults.innerHTML = "";
  elResultCount.textContent = features.length;
  const frag = document.createDocumentFragment();
  features.slice(0, 300).forEach(f => {
    const p = f.properties || {};
    const div = document.createElement("div");
    div.className = "result-item";
    div.innerHTML = `
      <div class="result-name">${featureName(p)}</div>
      <div class="result-meta">${featureCity(p)}</div>
    `;
    div.addEventListener("click", () => zoomToFeature(f));
    frag.appendChild(div);
  });
  elResults.appendChild(frag);
}
function zoomToFeature(f) {
  const g = L.geoJSON(f);
  try {
    const b = g.getBounds();
    if (b && b.isValid()) map.fitBounds(b.pad(0.2));
    else if (f.geometry?.type === "Point") {
      const [lng, lat] = f.geometry.coordinates;
      map.setView([lat, lng], 17);
    }
  } catch (e) { }
  showInfo(f, null);
}
function ensureLayerVisibility() {
  if (elToggleLines.checked) {
    if (linesLayer && !map.hasLayer(linesLayer)) map.addLayer(linesLayer);
  } else {
    if (linesLayer && map.hasLayer(linesLayer)) map.removeLayer(linesLayer);
  }
  if (elTogglePoints.checked) {
    if (elToggleCluster.checked) {
      if (clusterLayer && !map.hasLayer(clusterLayer)) map.addLayer(clusterLayer);
      if (pointsStandalone && map.hasLayer(pointsStandalone)) map.removeLayer(pointsStandalone);
    } else {
      if (clusterLayer && map.hasLayer(clusterLayer)) map.removeLayer(clusterLayer);
      if (pointsStandalone && !map.hasLayer(pointsStandalone)) map.addLayer(pointsStandalone);
    }
  } else {
    if (clusterLayer && map.hasLayer(clusterLayer)) map.removeLayer(clusterLayer);
    if (pointsStandalone && map.hasLayer(pointsStandalone)) map.removeLayer(pointsStandalone);
  }
}
