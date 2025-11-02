/* =========================
   Shotengai Atlas (Supabase)
   ========================= */

/* ===== Supabase config =====
   Replace with your real values (you said it's working now). */
const SUPABASE_URL = "https://qdykenvvtqnzdgtzcmhe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkeWtlbnZ2dHFuemRndHpjbWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MDg0MDEsImV4cCI6MjA3NzM4NDQwMX0.zN6Mpfnxr5_ufc6dMDO89LZBXSFYa4ex4vbiu1Q813U";

/* ===== MAP SETUP ===== */
const basemaps = {
  light: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }),
  dark: L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    { maxZoom: 19, attribution: "&copy; OpenStreetMap &copy; CARTO" })
};

const map = L.map("map", { center: [36.2048, 137.2529], zoom: 5, layers: [basemaps.dark] });
L.control.layers({ "Light": basemaps.light, "Dark": basemaps.dark }).addTo(map);
L.Control.geocoder({ defaultMarkGeocode: false })
  .on("markgeocode", (e) => map.fitBounds(e.geocode.bbox))
  .addTo(map);

// Styles
const lineStyle = { color: "#7aa2ff", weight: 3, opacity: 0.9 };
const lineStyleHover = { color: "#14b8a6", weight: 4, opacity: 1 };

/* ===== INFO CARD ===== */
const infoPanel = document.getElementById("infopanel");
const infoCard = document.getElementById("info");
function showInfo(feature) {
  const p = feature.properties || {};
  const name = p.name_en || p.name_jp || "Unnamed Shotengai";
  const canEdit = !!currentUser && editMode;

  const status = (p.status || "").toString().toLowerCase();
  const statusChip = p.status ? `<span class="pill pill-${status}">${p.status}</span>` : "";
  const coveredChip = (p.covered === true || p.covered === false)
    ? `<span class="pill">${p.covered ? "Covered" : "Open-air"}</span>` : "";
  const pedChip = (p.pedestrian_only === true || p.pedestrian_only === false)
    ? `<span class="pill">${p.pedestrian_only ? "Pedestrian-only" : "Mixed traffic"}</span>` : "";
  const typeChip = p.type ? `<span class="pill">${p.type}</span>` : "";

  const kv = (k, v) => v ? `<div class="k">${k}</div><div class="v">${v}</div>` : "";

  infoCard.innerHTML = `
    <div class="card-head">
      <div class="title">${name}</div>
      <div style="display:flex;gap:6px;align-items:center">
        ${canEdit ? `<button class="btn btn-ghost" onclick="(window._openFeatureForm && window._openFeatureForm())">Edit</button>` : ""}
        <button class="close" onclick="(window._hideInfo && window._hideInfo())">×</button>
      </div>
    </div>

    <div class="chips">
      ${statusChip}${coveredChip}${pedChip}${typeChip}
      ${p.classification ? `<span class="pill">${p.classification}</span>` : ""}
      ${p.theme ? `<span class="pill">${p.theme}</span>` : ""}
    </div>

    <div class="kv">
      ${kv("City / Pref.", [p.city, p.prefecture].filter(Boolean).join(" · "))}
      ${kv("Length", p.length_m ? `${Math.round(p.length_m)} m` : "")}
      ${kv("Width avg", p.width_avg ? `${p.width_avg} m` : "")}
      ${kv("Shops (est.)", p.shops_est)}
      ${kv("Established", p.established)}
      ${kv("Last renov.", p.last_renov)}
      ${kv("Station", p.nearest_station ? `${p.nearest_station}${p.walk_min ? ` · ${p.walk_min} min` : ""}` : "")}
      ${kv("Association", p.association)}
      ${kv("Website", p.url ? `<a href="${p.url}" target="_blank" rel="noopener">Open ↗</a>` : "")}
      ${kv("Source", p.source)}
      ${kv("Accuracy", p.accuracy)}
      ${kv("Updated", p.last_update ? new Date(p.last_update).toLocaleDateString() : "—")}
    </div>

    ${p.description ? `<div class="desc" style="margin-top:10px;line-height:1.45">${p.description}</div>` : ""}
  `;
  infoPanel.style.display = "block";

  window._openFeatureForm = async () => {
    if (!currentUser) { const u = await ensureAuth(); if (!u) return; }
    if (!editMode) enterEditMode();
    currentEdit = { mode: "edit", layer: featureIndexById.get(p.id) || null, feature };
    openFeatureForm(feature, "Edit Shotengai");
  };
}


