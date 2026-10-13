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
  links.value = (state.rawLinks || (state.images || []).join("\n"))
    .split("\n")
    .filter((l) => !GetDoneFriend.isFriendUrl(l.trim()))
    .join("\n");
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
  const prev = await currentState();
  const friendUrls = (prev.images || []).filter((u) => GetDoneFriend.isFriendUrl(u));
  const manual = GetDone.parseLinks(links.value).filter((u) => !GetDoneFriend.isFriendUrl(u));
  const images = manual.concat(friendUrls);
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

load().then(initFriend);

/* ---------- friend link ---------- */
const $ = (id) => document.getElementById(id);
const fmsg = (t, bad) => {
  $("f-msg").textContent = t || "";
  $("f-msg").style.color = bad ? "#ff9b8a" : "";
};
let info = null;

async function showFriend(cfg, data) {
  $("friend-new").hidden = Boolean(cfg);
  $("friend-live").hidden = !cfg;
  if (!cfg) return;
  $("f-name").textContent = cfg.title + " (about " + cfg.expected + " pictures)" + (cfg.due ? ", closes " + new Date(cfg.due).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
  $("f-url").value = cfg.url;
  $("f-close").textContent = cfg.closed ? "Link closed" : "Close link";
  $("f-close").disabled = Boolean(cfg.closed);
  if (!data) return;
  const state = await currentState();
  const sealed = Math.max(0, data.items.length - Math.min(Number(state.revealed) || 0, data.items.length));
  $("f-stats").textContent = data.items.length + " from friends, " + sealed + " still sealed";
  // Only pictures that already unlocked are ever shown here.
  const shown = (state.images || []).slice(0, Number(state.revealed) || 0).filter((u) => GetDoneFriend.isFriendUrl(u));
  $("f-un-h").hidden = shown.length === 0;
  const box = $("f-unlocked");
  box.innerHTML = "";
  for (const url of shown) {
    const token = url.split("/i/")[1];
    const item = data.items.find((i) => i.token === token);
    if (!item) continue;
    const cell = document.createElement("div");
    cell.className = "cell";
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Unlocked picture";
    const no = document.createElement("button");
    no.textContent = "Delete";
    no.className = "mini ghost";
    no.onclick = () => removeItem(item.id);
    cell.append(img, no);
    box.appendChild(cell);
  }
}

async function refreshFriend() {
  const cfg = await GetDoneFriend.getCfg();
  if (!cfg) return showFriend(null);
  showFriend(cfg);
  try {
    const data = await chrome.runtime.sendMessage({ type: "GET_DONE_SYNC", force: true });
    const fresh = await GetDoneFriend.getCfg();
    info = data && data.info;
    await showFriend(fresh, info);
  } catch (e) {
    fmsg("Could not reach the link service. Try again in a minute.", true);
  }
}

async function removeItem(id) {
  const cfg = await GetDoneFriend.getCfg();
  try {
    await GetDoneFriend.api(cfg, GetDoneFriend.ownerPath(cfg, "/items/" + id), { method: "DELETE" });
    await refreshFriend();
    const s = await currentState();
    renderCount(Number(s.revealed) || 0);
  } catch (e) {
    fmsg(e.message, true);
  }
}

async function initFriend() {
  if (GetDoneFriend.API_BASE.includes("REPLACE")) {
    $("friend").hidden = true;
    return;
  }
  await refreshFriend();
}

$("f-create").addEventListener("click", async () => {
  $("f-create").disabled = true;
  fmsg("Making your link...");
  try {
    const n = Math.max(1, Math.min(200, parseInt($("f-n").value, 10) || 10));
    const dueVal = $("f-due").value ? new Date($("f-due").value).getTime() : null;
    if (dueVal && dueVal <= Date.now()) throw new Error("Pick a due time in the future.");
    const assign = $("f-assign").value.trim();
    try {
      const u = new URL(assign);
      if (!/^https?:$/.test(u.protocol)) throw new Error("x");
    } catch (e) {
      throw new Error("Paste the link to the assignment page so the pictures lock to it.");
    }
    await GetDoneFriend.create($("f-title").value.trim() || "Homework", n, dueVal, assign);
    fmsg("");
    await refreshFriend();
  } catch (e) {
    fmsg(e.message, true);
  }
  $("f-create").disabled = false;
});

$("f-import").addEventListener("click", async () => {
  try {
    const raw = $("f-code").value.trim();
    if (!raw.startsWith("GD1.")) throw new Error("That is not a Get Done code.");
    const c = JSON.parse(atob(raw.slice(4)));
    if (!c.id || !c.secret || !c.url || !String(c.url).startsWith(GetDoneFriend.API_BASE + "/")) throw new Error("That code does not look right.");
    await GetDoneFriend.setCfg({ id: c.id, secret: c.secret, url: c.url, title: c.title || "Homework", expected: c.expected || 10, due: c.due || null, assignUrl: c.assignUrl || "" });
    fmsg("");
    await refreshFriend();
  } catch (e) {
    fmsg(e.message, true);
  }
});

$("f-copy").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("f-url").value);
  fmsg("Link copied. Send it to your friends.");
});

$("f-share").addEventListener("click", async () => {
  const cfg = await GetDoneFriend.getCfg();
  const data = {
    title: "Get Done",
    text: "Send me a picture. It unlocks when I finish my homework (" + cfg.title + ").",
    url: cfg.url,
  };
  try {
    if (navigator.share) await navigator.share(data);
    else {
      await navigator.clipboard.writeText(data.text + " " + data.url);
      fmsg("Message and link copied.");
    }
  } catch (e) {
    /* share sheet closed */
  }
});

$("f-close").addEventListener("click", async () => {
  const cfg = await GetDoneFriend.getCfg();
  try {
    await GetDoneFriend.api(cfg, GetDoneFriend.ownerPath(cfg), { method: "PATCH", body: JSON.stringify({ closed: true }) });
    await refreshFriend();
  } catch (e) {
    fmsg(e.message, true);
  }
});

$("f-new").addEventListener("click", async () => {
  await chrome.storage.local.remove(GetDoneFriend.KEY);
  showFriend(null);
});
