import "./config.js";
import "./supabase.js";
import "./ui.js";
import "./auth-guard.js";

const sb = window.lomaSupabase;
const { toast, svgHome, svgInvest, svgTeam, svgProfile } = window.LomaUI;

async function token(){
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token || null;
}

function mountNav(){
  const page = "deposit.html";
  const nav = document.getElementById("bottomNav");
  nav.innerHTML = `
    <a href="dashboard.html" class="${page==='dashboard.html'?'active':''}">${svgHome()}Home</a>
    <a href="investment.html">${svgInvest()}Invest</a>
    <a href="team.html">${svgTeam()}Team</a>
    <a href="profile.html">${svgProfile()}Profile</a>
  `;
}

function qs(name){
  return new URLSearchParams(location.search).get(name);
}

async function verifyIfReturned(){
  const ref = qs("ref");
  if(!ref) return;

  const status = document.getElementById("statusLine");
  status.textContent = "Verifying payment…";

  const t = await token();
  if(!t) return toast("Please login again");

  const res = await fetch("/api/wallet", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${t}` },
    body: JSON.stringify({ action:"paystack_verify", reference: ref })
  });

  const data = await res.json().catch(()=>({}));
  if(!res.ok || !data.ok){
    status.textContent = "";
    return toast(data.error || "Verification failed");
  }

  toast("Deposit successful!");
  status.textContent = "Wallet credited successfully.";
  setTimeout(()=>location.replace("dashboard.html"), 900);
}

function wireQuickButtons(){
  const input = document.getElementById("amount");
  document.querySelectorAll("[data-a]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      input.value = btn.dataset.a;
      input.focus();
    });
  });
}

async function startPaystack(){
  const input = document.getElementById("amount");
  const amount = Number(String(input.value || "").replace(/[, ]+/g,""));
  if(!amount || amount < 1000) return toast("Minimum deposit is ₦1,000");

  const t = await token();
  if(!t) return toast("Please login again");

  toast("Connecting to Paystack…");

  const res = await fetch("/api/wallet", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${t}` },
    body: JSON.stringify({ action:"paystack_init", amount })
  });

  const data = await res.json().catch(()=>({}));
  if(!res.ok || !data.ok) return toast(data.error || "Paystack init failed");

  // Redirect to hosted Paystack checkout
  location.href = data.authorization_url;
}

mountNav();
wireQuickButtons();
document.getElementById("payBtn").addEventListener("click", startPaystack);
verifyIfReturned();
