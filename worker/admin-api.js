/* Autoservice Bettenduerf — Interne Verwaltung (Reservatiounen + Memberen).
   Cloudflare Worker + D1. Login server-säiteg, Passwierder PBKDF2-gehasht,
   Widderruffbar Sessioun an engem Secure/HttpOnly-Cookie. Rechter:
   viewer < validator < admin.

   Bindings (wrangler.toml):
     - DB             : D1-Datebank "garage-admin"
     - ALLOW_ORIGIN   : var, z. B. "https://autoservicebettenduerf.lu"
*/

const PERMS = {
  viewer: ["bookings.view"],
  validator: ["bookings.view", "bookings.validate"],
  admin: ["bookings.view", "bookings.validate", "members.manage"],
};
const ROLES = ["viewer", "validator", "admin"];
const SESSION_TTL = 8 * 60 * 60; // 8h
const PW_ITERATIONS = 600000;
const SESSION_COOKIE = "garage_session";
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
async function hashPw(password, iterations) {
  iterations = iterations || PW_ITERATIONS;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc(password), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256);
  return "pbkdf2$" + iterations + "$" + bufToB64(salt) + "$" + bufToB64(bits);
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

/* ---------- widderruffbar Cookie-Sessiounen ---------- */
function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bufToB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function cookieValue(request, name) {
  const cookies = request.headers.get("Cookie") || "";
  const prefix = name + "=";
  const part = cookies.split(";").map((x) => x.trim()).find((x) => x.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : "";
}
function sessionCookie(token) {
  return SESSION_COOKIE + "=" + encodeURIComponent(token) + "; Path=/; Max-Age=" + SESSION_TTL + "; HttpOnly; Secure; SameSite=Strict";
}
function clearSessionCookie() {
  return SESSION_COOKIE + "=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict";
}
async function ensureSessions(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, username TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_sessions_username ON sessions(username)").run();
}
async function createSession(env, username) {
  await ensureSessions(env);
  const token = randomToken();
  const tokenHash = await hashText(token);
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL;
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?1").bind(Math.floor(Date.now() / 1000)).run();
  await env.DB.prepare("INSERT INTO sessions (token_hash, username, expires_at) VALUES (?1,?2,?3)").bind(tokenHash, username, expires).run();
  return token;
}

/* ---------- helpers ---------- */
function cors(env, extra) {
  return Object.assign({
    "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "https://autoservicebettenduerf.lu",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  }, extra || {});
}
function json(env, body, status, extraHeaders) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: cors(env, Object.assign({ "Content-Type": "application/json; charset=utf-8" }, extraHeaders || {})) });
}
function clip(s, n) { return String(s == null ? "" : s).slice(0, n); }
function hasPerm(role, perm) { return (PERMS[role] || []).indexOf(perm) !== -1; }
function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 160; }
function validDateTime(s) { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) && Number.isFinite(Date.parse(s)); }
function vehicleKeys(s) { return String(s || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean); }
function hasSameVehicle(a, b) { const bb = new Set(vehicleKeys(b)); return vehicleKeys(a).some((x) => bb.has(x)); }
async function hashText(s) {
  const digest = await crypto.subtle.digest("SHA-256", enc(s));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function publicRateAllowed(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const bucket = await hashText(ip + ":" + Math.floor(Date.now() / 3600000));
  const expires = Math.floor(Date.now() / 1000) + 7200;
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS booking_rate_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL)").run();
  await env.DB.prepare("DELETE FROM booking_rate_limits WHERE expires_at < ?1").bind(Math.floor(Date.now() / 1000)).run();
  await env.DB.prepare("INSERT INTO booking_rate_limits (bucket, count, expires_at) VALUES (?1,1,?2) ON CONFLICT(bucket) DO UPDATE SET count=count+1, expires_at=?2").bind(bucket, expires).run();
  const row = await env.DB.prepare("SELECT count FROM booking_rate_limits WHERE bucket=?1").bind(bucket).first();
  return !!row && Number(row.count) <= 8;
}
async function findConflict(env, veh, from, to, excludeId) {
  const rows = (await env.DB.prepare("SELECT id, veh, from_dt, to_dt FROM bookings WHERE status='confirmed' AND from_dt < ?1 AND to_dt > ?2").bind(to, from).all()).results || [];
  return rows.find((b) => Number(b.id) !== Number(excludeId || 0) && hasSameVehicle(veh, b.veh)) || null;
}
/* ---------- Login brute-force throttle (reuse booking_rate_limits table) ---------- */
async function loginBucket(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  return "login:" + await hashText(ip + ":" + Math.floor(Date.now() / 3600000));
}
async function loginFails(env, bucket) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS booking_rate_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL)").run();
  await env.DB.prepare("DELETE FROM booking_rate_limits WHERE expires_at < ?1").bind(Math.floor(Date.now() / 1000)).run();
  const row = await env.DB.prepare("SELECT count FROM booking_rate_limits WHERE bucket=?1").bind(bucket).first();
  return row ? Number(row.count) : 0;
}
async function loginBump(env, bucket) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  await env.DB.prepare("INSERT INTO booking_rate_limits (bucket, count, expires_at) VALUES (?1,1,?2) ON CONFLICT(bucket) DO UPDATE SET count=count+1, expires_at=?2").bind(bucket, expires).run();
}
async function loginClear(env, bucket) {
  await env.DB.prepare("DELETE FROM booking_rate_limits WHERE bucket=?1").bind(bucket).run();
}

