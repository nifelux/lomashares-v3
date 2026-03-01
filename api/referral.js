export default async function handler(req, res) {
  // ---- CORS (safe for frontend calls) ----
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({
        error: "Missing env",
        needs: ["SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)", "SUPABASE_SERVICE_ROLE_KEY"],
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const action = String(body.action || "").toLowerCase();
    const code = String(body.code || "").trim().toUpperCase();

    if (action !== "validate") {
      return res.status(400).json({ error: "Invalid action. Use action=validate" });
    }

    // Allow empty referral (optional field)
    if (!code) return res.status(200).json({ valid: true });

    // Basic format check: LOMA + 6 digits
    if (!/^LOMA\d{6}$/.test(code)) {
      return res.status(200).json({ valid: false, error: "Invalid referral format" });
    }

    // Prefer "profiles" table (recommended). If not found, fallback to "users".
    // It checks if referral_code exists.
    const found =
      (await findReferralInTable(SUPABASE_URL, SERVICE_KEY, "profiles", code)) ||
      (await findReferralInTable(SUPABASE_URL, SERVICE_KEY, "users", code));

    if (!found) return res.status(200).json({ valid: false });

    return res.status(200).json({ valid: true, referrer_id: found.id });
  } catch (err) {
    return res.status(500).json({
      error: "Referral validation failed",
      message: err?.message || String(err),
    });
  }
}

async function findReferralInTable(SUPABASE_URL, SERVICE_KEY, table, code) {
  // Supabase REST endpoint
  // Example: /rest/v1/profiles?referral_code=eq.LOMA123456&select=id&limit=1
  const url =
    `${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}` +
    `?referral_code=eq.${encodeURIComponent(code)}` +
    `&select=id` +
    `&limit=1`;

  const r = await fetch(url, {
    method: "GET",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Accept: "application/json",
    },
  });

  if (!r.ok) {
    // If table doesn't exist, PostgREST usually returns 404 / error JSON
    // We treat as "not found" and allow fallback.
    return null;
  }

  const rows = await r.json();
  if (Array.isArray(rows) && rows.length > 0 && rows[0]?.id) return rows[0];
  return null;
       }
