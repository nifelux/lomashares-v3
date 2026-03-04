import "./config.js";
import "./supabase.js";
import "./ui.js";
import "./auth-guard.js";
import "./auth.js";

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
  // 200% total return over 30 days
  const total = price * 2;
  return Math.round((total / 30) * 100) / 100;
}

function mountNav(){
  const page = "investment.html";
  const nav = document.getElementById("bottomNav");
  if(nav){
    nav.innerHTML = `
      <a href="dashboard.html">${svgHome()}Home</a>
      <a href="investment.html" class="active">${svgInvest()}Invest</a>
      <a href="team.html">${svgTeam()}Team</a>
      <a href="profile.html">${svgProfile()}Profile</a>
    `;
  }
}

async function token(){
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token || null;
}

function renderProducts(){
  const grid = document.getElementById("productsGrid");
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
          <button class="btn primary" data-invest="${p.id}">Invest</button>
          <a class="btn ghost" href="deposit.html">Deposit</a>
        </div>
      </div>
    `;
  }).join("");

  grid.querySelectorAll("[data-invest]").forEach(btn=>{
    btn.addEventListener("click", ()=> startInvest(Number(btn.dataset.invest)));
  });
}

function renderActive(list){
  const el = document.getElementById("activeList");
  if(!el) return;

  if(!list || list.length === 0){
    el.innerHTML = `
      <div class="item">
        <div>
          <div style="font-weight:950">No active investment yet</div>
          <div class="muted">Choose a plan below to start earning daily.</div>
        </div>
        <div class="badge">idle</div>
      </div>
    `;
    return;
  }

  el.innerHTML = list.map(inv=>{
    return `
      <div class="item">
        <div>
          <div style="font-weight:950">Plan ${inv.product_id} • ${money(inv.amount)}</div>
          <div class="muted">Daily: <b>${money(inv.daily_income)}</b> • Days: <b>${inv.days}</b> • Paid: <b>${inv.paid_days}</b></div>
        </div>
        <div class="badge ${String(inv.status).toLowerCase()}">${String(inv.status).toLowerCase()}</div>
      </div>
    `;
  }).join("");
}

async function loadActive(){
  const t = await token();
  if(!t) return renderActive([]);

  const res = await fetch("/api/investment", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${t}` },
    body: JSON.stringify({ action:"list", status:"active" })
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok || !data.ok) return renderActive([]);
  renderActive(data.investments || []);
}

async function startInvest(planId){
  const t = await token();
  if(!t) return toast("Please login again");

  toast("Processing investment…");
  const res = await fetch("/api/investment", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${t}` },
    body: JSON.stringify({ action:"create", plan_id: planId })
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok || !data.ok) return toast(data.error || "Investment failed");

  toast("Investment successful!");
  await loadActive();
}

mountNav();
renderProducts();
loadActive();
