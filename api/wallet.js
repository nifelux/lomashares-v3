export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ error: "Missing environment variables" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { action, user_id, amount, type, email, reference, callback_url } = body;

    if (!user_id) return res.status(400).json({ error: "User ID required" });

    const headers = {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    };

    // Helper: read wallet
    async function getWallet() {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/wallets?user_id=eq.${user_id}&select=id,balance&limit=1`,
        { headers }
      );
      const data = await r.json();
      return { r, data };
    }

    // Helper: set wallet balance
    async function setWalletBalance(walletId, newBalance) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/wallets?id=eq.${walletId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ balance: newBalance }),
      });
      return r.ok;
    }

    // ===============================
    // GET BALANCE
    // ===============================
    if (action === "get") {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/wallets?user_id=eq.${user_id}&select=balance&limit=1`,
        { headers }
      );

      const data = await r.json();
      if (!r.ok) return res.status(500).json({ error: "Failed to fetch wallet" });

      if (!data.length) return res.status(200).json({ balance: 0 });
      return res.status(200).json({ balance: Number(data[0].balance) });
    }

    // ===============================
    // CREDIT WALLET (existing)
    // ===============================
    if (action === "credit") {
      if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });

      const current = await getWallet();
      if (!current.data.length) return res.status(400).json({ error: "Wallet not found" });

      const newBalance = Number(current.data[0].balance) + Number(amount);
      await setWalletBalance(current.data[0].id, newBalance);

      return res.status(200).json({ balance: newBalance });
    }

    // ===============================
    // DEBIT WALLET (existing)
    // ===============================
    if (action === "debit") {
      if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });

      const current = await getWallet();
      if (!current.data.length) return res.status(400).json({ error: "Wallet not found" });

      const currentBalance = Number(current.data[0].balance);
      if (currentBalance < amount) return res.status(400).json({ error: "Insufficient balance" });

      const newBalance = currentBalance - Number(amount);
      await setWalletBalance(current.data[0].id, newBalance);

      return res.status(200).json({ balance: newBalance });
    }

    // ===============================
    // PAYSTACK INIT (Redirect flow)
    // ===============================
    if (action === "paystack_init") {
      if (!PAYSTACK_SECRET_KEY) return res.status(500).json({ error: "Missing PAYSTACK_SECRET_KEY" });
      if (!email) return res.status(400).json({ error: "Email required" });
      if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });

      // Where Paystack should redirect user after payment
      // You can pass it from frontend or hardcode it in env.
      const cb = callback_url;
      if (!cb) return res.status(400).json({ error: "callback_url required" });

      // Unique reference we control (good for matching + idempotency)
      const ref = `LS_${user_id}_${Date.now()}`;

      const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: Math.round(Number(amount) * 100), // kobo
          reference: ref,
          callback_url: cb, // Paystack will append ?reference=...
          metadata: { user_id, purpose: "wallet_deposit" },
        }),
      });

      const initData = await initRes.json();
      if (!initRes.ok || !initData.status) {
        return res.status(400).json({ error: initData.message || "Paystack init failed", raw: initData });
      }

      // initData.data.authorization_url is the hosted payment link
      return res.status(200).json({
        authorization_url: initData.data.authorization_url,
        reference: initData.data.reference,
      });
    }

// ===============================
// PAYSTACK VERIFY + ATOMIC CREDIT (RPC)
// ===============================
if (action === "paystack_verify_and_credit") {
  if (!PAYSTACK_SECRET_KEY) return res.status(500).json({ error: "Missing PAYSTACK_SECRET_KEY" });
  if (!reference) return res.status(400).json({ error: "reference required" });

  // 1) Verify transaction server-side with Paystack
  const vRes = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
  );
  const vData = await vRes.json();

  if (!vRes.ok || !vData.status) {
    return res.status(400).json({ error: vData.message || "Verification failed", raw: vData });
  }

  const tx = vData.data;

  if (tx.status !== "success") return res.status(400).json({ error: "Payment not successful" });
  if (tx.currency !== "NGN") return res.status(400).json({ error: "Currency mismatch" });

  // Stronger binding: ensure transaction metadata matches this user
  const metaUserId = tx?.metadata?.user_id;
  if (metaUserId && String(metaUserId) !== String(user_id)) {
    return res.status(400).json({ error: "User mismatch on transaction" });
  }

  const paid = Number(tx.amount) / 100;

  // Optional: if frontend sent expected amount, enforce it
  if (amount && Number(paid) !== Number(amount)) {
    return res.status(400).json({ error: `Amount mismatch. Paid ₦${paid}, expected ₦${amount}` });
  }

  // 2) Atomic credit via Supabase RPC
  const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/credit_wallet_from_deposit`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      p_user_id: user_id,
      p_reference: reference,
      p_amount: paid,
      p_channel: tx.channel || "paystack",
    }),
  });

  const rpcData = await rpcRes.json().catch(() => null);
  if (!rpcRes.ok || !Array.isArray(rpcData) || !rpcData.length) {
    return res.status(500).json({
      error: "Failed to credit wallet (RPC)",
      raw: rpcData,
    });
  }

  const out = rpcData[0];
  return res.status(200).json({
    ok: out.ok,
    already_credited: out.already_credited,
    reference: out.reference,
    paid: out.paid,
    balance: out.balance,
  });
        }
