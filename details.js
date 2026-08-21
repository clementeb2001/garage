/* Autoservice Bettenduerf – Service-Detailer (mehrsprocheg) */
(function () {
  var DLAB = {
    lb: {
      back: "Zréck bei d’Servicer",
      points: "Leeschtungen am Iwwerbléck",
      more: "Méi gewuer ginn",
      cta: "Rendez-vous ufroen",
    },
    de: {
      back: "Zurück zu den Leistungen",
      points: "Leistungen im Überblick",
      more: "Mehr erfahren",
      cta: "Termin anfragen",
    },
    fr: {
      back: "Retour aux prestations",
      points: "Prestations en un coup d’œil",
      more: "En savoir plus",
      cta: "Prendre rendez-vous",
    },
    en: {
      back: "Back to services",
      points: "Services at a glance",
      more: "Learn more",
      cta: "Book appointment",
    },
  };
  var DETAILS = {
    lb: {
      wartung: {
        title: "Entretien, Inspektioun & Uelegwiessel",
        intro:
          "Reegelméissegen Entretien, Inspektioun an Uelegwiessel no de Virgabe vum Hiersteller – fir Sécherheet, Zouverlässegkeet a Wäerterhalt vun Ärem Won.",
        points: [
          "Inspektioun nom Hierstellerplang",
          "Ueleg- a Filterwiessel (Ueleg, Loft, Interieur)",
          "Kontroll vun alle Fëllstänn a Flëssegkeeten",
          "Kontroll vu Bremsen, Pneuen a Beliichtung",
          "Dokumentatioun am Serviceheft (Garantie bleift erhalen)",
        ],
      },
      reifen: {
        title: "Pneueservice",
        intro:
          "Vum saisonale Wiessel bis zur Alagerung – alles ronderëm Är Pneuen aus enger Hand.",
        points: [
          "Pneuen op- an ofmontéieren an ausbalancéieren",
          "Summer-, Wanter- a Ganzjorespneuen",
          "Alagerung vun de Pneuen",
          "Kontroll vum Profil a vum Pneuendrock",
        ],
      },
      bremsen: {
        title: "Bremsen & Fuerwierk",
        intro:
          "Sécher Bremsen an en intakt Fuerwierk sinn entscheedend fir Är Sécherheet.",
        points: [
          "Bremsbeläg a Bremsscheiwen",
          "Kontroll vu Bremsflëssegkeet a Leitungen",
          "Stoussdämpfer a Fiederen",
          "Achsvermiessung",
        ],
      },
      diagnose: {
        title: "Feelerdiagnos & Elektrik",
        intro:
          "Modern Diagnostik an e kompetenten Elektrikservice: vun der Warnluucht bis zur Batterie a Bordelektronik – mir fannen d’Ursaach a behiewe se.",
        points: [
          "Ausliese vum Feelerspäicher",
          "Diagnos vu Motor- an Elektronikproblemer",
          "Batterietest a -wiessel (och Start-Stopp)",
          "Beliichtung, Sécherungen a Bordelektronik",
          "Kloer Erklärung an Devis",
        ],
      },
      klima: {
        title: "Klimaservice",
        intro:
          "Eng gutt ënnerhale Klimaanlag suergt fir frësch Loft am Summer a kloer Siicht dat ganzt Joer iwwer.",
        points: [
          "Kontroll a Fëllung vun der Klimaanlag",
          "Desinfektioun géint Geroch a Keimen",
          "Kontroll op Ondichtegkeeten",
          "Wiessel vum Interieursfilter",
        ],
      },
      controle: {
        title: "Contrôle technique",
        intro:
          "Mir preparéieren Äre Won optimal op de Contrôle technique vir – a begleeden Iech bei de Rendez-vous.",
        points: [
          "Kontroll vun alle relevante Punkten am Viraus",
          "Behiewe vu klenge Mängel virum Contrôle",
          "Begleedung bei de Contrôle technique",
          "Nokontroll, wann néideg",
        ],
      },
      tuning: {
        title: "Tuning & Motorsport",
        intro:
          "Egal ob Rallye- oder Rennstreckevirbereedung, Ofsenkung oder méi Leeschtung – mir bréngen Äre Won op den nächsten Niveau.",
        points: [
          "Rallye- a Rennstreckevirbereedung",
          "Verstellbar Fuerwierker an Ofsenkung",
          "Sportbremsen a Sportfuerwierk",
          "Individuell Ofstëmmung no Wonsch",
        ],
      },
      karosserie: {
        title: "Karosserie & Lackéierung",
        intro:
          "Krazerten, Bëlzen oder Ëmbauten – fir datt Äre Won erëm propper ausgesäit.",
        points: [
          "Karosserieaarbechten a Reparatur no engem Accident",
          "Spoiler a Verbreederungen",
          "Lackéierung a Smart Repair",
          "Opbereedung a Politur",
        ],
      },
    },
    de: {
      wartung: {
        title: "Wartung, Inspektion & Ölwechsel",
        intro:
          "Regelmäßige Wartung, Inspektion und Ölwechsel nach Herstellervorgaben – für Sicherheit, Zuverlässigkeit und Werterhalt Ihres Fahrzeugs.",
        points: [
          "Inspektion nach Herstellerplan",
          "Öl- und Filterwechsel (Öl, Luft, Innenraum)",
          "Kontrolle aller Füllstände und Flüssigkeiten",
          "Prüfung von Bremsen, Reifen und Beleuchtung",
          "Serviceeintrag ins Serviceheft (Garantie bleibt erhalten)",
        ],
      },
      reifen: {
        title: "Reifenservice",
        intro:
          "Vom saisonalen Wechsel bis zur Einlagerung – alles rund um Ihre Reifen aus einer Hand.",
        points: [
          "Reifenmontage und Auswuchten",
          "Sommer-, Winter- und Ganzjahresreifen",
          "Reifeneinlagerung",
          "Kontrolle von Profil und Reifendruck",
        ],
      },
      bremsen: {
        title: "Bremsen & Fahrwerk",
        intro:
          "Sichere Bremsen und ein intaktes Fahrwerk sind entscheidend für Ihre Sicherheit.",
        points: [
          "Bremsbeläge und Bremsscheiben",
          "Prüfung von Bremsflüssigkeit und Leitungen",
          "Stoßdämpfer und Federn",
          "Achsvermessung",
        ],
      },
      diagnose: {
        title: "Fehlerdiagnose & Elektrik",
        intro:
          "Moderne Diagnose und kompetenter Elektrik-Service: von der Warnleuchte bis zu Batterie und Bordelektronik – wir finden die Ursache und beheben sie.",
        points: [
          "Auslesen des Fehlerspeichers",
          "Diagnose von Motor- und Elektronikproblemen",
          "Batterietest und -wechsel (auch Start-Stopp)",
          "Beleuchtung, Sicherungen und Bordelektronik",
          "Klare Erklärung und Kostenvoranschlag",
        ],
      },
      klima: {
        title: "Klimaservice",
        intro:
          "Ein gepflegtes Klimasystem sorgt für kühle Luft im Sommer und klare Sicht das ganze Jahr.",
        points: [
          "Prüfung und Befüllung der Klimaanlage",
          "Desinfektion gegen Gerüche und Keime",
          "Kontrolle auf Undichtigkeiten",
          "Wechsel des Innenraumfilters",
        ],
      },
      controle: {
        title: "Contrôle Technique",
        intro:
          "Wir bereiten Ihr Fahrzeug optimal auf die technische Kontrolle vor – und begleiten Sie zum Termin.",
        points: [
          "Vorab-Check aller prüfrelevanten Punkte",
          "Behebung kleiner Mängel vor der Kontrolle",
          "Begleitung zum Contrôle Technique",
          "Nachkontrolle bei Bedarf",
        ],
      },
      tuning: {
        title: "Tuning & Motorsport",
        intro:
          "Ob Rallye- oder Rennstreckenvorbereitung, Tieferlegung oder mehr Leistung – wir bringen Ihr Fahrzeug auf das nächste Level.",
        points: [
          "Rallye- und Rennstreckenvorbereitung",
          "Gewindefahrwerke und Tieferlegung",
          "Sportbremsen und -fahrwerk",
          "Individuelle Abstimmung nach Wunsch",
        ],
      },
      karosserie: {
        title: "Karosserie & Lackierung",
        intro:
          "Kratzer, Dellen oder Umbauten – für ein makelloses Erscheinungsbild Ihres Fahrzeugs.",
        points: [
          "Karosseriearbeiten und Unfallinstandsetzung",
          "Spoiler und Verbreiterungen",
          "Lackierung und Smart-Repair",
          "Aufbereitung und Politur",
        ],
      },
    },
    fr: {
      wartung: {
        title: "Entretien, inspection & vidange",
        intro:
          "Entretien, inspection et vidange selon les préconisations du constructeur – pour la sécurité, la fiabilité et la valeur de votre véhicule.",
        points: [
          "Entretien selon le plan constructeur",
          "Vidange et remplacement des filtres (huile, air, habitacle)",
          "Contrôle de tous les niveaux et fluides",
          "Vérification des freins, pneus et éclairage",
          "Inscription au carnet d’entretien (garantie préservée)",
        ],
      },
      reifen: {
        title: "Service pneus",
        intro:
          "Du changement saisonnier au stockage – tout pour vos pneus au même endroit.",
        points: [
          "Montage et équilibrage des pneus",
          "Pneus été, hiver et toutes saisons",
          "Stockage des pneus",
          "Contrôle de l’usure et de la pression",
        ],
      },
      bremsen: {
        title: "Freins & suspension",
        intro:
          "Des freins sûrs et un châssis en bon état sont essentiels pour votre sécurité.",
        points: [
          "Plaquettes et disques de frein",
          "Contrôle du liquide et des conduites de frein",
          "Amortisseurs et ressorts",
          "Géométrie des trains",
        ],
      },
      diagnose: {
        title: "Diagnostic & électricité",
        intro:
          "Diagnostic moderne et service électrique complet : du voyant à la batterie et l’électronique embarquée – nous trouvons la cause et la résolvons.",
        points: [
          "Lecture de la mémoire de défauts",
          "Diagnostic moteur et électronique",
          "Test et remplacement de batterie (start-stop inclus)",
          "Éclairage, fusibles et électronique embarquée",
          "Explication claire et devis",
        ],
      },
      klima: {
        title: "Service climatisation",
        intro:
          "Une climatisation entretenue assure de l’air frais en été et une bonne visibilité toute l’année.",
        points: [
          "Contrôle et recharge de la climatisation",
          "Désinfection contre odeurs et bactéries",
          "Recherche de fuites",
          "Remplacement du filtre d’habitacle",
        ],
      },
      controle: {
        title: "Contrôle technique",
        intro:
          "Nous préparons votre véhicule au contrôle technique – et vous accompagnons au rendez-vous.",
        points: [
          "Pré-contrôle de tous les points concernés",
          "Réparation des petits défauts avant le contrôle",
          "Accompagnement au contrôle technique",
          "Contre-visite si nécessaire",
        ],
      },
      tuning: {
        title: "Tuning & sport auto",
        intro:
          "Préparation rallye ou circuit, rabaissement ou gain de puissance – nous emmenons votre véhicule au niveau supérieur.",
        points: [
          "Préparation rallye et circuit",
          "Combinés filetés et rabaissement",
          "Freins et châssis sport",
          "Réglage personnalisé selon vos souhaits",
        ],
      },
      karosserie: {
        title: "Carrosserie & peinture",
        intro:
          "Rayures, bosses ou transformations – pour une apparence impeccable de votre véhicule.",
        points: [
          "Travaux de carrosserie et réparation après sinistre",
          "Ailerons et élargisseurs",
          "Peinture et smart repair",
          "Rénovation et polissage",
        ],
      },
    },
    en: {
      wartung: {
        title: "Maintenance, inspection & oil change",
        intro:
          "Servicing, inspection and oil change to manufacturer specifications – for the safety, reliability and value of your vehicle.",
        points: [
          "Servicing to the manufacturer schedule",
          "Oil and filter change (oil, air, cabin)",
          "Check of all fluid levels",
          "Inspection of brakes, tyres and lights",
          "Service entry in the service book (warranty kept)",
        ],
      },
      reifen: {
        title: "Tyre service",
        intro:
          "From seasonal changes to storage – everything for your tyres from one place.",
        points: [
          "Tyre fitting and balancing",
          "Summer, winter and all-season tyres",
          "Tyre storage",
          "Tread and pressure check",
        ],
      },
      bremsen: {
        title: "Brakes & suspension",
        intro:
          "Safe brakes and a sound suspension are essential for your safety.",
        points: [
          "Brake pads and discs",
          "Check of brake fluid and lines",
          "Shock absorbers and springs",
          "Wheel alignment",
        ],
      },
      diagnose: {
        title: "Diagnostics & electrics",
        intro:
          "Modern diagnostics and full electrical service: from warning lights to battery and on-board electronics – we find the cause and fix it.",
        points: [
          "Reading the fault memory",
          "Engine and electronics diagnosis",
          "Battery test and replacement (incl. start-stop)",
          "Lighting, fuses and on-board electronics",
          "Clear explanation and quote",
        ],
      },
      klima: {
        title: "Air-con service",
        intro:
          "A well-maintained air-con system means cool air in summer and clear vision all year.",
        points: [
          "Air-con check and refill",
          "Disinfection against odours and germs",
          "Leak inspection",
          "Cabin filter replacement",
        ],
      },
      controle: {
        title: "Roadworthiness prep",
        intro:
          "We prepare your vehicle for the technical inspection – and accompany you to the appointment.",
        points: [
          "Pre-check of all relevant points",
          "Fixing minor faults before the inspection",
          "Accompaniment to the Contrôle Technique",
          "Re-inspection if needed",
        ],
      },
      tuning: {
        title: "Tuning & motorsport",
        intro:
          "Whether rally or track preparation, lowering or more power – we take your car to the next level.",
        points: [
          "Rally and race-track preparation",
          "Coilovers and lowering",
          "Sport brakes and suspension",
          "Individual setup to your wishes",
        ],
      },
      karosserie: {
        title: "Bodywork & paint",
        intro:
          "Scratches, dents or conversions – for a flawless look of your vehicle.",
        points: [
          "Bodywork and accident repair",
          "Spoilers and wide-body",
          "Paintwork and smart repair",
          "Detailing and polishing",
        ],
      },
    },
  };
  var SLUG2KEY = {
    wartung: "svc1",
    reifen: "svc3",
    bremsen: "svc4",
    diagnose: "svc5",
    klima: "svc6",
    controle: "svc7",
    tuning: "svc9",
    karosserie: "svc10",
  };
  var TIPS = {
    lb: {
      "tip-winter": {
        title: "Sécher duerch de Wanter",
        intro:
          "Keelt, Salz an naass Stroosse fuerderen Ären Auto. Mat e puer Kontrolle kommt Dir sécher duerch de Wanter.",
        points: [
          "Wanterpneue mat genuch Profil (min. 4 mm)",
          "Batterie testen – Keelt kascht Kapazitéit",
          "Frostschutz vu Kill- a Scheiwewëschwaasser",
          "Beliichtung a Wëscherblieder préiwen",
          "Dichtungen a Schlässer géint d’Afréiere fleegen",
        ],
      },
      "tip-fruehjahr": {
        title: "Fréijoerskontroll",
        intro:
          "No der kaler Saison ass et Zäit, de Won op de Summer virzebereeden – vun de Pneue bis zur Klimaanlag.",
        points: [
          "Vu Wanter- op Summerpneue wiesselen",
          "Klimaservice virun der Hëtzt",
          "Pollefilter (Interieursfilter) wiesselen",
          "Ënnerbuedem a Lack no Salzréckstänn préiwen",
          "Wëschwaasser opfëllen a Wëscher préiwen",
        ],
      },
      "tip-summer": {
        title: "Virun der Vakanz",
        intro:
          "Ier et an d’Vakanz geet, soll Äre Won op déi laang Rees virbereet sinn – voll belueden a bei Hëtzt.",
        points: [
          "Pneuen a Pneuendrock (och d’Reserverad) préiwen",
          "Ueleg a Flëssegkeeten kontrolléieren",
          "Kill- a Klimaanlag bei Hëtzt préiwen",
          "Bremsen op laang Streck préiwen",
          "Beliichtung, Warndräieck a Verbandskëscht",
        ],
      },
      "tip-herbst": {
        title: "Fit fir den Hierscht & Contrôle",
        intro:
          "Kuerz Deeg, naass Stroossen an de Contrôle technique stinn un – elo lount sech eng Kontroll.",
        points: [
          "Beliichtung ronderëm préiwen (kuerz Deeg)",
          "Bremsen a Bremsflëssegkeet kontrolléieren",
          "Pneueprofil virum Wanter préiwen",
          "Wëscher a Wëschwaasser fir naass Wieder",
          "Optimal Virbereedung op de Contrôle technique",
        ],
      },
    },
    de: {
      "tip-winter": {
        title: "Sicher durch den Winter",
        intro:
          "Kälte, Salz und nasse Straßen fordern Ihr Auto. Mit ein paar Checks kommen Sie sicher durch den Winter.",
        points: [
          "Winterreifen mit ausreichend Profil (min. 4 mm)",
          "Batterie testen – Kälte kostet Kapazität",
          "Frostschutz von Kühl- und Scheibenwischwasser",
          "Beleuchtung und Wischerblätter prüfen",
          "Dichtungen und Schlösser gegen Einfrieren pflegen",
        ],
      },
      "tip-fruehjahr": {
        title: "Frühjahrs-Check",
        intro:
          "Nach der kalten Jahreszeit wird das Auto fit für den Sommer gemacht – von den Reifen bis zur Klimaanlage.",
        points: [
          "Von Winter- auf Sommerreifen wechseln",
          "Klimaservice vor der Hitze",
          "Pollenfilter (Innenraumfilter) wechseln",
          "Unterboden und Lack auf Salzrückstände prüfen",
          "Wischwasser auffüllen und Wischer prüfen",
        ],
      },
      "tip-summer": {
        title: "Vor der Urlaubsreise",
        intro:
          "Bevor es in den Urlaub geht, sollte Ihr Auto fit für die lange Reise sein – voll beladen und bei Hitze.",
        points: [
          "Reifen und Reifendruck (auch Reserverad) prüfen",
          "Öl und Flüssigkeiten kontrollieren",
          "Kühl- und Klimaanlage bei Hitze prüfen",
          "Bremsen für die lange Strecke prüfen",
          "Beleuchtung, Warndreieck und Verbandskasten",
        ],
      },
      "tip-herbst": {
        title: "Fit für Herbst & Contrôle",
        intro:
          "Kurze Tage, nasse Straßen und der Contrôle Technique stehen an – jetzt lohnt sich ein Check.",
        points: [
          "Beleuchtung rundum prüfen (kurze Tage)",
          "Bremsen und Bremsflüssigkeit kontrollieren",
          "Reifenprofil vor dem Winter prüfen",
          "Wischer und Wischwasser für nasses Wetter",
          "Optimale Vorbereitung auf den Contrôle Technique",
        ],
      },
    },
    fr: {
      "tip-winter": {
        title: "En sécurité pendant l’hiver",
        intro:
          "Le froid, le sel et les routes mouillées sollicitent votre voiture. Quelques vérifications suffisent pour passer l’hiver sereinement.",
        points: [
          "Pneus hiver avec profondeur suffisante (min. 4 mm)",
          "Test de la batterie – le froid réduit la capacité",
          "Antigel du liquide de refroidissement et lave-glace",
          "Éclairage et balais d’essuie-glace",
          "Entretien des joints et serrures contre le gel",
        ],
      },
      "tip-fruehjahr": {
        title: "Check de printemps",
        intro:
          "Après la saison froide, on prépare la voiture pour l’été – des pneus à la climatisation.",
        points: [
          "Passer des pneus hiver aux pneus été",
          "Service climatisation avant la chaleur",
          "Remplacer le filtre à pollen (habitacle)",
          "Vérifier le soubassement et la peinture (sel)",
          "Faire le plein de lave-glace et vérifier les balais",
        ],
      },
      "tip-summer": {
        title: "Avant les vacances",
        intro:
          "Avant de partir en vacances, votre voiture doit être prête pour un long trajet – chargée et par forte chaleur.",
        points: [
          "Vérifier pneus et pression (roue de secours incluse)",
          "Contrôler l’huile et les niveaux",
          "Vérifier refroidissement et clim par forte chaleur",
          "Contrôler les freins pour les longs trajets",
          "Éclairage, triangle et trousse de secours",
        ],
      },
      "tip-herbst": {
        title: "Prêt pour l’automne & le contrôle",
        intro:
          "Jours courts, routes mouillées et contrôle technique à venir – un check s’impose.",
        points: [
          "Vérifier tout l’éclairage (jours courts)",
          "Contrôler freins et liquide de frein",
          "Vérifier la profondeur des pneus avant l’hiver",
          "Essuie-glaces et lave-glace pour la pluie",
          "Préparation optimale au contrôle technique",
        ],
      },
    },
    en: {
      "tip-winter": {
        title: "Safe through winter",
        intro:
          "Cold, salt and wet roads put your car to the test. A few checks keep you safe through winter.",
        points: [
          "Winter tyres with enough tread (min. 4 mm)",
          "Battery test – cold reduces capacity",
          "Antifreeze in coolant and washer fluid",
          "Check lights and wiper blades",
          "Care for seals and locks against freezing",
        ],
      },
      "tip-fruehjahr": {
        title: "Spring check",
        intro:
          "After the cold season it’s time to get the car ready for summer – from tyres to air-con.",
        points: [
          "Switch from winter to summer tyres",
          "Air-con service before the heat",
          "Replace the pollen (cabin) filter",
          "Check underbody and paint for road-salt",
          "Top up washer fluid and check wipers",
        ],
      },
      "tip-summer": {
        title: "Before your holiday",
        intro:
          "Before you set off on holiday, your car should be ready for the long trip – fully loaded and in the heat.",
        points: [
          "Check tyres and pressure (incl. spare)",
          "Check oil and fluid levels",
          "Check cooling and air-con in the heat",
          "Check brakes for the long journey",
          "Lights, warning triangle and first-aid kit",
        ],
      },
      "tip-herbst": {
        title: "Ready for autumn & inspection",
        intro:
          "Short days, wet roads and the Contrôle Technique ahead – now’s the time for a check.",
        points: [
          "Check all lights (short days)",
          "Check brakes and brake fluid",
          "Check tyre tread before winter",
          "Wipers and washer fluid for wet weather",
          "Optimal prep for the Contrôle Technique",
        ],
      },
    },
  };
  var TIPIMG = {
    "tip-winter": "assets/seasons/winter.webp",
    "tip-fruehjahr": "assets/seasons/spring.webp",
    "tip-summer": "assets/seasons/summer.webp",
    "tip-herbst": "assets/seasons/autumn.webp",
  };
  var TIPBACK = {
    lb: "Zréck bei d’Tipps",
    de: "Zurück zu den Tipps",
    fr: "Retour aux conseils",
    en: "Back to tips",
  };
  ["lb", "de", "fr", "en"].forEach(function (L) {
    for (var k in TIPS[L]) {
      DETAILS[L][k] = TIPS[L][k];
      SLUG2KEY[k] = "tip";
    }
  });
  window.SERVICE_DETAILS = { DLAB: DLAB, DETAILS: DETAILS, SLUG2KEY: SLUG2KEY };
  function lang() {
    var l = document.documentElement.getAttribute("lang");
    if (l && DLAB[l]) return l;
    try {
      var s = localStorage.getItem("gk_lang");
      if (s && DLAB[s]) return s;
    } catch (e) {}
    return "lb";
  }
  function updateCardMore() {
    var m = (DLAB[lang()] || DLAB.lb).more;
    document.querySelectorAll(".card-more").forEach(function (s) {
      s.textContent = m;
    });
    document.querySelectorAll(".card-cover").forEach(function (a) {
      var art = a.closest(".card");
      var h = art && art.querySelector("h3");
      if (h) a.setAttribute("aria-label", h.textContent);
    });
  }
  function qs(k) {
    var m = new RegExp("[?&]" + k + "=([^&]+)").exec(location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }
  function updateServiceSeo(slug, L, d) {
    var url = new URL(location.href);
    url.searchParams.set("s", slug);
    if (L === "lb") url.searchParams.delete("lang");
    else url.searchParams.set("lang", L);
    var absolute = url.origin + url.pathname + url.search;
    var title = d.title + " – Autoservice Bettenduerf";
    document.title = title;
    var values = {
      'meta[name="description"]': d.intro,
      'meta[property="og:title"]': title,
      'meta[property="og:description"]': d.intro,
      'meta[property="og:url"]': absolute,
    };
    Object.keys(values).forEach(function (selector) {
      var el = document.querySelector(selector);
      if (el) el.setAttribute("content", values[selector]);
    });
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = absolute;
    ["lb", "de", "fr", "en"].forEach(function (code) {
      var link = document.querySelector('link[rel="alternate"][hreflang="' + code + '"]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "alternate";
        link.hreflang = code;
        document.head.appendChild(link);
      }
      var alt = new URL(absolute);
      if (code === "lb") alt.searchParams.delete("lang");
      else alt.searchParams.set("lang", code);
      link.href = alt.href;
    });
    var defaultLink = document.querySelector('link[rel="alternate"][hreflang="x-default"]');
    if (!defaultLink) {
      defaultLink = document.createElement("link");
      defaultLink.rel = "alternate";
      defaultLink.hreflang = "x-default";
      document.head.appendChild(defaultLink);
    }
    var defaultUrl = new URL(absolute);
    defaultUrl.searchParams.delete("lang");
    defaultLink.href = defaultUrl.href;
  }
  function renderService() {
    var app = document.getElementById("svc-app");
    if (!app) return;
    var slug = qs("s");
    if (!slug || !SLUG2KEY[slug]) slug = "wartung";
    var L = lang();
    var lab = DLAB[L] || DLAB.lb;
    var d = (DETAILS[L] || DETAILS.lb)[slug];
    document.getElementById("svc-title").textContent = d.title;
    var _back = document.getElementById("svc-back");
    if (slug.indexOf("tip-") === 0) {
      _back.setAttribute("href", "index.html#saison");
      _back.textContent = "← " + (TIPBACK[L] || TIPBACK.lb);
    } else {
      _back.setAttribute("href", "index.html#leistungen");
      _back.textContent = "← " + lab.back;
    }
    document.getElementById("svc-intro").textContent = d.intro;
    document.getElementById("svc-points-h").textContent = lab.points;
    var ul = document.getElementById("svc-points");
    ul.innerHTML = "";
    d.points.forEach(function (p) {
      var li = document.createElement("li");
      li.textContent = p;
      ul.appendChild(li);
    });
    document.getElementById("svc-cta").textContent = lab.cta;
    var hero = document.getElementById("svc-hero");
    var imagePath = TIPIMG[slug] || "assets/services/" + slug + ".jpg";
    if (hero) hero.style.backgroundImage = "url('" + imagePath + "')";
    updateServiceSeo(slug, L, d);
  }
  function init() {
    updateCardMore();
    renderService();
    document.querySelectorAll(".lang-select").forEach(function (select) {
      select.addEventListener("change", function () {
        setTimeout(function () {
          updateCardMore();
          renderService();
        }, 0);
      });
    });
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
