// gift.js
(async function () {
  const sb = window.lomaSupabase;
  if (!sb) return;

  const input = document.getElementById("giftCode");
  const btn = document.getElementById("redeemBtn");
  const historyEl = document.getElementById("giftHistory");
  const notice = document.getElementById("notice");

  const toast = (msg) => {
    if (!notice) return;
    notice.textContent = msg;
    notice.classList.add("show");
    setTimeout(() => notice.classList.remove("show"), 2400);
  };

  const money = (n) => "₦" + Number(n || 0).toLocaleString();

  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const user_id = session.user.id;

  async function loadHistory() {
    if (!historyEl) return;
    // If you store gift redemption as transactions:
    const { data, error } = await sb
      .from("transactions")
      .select("type, amount, status, created_at")
      .eq("user_id", user_id)
      .eq("type", "Gift")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !data?.length) {
      historyEl.innerHTML = `
        <div class="empty">
          <div class="empty-title">No gift history</div>
          <div class="empty-sub">Redeemed gift codes will show here.</div>
        </div>`;
      return;
    }

    historyEl.innerHTML = data.map(t => `
      <div class="item">
        <div class="item-left">
          <div class="item-title">Gift Credited</div>
          <div class="item-sub">+ <b>${money(t.amount)}</b> • ${new Date(t.created_at).toLocaleDateString()}</div>
        </div>
        <div class="badge active">${(t.status || "success")}</div>
      </div>
    `).join("");
  }

  btn?.addEventListener("click", async () => {
    const code = (input?.value || "").trim().toUpperCase();
    if (!code) return toast("Enter a gift code.");

    btn.disabled = true;
    toast("Checking gift code...");

    // Backend recommended (one-time use must be enforced server-side)
    const res = await fetch("/api/gift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "redeem", user_id, code })
    });

    const data = await res.json();
    btn.disabled = false;

    if (!res.ok) return toast(data?.error || "Gift code failed");

    toast(`Gift applied! +${money(data.amount || 0)}`);
    if (input) input.value = "";

    await loadHistory();
    setTimeout(() => location.reload(), 800);
  });

  await loadHistory();
})();
