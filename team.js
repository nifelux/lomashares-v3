// team.js
(async function () {
  const sb = window.lomaSupabase;
  if (!sb) return;

  const totalEl = document.getElementById("teamTotal");
  const bonusEl = document.getElementById("teamBonus");
  const listEl  = document.getElementById("teamList");

  const money = (n) => "₦" + Number(n || 0).toLocaleString();

  const { data: { session } } = await sb.auth.getSession();
  const token = session?.access_token;
  if (!token) return;

  const res = await fetch("/api/referral?mode=team", {
    method: "GET",
    headers: { "Authorization": `Bearer ${token}` }
  });
  const data = await res.json();

  if (!res.ok) {
    console.warn("Team API error:", data);
    return;
  }

  if (totalEl) totalEl.textContent = data.total ?? 0;
  if (bonusEl) bonusEl.textContent = money(data.bonus ?? 0);

  if (!listEl) return;

  const rows = data.referrals || [];
  if (rows.length === 0) {
    listEl.innerHTML = `
      <div class="empty">
        <div class="empty-title">No referrals yet</div>
        <div class="empty-sub">Share your referral link to start earning 10% bonus.</div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = rows.map(r => `
    <div class="item">
      <div class="item-left">
        <div class="item-title">${r.email}</div>
        <div class="item-sub">
          Joined: <b>${r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</b>
          • Invested: <b>${money(r.total_invested || 0)}</b>
        </div>
      </div>
      <div class="badge active">joined</div>
    </div>
  `).join("");
})();
