/* Sproochewiessel fir d'Rechtssäiten (Impressum, Datenschutz, Shop-Recht,
   Mietbedingungen, Merci, 404). Liest/schreift denselwechte Schlëssel
   gk_lang wéi de Rescht vun der Säit. Weist de passende [data-lang-block]
   a fällt op Däitsch zréck, wann eng Sprooch net iwwersat ass. */
(function () {
  "use strict";
  var SUP = ["lb", "de", "fr", "en"];
  function getLang() {
    try { var l = localStorage.getItem("gk_lang"); return SUP.indexOf(l) >= 0 ? l : "lb"; }
    catch (e) { return "lb"; }
  }
  function available() {
    var a = {};
    document.querySelectorAll("[data-lang-block]").forEach(function (b) { a[b.getAttribute("data-lang-block")] = true; });
    return a;
  }
  function apply(lang) {
    var av = available();
    var show = av[lang] ? lang : (av.de ? "de" : (av.en ? "en" : Object.keys(av)[0]));
    document.querySelectorAll("[data-lang-block]").forEach(function (b) {
      b.hidden = b.getAttribute("data-lang-block") !== show;
    });
    if (show) document.documentElement.setAttribute("lang", show);
    document.querySelectorAll("[data-set-lang]").forEach(function (btn) {
      var on = btn.getAttribute("data-set-lang") === lang;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
  function setLang(l) {
    try { localStorage.setItem("gk_lang", l); } catch (e) {}
    apply(l);
  }
  function init() {
    document.querySelectorAll("[data-set-lang]").forEach(function (btn) {
      btn.addEventListener("click", function () { setLang(btn.getAttribute("data-set-lang")); });
    });
    apply(getLang());
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
