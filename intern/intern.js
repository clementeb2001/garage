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

  function refOf(id) { return "R-" + (id >= 1000 ? id : id + 1000); }

  /* ======================================================================
     LIVE-STORE (Cloudflare-Worker)
     ====================================================================== */
  var TOKEN_KEY = "gk_intern_token";
  var token = null; try { token = localStorage.getItem(TOKEN_KEY); } catch (e) {}
  function setToken(t) { token = t || null; try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (e) {} }
  function onAuthLost() { setToken(null); if (!session) return; session = null; showLogin(); toast("Sessioun ofgelaf – logg dech w.e.g. nei an."); }
  function api(path, opts) {
    opts = opts || {}; var headers = {}; var hadSession = !!session || !!token;
    if (token) headers.Authorization = "Bearer " + token;
    var init = { method: opts.method || "GET", headers: headers, credentials: "include" };
    if (opts.body) { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(opts.body); }
    return fetch(API_BASE + path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && hadSession) setTimeout(onAuthLost, 0);
        return { status: r.status, body: j };
      });
    });
  }
  function uploadImage(blob, scope) {
    var headers = { "Content-Type": blob.type || "image/webp" };
    if (token) headers.Authorization = "Bearer " + token;
    return fetch(API_BASE + "/media/" + (scope === "protocol" ? "protocol" : "fleet"), { method:"POST", headers:headers, credentials:"include", body:blob }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401) setTimeout(onAuthLost, 0);
        return r.status === 200 ? { ok:true, url:j.url } : { error:j.error || "upload_failed" };
      });
    });
  }
  var liveStore = {
    mode: "live",
    login: function (u, p) { return api("/auth/login", { method: "POST", body: { username: u, password: p } }).then(function (r) { if (r.status === 200) { if (r.body.token) setToken(r.body.token); return { ok: true, user: r.body.user }; } return { error: r.body.error || "invalid_credentials" }; }); },
    me: function () { return api("/auth/me").then(function (r) { return r.status === 200 ? r.body.user : null; }); },
    logout: function () { return api("/auth/logout", { method: "POST" }).then(function (r) { setToken(null); return r; }); },
    changePassword: function (cur, next) { return api("/auth/password", { method: "POST", body: { current: cur, next: next } }).then(function (r) { if (r.status === 200) { if (r.body.token) setToken(r.body.token); return { ok: true }; } return { error: r.body.error || "error" }; }); },
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
    listMaintenance: function () { return api("/maintenance").then(function (r) { if (r.status !== 200) throw new Error(r.body.error || "server_error"); return r.body.items; }); },
    addMaintenance: function (p) { return api("/maintenance", { method: "POST", body: p }).then(function (r) { return r.status === 200 ? { ok: true, id: r.body.id } : { error: r.body.error }; }); },
    editMaintenance: function (id, p) { return api("/maintenance/" + id, { method: "POST", body: p }).then(function (r) { return r.status === 200 ? { ok: true } : { error: r.body.error }; }); },
    delMaintenance: function (id) { return api("/maintenance/" + id, { method: "DELETE" }).then(function (r) { return r.status === 200 ? { ok: true } : { error: r.body.error }; }); },
    listInspections: function () { return api("/rental-inspections").then(function (r) { if (r.status !== 200) throw new Error(r.body.error || "server_error"); return r.body.items; }); },
    saveInspection: function (p) { return api("/rental-inspections", { method: "POST", body: p }).then(function (r) { return r.status === 200 ? { ok:true } : { error:r.body.error }; }); },
    uploadFleetImage: function(blob){return uploadImage(blob,"fleet");},
    uploadProtocolImage: function(blob){return uploadImage(blob,"protocol");},
  };

  var STORE = liveStore;
  var session = null;
  function can(perm) { return !!(session && ROLES[session.role] && ROLES[session.role].perms.indexOf(perm) !== -1); }
  var ERR = { invalid_credentials: "Falsche Benotzernumm oder falscht Passwuert.", wrong_current: "Aktuellt Passwuert ass falsch.", weak_password: "Neit Passwuert ze kuerz (op mannst 8 Zeechen).", exists: "Dee Benotzernumm gëtt et schonn.", last_admin: "Et muss op mannst een Admin bleiwen.", self: "Du kanns dech net selwer läschen.", bad_input: "Ongëlteg Agab.", forbidden: "Keng Berechtegung.", rate_limited: "Ze vill Loginversich. Waart w.e.g. eng Stonn oder rufft den Admin un.", booking_conflict: "Dëst Gefier ass an dësem Zäitraum schonn bestätegt – kee Konflikt méiglech.", not_found: "Reservatioun net fonnt.", bad_status: "Ongëltege Status.", missing_fields: "Pflichtfelder feelen (Gefier, Numm, Vun, Bis).", invalid_fields: "Ongëlteg E-Mail oder Datum.", invalid_protocol: "D'Protokoll enthält eng ongëlteg oder feelend Ënnerschrëft beziehungsweise Zuel.", invalid_period: "D'Enddatum muss nom Ufanksdatum leien.", forbidden_origin: "Zougrëff vun dëser Adress blockéiert – benotzt w.e.g. https://autoservicebettenduerf.lu/intern/", server_not_configured: "Server net konfiguréiert." };
  function errMsg(e) { return ERR[e] || "Feeler – probéiert nach eng Kéier."; }

  /* ---------- Views ---------- */
  var activePage = "bookings", activeFilter = "all", editingMember = null, editingBooking = null, bookingQuery = "", protocolOpen = null, inspections = [];
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
  var searchEl = $("booking-search"); if (searchEl) searchEl.addEventListener("input", function () { bookingQuery = searchEl.value.trim(); renderBookings(); });
  var apptSearchEl = $("appt-search"); if (apptSearchEl) apptSearchEl.addEventListener("input", function () { reqState.appointment.query = apptSearchEl.value.trim(); renderReq("appointment"); });
  var inqSearchEl = $("inq-search"); if (inqSearchEl) inqSearchEl.addEventListener("input", function () { reqState.inquiry.query = inqSearchEl.value.trim(); renderReq("inquiry"); });

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
  function rentalEstimate(b) {
    var from = new Date(b.from), to = new Date(b.to);
    if (isNaN(from) || isNaN(to) || to <= from || String(b.veh || "").toLowerCase().indexOf("renault master") === -1) return "";
    var days = Math.max(1, Math.ceil((to - from) / 86400000));
    return days + " × 24 h · viraussiichtlech " + (days * 80) + " €";
  }
  function inspectionFor(id, stage) { return inspections.filter(function (x) { return Number(x.bookingId) === Number(id) && x.stage === stage; })[0] || null; }
  function nowLocal() { var d=new Date(), z=function(n){return n<10?"0"+n:n;}; return d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate())+"T"+z(d.getHours())+":"+z(d.getMinutes()); }
  function protocolPhotoList(value) { return String(value||"").split("\n").map(function(v){return v.trim();}).filter(function(v){return /^https:\/\/garage-admin\.autoservicebettenduerf\.lu\/media\/protocol\//.test(v);}); }
  function protocolPhotosHtml(p,value) { var urls=protocolPhotoList(value); return '<div class="protocol-photo-list" id="'+p+'photo-list">'+urls.map(function(url,i){return '<div class="protocol-photo"><img src="'+url+'" alt="Protokollfoto '+(i+1)+'"><button type="button" data-remove-photo="'+i+'" aria-label="Foto ewechhuelen">×</button></div>';}).join('')+'</div>'; }
  function inspectionChecklist(x) { try { return JSON.parse(x.checklistJson || "{}"); } catch (e) { return {}; } }
  function protocolHtml(b, stage) {
    var x=inspectionFor(b.id,stage)||{}, p="pr-"+b.id+"-"+stage+"-", pickup=stage==="pickup", title=pickup?"Iwwergabprotokoll":"Retourprotokoll",storedSignature=/^https:\/\/garage-admin\.autoservicebettenduerf\.lu\/media\/protocol\//.test(x.customerSignature||"")?x.customerSignature:"",f=matchFleet(b.veh)||{},trailer=f.type==="trailer",c=inspectionChecklist(x);
    return '<div class="protocol-box"><h4>'+title+(x.id?' <span class="protocol-saved">✓ gespäichert</span>':'')+'</h4><div class="protocol-grid">'+
      '<div class="protocol-section">Basisdaten</div>'+
      '<label>Zäitpunkt<input id="'+p+'at" type="datetime-local" value="'+esc(dtLocal(x.inspectedAt)||nowLocal())+'"></label>'+
      (trailer?'':'<label>Kilometerstand<input id="'+p+'km" type="number" min="0" inputmode="numeric" value="'+esc(x.odometer==null?'':x.odometer)+'"></label><label>Brennstoff- / Luedstand<select id="'+p+'fuel">'+["Voll / 100 %","3/4 / 75 %","1/2 / 50 %","1/4 / 25 %","Eidel / 0 %"].map(function(v){return '<option'+(x.fuelLevel===v?' selected':'')+'>'+v+'</option>';}).join('')+'</select></label>')+
      '<label>Unzuel Schlësselen<input id="'+p+'keys" type="number" min="0" max="10" inputmode="numeric" value="'+esc(c.keyCount==null?'':c.keyCount)+'"></label>'+
      (pickup?'':'<label>Zousaz-km<input id="'+p+'extraKm" type="number" min="0" value="'+esc(x.extraKm==null?'':x.extraKm)+'"></label><label>Zousazkäschten (€)<input id="'+p+'extraCosts" type="number" min="0" step="0.01" value="'+esc(x.extraCosts==null?'':x.extraCosts)+'"></label>')+
      '<div class="protocol-section">Kontroll</div>'+
      '<label>Propretéit<select id="'+p+'cleanliness">'+["Propper","Liicht verschmotzt","Staark verschmotzt"].map(function(v){return '<option'+(c.cleanliness===v?' selected':'')+'>'+v+'</option>';}).join('')+'</select></label>'+
      '<div class="protocol-checks"><label class="protocol-check"><input id="'+p+'documents" type="checkbox"'+(c.documentsChecked?' checked':'')+'> Dokumenter kontrolléiert</label><label class="protocol-check"><input id="'+p+'lights" type="checkbox"'+(c.lightsChecked?' checked':'')+'> Beliichtung kontrolléiert</label><label class="protocol-check"><input id="'+p+'tyres" type="checkbox"'+(c.tyresChecked?' checked':'')+'> Pneuen a Rieder kontrolléiert</label><label class="protocol-check"><input id="'+p+'joint" type="checkbox"'+(c.jointInspection?' checked':'')+'> Zesumme mam Client kontrolléiert</label></div>'+
      '<label class="wide">Allgemengen Zoustand<textarea id="'+p+'condition" rows="2" placeholder="Kuerz a sachlech beschreiwen">'+esc(x.conditionNote||'')+'</textarea></label>'+
      '<label class="wide">'+(pickup?'Besteeënd Schied / Feststellungen':'Nei Schied / Feststellungen')+'<textarea id="'+p+'damage" rows="2" placeholder="Positioun, Aart an Ëmfang uginn; wann näischt: Keng">'+esc(x.damageNote||'')+'</textarea></label>'+
      '<label class="wide">Schlësselen, Dokumenter an Ekipement<textarea id="'+p+'accessories" rows="2" placeholder="z.B. 2 Schlësselen, Pabeieren, Sécherheetswest, Spannriemen">'+esc(x.accessories||'')+'</textarea></label>'+
      '<div class="protocol-section">Fotodokumentatioun</div><p class="protocol-help">Recommandéiert: vir, hannen, béid Säiten, Cockpit/Zielerstand an all Schued. Dës Fotoe sinn nëmme fir ageloggt Personal zougänglech.</p>'+
      '<div class="wide"><div class="protocol-photo-actions"><button class="btn btn-outline btn-sm" type="button" id="'+p+'camera-btn">📷 Foto maachen</button><button class="btn btn-outline btn-sm" type="button" id="'+p+'gallery-btn">Biller auswielen</button></div><input id="'+p+'camera" type="file" accept="image/*" capture="environment" hidden><input id="'+p+'gallery" type="file" accept="image/*" multiple hidden><textarea id="'+p+'photos" hidden>'+esc(x.photoRefs||'')+'</textarea><p class="fleet-photo-note" id="'+p+'photo-status"></p>'+protocolPhotosHtml(p,x.photoRefs)+'</div>'+
      '<div class="protocol-section">Bestätegung</div>'+
      '<label>Numm vum Mataarbechter<input id="'+p+'staff" value="'+esc(x.staffSignature||session.name||'')+'"></label>'+
      (pickup?'<label class="protocol-check"><input id="'+p+'license" type="checkbox"'+(x.licenseChecked?' checked':'')+'> Führerschäin an Identitéit kontrolléiert</label>':'')+
      '<label class="wide">Intern Notiz<textarea id="'+p+'note" rows="2">'+esc(x.note||'')+'</textarea></label>'+
      '<div class="signature-wrap"><strong>Ënnerschrëft vum Client · '+esc(b.name)+'</strong><p class="protocol-help">D’Ënnerschrëft bestätegt, datt den hei dokumentéierten Zoustand zesumme kontrolléiert gouf.</p><canvas class="signature-pad" id="'+p+'signature" data-existing="'+encodeURIComponent(storedSignature)+'" aria-label="Ënnerschrëftsfeld"></canvas>'+(storedSignature?'<img class="signature-existing" id="'+p+'signature-existing" src="'+storedSignature+'" alt="Gespäichert Ënnerschrëft">':'')+'<div class="signature-tools"><span>De Client kann hei mam Fanger ënnerschreiwen.</span><button class="btn btn-outline btn-sm" type="button" id="'+p+'signature-clear">Läschen</button></div></div></div>'+
      '<div class="b-actions"><button class="btn btn-ok btn-sm" data-save-protocol="'+b.id+'" data-stage="'+stage+'">Protokoll späicheren</button><button class="btn btn-outline btn-sm" data-close-protocol="1">Zoumaachen</button></div></div>';
  }
  function drawSignaturePad(canvas) { var rect=canvas.getBoundingClientRect(),dpr=Math.max(1,window.devicePixelRatio||1),ctx;canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));ctx=canvas.getContext("2d");ctx.scale(dpr,dpr);ctx.strokeStyle="#111827";ctx.lineWidth=2.2;ctx.lineCap="round";ctx.lineJoin="round";var drawing=false;function pos(e){var r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}canvas.addEventListener("pointerdown",function(e){drawing=true;canvas.setPointerCapture(e.pointerId);var q=pos(e);ctx.beginPath();ctx.moveTo(q.x,q.y);canvas._signed=true;var old=$(canvas.id+"-existing");if(old)old.hidden=true;e.preventDefault();});canvas.addEventListener("pointermove",function(e){if(!drawing)return;var q=pos(e);ctx.lineTo(q.x,q.y);ctx.stroke();e.preventDefault();});function stop(){drawing=false;}canvas.addEventListener("pointerup",stop);canvas.addEventListener("pointercancel",stop);}
  function refreshProtocolPhotos(p) { var box=$(p+"photo-list"),urls=protocolPhotoList($(p+"photos").value),status=$(p+"photo-status");box.innerHTML=urls.map(function(url,i){return '<div class="protocol-photo"><img src="'+url+'" alt="Protokollfoto '+(i+1)+'"><button type="button" data-remove-photo="'+i+'" aria-label="Foto ewechhuelen">×</button></div>';}).join('');if(status)status.textContent=urls.length?urls.length+' Foto(en) gespäichert'+(urls.length<6?' · 6 Perspektive recommandéiert':' · Dokumentatioun komplett'):'Nach keng Foto · 6 Perspektive recommandéiert';box.querySelectorAll("[data-remove-photo]").forEach(function(btn){btn.addEventListener("click",function(){urls.splice(parseInt(btn.getAttribute("data-remove-photo"),10),1);$(p+"photos").value=urls.join("\n");refreshProtocolPhotos(p);});}); }
  function addProtocolPhotos(p,files) { var status=$(p+"photo-status"),list=Array.prototype.slice.call(files||[]);if(!list.length)return;status.textContent="Fotoe ginn eropgelueden …";Promise.all(list.map(function(file){return resizeFleetPhoto(file).then(function(blob){return STORE.uploadProtocolImage(blob);});})).then(function(results){var urls=protocolPhotoList($(p+"photos").value);results.forEach(function(r){if(r&&r.url)urls.push(r.url);});$(p+"photos").value=urls.join("\n");refreshProtocolPhotos(p);status.textContent="✓ "+results.length+" Foto(en) eropgelueden.";}).catch(function(){status.textContent="E Foto konnt net eropgeluede ginn. Probéiert nach eng Kéier.";}); }
  function initProtocolUi(b,stage) { var p="pr-"+b.id+"-"+stage+"-",canvas=$(p+"signature");if(!canvas)return;drawSignaturePad(canvas);refreshProtocolPhotos(p);$(p+"camera-btn").addEventListener("click",function(){$(p+"camera").click();});$(p+"gallery-btn").addEventListener("click",function(){$(p+"gallery").click();});[$(p+"camera"),$(p+"gallery")].forEach(function(inp){inp.addEventListener("change",function(){addProtocolPhotos(p,inp.files);inp.value="";});});$(p+"signature-clear").addEventListener("click",function(){var ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);canvas._signed=false;canvas.dataset.existing="";var old=$(p+"signature-existing");if(old)old.hidden=true;}); }
  function signatureBlob(canvas) { return new Promise(function(resolve){canvas.toBlob(function(blob){resolve(blob);},"image/webp",.9);}); }

  /* ---------- Professionellt Protokoll-PDF (iwwer Drécken → "Als PDF späicheren") ---------- */
  var fleetCache = null;
  function ensureFleetCache() { if (fleetCache) return Promise.resolve(fleetCache); return STORE.listMaintenance().then(function (i) { fleetCache = i || []; return fleetCache; }, function () { fleetCache = []; return fleetCache; }); }
  function matchFleet(veh) { var k = String(veh || "").toLowerCase().trim(); if (!k) return null; return (fleetCache || []).filter(function (m) { var mv = String(m.vehicle || "").toLowerCase().trim(); return mv && (mv === k || k.indexOf(mv) !== -1 || mv.indexOf(k) !== -1); })[0] || null; }
  function ppRow(label, val) { return val ? '<tr><th>' + esc(label) + '</th><td>' + esc(val) + '</td></tr>' : ""; }
  function printProtocol(b, stage) {
    var p = "pr-" + b.id + "-" + stage + "-", pickup = stage === "pickup";
    ensureFleetCache().then(function () {
      var f = matchFleet(b.veh) || {};
      var val = function (id) { var e = $(p + id); return e ? e.value : ""; };
      var km = val("km"), fuel = val("fuel"), at = val("at"), condition = val("condition"), damage = val("damage"), accessories = val("accessories"), staff = val("staff"), note = val("note");
      var trailer = f.type === "trailer", cleanliness = val("cleanliness"), keys = val("keys");
      var extraKm = pickup ? "" : val("extraKm"), extraCosts = pickup ? "" : val("extraCosts");
      var licenseChecked = pickup && $(p + "license") ? $(p + "license").checked : false;
      var checkText = [$(p+"documents").checked?"Dokumenter":"",$(p+"lights").checked?"Beliichtung":"",$(p+"tyres").checked?"Pneuen/Rieder":"",$(p+"joint").checked?"zesumme mam Client":""].filter(Boolean).join(", ");
      var photos = protocolPhotoList($(p + "photos") ? $(p + "photos").value : "");
      var sigEl = $(p + "signature"), sigUrl = "";
      try { var ex = decodeURIComponent((sigEl && sigEl.dataset.existing) || ""); if (/^https:/.test(ex)) sigUrl = ex; } catch (e) {}
      if (sigEl && sigEl._signed) { try { sigUrl = sigEl.toDataURL("image/png"); } catch (e) {} }
      var ref = refOf(b.id), title = pickup ? "Iwwergab­protokoll" : "Retour­protokoll";
      var carRows = ppRow("Verleihobjet", b.veh) + ppRow("Typ", trailer?"Unhänger":(f.type==="car"?"Auto":"Transporter")) + ppRow("Baujoer", f.year) + ppRow("Brennstoff / Undriff", trailer?"":f.fuel) + ppRow(trailer?"Dimensiounen":"Luedraum", f.loadSpace) + ppRow("Führerschäin", f.licenseClass);
      var stateRows = ppRow("Datum / Zäit", at ? fmt(at) : "") + ppRow("Kilometerstand", km ? km + " km" : "") + ppRow("Brennstoff- / Luedstand", fuel) + ppRow("Schlësselen", keys) + ppRow("Propretéit", cleanliness) + ppRow("Kontrolléiert", checkText) +
        (pickup ? ppRow("Führerschäin & Identitéit kontrolléiert", licenseChecked ? "Jo" : "Nee") : (ppRow("Zousaz-Kilometer", extraKm ? extraKm + " km" : "") + ppRow("Zousazkäschten", extraCosts ? extraCosts + " €" : "")));
      var photoHtml = photos.length ? '<div class="pp-sec"><h3>Fotoen</h3><div class="pp-photos">' + photos.map(function (u) { return '<img src="' + u + '" alt="">'; }).join("") + "</div></div>" : "";
      var html =
        '<div class="pp-doc">' +
        '<div class="pp-head"><img class="pp-logo" src="../assets/autoservice-bettenduerf-logo.png" alt="Autoservice Bettenduerf"><div class="pp-co"><strong>Autoservice Bettenduerf</strong><br>63, rue de Diekirch-Echternach · L-9355 Bettendorf<br>+352 80 86 87 · Autoservicebettenduerf@outlook.com</div></div><div class="pp-accent"></div><div class="pp-main">' +
        '<div class="pp-titlebar"><h1>' + title + '</h1><div class="pp-ref">Réf. ' + esc(ref) + '<br>' + esc(fmt(new Date().toISOString())) + "</div></div>" +
        '<div class="pp-cols">' +
        '<div class="pp-sec"><h3>Client</h3><table class="pp-tbl">' + ppRow("Numm", b.name) + ppRow("E-Mail", b.email) + ppRow("Telefon", b.phone) + "</table></div>" +
        '<div class="pp-sec"><h3>Verleihobjet</h3><table class="pp-tbl">' + carRows + "</table></div>" +
        "</div>" +
        '<div class="pp-sec"><h3>Mietperiod</h3><table class="pp-tbl">' + ppRow("Vun", fmt(b.from)) + ppRow("Bis", fmt(b.to)) + "</table></div>" +
        '<div class="pp-sec"><h3>Zoustand bei der ' + (pickup ? "Iwwergab" : "Retour") + '</h3><table class="pp-tbl">' + stateRows + "</table>" +
        (condition ? '<p><strong>Allgemengen Zoustand:</strong> ' + esc(condition) + "</p>" : "") +
        (damage ? '<p><strong>Schied / Feststellungen:</strong> ' + esc(damage) + "</p>" : "") +
        (accessories ? '<p><strong>Schlësselen, Dokumenter an Ekipement:</strong> ' + esc(accessories) + "</p>" : "") +
        "</div>" +
        photoHtml +
        '<div class="pp-sec pp-terms"><h3>Bestätegung</h3><p>Dëse Protokoll dokumentéiert de gemeinsam festgestallten Zoustand beim ' + (pickup?'Ufank':'Enn') + ' vun der Locatioun. D’Ënnerschrëft bestätegt d’Kontroll an déi hei festgehalen Informatiounen.</p></div>' +
        '<div class="pp-sign"><div><span class="pp-sigbox">' + (sigUrl ? '<img src="' + sigUrl + '" alt="">' : "") + '</span><div class="pp-sigline">Ënnerschrëft Client · ' + esc(b.name) + "</div></div>" +
        '<div><span class="pp-sigbox"></span><div class="pp-sigline">Ënnerschrëft Autoservice Bettenduerf' + (staff ? " · " + esc(staff) : "") + "</div></div></div>" +
        '<footer class="pp-foot">Autoservice Bettenduerf · 63, rue de Diekirch-Echternach · L-9355 Bettendorf · +352 80 86 87 · autoservicebettenduerf.lu</footer>' +
        "</div></div>";
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
      printBtn.addEventListener("click", function () { try { window.print(); } catch (e) { toast("Drécken net méiglech op dësem Apparat – benotzt d'Deele-Funktioun fir als PDF ze späicheren."); } });
    });
  }
  function printCombinedProtocol(b) {
    var pickup=inspectionFor(b.id,"pickup"),returned=inspectionFor(b.id,"return");
    if(!pickup||!returned||!pickup.customerSignature||!returned.customerSignature){toast("Iwwergab a Retour musse fir d'éischt gespäichert an ënnerschriwwe sinn.");return;}
    ensureFleetCache().then(function(){
      var f=matchFleet(b.veh)||{},trailer=f.type==="trailer",ref=refOf(b.id);
      function yn(v){return v?"Jo":"Nee";}
      function stageHtml(x,pickupStage){
        var c=inspectionChecklist(x),photos=protocolPhotoList(x.photoRefs),checks=[c.documentsChecked?"Dokumenter":"",c.lightsChecked?"Beliichtung":"",c.tyresChecked?"Pneuen/Rieder":"",c.jointInspection?"zesumme mam Client":""].filter(Boolean).join(", ");
        var rows=ppRow("Datum / Zäit",fmt(x.inspectedAt))+ppRow("Kilometerstand",trailer?"":(x.odometer==null?"":x.odometer+" km"))+ppRow("Brennstoff- / Luedstand",trailer?"":x.fuelLevel)+ppRow("Schlësselen",c.keyCount)+ppRow("Propretéit",c.cleanliness)+ppRow("Kontrolléiert",checks)+(pickupStage?ppRow("Führerschäin & Identitéit",yn(x.licenseChecked)):ppRow("Zousaz-Kilometer",x.extraKm==null?"":x.extraKm+" km")+ppRow("Zousazkäschten",x.extraCosts==null?"":x.extraCosts+" €"));
        return '<section class="pp-stage"><div class="pp-stage-title"><span>'+(pickupStage?"1":"2")+'</span><div><small>'+(pickupStage?"UFANK VUN DER LOCATIOUN":"ENN VUN DER LOCATIOUN")+'</small><h2>'+(pickupStage?"Iwwergab":"Retour")+'</h2></div></div><div class="pp-sec"><h3>Zoustand</h3><table class="pp-tbl">'+rows+'</table>'+(x.conditionNote?'<p><strong>Allgemengen Zoustand:</strong> '+esc(x.conditionNote)+'</p>':"")+(x.damageNote?'<p><strong>'+(pickupStage?"Besteeënd":"Nei")+' Schied / Feststellungen:</strong> '+esc(x.damageNote)+'</p>':"")+(x.accessories?'<p><strong>Schlësselen, Dokumenter an Ekipement:</strong> '+esc(x.accessories)+'</p>':"")+'</div>'+(photos.length?'<div class="pp-sec"><h3>Fotodokumentatioun · '+photos.length+' Foto(en)</h3><div class="pp-photos">'+photos.map(function(u,i){return '<img src="'+u+'" alt="'+(pickupStage?"Iwwergab":"Retour")+' Foto '+(i+1)+'">';}).join("")+'</div></div>':"")+'<div class="pp-sign pp-sign-single"><div><span class="pp-sigbox"><img src="'+x.customerSignature+'" alt="Ënnerschrëft Client"></span><div class="pp-sigline">Ënnerschrëft Client · '+esc(b.name)+'</div></div><div><span class="pp-sigbox"></span><div class="pp-sigline">Autoservice Bettenduerf · '+esc(x.staffSignature||x.updatedBy||"")+'</div></div></div></section>';
      }
      var distance="";if(!trailer&&pickup.odometer!=null&&returned.odometer!=null&&Number(returned.odometer)>=Number(pickup.odometer))distance=(Number(returned.odometer)-Number(pickup.odometer))+" km";
      var carRows=ppRow("Verleihobjet",b.veh)+ppRow("Typ",trailer?"Unhänger":(f.type==="car"?"Auto":"Transporter"))+ppRow("Baujoer",f.year)+ppRow("Brennstoff / Undriff",trailer?"":f.fuel)+ppRow(trailer?"Dimensiounen":"Luedraum",f.loadSpace)+ppRow("Führerschäin",f.licenseClass);
      var html='<div class="pp-doc pp-combined"><div class="pp-head"><img class="pp-logo" src="../assets/autoservice-bettenduerf-logo.png" alt="Autoservice Bettenduerf"><div class="pp-co"><strong>Autoservice Bettenduerf</strong><br>63, rue de Diekirch-Echternach · L-9355 Bettendorf<br>+352 80 86 87 · Autoservicebettenduerf@outlook.com</div></div><div class="pp-accent"></div><div class="pp-main"><div class="pp-titlebar"><h1>Ofschlossprotokoll</h1><div class="pp-ref">Réf. '+esc(ref)+'<br>'+esc(fmt(new Date().toISOString()))+'</div></div><div class="pp-cols"><div class="pp-sec"><h3>Client</h3><table class="pp-tbl">'+ppRow("Numm",b.name)+ppRow("E-Mail",b.email)+ppRow("Telefon",b.phone)+'</table></div><div class="pp-sec"><h3>Verleihobjet</h3><table class="pp-tbl">'+carRows+'</table></div></div><div class="pp-sec"><h3>Locatioun</h3><table class="pp-tbl">'+ppRow("Vun",fmt(b.from))+ppRow("Bis",fmt(b.to))+ppRow("Gefuer Distanz",distance)+'</table></div>'+stageHtml(pickup,true)+stageHtml(returned,false)+'<div class="pp-sec pp-terms"><h3>Bestätegung</h3><p>Dëst Ofschlossprotokoll vereent d’Iwwergab an d’Retour. Déi zwou Ënnerschrëfte bestätegen déi jeeweils zesumme kontrolléiert an dokumentéiert Zoustänn.</p></div><footer class="pp-foot">Autoservice Bettenduerf · 63, rue de Diekirch-Echternach · L-9355 Bettendorf · +352 80 86 87 · autoservicebettenduerf.lu</footer></div></div>';
      var root=$("protocol-print-root");root.innerHTML='<div class="pp-bar pp-noprint"><span class="pp-hint" id="pp-status">Biller gi fir d’PDF virbereet …</span><button type="button" class="btn btn-primary btn-sm" id="pp-print" disabled>🖨️ Drécken / PDF</button><button type="button" class="btn btn-ghost btn-sm" id="pp-close">Zoumaachen</button></div>'+html;root.classList.add("open");document.body.classList.add("protocol-printing");document.body.style.overflow="hidden";
      function close(){root.classList.remove("open");document.body.classList.remove("protocol-printing");document.body.style.overflow="";root.innerHTML="";}$("pp-close").addEventListener("click",close);root.addEventListener("click",function(e){if(e.target===root)close();});
      var imgs=Array.prototype.slice.call(root.querySelectorAll(".pp-doc img")),btn=$("pp-print"),status=$("pp-status");Promise.all(imgs.map(function(img){return img.complete?Promise.resolve(img.naturalWidth>0):new Promise(function(resolve){img.addEventListener("load",function(){resolve(true);},{once:true});img.addEventListener("error",function(){resolve(false);},{once:true});});})).then(function(results){var failed=results.filter(function(ok){return !ok;}).length;btn.disabled=false;status.textContent=failed?failed+" Bild(er) konnten net geluede ginn — kontrolléiert d’Virschau.":"Iwwergab + Retour komplett — elo drécken oder als PDF späicheren.";});btn.addEventListener("click",function(){try{window.print();}catch(e){toast("Drécken net méiglech op dësem Apparat.");}});
    });
  }
  function saveProtocol(b,stage) { var p="pr-"+b.id+"-"+stage+"-",pickup=stage==="pickup",canvas=$(p+"signature"),existing=decodeURIComponent(canvas.dataset.existing||""),signature=Promise.resolve(existing),photos=protocolPhotoList($(p+"photos").value),km=$(p+"km"),fuel=$(p+"fuel");if(!$(p+"at").value||!$(p+"staff").value.trim()){toast("Zäitpunkt a Mataarbechter mussen ausgefëllt sinn.");return;}if(photos.length<4&&!confirm("Et si manner wéi 4 Fotoe gespäichert. Protokoll trotzdem späicheren?"))return;if(canvas._signed)signature=signatureBlob(canvas).then(function(blob){return STORE.uploadProtocolImage(blob);}).then(function(r){if(!r||r.error)throw new Error("signature_upload");return r.url;});signature.then(function(signatureUrl){if(!signatureUrl){toast("D'Ënnerschrëft vum Client feelt.");return;}return STORE.saveInspection({bookingId:b.id,stage:stage,inspectedAt:$(p+"at").value,odometer:km?km.value:"",fuelLevel:fuel?fuel.value:"",extraKm:pickup?"":$(p+"extraKm").value,extraCosts:pickup?"":$(p+"extraCosts").value,conditionNote:$(p+"condition").value,damageNote:$(p+"damage").value,photoRefs:$(p+"photos").value,accessories:$(p+"accessories").value,customerSignature:signatureUrl,staffSignature:$(p+"staff").value,licenseChecked:pickup?$(p+"license").checked:false,note:$(p+"note").value,checklist:{keyCount:$(p+"keys").value,cleanliness:$(p+"cleanliness").value,documentsChecked:$(p+"documents").checked,lightsChecked:$(p+"lights").checked,tyresChecked:$(p+"tyres").checked,jointInspection:$(p+"joint").checked}});}).then(function(r){if(!r)return;if(r.error){toast(errMsg(r.error));return;}toast("Protokoll gespäichert.");renderBookings();}).catch(function(){toast("D'Protokoll konnt net gespäichert ginn.");}); }
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
    if (canVal) actions += '<button class="btn btn-outline btn-sm" data-edit-booking="' + b.id + '">✎ Änneren</button>';
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
    if(protocolOpen && protocolOpen.id===b.id) setTimeout(function(){initProtocolUi(b,protocolOpen.stage);},0);
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
    defs.forEach(function (d) { var b = document.createElement("button"); b.type = "button"; b.className = "chip" + (reqState[kind].filter === d[0] ? " active" : ""); b.innerHTML = esc(d[1]) + ' <span class="count">(' + (c[d[0]] || 0) + ")</span>"; b.addEventListener("click", function () { reqState[kind].filter = d[0]; renderReq(kind); }); wrap.appendChild(b); });
  }
  function doReqAct(kind, id, status) { if (!can("bookings.validate")) return; var noteEl = $("rnote-" + kind + "-" + id), note = noteEl ? noteEl.value.trim() : ""; STORE.setApptStatus(id, status, note).then(function (r) { if (r.error) { toast(errMsg(r.error)); return; } toast(REQCFG[kind].noun + " " + reqRef(kind, id) + ": " + (STATUS[status] || status).toLowerCase() + "."); renderReq(kind); }); }
  function doDelReq(kind, id) { if (!can("members.manage")) return; if (!confirm(REQCFG[kind].noun + " " + reqRef(kind, id) + " endgülteg läschen?")) return; STORE.delAppt(id).then(function (r) { if (r.error) { toast(errMsg(r.error)); return; } toast(REQCFG[kind].noun + " " + reqRef(kind, id) + " geläscht."); renderReq(kind); }); }
  function reqCard(kind, a) {
    var el = document.createElement("div"); el.className = "booking" + (a.status === "new" ? " is-new" : "");
    var canVal = can("bookings.validate"), isAdmin = can("members.manage"), actions = "", nid = "rnote-" + kind + "-" + a.id;
    if (canVal && a.status === "new") actions = '<input class="b-note-input" id="' + nid + '" type="text" placeholder="Notiz (fräiwëlleg) …" /><button class="btn btn-ok btn-sm" data-ract="confirmed">✓ Bestätegen</button><button class="btn btn-outline btn-sm" data-ract="declined">✕ Ofleenen</button>';
    else if (canVal && a.status === "confirmed") actions = '<input class="b-note-input" id="' + nid + '" type="text" placeholder="Notiz (fräiwëlleg) …" /><button class="btn btn-outline btn-sm" data-ract="done">Als ofgeschloss markéieren</button>';
    if (isAdmin) actions += '<button class="btn btn-danger btn-sm" data-delr="1">Läschen</button>';
    var audit = (a.events || []).map(function (ev) { return '<div class="ev">• ' + esc(ev.action) + ' vum <b>' + esc(ev.by) + "</b>, " + fmt(ev.at) + (ev.note ? ' – „' + esc(ev.note) + "“" : "") + "</div>"; }).join("");
    var meta = [];
    if (a.vehicle) meta.push("🚗 " + esc(a.vehicle));
    if (a.prefDate) meta.push("📅 " + esc(a.prefDate) + (a.altDate ? " / " + esc(a.altDate) : "") + (a.daytime ? " · " + esc(a.daytime) : ""));
    if (a.vin) meta.push("VIN " + esc(a.vin));
    el.innerHTML =
      '<div class="b-top"><div><div class="b-veh">' + esc(a.service || REQCFG[kind].titleFb) + '</div><div class="b-id">Réf. ' + reqRef(kind, a.id) + "</div></div><span class=\"status status-" + a.status + '">' + esc(STATUS[a.status]) + "</span></div>" +
      (meta.length ? '<div class="b-dates" style="gap:6px 16px;flex-wrap:wrap">' + meta.join('<span class="arrow">·</span>') + "</div>" : "") +
      '<div class="b-cust"><strong>' + esc(a.name) + "</strong>" + (a.email ? "<span>✉ " + esc(a.email) + "</span>" : "") + (a.phone ? "<span>☎ " + esc(a.phone) + "</span>" : "") + "</div>" +
      (a.msg ? '<p class="b-msg">' + esc(a.msg) + "</p>" : "") +
      (actions ? '<div class="b-actions">' + actions + "</div>" : "") +
      '<div class="b-audit">' + audit + "</div>";
    el.querySelectorAll("[data-ract]").forEach(function (btn) { btn.addEventListener("click", function () { doReqAct(kind, a.id, btn.getAttribute("data-ract")); }); });
    el.querySelectorAll("[data-delr]").forEach(function (btn) { btn.addEventListener("click", function () { doDelReq(kind, a.id); }); });
    return el;
  }
  function renderReq(kind) {
    var c = REQCFG[kind];
    $(c.sub).textContent = can("bookings.validate") ? c.subAct : "Dir hutt Liesrechter (Kucker).";
    STORE.listAppointments().then(function (all) {
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
  function renderBookings() {
    $("bookings-sub").textContent = can("bookings.validate") ? "Ufroe bestätegen oder ofleenen. All Aktioun gëtt mam Benotzernumm festgehalen." : "Dir hutt Liesrechter (Kucker).";
    Promise.all([STORE.listBookings(), STORE.listInspections(), STORE.listMaintenance()]).then(function (allData) {
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
  var calRef = new Date(), dashActive = [], dashAppts = [];
  var dashBk = [], dashAp = [], dashMaint = [];
  var VEH_COLORS = ["#2f6df6", "#e63946", "#2e7d5b", "#b7791f", "#7c4dff", "#0ea5a5", "#d6457f", "#546e7a"];
  var APPT_COLOR = "#334155"; // Rendez-vousen (Service) — donkel, onofhängeg vun de Gefier-Faarwen
  function apptDay(a) { return parseDay(a.prefDate) || parseDay(a.altDate); }
  function dLabel(s) { var d = parseDay(s); if (!d) return esc(s || ""); function p(n) { return (n < 10 ? "0" : "") + n; } return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear(); }
  function timeStr(s) { if (!s) return ""; var d = new Date(s); if (isNaN(d)) return ""; return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function vehColorMap(bookings) { var map = {}, i = 0; bookings.forEach(function (b) { var v = b.veh || "?"; if (map[v] == null) { map[v] = VEH_COLORS[i % VEH_COLORS.length]; i++; } }); return map; }
  function parseDay(s) { if (!s) return null; var d = new Date(s); return isNaN(d) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
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
    ]).then(function (res) {
      var bk = res[0], ap = res[1];
      if (bk === null && ap === null) { throw new Error("load_failed"); }
      bk = bk || []; ap = ap || [];
      dashBk = bk; dashAp = ap; dashMaint = res[2] || [];
      updateNewBadge(bk);
      updateReqBadge("appointment", ap); updateReqBadge("inquiry", ap);
      var rentals = bk.filter(function (b) { return b.status !== "declined"; });
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
    if (!maint || !maint.length) { el.innerHTML = '<p class="muted" style="font-size:0.85rem">Nach keng Wartungs-Antrag. ' + (can("bookings.validate") ? 'Leg se ënner „Wartung“ un.' : "") + "</p>"; return; }
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
    bars.innerHTML = counts.map(function (x) { return '<div class="abar' + (x.t ? " today" : "") + '" style="height:' + Math.max(6, Math.round(x.c / max * 100)) + '%" title="' + x.c + ' Termäiner"></div>'; }).join("");
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
      var evHtml = dayEvents.slice(0, 3).map(function (b) { return '<div class="cal-ev' + (b.status === "new" ? " tentative" : "") + '" style="background:' + cmap[b.veh || "?"] + '" title="' + esc(b.veh) + " – " + esc(b.name) + " (" + (b.status === "new" ? "nei" : b.status === "confirmed" ? "bestätegt" : "ofgeschloss") + ')">' + esc(vehName(b.veh)) + "</div>"; }).join("");
      var remain = 3 - dayEvents.length;
      if (remain > 0) evHtml += dayAppts.slice(0, remain).map(function (a) { return '<div class="cal-ev appt' + (a.status === "new" ? " tentative" : "") + '" title="Rendez-vous: ' + esc(a.service || "") + (a.vehicle ? " – " + esc(a.vehicle) : "") + " – " + esc(a.name) + " (" + (a.status === "new" ? "nei" : "bestätegt") + ')">🔧 ' + esc(vehName(a.service || "RDV")) + "</div>"; }).join("");
      if (total > 3) evHtml += '<div class="cal-ev" style="background:#9aa7b4">+' + (total - 3) + "</div>";
      var dkey = cur.getFullYear() + "-" + pad(cur.getMonth() + 1) + "-" + pad(cur.getDate());
      html += '<div class="cal-cell' + (inMonth ? "" : " other") + (isToday ? " today" : "") + (total ? " clickable" : "") + '"' + (total ? ' data-day="' + dkey + '" role="button" tabindex="0"' : "") + '><div class="cal-daynum">' + cur.getDate() + "</div>" + evHtml + "</div>";
      cur.setDate(cur.getDate() + 1);
    }
    $("calendar").innerHTML = html + "</div>";
    var vehs = Object.keys(cmap);
    var leg = vehs.map(function (v) { return '<span><i style="background:' + cmap[v] + '"></i>' + esc(vehName(v)) + "</span>"; }).join("");
    if (appts.length) leg += '<span><i style="background:' + APPT_COLOR + '"></i>🔧 Rendez-vous</span>';
    $("cal-legend").innerHTML = leg;
    $("calendar").querySelectorAll(".cal-cell[data-day]").forEach(function (c) {
      function open() { openDay(c.getAttribute("data-day")); }
      c.addEventListener("click", open);
      c.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
  }

  function openDay(dkey) {
    var day = parseDay(dkey); if (!day) return; var dMs = day.getTime();
    var cmap = vehColorMap(dashActive);
    var evs = [];
    dashActive.forEach(function (b) { var f = parseDay(b.from), t = parseDay(b.to) || f; if (f && dMs >= f.getTime() && dMs <= t.getTime()) {
      var role = dMs === f.getTime() ? "Ofhuelung" : dMs === (t ? t.getTime() : f.getTime()) ? "Retour" : "ënnerwee";
      evs.push({ sort: 1, color: cmap[b.veh || "?"], t: esc(b.veh), s: esc(b.name) + " · " + role + " · " + STATUS[b.status] + " · " + refOf(b.id) });
    } });
    dashAppts.forEach(function (a) { var d = apptDay(a); if (d && d.getTime() === dMs) evs.push({ sort: 2, color: APPT_COLOR, t: "🔧 " + esc(a.service || "Rendez-vous"), s: (a.vehicle ? esc(a.vehicle) + " · " : "") + esc(a.name) + " · " + STATUS[a.status] + " · " + reqRef("appointment", a.id) }); });
    evs.sort(function (x, y) { return x.sort - y.sort; });
    $("day-title").textContent = dLabel(dkey);
    var body = $("day-body");
    body.innerHTML = evs.length ? evs.map(function (e) { return '<div class="devent"><span class="dd" style="background:' + e.color + '"></span><div style="min-width:0"><div class="dt">' + e.t + '</div><div class="ds">' + e.s + "</div></div></div>"; }).join("") : '<p class="muted" style="font-size:0.88rem">Keng Termäiner op dësem Dag.</p>';
    $("daypop").hidden = false;
  }
  (function () {
    var x = $("day-x"), pop = $("daypop");
    if (x) x.addEventListener("click", function () { pop.hidden = true; });
    if (pop) pop.addEventListener("click", function (e) { if (e.target === pop) pop.hidden = true; });
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
    ]).then(function (res) {
      var bk = res[0]; if (bk === null) throw new Error("load");
      var ap = res[1] || [];
      var appts = ap.filter(function (a) { return (a.kind || "appointment") === "appointment"; });
      $("analyse-sub").textContent = "aus dengen Donnéeën berechent";
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var since = new Date(today); since.setDate(since.getDate() - 90);
      var rentals = bk.filter(function (b) { return b.status !== "declined"; });

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
        { cls: "", n: (avgDur ? avgDur.toFixed(1).replace(".", ",") : "0"), l: "Ø Deeg / Verleih", ic: "⏱️" },
        { cls: "", n: noShow + "%", l: "Ofgeleent-Quote", ic: "🚫" },
        { cls: "ok", n: rentals.length, l: "Reservatiounen total", ic: "📊" },
      ];
      $("analyse-kpis").innerHTML = kpis.map(function (t) { return '<div class="stat ' + t.cls + '"><div class="stat-ic">' + t.ic + '</div><div><div class="n">' + t.n + '</div><div class="l">' + t.l + "</div></div></div>"; }).join("");

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
  function showFleetPhoto(url) {
    var img=$("w-image-preview"), empty=$("w-image-placeholder"), remove=$("w-image-remove");
    if(url){img.src=url;img.hidden=false;empty.hidden=true;remove.hidden=false;}
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
          var max=1600,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
          var canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
          var ctx=canvas.getContext("2d");ctx.drawImage(img,0,0,w,h);
          canvas.toBlob(function(blob){if(blob)resolve(blob);else reject(new Error("compress_failed"));},"image/webp",.82);
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
  function syncFleetType() { var trailer=$("w-type").value==="trailer"; $("w-braked-wrap").hidden=!trailer; }
  function fleetPayload() { return { type:$("w-type").value,vehicle:$("w-veh").value.trim(),status:$("w-status").value,service:$("w-service").value.trim(),dueDate:$("w-due").value,note:$("w-note").value.trim(),description:$("w-description").value.trim(),imageUrl:$("w-image").value.trim(),priceDay:$("w-price").value,year:$("w-year").value.trim(),seats:$("w-seats").value.trim(),fuel:$("w-fuel").value.trim(),transmission:$("w-transmission").value.trim(),licenseClass:$("w-license").value.trim(),loadSpace:$("w-load").value.trim(),grossWeight:$("w-gross").value.trim(),payload:$("w-payload").value.trim(),braked:$("w-braked").checked,features:$("w-features").value.trim(),active:$("w-active").checked }; }
  function fillFleet(m) { $("w-type").value=m.type||"van"; syncFleetType(); $("w-veh").value=m.vehicle||""; $("w-status").value=m.status||"ready"; $("w-service").value=m.service||""; $("w-due").value=m.dueDate||""; $("w-note").value=m.note||""; $("w-description").value=m.description||""; $("w-image").value=m.imageUrl||""; showFleetPhoto(m.imageUrl||""); $("w-price").value=m.priceDay==null?"":m.priceDay; $("w-year").value=m.year||""; $("w-seats").value=m.seats||""; $("w-fuel").value=m.fuel||""; $("w-transmission").value=m.transmission||""; $("w-license").value=m.licenseClass||""; $("w-load").value=m.loadSpace||""; $("w-gross").value=m.grossWeight||""; $("w-payload").value=m.payload||""; $("w-braked").checked=!!m.braked; $("w-features").value=m.features||""; $("w-active").checked=!!m.active; }
  function renderWartung() {
    var canEdit = can("bookings.validate");
    $("wartung-form").style.display = canEdit ? "" : "none";
    STORE.listMaintenance().then(function (items) {
      var body=$("wartung-body"); body.innerHTML="";
      if(!items.length){body.innerHTML='<p class="empty">Nach kee Verleihobjet an der Flotte.</p>';return;}
      items.forEach(function(m){var fs=fleetStatus(m.status),card=document.createElement("article"),ic=m.type==="trailer"?"🛻":(m.type==="car"?"🚗":"🚐");card.className="fleet-card";card.innerHTML=(m.imageUrl?'<img src="'+esc(m.imageUrl)+'" alt="">':'<div class="stat-ic">'+ic+'</div>')+'<div><h3>'+esc(m.vehicle)+'</h3><span class="fleet-status fleet-'+fs[1]+'">'+fs[0]+'</span> <span class="fleet-private">'+fleetTypeLabel(m.type)+'</span> <span class="'+(m.active?'fleet-public':'fleet-private')+'">'+(m.active?'● Online sichtbar':'○ Intern')+'</span><p>'+esc(m.description||'Keng ëffentlech Beschreiwung')+'</p><p>'+esc(m.service||'Nach Bedarf')+(m.dueDate?' · '+dLabel(m.dueDate):'')+(m.priceDay!==''?' · '+esc(m.priceDay)+' €/Dag':'')+'</p></div><div class="fleet-actions">'+(canEdit?'<button class="btn btn-outline btn-sm" data-medit="'+m.id+'">Änneren</button> <button class="btn btn-danger btn-sm" data-mdel="'+m.id+'">Läschen</button>':'')+'</div>';body.appendChild(card);});
      body.querySelectorAll("[data-medit]").forEach(function(b){b.addEventListener("click",function(){var id=parseInt(b.getAttribute("data-medit"),10),m=items.filter(function(x){return x.id===id;})[0];editingMaint=id;fillFleet(m);$("wartung-msg").textContent="Gefier gëtt geännert – späichere fir z'iwwerhuelen.";$("w-veh").focus();});});
      body.querySelectorAll("[data-mdel]").forEach(function(b){b.addEventListener("click",function(){var id=parseInt(b.getAttribute("data-mdel"),10);if(!confirm("Dëst Gefier aus der Flotte läschen?"))return;STORE.delMaintenance(id).then(function(r){if(r.error){toast(errMsg(r.error));return;}toast("Gefier geläscht.");renderWartung();});});});
    }).catch(function () { $("wartung-body").innerHTML = '<p class="empty">⚠ Net gelueden. <button class="btn btn-outline btn-sm" id="retry-wartung">Nei probéieren</button></p>'; var r = $("retry-wartung"); if (r) r.addEventListener("click", renderWartung); });
  }
  (function () {
    var f = $("wartung-form"); if (!f) return;
    $("w-type").addEventListener("change",syncFleetType); syncFleetType();
    $("w-camera-btn").addEventListener("click",function(){$("w-camera").click();});
    $("w-gallery-btn").addEventListener("click",function(){$("w-gallery").click();});
    [$("w-camera"),$("w-gallery")].forEach(function(inp){inp.addEventListener("change",function(){if(inp.files&&inp.files[0])handleFleetPhoto(inp.files[0]);inp.value="";});});
    $("w-image-remove").addEventListener("click",function(){$("w-image").value="";showFleetPhoto("");$("w-image-status").textContent="Bild ewechgeholl – späichere fir z'iwwerhuelen.";});
    f.addEventListener("submit", function (e) {
      e.preventDefault(); if (!can("bookings.validate")) return;
      var data=fleetPayload(); if(!data.vehicle){$("wartung-msg").textContent="Den Numm vum Verleihobjet muss ausgefëllt sinn.";return;}
      $("wartung-msg").textContent = "…";
      var op=editingMaint?STORE.editMaintenance(editingMaint,data):STORE.addMaintenance(data); op.then(function (r) {
        if (r.error) { $("wartung-msg").textContent = errMsg(r.error); return; }
        editingMaint=null; f.reset(); syncFleetType(); showFleetPhoto(""); $("w-image-status").textContent="D'Bild gëtt virum Eroplueden automatesch verkleinert."; $("wartung-msg").textContent = "✓ Gespäichert."; renderWartung();
      });
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
      if (e.key === "Escape") { if (!$("k-overlay").hidden) closeK(); if (!$("daypop").hidden) $("daypop").hidden = true; }
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
  /* ---------- PWA: Service Worker + Install (Hannergrond-Update, KEE forcéierte Reload) ---------- */
  (function () {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js", { scope: "/intern/" }).then(function (reg) {
          // Nei Versioun gëtt am Hannergrond installéiert a gëllt beim nächsten Opmaachen.
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
