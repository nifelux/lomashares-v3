// investment.js
(async function () {
  const sb = window.lomaSupabase;
  if (!sb) return;

  const grid = document.getElementById("productsGrid");
  const activeBox = document.getElementById("activeInvestments");
  const notice = document.getElementById("notice");

  const toast = (msg) => {
    if (!notice) return;
    notice.textContent = msg;
    notice.classList.add("show");
    setTimeout(() => notice.classList.remove("show"), 2400);
  };

  const money = (n) => "₦" + Number(n || 0).toLocaleString();

  // ✅ Products (edit amounts anytime)
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
    { id: 10, price: 1000000, daily: 66667, total: 2000000 },
  ];

  // ----------------------------
  // Render products grid
  // ----------------------------
  function renderProducts() {
    if (!grid) return;

    grid.innerHTML = PRODUCTS.map(p => `
      <article class="product-card">
        <div class="pc-top">
          <div class="pc-title">Plan ${p.id}</div>
          <div class="pc-pill">30 Days</div>
        </div>

        <div class="pc-amt">${money(p.price)}</div>

        <div class="pc-meta">
          <div><span class="muted">Daily Income</span><br><strong>${money(p.daily)}</strong></div>
          <div><span class="muted">Total Return</span><br><strong>${money(p.total)}</strong></div>
        </div>

        <div class="tagrow">
          <span class="tag">200% Total Return</span>
          <span class="tag">Daily Credit</span>
          <span class="tag">Buy max 2x</span>
        </div>

        <div class="pc-actions">
          <button class="btn primary" data-invest="${p.id}">Invest</button>
          <a class="btn ghost" href="deposit.html">Deposit</a>
        </div>
      </article>
    `).join("");

    grid.querySelectorAll("[data-invest]").forEach(btn => {
      btn.addEventListener("click", () => invest(Number(btn.dataset.invest)));
    });
  }

  // ----------------------------
  // Load active investments (from Supabase directly)
  // Shows empty state if none
  // ----------------------------
  async function loadActiveInvestments(user_id) {
    if (!activeBox) return;

    // Show loading immediately
    activeBox.innerHTML = `
      <div class="empty">
        <div class="empty-title">Loading...</div>
        <div class="empty-sub">Fetching your active investments.</div>
      </div>
    `;

    // Query investments table
    const { data, error } = await sb
      .from("investments")
      .select("id, amount, status, start_date, maturity_date, created_at")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.warn("Load investments error:", error);
      activeBox.innerHTML = `
        <div class="empty">
          <div class="empty-title">Unable to load investments</div>
          <div class="empty-sub">Check your Supabase RLS or table name.</div>
        </div>
      `;
      return;
    }

    if (!data || data.length === 0) {
      activeBox.innerHTML = `
        <div class="empty">
          <div class="empty-title">No active investment yet</div>
          <div class="empty-sub">Pick a plan below to start earning daily income.</div>
        </div>
      `;
      return;
    }

    activeBox.innerHTML = data.map(inv => `
      <div class="item">
        <div class="item-left">
          <div class="item-title">Investment • ${money(inv.amount)}</div>
          <div class="item-sub">
            Start: <b>${new Date(inv.start_date || inv.created_at).toLocaleDateString()}</b>
            • Maturity: <b>${inv.maturity_date ? new Date(inv.maturity_date).toLocaleDateString() : "Pending"}</b>
          </div>
        </div>
        <div class="badge ${String(inv.status || "active").toLowerCase() === "active" ? "active" : "pending"}">
          ${(inv.status || "active")}
        </div>
      </div>
    `).join("");
  }

  // ----------------------------
  // Invest (calls backend)
  // ----------------------------
  async function invest(product_id) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;

    toast("Processing investment...");

    const res = await fetch("/api/investment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: session.user.id, product_id })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // This is where you'll see "Missing env vars"
      return toast(data.error || "Investment failed");
    }

    toast("Investment successful!");
    setTimeout(() => location.reload(), 900);
  }

  // ----------------------------
  // Boot
  // ----------------------------
  renderProducts();

  const { data: { session } } = await sb.auth.getSession();
  if (session?.user?.id) {
    await loadActiveInvestments(session.user.id);
  }
})();
