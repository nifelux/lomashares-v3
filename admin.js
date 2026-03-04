import "./config.js";
import "./supabase.js";
import "./ui.js";
import "./auth-guard.js";

const sb = window.lomaSupabase;
const { money, toast, svgHome, svgInvest, svgTeam, svgProfile } = window.LomaUI;

async function token(){
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token || null;
}

function mountNav(){
  const nav = document.getElementById("bottomNav");
  nav.innerHTML = `
    <a href="dashboard.html">${svgHome()}Home</a>
    <a href="investment.html">${svgInvest()}Invest</a>
    <a href="team.html">${svgTeam()}Team</a>
    <a href="profile.html">${svgProfile()}Profile</a>
  `;
}

async function adminSummary(){
  const t = await token();
  if(!t) return toast("Login again");

  const res = await fetch("/api/admin-summary", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${t}` },
    body: JSON.stringify({})
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok || !data.ok) return toast(data.error || "Not admin");

  document.getElementById("dep").textContent = money(data.totalDeposits || 0);
  document.getElementById("wd").textContent = money(data.totalWithdrawals || 0);
}

async function adminWithdrawals(){
  const t = await token();
  const el = document.getElementById("list");
  if(!t) return;

  const res = await fetch("/api/withdraw", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${t}` },
    body: JSON.stringify({ action:"list_pending" })
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok || !data.ok){
    el.textContent = data.error || "Not admin";
    return;
  }

  const rows = data.withdrawals || [];
  if(rows.length === 0){
    el.innerHTML = `<div class="item"><div><div style="font-weight:950">No pending withdrawals</div><div class="muted">All clear.</div></div><div class="badge success">ok</div></div>`;
    return;
  }

  el.innerHTML = rows.map(w=>`
    <div class="item">
      <div>
        <div style="font-weight:950">${money(w.amount)} • ${w.account_name}</div>
        <div class="muted">${w.bank_name} • ${w.account_number}</div>
        <div class="muted">${new Date(w.created_at).toLocaleString()}</div>
      </div>
      <button class="btn primary" data-appr="${w.id}" style="padding:10px 12px">Approve</button>
    </div>
  `).join("");

  el.querySelectorAll("[data-appr]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.dataset.appr;
      btn.disabled = true;
      const r = await fetch("/api/withdraw", {
        method:"POST",
        headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${t}` },
        body: JSON.stringify({ action:"approve", withdrawal_id: id })
      });
      const d = await r.json().catch(()=>({}));
      if(!r.ok || !d.ok){ toast(d.error || "Failed"); btn.disabled=false; return; }
      toast("Approved");
      adminWithdrawals();
    });
  });
}

async function adminGift(){
  const t = await token();
  const out = document.getElementById("out");

  document.getElementById("gen").onclick = async ()=>{
    const amount = Number(document.getElementById("amt").value);
    if(!amount || amount <= 0) return toast("Enter amount");

    const res = await fetch("/api/gift", {
      method:"POST",
      headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${t}` },
      body: JSON.stringify({ action:"generate", amount })
    });
    const data = await res.json().catch(()=>({}));
    if(!res.ok || !data.ok) return toast(data.error || "Not admin");
    out.innerHTML = `<div class="item"><div><div style="font-weight:950">${data.code}</div><div class="muted">Amount: ${money(data.amount)}</div></div><div class="badge success">new</div></div>`;
  };
}

mountNav();
const mode = window.ADMIN_MODE || "summary";
if(mode === "summary") adminSummary();
if(mode === "withdrawals") adminWithdrawals();
if(mode === "gift") adminGift();