/* ---------- E-Mail (Resend) ---------- */
async function sendEmail(env, to, subject, html, text) {
  if (!env.RESEND_API_KEY || !to) return { ok: false, error: "mail_not_configured" };
  try {
    const payload = {
      from: env.MAIL_FROM || "Autoservice Bettenduerf <noreply@autoservicebettenduerf.lu>",
      to: [to], reply_to: "Autoservicebettenduerf@outlook.com", subject: subject, html: html,
    };
    if (text) payload.text = text;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return { ok: false, error: "resend_http_" + response.status };
    const data = await response.json().catch(() => ({}));
    return { ok: true, id: data.id || "" };
  } catch (e) { return { ok: false, error: clip(e && e.message || e, 160) }; }
}
async function sendConfirmation(env, bookingId, booking) {
  booking.ref = "R-" + (Number(bookingId) + 1000);
  const mail = confirmMail(booking);
  const result = await sendEmail(env, booking.cust_email, mail.subject, mail.html, mail.text);
  await env.DB.prepare("INSERT INTO booking_events (booking_id, action, by_user, note) VALUES (?1,?2,'System',?3)")
    .bind(bookingId, result.ok ? "Bestätegungsmail geschéckt" : "Bestätegungsmail feelgeschloen", clip(result.ok ? result.id : result.error, 500)).run();
}
async function sendDecline(env, bookingId, booking) {
  booking.ref = "R-" + (Number(bookingId) + 1000);
  const mail = declineMail(booking);
  const result = await sendEmail(env, booking.cust_email, mail.subject, mail.html, mail.text);
  await env.DB.prepare("INSERT INTO booking_events (booking_id, action, by_user, note) VALUES (?1,?2,'System',?3)")
    .bind(bookingId, result.ok ? "Ofsomail geschéckt" : "Ofsomail feelgeschloen", clip(result.ok ? result.id : result.error, 500)).run();
}
async function sendNewBookingNotice(env, bookingId, booking) {
  const subject = "Nei Location-Ufro R-" + (Number(bookingId) + 1000);
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c2430">' +
    '<h2 style="color:#c81420">Nei Location-Ufro</h2>' +
    '<p><b>' + esc(booking.cust_name) + '</b> freet <b>' + esc(booking.veh) + '</b> un.</p>' +
    '<p><b>Vun:</b> ' + esc(booking.from_dt.replace("T", " ")) + '<br><b>Bis:</b> ' + esc(booking.to_dt.replace("T", " ")) + '<br><b>E-Mail:</b> ' + esc(booking.cust_email) + '</p>' +
    '<p><a href="https://autoservicebettenduerf.lu/intern/" style="display:inline-block;background:#c81420;color:#fff;text-decoration:none;padding:11px 16px;border-radius:8px;font-weight:700">An der Verwaltung opmaachen</a></p></div>';
  const text = "Nei Location-Ufro\n\n" + booking.cust_name + " freet " + booking.veh + " un.\n" +
    "Vun: " + booking.from_dt.replace("T", " ") + "\nBis: " + booking.to_dt.replace("T", " ") + "\nE-Mail: " + booking.cust_email +
    "\n\nAn der Verwaltung opmaachen: https://autoservicebettenduerf.lu/intern/";
  const result = await sendEmail(env, env.MAIL_TO || "Autoservicebettenduerf@outlook.com", subject, html, text);
  await env.DB.prepare("INSERT INTO booking_events (booking_id, action, by_user, note) VALUES (?1,?2,'System',?3)")
    .bind(bookingId, result.ok ? "Intern Notifikatioun geschéckt" : "Intern Notifikatioun feelgeschloen", clip(result.ok ? result.id : result.error, 500)).run();
}
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function mailText(t, b) {
  var lines = [t.h, "", t.p, ""];
  if (b.ref) lines.push((t.ref || "Réf.") + ": " + b.ref);
  lines.push(t.veh + ": " + b.veh);
  if (b.from_dt) lines.push(t.from + ": " + b.from_dt.replace("T", " "));
  if (b.to_dt) lines.push(t.to + ": " + b.to_dt.replace("T", " "));
  lines.push("", t.foot, "", "Autoservice Bettenduerf · 63, rue de Diekirch-Echternach · L-9355 Bettendorf · +352 80 86 87");
  return lines.join("\n");
}
function confirmMail(b) {
  var L = (b.lang || "lb").slice(0, 2);
  var T = {
    lb: { s: "Är Reservatioun ass bestätegt", h: "Reservatioun bestätegt", p: "Mir hunn Är Reservatioun bestätegt:", veh: "Gefier", from: "Vun", to: "Bis", foot: "Bei Froen äntwert einfach op dës E-Mail oder rufft eis un. Villmools Merci!" },
    de: { s: "Ihre Reservierung ist bestätigt", h: "Reservierung bestätigt", p: "Wir haben Ihre Reservierung bestätigt:", veh: "Fahrzeug", from: "Von", to: "Bis", foot: "Bei Fragen antworten Sie einfach auf diese E-Mail oder rufen Sie uns an. Vielen Dank!" },
    fr: { s: "Votre réservation est confirmée", h: "Réservation confirmée", p: "Nous avons confirmé votre réservation :", veh: "Véhicule", from: "Du", to: "Au", foot: "Pour toute question, répondez simplement à cet e-mail ou appelez-nous. Merci !" },
    en: { s: "Your reservation is confirmed", h: "Reservation confirmed", p: "We have confirmed your reservation:", veh: "Vehicle", from: "From", to: "To", foot: "If you have any questions, just reply to this e-mail or call us. Thank you!" },
  }[L] || null;
  var t = T || { s: "Är Reservatioun ass bestätegt", h: "Reservatioun bestätegt", p: "Mir hunn Är Reservatioun bestätegt:", veh: "Gefier", from: "Vun", to: "Bis", foot: "Merci!" };
  t.ref = { lb: "Réf.", de: "Ref.", fr: "Réf.", en: "Ref." }[L] || "Réf.";
  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1c2430">' +
    '<div style="background:#0d1b2a;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;font-weight:800">Autoservice Bettenduerf</div>' +
    '<div style="border:1px solid #e6e9ee;border-top:0;border-radius:0 0 10px 10px;padding:20px">' +
    '<h2 style="margin:0 0 8px;color:#2e7d5b">✓ ' + esc(t.h) + "</h2>" +
    "<p>" + esc(t.p) + "</p>" +
    '<table style="font-size:14px;border-collapse:collapse">' +
    (b.ref ? "<tr><td style=\"color:#5b6b7c;padding:3px 12px 3px 0\">" + esc(t.ref) + "</td><td><b>" + esc(b.ref) + "</b></td></tr>" : "") +
    "<tr><td style=\"color:#5b6b7c;padding:3px 12px 3px 0\">" + esc(t.veh) + "</td><td><b>" + esc(b.veh) + "</b></td></tr>" +
    (b.from_dt ? "<tr><td style=\"color:#5b6b7c;padding:3px 12px 3px 0\">" + esc(t.from) + "</td><td>" + esc(b.from_dt.replace("T", " ")) + "</td></tr>" : "") +
    (b.to_dt ? "<tr><td style=\"color:#5b6b7c;padding:3px 12px 3px 0\">" + esc(t.to) + "</td><td>" + esc(b.to_dt.replace("T", " ")) + "</td></tr>" : "") +
    "</table>" +
    '<p style="color:#5b6b7c;font-size:13px;margin-top:18px">' + esc(t.foot) + "</p>" +
    '<p style="color:#8a96a2;font-size:12px;margin-top:14px">Autoservice Bettenduerf · 63, rue de Diekirch-Echternach · L-9355 Bettendorf · +352 80 86 87</p>' +
    "</div></div>";
  return { subject: t.s, html: html, text: mailText(t, b) };
}
function declineMail(b) {
  var L = (b.lang || "lb").slice(0, 2);
  var T = {
    lb: { s: "Är Verleih-Ufro – leider net méiglech", h: "Et deet eis leed", p: "Villmools Merci fir Är Ufro. Leider ass dat gewënschte Material an dësem Zäitraum net disponibel:", veh: "Gefier", from: "Vun", to: "Bis", foot: "Rufft eis gären un – vläicht fanne mir zesumme en anere Moment oder eng Alternativ. Mir soen Iech Merci fir d'Versteesdemech." },
    de: { s: "Ihre Verleih-Anfrage – leider nicht möglich", h: "Es tut uns leid", p: "Vielen Dank für Ihre Anfrage. Leider ist das gewünschte Material in diesem Zeitraum nicht verfügbar:", veh: "Fahrzeug", from: "Von", to: "Bis", foot: "Rufen Sie uns gerne an – vielleicht finden wir gemeinsam einen anderen Termin oder eine Alternative. Danke für Ihr Verständnis." },
    fr: { s: "Votre demande de location – malheureusement impossible", h: "Nous sommes désolés", p: "Merci beaucoup pour votre demande. Malheureusement, le matériel souhaité n'est pas disponible sur cette période :", veh: "Véhicule", from: "Du", to: "Au", foot: "N'hésitez pas à nous appeler – nous trouverons peut-être ensemble une autre date ou une alternative. Merci de votre compréhension." },
    en: { s: "Your rental request – unfortunately not possible", h: "We're sorry", p: "Thank you very much for your request. Unfortunately the requested item is not available for this period:", veh: "Vehicle", from: "From", to: "To", foot: "Feel free to call us – perhaps we can find another date or an alternative together. Thank you for your understanding." },
  }[L] || null;
  var t = T || { s: "Är Verleih-Ufro – leider net méiglech", h: "Et deet eis leed", p: "Leider ass dat gewënschte Material an dësem Zäitraum net disponibel:", veh: "Gefier", from: "Vun", to: "Bis", foot: "Rufft eis gären un. Merci fir d'Versteesdemech." };
  t.ref = { lb: "Réf.", de: "Ref.", fr: "Réf.", en: "Ref." }[L] || "Réf.";
  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1c2430">' +
    '<div style="background:#0d1b2a;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;font-weight:800">Autoservice Bettenduerf</div>' +
    '<div style="border:1px solid #e6e9ee;border-top:0;border-radius:0 0 10px 10px;padding:20px">' +
    '<h2 style="margin:0 0 8px;color:#c81420">' + esc(t.h) + "</h2>" +
    "<p>" + esc(t.p) + "</p>" +
    '<table style="font-size:14px;border-collapse:collapse">' +
    (b.ref ? "<tr><td style=\"color:#5b6b7c;padding:3px 12px 3px 0\">" + esc(t.ref) + "</td><td><b>" + esc(b.ref) + "</b></td></tr>" : "") +
    "<tr><td style=\"color:#5b6b7c;padding:3px 12px 3px 0\">" + esc(t.veh) + "</td><td><b>" + esc(b.veh) + "</b></td></tr>" +
    (b.from_dt ? "<tr><td style=\"color:#5b6b7c;padding:3px 12px 3px 0\">" + esc(t.from) + "</td><td>" + esc(b.from_dt.replace("T", " ")) + "</td></tr>" : "") +
    (b.to_dt ? "<tr><td style=\"color:#5b6b7c;padding:3px 12px 3px 0\">" + esc(t.to) + "</td><td>" + esc(b.to_dt.replace("T", " ")) + "</td></tr>" : "") +
    "</table>" +
    '<p style="color:#5b6b7c;font-size:13px;margin-top:18px">' + esc(t.foot) + "</p>" +
    '<p style="color:#8a96a2;font-size:12px;margin-top:14px">Autoservice Bettenduerf · 63, rue de Diekirch-Echternach · L-9355 Bettendorf · +352 80 86 87</p>' +
    "</div></div>";
  return { subject: t.s, html: html, text: mailText(t, b) };
}

