/* Ëffentleche Verfügbarkeets-Kalenner fir d'Rendez-vous-Formulaire.
   - Hallefdag-Visualiséierung: uewe = moies, ënnen = nomëttes.
   - Gréng = fräi, rout = gespaart; béid rout = ganzen Dag ausgebucht.
   - Gro = net wielbar (vergaangen, sonndes, oder Feiertag/zou).
   - Eng Kalenner fir Wonschdatum A Alternativdatum. */
(function () {
  "use strict";
  var API = "https://garage-admin.autoservicebettenduerf.lu";
  var TXT = {
    lb: { title: "Fräi Deeg kucken", help: "Uewen = moies, ënnen = nomëttes. Wielt e Wonschdatum (an optional en Alternativ).", free: "Fräi", half: "1 Hallefdag", busy: "Ausgebucht", closed: "Zou", past: "Net wielbar", prev: "Mount virdrun", next: "Nächste Mount", weekdays: ["Mé", "Dë", "Më", "Do", "Fr", "Sa", "So"], amOnly: "Op dësem Dag ass just nach moies fräi.", pmOnly: "Op dësem Dag ass just nach nomëttes fräi.", pref: "Wonschdatum", alt: "Alternativ (optional)", none: "—", pickAlt: "Tippt elo op en Alternativdatum." },
    de: { title: "Freie Tage ansehen", help: "Oben = vormittags, unten = nachmittags. Wählen Sie ein Wunschdatum (und optional eine Alternative).", free: "Frei", half: "1 Halbtag", busy: "Ausgebucht", closed: "Zu", past: "Nicht wählbar", prev: "Vorheriger Monat", next: "Nächster Monat", weekdays: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"], amOnly: "An diesem Tag ist nur vormittags frei.", pmOnly: "An diesem Tag ist nur nachmittags frei.", pref: "Wunschdatum", alt: "Alternative (optional)", none: "—", pickAlt: "Tippen Sie nun auf ein Alternativdatum." },
    fr: { title: "Voir les jours libres", help: "Haut = matin, bas = après-midi. Choisissez une date souhaitée (et éventuellement une alternative).", free: "Libre", half: "½ journée", busy: "Complet", closed: "Fermé", past: "Non disponible", prev: "Mois précédent", next: "Mois suivant", weekdays: ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"], amOnly: "Ce jour-là, seul le matin est libre.", pmOnly: "Ce jour-là, seul l'après-midi est libre.", pref: "Date souhaitée", alt: "Alternative (option)", none: "—", pickAlt: "Touchez maintenant une date alternative." },
    en: { title: "See available days", help: "Top = morning, bottom = afternoon. Pick a preferred date (and optionally an alternative).", free: "Free", half: "Half-day", busy: "Booked", closed: "Closed", past: "Unavailable", prev: "Previous month", next: "Next month", weekdays: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"], amOnly: "On this day only the morning is free.", pmOnly: "On this day only the afternoon is free.", pref: "Preferred date", alt: "Alternative (optional)", none: "—", pickAlt: "Now tap an alternative date." }
  };
  function lng() { try { var l = localStorage.getItem("gk_lang"); if (l && TXT[l]) return l; } catch (e) {} var h = (document.documentElement.lang || "").slice(0, 2); return TXT[h] ? h : "lb"; }
  function pad(n) { return String(n).padStart(2, "0"); }
  function isoDay(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function fmt(iso) { if (!iso) return ""; var p = iso.split("-"); return p[2] + "." + p[1] + "." + p[0]; }

  var blocks = {}, month = (function () { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })();
  var availability = "loading", pendingFetch = null;
  var STATUS = {lb:{loading:"Verfügbarkeet gëtt gelueden…",error:"Verfügbarkeet net disponibel. Probéiert nach eng Kéier.",retry:"Nach eng Kéier",changed:"Déi gewielten Datumer sinn net méi fräi. Wielt nei."},de:{loading:"Verfügbarkeit wird geladen…",error:"Verfügbarkeit nicht erreichbar. Bitte erneut versuchen.",retry:"Erneut versuchen",changed:"Die gewählten Termine sind nicht mehr frei. Bitte neu wählen."},fr:{loading:"Chargement des disponibilités…",error:"Disponibilités indisponibles. Veuillez réessayer.",retry:"Réessayer",changed:"Les dates choisies ne sont plus libres. Choisissez à nouveau."},en:{loading:"Loading availability…",error:"Availability could not be loaded. Please retry.",retry:"Retry",changed:"The selected dates are no longer available. Please choose again."}};
  var prefIso = "", altIso = "", active = "pref";
  var root, dateInput, altInput, wtime, amOpt, pmOpt, gridEl, monthEl, wkEl, titleEl, helpEl, legEl, hintEl, targetsEl;

  function isB(iso, slot) { return !!blocks[iso + "|" + slot]; }
  function dayInfo(date) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var iso = isoDay(date);
    var past = date < today, sunday = date.getDay() === 0, closed = isB(iso, "closed");
    var am = isB(iso, "am"), pm = isB(iso, "pm");
    var grey = availability !== "ready" || past || sunday || closed;
    var busy = !grey && am && pm;
    return { iso: iso, past: past, sunday: sunday, closed: closed, am: am, pm: pm, grey: grey, busy: busy, selectable: !grey && !busy };
  }

  function injectCss() {
    if (document.getElementById("appt-cal-css")) return;
    var s = document.createElement("style"); s.id = "appt-cal-css";
    s.textContent =
      ".appointment-dates{display:none!important}" +
      ".appt-calendar{margin:4px 0 16px;padding:16px 16px 14px;background:#0d1b2a;border:1px solid rgba(255,255,255,.08);border-radius:16px;color:#eef2f6}" +
      ".appt-calendar .rental-calendar-kicker{color:#ff8a3d;font-weight:800;font-size:.72rem;letter-spacing:.08em;margin:0 0 2px}" +
      ".appt-cal-title{margin:0;font-size:1.03rem;color:#fff}.appt-cal-help{color:#aab4c0;margin:4px 0 12px;font-size:.84rem}" +
      ".appt-cal-targets{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}" +
      ".appt-cal-target{flex:1;min-width:150px;text-align:left;font:inherit;background:#15202e;border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:8px 11px;color:#eef2f6;cursor:pointer;position:relative}" +
      ".appt-cal-target.active{border-color:#ff8a3d;box-shadow:0 0 0 1px #ff8a3d}" +
      ".appt-cal-target .lab{display:block;font-size:.68rem;text-transform:uppercase;letter-spacing:.04em;color:#9fb0c0;font-weight:800}" +
      ".appt-cal-target .val{display:block;font-size:.98rem;font-weight:700;margin-top:1px}" +
      ".appt-cal-target .clr{position:absolute;top:7px;right:9px;color:#9fb0c0;font-weight:900}" +
      ".appt-cal-grid2{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}" +
      ".appt-cal-wk2{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px}" +
      ".appt-cal-wk2 span{text-align:center;font-size:.66rem;font-weight:800;color:#8aa;letter-spacing:.03em}" +
      ".appt-blank{min-height:46px}" +
      ".appt-day{position:relative;border:1px solid rgba(255,255,255,.12);border-radius:7px;min-height:46px;cursor:pointer;overflow:hidden;background:#15202e;color:#fff;font-size:.76rem;font-weight:700;padding:0;display:flex;align-items:center;justify-content:center}" +
      ".appt-day .num{position:relative;z-index:2}" +
      ".appt-day .h{position:absolute;left:0;right:0;z-index:1}.appt-day .h.am{top:0;bottom:50%}.appt-day .h.pm{top:50%;bottom:0}" +
      ".appt-day .h.free{background:rgba(42,157,108,.34)}.appt-day .h.block{background:rgba(230,57,70,.42)}" +
      ".appt-day.grey{background:#1b2531;color:#64727f;cursor:default}.appt-day.busy{cursor:default}" +
      ".appt-day.sel-pref{box-shadow:inset 0 0 0 2px #ff8a3d}.appt-day.sel-alt{box-shadow:inset 0 0 0 2px #ffd27a}" +
      ".appt-day .badge{position:absolute;top:1px;right:2px;z-index:3;font-size:.58rem;font-weight:900;color:#0d1b2a;background:#ff8a3d;border-radius:3px;padding:0 3px;line-height:1.4}.appt-day .badge.alt{background:#ffd27a}" +
      ".appt-cal-leg2{display:flex;flex-wrap:wrap;gap:10px 14px;margin-top:12px;font-size:.76rem;color:#aab4c0}" +
      ".appt-cal-leg2 span{display:inline-flex;align-items:center;gap:6px}.appt-cal-leg2 i{width:16px;height:16px;border-radius:3px;display:inline-block;border:1px solid rgba(255,255,255,.14)}" +
      ".appt-cal-hint{margin:10px 0 0;font-size:.9rem;font-weight:700;color:#ffd27a}" +
      ".appt-cal-nav button{font:inherit;font-weight:800;border:1px solid rgba(255,255,255,.18);background:#15202e;color:#fff;border-radius:8px;padding:3px 10px;cursor:pointer}";
    document.head.appendChild(s);
  }

  function buildDom(before) {
    root = document.createElement("section");
    root.className = "rental-calendar appt-calendar";
    root.innerHTML =
      '<div class="rental-calendar-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px"><div><p class="rental-calendar-kicker">📅</p><h3 class="appt-cal-title"></h3></div>' +
      '<div class="rental-calendar-nav appt-cal-nav" style="display:flex;align-items:center;gap:6px"><button type="button" class="appt-cal-prev">‹</button><strong class="appt-cal-month" aria-live="polite"></strong><button type="button" class="appt-cal-next">›</button></div></div>' +
      '<p class="appt-cal-help"></p><p class="appt-cal-status" role="status" aria-live="polite"></p><button type="button" class="appt-cal-retry" hidden></button>' +
      '<div class="appt-cal-targets"></div>' +
      '<div class="appt-cal-wk2" aria-hidden="true"></div>' +
      '<div class="appt-cal-grid2" role="grid"></div>' +
      '<div class="appt-cal-leg2"></div>' +
      '<p class="appt-cal-hint" role="status" aria-live="polite" hidden></p>';
    before.parentNode.insertBefore(root, before);
    root.querySelector(".appt-cal-retry").addEventListener("click", fetchBlocks);
    gridEl = root.querySelector(".appt-cal-grid2"); monthEl = root.querySelector(".appt-cal-month");
    wkEl = root.querySelector(".appt-cal-wk2"); titleEl = root.querySelector(".appt-cal-title");
    helpEl = root.querySelector(".appt-cal-help"); legEl = root.querySelector(".appt-cal-leg2");
    hintEl = root.querySelector(".appt-cal-hint"); targetsEl = root.querySelector(".appt-cal-targets");
    root.querySelector(".appt-cal-prev").addEventListener("click", function () { month = new Date(month.getFullYear(), month.getMonth() - 1, 1); render(); });
    root.querySelector(".appt-cal-next").addEventListener("click", function () { month = new Date(month.getFullYear(), month.getMonth() + 1, 1); render(); });
    gridEl.addEventListener("click", function (e) { var btn = e.target.closest ? e.target.closest(".appt-day") : null; if (btn && !btn.disabled) selectDay(btn.getAttribute("data-date")); });
    targetsEl.addEventListener("click", function (e) {
      var clr = e.target.closest ? e.target.closest("[data-clear]") : null;
      if (clr) { e.stopPropagation(); clearTarget(clr.getAttribute("data-clear")); return; }
      var t = e.target.closest ? e.target.closest("[data-target]") : null;
      if (t) { active = t.getAttribute("data-target"); render(); }
    });
  }

  function renderTargets(t) {
    function chip(key, label, iso) {
      return '<div class="appt-cal-target' + (active === key ? " active" : "") + '" data-target="' + key + '" role="button" tabindex="0">' +
        '<span class="lab">' + label + "</span><span class=\"val\">" + (iso ? fmt(iso) : t.none) + "</span>" +
        (iso ? '<span class="clr" data-clear="' + key + '" title="✕">✕</span>' : "") + "</div>";
    }
    targetsEl.innerHTML = chip("pref", t.pref, prefIso) + chip("alt", t.alt, altIso);
  }

  function render() {
    var t = TXT[lng()] || TXT.lb;
    var status = STATUS[lng()] || STATUS.lb;
    root.querySelector(".appt-cal-status").textContent = availability === "ready" ? "" : status[availability];
    var retry = root.querySelector(".appt-cal-retry"); retry.hidden = availability !== "error"; retry.textContent = status.retry;
    titleEl.textContent = t.title; helpEl.textContent = t.help;
    root.querySelector(".appt-cal-prev").setAttribute("aria-label", t.prev);
    root.querySelector(".appt-cal-next").setAttribute("aria-label", t.next);
    wkEl.innerHTML = t.weekdays.map(function (d) { return "<span>" + d + "</span>"; }).join("");
    try { monthEl.textContent = new Intl.DateTimeFormat(lng() === "lb" ? "lb-LU" : lng(), { month: "long", year: "numeric" }).format(month); }
    catch (e) { monthEl.textContent = (month.getMonth() + 1) + "/" + month.getFullYear(); }
    renderTargets(t);
    legEl.innerHTML =
      '<span><i style="background:rgba(42,157,108,.5)"></i>' + t.free + "</span>" +
      '<span><i style="background:linear-gradient(to bottom,rgba(42,157,108,.6) 50%,rgba(230,57,70,.7) 50%)"></i>' + t.half + "</span>" +
      '<span><i style="background:rgba(230,57,70,.6)"></i>' + t.busy + "</span>" +
      '<span><i style="background:#64727f"></i>' + t.closed + " / " + t.past + "</span>";
    var firstOffset = (month.getDay() + 6) % 7;
    var count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    var html = "";
    for (var b = 0; b < firstOffset; b++) html += '<span class="appt-blank" aria-hidden="true"></span>';
    for (var day = 1; day <= count; day++) {
      var info = dayInfo(new Date(month.getFullYear(), month.getMonth(), day));
      var cls = "appt-day" + (info.grey ? " grey" : "") + (info.busy ? " busy" : "");
      if (info.iso === prefIso) cls += " sel-pref"; else if (info.iso === altIso) cls += " sel-alt";
      var inner = info.grey ? "" : '<span class="h am ' + (info.am ? "block" : "free") + '"></span><span class="h pm ' + (info.pm ? "block" : "free") + '"></span>';
      inner += '<span class="num">' + day + "</span>";
      if (info.iso === prefIso) inner += '<span class="badge">1</span>'; else if (info.iso === altIso) inner += '<span class="badge alt">2</span>';
      var lab = info.past ? t.past : info.sunday || info.closed ? t.closed : info.busy ? t.busy : info.am ? t.pmOnly : info.pm ? t.amOnly : t.free;
      html += '<button type="button" role="gridcell" class="' + cls + '" data-date="' + info.iso + '" aria-label="' + info.iso + " – " + lab + '"' + (info.selectable ? "" : " disabled") + ">" + inner + "</button>";
    }
    gridEl.innerHTML = html;
    updateHint();
  }

  function updateHint() {
    var t = TXT[lng()] || TXT.lb;
    if (prefIso) {
      var i = dayInfo(new Date(prefIso.slice(0, 4), Number(prefIso.slice(5, 7)) - 1, Number(prefIso.slice(8, 10))));
      if (i.am && !i.pm) { hintEl.textContent = t.pmOnly; hintEl.hidden = false; return; }
      if (i.pm && !i.am) { hintEl.textContent = t.amOnly; hintEl.hidden = false; return; }
    } else if (active === "alt" && altIso === "") { hintEl.textContent = t.pickAlt; hintEl.hidden = false; return; }
    hintEl.hidden = true;
  }

  function setNative() {
    if (dateInput) { dateInput.value = prefIso; try { dateInput.dispatchEvent(new Event("change", { bubbles: true })); } catch (e) {} }
    if (altInput) altInput.value = altIso;
  }
  function updateSlots() {
    var am = availability !== "ready" || (prefIso ? isB(prefIso, "am") : false), pm = availability !== "ready" || (prefIso ? isB(prefIso, "pm") : false);
    if (amOpt) amOpt.disabled = am; if (pmOpt) pmOpt.disabled = pm;
    if (wtime) {
      var sel = wtime.options[wtime.selectedIndex];
      if (sel && sel.disabled) wtime.selectedIndex = 0;
      if (am && !pm && pmOpt) wtime.value = pmOpt.value;
      else if (pm && !am && amOpt) wtime.value = amOpt.value;
    }
  }
  function clearTarget(key) { if (key === "pref") prefIso = ""; else altIso = ""; active = key; setNative(); updateSlots(); render(); }
  function selectable(iso) { return !!iso && dayInfo(new Date(iso + "T00:00:00")).selectable; }
  function selectDay(iso) {
    if (!selectable(iso)) return;
    if (iso === prefIso) { prefIso = ""; active = "pref"; setNative(); updateSlots(); render(); return; }
    if (iso === altIso) { altIso = ""; active = "alt"; setNative(); render(); return; }
    if (active === "alt") { altIso = iso; active = "pref"; }
    else { prefIso = iso; if (!altIso) active = "alt"; }
    setNative(); updateSlots(); render();
  }

  function revalidate() {
    if (prefIso && !selectable(prefIso)) prefIso = "";
    if (altIso && !selectable(altIso)) altIso = "";
    setNative(); updateSlots(); render();
  }
  function fetchBlocks() {
    if (pendingFetch) return pendingFetch;
    availability = "loading"; render(); updateSlots();
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 10000);
    pendingFetch = fetch(API + "/appointment-availability", { mode: "cors", credentials: "omit", cache: "no-store", signal: controller.signal })
      .then(function (r) { if (!r.ok) throw new Error("availability"); return r.json(); })
      .then(function (d) {
        if (!Array.isArray(d.blocks)) throw new Error("availability");
        var next = {};
        d.blocks.forEach(function (b) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date) || ["am", "pm", "closed"].indexOf(b.slot) < 0) throw new Error("availability");
          next[b.date + "|" + b.slot] = true;
        });
        blocks = next; availability = "ready"; revalidate();
      })
      .catch(function () { availability = "error"; revalidate(); })
      .finally(function () { clearTimeout(timer); pendingFetch = null; });
    return pendingFetch;
  }
  window.appointmentCalendar = {
    validate: function () {
      revalidate();
      var slot = wtime && wtime.options[wtime.selectedIndex];
      var part = slot && slot.getAttribute("data-slot");
      var blocked = [prefIso, altIso].filter(Boolean).some(function (iso) { return part && isB(iso, part); });
      return availability === "ready" && selectable(prefIso) && !blocked;
    },
    message: function () { var t = STATUS[lng()] || STATUS.lb; return availability === "ready" ? t.changed : t[availability]; },
    refresh: fetchBlocks
  };

  function init() {
    dateInput = document.getElementById("preferred-date");
    altInput = document.getElementById("alternative-date");
    wtime = document.getElementById("wtime");
    amOpt = document.getElementById("opt-time-am");
    pmOpt = document.getElementById("opt-time-pm");
    var dates = document.querySelector(".appointment-dates");
    if (!dateInput || !dates) return;
    injectCss();
    buildDom(dates);
    render();
    fetchBlocks();
    var form = dateInput.form;
    if (form) form.addEventListener("reset", function () { setTimeout(function () { prefIso = ""; altIso = ""; active = "pref"; updateSlots(); render(); }, 0); });
    document.querySelectorAll(".lang-select").forEach(function (sel) { sel.addEventListener("change", function () { setTimeout(render, 0); }); });
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();

