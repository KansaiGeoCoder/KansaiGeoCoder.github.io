/* =========================
   Shotengai Atlas (Supabase)
   ========================= */

/* ===== MAP SETUP ===== */
const basemaps = {
  light: L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }
  ),
  dark: L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    { maxZoom: 19, attribution: "&copy; OpenStreetMap &copy; CARTO" }
  )
};

const map = L.map("map", {
  center: [36.2048, 137.2529],
  zoom: 5,
  layers: [basemaps.dark]
});

L.control.layers({ "Light": basemaps.light, "Dark": basemaps.dark }).addTo(map);
L.Control.geocoder({ defaultMarkGeocode: false })
  .on("markgeocode", (e) => map.fitBounds(e.geocode.bbox))
  .addTo(map);

// Styles
const lineStyle = { color: "#7aa2ff", weight: 3, opacity: 0.9 };
const lineStyleHover = { color: "#14b8a6", weight: 4, opacity: 1 };

/* ===== INFO CARD (bottom-right) ===== */
const infoPanel = document.getElementById("infopanel");
const infoCard = document.getElementById("info");

function showInfo(feature) {
  const p = feature.properties || {};
  const name = p.name_en || p.name_jp || "Unnamed Shotengai";

  const statusChip = p.status
    ? `<span class="pill pill-${String(p.status).toLowerCase()}">${p.status}</span>`
    : "";

  const coveredChip = (p.covered === true || p.covered === false)
    ? `<span class="pill">${p.covered ? "Covered" : "Open-air"}</span>`
    : "";

  infoCard.innerHTML = `
    <div class="card-head">
      <div class="title">${name}</div>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn btn-ghost" onclick="(window._openFeatureForm&&window._openFeatureForm())">Edit</button>
        <button class="close" onclick="(window._hideInfo&&window._hideInfo())">×</button>
      </div>
    </div>
    <div class="chips">${statusChip} ${coveredChip}</div>
    <div class="meta">
      ${(p.city || "")}${p.city && p.prefecture ? ", " : ""}${p.prefecture || ""}
      <br>Length: ${Math.round(p.length_m || 0)} m
      ${p.width_avg ? `<br>Width (avg): ${p.width_avg}` : ""}
      ${p.shops_est ? `<br>Shops (est.): ${p.shops_est}` : ""}
      ${p.established ? `<br>Since: ${p.established}` : ""}
      ${p.last_renov ? `<br>Last renovation: ${p.last_renov}` : ""}
      ${p.nearest_station ? `<br>Nearest Station: ${p.nearest_station}` : ""}
      ${p.walk_min ? `<br>Walk: ${p.walk_min} min` : ""}
      ${p.type ? `<br>Type: ${p.type}` : ""}
      ${p.classification ? `<br>Class: ${p.classification}` : ""}
      ${p.theme ? `<br>Theme: ${p.theme}` : ""}
      ${p.association ? `<br>Association: ${p.association}` : ""}
    </div>
    ${p.description ? `<div class="desc">${p.description}</div>` : ""}
    ${p.url ? `<div class="link"><a href="${p.url}" target="_blank">Visit Website</a></div>` : ""}
    ${p.image ? `<div class="link"><a href="${p.image}" target="_blank">Image</a></div>` : ""}
    ${p.source ? `<div class="meta">Source: ${p.source}</div>` : ""}
    <div class="footer">
      ${p.accuracy ? `Accuracy: ${p.accuracy} · ` : ""}
      Last updated: ${p.last_update ? new Date(p.last_update).toLocaleDateString() : "—"}
    </div>
  `;
  infoPanel.style.display = "block";

  // Bind the Edit button to this feature
  window._openFeatureForm = () => openFeatureForm(feature, "Edit Shotengai");
}
function hideInfo() { infoPanel.style.display = "none"; }
window._hideInfo = hideInfo;

/* ===== SUPABASE (client + helpers) ===== */
const SUPABASE_URL = "https://qdykenvvtqnzdgtzcmhe.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkeWtlbnZ2dHFuemRndHpjbWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MDg0MDEsImV4cCI6MjA3NzM4NDQwMX0.zN6Mpfnxr5_ufc6dMDO89LZBXSFYa4ex4vbiu1Q813U";

let sbClient; // set in init()

// Normalize to MultiLineString
function toMultiLine(geom) {
  if (!geom) throw new Error("No geometry");
  if (geom.type === "MultiLineString") return geom;
  if (geom.type === "LineString") return { type: "MultiLineString", coordinates: [geom.coordinates] };
  throw new Error("Only LineString/MultiLineString supported");
}

