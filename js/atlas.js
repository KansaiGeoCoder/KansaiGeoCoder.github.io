// ===== CONFIG =====
// From /shotengai/map.html to your dataset in /data:
const DATA_URL = "../data/shotengai_lines.geojson";

// ===== FLEXIBLE FIELD MAPPING =====
// If your file uses slightly different names, we detect them once and use consistently.
const FIELD_CANDIDATES = {
  id: ["id", "ID", "shotengai_id", "sg_id"],
  slug: ["slug", "Slug"],
  name_en: ["name_en", "NameEn", "nameEN", "english", "EnglishName"],
  name_ja: ["name_ja", "Name", "nameJP", "Japanese", "JapaneseName", "name"],
  name_kana: ["name_kana", "kana"],
  name_romaji: ["name_romaji", "romaji"],
  city: ["city", "City", "municipality", "Municipality", "CityEn", "city_en"],
  prefecture: ["prefecture", "Prefecture", "pref", "Pref", "prefecture_en", "PrefectureEn"],
  status: ["status", "Status", "condition"],
  covered: ["covered", "Covered", "roof", "Roofed"],
  length_m: ["length_m", "Length_m", "len_m", "length", "Length"],
  stalls_est: ["stalls_est", "stalls", "shop_count"],
  established: ["established", "year", "Year", "since", "Since"],
  nearest_sta: ["nearest_sta", "NearestStation", "station", "nearest_station"],
  nearest_line: ["nearest_line", "Line", "rail_line"],
  walk_min: ["walk_min", "WalkMin", "minutes", "min_walk"],
  typology: ["typology", "type", "Type"],
  theme: ["theme", "tags", "Tags"],
  association: ["association", "managing_body", "assoc"],
  association_url: ["association_url", "assoc_url"],
  url: ["url", "URL", "website", "Website"],
  images: ["images", "image", "photo_urls"],
  description: ["description", "desc"],
  notes: ["notes", "Notes", "remark", "remarks"],
  prefecture_code: ["prefecture_code", "pref_code", "PrefCode"],
  city_code: ["city_code", "muni_code"],
  source: ["source", "Source"],
  last_update: ["last_update", "last_updated", "last_update_date", "updated"],
  accuracy: ["accuracy", "Accuracy"]
};

// lookup actual key present in a properties object
function pickKey(props, candidates) {
  for (const k of candidates) {
    if (k in props) return k;
    const lowerKeys = Object.keys(props).reduce((m, kk) => (m[kk.toLowerCase()] = kk, m), {});
    if (k.toLowerCase() in lowerKeys) return lowerKeys[k.toLowerCase()];
  }
  return null;
}
function buildFieldMap(sampleProps) {
  const map = {};
  for (const [canonical, cands] of Object.entries(FIELD_CANDIDATES)) {
    map[canonical] = pickKey(sampleProps, cands);
  }
  return map;
}

// ===== COORD NORMALIZATION (optional safety) =====
function toNum(n) { return (typeof n === "string") ? parseFloat(n) : n; }
function fixPair(pair) {
  if (!Array.isArray(pair) || pair.length < 2) return pair;
  let a = toNum(pair[0]), b = toNum(pair[1]);
  const looksLatLon = isFinite(a) && isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) > 90 && Math.abs(b) <= 180;
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

// ===== UI HELPERS (using dynamic field map) =====
function prop(props, key, fmap) { const k = fmap[key]; return k ? props[k] : undefined; }

