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

// LayerGroup to hold existing Shotengai lines (for snapping)
const shotengaiGuideLayer = new L.FeatureGroup().addTo(map);

// FeatureGroup to store all drawn items
const drawnItems = new L.FeatureGroup().addTo(map);

// Group of features that Leaflet.Draw will enable editing/deleting on
let editableLayers = new L.FeatureGroup().addTo(map);
let drawControl = null;

if (typeof L.Handler.MarkerSnap !== 'undefined') {
  map.snap = new L.Handler.MarkerSnap(map, {
    snapDistance: 50
  });
  console.log('✅ Snap handler initialized with guide layer');
}

// Debug check
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
  'default': '#cbd5e1'
};
const lineStyleHover = { color: '#ffffff', weight: 8, opacity: 1, interactive: true };

function getTypeStyle(feature) {
  const typeValue = feature.properties?.classification || feature.properties?.type;
  const typeCode = typeValue?.toString().toUpperCase()[0] || 'default';
  const primaryType = TYPE_COLORS.hasOwnProperty(typeCode) ? typeCode : 'default';
  const color = TYPE_COLORS[primaryType];

  return {
    color: color,
    weight: 6,
    opacity: 0.9,
    interactive: true
  };
}

function addMapLegend() {
  const legend = L.control({ position: 'bottomleft' });

  legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info legend');
    const types = [
      { code: 'A', color: TYPE_COLORS['A'], description: 'fully covered street' },
      { code: 'B', color: TYPE_COLORS['B'], description: 'pedestrian only street' },
      { code: 'C', color: TYPE_COLORS['C'], description: 'street adjacent covered sidewalk' },
      { code: 'D', color: TYPE_COLORS['D'], description: 'normal street with Shotengai association' }
    ];

    let content = '<h4>Shotengai Type</h4>';
    for (let i = 0; i < types.length; i++) {
      content += `<i style="background:${types[i].color};"></i> ${types[i].code}: ${types[i].description}<br>`;
    }
    div.innerHTML = content;
    return div;
  };

  legend.addTo(map);
}

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

        ${p.notes ? `<div class="desc">${p.notes}</div>` : ""}
      </div>
      ${photoHtml}
    </div>
  `;

  window._openFeatureForm = async () => {
    if (!currentUser) { const u = await ensureAuth(); if (!u) return; }
    if (!isEditing) toggleEditMode();
    currentEdit = { mode: "edit", layer: featureIndexById.get(p.id) || null, feature };
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

  (() => {
    const r = document.getElementById('results');
    const card = r?.closest('.card');
    if (card && !card.classList.contains('results-card')) {
      card.classList.add('results-card');
    }
  })();
}

function hideInfo() { infoPanel.style.display = "none"; }
window._hideInfo = hideInfo;

function startDrawSegment(entityId) {
  if (!currentUser) { alert("Sign in to draw new segments."); return; }

  segmentTargetId = entityId;
  hideInfo();

  if (!isEditing) toggleEditMode();

  if (drawControl) map.removeControl(drawControl);

  const drawOptions = {
    snap: map.snap,
    snapMiddle: true,
    snapDistance: 30
  };

  const polylineDraw = new L.Draw.Polyline(map, drawOptions);
  polylineDraw.enable();

  alert("Draw the new segment. Click the last point to finish drawing.");
}
window._startDrawSegment = startDrawSegment;

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
  const { error } = await sbClient.auth.signInWithPassword({
    email: (authEmail?.value || "").trim(),
    password: authPass?.value || ""
  });
  if (error) {
    if (authMsg) authMsg.textContent = "⌫ " + error.message;
    return;
  }
  if (authMsg) authMsg.textContent = "✅ Signed in";
  setTimeout(() => { closeAuth(); toggleEditMode(); }, 300);
});

btnCloseAuth?.addEventListener("click", closeAuth);

/* ===== Edit mode state ===== */
let editMode = false;
let isEditing = false;
let featureIndexById = new Map();
let segmentTargetId = null;

function toggleEditMode() {
  // This function acts as the controller for the user action
  if (!isEditing) {
    enterEditMode();
  } else {
    exitEditMode();
  }

  // Refresh info card if a feature is selected
  if (currentEdit?.feature) {
    showInfo(currentEdit.feature);
  }

  // Pop-up refresh logic (Keep this for UX)
  editableLayers.eachLayer(l => {
    if (l.isPopupOpen()) {
      l.closePopup();
      l.openPopup();
    }
  });
}

// FIXED: Simplified enterEditMode - snap handler already exists from init
function enterEditMode() {
  editMode = true;
  isEditing = true;

  const btnEdit = document.getElementById('btnEdit');
  if (btnEdit) {
    btnEdit.textContent = "Exit Edit Mode";
    btnEdit.classList.add('active');
  }

  const snapHandler = map.snap;

  // 1. Remove the old control instance if it exists to force clean re-creation
  if (drawControl) {
    map.removeControl(drawControl);
    drawControl = null;
  }

  // 2. Enable the Snap handler (This is the one and only place it should be enabled)
  if (snapHandler) {
    snapHandler.enable();
  }

  // 3. Create a NEW instance of Draw Control
  drawControl = new L.Control.Draw({
    draw: {
      polygon: false, circle: false, rectangle: false, circlemarker: false, marker: false,
      polyline: {
        snap: snapHandler,
        snapMiddle: true,
        snapDistance: 30
      }
    },
    edit: {
      featureGroup: editableLayers,
      snap: snapHandler
    }
  });

  // 4. Add the new control to the map
  map.addControl(drawControl);
  // Clean log that confirms the action
  console.log('Edit mode enabled. Snap handler active: ENABLED');
}

function exitEditMode() {
  editMode = false;
  isEditing = false;

  const btnEdit = document.getElementById('btnEdit');
  if (btnEdit) {
    btnEdit.textContent = "Edit Map";
    btnEdit.classList.remove('active');
  }

  // 1. Disable the Snap handler
  if (map.snap) {
    map.snap.disable();
    console.log('Snap handler active: DISABLED');
  }

  // 2. Disable any active Draw tool mode and remove the control
  if (drawControl) {
    if (drawControl._toolbars.draw._activeMode) {
      drawControl._toolbars.draw._activeMode.handler.disable();
    }
    if (drawControl._toolbars.edit._activeMode) {
      drawControl._toolbars.edit._activeMode.handler.disable();
    }
    map.removeControl(drawControl);
    drawControl = null; // IMPORTANT: Clear the reference for the next enterEditMode() call
  }
}

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

let currentEdit = { mode: "new", layer: null, feature: null };

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

  const descriptionValue = document.getElementById('f_description')?.value.trim() || null;
  obj.notes = descriptionValue;

  return obj;
}

function openFeatureForm(feature, title) {
  currentEdit.mode = feature?.properties?.id ? "edit" : "new";
  currentEdit.feature = feature || null;
  if (feature?.properties?.id) {
    const lyr = featureIndexById.get(feature.properties.id);
    currentEdit.layer = lyr || null;
  }
  featureFormTitle.textContent = title || (currentEdit.mode === "edit" ? "Edit Shotengai" : "New Shotengai");
  buildFeatureForm(feature?.properties || {});

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
      featureMsg.textContent = "⌫ Please provide at least a name (EN or JP).";
      return;
    }

    let geom = null;
    if (currentEdit.mode === "new") {
      if (!currentEdit.layer) { featureMsg.textContent = "⌫ No geometry. Draw a line first."; return; }
      geom = currentEdit.layer.toGeoJSON().geometry;
    } else {
      if (currentEdit.layer) geom = currentEdit.layer.toGeoJSON().geometry;
      else if (currentEdit.feature?.geometry) geom = currentEdit.feature.geometry;
      else { featureMsg.textContent = "⌫ No geometry on feature."; return; }
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

    featureMsg.textContent = "✅ Saved";
    const updatedProps = {
      ...props,
      id: newId,
      last_update: new Date().toISOString()
    };

    if (currentEdit.feature) {
      currentEdit.feature.properties = updatedProps;
      if (currentEdit.layer) {
        currentEdit.layer.feature.properties = updatedProps;
        currentEdit.layer.setStyle(getTypeStyle(currentEdit.layer.feature));
      }
    }

    showInfo(currentEdit.feature);
    closeFeatureModal();

    if (currentEdit.mode === "new" && currentEdit.layer) {
      const newFeature = { type: "Feature", properties: { ...props, id: newId }, geometry: geom };
      currentEdit.layer.feature = newFeature;
      currentEdit.layer.setStyle(getTypeStyle(newFeature));
      currentEdit.layer.on("click", () => showInfo(newFeature));
      currentEdit.layer.on("mouseover", () => currentEdit.layer.setStyle(lineStyleHover));
      currentEdit.layer.on("mouseout", () => currentEdit.layer.setStyle(getTypeStyle(newFeature)));
      featureIndexById.set(newId, currentEdit.layer);
      editableLayers.addLayer(currentEdit.layer);

      if (currentEdit.layer instanceof L.Polyline) {
        shotengaiGuideLayer.addLayer(currentEdit.layer);
      }

      if (map.snap) map.snap.addGuideLayer(currentEdit.layer);

      showInfo(newFeature);
      allFeatures.push(newFeature);
      applyFilters();
    } else {
      const lyr = currentEdit.layer || featureIndexById.get(newId || id);
      if (lyr) {
        const updated = { type: "Feature", properties: { ...props, id: newId || id }, geometry: geom };
        lyr.feature = updated;
        lyr.setStyle(getTypeStyle(updated));
        lyr.on("mouseout", () => lyr.setStyle(getTypeStyle(updated)));
        showInfo(updated);
        const i = allFeatures.findIndex(f => f.properties.id === (newId || id));
        if (i >= 0) allFeatures[i] = updated;
        applyFilters();
      }
    }
  } catch (err) {
    console.error("[save] failed", err);
    featureMsg.textContent = "⌫ " + (err?.message || err);
  }
});

/* ===== Draw events ===== */
map.on(L.Draw.Event.CREATED, async (e) => {
  const newLayer = e.layer;
  const newGeom = newLayer.toGeoJSON().geometry;

  if (segmentTargetId) {
    if (!currentUser) {
      alert("Session expired. Please sign in to save the segment.");
      segmentTargetId = null;
      return;
    }

    const entityId = segmentTargetId;
    segmentTargetId = null;

    const existingLayer = featureIndexById.get(entityId);
    const existingFeature = existingLayer?.feature || allFeatures.find(f => f.properties.id === entityId);

    if (!existingFeature) {
      alert("Error: Could not find existing feature to append segment.");
      newLayer.remove();
      toggleEditMode();
      return;
    }

    const existingGeom = existingFeature.geometry;
    const oldCoords = existingGeom.type === "MultiLineString"
      ? existingGeom.coordinates
      : [existingGeom.coordinates];

    const newCoords = newGeom.type === "MultiLineString"
      ? newGeom.coordinates
      : [newGeom.coordinates];

    const mergedGeom = {
      type: "MultiLineString",
      coordinates: [...oldCoords, ...newCoords]
    };

    const mergedWKT = wktFromGeom(mergedGeom);

    const saveFeature = {
      p_id: entityId,
      p_geom_wkt: mergedWKT,
      p_props: existingFeature.properties
    };

    const { error } = await sbClient.rpc("upsert_shotengai", saveFeature);

    if (error) {
      alert("Failed to save merged segment: " + error.message);
    } else {
      alert("Segment added and merged successfully!");

      if (existingLayer) {
        // 1. Update the existing feature object with the new geometry
        existingFeature.geometry = mergedGeom;
        existingLayer.feature.geometry = mergedGeom;

        // 2. Replace the layer. This is the most reliable way to update a MultiLineString in Leaflet.

        existingLayer.remove(); // Remove the old layer

        const updatedLayer = L.geoJSON(existingFeature, {
          style: getTypeStyle,
          onEachFeature: (feat, lyr) => {
            // ... (listeners)

            featureIndexById.set(entityId, lyr);
            editableLayers.addLayer(lyr);
            shotengaiGuideLayer.addLayer(lyr);

            // 💥 FINAL FIX: Explicitly set the snap handler for the layer's editing
            if (map.snap && lyr.editing) {
                lyr.editing.options.snap = map.snap;
            }
          }
        }).addTo(map).getLayers()[0];

        featureIndexById.set(entityId, updatedLayer);

      } // CLOSES if (existingLayer)

      newLayer.remove(); // <-- The temporary layer is removed on successful save.

    } // CLOSES else (Successful save)

    if (drawControl) map.addControl(drawControl);
    showInfo(existingFeature);
  } // CLOSES if (segmentTargetId)

  else { // This is the 'else' block for New Feature creation
    if (!isEditing) {
      alert("Enter Edit Mode to create features.");
      newLayer.remove();
      return;
    }

    currentEdit = { mode: "new", layer: newLayer, feature: null };
    editableLayers.addLayer(newLayer);

    const defaultFeature = { properties: {} };
    newLayer.setStyle(getTypeStyle(defaultFeature));

    if (map.snap) map.snap.addGuideLayer(newLayer);

    if (newLayer instanceof L.Polyline) {
      shotengaiGuideLayer.addLayer(newLayer);
    }

    openFeatureForm(null, "New Shotengai");
    return;
  } // CLOSES else (New feature creation)

});

/* ===== Final Snapping Fix: Safe Marker Reconfiguration (Bug Fix) ===== */
map.on(L.Draw.Event.EDITSTART, (e) => {
    const layer = e.layer;
    
    // 💥 FIX: Exit immediately if no layer is present (i.e., during control initialization)
    if (!layer) {
        return;
    }

    // Now we know 'layer' exists, we can proceed with the snap fix.
    const snapHandler = map.snap;

    if (layer.editing && snapHandler) {
        // Ensure the layer's edit options have the global snap handler (for good measure)
        if (!layer.editing.options.snap) {
            layer.editing.options.snap = snapHandler;
        }

        // Use a small timeout to ensure Leaflet Draw has fully created all markers.
        setTimeout(() => {
            // Get the list of vertex markers
            const markers = layer.editing._markerGroup ? layer.editing._markerGroup.getLayers() : layer.editing._markers;

            if (markers) {
                markers.forEach(marker => {
                    // Check if the marker has a dragging handler
                    if (marker.dragging) {
                        // Apply the global snap handler to the marker's drag options
                        marker.dragging.setOptions({ snap: snapHandler });
                    }
                });
            }
            console.log("✅ Leaflet.Snap configured for edit markers.");
        }, 50); // Small delay to win the race condition
    }
});

map.on(L.Draw.Event.EDITED, async (e) => {
  if (!currentUser) return;
  e.layers.eachLayer(async (layer) => {
    const id = layer?.feature?.properties?.id;
    if (!id) return;
    const wkt = wktFromGeom(layer.toGeoJSON().geometry);
    const { error } = await sbClient.rpc("update_shotengai_geom", { p_id: id, p_geom_wkt: wkt });
    if (error) alert("Update geometry failed: " + error.message);
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
    shotengaiGuideLayer.removeLayer(layer);
    editableLayers.removeLayer(layer);

    allFeatures = allFeatures.filter(f => f.properties.id !== id);
    applyFilters();
  });
});



/* ===== Filtering ===== */
let searchInput, prefFilter;
let allFeatures = [];
let allBounds = null;
const MAX_RESULTS = 50;

function applyFilters(triggerZoom = false) {
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
    const baseStyle = getTypeStyle(f);

    if (lyr) {
      const finalStyle = ok
        ? baseStyle
        : { ...baseStyle, opacity: 0.15 };
      lyr.setStyle(finalStyle);
    }
    if (ok) matches.push(f);
  });

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
      <div class="result-meta">${[p.city, p.prefecture].filter(Boolean).join(" · ")}</div>
    </div>`;
    }).join("");

    const remaining = matches.length - limited.length;
    if (remaining > 0) {
      resultsContainer.insertAdjacentHTML(
        "beforeend",
        `<div class="results-footer">+${remaining} more… refine filters to narrow down.</div>`
      );
    }

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