// WKT from (Multi)LineString
function wktFromGeom(geom) {
  const g = toMultiLine(geom); // ensure MultiLineString
  const parts = g.coordinates
    .map(line => `(${line.map(([x, y]) => `${x} ${y}`).join(",")})`)
    .join(",");
  return `MULTILINESTRING(${parts})`;
}

/* ===== Edit mode state ===== */
let editableGroup;                // FeatureGroup used by Leaflet.draw
let drawControl;                  // Draw control instance
let editMode = false;             // toggle
let featureIndexById = new Map(); // id -> layer

// Auth modal elements (if present)
const authModal = document.getElementById("authModal");
const authEmail = document.getElementById("authEmail");
const authPass = document.getElementById("authPass");
const authMsg = document.getElementById("authMsg");
const btnLogin = document.getElementById("btnLogin");
const btnCloseAuth = document.getElementById("btnCloseAuth");
const btnEditMode = document.getElementById("btnEditMode");
const editStatus = document.getElementById("editStatus");

function openAuth() { if (authModal) { authModal.style.display = "flex"; authMsg && (authMsg.textContent = ""); } }
function closeAuth() { if (authModal) { authModal.style.display = "none"; if (authEmail) authEmail.value = ""; if (authPass) authPass.value = ""; } }

async function ensureAuth() {
  const { data: { user } } = await sbClient.auth.getUser();
  if (user) return user;
  openAuth();
  return null;
}

btnCloseAuth?.addEventListener("click", closeAuth);
btnLogin?.addEventListener("click", async () => {
  if (!sbClient) return;
  if (authMsg) authMsg.textContent = "Signing in…";
  const { error } = await sbClient.auth.signInWithPassword({
    email: (authEmail?.value || "").trim(),
    password: authPass?.value || ""
  });
  if (error) { if (authMsg) authMsg.textContent = "❌ " + error.message; return; }
  if (authMsg) authMsg.textContent = "✅ Signed in";
  setTimeout(() => { closeAuth(); enterEditMode(); }, 300);
});

btnEditMode?.addEventListener("click", async () => {
  if (!editMode) {
    const user = await ensureAuth();
    if (user) enterEditMode();
  } else {
    exitEditMode();
  }
});

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

/* ===== Attribute Form (dynamic, full schema) ===== */
const featureModal = document.getElementById("featureModal");
let editingFeature = null; // GeoJSON Feature being edited (must contain properties.id)

const FIELD_DEFS = [
  // Group: Identity
  { key: "id", label: "ID", type: "text", readonly: true },
  { key: "slug", label: "Slug", type: "text", help: "Auto from name, but editable" },

  // Group: Names
  { key: "name_jp", label: "Name (JP)", type: "text" },
  { key: "name_en", label: "Name (EN)", type: "text" },

  // Group: Location
  { key: "city", label: "City", type: "text" },
  { key: "prefecture", label: "Prefecture", type: "text" },

  // Group: Status / flags
  { key: "status", label: "Status", type: "select", options: ["", "active", "declining", "closed", "planned"] },
  { key: "covered", label: "Covered", type: "boolean" },
  { key: "pedestrian_only", label: "Pedestrian only", type: "boolean" },

  // Group: Typology / descriptors
  { key: "type", label: "Type", type: "text" },
  { key: "classification", label: "Classification", type: "text" },
  { key: "theme", label: "Theme", type: "text" },

  // Group: Metrics
  { key: "length_m", label: "Length (m)", type: "number", step: "any", readonly: true },
  { key: "width_avg", label: "Width avg", type: "number", step: "any" },
  { key: "shops_est", label: "Shops (est.)", type: "number" },

  // Group: Timeline
  { key: "established", label: "Established (year)", type: "number" },
  { key: "last_renov", label: "Last renovation (year)", type: "number" },

  // Group: Access
  { key: "nearest_station", label: "Nearest station", type: "text" },
  { key: "walk_min", label: "Walk (min)", type: "number" },

  // Group: Governance / refs
  { key: "association", label: "Association", type: "text" },
  { key: "url", label: "Website URL", type: "url" },
  { key: "image", label: "Image URL", type: "url" },
  { key: "source", label: "Source", type: "text" },

  // Group: Provenance
  { key: "accuracy", label: "Accuracy", type: "text" },
  { key: "last_update", label: "Last update", type: "text", readonly: true }
];

