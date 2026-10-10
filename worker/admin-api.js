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
const PW_ITERATIONS = 100000;
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

async function createSession(env, username) {
  const token = randomToken();
  const tokenHash = await hashText(token);
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL;
  await env.DB.prepare("INSERT INTO sessions (token_hash, username, expires_at) VALUES (?1,?2,?3)").bind(tokenHash, username, expires).run();
  return token;
}

/* ---------- helpers ---------- */
function allowedOrigins(env) {
  const base = (env.ALLOW_ORIGIN || "https://autoservicebettenduerf.lu").replace(/\/$/, "");
  const list = [base];
  if (base.indexOf("://www.") === -1) list.push(base.replace("://", "://www."));
  return list;
}
function isAllowedOrigin(request, env) {
  return allowedOrigins(env).indexOf(request.headers.get("Origin") || "") !== -1;
}
function resolveOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  // Nëmmen déi explizitt Haaptdomain an hir www-Variant dierfen d'API am Browser benotzen.
  if (allowedOrigins(env).indexOf(origin) !== -1) return origin;
  return env.ALLOW_ORIGIN || "https://autoservicebettenduerf.lu";
}
function cors(env, extra) {
  return Object.assign({
    "Access-Control-Allow-Origin": env.RESPONSE_ORIGIN || env.ALLOW_ORIGIN || "https://autoservicebettenduerf.lu",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  }, extra || {});
}
function imageType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { type:"image/jpeg", ext:"jpg" };
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { type:"image/png", ext:"png" };
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP") return { type:"image/webp", ext:"webp" };
  return null;
}
function json(env, body, status, extraHeaders) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: cors(env, Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store" }, extraHeaders || {})) });
}
function clip(s, n) { return String(s == null ? "" : s).slice(0, n); }
function nullableNumber(v) { if (v === "" || v == null) return null; const n=Number(v); return Number.isFinite(n) && n >= 0 ? n : null; }
function validOptionalNumbers(body, keys) { return keys.every((k) => body[k] === "" || body[k] == null || (Number.isFinite(Number(body[k])) && Number(body[k]) >= 0)); }
function protocolMediaUrl(s) { const v=clip(s,500).trim(); return /^https:\/\/garage-admin\.autoservicebettenduerf\.lu\/media\/protocol\/[a-z0-9/_-]+\.(?:webp|jpg|png)$/i.test(v) ? v : ""; }
function protocolMediaList(s) { return String(s||"").split("\n").map(protocolMediaUrl).filter(Boolean).slice(0,24).join("\n"); }
function protocolMediaKeys(row) {
  const urls = String(row && row.photo_refs || "").split("\n").concat([row && row.customer_signature, row && row.staff_signature]);
  return urls.map(protocolMediaUrl).filter(Boolean).map((url) => new URL(url).pathname.replace(/^\/media\//, ""));
}
async function deleteProtocolMedia(env, keys) {
  const unique = [...new Set((keys || []).filter(Boolean))];
  if (env.MEDIA && unique.length) await env.MEDIA.delete(unique);
}
function hasPerm(role, perm) { return (PERMS[role] || []).indexOf(perm) !== -1; }
function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 160; }
function validDateTime(s) { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) && Number.isFinite(Date.parse(s)); }
function validDateOnly(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === s;
}
function vehicleDescriptors(s, fleet) {
  return String(s || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean).map((raw) => {
    const match = fleet.find((f) => {
      const name = String(f.vehicle || "").trim().toLowerCase();
      return name && (name === raw || name.includes(raw) || raw.includes(name));
    });
    if (match) return { id:Number(match.id), type:match.asset_type || "van", generic:false, raw };
    const type = /transporter|lieferwagen|utilitaire|\bvan\b/.test(raw) ? "van" : /anhänger|unhänger|remorque|trailer/.test(raw) ? "trailer" : /personenwagen|voiture|\bauto\b|\bcar\b/.test(raw) ? "car" : "";
    return { id:0, type, generic:!!type, raw };
  });
}
function descriptorOverlap(a,b) {
  if (a.id && b.id) return a.id === b.id;
  if (a.raw === b.raw) return true;
  return !!(a.type && b.type && a.type === b.type && (a.generic || b.generic));
}
async function hashText(s) {
  const digest = await crypto.subtle.digest("SHA-256", enc(s));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
// Workers rate-limit counters live outside D1. A missing binding fails closed.
async function publicEdgeAllowed(request, env) {
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip || !env.PUBLIC_REQUEST_LIMITER || !env.PUBLIC_GLOBAL_LIMITER) return false;
  const global = await env.PUBLIC_GLOBAL_LIMITER.limit({ key: "public-writes" });
  if (!global.success) return false;
  return (await env.PUBLIC_REQUEST_LIMITER.limit({ key: ip })).success;
}
async function publicRateAllowed(request, env) {
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip) return false;
  const hour = Math.floor(Date.now() / 3600000);
  const bucket = await hashText(ip + ":" + hour);
  const existing = await env.DB.prepare("SELECT count FROM booking_rate_limits WHERE bucket=?1").bind(bucket).first();
  if (existing && Number(existing.count) >= 8) return false;
  // The conditional UPSERT also caps concurrent attempts. Rejected requests
  // neither update count nor extend expiry. RETURNING identifies the winner.
  const row = await env.DB.prepare("INSERT INTO booking_rate_limits (bucket,count,expires_at) VALUES (?1,1,?2) ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count<8 RETURNING count")
    .bind(bucket, (hour + 2) * 3600).first();
  return !!row;
}
async function cleanupExpiredAuth(env) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM booking_rate_limits WHERE bucket IN (SELECT bucket FROM booking_rate_limits WHERE expires_at<?1 LIMIT 500)").bind(now),
    env.DB.prepare("DELETE FROM sessions WHERE token_hash IN (SELECT token_hash FROM sessions WHERE expires_at<?1 LIMIT 500)").bind(now),
  ]);
}

async function findConflict(env, veh, from, to, excludeId) {
  const fleet = (await env.DB.prepare("SELECT id,vehicle,asset_type FROM maintenance").all()).results || [];
  const wanted = vehicleDescriptors(veh,fleet);
  const rows = (await env.DB.prepare("SELECT id, veh, from_dt, to_dt FROM bookings WHERE status='confirmed' AND from_dt < ?1 AND to_dt > ?2").bind(to, from).all()).results || [];
  const hit = rows.find((b) => Number(b.id) !== Number(excludeId || 0) && wanted.some((a) => vehicleDescriptors(b.veh,fleet).some((x) => descriptorOverlap(a,x))));
  if (hit) return hit;
  const blocks = (await env.DB.prepare("SELECT id, vehicle, from_dt, to_dt FROM fleet_blocks WHERE from_dt < ?1 AND to_dt > ?2").bind(to, from).all()).results || [];
  return blocks.find((bl) => wanted.some((a) => vehicleDescriptors(bl.vehicle,fleet).some((x) => descriptorOverlap(a,x)))) || null;
}
/* ---------- Login brute-force throttle (reuse booking_rate_limits table) ---------- */
async function loginBucket(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  return "login:" + await hashText(ip + ":" + Math.floor(Date.now() / 3600000));
}
async function loginFails(env, bucket) {
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
    const idempotencyKey = crypto.randomUUID();
    if (text) payload.text = text;
    let lastStatus = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(payload),
      });
      lastStatus = response.status;
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return { ok: true, id: data.id || "", attempts: attempt + 1 };
      }
      if (response.status !== 429 && response.status < 500) break;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
    return { ok: false, error: "resend_http_" + lastStatus + "_after_retries" };
  } catch (e) { return { ok: false, error: clip(e && e.message || e, 160) }; }
}

const PRIVACY_NOTICE_VERSION = "2026-10-09";
const RENTAL_TERMS_VERSION = "2026-10-09";

async function saveConsent(env, type, id, privacy, terms) {
  const termsVersion = terms && type === "booking" ? RENTAL_TERMS_VERSION : null;
  await env.DB.prepare("INSERT OR REPLACE INTO request_consents (request_type, request_id, privacy_accepted, terms_accepted, privacy_version, terms_version, consent_at) VALUES (?1,?2,?3,?4,?5,?6,CURRENT_TIMESTAMP)")
    .bind(type, id, privacy ? 1 : 0, terms ? 1 : 0, PRIVACY_NOTICE_VERSION, termsVersion).run();
}
async function sendConfirmation(env, bookingId, booking) {
  booking.ref = "AB-L-" + String(bookingId).padStart(5, "0");
  const mail = confirmMail(booking);
  const result = await sendEmail(env, booking.cust_email, mail.subject, mail.html, mail.text);
  await env.DB.prepare("INSERT INTO booking_events (booking_id, action, by_user, note) VALUES (?1,?2,'System',?3)")
    .bind(bookingId, result.ok ? "Bestätegungsmail geschéckt" : "Bestätegungsmail feelgeschloen", clip(result.ok ? result.id : result.error, 500)).run();
}
async function sendDecline(env, bookingId, booking) {
  booking.ref = "AB-L-" + String(bookingId).padStart(5, "0");
  const mail = declineMail(booking);
  const result = await sendEmail(env, booking.cust_email, mail.subject, mail.html, mail.text);
  await env.DB.prepare("INSERT INTO booking_events (booking_id, action, by_user, note) VALUES (?1,?2,'System',?3)")
    .bind(bookingId, result.ok ? "Ofsomail geschéckt" : "Ofsomail feelgeschloen", clip(result.ok ? result.id : result.error, 500)).run();
}
async function sendNewBookingNotice(env, bookingId, booking) {
  const subject = "Nei Ufro fir eng Locatioun AB-L-" + String(bookingId).padStart(5, "0");
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c2430">' +
    '<h2 style="color:#c81420">Nei Ufro fir eng Locatioun</h2>' +
    '<p><b>' + esc(booking.cust_name) + '</b> freet <b>' + esc(booking.veh) + '</b> un.</p>' +
    '<p><b>Vun:</b> ' + esc(booking.from_dt.replace("T", " ")) + '<br><b>Bis:</b> ' + esc(booking.to_dt.replace("T", " ")) + '<br><b>E-Mail:</b> ' + esc(booking.cust_email) + '</p>' +
    '<p><a href="https://autoservicebettenduerf.lu/intern/" style="display:inline-block;background:#c81420;color:#fff;text-decoration:none;padding:11px 16px;border-radius:8px;font-weight:700">An der Verwaltung opmaachen</a></p></div>';
  const text = "Nei Ufro fir eng Locatioun\n\n" + booking.cust_name + " freet " + booking.veh + " un.\n" +
    "Vun: " + booking.from_dt.replace("T", " ") + "\nBis: " + booking.to_dt.replace("T", " ") + "\nE-Mail: " + booking.cust_email +
    "\n\nAn der Verwaltung opmaachen: https://autoservicebettenduerf.lu/intern/";
  const result = await sendEmail(env, env.MAIL_TO || "Autoservicebettenduerf@outlook.com", subject, html, text);
  await env.DB.prepare("INSERT INTO booking_events (booking_id, action, by_user, note) VALUES (?1,?2,'System',?3)")
    .bind(bookingId, result.ok ? "Intern Notifikatioun geschéckt" : "Intern Notifikatioun feelgeschloen", clip(result.ok ? result.id : result.error, 500)).run();
}
async function sendBookingReceipt(env, bookingId, booking) {
  const L = ["lb", "de", "fr", "en"].includes(booking.lang) ? booking.lang : "lb";
  const ref = "AB-L-" + String(bookingId).padStart(5, "0");
  const copy = {
    lb: { subject: "Mir hunn Är Ufro fir eng Locatioun kritt – " + ref, title: "Är Ufro ass ukomm", intro: "Mir kontrolléieren elo d’Disponibilitéit an d’Konditiounen. Dëst ass nach keng verbindlech Buchung.", vehicle: "Gefier", from: "Vun", to: "Bis", next: "Mir mellen eis mat enger perséinlecher Bestätegung oder enger Alternativ." },
    de: { subject: "Wir haben Ihre Verleih-Anfrage erhalten – " + ref, title: "Ihre Anfrage ist eingegangen", intro: "Wir prüfen nun Verfügbarkeit und Bedingungen. Dies ist noch keine verbindliche Buchung.", vehicle: "Fahrzeug", from: "Von", to: "Bis", next: "Wir melden uns mit einer persönlichen Bestätigung oder einer Alternative." },
    fr: { subject: "Nous avons reçu votre demande de location – " + ref, title: "Votre demande est bien arrivée", intro: "Nous vérifions maintenant la disponibilité et les conditions. Il ne s’agit pas encore d’une réservation ferme.", vehicle: "Véhicule", from: "Du", to: "Au", next: "Nous vous recontactons avec une confirmation personnelle ou une alternative." },
    en: { subject: "We received your rental request – " + ref, title: "Your request has arrived", intro: "We are now checking availability and conditions. This is not yet a binding booking.", vehicle: "Vehicle", from: "From", to: "Until", next: "We will contact you with a personal confirmation or an alternative." }
  }[L];
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c2430">' +
    '<div style="background:#0d1b2a;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;font-weight:800">Autoservice Bettenduerf</div>' +
    '<div style="border:1px solid #e6e9ee;border-top:0;border-radius:0 0 10px 10px;padding:20px"><h2 style="margin:0 0 8px;color:#2e7d5b">✓ ' + esc(copy.title) + '</h2><p>' + esc(copy.intro) + '</p>' +
    '<p><b>Ref.:</b> ' + esc(ref) + '<br><b>' + esc(copy.vehicle) + ':</b> ' + esc(booking.veh) + '<br><b>' + esc(copy.from) + ':</b> ' + esc(booking.from_dt.replace("T", " ")) + '<br><b>' + esc(copy.to) + ':</b> ' + esc(booking.to_dt.replace("T", " ")) + '</p><p>' + esc(copy.next) + '</p>' +
    '<p style="color:#8a96a2;font-size:12px">Autoservice Bettenduerf · 63, rue de Diekirch-Echternach · L-9355 Bettendorf · +352 80 86 87</p></div></div>';
  const text = copy.title + "\n\n" + copy.intro + "\n\nRef.: " + ref + "\n" + copy.vehicle + ": " + booking.veh + "\n" + copy.from + ": " + booking.from_dt.replace("T", " ") + "\n" + copy.to + ": " + booking.to_dt.replace("T", " ") + "\n\n" + copy.next;
  const result = await sendEmail(env, booking.cust_email, copy.subject, html, text);
  await env.DB.prepare("INSERT INTO booking_events (booking_id, action, by_user, note) VALUES (?1,?2,'System',?3)")
    .bind(bookingId, result.ok ? "Empfangsmail geschéckt" : "Empfangsmail feelgeschloen", clip(result.ok ? result.id : result.error, 500)).run();
}

