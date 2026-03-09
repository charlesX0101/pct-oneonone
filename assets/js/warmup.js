(() => {
  const VIP_KEY = "oneonone_vip_unlocked";
  const SESSION_HINT_KEY = "oneonone_session_space_hint";

  const SIGNIN_URL =
    "https://accounts.google.com/v3/signin/identifier?continue=https%3A%2F%2Fclassroom.google.com&passive=true&flowName=GlifWebSignIn&flowEntry=ServiceLogin";

  const CONSOLE_URL = "/console/#studio";

  const WINDOW_NAME = "SESSION_SPACE";
  const WINDOW_FEATURES =
    "popup=yes,width=980,height=680,left=120,top=90,resizable=yes,scrollbars=yes";

  // Guard: must be unlocked
  if (localStorage.getItem(VIP_KEY) !== "1") {
    window.location.replace("/");
    return;
  }

  const statusEl = document.getElementById("warmup-status");
  const loginWrap = document.getElementById("warmup-login");
  const loginLink = document.getElementById("session-login");

  // Never trap user if markup changes
  if (!statusEl) {
    window.location.replace(CONSOLE_URL);
    return;
  }

  function setStatus(txt) {
    statusEl.textContent = txt;
  }

  function showLogin() {
    if (!loginWrap || !loginLink) return;
    loginWrap.hidden = false;
    loginWrap.classList.add("is-ready");
    loginLink.classList.add("is-nudging");
  }

  function hideLogin() {
    if (!loginWrap || !loginLink) return;
    loginLink.classList.remove("is-nudging");
    loginWrap.hidden = true;
  }

  const hasHint = localStorage.getItem(SESSION_HINT_KEY) === "1";

  // Boot feel: progress first
  setStatus("Initializing studio environment...");
  setTimeout(() => setStatus("Checking Session Space sign-in..."), 650);

  // If they've already performed the sign-in ritual on this device, proceed quietly.
  if (hasHint) {
    setTimeout(() => {
      setStatus("Session Space ready. Launching console...");
      setTimeout(() => window.location.replace(CONSOLE_URL), 250);
    }, 1150);
    return;
  }

  // Otherwise reveal the link after the boot beat
  setTimeout(() => {
    setStatus("Session Space sign-in required.");
    showLogin();
  }, 1150);

  if (loginLink) {
    loginLink.addEventListener("click", (e) => {
      e.preventDefault();

      loginLink.classList.remove("is-nudging");
      setStatus("Opening Session Space sign-in...");

      const w = window.open(SIGNIN_URL, WINDOW_NAME, WINDOW_FEATURES);

      if (!w) {
        setStatus("Pop-up blocked. Allow pop-ups, then click again.");
        showLogin();
        return;
      }

      // Remember that they performed the sign-in ritual (we cannot truly detect Google auth state)
      localStorage.setItem(SESSION_HINT_KEY, "1");

      hideLogin();

      // Short beat so it feels intentional, but not long enough to feel broken.
      setStatus("Launching console...");
      setTimeout(() => {
        window.location.replace(CONSOLE_URL);
      }, 450);
    });
  }
})();
