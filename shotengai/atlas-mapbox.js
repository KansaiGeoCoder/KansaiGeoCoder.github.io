/* =========================
   Shotengai Atlas (Mapbox + Supabase)
   ========================= */

/* ===== Mapbox Access Token ===== */
mapboxgl.accessToken = 'pk.eyJ1IjoibWF4ZW5pemVyIiwiYSI6ImNrd2s0MW03ZjFvanQyb3FicTljejU4aXcifQ.Z4-6qS1y1JPFHqpxsLKAhA';

/* ===== Supabase config ===== */
const SUPABASE_URL = "https://qdykenvvtqnzdgtzcmhe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkeWtlbnZ2dHFuemRndHpjbWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MDg0MDEsImV4cCI6MjA3NzM4NDQwMX0.zN6Mpfnxr5_ufc6dMDO89LZBXSFYa4ex4vbiu1Q813U";

/* ===== Map Setup ===== */
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11', // Dark theme matching your design
  center: [137.2529, 36.2048], // Japan center
  zoom: 5,
  maxZoom: 22, // Increased from 18 to allow very close inspection
  minZoom: 3
});

map.on('style.load', () => {
  map.setFog({
    'color': 'rgba(26, 26, 26, 0)',
    'high-color': 'rgba(24, 24, 24, 1)',
    'horizon-blend': 0.2,
    'space-color': '#212121',
    'star-intensity': 0.3
  });
  
});

// Add navigation controls
map.addControl(new mapboxgl.NavigationControl(), 'top-right');

// Add geolocate control
map.addControl(
  new mapboxgl.GeolocateControl({
    positionOptions: {
      enableHighAccuracy: true
    },
    trackUserLocation: true
  }),
  'top-right'
);

// Add scale bar (shows distance)
map.addControl(new mapboxgl.ScaleControl({
  maxWidth: 100,
  unit: 'metric' // meters/kilometers
}), 'bottom-right');

// Geocoder removed - using sidebar search instead

/* ===== Mapbox Draw Setup ===== */
let draw = new MapboxDraw({
  displayControlsDefault: false,
  controls: {
    line_string: true,
    trash: true
  },
  defaultMode: 'simple_select',
  styles: [
    // Active line being drawn (bright blue)
    {
      'id': 'gl-draw-line',
      'type': 'line',
      'filter': ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
      'paint': {
        'line-color': '#6aa0ff',
        'line-width': 4
      }
    },
    // Selected/active line (white)
    {
      'id': 'gl-draw-line-active',
      'type': 'line',
      'filter': ['all', ['==', '$type', 'LineString'], ['==', 'active', 'true']],
      'paint': {
        'line-color': '#ffffff',
        'line-width': 5
      }
    },
    // Vertex points outer glow (white)
    {
      'id': 'gl-draw-polygon-and-line-vertex-halo-active',
      'type': 'circle',
      'filter': ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
      'paint': {
        'circle-radius': 8,
        'circle-color': '#ffffff'
      }
    },
    // Vertex points inner circle (bright blue)
    {
      'id': 'gl-draw-polygon-and-line-vertex-active',
      'type': 'circle',
      'filter': ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
      'paint': {
        'circle-radius': 5,
        'circle-color': '#6aa0ff'
      }
    },
    // Midpoint markers (light gray)
    {
      'id': 'gl-draw-line-midpoint',
      'type': 'circle',
      'filter': ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
      'paint': {
        'circle-radius': 4,
        'circle-color': '#cbd5e1'
      }
    }
  ]
});

// Don't add draw control by default - only when editing
let drawControlAdded = false;

/* ===== Snapping Configuration ===== */
const SNAP_DISTANCE_PX = 15; // Snap when within 15 pixels
let snapIndicator = null; // Visual indicator for snap point

// Track when user enters draw mode
map.on('draw.modechange', (e) => {
  console.log('Draw mode changed to:', e.mode);
  
  if (e.mode === 'draw_line_string') {
    console.log('âœï¸ Line drawing mode activated');
    // User clicked the line tool - they're ready to draw
    // Make sure snapping is enabled
    if (!snappingEnabled) {
      enableSnapping(null);
    }
  }
});

/* ===== Snapping Helper Functions ===== */
function findNearbyVertex(point, excludeFeatureId = null) {
  // Convert screen pixel point to map coordinates if needed
  const lngLat = point.lng !== undefined ? point : map.unproject(point);
  
  // Get all vertices from existing features
  const vertices = [];
  
  allFeatures.forEach(feature => {
    // Skip the feature being edited
    if (excludeFeatureId && feature.properties.id === excludeFeatureId) {
      return;
    }
    
    const coords = feature.geometry.type === 'LineString' 
      ? feature.geometry.coordinates 
      : feature.geometry.coordinates.flat();
    
    coords.forEach(coord => {
      vertices.push({
        lng: coord[0],
        lat: coord[1]
      });
    });
  });
  
  // Find closest vertex
  let closestVertex = null;
  let minDistance = Infinity;
  
  vertices.forEach(vertex => {
    const vertexPoint = map.project([vertex.lng, vertex.lat]);
    const mousePoint = map.project([lngLat.lng, lngLat.lat]);
    
    const distance = Math.sqrt(
      Math.pow(vertexPoint.x - mousePoint.x, 2) + 
      Math.pow(vertexPoint.y - mousePoint.y, 2)
    );
    
    if (distance < minDistance && distance < SNAP_DISTANCE_PX) {
      minDistance = distance;
      closestVertex = vertex;
    }
  });
  
  return closestVertex;
}

function showSnapIndicator(lngLat) {
  // Remove existing indicator
  hideSnapIndicator();
  
  // Create snap indicator as a temporary marker
  const el = document.createElement('div');
  el.className = 'snap-indicator';
  el.style.cssText = `
    width: 16px;
    height: 16px;
    border: 2px solid #10b981;
    background: rgba(16, 185, 129, 0.3);
    border-radius: 50%;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
  `;
  
  snapIndicator = new mapboxgl.Marker(el)
    .setLngLat([lngLat.lng, lngLat.lat])
    .addTo(map);
}

function hideSnapIndicator() {
  if (snapIndicator) {
    snapIndicator.remove();
    snapIndicator = null;
  }
}

/* ===== Type Colors ===== */
const TYPE_COLORS = {
  'A': '#10b981',
  'B': '#f59e0b',
  'C': '#ef4444',
  'D': '#3b82f6',
  'default': '#cbd5e1'
};

function getTypeColor(feature) {
  const typeValue = feature.properties?.classification || feature.properties?.type;
  const typeCode = typeValue?.toString().toUpperCase()[0] || 'default';
  return TYPE_COLORS[typeCode] || TYPE_COLORS['default'];
}

/* ===== Feature storage ===== */
let allFeatures = [];
let featureIndexById = new Map();
let allBounds = null;

/* ===== Info Card ===== */
const infoPanel = document.getElementById("infopanel");
const infoCard = document.getElementById("info");

function showInfo(feature) {
  const p = feature.properties;
  const name = p.name_en || p.name_jp || "Unnamed Shotengai";
  const canEdit = !!currentUser;

  const status = (p.status || "").toString().toLowerCase();
  const statusChip = p.status ? `<span class="pill pill-${status}">${p.status}</span>` : "";
  const coveredChip = (p.covered === true || p.covered === false)
    ? `<span class="pill">${p.covered ? "Covered" : "Open-air"}</span>` : "";
  const pedChip = (p.pedestrian_only === true || p.pedestrian_only === false)
    ? `<span class="pill">${p.pedestrian_only ? "Pedestrian-only" : "Mixed traffic"}</span>` : "";
  const typeChip = p.type ? `<span class="pill">${p.type}</span>` : "";

  const kv = (k, v) => v ? `<div class="k">${k}</div><div class="v">${v}</div>` : "";

  let photos = [];
  if (p.image) {
    photos = p.image.split(",").map(s => s.trim()).filter(Boolean);
  }

  const photoHtml = photos.length
    ? `
      <div class="photo-viewer">
        <button class="photo-close" onclick="(window._hideInfo && window._hideInfo())">Ã—</button>
        <img id="photoMain" src="${photos[0]}" alt="${name}" />
        ${photos.length > 1 ? `
          <div class="photo-nav">
            <button id="prevPhoto" class="photo-btn">Ã¢â‚¬Â¹</button>
            <button id="nextPhoto" class="photo-btn">Ã¢â‚¬Âº</button>
          </div>
        ` : ""}
      </div>
    `
    : `<div class="photo-viewer placeholder">
        <button class="photo-close" onclick="(window._hideInfo && window._hideInfo())">Ã—</button>
        <span>No photo available</span>
      </div>`;

  infoCard.innerHTML = `
    ${photoHtml}
    
    <div class="card-head">
      <div class="title">${name}</div>
      ${canEdit ? `
        <button class="btn-edit" onclick="window._openFeatureForm()">Edit Attributes</button>
      ` : ""}
    </div>

    <div class="info-content">
      <div class="info-text">
        <div class="chips">
          ${statusChip}${coveredChip}${pedChip}${typeChip}
          ${p.classification ? `<span class="pill">${p.classification}</span>` : ""}
          ${p.theme ? `<span class="pill">${p.theme}</span>` : ""}
        </div>

        <div class="kv">
          ${kv("City / Pref.", [p.city, p.prefecture].filter(Boolean).join(" - "))}
          ${kv("Length", p.length_m ? `${Math.round(p.length_m)} m` : "")}
          ${kv("Station", p.nearest_station ? `${p.nearest_station}${p.walk_min ? ` - ${p.walk_min} min` : ""}` : "")}
          ${kv("Association", p.association)}
          ${kv("Website", p.url ? `<a href="${p.url}" target="_blank" rel="noopener">Open</a>` : "")}
          ${kv("Source", p.source)}
          ${kv("Updated", p.last_update ? new Date(p.last_update).toLocaleDateString() : "-")}
        </div>

        ${p.notes ? `<div class="desc">${p.notes}</div>` : ""}
      </div>
    </div>
  `;

  window._openFeatureForm = async () => {
    if (!currentUser) { const u = await ensureAuth(); if (!u) return; }
    if (!isEditing) toggleEditMode();
    currentEdit = { mode: "edit", feature };
    window.currentEdit = currentEdit; // Update global reference
    openFeatureForm(feature, "Edit Shotengai");
  };

  if (photos.length > 1) {
    let current = 0;
    const img = infoCard.querySelector("#photoMain");
    infoCard.querySelector("#prevPhoto").addEventListener("click", () => {
      current = (current - 1 + photos.length) % photos.length;
      img.src = photos[current];
    });
    infoCard.querySelector("#nextPhoto").addEventListener("click", () => {
      current = (current + 1) % photos.length;
      img.src = photos[current];
    });
  }

  infoPanel.style.display = "block";
  
  // Ensure hover layer exists and highlight the feature
  if (map.getLayer('shotengai-lines-hover')) {
    map.setPaintProperty('shotengai-lines-hover', 'line-opacity', [
      'case',
      ['==', ['get', 'id'], p.id],
      1,
      0
    ]);
  }
}

