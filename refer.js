// refer.js
(async function () {
  const sb = window.lomaSupabase;
  if (!sb) return;

  const codeEl = document.getElementById("refCode");
  const linkEl = document.getElementById("refLink");

  const copyCodeBtn = document.getElementById("copyCodeBtn");
  const copyLinkBtn = document.getElementById("copyLinkBtn");
  const waBtn = document.getElementById("shareWhatsApp");
  const tgBtn = document.getElementById("shareTelegram");

  const notice = document.getElementById("notice");
  const toast = (msg) => {
    if (!notice) return;
    notice.textContent = msg;
    notice.classList.add("show");
    setTimeout(() => notice.classList.remove("show"), 2400);
  };

  const { data: { session } } = await sb.auth.getSession();
  const token = session?.access_token;
  if (!token) return;

  const res = await fetch("/api/referral?mode=mycode", {
    method: "GET",
    headers: { "Authorization": `Bearer ${token}` }
  });
  const data = await res.json();

  if (!res.ok) {
    console.warn("Referral code API error:", data);
    return;
  }

  const code = data.referral_code || "LOMA000000";
  const link = `${location.origin}/register.html?ref=${encodeURIComponent(code)}`;

  if (codeEl) codeEl.value = code;
  if (linkEl) linkEl.value = link;

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied!");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast("Copied!");
    }
  }

  copyCodeBtn?.addEventListener("click", () => copyText(code));
  copyLinkBtn?.addEventListener("click", () => copyText(link));

  waBtn?.addEventListener("click", () => {
    const msg = encodeURIComponent(`Join LomaShares and earn daily! Use my referral link: ${link}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  });

  tgBtn?.addEventListener("click", () => {
    const msg = encodeURIComponent(`Join LomaShares and earn daily! Use my referral link: ${link}`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${msg}`, "_blank");
  });
})();
