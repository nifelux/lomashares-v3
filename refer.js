// refer.js
(async function () {
  const sb = window.lomaSupabase;
  if (!sb) return;

  const codeEl = document.getElementById("refCode");
  const linkEl = document.getElementById("refLink");
  const notice = document.getElementById("notice");

  const toast = (msg) => {
    if (!notice) return;
    notice.textContent = msg;
    notice.classList.add("show");
    setTimeout(() => notice.classList.remove("show"), 2400);
  };

  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;

  const { data, error } = await sb
    .from("profiles")
    .select("referral_code")
    .eq("id", session.user.id)
    .single();

  if (error || !data?.referral_code) {
    console.warn("profiles referral_code error:", error);
    toast("Referral code not available.");
    return;
  }

  const code = String(data.referral_code).toUpperCase();
  const link = `${location.origin}/register.html?ref=${encodeURIComponent(code)}`;

  if (codeEl) codeEl.value = code;
  if (linkEl) linkEl.value = link;

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast("Copied!"); }
    catch { toast("Copy failed"); }
  }

  document.getElementById("copyCodeBtn")?.addEventListener("click", () => copyText(code));
  document.getElementById("copyLinkBtn")?.addEventListener("click", () => copyText(link));

  document.getElementById("shareWhatsApp")?.addEventListener("click", () => {
    const msg = encodeURIComponent(`Join LomaShares and earn daily! Use my referral link: ${link}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  });

  document.getElementById("shareTelegram")?.addEventListener("click", () => {
    const msg = encodeURIComponent(`Join LomaShares and earn daily! Use my referral link: ${link}`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${msg}`, "_blank");
  });
})();
