/* =========================
   Shotengai Atlas (Supabase)
   ========================= */

/* ===== MAP SETUP ===== */
const basemaps = {
  light: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }),
  dark: L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    { maxZoom: 19, attribution: "&copy; OpenStreetMap &copy; CARTO" })
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

/* ===== INFO CARD ===== */
const infoPanel = document.getElementById("infopanel");
const infoCard = document.getElementById("info");
function showInfo(feature) {
  const p = feature.properties || {};
  const name = p.name_en || p.name_jp || "Unnamed Shotengai";

  const canEdit = !!currentUser && editMode;
  const editBtnHtml = canEdit
    ? `<button class="btn btn-ghost" onclick="(window._openFeatureForm && window._openFeatureForm())">Edit</button>`
    : "";

  const statusChip = p.status ? `<span class="pill pill-${String(p.status).toLowerCase()}">${p.status}</span>` : "";
  const coveredChip = (p.covered === true || p.covered === false)
    ? `<span class="pill">${p.covered ? "Covered" : "Open-air"}</span>` : "";

  infoCard.innerHTML = `
    <div class="card-head">
      <div class="title">${name}</div>
      <div style="display:flex;gap:6px;align-items:center">
        ${editBtnHtml}
        <button class="close" onclick="(window._hideInfo && window._hideInfo())">×</button>
      </div>
    </div>
    <div class="chips">${statusChip}${coveredChip}</div>
    <div class="meta">
      ${[p.city, p.prefecture].filter(Boolean).join(" · ")}${p.length_m ? ` · ${Math.round(p.length_m)} m` : ""}
    </div>
    ${p.url ? `<div class="link"><a href="${p.url}" target="_blank" rel="noopener">Website ↗</a></div>` : ""}
    ${p.description ? `<div class="desc">${p.description}</div>` : ""}
    <div class="footer">
      ${p.accuracy ? `Accuracy: ${p.accuracy} · ` : ""}Last updated: ${p.last_update ? new Date(p.last_update).toLocaleDateString() : "—"}
    </div>
  `;
  infoPanel.style.display = "block";

  window._openFeatureForm = async () => {
    if (!currentUser) { const u = await ensureAuth(); if (!u) return; }
    if (!editMode) enterEditMode();
    openFeatureForm(feature, "Edit Shotengai");
  };
}
function hideInfo() { infoPanel.style.display = "none"; }
window._hideInfo = hideInfo;

/* ===== SUPABASE CONFIG ===== */
const SUPABASE_URL = "https://qdykenvvtqnzdgtzcmhe.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY_HERE"; // make sure this is the real key in production

let sbClient = null;
let currentUser = null;

/* ===== Edit mode state ===== */
let editableGroup;
let drawControl;
let editMode = false;
let featureIndexById = new Map();

// Auth modal + controls
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

/* ===== Edit mode toggles ===== */
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

/* ===== Feature form (scaffold kept as in your file) ===== */
// (… keep your FIELD_DEFS and form wiring here unchanged …)

