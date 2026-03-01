export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ error: "Missing environment variables" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { action, user_id, amount, type } = body;

    if (!user_id) {
      return res.status(400).json({ error: "User ID required" });
    }

    const headers = {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json"
    };

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

      if (!data.length) {
        return res.status(200).json({ balance: 0 });
      }

      return res.status(200).json({ balance: Number(data[0].balance) });
    }

    // ===============================
    // CREDIT WALLET
    // ===============================
    if (action === "credit") {
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      const current = await fetch(
        `${SUPABASE_URL}/rest/v1/wallets?user_id=eq.${user_id}&select=id,balance&limit=1`,
        { headers }
      );

      const wallet = await current.json();

      if (!wallet.length) {
        return res.status(400).json({ error: "Wallet not found" });
      }

      const newBalance = Number(wallet[0].balance) + Number(amount);

      await fetch(
        `${SUPABASE_URL}/rest/v1/wallets?id=eq.${wallet[0].id}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ balance: newBalance })
        }
      );

      return res.status(200).json({ balance: newBalance });
    }

    // ===============================
    // DEBIT WALLET
    // ===============================
    if (action === "debit") {
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      const current = await fetch(
        `${SUPABASE_URL}/rest/v1/wallets?user_id=eq.${user_id}&select=id,balance&limit=1`,
        { headers }
      );

      const wallet = await current.json();

      if (!wallet.length) {
        return res.status(400).json({ error: "Wallet not found" });
      }

      const currentBalance = Number(wallet[0].balance);

      if (currentBalance < amount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      const newBalance = currentBalance - Number(amount);

      await fetch(
        `${SUPABASE_URL}/rest/v1/wallets?id=eq.${wallet[0].id}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ balance: newBalance })
        }
      );

      return res.status(200).json({ balance: newBalance });
    }

    return res.status(400).json({ error: "Invalid action" });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
    }
