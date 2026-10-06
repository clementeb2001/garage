/* Hält d'Präisangaben an de Mietbedingungen synchron mat der Flott (Admin).
   Fält d'Flott net erreechbar oder e Wäert 0, bleift den Text aus dem HTML
   (Fallback). All Sproochblock gëtt an senger eegener Schreifweis formatéiert. */
(function () {
  "use strict";
  function money(n, lang) {
    var v = Number(n); if (!isFinite(v) || v <= 0) return null;
    var hasDec = Math.round(v * 100) % 100 !== 0;
    var num = hasDec ? v.toFixed(2) : String(Math.round(v));
    if (lang === "en") return "€" + num;              // €100 / €0.30
    return num.replace(".", ",") + " €";          // 100 € / 0,30 €
  }
  function km(n) { var v = Number(n); if (!isFinite(v) || v <= 0) return null; return String(Math.round(v)) + " km"; }

  function apply(v) {
    var nodes = document.querySelectorAll("[data-mb]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i], kind = el.getAttribute("data-mb");
      var block = el.closest ? el.closest("[data-lang-block]") : null;
      var lang = block ? (block.getAttribute("data-lang-block") || "lb") : "lb";
      var out = null;
      if (kind === "price") out = money(v.priceDay, lang);
      else if (kind === "included") out = km(v.includedKm);
      else if (kind === "extrakm") out = money(v.extraKmRate, lang);
      else if (kind === "deposit") out = money(v.deposit, lang);
      else if (kind === "late") out = money(v.lateFeeHour, lang);
      if (out) el.textContent = out;
    }
  }

  try {
    fetch("https://garage-admin.autoservicebettenduerf.lu/fleet/public", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.vehicles || !data.vehicles.length) return;
        var v = data.vehicles.filter(function (x) { return x.type !== "trailer"; })[0] || data.vehicles[0];
        if (v) apply(v);
      })
      .catch(function () {});
  } catch (e) {}
}());