function hideInfo() { 
  infoPanel.style.display = "none";
  
  // Also clear the map highlight when hiding info panel
  if (map && map.getLayer && map.getLayer('shotengai-lines-hover')) {
    map.setPaintProperty('shotengai-lines-hover', 'line-opacity', 0);
  }
}
window._hideInfo = (e) => {
  if (e) {
    e.stopPropagation();
  }
  hideInfo();
  
  // Clear current edit state
  currentEdit = { mode: "new", feature: null };
  window.currentEdit = currentEdit;
};

/* ===== Supabase loader ===== */
async function loadSupabaseClient() {
  try {
    const mod = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    return mod.createClient;
  } catch (e1) {
    try {
      const mod = await import("https://unpkg.com/@supabase/supabase-js@2.45.1/+esm");
      return mod.createClient;
    } catch (e2) {
      throw new Error("Could not load supabase-js from any CDN.");
    }
  }
}

/* ===== Supabase client & auth ===== */
let sbClient = null;
let currentUser = null;

const authModal = document.getElementById("authModal");
const authEmail = document.getElementById("authEmail");
const authPass = document.getElementById("authPass");
const authMsg = document.getElementById("authMsg");
const btnLogin = document.getElementById("btnLogin");
const btnCloseAuth = document.getElementById("btnCloseAuth");

function openAuth() {
  if (authModal) {
    authModal.style.display = "flex";
    if (authMsg) authMsg.textContent = "";
  }
}

function closeAuth() {
  if (authModal) {
    authModal.style.display = "none";
    if (authEmail) authEmail.value = "";
    if (authPass) authPass.value = "";
  }
}

async function ensureAuth() {
  const { data: { user } } = await sbClient.auth.getUser();
  if (user) { currentUser = user; return user; }
  openAuth();
  return null;
}

btnLogin?.addEventListener("click", async () => {
  const { error, data } = await sbClient.auth.signInWithPassword({
    email: (authEmail?.value || "").trim(),
    password: authPass?.value || ""
  });
  if (error) {
    if (authMsg) authMsg.textContent = "ÃƒÂ¢Ã‚ÂÃ…â€™ " + error.message;
    return;
  }
  
  // Check user role and redirect accordingly
  if (data?.user) {
    try {
      const { data: profile, error: profileError } = await sbClient
        .from('profiles')
        .select('role, display_name')
        .eq('id', data.user.id)
        .single();
      
      if (authMsg) authMsg.textContent = "Signed in";
      
      // Redirect based on role
      if (!profileError && profile) {
        if (profile.role === 'association' || profile.role === 'shop_owner') {
          // Redirect to dashboard
          if (authMsg) authMsg.textContent = "Redirecting to dashboard...";
          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 500);
          return;
        }
      }
      
      // Default: close auth and enable edit mode (for regular editors/admins)
      setTimeout(() => { closeAuth(); toggleEditMode(); }, 300);
      
    } catch (err) {
      console.error('Error checking user role:', err);
      // On error, just proceed with default behavior
      setTimeout(() => { closeAuth(); toggleEditMode(); }, 300);
    }
  } else {
    setTimeout(() => { closeAuth(); toggleEditMode(); }, 300);
  }
});

btnCloseAuth?.addEventListener("click", closeAuth);

/* ===== Edit mode state ===== */
let isEditing = false;
let isEditingGeometry = false; // Track if we're actively editing a feature's geometry
let currentDrawFeatureId = null; // Track the ID of the feature being edited

function toggleEditMode() {
  if (!isEditing) {
    enterEditMode();
  } else {
    exitEditMode();
  }
}

function enterEditMode() {
  isEditing = true;

  const btnEdit = document.getElementById('btnEdit');
  if (btnEdit) {
    btnEdit.textContent = "Exit Edit Mode";
    btnEdit.classList.add('active');
  }

  // Add draw control to map
  if (!drawControlAdded) {
    map.addControl(draw, 'top-right');
    drawControlAdded = true;
  }

  // Enable snapping for drawing new lines (no feature to exclude)
  enableSnapping(null);

  console.log('[OK] Edit mode enabled with snapping');
}

function exitEditMode() {
  isEditing = false;

  const btnEdit = document.getElementById('btnEdit');
  if (btnEdit) {
    btnEdit.textContent = "Edit Map";
    btnEdit.classList.remove('active');
  }

  // If we're in the middle of editing geometry, cancel it
  if (isEditingGeometry) {
    cancelGeometryEdit();
  }

  // Disable snapping
  disableSnapping();

  // Remove draw control from map
  if (drawControlAdded) {
    // Clear any features in draw before removing
    draw.deleteAll();
    draw.changeMode('simple_select');
    
    map.removeControl(draw);
    drawControlAdded = false;
  }

  // Clear highlight
  if (map.getLayer('shotengai-lines-hover')) {
    map.setPaintProperty('shotengai-lines-hover', 'line-opacity', 0);
  }
  
  // Restore line opacity for all features (in case some were hidden)
  if (map.getLayer('shotengai-lines')) {
    map.setPaintProperty('shotengai-lines', 'line-opacity', 0.9);
  }
  
  isEditingGeometry = false;
  currentDrawFeatureId = null;
  
  console.log('Edit mode disabled');
}

