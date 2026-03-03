// investment.js
(function () {
  "use strict";

  const grid = document.getElementById("productsGrid");
  const activeWrap = document.getElementById("activeInvestments");
  const toast = document.getElementById("notice");

  const fmt = (n) =>
    "₦" + Number(n || 0).toLocaleString("en-NG", { maximumFractionDigits: 0 });

  function notify(msg, type = "good") {
    if (!toast) return alert(msg);
    toast.textContent = msg;
    toast.classList.remove("good", "bad");
    toast.classList.add("show", type === "bad" ? "bad" : "good");
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  // Example plans (edit these to match your real pricing)
  // ROI is 200% total over 30 days (as your UI states).
  const PLANS = [
    { id: "starter", name: "Starter", price: 2000, days: 30, totalReturnPct: 200, dailyPct: (200 / 30) },
    { id: "basic",   name: "Basic",   price: 5000, days: 30, totalReturnPct: 200, dailyPct: (200 / 30) },
    { id: "silver",  name: "Silver",  price: 10000, days: 30, totalReturnPct: 200, dailyPct: (200 / 30) },
    { id: "gold",    name: "Gold",    price: 20000, days: 30, totalReturnPct: 200, dailyPct: (200 / 30) },
    { id: "vip",     name: "VIP",     price: 50000, days: 30, totalReturnPct: 200, dailyPct: (200 / 30) },
    { id: "elite",   name: "Elite",   price: 100000, days: 30, totalReturnPct: 200, dailyPct: (200 / 30) },
  ];

  function planCard(p) {
    const totalReturn = p.price * (p.totalReturnPct / 100);
    const dailyIncome = totalReturn / p.days;

    const div = document.createElement("div");
    div.className = "plan";
    div.innerHTML = `
      <div class="plan-top">
        <div>
          <div class="plan-title">${p.name}</div>
          <div class="plan-price">${fmt(p.price)}</div>
          <div class="plan-small">
            Duration: <b>${p.days} days</b> • Total Return: <b>${p.totalReturnPct}%</b>
          </div>
        </div>
        <div class="pill">2× lifetime</div>
      </div>

      <div class="plan-kpis">
        <div class="kbox">
          <div class="klabel">Daily Income</div>
          <div class="kval">${fmt(dailyIncome)}</div>
        </div>
        <div class="kbox">
          <div class="klabel">Total Return</div>
          <div class="kval">${fmt(totalReturn)}</div>
        </div>
        <div class="kbox">
          <div class="klabel">Daily Rate</div>
          <div class="kval">${p.dailyPct.toFixed(2)}%</div>
        </div>
      </div>

      <div class="plan-actions">
        <button class="btn btn-primary" data-buy="${p.id}">Buy Plan</button>
        <button class="btn btn-ghost" data-details="${p.id}">Details</button>
      </div>

      <div class="note">Daily income credits every 24 hours after purchase.</div>
    `;
    return div;
  }

  async function renderPlans() {
    if (!grid) return;
    grid.innerHTML = "";
    PLANS.forEach((p) => grid.appendChild(planCard(p)));

    grid.addEventListener("click", async (e) => {
      const buyId = e.target?.getAttribute?.("data-buy");
      const detailsId = e.target?.getAttribute?.("data-details");

      if (detailsId) {
        const p = PLANS.find(x => x.id === detailsId);
        if (!p) return;
        notify(`${p.name}: Pay ${fmt(p.price)}. Earn for ${p.days} days. Total return ${p.totalReturnPct}%.`);
      }

      if (buyId) {
        const p = PLANS.find(x => x.id === buyId);
        if (!p) return;
        await buyPlan(p);
      }
    });
  }

  // ✅ Wallet purchase flow:
  // 1) checks wallet balance in "wallets"
  // 2) deducts
  // 3) creates investment row in "investments"
  //
  // You MUST have RLS + policies or use RPC/edge function.
  // For quick testing, you can disable RLS (not recommended).
  async function buyPlan(plan) {
    try {
      if (!window.sb) return notify("Supabase client not ready.", "bad");

      const { data: auth } = await window.sb.auth.getUser();
      const user = auth?.user;
      if (!user) return notify("Please login again.", "bad");

      // fetch wallet
      const { data: wallet, error: wErr } = await window.sb
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .single();
      if (wErr) throw wErr;

      const bal = Number(wallet?.balance || 0);
      if (bal < plan.price) return notify("Insufficient wallet balance.", "bad");

      // deduct wallet
      const newBal = bal - plan.price;
      const { error: uErr } = await window.sb
        .from("wallets")
        .update({ balance: newBal })
        .eq("user_id", user.id);
      if (uErr) throw uErr;

      // create investment
      const startsAt = new Date();
      const endsAt = new Date(startsAt.getTime() + plan.days * 24 * 60 * 60 * 1000);

      const payload = {
        user_id: user.id,
        plan_id: plan.id,
        plan_name: plan.name,
        amount: plan.price,
        duration_days: plan.days,
        total_return_pct: plan.totalReturnPct,
        status: "active",
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      };

      const { error: iErr } = await window.sb.from("investments").insert(payload);
      if (iErr) throw iErr;

      notify(`${plan.name} purchased successfully.`);
      // refresh wallet display if present
      if (typeof window.refreshWalletBalance === "function") window.refreshWalletBalance();
      await loadActiveInvestments();
    } catch (e) {
      console.warn(e);
      notify(e?.message || "Purchase failed.", "bad");
    }
  }

  function invRow(inv) {
    const div = document.createElement("div");
    div.className = "inv-row";
    const ends = inv?.ends_at ? new Date(inv.ends_at).toLocaleDateString() : "—";
    div.innerHTML = `
      <div class="inv-left">
        <div class="inv-name">${inv.plan_name || inv.plan_id || "Investment"}</div>
        <div class="inv-meta">Amount: <b>${fmt(inv.amount)}</b> • Ends: <b>${ends}</b></div>
      </div>
      <div class="inv-right">
        <div class="inv-badge">${(inv.status || "active").toUpperCase()}</div>
      </div>
    `;
    return div;
  }

  async function loadActiveInvestments() {
    try {
      if (!activeWrap) return;
      if (!window.sb) return;

      const { data: auth } = await window.sb.auth.getUser();
      const user = auth?.user;
      if (!user) return;

      const { data, error } = await window.sb
        .from("investments")
        .select("plan_id, plan_name, amount, status, ends_at")
        .eq("user_id", user.id)
        .order("ends_at", { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        activeWrap.innerHTML = `
          <div class="empty">
            <div class="empty-title">No active investments</div>
            <div class="empty-sub">Buy a plan below to start earning daily.</div>
          </div>
        `;
        return;
      }

      activeWrap.innerHTML = "";
      data.forEach((inv) => activeWrap.appendChild(invRow(inv)));
    } catch (e) {
      console.warn(e);
      if (!activeWrap) return;
      activeWrap.innerHTML = `
        <div class="empty">
          <div class="empty-title">Unable to load</div>
          <div class="empty-sub">${(e && e.message) ? e.message : "Please refresh the page."}</div>
        </div>
      `;
    }
  }

  // Optional hook for wallet-balance.js
  window.refreshWalletBalance = window.refreshWalletBalance || null;

  // boot
  renderPlans();
  loadActiveInvestments();
})();