function featureName(props, fmap) {
  return prop(props, "name_en", fmap) || prop(props, "name_ja", fmap) || prop(props, "name_romaji", fmap) || "Unnamed Shotengai";
}
function featureCity(props, fmap) {
  const c = prop(props, "city", fmap);
  const p = prop(props, "prefecture", fmap);
  const addr = props.AddressEn || props.Address; // backward compat from earlier files
  return [c, p].filter(Boolean).join(", ") || addr || "";
}
function statusPill(props, fmap) {
  const s = (prop(props, "status", fmap) || "").toString().trim();
  return s ? `<span class="pill">${s}</span>` : "";
}
function fmtLength(props, fmap) {
  const v = Number(prop(props, "length_m", fmap));
  if (!isFinite(v)) return "";
  const km = v / 1000;
  return v >= 1000 ? `${km.toFixed(2)} km` : `${v.toFixed(0)} m`;
}
function cardHTML(props, fmap) {
  const meta = [
    featureCity(props, fmap),
    fmtLength(props, fmap),
    prop(props, "established", fmap) ? `Since ${prop(props, "established", fmap)}` : ""
  ].filter(Boolean).join(" · ");

  const url = prop(props, "url", fmap);
  const urlHTML = url ? `<a href="${url}" target="_blank" rel="noopener">Official site</a>` : "";

  const notes = prop(props, "notes", fmap);
  const notesHTML = notes ? `<p style="margin-top:8px;color:#cbd5e1">${notes}</p>` : "";

  return `
    <h3>${featureName(props, fmap)} ${statusPill(props, fmap)}</h3>
    <div class="meta">${meta}</div>
    <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">${urlHTML}</div>
    ${notesHTML}
  `;
}

// ===== MAP SETUP =====
const basemaps = {
  light: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }),
  dark: L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap &copy; CARTO" })
};
const map = L.map("map", { center: [36.2048, 137.2529], zoom: 5, layers: [basemaps.dark] });
L.control.layers({ "Light": basemaps.light, "Dark": basemaps.dark }).addTo(map);
L.Control.geocoder({ defaultMarkGeocode: false }).on("markgeocode", e => map.fitBounds(e.geocode.bbox)).addTo(map);

// Styles
const lineStyle = { color: "#7aa2ff", weight: 3, opacity: 0.9 };
const lineStyleHover = { color: "#14b8a6", weight: 4, opacity: 1 };
function circleStyle(feature) {
  const s = (feature.properties?.status || feature.properties?.Status || "").toString().toLowerCase();
  const fill = s === "active" ? "#22c55e" : (s === "declining" ? "#f59e0b" : (s === "closed" ? "#ef4444" : "#9ca3af"));
  return { radius: 6, color: "#0b1220", weight: 1, fillColor: fill, fillOpacity: 0.95 };
}
const dotIcon = L.divIcon({
  className: "sg-dot",
  html: '<div style="width:10px;height:10px;border-radius:999px;background:#9ca3af;border:1px solid #0b1220"></div>',
  iconSize: [10, 10], iconAnchor: [5, 5]
});

// DOM
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

// State
let rawFeatures = [];
let linesLayer, pointsStandalone, clusterLayer, fuse;
let FIELD_MAP = null;

// ===== LOAD DATA =====
(async function init() {
  let geojson;
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(res.status + " " + res.statusText + " @ " + res.url);
    geojson = await res.json();
  } catch (e) {
    console.error("[Atlas] Failed to load GeoJSON:", e);
    L.marker([35.0116, 135.7681]).addTo(map).bindPopup("Couldn’t load data").openPopup();
    return;
  }

  let features = geojson.type === "FeatureCollection" ? geojson.features : [geojson];

  // Normalize coords (safe if already correct)
  features = features.map(f => ({ ...f, geometry: normalizeGeometry(f.geometry) }));
  rawFeatures = features;

  // Build field map from the first feature's properties
  const sampleProps = (features.find(f => f.properties)?.properties) || {};
  FIELD_MAP = buildFieldMap(sampleProps);
  console.log("[Atlas] FIELD_MAP:", FIELD_MAP);

  // Prefecture dropdown (show only if present)
  const prefKey = FIELD_MAP.prefecture;
  const prefs = prefKey ? [...new Set(features.map(f => f.properties?.[prefKey]).filter(Boolean))].sort() : [];
  if (prefs.length) {
    for (const p of prefs) { const opt = document.createElement("option"); opt.value = p; opt.textContent = p; elPrefFilter.appendChild(opt); }
  } else {
    const lab = document.querySelector('label[for="prefFilter"]');
    if (lab) lab.style.display = "none"; elPrefFilter.style.display = "none";
  }

  // Search index
  const fuseItems = features.map((f, i) => {
    const p = f.properties || {};
    return {
      idx: i,
      name: featureName(p, FIELD_MAP),
      city: prop(p, "city", FIELD_MAP) || "",
      prefecture: prop(p, "prefecture", FIELD_MAP) || "",
      kana: prop(p, "name_kana", FIELD_MAP) || "",
      romaji: prop(p, "name_romaji", FIELD_MAP) || "",
      alt: p.Name || p.Address || p.AddressEn || ""
    };
  });
  fuse = new Fuse(fuseItems, {
    includeScore: true, threshold: 0.3,
    keys: ["name", "city", "prefecture", "kana", "romaji", "alt"]
  });

  // Split by geom type
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
        click: () => { try { showInfo(f, layer.getBounds().getCenter()); } catch { showInfo(f, null); } }
      });
    }
  }).addTo(map);

  // Points (standalone)
  pointsStandalone = L.geoJSON(pointFeats, {
    pointToLayer: (f, latlng) => L.circleMarker(latlng, circleStyle(f)),
    onEachFeature: (f, layer) => layer.on("click", () => showInfo(f, layer.getLatLng()))
  });

  // Points (clustered)
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

  // Fit to all features
  try {
    const b = L.latLngBounds();
    features.forEach(f => { const g = L.geoJSON(f); if (g.getBounds) b.extend(g.getBounds()); });
    if (b.isValid()) map.fitBounds(b.pad(0.06));
  } catch (e) { /* ignore */ }

  // List + UI
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
})();

