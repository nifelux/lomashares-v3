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

    // user request withdraw
    if (action === "request") {
      const amount = Number(body.amount);
      if (!amount || amount < 500) return res.status(400).json({ error: "Minimum withdrawal is ₦500" });

      const bank_name = String(body.bank_name || "").trim();
      const account_number = String(body.account_number || "").trim();
      const account_name = String(body.account_name || "").trim();
      if (!bank_name || !account_number || !account_name) return res.status(400).json({ error: "Bank details required" });

      // debit wallet (holds funds)
      const ref = `WD_${user.id}_${Date.now()}`;
      const debit = await fetch(`${SUPABASE_URL}/rest/v1/rpc/debit_wallet`, {
        method: "POST",
        headers: svcHeaders,
        body: JSON.stringify({ p_user: user.id, p_amount: amount, p_kind: "withdraw", p_ref: ref }),
      });
      const d = await debit.json();
      if (!debit.ok || !d?.[0]?.ok) return res.status(400).json({ error: d?.[0]?.error || "Insufficient balance" });

      // create withdrawal record
      await fetch(`${SUPABASE_URL}/rest/v1/withdrawals`, {
        method: "POST",
        headers: svcHeaders,
        body: JSON.stringify({ user_id: user.id, amount, bank_name, account_number, account_name, status: "pending" }),
      });

      return res.status(200).json({ ok: true, balance: d?.[0]?.balance });
    }

    // admin list pending
    if (action === "list_pending") {
      if (!(await isAdmin(user.id))) return res.status(403).json({ error: "Admin only" });
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/withdrawals?status=eq.pending&select=id,user_id,amount,bank_name,account_number,account_name,created_at&order=created_at.asc`,
        { headers: svcHeaders }
      );
      const rows = await r.json();
      return res.status(200).json({ ok: true, withdrawals: rows || [] });
    }

    // admin approve (mark paid/approved)
    if (action === "approve") {
      if (!(await isAdmin(user.id))) return res.status(403).json({ error: "Admin only" });
      const id = String(body.withdrawal_id || "");
      if (!id) return res.status(400).json({ error: "withdrawal_id required" });

      // mark approved (Paystack transfer integration can be added later)
      const upd = await fetch(`${SUPABASE_URL}/rest/v1/withdrawals?id=eq.${id}`, {
        method: "PATCH",
        headers: svcHeaders,
        body: JSON.stringify({ status: "approved" }),
      });
      if (!upd.ok) return res.status(500).json({ error: "Update failed" });

      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Invalid action" });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
    }
