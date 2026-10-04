/* Interne Verwaltung – TESTMODUS (Demo am Browser).
   Produktiouns-UI a -Logik; d'Donnéeë leien aktuell am localStorage.
   Déi echt Versioun (Phase 2) ersetzt d'`store`-Funktiounen hei ënnen
   duerch Opruffer op de Cloudflare-Worker (D1 + server-säitege Login).
   Rollen/Rechter a Member-Verwaltung sinn identesch mam Backend-Modell. */
(function () {
  "use strict";

  /* ---------- Rollen a Rechter ---------- */
  var ROLES = {
    viewer:    { label: "Kucker",      perms: ["bookings.view"] },
    validator: { label: "Validéierer", perms: ["bookings.view", "bookings.validate"] },
    admin:     { label: "Admin",       perms: ["bookings.view", "bookings.validate", "members.manage"] },
  };
  function roleLabel(r) { return (ROLES[r] || {}).label || r; }

  /* ---------- Demo-Storage (ersat Phase 2 duerch API) ---------- */
  var USERS_KEY = "intern_demo_users_v1";
  var DATA_KEY = "intern_demo_bookings_v1";
  var SESSION_KEY = "intern_demo_session_v1";

  function load(key, fb) { try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fb : v; } catch (e) { return fb; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

  function seedUsers() {
    return [
      { username: "admin",   name: "Clement (Admin)", role: "admin",     pw: "test1234", active: true },
      { username: "atelier", name: "Atelier",          role: "validator", pw: "test1234", active: true },
      { username: "theke",   name: "Theke",            role: "viewer",    pw: "test1234", active: true },
    ];
  }
  function getUsers() { var u = load(USERS_KEY, null); if (!u) { u = seedUsers(); save(USERS_KEY, u); } return u; }
  function setUsers(u) { save(USERS_KEY, u); }
  function findUser(username) { return getUsers().filter(function (x) { return x.username === username; })[0] || null; }

  function iso(y, mo, d, h, mi) { return new Date(y, mo - 1, d, h, mi, 0).toISOString(); }
  function seedBookings() {
    return [
      { id: 1041, veh: "Camionnette (Déménagement)", from: iso(2026,10,6,8,0), to: iso(2026,10,6,18,0), name: "Marc Weber", email: "marc.weber@email.lu", phone: "+352 691 234 567", msg: "Fir en Déménagement an der Stad.", status: "new", events: [{ action: "Ufro erakomm", by: "System", at: iso(2026,10,3,9,12), note: "" }] },
      { id: 1040, veh: "Remorque (Unhänger)", from: iso(2026,10,5,9,0), to: iso(2026,10,5,20,0), name: "Sophie Muller", email: "sophie.muller@email.lu", phone: "+352 621 987 654", msg: "Gaardenoffäll an de Recyclingszentrum.", status: "new", events: [{ action: "Ufro erakomm", by: "System", at: iso(2026,10,3,7,45), note: "" }] },
      { id: 1039, veh: "Ersatzween (Auto)", from: iso(2026,10,2,8,0), to: iso(2026,10,6,17,0), name: "Jean Reiter", email: "j.reiter@email.lu", phone: "+352 691 112 233", msg: "Wärend mäin Auto an der Reparatur ass.", status: "confirmed", events: [{ action: "Ufro erakomm", by: "System", at: iso(2026,10,1,15,2), note: "" }, { action: "Bestätegt", by: "clement", at: iso(2026,10,1,16,30), note: "Ween steet prett." }] },
      { id: 1038, veh: "Camionnette (Déménagement)", from: iso(2026,9,28,8,0), to: iso(2026,9,29,18,0), name: "Lucie Thill", email: "lucie.thill@email.lu", phone: "+352 661 445 566", msg: "", status: "declined", events: [{ action: "Ufro erakomm", by: "System", at: iso(2026,9,26,10,0), note: "" }, { action: "Ofgeleent", by: "clement", at: iso(2026,9,27,11,10), note: "Schonn un deem Dag reservéiert." }] },
      { id: 1037, veh: "Remorque (Unhänger)", from: iso(2026,9,25,9,0), to: iso(2026,9,25,19,0), name: "Paul Schmit", email: "paul.schmit@email.lu", phone: "+352 691 778 899", msg: "Transport vu Miwwelen.", status: "done", events: [{ action: "Ufro erakomm", by: "System", at: iso(2026,9,24,8,30), note: "" }, { action: "Bestätegt", by: "atelier", at: iso(2026,9,24,9,5), note: "" }, { action: "Ofgeschloss", by: "atelier", at: iso(2026,9,25,19,30), note: "Alles OK zréck." }] },
    ];
  }
  function getBookings() { var b = load(DATA_KEY, null); if (!b) { b = seedBookings(); save(DATA_KEY, b); } return b; }
  function setBookings(b) { save(DATA_KEY, b); }

  /* ---------- Session + Rechter ---------- */
  var session = load(SESSION_KEY, null);
  function setSession(s) { session = s; if (s) save(SESSION_KEY, s); else localStorage.removeItem(SESSION_KEY); }
  function currentRole() { var u = session && findUser(session.username); return u ? u.role : null; }
  function can(perm) { var r = currentRole(); return !!(r && ROLES[r] && ROLES[r].perms.indexOf(perm) !== -1); }

  /* ---------- Helpers ---------- */
  var $ = function (id) { return document.getElementById(id); };
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function fmt(s) { var d = new Date(s); return pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function now() { return new Date().toISOString(); }
  var toastT = null;
  function toast(msg) { var t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); clearTimeout(toastT); toastT = setTimeout(function () { t.remove(); }, 2600); }

  /* ---------- Views ---------- */
  var activePage = "bookings";
  function showApp() {
    $("view-login").hidden = true; $("view-app").hidden = false;
    $("who-name").textContent = session.name + " · " + roleLabel(currentRole());
    $("nav-members").hidden = !can("members.manage");
    gotoPage(can("members.manage") || activePage === "bookings" ? activePage : "bookings");
    render();
  }
  function showLogin() { $("view-app").hidden = true; $("view-login").hidden = false; $("login-err").textContent = ""; $("login-form").reset(); }
  function gotoPage(p) {
    if (p === "members" && !can("members.manage")) p = "bookings";
    activePage = p;
    $("page-bookings").hidden = p !== "bookings";
    $("page-members").hidden = p !== "members";
    document.querySelectorAll("#topnav button").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-page") === p); });
    if (p === "members") renderMembers();
  }

  /* ---------- Login ---------- */
  $("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var u = $("u").value.trim().toLowerCase(), p = $("p").value;
    var rec = findUser(u);
    if (!rec || !rec.active || rec.pw !== p) { $("login-err").textContent = "Falsche Benotzernumm oder Passwuert."; return; }
    setSession({ username: rec.username, name: rec.name });
    showApp();
  });
  $("btn-logout").addEventListener("click", function () { setSession(null); showLogin(); });
  $("btn-reset").addEventListener("click", function () {
    if (!confirm("Demo-Daten (Reservatiounen + Memberen) op den Ufankszoustand zrécksetzen?")) return;
    setBookings(seedBookings()); setUsers(seedUsers());
    if (!session || !findUser(session.username)) { setSession(null); showLogin(); return; }
    showApp();
  });
  document.querySelectorAll("#topnav button").forEach(function (b) { b.addEventListener("click", function () { gotoPage(b.getAttribute("data-page")); }); });

  /* ---------- Bookings ---------- */
  var activeFilter = "all";
  var STATUS = { new: "Nei", confirmed: "Bestätegt", declined: "Ofgeleent", done: "Ofgeschloss" };

  function counts(bk) { var c = { all: bk.length, new: 0, confirmed: 0, declined: 0, done: 0 }; bk.forEach(function (b) { c[b.status] = (c[b.status] || 0) + 1; }); return c; }
  function renderFilters(bk) {
    var c = counts(bk), defs = [["all","All"],["new","Nei"],["confirmed","Bestätegt"],["declined","Ofgeleent"],["done","Ofgeschloss"]], wrap = $("filters");
    wrap.innerHTML = "";
    defs.forEach(function (d) { var b = document.createElement("button"); b.type = "button"; b.className = "chip" + (activeFilter === d[0] ? " active" : ""); b.innerHTML = esc(d[1]) + ' <span class="count">(' + (c[d[0]] || 0) + ")</span>"; b.addEventListener("click", function () { activeFilter = d[0]; render(); }); wrap.appendChild(b); });
  }
  function act(id, newStatus, label) {
    if (!can("bookings.validate")) return;
    var noteEl = $("note-" + id), note = noteEl ? noteEl.value.trim() : "";
    var bk = getBookings(), t = bk.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    t.status = newStatus; t.events.push({ action: label, by: session.username, at: now(), note: note });
    setBookings(bk); render(); toast("Reservatioun R-" + id + ": " + label.toLowerCase() + ".");
  }
  function bookingCard(b) {
    var el = document.createElement("div");
    el.className = "booking" + (b.status === "new" ? " is-new" : "");
    var canVal = can("bookings.validate"), actions = "";
    if (canVal && b.status === "new") actions = '<input class="b-note-input" id="note-' + b.id + '" type="text" placeholder="Notiz (fräiwëlleg) …" /><button class="btn btn-ok btn-sm" data-act="confirm" data-id="' + b.id + '">✓ Bestätegen</button><button class="btn btn-outline btn-sm" data-act="decline" data-id="' + b.id + '">✕ Ofleenen</button>';
    else if (canVal && b.status === "confirmed") actions = '<input class="b-note-input" id="note-' + b.id + '" type="text" placeholder="Notiz (fräiwëlleg) …" /><button class="btn btn-outline btn-sm" data-act="done" data-id="' + b.id + '">Als ofgeschloss markéieren</button>';
    var audit = b.events.map(function (ev) { return '<div class="ev">• ' + esc(ev.action) + ' vum <b>' + esc(ev.by) + "</b>, " + fmt(ev.at) + (ev.note ? ' – „' + esc(ev.note) + "“" : "") + "</div>"; }).join("");
    el.innerHTML =
      '<div class="b-top"><div><div class="b-veh">' + esc(b.veh) + '</div><div class="b-id">Réf. R-' + b.id + "</div></div><span class=\"status status-" + b.status + '">' + esc(STATUS[b.status]) + "</span></div>" +
      '<div class="b-dates">' + fmt(b.from) + '<span class="arrow">→</span>' + fmt(b.to) + "</div>" +
      '<div class="b-cust"><strong>' + esc(b.name) + "</strong><span>✉ " + esc(b.email) + "</span>" + (b.phone ? "<span>☎ " + esc(b.phone) + "</span>" : "") + "</div>" +
      (b.msg ? '<p class="b-msg">' + esc(b.msg) + "</p>" : "") +
      (actions ? '<div class="b-actions">' + actions + "</div>" : "") +
      '<div class="b-audit">' + audit + "</div>";
    el.querySelectorAll("[data-act]").forEach(function (btn) { btn.addEventListener("click", function () { var a = btn.getAttribute("data-act"); if (a === "confirm") act(b.id, "confirmed", "Bestätegt"); else if (a === "decline") act(b.id, "declined", "Ofgeleent"); else if (a === "done") act(b.id, "done", "Ofgeschloss"); }); });
    return el;
  }
  function render() {
    if (activePage !== "bookings") return;
    $("bookings-sub").textContent = can("bookings.validate") ? "Ufroe bestätegen oder ofleenen. All Aktioun gëtt mam Benotzernumm festgehalen." : "Dir hutt Liesrechter (Kucker) – Validéiere ass dem Validéierer/Admin virbehalen.";
    var bk = getBookings().slice().sort(function (a, b) { return b.id - a.id; });
    renderFilters(bk);
    var list = $("booking-list"); list.innerHTML = "";
    var shown = bk.filter(function (b) { return activeFilter === "all" || b.status === activeFilter; });
    if (!shown.length) { var e = document.createElement("p"); e.className = "empty"; e.textContent = "Keng Reservatiounen an dëser Kategorie."; list.appendChild(e); return; }
    shown.forEach(function (b) { list.appendChild(bookingCard(b)); });
  }

  /* ---------- Member-Verwaltung (admin) ---------- */
  function adminCount(users) { return users.filter(function (u) { return u.role === "admin" && u.active; }).length; }
  function renderMembers() {
    if (!can("members.manage")) return;
    var users = getUsers(), body = $("members-body"); body.innerHTML = "";
    users.forEach(function (u) {
      var tr = document.createElement("tr");
      var isSelf = session && u.username === session.username;
      var roleCell = '<select class="member-sel" data-role-for="' + esc(u.username) + '">' +
        ["viewer","validator","admin"].map(function (r) { return '<option value="' + r + '"' + (u.role === r ? " selected" : "") + ">" + roleLabel(r) + "</option>"; }).join("") + "</select>";
      tr.innerHTML =
        "<td><code>" + esc(u.username) + "</code>" + (isSelf ? '<span class="you-tag">(du)</span>' : "") + (u.active ? "" : ' <span class="role-pill role-viewer">inaktiv</span>') + "</td>" +
        "<td>" + esc(u.name) + "</td>" +
        "<td>" + roleCell + "</td>" +
        '<td style="text-align:right">' + (isSelf ? "" : '<button class="btn btn-danger btn-sm" data-del="' + esc(u.username) + '">Läschen</button>') + "</td>";
      body.appendChild(tr);
    });
    body.querySelectorAll("[data-role-for]").forEach(function (sel) { sel.addEventListener("change", function () { changeRole(sel.getAttribute("data-role-for"), sel.value); }); });
    body.querySelectorAll("[data-del]").forEach(function (btn) { btn.addEventListener("click", function () { delMember(btn.getAttribute("data-del")); }); });
  }
  function changeRole(username, role) {
    var users = getUsers(), u = users.filter(function (x) { return x.username === username; })[0];
    if (!u) return;
    if (u.role === "admin" && role !== "admin" && adminCount(users) <= 1) { toast("Et muss op mannst een Admin bleiwen."); renderMembers(); return; }
    u.role = role; setUsers(users); renderMembers();
    toast(esc(username) + " ass elo " + roleLabel(role) + ".");
  }
  function delMember(username) {
    if (session && username === session.username) return;
    var users = getUsers(), u = users.filter(function (x) { return x.username === username; })[0];
    if (!u) return;
    if (u.role === "admin" && adminCount(users) <= 1) { toast("Dee leschten Admin kann net geläscht ginn."); return; }
    if (!confirm("Member „" + username + "“ wierklech läschen?")) return;
    setUsers(users.filter(function (x) { return x.username !== username; }));
    renderMembers(); toast("Member „" + username + "“ geläscht.");
  }
  function randomPw() { var c = "abcdefghjkmnpqrstuvwxyz23456789"; var s = ""; for (var i = 0; i < 8; i++) s += c.charAt(Math.floor(Math.random() * c.length)); return s; }
  $("add-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!can("members.manage")) return;
    var username = $("m-user").value.trim().toLowerCase(), name = $("m-name").value.trim(), role = $("m-role").value;
    if (!/^[a-z0-9._-]{3,}$/.test(username)) { $("add-msg").textContent = "Benotzernumm: op mannst 3 Zeechen (Klengbuschtawen, Zuelen, . _ -)."; return; }
    if (findUser(username)) { $("add-msg").textContent = "Dee Benotzernumm gëtt et schonn."; return; }
    var pw = randomPw(), users = getUsers();
    users.push({ username: username, name: name, role: role, pw: pw, active: true });
    setUsers(users);
    $("add-form").reset();
    $("add-msg").innerHTML = "✓ Member <code>" + esc(username) + "</code> bäigesat. Temporär Passwuert (Demo): <code>" + esc(pw) + "</code> – an der echter Versioun ännert de Member et beim 1. Login.";
    renderMembers();
  });

  /* ---------- Boot ---------- */
  if (session && findUser(session.username) && findUser(session.username).active) showApp();
  else { setSession(null); showLogin(); }
})();
