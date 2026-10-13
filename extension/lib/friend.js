(function (root) {
  // Friend links: friends upload pictures to a small Cloudflare Worker. Pictures stay sealed
  // in this extension until each homework question is finished, in a random order.
  const API_BASE = "https://get-done-friends.prajval-2029.workers.dev";
  const KEY = "getDoneFriend";

  async function api(cfg, path, options) {
    const res = await fetch(API_BASE + path, {
      ...options,
      headers: { "content-type": "application/json", ...(cfg ? { authorization: "Bearer " + cfg.secret } : {}), ...((options && options.headers) || {}) },
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || "Request failed (" + res.status + ")");
    }
    return res.json();
  }

  async function getCfg() {
    const d = await chrome.storage.local.get(KEY);
    return d[KEY] || null;
  }
  const setCfg = (cfg) => chrome.storage.local.set({ [KEY]: cfg });

  async function create(title, expected, dueAt, assignUrl) {
    const r = await api(null, "/api/links", { method: "POST", body: JSON.stringify({ title, expected, dueAt }) });
    const cfg = { id: r.id, secret: r.secret, url: r.url, title, expected, due: dueAt || null, assignUrl: assignUrl || "" };
    await setCfg(cfg);
    return cfg;
  }

  const ownerPath = (cfg, rest) => "/api/owner/" + cfg.id + (rest || "");
  const imageUrl = (token) => API_BASE + "/i/" + token;
  const isFriendUrl = (u) => typeof u === "string" && u.startsWith(API_BASE + "/i/");

  // Place newly approved pictures at random spots among the ones not yet shown.
  function mergeApproved(images, revealed, approvedUrls, rand) {
    // Drop friend pictures that no longer exist (deleted after unlocking); keep the shown count right.
    const keep = [];
    let rev = revealed;
    images.forEach((u, i) => {
      if (isFriendUrl(u) && !approvedUrls.includes(u)) {
        if (i < revealed) rev -= 1;
        return;
      }
      keep.push(u);
    });
    rev = Math.max(0, Math.min(rev, keep.length));
    const have = new Set(keep);
    for (const url of approvedUrls) {
      if (have.has(url)) continue;
      const pos = rev + Math.floor(rand() * (keep.length - rev + 1));
      keep.splice(pos, 0, url);
      have.add(url);
    }
    return { images: keep, revealed: rev };
  }

  let running = null;
  async function sync() {
    if (running) return running;
    running = (async () => {
      const cfg = await getCfg();
      if (!cfg) return null;
      const info = await api(cfg, ownerPath(cfg));
      const approvedUrls = info.items.filter((i) => i.status === "approved").map((i) => imageUrl(i.token));
      const data = await chrome.storage.local.get("getDoneState");
      const state = data.getDoneState || { images: [], revealed: 0 };
      const merged = mergeApproved(state.images || [], Number(state.revealed) || 0, approvedUrls, Math.random);
      if (merged.images.join("\n") !== (state.images || []).join("\n")) {
        await chrome.storage.local.set({ getDoneState: { ...state, images: merged.images, revealed: merged.revealed } });
      }
      await setCfg({ ...cfg, title: info.title, expected: info.expected, due: info.due || null, closed: info.closed });
      return info;
    })().finally(() => {
      running = null;
    });
    return running;
  }

  root.GetDoneFriend = { API_BASE, KEY, api, getCfg, setCfg, create, ownerPath, imageUrl, isFriendUrl, mergeApproved, sync };
  if (typeof module === "object" && module.exports) module.exports = root.GetDoneFriend;
})(typeof globalThis !== "undefined" ? globalThis : this);
