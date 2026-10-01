/* Autoservice Bettenduerf — Shop (REMUS Sport Exhausts), méisproocheg.
   Katalog kënnt aus shop-data.js (SHOP_PRODUCTS / SHOP_BRANDS / SHOP_MAKES …).
   Produiten mat Bild, Lagerstatus an EC-Zoulassung. Bezuelung iwwer Mollie. */
(function () {
  "use strict";

  var PAYMENT_ENDPOINT = "https://mollie-pay.autoservicebettenduerf.lu";
  var RENDER_CAP = 48;

  var PRODUCTS = window.SHOP_PRODUCTS || [];
  var BRANDS = window.SHOP_BRANDS || {};
  var MAKES = window.SHOP_MAKES || [];
  var ENGINES = window.SHOP_ENGINES || [];
  var VARIANTS = window.SHOP_VARIANTS || [];
  var GENS = window.SHOP_GENS || [];
  var IMAGES = window.SHOP_IMAGES || [];
  var IMGBASE = (window.SHOP_META && window.SHOP_META.imgbase) || "";
  var cart = [];

  /* makeName -> index (fir Fitment-Filter) */
  var MAKE_IDX = {};
  MAKES.forEach(function (m, i) { MAKE_IDX[m] = i; });

  var state = { mode: "all", q: "", cat: "all", brand: "", model: "", generation: "", year: "", engine: "" };
  var ALL_FITS = [];
  PRODUCTS.forEach(function (p) { p.f.forEach(function (fit) { ALL_FITS.push(fit); }); });

  /* ---------- Iwwersetzungen ---------- */
  var T = {
    lb: {
      eyebrow: "Onlineshop", title: "Autodeeler-Shop",
      sub: "REMUS Sportauspuffanlagen mat Bild, Präis a Lagerstatus. Wiel däi Won oder sich en Artikel – DBA-Bremsen kommen nach.",
      tab_artikel: "Artikel", tab_fahrzeug: "Won",
      ph_text: "Bezeechnung oder Artikelnummer …", btn_text: "Sichen",
      ph_brand: "Marke wielen oder aginn", ph_model: "Modell wielen oder aginn",
      btn_veh: "Passend Deeler fannen",
      cats: { all: "Alles", system: "Sportauspuffanlagen", sound: "Sound Controller", tail: "Endrohren", adapter: "Adapter" },
      info_all: "{n} Produiten", info_more: "{n} Produiten (déi éischt {c} gewisen – wiel däi Won oder verfeinert d’Sich)",
      info_search: "{n} Resultater fir „{q}“", info_veh: "{n} Produiten fir {v}",
      info_cat: "{n} · {c}",
      empty: "Keng Produiten fonnt. Rufft eis un – mir fannen dat richtegt Deel.",
      fits: "Passt:", artnr: "Réf.", add: "An de Kuerf", fits_on: "Passt op:", related: "Dobaibestellen", related_sub: "Passend Deeler fir Äert Gefier – fir e komplett System", rel_none: "Keng passend Zousatzdeeler fonnt.", pd_add: "+ derbäi", pd_close: "Zoumaachen", roles: { system: "Komplett-System", catback: "Cat-Back", axleback: "Axle-Back", slipon: "Slip-On", rear: "Endschalldämpfer", mid: "Mëttelrouer", front: "Front-Schalldämpfer", downpipe: "Downpipe", header: "Krümmer", tail: "Endrohren", sound: "Sound Controller", adapter: "Adapter / Verbindung" },
      added: "„{n}“ an de Kuerf geluecht", vat: "All Präisser inkl. 17% TVA.",
      stock_in: "Op Lager", stock_order: "Op Ufro",
      ec_ok: "EC-Zoulassung", ec_some: "EC je no Gefier", ec_no: "Rennsport · ouni EC",
      kw: "kW", from: "zanter",
      note_title: "Deel net fonnt?",
      note_text: "Mir fannen Iech déi richteg REMUS-Anlag fir Äre Won – rufft un oder schéckt eng Ufro.",
      note_cta: "Deel ufroen",
      cart_title: "Äre Kuerf", cart_empty: "Äre Kuerf ass eidel.", cart_total: "Total",
      cart_checkout: "Bezuelen", cart_remove: "Ewechhuelen",
      cart_note: "Sécher bezuelen iwwer Mollie – Kaart, Wero, Revolut oder Iwwerweisung. Präisser inkl. 17% TVA.",
      cart_redirect: "Gëtt op d’Bezuelung weidergeleet …",
      cart_err: "D’Bezuelung ass de Moment net erreechbar. Probéiert w.e.g. méi spéit oder rufft eis un.",
    },
    de: {
      eyebrow: "Onlineshop", title: "Autoteile-Shop",
      sub: "REMUS Sportauspuffanlagen mit Bild, Preis und Lagerstatus. Fahrzeug wählen oder Artikel suchen – DBA-Bremsen folgen.",
      tab_artikel: "Artikel", tab_fahrzeug: "Fahrzeug",
      ph_text: "Bezeichnung oder Artikelnummer …", btn_text: "Suchen",
      ph_brand: "Marke wählen oder eingeben", ph_model: "Modell wählen oder eingeben",
      btn_veh: "Passende Teile finden",
      cats: { all: "Alle", system: "Sportauspuffanlagen", sound: "Sound Controller", tail: "Endrohre", adapter: "Adapter" },
      info_all: "{n} Produkte", info_more: "{n} Produkte (erste {c} angezeigt – Fahrzeug wählen oder Suche verfeinern)",
      info_search: "{n} Ergebnisse für „{q}“", info_veh: "{n} Produkte für {v}",
      info_cat: "{n} · {c}",
      empty: "Keine Produkte gefunden. Rufen Sie uns an – wir finden das richtige Teil.",
      fits: "Passt:", artnr: "Ref.", add: "In den Warenkorb", fits_on: "Passt auf:", related: "Dazu bestellen", related_sub: "Passende Teile für Ihr Fahrzeug – für eine komplette Anlage", rel_none: "Kein passendes Zubehör gefunden.", pd_add: "+ dazu", pd_close: "Schließen", roles: { system: "Komplettanlage", catback: "Cat-Back", axleback: "Axle-Back", slipon: "Slip-On", rear: "Endschalldämpfer", mid: "Mittelrohr", front: "Vorschalldämpfer", downpipe: "Downpipe", header: "Krümmer", tail: "Endrohre", sound: "Sound Controller", adapter: "Adapter / Verbindung" },
      added: "„{n}“ in den Warenkorb gelegt", vat: "Alle Preise inkl. 17% MwSt.",
      stock_in: "Auf Lager", stock_order: "Auf Anfrage",
      ec_ok: "EG-Zulassung", ec_some: "EG je nach Fahrzeug", ec_no: "Rennsport · ohne EG",
      kw: "kW", from: "ab",
      note_title: "Teil nicht gefunden?",
      note_text: "Wir finden die passende REMUS-Anlage für Ihr Fahrzeug – rufen Sie an oder senden Sie eine Anfrage.",
      note_cta: "Teil anfragen",
      cart_title: "Ihr Warenkorb", cart_empty: "Ihr Warenkorb ist leer.", cart_total: "Gesamt",
      cart_checkout: "Bezahlen", cart_remove: "Entfernen",
      cart_note: "Sicher bezahlen über Mollie – Karte, Wero, Revolut oder Überweisung. Preise inkl. 17% MwSt.",
      cart_redirect: "Weiterleitung zur Bezahlung …",
      cart_err: "Die Bezahlung ist derzeit nicht erreichbar. Bitte später erneut versuchen oder anrufen.",
    },
    fr: {
      eyebrow: "Boutique", title: "Boutique de pièces",
      sub: "Lignes d’échappement sport REMUS avec photo, prix et disponibilité. Choisissez votre véhicule ou cherchez un article – freins DBA à venir.",
      tab_artikel: "Article", tab_fahrzeug: "Véhicule",
      ph_text: "Désignation ou numéro d’article …", btn_text: "Rechercher",
      ph_brand: "Choisir ou saisir la marque", ph_model: "Choisir ou saisir le modèle",
      btn_veh: "Trouver les pièces",
      cats: { all: "Tout", system: "Lignes d’échappement", sound: "Sound Controller", tail: "Sorties", adapter: "Adaptateurs" },
      info_all: "{n} produits", info_more: "{n} produits ({c} premiers affichés – choisissez votre véhicule ou affinez)",
      info_search: "{n} résultats pour « {q} »", info_veh: "{n} produits pour {v}",
      info_cat: "{n} · {c}",
      empty: "Aucun produit trouvé. Appelez-nous – nous trouvons la bonne pièce.",
      fits: "Compatible :", artnr: "Réf.", add: "Au panier", fits_on: "Compatible avec :", related: "À commander avec", related_sub: "Pièces compatibles pour votre véhicule – pour une ligne complète", rel_none: "Aucun accessoire compatible trouvé.", pd_add: "+ ajouter", pd_close: "Fermer", roles: { system: "Ligne complète", catback: "Cat-Back", axleback: "Axle-Back", slipon: "Slip-On", rear: "Silencieux arrière", mid: "Tube intermédiaire", front: "Silencieux avant", downpipe: "Downpipe", header: "Collecteur", tail: "Sorties", sound: "Sound Controller", adapter: "Adaptateur / raccord" },
      added: "« {n} » ajouté au panier", vat: "Tous les prix TTC (TVA 17% incluse).",
      stock_in: "En stock", stock_order: "Sur demande",
      ec_ok: "Homologation CE", ec_some: "CE selon véhicule", ec_no: "Compétition · sans CE",
      kw: "kW", from: "dès",
      note_title: "Pièce introuvable ?",
      note_text: "Nous trouvons la ligne REMUS adaptée à votre véhicule – appelez ou envoyez une demande.",
      note_cta: "Demander une pièce",
      cart_title: "Votre panier", cart_empty: "Votre panier est vide.", cart_total: "Total",
      cart_checkout: "Payer", cart_remove: "Retirer",
      cart_note: "Paiement sécurisé via Mollie – carte, Wero, Revolut ou virement. Prix TTC.",
      cart_redirect: "Redirection vers le paiement …",
      cart_err: "Le paiement est momentanément indisponible. Réessayez plus tard ou appelez-nous.",
    },
    en: {
      eyebrow: "Online shop", title: "Car parts shop",
      sub: "REMUS sport exhaust systems with photo, price and stock status. Pick your vehicle or search an article – DBA brakes coming.",
      tab_artikel: "Article", tab_fahrzeug: "Vehicle",
      ph_text: "Name or part number …", btn_text: "Search",
      ph_brand: "Choose or type make", ph_model: "Choose or type model",
      btn_veh: "Find matching parts",
      cats: { all: "All", system: "Exhaust systems", sound: "Sound Controller", tail: "Tail pipes", adapter: "Adapters" },
      info_all: "{n} products", info_more: "{n} products (first {c} shown – pick your vehicle or refine)",
      info_search: "{n} results for “{q}”", info_veh: "{n} products for {v}",
      info_cat: "{n} · {c}",
      empty: "No products found. Call us – we’ll find the right part.",
      fits: "Fits:", artnr: "Ref.", add: "Add to cart", fits_on: "Fits:", related: "Order together", related_sub: "Matching parts for your vehicle – to complete the system", rel_none: "No matching accessories found.", pd_add: "+ add", pd_close: "Close", roles: { system: "Full system", catback: "Cat-Back", axleback: "Axle-Back", slipon: "Slip-On", rear: "Rear silencer", mid: "Mid pipe", front: "Front silencer", downpipe: "Downpipe", header: "Header", tail: "Tail pipes", sound: "Sound Controller", adapter: "Adapter / link" },
      added: "“{n}” added to cart", vat: "All prices incl. 17% VAT.",
      stock_in: "In stock", stock_order: "On request",
      ec_ok: "EC approval", ec_some: "EC depends on vehicle", ec_no: "Race · no EC",
      kw: "kW", from: "from",
      note_title: "Part not found?",
      note_text: "We’ll find the right REMUS system for your car – call or send a request.",
      note_cta: "Request a part",
      cart_title: "Your cart", cart_empty: "Your cart is empty.", cart_total: "Total",
      cart_checkout: "Pay", cart_remove: "Remove",
      cart_note: "Secure payment via Mollie – card, Wero, Revolut or bank transfer. Prices incl. 17% VAT.",
      cart_redirect: "Redirecting to payment …",
      cart_err: "Payment is currently unavailable. Please try again later or call us.",
    },
  };

  /* ---------- "In Arbeit"-Säit ---------- */
  var SOON = {
    lb: { eyebrow: "Onlineshop", title: "Eise Shop ass an der Aarbecht",
      text: "Mir sinn amgaang, eisen Autodeeler-Shop opzebauen (REMUS Sportauspuffen, DBA-Bremsen geschwënn). Kuckt geschwënn erëm laanscht – oder kontaktéiert eis direkt.",
      cta: "Deel ufroen", back: "Zréck op d’Startsäit",
      dev: "Vorschau-Modus – Shop öffentlech nach „an Arbecht“", hide: "verstoppen" },
    de: { eyebrow: "Onlineshop", title: "Unser Shop ist in Arbeit",
      text: "Wir bauen gerade unseren Autoteile-Shop auf (REMUS Sportauspuffanlagen, DBA-Bremsen folgen). Schauen Sie bald wieder vorbei – oder kontaktieren Sie uns direkt.",
      cta: "Teil anfragen", back: "Zurück zur Startseite",
      dev: "Vorschau-Modus – Shop öffentlich noch „in Arbeit“", hide: "ausblenden" },
    fr: { eyebrow: "Boutique", title: "Notre boutique est en préparation",
      text: "Nous mettons en place notre boutique de pièces (échappements REMUS, freins DBA à venir). Revenez bientôt – ou contactez-nous directement.",
      cta: "Demander une pièce", back: "Retour à l’accueil",
      dev: "Mode aperçu – boutique encore « en construction »", hide: "masquer" },
    en: { eyebrow: "Online shop", title: "Our shop is in the works",
      text: "We’re building our car-parts shop (REMUS exhausts, DBA brakes coming). Check back soon – or contact us directly.",
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
    cart_note: "Sécher iwwer Mollie bezuelen. All Präisser enthalen 17% TVA.",
    cart_redirect: "Dir gitt op d’Bezuelung weidergeleet …",
    cart_err: "D’Bezuelung ass de Moment net erreechbar. Probéiert w.e.g. méi spéit nach eng Kéier oder rufft eis un.",
    legal_required: "Bestätegt w.e.g. d’Shop- a Verbraucherinformatiounen, ier Dir bestellt.",
    legal_text: "Ech hunn d’Shop- a Verbraucherinformatioune gelies an akzeptéieren, datt d’Bestellung bezuelungspflichteg ass.",
    legal_link: "Shop- a Verbraucherinformatiounen",
    privacy_link: "Dateschutz",
    legal_eyebrow: "Transparent bestellen",
    legal_title: "Wichteg Informatioune virun der Bestellung",
    legal_price_title: "Präisser",
    legal_price_text: "All ugewise Präisser enthalen 17% TVA. Méiglech Liwwer- oder Ofhuelkäschte ginn Iech virun der verbindtlecher Bestellung ugewisen.",
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
  function centsToStr(c) { return (c / 100).toFixed(2).replace(".", ",") + " €"; }
  var VAT_RATE = 0.17; // Lëtzebuerger TVA – direkt am ugewisene Präis abegraff
  function grossCents(net) { return Math.round(net * (1 + VAT_RATE)); }
  function priceStr(net) { return centsToStr(grossCents(net)); }
  function imgUrl(idx, w, h) {
    if (idx == null || idx < 0 || !IMAGES[idx]) return "";
    return IMGBASE + IMAGES[idx] + "?w=" + w + "&h=" + h + "&fit=crop&auto=format";
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
  function fitMatchesVehicle(x) {
    if (!state.brand || x[0] !== MAKE_IDX[state.brand]) return false;
    if (state.model && x[1] !== state.model) return false;
    if (state.generation && generationLabel(x) !== state.generation) return false;
    if (state.year && !yearFits(x, state.year)) return false;
    if (state.engine && engineLabel(x) !== state.engine) return false;
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

  /* ---------- Filter ---------- */
  function matches(p) {
    if (state.cat !== "all" && p.c !== state.cat) return false;
    if (state.mode === "search" && state.q) {
      var q = state.q.toLowerCase();
      if (p.n.toLowerCase().indexOf(q) !== -1) return true;
      if (p.i.toLowerCase().indexOf(q) !== -1) return true;
      return p.f.some(function (x) {
        if (makeName(x[0]).toLowerCase().indexOf(q) !== -1) return true;
        if ((x[1] || "").toLowerCase().indexOf(q) !== -1) return true;
        if (x[2] > -1 && GENS[x[2]] && GENS[x[2]].toLowerCase().indexOf(q) !== -1) return true;
        if (x[3] > -1 && VARIANTS[x[3]] && VARIANTS[x[3]].toLowerCase().indexOf(q) !== -1) return true;
        if (x[8] > -1 && ENGINES[x[8]] && ENGINES[x[8]].toLowerCase().indexOf(q) !== -1) return true;
        return false;
      });
    }
    if (state.mode === "vehicle" && state.brand) {
      var bi = MAKE_IDX[state.brand];
      return p.f.some(fitMatchesVehicle);
    }
    return true;
  }

  /* ---------- Kategorie-Chips ---------- */
  function renderChips() {
    var t = tr(), wrap = $("cat-chips");
    if (!wrap) return;
    wrap.innerHTML = "";
    ["all", "system", "sound", "adapter"].forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cat-chip" + (state.cat === c ? " active" : "");
      b.textContent = t.cats[c];
      b.addEventListener("click", function () { state.cat = c; render(); });
      wrap.appendChild(b);
    });
  }

  /* ---------- Katalog rendern ---------- */
  function sortList(list) {
    return list.slice().sort(function (a, b) {
      if (a.s !== b.s) return b.s - a.s;     // op Lager fir d'éischt
      return a.n < b.n ? -1 : a.n > b.n ? 1 : 0;
    });
  }
  function render() {
    var t = tr(), grid = $("shop-grid"), info = $("shop-result-info"), empty = $("shop-empty");
    if (!grid) return;
    renderChips();
    var list = sortList(PRODUCTS.filter(matches));
    var n = list.length;
    var shown = list.slice(0, RENDER_CAP);
    grid.innerHTML = "";
    shown.forEach(function (p) {
      grid.appendChild(card(p, t));
    });
    var txt;
    if (state.mode === "search" && state.q) txt = t.info_search.replace("{n}", n).replace("{q}", state.q);
    else if (state.mode === "vehicle" && state.brand)
      txt = t.info_veh.replace("{n}", n).replace("{v}", selectedVehicleLabel());
    else if (n > RENDER_CAP) txt = t.info_more.replace("{n}", n).replace("{c}", RENDER_CAP);
    else txt = t.info_all.replace("{n}", n);
    if (state.cat !== "all") txt = t.info_cat.replace("{n}", txt).replace("{c}", t.cats[state.cat]);
    if (info) info.textContent = txt;
    if (empty) empty.hidden = n > 0;
  }

  function card(p, t) {
    var c = document.createElement("article");
    c.className = "shop-card";

    /* Media */
    var media = document.createElement("div");
    media.className = "shop-card-media";
    var url = imgUrl(p.m, 600, 360);
    if (url) {
      var img = document.createElement("img");
      img.loading = "lazy";
      img.decoding = "async";
      img.width = 600; img.height = 360;
      img.alt = p.n;
      img.src = url;
      img.addEventListener("error", function () { media.classList.add("no-img"); img.remove(); });
      media.appendChild(img);
    } else {
      media.classList.add("no-img");
    }
    var catTag = document.createElement("span");
    catTag.className = "shop-cat";
    catTag.textContent = t.cats[p.c] || p.c;
    media.appendChild(catTag);
    c.appendChild(media);

    /* Body */
    var body = document.createElement("div");
    body.className = "shop-card-body";

    var h = document.createElement("h3");
    h.textContent = p.n;
    body.appendChild(h);

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

    /* Badges (EC-Zoulassung – Lagerstatus gëtt bewosst net ugewisen) */
    var badges = document.createElement("div");
    badges.className = "shop-badges";
    var ec = ecStatus(p);
    var ecb = document.createElement("span");
    ecb.className = "badge badge-ec " + ec.cls;
    ecb.textContent = (ec.cls === "ok" ? "✓ " : "") + t[ec.key];
    badges.appendChild(ecb);
    body.appendChild(badges);

    /* Foot */
    var foot = document.createElement("div");
    foot.className = "shop-card-foot";
    var art = document.createElement("span");
    art.className = "shop-artnr";
    art.textContent = t.artnr + " " + p.i;
    var pr = document.createElement("span");
    pr.className = "shop-price";
    pr.textContent = p.p ? priceStr(p.p) : "—";
    foot.appendChild(art);
    foot.appendChild(pr);
    body.appendChild(foot);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-outline shop-add";
    btn.textContent = t.add;
    btn.disabled = !p.p;
    btn.addEventListener("click", function (e) { e.stopPropagation(); addToCart(p, btn); });
    body.appendChild(btn);

    c.appendChild(body);
    c.classList.add("is-clickable");
    c.addEventListener("click", function () { openProduct(p); });
    return c;
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
  function relatedOf(p) {
    /* Nëmme Saachen déi op déiselwecht Gefier-Generatioun (Mark|Modell|Gen)
       passen AN eng aner, komplementär Roll hunn. */
    var keys = {};
    p.f.forEach(function (x) { keys[x[0] + "|" + x[1] + "|" + x[2]] = 1; });
    var selModel = (state.mode === "vehicle" && state.model) ? state.model : null;
    var scored = [];
    PRODUCTS.forEach(function (o) {
      if (o.i === p.i || !o.p) return;
      if (!complements(p.r, o.r)) return;
      var share = 0, exact = false;
      o.f.forEach(function (x) {
        if (keys[x[0] + "|" + x[1] + "|" + x[2]]) { share++; if (selModel && x[1] === selModel) exact = true; }
      });
      if (!share) return;
      scored.push({ o: o, score: (exact ? 100 : 0) + share, rank: ROLE_ORDER[o.r] || 9 });
    });
    scored.sort(function (a, b) {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.score !== b.score) return b.score - a.score;
      if (a.o.p !== b.o.p) return a.o.p - b.o.p;
      return a.o.n < b.o.n ? -1 : 1;
    });
    /* Pro Roll héchstens 2 (soss iwwerschwemmen Tip-Varianten vun engem Deel). */
    var perRole = {}, out = [];
    scored.forEach(function (s) {
      var r = s.o.r;
      perRole[r] = (perRole[r] || 0) + 1;
      if (perRole[r] <= 2) out.push(s.o);
    });
    return out.slice(0, 8);
  }

  var pdEls = null;
  function ensureModal() {
    if (pdEls) return pdEls;
    var back = document.createElement("div");
    back.className = "pd-backdrop"; back.id = "pd-backdrop"; back.hidden = true;
    var modal = document.createElement("div");
    modal.className = "pd-modal"; modal.id = "pd-modal";
    modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true");
    modal.hidden = true;
    modal.innerHTML =
      '<button type="button" class="pd-close" aria-label="×">✕</button>' +
      '<div class="pd-media" id="pd-media"></div>' +
      '<div class="pd-body">' +
      '<span class="shop-cat" id="pd-cat"></span>' +
      '<h2 class="pd-name" id="pd-name"></h2>' +
      '<div class="shop-badges" id="pd-badges"></div>' +
      '<p class="pd-fits-title" id="pd-fits-title"></p>' +
      '<ul class="pd-fits" id="pd-fits"></ul>' +
      '<div class="pd-foot"><span class="pd-ref" id="pd-ref"></span><span class="pd-price" id="pd-price"></span></div>' +
      '<button type="button" class="btn btn-primary pd-add" id="pd-add"></button>' +
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
    setTimeout(function () {
      if (pdEls && !pdEls.modal.classList.contains("show")) { pdEls.modal.hidden = true; pdEls.back.hidden = true; }
    }, 250);
  }
  function openProduct(p) {
    var t = tr();
    ensureModal();
    var media = $("pd-media");
    var url = imgUrl(p.m, 900, 540);
    media.className = "pd-media";
    media.innerHTML = "";
    if (url) {
      var img = document.createElement("img");
      img.loading = "lazy"; img.alt = p.n; img.src = url;
      img.addEventListener("error", function () { media.classList.add("no-img"); img.remove(); });
      media.appendChild(img);
    } else { media.classList.add("no-img"); }
    setTxt("pd-cat", roleLabel(p.r) || t.cats[p.c] || p.c);
    setTxt("pd-name", p.n);
    /* EC-Badge */
    var badges = $("pd-badges"); badges.innerHTML = "";
    var ec = ecStatus(p);
    var ecb = document.createElement("span");
    ecb.className = "badge badge-ec " + ec.cls;
    ecb.textContent = (ec.cls === "ok" ? "✓ " : "") + t[ec.key];
    badges.appendChild(ecb);
    /* Passform-Lëscht */
    setTxt("pd-fits-title", t.fits_on);
    var fitsEl = $("pd-fits"); fitsEl.innerHTML = "";
    var seen = {}, shown = 0;
    p.f.forEach(function (x) {
      if (shown >= 10) return;
      var label = makeName(x[0]) + " " + fitLabel(x);
      if (seen[label]) return; seen[label] = 1; shown++;
      var li = document.createElement("li"); li.textContent = label; fitsEl.appendChild(li);
    });
    setTxt("pd-ref", t.artnr + " " + p.i);
    setTxt("pd-price", p.p ? priceStr(p.p) : "—");
    var addBtn = $("pd-add");
    addBtn.textContent = t.add; addBtn.disabled = !p.p;
    addBtn.onclick = function () { addToCart(p, addBtn); };
    /* Dobaibestellen – nëmme weisen wann et wierklech komplementär Deeler gëtt */
    var relWrap = $("pd-related"); relWrap.innerHTML = "";
    var rel = relatedOf(p);
    if (rel.length) {
      relWrap.style.display = "";
      var h = document.createElement("h3"); h.textContent = t.related; relWrap.appendChild(h);
      var sub = document.createElement("p"); sub.className = "pd-rel-sub"; sub.textContent = t.related_sub; relWrap.appendChild(sub);
      var ul = document.createElement("ul"); ul.className = "pd-rel-list";
      rel.forEach(function (o) { ul.appendChild(relItem(o, t)); });
      relWrap.appendChild(ul);
    } else {
      relWrap.style.display = "none";
    }
    pdEls.modal.scrollTop = 0;
    pdEls.back.hidden = false; pdEls.modal.hidden = false;
    requestAnimationFrame(function () { pdEls.modal.classList.add("show"); pdEls.back.classList.add("show"); });
  }
  function relItem(o, t) {
    var li = document.createElement("li"); li.className = "pd-rel-item";
    var thumb = document.createElement("div"); thumb.className = "pd-rel-thumb";
    var url = imgUrl(o.m, 160, 120);
    if (url) {
      var im = document.createElement("img"); im.loading = "lazy"; im.alt = o.n; im.src = url;
      im.addEventListener("error", function () { thumb.classList.add("no-img"); im.remove(); });
      thumb.appendChild(im);
    } else { thumb.classList.add("no-img"); }
    var info = document.createElement("div"); info.className = "pd-rel-info";
    var nm = document.createElement("div"); nm.className = "pd-rel-name"; nm.textContent = o.n;
    var meta = document.createElement("div"); meta.className = "pd-rel-meta";
    meta.textContent = (roleLabel(o.r) || t.cats[o.c] || o.c) + " · " + priceStr(o.p);
    info.appendChild(nm); info.appendChild(meta);
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
    return uniqueSorted(fitsForSelection(1).map(generationLabel));
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
    return uniqueSorted(fitsForSelection(3).map(engineLabel));
  }
  function setVehicleField(id, enabled, clear) {
    var el = $(id);
    if (!el) return;
    el.disabled = !enabled;
    if (clear) el.value = "";
  }
  function updateVehicleButton() {
    var btn = $("btn-veh-search");
    if (btn) btn.disabled = !(state.brand && state.model && state.generation && state.year && state.engine);
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
      function () { return Object.keys(BRANDS); },
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
    render(); scrollToCatalog();
  }
  function doVehSearch() {
    if (!(state.brand && state.model && state.generation && state.year && state.engine)) return;
    state.mode = "vehicle"; state.cat = "all";
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
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeCart(); closeProduct(); } });
    document.querySelectorAll(".lang-select").forEach(function (sel) {
      sel.addEventListener("change", function () { setTimeout(function () { applyStatics(); render(); }, 0); });
    });
  }

  function init() {
    cart = loadCart();
    applyStatics();
    initCombos();
    bind();
    render();
    renderCart();
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
