if (typeof importScripts === "function") importScripts("lib/friend.js");

let lastSync = 0;
async function friendSync(force) {
  if (!globalThis.GetDoneFriend) return null;
  if (!force && Date.now() - lastSync < 45000) return null;
  lastSync = Date.now();
  try {
    return await GetDoneFriend.sync();
  } catch (error) {
    return null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "GET_DONE_SYNC") return false;
  friendSync(Boolean(message.force)).then((info) => sendResponse({ ok: true, info }));
  return true;
});

async function refreshBadge() {
  const { getDoneState } = await chrome.storage.local.get("getDoneState");
  const images = (getDoneState && getDoneState.images) || [];
  const revealed = (getDoneState && getDoneState.revealed) || 0;
  const left = Math.max(0, images.length - revealed);
  try {
    await chrome.action.setBadgeBackgroundColor({ color: "#E6A23C" });
    if (chrome.action.setBadgeTextColor) {
      await chrome.action.setBadgeTextColor({ color: "#1A1612" });
    }
  } catch (error) {
    /* older browsers ignore text color */
  }
  await chrome.action.setBadgeText({ text: images.length ? String(Math.min(left, 99)) : "" });
}

chrome.runtime.onInstalled.addListener(() => {
  refreshBadge();
});

chrome.runtime.onStartup.addListener(() => {
  refreshBadge();
  friendSync(true);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.getDoneState) refreshBadge();
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-panel") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "GET_DONE_TOGGLE" });
  } catch (error) {
    /* page has no content script yet */
  }
});

refreshBadge();