async function authUser(request, env) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  await ensureSessions(env);
  const tokenHash = await hashText(token);
  const sess = await env.DB.prepare("SELECT username, expires_at FROM sessions WHERE token_hash = ?1").bind(tokenHash).first();
  if (!sess || Number(sess.expires_at) < Math.floor(Date.now() / 1000)) {
    if (sess) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(tokenHash).run();
    return null;
  }
  const row = await env.DB.prepare("SELECT username, name, role, active, must_change FROM users WHERE username = ?1").bind(sess.username).first();
  if (!row || !row.active) return null;
  row.sessionHash = tokenHash;
  return row;
}

/* ---------- main ---------- */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = request.method.toUpperCase();

    if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env) });

    let bodyData = {};
    if (method === "POST" && (request.headers.get("content-type") || "").includes("application/json")) {
      try { bodyData = await request.json(); } catch (e) { bodyData = {}; }
    }

    try {
      /* ---- public: neng Reservatiounsufro (vum Location-Formulaire) ---- */
      if (path === "/bookings" && method === "POST") {
        const allowedOrigin = env.ALLOW_ORIGIN || "https://autoservicebettenduerf.lu";
        if (request.headers.get("Origin") !== allowedOrigin) return json(env, { error: "forbidden_origin" }, 403);
        if (!(request.headers.get("content-type") || "").includes("application/json")) return json(env, { error: "unsupported_media_type" }, 415);
        if (bodyData.website) return json(env, { ok: true }, 202);
        if (!(await publicRateAllowed(request, env))) return json(env, { error: "rate_limited" }, 429);
        const veh = clip(bodyData.veh, 120).trim();
        const name = clip(bodyData.name, 120).trim();
        const email = clip(bodyData.email, 160).trim().toLowerCase();
        const from = clip(bodyData.from, 40).trim();
        const to = clip(bodyData.to, 40).trim();
        const loadedAt = Number(bodyData.loadedAt || 0);
        if (!veh || !name || !email || !from || !to || !bodyData.privacy || !bodyData.terms) return json(env, { error: "missing_fields" }, 400);
        if (!validEmail(email) || !validDateTime(from) || !validDateTime(to)) return json(env, { error: "invalid_fields" }, 400);
        const fromMs = Date.parse(from), toMs = Date.parse(to), nowMs = Date.now();
        if (fromMs < nowMs - 300000 || toMs <= fromMs || toMs - fromMs > 31 * 86400000) return json(env, { error: "invalid_period" }, 400);
        if (!loadedAt || nowMs - loadedAt < 2500 || nowMs - loadedAt > 86400000) return json(env, { error: "invalid_submission" }, 400);
        if (await findConflict(env, veh, from, to)) return json(env, { error: "unavailable" }, 409);
        const r = await env.DB.prepare(
          "INSERT INTO bookings (veh, from_dt, to_dt, cust_name, cust_email, cust_phone, msg, lang, status) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'new')"
        ).bind(veh, from, to, name, email, clip(bodyData.phone, 60), clip(bodyData.msg, 2000), ["lb","de","fr","en"].includes(bodyData.lang) ? bodyData.lang : "lb").run();
        const id = r.meta.last_row_id;
        await env.DB.prepare("INSERT INTO booking_events (booking_id, action, by_user, note) VALUES (?1,'Ufro erakomm','System','')").bind(id).run();
        ctx.waitUntil(sendNewBookingNotice(env, id, { veh, from_dt: from, to_dt: to, cust_name: name, cust_email: email }));
        return json(env, { ok: true, id });
      }

      /* ---- public: Disponibilitéit (nëmme bestätegt Perioden, keng perséinlech Donnéeën) ---- */
      if (path === "/availability" && method === "GET") {
        const since = new Date(Date.now() - 86400000).toISOString().slice(0, 16);
        const rows = (await env.DB.prepare("SELECT veh, from_dt, to_dt FROM bookings WHERE status='confirmed' AND to_dt >= ?1 ORDER BY from_dt ASC LIMIT 500").bind(since).all()).results || [];
        return json(env, { busy: rows.map((r) => ({ veh: r.veh, from: r.from_dt, to: r.to_dt })) });
      }

      /* ---- login (mat Brute-Force-Schutz: max 10 falsch Versich/Stonn/IP) ---- */
      if (path === "/auth/login" && method === "POST") {
        const allowedOrigin = env.ALLOW_ORIGIN || "https://autoservicebettenduerf.lu";
        if (request.headers.get("Origin") !== allowedOrigin) return json(env, { error: "forbidden_origin" }, 403);
        const username = clip(bodyData.username, 60).trim().toLowerCase();
        const password = String(bodyData.password || "");
        const lbk = await loginBucket(request);
        if (await loginFails(env, lbk) >= 10) return json(env, { error: "rate_limited" }, 429);
        const row = await env.DB.prepare("SELECT * FROM users WHERE username = ?1").bind(username).first();
        const ok = row && row.active && (await verifyPw(row.pw, password));
        if (!ok) { await loginBump(env, lbk); return json(env, { error: "invalid_credentials" }, 401); }
        await loginClear(env, lbk);
        const storedIterations = parseInt(String(row.pw || "").split("$")[1], 10) || 0;
        if (storedIterations < PW_ITERATIONS) {
          await env.DB.prepare("UPDATE users SET pw = ?1 WHERE username = ?2").bind(await hashPw(password), row.username).run();
        }
        const token = await createSession(env, row.username);
        return json(env, { ok: true, user: { username: row.username, name: row.name, role: row.role, mustChange: !!row.must_change } }, 200, { "Set-Cookie": sessionCookie(token) });
      }

      /* ---- all routes below need auth ---- */
      const me = await authUser(request, env);
      if (path === "/auth/me") {
        if (!me) return json(env, { error: "unauthorized" }, 401, { "Set-Cookie": clearSessionCookie() });
        return json(env, { user: { username: me.username, name: me.name, role: me.role, mustChange: !!me.must_change } });
      }
      if (path === "/auth/logout" && method === "POST") {
        if (me && me.sessionHash) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(me.sessionHash).run();
        return json(env, { ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
      }
      if (!me) return json(env, { error: "unauthorized" }, 401);

      if ((method === "POST" || method === "DELETE") && request.headers.get("Origin") !== (env.ALLOW_ORIGIN || "https://autoservicebettenduerf.lu")) {
        return json(env, { error: "forbidden_origin" }, 403);
      }

      /* ---- change own password ---- */
      if (path === "/auth/password" && method === "POST") {
        const cur = String(bodyData.current || ""), next = String(bodyData.next || "");
        if (next.length < 8) return json(env, { error: "weak_password" }, 400);
        const row = await env.DB.prepare("SELECT pw FROM users WHERE username = ?1").bind(me.username).first();
        if (!row || !(await verifyPw(row.pw, cur))) return json(env, { error: "wrong_current" }, 400);
        await env.DB.prepare("UPDATE users SET pw = ?1, must_change = 0 WHERE username = ?2").bind(await hashPw(next), me.username).run();
        await ensureSessions(env);
        await env.DB.prepare("DELETE FROM sessions WHERE username = ?1").bind(me.username).run();
        const token = await createSession(env, me.username);
        return json(env, { ok: true }, 200, { "Set-Cookie": sessionCookie(token) });
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
        if (status === "confirmed") {
          const candidate = await env.DB.prepare("SELECT veh, from_dt, to_dt FROM bookings WHERE id = ?1").bind(id).first();
          const conflict = candidate && await findConflict(env, candidate.veh, candidate.from_dt, candidate.to_dt, id);
          if (conflict) return json(env, { error: "booking_conflict" }, 409);
        }
        await env.DB.prepare("UPDATE bookings SET status = ?1 WHERE id = ?2").bind(status, id).run();
        await env.DB.prepare("INSERT INTO booking_events (booking_id, action, by_user, note) VALUES (?1,?2,?3,?4)").bind(id, labels[status], me.username, clip(bodyData.note, 500)).run();
        if (status === "confirmed" || status === "declined") {
          const b = await env.DB.prepare("SELECT veh, from_dt, to_dt, cust_email, lang FROM bookings WHERE id = ?1").bind(id).first();
          if (b && b.cust_email) ctx.waitUntil(status === "confirmed" ? sendConfirmation(env, id, b) : sendDecline(env, id, b));
        }
        return json(env, { ok: true });
      }

      /* ---- booking bearbeiten (validator+) ---- */
      m = path.match(/^\/bookings\/(\d+)\/edit$/);
      if (m && method === "POST") {
        if (!hasPerm(me.role, "bookings.validate")) return json(env, { error: "forbidden" }, 403);
        const id = parseInt(m[1], 10);
        const cur = await env.DB.prepare("SELECT veh, from_dt, to_dt, cust_name, cust_email, cust_phone, msg, status FROM bookings WHERE id = ?1").bind(id).first();
        if (!cur) return json(env, { error: "not_found" }, 404);
        const veh = clip(bodyData.veh, 120).trim();
        const name = clip(bodyData.name, 120).trim();
        const email = clip(bodyData.email, 160).trim();
        const from = clip(bodyData.from, 40).trim();
        const to = clip(bodyData.to, 40).trim();
        if (!veh || !name || !from || !to) return json(env, { error: "missing_fields" }, 400);
        if ((email && !validEmail(email)) || !validDateTime(from) || !validDateTime(to)) return json(env, { error: "invalid_fields" }, 400);
        if (Date.parse(to) <= Date.parse(from)) return json(env, { error: "invalid_period" }, 400);
        // Wann d'Reservatioun bestätegt ass an d'Gefier/Datum änneren: Konflikt kontrolléieren
        if (cur.status === "confirmed" && (await findConflict(env, veh, from, to, id))) return json(env, { error: "booking_conflict" }, 409);
        const phone = clip(bodyData.phone, 60).trim();
        const msg = clip(bodyData.msg, 2000);
        const changed = [];
        if (veh !== cur.veh) changed.push("Gefier");
        if (from !== cur.from_dt || to !== cur.to_dt) changed.push("Datum");
        if (name !== cur.cust_name) changed.push("Numm");
        if (email !== (cur.cust_email || "")) changed.push("E-Mail");
        if (phone !== (cur.cust_phone || "")) changed.push("Telefon");
        if (msg !== (cur.msg || "")) changed.push("Noriicht");
        if (!changed.length) return json(env, { ok: true, unchanged: true });
        await env.DB.prepare("UPDATE bookings SET veh=?1, from_dt=?2, to_dt=?3, cust_name=?4, cust_email=?5, cust_phone=?6, msg=?7 WHERE id=?8")
          .bind(veh, from, to, name, email, phone, msg, id).run();
        await env.DB.prepare("INSERT INTO booking_events (booking_id, action, by_user, note) VALUES (?1,'Geännert',?2,?3)")
          .bind(id, me.username, clip(changed.join(", "), 500)).run();
        return json(env, { ok: true });
      }

      /* ---- booking läschen (admin) ---- */
      m = path.match(/^\/bookings\/(\d+)$/);
      if (m && method === "DELETE") {
        if (me.role !== "admin") return json(env, { error: "forbidden" }, 403);
        const id = parseInt(m[1], 10);
        await env.DB.prepare("DELETE FROM booking_events WHERE booking_id = ?1").bind(id).run();
        await env.DB.prepare("DELETE FROM bookings WHERE id = ?1").bind(id).run();
        return json(env, { ok: true });
      }

      /* ---- members (admin only) ---- */
      if (path === "/members" && method === "GET") {
        if (!hasPerm(me.role, "members.manage")) return json(env, { error: "forbidden" }, 403);
        const us = (await env.DB.prepare("SELECT username, name, role, active FROM users ORDER BY username ASC").all()).results || [];
        return json(env, { members: us.map((u) => ({ username: u.username, name: u.name, role: u.role, active: !!u.active })) });
      }
      if (path === "/member-events" && method === "GET") {
        if (!hasPerm(me.role, "members.manage")) return json(env, { error: "forbidden" }, 403);
        const ev = (await env.DB.prepare("SELECT action, target, by_user, at FROM member_events ORDER BY id DESC LIMIT 50").all()).results || [];
        return json(env, { events: ev.map((e) => ({ action: e.action, target: e.target, by: e.by_user, at: e.at })) });
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
        await ensureSessions(env);
        await env.DB.prepare("DELETE FROM sessions WHERE username = ?1").bind(target).run();
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
        if (bodyData.active !== undefined) {
          const act = bodyData.active ? 1 : 0;
          if (!act) {
            if (target === me.username) return json(env, { error: "self" }, 409);
            if (t.role === "admin" && (await adminCount(env)) <= 1) return json(env, { error: "last_admin" }, 409);
          }
          await env.DB.prepare("UPDATE users SET active = ?1 WHERE username = ?2").bind(act, target).run();
          if (!act) { await ensureSessions(env); await env.DB.prepare("DELETE FROM sessions WHERE username = ?1").bind(target).run(); }
          await env.DB.prepare("INSERT INTO member_events (action, target, by_user) VALUES (?1, ?2, ?3)").bind(act ? "activated" : "deactivated", target, me.username).run();
        }
        let selfRenamed = false, newUsername = null;
        if (bodyData.newUsername !== undefined) {
          const nu = clip(bodyData.newUsername, 60).trim().toLowerCase();
          if (!/^[a-z0-9._-]{3,}$/.test(nu)) return json(env, { error: "bad_input" }, 400);
          if (nu !== target) {
            const dup = await env.DB.prepare("SELECT username FROM users WHERE username = ?1").bind(nu).first();
            if (dup) return json(env, { error: "exists" }, 409);
            await env.DB.prepare("UPDATE users SET username = ?1 WHERE username = ?2").bind(nu, target).run();
            await ensureSessions(env);
            await env.DB.prepare("DELETE FROM sessions WHERE username = ?1").bind(target).run();
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
        await ensureSessions(env);
        await env.DB.prepare("DELETE FROM sessions WHERE username = ?1").bind(target).run();
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