async function snapshotForBooking(env, b) {
  const fleet = (await env.DB.prepare("SELECT * FROM maintenance ORDER BY id ASC").all()).results || [];
  const items = vehicleDescriptors(b.veh, fleet).map((d) => {
    let f = d.id ? fleet.find((x) => Number(x.id) === d.id) : null;
    if (!f && d.type) {
      const sameType = fleet.filter((x) => String(x.asset_type || "van") === d.type);
      if (sameType.length === 1) f = sameType[0];
    }
    return f ? {
      id:Number(f.id), name:f.vehicle || d.raw, type:f.asset_type || "van", plate:f.plate || "", year:f.year || "",
      fuel:f.fuel || "", transmission:f.transmission || "", licenseClass:f.license_class || "", loadSpace:f.load_space || "",
      grossWeight:f.gross_weight || "", payload:f.payload || "", braked:!!f.braked,
      priceDay:Number(f.price_day || 0), deposit:Number(f.deposit || 0), includedKm:Number(f.included_km || 0),
      extraKmRate:Number(f.extra_km_rate || 0), lateFeeHour:Number(f.late_fee_hour || 0)
    } : { name:d.raw || b.veh, type:d.type || "van", priceDay:0, deposit:0, includedKm:0, extraKmRate:0, lateFeeHour:0 };
  });
  return JSON.stringify({ version:1, capturedAt:new Date().toISOString(), customer:{ name:b.cust_name || "", email:b.cust_email || "", phone:b.cust_phone || "" }, rental:{ from:b.from_dt, to:b.to_dt, lang:b.lang || "lb", requestedVehicle:b.veh || "" }, items });
}
async function freezeBookingSnapshot(env, id, force) {
  const b = await env.DB.prepare("SELECT * FROM bookings WHERE id=?1").bind(id).first();
  if (!b || (!force && b.contract_snapshot)) return b;
  const snapshot = await snapshotForBooking(env, b);
  await env.DB.prepare("UPDATE bookings SET contract_snapshot=?1, snapshot_at=CURRENT_TIMESTAMP WHERE id=?2" + (force ? "" : " AND (contract_snapshot IS NULL OR contract_snapshot='')")).bind(snapshot,id).run();
  return Object.assign({}, b, { contract_snapshot:snapshot });
}

