// wallet-balance.js
(async function () {
  const sb = window.lomaSupabase;
  if (!sb) return;

  const emailEl = document.getElementById("userEmail");
  const balanceEl = document.getElementById("walletBalance");
  const money = (n) => "₦" + Number(n || 0).toLocaleString();

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;

    const user_id = session.user.id;
    const email = session.user.email || "";
    if (emailEl) emailEl.textContent = email;

    const res = await fetch("/api/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get", user_id })
    });

    const data = await res.json();
    if (!res.ok) {
      console.warn("Wallet API error:", data);
      if (balanceEl) balanceEl.textContent = money(0);
      return;
    }

    if (balanceEl) balanceEl.textContent = money(data.balance);
  } catch (e) {
    console.error("wallet-balance.js:", e);
  }
})();