function hideInfo() { infoPanel.style.display = "none"; }
window._hideInfo = hideInfo;

/* ===== SUPABASE client & auth ===== */
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
let drawControl;
let editMode = false;
let featureIndexById = new Map();

function enterEditMode() {
  editMode = true;
  if (btnEditMode) btnEditMode.textContent = "Exit Edit Mode";
  if (editStatus) editStatus.textContent = "You can draw / edit / delete lines.";
  if (!editableGroup) editableGroup = new L.FeatureGroup().addTo(map);
  if (!drawControl) {
    drawControl = new L.Control.Draw({
      draw: { polygon: false, marker: false, circle: false, rectangle: false, circlemarker: false, polyline: true },
      edit: { featureGroup: editableGroup }
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

/* ===== Feature form definitions ===== */
const FEATURE_FIELDS = [
  { key: "id", label: "ID", type: "hidden" },
  { key: "slug", label: "Slug", type: "text", group: "Identification" },

  { key: "name_en", label: "Name (EN)", type: "text", group: "Names", required: true },
  { key: "name_jp", label: "Name (JP)", type: "text", group: "Names" },

  { key: "city", label: "City", type: "text", group: "Location" },
  { key: "prefecture", label: "Prefecture", type: "text", group: "Location" },

  { key: "status", label: "Status", type: "select", group: "Status", options: ["active", "declining", "closed", "planned", "unknown"] },
  // covered & pedestrian_only will be rendered inline by a small custom block (below)
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

// build grouped form
function buildFeatureForm(props = {}) {
  featureFormBody.innerHTML = "";
  const groups = {};
  FEATURE_GROUP_ORDER.forEach(g => groups[g] = []);

  // First, create plain controls
  FEATURE_FIELDS.forEach(f => {
    const group = f.group || "Other";
    const val = props[f.key];
    const id = "f_" + f.key;
    let control = "";

    if (f.type === "hidden") {
      control = `<input id="${id}" type="hidden" value="${val ?? ""}">`;
      (groups[FEATURE_GROUP_ORDER[0]] ||= []).push(control);
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

  // Now render each group; "Status" gets a custom inline row
  FEATURE_GROUP_ORDER.forEach(g => {
    const items = groups[g];
    if (!items || items.length === 0) return;

    const block = document.createElement("div");
    block.className = "form-group";
    block.setAttribute("data-group", g);

    if (g === "Status") {
      const statusRow = items.find(x => x.key === "status")?.html || "";
      const covered = items.find(x => x.key === "covered")?.html || "";
      const pedOnly = items.find(x => x.key === "pedestrian_only")?.html || "";
      block.innerHTML = `
        <h4>${g}</h4>
        <div class="form-row">
          ${statusRow}
        </div>
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

    if (!props.slug) {
      props.slug = (props.name_en || props.name_jp || "sg")
        .toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "")
        .replace(/--+/g, "-").slice(0, 50);
    }


    const { data, error } = await sbClient.rpc("upsert_shotengai", {
      p_geom_wkt: wkt,
      p_id: id,
      p_props: props
    });

    if (error) throw error;

    const newId = Array.isArray(data) ? (data[0]?.id || data[0]) : (data?.id || data);
    featureMsg.textContent = "✅ Saved";
    setTimeout(() => { closeFeatureModal(); }, 300);

    // Update map/index
    if (currentEdit.mode === "new" && currentEdit.layer) {
      const newFeature = { type: "Feature", properties: { ...props, id: newId }, geometry: geom };
      currentEdit.layer.feature = newFeature;
      currentEdit.layer.setStyle(lineStyle);
      currentEdit.layer.on("click", () => showInfo(newFeature));
      featureIndexById.set(newId, currentEdit.layer);
      editableGroup.addLayer(currentEdit.layer);
      showInfo(newFeature);
    } else {
      const lyr = currentEdit.layer || featureIndexById.get(newId || id);
      if (lyr) {
        const updated = { type: "Feature", properties: { ...props, id: newId || id }, geometry: geom };
        lyr.feature = updated;
        showInfo(updated);
      }
    }
  } catch (err) {
    console.error("[save] failed", err);
    featureMsg.textContent = "❌ " + (err?.message || err);
  }
});

/* ===== Draw events ===== */
map.on(L.Draw.Event.CREATED, (e) => {
  if (!editMode) { alert("Enter Edit Mode to create features."); return; }
  currentEdit = { mode: "new", layer: e.layer, feature: null };
  editableGroup.addLayer(e.layer);
  e.layer.setStyle(lineStyle);
  openFeatureForm(null, "New Shotengai");
});

map.on(L.Draw.Event.EDITED, async (e) => {
  if (!currentUser) return;
  e.layers.eachLayer(async (layer) => {
    const id = layer?.feature?.properties?.id;
    if (!id) return; // unsaved
    const wkt = wktFromGeom(layer.toGeoJSON().geometry);
    const { error } = await sbClient.rpc("update_shotengai_geom", { p_id: id, p_geom_wkt: wkt });
    if (error) alert("Update geometry failed: " + error.message);
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
  });
});

/* ===== Init: Supabase + load data ===== */
(async function init() {
  try {
    // Load supabase-js from a reliable CDN (with fallback)
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

    // Get createClient from the CDN loader
    const createClient = await loadSupabaseClient();

    // Optional: quick connectivity probe to your project's REST endpoint
    await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/`, { method: "HEAD" });

    // Create client
    sbClient = createClient(SUPABASE_URL.trim(), SUPABASE_ANON_KEY.trim());

    // Auth state
    sbClient.auth.onAuthStateChange((_e, session) => {
      currentUser = session?.user || null;
    });
    {
      const { data: { user } } = await sbClient.auth.getUser();
      currentUser = user || null;
    }

    // Fetch data
    const { data, error } = await sbClient.from("v_shotengai_geojson").select("*");
    if (error) throw error;

    const features = (data || []).map((r) => {
      let geom = r.geomjson;
      if (typeof geom === "string") {
        try { geom = JSON.parse(geom); } catch { geom = null; }
      }
      return {
        type: "Feature",
        properties: {
          id: r.id, slug: r.slug, name_jp: r.name_jp, name_en: r.name_en,
          city: r.city, prefecture: r.prefecture, status: r.status,
          covered: r.covered, pedestrian_only: r.pedestrian_only,
          type: r.type, classification: r.classification, theme: r.theme,
          length_m: r.length_m, nearest_station: r.nearest_station, walk_min: r.walk_min,
          association: r.association, url: r.url, image: r.image, source: r.source,
          accuracy: r.accuracy, last_update: r.last_update, description: r.description
        },
        geometry: geom
      };
    });

    // Add to map
    const layer = L.geoJSON({ type: "FeatureCollection", features }, {
      style: lineStyle,
      onEachFeature: (feat, lyr) => {
        lyr.on("click", () => {
          currentEdit = { mode: "edit", layer: lyr, feature: feat };
          showInfo(feat);
        });
        lyr.on("mouseover", () => lyr.setStyle(lineStyleHover));
        lyr.on("mouseout", () => lyr.setStyle(lineStyle));
        if (feat?.properties?.id) featureIndexById.set(feat.properties.id, lyr);
      }
    }).addTo(map);

    if (layer.getLayers().length) {
      map.fitBounds(layer.getBounds(), { padding: [40, 40] });
    }

    // Sidebar results
    const resultsContainer = document.getElementById("results");
    const resultCount = document.getElementById("resultCount");
    resultCount.textContent = features.length;

    resultsContainer.innerHTML = features.map(f => {
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

    resultsContainer.querySelectorAll(".result-item").forEach(el => {
      el.addEventListener("click", () => {
        const id = el.dataset.id;
        const lyr = featureIndexById.get(id);
        if (!lyr) return;
        map.fitBounds(lyr.getBounds(), { padding: [50, 50] });
        const feat = lyr.feature || features.find(f => String(f.properties.id) === id);
        if (feat) {
          currentEdit = { mode: "edit", layer: lyr, feature: feat };
          showInfo(feat);
        }
      });
    });

  } catch (err) {
    console.error("[Atlas] init failed:", err);
    alert("Failed to load data from Supabase: " + (err.message || err));
  }
})();

