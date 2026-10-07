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
    }
  } catch (e) {}
})();
