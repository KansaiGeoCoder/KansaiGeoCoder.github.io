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
      style: lineStyle,
      onEachFeature: (f, layer) => {
        layer.on({
          mouseover: () => layer.setStyle(lineStyleHover),
          mouseout: () => layer.setStyle(lineStyle),
        });

        layer.bindPopup(`
          <b>${f.properties.name_en || "Unnamed Shotengai"}</b><br>
          ${f.properties.city || ""}, ${f.properties.prefecture || ""}<br>
          Status: ${f.properties.status || "unknown"}<br>
          Length: ${Math.round(f.properties.length_m || 0)} m<br>
          <a href="${f.properties.url || "#"}" target="_blank">Website</a>
        `);
      },
    }).addTo(map);

    try {
      map.fitBounds(lineLayer.getBounds(), { padding: [40, 40] });
    } catch (err) {
      console.warn("No bounds to fit:", err);
    }
  } else {
    console.warn("No Shotengai data found in Supabase.");
    L.marker([35.0116, 135.7681])
      .addTo(map)
      .bindPopup("No Shotengai data found in database.")
      .openPopup();
  }
})();
