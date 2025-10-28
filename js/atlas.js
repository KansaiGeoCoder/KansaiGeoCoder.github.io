// ===== CONFIG =====
// From /shotengai/map.html to your dataset in /data:
const DATA_URL = "../data/shotengai.geojson";

// Minimal built-in test data (will be used if the fetch fails)
const SAMPLE_GEOJSON = {
  "type": "FeatureCollection",
  "features": [
    {
      "type":"Feature",
      "id":"sg_kyoto_nishiki_pt",
      "properties":{
        "slug":"nishiki-market",
        "name_en":"Nishiki Market",
        "name_ja":"錦市場",
        "city":"Kyoto",
        "prefecture":"Kyoto",
        "status":"active",
        "role":"entrance",
        "length_m":390,
        "established":1615,
        "url":"https://www.kyoto-nishiki.or.jp/",
        "notes":"Sample point. Replace with your data file."
      },
      "geometry":{"type":"Point","coordinates":[135.764,35.0054]}
    },
    {
      "type":"Feature",
      "id":"sg_kyoto_teramachi_ln",
      "properties":{
        "slug":"teramachi-shotengai",
        "name_en":"Teramachi-dori Shotengai",
        "name_ja":"寺町通商店街",
        "city":"Kyoto",
        "prefecture":"Kyoto",
        "status":"active",
        "role":"spine",
        "length_m":800
      },
      "geometry":{
        "type":"LineString",
        "coordinates":[[135.7671,35.0067],[135.7688,35.0103]]
      }
    }
  ]
};

// ===== UI HELPERS =====
function featureName(p){ return p.name_en || p.name_ja || p.name || "Unnamed Shotengai"; }
function featureCity(p){ return [p.city, p.prefecture].filter(Boolean).join(", "); }
function formatLength(m){ if(m==null) return ""; const km=m/1000; return m>=1000?`${km.toFixed(2)} km`:`${m} m`; }
function cardHTML(p){
  const status = p.status ? `<span class="pill">${p.status}</span>` : "";
  const meta  = [featureCity(p), formatLength(Number(p.length_m)), p.established?`Since ${p.established}`:""]
                  .filter(Boolean).join(" · ");
  const links = p.url ? `<a href="${p.url}" target="_blank" rel="noopener">Official site</a>` : "";
  const notes = p.notes ? `<p style="margin-top:8px;color:#cbd5e1">${p.notes}</p>` : "";
  return `
    <h3>${featureName(p)} ${status}</h3>
    <div class="meta">${meta}</div>
    <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">${links}</div>
    ${notes}
  `;
}

// ===== MAP SETUP =====
const basemaps = {
  light: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom:19, attribution:"&copy; OpenStreetMap contributors"}),
  dark:  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {maxZoom:19, attribution:"&copy; OpenStreetMap &copy; CARTO"})
};
const map = L.map("map", {center:[36.2048,137.2529], zoom:5, layers:[basemaps.dark]});
L.control.layers({"Light":basemaps.light,"Dark":basemaps.dark}).addTo(map);
L.Control.geocoder({defaultMarkGeocode:false}).on("markgeocode", e=>map.fitBounds(e.geocode.bbox)).addTo(map);

// Styles
const lineStyle      = {color:"#7aa2ff", weight:3, opacity:0.9};
const lineStyleHover = {color:"#14b8a6", weight:4, opacity:1};
function circleStyle(feature){
  const s=(feature.properties?.status||"").toLowerCase();
  const fill = s==="active"?"#22c55e":(s==="declining"?"#f59e0b":"#9ca3af");
  return {radius:6, color:"#0b1220", weight:1, fillColor:fill, fillOpacity:0.95};
}
const dotIcon = L.divIcon({
  className:"sg-dot",
  html:'<div style="width:10px;height:10px;border-radius:999px;background:#9ca3af;border:1px solid #0b1220"></div>',
  iconSize:[10,10], iconAnchor:[5,5]
});

// DOM
const elSearch=document.getElementById("search");
const elResults=document.getElementById("results");
const elResultCount=document.getElementById("resultCount");
const elTogglePoints=document.getElementById("togglePoints");
const elToggleLines=document.getElementById("toggleLines");
const elToggleCluster=document.getElementById("toggleCluster");
const elToggleActive=document.getElementById("toggleActive");
const elPrefFilter=document.getElementById("prefFilter");
const infoPanel=document.getElementById("infopanel");
const infoCard=document.getElementById("info");

// State
let rawFeatures=[];
let linesLayer, pointsStandalone, clusterLayer, fuse;