/* ===== INIT: Supabase + load data ===== */
(async function init() {
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    sbClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Auth listeners (only after client exists)
    sbClient.auth.onAuthStateChange((_e, session) => {
      currentUser = session?.user || null;
      console.log("[Auth] currentUser:", currentUser ? currentUser.email : "none");
    });
    const { data: { user } } = await sbClient.auth.getUser();
    currentUser = user || null;

    // Query
    console.log("[Atlas] Querying v_shotengai_geojson …");
    const { data, error } = await sbClient.from("v_shotengai_geojson").select("*");
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("Unexpected response shape");
    console.log(`[Atlas] Rows: ${data.length}`);

    // Build FeatureCollection (handles stringified geomjson too)
    const features = data.map((r, i) => {
      let geom = r.geomjson;
      if (typeof geom === "string") {
        try { geom = JSON.parse(geom); } catch { console.warn(`[Atlas] Row ${i} bad geomjson string`); geom = null; }
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
          accuracy: r.accuracy, last_update: r.last_update
        },
        geometry: geom
      };
    });
    const geojson = { type: "FeatureCollection", features };
    document.getElementById("resultCount").textContent = features.length;

    // Add to map (lines only shown for now; plug in points if you add them)
    const layer = L.geoJSON(geojson, {
      style: lineStyle,
      onEachFeature: (feat, lyr) => {
        lyr.on("click", () => showInfo(feat));
        lyr.on("mouseover", () => lyr.setStyle(lineStyleHover));
        lyr.on("mouseout", () => lyr.setStyle(lineStyle));
        if (feat?.properties?.id) featureIndexById.set(feat.properties.id, lyr);
      }
    }).addTo(map);
    map.fitBounds(layer.getBounds(), { padding: [40, 40] });

    // Results list
    const resultsContainer = document.getElementById("results");
    resultsContainer.innerHTML = features.map(f => {
      const p = f.properties;
      const name = p.name_en || p.name_jp || "Unnamed Shotengai";
      const status = (p.status || "").toString().toLowerCase();
      const color = status === "active" ? "#22c55e" : status === "declining" ? "#f59e0b" : status === "closed" ? "#ef4444" : "#9ca3af";
      return `<div class="result-item" data-id="${p.id}" style="border-left:4px solid ${color}">
        <div class="result-name">${name}</div>
        <div class="result-meta">${[p.city, p.prefecture].filter(Boolean).join(" · ")}</div>
      </div>`;
    }).join("");
    resultsContainer.querySelectorAll(".result-item").forEach(el => {
      el.addEventListener("click", () => {
        const f = features.find(x => String(x.properties.id) === el.dataset.id);
        if (!f) return;
        const tmp = L.geoJSON(f);
        map.fitBounds(tmp.getBounds(), { padding: [50, 50] });
        showInfo(f);
      });
    });

    // TODO: wire up Leaflet.draw save/update/delete handlers (unchanged from your file)

  } catch (err) {
    console.error("[Atlas] init failed:", err);
    alert("Failed to load data from Supabase: " + err.message);
  }
})();

// --- Persist drawings to Supabase (minimal example) ---
map.on(L.Draw.Event.CREATED, async (e) => {
  if (!currentUser) return;
  const layer = e.layer;
  editableGroup.addLayer(layer);
  const gj = layer.toGeoJSON();
  const wkt = wktFromGeom(gj.geometry);

  const props = {
    name_en: "New Shotengai",
    city: "",
    prefecture: "",
    status: "planned",
    covered: false,
    url: "",
    description: "",
  };

  const { data, error } = await sbClient.rpc("upsert_shotengai_line", {
    p_geom_wkt: wkt,
    p_props: props
  });
  if (error) { alert("Save failed: " + error.message); return; }

  // attach returned id to layer for future edits
  const id = data?.id || data?.[0]?.id;
  if (id) { layer.feature = { type: "Feature", properties: { id }, geometry: gj.geometry }; }
});

map.on(L.Draw.Event.EDITED, async (e) => {
  if (!currentUser) return;
  const layers = e.layers;
  layers.eachLayer(async (layer) => {
    const id = layer?.feature?.properties?.id;
    if (!id) return;
    const gj = layer.toGeoJSON();
    const wkt = wktFromGeom(gj.geometry);
    const { error } = await sbClient.rpc("update_shotengai_geom", { p_id: id, p_geom_wkt: wkt });
    if (error) alert("Update failed: " + error.message);
  });
});

map.on(L.Draw.Event.DELETED, async (e) => {
  if (!currentUser) return;
  const layers = e.layers;
  layers.eachLayer(async (layer) => {
    const id = layer?.feature?.properties?.id;
    if (!id) return;
    const { error } = await sbClient.from("shotengai").delete().eq("id", id);
    if (error) alert("Delete failed: " + error.message);
  });
});
