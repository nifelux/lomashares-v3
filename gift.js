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
    setTimeout(() => notice.classList.remove("show"), 2500);
  };

  const money = (n) => "₦" + Number(n || 0).toLocaleString();

  const { data: { session } } = await sb.auth.getSession();
  const token = session?.access_token;
  if (!token) return;

  async function loadHistory() {
    if (!historyEl) return;
    const res = await fetch("/api/gift", {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await res.json();

    if (!res.ok) return;

    const rows = data.history || [];
    if (rows.length === 0) {
      historyEl.innerHTML = `
        <div class="empty">
          <div class="empty-title">No gift history</div>
          <div class="empty-sub">Redeemed gift codes will show here.</div>
        </div>
      `;
      return;
    }

    historyEl.innerHTML = rows.map(r => `
      <div class="item">
        <div class="item-left">
          <div class="item-title">${r.code}</div>
          <div class="item-sub">Amount: <b>${money(r.amount)}</b> • ${new Date(r.created_at).toLocaleDateString()}</div>
        </div>
        <div class="badge active">used</div>
      </div>
    `).join("");
  }

  btn?.addEventListener("click", async () => {
    const code = input?.value.trim();
    if (!code) return toast("Enter a gift code.");

    btn.disabled = true;
    toast("Checking code...");

    const res = await fetch("/api/gift", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ code })
    });

    const data = await res.json();
    btn.disabled = false;

    if (!res.ok) {
      toast(data?.error || "Invalid code");
      return;
    }

    toast(`Gift applied! +${money(data.amount || 0)}`);
    if (input) input.value = "";
    await loadHistory();

    // refresh wallet widget
    setTimeout(() => location.reload(), 800);
  });

  await loadHistory();
})();
