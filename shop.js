/* Autoservice Bettenduerf — Shop (REMUS Sport Exhausts), méisproocheg.
   Katalog kënnt aus shop-data.js (window.SHOP_PRODUCTS / SHOP_BRANDS).
   Bezuelung iwwer Mollie (kuck worker/mollie-payment.js). */
(function () {
  "use strict";

  var PAYMENT_ENDPOINT = "https://mollie-pay.autoservicebettenduerf.lu";
  var RENDER_CAP = 60;

  var PRODUCTS = window.SHOP_PRODUCTS || [];
  var BRANDS = window.SHOP_BRANDS || {};
  var cart = [];

  var state = { mode: "all", q: "", cat: "all", brand: "", model: "" };

  /* ---------- Iwwersetzungen ---------- */
  var T = {
    lb: {
      eyebrow: "Onlineshop", title: "Autodeeler-Shop",
      sub: "REMUS Sportauspuffen elo do – DBA-Bremsen geschwënn. Sich no Artikel oder wiel däi Won.",
      tab_artikel: "Artikel", tab_fahrzeug: "Won",
      ph_text: "Bezeechnung oder Artikelnummer …", btn_text: "Sichen",
      ph_brand: "Marke wielen oder aginn", ph_model: "Modell wielen oder aginn",
      btn_veh: "Passend Deeler fannen",
      cats: { all: "Alles", system: "Sportauspuffen", tail: "Endrohren", adapter: "Adapter" },
      info_all: "{n} Artikelen", info_more: "{n} Artikelen (déi éischt {c} gewisen – verfeinert d’Sich)",
      info_search: "{n} Resultater fir „{q}“", info_veh: "{n} Deeler fir {v}",
      info_cat: "{n} · {c}",
      empty: "Keng Artikelen fonnt. Rufft eis un – mir fannen dat richtegt Deel.",
      fits: "Passt:", artnr: "Art-Nr.", add: "An de Kuerf",
      added: "„{n}“ an de Kuerf geluecht", vat: "All Präisser exkl. TVA (RRP 2026).",
      note_title: "Deel net fonnt?",
      note_text: "Mir fannen Iech déi richteg REMUS-Anlag fir Äre Won – rufft un oder schéckt eng Ufro.",
      note_cta: "Deel ufroen",
      cart_title: "Äre Kuerf", cart_empty: "Äre Kuerf ass eidel.", cart_total: "Total",
      cart_checkout: "Bezuelen", cart_remove: "Ewechhuelen",
      cart_note: "Sécher bezuelen iwwer Mollie – Kaart, Wero, Revolut oder Iwwerweisung. Präisser exkl. TVA.",
      cart_redirect: "Gëtt op d’Bezuelung weidergeleet …",
      cart_err: "D’Bezuelung ass de Moment net erreechbar. Probéiert w.e.g. méi spéit oder rufft eis un.",
    },
    de: {
      eyebrow: "Onlineshop", title: "Autoteile-Shop",
      sub: "REMUS Sportauspuffanlagen jetzt verfügbar – DBA-Bremsen folgen. Nach Artikel suchen oder Fahrzeug wählen.",
      tab_artikel: "Artikel", tab_fahrzeug: "Fahrzeug",
      ph_text: "Bezeichnung oder Artikelnummer …", btn_text: "Suchen",
      ph_brand: "Marke wählen oder eingeben", ph_model: "Modell wählen oder eingeben",
      btn_veh: "Passende Teile finden",
      cats: { all: "Alle", system: "Sportauspuffanlagen", tail: "Endrohre", adapter: "Adapter" },
      info_all: "{n} Artikel", info_more: "{n} Artikel (erste {c} angezeigt – Suche verfeinern)",
      info_search: "{n} Ergebnisse für „{q}“", info_veh: "{n} Teile für {v}",
      info_cat: "{n} · {c}",
      empty: "Keine Artikel gefunden. Rufen Sie uns an – wir finden das richtige Teil.",
      fits: "Passt:", artnr: "Art-Nr.", add: "In den Warenkorb",
      added: "„{n}“ in den Warenkorb gelegt", vat: "Alle Preise zzgl. MwSt. (RRP 2026).",
      note_title: "Teil nicht gefunden?",
      note_text: "Wir finden die passende REMUS-Anlage für Ihr Fahrzeug – rufen Sie an oder senden Sie eine Anfrage.",
      note_cta: "Teil anfragen",
      cart_title: "Ihr Warenkorb", cart_empty: "Ihr Warenkorb ist leer.", cart_total: "Gesamt",
      cart_checkout: "Bezahlen", cart_remove: "Entfernen",
      cart_note: "Sicher bezahlen über Mollie – Karte, Wero, Revolut oder Überweisung. Preise zzgl. MwSt.",
      cart_redirect: "Weiterleitung zur Bezahlung …",
      cart_err: "Die Bezahlung ist derzeit nicht erreichbar. Bitte später erneut versuchen oder anrufen.",
    },
    fr: {
      eyebrow: "Boutique", title: "Boutique de pièces",
      sub: "Échappements sport REMUS disponibles – freins DBA à venir. Recherchez un article ou choisissez votre véhicule.",
      tab_artikel: "Article", tab_fahrzeug: "Véhicule",
      ph_text: "Désignation ou numéro d’article …", btn_text: "Rechercher",
      ph_brand: "Choisir ou saisir la marque", ph_model: "Choisir ou saisir le modèle",
      btn_veh: "Trouver les pièces",
      cats: { all: "Tout", system: "Lignes d’échappement", tail: "Sorties", adapter: "Adaptateurs" },
      info_all: "{n} articles", info_more: "{n} articles ({c} premiers affichés – affinez la recherche)",
      info_search: "{n} résultats pour « {q} »", info_veh: "{n} pièces pour {v}",
      info_cat: "{n} · {c}",
      empty: "Aucun article trouvé. Appelez-nous – nous trouvons la bonne pièce.",
      fits: "Compatible :", artnr: "Réf.", add: "Au panier",
      added: "« {n} » ajouté au panier", vat: "Tous les prix HT (RRP 2026).",
      note_title: "Pièce introuvable ?",
      note_text: "Nous trouvons la ligne REMUS adaptée à votre véhicule – appelez ou envoyez une demande.",
      note_cta: "Demander une pièce",
      cart_title: "Votre panier", cart_empty: "Votre panier est vide.", cart_total: "Total",
      cart_checkout: "Payer", cart_remove: "Retirer",
      cart_note: "Paiement sécurisé via Mollie – carte, Wero, Revolut ou virement. Prix HT.",
      cart_redirect: "Redirection vers le paiement …",
      cart_err: "Le paiement est momentanément indisponible. Réessayez plus tard ou appelez-nous.",
    },
    en: {
      eyebrow: "Online shop", title: "Car parts shop",
      sub: "REMUS sport exhausts available now – DBA brakes coming. Search an article or pick your vehicle.",
      tab_artikel: "Article", tab_fahrzeug: "Vehicle",
      ph_text: "Name or part number …", btn_text: "Search",
      ph_brand: "Choose or type make", ph_model: "Choose or type model",
      btn_veh: "Find matching parts",
      cats: { all: "All", system: "Exhaust systems", tail: "Tail pipes", adapter: "Adapters" },
      info_all: "{n} items", info_more: "{n} items (first {c} shown – refine your search)",
      info_search: "{n} results for “{q}”", info_veh: "{n} parts for {v}",
      info_cat: "{n} · {c}",
      empty: "No items found. Call us – we’ll find the right part.",
      fits: "Fits:", artnr: "Part no.", add: "Add to cart",
      added: "“{n}” added to cart", vat: "All prices excl. VAT (RRP 2026).",
      note_title: "Part not found?",
      note_text: "We’ll find the right REMUS system for your car – call or send a request.",
      note_cta: "Request a part",
      cart_title: "Your cart", cart_empty: "Your cart is empty.", cart_total: "Total",
      cart_checkout: "Pay", cart_remove: "Remove",
      cart_note: "Secure payment via Mollie – card, Wero, Revolut or bank transfer. Prices excl. VAT.",
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
  function brandsOf(p) {
    var seen = {}, out = [];
    p.f.forEach(function (x) { if (!seen[x[0]]) { seen[x[0]] = 1; out.push(x[0]); } });
    return out;
  }

  /* ---------- Filter ---------- */
  function matches(p) {
    if (state.cat !== "all" && p.c !== state.cat) return false;
    if (state.mode === "search" && state.q) {
      var q = state.q.toLowerCase();
      return p.a.toLowerCase().indexOf(q) !== -1 || p.n.toLowerCase().indexOf(q) !== -1;
    }
    if (state.mode === "vehicle" && state.brand) {
      return p.f.some(function (x) {
        return x[0] === state.brand && (!state.model || x[1] === state.model);
      });
    }
    return true;
  }

  /* ---------- Kategorie-Chips ---------- */
  function renderChips() {
    var t = tr(), wrap = $("cat-chips");
    if (!wrap) return;
    wrap.innerHTML = "";
    ["all", "system", "tail", "adapter"].forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cat-chip" + (state.cat === c ? " active" : "");
      b.textContent = t.cats[c];
      b.addEventListener("click", function () { state.cat = c; render(); });
      wrap.appendChild(b);
    });
  }

  /* ---------- Katalog rendern ---------- */
  function render() {
    var t = tr(), grid = $("shop-grid"), info = $("shop-result-info"), empty = $("shop-empty");
    if (!grid) return;
    renderChips();
    var list = PRODUCTS.filter(matches);
    var n = list.length;
    var shown = list.slice(0, RENDER_CAP);
    grid.innerHTML = "";
    shown.forEach(function (p) {
      var c = document.createElement("article");
      c.className = "shop-card";
      var cat = document.createElement("span");
      cat.className = "shop-cat";
      cat.textContent = t.cats[p.c] || p.c;
      var h = document.createElement("h3");
      h.textContent = p.n;
      var fit = document.createElement("p");
      fit.className = "shop-fit";
      var bl = brandsOf(p);
      fit.textContent = t.fits + " " + bl.slice(0, 3).join(", ") + (bl.length > 3 ? " +" + (bl.length - 3) : "");
      var foot = document.createElement("div");
      foot.className = "shop-card-foot";
      var art = document.createElement("span");
      art.className = "shop-artnr";
      art.textContent = t.artnr + " " + p.a;
      var pr = document.createElement("span");
      pr.className = "shop-price";
      pr.textContent = centsToStr(p.p);
      foot.appendChild(art);
      foot.appendChild(pr);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-outline shop-add";
      btn.textContent = t.add;
      btn.addEventListener("click", function () { addToCart(p, btn); });
      c.appendChild(cat);
      c.appendChild(h);
      c.appendChild(fit);
      c.appendChild(foot);
      c.appendChild(btn);
      grid.appendChild(c);
    });
    var txt;
    if (state.mode === "search" && state.q) txt = t.info_search.replace("{n}", n).replace("{q}", state.q);
    else if (state.mode === "vehicle" && state.brand)
      txt = t.info_veh.replace("{n}", n).replace("{v}", state.brand + (state.model ? " " + state.model : ""));
    else if (n > RENDER_CAP) txt = t.info_more.replace("{n}", n).replace("{c}", RENDER_CAP);
    else txt = t.info_all.replace("{n}", n);
    if (state.cat !== "all") txt = t.info_cat.replace("{n}", txt).replace("{c}", t.cats[state.cat]);
    if (info) info.textContent = txt;
    if (empty) empty.hidden = n > 0;
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
  function initCombos() {
    makeCombo("veh-brand", "list-brand",
      function () { return Object.keys(BRANDS); },
      function (val) {
        state.brand = BRANDS[val] ? val : "";
        var m = $("veh-model");
        if (m) { m.disabled = !state.brand; if (state.brand) { m.value = ""; state.model = ""; } }
      });
    makeCombo("veh-model", "list-model",
      function () { return state.brand && BRANDS[state.brand] ? BRANDS[state.brand] : []; },
      function (val) {
        var ms = state.brand && BRANDS[state.brand] ? BRANDS[state.brand] : [];
        state.model = ms.indexOf(val) !== -1 ? val : "";
      });
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
    var line = cart.filter(function (l) { return l.id === p.a; })[0];
    if (line) line.qty++;
    else cart.push({ id: p.a, name: p.n, cents: p.p, qty: 1 });
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
    var t = tr(), st = $("cart-status"), btn = $("cart-checkout");
    if (!cart.length) return;
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
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeCart(); });
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
