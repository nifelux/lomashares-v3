// supabase-client.js
(function () {
  const cfg = window.LOMA_CONFIG;
  if (!cfg?.SUPABASE_URL || !cfg?.SUPABASE_ANON_KEY) {
    console.error("Missing SUPABASE config in config.js");
    return;
  }

  // Supabase UMD exposes `supabase`
  window.lomaSupabase = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
})();
