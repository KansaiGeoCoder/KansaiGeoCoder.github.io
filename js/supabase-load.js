// /website/js/supabase-load.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Your credentials (same as supabase.js)
const SUPABASE_URL = "https://qdykenvvtqnzdgtzcmhe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkeWtlbnZ2dHFuemRndHpjbWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MDg0MDEsImV4cCI6MjA3NzM4NDQwMX0.zN6Mpfnxr5_ufc6dMDO89LZBXSFYa4ex4vbiu1Q813U";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Fetches all Shotengai records as a GeoJSON FeatureCollection
 */
export async function loadShotengaiAsFeatureCollection() {
  const { data, error } = await sb.from("v_shotengai_geojson").select("*");

  if (error) {
    console.error("Supabase error:", error);
    return { type: "FeatureCollection", features: [] };
  }

  const features = data.map(r => ({
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
      typology: r.typology,
      length_m: r.length_m,
      url: r.url,
      notes: r.notes,
      last_update: r.last_update
    },
    geometry: r.geomjson
  }));

  return { type: "FeatureCollection", features };
}
