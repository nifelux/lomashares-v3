// supabase.js
// LomaShares v3 – Supabase Bootstrap

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ====== SET YOUR VALUES HERE ======
const SUPABASE_URL = "https://lpnnqxalmihxgszoifpa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxwbm5xeGFsbWloeGdzem9pZnBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MzM1ODEsImV4cCI6MjA4NzMwOTU4MX0.1hLW5gizjcPTKyfzx_XD9dxqegtXVQroNCclX1AaqZw";
// ===================================

// Create client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Make globally accessible
window.lomaSupabase = supabase;

/* =========================================
   AUTH GUARD (SAFE – NO REDIRECT LOOP)
========================================= */

async function protectPages() {
  const { data: { session } } = await supabase.auth.getSession();
  const path = window.location.pathname.split("/").pop();

  const publicPages = ["index.html", "register.html"];
  const isPublic = publicPages.includes(path) || path === "";

  if (!session && !isPublic) {
    // Not logged in → redirect to index
    window.location.replace("index.html");
  }

  if (session && isPublic) {
    // Logged in → redirect to dashboard
    window.location.replace("dashboard.html");
  }
}

protectPages();

/* =========================================
   OPTIONAL: SESSION CHANGE LISTENER
========================================= */

supabase.auth.onAuthStateChange((_event, session) => {
  if (!session) {
    const path = window.location.pathname.split("/").pop();
    if (path !== "index.html" && path !== "register.html") {
      window.location.replace("index.html");
    }
  }
});
