/* Autoservice Bettenduerf — Shop (REMUS Sport Exhausts), méisproocheg.
   Katalog kënnt aus shop-data.js (SHOP_PRODUCTS / SHOP_BRANDS / SHOP_MAKES …).
   Produiten mat Bild, Lagerstatus an EC-Zoulassung. Bezuelung iwwer Mollie. */
(function () {
  "use strict";

  var PAYMENT_ENDPOINT = "https://mollie-pay.autoservicebettenduerf.lu";
  var ADMIN_API = "https://garage-admin.autoservicebettenduerf.lu";
  var PAGE_SIZE = 48;
  var visibleCount = PAGE_SIZE;

  var PRODUCTS = window.SHOP_PRODUCTS || [];
  var BRANDS = window.SHOP_BRANDS || {};
  var MAKES = window.SHOP_MAKES || [];
  var ENGINES = window.SHOP_ENGINES || [];
  var VARIANTS = window.SHOP_VARIANTS || [];
  var GENS = window.SHOP_GENS || [];
  var IMAGES = window.SHOP_IMAGES || [];
  var REMUS_PARTS = window.REMUS_PARTS || {};
  var remusPartsRequested = false;
  var remusPartsCallbacks = [];
  var IMGBASE = (window.SHOP_META && window.SHOP_META.imgbase) || "";
  var cart = [];

  /* makeName -> index (fir Fitment-Filter). Gëtt via buildIndexes() opgebaut,
     well DBA spéider nogelueden gëtt an d'Tabellen erweidert. */
  var MAKE_IDX = {};

  var state = { mode: "all", q: "", mf: "all", cat: "all", brand: "", model: "", generation: "", year: "", engine: "", axle: "all", approval: "all", sort: "name", favoritesOnly: false };
  var favorites = loadJson("gk_shop_favorites", []);
  var compareIds = loadJson("gk_shop_compare", []);
  var activeCompareDialog = null;
  var lastDialogFocus = null;

  function loadJson(key, fallback) {
    try { var value = JSON.parse(localStorage.getItem(key)); return value || fallback; }
    catch (e) { return fallback; }
  }
  function saveJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  function saveState() {
    saveJson("gk_shop_state", state);
    try { sessionStorage.setItem("gk_shop_scroll", String(window.scrollY || 0)); } catch (e) {}
  }
  function restoreState() {
    var saved = loadJson("gk_shop_state", null);
    if (!saved) return;
    Object.keys(state).forEach(function (key) { if (Object.prototype.hasOwnProperty.call(saved, key)) state[key] = saved[key]; });
  }
  var ALL_FITS = [];

  /* REMUS Bundle-Varianten: selwechte Systemëmfang + Passform, aner Ausféierung/Endréier */
  function bundleBaseName(p) {
    return (p.n.split("|")[0] || p.n).trim();
  }
  function bundleVariantName(p) {
    var parts = p.n.split("|");
    return parts.length > 1 ? parts.slice(1).join("|").trim() : p.n;
  }
  function bundleFitKey(p) {
    return p.f.map(function (x) { return x.join(","); }).sort().join(";");
  }
  function bundleGroupKey(p) {
    return [p.m, p.r, bundleBaseName(p), bundleFitKey(p)].join("||");
  }
  var BUNDLE_GROUPS = {};
  /* Baut all ofgeleet Indizes nei op. Gëtt beim Luede opgeruff an erëm nodeems
     DBA via shop-data-dba.js nogelueden an an d'global Tabellen gemerged ass. */
  function buildIndexes() {
    MAKE_IDX = {};
    MAKES.forEach(function (m, i) { MAKE_IDX[m] = i; });
    ALL_FITS.length = 0;
    PRODUCTS.forEach(function (p) {
      if (mfOf(p) === "REMUS" && REMUS_PARTS[p.i]) p.ps = REMUS_PARTS[p.i];
      p.f.forEach(function (fit) { ALL_FITS.push(fit); });
    });
    BUNDLE_GROUPS = {};
    PRODUCTS.forEach(function (p) {
      var key = bundleGroupKey(p);
      if (!BUNDLE_GROUPS[key]) BUNDLE_GROUPS[key] = [];
      BUNDLE_GROUPS[key].push(p);
    });
    Object.keys(BUNDLE_GROUPS).forEach(function (key) {
      BUNDLE_GROUPS[key].sort(function (a, b) {
        if (a.p !== b.p) return a.p - b.p;
        return a.n < b.n ? -1 : 1;
      });
    });
  }
  buildIndexes();
  function bundleVariants(p) {
    if (mfOf(p) === "DBA") return [p];
    return BUNDLE_GROUPS[bundleGroupKey(p)] || [p];
  }

  /* All valabel REMUS-Konfiguratioun ass am Export en eegene Bundle. D'Famill
     virun der leschter Variantennummer verbënnt nëmmen offiziell Kombinatiounen. */
  function remusFamilyKey(p) { return (p.i || "").replace(/-\d+$/, ""); }
  function remusConfigVariants(p) {
    if (mfOf(p) !== "REMUS") return [p];
    var key = remusFamilyKey(p);
    return PRODUCTS.filter(function (o) {
      return mfOf(o) === "REMUS" && remusFamilyKey(o) === key;
    }).sort(function (a, b) { return a.p - b.p || (a.i < b.i ? -1 : 1); });
  }
  function remusPartType(sku) {
    if (/^STE\b/i.test(sku)) return "sound";
    if (/^AD/i.test(sku)) return "adapter";
    var bits = sku.trim().split(/\s+/);
    if (bits.length > 1 && /[A-Z]/i.test(bits.slice(1).join(""))) return "tail";
    return "system";
  }
  function remusPartsOf(p, type) {
    return (p.ps || []).filter(function (sku) { return remusPartType(sku) === type; });
  }
  function remusSlotDefs(variants) {
    var types = ["system", "tail", "sound", "adapter"], defs = [];
    types.forEach(function (type) {
      var max = variants.reduce(function (n, variant) {
        return Math.max(n, remusPartsOf(variant, type).length);
      }, 0);
      for (var i = 0; i < max; i++) defs.push({ type: type, index: i });
    });
    return defs;
  }
  function remusSlotValue(p, def) { return remusPartsOf(p, def.type)[def.index] || ""; }
  function collapseCatalog(list) {
    var out = [], remus = {};
    list.forEach(function (p) {
      if (mfOf(p) !== "REMUS") { out.push(p); return; }
      var key = remusFamilyKey(p);
      if (!remus[key] || (!remus[key].p && p.p) || (p.p && p.p < remus[key].p)) remus[key] = p;
    });
    Object.keys(remus).forEach(function (key) { out.push(remus[key]); });
    return out;
  }

  /* ---------- Iwwersetzungen ---------- */
  var T = {
    lb: {
      eyebrow: "Onlineshop", title: "Autodeeler-Shop",
      sub: "REMUS Sportauspuffanlagen a DBA-Bremsen – mat Bild a Präis. Wiel d'Marque oder däi Won, oder sich en Artikel.",
      tab_artikel: "Artikel", tab_fahrzeug: "Won",
      ph_text: "Bezeechnung oder Artikelnummer …", btn_text: "Sichen",
      ph_brand: "Marke wielen oder aginn", ph_model: "Modell wielen oder aginn",
      btn_veh: "Passend Deeler fannen",
      cats: { all: "Alles", system: "Sportauspuffanlagen", sound: "Sound Controller", tail: "Endrohren", adapter: "Adapter", disc: "Bremsscheiwen", pads: "Bremsbelee", caliper: "Bremssättel", bbk: "Big Brake Kits", booster: "Bremskraaftverstärker", park: "Handbrems", drum: "Bremstrommel", shoes: "Bremsschong", other: "Anerer" },
      info_all: "{n} Produiten", info_more: "{n} Produiten (déi éischt {c} gewisen – wiel däi Won oder verfeinert d’Sich)",
      info_search: "{n} Resultater fir „{q}“", info_veh: "{n} Produiten fir {v}",
      info_cat: "{n} · {c}",
      empty: "Keng Produiten fonnt. Rufft eis un – mir fannen dat richtegt Deel.",
      fits: "Passt:", artnr: "Réf.", add: "An de Kuerf", fits_on: "Passt op:", related: "Dobaibestellen", related_sub: "Passend Deeler fir Äert Gefier – fir e komplett System", rel_none: "Keng passend Zousatzdeeler fonnt.", pd_add: "+ derbäi", pd_close: "Zoumaachen", roles: { system: "Komplett-System", catback: "Cat-Back", axleback: "Axle-Back", slipon: "Slip-On", rear: "Endschalldämpfer", mid: "Mëttelrouer", front: "Front-Schalldämpfer", downpipe: "Downpipe", header: "Krümmer", tail: "Endrohren", sound: "Sound Controller", adapter: "Adapter / Verbindung" },
      added: "„{n}“ an de Kuerf geluecht", vat: "All Präisser inkl. 17% TVA.", shipping_extra: "zzgl. Liwwerkäschten",
      stock_in: "Op Lager", stock_order: "Op Ufro",
      ec_ok: "EC-Zoulassung", ec_some: "EC je no Gefier", ec_no: "Rennsport · ouni EC",
      kw: "kW", from: "zanter", mf_all: "All Marquen", axle_f: "Viischt Achs", axle_r: "Hënnescht Achs",
      note_title: "Deel net fonnt?",
      note_text: "Mir fannen dat passend REMUS- oder DBA-Deel fir Äert Gefier – rufft un oder schéckt eng Ufro.",
      note_cta: "Deel ufroen",
      cart_title: "Äre Kuerf", cart_empty: "Äre Kuerf ass eidel.", cart_total: "Total",
      cart_checkout: "Bezuelen", cart_remove: "Ewechhuelen",
      cart_note: "Sécher bezuelen iwwer Mollie – Kaart, Wero, Revolut oder Iwwerweisung. Präisser inkl. 17% TVA. Eventuell Liwwerkäschte ginn Iech virun der verbindlech Bestellung ugewisen.",
      cart_redirect: "Gëtt op d’Bezuelung weidergeleet …",
      cart_err: "D’Bezuelung ass de Moment net erreechbar. Probéiert w.e.g. méi spéit oder rufft eis un.",
    },
    de: {
      eyebrow: "Onlineshop", title: "Autoteile-Shop",
      sub: "REMUS Sportauspuffanlagen und DBA-Bremsen – mit Bild und Preis. Marke oder Fahrzeug wählen oder Artikel suchen.",
      tab_artikel: "Artikel", tab_fahrzeug: "Fahrzeug",
      ph_text: "Bezeichnung oder Artikelnummer …", btn_text: "Suchen",
      ph_brand: "Marke wählen oder eingeben", ph_model: "Modell wählen oder eingeben",
      btn_veh: "Passende Teile finden",
      cats: { all: "Alle", system: "Sportauspuffanlagen", sound: "Sound Controller", tail: "Endrohre", adapter: "Adapter", disc: "Bremsscheiben", pads: "Bremsbeläge", caliper: "Bremssättel", bbk: "Big Brake Kits", booster: "Bremskraftverstärker", park: "Handbremse", drum: "Bremstrommeln", shoes: "Bremsbacken", other: "Sonstige" },
      info_all: "{n} Produkte", info_more: "{n} Produkte (erste {c} angezeigt – Fahrzeug wählen oder Suche verfeinern)",
      info_search: "{n} Ergebnisse für „{q}“", info_veh: "{n} Produkte für {v}",
      info_cat: "{n} · {c}",
      empty: "Keine Produkte gefunden. Rufen Sie uns an – wir finden das richtige Teil.",
      fits: "Passt:", artnr: "Ref.", add: "In den Warenkorb", fits_on: "Passt auf:", related: "Dazu bestellen", related_sub: "Passende Teile für Ihr Fahrzeug – für eine komplette Anlage", rel_none: "Kein passendes Zubehör gefunden.", pd_add: "+ dazu", pd_close: "Schließen", roles: { system: "Komplettanlage", catback: "Cat-Back", axleback: "Axle-Back", slipon: "Slip-On", rear: "Endschalldämpfer", mid: "Mittelrohr", front: "Vorschalldämpfer", downpipe: "Downpipe", header: "Krümmer", tail: "Endrohre", sound: "Sound Controller", adapter: "Adapter / Verbindung" },
      added: "„{n}“ in den Warenkorb gelegt", vat: "Alle Preise inkl. 17% MwSt.", shipping_extra: "zzgl. Lieferkosten",
      stock_in: "Auf Lager", stock_order: "Auf Anfrage",
      ec_ok: "EG-Zulassung", ec_some: "EG je nach Fahrzeug", ec_no: "Rennsport · ohne EG",
      kw: "kW", from: "ab", mf_all: "Alle Marken", axle_f: "Vorderachse", axle_r: "Hinterachse",
      note_title: "Teil nicht gefunden?",
      note_text: "Wir finden das passende REMUS- oder DBA-Teil für Ihr Fahrzeug – rufen Sie an oder senden Sie eine Anfrage.",
      note_cta: "Teil anfragen",
      cart_title: "Ihr Warenkorb", cart_empty: "Ihr Warenkorb ist leer.", cart_total: "Gesamt",
      cart_checkout: "Bezahlen", cart_remove: "Entfernen",
      cart_note: "Sicher bezahlen über Mollie – Karte, Wero, Revolut oder Überweisung. Preise inkl. 17% MwSt. Eventuelle Lieferkosten werden vor der verbindlichen Bestellung angezeigt.",
      cart_redirect: "Weiterleitung zur Bezahlung …",
      cart_err: "Die Bezahlung ist derzeit nicht erreichbar. Bitte später erneut versuchen oder anrufen.",
    },
    fr: {
      eyebrow: "Boutique", title: "Boutique de pièces",
      sub: "Échappements sport REMUS et freins DBA – avec photo et prix. Choisissez la marque ou votre véhicule, ou cherchez un article.",
      tab_artikel: "Article", tab_fahrzeug: "Véhicule",
      ph_text: "Désignation ou numéro d’article …", btn_text: "Rechercher",
      ph_brand: "Choisir ou saisir la marque", ph_model: "Choisir ou saisir le modèle",
      btn_veh: "Trouver les pièces",
      cats: { all: "Tout", system: "Lignes d’échappement", sound: "Sound Controller", tail: "Sorties", adapter: "Adaptateurs", disc: "Disques de frein", pads: "Plaquettes", caliper: "Étriers", bbk: "Big Brake Kits", booster: "Servofrein", park: "Frein à main", drum: "Tambours", shoes: "Mâchoires", other: "Autres" },
      info_all: "{n} produits", info_more: "{n} produits ({c} premiers affichés – choisissez votre véhicule ou affinez)",
      info_search: "{n} résultats pour « {q} »", info_veh: "{n} produits pour {v}",
      info_cat: "{n} · {c}",
      empty: "Aucun produit trouvé. Appelez-nous – nous trouvons la bonne pièce.",
      fits: "Compatible :", artnr: "Réf.", add: "Au panier", fits_on: "Compatible avec :", related: "À commander avec", related_sub: "Pièces compatibles pour votre véhicule – pour une ligne complète", rel_none: "Aucun accessoire compatible trouvé.", pd_add: "+ ajouter", pd_close: "Fermer", roles: { system: "Ligne complète", catback: "Cat-Back", axleback: "Axle-Back", slipon: "Slip-On", rear: "Silencieux arrière", mid: "Tube intermédiaire", front: "Silencieux avant", downpipe: "Downpipe", header: "Collecteur", tail: "Sorties", sound: "Sound Controller", adapter: "Adaptateur / raccord" },
      added: "« {n} » ajouté au panier", vat: "Tous les prix TTC (TVA 17% incluse).", shipping_extra: "hors frais de livraison",
      stock_in: "En stock", stock_order: "Sur demande",
      ec_ok: "Homologation CE", ec_some: "CE selon véhicule", ec_no: "Compétition · sans CE",
      kw: "kW", from: "dès", mf_all: "Toutes marques", axle_f: "Essieu avant", axle_r: "Essieu arrière",
      note_title: "Pièce introuvable ?",
      note_text: "Nous trouvons la pièce REMUS ou DBA adaptée à votre véhicule – appelez-nous ou envoyez une demande.",
      note_cta: "Demander une pièce",
      cart_title: "Votre panier", cart_empty: "Votre panier est vide.", cart_total: "Total",
      cart_checkout: "Payer", cart_remove: "Retirer",
      cart_note: "Paiement sécurisé via Mollie – carte, Wero, Revolut ou virement. Prix TTC. Les éventuels frais de livraison sont affichés avant la commande ferme.",
      cart_redirect: "Redirection vers le paiement …",
      cart_err: "Le paiement est momentanément indisponible. Réessayez plus tard ou appelez-nous.",
    },
    en: {
      eyebrow: "Online shop", title: "Car parts shop",
      sub: "REMUS sport exhausts and DBA brakes – with photo and price. Pick the brand or your vehicle, or search an article.",
      tab_artikel: "Article", tab_fahrzeug: "Vehicle",
      ph_text: "Name or part number …", btn_text: "Search",
      ph_brand: "Choose or type make", ph_model: "Choose or type model",
      btn_veh: "Find matching parts",
      cats: { all: "All", system: "Exhaust systems", sound: "Sound Controller", tail: "Tail pipes", adapter: "Adapters", disc: "Brake discs", pads: "Brake pads", caliper: "Calipers", bbk: "Big Brake Kits", booster: "Brake booster", park: "Park brake", drum: "Brake drums", shoes: "Brake shoes", other: "Other" },
      info_all: "{n} products", info_more: "{n} products (first {c} shown – pick your vehicle or refine)",
      info_search: "{n} results for “{q}”", info_veh: "{n} products for {v}",
      info_cat: "{n} · {c}",
      empty: "No products found. Call us – we’ll find the right part.",
      fits: "Fits:", artnr: "Ref.", add: "Add to cart", fits_on: "Fits:", related: "Order together", related_sub: "Matching parts for your vehicle – to complete the system", rel_none: "No matching accessories found.", pd_add: "+ add", pd_close: "Close", roles: { system: "Full system", catback: "Cat-Back", axleback: "Axle-Back", slipon: "Slip-On", rear: "Rear silencer", mid: "Mid pipe", front: "Front silencer", downpipe: "Downpipe", header: "Header", tail: "Tail pipes", sound: "Sound Controller", adapter: "Adapter / link" },
      added: "“{n}” added to cart", vat: "All prices incl. 17% VAT.", shipping_extra: "plus delivery costs",
      stock_in: "In stock", stock_order: "On request",
      ec_ok: "EC approval", ec_some: "EC depends on vehicle", ec_no: "Race · no EC",
      kw: "kW", from: "from", mf_all: "All brands", axle_f: "Front axle", axle_r: "Rear axle",
      note_title: "Part not found?",
      note_text: "We’ll find the right REMUS or DBA part for your vehicle – call us or send a request.",
      note_cta: "Request a part",
      cart_title: "Your cart", cart_empty: "Your cart is empty.", cart_total: "Total",
      cart_checkout: "Pay", cart_remove: "Remove",
      cart_note: "Secure payment via Mollie – card, Wero, Revolut or bank transfer. Prices incl. 17% VAT. Any delivery costs are shown before the binding order.",
      cart_redirect: "Redirecting to payment …",
      cart_err: "Payment is currently unavailable. Please try again later or call us.",
    },
  };

  /* ---------- "In Arbeit"-Säit ---------- */
  var SOON = {
    lb: { eyebrow: "Onlineshop", title: "Eise Shop ass an der Aarbecht",
      text: "Mir bauen eisen Autodeeler-Shop mat REMUS-Sportauspuffanlagen an DBA-Bremsen op. Kuckt geschwënn erëm laanscht – oder kontaktéiert eis direkt.",
      cta: "Deel ufroen", back: "Zréck op d’Startsäit",
      dev: "Virschau-Modus – Shop ëffentlech nach „an der Aarbecht“", hide: "verstoppen" },
    de: { eyebrow: "Onlineshop", title: "Unser Shop ist in Arbeit",
      text: "Wir bauen unseren Autoteile-Shop mit REMUS-Sportauspuffanlagen und DBA-Bremsen auf. Schauen Sie bald wieder vorbei – oder kontaktieren Sie uns direkt.",
      cta: "Teil anfragen", back: "Zurück zur Startseite",
      dev: "Vorschau-Modus – Shop öffentlich noch „in Arbeit“", hide: "ausblenden" },
    fr: { eyebrow: "Boutique", title: "Notre boutique est en préparation",
      text: "Nous préparons notre boutique de pièces avec des échappements REMUS et des freins DBA. Revenez bientôt – ou contactez-nous directement.",
      cta: "Demander une pièce", back: "Retour à l’accueil",
      dev: "Mode aperçu – boutique encore « en construction »", hide: "masquer" },
    en: { eyebrow: "Online shop", title: "Our shop is in the works",
      text: "We’re building our car-parts shop with REMUS exhausts and DBA brakes. Check back soon – or contact us directly.",
      cta: "Request a part", back: "Back to home",
      dev: "Preview mode – shop still “under construction”", hide: "hide" },
  };

  /* Shop-spezifesch, konsequent formell Texter a Filter-/Rechtsinformatiounen */
  Object.assign(T.lb, {
    sub: "REMUS-Sportauspuffanlagen mat Bild, Präis a Lagerstatus. Wielt Äert Gefier oder sicht no engem Artikel – DBA-Bremsen kommen nach.",
    tab_fahrzeug: "Gefier",
    ph_text: "Bezeechnung oder Artikelnummer …",
    ph_brand: "Mark wielen oder aginn",
    ph_model: "Modell wielen oder aginn",
    ph_generation: "Baurei wielen",
    ph_year: "Baujoer wielen",
    ph_engine: "Motoriséierung wielen",
    btn_veh: "Passend Deeler fannen",
    veh_note: "Wielt all Felder aus, fir nëmme passend Deeler fir Äert Gefier ze gesinn.",
    info_all: "{n} Produkter",
    info_more: "{n} Produkter (déi éischt {c} ginn ugewisen – wielt Äert Gefier oder verfeinert Är Sich)",
    info_search: "{n} Resultater fir „{q}“",
    info_veh: "{n} Produkter fir {v}",
    empty: "Keng Produkter fonnt. Rufft eis un – mir fannen dat richtegt Deel.",
    fits: "Gëeegent fir:",
    artnr: "Artikelnr.",
    add: "An den Akafskuerf",
    related: "Dobäibestellen",
    related_sub: "Passend Deeler fir Äert Gefier – fir eng komplett Anlag",
    rel_none: "Keng passend Zousatzdeeler fonnt.",
    added: "„{n}“ gouf an den Akafskuerf geluecht",
    cats: { all: "Alles", system: "Sportauspuffanlagen", sound: "Sound Controller", tail: "Endréier", adapter: "Adapter" },
    cart_title: "Ären Akafskuerf",
    cart_empty: "Ären Akafskuerf ass eidel.",
    cart_checkout: "Bezuelungspflichteg bestellen",
    cart_remove: "Ewechhuelen",
    cart_note: "Sécher iwwer Mollie bezuelen. All Präisser enthalen 17% TVA. Eventuell Liwwerkäschte ginn Iech virun der verbindlech Bestellung ugewisen.",
    cart_redirect: "Dir gitt op d’Bezuelung weidergeleet …",
    cart_err: "D’Bezuelung ass de Moment net erreechbar. Probéiert w.e.g. méi spéit nach eng Kéier oder rufft eis un.",
    legal_required: "Bestätegt w.e.g. d’Shop- a Verbraucherinformatiounen, ier Dir bestellt.",
    legal_text: "Ech hunn d’Shop- a Verbraucherinformatioune gelies an akzeptéieren, datt d’Bestellung bezuelungspflichteg ass.",
    legal_link: "Shop- a Verbraucherinformatiounen",
    privacy_link: "Dateschutz",
    legal_eyebrow: "Transparent bestellen",
    legal_title: "Wichteg Informatioune virun der Bestellung",
    legal_price_title: "Präisser",
    legal_price_text: "All ugewise Präisser enthalen 17% TVA. Méiglech Liwwer- oder Ofhuelkäschte ginn Iech virun der verbindlech Bestellung ugewisen.",
    legal_fit_title: "Passgenauegkeet",
    legal_fit_text: "De Gefierfilter ass eng Sichhëllef. Mir kontrolléieren d’Kompatibilitéit virum Versand nach eng Kéier mat de Gefierdaten.",
    legal_rights_title: "Är Rechter",
    legal_rights_text: "Beim Onlinekaf gëllt am Reegelfall e Récktrëttsrecht vu 14 Deeg nom Empfang an déi gesetzlech Gewährleeschtung.",
    legal_more: "Vollstänneg Shop- a Verbraucherinformatioune liesen →"
  });
  Object.assign(T.de, {
    ph_generation: "Baureihe wählen", ph_year: "Baujahr wählen", ph_engine: "Motorisierung wählen",
    veh_note: "Wählen Sie alle Felder aus, damit nur passende Teile für Ihr Fahrzeug angezeigt werden.",
    cart_checkout: "Zahlungspflichtig bestellen",
    legal_required: "Bitte bestätigen Sie die Shop- und Verbraucherinformationen, bevor Sie bestellen.",
    legal_text: "Ich habe die Shop- und Verbraucherinformationen gelesen und bestätige die zahlungspflichtige Bestellung.",
    legal_link: "Shop- und Verbraucherinformationen", privacy_link: "Datenschutz",
    legal_eyebrow: "Transparent bestellen", legal_title: "Wichtige Informationen vor der Bestellung",
    legal_price_title: "Preise", legal_price_text: "Alle angezeigten Preise enthalten 17% luxemburgische Mehrwertsteuer. Eventuelle Liefer- oder Abholkosten werden vor der verbindlichen Bestellung angezeigt.",
    legal_fit_title: "Passgenauigkeit", legal_fit_text: "Der Fahrzeugfilter ist eine Suchhilfe. Wir prüfen die Kompatibilität vor dem Versand nochmals anhand der Fahrzeugdaten.",
    legal_rights_title: "Ihre Rechte", legal_rights_text: "Beim Onlinekauf gilt grundsätzlich ein 14-tägiges Widerrufsrecht ab Erhalt sowie die gesetzliche Gewährleistung.",
    legal_more: "Vollständige Shop- und Verbraucherinformationen lesen →"
  });
  Object.assign(T.fr, {
    ph_generation: "Choisir la génération", ph_year: "Choisir l’année", ph_engine: "Choisir la motorisation",
    veh_note: "Sélectionnez tous les champs afin de n’afficher que les pièces adaptées à votre véhicule.",
    cart_checkout: "Commander avec obligation de paiement",
    legal_required: "Veuillez confirmer les informations de vente et de consommation avant de commander.",
    legal_text: "J’ai lu les informations de vente et de consommation et je confirme la commande avec obligation de paiement.",
    legal_link: "Informations de vente et de consommation", privacy_link: "Protection des données",
    legal_eyebrow: "Commander en toute transparence", legal_title: "Informations importantes avant la commande",
    legal_price_title: "Prix", legal_price_text: "Tous les prix affichés comprennent 17% de TVA luxembourgeoise. Les éventuels frais de livraison ou de retrait sont affichés avant la commande ferme.",
    legal_fit_title: "Compatibilité", legal_fit_text: "Le filtre véhicule est une aide à la recherche. Nous vérifions à nouveau la compatibilité à partir des données du véhicule avant l’expédition.",
    legal_rights_title: "Vos droits", legal_rights_text: "En règle générale, l’achat en ligne bénéficie d’un droit de rétractation de 14 jours après réception et de la garantie légale.",
    legal_more: "Lire toutes les informations de vente et de consommation →"
  });
  Object.assign(T.en, {
    ph_generation: "Choose generation", ph_year: "Choose model year", ph_engine: "Choose engine",
    veh_note: "Select every field to show only parts suitable for your vehicle.",
    cart_checkout: "Place order with obligation to pay",
    legal_required: "Please confirm the shop and consumer information before ordering.",
    legal_text: "I have read the shop and consumer information and confirm that the order carries an obligation to pay.",
    legal_link: "Shop and consumer information", privacy_link: "Privacy",
    legal_eyebrow: "Order transparently", legal_title: "Important information before ordering",
    legal_price_title: "Prices", legal_price_text: "All displayed prices include 17% Luxembourg VAT. Any delivery or collection charges are shown before the binding order.",
    legal_fit_title: "Compatibility", legal_fit_text: "The vehicle filter is a search aid. We verify compatibility again against the vehicle details before dispatch.",
    legal_rights_title: "Your rights", legal_rights_text: "Online purchases generally include a 14-day right of withdrawal after receipt and the statutory legal guarantee.",
    legal_more: "Read the full shop and consumer information →"
  });

  Object.assign(T.lb, {
    configure: "Upassen",
    config_title: "Är REMUS-Konfiguratioun",
    config_system: "Grondanlag / Systemëmfang",
    config_variant: "Ausféierung / Endréier wielen *",
    config_required: "Pflichtëmfang am komplette REMUS-Bundle abegraff",
    config_parts: "Enthale Pflichtdeeler",
    config_parts_note: "Dës Deeler gehéieren no der REMUS-Stécklëscht zu dëser Konfiguratioun a sinn am Bundle-Präis abegraff.",
    config_valid: "Gülteg REMUS-Konfiguratioun wielen *",
    config_main_parts: "Anlag / Verbindungsdeeler",
    config_tail_parts: "Endréier",
    config_sound_parts: "Sound Controller",
    config_adapter_parts: "Adapter",
    config_without_sound: "ouni Sound Controller",
    config_none: "Ouni Auswiel",
    config_component_choice: "Anlagekomponent {n}",
    config_single: "Dës Variant huet keng weider auswielbar Bundle-Ausféierung.",
    config_component: "Eenzelkomponent: déi néideg Haaptanlag gëtt separat gebraucht.",
    config_check: "Mir kontrolléieren d’Stécklëscht an d’Passform nach eng Kéier mat Äre komplette Gefierdaten virun der Bestellung.",
    config_total: "Bundle-Präis",
    related: "Passend Ergänzungen",
    related_sub: "Kompatibel Ergänzungen – net automatesch Pflichtdeeler.",
    compat_review: "Kompatibel – Pflichtdeelstatus gëtt kontrolléiert"
  });
  Object.assign(T.de, {
    configure: "Konfigurieren",
    config_title: "Ihre REMUS-Konfiguration",
    config_system: "Grundsystem / Lieferumfang",
    config_variant: "Ausführung / Endrohr wählen *",
    config_required: "Pflichtumfang im vollständigen REMUS-Bundle enthalten",
    config_parts: "Enthaltene Pflichtteile",
    config_parts_note: "Diese Teile gehören laut REMUS-Stückliste zu dieser Konfiguration und sind im Bundle-Preis enthalten.",
    config_valid: "Gültige REMUS-Konfiguration wählen *",
    config_main_parts: "Anlage / Verbindungsrohre",
    config_tail_parts: "Endrohre",
    config_sound_parts: "Sound Controller",
    config_adapter_parts: "Adapter",
    config_without_sound: "ohne Sound Controller",
    config_none: "Ohne Auswahl",
    config_component_choice: "Anlagenkomponente {n}",
    config_single: "Für diese Variante ist keine weitere Bundle-Ausführung hinterlegt.",
    config_component: "Einzelkomponente: Die erforderliche Hauptanlage wird separat benötigt.",
    config_check: "Wir prüfen Stückliste und Passform vor der Bestellung noch einmal anhand Ihrer vollständigen Fahrzeugdaten.",
    config_total: "Bundle-Preis",
    related: "Passende Ergänzungen",
    related_sub: "Kompatible Ergänzungen – nicht automatisch Pflichtteile.",
    compat_review: "Kompatibel – Pflichtteilstatus wird geprüft"
  });
  Object.assign(T.fr, {
    configure: "Configurer",
    config_title: "Votre configuration REMUS",
    config_system: "Système de base / contenu",
    config_variant: "Choisir la finition / les sorties *",
    config_required: "Éléments obligatoires inclus dans le bundle REMUS complet",
    config_parts: "Pièces obligatoires incluses",
    config_parts_note: "Selon la nomenclature REMUS, ces pièces font partie de cette configuration et sont incluses dans le prix du bundle.",
    config_valid: "Choisir une configuration REMUS valide *",
    config_main_parts: "Système / tubes de raccordement",
    config_tail_parts: "Sorties d’échappement",
    config_sound_parts: "Sound Controller",
    config_adapter_parts: "Adaptateurs",
    config_without_sound: "sans Sound Controller",
    config_none: "Sans sélection",
    config_component_choice: "Composant du système {n}",
    config_single: "Aucune autre variante de bundle n’est enregistrée pour cet article.",
    config_component: "Composant individuel: le système principal requis doit être choisi séparément.",
    config_check: "Avant la commande, nous vérifions à nouveau la nomenclature et la compatibilité à partir des données complètes du véhicule.",
    config_total: "Prix du bundle",
    related: "Compléments compatibles",
    related_sub: "Compléments compatibles – pas automatiquement obligatoires.",
    compat_review: "Compatible – statut obligatoire à vérifier"
  });
  Object.assign(T.en, {
    configure: "Configure",
    config_title: "Your REMUS configuration",
    config_system: "Base system / bundle contents",
    config_variant: "Choose finish / tail pipes *",
    config_required: "Required scope included in the complete REMUS bundle",
    config_parts: "Included required parts",
    config_parts_note: "According to the REMUS bill of materials, these parts belong to this configuration and are included in the bundle price.",
    config_valid: "Choose a valid REMUS configuration *",
    config_main_parts: "System / connection pipes",
    config_tail_parts: "Tail pipes",
    config_sound_parts: "Sound Controller",
    config_adapter_parts: "Adapters",
    config_without_sound: "without Sound Controller",
    config_none: "No selection",
    config_component_choice: "System component {n}",
    config_single: "No additional bundle variant is recorded for this item.",
    config_component: "Individual component: the required main system must be selected separately.",
    config_check: "Before ordering, we verify the bill of materials and fitment again using the complete vehicle details.",
    config_total: "Bundle price",
    related: "Compatible additions",
    related_sub: "Compatible additions – not automatically mandatory.",
    compat_review: "Compatible – mandatory-part status will be checked"
  });

  Object.assign(T.lb, {
    config_bundle_ref: "Komplett REMUS-Bundle: {sku}",
    related_alt_sub: "Alternativ komplett Anlagen fir déi selwecht exakt Gefier-Zouuerdnung.",
    rel_none_detail: "Fir dëst Bundle si keng separat Zousatzdeeler am importéierte Katalog hannerluecht. De Pflichtëmfang ass am Komplett-Bundle abegraff."
  });
  Object.assign(T.de, {
    config_bundle_ref: "Vollständiges REMUS-Bundle: {sku}",
    related_alt_sub: "Alternative Komplettanlagen für dieselbe exakte Fahrzeugzuordnung.",
    rel_none_detail: "Für dieses Bundle sind im importierten Katalog keine separaten Zusatzteile hinterlegt. Der Pflichtumfang ist im Komplett-Bundle enthalten."
  });
  Object.assign(T.fr, {
    config_bundle_ref: "Bundle REMUS complet : {sku}",
    related_alt_sub: "Systèmes complets alternatifs pour exactement la même affectation véhicule.",
    rel_none_detail: "Aucune pièce complémentaire séparée n’est enregistrée dans le catalogue importé pour ce bundle. Les éléments obligatoires sont compris dans le bundle complet."
  });
  Object.assign(T.en, {
    config_bundle_ref: "Complete REMUS bundle: {sku}",
    related_alt_sub: "Alternative complete systems for the exact same vehicle fitment.",
    rel_none_detail: "No separate add-on parts are recorded for this bundle in the imported catalogue. The required scope is included in the complete bundle."
  });

  /* Multi-Marque (REMUS + DBA): komplett Kategorien + Marque-/Axe-Labelen.
     Hei LESCHT gesat, soudatt d'DBA-Kategorien net vun uewe verluer ginn. */
  Object.assign(T.lb, { mf_all: "All Marquen", axle_f: "Viischt Achs", axle_r: "Hënnescht Achs",
    sub: "REMUS-Sportauspuffanlagen an DBA-Bremsen – mat Bild a Präis. Wielt d’Marque oder Äert Gefier, oder sicht no engem Artikel.",
    preview_title: "Intern Virschau", preview_text: "Dëse Beräich ass nëmme mam Virschau-Link sichtbar.",
    label_brand: "Mark", label_model: "Modell", label_generation: "Baurei", label_year: "Baujoer", label_engine: "Motoriséierung", search_label: "Artikel sichen", mf_label: "Marque", cat_label: "Kategorien", close_label: "Zoumaachen",
    compat_review: "Passform iwwerpréiwen", compat_review_title: "D’DBA-Zouuerdnung baséiert deelweis nëmmen op Modell a Baujoer. Mir kontrolléieren d’Passform virum Versand mat de komplette Gefierdaten.",
    no_road_title: "Net fir den ëffentleche Stroosseverkéier zougelooss. Nëmme fir Motorsport oder zougeloossen Asaz benotzen.",
    info_veh: "{n} méiglecherweis passend Produkter fir {v}",
    cats: { all: "Alles", system: "Sportauspuffanlagen", sound: "Mat Sound Controller", tail: "Endréier", adapter: "Mat Adapter", disc: "Bremsscheiwen", pads: "Bremsbelee", caliper: "Bremssättel", bbk: "Big Brake Kits", booster: "Bremskraaftverstärker", park: "Handbrems", drum: "Bremstrommel", shoes: "Bremsschong", other: "Anerer" } });
  Object.assign(T.de, { mf_all: "Alle Marken", axle_f: "Vorderachse", axle_r: "Hinterachse",
    sub: "REMUS-Sportauspuffanlagen und DBA-Bremsen – mit Bild und Preis. Marke oder Fahrzeug wählen oder Artikel suchen.",
    preview_title: "Interne Vorschau", preview_text: "Dieser Bereich ist nur über den Vorschau-Link sichtbar.",
    label_brand: "Marke", label_model: "Modell", label_generation: "Baureihe", label_year: "Baujahr", label_engine: "Motorisierung", search_label: "Artikel suchen", mf_label: "Hersteller", cat_label: "Kategorien", close_label: "Schließen",
    compat_review: "Passform prüfen", compat_review_title: "Die DBA-Zuordnung basiert teilweise nur auf Modell und Baujahr. Wir prüfen die Passform vor dem Versand anhand der vollständigen Fahrzeugdaten.",
    no_road_title: "Nicht für den öffentlichen Straßenverkehr zugelassen. Nur im Motorsport oder in einem zulässigen Einsatzbereich verwenden.",
    info_veh: "{n} möglicherweise passende Produkte für {v}",
    cats: { all: "Alle", system: "Sportauspuffanlagen", sound: "Mit Sound Controller", tail: "Endrohre", adapter: "Mit Adapter", disc: "Bremsscheiben", pads: "Bremsbeläge", caliper: "Bremssättel", bbk: "Big Brake Kits", booster: "Bremskraftverstärker", park: "Handbremse", drum: "Bremstrommeln", shoes: "Bremsbacken", other: "Sonstige" } });
  Object.assign(T.fr, { mf_all: "Toutes marques", axle_f: "Essieu avant", axle_r: "Essieu arrière",
    sub: "Échappements sport REMUS et freins DBA – avec photo et prix. Choisissez la marque ou votre véhicule, ou cherchez un article.",
    preview_title: "Aperçu interne", preview_text: "Cette zone est uniquement visible via le lien d’aperçu.",
    label_brand: "Marque", label_model: "Modèle", label_generation: "Génération", label_year: "Année", label_engine: "Motorisation", search_label: "Rechercher un article", mf_label: "Fabricants", cat_label: "Catégories", close_label: "Fermer",
    compat_review: "Vérifier l’affectation", compat_review_title: "L’affectation DBA repose parfois uniquement sur le modèle et l’année. Nous vérifions la compatibilité avant l’expédition avec les données complètes du véhicule.",
    no_road_title: "Non homologué pour la voie publique. À utiliser uniquement en compétition ou dans un cadre autorisé.",
    info_veh: "{n} produits potentiellement compatibles pour {v}",
    cats: { all: "Tout", system: "Lignes d’échappement", sound: "Avec Sound Controller", tail: "Sorties", adapter: "Avec adaptateur", disc: "Disques de frein", pads: "Plaquettes", caliper: "Étriers", bbk: "Big Brake Kits", booster: "Servofrein", park: "Frein à main", drum: "Tambours", shoes: "Mâchoires", other: "Autres" } });
  Object.assign(T.en, { mf_all: "All brands", axle_f: "Front axle", axle_r: "Rear axle",
    sub: "REMUS sport exhausts and DBA brakes – with photo and price. Pick the brand or your vehicle, or search an article.",
    preview_title: "Internal preview", preview_text: "This area is only visible through the preview link.",
    label_brand: "Make", label_model: "Model", label_generation: "Generation", label_year: "Model year", label_engine: "Engine", search_label: "Search products", mf_label: "Manufacturers", cat_label: "Categories", close_label: "Close",
    compat_review: "Verify fitment", compat_review_title: "Some DBA fitments are based only on model and year. We verify compatibility against the complete vehicle data before dispatch.",
    no_road_title: "Not approved for public-road use. Use only in motorsport or another permitted setting.",
    info_veh: "{n} potentially compatible products for {v}",
    cats: { all: "All", system: "Exhaust systems", sound: "With Sound Controller", tail: "Tail pipes", adapter: "With adapter", disc: "Brake discs", pads: "Brake pads", caliper: "Calipers", bbk: "Big Brake Kits", booster: "Brake booster", park: "Park brake", drum: "Brake drums", shoes: "Brake shoes", other: "Other" } });

  Object.assign(T.lb, { filter_axle:"Achs", filter_axle_all:"All Achsen", filter_approval:"Zoulassung", filter_approval_all:"All Zoulassungen", filter_road:"Stroossenzoulassung", filter_race:"Ouni Stroossenzoulassung", filter_sort:"Sortéieren", sort_name:"Numm A–Z", sort_price_asc:"Präis opsteigend", sort_price_desc:"Präis ofsteigend", filter_reset:"Filter zerécksetzen", favorites:"Merklëscht", load_more:"Méi weisen ({n} nach)", inquiry:"Passform iwwerpréiwe loossen", favorite_add:"Op d’Merklëscht", favorite_remove:"Vun der Merklëscht ewechhuelen", guide_eyebrow:"Orientéierung", guide_title:"Wéi eng Produktlinn passt bei mech?", guide_dba_street:"Fir den Alldag a sportlech Notzung op der Strooss.", guide_dba_race:"Fir héich thermesch Belaaschtung, Trackdays a Motorsport – Zoulassung individuell iwwerpréiwen.", guide_remus:"Vum zougeloossene Stroossesystem bis zur Motorsport-Komponent. D’Kennzeechnung beim Produkt ass entscheedend.", trust_title:"Onsécher bei der Passform?", trust_text:"Mir iwwerpréiwen d’Artikelnummer, d’Gefierdaten an déi néideg Zousatzdeeler perséinlech virun der Bestellung.", trust_cta:"Berodung ufroen" });
  Object.assign(T.de, { filter_axle:"Achse", filter_axle_all:"Alle Achsen", filter_approval:"Zulassung", filter_approval_all:"Alle Zulassungen", filter_road:"Straßenzulassung", filter_race:"Ohne Straßenzulassung", filter_sort:"Sortierung", sort_name:"Name A–Z", sort_price_asc:"Preis aufsteigend", sort_price_desc:"Preis absteigend", filter_reset:"Filter zurücksetzen", favorites:"Merkliste", load_more:"Mehr anzeigen ({n} weitere)", inquiry:"Passform prüfen lassen", favorite_add:"Auf die Merkliste", favorite_remove:"Von der Merkliste entfernen", compare:"Vergleichen", compare_add:"Zum Vergleich", compare_count:"{n} Produkte ausgewählt", compare_clear:"Leeren", guide_eyebrow:"Orientierung", guide_title:"Welche Produktlinie passt zu mir?", guide_dba_street:"Für Alltag und sportliche Straßennutzung.", guide_dba_race:"Für hohe thermische Belastung, Trackdays und Motorsport – Zulassung individuell prüfen.", guide_remus:"Vom zugelassenen Straßensystem bis zur Motorsport-Komponente. Die Kennzeichnung am Produkt ist entscheidend.", trust_title:"Unsicher bei der Passform?", trust_text:"Wir prüfen Artikelnummer, Fahrzeugdaten und benötigte Zusatzteile vor der Bestellung persönlich.", trust_cta:"Beratung anfragen" });
  Object.assign(T.fr, { filter_axle:"Essieu", filter_axle_all:"Tous les essieux", filter_approval:"Homologation", filter_approval_all:"Toutes homologations", filter_road:"Homologué route", filter_race:"Sans homologation route", filter_sort:"Tri", sort_name:"Nom A–Z", sort_price_asc:"Prix croissant", sort_price_desc:"Prix décroissant", filter_reset:"Réinitialiser", favorites:"Favoris", load_more:"Afficher plus ({n} restants)", inquiry:"Faire vérifier l’affectation", favorite_add:"Ajouter aux favoris", favorite_remove:"Retirer des favoris", guide_eyebrow:"Orientation", guide_title:"Quelle gamme me convient?", guide_dba_street:"Pour le quotidien et la conduite sportive sur route.", guide_dba_race:"Pour fortes contraintes thermiques, journées circuit et compétition – homologation à vérifier.", guide_remus:"Du système routier homologué à la pièce compétition. Le marquage du produit fait foi.", trust_title:"Un doute sur la compatibilité?", trust_text:"Nous vérifions personnellement la référence, les données du véhicule et les pièces complémentaires nécessaires.", trust_cta:"Demander conseil" });
  Object.assign(T.en, { filter_axle:"Axle", filter_axle_all:"All axles", filter_approval:"Approval", filter_approval_all:"All approvals", filter_road:"Road approved", filter_race:"No road approval", filter_sort:"Sort", sort_name:"Name A–Z", sort_price_asc:"Price low to high", sort_price_desc:"Price high to low", filter_reset:"Reset filters", favorites:"Favourites", load_more:"Show more ({n} remaining)", inquiry:"Request fitment check", favorite_add:"Add to favourites", favorite_remove:"Remove from favourites", guide_eyebrow:"Guidance", guide_title:"Which product line is right for me?", guide_dba_street:"For everyday and sporty road use.", guide_dba_race:"For high thermal loads, track days and motorsport – check approval individually.", guide_remus:"From road-approved systems to motorsport components. The product marking is decisive.", trust_title:"Unsure about fitment?", trust_text:"We personally verify the part number, vehicle details and required additional parts before ordering.", trust_cta:"Ask for advice" });
  Object.assign(T.lb, { compare:"Vergläichen", compare_add:"Vergläichen", compare_count:"{n} Produkter ausgewielt", compare_clear:"Eidel maachen" });
  Object.assign(T.fr, { compare:"Comparer", compare_add:"Comparer", compare_count:"{n} produits sélectionnés", compare_clear:"Vider" });
  Object.assign(T.en, { compare:"Compare", compare_add:"Compare", compare_count:"{n} products selected", compare_clear:"Clear" });
  T.lb.compare_limit="Dir kënnt maximal 3 Produkter vergläichen."; T.de.compare_limit="Sie können maximal 3 Produkte vergleichen."; T.fr.compare_limit="Vous pouvez comparer au maximum 3 produits."; T.en.compare_limit="You can compare up to 3 products.";

  /* ---------- Helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function setTxt(id, s) { var el = $(id); if (el) el.textContent = s; }
  function lang() {
    var l = document.documentElement.getAttribute("lang");
    if (l && T[l]) return l;
    try { var s = localStorage.getItem("gk_lang"); if (s && T[s]) return s; } catch (e) {}
    return "lb";
  }
  function tr() { return T[lang()] || T.lb; }
  function norm(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
  function searchableText(p) {
    var parts = [p.n, p.i, displayRef(p), mfOf(p), tr().cats[p.c] || p.c];
    p.f.forEach(function (x) {
      parts.push(makeName(x[0]), x[1]);
      if (x[2] > -1) parts.push(GENS[x[2]]);
      if (x[3] > -1) parts.push(VARIANTS[x[3]]);
      if (x[8] > -1) parts.push(ENGINES[x[8]]);
      if (x[4]) parts.push(String(x[4]), String(x[4]) + " kw");
      if (x[5]) parts.push(String(x[5]));
      if (x[6]) parts.push(String(x[6]));
    });
    return norm(parts.join(" "));
  }
  function centsToStr(c) { return (c / 100).toFixed(2).replace(".", ",") + " €"; }
  var VAT_RATE = 0.17; // Lëtzebuerger TVA – direkt am ugewisene Präis abegraff
  function grossCents(net) { return Math.round(net * (1 + VAT_RATE)); }
  function priceStr(net) { return centsToStr(grossCents(net)); }
  function imgUrl(idx, w, h) {
    if (idx == null || idx < 0 || !IMAGES[idx]) return "";
    var v = IMAGES[idx];
    if (v.indexOf("://") !== -1) return v; // extern (DBA / 3cerp) – direkt lueden
    return IMGBASE + v + "?w=" + w + "&h=" + h + "&fit=crop&auto=format";
  }
  function mfOf(p) { return p.mf || "REMUS"; }
  function displayRef(p) { return (p.i || "").replace(/^DBA-/, ""); }
  var DBA_GENERIC_PAD_IMAGE = /(?:Street_Series_Pack\.png|dba-street-performance-pads\.jpg|dba-xtreme-performance-pads\.jpg|DBA_RP_box_2\.png|ss-enshield-kit\.webp)$/i;
  function productImgUrl(p, w, h) {
    var fallback = imgUrl(p.m, w, h);
    if (mfOf(p) === "DBA" && p.c === "pads" && DBA_GENERIC_PAD_IMAGE.test(fallback)) {
      return "https://dba.com.au/wp-content/uploads/dba-uploaded/" + encodeURIComponent(displayRef(p)) + ".jpg";
    }
    return fallback;
  }
  function useFallbackImage(img, p, w, h, onMissing) {
    var fallback = imgUrl(p.m, w, h);
    if (fallback && img.src !== fallback && !img.dataset.fallbackTried) {
      img.dataset.fallbackTried = "1";
      img.src = fallback;
      return;
    }
    onMissing();
  }
  function dbaKitComponents(p) {
    if (mfOf(p) !== "DBA" || p.c !== "bbk") return null;
    var match = displayRef(p).match(/^(DBA[^-]+)-(.+)$/);
    if (!match) return null;
    var discRef = match[1];
    var padRef = /^DB/i.test(match[2]) ? match[2] : "DB" + match[2];
    function byRef(ref) {
      return PRODUCTS.filter(function (item) { return displayRef(item) === ref; })[0] || null;
    }
    return { discRef: discRef, padRef: padRef, disc: byRef(discRef), pad: byRef(padRef) };
  }
  function cleanDbaSpec(spec) {
    return String(spec || "").replace(/;\s*for PR:\s*/i, " · PR ").replace(/-Sättel\b/g, "").replace(/,\s*/g, "/").trim();
  }
  function dbaKitSummary(p) {
    var parts = dbaKitComponents(p);
    if (!parts) return "";
    var labels = {
      de: { discs: "Scheiben", pads: "Beläge" }, lb: { discs: "Scheiwen", pads: "Bremsbeläg" },
      fr: { discs: "Disques", pads: "Plaquettes" }, en: { discs: "Discs", pads: "Pads" }
    }[lang()] || { discs: "Scheiben", pads: "Beläge" };
    return labels.discs + ": 2× " + parts.discRef + (parts.disc && parts.disc.sp ? " · " + cleanDbaSpec(parts.disc.sp) : "") +
      " · " + labels.pads + ": " + parts.padRef + (parts.pad && parts.pad.sp ? " · " + cleanDbaSpec(parts.pad.sp) : "");
  }
  function productName(p) {
    var name = String(p.n || "")
      .replace(/\baproved\b/gi, "approved")
      .replace(/\bSportexhaust\b/gi, "Sport Exhaust")
      .replace(/^(4000 series)\s*-\s*4000 Series\s*-\s*/i, "$1 – ")
      .replace(/\s+/g, " ")
      .trim();
    if (mfOf(p) === "DBA" && p.c === "pads") {
      var padSeries = name.replace(/^Brake Pads\s*/i, "").replace(/\s*\|\s*(Front|Rear) Axle\s*$/i, "");
      var padAxle = p.ax ? axleLabel(p.ax) : "";
      var padPrefix = lang() === "fr" ? "Plaquettes DBA" : lang() === "en" ? "DBA Brake Pads" : lang() === "lb" ? "DBA Bremsbeläg" : "DBA Bremsbeläge";
      return padPrefix + (padSeries ? " – " + padSeries : "") + (padAxle ? " · " + padAxle : "");
    }
    if (mfOf(p) === "REMUS" && lang() === "de") {
      name = name
        .replace(/^Axle-back Sport Exhaust for\s+/i, "REMUS Axle-Back-Sportauspuff für ")
        .replace(/^GPF-Back Exhaust System for\s+/i, "REMUS GPF-Back-Abgasanlage für ")
        .replace(/^Sport Exhaust Bundle for\s+/i, "REMUS Sportauspuff-Komplettset für ")
        .replace(/^Sport Exhaust Set for\s+/i, "REMUS Sportauspuff-Set für ")
        .replace(/^Sport Exhaust for\s+/i, "REMUS Sportauspuff für ")
        .replace(/^Exhaust System for\s+/i, "REMUS Abgasanlage für ");
    }
    if (mfOf(p) !== "DBA" || p.c !== "bbk" || !/^Brake Kit/i.test(name)) return name;
    var series = (p.n.match(/(5000 Series[^&(]*|4000 Series[^&(]*|Street Series[^&(]*)/i) || [])[1] || "Performance";
    series = series.replace(/\s+/g, " ").trim();
    var axle = p.ax === "F" ? axleLabel("F") : p.ax === "R" ? axleLabel("R") : "";
    var parts = dbaKitComponents(p);
    var discSpec = parts && parts.disc ? cleanDbaSpec(parts.disc.sp) : "";
    return "DBA Bremsen-Kit" + (axle ? " " + axle : "") + " – " + series + (discSpec ? " · " + discSpec : "");
  }
  function makeName(i) { return MAKES[i] || ""; }
  function makesOf(p) {
    var seen = {}, out = [];
    p.f.forEach(function (x) { if (!seen[x[0]]) { seen[x[0]] = 1; out.push(makeName(x[0])); } });
    return out;
  }
  function modelsOf(p) {
    var seen = {}, out = [];
    p.f.forEach(function (x) { if (!seen[x[1]]) { seen[x[1]] = 1; out.push(x[1]); } });
    return out;
  }
  /* Fitment: [makeIdx, model, genIdx, varIdx, kW, yMin, yMax, ec, engIdx] */
  function fitLabel(x) {
    var parts = [x[1]];
    if (x[2] > -1 && GENS[x[2]]) parts.push(GENS[x[2]]);
    if (x[3] > -1 && VARIANTS[x[3]]) parts.push(VARIANTS[x[3]]);
    var tail = [];
    if (x[8] > -1 && ENGINES[x[8]]) tail.push(ENGINES[x[8]]);
    if (x[4]) tail.push(x[4] + " " + tr().kw);
    var yr = "";
    if (x[5]) yr = x[5] + "–" + (x[6] ? x[6] : "");
    else if (x[6]) yr = "–" + x[6];
    if (yr) tail.push(yr);
    var s = parts.join(" ");
    if (tail.length) s += " · " + tail.join(" · ");
    return s;
  }
  function generationLabel(x) {
    return x[2] > -1 && GENS[x[2]] ? GENS[x[2]] : "—";
  }
  function engineLabel(x) {
    var parts = [];
    if (x[8] > -1 && ENGINES[x[8]]) parts.push(ENGINES[x[8]]);
    if (x[3] > -1 && VARIANTS[x[3]]) parts.push(VARIANTS[x[3]]);
    if (x[4]) parts.push(x[4] + " kW");
    return parts.length ? parts.join(" · ") : "—";
  }
  function yearFits(x, year) {
    if (!year) return true;
    var y = parseInt(year, 10);
    if (!y) return false;
    return (!x[5] || y >= x[5]) && (!x[6] || y <= x[6]);
  }
  /* Modell-Vergläich tolerant: REMUS benotzt Basis-Nimm ("A3", "3 Series"),
     DBA dacks mat Chassis-Code ("A3 8P", "3 Series (E90)"). Een dee mam
     aneren ufänkt zielt als Match (an allen zwou Richtungen). */
  function modelMatch(fit, sel) {
    if (!sel || fit === sel) return true;
    return fit.indexOf(sel + " ") === 0 || sel.indexOf(fit + " ") === 0;
  }
  function fitMatchesVehicle(x) {
    if (!state.brand || x[0] !== MAKE_IDX[state.brand]) return false;
    if (state.model && !modelMatch(x[1], state.model)) return false;
    // Baurei/Motor filteren nëmmen, wann d'Deel dës Donnéeën huet (REMUS).
    // DBA-Bremsen hu keng Baurei/Motor -> net erausfilteren, soss falen se bei
    // der spezifescher Sich eraus, obwuel se op d'Gefier passen.
    if (state.generation && x[2] > -1 && generationLabel(x) !== state.generation) return false;
    if (state.year && !yearFits(x, state.year)) return false;
    if (state.engine && x[8] > -1 && engineLabel(x) !== state.engine) return false;
    return true;
  }
  function selectedVehicleLabel() {
    return [state.brand, state.model, state.generation !== "—" ? state.generation : "", state.year, state.engine !== "—" ? state.engine : ""]
      .filter(Boolean).join(" · ");
  }

  /* EC-Status fir Anzeige: {cls, key} */
  function ecStatus(p) {
    var fits = p.f;
    if (state.mode === "vehicle" && state.brand) {
      var bi = MAKE_IDX[state.brand];
      fits = p.f.filter(fitMatchesVehicle);
      if (!fits.length) fits = p.f;
    }
    var yes = 0;
    fits.forEach(function (x) { if (x[7]) yes++; });
    if (yes === fits.length) return { cls: "ok", key: "ec_ok" };
    if (yes === 0) return { cls: "no", key: "ec_no" };
    return { cls: "some", key: "ec_some" };
  }

  function mfBadge(p) {
    var mf = mfOf(p);
    var span = document.createElement("span");
    span.className = "shop-mf shop-mf-" + mf;
    span.textContent = mf;
    span.setAttribute("title", mf);
    return span;
  }
  /* Badgen ënner dem Numm: DBA → Axe (Virun/Hannen); REMUS → EC-Zoulassung */
  function partBadges(p, t) {
    var out = [];
    if (mfOf(p) === "DBA") {
      if (p.ax) {
        var ab = document.createElement("span");
        ab.className = "badge badge-axle";
        ab.textContent = axleLabel(p.ax);
        out.push(ab);
      }
      var side = /(?:SL|CSL)$/i.test(p.i) ? "left" : /(?:SR|CSR)$/i.test(p.i) ? "right" : "";
      if (side) {
        var sb = document.createElement("span"); sb.className="badge badge-side";
        sb.textContent = side === "left" ? (lang()==="fr"?"Côté gauche":lang()==="en"?"Left side":lang()==="lb"?"Lénks Säit":"Linke Seite") : (lang()==="fr"?"Côté droit":lang()==="en"?"Right side":lang()==="lb"?"Riets Säit":"Rechte Seite");
        out.push(sb);
      }
      if (state.mode === "vehicle" && state.brand) {
        var review = document.createElement("span");
        review.className = "badge badge-review";
        review.textContent = t.compat_review;
        review.title = t.compat_review_title;
        out.push(review);
      }
      return out;
    }
    var ec = ecStatus(p);
    var ecb = document.createElement("span");
    ecb.className = "badge badge-ec " + ec.cls;
    ecb.textContent = (ec.cls === "ok" ? "✓ " : "") + t[ec.key];
    if (ec.cls === "no") ecb.title = t.no_road_title;
    out.push(ecb);
    return out;
  }

  /* ---------- Filter ---------- */
  function matches(p) {
    if (state.mf !== "all" && mfOf(p) !== state.mf) return false;
    if (state.cat !== "all") {
      if (mfOf(p) === "REMUS" && state.cat === "sound") {
        if (!remusPartsOf(p, "sound").length) return false;
      } else if (mfOf(p) === "REMUS" && state.cat === "adapter") {
        if (!remusPartsOf(p, "adapter").length) return false;
      } else if (p.c !== state.cat) return false;
    }
    if (state.axle !== "all" && p.ax !== state.axle) return false;
    if (state.approval !== "all") {
      if (mfOf(p) !== "REMUS") return false;
      var approval = ecStatus(p).cls;
      if (state.approval === "road" && approval === "no") return false;
      if (state.approval === "race" && approval !== "no") return false;
    }
    if (state.favoritesOnly && favorites.indexOf(p.i) === -1) return false;
    if (state.mode === "search" && state.q) {
      var terms = norm(state.q).split(" ").filter(Boolean);
      var haystack = searchableText(p);
      return terms.every(function (term) { return haystack.indexOf(term) !== -1; });
    }
    if (state.mode === "vehicle" && state.brand) {
      var bi = MAKE_IDX[state.brand];
      return p.f.some(fitMatchesVehicle);
    }
    return true;
  }

  /* ---------- Marque- a Kategorie-Chips ---------- */
  var MANUFACTURERS = (window.SHOP_META && window.SHOP_META.manufacturers) || ["REMUS"];
  function axleLabel(ax) {
    var t = tr();
    return ax === "F" ? t.axle_f : ax === "R" ? t.axle_r : "";
  }
  function catsFor(mf) {
    if (mf === "DBA") return ["all", "disc", "pads", "caliper", "bbk"];
    if (mf === "REMUS") return ["all", "system", "sound", "adapter"];
    // Bei "All Marquen" béid Produktwelten weisen, fir datt d'Leit
    // no der Zort Deel filtere kënnen, ouni den Hiersteller ze kennen.
    return ["all", "system", "sound", "adapter", "disc", "pads", "caliper", "bbk"];
  }
  function renderMfChips() {
    var t = tr(), wrap = $("mf-chips");
    if (!wrap) return;
    wrap.innerHTML = "";
    var opts = [["all", t.mf_all]].concat(MANUFACTURERS.map(function (m) { return [m, m]; }));
    opts.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mf-chip" + (state.mf === o[0] ? " active" : "") + (o[0] !== "all" ? " mf-chip-" + o[0] : "");
      b.textContent = o[1];
      b.addEventListener("click", function () {
        state.mf = o[0];
        if (catsFor(state.mf).indexOf(state.cat) === -1) state.cat = "all";
        if (o[0] === "DBA" || o[0] === "all") ensureDba(function () { render(); });
        visibleCount = PAGE_SIZE; saveState(); render();
      });
      wrap.appendChild(b);
    });
  }
  function renderChips() {
    renderMfChips();
    var t = tr(), wrap = $("cat-chips");
    if (!wrap) return;
    wrap.innerHTML = "";
    catsFor(state.mf).forEach(function (c) {
      var previousCategory = state.cat;
      state.cat = c;
      var count = collapseCatalog(PRODUCTS.filter(matches)).length;
      state.cat = previousCategory;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cat-chip" + (state.cat === c ? " active" : "");
      b.textContent = (t.cats[c] || c) + " (" + count + ")";
      b.addEventListener("click", function () { state.cat = c; visibleCount = PAGE_SIZE; saveState(); render(); });
      wrap.appendChild(b);
    });
  }

  /* ---------- Katalog rendern ---------- */
  function sortList(list) {
    return list.slice().sort(function (a, b) {
      if (state.sort === "price-asc" && a.p !== b.p) return (a.p || Infinity) - (b.p || Infinity);
      if (state.sort === "price-desc" && a.p !== b.p) return (b.p || -1) - (a.p || -1);
      return a.n < b.n ? -1 : a.n > b.n ? 1 : 0;
    });
  }
  function render() {
    var t = tr(), grid = $("shop-grid"), info = $("shop-result-info"), empty = $("shop-empty");
    if (!grid) return;
    renderChips();
    var list = sortList(collapseCatalog(PRODUCTS.filter(matches)));
    var n = list.length;
    var shown = list.slice(0, visibleCount);
    grid.innerHTML = "";
    shown.forEach(function (p, index) {
      grid.appendChild(card(p, t, index));
    });
    var txt;
    if (state.mode === "search" && state.q) txt = t.info_search.replace("{n}", n).replace("{q}", state.q);
    else if (state.mode === "vehicle" && state.brand)
      txt = t.info_veh.replace("{n}", n).replace("{v}", selectedVehicleLabel());
    else if (n > visibleCount) txt = t.info_more.replace("{n}", n).replace("{c}", visibleCount);
    else txt = t.info_all.replace("{n}", n);
    if (state.cat !== "all") txt = t.info_cat.replace("{n}", txt).replace("{c}", t.cats[state.cat]);
    if (info) info.textContent = txt;
    if (empty) {
      empty.hidden = n > 0;
      if (!empty.hidden) empty.textContent = state.favoritesOnly
        ? (lang() === "fr" ? "Votre liste de favoris est vide." : lang() === "en" ? "Your favourites list is empty." : lang() === "lb" ? "Är Favorittelëscht ass eidel." : "Ihre Merkliste ist leer.")
        : t.empty;
    }
    var more = $("shop-load-more");
    if (more) { more.hidden = visibleCount >= n; more.textContent = t.load_more.replace("{n}", Math.max(0, n - visibleCount)); }
    var favToggle = $("favorites-toggle");
    if (favToggle) { favToggle.classList.toggle("active", state.favoritesOnly); favToggle.setAttribute("aria-pressed", state.favoritesOnly ? "true" : "false"); }
    var vs=$("shop-vehicle-summary"), vst=$("shop-vehicle-summary-text");
    if(vs){vs.hidden=!(state.mode==="vehicle"&&state.brand);if(vst&&!vs.hidden)vst.textContent=(lang()==="fr"?"Véhicule sélectionné : ":lang()==="en"?"Selected vehicle: ":lang()==="lb"?"Ausgewielt Gefier: ":"Ausgewähltes Fahrzeug: ")+selectedVehicleLabel();}
    saveState();
  }

  function card(p, t, index) {
    var c = document.createElement("article");
    c.className = "shop-card";

    /* Media */
    var media = document.createElement("div");
    media.className = "shop-card-media mf-" + mfOf(p) + " is-loading";
    var url = productImgUrl(p, 600, 360);
    if (url) {
      var img = document.createElement("img");
      // Déi éischt siichtbar Resultater direkt lueden; de Rescht bleift lazy.
      // Dëst mécht virun allem nei Sichresultater däitlech méi séier sichtbar.
      img.loading = index < 8 ? "eager" : "lazy";
      img.decoding = "async";
      if (index < 4) img.setAttribute("fetchpriority", "high");
      img.width = 600; img.height = 360;
      img.alt = p.n;
      img.addEventListener("load", function () {
        media.classList.remove("is-loading");
        img.classList.add("is-loaded");
      });
      img.addEventListener("error", function () {
        if (!img.dataset.fallbackTried && imgUrl(p.m, 600, 360) !== url) {
          useFallbackImage(img, p, 600, 360, function () {});
          return;
        }
        media.classList.remove("is-loading");
        media.classList.add("no-img");
        img.remove();
      });
      img.src = url;
      if (img.complete && img.naturalWidth) {
        media.classList.remove("is-loading");
        img.classList.add("is-loaded");
      }
      media.appendChild(img);
    } else {
      media.classList.remove("is-loading");
      media.classList.add("no-img");
    }
    var catTag = document.createElement("span");
    catTag.className = "shop-cat";
    catTag.textContent = t.cats[p.c] || p.c;
    media.appendChild(catTag);
    media.appendChild(mfBadge(p));
    c.appendChild(media);

    /* Body */
    var body = document.createElement("div");
    body.className = "shop-card-body";

    var h = document.createElement("h3");
    h.textContent = productName(p);
    body.appendChild(h);

    var fav = document.createElement("button");
    fav.type = "button"; fav.className = "shop-favorite";
    var isFav = favorites.indexOf(p.i) !== -1;
    fav.textContent = isFav ? "♥" : "♡";
    fav.setAttribute("aria-label", isFav ? t.favorite_remove : t.favorite_add);
    fav.setAttribute("aria-pressed", isFav ? "true" : "false");
    fav.addEventListener("click", function (e) {
      e.stopPropagation();
      var pos = favorites.indexOf(p.i);
      if (pos === -1) favorites.push(p.i); else favorites.splice(pos, 1);
      saveJson("gk_shop_favorites", favorites); render();
    });
    body.appendChild(fav);

    var fit = document.createElement("p");
    fit.className = "shop-fit";
    if (state.mode === "vehicle" && state.brand) {
      var bi = MAKE_IDX[state.brand];
      var mf = p.f.filter(fitMatchesVehicle);
      fit.textContent = t.fits + " " + (mf.length ? fitLabel(mf[0]) : modelsOf(p).slice(0, 3).join(", "));
    } else {
      var ms = modelsOf(p);
      fit.textContent = t.fits + " " + ms.slice(0, 3).join(", ") + (ms.length > 3 ? " +" + (ms.length - 3) : "");
    }
    body.appendChild(fit);

    /* Technesch Spezifikatioun (DBA: Scheiwendiameter, Bremssättel …) */
    if (p.sp) {
      var spec = document.createElement("p");
      spec.className = "shop-spec";
      spec.textContent = p.sp;
      body.appendChild(spec);
    } else if (p.c === "bbk") {
      var kitSpec = dbaKitSummary(p);
      if (kitSpec) {
        var kitSpecEl = document.createElement("p");
        kitSpecEl.className = "shop-spec shop-kit-spec";
        kitSpecEl.textContent = kitSpec;
        body.appendChild(kitSpecEl);
      }
    }

    /* Badges: REMUS → EC-Zoulassung · DBA → Axe (Virun/Hannen) */
    var badges = document.createElement("div");
    badges.className = "shop-badges";
    partBadges(p, t).forEach(function (bd) { badges.appendChild(bd); });
    body.appendChild(badges);

    /* Foot */
    var foot = document.createElement("div");
    foot.className = "shop-card-foot";
    var art = document.createElement("span");
    art.className = "shop-artnr";
    art.textContent = t.artnr + " " + displayRef(p);
    var pr = document.createElement("span");
    pr.className = "shop-price";
    pr.textContent = p.p ? priceStr(p.p) : "—";
    if (p.p) {
      var shipping = document.createElement("small");
      shipping.className = "shop-shipping-note";
      shipping.textContent = t.shipping_extra;
      pr.appendChild(shipping);
    }
    foot.appendChild(art);
    foot.appendChild(pr);
    body.appendChild(foot);

    var btn = document.createElement("button");
    var variants = mfOf(p) === "REMUS" ? remusConfigVariants(p) : bundleVariants(p);
    btn.type = "button";
    btn.className = "btn btn-outline shop-add";
    btn.textContent = variants.length > 1 ? t.configure : t.add;
    btn.disabled = !p.p;
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (variants.length > 1) openProduct(p);
      else addToCart(p, btn);
    });
    body.appendChild(btn);
    var compare = document.createElement("button");
    compare.type="button"; compare.className="shop-compare-add";
    compare.textContent = (compareIds.indexOf(p.i) !== -1 ? "✓ " : "+ ") + t.compare_add;
    compare.addEventListener("click", function (e) {
      e.stopPropagation(); var at=compareIds.indexOf(p.i);
      if (at !== -1) compareIds.splice(at,1); else if (compareIds.length < 3) compareIds.push(p.i); else showToast(t.compare_limit || "Maximal 3 Produkte vergleichen.");
      saveJson("gk_shop_compare", compareIds);
      updateCompareBar(); render();
    });
    body.appendChild(compare);

    c.appendChild(body);
    c.classList.add("is-clickable");
    c.addEventListener("click", function () { openProduct(p); });
    return c;
  }

  function updateCompareBar() {
    var t=tr(), bar=$("shop-compare-bar"); if (!bar) return;
    bar.hidden=compareIds.length===0;
    setTxt("shop-compare-count", t.compare_count.replace("{n}", compareIds.length));
    setTxt("shop-compare-open", t.compare); setTxt("shop-compare-clear", t.compare_clear);
    var open=$("shop-compare-open"); if(open) open.disabled=compareIds.length<2;
  }
  function openCompare() {
    if (compareIds.length < 2) return;
    var t=tr(), selected=compareIds.map(function(id){ return PRODUCTS.filter(function(p){return p.i===id;})[0]; }).filter(Boolean);
    var back=document.createElement("div"); back.className="compare-dialog-back";
    var dialog=document.createElement("div"); dialog.className="compare-dialog"; dialog.setAttribute("role","dialog"); dialog.setAttribute("aria-modal","true"); dialog.setAttribute("aria-labelledby","compare-dialog-title");
    var close=document.createElement("button"); close.className="pd-close"; close.type="button"; close.textContent="✕"; close.setAttribute("aria-label", t.close_label || "Schließen");
    lastDialogFocus=document.activeElement; document.body.classList.add("dialog-open");
    function shut(){ back.remove(); dialog.remove(); document.body.classList.remove("dialog-open"); activeCompareDialog=null; if(lastDialogFocus&&lastDialogFocus.focus)lastDialogFocus.focus(); }
    close.addEventListener("click",shut); back.addEventListener("click",shut); dialog.appendChild(close);
    var h=document.createElement("h2"); h.id="compare-dialog-title"; h.textContent=t.compare; dialog.appendChild(h);
    var table=document.createElement("div"); table.className="compare-grid";
    selected.forEach(function(p){ var a=document.createElement("article"); var n=document.createElement("h3"); n.textContent=productName(p); var meta=document.createElement("p"); meta.textContent=mfOf(p)+" · "+(t.cats[p.c]||p.c)+(p.ax?" · "+axleLabel(p.ax):""); var price=document.createElement("strong"); price.textContent=p.p?priceStr(p.p):"—"; var ref=document.createElement("p"); ref.textContent=t.artnr+" "+displayRef(p); var fit=document.createElement("p"); fit.textContent=t.fits+" "+modelsOf(p).slice(0,4).join(", "); a.appendChild(n);a.appendChild(meta);a.appendChild(price);a.appendChild(ref);a.appendChild(fit);table.appendChild(a); });
    dialog.appendChild(table); document.body.appendChild(back); document.body.appendChild(dialog); activeCompareDialog={dialog:dialog,close:shut}; close.focus();
  }

  /* ---------- Produkt-Detail (Modal) + "Dobaibestellen" ---------- */
  function roleLabel(r) {
    var rs = tr().roles || {};
    return rs[r] || "";
  }
  /* Roll-Gruppen: "complete" = komplett Auspuffanlagen (cat-back, axle-back,
     rear silencer, system … – dat sinn Varianten vunenee); "up" = Downpipe /
     Krümmer (virgelageert); "add" = Adapter / Sound Controller (Zousatz).
     Komplementär = aner Grupp (z.B. komplett Anlag + Downpipe), NET zwou
     komplett Anlagen (déi wieren Alternativen). */
  function roleGroup(r) {
    if (r === "downpipe" || r === "header") return "up";
    if (r === "adapter" || r === "sound") return "add";
    return "complete";
  }
  var ROLE_ORDER = { downpipe: 1, header: 2, adapter: 3, sound: 4, rear: 5, mid: 5, front: 5, catback: 6, axleback: 6, system: 6, slipon: 6, tail: 6 };
  function complements(ra, rb) {
    if (ra === rb) return false;                        // selwecht Roll = Variant
    var ga = roleGroup(ra), gb = roleGroup(rb);
    if (ga === "add" || gb === "add") return true;      // Adapter/Sound passt zu allem anerem
    if (ga === "complete" && gb === "complete") return false; // zwou komplett Anlagen = Alternativen
    return true;                                        // complete <-> Downpipe/Krümmer
  }
  function exactFitKey(x) {
    return [x[0], x[1], x[2], x[3], x[4], x[5], x[6], x[8]].join("|");
  }
  /* DBA: komplementär = selwecht Gefier (Mark+Modell), awer aner Kategorie
     (Scheiwen ↔ Belee) oder aner Axe (Virun ↔ Hannen). */
  function relatedDBA(p) {
    var vk = {};
    p.f.forEach(function (x) { vk[x[0] + "|" + x[1]] = 1; });
    var cands = [];
    PRODUCTS.forEach(function (o) {
      if (mfOf(o) !== "DBA" || o.i === p.i || !o.p) return;
      var share = 0;
      o.f.forEach(function (x) { if (vk[x[0] + "|" + x[1]]) share++; });
      if (!share) return;
      var diffCat = o.c !== p.c;
      var diffAxle = o.ax && p.ax && o.ax !== p.ax;
      if (!diffCat && !diffAxle) return; // selwecht Kategorie+Axe = quasi Variant
      cands.push({ o: o, share: share, rank: diffCat ? 0 : 1 });
    });
    cands.sort(function (a, b) {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.share !== b.share) return b.share - a.share;
      return a.o.p - b.o.p;
    });
    var per = {}, out = [];
    cands.forEach(function (s) {
      var k = s.o.c + "|" + (s.o.ax || "");
      per[k] = (per[k] || 0) + 1;
      if (per[k] <= 3 && out.length < 8) out.push(s.o);
    });
    out.mode = "parts";
    return out;
  }
  function relatedOf(p) {
    if (mfOf(p) === "DBA") return relatedDBA(p);
    /* Fir "passend" nëmmen déi exakt Gefier-/Motor-Zouuerdnung benotzen.
       Als éischt komplementär Deeler; wa keng existéieren, aner komplett
       Anlagen fir genee datselwecht Gefier weisen. */
    var exactKeys = {};
    p.f.forEach(function (x) { exactKeys[exactFitKey(x)] = 1; });
    var candidates = [];
    PRODUCTS.forEach(function (o) {
      if (mfOf(o) !== "REMUS" || o.i === p.i || !o.p) return;
      var share = 0;
      o.f.forEach(function (x) { if (exactKeys[exactFitKey(x)]) share++; });
      if (share) candidates.push({ o: o, share: share });
    });

    function sortAndLimit(list, mode) {
      var seenGroup = {}, perRole = {}, out = [];
      list.sort(function (a, b) {
        var ar = ROLE_ORDER[a.o.r] || 9, br = ROLE_ORDER[b.o.r] || 9;
        if (ar !== br) return ar - br;
        if (a.share !== b.share) return b.share - a.share;
        if (a.o.p !== b.o.p) return a.o.p - b.o.p;
        return a.o.n < b.o.n ? -1 : 1;
      });
      list.forEach(function (s) {
        var group = bundleGroupKey(s.o);
        if (seenGroup[group]) return;
        seenGroup[group] = 1;
        perRole[s.o.r] = (perRole[s.o.r] || 0) + 1;
        if (perRole[s.o.r] <= 3 && out.length < 8) out.push(s.o);
      });
      out.mode = mode;
      return out;
    }

    var complementary = candidates.filter(function (s) { return complements(p.r, s.o.r); });
    if (complementary.length) return sortAndLimit(complementary, "parts");

    var alternatives = candidates.filter(function (s) {
      return roleGroup(s.o.r) === "complete" &&
        bundleGroupKey(s.o) !== bundleGroupKey(p);
    });
    return sortAndLimit(alternatives, "alternatives");
  }

  var pdEls = null;
  function ensureModal() {
    if (pdEls) return pdEls;
    var back = document.createElement("div");
    back.className = "pd-backdrop"; back.id = "pd-backdrop"; back.hidden = true;
    var modal = document.createElement("div");
    modal.className = "pd-modal"; modal.id = "pd-modal";
    modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true"); modal.setAttribute("aria-labelledby", "pd-name");
    modal.hidden = true;
    modal.innerHTML =
      '<button type="button" class="pd-close" aria-label="×">✕</button>' +
      '<div class="pd-media" id="pd-media"></div>' +
      '<div class="pd-body">' +
      '<span class="shop-cat" id="pd-cat"></span>' +
      '<h2 class="pd-name" id="pd-name"></h2>' +
      '<div class="shop-badges" id="pd-badges"></div>' +
      '<dl class="pd-specs" id="pd-specs"></dl>' +
      '<div class="pd-config" id="pd-config"></div>' +
      '<p class="pd-fits-title" id="pd-fits-title"></p>' +
      '<ul class="pd-fits" id="pd-fits"></ul>' +
      '<div class="pd-foot"><span class="pd-ref" id="pd-ref"></span><span class="pd-price-wrap"><span class="pd-price" id="pd-price"></span><small class="shop-shipping-note" id="pd-shipping"></small></span></div>' +
      '<button type="button" class="btn btn-primary pd-add" id="pd-add"></button>' +
      '<button type="button" class="btn btn-outline pd-inquiry" id="pd-inquiry"></button>' +
      '<div class="pd-related" id="pd-related"></div>' +
      '</div>';
    document.body.appendChild(back);
    document.body.appendChild(modal);
    back.addEventListener("click", closeProduct);
    modal.querySelector(".pd-close").addEventListener("click", closeProduct);
    pdEls = { back: back, modal: modal };
    return pdEls;
  }
  function closeProduct() {
    if (!pdEls) return;
    pdEls.modal.classList.remove("show");
    pdEls.back.classList.remove("show");
    var cleanUrl=new URL(location.href); cleanUrl.searchParams.delete("product"); history.replaceState(null,"",cleanUrl.pathname+cleanUrl.search+cleanUrl.hash);
    setTimeout(function () {
      if (pdEls && !pdEls.modal.classList.contains("show")) { pdEls.modal.hidden = true; pdEls.back.hidden = true; }
    }, 250);
  }

  var inquiryEls = null;
  var inquiryProducts = [];
  function inquiryLabels() {
    var l = lang();
    if (l === "fr") return { title:"Vérification de compatibilité", intro:"Les articles sont déjà renseignés. Indiquez uniquement vos coordonnées et les données du véhicule.", article:"Articles à vérifier", more:"Ajouter d’autres articles", remove:"Retirer", name:"Nom et prénom", email:"E-mail", phone:"Téléphone", make:"Marque", model:"Modèle", year:"Année", engine:"Motorisation", vin:"Numéro de châssis (VIN)", note:"Informations complémentaires", privacy:"J’ai lu la politique de confidentialité et j’accepte le traitement de mes données pour cette demande.", send:"Envoyer la demande", close:"Fermer", sending:"Envoi …", ok:"Merci ! Votre demande est bien arrivée.", senderr:"L’envoi a échoué. Réessayez ou appelez-nous.", rate:"Trop de demandes en peu de temps. Réessayez plus tard.", missing:"Merci de compléter tous les champs obligatoires." };
    if (l === "en") return { title:"Fitment check", intro:"The products are already filled in. Please add only your contact and vehicle details.", article:"Products to check", more:"Add more products", remove:"Remove", name:"Full name", email:"Email", phone:"Phone", make:"Make", model:"Model", year:"Year", engine:"Engine", vin:"Vehicle identification number (VIN)", note:"Additional information", privacy:"I have read the privacy policy and agree to the processing of my data for this request.", send:"Send request", close:"Close", sending:"Sending …", ok:"Thank you! Your request has arrived.", senderr:"Sending failed. Please try again or call us.", rate:"Too many requests in a short time. Please try again later.", missing:"Please complete all required fields." };
    if (l === "lb") return { title:"Passform iwwerpréiwen", intro:"D’Artikele si schonn agedroen. Fëllt just Är perséinlech Donnéeën an d’Gefierdaten aus.", article:"Artikelen iwwerpréiwen", more:"Weider Artikelen dobäisetzen", remove:"Ewechhuelen", name:"Numm a Virnumm", email:"E-Mail", phone:"Telefon", make:"Mark", model:"Modell", year:"Baujoer", engine:"Motoriséierung", vin:"Chassisnummer (VIN)", note:"Zousätzlech Informatiounen", privacy:"Ech hunn d’Dateschutzerklärung gelies a sinn averstanen, datt meng Donnéeë fir d’Veraarbechtung vun der Ufro benotzt ginn.", send:"Ufro schécken", close:"Zoumaachen", sending:"Gëtt geschéckt …", ok:"Merci! Är Ufro ass ukomm.", senderr:"D’Ufro konnt net geschéckt ginn. Probéiert nach eng Kéier oder rufft eis un.", rate:"Ze vill Ufroen a kuerzer Zäit. Probéiert méi spéit nach eng Kéier.", missing:"Fëllt w.e.g. all Pflichtfelder aus." };
    return { title:"Passform überprüfen", intro:"Die Artikel sind bereits eingetragen. Ergänzen Sie nur noch Ihre persönlichen Daten und Fahrzeugdaten.", article:"Zu prüfende Artikel", more:"Weitere Artikel hinzufügen", remove:"Entfernen", name:"Vor- und Nachname", email:"E-Mail", phone:"Telefon", make:"Marke", model:"Modell", year:"Baujahr", engine:"Motorisierung", vin:"Fahrgestellnummer (VIN)", note:"Zusätzliche Informationen", privacy:"Ich habe die Datenschutzerklärung gelesen und bin mit der Verarbeitung meiner Daten für diese Anfrage einverstanden.", send:"Anfrage senden", close:"Schließen", sending:"Wird gesendet …", ok:"Danke! Ihre Anfrage ist angekommen.", senderr:"Senden fehlgeschlagen. Bitte erneut versuchen oder anrufen.", rate:"Zu viele Anfragen in kurzer Zeit. Bitte später erneut versuchen.", missing:"Bitte füllen Sie alle Pflichtfelder aus." };
  }
  function ensureInquiryModal() {
    if (inquiryEls) return inquiryEls;
    var back=document.createElement("div"); back.className="fit-inquiry-back"; back.hidden=true;
    var modal=document.createElement("div"); modal.className="fit-inquiry-modal"; modal.hidden=true; modal.setAttribute("role","dialog"); modal.setAttribute("aria-modal","true"); modal.setAttribute("aria-labelledby","fit-inquiry-title");
    modal.innerHTML='<button type="button" class="pd-close fit-inquiry-close">✕</button><div class="fit-inquiry-head"><h2 id="fit-inquiry-title"></h2><p id="fit-inquiry-intro"></p></div><form id="fit-inquiry-form" novalidate><input type="hidden" id="fit-article-value"><input type="hidden" name="_loaded_at" value=""><input type="text" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true" class="form-honey"><div class="fit-product-summary"><strong id="fit-article-label"></strong><div id="fit-products"></div><button type="button" class="fit-add-more" id="fit-add-more"></button></div><div class="field-row"><div class="field"><label for="fit-name" id="fit-name-label"></label><input id="fit-name" name="Name" autocomplete="name" maxlength="120" required></div><div class="field"><label for="fit-email" id="fit-email-label"></label><input id="fit-email" name="E-Mail" type="email" autocomplete="email" maxlength="254" required></div></div><div class="field"><label for="fit-phone" id="fit-phone-label"></label><input id="fit-phone" name="Telefon" type="tel" autocomplete="tel" maxlength="30" required></div><fieldset><legend id="fit-vehicle-title"></legend><div class="field-row"><div class="field"><label for="fit-make" id="fit-make-label"></label><input id="fit-make" name="Fahrzeugmarke" maxlength="80" required></div><div class="field"><label for="fit-model" id="fit-model-label"></label><input id="fit-model" name="Fahrzeugmodell" maxlength="100" required></div></div><div class="field-row"><div class="field"><label for="fit-year" id="fit-year-label"></label><input id="fit-year" name="Baujahr" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" required></div><div class="field"><label for="fit-engine" id="fit-engine-label"></label><input id="fit-engine" name="Motorisierung" maxlength="100" required></div></div><div class="field"><label for="fit-vin" id="fit-vin-label"></label><input id="fit-vin" name="Fahrgestellnummer (VIN)" maxlength="17" autocomplete="off" spellcheck="false"></div></fieldset><div class="field"><label for="fit-note" id="fit-note-label"></label><textarea id="fit-note" name="Zusätzliche Informationen" maxlength="2000" rows="3"></textarea></div><label class="privacy-confirm"><input type="checkbox" name="Datenschutz bestätigt" required><span id="fit-privacy-text"></span></label><button class="btn btn-primary btn-block" type="submit" id="fit-submit"></button><p class="form-note"><a href="datenschutz.html">Datenschutz</a></p><p class="form-status" id="fit-status" role="status" aria-live="polite"></p></form>';
    document.body.appendChild(back); document.body.appendChild(modal);
    function close(){ modal.hidden=true; back.hidden=true; document.body.classList.remove("dialog-open"); }
    back.addEventListener("click",close); modal.querySelector(".fit-inquiry-close").addEventListener("click",close);
    modal.querySelector("#fit-add-more").addEventListener("click",function(){ close(); closeProduct(); });
    modal.querySelector('[name="_loaded_at"]').value=String(Date.now());
    inquiryEls={back:back,modal:modal,close:close}; return inquiryEls;
  }
  function renderInquiryProducts(l) {
    var wrap=$("fit-products"); wrap.innerHTML="";
    inquiryProducts.forEach(function(product,index){
      var row=document.createElement("div"); row.className="fit-product-row";
      var text=document.createElement("span");
      var strong=document.createElement("strong"); strong.textContent=productName(product);
      var small=document.createElement("small"); small.textContent=tr().artnr+" "+displayRef(product);
      text.appendChild(strong); text.appendChild(small);
      var remove=document.createElement("button"); remove.type="button"; remove.textContent="×"; remove.setAttribute("aria-label",l.remove+" "+productName(product));
      remove.addEventListener("click",function(){ if(inquiryProducts.length===1)return; inquiryProducts.splice(index,1); renderInquiryProducts(l); });
      row.appendChild(text); row.appendChild(remove); wrap.appendChild(row);
    });
    setTxt("fit-add-more",l.more);
  }
  function openInquiry(p) {
    var l=inquiryLabels(), els=ensureInquiryModal();
    setTxt("fit-inquiry-title",l.title); setTxt("fit-inquiry-intro",l.intro); setTxt("fit-article-label",l.article); setTxt("fit-name-label",l.name); setTxt("fit-email-label",l.email); setTxt("fit-phone-label",l.phone); setTxt("fit-make-label",l.make); setTxt("fit-model-label",l.model); setTxt("fit-year-label",l.year); setTxt("fit-engine-label",l.engine); setTxt("fit-vin-label",l.vin); setTxt("fit-note-label",l.note); setTxt("fit-privacy-text",l.privacy); setTxt("fit-submit",l.send); setTxt("fit-vehicle-title",lang()==="fr"?"Données du véhicule":lang()==="en"?"Vehicle details":lang()==="lb"?"Gefierdaten":"Fahrzeugdaten");
    els.modal.querySelector(".fit-inquiry-close").setAttribute("aria-label",l.close);
    if (!inquiryProducts.some(function(product){return product.i===p.i;})) inquiryProducts.push(p);
    renderInquiryProducts(l);
    $("fit-inquiry-form").onsubmit=function(e){
      if(e&&e.preventDefault)e.preventDefault();
      var form=this, st=$("fit-status");
      var val=function(id){var el=$(id);return el?(el.value||"").trim():"";};
      var name=val("fit-name"), email=val("fit-email"), phone=val("fit-phone");
      var make=val("fit-make"), model=val("fit-model"), year=val("fit-year"), engine=val("fit-engine"), vin=val("fit-vin"), note=val("fit-note");
      var privacyEl=form.querySelector('[name="Datenschutz bestätigt"]');
      var okmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if(!name||!okmail||!phone||!make||!model||!year||!engine||!privacyEl||!privacyEl.checked){ if(st){st.className="form-status err"; st.textContent=l.missing;} return false; }
      var hp=form.querySelector('[name="_honey"]'); if(hp&&hp.value){ if(st){st.className="form-status ok"; st.textContent=l.ok;} return false; }
      var loaded=Number((form.querySelector('[name="_loaded_at"]')||{}).value||0);
      if(loaded&&Date.now()-loaded<2500){ if(st){st.className="form-status err"; st.textContent=l.senderr;} return false; }
      var articleValue=inquiryProducts.map(function(product){return productName(product)+" | "+displayRef(product);}).join("\n");
      var service=inquiryProducts.map(function(product){return productName(product);}).join(", ");
      var vehicle=[make,model,year].filter(Boolean).join(" ")+(engine?" · "+engine:"");
      var msg="Artikel:\n"+articleValue+(note?"\n\n"+note:"");
      var btn=$("fit-submit"); if(btn)btn.disabled=true;
      if(st){st.className="form-status"; st.textContent=l.sending;}
      fetch(ADMIN_API+"/appointments",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({
        name:name, email:email, phone:phone, service:service, vehicle:vehicle, vin:vin, msg:msg, kind:"inquiry", lang:lang(), privacy:!!privacyEl.checked,
        website:hp?hp.value:"", loadedAt:loaded
      })}).then(function(r){return r.json().catch(function(){return{};}).then(function(data){if(!r.ok||!data.ok){var err=new Error(data.error||"http");err.code=data.error;throw err;}return data;});})
      .then(function(){ if(st){st.className="form-status ok"; st.textContent=l.ok;} form.reset(); inquiryProducts=[]; })
      .catch(function(err){ if(st){st.className="form-status err"; st.textContent=(err&&err.code==="rate_limited"&&l.rate)?l.rate:l.senderr;} })
      .then(function(){ if(btn)btn.disabled=false; });
      return false;
    };
    els.back.hidden=false; els.modal.hidden=false; document.body.classList.add("dialog-open");
    setTimeout(function(){
      $("fit-make").value=state.brand||""; $("fit-model").value=state.model||""; $("fit-year").value=state.year||""; $("fit-engine").value=state.engine||"";
      $("fit-name").focus();
    },0);
  }
  function renderProductConfig(p, t) {
    var wrap = $("pd-config");
    if (!wrap) return;
    wrap.innerHTML = "";

    var title = document.createElement("h3");
    title.className = "pd-config-title";
    title.textContent = t.config_title;
    wrap.appendChild(title);

    var systemLabel = document.createElement("span");
    systemLabel.className = "pd-config-label";
    systemLabel.textContent = t.config_system;
    wrap.appendChild(systemLabel);

    var system = document.createElement("p");
    system.className = "pd-config-system";
    system.textContent = bundleBaseName(p);
    wrap.appendChild(system);

    var status = document.createElement("p");
    status.className = "pd-required-status " + (p.ps && p.ps.length ? "is-complete" : "needs-system");
    status.textContent = (p.ps && p.ps.length ? t.config_required : t.config_component);
    wrap.appendChild(status);

    var bundleRef = document.createElement("p");
    bundleRef.className = "pd-config-single";
    bundleRef.textContent = t.config_bundle_ref.replace("{sku}", p.i);
    wrap.appendChild(bundleRef);

    if (p.ps && p.ps.length) {
      var partsLabel = document.createElement("span");
      partsLabel.className = "pd-config-label pd-parts-label";
      partsLabel.textContent = t.config_parts;
      wrap.appendChild(partsLabel);

      [["system", t.config_main_parts], ["tail", t.config_tail_parts],
       ["sound", t.config_sound_parts], ["adapter", t.config_adapter_parts]]
        .forEach(function (group) {
          var values = remusPartsOf(p, group[0]);
          if (!values.length) return;
          var box = document.createElement("div");
          box.className = "pd-part-group pd-part-group-" + group[0];
          var groupName = document.createElement("strong");
          groupName.textContent = group[1];
          box.appendChild(groupName);
          var parts = document.createElement("ul");
          parts.className = "pd-parts";
          values.forEach(function (sku) {
            var item = document.createElement("li");
            item.textContent = sku;
            parts.appendChild(item);
          });
          box.appendChild(parts);
          wrap.appendChild(box);
        });

      var partsNote = document.createElement("p");
      partsNote.className = "pd-parts-note";
      partsNote.textContent = t.config_parts_note;
      wrap.appendChild(partsNote);
    }

    var variants = remusConfigVariants(p);
    if (variants.length > 1) {
      var configLabel = document.createElement("span");
      configLabel.className = "pd-config-label";
      configLabel.textContent = t.config_valid;
      wrap.appendChild(configLabel);

      var slotDefs = remusSlotDefs(variants);
      slotDefs.forEach(function (def, slotIndex) {
        var values = [];
        variants.forEach(function (variant) {
          var value = remusSlotValue(variant, def);
          if (values.indexOf(value) === -1) values.push(value);
        });
        if (values.length < 2) return;

        var field = document.createElement("div");
        field.className = "pd-option-field pd-option-" + def.type;
        var id = "pd-option-" + slotIndex;
        var label = document.createElement("label");
        label.className = "pd-option-label";
        label.setAttribute("for", id);
        if (def.type === "system") label.textContent = t.config_component_choice.replace("{n}", def.index + 1);
        else if (def.type === "tail") label.textContent = t.config_tail_parts + (def.index ? " " + (def.index + 1) : "");
        else if (def.type === "sound") label.textContent = t.config_sound_parts;
        else label.textContent = t.config_adapter_parts + (def.index ? " " + (def.index + 1) : "");
        field.appendChild(label);

        var select = document.createElement("select");
        select.className = "pd-variant pd-option-select";
        select.id = id;
        values.sort().forEach(function (value) {
          var option = document.createElement("option");
          option.value = value;
          option.selected = value === remusSlotValue(p, def);
          option.textContent = value || t.config_none;
          select.appendChild(option);
        });
        select.addEventListener("change", function () {
          var candidates = variants.filter(function (variant) {
            return remusSlotValue(variant, def) === select.value;
          });
          candidates.sort(function (a, b) {
            function score(variant) {
              return slotDefs.reduce(function (sum, other) {
                if (other === def) return sum;
                return sum + (remusSlotValue(variant, other) === remusSlotValue(p, other) ? 1 : 0);
              }, 0);
            }
            return score(b) - score(a) || a.p - b.p;
          });
          if (candidates[0]) openProduct(candidates[0]);
        });
        field.appendChild(select);
        wrap.appendChild(field);
      });
    } else {
      var single = document.createElement("p");
      single.className = "pd-config-single";
      single.textContent = t.config_single;
      wrap.appendChild(single);
    }

    var total = document.createElement("div");
    total.className = "pd-config-total";
    var totalLabel = document.createElement("span");
    totalLabel.textContent = t.config_total;
    var totalPrice = document.createElement("strong");
    totalPrice.textContent = p.p ? priceStr(p.p) : "—";
    total.appendChild(totalLabel);
    total.appendChild(totalPrice);
    wrap.appendChild(total);

    var check = document.createElement("p");
    check.className = "pd-required-check";
    check.textContent = t.config_check;
    wrap.appendChild(check);
  }

  function openProduct(p) {
    if (mfOf(p) === "REMUS" && !window.REMUS_PARTS) {
      ensureRemusParts(function () { openProduct(p); });
      return;
    }
    var t = tr();
    ensureModal();
    var media = $("pd-media");
    var url = productImgUrl(p, 900, 540);
    media.className = "pd-media mf-" + mfOf(p);
    media.innerHTML = "";
    if (url) {
      var img = document.createElement("img");
      img.loading = "lazy"; img.alt = p.n; img.src = url;
      img.addEventListener("error", function () {
        useFallbackImage(img, p, 900, 540, function () { media.classList.add("no-img"); img.remove(); });
      });
      media.appendChild(img);
    } else { media.classList.add("no-img"); }
    media.appendChild(mfBadge(p));
    setTxt("pd-cat", roleLabel(p.r) || t.cats[p.c] || p.c);
    setTxt("pd-name", productName(p));
    /* Badgen: REMUS → EC · DBA → Axe */
    var badges = $("pd-badges"); badges.innerHTML = "";
    partBadges(p, t).forEach(function (bd) { badges.appendChild(bd); });
    var specs=$("pd-specs"); specs.innerHTML="";
    var specRows=[[t.artnr,displayRef(p)],[lang()==="fr"?"Fabricant":lang()==="en"?"Manufacturer":lang()==="lb"?"Hiersteller":"Hersteller",mfOf(p)],[lang()==="fr"?"Catégorie":lang()==="en"?"Category":lang()==="lb"?"Kategorie":"Kategorie",t.cats[p.c]||p.c],[lang()==="fr"?"Essieu":lang()==="en"?"Axle":lang()==="lb"?"Achs":"Achse",p.ax?axleLabel(p.ax):"—"]];
    /* DBA-Technik: "Ø 326 mm · Brembo-Sättel" opsplécken a beschëlteren */
    if(p.sp){p.sp.split(" · ").forEach(function(seg){seg=seg.trim();if(!seg)return;var lbl;if(/^Ø/.test(seg))lbl=lang()==="fr"?"Diamètre disque":lang()==="en"?"Disc diameter":lang()==="lb"?"Scheiwendiameter":"Scheibendurchmesser";else lbl=lang()==="fr"?"Étriers recommandés":lang()==="en"?"Recommended calipers":lang()==="lb"?"Empfohlen Bremssättel":"Empf. Bremssättel";specRows.push([lbl,seg.replace(/-Sättel$/,"")]);});}
    var kitParts=dbaKitComponents(p);
    if(kitParts){
      var discLabel=lang()==="fr"?"Disques inclus":lang()==="en"?"Included discs":lang()==="lb"?"Enthale Scheiwen":"Enthaltene Scheiben";
      var padLabel=lang()==="fr"?"Plaquettes incluses":lang()==="en"?"Included pads":lang()==="lb"?"Enthale Bremsbeläg":"Enthaltene Beläge";
      specRows.push([discLabel,"2× "+kitParts.discRef+(kitParts.disc&&kitParts.disc.sp?" · "+cleanDbaSpec(kitParts.disc.sp):"")]);
      specRows.push([padLabel,kitParts.padRef+(kitParts.pad&&kitParts.pad.sp?" · "+cleanDbaSpec(kitParts.pad.sp):"")]);
    }
    specRows.forEach(function(pair){var dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=pair[0];dd.textContent=pair[1];specs.appendChild(dt);specs.appendChild(dd);});
    /* Configurator (Bundle-Varianten) nëmme fir REMUS */
    var cfg = $("pd-config");
    if (cfg) { cfg.innerHTML = ""; cfg.style.display = mfOf(p) === "REMUS" ? "" : "none"; }
    if (mfOf(p) === "REMUS") renderProductConfig(p, t);
    /* Bei enger Gefiersich nëmmen déi passend Zouuerdnunge weisen. Sou ass
       direkt kloer, firwat de Produit am Resultat erschéngt. */
    var selectedFits = state.mode === "vehicle" && state.brand ? p.f.filter(fitMatchesVehicle) : [];
    var fitsToShow = selectedFits.length ? selectedFits : p.f;
    var selectedTitle = lang() === "fr" ? "Compatible avec : " : lang() === "en" ? "Fits: " : lang() === "lb" ? "Passend fir: " : "Passend für: ";
    setTxt("pd-fits-title", selectedFits.length ? selectedTitle + selectedVehicleLabel() : t.fits_on);
    var fitsEl = $("pd-fits"); fitsEl.innerHTML = "";
    var seen = {}, shown = 0;
    fitsToShow.forEach(function (x) {
      if (shown >= 10) return;
      var label = makeName(x[0]) + " " + fitLabel(x);
      if (seen[label]) return; seen[label] = 1; shown++;
      var li = document.createElement("li"); li.textContent = label;
      if (selectedFits.length) li.className = "is-selected-fit";
      fitsEl.appendChild(li);
    });
    setTxt("pd-ref", t.artnr + " " + displayRef(p));
    setTxt("pd-price", p.p ? priceStr(p.p) : "—");
    setTxt("pd-shipping", p.p ? t.shipping_extra : "");
    var addBtn = $("pd-add");
    addBtn.textContent = t.add; addBtn.disabled = !p.p;
    addBtn.onclick = function () { addToCart(p, addBtn); };
    var inquiry = $("pd-inquiry");
    if (inquiry) {
      inquiry.textContent = t.inquiry;
      inquiry.onclick = function () { openInquiry(p); };
    }
    /* Dobaibestellen – nëmme weisen wann et wierklech komplementär Deeler gëtt */
    var relWrap = $("pd-related"); relWrap.innerHTML = "";
    /* REMUS-Deeler an Optioune kommen nëmmen aus der offizieller
       Bundle-Stécklëscht uewen; keng gerode Produkter als Ergänzung weisen. */
    var rel = mfOf(p) === "REMUS" ? [] : relatedOf(p);
    if (rel.length) {
      relWrap.style.display = "";
      var h = document.createElement("h3"); h.textContent = t.related; relWrap.appendChild(h);
      var sub = document.createElement("p"); sub.className = "pd-rel-sub";
      sub.textContent = rel.mode === "alternatives" ? t.related_alt_sub : t.related_sub;
      relWrap.appendChild(sub);
      var ul = document.createElement("ul"); ul.className = "pd-rel-list";
      rel.forEach(function (o) { ul.appendChild(relItem(o, t)); });
      relWrap.appendChild(ul);
    } else {
      relWrap.style.display = "";
      var emptyTitle = document.createElement("h3"); emptyTitle.textContent = t.related; relWrap.appendChild(emptyTitle);
      var emptyText = document.createElement("p"); emptyText.className = "pd-rel-sub"; emptyText.textContent = t.rel_none_detail; relWrap.appendChild(emptyText);
    }
    pdEls.modal.scrollTop = 0;
    pdEls.back.hidden = false; pdEls.modal.hidden = false;
    var productUrl=new URL(location.href); productUrl.searchParams.set("product",p.i); history.replaceState(null,"",productUrl.pathname+productUrl.search+productUrl.hash);
    requestAnimationFrame(function () { pdEls.modal.classList.add("show"); pdEls.back.classList.add("show"); });
  }

  /* Déi grouss REMUS-Stécklëscht eréischt lueden, wann eng REMUS-Detailkaart
     opgemaach gëtt. D'Katalog- a Gefiersich bleift doduerch däitlech méi liicht. */
  function ensureRemusParts(cb) {
    if (window.REMUS_PARTS) { REMUS_PARTS = window.REMUS_PARTS; if (cb) cb(); return; }
    if (cb) remusPartsCallbacks.push(cb);
    if (remusPartsRequested) return;
    remusPartsRequested = true;
    var script = document.createElement("script");
    script.src = "remus-parts.js?v=3";
    script.async = true;
    script.onload = function () {
      REMUS_PARTS = window.REMUS_PARTS || {};
      buildIndexes();
      render();
      var callbacks = remusPartsCallbacks.slice();
      remusPartsCallbacks = [];
      callbacks.forEach(function (fn) { try { fn(); } catch (e) {} });
    };
    script.onerror = function () {
      remusPartsRequested = false;
      remusPartsCallbacks = [];
      showToast(lang() === "de" ? "Produktdetails konnten nicht geladen werden. Bitte erneut versuchen." : "Product details could not be loaded. Please try again.");
    };
    document.head.appendChild(script);
  }
  function relItem(o, t) {
    var li = document.createElement("li"); li.className = "pd-rel-item";
    var thumb = document.createElement("div"); thumb.className = "pd-rel-thumb mf-" + mfOf(o);
    var url = productImgUrl(o, 160, 120);
    if (url) {
      var im = document.createElement("img"); im.loading = "lazy"; im.alt = o.n; im.src = url;
      im.addEventListener("error", function () {
        useFallbackImage(im, o, 160, 120, function () { thumb.classList.add("no-img"); im.remove(); });
      });
      thumb.appendChild(im);
    } else { thumb.classList.add("no-img"); }
    var info = document.createElement("div"); info.className = "pd-rel-info";
    var nm = document.createElement("div"); nm.className = "pd-rel-name"; nm.textContent = o.n;
    var meta = document.createElement("div"); meta.className = "pd-rel-meta";
    meta.textContent = (roleLabel(o.r) || t.cats[o.c] || o.c) + (o.ax ? " · " + axleLabel(o.ax) : "") + " · " + priceStr(o.p);
    var review = document.createElement("span");
    review.className = "pd-rel-review";
    review.textContent = t.compat_review;
    info.appendChild(nm); info.appendChild(meta); info.appendChild(review);
    var add = document.createElement("button");
    add.type = "button"; add.className = "btn btn-outline pd-rel-add"; add.textContent = t.pd_add;
    add.disabled = !o.p;
    add.addEventListener("click", function (e) { e.stopPropagation(); addToCart(o, add); });
    li.appendChild(thumb); li.appendChild(info); li.appendChild(add);
    /* Klick op d'Zeil -> op dee Produkt wiesselen */
    li.addEventListener("click", function () { openProduct(o); });
    return li;
  }

  /* ---------- Combobox (Textfeld + filterbar Lëscht) ---------- */
  function makeCombo(inputId, listId, getOptions, onChoose) {
    var input = $(inputId), listEl = $(listId);
    if (!input || !listEl) return;
    var active = -1, opts = [];
    function close() { listEl.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; }
    function open() { listEl.hidden = false; input.setAttribute("aria-expanded", "true"); }
    function paint() {
      var q = input.value.trim().toLowerCase();
      opts = getOptions().filter(function (o) { return !q || o.toLowerCase().indexOf(q) !== -1; });
      listEl.innerHTML = "";
      opts.slice(0, 200).forEach(function (o) {
        var li = document.createElement("li");
        li.className = "combo-opt";
        li.setAttribute("role", "option");
        li.textContent = o;
        li.addEventListener("mousedown", function (e) {
          e.preventDefault();
          input.value = o; onChoose(o); close();
        });
        listEl.appendChild(li);
      });
      if (opts.length) open(); else close();
    }
    input.addEventListener("focus", paint);
    input.addEventListener("input", function () { onChoose(input.value); paint(); });
    input.addEventListener("keydown", function (e) {
      if (listEl.hidden) return;
      var items = listEl.querySelectorAll("li");
      if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, items.length - 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); }
      else if (e.key === "Enter") { e.preventDefault(); if (items[active]) { input.value = items[active].textContent; onChoose(input.value); close(); } return; }
      else if (e.key === "Escape") { close(); return; }
      items.forEach(function (it, i) { it.classList.toggle("active", i === active); });
      if (items[active]) items[active].scrollIntoView({ block: "nearest" });
    });
    input.addEventListener("blur", function () { setTimeout(close, 120); });
  }
  function uniqueSorted(values, numericDesc) {
    var seen = {};
    var out = values.filter(function (v) {
      if (v == null || seen[v]) return false;
      seen[v] = true;
      return true;
    });
    return out.sort(numericDesc
      ? function (a, b) { return parseInt(b, 10) - parseInt(a, 10); }
      : function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); });
  }
  function fitsForSelection(level) {
    var bi = MAKE_IDX[state.brand];
    return ALL_FITS.filter(function (x) {
      if (!state.brand || x[0] !== bi) return false;
      if (level > 0 && state.model && x[1] !== state.model) return false;
      if (level > 1 && state.generation && generationLabel(x) !== state.generation) return false;
      if (level > 2 && state.year && !yearFits(x, state.year)) return false;
      return true;
    });
  }
  function generationOptions() {
    return uniqueSorted(fitsForSelection(1).map(generationLabel)).filter(function (o) { return o !== "—"; });
  }
  function yearOptions() {
    var years = [];
    fitsForSelection(2).forEach(function (x) {
      var from = x[5] || 1990;
      var to = x[6] || new Date().getFullYear();
      for (var y = to; y >= from; y--) years.push(String(y));
    });
    return uniqueSorted(years, true);
  }
  function engineOptions() {
    return uniqueSorted(fitsForSelection(3).map(engineLabel)).filter(function (o) { return o !== "—"; });
  }
  function setVehicleField(id, enabled, clear) {
    var el = $(id);
    if (!el) return;
    el.disabled = !enabled;
    if (clear) el.value = "";
  }
  function updateVehicleButton() {
    var btn = $("btn-veh-search");
    // Mark + Modell duergeet fir ze sichen; Baurei/Baujoer/Motor si fräiwëlleg fir d'verfeinerung
    if (btn) btn.disabled = !(state.brand && state.model);
  }
  function resetVehicleAfter(step) {
    if (step < 1) { state.model = ""; setVehicleField("veh-model", !!state.brand, true); }
    if (step < 2) { state.generation = ""; setVehicleField("veh-generation", !!state.model, true); }
    if (step < 3) { state.year = ""; setVehicleField("veh-year", !!state.generation, true); }
    if (step < 4) { state.engine = ""; setVehicleField("veh-engine", !!state.year, true); }
    updateVehicleButton();
  }
  function initCombos() {
    makeCombo("veh-brand", "list-brand",
      function () { return Object.keys(BRANDS).sort(function (a, b) { return a.localeCompare(b); }); },
      function (val) {
        state.brand = BRANDS[val] ? val : "";
        resetVehicleAfter(0);
      });
    makeCombo("veh-model", "list-model",
      function () { return state.brand && BRANDS[state.brand] ? BRANDS[state.brand] : []; },
      function (val) {
        var ms = state.brand && BRANDS[state.brand] ? BRANDS[state.brand] : [];
        state.model = ms.indexOf(val) !== -1 ? val : "";
        resetVehicleAfter(1);
      });
    makeCombo("veh-generation", "list-generation", generationOptions,
      function (val) {
        state.generation = generationOptions().indexOf(val) !== -1 ? val : "";
        resetVehicleAfter(2);
      });
    makeCombo("veh-year", "list-year", yearOptions,
      function (val) {
        state.year = yearOptions().indexOf(val) !== -1 ? val : "";
        resetVehicleAfter(3);
      });
    makeCombo("veh-engine", "list-engine", engineOptions,
      function (val) {
        state.engine = engineOptions().indexOf(val) !== -1 ? val : "";
        updateVehicleButton();
      });
    resetVehicleAfter(0);
  }

  /* ---------- Warekuerf + Mollie-Checkout ---------- */
  var toastTimer = null;
  function reduceMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function bumpBadge() {
    var tg = $("cart-toggle");
    if (!tg) return;
    tg.classList.remove("bump");
    void tg.offsetWidth;
    tg.classList.add("bump");
    setTimeout(function () { tg.classList.remove("bump"); }, 520);
  }
  var CAR_SVG =
    '<svg viewBox="0 0 132 60" width="76" height="35" aria-hidden="true">' +
    '<defs>' +
    '<linearGradient id="gkBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff616c"/><stop offset=".45" stop-color="#e11f2d"/><stop offset="1" stop-color="#9c111b"/></linearGradient>' +
    '<linearGradient id="gkGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d7ecfa"/><stop offset="1" stop-color="#5c7f98"/></linearGradient>' +
    '<radialGradient id="gkRim" cx=".42" cy=".4" r=".62"><stop offset="0" stop-color="#f2f5f8"/><stop offset=".5" stop-color="#aeb8c1"/><stop offset="1" stop-color="#3e474f"/></radialGradient>' +
    '<linearGradient id="gkGloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    "</defs>" +
    '<ellipse cx="66" cy="55" rx="52" ry="4.5" fill="rgba(0,0,0,.28)"/>' +
    '<path d="M6 25 h20 v3.2 H6 z" fill="#151f29"/><rect x="7" y="28" width="3.4" height="7" rx="1" fill="#151f29"/>' +
    '<path d="M10 44 L11 30 Q12 27 17 26 L41 25 Q49 14 67 14 L83 15 Q94 17 100 26 L118 30 Q125 31 124 39 L123 44 Z" fill="url(#gkBody)"/>' +
    '<path d="M12 44 L123 44 L122 40 L13 40 Z" fill="#7d0f16" opacity=".55"/>' +
    '<path d="M45 25 Q52 17 66 17 L80 18 Q89 20 94 26 L88 26 L74 20 L67 20 Z" fill="url(#gkGlass)"/>' +
    '<path d="M62 18 L63 26 L60 26 L59 18 Z" fill="#2b3947" opacity=".6"/>' +
    '<path d="M16 31 Q60 27 118 33" stroke="url(#gkGloss)" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
    '<path d="M119 33 q4 .5 3.6 4 l-4 -1 z" fill="#ffe9a8"/><rect x="9.6" y="31" width="3.2" height="4" rx="1" fill="#ff9aa0"/>' +
    '<g><circle cx="36" cy="45" r="12" fill="#10161d"/><circle cx="36" cy="45" r="11.3" fill="none" stroke="#2a333c" stroke-width="1.3"/><circle cx="36" cy="45" r="6.6" fill="url(#gkRim)"/>' +
    '<g stroke="#39424b" stroke-width="1.1"><line x1="36" y1="45" x2="36" y2="38.7"/><line x1="36" y1="45" x2="41.3" y2="48"/><line x1="36" y1="45" x2="41.3" y2="41.9"/><line x1="36" y1="45" x2="30.7" y2="48"/><line x1="36" y1="45" x2="30.7" y2="41.9"/></g>' +
    '<circle cx="36" cy="45" r="1.7" fill="#59636c"/></g>' +
    '<g><circle cx="98" cy="45" r="12" fill="#10161d"/><circle cx="98" cy="45" r="11.3" fill="none" stroke="#2a333c" stroke-width="1.3"/><circle cx="98" cy="45" r="6.6" fill="url(#gkRim)"/>' +
    '<g stroke="#39424b" stroke-width="1.1"><line x1="98" y1="45" x2="98" y2="38.7"/><line x1="98" y1="45" x2="103.3" y2="48"/><line x1="98" y1="45" x2="103.3" y2="41.9"/><line x1="98" y1="45" x2="92.7" y2="48"/><line x1="98" y1="45" x2="92.7" y2="41.9"/></g>' +
    '<circle cx="98" cy="45" r="1.7" fill="#59636c"/></g>' +
    "</svg>";
  function spawnPuff(x, y) {
    var sz = 16 + Math.random() * 12;
    var p = document.createElement("div");
    p.className = "fly-puff";
    p.style.width = p.style.height = sz + "px";
    p.style.left = x - sz / 2 + "px";
    p.style.top = y - sz / 2 + "px";
    document.body.appendChild(p);
    var drift = -14 - Math.random() * 16;
    var rot = (Math.random() * 40 - 20).toFixed(0);
    p.animate(
      [
        { transform: "translateY(0px) scale(0.45) rotate(0deg)", opacity: 0.7 },
        { transform: "translateY(" + drift * 0.5 + "px) scale(1.7) rotate(" + rot / 2 + "deg)", opacity: 0.5, offset: 0.45 },
        { transform: "translateY(" + drift + "px) scale(3) rotate(" + rot + "deg)", opacity: 0 },
      ],
      { duration: 1150, easing: "ease-out" }
    ).onfinish = function () { p.remove(); };
  }
  function ringPulse(el) {
    var r = el.getBoundingClientRect();
    var ring = document.createElement("div");
    ring.className = "cart-ring";
    ring.style.left = r.left + r.width / 2 + "px";
    ring.style.top = r.top + r.height / 2 + "px";
    document.body.appendChild(ring);
    ring.animate(
      [{ transform: "translate(-50%,-50%) scale(0.4)", opacity: 0.7 }, { transform: "translate(-50%,-50%) scale(2.5)", opacity: 0 }],
      { duration: 650, easing: "ease-out" }
    ).onfinish = function () { ring.remove(); };
  }
  function flyToCart(srcEl) {
    var cartBtn = $("cart-toggle");
    var canAnimate = typeof document.body.animate === "function";
    if (!cartBtn || !srcEl || reduceMotion() || !canAnimate) { bumpBadge(); return; }
    var s = srcEl.getBoundingClientRect(), t = cartBtn.getBoundingClientRect();
    var startX = s.left + s.width / 2, startY = s.top + s.height / 2;
    var dx = t.left + t.width / 2 - startX, dy = t.top + t.height / 2 - startY;
    spawnPuff(startX, startY);
    var car = document.createElement("div");
    car.className = "fly-car";
    car.innerHTML = CAR_SVG;
    car.style.left = startX - 38 + "px";
    car.style.top = startY - 17 + "px";
    document.body.appendChild(car);
    var anim = car.animate(
      [
        { transform: "translate(0px,0px) rotate(-3deg) scale(1)", opacity: 1, offset: 0 },
        { transform: "translate(" + dx * 0.3 + "px," + (dy * 0.3 - 80) + "px) rotate(-10deg) scale(1.15)", opacity: 1, offset: 0.35 },
        { transform: "translate(" + dx * 0.62 + "px," + (dy * 0.62 - 40) + "px) rotate(2deg) scale(1)", opacity: 1, offset: 0.68 },
        { transform: "translate(" + dx * 0.86 + "px," + (dy * 0.86 - 8) + "px) rotate(9deg) scale(0.6)", opacity: 1, offset: 0.9 },
        { transform: "translate(" + dx + "px," + dy + "px) rotate(16deg) scale(0.14)", opacity: 0.1, offset: 1 },
      ],
      { duration: 1700, easing: "cubic-bezier(.34,.02,.3,1)" }
    );
    [120, 320, 540, 780, 1020, 1280].forEach(function (ms) {
      setTimeout(function () {
        if (!car.isConnected) return;
        var r = car.getBoundingClientRect();
        spawnPuff(r.left + r.width / 2 - dx * 0.06, r.top + r.height / 2 + 8);
      }, ms);
    });
    anim.onfinish = function () {
      car.remove();
      bumpBadge();
      ringPulse(cartBtn);
    };
  }
  function loadCart() {
    try { var a = JSON.parse(localStorage.getItem("gk_cart") || "[]"); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function saveCart() { try { localStorage.setItem("gk_cart", JSON.stringify(cart)); } catch (e) {} }
  function cartCount() { return cart.reduce(function (s, l) { return s + l.qty; }, 0); }
  function cartTotal() { return cart.reduce(function (s, l) { return s + l.cents * l.qty; }, 0); }
  function addToCart(p, srcEl) {
    if (!p.p) return;
    var line = cart.filter(function (l) { return l.id === p.i; })[0];
    if (line) line.qty++;
    else cart.push({ id: p.i, name: p.n, cents: grossCents(p.p), qty: 1 });
    saveCart(); renderCart();
    flyToCart(srcEl);
    var t = tr(), el = $("cart-toast");
    if (el) {
      el.textContent = "🛒 " + t.added.replace("{n}", p.n) + "  (" + cartCount() + ")";
      el.hidden = false; el.classList.add("show");
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2600);
    }
  }
  function setQty(id, d) {
    var line = cart.filter(function (l) { return l.id === id; })[0];
    if (!line) return;
    line.qty += d;
    if (line.qty <= 0) cart = cart.filter(function (l) { return l.id !== id; });
    saveCart(); renderCart();
  }
  function removeLine(id) { cart = cart.filter(function (l) { return l.id !== id; }); saveCart(); renderCart(); }
  function renderCart() {
    var t = tr(), badge = $("cart-count"), n = cartCount();
    if (badge) { badge.textContent = n; badge.hidden = n === 0; }
    var lines = $("cart-lines"), empty = $("cart-empty"), foot = $("cart-foot");
    if (!lines) return;
    lines.innerHTML = "";
    if (!cart.length) { if (empty) empty.hidden = false; if (foot) foot.hidden = true; return; }
    if (empty) empty.hidden = true;
    if (foot) foot.hidden = false;
    cart.forEach(function (l) {
      var li = document.createElement("li");
      li.className = "cart-line";
      li.innerHTML =
        '<div><div class="cart-line-name">' + l.name + "</div>" +
        '<div class="cart-line-price">' + centsToStr(l.cents) + "</div>" +
        '<div class="cart-qty"><button type="button" data-act="dec" data-id="' + l.id + '" aria-label="−">−</button>' +
        "<span>" + l.qty + "</span>" +
        '<button type="button" data-act="inc" data-id="' + l.id + '" aria-label="+">+</button></div></div>' +
        '<div class="cart-line-total">' + centsToStr(l.cents * l.qty) + "</div>" +
        '<button type="button" class="cart-line-remove" data-act="rm" data-id="' + l.id + '">' + t.cart_remove + "</button>";
      lines.appendChild(li);
    });
    setTxt("cart-total", centsToStr(cartTotal()));
  }
  function openCart() {
    var d = $("cart-drawer"), b = $("cart-backdrop"), tg = $("cart-toggle");
    if (b) b.hidden = false;
    if (d) d.hidden = false;
    renderCart();
    requestAnimationFrame(function () {
      if (d) d.classList.add("show");
      if (b) b.classList.add("show");
    });
    if (tg) tg.setAttribute("aria-expanded", "true");
  }
  function closeCart() {
    var d = $("cart-drawer"), b = $("cart-backdrop"), tg = $("cart-toggle");
    if (d) d.classList.remove("show");
    if (b) b.classList.remove("show");
    if (tg) tg.setAttribute("aria-expanded", "false");
    setTimeout(function () {
      if (d && !d.classList.contains("show")) d.hidden = true;
      if (b && !b.classList.contains("show")) b.hidden = true;
    }, 300);
  }
  function checkout() {
    var t = tr(), st = $("cart-status"), btn = $("cart-checkout"), legal = $("cart-legal");
    if (!cart.length) return;
    if (!legal || !legal.checked) {
      if (st) { st.className = "form-status err"; st.textContent = t.legal_required; }
      if (legal) legal.focus();
      return;
    }
    if (st) { st.className = "form-status"; st.textContent = t.cart_redirect; }
    if (btn) btn.disabled = true;
    fetch(PAYMENT_ENDPOINT + "/create-payment", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ items: cart.map(function (l) { return { id: l.id, qty: l.qty }; }), locale: lang() }),
    })
      .then(function (r) { if (!r.ok) throw new Error("http"); return r.json(); })
      .then(function (data) {
        if (data && data.checkoutUrl) window.location.href = data.checkoutUrl;
        else throw new Error("no-url");
      })
      .catch(function () {
        if (st) { st.className = "form-status err"; st.textContent = t.cart_err; }
        if (btn) btn.disabled = false;
      });
  }

  /* ---------- Statics ---------- */
  function applyStatics() {
    var t = tr();
    setTxt("shop-eyebrow", t.eyebrow);
    setTxt("shop-title", t.title);
    setTxt("shop-sub", t.sub);
    setTxt("lbl-tab-artikel", t.tab_artikel);
    setTxt("lbl-tab-fahrzeug", t.tab_fahrzeug);
    setTxt("lbl-btn-text", t.btn_text);
    setTxt("lbl-btn-veh", t.btn_veh);
    var q = $("q-text"); if (q) q.placeholder = t.ph_text;
    var vb = $("veh-brand"); if (vb) vb.placeholder = t.ph_brand;
    var vm = $("veh-model"); if (vm) vm.placeholder = t.ph_model;
    var vg = $("veh-generation"); if (vg) vg.placeholder = t.ph_generation;
    var vy = $("veh-year"); if (vy) vy.placeholder = t.ph_year;
    var ve = $("veh-engine"); if (ve) ve.placeholder = t.ph_engine;
    setTxt("veh-filter-note", t.veh_note);
    setTxt("shop-preview-title", t.preview_title);
    setTxt("shop-preview-text", t.preview_text);
    setTxt("label-veh-brand", t.label_brand);
    setTxt("label-veh-model", t.label_model);
    setTxt("label-veh-generation", t.label_generation);
    setTxt("label-veh-year", t.label_year);
    setTxt("label-veh-engine", t.label_engine);
    var searchInput = $("q-text"); if (searchInput) searchInput.setAttribute("aria-label", t.search_label);
    var mfGroup = $("mf-chips"); if (mfGroup) mfGroup.setAttribute("aria-label", t.mf_label);
    var catGroup = $("cat-chips"); if (catGroup) catGroup.setAttribute("aria-label", t.cat_label);
    var cartClose = $("cart-close"); if (cartClose) cartClose.setAttribute("aria-label", t.close_label);
    var productClose = $("pd-close"); if (productClose) productClose.setAttribute("aria-label", t.close_label);
    setTxt("shop-note-title", t.note_title);
    setTxt("shop-note-text", t.note_text);
    setTxt("shop-note-cta", t.note_cta);
    setTxt("shop-vat-note", t.vat);
    var s = SOON[lang()] || SOON.lb;
    setTxt("soon-eyebrow", s.eyebrow);
    setTxt("soon-title", s.title);
    setTxt("soon-text", s.text);
    setTxt("soon-cta", s.cta);
    setTxt("soon-back", s.back);
    setTxt("dev-badge-txt", s.dev);
    var dh = document.querySelector("#shop-dev-badge a");
    if (dh) dh.textContent = s.hide;
    setTxt("cart-title", t.cart_title);
    setTxt("cart-empty", t.cart_empty);
    setTxt("cart-total-label", t.cart_total);
    setTxt("cart-checkout", t.cart_checkout);
    setTxt("cart-note", t.cart_note);
    setTxt("cart-legal-text", t.legal_text);
    setTxt("cart-legal-link", t.legal_link);
    setTxt("cart-privacy-link", t.privacy_link);
    setTxt("shop-legal-eyebrow", t.legal_eyebrow);
    setTxt("shop-legal-title", t.legal_title);
    setTxt("shop-legal-price-title", t.legal_price_title);
    setTxt("shop-legal-price-text", t.legal_price_text);
    setTxt("shop-legal-fit-title", t.legal_fit_title);
    setTxt("shop-legal-fit-text", t.legal_fit_text);
    setTxt("shop-legal-rights-title", t.legal_rights_title);
    setTxt("shop-legal-rights-text", t.legal_rights_text);
    setTxt("shop-legal-more", t.legal_more);
    setTxt("filter-axle-label", t.filter_axle);
    setTxt("filter-approval-label", t.filter_approval);
    setTxt("filter-sort-label", t.filter_sort);
    setTxt("filter-reset", t.filter_reset);
    setTxt("favorites-toggle", "♡ " + t.favorites);
    setTxt("shop-guide-eyebrow", t.guide_eyebrow);
    setTxt("shop-guide-title", t.guide_title);
    setTxt("guide-dba-street", t.guide_dba_street);
    setTxt("guide-dba-race", t.guide_dba_race);
    setTxt("guide-remus", t.guide_remus);
    setTxt("shop-trust-title", t.trust_title);
    setTxt("shop-trust-text", t.trust_text);
    setTxt("shop-trust-cta", t.trust_cta);
    updateCompareBar();
    var axle = $("filter-axle"), approval = $("filter-approval"), sort = $("filter-sort");
    if (axle) { axle.options[0].textContent=t.filter_axle_all; axle.options[1].textContent=t.axle_f; axle.options[2].textContent=t.axle_r; axle.value=state.axle; }
    if (approval) { approval.options[0].textContent=t.filter_approval_all; approval.options[1].textContent=t.filter_road; approval.options[2].textContent=t.filter_race; approval.value=state.approval; }
    if (sort) { sort.options[0].textContent=t.sort_name; sort.options[1].textContent=t.sort_price_asc; sort.options[2].textContent=t.sort_price_desc; sort.value=state.sort; }
    var status = $("cart-status"); if (status) { status.textContent = ""; status.className = "form-status"; }
    var toast = $("cart-toast"); if (toast) { toast.hidden = true; toast.classList.remove("show"); }
    renderCart();
  }

  /* ---------- Tabs & Events ---------- */
  function switchTab(mode) {
    var isArt = mode === "artikel";
    $("tab-artikel").classList.toggle("active", isArt);
    $("tab-artikel").setAttribute("aria-selected", isArt);
    $("tab-fahrzeug").classList.toggle("active", !isArt);
    $("tab-fahrzeug").setAttribute("aria-selected", !isArt);
    $("panel-artikel").hidden = !isArt;
    $("panel-fahrzeug").hidden = isArt;
  }
  function doTextSearch() {
    state.mode = "search"; state.q = ($("q-text").value || "").trim(); state.cat = "all";
    ensureDba(function () { if (state.mode === "search") render(); });
    render(); scrollToCatalog();
  }
  function doVehSearch() {
    if (!(state.brand && state.model)) return; // Mark + Modell duergeet
    state.mode = "vehicle"; state.cat = "all";
    ensureDba(function () { if (state.mode === "vehicle") render(); });
    render(); scrollToCatalog();
  }
  function scrollToCatalog() { var el = $("shop-catalog"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }

  function bind() {
    $("tab-artikel").addEventListener("click", function () { switchTab("artikel"); });
    $("tab-fahrzeug").addEventListener("click", function () { switchTab("fahrzeug"); });
    $("btn-text-search").addEventListener("click", doTextSearch);
    $("q-text").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); doTextSearch(); } });
    $("q-text").addEventListener("input", function () { if (!this.value) { state.mode = "all"; state.q = ""; render(); } });
    $("btn-veh-search").addEventListener("click", doVehSearch);
    ["filter-axle", "filter-approval", "filter-sort"].forEach(function (id) {
      var el = $(id); if (!el) return;
      el.addEventListener("change", function () {
        if (id === "filter-axle") state.axle = el.value;
        if (id === "filter-approval") state.approval = el.value;
        if (id === "filter-sort") state.sort = el.value;
        visibleCount = PAGE_SIZE; saveState(); render();
      });
    });
    var reset = $("filter-reset"); if (reset) reset.addEventListener("click", function () { state.axle="all"; state.approval="all"; state.sort="name"; state.favoritesOnly=false; visibleCount=PAGE_SIZE; applyStatics(); render(); });
    var favs = $("favorites-toggle"); if (favs) favs.addEventListener("click", function () { state.favoritesOnly=!state.favoritesOnly; visibleCount=PAGE_SIZE; render(); });
    var more = $("shop-load-more"); if (more) more.addEventListener("click", function () { visibleCount += PAGE_SIZE; render(); });
    var filterToggle=$("shop-filter-mobile-toggle"); if(filterToggle)filterToggle.addEventListener("click",function(){var open=this.getAttribute("aria-expanded")!=="true";this.setAttribute("aria-expanded",open?"true":"false");$("shop-filterbar").classList.toggle("is-mobile-open",open);});
    var vehicleChange=$("shop-vehicle-change"); if(vehicleChange)vehicleChange.addEventListener("click",function(){switchTab("fahrzeug");$("tab-fahrzeug").scrollIntoView({behavior:"smooth",block:"center"});});
    var vehicleClear=$("shop-vehicle-clear"); if(vehicleClear)vehicleClear.addEventListener("click",function(){state.mode="all";state.brand="";state.model="";state.generation="";state.year="";state.engine="";["brand","model","generation","year","engine"].forEach(function(k){var e=$("veh-"+k);if(e)e.value="";});visibleCount=PAGE_SIZE;saveState();render();});
    var compareOpen=$("shop-compare-open"); if(compareOpen) compareOpen.addEventListener("click",openCompare);
    var compareClear=$("shop-compare-clear"); if(compareClear) compareClear.addEventListener("click",function(){compareIds=[];updateCompareBar();render();});
    var ct = $("cart-toggle"); if (ct) ct.addEventListener("click", openCart);
    var cc = $("cart-close"); if (cc) cc.addEventListener("click", closeCart);
    var cb = $("cart-backdrop"); if (cb) cb.addEventListener("click", closeCart);
    var ck = $("cart-checkout"); if (ck) ck.addEventListener("click", checkout);
    var cl = $("cart-lines");
    if (cl) cl.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return;
      var id = b.getAttribute("data-id"), act = b.getAttribute("data-act");
      if (act === "inc") setQty(id, 1); else if (act === "dec") setQty(id, -1); else if (act === "rm") removeLine(id);
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { if(inquiryEls&&!inquiryEls.modal.hidden)inquiryEls.close(); else { if(activeCompareDialog)activeCompareDialog.close(); closeCart(); closeProduct(); } } if(e.key==="Tab"&&activeCompareDialog){var fs=activeCompareDialog.dialog.querySelectorAll('button,a,[tabindex]:not([tabindex="-1"])');if(!fs.length)return;var first=fs[0],last=fs[fs.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}} });
    document.querySelectorAll(".lang-select").forEach(function (sel) {
      sel.addEventListener("change", function () { setTimeout(function () { applyStatics(); render(); }, 0); });
    });
  }

  /* ---------- DBA spéit nolueden (Performance) ----------
     REMUS kënnt direkt mat shop-data.js. DBA (méi grouss) gëtt no am Idle
     nogelueden, respektiv op Ufro wann een eppes mécht wat DBA brauch. */
  var dbaRequested = false;
  var dbaCallbacks = [];
  window.__onDbaLoaded = function () {
    buildIndexes();
    var dcb = dbaCallbacks.slice(); dbaCallbacks = [];
    render();
    dcb.forEach(function (cb) { try { cb(); } catch (e) {} });
    // Falls en DBA-Produkt iwwer ?product= opgeruff gouf iere DBA do war
    var rp = new URLSearchParams(location.search).get("product");
    if (rp && /^DBA-/.test(rp) && !document.querySelector(".product-dialog[open], .product-modal:not([hidden])")) {
      var f = PRODUCTS.filter(function (p) { return p.i === rp; })[0];
      if (f) { try { openProduct(f); } catch (e) {} }
    }
  };
  function ensureDba(cb) {
    if (window.SHOP_DBA_LOADED) { if (cb) cb(); return; }
    if (cb) dbaCallbacks.push(cb);
    if (dbaRequested) return;
    dbaRequested = true;
    var s = document.createElement("script");
    s.src = "shop-data-dba.js?v=4";
    s.async = true;
    s.onerror = function () { dbaRequested = false; };
    document.head.appendChild(s);
  }
  function scheduleDbaPreload() {
    var go = function () { ensureDba(); };
    if (window.requestIdleCallback) window.requestIdleCallback(go, { timeout: 4000 });
    else setTimeout(go, 1200);
  }

  function init() {
    /* De Shop-Service-Worker bleift bis zum ëffentleche Shop-Start aus.
       E Scope op "/" kéint soss och Homepage a Location mat ale Fichiere
       kontrolléieren. */
    cart = loadCart();
    restoreState();
    applyStatics();
    initCombos();
    ["brand","model","generation","year","engine"].forEach(function (key) { var el=$("veh-"+key); if (el) el.value=state[key] || ""; });
    updateVehicleButton();
    bind();
    render();
    renderCart();
    var requestedProduct=new URLSearchParams(location.search).get("product"); if(requestedProduct){var found=PRODUCTS.filter(function(p){return p.i===requestedProduct;})[0];if(found)openProduct(found);else if(/^DBA-/.test(requestedProduct))ensureDba();}
    window.addEventListener("pagehide", saveState);
    var savedScroll = 0; try { savedScroll = parseInt(sessionStorage.getItem("gk_shop_scroll") || "0", 10); } catch (e) {}
    if (savedScroll) requestAnimationFrame(function () { window.scrollTo(0, savedScroll); });
    scheduleDbaPreload();
    var loadRemusDetails = function () { ensureRemusParts(); };
    if (window.requestIdleCallback) window.requestIdleCallback(loadRemusDetails, { timeout: 3000 });
    else setTimeout(loadRemusDetails, 1800);
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