/* ===== New Line Drawing Instructions ===== */
function showNewLineInstructions() {
  // Remove any existing instructions
  const existing = document.getElementById('newLineInstructions');
  if (existing) {
    existing.remove();
  }
  
  // Create instructions overlay
  const instructions = document.createElement('div');
  instructions.id = 'newLineInstructions';
  instructions.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 1000;
    background: #1a2332;
    border: 1px solid #475569;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    min-width: 200px;
  `;
  
  instructions.innerHTML = `
    <div style="color: #e5e7eb; margin-bottom: 12px; font-weight: 600;">
      Drawing New Line
    </div>
    <div style="color: #94a3b8; font-size: 13px; margin-bottom: 16px; line-height: 1.4;">
      â€¢ Click to add points<br>
      â€¢ Double-click to finish<br>
      â€¢ Draw multiple segments if needed
    </div>
    <div style="display: flex; gap: 8px;">
      <button id="btnFinishNewLine" class="btn" style="flex: 1; background: #10b981; color: white; border: none;">
        Finish & Save
      </button>
      <button id="btnCancelNewLine" class="btn btn-ghost" style="flex: 1;">
        Cancel
      </button>
    </div>
  `;
  
  document.body.appendChild(instructions);
  
  // Add event listeners
  document.getElementById('btnFinishNewLine').addEventListener('click', finishNewLine);
  document.getElementById('btnCancelNewLine').addEventListener('click', cancelNewLine);
}

function finishNewLine() {
  console.log('[LINE] Finishing new line...');
  const drawnFeatures = draw.getAll();
  console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ‚Â Drawn features:', drawnFeatures.features.length);
  
  if (drawnFeatures.features.length === 0) {
    console.error('âŒ No drawn features found!');
    alert('No line drawn yet. Please draw a line first by clicking the line tool and adding points on the map.');
    return;
  }
  
  // Get all drawn features (may be multiple line segments)
  const allFeatures = drawnFeatures.features;
  console.log('âœï¸ Processing', allFeatures.length, 'feature(s)');
  
  // Combine into a single feature if multiple segments
  let combinedGeometry;
  
  if (allFeatures.length === 1) {
    combinedGeometry = allFeatures[0].geometry;
    console.log('[INFO] Single feature with', combinedGeometry.coordinates.length, 'vertices');
  } else {
    // Multiple segments - combine into MultiLineString
    const allCoords = allFeatures.map(f => {
      if (f.geometry.type === 'LineString') {
        return f.geometry.coordinates;
      }
      return f.geometry.coordinates;
    });
    
    combinedGeometry = {
      type: 'MultiLineString',
      coordinates: allCoords
    };
    console.log('[INFO] Combined', allCoords.length, 'segments into MultiLineString');
  }
  
  // Create a temporary feature for the form
  const tempFeature = {
    type: 'Feature',
    geometry: combinedGeometry,
    properties: {}
  };
  
  currentEdit = { mode: "new", feature: tempFeature };
  console.log('[OK] Feature ready for form');
  
  // Remove instructions
  const instructions = document.getElementById('newLineInstructions');
  if (instructions) instructions.remove();
  
  // Open form
  openFeatureForm(null, "New Shotengai");
}

function cancelNewLine() {
  // Delete all drawn features
  draw.deleteAll();
  
  // Remove instructions
  const instructions = document.getElementById('newLineInstructions');
  if (instructions) instructions.remove();
  
  currentEdit = { mode: "new", feature: null };
}

/* ===== Geometry Editing Functions ===== */
function startEditingGeometry(feature) {
  if (!currentUser || !isEditing) {
    alert("Please sign in and enable Edit Mode first.");
    return;
  }
  
  if (!feature || !feature.geometry) {
    console.error('âŒ Invalid feature provided to startEditingGeometry');
    return;
  }
  
  // Double-check we have the complete feature from our data store
  const completeFeature = allFeatures.find(f => f.properties.id === feature.properties.id);
  if (completeFeature) {
    feature = completeFeature;
    console.log('[OK] Using complete feature from data store');
  }
  
  isEditingGeometry = true;
  currentDrawFeatureId = feature.properties.id;
  
  // Keep the info panel open (don't hide it)
  // User can see what they're editing while working
  
  // Clear any existing draw features
  draw.deleteAll();
  
  // Function to hide the original feature
  const hideOriginalFeature = () => {
    if (map.getLayer('shotengai-lines')) {
      map.setPaintProperty('shotengai-lines', 'line-opacity', [
        'case',
        ['==', ['get', 'id'], feature.properties.id],
        0,  // Completely hide the feature being edited
        0.9  // Keep others visible
      ]);
    }
    
    if (map.getLayer('shotengai-lines-hover')) {
      map.setPaintProperty('shotengai-lines-hover', 'line-opacity', 0);
    }
  };
  
  // Hide immediately
  hideOriginalFeature();
  
  // Keep it hidden during editing (in case of map refreshes)
  const hideInterval = setInterval(() => {
    if (isEditingGeometry && currentDrawFeatureId === feature.properties.id) {
      hideOriginalFeature();
    } else {
      clearInterval(hideInterval);
    }
  }, 100);
  
  // Store interval ID for cleanup
  window._editHideInterval = hideInterval;
  
  // Handle geometry properly without losing data
  let geometryToEdit = JSON.parse(JSON.stringify(feature.geometry)); // Deep clone
  
  console.log('[INFO] Original geometry:', geometryToEdit);
  console.log('[INFO] Original type:', geometryToEdit.type);
  
  // If it's a MultiLineString, we need to properly flatten it
  if (geometryToEdit.type === 'MultiLineString') {
    console.log(`ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€¦Ã‚Â  MultiLineString with ${geometryToEdit.coordinates.length} segment(s)`);
    
    // Log each segment
    geometryToEdit.coordinates.forEach((segment, i) => {
      console.log(`  Segment ${i}: ${segment.length} vertices`);
    });
    
    // Flatten: concatenate all segments' coordinates into one array
    const allCoords = [];
    geometryToEdit.coordinates.forEach(segment => {
      allCoords.push(...segment); // Spread operator to add each coordinate
    });
    
    console.log(`[INFO] Flattened to ${allCoords.length} total vertices`);
    
    geometryToEdit = {
      type: 'LineString',
      coordinates: allCoords
    };
  } else {
    console.log(`[INFO] Already LineString with ${geometryToEdit.coordinates.length} vertices`);
  }
  
  // Add the feature to draw
  const featureForDraw = {
    type: 'Feature',
    id: feature.properties.id,
    geometry: geometryToEdit,
    properties: feature.properties
  };
  
  console.log('âœï¸ Adding to draw with', geometryToEdit.coordinates.length, 'vertices');
  
  const drawIds = draw.add(featureForDraw);
  
  // Change to direct_select mode to allow vertex editing
  if (drawIds && drawIds.length > 0) {
    draw.changeMode('direct_select', { featureId: drawIds[0] });
  }
  
  console.log('âœï¸ Started editing geometry for:', feature.properties.name_en || feature.properties.name_jp);
  
  // Enable snapping during editing
  enableSnapping(feature.properties.id);
  
  // Show editing controls overlay
  showGeometryEditControls();
}

/* ===== Snapping Event Handlers ===== */
let snappingEnabled = false;
let isDragging = false;
let lastSnapPoint = null;

function enableSnapping(excludeFeatureId) {
  if (snappingEnabled) return;
  
  snappingEnabled = true;
  
  // Use map's mousemove for snapping detection
  map.on('mousemove', handleSnapMouseMove);
}

function handleSnapMouseMove(e) {
  // Only show snap indicator, don't interfere with draw behavior
  // Works for both editing existing lines and drawing new lines
  if (!isEditing) return;
  
  // Find nearby vertex to snap to (exclude feature being edited if any)
  const nearbyVertex = findNearbyVertex(e.lngLat, currentDrawFeatureId);
  
  if (nearbyVertex) {
    showSnapIndicator(nearbyVertex);
    lastSnapPoint = nearbyVertex;
  } else {
    hideSnapIndicator();
    lastSnapPoint = null;
  }
}

function disableSnapping() {
  if (!snappingEnabled) return;
  
  snappingEnabled = false;
  
  map.off('mousemove', handleSnapMouseMove);
  
  hideSnapIndicator();
  lastSnapPoint = null;
}

// Listen to draw events for actual snapping
map.on('draw.update', (e) => {
  // Don't auto-save - wait for user to click Save button
  console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ‚Â Geometry modified (not saved yet)');
  
  // Re-hide the original feature being edited (in case map refresh made it visible)
  if (isEditingGeometry && currentDrawFeatureId && map.getLayer('shotengai-lines')) {
    map.setPaintProperty('shotengai-lines', 'line-opacity', [
      'case',
      ['==', ['get', 'id'], currentDrawFeatureId],
      0,  // Keep it hidden
      0.9
    ]);
  }
  
  // Apply snap if we have a snap point (works for both new and edited lines)
  if (lastSnapPoint && isEditing) {
    const features = draw.getAll().features;
    if (features.length > 0) {
      const feature = features[features.length - 1]; // Get the most recent feature
      const coords = feature.geometry.coordinates;
      
      // Find the vertex that was just moved (closest to last snap point)
      let minDist = Infinity;
      let closestIndex = -1;
      
      coords.forEach((coord, i) => {
        const dist = Math.sqrt(
          Math.pow(coord[0] - lastSnapPoint.lng, 2) + 
          Math.pow(coord[1] - lastSnapPoint.lat, 2)
        );
        
        if (dist < 0.0001) { // Very close = likely the one being dragged
          closestIndex = i;
        }
      });
      
      // If we found a close vertex and snap point is still valid
      if (closestIndex >= 0 && lastSnapPoint) {
        const snapDist = Math.sqrt(
          Math.pow(coords[closestIndex][0] - lastSnapPoint.lng, 2) + 
          Math.pow(coords[closestIndex][1] - lastSnapPoint.lat, 2)
        );
        
        // Snap if within threshold (in map coordinates, roughly 15 pixels)
        if (snapDist < 0.0002) {
          coords[closestIndex] = [lastSnapPoint.lng, lastSnapPoint.lat];
          feature.geometry.coordinates = coords;
          
          // Update draw silently
          const featureId = feature.id;
          draw.delete(featureId);
          draw.add(feature);
          
          // Re-select based on mode
          if (isEditingGeometry) {
            draw.changeMode('direct_select', { featureId: featureId });
          }
        }
      }
    }
  }
});

// Prevent deselection during geometry editing
map.on('draw.selectionchange', (e) => {
  if (isEditingGeometry && e.features.length === 0) {
    // Reselect the feature if it was deselected
    const allFeatures = draw.getAll().features;
    if (allFeatures.length > 0) {
      setTimeout(() => {
        draw.changeMode('direct_select', { featureId: allFeatures[0].id });
      }, 10);
    }
  }
});

function showGeometryEditControls() {
  // Remove any existing controls
  const existingControls = document.getElementById('geometryEditControls');
  if (existingControls) {
    existingControls.remove();
  }
  
  // Create controls overlay
  const controls = document.createElement('div');
  controls.id = 'geometryEditControls';
  controls.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 1000;
    background: #1a2332;
    border: 1px solid #475569;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    min-width: 200px;
  `;
  
  controls.innerHTML = `
    <div style="color: #e5e7eb; margin-bottom: 12px; font-weight: 600;">
      Editing Geometry
    </div>
    <div style="color: #94a3b8; font-size: 13px; margin-bottom: 16px; line-height: 1.4;">
      â€¢ Drag vertices to move them<br>
      â€¢ Click on line to add vertex<br>
      â€¢ Select vertex + Delete to remove
    </div>
    <div style="display: flex; gap: 8px;">
      <button id="btnSaveGeometry" class="btn" style="flex: 1; background: #10b981; color: white; border: none;">
        Save
      </button>
      <button id="btnCancelGeometry" class="btn btn-ghost" style="flex: 1;">
        Cancel
      </button>
    </div>
  `;
  
  document.body.appendChild(controls);
  
  // Add event listeners
  document.getElementById('btnSaveGeometry').addEventListener('click', saveGeometryEdit);
  document.getElementById('btnCancelGeometry').addEventListener('click', cancelGeometryEdit);
}

async function saveGeometryEdit() {
  if (!isEditingGeometry || !currentDrawFeatureId) {
    return;
  }
  
  // Get the edited feature(s) from draw
  const drawnFeatures = draw.getAll();
  if (drawnFeatures.features.length === 0) {
    alert('No geometry to save');
    return;
  }
  
  console.log('[SAVE] Saving edited geometry for feature:', currentDrawFeatureId);
  
  // Store current map view
  const currentCenter = map.getCenter();
  const currentZoom = map.getZoom();
  const currentBearing = map.getBearing();
  const currentPitch = map.getPitch();
  
  // Combine all features into a single geometry
  let finalGeometry;
  
  if (drawnFeatures.features.length === 1) {
    // Single feature - use as is
    finalGeometry = drawnFeatures.features[0].geometry;
  } else {
    // Multiple features - combine into MultiLineString
    const allCoordinates = drawnFeatures.features.map(f => {
      if (f.geometry.type === 'LineString') {
        return f.geometry.coordinates;
      } else if (f.geometry.type === 'MultiLineString') {
        return f.geometry.coordinates;
      }
      return [];
    }).flat();
    
    finalGeometry = {
      type: 'MultiLineString',
      coordinates: allCoordinates
    };
  }
  
  const wkt = wktFromGeom(finalGeometry);
  const { error } = await sbClient.rpc("update_shotengai_geom", { 
    p_id: currentDrawFeatureId, 
    p_geom_wkt: wkt 
  });
  
  if (error) {
    console.error('âŒ Update geometry failed:', error);
    alert("Failed to save geometry: " + error.message);
    return;
  }
  
  console.log('[OK] Geometry saved successfully');
  
  // Update the feature in our local array
  const featureIndex = allFeatures.findIndex(f => f.properties.id === currentDrawFeatureId);
  if (featureIndex >= 0) {
    allFeatures[featureIndex].geometry = finalGeometry;
  }
  
  // Update the map source data directly
  if (map.getSource('shotengai')) {
    map.getSource('shotengai').setData({
      type: 'FeatureCollection',
      features: allFeatures
    });
  }
  
  // Restore line opacity for all features
  map.setPaintProperty('shotengai-lines', 'line-opacity', 0.9);
  
  // Restore the exact map view
  map.jumpTo({
    center: currentCenter,
    zoom: currentZoom,
    bearing: currentBearing,
    pitch: currentPitch
  });
  
  // Clear draw and exit geometry editing mode
  draw.deleteAll();
  draw.changeMode('simple_select');
  
  // Disable snapping
  disableSnapping();
  
  // Clear hide interval
  if (window._editHideInterval) {
    clearInterval(window._editHideInterval);
    window._editHideInterval = null;
  }
  
  isEditingGeometry = false;
  currentDrawFeatureId = null;
  
  // Remove controls
  const controls = document.getElementById('geometryEditControls');
  if (controls) controls.remove();
  
  // Show success message
  const infoMsg = document.createElement('div');
  infoMsg.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; z-index: 10001; box-shadow: 0 4px 12px rgba(0,0,0,0.3);';
  infoMsg.textContent = 'ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ Geometry saved';
  document.body.appendChild(infoMsg);
  setTimeout(() => infoMsg.remove(), 2000);
}

