/* Autoservice Bettenduerf — Locatioun / Verlee (méisproocheg)
   Katalog, Auswiel a Reservéierung iwwer den eegene Cloudflare-Worker. */
(function () {
  "use strict";

  /* ---- Inline-SVG-Ikonen (keng externt Bild néideg) ---- */
  var ICONS = {
    flatbed:
      '<svg viewBox="0 0 64 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 26h50"/><path d="M53 26V16l7 3v7"/><path d="M3 26V14h50v12"/><circle cx="18" cy="30" r="4"/><circle cx="44" cy="30" r="4"/></svg>',
    tipper:
      '<svg viewBox="0 0 64 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 28h46"/><path d="M10 28l4-14 40 4-3 10"/><path d="M52 28V18l8 3v7"/><circle cx="20" cy="32" r="4"/><circle cx="45" cy="32" r="4"/></svg>',
    cartrans:
      '<svg viewBox="0 0 64 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 30h58"/><path d="M8 30V12h34l10 8v10"/><path d="M20 20l6-4h12l6 4"/><circle cx="18" cy="33" r="3.5"/><circle cx="46" cy="33" r="3.5"/></svg>',
    box:
      '<svg viewBox="0 0 64 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="8" width="46" height="20" rx="2"/><path d="M52 20l8 2v6"/><path d="M6 28h54"/><circle cx="20" cy="32" r="4"/><circle cx="45" cy="32" r="4"/></svg>',
    car:
      '<svg viewBox="0 0 64 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 27h52"/><path d="M9 27l3-10h34l7 6 5 1v3"/><path d="M18 17l3-5h16l5 5"/><circle cx="20" cy="30" r="4"/><circle cx="44" cy="30" r="4"/></svg>',
    van:
      '<svg viewBox="0 0 64 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 28h56"/><path d="M6 28V10h30v18"/><path d="M36 28V16h12l8 8v4"/><circle cx="18" cy="31" r="4"/><circle cx="47" cy="31" r="4"/></svg>',
  };

  /* ---- Katalog: Präis bewosst „op Ufro" — reell Präisser kann de Garage aginn ---- */
  var CATALOG = [
    {
      id: "master",
      cat: "vehicle",
      icon: "van",
      img: "assets/rental-renault-master.webp",
      priceDay: 100,
      name: { lb: "Renault Master", de: "Renault Master", fr: "Renault Master", en: "Renault Master" },
      tagline: {
        lb: "Grousse Transporter fir Ëmzuch, Transport a sperreg Luedung.",
        de: "Großer Transporter für Umzug, Transport und sperrige Ladung.",
        fr: "Grand utilitaire pour déménagement, transport et charges volumineuses.",
        en: "Large van for moving, transport and bulky loads.",
      },
      facts: [
        { ic: "📦", lb: "Grousse zouene Luedraum", de: "Großer geschlossener Laderaum", fr: "Grand espace de chargement fermé", en: "Large enclosed load space" },
        { ic: "⛽", lb: "Diesel", de: "Diesel", fr: "Diesel", en: "Diesel" },
        { ic: "🪑", lb: "3 Sëtzplazen", de: "3 Sitzplätze", fr: "3 places", en: "3 seats" },
        { ic: "⚖️", lb: "bis 3,5 t", de: "bis 3,5 t", fr: "jusqu'à 3,5 t", en: "up to 3.5 t" },
        { ic: "🪪", lb: "Führerschäin B", de: "Führerschein B", fr: "Permis B", en: "Licence B" },
        { ic: "📅", lb: "Baujoer 2021", de: "Baujahr 2021", fr: "Année 2021", en: "Year 2021" },
      ],
      details: {
        lb: [["Notzung", "Ëmzuch, Miwwelen a Wueren"], ["Luedraum", "Grouss an zou; genee Moosse ginn nach ergänzt"], ["Sëtzplazen", "3"], ["Führerschäin", "Kategorie B"], ["Brennstoff", "Diesel · vollgetankt zréck"]],
        de: [["Einsatz", "Umzug, Möbel und Waren"], ["Laderaum", "Groß und geschlossen; genaue Maße folgen"], ["Sitzplätze", "3"], ["Führerschein", "Klasse B"], ["Kraftstoff", "Diesel · vollgetankt zurück"]],
        fr: [["Usage", "Déménagement, meubles et marchandises"], ["Volume", "Grand et fermé ; dimensions exactes à venir"], ["Places", "3"], ["Permis", "Catégorie B"], ["Carburant", "Diesel · retour avec le plein"]],
        en: [["Use", "Moving, furniture and goods"], ["Load space", "Large and enclosed; exact dimensions to follow"], ["Seats", "3"], ["Licence", "Category B"], ["Fuel", "Diesel · return with a full tank"]],
      },
      specs: {
        lb: ["Führerschäin Kategorie B", "Grousse zouene Luedraum", "Konditioune ginn virun der Bestätegung matgedeelt"],
        de: ["Führerschein Kategorie B", "Großer geschlossener Laderaum", "Konditionen werden vor der Bestätigung mitgeteilt"],
        fr: ["Permis de conduire catégorie B", "Grand espace de chargement fermé", "Conditions communiquées avant la confirmation"],
        en: ["Category B driving licence", "Large enclosed load space", "Conditions communicated before confirmation"],
      },
    },
  ];
  function money(n){return Number(n||0).toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2})+" €";}
  /* Etikette fir d'Kaartepunkten an d'Detailansicht (4 Sproochen) */
  var DETAIL_L = {
    lb: { licence:"Führerschäin", deposit:"Kautioun", gross:"Max. zoul. Gewiicht", kmIncl:"km abegraff", dims:"Dimensiounen", loadSpace:"Luedraum", payload:"Notzlaascht", braked:"Brems", seats:"Sëtzplazen", fuel:"Brennstoff / Undriff", box:"Boîte", year:"Baujoer", feature:"Equipement", largeClosed:"Grouss, zou, laang an héich", braked_yes:"Gebremst", braked_no:"Ongebremst", secCond:"Konditiounen", secTech:"Detailer & Equipement", more:"All Detailer", close:"Zoumaachen", extrakm:"pro Zousaz-km", late:"Verspéidung", perHour:"/ Stonn", kmInclFull:"km pro Locatioun abegraff" },
    de: { licence:"Führerschein", deposit:"Kaution", gross:"Max. zul. Gewicht", kmIncl:"km inklusive", dims:"Abmessungen", loadSpace:"Laderaum", payload:"Nutzlast", braked:"Bremse", seats:"Sitzplätze", fuel:"Kraftstoff / Antrieb", box:"Getriebe", year:"Baujahr", feature:"Ausstattung", largeClosed:"Groß, geschlossen, lang und hoch", braked_yes:"Gebremst", braked_no:"Ungebremst", secCond:"Konditionen", secTech:"Details & Ausstattung", more:"Alle Details", close:"Schließen", extrakm:"je Mehrkilometer", late:"Verspätung", perHour:"/ Stunde", kmInclFull:"km pro Miete inklusive" },
    fr: { licence:"Permis", deposit:"Caution", gross:"PTAC max.", kmIncl:"km inclus", dims:"Dimensions", loadSpace:"Volume", payload:"Charge utile", braked:"Freinage", seats:"Places", fuel:"Carburant / Motorisation", box:"Boîte", year:"Année", feature:"Équipement", largeClosed:"Grand, fermé, long et haut", braked_yes:"Freiné", braked_no:"Non freiné", secCond:"Conditions", secTech:"Détails & équipement", more:"Tous les détails", close:"Fermer", extrakm:"par km supplémentaire", late:"Retard", perHour:"/ heure", kmInclFull:"km inclus par location" },
    en: { licence:"Licence", deposit:"Deposit", gross:"Max. gross weight", kmIncl:"km included", dims:"Dimensions", loadSpace:"Load space", payload:"Payload", braked:"Braking", seats:"Seats", fuel:"Fuel / drive", box:"Transmission", year:"Year", feature:"Equipment", largeClosed:"Large, enclosed, long and high", braked_yes:"Braked", braked_no:"Unbraked", secCond:"Conditions", secTech:"Details & equipment", more:"All details", close:"Close", extrakm:"per extra kilometre", late:"Late return", perHour:"/ hour", kmInclFull:"km included per rental" }
  };
  function fleetItem(v) {
    var name={lb:v.name,de:v.name,fr:v.name,en:v.name}, desc=v.description||"", tagline={lb:desc,de:desc,fr:desc,en:desc};
    var trailer=v.type==="trailer";
    var specs=(v.features||[]).length?v.features.slice():(desc?[desc]:[]), specMap={lb:specs.slice(),de:specs.slice(),fr:specs.slice(),en:specs.slice()};
    if(!trailer&&Number(v.includedKm||0)) { specMap.lb.push(v.includedKm+" km pro Locatioun abegraff");specMap.de.push(v.includedKm+" km pro Miete inklusive");specMap.fr.push(v.includedKm+" km inclus par location");specMap.en.push(v.includedKm+" km included per rental"); }
    if(!trailer&&Number(v.extraKmRate||0)) { specMap.lb.push(money(v.extraKmRate)+" pro Zousaz-km");specMap.de.push(money(v.extraKmRate)+" je Mehrkilometer");specMap.fr.push(money(v.extraKmRate)+" par km supplémentaire");specMap.en.push(money(v.extraKmRate)+" per extra kilometre"); }
    if(Number(v.deposit||0)) { specMap.lb.push("Kautioun: "+money(v.deposit));specMap.de.push("Kaution: "+money(v.deposit));specMap.fr.push("Caution : "+money(v.deposit));specMap.en.push("Deposit: "+money(v.deposit)); }
    if(Number(v.lateFeeHour||0)) { specMap.lb.push("Verspéidung: "+money(v.lateFeeHour)+" / Stonn");specMap.de.push("Verspätung: "+money(v.lateFeeHour)+" / Stunde");specMap.fr.push("Retard : "+money(v.lateFeeHour)+" / heure");specMap.en.push("Late return: "+money(v.lateFeeHour)+" / hour"); }
    // Technesch Detailer, iwwersetzbar gehalen (Schlëssel + Wäert)
    var tech=[["loadSpace",trailer?"":v.loadSpace],["dims",trailer?v.loadSpace:""],["gross",v.grossWeight],["payload",v.payload],["braked",trailer?(v.braked?"__yes__":"__no__"):""],["seats",trailer?"":v.seats],["fuel",trailer?"":v.fuel],["box",trailer?"":v.transmission],["licence",v.licenseClass],["year",v.year]].filter(function(r){return r[1];});
    return {id:v.id,cat:trailer?"trailer":"vehicle",icon:trailer?"box":(v.type==="car"?"car":"van"),img:v.image||(trailer?"":"assets/rental-renault-master.webp"),priceDay:Number(v.priceDay||0),deposit:Number(v.deposit||0),includedKm:Number(v.includedKm||0),extraKmRate:Number(v.extraKmRate||0),lateFeeHour:Number(v.lateFeeHour||0),licenseClass:v.licenseClass||"",grossWeight:v.grossWeight||"",name:name,tagline:tagline,specs:specMap,tech:tech};
  }
  /* Déi 4 Schlësselpunkten ënnert der Foto (Plaz spueren) */
  function keyPoints(it, L) {
    var d=DETAIL_L[L]||DETAIL_L.lb, out=[];
    if(it.licenseClass) out.push({k:"🪪",v:d.licence+": "+it.licenseClass});
    if(it.deposit) out.push({k:"🔒",v:d.deposit+": "+money(it.deposit)});
    if(it.grossWeight) out.push({k:"⚖️",v:d.gross+": "+it.grossWeight});
    if(it.cat!=="trailer"&&it.includedKm) out.push({k:"📍",v:it.includedKm+" "+d.kmIncl});
    return out;
  }
  function loadFleet() {
    return fetch("https://garage-admin.autoservicebettenduerf.lu/fleet/public", {headers:{Accept:"application/json"}}).then(function(r){if(!r.ok)throw new Error("fleet");return r.json();}).then(function(data){
      var next=(data.vehicles||[]).map(fleetItem); if(!next.length)return;
      CATALOG=next; state.selected=state.selected.filter(function(id){return CATALOG.some(function(x){return x.id===id;});});
      renderCatalog(); renderSelection();
    }).catch(function(){});
  }

  /* ---- Iwwersetzungen (Säit-Strings) ---- */
  var T = {
    lb: {
      eyebrow: "Locatioun",
      title: "Gefierer & Unhänger lounen",
      sub: "Wielt Äert Gefier, gitt Äre Reservéierungszäitraum un – mir bestätegen Iech Är Ufro perséinlech.",
      nav: "Locatioun",
      soon_eyebrow: "Locatioun",
      soon_title: "Eise Verlee ass an der Aarbecht",
      soon_text: "Mir bauen de Moment eis Locatioun vun Unhänger a Gefierer op. Kuckt geschwënn erëm laanscht – oder kontaktéiert eis direkt.",
      soon_cta: "Ufro schécken", soon_back: "Zréck op d’Startsäit",
      dev_badge: "Virschau-Modus – d'Locatioun ass ëffentlech nach „an der Aarbecht“",
      cat_all: "Alles", cat_trailer: "Unhänger", cat_vehicle: "Gefierer",
      cat_trailer_lbl: "Unhänger", cat_vehicle_lbl: "Gefier",
      price: "Präis op Ufro",
      perDay: "Dag", payOnReturn: "Bezuelung beim Retour · vollgetankt zréckbréngen", payOnReturnTrailer:"Bezuelung beim Retour · propper zréckbréngen",
      select: "Auswielen", selected: "Ausgewielt", remove: "Ewechhuelen",
      sel_h: "Är Auswiel", empty: "Nach näischt ausgewielt. Wielt uewen dat gewënschte Material aus.",
      form_h: "Reservéieren",
      from: "Vun", to: "Bis", name: "Numm", email: "E-Mail", phone: "Telefon",
      message: "Noriicht", phone_ph: "Optional",
      privacy: "Ech hunn d'Dateschutzerklärung gelies a sinn averstanen, datt meng Donnéeë fir d'Veraarbechtung vun der Ufro benotzt ginn.",
      submit: "Reservéierung ufroen",
      note: "D'Reservéierung ass eng Ufro a gëtt vun eis bestätegt.", period: "Zäitraum", day: "Dag", days: "Deeg", privacy_link: "Dateschutzerklärung",
      sending: "Gëtt geschéckt …",
      ok: "Merci! Är Ufro fir eng Locatioun ass ukomm. Mir mellen eis séier.",
      senderr: "Ups, dat huet net geklappt. Rufft eis w.e.g. un oder probéiert et méi spéit nach eng Kéier.",
      unavailable: "Dat ausgewielte Gefier oder Material ass an dësem Zäitraum leider net disponibel.",
      rate: "Ze vill Ufroen a kuerzer Zäit. Probéiert et w.e.g. méi spéit nach eng Kéier.",
      missing: "Fëllt w.e.g. nach aus:",
      m_items: "op d'mannst ee Gefier oder Material", m_from: "Ufanksdatum", m_to: "Enndatum",
      m_daterange: "en Enndatum no dem Ufank", m_name: "Numm", m_email: "eng gëlteg E-Mail", m_privacy: "Dateschutz-Zoustëmmung",
    },
    de: {
      eyebrow: "Location · Verleih",
      title: "Fahrzeuge & Anhänger mieten",
      sub: "Wählen Sie Ihr Fahrzeug, geben Sie den Mietzeitraum an – wir bestätigen Ihre Anfrage persönlich.",
      nav: "Verleih",
      soon_eyebrow: "Verleih",
      soon_title: "Unser Verleih ist in Arbeit",
      soon_text: "Wir bauen gerade unseren Verleih für Anhänger und Fahrzeuge auf. Schauen Sie bald wieder vorbei – oder kontaktieren Sie uns direkt.",
      soon_cta: "Anfrage senden", soon_back: "Zurück zur Startseite",
      dev_badge: "Vorschau-Modus – Verleih öffentlich noch „in Arbeit“",
      cat_all: "Alles", cat_trailer: "Anhänger", cat_vehicle: "Fahrzeuge",
      cat_trailer_lbl: "Anhänger", cat_vehicle_lbl: "Fahrzeug",
      price: "Preis auf Anfrage",
      perDay: "Tag", payOnReturn: "Zahlung bei Rückgabe · vollgetankt zurückbringen", payOnReturnTrailer:"Zahlung bei Rückgabe · sauber zurückbringen",
      select: "Auswählen", selected: "Ausgewählt", remove: "Entfernen",
      sel_h: "Ihre Auswahl", empty: "Noch nichts ausgewählt. Wählen Sie oben Ihr Material.",
      form_h: "Reservieren",
      from: "Von", to: "Bis", name: "Name", email: "E-Mail", phone: "Telefon",
      message: "Nachricht", phone_ph: "Optional",
      privacy: "Ich habe die Datenschutzerklärung gelesen und bin mit der Verarbeitung meiner Daten für diese Anfrage einverstanden.",
      submit: "Reservierung anfragen",
      note: "Die Reservierung ist eine Anfrage und wird von uns bestätigt.", period: "Zeitraum", day: "Tag", days: "Tage", privacy_link: "Datenschutzerklärung",
      sending: "Wird gesendet …",
      ok: "Danke! Ihre Verleih-Anfrage ist angekommen. Wir melden uns zeitnah.",
      senderr: "Ups, das hat nicht geklappt. Bitte rufen Sie uns an oder versuchen Sie es später erneut.",
      unavailable: "Das ausgewählte Fahrzeug oder Material ist in diesem Zeitraum leider nicht verfügbar.",
      rate: "Zu viele Anfragen in kurzer Zeit. Bitte versuchen Sie es später erneut.",
      missing: "Bitte ergänzen Sie noch:",
      m_items: "mindestens ein Fahrzeug oder Material", m_from: "Startdatum", m_to: "Enddatum",
      m_daterange: "ein Enddatum nach dem Start", m_name: "Name", m_email: "eine gültige E-Mail", m_privacy: "Datenschutz-Zustimmung",
    },
    fr: {
      eyebrow: "Location",
      title: "Louer des véhicules & remorques",
      sub: "Choisissez votre véhicule, indiquez la période de location – nous confirmons votre demande personnellement.",
      nav: "Location",
      soon_eyebrow: "Location",
      soon_title: "Notre location est en préparation",
      soon_text: "Nous mettons en place notre location de remorques et de véhicules. Revenez bientôt – ou contactez-nous directement.",
      soon_cta: "Envoyer une demande", soon_back: "Retour à l’accueil",
      dev_badge: "Mode aperçu – location encore « en construction » côté public",
      cat_all: "Tout", cat_trailer: "Remorques", cat_vehicle: "Véhicules",
      cat_trailer_lbl: "Remorque", cat_vehicle_lbl: "Véhicule",
      price: "Prix sur demande",
      perDay: "jour", payOnReturn: "Paiement au retour · à rendre le plein fait", payOnReturnTrailer:"Paiement au retour · à rendre propre",
      select: "Choisir", selected: "Sélectionné", remove: "Retirer",
      sel_h: "Votre sélection", empty: "Rien de sélectionné. Choisissez votre matériel ci-dessus.",
      form_h: "Réserver",
      from: "Du", to: "Au", name: "Nom", email: "E-mail", phone: "Téléphone",
      message: "Message", phone_ph: "Facultatif",
      privacy: "J'ai lu la politique de confidentialité et j'accepte le traitement de mes données pour cette demande.",
      submit: "Demander la réservation",
      note: "La réservation est une demande et sera confirmée par nos soins.", period: "Période", day: "jour", days: "jours", privacy_link: "politique de confidentialité",
      sending: "Envoi …",
      ok: "Merci ! Votre demande de location est bien arrivée. Nous vous recontactons rapidement.",
      senderr: "Oups, cela n'a pas fonctionné. Merci de nous appeler ou de réessayer plus tard.",
      unavailable: "Le véhicule ou le matériel sélectionné n'est malheureusement pas disponible pendant cette période.",
      rate: "Trop de demandes en peu de temps. Veuillez réessayer plus tard.",
      missing: "Veuillez compléter :",
      m_items: "au moins un véhicule ou matériel", m_from: "date de début", m_to: "date de fin",
      m_daterange: "une date de fin après le début", m_name: "nom", m_email: "un e-mail valide", m_privacy: "accord de confidentialité",
    },
    en: {
      eyebrow: "Rental",
      title: "Rent vehicles & trailers",
      sub: "Pick your vehicle, enter your rental period – we confirm your request personally.",
      nav: "Rental",
      soon_eyebrow: "Rental",
      soon_title: "Our rental service is in the works",
      soon_text: "We're setting up our trailer and vehicle rental. Check back soon – or contact us directly.",
      soon_cta: "Send a request", soon_back: "Back to home",
      dev_badge: "Preview mode – rental still “under construction” for the public",
      cat_all: "All", cat_trailer: "Trailers", cat_vehicle: "Vehicles",
      cat_trailer_lbl: "Trailer", cat_vehicle_lbl: "Vehicle",
      price: "Price on request",
      perDay: "day", payOnReturn: "Pay on return · bring it back with a full tank", payOnReturnTrailer:"Pay on return · return it clean",
      select: "Select", selected: "Selected", remove: "Remove",
      sel_h: "Your selection", empty: "Nothing selected yet. Pick your equipment above.",
      form_h: "Reserve",
      from: "From", to: "To", name: "Name", email: "Email", phone: "Phone",
      message: "Message", phone_ph: "Optional",
      privacy: "I have read the privacy policy and agree to the processing of my data for this request.",
      submit: "Request reservation",
      note: "The reservation is a request and will be confirmed by us.", period: "Period", day: "day", days: "days", privacy_link: "privacy policy",
      sending: "Sending …",
      ok: "Thank you! Your rental request has arrived. We'll get back to you soon.",
      senderr: "Oops, that didn't work. Please call us or try again later.",
      unavailable: "The selected vehicle or equipment is unfortunately unavailable during this period.",
      rate: "Too many requests in a short time. Please try again later.",
      missing: "Please also add:",
      m_items: "at least 1 item", m_from: "start date", m_to: "end date",
      m_daterange: "an end date after the start", m_name: "name", m_email: "a valid email", m_privacy: "privacy consent",
    },
  };

  var state = { cat: "all", selected: [], busy: [], availabilityError: false, calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1) };
  var API_BASE = "https://garage-admin.autoservicebettenduerf.lu";

  var EXTRA = {
    lb: {
      step1: "Schrëtt 1 vun 3 · Auswiel an Zäitraum", step2: "Schrëtt 2 vun 3 · Är Donnéeën", step3: "Schrëtt 3 vun 3 · Kontrolléieren",
      daysLabel: "Berechent Locatiounsdauer", rateLabel: "Dagespräis", totalLabel: "Viraussiichtleche Locatiounspräis", priceHint: "De Präis riicht sech nom gewielten Objet. Déi abegraff Kilometer, Zousaz-km, d’Kautioun an all weider Konditioune ginn pro Objet ugewisen a virun der verbindlecher Bestätegung matgedeelt.",
      trustEye: "Lokal · transparent · perséinlech", trustTitle: "Äre Transporter, direkt bei Ärer Garage", trust: [["An der eegener Garage betreit", "D’Gefier gëtt vun eis kontrolléiert a reegelméisseg ënnerhalen."], ["Lokal Ofhuelung", "Perséinlech Iwwergab beim Autoservice Bettenduerf zu Bettendorf."], ["Eng richteg Kontaktpersoun", "Mir kontrolléieren all Ufro a klären oppe Froen direkt mat Iech."]],
      faqEye: "Gutt ze wëssen", faqTitle: "Heefeg Froen zur Locatioun", faq: [["Ass meng Online-Ufro direkt verbindlech?", "Nee. Mir kontrolléieren d’Disponibilitéit an d’Konditiounen a schécken Iech duerno eng perséinlech Bestätegung."], ["Wéi ee Führerschäin brauch ech?", "Déi néideg Kategorie steet beim jeeweilege Gefier oder Unhänger. Si hänkt vum gelounte Material, dem Zuchgefier an den zougeloossene Gesamtmassen of a gëtt virun der Iwwergab kontrolléiert."], ["Wat muss ech bei der Ofhuelung matbréngen?", "Eng gülteg Identitéitskaart oder e Pass, de passende gültege Führerschäin an Är Reservatiounsbestätegung. Dat gëllt och fir all zousätzlech Persoun, déi fuere soll."], ["Däerf eng aner Persoun fueren?", "Nëmme Persounen, déi virun der Iwwergab ugemellt, kontrolléiert an am Locatiounsvertrag agedroe goufen, däerfen d’Gefier oder d’Gespan féieren."], ["Wéi gëtt de Präis berechent?", "Dagespräis, abegraff Kilometer, Zousazkilometer, Kautioun an eventuell Verspéidungskäschte stinn direkt beim jeeweilege Gefier oder Material an an Ärer Bestätegung."], ["Kann ech d’Reservatioun änneren, annuléieren oder verlängeren?", "Kontaktéiert eis esou fréi wéi méiglech. Eng Verlängerung ass nëmme mat eiser Bestätegung a wann d’Material disponibel ass méiglech. Eventuell Käschte ginn Iech virun der Ännerung matgedeelt."], ["Wou sinn d’Ofhuelung an de Retour?", "Beim Autoservice Bettenduerf, 63, rue de Diekirch-Echternach, L-9355 Bettendorf, zu der bestätegter Zäit."], ["Wéi muss d’Material zréckkommen?", "Zu där Zäit, déi ofgemaach gouf, propper a mam ofgemaachte Brennstoff- oder Luedzoustand. Déi genee Reegelen hänke vum gelounte Gefier oder Material of. Kontaktéiert eis bei enger Verspéidung direkt."], ["Wat maachen ech bei engem Accident, enger Pann oder engem Schued?", "Sécher d’Plaz of, alarméiert wann néideg d’Rettungsdéngschter oder d’Police, dokumentéiert alles mat Fotoen a kontaktéiert eis direkt. Maacht keng Reparatur ouni eis Zoustëmmung."], ["Däerf ech an d’Ausland fueren?", "Gitt geplangten Auslandsfaarte bei der Ufro un. Mir bestätegen Iech virun der Locatioun, ob a wéi eng Länner erlaabt sinn."]]
    },
    de: {
      step1: "Schritt 1 von 3 · Auswahl und Zeitraum", step2: "Schritt 2 von 3 · Ihre Daten", step3: "Schritt 3 von 3 · Prüfen",
      daysLabel: "Berechnete Mietdauer", rateLabel: "Tagespreis", totalLabel: "Voraussichtlicher Mietpreis", priceHint: "Der Preis richtet sich nach dem gewählten Objekt. Enthaltene Kilometer, Mehrkilometer, Kaution und alle weiteren Konditionen werden je Objekt angezeigt und vor der verbindlichen Bestätigung mitgeteilt.",
      trustEye: "Lokal · transparent · persönlich", trustTitle: "Ihr Transporter, direkt bei Ihrer Garage", trust: [["In der eigenen Werkstatt betreut", "Das Fahrzeug wird von uns kontrolliert und regelmäßig gewartet."], ["Lokale Abholung", "Persönliche Übergabe beim Autoservice Bettenduerf in Bettendorf."], ["Ein echter Ansprechpartner", "Wir prüfen jede Anfrage und klären offene Fragen direkt mit Ihnen."]],
      faqEye: "Gut zu wissen", faqTitle: "Häufige Fragen zum Verleih", faq: [["Ist meine Online-Anfrage sofort verbindlich?", "Nein. Wir prüfen Verfügbarkeit und Bedingungen und senden Ihnen anschließend eine persönliche Bestätigung."], ["Welchen Führerschein benötige ich?", "Die erforderliche Kategorie steht beim jeweiligen Fahrzeug oder Anhänger. Sie hängt vom Mietobjekt, Zugfahrzeug und den zulässigen Gesamtmassen ab und wird vor der Übergabe geprüft."], ["Was muss ich bei der Abholung mitbringen?", "Einen gültigen Personalausweis oder Reisepass, den passenden gültigen Führerschein und Ihre Reservierungsbestätigung. Dies gilt auch für jeden zusätzlichen Fahrer."], ["Darf eine andere Person fahren?", "Nur Personen, die vor der Übergabe angemeldet, geprüft und im Mietvertrag eingetragen wurden, dürfen das Fahrzeug oder Gespann führen."], ["Wie wird der Mietpreis berechnet?", "Tagespreis, enthaltene Kilometer, Mehrkilometer, Kaution und mögliche Verspätungskosten stehen direkt beim jeweiligen Mietobjekt und in Ihrer Bestätigung."], ["Kann ich die Reservierung ändern, stornieren oder verlängern?", "Kontaktieren Sie uns so früh wie möglich. Eine Verlängerung ist nur nach unserer Bestätigung und bei verfügbarer Kapazität möglich. Etwaige Kosten teilen wir Ihnen vor der Änderung mit."], ["Wo erfolgen Abholung und Rückgabe?", "Beim Autoservice Bettenduerf, 63 rue de Diekirch-Echternach, L-9355 Bettendorf, zur bestätigten Uhrzeit."], ["Wie muss das Mietobjekt zurückgegeben werden?", "Zur vereinbarten Zeit, sauber und mit dem vereinbarten Kraftstoff- oder Ladestand. Die genauen Regeln hängen vom Mietobjekt ab. Bitte kontaktieren Sie uns bei einer Verspätung sofort."], ["Was mache ich bei Unfall, Panne oder Schaden?", "Sichern Sie die Stelle, verständigen Sie bei Bedarf Rettungsdienst oder Polizei, dokumentieren Sie alles mit Fotos und kontaktieren Sie uns sofort. Nehmen Sie ohne unsere Zustimmung keine Reparatur vor."], ["Darf ich ins Ausland fahren?", "Geben Sie geplante Auslandsfahrten in der Anfrage an. Wir bestätigen vor der Vermietung, ob und welche Länder erlaubt sind."]]
    },
    fr: {
      step1: "Étape 1 sur 3 · Sélection et période", step2: "Étape 2 sur 3 · Vos coordonnées", step3: "Étape 3 sur 3 · Vérification",
      daysLabel: "Durée de location calculée", rateLabel: "Tarif journalier", totalLabel: "Prix de location estimé", priceHint: "Le prix dépend de l’objet choisi. Les kilomètres inclus, les kilomètres supplémentaires, la caution et toutes les autres conditions sont indiqués par objet et communiqués avant la confirmation ferme.",
      trustEye: "Local · transparent · personnel", trustTitle: "Votre utilitaire, directement auprès de votre garage", trust: [["Entretenu dans notre atelier", "Le véhicule est contrôlé et entretenu régulièrement par nos soins."], ["Enlèvement local", "Remise personnelle chez Autoservice Bettenduerf à Bettendorf."], ["Un interlocuteur réel", "Nous vérifions chaque demande et clarifions directement avec vous les questions ouvertes."]],
      faqEye: "Bon à savoir", faqTitle: "Questions fréquentes sur la location", faq: [["Ma demande en ligne est-elle immédiatement ferme ?", "Non. Nous vérifions la disponibilité et les conditions, puis vous envoyons une confirmation personnelle."], ["Quel permis me faut-il ?", "La catégorie requise est indiquée pour chaque véhicule ou remorque. Elle dépend du matériel loué, du véhicule tracteur et des masses maximales autorisées et est contrôlée avant la remise."], ["Que dois-je apporter lors de l’enlèvement ?", "Une carte d’identité ou un passeport valable, le permis de conduire valable correspondant et votre confirmation de réservation. Ces documents sont également requis pour chaque conducteur supplémentaire."], ["Une autre personne peut-elle conduire ?", "Seules les personnes déclarées, contrôlées et inscrites au contrat avant la remise peuvent conduire le véhicule ou l’ensemble attelé."], ["Comment le prix est-il calculé ?", "Le tarif journalier, les kilomètres inclus, les kilomètres supplémentaires, la caution et les éventuels frais de retard sont indiqués pour chaque matériel loué et dans votre confirmation."], ["Puis-je modifier, annuler ou prolonger la réservation ?", "Contactez-nous le plus tôt possible. Toute prolongation nécessite notre confirmation et dépend de la disponibilité. Les éventuels frais vous sont communiqués avant la modification."], ["Où ont lieu l’enlèvement et le retour ?", "Chez Autoservice Bettenduerf, 63 rue de Diekirch-Echternach, L-9355 Bettendorf, à l’heure confirmée."], ["Comment restituer le matériel loué ?", "À l’heure convenue, propre et avec le niveau de carburant ou de charge convenu. Les règles précises dépendent du matériel loué. Contactez-nous immédiatement en cas de retard."], ["Que faire en cas d’accident, de panne ou de dommage ?", "Sécurisez les lieux, prévenez si nécessaire les secours ou la police, documentez la situation avec des photos et contactez-nous immédiatement. N’effectuez aucune réparation sans notre accord."], ["Puis-je circuler à l’étranger ?", "Indiquez les trajets à l’étranger dans votre demande. Nous vous confirmons avant la location les pays autorisés."]]
    },
    en: {
      step1: "Step 1 of 3 · Selection and period", step2: "Step 2 of 3 · Your details", step3: "Step 3 of 3 · Review",
      daysLabel: "Calculated rental duration", rateLabel: "Daily rate", totalLabel: "Estimated rental price", priceHint: "The price depends on the selected item. Included kilometres, extra kilometres, the deposit and all other conditions are shown per item and communicated before the binding confirmation.",
      trustEye: "Local · transparent · personal", trustTitle: "Your van, directly from your local garage", trust: [["Maintained in our own workshop", "The vehicle is inspected and regularly maintained by us."], ["Local collection", "Personal handover at Autoservice Bettenduerf in Bettendorf."], ["A real contact person", "We review every request and clarify open questions directly with you."]],
      faqEye: "Good to know", faqTitle: "Frequently asked rental questions", faq: [["Is my online request immediately binding?", "No. We check availability and conditions, then send you a personal confirmation."], ["Which driving licence do I need?", "The required category is shown for each vehicle or trailer. It depends on the rented item, towing vehicle and permitted gross weights and is checked before handover."], ["What must I bring when collecting the rental?", "A valid identity card or passport, the appropriate valid driving licence and your reservation confirmation. The same documents are required for every additional driver."], ["May another person drive?", "Only people declared, checked and listed in the rental agreement before handover may drive the vehicle or vehicle-trailer combination."], ["How is the rental price calculated?", "The daily rate, included mileage, additional mileage, deposit and possible late-return charges are shown for each rented item and in your confirmation."], ["Can I change, cancel or extend the reservation?", "Contact us as early as possible. An extension requires our confirmation and depends on availability. Any applicable charges are communicated before the change."], ["Where are collection and return?", "At Autoservice Bettenduerf, 63 rue de Diekirch-Echternach, L-9355 Bettendorf, at the confirmed time."], ["How must the rented item be returned?", "At the agreed time, clean and with the agreed fuel or charge level. The exact rules depend on the rented item. Contact us immediately if delayed."], ["What should I do after an accident, breakdown or damage?", "Secure the location, contact emergency services or police if necessary, document everything with photos and contact us immediately. Do not arrange repairs without our approval."], ["May I drive abroad?", "Mention planned cross-border trips in your request. We confirm the permitted countries before rental."]]
    }
  };

  var CALENDAR_TEXT = {
    lb: { kicker:"Live-Disponibilitéit", title:"Fräi Datumer kucken", help:"Tippt op e fräien oder deels fräien Dag fir den Ufank an duerno op den Enndag.", free:"Alles fräi", partial:"Deels fräi – wielbar", busy:"Alles besat", past:"Net wielbar", prev:"Mount virdrun", next:"Nächste Mount", weekdays:["Mé","Dë","Më","Do","Fr","Sa","So"] },
    de: { kicker:"Live-Verfügbarkeit", title:"Freie Termine ansehen", help:"Tippen Sie auf einen freien oder teilweise freien Starttag und anschließend auf den Endtag.", free:"Alles frei", partial:"Teilweise frei – auswählbar", busy:"Alles belegt", past:"Nicht buchbar", prev:"Vorheriger Monat", next:"Nächster Monat", weekdays:["Mo","Di","Mi","Do","Fr","Sa","So"] },
    fr: { kicker:"Disponibilité en direct", title:"Voir les dates disponibles", help:"Touchez un jour libre ou partiellement libre pour le début, puis le jour de fin.", free:"Tout est libre", partial:"Partiellement libre – sélectionnable", busy:"Tout est occupé", past:"Non réservable", prev:"Mois précédent", next:"Mois suivant", weekdays:["Lu","Ma","Me","Je","Ve","Sa","Di"] },
    en: { kicker:"Live availability", title:"See available dates", help:"Tap an available or partially available start day, then tap the end day.", free:"All available", partial:"Partly available – selectable", busy:"All booked", past:"Unavailable", prev:"Previous month", next:"Next month", weekdays:["Mo","Tu","We","Th","Fr","Sa","Su"] }
  };

  function lang() {
    var l = document.documentElement.getAttribute("lang");
    if (l && T[l]) return l;
    try {
      var s = localStorage.getItem("gk_lang");
      if (s && T[s]) return s;
    } catch (e) {}
    return "lb";
  }
  function t() { return T[lang()] || T.lb; }
  Object.assign(T.lb, {
    from: "Vun (Datum an Auerzäit)", to: "Bis (Datum an Auerzäit)",
    m_from: "Datum an Auerzäit vum Ufank", m_to: "Datum an Auerzäit vum Enn",
    m_daterange: "eng Ennzäit no der Ufankszäit",
    info_eyebrow: "Virun der Ufro",
    info_title: "Esou leeft d’Reservatioun",
    info_intro: "D’Online-Ufro ass nach keng verbindlech Buchung. Mir kontrolléieren d’Disponibilitéit a bestätegen Iech den Zäitraum perséinlech.",
    availability_title: "Disponibilitéit",
    availability_text: "Mir kontrolléieren Är Datumer a mellen eis mat enger definitiver Bestätegung.",
    license_title: "Führerschäin",
    license_text: "Déi néideg Kategorie hänkt vum Gefier, dem Unhänger an der zulässeger Gesamtmass of a gëtt virum Verlee kontrolléiert.",
    terms_title: "Konditiounen",
    terms_text: "Assurance, Kilometer, Ofhuelung, Retour a Storno gi virun der Bestätegung transparent matgedeelt.",
    availability_note: "De Live-Kalenner weist déi aktuell Beleeung. Mir bestätegen all Ufro nach eemol perséinlech.",
    m_past: "en Datum an eng Auerzäit vun elo un"
  });
  Object.assign(T.de, {
    from: "Von (Datum und Uhrzeit)", to: "Bis (Datum und Uhrzeit)",
    m_from: "Startdatum und -uhrzeit", m_to: "Enddatum und -uhrzeit",
    m_daterange: "eine Endzeit nach der Startzeit",
    info_eyebrow: "Vor der Anfrage",
    info_title: "So funktioniert die Reservierung",
    info_intro: "Die Online-Anfrage ist noch keine verbindliche Buchung. Wir prüfen die Verfügbarkeit und bestätigen Ihnen den Zeitraum persönlich.",
    availability_title: "Verfügbarkeit",
    availability_text: "Wir prüfen Ihre Daten und melden uns mit einer endgültigen Bestätigung.",
    license_title: "Führerschein",
    license_text: "Die erforderliche Klasse hängt von Fahrzeug, Anhänger und zulässiger Gesamtmasse ab und wird vor der Vermietung geprüft.",
    terms_title: "Bedingungen",
    terms_text: "Kaution, Versicherung, Kilometer, Abholung, Rückgabe und Stornierung werden vor der Bestätigung transparent mitgeteilt.",
    availability_note: "Der Live-Kalender zeigt die aktuelle Belegung. Jede Anfrage wird zusätzlich persönlich bestätigt.",
    m_past: "ein Datum und eine Uhrzeit ab jetzt"
  });
  Object.assign(T.fr, {
    from: "Du (date et heure)", to: "Au (date et heure)",
    m_from: "date et heure de début", m_to: "date et heure de fin",
    m_daterange: "une heure de fin postérieure au début",
    info_eyebrow: "Avant la demande",
    info_title: "Déroulement de la réservation",
    info_intro: "La demande en ligne ne constitue pas encore une réservation ferme. Nous vérifions la disponibilité et confirmons personnellement la période.",
    availability_title: "Disponibilité",
    availability_text: "Nous vérifions vos dates et vous contactons avec une confirmation définitive.",
    license_title: "Permis de conduire",
    license_text: "La catégorie requise dépend du véhicule, de la remorque et de la masse maximale autorisée; elle est vérifiée avant la location.",
    terms_title: "Conditions",
    terms_text: "L’assurance, le kilométrage, l’enlèvement, le retour et l’annulation sont communiqués clairement avant confirmation.",
    availability_note: "Le calendrier en direct affiche l’occupation actuelle. Chaque demande est ensuite confirmée personnellement.",
    m_past: "une date et une heure à partir de maintenant"
  });
  Object.assign(T.en, {
    from: "From (date and time)", to: "Until (date and time)",
    m_from: "start date and time", m_to: "end date and time",
    m_daterange: "an end time after the start time",
    info_eyebrow: "Before your request",
    info_title: "How the reservation works",
    info_intro: "The online request is not yet a binding booking. We check availability and personally confirm the requested period.",
    availability_title: "Availability",
    availability_text: "We check your dates and contact you with final confirmation.",
    license_title: "Driving licence",
    license_text: "The required category depends on the vehicle, trailer and permitted gross weight and is checked before rental.",
    terms_title: "Conditions",
    terms_text: "Insurance, mileage, collection, return and cancellation terms are communicated clearly before confirmation.",
    availability_note: "The live calendar shows current occupancy. Every request is also confirmed personally.",
    m_past: "a date and time from now onwards"
  });

  Object.assign(T.lb, {
    review_title: "Ufro iwwerpréiwen", review_items: "Auswiel", review_period: "Zäitraum",
    review_contact: "Kontakt", review_empty: "Nach näischt ausgewielt", review_missing: "Nach net uginn",
    review_hint: "Kontrolléiert dës Donnéeën, ier Dir d’Ufro schéckt.",
    terms_html: "Ech hunn d’<a href=\"mietbedingungen.html\" target=\"_blank\" rel=\"noopener\">Locatiouns- a Reservatiounsinformatiounen</a> gelies.",
    m_terms: "Bestätegung vun de Locatiounsinformatiounen",
    busy_title: "Am gewielten Zäitraum net disponibel:",
    busy_hint: "Wielt w.e.g. aner Datumer – oder frot trotzdem un, mir kucken no.",
    busy_period: "schonn reservéiert", availability_error: "D’Live-Disponibilitéit konnt net geluede ginn. Dir kënnt d’Ufro trotzdem schécken; mir kontrolléieren den Zäitraum virun der Bestätegung.",
    availability_summary: "Disponibilitéit vun Ärer Auswiel", availability_free: "fräi am gewielten Zäitraum",
    availability_busy: "net disponibel", availability_remove: "Aus der Auswiel huelen",
    availability_continue: "Dir kënnt mat de fräie Gefierer virufueren. Huelt dofir just dat net disponibelt Gefier aus der Auswiel."
  });
  Object.assign(T.de, {
    review_title: "Anfrage überprüfen", review_items: "Auswahl", review_period: "Zeitraum",
    review_contact: "Kontakt", review_empty: "Noch nichts ausgewählt", review_missing: "Noch nicht angegeben",
    review_hint: "Prüfen Sie diese Angaben, bevor Sie die Anfrage senden.",
    terms_html: "Ich habe die <a href=\"mietbedingungen.html\" target=\"_blank\" rel=\"noopener\">Miet- und Reservierungsinformationen</a> gelesen.",
    m_terms: "Bestätigung der Mietinformationen",
    busy_title: "Im gewählten Zeitraum nicht verfügbar:",
    busy_hint: "Bitte wählen Sie andere Daten – oder fragen Sie trotzdem an, wir prüfen es.",
    busy_period: "bereits reserviert", availability_error: "Die Live-Verfügbarkeit konnte nicht geladen werden. Sie können die Anfrage trotzdem senden; wir prüfen den Zeitraum vor der Bestätigung.",
    availability_summary: "Verfügbarkeit Ihrer Auswahl", availability_free: "im gewählten Zeitraum frei",
    availability_busy: "nicht verfügbar", availability_remove: "Aus der Auswahl entfernen",
    availability_continue: "Sie können mit den verfügbaren Fahrzeugen fortfahren. Entfernen Sie dafür nur das nicht verfügbare Fahrzeug aus Ihrer Auswahl."
  });
  Object.assign(T.fr, {
    review_title: "Vérifier la demande", review_items: "Sélection", review_period: "Période",
    review_contact: "Contact", review_empty: "Aucun élément sélectionné", review_missing: "Non renseigné",
    review_hint: "Vérifiez ces informations avant d’envoyer la demande.",
    terms_html: "J’ai lu les <a href=\"mietbedingungen.html\" target=\"_blank\" rel=\"noopener\">informations de location et de réservation</a>.",
    m_terms: "confirmation des informations de location",
    busy_title: "Indisponible sur la période choisie :",
    busy_hint: "Veuillez choisir d’autres dates – ou envoyez quand même la demande, nous vérifierons.",
    busy_period: "déjà réservé", availability_error: "La disponibilité en direct n’a pas pu être chargée. Vous pouvez tout de même envoyer la demande; nous vérifierons la période avant confirmation.",
    availability_summary: "Disponibilité de votre sélection", availability_free: "disponible pour la période choisie",
    availability_busy: "indisponible", availability_remove: "Retirer de la sélection",
    availability_continue: "Vous pouvez continuer avec les véhicules disponibles. Retirez simplement le véhicule indisponible de votre sélection."
  });
  Object.assign(T.en, {
    review_title: "Review request", review_items: "Selection", review_period: "Period",
    review_contact: "Contact", review_empty: "Nothing selected yet", review_missing: "Not provided yet",
    review_hint: "Check these details before sending your request.",
    terms_html: "I have read the <a href=\"mietbedingungen.html\" target=\"_blank\" rel=\"noopener\">rental and reservation information</a>.",
    m_terms: "confirmation of the rental information",
    busy_title: "Unavailable for the selected period:",
    busy_hint: "Please choose other dates – or send the request anyway, we'll check.",
    busy_period: "already booked", availability_error: "Live availability could not be loaded. You can still send the request; we will check the period before confirming it.",
    availability_summary: "Availability of your selection", availability_free: "available for the selected period",
    availability_busy: "unavailable", availability_remove: "Remove from selection",
    availability_continue: "You can continue with the available vehicles. Simply remove the unavailable vehicle from your selection."
  });

  function $(id) { return document.getElementById(id); }
  function setTxt(id, s) { var el = $(id); if (el) el.textContent = s; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function catLabel(cat) {
    var m = t();
    return cat === "trailer" ? m.cat_trailer_lbl : m.cat_vehicle_lbl;
  }

  /* ---- Professionell Detailansicht (Pop-up) ---- */
  function techLabel(key, L) { var d = DETAIL_L[L] || DETAIL_L.lb; return d[key] || key; }
  function techValue(val, L, key) { var d = DETAIL_L[L] || DETAIL_L.lb; if (val === "__yes__") return d.braked_yes; if (val === "__no__") return d.braked_no; if (key === "loadSpace" && /^L\d+H\d+$/i.test(String(val || "").trim())) return d.largeClosed; return val; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function isRentalCondition(value) {
    return /kautioun|kaution|caution|deposit|versp[eé]idung|verspätung|retard|late return|zousaz[- ]?km|mehrkilometer|kilom[eè]tre suppl|extra kilomet|km pro locatioun|km pro miete|km inclus|km included|vollgetankt|plein fait|full tank|zréckbr[eé]ngen|zurückbringen|retour|return|propper|sauber|propre|clean|konditioun|bedingung|condition/i.test(String(value || ""));
  }
  function featureRow(value, techRows, L) {
    var text = String(value || ""), lower = text.toLowerCase(), d = DETAIL_L[L] || DETAIL_L.lb;
    if (/luedraum|laderaum|volume|load space/.test(lower) && techRows.some(function (r) { return r[0] === "loadSpace"; })) return "";
    if (/\b(?:bis|jusqu|up to)\b/.test(lower) && /\d[\d,.]*\s*t\b/.test(lower)) {
      if (techRows.some(function (r) { return r[0] === "gross"; })) return "";
      var weight = text.match(/\d[\d,.]*\s*t\b/i);
      return '<div class="rd-row"><dt>' + esc(d.gross) + "</dt><dd>" + esc(weight ? weight[0] : text) + "</dd></div>";
    }
    return '<div class="rd-row"><dt>' + esc(d.feature) + "</dt><dd>" + esc(text.replace(/\s*\(L\d+H\d+\)\s*/i, " ").trim()) + "</dd></div>";
  }
  function detailInner(it) {
    var L = lang(), m = t(), d = DETAIL_L[L] || DETAIL_L.lb;
    var nm = esc(it.name[L] || it.name.lb);
    var price = it.priceDay ? '<span class="rd-price">' + it.priceDay + ' €<span> / ' + m.perDay + "</span></span>" : "";
    var media = it.img ? '<img src="' + esc(it.img) + '" alt="' + nm + '" />' : '<span class="rental-ic">' + ICONS[it.icon] + "</span>";
    var allSpecs = it.specs[L] || it.specs.lb || [];
    var rawTech = it.tech || [];
    var detailSpecs = allSpecs.filter(function (s) { return !isRentalCondition(s); }).map(function (s) { return featureRow(s, rawTech, L); }).join("");
    var cond = allSpecs.filter(isRentalCondition).map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");
    var tech = rawTech.map(function (r) { return '<div class="rd-row"><dt>' + esc(techLabel(r[0], L)) + "</dt><dd>" + esc(techValue(r[1], L, r[0])) + "</dd></div>"; }).join("");
    var category = it.cat === "trailer" ? "" : '<span class="rd-cat">' + catLabel(it.cat) + "</span>";
    return '<div class="rd-media">' + media + "</div>" +
      '<div class="rd-head"><div>' + category + "<h3>" + nm + "</h3></div>" + price + "</div>" +
      (it.tagline[L] ? '<p class="rd-tagline">' + esc(it.tagline[L]) + "</p>" : "") +
      (detailSpecs || tech ? "<h4>" + d.secTech + '</h4><dl class="rd-tech">' + detailSpecs + tech + "</dl>" : "") +
      (cond ? "<h4>" + d.secCond + '</h4><ul class="rental-specs">' + cond + "</ul>" : "");
  }
  function openDetail(id) {
    var it = CATALOG.filter(function (x) { return x.id === id; })[0]; if (!it) return;
    var ov = $("rental-detail-overlay"), box = $("rental-detail"); if (!ov || !box) return;
    box.innerHTML = detailInner(it);
    var cl = $("rental-detail-close"); if (cl) cl.setAttribute("aria-label", (DETAIL_L[lang()] || DETAIL_L.lb).close);
    ov.hidden = false; document.body.classList.add("rd-open");
    ov.scrollTop = 0; var mb = ov.querySelector(".rental-detail-modal"); if (mb) mb.scrollTop = 0;
  }
  function closeDetail() { var ov = $("rental-detail-overlay"); if (ov) ov.hidden = true; document.body.classList.remove("rd-open"); }

  function renderCatalog() {
    var grid = $("rental-grid");
    if (!grid) return;
    var L = lang(), m = t();
    grid.innerHTML = "";
    CATALOG.forEach(function (it) {
      if (state.cat !== "all" && it.cat !== state.cat) return;
      var picked = state.selected.indexOf(it.id) !== -1;
      var card = document.createElement("article");
      card.className = "rental-card" + (picked ? " is-selected" : "");
      var specs = keyPoints(it, L)
        .map(function (s) { return '<li><span class="rk-ic" aria-hidden="true">' + esc(s.k) + "</span>" + esc(s.v) + "</li>"; })
        .join("");
      var media = it.img
        ? '<img class="rental-photo" src="' + esc(it.img) + '" alt="' + esc(it.name[L] || it.name.lb) + '" loading="lazy" decoding="async" />'
        : '<span class="rental-ic">' + ICONS[it.icon] + "</span>";
      var priceHtml = it.priceDay
        ? '<span class="rental-price is-day">' + esc(it.priceDay) + ' €<span class="unit"> / ' + esc(m.perDay) + "</span></span>"
        : '<span class="rental-price">' + m.price + "</span>";
      var ribbon = it.cat === "trailer" ? "" : '<span class="rental-ribbon">' + catLabel(it.cat) + "</span>";
      card.innerHTML =
        '<div class="rental-media">' + ribbon + media + "</div>" +
        '<div class="rental-body">' +
        "<h3>" + esc(it.name[L] || it.name.lb) + "</h3>" +
        '<ul class="rental-specs rental-specs-key">' + specs + "</ul>" +
        '<button type="button" class="rental-more" data-detail="' + esc(it.id) + '">' + esc((DETAIL_L[L] || DETAIL_L.lb).more) + " ›</button>" +
        (it.priceDay ? '<p class="rental-paynote">' + esc(it.cat==="trailer"?m.payOnReturnTrailer:m.payOnReturn) + "</p>" : "") +
        '<div class="rental-cardfoot">' +
        priceHtml +
        '<button type="button" class="btn rental-select" data-id="' + esc(it.id) + '">' +
        esc(picked ? "✓ " + m.selected : m.select) +
        "</button></div></div>";
      grid.appendChild(card);
    });
  }

  function renderSelection() {
    var m = t();
    var list = $("rental-sel-list"), empty = $("rental-empty");
    if (!list) return;
    list.innerHTML = "";
    if (!state.selected.length) {
      if (empty) empty.style.display = "";
    } else {
      if (empty) empty.style.display = "none";
      state.selected.forEach(function (id) {
        var it = CATALOG.filter(function (x) { return x.id === id; })[0];
        if (!it) return;
        var li = document.createElement("li");
        li.className = "rental-sel-item";
        li.innerHTML =
          '<span class="rental-sel-ic">' + ICONS[it.icon] + "</span>" +
          '<span class="rental-sel-name">' + esc(it.name[lang()] || it.name.lb) + "</span>" +
          '<button type="button" class="rental-sel-x" data-id="' + esc(id) + '" aria-label="' + esc(m.remove) + '">✕</button>';
        list.appendChild(li);
      });
    }
    // Hidden field used by the server-side bot protection
    updateReview();
  }

  function formatReviewDate(value) {
    if (!value) return "";
    var d = new Date(value);
    if (isNaN(d.getTime())) return value;
    var locales = { lb: "lb-LU", de: "de-LU", fr: "fr-LU", en: "en-GB" };
    return d.toLocaleString(locales[lang()] || "de-LU", {
      weekday: "short", day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }

  function updateReview() {
    var m = t();
    var names = state.selected.map(function (id) {
      var it = CATALOG.filter(function (x) { return x.id === id; })[0];
      return it ? (it.name[lang()] || it.name.lb) : id;
    });
    setTxt("rental-review-items", names.length ? names.join(", ") : m.review_empty);
    var from = $("r-from"), to = $("r-to");
    var period = from && to && from.value && to.value
      ? formatReviewDate(from.value) + " → " + formatReviewDate(to.value)
      : m.review_missing;
    setTxt("rental-review-period", period);
    var contact = [];
    var name = $("r-name"), email = $("r-email"), phone = $("r-phone");
    if (name && name.value.trim()) contact.push(name.value.trim());
    if (email && email.value.trim()) contact.push(email.value.trim());
    if (phone && phone.value.trim()) contact.push(phone.value.trim());
    setTxt("rental-review-contact", contact.length ? contact.join(" · ") : m.review_missing);
    updatePriceSummary();
    renderAvailability();
  }

  function updatePriceSummary() {
    var from = $("r-from"), to = $("r-to");
    var picked = state.selected.map(function (id) { return CATALOG.find(function (it) { return it.id === id; }); }).filter(Boolean);
    var start = from && from.value ? new Date(from.value) : null;
    var end = to && to.value ? new Date(to.value) : null;
    var valid = start && end && !isNaN(start) && !isNaN(end) && end > start && picked.length;
    var days = valid ? Math.max(1, Math.ceil((end - start) / 86400000)) : 0;
    var daily = picked.reduce(function (sum, it) { return sum + Number(it.priceDay || 0); }, 0);
    setTxt("rental-price-days", valid ? days + " × 24 h" : "—");
    setTxt("rental-price-rate", picked.length && daily ? daily.toFixed(2).replace(".00", "") + " €" : "—");
    setTxt("rental-price-total", valid && daily ? (days * daily).toFixed(2).replace(".00", "") + " €" : "—");
  }

  function applyExtraContent() {
    var x = EXTRA[lang()] || EXTRA.lb;
    setTxt("rental-step-1", x.step1); setTxt("rental-step-2", x.step2); setTxt("rental-step-3", x.step3);
    setTxt("rental-price-days-label", x.daysLabel); setTxt("rental-price-rate-label", x.rateLabel); setTxt("rental-price-total-label", x.totalLabel); setTxt("rental-price-disclaimer", x.priceHint);
    setTxt("rental-trust-eyebrow", x.trustEye); setTxt("rental-trust-title", x.trustTitle);
    ["workshop", "local", "contact"].forEach(function (key, i) { setTxt("rental-trust-" + key + "-title", x.trust[i][0]); setTxt("rental-trust-" + key + "-text", x.trust[i][1]); });
    setTxt("rental-faq-eyebrow", x.faqEye); setTxt("rental-faq-title", x.faqTitle);
    var faq = $("rental-faq-list");
    if (faq) faq.innerHTML = x.faq.map(function (row, i) { return '<details' + (i === 0 ? " open" : "") + '><summary>' + row[0] + '</summary><p>' + row[1] + '</p></details>'; }).join("");
  }

  function fetchAvailability() {
    state.availabilityError = false;
    try {
      fetch(API_BASE + "/availability", { headers: { Accept: "application/json" } })
        .then(function (r) { if (!r.ok) throw new Error("availability"); return r.json(); })
        .then(function (d) { state.busy = (d && d.busy) || []; state.availabilityError = false; renderAvailability(); })
        .catch(function () { state.busy = []; state.availabilityError = true; renderAvailability(); });
    } catch (e) { state.busy = []; state.availabilityError = true; renderAvailability(); }
  }

  function itemMatchesBooking(it, booking) {
    var key = (it.name.de || it.name.lb).toLowerCase();
    var type = it.cat === "trailer" ? "trailer" : (it.icon === "car" ? "car" : "van");
    return String(booking.veh || "").split(",").some(function (raw) {
      var n = raw.trim().toLowerCase();
      if (n === key || n.indexOf(key) !== -1 || key.indexOf(n) !== -1) return true;
      if (type === "van") return /transporter|lieferwagen|utilitaire|\bvan\b/.test(n);
      if (type === "trailer") return /anhänger|unhänger|remorque|trailer/.test(n);
      return /personenwagen|voiture|\bauto\b|\bcar\b/.test(n);
    });
  }

  function selectedBusyIntervals() {
    var intervals = [];
    state.selected.forEach(function (id) {
      var it = CATALOG.filter(function (x) { return x.id === id; })[0];
      if (!it) return;
      state.busy.forEach(function (b) {
        if (itemMatchesBooking(it, b)) intervals.push({ item: it, from: b.from, to: b.to });
      });
    });
    return intervals;
  }

  function isoDay(date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }

  function fillRentalTimes() {
    [["r-from-time", "08:00"], ["r-to-time", "17:00"]].forEach(function (entry) {
      var select = $(entry[0]); if (!select) return;
      select.innerHTML = "";
      for (var minutes = 6 * 60; minutes <= 19 * 60; minutes += 30) {
        var value = String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
        var option = document.createElement("option"); option.value = value; option.textContent = value;
        if (value === entry[1]) option.defaultSelected = true;
        select.appendChild(option);
      }
      select.value = entry[1];
    });
  }

  function syncRentalDateTime(prefix) {
    var hidden = $(prefix), date = $(prefix + "-date"), time = $(prefix + "-time");
    if (hidden) hidden.value = date && date.value && time && time.value ? date.value + "T" + time.value : "";
    if (prefix === "r-from") {
      var toDate = $("r-to-date"); if (toDate) toDate.min = date && date.value ? date.value : toDate.min;
    }
  }

  function setRentalDateTime(prefix, date, time) {
    var dateInput = $(prefix + "-date"), timeInput = $(prefix + "-time");
    if (dateInput) dateInput.value = date || "";
    if (timeInput && time) timeInput.value = time;
    syncRentalDateTime(prefix);
  }

  function calendarDayStatus(date) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    if (date < today) return "past";
    var current = new Date();
    if (date.getTime() === today.getTime() && current.getHours() * 60 + current.getMinutes() >= 18 * 60 + 30) return "past";
    if (state.availabilityError) return "unknown";
    var start = isoDay(date) + "T00:00";
    var nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    var end = isoDay(nextDate) + "T00:00";
    var selectedItems = state.selected.map(function (id) {
      return CATALOG.find(function (item) { return item.id === id; });
    }).filter(Boolean);
    var busyCount = selectedItems.filter(function (item) {
      return state.busy.some(function (booking) {
        return itemMatchesBooking(item, booking) && booking.from < end && booking.to > start;
      });
    }).length;
    if (!busyCount) return "free";
    if (busyCount < selectedItems.length) return "partial";
    return "busy";
  }

  function renderCalendar() {
    var shell = $("rental-calendar"), grid = $("rental-calendar-grid"), weekdays = $("rental-calendar-weekdays");
    if (!shell || !grid || !weekdays) return;
    shell.hidden = !state.selected.length;
    if (!state.selected.length) return;
    var c = CALENDAR_TEXT[lang()] || CALENDAR_TEXT.lb;
    setTxt("rental-calendar-kicker", c.kicker); setTxt("rental-calendar-title", c.title);
    setTxt("rental-calendar-help", c.help); setTxt("rental-calendar-free", c.free);
    setTxt("rental-calendar-partial", c.partial); setTxt("rental-calendar-busy-label", c.busy); setTxt("rental-calendar-past", c.past);
    var prev = $("rental-calendar-prev"), next = $("rental-calendar-next");
    if (prev) prev.setAttribute("aria-label", c.prev); if (next) next.setAttribute("aria-label", c.next);
    weekdays.innerHTML = c.weekdays.map(function (d) { return "<span>" + d + "</span>"; }).join("");
    var month = state.calendarMonth;
    setTxt("rental-calendar-month", new Intl.DateTimeFormat(lang() === "lb" ? "lb-LU" : lang(), { month:"long", year:"numeric" }).format(month));
    var firstOffset = (month.getDay() + 6) % 7;
    var count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    var fromValue = (($("r-from") || {}).value || "").slice(0, 10), toValue = (($("r-to") || {}).value || "").slice(0, 10);
    var html = "";
    for (var blank = 0; blank < firstOffset; blank++) html += '<span class="rental-calendar-blank" aria-hidden="true"></span>';
    for (var day = 1; day <= count; day++) {
      var date = new Date(month.getFullYear(), month.getMonth(), day), iso = isoDay(date), status = calendarDayStatus(date);
      var chosen = iso === fromValue || iso === toValue, inRange = fromValue && toValue && iso > fromValue && iso < toValue;
      var disabled = status === "past" || status === "unknown" || status === "busy";
      var label = iso + " – " + (c[status] || c.past);
      html += '<button type="button" role="gridcell" class="rental-calendar-day is-' + status + (chosen ? " is-chosen" : "") + (inRange ? " is-range" : "") + '" data-date="' + iso + '" aria-label="' + label + '"' + (disabled ? " disabled" : "") + '><span>' + day + '</span></button>';
    }
    grid.innerHTML = html;
  }

  function selectCalendarDay(iso) {
    var from = $("r-from"), to = $("r-to"); if (!from || !to) return;
    var start = from.value.slice(0, 10), end = to.value.slice(0, 10);
    if (!start || (start && end) || iso < start) {
      var startTime = "08:00", now = new Date();
      if (iso === isoDay(now)) {
        var rounded = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30;
        rounded = Math.max(6 * 60, Math.min(19 * 60, rounded));
        startTime = String(Math.floor(rounded / 60)).padStart(2, "0") + ":" + String(rounded % 60).padStart(2, "0");
      }
      setRentalDateTime("r-from", iso, startTime); setRentalDateTime("r-to", "", "17:00");
    } else {
      setRentalDateTime("r-to", iso, "17:00");
      if (to.value <= from.value) {
        var parts = from.value.slice(11).split(":"), nextMinutes = Math.min(19 * 60, Number(parts[0]) * 60 + Number(parts[1]) + 30);
        var nextTime = String(Math.floor(nextMinutes / 60)).padStart(2, "0") + ":" + String(nextMinutes % 60).padStart(2, "0");
        setRentalDateTime("r-to", iso, nextTime);
      }
    }
    updateReview();
  }

  function availabilityForSelection() {
    var from = $("r-from"), to = $("r-to");
    var cFrom = from && from.value, cTo = to && to.value;
    if (!cFrom || !cTo || cTo <= cFrom || !state.selected.length) return [];
    return state.selected.map(function (id) {
      var item = CATALOG.find(function (x) { return x.id === id; });
      if (!item) return null;
      var periods = state.busy.filter(function (b) {
        return itemMatchesBooking(item, b) && b.from < cTo && b.to > cFrom;
      }).map(function (b) { return { from: b.from, to: b.to }; });
      return { id: id, name: item.name[lang()] || item.name.lb, busy: periods.length > 0, periods: periods };
    }).filter(Boolean);
  }

  function busyForSelection() {
    var hits = [];
    availabilityForSelection().forEach(function (status) {
      status.periods.forEach(function (period) {
        hits.push({ id: status.id, name: status.name, from: period.from, to: period.to });
      });
    });
    return hits;
  }

  function renderAvailability() {
    var box = $("rental-busy");
    renderCalendar();
    if (!box) return;
    var m = t();
    box.classList.remove("is-mixed", "is-all-free");
    if (state.availabilityError) {
      box.innerHTML = '<p class="rental-busy-title">⚠ ' + m.availability_error + "</p>";
      box.hidden = false;
      return;
    }
    var statuses = availabilityForSelection();
    if (!statuses.length) { box.hidden = true; box.innerHTML = ""; return; }
    var hits = busyForSelection();
    if (statuses.length > 1) {
      var rows = statuses.map(function (status) {
        if (!status.busy) {
          return '<li class="rental-availability-item is-free"><span><b>✓ ' + esc(status.name) + '</b><small>' + esc(m.availability_free) + '</small></span></li>';
        }
        var periods = status.periods.map(function (period) {
          return formatReviewDate(period.from) + " → " + formatReviewDate(period.to);
        }).join(" · ");
        return '<li class="rental-availability-item is-busy"><span><b>✕ ' + esc(status.name) + '</b><small>' + esc(m.availability_busy) + ': ' + esc(periods) + '</small></span><button type="button" class="rental-availability-remove" data-remove-unavailable="' + esc(status.id) + '">' + esc(m.availability_remove) + '</button></li>';
      }).join("");
      box.classList.toggle("is-mixed", hits.length > 0 && hits.length < statuses.length);
      box.classList.toggle("is-all-free", hits.length === 0);
      box.innerHTML = '<p class="rental-busy-title">' + esc(m.availability_summary) + '</p><ul class="rental-availability-list">' + rows + '</ul>' + (hits.length ? '<p class="rental-busy-hint">' + esc(m.availability_continue) + '</p>' : '');
      box.querySelectorAll("[data-remove-unavailable]").forEach(function (button) {
        button.addEventListener("click", function () { toggle(button.getAttribute("data-remove-unavailable")); });
      });
      box.hidden = false;
      return;
    }
    if (!hits.length) { box.hidden = true; box.innerHTML = ""; return; }
    var items = hits.map(function (h) {
      return "<li><b>" + esc(h.name) + "</b> – " + esc(m.busy_period) + ": " + esc(formatReviewDate(h.from)) + " → " + esc(formatReviewDate(h.to)) + "</li>";
    }).join("");
    box.innerHTML = '<p class="rental-busy-title">⚠ ' + esc(m.busy_title) + "</p><ul>" + items + '</ul><p class="rental-busy-hint">' + esc(m.busy_hint) + "</p>";
    box.hidden = false;
  }

  function toggle(id) {
    var i = state.selected.indexOf(id);
    if (i === -1) state.selected.push(id);
    else state.selected.splice(i, 1);
    renderCatalog();
    renderSelection();
  }

  function applyStatics() {
    var m = t();
    setTxt("rsoon-eyebrow", m.soon_eyebrow);
    setTxt("rsoon-title", m.soon_title);
    setTxt("rsoon-text", m.soon_text);
    setTxt("rsoon-cta", m.soon_cta);
    setTxt("rsoon-back", m.soon_back);
    setTxt("rental-dev-badge-txt", m.dev_badge);
    setTxt("rental-eyebrow", m.eyebrow);
    setTxt("rental-title", m.title);
    setTxt("rental-sub", m.sub);
    setTxt("rental-sel-h", m.sel_h);
    setTxt("rental-empty", m.empty);
    setTxt("rental-form-h", m.form_h);
    setTxt("lbl-r-from", m.from);
    setTxt("lbl-r-to", m.to);
    var fromTime = $("r-from-time"), toTime = $("r-to-time");
    if (fromTime) fromTime.setAttribute("aria-label", m.from + " · 06:00–19:00");
    if (toTime) toTime.setAttribute("aria-label", m.to + " · 06:00–19:00");
    setTxt("lbl-r-name", m.name);
    setTxt("lbl-r-email", m.email);
    setTxt("lbl-r-phone", m.phone);
    setTxt("lbl-r-message", m.message);
    var pv = $("r-privacy-text");
    if (pv) {
      var link = '<a href="datenschutz.html" target="_blank" rel="noopener">' + m.privacy_link + "</a>";
      pv.innerHTML = m.privacy.replace(m.privacy_link, link);
    }
    setTxt("rental-submit", m.submit);
    setTxt("rental-note", m.note);
    setTxt("rental-info-eyebrow", m.info_eyebrow);
    setTxt("rental-info-title", m.info_title);
    setTxt("rental-info-intro", m.info_intro);
    setTxt("rental-info-availability-title", m.availability_title);
    setTxt("rental-info-availability-text", m.availability_text);
    setTxt("rental-info-license-title", m.license_title);
    setTxt("rental-info-license-text", m.license_text);
    setTxt("rental-info-terms-title", m.terms_title);
    setTxt("rental-info-terms-text", m.terms_text);
    setTxt("rental-availability-note", m.availability_note);
    setTxt("rental-review-title", m.review_title);
    setTxt("rental-review-items-label", m.review_items);
    setTxt("rental-review-period-label", m.review_period);
    setTxt("rental-review-contact-label", m.review_contact);
    setTxt("rental-review-hint", m.review_hint);
    var termsText = $("r-terms-text"); if (termsText) termsText.innerHTML = m.terms_html;
    var ph = $("r-phone"); if (ph) ph.placeholder = m.phone_ph;
    // filter chip labels
    document.querySelectorAll("#rental-filter .rental-chip").forEach(function (b) {
      var c = b.getAttribute("data-cat");
      var span = b.querySelector("span");
      if (span) span.textContent = c === "all" ? m.cat_all : c === "trailer" ? m.cat_trailer : m.cat_vehicle;
    });
    document.querySelectorAll("[data-i18n='rental_nav']").forEach(function (el) { el.textContent = m.nav; });
  }

  function wireFilter() {
    var f = $("rental-filter");
    if (!f) return;
    f.addEventListener("click", function (e) {
      var b = e.target.closest(".rental-chip");
      if (!b) return;
      state.cat = b.getAttribute("data-cat");
      f.querySelectorAll(".rental-chip").forEach(function (x) {
        var on = x === b;
        x.classList.toggle("active", on);
        x.setAttribute("aria-pressed", on ? "true" : "false");
      });
      renderCatalog();
    });
  }

  function wireGrid() {
    var grid = $("rental-grid");
    if (grid)
      grid.addEventListener("click", function (e) {
        var d = e.target.closest(".rental-more");
        if (d) { openDetail(d.getAttribute("data-detail")); return; }
        var b = e.target.closest(".rental-select");
        if (b) toggle(b.getAttribute("data-id"));
      });
    var list = $("rental-sel-list");
    if (list)
      list.addEventListener("click", function (e) {
        var b = e.target.closest(".rental-sel-x");
        if (b) toggle(b.getAttribute("data-id"));
      });
    var ov = $("rental-detail-overlay"), cl = $("rental-detail-close");
    if (cl) cl.addEventListener("click", closeDetail);
    if (ov) ov.addEventListener("click", function (e) { if (e.target === ov) closeDetail(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && ov && !ov.hidden) closeDetail(); });
  }

  function wireCalendar() {
    var grid = $("rental-calendar-grid"), prev = $("rental-calendar-prev"), next = $("rental-calendar-next");
    if (grid) grid.addEventListener("click", function (e) {
      var day = e.target.closest(".rental-calendar-day[data-date]");
      if (day && !day.disabled) selectCalendarDay(day.getAttribute("data-date"));
    });
    if (prev) prev.addEventListener("click", function () {
      var current = new Date(); current = new Date(current.getFullYear(), current.getMonth(), 1);
      var candidate = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() - 1, 1);
      if (candidate >= current) state.calendarMonth = candidate;
      renderCalendar();
    });
    if (next) next.addEventListener("click", function () {
      state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() + 1, 1);
      renderCalendar();
    });
  }

  function mark(el, bad) {
    if (!el) return;
    var targets = el.type === "hidden" ? document.querySelectorAll('.rental-datetime[data-for="' + el.id + '"] input, .rental-datetime[data-for="' + el.id + '"] select') : [el];
    targets.forEach(function (target) { target.classList.toggle("field-invalid", !!bad); });
  }

  function localDateTimeValue(date) {
    return date.getFullYear() + "-" +
      String(date.getMonth() + 1).padStart(2, "0") + "-" +
      String(date.getDate()).padStart(2, "0") + "T" +
      String(date.getHours()).padStart(2, "0") + ":" +
      String(date.getMinutes()).padStart(2, "0");
  }

  function handleSubmit(e) {
    var f = e.target;
    if (!f || f.id !== "rental-form") return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var m = t();
    var st = $("rental-status");
    st.className = "form-status";
    st.textContent = "";

    var from = $("r-from"), to = $("r-to"), name = $("r-name"), email = $("r-email"), privacy = $("r-privacy"), terms = $("r-terms");
    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email.value || "").trim());
    var miss = [];

    if (!state.selected.length) miss.push(m.m_items);
    mark(from, false); mark(to, false); mark(name, false); mark(email, false);
    if (!from.value) { miss.push(m.m_from); mark(from, true); }
    if (!to.value) { miss.push(m.m_to); mark(to, true); }
    var now = new Date();
    var nowIso = localDateTimeValue(now);
    if (from.value && from.value < nowIso) { miss.push(m.m_past); mark(from, true); }
    if (to.value && to.value < nowIso) { if (miss.indexOf(m.m_past) === -1) miss.push(m.m_past); mark(to, true); }
    if (from.value && to.value && to.value <= from.value) { miss.push(m.m_daterange); mark(to, true); }
    if (!name.value.trim()) { miss.push(m.m_name); mark(name, true); }
    if (!emailOk) { miss.push(m.m_email); mark(email, true); }
    var priv = privacy.closest(".privacy-confirm");
    if (!privacy.checked) { miss.push(m.m_privacy); if (priv) priv.classList.add("privacy-invalid"); }
    else if (priv) priv.classList.remove("privacy-invalid");
    var termsWrap = terms.closest(".terms-confirm");
    if (!terms.checked) { miss.push(m.m_terms); if (termsWrap) termsWrap.classList.add("privacy-invalid"); }
    else if (termsWrap) termsWrap.classList.remove("privacy-invalid");

    if (miss.length) {
      st.className = "form-status err";
      st.textContent = m.missing + " " + miss.join(", ") + ".";
      var first = f.querySelector(".field-invalid, .privacy-invalid input");
      if (first && first.focus) first.focus();
      return;
    }

    var hp = f.querySelector('[name="_honey"]');
    if (hp && hp.value) { st.className = "form-status ok"; st.textContent = m.ok; f.reset(); return; }
    var loaded = Number((f.querySelector('[name="_loaded_at"]') || {}).value || 0);
    if (loaded && Date.now() - loaded < 2500) { st.className = "form-status err"; st.textContent = m.senderr; return; }

    var btn = $("rental-submit");
    if (btn) btn.disabled = true;
    st.className = "form-status";
    st.textContent = m.sending;

    var vehNames = state.selected.map(function (id) { var it = CATALOG.filter(function (x) { return x.id === id; })[0]; return it ? (it.name.de || it.name.lb) : id; }).join(", ");
    fetch("https://garage-admin.autoservicebettenduerf.lu/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        veh: vehNames, from: from.value, to: to.value,
        name: name.value.trim(), email: email.value.trim(),
        phone: (($("r-phone") || {}).value || "").trim(),
        msg: (($("r-message") || {}).value || "").trim(),
        lang: lang(), privacy: privacy.checked, terms: terms.checked,
        website: hp ? hp.value : "", loadedAt: loaded,
      }),
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (data) { if (!r.ok || !data.ok) { var err = new Error(data.error || "http"); err.code = data.error; throw err; } return data; }); })
      .then(function (data) {
        var ref = "AB-L-" + String((data && data.id) || "").padStart(5, "0");
        var received = {
          lb: "Merci! Är Ufro ass ukomm. Är Referenz ass ",
          de: "Danke! Ihre Anfrage ist eingegangen. Ihre Referenz lautet ",
          fr: "Merci ! Votre demande est bien arrivée. Votre référence est ",
          en: "Thank you! Your request has arrived. Your reference is "
        };
        st.className = "form-status ok";
        st.textContent = (received[lang()] || received.lb) + ref + ".";
        f.reset();
        state.selected = [];
        renderCatalog();
        renderSelection();
      })
      .catch(function (err) { st.className = "form-status err"; st.textContent = err && err.code === "unavailable" ? m.unavailable : (err && err.code === "rate_limited" ? m.rate : m.senderr); })
      .then(function () { if (btn) btn.disabled = false; });
  }

  function wireClear() {
    ["r-from-date", "r-from-time", "r-to-date", "r-to-time", "r-name", "r-email", "r-phone", "r-message"].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener("input", function () {
        if (id.indexOf("r-from-") === 0) { syncRentalDateTime("r-from"); mark($("r-from"), false); }
        else if (id.indexOf("r-to-") === 0) { syncRentalDateTime("r-to"); mark($("r-to"), false); }
        else mark(el, false);
        updateReview();
      });
    });
    var priv = $("r-privacy");
    if (priv) priv.addEventListener("change", function () {
      var p = priv.closest(".privacy-confirm");
      if (p && priv.checked) p.classList.remove("privacy-invalid");
    });
    var terms = $("r-terms");
    if (terms) terms.addEventListener("change", function () {
      var p = terms.closest(".terms-confirm");
      if (p && terms.checked) p.classList.remove("privacy-invalid");
    });
  }

  function refresh() {
    applyStatics();
    applyExtraContent();
    renderCatalog();
    renderSelection();
  }

  function init() {
    applyStatics();
    applyExtraContent();
    renderCatalog();
    renderSelection();
    wireFilter();
    wireGrid();
    wireCalendar();
    wireClear();
    document.querySelectorAll('form [name="_loaded_at"]').forEach(function (field) { field.value = String(Date.now()); });
    fillRentalTimes();
    var fromDate = $("r-from-date"), toDate = $("r-to-date");
    var now = new Date();
    now.setSeconds(0, 0);
    var remainder = now.getMinutes() % 30;
    if (remainder) now.setMinutes(now.getMinutes() + (30 - remainder));
    var minDateTime = localDateTimeValue(now);
    var minDay = minDateTime.slice(0, 10);
    if (fromDate) {
      fromDate.min = minDay;
      fromDate.addEventListener("change", function () {
        if (toDate) {
          toDate.min = fromDate.value || minDay;
          if (toDate.value && fromDate.value && toDate.value < fromDate.value) { toDate.value = ""; syncRentalDateTime("r-to"); }
        }
        renderAvailability();
      });
    }
    if (toDate) { toDate.min = minDay; toDate.addEventListener("change", renderAvailability); }
    fetchAvailability();
    loadFleet();
    document.addEventListener("submit", handleSubmit, true);
    document.querySelectorAll(".lang-select").forEach(function (s) {
      s.addEventListener("change", function () { setTimeout(refresh, 0); });
    });
    var y = $("year"); if (y) y.textContent = new Date().getFullYear();
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
