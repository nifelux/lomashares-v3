(function () {
  "use strict";

  // -----------------------------
  // Shared UI + Supabase setup
  // -----------------------------
  const page = document.body?.dataset?.page || "";
  const SB_URL = document.body?.dataset?.supabaseUrl;
  const SB_ANON = document.body?.dataset?.supabaseAnon;

  if (!SB_URL || !SB_ANON) {
    console.error("Missing Supabase keys in data attributes.");
    return;
  }

  // Supabase v2 global from CDN
  const supabase = window.supabase.createClient(SB_URL, SB_ANON);

  // Slide menu
  const sheet = document.getElementById("sheet");
  const backdrop = document.getElementById("backdrop");
  const menuBtn = document.getElementById("menuBtn");
  const closeSheet = document.getElementById("closeSheet");

  function openSheet() {
    if (!sheet || !backdrop) return;
    sheet.classList.add("open");
    backdrop.hidden = false;
    sheet.setAttribute("aria-hidden", "false");
  }
  function closeSheetFn() {
    if (!sheet || !backdrop) return;
    sheet.classList.remove("open");
    backdrop.hidden = true;
    sheet.setAttribute("aria-hidden", "true");
  }
  if (menuBtn) menuBtn.addEventListener("click", openSheet);
  if (closeSheet) closeSheet.addEventListener("click", closeSheetFn);
  if (backdrop) backdrop.addEventListener("click", closeSheetFn);

  // Message helpers
  function showMsg(text, type = "info") {
    const msg = document.getElementById("msg");
    if (!msg) return;
    msg.hidden = false;
    msg.textContent = text;
    msg.dataset.type = type; // used in CSS
  }
  function hideMsg() {
    const msg = document.getElementById("msg");
    if (!msg) return;
    msg.hidden = true;
    msg.textContent = "";
    msg.dataset.type = "";
  }

  function normalizeEmail(v) {
    return String(v || "").trim().toLowerCase();
  }

  // -----------------------------
  // Redirect guard (prevents loop)
  // -----------------------------
  async function getSession() {
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
  }

  async function guard() {
    const session = await getSession();

    // If already logged in, don’t stay on login/register
    if (session && (page === "login" || page === "register")) {
      window.location.replace("dashboard.html");
      return;
    }

    // If NOT logged in, don’t enter protected pages
    const protectedPages = ["dashboard", "deposit", "withdraw", "profile", "investment", "team", "refer", "gift", "transactions"];
    if (!session) {
      const isProtected = protectedPages.includes(page);
      if (isProtected) {
        window.location.replace("index.html");
        return;
      }
    }
  }

  // Run guard on load (safe, avoids infinite loop)
  document.addEventListener("DOMContentLoaded", guard);

  // Save email in local storage for UI usage
  async function cacheEmailFromSession() {
    const s = await getSession();
    if (s?.user?.email) localStorage.setItem("lomashares_email", s.user.email.toLowerCase());
  }

  // -----------------------------
  // Referral validation (backend)
  // -----------------------------
  async function validateReferral(code) {
    const c = String(code || "").trim().toUpperCase();
    if (!c) return { valid: true };

    // expects: POST /api/referral {action:"validate", code}
    const r = await fetch("/api/referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "validate", code: c }),
    });
    const data = await r.json().catch(() => ({}));

    if (!r.ok) return { valid: false, error: data?.error || "Referral check failed" };
    return data; // {valid:true} or {valid:false,...}
  }

  // -----------------------------
  // Login
  // -----------------------------
  async function doLogin() {
    hideMsg();

    const email = normalizeEmail(document.getElementById("email")?.value);
    const password = String(document.getElementById("password")?.value || "");

    if (!email || !password) return showMsg("Please enter your email and password.", "warn");

    const btn = document.getElementById("loginBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Logging in..."; }

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      await cacheEmailFromSession();
      window.location.replace("dashboard.html");
    } catch (e) {
      showMsg(e?.message || "Login failed. Try again.", "error");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Login"; }
    }
  }

  // -----------------------------
  // Register
  // -----------------------------
  async function doRegister() {
    hideMsg();

    const email = normalizeEmail(document.getElementById("email")?.value);
    const password = String(document.getElementById("password")?.value || "");
    const confirm = String(document.getElementById("confirm")?.value || "");
    const referral = String(document.getElementById("referral")?.value || "").trim().toUpperCase();

    if (!email || !password || !confirm) return showMsg("All fields are required.", "warn");
    if (password.length < 6) return showMsg("Password must be at least 6 characters.", "warn");
    if (password !== confirm) return showMsg("Passwords do not match.", "warn");

    const btn = document.getElementById("registerBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Creating..."; }

    try {
      // Validate referral first (if any)
      const v = await validateReferral(referral);
      if (!v.valid) throw new Error(v.error || "Invalid referral code");

      // Create Supabase auth user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // store referral_code into user metadata so your trigger/function can read it if needed
          data: { referral_used: referral || null }
        }
      });
      if (error) throw error;

      // NOTE:
      // If email confirmation is ON, user may need to confirm email.
      // You can turn OFF confirmation in Supabase Auth settings for easier flow.
      showMsg("Account created ✅ Please login now.", "ok");
      setTimeout(() => window.location.replace("index.html"), 900);
    } catch (e) {
      showMsg(e?.message || "Registration failed.", "error");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Create Account"; }
    }
  }

  // -----------------------------
  // Forgot password (optional)
  // -----------------------------
  async function forgotPassword() {
    hideMsg();
    const email = normalizeEmail(document.getElementById("email")?.value);
    if (!email) return showMsg("Enter your email first.", "warn");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/index.html"
      });
      if (error) throw error;
      showMsg("Password reset link sent to your email.", "ok");
    } catch (e) {
      showMsg(e?.message || "Could not send reset link.", "error");
    }
  }

  // -----------------------------
  // Bind buttons
  // -----------------------------
  document.addEventListener("DOMContentLoaded", () => {
    if (page === "login") {
      document.getElementById("loginBtn")?.addEventListener("click", doLogin);
      document.getElementById("forgotBtn")?.addEventListener("click", forgotPassword);
    }

    if (page === "register") {
      document.getElementById("registerBtn")?.addEventListener("click", doRegister);

      // Live referral hint
      const ref = document.getElementById("referral");
      const refStatus = document.getElementById("refStatus");
      let t = null;

      if (ref && refStatus) {
        ref.addEventListener("input", () => {
          clearTimeout(t);
          const code = ref.value.trim().toUpperCase();
          if (!code) {
            refStatus.textContent = "If you have a sponsor, enter their code.";
            refStatus.style.color = "rgba(234,242,255,.65)";
            return;
          }
          refStatus.textContent = "Checking referral code...";
          refStatus.style.color = "rgba(234,242,255,.65)";

          t = setTimeout(async () => {
            const v = await validateReferral(code);
            if (v.valid) {
              refStatus.textContent = "Referral code is valid ✅";
              refStatus.style.color = "#16e0a3";
            } else {
              refStatus.textContent = "Invalid referral code ❌";
              refStatus.style.color = "#ffd166";
            }
          }, 600);
        });
      }
    }
  });
})();
