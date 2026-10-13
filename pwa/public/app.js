(function () {
  "use strict";
  var API = "https://get-done-friends.prajval-2029.workers.dev";
  var KEY = "getDoneApp";
  var $ = function (id) { return document.getElementById(id); };
  var S = load();

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s && Array.isArray(s.images)) return s;
    } catch (e) {}
    return { images: [], revealed: 0, friend: null, items: {} };
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(S)); }
  function isFriend(u) { return typeof u === "string" && u.indexOf(API + "/i/") === 0; }
  function toast(t) {
    var el = $("toast"); el.textContent = t; el.classList.add("on");
    clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove("on"); }, 2400);
  }
  function parseLinks(text) {
    var seen = {}, out = [];
    text.split(/\r?\n/).forEach(function (l) {
      l = l.trim();
      if (!/^https?:\/\//i.test(l) || seen[l]) return;
      seen[l] = 1; out.push(l);
    });
    return out;
  }
  function img(src, alt) {
    var i = new Image();
    i.referrerPolicy = "no-referrer"; i.decoding = "async"; i.alt = alt || "";
    i.src = src;
    return i;
  }

  // Same placement rule as the extension: new friend pictures go to random spots among the sealed ones.
  function merge(images, revealed, urls) {
    var keep = [], rev = revealed;
    images.forEach(function (u, i) {
      if (isFriend(u) && urls.indexOf(u) < 0) { if (i < revealed) rev -= 1; return; }
      keep.push(u);
    });
    rev = Math.max(0, Math.min(rev, keep.length));
    var have = {}; keep.forEach(function (u) { have[u] = 1; });
    urls.forEach(function (u) {
      if (have[u]) return;
      var pos = rev + Math.floor(Math.random() * (keep.length - rev + 1));
      keep.splice(pos, 0, u); have[u] = 1;
    });
    return { images: keep, revealed: rev };
  }

  async function api(path, opts) {
    opts = opts || {};
    var h = { "content-type": "application/json" };
    if (S.friend && opts.auth) h.authorization = "Bearer " + S.friend.secret;
    var r = await fetch(API + path, { method: opts.method || "GET", headers: h, body: opts.body });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || "Something went wrong (" + r.status + ")");
    return j;
  }

  var syncing = false;
  async function sync() {
    if (!S.friend || syncing || !navigator.onLine) return;
    syncing = true;
    try {
      var info = await api("/api/owner/" + S.friend.id, { auth: true });
      var urls = [], items = {};
      info.items.forEach(function (it) { var u = API + "/i/" + it.token; urls.push(u); items[u] = { id: it.id, who: it.uploader || "", note: it.caption || "" }; });
      var m = merge(S.images, S.revealed, urls);
      S.images = m.images; S.revealed = m.revealed; S.items = items;
      S.friend.title = info.title; S.friend.expected = info.expected; S.friend.due = info.due; S.friend.closed = info.closed;
      save(); render();
    } catch (e) {
      if (/Not allowed/.test(e.message)) { S.friend = null; save(); render(); }
    } finally { syncing = false; }
  }

  function render() {
    var total = S.images.length, shown = Math.min(S.revealed, total), left = total - shown;
    $("count").textContent = total ? shown + " shown, " + left + " left" : "";
    var st = $("stage"); st.textContent = "";
    if (shown > 0) {
      var im = img(S.images[shown - 1], "Latest picture");
      im.onerror = function () { st.textContent = ""; st.appendChild(sealedBox("\u26A0", "Picture did not load", "Check the link or your connection.")); };
      im.onclick = function () { view(S.images[shown - 1]); };
      st.appendChild(im);
    } else if (total) {
      st.appendChild(sealedBox("\uD83D\uDD12", total + (total === 1 ? " picture" : " pictures") + " sealed", "Finish a question, then tap the button."));
    } else {
      st.appendChild(sealedBox("\uD83D\uDDBC", "No pictures yet", "Add some below, or send a friend link."));
    }
    var btn = $("done");
    btn.disabled = left <= 0;
    $("hint").textContent = !total ? "" : left > 0 ? "Tap only after you really finish one." : "That is all of them. Add more below.";
    // gallery
    var g = $("gallery"); g.textContent = "";
    for (var i = shown - 1; i >= 0; i--) g.appendChild(thumb(S.images[i]));
    $("gal-empty").hidden = shown > 0;
    // textarea shows only own pictures
    var own = S.images.filter(function (u) { return !isFriend(u); });
    if (document.activeElement !== $("links")) $("links").value = own.join("\n");
    renderFriend();
  }
  function sealedBox(icon, title, sub) {
    var d = document.createElement("div"); d.className = "sealed";
    var l = document.createElement("div"); l.className = "lock"; l.textContent = icon;
    var b = document.createElement("b"); b.textContent = title;
    var s = document.createElement("span"); s.textContent = sub;
    d.appendChild(l); d.appendChild(b); d.appendChild(s); return d;
  }
  function thumb(u) {
    var d = document.createElement("div"); d.className = "th";
    var i = img(u, ""); i.loading = "lazy"; i.onclick = function () { view(u); };
    d.appendChild(i);
    var meta = S.items && S.items[u];
    if (meta) {
      if (meta.who) { var w = document.createElement("div"); w.className = "who"; w.textContent = "from " + meta.who; d.appendChild(w); }
      var x = document.createElement("button"); x.className = "x"; x.type = "button"; x.setAttribute("aria-label", "Delete this picture"); x.textContent = "\u00D7";
      x.onclick = function (e) { e.stopPropagation(); removeFriendPic(u); };
      d.appendChild(x);
    }
    return d;
  }
  function view(u) { var v = $("viewer"); v.querySelector("img").src = u; v.hidden = false; }
  $("vclose").onclick = function () { $("viewer").hidden = true; };
  $("viewer").onclick = function (e) { if (e.target === $("viewer")) $("viewer").hidden = true; };

  async function removeFriendPic(u) {
    var meta = S.items[u];
    if (!meta || !confirm("Delete this picture for good?")) return;
    try {
      await api("/api/owner/" + S.friend.id + "/items/" + meta.id, { method: "DELETE", auth: true });
      var idx = S.images.indexOf(u);
      if (idx >= 0) { S.images.splice(idx, 1); if (idx < S.revealed) S.revealed -= 1; }
      delete S.items[u]; save(); render(); toast("Deleted");
    } catch (e) { toast(e.message); }
  }

  var lock = false;
  $("done").onclick = function () {
    if (lock || S.revealed >= S.images.length) return;
    lock = true; setTimeout(function () { lock = false; }, 700);
    S.revealed += 1; save(); render();
    if (navigator.vibrate) navigator.vibrate(20);
    sync();
  };
  $("save").onclick = function () {
    var own = parseLinks($("links").value);
    var friends = S.images.filter(isFriend);
    var firstOwnSealed = S.images.slice(0, S.revealed);
    var rest = own.filter(function (u) { return firstOwnSealed.indexOf(u) < 0; });
    // Keep what is already shown; replace the sealed own pictures with the new list, keep friend pictures where they are.
    var sealedFriends = friends.filter(function (u) { return S.images.indexOf(u) >= S.revealed; });
    S.images = firstOwnSealed.concat(rest, sealedFriends);
    var m = merge(S.images, S.revealed, friends);
    S.images = m.images; S.revealed = m.revealed;
    save(); render(); toast(own.length + (own.length === 1 ? " picture saved" : " pictures saved"));
  };
  $("reset").onclick = function () {
    if (!confirm("Re-seal every picture and start over?")) return;
    S.revealed = 0; save(); render();
  };

  // friend link
  function renderFriend() {
    var f = S.friend;
    $("fl-new").hidden = !!f; $("fl-live").hidden = !f;
    if (!f) return;
    $("f-name").textContent = f.title || "Friend link";
    $("f-url").value = f.url;
    var got = Object.keys(S.items || {}).length;
    var s = got + (got === 1 ? " picture" : " pictures") + " received";
    if (f.due) s += ". " + (f.closed ? "Closed" : "Closes") + " " + new Date(f.due).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    $("f-status").textContent = s;
  }
  $("f-create").onclick = async function () {
    var b = $("f-create");
    var title = $("f-title").value.trim() || "Homework";
    var n = parseInt($("f-n").value, 10) || 10;
    var due = $("f-due").value ? new Date($("f-due").value).getTime() : null;
    b.disabled = true;
    try {
      var r = await api("/api/links", { method: "POST", body: JSON.stringify({ title: title, expected: n, dueAt: due }) });
      S.friend = { id: r.id, secret: r.secret, url: r.url, title: title, expected: n, due: due };
      save(); render(); toast("Link ready");
    } catch (e) { toast(e.message); }
    b.disabled = false;
  };
  $("f-share").onclick = async function () {
    var data = { title: "Send me a picture", text: "Send a picture that unlocks when I finish my homework", url: S.friend.url };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(S.friend.url); toast("Link copied"); }
    } catch (e) {}
  };
  $("f-copy").onclick = async function () {
    try { await navigator.clipboard.writeText(S.friend.url); toast("Link copied"); }
    catch (e) { $("f-url").select(); toast("Press copy on your keyboard"); }
  };
  $("f-stop").onclick = async function () {
    if (!confirm("Remove this link and delete every picture friends sent? This cannot be undone.")) return;
    try {
      await api("/api/owner/" + S.friend.id + "/delete", { method: "POST", auth: true });
      S.images = S.images.filter(function (u) { return !isFriend(u); });
      S.revealed = Math.min(S.revealed, S.images.length);
      S.friend = null; S.items = {}; save(); render(); toast("Link removed");
    } catch (e) { toast(e.message); }
  };

  document.addEventListener("visibilitychange", function () { if (!document.hidden) sync(); });
  window.addEventListener("online", sync);
  render(); sync();
  setInterval(function () { if (!document.hidden) sync(); }, 45000);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(function () {});
})();
