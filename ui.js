window.LomaUI = {
  money(n){ return "₦" + Number(n || 0).toLocaleString(); },
  toast(msg){
    const el = document.getElementById("notice");
    if(!el) return alert(msg);
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(()=>el.classList.remove("show"), 2500);
  }
};
