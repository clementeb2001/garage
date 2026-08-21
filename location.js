/* Autoservice Bettenduerf — Location / Verlee (méisproocheg)
   Katalog, Auswiel a Reservéierung (FormSubmit). */
(function () {
  "use strict";

  var EMAIL = "Autoservicebettenduerf@outlook.com";

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
      id: "plateau",
      cat: "trailer",
      icon: "flatbed",
      name: { lb: "Plateau-Ahänger 750 kg", de: "Plateau-Anhänger 750 kg", fr: "Remorque plateau 750 kg", en: "Flatbed trailer 750 kg" },
      specs: {
        lb: ["Nutzlaascht bis 750 kg", "Ongebremst", "Führerschäin B duergeet"],
        de: ["Nutzlast bis 750 kg", "Ungebremst", "Führerschein B ausreichend"],
        fr: ["Charge utile jusqu'à 750 kg", "Sans freins", "Permis B suffisant"],
        en: ["Payload up to 750 kg", "Unbraked", "Licence B is enough"],
      },
    },
    {
      id: "kipper",
      cat: "trailer",
      icon: "tipper",
      name: { lb: "Kippanhänger 1300 kg", de: "Kippanhänger 1300 kg", fr: "Remorque benne 1300 kg", en: "Tipper trailer 1300 kg" },
      specs: {
        lb: ["Nutzlaascht bis 1300 kg", "Hydraulescht Kippen", "Gebremst · Führerschäin BE"],
        de: ["Nutzlast bis 1300 kg", "Hydraulisch kippbar", "Gebremst · Führerschein BE"],
        fr: ["Charge utile jusqu'à 1300 kg", "Benne hydraulique", "Freinée · permis BE"],
        en: ["Payload up to 1300 kg", "Hydraulic tipping", "Braked · licence BE"],
      },
    },
    {
      id: "autotrans",
      cat: "trailer",
      icon: "cartrans",
      name: { lb: "Autotransporter", de: "Autotransporter", fr: "Remorque porte-voiture", en: "Car-transport trailer" },
      specs: {
        lb: ["Fir 1 Auto", "Gebremst", "Uschléissrampe abegraff"],
        de: ["Für 1 Fahrzeug", "Gebremst", "Auffahrschienen inklusive"],
        fr: ["Pour 1 voiture", "Freinée", "Rampes incluses"],
        en: ["For 1 car", "Braked", "Loading ramps included"],
      },
    },
    {
      id: "koffer",
      cat: "trailer",
      icon: "box",
      name: { lb: "Kofferanhänger (zou)", de: "Kofferanhänger (geschlossen)", fr: "Remorque fermée", en: "Enclosed box trailer" },
      specs: {
        lb: ["Dréchen a geséchert", "Ofschléissbar", "Fir empfindlecht Transportgutt"],
        de: ["Trocken & geschützt", "Abschließbar", "Für empfindliche Ladung"],
        fr: ["Sec et protégé", "Verrouillable", "Pour charges sensibles"],
        en: ["Dry & protected", "Lockable", "For sensitive loads"],
      },
    },
    {
      id: "ersatzwagen",
      cat: "vehicle",
      icon: "car",
      name: { lb: "Ersatzween", de: "Ersatzwagen", fr: "Véhicule de remplacement", en: "Courtesy car" },
      specs: {
        lb: ["Wärend der Reparatur", "Klenge Stadtween", "Op Ufro disponibel"],
        de: ["Während der Reparatur", "Kompakter Stadtwagen", "Auf Anfrage verfügbar"],
        fr: ["Pendant la réparation", "Citadine compacte", "Disponible sur demande"],
        en: ["During your repair", "Compact city car", "Available on request"],
      },
    },
    {
      id: "camionnette",
      cat: "vehicle",
      icon: "van",
      name: { lb: "Camionnette / Transporter", de: "Transporter / Lieferwagen", fr: "Camionnette / utilitaire", en: "Van / transporter" },
      specs: {
        lb: ["Fir Ëmzuch a Transport", "Grousse Luedraum (L2H2)", "Führerschäin B duergeet"],
        de: ["Für Umzug & Transport", "Großer Laderaum (L2H2)", "Führerschein B ausreichend"],
        fr: ["Déménagement & transport", "Grand volume (L2H2)", "Permis B suffisant"],
        en: ["Moving & transport", "Large load space (L2H2)", "Licence B is enough"],
      },
    },
  ];

  /* ---- Iwwersetzungen (Säit-Strings) ---- */
  var T = {
    lb: {
      eyebrow: "Location · Verlee",
      title: "Material a Fahrzeuger verleeën",
      sub: "Wielt Ären Ahänger oder Äert Fahrzeug aus, gitt Äre Reservéierungszäitraum un – mir bestätegen Iech Är Ufro.",
      nav: "Location",
      cat_all: "Alles", cat_trailer: "Ahänger", cat_vehicle: "Fahrzeuger",
      cat_trailer_lbl: "Ahänger", cat_vehicle_lbl: "Fahrzeug",
      price: "Präis op Ufro",
      select: "Auswielen", selected: "Ausgewielt", remove: "Ewechhuelen",
      sel_h: "Är Auswiel", empty: "Nach näischt ausgewielt. Wielt uewen Äert Material aus.",
      form_h: "Reservéieren",
      from: "Vun", to: "Bis", name: "Numm", email: "E-Mail", phone: "Telefon",
      message: "Noriicht", phone_ph: "Optional",
      privacy: "Ech hunn d'Dateschutzerklärung gelies a verstinn, datt meng Donnéeën iwwer FormSubmit iwwermëttelt ginn.",
      submit: "Reservéierung ufroen",
      note: "D'Reservéierung ass eng Ufro a gëtt vun eis bestätegt.",
      sending: "Gëtt geschéckt …",
      ok: "Merci! Är Location-Ufro ass ukomm. Mir mellen eis séier.",
      senderr: "Ups, dat huet net geklappt. Rufft eis w.e.g. un oder probéiert et méi spéit nach eng Kéier.",
      missing: "Fëllt w.e.g. nach aus:",
      m_items: "op d'mannst 1 Material", m_from: "Ufanksdatum", m_to: "Enndatum",
      m_daterange: "en Enndatum no dem Ufank", m_name: "Numm", m_email: "eng gëlteg E-Mail", m_privacy: "Dateschutz-Zoustëmmung",
    },
    de: {
      eyebrow: "Location · Verleih",
      title: "Material & Fahrzeuge mieten",
      sub: "Wählen Sie Ihren Anhänger oder Ihr Fahrzeug, geben Sie den Mietzeitraum an – wir bestätigen Ihre Anfrage.",
      nav: "Verleih",
      cat_all: "Alles", cat_trailer: "Anhänger", cat_vehicle: "Fahrzeuge",
      cat_trailer_lbl: "Anhänger", cat_vehicle_lbl: "Fahrzeug",
      price: "Preis auf Anfrage",
      select: "Auswählen", selected: "Ausgewählt", remove: "Entfernen",
      sel_h: "Ihre Auswahl", empty: "Noch nichts ausgewählt. Wählen Sie oben Ihr Material.",
      form_h: "Reservieren",
      from: "Von", to: "Bis", name: "Name", email: "E-Mail", phone: "Telefon",
      message: "Nachricht", phone_ph: "Optional",
      privacy: "Ich habe die Datenschutzerklärung gelesen und verstehe, dass meine Daten über FormSubmit übermittelt werden.",
      submit: "Reservierung anfragen",
      note: "Die Reservierung ist eine Anfrage und wird von uns bestätigt.",
      sending: "Wird gesendet …",
      ok: "Danke! Ihre Verleih-Anfrage ist angekommen. Wir melden uns zeitnah.",
      senderr: "Ups, das hat nicht geklappt. Bitte rufen Sie uns an oder versuchen Sie es später erneut.",
      missing: "Bitte ergänzen Sie noch:",
      m_items: "mindestens 1 Material", m_from: "Startdatum", m_to: "Enddatum",
      m_daterange: "ein Enddatum nach dem Start", m_name: "Name", m_email: "eine gültige E-Mail", m_privacy: "Datenschutz-Zustimmung",
    },
    fr: {
      eyebrow: "Location",
      title: "Louer du matériel & des véhicules",
      sub: "Choisissez votre remorque ou votre véhicule, indiquez la période de location – nous confirmons votre demande.",
      nav: "Location",
      cat_all: "Tout", cat_trailer: "Remorques", cat_vehicle: "Véhicules",
      cat_trailer_lbl: "Remorque", cat_vehicle_lbl: "Véhicule",
      price: "Prix sur demande",
      select: "Choisir", selected: "Sélectionné", remove: "Retirer",
      sel_h: "Votre sélection", empty: "Rien de sélectionné. Choisissez votre matériel ci-dessus.",
      form_h: "Réserver",
      from: "Du", to: "Au", name: "Nom", email: "E-mail", phone: "Téléphone",
      message: "Message", phone_ph: "Facultatif",
      privacy: "J'ai lu la politique de confidentialité et j'accepte que mes données soient transmises via FormSubmit.",
      submit: "Demander la réservation",
      note: "La réservation est une demande et sera confirmée par nos soins.",
      sending: "Envoi …",
      ok: "Merci ! Votre demande de location est bien arrivée. Nous vous recontactons rapidement.",
      senderr: "Oups, cela n'a pas fonctionné. Merci de nous appeler ou de réessayer plus tard.",
      missing: "Veuillez compléter :",
      m_items: "au moins 1 matériel", m_from: "date de début", m_to: "date de fin",
      m_daterange: "une date de fin après le début", m_name: "nom", m_email: "un e-mail valide", m_privacy: "accord de confidentialité",
    },
    en: {
      eyebrow: "Rental",
      title: "Rent equipment & vehicles",
      sub: "Pick your trailer or vehicle, enter your rental period – we confirm your request.",
      nav: "Rental",
      cat_all: "All", cat_trailer: "Trailers", cat_vehicle: "Vehicles",
      cat_trailer_lbl: "Trailer", cat_vehicle_lbl: "Vehicle",
      price: "Price on request",
      select: "Select", selected: "Selected", remove: "Remove",
      sel_h: "Your selection", empty: "Nothing selected yet. Pick your equipment above.",
      form_h: "Reserve",
      from: "From", to: "To", name: "Name", email: "Email", phone: "Phone",
      message: "Message", phone_ph: "Optional",
      privacy: "I have read the privacy policy and understand that my data is transmitted via FormSubmit.",
      submit: "Request reservation",
      note: "The reservation is a request and will be confirmed by us.",
      sending: "Sending …",
      ok: "Thank you! Your rental request has arrived. We'll get back to you soon.",
      senderr: "Oops, that didn't work. Please call us or try again later.",
      missing: "Please also add:",
      m_items: "at least 1 item", m_from: "start date", m_to: "end date",
      m_daterange: "an end date after the start", m_name: "name", m_email: "a valid email", m_privacy: "privacy consent",
    },
  };

  var state = { cat: "all", selected: [] };

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
  function $(id) { return document.getElementById(id); }
  function setTxt(id, s) { var el = $(id); if (el) el.textContent = s; }

  function catLabel(cat) {
    var m = t();
    return cat === "trailer" ? m.cat_trailer_lbl : m.cat_vehicle_lbl;
  }

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
      var specs = (it.specs[L] || it.specs.lb)
        .map(function (s) { return "<li>" + s + "</li>"; })
        .join("");
      card.innerHTML =
        '<div class="rental-media"><span class="rental-ribbon">' + catLabel(it.cat) + "</span>" +
        '<span class="rental-ic">' + ICONS[it.icon] + "</span></div>" +
        '<div class="rental-body">' +
        "<h3>" + (it.name[L] || it.name.lb) + "</h3>" +
        '<ul class="rental-specs">' + specs + "</ul>" +
        '<div class="rental-cardfoot">' +
        '<span class="rental-price">' + m.price + "</span>" +
        '<button type="button" class="btn rental-select" data-id="' + it.id + '">' +
        (picked ? "✓ " + m.selected : m.select) +
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
          '<span class="rental-sel-name">' + (it.name[lang()] || it.name.lb) + "</span>" +
          '<button type="button" class="rental-sel-x" data-id="' + id + '" aria-label="' + m.remove + '">✕</button>';
        list.appendChild(li);
      });
    }
    // Hidden field for FormSubmit
    var hidden = $("rental-hidden-items");
    if (hidden) {
      hidden.value = state.selected
        .map(function (id) {
          var it = CATALOG.filter(function (x) { return x.id === id; })[0];
          return it ? it.name.de : id;
        })
        .join(", ");
    }
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
    setTxt("rental-eyebrow", m.eyebrow);
    setTxt("rental-title", m.title);
    setTxt("rental-sub", m.sub);
    setTxt("rental-sel-h", m.sel_h);
    setTxt("rental-empty", m.empty);
    setTxt("rental-form-h", m.form_h);
    setTxt("lbl-r-from", m.from);
    setTxt("lbl-r-to", m.to);
    setTxt("lbl-r-name", m.name);
    setTxt("lbl-r-email", m.email);
    setTxt("lbl-r-phone", m.phone);
    setTxt("lbl-r-message", m.message);
    setTxt("r-privacy-text", m.privacy);
    setTxt("rental-submit", m.submit);
    setTxt("rental-note", m.note);
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
        x.setAttribute("aria-selected", on ? "true" : "false");
      });
      renderCatalog();
    });
  }

  function wireGrid() {
    var grid = $("rental-grid");
    if (grid)
      grid.addEventListener("click", function (e) {
        var b = e.target.closest(".rental-select");
        if (b) toggle(b.getAttribute("data-id"));
      });
    var list = $("rental-sel-list");
    if (list)
      list.addEventListener("click", function (e) {
        var b = e.target.closest(".rental-sel-x");
        if (b) toggle(b.getAttribute("data-id"));
      });
  }

  function mark(el, bad) {
    if (!el) return;
    if (bad) el.classList.add("field-invalid");
    else el.classList.remove("field-invalid");
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

    var from = $("r-from"), to = $("r-to"), name = $("r-name"), email = $("r-email"), privacy = $("r-privacy");
    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email.value || "").trim());
    var miss = [];

    if (!state.selected.length) miss.push(m.m_items);
    mark(from, false); mark(to, false); mark(name, false); mark(email, false);
    if (!from.value) { miss.push(m.m_from); mark(from, true); }
    if (!to.value) { miss.push(m.m_to); mark(to, true); }
    if (from.value && to.value && to.value < from.value) { miss.push(m.m_daterange); mark(to, true); }
    if (!name.value.trim()) { miss.push(m.m_name); mark(name, true); }
    if (!emailOk) { miss.push(m.m_email); mark(email, true); }
    var priv = privacy.closest(".privacy-confirm");
    if (!privacy.checked) { miss.push(m.m_privacy); if (priv) priv.classList.add("privacy-invalid"); }
    else if (priv) priv.classList.remove("privacy-invalid");

    if (miss.length) {
      st.className = "form-status err";
      st.textContent = m.missing + " " + miss.join(", ") + ".";
      var first = f.querySelector(".field-invalid, .privacy-invalid input");
      if (first && first.focus) first.focus();
      return;
    }

    var hp = f.querySelector('[name="_honey"]');
    if (hp && hp.value) { st.className = "form-status ok"; st.textContent = m.ok; f.reset(); return; }

    var btn = $("rental-submit");
    if (btn) btn.disabled = true;
    st.className = "form-status";
    st.textContent = m.sending;
    fetch("https://formsubmit.co/ajax/" + EMAIL, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new FormData(f),
    })
      .then(function (r) { if (!r.ok) throw new Error("http"); return r.json().catch(function () { return {}; }); })
      .then(function () {
        st.className = "form-status ok";
        st.textContent = m.ok;
        f.reset();
        state.selected = [];
        renderCatalog();
        renderSelection();
      })
      .catch(function () { st.className = "form-status err"; st.textContent = m.senderr; })
      .then(function () { if (btn) btn.disabled = false; });
  }

  function wireClear() {
    ["r-from", "r-to", "r-name", "r-email"].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener("input", function () { mark(el, false); });
    });
    var priv = $("r-privacy");
    if (priv) priv.addEventListener("change", function () {
      var p = priv.closest(".privacy-confirm");
      if (p && priv.checked) p.classList.remove("privacy-invalid");
    });
  }

  function refresh() {
    applyStatics();
    renderCatalog();
    renderSelection();
  }

  function init() {
    applyStatics();
    renderCatalog();
    renderSelection();
    wireFilter();
    wireGrid();
    wireClear();
    document.addEventListener("submit", handleSubmit, true);
    document.querySelectorAll(".lang-select").forEach(function (s) {
      s.addEventListener("change", function () { setTimeout(refresh, 0); });
    });
    var y = $("year"); if (y) y.textContent = new Date().getFullYear();
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
