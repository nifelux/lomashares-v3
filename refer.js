import "./config.js";
import "./supabase.js";
import "./ui.js";
import "./auth-guard.js";

const sb = window.lomaSupabase;
const { toast, svgHome, svgInvest, svgTeam, svgProfile } = window.LomaUI;

function mountNav(){
  const nav = document.getElementById("bottomNav");
  nav.innerHTML = `
    <a href="dashboard.html">${svgHome()}Home</a>
    <a href="investment.html">${svgInvest()}Invest</a>
    <a href="team.html">${svgTeam()}Team</a>
    <a href="profile.html">${svgProfile()}Profile</a>
  `;
}

async function loadReferral(){
  const el = document.getElementById("refCode");
  const { data: { user } } = await sb.auth.getUser();
  if(!user) return (el.textContent = "Not logged in");

  // Try profiles table (recommended)
  const { data, error } = await sb.from("profiles").select("referral_code").eq("id", user.id).single();
  if(error || !data?.referral_code){
    el.textContent = "LOMA000000";
    return;
  }
  el.textContent = data.referral_code;

  document.getElementById("copyBtn").onclick = async () => {
    try{
      await navigator.clipboard.writeText(data.referral_code);
      toast("Copied!");
    }catch{
      toast("Copy failed. Long-press to copy.");
    }
  };
}

mountNav();
loadReferral();
