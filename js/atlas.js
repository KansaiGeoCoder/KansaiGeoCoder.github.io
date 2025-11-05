/* =========================
   Shotengai Atlas (Supabase)
   ========================= */

/* ===== Supabase config (replace) ===== */
const SUPABASE_URL = "https://qdykenvvtqnzdgtzcmhe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkeWtlbnZ2dHFuemRndHpjbWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MDg0MDEsImV4cCI6MjA3NzM4NDQwMX0.zN6Mpfnxr5_ufc6dMDO89LZBXSFYa4ex4vbiu1Q813U";

/* ===== Map Setup ===== */
const basemaps = {
  light: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }),
  dark: L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    { maxZoom: 19, attribution: "&copy; OpenStreetMap &copy; CARTO" })
};

const map = L.map("map", { center: [36.2048, 137.2529], zoom: 5, layers: [basemaps.dark] });

let editableLayers = new L.FeatureGroup().addTo(map);
let drawControl = null;

// Debug code
console.log('Plugin check:', {
  'L.Handler exists': !!L.Handler,
  'MarkerSnap exists': !!L.Handler?.MarkerSnap,
  'GeometryUtil exists': !!L.GeometryUtil
});

L.control.layers({ "Light": basemaps.light, "Dark": basemaps.dark }).addTo(map);
L.Control.geocoder({ defaultMarkGeocode: false })
  .on("markgeocode", (e) => map.fitBounds(e.geocode.bbox))
  .addTo(map);

// Styles
const TYPE_COLORS = {
  'A': '#10b981',
  'B': '#f59e0b',
  'C': '#ef4444',
  'D': '#3b82f6',
  'default': '#cbd5e1' // Gray (Fallback/Missing data)
};
const lineStyleHover = { color: '#ffffff', weight: 8, opacity: 1, interactive: true };

/**
 * Robustly determines the thematic style based on classification property.
 * This is the core fix for the coloring issue.
 */
function getTypeStyle(feature) {
  // Safely retrieve 'type' or fallback to 'classification'.
  const typeValue = feature.properties?.classification || feature.properties?.classification;

  // 1. Safely extract the first character. .toString() is a safety net.
  const typeCode = typeValue?.toString().toUpperCase()[0] || 'default';

  // 2. Determine the key to look up in TYPE_COLORS
  const primaryType = TYPE_COLORS.hasOwnProperty(typeCode) ? typeCode : 'default';

  const color = TYPE_COLORS[primaryType];

  return {
    color: color,
    weight: 6,
    opacity: 0.9,
    interactive: true
  };
}

/**
 * Function to add a Legend Control to the map.
 * This was previously missing and is necessary to confirm color values.
 */
function addMapLegend() {
  const legend = L.control({ position: 'bottomleft' });

  legend.onAdd = function (map) {
    // You MUST also define this '.info.legend' CSS in your atlas.css file
    const div = L.DomUtil.create('div', 'info legend');
    const types = [
      { code: 'A', color: TYPE_COLORS['A'], description: 'fully covered street' },
      { code: 'B', color: TYPE_COLORS['B'], description: 'pedestrian only street' },
      { code: 'C', color: TYPE_COLORS['C'], description: 'street adjacent covered sidewalk' },
      { code: 'D', color: TYPE_COLORS['D'], description: 'normal street with Shotengai association' }
    ];

    let content = '<h4>Shotengai Type</h4>';

    for (let i = 0; i < types.length; i++) {
      content +=
        `<i style="background:${types[i].color};"></i> ${types[i].code}: ${types[i].description}<br>`;
    }

    div.innerHTML = content;
    return div;
  };

  legend.addTo(map);
}


/* ===== Info Card ===== */
const infoPanel = document.getElementById("infopanel");
const infoCard = document.getElementById("info");

/* atlas.js (Replace the entire showInfo function) */

