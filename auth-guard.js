(async function () {
  const sb = window.lomaSupabase;
  if (!sb) return;

  const page = location.pathname.split("/").pop() || "index.html";
  const publicPages = ["index.html", "register.html"];

  const { data: { session } } = await sb.auth.getSession();

  if (!session && !publicPages.includes(page)) {
    location.replace("index.html");
    return;
  }

  if (session && publicPages.includes(page)) {
    location.replace("dashboard.html");
  }
})();
