/* Autoservice Bettenduerf – Terminanfrage (FormSubmit) + Saison-Tipps + FAQ */
(function () {
  var MSG = {
    lb: {
      form: {
        submit: "Terminufro schécken",
        note: "Mir behandelen Är Donnéeë vertraulech.",
        sending: "Gëtt geschéckt …",
        ok: "Merci, {name}! Är Terminufro ass ukomm – mir mellen eis geschwënn.",
        err: "Gitt w.e.g. Ären Numm, eng gëlteg E-Mail-Adress, d’Chassisnummer an eng Noriicht un a bestätegt den Dateschutzhinweis.",
        senderr:
          "D’Ufro konnt net geschéckt ginn. Probéiert et w.e.g. nach eng Kéier oder rufft eis un.",
        weekday: "Gewënschten Deeg",
        days: ["Mé", "Dë", "Më", "Do", "Fr", "Sa"],
        time: "Dageszäit",
        time_any: "Egal",
        time_am: "Moies",
        time_pm: "Nomëttes",
        vin: "Chassisnummer (VIN)",
        vin_ph: "z. B. WVWZZZ…",
        privacy: "Ech hunn d'Dateschutzerklärung gelies a verstinn, datt meng Donnéeën iwwer FormSubmit iwwermëttelt ginn.",
      },
      saison: {
        eyebrow: "Tipps",
        title: "Tipps no Saison",
        more: "Méi gewuer ginn",
        items: [
          {
            season: "Wanter",
            emoji: "❄️",
            title: "Sécher duerch de Wanter",
            text: "Wanterpneuen, Batterie a Beliichtung rechtzäiteg préiwe loossen.",
            slug: "tip-winter",
          },
          {
            season: "Fréijoer",
            emoji: "🌤️",
            title: "Fréijoerscheck",
            text: "Vu Summerpneue bis zum Klimaservice – de Won op déi waarm Saison virbereeden.",
            slug: "tip-fruehjahr",
          },
          {
            season: "Summer",
            emoji: "🧳",
            title: "Virun der Vakanz",
            text: "Pneuen, Ueleg a Flëssegkeete virun der grousser Rees kontrolléieren.",
            slug: "tip-summer",
          },
          {
            season: "Hierscht",
            emoji: "🍂",
            title: "Fit fir de Contrôle",
            text: "Bremsen, Beliichtung a Pneue virum Contrôle technique kontrolléieren.",
            slug: "tip-herbst",
          },
        ],
      },
      faq: {
        eyebrow: "FAQ",
        title: "Dacks gestallte Froen",
        items: [
          {
            q: "Muss ech e Rendez-vous huelen?",
            a: "Jo – mir schaffen ausschliisslech op Rendez-vous, fir eis genuch Zäit fir Äre Won ze huelen. Rufft un (+352 80 86 87 / GSM +352 621 435 495) oder schéckt eng Ufro iwwer de Formulaire.",
          },
          {
            q: "Fir wéi eng Marken sidd Dir do?",
            a: "Fir all Marken – däitsch, franséisch, asiatesch a méi. Als fräi Garage betreie mir all Fabrikat.",
          },
          {
            q: "Bleift meng Hiersteller-Garantie erhalen?",
            a: "Jo. Duerch eis 1·2·3 AutoService-Kooperatioun gëtt de Service no de Garantievirgaben vum Hiersteller gemaach an agedroen – Är Garantie bleift voll erhalen.",
          },
          {
            q: "Kënnt Dir mäi Won op de Contrôle technique preparéieren?",
            a: "Jo – mir maachen eng Kontroll am Viraus, behiewe kleng Mängel a begleeden Iech op Wonsch bei de Rendez-vous.",
          },
          {
            q: "Maacht Dir och Tuning a Karrosserie?",
            a: "Jo – vu Rallye- a Rennstreckevirbereedung iwwer Ofsenkung bis zu Karrosserie a Lackéierung.",
          },
          {
            q: "Kréien ech en Devis?",
            a: "Jo – Dir kritt virun der Aarbecht e kloren, transparenten Devis, esou datt et keng béis Iwwerraschunge gëtt.",
          },
        ],
      },
    },
    de: {
      form: {
        submit: "Terminanfrage senden",
        note: "Wir behandeln Ihre Daten vertraulich.",
        sending: "Wird gesendet …",
        ok: "Danke, {name}! Ihre Terminanfrage ist angekommen – wir melden uns in Kürze.",
        err: "Bitte Name, eine gültige E-Mail, die Fahrgestellnummer und eine Nachricht angeben und den Datenschutzhinweis bestätigen.",
        senderr:
          "Ups – die Anfrage konnte nicht gesendet werden. Bitte erneut versuchen oder rufen Sie uns an.",
        weekday: "Wunschtage",
        days: ["Mo", "Di", "Mi", "Do", "Fr", "Sa"],
        time: "Tageszeit",
        time_any: "Egal",
        time_am: "Vormittag",
        time_pm: "Nachmittag",
        vin: "Fahrgestellnummer (VIN)",
        vin_ph: "z. B. WVWZZZ…",
        privacy: "Ich habe die Datenschutzerklärung gelesen und verstanden, dass meine Angaben über FormSubmit übermittelt werden.",
      },
      saison: {
        eyebrow: "Tipps",
        title: "Tipps nach Saison",
        more: "Mehr erfahren",
        items: [
          {
            season: "Winter",
            emoji: "❄️",
            title: "Sicher durch den Winter",
            text: "Winterreifen, Batterie und Beleuchtung rechtzeitig prüfen lassen.",
            slug: "tip-winter",
          },
          {
            season: "Frühling",
            emoji: "🌤️",
            title: "Frühjahrs-Check",
            text: "Von Sommerreifen bis Klimaservice – das Auto fit für die warme Saison machen.",
            slug: "tip-fruehjahr",
          },
          {
            season: "Sommer",
            emoji: "🧳",
            title: "Vor der Urlaubsreise",
            text: "Reifen, Öl und Flüssigkeiten vor der großen Reise checken.",
            slug: "tip-summer",
          },
          {
            season: "Herbst",
            emoji: "🍂",
            title: "Fit für den Contrôle",
            text: "Bremsen, Beleuchtung und Reifen vor dem Contrôle Technique vorbereiten.",
            slug: "tip-herbst",
          },
        ],
      },
      faq: {
        eyebrow: "FAQ",
        title: "Häufige Fragen",
        items: [
          {
            q: "Brauche ich einen Termin?",
            a: "Ja – wir arbeiten ausschließlich nach Termin, damit wir uns Zeit für Ihr Fahrzeug nehmen. Rufen Sie an (+352 80 86 87 / GSM +352 621 435 495) oder senden Sie eine Anfrage über das Formular.",
          },
          {
            q: "Für welche Marken sind Sie da?",
            a: "Für alle Marken – deutsche, französische, asiatische und mehr. Als freie Werkstatt betreuen wir jedes Fabrikat.",
          },
          {
            q: "Bleibt meine Herstellergarantie erhalten?",
            a: "Ja. Durch unsere 1·2·3 AutoService-Kooperation wird der Service nach den Garantievorgaben des Herstellers ausgeführt und eingetragen – Ihre Garantie bleibt vollständig erhalten.",
          },
          {
            q: "Bereiten Sie mein Auto auf den Contrôle Technique vor?",
            a: "Ja – wir machen einen Vorab-Check, beheben kleine Mängel und begleiten Sie auf Wunsch zum Termin.",
          },
          {
            q: "Machen Sie auch Tuning und Karosserie?",
            a: "Ja – von Rallye- und Rennstreckenvorbereitung über Tieferlegung bis zu Karosserie und Lackierung.",
          },
          {
            q: "Bekomme ich einen Kostenvoranschlag?",
            a: "Ja – Sie erhalten vor Beginn der Arbeit einen klaren, transparenten Kostenvoranschlag, damit es keine bösen Überraschungen gibt.",
          },
        ],
      },
    },
    fr: {
      form: {
        submit: "Envoyer la demande",
        note: "Vos données restent confidentielles.",
        sending: "Envoi …",
        ok: "Merci {name} ! Votre demande de rendez-vous est bien arrivée – nous vous recontactons rapidement.",
        err: "Merci d’indiquer votre nom, un e-mail valide, le numéro de châssis et un message, puis de confirmer l’avis de confidentialité.",
        senderr: "Oups – l’envoi a échoué. Réessayez ou appelez-nous.",
        weekday: "Jours souhaités",
        days: ["Lu", "Ma", "Me", "Je", "Ve", "Sa"],
        time: "Moment",
        time_any: "Peu importe",
        time_am: "Matin",
        time_pm: "Après-midi",
        vin: "Numéro de châssis (VIN)",
        vin_ph: "p. ex. VF1…",
        privacy: "J'ai lu la politique de confidentialité et compris que mes données sont transmises via FormSubmit.",
      },
      saison: {
        eyebrow: "Conseils",
        title: "Conseils par saison",
        more: "En savoir plus",
        items: [
          {
            season: "Hiver",
            emoji: "❄️",
            title: "Prêt pour l’hiver",
            text: "Pneus hiver, batterie et éclairage à vérifier à temps.",
            slug: "tip-winter",
          },
          {
            season: "Printemps",
            emoji: "🌤️",
            title: "Check de printemps",
            text: "Des pneus été au service clim – préparez la voiture pour la belle saison.",
            slug: "tip-fruehjahr",
          },
          {
            season: "Été",
            emoji: "🧳",
            title: "Avant les vacances",
            text: "Pneus, huile et niveaux à contrôler avant le grand départ.",
            slug: "tip-summer",
          },
          {
            season: "Automne",
            emoji: "🍂",
            title: "Prêt pour le contrôle",
            text: "Freins, éclairage et pneus à préparer avant le contrôle technique.",
            slug: "tip-herbst",
          },
        ],
      },
      faq: {
        eyebrow: "FAQ",
        title: "Questions fréquentes",
        items: [
          {
            q: "Faut-il prendre rendez-vous ?",
            a: "Oui – nous travaillons uniquement sur rendez-vous afin de consacrer le temps nécessaire à votre véhicule. Appelez le +352 80 86 87 (GSM +352 621 435 495) ou envoyez une demande via le formulaire.",
          },
          {
            q: "Quelles marques entretenez-vous ?",
            a: "Toutes les marques – allemandes, françaises, asiatiques et autres. Garage multimarque, nous entretenons chaque véhicule.",
          },
          {
            q: "Ma garantie constructeur est-elle préservée ?",
            a: "Oui. Grâce à notre coopération 1·2·3 AutoService, l’entretien est réalisé et consigné selon les prescriptions du constructeur – votre garantie reste intégralement préservée.",
          },
          {
            q: "Préparez-vous ma voiture au contrôle technique ?",
            a: "Oui – nous effectuons un pré-contrôle, corrigeons les petits défauts et vous accompagnons au rendez-vous si vous le souhaitez.",
          },
          {
            q: "Faites-vous aussi tuning et carrosserie ?",
            a: "Oui – de la préparation rallye/circuit au rabaissement, jusqu’à la carrosserie et la peinture.",
          },
          {
            q: "Puis-je avoir un devis ?",
            a: "Oui – vous recevez un devis clair et transparent avant les travaux, sans mauvaise surprise.",
          },
        ],
      },
    },
    en: {
      form: {
        submit: "Send request",
        note: "We treat your data confidentially.",
        sending: "Sending …",
        ok: "Thanks, {name}! Your appointment request has arrived – we’ll get back to you shortly.",
        err: "Please enter your name, a valid email, the chassis number and a message, and confirm the privacy notice.",
        senderr:
          "Oops – the request could not be sent. Please try again or call us.",
        weekday: "Preferred days",
        days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        time: "Time of day",
        time_any: "Any",
        time_am: "Morning",
        time_pm: "Afternoon",
        vin: "Chassis number (VIN)",
        vin_ph: "e.g. WVWZZZ…",
        privacy: "I have read the privacy policy and understand that my details are transmitted via FormSubmit.",
      },
      saison: {
        eyebrow: "Tips",
        title: "Seasonal tips",
        more: "Learn more",
        items: [
          {
            season: "Winter",
            emoji: "❄️",
            title: "Ready for winter",
            text: "Have winter tyres, battery and lights checked in good time.",
            slug: "tip-winter",
          },
          {
            season: "Spring",
            emoji: "🌤️",
            title: "Spring check",
            text: "From summer tyres to the air-con service – get the car ready for the warm season.",
            slug: "tip-fruehjahr",
          },
          {
            season: "Summer",
            emoji: "🧳",
            title: "Before your holiday",
            text: "Check tyres, oil and fluids before the big trip.",
            slug: "tip-summer",
          },
          {
            season: "Autumn",
            emoji: "🍂",
            title: "Ready for inspection",
            text: "Prepare brakes, lights and tyres before the Contrôle Technique.",
            slug: "tip-herbst",
          },
        ],
      },
      faq: {
        eyebrow: "FAQ",
        title: "Frequently asked questions",
        items: [
          {
            q: "Do I need an appointment?",
            a: "Yes – we work strictly by appointment so we can give your car the time it needs. Call +352 80 86 87 (mobile +352 621 435 495) or send a request via the form.",
          },
          {
            q: "Which makes do you service?",
            a: "All makes – German, French, Asian and more. As an independent garage we look after every brand.",
          },
          {
            q: "Is my manufacturer’s warranty kept?",
            a: "Yes. Through our 1·2·3 AutoService cooperation the service is carried out and logged to the manufacturer’s specifications – your warranty stays fully intact.",
          },
          {
            q: "Do you prepare my car for the Contrôle Technique?",
            a: "Yes – we do a pre-check, fix minor faults and accompany you to the appointment if you wish.",
          },
          {
            q: "Do you also do tuning and bodywork?",
            a: "Yes – from rally and race-track preparation to lowering, bodywork and paint.",
          },
          {
            q: "Can I get a quote?",
            a: "Yes – you get a clear, transparent estimate before any work, so there are no nasty surprises.",
          },
        ],
      },
    },
  };
  var EMAIL = "Autoservicebettenduerf@outlook.com";
  function lang() {
    var l = document.documentElement.getAttribute("lang");
    if (l && MSG[l]) return l;
    try {
      var s = localStorage.getItem("gk_lang");
      if (s && MSG[s]) return s;
    } catch (e) {}
    return "lb";
  }
  function set(id, txt) {
    var el = document.getElementById(id);
    if (el) el.textContent = txt;
  }
  function applyStatics() {
    var m = MSG[lang()] || MSG.lb;
    set("saison-eyebrow", m.saison.eyebrow);
    set("saison-title", m.saison.title);
    set("faq-eyebrow", m.faq.eyebrow);
    set("faq-title", m.faq.title);
    set("lbl-weekday", m.form.weekday);
    for (var i = 0; i < 6; i++) {
      set("wd-" + (i + 1), m.form.days[i]);
    }
    set("lbl-wtime", m.form.time);
    set("opt-time-any", m.form.time_any);
    set("opt-time-am", m.form.time_am);
    set("opt-time-pm", m.form.time_pm);
    set("lbl-vin", m.form.vin);
    var vin = document.getElementById("vin");
    if (vin) vin.placeholder = m.form.vin_ph;
    set("privacy-confirm-text", m.form.privacy);
    var btn = document.querySelector('#contact-form button[type="submit"]');
    if (btn) btn.textContent = m.form.submit;
    var note = document.querySelector("#contact-form .form-note span");
    if (note) note.textContent = m.form.note;
  }
  function renderSaison() {
    var m = MSG[lang()] || MSG.lb;
    var g = document.getElementById("saison-grid");
    if (!g) return;
    g.innerHTML = "";
    m.saison.items.forEach(function (it) {
      var c = document.createElement("article");
      c.className = "saison-card";
      c.setAttribute("data-slug", it.slug);
      c.style.setProperty(
        "--season-img",
        "url('assets/seasons/" +
          ({
            "tip-winter": "winter.webp",
            "tip-fruehjahr": "spring.webp",
            "tip-summer": "summer.webp",
            "tip-herbst": "autumn.webp",
          }[it.slug] || "summer.webp") +
          "')",
      );
      var e = document.createElement("div");
      e.className = "s-emoji";
      e.textContent = it.emoji;
      var s = document.createElement("span");
      s.className = "s-season";
      s.textContent = it.season;
      var h = document.createElement("h3");
      h.textContent = it.title;
      var p = document.createElement("p");
      p.textContent = it.text;
      var more = document.createElement("span");
      more.className = "s-more";
      more.textContent = m.saison.more + " →";
      var a = document.createElement("a");
      a.className = "card-cover";
      a.href = "service.html?s=" + it.slug;
      a.setAttribute("aria-label", it.title);
      c.appendChild(e);
      c.appendChild(s);
      c.appendChild(h);
      c.appendChild(p);
      c.appendChild(more);
      c.appendChild(a);
      g.appendChild(c);
    });
  }
  function renderFaq() {
    var m = MSG[lang()] || MSG.lb;
    var l = document.getElementById("faq-list");
    if (!l) return;
    l.innerHTML = "";
    m.faq.items.forEach(function (it) {
      var d = document.createElement("details");
      d.className = "faq-item";
      var s = document.createElement("summary");
      s.textContent = it.q;
      var a = document.createElement("div");
      a.className = "faq-a";
      a.textContent = it.a;
      d.appendChild(s);
      d.appendChild(a);
      l.appendChild(d);
    });
  }
  function handleSubmit(e) {
    var f = e.target;
    if (!f || f.id !== "contact-form") return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var m = MSG[lang()] || MSG.lb;
    var st = document.getElementById("form-status");
    if (!st) return;
    st.className = "form-status";
    st.textContent = "";
    function v(id) {
      var el = f.querySelector("#" + id);
      return el ? (el.value || "").trim() : "";
    }
    var name = v("name"),
      email = v("email"),
      message = v("message"),
      vin = v("vin");
    var privacy = f.querySelector("#privacy-confirm");
    var okmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!name || !okmail || !message || !vin || !privacy || !privacy.checked) {
      st.className = "form-status err";
      st.textContent = m.form.err;
      return;
    }
    var hp = f.querySelector('[name="_honey"]');
    if (hp && hp.value) {
      st.className = "form-status ok";
      st.textContent = m.form.ok.replace("{name}", name);
      f.reset();
      return;
    }
    var btn = f.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    st.className = "form-status";
    st.textContent = m.form.sending;
    fetch("https://formsubmit.co/ajax/" + EMAIL, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new FormData(f),
    })
      .then(function (r) {
        if (!r.ok) throw new Error("http");
        return r.json().catch(function () {
          return {};
        });
      })
      .then(function () {
        st.className = "form-status ok";
        st.textContent = m.form.ok.replace("{name}", name);
        f.reset();
      })
      .catch(function () {
        st.className = "form-status err";
        st.textContent = m.form.senderr;
      })
      .then(function () {
        if (btn) btn.disabled = false;
      });
  }
  document.addEventListener("submit", handleSubmit, true);
  function init() {
    applyStatics();
    renderSaison();
    renderFaq();
    document.querySelectorAll(".lang-switch button").forEach(function (b) {
      b.addEventListener("click", function () {
        setTimeout(function () {
          applyStatics();
          renderSaison();
          renderFaq();
        }, 0);
      });
    });
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
