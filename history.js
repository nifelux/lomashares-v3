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

function badgeClass(s){
  s = String(s||"").toLowerCase();
  if(s.includes("pending")) return "pending";
  if(s.includes("fail")) return "failed";
  return "success";
}

async function load(){
  const mode = window.HISTORY_MODE || "transactions";
  const t = await token();
  const el = document.getElementById("list");
  if(!t) return (el.textContent = "Please login again.");

  let action = mode;
  const res = await fetch("/api/wallet", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${t}` },
    body: JSON.stringify({ action })
  });
  const data = await res.json().catch(()=>({}));

  if(!res.ok || !data.ok){
    el.textContent = "Unable to load.";
    return;
  }

  const rows =
    mode === "transactions" ? (data.transactions||[]) :
    mode === "deposits" ? (data.deposits||[]) :
    (data.withdrawals||[]);

  if(rows.length === 0){
    el.innerHTML = `<div class="item"><div><div style="font-weight:950">No records yet</div><div class="muted">Your history will appear here.</div></div><div class="badge">empty</div></div>`;
    return;
  }

  el.innerHTML = rows.map(r=>{
    const status = r.status || "success";
    const when = r.created_at ? new Date(r.created_at).toLocaleString() : "";
    const title =
      mode === "transactions" ? (String(r.kind||"").replace(/_/g," ")) :
      mode === "deposits" ? "Deposit" : "Withdrawal";

    const ref =
      mode === "transactions" ? (r.ref||"") :
      mode === "deposits" ? (r.reference||"") : (r.bank_name||"");

    const amt = r.amount ?? 0;

    return `
      <div class="item">
        <div>
          <div style="font-weight:950">${title} • ${money(amt)}</div>
          <div class="muted">${when}${ref ? " • " + ref : ""}</div>
        </div>
        <div class="badge ${badgeClass(status)}">${String(status).toLowerCase()}</div>
      </div>
    `;
  }).join("");
}

mountNav();
load();
