// auth-guard.js
(async function () {
  const cfg = window.LOMA_CONFIG;
  const sb = window.lomaSupabase;
  if (!cfg || !sb) return;

  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  const publicPages = ["index.html", "register.html"];
  const isPublic = publicPages.includes(page) || page === "";

  const { data: { session } } = await sb.auth.getSession();

  if (session && isPublic) return location.replace(cfg.ROUTES.dashboard);
  if (!session && !isPublic) return location.replace(cfg.ROUTES.login);
})();
