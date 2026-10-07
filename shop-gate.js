/* Shop-Virschau-Gate — setzt html.shop-dev fir ?dev=1 (CSP-konform, extern,
   am <head> gelueden, fir keen Opbléizen vun der "geschwënn"-Säit).

   ========================================================================
   ⚠️  CHECKLIST IER DE SHOP ÖFFENTLECH LIVE GEET
   (dës Datei ëmstellen = de Shop ass fir jiddwereen opgespaart):
     1. VERSAND: Versandkäschten festleeën (Betrag, Zonen, evtl. gratis-ab).
        → Dann am Warekuerf eng Versandzeil derbäi an den Total op
          "Wueren + Versand" ëmstellen, sou datt de Gesamtbetrag INKL.
          Versand virun der "Bezuelungspflichteg bestellen"-Schaltfläch
          steet (gesetzlech Flicht). Elo weist den Total nëmmen d'Wueren.
     2. MOLLIE: Live-API-Key als Cloudflare-Secret (MOLLIE_API_KEY)
        hannerleeën a Worker deployéieren.
     3. RECHT: shop-rechtliches.html — Versandgebitt, konkret Käschten a
        Liwwerzäiten definitiv hannerleeën + rechtlech Préifung.
     4. SEO: am shop.html d'<meta robots> "noindex" ewechhuelen, an der
        robots.txt "Disallow: /shop.html" läschen, a shop.html an d'
        sitemap.xml ophuelen, sou datt de Shop indexéiert gëtt.
     5. Eréischt DANN d'Gate hei ëmstellen (ëmmer shop-dev setzen / Gate
        ewechhuelen), sou datt d'Public de Shop gesäit.
   ======================================================================== */
(function () {
  var SOON_TEXT = {
    lb: {
      label: "Shop am Opbau",
      eyebrow: "Online-Shop",
      title: "Eisen Shop ass am Opbau",
      text: "Mir bauen eisen Autodeeler-Shop am Moment op. Kuckt geschwënn nach eng Kéier laanscht oder kontaktéiert eis direkt fir Deeler a Präisser.",
      cta: "Deel ufroen",
      back: "Zréck op d'Startsäit"
    },
    de: {
      label: "Shop im Aufbau",
      eyebrow: "Online-Shop",
      title: "Unser Shop ist im Aufbau",
      text: "Wir bauen unseren Autoteile-Shop derzeit auf. Schauen Sie bald wieder vorbei oder kontaktieren Sie uns direkt für Teile und Preise.",
      cta: "Teil anfragen",
      back: "Zurück zur Startseite"
    },
    fr: {
      label: "Boutique en construction",
      eyebrow: "Boutique en ligne",
      title: "Notre boutique est en construction",
      text: "Nous préparons actuellement notre boutique de pièces automobiles. Revenez bientôt ou contactez-nous directement pour toute demande de pièce ou de prix.",
      cta: "Demander une pièce",
      back: "Retour à l'accueil"
    },
    en: {
      label: "Shop under construction",
      eyebrow: "Online shop",
      title: "Our shop is under construction",
      text: "We are currently building our online car-parts shop. Check back soon or contact us directly for parts and prices.",
      cta: "Request a part",
      back: "Back to the home page"
    }
  };
  var preview = false;
  try {
    var p = new URLSearchParams(location.search);
    // Virschau-Schlëssel: rotéiert (gk_shop_dev → gk_shop_preview), fir al
    // Virschau-Cookien zréckzesetzen, sou datt de Shop nees op "in Aarbecht"
    // steet. Al Schlëssel oprëmen, fir datt keng al Virschau hänke bleift.
    try { localStorage.removeItem("gk_shop_dev"); } catch (e) {}
    if (p.get("dev") === "1") localStorage.setItem("gk_shop_preview", "1");
    if (p.get("dev") === "0") localStorage.removeItem("gk_shop_preview");
    if (localStorage.getItem("gk_shop_preview") === "1") {
      document.documentElement.classList.add("shop-dev");
      preview = true;
    }
  } catch (e) {}

  function loadScript(src, done) {
    var script = document.createElement("script");
    script.src = src;
    script.onload = done || null;
    script.onerror = function () {
      var status = document.getElementById("shop-preview-text");
      if (status) status.textContent = "De Katalog konnt net geluede ginn. Lued d'Säit w.e.g. nei.";
    };
    document.head.appendChild(script);
  }

  function applySoonText(requestedLang) {
    var lang = requestedLang || document.documentElement.lang;
    if (!SOON_TEXT[lang]) {
      try { lang = localStorage.getItem("gk_lang") || lang; } catch (e) {}
    }
    if (!SOON_TEXT[lang]) lang = "lb";
    var copy = SOON_TEXT[lang];
    var soon = document.getElementById("shop-soon");
    if (soon) soon.setAttribute("aria-label", copy.label);
    [
      ["soon-eyebrow", copy.eyebrow],
      ["soon-title", copy.title],
      ["soon-text", copy.text],
      ["soon-cta", copy.cta],
      ["soon-back", copy.back]
    ].forEach(function (entry) {
      var element = document.getElementById(entry[0]);
      if (element) element.textContent = entry[1];
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (preview) {
      /* De schwéiere Katalog gëtt nëmmen am ausdréckleche Virschau-Modus
         gelueden; déi ëffentlech Baustellesäit bleift liicht a séier. */
      loadScript("shop-data.js?v=11", function () {
        loadScript("vehicle-catalog.js?v=4", function () { loadScript("shop.js?v=66"); });
      });
      return;
    }
    /* De komplette Katalog-Iwwersetzer gëtt ëffentlech bewosst net gelueden.
       Dofir iwwersetze mir déi liicht Baustellesäit direkt hei. */
    var storedLang = "";
    try { storedLang = localStorage.getItem("gk_lang") || ""; } catch (e) {}
    applySoonText(storedLang);
    document.querySelectorAll(".lang-select").forEach(function (select) {
      select.addEventListener("change", function () { applySoonText(select.value); });
    });
    /* En ale Shop-Service-Worker hat Scope "/". Bei ëffentleche Visite gëtt
       en ofgemellt an de Shop-Cache geläscht, sou datt en Homepage a Location
       net méi mat ale Fichiere beaflosse kann. */
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (reg) {
          var worker = reg.active || reg.waiting || reg.installing;
          if (worker && /\/shop-sw\.js(?:$|\?)/.test(worker.scriptURL || "")) reg.unregister();
        });
      }).catch(function () {});
    }
    if (window.caches && caches.keys) {
      caches.keys().then(function (keys) {
        keys.filter(function (key) { return /^autoservice-(?:shop|product-images)-/.test(key); })
          .forEach(function (key) { caches.delete(key); });
      }).catch(function () {});
    }
  });
})();
