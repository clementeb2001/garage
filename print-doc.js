/* Dréck-Säit (am Root, ausserhalb vun der PWA-Scope /intern/, fir datt se an
   enger installéierter App am richtege Browser opgeet). Den Dokument-Inhalt
   kënnt iwwer den URL-Hash eran (self-contained). */
(function () {
  "use strict";
  var body = document.body;
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

  // "Clean"-Modus: d'Steierelementer (Knäppercher + Instruktioun) verstoppen, sou
  // datt beim „Als PDF späicheren" (iOS mécht e Bild vun der ganzer Säit) nëmmen
  // de Vertrag drop ass. De Browser säin eegenen ⬆︎-Deelen-Knäppchen bleift do.
  function setClean(on) { if (on) body.classList.add("pdfclean"); else body.classList.remove("pdfclean"); }
  function go() { setClean(true); try { window.print(); } catch (e) {} }
  if (btn) btn.addEventListener("click", go);
  if (cbtn) cbtn.addEventListener("click", function () { try { window.close(); } catch (e) {} try { history.back(); } catch (e) {} });

  // Zréck aus dem Clean-Modus: op de groen Hannergrond tippen …
  document.addEventListener("click", function (e) {
    if (body.classList.contains("pdfclean") && btn && e.target !== btn && !(e.target.closest && e.target.closest(".pp-doc"))) setClean(false);
  });
  // … oder automatesch, wann een nees op d'Säit zréckkënnt.
  document.addEventListener("visibilitychange", function () { if (!document.hidden) setClean(false); });
  window.addEventListener("pageshow", function () { setClean(false); });

  // Um Computer / a richtegem Safari den Dréck-Dialog automatesch opmaachen,
  // soubal d'Biller gelueden sinn (am In-App-Browser mécht dat näischt — do
  // benotzt een ⬆︎ Deelen).
  var imgs = Array.prototype.slice.call(doc.querySelectorAll("img"));
  Promise.all(imgs.map(function (img) {
    return img.complete ? Promise.resolve() : new Promise(function (res) {
      img.addEventListener("load", res, { once: true });
      img.addEventListener("error", res, { once: true });
    });
  })).then(function () { setTimeout(function () { try { window.print(); } catch (e) {} }, 500); });
}());
