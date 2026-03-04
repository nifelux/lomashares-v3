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

    async function isAdmin(uid) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}&select=is_admin&limit=1`, { headers: svcHeaders });
      const rows = await r.json();
      return !!rows?.[0]?.is_admin;
    }

    // admin generate code
    if (action === "generate") {
      if (!(await isAdmin(user.id))) return res.status(403).json({ error: "Admin only" });
      const amount = Number(body.amount);
      if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });

      const code = "GIFT" + Math.floor(100000 + Math.random() * 900000);

      const r = await fetch(`${SUPABASE_URL}/rest/v1/gift_codes`, {
        method: "POST",
        headers: svcHeaders,
        body: JSON.stringify({ code, amount, redeemed: false, created_by: user.id }),
      });
      if (!r.ok) return res.status(500).json({ error: "Gift create failed" });
      return res.status(200).json({ ok: true, code, amount });
    }

    // user redeem
    if (action === "redeem") {
      const code = String(body.code || "").trim().toUpperCase();
      if (!code) return res.status(400).json({ error: "Code required" });

      // fetch gift
      const g = await fetch(`${SUPABASE_URL}/rest/v1/gift_codes?code=eq.${encodeURIComponent(code)}&select=code,amount,redeemed`, { headers: svcHeaders });
      const rows = await g.json();
      if (!rows?.length) return res.status(400).json({ error: "Invalid code" });
      if (rows[0].redeemed) return res.status(400).json({ error: "Code already used" });

      // mark redeemed
      await fetch(`${SUPABASE_URL}/rest/v1/gift_codes?code=eq.${encodeURIComponent(code)}`, {
        method: "PATCH",
        headers: svcHeaders,
        body: JSON.stringify({ redeemed: true, redeemed_by: user.id, redeemed_at: new Date().toISOString() }),
      });

      // credit wallet + transaction
      const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/credit_wallet`, {
        method: "POST",
        headers: svcHeaders,
        body: JSON.stringify({ p_user: user.id, p_amount: Number(rows[0].amount), p_kind: "gift", p_ref: code }),
      });
      const rpcData = await rpc.json().catch(() => null);
      if (!rpc.ok) return res.status(500).json({ error: "Wallet credit failed", details: rpcData });

      return res.status(200).json({ ok: true, amount: Number(rows[0].amount), balance: rpcData?.[0]?.balance ?? null });
    }

    return res.status(400).json({ error: "Invalid action" });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
    }
