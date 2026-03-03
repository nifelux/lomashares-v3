// wallet-balance.js
(function () {
  "use strict";

  const el = document.getElementById("walletBalance");
  if (!el) return;

  const fmt = (n) =>
    "₦" + Number(n || 0).toLocaleString("en-NG", { maximumFractionDigits: 0 });

  async function loadBalance() {
    try {
      if (!window.sb) return;

      const { data: auth } = await window.sb.auth.getUser();
      const user = auth?.user;
      if (!user) return;

      // Assumes a "wallets" table: user_id (uuid), balance (numeric)
      const { data, error } = await window.sb
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      el.textContent = fmt(data?.balance ?? 0);
    } catch (e) {
      console.warn(e);
      el.textContent = "₦0";
    }
  }

  loadBalance();
  // optional refresh every 20s
  setInterval(loadBalance, 20000);
})();
