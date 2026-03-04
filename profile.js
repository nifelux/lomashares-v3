import "./config.js";
import "./supabase.js";
import "./ui.js";
import "./auth-guard.js";
import "./auth.js";

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
    <a class="active" href="profile.html">${svgProfile()}Profile</a>
  `;
}

function nameFromEmail(email){
  if(!email) return "User";
  return email.split("@")[0];
}

async function loadProfile(){
  const { data: { user } } = await sb.auth.getUser();
  if(!user) return;

  const email = user.email || "";
  const name = nameFromEmail(email);

  document.getElementById("email").textContent = email;
  document.getElementById("name").textContent = name;

  const initials = (name.slice(0,2) || "LS").toUpperCase();
  document.getElementById("avatar").textContent = initials;
}

async function loadBalance(){
  const t = await token();
  if(!t) return;

  const res = await fetch("/api/wallet", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${t}` },
    body: JSON.stringify({ action:"balance" })
  });

  const data = await res.json().catch(()=>({}));
  if(!res.ok || !data.ok) return toast(data.error || "Failed to load wallet");
  document.getElementById("bal").textContent = money(data.balance || 0);
}

document.getElementById("logoutBtn").addEventListener("click", async ()=>{
  await window.LomaAuth.logout();
});

mountNav();
loadProfile();
loadBalance();
