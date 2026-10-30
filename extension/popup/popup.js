// ============================================================================
// popup.js - the toolbar popup: the extension's settings window.
// Paste picture links here (saved to storage for the panel to use), see
// which homework site and question the current tab is on, open/dock the
// panel, and reset progress. It talks to the homework tab by sending
// messages to the content script (GET_DONE_STATUS, GET_DONE_SHOW, ...).
// ============================================================================
const links = document.querySelector("#links");
const count = document.querySelector("#count");
const progress = document.querySelector("#progress");
const status = document.querySelector("#status");
const fine = document.querySelector("#fine");

fine.textContent =
  "Recognizes Canvas, Pearson, Edfinity, Blackboard, Brightspace, Moodle, McGraw Hill, Cengage, WebAssign, ALEKS, DeltaMath, and other homework sites. Ctrl+Shift+Period shows the panel.";

function renderCount(revealed) {
  const urls = GetDone.parseLinks(links.value);
  count.textContent = urls.length
    ? `${urls.length} picture${urls.length === 1 ? "" : "s"} ready`
    : "One link per line. Five, ten, or forty-five.";
  if (typeof revealed === "number" && urls.length) {
    const left = Math.max(0, urls.length - revealed);
    progress.textContent = `${revealed} shown · ${left} left`;
  } else {
    progress.textContent = "";
  }
}

async function currentState() {
  const data = await chrome.storage.local.get("getDoneState");
  return data.getDoneState || { rawLinks: "", images: [], revealed: 0 };
}

async function load() {
  const state = await currentState();
  links.value = state.rawLinks || (state.images || []).join("\n");
  renderCount(Number(state.revealed) || 0);
  await refreshStatus();
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch (error) {
    return "";
  }
}

async function refreshStatus() {
  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (error) {
    tab = null;
  }
  if (!tab || tab.id == null) {
    status.textContent = "Open your homework, then come back here.";
    return;
  }
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_DONE_STATUS" });
    if (!response) {
      status.textContent = "Reload the page, then open Get Done again.";
      return;
    }
    if (response.platform) {
      const question = response.question;
      let detail = "";
      if (question && question.key) {
        detail =
          question.kind === "slug"
            ? ` Problem ${question.label || question.key}.`
            : question.total
              ? ` Question ${question.index ?? question.key} of ${question.total}.`
              : ` Question ${question.label || question.key}.`;
      }
      status.textContent = `Watching ${response.platform}.${detail}`;
      return;
    }
    status.textContent = "This page is not a recognized homework site. You can still open the panel.";
  } catch (error) {
    const known = GetDone.platformFromHost(hostOf(tab.url));
    status.textContent = known
      ? `${known.name} is open. Reload the page so Get Done can attach.`
      : "Open a homework page, or reload this tab, to show the panel.";
  }
}

async function send(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) return;
  try {
    await chrome.tabs.sendMessage(tab.id, message);
    await refreshStatus();
  } catch (error) {
    status.textContent = "Reload the homework page, then try again.";
  }
}

document.querySelector("#save").addEventListener("click", async () => {
  const images = GetDone.parseLinks(links.value);
  const prev = await currentState();
  let revealed = Number(prev.revealed) || 0;
  if (revealed > images.length) revealed = images.length;
  await chrome.storage.local.set({
    getDoneState: {
      ...prev,
      rawLinks: links.value,
      images,
      revealed,
    },
  });
  renderCount(revealed);
  status.textContent = images.length
    ? `Saved ${images.length} picture${images.length === 1 ? "" : "s"}.`
    : "Cleared the picture list.";
});

document.querySelector("#open").addEventListener("click", () => {
  send({ type: "GET_DONE_SHOW" });
});

document.querySelector("#left").addEventListener("click", () => {
  send({ type: "GET_DONE_DOCK", side: "left" });
});

document.querySelector("#right").addEventListener("click", () => {
  send({ type: "GET_DONE_DOCK", side: "right" });
});

document.querySelector("#reset").addEventListener("click", async () => {
  const prev = await currentState();
  await chrome.storage.local.set({
    getDoneState: {
      ...prev,
      revealed: 0,
    },
  });
  renderCount(0);
  await send({ type: "GET_DONE_RESET" });
});

links.addEventListener("input", () => {
  const urls = GetDone.parseLinks(links.value);
  count.textContent = urls.length
    ? `${urls.length} picture${urls.length === 1 ? "" : "s"} ready`
    : "One link per line. Five, ten, or forty-five.";
});

load();
