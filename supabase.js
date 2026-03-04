(function () {
  "use strict";

  async function init() {
    // Load config from backend
    const r = await fetch("/api/public-config");
    const cfg = await r.json();

    if (!cfg?.supabaseUrl || !cfg?.supabaseAnon) {
      console.error("Missing public config:", cfg);
      return;
    }

    // Load Supabase SDK (CDN)
    if (!window.supabase) {
      console.error("Supabase CDN not loaded");
      return;
    }

    window.lomaSupabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnon);
    window.dispatchEvent(new Event("loma:supabase-ready"));
  }

  init();
})();
