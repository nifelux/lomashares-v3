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
  const nav = document.getElementById("bottomNav");
  nav.innerHTML = `
    <a href="dashboard.html">${svgHome()}Home</a>
    <a href="investment.html">${svgInvest()}Invest</a>
    <a href="team.html">${svgTeam()}Team</a>
    <a href="profile.html">${svgProfile()}Profile</a>
  `;
}

document.getElementById("redeemBtn").onclick = async () => {
  const code = document.getElementById("giftCode").value.trim().toUpperCase();
  if(!code) return toast("Enter a gift code");

  const t = await token();
  if(!t) return toast("Please login again");

  toast("Redeeming…");
  const res = await fetch("/api/gift", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${t}` },
    body: JSON.stringify({ action:"redeem", code })
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok || !data.ok) return toast(data.error || "Failed");
  toast(`Success! Credited ₦${Number(data.amount).toLocaleString()}`);
};

mountNav();
