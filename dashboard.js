import "./config.js";
import "./supabase.js";
import "./ui.js";
import "./auth-guard.js";

const sb = window.lomaSupabase;
const { money, toast, svgHome, svgInvest, svgTeam, svgProfile } = window.LomaUI;

const PRODUCTS = [
  { id: 1, price: 3000 },
  { id: 2, price: 5000 },
  { id: 3, price: 10000 },
  { id: 4, price: 30000 },
  { id: 5, price: 100000 },
  { id: 6, price: 200000 },
  { id: 7, price: 300000 },
  { id: 8, price: 400000 },
  { id: 9, price: 500000 },
  { id: 10, price: 1000000 },
];

function dailyFromPrice(price){
  const total = price * 2;            // 200% total return
  return Math.round((total / 30) * 100) / 100; // per day
}

async function token(){
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token || null;
}

function mountNav(){
  const nav = document.getElementById("bottomNav");
  nav.innerHTML = `
    <a class="active" href="dashboard.html">${svgHome()}Home</a>
    <a href="investment.html">${svgInvest()}Invest</a>
    <a href="team.html">${svgTeam()}Team</a>
    <a href="profile.html">${svgProfile()}Profile</a>
  `;
}

function renderProducts(){
  const grid = document.getElementById("products");
  if(!grid) return;

  grid.innerHTML = PRODUCTS.map(p=>{
    const daily = dailyFromPrice(p.price);
    return `
      <div class="product">
        <div class="top">
          <div style="font-weight:950">Plan ${p.id}</div>
          <div class="pill">30 Days • 200%</div>
        </div>
        <div class="amt">${money(p.price)}</div>
        <div class="meta">
          <div><div class="muted">Daily Income</div><div style="font-weight:950">${money(daily)}</div></div>
          <div><div class="muted">Total Return</div><div style="font-weight:950">${money(p.price*2)}</div></div>
        </div>
        <div class="actions">
          <a class="btn primary" href="investment.html">View & Invest</a>
          <a class="btn ghost" href="deposit.html">Deposit</a>
        </div>
      </div>
    `;
  }).join("");
}

async function loadUserLine(){
  const emailLine = document.getElementById("emailLine");
  const { data: { user } } = await sb.auth.getUser();
  if(!user) return (emailLine.textContent = "Not logged in");
  emailLine.textContent = user.email;
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

mountNav();
renderProducts();
loadUserLine();
loadBalance();
