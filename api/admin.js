export default async function handler(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SB_SERVICE) {
      return res.status(500).json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
    }

    const SB_HEADERS = {
      apikey: SB_SERVICE,
      Authorization: `Bearer ${SB_SERVICE}`,
      "Content-Type": "application/json",
    };

    const send = (c, d) => res.status(c).json(d);

    const sbGet = async (path) => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: SB_HEADERS });
      const d = await r.json().catch(() => null);
      return { ok: r.ok, data: d };
    };

    const sbPost = async (path, body) => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: "POST",
        headers: SB_HEADERS,
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => null);
      return { ok: r.ok, data: d };
    };

    if (req.method !== "POST") return send(405, { error: "Method not allowed" });

    const body = req.body || {};
    const action = String(body.action || "").toLowerCase();

    // Total deposits and withdrawals from transactions table
    if (action === "summary") {
      const txQ = await sbGet("transactions?select=type,amount,status");
      const txs = Array.isArray(txQ.data) ? txQ.data : [];

      const sum = (type) =>
        txs
          .filter(t => String(t.type).toLowerCase() === type && String(t.status).toLowerCase() === "success")
          .reduce((a, b) => a + Number(b.amount || 0), 0);

      return send(200, {
        ok: true,
        total_deposits: sum("deposit"),
        total_withdrawals: sum("withdrawal"),
        total_investments: sum("investment"),
        total_income_paid: sum("income"),
      });
    }

    // Gift code generator (simple)
    if (action === "generate_gift") {
      const amount = Number(body.amount);
      if (!amount || amount <= 0) return send(400, { error: "amount is required" });

      const code = "GIFT" + Math.floor(100000 + Math.random() * 900000);

      const ins = await sbPost("gift_codes", {
        code,
        amount,
        redeemed: false,
        created_at: new Date().toISOString()
      });

      if (!ins.ok) return send(500, { error: "Failed to create gift code", details: ins.data });

      return send(200, { ok: true, code, amount });
    }

    return send(400, { error: "Invalid action" });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