function cancelGeometryEdit() {
  console.log('âŒ Geometry edit cancelled');
  
  // Clear draw
  draw.deleteAll();
  draw.changeMode('simple_select');
  
  // Restore line opacity for all features
  if (map.getLayer('shotengai-lines')) {
    map.setPaintProperty('shotengai-lines', 'line-opacity', 0.9);
  }
  
  // Disable snapping
  disableSnapping();
  
  // Clear hide interval
  if (window._editHideInterval) {
    clearInterval(window._editHideInterval);
    window._editHideInterval = null;
  }
  
  isEditingGeometry = false;
  currentDrawFeatureId = null;
  
  // Remove controls
  const controls = document.getElementById('geometryEditControls');
  if (controls) {
    controls.remove();
    console.log('[OK] Removed geometry edit controls');
  }
  
  // Show the info panel again if we have a current feature
  if (currentEdit?.feature) {
    showInfo(currentEdit.feature);
  } else {
    // If no current feature, just hide the info panel
    hideInfo();
  }
}

window._startEditingGeometry = startEditingGeometry;

/* ===== Geometry helpers ===== */
function toMultiLine(geom) {
  if (!geom) throw new Error("No geometry");
  if (geom.type === "MultiLineString") return geom;
  if (geom.type === "LineString") return { type: "MultiLineString", coordinates: [geom.coordinates] };
  throw new Error("Only LineString/MultiLineString supported");
}

function wktFromGeom(geom) {
  const g = toMultiLine(geom);
  const parts = g.coordinates.map(line => `(${line.map(([x, y]) => `${x} ${y}`).join(",")})`).join(",");
  return `MULTILINESTRING(${parts})`;
}

/* ===== Feature form fields ===== */
const FEATURE_FIELDS = [
  { key: "id", label: "ID", type: "hidden" },
  { key: "slug", label: "Slug", type: "text", group: "Identification" },
  { key: "name_en", label: "Name (EN)", type: "text", group: "Names", required: true },
  { key: "name_jp", label: "Name (JP)", type: "text", group: "Names" },
  { key: "city", label: "City", type: "text", group: "Location" },
  { key: "prefecture", label: "Prefecture", type: "text", group: "Location" },
  { key: "status", label: "Status", type: "select", group: "Status", options: ["active", "declining", "closed", "planned", "unknown"] },
  { key: "covered", label: "Covered arcade", type: "checkbox", group: "Status" },
  { key: "pedestrian_only", label: "Pedestrian only", type: "checkbox", group: "Status" },
  { key: "type", label: "Type", type: "text", group: "Classification" },
  { key: "classification", label: "Classification (detail)", type: "text", group: "Classification" },
  { key: "theme", label: "Theme", type: "text", group: "Classification" },
  { key: "length_m", label: "Length (m)", type: "number", step: "1", group: "Metrics" },
  { key: "width_avg", label: "Width avg (m)", type: "number", step: "0.1", group: "Metrics" },
  { key: "shops_est", label: "Shops (est.)", type: "number", step: "1", group: "Metrics" },
  { key: "established", label: "Established (year)", type: "number", step: "1", group: "History" },
  { key: "last_renov", label: "Last renovation (year)", type: "number", step: "1", group: "History" },
  { key: "nearest_station", label: "Nearest station", type: "text", group: "Access" },
  { key: "walk_min", label: "Walk (min)", type: "number", step: "1", group: "Access" },
  { key: "association", label: "Association", type: "text", group: "Links" },
  { key: "url", label: "Website URL", type: "url", group: "Links" },
  { key: "image", label: "Image URL", type: "url", group: "Links" },
  { key: "source", label: "Data source", type: "text", group: "Links" },
  { key: "description", label: "Description", type: "textarea", rows: 3, group: "Notes" },
  { key: "accuracy", label: "Accuracy note", type: "text", group: "Notes" }
];

const FEATURE_GROUP_ORDER = ["Identification", "Names", "Location", "Status", "Classification", "Metrics", "History", "Access", "Links", "Notes"];

let currentEdit = { mode: "new", feature: null };

// Make currentEdit accessible globally for button onclick handlers
window.currentEdit = currentEdit;

const featureModal = document.getElementById("featureModal");
const featureFormBody = document.getElementById("featureFormBody");
const featureFormTitle = document.getElementById("featureFormTitle");
const btnSaveFeature = document.getElementById("btnSaveFeature");
const btnCancelFeature = document.getElementById("btnCancelFeature");
const featureMsg = document.getElementById("featureMsg");

function openFeatureModal() { featureModal.style.display = "flex"; }
function closeFeatureModal() {
  featureModal.style.display = "none";
  if (featureMsg) featureMsg.textContent = "";
}

btnCancelFeature?.addEventListener("click", closeFeatureModal);

function buildFeatureForm(props = {}) {
  featureFormBody.innerHTML = "";
  const groups = {};
  FEATURE_GROUP_ORDER.forEach(g => groups[g] = []);

  FEATURE_FIELDS.forEach(f => {
    const group = f.group || "Other";
    const val = props[f.key];
    const id = "f_" + f.key;
    let control = "";

    if (f.type === "hidden") {
      control = `<input id="${id}" type="hidden" value="${val ?? ""}">`;
      (groups[FEATURE_GROUP_ORDER[0]] ||= []).push({ key: f.key, html: control });
      return;
    }
    if (f.type === "textarea") {
      control = `
        <div class="form-row">
          <label for="${id}">${f.label}${f.required ? " *" : ""}</label>
          <textarea id="${id}" rows="${f.rows || 3}">${val ?? ""}</textarea>
        </div>`;
    } else if (f.type === "checkbox") {
      control = `
        <div class="form-row cb-row">
          <input id="${id}" type="checkbox" ${val ? "checked" : ""}>
          <label for="${id}" style="margin:0">${f.label}</label>
        </div>`;
    } else if (f.type === "select") {
      const opts = (f.options || []).map(o => `<option value="${o}" ${val === o ? "selected" : ""}>${o}</option>`).join("");
      control = `
        <div class="form-row">
          <label for="${id}">${f.label}${f.required ? " *" : ""}</label>
          <select id="${id}"><option value="">ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ</option>${opts}</select>
        </div>`;
    } else {
      control = `
        <div class="form-row">
          <label for="${id}">${f.label}${f.required ? " *" : ""}</label>
          <input id="${id}" type="${f.type}" ${f.step ? `step="${f.step}"` : ""} value="${val ?? ""}">
        </div>`;
    }
    (groups[group] ||= []).push({ key: f.key, html: control });
  });

  FEATURE_GROUP_ORDER.forEach(g => {
    const items = groups[g];
    if (!items || items.length === 0) return;

    const block = document.createElement("div");
    const isFull = (g === "Notes" || g === "Links");
    block.className = `form-group ${isFull ? "fullwidth" : "compact"}`;
    block.setAttribute("data-group", g);

    if (g === "Status") {
      const statusRow = items.find(x => x.key === "status")?.html || "";
      const covered = items.find(x => x.key === "covered")?.html || "";
      const pedOnly = items.find(x => x.key === "pedestrian_only")?.html || "";
      block.innerHTML = `
        <h4>${g}</h4>
        <div class="form-row" style="grid-column:1 / -1">${statusRow}</div>
        <div class="status-inline">
          <div></div>
          <div class="cb">${covered.replace('class="form-row cb-row"', '')}</div>
          <div class="cb">${pedOnly.replace('class="form-row cb-row"', '')}</div>
        </div>`;
    } else {
      block.innerHTML = `<h4>${g}</h4>${items.map(x => x.html).join("")}`;
    }

    featureFormBody.appendChild(block);
  });
}

function readFeatureForm() {
  const obj = {};
  FEATURE_FIELDS.forEach(f => {
    const id = "f_" + f.key;
    const el = document.getElementById(id);
    if (!el) return;
    if (f.type === "checkbox") obj[f.key] = el.checked;
    else if (f.type === "number") obj[f.key] = el.value === "" ? null : Number(el.value);
    else obj[f.key] = el.value === "" ? null : el.value;
  });

  const descriptionValue = document.getElementById('f_description')?.value.trim() || null;
  obj.notes = descriptionValue;

  return obj;
}

