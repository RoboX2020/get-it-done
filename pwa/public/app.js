(function () {
  "use strict";
  var API = "https://get-done-friends.prajval-2029.workers.dev";
  var KEY = "getDoneAppLink";
  var $ = function (id) { return document.getElementById(id); };
  var S = load();

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s && s.friend) return s;
    } catch (e) {}
    return { friend: null, count: 0 };
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(S)); }
  function toast(t) {
    var el = $("toast"); el.textContent = t; el.classList.add("on");
    clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove("on"); }, 2400);
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

  // Only the count comes back to this screen. No picture is ever fetched or drawn here.
  var syncing = false;
  async function sync() {
    if (!S.friend || syncing || !navigator.onLine) return;
    syncing = true;
    try {
      var info = await api("/api/owner/" + S.friend.id, { auth: true });
      S.count = info.items.length;
      S.friend.title = info.title; S.friend.expected = info.expected; S.friend.due = info.due; S.friend.closed = info.closed;
      save(); render();
    } catch (e) {
      if (/Not allowed/.test(e.message)) { S.friend = null; save(); render(); }
    } finally { syncing = false; }
  }

  function render() {
    var f = S.friend;
    $("fl-new").hidden = !!f; $("fl-live").hidden = !f;
    if (!f) return;
    $("f-name").textContent = f.title || "Friend link";
    $("f-assign-show").textContent = f.assignUrl ? "Locked to: " + f.assignUrl : "";
    $("f-url").value = f.url;
    var s = S.count + (S.count === 1 ? " picture" : " pictures") + " received";
    if (f.due) s += ". " + (f.closed ? "Closed" : "Closes") + " " + new Date(f.due).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    $("f-status").textContent = s;
  }

  $("f-create").onclick = async function () {
    var b = $("f-create");
    var title = $("f-title").value.trim() || "Homework";
    var assign = $("f-assign").value.trim();
    try {
      var u = new URL(assign);
      if (!/^https?:$/.test(u.protocol)) throw new Error("x");
    } catch (e) { toast("Paste the link to the assignment page first."); return; }
    var n = parseInt($("f-n").value, 10) || 10;
    var due = $("f-due").value ? new Date($("f-due").value).getTime() : null;
    b.disabled = true;
    try {
      var r = await api("/api/links", { method: "POST", body: JSON.stringify({ title: title, expected: n, dueAt: due }) });
      S.friend = { id: r.id, secret: r.secret, url: r.url, title: title, expected: n, due: due, assignUrl: assign };
      S.count = 0; save(); render(); toast("Link ready");
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
  $("f-pair").onclick = async function () {
    var f = S.friend;
    var code = "GD1." + btoa(JSON.stringify({ id: f.id, secret: f.secret, url: f.url, title: f.title, expected: f.expected, due: f.due, assignUrl: f.assignUrl }));
    try { await navigator.clipboard.writeText(code); toast("Code copied"); }
    catch (e) { toast("Could not copy"); }
  };
  $("f-stop").onclick = async function () {
    if (!confirm("Remove this link and delete every picture friends sent? This cannot be undone.")) return;
    try {
      await api("/api/owner/" + S.friend.id + "/delete", { method: "POST", auth: true });
      S.friend = null; S.count = 0; save(); render(); toast("Link removed");
    } catch (e) { toast(e.message); }
  };

  document.addEventListener("visibilitychange", function () { if (!document.hidden) sync(); });
  window.addEventListener("online", sync);
  render(); sync();
  setInterval(function () { if (!document.hidden) sync(); }, 45000);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(function () {});
})();
