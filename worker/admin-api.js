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
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
  return new Response(JSON.stringify(body), { status: status || 200, headers: cors(env, Object.assign({ "Content-Type": "application/json; charset=utf-8" }, extraHeaders || {})) });
}
function clip(s, n) { return String(s == null ? "" : s).slice(0, n); }
function protocolMediaUrl(s) { const v=clip(s,500).trim(); return /^https:\/\/garage-admin\.autoservicebettenduerf\.lu\/media\/protocol\/[a-z0-9/_-]+\.(?:webp|jpg|png)$/i.test(v) ? v : ""; }
function protocolMediaList(s) { return String(s||"").split("\n").map(protocolMediaUrl).filter(Boolean).slice(0,24).join("\n"); }
function hasPerm(role, perm) { return (PERMS[role] || []).indexOf(perm) !== -1; }
function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 160; }
function validDateTime(s) { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) && Number.isFinite(Date.parse(s)); }
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
  await ensureMaint(env);
  const fleet = (await env.DB.prepare("SELECT id,vehicle,asset_type FROM maintenance").all()).results || [];
  const wanted = vehicleDescriptors(veh,fleet);
  const rows = (await env.DB.prepare("SELECT id, veh, from_dt, to_dt FROM bookings WHERE status='confirmed' AND from_dt < ?1 AND to_dt > ?2").bind(to, from).all()).results || [];
  return rows.find((b) => Number(b.id) !== Number(excludeId || 0) && wanted.some((a) => vehicleDescriptors(b.veh,fleet).some((x) => descriptorOverlap(a,x)))) || null;
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

