// ===== CONFIG =====
const DATA_URL = "../data/testdata.geojson";

// Basemaps (dark + light)
const basemaps = {
  light: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
  }),
  dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap &copy; CARTO'
  })
};

// Map init (center ~ Japan)
const map = L.map('map', {
  center: [36.2048, 137.2529],
  zoom: 5,
  layers: [basemaps.dark]
});

// Layer controls
L.control.layers({ "Light": basemaps.light, "Dark": basemaps.dark }).addTo(map);

// Geocoder
L.Control.geocoder({ defaultMarkGeocode: false }).on('markgeocode', function (e) {
  map.fitBounds(e.geocode.bbox);
}).addTo(map);

// Style helpers
const lineStyle = { color: '#7aa2ff', weight: 3, opacity: 0.8 };
const lineStyleHover = { color: '#14b8a6', weight: 4, opacity: 1.0 };

function pointStyle(feature) {
  const status = (feature.properties?.status || '').toLowerCase();
  const color = status === 'active' ? '#22c55e' : status === 'declining' ? '#f59e0b' : '#9ca3af';
  return { radius: 6, color: '#0b1220', weight: 1, fillColor: color, fillOpacity: 0.95 };
}
function featureName(p) {
  // prefer your current "Name" (JP), fallbacks for future
  return p.Name || p.name_en || p.name_ja || p.name || 'Unnamed Shotengai';
}

function featureCity(p) {
  // you don't have city/prefecture yet, so show AddressEn or Address
  return p.AddressEn || p.Address || '';
}

function formatLength(m) { if (!m && m !== 0) return null; const km = m / 1000; return m >= 1000 ? `${km.toFixed(2)} km` : `${m} m`; }
function cardHTML(p){
  const title = featureName(p);
  const city = featureCity(p);
  const photo = p.PhotoLocation && /^https?:/i.test(p.PhotoLocation)
    ? `<img src="${p.PhotoLocation}" alt="${title}" style="width:100%;border-radius:10px;margin-top:8px">`
    : '';
  const url = p.url ? `<a href="${p.url}" target="_blank" rel="noopener">Official site</a>` : '';

  return `
    <h3>${title}</h3>
    <div class="meta">${city}</div>
    ${photo}
    <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">${url}</div>
  `;
}


// Layers + state
let pointsLayer, linesLayer, clusterLayer;
let rawFeatures = [];
let fuse;

// Controls
const elSearch = document.getElementById('search');
const elResults = document.getElementById('results');
const elResultCount = document.getElementById('resultCount');
const elTogglePoints = document.getElementById('togglePoints');
const elToggleLines = document.getElementById('toggleLines');
const elToggleCluster = document.getElementById('toggleCluster');
const elToggleActive = document.getElementById('toggleActive');
const elPrefFilter = document.getElementById('prefFilter');
const infoPanel = document.getElementById('infopanel');
const infoCard = document.getElementById('info');

