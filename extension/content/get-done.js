(function () {
  if (!globalThis.GetDone) return;
  if (window.__GET_DONE__) return;
  window.__GET_DONE__ = true;

  const SCRIPT_SRC = document.currentScript ? document.currentScript.src : "";
  const QUESTION_MESSAGE = "get-done";

  const INNER = `
    <section class="panel" role="complementary" aria-label="Get Done rewards">
      <header class="topbar">
        <div class="grip">
          <span class="mark" aria-hidden="true"></span>
          <span class="brand">Get Done</span>
          <span class="pill" hidden></span>
        </div>
        <span class="fraction">0</span>
        <button type="button" class="icon-btn" data-action="minimize" aria-label="Minimize">–</button>
      </header>
      <div class="body">
        <div class="stage" data-view="empty">
          <div class="flash" aria-hidden="true"></div>
          <div class="sparks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
          <img class="photo" alt="" referrerpolicy="no-referrer" />
          <div class="waiting">
            <div class="deck" aria-hidden="true"><span></span><span></span><span></span></div>
            <p class="wait-kicker">Sealed</p>
            <p class="wait-count">0</p>
            <p class="wait-copy"></p>
          </div>
          <div class="empty">
            <p class="empty-title">A picture for every question you finish.</p>
            <p class="empty-copy">Paste one image link per question. Five, ten, or forty-five. The next picture flashes only after the homework page records the question as done.</p>
            <button type="button" class="primary" data-action="setup">Add pictures</button>
          </div>
          <div class="broken">
            <p class="empty-title">That link did not load.</p>
            <p class="broken-url"></p>
          </div>
        </div>
        <div class="caption" aria-live="polite" hidden>
          <p class="kicker"></p>
          <p class="cap"></p>
        </div>
        <div class="meter" hidden></div>
        <form class="setup" hidden>
          <label for="gd-links">Picture links</label>
          <p class="hint">One web link per line. Use as many as you have questions.</p>
          <textarea id="gd-links" spellcheck="false" placeholder="https://…"></textarea>
          <p class="setup-count"></p>
          <div class="setup-actions">
            <button type="button" class="primary" data-action="save-links">Save pictures</button>
            <button type="button" class="ghost" data-action="close-setup">Cancel</button>
          </div>
        </form>
        <footer class="foot">
          <p class="status"></p>
          <div class="tools">
            <button type="button" data-action="manual">Mark done by hand</button>
            <button type="button" data-action="setup">Pictures</button>
            <button type="button" data-action="dock-left" aria-pressed="false">Left</button>
            <button type="button" data-action="dock-right" aria-pressed="false">Right</button>
            <button type="button" data-action="reset">Start over</button>
          </div>
        </footer>
      </div>
      <div class="handle handle-e" data-resize="e"></div>
      <div class="handle handle-s" data-resize="s"></div>
      <div class="handle handle-w" data-resize="w"></div>
      <div class="handle handle-se" data-resize="se" title="Drag to resize" aria-label="Resize"></div>
    </section>
    <button type="button" class="tab" hidden data-side="right">
      <span class="mark" aria-hidden="true"></span>
      <span class="tab-label">Get Done</span>
      <span class="tab-x" data-action="dismiss" role="button" aria-label="Hide Get Done">×</span>
    </button>
  `;

  let state = null;
  let platform = null;
  let detected = null;
  let mode = "gone";
  let host = null;
  let shadow = null;
  let panel = null;
  let tab = null;
  let stage = null;
  let photo = null;
  let kicker = null;
  let cap = null;
  let fraction = null;
  let pill = null;
  let meter = null;
  let setup = null;
  let textarea = null;
  let setupCount = null;
  let foot = null;
  let statusLine = null;
  let leftBtn = null;
  let rightBtn = null;
  let resetBtn = null;
  let waitCount = null;
  let waitCopy = null;
  let brokenUrl = null;
  let topbar = null;
  let setupOpen = false;
  let dragging = false;
  let resizing = false;
  let resize = null;
  let dragDx = 0;
  let dragDy = 0;
  let hoverPanel = false;
  let lastSaved = "";
  let lastHref = location.href;
  let memoryQ = null;
  let memoryHigh = null;
  let memoryFinished = null;
  let resetArmed = false;
  let resetTimer = 0;
  let chain = Promise.resolve();
  let mounted = false;

  function cssHref() {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) {
        return chrome.runtime.getURL("content/get-done.css");
      }
    } catch (error) {
      /* demo page has no extension id */
    }
    if (SCRIPT_SRC) return new URL("get-done.css", SCRIPT_SRC).href;
    return "get-done.css";
  }

  const storage = {
    async get() {
      try {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          const data = await chrome.storage.local.get("getDoneState");
          return data.getDoneState || null;
        }
      } catch (error) {
        /* fall through to localStorage */
      }
      try {
        const raw = localStorage.getItem("getDoneState");
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        return null;
      }
    },
    async set(value) {
      lastSaved = JSON.stringify(value);
      try {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.set({ getDoneState: value });
          return;
        }
      } catch (error) {
        /* fall through */
      }
      try {
        localStorage.setItem("getDoneState", JSON.stringify(value));
      } catch (error) {
        /* private mode can block storage */
      }
    },
  };

  function asMap(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return { ...value };
  }

  function sanitizeGeometry(geometry) {
    if (!geometry || typeof geometry !== "object") return null;
    const w = Number(geometry.w);
    const h = Number(geometry.h);
    const x = Number(geometry.x);
    const y = Number(geometry.y);
    if (![w, h, x, y].every(Number.isFinite)) return null;
    const dock = geometry.dock === "left" || geometry.dock === "right" || geometry.dock === "free"
      ? geometry.dock
      : "free";
    return { x, y, w, h, dock };
  }

  function normalize(raw) {
    const next = {
      rawLinks: "",
      images: [],
      revealed: 0,
      geometry: null,
      seeded: false,
      minimizedOrigins: {},
      dismissedOrigins: {},
      enabledOrigins: {},
    };
    if (!raw || typeof raw !== "object") return next;
    next.rawLinks = typeof raw.rawLinks === "string" ? raw.rawLinks : "";
    next.images = Array.isArray(raw.images)
      ? raw.images.filter((url) => typeof url === "string" && /^https?:\/\//i.test(url))
      : [];
    next.revealed = Number.isFinite(Number(raw.revealed)) ? Math.max(0, Number(raw.revealed)) : 0;
    if (next.revealed > next.images.length) next.revealed = next.images.length;
    next.geometry = sanitizeGeometry(raw.geometry);
    next.seeded = Boolean(raw.seeded);
    next.minimizedOrigins = asMap(raw.minimizedOrigins);
    next.dismissedOrigins = asMap(raw.dismissedOrigins);
    next.enabledOrigins = asMap(raw.enabledOrigins);
    return next;
  }

  function snapshot() {
    return {
      rawLinks: state.rawLinks,
      images: state.images,
      revealed: state.revealed,
      geometry: state.geometry,
      seeded: state.seeded,
      minimizedOrigins: state.minimizedOrigins,
      dismissedOrigins: state.dismissedOrigins,
      enabledOrigins: state.enabledOrigins,
    };
  }

  async function save() {
    await storage.set(snapshot());
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function defaultGeometry() {
    const w = clamp(360, 260, Math.max(260, window.innerWidth - 24));
    const h = clamp(580, 360, Math.max(320, window.innerHeight - 32));
    return {
      x: Math.max(12, window.innerWidth - w - 16),
      y: Math.max(12, Math.round((window.innerHeight - h) / 2)),
      w: Math.min(w, window.innerWidth - 24),
      h: Math.min(h, window.innerHeight - 24),
      dock: "right",
    };
  }

  function clampGeometry() {
    const geometry = state.geometry;
    const minW = Math.min(260, Math.max(160, window.innerWidth - 16));
    const minH = Math.min(360, Math.max(220, window.innerHeight - 16));
    const maxW = Math.max(minW, Math.min(760, window.innerWidth - 16));
    const maxH = Math.max(minH, window.innerHeight - 16);
    geometry.w = clamp(geometry.w, minW, maxW);
    geometry.h = clamp(geometry.h, minH, maxH);
    if (geometry.dock === "left") geometry.x = 16;
    else if (geometry.dock === "right") geometry.x = Math.max(8, window.innerWidth - geometry.w - 16);
    else geometry.x = clamp(geometry.x, 8, Math.max(8, window.innerWidth - geometry.w - 8));
    geometry.y = clamp(geometry.y, 8, Math.max(8, window.innerHeight - geometry.h - 8));
  }

  function isDemo() {
    return document.documentElement.dataset.getDoneDemo === "true";
  }

  function demoImageUrls() {
    return [1, 2, 3, 4, 5, 6, 7, 8].map((number) => {
      return `${location.origin}/rewards/${String(number).padStart(2, "0")}.jpg`;
    });
  }

  function detectPlatform() {
    const forced = document.documentElement.getAttribute("data-get-done-platform");
    if (forced) {
      const known = GetDone.platformById(forced);
      if (known) return known;
    }
    const fromHost = GetDone.platformFromHost(location.hostname);
    if (fromHost) return fromHost;
    const href = String(location.href || "");
    if (/(playerhomework|assignmentplayer|assignmentviewer|overviewhomework|mathxl|mylab|mastering)/i.test(href)) {
      return GetDone.platformById("pearson");
    }
    if (document.querySelector("#activityFrame, [command='checkanswer'], #xl_player_layout_SplitTopLayout_0, .contentHolder")) {
      return GetDone.platformById("pearson");
    }
    return platformFromDocument();
  }

  function platformFromDocument() {
    const bits = [];
    const generator = document.querySelector('meta[name="generator"]');
    if (generator) bits.push(generator.getAttribute("content") || "");
    bits.push(document.documentElement.className || "");
    if (document.body) {
      bits.push(document.body.className || "", document.body.id || "");
    }
    const nodes = document.querySelectorAll("script[src], link[href]");
    const limit = Math.min(nodes.length, 40);
    for (let index = 0; index < limit; index += 1) {
      bits.push(nodes[index].src || nodes[index].href || "");
    }
    return GetDone.platformFromSignals(bits.join("\n"));
  }

  function questionKey() {
    return `getDoneQ:${location.host}`;
  }

  function readQ() {
    try {
      const stored = sessionStorage.getItem(questionKey());
      if (stored == null || stored === "") return memoryQ;
      return stored;
    } catch (error) {
      return memoryQ;
    }
  }

  function writeQ(value) {
    if (value == null || value === "") return;
    memoryQ = String(value);
    try {
      sessionStorage.setItem(questionKey(), memoryQ);
    } catch (error) {
      /* sandboxed frames can throw */
    }
  }

  function readQIndex() {
    try {
      const stored = sessionStorage.getItem(`${questionKey()}:index`);
      if (stored == null || stored === "") return null;
      const value = Number(stored);
      return Number.isFinite(value) ? value : null;
    } catch (error) {
      return null;
    }
  }

  function writeQIndex(value) {
    try {
      if (value == null || !Number.isFinite(value)) {
        sessionStorage.removeItem(`${questionKey()}:index`);
        return;
      }
      sessionStorage.setItem(`${questionKey()}:index`, String(value));
    } catch (error) {
      /* ignore */
    }
  }

  function highKey() {
    return `getDoneHigh:${location.host}`;
  }

  function finishKey() {
    return `getDoneFinished:${location.host}`;
  }

  function readHigh() {
    try {
      const stored = sessionStorage.getItem(highKey());
      if (stored == null || stored === "") return memoryHigh;
      const value = Number(stored);
      return Number.isFinite(value) ? value : memoryHigh;
    } catch (error) {
      return memoryHigh;
    }
  }

  function writeHigh(value) {
    memoryHigh = value;
    try {
      sessionStorage.setItem(highKey(), String(value));
    } catch (error) {
      /* sandboxed frames can throw */
    }
  }

  function verifiedKey() {
    return `getDoneVerified:${location.host}`;
  }

  function paidKey() {
    return `getDonePaid:${location.host}`;
  }

  const memorySets = {};

  function readIdSet(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw == null) return new Set(memorySets[key] || []);
      let values = [];
      if (raw.startsWith("[")) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) values = parsed;
      } else {
        values = raw
          .split(",")
          .map((piece) => piece.trim())
          .filter(Boolean)
          .map((piece) => {
            const asNumber = Number(piece);
            return Number.isFinite(asNumber) && asNumber > 0 ? String(asNumber) : piece;
          });
      }
      memorySets[key] = values;
      return new Set(values);
    } catch (error) {
      return new Set(memorySets[key] || []);
    }
  }

  function writeIdSet(key, values) {
    const list = [...values].filter((value) => typeof value === "string" && value);
    memorySets[key] = list;
    try {
      sessionStorage.setItem(key, JSON.stringify(list));
    } catch (error) {
      /* ignore */
    }
  }

  function normalizeQuestionId(value) {
    if (value == null || value === "") return null;
    if (typeof value === "string") return value;
    if (Number.isFinite(value) && value >= 1) return String(value);
    return null;
  }

  function isVerified(questionId) {
    const key = normalizeQuestionId(questionId);
    if (!key) return false;
    return readIdSet(verifiedKey()).has(key);
  }

  function isPaid(questionId) {
    const key = normalizeQuestionId(questionId);
    if (!key) return false;
    return readIdSet(paidKey()).has(key);
  }

  // Anti-cheat: a question only counts if real (trusted) input happened on it, for a minimum time.
  const MIN_DWELL_MS = 6000;
  const AUTO_COOLDOWN_MS = 5000;
  const MANUAL_COOLDOWN_MS = 30000;
  let evidence = { count: 0, firstAt: 0 };
  let lastAutoAt = 0;
  let lastManualAt = 0;

  function noteEvidence() {
    evidence.count += 1;
    if (!evidence.firstAt) evidence.firstAt = Date.now();
  }
  function evidenceOk() {
    return evidence.count >= 2 && evidence.firstAt > 0 && Date.now() - evidence.firstAt >= MIN_DWELL_MS;
  }
  function resetEvidence() {
    evidence = { count: 0, firstAt: 0 };
  }
  function onActivity(event) {
    // Events made by a page script (isTrusted false) are ignored.
    if (!event || !event.isTrusted) return;
    const target = event.target;
    if (target && target.closest && target.closest("#get-done-root")) return;
    if (window.top !== window) {
      try {
        window.top.postMessage({ source: QUESTION_MESSAGE, kind: "evidence" }, "*");
      } catch (error) {
        /* ignore */
      }
      return;
    }
    noteEvidence();
  }

  // When a site's labels are random or missing, identify the question by its own text.
  function fingerprintQuestion() {
    let field = null;
    try {
      const candidates = document.querySelectorAll(
        "textarea, input[type='text'], input[type='number'], input:not([type]), input[type='radio'], input[type='checkbox'], select, [contenteditable='true'], math-field",
      );
      for (const el of candidates) {
        if (el.closest && el.closest("#get-done-root")) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        if (rect.bottom < 0 || rect.top > innerHeight) continue;
        field = el;
        break;
      }
    } catch (error) {
      return null;
    }
    if (!field) return null;
    const box = field.closest("form, fieldset, [class*='question' i], [class*='problem' i], [class*='exercise' i], section, article") || field.parentElement;
    if (!box) return null;
    const key = GetDone.fingerprint(box.innerText || box.textContent || "");
    if (!key) return null;
    return { key, label: "this question", index: null, current: null, total: null, confident: false, kind: "fp" };
  }

  function witness(questionId) {
    const key = normalizeQuestionId(questionId);
    if (!key) return;
    if (!evidenceOk()) return;
    const verified = readIdSet(verifiedKey());
    if (!verified.has(key)) {
      verified.add(key);
      writeIdSet(verifiedKey(), verified);
      updateStatusLine();
    }
    payout(key);
  }

  // Each recorded question pays one picture, as soon as it is recorded.
  // If the stack is empty it stays unpaid, so a new picture can claim it later.
  function payout(questionId) {
    const key = normalizeQuestionId(questionId);
    if (!key || isPaid(key)) return;
    if (!state || state.revealed >= state.images.length) return;
    if (Date.now() - lastAutoAt < AUTO_COOLDOWN_MS) return;
    lastAutoAt = Date.now();
    markPaid(key);
    updateStatusLine();
    reveal(1, "auto");
  }

  function postToTop(payload) {
    if (window.top === window) return false;
    try {
      window.top.postMessage({ source: QUESTION_MESSAGE, ...payload }, "*");
      return true;
    } catch (error) {
      return false;
    }
  }

  function witnessQuestion(questionNumber) {
    if (postToTop({ kind: "witness", question: questionNumber })) return;
    witness(questionNumber);
  }

  function armAdvance(questionNumber) {
    const payload = { question: questionNumber, at: Date.now() };
    if (postToTop({ kind: "armed", ...payload })) return;
    armedAttempt = payload;
  }

  function markPaid(questionId) {
    const key = normalizeQuestionId(questionId);
    if (!key) return;
    const paid = readIdSet(paidKey());
    paid.add(key);
    writeIdSet(paidKey(), paid);
  }

  function clearQuestionMemory() {
    memoryQ = null;
    memoryHigh = null;
    memoryFinished = null;
    detected = null;
    delete memorySets[verifiedKey()];
    delete memorySets[paidKey()];
    try {
      sessionStorage.removeItem(questionKey());
      sessionStorage.removeItem(`${questionKey()}:index`);
      sessionStorage.removeItem(highKey());
      sessionStorage.removeItem("getDoneSuppress");
      sessionStorage.removeItem(finishKey());
      sessionStorage.removeItem(verifiedKey());
      sessionStorage.removeItem(paidKey());
    } catch (error) {
      /* ignore */
    }
  }

  function trackingEnabled() {
    const origin = location.origin;
    if (state.dismissedOrigins[origin]) return false;
    if (platform) return true;
    return Boolean(state.enabledOrigins[origin]);
  }

  function desiredMode(strongQuestion) {
    const origin = location.origin;
    if (state.dismissedOrigins[origin]) return "gone";
    const known = Boolean(platform) || Boolean(state.enabledOrigins[origin]);
    if (known) return state.minimizedOrigins[origin] ? "tab" : "open";
    if (strongQuestion) return "tab";
    return "gone";
  }

  function tabSide() {
    if (state.geometry.dock === "left") return "left";
    if (state.geometry.dock === "right") return "right";
    const geometry = state.geometry;
    const left = geometry.x;
    const right = window.innerWidth - (geometry.x + geometry.w);
    return left <= right ? "left" : "right";
  }

  function applyGeometry() {
    if (!panel || !state.geometry) return;
    const geometry = state.geometry;
    panel.style.width = `${Math.round(geometry.w)}px`;
    panel.style.height = `${Math.round(geometry.h)}px`;
    panel.style.transform = `translate(${Math.round(geometry.x)}px, ${Math.round(geometry.y)}px)`;
    const side = tabSide();
    tab.dataset.side = side;
    const y = clamp(geometry.y, 8, Math.max(8, window.innerHeight - 164));
    tab.style.transform = `translateY(${Math.round(y)}px)`;
  }

  function updateDockButtons() {
    if (!leftBtn) return;
    leftBtn.setAttribute("aria-pressed", String(state.geometry.dock === "left"));
    rightBtn.setAttribute("aria-pressed", String(state.geometry.dock === "right"));
  }

  function updatePill() {
    if (!pill) return;
    if (!platform) {
      pill.hidden = true;
      pill.textContent = "";
      return;
    }
    pill.hidden = false;
    pill.textContent = platform.name;
  }

  function updateFraction() {
    if (!fraction) return;
    const total = state.images.length;
    fraction.textContent = total ? `${state.revealed}/${total}` : "0";
  }

  function updateMeter() {
    if (!meter) return;
    const total = state.images.length;
    meter.hidden = setupOpen || total === 0;
    meter.replaceChildren();
    if (!total || setupOpen) return;
    if (total > 16) {
      const track = document.createElement("div");
      track.className = "track";
      const fill = document.createElement("span");
      fill.style.width = `${Math.round((state.revealed / total) * 100)}%`;
      track.appendChild(fill);
      const label = document.createElement("em");
      label.textContent = `${state.revealed}/${total}`;
      meter.append(track, label);
      return;
    }
    for (let index = 0; index < total; index += 1) {
      const dot = document.createElement("i");
      if (index < state.revealed) dot.className = "on";
      meter.appendChild(dot);
    }
  }

  function updateStatusLine() {
    if (!statusLine) return;
    if (!detected) {
      statusLine.textContent = platform
        ? `Watching ${platform.name}. No question counter yet.`
        : "No question counter yet.";
      return;
    }
    const where = platform ? ` on ${platform.name}` : "";
    const place =
      detected.kind === "slug"
        ? `Problem ${detected.label || detected.key}${where}`
        : detected.total
          ? `Question ${detected.index ?? detected.key} of ${detected.total}${where}`
          : `Question ${detected.label || detected.key}${where}`;
    if (isPaid(detected.key)) {
      statusLine.textContent = `${place}. Picture already flashed.`;
    } else if (isVerified(detected.key)) {
      statusLine.textContent = `${place}. Recorded. Picture incoming.`;
    } else {
      statusLine.textContent = `${place}. Sealed until this page records the question.`;
    }
  }

  function setView(view) {
    stage.dataset.view = view;
    const caption = shadow.querySelector(".caption");
    if (caption) caption.hidden = view !== "photo";
  }

  function renderStage() {
    updateFraction();
    updateMeter();
    updateStatusLine();
    updateDockButtons();
    updatePill();
    if (setupOpen) return;
    if (state.images.length === 0) {
      setView("empty");
      return;
    }
    if (state.revealed <= 0) {
      setView("waiting");
      kicker.textContent = "";
      cap.textContent = "";
      photo.removeAttribute("src");
      waitCount.textContent = String(state.images.length);
      waitCopy.textContent = state.images.length === 1
        ? "1 picture is sealed. It flashes after the page records a finished question. Drag the top bar to move this window."
        : `${state.images.length} pictures are sealed. Each one flashes after the page records the next finished question. Drag the top bar to move this window.`;
      return;
    }
    const index = Math.min(state.revealed, state.images.length) - 1;
    const url = state.images[index];
    setView("photo");
    if (photo.getAttribute("src") !== url) photo.src = url;
    photo.alt = `Picture ${state.revealed} of ${state.images.length}`;
    if (state.revealed >= state.images.length) {
      kicker.textContent = "Stack complete";
      cap.textContent = `Picture ${state.revealed} of ${state.images.length}`;
    } else {
      kicker.textContent = "Last reward";
      cap.textContent = `Picture ${state.revealed} of ${state.images.length}`;
    }
  }

  function applyMode(next) {
    mode = next;
    if (!host) return;
    host.style.display = next === "gone" ? "none" : "block";
    panel.hidden = next !== "open";
    tab.hidden = next !== "tab";
    if (next === "open") renderStage();
    else updateFraction();
  }

  function setSetupOpen(open) {
    setupOpen = open;
    setup.hidden = !open;
    stage.hidden = open;
    foot.hidden = open;
    if (open) {
      const caption = shadow.querySelector(".caption");
      if (caption) caption.hidden = true;
    }
    if (open) {
      textarea.value = state.rawLinks;
      refreshSetupCount();
      meter.hidden = true;
      textarea.focus();
      return;
    }
    renderStage();
  }

  function refreshSetupCount() {
    const urls = GetDone.parseLinks(textarea.value);
    if (!textarea.value.trim()) {
      setupCount.textContent = "Nothing pasted yet.";
      setupCount.classList.remove("is-bad");
      return urls;
    }
    if (!urls.length) {
      setupCount.textContent = "No usable links. Use http or https addresses, one per line.";
      setupCount.classList.add("is-bad");
      return urls;
    }
    setupCount.textContent = urls.length === 1 ? "1 picture ready." : `${urls.length} pictures ready.`;
    setupCount.classList.remove("is-bad");
    return urls;
  }

  function saveLinks() {
    const urls = refreshSetupCount();
    if (textarea.value.trim() && urls.length === 0) return;
    state.rawLinks = textarea.value;
    state.images = urls;
    if (state.revealed > urls.length) state.revealed = urls.length;
    save();
    setSetupOpen(false);
    preloadAhead();
  }

  function preloadAhead() {
    state.images.slice(state.revealed, state.revealed + 2).forEach((url) => {
      const image = new Image();
      image.referrerPolicy = "no-referrer";
      image.src = url;
    });
  }

  function dock(side, persist) {
    state.geometry.dock = side === "left" ? "left" : "right";
    clampGeometry();
    applyGeometry();
    updateDockButtons();
    if (persist !== false) save();
  }

  function snapDock() {
    const geometry = state.geometry;
    if (geometry.x <= 28) dock("left", false);
    else if (window.innerWidth - (geometry.x + geometry.w) <= 28) dock("right", false);
    else {
      applyGeometry();
      updateDockButtons();
    }
  }

  function openPanel() {
    const origin = location.origin;
    delete state.dismissedOrigins[origin];
    delete state.minimizedOrigins[origin];
    state.enabledOrigins[origin] = true;
    save();
    applyMode("open");
    if (detected && readQ() == null) {
      writeQ(detected.key);
      writeQIndex(detected.index);
    }
  }

  function minimize() {
    state.minimizedOrigins[location.origin] = true;
    save();
    applyMode("tab");
  }

  function dismiss() {
    state.dismissedOrigins[location.origin] = true;
    save();
    applyMode("gone");
  }

  function armReset() {
    if (!resetArmed) {
      resetArmed = true;
      resetBtn.textContent = "Confirm start over";
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        resetArmed = false;
        resetBtn.textContent = "Start over";
      }, 2400);
      return;
    }
    resetArmed = false;
    clearTimeout(resetTimer);
    resetBtn.textContent = "Start over";
    state.revealed = 0;
    clearQuestionMemory();
    save();
    renderStage();
    runScan();
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function pulse() {
    stage.classList.remove("is-flashing");
    void stage.offsetWidth;
    stage.classList.add("is-flashing");
    setTimeout(() => stage.classList.remove("is-flashing"), 700);
  }

  function animateTo(url, reason) {
    return new Promise((resolve) => {
      setView("photo");
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      kicker.textContent = "That's one done.";
      cap.textContent = `Picture ${state.revealed} of ${state.images.length}`;
      photo.alt = cap.textContent;
      const finish = () => {
        stage.classList.remove("is-flashing");
        resolve();
      };
      const show = () => {
        photo.src = url;
      };
      if (reduce) {
        show();
        finish();
        return;
      }
      stage.classList.remove("is-flashing");
      void stage.offsetWidth;
      stage.classList.add("is-flashing");
      setTimeout(show, 120);
      setTimeout(finish, 760);
    });
  }

  // Hand marking stays as a fallback when a site can't be tracked. Real clicks only, and a cooldown.
  function manualDone(event) {
    if (!event || !event.isTrusted) return;
    const wait = MANUAL_COOLDOWN_MS - (Date.now() - lastManualAt);
    if (wait > 0) {
      if (statusLine) statusLine.textContent = `Hand marking is limited. Try again in ${Math.ceil(wait / 1000)}s.`;
      return;
    }
    lastManualAt = Date.now();
    reveal(1, "manual");
  }

  function reveal(count, reason) {
    const total = Math.max(0, count | 0);
    for (let index = 0; index < total; index += 1) {
      chain = chain.then(() => revealOne(reason)).catch(() => {});
    }
  }

  async function revealOne(reason) {
    const origin = location.origin;
    const wasMinimized = Boolean(state.minimizedOrigins[origin]) || mode === "tab";
    if (mode !== "open") applyMode("open");
    if (setupOpen) setSetupOpen(false);

    if (state.images.length === 0) {
      setView("empty");
      return;
    }
    if (state.revealed >= state.images.length) {
      renderStage();
      kicker.textContent = "You're out of pictures";
      cap.textContent = "Paste more, or start the stack over.";
      pulse();
      return;
    }

    const url = state.images[state.revealed];
    state.revealed += 1;
    await save();
    updateFraction();
    updateMeter();
    await animateTo(url, reason);
    preloadAhead();

    if (wasMinimized && !hoverPanel) {
      await wait(1100);
      if (!hoverPanel && !setupOpen && !dragging && !resizing) {
        state.minimizedOrigins[origin] = true;
        await save();
        applyMode("tab");
      }
    }
  }

  function scanCompletion() {
    let nodes = [];
    try {
      nodes = Array.from(document.querySelectorAll(
        "[data-complete], [role='status'], [aria-live], [role='alert'], [class*='correct' i], [class*='submitted' i], [class*='feedback' i], [class*='result' i], .alert-success, [command*='feedback' i]",
      )).slice(0, 50);
    } catch (error) {
      nodes = Array.from(document.querySelectorAll("[data-complete], [role='status'], [aria-live]")).slice(0, 40);
    }
    let accepted = false;
    for (const element of nodes) {
      if (!(element instanceof Element)) continue;
      if (element.closest && element.closest("#get-done-root")) continue;
      let visible = true;
      try {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) visible = false;
      } catch (error) {
        visible = true;
      }
      if (!visible) continue;
      const flag = element.getAttribute("data-complete");
      if (flag === "true") return "accepted";
      if (flag === "false") continue;
      const fromClass = GetDone.completionFromClass(typeof element.className === "string" ? element.className : "");
      if (fromClass === "rejected") continue;
      let text = "";
      try {
        text = (element.textContent || "").replace(/\s+/g, " ").trim();
      } catch (error) {
        text = "";
      }
      const fromText = GetDone.completionFromText(text);
      if (fromText === "rejected") continue;
      if (fromClass === "accepted" || fromText === "accepted") accepted = true;
    }
    return accepted ? "accepted" : null;
  }

  function noteCompletion(questionId) {
    const key = normalizeQuestionId(questionId) || (detected && detected.key);
    if (!key) return;
    if (scanCompletion() === "accepted") witnessQuestion(key);
  }

  function maybeAdvance(question) {
    const current = question && question.key;
    if (!current) return;
    const previous = readQ();
    if (previous == null) {
      writeQ(current);
      writeQIndex(question.index);
      return;
    }
    if (current === previous) return;
    const left = previous;
    const prevIndex = readQIndex();
    writeQ(current);
    writeQIndex(question.index);
    if (
      question.kind === "numeric" &&
      Number.isFinite(question.index) &&
      Number.isFinite(prevIndex) &&
      question.index < prevIndex
    ) {
      armedAttempt = null;
      return;
    }
    if (armedAttempt && armedAttempt.question === left && Date.now() - armedAttempt.at < 4000) {
      witness(left);
    }
    armedAttempt = null;
    resetEvidence();
  }

  function noteQuestion(question) {
    if (!question || !question.key) return;
    detected = question;
    updateStatusLine();
    const strong =
      question.kind === "fp"
        ? false
        : question.kind === "slug"
        ? Boolean(question.confident)
        : Boolean(question.total) && question.confident !== false;
    if (!trackingEnabled()) {
      if (strong && !state.dismissedOrigins[location.origin] && mode === "gone") applyMode("tab");
      return;
    }
    if (mode === "gone") applyMode(desiredMode(strong));
    maybeAdvance(question);
  }

  function isCurrent(element) {
    const aria = element.getAttribute("aria-current");
    if (aria && aria !== "false") return true;
    const className = typeof element.className === "string" ? element.className : "";
    return /\b(active|current|selected|is-active)\b/i.test(className);
  }

  function scoreCandidate(question, text, top, active) {
    let score = 0;
    if (question.kind === "slug") score += 90;
    if (question.total) score += 80;
    if (question.confident) score += 40;
    if (text.length < 48) score += 18;
    if (/question|problem|item|exercise/i.test(text)) score += 16;
    if (top >= 0 && top < 320) score += 22;
    else if (top >= 320 && top < 700) score += 8;
    if (active) score += 36;
    if (!question.total && question.kind !== "slug" && !active) score -= 12;
    return score;
  }

  // On Edfinity the URL's assessment_item_id is the trustworthy per-question
  // key; the page's headings name the assignment ("Section 12.1"), not the
  // problem. The visible "3." label is the problem number to show.
  function edfinityScan() {
    try {
      const p = platform || detectPlatform();
      if (!p || p.id !== "edfinity") return null;
      let labelText = "";
      const isItemNumber = (el) => {
        if (!el || (el.closest && el.closest("#get-done-root"))) return false;
        const t = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (!/^\d{1,3}\.$/.test(t)) return false;
        if (el.children && el.children.length > 1) return false;
        const rect = el.getBoundingClientRect();
        return !(rect.width === 0 && rect.height === 0);
      };
      const headings = Array.from(document.querySelectorAll("main h1, main h2, main h3, main h4, [class*='item' i] h1, [class*='item' i] h2, [class*='item' i] h3, [class*='item' i] h4, main [class*='label' i]")).slice(0, 40);
      for (const el of headings) {
        if (isItemNumber(el)) { labelText = (el.textContent || "").trim(); break; }
      }
      if (!labelText) {
        const any = Array.from(document.querySelectorAll("main *, [class*='item' i] *")).slice(0, 250);
        for (const el of any) {
          if (isItemNumber(el)) { labelText = (el.textContent || "").trim(); break; }
        }
      }
      const hit = GetDone.edfinityItem(location.href, labelText);
      if (!hit) return null;
      return { ...hit, score: 1000 };
    } catch (error) {
      return null;
    }
  }

  function scanDocument() {
    const edf = edfinityScan();
    if (edf) return edf;
    const selectors = [
      "h1",
      "h2",
      "h3",
      "h4",
      "[role='heading']",
      "[aria-live]",
      "[aria-current='true']",
      "[aria-current='step']",
      "[aria-label]",
      "[data-question-index]",
      "[data-current-question]",
      "[data-testid*='question' i]",
      "[class*='question' i]",
      "[id*='question' i]",
      "[class*='problem' i]",
      "[id*='problem' i]",
      "[class*='active' i]",
      "[class*='selected' i]",
      "button[aria-pressed='true']",
    ];
    let nodes = [];
    try {
      nodes = Array.from(document.querySelectorAll(selectors.join(","))).slice(0, 70);
    } catch (error) {
      nodes = Array.from(document.querySelectorAll("h1, h2, h3, h4")).slice(0, 40);
    }
    const found = [];
    const titleHit = GetDone.findQuestion(document.title || "");
    // The page title names the assignment (e.g. "Assignment 5.2 - Edfinity"),
    // not the live problem, and it never changes between problems. A slug hit
    // there freezes the question identity, so only numeric hits count.
    if (titleHit && titleHit.kind !== "slug") {
      found.push({ ...titleHit, score: scoreCandidate(titleHit, document.title, 0, true) });
    }

    for (const element of nodes) {
      if (!(element instanceof Element)) continue;
      if (element.closest && element.closest("#get-done-root")) continue;
      let text = "";
      try {
        text = (element.textContent || "").replace(/\s+/g, " ").trim();
      } catch (error) {
        continue;
      }
      let question = null;
      const aria = element.getAttribute("aria-label");
      if (aria) question = GetDone.findQuestion(aria.replace(/\s+/g, " ").trim());
      if (!text || text.length > 180) {
        if (!question) continue;
      } else {
        question = question || GetDone.findQuestion(text);
      }
      if (!question) continue;
      let top = 0;
      let visible = true;
      try {
        const rect = element.getBoundingClientRect();
        top = rect.top;
        if (rect.width === 0 && rect.height === 0) visible = false;
      } catch (error) {
        visible = true;
      }
      if (!visible) continue;
      found.push({
        ...question,
        score: scoreCandidate(question, text, top, isCurrent(element)),
      });
    }
    if (!found.length) return null;
    found.sort((a, b) => b.score - a.score);
    return found[0];
  }

  let scanTimer = 0;
  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(runScan, 220);
  }

  function refreshPlatform() {
    const next = detectPlatform();
    const same = (next && next.id) === (platform && platform.id);
    if (same) return;
    platform = next;
    updatePill();
    updateStatusLine();
  }

  function runScan() {
    if (document.hidden) return;
    const question = scanDocument() || fingerprintQuestion();
    if (window.top !== window) {
      if (question) {
        window.top.postMessage({
          source: QUESTION_MESSAGE,
          kind: "question",
          key: question.key,
          label: question.label,
          index: question.index,
          current: question.current,
          total: question.total,
          confident: question.confident,
          kindType: question.kind,
        }, "*");
      }
      if (scanCompletion() === "accepted") {
        window.top.postMessage({
          source: QUESTION_MESSAGE,
          kind: "complete",
          question: question ? question.key : null,
        }, "*");
      }
      return;
    }
    refreshPlatform();
    if (question) noteQuestion(question);
    noteCompletion();
  }

  const NEXT_RE = /\b(next|continue|submit|check answer|save and continue|next question|next problem|next item)\b/i;
  let armedAttempt = null;

  function answerPresent() {
    const picked = document.querySelector(
      "input[type='radio']:checked, input[type='checkbox']:checked, [aria-checked='true'], [aria-selected='true'], .is-picked, .answer.selected, .selected-answer",
    );
    if (picked && !(picked.closest && picked.closest("#get-done-root"))) return true;
    const fields = document.querySelectorAll("textarea, input[type='text'], input[type='number'], [contenteditable='true']");
    for (const field of Array.from(fields).slice(0, 30)) {
      if (field.closest && field.closest("#get-done-root")) continue;
      const value = (field.value || field.textContent || "").trim();
      if (value) return true;
    }
    return false;
  }

  function isAdvanceControl(label) {
    if (/\bcheck answer\b/i.test(label)) return false;
    return /\b(next|continue|submit|save and continue|next question|next problem|next item)\b/i.test(label);
  }
  const FINISH_RE = /\b(submit quiz|submit assignment|submit exam|submit homework|finish attempt|finish quiz|finish homework|turn in|complete quiz|complete assignment)\b/i;

  function controlLabel(control) {
    return [
      control.getAttribute("aria-label"),
      control.getAttribute("title"),
      control.innerText,
      control.value,
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, 120);
  }

  function isTerminalFinish(label) {
    return FINISH_RE.test(label) || /^submit$/i.test(label);
  }

  function maybeFinishQuiz() {
    if (!state || !trackingEnabled() || !detected || !detected.key) return;
    if (detected.kind === "numeric") {
      if (!detected.total || detected.index !== detected.total) return;
    }
    noteCompletion(detected.key);
    if (!isVerified(detected.key) || isPaid(detected.key)) return;
    const finishToken = detected.kind === "slug" ? detected.key : String(detected.total);
    if (memoryFinished === finishToken) return;
    try {
      if (sessionStorage.getItem(finishKey()) === finishToken) return;
    } catch (error) {
      /* ignore */
    }
    memoryFinished = finishToken;
    try {
      sessionStorage.setItem(finishKey(), finishToken);
    } catch (error) {
      /* ignore */
    }
    payout(detected.key);
  }

  function onClick(event) {
    const target = event.target;
    if (!target || !target.closest) return;
    const control = target.closest("button, a, input[type='submit'], input[type='button'], [role='button']");
    if (!control || (control.closest && control.closest("#get-done-root"))) return;
    const label = controlLabel(control);
    noteCompletion();
    if (detected && answerPresent() && isAdvanceControl(label)) {
      armAdvance(detected.key);
    }
    if (isTerminalFinish(label)) {
      if (window.top !== window) {
        window.top.postMessage({ source: QUESTION_MESSAGE, kind: "finish" }, "*");
      } else {
        maybeFinishQuiz();
      }
    }
    if (!NEXT_RE.test(label)) return;
    setTimeout(runScan, 350);
    setTimeout(runScan, 1100);
  }

  function startObservers() {
    const root = document.documentElement;
    if (!root) return;
    try {
      const observer = new MutationObserver(() => scheduleScan());
      observer.observe(root, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["class", "aria-current", "aria-label", "data-question", "data-question-index"],
      });
    } catch (error) {
      /* observation is best-effort */
    }
    document.addEventListener("click", onClick, true);
    for (const type of ["input", "change", "keydown", "pointerdown"]) document.addEventListener(type, onActivity, true);
    window.addEventListener("hashchange", scheduleScan);
    window.addEventListener("popstate", scheduleScan);
    setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        scheduleScan();
      }
    }, 900);
  }

  function statusPayload() {
    return {
      platform: platform ? platform.name : null,
      question: detected,
      revealed: state.revealed,
      totalImages: state.images.length,
      mode,
    };
  }

  function onRuntimeMessage(message, _sender, sendResponse) {
    if (!message || typeof message !== "object") return false;
    if (message.type === "GET_DONE_STATUS") {
      sendResponse(statusPayload());
      return true;
    }
    if (message.type === "GET_DONE_SHOW") {
      openPanel();
      sendResponse(statusPayload());
      return true;
    }
    if (message.type === "GET_DONE_TOGGLE") {
      if (mode === "open") minimize();
      else openPanel();
      sendResponse(statusPayload());
      return true;
    }
    if (message.type === "GET_DONE_RESET") {
      state.revealed = 0;
      clearQuestionMemory();
      save();
      renderStage();
      runScan();
      sendResponse(statusPayload());
      return true;
    }
    if (message.type === "GET_DONE_DOCK") {
      dock(message.side === "left" ? "left" : "right");
      if (mode !== "open") openPanel();
      sendResponse(statusPayload());
      return true;
    }
    return false;
  }

  function hydrateQuestionMessage(data) {
    if (!data || !data.key) return null;
    const kind = data.kindType === "slug" ? "slug" : data.kindType === "fp" ? "fp" : "numeric";
    const index = data.index == null ? null : Number(data.index);
    const current = data.current == null ? null : Number(data.current);
    const total = data.total == null ? null : Number(data.total);
    return {
      key: String(data.key),
      label: data.label ? String(data.label) : String(data.key),
      index: Number.isFinite(index) ? index : null,
      current: Number.isFinite(current) ? current : null,
      total: Number.isFinite(total) ? total : null,
      confident: Boolean(data.confident),
      kind,
    };
  }

  function startParentBridge() {
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (!data || data.source !== QUESTION_MESSAGE) return;
      if (data.kind === "finish") {
        maybeFinishQuiz();
        return;
      }
      if (data.kind === "armed") {
        const question = normalizeQuestionId(data.question);
        if (!question) return;
        armedAttempt = { question, at: Number(data.at) || Date.now() };
        return;
      }
      if (data.kind === "evidence") {
        noteEvidence();
        return;
      }
      if (data.kind === "witness") {
        witness(normalizeQuestionId(data.question));
        return;
      }
      if (data.kind === "complete") {
        const key = normalizeQuestionId(data.question) || normalizeQuestionId(data.current);
        witness(key || (detected && detected.key));
        return;
      }
      if (data.kind !== "question") return;
      const question = hydrateQuestionMessage(data);
      if (!question) return;
      noteQuestion(question);
    });
    try {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener(onRuntimeMessage);
      }
    } catch (error) {
      /* not an extension context */
    }
  }

  function onExternal(raw) {
    const next = normalize(raw);
    if (!next.geometry) next.geometry = state.geometry || defaultGeometry();
    if (dragging || resizing) next.geometry = state.geometry;
    const revealedDropped = next.revealed < state.revealed;
    const imagesChanged = next.images.join("\n") !== state.images.join("\n");
    state = next;
    if (revealedDropped) clearQuestionMemory();
    platform = detectPlatform();
    if (shadow.activeElement !== textarea) textarea.value = state.rawLinks;
    const strong = Boolean(
      detected &&
        (detected.kind === "slug"
          ? detected.confident
          : detected.total && detected.confident),
    );
    applyMode(desiredMode(strong));
    renderStage();
    if (imagesChanged) preloadAhead();
  }

  function watchStorage() {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area !== "local" || !changes.getDoneState) return;
          const next = changes.getDoneState.newValue;
          if (!next) return;
          if (JSON.stringify(next) === lastSaved) return;
          onExternal(next);
        });
      }
    } catch (error) {
      /* ignore */
    }
  }

  function moveDrag(event) {
    const geometry = state.geometry;
    geometry.dock = "free";
    geometry.x = clamp(event.clientX - dragDx, 8, Math.max(8, window.innerWidth - geometry.w - 8));
    geometry.y = clamp(event.clientY - dragDy, 8, Math.max(8, window.innerHeight - geometry.h - 8));
    applyGeometry();
    updateDockButtons();
  }

  function moveResize(event) {
    const geometry = state.geometry;
    const dx = event.clientX - resize.sx;
    const dy = event.clientY - resize.sy;
    const minW = Math.min(260, Math.max(160, window.innerWidth - 16));
    const minH = Math.min(360, Math.max(220, window.innerHeight - 16));
    const maxW = Math.max(minW, Math.min(760, window.innerWidth - 16));
    const maxH = Math.max(minH, window.innerHeight - 16);
    if (resize.dir.includes("e")) geometry.w = clamp(resize.w + dx, minW, maxW);
    if (resize.dir.includes("w")) {
      const width = clamp(resize.w - dx, minW, maxW);
      geometry.w = width;
      geometry.x = resize.x + (resize.w - width);
    }
    if (resize.dir.includes("s")) geometry.h = clamp(resize.h + dy, minH, maxH);
    geometry.dock = "free";
    clampGeometry();
    applyGeometry();
    updateDockButtons();
  }

  function endPointer() {
    if (!dragging && !resizing) return;
    dragging = false;
    resizing = false;
    resize = null;
    topbar.classList.remove("is-dragging");
    snapDock();
    save();
  }

  function bind() {
    topbar.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (event.target.closest("button")) return;
      dragging = true;
      const rect = panel.getBoundingClientRect();
      dragDx = event.clientX - rect.left;
      dragDy = event.clientY - rect.top;
      topbar.classList.add("is-dragging");
      topbar.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    shadow.querySelectorAll(".handle").forEach((handle) => {
      handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        resizing = true;
        const geometry = state.geometry;
        resize = {
          dir: handle.dataset.resize,
          sx: event.clientX,
          sy: event.clientY,
          x: geometry.x,
          y: geometry.y,
          w: geometry.w,
          h: geometry.h,
        };
        handle.setPointerCapture(event.pointerId);
        event.preventDefault();
        event.stopPropagation();
      });
    });

    window.addEventListener("pointermove", (event) => {
      if (dragging) moveDrag(event);
      else if (resizing) moveResize(event);
    });
    window.addEventListener("pointerup", endPointer);
    window.addEventListener("pointercancel", endPointer);
    window.addEventListener("resize", () => {
      if (dragging || resizing) return;
      clampGeometry();
      applyGeometry();
    });

    panel.addEventListener("pointerenter", () => {
      hoverPanel = true;
    });
    panel.addEventListener("pointerleave", () => {
      hoverPanel = false;
    });

    shadow.addEventListener("click", (event) => {
      const action = event.target.closest("[data-action]");
      if (!action) return;
      const name = action.dataset.action;
      if (name === "minimize") minimize();
      else if (name === "setup") setSetupOpen(true);
      else if (name === "close-setup") setSetupOpen(false);
      else if (name === "save-links") saveLinks();
      else if (name === "dock-left") dock("left");
      else if (name === "dock-right") dock("right");
      else if (name === "reset") armReset();
      else if (name === "manual") manualDone(event);
    });

    setup.addEventListener("submit", (event) => {
      event.preventDefault();
      saveLinks();
    });
    textarea.addEventListener("input", refreshSetupCount);

    tab.addEventListener("click", (event) => {
      if (event.target.closest("[data-action='dismiss']")) {
        event.stopPropagation();
        dismiss();
        return;
      }
      openPanel();
    });

    photo.addEventListener("error", () => {
      if (stage.dataset.view !== "photo") return;
      setView("broken");
      brokenUrl.textContent = photo.getAttribute("src") || "";
    });
  }

  function mount() {
    if (document.getElementById("get-done-root")) return false;
    host = document.createElement("div");
    host.id = "get-done-root";
    host.style.cssText = "position:fixed;inset:0;z-index:2147483646;pointer-events:none;";
    shadow = host.attachShadow({ mode: "open" });
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssHref();
    shadow.appendChild(link);
    const shell = document.createElement("div");
    shell.className = "shell";
    shell.innerHTML = INNER;
    shadow.appendChild(shell);
    panel = shell.querySelector(".panel");
    tab = shell.querySelector(".tab");
    stage = shell.querySelector(".stage");
    photo = shell.querySelector(".photo");
    kicker = shell.querySelector(".kicker");
    cap = shell.querySelector(".cap");
    fraction = shell.querySelector(".fraction");
    pill = shell.querySelector(".pill");
    meter = shell.querySelector(".meter");
    setup = shell.querySelector(".setup");
    textarea = shell.querySelector("#gd-links");
    setupCount = shell.querySelector(".setup-count");
    foot = shell.querySelector(".foot");
    statusLine = shell.querySelector(".status");
    leftBtn = shell.querySelector("[data-action='dock-left']");
    rightBtn = shell.querySelector("[data-action='dock-right']");
    resetBtn = shell.querySelector("[data-action='reset']");
    waitCount = shell.querySelector(".wait-count");
    waitCopy = shell.querySelector(".wait-copy");
    brokenUrl = shell.querySelector(".broken-url");
    topbar = shell.querySelector(".topbar");
    (document.body || document.documentElement).appendChild(host);
    clampGeometry();
    applyGeometry();
    bind();
    mounted = true;
    setInterval(() => {
      if (host && !host.isConnected && document.body) document.body.appendChild(host);
    }, 2000);
    return true;
  }

  async function main() {
    if (window.top !== window) {
      startObservers();
      return;
    }
    if (document.getElementById("get-done-root")) return;

    state = normalize(await storage.get());
    if (isDemo() && !state.seeded && state.images.length === 0) {
      const urls = demoImageUrls();
      state.images = urls;
      state.rawLinks = urls.join("\n");
      state.seeded = true;
      await save();
    }
    if (!state.geometry) state.geometry = defaultGeometry();
    platform = detectPlatform();
    if (!mount()) return;
    startObservers();
    startParentBridge();
    watchStorage();
    applyMode(desiredMode(false));
    runScan();
    preloadAhead();
    friendSyncPing();
  }

  function friendSyncPing() {
    const ping = () => {
      try {
        if (chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ type: "GET_DONE_SYNC" }, () => void chrome.runtime.lastError);
        }
      } catch (error) {
        /* not an extension context */
      }
    };
    ping();
    setInterval(ping, 120000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      main();
    }, { once: true });
  } else {
    main();
  }
})();