function openFeatureForm(feature, title) {
  currentEdit.mode = feature?.properties?.id ? "edit" : "new";
  currentEdit.feature = feature || null;
  
  featureFormTitle.textContent = title || (currentEdit.mode === "edit" ? "Edit Shotengai" : "New Shotengai");
  buildFeatureForm(feature?.properties || {});

  const photosBlock = document.createElement("div");
  photosBlock.className = "form-group fullwidth photos-group";
  photosBlock.innerHTML = `
    <h4>Photos</h4>
    <div class="dropzone" id="dz">
      <input id="fileInput" type="file" accept="image/*" multiple />
      <div class="drop-hint">Drag & drop images here, or click to select (JPG/PNG, ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°Ãƒâ€šÃ‚Â¤ 5 MB each)</div>
      <div class="progress"><i></i></div>
    </div>
    <div class="thumb-list" id="thumbs"></div>
  `;
  featureFormBody.appendChild(photosBlock);

  const urls = (feature?.properties?.image || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  updateThumbs(urls);

  setupDropzone({
    bucket: "shotengai-photos",
    currentId: feature?.properties?.id || null,
    currentSlug: feature?.properties?.slug || "",
    onUploaded: (newUrls) => {
      const field = document.getElementById("f_image");
      const arr = (field?.value ? field.value.split(",").map(s => s.trim()).filter(Boolean) : []);
      const merged = [...arr, ...newUrls];
      if (field) field.value = merged.join(", ");
      updateThumbs(merged);
    },
    onRemoved: (urlToRemove) => {
      const field = document.getElementById("f_image");
      const arr = (field?.value ? field.value.split(",").map(s => s.trim()).filter(Boolean) : []);
      const next = arr.filter(u => u !== urlToRemove);
      if (field) field.value = next.join(", ");
      updateThumbs(next);
    }
  });

  openFeatureModal();
}

window._openFeatureForm = () => openFeatureForm(currentEdit.feature || null, "Edit Shotengai");

/* ===== Save (insert or update) ===== */
btnSaveFeature?.addEventListener("click", async () => {
  try {
    if (!currentUser) { await ensureAuth(); if (!currentUser) return; }

    const props = readFeatureForm();
    props.notes = document.getElementById('f_description')?.value.trim() || null;

    if (!props.name_en && !props.name_jp) {
      featureMsg.textContent = "âŒ Please provide at least a name (EN or JP).";
      return;
    }

    let geom = null;
    
    if (currentEdit.mode === "new") {
      // Get geometry from drawn features
      const drawnFeatures = draw.getAll();
      if (drawnFeatures.features.length === 0) { 
        featureMsg.textContent = "âŒ No geometry. Draw a line first."; 
        return; 
      }
      
      // Combine all drawn features into one geometry
      if (drawnFeatures.features.length === 1) {
        geom = drawnFeatures.features[0].geometry;
      } else {
        // Multiple segments - combine into MultiLineString
        const allCoords = drawnFeatures.features.map(f => {
          if (f.geometry.type === 'LineString') {
            return f.geometry.coordinates;
          } else if (f.geometry.type === 'MultiLineString') {
            return f.geometry.coordinates;
          }
          return [];
        }).flat();
        
        geom = {
          type: 'MultiLineString',
          coordinates: allCoords
        };
      }
    } else {
      if (currentEdit.feature?.geometry) geom = currentEdit.feature.geometry;
      else { featureMsg.textContent = "âŒ No geometry on feature."; return; }
    }
    
    const wkt = wktFromGeom(geom);
    const id = props.id || currentEdit.feature?.properties?.id || null;

    if (!props.slug) {
      props.slug = (props.name_en || props.name_jp || "sg")
        .toLowerCase()
        .replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "").replace(/--+/g, "-").slice(0, 50);
    }

    const { data, error } = await sbClient.rpc("upsert_shotengai", {
      p_geom_wkt: wkt,
      p_id: id,
      p_props: props
    });
    if (error) throw error;

    const newId =
      Array.isArray(data)
        ? (data[0]?.out_id ?? data[0]?.id ?? data[0])
        : (data?.out_id ?? data?.id);

    featureMsg.textContent = "[OK] Saved";
    const updatedProps = {
      ...props,
      id: newId,
      last_update: new Date().toISOString()
    };

    if (currentEdit.feature) {
      currentEdit.feature.properties = updatedProps;
    }

    // Update the map
    await loadAndDisplayFeatures();
    
    showInfo({ type: "Feature", properties: updatedProps, geometry: geom });
    closeFeatureModal();

    // Clear draw
    draw.deleteAll();
    
    // Remove new line instructions if they exist
    const instructions = document.getElementById('newLineInstructions');
    if (instructions) instructions.remove();

  } catch (err) {
    console.error("[save] failed", err);
    featureMsg.textContent = "âŒ " + (err?.message || err);
  }
});

/* ===== Draw events ===== */
map.on('draw.create', async (e) => {
  const feature = e.features[0];
  
  if (!currentUser) {
    alert("Sign in to create features.");
    draw.delete(feature.id);
    return;
  }

  if (!isEditing) {
    alert("Enter Edit Mode to create features.");
    draw.delete(feature.id);
    return;
  }

  // Keep the feature in draw so user can continue adding to it or modify it
  // Don't open form yet - user can click "Finish" or we open on manual trigger
  currentEdit = { mode: "new", feature: null };
  
  // Show a temporary message that they can continue drawing or finish
  showNewLineInstructions();
});

map.on('draw.delete', async (e) => {
  // Remove new line instructions if they exist
  const instructions = document.getElementById('newLineInstructions');
  if (instructions) {
    instructions.remove();
  }
  
  if (!currentUser) return;
  
  for (const feature of e.features) {
    const id = feature.properties?.id;
    if (!id) {
      // This is a new feature being drawn, just remove from draw
      console.log('Deleted new feature before saving');
      continue;
    }
    
    // This is an existing saved feature
    const { error } = await sbClient.from("shotengai").delete().eq("id", id);
    if (error) {
      alert("Delete failed: " + error.message);
    } else {
      featureIndexById.delete(id);
      allFeatures = allFeatures.filter(f => f.properties.id !== id);
      await loadAndDisplayFeatures();
      applyFilters();
    }
  }
});

/* ===== Fuzzy Search with Fuse.js ===== */
let fuseInstance = null;

function initializeFuzzySearch() {
  if (!allFeatures.length) return;
  
  // Create Fuse instance for fuzzy searching
  fuseInstance = new Fuse(allFeatures, {
    keys: [
      { name: 'properties.name_en', weight: 2 },
      { name: 'properties.name_jp', weight: 2 },
      { name: 'properties.city', weight: 1 },
      { name: 'properties.prefecture', weight: 1 },
      { name: 'properties.slug', weight: 0.5 },
      { name: 'properties.type', weight: 0.5 },
      { name: 'properties.classification', weight: 0.5 }
    ],
    threshold: 0.4, // 0.0 = perfect match, 1.0 = match anything
    ignoreLocation: true, // Don't care about position of match
    minMatchCharLength: 2
  });
  
  console.log('[OK] Fuzzy search initialized');
}

/* ===== Filtering ===== */
let searchInput, prefFilter;
const MAX_RESULTS = 50;

function applyFilters(triggerZoom = false) {
  searchInput = searchInput || document.getElementById("search");
  prefFilter = prefFilter || document.getElementById("prefFilter");

  const qRaw = (searchInput?.value ?? "");
  const pfRaw = (prefFilter?.value ?? "");

  const q = qRaw.trim();
  const pf = pfRaw.trim().toLowerCase();

  let matches = [];
  
  // Use fuzzy search if query exists and Fuse is initialized
  if (q && fuseInstance) {
    const fuzzyResults = fuseInstance.search(q);
    matches = fuzzyResults.map(result => result.item);
    console.log(`ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â Fuzzy search for "${q}" found ${matches.length} results`);
  } else if (!q) {
    // No search query - show all features
    matches = [...allFeatures];
  } else {
    // Fallback to simple search if Fuse not ready
    matches = allFeatures.filter(f => {
      const p = f.properties || {};
      return [
        p.name_en, p.name_jp, p.city, p.prefecture, p.slug, p.type, p.classification
      ].filter(Boolean).some(v => String(v).toLowerCase().includes(q.toLowerCase()));
    });
  }
  
  // Apply prefecture filter
  if (pf) {
    matches = matches.filter(f => {
      const p = f.properties || {};
      const pPref = (p.prefecture || "").trim().toLowerCase();
      return pPref === pf;
    });
  }

  // Update layer opacity based on filter
  if (map.getLayer('shotengai-lines')) {
    const matchIds = new Set(matches.map(f => f.properties.id));
    
    map.setPaintProperty('shotengai-lines', 'line-opacity', [
      'case',
      ['in', ['get', 'id'], ['literal', Array.from(matchIds)]],
      0.9,
      0.15
    ]);
  }

  const filteredStats = computeStats(matches);
  renderSummary(document.getElementById("summaryFiltered"), filteredStats, "filtered");

  const resultsContainer = document.getElementById("results");
  const resultCount = document.getElementById("resultCount");
  if (resultCount) resultCount.textContent = matches.length;

  if (resultsContainer) {
    const limited = matches.slice(0, MAX_RESULTS);
    resultsContainer.innerHTML = limited.map(f => {
      const p = f.properties;
      const name = p.name_en || p.name_jp || "Unnamed Shotengai";
      const status = (p.status || "").toString().toLowerCase();
      const color =
        status === "active" ? "#22c55e" :
          status === "declining" ? "#f59e0b" :
            status === "closed" ? "#ef4444" : "#9ca3af";
      return `<div class="result-item" data-id="${p.id}" style="border-left:4px solid ${color}">
      <div class="result-name">${name}</div>
      <div class="result-meta">${[p.city, p.prefecture].filter(Boolean).join(" Â· ")}</div>
    </div>`;
    }).join("");

    const remaining = matches.length - limited.length;
    if (remaining > 0) {
      resultsContainer.insertAdjacentHTML(
        "beforeend",
        `<div class="results-footer">+${remaining} moreÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ refine filters to narrow down.</div>`
      );
    }

    resultsContainer.querySelectorAll(".result-item").forEach(el => {
      el.addEventListener("click", () => {
        const id = el.dataset.id;
        const feat = allFeatures.find(f => String(f.properties.id) === String(id));
        if (!feat) return;
        
        // Zoom to feature (instant - no animation)
        const coords = feat.geometry.type === 'LineString' 
          ? feat.geometry.coordinates 
          : feat.geometry.coordinates.flat();
        
        const bounds = coords.reduce((bounds, coord) => {
          return bounds.extend(coord);
        }, new mapboxgl.LngLatBounds(coords[0], coords[0]));
        
        map.fitBounds(bounds, { 
          padding: 50
          // Instant zoom (no animation)
        });
        
        // Update current edit state
        currentEdit = { mode: "edit", feature: feat };
        window.currentEdit = currentEdit;
        
        // Highlight the feature on the map - use NUMERIC id for proper comparison
        if (map.getLayer('shotengai-lines-hover')) {
          map.setPaintProperty('shotengai-lines-hover', 'line-opacity', [
            'case',
            ['==', ['get', 'id'], feat.properties.id], // Use actual numeric ID from feature
            1,
            0
          ]);
        }
        
        // Show info panel
        showInfo(feat);
      });
    });
  }

  if (triggerZoom && matches.length > 0) {
    const coords = matches.flatMap(f => 
      f.geometry.type === 'LineString' 
        ? f.geometry.coordinates 
        : f.geometry.coordinates.flat()
    );
    
    if (coords.length > 0) {
      const bounds = coords.reduce((bounds, coord) => {
        return bounds.extend(coord);
      }, new mapboxgl.LngLatBounds(coords[0], coords[0]));
      
      map.fitBounds(bounds, { padding: 40 });
    }
  }
}