// ===== UI FUNCS =====
function showInfo(feature, center) {
  const p = feature.properties || {};
  infoCard.innerHTML = cardHTML(p, FIELD_MAP || {});
  infoPanel.style.display = "block";
  if (center) map.panTo(center);
}
function handleFilter() {
  const q = (elSearch.value || "").trim();
  const prefKey = FIELD_MAP && FIELD_MAP.prefecture;
  const pref = prefKey ? elPrefFilter.value : "";
  const onlyActive = elToggleActive.checked;

  let list = rawFeatures.slice();
  if (pref && prefKey) list = list.filter(f => (f.properties?.[prefKey] || "") === pref);
  if (onlyActive) {
    const sk = FIELD_MAP && FIELD_MAP.status;
    list = list.filter(f => (sk ? (f.properties?.[sk] || "") : (f.properties?.status || "")).toString().toLowerCase() === "active");
  }

  if (q && window.Fuse) {
    const items = list.map(f => ({
      ref: f,
      name: featureName(f.properties || {}, FIELD_MAP || {}),
      city: (FIELD_MAP && FIELD_MAP.city) ? f.properties[FIELD_MAP.city] : "",
      prefecture: (FIELD_MAP && FIELD_MAP.prefecture) ? f.properties[FIELD_MAP.prefecture] : "",
      kana: (FIELD_MAP && FIELD_MAP.name_kana) ? f.properties[FIELD_MAP.name_kana] : "",
      romaji: (FIELD_MAP && FIELD_MAP.name_romaji) ? f.properties[FIELD_MAP.name_romaji] : "",
      alt: f.properties?.Name || f.properties?.Address || f.properties?.AddressEn || ""
    }));
    const fu = new Fuse(items, { includeScore: true, threshold: 0.3, keys: ["name", "city", "prefecture", "kana", "romaji", "alt"] });
    list = fu.search(q).map(h => h.item.ref);
  }
  renderList(list);
}
function renderList(features) {
  elResults.innerHTML = ""; elResultCount.textContent = features.length;
  const frag = document.createDocumentFragment();
  features.slice(0, 300).forEach(f => {
    const p = f.properties || {};
    const div = document.createElement("div");
    div.className = "result-item";
    div.innerHTML = `<div class="result-name">${featureName(p, FIELD_MAP || {})}</div><div class="result-meta">${featureCity(p, FIELD_MAP || {})}</div>`;
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
      const [lng, lat] = f.geometry.coordinates; map.setView([lat, lng], 17);
    }
  } catch (e) { }
  showInfo(f, null);
}
function ensureLayerVisibility() {
  // lines
  if (elToggleLines.checked) { if (linesLayer && !map.hasLayer(linesLayer)) map.addLayer(linesLayer); }
  else { if (linesLayer && map.hasLayer(linesLayer)) map.removeLayer(linesLayer); }

  // points
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
