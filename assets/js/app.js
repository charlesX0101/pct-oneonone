// app.js (DROP-IN) — CLEAN OWNERSHIP
// Owns ONLY: VIP gate unlock + warmup/console access guard + lock (logout).
// Does NOT own: console UI behavior (clocks/meters/ticker/nav/routing) — that belongs in console.js.

(() => {
  const UNLOCK_KEY = "oneonone_vip_unlocked";

  // Keep warmup in the flow (post-gate), but app.js does NOT implement any popup/sign-in ritual.
  const WARMUP_PATH = "/warmup/"; // change if your warmup permalink differs
  const GATE_PATH = "/";          // your gate/home page
  const CONSOLE_ROOT_SELECTOR = "#console-app";
  const WARMUP_ROOT_SELECTOR = ".warmup";

  document.addEventListener("DOMContentLoaded", () => {
    setupGate();
    setupAccessGuard();
    setupLock();
  });

  // ---------------------------
  // UNLOCK HELPERS
  // ---------------------------
  function isUnlocked() {
    return localStorage.getItem(UNLOCK_KEY) === "1";
  }

  function setUnlocked() {
    localStorage.setItem(UNLOCK_KEY, "1");
  }

  function clearUnlocked() {
    localStorage.removeItem(UNLOCK_KEY);
  }

  // ---------------------------
  // GATE (PASSWORD)
  // ---------------------------
  function setupGate() {
    const form = document.querySelector(".gate-form");
    if (!form) return;

    // Already unlocked? skip gate
    if (isUnlocked()) {
      window.location.href = WARMUP_PATH;
      return;
    }

    const input =
      form.querySelector('input[type="password"]') ||
      form.querySelector('input[type="text"]') ||
      form.querySelector("input");

    const errorEl = document.querySelector(".gate-error");

    // Optional: <form class="gate-form" data-gate-code="YOURPASS">
    const expected = (form.dataset.gateCode || "").trim();

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const val = (input?.value || "").trim();

      // If a password is configured, enforce it.
      // If not configured, accept any non-empty code (so it "works" in dev).
      const ok = expected ? val === expected : val.length > 0;

      if (!ok) {
        if (errorEl) errorEl.textContent = "Invalid code.";
        if (input) input.value = "";
        input?.focus();
        return;
      }

      if (errorEl) errorEl.textContent = "";
      setUnlocked();
      window.location.href = WARMUP_PATH;
    });
  }

  // ---------------------------
  // ACCESS GUARD
  // If someone hits /warmup or /console without unlocking, bounce to gate.
  // ---------------------------
  function setupAccessGuard() {
    const onWarmup = document.querySelector(WARMUP_ROOT_SELECTOR);
    const onConsole = document.querySelector(CONSOLE_ROOT_SELECTOR);

    if ((onWarmup || onConsole) && !isUnlocked()) {
      window.location.href = GATE_PATH;
    }
  }

  // ---------------------------
  // LOCK (LOG OUT)
  // This is auth/session ownership (OK for app.js). It does not control console UI.
  // ---------------------------
  function setupLock() {
    // Keep selector as-is to avoid markup changes.
    const btn = document.querySelector(".topbar-lock");
    if (!btn) return;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      clearUnlocked();
      window.location.href = GATE_PATH;
    });
  }
})();
