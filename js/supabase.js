import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://qdykenvvtqnzdgtzcmhe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkeWtlbnZ2dHFuemRndHpjbWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MDg0MDEsImV4cCI6MjA3NzM4NDQwMX0.zN6Mpfnxr5_ufc6dMDO89LZBXSFYa4ex4vbiu1Q813U";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
