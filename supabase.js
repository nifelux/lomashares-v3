import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cfg = window.LOMA_CONFIG;
if (!cfg?.SUPABASE_URL || !cfg?.SUPABASE_ANON) {
  console.error("Missing SUPABASE config in config.js");
}

window.lomaSupabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