/* ---------- Deeglecht Backup vun der D1-Datebank op R2 ---------- */
async function runBackup(env) {
  if (!env.MEDIA) return { ok: false, error: "no_media" };
  const tables = ["bookings", "booking_events", "appointments", "appointment_events", "maintenance", "rental_inspections", "request_consents", "member_events", "customers", "customer_vehicles", "work_orders", "work_order_events", "admin_settings"];
  const dump = { formatVersion: 2, exportedAt: new Date().toISOString(), db: "garage-admin", tables: {}, mediaInventory: { fleet: 0, protocol: 0 } };
  for (const tbl of tables) {
    try { dump.tables[tbl] = (await env.DB.prepare("SELECT * FROM " + tbl).all()).results || []; }
    catch (e) { dump.tables[tbl] = []; }
  }
  // Memberen ouni Passwuert-Hash (manner sensibel Backup)
  try { dump.tables.users = (await env.DB.prepare("SELECT username,name,role,active,must_change FROM users").all()).results || []; } catch (e) {}
  // Medien bleiwen am private R2-Bucket; den Inventar mécht eng Integritéitskontroll méiglech.
  for (const scope of ["fleet/", "protocol/"]) {
    let cursor;
    do {
      const listed = await env.MEDIA.list({ prefix: scope, limit: 1000, cursor });
      dump.mediaInventory[scope.slice(0, -1)] += (listed.objects || []).length;
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
  }
  const now = new Date();
  const key = "backups/" + now.getUTCFullYear() + "/" + now.toISOString().slice(0, 10) + ".json";
  const body = JSON.stringify(dump);
  const checksum = await hashText(body);
  await env.MEDIA.put(key, body, { httpMetadata: { contentType: "application/json", cacheControl: "private, no-store" }, customMetadata: { kind: "backup", sha256: checksum } });
  // Donnéeëminiméierung: automatesch Backuppe maximal 90 Deeg behalen.
  const cutoff = Date.now() - 90 * 86400000;
  const old = await env.MEDIA.list({ prefix: "backups/", limit: 1000 });
  const expired = (old.objects || []).filter((o) => o.uploaded && new Date(o.uploaded).getTime() < cutoff).map((o) => o.key);
  if (expired.length) await env.MEDIA.delete(expired);
  return { ok: true, key, bytes: body.length, checksum };
}
async function sendNewApptNotice(env, apptId, a) {
  const inq = a.kind === "inquiry";
  const ref = (inq ? "P-" : "T-") + (Number(apptId) + 1000);
  const title = inq ? "Nei Produktufro" : "Nei Rendez-vous-Ufro";
  const subject = title + " " + ref + (a.service ? " – " + a.service : "");
  const rows = [["Numm", a.name], [inq ? "Ufro" : "Service", a.service], ["Gefier", a.vehicle], ["Wonschdatum", a.pref_date], ["E-Mail", a.email]].filter(function (r) { return r[1]; });
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c2430">' +
    '<h2 style="color:#c81420">' + esc(title) + "</h2>" +
    "<p>" + rows.map(function (r) { return "<b>" + esc(r[0]) + ":</b> " + esc(r[1]); }).join("<br>") + "</p>" +
    '<p><a href="https://autoservicebettenduerf.lu/intern/" style="display:inline-block;background:#c81420;color:#fff;text-decoration:none;padding:11px 16px;border-radius:8px;font-weight:700">An der Verwaltung opmaachen</a></p></div>';
  const text = title + "\n\n" + rows.map(function (r) { return r[0] + ": " + r[1]; }).join("\n") + "\n\nAn der Verwaltung opmaachen: https://autoservicebettenduerf.lu/intern/";
  const result = await sendEmail(env, env.MAIL_TO || "Autoservicebettenduerf@outlook.com", subject, html, text);
  await env.DB.prepare("INSERT INTO appointment_events (appointment_id, action, by_user, note) VALUES (?1,?2,'System',?3)")
    .bind(apptId, result.ok ? "Intern Notifikatioun geschéckt" : "Intern Notifikatioun feelgeschloen", clip(result.ok ? result.id : result.error, 500)).run();
}
/* Datum (YYYY-MM-DD) a fir d'Sprooch formatéieren, ëmmer an der Lëtzebuerger Zäitzon. */
function apptDateLabel(dateStr, lang) {
  if (!dateStr) return "";
  var d = new Date(String(dateStr).slice(0, 10) + "T12:00:00Z");
  if (isNaN(d.getTime())) return String(dateStr);
  if (lang === "lb") {
    var days = ["Sonndeg", "Méindeg", "Dënschdeg", "Mëttwoch", "Donneschdeg", "Freideg", "Samschdeg"];
    var months = ["Januar", "Februar", "Mäerz", "Abrëll", "Mee", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
    return days[d.getUTCDay()] + ", " + d.getUTCDate() + ". " + months[d.getUTCMonth()] + " " + d.getUTCFullYear();
  }
  var loc = { de: "de-DE", fr: "fr-FR", en: "en-GB" }[lang] || "de-DE";
  try { return new Intl.DateTimeFormat(loc, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Luxembourg" }).format(d); }
  catch (e) { return String(dateStr).slice(0, 10); }
}
function apptConfirmMail(a) {
  var L = ["lb", "de", "fr", "en"].includes(a.lang) ? a.lang : "lb";
  var dateLabel = apptDateLabel(a.confirmed_date || a.pref_date, L);
  var time = a.confirmed_time || "";
  var T = {
    lb: { s: "Äre Rendez-vous ass bestätegt", h: "Rendez-vous bestätegt", p: "Mir hunn Äre Rendez-vous bestätegt:", service: "Service", date: "Datum", time: "Auerzäit", veh: "Gefier", foot: "Bei Froen äntwert einfach op dës E-Mail oder rufft eis un. Mir freeën eis op Iech!" },
    de: { s: "Ihr Termin ist bestätigt", h: "Termin bestätigt", p: "Wir haben Ihren Termin bestätigt:", service: "Leistung", date: "Datum", time: "Uhrzeit", veh: "Fahrzeug", foot: "Bei Fragen antworten Sie einfach auf diese E-Mail oder rufen Sie uns an. Wir freuen uns auf Sie!" },
    fr: { s: "Votre rendez-vous est confirmé", h: "Rendez-vous confirmé", p: "Nous avons confirmé votre rendez-vous :", service: "Prestation", date: "Date", time: "Heure", veh: "Véhicule", foot: "Pour toute question, répondez simplement à cet e-mail ou appelez-nous. À bientôt !" },
    en: { s: "Your appointment is confirmed", h: "Appointment confirmed", p: "We have confirmed your appointment:", service: "Service", date: "Date", time: "Time", veh: "Vehicle", foot: "If you have any questions, just reply to this e-mail or call us. We look forward to seeing you!" }
  }[L];
  var rows = [[T.service, a.service], [T.veh, a.vehicle], [T.date, dateLabel], [T.time, time]].filter(function (r) { return r[1]; });
  var detailHtml = rows.map(function (r) { return "<b>" + esc(r[0]) + ":</b> " + esc(r[1]); }).join("<br>");
  var html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c2430">' +
    '<div style="background:#0d1b2a;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;font-weight:800">Autoservice Bettenduerf</div>' +
    '<div style="border:1px solid #e6e9ee;border-top:0;border-radius:0 0 10px 10px;padding:20px">' +
    '<h2 style="margin:0 0 8px;color:#2e7d5b">✓ ' + esc(T.h) + "</h2><p>" + esc(T.p) + "</p>" +
    "<p>" + detailHtml + "</p><p>" + esc(T.foot) + "</p>" +
    '<p style="color:#8a96a2;font-size:12px">Autoservice Bettenduerf · 63, rue de Diekirch-Echternach · L-9355 Bettendorf · +352 80 86 87</p></div></div>';
  var text = T.h + "\n\n" + T.p + "\n\n" + rows.map(function (r) { return r[0] + ": " + r[1]; }).join("\n") + "\n\n" + T.foot +
    "\n\nAutoservice Bettenduerf · 63, rue de Diekirch-Echternach · L-9355 Bettendorf · +352 80 86 87";
  return { subject: T.s, html: html, text: text };
}
async function sendApptConfirmation(env, apptId, a, byUser = "System") {
  const mail = apptConfirmMail(a);
  const result = await sendEmail(env, a.email, mail.subject, mail.html, mail.text);
  await env.DB.prepare("INSERT INTO appointment_events (appointment_id, action, by_user, note) VALUES (?1,?2,?3,?4)")
    .bind(apptId, result.ok ? "Bestätegungsmail geschéckt" : "Bestätegungsmail feelgeschloen", byUser, clip(result.ok ? result.id : result.error, 500)).run();
  return result;
}
/* Empfangsbestätegung un de Client beim Androen vun enger Ufro (nach keng Bestätegung). */
function apptReceiptMail(a) {
  var L = ["lb", "de", "fr", "en"].includes(a.lang) ? a.lang : "lb";
  var inq = a.kind === "inquiry";
  var dateLabel = apptDateLabel(a.pref_date, L);
  var C = {
    lb: { sA: "Mir hunn Är Rendez-vous-Ufro kritt", sI: "Mir hunn Är Ufro kritt", h: "Är Ufro ass ukomm", pA: "Villmools Merci! Mir hunn Är Rendez-vous-Ufro kritt. Dëst ass nach keng definitiv Bestätegung – mir mellen eis geschwënn mat engem Termin.", pI: "Villmools Merci! Mir hunn Är Ufro kritt a mellen eis geschwënn mat de Präisser an der Disponibilitéit.", service: "Service", ufro: "Ufro", veh: "Gefier", date: "Wonschdatum", foot: "Bei Froen äntwert einfach op dës E-Mail oder rufft eis un. Villmools Merci!" },
    de: { sA: "Wir haben Ihre Terminanfrage erhalten", sI: "Wir haben Ihre Anfrage erhalten", h: "Ihre Anfrage ist eingegangen", pA: "Vielen Dank! Wir haben Ihre Terminanfrage erhalten. Dies ist noch keine verbindliche Bestätigung – wir melden uns in Kürze mit einem Termin.", pI: "Vielen Dank! Wir haben Ihre Anfrage erhalten und melden uns in Kürze mit Preisen und Verfügbarkeit.", service: "Leistung", ufro: "Anfrage", veh: "Fahrzeug", date: "Wunschdatum", foot: "Bei Fragen antworten Sie einfach auf diese E-Mail oder rufen Sie uns an. Vielen Dank!" },
    fr: { sA: "Nous avons reçu votre demande de rendez-vous", sI: "Nous avons reçu votre demande", h: "Votre demande est bien arrivée", pA: "Merci beaucoup ! Nous avons reçu votre demande de rendez-vous. Il ne s'agit pas encore d'une confirmation ferme – nous revenons vers vous avec un horaire.", pI: "Merci beaucoup ! Nous avons bien reçu votre demande et revenons vers vous rapidement avec les prix et la disponibilité.", service: "Prestation", ufro: "Demande", veh: "Véhicule", date: "Date souhaitée", foot: "Pour toute question, répondez à cet e-mail ou appelez-nous. Merci !" },
    en: { sA: "We received your appointment request", sI: "We received your request", h: "Your request has arrived", pA: "Thank you! We have received your appointment request. This is not yet a firm confirmation – we will get back to you with a time.", pI: "Thank you! We have received your request and will get back to you soon with prices and availability.", service: "Service", ufro: "Request", veh: "Vehicle", date: "Preferred date", foot: "If you have any questions, just reply to this e-mail or call us. Thank you!" }
  }[L];
  var subject = inq ? C.sI : C.sA, intro = inq ? C.pI : C.pA;
  var rows = [[inq ? C.ufro : C.service, a.service], [C.veh, a.vehicle]];
  if (!inq) rows.push([C.date, dateLabel + (a.daytime ? " · " + a.daytime : "")]);
  rows = rows.filter(function (r) { return r[1]; });
  var detail = rows.map(function (r) { return "<b>" + esc(r[0]) + ":</b> " + esc(r[1]); }).join("<br>");
  var html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c2430">' +
    '<div style="background:#0d1b2a;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;font-weight:800">Autoservice Bettenduerf</div>' +
    '<div style="border:1px solid #e6e9ee;border-top:0;border-radius:0 0 10px 10px;padding:20px">' +
    '<h2 style="margin:0 0 8px;color:#2e7d5b">✓ ' + esc(C.h) + "</h2><p>" + esc(intro) + "</p>" +
    "<p>" + detail + "</p><p>" + esc(C.foot) + "</p>" +
    '<p style="color:#8a96a2;font-size:12px">Autoservice Bettenduerf · 63, rue de Diekirch-Echternach · L-9355 Bettendorf · +352 80 86 87</p></div></div>';
  var text = C.h + "\n\n" + intro + "\n\n" + rows.map(function (r) { return r[0] + ": " + r[1]; }).join("\n") + "\n\n" + C.foot +
    "\n\nAutoservice Bettenduerf · 63, rue de Diekirch-Echternach · L-9355 Bettendorf · +352 80 86 87";
  return { subject: subject, html: html, text: text };
}
async function sendApptReceipt(env, apptId, a) {
  const mail = apptReceiptMail(a);
  const result = await sendEmail(env, a.email, mail.subject, mail.html, mail.text);
  await env.DB.prepare("INSERT INTO appointment_events (appointment_id, action, by_user, note) VALUES (?1,?2,'System',?3)")
    .bind(apptId, result.ok ? "Empfangsmail geschéckt" : "Empfangsmail feelgeschloen", clip(result.ok ? result.id : result.error, 500)).run();
}
// Beim Bestätegen vun engem Rendez-vous: Client + Gefier an d'CRM iwwerhuelen an
// en Aarbechtsoptrag uleeën (best-effort, idempotent — stéiert d'Bestätegung ni).
async function ensureCrmLink(env, a, byUser) {
  try {
    const email = String(a.email || "").trim().toLowerCase();
    let customerId = null;
    if (email) {
      const existing = await env.DB.prepare("SELECT id FROM customers WHERE lower(trim(email))=?1 ORDER BY id ASC").bind(email).first();
      if (existing) { customerId = existing.id; await env.DB.prepare("UPDATE customers SET archived=0,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND COALESCE(archived,0)<>0").bind(customerId).run(); }
      else {
        const r = await env.DB.prepare("INSERT INTO customers (name,email,phone,source) VALUES (?1,?2,?3,'appointment')")
          .bind(clip(a.name, 120).trim() || email, email, clip(a.phone, 60) || null).run();
        customerId = r.meta.last_row_id;
      }
    }
    let vehicleId = null;
    const makeModel = clip(a.vehicle, 160).trim();
    if (customerId && makeModel) {
      const vin = clip(a.vin, 60);
      const dupe = await env.DB.prepare("SELECT id FROM customer_vehicles WHERE customer_id=?1 AND lower(trim(make_model))=lower(trim(?2)) AND lower(trim(COALESCE(vin,'')))=lower(trim(COALESCE(?3,''))) ORDER BY id ASC").bind(customerId, makeModel, vin || "").first();
      if (dupe) vehicleId = dupe.id;
      else { const rv = await env.DB.prepare("INSERT INTO customer_vehicles (customer_id,make_model,vin) VALUES (?1,?2,?3)").bind(customerId, makeModel, vin || null).run(); vehicleId = rv.meta.last_row_id; }
    }
    // Ee Aarbechtsoptrag pro Rendez-vous (idx_work_orders_appointment ass UNIQUE).
    const linked = await env.DB.prepare("SELECT id FROM work_orders WHERE appointment_id=?1").bind(a.id).first();
    if (!linked) {
      const title = clip(a.service, 180).trim() || "Rendez-vous";
      const planned = a.duration_min == null ? null : a.duration_min;
      const r = await env.DB.prepare("INSERT INTO work_orders (appointment_id,customer_id,vehicle_id,title,status,assigned_to,planned_minutes,description) VALUES (?1,?2,?3,?4,'planned',?5,?6,?7)")
        .bind(a.id, customerId, vehicleId, title, a.assigned_to || null, planned, clip(a.msg, 3000) || null).run();
      const id = r.meta.last_row_id, ref = "AB-A-" + new Date().getFullYear() + "-" + String(id).padStart(4, "0");
      await env.DB.batch([
        env.DB.prepare("UPDATE work_orders SET reference=?1 WHERE id=?2").bind(ref, id),
        env.DB.prepare("INSERT INTO work_order_events (work_order_id,action,by_user,note) VALUES (?1,'Ugeluecht',?2,'aus Rendez-vous')").bind(id, byUser || "System"),
      ]);
    }
  } catch (e) { /* best-effort: en CRM-Feeler däerf d'Bestätegung ni blockéieren */ }
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
  var masterTerms = /renault\s+master/i.test(b.veh || "") ? ({
    lb: "Konditiounen: 100 € pro ugefaangene 24 Stonnen, 250 km pro Locatioun abegraff, duerno 0,30 €/km, Kautioun 250 €, Foyer-Assurance mat 750 € Selbstbedeelegung pro Schuedefall, verspéite Retour 20 € pro ugefaangener Stonn. Annulatioun ënner 24 Stonnen oder Net-Erschéinen: 50 €.",
    de: "Konditionen: 100 € pro angefangenen 24 Stunden, 250 km pro Miete inklusive, danach 0,30 €/km, Kaution 250 €, Foyer-Versicherung mit 750 € Selbstbeteiligung je Schadenfall, verspätete Rückgabe 20 € pro angefangener Stunde. Stornierung unter 24 Stunden oder Nichterscheinen: 50 €.",
    fr: "Conditions : 100 € par tranche de 24 heures entamée, 250 km par location inclus, puis 0,30 €/km, caution 250 €, assurance Foyer avec franchise de 750 € par sinistre, retard 20 € par heure entamée. Annulation à moins de 24 heures ou non-présentation : 50 €.",
    en: "Terms: €100 per 24-hour period or part thereof, 250 km included per rental, then €0.30/km, €250 deposit, Foyer insurance with a €750 excess per claim, late return €20 per hour or part thereof. Cancellation within 24 hours or no-show: €50."
  }[L] || "") : "";
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
    (masterTerms ? '<p style="background:#f5f7f9;border-radius:8px;padding:12px;font-size:13px;line-height:1.5">' + esc(masterTerms) + "</p>" : "") +
    '<p style="color:#5b6b7c;font-size:13px;margin-top:18px">' + esc(t.foot) + "</p>" +
    '<p style="color:#8a96a2;font-size:12px;margin-top:14px">Autoservice Bettenduerf · 63, rue de Diekirch-Echternach · L-9355 Bettendorf · +352 80 86 87</p>' +
    "</div></div>";
  return { subject: t.s, html: html, text: mailText(t, b) + (masterTerms ? "\n\n" + masterTerms : "") };
}
function declineMail(b) {
  var L = (b.lang || "lb").slice(0, 2);
  var T = {
    lb: { s: "Är Ufro fir eng Locatioun – leider net méiglech", h: "Et deet eis leed", p: "Villmools Merci fir Är Ufro. Leider ass dat gewënschte Material an dësem Zäitraum net disponibel:", veh: "Gefier", from: "Vun", to: "Bis", foot: "Rufft eis gären un – vläicht fanne mir zesumme en anere Moment oder eng Alternativ. Mir soen Iech Merci fir d'Versteesdemech." },
    de: { s: "Ihre Verleih-Anfrage – leider nicht möglich", h: "Es tut uns leid", p: "Vielen Dank für Ihre Anfrage. Leider ist das gewünschte Material in diesem Zeitraum nicht verfügbar:", veh: "Fahrzeug", from: "Von", to: "Bis", foot: "Rufen Sie uns gerne an – vielleicht finden wir gemeinsam einen anderen Termin oder eine Alternative. Danke für Ihr Verständnis." },
    fr: { s: "Votre demande de location – malheureusement impossible", h: "Nous sommes désolés", p: "Merci beaucoup pour votre demande. Malheureusement, le matériel souhaité n'est pas disponible sur cette période :", veh: "Véhicule", from: "Du", to: "Au", foot: "N'hésitez pas à nous appeler – nous trouverons peut-être ensemble une autre date ou une alternative. Merci de votre compréhension." },
    en: { s: "Your rental request – unfortunately not possible", h: "We're sorry", p: "Thank you very much for your request. Unfortunately the requested item is not available for this period:", veh: "Vehicle", from: "From", to: "To", foot: "Feel free to call us – perhaps we can find another date or an alternative together. Thank you for your understanding." },
  }[L] || null;
  var t = T || { s: "Är Ufro fir eng Locatioun – leider net méiglech", h: "Et deet eis leed", p: "Leider ass dat gewënschte Material an dësem Zäitraum net disponibel:", veh: "Gefier", from: "Vun", to: "Bis", foot: "Rufft eis gären un. Merci fir d'Versteesdemech." };
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
  // Nëmmen den HttpOnly-Cookie akzeptéieren. Esou ass de Sessiounsgeheimnis
  // fir JavaScript an och bei enger méiglecher XSS net ausliesbar.
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await hashText(token);
  const sess = await env.DB.prepare("SELECT username, expires_at FROM sessions WHERE token_hash = ?1").bind(tokenHash).first();
  if (!sess || Number(sess.expires_at) < Math.floor(Date.now() / 1000)) {
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
    env = Object.assign(Object.create(env), { RESPONSE_ORIGIN: resolveOrigin(request, env) });
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = request.method.toUpperCase();
    if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env) });

    let bodyData = {};
    if (method === "POST" && (request.headers.get("content-type") || "").includes("application/json")) {
      try { bodyData = await request.json(); } catch (e) { bodyData = {}; }
    }

    try {
      /* ---- ëffentlech: Shop-Katalog aus D1 (verbindlech Präisquell) ---- */
      if (path === "/catalog/meta" && method === "GET") {
        const active = await env.DB.prepare("SELECT value FROM catalog_settings WHERE key='active_catalog_version'").first();
        if (!active) return json(env, { error:"catalog_not_ready" }, 503);
        const current = await env.DB.prepare("SELECT product_count,remus_count,dba_count,meta_json FROM catalog_versions WHERE version=?1").bind(active.value).first();
        if (!current) return json(env, { error:"catalog_not_ready" }, 503);
        const rows = (await env.DB.prepare("SELECT meta_key,value_json FROM catalog_metadata WHERE version=?1 ORDER BY meta_key").bind(active.value).all()).results || [];
        const catalog = { meta:JSON.parse(current.meta_json), images:[] };
        rows.forEach((row) => { const value=JSON.parse(row.value_json); if(row.meta_key.startsWith("images:")) catalog.images.push(...value); else catalog[row.meta_key]=value; });
        return json(env, { version:active.value, counts:{ product_count:current.product_count, remus_count:current.remus_count, dba_count:current.dba_count }, catalog }, 200, { "Cache-Control":"public, max-age=300, stale-while-revalidate=3600" });
      }
      if (path === "/catalog/products" && method === "GET") {
        const manufacturer = String(url.searchParams.get("manufacturer") || "").toUpperCase();
        if (!["REMUS","DBA"].includes(manufacturer)) return json(env, { error:"invalid_manufacturer" }, 400);
        const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get("limit")) || 500));
        const cursor = clip(url.searchParams.get("cursor"), 120);
        const active = await env.DB.prepare("SELECT value FROM catalog_settings WHERE key='active_catalog_version'").first();
        if (!active) return json(env, { error:"catalog_not_ready" }, 503);
        const rows = (await env.DB.prepare("SELECT sku,price_cents,payload_json FROM catalog_products WHERE version=?1 AND manufacturer=?2 AND sku>?3 ORDER BY sku LIMIT ?4").bind(active.value,manufacturer,cursor,limit+1).all()).results || [];
        const hasMore = rows.length > limit, page = hasMore ? rows.slice(0,limit) : rows;
        const items = page.map((row) => Object.assign(JSON.parse(row.payload_json), { p:Number(row.price_cents) }));
        return json(env, { version:active.value, items, nextCursor:hasMore ? page[page.length-1].sku : null }, 200, { "Cache-Control":"public, max-age=300, stale-while-revalidate=3600" });
      }

      /* ---- ëffentlech: nei Reservatiounsufro (vum Locatiounsformulaire) ---- */
      if (path === "/bookings" && method === "POST") {
        if (!isAllowedOrigin(request, env)) return json(env, { error: "forbidden_origin" }, 403);
        if (!(request.headers.get("content-type") || "").includes("application/json")) return json(env, { error: "unsupported_media_type" }, 415);
        if (bodyData.website) return json(env, { ok: true }, 202);
        if (!(await publicEdgeAllowed(request, env))) return json(env, { error: "rate_limited" }, 429);
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
        if (!(await publicRateAllowed(request, env))) return json(env, { error: "rate_limited" }, 429);
        if (await findConflict(env, veh, from, to)) return json(env, { error: "unavailable" }, 409);
        const r = await env.DB.prepare(
          "INSERT INTO bookings (veh, from_dt, to_dt, cust_name, cust_email, cust_phone, msg, lang, status) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'new')"
        ).bind(veh, from, to, name, email, clip(bodyData.phone, 60), clip(bodyData.msg, 2000), ["lb","de","fr","en"].includes(bodyData.lang) ? bodyData.lang : "lb").run();
        const id = r.meta.last_row_id;
        await saveConsent(env, "booking", id, bodyData.privacy, bodyData.terms);
        await env.DB.prepare("INSERT INTO booking_events (booking_id, action, by_user, note) VALUES (?1,'Ufro erakomm','System','')").bind(id).run();
        const mailData = { veh, from_dt: from, to_dt: to, cust_name: name, cust_email: email, lang: ["lb","de","fr","en"].includes(bodyData.lang) ? bodyData.lang : "lb" };
        ctx.waitUntil(Promise.all([sendNewBookingNotice(env, id, mailData), sendBookingReceipt(env, id, mailData)]));
        return json(env, { ok: true, id, ref: "AB-L-" + String(id).padStart(5, "0") });
      }

      /* ---- public: Disponibilitéit (nëmme bestätegt Perioden, keng perséinlech Donnéeën) ---- */
      if (path === "/availability" && method === "GET") {
        const since = new Date(Date.now() - 86400000).toISOString().slice(0, 16);
        const rows = (await env.DB.prepare("SELECT veh, from_dt, to_dt FROM bookings WHERE status='confirmed' AND to_dt >= ?1 ORDER BY from_dt ASC LIMIT 500").bind(since).all()).results || [];
        const blocks = (await env.DB.prepare("SELECT vehicle, from_dt, to_dt FROM fleet_blocks WHERE to_dt >= ?1 ORDER BY from_dt ASC LIMIT 500").bind(since).all()).results || [];
        const busy = rows.map((r) => ({ veh: r.veh, from: r.from_dt, to: r.to_dt }))
          .concat(blocks.map((r) => ({ veh: r.vehicle, from: r.from_dt, to: r.to_dt })));
        return json(env, { busy });
      }

      /* ---- public: gespaart Termin-Hallefdeeg (nëmmen Datum + Slot, keng perséinlech Donnéeën) ---- */
      if (path === "/appointment-availability" && (method === "GET" || method === "HEAD")) {
        const sinceDay = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const rows = (await env.DB.prepare("SELECT date, slot FROM appointment_blocks WHERE date >= ?1 ORDER BY date ASC LIMIT 1000").bind(sinceDay).all()).results || [];
        return json(env, { blocks: rows.map((r) => ({ date: r.date, slot: r.slot })) }, 200, { "Cache-Control": "public, max-age=120" });
      }

      /* ---- public: aktiv Gefierer aus der interner Flotte ---- */
      if (path === "/fleet/public" && (method === "GET" || method === "HEAD")) {
        const rows = (await env.DB.prepare("SELECT id,vehicle,description,image_url,price_day,deposit,included_km,extra_km_rate,late_fee_hour,year,seats,fuel,transmission,license_class,load_space,features,asset_type,gross_weight,payload,braked FROM maintenance WHERE public_active=1 AND fleet_status!='blocked' ORDER BY id ASC").all()).results || [];
        return json(env, { vehicles: rows.map((x) => ({ id:"fleet-"+x.id,type:["van","car","trailer"].includes(x.asset_type)?x.asset_type:"van",name:x.vehicle,description:x.description||"",image:x.image_url||"",priceDay:Number(x.price_day||0),deposit:Number(x.deposit||0),includedKm:Number(x.included_km||0),extraKmRate:Number(x.extra_km_rate||0),lateFeeHour:Number(x.late_fee_hour||0),year:x.year||"",seats:x.seats||"",fuel:x.fuel||"",transmission:x.transmission||"",licenseClass:x.license_class||"",loadSpace:x.load_space||"",grossWeight:x.gross_weight||"",payload:x.payload||"",braked:!!x.braked,features:String(x.features||"").split("\n").map((v)=>v.trim()).filter(Boolean) })) }, 200, { "Cache-Control": "public, max-age=120" });
      }

      /* ---- Fotoen aus dem private R2-Bucket ausliwweren ----
         fleet/ = ëffentlech (Katalog-Biller). protocol/ = nëmme fir ageloggte
         Personal (Schuedensfotoen a Client-Ënnerschrëften: perséinlech Donnéeën,
         ni ëffentlech cachen). */
      if (path.startsWith("/media/") && method === "GET") {
        if (!env.MEDIA) return json(env, { error:"server_not_configured" }, 503);
        const key = decodeURIComponent(path.slice(7));
        if (!/^(?:fleet|protocol)\/[a-z0-9/_-]+\.(?:webp|jpg|png)$/i.test(key)) return json(env, { error:"not_found" }, 404);
        const isProtocol = key.slice(0, 9) === "protocol/";
        if (isProtocol) {
          const who = await authUser(request, env);
          if (!who || !hasPerm(who.role, "bookings.view")) return json(env, { error: "unauthorized" }, 401);
        }
        const object = await env.MEDIA.get(key);
        if (!object) return json(env, { error:"not_found" }, 404);
        const cacheControl = isProtocol ? "private, no-store" : "public, max-age=31536000, immutable";
        const headers = new Headers(cors(env, { "X-Content-Type-Options":"nosniff" }));
        object.writeHttpMetadata(headers);
        headers.set("ETag", object.httpEtag);
        // No writeHttpMetadata: d'gespäichert Cache-Control (immutable) iwwerschreiwen,
        // fir datt Protokoll-Biller ni ëffentlech gecacht ginn.
        headers.set("Cache-Control", cacheControl);
        return new Response(object.body, { headers });
      }

      /* ---- public: neie Rendez-vous (vun der Kontakt-Formulaire) ---- */
      if (path === "/appointments" && method === "POST") {
        if (!isAllowedOrigin(request, env)) return json(env, { error: "forbidden_origin" }, 403);
        if (!(request.headers.get("content-type") || "").includes("application/json")) return json(env, { error: "unsupported_media_type" }, 415);
        if (bodyData.website) return json(env, { ok: true }, 202);
        if (!(await publicEdgeAllowed(request, env))) return json(env, { error: "rate_limited" }, 429);
        const name = clip(bodyData.name, 120).trim();
        const email = clip(bodyData.email, 160).trim().toLowerCase();
        const loadedAt = Number(bodyData.loadedAt || 0), nowMs = Date.now();
        if (!name || !email || !bodyData.privacy) return json(env, { error: "missing_fields" }, 400);
        if (!validEmail(email)) return json(env, { error: "invalid_fields" }, 400);
        if (!loadedAt || nowMs - loadedAt < 2500 || nowMs - loadedAt > 86400000) return json(env, { error: "invalid_submission" }, 400);
        const kind = bodyData.kind === "inquiry" ? "inquiry" : "appointment";
        const service = clip(bodyData.service,120).trim(), vehicle = clip(bodyData.vehicle,120).trim(), message = clip(bodyData.msg,2000).trim();
        const preferredDate = clip(bodyData.prefDate,20).trim(), alternativeDate = clip(bodyData.altDate,20).trim();
        if (!service || !vehicle || !message || (kind === "inquiry" && !clip(bodyData.phone,60).trim()) || (kind === "appointment" && !preferredDate)) return json(env, { error:"missing_fields" }, 400);
        if (kind === "appointment" && (!validDateOnly(preferredDate) || (alternativeDate && !validDateOnly(alternativeDate)) || preferredDate < new Date().toISOString().slice(0,10) || (alternativeDate && alternativeDate < new Date().toISOString().slice(0,10)))) return json(env, { error:"invalid_fields" }, 400);
        if (kind === "appointment") {
          // Check before the persistent rate counter or any appointment writes.
          const legacySlots = { moies:"am", vormittags:"am", matin:"am", morning:"am", "nomëtteg":"pm", nachmittags:"pm", "après-midi":"pm", afternoon:"pm" };
          const slot = bodyData.timeSlot || legacySlots[clip(bodyData.daytime,40).trim().toLowerCase()] || "";
          if (!["", "am", "pm"].includes(slot)) return json(env, { error:"invalid_fields" }, 400);
          const days = [preferredDate, alternativeDate].filter(Boolean);
          if (days.some(day => new Date(day + "T00:00:00Z").getUTCDay() === 0)) return json(env, { error:"appointment_unavailable" }, 409);
          const result = await env.DB.prepare("SELECT date, slot FROM appointment_blocks WHERE date IN (?1, ?2)").bind(preferredDate, alternativeDate || preferredDate).all();
          const blocks = result.results || [];
          if (days.some(day => {
            const blocked = part => blocks.some(block => block.date === day && block.slot === part);
            return blocked("closed") || (slot ? blocked(slot) : blocked("am") && blocked("pm"));
          })) return json(env, { error:"appointment_unavailable" }, 409);
        }
        if (!(await publicRateAllowed(request, env))) return json(env, { error: "rate_limited" }, 429);
        const r = await env.DB.prepare(
          "INSERT INTO appointments (name, email, phone, service, vehicle, pref_date, alt_date, daytime, vin, msg, lang, kind, status) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,'new')"
        ).bind(name, email, clip(bodyData.phone, 60), service, vehicle, preferredDate, alternativeDate, clip(bodyData.daytime, 40), clip(bodyData.vin, 40), message, ["lb", "de", "fr", "en"].includes(bodyData.lang) ? bodyData.lang : "lb", kind).run();
        const id = r.meta.last_row_id;
        await saveConsent(env, kind, id, bodyData.privacy, false);
        await env.DB.prepare("INSERT INTO appointment_events (appointment_id, action, by_user, note) VALUES (?1,'Ufro erakomm','System','')").bind(id).run();
        const apptLang = ["lb", "de", "fr", "en"].includes(bodyData.lang) ? bodyData.lang : "lb";
        ctx.waitUntil(Promise.all([
          sendNewApptNotice(env, id, { name: name, email: email, service: service, vehicle: vehicle, pref_date: preferredDate, kind: kind }),
          sendApptReceipt(env, id, { name: name, email: email, service: service, vehicle: vehicle, pref_date: preferredDate, daytime: clip(bodyData.daytime, 40).trim(), lang: apptLang, kind: kind })
        ]));
        return json(env, { ok: true, id });
      }

      /* ---- login (mat Brute-Force-Schutz: max 10 falsch Versich/Stonn/IP) ---- */
      if (path === "/auth/login" && method === "POST") {
        if (!isAllowedOrigin(request, env)) return json(env, { error: "forbidden_origin" }, 403);
        if (!(await publicEdgeAllowed(request, env))) return json(env, { error: "rate_limited" }, 429);
        const username = clip(bodyData.username, 60).trim().toLowerCase();
        const password = String(bodyData.password || "");
        const lbk = await loginBucket(request);
        const failedAttempts = await loginFails(env, lbk);
        const row = await env.DB.prepare("SELECT * FROM users WHERE username = ?1").bind(username).first();
        const ok = row && row.active && (await verifyPw(row.pw, password));
        // Eng IP-Sperr dierf e legitimme Benotzer mat korrektem Passwuert net aussperren.
        // Falsch Versich bleiwen no 10 Feeler gedrosselt; e korrekte Login läscht de Bucket.
        if (!ok) {
          if (failedAttempts >= 10) return json(env, { error: "rate_limited" }, 429);
          await loginBump(env, lbk);
          return json(env, { error: "invalid_credentials" }, 401);
        }
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
      if (method !== "GET" && !isAllowedOrigin(request, env)) return json(env, { error: "forbidden_origin" }, 403);
      if (path === "/auth/me") {
        if (!me) return json(env, { error: "unauthorized" }, 401, { "Set-Cookie": clearSessionCookie() });
        return json(env, { user: { username: me.username, name: me.name, role: me.role, mustChange: !!me.must_change } });
      }
      if (path === "/auth/logout" && method === "POST") {
        if (me && me.sessionHash) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(me.sessionHash).run();
        return json(env, { ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
      }
      if (!me) return json(env, { error: "unauthorized" }, 401);

      /* ---- Foto eroplueden (validator+) ---- */
      if ((path === "/media/fleet" || path === "/media/protocol") && method === "POST") {
        if (!hasPerm(me.role, "bookings.validate")) return json(env, { error:"forbidden" }, 403);
        if (!isAllowedOrigin(request, env)) return json(env, { error:"forbidden_origin" }, 403);
        if (!env.MEDIA) return json(env, { error:"server_not_configured" }, 503);
        const declared = Number(request.headers.get("content-length") || 0);
        if (declared > 3 * 1024 * 1024) return json(env, { error:"file_too_large" }, 413);
        const data = new Uint8Array(await request.arrayBuffer());
        if (!data.length || data.length > 3 * 1024 * 1024) return json(env, { error:"file_too_large" }, 413);
        const image = imageType(data);
        if (!image) return json(env, { error:"invalid_image" }, 415);
        const now = new Date(), scope=path === "/media/protocol" ? "protocol" : "fleet", key = scope + "/" + now.getUTCFullYear() + "/" + String(now.getUTCMonth()+1).padStart(2,"0") + "/" + crypto.randomUUID() + "." + image.ext;
        await env.MEDIA.put(key, data, { httpMetadata:{ contentType:image.type, cacheControl:"public, max-age=31536000, immutable" }, customMetadata:{ uploadedBy:me.username } });
        return json(env, { ok:true, url:url.origin + "/media/" + key });
      }

      /* ---- change own password ---- */
      if (path === "/auth/password" && method === "POST") {
        const cur = String(bodyData.current || ""), next = String(bodyData.next || "");
        if (next.length < 8) return json(env, { error: "weak_password" }, 400);
        const row = await env.DB.prepare("SELECT pw FROM users WHERE username = ?1").bind(me.username).first();
        if (!row || !(await verifyPw(row.pw, cur))) return json(env, { error: "wrong_current" }, 400);
        await env.DB.prepare("UPDATE users SET pw = ?1, must_change = 0 WHERE username = ?2").bind(await hashPw(next), me.username).run();
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
        return json(env, { bookings: bs.map((b) => ({ id: b.id, veh: b.veh, from: b.from_dt, to: b.to_dt, name: b.cust_name, email: b.cust_email, phone: b.cust_phone, msg: b.msg, lang:b.lang||"lb", status: b.status, contractSnapshot:b.contract_snapshot||"", snapshotAt:b.snapshot_at||"", events: byId[b.id] || [] })) });
      }

      /* ---- booking status change ---- */
      let m = path.match(/^\/bookings\/(\d+)\/status$/);
      if (m && method === "POST") {
        if (!hasPerm(me.role, "bookings.validate")) return json(env, { error: "forbidden" }, 403);
        const id = parseInt(m[1], 10);
        const status = clip(bodyData.status, 20);
        const labels = { confirmed: "Bestätegt", declined: "Ofgeleent", done: "Ofgeschloss", new: "Zrécksetzen" };
        if (!labels[status]) return json(env, { error: "bad_status" }, 400);
        const ex = await env.DB.prepare("SELECT id,status FROM bookings WHERE id = ?1").bind(id).first();
        if (!ex) return json(env, { error: "not_found" }, 404);
        if (ex.status === status) {
          const note = clip(bodyData.note, 500).trim();
          if (note) await env.DB.prepare("INSERT INTO booking_events (booking_id,action,by_user,note) VALUES (?1,'Notiz',?2,?3)").bind(id,me.username,note).run();
          return json(env, { ok:true, unchanged:!note });
        }
        if (ex.status === "done" && status !== "done") return json(env, { error: "bad_status" }, 409);
        if (status === "confirmed") {
          const candidate = await env.DB.prepare("SELECT veh, from_dt, to_dt FROM bookings WHERE id = ?1").bind(id).first();
          const conflict = candidate && await findConflict(env, candidate.veh, candidate.from_dt, candidate.to_dt, id);
          if (conflict) return json(env, { error: "booking_conflict" }, 409);
          await freezeBookingSnapshot(env, id, false);
        }
        const changed = await env.DB.prepare("UPDATE bookings SET status=?1 WHERE id=?2 AND status=?3").bind(status,id,ex.status).run();
        if (!changed.meta.changes) return json(env, { error:"stale_status" }, 409);
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
        if (cur.status === "done" || cur.status === "declined") return json(env, { error: "bad_status" }, 409);
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
        if (cur.status === "confirmed") await freezeBookingSnapshot(env, id, true);
        return json(env, { ok: true });
      }

      /* ---- booking läschen (admin) ---- */
      m = path.match(/^\/bookings\/(\d+)$/);
      if (m && method === "DELETE") {
        if (me.role !== "admin") return json(env, { error: "forbidden" }, 403);
        const id = parseInt(m[1], 10);
        const inspections = (await env.DB.prepare("SELECT * FROM rental_inspections WHERE booking_id=?1").bind(id).all()).results || [];
        const mediaKeys = inspections.flatMap(protocolMediaKeys);
        await env.DB.batch([
          env.DB.prepare("DELETE FROM request_consents WHERE request_type='booking' AND request_id=?1").bind(id),
          env.DB.prepare("DELETE FROM rental_inspections WHERE booking_id=?1").bind(id),
          env.DB.prepare("DELETE FROM booking_events WHERE booking_id=?1").bind(id),
          env.DB.prepare("DELETE FROM bookings WHERE id=?1").bind(id),
        ]);
        await deleteProtocolMedia(env, mediaKeys);
        return json(env, { ok: true });
      }

      /* ---- Rendez-vous lëschten (viewer+) ---- */
      /* ---- Rendez-vous manuell androen (Telefon-Buchung, validator+) ---- */
      if (path === "/appointments/manual" && method === "POST") {
        if (!hasPerm(me.role, "bookings.validate")) return json(env, { error: "forbidden" }, 403);
        const name = clip(bodyData.name, 120).trim(), email = clip(bodyData.email, 160).trim().toLowerCase();
        const date = clip(bodyData.date, 20).trim(), time = clip(bodyData.time, 10).trim();
        const service = clip(bodyData.service, 120).trim(), vehicle = clip(bodyData.vehicle, 120).trim();
        if (!name || !service || !validDateOnly(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return json(env, { error: "missing_fields" }, 400);
        if (email && !validEmail(email)) return json(env, { error: "invalid_fields" }, 400);
        let assigned = clip(bodyData.assigned, 60).trim().toLowerCase();
        if (assigned) { const u = await env.DB.prepare("SELECT username FROM users WHERE username=?1 AND active=1").bind(assigned).first(); if (!u) return json(env, { error: "invalid_staff" }, 400); }
        let duration = null;
        if (bodyData.duration !== "" && bodyData.duration != null) { duration = parseInt(bodyData.duration, 10); if (!Number.isInteger(duration) || duration < 0 || duration > 1440) return json(env, { error: "invalid_duration" }, 400); if (duration === 0) duration = null; }
        const phone = clip(bodyData.phone, 60), vin = clip(bodyData.vin, 40), msg = clip(bodyData.msg, 2000);
        const lang = ["lb", "de", "fr", "en"].includes(bodyData.lang) ? bodyData.lang : "lb";
        const r = await env.DB.prepare("INSERT INTO appointments (name,email,phone,service,vehicle,pref_date,daytime,vin,msg,lang,kind,status,confirmed_date,confirmed_time,assigned_to,duration_min) VALUES (?1,?2,?3,?4,?5,?6,'',?7,?8,?9,'appointment','confirmed',?6,?10,?11,?12)")
          .bind(name, email || null, phone, service, vehicle, date, vin, msg, lang, time, assigned || null, duration).run();
        const id = r.meta.last_row_id;
        await env.DB.prepare("INSERT INTO appointment_events (appointment_id, action, by_user, note) VALUES (?1,'Manuell ugeluecht',?2,?3)").bind(id, me.username, clip(service || "Rendez-vous", 500)).run();
        const appt = { id, name, email, phone, service, vehicle, vin, msg, lang, pref_date: date, confirmed_date: date, confirmed_time: time, assigned_to: assigned || null, duration_min: duration, kind: "appointment" };
        ctx.waitUntil(ensureCrmLink(env, appt, me.username));
        const mailQueued = !!(email && validEmail(email));
        if (mailQueued) ctx.waitUntil(sendApptConfirmation(env, id, appt, me.username));
        return json(env, { ok: true, id, mailQueued });
      }

      if (path === "/appointments" && method === "GET") {
        if (!hasPerm(me.role, "bookings.view")) return json(env, { error: "forbidden" }, 403);
        const as = (await env.DB.prepare("SELECT * FROM appointments ORDER BY id DESC LIMIT 1000").all()).results || [];
        const evs = (await env.DB.prepare("SELECT appointment_id, action, by_user, note, at FROM appointment_events ORDER BY id ASC").all()).results || [];
        const staff = (await env.DB.prepare("SELECT username, name FROM users").all()).results || [];
        const staffName = {}; staff.forEach((u) => { staffName[u.username] = u.name || u.username; });
        const byId = {};
        evs.forEach((e) => { (byId[e.appointment_id] = byId[e.appointment_id] || []).push({ action: e.action, by: e.by_user, at: e.at, note: e.note || "" }); });
        return json(env, { appointments: as.map((a) => ({ id: a.id, name: a.name, email: a.email, phone: a.phone, service: a.service, vehicle: a.vehicle, prefDate: a.pref_date, altDate: a.alt_date, daytime: a.daytime, confirmedDate: a.confirmed_date || "", confirmedTime: a.confirmed_time || "", assignedTo: a.assigned_to || "", assignedName: a.assigned_to ? (staffName[a.assigned_to] || a.assigned_to) : "", durationMin: a.duration_min == null ? "" : a.duration_min, planNote: a.plan_note || "", vin: a.vin, msg: a.msg, kind: a.kind || "appointment", status: a.status, created: a.created_at, events: byId[a.id] || [] })) });
      }

      /* ---- Clientedatebank (additiv; Originalufroe bleiwen onverännert) ---- */
      if (path === "/customers" && method === "GET") {
        if (!hasPerm(me.role, "bookings.view")) return json(env, { error:"forbidden" }, 403);
        const cs = (await env.DB.prepare("SELECT * FROM customers c WHERE COALESCE(c.archived,0)=0 AND (trim(COALESCE(c.email,''))='' OR c.id=(SELECT MIN(c2.id) FROM customers c2 WHERE COALESCE(c2.archived,0)=0 AND lower(trim(c2.email))=lower(trim(c.email)))) ORDER BY updated_at DESC,id DESC").all()).results || [];
        const vs = (await env.DB.prepare("SELECT v.*,COALESCE((SELECT MIN(c2.id) FROM customers c2 WHERE lower(trim(c2.email))=lower(trim(c.email))),v.customer_id) canonical_customer_id FROM customer_vehicles v LEFT JOIN customers c ON c.id=v.customer_id ORDER BY v.id DESC").all()).results || [];
        const history = (await env.DB.prepare("SELECT c.id customer_id, COUNT(DISTINCT a.id) appointments, COUNT(DISTINCT b.id) rentals FROM customers c LEFT JOIN appointments a ON lower(trim(a.email))=lower(trim(c.email)) AND trim(COALESCE(c.email,''))<>'' LEFT JOIN bookings b ON lower(trim(b.cust_email))=lower(trim(c.email)) AND trim(COALESCE(c.email,''))<>'' GROUP BY c.id").all()).results || [];
        const vBy = {}, vSeen={}, hBy = {}; vs.forEach(v => { const key=v.canonical_customer_id||v.customer_id, list=(vBy[key] ||= []), sig=[v.make_model,v.plate||"",v.vin||""].join("|").toLowerCase(); vSeen[key] ||= new Set(); if(!vSeen[key].has(sig)){vSeen[key].add(sig);list.push({ id:v.id, makeModel:v.make_model, plate:v.plate||"", vin:v.vin||"", year:v.year||"", mileage:v.mileage==null?"":v.mileage, notes:v.notes||"" });} }); history.forEach(h => { hBy[h.customer_id]=h; });
        return json(env, { customers:cs.map(c => ({ id:c.id,name:c.name,email:c.email||"",phone:c.phone||"",notes:c.notes||"",source:c.source||"manual",createdAt:c.created_at,updatedAt:c.updated_at,vehicles:vBy[c.id]||[],appointments:Number(hBy[c.id]?.appointments||0),rentals:Number(hBy[c.id]?.rentals||0) })) });
      }
      if (path === "/customers" && method === "POST") {
        if (!hasPerm(me.role, "bookings.validate")) return json(env, { error:"forbidden" }, 403);
        const name=clip(bodyData.name,120).trim(), email=clip(bodyData.email,160).trim().toLowerCase(), phone=clip(bodyData.phone,60).trim();
        if (!name || (email && !validEmail(email))) return json(env,{error:"invalid_fields"},400);
        if (email) { const duplicate=await env.DB.prepare("SELECT id FROM customers WHERE COALESCE(archived,0)=0 AND lower(trim(email))=?1").bind(email).first(); if (duplicate) return json(env,{error:"exists",id:duplicate.id},409); }
        const r=await env.DB.prepare("INSERT INTO customers (name,email,phone,notes,source) VALUES (?1,?2,?3,?4,'manual')").bind(name,email||null,phone||null,clip(bodyData.notes,2000)).run();
        return json(env,{ok:true,id:r.meta.last_row_id});
      }
      m = path.match(/^\/customers\/(\d+)$/);
      if (m && method === "POST") {
        if (!hasPerm(me.role, "bookings.validate")) return json(env,{error:"forbidden"},403);
        const id=parseInt(m[1],10), name=clip(bodyData.name,120).trim(), email=clip(bodyData.email,160).trim().toLowerCase(), phone=clip(bodyData.phone,60).trim();
        if (!name || (email && !validEmail(email))) return json(env,{error:"invalid_fields"},400);
        const ex=await env.DB.prepare("SELECT id FROM customers WHERE id=?1 AND COALESCE(archived,0)=0").bind(id).first(); if(!ex)return json(env,{error:"not_found"},404);
        if(email){const duplicate=await env.DB.prepare("SELECT id FROM customers WHERE COALESCE(archived,0)=0 AND lower(trim(email))=?1 AND id<>?2").bind(email,id).first();if(duplicate)return json(env,{error:"exists"},409);}
        await env.DB.prepare("UPDATE customers SET name=?1,email=?2,phone=?3,notes=?4,updated_at=CURRENT_TIMESTAMP WHERE id=?5").bind(name,email||null,phone||null,clip(bodyData.notes,2000),id).run();
        return json(env,{ok:true});
      }
      if (m && method === "DELETE") {
        if (!hasPerm(me.role, "bookings.validate")) return json(env,{error:"forbidden"},403);
        const id=parseInt(m[1],10), ex=await env.DB.prepare("SELECT id FROM customers WHERE id=?1 AND COALESCE(archived,0)=0").bind(id).first();
        if(!ex)return json(env,{error:"not_found"},404);
        await env.DB.prepare("UPDATE customers SET archived=1,updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(id).run();
        return json(env,{ok:true});
      }
      m = path.match(/^\/customers\/(\d+)\/vehicles$/);
      if (m && method === "POST") {
        if (!hasPerm(me.role, "bookings.validate")) return json(env,{error:"forbidden"},403);
        const customerId=parseInt(m[1],10), makeModel=clip(bodyData.makeModel,160).trim(); if(!makeModel)return json(env,{error:"missing_fields"},400);
        const ex=await env.DB.prepare("SELECT id FROM customers WHERE id=?1 AND COALESCE(archived,0)=0").bind(customerId).first(); if(!ex)return json(env,{error:"not_found"},404);
        const mileage=bodyData.mileage===""||bodyData.mileage==null?null:parseInt(bodyData.mileage,10); if(mileage!==null&&(!Number.isInteger(mileage)||mileage<0))return json(env,{error:"invalid_fields"},400);
        const vin=clip(bodyData.vin,60);
        // Keng Duebel-Gefierer: selwecht Modell + VIN beim selwechte Client.
        const dupe=await env.DB.prepare("SELECT id FROM customer_vehicles WHERE customer_id=?1 AND lower(trim(make_model))=lower(trim(?2)) AND lower(trim(COALESCE(vin,'')))=lower(trim(COALESCE(?3,'')))").bind(customerId,makeModel,vin||"").first();
        if(dupe)return json(env,{error:"exists",id:dupe.id},409);
        const r=await env.DB.prepare("INSERT INTO customer_vehicles (customer_id,make_model,plate,vin,year,mileage,notes) VALUES (?1,?2,?3,?4,?5,?6,?7)").bind(customerId,makeModel,clip(bodyData.plate,30),vin,clip(bodyData.year,20),mileage,clip(bodyData.notes,1000)).run();
        return json(env,{ok:true,id:r.meta.last_row_id});
      }
      /* ---- Gefier läschen (admin): Opträg entkoppelen ---- */
      m = path.match(/^\/customers\/(\d+)\/vehicles\/(\d+)$/);
      if (m && method === "DELETE") {
        if (me.role !== "admin") return json(env,{error:"forbidden"},403);
        const customerId=parseInt(m[1],10), vehicleId=parseInt(m[2],10);
        const ex=await env.DB.prepare("SELECT id FROM customer_vehicles WHERE id=?1 AND customer_id=?2").bind(vehicleId,customerId).first();
        if(!ex)return json(env,{error:"not_found"},404);
        await env.DB.batch([
          env.DB.prepare("UPDATE work_orders SET vehicle_id=NULL WHERE vehicle_id=?1").bind(vehicleId),
          env.DB.prepare("DELETE FROM customer_vehicles WHERE id=?1").bind(vehicleId),
        ]);
        return json(env,{ok:true});
      }

      /* ---- Aarbechtsopträg: Werkstatt-Workflow ouni Rendez-vous ze veränneren ---- */
      if (path === "/work-orders" && method === "GET") {
        if (!hasPerm(me.role,"bookings.view")) return json(env,{error:"forbidden"},403);
        const rows=(await env.DB.prepare("SELECT w.*,c.name customer_name,c.email customer_email,c.phone customer_phone,v.make_model vehicle_name,v.plate vehicle_plate,u.name staff_name FROM work_orders w LEFT JOIN customers c ON c.id=w.customer_id LEFT JOIN customer_vehicles v ON v.id=w.vehicle_id LEFT JOIN users u ON u.username=w.assigned_to ORDER BY w.updated_at DESC,w.id DESC").all()).results||[];
        const evs=(await env.DB.prepare("SELECT * FROM work_order_events ORDER BY id ASC").all()).results||[], by={}; evs.forEach(e=>{(by[e.work_order_id]||=[]).push({action:e.action,by:e.by_user||"",note:e.note||"",at:e.at});});
        return json(env,{orders:rows.map(w=>({id:w.id,appointmentId:w.appointment_id||null,customerId:w.customer_id||null,vehicleId:w.vehicle_id||null,reference:w.reference||("AB-A-"+new Date().getFullYear()+"-"+String(w.id).padStart(4,"0")),title:w.title,status:w.status,assignedTo:w.assigned_to||"",assignedName:w.staff_name||w.assigned_to||"",plannedMinutes:w.planned_minutes==null?"":w.planned_minutes,description:w.description||"",diagnosis:w.diagnosis||"",internalNote:w.internal_note||"",customerName:w.customer_name||"",customerEmail:w.customer_email||"",customerPhone:w.customer_phone||"",vehicleName:w.vehicle_name||"",vehiclePlate:w.vehicle_plate||"",createdAt:w.created_at,updatedAt:w.updated_at,events:by[w.id]||[]}))});
      }
      if (path === "/work-orders" && method === "POST") {
        if (!hasPerm(me.role,"bookings.validate")) return json(env,{error:"forbidden"},403);
        const title=clip(bodyData.title,180).trim(); if(!title)return json(env,{error:"missing_fields"},400);
        const allowed=["planned","arrived","diagnosis","approval","working","ready","collected"], status=allowed.includes(bodyData.status)?bodyData.status:"planned";
        const customerId=Number(bodyData.customerId)||null, vehicleId=Number(bodyData.vehicleId)||null, appointmentId=Number(bodyData.appointmentId)||null, planned=bodyData.plannedMinutes===""||bodyData.plannedMinutes==null?null:parseInt(bodyData.plannedMinutes,10);
        if(planned!==null&&(!Number.isInteger(planned)||planned<0||planned>10080))return json(env,{error:"invalid_fields"},400);
        try { const r=await env.DB.prepare("INSERT INTO work_orders (appointment_id,customer_id,vehicle_id,title,status,assigned_to,planned_minutes,description,diagnosis,internal_note) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)").bind(appointmentId,customerId,vehicleId,title,status,clip(bodyData.assignedTo,60)||null,planned,clip(bodyData.description,3000),clip(bodyData.diagnosis,3000),clip(bodyData.internalNote,3000)).run(); const id=r.meta.last_row_id, ref="AB-A-"+new Date().getFullYear()+"-"+String(id).padStart(4,"0"); await env.DB.batch([env.DB.prepare("UPDATE work_orders SET reference=?1 WHERE id=?2").bind(ref,id),env.DB.prepare("INSERT INTO work_order_events (work_order_id,action,by_user,note) VALUES (?1,'Ugeluecht',?2,?3)").bind(id,me.username,status)]); return json(env,{ok:true,id,reference:ref}); } catch(e) { return json(env,{error:String(e).includes("UNIQUE")?"exists":"server_error"},409); }
      }
      m = path.match(/^\/work-orders\/(\d+)$/);
      if (m && method === "POST") {
        if (!hasPerm(me.role,"bookings.validate")) return json(env,{error:"forbidden"},403);
        const id=parseInt(m[1],10), ex=await env.DB.prepare("SELECT * FROM work_orders WHERE id=?1").bind(id).first(); if(!ex)return json(env,{error:"not_found"},404);
        const allowed=["planned","arrived","diagnosis","approval","working","ready","collected"], status=allowed.includes(bodyData.status)?bodyData.status:ex.status, title=clip(bodyData.title||ex.title,180).trim();
        const planned=bodyData.plannedMinutes===""||bodyData.plannedMinutes==null?null:parseInt(bodyData.plannedMinutes,10); if(planned!==null&&(!Number.isInteger(planned)||planned<0||planned>10080))return json(env,{error:"invalid_fields"},400);
        const action=status!==ex.status?"Status: "+status:"Geännert";
        await env.DB.batch([env.DB.prepare("UPDATE work_orders SET customer_id=?1,vehicle_id=?2,title=?3,status=?4,assigned_to=?5,planned_minutes=?6,description=?7,diagnosis=?8,internal_note=?9,updated_at=CURRENT_TIMESTAMP WHERE id=?10").bind(Number(bodyData.customerId)||null,Number(bodyData.vehicleId)||null,title,status,clip(bodyData.assignedTo,60)||null,planned,clip(bodyData.description,3000),clip(bodyData.diagnosis,3000),clip(bodyData.internalNote,3000),id),env.DB.prepare("INSERT INTO work_order_events (work_order_id,action,by_user,note) VALUES (?1,?2,?3,?4)").bind(id,action,me.username,clip(bodyData.eventNote,500))]);
        return json(env,{ok:true});
      }
      /* ---- Aarbechtsoptrag läschen (admin) ---- */
      m = path.match(/^\/work-orders\/(\d+)$/);
      if (m && method === "DELETE") {
        if (me.role !== "admin") return json(env,{error:"forbidden"},403);
        const id=parseInt(m[1],10);
        const ex=await env.DB.prepare("SELECT id FROM work_orders WHERE id=?1").bind(id).first();
        if(!ex)return json(env,{error:"not_found"},404);
        await env.DB.batch([
          env.DB.prepare("DELETE FROM work_order_events WHERE work_order_id=?1").bind(id),
          env.DB.prepare("DELETE FROM work_orders WHERE id=?1").bind(id),
        ]);
        return json(env,{ok:true});
      }

      /* ---- Mataarbechter-Lëscht fir d'Rendez-vous-Zouweisung (viewer+) ---- */
      if (path === "/staff" && method === "GET") {
        if (!hasPerm(me.role, "bookings.view")) return json(env, { error: "forbidden" }, 403);
        const us = (await env.DB.prepare("SELECT username, name, role FROM users WHERE active = 1 ORDER BY name ASC").all()).results || [];
        return json(env, { staff: us.map((u) => ({ username: u.username, name: u.name || u.username, role: u.role })) });
      }

      /* ---- Betribsastellungen: Ëffnungszäiten + Standard-Dauer (viewer liest, admin schreift) ---- */
      if (path === "/settings" && method === "GET") {
        if (!hasPerm(me.role, "bookings.view")) return json(env, { error: "forbidden" }, 403);
        const rows = (await env.DB.prepare("SELECT key, value FROM admin_settings").all()).results || [];
        const settings = {}; rows.forEach((r) => { settings[r.key] = r.value; });
        return json(env, { settings });
      }
      if (path === "/settings" && method === "POST") {
        if (!hasPerm(me.role, "members.manage")) return json(env, { error: "forbidden" }, 403);
        const openFrom = clip(bodyData.openFrom, 5).trim(), openTo = clip(bodyData.openTo, 5).trim();
        const dur = parseInt(bodyData.defaultDuration, 10), timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
        if (!timeRe.test(openFrom) || !timeRe.test(openTo)) return json(env, { error: "invalid_time" }, 400);
        if (openFrom >= openTo) return json(env, { error: "invalid_range" }, 400);
        if (!Number.isInteger(dur) || dur < 15 || dur > 600) return json(env, { error: "invalid_duration" }, 400);
        const entries = [["open_from", openFrom], ["open_to", openTo], ["default_duration", String(dur)]];
        await env.DB.batch(entries.map(([k, v]) => env.DB.prepare("INSERT INTO admin_settings (key,value,updated_at,updated_by) VALUES (?1,?2,CURRENT_TIMESTAMP,?3) ON CONFLICT(key) DO UPDATE SET value=?2,updated_at=CURRENT_TIMESTAMP,updated_by=?3").bind(k, v, me.username)));
        return json(env, { ok: true });
      }

      /* ---- Rendez-vous plangen: Mécanicien + Dauer + Notiz (validator+, keng Mail) ---- */
      m = path.match(/^\/appointments\/(\d+)\/plan$/);
      if (m && method === "POST") {
        if (!hasPerm(me.role, "bookings.validate")) return json(env, { error: "forbidden" }, 403);
        const id = parseInt(m[1], 10);
        const appt = await env.DB.prepare("SELECT id FROM appointments WHERE id = ?1").bind(id).first();
        if (!appt) return json(env, { error: "not_found" }, 404);
        let assigned = clip(bodyData.assigned, 60).trim().toLowerCase();
        if (assigned) {
          const u = await env.DB.prepare("SELECT username FROM users WHERE username = ?1 AND active = 1").bind(assigned).first();
          if (!u) return json(env, { error: "invalid_staff" }, 400);
        }
        let duration = null;
        if (bodyData.duration !== "" && bodyData.duration != null) {
          duration = parseInt(bodyData.duration, 10);
          if (!Number.isInteger(duration) || duration < 0 || duration > 1440) return json(env, { error: "invalid_duration" }, 400);
          if (duration === 0) duration = null;
        }
        const planNote = clip(bodyData.planNote, 1000);
        await env.DB.prepare("UPDATE appointments SET assigned_to=?1, duration_min=?2, plan_note=?3 WHERE id=?4")
          .bind(assigned || null, duration, planNote || null, id).run();
        await env.DB.prepare("INSERT INTO appointment_events (appointment_id, action, by_user, note) VALUES (?1,'Plang',?2,?3)")
          .bind(id, me.username, clip([assigned ? "Mécanicien: " + assigned : "", duration ? "Dauer: " + duration + " min" : "", planNote ? "Notiz" : ""].filter(Boolean).join(" · "), 500)).run();
        // Planung ass d'Quell vun der Wourecht: Mécanicien + Dauer op de verbonnenen
        // Aarbechtsoptrag iwwerhuelen (falls ee besteet), soudatt se net auserneelafen.
        await env.DB.prepare("UPDATE work_orders SET assigned_to=?1, planned_minutes=?2, updated_at=CURRENT_TIMESTAMP WHERE appointment_id=?3")
          .bind(assigned || null, duration, id).run();
        const staffRow = assigned ? await env.DB.prepare("SELECT name FROM users WHERE username = ?1").bind(assigned).first() : null;
        return json(env, { ok: true, assignedTo: assigned || "", assignedName: staffRow ? (staffRow.name || assigned) : "", durationMin: duration == null ? "" : duration, planNote: planNote || "" });
      }

      /* ---- Bestätegung bewosst nei schécken, nëmme fir bestätegt Rendez-vous ---- */
      m = path.match(/^\/appointments\/(\d+)\/confirmation-email$/);
      if (m && method === "POST") {
        if (!hasPerm(me.role, "bookings.validate")) return json(env, { error:"forbidden" }, 403);
        const id = parseInt(m[1], 10);
        const appt = await env.DB.prepare("SELECT * FROM appointments WHERE id = ?1").bind(id).first();
        if (!appt) return json(env, { error:"not_found" }, 404);
        if ((appt.kind || "appointment") !== "appointment" || appt.status !== "confirmed") return json(env, { error:"appointment_not_confirmed" }, 409);
        if (!validEmail(appt.email || "")) return json(env, { error:"missing_email" }, 400);
        if (!validDateOnly(appt.confirmed_date || "") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(appt.confirmed_time || "")) return json(env, { error:"missing_confirmation_time" }, 400);
        // Never send an older schedule from a stale or unsaved appointment card.
        if (bodyData.date !== appt.confirmed_date || bodyData.time !== appt.confirmed_time) return json(env, { error:"stale_status" }, 409);
        if (!env.PUBLIC_REQUEST_LIMITER) return json(env, { error:"server_not_configured" }, 503);
        if (!(await env.PUBLIC_REQUEST_LIMITER.limit({ key:"appointment-mail:" + id })).success) return json(env, { error:"mail_rate_limited" }, 429);
        const result = await sendApptConfirmation(env, id, appt, me.username);
        if (!result.ok) return json(env, { error:"mail_failed" }, 502);
        return json(env, { ok:true, mailSent:true });
      }

      /* ---- Rendez-vous Status änneren (validator+) ---- */
      m = path.match(/^\/appointments\/(\d+)\/status$/);
      if (m && method === "POST") {
        if (!hasPerm(me.role, "bookings.validate")) return json(env, { error: "forbidden" }, 403);
        const id = parseInt(m[1], 10);
        const status = clip(bodyData.status, 20);
        const labels = { confirmed: "Bestätegt", declined: "Ofgeleent", done: "Ofgeschloss", new: "Zrécksetzen" };
        if (!labels[status]) return json(env, { error: "bad_status" }, 400);
        const appt = await env.DB.prepare("SELECT * FROM appointments WHERE id = ?1").bind(id).first();
        if (!appt) return json(env, { error: "not_found" }, 404);
        const isAppt = (appt.kind || "appointment") === "appointment";
        let confDate = appt.confirmed_date || appt.pref_date || "";
        let confTime = appt.confirmed_time || "";
        if (status === "confirmed" && isAppt) {
          // Admin setzt d'Auerzäit (Lëtzebuerger Zäit) + optional en ugepasst Datum.
          const d = clip(bodyData.date, 20).trim(), tm = clip(bodyData.time, 10).trim();
          if (d && !validDateOnly(d)) return json(env, { error: "invalid_date" }, 400);
          if (tm && !/^([01]\d|2[0-3]):[0-5]\d$/.test(tm)) return json(env, { error: "invalid_time" }, 400);
          if (d) confDate = d;
          if (tm) confTime = tm;
          if (!validDateOnly(confDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(confTime)) return json(env, { error:"missing_confirmation_time" }, 400);
        }
        const changesConfirmation = status === "confirmed" && isAppt;
        const sameState = appt.status === status && (!changesConfirmation || ((appt.confirmed_date || "") === confDate && (appt.confirmed_time || "") === confTime));
        const note = clip(bodyData.note,500).trim();
        if (sameState) {
          if (note) await env.DB.prepare("INSERT INTO appointment_events (appointment_id,action,by_user,note) VALUES (?1,'Notiz',?2,?3)").bind(id,me.username,note).run();
          return json(env, { ok:true, unchanged:!note, confirmedDate:confDate, confirmedTime:confTime, mailQueued:false });
        }
        const changed = changesConfirmation
          ? await env.DB.prepare("UPDATE appointments SET status=?1,confirmed_date=?2,confirmed_time=?3 WHERE id=?4 AND status=?5 AND confirmed_date IS ?6 AND confirmed_time IS ?7").bind(status,confDate,confTime,id,appt.status,appt.confirmed_date ?? null,appt.confirmed_time ?? null).run()
          : await env.DB.prepare("UPDATE appointments SET status=?1 WHERE id=?2 AND status=?3").bind(status,id,appt.status).run();
        if (!changed.meta.changes) return json(env, { error:"stale_status" }, 409);
        await env.DB.prepare("INSERT INTO appointment_events (appointment_id, action, by_user, note) VALUES (?1,?2,?3,?4)").bind(id, labels[status], me.username, clip(bodyData.note, 500)).run();
        // Bestätegungsmail un de Client (nëmme fir Rendez-vous mat enger E-Mail).
        const mailQueued = status === "confirmed" && isAppt && !!appt.email;
        if (mailQueued) {
          ctx.waitUntil(sendApptConfirmation(env, id, Object.assign({}, appt, { confirmed_date: confDate, confirmed_time: confTime })));
        }
        // Beim Bestätegen: Client + Gefier an d'CRM iwwerhuelen an en Aarbechtsoptrag uleeën.
        if (status === "confirmed" && isAppt) ctx.waitUntil(ensureCrmLink(env, appt, me.username));
        return json(env, { ok: true, confirmedDate: confDate, confirmedTime: confTime, mailQueued });
      }

      /* ---- Rendez-vous läschen (admin) ---- */
      m = path.match(/^\/appointments\/(\d+)$/);
      if (m && method === "DELETE") {
        if (me.role !== "admin") return json(env, { error: "forbidden" }, 403);
        const id = parseInt(m[1], 10);
        const appointment = await env.DB.prepare("SELECT kind FROM appointments WHERE id=?1").bind(id).first();
        if (!appointment) return json(env, { error: "not_found" }, 404);
        const requestType = appointment.kind === "inquiry" ? "inquiry" : "appointment";
        await env.DB.batch([
          env.DB.prepare("DELETE FROM request_consents WHERE request_type=?1 AND request_id=?2").bind(requestType,id),
          env.DB.prepare("DELETE FROM appointment_events WHERE appointment_id=?1").bind(id),
          env.DB.prepare("DELETE FROM appointments WHERE id=?1").bind(id),
        ]);
        return json(env, { ok: true });
      }

      /* ---- Wartung / Maintenance ---- */
      if (path === "/maintenance" && method === "GET") {
        if (!hasPerm(me.role, "bookings.view")) return json(env, { error: "forbidden" }, 403);
        const ms = (await env.DB.prepare("SELECT * FROM maintenance ORDER BY (due_date IS NULL), due_date ASC, id DESC").all()).results || [];
        return json(env, { items: ms.map((m) => ({ id:m.id, type:["van","car","trailer"].includes(m.asset_type)?m.asset_type:"van", vehicle:m.vehicle, service:m.service, dueDate:m.due_date||"", note:m.note||"", status:m.fleet_status||"ready", description:m.description||"", imageUrl:m.image_url||"", priceDay:m.price_day==null?"":m.price_day, deposit:m.deposit==null?"":m.deposit, includedKm:m.included_km==null?"":m.included_km, extraKmRate:m.extra_km_rate==null?"":m.extra_km_rate, lateFeeHour:m.late_fee_hour==null?"":m.late_fee_hour, year:m.year||"", seats:m.seats||"", fuel:m.fuel||"", transmission:m.transmission||"", licenseClass:m.license_class||"", loadSpace:m.load_space||"", grossWeight:m.gross_weight||"", payload:m.payload||"", braked:!!m.braked, plate:m.plate||"", features:m.features||"", active:!!m.public_active, updated_at:m.updated_at, updated_by:m.updated_by||"" })) });
      }
      if (path === "/maintenance" && method === "POST") {
        if (!hasPerm(me.role, "bookings.validate")) return json(env, { error: "forbidden" }, 403);
        const vehicle = clip(bodyData.vehicle, 120).trim();
        const service = clip(bodyData.service, 120).trim() || "Nach Bedarf";
        const dueDate = clip(bodyData.dueDate, 20).trim();
        if (!vehicle) return json(env, { error: "missing_fields" }, 400);
        if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return json(env, { error: "invalid_fields" }, 400);
        if (!validOptionalNumbers(bodyData,["priceDay","deposit","includedKm","extraKmRate","lateFeeHour"])) return json(env,{error:"invalid_fields"},400);
        const fleetStatus = ["ready","rented","service","blocked"].includes(bodyData.status) ? bodyData.status : "ready", assetType=["van","car","trailer"].includes(bodyData.type)?bodyData.type:"van";
        const r = await env.DB.prepare("INSERT INTO maintenance (vehicle,service,due_date,note,updated_by,fleet_status,description,image_url,price_day,year,seats,fuel,transmission,license_class,load_space,features,public_active,featured,deposit,included_km,extra_km_rate,late_fee_hour,asset_type,gross_weight,payload,braked,plate) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,0,?18,?19,?20,?21,?22,?23,?24,?25,?26)")
          .bind(vehicle,service,dueDate||null,clip(bodyData.note,300),me.username,fleetStatus,clip(bodyData.description,1200),clip(bodyData.imageUrl,500),nullableNumber(bodyData.priceDay),clip(bodyData.year,20),clip(bodyData.seats,20),clip(bodyData.fuel,60),clip(bodyData.transmission,60),clip(bodyData.licenseClass,30),clip(bodyData.loadSpace,200),clip(bodyData.features,1200),bodyData.active?1:0,nullableNumber(bodyData.deposit),nullableNumber(bodyData.includedKm),nullableNumber(bodyData.extraKmRate),nullableNumber(bodyData.lateFeeHour),assetType,clip(bodyData.grossWeight,60),clip(bodyData.payload,60),bodyData.braked?1:0,clip(bodyData.plate,20)).run();
        return json(env, { ok: true, id: r.meta.last_row_id });
      }
      m = path.match(/^\/maintenance\/(\d+)$/);
      if (m && method === "POST") {
        if (!hasPerm(me.role, "bookings.validate")) return json(env, { error: "forbidden" }, 403);
        const id = parseInt(m[1], 10);
        const ex = await env.DB.prepare("SELECT id FROM maintenance WHERE id = ?1").bind(id).first();
        if (!ex) return json(env, { error: "not_found" }, 404);
        const vehicle = clip(bodyData.vehicle, 120).trim();
        const service = clip(bodyData.service, 120).trim() || "Nach Bedarf";
        const dueDate = clip(bodyData.dueDate, 20).trim();
        if (!vehicle) return json(env, { error: "missing_fields" }, 400);
        if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return json(env, { error: "invalid_fields" }, 400);
        if (!validOptionalNumbers(bodyData,["priceDay","deposit","includedKm","extraKmRate","lateFeeHour"])) return json(env,{error:"invalid_fields"},400);
        const fleetStatus = ["ready","rented","service","blocked"].includes(bodyData.status) ? bodyData.status : "ready", assetType=["van","car","trailer"].includes(bodyData.type)?bodyData.type:"van";
        await env.DB.prepare("UPDATE maintenance SET vehicle=?1,service=?2,due_date=?3,note=?4,updated_at=CURRENT_TIMESTAMP,updated_by=?5,fleet_status=?6,description=?7,image_url=?8,price_day=?9,year=?10,seats=?11,fuel=?12,transmission=?13,license_class=?14,load_space=?15,features=?16,public_active=?17,featured=0,deposit=?18,included_km=?19,extra_km_rate=?20,late_fee_hour=?21,asset_type=?22,gross_weight=?23,payload=?24,braked=?25,plate=?26 WHERE id=?27")
          .bind(vehicle,service,dueDate||null,clip(bodyData.note,300),me.username,fleetStatus,clip(bodyData.description,1200),clip(bodyData.imageUrl,500),nullableNumber(bodyData.priceDay),clip(bodyData.year,20),clip(bodyData.seats,20),clip(bodyData.fuel,60),clip(bodyData.transmission,60),clip(bodyData.licenseClass,30),clip(bodyData.loadSpace,200),clip(bodyData.features,1200),bodyData.active?1:0,nullableNumber(bodyData.deposit),nullableNumber(bodyData.includedKm),nullableNumber(bodyData.extraKmRate),nullableNumber(bodyData.lateFeeHour),assetType,clip(bodyData.grossWeight,60),clip(bodyData.payload,60),bodyData.braked?1:0,clip(bodyData.plate,20),id).run();
        return json(env, { ok: true });
      }
      if (m && method === "DELETE") {
        if (!hasPerm(me.role, "bookings.validate")) return json(env, { error: "forbidden" }, 403);
        await env.DB.prepare("DELETE FROM maintenance WHERE id = ?1").bind(parseInt(m[1], 10)).run();
        return json(env, { ok: true });
      }

      /* ---- Flott-Sperren (Gefier fir Deeg blockéieren) ---- */
      if (path === "/fleet-blocks" && method === "GET") {
        if (!hasPerm(me.role, "bookings.view")) return json(env, { error: "forbidden" }, 403);
        const q = url.searchParams.get("vehicle");
        const rows = q
          ? (await env.DB.prepare("SELECT * FROM fleet_blocks WHERE vehicle=?1 ORDER BY from_dt ASC").bind(q).all()).results
          : (await env.DB.prepare("SELECT * FROM fleet_blocks ORDER BY from_dt ASC").all()).results;
        return json(env, { items: (rows || []).map((r) => ({ id:r.id, vehicle:r.vehicle, from:r.from_dt, to:r.to_dt, fromDate:String(r.from_dt).slice(0,10), toDate:String(r.to_dt).slice(0,10), reason:r.reason||"", createdBy:r.created_by||"", createdAt:r.created_at })) });
      }
      if (path === "/fleet-blocks" && method === "POST") {
        if (!hasPerm(me.role, "bookings.validate")) return json(env, { error: "forbidden" }, 403);
        const vehicle = clip(bodyData.vehicle, 120).trim();
        const fromDate = clip(bodyData.from, 20).trim(), toDate = clip(bodyData.to, 20).trim();
        if (!vehicle || !validDateOnly(fromDate) || !validDateOnly(toDate)) return json(env, { error: "invalid_fields" }, 400);
        if (toDate < fromDate) return json(env, { error: "invalid_range" }, 400);
        const fromDt = fromDate + "T00:00", toDt = toDate + "T23:59";
        const r = await env.DB.prepare("INSERT INTO fleet_blocks (vehicle,from_dt,to_dt,reason,created_by) VALUES (?1,?2,?3,?4,?5)")
          .bind(vehicle, fromDt, toDt, clip(bodyData.reason, 300), me.username).run();
        return json(env, { ok: true, id: r.meta.last_row_id });
      }
      m = path.match(/^\/fleet-blocks\/(\d+)$/);
      if (m && method === "DELETE") {
        if (!hasPerm(me.role, "bookings.validate")) return json(env, { error: "forbidden" }, 403);
        await env.DB.prepare("DELETE FROM fleet_blocks WHERE id = ?1").bind(parseInt(m[1], 10)).run();
        return json(env, { ok: true });
      }

      /* ---- Termin-Sperren (Hallefdeeg blockéieren: moies / nomëttes) ---- */
      if (path === "/appointment-blocks" && method === "GET") {
        if (!hasPerm(me.role, "bookings.view")) return json(env, { error: "forbidden" }, 403);
        const since = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const rows = (await env.DB.prepare("SELECT date, slot, note FROM appointment_blocks WHERE date >= ?1 ORDER BY date ASC").bind(since).all()).results || [];
        return json(env, { blocks: rows.map((r) => ({ date: r.date, slot: r.slot, note: r.note || "" })) });
      }
      if (path === "/appointment-blocks" && method === "POST") {
        if (!hasPerm(me.role, "bookings.validate")) return json(env, { error: "forbidden" }, 403);
        const date = clip(bodyData.date, 20).trim();
        const slot = ["am", "pm", "closed"].includes(bodyData.slot) ? bodyData.slot : "";
        if (!validDateOnly(date) || !slot) return json(env, { error: "invalid_fields" }, 400);
        if (bodyData.blocked) {
          await env.DB.prepare("INSERT OR REPLACE INTO appointment_blocks (date, slot, note, created_by) VALUES (?1,?2,?3,?4)").bind(date, slot, clip(bodyData.note, 200), me.username).run();
        } else {
          await env.DB.prepare("DELETE FROM appointment_blocks WHERE date=?1 AND slot=?2").bind(date, slot).run();
        }
        return json(env, { ok: true, date: date, slot: slot, blocked: !!bodyData.blocked });
      }

      /* ---- Digital Iwwergab- / Retourprotokoller ---- */
      if (path === "/rental-inspections" && method === "GET") {
        if (!hasPerm(me.role, "bookings.view")) return json(env, { error: "forbidden" }, 403);
        const rows = (await env.DB.prepare("SELECT i.*, b.veh, b.cust_name, b.from_dt, b.to_dt FROM rental_inspections i LEFT JOIN bookings b ON b.id=i.booking_id ORDER BY i.inspected_at DESC, i.id DESC").all()).results || [];
        return json(env, { items: rows.map((x) => { const staffMedia=protocolMediaUrl(x.staff_signature); return { id:x.id, bookingId:x.booking_id, stage:x.stage, inspectedAt:x.inspected_at, odometer:x.odometer, fuelLevel:x.fuel_level || "", conditionNote:x.condition_note || "", damageNote:x.damage_note || "", photoRefs:x.photo_refs || "", accessories:x.accessories || "", licenseChecked:!!x.license_checked, extraKm:x.extra_km, extraCosts:x.extra_costs, customerSignature:x.customer_signature || "", staffSignature:staffMedia, staffName:x.staff_name || (!staffMedia ? x.staff_signature || "" : "") || x.updated_by || "", note:x.note || "", checklistJson:x.checklist_json || "{}", updatedAt:x.updated_at, updatedBy:x.updated_by || "", vehicle:x.veh || "", customer:x.cust_name || "", from:x.from_dt || "", to:x.to_dt || "" }; }) });
      }
      if (path === "/rental-inspections" && method === "POST") {
        if (!hasPerm(me.role, "bookings.validate")) return json(env, { error: "forbidden" }, 403);
        const bookingId = parseInt(bodyData.bookingId, 10), stage = clip(bodyData.stage, 10), inspectedAt = clip(bodyData.inspectedAt, 20);
        const odometer = bodyData.odometer === "" ? null : parseInt(bodyData.odometer, 10);
        if (!bookingId || ["pickup","return"].indexOf(stage) < 0 || !validDateTime(inspectedAt)) return json(env, { error: "invalid_fields" }, 400);
        if (!(await env.DB.prepare("SELECT id FROM bookings WHERE id=?1").bind(bookingId).first())) return json(env, { error: "not_found" }, 404);
        const pickup = stage === "pickup";
        const extraKm = pickup || bodyData.extraKm === "" ? null : parseInt(bodyData.extraKm,10), extraCosts = pickup || bodyData.extraCosts === "" ? null : Number(bodyData.extraCosts);
        const signature = protocolMediaUrl(bodyData.customerSignature), staffSignature=protocolMediaUrl(bodyData.staffSignature), staffName=clip(bodyData.staffName,120).trim(), photos = protocolMediaList(bodyData.photoRefs);
        if (!signature || !staffSignature || !staffName || (odometer != null && (!Number.isFinite(odometer) || odometer < 0)) || (extraKm != null && (!Number.isFinite(extraKm) || extraKm < 0)) || (extraCosts != null && (!Number.isFinite(extraCosts) || extraCosts < 0))) return json(env, { error: "invalid_protocol" }, 400);
        const rawChecklist = bodyData.checklist && typeof bodyData.checklist === "object" ? bodyData.checklist : {}, keyCount=parseInt(rawChecklist.keyCount,10);
        const damageTypes = new Set(["Kratzer","Delle","Lackschued","Rëss / Broch","Felg / Pneu","Aneres"]);
        const damageMarkers = Array.isArray(rawChecklist.damageMarkers) ? rawChecklist.damageMarkers.slice(0,30).map((m) => ({
          x: Math.max(16,Math.min(784,Number(m && m.x))),
          y: Math.max(16,Math.min(510,Number(m && m.y))),
          type: damageTypes.has(m && m.type) ? m.type : "Aneres",
          note: clip(m && m.note,120),
          v: 2
        })).filter((m) => Number.isFinite(m.x) && Number.isFinite(m.y)) : [];
        const checklist = { keyCount:Number.isFinite(keyCount)&&keyCount>=0&&keyCount<=10?String(keyCount):"", cleanliness:["Propper","Liicht verschmotzt","Staark verschmotzt"].includes(rawChecklist.cleanliness)?rawChecklist.cleanliness:"", documentsChecked:!!rawChecklist.documentsChecked, lightsChecked:!!rawChecklist.lightsChecked, tyresChecked:!!rawChecklist.tyresChecked, jointInspection:!!rawChecklist.jointInspection, damageMarkers };
        const previous = await env.DB.prepare("SELECT * FROM rental_inspections WHERE booking_id=?1 AND stage=?2").bind(bookingId,stage).first();
        const vals = [bookingId, stage, inspectedAt, odometer, clip(bodyData.fuelLevel,30), clip(bodyData.conditionNote,1000), clip(bodyData.damageNote,1500), photos, clip(bodyData.accessories,1000), pickup && bodyData.licenseChecked ? 1 : 0, extraKm, extraCosts, signature, staffSignature, staffName, clip(bodyData.note,1500), me.username, JSON.stringify(checklist)];
        const fields = ["booking_id","stage","inspected_at","odometer","fuel_level","condition_note","damage_note","photo_refs","accessories","license_checked","extra_km","extra_costs","customer_signature","staff_signature","staff_name","note"];
        if (previous && fields.every((field,index) => previous[field] === vals[index]) && previous.checklist_json === vals[17] && previous.deposit_amount == null) return json(env, { ok:true, unchanged:true });
        const changed = await env.DB.prepare("INSERT INTO rental_inspections (booking_id,stage,inspected_at,odometer,fuel_level,condition_note,damage_note,photo_refs,accessories,license_checked,deposit_amount,extra_km,extra_costs,customer_signature,staff_signature,staff_name,note,updated_by,checklist_json) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,NULL,?11,?12,?13,?14,?15,?16,?17,?18) ON CONFLICT(booking_id,stage) DO UPDATE SET inspected_at=?3,odometer=?4,fuel_level=?5,condition_note=?6,damage_note=?7,photo_refs=?8,accessories=?9,license_checked=?10,deposit_amount=NULL,extra_km=?11,extra_costs=?12,customer_signature=?13,staff_signature=?14,staff_name=?15,note=?16,updated_at=CURRENT_TIMESTAMP,updated_by=?17,checklist_json=?18 WHERE rental_inspections.inspected_at IS NOT excluded.inspected_at OR rental_inspections.odometer IS NOT excluded.odometer OR rental_inspections.fuel_level IS NOT excluded.fuel_level OR rental_inspections.condition_note IS NOT excluded.condition_note OR rental_inspections.damage_note IS NOT excluded.damage_note OR rental_inspections.photo_refs IS NOT excluded.photo_refs OR rental_inspections.accessories IS NOT excluded.accessories OR rental_inspections.license_checked IS NOT excluded.license_checked OR rental_inspections.deposit_amount IS NOT excluded.deposit_amount OR rental_inspections.extra_km IS NOT excluded.extra_km OR rental_inspections.extra_costs IS NOT excluded.extra_costs OR rental_inspections.customer_signature IS NOT excluded.customer_signature OR rental_inspections.staff_signature IS NOT excluded.staff_signature OR rental_inspections.staff_name IS NOT excluded.staff_name OR rental_inspections.note IS NOT excluded.note OR rental_inspections.checklist_json IS NOT excluded.checklist_json RETURNING id").bind(...vals).first();
        if (!changed) return json(env, { ok:true, unchanged:true });
        await env.DB.prepare("INSERT INTO booking_events (booking_id,action,by_user,note) VALUES (?1,?2,?3,?4)").bind(bookingId, stage === "pickup" ? "Iwwergabprotokoll gespäichert" : "Retourprotokoll gespäichert", me.username, clip(bodyData.damageNote || bodyData.note,500)).run();
        const currentKeys = new Set(protocolMediaKeys({ photo_refs:photos, customer_signature:signature, staff_signature:staffSignature }));
        await deleteProtocolMedia(env, protocolMediaKeys(previous).filter((key) => !currentKeys.has(key)));
        return json(env, { ok:true });
      }

      /* ---- Backup (admin) ---- */
      if (path === "/backup/run" && method === "POST") {
        if (!hasPerm(me.role, "members.manage")) return json(env, { error: "forbidden" }, 403);
        const r = await runBackup(env);
        return json(env, r.ok ? { ok: true, key: r.key, bytes: r.bytes } : { error: "no_media" }, r.ok ? 200 : 503);
      }
      if (path === "/backups" && method === "GET") {
        if (!hasPerm(me.role, "members.manage")) return json(env, { error: "forbidden" }, 403);
        if (!env.MEDIA) return json(env, { error: "server_not_configured" }, 503);
        const listed = await env.MEDIA.list({ prefix: "backups/", limit: 200 });
        const items = (listed.objects || []).map((o) => ({ key: o.key, size: o.size, uploaded: o.uploaded })).sort((a, b) => (a.key < b.key ? 1 : -1));
        return json(env, { backups: items });
      }
      m = path.match(/^\/backup\/file$/);
      if (m && method === "GET") {
        if (!hasPerm(me.role, "members.manage")) return json(env, { error: "forbidden" }, 403);
        if (!env.MEDIA) return json(env, { error: "server_not_configured" }, 503);
        const key = clip(url.searchParams.get("key") || "", 200);
        if (!/^backups\/[0-9]{4}\/[0-9]{4}-[0-9]{2}-[0-9]{2}\.json$/.test(key)) return json(env, { error: "not_found" }, 404);
        const object = await env.MEDIA.get(key);
        if (!object) return json(env, { error: "not_found" }, 404);
        const headers = new Headers(cors(env, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store", "Content-Disposition": 'attachment; filename="' + key.split("/").pop() + '"' }));
        return new Response(object.body, { headers });
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
          if (!act) { await env.DB.prepare("DELETE FROM sessions WHERE username = ?1").bind(target).run(); }
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
        await env.DB.prepare("DELETE FROM sessions WHERE username = ?1").bind(target).run();
        await env.DB.prepare("INSERT INTO member_events (action, target, by_user) VALUES ('deleted', ?1, ?2)").bind(target, me.username).run();
        return json(env, { ok: true });
      }

      return json(env, { error: "not_found" }, 404);
    } catch (e) {
      // Keng intern Feelerdetailer no baussen (nëmme loggen).
      console.error("server_error", e && e.stack || e);
      return json(env, { error: "server_error" }, 500);
    }
  },

  // Deeglecht Cron (wrangler [triggers]) — Backup vun der Datebank op R2.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(cleanupExpiredAuth(env).catch((error) => console.error("auth_cleanup_failed", error)));
    ctx.waitUntil(runBackup(env).catch((error) => console.error("backup_failed", error)));
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