// Build the form skeleton if needed
function ensureFormScaffold() {
  if (!featureModal) return;

  // If already rendered once, do nothing
  if (featureModal.querySelector(".feature-form")) return;

  const card = featureModal.querySelector(".auth-card") || featureModal.firstElementChild;
  if (!card) return;

  // Replace inner content with full dynamic form
  card.innerHTML = `
    <h3 id="featureFormTitle">Shotengai Details</h3>
    <div class="feature-form"></div>
    <div class="auth-row" style="justify-content:space-between">
      <button id="btnSaveFeature" class="btn">Save</button>
      <button id="btnCancelFeature" class="btn btn-ghost">Cancel</button>
      <div id="featureMsg" class="auth-msg"></div>
    </div>
  `;

  // Render inputs
  const form = card.querySelector(".feature-form");
  FIELD_DEFS.forEach(def => {
    const row = document.createElement("div");
    row.className = "form-row";
    row.dataset.key = def.key;

    const label = document.createElement("label");
    label.textContent = def.label;

    let input;
    if (def.type === "select") {
      input = document.createElement("select");
      def.options.forEach(opt => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt || "—";
        input.appendChild(o);
      });
    } else if (def.type === "boolean") {
      // checkbox row style
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "8px";
      input = document.createElement("input");
      input.type = "checkbox";
      label.style.margin = "0";
    } else {
      input = document.createElement("input");
      input.type = def.type;
      if (def.step) input.step = def.step;
      if (def.help) input.placeholder = def.help;
    }

    input.id = "f_" + def.key;
    if (def.readonly) input.readOnly = true;

    row.appendChild(label);
    row.appendChild(input);
    form.appendChild(row);
  });

  // Attach buttons
  const btnSaveFeature = card.querySelector("#btnSaveFeature");
  const btnCancelFeature = card.querySelector("#btnCancelFeature");
  const featureMsg = card.querySelector("#featureMsg");

  btnCancelFeature.addEventListener("click", closeFeatureForm);
  btnSaveFeature.addEventListener("click", async () => {
    try {
      if (!sbClient) throw new Error("No Supabase client");
      if (!editingFeature?.properties?.id) throw new Error("Missing feature id");
      featureMsg.textContent = "Saving…";

      // Gather values
      const payload = readFormValues();

      // Update DB
      const { error } = await sbClient
        .from("shotengai")
        .update(payload)
        .eq("id", editingFeature.properties.id);

      if (error) throw error;

      // Update in-memory + UI
      Object.assign(editingFeature.properties, payload);
      showInfo(editingFeature);

      // Update list title if name changed
      const item = document.querySelector(`.result-item[data-id="${editingFeature.properties.id}"] .result-name`);
      if (item) {
        const newName = editingFeature.properties.name_en || editingFeature.properties.name_jp || "Unnamed Shotengai";
        item.textContent = newName;
      }

      featureMsg.textContent = "✅ Saved";
      setTimeout(closeFeatureForm, 300);
    } catch (err) {
      featureMsg.textContent = "❌ " + err.message;
    }
  });
}

