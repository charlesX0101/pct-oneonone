// console.js (DROP-IN) — RECOVERY STABLE + BUILT-IN METRONOME
// Owns ONLY: console behavior (transport, timers/meters, popup window manager + tool popups).
// Does NOT own: gate/warmup logic (app.js owns that).
//
// RECOVERY NOTE:
// - Gear + Learn are temporarily left to their inline onclick handlers in console.njk
// - This avoids takeover conflicts while restoring stability
// - Session tools still use JS popup reuse logic
// - Built-in metronome is now owned here

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const consoleRoot = $("#console-app") || $(".console");
  if (!consoleRoot) return;

  if (consoleRoot.dataset.consoleBooted === "1") return;
  consoleRoot.dataset.consoleBooted = "1";

  const URLS = {
    classroomLogin:
      "https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fclassroom.google.com&passive=true",
    meet: "https://meet.google.com/tmo-zyav-cgh?hs=122",
    keepLogin:
      "https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fkeep.google.com%2F&passive=true",
    click: "https://share.google/xZVhIRMFgr0uIiWeC",
    tuner: "https://share.google/nflTf5zhVadfn6e9R",
  };

  const KEYS = {
    layout: "consoleLayout",
    gearCollapsed: "gearCollapsed",
    transportColor: "transportColor",
  };

  const readLS = (k, fallback = null) => {
    try {
      const v = localStorage.getItem(k);
      return v === null ? fallback : v;
    } catch {
      return fallback;
    }
  };

  const writeLS = (k, v) => {
    try {
      localStorage.setItem(k, String(v));
    } catch {}
  };

  const winMap = new Map();

  function calcCentered(w, h) {
    const dualScreenLeft = window.screenLeft ?? window.screenX ?? 0;
    const dualScreenTop = window.screenTop ?? window.screenY ?? 0;
    const width = window.innerWidth ?? document.documentElement.clientWidth ?? screen.width;
    const height = window.innerHeight ?? document.documentElement.clientHeight ?? screen.height;

    const left = Math.max(0, Math.floor((width - w) / 2 + dualScreenLeft));
    const top = Math.max(0, Math.floor((height - h) / 2 + dualScreenTop));
    return { left, top };
  }

  function forceFront(win) {
    if (!win || win.closed) return;

    try {
      win.focus();
    } catch {}

    setTimeout(() => {
      try {
        if (!win.closed) win.focus();
      } catch {}
    }, 60);

    requestAnimationFrame(() => {
      try {
        if (!win.closed) win.focus();
      } catch {}
    });
  }

  function openOrReuse(url, key, opts = {}) {
    if (!url) return null;

    const { name = key, w = 1200, h = 900, resizable = true, scrollbars = true } = opts;

    const existing = winMap.get(key);
    const alive = existing && !existing.closed;

    const { left, top } = calcCentered(w, h);

    const features = [
      `width=${w}`,
      `height=${h}`,
      `left=${left}`,
      `top=${top}`,
      `resizable=${resizable ? "yes" : "no"}`,
      `scrollbars=${scrollbars ? "yes" : "no"}`,
      "popup=yes",
    ].join(",");

    if (alive) {
      try {
        existing.location.href = url;
        forceFront(existing);
        return existing;
      } catch {
        // Cross-origin edge cases — fall through to open fresh
      }
    }

    const win = window.open(url, name, features);
    if (!win) {
      console.warn("Pop-up blocked for:", key, url);
      return null;
    }

    winMap.set(key, win);
    forceFront(win);
    return win;
  }

  function takeoverButton(el, handler) {
    if (!el) return;

    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handler(e);
    });
  }

  function setupTopClock() {
    const dateEl = $("#top-date");
    const timeEl = $("#top-time");
    if (!dateEl && !timeEl) return;

    const tick = () => {
      const d = new Date();

      const dateStr = d
        .toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "2-digit",
          year: "numeric",
        })
        .toUpperCase();

      const timeStr = d.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      if (dateEl) dateEl.textContent = dateStr;
      if (timeEl) timeEl.textContent = timeStr;
    };

    tick();
    setInterval(tick, 1000);
  }

  function setupUptime() {
    const el = $("#console-uptime");
    if (!el) return;

    const pad2 = (n) => String(n).padStart(2, "0");
    const format = (ms) => {
      const total = Math.floor(ms / 1000);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
    };

    const bootAt = performance.now();
    const tick = () => {
      el.textContent = format(performance.now() - bootAt);
    };

    tick();
    setInterval(tick, 250);
  }

  function setupPracticeTimer() {
    const readout = $("#practice-timer");
    const startBtn = $("#timer-start");
    const resetBtn = $("#timer-reset");
    if (!readout || !startBtn || !resetBtn) return;

    const pad2 = (n) => String(n).padStart(2, "0");
    const formatMS = (ms) => {
      const total = Math.floor(ms / 1000);
      const m = Math.floor(total / 60);
      const s = total % 60;
      return `${pad2(m)}:${pad2(s)}`;
    };

    let running = false;
    let startAt = 0;
    let accum = 0;
    let raf = 0;

    const setStartLabel = () => {
      startBtn.textContent = running ? "PAUSE" : accum > 0 ? "RESUME" : "START";
    };

    const render = () => {
      const now = performance.now();
      const elapsed = running ? accum + (now - startAt) : accum;
      readout.textContent = formatMS(elapsed);
    };

    const loop = () => {
      render();
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (running) return;
      running = true;
      startAt = performance.now();
      setStartLabel();
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const pause = () => {
      if (!running) return;
      running = false;
      accum += performance.now() - startAt;
      setStartLabel();
      render();
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const reset = () => {
      running = false;
      startAt = 0;
      accum = 0;
      setStartLabel();
      readout.textContent = "00:00";
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    startBtn.addEventListener("click", () => {
      if (running) pause();
      else start();
    });

    resetBtn.addEventListener("click", reset);

    readout.textContent = "00:00";
    setStartLabel();
  }

  function setupBoardLearnCycle() {
    const boardBtn = $("#toggle-board");
    const boardPanel = $("#board-panel");
    const learnPanel = $("#learn-panel");
    if (!boardBtn) return;

    const hasLearn = !!learnPanel;

    const clampState = (n) => {
      const v = Number(n);
      return Number.isFinite(v) ? ((v % 4) + 4) % 4 : 0;
    };

    let state = clampState(readLS(KEYS.layout, "0"));

    const showEl = (el) => el && el.removeAttribute("hidden");
    const hideEl = (el) => el && el.setAttribute("hidden", "");

    const apply = () => {
      if (!hasLearn) {
        const boardHidden = state === 3 || state === 1;
        boardHidden ? hideEl(boardPanel) : showEl(boardPanel);
        writeLS(KEYS.layout, state);
        return;
      }

      const boardVisible = state === 0 || state === 2;
      const learnVisible = state === 0 || state === 1;

      boardVisible ? showEl(boardPanel) : hideEl(boardPanel);
      learnVisible ? showEl(learnPanel) : hideEl(learnPanel);

      writeLS(KEYS.layout, state);
    };

    boardBtn.addEventListener("click", () => {
      state = (state + 1) % 4;
      apply();
    });

    apply();
  }

  function setupGearDrawer() {
    const gearBtn = $("#toggle-gear");
    const gearPanel = $("#gear-panel");
    const grid = $(".console-grid");
    if (!gearBtn || !gearPanel || !grid) return;

    let collapsed = readLS(KEYS.gearCollapsed, "0") === "1";

    const showGear = () => gearPanel.removeAttribute("hidden");
    const hideGear = () => gearPanel.setAttribute("hidden", "");

    const isThreeColLayout = () => {
      const right = $(".right");
      if (!right) return false;
      const cs = getComputedStyle(right);
      return cs.display !== "none";
    };

    const apply = () => {
      if (collapsed) {
        consoleRoot.classList.add("is-gear-collapsed");
        hideGear();

        if (isThreeColLayout()) {
          grid.style.gridTemplateColumns = "0px 1fr 300px";
          grid.style.columnGap = "0px";
        } else {
          grid.style.gridTemplateColumns = "";
          grid.style.columnGap = "";
        }
      } else {
        consoleRoot.classList.remove("is-gear-collapsed");
        showGear();
        grid.style.gridTemplateColumns = "";
        grid.style.columnGap = "";
      }

      writeLS(KEYS.gearCollapsed, collapsed ? "1" : "0");
    };

    gearBtn.addEventListener("click", () => {
      collapsed = !collapsed;
      apply();
    });

    window.addEventListener("resize", apply);
    apply();
  }

  function setupTransportLeds() {
    const ledBtns = $$(".led-btn");
    if (!ledBtns.length) return;

    const COLORS = {
      blue: "#4fb0ff",
      green: "#4cd964",
      purple: "#a86bff",
    };

    const hexToRgba = (hex, a) => {
      const h = (hex || "").replace("#", "").trim();
      if (h.length !== 6) return `rgba(79,176,255,${a})`;
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${a})`;
    };

    const setColor = (name) => {
      const hex = COLORS[name] || COLORS.blue;

      document.documentElement.style.setProperty("--logic-blue", hex);
      document.documentElement.style.setProperty("--logic-blue-dim", hexToRgba(hex, 0.55));

      ledBtns.forEach((b) => {
        const n = (b.dataset.transportColor || "").toLowerCase();
        const on = n === name;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });

      writeLS(KEYS.transportColor, name);
    };

    ledBtns.forEach((btn) => {
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", () => {
        const name = (btn.dataset.transportColor || "blue").toLowerCase();
        setColor(name);
      });
    });

    const saved = (readLS(KEYS.transportColor, "blue") || "blue").toLowerCase();
    setColor(saved in COLORS ? saved : "blue");
  }

  function setupMeters() {
    const meters = $$(".meter");
    if (!meters.length) return;

    meters.forEach((m) => {
      m.style.animation = "none";
      m.style.willChange = "transform,opacity";
      m.style.transformOrigin = "bottom";
      m.style.transform = "scaleY(0.25)";
      m.style.opacity = "0.75";
    });

    const N = meters.length;
    const v = new Array(N).fill(0.18);
    const t = new Array(N).fill(0.25);
    const bias = new Array(N).fill(0).map(() => 0.12 + Math.random() * 0.22);
    const jitter = new Array(N).fill(0).map(() => 0.35 + Math.random() * 0.65);

    const randTarget = () => {
      for (let i = 0; i < N; i++) {
        const base = bias[i] + Math.random() * jitter[i];
        const spike = Math.random() < 0.12 ? 0.55 + Math.random() * 0.45 : 0;
        t[i] = Math.min(1, base + spike);
      }
    };

    randTarget();
    const tgtTimer = setInterval(randTarget, 160);

    let raf = 0;
    let last = performance.now();

    const tick = (now) => {
      const dt = Math.min(50, now - last);
      last = now;

      const attack = 1 - Math.pow(0.10, dt / 16.7);
      const decay = 1 - Math.pow(0.75, dt / 16.7);

      for (let i = 0; i < N; i++) {
        const cur = v[i];
        const tar = t[i];

        const next = tar > cur
          ? cur + (tar - cur) * attack
          : cur - (cur - tar) * decay;

        v[i] = next;

        const s = 0.15 + next * 2.15;
        meters[i].style.transform = `scaleY(${s.toFixed(3)})`;

        const op = 0.55 + next * 0.45;
        meters[i].style.opacity = op.toFixed(3);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    });

    window.addEventListener("beforeunload", () => {
      clearInterval(tgtTimer);
      if (raf) cancelAnimationFrame(raf);
    });
  }

  function setupSessionTools() {
    const classroom = $("#tool-classroom");
    const meet = $("#tool-meet");
    const keep = $("#tool-keep");
    const tuner = $("#tool-tuner");

    if (classroom) {
      takeoverButton(classroom, () => {
        openOrReuse(URLS.classroomLogin, "classroom", {
          name: "CLASSROOM",
          w: 1200,
          h: 860,
        });
      });
    }

    if (meet) {
      takeoverButton(meet, () => {
        openOrReuse(URLS.meet, "meet", {
          name: "MEET",
          w: 1200,
          h: 860,
        });
      });
    }

    if (keep) {
      takeoverButton(keep, () => {
        openOrReuse(URLS.keepLogin, "keep", {
          name: "KEEP",
          w: 1200,
          h: 860,
        });
      });
    }

    if (tuner) {
      takeoverButton(tuner, () => {
        openOrReuse(URLS.tuner, "tuner", {
          name: "TUNER",
          w: 980,
          h: 760,
        });
      });
    }
  }

  function setupSignIn() {
    const signIn = $("#sign-in");
    if (!signIn) return;

    takeoverButton(signIn, () => {
      openOrReuse(URLS.classroomLogin, "classroom", {
        name: "CLASSROOM",
        w: 1200,
        h: 860,
      });
    });
  }

  function setupTransportTools() {
    const clickBtn = $("#tool-click");
    const tunerBtn = $("#tool-tuner-transport");

    if (clickBtn) {
      takeoverButton(clickBtn, () => {
        openOrReuse(URLS.click, "click", {
          name: "CLICK",
          w: 980,
          h: 760,
        });
      });
    }

    if (tunerBtn) {
      takeoverButton(tunerBtn, () => {
        openOrReuse(URLS.tuner, "tuner", {
          name: "TUNER",
          w: 980,
          h: 760,
        });
      });
    }
  }

  function setupMetronome() {
  const bpmDisplay = $(".metronome-bpm");
  const timeSigDisplay = $(".metronome-timesig");
  const modeDisplay = $(".metronome-mode");
  const led = $(".metronome-led");

  const startBtn = $("#metronome-start");
  const bpmDownBtn = $("#metronome-bpm-down");
  const bpmUpBtn = $("#metronome-bpm-up");
  const tapBtn = $("#metronome-tap");
  const tsBtn = $("#metronome-timesig-select");
  const modeBtn = $("#metronome-mode-select");

  if (!bpmDisplay || !timeSigDisplay || !modeDisplay || !led) return;
  if (!startBtn || !bpmDownBtn || !bpmUpBtn || !tapBtn || !tsBtn || !modeBtn) return;

  const AUDIO_PATHS = {
    accent: "/assets/audio/metronome-accent.wav",
    regular: "/assets/audio/metronome-regular.wav",
  };

  const TIME_SIGNATURES = ["4/4", "3/4", "6/8"];
  const MODES = ["REG", "BB", "HALF"];

  const LOOKAHEAD_MS = 25;
  const SCHEDULE_AHEAD_SEC = 0.1;
  const MIN_BPM = 30;
  const MAX_BPM = 260;
  const TAP_RESET_MS = 2000;
  const MAX_TAPS = 4;

  let bpm = 100;
  let timeSigIndex = 0;
  let modeIndex = 0;

  let audioCtx = null;
  let accentBuffer = null;
  let regularBuffer = null;
  let audioInitPromise = null;

  let isRunning = false;
  let schedulerTimer = 0;
  let nextNoteTime = 0;
  let currentBeat = 0;

  let tapTimes = [];
  let ledPulseToken = 0;

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  function updateDisplay() {
    bpmDisplay.textContent = String(bpm).padStart(3, "0");
    timeSigDisplay.textContent = TIME_SIGNATURES[timeSigIndex];
    modeDisplay.textContent = MODES[modeIndex];
    startBtn.textContent = isRunning ? "STOP" : "START";
    startBtn.classList.toggle("is-running", isRunning);
    startBtn.setAttribute("aria-pressed", isRunning ? "true" : "false");
  }

  function getBeatsPerBar() {
    const ts = TIME_SIGNATURES[timeSigIndex];
    if (ts === "4/4") return 4;
    if (ts === "3/4") return 3;
    if (ts === "6/8") return 6;
    return 4;
  }

  function getBeatAction(beatIndex) {
    const mode = MODES[modeIndex];

    if (mode === "REG") {
      return beatIndex === 0 ? "accent" : "regular";
    }

    if (mode === "BB") {
      const ts = TIME_SIGNATURES[timeSigIndex];

      if (ts === "4/4") {
        return beatIndex === 1 || beatIndex === 3 ? "accent" : "skip";
      }

      if (ts === "3/4") {
        return beatIndex === 1 ? "accent" : "skip";
      }

      if (ts === "6/8") {
        return beatIndex === 3 ? "accent" : "skip";
      }

      return "skip";
    }

    if (mode === "HALF") {
      return beatIndex === 0 ? "accent" : "skip";
    }

    return "regular";
  }

  async function loadSample(url) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to load sample: ${url}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return await audioCtx.decodeAudioData(arrayBuffer);
  }

  async function initAudio() {
    if (audioInitPromise) {
      await audioInitPromise;
      return;
    }

    audioInitPromise = (async () => {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      const [accent, regular] = await Promise.all([
        loadSample(AUDIO_PATHS.accent),
        loadSample(AUDIO_PATHS.regular),
      ]);

      accentBuffer = accent;
      regularBuffer = regular;
    })();

    try {
      await audioInitPromise;
    } catch (err) {
      audioInitPromise = null;
      console.error("Metronome audio init failed:", err);
      throw err;
    }
  }

  function pulseLED(accent, whenAudioTime) {
    if (!audioCtx || !led) return;

    const msUntilPulse = Math.max(0, (whenAudioTime - audioCtx.currentTime) * 1000);
    const token = ++ledPulseToken;

    window.setTimeout(() => {
      if (token !== ledPulseToken) return;

      led.style.transition = "transform 70ms ease, opacity 70ms ease, filter 70ms ease";
      led.style.opacity = "1";
      led.style.transform = accent ? "scale(1.75)" : "scale(1.28)";
      led.style.filter = accent ? "brightness(1.45)" : "brightness(1.15)";

      window.setTimeout(() => {
        if (token !== ledPulseToken) return;
        led.style.opacity = ".95";
        led.style.transform = "scale(1)";
        led.style.filter = "brightness(1)";
      }, 85);
    }, msUntilPulse);
  }

  function playBuffer(buffer, when) {
    if (!audioCtx || !buffer) return;

    const src = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();

    gain.gain.setValueAtTime(1, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);

    src.buffer = buffer;
    src.connect(gain);
    gain.connect(audioCtx.destination);
    src.start(when);
    src.stop(when + Math.min(buffer.duration + 0.05, 0.2));
  }

  function scheduleBeat(when) {
    const action = getBeatAction(currentBeat);

    if (action === "accent") {
      playBuffer(accentBuffer, when);
      pulseLED(true, when);
    } else if (action === "regular") {
      playBuffer(regularBuffer, when);
      pulseLED(false, when);
    }

    const secondsPerBeat = 60 / bpm;
    nextNoteTime += secondsPerBeat;
    currentBeat += 1;

    if (currentBeat >= getBeatsPerBar()) {
      currentBeat = 0;
    }
  }

  function scheduler() {
    if (!audioCtx || !isRunning) return;

    while (nextNoteTime < audioCtx.currentTime + SCHEDULE_AHEAD_SEC) {
      scheduleBeat(nextNoteTime);
    }
  }

  function resetTransportPhase() {
    if (!audioCtx) return;
    currentBeat = 0;
    nextNoteTime = audioCtx.currentTime + 0.05;
  }

  async function startMetronome() {
    try {
      await initAudio();

      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      resetTransportPhase();

      if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = 0;
      }

      schedulerTimer = window.setInterval(scheduler, LOOKAHEAD_MS);
      isRunning = true;
      updateDisplay();
    } catch (err) {
      console.error("Unable to start metronome:", err);
    }
  }

  function stopMetronome() {
    if (schedulerTimer) {
      clearInterval(schedulerTimer);
      schedulerTimer = 0;
    }

    isRunning = false;
    ledPulseToken += 1;
    led.style.opacity = ".95";
    led.style.transform = "scale(1)";
    led.style.filter = "brightness(1)";
    updateDisplay();
  }

  async function onTapTempo() {
    try {
      await initAudio();

      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }
    } catch (err) {
      console.error("Unable to init metronome audio for tap tempo:", err);
    }

    const now = performance.now();

    if (tapTimes.length && now - tapTimes[tapTimes.length - 1] > TAP_RESET_MS) {
      tapTimes = [];
    }

    tapTimes.push(now);

    if (tapTimes.length > MAX_TAPS) {
      tapTimes.shift();
    }

    if (tapTimes.length < 2) return;

    const intervals = [];
    for (let i = 1; i < tapTimes.length; i += 1) {
      intervals.push(tapTimes[i] - tapTimes[i - 1]);
    }

    const avg = intervals.reduce((sum, n) => sum + n, 0) / intervals.length;
    const nextBpm = clamp(Math.round(60000 / avg), MIN_BPM, MAX_BPM);

    bpm = nextBpm;
    updateDisplay();

    if (isRunning && audioCtx) {
      resetTransportPhase();
    }
  }

  function cycleTimeSignature() {
    timeSigIndex = (timeSigIndex + 1) % TIME_SIGNATURES.length;
    updateDisplay();

    if (isRunning && audioCtx) {
      resetTransportPhase();
    }
  }

  function cycleMode() {
    modeIndex = (modeIndex + 1) % MODES.length;
    updateDisplay();

    if (isRunning && audioCtx) {
      resetTransportPhase();
    }
  }

  startBtn.addEventListener("click", () => {
    if (isRunning) stopMetronome();
    else startMetronome();
  });

  bpmDownBtn.addEventListener("click", () => {
    bpm = clamp(bpm - 1, MIN_BPM, MAX_BPM);
    updateDisplay();

    if (isRunning && audioCtx) {
      resetTransportPhase();
    }
  });

  bpmUpBtn.addEventListener("click", () => {
    bpm = clamp(bpm + 1, MIN_BPM, MAX_BPM);
    updateDisplay();

    if (isRunning && audioCtx) {
      resetTransportPhase();
    }
  });

  tapBtn.addEventListener("click", onTapTempo);
  tsBtn.addEventListener("click", cycleTimeSignature);
  modeBtn.addEventListener("click", cycleMode);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && isRunning) {
      stopMetronome();
    }
  });

  window.addEventListener("beforeunload", () => {
    if (schedulerTimer) {
      clearInterval(schedulerTimer);
    }
    if (audioCtx && audioCtx.state !== "closed") {
      audioCtx.close().catch(() => {});
    }
  });

  updateDisplay();
}

  function boot() {
    const hb = $("#handle-board");
    const hl = $("#handle-learn");
    if (hb) hb.setAttribute("hidden", "");
    if (hl) hl.setAttribute("hidden", "");

    setupTopClock();
    setupUptime();
    setupPracticeTimer();

    setupBoardLearnCycle();
    setupGearDrawer();
    setupTransportLeds();
    setupMeters();

    // Recovery mode:
    // Gear + Learn stay on inline onclick in console.njk for now

    setupSessionTools();
    setupSignIn();
    setupTransportTools();
    setupMetronome();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
