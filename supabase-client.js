// supabase-client.js
(function () {
  "use strict";

  const cfg = window.APP_CONFIG || {};
  const url = cfg.SUPABASE_URL;
  const anon = cfg.SUPABASE_ANON_KEY;

  if (!url || !anon) {
    console.warn("Missing SUPABASE_URL or SUPABASE_ANON_KEY in config.js");
    return;
  }

  window.sb = window.supabase.createClient(url, anon);
})();
