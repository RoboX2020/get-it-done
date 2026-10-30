// ============================================================================
// background.js - the extension's always-on helper (a service worker).
// Two jobs:
//   1. Keep the little number on the toolbar icon up to date: how many
//      reward pictures are still sealed (it re-reads storage whenever it
//      changes, and when the browser starts).
//   2. Forward the keyboard shortcut (toggle-panel) to the content script
//      on the current tab, so Ctrl+Shift+Period opens/closes the panel.
// It never sees page content itself - it just passes messages.
// ============================================================================
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
