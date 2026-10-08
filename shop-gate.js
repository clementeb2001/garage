/* Ëffentleche Shop-Loader (CSP-konform, extern am <head> gelueden).

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
  // Virschau-Fräischaltung: ?dev=1 späichert de Flag, ?dev=0 läscht en.
  try {
    var params = new URLSearchParams(location.search);
    if (params.get("dev") === "1") localStorage.setItem("gk_shop_preview", "1");
    else if (params.get("dev") === "0") localStorage.removeItem("gk_shop_preview");
  } catch (e) {}
  var shopPreview = false;
  try { shopPreview = localStorage.getItem("gk_shop_preview") === "1"; } catch (e) {}
  // Bewosst OUNI "shop-live": de Virschau-Badge soll am Virschau-Modus sichtbar bleiwen.
  if (shopPreview) document.documentElement.classList.add("shop-dev");

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
    if (shopPreview) {
      // Virschau: Katalog a Präisser aus der verbindlech D1-Quell lueden.
      loadScript("shop-catalog-api.js?v=4", function () {
        window.GARAGE_CATALOG.init().then(function () {
          loadScript("vehicle-catalog.js?v=4", function () { loadScript("shop.js?v=75"); });
        }).catch(function () {
          var status = document.getElementById("shop-preview-text");
          if (status) status.textContent = "De Katalog ass momentan net disponibel. Probéiert et w.e.g. méi spéit nach eng Kéier.";
        });
      });
    } else {
      // Ëffentlech: "am Aufbau"-Säit weisen, de Katalog NET lueden.
      applySoonText();
    }
  });
})();