/* ===== Photo upload ===== */
async function uploadShotengaiPhoto(file, { bucket, id, slug }) {
  if (!currentUser) { const u = await ensureAuth(); if (!u) throw new Error("Sign in required"); }
  const cleanSlug = (slug || id || "shotengai").toString().toLowerCase().replace(/[^a-z0-9-_]/g, "");
  const ts = new Date().toISOString().replace(/[\W:]/g, "").slice(0, 15);
  const key = `${cleanSlug}/${ts}_${file.name.replace(/\s+/g, "_")}`;

  const { error: upErr } = await sbClient.storage.from(bucket).upload(key, file, {
    cacheControl: "3600", upsert: false,
    contentType: file.type || "image/jpeg"
  });
  if (upErr) throw upErr;

  const { data: pub } = sbClient.storage.from(bucket).getPublicUrl(key);
  return pub.publicUrl;
}

function setupDropzone({ bucket, currentId, currentSlug, onUploaded, onRemoved }) {
  const dz = document.getElementById("dz");
  const fi = document.getElementById("fileInput");
  const bar = dz.querySelector(".progress");
  const fill = bar.querySelector("i");

  function setProgress(p) { bar.style.display = "block"; fill.style.width = `${p}%`; if (p >= 100) setTimeout(() => bar.style.display = "none", 400); }
  function resetProgress() { bar.style.display = "none"; fill.style.width = "0"; }

  async function handleFiles(files) {
    const allowed = Array.from(files).filter(f => /^image\//.test(f.type) && f.size <= 5 * 1024 * 1024);
    if (!allowed.length) return;
    const urls = [];
    let done = 0;
    for (const f of allowed) {
      try {
        const url = await uploadShotengaiPhoto(f, { bucket, id: currentId, slug: currentSlug });
        urls.push(url);
      } finally {
        done++; setProgress(Math.round(done / allowed.length * 100));
      }
    }
    resetProgress();
    if (urls.length && onUploaded) onUploaded(urls);
  }

  dz.addEventListener("click", () => fi.click());
  fi.addEventListener("change", e => handleFiles(e.target.files));

  ["dragenter", "dragover"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add("drag"); }));
  ["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove("drag"); }));
  dz.addEventListener("drop", e => handleFiles(e.dataTransfer.files));

  dz.addEventListener("paste", e => {
    const items = e.clipboardData?.files || [];
    if (items.length) handleFiles(items);
  });

  dz._removeUrl = (u) => onRemoved && onRemoved(u);
}

function updateThumbs(urlArr) {
  const list = document.getElementById("thumbs");
  if (!list) return;
  list.innerHTML = urlArr.map(u => `
    <div class="thumb" data-url="${u}">
      <img src="${u}" alt="">
      <button class="x" title="Remove">ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â</button>
    </div>
  `).join("");

  list.querySelectorAll(".thumb .x").forEach(btn => {
    btn.addEventListener("click", () => {
      const u = btn.parentElement.getAttribute("data-url");
      const dz = document.getElementById("dz");
      dz?._removeUrl?.(u);
    });
  });
}

/* ===== Summary helpers ===== */
function fmtLen(m) {
  if (!m || m <= 0) return "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ";
  if (m >= 1000) return (m / 1000).toFixed(1).replace(/\.0$/, "") + " km";
  return Math.round(m) + " m";
}

function median(nums) {
  const a = nums.filter(x => typeof x === "number" && isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function computeStats(list) {
  const out = { count: 0, byStatus: {}, covered: 0, ped: 0, lenSum: 0, lenAvg: null, lenMed: null, prefCount: 0 };
  if (!Array.isArray(list) || !list.length) return out;

  out.count = list.length;
  const lens = [];
  const prefs = new Set();

  list.forEach(f => {
    const p = f.properties || {};
    const st = (p.status || "unknown").toString().toLowerCase();
    out.byStatus[st] = (out.byStatus[st] || 0) + 1;
    if (p.covered === true) out.covered++;
    if (p.pedestrian_only === true) out.ped++;
    if (typeof p.length_m === "number") { out.lenSum += p.length_m; lens.push(p.length_m); }
    if (p.prefecture) prefs.add(p.prefecture);
  });

  out.prefCount = prefs.size;
  out.lenAvg = lens.length ? out.lenSum / lens.length : null;
  out.lenMed = median(lens);
  return out;
}

function renderSummary(el, stats, label) {
  if (!el) return;
  const s = stats || {};
  const by = s.byStatus || {};
  el.innerHTML = `
    <div class="summary-k">Features</div><div class="summary-v">${s.count || 0}${label ? ` (${label})` : ""}</div>
    <div class="summary-k">Prefectures</div><div class="summary-v">${s.prefCount || 0}</div>
    <div class="summary-k">Total length</div><div class="summary-v">${fmtLen(s.lenSum)}</div>
    <div class="summary-k">Avg length</div><div class="summary-v">${fmtLen(s.lenAvg)}</div>
    <div class="summary-k">Median length</div><div class="summary-v">${fmtLen(s.lenMed)}</div>
    <div class="summary-k">Covered</div><div class="summary-v">${s.covered || 0}</div>
    <div class="summary-k">Ped-only</div><div class="summary-v">${s.ped || 0}</div>
    <div class="summary-k">Status</div><div class="summary-v">
      ${Object.entries(by).map(([k, v]) => `${k}: ${v}`).join(" Â· ") || "Ã¢â‚¬â€œ"}
    </div>
  `;
}

/* ===== About modal ===== */
const aboutModal = document.getElementById("aboutModal");
const btnAbout = document.getElementById("btnAbout");
const btnCloseAbout = document.getElementById("btnCloseAbout");

function openAbout() { if (aboutModal) aboutModal.style.display = "flex"; }
function closeAbout() { if (aboutModal) aboutModal.style.display = "none"; }

btnAbout?.addEventListener("click", openAbout);
btnCloseAbout?.addEventListener("click", closeAbout);

aboutModal?.addEventListener("click", (e) => { if (e.target === aboutModal) closeAbout(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAuth(); });

/* ===== Contact modal ===== */
const modalContact = document.getElementById('modalContact');
const btnContact = document.getElementById('btnContact');
const btnCloseContact = document.getElementById('btnCloseContact');

btnContact?.addEventListener('click', () => {
  modalContact.style.display = 'flex';
});

btnCloseContact?.addEventListener('click', () => {
  modalContact.style.display = 'none';
});

// Dashboard button
const btnDashboard = document.getElementById('btnDashboard');
btnDashboard?.addEventListener('click', () => {
  window.location.href = 'dashboard.html';
});


modalContact?.querySelector('form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  alert("Thank you for your suggestion! (Form submission logic needs to be implemented)");
  modalContact.style.display = 'none';
});

/* ===== Add legend ===== */
function addMapLegend() {
  const legendEl = document.createElement('div');
  legendEl.className = 'legend';
  legendEl.innerHTML = `
    <h4>Shotengai Type</h4>
    <div class="legend-item">
      <div class="legend-color" style="background: ${TYPE_COLORS['A']}"></div>
      <span>A: fully covered street</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background: ${TYPE_COLORS['B']}"></div>
      <span>B: pedestrian only street</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background: ${TYPE_COLORS['C']}"></div>
      <span>C: street adjacent covered sidewalk</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background: ${TYPE_COLORS['D']}"></div>
      <span>D: normal street with Shotengai association</span>
    </div>
  `;
  
  // Add legend directly to the page (not as a Mapbox control)
  document.body.appendChild(legendEl);
}

/* ===== Load and display features on map ===== */
async function loadAndDisplayFeatures() {
  try {
    console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾ Loading features from Supabase...');
    
    // Try the view first
    let features = [];
    try {
      const { data: viewData, error: viewError } = await sbClient
        .from('v_shotengai_geojson')
        .select('geojson')
        .single();
      
      if (viewError) {
        console.warn('ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â View query failed, trying direct table query:', viewError);
        throw viewError;
      }

      console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ‚Â¦ Raw data from view:', viewData);

      const geojson = viewData?.geojson;
      console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ÂÃƒâ€šÃ‚ÂºÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â GeoJSON data:', geojson);
      
      features = geojson?.features || [];
    } catch (viewErr) {
      // Fallback: Load directly from shotengai table
      console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾ Attempting direct table query...');
      const { data: tableData, error: tableError } = await sbClient
        .from('shotengai')
        .select('*, geom');
      
      if (tableError) {
        console.error('âŒ Table query error:', tableError);
        throw tableError;
      }
      
      console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ‚Â¦ Raw table data:', tableData);
      
      // Convert table rows to GeoJSON features
      features = tableData
        .filter(row => row.geom)
        .map(row => {
          const { geom, ...properties } = row;
          return {
            type: 'Feature',
            geometry: typeof geom === 'string' ? JSON.parse(geom) : geom,
            properties: properties
          };
        });
    }
    
    console.log(`[OK] Loaded ${features.length} features`);
    
    if (features.length === 0) {
      console.warn('ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â No features found in database');
      alert('No Shotengai data found in the database. Please check your Supabase configuration.');
      return;
    }
    
    // Debug: Show sample of classification/type values
    const sampleFeatures = features.slice(0, 5);
    console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€¦Ã‚Â  Sample feature types:', sampleFeatures.map(f => ({
      name: f.properties.name_en || f.properties.name_jp,
      classification: f.properties.classification,
      type: f.properties.type
    })));
    
    allFeatures = features;
    
    // Build feature index
    featureIndexById.clear();
    features.forEach(f => {
      if (f?.properties?.id) {
        featureIndexById.set(f.properties.id, f);
      }
    });

    // Remove existing source/layer if present
    if (map.getSource('shotengai')) {
      if (map.getLayer('shotengai-lines')) map.removeLayer('shotengai-lines');
      if (map.getLayer('shotengai-lines-hover')) map.removeLayer('shotengai-lines-hover');
      map.removeSource('shotengai');
    }
    
    if (map.getSource('shotengai-points')) {
      if (map.getLayer('shotengai-clusters')) map.removeLayer('shotengai-clusters');
      if (map.getLayer('shotengai-cluster-count')) map.removeLayer('shotengai-cluster-count');
      if (map.getLayer('shotengai-unclustered-point')) map.removeLayer('shotengai-unclustered-point');
      map.removeSource('shotengai-points');
    }

    // Convert line features to point features for clustering
    // Use the first coordinate of each line as the point
    const pointFeatures = features.map(f => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: f.geometry.type === 'LineString' 
          ? f.geometry.coordinates[0] 
          : f.geometry.coordinates[0][0]
      },
      properties: f.properties
    }));

    // Add main source WITHOUT clustering (for line geometries)
    map.addSource('shotengai', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: features // Original line features
      }
    });
    
    // Add separate point source WITH clustering (for clusters only - no individual points)
    map.addSource('shotengai-points', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: pointFeatures
      },
      cluster: true,
      clusterMaxZoom: 9, // Stop clustering at zoom 9 (clusters visible zoom 0-9)
      clusterRadius: 50
    });

    // Add cluster circles (visible zoom 0-9)
    map.addLayer({
      id: 'shotengai-clusters',
      type: 'circle',
      source: 'shotengai-points',
      filter: ['has', 'point_count'],
      maxzoom: 10, // Hide clusters at zoom 10+
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#10b981', // Green for small clusters (< 5)
          5,
          '#f59e0b', // Orange for medium clusters (5-10)
          10,
          '#ef4444'  // Red for large clusters (10+)
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          10,  // Small clusters (was 15)
          5,
          14,  // Medium clusters (was 20)
          10,
          18   // Large clusters (was 25)
        ],
        'circle-stroke-width': 0, // No border (was 2)
        'circle-opacity': 0.85
      }
    });

    // Add cluster count labels (visible zoom 0-9)
    map.addLayer({
      id: 'shotengai-cluster-count',
      type: 'symbol',
      source: 'shotengai-points',
      filter: ['has', 'point_count'],
      maxzoom: 10, // Hide at zoom 10+
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 11 // Slightly smaller (was 12)
      },
      paint: {
        'text-color': '#ffffff'
      }
    });

    // Add unclustered point layer (single shotengai that don't cluster, visible zoom 0-9)
    map.addLayer({
      id: 'shotengai-unclustered-point',
      type: 'circle',
      source: 'shotengai-points',
      filter: ['!', ['has', 'point_count']], // Not a cluster
      maxzoom: 10, // Hide at zoom 10+ (when lines take over)
      paint: {
        'circle-color': [
          'match',
          ['upcase', ['coalesce', ['slice', ['get', 'classification'], 0, 1], ['slice', ['get', 'type'], 0, 1], '']],
          'A', TYPE_COLORS['A'],
          'B', TYPE_COLORS['B'],
          'C', TYPE_COLORS['C'],
          'D', TYPE_COLORS['D'],
          TYPE_COLORS['default']
        ],
        'circle-radius': 5, // Smaller (was 8)
        'circle-stroke-width': 0, // No border (was 2)
        'circle-opacity': 0.85
      }
    });

    // Add main layer with proper type-based coloring (visible zoom 10+, ~1.5km scale)
    map.addLayer({
      id: 'shotengai-lines',
      type: 'line',
      source: 'shotengai',
      minzoom: 10, // Lines appear at zoom 10+ (was 9)
      paint: {
        'line-color': [
          'match',
          ['upcase', ['coalesce', ['slice', ['get', 'classification'], 0, 1], ['slice', ['get', 'type'], 0, 1], '']],
          'A', TYPE_COLORS['A'],  // Green - fully covered
          'B', TYPE_COLORS['B'],  // Orange - pedestrian only
          'C', TYPE_COLORS['C'],  // Red - covered sidewalk
          'D', TYPE_COLORS['D'],  // Blue - with association
          TYPE_COLORS['default']  // Gray - default
        ],
        'line-width': 3,
        'line-opacity': 0.9
        // No line-dasharray - solid lines
      }
    });

    // Add hover layer
    map.addLayer({
      id: 'shotengai-lines-hover',
      type: 'line',
      source: 'shotengai',
      minzoom: 10, // Match the main lines layer (was 9)
      paint: {
        'line-color': '#ffffff',
        'line-width': 5,
        'line-opacity': 0
      }
    });

    // Add 3D buildings layer (shows when zoomed in close)
    if (!map.getLayer('3d-buildings')) {
      map.addLayer({
        'id': '3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 15, // Only show at zoom 15+
        'paint': {
          'fill-extrusion-color': '#1a2332', // Match dark theme
          'fill-extrusion-height': [
            'interpolate', ['linear'], ['zoom'],
            15, 0,
            15.05, ['get', 'height']
          ],
          'fill-extrusion-base': [
            'interpolate', ['linear'], ['zoom'],
            15, 0,
            15.05, ['get', 'min_height']
          ],
          'fill-extrusion-opacity': 0.6
        }
      }, 'shotengai-lines'); // Insert below shotengai lines so they're on top
    }


    // Update stats
    const overallStats = computeStats(allFeatures);
    renderSummary(document.getElementById("summaryOverall"), overallStats, "total");
    applyFilters();
    
    // Debug: Check if layers are properly configured
    setTimeout(() => {
      const mainLayer = map.getLayer('shotengai-lines');
      const hoverLayer = map.getLayer('shotengai-lines-hover');
      console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â Main layer exists:', !!mainLayer);
      console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â Hover layer exists:', !!hoverLayer);
      
      // Test if we can query features at a test point
      const testPoint = map.project(map.getCenter());
      const features = map.queryRenderedFeatures(testPoint, {
        layers: ['shotengai-lines']
      });
      console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â Test feature query returned:', features.length, 'features');
    }, 500);
    
    console.log('[OK] Features loaded and displayed');
  } catch (error) {
    console.error('âŒ Failed to load features:', error);
    alert('Failed to load Shotengai data: ' + error.message);
  }
}