/* ===== Summary helpers ===== */
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

/* ===== Init: Supabase + load data ===== */
(async function init() {
  try {
    const createClient = await loadSupabaseClient();
    await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/`, { method: "HEAD" });

    sbClient = createClient(SUPABASE_URL.trim(), SUPABASE_ANON_KEY.trim());

    sbClient.auth.onAuthStateChange((_e, session) => { currentUser = session?.user || null; });
    {
      const { data: { user } } = await sbClient.auth.getUser();
      currentUser = user || null;
    }

    const { data: viewData, error } = await sbClient
      .from('v_shotengai_geojson')
      .select('geojson')
      .single();
    if (error) throw error;

    const geojson = viewData?.geojson;
    const features = geojson?.features || [];

    // 💥 FIX: Initialize the snap handler, but DO NOT enable it or add guide layers yet.
    if (typeof L.Handler.MarkerSnap !== 'undefined') {
      map.snap = new L.Handler.MarkerSnap(map, {
        snapDistance: 50
      });
      console.log('✅ Snap handler initialized, awaiting data load.');
    } else {
      console.warn('⚠️ L.Handler.MarkerSnap not found. Snapping disabled.');
    }

    const layer = L.geoJSON({ type: "FeatureCollection", features }, {
      style: getTypeStyle,
      onEachFeature: (feat, lyr) => {
        lyr.on("click", () => {
          currentEdit = { mode: "edit", layer: lyr, feature: feat };
          showInfo(feat);
        });
        lyr.on("mouseover", () => lyr.setStyle(lineStyleHover));
        lyr.on("mouseout", () => lyr.setStyle(getTypeStyle(feat)));

        if (feat?.properties?.id) {
          featureIndexById.set(feat.properties.id, lyr);

          if (lyr instanceof L.Polyline || lyr instanceof L.MultiPolyline) {
            editableLayers.addLayer(lyr);
            
            // 💥 FINAL FIX: Explicitly set the snap handler for the layer's editing
            if (map.snap && lyr.editing) {
              lyr.editing.options.snap = map.snap;
            }
            
            shotengaiGuideLayer.addLayer(lyr);
          }
        }
      }
    }).addTo(map);

    // Log for debugging
    console.log(`✅ Loaded ${features.length} features`);
    console.log(`✅ Guide layer has ${shotengaiGuideLayer.getLayers().length} snappable lines`);

    // 💥 FIX: Explicitly register the layer with the snap handler AFTER it has content.
    if (map.snap && !map.snap.hasLayer(shotengaiGuideLayer)) {
      map.snap.addGuideLayer(shotengaiGuideLayer);
      console.log(`✅ Snap guide layer registered successfully.`);
    }

    // Ensure the map.snap instance itself is added to the map
    if (map.snap && !map.hasControl(map.snap)) {
      map.addControl(map.snap);
    }

    if (layer.getLayers().length) {
      map.fitBounds(layer.getBounds(), { padding: [40, 40] });
      allBounds = layer.getBounds();
    }

    allFeatures = features;

    const overallStats = computeStats(allFeatures);
    renderSummary(document.getElementById("summaryOverall"), overallStats, "total");

    prefFilter = document.getElementById("prefFilter");
    if (prefFilter) {
      const prefs = Array.from(new Set(
        allFeatures.map(f => f.properties.prefecture).filter(Boolean)
      )).sort((a, b) => a.localeCompare(b, 'en'));
      prefFilter.innerHTML = `<option value="">All prefectures</option>` +
        prefs.map(p => `<option value="${p}">${p}</option>`).join("");
    }

    searchInput = document.getElementById("search");
    searchInput?.addEventListener("input", () => applyFilters(false));
    prefFilter?.addEventListener("change", () => applyFilters(true));

    applyFilters(false);
    addMapLegend();
    setupAuthUI();

  } catch (err) {
    console.error("[Atlas] init failed:", err);
    alert("Failed to load data from Supabase: " + (err.message || err));
  }
})();

function setupAuthUI() {
  const modalContact = document.getElementById('modalContact');
  const btnContact = document.getElementById('btnContact');
  const btnCloseContact = document.getElementById('btnCloseContact');
  const btnEdit = document.getElementById('btnEdit');
  const btnSignIn = document.getElementById('btnSignIn');

  btnContact?.addEventListener('click', () => {
    modalContact.style.display = 'flex';
  });

  btnEdit?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleEditMode();
  });

  btnCloseContact?.addEventListener('click', () => {
    modalContact.style.display = 'none';
  });

  modalContact?.querySelector('form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    alert("Thank you for your suggestion! (Form submission logic needs to be implemented)");
    modalContact.style.display = 'none';
  });

  btnSignIn?.addEventListener('click', () => {
    if (btnSignIn.textContent === 'Sign In') {
      document.getElementById('authModal').style.display = 'flex';
    }
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
          btnSignIn.onclick = async () => {
            await sbClient.auth.signOut();
          };
        } else {
          btnSignIn.onclick = null;
        }
      }
    }
  });
}