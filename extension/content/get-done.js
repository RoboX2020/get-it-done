// ============================================================================
// Get Done - a browser extension that turns homework into a reward game.
//
// THE IDEA: you paste a list of picture links (one per homework question).
// The extension watches your homework page; each time the page shows that
// you finished a question, the next picture is revealed with a little
// celebration. Finish the set, see them all.
//
// THE PIECES (this repo):
//   extension/lib/detect.js      recognizes WHICH homework site this is and
//                                reads "Question 3 of 12" labels off the page
//   extension/content/get-done.js  THIS FILE: the panel on the homework page
//                                and all the watching logic
//   extension/content/get-done.css the panel's look
//   extension/background.js      keeps the toolbar icon's number badge fresh
//   extension/popup/*            the small settings window from the toolbar
//   demo/*                       a fake homework page to try it without
//                                installing the extension
//
// HOW THIS FILE WORKS, BIG PICTURE:
//   1. main() loads saved state, mounts the panel, and starts watching.
//   2. Watchers (DOM changes, clicks, URL changes) trigger runScan().
//   3. runScan() asks "what question is on screen?" (scanDocument) and
//      "did the page just mark something correct?" (scanCompletion).
//   4. When a question is completed, it is "witnessed"; when the student
//      moves on to the next question, the completed one is "paid" - and
//      reveal() shows the next picture. A question never pays twice.
//   5. Some sites load questions inside iframes; the frame copy of this
//      script reports findings up to the top page (postMessage bridge).
//
// WHEN DEBUGGING (reasoned from the code):
//   - Panel never appears: the site must be recognized (see the platform
//     list in lib/detect.js), or use the toolbar popup to open it manually.
//   - Rewards not triggering: completion detection looks for "correct /
//     submitted" words and classes near the top of the page; heavily
//     customized homework themes may not match - check scanCompletion().
//   - state lives in chrome.storage.local (key "getDoneState"); the demo
//     page uses localStorage with the same key.
// ============================================================================
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

  // Finds the panel stylesheet - as an installed extension (chrome.runtime URL) or on the demo page (next to this script).
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

  // Defensive copy: turns a stored value into a plain object, or an empty one.
  function asMap(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return { ...value };
  }

  // Checks a saved panel position/size actually contains real numbers.
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

  // Cleans whatever was loaded from storage into a complete state object with safe defaults.
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

  // The plain-data version of the current state, ready to save.
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

  // Keep a number inside a range.
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // Where the panel first appears: right edge, vertically centered.
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

  // Keep the panel fully on screen (after drags and window resizes).
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

  // True when running on the bundled demo page instead of inside a real browser extension.
  function isDemo() {
    return document.documentElement.dataset.getDoneDemo === "true";
  }

  // Built-in sample pictures for the demo page.
  function demoImageUrls() {
    return [1, 2, 3, 4, 5, 6, 7, 8].map((number) => {
      return `${location.origin}/rewards/${String(number).padStart(2, "0")}.jpg`;
    });
  }

  // Which homework site is this? Ask lib/detect.js, matching the site address.
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

  // Fallback: sniff the page's own HTML for platform clues.
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

  // The sessionStorage key used to remember the current question on this site.
  function questionKey() {
    return `getDoneQ:${location.host}`;
  }

  // Which question were you last on? (remembered so a reload does not pay out again)
  function readQ() {
    try {
      const stored = sessionStorage.getItem(questionKey());
      if (stored == null || stored === "") return memoryQ;
      return stored;
    } catch (error) {
      return memoryQ;
    }
  }

  // Store the current question id.
  function writeQ(value) {
    if (value == null || value === "") return;
    memoryQ = String(value);
    try {
      sessionStorage.setItem(questionKey(), memoryQ);
    } catch (error) {
      /* sandboxed frames can throw */
    }
  }

  // The numeric index of the last question (to tell forward from backward).
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

  // Store the current question index.
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

  // sessionStorage key for the furthest question reached.
  function highKey() {
    return `getDoneHigh:${location.host}`;
  }

  // sessionStorage key for the "final submit already paid" marker.
  function finishKey() {
    return `getDoneFinished:${location.host}`;
  }

  // The furthest question number reached this session.
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

  // Record the furthest question number reached.
  function writeHigh(value) {
    memoryHigh = value;
    try {
      sessionStorage.setItem(highKey(), String(value));
    } catch (error) {
      /* sandboxed frames can throw */
    }
  }

  // localStorage key for the set of questions seen completed.
  function verifiedKey() {
    return `getDoneVerified:${location.host}`;
  }

  // localStorage key for the set of questions already rewarded.
  function paidKey() {
    return `getDonePaid:${location.host}`;
  }

  const memorySets = {};

  // Read one of those stored id sets (a map of question id to true).
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

  // Write one of those stored id sets back.
  function writeIdSet(key, values) {
    const list = [...values].filter((value) => typeof value === "string" && value);
    memorySets[key] = list;
    try {
      sessionStorage.setItem(key, JSON.stringify(list));
    } catch (error) {
      /* ignore */
    }
  }

  // Tidy a question id into one consistent form.
  function normalizeQuestionId(value) {
    if (value == null || value === "") return null;
    if (typeof value === "string") return value;
    if (Number.isFinite(value) && value >= 1) return String(value);
    return null;
  }

  // Has this question been seen completed yet?
  function isVerified(questionId) {
    const key = normalizeQuestionId(questionId);
    if (!key) return false;
    return readIdSet(verifiedKey()).has(key);
  }

  // Has a picture already been given out for this question?
  function isPaid(questionId) {
    const key = normalizeQuestionId(questionId);
    if (!key) return false;
    return readIdSet(paidKey()).has(key);
  }

  // Record a question as completed (verified).
  function witness(questionId) {
    const key = normalizeQuestionId(questionId);
    if (!key) return;
    const verified = readIdSet(verifiedKey());
    if (verified.has(key)) return;
    verified.add(key);
    writeIdSet(verifiedKey(), verified);
    updateStatusLine();
  }

  // Send a message from an embedded frame up to the top page.
  function postToTop(payload) {
    if (window.top === window) return false;
    try {
      window.top.postMessage({ source: QUESTION_MESSAGE, ...payload }, "*");
      return true;
    } catch (error) {
      return false;
    }
  }

  // witness() plus notify the top page when inside a frame.
  function witnessQuestion(questionNumber) {
    if (postToTop({ kind: "witness", question: questionNumber })) return;
    witness(questionNumber);
  }

  // Note "student clicked Next with an answer filled in": if a new question loads right after, count the previous one done.
  function armAdvance(questionNumber) {
    const payload = { question: questionNumber, at: Date.now() };
    if (postToTop({ kind: "armed", ...payload })) return;
    armedAttempt = payload;
  }

  // Record that a question has had its reward picture.
  function markPaid(questionId) {
    const key = normalizeQuestionId(questionId);
    if (!key) return;
    const paid = readIdSet(paidKey());
    paid.add(key);
    writeIdSet(paidKey(), paid);
  }

  // Forget the per-question tracking (used by "Start over").
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

  // Only auto-track on recognized homework sites (or the demo).
  function trackingEnabled() {
    const origin = location.origin;
    if (state.dismissedOrigins[origin]) return false;
    if (platform) return true;
    return Boolean(state.enabledOrigins[origin]);
  }

  // Open the full panel when confident a question is on screen; otherwise just the edge tab.
  function desiredMode(strongQuestion) {
    const origin = location.origin;
    if (state.dismissedOrigins[origin]) return "gone";
    const known = Boolean(platform) || Boolean(state.enabledOrigins[origin]);
    if (known) return state.minimizedOrigins[origin] ? "tab" : "open";
    if (strongQuestion) return "tab";
    return "gone";
  }

  // Which screen edge the minimized tab sits on.
  function tabSide() {
    if (state.geometry.dock === "left") return "left";
    if (state.geometry.dock === "right") return "right";
    const geometry = state.geometry;
    const left = geometry.x;
    const right = window.innerWidth - (geometry.x + geometry.w);
    return left <= right ? "left" : "right";
  }

  // Put the panel where the saved state says it should be.
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

  // Highlight the active Left/Right dock button.
  function updateDockButtons() {
    if (!leftBtn) return;
    leftBtn.setAttribute("aria-pressed", String(state.geometry.dock === "left"));
    rightBtn.setAttribute("aria-pressed", String(state.geometry.dock === "right"));
  }

  // Show the platform name on the panel (e.g. "Canvas").
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

  // The "3 of 12" pictures counter.
  function updateFraction() {
    if (!fraction) return;
    const total = state.images.length;
    fraction.textContent = total ? `${state.revealed}/${total}` : "0";
  }

  // The progress bar toward finishing all pictures.
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

  // The small status text at the panel's foot.
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
      statusLine.textContent = `${place}. Recorded. The picture flashes when you move on.`;
    } else {
      statusLine.textContent = `${place}. Sealed until this page records the question.`;
    }
  }

  // Switch the stage between empty / waiting / photo / broken.
  function setView(view) {
    stage.dataset.view = view;
    const caption = shadow.querySelector(".caption");
    if (caption) caption.hidden = view !== "photo";
  }

  // Redraw the stage for the current state.
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

  // Switch between gone (hidden), tab (edge tab) and open (full panel).
  function applyMode(next) {
    mode = next;
    if (!host) return;
    host.style.display = next === "gone" ? "none" : "block";
    panel.hidden = next !== "open";
    tab.hidden = next !== "tab";
    if (next === "open") renderStage();
    else updateFraction();
  }

  // Show or hide the paste-links form.
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

  // The "N pictures ready" text under the textarea.
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

  // Save the pasted picture links into storage.
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

  // Quietly pre-load the next couple of pictures so rewards appear instantly.
  function preloadAhead() {
    state.images.slice(state.revealed, state.revealed + 2).forEach((url) => {
      const image = new Image();
      image.referrerPolicy = "no-referrer";
      image.src = url;
    });
  }

  // Pin the panel to the left or right screen edge.
  function dock(side, persist) {
    state.geometry.dock = side === "left" ? "left" : "right";
    clampGeometry();
    applyGeometry();
    updateDockButtons();
    if (persist !== false) save();
  }

  // After dragging, snap the panel to the nearest edge.
  function snapDock() {
    const geometry = state.geometry;
    if (geometry.x <= 28) dock("left", false);
    else if (window.innerWidth - (geometry.x + geometry.w) <= 28) dock("right", false);
    else {
      applyGeometry();
      updateDockButtons();
    }
  }

  // Show the full panel.
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

  // Shrink the panel down to the edge tab.
  function minimize() {
    state.minimizedOrigins[location.origin] = true;
    save();
    applyMode("tab");
  }

  // Hide everything on this site until a new question appears.
  function dismiss() {
    state.dismissedOrigins[location.origin] = true;
    save();
    applyMode("gone");
  }

  // "Start over" needs two clicks: the first arms it, the second confirms.
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

  // Small promise-based sleep.
  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Quick attention flash on the panel.
  function pulse() {
    stage.classList.remove("is-flashing");
    void stage.offsetWidth;
    stage.classList.add("is-flashing");
    setTimeout(() => stage.classList.remove("is-flashing"), 700);
  }

  // Swap in a newly revealed picture with the flash/sparks animation.
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

  // Queue up N reward reveals one at a time (chain keeps animations in order).
  function reveal(count, reason) {
    const total = Math.max(0, count | 0);
    for (let index = 0; index < total; index += 1) {
      chain = chain.then(() => revealOne(reason)).catch(() => {});
    }
  }

  // Show the next picture: open the panel, count it, animate it, then re-minimize if you were not looking.
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

  // Read the page for signs the current question was marked correct ("accepted") or wrong ("rejected").
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

  // If the page says the current question is done, witness it.
  function noteCompletion(questionId) {
    const key = normalizeQuestionId(questionId) || (detected && detected.key);
    if (!key) return;
    if (scanCompletion() === "accepted") witnessQuestion(key);
  }

  // The question on screen changed: if the previous one was verified but unpaid, pay it out now.
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
    if (!isVerified(left) || isPaid(left)) return;
    markPaid(left);
    reveal(1, "auto");
  }

  // A (possibly new) question is on screen: update tracking and handle question-change payouts.
  function noteQuestion(question) {
    if (!question || !question.key) return;
    detected = question;
    updateStatusLine();
    const strong =
      question.kind === "slug"
        ? Boolean(question.confident)
        : Boolean(question.total) && question.confident !== false;
    if (!trackingEnabled()) {
      if (strong && !state.dismissedOrigins[location.origin] && mode === "gone") applyMode("tab");
      return;
    }
    if (mode === "gone") applyMode(desiredMode(strong));
    maybeAdvance(question);
  }

  // Does this element look like the "current step" marker?
  function isCurrent(element) {
    const aria = element.getAttribute("aria-current");
    if (aria && aria !== "false") return true;
    const className = typeof element.className === "string" ? element.className : "";
    return /\b(active|current|selected|is-active)\b/i.test(className);
  }

  // Rank a possible question label (confident, labeled, near the top and active score higher).
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

  // Search the page for the best "Question X of Y" label and return the winner.
  function scanDocument() {
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
    if (titleHit) found.push({ ...titleHit, score: scoreCandidate(titleHit, document.title, 0, true) });

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
  // Wait a beat after the page changes, then scan (pages update in bursts).
  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(runScan, 220);
  }

  // Re-check which homework site this is and update the labels if it changed.
  function refreshPlatform() {
    const next = detectPlatform();
    const same = (next && next.id) === (platform && platform.id);
    if (same) return;
    platform = next;
    updatePill();
    updateStatusLine();
  }

  // The regular scan: find the current question and completion state; inside an iframe, report up to the top page instead.
  function runScan() {
    if (document.hidden) return;
    const question = scanDocument();
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

  // Has the student actually entered an answer yet?
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

  // Is this button a "Next / Continue / Submit" (but not "Check answer")?
  function isAdvanceControl(label) {
    if (/\bcheck answer\b/i.test(label)) return false;
    return /\b(next|continue|submit|save and continue|next question|next problem|next item)\b/i.test(label);
  }
  const FINISH_RE = /\b(submit quiz|submit assignment|submit exam|submit homework|finish attempt|finish quiz|finish homework|turn in|complete quiz|complete assignment)\b/i;

  // Best human-readable label for a clicked button.
  function controlLabel(control) {
    return [
      control.getAttribute("aria-label"),
      control.getAttribute("title"),
      control.innerText,
      control.value,
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, 120);
  }

  // Is this the final "Submit quiz / assignment" button?
  function isTerminalFinish(label) {
    return FINISH_RE.test(label) || /^submit$/i.test(label);
  }

  // On the final submit of the last question, pay out the last reward (once only).
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
    markPaid(detected.key);
    reveal(1, "auto");
  }

  // Watch every click: note completions, arm Next-advances, handle final submits, rescan after navigation.
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

  // Set up the page watchers: DOM changes, clicks, and URL changes (homework sites update without reloading).
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
    window.addEventListener("hashchange", scheduleScan);
    window.addEventListener("popstate", scheduleScan);
    setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        scheduleScan();
      }
    }, 900);
  }

  // A summary of the current state, for the toolbar popup.
  function statusPayload() {
    return {
      platform: platform ? platform.name : null,
      question: detected,
      revealed: state.revealed,
      totalImages: state.images.length,
      mode,
    };
  }

  // Handle commands from the toolbar popup (show / toggle / reset / dock / status).
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

  // Turn a report from an embedded frame into a question object.
  function hydrateQuestionMessage(data) {
    if (!data || !data.key) return null;
    const kind = data.kindType === "slug" ? "slug" : "numeric";
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

  // In the TOP page: listen for reports from embedded frames (some sites load questions in iframes).
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

  // Handle messages arriving from other frames.
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

  // React when the popup changes saved state (new links, reset) from elsewhere.
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

  // Pointer moving while dragging the panel.
  function moveDrag(event) {
    const geometry = state.geometry;
    geometry.dock = "free";
    geometry.x = clamp(event.clientX - dragDx, 8, Math.max(8, window.innerWidth - geometry.w - 8));
    geometry.y = clamp(event.clientY - dragDy, 8, Math.max(8, window.innerHeight - geometry.h - 8));
    applyGeometry();
    updateDockButtons();
  }

  // Pointer moving while resizing the panel.
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

  // Pointer released: end the drag or resize.
  function endPointer() {
    if (!dragging && !resizing) return;
    dragging = false;
    resizing = false;
    resize = null;
    topbar.classList.remove("is-dragging");
    snapDock();
    save();
  }

  // Wire up all the panel's buttons and drag/resize handles.
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

  // Create the panel's shadow-DOM host on the page (once). Shadow DOM keeps the panel's CSS from clashing with the homework site.
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

  // Start everything: load saved state, mount the panel, scan once, and begin watching.
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      main();
    }, { once: true });
  } else {
    main();
  }
})();
