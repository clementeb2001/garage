/* Autoservice Bettenduerf – Shop (Demo-Katalog, mehrsprocheg) */
(function () {
  "use strict";

  /* ---------- Marken & Modeller ---------- */
  var BRANDS = {
    Audi: ["A1", "A3", "A4", "A6", "Q2", "Q3", "Q5", "TT"],
    BMW: ["1er", "2er", "3er", "5er", "X1", "X3", "X5"],
    Citroën: ["C1", "C3", "C4", "C5 Aircross", "Berlingo"],
    Dacia: ["Sandero", "Duster", "Logan", "Jogger"],
    Fiat: ["500", "Panda", "Punto", "Tipo", "Ducato"],
    Ford: ["Fiesta", "Focus", "Puma", "Kuga", "Transit"],
    Honda: ["Jazz", "Civic", "CR-V", "HR-V"],
    Hyundai: ["i10", "i20", "i30", "Tucson", "Kona"],
    Kia: ["Picanto", "Rio", "Ceed", "Sportage", "Niro"],
    Mazda: ["2", "3", "CX-30", "CX-5", "MX-5"],
    "Mercedes-Benz": [
      "A-Klasse",
      "B-Klasse",
      "C-Klasse",
      "E-Klasse",
      "GLA",
      "GLC",
      "Sprinter",
    ],
    Mini: ["Cooper", "Clubman", "Countryman"],
    Nissan: ["Micra", "Juke", "Qashqai", "X-Trail"],
    Opel: ["Corsa", "Astra", "Insignia", "Mokka", "Crossland"],
    Peugeot: ["208", "308", "2008", "3008", "Partner"],
    Renault: ["Twingo", "Clio", "Mégane", "Captur", "Kadjar"],
    Seat: ["Ibiza", "Leon", "Arona", "Ateca"],
    Škoda: ["Fabia", "Scala", "Octavia", "Superb", "Kodiaq"],
    Toyota: ["Aygo", "Yaris", "Corolla", "C-HR", "RAV4"],
    Volkswagen: ["Polo", "Golf", "Passat", "T-Roc", "Tiguan", "Transporter"],
    Volvo: ["V40", "V60", "XC40", "XC60"],
  };

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
      btn_veh: "Passend Deeler fannen",
      cats: {
        all: "All",
        brems: "Bremsen",
        filter: "Filteren",
        oel: "Ueleg & Flëssegkeeten",
        zuend: "Zündung",
        elektrik: "Elektrik & Batterie",
        fahrwerk: "Ophänkung",
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
  };
  var cart = 0;

  /* ---------- Dropdowns fëllen ---------- */
  function fillBrands() {
    var t = tr(),
      sel = $("veh-brand");
    if (!sel) return;
    var cur = sel.value;
    sel.innerHTML = "";
    var o0 = document.createElement("option");
    o0.value = "";
    o0.textContent = t.opt_brand;
    sel.appendChild(o0);
    Object.keys(BRANDS).forEach(function (b) {
      var o = document.createElement("option");
      o.value = b;
      o.textContent = b;
      sel.appendChild(o);
    });
    if (cur) sel.value = cur;
  }
  function fillModels(brand) {
    var t = tr(),
      sel = $("veh-model");
    if (!sel) return;
    sel.innerHTML = "";
    var o0 = document.createElement("option");
    o0.value = "";
    o0.textContent = t.opt_model;
    sel.appendChild(o0);
    if (brand && BRANDS[brand]) {
      BRANDS[brand].forEach(function (m) {
        var o = document.createElement("option");
        o.value = m;
        o.textContent = m;
        sel.appendChild(o);
      });
      sel.disabled = false;
    } else {
      sel.disabled = true;
    }
  }
  function fillYears() {
    var t = tr(),
      sel = $("veh-year");
    if (!sel) return;
    var cur = sel.value;
    sel.innerHTML = "";
    var o0 = document.createElement("option");
    o0.value = "";
    o0.textContent = t.opt_year;
    sel.appendChild(o0);
    for (var y = 2025; y >= 2005; y--) {
      var o = document.createElement("option");
      o.value = String(y);
      o.textContent = String(y);
      sel.appendChild(o);
    }
    if (cur) sel.value = cur;
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
        (state.year ? " (" + state.year + ")" : "");
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
      eyebrow: "Online-Shop",
      title: "Eise Shop ass am Opbau",
      text: "Mir sinn amgaang, eisen Autodeeler-Shop opzebauen. Kuckt geschwënn erëm laanscht – oder kontaktéiert eis direkt fir Deeler a Präisser.",
      cta: "Deel ufroen",
      back: "Zréck op d’Startsäit",
      dev: "Virschau-Modus – de Shop ass ëffentlech nach am Opbau",
      hide: "verstoppen",
    },
    de: {
      eyebrow: "Online-Shop",
      title: "Unser Shop ist in Arbeit",
      text: "Wir bauen gerade unseren Autoteile-Shop auf. Schauen Sie bald wieder vorbei – oder kontaktieren Sie uns direkt für Teile und Preise.",
      cta: "Anfrage senden",
      back: "Zurück zur Startseite",
      dev: "Vorschau-Modus – Shop öffentlich noch „in Arbeit“",
      hide: "ausblenden",
    },
    fr: {
      eyebrow: "Boutique en ligne",
      title: "Notre boutique est en construction",
      text: "Nous préparons notre boutique de pièces auto. Revenez bientôt – ou contactez-nous directement pour les pièces et les prix.",
      cta: "Envoyer une demande",
      back: "Retour à l’accueil",
      dev: "Mode aperçu – boutique encore « en construction » côté public",
      hide: "masquer",
    },
    en: {
      eyebrow: "Online shop",
      title: "Our shop is under construction",
      text: "We’re building our car-parts shop. Please check back soon – or contact us directly for parts and prices.",
      cta: "Send request",
      back: "Back to home",
      dev: "Preview mode – shop still “under construction” for the public",
      hide: "hide",
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
    var dh = document.querySelector("#shop-dev-badge a");
    if (dh) dh.textContent = s.hide;
    fillBrands();
    fillModels($("veh-brand") ? $("veh-brand").value : "");
    fillYears();
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
    $("veh-brand").addEventListener("change", function () {
      fillModels(this.value);
      $("veh-year").disabled = !this.value;
    });
    // Sproochewiessel: alles nei
    document.querySelectorAll(".lang-switch button").forEach(function (b) {
      b.addEventListener("click", function () {
        setTimeout(function () {
          applyStatics();
          render();
        }, 0);
      });
    });
  }

  function init() {
    applyStatics();
    bind();
    render();
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
