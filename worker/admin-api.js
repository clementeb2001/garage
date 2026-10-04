/* Autoservice Bettenduerf — Interne Verwaltung (Reservatiounen + Memberen).
   Cloudflare Worker + D1. Login server-säiteg, Passwierder PBKDF2-gehasht,
   Sessioun als signéierten Bearer-Token. Rechter: viewer < validator < admin.

   Bindings (wrangler.toml):
     - DB             : D1-Datebank "garage-admin"
     - SESSION_SECRET : Secret (wrangler secret put SESSION_SECRET)
     - ALLOW_ORIGIN   : var, z. B. "https://autoservicebettenduerf.lu"
*/

const PERMS = {
  viewer: ["bookings.view"],
  validator: ["bookings.view", "bookings.validate"],
  admin: ["bookings.view", "bookings.validate", "members.manage"],
};
const ROLES = ["viewer", "validator", "admin"];
const SESSION_TTL = 8 * 60 * 60; // 8h
const enc = (s) => new TextEncoder().encode(s);

/* ---------- base64 / base64url ---------- */
function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToBuf(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64url(s) { return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function unb64url(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return atob(s); }

/* ---------- constant-time compare ---------- */
function eq(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/* ---------- password hashing (PBKDF2-SHA256) ---------- */
async function hashPw(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc(password), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
  return "pbkdf2$100000$" + bufToB64(salt) + "$" + bufToB64(bits);
}
async function verifyPw(stored, password) {
  const p = String(stored || "").split("$");
  if (p.length !== 4 || p[0] !== "pbkdf2") return false;
  const iter = parseInt(p[1], 10);
  const salt = b64ToBuf(p[2]);
  const key = await crypto.subtle.importKey("raw", enc(password), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, key, 256);
  return eq(bufToB64(bits), p[3]);
}

/* ---------- session token (HMAC-SHA256) ---------- */
async function hmac(data, secret) {
  const key = await crypto.subtle.importKey("raw", enc(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc(data));
  return bufToB64(sig).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function makeToken(user, secret) {
  const payload = b64url(JSON.stringify({ u: user.username, r: user.role, exp: Math.floor(Date.now() / 1000) + SESSION_TTL }));
  return payload + "." + (await hmac(payload, secret));
}
async function readToken(token, secret) {
  if (!token || token.indexOf(".") < 0) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (!eq(sig, await hmac(payload, secret))) return null;
  let obj;
  try { obj = JSON.parse(unb64url(payload)); } catch (e) { return null; }
  if (!obj.exp || obj.exp < Math.floor(Date.now() / 1000)) return null;
  return obj;
}

/* ---------- helpers ---------- */
function cors(env, extra) {
  return Object.assign({
    "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "https://autoservicebettenduerf.lu",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  }, extra || {});
}
function json(env, body, status) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: cors(env, { "Content-Type": "application/json; charset=utf-8" }) });
}
function clip(s, n) { return String(s == null ? "" : s).slice(0, n); }
function hasPerm(role, perm) { return (PERMS[role] || []).indexOf(perm) !== -1; }

async function authUser(request, env) {
  const h = request.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const tok = await readToken(m[1], env.SESSION_SECRET);
  if (!tok) return null;
  const row = await env.DB.prepare("SELECT username, name, role, active, must_change FROM users WHERE username = ?1").bind(tok.u).first();
  if (!row || !row.active) return null;
  return row;
}

/* ---------- main ---------- */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = request.method.toUpperCase();

    if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env) });
    if (!env.SESSION_SECRET) return json(env, { error: "server_not_configured" }, 500);

    let bodyData = {};
    if (method === "POST" && (request.headers.get("content-type") || "").includes("application/json")) {
      try { bodyData = await request.json(); } catch (e) { bodyData = {}; }
    }

    try {
      /* ---- public: neng Reservatiounsufro (vum Location-Formulaire) ---- */
      if (path === "/bookings" && method === "POST" && !request.headers.get("Authorization")) {
        const veh = clip(bodyData.veh, 120).trim();
        const name = clip(bodyData.name, 120).trim();
        if (!veh || !name) return json(env, { error: "missing_fields" }, 400);
        const r = await env.DB.prepare(
          "INSERT INTO bookings (veh, from_dt, to_dt, cust_name, cust_email, cust_phone, msg, lang, status) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'new')"
        ).bind(veh, clip(bodyData.from, 40), clip(bodyData.to, 40), name, clip(bodyData.email, 160), clip(bodyData.phone, 60), clip(bodyData.msg, 2000), clip(bodyData.lang, 5)).run();
        const id = r.meta.last_row_id;
        await env.DB.prepare("INSERT INTO booking_events (booking_id, action, by_user, note) VALUES (?1,'Ufro erakomm','System','')").bind(id).run();
        return json(env, { ok: true, id });
      }

      /* ---- login ---- */
      if (path === "/auth/login" && method === "POST") {
        const username = clip(bodyData.username, 60).trim().toLowerCase();
        const password = String(bodyData.password || "");
        const row = await env.DB.prepare("SELECT * FROM users WHERE username = ?1").bind(username).first();
        const ok = row && row.active && (await verifyPw(row.pw, password));
        if (!ok) return json(env, { error: "invalid_credentials" }, 401);
        const token = await makeToken(row, env.SESSION_SECRET);
        return json(env, { token, user: { username: row.username, name: row.name, role: row.role, mustChange: !!row.must_change } });
      }

      /* ---- all routes below need auth ---- */
      const me = await authUser(request, env);
      if (path === "/auth/me") {
        if (!me) return json(env, { error: "unauthorized" }, 401);
        return json(env, { user: { username: me.username, name: me.name, role: me.role, mustChange: !!me.must_change } });
      }
      if (!me) return json(env, { error: "unauthorized" }, 401);

      /* ---- change own password ---- */
      if (path === "/auth/password" && method === "POST") {
        const cur = String(bodyData.current || ""), next = String(bodyData.next || "");
        if (next.length < 8) return json(env, { error: "weak_password" }, 400);
        const row = await env.DB.prepare("SELECT pw FROM users WHERE username = ?1").bind(me.username).first();
        if (!row || !(await verifyPw(row.pw, cur))) return json(env, { error: "wrong_current" }, 400);
        await env.DB.prepare("UPDATE users SET pw = ?1, must_change = 0 WHERE username = ?2").bind(await hashPw(next), me.username).run();
        return json(env, { ok: true });
      }

      /* ---- bookings list ---- */
      if (path === "/bookings" && method === "GET") {
        if (!hasPerm(me.role, "bookings.view")) return json(env, { error: "forbidden" }, 403);
        const bs = (await env.DB.prepare("SELECT * FROM bookings ORDER BY id DESC").all()).results || [];
        const evs = (await env.DB.prepare("SELECT booking_id, action, by_user, note, at FROM booking_events ORDER BY id ASC").all()).results || [];
        const byId = {};
        evs.forEach((e) => { (byId[e.booking_id] = byId[e.booking_id] || []).push({ action: e.action, by: e.by_user, at: e.at, note: e.note || "" }); });
        return json(env, { bookings: bs.map((b) => ({ id: b.id, veh: b.veh, from: b.from_dt, to: b.to_dt, name: b.cust_name, email: b.cust_email, phone: b.cust_phone, msg: b.msg, status: b.status, events: byId[b.id] || [] })) });
      }

      /* ---- booking status change ---- */
      let m = path.match(/^\/bookings\/(\d+)\/status$/);
      if (m && method === "POST") {
        if (!hasPerm(me.role, "bookings.validate")) return json(env, { error: "forbidden" }, 403);
        const id = parseInt(m[1], 10);
        const status = clip(bodyData.status, 20);
        const labels = { confirmed: "Bestätegt", declined: "Ofgeleent", done: "Ofgeschloss", new: "Zrécksetzen" };
        if (!labels[status]) return json(env, { error: "bad_status" }, 400);
        const ex = await env.DB.prepare("SELECT id FROM bookings WHERE id = ?1").bind(id).first();
        if (!ex) return json(env, { error: "not_found" }, 404);
        await env.DB.prepare("UPDATE bookings SET status = ?1 WHERE id = ?2").bind(status, id).run();
        await env.DB.prepare("INSERT INTO booking_events (booking_id, action, by_user, note) VALUES (?1,?2,?3,?4)").bind(id, labels[status], me.username, clip(bodyData.note, 500)).run();
        return json(env, { ok: true });
      }

      /* ---- members (admin only) ---- */
      if (path === "/members" && method === "GET") {
        if (!hasPerm(me.role, "members.manage")) return json(env, { error: "forbidden" }, 403);
        const us = (await env.DB.prepare("SELECT username, name, role, active FROM users ORDER BY username ASC").all()).results || [];
        return json(env, { members: us.map((u) => ({ username: u.username, name: u.name, role: u.role, active: !!u.active })) });
      }
      if (path === "/members" && method === "POST") {
        if (!hasPerm(me.role, "members.manage")) return json(env, { error: "forbidden" }, 403);
        const username = clip(bodyData.username, 60).trim().toLowerCase();
        const name = clip(bodyData.name, 120).trim();
        const role = clip(bodyData.role, 20);
        if (!/^[a-z0-9._-]{3,}$/.test(username) || !name || ROLES.indexOf(role) < 0) return json(env, { error: "bad_input" }, 400);
        const dup = await env.DB.prepare("SELECT username FROM users WHERE username = ?1").bind(username).first();
        if (dup) return json(env, { error: "exists" }, 409);
        const tempPw = genTempPw();
        await env.DB.prepare("INSERT INTO users (username, name, role, pw, active, must_change) VALUES (?1,?2,?3,?4,1,1)").bind(username, name, role, await hashPw(tempPw)).run();
        await env.DB.prepare("INSERT INTO member_events (action, target, by_user) VALUES ('created', ?1, ?2)").bind(username, me.username).run();
        return json(env, { ok: true, tempPassword: tempPw });
      }
      /* ---- member: Passwuert zrécksetzen (admin) ---- */
      m = path.match(/^\/members\/([a-z0-9._-]+)\/reset$/);
      if (m && method === "POST") {
        if (!hasPerm(me.role, "members.manage")) return json(env, { error: "forbidden" }, 403);
        const target = m[1];
        const t = await env.DB.prepare("SELECT username FROM users WHERE username = ?1").bind(target).first();
        if (!t) return json(env, { error: "not_found" }, 404);
        const tempPw = genTempPw();
        await env.DB.prepare("UPDATE users SET pw = ?1, must_change = 1 WHERE username = ?2").bind(await hashPw(tempPw), target).run();
        await env.DB.prepare("INSERT INTO member_events (action, target, by_user) VALUES ('reset-pw', ?1, ?2)").bind(target, me.username).run();
        return json(env, { ok: true, tempPassword: tempPw });
      }

      /* ---- member änneren: Roll / Numm / Benotzernumm ---- */
      m = path.match(/^\/members\/([a-z0-9._-]+)$/);
      if (m && method === "POST") {
        if (!hasPerm(me.role, "members.manage")) return json(env, { error: "forbidden" }, 403);
        const target = m[1];
        const t = await env.DB.prepare("SELECT role, name FROM users WHERE username = ?1").bind(target).first();
        if (!t) return json(env, { error: "not_found" }, 404);
        if (bodyData.role !== undefined) {
          const role = clip(bodyData.role, 20);
          if (ROLES.indexOf(role) < 0) return json(env, { error: "bad_role" }, 400);
          if (t.role === "admin" && role !== "admin" && (await adminCount(env)) <= 1) return json(env, { error: "last_admin" }, 409);
          await env.DB.prepare("UPDATE users SET role = ?1 WHERE username = ?2").bind(role, target).run();
          await env.DB.prepare("INSERT INTO member_events (action, target, by_user) VALUES (?1, ?2, ?3)").bind("role:" + role, target, me.username).run();
        }
        if (bodyData.name !== undefined) {
          const name = clip(bodyData.name, 120).trim();
          if (!name) return json(env, { error: "bad_input" }, 400);
          await env.DB.prepare("UPDATE users SET name = ?1 WHERE username = ?2").bind(name, target).run();
          await env.DB.prepare("INSERT INTO member_events (action, target, by_user) VALUES ('rename', ?1, ?2)").bind(target, me.username).run();
        }
        let selfRenamed = false, newUsername = null;
        if (bodyData.newUsername !== undefined) {
          const nu = clip(bodyData.newUsername, 60).trim().toLowerCase();
          if (!/^[a-z0-9._-]{3,}$/.test(nu)) return json(env, { error: "bad_input" }, 400);
          if (nu !== target) {
            const dup = await env.DB.prepare("SELECT username FROM users WHERE username = ?1").bind(nu).first();
            if (dup) return json(env, { error: "exists" }, 409);
            await env.DB.prepare("UPDATE users SET username = ?1 WHERE username = ?2").bind(nu, target).run();
            await env.DB.prepare("INSERT INTO member_events (action, target, by_user) VALUES (?1, ?2, ?3)").bind("username>" + nu, target, me.username).run();
            newUsername = nu;
            if (target === me.username) selfRenamed = true;
          }
        }
        return json(env, { ok: true, newUsername: newUsername, selfRenamed: selfRenamed });
      }
      if (m && method === "DELETE") {
        if (!hasPerm(me.role, "members.manage")) return json(env, { error: "forbidden" }, 403);
        const target = m[1];
        if (target === me.username) return json(env, { error: "self" }, 409);
        const t = await env.DB.prepare("SELECT role FROM users WHERE username = ?1").bind(target).first();
        if (!t) return json(env, { error: "not_found" }, 404);
        if (t.role === "admin" && (await adminCount(env)) <= 1) return json(env, { error: "last_admin" }, 409);
        await env.DB.prepare("DELETE FROM users WHERE username = ?1").bind(target).run();
        await env.DB.prepare("INSERT INTO member_events (action, target, by_user) VALUES ('deleted', ?1, ?2)").bind(target, me.username).run();
        return json(env, { ok: true });
      }

      return json(env, { error: "not_found" }, 404);
    } catch (e) {
      return json(env, { error: "server_error", detail: String(e && e.message || e) }, 500);
    }
  },
};

function genTempPw() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ", b = "abcdefghijkmnpqrstuvwxyz", d = "23456789";
  const pick = (set, n) => { let s = ""; const r = crypto.getRandomValues(new Uint8Array(n)); for (let i = 0; i < n; i++) s += set[r[i] % set.length]; return s; };
  return pick(a, 4) + "-" + pick(b, 4) + "-" + pick(d, 4);
}
async function adminCount(env) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND active=1").first();
  return r ? r.n : 0;
}
