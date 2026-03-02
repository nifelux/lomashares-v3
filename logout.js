// logout.js
(async function () {
  const sb = window.lomaSupabase;
  if (!sb) return;

  const btn = document.getElementById("logoutBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    await sb.auth.signOut();
    location.replace((window.LOMA_CONFIG?.ROUTES?.login) || "index.html");
  });
})();