/* ===== Register Map Click Handlers (Once) ===== */
function registerMapClickHandlers() {
  // Wait for layers to be ready
  const checkLayersAndRegister = () => {
    if (!map.getLayer('shotengai-lines')) {
      console.warn('ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Layers not ready yet, waiting...');
      setTimeout(checkLayersAndRegister, 100);
      return;
    }
    
    console.log('[OK] Layers confirmed, registering click handlers');
    
    // Click handler for clusters - zoom in when clicked
    map.on('click', 'shotengai-clusters', (e) => {
      console.log('[LINE] Cluster clicked');
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['shotengai-clusters']
      });
      
      const clusterId = features[0].properties.cluster_id;
      const point = features[0].geometry.coordinates;
      
      // Get cluster expansion zoom
      map.getSource('shotengai-points').getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        
        map.easeTo({
          center: point,
          zoom: zoom + 1 // Zoom in a bit more than minimum
          // No duration = default Mapbox easing
        });
      });
    });
    
    // Change cursor on cluster hover
    map.on('mouseenter', 'shotengai-clusters', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    
    map.on('mouseleave', 'shotengai-clusters', () => {
      map.getCanvas().style.cursor = '';
    });
    
    // Click handler for unclustered points (single shotengai at zoom 0-8)
    map.on('click', 'shotengai-unclustered-point', (e) => {
      console.log('[INFO] Single point clicked (zooming to show line)');
      const feature = e.features[0];
      const id = feature.properties.id;
      
      // Find the full feature with geometry
      const fullFeature = allFeatures.find(f => f.properties.id === id);
      if (!fullFeature) return;
      
      // Zoom to zoom level 12 (where lines are clearly visible)
      const coords = fullFeature.geometry.type === 'LineString' 
        ? fullFeature.geometry.coordinates 
        : fullFeature.geometry.coordinates.flat();
      
      const bounds = coords.reduce((bounds, coord) => {
        return bounds.extend(coord);
      }, new mapboxgl.LngLatBounds(coords[0], coords[0]));
      
      map.fitBounds(bounds, { 
        padding: 50,
        maxZoom: 12 // Zoom to level where line is clearly visible
      });
      
      // Update edit state and show info
      currentEdit = { mode: "edit", feature: fullFeature };
      window.currentEdit = currentEdit;
      showInfo(fullFeature);
      
      // Highlight (will be visible once we zoom to line level)
      if (map.getLayer('shotengai-lines-hover')) {
        map.setPaintProperty('shotengai-lines-hover', 'line-opacity', [
          'case',
          ['==', ['get', 'id'], id],
          1,
          0
        ]);
      }
    });
    
    // Cursor for unclustered points
    map.on('mouseenter', 'shotengai-unclustered-point', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    
    map.on('mouseleave', 'shotengai-unclustered-point', () => {
      map.getCanvas().style.cursor = '';
    });
    
    // Use global click handler with feature querying
    map.on('click', (e) => {
      console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“Ãƒâ€šÃ‚Â±ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Map clicked at:', e.lngLat);
      console.log('[INFO] Click point (pixels):', e.point);
      
      // Don't interfere if we're in draw mode - check if draw is initialized first
      if (isEditing && draw && draw.getMode) {
        try {
          const currentMode = draw.getMode();
          if (currentMode === 'draw_line_string' || currentMode === 'draw_polygon') {
            console.log('ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â In draw mode, ignoring click');
            return;
          }
        } catch (err) {
          console.warn('ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Could not get draw mode:', err.message);
        }
      }
      
      // Query rendered features at the click point with a larger buffer for better detection
      // Use a 5px buffer around the click point to catch nearby lines
      const bbox = [
        [e.point.x - 5, e.point.y - 5],
        [e.point.x + 5, e.point.y + 5]
      ];
      
      const features = map.queryRenderedFeatures(bbox, {
        layers: ['shotengai-lines', 'shotengai-lines-hover']
      });
      
      console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â Features found at click point (with 5px buffer):', features.length);
      
      // Also try without buffer for debugging
      const featuresExact = map.queryRenderedFeatures(e.point, {
        layers: ['shotengai-lines', 'shotengai-lines-hover']
      });
      console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â Features found at exact click point:', featuresExact.length);
      
      // Check if layers exist
      if (!map.getLayer('shotengai-lines')) {
        console.error('âŒ Layer shotengai-lines does not exist!');
        return;
      }
      
      if (features.length > 0) {
        // We clicked on a feature!
        const clickedFeatureId = features[0].properties.id;
        console.log('[INFO] Clicked feature ID:', clickedFeatureId);
        console.log('[LINE] Feature properties:', features[0].properties);
        
        // Find the complete feature from our data store
        const completeFeature = allFeatures.find(f => f.properties.id === clickedFeatureId);
        
        if (!completeFeature) {
          console.warn('ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Could not find complete feature for ID:', clickedFeatureId);
          console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ‚Â¦ Available feature IDs:', allFeatures.map(f => f.properties.id));
          return;
        }
        
        console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“Ãƒâ€šÃ‚Â±ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Clicked feature:', completeFeature.properties.name_en || completeFeature.properties.name_jp);
        console.log('[INFO] Complete geometry:', completeFeature.geometry);
        
        // Update current edit state
        currentEdit = { mode: "edit", feature: completeFeature };
        window.currentEdit = currentEdit;
        
        // If in edit mode, show info and start editing geometry
        if (isEditing) {
          showInfo(completeFeature);
          startEditingGeometry(completeFeature);
        } else {
          // If not in edit mode, just show info
          showInfo(completeFeature);
          
          // Highlight clicked feature
          map.setPaintProperty('shotengai-lines-hover', 'line-opacity', [
            'case',
            ['==', ['get', 'id'], clickedFeatureId],
            1,
            0
          ]);
        }
        
        // Stop propagation since we handled the click
        if (e.originalEvent) {
          e.originalEvent.stopPropagation();
        }
      } else {
        // Clicked on background - deselect
        console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ÂÃƒâ€šÃ‚ÂºÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Background click - deselecting');
        
        // Don't deselect if we're actively editing geometry
        if (isEditingGeometry && draw && draw.getAll) {
          console.log('ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Geometry editing active, keeping selection');
          try {
            const allDrawnFeatures = draw.getAll().features;
            if (allDrawnFeatures.length > 0 && draw.changeMode) {
              draw.changeMode('direct_select', { featureId: allDrawnFeatures[0].id });
            }
          } catch (err) {
            console.warn('ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Error maintaining draw selection:', err.message);
          }
          return;
        }
        
        console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Â¹ Clearing info panel and highlights');
        
        // Hide info panel
        hideInfo();
        
        // Clear draw selection if any - BUT only if we're NOT drawing a new feature
        // Check if the instructions panel is visible (indicates we're in the middle of drawing)
        const isDrawingNew = document.getElementById('newLineInstructions') !== null;
        
        if (!isDrawingNew && draw && draw.getAll && draw.deleteAll) {
          try {
            if (draw.getAll().features.length > 0) {
              console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Â¹ Clearing draw features (not in new line mode)');
              draw.deleteAll();
            }
          } catch (err) {
            console.warn('ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Error clearing draw features:', err.message);
          }
        } else if (isDrawingNew) {
          console.log('ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Preserving drawn features (new line in progress)');
        }
        
        // CRITICAL: Clear highlight by setting opacity to 0 for ALL features
        if (map.getLayer('shotengai-lines-hover')) {
          console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Â¹ Clearing hover layer highlight');
          map.setPaintProperty('shotengai-lines-hover', 'line-opacity', 0);
        }
        
        // Clear current edit state
        currentEdit = { mode: "new", feature: null };
        window.currentEdit = currentEdit;
        
        console.log('[OK] Selection cleared');
      }
    });

    // Hover handlers
    map.on('mouseenter', 'shotengai-lines', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      const feature = e.features[0];
      map.setPaintProperty('shotengai-lines-hover', 'line-opacity', [
        'case',
        ['==', ['get', 'id'], feature.properties.id],
        0.6,
        0
      ]);
    });

    map.on('mouseleave', 'shotengai-lines', () => {
      map.getCanvas().style.cursor = '';
      // Keep clicked feature highlighted
      if (currentEdit?.feature?.properties?.id) {
        map.setPaintProperty('shotengai-lines-hover', 'line-opacity', [
          'case',
          ['==', ['get', 'id'], currentEdit.feature.properties.id],
          1,
          0
        ]);
      } else {
        map.setPaintProperty('shotengai-lines-hover', 'line-opacity', 0);
      }
    });
    
    // Ensure canvas is ready and interactive
    const canvas = map.getCanvas();
    if (canvas) {
      canvas.style.cursor = ''; // Reset cursor
      // Small delay to ensure all event handlers are fully bound
      setTimeout(() => {
        console.log('[OK] Canvas interactive and ready for clicks');
      }, 100);
    }
    
    // Test that handlers are actually registered
    const registeredEvents = map._listeners;
    if (registeredEvents && registeredEvents.click) {
      console.log('[OK] Click event listeners registered:', registeredEvents.click.length);
    }
    
    // Force a test to ensure layer is interactive
    map.setPaintProperty('shotengai-lines', 'line-opacity', 0.9);
    console.log('[OK] Layer paint properties accessible');
    
    console.log('[OK] All map click handlers registered');
  }; // End of checkLayersAndRegister
  
  // Start the check
  checkLayersAndRegister();
}

