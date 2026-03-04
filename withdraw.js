import "./config.js";
import "./supabase.js";
import "./ui.js";
import "./auth-guard.js";

const sb = window.lomaSupabase;
const { toast, money, svgHome, svgInvest, svgTeam, svgProfile } = window.LomaUI;

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

function badgeClass(s){
  s = String(s||"").toLowerCase();
  if(s.includes("pending")) return "pending";
  if(s.includes("fail")) return "failed";
  return "success";
}

async function loadMine(){
  const t = await token();
  const el = document.getElementById("list");
  if(!t) return;

  // uses wallet.js action withdrawals
  const res = await fetch("/api/wallet", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${t}` },
    body: JSON.stringify({ action:"withdrawals" })
  });

  const data = await res.json().catch(()=>({}));
  if(!res.ok || !data.ok){
    el.textContent = "No records yet.";
    return;
  }

  const rows = data.withdrawals || [];
  if(rows.length === 0){
    el.innerHTML = `<div class="item"><div><div style="font-weight:950">No withdrawals yet</div><div class="muted">Your requests show here.</div></div><div class="badge">empty</div></div>`;
    return;
  }

  el.innerHTML = rows.slice(0,6).map(w=>`
    <div class="item">
      <div>
        <div style="font-weight:950">${money(w.amount)} • ${w.bank_name}</div>
        <div class="muted">${w.account_number} • ${w.account_name}</div>
        <div class="muted">${new Date(w.created_at).toLocaleString()}</div>
      </div>
      <div class="badge ${badgeClass(w.status)}">${String(w.status).toLowerCase()}</div>
    </div>
  `).join("");
}

async function requestWithdrawal(){
  const amount = Number(document.getElementById("amount").value);
  const bank_name = document.getElementById("bankName").value.trim();
  const account_number = document.getElementById("acctNo").value.trim();
  const account_name = document.getElementById("acctName").value.trim();

  if(!amount || amount < 500) return toast("Minimum withdrawal is ₦500");
  if(!bank_name || !account_number || !account_name) return toast("Fill bank details");

  const t = await token();
  if(!t) return toast("Please login again");

  toast("Submitting request…");

  const res = await fetch("/api/withdraw", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${t}` },
    body: JSON.stringify({
      action:"request",
      amount,
      bank_name,
      account_number,
      account_name
    })
  });

  const data = await res.json().catch(()=>({}));
  if(!res.ok || !data.ok) return toast(data.error || "Failed");
  toast("Withdrawal requested");
  await loadMine();
}

mountNav();
document.getElementById("wdBtn").addEventListener("click", requestWithdrawal);
loadMine();
