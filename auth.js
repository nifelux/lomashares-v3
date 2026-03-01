(function () {
  "use strict";

  const SB_URL = document.body.getAttribute("data-supabase-url");
  const SB_ANON = document.body.getAttribute("data-supabase-anon");

  if (!SB_URL || !SB_ANON) return;

  const supabase = window.supabase.createClient(SB_URL, SB_ANON);

  function $(id) { return document.getElementById(id); }

  async function login() {
    const email = ($("email")?.value || "").trim().toLowerCase();
    const password = $("password")?.value || "";

    if (!email || !password) return alert("Enter email and password.");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return alert(error.message);

    // Confirm session exists before redirect
    const { data: s } = await supabase.auth.getSession();
    if (!s?.session) return alert("Login session not saved. Check Supabase settings.");

    window.location.replace("dashboard.html");
  }

  async function register() {
    const email = ($("email")?.value || "").trim().toLowerCase();
    const password = $("password")?.value || "";
    const confirm = $("confirm")?.value || "";

    if (!email || !password || !confirm) return alert("All fields required.");
    if (password.length < 6) return alert("Password must be at least 6 characters.");
    if (password !== confirm) return alert("Passwords do not match.");

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return alert(error.message);

    alert("Account created. Now login.");
    window.location.replace("index.html");
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.replace("index.html");
  }

  // Expose for buttons
  window.lomaLogin = login;
  window.lomaRegister = register;
  window.lomaLogout = logout;
})();
