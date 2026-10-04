/* Interne Verwaltung — Reservatiounen + Memberen.
   Léisst sech live mam Cloudflare-Worker (D1) verbannen; souguer d'Worker
   nach net deployéiert ass, fält et automatesch op den TESTMODUS (Demo am
   Browser) zréck. Selwecht Rollemodell wéi de Worker. */
(function () {
  "use strict";

  var API_BASE = "https://garage-admin.autoservicebettenduerf.lu";
  var ROLES = {
    viewer:    { label: "Kucker",      perms: ["bookings.view"] },
    validator: { label: "Validéierer", perms: ["bookings.view", "bookings.validate"] },
    admin:     { label: "Admin",       perms: ["bookings.view", "bookings.validate", "members.manage"] },
  };
  function roleLabel(r) { return (ROLES[r] || {}).label || r; }

  var $ = function (id) { return document.getElementById(id); };
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function fmt(s) { if (!s) return "—"; var d = new Date(s); if (isNaN(d)) return s; return pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function now() { return new Date().toISOString(); }
  var toastT = null;
  function toast(msg) { var t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); clearTimeout(toastT); toastT = setTimeout(function () { t.remove(); }, 2600); }

  /* ======================================================================
     DEMO-STORE (localStorage) — ersat vum liveStore wann de Worker do ass
     ====================================================================== */
  var USERS_KEY = "intern_demo_users_v1", DATA_KEY = "intern_demo_bookings_v1";
  function ls(key, fb) { try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fb : v; } catch (e) { return fb; } }
  function lsSet(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  function iso(y, mo, d, h, mi) { return new Date(y, mo - 1, d, h, mi, 0).toISOString(); }
  function seedUsers() { return [
    { username: "admin", name: "Clement (Admin)", role: "admin", pw: "test1234", active: true },
    { username: "atelier", name: "Atelier", role: "validator", pw: "test1234", active: true },
    { username: "theke", name: "Theke", role: "viewer", pw: "test1234", active: true },
  ]; }
  function seedBookings() { return [
    { id: 1041, veh: "Camionnette (Déménagement)", from: iso(2026,10,6,8,0), to: iso(2026,10,6,18,0), name: "Marc Weber", email: "marc.weber@email.lu", phone: "+352 691 234 567", msg: "Fir en Déménagement an der Stad.", status: "new", events: [{ action: "Ufro erakomm", by: "System", at: iso(2026,10,3,9,12), note: "" }] },
    { id: 1040, veh: "Remorque (Unhänger)", from: iso(2026,10,5,9,0), to: iso(2026,10,5,20,0), name: "Sophie Muller", email: "sophie.muller@email.lu", phone: "+352 621 987 654", msg: "Gaardenoffäll an de Recyclingszentrum.", status: "new", events: [{ action: "Ufro erakomm", by: "System", at: iso(2026,10,3,7,45), note: "" }] },
    { id: 1039, veh: "Ersatzween (Auto)", from: iso(2026,10,2,8,0), to: iso(2026,10,6,17,0), name: "Jean Reiter", email: "j.reiter@email.lu", phone: "+352 691 112 233", msg: "Wärend mäin Auto an der Reparatur ass.", status: "confirmed", events: [{ action: "Ufro erakomm", by: "System", at: iso(2026,10,1,15,2), note: "" }, { action: "Bestätegt", by: "clement", at: iso(2026,10,1,16,30), note: "Ween steet prett." }] },
    { id: 1038, veh: "Camionnette (Déménagement)", from: iso(2026,9,28,8,0), to: iso(2026,9,29,18,0), name: "Lucie Thill", email: "lucie.thill@email.lu", phone: "+352 661 445 566", msg: "", status: "declined", events: [{ action: "Ufro erakomm", by: "System", at: iso(2026,9,26,10,0), note: "" }, { action: "Ofgeleent", by: "clement", at: iso(2026,9,27,11,10), note: "Schonn un deem Dag reservéiert." }] },
    { id: 1037, veh: "Remorque (Unhänger)", from: iso(2026,9,25,9,0), to: iso(2026,9,25,19,0), name: "Paul Schmit", email: "paul.schmit@email.lu", phone: "+352 691 778 899", msg: "Transport vu Miwwelen.", status: "done", events: [{ action: "Ufro erakomm", by: "System", at: iso(2026,9,24,8,30), note: "" }, { action: "Bestätegt", by: "atelier", at: iso(2026,9,24,9,5), note: "" }, { action: "Ofgeschloss", by: "atelier", at: iso(2026,9,25,19,30), note: "Alles OK zréck." }] },
  ]; }
  function dUsers() { var u = ls(USERS_KEY, null); if (!u) { u = seedUsers(); lsSet(USERS_KEY, u); } return u; }
  function dBookings() { var b = ls(DATA_KEY, null); if (!b) { b = seedBookings(); lsSet(DATA_KEY, b); } return b; }
  function dAdminCount(u) { return u.filter(function (x) { return x.role === "admin" && x.active; }).length; }
  function randomPw() { var c = "abcdefghjkmnpqrstuvwxyz23456789", s = ""; for (var i = 0; i < 8; i++) s += c.charAt(Math.floor(Math.random() * c.length)); return s; }
  function P(v) { return Promise.resolve(v); }

  var demoStore = {
    mode: "demo",
    login: function (u, p) { var r = dUsers().filter(function (x) { return x.username === u; })[0]; if (!r || !r.active || r.pw !== p) return P({ error: "invalid_credentials" }); return P({ ok: true, user: { username: r.username, name: r.name, role: r.role, mustChange: false } }); },
    me: function () { return P(null); },
    changePassword: function (cur, next) { var users = dUsers(), me = session && users.filter(function (x) { return x.username === session.username; })[0]; if (!me || me.pw !== cur) return P({ error: "wrong_current" }); me.pw = next; lsSet(USERS_KEY, users); return P({ ok: true }); },
    listBookings: function () { return P(dBookings().slice().sort(function (a, b) { return b.id - a.id; })); },
    setStatus: function (id, status, note) { var labels = { confirmed: "Bestätegt", declined: "Ofgeleent", done: "Ofgeschloss" }; var bk = dBookings(), t = bk.filter(function (x) { return x.id === id; })[0]; if (!t) return P({ error: "not_found" }); t.status = status; t.events.push({ action: labels[status], by: session.username, at: now(), note: note || "" }); lsSet(DATA_KEY, bk); return P({ ok: true }); },
    listMembers: function () { return P(dUsers().map(function (u) { return { username: u.username, name: u.name, role: u.role, active: u.active }; })); },
    addMember: function (u, n, role) { var users = dUsers(); if (users.filter(function (x) { return x.username === u; })[0]) return P({ error: "exists" }); var pw = randomPw(); users.push({ username: u, name: n, role: role, pw: pw, active: true }); lsSet(USERS_KEY, users); return P({ ok: true, tempPassword: pw }); },
    setRole: function (u, role) { var users = dUsers(), t = users.filter(function (x) { return x.username === u; })[0]; if (!t) return P({ error: "not_found" }); if (t.role === "admin" && role !== "admin" && dAdminCount(users) <= 1) return P({ error: "last_admin" }); t.role = role; lsSet(USERS_KEY, users); return P({ ok: true }); },
    delMember: function (u) { if (session && u === session.username) return P({ error: "self" }); var users = dUsers(), t = users.filter(function (x) { return x.username === u; })[0]; if (!t) return P({ error: "not_found" }); if (t.role === "admin" && dAdminCount(users) <= 1) return P({ error: "last_admin" }); lsSet(USERS_KEY, users.filter(function (x) { return x.username !== u; })); return P({ ok: true }); },
    reset: function () { lsSet(USERS_KEY, seedUsers()); lsSet(DATA_KEY, seedBookings()); },
  };

  /* ======================================================================
     LIVE-STORE (Cloudflare-Worker)
     ====================================================================== */
  var TOKEN_KEY = "intern_token_v1";
  var token = null; try { token = localStorage.getItem(TOKEN_KEY); } catch (e) {}
  function api(path, opts) {
    opts = opts || {}; var headers = {}; if (token) headers.Authorization = "Bearer " + token;
    var init = { method: opts.method || "GET", headers: headers };
    if (opts.body) { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(opts.body); }
    return fetch(API_BASE + path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401) { token = null; try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} }
        return { status: r.status, body: j };
      });
    });
  }
  var liveStore = {
    mode: "live",
    login: function (u, p) { return api("/auth/login", { method: "POST", body: { username: u, password: p } }).then(function (r) { if (r.status === 200) { token = r.body.token; try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {} return { ok: true, user: r.body.user }; } return { error: r.body.error || "invalid_credentials" }; }); },
    me: function () { if (!token) return P(null); return api("/auth/me").then(function (r) { return r.status === 200 ? r.body.user : null; }); },
    changePassword: function (cur, next) { return api("/auth/password", { method: "POST", body: { current: cur, next: next } }).then(function (r) { return r.status === 200 ? { ok: true } : { error: r.body.error || "error" }; }); },
    listBookings: function () { return api("/bookings").then(function (r) { return r.status === 200 ? r.body.bookings : []; }); },
    setStatus: function (id, status, note) { return api("/bookings/" + id + "/status", { method: "POST", body: { status: status, note: note || "" } }).then(function (r) { return r.status === 200 ? { ok: true } : { error: r.body.error }; }); },
    listMembers: function () { return api("/members").then(function (r) { return r.status === 200 ? r.body.members : []; }); },
    addMember: function (u, n, role) { return api("/members", { method: "POST", body: { username: u, name: n, role: role } }).then(function (r) { return r.status === 200 ? { ok: true, tempPassword: r.body.tempPassword } : { error: r.body.error }; }); },
    setRole: function (u, role) { return api("/members/" + u, { method: "POST", body: { role: role } }).then(function (r) { return r.status === 200 ? { ok: true } : { error: r.body.error }; }); },
    delMember: function (u) { return api("/members/" + u, { method: "DELETE" }).then(function (r) { return r.status === 200 ? { ok: true } : { error: r.body.error }; }); },
    reset: null,
  };

  var STORE = demoStore;
  var session = null;
  function can(perm) { return !!(session && ROLES[session.role] && ROLES[session.role].perms.indexOf(perm) !== -1); }
  var ERR = { invalid_credentials: "Falsche Benotzernumm oder Passwuert.", wrong_current: "Aktuellt Passwuert ass falsch.", weak_password: "Neit Passwuert ze kuerz (op mannst 8 Zeechen).", exists: "Dee Benotzernumm gëtt et schonn.", last_admin: "Et muss op mannst een Admin bleiwen.", self: "Du kanns dech net selwer läschen.", bad_input: "Ongëlteg Agab.", forbidden: "Keng Berechtegung." };
  function errMsg(e) { return ERR[e] || "Feeler – probéiert nach eng Kéier."; }

  /* ---------- Views ---------- */
  var activePage = "bookings", activeFilter = "all";
  var STATUS = { new: "Nei", confirmed: "Bestätegt", declined: "Ofgeleent", done: "Ofgeschloss" };

  function showLogin() { $("view-app").hidden = true; $("view-login").hidden = false; $("login-err").textContent = ""; $("login-form").reset(); }
  function showApp() {
    $("view-login").hidden = true; $("view-app").hidden = false;
    $("who-name").textContent = session.name + " · " + roleLabel(session.role);
    $("nav-members").hidden = !can("members.manage");
    if (session.mustChange) { openPw(true); }
    else { gotoPage("bookings"); }
  }
  function gotoPage(p) {
    if (p === "members" && !can("members.manage")) p = "bookings";
    activePage = p;
    $("page-bookings").hidden = p !== "bookings";
    $("page-members").hidden = p !== "members";
    $("page-pw").hidden = p !== "pw";
    document.querySelectorAll("#topnav button").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-page") === p); });
    if (p === "bookings") renderBookings();
    else if (p === "members") renderMembers();
  }

  /* ---------- Login ---------- */
  $("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var u = $("u").value.trim().toLowerCase(), p = $("p").value;
    $("login-err").textContent = "…";
    STORE.login(u, p).then(function (r) {
      if (r.error) { $("login-err").textContent = errMsg(r.error); return; }
      session = r.user; showApp();
    });
  });
  $("btn-logout").addEventListener("click", function () { session = null; token = null; try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} showLogin(); });
  $("btn-reset").addEventListener("click", function () {
    if (STORE.mode !== "demo" || !STORE.reset) return;
    if (!confirm("Demo-Daten op den Ufankszoustand zrécksetzen?")) return;
    STORE.reset(); if (session && !dUsers().filter(function (x) { return x.username === session.username; })[0]) { session = null; showLogin(); return; } gotoPage("bookings");
  });
  document.querySelectorAll("#topnav button").forEach(function (b) { b.addEventListener("click", function () { gotoPage(b.getAttribute("data-page")); }); });

  /* ---------- Change password ---------- */
  function openPw(forced) { gotoPage("pw"); $("pw-forced-note").hidden = !forced; $("pw-err").textContent = ""; $("pw-form").reset(); }
  $("btn-pw").addEventListener("click", function () { openPw(false); });
  $("pw-cancel").addEventListener("click", function () { if (session && session.mustChange) { toast("Ännert w.e.g. éischt Äert Passwuert."); return; } gotoPage("bookings"); });
  $("pw-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var cur = $("pw-cur").value, n1 = $("pw-new").value, n2 = $("pw-new2").value;
    if (n1 !== n2) { $("pw-err").textContent = "Déi nei Passwierder stëmmen net iwwereneen."; return; }
    if (n1.length < 8) { $("pw-err").textContent = "Op mannst 8 Zeechen."; return; }
    $("pw-err").textContent = "…";
    STORE.changePassword(cur, n1).then(function (r) {
      if (r.error) { $("pw-err").textContent = errMsg(r.error); return; }
      if (session) session.mustChange = false;
      toast("Passwuert geännert."); gotoPage("bookings");
    });
  });

  /* ---------- Bookings ---------- */
  function counts(bk) { var c = { all: bk.length, new: 0, confirmed: 0, declined: 0, done: 0 }; bk.forEach(function (b) { c[b.status] = (c[b.status] || 0) + 1; }); return c; }
  function renderFilters(bk) {
    var c = counts(bk), defs = [["all","All"],["new","Nei"],["confirmed","Bestätegt"],["declined","Ofgeleent"],["done","Ofgeschloss"]], wrap = $("filters");
    wrap.innerHTML = "";
    defs.forEach(function (d) { var b = document.createElement("button"); b.type = "button"; b.className = "chip" + (activeFilter === d[0] ? " active" : ""); b.innerHTML = esc(d[1]) + ' <span class="count">(' + (c[d[0]] || 0) + ")</span>"; b.addEventListener("click", function () { activeFilter = d[0]; renderBookings(); }); wrap.appendChild(b); });
  }
  function doAct(id, status) { if (!can("bookings.validate")) return; var noteEl = $("note-" + id), note = noteEl ? noteEl.value.trim() : ""; STORE.setStatus(id, status, note).then(function (r) { if (r.error) { toast(errMsg(r.error)); return; } toast("Reservatioun R-" + id + ": " + (STATUS[status] || status).toLowerCase() + "."); renderBookings(); }); }
  function bookingCard(b) {
    var el = document.createElement("div"); el.className = "booking" + (b.status === "new" ? " is-new" : "");
    var canVal = can("bookings.validate"), actions = "";
    if (canVal && b.status === "new") actions = '<input class="b-note-input" id="note-' + b.id + '" type="text" placeholder="Notiz (fräiwëlleg) …" /><button class="btn btn-ok btn-sm" data-act="confirmed" data-id="' + b.id + '">✓ Bestätegen</button><button class="btn btn-outline btn-sm" data-act="declined" data-id="' + b.id + '">✕ Ofleenen</button>';
    else if (canVal && b.status === "confirmed") actions = '<input class="b-note-input" id="note-' + b.id + '" type="text" placeholder="Notiz (fräiwëlleg) …" /><button class="btn btn-outline btn-sm" data-act="done" data-id="' + b.id + '">Als ofgeschloss markéieren</button>';
    var audit = (b.events || []).map(function (ev) { return '<div class="ev">• ' + esc(ev.action) + ' vum <b>' + esc(ev.by) + "</b>, " + fmt(ev.at) + (ev.note ? ' – „' + esc(ev.note) + "“" : "") + "</div>"; }).join("");
    el.innerHTML =
      '<div class="b-top"><div><div class="b-veh">' + esc(b.veh) + '</div><div class="b-id">Réf. R-' + b.id + "</div></div><span class=\"status status-" + b.status + '">' + esc(STATUS[b.status]) + "</span></div>" +
      '<div class="b-dates">' + fmt(b.from) + '<span class="arrow">→</span>' + fmt(b.to) + "</div>" +
      '<div class="b-cust"><strong>' + esc(b.name) + "</strong><span>✉ " + esc(b.email) + "</span>" + (b.phone ? "<span>☎ " + esc(b.phone) + "</span>" : "") + "</div>" +
      (b.msg ? '<p class="b-msg">' + esc(b.msg) + "</p>" : "") +
      (actions ? '<div class="b-actions">' + actions + "</div>" : "") +
      '<div class="b-audit">' + audit + "</div>";
    el.querySelectorAll("[data-act]").forEach(function (btn) { btn.addEventListener("click", function () { doAct(b.id, btn.getAttribute("data-act")); }); });
    return el;
  }
  function renderBookings() {
    $("bookings-sub").textContent = can("bookings.validate") ? "Ufroe bestätegen oder ofleenen. All Aktioun gëtt mam Benotzernumm festgehalen." : "Dir hutt Liesrechter (Kucker).";
    $("btn-reset").hidden = STORE.mode !== "demo";
    STORE.listBookings().then(function (bk) {
      renderFilters(bk);
      var list = $("booking-list"); list.innerHTML = "";
      var shown = bk.filter(function (b) { return activeFilter === "all" || b.status === activeFilter; });
      if (!shown.length) { var e = document.createElement("p"); e.className = "empty"; e.textContent = "Keng Reservatiounen an dëser Kategorie."; list.appendChild(e); return; }
      shown.forEach(function (b) { list.appendChild(bookingCard(b)); });
    });
  }

  /* ---------- Members ---------- */
  function renderMembers() {
    if (!can("members.manage")) return;
    STORE.listMembers().then(function (users) {
      var body = $("members-body"); body.innerHTML = "";
      users.forEach(function (u) {
        var tr = document.createElement("tr"), isSelf = session && u.username === session.username;
        var roleCell = '<select class="member-sel" data-role-for="' + esc(u.username) + '">' + ["viewer","validator","admin"].map(function (r) { return '<option value="' + r + '"' + (u.role === r ? " selected" : "") + ">" + roleLabel(r) + "</option>"; }).join("") + "</select>";
        tr.innerHTML = "<td><code>" + esc(u.username) + "</code>" + (isSelf ? '<span class="you-tag">(du)</span>' : "") + (u.active ? "" : ' <span class="role-pill role-viewer">inaktiv</span>') + "</td><td>" + esc(u.name) + "</td><td>" + roleCell + '</td><td style="text-align:right">' + (isSelf ? "" : '<button class="btn btn-danger btn-sm" data-del="' + esc(u.username) + '">Läschen</button>') + "</td>";
        body.appendChild(tr);
      });
      body.querySelectorAll("[data-role-for]").forEach(function (sel) { sel.addEventListener("change", function () { STORE.setRole(sel.getAttribute("data-role-for"), sel.value).then(function (r) { if (r.error) toast(errMsg(r.error)); else toast("Roll geännert."); renderMembers(); }); }); });
      body.querySelectorAll("[data-del]").forEach(function (btn) { btn.addEventListener("click", function () { var u = btn.getAttribute("data-del"); if (!confirm("Member „" + u + "“ wierklech läschen?")) return; STORE.delMember(u).then(function (r) { if (r.error) toast(errMsg(r.error)); else toast("Member „" + u + "“ geläscht."); renderMembers(); }); }); });
    });
  }
  $("add-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!can("members.manage")) return;
    var username = $("m-user").value.trim().toLowerCase(), name = $("m-name").value.trim(), role = $("m-role").value;
    if (!/^[a-z0-9._-]{3,}$/.test(username)) { $("add-msg").textContent = "Benotzernumm: op mannst 3 Zeechen (Klengbuschtawen, Zuelen, . _ -)."; return; }
    $("add-msg").textContent = "…";
    STORE.addMember(username, name, role).then(function (r) {
      if (r.error) { $("add-msg").textContent = errMsg(r.error); return; }
      $("add-form").reset();
      $("add-msg").innerHTML = "✓ Member <code>" + esc(username) + "</code> bäigesat. Temporär Passwuert: <code>" + esc(r.tempPassword) + "</code> – de Member ännert et beim 1. Login.";
      renderMembers();
    });
  });

  /* ---------- Boot: Worker erreechbar? ---------- */
  function setModebar() {
    var bar = $("modebar");
    if (STORE.mode === "live") { bar.className = "testbar modebar-live"; bar.textContent = "● Live · verbonne mam Server (Cloudflare)"; }
    else { bar.className = "testbar"; bar.textContent = "⚠️ TESTMODUS · Server (Worker) nach net erreechbar – Demo-Daten am Browser"; }
  }
  function boot() {
    setModebar();
    if (STORE.mode === "live") {
      STORE.me().then(function (user) { if (user) { session = user; showApp(); } else { showLogin(); } });
    } else { showLogin(); }
  }
  // Probe: ass de Worker do?
  var probe = fetch(API_BASE + "/auth/me", { method: "GET" }).then(function () { STORE = liveStore; }).catch(function () { STORE = demoStore; });
  probe.then(boot);
})();
