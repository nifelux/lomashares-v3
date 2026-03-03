export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ANON_KEY = process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
      return res.status(500).json({ error: "Missing env vars" });
    }

    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing auth token" });

    // Verify user session token with Supabase Auth
    const uRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY }
    });
    const user = await uRes.json();
    if (!uRes.ok || !user?.id) return res.status(401).json({ error: "Invalid session" });

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const product_id = Number(body?.product_id);
    if (!product_id || product_id < 1 || product_id > 10) {
      return res.status(400).json({ error: "Invalid product_id" });
    }

    // Call RPC create investment (atomic)
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rpc_create_investment`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ p_user_id: user.id, p_product_id: product_id })
    });

    const rpcData = await rpcRes.json();
    if (!rpcRes.ok) return res.status(500).json({ error: "Investment rpc failed", details: rpcData });

    if (!rpcData?.ok) return res.status(400).json({ error: rpcData?.error || "Investment failed" });

    return res.status(200).json(rpcData);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
                            }
