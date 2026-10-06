/* Dréck-Säit (am Root, ausserhalb vun der PWA-Scope /intern/, fir datt se an
   enger installéierter App am richtege Browser opgeet — do funktionéiert
   window.print() an domat „Als PDF späicheren"). Den Dokument-Inhalt kënnt
   iwwer den URL-Hash eran (self-contained; iwwerlieft den App↔Browser-Wiessel). */
(function () {
  "use strict";
  var doc = document.getElementById("doc");
  var raw = "";
  try { raw = decodeURIComponent((location.hash || "").slice(1)); } catch (e) { raw = ""; }
  if (raw && raw.indexOf("pp-doc") !== -1) {
    // relativ Asset-Pied op absolut setzen (d'Säit läit am Root, net an /intern/)
    doc.innerHTML = raw.replace(/\.\.\/assets\//g, "/assets/");
  } else {
    doc.innerHTML = '<div class="pp-doc"><div class="pp-main"><p style="padding:24px">Keen Dokument fonnt. Maacht d\'Dokument an der Verwaltung op a klickt do op „Drécken / PDF".</p></div></div>';
  }

  var btn = document.getElementById("pbtn"), cbtn = document.getElementById("cbtn");
  function go() { try { window.print(); } catch (e) {} }
  if (btn) btn.addEventListener("click", go);
  if (cbtn) cbtn.addEventListener("click", function () { try { window.close(); } catch (e) {} try { history.back(); } catch (e) {} });

  // Soubal d'Biller gelueden sinn, automatesch den Dréck-Dialog opmaachen.
  var imgs = Array.prototype.slice.call(doc.querySelectorAll("img"));
  Promise.all(imgs.map(function (img) {
    return img.complete ? Promise.resolve() : new Promise(function (res) {
      img.addEventListener("load", res, { once: true });
      img.addEventListener("error", res, { once: true });
    });
  })).then(function () { setTimeout(go, 500); });
}());
