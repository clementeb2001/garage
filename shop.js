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
  /* DBA Vorbereitungskatalog: Artikel und Zuordnung aus dem offiziellen
     Fahrzeugkatalog für AUDI A3 8V 1.5 Turbo 150 BHP (2018–2020).
     Preise werden erst mit der Händlerliste aktiviert. */
  var PRODUCTS = [
    { id: 101, cat: "disc", name: "DBA2810E · Street Series En-Shield Plain", art: "DBA2810E", axle: "front", spec: "288 mm · Bremssattel TRW · Belag DB2383" },
    { id: 102, cat: "disc", name: "DBA2806E · Street Series En-Shield Plain", art: "DBA2806E", axle: "front", spec: "312 mm · Bremssattel TRW · Belag DB2383" },
    { id: 103, cat: "disc", name: "DBA2806S · Street Series T2", art: "DBA2806S", axle: "front", spec: "312 mm · geschlitzt · Bremssattel TRW" },
    { id: 104, cat: "disc", name: "DBA2810S · Street Series T2", art: "DBA2810S", axle: "front", spec: "288 mm · geschlitzt · Bremssattel TRW" },
    { id: 105, cat: "disc", name: "DBA2806X · Street Series X-GOLD", art: "DBA2806X", axle: "front", spec: "312 mm · gelocht/geschlitzt · Bremssattel TRW" },
    { id: 106, cat: "disc", name: "DBA42806 · 4000 Series Plain", art: "DBA42806", axle: "front", spec: "312 mm · Performance-Scheibe · Bremssattel TRW" },
    { id: 107, cat: "disc", name: "DBA42806S · 4000 Series T3", art: "DBA42806S", axle: "front", spec: "312 mm · T3-geschlitzt · Bremssattel TRW" },
    { id: 108, cat: "disc", name: "DBA42806XS · 4000 Series XS", art: "DBA42806XS", axle: "front", spec: "312 mm · gelocht/geschlitzt · Bremssattel TRW" },
    { id: 109, cat: "pad", name: "DB2383SS · Street Series Ceramic", art: "DB2383SS", axle: "front", spec: "Vorderachse · für DBA2810 · Bremssattel TRW" },
    { id: 110, cat: "pad", name: "DB2383SP · Street Performance", art: "DB2383SP", axle: "front", spec: "Vorderachse · ECE R90 · für DBA2810" },
    { id: 111, cat: "pad", name: "DB2383XP · Xtreme Performance", art: "DB2383XP", axle: "front", spec: "Vorderachse · ECE R90 · für DBA2810" },
    { id: 112, cat: "pad", name: "DB2383RP · Race Performance", art: "DB2383RP", axle: "front", spec: "Vorderachse · Motorsport-Reibmischung" },
    { id: 113, cat: "disc", name: "DBA2814E · Street Series En-Shield Plain", art: "DBA2814E", axle: "rear", spec: "272 mm · Hinterachse · Bremssattel ATE" },
    { id: 114, cat: "disc", name: "DBA2814S · Street Series T2", art: "DBA2814S", axle: "rear", spec: "272 mm · Hinterachse · geschlitzt · ATE" },
    { id: 115, cat: "disc", name: "DBA42814 · 4000 Series Plain", art: "DBA42814", axle: "rear", spec: "272 mm · Hinterachse · Performance-Scheibe" },
    { id: 116, cat: "disc", name: "DBA42814S · 4000 Series T3", art: "DBA42814S", axle: "rear", spec: "272 mm · Hinterachse · T3-geschlitzt" },
    { id: 117, cat: "pad", name: "DB2384SS · Street Series Ceramic", art: "DB2384SS", axle: "rear", spec: "Hinterachse · für DBA2814 · Bremssattel ATE" },
    { id: 118, cat: "pad", name: "DB2384SP · Street Performance", art: "DB2384SP", axle: "rear", spec: "Hinterachse · ECE R90 · für DBA2814" },
    { id: 119, cat: "pad", name: "DB2384RP · Race Performance", art: "DB2384RP", axle: "rear", spec: "Hinterachse · Motorsport-Reibmischung" },
    { id: 120, cat: "kit", name: "DBA2814E-2384SP · Street Performance Kit", art: "DBA2814E-2384SP", axle: "rear", spec: "2× DBA2814E + DB2384SP · Hinterachse" },
    { id: 121, cat: "kit", name: "DBA2814S-2384SP · T2 Street Performance Kit", art: "DBA2814S-2384SP", axle: "rear", spec: "2× DBA2814S + DB2384SP · Hinterachse" },
    { id: 201, cat: "disc", name: "DBA Street Series · Plain / En-Shield", art: "STREET-PLAIN", series: true, spec: "OE-Ersatz · glatte Oberfläche · Korrosionsschutz" },
    { id: 202, cat: "disc", name: "DBA Street Series · T2", art: "STREET-T2", series: true, spec: "Bidirektionales T2-Schlitzdesign · Straßeneinsatz" },
    { id: 203, cat: "disc", name: "DBA Street Series · X-Gold", art: "STREET-XG", series: true, spec: "Gelocht und geschlitzt · sportliche Optik" },
    { id: 204, cat: "disc", name: "DBA 4000 Series · HD", art: "4000-HD", series: true, spec: "High-Carbon-Guss · glatte Performance-Ausführung" },
    { id: 205, cat: "disc", name: "DBA 4000 Series · T3", art: "4000-T3", series: true, spec: "T3-Schlitze · thermisch stabilisiert · Performance" },
    { id: 206, cat: "disc", name: "DBA 4000 Series · XS Gold", art: "4000-XS", series: true, spec: "Gelocht und geschlitzt · High-Performance" },
    { id: 207, cat: "disc", name: "DBA 4000 Series · XD", art: "4000-XD", series: true, spec: "Heavy-Duty-Ausführung für hohe Belastung" },
    { id: 208, cat: "disc", name: "DBA 5000 Series · T3", art: "5000-T3", series: true, spec: "Zweiteilige Bremsscheibe · T3-Schlitzdesign" },
    { id: 209, cat: "disc", name: "DBA 5000 Series · XS", art: "5000-XS", series: true, spec: "Zweiteilig · gelocht und geschlitzt" },
    { id: 210, cat: "pad", name: "DBA Street Series Ceramic", art: "PAD-SS", series: true, spec: "Komfortorientierter OE-Ersatz · geringer Staub" },
    { id: 211, cat: "pad", name: "DBA Street Performance", art: "PAD-SP", series: true, spec: "Verbesserte Reibung für sportliche Straßennutzung" },
    { id: 212, cat: "pad", name: "DBA Xtreme Performance", art: "PAD-XP", series: true, spec: "Hohe Temperaturbeständigkeit · Performance und 4x4" },
    { id: 213, cat: "pad", name: "DBA Race Performance", art: "PAD-RP", series: true, spec: "Motorsport-Reibmischung für Rennstreckeneinsatz" },
    { id: 214, cat: "caliper", name: "DBA Street Series Brake Caliper", art: "CALIPER-SS", series: true, spec: "Performance-Bremssattel · fahrzeugspezifische Ausführung" },
    { id: 215, cat: "kit", name: "DBA Brake Upgrade Kit", art: "KIT-UPGRADE", series: true, spec: "Abgestimmtes Komplettsystem aus Scheiben, Belägen und Bremssätteln" },
    { id: 216, cat: "kit", name: "DBA Electric Park Brake Kit", art: "KIT-EPB", series: true, spec: "Elektrische Parkbremslösung · fahrzeugspezifisch" },
    { id: 217, cat: "kit", name: "DBA Drum to Disc Conversion Kit", art: "KIT-DISC", series: true, spec: "Umrüstsatz von Trommel- auf Scheibenbremse" }
  ].map(function (product) {
    product.price = null;
    if (product.series) {
      product.fits = "verification";
      product.fitment = "";
      product.vehicle = null;
    } else {
      product.fits = ["Audi"];
      product.fitment = "Audi A3 8V · 1.5 Turbo 150 BHP · 2018–2020";
      product.vehicle = { brand: "Audi", model: "A3", from: 2018, to: 2020, variant: "1.5 Turbo 150" };
    }
    return product;
  });

  var CATICON = {
    disc: "◉",
    pad: "▰",
    caliper: "◆",
    kit: "⊕"
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
  var ENGINE_DATA = {
    "Audi|A3": [
      "1.0 Turbo 115 BHP (2016–2020)",
      "1.2 Turbo 105 BHP (2013–2020)",
      "1.4 Turbo 122 BHP (2012–2020)",
      "1.4 Turbo 140 BHP (2012–2020)",
      "1.4 Turbo + Electric 204 BHP (2014–2020)",
      "1.5 Turbo 150 BHP (2018–2020)",
      "1.6 TD 110 BHP (2012–2020)",
      "1.8 Turbo 180 BHP (2012–2020)",
      "2.0 TD 110 BHP (2013–2020)",
      "2.0 TD 143 BHP (2012–2020)",
      "2.0 TD 150 BHP (2012–2020)",
      "2.0 TD 184 BHP (2013–2020)",
      "2.0 Turbo 190 BHP (2016–2020)"
    ]
  };
  function engineOptions() {
    var brand = $("veh-brand") ? $("veh-brand").value : "";
    var model = $("veh-model") ? $("veh-model").value : "";
    var year = parseInt($("veh-year") ? $("veh-year").value : "", 10);
    var key = brand + "|" + (model.toLowerCase().indexOf("a3") === 0 ? "A3" : model);
    var options = ENGINE_DATA[key] || [];
    if (!year) return options;
    return options.filter(function (label) {
      var years = label.match(/\((\d{4})[–-](\d{4})\)/);
      return !years || (year >= parseInt(years[1], 10) && year <= parseInt(years[2], 10));
    });
  }
  function updateEngineAvailability() {
    var engine = $("veh-variant");
    if (!engine) return;
    var options = engineOptions();
    var ready = !!($("veh-brand").value && $("veh-model").value && $("veh-year").value);
    engine.disabled = !ready || !options.length;
    if (engine.disabled || options.indexOf(engine.value) === -1) engine.value = "";
    engine.placeholder = engine.disabled ? tr().engine_unavailable : tr().ph_variant;
    if (combos["veh-variant"]) combos["veh-variant"].render();
  }
  var combos = {};
  function onBrandChange(val) {
    var m = $("veh-model");
    if (!m) return;
    m.disabled = !val;
    if (!val) m.value = "";
    else if (BRANDS[val] && BRANDS[val].indexOf(m.value) === -1) m.value = "";
    if (combos["veh-model"]) combos["veh-model"].render();
    updateEngineAvailability();
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
    makeCombo("veh-model", "list-model", modelOptions, updateEngineAvailability);
    makeCombo("veh-year", "list-year", yearList, updateEngineAvailability);
    makeCombo("veh-variant", "list-variant", engineOptions, null);
    updateEngineAvailability();
  }

  /* ---------- Kategorie-Chips ---------- */
  function renderChips() {
    var t = tr(),
      wrap = $("cat-chips");
    if (!wrap) return;
    var order = ["all", "disc", "pad", "caliper", "kit"];
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
      var hay = (p.name + " " + p.art + " " + p.spec + " " + p.fitment + " " + t.cats[p.cat]).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    if (state.mode === "vehicle" && state.brand) {
      if (!p.vehicle) return false;
      if (p.vehicle.brand.toLowerCase() !== state.brand.toLowerCase()) return false;
      if (state.model && p.vehicle.model.toLowerCase().indexOf(state.model.toLowerCase()) === -1 && state.model.toLowerCase().indexOf(p.vehicle.model.toLowerCase()) === -1) return false;
      var selectedYear = parseInt(state.year, 10);
      if (selectedYear && (selectedYear < p.vehicle.from || selectedYear > p.vehicle.to)) return false;
      if (state.variant) {
        var variantQuery = state.variant.toLowerCase();
        var expectedVariant = p.vehicle.variant.toLowerCase();
        if (expectedVariant.indexOf(variantQuery) === -1 && variantQuery.indexOf(expectedVariant) === -1) return false;
      }
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
      ic.className = "shop-card-dba-art shop-card-dba-" + (CATICON[p.cat] || "disc");
      var mark = document.createElement("span");
      mark.textContent = "DBA";
      ic.appendChild(mark);
      var cat = document.createElement("span");
      cat.className = "shop-cat";
      cat.textContent = t.cats[p.cat];
      var h = document.createElement("h3");
      h.textContent = p.name;
      var fit = document.createElement("p");
      fit.className = "shop-fit";
      fit.textContent = p.series ? t.fitment_pending : t.fits + " " + p.fitment;
      var spec = document.createElement("p");
      spec.className = "shop-spec";
      spec.textContent = p.spec;
      var foot = document.createElement("div");
      foot.className = "shop-card-foot";
      var art = document.createElement("span");
      art.className = "shop-artnr";
      art.textContent = t.artnr + " " + p.art;
      var pr = document.createElement("span");
      pr.className = "shop-price";
      pr.textContent = p.price ? p.price + " €" : t.price_pending;
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
      c.appendChild(spec);
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
  /* Texte fir den internen DBA-Shop-Prototyp. */
  Object.assign(T.lb, {
    eyebrow: "DBA Shop · Virschau",
    title: "DBA Bremsen-Shop",
    ph_variant: "Motoriséierung wielen",
    engine_unavailable: "Motoriséierungen nach net importéiert",
    sub: "Sicht no DBA-Artikelnummer oder test de Gefierfilter. De Katalog ass nach net ëffentlech a gëtt mat der offizieller Händlerlëscht komplettéiert.",
    cats: { all: "All", disc: "Bremsscheiwen", pad: "Bremsbeläg", caliper: "Bremssättel", kit: "Bremsen-Kits" },
    fits: "Gepréiften Test-Zouuerdnung:",
    artnr: "DBA-Nr.",
    from: "",
    price_pending: "Präis kënnt no",
    fitment_pending: "Gefier-Zouuerdnung kënnt mat der offizieller DBA-Lëscht",
    add: "Fir Ufro virmerken",
    added: "„{n}“ fir d'Ufro virgemierkt",
    note_title: "Äert Gefier oder Deel feelt nach?",
    note_text: "An dëser Opbau-Virschau ass eng geprüft Beispillzouuerdnung aktiv. Mat der offizieller DBA-Lëscht komme weider Gefierer, Präisser a Disponibilitéiten dobäi.",
    note_cta: "DBA-Deel ufroen"
  });
  Object.assign(T.de, {
    eyebrow: "DBA Shop · Vorschau",
    title: "DBA Bremsen-Shop",
    ph_variant: "Motorisierung wählen",
    engine_unavailable: "Motorisierungen noch nicht importiert",
    sub: "Suchen Sie nach einer DBA-Artikelnummer oder testen Sie den Fahrzeugfilter. Der Katalog ist noch nicht öffentlich und wird mit der offiziellen Händlerliste vervollständigt.",
    cats: { all: "Alle", disc: "Bremsscheiben", pad: "Bremsbeläge", caliper: "Bremssättel", kit: "Bremsen-Kits" },
    fits: "Geprüfte Testzuordnung:",
    artnr: "DBA-Nr.",
    from: "",
    price_pending: "Preis folgt",
    fitment_pending: "Fahrzeugzuordnung folgt mit der offiziellen DBA-Liste",
    add: "Für Anfrage vormerken",
    added: "„{n}“ für die Anfrage vorgemerkt",
    note_title: "Ihr Fahrzeug oder Teil fehlt noch?",
    note_text: "In dieser Aufbau-Vorschau ist zunächst eine geprüfte Beispielzuordnung aktiv. Mit der offiziellen DBA-Liste ergänzen wir weitere Fahrzeuge, Preise und Verfügbarkeiten.",
    note_cta: "DBA-Teil anfragen"
  });
  Object.assign(T.fr, {
    eyebrow: "Boutique DBA · Aperçu",
    title: "Boutique de freins DBA",
    ph_variant: "Choisir la motorisation",
    engine_unavailable: "Motorisations pas encore importées",
    sub: "Recherchez une référence DBA ou testez le filtre véhicule. Le catalogue n'est pas encore public et sera complété avec la liste officielle du revendeur.",
    cats: { all: "Tous", disc: "Disques", pad: "Plaquettes", caliper: "Étriers", kit: "Kits de freinage" },
    fits: "Affectation test vérifiée :",
    artnr: "Réf. DBA",
    from: "",
    price_pending: "Prix à venir",
    fitment_pending: "Affectation véhicule à venir avec la liste officielle DBA",
    add: "Ajouter à la demande",
    added: "« {n} » ajouté à la demande",
    note_title: "Votre véhicule ou votre pièce manque encore ?",
    note_text: "Cet aperçu contient d'abord une affectation d'exemple vérifiée. La liste officielle DBA ajoutera les autres véhicules, prix et disponibilités.",
    note_cta: "Demander une pièce DBA"
  });
  Object.assign(T.en, {
    eyebrow: "DBA shop · Preview",
    title: "DBA brake shop",
    ph_variant: "Select engine",
    engine_unavailable: "Engine options not imported yet",
    sub: "Search by DBA part number or test the vehicle filter. The catalogue is not public yet and will be completed with the official dealer list.",
    cats: { all: "All", disc: "Brake discs", pad: "Brake pads", caliper: "Brake calipers", kit: "Brake kits" },
    fits: "Verified test fitment:",
    artnr: "DBA No.",
    from: "",
    price_pending: "Price coming soon",
    fitment_pending: "Vehicle fitment will follow with the official DBA list",
    add: "Add to enquiry",
    added: "“{n}” added to the enquiry",
    note_title: "Vehicle or part not listed yet?",
    note_text: "This build preview starts with one verified example fitment. The official DBA list will add further vehicles, prices and availability.",
    note_cta: "Request a DBA part"
  });

  var SOON = {
    lb: {
      eyebrow: "Online-Shop",
      title: "Eise Shop ass am Opbau",
      text: "Mir sinn amgaang, eisen Autodeeler-Shop opzebauen. Kuckt geschwënn erëm laanscht – oder kontaktéiert eis direkt fir Deeler a Präisser.",
      cta: "Deel ufroen",
      back: "Zréck op d’Startsäit",
      dev: "Virschau-Modus – de komplette Shop ass nach am Opbau",
      hide: "verstoppen",
    },
    de: {
      eyebrow: "Online-Shop",
      title: "Unser Shop ist im Aufbau",
      text: "Wir bauen gerade unseren Autoteile-Shop auf. Schauen Sie bald wieder vorbei – oder kontaktieren Sie uns direkt für Teile und Preise.",
      cta: "Anfrage senden",
      back: "Zurück zur Startseite",
      dev: "Vorschau-Modus – der vollständige Shop ist noch im Aufbau",
      hide: "ausblenden",
    },
    fr: {
      eyebrow: "Boutique en ligne",
      title: "Notre boutique est en construction",
      text: "Nous préparons notre boutique de pièces automobiles. Revenez bientôt – ou contactez-nous directement pour les pièces et les prix.",
      cta: "Envoyer une demande",
      back: "Retour à l’accueil",
      dev: "Mode aperçu – la boutique complète est encore en construction",
      hide: "masquer",
    },
    en: {
      eyebrow: "Online shop",
      title: "Our shop is under construction",
      text: "We are building our car-parts shop. Please check back soon – or contact us directly for parts and prices.",
      cta: "Send request",
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
    if (vv) vv.placeholder = vv.disabled ? t.engine_unavailable : t.ph_variant;
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
          updateEngineAvailability();
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