function showInfo(feature) {
  const p = feature.properties || {};
  const name = p.name_en || p.name_jp || "Unnamed Shotengai";

  // FIX 1: Use the correct global variable 'isEditing' (or 'editMode' if that is your current global state)
  // Based on previous code, 'isEditing' is the state variable.
  const canEdit = !!currentUser && isEditing;

  const status = (p.status || "").toString().toLowerCase();
  const statusChip = p.status ? `<span class="pill pill-${status}">${p.status}</span>` : "";
  const coveredChip = (p.covered === true || p.covered === false)
    ? `<span class="pill">${p.covered ? "Covered" : "Open-air"}</span>` : "";
  const pedChip = (p.pedestrian_only === true || p.pedestrian_only === false)
    ? `<span class="pill">${p.pedestrian_only ? "Pedestrian-only" : "Mixed traffic"}</span>` : "";
  const typeChip = p.type ? `<span class="pill">${p.type}</span>` : "";

  const kv = (k, v) => v ? `<div class="k">${k}</div><div class="v">${v}</div>` : "";

  // --- Image(s) ---
  let photos = [];
  if (p.image) {
    // Allow comma-separated list for multiple photos
    photos = p.image.split(",").map(s => s.trim()).filter(Boolean);
  }

  const photoHtml = photos.length
    ? `
      <div class="photo-viewer">
        <img id="photoMain" src="${photos[0]}" alt="${name}" />
        ${photos.length > 1 ? `
          <div class="photo-nav">
            <button id="prevPhoto" class="photo-btn">‹</button>
            <button id="nextPhoto" class="photo-btn">›</button>
          </div>
        ` : ""}
      </div>
    `
    : `<div class="photo-viewer placeholder"><span>No photo available</span></div>`;

  infoCard.innerHTML = `
    <div class="card-head">
      <div class="title">${name}</div>
      <div class="header-controls">
        ${canEdit ? `
          <button class="btn btn-ghost" onclick="window._openFeatureForm()">Edit Attributes</button>
          <button class="btn btn-ghost" onclick="window._startDrawSegment('${p.id}')">Draw Segment</button>
        ` : ""}
        <button class="close" onclick="(window._hideInfo && window._hideInfo())">×</button>
      </div>
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
          ${kv("Website", p.url ? `<a href="${p.url}" target="_blank" rel="noopener">Open ↗</a>` : "")}
          ${kv("Source", p.source)}
          ${kv("Updated", p.last_update ? new Date(p.last_update).toLocaleDateString() : "—")}
        </div>

        ${p.description ? `<div class="desc">${p.description}</div>` : ""}
      </div>
      ${photoHtml}
    </div>
  `;
  
  // NOTE: Slideshow logic and _openFeatureForm definition should be kept outside this string block.
  // ... (Slideshow logic and window._openFeatureForm definition)
  
  infoPanel.style.display = "block";
  // ... (rest of code)
  
  window._openFeatureForm = async () => {
    // ... (This function is crucial for the Edit button to work, ensure it remains)
    if (!currentUser) { const u = await ensureAuth(); if (!u) return; }
    if (!isEditing) toggleEditMode(); 
    currentEdit = { mode: "edit", layer: featureIndexById.get(p.id) || null, feature };
    openFeatureForm(feature, "Edit Shotengai");
  };

  // --- Slideshow logic ---
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

  // Ensure the parent .card of #results gets .results-card (for the CSS above)
  (() => {
    const r = document.getElementById('results');
    const card = r?.closest('.card');
    if (card && !card.classList.contains('results-card')) {
      card.classList.add('results-card');
    }
  })();


  // --- Slideshow logic (unchanged) ---
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

  // --- CRITICAL FIX 3: Update the internal wrapper function ---
  window._openFeatureForm = async () => {
    if (!currentUser) { const u = await ensureAuth(); if (!u) return; }
    // Ensure we enter the correct edit mode if not already in it
    if (!isEditing) toggleEditMode();

    // Set the global context for the form
    currentEdit = { mode: "edit", layer: featureIndexById.get(p.id) || null, feature };

    // Open the form
    openFeatureForm(feature, "Edit Shotengai");
  };
}

function hideInfo() { infoPanel.style.display = "none"; }
window._hideInfo = hideInfo;

// NEW FUNCTION: Start drawing a new segment for an existing feature
function startDrawSegment(entityId) {
  if (!currentUser) { alert("Sign in to draw new segments."); return; }

  // 1. Set the global state
  segmentTargetId = entityId;

  // 2. Hide the info panel and exit main edit mode controls
  hideInfo();

  // Temporarily remove draw control to activate the one-time draw tool
  if (drawControl) map.removeControl(drawControl);
  else enterEditMode(); // Ensure controls are initialized (it's idempotent)

  // 3. Activate the Polyline draw tool once, passing the snap option explicitly
  let drawOptions = drawControl ? drawControl.options.draw.polyline : {};

  // CRITICAL: Ensure snap is available for the manual draw instance
  if (map.snap) {
    drawOptions = { ...drawOptions, snap: map.snap };
  }

  const polylineDraw = new L.Draw.Polyline(map, drawOptions);
  polylineDraw.enable();

  // Give user feedback on the state
  alert("Draw the new segment. Click the last point to finish drawing.");
}
window._startDrawSegment = startDrawSegment; // Expose to HTML

