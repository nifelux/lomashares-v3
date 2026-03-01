export default async function handler(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
    const SITE_URL = process.env.SITE_URL;

    if (!SUPABASE_URL || !SB_SERVICE) {
      return res.status(500).json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
    }

    const SB_HEADERS = {
      apikey: SB_SERVICE,
      Authorization: `Bearer ${SB_SERVICE}`,
      "Content-Type": "application/json",
    };

    const send = (code, data) => res.status(code).json(data);

    // ---------- Helpers ----------
    const sbGet = async (path) => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: SB_HEADERS });
      const d = await r.json().catch(() => null);
      return { ok: r.ok, status: r.status, data: d };
    };

    const sbPost = async (path, body) => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: "POST",
        headers: SB_HEADERS,
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => null);
      return { ok: r.ok, status: r.status, data: d };
    };

    const sbPatch = async (path, body) => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: "PATCH",
        headers: SB_HEADERS,
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => null);
      return { ok: r.ok, status: r.status, data: d };
    };

    async function findUserIdByEmail(email) {
      const q = `profiles?select=id,email&email=eq.${encodeURIComponent(email)}&limit=1`;
      const r = await sbGet(q);
      if (!r.ok) return null;
      return Array.isArray(r.data) && r.data[0]?.id ? r.data[0].id : null;
    }

    async function getWallet(user_id) {
      const q = `wallets?select=user_id,balance&user_id=eq.${user_id}&limit=1`;
      const r = await sbGet(q);
      if (!r.ok) return null;
      return Array.isArray(r.data) && r.data[0] ? r.data[0] : null;
    }

    async function updateWallet(user_id, newBalance) {
      return sbPatch(`wallets?user_id=eq.${user_id}`, { balance: newBalance, updated_at: new Date().toISOString() });
    }

    const makeRef = () => `LSDEP-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    // ---------- ROUTES ----------
    if (req.method !== "POST") return send(405, { error: "Method not allowed" });

    const body = req.body || {};
    const action = String(body.action || "").toLowerCase();

    // 1) BALANCE
    if (action === "balance") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email) return send(400, { error: "email is required" });

      const user_id = await findUserIdByEmail(email);
      if (!user_id) return send(404, { error: "User not found" });

      const wallet = await getWallet(user_id);
      if (!wallet) return send(404, { error: "Wallet not found" });

      return send(200, { ok: true, balance: Number(wallet.balance || 0), user_id });
    }

    // 2) INIT PAYSTACK DEPOSIT (redirect flow)
    if (action === "paystack_init_deposit") {
      if (!PAYSTACK_SECRET) return send(500, { error: "Missing PAYSTACK_SECRET_KEY" });
      if (!SITE_URL) return send(500, { error: "Missing SITE_URL" });

      const email = String(body.email || "").trim().toLowerCase();
      const amount = Number(body.amount);

      if (!email) return send(400, { error: "email is required" });
      if (!amount || amount < 1000) return send(400, { error: "Minimum deposit is ₦1,000" });

      const user_id = await findUserIdByEmail(email);
      if (!user_id) return send(404, { error: "User not found" });

      const reference = makeRef();

      // Create pending transaction first (idempotency + tracking)
      const txIns = await sbPost("transactions", {
        user_id,
        type: "deposit",
        amount,
        status: "pending",
        reference,
        provider: "paystack",
        meta: { stage: "init" },
      });

      if (!txIns.ok) return send(500, { error: "Failed to create transaction", details: txIns.data });

      // Paystack initialize
      const callback_url = `${SITE_URL}/deposit.html?reference=${encodeURIComponent(reference)}`;

      const ps = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: Math.round(amount * 100), // kobo
          reference,
          callback_url,
        }),
      });

      const psData = await ps.json().catch(() => null);
      if (!ps.ok || !psData?.status) {
        await sbPatch(`transactions?reference=eq.${encodeURIComponent(reference)}`, {
          status: "failed",
          meta: { stage: "init_failed", ps: psData },
        });
        return send(500, { error: "Paystack init failed", details: psData });
      }

      // Return Paystack URL to frontend for redirect
      return send(200, { ok: true, reference, authorization_url: psData.data.authorization_url });
    }

    // 3) VERIFY PAYSTACK DEPOSIT (credits wallet once)
    if (action === "paystack_verify_deposit") {
      if (!PAYSTACK_SECRET) return send(500, { error: "Missing PAYSTACK_SECRET_KEY" });

      const reference = String(body.reference || "").trim();
      if (!reference) return send(400, { error: "reference is required" });

      // Find transaction
      const txQ = await sbGet(`transactions?select=id,user_id,amount,status,reference&reference=eq.${encodeURIComponent(reference)}&limit=1`);
      const tx = Array.isArray(txQ.data) ? txQ.data[0] : null;
      if (!tx) return send(404, { error: "Transaction not found" });

      if (String(tx.status).toLowerCase() === "success") {
        const wallet = await getWallet(tx.user_id);
        return send(200, { ok: true, status: "success", balance: Number(wallet?.balance || 0), message: "Already verified" });
      }

      // Verify from Paystack
      const vr = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
      });

      const vrData = await vr.json().catch(() => null);
      if (!vr.ok || !vrData?.status) {
        return send(500, { error: "Paystack verify failed", details: vrData });
      }

      const payStatus = String(vrData.data?.status || "").toLowerCase();
      const paidAmount = Number(vrData.data?.amount || 0) / 100;

      if (payStatus !== "success") {
        await sbPatch(`transactions?reference=eq.${encodeURIComponent(reference)}`, {
          status: "failed",
          meta: { stage: "not_success", ps: vrData.data },
        });
        return send(400, { error: "Payment not successful", paystack_status: payStatus });
      }

      // Amount validation (basic)
      const expected = Number(tx.amount || 0);
      if (paidAmount + 0.0001 < expected) {
        await sbPatch(`transactions?reference=eq.${encodeURIComponent(reference)}`, {
          status: "failed",
          meta: { stage: "amount_mismatch", expected, paidAmount, ps: vrData.data },
        });
        return send(400, { error: "Amount mismatch", expected, paidAmount });
      }

      // Credit wallet
      const wallet = await getWallet(tx.user_id);
      if (!wallet) return send(404, { error: "Wallet not found" });

      const newBal = Number(wallet.balance || 0) + expected;

      const upW = await updateWallet(tx.user_id, newBal);
      if (!upW.ok) return send(500, { error: "Wallet update failed", details: upW.data });

      // Mark transaction success
      await sbPatch(`transactions?reference=eq.${encodeURIComponent(reference)}`, {
        status: "success",
        meta: { stage: "credited", paidAmount, newBal, ps: vrData.data },
      });

      return send(200, { ok: true, status: "success", credited: expected, balance: newBal });
    }

    return send(400, { error: "Invalid action" });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
      }
