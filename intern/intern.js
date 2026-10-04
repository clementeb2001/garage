/* Interne Verwaltung – TESTMODUS (Demo-Daten am Browser).
   Keng echt Datebank, kee server-säitege Login. Déi echt Versioun
   (Phase 2) lount alles vun engem Cloudflare-Worker + D1 mat
   gehashte Passwierder a server-säiteger Sessioun. */
(function () {
  "use strict";

  /* ---- Demo-Benotzer (nëmmen Testmodus!) ---- */
  var USERS = {
    admin: { pw: "test1234", name: "Clement (Admin)", role: "admin" },
    atelier: { pw: "test1234", name: "Atelier", role: "member" },
  };

  var SESSION_KEY = "intern_demo_session";
  var DATA_KEY = "intern_demo_bookings_v1";

  var STATUS = {
    new: { key: "new", label: "Nei" },
    confirmed: { key: "confirmed", label: "Bestätegt" },
    declined: { key: "declined", label: "Ofgeleent" },
    done: { key: "done", label: "Ofgeschloss" },
  };

  function now() { return new Date().toISOString(); }
  function iso(y, mo, d, h, mi) { return new Date(y, mo - 1, d, h, mi, 0).toISOString(); }

  function seedBookings() {
    return [
      { id: 1041, veh: "Camionnette (Déménagement)", from: iso(2026,10,6,8,0), to: iso(2026,10,6,18,0),
        name: "Marc Weber", email: "marc.weber@email.lu", phone: "+352 691 234 567",
        msg: "Fir en Déménagement an der Stad.", status: "new", events: [{ action: "Ufro erakomm", by: "System", at: iso(2026,10,3,9,12), note: "" }] },
      { id: 1040, veh: "Remorque (Unhänger)", from: iso(2026,10,5,9,0), to: iso(2026,10,5,20,0),
        name: "Sophie Muller", email: "sophie.muller@email.lu", phone: "+352 621 987 654",
        msg: "Gaardenoffäll an de Recyclingszentrum.", status: "new", events: [{ action: "Ufro erakomm", by: "System", at: iso(2026,10,3,7,45), note: "" }] },
      { id: 1039, veh: "Ersatzween (Auto)", from: iso(2026,10,2,8,0), to: iso(2026,10,6,17,0),
        name: "Jean Reiter", email: "j.reiter@email.lu", phone: "+352 691 112 233",
        msg: "Wärend mäin Auto an der Reparatur ass.", status: "confirmed",
        events: [{ action: "Ufro erakomm", by: "System", at: iso(2026,10,1,15,2), note: "" },
                 { action: "Bestätegt", by: "clement", at: iso(2026,10,1,16,30), note: "Ween steet prett." }] },
      { id: 1038, veh: "Camionnette (Déménagement)", from: iso(2026,9,28,8,0), to: iso(2026,9,29,18,0),
        name: "Lucie Thill", email: "lucie.thill@email.lu", phone: "+352 661 445 566",
        msg: "", status: "declined",
        events: [{ action: "Ufro erakomm", by: "System", at: iso(2026,9,26,10,0), note: "" },
                 { action: "Ofgeleent", by: "clement", at: iso(2026,9,27,11,10), note: "Schonn un deem Dag reservéiert." }] },
      { id: 1037, veh: "Remorque (Unhänger)", from: iso(2026,9,25,9,0), to: iso(2026,9,25,19,0),
        name: "Paul Schmit", email: "paul.schmit@email.lu", phone: "+352 691 778 899",
        msg: "Transport vu Miwwelen.", status: "done",
        events: [{ action: "Ufro erakomm", by: "System", at: iso(2026,9,24,8,30), note: "" },
                 { action: "Bestätegt", by: "atelier", at: iso(2026,9,24,9,5), note: "" },
                 { action: "Ofgeschloss", by: "atelier", at: iso(2026,9,25,19,30), note: "Alles OK zréck." }] },
    ];
  }

  /* ---- Storage helpers ---- */
  function load(key, fb) { try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fb : v; } catch (e) { return fb; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

  function getBookings() {
    var b = load(DATA_KEY, null);
    if (!b) { b = seedBookings(); save(DATA_KEY, b); }
    return b;
  }
  function setBookings(b) { save(DATA_KEY, b); }

  /* ---- Session ---- */
  var session = load(SESSION_KEY, null);
  function setSession(s) { session = s; if (s) save(SESSION_KEY, s); else localStorage.removeItem(SESSION_KEY); }

  /* ---- Helpers ---- */
  var $ = function (id) { return document.getElementById(id); };
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function fmt(isoStr) {
    var d = new Date(isoStr);
    return pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  /* ---- Views ---- */
  function showApp() {
    $("view-login").hidden = true;
    $("view-app").hidden = false;
    $("who-name").textContent = session.name + " · " + (session.role === "admin" ? "Admin" : "Mataarbechter");
    render();
  }
  function showLogin() {
    $("view-app").hidden = true;
    $("view-login").hidden = false;
    $("login-err").textContent = "";
    $("login-form").reset();
  }

  /* ---- Login ---- */
  $("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var u = $("u").value.trim().toLowerCase();
    var p = $("p").value;
    var rec = USERS[u];
    if (!rec || rec.pw !== p) {
      $("login-err").textContent = "Falsche Benotzernumm oder Passwuert.";
      return;
    }
    setSession({ username: u, name: rec.name, role: rec.role });
    showApp();
  });
  $("btn-logout").addEventListener("click", function () { setSession(null); showLogin(); });
  $("btn-reset").addEventListener("click", function () {
    if (!confirm("Demo-Reservatiounen op den Ufankszoustand zrécksetzen?")) return;
    setBookings(seedBookings());
    render();
  });

  /* ---- Filtering + rendering ---- */
  var activeFilter = "all";

  function counts(bookings) {
    var c = { all: bookings.length, new: 0, confirmed: 0, declined: 0, done: 0 };
    bookings.forEach(function (b) { c[b.status] = (c[b.status] || 0) + 1; });
    return c;
  }

  function renderFilters(bookings) {
    var c = counts(bookings);
    var defs = [["all", "All"], ["new", "Nei"], ["confirmed", "Bestätegt"], ["declined", "Ofgeleent"], ["done", "Ofgeschloss"]];
    var wrap = $("filters");
    wrap.innerHTML = "";
    defs.forEach(function (d) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (activeFilter === d[0] ? " active" : "");
      b.innerHTML = esc(d[1]) + ' <span class="count">(' + (c[d[0]] || 0) + ")</span>";
      b.addEventListener("click", function () { activeFilter = d[0]; render(); });
      wrap.appendChild(b);
    });
  }

  function act(booking, newStatus, actionLabel) {
    var noteEl = document.getElementById("note-" + booking.id);
    var note = noteEl ? noteEl.value.trim() : "";
    var bookings = getBookings();
    var target = bookings.filter(function (x) { return x.id === booking.id; })[0];
    if (!target) return;
    target.status = newStatus;
    target.events.push({ action: actionLabel, by: session.username, at: now(), note: note });
    setBookings(bookings);
    render();
  }

  function bookingCard(b) {
    var el = document.createElement("div");
    el.className = "booking" + (b.status === "new" ? " is-new" : "");
    var st = STATUS[b.status] || STATUS.new;

    var actions = "";
    if (b.status === "new") {
      actions =
        '<input class="b-note-input" id="note-' + b.id + '" type="text" placeholder="Notiz (fräiwëlleg) …" />' +
        '<button class="btn btn-ok btn-sm" data-act="confirm" data-id="' + b.id + '">✓ Bestätegen</button>' +
        '<button class="btn btn-outline btn-sm" data-act="decline" data-id="' + b.id + '">✕ Ofleenen</button>';
    } else if (b.status === "confirmed") {
      actions =
        '<input class="b-note-input" id="note-' + b.id + '" type="text" placeholder="Notiz (fräiwëlleg) …" />' +
        '<button class="btn btn-outline btn-sm" data-act="done" data-id="' + b.id + '">Als ofgeschloss markéieren</button>';
    }

    var audit = b.events.map(function (ev) {
      return '<div class="ev">• ' + esc(ev.action) + ' vum <b>' + esc(ev.by) + "</b>, " + fmt(ev.at) +
        (ev.note ? ' – „' + esc(ev.note) + "“" : "") + "</div>";
    }).join("");

    el.innerHTML =
      '<div class="b-top">' +
        '<div><div class="b-veh">' + esc(b.veh) + '</div><div class="b-id">Réf. R-' + b.id + "</div></div>" +
        '<span class="status status-' + st.key + '">' + esc(st.label) + "</span>" +
      "</div>" +
      '<div class="b-dates">' + fmt(b.from) + '<span class="arrow">→</span>' + fmt(b.to) + "</div>" +
      '<div class="b-cust"><strong>' + esc(b.name) + "</strong>" +
        '<span>✉ ' + esc(b.email) + "</span>" + (b.phone ? '<span>☎ ' + esc(b.phone) + "</span>" : "") +
      "</div>" +
      (b.msg ? '<p class="b-msg">' + esc(b.msg) + "</p>" : "") +
      (actions ? '<div class="b-actions">' + actions + "</div>" : "") +
      '<div class="b-audit">' + audit + "</div>";

    el.querySelectorAll("[data-act]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var a = btn.getAttribute("data-act");
        if (a === "confirm") act(b, "confirmed", "Bestätegt");
        else if (a === "decline") act(b, "declined", "Ofgeleent");
        else if (a === "done") act(b, "done", "Ofgeschloss");
      });
    });
    return el;
  }

  function render() {
    var bookings = getBookings().slice().sort(function (a, b) { return b.id - a.id; });
    renderFilters(bookings);
    var list = $("booking-list");
    list.innerHTML = "";
    var shown = bookings.filter(function (b) { return activeFilter === "all" || b.status === activeFilter; });
    if (!shown.length) {
      var e = document.createElement("p");
      e.className = "empty";
      e.textContent = "Keng Reservatiounen an dëser Kategorie.";
      list.appendChild(e);
      return;
    }
    shown.forEach(function (b) { list.appendChild(bookingCard(b)); });
  }

  /* ---- Boot ---- */
  if (session && USERS[session.username]) showApp();
  else showLogin();
})();
