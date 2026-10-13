import { friendPage, HOME } from "./pages.js";

const MAX_BYTES = 1500000;
const MAX_PER_LINK = 80;
const SEC = 1000;

const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...cors(), ...extra },
  });
const cors = () => ({
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization,content-type",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
});

function rand(bytes = 16) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function toB64(buf) {
  const u = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b64) {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
const clean = (s, n) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);

let ready;
async function init(db) {
  if (!ready) {
    ready = db.batch([
      db.prepare("CREATE TABLE IF NOT EXISTS links (id TEXT PRIMARY KEY, secret_hash TEXT NOT NULL, title TEXT NOT NULL, expected INTEGER NOT NULL, auto_approve INTEGER NOT NULL DEFAULT 0, closed INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)"),
      db.prepare("CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, link_id TEXT NOT NULL, token TEXT NOT NULL UNIQUE, status TEXT NOT NULL, uploader TEXT NOT NULL, caption TEXT NOT NULL, data TEXT NOT NULL, size INTEGER NOT NULL, created_at INTEGER NOT NULL)"),
      db.prepare("CREATE INDEX IF NOT EXISTS items_link ON items(link_id, status)"),
      db.prepare("CREATE TABLE IF NOT EXISTS hits (ip TEXT NOT NULL, kind TEXT NOT NULL, ts INTEGER NOT NULL)"),
      db.prepare("CREATE INDEX IF NOT EXISTS hits_ip ON hits(ip, kind, ts)"),
    ]);
  }
  await ready;
  if (!migrated) {
    migrated = true;
    try {
      await db.prepare("ALTER TABLE links ADD COLUMN due_at INTEGER").run();
    } catch (e) {
      /* column already exists */
    }
  }
  return ready;
}
let migrated = false;

async function limited(db, request, kind, max, windowSec) {
  const ip = await sha((request.headers.get("cf-connecting-ip") || "local") + ":salt1");
  const since = Date.now() - windowSec * SEC;
  const row = await db.prepare("SELECT COUNT(*) AS n FROM hits WHERE ip=?1 AND kind=?2 AND ts>?3").bind(ip, kind, since).first();
  if (row.n >= max) return true;
  await db.batch([
    db.prepare("INSERT INTO hits (ip,kind,ts) VALUES (?1,?2,?3)").bind(ip, kind, Date.now()),
    db.prepare("DELETE FROM hits WHERE ts<?1").bind(Date.now() - 2 * 86400 * SEC),
  ]);
  return false;
}

async function authOwner(db, request, id) {
  const h = request.headers.get("authorization") || "";
  const secret = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!secret) return null;
  const link = await db.prepare("SELECT * FROM links WHERE id=?1").bind(id).first();
  if (!link) return null;
  return (await sha(secret)) === link.secret_hash ? link : null;
}