// Read values from form into clean payload (empty->null, numbers parsed)
function readFormValues() {
  const byId = (k) => document.getElementById("f_" + k);

  // helpers
  const txt = (k) => {
    const el = byId(k);
    if (!el) return null;
    const v = (el.value || "").trim();
    return v === "" ? null : v;
  };
  const num = (k) => {
    const el = byId(k);
    if (!el) return null;
    const v = (el.value || "").trim();
    if (v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const bool = (k) => {
    const el = byId(k);
    if (!el) return null;
    return !!el.checked;
  };

  // slug: auto if empty
  let _slug = txt("slug");
  if (!_slug) {
    const base = txt("name_en") || txt("name_jp") || "";
    _slug = slugify(base);
    const elSlug = byId("slug");
    if (elSlug) elSlug.value = _slug;
  }

  return {
    slug: _slug,
    name_jp: txt("name_jp"),
    name_en: txt("name_en"),
    city: txt("city"),
    prefecture: txt("prefecture"),
    status: (document.getElementById("f_status")?.value || "").toLowerCase() || null,
    covered: bool("covered"),
    pedestrian_only: bool("pedestrian_only"),
    type: txt("type"),
    classification: txt("classification"),
    theme: txt("theme"),
    // length_m is derived (readonly)
    width_avg: num("width_avg"),
    shops_est: num("shops_est"),
    established: num("established"),
    last_renov: num("last_renov"),
    nearest_station: txt("nearest_station"),
    walk_min: num("walk_min"),
    association: txt("association"),
    url: txt("url"),
    image: txt("image"),
    source: txt("source"),
    accuracy: txt("accuracy")
    // last_update is derived (readonly)
  };
}

function fillFormValues(feature, title = "Shotengai Details") {
  const p = feature?.properties || {};
  const set = (k, v) => {
    const el = document.getElementById("f_" + k);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!v;
    else el.value = (v ?? "").toString();
  };

  document.getElementById("featureFormTitle").textContent = title;

  set("id", p.id);
  set("slug", p.slug);
  set("name_jp", p.name_jp);
  set("name_en", p.name_en);
  set("city", p.city);
  set("prefecture", p.prefecture);
  set("status", p.status);
  set("covered", p.covered);
  set("pedestrian_only", p.pedestrian_only);
  set("type", p.type);
  set("classification", p.classification);
  set("theme", p.theme);
  set("length_m", p.length_m);
  set("width_avg", p.width_avg);
  set("shops_est", p.shops_est);
  set("established", p.established);
  set("last_renov", p.last_renov);
  set("nearest_station", p.nearest_station);
  set("walk_min", p.walk_min);
  set("association", p.association);
  set("url", p.url);
  set("image", p.image);
  set("source", p.source);
  set("accuracy", p.accuracy);
  set("last_update", p.last_update ? new Date(p.last_update).toISOString() : "");
}

function openFeatureForm(feature, title = "Shotengai Details") {
  ensureFormScaffold();
  editingFeature = feature;
  fillFormValues(feature, title);
  featureModal.style.display = "flex";
}
function closeFeatureForm() {
  featureModal.style.display = "none";
  editingFeature = null;
}

function slugify(s) {
  return (s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .substring(0, 80);
}

/* ===== LOAD DATA FROM SUPABASE ===== */
(async function init() {
  try {
    // Supabase client
    sbClient = (await import("https://esm.sh/@supabase/supabase-js@2"))
      .createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    console.log("[Atlas] Loading Shotengai data from Supabase…");
    const { data, error } = await sbClient.from("v_shotengai_geojson").select("*");
    if (error) throw new Error(error.message);

    const geojson = {
      type: "FeatureCollection",
      features: data.map((r) => ({
        type: "Feature",
        properties: {
          id: r.id,
          slug: r.slug,
          name_jp: r.name_jp,
          name_en: r.name_en,
          city: r.city,
          prefecture: r.prefecture,
          status: r.status,
          covered: r.covered,
          pedestrian_only: r.pedestrian_only,
          type: r.type,
          classification: r.classification,
          theme: r.theme,
          length_m: r.length_m,
          width_avg: r.width_avg,
          shops_est: r.shops_est,
          established: r.established,
          last_renov: r.last_renov,
          nearest_station: r.nearest_station,
          walk_min: r.walk_min,
          association: r.association,
          url: r.url,
          image: r.image,
          source: r.source,
          last_update: r.last_update,
          accuracy: r.accuracy
        },
        geometry: r.geomjson
      }))
    };

    console.log(`[Atlas] Loaded ${geojson.features.length} features from Supabase.`);

    /* ===== Populate Results list ===== */
    const resultsContainer = document.getElementById("results");
    const resultCount = document.getElementById("resultCount");

    if (resultsContainer && resultCount) {
      resultCount.textContent = geojson.features.length;

      resultsContainer.innerHTML = geojson.features
        .map((f) => {
          const p = f.properties;
          const name = p.name_en || p.name_jp || "Unnamed Shotengai";
          const city = p.city || "";
          const status = (p.status || "").toString().toLowerCase();
          const color =
            status === "active" ? "#22c55e" :
              status === "declining" ? "#f59e0b" :
                status === "closed" ? "#ef4444" : "#9ca3af";
          return `
            <div class="result-item" data-id="${p.id}" style="border-left:4px solid ${color}">
              <div class="result-name">${name}</div>
              <div class="result-meta">${city} · ${p.prefecture || ""}</div>
            </div>`;
        })
        .join("");

      // Click -> zoom + open card
      resultsContainer.querySelectorAll(".result-item").forEach((el) => {
        el.addEventListener("click", () => {
          const id = el.dataset.id;
          const f = geojson.features.find((x) => x.properties.id === id);
          if (f) {
            const tmp = L.geoJSON(f);
            map.fitBounds(tmp.getBounds(), { padding: [50, 50] });
            showInfo(f);
          }
        });
      });
    }

    /* ===== Render lines ===== */
    const lineLayer = L.geoJSON(geojson, {
      style: (f) => ({ ...lineStyle, weight: 5, className: "shotengai-line" }),
      bubblingMouseEvents: false, // keep click from reaching map
      onEachFeature: (f, layer) => {
        layer.on({
          mouseover: () => layer.setStyle(lineStyleHover),
          mouseout: () => layer.setStyle(lineStyle),
          click: (e) => {
            if (L && L.DomEvent) L.DomEvent.stop(e);
            showInfo(f);
            // Tip: Shift+Click to open attribute form directly
            if (e.originalEvent && e.originalEvent.shiftKey) {
              openFeatureForm(f, "Edit Shotengai");
            }
          }
        });
        featureIndexById.set(f.properties.id, layer);
      }
    }).addTo(map);

    // Make editable group & mirror current lines for edit mode
    if (!editableGroup) editableGroup = new L.FeatureGroup().addTo(map);
    lineLayer.eachLayer(l => editableGroup.addLayer(l));

    // Fit to features
    try { map.fitBounds(lineLayer.getBounds(), { padding: [40, 40] }); }
    catch (err) { console.warn("No bounds to fit:", err); }

    // Map background click closes the card
    map.on("click", (e) => {
      const target = e.originalEvent?.target;
      if (target && target.closest && target.closest(".infocard")) return;
      hideInfo();
    });

  } catch (e) {
    console.error("[Atlas] Failed to load from Supabase:", e);
    L.marker([35.0116, 135.7681]).addTo(map)
      .bindPopup("Couldn’t load Shotengai data from Supabase")
      .openPopup();
    return;
  }
})();

/* ===== Leaflet.draw CRUD handlers ===== */
map.on(L.Draw.Event.CREATED, async (e) => {
  if (!editMode || !sbClient) return;
  const layer = e.layer;
  const gj = layer.toGeoJSON();
  const id = crypto.randomUUID();
  const slug = `sg-${id.slice(0, 8)}`;

  try {
    const multi = toMultiLine(gj.geometry);      // normalize to MULTILINESTRING
    const wkt = wktFromGeom(multi);

    const { error } = await sbClient.from('shotengai').insert({
      id, slug,
      name_en: 'New Shotengai',
      status: 'planned',
      geom: `SRID=4326;${wkt}`
    });
    if (error) throw error;

    // keep on map & index
    layer.feature = {
      type: 'Feature',
      properties: { id, slug, name_en: 'New Shotengai', status: 'planned' },
      geometry: multi
    };
    editableGroup.addLayer(layer);
    featureIndexById.set(id, layer);
    showInfo(layer.feature);

    // Open attribute form immediately
    openFeatureForm(layer.feature, "New Shotengai");
  } catch (err) {
    alert("Insert failed: " + err.message);
  }
});

map.on(L.Draw.Event.EDITED, async (e) => {
  if (!editMode || !sbClient) return;
  const layers = e.layers.getLayers();
  for (const layer of layers) {
    const f = layer.feature;
    if (!f?.properties?.id) continue;
    try {
      const multi = toMultiLine(layer.toGeoJSON().geometry); // normalize
      const wkt = wktFromGeom(multi);
      const { error } = await sbClient
        .from('shotengai')
        .update({ geom: `SRID=4326;${wkt}` })
        .eq('id', f.properties.id);
      if (error) throw error;

      // keep normalized geometry in memory
      layer.feature.geometry = multi;
      // refresh card if open on this feature
      if (infoPanel.style.display === "block" && editingFeature?.properties?.id === f.properties.id) {
        showInfo(layer.feature);
      }
    } catch (err) {
      alert("Update failed: " + err.message);
    }
  }
});

map.on(L.Draw.Event.DELETED, async (e) => {
  if (!editMode || !sbClient) return;
  const layers = e.layers.getLayers();
  for (const layer of layers) {
    const f = layer.feature;
    if (!f?.properties?.id) continue;
    try {
      const { error } = await sbClient.from('shotengai').delete().eq('id', f.properties.id);
      if (error) throw error;
      featureIndexById.delete(f.properties.id);
      // Close card if it was showing this feature
      if (infoPanel.style.display === "block" && editingFeature?.properties?.id === f.properties.id) {
        hideInfo();
        closeFeatureForm();
      }
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  }
});
