// js/supabase.js

// Load Supabase from CDN
const supabaseUrl = window.ENV_SUPABASE_URL;
const supabaseAnonKey = window.ENV_SUPABASE_ANON_KEY;

const supabase = window.supabase.createClient(
  supabaseUrl,
  supabaseAnonKey
);

window.sb = supabase; // make globally accessible