// ===== LOAD DATA (simple + fallback) =====
(async function init(){
  let geojson;
  try{
    const res = await fetch(DATA_URL, {cache:"no-store"});
    if(!res.ok) throw new Error(res.status+" "+res.statusText);
    geojson = await res.json();
  }catch(e){
    console.warn("[Atlas] Using built-in sample data because the file couldn’t be loaded:", e);
    geojson = SAMPLE_GEOJSON;
  }

  const features = geojson.type==="FeatureCollection" ? geojson.features : [geojson];
  rawFeatures = features;

  // Build prefecture dropdown if available
  const prefs = [...new Set(features.map(f=>f.properties?.prefecture).filter(Boolean))].sort();
  if(prefs.length){
    for(const p of prefs){ const opt=document.createElement("option"); opt.value=p; opt.textContent=p; elPrefFilter.appendChild(opt); }
  }else{
    const lab=document.querySelector('label[for="prefFilter"]');
    if(lab) lab.style.display="none"; elPrefFilter.style.display="none";
  }

  // Search index
  fuse = new Fuse(features.map((f,i)=>({
    idx:i,
    name: featureName(f.properties||{}),
    city: f.properties?.city || "",
    prefecture: f.properties?.prefecture || "",
    kana: f.properties?.name_kana || "",
    romaji: f.properties?.name_romaji || "",
    alt:  f.properties?.name || "" // any generic name field
  })), {includeScore:true, threshold:0.3, keys:["name","city","prefecture","kana","romaji","alt"]});

  // Split by geom type
  const pointFeats = features.filter(f=>["Point","MultiPoint"].includes(f.geometry?.type));
  const lineFeats  = features.filter(f=>["LineString","MultiLineString"].includes(f.geometry?.type));

  // Lines
  linesLayer = L.geoJSON(lineFeats, {
    style: lineStyle,
    onEachFeature: (f, layer) => {
      layer.on({
        mouseover: () => layer.setStyle(lineStyleHover),
        mouseout:  () => layer.setStyle(lineStyle),
        click:     () => { try{ showInfo(f, layer.getBounds().getCenter()); } catch{ showInfo(f, null); } }
      });
    }
  }).addTo(map);

  // Points (standalone)
  pointsStandalone = L.geoJSON(pointFeats, {
    pointToLayer: (f, latlng) => L.circleMarker(latlng, circleStyle(f)),
    onEachFeature: (f, layer) => layer.on("click", () => showInfo(f, layer.getLatLng()))
  });

  // Points (clustered) – use L.marker to be cluster-safe
  clusterLayer = L.markerClusterGroup({
    disableClusteringAtZoom: 15,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    chunkedLoading: true
  });
  const clusterPoints = L.geoJSON(pointFeats, {
    pointToLayer: (f, latlng) => L.marker(latlng, {icon: dotIcon})
  });
  clusterLayer.addLayer(clusterPoints).addTo(map);

  // Fit to all features
  try{
    const b = L.latLngBounds();
    features.forEach(f=>{ const g=L.geoJSON(f); if(g.getBounds) b.extend(g.getBounds()); });
    if(b.isValid()) map.fitBounds(b.pad(0.06));
  }catch(e){ /* ignore */ }

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
function showInfo(feature, center){
  const p=feature.properties||{};
  infoCard.innerHTML = cardHTML(p);
  infoPanel.style.display = "block";
  if(center) map.panTo(center);
}
function handleFilter(){
  const q=(elSearch.value||"").trim();
  const pref=elPrefFilter.value;
  const onlyActive=elToggleActive.checked;

  let list = rawFeatures.slice();
  if(pref) list = list.filter(f => (f.properties?.prefecture||"")===pref);
  if(onlyActive) list = list.filter(f => (f.properties?.status||"").toLowerCase()==="active");

  if(q && window.Fuse){
    const hits = fuse.search(q).map(h => rawFeatures[h.item.idx]);
    const idset = new Set(list.map(f => rawFeatures.indexOf(f)));
    list = hits.filter(f => idset.has(rawFeatures.indexOf(f)));
  }
  renderList(list);
}
function renderList(features){
  elResults.innerHTML=""; elResultCount.textContent=features.length;
  const frag=document.createDocumentFragment();
  features.slice(0,300).forEach(f=>{
    const p=f.properties||{};
    const div=document.createElement("div");
    div.className="result-item";
    div.innerHTML = `<div class="result-name">${featureName(p)}</div><div class="result-meta">${featureCity(p)}</div>`;
    div.addEventListener("click",()=>zoomToFeature(f));
    frag.appendChild(div);
  });
  elResults.appendChild(frag);
}
function zoomToFeature(f){
  const g=L.geoJSON(f);
  try{
    const b=g.getBounds();
    if(b && b.isValid()) map.fitBounds(b.pad(0.2));
    else if(f.geometry?.type==="Point"){
      const [lng,lat]=f.geometry.coordinates; map.setView([lat,lng],17);
    }
  }catch(e){}
  showInfo(f,null);
}
function ensureLayerVisibility(){
  if(elToggleLines.checked){ if(linesLayer && !map.hasLayer(linesLayer)) map.addLayer(linesLayer); }
  else { if(linesLayer && map.hasLayer(linesLayer)) map.removeLayer(linesLayer); }
  if(elTogglePoints.checked){
    if(elToggleCluster.checked){
      if(clusterLayer && !map.hasLayer(clusterLayer)) map.addLayer(clusterLayer);
      if(pointsStandalone && map.hasLayer(pointsStandalone)) map.removeLayer(pointsStandalone);
    }else{
      if(clusterLayer && map.hasLayer(clusterLayer)) map.removeLayer(clusterLayer);
      if(pointsStandalone && !map.hasLayer(pointsStandalone)) map.addLayer(pointsStandalone);
    }
  }else{
    if(clusterLayer && map.hasLayer(clusterLayer)) map.removeLayer(clusterLayer);
    if(pointsStandalone && map.hasLayer(pointsStandalone)) map.removeLayer(pointsStandalone);
  }
}
