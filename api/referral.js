export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: "Missing env vars" });

  const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  const code = String(body.code || "").trim().toUpperCase();
  if (!code) return res.status(200).json({ ok: true, valid: true });

  if (!/^LOMA\d{6}$/.test(code)) return res.status(200).json({ ok: true, valid: false });

  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Accept: "application/json" };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?referral_code=eq.${encodeURIComponent(code)}&select=id&limit=1`, { headers });
  const rows = await r.json();
  if (!rows?.length) return res.status(200).json({ ok: true, valid: false });
  return res.status(200).json({ ok: true, valid: true, referrer_id: rows[0].id });
}
