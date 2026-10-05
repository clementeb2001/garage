/* Interne Verwaltung — Reservatiounen + Memberen, live iwwer Cloudflare D1. */
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

  function refOf(id) { return "R-" + (id >= 1000 ? id : id + 1000); }

  /* ======================================================================
     LIVE-STORE (Cloudflare-Worker)
     ====================================================================== */
  function onAuthLost() { if (!session) return; session = null; showLogin(); toast("Sessioun ofgelaf – logg dech w.e.g. nei an."); }
  function api(path, opts) {
    opts = opts || {}; var headers = {}; var hadSession = !!session;
    var init = { method: opts.method || "GET", headers: headers, credentials: "include" };
    if (opts.body) { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(opts.body); }
    return fetch(API_BASE + path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && hadSession) setTimeout(onAuthLost, 0);
        return { status: r.status, body: j };
      });
    });
  }
  var liveStore = {
    mode: "live",
    login: function (u, p) { return api("/auth/login", { method: "POST", body: { username: u, password: p } }).then(function (r) { return r.status === 200 ? { ok: true, user: r.body.user } : { error: r.body.error || "invalid_credentials" }; }); },
    me: function () { return api("/auth/me").then(function (r) { return r.status === 200 ? r.body.user : null; }); },
    logout: function () { return api("/auth/logout", { method: "POST" }); },
    changePassword: function (cur, next) { return api("/auth/password", { method: "POST", body: { current: cur, next: next } }).then(function (r) { return r.status === 200 ? { ok: true } : { error: r.body.error || "error" }; }); },
    listBookings: function () { return api("/bookings").then(function (r) { if (r.status !== 200) throw new Error(r.body.error || "server_error"); return r.body.bookings; }); },
    setStatus: function (id, status, note) { return api("/bookings/" + id + "/status", { method: "POST", body: { status: status, note: note || "" } }).then(function (r) { return r.status === 200 ? { ok: true } : { error: r.body.error }; }); },
    listMembers: function () { return api("/members").then(function (r) { if (r.status !== 200) throw new Error(r.body.error || "server_error"); return r.body.members; }); },
    addMember: function (u, n, role) { return api("/members", { method: "POST", body: { username: u, name: n, role: role } }).then(function (r) { return r.status === 200 ? { ok: true, tempPassword: r.body.tempPassword } : { error: r.body.error }; }); },
    setRole: function (u, role) { return api("/members/" + u, { method: "POST", body: { role: role } }).then(function (r) { return r.status === 200 ? { ok: true } : { error: r.body.error }; }); },
    delMember: function (u) { return api("/members/" + u, { method: "DELETE" }).then(function (r) { return r.status === 200 ? { ok: true } : { error: r.body.error }; }); },
    updateMember: function (u, patch) { return api("/members/" + u, { method: "POST", body: patch }).then(function (r) { return r.status === 200 ? { ok: true, newUsername: r.body.newUsername, selfRenamed: r.body.selfRenamed } : { error: r.body.error }; }); },
    resetPassword: function (u) { return api("/members/" + u + "/reset", { method: "POST", body: {} }).then(function (r) { return r.status === 200 ? { ok: true, tempPassword: r.body.tempPassword } : { error: r.body.error }; }); },
    setActive: function (u, active) { return api("/members/" + u, { method: "POST", body: { active: !!active } }).then(function (r) { return r.status === 200 ? { ok: true } : { error: r.body.error }; }); },
    delBooking: function (id) { return api("/bookings/" + id, { method: "DELETE" }).then(function (r) { return r.status === 200 ? { ok: true } : { error: r.body.error }; }); },
    editBooking: function (id, patch) { return api("/bookings/" + id + "/edit", { method: "POST", body: patch }).then(function (r) { return r.status === 200 ? { ok: true } : { error: r.body.error }; }); },
    listAppointments: function () { return api("/appointments").then(function (r) { if (r.status !== 200) throw new Error(r.body.error || "server_error"); return r.body.appointments; }); },
    setApptStatus: function (id, status, note) { return api("/appointments/" + id + "/status", { method: "POST", body: { status: status, note: note || "" } }).then(function (r) { return r.status === 200 ? { ok: true } : { error: r.body.error }; }); },
    delAppt: function (id) { return api("/appointments/" + id, { method: "DELETE" }).then(function (r) { return r.status === 200 ? { ok: true } : { error: r.body.error }; }); },
    listMemberEvents: function () { return api("/member-events").then(function (r) { if (r.status !== 200) throw new Error(r.body.error || "server_error"); return r.body.events; }); },
  };

  var STORE = liveStore;
  var session = null;
  function can(perm) { return !!(session && ROLES[session.role] && ROLES[session.role].perms.indexOf(perm) !== -1); }
  var ERR = { invalid_credentials: "Falsche Benotzernumm oder Passwuert.", wrong_current: "Aktuellt Passwuert ass falsch.", weak_password: "Neit Passwuert ze kuerz (op mannst 8 Zeechen).", exists: "Dee Benotzernumm gëtt et schonn.", last_admin: "Et muss op mannst een Admin bleiwen.", self: "Du kanns dech net selwer läschen.", bad_input: "Ongëlteg Agab.", forbidden: "Keng Berechtegung.", rate_limited: "Ze vill Loginversich. Waart w.e.g. eng Stonn oder rufft den Admin un.", booking_conflict: "Dëst Gefier ass an dësem Zäitraum schonn bestätegt – kee Konflikt méiglech.", not_found: "Reservatioun net fonnt.", bad_status: "Ongëltege Status.", missing_fields: "Pflichtfelder feelen (Gefier, Numm, Vun, Bis).", invalid_fields: "Ongëlteg E-Mail oder Datum.", invalid_period: "D'Enddatum muss nom Ufanksdatum leien." };
  function errMsg(e) { return ERR[e] || "Feeler – probéiert nach eng Kéier."; }

  /* ---------- Views ---------- */
  var activePage = "bookings", activeFilter = "all", editingMember = null, editingBooking = null, bookingQuery = "";
  var apptFilter = "all", apptQuery = "";
  var STATUS = { new: "Nei", confirmed: "Bestätegt", declined: "Ofgeleent", done: "Ofgeschloss" };

  function showLogin() { $("view-app").hidden = true; $("view-login").hidden = false; $("login-err").textContent = ""; $("login-form").reset(); }
  function showApp() {
    $("view-login").hidden = true; $("view-app").hidden = false;
    $("who-name").textContent = session.name + " · " + roleLabel(session.role);
    $("nav-members").hidden = !can("members.manage");
    if (session.mustChange) { openPw(true); }
    else { gotoPage("dashboard"); }
  }
  function gotoPage(p) {
    if (p === "members" && !can("members.manage")) p = "bookings";
    if (p !== "members") editingMember = null;
    if (p !== "bookings") editingBooking = null;
    activePage = p;
    $("page-dashboard").hidden = p !== "dashboard";
    $("page-bookings").hidden = p !== "bookings";
    $("page-appointments").hidden = p !== "appointments";
    $("page-members").hidden = p !== "members";
    $("page-pw").hidden = p !== "pw";
    document.querySelectorAll("#topnav button").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-page") === p); });
    if (p === "dashboard") renderDashboard();
    else if (p === "bookings") renderBookings();
    else if (p === "appointments") renderAppointments();
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
  $("btn-logout").addEventListener("click", function () { STORE.logout().catch(function () {}).then(function () { session = null; showLogin(); }); });
  document.querySelectorAll("#topnav button").forEach(function (b) { b.addEventListener("click", function () { gotoPage(b.getAttribute("data-page")); }); });
  var searchEl = $("booking-search"); if (searchEl) searchEl.addEventListener("input", function () { bookingQuery = searchEl.value.trim(); renderBookings(); });
  var apptSearchEl = $("appt-search"); if (apptSearchEl) apptSearchEl.addEventListener("input", function () { apptQuery = apptSearchEl.value.trim(); renderAppointments(); });

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
  function doAct(id, status) { if (!can("bookings.validate")) return; var noteEl = $("note-" + id), note = noteEl ? noteEl.value.trim() : ""; STORE.setStatus(id, status, note).then(function (r) { if (r.error) { toast(errMsg(r.error)); return; } toast("Reservatioun " + refOf(id) + ": " + (STATUS[status] || status).toLowerCase() + "."); renderBookings(); }); }
  function doDelBooking(id) { if (!can("members.manage")) return; if (!confirm("Reservatioun " + refOf(id) + " endgülteg läschen?")) return; STORE.delBooking(id).then(function (r) { if (r.error) { toast(errMsg(r.error)); return; } toast("Reservatioun " + refOf(id) + " geläscht."); renderBookings(); }); }
  function dtLocal(v) { v = String(v || ""); var m = v.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/); return m ? m[1] : ""; }
  function bookingCard(b) {
    var el = document.createElement("div"); el.className = "booking" + (b.status === "new" ? " is-new" : "");
    var canVal = can("bookings.validate"), isAdmin = can("members.manage");
    var audit = (b.events || []).map(function (ev) { return '<div class="ev">• ' + esc(ev.action) + ' vum <b>' + esc(ev.by) + "</b>, " + fmt(ev.at) + (ev.note ? ' – „' + esc(ev.note) + "“" : "") + "</div>"; }).join("");

    if (editingBooking === b.id && canVal) {
      el.innerHTML =
        '<div class="b-top"><div><div class="b-veh">✎ Reservatioun änneren</div><div class="b-id">Réf. ' + refOf(b.id) + "</div></div><span class=\"status status-" + b.status + '">' + esc(STATUS[b.status]) + "</span></div>" +
        '<div class="b-edit">' +
        '<label>Gefier<input id="eb-veh" type="text" value="' + esc(b.veh) + '" maxlength="120" /></label>' +
        '<div class="b-edit-row"><label>Vun<input id="eb-from" type="datetime-local" step="1800" value="' + esc(dtLocal(b.from)) + '" /></label>' +
        '<label>Bis<input id="eb-to" type="datetime-local" step="1800" value="' + esc(dtLocal(b.to)) + '" /></label></div>' +
        '<label>Numm<input id="eb-name" type="text" value="' + esc(b.name) + '" maxlength="120" /></label>' +
        '<div class="b-edit-row"><label>E-Mail<input id="eb-email" type="email" value="' + esc(b.email || "") + '" maxlength="160" /></label>' +
        '<label>Telefon<input id="eb-phone" type="text" value="' + esc(b.phone || "") + '" maxlength="60" /></label></div>' +
        '<label>Noriicht<textarea id="eb-msg" rows="2" maxlength="2000">' + esc(b.msg || "") + "</textarea></label>" +
        '<div class="b-actions"><button class="btn btn-ok btn-sm" data-save-booking="' + b.id + '">Späicheren</button><button class="btn btn-outline btn-sm" data-cancel-booking="1">Ofbriechen</button></div>' +
        "</div>" +
        '<div class="b-audit">' + audit + "</div>";
      el.querySelector("[data-save-booking]").addEventListener("click", function () { doEditBooking(b.id); });
      el.querySelector("[data-cancel-booking]").addEventListener("click", function () { editingBooking = null; renderBookings(); });
      return el;
    }

    var actions = "";
    if (canVal && b.status === "new") actions = '<input class="b-note-input" id="note-' + b.id + '" type="text" placeholder="Notiz (fräiwëlleg) …" /><button class="btn btn-ok btn-sm" data-act="confirmed" data-id="' + b.id + '">✓ Bestätegen</button><button class="btn btn-outline btn-sm" data-act="declined" data-id="' + b.id + '">✕ Ofleenen</button>';
    else if (canVal && b.status === "confirmed") actions = '<input class="b-note-input" id="note-' + b.id + '" type="text" placeholder="Notiz (fräiwëlleg) …" /><button class="btn btn-outline btn-sm" data-act="done" data-id="' + b.id + '">Als ofgeschloss markéieren</button>';
    if (canVal) actions += '<button class="btn btn-outline btn-sm" data-edit-booking="' + b.id + '">✎ Änneren</button>';
    if (isAdmin) actions += '<button class="btn btn-danger btn-sm" data-del-booking="' + b.id + '">Läschen</button>';
    el.innerHTML =
      '<div class="b-top"><div><div class="b-veh">' + esc(b.veh) + '</div><div class="b-id">Réf. ' + refOf(b.id) + "</div></div><span class=\"status status-" + b.status + '">' + esc(STATUS[b.status]) + "</span></div>" +
      '<div class="b-dates">' + fmt(b.from) + '<span class="arrow">→</span>' + fmt(b.to) + "</div>" +
      '<div class="b-cust"><strong>' + esc(b.name) + "</strong><span>✉ " + esc(b.email) + "</span>" + (b.phone ? "<span>☎ " + esc(b.phone) + "</span>" : "") + "</div>" +
      (b.msg ? '<p class="b-msg">' + esc(b.msg) + "</p>" : "") +
      (actions ? '<div class="b-actions">' + actions + "</div>" : "") +
      '<div class="b-audit">' + audit + "</div>";
    el.querySelectorAll("[data-act]").forEach(function (btn) { btn.addEventListener("click", function () { doAct(b.id, btn.getAttribute("data-act")); }); });
    el.querySelectorAll("[data-edit-booking]").forEach(function (btn) { btn.addEventListener("click", function () { editingBooking = b.id; renderBookings(); }); });
    el.querySelectorAll("[data-del-booking]").forEach(function (btn) { btn.addEventListener("click", function () { doDelBooking(parseInt(btn.getAttribute("data-del-booking"), 10)); }); });
    return el;
  }
  function doEditBooking(id) {
    if (!can("bookings.validate")) return;
    var patch = { veh: $("eb-veh").value.trim(), from: $("eb-from").value, to: $("eb-to").value, name: $("eb-name").value.trim(), email: $("eb-email").value.trim(), phone: $("eb-phone").value.trim(), msg: $("eb-msg").value.trim() };
    if (!patch.veh || !patch.name || !patch.from || !patch.to) { toast("Gefier, Numm, Vun a Bis mussen ausgefëllt sinn."); return; }
    if (patch.to <= patch.from) { toast("D'Enddatum muss nom Ufanksdatum leien."); return; }
    STORE.editBooking(id, patch).then(function (r) { if (r.error) { toast(errMsg(r.error)); return; } editingBooking = null; toast("Reservatioun " + refOf(id) + " geännert."); renderBookings(); });
  }
  function matchQuery(b) { if (!bookingQuery) return true; var q = bookingQuery.toLowerCase(); return (refOf(b.id) + " " + (b.veh || "") + " " + (b.name || "") + " " + (b.email || "") + " " + (b.phone || "")).toLowerCase().indexOf(q) !== -1; }
  function updateNewBadge(bk) { var badge = $("nav-new-badge"); if (!badge) return; var n = bk.filter(function (b) { return b.status === "new"; }).length; badge.textContent = n; badge.hidden = n === 0; }

  /* ---------- Rendez-vous (Appointments) ---------- */
  function apptRefOf(id) { return "T-" + (id >= 1000 ? id : id + 1000); }
  function updateApptBadge(as) { var badge = $("nav-appt-badge"); if (!badge) return; var n = as.filter(function (a) { return a.status === "new"; }).length; badge.textContent = n; badge.hidden = n === 0; }
  function apptMatchQuery(a) { if (!apptQuery) return true; var q = apptQuery.toLowerCase(); return (apptRefOf(a.id) + " " + (a.service || "") + " " + (a.vehicle || "") + " " + (a.name || "") + " " + (a.email || "") + " " + (a.phone || "")).toLowerCase().indexOf(q) !== -1; }
  function renderApptFilters(as) {
    var c = { all: as.length, new: 0, confirmed: 0, declined: 0, done: 0 };
    as.forEach(function (a) { c[a.status] = (c[a.status] || 0) + 1; });
    var defs = [["all", "All"], ["new", "Nei"], ["confirmed", "Bestätegt"], ["declined", "Ofgeleent"], ["done", "Ofgeschloss"]], wrap = $("appt-filters");
    wrap.innerHTML = "";
    defs.forEach(function (d) { var b = document.createElement("button"); b.type = "button"; b.className = "chip" + (apptFilter === d[0] ? " active" : ""); b.innerHTML = esc(d[1]) + ' <span class="count">(' + (c[d[0]] || 0) + ")</span>"; b.addEventListener("click", function () { apptFilter = d[0]; renderAppointments(); }); wrap.appendChild(b); });
  }
  function doApptAct(id, status) { if (!can("bookings.validate")) return; var noteEl = $("anote-" + id), note = noteEl ? noteEl.value.trim() : ""; STORE.setApptStatus(id, status, note).then(function (r) { if (r.error) { toast(errMsg(r.error)); return; } toast("Rendez-vous " + apptRefOf(id) + ": " + (STATUS[status] || status).toLowerCase() + "."); renderAppointments(); }); }
  function doDelAppt(id) { if (!can("members.manage")) return; if (!confirm("Rendez-vous " + apptRefOf(id) + " endgülteg läschen?")) return; STORE.delAppt(id).then(function (r) { if (r.error) { toast(errMsg(r.error)); return; } toast("Rendez-vous " + apptRefOf(id) + " geläscht."); renderAppointments(); }); }
  function apptCard(a) {
    var el = document.createElement("div"); el.className = "booking" + (a.status === "new" ? " is-new" : "");
    var canVal = can("bookings.validate"), isAdmin = can("members.manage"), actions = "";
    if (canVal && a.status === "new") actions = '<input class="b-note-input" id="anote-' + a.id + '" type="text" placeholder="Notiz (fräiwëlleg) …" /><button class="btn btn-ok btn-sm" data-aact="confirmed" data-id="' + a.id + '">✓ Bestätegen</button><button class="btn btn-outline btn-sm" data-aact="declined" data-id="' + a.id + '">✕ Ofleenen</button>';
    else if (canVal && a.status === "confirmed") actions = '<input class="b-note-input" id="anote-' + a.id + '" type="text" placeholder="Notiz (fräiwëlleg) …" /><button class="btn btn-outline btn-sm" data-aact="done" data-id="' + a.id + '">Als ofgeschloss markéieren</button>';
    if (isAdmin) actions += '<button class="btn btn-danger btn-sm" data-del-appt="' + a.id + '">Läschen</button>';
    var audit = (a.events || []).map(function (ev) { return '<div class="ev">• ' + esc(ev.action) + ' vum <b>' + esc(ev.by) + "</b>, " + fmt(ev.at) + (ev.note ? ' – „' + esc(ev.note) + "“" : "") + "</div>"; }).join("");
    var meta = [];
    if (a.vehicle) meta.push("🚗 " + esc(a.vehicle));
    if (a.prefDate) meta.push("📅 " + esc(a.prefDate) + (a.altDate ? " / " + esc(a.altDate) : "") + (a.daytime ? " · " + esc(a.daytime) : ""));
    if (a.vin) meta.push("VIN " + esc(a.vin));
    el.innerHTML =
      '<div class="b-top"><div><div class="b-veh">' + esc(a.service || "Rendez-vous") + '</div><div class="b-id">Réf. ' + apptRefOf(a.id) + "</div></div><span class=\"status status-" + a.status + '">' + esc(STATUS[a.status]) + "</span></div>" +
      (meta.length ? '<div class="b-dates" style="gap:6px 16px;flex-wrap:wrap">' + meta.join('<span class="arrow">·</span>') + "</div>" : "") +
      '<div class="b-cust"><strong>' + esc(a.name) + "</strong>" + (a.email ? "<span>✉ " + esc(a.email) + "</span>" : "") + (a.phone ? "<span>☎ " + esc(a.phone) + "</span>" : "") + "</div>" +
      (a.msg ? '<p class="b-msg">' + esc(a.msg) + "</p>" : "") +
      (actions ? '<div class="b-actions">' + actions + "</div>" : "") +
      '<div class="b-audit">' + audit + "</div>";
    el.querySelectorAll("[data-aact]").forEach(function (btn) { btn.addEventListener("click", function () { doApptAct(a.id, btn.getAttribute("data-aact")); }); });
    el.querySelectorAll("[data-del-appt]").forEach(function (btn) { btn.addEventListener("click", function () { doDelAppt(parseInt(btn.getAttribute("data-del-appt"), 10)); }); });
    return el;
  }
  function renderAppointments() {
    $("appt-sub").textContent = can("bookings.validate") ? "Rendez-vous-Ufroe bestätegen oder ofleenen. All Aktioun gëtt mam Benotzernumm festgehalen." : "Dir hutt Liesrechter (Kucker).";
    STORE.listAppointments().then(function (as) {
      updateApptBadge(as);
      renderApptFilters(as);
      var list = $("appt-list"); list.innerHTML = "";
      var shown = as.filter(function (a) { return (apptFilter === "all" || a.status === apptFilter) && apptMatchQuery(a); });
      if (!shown.length) { var e = document.createElement("p"); e.className = "empty"; e.textContent = apptQuery ? "Kee Rendez-vous fir dës Sich." : "Keng Rendez-vous an dëser Kategorie."; list.appendChild(e); return; }
      shown.forEach(function (a) { list.appendChild(apptCard(a)); });
    }).catch(function () {
      $("appt-filters").innerHTML = "";
      $("appt-sub").textContent = "D'Donnéeë konnten net vum Server geluede ginn.";
      $("appt-list").innerHTML = '<p class="empty">⚠ Serverfeeler. <button class="btn btn-outline btn-sm" id="retry-appts">Nei probéieren</button></p>';
      $("retry-appts").addEventListener("click", renderAppointments);
    });
  }
  function renderBookings() {
    $("bookings-sub").textContent = can("bookings.validate") ? "Ufroe bestätegen oder ofleenen. All Aktioun gëtt mam Benotzernumm festgehalen." : "Dir hutt Liesrechter (Kucker).";
    STORE.listBookings().then(function (bk) {
      updateNewBadge(bk);
      renderFilters(bk);
      var list = $("booking-list"); list.innerHTML = "";
      var shown = bk.filter(function (b) { return (activeFilter === "all" || b.status === activeFilter) && matchQuery(b); });
      if (!shown.length) { var e = document.createElement("p"); e.className = "empty"; e.textContent = bookingQuery ? "Keng Reservatioun fir dës Sich." : "Keng Reservatiounen an dëser Kategorie."; list.appendChild(e); return; }
      shown.forEach(function (b) { list.appendChild(bookingCard(b)); });
    }).catch(function () {
      $("filters").innerHTML = "";
      $("bookings-sub").textContent = "D'Donnéeë konnten net vum Server geluede ginn.";
      $("booking-list").innerHTML = '<p class="empty">⚠ Serverfeeler. Kontrolléiert d’Verbindung a probéiert nach eng Kéier. <button class="btn btn-outline btn-sm" id="retry-bookings">Nei probéieren</button></p>';
      $("retry-bookings").addEventListener("click", renderBookings);
    });
  }

  /* ---------- Dashboard ---------- */
  var calRef = new Date(), dashActive = [];
  var VEH_COLORS = ["#2f6df6", "#e63946", "#2e7d5b", "#b7791f", "#7c4dff", "#0ea5a5", "#d6457f", "#546e7a"];
  function vehColorMap(bookings) { var map = {}, i = 0; bookings.forEach(function (b) { var v = b.veh || "?"; if (map[v] == null) { map[v] = VEH_COLORS[i % VEH_COLORS.length]; i++; } }); return map; }
  function parseDay(s) { if (!s) return null; var d = new Date(s); return isNaN(d) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function startOfWeek(d) { var x = new Date(d); var g = (x.getDay() + 6) % 7; x.setDate(x.getDate() - g); x.setHours(0, 0, 0, 0); return x; }
  function overlaps(a, b) { var a1 = parseDay(a.from) || parseDay(a.to), a2 = parseDay(a.to) || a1, b1 = parseDay(b.from) || parseDay(b.to), b2 = parseDay(b.to) || b1; if (!a1 || !b1) return false; return a1 <= b2 && b1 <= a2; }

  function renderDashboard() {
    STORE.listAppointments().then(updateApptBadge).catch(function () {});
    STORE.listBookings().then(function (bk) {
      updateNewBadge(bk);
      var active = bk.filter(function (b) { return b.status !== "declined"; });
      dashActive = active;
      var now = new Date(), today = new Date(); today.setHours(0, 0, 0, 0); var tMs = today.getTime();
      function dayMs(s) { var d = parseDay(s); return d ? d.getTime() : null; }
      var cntNew = bk.filter(function (b) { return b.status === "new"; }).length;
      var pickupsToday = active.filter(function (b) { return b.status === "confirmed" && dayMs(b.from) === tMs; }).length;
      var returnsToday = active.filter(function (b) { return b.status === "confirmed" && dayMs(b.to) === tMs; }).length;
      var outNow = active.filter(function (b) { if (b.status !== "confirmed") return false; var f = new Date(b.from), t = new Date(b.to); return !isNaN(f) && !isNaN(t) && f <= now && now <= t; }).length;
      var tiles = [
        ["accent", cntNew, "Nei Ufroen", "📥", "new"],
        ["", pickupsToday, "Haut eraus", "🔑", ""],
        ["", returnsToday, "Haut zréck", "↩", ""],
        ["ok", outNow, "Elo ënnerwee", "🚚", ""],
        ["muted", bk.length, "Total", "Σ", "all"],
      ];
      $("stat-row").innerHTML = tiles.map(function (t) { return '<div class="stat ' + t[0] + (t[4] ? " stat-link" : "") + '"' + (t[4] ? ' data-goto="' + t[4] + '" role="button" tabindex="0"' : "") + '><div class="stat-ic">' + t[3] + '</div><div><div class="n">' + t[1] + '</div><div class="l">' + t[2] + "</div></div></div>"; }).join("");
      $("stat-row").querySelectorAll("[data-goto]").forEach(function (s) { function go() { activeFilter = s.getAttribute("data-goto"); gotoPage("bookings"); } s.addEventListener("click", go); s.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } }); });
      $("dash-sub").textContent = STORE.mode === "live" ? "live" : "testmodus";
      renderConflicts(bk);
      renderToday(active);
      renderVehUsage(active);
      renderUpcoming(active);
      renderCalendar(active);
    }).catch(function () {
      $("dash-sub").textContent = "Serverfeeler";
      $("stat-row").innerHTML = '<div class="empty">⚠ D’Donnéeë konnten net geluede ginn. <button class="btn btn-outline btn-sm" id="retry-dashboard">Nei probéieren</button></div>';
      $("retry-dashboard").addEventListener("click", renderDashboard);
      $("conflict-box").innerHTML = ""; $("veh-usage").innerHTML = ""; $("upcoming").innerHTML = ""; $("calendar").innerHTML = ""; $("cal-legend").innerHTML = "";
    });
  }
  function renderConflicts(bk) {
    var box = $("conflict-box"); box.innerHTML = "";
    var rel = bk.filter(function (b) { return b.status === "new" || b.status === "confirmed"; });
    var seen = {}, confs = [];
    for (var i = 0; i < rel.length; i++) for (var j = i + 1; j < rel.length; j++) {
      if (rel[i].veh === rel[j].veh && overlaps(rel[i], rel[j])) { var key = [Math.min(rel[i].id, rel[j].id), Math.max(rel[i].id, rel[j].id)].join("-"); if (!seen[key]) { seen[key] = 1; confs.push([rel[i], rel[j]]); } }
    }
    if (!confs.length) return;
    box.innerHTML = '<div class="conflict-box"><b>⚠ ' + confs.length + " méigleche Konflikt" + (confs.length > 1 ? "er" : "") + ":</b> " + confs.map(function (c) { return esc(c[0].veh) + " (" + refOf(c[0].id) + " ↔ " + refOf(c[1].id) + ")"; }).join(" · ") + ". Déiselwecht Gefier(er) iwwerlappen am Datum.</div>";
  }
  function renderToday(active) {
    var el = $("today-list"); if (!el) return;
    var today = new Date(); today.setHours(0, 0, 0, 0); var tMs = today.getTime();
    var cmap = vehColorMap(active);
    function dayMs(s) { var d = parseDay(s); return d ? d.getTime() : null; }
    var outs = active.filter(function (b) { return b.status === "confirmed" && dayMs(b.from) === tMs; });
    var backs = active.filter(function (b) { return b.status === "confirmed" && dayMs(b.to) === tMs; });
    if (!outs.length && !backs.length) { el.innerHTML = '<p class="muted" style="font-size:0.85rem">Haut keng Ofhuelungen oder Retouren.</p>'; return; }
    function row(b, kind) { var tm = (fmt(kind === "out" ? b.from : b.to).split(" ")[1]) || ""; return '<div class="up-item"><span class="up-dot" style="background:' + cmap[b.veh || "?"] + '"></span><div style="flex:1"><div>' + esc(b.veh) + '</div><div class="muted" style="font-size:0.78rem">' + esc(b.name) + "</div></div><span class=\"up-when\">" + (kind === "out" ? "🔑 " : "↩ ") + tm + "</span></div>"; }
    var html = "";
    if (outs.length) html += '<div class="today-h">Eraus haut (' + outs.length + ")</div>" + outs.map(function (b) { return row(b, "out"); }).join("");
    if (backs.length) html += '<div class="today-h">Zréck haut (' + backs.length + ")</div>" + backs.map(function (b) { return row(b, "back"); }).join("");
    el.innerHTML = html;
  }
  function renderVehUsage(active) {
    var el = $("veh-usage"), byVeh = {}; active.forEach(function (b) { var v = b.veh || "?"; byVeh[v] = (byVeh[v] || 0) + 1; });
    var cmap = vehColorMap(active), arr = Object.keys(byVeh).map(function (v) { return [v, byVeh[v]]; }).sort(function (a, b) { return b[1] - a[1]; });
    if (!arr.length) { el.innerHTML = '<p class="muted" style="font-size:0.85rem">Nach keng Reservatiounen.</p>'; return; }
    var max = arr[0][1];
    el.innerHTML = arr.map(function (x) { return '<div class="veh-bar"><div class="vb-top"><span>' + esc(x[0]) + "</span><b>" + x[1] + '×</b></div><div class="vb-track"><div class="vb-fill" style="width:' + Math.round(x[1] / max * 100) + "%;background:" + cmap[x[0]] + '"></div></div></div>'; }).join("");
  }
  function renderUpcoming(active) {
    var el = $("upcoming"), today = new Date(); today.setHours(0, 0, 0, 0);
    var cmap = vehColorMap(active);
    var up = active.filter(function (b) { var f = parseDay(b.from); return f && f >= today; }).sort(function (a, b) { return parseDay(a.from) - parseDay(b.from); }).slice(0, 6);
    if (!up.length) { el.innerHTML = '<p class="muted" style="font-size:0.85rem">Keng kommend Reservatiounen.</p>'; return; }
    el.innerHTML = up.map(function (b) { return '<div class="up-item"><span class="up-dot" style="background:' + cmap[b.veh || "?"] + '"></span><div style="flex:1"><div>' + esc(b.veh) + '</div><div class="muted" style="font-size:0.78rem">' + esc(b.name) + " · " + (b.status === "new" ? "nei" : "bestätegt") + '</div></div><span class="up-when">' + fmt(b.from).split(" ")[0] + "</span></div>"; }).join("");
  }
  function renderCalendar(active) {
    var cmap = vehColorMap(active), y = calRef.getFullYear(), mo = calRef.getMonth();
    $("cal-label").textContent = ["Januar","Februar","Mäerz","Abrëll","Mee","Juni","Juli","August","September","Oktober","November","Dezember"][mo] + " " + y;
    var start = startOfWeek(new Date(y, mo, 1)), today = new Date(); today.setHours(0, 0, 0, 0);
    var dows = ["Mé","Dë","Më","Do","Fr","Sa","So"];
    var html = '<div class="cal-grid">' + dows.map(function (d) { return '<div class="cal-dow">' + d + "</div>"; }).join("");
    var cur = new Date(start);
    for (var i = 0; i < 42; i++) {
      var inMonth = cur.getMonth() === mo, isToday = cur.getTime() === today.getTime();
      var dayEvents = active.filter(function (b) { var f = parseDay(b.from), t = parseDay(b.to) || f; return f && cur >= f && cur <= t; });
      var evHtml = dayEvents.slice(0, 3).map(function (b) { return '<div class="cal-ev' + (b.status === "new" ? " tentative" : "") + '" style="background:' + cmap[b.veh || "?"] + '" title="' + esc(b.veh) + " – " + esc(b.name) + " (" + (b.status === "new" ? "nei" : b.status === "confirmed" ? "bestätegt" : "ofgeschloss") + ')">' + esc((b.veh || "").replace(/\s*\(.*$/, "")) + "</div>"; }).join("");
      if (dayEvents.length > 3) evHtml += '<div class="cal-ev" style="background:#9aa7b4">+' + (dayEvents.length - 3) + "</div>";
      html += '<div class="cal-cell' + (inMonth ? "" : " other") + (isToday ? " today" : "") + '"><div class="cal-daynum">' + cur.getDate() + "</div>" + evHtml + "</div>";
      cur.setDate(cur.getDate() + 1);
    }
    $("calendar").innerHTML = html + "</div>";
    var vehs = Object.keys(cmap);
    $("cal-legend").innerHTML = vehs.map(function (v) { return '<span><i style="background:' + cmap[v] + '"></i>' + esc(v.replace(/\s*\(.*$/, "")) + "</span>"; }).join("");
  }
  (function () {
    var p = $("cal-prev"), n = $("cal-next"), t = $("cal-today");
    if (p) p.addEventListener("click", function () { calRef = new Date(calRef.getFullYear(), calRef.getMonth() - 1, 1); renderCalendar(dashActive); });
    if (n) n.addEventListener("click", function () { calRef = new Date(calRef.getFullYear(), calRef.getMonth() + 1, 1); renderCalendar(dashActive); });
    if (t) t.addEventListener("click", function () { calRef = new Date(); renderCalendar(dashActive); });
  })();

  /* ---------- Export / Drécken ---------- */
  function csvCell(s) { s = String(s == null ? "" : s); return '"' + s.replace(/"/g, '""') + '"'; }
  function exportCSV() {
    STORE.listBookings().then(function (bk) {
      var rows = [["Réf", "Gefier", "Vun", "Bis", "Numm", "E-Mail", "Telefon", "Status", "Noriicht"]];
      bk.forEach(function (b) { rows.push([refOf(b.id), b.veh, b.from, b.to, b.name, b.email, b.phone, STATUS[b.status] || b.status, b.msg]); });
      var csv = "﻿" + rows.map(function (r) { return r.map(csvCell).join(";"); }).join("\r\n");
      var blob = new Blob([csv], { type: "text/csv;charset=utf-8" }), url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = "reservatiounen.csv"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }).catch(function () { toast("Export net méiglech: Server net erreechbar."); });
  }
  (function () { var e = $("btn-export"), pr = $("btn-print"); if (e) e.addEventListener("click", exportCSV); if (pr) pr.addEventListener("click", function () { window.print(); }); })();

  /* ---------- Members ---------- */
  function afterSelfRename() { toast("Däi Benotzernumm gouf geännert – logg dech w.e.g. nei an."); setTimeout(function () { session = null; showLogin(); }, 1400); }
  function renderMembers() {
    if (!can("members.manage")) return;
    STORE.listMembers().then(function (users) {
      var body = $("members-body"); body.innerHTML = "";
      users.forEach(function (u) {
        var tr = document.createElement("tr"), isSelf = session && u.username === session.username;
        if (editingMember === u.username) {
          tr.innerHTML =
            '<td><input class="member-sel" style="width:130px" id="edit-user" value="' + esc(u.username) + '" autocapitalize="none" /></td>' +
            '<td><input class="member-sel" style="width:100%" id="edit-name" value="' + esc(u.name) + '" /></td>' +
            "<td><span class=\"role-pill role-" + u.role + '">' + roleLabel(u.role) + "</span></td>" +
            '<td style="text-align:right;white-space:nowrap"><button class="btn btn-ok btn-sm" data-save="' + esc(u.username) + '">Späicheren</button> <button class="btn btn-outline btn-sm" data-cancel="1">Ofbriechen</button></td>';
        } else {
          var roleCell = '<select class="member-sel" data-role-for="' + esc(u.username) + '">' + ["viewer","validator","admin"].map(function (r) { return '<option value="' + r + '"' + (u.role === r ? " selected" : "") + ">" + roleLabel(r) + "</option>"; }).join("") + "</select>";
          tr.innerHTML =
            "<td><code>" + esc(u.username) + "</code>" + (isSelf ? '<span class="you-tag">(du)</span>' : "") + (u.active ? "" : ' <span class="role-pill role-viewer">inaktiv</span>') + "</td>" +
            "<td>" + esc(u.name) + "</td><td>" + roleCell + "</td>" +
            '<td style="text-align:right;white-space:nowrap"><button class="btn btn-outline btn-sm" data-edit="' + esc(u.username) + '">Änneren</button> ' +
            (isSelf ? "" : '<button class="btn btn-outline btn-sm" data-reset="' + esc(u.username) + '">PW</button> ' +
              (u.active ? '<button class="btn btn-warn btn-sm" data-active="0" data-user="' + esc(u.username) + '">Spären</button> ' : '<button class="btn btn-ok btn-sm" data-active="1" data-user="' + esc(u.username) + '">Aktivéieren</button> ') +
              '<button class="btn btn-danger btn-sm" data-del="' + esc(u.username) + '">Läschen</button>') + "</td>";
        }
        body.appendChild(tr);
      });
      body.querySelectorAll("[data-role-for]").forEach(function (sel) { sel.addEventListener("change", function () { STORE.setRole(sel.getAttribute("data-role-for"), sel.value).then(function (r) { if (r.error) { toast(errMsg(r.error)); } else toast("Roll geännert."); renderMembers(); }); }); });
      body.querySelectorAll("[data-edit]").forEach(function (b) { b.addEventListener("click", function () { editingMember = b.getAttribute("data-edit"); renderMembers(); }); });
      body.querySelectorAll("[data-cancel]").forEach(function (b) { b.addEventListener("click", function () { editingMember = null; renderMembers(); }); });
      body.querySelectorAll("[data-save]").forEach(function (b) { b.addEventListener("click", function () {
        var old = b.getAttribute("data-save"), nu = $("edit-user").value.trim().toLowerCase(), nm = $("edit-name").value.trim();
        var patch = { name: nm }; if (nu !== old) patch.newUsername = nu;
        STORE.updateMember(old, patch).then(function (r) {
          if (r.error) { toast(errMsg(r.error)); return; }
          editingMember = null;
          if (r.selfRenamed) { afterSelfRename(); return; }
          toast("Member gespäichert."); renderMembers();
        });
      }); });
      body.querySelectorAll("[data-reset]").forEach(function (b) { b.addEventListener("click", function () { var u = b.getAttribute("data-reset"); if (!confirm("Passwuert vu „" + u + "“ zrécksetzen? E neit temporäert Passwuert gëtt generéiert.")) return; STORE.resetPassword(u).then(function (r) { if (r.error) { toast(errMsg(r.error)); return; } $("add-msg").innerHTML = "🔑 Neit temporäert Passwuert fir <code>" + esc(u) + "</code>: <code>" + esc(r.tempPassword) + "</code> – gëff et dem Member, hie muss et beim nächste Login änneren."; toast("Passwuert zréckgesat."); }); }); });
      body.querySelectorAll("[data-del]").forEach(function (btn) { btn.addEventListener("click", function () { var u = btn.getAttribute("data-del"); if (!confirm("Member „" + u + "“ wierklech läschen?")) return; STORE.delMember(u).then(function (r) { if (r.error) toast(errMsg(r.error)); else toast("Member „" + u + "“ geläscht."); renderMembers(); }); }); });
      body.querySelectorAll("[data-active]").forEach(function (b) { b.addEventListener("click", function () { var u = b.getAttribute("data-user"), act = b.getAttribute("data-active") === "1"; STORE.setActive(u, act).then(function (r) { if (r.error) { toast(errMsg(r.error)); return; } toast(act ? "Member aktivéiert." : "Member gespaart."); renderMembers(); }); }); });
    }).catch(function () { $("members-body").innerHTML = '<tr><td colspan="4">⚠ Memberen konnten net geluede ginn. <button class="btn btn-outline btn-sm" id="retry-members">Nei probéieren</button></td></tr>'; $("retry-members").addEventListener("click", renderMembers); });
    renderMemberEvents();
  }
  function mevLabel(ev) {
    var a = ev.action || "", t = ev.target || "";
    if (a === "created") return "huet " + t + " bäigesat";
    if (a === "deleted") return "huet " + t + " geläscht";
    if (a === "rename") return "huet den Numm vun " + t + " geännert";
    if (a === "reset-pw") return "huet d'Passwuert vun " + t + " zréckgesat";
    if (a === "activated") return "huet " + t + " aktivéiert";
    if (a === "deactivated") return "huet " + t + " gespaart";
    if (a.indexOf("role:") === 0) return "huet " + t + " op " + roleLabel(a.slice(5)) + " gesat";
    if (a.indexOf("username>") === 0) return "huet de Benotzernumm vun " + t + " op " + a.slice(9) + " geännert";
    return a + " · " + t;
  }
  function renderMemberEvents() {
    var ul = $("mev-list"); if (!ul) return;
    STORE.listMemberEvents().then(function (evs) {
      ul.innerHTML = "";
      if (!evs || !evs.length) { var li = document.createElement("li"); li.className = "mev-empty"; li.textContent = "Nach keng Aktivitéit."; ul.appendChild(li); return; }
      evs.slice(0, 40).forEach(function (ev) { var li = document.createElement("li"); li.innerHTML = "<b>" + esc(ev.by) + "</b> " + esc(mevLabel(ev)) + ' <span class="mev-when">· ' + fmt(ev.at) + "</span>"; ul.appendChild(li); });
    }).catch(function () { ul.innerHTML = '<li class="mev-empty">⚠ Aktivitéite konnten net geluede ginn.</li>'; });
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

  /* ---------- Boot ---------- */
  function setModebar() {
    var bar = $("modebar");
    bar.className = "testbar modebar-live"; bar.textContent = "● Live · verbonne mam Server (Cloudflare)";
  }
  function boot() {
    setModebar();
    STORE.me().then(function (user) { if (user) { session = user; showApp(); } else { showLogin(); } }).catch(function () {
      showLogin(); $("modebar").className = "testbar"; $("modebar").textContent = "⚠ Server net erreechbar"; $("login-err").textContent = "Déi intern Verwaltung ass momentan net mam Server verbonnen. Probéiert et méi spéit nach eng Kéier.";
    });
  }
  boot();
})();
