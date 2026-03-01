(function () {
  "use strict";

  // ----------------------------
  // Config (from body attributes)
  // ----------------------------
  const SB_URL = document.body.getAttribute("data-supabase-url");
  const SB_ANON = document.body.getAttribute("data-supabase-anon");

  const elNotice = document.getElementById("notice");
  const elWallet = document.getElementById("walletBalance");
  const elEmail = document.getElementById("userEmail");
  const elToday = document.getElementById("todayEarnings");
  const elActive = document.getElementById("activePlans");
  const elProducts = document.getElementById("products");

  const btnLogout = document.getElementById("logoutBtn");
  const btnRefresh = document.getElementById("refreshBtn");
  const btnGoDeposit = document.getElementById("goDepositBtn");

  const qlDeposit = document.getElementById("qlDeposit");
  const qlWithdraw = document.getElementById("qlWithdraw");
  const qlGift = document.getElementById("qlGift");
  const qlRefer = document.getElementById("qlRefer");

  // ----------------------------
  // Helpers
  // ----------------------------
  function toast(msg) {
    if (!elNotice) return alert(msg);
    elNotice.textContent = msg;
    elNotice.classList.add("show");
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => elNotice.classList.remove("show"), 3500);
  }

  function formatNaira(n) {
    return "₦" + Number(n || 0).toLocaleString("en-NG");
  }

  // ----------------------------
  // Validate Supabase
  // ----------------------------
  if (!SB_URL || !SB_ANON) {
    toast("Config error: missing Supabase keys on this page.");
    return;
  }
  if (!window.supabase || !window.supabase.createClient) {
    toast("Supabase library not loaded. Check the script tag.");
    return;
  }

  const supabase = window.supabase.createClient(SB_URL, SB_ANON);

  // ----------------------------
  // Product list (leave as you chose)
  // 200% total return in 30 days
  // ----------------------------
  const PRODUCTS = [
    { id: 1, price: 3000 },
    { id: 2, price: 5000 },
    { id: 3, price: 7000 },
    { id: 4, price: 10000 },
    { id: 5, price: 15000 },
    { id: 6, price: 20000 },
    { id: 7, price: 30000 },
    { id: 8, price: 40000 },
    { id: 9, price: 50000 },
    { id: 10, price: 100000 }
  ];

  // ----------------------------
  // Auth Guard
  // ----------------------------
  async function requireSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) console.error(error);

    const session = data?.session || null;
    if (!session) {
      window.location.replace("index.html");
      return null;
    }
    return session;
  }

  // ----------------------------
  // Load User Info
  // ----------------------------
  function renderUser(session) {
    if (elEmail) elEmail.textContent = session?.user?.email || "User";
  }

  // ----------------------------
  // Wallet API (POST /api/wallet)
  // ----------------------------
  async function loadWallet() {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) {
      window.location.replace("index.html");
      return;
    }

    try {
      const r = await fetch("/api/wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({})
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Wallet API error");

      if (elWallet) elWallet.textContent = formatNaira(j.balance);
    } catch (e) {
      toast("Network error while fetching wallet.");
      console.error(e);
    }
  }

  // ----------------------------
  // Optional stats from Supabase tables
  // - Active plans: investments where status='active'
  // - Today earnings: transactions where type='daily_income' today
  // If these tables not ready, it won't crash.
  // ----------------------------
  async function loadStats(session) {
    try {
      // Active Investments
      const { data: invs, error: invErr } = await supabase
        .from("investments")
        .select("id,status")
        .eq("user_id", session.user.id);

      if (!invErr && elActive) {
        const active = (invs || []).filter(x => x.status === "active").length;
        elActive.textContent = String(active);
      }

      // Today's daily_income sum
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const { data: txs, error: txErr } = await supabase
        .from("transactions")
        .select("amount,type,created_at")
        .eq("user_id", session.user.id)
        .eq("type", "daily_income")
        .gte("created_at", start.toISOString());

      if (!txErr && elToday) {
        const sum = (txs || []).reduce((a, t) => a + Number(t.amount || 0), 0);
        elToday.textContent = formatNaira(sum);
      }
    } catch (e) {
      // Silent fail – dashboard still works
      console.warn("Stats load skipped:", e.message);
    }
  }

  // ----------------------------
  // Render Products UI
  // ----------------------------
  function renderProducts() {
    if (!elProducts) return;

    elProducts.innerHTML = "";

    PRODUCTS.forEach(p => {
      const totalReturn = p.price * 2;    // 200%
      const daily = totalReturn / 30;

      const card = document.createElement("div");
      card.className = "card pcard";
      card.innerHTML = `
        <div class="phead">
          <div style="width:100%;">
            <div class="ptitle">Product ${p.id}</div>
            <div class="pmeta">
              <span class="price">${formatNaira(p.price)}</span><br>
              Daily Income: <b>${formatNaira(Math.floor(daily))}</b><br>
              Duration: <b>30 days</b> • Total Return: <b>${formatNaira(totalReturn)}</b>
            </div>
            <div class="tag">200% ROI • Automatic Daily Credit</div>
          </div>
        </div>

        <div class="pactions">
          <button class="primary" type="button" data-invest="${p.id}">Invest Now</button>
          <button type="button" data-deposit="1">Deposit</button>
        </div>
      `;

      elProducts.appendChild(card);
    });

    // Bind deposit buttons
    elProducts.querySelectorAll("button[data-deposit]").forEach(btn => {
      btn.addEventListener("click", () => window.location.href = "deposit.html");
    });

    // Bind invest buttons
    elProducts.querySelectorAll("button[data-invest]").forEach(btn => {
      btn.addEventListener("click", () => invest(Number(btn.getAttribute("data-invest"))));
    });
  }

  // ----------------------------
  // Invest API call (POST /api/investment)
  // ----------------------------
  async function invest(productId) {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;

    if (!token) {
      toast("Session expired. Login again.");
      window.location.replace("index.html");
      return;
    }

    // UI loading state
    const btn = document.querySelector(`button[data-invest="${productId}"]`);
    const oldText = btn ? btn.textContent : "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Processing…";
    }

    try {
      const r = await fetch("/api/investment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ product_id: productId })
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Investment failed");

      if (j.ok) {
        toast(`Investment successful! Daily: ${formatNaira(j.daily_income)} for ${j.days_total} days.`);
        await loadWallet();
        const session = await requireSession();
        if (session) await loadStats(session);
      } else {
        toast(j.error || "Investment failed");
      }
    } catch (e) {
      toast(e.message || "Network error. Try again.");
      console.error(e);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    }
  }

  // ----------------------------
  // Logout
  // ----------------------------
  async function logout() {
    await supabase.auth.signOut();
    window.location.replace("index.html");
  }

  // ----------------------------
  // Navigation quick links
  // ----------------------------
  function bindLinks() {
    if (qlDeposit) qlDeposit.addEventListener("click", () => location.href = "deposit.html");
    if (qlWithdraw) qlWithdraw.addEventListener("click", () => location.href = "withdraw.html");
    if (qlGift) qlGift.addEventListener("click", () => location.href = "gift.html");
    if (qlRefer) qlRefer.addEventListener("click", () => location.href = "refer.html");
    if (btnGoDeposit) btnGoDeposit.addEventListener("click", () => location.href = "deposit.html");
  }

  // ----------------------------
  // Refresh button
  // ----------------------------
  async function refresh() {
    const session = await requireSession();
    if (!session) return;
    await loadWallet();
    await loadStats(session);
    toast("Updated.");
  }

  // ----------------------------
  // Init
  // ----------------------------
  document.addEventListener("DOMContentLoaded", async () => {
    const session = await requireSession();
    if (!session) return;

    renderUser(session);
    bindLinks();
    renderProducts();

    if (btnLogout) btnLogout.addEventListener("click", logout);
    if (btnRefresh) btnRefresh.addEventListener("click", refresh);

    await loadWallet();
    await loadStats(session);
  });

})();
