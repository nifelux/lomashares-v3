// supabase-client.js
(function () {
  const cfg = window.LOMA_CONFIG;
  if (!cfg?.SUPABASE_URL || !cfg?.SUPABASE_ANON_KEY) {
    console.error("LOMA: Missing config.js values");
    return;
  }
  window.lomaSupabase = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
})();