const secureHtml = {
  "content-type": "text/html; charset=utf-8",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex",
  "content-security-policy": "default-src 'self'; img-src 'self' blob: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
    const db = env.DB;
    await init(db);

    if (path === "/" ) return new Response(HOME, { headers: secureHtml });
    let m;
    if ((m = path.match(/^\/f\/([a-f0-9]{12})$/))) return new Response(friendPage(m[1]), { headers: secureHtml });

    // image bytes, token is unguessable and only handed to the owner (or after unlock to the owner)
    if ((m = path.match(/^\/i\/([a-f0-9]{32})$/))) {
      const it = await db.prepare("SELECT data,status FROM items WHERE token=?1").bind(m[1]).first();
      if (!it || it.status === "rejected") return new Response("Not found", { status: 404 });
      return new Response(fromB64(it.data), {
        headers: { "content-type": "image/jpeg", "x-content-type-options": "nosniff", "cache-control": "private, max-age=86400", "content-security-policy": "sandbox; default-src 'none'", ...cors() },
      });
    }

    // create a link (from the extension)
    if (path === "/api/links" && request.method === "POST") {
      if (await limited(db, request, "create", 20, 86400)) return json({ error: "Too many links today" }, 429);
      const b = await request.json().catch(() => ({}));
      const title = clean(b.title, 60) || "Homework";
      const expected = Math.max(1, Math.min(200, parseInt(b.expected, 10) || 10));
      const id = rand(6), secret = rand(24);
      const due = Number(b.dueAt) > Date.now() ? Math.floor(Number(b.dueAt)) : null;
      await db.prepare("INSERT INTO links (id,secret_hash,title,expected,auto_approve,closed,created_at,due_at) VALUES (?1,?2,?3,?4,?5,0,?6,?7)")
        .bind(id, await sha(secret), title, expected, 1, Date.now(), due).run();
      return json({ id, secret, url: `${url.origin}/f/${id}` });
    }

    // public info
    if ((m = path.match(/^\/api\/link\/([a-f0-9]{12})$/)) && request.method === "GET") {
      const link = await db.prepare("SELECT title,expected,closed,due_at FROM links WHERE id=?1").bind(m[1]).first();
      if (!link) return json({ error: "Not found" }, 404);
      const c = await db.prepare("SELECT COUNT(*) AS n FROM items WHERE link_id=?1 AND status!='rejected'").bind(m[1]).first();
      const over = link.due_at && Date.now() > link.due_at;
      return json({ title: link.title, expected: link.expected, closed: !!link.closed || !!over, due: link.due_at || null, sent: c.n });
    }

    // friend upload
    if ((m = path.match(/^\/api\/link\/([a-f0-9]{12})\/upload$/)) && request.method === "POST") {
      const link = await db.prepare("SELECT * FROM links WHERE id=?1").bind(m[1]).first();
      if (!link || link.closed || (link.due_at && Date.now() > link.due_at)) return json({ error: "This link has closed" }, 404);
      if (await limited(db, request, "upload", 40, 3600)) return json({ error: "Slow down, try again in a bit" }, 429);
      const buf = await request.arrayBuffer();
      if (buf.byteLength < 200 || buf.byteLength > MAX_BYTES) return json({ error: "Picture is too large" }, 413);
      const u = new Uint8Array(buf);
      const okJpeg = u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff && u[u.length - 2] === 0xff && u[u.length - 1] === 0xd9;
      if (!okJpeg) return json({ error: "Only photos please" }, 415);
      const c = await db.prepare("SELECT COUNT(*) AS n FROM items WHERE link_id=?1 AND status!='rejected'").bind(m[1]).first();
      if (c.n >= Math.min(MAX_PER_LINK, link.expected * 3)) return json({ error: "Enough pictures here already, thanks" }, 409);
      await db.prepare("INSERT INTO items (link_id,token,status,uploader,caption,data,size,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)")
        .bind(m[1], rand(16), "approved", clean(url.searchParams.get("name"), 30), clean(url.searchParams.get("cap"), 80), toB64(buf), buf.byteLength, Date.now()).run();
      return json({ ok: true });
    }

    // owner endpoints
    if ((m = path.match(/^\/api\/owner\/([a-f0-9]{12})(\/.*)?$/))) {
      const link = await authOwner(db, request, m[1]);
      if (!link) return json({ error: "Not allowed" }, 401);
      let sm;
      const sub = m[2] || "";
      if (sub === "" && request.method === "GET") {
        const rows = await db.prepare("SELECT id,token,status,uploader,caption,created_at FROM items WHERE link_id=?1 AND status='approved' ORDER BY id").bind(m[1]).all();
        return json({
          id: link.id, title: link.title, expected: link.expected, closed: !!link.closed || !!(link.due_at && Date.now() > link.due_at), due: link.due_at || null,
          items: rows.results.map((r) => ({ id: r.id, token: r.token, status: r.status, uploader: r.uploader, caption: r.caption, createdAt: r.created_at })),
        });
      }
      if (sub === "" && request.method === "PATCH") {
        const b = await request.json().catch(() => ({}));
        const t = b.title !== undefined ? clean(b.title, 60) || link.title : link.title;
        const e = b.expected !== undefined ? Math.max(1, Math.min(200, parseInt(b.expected, 10) || link.expected)) : link.expected;
        const a = b.autoApprove !== undefined ? (1) : link.auto_approve;
        const cl = b.closed !== undefined ? (b.closed ? 1 : 0) : link.closed;
        await db.prepare("UPDATE links SET title=?1,expected=?2,auto_approve=?3,closed=?4 WHERE id=?5").bind(t, e, a, cl, m[1]).run();
        return json({ ok: true });
      }
      if ((sm = sub.match(/^\/items\/(\d+)$/))) {
        const itemId = parseInt(sm[1], 10);
        if (request.method === "DELETE") {
          await db.prepare("DELETE FROM items WHERE id=?1 AND link_id=?2").bind(itemId, m[1]).run();
          return json({ ok: true });
        }
      }
      if (sub === "/delete" && request.method === "POST") {
        await db.batch([db.prepare("DELETE FROM items WHERE link_id=?1").bind(m[1]), db.prepare("DELETE FROM links WHERE id=?1").bind(m[1])]);
        return json({ ok: true });
      }
    }
    return json({ error: "Not found" }, 404);
  },
};
