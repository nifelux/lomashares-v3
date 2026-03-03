// investment.js
(async function () {
  const sb = window.lomaSupabase;
  if (!sb) return;

  const grid = document.getElementById("productsGrid");
  const notice = document.getElementById("notice");
  const toast = (msg) => {
    if (!notice) return;
    notice.textContent = msg;
    notice.classList.add("show");
    setTimeout(() => notice.classList.remove("show"), 2400);
  };

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

  const money = (n) => "₦" + Number(n || 0).toLocaleString();

  function render() {
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

  async function invest(product_id) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    const user_id = session.user.id;

    toast("Processing investment...");

    const res = await fetch("/api/investment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, product_id })
    });

    const data = await res.json();
    if (!res.ok) return toast(data?.error || "Investment failed");

    toast("Investment successful!");
    setTimeout(() => location.reload(), 900);
  }

  render();
})();
