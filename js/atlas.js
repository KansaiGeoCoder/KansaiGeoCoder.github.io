// ===== MAP SETUP =====
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
  layers: [basemaps.dark] // Default to dark map
});

L.control.layers({ "Light": basemaps.light, "Dark": basemaps.dark }).addTo(map);
L.Control.geocoder({ defaultMarkGeocode: false })
  .on("markgeocode", (e) => map.fitBounds(e.geocode.bbox))
  .addTo(map);

// ===== INFO CARD SETUP =====
const infoPanel = document.getElementById("infopanel");
const infoCard = document.getElementById("info");

function showInfo(feature) {
  const p = feature.properties;
  const name = p.name_en || p.name_ja || "Unnamed Shotengai";

  const chips = [
    p.status && `<span class="pill pill-${p.status.toLowerCase()}">${p.status}</span>`,
    p.covered ? `<span class="pill">Covered</span>` : `<span class="pill">Open-air</span>`,
  ].join(" ");

  const details = `
    <div class="card-head">
      <div class="title">${name}</div>
      <button class="close" onclick="hideInfo()">×</button>
    </div>

    <div class="chips">${chips}</div>
    <div class="meta">
      ${p.city || ""}, ${p.prefecture || ""}
      <br>Length: ${Math.round(p.length_m || 0)} m
      ${p.established ? `<br>Since: ${p.established}` : ""}
      ${p.nearest_sta ? `<br>Nearest Station: ${p.nearest_sta}` : ""}
    </div>

    ${p.description ? `<div class="desc">${p.description}</div>` : ""}
    ${p.url ? `<div class="link"><a href="${p.url}" target="_blank">Visit Website</a></div>` : ""}
    <div class="footer">Last updated: ${new Date(p.last_update).toLocaleDateString()}</div>
  `;

  infoCard.innerHTML = details;
  infoPanel.style.display = "block";
}

function hideInfo() {
  infoPanel.style.display = "none";
}


// ===== STYLES =====
const lineStyle = { color: "#7aa2ff", weight: 3, opacity: 0.9 };
const lineStyleHover = { color: "#14b8a6", weight: 4, opacity: 1 };

function circleStyle(feature) {
  const s = (feature.properties?.status || feature.properties?.Status || "")
    .toString()
    .toLowerCase();
  const fill =
    s === "active"
      ? "#22c55e"
      : s === "declining"
        ? "#f59e0b"
        : s === "closed"
          ? "#ef4444"
          : "#9ca3af";
  return {
    radius: 6,
    color: "#0b1220",
    weight: 1,
    fillColor: fill,
    fillOpacity: 0.95,
  };
}

const dotIcon = L.divIcon({
  className: "sg-dot",
  html: '<div style="width:10px;height:10px;border-radius:999px;background:#9ca3af;border:1px solid #0b1220"></div>',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

// ===== LOAD DATA FROM SUPABASE =====
(async function init() {
  let geojson;
  try {
    console.log("[Atlas] Loading Shotengai data from Supabase…");

    // Connect to Supabase
    const SUPABASE_URL = "https://qdykenvvtqnzdgtzcmhe.supabase.co";
    const SUPABASE_ANON_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkeWtlbnZ2dHFuemRndHpjbWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MDg0MDEsImV4cCI6MjA3NzM4NDQwMX0.zN6Mpfnxr5_ufc6dMDO89LZBXSFYa4ex4vbiu1Q813U";

    const sb = (await import("https://esm.sh/@supabase/supabase-js@2"))
      .createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Query the GeoJSON view
    const { data, error } = await sb.from("v_shotengai_geojson").select("*");
    if (error) throw new Error(error.message);

    // Convert to FeatureCollection
    geojson = {
      type: "FeatureCollection",
      features: data.map((r) => ({
        type: "Feature",
        properties: {
          id: r.id,
          slug: r.slug,
          name_ja: r.name_ja,
          name_en: r.name_en,
          city: r.city,
          prefecture: r.prefecture,
          status: r.status,
          covered: r.covered,
          length_m: r.length_m,
          url: r.url,
          notes: r.notes,
          last_update: r.last_update,
        },
        geometry: r.geomjson,
      })),
    };

    console.log(`[Atlas] Loaded ${geojson.features.length} features from Supabase.`);

    // ===== UPDATE RESULTS LIST =====
    const resultsContainer = document.getElementById("results");
    const resultCount = document.getElementById("resultCount");

    if (resultsContainer && resultCount) {
      resultCount.textContent = geojson.features.length;

      resultsContainer.innerHTML = geojson.features
        .map((f) => {
          const p = f.properties;
          const name = p.name_en || p.name_ja || "Unnamed Shotengai";
          const city = p.city || "";
          const status = (p.status || "").toString().toLowerCase();
          const color =
            status === "active"
              ? "#22c55e"
              : status === "declining"
                ? "#f59e0b"
                : status === "closed"
                  ? "#ef4444"
                  : "#9ca3af";
          return `
            <div class="result-item" data-id="${p.id}" style="border-left:4px solid ${color}">
              <div class="result-name">${name}</div>
              <div class="result-meta">${city} · ${p.prefecture || ""}</div>
            </div>`;
        })
        .join("");

      // Click -> zoom to Shotengai
      resultsContainer.querySelectorAll(".result-item").forEach((el) => {
        el.addEventListener("click", () => {
          const id = el.dataset.id;
          const f = geojson.features.find((x) => x.properties.id === id);
          if (f) {
            const layer = L.geoJSON(f);
            map.fitBounds(layer.getBounds(), { padding: [50, 50] });
            showInfo(f); // open info card (dark bottom panel)
          }
        });
      });
    }
  } catch (e) {
    console.error("[Atlas] Failed to load from Supabase:", e);
    L.marker([35.0116, 135.7681])
      .addTo(map)
      .bindPopup("Couldn’t load Shotengai data from Supabase")
      .openPopup();
    return;
  }

  // ===== ADD LAYERS =====
  if (geojson.features.length) {
    const lineLayer = L.geoJSON(geojson, {
      style: (f) => ({
        ...lineStyle,
        weight: 5,                 // easier to click
        className: "shotengai-line"
      }),
      bubblingMouseEvents: false,  // ✅ stop bubbling to map
      onEachFeature: (f, layer) => {
        layer.on({
          mouseover: () => layer.setStyle(lineStyleHover),
          mouseout: () => layer.setStyle(lineStyle),
          click: (e) => {
            // ✅ completely swallow the event so map's click handler never fires
            if (L && L.DomEvent) L.DomEvent.stop(e);
            showInfo(f);
          },
        });
      },
    }).addTo(map);

    // keep lines on top
    lineLayer.eachLayer((l) => l.bringToFront && l.bringToFront());

    try {
      map.fitBounds(lineLayer.getBounds(), { padding: [40, 40] });
    } catch (err) {
      console.warn("No bounds to fit:", err);
    }

    // Click on empty map closes the card (this now won't fire after line clicks)
    map.on("click", (e) => {
      const target = e.originalEvent?.target;
      if (target && target.closest && target.closest(".infocard")) return;
      hideInfo();
    });
  } else {
    console.warn("No Shotengai data found in Supabase.");
    L.marker([35.0116, 135.7681]).addTo(map)
      .bindPopup("No Shotengai data found in database.")
      .openPopup();
  }




})();