// Fetch data
fetch(DATA_URL).then(r => r.json()).then(geojson => {
  const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
  rawFeatures = features;

  // Pref dropdown
  const prefs = [...new Set(features.map(f => f.properties?.prefecture).filter(Boolean))].sort();
  for (const p of prefs) {
    const opt = document.createElement('option');
    opt.value = p; opt.textContent = p; elPrefFilter.appendChild(opt);
  }

  // Fuse index (include your current fields)
  fuse = new Fuse(features.map((f, i) => ({
    idx: i,
    // these are the fields we’ll search through
    Name: f.properties?.Name || '',
    Address: f.properties?.Address || '',
    AddressEn: f.properties?.AddressEn || '',
    // keep future-friendly keys:
    name: featureName(f.properties || {}),
    city: f.properties?.city || '',
    prefecture: f.properties?.prefecture || '',
    kana: f.properties?.name_kana || '',
    romaji: f.properties?.name_romaji || ''
  })), {
    includeScore: true,
    threshold: 0.3,
    keys: ['Name', 'Address', 'AddressEn', 'name', 'city', 'prefecture', 'kana', 'romaji']
  });


  // Split geometries
  const pointFeats = features.filter(f => ['Point', 'MultiPoint'].includes(f.geometry?.type));
  const lineFeats = features.filter(f => ['LineString', 'MultiLineString'].includes(f.geometry?.type));

  // Lines
  const lines = L.geoJSON(lineFeats, {
    style: lineStyle,
    onEachFeature: (f, layer) => {
      layer.on({
        mouseover: () => layer.setStyle(lineStyleHover),
        mouseout: () => layer.setStyle(lineStyle),
        click: () => showInfo(f, layer.getBounds().getCenter())
      });
    }
  });

  // Points standalone
  const pointsStandalone = L.geoJSON(pointFeats, {
    pointToLayer: (f, latlng) => L.circleMarker(latlng, pointStyle(f)),
    onEachFeature: (f, layer) => layer.on('click', () => showInfo(f, layer.getLatLng()))
  });

  // Clustered points
  clusterLayer = L.markerClusterGroup({
    disableClusteringAtZoom: 15,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    chunkedLoading: true
  });
  const clusterPoints = L.geoJSON(pointFeats, {
    pointToLayer: (f, latlng) => L.circleMarker(latlng, pointStyle(f))
  });
  clusterLayer.addLayer(clusterPoints);

  // Add layers
  pointsLayer = pointsStandalone;
  linesLayer = lines;
  linesLayer.addTo(map);
  clusterLayer.addTo(map);

  // Fit bounds
  try {
    const b = L.latLngBounds();
    features.forEach(f => { const g = L.geoJSON(f); g.getBounds && b.extend(g.getBounds()); });
    if (b.isValid()) map.fitBounds(b.pad(0.06));
  } catch (e) { console.warn('Bounds error', e); }

  // Initial list + UI wiring
  renderList(features);
  elSearch.addEventListener('input', handleFilter);
  elPrefFilter.addEventListener('change', handleFilter);
  elToggleActive.addEventListener('change', handleFilter);

  elTogglePoints.addEventListener('change', () => {
    const show = elTogglePoints.checked;
    if (elToggleCluster.checked) {
      if (show) map.addLayer(clusterLayer); else map.removeLayer(clusterLayer);
    } else {
      if (show) map.addLayer(pointsStandalone); else map.removeLayer(pointsStandalone);
    }
  });
  elToggleLines.addEventListener('change', () => {
    if (elToggleLines.checked) map.addLayer(linesLayer); else map.removeLayer(linesLayer);
  });
  elToggleCluster.addEventListener('change', () => {
    const useCluster = elToggleCluster.checked;
    if (elTogglePoints.checked) {
      if (useCluster) {
        map.removeLayer(pointsStandalone);
        map.addLayer(clusterLayer);
      } else {
        map.removeLayer(clusterLayer);
        map.addLayer(pointsStandalone);
      }
    } else {
      map.removeLayer(clusterLayer);
      map.removeLayer(pointsStandalone);
    }
  });

}).catch(err => {
  console.error('Failed to load GeoJSON', err);
  const fallback = L.marker([35.0116, 135.7681]).addTo(map).bindPopup('Add your GeoJSON at /data/shotengai.geojson');
  fallback.openPopup();
});

function showInfo(feature, center) {
  const p = feature.properties || {};
  infoCard.innerHTML = cardHTML(p);
  infoPanel.style.display = 'block';
  if (center) map.panTo(center);
}

function handleFilter() {
  const q = (document.getElementById('search').value || '').trim();
  const pref = document.getElementById('prefFilter').value;
  const onlyActive = document.getElementById('toggleActive').checked;

  let list = rawFeatures.slice();
  if (pref) list = list.filter(f => (f.properties?.prefecture || '') === pref);
  if (onlyActive) list = list.filter(f => (f.properties?.status || '').toLowerCase() === 'active');

  if (q && fuse) {
    const hits = fuse.search(q).map(h => rawFeatures[h.item.idx]);
    const idset = new Set(list.map(f => rawFeatures.indexOf(f)));
    list = hits.filter(f => idset.has(rawFeatures.indexOf(f)));
  }

  renderList(list);
}

function renderList(features) {
  const elResults = document.getElementById('results');
  const elResultCount = document.getElementById('resultCount');
  elResults.innerHTML = '';
  elResultCount.textContent = features.length;

  const frag = document.createDocumentFragment();
  features.slice(0, 300).forEach(f => {
    const p = f.properties || {};
    const div = document.createElement('div');
    div.className = 'result-item';
    div.innerHTML = `
      <div class="result-name">${featureName(p)}</div>
      <div class="result-meta">${featureCity(p)}</div>
    `;
    div.addEventListener('click', () => zoomToFeature(f));
    frag.appendChild(div);
  });
  elResults.appendChild(frag);
}

function zoomToFeature(f) {
  const g = L.geoJSON(f);
  try {
    const b = g.getBounds();
    if (b && b.isValid()) map.fitBounds(b.pad(0.2));
    else if (f.geometry?.type === 'Point') {
      const [lng, lat] = f.geometry.coordinates;
      map.setView([lat, lng], 17);
    }
  } catch (e) { }
  showInfo(f, null);
}
