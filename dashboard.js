(function () {
  "use strict";

  // ---------- CONFIG ----------
  const API_INVESTMENT = "/api/investment";
  const API_WALLET = "/api/wallet"; // must exist and return { balance }

  // ---------- Auth helpers (uses Supabase session stored in localStorage) ----------
  function getLoggedEmail() {
    // If you have your own auth storage, replace here.
    // For now: your profile page already shows email => so it's in localStorage.
    // Try common keys:
    const direct = localStorage.getItem("lomashares_email");
    if (direct) return direct;

    // If you store authUser:
    const au = JSON.parse(localStorage.getItem("authUser") || "null");
    if (au?.email) return String(au.email).toLowerCase();

    // Supabase stores session under: supabase.auth.token or sb-... keys
    // We won’t parse all supabase keys here—keep it simple:
    return null;
  }

  // ---------- UI ----------
  const walletBalanceEl = document.getElementById("walletBalance");
  const userEmailEl = document.getElementById("userEmail");
  const productsContainer = document.getElementById("productsContainer");
  const incomeHint = document.getElementById("incomeHint");

  // ---------- Menu ----------
  const sheet = document.getElementById("sheet");
  const backdrop = document.getElementById("backdrop");
  const menuBtn = document.getElementById("menuBtn");
  const closeSheet = document.getElementById("closeSheet");

  function openSheet() {
    sheet.classList.add("open");
    backdrop.hidden = false;
    sheet.setAttribute("aria-hidden", "false");
  }
  function closeSheetFn() {
    sheet.classList.remove("open");
    backdrop.hidden = true;
    sheet.setAttribute("aria-hidden", "true");
  }
  if (menuBtn) menuBtn.addEventListener("click", openSheet);
  if (closeSheet) closeSheet.addEventListener("click", closeSheetFn);
  if (backdrop) backdrop.addEventListener("click", closeSheetFn);

  // ---------- Format ----------
  function naira(n) {
    const num = Number(n || 0);
    return "₦" + num.toLocaleString("en-NG");
  }

  // ---------- API calls ----------
  async function postJson(url, payload) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let data = null;
    try { data = await r.json(); } catch (_) {}
    if (!r.ok) throw new Error(data?.error || "Network/API error");
    return data;
  }

  async function fetchBalance(email) {
    // expects /api/wallet {action:"get_balance", email} => {balance}
    const data = await postJson(API_WALLET, { action: "get_balance", email });
    return Number(data.balance || 0);
  }

  async function claimIncome(email) {
    const data = await postJson(API_INVESTMENT, { action: "claim_due_income", email });
    return data;
  }

  async function fetchProducts() {
    const data = await postJson(API_INVESTMENT, { action: "list_products" });
    return Array.isArray(data.products) ? data.products : [];
  }

  // ---------- Render products (premium cards) ----------
  function renderProducts(products) {
    if (!productsContainer) return;

    productsContainer.innerHTML = "";

    if (!products.length) {
      productsContainer.innerHTML = `
        <div class="product">
          <div class="product-top">
            <div>
              <div class="product-name">No products available</div>
              <div class="product-price">—</div>
            </div>
            <div class="tag">Try again</div>
          </div>
          <div class="small">If this keeps happening, your API is not returning products.</div>
        </div>
      `;
      return;
    }

    products.forEach((p) => {
      const card = document.createElement("div");
      card.className = "product";

      card.innerHTML = `
        <div class="product-top">
          <div>
            <div class="product-name">Investment Plan</div>
            <div class="product-price">${naira(p.price)}</div>
          </div>
          <div class="tag">30 Days</div>
        </div>

        <div class="product-grid">
          <div class="kpi">
            <div class="kpi-k">Daily Earning</div>
            <div class="kpi-v">${naira(p.daily)}</div>
          </div>
          <div class="kpi">
            <div class="kpi-k">Total in 30 Days</div>
            <div class="kpi-v">${naira(p.total)}</div>
          </div>
        </div>

        <div class="product-actions">
          <button class="btn buy" type="button" data-buy="${p.id}">
            Invest Now (Max 2 Times)
          </button>
        </div>

        <div class="small">
          Referral commission: <b>10%</b> • Minimum withdrawal: <b>₦500</b> • Withdrawal charges: <b>10%</b>
        </div>
      `;

      productsContainer.appendChild(card);
    });

    // Attach handlers
    productsContainer.querySelectorAll("[data-buy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const productId = Number(btn.getAttribute("data-buy"));
        const email = getLoggedEmail();
        if (!email) return alert("Please login again.");

        btn.disabled = true;
        btn.textContent = "Processing...";

        try {
          const data = await postJson(API_INVESTMENT, {
            action: "buy",
            email,
            product_id: productId,
          });

          // Update UI
          if (typeof data.balance !== "undefined") {
            walletBalanceEl.textContent = naira(data.balance);
          } else {
            const bal = await fetchBalance(email);
            walletBalanceEl.textContent = naira(bal);
          }

          alert("Investment successful ✅");
        } catch (e) {
          alert(e.message || "Investment failed");
        } finally {
          btn.disabled = false;
          btn.textContent = "Invest Now (Max 2 Times)";
        }
      });
    });
  }

  // ---------- Init ----------
  async function init() {
    const email = getLoggedEmail();

    if (userEmailEl) userEmailEl.textContent = email || "—";

    // If no email, force login
    if (!email) {
      window.location.href = "index.html";
      return;
    }

    // 1) Claim due income first
    try {
      const c = await claimIncome(email);
      if (c?.credited > 0) {
        incomeHint.hidden = false;
        incomeHint.textContent = `✅ Daily income credited: ${naira(c.credited)}.`;
      }
    } catch (_) {
      // silent (don’t block dashboard)
    }

    // 2) Fetch balance
    try {
      const bal = await fetchBalance(email);
      walletBalanceEl.textContent = naira(bal);
    } catch (e) {
      walletBalanceEl.textContent = "₦0";
    }

    // 3) Fetch and render products
    try {
      const products = await fetchProducts();
      renderProducts(products);
    } catch (e) {
      renderProducts([]);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
