/* Ëffentleche Verfügbarkeets-Kalenner fir d'Rendez-vous-Formulaire.
   Weist fräi / deels fräi (nëmmen 1 Hallefdag) / ausgebucht Deeg a verhënnert
   datt e gespaarte Slot ausgewielt gëtt. Benotzt déiselwecht CSS-Klassen wéi de
   Verleih-Kalenner (.rental-calendar*). */
(function () {
  "use strict";
  var API = "https://garage-admin.autoservicebettenduerf.lu";
  var TXT = {
    lb: { title: "Fräi Deeg kucken", help: "Tippt op e fräien Dag. Rout = ganzen Dag ausgebucht.", free: "Fräi", partial: "Nëmmen 1 Hallefdag", busy: "Ausgebucht", past: "Net wielbar", prev: "Mount virdrun", next: "Nächste Mount", weekdays: ["Mé", "Dë", "Më", "Do", "Fr", "Sa", "So"], amOnly: "Op dësem Dag ass just nach moies fräi.", pmOnly: "Op dësem Dag ass just nach nomëttes fräi." },
    de: { title: "Freie Tage ansehen", help: "Tippen Sie auf einen freien Tag. Rot = ganzer Tag ausgebucht.", free: "Frei", partial: "Nur ein Halbtag", busy: "Ausgebucht", past: "Nicht wählbar", prev: "Vorheriger Monat", next: "Nächster Monat", weekdays: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"], amOnly: "An diesem Tag ist nur noch vormittags frei.", pmOnly: "An diesem Tag ist nur noch nachmittags frei." },
    fr: { title: "Voir les jours libres", help: "Touchez un jour libre. Rouge = journée complète occupée.", free: "Libre", partial: "Une demi-journée", busy: "Complet", past: "Non disponible", prev: "Mois précédent", next: "Mois suivant", weekdays: ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"], amOnly: "Ce jour-là, seul le matin est encore libre.", pmOnly: "Ce jour-là, seul l'après-midi est encore libre." },
    en: { title: "See available days", help: "Tap a free day. Red = fully booked.", free: "Free", partial: "Only one half-day", busy: "Booked", past: "Unavailable", prev: "Previous month", next: "Next month", weekdays: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"], amOnly: "On this day only the morning is still free.", pmOnly: "On this day only the afternoon is still free." }
  };
  function lng() { try { var l = localStorage.getItem("gk_lang"); if (l && TXT[l]) return l; } catch (e) {} var h = (document.documentElement.lang || "").slice(0, 2); return TXT[h] ? h : "lb"; }
  function pad(n) { return String(n).padStart(2, "0"); }
  function isoDay(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

  var blocks = {}, month = (function () { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })();
  var root, dateInput, wtime, amOpt, pmOpt, gridEl, monthEl, wkEl, titleEl, helpEl, legEl, hintEl, chosenIso = "";

  function isBlocked(iso, slot) { return !!blocks[iso + "|" + slot]; }
  function dayStatus(date) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    if (date < today) return "past";
    var iso = isoDay(date), am = isBlocked(iso, "am"), pm = isBlocked(iso, "pm");
    if (am && pm) return "busy";
    if (am || pm) return "partial";
    return "free";
  }

  function injectCss() {
    if (document.getElementById("appt-cal-css")) return;
    var s = document.createElement("style");
    s.id = "appt-cal-css";
    s.textContent = ".appt-calendar{margin:4px 0 18px;padding:16px 16px 14px;background:#0d1b2a;border:1px solid rgba(255,255,255,.08);border-radius:16px;color:#eef2f6}.appt-calendar .rental-calendar-kicker{color:#ff8a3d;font-weight:800;font-size:.72rem;letter-spacing:.08em;margin:0 0 2px}.appt-cal-title{margin:0;font-size:1.03rem;color:#fff}.appt-cal-help{color:#aab4c0;margin:4px 0 10px}.appt-cal-hint{margin:10px 0 0;font-size:.9rem;font-weight:700;color:#ffd27a}";
    document.head.appendChild(s);
  }

  function buildDom(before) {
    root = document.createElement("section");
    root.className = "rental-calendar appt-calendar";
    root.innerHTML =
      '<div class="rental-calendar-head"><div><p class="rental-calendar-kicker"></p>' +
      '<h3 class="appt-cal-title"></h3></div><div class="rental-calendar-nav">' +
      '<button type="button" class="appt-cal-prev" aria-label="prev">‹</button>' +
      '<strong class="appt-cal-month" aria-live="polite"></strong>' +
      '<button type="button" class="appt-cal-next" aria-label="next">›</button></div></div>' +
      '<p class="rental-calendar-help appt-cal-help"></p>' +
      '<div class="rental-calendar-weekdays appt-cal-wk" aria-hidden="true"></div>' +
      '<div class="rental-calendar-grid appt-cal-grid" role="grid"></div>' +
      '<div class="rental-calendar-legend appt-cal-leg"></div>' +
      '<p class="appt-cal-hint" role="status" aria-live="polite" hidden></p>';
    before.parentNode.insertBefore(root, before);
    gridEl = root.querySelector(".appt-cal-grid");
    monthEl = root.querySelector(".appt-cal-month");
    wkEl = root.querySelector(".appt-cal-wk");
    titleEl = root.querySelector(".appt-cal-title");
    helpEl = root.querySelector(".appt-cal-help");
    legEl = root.querySelector(".appt-cal-leg");
    hintEl = root.querySelector(".appt-cal-hint");
    root.querySelector(".rental-calendar-kicker").textContent = "📅";
    root.querySelector(".appt-cal-prev").addEventListener("click", function () { month = new Date(month.getFullYear(), month.getMonth() - 1, 1); render(); });
    root.querySelector(".appt-cal-next").addEventListener("click", function () { month = new Date(month.getFullYear(), month.getMonth() + 1, 1); render(); });
    gridEl.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".rental-calendar-day") : null;
      if (!btn || btn.disabled) return;
      selectDay(btn.getAttribute("data-date"));
    });
  }

  function render() {
    var t = TXT[lng()] || TXT.lb;
    titleEl.textContent = t.title;
    helpEl.textContent = t.help;
    root.querySelector(".appt-cal-prev").setAttribute("aria-label", t.prev);
    root.querySelector(".appt-cal-next").setAttribute("aria-label", t.next);
    wkEl.innerHTML = t.weekdays.map(function (d) { return "<span>" + d + "</span>"; }).join("");
    try { monthEl.textContent = new Intl.DateTimeFormat(lng() === "lb" ? "lb-LU" : lng(), { month: "long", year: "numeric" }).format(month); }
    catch (e) { monthEl.textContent = (month.getMonth() + 1) + "/" + month.getFullYear(); }
    legEl.innerHTML =
      '<span><i class="is-free"></i><b>' + t.free + "</b></span>" +
      '<span><i class="is-partial"></i><b>' + t.partial + "</b></span>" +
      '<span><i class="is-busy"></i><b>' + t.busy + "</b></span>" +
      '<span><i class="is-past"></i><b>' + t.past + "</b></span>";
    var firstOffset = (month.getDay() + 6) % 7;
    var count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    var html = "";
    for (var b = 0; b < firstOffset; b++) html += '<span class="rental-calendar-blank" aria-hidden="true"></span>';
    for (var day = 1; day <= count; day++) {
      var date = new Date(month.getFullYear(), month.getMonth(), day), iso = isoDay(date), status = dayStatus(date);
      var disabled = status === "past" || status === "busy";
      html += '<button type="button" role="gridcell" class="rental-calendar-day is-' + status + (iso === chosenIso ? " is-chosen" : "") + '" data-date="' + iso + '" aria-label="' + iso + " – " + (t[status] || "") + '"' + (disabled ? " disabled" : "") + "><span>" + day + "</span></button>";
    }
    gridEl.innerHTML = html;
  }

  function updateSlots(iso) {
    var t = TXT[lng()] || TXT.lb;
    var am = isBlocked(iso, "am"), pm = isBlocked(iso, "pm");
    if (amOpt) amOpt.disabled = am;
    if (pmOpt) pmOpt.disabled = pm;
    if (wtime) {
      var sel = wtime.options[wtime.selectedIndex];
      if (sel && sel.disabled) wtime.selectedIndex = 0;
      if (am && !pm && pmOpt) wtime.value = pmOpt.value;
      else if (pm && !am && amOpt) wtime.value = amOpt.value;
    }
    if (hintEl) {
      if (am && !pm) { hintEl.textContent = t.pmOnly; hintEl.hidden = false; }
      else if (pm && !am) { hintEl.textContent = t.amOnly; hintEl.hidden = false; }
      else { hintEl.hidden = true; }
    }
  }

  function selectDay(iso) {
    chosenIso = iso;
    if (dateInput) {
      dateInput.value = iso;
      try { dateInput.dispatchEvent(new Event("change", { bubbles: true })); } catch (e) {}
    }
    updateSlots(iso);
    render();
  }

  function fetchBlocks() {
    fetch(API + "/appointment-availability", { mode: "cors", credentials: "omit" })
      .then(function (r) { return r.ok ? r.json() : { blocks: [] }; })
      .then(function (d) { (d.blocks || []).forEach(function (b) { blocks[b.date + "|" + b.slot] = true; }); render(); if (chosenIso) updateSlots(chosenIso); })
      .catch(function () {});
  }

  function init() {
    dateInput = document.getElementById("preferred-date");
    wtime = document.getElementById("wtime");
    amOpt = document.getElementById("opt-time-am");
    pmOpt = document.getElementById("opt-time-pm");
    var dates = document.querySelector(".appointment-dates");
    if (!dateInput || !dates) return;
    injectCss();
    buildDom(dates);
    render();
    fetchBlocks();
    // Datum manuell getippt → Slots ubidden
    dateInput.addEventListener("change", function () { if (dateInput.value) { chosenIso = dateInput.value.slice(0, 10); updateSlots(chosenIso); render(); } });
    document.querySelectorAll(".lang-select").forEach(function (sel) { sel.addEventListener("change", function () { setTimeout(render, 0); if (chosenIso) setTimeout(function () { updateSlots(chosenIso); }, 0); }); });
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
