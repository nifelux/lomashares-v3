export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) return res.status(500).json({ error: "Missing env vars" });

  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing auth token" });

    const uRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
    });
    const user = await uRes.json();
    if (!uRes.ok || !user?.id) return res.status(401).json({ error: "Invalid session" });

    const svcHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Accept: "application/json" };

    const p = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=is_admin&limit=1`, { headers: svcHeaders });
    const prow = await p.json();
    if (!prow?.[0]?.is_admin) return res.status(403).json({ error: "Admin only" });

    const dep = await fetch(`${SUPABASE_URL}/rest/v1/deposits?select=amount`, { headers: svcHeaders });
    const deps = await dep.json();
    const totalDeposits = (deps || []).reduce((s, r) => s + Number(r.amount || 0), 0);

    const wd = await fetch(`${SUPABASE_URL}/rest/v1/withdrawals?select=amount,status`, { headers: svcHeaders });
    const wds = await wd.json();
    const totalWithdrawals = (wds || []).reduce((s, r) => s + Number(r.amount || 0), 0);

    return res.status(200).json({ ok: true, totalDeposits, totalWithdrawals });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
