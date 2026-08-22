/* Autoservice Bettenduerf – Shop (Demo-Katalog, mehrsprocheg) */
(function () {
  "use strict";

  /* ---------- Marken & Modeller ---------- */
  var BRANDS = {
    "Abarth": ["500", "595", "695", "124 Spider"],
    "Alfa Romeo": ["MiTo", "Giulietta", "Giulia", "Stelvio", "Tonale", "Junior", "147", "156", "159", "Brera", "GT", "Spider"],
    "Alpina": ["B3", "B4", "B5", "D3", "D5", "XD3"],
    "Alpine": ["A110"],
    "Aston Martin": ["Vantage", "DB11", "DB12", "DBS", "DBX", "Rapide"],
    "Audi": ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "Q2", "Q3", "Q4 e-tron", "Q5", "Q7", "Q8", "e-tron", "e-tron GT", "TT", "R8", "RS3", "RS4", "RS6", "S3", "S4"],
    "Bentley": ["Continental GT", "Flying Spur", "Bentayga"],
    "BMW": ["1er", "2er", "3er", "4er", "5er", "6er", "7er", "8er", "X1", "X2", "X3", "X4", "X5", "X6", "X7", "Z4", "i3", "i4", "i5", "i7", "iX", "iX1", "iX3", "M2", "M3", "M4", "M5"],
    "Bugatti": ["Chiron", "Veyron"],
    "BYD": ["Atto 3", "Dolphin", "Seal", "Seal U", "Han", "Tang"],
    "Cadillac": ["Escalade", "CT5", "XT4", "Lyriq"],
    "Chevrolet": ["Spark", "Aveo", "Cruze", "Captiva", "Orlando", "Trax", "Camaro", "Corvette"],
    "Chrysler": ["300C", "Voyager", "PT Cruiser", "Crossfire"],
    "Citroën": ["C1", "C2", "C3", "C3 Aircross", "C4", "C4 X", "C4 Cactus", "C5", "C5 Aircross", "C5 X", "Berlingo", "SpaceTourer", "Jumpy", "Jumper", "Ami"],
    "Cupra": ["Leon", "Formentor", "Born", "Ateca", "Terramar", "Tavascan"],
    "Dacia": ["Sandero", "Logan", "Duster", "Jogger", "Spring", "Lodgy", "Dokker"],
    "Daihatsu": ["Cuore", "Sirion", "Terios", "Materia"],
    "DS Automobiles": ["DS 3", "DS 4", "DS 7", "DS 9"],
    "Ferrari": ["Roma", "Portofino", "296", "F8", "SF90", "812", "Purosangue", "488", "California"],
    "Fiat": ["500", "500e", "500L", "500X", "Panda", "Punto", "Tipo", "Doblò", "Ducato", "Fiorino", "Qubo", "Bravo", "Multipla"],
    "Ford": ["Ka", "Fiesta", "Focus", "Puma", "Mondeo", "Kuga", "EcoSport", "Mustang", "Mustang Mach-E", "Galaxy", "S-Max", "C-Max", "Transit", "Transit Custom", "Transit Connect", "Ranger", "Explorer"],
    "Genesis": ["G70", "G80", "G90", "GV60", "GV70", "GV80"],
    "Honda": ["Jazz", "Civic", "Accord", "CR-V", "HR-V", "ZR-V", "e:Ny1", "CR-Z", "Insight"],
    "Hyundai": ["i10", "i20", "i30", "i40", "Bayon", "Kona", "Tucson", "Santa Fe", "Ioniq", "Ioniq 5", "Ioniq 6", "ix20", "ix35", "Nexo"],
    "Infiniti": ["Q30", "Q50", "QX30", "QX70"],
    "Isuzu": ["D-Max"],
    "Jaguar": ["XE", "XF", "XJ", "E-Pace", "F-Pace", "I-Pace", "F-Type"],
    "Jeep": ["Avenger", "Renegade", "Compass", "Cherokee", "Grand Cherokee", "Wrangler", "Gladiator"],
    "KGM / SsangYong": ["Tivoli", "Korando", "Rexton", "Musso", "Torres"],
    "Kia": ["Picanto", "Rio", "Ceed", "ProCeed", "XCeed", "Stonic", "Niro", "Sportage", "Sorento", "EV6", "EV9", "Soul", "Venga", "Carens"],
    "Lada": ["Niva", "Vesta", "Granta"],
    "Lamborghini": ["Huracán", "Aventador", "Urus", "Revuelto", "Gallardo"],
    "Lancia": ["Ypsilon", "Delta", "Musa"],
    "Land Rover": ["Defender", "Discovery", "Discovery Sport", "Range Rover", "Range Rover Sport", "Range Rover Evoque", "Range Rover Velar", "Freelander"],
    "Leapmotor": ["T03", "C10"],
    "Lexus": ["CT", "IS", "ES", "LS", "UX", "NX", "RX", "RZ", "RC", "LC"],
    "Lotus": ["Elise", "Exige", "Evora", "Emira", "Eletre"],
    "Lucid": ["Air"],
    "Lynk & Co": ["01"],
    "Maserati": ["Ghibli", "Quattroporte", "Levante", "Grecale", "GranTurismo", "MC20"],
    "Maxus": ["Deliver 9", "eDeliver 3", "T90", "Euniq"],
    "Mazda": ["2", "3", "6", "CX-3", "CX-30", "CX-5", "CX-60", "CX-80", "MX-5", "MX-30"],
    "McLaren": ["570S", "720S", "Artura", "GT"],
    "Mercedes-Benz": ["A-Klasse", "B-Klasse", "C-Klasse", "E-Klasse", "S-Klasse", "CLA", "CLS", "GLA", "GLB", "GLC", "GLE", "GLS", "G-Klasse", "SLK / SLC", "SL", "AMG GT", "EQA", "EQB", "EQC", "EQE", "EQS", "V-Klasse", "Vito", "Sprinter", "Citan"],
    "MG": ["MG3", "MG4", "MG5", "ZS", "HS", "Marvel R", "Cyberster"],
    "Mini": ["Cooper", "Cooper SE", "Clubman", "Countryman", "Cabrio", "Paceman"],
    "Mitsubishi": ["Space Star", "ASX", "Eclipse Cross", "Outlander", "L200", "Colt", "Lancer", "Pajero"],
    "Nio": ["ET5", "ET7", "EL6", "EL7"],
    "Nissan": ["Micra", "Note", "Leaf", "Juke", "Qashqai", "X-Trail", "Ariya", "Townstar", "Navara", "370Z", "GT-R", "Pulsar"],
    "Opel": ["Corsa", "Astra", "Insignia", "Adam", "Karl", "Crossland", "Grandland", "Mokka", "Combo", "Zafira", "Meriva", "Vivaro", "Movano"],
    "Ora": ["03 (Funky Cat)"],
    "Peugeot": ["108", "208", "2008", "308", "3008", "408", "508", "5008", "Rifter", "Partner", "Expert", "Boxer", "207", "307", "RCZ", "iOn"],
    "Polestar": ["2", "3", "4"],
    "Porsche": ["911", "718 Cayman", "718 Boxster", "Panamera", "Macan", "Cayenne", "Taycan"],
    "Renault": ["Twingo", "Clio", "Captur", "Mégane", "Mégane E-Tech", "Arkana", "Kadjar", "Austral", "Scénic", "Espace", "Kangoo", "Trafic", "Master", "Zoe", "Talisman", "Koleos", "Laguna"],
    "Rolls-Royce": ["Ghost", "Phantom", "Cullinan", "Wraith", "Spectre"],
    "Rover": ["25", "45", "75"],
    "Saab": ["9-3", "9-5", "900", "9000"],
    "Seat": ["Mii", "Ibiza", "Leon", "Arona", "Ateca", "Tarraco", "Alhambra"],
    "Škoda": ["Citigo", "Fabia", "Scala", "Octavia", "Superb", "Kamiq", "Karoq", "Kodiaq", "Enyaq", "Rapid", "Roomster", "Yeti"],
    "smart": ["fortwo", "forfour", "#1", "#3"],
    "Subaru": ["Impreza", "XV / Crosstrek", "Forester", "Outback", "Legacy", "BRZ", "Levorg", "Solterra"],
    "Suzuki": ["Alto", "Celerio", "Swift", "Ignis", "Baleno", "S-Cross", "Vitara", "Jimny", "SX4", "Swace", "Across"],
    "Tesla": ["Model 3", "Model S", "Model X", "Model Y"],
    "Toyota": ["Aygo", "Aygo X", "Yaris", "Yaris Cross", "Corolla", "Corolla Cross", "C-HR", "RAV4", "Camry", "Prius", "Highlander", "bZ4X", "GR86", "GR Yaris", "GR Supra", "Land Cruiser", "Hilux", "Proace", "Auris", "Avensis", "Verso"],
    "Volkswagen": ["up!", "Polo", "Golf", "Jetta", "Passat", "Arteon", "T-Cross", "T-Roc", "Taigo", "Tiguan", "Touareg", "Touran", "Sharan", "Caddy", "Transporter", "Multivan", "Amarok", "ID.3", "ID.4", "ID.5", "ID.7", "ID. Buzz", "Beetle", "Scirocco"],
    "Volvo": ["V40", "V60", "V90", "S60", "S90", "XC40", "XC60", "XC90", "C40", "EX30", "EX90", "V50", "C30"],
    "Xpeng": ["G6", "G9", "P7"],
  };

  /* Ergänzungen: historische, internationale und Nutzfahrzeug-Marken sowie genauere Modellreihen. */
  var EXTRA_BRANDS = {
    "Aiways": ["U5", "U6"], "Austin": ["Allegro", "Ambassador", "Maestro", "Maxi", "Metro", "Mini", "Montego", "Princess"],
    "Austin-Healey": ["100", "3000", "Sprite"], "Autobianchi": ["A112", "Bianchina", "Y10"],
    "BAIC": ["Beijing X35", "Beijing X55", "EU5"], "Bedford": ["Blitz", "CF", "Rascal"],
    "Borgward": ["BX5", "BX7", "Isabella"], "Buick": ["Century", "Enclave", "Encore", "LaCrosse", "LeSabre", "Regal", "Riviera"],
    "Chery": ["Arrizo 5", "Omoda 5", "Tiggo 4", "Tiggo 7", "Tiggo 8"],
    "Daewoo": ["Espero", "Evanda", "Kalos", "Lacetti", "Lanos", "Leganza", "Matiz", "Nexia", "Nubira", "Tacuma"],
    "DFSK": ["Fengon 500", "Fengon 5", "Fengon 7", "Seres 3"], "Fisker": ["Karma", "Ocean"],
    "GMC": ["Acadia", "Canyon", "Hummer EV", "Sierra", "Terrain", "Yukon"],
    "Great Wall": ["Haval H6", "Hover", "Ora 03", "Poer", "Steed"], "Holden": ["Astra", "Barina", "Commodore", "Monaro", "Ute"],
    "Hummer": ["H1", "H2", "H3"], "Ineos": ["Grenadier"], "Iveco": ["Daily", "Eurocargo", "Massif"],
    "LEVC": ["TX", "VN5"], "Lincoln": ["Aviator", "Continental", "Corsair", "MKX", "Navigator"],
    "Mahindra": ["Bolero", "Goa", "KUV100", "Scorpio", "Thar", "XUV500"],
    "Mercury": ["Cougar", "Grand Marquis", "Milan", "Monterey", "Mountaineer"],
    "Morgan": ["3 Wheeler", "4/4", "Aero 8", "Plus 4", "Plus 6"],
    "Oldsmobile": ["Alero", "Aurora", "Cutlass", "Intrigue", "Silhouette"], "Omoda": ["5", "E5"],
    "Plymouth": ["Barracuda", "Neon", "Prowler", "Voyager"],
    "Pontiac": ["Bonneville", "Firebird", "G6", "Grand Prix", "Solstice", "Trans Sport"],
    "RAM": ["1500", "2500", "3500", "ProMaster"], "Saturn": ["Aura", "Ion", "Outlook", "Sky", "Vue"],
    "Scion": ["FR-S", "iQ", "tC", "xB", "xD"], "Seres": ["3", "5"],
    "Simca": ["1000", "1100", "1300", "1301", "Horizon", "Matra Rancho"],
    "Tata": ["Aria", "Indica", "Indigo", "Nano", "Safari", "Xenon"],
    "Triumph": ["Dolomite", "Herald", "Spitfire", "Stag", "TR4", "TR6", "TR7"],
    "VinFast": ["VF 6", "VF 7", "VF 8", "VF 9"], "Wey": ["Coffee 01", "Coffee 02", "05"], "Zeekr": ["001", "7X", "X"]
  };
  var MODEL_SUPPLEMENTS = {
    "Audi": ["50", "80", "90", "100", "200", "Cabriolet", "Coupé", "V8"],
    "BMW": ["1502", "1602", "1802", "2002", "E3", "E9", "M1", "Z1", "Z3", "Z8"],
    "Citroën": ["2CV", "AX", "BX", "C6", "C8", "CX", "DS", "Dyane", "Evasion", "GS", "Nemo", "Saxo", "Visa", "Xantia", "XM", "Xsara"],
    "Fiat": ["124", "125", "126", "127", "128", "131", "Barchetta", "Cinquecento", "Coupé", "Croma", "Freemont", "Grande Punto", "Idea", "Marea", "Palio", "Scudo", "Sedici", "Seicento", "Stilo", "Ulysse", "Uno"],
    "Ford": ["Capri", "Cougar", "Escort", "Fusion", "Granada", "Maverick", "Orion", "Probe", "Scorpio", "Sierra", "StreetKa", "Taunus"],
    "Mercedes-Benz": ["190", "Coupé", "CLC", "CLK", "GLK", "M-Klasse", "R-Klasse", "Vaneo"],
    "Nissan": ["100 NX", "200 SX", "300 ZX", "Almera", "Bluebird", "Cube", "Maxima", "Murano", "Pathfinder", "Patrol", "Primera", "Serena", "Sunny", "Terrano"],
    "Opel": ["Ampera", "Antara", "Ascona", "Calibra", "Cascada", "Frontera", "Kadett", "Manta", "Monterey", "Omega", "Rekord", "Senator", "Signum", "Sintra", "Tigra", "Vectra"],
    "Peugeot": ["104", "106", "107", "205", "206", "306", "405", "406", "407", "505", "605", "607", "806", "807", "Bipper"],
    "Renault": ["4", "5", "9", "11", "19", "21", "25", "Avantime", "Clio Campus", "Fuego", "Modus", "Safrane", "Vel Satis", "Wind"],
    "Toyota": ["Carina", "Celica", "Corolla Verso", "HiAce", "IQ", "MR2", "Paseo", "Previa", "Starlet", "Supra", "Urban Cruiser"],
    "Volkswagen": ["181", "Bora", "Corrado", "Derby", "Eos", "Fox", "Käfer", "Karmann Ghia", "Lupo", "New Beetle", "Phaeton", "Santana", "Vento"],
    "Volvo": ["240", "340", "440", "460", "480", "740", "760", "850", "940", "960", "S40", "S70", "S80", "V70", "XC70"]
  };
  Object.keys(EXTRA_BRANDS).forEach(function (brand) { BRANDS[brand] = EXTRA_BRANDS[brand]; });
  Object.keys(MODEL_SUPPLEMENTS).forEach(function (brand) {
    BRANDS[brand] = BRANDS[brand].concat(MODEL_SUPPLEMENTS[brand]).filter(function (model, index, list) { return list.indexOf(model) === index; });
  });

  /* ---------- Demo-Katalog ----------
     cat = Kategorie-Schlëssel, fits = Marken oder "all" */
  var PRODUCTS = [
    {
      id: 1,
      cat: "brems",
      name: "Bremsbeläg vir",
      art: "BR-1042",
      price: "34,90",
      fits: ["Volkswagen", "Audi", "Škoda", "Seat"],
    },
    {
      id: 2,
      cat: "brems",
      name: "Bremsscheiwen (Paar)",
      art: "BR-2210",
      price: "58,00",
      fits: ["Volkswagen", "Audi", "Škoda", "Seat"],
    },
    {
      id: 3,
      cat: "brems",
      name: "Bremsbeläg hannen",
      art: "BR-1088",
      price: "29,50",
      fits: ["BMW", "Mini"],
    },
    {
      id: 4,
      cat: "filter",
      name: "Ueleg-Filter",
      art: "FI-3301",
      price: "7,90",
      fits: "all",
    },
    {
      id: 5,
      cat: "filter",
      name: "Loftfilter",
      art: "FI-3355",
      price: "12,40",
      fits: ["Ford", "Volvo", "Mazda"],
    },
    {
      id: 6,
      cat: "filter",
      name: "Interieursfilter (Pollen)",
      art: "FI-3390",
      price: "11,20",
      fits: "all",
    },
    {
      id: 7,
      cat: "oel",
      name: "Motorueleg 5W-30 (5 L)",
      art: "OL-5030",
      price: "39,90",
      fits: "all",
    },
    {
      id: 8,
      cat: "oel",
      name: "Motorueleg 5W-40 (5 L)",
      art: "OL-5040",
      price: "42,50",
      fits: "all",
    },
    {
      id: 9,
      cat: "oel",
      name: "Killerflëssegkeet G12 (5 L)",
      art: "OL-1200",
      price: "18,90",
      fits: "all",
    },
    {
      id: 10,
      cat: "zuend",
      name: "Zündkäerzen-Set (4)",
      art: "ZU-4401",
      price: "24,90",
      fits: ["Volkswagen", "Audi", "Seat", "Škoda", "Toyota"],
    },
    {
      id: 11,
      cat: "zuend",
      name: "Zündspull",
      art: "ZU-4460",
      price: "33,00",
      fits: ["Peugeot", "Citroën", "Renault"],
    },
    {
      id: 12,
      cat: "elektrik",
      name: "Startbatterie 60Ah",
      art: "EL-6000",
      price: "89,00",
      fits: "all",
    },
    {
      id: 13,
      cat: "elektrik",
      name: "Startbatterie 74Ah AGM",
      art: "EL-7400",
      price: "139,00",
      fits: "all",
    },
    {
      id: 14,
      cat: "elektrik",
      name: "Lambdasonde",
      art: "EL-2205",
      price: "46,50",
      fits: ["Ford", "Opel", "Volkswagen"],
    },
    {
      id: 15,
      cat: "fahrwerk",
      name: "Stoussdämpfer vir",
      art: "FW-8810",
      price: "64,00",
      fits: ["Renault", "Dacia", "Nissan"],
    },
    {
      id: 16,
      cat: "fahrwerk",
      name: "Koppelstang",
      art: "FW-8120",
      price: "14,90",
      fits: "all",
    },
    {
      id: 17,
      cat: "fahrwerk",
      name: "Radlager vir",
      art: "FW-8500",
      price: "38,00",
      fits: ["Peugeot", "Citroën", "Opel"],
    },
    {
      id: 18,
      cat: "licht",
      name: "Gléilampen-Set H7 (2)",
      art: "LI-0072",
      price: "9,90",
      fits: "all",
    },
    {
      id: 19,
      cat: "licht",
      name: "Scheiwewëscher-Set (Paar)",
      art: "LI-4400",
      price: "19,90",
      fits: "all",
    },
    {
      id: 20,
      cat: "motor",
      name: "Zännriemen-Kit",
      art: "MO-9900",
      price: "96,00",
      fits: ["Volkswagen", "Audi", "Škoda", "Seat"],
    },
    {
      id: 21,
      cat: "motor",
      name: "Keilrippenriemen",
      art: "MO-3120",
      price: "16,50",
      fits: "all",
    },
    {
      id: 22,
      cat: "reifen",
      name: "Ganzjorespneu 205/55 R16",
      art: "RE-2055",
      price: "79,00",
      fits: "all",
    },
    {
      id: 23,
      cat: "reifen",
      name: "Wanterpneu 195/65 R15",
      art: "RE-1965",
      price: "69,00",
      fits: "all",
    },
    {
      id: 24,
      cat: "brems",
      name: "Bremsflëssegkeet DOT4 (1 L)",
      art: "BR-0041",
      price: "8,50",
      fits: "all",
    },
  ];

  var CATICON = {
    brems: "🛑",
    filter: "🌀",
    oel: "🛢️",
    zuend: "⚡",
    elektrik: "🔋",
    fahrwerk: "🔧",
    licht: "💡",
    motor: "⚙️",
    reifen: "🛞",
  };

  /* ---------- Iwwersetzungen ---------- */
  var T = {
    lb: {
      eyebrow: "Onlineshop",
      title: "Autodeeler fir all Won",
      sub: "Sich no Bezeechnung, Artikelnummer – oder direkt no Ärem Won.",
      tab_artikel: "Artikel",
      tab_fahrzeug: "Won",
      ph_text: "Bezeechnung oder Artikelnummer …",
      btn_text: "Sichen",
      opt_brand: "Marke wielen",
      opt_model: "Modell wielen",
      opt_year: "Baujoer",
      ph_brand: "Marke wielen oder aginn",
      ph_model: "Modell wielen oder aginn",
      ph_year: "Baujoer wielen oder aginn",
      ph_variant: "Typ / Motoriséierung (optional)",
      year_older: "virun 1980",
      btn_veh: "Passend Deeler fannen",
      cats: {
        all: "All",
        brems: "Bremsen",
        filter: "Filteren",
        oel: "Ueleg & Flëssegkeeten",
        zuend: "Zündung",
        elektrik: "Elektrik & Batterie",
        fahrwerk: "Fuerwierk",
        licht: "Beliichtung",
        motor: "Motor",
        reifen: "Pneuen",
      },
      info_all: "{n} Artikelen",
      info_search: "{n} Resultater fir „{q}“",
      info_veh: "{n} Deeler fir {v}",
      info_cat: "{n} Artikelen · {c}",
      empty:
        "Keng Artikelen fonnt. Rufft eis un – mir fannen dat richtegt Deel.",
      fits: "Passt:",
      universal: "All Marken",
      artnr: "Art-Nr.",
      from: "ab",
      add: "An de Kuerf",
      added: "„{n}“ an de Kuerf geluecht",
      note_title: "Deel net fonnt?",
      note_text:
        "Mir fannen Iech dat richtegt Deel fir all Mark a Modell – rufft un oder schéckt eng Ufro.",
      note_cta: "Deel ufroen",
    },
    de: {
      eyebrow: "Onlineshop",
      title: "Autoteile für jedes Fahrzeug",
      sub: "Suchen Sie nach Artikelname, Artikelnummer – oder direkt nach Ihrem Fahrzeug.",
      tab_artikel: "Artikel",
      tab_fahrzeug: "Fahrzeug",
      ph_text: "Artikelname oder Artikelnummer …",
      btn_text: "Suchen",
      opt_brand: "Marke wählen",
      opt_model: "Modell wählen",
      opt_year: "Baujahr",
      ph_brand: "Marke wählen oder eingeben",
      ph_model: "Modell wählen oder eingeben",
      ph_year: "Baujahr wählen oder eingeben",
      ph_variant: "Typ / Motorisierung (optional)",
      year_older: "vor 1980",
      btn_veh: "Passende Teile finden",
      cats: {
        all: "Alle",
        brems: "Bremsen",
        filter: "Filter",
        oel: "Öl & Flüssigkeiten",
        zuend: "Zündung",
        elektrik: "Elektrik & Batterie",
        fahrwerk: "Fahrwerk",
        licht: "Beleuchtung",
        motor: "Motor",
        reifen: "Reifen",
      },
      info_all: "{n} Artikel",
      info_search: "{n} Ergebnisse für „{q}“",
      info_veh: "{n} Teile für {v}",
      info_cat: "{n} Artikel · {c}",
      empty:
        "Keine Artikel gefunden. Rufen Sie uns an – wir finden das richtige Teil.",
      fits: "Passt:",
      universal: "Alle Marken",
      artnr: "Art-Nr.",
      from: "ab",
      add: "In den Warenkorb",
      added: "„{n}“ in den Warenkorb gelegt",
      note_title: "Teil nicht gefunden?",
      note_text:
        "Wir finden für Sie das richtige Teil für jede Marke und jedes Modell – rufen Sie an oder senden Sie eine Anfrage.",
      note_cta: "Anfrage senden",
    },
    fr: {
      eyebrow: "Boutique en ligne",
      title: "Pièces auto pour chaque véhicule",
      sub: "Recherchez par nom d’article, référence – ou directement selon votre véhicule.",
      tab_artikel: "Article",
      tab_fahrzeug: "Véhicule",
      ph_text: "Nom d’article ou référence …",
      btn_text: "Rechercher",
      opt_brand: "Choisir la marque",
      opt_model: "Choisir le modèle",
      opt_year: "Année",
      ph_brand: "Choisir ou saisir la marque",
      ph_model: "Choisir ou saisir le modèle",
      ph_year: "Choisir ou saisir l’année",
      ph_variant: "Type / motorisation (facultatif)",
      year_older: "avant 1980",
      btn_veh: "Trouver les pièces",
      cats: {
        all: "Tous",
        brems: "Freinage",
        filter: "Filtres",
        oel: "Huiles & fluides",
        zuend: "Allumage",
        elektrik: "Électricité & batterie",
        fahrwerk: "Suspension",
        licht: "Éclairage",
        motor: "Moteur",
        reifen: "Pneus",
      },
      info_all: "{n} articles",
      info_search: "{n} résultats pour « {q} »",
      info_veh: "{n} pièces pour {v}",
      info_cat: "{n} articles · {c}",
      empty:
        "Aucun article trouvé. Appelez-nous – nous trouvons la bonne pièce.",
      fits: "Compatible :",
      universal: "Toutes marques",
      artnr: "Réf.",
      from: "dès",
      add: "Ajouter au panier",
      added: "« {n} » ajouté au panier",
      note_title: "Pièce introuvable ?",
      note_text:
        "Nous trouvons la bonne pièce pour chaque marque et modèle – appelez-nous ou envoyez une demande.",
      note_cta: "Envoyer une demande",
    },
    en: {
      eyebrow: "Online shop",
      title: "Car parts for every vehicle",
      sub: "Search by article name, part number – or directly by your vehicle.",
      tab_artikel: "Article",
      tab_fahrzeug: "Vehicle",
      ph_text: "Article name or part number …",
      btn_text: "Search",
      opt_brand: "Select make",
      opt_model: "Select model",
      opt_year: "Year",
      ph_brand: "Select or enter make",
      ph_model: "Select or enter model",
      ph_year: "Select or enter year",
      ph_variant: "Type / engine (optional)",
      year_older: "before 1980",
      btn_veh: "Find matching parts",
      cats: {
        all: "All",
        brems: "Brakes",
        filter: "Filters",
        oel: "Oils & fluids",
        zuend: "Ignition",
        elektrik: "Electrics & battery",
        fahrwerk: "Suspension",
        licht: "Lighting",
        motor: "Engine",
        reifen: "Tyres",
      },
      info_all: "{n} articles",
      info_search: "{n} results for “{q}”",
      info_veh: "{n} parts for {v}",
      info_cat: "{n} articles · {c}",
      empty: "No articles found. Give us a call – we’ll find the right part.",
      fits: "Fits:",
      universal: "All makes",
      artnr: "Part no.",
      from: "from",
      add: "Add to cart",
      added: "“{n}” added to cart",
      note_title: "Part not found?",
      note_text:
        "We’ll find the right part for every make and model – call us or send a request.",
      note_cta: "Send request",
    },
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
  function tr() {
    return T[lang()] || T.lb;
  }
  function $(id) {
    return document.getElementById(id);
  }
  function setTxt(id, v) {
    var el = $(id);
    if (el) el.textContent = v;
  }

  /* aktuellen Filter-Zoustand */
  var state = {
    mode: "all",
    cat: "all",
    q: "",
    brand: "",
    model: "",
    year: "",
    variant: "",
  };
  var cart = 0;

  /* ---------- Combobox: Textfeld + filterbar, scrollbar Lëscht (Web + Mobil) ---------- */
  function brandKeys() {
    return Object.keys(BRANDS).sort(function (a, b) {
      return a.localeCompare(b, "de");
    });
  }
  function modelOptions() {
    var b = $("veh-brand") ? $("veh-brand").value : "";
    return BRANDS[b] ? BRANDS[b] : [];
  }
  function yearList() {
    var arr = [];
    for (var y = new Date().getFullYear() + 1; y >= 1950; y--) arr.push(String(y));
    return arr;
  }
  var combos = {};
  function onBrandChange(val) {
    var m = $("veh-model");
    if (!m) return;
    m.disabled = !val;
    if (!val) m.value = "";
    else if (BRANDS[val] && BRANDS[val].indexOf(m.value) === -1) m.value = "";
    if (combos["veh-model"]) combos["veh-model"].render();
  }
  function makeCombo(inputId, listId, getOptions, onChoose) {
    var input = $(inputId),
      list = $(listId);
    if (!input || !list) return null;
    var active = -1;
    function filtered() {
      var f = (input.value || "").trim().toLowerCase();
      var all = getOptions() || [];
      if (!f) return all;
      var starts = [],
        contains = [];
      all.forEach(function (o) {
        var l = String(o).toLowerCase();
        if (l.indexOf(f) === 0) starts.push(o);
        else if (l.indexOf(f) !== -1) contains.push(o);
      });
      return starts.concat(contains);
    }
    function render() {
      list.innerHTML = "";
      filtered().forEach(function (o) {
        var li = document.createElement("li");
        li.className = "combo-opt";
        li.setAttribute("role", "option");
        li.textContent = o;
        li.addEventListener("mousedown", function (e) {
          e.preventDefault();
          choose(o);
        });
        list.appendChild(li);
      });
      active = -1;
    }
    function open() {
      if (input.disabled) return;
      render();
      if (list.children.length) {
        list.hidden = false;
        input.setAttribute("aria-expanded", "true");
      } else {
        close();
      }
    }
    function close() {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      active = -1;
    }
    function choose(val) {
      input.value = val;
      close();
      if (onChoose) onChoose(val);
    }
    function items() {
      return list.querySelectorAll(".combo-opt");
    }
    function highlight(its) {
      its.forEach(function (it, i) {
        it.classList.toggle("active", i === active);
      });
      if (active >= 0 && its[active])
        its[active].scrollIntoView({ block: "nearest" });
    }
    input.addEventListener("focus", open);
    input.addEventListener("click", open);
    input.addEventListener("input", function () {
      open();
      if (onChoose) onChoose(input.value);
    });
    input.addEventListener("keydown", function (e) {
      var k = e.key;
      if (list.hidden && (k === "ArrowDown" || k === "Down")) {
        open();
        return;
      }
      var its = items();
      if (k === "ArrowDown" || k === "Down") {
        e.preventDefault();
        active = Math.min(active + 1, its.length - 1);
        highlight(its);
      } else if (k === "ArrowUp" || k === "Up") {
        e.preventDefault();
        active = Math.max(active - 1, 0);
        highlight(its);
      } else if (k === "Enter") {
        if (active >= 0 && its[active]) {
          e.preventDefault();
          choose(its[active].textContent);
        } else {
          close();
        }
      } else if (k === "Escape" || k === "Esc") {
        close();
      }
    });
    input.addEventListener("blur", function () {
      setTimeout(close, 150);
    });
    var api = { render: render, close: close };
    combos[inputId] = api;
    return api;
  }
  function initCombos() {
    makeCombo("veh-brand", "list-brand", brandKeys, onBrandChange);
    makeCombo("veh-model", "list-model", modelOptions, null);
    makeCombo("veh-year", "list-year", yearList, null);
  }

  /* ---------- Kategorie-Chips ---------- */
  function renderChips() {
    var t = tr(),
      wrap = $("cat-chips");
    if (!wrap) return;
    var order = [
      "all",
      "brems",
      "filter",
      "oel",
      "zuend",
      "elektrik",
      "fahrwerk",
      "licht",
      "motor",
      "reifen",
    ];
    wrap.innerHTML = "";
    order.forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cat-chip" + (state.cat === c ? " active" : "");
      b.textContent =
        (c !== "all" && CATICON[c] ? CATICON[c] + " " : "") + t.cats[c];
      b.setAttribute("data-cat", c);
      b.addEventListener("click", function () {
        state.cat = c;
        render();
      });
      wrap.appendChild(b);
    });
  }

  /* ---------- Filter-Logik ---------- */
  function matches(p) {
    var t = tr();
    if (state.cat !== "all" && p.cat !== state.cat) return false;
    if (state.mode === "search" && state.q) {
      var q = state.q.toLowerCase();
      var hay = (p.name + " " + p.art + " " + t.cats[p.cat]).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    if (state.mode === "vehicle" && state.brand) {
      if (p.fits !== "all" && p.fits.indexOf(state.brand) === -1) return false;
    }
    return true;
  }

  function render() {
    var t = tr(),
      grid = $("shop-grid"),
      info = $("shop-result-info"),
      empty = $("shop-empty");
    if (!grid) return;
    renderChips();
    var list = PRODUCTS.filter(matches);
    grid.innerHTML = "";
    list.forEach(function (p) {
      var c = document.createElement("article");
      c.className = "shop-card";
      var ic = document.createElement("div");
      ic.className = "shop-card-ic";
      ic.textContent = CATICON[p.cat] || "🔧";
      var cat = document.createElement("span");
      cat.className = "shop-cat";
      cat.textContent = t.cats[p.cat];
      var h = document.createElement("h3");
      h.textContent = p.name;
      var fit = document.createElement("p");
      fit.className = "shop-fit";
      fit.textContent =
        t.fits + " " + (p.fits === "all" ? t.universal : p.fits.join(", "));
      var foot = document.createElement("div");
      foot.className = "shop-card-foot";
      var art = document.createElement("span");
      art.className = "shop-artnr";
      art.textContent = t.artnr + " " + p.art;
      var pr = document.createElement("span");
      pr.className = "shop-price";
      pr.innerHTML = "<em>" + t.from + "</em> " + p.price + " €";
      foot.appendChild(art);
      foot.appendChild(pr);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-outline shop-add";
      btn.textContent = t.add;
      btn.addEventListener("click", function () {
        addToCart(p);
      });
      c.appendChild(ic);
      c.appendChild(cat);
      c.appendChild(h);
      c.appendChild(fit);
      c.appendChild(foot);
      c.appendChild(btn);
      grid.appendChild(c);
    });
    // Info-Text
    var n = list.length,
      txt;
    if (state.mode === "search" && state.q)
      txt = t.info_search.replace("{n}", n).replace("{q}", state.q);
    else if (state.mode === "vehicle" && state.brand) {
      var v =
        state.brand +
        (state.model ? " " + state.model : "") +
        (state.year ? " (" + state.year + ")" : "") +
        (state.variant ? " · " + state.variant : "");
      txt = t.info_veh.replace("{n}", n).replace("{v}", v);
    } else if (state.cat !== "all")
      txt = t.info_cat.replace("{n}", n).replace("{c}", t.cats[state.cat]);
    else txt = t.info_all.replace("{n}", n);
    if (info) info.textContent = txt;
    if (empty) empty.hidden = n > 0;
  }

  /* ---------- Warenkuerf (Demo) ---------- */
  var toastTimer = null;
  function addToCart(p) {
    cart++;
    var t = tr(),
      el = $("cart-toast");
    if (!el) return;
    el.textContent =
      "🛒 " + t.added.replace("{n}", p.name) + "  (" + cart + ")";
    el.hidden = false;
    el.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove("show");
    }, 2600);
  }

  /* ---------- "In Arbeit"-Säit ---------- */
  var SOON = {
    lb: {
      eyebrow: "DBA Bremsen",
      title: "Performance-Bremsen passend zu Ärem Gefier",
      text: "Mir bidden DBA-Bremsscheiwen, Bremsbeläg, Bremssättel a komplett Kits un. D'Passgenauegkeet gëtt virun all Bestellung iwwer den offiziellen DBA-Gefierkatalog kontrolléiert.",
      cta: "Gefier am DBA-Katalog sichen",
      back: "Zréck op d’Startsäit",
      dev: "Virschau-Modus – de komplette Shop ass nach am Opbau",
      hide: "verstoppen",
    },
    de: {
      eyebrow: "DBA Bremsen",
      title: "Performance-Bremsen passend zu Ihrem Fahrzeug",
      text: "Wir bieten DBA-Bremsscheiben, Bremsbeläge, Bremssättel und komplette Kits an. Die Passgenauigkeit wird vor jeder Bestellung über den offiziellen DBA-Fahrzeugkatalog geprüft.",
      cta: "Fahrzeug im DBA-Katalog suchen",
      back: "Zurück zur Startseite",
      dev: "Vorschau-Modus – der vollständige Shop ist noch im Aufbau",
      hide: "ausblenden",
    },
    fr: {
      eyebrow: "Freins DBA",
      title: "Freins performance adaptés à votre véhicule",
      text: "Nous proposons des disques, plaquettes, étriers et kits complets DBA. La compatibilité est contrôlée avant chaque commande à l’aide du catalogue véhicule officiel DBA.",
      cta: "Rechercher le véhicule chez DBA",
      back: "Retour à l’accueil",
      dev: "Mode aperçu – la boutique complète est encore en construction",
      hide: "masquer",
    },
    en: {
      eyebrow: "DBA brakes",
      title: "Performance brakes matched to your vehicle",
      text: "We offer DBA brake discs, pads, calipers and complete kits. Fitment is checked against the official DBA vehicle catalogue before every order.",
      cta: "Find your vehicle in the DBA catalogue",
      back: "Back to home",
      dev: "Preview mode – the complete shop is still under construction",
      hide: "hide",
    },
  };

  var DBA_COPY = {
    lb: {
      partner: "Bremsen-Partnerprogramm",
      proof1: "✓ Offiziell DBA-Artikelnummeren",
      proof2: "✓ Gefierbezunn Iwwerpréiwung",
      proof3: "✓ Berodung duerch eis Garage",
      discs: "Bremsscheiwen",
      pads: "Bremsbeläg",
      calipers: "Bremssättel",
      kits: "Bremsen-Kits",
      calipersText: "Street Series Performance-Bremssättel",
      kitsText: "Scheiwen a Beläg als passend Komplettset",
      finderTitle: "Dat richtegt Deel fir Äert Gefier fannen",
      finderText: "Wielt am offiziellen DBA-Katalog Mark, Baujoer, Modell a Motorvariant. Schéckt eis duerno d'DBA-Artikelnummer – mir kontrolléieren d'Passgenauegkeet a maachen Iech eng Offer.",
      request: "DBA-Deel bei eis ufroen",
      note: "Wichteg: D'Produktauswiel gëtt virun der Bestellung vun eis kontrolléiert. Präisser an Disponibilitéit op der DBA-Websäit kënnen ofwäichen.",
    },
    de: {
      partner: "Bremsen-Partnerprogramm",
      proof1: "✓ Offizielle DBA-Artikelnummern",
      proof2: "✓ Fahrzeugbezogene Prüfung",
      proof3: "✓ Beratung durch unsere Werkstatt",
      discs: "Bremsscheiben",
      pads: "Bremsbeläge",
      calipers: "Bremssättel",
      kits: "Bremsen-Kits",
      calipersText: "Street Series Performance-Bremssättel",
      kitsText: "Scheiben und Beläge als passendes Komplettset",
      finderTitle: "Das richtige Teil für Ihr Fahrzeug finden",
      finderText: "Wählen Sie im offiziellen DBA-Katalog Marke, Baujahr, Modell und Motorvariante. Senden Sie uns anschließend die DBA-Artikelnummer – wir prüfen die Passgenauigkeit und erstellen Ihnen ein Angebot.",
      request: "DBA-Teil bei uns anfragen",
      note: "Wichtig: Wir kontrollieren die Produktauswahl vor der Bestellung. Preise und Verfügbarkeit auf der DBA-Website können abweichen.",
    },
    fr: {
      partner: "Programme partenaire freinage",
      proof1: "✓ Références officielles DBA",
      proof2: "✓ Vérification selon le véhicule",
      proof3: "✓ Conseil par notre garage",
      discs: "Disques de frein",
      pads: "Plaquettes de frein",
      calipers: "Étriers de frein",
      kits: "Kits de freinage",
      calipersText: "Étriers performance Street Series",
      kitsText: "Disques et plaquettes en kit compatible",
      finderTitle: "Trouver la bonne pièce pour votre véhicule",
      finderText: "Sélectionnez la marque, l’année, le modèle et la motorisation dans le catalogue officiel DBA. Envoyez-nous ensuite la référence DBA : nous vérifierons la compatibilité et préparerons une offre.",
      request: "Demander une pièce DBA",
      note: "Important : nous vérifions la sélection avant la commande. Les prix et la disponibilité affichés sur le site DBA peuvent différer.",
    },
    en: {
      partner: "Brake partner programme",
      proof1: "✓ Official DBA part numbers",
      proof2: "✓ Vehicle-specific fitment check",
      proof3: "✓ Advice from our workshop",
      discs: "Brake discs",
      pads: "Brake pads",
      calipers: "Brake calipers",
      kits: "Brake kits",
      calipersText: "Street Series performance calipers",
      kitsText: "Matched disc and pad packages",
      finderTitle: "Find the right part for your vehicle",
      finderText: "Select make, year, model and engine variant in the official DBA catalogue. Then send us the DBA part number – we will verify fitment and prepare an offer.",
      request: "Request a DBA part",
      note: "Important: we verify the product selection before ordering. Prices and availability shown on the DBA website may differ.",
    },
  };

  /* ---------- Statics (Iwwersetzungen) ---------- */
  function applyStatics() {
    var t = tr();
    setTxt("shop-eyebrow", t.eyebrow);
    setTxt("shop-title", t.title);
    setTxt("shop-sub", t.sub);
    setTxt("lbl-tab-artikel", t.tab_artikel);
    setTxt("lbl-tab-fahrzeug", t.tab_fahrzeug);
    setTxt("lbl-btn-text", t.btn_text);
    setTxt("lbl-btn-veh", t.btn_veh);
    var q = $("q-text");
    if (q) q.placeholder = t.ph_text;
    var vv = $("veh-variant");
    if (vv) vv.placeholder = t.ph_variant;
    setTxt("shop-note-title", t.note_title);
    setTxt("shop-note-text", t.note_text);
    setTxt("shop-note-cta", t.note_cta);
    var s = SOON[lang()] || SOON.lb;
    setTxt("soon-eyebrow", s.eyebrow);
    setTxt("soon-title", s.title);
    setTxt("soon-text", s.text);
    setTxt("soon-cta", s.cta);
    setTxt("soon-back", s.back);
    setTxt("dev-badge-txt", s.dev);
    var d = DBA_COPY[lang()] || DBA_COPY.lb;
    setTxt("dba-partner-label", d.partner);
    setTxt("dba-proof-1", d.proof1);
    setTxt("dba-proof-2", d.proof2);
    setTxt("dba-proof-3", d.proof3);
    setTxt("dba-discs-title", d.discs);
    setTxt("dba-pads-title", d.pads);
    setTxt("dba-calipers-title", d.calipers);
    setTxt("dba-kits-title", d.kits);
    setTxt("dba-calipers-text", d.calipersText);
    setTxt("dba-kits-text", d.kitsText);
    setTxt("dba-finder-title", d.finderTitle);
    setTxt("dba-finder-text", d.finderText);
    setTxt("dba-request", d.request);
    setTxt("dba-note", d.note);
    var dh = document.querySelector("#shop-dev-badge a");
    if (dh) dh.textContent = s.hide;
    var vb = $("veh-brand");
    if (vb) vb.placeholder = t.ph_brand;
    var vm = $("veh-model");
    if (vm) vm.placeholder = t.ph_model;
    var vy = $("veh-year");
    if (vy) vy.placeholder = t.ph_year;
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
    state.mode = "search";
    state.q = ($("q-text").value || "").trim();
    state.cat = "all";
    render();
    scrollToCatalog();
  }
  function doVehSearch() {
    state.mode = "vehicle";
    state.brand = $("veh-brand").value;
    state.model = $("veh-model").value;
    state.year = $("veh-year").value;
    state.variant = $("veh-variant").value.trim();
    state.cat = "all";
    render();
    scrollToCatalog();
  }
  function scrollToCatalog() {
    var el = $("shop-catalog");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function bind() {
    $("tab-artikel").addEventListener("click", function () {
      switchTab("artikel");
    });
    $("tab-fahrzeug").addEventListener("click", function () {
      switchTab("fahrzeug");
    });
    $("btn-text-search").addEventListener("click", doTextSearch);
    $("q-text").addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        doTextSearch();
      }
    });
    $("q-text").addEventListener("input", function () {
      if (!this.value) {
        state.mode = "all";
        state.q = "";
        render();
      }
    });
    $("btn-veh-search").addEventListener("click", doVehSearch);
    // Sproochewiessel: alles nei
    document.querySelectorAll(".lang-select").forEach(function (select) {
      select.addEventListener("change", function () {
        setTimeout(function () {
          applyStatics();
          render();
        }, 0);
      });
    });
  }

  function init() {
    applyStatics();
    initCombos();
    bind();
    render();
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
