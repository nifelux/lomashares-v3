// wallet-balance.js
(async function () {
  const sb = window.lomaSupabase;
  if (!sb) return;

  const emailEl = document.getElementById("userEmail");
  const balanceEl = document.getElementById("walletBalance");

  function money(n) {
    return "₦" + Number(n || 0).toLocaleString();
  }

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;

    const email = session.user?.email || "";
    if (emailEl) emailEl.textContent = email;

    // Call Wallet API (must accept Bearer token)
    const res = await fetch("/api/wallet", {
      method: "GET",
      headers: { "Authorization": `Bearer ${session.access_token}` }
    });

    const data = await res.json();
    if (!res.ok) {
      console.warn("Wallet API error:", data);
      if (balanceEl) balanceEl.textContent = money(0);
      return;
    }

    if (balanceEl) balanceEl.textContent = money(data.balance);

  } catch (e) {
    console.error("wallet-balance.js error:", e);
  }
})();
