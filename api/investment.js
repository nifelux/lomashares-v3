
export default async function handler(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SB_SERVICE) {
      return res.status(500).json({
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      });
    }

    const SB_HEADERS = {
      apikey: SB_SERVICE,
      Authorization: `Bearer ${SB_SERVICE}`,
      "Content-Type": "application/json",
    };

    const send = (code, data) => res.status(code).json(data);

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

    const sbPatch = async (path, body) => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: "PATCH",
        headers: SB_HEADERS,
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => null);
      return { ok: r.ok, data: d };
    };

    async function findUserIdByEmail(email) {
      const q = `profiles?select=id,email&email=eq.${encodeURIComponent(email)}&limit=1`;
      const r = await sbGet(q);
      return Array.isArray(r.data) && r.data[0]?.id ? r.data[0].id : null;
    }

    async function getWallet(user_id) {
      const q = `wallets?select=user_id,balance&user_id=eq.${user_id}&limit=1`;
      const r = await sbGet(q);
      return Array.isArray(r.data) && r.data[0] ? r.data[0] : null;
    }

    async function setWallet(user_id, balance) {
      return sbPatch(`wallets?user_id=eq.${user_id}`, {
        balance,
        updated_at: new Date().toISOString()
      });
    }

    // =====================================================
    // ✅ HARD-CODED PRODUCTS (exact from your image)
    // =====================================================
    const PRODUCTS = [
      { id: 1, price: 3000, daily: 200, total: 6000 },
      { id: 2, price: 5000, daily: 333, total: 10000 },
      { id: 3, price: 10000, daily: 667, total: 20000 },
      { id: 4, price: 30000, daily: 2000, total: 60000 },
      { id: 5, price: 100000, daily: 8333, total: 200000 },
      { id: 6, price: 200000, daily: 16333, total: 400000 },
      { id: 7, price: 300000, daily: 20000, total: 600000 },
      { id: 8, price: 400000, daily: 26667, total: 1000000 },
      { id: 9, price: 500000, daily: 33333, total: 1750000 },
      { id: 10, price: 1000000, daily: 66667, total: 2000000 }
    ];

    const DAYS = 30;

    if (req.method !== "POST") return send(405, { error: "Method not allowed" });

    const body = req.body || {};
    const action = String(body.action || "").toLowerCase();

    // =====================================================
    // 1) LIST PRODUCTS
    // =====================================================
    if (action === "list_products") {
      return send(200, { ok: true, products: PRODUCTS });
    }

    // =====================================================
    // 2) BUY PRODUCT
    // =====================================================
    if (action === "buy") {
      const email = String(body.email || "").toLowerCase();
      const productId = Number(body.product_id);

      const product = PRODUCTS.find(p => p.id === productId);
      if (!product) return send(400, { error: "Invalid product" });

      const user_id = await findUserIdByEmail(email);
      if (!user_id) return send(404, { error: "User not found" });

      // Limit to 2 purchases lifetime
      const invCountQ = await sbGet(
        `investments?select=id&user_id=eq.${user_id}&product_id=eq.${productId}`
      );
      const boughtTimes = Array.isArray(invCountQ.data) ? invCountQ.data.length : 0;
      if (boughtTimes >= 2) {
        return send(400, { error: "You can only buy this product twice lifetime" });
      }

      const wallet = await getWallet(user_id);
      if (!wallet) return send(404, { error: "Wallet not found" });

      if (Number(wallet.balance) < product.price) {
        return send(400, { error: "Insufficient balance" });
      }

      const newBal = Number(wallet.balance) - product.price;
      await setWallet(user_id, newBal);

      await sbPost("investments", {
        user_id,
        product_id: productId,
        principal: product.price,
        daily_income: product.daily,
        total_days: DAYS,
        payouts_done: 0,
        start_at: new Date().toISOString(),
        last_paid_at: null,
        status: "active",
        created_at: new Date().toISOString()
      });

      await sbPost("transactions", {
        user_id,
        type: "investment",
        amount: product.price,
        status: "success",
        meta: product,
        created_at: new Date().toISOString()
      });

      return send(200, {
        ok: true,
        message: "Investment successful",
        balance: newBal
      });
    }

    // =====================================================
    // 3) CLAIM DAILY INCOME (after 24 hours)
    // =====================================================
    if (action === "claim_due_income") {
      const email = String(body.email || "").toLowerCase();
      const user_id = await findUserIdByEmail(email);
      if (!user_id) return send(404, { error: "User not found" });

      const invQ = await sbGet(
        `investments?select=id,product_id,daily_income,total_days,payouts_done,start_at,last_paid_at,status`
        + `&user_id=eq.${user_id}&status=eq.active`
      );

      const invs = Array.isArray(invQ.data) ? invQ.data : [];
      if (invs.length === 0) return send(200, { ok: true, credited: 0 });

      let totalCredit = 0;
      const now = Date.now();

      for (const inv of invs) {
        const lastPaid = inv.last_paid_at
          ? new Date(inv.last_paid_at).getTime()
          : new Date(inv.start_at).getTime();

        const hours = (now - lastPaid) / (1000 * 60 * 60);

        if (hours >= 24 && inv.payouts_done < inv.total_days) {
          totalCredit += Number(inv.daily_income);

          await sbPatch(`investments?id=eq.${inv.id}`, {
            payouts_done: inv.payouts_done + 1,
            last_paid_at: new Date().toISOString(),
            status: inv.payouts_done + 1 >= inv.total_days ? "completed" : "active"
          });

          await sbPost("transactions", {
            user_id,
            type: "income",
            amount: inv.daily_income,
            status: "success",
            meta: { investment_id: inv.id },
            created_at: new Date().toISOString()
          });
        }
      }

      if (totalCredit > 0) {
        const wallet = await getWallet(user_id);
        const newBal = Number(wallet.balance) + totalCredit;
        await setWallet(user_id, newBal);

        return send(200, {
          ok: true,
          credited: totalCredit,
          balance: newBal
        });
      }

      return send(200, { ok: true, credited: 0 });
    }

    return send(400, { error: "Invalid action" });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
