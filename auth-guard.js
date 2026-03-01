(function () {
  "use strict";

  const SB_URL = document.body.getAttribute("data-supabase-url");
  const SB_ANON = document.body.getAttribute("data-supabase-anon");
  const PAGE = document.body.getAttribute("data-page") || "";

  const PUBLIC = new Set(["login", "register", "about"]);

  if (!SB_URL || !SB_ANON) {
    console.error("Missing Supabase keys on body dataset");
    return;
  }

  if (!window.supabase || !window.supabase.createClient) {
    console.error("Supabase UMD not loaded");
    return;
  }

  const supabase = window.supabase.createClient(SB_URL, SB_ANON);

  async function run() {
    const { data, error } = await supabase.auth.getSession();
    if (error) console.error(error);

    const session = data?.session || null;

    // If logged in, block login/register pages
    if (session && (PAGE === "login" || PAGE === "register")) {
      window.location.replace("dashboard.html");
      return;
    }

    // If NOT logged in, block private pages
    if (!session && !PUBLIC.has(PAGE)) {
      window.location.replace("index.html");
      return;
    }
  }

  document.addEventListener("DOMContentLoaded", run);
})();
