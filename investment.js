// investment.js
(async function () {
  const sb = window.lomaSupabase;
  if (!sb) return;

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

  const grid = document.getElementById("productsGrid");
  const list = document.getElementById("activeInvestments");
  const notice = document.getElementById("notice");

  const money = (n) => "₦" + Number(n || 0).toLocaleString();

  function toast(msg) {
    if (!notice) return;
    notice.textContent = msg;
    notice.classList.add("show");
    setTimeout(() => notice.classList.remove("show"), 2500);
  }

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
        <div class="pc-tags">
          <span class="tag">200% ROI</span>
          <span class="tag">Auto Daily Credit</span>
          <span class="tag">Max 2x lifetime</span>
        </div>
        <div class="pc-actions">
          <button class="btn primary" data-invest="${p.id}">Invest</button>
          <a class="btn ghost" href="deposit.html">Deposit</a>
        </div>
      </article>
    `).join("");

    grid.querySelectorAll("[data-invest]").forEach(btn => {
      btn.addEventListener("click", () => startInvest(Number(btn.dataset.invest)));
    });
  }

  function renderActive(investments) {
    if (!list) return;

    if (!investments || investments.length === 0) {
      list.innerHTML = `
        <div class="empty">
          <div class="empty-title">No active investment yet</div>
          <div class="empty-sub">Choose a product below to start earning daily.</div>
        </div>
      `;
      return;
    }

    list.innerHTML = investments.map(inv => {
      const prod = PRODUCTS.find(p => p.id === inv.product_id) || {};
      const status = (inv.status || "active").toLowerCase();

      return `
        <div class="item">
          <div class="item-left">
            <div class="item-title">Plan ${inv.product_id} • ${money(inv.amount || prod.price)}</div>
            <div class="item-sub">
              Daily: <b>${money(prod.daily || inv.daily_income)}</b> •
              Maturity: <b>${inv.maturity_date ? new Date(inv.maturity_date).toLocaleDateString() : "30 days"}</b>
            </div>
          </div>
          <div class="badge ${status}">${status}</div>
        </div>
      `;
    }).join("");
  }

  async function getToken() {
    const { data: { session } } = await sb.auth.getSession();
    return session?.access_token || null;
  }

  async function loadActiveInvestments() {
    const token = await getToken();
    if (!token) return;

    const res = await fetch("/api/investment", {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await res.json();

    if (!res.ok) {
      console.warn("GET /api/investment failed", data);
      renderActive([]);
      return;
    }

    renderActive(data.investments || []);
  }

  async function startInvest(productId) {
    const token = await getToken();
    if (!token) return;

    toast("Processing investment...");

    const res = await fetch("/api/investment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ product_id: productId })
    });

    const data = await res.json();
    if (!res.ok) {
      toast(data?.error || "Investment failed");
      return;
    }

    toast("Investment successful!");
    await loadActiveInvestments();
    // refresh wallet widget
    setTimeout(() => location.reload(), 800);
  }

  renderProducts();
  await loadActiveInvestments();
})();
