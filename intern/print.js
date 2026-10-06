/* Dréck-Säit fir d'Dokumenter (Mietvertrag, Protokoller). Den Inhalt kënnt
   iwwer den URL-Hash eran (encodéiert), well eng standalone-PWA (besonnesch
   iOS) kee gemeinsame Späicher mam Browser huet. Hei am richtege Browser-Tab
   funktionéiert window.print() an domat „Als PDF späicheren". */
(function () {
  "use strict";
  var doc = document.getElementById("doc");
  var raw = "";
  try { raw = decodeURIComponent((location.hash || "").slice(1)); } catch (e) { raw = ""; }
  if (raw && raw.indexOf("pp-doc") !== -1) { doc.innerHTML = raw; }
  else { doc.innerHTML = '<div class="pp-doc"><div class="pp-main"><p style="padding:24px">Keen Dokument fonnt. Maacht d\'Dokument an der Verwaltung op a klickt do op „Drécken / PDF".</p></div></div>'; }

  var btn = document.getElementById("pbtn");
  function go() { try { window.print(); } catch (e) {} }
  if (btn) btn.addEventListener("click", go);

  // Soubal d'Biller gelueden sinn, automatesch den Dréck-Dialog opmaachen.
  var imgs = Array.prototype.slice.call(doc.querySelectorAll("img"));
  Promise.all(imgs.map(function (img) {
    return img.complete ? Promise.resolve() : new Promise(function (res) {
      img.addEventListener("load", res, { once: true });
      img.addEventListener("error", res, { once: true });
    });
  })).then(function () { setTimeout(go, 400); });
}());