/* ===== Supabase loader (robust) ===== */
async function loadSupabaseClient() {
  try {
    const mod = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    return mod.createClient;
  } catch (e1) {
    try {
      const mod = await import("https://unpkg.com/@supabase/supabase-js@2.45.1/+esm");
      return mod.createClient;
    } catch (e2) {
      throw new Error("Could not load supabase-js from any CDN (blocked or offline).");
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
const btnEditMode = document.getElementById("btnEditMode");
const editStatus = document.getElementById("editStatus");

function openAuth() { if (authModal) { authModal.style.display = "flex"; if (authMsg) authMsg.textContent = ""; } }
function closeAuth() { if (authModal) { authModal.style.display = "none"; if (authEmail) authEmail.value = ""; if (authPass) authPass.value = ""; } }

async function ensureAuth() {
  const { data: { user } } = await sbClient.auth.getUser();
  if (user) { currentUser = user; return user; }
  openAuth(); return null;
}

btnLogin?.addEventListener("click", async () => {
  const { error } = await sbClient.auth.signInWithPassword({
    email: (authEmail?.value || "").trim(),
    password: authPass?.value || ""
  });
  if (error) { if (authMsg) authMsg.textContent = "❌ " + error.message; return; }
  if (authMsg) authMsg.textContent = "✅ Signed in";
  setTimeout(() => { closeAuth(); enterEditMode(); }, 300);
});
btnCloseAuth?.addEventListener("click", closeAuth);

/* ===== Edit mode state ===== */
let editableGroup;
let editMode = false;
let featureIndexById = new Map();
let segmentTargetId = null; // NEW: Global variable for segment addition workflow


/**
 * Initiates the edit mode, setting up snapping and draw controls.
 * This is the fixed, robust implementation for snapping.
 */
function enterEditMode() {
  editMode = true;
  if (btnEditMode) btnEditMode.textContent = "Exit Edit Mode";
  if (editStatus) editStatus.textContent = "You can draw / edit / delete lines.";

  if (!editableGroup) {
    editableGroup = new L.FeatureGroup().addTo(map);
    featureIndexById.forEach(layer => {
      // Only add non-marker layers to the editable group
      if (layer.options && !layer.options.icon) {
        editableGroup.addLayer(layer);
      }
    });
  }

  // -----------------------------------------------------
  // CRITICAL SNAPPING SETUP: Requires Leaflet.Handler.MarkerSnap
  let snapHandler = null;

  if (typeof L.Handler.MarkerSnap !== 'undefined') {
    // If a handler already exists on the map use it, otherwise create one
    if (!map.snap) {
      map.snap = new L.Handler.MarkerSnap(map, {
        snapDistance: 30 // Increased snap distance for polyline vertices
      });
      // assign local reference BEFORE using it
      snapHandler = map.snap;
      snapHandler.enable();
      // Now it's safe to add guide layers
      if (editableGroup) snapHandler.addGuideLayer(editableGroup);
    } else {
      snapHandler = map.snap;
      // ensure the editable group is included as a guide
      if (editableGroup) snapHandler.addGuideLayer(editableGroup);
    }

    // 1. Add ALL editable features as snapping guides (idempotent)
    if (snapHandler && editableGroup) {
      snapHandler.addGuideLayer(editableGroup);
    }

    // 2. CRITICAL: Inject the snap handler into the editing prototypes (The main fix for editing)
    if (snapHandler) {
      // Patch for editing single lines
      if (L.Edit.Polyline && !L.Edit.Polyline.prototype._hasSnapPatch) {
        L.Edit.Polyline.addInitHook(function () {
          this.options.snap = snapHandler;
        });
        L.Edit.Polyline.prototype._hasSnapPatch = true;
      }

      // Patch for editing MultiLineStrings (your data type)
      if (L.Edit.MultiPolyline && !L.Edit.MultiPolyline.prototype._hasSnapPatch) {
        L.Edit.MultiPolyline.addInitHook(function () {
          this.options.snap = snapHandler;
        });
        L.Edit.MultiPolyline.prototype._hasSnapPatch = true;
      }
    }

  } else {
    console.warn("L.Handler.MarkerSnap not found. Snapping is disabled.");
  }
  // -----------------------------------------------------

  if (!drawControl) {
    drawControl = new L.Control.Draw({
      draw: {
        polygon: false, marker: false, circle: false, rectangle: false, circlemarker: false,
        polyline: {
          // 3. Configuration for *new drawing*
          snap: snapHandler,
          snapMiddle: true
        }
      },
      edit: {
        featureGroup: editableGroup,
        // 4. Configuration for *editing existing* features
        snap: snapHandler
      }
    });
  }
  map.addControl(drawControl);
}

function exitEditMode() {
  editMode = false;
  if (btnEditMode) btnEditMode.textContent = "Enter Edit Mode";
  if (editStatus) editStatus.textContent = "";
  if (drawControl) map.removeControl(drawControl);
}
btnEditMode?.addEventListener("click", async () => {
  if (!editMode) {
    const user = await ensureAuth();
    if (user) enterEditMode();
  } else {
    exitEditMode();
  }
});

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

/* ===== Feature form (omitted for brevity) ===== */
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

let currentEdit = { mode: "new", layer: null, feature: null };

const featureModal = document.getElementById("featureModal");
const featureFormBody = document.getElementById("featureFormBody");
const featureFormTitle = document.getElementById("featureFormTitle");
const btnSaveFeature = document.getElementById("btnSaveFeature");
const btnCancelFeature = document.getElementById("btnCancelFeature");
const featureMsg = document.getElementById("featureMsg");

function openFeatureModal() { featureModal.style.display = "flex"; }
function closeFeatureModal() { featureModal.style.display = "none"; if (featureMsg) featureMsg.textContent = ""; }
btnCancelFeature?.addEventListener("click", closeFeatureModal);

// Build grouped form (compact 2-col, fullwidth for Links/Notes, inline checkboxes in Status)
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
          <select id="${id}"><option value="">—</option>${opts}</select>
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
  return obj;
}

/* ===== Open form for new/existing ===== */
function openFeatureForm(feature, title) {
  currentEdit.mode = feature?.properties?.id ? "edit" : "new";
  currentEdit.feature = feature || null;
  if (feature?.properties?.id) {
    const lyr = featureIndexById.get(feature.properties.id);
    currentEdit.layer = lyr || null;
  }
  featureFormTitle.textContent = title || (currentEdit.mode === "edit" ? "Edit Shotengai" : "New Shotengai");
  buildFeatureForm(feature?.properties || {});

  // ⬇️ Inject Photos block (keeps your two-column layout intact)
  const photosBlock = document.createElement("div");
  photosBlock.className = "form-group fullwidth photos-group";
  photosBlock.innerHTML = `
    <h4>Photos</h4>
    <div class="dropzone" id="dz">
      <input id="fileInput" type="file" accept="image/*" multiple />
      <div class="drop-hint">Drag & drop images here, or click to select (JPG/PNG, ≤ 5 MB each)</div>
      <div class="progress"><i></i></div>
    </div>
    <div class="thumb-list" id="thumbs"></div>
  `;
  featureFormBody.appendChild(photosBlock);

  // Initialize thumbnails from existing value (image is comma-separated URLs)
  const urls = (feature?.properties?.image || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  updateThumbs(urls);

  // Wire dnd
  setupDropzone({
    bucket: "shotengai-photos",
    currentId: feature?.properties?.id || null,
    currentSlug: feature?.properties?.slug || "",
    onUploaded: (newUrls) => {
      // merge with existing, update hidden input backing `image`
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
    if (!props.name_en && !props.name_jp) {
      featureMsg.textContent = "❌ Please provide at least a name (EN or JP).";
      return;
    }

    let geom = null;
    if (currentEdit.mode === "new") {
      if (!currentEdit.layer) { featureMsg.textContent = "❌ No geometry. Draw a line first."; return; }
      geom = currentEdit.layer.toGeoJSON().geometry;
    } else {
      if (currentEdit.layer) geom = currentEdit.layer.toGeoJSON().geometry;
      else if (currentEdit.feature?.geometry) geom = currentEdit.feature.geometry;
      else { featureMsg.textContent = "❌ No geometry on feature."; return; }
    }
    const wkt = wktFromGeom(geom);
    const id = props.id || currentEdit.feature?.properties?.id || null;

    // Create a slug if missing
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

    featureMsg.textContent = "✅ Saved";
    setTimeout(() => { closeFeatureModal(); }, 250);

    // Update map/index
    if (currentEdit.mode === "new" && currentEdit.layer) {
      const newFeature = { type: "Feature", properties: { ...props, id: newId }, geometry: geom };
      currentEdit.layer.feature = newFeature;
      // FIX: Apply dynamic thematic style after saving properties
      currentEdit.layer.setStyle(getTypeStyle(newFeature));
      currentEdit.layer.on("click", () => showInfo(newFeature));
      currentEdit.layer.on("mouseover", () => currentEdit.layer.setStyle(lineStyleHover));
      currentEdit.layer.on("mouseout", () => currentEdit.layer.setStyle(getTypeStyle(newFeature)));
      featureIndexById.set(newId, currentEdit.layer);
      editableGroup.addLayer(currentEdit.layer);

      if (map.snap) map.snap.addGuideLayer(currentEdit.layer);

      showInfo(newFeature);
      allFeatures.push(newFeature);
      applyFilters();
    } else {
      const lyr = currentEdit.layer || featureIndexById.get(newId || id);
      if (lyr) {
        const updated = { type: "Feature", properties: { ...props, id: newId || id }, geometry: geom };
        lyr.feature = updated;
        // The layer needs a style update if its type classification changed
        lyr.setStyle(getTypeStyle(updated));
        lyr.on("mouseout", () => lyr.setStyle(getTypeStyle(updated))); // Re-bind mouseout
        showInfo(updated);
        // refresh filters list display
        const i = allFeatures.findIndex(f => f.properties.id === (newId || id));
        if (i >= 0) allFeatures[i] = updated;
        applyFilters();
      }
    }
  } catch (err) {
    console.error("[save] failed", err);
    featureMsg.textContent = "❌ " + (err?.message || err);
  }
});

/* ===== Draw events (Updated to handle multi-segment merge) ===== */
/* atlas.js (The map.on(L.Draw.Event.CREATED, ...) listener) */

map.on(L.Draw.Event.CREATED, async (e) => {
  const newLayer = e.layer;
  const newGeom = newLayer.toGeoJSON().geometry;

  if (segmentTargetId) {
    // --- MODE 1: ADDING A SEGMENT TO AN EXISTING FEATURE (No change needed here) ---
    if (!currentUser) { alert("Session expired. Please sign in to save the segment."); segmentTargetId = null; return; }

    const entityId = segmentTargetId;
    segmentTargetId = null; // Reset state immediately

    const existingLayer = featureIndexById.get(entityId);
    const existingFeature = existingLayer?.feature || allFeatures.find(f => f.properties.id === entityId);

    if (!existingFeature) {
      alert("Error: Could not find existing feature to append segment.");
      newLayer.remove();
      if (drawControl) map.addControl(drawControl);
      return;
    }

    const existingGeom = existingFeature.geometry;

    // 1. Prepare for merge: Convert both to MultiLineString coordinates structure
    const oldCoords = existingGeom.type === "MultiLineString"
      ? existingGeom.coordinates
      : [existingGeom.coordinates]; // existing is a LineString

    const newCoords = newGeom.type === "MultiLineString"
      ? newGeom.coordinates // Should always be LineString here
      : [newGeom.coordinates];

    // 2. Perform the merge
    const mergedGeom = {
      type: "MultiLineString",
      coordinates: [...oldCoords, ...newCoords]
    };

    // 3. Update the existing layer object with the new geometry
    const mergedWKT = wktFromGeom(mergedGeom);

    // Prepare the update payload
    const saveFeature = {
      p_id: entityId,
      p_geom_wkt: mergedWKT,
      p_props: existingFeature.properties // Keep all attributes the same
    };

    // 4. Submit to Supabase
    const { error } = await sbClient.rpc("upsert_shotengai", saveFeature);

    if (error) {
      alert("Failed to save merged segment: " + error.message);
    } else {
      alert("Segment added and merged successfully!");

      // CRITICAL: Update the layer's geometry and map rendering
      if (existingLayer) {
        const featureId = existingLayer.feature.properties.id;

        // 1. Remove old layer instance from map and feature groups
        existingLayer.remove();
        featureIndexById.delete(featureId);
        // NOTE: Assuming editableGroup is the same as editableLayers
        editableLayers.removeLayer(existingLayer);

        // 2. Update the feature object with the new merged geometry
        existingFeature.geometry = mergedGeom;

        // 3. Create a brand new layer instance
        const updatedLayer = L.geoJSON(existingFeature, {
          style: getTypeStyle,
          onEachFeature: (feat, lyr) => {
            lyr.on("click", () => {
              currentEdit = { mode: "edit", layer: lyr, feature: feat };
              showInfo(feat);
            });
            lyr.on("mouseover", () => lyr.setStyle(lineStyleHover));
            lyr.on("mouseout", () => lyr.setStyle(getTypeStyle(feat)));
            // 4. Update the map index and editable group with the new layer object
            featureIndexById.set(featureId, lyr);
            editableLayers.addLayer(lyr); // NOTE: Assuming editableGroup is editableLayers

            if (map.snap) map.snap.addGuideLayer(lyr);
          }
        }).addTo(map).getLayers()[0];

        // Remove the temporary layer drawn by L.Draw
        newLayer.remove();

      }

      // Re-add the main Draw control
      if (drawControl) map.addControl(drawControl);

      // Re-show info panel if it was open for the feature being edited
      showInfo(existingFeature);
    }

  } else {
    // --- MODE 2: DRAWING A COMPLETELY NEW FEATURE ---
    if (!isEditing) { alert("Enter Edit Mode to create features."); newLayer.remove(); return; }

    // CRITICAL: Set the global context for the form
    currentEdit = { mode: "new", layer: newLayer, feature: null };
    editableLayers.addLayer(newLayer);

    // FIX: Use getTypeStyle for consistent default styling
    const defaultFeature = { properties: {} };
    newLayer.setStyle(getTypeStyle(defaultFeature));

    if (map.snap) map.snap.addGuideLayer(newLayer);

    // Call the form function, passing null for feature data and the title
    openFeatureForm(null, "New Shotengai");
    return;
  }
});

map.on(L.Draw.Event.EDITED, async (e) => {
  if (!currentUser) return;
  e.layers.eachLayer(async (layer) => {
    const id = layer?.feature?.properties?.id;
    if (!id) return; // unsaved
    const wkt = wktFromGeom(layer.toGeoJSON().geometry);
    const { error } = await sbClient.rpc("update_shotengai_geom", { p_id: id, p_geom_wkt: wkt });
    if (error) alert("Update geometry failed: " + error.message);
    // Ensure the style is correct after editing
    layer.setStyle(getTypeStyle(layer.feature));
  });
});

map.on(L.Draw.Event.DELETED, async (e) => {
  if (!currentUser) return;
  e.layers.eachLayer(async (layer) => {
    const id = layer?.feature?.properties?.id;
    if (!id) return;
    const { error } = await sbClient.from("shotengai").delete().eq("id", id);
    if (error) alert("Delete failed: " + error.message);
    featureIndexById.delete(id);
    allFeatures = allFeatures.filter(f => f.properties.id !== id);
    applyFilters();
  });
});

map.on(L.Draw.Event.EDITSTART, (e) => {
  // Wait one tick to ensure Leaflet.Draw has created the vertex markers
  setTimeout(() => {
    // e.layer is the feature being edited (Polyline/MultiPolyline)
    const layer = e.layer;

    // Check if the layer is in edit mode and has vertex markers
    if (layer.editing && layer.editing._markers) {
      // For MultiPolyline, markers are sometimes nested under a _markerGroup
      const markers = layer.editing._markerGroup ? layer.editing._markerGroup.getLayers() : layer.editing._markers;

      markers.forEach(marker => {
        // Apply the map's snap handler to the marker's drag handler
        if (marker.dragging && map.snap) {
          // Explicitly set the snap option on the dragging handler
          marker.dragging.setOptions({ snap: map.snap });

          // Force a re-enable of dragging to ensure options take effect
          // This is often necessary when options are changed after init
          if (marker.dragging._enabled) {
            marker.dragging.disable();
            marker.dragging.enable();
          }
        }
      });
    }
  }, 0);
});

/* ===== Filtering (globals + helper) ===== */
let searchInput, prefFilter;
let allFeatures = [];
let allBounds = null;            // full extent
const MAX_RESULTS = 50;


function applyFilters(triggerZoom = false) {
  // Lazy-grab in case the script ran before DOM was ready
  searchInput = searchInput || document.getElementById("search");
  prefFilter = prefFilter || document.getElementById("prefFilter");

  const qRaw = (searchInput?.value ?? "");
  const pfRaw = (prefFilter?.value ?? "");

  const q = qRaw.trim().toLowerCase();
  const pf = pfRaw.trim().toLowerCase();

  const matches = [];
  allFeatures.forEach(f => {
    const p = f.properties || {};
    const pPref = (p.prefecture || "").trim().toLowerCase();

    const inPref = !pf || (pPref === pf);
    const inText = !q || [
      p.name_en, p.name_jp, p.city, p.prefecture, p.slug, p.type, p.classification
    ].filter(Boolean).some(v => String(v).toLowerCase().includes(q));

    const ok = inPref && inText;

    const lyr = featureIndexById.get(p.id);
    const baseStyle = getTypeStyle(f); // Get the correct thematic style for the feature

    if (lyr) {
      // FIX: Apply the correct thematic style, faded if not a match
      const finalStyle = ok
        ? baseStyle
        : { ...baseStyle, opacity: 0.15 }; // Fade the thematic color
      lyr.setStyle(finalStyle);
    }
    if (ok) matches.push(f);
  });

  // --- CRITICAL FIX: COMPUTE AND RENDER FILTERED STATS ---
  const filteredStats = computeStats(matches);
  renderSummary(document.getElementById("summaryFiltered"), filteredStats, "filtered");
  // --------------------------------------------------------

  // Sidebar
  // Update sidebar list (limit to 10)
  const resultsContainer = document.getElementById("results");
  const resultCount = document.getElementById("resultCount");
  if (resultCount) resultCount.textContent = matches.length;

  if (resultsContainer) {
    const limited = matches.slice(0, MAX_RESULTS);
    resultsContainer.innerHTML = limited.map(f => {
      const p = f.properties;
      const name = p.name_en || p.name_jp || "Unnamed Shotengai";
      // This is using STATUS, not TYPE, which is fine for the sidebar list item style.
      const status = (p.status || "").toString().toLowerCase();
      const color =
        status === "active" ? "#22c55e" :
          status === "declining" ? "#f59e0b" :
            status === "closed" ? "#ef4444" : "#9ca3af";
      return `<div class="result-item" data-id="${p.id}" style="border-left:4px solid ${color}">
      <div class="result-name">${name}</div>
      <div class="result-meta">${[p.city, p.prefecture].filter(Boolean).join(" · ")}</div>
    </div>`;
    }).join("");

    // Small footer if more results exist
    const remaining = matches.length - limited.length;
    if (remaining > 0) {
      resultsContainer.insertAdjacentHTML(
        "beforeend",
        `<div class="results-footer">+${remaining} more… refine filters to narrow down.</div>`
      );
    }

    // Rebind clicks
    resultsContainer.querySelectorAll(".result-item").forEach(el => {
      el.addEventListener("click", () => {
        const id = el.dataset.id;
        const lyr = featureIndexById.get(id);
        if (!lyr) return;
        map.fitBounds(lyr.getBounds(), { padding: [50, 50] });
        const feat = lyr.feature || allFeatures.find(f => String(f.properties.id) === id);
        if (feat) { currentEdit = { mode: "edit", layer: lyr, feature: feat }; showInfo(feat); }
      });
    });
  }


  // Zoom only when prefecture changed
  if (triggerZoom) {
    if (pf) {
      const b = L.latLngBounds([]);
      matches.forEach(f => {
        const lyr = featureIndexById.get(f.properties.id);
        if (lyr) b.extend(lyr.getBounds());
      });
      if (b.isValid()) {
        map.fitBounds(b, { padding: [40, 40] });
      } else if (allBounds?.isValid()) {
        map.fitBounds(allBounds, { padding: [40, 40] });
      }
    } else if (allBounds?.isValid()) {
      map.fitBounds(allBounds, { padding: [40, 40] });
    }
  }
}

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

  // paste from clipboard
  dz.addEventListener("paste", e => {
    const items = e.clipboardData?.files || [];
    if (items.length) handleFiles(items);
  });

  // expose remover used by thumbnails
  dz._removeUrl = (u) => onRemoved && onRemoved(u);
}

function updateThumbs(urlArr) {
  const list = document.getElementById("thumbs");
  if (!list) return;
  list.innerHTML = urlArr.map(u => `
    <div class="thumb" data-url="${u}">
      <img src="${u}" alt="">
      <button class="x" title="Remove">×</button>
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

// ---------- Summary helpers ----------
function fmtLen(m) {
  if (!m || m <= 0) return "—";
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
      ${Object.entries(by).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—"}
    </div>
  `;
}


// About modal wiring
const aboutModal = document.getElementById("aboutModal");
const btnAbout = document.getElementById("btnAbout");
const btnCloseAbout = document.getElementById("btnCloseAbout");

function openAbout() { if (aboutModal) aboutModal.style.display = "flex"; }
function closeAbout() { if (aboutModal) aboutModal.style.display = "none"; }

btnAbout?.addEventListener("click", openAbout);
btnCloseAbout?.addEventListener("click", closeAbout);

// Close on overlay click or ESC
aboutModal?.addEventListener("click", (e) => { if (e.target === aboutModal) closeAbout(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAbout(); });


/* ===== Init: Supabase + load data ===== */
(async function init() {
  try {
    const createClient = await loadSupabaseClient();

    // Optional connectivity probe (clearer error than generic NetworkError)
    await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/`, { method: "HEAD" });

    sbClient = createClient(SUPABASE_URL.trim(), SUPABASE_ANON_KEY.trim());

    // Auth state
    sbClient.auth.onAuthStateChange((_e, session) => { currentUser = session?.user || null; });
    {
      const { data: { user } } = await sbClient.auth.getUser();
      currentUser = user || null;
    }

    // Fetch data
    const { data, error } = await sbClient.from("v_shotengai_geojson").select("*");
    if (error) throw error;

    const features = (data || []).map((r) => {
      let geom = r.geomjson;
      if (typeof geom === "string") { try { geom = JSON.parse(geom); } catch { geom = null; } }
      return {
        type: "Feature",
        properties: {
          id: r.id, slug: r.slug, name_jp: r.name_jp, name_en: r.name_en,
          city: r.city, prefecture: r.prefecture, status: r.status,
          covered: r.covered, pedestrian_only: r.pedestrian_only,
          type: r.type, classification: r.classification, theme: r.theme,
          length_m: r.length_m, width_avg: r.width_avg, shops_est: r.shops_est,
          established: r.established, last_renov: r.last_renov,
          nearest_station: r.nearest_station, walk_min: r.walk_min,
          association: r.association, url: r.url, image: r.image, source: r.source,
          accuracy: r.accuracy, last_update: r.last_update, description: r.description
        },
        geometry: geom
      };
    });

    const layer = L.geoJSON({ type: "FeatureCollection", features }, {
      style: getTypeStyle, // CORRECT: Uses the thematic style
      onEachFeature: (feat, lyr) => {
        lyr.on("click", () => {
          currentEdit = { mode: "edit", layer: lyr, feature: feat };
          showInfo(feat);
        });
        lyr.on("mouseover", () => lyr.setStyle(lineStyleHover));
        lyr.on("mouseout", () => lyr.setStyle(getTypeStyle(feat))); // CORRECT: Uses the thematic style on mouse out
        if (feat?.properties?.id) featureIndexById.set(feat.properties.id, lyr);
      }
    }).addTo(map);

    if (layer.getLayers().length) {
      map.fitBounds(layer.getBounds(), { padding: [40, 40] });
      allBounds = layer.getBounds();     // remember full extent
    }

    allFeatures = features;

    // Overall summary (entire dataset)
    const overallStats = computeStats(allFeatures);
    renderSummary(document.getElementById("summaryOverall"), overallStats, "total");


    // Populate prefecture dropdown (values normalized exactly as displayed)
    prefFilter = document.getElementById("prefFilter");
    if (prefFilter) {
      const prefs = Array.from(new Set(
        allFeatures.map(f => f.properties.prefecture).filter(Boolean)
      )).sort((a, b) => a.localeCompare(b, 'en'));
      prefFilter.innerHTML = `<option value="">All prefectures</option>` +
        prefs.map(p => `<option value="${p}">${p}</option>`).join("");
    }

    // Wire events
    searchInput = document.getElementById("search");
    searchInput?.addEventListener("input", () => applyFilters(false));  // no zoom while typing
    prefFilter?.addEventListener("change", () => applyFilters(true));   // zoom on prefecture change

    // First render and add legend
    applyFilters(false);
    addMapLegend(); // ADDED: Ensures the legend is displayed.

    // NEW: Initialize UI elements that depend on Supabase client (sbClient) being ready
    setupAuthUI();

    layer.eachLayer(lyr => {
      // We only want to add the polylines (which should be GeoJSON data) to the editable group.
      if (lyr instanceof L.Polyline) {
        editableLayers.addLayer(lyr);
      }
    });

    drawControl = new L.Control.Draw({
      edit: {
        // THIS LINE IS CRITICAL: It tells the Edit toolbar which layers to manage
        featureGroup: editableLayers,
        poly: {
          allowIntersection: false
        }
      },
      draw: {
        // Fix 1: Explicitly disable polygon drawing
        polygon: false,
        // Only allow line drawing
        polyline: {
          allowIntersection: false
        },
        marker: false,
        circlemarker: false,
        rectangle: false,
        circle: false
      }
    });

  } catch (err) {
    console.error("[Atlas] init failed:", err);
    alert("Failed to load data from Supabase: " + (err.message || err));
  }

})();

/**
 * Initializes all UI logic related to authentication and modals.
 * NOTE: The Edit button is only visible when logged in (simulating "edit rights").
 */
/* atlas.js (Replace your existing setupAuthUI function) */

/* atlas.js (The complete corrected setupAuthUI function) */

function setupAuthUI() {
  const modalContact = document.getElementById('modalContact');
  const btnContact = document.getElementById('btnContact');
  const btnCloseContact = document.getElementById('btnCloseContact');
  const btnEdit = document.getElementById('btnEdit');
  const btnSignIn = document.getElementById('btnSignIn');

  // --- Modal Logic ---
  btnContact?.addEventListener('click', () => {
    modalContact.style.display = 'flex';
  });

  btnEdit?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleEditMode(); // Call the global function to toggle the editing UI
  });

  btnCloseContact?.addEventListener('click', () => {
    modalContact.style.display = 'none';
  });

  // Simple form submission handler (prevent default, log data)
  modalContact?.querySelector('form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    alert("Thank you for your suggestion! (Form submission logic needs to be implemented)");
    modalContact.style.display = 'none';
  });

  // CRITICAL FIX 2: Set the default behavior (open modal) synchronously.
  // This executes immediately and prevents the button from being "dead."
  btnSignIn?.addEventListener('click', () => {
    // Only open the modal if the button currently says "Sign In"
    if (btnSignIn.textContent === 'Sign In') {
      document.getElementById('authModal').style.display = 'flex';
    }
    // If it says "Sign Out", the logic in the listener below will override this.
  });


  // --- Conditional Edit Button Visibility ---
  if (!sbClient) {
    console.error("Supabase client is not defined. Cannot set up auth UI.");
    return;
  }

  // Watch for authentication changes (Asynchronous)
  sbClient.auth.onAuthStateChange((event, session) => {
    const isLoggedIn = !!session;

    if (btnEdit) {
      btnEdit.style.display = isLoggedIn ? 'block' : 'none';

      // Update Sign In/Sign Out button
      if (btnSignIn) { // We already declared btnSignIn at the top
        btnSignIn.textContent = isLoggedIn ? 'Sign Out' : 'Sign In';

        if (isLoggedIn) {
          // OVERRIDE the synchronous click listener to perform sign out
          btnSignIn.onclick = async () => {
            await sbClient.auth.signOut();
            // Close any open editing toolbars here if needed
          };
        } else {
          // CRITICAL FIX 3: Clear the sign-out override. 
          // This allows the synchronous addEventListener (set above) to open the modal.
          btnSignIn.onclick = null;
        }
      }
    }
  });
}


let isEditing = false;
/**
 * Toggles the visibility of the Leaflet Draw toolbar/controls.
 */
function toggleEditMode() {
  isEditing = !isEditing;

  const btnEdit = document.getElementById('btnEdit');
  btnEdit.textContent = isEditing ? 'Exit Edit Mode' : 'Edit Map';

  // Optional: Hide the info panel on mode entry
  if (isEditing) {
    window._hideInfo && window._hideInfo();
  }

  if (drawControl) {
    if (isEditing) {
      // Show the Draw control (toolbar)
      drawControl.addTo(map);
      // Leaflet Draw's control object is now responsible for handling edit activation.
    } else {
      // Hide the Draw control
      map.removeControl(drawControl);

      // Clean up: Manually ensure any active drawing is disabled
      // This prevents a line from being left half-drawn.
      if (drawControl._toolbars.draw._activeMode) {
        drawControl._toolbars.draw._activeMode.handler.disable();
      }
      // Clean up: Also ensure the edit mode is explicitly disabled
      if (drawControl._toolbars.edit._activeMode) {
        drawControl._toolbars.edit._activeMode.handler.disable();
      }
    }

    // Force popups to update editing buttons/notes fields.
    layer.eachLayer(l => {
      if (l.isPopupOpen()) {
        l.closePopup();
        l.openPopup();
      }
    });

  } else {
    console.error("Leaflet Draw control instance not found!");
  }
}