async function saveConsent(env, type, id, privacy, terms) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS request_consents (request_type TEXT NOT NULL, request_id INTEGER NOT NULL, privacy_accepted INTEGER NOT NULL, terms_accepted INTEGER NOT NULL DEFAULT 0, consent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (request_type, request_id))").run();
  await env.DB.prepare("INSERT OR REPLACE INTO request_consents (request_type, request_id, privacy_accepted, terms_accepted, consent_at) VALUES (?1,?2,?3,?4,CURRENT_TIMESTAMP)")
    .bind(type, id, privacy ? 1 : 0, terms ? 1 : 0).run();
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
  const subject = "Nei Location-Ufro AB-L-" + String(bookingId).padStart(5, "0");
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
async function sendBookingReceipt(env, bookingId, booking) {
  const L = ["lb", "de", "fr", "en"].includes(booking.lang) ? booking.lang : "lb";
  const ref = "AB-L-" + String(bookingId).padStart(5, "0");
  const copy = {
    lb: { subject: "Mir hunn Är Verleih-Ufro kritt – " + ref, title: "Är Ufro ass ukomm", intro: "Mir kontrolléieren elo d’Disponibilitéit an d’Konditiounen. Dëst ass nach keng verbindlech Buchung.", vehicle: "Gefier", from: "Vun", to: "Bis", next: "Mir mellen eis mat enger perséinlecher Bestätegung oder enger Alternativ." },
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
async function ensureAppts(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT, phone TEXT, service TEXT, vehicle TEXT, pref_date TEXT, alt_date TEXT, daytime TEXT, vin TEXT, msg TEXT, lang TEXT, kind TEXT NOT NULL DEFAULT 'appointment', status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS appointment_events (id INTEGER PRIMARY KEY AUTOINCREMENT, appointment_id INTEGER NOT NULL, action TEXT NOT NULL, by_user TEXT, note TEXT, at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  try { await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_appts_status ON appointments(status)").run(); } catch (e) {}
  try { await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_appt_events_aid ON appointment_events(appointment_id)").run(); } catch (e) {}
  // Defensiv: Spalt "kind" bei enger aler Tabell derbäisetzen (ignoréiert wann se scho besteet).
  try { await env.DB.prepare("ALTER TABLE appointments ADD COLUMN kind TEXT NOT NULL DEFAULT 'appointment'").run(); } catch (e) {}
}
async function ensureMaint(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS maintenance (id INTEGER PRIMARY KEY AUTOINCREMENT, vehicle TEXT NOT NULL, service TEXT NOT NULL, due_date TEXT, note TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_by TEXT)").run();
  try { await env.DB.prepare("ALTER TABLE maintenance ADD COLUMN fleet_status TEXT NOT NULL DEFAULT 'ready'").run(); } catch (e) {}
  try { await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_maint_public ON maintenance(public_active)").run(); } catch (e) {}
  const cols = [
    ["description","TEXT"],["image_url","TEXT"],["price_day","REAL"],["year","TEXT"],["seats","TEXT"],
    ["fuel","TEXT"],["transmission","TEXT"],["license_class","TEXT"],["load_space","TEXT"],
    ["deposit","REAL"],["features","TEXT"],["public_active","INTEGER NOT NULL DEFAULT 0"],["featured","INTEGER NOT NULL DEFAULT 0"],
    ["asset_type","TEXT NOT NULL DEFAULT 'van'"],["gross_weight","TEXT"],["payload","TEXT"],["braked","INTEGER NOT NULL DEFAULT 0"]
  ];
  for (const c of cols) { try { await env.DB.prepare("ALTER TABLE maintenance ADD COLUMN " + c[0] + " " + c[1]).run(); } catch (e) {} }
  // Al Claude-Donnéeën neutraliséieren: et gëtt weder Haaptgefier nach Kautiounsfeld.
  try { await env.DB.prepare("UPDATE maintenance SET featured=0, deposit=NULL WHERE featured!=0 OR deposit IS NOT NULL").run(); } catch (e) {}
  // Präiskorrektur Oktober 2026: nëmmen den ale Renault-Master-Tarif vun 80 € migréieren.
  try { await env.DB.prepare("UPDATE maintenance SET price_day=100 WHERE lower(vehicle)='renault master' AND (price_day IS NULL OR price_day=80)").run(); } catch (e) {}
  const master = await env.DB.prepare("SELECT id FROM maintenance WHERE lower(vehicle)='renault master' LIMIT 1").first();
  if (!master) await env.DB.prepare("INSERT INTO maintenance (vehicle,service,note,fleet_status,description,image_url,price_day,year,seats,fuel,transmission,license_class,load_space,features,public_active,featured,updated_by) VALUES ('Renault Master','Nach Bedarf','Automatesch aus dem bestehende Verleih iwwerholl','ready','Grousse Transporter fir Ëmzuch, Transport a sperreg Luedung.','assets/rental-renault-master.webp',100,'2021','3','Diesel','','B','L2H2','Grousse Luedraum (L2H2)\nBis 3,5 t\nVollgetankt zréckbréngen',1,0,'System')").run();
}
async function ensureRentalInspections(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS rental_inspections (id INTEGER PRIMARY KEY AUTOINCREMENT, booking_id INTEGER NOT NULL, stage TEXT NOT NULL, inspected_at TEXT NOT NULL, odometer INTEGER, fuel_level TEXT, condition_note TEXT, damage_note TEXT, photo_refs TEXT, accessories TEXT, license_checked INTEGER NOT NULL DEFAULT 0, deposit_amount REAL, extra_km INTEGER, extra_costs REAL, customer_signature TEXT, staff_signature TEXT, note TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_by TEXT, UNIQUE(booking_id, stage))").run();
  try { await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_inspections_booking ON rental_inspections(booking_id)").run(); } catch (e) {}
  try { await env.DB.prepare("ALTER TABLE rental_inspections ADD COLUMN checklist_json TEXT").run(); } catch (e) {}
}
/* ---------- Deeglecht Backup vun der D1-Datebank op R2 ---------- */
async function runBackup(env) {
  if (!env.MEDIA) return { ok: false, error: "no_media" };
  const tables = ["bookings", "booking_events", "appointments", "appointment_events", "maintenance", "rental_inspections", "request_consents", "member_events"];
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
  const title = inq ? "Nei Produktufro" : "Neie Rendez-vous";
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
    lb: "Konditiounen: 100 € pro ugefaangene 24 Stonnen, 250 km pro Locatioun abegraff, duerno 0,30 €/km, Kautioun 300 €, verspiet Retour 20 € pro ugefaangener Stonn.",
    de: "Konditionen: 100 € pro angefangenen 24 Stunden, 250 km pro Miete inklusive, danach 0,30 €/km, Kaution 300 €, verspätete Rückgabe 20 € pro angefangener Stunde.",
    fr: "Conditions : 100 € par tranche de 24 heures entamée, 250 km par location inclus, puis 0,30 €/km, caution 300 €, retard 20 € par heure entamée.",
    en: "Terms: €100 per started 24-hour period, 250 km per rental included, then €0.30/km, €300 deposit, late return €20 per started hour."
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
  // Sessiouns-Token: fir d'éischt iwwer den Authorization-Header (robust, Cross-
  // Subdomain- a Cookie-onofhängeg), soss iwwer de Cookie.
  let token = "";
  const h = request.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (m) token = m[1];
  if (!token) token = cookieValue(request, SESSION_COOKIE);
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
      /* ---- public: neng Reservatiounsufro (vum Location-Formulaire) ---- */
      if (path === "/bookings" && method === "POST") {
        if (!isAllowedOrigin(request, env)) return json(env, { error: "forbidden_origin" }, 403);
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
        return json(env, { busy: rows.map((r) => ({ veh: r.veh, from: r.from_dt, to: r.to_dt })) });
      }

      /* ---- public: aktiv Gefierer aus der interner Flotte ---- */
      if (path === "/fleet/public" && method === "GET") {
        await ensureMaint(env);
        const rows = (await env.DB.prepare("SELECT id,vehicle,description,image_url,price_day,year,seats,fuel,transmission,license_class,load_space,features,asset_type,gross_weight,payload,braked FROM maintenance WHERE public_active=1 AND fleet_status!='blocked' ORDER BY id ASC").all()).results || [];
        return json(env, { vehicles: rows.map((x) => ({ id:"fleet-"+x.id,type:["van","car","trailer"].includes(x.asset_type)?x.asset_type:"van",name:x.vehicle,description:x.description||"",image:x.image_url||"",priceDay:Number(x.price_day||0),year:x.year||"",seats:x.seats||"",fuel:x.fuel||"",transmission:x.transmission||"",licenseClass:x.license_class||"",loadSpace:x.load_space||"",grossWeight:x.gross_weight||"",payload:x.payload||"",braked:!!x.braked,features:String(x.features||"").split("\n").map((v)=>v.trim()).filter(Boolean) })) }, 200, { "Cache-Control": "public, max-age=120" });
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
        if (!(await publicRateAllowed(request, env))) return json(env, { error: "rate_limited" }, 429);
        const name = clip(bodyData.name, 120).trim();
        const email = clip(bodyData.email, 160).trim().toLowerCase();
        const loadedAt = Number(bodyData.loadedAt || 0), nowMs = Date.now();
        if (!name || !email || !bodyData.privacy) return json(env, { error: "missing_fields" }, 400);
        if (!validEmail(email)) return json(env, { error: "invalid_fields" }, 400);
        if (!loadedAt || nowMs - loadedAt < 2500 || nowMs - loadedAt > 86400000) return json(env, { error: "invalid_submission" }, 400);
        const kind = bodyData.kind === "inquiry" ? "inquiry" : "appointment";
        await ensureAppts(env);
        const r = await env.DB.prepare(
          "INSERT INTO appointments (name, email, phone, service, vehicle, pref_date, alt_date, daytime, vin, msg, lang, kind, status) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,'new')"
        ).bind(name, email, clip(bodyData.phone, 60), clip(bodyData.service, 120), clip(bodyData.vehicle, 120), clip(bodyData.prefDate, 20), clip(bodyData.altDate, 20), clip(bodyData.daytime, 40), clip(bodyData.vin, 40), clip(bodyData.msg, 2000), ["lb", "de", "fr", "en"].includes(bodyData.lang) ? bodyData.lang : "lb", kind).run();
        const id = r.meta.last_row_id;
        await saveConsent(env, kind, id, bodyData.privacy, false);
        await env.DB.prepare("INSERT INTO appointment_events (appointment_id, action, by_user, note) VALUES (?1,'Ufro erakomm','System','')").bind(id).run();
        ctx.waitUntil(sendNewApptNotice(env, id, { name: name, email: email, service: clip(bodyData.service, 120), vehicle: clip(bodyData.vehicle, 120), pref_date: clip(bodyData.prefDate, 20), kind: kind }));
        return json(env, { ok: true, id });
      }

      /* ---- login (mat Brute-Force-Schutz: max 10 falsch Versich/Stonn/IP) ---- */
      if (path === "/auth/login" && method === "POST") {
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
        // Token am Body (fir Authorization-Header) + Cookie (SameSite=Strict) als Zousaz.
        return json(env, { ok: true, token, user: { username: row.username, name: row.name, role: row.role, mustChange: !!row.must_change } }, 200, { "Set-Cookie": sessionCookie(token) });
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
        await ensureSessions(env);
        await env.DB.prepare("DELETE FROM sessions WHERE username = ?1").bind(me.username).run();
        const token = await createSession(env, me.username);
        return json(env, { ok: true, token }, 200, { "Set-Cookie": sessionCookie(token) });
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

      /* ---- Rendez-vous lëschten (viewer+) ---- */
      if (path === "/appointments" && method === "GET") {
        if (!hasPerm(me.role, "bookings.view")) return json(env, { error: "forbidden" }, 403);
        await ensureAppts(env);
        const as = (await env.DB.prepare("SELECT * FROM appointments ORDER BY id DESC LIMIT 1000").all()).results || [];
        const evs = (await env.DB.prepare("SELECT appointment_id, action, by_user, note, at FROM appointment_events ORDER BY id ASC").all()).results || [];
        const byId = {};
        evs.forEach((e) => { (byId[e.appointment_id] = byId[e.appointment_id] || []).push({ action: e.action, by: e.by_user, at: e.at, note: e.note || "" }); });
        return json(env, { appointments: as.map((a) => ({ id: a.id, name: a.name, email: a.email, phone: a.phone, service: a.service, vehicle: a.vehicle, prefDate: a.pref_date, altDate: a.alt_date, daytime: a.daytime, vin: a.vin, msg: a.msg, kind: a.kind || "appointment", status: a.status, events: byId[a.id] || [] })) });
      }

      /* ---- Rendez-vous Status änneren (validator+) ---- */
      m = path.match(/^\/appointments\/(\d+)\/status$/);
      if (m && method === "POST") {
        if (!hasPerm(me.role, "bookings.validate")) return json(env, { error: "forbidden" }, 403);
        await ensureAppts(env);
        const id = parseInt(m[1], 10);
        const status = clip(bodyData.status, 20);
        const labels = { confirmed: "Bestätegt", declined: "Ofgeleent", done: "Ofgeschloss", new: "Zrécksetzen" };
        if (!labels[status]) return json(env, { error: "bad_status" }, 400);
        const ex = await env.DB.prepare("SELECT id FROM appointments WHERE id = ?1").bind(id).first();
        if (!ex) return json(env, { error: "not_found" }, 404);
        await env.DB.prepare("UPDATE appointments SET status = ?1 WHERE id = ?2").bind(status, id).run();
        await env.DB.prepare("INSERT INTO appointment_events (appointment_id, action, by_user, note) VALUES (?1,?2,?3,?4)").bind(id, labels[status], me.username, clip(bodyData.note, 500)).run();
        return json(env, { ok: true });
      }

      /* ---- Rendez-vous läschen (admin) ---- */
      m = path.match(/^\/appointments\/(\d+)$/);
      if (m && method === "DELETE") {
        if (me.role !== "admin") return json(env, { error: "forbidden" }, 403);
        await ensureAppts(env);
        const id = parseInt(m[1], 10);
        await env.DB.prepare("DELETE FROM appointment_events WHERE appointment_id = ?1").bind(id).run();
        await env.DB.prepare("DELETE FROM appointments WHERE id = ?1").bind(id).run();
        return json(env, { ok: true });
      }

      /* ---- Wartung / Maintenance ---- */
      if (path === "/maintenance" && method === "GET") {
        if (!hasPerm(me.role, "bookings.view")) return json(env, { error: "forbidden" }, 403);
        await ensureMaint(env);
        const ms = (await env.DB.prepare("SELECT * FROM maintenance ORDER BY (due_date IS NULL), due_date ASC, id DESC").all()).results || [];
        return json(env, { items: ms.map((m) => ({ id:m.id, type:["van","car","trailer"].includes(m.asset_type)?m.asset_type:"van", vehicle:m.vehicle, service:m.service, dueDate:m.due_date||"", note:m.note||"", status:m.fleet_status||"ready", description:m.description||"", imageUrl:m.image_url||"", priceDay:m.price_day==null?"":m.price_day, year:m.year||"", seats:m.seats||"", fuel:m.fuel||"", transmission:m.transmission||"", licenseClass:m.license_class||"", loadSpace:m.load_space||"", grossWeight:m.gross_weight||"", payload:m.payload||"", braked:!!m.braked, features:m.features||"", active:!!m.public_active, updated_at:m.updated_at, updated_by:m.updated_by||"" })) });
      }
      if (path === "/maintenance" && method === "POST") {
        if (!hasPerm(me.role, "bookings.validate")) return json(env, { error: "forbidden" }, 403);
        await ensureMaint(env);
        const vehicle = clip(bodyData.vehicle, 120).trim();
        const service = clip(bodyData.service, 120).trim() || "Nach Bedarf";
        const dueDate = clip(bodyData.dueDate, 20).trim();
        if (!vehicle) return json(env, { error: "missing_fields" }, 400);
        if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return json(env, { error: "invalid_fields" }, 400);
        const fleetStatus = ["ready","rented","service","blocked"].includes(bodyData.status) ? bodyData.status : "ready", assetType=["van","car","trailer"].includes(bodyData.type)?bodyData.type:"van";
        const r = await env.DB.prepare("INSERT INTO maintenance (vehicle,service,due_date,note,updated_by,fleet_status,description,image_url,price_day,year,seats,fuel,transmission,license_class,load_space,features,public_active,featured,deposit,asset_type,gross_weight,payload,braked) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,0,NULL,?18,?19,?20,?21)")
          .bind(vehicle,service,dueDate||null,clip(bodyData.note,300),me.username,fleetStatus,clip(bodyData.description,1200),clip(bodyData.imageUrl,500),bodyData.priceDay===""?null:Number(bodyData.priceDay),clip(bodyData.year,20),clip(bodyData.seats,20),clip(bodyData.fuel,60),clip(bodyData.transmission,60),clip(bodyData.licenseClass,30),clip(bodyData.loadSpace,200),clip(bodyData.features,1200),bodyData.active?1:0,assetType,clip(bodyData.grossWeight,60),clip(bodyData.payload,60),bodyData.braked?1:0).run();
        return json(env, { ok: true, id: r.meta.last_row_id });
      }
      m = path.match(/^\/maintenance\/(\d+)$/);
      if (m && method === "POST") {
        if (!hasPerm(me.role, "bookings.validate")) return json(env, { error: "forbidden" }, 403);
        await ensureMaint(env);
        const id = parseInt(m[1], 10);
        const ex = await env.DB.prepare("SELECT id FROM maintenance WHERE id = ?1").bind(id).first();
        if (!ex) return json(env, { error: "not_found" }, 404);
        const vehicle = clip(bodyData.vehicle, 120).trim();
        const service = clip(bodyData.service, 120).trim() || "Nach Bedarf";
        const dueDate = clip(bodyData.dueDate, 20).trim();
        if (!vehicle) return json(env, { error: "missing_fields" }, 400);
        if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return json(env, { error: "invalid_fields" }, 400);
        const fleetStatus = ["ready","rented","service","blocked"].includes(bodyData.status) ? bodyData.status : "ready", assetType=["van","car","trailer"].includes(bodyData.type)?bodyData.type:"van";
        await env.DB.prepare("UPDATE maintenance SET vehicle=?1,service=?2,due_date=?3,note=?4,updated_at=CURRENT_TIMESTAMP,updated_by=?5,fleet_status=?6,description=?7,image_url=?8,price_day=?9,year=?10,seats=?11,fuel=?12,transmission=?13,license_class=?14,load_space=?15,features=?16,public_active=?17,featured=0,deposit=NULL,asset_type=?18,gross_weight=?19,payload=?20,braked=?21 WHERE id=?22")
          .bind(vehicle,service,dueDate||null,clip(bodyData.note,300),me.username,fleetStatus,clip(bodyData.description,1200),clip(bodyData.imageUrl,500),bodyData.priceDay===""?null:Number(bodyData.priceDay),clip(bodyData.year,20),clip(bodyData.seats,20),clip(bodyData.fuel,60),clip(bodyData.transmission,60),clip(bodyData.licenseClass,30),clip(bodyData.loadSpace,200),clip(bodyData.features,1200),bodyData.active?1:0,assetType,clip(bodyData.grossWeight,60),clip(bodyData.payload,60),bodyData.braked?1:0,id).run();
        return json(env, { ok: true });
      }
      if (m && method === "DELETE") {
        if (!hasPerm(me.role, "bookings.validate")) return json(env, { error: "forbidden" }, 403);
        await ensureMaint(env);
        await env.DB.prepare("DELETE FROM maintenance WHERE id = ?1").bind(parseInt(m[1], 10)).run();
        return json(env, { ok: true });
      }

      /* ---- Digital Iwwergab- / Retourprotokoller ---- */
      if (path === "/rental-inspections" && method === "GET") {
        if (!hasPerm(me.role, "bookings.view")) return json(env, { error: "forbidden" }, 403);
        await ensureRentalInspections(env);
        const rows = (await env.DB.prepare("SELECT i.*, b.veh, b.cust_name, b.from_dt, b.to_dt FROM rental_inspections i LEFT JOIN bookings b ON b.id=i.booking_id ORDER BY i.inspected_at DESC, i.id DESC").all()).results || [];
        return json(env, { items: rows.map((x) => ({ id:x.id, bookingId:x.booking_id, stage:x.stage, inspectedAt:x.inspected_at, odometer:x.odometer, fuelLevel:x.fuel_level || "", conditionNote:x.condition_note || "", damageNote:x.damage_note || "", photoRefs:x.photo_refs || "", accessories:x.accessories || "", licenseChecked:!!x.license_checked, extraKm:x.extra_km, extraCosts:x.extra_costs, customerSignature:x.customer_signature || "", staffSignature:x.staff_signature || "", note:x.note || "", checklistJson:x.checklist_json || "{}", updatedAt:x.updated_at, updatedBy:x.updated_by || "", vehicle:x.veh || "", customer:x.cust_name || "", from:x.from_dt || "", to:x.to_dt || "" })) });
      }
      if (path === "/rental-inspections" && method === "POST") {
        if (!hasPerm(me.role, "bookings.validate")) return json(env, { error: "forbidden" }, 403);
        await ensureRentalInspections(env);
        const bookingId = parseInt(bodyData.bookingId, 10), stage = clip(bodyData.stage, 10), inspectedAt = clip(bodyData.inspectedAt, 20);
        const odometer = bodyData.odometer === "" ? null : parseInt(bodyData.odometer, 10);
        if (!bookingId || ["pickup","return"].indexOf(stage) < 0 || !validDateTime(inspectedAt)) return json(env, { error: "invalid_fields" }, 400);
        if (!(await env.DB.prepare("SELECT id FROM bookings WHERE id=?1").bind(bookingId).first())) return json(env, { error: "not_found" }, 404);
        const pickup = stage === "pickup";
        const extraKm = pickup || bodyData.extraKm === "" ? null : parseInt(bodyData.extraKm,10), extraCosts = pickup || bodyData.extraCosts === "" ? null : Number(bodyData.extraCosts);
        const signature = protocolMediaUrl(bodyData.customerSignature), photos = protocolMediaList(bodyData.photoRefs);
        if (!signature || (odometer != null && (!Number.isFinite(odometer) || odometer < 0)) || (extraKm != null && (!Number.isFinite(extraKm) || extraKm < 0)) || (extraCosts != null && (!Number.isFinite(extraCosts) || extraCosts < 0))) return json(env, { error: "invalid_protocol" }, 400);
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
        const vals = [bookingId, stage, inspectedAt, odometer, clip(bodyData.fuelLevel,30), clip(bodyData.conditionNote,1000), clip(bodyData.damageNote,1500), photos, clip(bodyData.accessories,1000), pickup && bodyData.licenseChecked ? 1 : 0, extraKm, extraCosts, signature, clip(bodyData.staffSignature,120), clip(bodyData.note,1500), me.username, JSON.stringify(checklist)];
        await env.DB.prepare("INSERT INTO rental_inspections (booking_id,stage,inspected_at,odometer,fuel_level,condition_note,damage_note,photo_refs,accessories,license_checked,deposit_amount,extra_km,extra_costs,customer_signature,staff_signature,note,updated_by,checklist_json) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,NULL,?11,?12,?13,?14,?15,?16,?17) ON CONFLICT(booking_id,stage) DO UPDATE SET inspected_at=?3,odometer=?4,fuel_level=?5,condition_note=?6,damage_note=?7,photo_refs=?8,accessories=?9,license_checked=?10,deposit_amount=NULL,extra_km=?11,extra_costs=?12,customer_signature=?13,staff_signature=?14,note=?15,updated_at=CURRENT_TIMESTAMP,updated_by=?16,checklist_json=?17").bind(...vals).run();
        await env.DB.prepare("INSERT INTO booking_events (booking_id,action,by_user,note) VALUES (?1,?2,?3,?4)").bind(bookingId, stage === "pickup" ? "Iwwergabprotokoll gespäichert" : "Retourprotokoll gespäichert", me.username, clip(bodyData.damageNote || bodyData.note,500)).run();
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
      // Keng intern Feelerdetailer no baussen (nëmme loggen).
      console.error("server_error", e && e.stack || e);
      return json(env, { error: "server_error" }, 500);
    }
  },

  // Deeglecht Cron (wrangler [triggers]) — Backup vun der Datebank op R2.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runBackup(env).catch(function () {}));
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
