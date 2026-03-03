// team.js
(async function () {
  const sb = window.lomaSupabase;
  if (!sb) return;

  const totalEl = document.getElementById("teamTotal");
  const bonusEl = document.getElementById("teamBonus");
  const listEl  = document.getElementById("teamList");

  const money = (n) => "₦" + Number(n || 0).toLocaleString();

  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;

  const me = session.user.id;

  // referrals table: referrer_id, referred_id, reward_given, created_at
  const { data: refs, error } = await sb
    .from("referrals")
    .select("referred_id, reward_given, created_at")
    .eq("referrer_id", me)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.warn("team.js referrals error:", error);
    if (totalEl) totalEl.textContent = "0";
    if (bonusEl) bonusEl.textContent = money(0);
    return;
  }

  const total = refs?.length || 0;

  // If you record referral bonus in transactions, calculate from there (recommended).
  // For now: reward_given just counts how many got rewarded.
  const rewardedCount = (refs || []).filter(r => r.reward_given).length;

  if (totalEl) totalEl.textContent = total;
  if (bonusEl) bonusEl.textContent = money(0); // Replace when you store bonus amount

  if (!listEl) return;

  if (!refs || refs.length === 0) {
    listEl.innerHTML = `
      <div class="empty">
        <div class="empty-title">No referrals yet</div>
        <div class="empty-sub">Share your link to start earning 10% bonus.</div>
      </div>`;
    return;
  }

  listEl.innerHTML = refs.map(r => `
    <div class="item">
      <div class="item-left">
        <div class="item-title">Referred User</div>
        <div class="item-sub">
          Joined: <b>${new Date(r.created_at).toLocaleDateString()}</b>
          • Reward: <b>${r.reward_given ? "Given" : "Pending"}</b>
        </div>
      </div>
      <div class="badge ${r.reward_given ? "active" : "pending"}">
        ${r.reward_given ? "rewarded" : "pending"}
      </div>
    </div>
  `).join("");
})();
