export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return res.status(500).json({ error: "Missing env vars" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const action = String(body.action || "").toLowerCase();

    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing auth token" });

    const uRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
    });
    const user = await uRes.json();
    if (!uRes.ok || !user?.id) return res.status(401).json({ error: "Invalid session" });

    const svcHeaders = {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (action === "list") {
      const status = String(body.status || "active");
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/investments?user_id=eq.${user.id}&status=eq.${encodeURIComponent(status)}&select=product_id,amount,daily_income,days,paid_days,status,start_date,created_at&order=created_at.desc`,
        { headers: svcHeaders }
      );
      const rows = await r.json();
      return res.status(200).json({ ok: true, investments: rows || [] });
    }

    if (action === "create") {
      const plan = Number(body.plan_id);
      if (!plan || plan < 1 || plan > 10) return res.status(400).json({ error: "Invalid plan_id" });

      const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_investment`, {
        method: "POST",
        headers: svcHeaders,
        body: JSON.stringify({ p_user: user.id, p_product: plan }),
      });
      const rpcData = await rpc.json().catch(() => null);
      if (!rpc.ok) return res.status(500).json({ error: "Investment RPC failed", details: rpcData });

      if (!rpcData?.[0]?.ok) return res.status(400).json({ error: rpcData?.[0]?.error || "Investment failed" });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Invalid action" });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
                }
