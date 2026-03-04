// /api/wallet.js
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
  const SITE_URL = process.env.SITE_URL; // e.g. https://lomashares-v3.vercel.app

  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return res.status(500).json({ error: "Missing env vars" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const action = String(body.action || "").toLowerCase();

    // ---- auth user from token ----
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

    // ---- get balance ----
    if (action === "balance") {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/wallets?user_id=eq.${user.id}&select=balance&limit=1`,
        { headers: svcHeaders }
      );
      const rows = await r.json();
      const bal = rows?.[0]?.balance ?? 0;
      return res.status(200).json({ ok: true, balance: Number(bal) });
    }

    // ---- list transactions ----
    if (action === "transactions") {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/transactions?user_id=eq.${user.id}&select=kind,amount,status,ref,created_at,meta&order=created_at.desc`,
        { headers: svcHeaders }
      );
      const rows = await r.json();
      return res.status(200).json({ ok: true, transactions: rows || [] });
    }

    // ---- list deposits ----
    if (action === "deposits") {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/deposits?user_id=eq.${user.id}&select=reference,amount,channel,status,created_at&order=created_at.desc`,
        { headers: svcHeaders }
      );
      const rows = await r.json();
      return res.status(200).json({ ok: true, deposits: rows || [] });
    }

    // ---- list withdrawals ----
    if (action === "withdrawals") {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/withdrawals?user_id=eq.${user.id}&select=amount,status,bank_name,account_number,account_name,created_at&order=created_at.desc`,
        { headers: svcHeaders }
      );
      const rows = await r.json();
      return res.status(200).json({ ok: true, withdrawals: rows || [] });
    }

    // ---- paystack init redirect ----
    if (action === "paystack_init") {
      if (!PAYSTACK_SECRET) return res.status(500).json({ error: "Missing PAYSTACK_SECRET_KEY" });
      const amount = Number(body.amount);
      if (!amount || amount < 1000) return res.status(400).json({ error: "Minimum deposit is ₦1,000" });

      const ref = `LS_DEP_${user.id}_${Date.now()}`;
      const callback_url = `${SITE_URL || ""}/deposit.html?ref=${encodeURIComponent(ref)}`;

      const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          amount: Math.round(amount * 100),
          reference: ref,
          callback_url,
          metadata: { user_id: user.id, purpose: "wallet_deposit" },
        }),
      });

      const initData = await initRes.json();
      if (!initRes.ok || !initData.status) {
        return res.status(400).json({ error: initData.message || "Paystack init failed", raw: initData });
      }
      return res.status(200).json({ ok: true, authorization_url: initData.data.authorization_url, reference: ref });
    }

    // ---- paystack verify and credit wallet ----
    if (action === "paystack_verify") {
      if (!PAYSTACK_SECRET) return res.status(500).json({ error: "Missing PAYSTACK_SECRET_KEY" });
      const reference = String(body.reference || "").trim();
      if (!reference) return res.status(400).json({ error: "reference required" });

      const vRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
      });
      const vData = await vRes.json();
      if (!vRes.ok || !vData.status) return res.status(400).json({ error: vData.message || "Verification failed" });

      const tx = vData.data;
      if (tx.status !== "success") return res.status(400).json({ error: "Payment not successful" });

      const paid = Number(tx.amount) / 100;

      // insert deposit (merge duplicates keeps unique(reference) safe)
      await fetch(`${SUPABASE_URL}/rest/v1/deposits`, {
        method: "POST",
        headers: { ...svcHeaders, Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({
          user_id: user.id,
          reference,
          amount: paid,
          channel: tx.channel || "paystack",
          status: "success",
        }),
      });

      // credit wallet + create transaction
      const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/credit_wallet`, {
        method: "POST",
        headers: svcHeaders,
        body: JSON.stringify({ p_user: user.id, p_amount: paid, p_kind: "deposit", p_ref: reference }),
      });
      const rpcData = await rpc.json().catch(() => null);
      if (!rpc.ok) return res.status(500).json({ error: "Wallet credit failed", details: rpcData });

      return res.status(200).json({ ok: true, paid, balance: rpcData?.[0]?.balance ?? null });
    }

    return res.status(400).json({ error: "Invalid action" });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
  }
