export default async function handler(req, res) {
  // ---- CORS ----
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // ---- ENV (tolerant) ----
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ANON_KEY =
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // sometimes you saved it like this

    if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
      return res.status(500).json({
        error: "Missing env vars",
        needs: ["SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)"],
        hasUrl: !!SUPABASE_URL,
        hasServiceRole: !!SERVICE_KEY,
        hasAnon: !!ANON_KEY,
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const action = String(body.action || "").toLowerCase();

    // ---- Verify user session token ----
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing auth token" });

    const uRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
    });
    const user = await uRes.json();
    if (!uRes.ok || !user?.id) return res.status(401).json({ error: "Invalid session" });

    const user_id = user.id;

    // ---- Service headers for DB (server-side) ----
    const sHeaders = {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // =========================================================
    // PRODUCTS (from your image)
    // total in 30 days = 200% (price * 2)
    // =========================================================
    const PRODUCTS = [
      { plan_id: 1, price: 3000 },
      { plan_id: 2, price: 5000 },
      { plan_id: 3, price: 10000 },
      { plan_id: 4, price: 30000 },
      { plan_id: 5, price: 100000 },
      { plan_id: 6, price: 200000 },
      { plan_id: 7, price: 300000 },
      { plan_id: 8, price: 400000 },
      { plan_id: 9, price: 500000 },
      { plan_id: 10, price: 1000000 },
    ];

    // =========================================================
    // ACTION: LIST (for investment page)
    // =========================================================
    if (action === "list") {
      const statusFilter = String(body.status || "active").toLowerCase(); // active | completed | all

      let url =
        `${SUPABASE_URL}/rest/v1/investments?user_id=eq.${encodeURIComponent(user_id)}` +
        `&select=id,plan_id,amount,status,start_date,maturity_date,daily_income,days_paid,last_paid_at,total_days,created_at` +
        `&order=created_at.desc`;

      if (statusFilter !== "all") {
        url += `&status=eq.${encodeURIComponent(statusFilter)}`;
      }

      const r = await fetch(url, { headers: sHeaders });
      const data = await r.json().catch(() => []);
      if (!r.ok) return res.status(500).json({ error: "Failed to load investments", details: data });

      return res.status(200).json({ ok: true, investments: Array.isArray(data) ? data : [] });
    }

    // =========================================================
    // ACTION: CREATE (buy investment)
    // =========================================================
    if (action === "create") {
      const plan_id = Number(body.plan_id);
      if (!plan_id || plan_id < 1 || plan_id > 10) {
        return res.status(400).json({ error: "Invalid plan_id (1-10)" });
      }

      const product = PRODUCTS.find(p => p.plan_id === plan_id);
      if (!product) return res.status(400).json({ error: "Plan not found" });

      // --- Enforce: each plan can be bought twice lifetime ---
      const countUrl =
        `${SUPABASE_URL}/rest/v1/investments?user_id=eq.${encodeURIComponent(user_id)}` +
        `&plan_id=eq.${encodeURIComponent(String(plan_id))}` +
        `&select=id&limit=3`;

      const cRes = await fetch(countUrl, { headers: sHeaders });
      const cData = await cRes.json().catch(() => []);
      if (!cRes.ok) return res.status(500).json({ error: "Failed to check plan limit", details: cData });

      if (Array.isArray(cData) && cData.length >= 2) {
        return res.status(400).json({ error: "You can only invest in this product twice lifetime" });
      }

      // --- Get wallet ---
      const wRes = await fetch(
        `${SUPABASE_URL}/rest/v1/wallets?user_id=eq.${encodeURIComponent(user_id)}&select=id,balance&limit=1`,
        { headers: sHeaders }
      );
      const wData = await wRes.json().catch(() => []);
      if (!wRes.ok) return res.status(500).json({ error: "Failed to fetch wallet", details: wData });

      // If wallet missing, create it (safety)
      let wallet = Array.isArray(wData) && wData[0] ? wData[0] : null;
      if (!wallet) {
        const createWallet = await fetch(`${SUPABASE_URL}/rest/v1/wallets`, {
          method: "POST",
          headers: { ...sHeaders, Prefer: "return=representation" },
          body: JSON.stringify({ user_id, balance: 0 }),
        });
        const cw = await createWallet.json().catch(() => []);
        if (!createWallet.ok || !cw?.[0]) {
          return res.status(500).json({ error: "Wallet not found and could not be created", details: cw });
        }
        wallet = cw[0];
      }

      const currentBalance = Number(wallet.balance || 0);
      if (currentBalance < product.price) return res.status(400).json({ error: "Insufficient balance" });

      // --- Debit wallet ---
      const newBalance = currentBalance - product.price;
      const patchWallet = await fetch(`${SUPABASE_URL}/rest/v1/wallets?id=eq.${encodeURIComponent(wallet.id)}`, {
        method: "PATCH",
        headers: sHeaders,
        body: JSON.stringify({ balance: newBalance }),
      });
      if (!patchWallet.ok) {
        const pw = await patchWallet.json().catch(() => null);
        return res.status(500).json({ error: "Failed to debit wallet", details: pw });
      }

      // --- Create investment record ---
      const total_days = 30;
      const total_return = product.price * 2;
      const daily_income = total_return / total_days;

      const start = new Date();
      const maturity = new Date(start.getTime() + total_days * 24 * 60 * 60 * 1000);

      const invRes = await fetch(`${SUPABASE_URL}/rest/v1/investments`, {
        method: "POST",
        headers: { ...sHeaders, Prefer: "return=representation" },
        body: JSON.stringify({
          user_id,
          plan_id,
          amount: product.price,
          status: "active",
          start_date: start.toISOString(),
          maturity_date: maturity.toISOString(),
          daily_income,
          days_paid: 0,
          last_paid_at: null,
          total_days,
        }),
      });

      const invData = await invRes.json().catch(() => null);
      if (!invRes.ok || !invData?.[0]) {
        // rollback wallet debit (best effort)
        await fetch(`${SUPABASE_URL}/rest/v1/wallets?id=eq.${encodeURIComponent(wallet.id)}`, {
          method: "PATCH",
          headers: sHeaders,
          body: JSON.stringify({ balance: currentBalance }),
        });

        return res.status(500).json({ error: "Failed to create investment", details: invData });
      }

      // --- Add transaction record (optional but recommended) ---
      await fetch(`${SUPABASE_URL}/rest/v1/transactions`, {
        method: "POST",
        headers: sHeaders,
        body: JSON.stringify({
          user_id,
          type: "Investment",
          amount: product.price,
          status: "success",
        }),
      }).catch(() => {});

      return res.status(200).json({
        ok: true,
        message: "Investment successful",
        wallet_balance: newBalance,
        investment: invData[0],
      });
    }

    return res.status(400).json({ error: "Invalid action. Use action=create or action=list" });
  } catch (e) {
    return res.status(500).json({ error: "Investment API crashed", message: e?.message || String(e) });
  }
}