/* ===== Bounds Calculation (part of loadAndDisplayFeatures) ===== */
// This code should be moved back into loadAndDisplayFeatures if needed

/* ===== Auth UI Setup ===== */
function setupAuthUI() {
  const btnEdit = document.getElementById('btnEdit');
  const btnSignIn = document.getElementById('btnSignIn');
  const btnSignUp = document.getElementById('btnSignUp');

  btnEdit?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleEditMode();
  });

  btnSignIn?.addEventListener('click', () => {
    if (btnSignIn.textContent === 'Sign In') {
      document.getElementById('authModal').style.display = 'flex';
    }
  });

  // Add signup button handler
  btnSignUp?.addEventListener('click', () => {
    window.location.href = 'simple-signup.html';
  });

  if (!sbClient) {
    console.error("Supabase client is not defined. Cannot set up auth UI.");
    return;
  }

  sbClient.auth.onAuthStateChange((event, session) => {
    const isLoggedIn = !!session;

    if (btnEdit) {
      btnEdit.style.display = isLoggedIn ? 'block' : 'none';

      if (btnSignIn) {
        btnSignIn.textContent = isLoggedIn ? 'Sign Out' : 'Sign In';

        if (isLoggedIn) {
          // Hide signup button when logged in
          if (btnSignUp) btnSignUp.style.display = 'none';
          
          btnSignIn.onclick = async () => {
            await sbClient.auth.signOut();
          };
        } else {
          // Show signup button when logged out
          if (btnSignUp) btnSignUp.style.display = 'inline-flex';
          btnSignIn.onclick = null;
        }
      }
    }
  });
}

/* ===== Init: Supabase + load data ===== */
(async function init() {
  try {
    console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â¡ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Initializing Shotengai Atlas...');
    console.log('[OK] Mapbox token configured');
    
    // Load Supabase
    console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾ Loading Supabase client...');
    const createClient = await loadSupabaseClient();
    console.log('[OK] Supabase client loaded');
    
    // Test connection
    console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾ Testing Supabase connection...');
    await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/`, { method: "HEAD" });
    console.log('[OK] Supabase connection successful');

    sbClient = createClient(SUPABASE_URL.trim(), SUPABASE_ANON_KEY.trim());

    // Check auth state
    console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾ Checking authentication...');
    sbClient.auth.onAuthStateChange((_e, session) => { 
      currentUser = session?.user || null;
      console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â Auth state changed:', currentUser ? 'Logged in' : 'Logged out');
    });
    
    {
      const { data: { user } } = await sbClient.auth.getUser();
      currentUser = user || null;
      console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“Ãƒâ€šÃ‚Â¤ Current user:', currentUser?.email || 'Not logged in');
    }

    // Wait for map to load
    console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ÂÃƒâ€šÃ‚ÂºÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Waiting for map to load...');
    map.on('load', async () => {
      console.log('[OK] Map loaded successfully');
      
      try {
        await loadAndDisplayFeatures();

        const overallStats = computeStats(allFeatures);
        renderSummary(document.getElementById("summaryOverall"), overallStats, "total");

        prefFilter = document.getElementById("prefFilter");
        if (prefFilter) {
          const prefs = Array.from(new Set(
            allFeatures.map(f => f.properties.prefecture).filter(Boolean)
          )).sort((a, b) => a.localeCompare(b, 'en'));
          prefFilter.innerHTML = `<option value="">All prefectures</option>` +
            prefs.map(p => `<option value="${p}">${p}</option>`).join("");
          console.log(`Loaded ${prefs.length} prefectures into filter`);
        }

        searchInput = document.getElementById("search");
        searchInput?.addEventListener("input", () => applyFilters(false));
        prefFilter?.addEventListener("change", () => applyFilters(true));

        // Initialize fuzzy search
        initializeFuzzySearch();

        applyFilters(false);
        addMapLegend();
        setupAuthUI();
        
        // CRITICAL FIX: Wait for map to be fully idle before registering click handlers
        // The 'load' event fires too early - map needs to finish rendering
        console.log('Waiting for map to be fully interactive...');
        map.once('idle', () => {
          console.log('Map is now idle and fully interactive');
          registerMapClickHandlers();
          console.log('Initialization complete!');
        });
        
      } catch (featureError) {
        console.error('âŒ Error loading features:', featureError);
        alert('Failed to load Shotengai data: ' + (featureError.message || featureError));
      }
    });
    
    map.on('error', (e) => {
      console.error('âŒ Map error:', e);
    });

  } catch (err) {
    console.error("[Atlas] init failed:", err);
    alert("Failed to initialize application: " + (err.message || err));
  }

  // Show Dashboard button for association/shop_owner users
  const btnDashboard = document.getElementById('btnDashboard');
  if (btnDashboard) {
    // Check if user has association role
    sbClient.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        sbClient.from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
          .then(({ data: profile }) => {
            if (profile && (profile.role === 'association' || profile.role === 'shop_owner')) {
              btnDashboard.style.display = 'inline-flex';
            } else {
              btnDashboard.style.display = 'none';
            }
          });
      } else {
        btnDashboard.style.display = 'none';
      }
    });
  }

})();