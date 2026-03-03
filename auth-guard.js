// auth-guard.js
(async function () {
  "use strict";

  if (!window.sb) return;

  const { data, error } = await window.sb.auth.getSession();
  if (error) console.warn(error);

  const session = data?.session;
  if (!session) {
    // change this to your login page
    window.location.href = "login.html";
  }
})();
