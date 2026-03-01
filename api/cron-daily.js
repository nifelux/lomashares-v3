export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const CRON_SECRET = process.env.CRON_SECRET;

    if (!SUPABASE_URL || !SERVICE_KEY || !CRON_SECRET) {
      return res.status(500).json({ error: "Missing env vars" });
    }

    const secret = req.headers["x-cron-secret"];
    if (secret !== CRON_SECRET) return res.status(401).json({ error: "Unauthorized" });

    const limit = Number(req.query?.limit || 200);

    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rpc_process_due_payouts`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ p_limit: limit })
    });

    const data = await rpcRes.json();
    if (!rpcRes.ok) return res.status(500).json({ error: "Cron rpc failed", details: data });

    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
      }
