/* Interne Verwaltung — Reservatiounen + Memberen, live iwwer Cloudflare D1. */
(function () {
  "use strict";

  // Installéiert App erkennen (iOS: navigator.standalone) → Klass fir de Statusbar-Ofstand.
  try {
    if (window.navigator.standalone === true || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)) {
      document.documentElement.classList.add("pwa-standalone");
    }
  } catch (e) {}

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

  function refOf(id) { return "AB-L-" + String(Number(id) || 0).padStart(5, "0"); }

  /* ======================================================================
     LIVE-STORE (Cloudflare-Worker)
     ====================================================================== */
  /* D'Sessioun leeft ausschliisslech iwwer den HttpOnly-Cookie vum Worker.
     Al Bearer-Tokens aus fréiere Versioune ginn aktiv geläscht. */
  var TOKEN_KEY = "gk_intern_token";
  var token = null;
  try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  function setToken() { token = null; try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} }
  function onAuthLost() { setToken(null); if (!session) return; session = null; showLogin(); toast("Sessioun ofgelaf – logg dech w.e.g. nei an."); }
  // Share concurrent identical requests, including accidental double clicks.
  var pendingRequests = new Map();
  function api(path, opts) {
    opts = opts || {}; var headers = {}; var hadSession = !!session;
    var init = { method: opts.method || "GET", headers: headers, credentials: "include" };
    if (opts.body) { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(opts.body); }
    var key = init.method + " " + path + " " + (init.body || "");
    if (pendingRequests.has(key)) return pendingRequests.get(key);
    var promise = fetch(API_BASE + path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && hadSession) setTimeout(onAuthLost, 0);
        return { status: r.status, body: j };
      });
    }).finally(function () { if (pendingRequests.get(key) === promise) pendingRequests.delete(key); });
    pendingRequests.set(key, promise);
    return promise;
  }
  function uploadImage(blob, scope) {
    var headers = { "Content-Type": blob.type || "image/webp" };
    return fetch(API_BASE + "/media/" + (scope === "protocol" ? "protocol" : "fleet"), { method:"POST", headers:headers, credentials:"include", body:blob }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401) setTimeout(onAuthLost, 0);
        return r.status === 200 ? { ok:true, url:j.url } : { error:j.error || "upload_failed" };
      });
    });
  }
  var liveStore = {
    mode: "live",
    login: function (u, p) { return api("/auth/login", { method: "POST", body: { username: u, password: p } }).then(function (r) { if (r.status === 200) { setToken(); return { ok: true, user: r.body.user }; } return { error: r.body.error || "invalid_credentials" }; }); },
    me: function () { return api("/auth/me").then(function (r) { return r.status === 200 ? r.body.user : null; }); },
    logout: function () { return api("/auth/logout", { method: "POST" }).then(function (r) { setToken(null); return r; }); },
    changePassword: function (cur, next) { return api("/auth/password", { method: "POST", body: { current: cur, next: next } }).then(function (r) { if (r.status === 200) { setToken(); return { ok: true }; } return { error: r.body.error || "error" }; }); },
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
    setApptStatus: function (id, status, note, date, time) { return api("/appointments/" + id + "/status", { method: "POST", body: { status: status, note: note || "", date: date || "", time: time || "" } }).then(function (r) { return r.status === 200 ? { ok: true, confirmedDate: r.body.confirmedDate, confirmedTime: r.body.confirmedTime, unchanged: r.body.unchanged, mailQueued: r.body.mailQueued } : { error: r.body.error }; }); },
    resendApptConfirmation: function (id, date, time) { return api("/appointments/" + id + "/confirmation-email", { method: "POST", body: { date: date, time: time } }).then(function (r) { return r.status === 200 ? { ok:true } : { error:r.body.error }; }); },
    listStaff: function () { return api("/staff").then(function (r) { return r.status === 200 ? (r.body.staff || []) : []; }); },
    setApptPlan: function (id, p) { return api("/appointments/" + id + "/plan", { method: "POST", body: { assigned: p.assigned || "", duration: p.duration === "" || p.duration == null ? "" : p.duration, planNote: p.planNote || "" } }).then(function (r) { return r.status === 200 ? { ok: true, assignedTo: r.body.assignedTo, assignedName: r.body.assignedName, durationMin: r.body.durationMin, planNote: r.body.planNote } : { error: r.body.error }; }); },
    delAppt: function (id) { return api("/appointments/" + id, { method: "DELETE" }).then(function (r) { return r.status === 200 ? { ok: true } : { error: r.body.error }; }); },
    listApptBlocks: function () { return api("/appointment-blocks", { method: "GET" }).then(function (r) { return r.status === 200 ? (r.body.blocks || []) : []; }); },
    setApptBlock: function (date, slot, blocked) { return api("/appointment-blocks", { method: "POST", body: { date: date, slot: slot, blocked: !!blocked } }).then(function (r) { return r.status === 200 ? { ok: true } : { error: r.body.error }; }); },
    listMemberEvents: function () { return api("/member-events").then(function (r) { if (r.status !== 200) throw new Error(r.body.error || "server_error"); return r.body.events; }); },
    listMaintenance: function () { return api("/maintenance").then(function (r) { if (r.status !== 200) throw new Error(r.body.error || "server_error"); return r.body.items; }); },
    addMaintenance: function (p) { return api("/maintenance", { method: "POST", body: p }).then(function (r) { return r.status === 200 ? { ok: true, id: r.body.id } : { error: r.body.error }; }); },
    editMaintenance: function (id, p) { return api("/maintenance/" + id, { method: "POST", body: p }).then(function (r) { return r.status === 200 ? { ok: true } : { error: r.body.error }; }); },
    delMaintenance: function (id) { return api("/maintenance/" + id, { method: "DELETE" }).then(function (r) { return r.status === 200 ? { ok: true } : { error: r.body.error }; }); },
    listFleetBlocks: function (vehicle) { return api("/fleet-blocks" + (vehicle ? "?vehicle=" + encodeURIComponent(vehicle) : "")).then(function (r) { if (r.status !== 200) throw new Error(r.body.error || "server_error"); return r.body.items; }); },
    addFleetBlock: function (p) { return api("/fleet-blocks", { method: "POST", body: p }).then(function (r) { return r.status === 200 ? { ok: true, id: r.body.id } : { error: r.body.error }; }); },
    delFleetBlock: function (id) { return api("/fleet-blocks/" + id, { method: "DELETE" }).then(function (r) { return r.status === 200 ? { ok: true } : { error: r.body.error }; }); },
    listInspections: function () { return api("/rental-inspections").then(function (r) { if (r.status !== 200) throw new Error(r.body.error || "server_error"); return r.body.items; }); },
    saveInspection: function (p) { return api("/rental-inspections", { method: "POST", body: p }).then(function (r) { return r.status === 200 ? { ok:true } : { error:r.body.error }; }); },
    uploadFleetImage: function(blob){return uploadImage(blob,"fleet");},
    uploadProtocolImage: function(blob){return uploadImage(blob,"protocol");},
  };

  var bookingListCache = null, requestListCache = null;
  var staffList = [], staffLoaded = false;
  function ensureStaff() { if (staffLoaded) return Promise.resolve(staffList); return STORE.listStaff().then(function (s) { staffList = s || []; staffLoaded = true; return staffList; }, function () { staffList = []; return staffList; }); }
  function staffName(username) { if (!username) return ""; var hit = staffList.filter(function (u) { return u.username === username; })[0]; return hit ? hit.name : username; }
  var STORE = liveStore;
  var session = null;
  function can(perm) { return !!(session && ROLES[session.role] && ROLES[session.role].perms.indexOf(perm) !== -1); }
  var ERR = { invalid_credentials: "Falsche Benotzernumm oder falscht Passwuert.", wrong_current: "Dat aktuellt Passwuert ass falsch.", weak_password: "Dat neit Passwuert ass ze kuerz (op d'mannst 8 Zeechen).", exists: "Dee Benotzernumm gëtt et schonn.", last_admin: "Et muss op d'mannst een Admin bleiwen.", self: "Du kanns dech net selwer läschen.", bad_input: "Ongëlteg Donnéeën.", forbidden: "Keng Berechtegung.", rate_limited: "Ze vill Umeldungsversich. Waart w.e.g. eng Stonn oder rufft den Admin un.", booking_conflict: "Dëst Gefier ass an dësem Zäitraum schonn reservéiert. D'Iwwerschneidung kann net bestätegt ginn.", not_found: "Reservatioun net fonnt.", bad_status: "Ongëltege Status.", missing_fields: "Obligatoresch Felder feelen (Gefier, Numm, Vun, Bis).", invalid_fields: "Ongëlteg E-Mail-Adress oder Datum.", invalid_protocol: "De Protokoll enthält eng ongëlteg oder feelend Ënnerschrëft beziehungsweise Zuel.", invalid_period: "Den Enddatum muss nom Ufanksdatum leien.", forbidden_origin: "Zougrëff vun dëser Adress blockéiert – benotzt w.e.g. https://autoservicebettenduerf.lu/intern/", stale_status: "De Status gouf mëttlerweil geännert. Luet d’Lëscht nei.", server_not_configured: "Server net konfiguréiert." };
  ERR.appointment_not_confirmed = "De Rendez-vous muss fir d'éischt bestätegt ginn.";
  ERR.missing_email = "Keng gëlteg E-Mail-Adress.";
  ERR.missing_confirmation_time = "Gitt en Datum an eng Auerzäit un.";
  ERR.mail_rate_limited = "Ze vill Mailversich. Waart w.e.g. eng Minutt.";
  ERR.mail_failed = "Mail konnt net geschéckt ginn. Probéiert nach eng Kéier.";
  function errMsg(e) { return ERR[e] || "Feeler – probéiert nach eng Kéier."; }

  /* ---------- Views ---------- */
  var activePage = "bookings", activeFilter = "all", editingMember = null, editingBooking = null, bookingQuery = "", protocolOpen = null, inspections = [];
  var STATUS = { new: "Nei", confirmed: "Bestätegt", declined: "Ofgeleent", done: "Ofgeschloss" };

  function showLogin() { bookingListCache = null; requestListCache = null; $("view-app").hidden = true; $("view-login").hidden = false; $("login-err").textContent = ""; $("login-form").reset(); }
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
    $("page-analyse").hidden = p !== "analyse";
    $("page-bookings").hidden = p !== "bookings";
    $("page-appointments").hidden = p !== "appointments";
    $("page-inquiries").hidden = p !== "inquiries";
    $("page-wartung").hidden = p !== "wartung";
    $("page-members").hidden = p !== "members";
    $("page-pw").hidden = p !== "pw";
    document.querySelectorAll("#topnav button").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-page") === p); });
    if (p === "dashboard") renderDashboard();
    else if (p === "analyse") renderAnalyse();
    else if (p === "bookings") renderBookings();
    else if (p === "appointments") renderAppointments();
    else if (p === "inquiries") renderInquiries();
    else if (p === "wartung") renderWartung();
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
  var searchEl = $("booking-search"); if (searchEl) searchEl.addEventListener("input", function () { bookingQuery = searchEl.value.trim(); renderBookings(true); });
  var apptSearchEl = $("appt-search"); if (apptSearchEl) apptSearchEl.addEventListener("input", function () { reqState.appointment.query = apptSearchEl.value.trim(); renderReq("appointment", true); });
  var inqSearchEl = $("inq-search"); if (inqSearchEl) inqSearchEl.addEventListener("input", function () { reqState.inquiry.query = inqSearchEl.value.trim(); renderReq("inquiry", true); });

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
    defs.forEach(function (d) { var b = document.createElement("button"); b.type = "button"; b.className = "chip" + (activeFilter === d[0] ? " active" : ""); b.innerHTML = esc(d[1]) + ' <span class="count">(' + (c[d[0]] || 0) + ")</span>"; b.addEventListener("click", function () { activeFilter = d[0]; renderBookings(true); }); wrap.appendChild(b); });
  }
  function doAct(id, status) { if (!can("bookings.validate")) return; var noteEl = $("note-" + id), note = noteEl ? noteEl.value.trim() : ""; STORE.setStatus(id, status, note).then(function (r) { if (r.error) { toast(errMsg(r.error)); return; } toast("Reservatioun " + refOf(id) + ": " + (STATUS[status] || status).toLowerCase() + "."); renderBookings(); }); }
  function doDelBooking(id) { if (!can("members.manage")) return; if (!confirm("Reservatioun " + refOf(id) + " endgülteg läschen?")) return; STORE.delBooking(id).then(function (r) { if (r.error) { toast(errMsg(r.error)); return; } toast("Reservatioun " + refOf(id) + " geläscht."); renderBookings(); }); }
  function dtLocal(v) { v = String(v || ""); var m = v.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/); return m ? m[1] : ""; }
  function rentalEstimate(b) {
    var from = new Date(b.from), to = new Date(b.to);
    if (isNaN(from) || isNaN(to) || to <= from || String(b.veh || "").toLowerCase().indexOf("renault master") === -1) return "";
    var days = Math.max(1, Math.ceil((to - from) / 86400000));
    return days + " × 24 h · viraussiichtlech " + (days * 100) + " €";
  }
  function inspectionFor(id, stage) { return inspections.filter(function (x) { return Number(x.bookingId) === Number(id) && x.stage === stage; })[0] || null; }
  function nowLocal() { var d=new Date(), z=function(n){return n<10?"0"+n:n;}; return d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate())+"T"+z(d.getHours())+":"+z(d.getMinutes()); }
  function protocolPhotoList(value) { return String(value||"").split("\n").map(function(v){return v.trim();}).filter(function(v){return /^https:\/\/garage-admin\.autoservicebettenduerf\.lu\/media\/protocol\//.test(v);}); }
  function protocolPhotosHtml(p,value) { var urls=protocolPhotoList(value); return '<div class="protocol-photo-list" id="'+p+'photo-list">'+urls.map(function(url,i){return '<div class="protocol-photo"><img src="'+url+'" alt="Protokollfoto '+(i+1)+'"><button type="button" data-remove-photo="'+i+'" aria-label="Foto ewechhuelen">×</button></div>';}).join('')+'</div>'; }
  function inspectionChecklist(x) { try { return JSON.parse(x.checklistJson || "{}"); } catch (e) { return {}; } }
  function damageMarkers(value) { return Array.isArray(value) ? value.filter(function(m){return m&&isFinite(m.x)&&isFinite(m.y);}).slice(0,30).map(function(m){return m.v===2?m:{x:Number(m.x)*2,y:Number(m.y)*2.75,type:m.type,note:m.note,v:2};}) : []; }
  function damageDiagramSvg(markers,kind,interactive) {
    markers=damageMarkers(markers);
    kind=kind==="trailer"?"trailer":(kind==="car"?"car":"van");var trailer=kind==="trailer";
    var carSide='<path d="M45 92l22-40c7-12 18-20 32-22l82-11c27-4 51 4 70 22l28 27 65 14c17 4 28 18 28 35v12H28v-15c0-12 7-20 17-22z"/><path d="M93 50l88-12c18-2 34 3 47 15l16 17H78zM181 38v32M38 91h325M43 111h315"/><circle cx="94" cy="129" r="25"/><circle cx="300" cy="129" r="25"/><path class="damage-detail" d="M119 70v41M260 70v41M276 88h20M61 98h20M334 96h21"/>';
    var carEnd='<path d="M55 43c6-19 21-31 41-33h108c20 2 35 14 41 33l13 49v69H42V92z"/><path d="M71 49h158l12 42H59zM62 105h176M79 122h142M64 151h172"/><circle cx="74" cy="156" r="13"/><circle cx="226" cy="156" r="13"/><rect x="113" y="127" width="74" height="22" rx="4"/><path class="damage-detail" d="M52 91h18M230 91h18M84 60v27M216 60v27"/>';
    var trailerSide='<rect x="48" y="40" width="270" height="102" rx="9"/><path d="M318 91h40l28 23M70 40V22h226v18M70 67h226M183 40v102"/><circle cx="105" cy="150" r="20"/><circle cx="265" cy="150" r="20"/><path class="damage-detail" d="M58 119h250M88 79h72M206 79h72"/>';
    var trailerEnd='<rect x="62" y="27" width="176" height="132" rx="8"/><path d="M62 57h176M150 27v132M87 78h45M168 78h45M78 129h144"/><circle cx="92" cy="159" r="13"/><circle cx="208" cy="159" r="13"/>';
    var side=trailer?trailerSide:carSide,end=trailer?trailerEnd:carEnd;
    var body='<g class="damage-panel"><rect x="18" y="18" width="374" height="236" rx="14"/><text class="damage-view-label" x="38" y="48">LÉNK SÄIT</text><g class="damage-shape" transform="translate(18 60) scale(.92)">'+side+'</g></g>'+
      '<g class="damage-panel"><rect x="408" y="18" width="374" height="236" rx="14"/><text class="damage-view-label" x="428" y="48">RIETS SÄIT</text><g class="damage-shape" transform="translate(772 60) scale(-.92 .92)">'+side+'</g></g>'+
      '<g class="damage-panel"><rect x="18" y="270" width="374" height="236" rx="14"/><text class="damage-view-label" x="38" y="300">VIR</text><g class="damage-shape" transform="translate(75 315) scale(.82)">'+end+'</g><path class="damage-direction" d="M176 304h58m0 0l-10-7m10 7l-10 7"/></g>'+
      '<g class="damage-panel"><rect x="408" y="270" width="374" height="236" rx="14"/><text class="damage-view-label" x="428" y="300">HANNEN</text><g class="damage-shape damage-rear" transform="translate(465 315) scale(.82)">'+end+'</g><path class="damage-direction" d="M566 304h58m-58 0l10-7m-10 7l10 7"/></g>';
    if(!trailer){body='<image class="damage-blueprint" href="../assets/damage-diagram-'+kind+'.png" x="20" y="22" width="760" height="500" preserveAspectRatio="xMidYMid meet"/>'+['LÉNK SÄIT','RIETS SÄIT','VIR','HANNEN'].map(function(label,i){var x=i%2?420:30,y=i>1?286:34;return '<g class="damage-label"><rect x="'+x+'" y="'+y+'" width="128" height="30" rx="15"/><text x="'+(x+64)+'" y="'+(y+20)+'" text-anchor="middle">'+label+'</text></g>';}).join('');}
    return '<svg class="damage-svg" viewBox="0 0 800 550" role="img" aria-label="'+(trailer?'Unhänger':'Gefier')+' vu lénks, riets, vir an hannen fir Schied ze markéieren" data-damage-surface="1">'+body+markers.map(function(m,i){return '<g class="damage-marker" data-damage-index="'+i+'" transform="translate('+Number(m.x).toFixed(1)+' '+Number(m.y).toFixed(1)+')"><circle r="15"/><text y="5" text-anchor="middle">'+(i+1)+'</text></g>';}).join('')+(interactive?'<text class="damage-tip" x="400" y="536" text-anchor="middle">Déi genee Plaz an der richteger Vue antippen</text>':'')+'</svg>';
  }
  function damageDiagramHtml(p,markers,kind) {
    markers=damageMarkers(markers);
    return '<div class="damage-map wide" id="'+p+'damage-map" data-diagram-kind="'+kind+'"><div class="damage-map-head"><div><strong>Visuell Schueddokumentatioun</strong><span>Tippt déi genee Plaz an der richteger Vue un.</span></div><span class="damage-count" id="'+p+'damage-count">'+markers.length+' Markéierung(en)</span></div>'+damageDiagramSvg(markers,kind,true)+'<div class="damage-items" id="'+p+'damage-items"></div><input type="hidden" id="'+p+'damage-markers" value="'+esc(JSON.stringify(markers))+'"></div>';
  }
  function renderDamageEditor(p,kind) {
    var input=$(p+'damage-markers'),wrap=$(p+'damage-map');if(!input||!wrap)return;
    var markers=[];try{markers=damageMarkers(JSON.parse(input.value||'[]'));}catch(e){}
    var old=wrap.querySelector('.damage-svg');if(old)old.outerHTML=damageDiagramSvg(markers,kind,true);
    var list=$(p+'damage-items');list.innerHTML=markers.map(function(m,i){return '<div class="damage-item"><span class="damage-number">'+(i+1)+'</span><select data-damage-type="'+i+'">'+['Kratzer','Delle','Lackschued','Rëss / Broch','Felg / Pneu','Aneres'].map(function(v){return '<option'+(m.type===v?' selected':'')+'>'+v+'</option>';}).join('')+'</select><input data-damage-note="'+i+'" maxlength="120" value="'+esc(m.note||'')+'" placeholder="Kuerz Beschreiwung"><button type="button" data-damage-remove="'+i+'" aria-label="Markéierung läschen">×</button></div>';}).join('');
    $(p+'damage-count').textContent=markers.length+' Markéierung(en)';input.value=JSON.stringify(markers);
    var svg=wrap.querySelector('.damage-svg');svg.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('.damage-marker'))return;var r=svg.getBoundingClientRect(),x=(e.clientX-r.left)*800/r.width,y=(e.clientY-r.top)*550/r.height;if(y>515)return;markers.push({x:Math.max(16,Math.min(784,x)),y:Math.max(16,Math.min(510,y)),type:'Kratzer',note:'',v:2});input.value=JSON.stringify(markers);renderDamageEditor(p,kind);});
    list.querySelectorAll('[data-damage-type]').forEach(function(el){el.addEventListener('change',function(){markers[+el.dataset.damageType].type=el.value;input.value=JSON.stringify(markers);});});
    list.querySelectorAll('[data-damage-note]').forEach(function(el){el.addEventListener('input',function(){markers[+el.dataset.damageNote].note=el.value;input.value=JSON.stringify(markers);});});
    list.querySelectorAll('[data-damage-remove]').forEach(function(el){el.addEventListener('click',function(){markers.splice(+el.dataset.damageRemove,1);input.value=JSON.stringify(markers);renderDamageEditor(p,kind);});});
  }
  var KM_RATE = 0.30; // €/km fir Zousaz-Kilometer (Renault Master)
  function kmEur(km,rate) { return (Math.max(0, Number(km) || 0) * (Number(rate)||KM_RATE)); }
  function eurTxt(n) { return (Math.round(n * 100) / 100).toFixed(2).replace(".", ",") + " €"; }
  function protocolHtml(b, stage) {
    var x=inspectionFor(b.id,stage)||{}, p="pr-"+b.id+"-"+stage+"-", pickup=stage==="pickup", title=pickup?"Iwwergabprotokoll":"Retourprotokoll",storedSignature=/^https:\/\/garage-admin\.autoservicebettenduerf\.lu\/media\/protocol\//.test(x.customerSignature||"")?x.customerSignature:"",storedStaffSignature=/^https:\/\/garage-admin\.autoservicebettenduerf\.lu\/media\/protocol\//.test(x.staffSignature||"")?x.staffSignature:"",f=matchFleet(b.veh)||{},trailer=f.type==="trailer",diagramKind=trailer?"trailer":(f.type==="car"?"car":"van"),c=inspectionChecklist(x),snap=parseBookingSnapshot(b),kmRate=snap&&snap.items?snap.items.reduce(function(v,i){return v||Number(i.extraKmRate||0);},0):KM_RATE;
    return '<div class="protocol-box"><h4>'+title+(x.id?' <span class="protocol-saved">✓ gespäichert</span>':'')+'</h4><div class="protocol-grid">'+
      '<div class="protocol-section">Basisdaten</div>'+
      '<label>Zäitpunkt<input id="'+p+'at" type="datetime-local" value="'+esc(dtLocal(x.inspectedAt)||nowLocal())+'"></label>'+
      (trailer?'':'<label>Kilometerstand<input id="'+p+'km" type="number" min="0" inputmode="numeric" value="'+esc(x.odometer==null?'':x.odometer)+'"></label><label>Brennstoff- / Luedstand<select id="'+p+'fuel">'+["Voll / 100 %","3/4 / 75 %","1/2 / 50 %","1/4 / 25 %","Eidel / 0 %"].map(function(v){return '<option'+(x.fuelLevel===v?' selected':'')+'>'+v+'</option>';}).join('')+'</select></label>')+
      '<label>Unzuel Schlësselen<input id="'+p+'keys" type="number" min="0" max="10" inputmode="numeric" value="'+esc(c.keyCount==null?'':c.keyCount)+'"></label>'+
      (pickup?'':'<label>Zousaz-km<input id="'+p+'extraKm" type="number" min="0" value="'+esc(x.extraKm==null?'':x.extraKm)+'"><small id="'+p+'extraKmEur" data-km-rate="'+esc(kmRate||KM_RATE)+'" style="display:block;color:var(--muted);font-size:0.72rem;margin-top:3px">× '+eurTxt(kmRate||KM_RATE)+'/km = '+eurTxt(kmEur(x.extraKm,kmRate))+'</small></label><label>Aner Käschten (€)<input id="'+p+'extraCosts" type="number" min="0" step="0.01" value="'+esc(x.extraCosts==null?'':x.extraCosts)+'"><small style="display:block;color:var(--muted);font-size:0.72rem;margin-top:3px">Sprit, Verspéidung, Botzen … (ouni km)</small></label>')+
      '<div class="protocol-section">Kontroll</div>'+
      '<label>Propretéit<select id="'+p+'cleanliness">'+["Propper","Liicht verschmotzt","Staark verschmotzt"].map(function(v){return '<option'+(c.cleanliness===v?' selected':'')+'>'+v+'</option>';}).join('')+'</select></label>'+
      '<div class="protocol-checks"><label class="protocol-check"><input id="'+p+'documents" type="checkbox"'+(c.documentsChecked?' checked':'')+'> Dokumenter kontrolléiert</label><label class="protocol-check"><input id="'+p+'lights" type="checkbox"'+(c.lightsChecked?' checked':'')+'> Beliichtung kontrolléiert</label><label class="protocol-check"><input id="'+p+'tyres" type="checkbox"'+(c.tyresChecked?' checked':'')+'> Pneuen a Rieder kontrolléiert</label><label class="protocol-check"><input id="'+p+'joint" type="checkbox"'+(c.jointInspection?' checked':'')+'> Zesumme mam Client kontrolléiert</label></div>'+
      '<label class="wide">Allgemengen Zoustand<textarea id="'+p+'condition" rows="2" placeholder="Kuerz a sachlech beschreiwen">'+esc(x.conditionNote||'')+'</textarea></label>'+
      '<label class="wide">'+(pickup?'Besteeënd Schied / Feststellungen':'Nei Schied / Feststellungen')+'<textarea id="'+p+'damage" rows="2" placeholder="Positioun, Aart an Ëmfang uginn; wann näischt: Keng">'+esc(x.damageNote||'')+'</textarea></label>'+
      damageDiagramHtml(p,c.damageMarkers,diagramKind)+
      '<label class="wide">Schlësselen, Dokumenter an Ekipement<textarea id="'+p+'accessories" rows="2" placeholder="z.B. 2 Schlësselen, Pabeieren, Sécherheetswest, Spannriemen">'+esc(x.accessories||'')+'</textarea></label>'+
      '<div class="protocol-section">Fotodokumentatioun</div><p class="protocol-help">Recommandéiert: vir, hannen, béid Säiten, Cockpit/Zielerstand an all Schued. Dës Fotoe sinn nëmme fir ageloggt Personal zougänglech.</p>'+
      '<div class="wide"><div class="protocol-photo-actions"><button class="btn btn-outline btn-sm" type="button" id="'+p+'camera-btn">📷 Foto maachen</button><button class="btn btn-outline btn-sm" type="button" id="'+p+'gallery-btn">Biller auswielen</button></div><input id="'+p+'camera" type="file" accept="image/*" capture="environment" hidden><input id="'+p+'gallery" type="file" accept="image/*" multiple hidden><textarea id="'+p+'photos" hidden>'+esc(x.photoRefs||'')+'</textarea><p class="fleet-photo-note" id="'+p+'photo-status"></p>'+protocolPhotosHtml(p,x.photoRefs)+'</div>'+
      '<div class="protocol-section">Bestätegung</div>'+
      '<label>Numm vum Mataarbechter<input id="'+p+'staff" value="'+esc(x.staffName||x.updatedBy||session.name||'')+'"></label>'+
      (pickup?'<label class="protocol-check"><input id="'+p+'license" type="checkbox"'+(x.licenseChecked?' checked':'')+'> Führerschäin an Identitéit kontrolléiert</label>':'')+
      '<label class="wide">Intern Notiz<textarea id="'+p+'note" rows="2">'+esc(x.note||'')+'</textarea></label>'+
      '<div class="signature-wrap"><strong>Ënnerschrëft vum Client · '+esc(b.name)+'</strong><p class="protocol-help">D’Ënnerschrëft bestätegt, datt den hei dokumentéierten Zoustand zesumme kontrolléiert gouf.</p><canvas class="signature-pad" id="'+p+'signature" data-existing="'+encodeURIComponent(storedSignature)+'" aria-label="Ënnerschrëft vum Client"></canvas>'+(storedSignature?'<img class="signature-existing" id="'+p+'signature-existing" src="'+storedSignature+'" alt="Gespäichert Ënnerschrëft vum Client">':'')+'<div class="signature-tools"><span>De Client kann hei mam Fanger ënnerschreiwen.</span><button class="btn btn-outline btn-sm" type="button" id="'+p+'signature-clear">Läschen</button></div></div>'+
      '<div class="signature-wrap"><strong>Ënnerschrëft vum Verléiner · Autoservice Bettenduerf</strong><p class="protocol-help">De Mataarbechter bestätegt d’Iwwergab respektiv de Retour an den dokumentéierten Zoustand.</p><canvas class="signature-pad" id="'+p+'staff-signature" data-existing="'+encodeURIComponent(storedStaffSignature)+'" aria-label="Ënnerschrëft vum Verléiner"></canvas>'+(storedStaffSignature?'<img class="signature-existing" id="'+p+'staff-signature-existing" src="'+storedStaffSignature+'" alt="Gespäichert Ënnerschrëft vum Verléiner">':'')+'<div class="signature-tools"><span>De Verléiner ënnerschreift hei mam Fanger.</span><button class="btn btn-outline btn-sm" type="button" id="'+p+'staff-signature-clear">Läschen</button></div></div></div>'+
      '<div class="b-actions"><button class="btn btn-ok btn-sm" data-save-protocol="'+b.id+'" data-stage="'+stage+'">Protokoll späicheren</button><button class="btn btn-outline btn-sm" data-close-protocol="1">Zoumaachen</button></div></div>';
  }
  function drawSignaturePad(canvas) { var rect=canvas.getBoundingClientRect(),dpr=Math.max(1,window.devicePixelRatio||1),ctx;canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));ctx=canvas.getContext("2d");ctx.scale(dpr,dpr);ctx.strokeStyle="#111827";ctx.lineWidth=2.2;ctx.lineCap="round";ctx.lineJoin="round";var drawing=false;function pos(e){var r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}canvas.addEventListener("pointerdown",function(e){drawing=true;canvas.setPointerCapture(e.pointerId);var q=pos(e);ctx.beginPath();ctx.moveTo(q.x,q.y);canvas._signed=true;var old=$(canvas.id+"-existing");if(old)old.hidden=true;e.preventDefault();});canvas.addEventListener("pointermove",function(e){if(!drawing)return;var q=pos(e);ctx.lineTo(q.x,q.y);ctx.stroke();e.preventDefault();});function stop(){drawing=false;}canvas.addEventListener("pointerup",stop);canvas.addEventListener("pointercancel",stop);}
  function refreshProtocolPhotos(p) { var box=$(p+"photo-list"),urls=protocolPhotoList($(p+"photos").value),status=$(p+"photo-status");box.innerHTML=urls.map(function(url,i){return '<div class="protocol-photo"><img src="'+url+'" alt="Protokollfoto '+(i+1)+'"><button type="button" data-remove-photo="'+i+'" aria-label="Foto ewechhuelen">×</button></div>';}).join('');if(status)status.textContent=urls.length?urls.length+' Foto(en) gespäichert'+(urls.length<6?' · 6 Perspektive recommandéiert':' · Dokumentatioun komplett'):'Nach keng Foto · 6 Perspektive recommandéiert';box.querySelectorAll("[data-remove-photo]").forEach(function(btn){btn.addEventListener("click",function(){urls.splice(parseInt(btn.getAttribute("data-remove-photo"),10),1);$(p+"photos").value=urls.join("\n");refreshProtocolPhotos(p);});}); }
  function addProtocolPhotos(p,files) { var status=$(p+"photo-status"),list=Array.prototype.slice.call(files||[]);if(!list.length)return;status.textContent="Fotoe ginn eropgelueden …";Promise.all(list.map(function(file){return resizeFleetPhoto(file).then(function(blob){return STORE.uploadProtocolImage(blob);});})).then(function(results){var urls=protocolPhotoList($(p+"photos").value);results.forEach(function(r){if(r&&r.url)urls.push(r.url);});$(p+"photos").value=urls.join("\n");refreshProtocolPhotos(p);status.textContent="✓ "+results.length+" Foto(en) eropgelueden.";}).catch(function(){status.textContent="E Foto konnt net eropgeluede ginn. Probéiert nach eng Kéier.";}); }
  function clearSignaturePad(canvas) { var ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);canvas._signed=false;canvas.dataset.existing="";var old=$(canvas.id+"-existing");if(old)old.hidden=true; }
  function initProtocolUi(b,stage) { var p="pr-"+b.id+"-"+stage+"-",canvas=$(p+"signature"),staffCanvas=$(p+"staff-signature"),f=matchFleet(b.veh)||{},kind=f.type==="trailer"?"trailer":(f.type==="car"?"car":"van");if(!canvas||!staffCanvas)return;renderDamageEditor(p,kind);drawSignaturePad(canvas);drawSignaturePad(staffCanvas);refreshProtocolPhotos(p);$(p+"camera-btn").addEventListener("click",function(){$(p+"camera").click();});$(p+"gallery-btn").addEventListener("click",function(){$(p+"gallery").click();});[$(p+"camera"),$(p+"gallery")].forEach(function(inp){inp.addEventListener("change",function(){addProtocolPhotos(p,inp.files);inp.value="";});});$(p+"signature-clear").addEventListener("click",function(){clearSignaturePad(canvas);});$(p+"staff-signature-clear").addEventListener("click",function(){clearSignaturePad(staffCanvas);});if(stage==="return"){var ek=$(p+"extraKm"),lbl=$(p+"extraKmEur"),rate=Number(lbl&&lbl.dataset.kmRate)||KM_RATE;if(ek&&lbl){var upd=function(){lbl.textContent="× "+eurTxt(rate)+"/km = "+eurTxt(kmEur(ek.value,rate));};ek.addEventListener("input",upd);upd();}} }
  function signatureBlob(canvas) { return new Promise(function(resolve){canvas.toBlob(function(blob){resolve(blob);},"image/webp",.9);}); }

  /* ---------- Professionellt Protokoll-PDF (iwwer Drécken → "Als PDF späicheren") ---------- */
  var fleetCache = null;
  function ensureFleetCache() { if (fleetCache) return Promise.resolve(fleetCache); return STORE.listMaintenance().then(function (i) { fleetCache = i || []; return fleetCache; }, function () { fleetCache = []; return fleetCache; }); }
  function matchFleet(veh) { var k = String(veh || "").toLowerCase().trim(); if (!k) return null; var list=fleetCache||[],hit=list.filter(function (m) { var mv = String(m.vehicle || "").toLowerCase().trim(); return mv && (mv === k || k.indexOf(mv) !== -1 || mv.indexOf(k) !== -1); })[0];if(hit)return hit;var type=/transporter|lieferwagen|utilitaire|\bvan\b/.test(k)?"van":/anhänger|unhänger|remorque|trailer/.test(k)?"trailer":/personenwagen|voiture|\bauto\b|\bcar\b/.test(k)?"car":"",same=type?list.filter(function(m){return (m.type||"van")===type;}):[];return same.length===1?same[0]:null; }
  function ppRow(label, val) { return val ? '<tr><th>' + esc(label) + '</th><td>' + esc(val) + '</td></tr>' : ""; }
  function printProtocol(b, stage) {
    var p = "pr-" + b.id + "-" + stage + "-", pickup = stage === "pickup";
    ensureFleetCache().then(function () {
      var f = matchFleet(b.veh) || {};
      var rateSnap=parseBookingSnapshot(b), protocolKmRate=rateSnap&&rateSnap.items?rateSnap.items.reduce(function(v,i){return v||Number(i.extraKmRate||0);},0):KM_RATE;
      var val = function (id) { var e = $(p + id); return e ? e.value : ""; };
      var km = val("km"), fuel = val("fuel"), at = val("at"), condition = val("condition"), damage = val("damage"), accessories = val("accessories"), staff = val("staff"), note = val("note");
      var trailer = f.type === "trailer", diagramKind=trailer?"trailer":(f.type==="car"?"car":"van"), cleanliness = val("cleanliness"), keys = val("keys");
      var extraKm = pickup ? "" : val("extraKm"), extraCosts = pickup ? "" : val("extraCosts");
      var licenseChecked = pickup && $(p + "license") ? $(p + "license").checked : false;
      var checkText = [$(p+"documents").checked?"Dokumenter":"",$(p+"lights").checked?"Beliichtung":"",$(p+"tyres").checked?"Pneuen/Rieder":"",$(p+"joint").checked?"zesumme mam Client":""].filter(Boolean).join(", ");
      var photos = protocolPhotoList($(p + "photos") ? $(p + "photos").value : "");
      var sigEl = $(p + "signature"), staffSigEl=$(p+"staff-signature"), sigUrl = "", staffSigUrl="";
      try { var ex = decodeURIComponent((sigEl && sigEl.dataset.existing) || ""); if (/^https:/.test(ex)) sigUrl = ex; } catch (e) {}
      if (sigEl && sigEl._signed) { try { sigUrl = sigEl.toDataURL("image/png"); } catch (e) {} }
      try { var staffEx=decodeURIComponent((staffSigEl&&staffSigEl.dataset.existing)||"");if(/^https:/.test(staffEx))staffSigUrl=staffEx; } catch(e) {}
      if(staffSigEl&&staffSigEl._signed){try{staffSigUrl=staffSigEl.toDataURL("image/png");}catch(e){}}
      var ref = refOf(b.id), title = pickup ? "Iwwergabprotokoll" : "Retourprotokoll";
      var carRows = ppRow("Locatiounsobjet", b.veh) + ppRow("Typ", trailer?"Unhänger":(f.type==="car"?"Auto":"Transporter")) + ppRow("Baujoer", f.year) + ppRow("Brennstoff / Undriff", trailer?"":f.fuel) + ppRow(trailer?"Dimensiounen":"Luedraum", f.loadSpace) + ppRow("Führerschäin", f.licenseClass);
      var stateRows = ppRow("Datum / Zäit", at ? fmt(at) : "") + ppRow("Kilometerstand", km ? km + " km" : "") + ppRow("Brennstoff- / Luedstand", fuel) + ppRow("Schlësselen", keys) + ppRow("Propretéit", cleanliness) + ppRow("Kontrolléiert", checkText) +
        (pickup ? ppRow("Führerschäin & Identitéit kontrolléiert", licenseChecked ? "Jo" : "Nee") : (ppRow("Zousaz-Kilometer", extraKm ? extraKm + " km (" + eurTxt(kmEur(extraKm,protocolKmRate)) + ")" : "") + ppRow("Aner Käschten", extraCosts ? eurTxt(extraCosts) : "") + ppRow("Zousaz total", (kmEur(extraKm,protocolKmRate) + (Number(extraCosts) || 0)) ? eurTxt(kmEur(extraKm,protocolKmRate) + (Number(extraCosts) || 0)) : "")));
      var photoHtml = photos.length ? '<div class="pp-sec"><h3>Fotoen</h3><div class="pp-photos">' + photos.map(function (u) { return '<img src="' + u + '" alt="">'; }).join("") + "</div></div>" : "";
      var html =
        '<div class="pp-doc">' +
        '<div class="pp-head"><img class="pp-logo" src="../assets/autoservice-bettenduerf-logo.png" alt="Autoservice Bettenduerf"><div class="pp-co"><strong>Autoservice Bettenduerf</strong><br>63, rue de Diekirch-Echternach · L-9355 Bettendorf<br>+352 80 86 87 · Autoservicebettenduerf@outlook.com</div></div><div class="pp-accent"></div><div class="pp-main">' +
        '<div class="pp-titlebar"><h1>' + title + '</h1><div class="pp-ref">Réf. ' + esc(ref) + '<br>' + esc(fmt(new Date().toISOString())) + "</div></div>" +
        '<div class="pp-cols">' +
        '<div class="pp-sec"><h3>Client</h3><table class="pp-tbl">' + ppRow("Numm", b.name) + ppRow("E-Mail", b.email) + ppRow("Telefon", b.phone) + "</table></div>" +
        '<div class="pp-sec"><h3>Locatiounsobjet</h3><table class="pp-tbl">' + carRows + "</table></div>" +
        "</div>" +
        '<div class="pp-sec"><h3>Locatiounszäitraum</h3><table class="pp-tbl">' + ppRow("Vun", fmt(b.from)) + ppRow("Bis", fmt(b.to)) + "</table></div>" +
        '<div class="pp-sec"><h3>Zoustand bei der ' + (pickup ? "Iwwergab" : "Retour") + '</h3><table class="pp-tbl">' + stateRows + "</table>" +
        (condition ? '<p><strong>Allgemengen Zoustand:</strong> ' + esc(condition) + "</p>" : "") +
        (damage ? '<p><strong>Schied / Feststellungen:</strong> ' + esc(damage) + "</p>" : "") +
        (function(){var raw=$(p+'damage-markers'),marks=[];try{marks=damageMarkers(JSON.parse(raw?raw.value:'[]'));}catch(e){}return '<div class="pp-damage"><strong>Visuell Schuedmarkéierungen</strong>'+damageDiagramSvg(marks,diagramKind,false)+(marks.length?'<ol>'+marks.map(function(m){return '<li><b>'+esc(m.type||'Schued')+':</b> '+esc(m.note||'keng Zousaznotiz')+'</li>';}).join('')+'</ol>':'<p class="pp-no-damage">Kee Schued op der Skizz markéiert.</p>')+'</div>';})() +
        (accessories ? '<p><strong>Schlësselen, Dokumenter an Ekipement:</strong> ' + esc(accessories) + "</p>" : "") +
        "</div>" +
        photoHtml +
        '<div class="pp-sec pp-terms"><h3>Bestätegung</h3><p>Dëse Protokoll dokumentéiert de gemeinsam festgestallten Zoustand beim ' + (pickup?'Ufank':'Enn') + ' vun der Locatioun. D’Ënnerschrëft bestätegt d’Kontroll an déi hei festgehalen Informatiounen.</p></div>' +
        '<div class="pp-sign"><div><span class="pp-sigbox">' + (sigUrl ? '<img src="' + sigUrl + '" alt="">' : "") + '</span><div class="pp-sigline">Ënnerschrëft vum Client · ' + esc(b.name) + "</div></div>" +
        '<div><span class="pp-sigbox">' + (staffSigUrl ? '<img src="' + staffSigUrl + '" alt="">' : "") + '</span><div class="pp-sigline">Autoservice Bettenduerf</div></div></div>' +
        '<footer class="pp-foot">Autoservice Bettenduerf · 63, rue de Diekirch-Echternach · L-9355 Bettendorf · +352 80 86 87 · autoservicebettenduerf.lu</footer>' +
        "</div></div>";
      if (isStandalonePWA()) { openDocStandalone(html); return; }
      var root = $("protocol-print-root"); if (!root) return;
      root.innerHTML = '<div class="pp-bar pp-noprint"><span class="pp-hint" id="pp-status">Biller gi fir d’PDF virbereet …</span><button type="button" class="btn btn-primary btn-sm" id="pp-print" disabled>🖨️ Drécken / PDF</button><button type="button" class="btn btn-ghost btn-sm" id="pp-close">Zoumaachen</button></div>' + html;
      root.classList.add("open");
      document.body.classList.add("protocol-printing");
      document.body.style.overflow = "hidden";
      function close() { root.classList.remove("open"); document.body.classList.remove("protocol-printing"); document.body.style.overflow = ""; root.innerHTML = ""; }
      $("pp-close").addEventListener("click", close);
      root.addEventListener("click", function (e) { if (e.target === root) close(); });
      var imgs=Array.prototype.slice.call(root.querySelectorAll(".pp-doc img")),printBtn=$("pp-print"),status=$("pp-status");
      Promise.all(imgs.map(function(img){return img.complete?Promise.resolve(img.naturalWidth>0):new Promise(function(resolve){img.addEventListener("load",function(){resolve(true);},{once:true});img.addEventListener("error",function(){resolve(false);},{once:true});});})).then(function(results){var failed=results.filter(function(ok){return !ok;}).length;printBtn.disabled=false;status.textContent=failed?failed+" Bild(er) konnten net geluede ginn — kontrolléiert d’Virschau.":"Virschau komplett — elo drécken oder als PDF späicheren.";});
      printBtn.addEventListener("click", printDocEl);
    });
  }
  function printCombinedProtocol(b) {
    var pickup=inspectionFor(b.id,"pickup"),returned=inspectionFor(b.id,"return");
    if(!pickup||!returned||!pickup.customerSignature||!returned.customerSignature){toast("Iwwergab a Retour musse fir d'éischt gespäichert an ënnerschriwwe sinn.");return;}
    ensureFleetCache().then(function(){
      var f=matchFleet(b.veh)||{},trailer=f.type==="trailer",diagramKind=trailer?"trailer":(f.type==="car"?"car":"van"),ref=refOf(b.id);
      var rateSnap=parseBookingSnapshot(b), protocolKmRate=rateSnap&&rateSnap.items?rateSnap.items.reduce(function(v,i){return v||Number(i.extraKmRate||0);},0):KM_RATE;
      function yn(v){return v?"Jo":"Nee";}
      function stageHtml(x,pickupStage){
        var c=inspectionChecklist(x),photos=protocolPhotoList(x.photoRefs),checks=[c.documentsChecked?"Dokumenter":"",c.lightsChecked?"Beliichtung":"",c.tyresChecked?"Pneuen/Rieder":"",c.jointInspection?"zesumme mam Client":""].filter(Boolean).join(", ");
        var rows=ppRow("Datum / Zäit",fmt(x.inspectedAt))+ppRow("Kilometerstand",trailer?"":(x.odometer==null?"":x.odometer+" km"))+ppRow("Brennstoff- / Luedstand",trailer?"":x.fuelLevel)+ppRow("Schlësselen",c.keyCount)+ppRow("Propretéit",c.cleanliness)+ppRow("Kontrolléiert",checks)+(pickupStage?ppRow("Führerschäin & Identitéit",yn(x.licenseChecked)):ppRow("Zousaz-Kilometer",x.extraKm==null?"":x.extraKm+" km ("+eurTxt(kmEur(x.extraKm,protocolKmRate))+")")+ppRow("Aner Käschten",x.extraCosts==null?"":eurTxt(x.extraCosts))+ppRow("Zousaz total",(kmEur(x.extraKm,protocolKmRate)+(Number(x.extraCosts)||0))?eurTxt(kmEur(x.extraKm,protocolKmRate)+(Number(x.extraCosts)||0)):""));
        var marks=damageMarkers(c.damageMarkers),map='<div class="pp-damage"><strong>Visuell Schuedmarkéierungen</strong>'+damageDiagramSvg(marks,diagramKind,false)+(marks.length?'<ol>'+marks.map(function(m){return '<li><b>'+esc(m.type||'Schued')+':</b> '+esc(m.note||'keng Zousaznotiz')+'</li>';}).join('')+'</ol>':'<p class="pp-no-damage">Kee Schued op der Skizz markéiert.</p>')+'</div>';
        return '<section class="pp-stage"><div class="pp-stage-title"><span>'+(pickupStage?"1":"2")+'</span><div><small>'+(pickupStage?"UFANK VUN DER LOCATIOUN":"ENN VUN DER LOCATIOUN")+'</small><h2>'+(pickupStage?"Iwwergab":"Retour")+'</h2></div></div><div class="pp-sec"><h3>Zoustand</h3><table class="pp-tbl">'+rows+'</table>'+(x.conditionNote?'<p><strong>Allgemengen Zoustand:</strong> '+esc(x.conditionNote)+'</p>':"")+(x.damageNote?'<p><strong>'+(pickupStage?"Besteeënd":"Nei")+' Schied / Feststellungen:</strong> '+esc(x.damageNote)+'</p>':"")+map+(x.accessories?'<p><strong>Schlësselen, Dokumenter an Ekipement:</strong> '+esc(x.accessories)+'</p>':"")+'</div>'+(photos.length?'<div class="pp-sec"><h3>Fotodokumentatioun · '+photos.length+' Foto(en)</h3><div class="pp-photos">'+photos.map(function(u,i){return '<img src="'+u+'" alt="'+(pickupStage?"Iwwergab":"Retour")+' Foto '+(i+1)+'">';}).join("")+'</div></div>':"")+'<div class="pp-sign pp-sign-single"><div><span class="pp-sigbox">'+(x.customerSignature?'<img src="'+x.customerSignature+'" alt="Ënnerschrëft Client">':'')+'</span><div class="pp-sigline">Ënnerschrëft Client · '+esc(b.name)+'</div></div><div><span class="pp-sigbox">'+(x.staffSignature?'<img src="'+x.staffSignature+'" alt="Ënnerschrëft Verléiner">':'')+'</span><div class="pp-sigline">Autoservice Bettenduerf</div></div></div></section>';
      }
      var distance="";if(!trailer&&pickup.odometer!=null&&returned.odometer!=null&&Number(returned.odometer)>=Number(pickup.odometer))distance=(Number(returned.odometer)-Number(pickup.odometer))+" km";
      var carRows=ppRow("Locatiounsobjet",b.veh)+ppRow("Typ",trailer?"Unhänger":(f.type==="car"?"Auto":"Transporter"))+ppRow("Baujoer",f.year)+ppRow("Brennstoff / Undriff",trailer?"":f.fuel)+ppRow(trailer?"Dimensiounen":"Luedraum",f.loadSpace)+ppRow("Führerschäin",f.licenseClass);
      var html='<div class="pp-doc pp-combined"><div class="pp-head"><img class="pp-logo" src="../assets/autoservice-bettenduerf-logo.png" alt="Autoservice Bettenduerf"><div class="pp-co"><strong>Autoservice Bettenduerf</strong><br>63, rue de Diekirch-Echternach · L-9355 Bettendorf<br>+352 80 86 87 · Autoservicebettenduerf@outlook.com</div></div><div class="pp-accent"></div><div class="pp-main"><div class="pp-titlebar"><h1>Ofschlossprotokoll</h1><div class="pp-ref">Réf. '+esc(ref)+'<br>'+esc(fmt(new Date().toISOString()))+'</div></div><div class="pp-cols"><div class="pp-sec"><h3>Client</h3><table class="pp-tbl">'+ppRow("Numm",b.name)+ppRow("E-Mail",b.email)+ppRow("Telefon",b.phone)+'</table></div><div class="pp-sec"><h3>Locatiounsobjet</h3><table class="pp-tbl">'+carRows+'</table></div></div><div class="pp-sec"><h3>Locatioun</h3><table class="pp-tbl">'+ppRow("Vun",fmt(b.from))+ppRow("Bis",fmt(b.to))+ppRow("Gefuer Distanz",distance)+'</table></div>'+stageHtml(pickup,true)+stageHtml(returned,false)+'<div class="pp-sec pp-terms"><h3>Bestätegung</h3><p>Dëst Ofschlossprotokoll vereent d’Iwwergab an de Retour. Déi zwou Ënnerschrëfte bestätegen déi jeeweils zesumme kontrolléiert an dokumentéiert Zoustänn.</p></div><footer class="pp-foot">Autoservice Bettenduerf · 63, rue de Diekirch-Echternach · L-9355 Bettendorf · +352 80 86 87 · autoservicebettenduerf.lu</footer></div></div>';
      if (isStandalonePWA()) { openDocStandalone(html); return; }
      var root=$("protocol-print-root");root.innerHTML='<div class="pp-bar pp-noprint"><span class="pp-hint" id="pp-status">Biller gi fir d’PDF virbereet …</span><button type="button" class="btn btn-primary btn-sm" id="pp-print" disabled>🖨️ Drécken / PDF</button><button type="button" class="btn btn-ghost btn-sm" id="pp-close">Zoumaachen</button></div>'+html;root.classList.add("open");document.body.classList.add("protocol-printing");document.body.style.overflow="hidden";
      function close(){root.classList.remove("open");document.body.classList.remove("protocol-printing");document.body.style.overflow="";root.innerHTML="";}$("pp-close").addEventListener("click",close);root.addEventListener("click",function(e){if(e.target===root)close();});
      var imgs=Array.prototype.slice.call(root.querySelectorAll(".pp-doc img")),btn=$("pp-print"),status=$("pp-status");Promise.all(imgs.map(function(img){return img.complete?Promise.resolve(img.naturalWidth>0):new Promise(function(resolve){img.addEventListener("load",function(){resolve(true);},{once:true});img.addEventListener("error",function(){resolve(false);},{once:true});});})).then(function(results){var failed=results.filter(function(ok){return !ok;}).length;btn.disabled=false;status.textContent=failed?failed+" Bild(er) konnten net geluede ginn — kontrolléiert d’Virschau.":"Iwwergab + Retour komplett — elo drécken oder als PDF späicheren.";});btn.addEventListener("click",printDocEl);
    });
  }
  function uploadSignature(canvas) { var existing=decodeURIComponent(canvas.dataset.existing||"");if(canvas._signed)return signatureBlob(canvas).then(function(blob){return STORE.uploadProtocolImage(blob);}).then(function(r){if(!r||r.error)throw new Error("signature_upload");return r.url;});return Promise.resolve(existing); }
  var protocolSaves = new Set();
  function saveProtocol(b, stage) {
    var key = b.id + ":" + stage;
    if (protocolSaves.has(key)) return;
    protocolSaves.add(key);
    try {
      return Promise.resolve(saveProtocolOnce(b, stage)).finally(function () { protocolSaves.delete(key); });
    } catch (error) { protocolSaves.delete(key); throw error; }
  }
  function saveProtocolOnce(b,stage) { var p="pr-"+b.id+"-"+stage+"-",pickup=stage==="pickup",canvas=$(p+"signature"),staffCanvas=$(p+"staff-signature"),photos=protocolPhotoList($(p+"photos").value),km=$(p+"km"),fuel=$(p+"fuel"),marks=[];try{marks=damageMarkers(JSON.parse($(p+'damage-markers').value||'[]'));}catch(e){}if(!$(p+"at").value||!$(p+"staff").value.trim()){toast("Zäitpunkt a Mataarbechter mussen ausgefëllt sinn.");return;}if(photos.length<4&&!confirm("Et si manner wéi 4 Fotoe gespäichert. Protokoll trotzdem späicheren?"))return;return Promise.all([uploadSignature(canvas),uploadSignature(staffCanvas)]).then(function(signatures){if(!signatures[0]){toast("D'Ënnerschrëft vum Client feelt.");return;}if(!signatures[1]){toast("D'Ënnerschrëft vum Verléiner feelt.");return;}return STORE.saveInspection({bookingId:b.id,stage:stage,inspectedAt:$(p+"at").value,odometer:km?km.value:"",fuelLevel:fuel?fuel.value:"",extraKm:pickup?"":$(p+"extraKm").value,extraCosts:pickup?"":$(p+"extraCosts").value,conditionNote:$(p+"condition").value,damageNote:$(p+"damage").value,photoRefs:$(p+"photos").value,accessories:$(p+"accessories").value,customerSignature:signatures[0],staffSignature:signatures[1],staffName:$(p+"staff").value.trim(),licenseChecked:pickup?$(p+"license").checked:false,note:$(p+"note").value,checklist:{keyCount:$(p+"keys").value,cleanliness:$(p+"cleanliness").value,documentsChecked:$(p+"documents").checked,lightsChecked:$(p+"lights").checked,tyresChecked:$(p+"tyres").checked,jointInspection:$(p+"joint").checked,damageMarkers:marks}});}).then(function(r){if(!r)return;if(r.error){toast(errMsg(r.error));return;}toast("Protokoll mat béiden Ënnerschrëfte gespäichert.");renderBookings();}).catch(function(){toast("D'Protokoll konnt net gespäichert ginn.");}); }
  /* ---------- Dokumenter: Mietvertrag + Blanko (selwecht Design wéi Protokoll) ---------- */
  function plateFor(veh) { return /renault\s+master|transporter|lieferwagen/i.test(String(veh || "")) ? "GK 0106" : ""; }
  function ppFill(label) { return '<tr><th>' + esc(label) + '</th><td style="border-bottom:1px dotted #94a3b8">&nbsp;</td></tr>'; }
  function blankLines(n) { var s = ""; for (var i = 0; i < n; i++) s += '<div style="border-bottom:1px dotted #94a3b8;height:17px;margin:7px 0"></div>'; return s; }
  function docLang(l) { return ["lb", "de", "fr", "en"].indexOf(l) >= 0 ? l : "lb"; }
  function docHead() { return '<div class="pp-head"><img class="pp-logo" src="../assets/autoservice-bettenduerf-logo.png" alt="Autoservice Bettenduerf"><div class="pp-co"><strong>Autoservice Bettenduerf</strong><br>63, rue de Diekirch-Echternach · L-9355 Bettendorf<br>+352 80 86 87 · Autoservicebettenduerf@outlook.com</div></div><div class="pp-accent"></div>'; }
  var DOC_I18N = {
    lb: { title:"Locatiounsvertrag", ref:"Réf.", secVermieter:"Verléiner", secMieter:"Locataire", secObjet:"Locatiounsobjet", secPeriod:"Locatiounszäitraum", secPrix:"Präis, Kautioun a Bezuelung", secTerms:"Konditiounen",
      firma:"Firma", adr:"Adress", tel:"Telefon", email:"E-Mail", rcs:"RCS / TVA", numm:"Numm", adrMieter:"Adress", dob:"Gebuertsdatum", licNo:"Führerschäin-Nr.", idNo:"Ausweis-Nr.",
      gefier:"Gefier", plaque:"Immatrikulatioun", typ:"Typ", baujoer:"Baujoer", kraftstoff:"Brennstoff", fs:"Führerschäin", kmStart:"Kilometerstand bei der Iwwergab",
      vun:"Vun", bis:"Bis", plaz:"Ofhuel- a Retourplaz", plazVal:"Autoservice Bettenduerf · Bettendorf",
      dag:"Dagespräis", dauer:"Locatiounsdauer", preis:"Locatiounspräis (viraussiichtlech)", inclKm:"Abegraff Kilometer", inclKmVal:"{included} km pro Locatioun", zKm:"Zousaz-km", perKm:"/ km", kaut:"Kautioun", bez:"Bezuelung", bezVal:"beim Retour vum Gefier", versp:"Verspéidung", verspVal:"{late} pro ugefaangener Stonn", tank:"Tanken", tankVal:"vollgetankt zréckbréngen, soss Tankkäschten + 50 €", h24:"× 24 h",
      typVan:"Transporter", typCar:"Auto", typTrailer:"Unhänger",
      dims:"Dimensiounen", gvw:"Gesamtgewiicht", payload:"Notzlaascht", brake:"Brems", braked:"Gebremst", unbraked:"Ongebremst", retCond:"Retour", retCondVal:"propper a sécher zréckbréngen", clause4Trailer:"<b>Retour & Zoustand.</b> Den Unhänger muss propper a betribsécher zréckkommen; d'Luedung muss uerdnungsgeméiss geséchert ginn. Schied oder feelend Deeler ginn no den tatsächleche Käschte verrechent.",
      place:"Zu Bettendorf, den", signMieter:"Ënnerschrëft vum Locataire", signVermieter:"Ënnerschrëft vum Verléiner",
      prep:"Dokument gëtt virbereet …", ready:"Fäerdeg — elo drécken oder als PDF späicheren.", printBtn:"🖨️ Drécken / PDF", closeBtn:"Zoumaachen",
      pTitlePickup:"Iwwergabprotokoll", pTitleReturn:"Retourprotokoll", pClient:"Client", pStatePickup:"Zoustand bei der Iwwergab", pStateReturn:"Zoustand bei der Retour",
      pDatum:"Datum / Zäit", pKm:"Kilometerstand", pFuel:"Brennstoff- / Luedstand", pKeys:"Unzuel Schlësselen", pClean:"Propretéit", fsCheck:"Führerschäin & Identitéit kontrolléiert", other:"Aner Käschten (€)",
      pCondition:"Allgemengen Zoustand:", pDamage:"Schied / Feststellungen:", pConfirmTitle:"Bestätegung", pConfirmText:"D'Ënnerschrëft bestätegt d'gemeinsam Kontroll an déi hei festgehalen Informatiounen.",
      clauses:[
        "<b>Ofschloss vum Vertrag.</b> Mat der Ënnerschrëft gëtt dëse Locatiounsvertrag verbindlech. De Locataire bestätegt, datt hien d'Gefier am Zoustand vum Iwwergabprotokoll iwwerholl huet.",
        "<b>Chauffeur.</b> E gültegt Identitéitsdokument an deen néidege Führerschäin goufe virgeluecht. D'Gefier dierf nëmme vun de Persoune gefouert ginn, déi an dësem Vertrag agedroe sinn.",
        "<b>Notzung.</b> Suergfälteg a bestëmmungsgeméiss Notzung. Keen Iwwerlueden, keng Weiderverlounung, keng gesetzeswiddreg Notzung. Faarten mat engem Unhänger oder an d'Ausland nëmme mat ausdrécklecher Erlaabnes.",
        "<b>Kilometer & Tanken.</b> {included} km pro Locatioun sinn abegraff; all weidere Kilometer gëtt mat {km} verrechent. D'Gefier muss vollgetankt zréckbruecht ginn, soss ginn d'Tankkäschten + 50 € Pauschal verrechent.",
        "<b>Retour & Verspéidung.</b> Retour zu där Zäit an op där Plaz, déi ofgemaach goufen. Pro ugefaangener Stonn Verspéidung gëtt {late} verrechent.",
        "<b>Kautioun & Bezuelung.</b> D'Kautioun bedréit 250 €; d'Bezuelung geschitt beim Retour vum Gefier.",
        "<b>Assurance & Haftung.</b> D'Gefier ass bei Foyer Assurances assuréiert; d'Selbstbedeelegung bedréit 750 € pro Schuedefall. Bei Accident, Pann, Déifstall oder Schued muss Autoservice Bettenduerf direkt informéiert ginn; keng Reparatur ouni Zoustëmmung.",
        "<b>Annulatioun.</b> Annulatioun bis 24 Stonne virum Ufank ass gratis. Ënner 24 Stonnen oder bei Net-Erschéine ginn 50 € verrechent.",
        "<b>Dateschutz.</b> D'perséinlech Donnéeë ginn eleng fir d'Ofwécklung vun der Locatioun veraarbecht (cf. Dateschutzerklärung op autoservicebettenduerf.lu)."
      ] },
    de: { title:"Mietvertrag", ref:"Ref.", secVermieter:"Vermieter", secMieter:"Mieter", secObjet:"Mietobjekt", secPeriod:"Mietzeitraum", secPrix:"Preis, Kaution und Zahlung", secTerms:"Bedingungen",
      firma:"Firma", adr:"Adresse", tel:"Telefon", email:"E-Mail", rcs:"RCS / USt-IdNr.", numm:"Name", adrMieter:"Adresse", dob:"Geburtsdatum", licNo:"Führerschein-Nr.", idNo:"Ausweis-Nr.",
      gefier:"Fahrzeug", plaque:"Kennzeichen", typ:"Typ", baujoer:"Baujahr", kraftstoff:"Kraftstoff", fs:"Führerschein", kmStart:"Kilometerstand bei Übergabe",
      vun:"Von", bis:"Bis", plaz:"Abhol- und Rückgabeort", plazVal:"Autoservice Bettenduerf · Bettendorf",
      dag:"Tagespreis", dauer:"Mietdauer", preis:"Mietpreis (voraussichtlich)", inclKm:"Enthaltene Kilometer", inclKmVal:"{included} km pro Miete", zKm:"Mehrkilometer", perKm:"/ km", kaut:"Kaution", bez:"Zahlung", bezVal:"bei Rückgabe des Fahrzeugs", versp:"Verspätung", verspVal:"{late} je angefangene Stunde", tank:"Betankung", tankVal:"vollgetankt zurück, sonst Volltankung + 50 €", h24:"× 24 h",
      typVan:"Transporter", typCar:"Auto", typTrailer:"Anhänger",
      dims:"Abmessungen", gvw:"Gesamtgewicht", payload:"Nutzlast", brake:"Bremse", braked:"Gebremst", unbraked:"Ungebremst", retCond:"Rückgabe", retCondVal:"sauber und sicher zurückbringen", clause4Trailer:"<b>Rückgabe & Zustand.</b> Der Anhänger ist sauber und betriebssicher zurückzugeben; die Ladung ist ordnungsgemäß zu sichern. Schäden oder fehlende Teile werden nach Aufwand berechnet.",
      place:"Bettendorf, den", signMieter:"Unterschrift Mieter", signVermieter:"Unterschrift Vermieter",
      prep:"Dokument wird vorbereitet …", ready:"Fertig — jetzt drucken oder als PDF speichern.", printBtn:"🖨️ Drucken / PDF", closeBtn:"Schließen",
      pTitlePickup:"Übergabeprotokoll", pTitleReturn:"Rückgabeprotokoll", pClient:"Kunde", pStatePickup:"Zustand bei Übergabe", pStateReturn:"Zustand bei Rückgabe",
      pDatum:"Datum / Uhrzeit", pKm:"Kilometerstand", pFuel:"Kraftstoff- / Ladestand", pKeys:"Anzahl Schlüssel", pClean:"Sauberkeit", fsCheck:"Führerschein & Identität geprüft", other:"Sonstige Kosten (€)",
      pCondition:"Allgemeiner Zustand:", pDamage:"Schäden / Feststellungen:", pConfirmTitle:"Bestätigung", pConfirmText:"Die Unterschrift bestätigt die gemeinsame Kontrolle und die hier festgehaltenen Angaben.",
      clauses:[
        "<b>Vertragsabschluss.</b> Mit der Unterschrift wird dieser Mietvertrag verbindlich. Der Mieter bestätigt, das Fahrzeug im Zustand des Übergabeprotokolls übernommen zu haben.",
        "<b>Fahrer.</b> Ein gültiges Ausweisdokument und der erforderliche Führerschein wurden vorgelegt. Das Fahrzeug darf nur von den in diesem Vertrag eingetragenen Personen geführt werden.",
        "<b>Nutzung.</b> Sorgfältige und bestimmungsgemäße Nutzung. Kein Überladen, keine Weitervermietung, keine rechtswidrige Nutzung. Fahrten mit Anhänger oder ins Ausland nur mit ausdrücklicher Erlaubnis.",
        "<b>Kilometer & Betankung.</b> {included} km pro Miete sind inbegriffen; jeder weitere Kilometer wird mit {km} berechnet. Das Fahrzeug ist vollgetankt zurückzubringen, andernfalls werden die Tankkosten + 50 € Pauschale berechnet.",
        "<b>Rückgabe & Verspätung.</b> Rückgabe zur vereinbarten Zeit und am vereinbarten Ort. Je angefangene Stunde Verspätung werden {late} berechnet.",
        "<b>Kaution & Zahlung.</b> Die Kaution beträgt 250 €; die Zahlung erfolgt bei der Rückgabe des Fahrzeugs.",
        "<b>Versicherung & Haftung.</b> Das Fahrzeug ist bei Foyer Assurances versichert; die Selbstbeteiligung beträgt 750 € je Schadenfall. Bei Unfall, Panne, Diebstahl oder Schaden ist Autoservice Bettenduerf unverzüglich zu informieren; keine Reparatur ohne Zustimmung.",
        "<b>Stornierung.</b> Eine Stornierung bis 24 Stunden vor Beginn ist kostenlos. Unter 24 Stunden oder bei Nichterscheinen werden 50 € berechnet.",
        "<b>Datenschutz.</b> Die personenbezogenen Daten werden ausschließlich zur Abwicklung der Vermietung verarbeitet (siehe Datenschutzerklärung auf autoservicebettenduerf.lu)."
      ] },
    fr: { title:"Contrat de location", ref:"Réf.", secVermieter:"Loueur", secMieter:"Locataire", secObjet:"Objet loué", secPeriod:"Période de location", secPrix:"Prix, caution et paiement", secTerms:"Conditions",
      firma:"Société", adr:"Adresse", tel:"Téléphone", email:"E-mail", rcs:"RCS / TVA", numm:"Nom", adrMieter:"Adresse", dob:"Date de naissance", licNo:"N° de permis", idNo:"N° de pièce d'identité",
      gefier:"Véhicule", plaque:"Immatriculation", typ:"Type", baujoer:"Année", kraftstoff:"Carburant", fs:"Permis", kmStart:"Kilométrage à la remise",
      vun:"Du", bis:"Au", plaz:"Lieu d'enlèvement et de retour", plazVal:"Autoservice Bettenduerf · Bettendorf",
      dag:"Tarif journalier", dauer:"Durée", preis:"Prix de location (estimé)", inclKm:"Kilomètres inclus", inclKmVal:"{included} km par location", zKm:"Km supplémentaires", perKm:"/ km", kaut:"Caution", bez:"Paiement", bezVal:"au retour du véhicule", versp:"Retard", verspVal:"{late} par heure entamée", tank:"Carburant", tankVal:"rendu plein, sinon plein + 50 €", h24:"× 24 h",
      typVan:"Utilitaire", typCar:"Voiture", typTrailer:"Remorque",
      dims:"Dimensions", gvw:"Poids total", payload:"Charge utile", brake:"Frein", braked:"Freinée", unbraked:"Non freinée", retCond:"Retour", retCondVal:"rendre propre et en bon état", clause4Trailer:"<b>Retour & état.</b> La remorque doit être rendue propre et en bon état de marche ; le chargement doit être correctement arrimé. Les dommages ou pièces manquantes sont facturés selon les coûts réels.",
      place:"À Bettendorf, le", signMieter:"Signature locataire", signVermieter:"Signature loueur",
      prep:"Document en préparation …", ready:"Prêt — imprimez ou enregistrez en PDF.", printBtn:"🖨️ Imprimer / PDF", closeBtn:"Fermer",
      pTitlePickup:"Procès-verbal de remise", pTitleReturn:"Procès-verbal de retour", pClient:"Client", pStatePickup:"État à la remise", pStateReturn:"État au retour",
      pDatum:"Date / heure", pKm:"Kilométrage", pFuel:"Niveau carburant / charge", pKeys:"Nombre de clés", pClean:"Propreté", fsCheck:"Permis & identité vérifiés", other:"Autres frais (€)",
      pCondition:"État général :", pDamage:"Dommages / constats :", pConfirmTitle:"Confirmation", pConfirmText:"La signature confirme le contrôle commun et les informations consignées ici.",
      clauses:[
        "<b>Conclusion du contrat.</b> La signature rend ce contrat de location ferme. Le locataire confirme avoir pris le véhicule dans l'état du procès-verbal de remise.",
        "<b>Conducteur.</b> Une pièce d'identité valable et le permis requis ont été présentés. Le véhicule ne peut être conduit que par les personnes inscrites dans ce contrat.",
        "<b>Utilisation.</b> Utilisation soigneuse et conforme. Pas de surcharge, pas de sous-location, pas d'usage illicite. Les trajets avec remorque ou à l'étranger nécessitent une autorisation expresse.",
        "<b>Kilométrage & carburant.</b> {included} km par location sont inclus ; chaque kilomètre supplémentaire est facturé {km}. Le véhicule doit être rendu avec le plein, sinon les frais de carburant + un forfait de 50 € sont facturés.",
        "<b>Retour & retard.</b> Retour à l'heure et au lieu convenus. Chaque heure de retard entamée est facturée {late}.",
        "<b>Caution & paiement.</b> La caution est de 250 € ; le paiement s'effectue au retour du véhicule.",
        "<b>Assurance & responsabilité.</b> Le véhicule est assuré auprès de Foyer Assurances ; la franchise est de 750 € par sinistre. En cas d'accident, de panne, de vol ou de dommage, Autoservice Bettenduerf doit être informé immédiatement ; aucune réparation sans accord.",
        "<b>Annulation.</b> L'annulation est gratuite jusqu'à 24 heures avant le début. À moins de 24 heures ou en cas de non-présentation, 50 € sont facturés.",
        "<b>Protection des données.</b> Les données personnelles sont traitées uniquement pour la gestion de la location (voir la déclaration de confidentialité sur autoservicebettenduerf.lu)."
      ] },
    en: { title:"Rental agreement", ref:"Ref.", secVermieter:"Lessor", secMieter:"Renter", secObjet:"Rented item", secPeriod:"Rental period", secPrix:"Price, deposit and payment", secTerms:"Conditions",
      firma:"Company", adr:"Address", tel:"Phone", email:"E-mail", rcs:"RCS / VAT", numm:"Name", adrMieter:"Address", dob:"Date of birth", licNo:"Licence no.", idNo:"ID no.",
      gefier:"Vehicle", plaque:"Registration", typ:"Type", baujoer:"Year", kraftstoff:"Fuel", fs:"Licence", kmStart:"Odometer at handover",
      vun:"From", bis:"Until", plaz:"Collection and return location", plazVal:"Autoservice Bettenduerf · Bettendorf",
      dag:"Daily rate", dauer:"Duration", preis:"Rental price (estimated)", inclKm:"Included kilometres", inclKmVal:"{included} km per rental", zKm:"Extra km", perKm:"/ km", kaut:"Deposit", bez:"Payment", bezVal:"on return of the vehicle", versp:"Late return", verspVal:"{late} per hour or part thereof", tank:"Fuel", tankVal:"return with a full tank; otherwise, fuel costs + €50", h24:"× 24 h",
      typVan:"Van", typCar:"Car", typTrailer:"Trailer",
      dims:"Dimensions", gvw:"Gross weight", payload:"Payload", brake:"Brake", braked:"Braked", unbraked:"Unbraked", retCond:"Return", retCondVal:"return clean and safe", clause4Trailer:"<b>Return & condition.</b> The trailer must be returned clean and roadworthy; the load must be properly secured. Damage or missing parts are charged at actual cost.",
      place:"Bettendorf, on", signMieter:"Renter signature", signVermieter:"Lessor signature",
      prep:"Preparing document …", ready:"Ready — print or save as PDF.", printBtn:"🖨️ Print / PDF", closeBtn:"Close",
      pTitlePickup:"Handover protocol", pTitleReturn:"Return protocol", pClient:"Customer", pStatePickup:"Condition at handover", pStateReturn:"Condition at return",
      pDatum:"Date / time", pKm:"Odometer", pFuel:"Fuel / load level", pKeys:"Number of keys", pClean:"Cleanliness", fsCheck:"Licence & identity checked", other:"Other costs (€)",
      pCondition:"General condition:", pDamage:"Damage / findings:", pConfirmTitle:"Confirmation", pConfirmText:"The signature confirms the joint inspection and the information recorded here.",
      clauses:[
        "<b>Conclusion.</b> Signing makes this rental agreement binding. The renter confirms having taken over the vehicle in the condition of the handover protocol.",
        "<b>Driver.</b> A valid ID document and the required driving licence were presented. The vehicle may only be driven by the persons named in this agreement.",
        "<b>Use.</b> Careful and proper use. No overloading, no subletting, no unlawful use. Trips with a trailer or abroad require express permission.",
        "<b>Mileage & fuel.</b> {included} km per rental are included; each additional kilometre is charged at {km}. The vehicle must be returned with a full tank, otherwise the fuel costs + a €50 flat fee are charged.",
        "<b>Return & lateness.</b> Return at the agreed time and place. Each started hour of delay is charged {late}.",
        "<b>Deposit & payment.</b> The deposit is €250; payment is made on return of the vehicle.",
        "<b>Insurance & liability.</b> The vehicle is insured by Foyer Assurances; the excess is €750 per claim. In case of accident, breakdown, theft or damage, Autoservice Bettenduerf must be informed immediately; no repair without consent.",
        "<b>Cancellation.</b> Cancellation is free until 24 hours before the start. Within 24 hours or in the event of a no-show, €50 is charged.",
        "<b>Data protection.</b> Personal data is processed solely to handle the rental (see the privacy policy at autoservicebettenduerf.lu)."
      ] }
  };
  // Am installéierten App-Modus (standalone PWA, besonnesch iOS) mécht
  // window.print() näischt an d'App kann net selwer drécken. Dofir d'Dokument
  // op enger Root-Säit (ausserhalb vun der /intern/-Scope) opmaachen — do mécht
  // iOS de richtege Browser op, wou een iwwer ⬆︎ Deelen drécke/als PDF späichere kann.
  function isStandalonePWA() { return (window.navigator.standalone === true) || !!(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches); }
  function openDocInBrowser(ppDocHtml) { if (!ppDocHtml) return false; try { var a = document.createElement("a"); a.href = "/print-doc.html#" + encodeURIComponent(ppDocHtml); a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); return true; } catch (e) { return false; } }
  // Protokoll-Biller (Fotoen + Ënnerschrëften) sinn zougrëffsgeschützt. Op der
  // ëffentlecher Dréck-Säit (Browser, ouni Admin-Session) géifen se net lueden.
  // Dofir se am ageloggten Admin lueden an als Daten-URI anbannen, ier d'Dréck-
  // Säit opgeet — esou ass d'Dokument self-contained an d'Biller sinn och um Handy do.
  function imageToDataUrl(url, maxPx) {
    return new Promise(function (resolve) {
      fetch(url, { credentials: "include" }).then(function (r) { return r.ok ? r.blob() : null; }).then(function (blob) {
        if (!blob) { resolve(null); return; }
        var reader = new FileReader();
        reader.onload = function () {
          var original = reader.result; // data:-URL (CSP-konform, kee blob:)
          var img = new Image();
          img.onload = function () {
            try {
              var scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight)) || 1;
              var w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
              var c = document.createElement("canvas"); c.width = w; c.height = h;
              c.getContext("2d").drawImage(img, 0, 0, w, h);
              var out = c.toDataURL("image/webp", 0.6);
              resolve(out && out.indexOf("data:image") === 0 ? out : original);
            } catch (e) { resolve(original); }
          };
          img.onerror = function () { resolve(original); };
          img.src = original;
        };
        reader.onerror = function () { resolve(null); };
        reader.readAsDataURL(blob);
      }).catch(function () { resolve(null); });
    });
  }
  function embedProtocolMedia(html) {
    var re = /https:\/\/garage-admin\.autoservicebettenduerf\.lu\/media\/protocol\/[a-z0-9\/_.-]+\.(?:webp|jpg|png)/gi;
    var found = html.match(re) || [], uniq = found.filter(function (u, i) { return found.indexOf(u) === i; });
    if (!uniq.length) return Promise.resolve(html);
    var budget = 1600000, used = 0, map = {};
    return uniq.reduce(function (chain, url) {
      return chain.then(function () {
        if (used >= budget) return;
        return imageToDataUrl(url, 1100).then(function (dataUrl) {
          if (dataUrl && dataUrl.indexOf("data:") === 0 && (used + dataUrl.length) <= budget) { map[url] = dataUrl; used += dataUrl.length; }
        });
      });
    }, Promise.resolve()).then(function () {
      var out = html; Object.keys(map).forEach(function (u) { out = out.split(u).join(map[u]); }); return out;
    });
  }
  function openDocStandalone(html) {
    if (html.indexOf("/media/protocol/") === -1) { openDocInBrowser(html); return; }
    toast("Dokument gëtt virbereet …");
    embedProtocolMedia(html).then(function (h) { openDocInBrowser(h); }).catch(function () { openDocInBrowser(html); });
  }
  function printDocEl() {
    var doc = document.querySelector("#protocol-print-root .pp-doc");
    if (isStandalonePWA() && doc) { openDocStandalone(doc.outerHTML); return; }
    try { window.print(); return; } catch (e) {}
    if (!(doc && openDocInBrowser(doc.outerHTML))) toast("Drécken net méiglech op dësem Apparat.");
  }
  function openDocOverlay(html, T) {
    // An der installéierter App direkt am Browser opmaachen (kee Tëscheschrëtt).
    if (isStandalonePWA()) { openDocStandalone(html); return; }
    var root = $("protocol-print-root"); if (!root) return;
    root.innerHTML = '<div class="pp-bar pp-noprint"><span class="pp-hint" id="pp-status">' + esc(T.prep) + '</span><button type="button" class="btn btn-primary btn-sm" id="pp-print" disabled>' + T.printBtn + '</button><button type="button" class="btn btn-ghost btn-sm" id="pp-close">' + esc(T.closeBtn) + '</button></div>' + html;
    root.classList.add("open"); document.body.classList.add("protocol-printing"); document.body.style.overflow = "hidden";
    function close() { root.classList.remove("open"); document.body.classList.remove("protocol-printing"); document.body.style.overflow = ""; root.innerHTML = ""; }
    $("pp-close").addEventListener("click", close);
    root.addEventListener("click", function (e) { if (e.target === root) close(); });
    var imgs = Array.prototype.slice.call(root.querySelectorAll(".pp-doc img")), printBtn = $("pp-print"), status = $("pp-status");
    Promise.all(imgs.map(function (img) { return img.complete ? Promise.resolve(img.naturalWidth > 0) : new Promise(function (resolve) { img.addEventListener("load", function () { resolve(true); }, { once: true }); img.addEventListener("error", function () { resolve(false); }, { once: true }); }); })).then(function () { printBtn.disabled = false; status.textContent = T.ready; });
    printBtn.addEventListener("click", printDocEl);
  }
  function contractInner(d, T) {
    function R(label, val) { return val ? ppRow(label, val) : ppFill(label); }
    var vermieter = '<table class="pp-tbl">' + ppRow(T.firma, "Yves Kremer · Autoservice Bettenduerf") + ppRow(T.adr, "63, rue de Diekirch-Echternach · L-9355 Bettendorf") + ppRow(T.tel, "+352 80 86 87 · +352 621 435 495") + ppRow(T.email, "Autoservicebettenduerf@outlook.com") + ppRow(T.rcs, "A39773 · LU26600977 · Aut. 10038124/0 + /1") + "</table>";
    var mieter = '<table class="pp-tbl">' + R(T.numm, d.name) + R(T.email, d.email) + R(T.tel, d.phone) + ppFill(T.adrMieter) + ppFill(T.dob) + ppFill(T.licNo) + ppFill(T.idNo) + "</table>";
    var objet = d.trailer
      ? '<table class="pp-tbl">' + R(T.gefier, d.veh) + R(T.plaque, d.plate) + R(T.typ, d.typeLabel) + R(T.baujoer, d.year) + R(T.dims, d.dims) + R(T.gvw, d.gvw) + R(T.payload, d.payload) + R(T.brake, d.brakeLabel) + R(T.fs, d.license) + "</table>"
      : '<table class="pp-tbl">' + R(T.gefier, d.veh) + R(T.plaque, d.plate) + R(T.typ, d.typeLabel) + R(T.baujoer, d.year) + R(T.kraftstoff, d.fuel) + R(T.fs, d.license) + ppFill(T.kmStart) + "</table>";
    var period = '<table class="pp-tbl">' + R(T.vun, d.from) + R(T.bis, d.to) + ppRow(T.plaz, T.plazVal) + "</table>";
    var base = R(T.dag, d.rate ? eurTxt(d.rate) : "") + R(T.dauer, d.days ? d.days + " " + T.h24 : "") + R(T.preis, d.total ? eurTxt(d.total) : "") + R(T.kaut, d.deposit ? eurTxt(d.deposit) : "");
    var includedText = d.includedKm ? String(T.inclKmVal).replace("{included}", String(d.includedKm)) : "";
    var lateText = d.lateFeeHour ? String(T.verspVal).replace("{late}", eurTxt(d.lateFeeHour)) : "";
    var prix = d.trailer
      ? '<table class="pp-tbl">' + base + ppRow(T.bez, T.bezVal) + R(T.versp, lateText) + ppRow(T.retCond, T.retCondVal) + "</table>"
      : '<table class="pp-tbl">' + base + R(T.inclKm, includedText) + R(T.zKm, d.extraKmRate ? eurTxt(d.extraKmRate) + " " + T.perKm : "") + ppRow(T.bez, T.bezVal) + R(T.versp, lateText) + ppRow(T.tank, T.tankVal) + "</table>";
    var cl = T.clauses.slice(); if (d.trailer) cl[3] = T.clause4Trailer;
    var clauses = cl.map(function (c) { return c.replace("{km}", d.extraKmRate?eurTxt(d.extraKmRate):"____ €").replace("{included}", d.includedKm?String(d.includedKm):"____").replace("{late}", d.lateFeeHour?eurTxt(d.lateFeeHour):"____ €"); });
    return '<div class="pp-main">' +
      '<div class="pp-titlebar"><h1>' + T.title + '</h1><div class="pp-ref">' + T.ref + ' ' + esc(d.ref || "—") + '<br>' + esc(fmt(new Date().toISOString())) + "</div></div>" +
      '<div class="pp-cols"><div class="pp-sec"><h3>' + T.secVermieter + '</h3>' + vermieter + '</div><div class="pp-sec"><h3>' + T.secMieter + '</h3>' + mieter + "</div></div>" +
      '<div class="pp-sec"><h3>' + T.secObjet + '</h3>' + objet + "</div>" +
      '<div class="pp-sec"><h3>' + T.secPeriod + '</h3>' + period + "</div>" +
      '<div class="pp-sec"><h3>' + T.secPrix + '</h3>' + prix + "</div>" +
      '<div class="pp-sec pp-terms"><h3>' + T.secTerms + '</h3><ol style="margin:0;padding-left:18px">' + clauses.map(function (c) { return '<li style="margin:4px 0">' + c + "</li>"; }).join("") + "</ol></div>" +
      '<p style="margin:14px 0 6px">' + esc(T.place) + ' <span style="display:inline-block;min-width:150px;border-bottom:1px dotted #94a3b8">&nbsp;</span></p>' +
      '<div class="pp-sign"><div><span class="pp-sigbox"></span><div class="pp-sigline">' + esc(T.signMieter) + (d.name ? " · " + esc(d.name) : "") + "</div></div>" +
      '<div><span class="pp-sigbox"></span><div class="pp-sigline">' + esc(T.signVermieter) + ' · Autoservice Bettenduerf</div></div></div>' +
      '<footer class="pp-foot">Autoservice Bettenduerf · 63, rue de Diekirch-Echternach · L-9355 Bettendorf · +352 80 86 87 · autoservicebettenduerf.lu</footer></div>';
  }
  function protocolInner(d, T, stage) {
    function R(label, val) { return val ? ppRow(label, val) : ppFill(label); }
    var pickup = stage === "pickup";
    var client = '<table class="pp-tbl">' + R(T.numm, d.name) + R(T.email, d.email) + R(T.tel, d.phone) + "</table>";
    var gefier = '<table class="pp-tbl">' + R(T.gefier, d.veh) + R(T.plaque, d.plate) + "</table>";
    var period = '<table class="pp-tbl">' + R(T.vun, d.from) + R(T.bis, d.to) + "</table>";
    var stateRows = d.trailer
      ? ppFill(T.pDatum) + ppFill(T.pKeys) + ppFill(T.pClean) + (pickup ? ppFill(T.fsCheck) : ppFill(T.other))
      : ppFill(T.pDatum) + ppFill(T.pKm) + ppFill(T.pFuel) + ppFill(T.pKeys) + ppFill(T.pClean) + (pickup ? ppFill(T.fsCheck) : ppFill(T.zKm) + ppFill(T.other));
    return '<div class="pp-main">' +
      '<div class="pp-titlebar"><h1>' + (pickup ? T.pTitlePickup : T.pTitleReturn) + '</h1><div class="pp-ref">' + T.ref + ' ' + esc(d.ref || "____") + '<br>' + esc(fmt(new Date().toISOString())) + "</div></div>" +
      '<div class="pp-cols"><div class="pp-sec"><h3>' + T.pClient + '</h3>' + client + '</div><div class="pp-sec"><h3>' + T.secObjet + '</h3>' + gefier + "</div></div>" +
      '<div class="pp-sec"><h3>' + T.secPeriod + '</h3>' + period + "</div>" +
      '<div class="pp-sec"><h3>' + (pickup ? T.pStatePickup : T.pStateReturn) + '</h3><table class="pp-tbl">' + stateRows + '</table><p style="margin:10px 0 2px"><strong>' + esc(T.pCondition) + '</strong></p>' + blankLines(2) + '<p style="margin:8px 0 2px"><strong>' + esc(T.pDamage) + '</strong></p>' + blankLines(2) + "</div>" +
      '<div class="pp-sec pp-terms"><h3>' + T.pConfirmTitle + '</h3><p>' + esc(T.pConfirmText) + "</p></div>" +
      '<div class="pp-sign"><div><span class="pp-sigbox"></span><div class="pp-sigline">' + esc(T.signMieter) + (d.name ? " · " + esc(d.name) : "") + '</div></div><div><span class="pp-sigbox"></span><div class="pp-sigline">' + esc(T.signVermieter) + ' · Autoservice Bettenduerf</div></div></div>' +
      '<footer class="pp-foot">Autoservice Bettenduerf · 63, rue de Diekirch-Echternach · L-9355 Bettendorf · +352 80 86 87 · autoservicebettenduerf.lu</footer></div>';
  }
  function fleetDocData(f, T) {
    var trailer = !!(f && f.type === "trailer");
    return {
      ref: "", trailer: trailer, name: "", email: "", phone: "", from: "", to: "", days: 0, total: 0,
      veh: f ? (f.vehicle || "") : "", plate: (f && String(f.plate || "").trim()) || "",
      typeLabel: f ? (trailer ? T.typTrailer : (f.type === "car" ? T.typCar : T.typVan)) : "",
      year: f ? (f.year || "") : "", fuel: f ? (f.fuel || "") : "", license: f ? (f.licenseClass || "") : "",
      dims: f ? (f.loadSpace || "") : "", gvw: f ? (f.grossWeight || "") : "", payload: f ? (f.payload || "") : "",
      brakeLabel: (f && trailer) ? (f.braked ? T.braked : T.unbraked) : "",
      rate: f ? (Number(f.priceDay) || 0) : 0,
      deposit: (f && f.deposit != null && f.deposit !== "") ? Number(f.deposit) : 0,
      includedKm: (f && f.includedKm != null && f.includedKm !== "") ? Number(f.includedKm) : 0,
      extraKmRate: (f && f.extraKmRate != null && f.extraKmRate !== "") ? Number(f.extraKmRate) : 0,
      lateFeeHour: (f && f.lateFeeHour != null && f.lateFeeHour !== "") ? Number(f.lateFeeHour) : 0
    };
  }
  function parseBookingSnapshot(b) { try { var s=typeof b.contractSnapshot==="string"?JSON.parse(b.contractSnapshot):b.contractSnapshot; return s&&s.version?s:null; } catch(e){ return null; } }
  function snapshotDocData(b,T) {
    var s=parseBookingSnapshot(b); if(!s||!s.items||!s.items.length)return null;
    var items=s.items, f=items[0]||{}, allTrailer=items.every(function(x){return x.type==="trailer";}), d=fleetDocData({type:allTrailer?"trailer":f.type,vehicle:items.map(function(x){return x.name;}).join(", "),plate:items.map(function(x){return x.plate;}).filter(Boolean).join(" · "),year:items.map(function(x){return x.year;}).filter(Boolean).join(" · "),fuel:items.map(function(x){return x.fuel;}).filter(Boolean).join(" · "),licenseClass:items.map(function(x){return x.licenseClass;}).filter(function(v,i,a){return v&&a.indexOf(v)===i;}).join(" / "),loadSpace:items.map(function(x){return x.loadSpace;}).filter(Boolean).join(" · "),grossWeight:items.map(function(x){return x.grossWeight;}).filter(Boolean).join(" · "),payload:items.map(function(x){return x.payload;}).filter(Boolean).join(" · "),braked:items.every(function(x){return !!x.braked;}),priceDay:items.reduce(function(a,x){return a+Number(x.priceDay||0);},0),deposit:items.reduce(function(a,x){return a+Number(x.deposit||0);},0),includedKm:items.reduce(function(a,x){return a+Number(x.includedKm||0);},0),extraKmRate:items.reduce(function(a,x){return a+Number(x.extraKmRate||0);},0),lateFeeHour:items.reduce(function(a,x){return Math.max(a,Number(x.lateFeeHour||0));},0)},T);
    var cust=s.customer||{}, rent=s.rental||{};
    d.veh=items.map(function(x){return x.name;}).join(", ")||rent.requestedVehicle||d.veh; d.name=cust.name||b.name; d.email=cust.email||b.email; d.phone=cust.phone||b.phone; d.from=fmt(rent.from||b.from); d.to=fmt(rent.to||b.to); return d;
  }
  function printContract(b) {
    ensureFleetCache().then(function () {
      var f = matchFleet(b.veh), T = DOC_I18N[docLang(b.lang)];
      var d = snapshotDocData(b,T) || fleetDocData(f, T);
      if (!d.veh) d.veh = b.veh;
      if (!d.rate && /renault\s+master|transporter|lieferwagen/i.test(String(b.veh || ""))) d.rate = 100;
      if (!d.plate) d.plate = plateFor(b.veh);
      if (!d.trailer && !d.license) d.license = "B";
      d.ref = refOf(b.id); d.name = d.name||b.name; d.email = d.email||b.email; d.phone = d.phone||b.phone; d.from = d.from||fmt(b.from); d.to = d.to||fmt(b.to);
      var s=parseBookingSnapshot(b), sr=(s&&s.rental)||{}, from = new Date(sr.from||b.from), to = new Date(sr.to||b.to);
      d.days = (!isNaN(from) && !isNaN(to) && to > from) ? Math.max(1, Math.ceil((to - from) / 86400000)) : 0;
      d.total = d.days * d.rate;
      openDocOverlay('<div class="pp-doc">' + docHead() + contractInner(d, T) + "</div>", T);
    });
  }
  function printFleetDoc(kind, L, fleetId, blankTrailer) {
    ensureFleetCache().then(function (fleet) {
      var T = DOC_I18N[docLang(L)];
      var f = fleetId ? (fleet || []).filter(function (x) { return x.id === fleetId; })[0] : null;
      var d = fleetDocData(f || null, T);
      if (!f && blankTrailer) d.trailer = true;
      if (kind === "contract") openDocOverlay('<div class="pp-doc">' + docHead() + contractInner(d, T) + "</div>", T);
      else openDocOverlay('<div class="pp-doc">' + docHead() + protocolInner(d, T, kind) + "</div>", T);
    });
  }
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

    var actions = "", pickupDone=inspectionFor(b.id,"pickup"), returnDone=inspectionFor(b.id,"return"), combinedReady=pickupDone&&returnDone&&pickupDone.customerSignature&&returnDone.customerSignature;
    if (canVal && b.status === "new") actions = '<input class="b-note-input" id="note-' + b.id + '" type="text" placeholder="Notiz (fräiwëlleg) …" /><button class="btn btn-ok btn-sm" data-act="confirmed" data-id="' + b.id + '">✓ Bestätegen</button><button class="btn btn-outline btn-sm" data-act="declined" data-id="' + b.id + '">✕ Ofleenen</button>';
    else if (canVal && b.status === "confirmed") actions = '<input class="b-note-input" id="note-' + b.id + '" type="text" placeholder="Notiz (fräiwëlleg) …" /><button class="btn btn-primary btn-sm" data-protocol="pickup">Iwwergab</button><button class="btn btn-primary btn-sm" data-protocol="return">Retour</button><button class="btn btn-outline btn-sm" data-act="done" data-id="' + b.id + '">Als ofgeschloss markéieren</button>';
    else if (canVal && b.status === "done") actions = '<button class="btn btn-outline btn-sm" data-protocol="pickup">Iwwergab ukucken</button><button class="btn btn-outline btn-sm" data-protocol="return">Retour ukucken</button>';
    if (canVal && (b.status === "new" || b.status === "confirmed")) actions += '<button class="btn btn-outline btn-sm" data-edit-booking="' + b.id + '">✎ Änneren</button>';
    if (canVal && (b.status === "confirmed" || b.status === "done")) actions += '<button class="btn btn-outline btn-sm" data-contract="' + b.id + '">📑 Locatiounsvertrag / PDF</button>';
    if (combinedReady) actions += '<button class="btn btn-ok btn-sm" data-combined-pdf="' + b.id + '">📄 Gesamtprotokoll / PDF</button>';
    if (isAdmin) actions += '<button class="btn btn-danger btn-sm" data-del-booking="' + b.id + '">Läschen</button>';
    el.innerHTML =
      '<div class="b-top"><div><div class="b-veh">' + esc(b.veh) + '</div><div class="b-id">Réf. ' + refOf(b.id) + "</div></div><span class=\"status status-" + b.status + '">' + esc(STATUS[b.status]) + "</span></div>" +
      '<div class="b-dates">' + fmt(b.from) + '<span class="arrow">→</span>' + fmt(b.to) + "</div>" +
      (rentalEstimate(b) ? '<div class="b-estimate">💶 ' + esc(rentalEstimate(b)) + '</div>' : '') +
      '<div class="b-cust"><strong>' + esc(b.name) + "</strong><span>✉ " + esc(b.email) + "</span>" + (b.phone ? "<span>☎ " + esc(b.phone) + "</span>" : "") + "</div>" +
      (b.msg ? '<p class="b-msg">' + esc(b.msg) + "</p>" : "") +
      (actions ? '<div class="b-actions">' + actions + "</div>" : "") +
      (protocolOpen && protocolOpen.id===b.id ? protocolHtml(b,protocolOpen.stage) : "") +
      '<div class="b-audit">' + audit + "</div>";
    el.querySelectorAll("[data-act]").forEach(function (btn) { btn.addEventListener("click", function () { doAct(b.id, btn.getAttribute("data-act")); }); });
    el.querySelectorAll("[data-edit-booking]").forEach(function (btn) { btn.addEventListener("click", function () { editingBooking = b.id; renderBookings(); }); });
    el.querySelectorAll("[data-del-booking]").forEach(function (btn) { btn.addEventListener("click", function () { doDelBooking(parseInt(btn.getAttribute("data-del-booking"), 10)); }); });
    el.querySelectorAll("[data-protocol]").forEach(function(btn){btn.addEventListener("click",function(){protocolOpen={id:b.id,stage:btn.getAttribute("data-protocol")};renderBookings();});});
    el.querySelectorAll("[data-close-protocol]").forEach(function(btn){btn.addEventListener("click",function(){protocolOpen=null;renderBookings();});});
    el.querySelectorAll("[data-save-protocol]").forEach(function(btn){btn.addEventListener("click",function(){saveProtocol(b,btn.getAttribute("data-stage"));});});
    el.querySelectorAll("[data-combined-pdf]").forEach(function(btn){btn.addEventListener("click",function(){printCombinedProtocol(b);});});
    el.querySelectorAll("[data-contract]").forEach(function(btn){btn.addEventListener("click",function(){printContract(b);});});
    if(protocolOpen && protocolOpen.id===b.id) setTimeout(function(){initProtocolUi(b,protocolOpen.stage);},0);
    return el;
  }
  function doEditBooking(id) {
    if (!can("bookings.validate")) return;
    var patch = { veh: $("eb-veh").value.trim(), from: $("eb-from").value, to: $("eb-to").value, name: $("eb-name").value.trim(), email: $("eb-email").value.trim(), phone: $("eb-phone").value.trim(), msg: $("eb-msg").value.trim() };
    if (!patch.veh || !patch.name || !patch.from || !patch.to) { toast("Gefier, Numm, Vun a Bis mussen ausgefëllt sinn."); return; }
    if (patch.to <= patch.from) { toast("Den Enddatum muss nom Ufanksdatum leien."); return; }
    STORE.editBooking(id, patch).then(function (r) { if (r.error) { toast(errMsg(r.error)); return; } editingBooking = null; toast("Reservatioun " + refOf(id) + " geännert."); renderBookings(); });
  }
  function matchQuery(b) { if (!bookingQuery) return true; var q = bookingQuery.toLowerCase(); return (refOf(b.id) + " " + (b.veh || "") + " " + (b.name || "") + " " + (b.email || "") + " " + (b.phone || "")).toLowerCase().indexOf(q) !== -1; }
  function updateNewBadge(bk) { var badge = $("nav-new-badge"); if (!badge) return; var n = bk.filter(function (b) { return b.status === "new"; }).length; badge.textContent = n; badge.hidden = n === 0; }

  /* ---------- Ufroen: Rendez-vous + Produktufroen (gemeinsamt Backend) ---------- */
  var REQCFG = {
    appointment: { list: "appt-list", sub: "appt-sub", filters: "appt-filters", badge: "nav-appt-badge", ref: "T-", noun: "Rendez-vous", titleFb: "Rendez-vous", subAct: "Rendez-vous-Ufroe bestätegen oder ofleenen. All Aktioun gëtt mam Benotzernumm festgehalen." },
    inquiry: { list: "inq-list", sub: "inq-sub", filters: "inq-filters", badge: "nav-inq-badge", ref: "P-", noun: "Produktufro", titleFb: "Produktufro", subAct: "Produktufroe bestätegen oder ofleenen. All Aktioun gëtt mam Benotzernumm festgehalen." },
  };
  var reqState = { appointment: { filter: "all", query: "" }, inquiry: { filter: "all", query: "" } };
  function reqRef(kind, id) { return REQCFG[kind].ref + (id >= 1000 ? id : id + 1000); }
  function updateReqBadge(kind, all) { var badge = $(REQCFG[kind].badge); if (!badge) return; var n = all.filter(function (a) { return (a.kind || "appointment") === kind && a.status === "new"; }).length; badge.textContent = n; badge.hidden = n === 0; }
  function reqMatch(kind, a) { var q = reqState[kind].query; if (!q) return true; q = q.toLowerCase(); return (reqRef(kind, a.id) + " " + (a.service || "") + " " + (a.vehicle || "") + " " + (a.name || "") + " " + (a.email || "") + " " + (a.phone || "")).toLowerCase().indexOf(q) !== -1; }
  function renderReqFilters(kind, items) {
    var c = { all: items.length, new: 0, confirmed: 0, declined: 0, done: 0 };
    items.forEach(function (a) { c[a.status] = (c[a.status] || 0) + 1; });
    var defs = [["all", "All"], ["new", "Nei"], ["confirmed", "Bestätegt"], ["declined", "Ofgeleent"], ["done", "Ofgeschloss"]], wrap = $(REQCFG[kind].filters);
    wrap.innerHTML = "";
    defs.forEach(function (d) { var b = document.createElement("button"); b.type = "button"; b.className = "chip" + (reqState[kind].filter === d[0] ? " active" : ""); b.innerHTML = esc(d[1]) + ' <span class="count">(' + (c[d[0]] || 0) + ")</span>"; b.addEventListener("click", function () { reqState[kind].filter = d[0]; renderReq(kind, true); }); wrap.appendChild(b); });
  }
  var pendingReqActions = new Map();
  function runReqAction(kind, id, card, task) {
    var key = kind + ":" + id;
    if (pendingReqActions.has(key)) return pendingReqActions.get(key);
    var controls = card ? Array.from(card.querySelectorAll("button,input")) : [];
    var disabled = controls.map(function (control) { return control.disabled; });
    controls.forEach(function (control) { control.disabled = true; });
    var promise = Promise.resolve().then(task).catch(function () { toast("Feeler – probéiert nach eng Kéier."); }).finally(function () {
      pendingReqActions.delete(key);
      controls.forEach(function (control, i) { control.disabled = disabled[i]; });
    });
    pendingReqActions.set(key, promise);
    return promise;
  }
  function doResendAppt(a, card) {
    if (!can("bookings.validate") || a.status !== "confirmed") return;
    var date = $("rdate-" + a.id), time = $("rtime-" + a.id), note = $("rnote-appointment-" + a.id);
    if (!date || !time || date.value !== a.confirmedDate || time.value !== a.confirmedTime || (note && note.value.trim())) { toast("Späichert d'Ännerunge fir d'éischt."); return; }
    return runReqAction("appointment", a.id, card, function () {
      return STORE.resendApptConfirmation(a.id, a.confirmedDate, a.confirmedTime).then(function (r) {
        if (r.error) { toast(errMsg(r.error)); return; }
        toast("Bestätegungsmail nach eng Kéier geschéckt.");
        renderReq("appointment");
      });
    });
  }
  function doReqAct(kind, id, status, card) {
    if (!can("bookings.validate")) return;
    var noteEl = $("rnote-" + kind + "-" + id), note = noteEl ? noteEl.value.trim() : "";
    var date = "", time = "";
    if (kind === "appointment" && status === "confirmed") {
      var dEl = $("rdate-" + id), tEl = $("rtime-" + id);
      date = dEl ? dEl.value : ""; time = tEl ? tEl.value : "";
      if (!time) { toast("Gitt w.e.g. eng Auerzäit un ier Dir de Rendez-vous bestätegt."); if (tEl) tEl.focus(); return; }
    }
    return runReqAction(kind, id, card, function () { return STORE.setApptStatus(id, status, note, date, time).then(function (r) {
      if (r.error) { toast(errMsg(r.error)); return; }
      var extra = (status === "confirmed" && r.confirmedTime) ? " (" + (r.confirmedDate || "") + " · " + r.confirmedTime + ")" : "";
      if (kind === "appointment" && status === "confirmed") {
        toast(r.unchanged ? "Keng Ännerungen – keng nei Mail." : "Rendez-vous gespäichert" + extra + (r.mailQueued ? ". Bestätegungsmail gëtt geschéckt." : ". Keng nei Mail."));
      } else toast(REQCFG[kind].noun + " " + reqRef(kind, id) + ": " + (STATUS[status] || status).toLowerCase() + extra + ".");
      renderReq(kind);
    }); });
  }
  function doDelReq(kind, id) { if (!can("members.manage")) return; if (!confirm(REQCFG[kind].noun + " " + reqRef(kind, id) + " endgülteg läschen?")) return; STORE.delAppt(id).then(function (r) { if (r.error) { toast(errMsg(r.error)); return; } toast(REQCFG[kind].noun + " " + reqRef(kind, id) + " geläscht."); renderReq(kind); }); }
  var DUR_OPTIONS = [30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480];
  function durLabel(min) { min = Number(min) || 0; if (!min) return ""; if (min < 60) return min + " Min"; var h = Math.floor(min / 60), r = min % 60; return r ? (h + " Std " + r + " Min") : (h + " Std"); }
  function hhmmToMin(s) { var p = String(s || "").split(":"); return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0); }
  function minToHHMM(m) { m = Math.max(0, Math.round(m)); return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }
  function mechColor(username) { if (!username) return "#64748b"; var i = staffList.map(function (u) { return u.username; }).indexOf(username); return VEH_COLORS[(i < 0 ? 0 : i) % VEH_COLORS.length]; }
  function doSavePlan(a, card) {
    if (!can("bookings.validate")) return;
    var mech = $("rmech-" + a.id), dur = $("rdur-" + a.id), pnote = $("rplan-" + a.id);
    var payload = { assigned: mech ? mech.value : "", duration: dur ? dur.value : "", planNote: pnote ? pnote.value.trim() : "" };
    return runReqAction("appointment", a.id, card, function () {
      return STORE.setApptPlan(a.id, payload).then(function (r) {
        if (r.error) { toast(errMsg(r.error)); return; }
        toast("Plang gespäichert" + (r.assignedName ? " · " + r.assignedName : "") + (r.durationMin ? " · " + durLabel(r.durationMin) : "") + ".");
        requestListCache = null;
        renderReq("appointment");
      });
    });
  }
  function reqCard(kind, a) {
    var el = document.createElement("div"); el.className = "booking" + (a.status === "new" ? " is-new" : ""); el.id = "req-" + kind + "-" + a.id;
    var canVal = can("bookings.validate"), isAdmin = can("members.manage"), actions = "", nid = "rnote-" + kind + "-" + a.id;
    var apptSched = function (prefillTime) {
      if (kind !== "appointment") return "";
      var dv = a.confirmedDate || a.prefDate || "", tv = prefillTime ? (a.confirmedTime || "") : "";
      return '<div class="appt-sched" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px">'
        + '<label style="display:inline-flex;align-items:center;gap:6px;font-size:.88em">📅 <input class="b-note-input" id="rdate-' + a.id + '" type="date" value="' + esc(dv) + '" style="width:auto"></label>'
        + '<label style="display:inline-flex;align-items:center;gap:6px;font-size:.88em">🕒 <input class="b-note-input" id="rtime-' + a.id + '" type="time" step="300" value="' + esc(tv) + '" style="width:auto"></label></div>';
    };
    if (canVal && a.status === "new") {
      actions = apptSched(false) + '<input class="b-note-input" id="' + nid + '" type="text" placeholder="Notiz (fräiwëlleg) …" /><button class="btn btn-ok btn-sm" data-ract="confirmed">✓ Bestätegen</button><button class="btn btn-outline btn-sm" data-ract="declined">✕ Ofleenen</button>';
    }
    else if (canVal && a.status === "confirmed") {
      var resend = '<button class="btn btn-ok btn-sm" data-ract="confirmed">Späicheren</button>';
      if (kind === "appointment") resend += '<button class="btn btn-outline btn-sm" data-resend-appt="1">Bestätegung nach eng Kéier schécken</button><span style="font-size:.85em">Datum oder Auerzäit geännert: Mail beim Späicheren. Nëmmen Notiz: keng Mail.</span>';
      actions = apptSched(true) + '<input class="b-note-input" id="' + nid + '" type="text" placeholder="Notiz (fräiwëlleg) …" />' + resend + '<button class="btn btn-outline btn-sm" data-ract="done">Als ofgeschloss markéieren</button>';
    }
    if (isAdmin) actions += '<button class="btn btn-danger btn-sm" data-delr="1">Läschen</button>';
    var canPlan = canVal && kind === "appointment" && a.status !== "declined";
    var planBlock = "";
    if (canPlan) {
      var mechOpts = '<option value="">— Keen Mécanicien —</option>' + staffList.map(function (u) { return '<option value="' + esc(u.username) + '"' + (u.username === a.assignedTo ? " selected" : "") + ">" + esc(u.name) + "</option>"; }).join("");
      var durOpts = '<option value="">— Dauer —</option>' + DUR_OPTIONS.map(function (mm) { return '<option value="' + mm + '"' + (String(mm) === String(a.durationMin) ? " selected" : "") + ">" + durLabel(mm) + "</option>"; }).join("");
      planBlock = '<div class="appt-plan">'
        + '<div class="appt-plan-h">🔧 Planung</div>'
        + '<div class="appt-plan-row">'
        + '<label>Mécanicien<select class="b-note-input" id="rmech-' + a.id + '">' + mechOpts + "</select></label>"
        + '<label>Dauer<select class="b-note-input" id="rdur-' + a.id + '">' + durOpts + "</select></label>"
        + "</div>"
        + '<input class="b-note-input appt-plan-note" id="rplan-' + a.id + '" type="text" placeholder="Planungsnotiz (intern, net op der Mail) …" value="' + esc(a.planNote || "") + '" />'
        + '<button class="btn btn-outline btn-sm" data-save-plan="1">Plang späicheren</button>'
        + "</div>";
    }
    var audit = (a.events || []).map(function (ev) { return '<div class="ev">• ' + esc(ev.action) + ' vum <b>' + esc(ev.by) + "</b>, " + fmt(ev.at) + (ev.note ? ' – „' + esc(ev.note) + "“" : "") + "</div>"; }).join("");
    var meta = [];
    if (a.vehicle) meta.push("🚗 " + esc(a.vehicle));
    if (a.prefDate) meta.push("📅 " + esc(a.prefDate) + (a.altDate ? " / " + esc(a.altDate) : "") + (a.daytime ? " · " + esc(a.daytime) : ""));
    if (a.confirmedTime) meta.push("✅ " + esc(a.confirmedDate || a.prefDate || "") + " · " + esc(a.confirmedTime) + " Auer");
    if (a.assignedTo) meta.push("🔧 " + esc(a.assignedName || staffName(a.assignedTo)));
    if (a.durationMin) meta.push("⏱ " + esc(durLabel(a.durationMin)));
    if (a.vin) meta.push("VIN " + esc(a.vin));
    el.innerHTML =
      '<div class="b-top"><div><div class="b-veh">' + esc(a.service || REQCFG[kind].titleFb) + '</div><div class="b-id">Réf. ' + reqRef(kind, a.id) + "</div></div><span class=\"status status-" + a.status + '">' + esc(STATUS[a.status]) + "</span></div>" +
      (meta.length ? '<div class="b-dates" style="gap:6px 16px;flex-wrap:wrap">' + meta.join('<span class="arrow">·</span>') + "</div>" : "") +
      '<div class="b-cust"><strong>' + esc(a.name) + "</strong>" + (a.email ? "<span>✉ " + esc(a.email) + "</span>" : "") + (a.phone ? "<span>☎ " + esc(a.phone) + "</span>" : "") + "</div>" +
      (a.msg ? '<p class="b-msg">' + esc(a.msg) + "</p>" : "") +
      planBlock +
      (actions ? '<div class="b-actions">' + actions + "</div>" : "") +
      '<div class="b-audit">' + audit + "</div>";
    el.querySelectorAll("[data-ract]").forEach(function (btn) { btn.addEventListener("click", function () { doReqAct(kind, a.id, btn.getAttribute("data-ract"), el); }); });
    var savePlanBtn = el.querySelector("[data-save-plan]");
    if (savePlanBtn) savePlanBtn.addEventListener("click", function () { doSavePlan(a, el); });
    var resendButton = el.querySelector("[data-resend-appt]");
    if (resendButton) {
      function updateResend() {
        var d = el.querySelector("#rdate-" + a.id), t = el.querySelector("#rtime-" + a.id), note = el.querySelector("#" + nid);
        var unsaved = d.value !== a.confirmedDate || t.value !== a.confirmedTime || !!note.value.trim();
        resendButton.disabled = unsaved || !a.email || !a.confirmedDate || !a.confirmedTime || pendingReqActions.has(kind + ":" + a.id);
        resendButton.title = unsaved ? "Späichert d'Ännerunge fir d'éischt." : (!a.email ? "Keng E-Mail-Adress." : "Déi gespäichert Bestätegung nach eng Kéier schécken.");
      }
      el.querySelectorAll("input").forEach(function (input) { input.addEventListener("input", updateResend); input.addEventListener("change", updateResend); });
      resendButton.addEventListener("click", function () { doResendAppt(a, el); });
      updateResend();
    }
    el.querySelectorAll("[data-delr]").forEach(function (btn) { btn.addEventListener("click", function () { doDelReq(kind, a.id); }); });
    return el;
  }
  function renderReq(kind, useCache) {
    var c = REQCFG[kind];
    $(c.sub).textContent = can("bookings.validate") ? c.subAct : "Dir hutt Liesrechter (Kucker).";
    Promise.all([ensureStaff(), (useCache === true && requestListCache ? Promise.resolve(requestListCache) : STORE.listAppointments())]).then(function (res) {
      var all = res[1];
      requestListCache = all;
      updateReqBadge("appointment", all); updateReqBadge("inquiry", all);
      var items = all.filter(function (a) { return (a.kind || "appointment") === kind; });
      renderReqFilters(kind, items);
      var list = $(c.list); list.innerHTML = "";
      var shown = items.filter(function (a) { return (reqState[kind].filter === "all" || a.status === reqState[kind].filter) && reqMatch(kind, a); });
      if (!shown.length) { var e = document.createElement("p"); e.className = "empty"; e.textContent = reqState[kind].query ? "Keng Ufro fir dës Sich." : "Keng Ufroen an dëser Kategorie."; list.appendChild(e); return; }
      shown.forEach(function (a) { list.appendChild(reqCard(kind, a)); });
    }).catch(function () {
      $(c.filters).innerHTML = "";
      $(c.sub).textContent = "D'Donnéeë konnten net vum Server geluede ginn.";
      $(c.list).innerHTML = '<p class="empty">⚠ Serverfeeler. <button class="btn btn-outline btn-sm" id="retry-' + kind + '">Nei probéieren</button></p>';
      $("retry-" + kind).addEventListener("click", function () { renderReq(kind); });
    });
  }
  function renderAppointments() { renderReq("appointment"); }
  function renderInquiries() { renderReq("inquiry"); }
  function renderBookings(useCache) {
    $("bookings-sub").textContent = can("bookings.validate") ? "Ufroe bestätegen oder ofleenen. All Aktioun gëtt mam Benotzernumm festgehalen." : "Dir hutt Liesrechter (Kucker).";
    (useCache === true && bookingListCache ? Promise.resolve(bookingListCache) : Promise.all([STORE.listBookings(), STORE.listInspections(), STORE.listMaintenance()])).then(function (allData) {
      bookingListCache = allData;
      var bk=allData[0]; inspections=allData[1]||[]; fleetCache=allData[2]||[];
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
  var calRef = new Date(), dashActive = [], dashAppts = [], dashBlocks = [];
  function isSlotBlocked(dkey, slot) { return dashBlocks.some(function (b) { return b.date === dkey && b.slot === slot; }); }
  var dashBk = [], dashAp = [], dashMaint = [];
  var VEH_COLORS = ["#2f6df6", "#e63946", "#2e7d5b", "#b7791f", "#7c4dff", "#0ea5a5", "#d6457f", "#546e7a"];
  var APPT_COLOR = "#334155"; // Rendez-vousen (Service) — donkel, onofhängeg vun de Gefier-Faarwen
  function apptDay(a) { return (a.status === "confirmed" && parseDay(a.confirmedDate)) || parseDay(a.prefDate) || parseDay(a.altDate); }
  function dLabel(s) { var d = parseDay(s); if (!d) return esc(s || ""); function p(n) { return (n < 10 ? "0" : "") + n; } return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear(); }
  function timeStr(s) { if (!s) return ""; var d = new Date(s); if (isNaN(d)) return ""; return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function vehColorMap(bookings) { var map = {}, i = 0; bookings.forEach(function (b) { var v = b.veh || "?"; if (map[v] == null) { map[v] = VEH_COLORS[i % VEH_COLORS.length]; i++; } }); return map; }
  function parseDay(s) {
    if (!s) return null;
    var match = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      var localDay = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      return isNaN(localDay.getTime()) ? null : localDay;
    }
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function startOfWeek(d) { var x = new Date(d); var g = (x.getDay() + 6) % 7; x.setDate(x.getDate() - g); x.setHours(0, 0, 0, 0); return x; }
  function overlaps(a, b) { var a1 = parseDay(a.from) || parseDay(a.to), a2 = parseDay(a.to) || a1, b1 = parseDay(b.from) || parseDay(b.to), b2 = parseDay(b.to) || b1; if (!a1 || !b1) return false; return a1 <= b2 && b1 <= a2; }
  function vehName(v) { return (v || "").replace(/\s*\(.*$/, ""); }
  function sparkline(vals, color) {
    if (!vals || !vals.length) return "";
    var max = Math.max.apply(null, vals) || 1, n = vals.length, W = 64, H = 26;
    var pts = vals.map(function (v, i) { return (n === 1 ? 0 : i / (n - 1) * W).toFixed(1) + "," + (H - 2 - v / max * (H - 4)).toFixed(1); }).join(" ");
    return '<svg class="spark" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="2"/></svg>';
  }

  function tileGo(t) {
    if (!t) return;
    if (t.page === "bookings") { activeFilter = t.filter; gotoPage("bookings"); }
    else if (t.page === "appointments") { reqState.appointment.filter = t.filter; gotoPage("appointments"); }
    else if (t.page) { gotoPage(t.page); }
  }

  function renderDashboard() {
    Promise.all([
      STORE.listBookings().then(function (v) { return v; }, function () { return null; }),
      STORE.listAppointments().then(function (v) { return v; }, function () { return null; }),
      STORE.listMaintenance().then(function (v) { return v; }, function () { return []; }),
      STORE.listApptBlocks().then(function (v) { return v; }, function () { return []; }),
      ensureStaff().then(function (v) { return v; }, function () { return []; }),
    ]).then(function (res) {
      var bk = res[0], ap = res[1];
      if (bk === null && ap === null) { throw new Error("load_failed"); }
      bk = bk || []; ap = ap || [];
      dashBk = bk; dashAp = ap; dashMaint = res[2] || []; dashBlocks = res[3] || [];
      updateNewBadge(bk);
      updateReqBadge("appointment", ap); updateReqBadge("inquiry", ap);
      var rentals = bk.filter(function (b) { return b.status === "confirmed" || b.status === "done"; });
      var appts = ap.filter(function (a) { return (a.kind || "appointment") === "appointment" && a.status !== "declined"; });
      dashActive = rentals; dashAppts = appts;
      buildSearchIndex(bk, ap);

      var now = new Date(), today = new Date(); today.setHours(0, 0, 0, 0); var tMs = today.getTime();
      function dayMs(s) { var d = parseDay(s); return d ? d.getTime() : null; }
      if (session) $("dash-greeting").textContent = "Moien, " + (session.name || "").split(" ")[0] + " 👋";
      $("dash-sub").textContent = STORE.mode === "live" ? "live · " + dLabel(now) : "testmodus";

      var cntNewR = bk.filter(function (b) { return b.status === "new"; }).length;
      var cntNewA = ap.filter(function (a) { return (a.kind || "appointment") === "appointment" && a.status === "new"; }).length;
      var cntNewI = ap.filter(function (a) { return (a.kind || "appointment") === "inquiry" && a.status === "new"; }).length;
      var apptsToday = appts.filter(function (a) { var d = apptDay(a); return a.status === "confirmed" && d && d.getTime() === tMs; }).length;
      var pickupsToday = rentals.filter(function (b) { return b.status === "confirmed" && dayMs(b.from) === tMs; }).length;
      var returnsToday = rentals.filter(function (b) { return b.status === "confirmed" && dayMs(b.to) === tMs; }).length;
      var outNow = rentals.filter(function (b) { if (b.status !== "confirmed") return false; var f = new Date(b.from), t = new Date(b.to); return !isNaN(f) && !isNaN(t) && f <= now && now <= t; }).length;

      // sparkline data: new requests per day over last 7 days (bookings)
      var spark = [];
      for (var s = 6; s >= 0; s--) { var d0 = new Date(today); d0.setDate(d0.getDate() - s); var dm = d0.getTime(); spark.push(bk.filter(function (b) { return dayMs(b.created || b.from) === dm; }).length); }

      var tiles = [
        { cls: "accent", n: cntNewR, l: "Nei Reservatiounen", ic: "📥", go: { page: "bookings", filter: "new" }, spark: spark, sc: "var(--accent)" },
        { cls: "accent", n: cntNewA, l: "Nei Rendez-vous", ic: "🔧", go: { page: "appointments", filter: "new" } },
        { cls: "", n: apptsToday, l: "Rendez-vous haut", ic: "📅", go: { page: "appointments", filter: "confirmed" } },
        { cls: "", n: pickupsToday + returnsToday, l: "Eraus / zréck haut", ic: "🔑", sub: pickupsToday + " eraus · " + returnsToday + " zréck" },
        { cls: "ok", n: outNow, l: "Elo ënnerwee", ic: "🚚" },
      ];
      $("stat-row").innerHTML = tiles.map(function (t, i) {
        var sub = t.sub ? '<div class="sub neutral">' + esc(t.sub) + "</div>" : "";
        var sp = t.spark ? sparkline(t.spark, t.sc) : "";
        return '<div class="stat ' + t.cls + (t.go ? " stat-link" : "") + '"' + (t.go ? ' data-i="' + i + '" role="button" tabindex="0"' : "") + '>' + sp + '<div class="stat-ic">' + t.ic + '</div><div><div class="n">' + t.n + '</div><div class="l">' + t.l + "</div>" + sub + "</div></div>";
      }).join("");
      $("stat-row").querySelectorAll("[data-i]").forEach(function (el) { var t = tiles[parseInt(el.getAttribute("data-i"), 10)].go; function go() { tileGo(t); } el.addEventListener("click", go); el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } }); });

      renderAttn(cntNewR, cntNewA, cntNewI, bk);
      renderConflicts(bk);
      renderTimeline(rentals, appts);
      renderActionNeeded(bk, ap);
      renderFleet(rentals);
      renderMaintDash(dashMaint);
      renderActivity(rentals, appts);
      renderCalendar(rentals, appts);
    }).catch(function () {
      $("dash-sub").textContent = "Serverfeeler";
      $("stat-row").innerHTML = '<div class="empty">⚠ D’Donnéeë konnten net geluede ginn. <button class="btn btn-outline btn-sm" id="retry-dashboard">Nei probéieren</button></div>';
      $("retry-dashboard").addEventListener("click", renderDashboard);
      ["attn-box", "conflict-box", "today-timeline", "action-needed", "fleet-status", "maint-dash", "activity-bars", "activity-x", "calendar", "cal-legend"].forEach(function (id) { if ($(id)) $(id).innerHTML = ""; });
    });
  }

  function renderAttn(nR, nA, nI, bk) {
    var box = $("attn-box"); if (!box) return;
    var parts = [], total = nR + nA + nI;
    if (nR) parts.push(nR + " nei Reservatioun" + (nR > 1 ? "en" : ""));
    if (nA) parts.push(nA + " nei Rendez-vous");
    if (nI) parts.push(nI + " nei Produktufro" + (nI > 1 ? "en" : ""));
    if (!total) { box.innerHTML = ""; return; }
    var go = nR ? { page: "bookings", filter: "new" } : nA ? { page: "appointments", filter: "new" } : { page: "inquiries", filter: "new" };
    box.innerHTML = '<div class="attn"><span class="ic">⚡</span><div><b>' + total + " Saach" + (total > 1 ? "en" : "") + '</b> waarden op dech: ' + parts.join(", ") + ".</div><button class=\"go\" id=\"attn-go\">Elo kucken →</button></div>";
    $("attn-go").addEventListener("click", function () { tileGo(go); });
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

  function renderTimeline(rentals, appts) {
    var el = $("today-timeline"); if (!el) return;
    var today = new Date(); today.setHours(0, 0, 0, 0); var tMs = today.getTime();
    var cmap = vehColorMap(rentals);
    function dayMs(s) { var d = parseDay(s); return d ? d.getTime() : null; }
    var items = [];
    rentals.forEach(function (b) {
      if (b.status !== "confirmed") return;
      if (dayMs(b.from) === tMs) items.push({ sort: new Date(b.from).getTime(), kind: "out", tag: "Ofhuelung", time: timeStr(b.from), title: b.name, meta: '<span class="veh">' + esc(b.veh) + "</span> · zréck " + dLabel(b.to) + " · " + refOf(b.id), color: cmap[b.veh || "?"] });
      if (dayMs(b.to) === tMs) items.push({ sort: new Date(b.to).getTime(), kind: "back", tag: "Retour", time: timeStr(b.to), title: b.name, meta: '<span class="veh">' + esc(b.veh) + "</span> · " + refOf(b.id), color: cmap[b.veh || "?"] });
    });
    appts.forEach(function (a) {
      if (a.status !== "confirmed") return; var d = apptDay(a); if (!d || d.getTime() !== tMs) return;
      items.push({ sort: 50000000000000, kind: "appt", tag: "Rendez-vous", time: a.daytime || "", title: a.service || "Rendez-vous", meta: (a.vehicle ? '<span class="veh">' + esc(a.vehicle) + "</span> · " : "") + esc(a.name) + " · " + reqRef("appointment", a.id), color: APPT_COLOR });
    });
    items.sort(function (x, y) { return x.sort - y.sort; });
    if (!items.length) { el.innerHTML = '<p class="muted" style="font-size:0.85rem">Haut keng Ofhuelungen, Retouren oder Rendez-vous. 🎉</p>'; return; }
    el.innerHTML = '<div class="tl">' + items.map(function (it) {
      return '<div class="tl-ev ' + it.kind + '"><div class="tl-time">' + esc(it.time) + '</div><div class="tl-node"><div class="tl-row1"><span class="tl-tag">' + it.tag + '</span></div><div class="tl-title">' + esc(it.title) + '</div><div class="tl-meta">' + it.meta + "</div></div></div>";
    }).join("") + "</div>";
  }

  function renderActionNeeded(bk, ap) {
    var el = $("action-needed"); if (!el) return;
    var canVal = can("bookings.validate");
    var items = [];
    bk.filter(function (b) { return b.status === "new"; }).forEach(function (b) { items.push({ type: "booking", id: b.id, ref: refOf(b.id), badge: "Reservatioun", bc: "ab-rent", ttl: b.veh, sub: esc(b.name) + " · " + dLabel(b.from) + " → " + dLabel(b.to), created: b.created }); });
    ap.filter(function (a) { return (a.kind || "appointment") === "appointment" && a.status === "new"; }).forEach(function (a) { items.push({ type: "appointment", id: a.id, ref: reqRef("appointment", a.id), badge: "Rendez-vous", bc: "ab-appt", ttl: a.service || "Rendez-vous", sub: (a.vehicle ? esc(a.vehicle) + " · " : "") + esc(a.name) + (a.prefDate ? " · Wonsch: " + esc(a.prefDate) + (a.daytime ? " " + esc(a.daytime) : "") : ""), created: a.created }); });
    ap.filter(function (a) { return (a.kind || "appointment") === "inquiry" && a.status === "new"; }).forEach(function (a) { items.push({ type: "inquiry", id: a.id, ref: reqRef("inquiry", a.id), badge: "Produktufro", bc: "ab-inq", ttl: a.service || "Produktufro", sub: (a.vehicle ? esc(a.vehicle) + " · " : "") + esc(a.name) }); });
    if (!items.length) { el.innerHTML = '<p class="muted" style="font-size:0.85rem">Alles ofgeschafft – näischt wat op dech waart. ✓</p>'; return; }
    el.innerHTML = '<div class="act-list">' + items.map(function (it, i) {
      var btns = "";
      if (canVal) {
        if (it.type === "inquiry") btns = '<button class="abtn-ok" data-ai="' + i + '" data-act="go">Äntweren</button>';
        else btns = '<button class="abtn-ok" data-ai="' + i + '" data-act="confirmed">✓ Bestätegen</button><button class="abtn-no" data-ai="' + i + '" data-act="declined">Ofleenen</button>';
      }
      return '<div class="act-item is-new"><div class="r1"><span class="ref">' + it.ref + '</span><span class="abadge ' + it.bc + '">' + it.badge + '</span></div><div class="ttl">' + esc(it.ttl) + '</div><div class="asub">' + it.sub + "</div>" + (btns ? '<div class="abtns">' + btns + "</div>" : "") + "</div>";
    }).join("") + "</div>";
    el.querySelectorAll("[data-ai]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var it = items[parseInt(btn.getAttribute("data-ai"), 10)], act = btn.getAttribute("data-act");
        if (act === "go") { if (it.type === "inquiry") { reqState.inquiry.filter = "new"; gotoPage("inquiries"); } return; }
        btn.disabled = true;
        var fn = it.type === "booking" ? STORE.setStatus(it.id, act, "") : STORE.setApptStatus(it.id, act, "");
        fn.then(function (r) { if (r.error) { toast(errMsg(r.error)); btn.disabled = false; return; } toast(it.badge + " " + it.ref + ": " + (STATUS[act] || act).toLowerCase() + "."); renderDashboard(); });
      });
    });
  }

  function renderFleet(rentals) {
    var el = $("fleet-status"); if (!el) return;
    var now = new Date(), today = new Date(); today.setHours(0, 0, 0, 0); var tMs = today.getTime();
    function dayMs(s) { var d = parseDay(s); return d ? d.getTime() : null; }
    var set = {};
    rentals.forEach(function (b) { if (b.veh) set[b.veh] = 1; });
    dashMaint.forEach(function (m) { if (m.vehicle) set[m.vehicle] = 1; });
    var vehicles = Object.keys(set).sort();
    if (!vehicles.length) { el.innerHTML = '<p class="muted" style="font-size:0.85rem">Nach keng Gefierer.</p>'; return; }
    var cmap = vehColorMap(rentals);
    var rows = vehicles.map(function (v) {
      var conf = rentals.filter(function (b) { return b.veh === v && b.status === "confirmed"; });
      var outNow = null, backToday = null, outToday = null;
      conf.forEach(function (b) {
        var f = new Date(b.from), t = new Date(b.to);
        if (!isNaN(f) && !isNaN(t) && f <= now && now <= t) outNow = b;
        if (dayMs(b.to) === tMs) backToday = b;
        if (dayMs(b.from) === tMs) outToday = b;
      });
      var cls, txt;
      if (backToday && outNow) { cls = "s-soon"; txt = "Retour haut " + timeStr(backToday.to); }
      else if (outNow) { cls = "s-out"; txt = "Ënnerwee bis " + dLabel(outNow.to); }
      else if (outToday) { cls = "s-soon"; txt = "Eraus haut " + timeStr(outToday.from); }
      else { cls = "s-free"; txt = "Fräi"; }
      var dot = cls === "s-free" ? "var(--ok)" : cls === "s-soon" ? "var(--warn)" : "var(--accent)";
      return '<div class="fl"><span class="fdot" style="background:' + dot + '"></span><span class="fname">' + esc(v) + '</span><span class="fstat ' + cls + '">' + txt + "</span></div>";
    }).join("");
    el.innerHTML = '<div class="fleet">' + rows + "</div>";
  }

  function maintLabel(days) {
    if (days == null) return { t: "— keen Datum", c: "due-ok" };
    if (days < 0) return { t: "iwwerfälleg", c: "due-now" };
    if (days === 0) return { t: "haut fälleg", c: "due-now" };
    if (days <= 14) return { t: "a " + days + " Deeg", c: "due-soon" };
    if (days <= 60) return { t: "a " + Math.round(days / 7) + " Wochen", c: "due-ok" };
    return { t: "a " + Math.round(days / 30) + " Méint", c: "due-ok" };
  }
  function maintIcon(service) { var s = (service || "").toLowerCase(); if (s.indexOf("vidang") !== -1 || s.indexOf("öl") !== -1 || s.indexOf("ol") !== -1) return "🛢️"; if (s.indexOf("pneu") !== -1 || s.indexOf("reif") !== -1) return "🛞"; if (s.indexOf("kontroll") !== -1 || s.indexOf("contrôle") !== -1 || s.indexOf("tüv") !== -1) return "📋"; if (s.indexOf("brems") !== -1) return "🛑"; if (s.indexOf("klima") !== -1) return "❄️"; return "🔧"; }
  function maintDays(m) { var d = parseDay(m.dueDate); if (!d) return null; var today = new Date(); today.setHours(0, 0, 0, 0); return Math.round((d.getTime() - today.getTime()) / 86400000); }
  function renderMaintDash(maint) {
    var el = $("maint-dash"); if (!el) return;
    var btn = $("maint-manage"); if (btn) { btn.hidden = !can("bookings.validate"); btn.onclick = function () { gotoPage("wartung"); }; }
    if (!maint || !maint.length) { el.innerHTML = '<p class="muted" style="font-size:0.85rem">Nach keng Wartungsufro. ' + (can("bookings.validate") ? 'Lee se ënner „Flotte“ un.' : "") + "</p>"; return; }
    var arr = maint.map(function (m) { return { m: m, days: maintDays(m) }; }).sort(function (a, b) {
      if (a.days == null && b.days == null) return 0; if (a.days == null) return 1; if (b.days == null) return -1; return a.days - b.days;
    }).slice(0, 5);
    el.innerHTML = arr.map(function (x) { var lab = maintLabel(x.days); return '<div class="maint"><span class="mic">' + maintIcon(x.m.service) + '</span><div><div class="mname">' + esc(x.m.vehicle) + '</div><div class="mtype">' + esc(x.m.service) + (x.m.note ? " · " + esc(x.m.note) : "") + '</div></div><span class="mdue ' + lab.c + '">' + lab.t + "</span></div>"; }).join("");
  }

  function renderActivity(rentals, appts) {
    var bars = $("activity-bars"), xs = $("activity-x"); if (!bars) return;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var counts = [], labels = [], max = 1;
    for (var i = -7; i <= 6; i++) {
      var d = new Date(today); d.setDate(d.getDate() + i); var dm = d.getTime();
      var c = rentals.filter(function (b) { var f = parseDay(b.from), t = parseDay(b.to) || f; return f && dm >= f.getTime() && dm <= t.getTime(); }).length
            + appts.filter(function (a) { var ad = apptDay(a); return ad && ad.getTime() === dm; }).length;
      counts.push({ c: c, t: i === 0 }); if (c > max) max = c;
      labels.push(i === 0 ? "haut" : (i % 2 === 0 ? (i > 0 ? "+" + i : "" + i) : ""));
    }
    bars.innerHTML = counts.map(function (x) { return '<div class="abar' + (x.t ? " today" : "") + '" style="height:' + Math.max(6, Math.round(x.c / max * 100)) + '%" title="' + x.c + ' Rendez-vous"></div>'; }).join("");
    xs.innerHTML = labels.map(function (l) { return "<div>" + l + "</div>"; }).join("");
  }

  function renderCalendar(active, appts) {
    appts = appts || [];
    var cmap = vehColorMap(active), y = calRef.getFullYear(), mo = calRef.getMonth();
    $("cal-label").textContent = ["Januar", "Februar", "Mäerz", "Abrëll", "Mee", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"][mo] + " " + y;
    var start = startOfWeek(new Date(y, mo, 1)), today = new Date(); today.setHours(0, 0, 0, 0);
    var dows = ["Mé", "Dë", "Më", "Do", "Fr", "Sa", "So"];
    var html = '<div class="cal-grid">' + dows.map(function (d) { return '<div class="cal-dow">' + d + "</div>"; }).join("");
    var cur = new Date(start);
    for (var i = 0; i < 42; i++) {
      var inMonth = cur.getMonth() === mo, isToday = cur.getTime() === today.getTime();
      var dayEvents = active.filter(function (b) { var f = parseDay(b.from), t = parseDay(b.to) || f; return f && cur >= f && cur <= t; });
      var dayAppts = appts.filter(function (a) { var d = apptDay(a); return d && d.getTime() === cur.getTime(); });
      var total = dayEvents.length + dayAppts.length;
      var dkey = cur.getFullYear() + "-" + pad(cur.getMonth() + 1) + "-" + pad(cur.getDate());
      var amB = isSlotBlocked(dkey, "am"), pmB = isSlotBlocked(dkey, "pm"), closedB = isSlotBlocked(dkey, "closed");
      var blkHtml = closedB ? '<div class="cal-ev closed-ev" title="Zou / Feiertag">🚫 Zou</div>'
        : (amB && pmB) ? '<div class="cal-ev blocked" title="Ganzen Dag gespaart">⛔ Ganzen Dag</div>'
        : amB ? '<div class="cal-ev blocked" title="Moies gespaart">⛔ Moies</div>'
        : pmB ? '<div class="cal-ev blocked" title="Nomëtteg gespaart">⛔ Nomëtteg</div>' : "";
      var evHtml = blkHtml + dayEvents.slice(0, 3).map(function (b) { return '<div class="cal-ev' + (b.status === "new" ? " tentative" : "") + '" style="background:' + cmap[b.veh || "?"] + '" title="' + esc(b.veh) + " – " + esc(b.name) + " (" + (b.status === "new" ? "nei" : b.status === "confirmed" ? "bestätegt" : "ofgeschloss") + ')">' + esc(vehName(b.veh)) + "</div>"; }).join("");
      var remain = 3 - dayEvents.length;
      if (remain > 0) evHtml += dayAppts.slice(0, remain).map(function (a) { return '<div class="cal-ev appt' + (a.status === "new" ? " tentative" : "") + '" title="Rendez-vous: ' + esc(a.service || "") + (a.vehicle ? " – " + esc(a.vehicle) : "") + " – " + esc(a.name) + " (" + (a.status === "new" ? "nei" : "bestätegt") + ')">🔧 ' + esc(vehName(a.service || "RDV")) + "</div>"; }).join("");
      if (total > 3) evHtml += '<div class="cal-ev" style="background:#9aa7b4">+' + (total - 3) + "</div>";
      html += '<div class="cal-cell' + (inMonth ? "" : " other") + (isToday ? " today" : "") + (inMonth ? " clickable" : "") + '"' + (inMonth ? ' data-day="' + dkey + '" role="button" tabindex="0"' : "") + '><div class="cal-daynum">' + cur.getDate() + "</div>" + evHtml + "</div>";
      cur.setDate(cur.getDate() + 1);
    }
    $("calendar").innerHTML = html + "</div>";
    var vehs = Object.keys(cmap);
    var leg = vehs.map(function (v) { return '<span><i style="background:' + cmap[v] + '"></i>' + esc(vehName(v)) + "</span>"; }).join("");
    if (appts.length) leg += '<span><i style="background:' + APPT_COLOR + '"></i>🔧 Rendez-vous</span>';
    leg += '<span><i style="background:#b4232a"></i>⛔ Gespaart (Hallefdag)</span>';
    leg += '<span><i style="background:#64727f"></i>🚫 Zou / Feiertag</span>';
    $("cal-legend").innerHTML = leg;
    $("calendar").querySelectorAll(".cal-cell[data-day]").forEach(function (c) {
      function open() { openDay(c.getAttribute("data-day")); }
      c.addEventListener("click", open);
      c.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
  }

  var dayReturnFocus = null;
  function closeDay(restoreFocus) {
    var pop = $("daypop");
    if (!pop || pop.hidden) return;
    pop.hidden = true;
    if (restoreFocus !== false && dayReturnFocus && document.contains(dayReturnFocus)) dayReturnFocus.focus();
    dayReturnFocus = null;
  }
  function focusAppointment(id) {
    closeDay(false);
    reqState.appointment.filter = "all";
    reqState.appointment.query = "";
    var search = $("appt-search");
    if (search) search.value = "";
    gotoPage("appointments");
    var tries = 0;
    (function seek() {
      var card = document.getElementById("req-appointment-" + id);
      if (card) { card.scrollIntoView({ behavior: "smooth", block: "center" }); card.classList.add("flash"); setTimeout(function () { card.classList.remove("flash"); }, 1800); }
      else if (tries++ < 25) setTimeout(seek, 120);
    })();
  }
  function openDay(dkey) {
    var day = parseDay(dkey); if (!day) return; var dMs = day.getTime();
    var cmap = vehColorMap(dashActive);
    $("day-title").textContent = dLabel(dkey);
    var body = $("day-body");
    var canVal = can("bookings.validate");

    // ---- Locatiounen (ganzen Dag) a Rendez-vousen vun dësem Dag ----
    var rentals = [];
    dashActive.forEach(function (b) { var f = parseDay(b.from), t = parseDay(b.to) || f; if (f && dMs >= f.getTime() && dMs <= t.getTime()) {
      var role = dMs === f.getTime() ? "Ofhuelung" : dMs === (t ? t.getTime() : f.getTime()) ? "Retour" : "ënnerwee";
      rentals.push({ color: cmap[b.veh || "?"], label: esc(vehName(b.veh)) + " · " + esc(b.name) + " · " + role + " · " + STATUS[b.status] + " · " + refOf(b.id) });
    } });
    var dayAppts = dashAppts.filter(function (a) { var d = apptDay(a); return d && d.getTime() === dMs; });
    var scheduled = [], unscheduled = [];
    dayAppts.forEach(function (a) {
      var tm = (a.status === "confirmed" && a.confirmedTime) ? a.confirmedTime : "";
      if (/^([01]\d|2[0-3]):[0-5]\d$/.test(tm)) { var start = hhmmToMin(tm), dur = Number(a.durationMin) || 60; scheduled.push({ a: a, start: start, end: start + dur, dur: dur }); }
      else unscheduled.push(a);
    });

    // ---- Dagesplang (Stonne-Timeline — ëmmer siichtbar, och op fräien Deeg) ----
    var amB = isSlotBlocked(dkey, "am"), pmB = isSlotBlocked(dkey, "pm"), closedB = isSlotBlocked(dkey, "closed");
    var minStart = 420, maxEnd = 1140, NOON = 720;
    scheduled.forEach(function (s) { minStart = Math.min(minStart, s.start); maxEnd = Math.max(maxEnd, s.end); });
    var winStart = Math.floor(minStart / 60) * 60, winEnd = Math.ceil(maxEnd / 60) * 60;
    var PXMIN = 0.92, gridH = (winEnd - winStart) * PXMIN;
    // Spalten fir Iwwerschneidungen (pro Iwwerschneidungs-Cluster)
    scheduled.sort(function (x, y) { return x.start - y.start || x.end - y.end; });
    var maxCols = 1;
    (function () {
      var clusters = [], cur = [], curEnd = -1;
      scheduled.forEach(function (s) { if (cur.length && s.start >= curEnd) { clusters.push(cur); cur = []; curEnd = -1; } cur.push(s); curEnd = Math.max(curEnd, s.end); });
      if (cur.length) clusters.push(cur);
      clusters.forEach(function (cl) { var lanes = []; cl.forEach(function (s) { var placed = false; for (var i = 0; i < lanes.length; i++) { if (s.start >= lanes[i]) { s.col = i; lanes[i] = s.end; placed = true; break; } } if (!placed) { s.col = lanes.length; lanes.push(s.end); } }); maxCols = Math.max(maxCols, lanes.length); cl.forEach(function (s) { s.cols = lanes.length; }); });
    })();
    // Ganz- a Hallefstonne-Linnen
    var linesHtml = "";
    for (var hm = winStart; hm <= winEnd; hm += 30) { var ltop = (hm - winStart) * PXMIN, full = hm % 60 === 0; linesHtml += '<div class="sched-hour' + (full ? "" : " half") + '" style="top:' + ltop + 'px">' + (full ? '<span class="sched-hlabel">' + pad(hm / 60) + ":00</span>" : "") + "</div>"; }
    // Blockéiert Zäiten am Gitter schrafféiert
    function shade(fromMin, toMin, label) { var t = (Math.max(fromMin, winStart) - winStart) * PXMIN, h = (Math.min(toMin, winEnd) - Math.max(fromMin, winStart)) * PXMIN; if (h <= 0) return ""; return '<div class="sched-shade" style="top:' + t + "px;height:" + h + 'px"><span>' + label + "</span></div>"; }
    var shadeHtml = closedB ? shade(winStart, winEnd, "🚫 Zou / Feiertag") : ((amB ? shade(winStart, NOON, "⛔ Moies gespaart") : "") + (pmB ? shade(NOON, winEnd, "⛔ Nomëtteg gespaart") : ""));
    // Rendez-vous Bléck (uklickbar → sprangt an d'Rendez-vous-Kaart)
    var blocksHtml = scheduled.map(function (s) {
      var a = s.a, top = (s.start - winStart) * PXMIN, h = Math.max((s.end - s.start) * PXMIN, 28);
      var w = 100 / s.cols, left = s.col * w, col = mechColor(a.assignedTo), who = a.assignedTo ? staffName(a.assignedTo) : "Keen Mécanicien";
      return '<div class="sched-ev' + (a.assignedTo ? "" : " unassigned") + '" data-appt="' + a.id + '" tabindex="0" role="button" aria-label="' + esc((a.service || "Rendez-vous") + ", " + minToHHMM(s.start) + " bis " + minToHHMM(s.end) + ", " + who + ". Opmaachen") + '" style="top:' + top + "px;height:" + h + "px;left:calc(" + left + "% + 48px);width:calc(" + w + "% - 54px);background:" + col + '" title="' + esc((a.service || "Rendez-vous") + " · " + minToHHMM(s.start) + "–" + minToHHMM(s.end) + " · " + who + " — klick fir opzemaachen") + '">'
        + '<div class="sched-ev-t">' + minToHHMM(s.start) + " · " + esc(vehName(a.service || "RDV")) + "</div>"
        + '<div class="sched-ev-s">' + esc(a.name) + (a.assignedTo ? " · 🔧 " + esc(who) : " · ⚠ Net zougewisen") + (s.dur ? " · " + durLabel(s.dur) : "") + "</div></div>";
    }).join("");
    // Aktuell-Zäit-Linn (nëmme wann een haut kuckt)
    var nowD = new Date(), todayKey = nowD.getFullYear() + "-" + pad(nowD.getMonth() + 1) + "-" + pad(nowD.getDate()), nowHtml = "";
    if (dkey === todayKey) { var nowMin = nowD.getHours() * 60 + nowD.getMinutes(); if (nowMin >= winStart && nowMin <= winEnd) nowHtml = '<div class="sched-now" style="top:' + ((nowMin - winStart) * PXMIN) + 'px"><span>' + minToHHMM(nowMin) + "</span></div>"; }
    // Kappzeil: Zesummefaassung + Mécanicien-Legend
    var totalMin = scheduled.reduce(function (sum, s) { return sum + s.dur; }, 0);
    var summary = scheduled.length ? (scheduled.length + " Rendez-vous" + (scheduled.length > 1 ? "en" : "") + (totalMin ? " · " + durLabel(totalMin) + " geplangt" : "")) : "Keng fest Auerzäiten";
    var mechSet = {}, hasUnassigned = false; scheduled.forEach(function (s) { if (s.a.assignedTo) mechSet[s.a.assignedTo] = true; else hasUnassigned = true; });
    var mechLeg = Object.keys(mechSet).map(function (u) { return '<span class="sched-leg-i"><i style="background:' + mechColor(u) + '"></i>' + esc(staffName(u)) + "</span>"; }).join("");
    if (hasUnassigned) mechLeg += '<span class="sched-leg-i unassigned"><i style="background:#b45309"></i>⚠ Nach net zougewisen</span>';
    var availability = closedB ? "Dëse Betribsdag ass als zou markéiert." : amB && pmB ? "Moies an nomëttes gespaart." : amB ? "Moies gespaart, nomëttes fräi." : pmB ? "Moies fräi, nomëttes gespaart." : "De ganzen Dag ass fräi fir d'Planung.";
    var scheduleBody = scheduled.length
      ? '<div class="day-sched-scroll" aria-label="Horizontal scrollbaren Dagesplang"><div class="day-sched" style="height:' + gridH + "px;min-width:" + (maxCols > 2 ? (48 + maxCols * 150) + "px" : "100%") + '">' + linesHtml + shadeHtml + blocksHtml + nowHtml + "</div></div>"
      : '<div class="day-sched-empty"><div><strong>Nach keng fest Auerzäit geplangt</strong><span>' + esc(availability) + "</span></div></div>";
    var scheduleHtml = '<div class="day-sched-h">🕒 Dagesplang · <span class="day-sched-sum">' + esc(summary) + "</span></div>"
      + (mechLeg ? '<div class="sched-leg">' + mechLeg + "</div>" : "")
      + scheduleBody;
    var rentalsHtml = rentals.length ? '<div class="day-allday">' + rentals.map(function (r) { return '<div class="devent"><span class="dd" style="background:' + r.color + '"></span><div style="min-width:0"><div class="ds">🚐 ' + r.label + "</div></div></div>"; }).join("") + "</div>" : "";
    var unschedHtml = unscheduled.length ? '<div class="day-unsched"><div class="day-sched-h">⏳ Nach ze plangen (keng Auerzäit)</div>' + unscheduled.map(function (a) { return '<div class="devent devent-click" data-appt="' + a.id + '" tabindex="0" role="button"><span class="dd" style="background:' + (a.assignedTo ? APPT_COLOR : "#b45309") + '"></span><div style="min-width:0"><div class="dt">🔧 ' + esc(a.service || "Rendez-vous") + (a.assignedTo ? " · " + esc(staffName(a.assignedTo)) : " · ⚠ Nach net zougewisen") + '</div><div class="ds">' + esc(a.name) + " · " + STATUS[a.status] + " · " + reqRef("appointment", a.id) + "</div></div></div>"; }).join("") + "</div>" : "";
    function slotBtn(slot, label, blocked) {
      var cls = "slotbtn " + (blocked ? "is-blocked" : "is-free");
      if (!canVal) return '<span class="' + cls + '">' + label + " · " + (blocked ? "Gespaart" : "Fräi") + "</span>";
      return '<button type="button" class="' + cls + '" data-block-slot="' + slot + '" data-block-now="' + (blocked ? "1" : "0") + '">' + label + " · " + (blocked ? "Gespaart ✕" : "Blockéieren") + "</button>";
    }
    function closedBtn(blocked) {
      var cls = "slotbtn " + (blocked ? "is-closed" : "is-free");
      if (!canVal) return '<span class="' + cls + '">🚫 ' + (blocked ? "Zou / Feiertag" : "Op") + "</span>";
      return '<button type="button" class="' + cls + '" data-block-slot="closed" data-block-now="' + (blocked ? "1" : "0") + '">' + (blocked ? "🚫 Zou (Feiertag) ✕" : "🚫 Als Feiertag / zou") + "</button>";
    }
    var blockHtml = '<div class="day-block"><div class="day-block-h">Verfügbarkeet blockéieren</div><div class="day-block-row">' + slotBtn("am", "☀️ Moies", amB) + slotBtn("pm", "🌙 Nomëtteg", pmB) + '</div><div class="day-block-row" style="margin-top:8px">' + closedBtn(closedB) + "</div></div>";
    body.innerHTML = blockHtml + rentalsHtml + scheduleHtml + unschedHtml;
    body.querySelectorAll("[data-appt]").forEach(function (ev) {
      function go() { focusAppointment(parseInt(ev.getAttribute("data-appt"), 10)); }
      ev.addEventListener("click", go);
      ev.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });
    body.querySelectorAll("[data-block-slot]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var slot = btn.getAttribute("data-block-slot"), now = btn.getAttribute("data-block-now") === "1";
        btn.disabled = true;
        STORE.setApptBlock(dkey, slot, !now).then(function (r) {
          if (r.error) { toast(errMsg(r.error)); btn.disabled = false; return; }
          if (!now) { if (!isSlotBlocked(dkey, slot)) dashBlocks.push({ date: dkey, slot: slot, note: "" }); }
          else { dashBlocks = dashBlocks.filter(function (b) { return !(b.date === dkey && b.slot === slot); }); }
          toast((slot === "am" ? "Moies" : slot === "pm" ? "Nomëtteg" : "Feiertag/zou") + " " + (!now ? "gespaart" : "erëm fräi") + ".");
          renderCalendar(dashActive, dashAppts);
          openDay(dkey);
        });
      });
    });
    var pop = $("daypop"), card = pop.querySelector(".daycard");
    dayReturnFocus = document.activeElement;
    pop.hidden = false;
    body.scrollTop = 0;
    setTimeout(function () { if (card) card.focus(); }, 0);
  }
  (function () {
    var x = $("day-x"), pop = $("daypop");
    if (x) x.addEventListener("click", function () { closeDay(true); });
    if (pop) pop.addEventListener("click", function (e) { if (e.target === pop) closeDay(true); });
    if (pop) pop.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); closeDay(true); return; }
      if (e.key !== "Tab") return;
      var focusable = Array.prototype.slice.call(pop.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(function (el) { return el.offsetParent !== null; });
      if (!focusable.length) { e.preventDefault(); return; }
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  })();

  (function () {
    var p = $("cal-prev"), n = $("cal-next"), t = $("cal-today");
    if (p) p.addEventListener("click", function () { calRef = new Date(calRef.getFullYear(), calRef.getMonth() - 1, 1); renderCalendar(dashActive, dashAppts); });
    if (n) n.addEventListener("click", function () { calRef = new Date(calRef.getFullYear(), calRef.getMonth() + 1, 1); renderCalendar(dashActive, dashAppts); });
    if (t) t.addEventListener("click", function () { calRef = new Date(); renderCalendar(dashActive, dashAppts); });
  })();

  /* ---------- Analyse ---------- */
  function renderAnalyse() {
    $("analyse-sub").textContent = "…";
    Promise.all([
      STORE.listBookings().then(function (v) { return v; }, function () { return null; }),
      STORE.listAppointments().then(function (v) { return v; }, function () { return []; }),
      STORE.listMaintenance().then(function (v) { return v; }, function () { return []; }),
      STORE.listInspections().then(function (v) { return v; }, function () { return []; }),
    ]).then(function (res) {
      var bk = res[0]; if (bk === null) throw new Error("load");
      var ap = res[1] || [];
      var fleet = res[2] || [];
      var insp = res[3] || [];
      var appts = ap.filter(function (a) { return (a.kind || "appointment") === "appointment"; });
      $("analyse-sub").textContent = "aus dengen Donnéeën berechent";
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var since = new Date(today); since.setDate(since.getDate() - 90);
      var rentals = bk.filter(function (b) { return b.status === "confirmed" || b.status === "done"; });

      // KPIs
      var rec = bk.filter(function (b) { var d = parseDay(b.created || b.from); return d && d >= since; });
      var recAp = appts.filter(function (a) { var d = parseDay(a.created) || apptDay(a); return d && d >= since; });
      var durs = rentals.map(function (b) { var f = parseDay(b.from), t = parseDay(b.to); return f && t ? Math.max(1, Math.round((t - f) / 86400000)) : null; }).filter(function (x) { return x != null; });
      var avgDur = durs.length ? (durs.reduce(function (a, b) { return a + b; }, 0) / durs.length) : 0;
      var decl = bk.filter(function (b) { return b.status === "declined"; }).length;
      var noShow = bk.length ? Math.round(decl / bk.length * 100) : 0;
      var kpis = [
        { cls: "", n: rec.length, l: "Reservatiounen (90d)", ic: "📈" },
        { cls: "accent", n: recAp.length, l: "Rendez-vous (90d)", ic: "🔧" },
        { cls: "", n: (avgDur ? avgDur.toFixed(1).replace(".", ",") : "0"), l: "Ø Deeg / Locatioun", ic: "⏱️" },
        { cls: "", n: noShow + "%", l: "Ofgeleent-Quote", ic: "🚫" },
        { cls: "ok", n: bk.length, l: "Ufroen insgesamt", ic: "📊" },
      ];
      $("analyse-kpis").innerHTML = kpis.map(function (t) { return '<div class="stat ' + t.cls + '"><div class="stat-ic">' + t.ic + '</div><div><div class="n">' + t.n + '</div><div class="l">' + t.l + "</div></div></div>"; }).join("");

      // ---- Akommes / Ëmsaz aus der Locatioun ----
      // Basis: Verleih-Deeg × bei der Bestätegung agefruerene Präis + Zousazkäschten aus de
      // Retour-Protokoller. "Realiséiert" = ofgeschloss (done), "Erwaart" =
      // confirméiert mee nach net zréck.
      function fmtEur(n) { return Number(n || 0).toLocaleString("de-DE", {minimumFractionDigits:2,maximumFractionDigits:2}) + " €"; }
      function rateForName(nm) {
        var k = String(nm || "").trim().toLowerCase();
        var hit = fleet.filter(function (x) { return String(x.vehicle || "").trim().toLowerCase() === k; })[0];
        if (hit && hit.priceDay !== "" && hit.priceDay != null) return Number(hit.priceDay) || 0;
        if (/master|transporter|lieferwagen/.test(k)) return 100; // al Nimm → de Master
        return 0;
      }
      function billedDays(b) { var f = new Date(b.from), t = new Date(b.to); if (isNaN(f) || isNaN(t) || t <= f) return 0; return Math.max(1, Math.ceil((t - f) / 86400000)); }
      // Zousazkäschten (€) a Zousaz-km aus de Retour-Protokoller, pro Reservatioun
      var retExtra = {}, retKm = {};
      insp.forEach(function (x) {
        if (x.stage !== "return") return;
        var id = Number(x.bookingId);
        if (x.extraCosts != null && x.extraCosts !== "") retExtra[id] = (retExtra[id] || 0) + (Number(x.extraCosts) || 0);
        if (x.extraKm != null && x.extraKm !== "") retKm[id] = (retKm[id] || 0) + (Number(x.extraKm) || 0);
      });
      var realized = {}, expected = {}, realizedTot = 0, expectedTot = 0, doneCount = 0, unpriced = 0, otherTot = 0, kmCostTot = 0, kmTot = 0;
      rentals.forEach(function (b) {
        if (b.status !== "done" && b.status !== "confirmed") return;
        var days = billedDays(b); if (!days) return;
        var snap=parseBookingSnapshot(b), snapItems=snap&&snap.items||[];
        var names = snapItems.length?snapItems.map(function(x){return x.name;}):String(b.veh || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
        if (!names.length) names = [b.veh || "?"];
        if (b.status === "done") doneCount++;
        var primary = null;
        names.forEach(function (nm,idx) {
          var rate = snapItems[idx]?Number(snapItems[idx].priceDay||0):rateForName(nm), amt = days * rate;
          if (!rate) { unpriced++; return; }
          if (primary === null) primary = nm;
          if (b.status === "done") { realized[nm] = (realized[nm] || 0) + amt; realizedTot += amt; }
          else { expected[nm] = (expected[nm] || 0) + amt; expectedTot += amt; }
        });
        // Zousaz nëmme bei ofgeschlossene Verleiher (echt kasséiert):
        // Zousaz-km × km-Tarif ginn automatesch gerechent + d'aner Käschten.
        if (b.status === "done") {
          var ex = retExtra[Number(b.id)] || 0, km = retKm[Number(b.id)] || 0, frozenKmRate=snapItems.reduce(function(v,x){return v||Number(x.extraKmRate||0);},0), kmCost = km * (frozenKmRate || KM_RATE), addon = ex + kmCost;
          if (addon) { var key = primary || names[0]; realized[key] = (realized[key] || 0) + addon; realizedTot += addon; }
          otherTot += ex; kmCostTot += kmCost; kmTot += km;
        }
      });
      var revKpis = [
        { cls: "ok", n: fmtEur(realizedTot), l: "Ëmsaz realiséiert", ic: "💰" },
        { cls: "accent", n: fmtEur(expectedTot), l: "Erwaart (confirméiert)", ic: "📅" },
        { cls: "", n: doneCount, l: "Ofgeschloss Locatiounen", ic: "✅" },
      ];
      $("an-rev-kpis").innerHTML = revKpis.map(function (t) { return '<div class="stat ' + t.cls + '"><div class="stat-ic">' + t.ic + '</div><div><div class="n" style="white-space:nowrap">' + t.n + '</div><div class="l">' + t.l + "</div></div></div>"; }).join("");
      var revNames = {}; Object.keys(realized).forEach(function (k) { revNames[k] = 1; }); Object.keys(expected).forEach(function (k) { revNames[k] = 1; });
      var revRows = Object.keys(revNames).map(function (nm) { return { nm: nm, r: realized[nm] || 0, e: expected[nm] || 0 }; }).sort(function (a, b) { return (b.r + b.e) - (a.r + a.e); });
      var rmax = revRows.reduce(function (m, x) { return Math.max(m, x.r + x.e); }, 0) || 1;
      var rpal = ["#2e7d5b", "#2f6df6", "#b7791f", "#7c4dff", "#0ea5a5", "#d6457f", "#546e7a", "#e63946"];
      $("an-rev-byveh").innerHTML = revRows.length ? revRows.map(function (x, i) {
        var w = Math.round((x.r + x.e) / rmax * 100);
        var exp = x.e ? '<small style="display:block;font-weight:600;font-size:0.72em;opacity:0.7">+ ' + fmtEur(x.e) + ' erwaart</small>' : "";
        return '<div style="display:flex;align-items:center;gap:10px;margin:8px 0">' +
          '<span style="flex:0 0 40%;max-width:40%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:0.9rem">' + esc(vehName(x.nm)) + '</span>' +
          '<div style="flex:1;height:12px;background:var(--line,#e6e9ee);border-radius:6px;overflow:hidden"><div style="height:100%;width:' + w + '%;background:' + rpal[i % rpal.length] + '"></div></div>' +
          '<span style="flex:0 0 auto;text-align:right;font-weight:800;white-space:nowrap">' + fmtEur(x.r) + exp + '</span>' +
          '</div>';
      }).join("") : '<p class="muted" style="font-size:0.85rem">Nach keng realiséiert oder confirméiert Locatioun.</p>';
      $("an-rev-note").textContent = "Basis: Locatiounsdeeg × de bei der Bestätegung gespäicherte Präis, plus Zousaz-km an aner Käschten aus dem Retourprotokoll." + ((kmCostTot || otherTot) ? " Dovunner " + fmtEur(kmCostTot) + " aus " + kmTot.toLocaleString("de-DE") + " Zousaz-km an " + fmtEur(otherTot) + " aner Käschten." : "") + " D'Kautioun zielt net als Ëmsaz." + (unpriced ? " Puer Gefierer ouni hannerluechte Präis goufen iwwersprongen." : "");

      // utilization per vehicle (count of rental-days in last 90d)
      var byVeh = {};
      rentals.forEach(function (b) { var v = b.veh || "?"; var f = parseDay(b.from), t = parseDay(b.to) || f; if (!f) return; var days = Math.max(1, Math.round((t - f) / 86400000) + 1); byVeh[v] = (byVeh[v] || 0) + days; });
      var cmap = vehColorMap(rentals);
      var util = Object.keys(byVeh).map(function (v) { return [v, byVeh[v]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8);
      var umax = util.length ? util[0][1] : 1;
      $("an-util").innerHTML = util.length ? util.map(function (u) { return '<div class="hbar"><span class="lbl">' + esc(vehName(u[0])) + '</span><div class="track"><div class="fill" style="width:' + Math.round(u[1] / umax * 100) + "%;background:" + cmap[u[0]] + '"></div></div><span class="val">' + u[1] + "d</span></div>"; }).join("") : '<p class="muted" style="font-size:0.85rem">Nach keng Donnéeën.</p>';

      // busiest weekdays (by booking start)
      var wk = [0, 0, 0, 0, 0, 0, 0];
      rentals.forEach(function (b) { var f = parseDay(b.from); if (f) wk[(f.getDay() + 6) % 7]++; });
      var wmax = Math.max.apply(null, wk) || 1;
      $("an-wk").innerHTML = wk.map(function (v) { return '<div class="wkbar' + (v === wmax && v > 0 ? " max" : "") + '" style="height:' + Math.max(4, Math.round(v / wmax * 100)) + '%" title="' + v + ' Reservatiounen"></div>'; }).join("");

      // appointment types donut
      var types = {};
      appts.forEach(function (a) { var s = (a.service || "Aner").split(/[\s(]/)[0]; types[s] = (types[s] || 0) + 1; });
      var seg = Object.keys(types).map(function (k) { return [k, types[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
      var tot = seg.reduce(function (a, b) { return a + b[1]; }, 0);
      var pal = ["#2f6df6", "#e63946", "#2e7d5b", "#b7791f", "#7c4dff", "#546e7a"];
      if (tot) {
        var off = 25, svg = "";
        seg.forEach(function (s, i) { var pct = s[1] / tot * 100; svg += '<circle r="15.9155" cx="21" cy="21" fill="transparent" stroke="' + pal[i] + '" stroke-width="7" stroke-dasharray="' + pct.toFixed(2) + " " + (100 - pct).toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '"></circle>'; off = (off - pct + 100) % 100; });
        $("an-donut").innerHTML = svg;
        $("an-donut-leg").innerHTML = seg.map(function (s, i) { return '<span><i style="background:' + pal[i] + '"></i>' + esc(s[0]) + " · " + Math.round(s[1] / tot * 100) + "%</span>"; }).join("");
      } else { $("an-donut").innerHTML = ""; $("an-donut-leg").innerHTML = '<span class="muted">Nach keng Rendez-vous.</span>'; }

      // trend: bookings per week last 12 weeks
      var weeks = [];
      for (var w = 11; w >= 0; w--) { var ws = startOfWeek(new Date(today)); ws.setDate(ws.getDate() - w * 7); weeks.push({ s: ws.getTime(), c: 0 }); }
      bk.forEach(function (b) { var d = parseDay(b.created || b.from); if (!d) return; var ws = startOfWeek(d).getTime(); for (var k = 0; k < weeks.length; k++) if (weeks[k].s === ws) { weeks[k].c++; break; } });
      var tmax = Math.max.apply(null, weeks.map(function (x) { return x.c; })) || 1, W = 320, H = 150, n = weeks.length;
      var pts = weeks.map(function (x, i) { return [(i / (n - 1) * W), H - 12 - x.c / tmax * (H - 28)]; });
      var line = pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ");
      var area = "0," + H + " " + line + " " + W + "," + H;
      var grid = "";
      for (var g = 1; g <= 3; g++) { var yy = H - 12 - (g * tmax / 3 / tmax * (H - 28)); grid += '<line x1="0" y1="' + yy.toFixed(1) + '" x2="' + W + '" y2="' + yy.toFixed(1) + '" stroke="var(--line)" stroke-width="1"/>'; }
      $("an-trend").innerHTML = grid + '<polygon points="' + area + '" fill="var(--info)" opacity="0.12"/><polyline points="' + line + '" fill="none" stroke="var(--info)" stroke-width="2.5"/><circle cx="' + pts[n - 1][0].toFixed(1) + '" cy="' + pts[n - 1][1].toFixed(1) + '" r="4" fill="var(--info)"/>';
    }).catch(function () { $("analyse-sub").textContent = "Serverfeeler"; $("analyse-kpis").innerHTML = '<div class="empty">⚠ Donnéeën net verfügbar.</div>'; });
  }

  /* ---------- Wartung ---------- */
  var editingMaint = null;
  function fleetImageSrc(url) {
    var value=String(url||"").trim();
    return /^assets\//.test(value)?"/"+value:value;
  }
  function showFleetPhoto(url) {
    var img=$("w-image-preview"), empty=$("w-image-placeholder"), remove=$("w-image-remove");
    if(url){img.src=fleetImageSrc(url);img.hidden=false;empty.hidden=true;remove.hidden=false;}
    else{img.removeAttribute("src");img.hidden=true;empty.hidden=false;remove.hidden=true;}
  }
  function resizeFleetPhoto(file) {
    return new Promise(function(resolve,reject){
      if(!file || !/^image\//.test(file.type||"")){reject(new Error("invalid_image"));return;}
      if(file.size>20*1024*1024){reject(new Error("too_large"));return;}
      var reader=new FileReader();
      reader.onerror=function(){reject(new Error("read_failed"));};
      reader.onload=function(){
        var img=new Image();
        img.onerror=function(){reject(new Error("invalid_image"));};
        img.onload=function(){
          var max=1400,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
          var canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
          var ctx=canvas.getContext("2d");ctx.drawImage(img,0,0,w,h);
          canvas.toBlob(function(blob){if(blob)resolve(blob);else reject(new Error("compress_failed"));},"image/webp",.78);
        };
        img.src=reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  function handleFleetPhoto(file) {
    var status=$("w-image-status");status.textContent="Bild gëtt virbereet …";
    resizeFleetPhoto(file).then(function(blob){
      status.textContent="Bild gëtt eropgelueden …";
      return STORE.uploadFleetImage(blob);
    }).then(function(r){
      if(r.error)throw new Error(r.error);
      $("w-image").value=r.url;showFleetPhoto(r.url);status.textContent="✓ Bild eropgelueden a prett fir ze späicheren.";
    }).catch(function(e){status.textContent=e.message==="too_large"?"D'Bild ass ze grouss (max. 20 MB).":"Bild konnt net eropgeluede ginn. Probéiert w.e.g. nach eng Kéier.";});
  }
  function fleetStatus(s) { return {ready:["Asazbereet","ready"],rented:["Verlount","rented"],service:["Am Service","service"],blocked:["Gespaart","blocked"]}[s] || ["Asazbereet","ready"]; }
  function fleetTypeLabel(t) { return {van:"Transporter",car:"Auto",trailer:"Unhänger"}[t] || "Transporter"; }
  function syncFleetType() {
    var trailer = $("w-type").value === "trailer";
    $("w-braked-wrap").hidden = !trailer;
    // Felder, déi nëmme fir motoriséiert Gefierer gëllen, bei enger Remorque verstoppen.
    ["w-seats", "w-fuel", "w-transmission", "w-included-km", "w-extra-km-rate"].forEach(function (id) {
      var el = $(id), f = el && el.closest ? el.closest(".field") : null; if (f) f.style.display = trailer ? "none" : "";
    });
    var loadLbl = document.querySelector('label[for="w-load"]'); if (loadLbl) loadLbl.textContent = trailer ? "Dimensiounen" : "Luedraum / Dimensiounen";
    var lic = $("w-license"); if (lic) lic.placeholder = trailer ? "BE" : "B";
  }
  function fleetPayload() { return { type:$("w-type").value,vehicle:$("w-veh").value.trim(),plate:$("w-plate").value.trim(),status:$("w-status").value,service:$("w-service").value.trim(),dueDate:$("w-due").value,note:$("w-note").value.trim(),description:$("w-description").value.trim(),imageUrl:$("w-image").value.trim(),priceDay:$("w-price").value,deposit:$("w-deposit").value,includedKm:$("w-included-km").value,extraKmRate:$("w-extra-km-rate").value,lateFeeHour:$("w-late-fee").value,year:$("w-year").value.trim(),seats:$("w-seats").value.trim(),fuel:$("w-fuel").value.trim(),transmission:$("w-transmission").value.trim(),licenseClass:$("w-license").value.trim(),loadSpace:$("w-load").value.trim(),grossWeight:$("w-gross").value.trim(),payload:$("w-payload").value.trim(),braked:$("w-braked").checked,features:$("w-features").value.trim(),active:$("w-active").checked }; }
  function fillFleet(m) { $("w-type").value=m.type||"van"; syncFleetType(); $("w-veh").value=m.vehicle||""; $("w-plate").value=m.plate||""; $("w-status").value=m.status||"ready"; $("w-service").value=m.service||""; $("w-due").value=m.dueDate||""; $("w-note").value=m.note||""; $("w-description").value=m.description||""; $("w-image").value=m.imageUrl||""; showFleetPhoto(m.imageUrl||""); $("w-price").value=m.priceDay==null?"":m.priceDay; $("w-deposit").value=m.deposit==null?"":m.deposit; $("w-included-km").value=m.includedKm==null?"":m.includedKm; $("w-extra-km-rate").value=m.extraKmRate==null?"":m.extraKmRate; $("w-late-fee").value=m.lateFeeHour==null?"":m.lateFeeHour; $("w-year").value=m.year||""; $("w-seats").value=m.seats||""; $("w-fuel").value=m.fuel||""; $("w-transmission").value=m.transmission||""; $("w-license").value=m.licenseClass||""; $("w-load").value=m.loadSpace||""; $("w-gross").value=m.grossWeight||""; $("w-payload").value=m.payload||""; $("w-braked").checked=!!m.braked; $("w-features").value=m.features||""; $("w-active").checked=!!m.active; }
  var blockVehicle = null;
  function closeFleetForm() {
    editingMaint = null; blockVehicle = null;
    var f = $("wartung-form"); if (f) f.reset();
    syncFleetType(); showFleetPhoto("");
    $("fleet-overlay").hidden = true;
    $("fleet-block-mgr").hidden = true;
    $("wartung-form-title").textContent = "Locatiounsobjet an d'Flotte bäisetzen";
    $("w-submit").textContent = "Bäisetzen";
    $("wartung-msg").textContent = "";
    $("w-image-status").textContent = "D'Bild gëtt virum Eroplueden automatesch verkleinert.";
  }
  function openFleetForm(m) {
    if (!can("bookings.validate")) return;
    $("fleet-overlay").hidden = false;
    $("fleet-overlay").scrollTop = 0;
    var mb = document.querySelector("#fleet-overlay .fleet-modal-body"); if (mb) mb.scrollTop = 0;
    if (m) {
      editingMaint = m.id; blockVehicle = m.vehicle; fillFleet(m);
      $("wartung-form-title").textContent = "Gefier – Detailer";
      $("w-submit").textContent = "Späicheren";
      $("wartung-msg").textContent = "";
      $("fleet-block-mgr").hidden = false;
      renderFleetBlocks();
    } else {
      editingMaint = null; blockVehicle = null; $("wartung-form").reset(); syncFleetType(); showFleetPhoto("");
      $("wartung-form-title").textContent = "Neit Gefier bäisetzen";
      $("w-submit").textContent = "Bäisetzen";
      $("wartung-msg").textContent = "";
      $("fleet-block-mgr").hidden = true;
    }
    setTimeout(function () { try { $("w-veh").focus(); } catch (e) {} }, 60);
  }
  function renderFleetBlocks() {
    var list = $("fb-list"); if (!list) return;
    if (!blockVehicle) { list.innerHTML = ""; return; }
    list.innerHTML = '<p class="muted" style="font-size:0.82rem">Gëtt gelueden …</p>';
    STORE.listFleetBlocks(blockVehicle).then(function (items) {
      items = items || [];
      if (!items.length) { list.innerHTML = '<p class="muted" style="font-size:0.82rem">Keng aktiv Spären fir dëst Gefier.</p>'; return; }
      list.innerHTML = items.map(function (b) {
        var span = b.fromDate === b.toDate ? dLabel(b.fromDate) : dLabel(b.fromDate) + " → " + dLabel(b.toDate);
        return '<div class="blank-docs-row"><span>🚫 <strong>' + esc(span) + '</strong>' + (b.reason ? ' · ' + esc(b.reason) : '') + '</span><button class="btn btn-danger btn-sm" data-fbdel="' + b.id + '" type="button">Läschen</button></div>';
      }).join("");
      list.querySelectorAll("[data-fbdel]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = parseInt(btn.getAttribute("data-fbdel"), 10);
          if (!confirm("Dës Spär ophiewen?")) return;
          STORE.delFleetBlock(id).then(function (r) { if (r.error) { toast(errMsg(r.error)); return; } toast("Spär opgehuewen."); renderFleetBlocks(); });
        });
      });
    }).catch(function () { list.innerHTML = '<p class="muted" style="font-size:0.82rem">⚠ Spären net gelueden.</p>'; });
  }
  function renderWartung() {
    var canEdit = can("bookings.validate");
    $("fleet-add-toggle").style.display = canEdit ? "" : "none";
    if (!canEdit) $("fleet-overlay").hidden = true;
    STORE.listMaintenance().then(function (items) {
      var body=$("wartung-body"); body.innerHTML="";
      fleetCache = items;
      (function(){ var sel=$("blank-doc-veh"); if(!sel)return; var keep=sel.value; Array.prototype.slice.call(sel.querySelectorAll('option[value^="id:"]')).forEach(function(o){o.remove();}); items.forEach(function(m){ var o=document.createElement("option"); o.value="id:"+m.id; o.textContent=m.vehicle+" ("+fleetTypeLabel(m.type)+")"; sel.appendChild(o); }); try{sel.value=keep;}catch(e){} })();
      if(!items.length){body.innerHTML='<p class="empty">Nach kee Locatiounsobjet an der Flotte.</p>';return;}
      items.forEach(function(m){var fs=fleetStatus(m.status),card=document.createElement("article"),ic=m.type==="trailer"?"🛻":(m.type==="car"?"🚗":"🚐");card.className="fleet-card";if(canEdit){card.setAttribute("data-mopen",m.id);card.setAttribute("role","button");card.setAttribute("tabindex","0");card.setAttribute("aria-label",m.vehicle+" – Detailer opmaachen");}card.innerHTML=(m.imageUrl?'<img src="'+esc(fleetImageSrc(m.imageUrl))+'" alt="'+esc(m.vehicle)+'">':'<div class="stat-ic">'+ic+'</div>')+'<div><h3>'+esc(m.vehicle)+'</h3><span class="fleet-status fleet-'+fs[1]+'">'+fs[0]+'</span> <span class="fleet-private">'+fleetTypeLabel(m.type)+'</span> <span class="'+(m.active?'fleet-public':'fleet-private')+'">'+(m.active?'● Online sichtbar':'○ Intern')+'</span><p>'+esc(m.description||'Keng ëffentlech Beschreiwung')+'</p><p>'+esc(m.service||'Nach Bedarf')+(m.dueDate?' · '+dLabel(m.dueDate):'')+(m.priceDay!==''?' · '+esc(m.priceDay)+' €/Dag':'')+'</p></div><div class="fleet-actions">'+(canEdit?'<span class="fleet-open-hint">Detailer ›</span> <button class="btn btn-danger btn-sm" data-mdel="'+m.id+'">Läschen</button>':'')+'</div>';body.appendChild(card);});
      function openCard(el){var id=parseInt(el.getAttribute("data-mopen"),10),m=items.filter(function(x){return x.id===id;})[0];if(m)openFleetForm(m);}
      body.querySelectorAll("[data-mopen]").forEach(function(c){c.addEventListener("click",function(){openCard(c);});c.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();openCard(c);}});});
      body.querySelectorAll("[data-mdel]").forEach(function(b){b.addEventListener("click",function(e){e.stopPropagation();var id=parseInt(b.getAttribute("data-mdel"),10);if(!confirm("Dëst Gefier aus der Flotte läschen?"))return;STORE.delMaintenance(id).then(function(r){if(r.error){toast(errMsg(r.error));return;}toast("Gefier geläscht.");renderWartung();});});});
    }).catch(function () { $("wartung-body").innerHTML = '<p class="empty">⚠ Net gelueden. <button class="btn btn-outline btn-sm" id="retry-wartung">Nei probéieren</button></p>'; var r = $("retry-wartung"); if (r) r.addEventListener("click", renderWartung); });
  }
  (function () {
    var f = $("wartung-form"); if (!f) return;
    $("w-type").addEventListener("change",syncFleetType); syncFleetType();
    $("w-camera-btn").addEventListener("click",function(){$("w-camera").click();});
    $("w-gallery-btn").addEventListener("click",function(){$("w-gallery").click();});
    [$("w-camera"),$("w-gallery")].forEach(function(inp){inp.addEventListener("change",function(){if(inp.files&&inp.files[0])handleFleetPhoto(inp.files[0]);inp.value="";});});
    $("w-image-remove").addEventListener("click",function(){$("w-image").value="";showFleetPhoto("");$("w-image-status").textContent="Bild ewechgeholl – späichere fir z'iwwerhuelen.";});
    $("fleet-add-toggle").addEventListener("click", function () { openFleetForm(null); });
    $("fleet-form-close").addEventListener("click", closeFleetForm);
    $("fleet-form-cancel").addEventListener("click", closeFleetForm);
    $("fleet-overlay").addEventListener("click", function (e) { if (e.target === $("fleet-overlay")) closeFleetForm(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("fleet-overlay").hidden) closeFleetForm(); });
    $("fb-add").addEventListener("click", function () {
      if (!can("bookings.validate") || !blockVehicle) return;
      var from = $("fb-from").value, to = $("fb-to").value || from;
      if (!from) { $("fb-msg").textContent = "Wiel op d'mannst den Ufanksdatum."; return; }
      if (to < from) { $("fb-msg").textContent = "D'Enndatum däerf net virum Ufank leien."; return; }
      $("fb-msg").textContent = "…";
      STORE.addFleetBlock({ vehicle: blockVehicle, from: from, to: to, reason: $("fb-reason").value.trim() }).then(function (r) {
        if (r.error) { $("fb-msg").textContent = errMsg(r.error); return; }
        $("fb-from").value = ""; $("fb-to").value = ""; $("fb-reason").value = ""; $("fb-msg").textContent = "✓ Gespäichert."; renderFleetBlocks();
      });
    });
    f.addEventListener("submit", function (e) {
      e.preventDefault(); if (!can("bookings.validate")) return;
      var data=fleetPayload(); if(!data.vehicle){$("wartung-msg").textContent="Den Numm vum Locatiounsobjet muss ausgefëllt sinn.";return;}
      $("wartung-msg").textContent = "…";
      var op=editingMaint?STORE.editMaintenance(editingMaint,data):STORE.addMaintenance(data); op.then(function (r) {
        if (r.error) { $("wartung-msg").textContent = errMsg(r.error); return; }
        toast("✓ Gespäichert."); closeFleetForm(); renderWartung();
      });
    });
  })();
  (function () {
    var box = $("blank-docs"); if (!box) return;
    box.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-blankdoc]"); if (!btn) return;
      var kind = btn.getAttribute("data-blankdoc"), L = btn.getAttribute("data-lang");
      var sel = $("blank-doc-veh"), val = sel ? sel.value : "blank-vehicle";
      var fleetId = val.indexOf("id:") === 0 ? parseInt(val.slice(3), 10) : 0;
      printFleetDoc(kind, L, fleetId, val === "blank-trailer");
    });
  })();

  /* ---------- Command palette (⌘K) ---------- */
  var searchIndex = [];
  function buildSearchIndex(bk, ap) {
    var idx = [];
    (bk || []).forEach(function (b) { idx.push({ ic: "🚗", grp: "Reservatiounen", ttl: b.veh, sub: b.name + " · " + dLabel(b.from) + "→" + dLabel(b.to) + (b.status === "new" ? " · NEI" : ""), ref: refOf(b.id), hay: (refOf(b.id) + " " + b.veh + " " + b.name + " " + (b.email || "") + " " + (b.phone || "")).toLowerCase(), go: { page: "bookings", filter: "all" } }); });
    (ap || []).forEach(function (a) { var kind = (a.kind || "appointment"); idx.push({ ic: kind === "inquiry" ? "🛞" : "🔧", grp: kind === "inquiry" ? "Produktufroen" : "Rendez-vous", ttl: (a.service || "—") + (a.vehicle ? " · " + a.vehicle : ""), sub: a.name + (a.prefDate ? " · " + a.prefDate : "") + (a.status === "new" ? " · NEI" : ""), ref: reqRef(kind, a.id), hay: (reqRef(kind, a.id) + " " + (a.service || "") + " " + (a.vehicle || "") + " " + a.name + " " + (a.email || "") + " " + (a.phone || "")).toLowerCase(), go: { page: kind === "inquiry" ? "inquiries" : "appointments", filter: "all" } }); });
    // distinct customers
    var seen = {};
    (bk || []).concat((ap || [])).forEach(function (r) { var key = (r.email || r.name || "").toLowerCase(); if (!key || seen[key]) return; seen[key] = 1; idx.push({ ic: "👤", grp: "Clienten", ttl: r.name, sub: (r.email || "") + (r.phone ? " · " + r.phone : ""), ref: "", hay: ((r.name || "") + " " + (r.email || "") + " " + (r.phone || "")).toLowerCase(), go: null }); });
    searchIndex = idx;
  }
  function renderK(q) {
    var box = $("k-results"); q = (q || "").toLowerCase().trim();
    var list = searchIndex.filter(function (it) { return !q || it.hay.indexOf(q) !== -1; }).slice(0, 40);
    if (!list.length) { box.innerHTML = '<div class="pnores">' + (q ? "Näischt fonnt fir „" + esc(q) + "“" : "Tipp fir ze sichen …") + "</div>"; return; }
    var groups = {}, order = [];
    list.forEach(function (it) { if (!groups[it.grp]) { groups[it.grp] = []; order.push(it.grp); } groups[it.grp].push(it); });
    var html = "";
    order.forEach(function (g) { html += '<div class="pgrp">' + g + "</div>"; groups[g].forEach(function (it) { var gi = searchIndex.indexOf(it); html += '<div class="pres" data-gi="' + gi + '"><span class="pic">' + it.ic + '</span><div style="min-width:0"><div class="pttl">' + esc(it.ttl) + '</div><div class="psub">' + esc(it.sub) + "</div></div>" + (it.ref ? '<span class="pref">' + it.ref + "</span>" : "") + "</div>"; }); });
    box.innerHTML = html;
    box.querySelectorAll("[data-gi]").forEach(function (r) { r.addEventListener("click", function () { var it = searchIndex[parseInt(r.getAttribute("data-gi"), 10)]; closeK(); if (it && it.go) { if (it.go.page === "bookings") { bookingQuery = it.ref || it.ttl; var se = $("booking-search"); if (se) se.value = bookingQuery; } else if (it.go.page === "appointments") { reqState.appointment.query = it.ref || ""; var ae = $("appt-search"); if (ae) ae.value = reqState.appointment.query; } else if (it.go.page === "inquiries") { reqState.inquiry.query = it.ref || ""; var ie = $("inq-search"); if (ie) ie.value = reqState.inquiry.query; } gotoPage(it.go.page); } }); });
  }
  function openK() { if (!session) return; $("k-overlay").hidden = false; var inp = $("k-input"); inp.value = ""; renderK(""); setTimeout(function () { inp.focus(); }, 30); }
  function closeK() { $("k-overlay").hidden = true; }
  (function () {
    var ov = $("k-overlay"), inp = $("k-input"), btn = $("btn-search");
    if (btn) btn.addEventListener("click", openK);
    if (inp) inp.addEventListener("input", function () { renderK(inp.value); });
    if (ov) ov.addEventListener("click", function (e) { if (e.target === ov) closeK(); });
    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) { if (!session) return; e.preventDefault(); $("k-overlay").hidden ? openK() : closeK(); }
      if (e.key === "Escape") { if (!$("k-overlay").hidden) closeK(); if (!$("daypop").hidden) closeDay(true); }
    });
  })();

  /* ---------- Theme toggle ---------- */
  (function () {
    var KEY = "gk_intern_theme", root = document.documentElement, btn = $("btn-theme");
    var saved = null; try { saved = localStorage.getItem(KEY); } catch (e) {}
    if (saved === "dark" || saved === "light") root.setAttribute("data-theme", saved);
    function cur() { var a = root.getAttribute("data-theme"); if (a) return a; return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light"; }
    function sync() { if (btn) btn.textContent = cur() === "dark" ? "☀️" : "🌙"; }
    sync();
    if (btn) btn.addEventListener("click", function () { var n = cur() === "dark" ? "light" : "dark"; root.setAttribute("data-theme", n); try { localStorage.setItem(KEY, n); } catch (e) {} sync(); });
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
  function afterSelfRename() { toast("Däi Benotzernumm gouf geännert – logg dech w.e.g. nei an."); setToken(null); setTimeout(function () { session = null; showLogin(); }, 1400); }
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
    if (!/^[a-z0-9._-]{3,}$/.test(username)) { $("add-msg").textContent = "Benotzernumm: op d'mannst 3 Zeechen (Klengbuschtawen, Zuelen, . _ -)."; return; }
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
  /* ---------- PWA: Service Worker + kontrolléierten Update-Hinweis ---------- */
  (function () {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js", { scope: "/intern/" }).then(function (reg) {
          function offerUpdate(worker) {
            if (!worker || $("pwa-update")) return;
            var bar=document.createElement("div");bar.id="pwa-update";bar.setAttribute("role","status");bar.style.cssText="position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:99999;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-radius:14px;background:#0b1b2b;color:#fff;box-shadow:0 12px 35px rgba(0,0,0,.28);font-weight:700";bar.innerHTML='<span>Eng nei Versioun ass prett.</span><button type="button" class="btn btn-primary btn-sm">Elo aktualiséieren</button>';bar.querySelector("button").addEventListener("click",function(){worker.postMessage({type:"SKIP_WAITING"});});document.body.appendChild(bar);
          }
          if (reg.waiting) offerUpdate(reg.waiting);
          reg.addEventListener("updatefound",function(){var w=reg.installing;if(w)w.addEventListener("statechange",function(){if(w.state==="installed"&&navigator.serviceWorker.controller)offerUpdate(w);});});
          var reloading=false;navigator.serviceWorker.addEventListener("controllerchange",function(){if(reloading)return;reloading=true;window.location.reload();});
          try { reg.update(); } catch (e) {}
          document.addEventListener("visibilitychange", function () { if (!document.hidden) { try { reg.update(); } catch (e) {} } });
          setInterval(function () { try { reg.update(); } catch (e) {} }, 60 * 60 * 1000);
        }).catch(function () {});
      });
    }
    var deferredPrompt = null, btn = $("btn-install");
    window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferredPrompt = e; if (btn) btn.hidden = false; });
    if (btn) btn.addEventListener("click", function () {
      if (!deferredPrompt) { toast("Fir z'installéieren: am Browser-Menü „Zum Startbildschierm bäifügen“ wielen."); return; }
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () { deferredPrompt = null; btn.hidden = true; });
    });
    window.addEventListener("appinstalled", function () { if (btn) btn.hidden = true; toast("App installéiert ✓"); });
  })();

  function boot() {
    setModebar();
    STORE.me().then(function (user) { if (user) { session = user; showApp(); } else { showLogin(); } }).catch(function () {
      showLogin(); $("modebar").className = "testbar"; $("modebar").textContent = "⚠ Server net erreechbar"; $("login-err").textContent = "Déi intern Verwaltung ass momentan net mam Server verbonnen. Probéiert et méi spéit nach eng Kéier.";
    });
  }
  boot();
})();
