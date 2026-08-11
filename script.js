/* Autoservice Bettenduerf — Interaktioun & Méisproochegkeet */
(function () {
  'use strict';

  /* ============================================================
     Iwwersetzungen — LB (Standard), DE, FR, EN
     ============================================================ */
  var I18N = {
    lb: {
      nav_services: 'Servicer', nav_tuning: 'Tuning', nav_about: 'Iwwer eis', nav_why: 'Firwat mir',
      nav_hours: 'Ëffnungszäiten', nav_cta: 'Rendez-vous ufroen',
      topbar_partner: 'Offiziellen Partnerbetrib',
      hero_eyebrow: 'Autosgarage · Bettendorf, Lëtzebuerg',
      hero_title_1: 'Ären Auto a', hero_title_2: 'beschten Hänn.',
      hero_lead: 'Vun der Inspektioun bis zum Tuning – Autoservice Bettenduerf steet fir éierlech Berodung, propper Aarbecht a fair Präisser. Fir all Marken, mat modernster Diagnostik.',
      hero_btn2: 'Eis Servicer',
      hero_b1_v: 'Perséinlech', hero_b1_l: 'Éierlech Berodung',
      hero_b2_v: 'All Marken', hero_b2_l: 'Fräi Garage',
      hero_b3_v: '1·2·3 AutoService', hero_b3_l: 'Partnernetzwierk',
      trust1: '1·2·3 AutoService Partnergarage', trust2: 'All Marken a Modeller',
      trust3: 'Reifenservice an Alagerung', trust4: 'Nëmme mat Rendez-vous',
      coop_eyebrow: 'Kooperatioun 1·2·3 AutoService', coop_title: 'Ären Hiersteller-Garantie bleift erhalen',
      coop_text: 'Duerch eis Kooperatioun mam 1·2·3 AutoService-Netzwierk gëtt de Service-Entrée no de Garantievirgaben vum Hiersteller duerchgefouert. Esou bleift Är Hiersteller-Garantie bei enger Wartung an eiser Garage voll erhalen.',
      services_eyebrow: 'Eis Servicer',
      services_title: 'Alles ronderëm Ären Auto – aus enger Hand',
      services_sub: 'Vun der klassescher Wartung bis zur elektronescher Diagnos. Mir këmmeren eis ëm Äre Won, fir datt Dir sécher ënnerwee sidd.',
      svc1_t: 'Wartung & Inspektioun', svc1_d: 'Reegelméisseg Inspektioun no Virschrëft vum Hiersteller – fir de Wäert an d’Sécherheet vun Ärem Won.',
      svc2_t: 'Ueleswiessel & Filteren', svc2_d: 'Frëschen Ueleg, nei Filteren an e Bléck op all d’Flëssegkeeten – séier a propper gemaach.',
      svc3_t: 'Reifenservice', svc3_d: 'Reifenwiessel, Auswuchten, Alagerung a Berodung zu Summer-, Winter- a Ganzjoresreifen.',
      svc4_t: 'Bremsen & Fahrwierk', svc4_d: 'Bremsbelag, Scheiwen, Stoussdämpfer an Achsvermiessung – fir optimalen Halt op der Strooss.',
      svc5_t: 'Feelerdiagnos', svc5_d: 'Modern Diagnosegeräter fannen zouverlässeg d’Ursaach vu Warnluuchten an Elektronikproblemer.',
      svc6_t: 'Klimaservice', svc6_d: 'Klimaanlag kontrolléieren, desinfizéieren an nei fëllen – fir e kille Kapp am Summer a kloer Siicht.',
      svc7_t: 'Contrôle Technique', svc7_d: 'Mir preparéieren Äre Won optimal op de Contrôle Technique vir – a begleeden Iech op den Rendez-vous.',
      svc8_t: 'Batterie & Elektrik', svc8_d: 'Batterietest, Start-Stopp-Systemer, Beliichtung a Bordelektronik – alles am Bléck.',
      svc9_t: 'Tuning & Motorsport', svc9_d: 'Rallye- a Rennstreckevirbereedung, Tieferleeung a Sportfahrwierker – ofgestëmmt op Är Wënsch.',
      svc10_t: 'Karrosserie & Lackéierung', svc10_d: 'Karrosseriearbechten, Spoiler, Verbreederungen a propper Lackéierung.',
      about_eyebrow: 'Iwwer Autoservice Bettenduerf',
      about_title: 'E Familljebetrib, deem Dir vertraue kënnt',
      about_p1: 'Zu Bettenduerf si mir déi zouverlässeg Adress, wann et ëm d’Wuel vun Ärem Won geet. Bei eis schaffen erfueren Mechaniker, déi hiert Handwierk verstinn – an Iech éierlech soen, wat wierklech néideg ass.',
      about_p2: 'Als Partner am 1·2·3 AutoService-Netzwierk verbanne mir perséinlech Betreiung mat moderner Technik a Qualitéitsdeeler. Egal ob klenge Won, Famillenauto oder Transporter – all Won kritt déiselwecht Suergfalt.',
      about_c1: 'Transparent Devisen – keng béis Iwwerraschungen',
      about_c2: 'Original- a Qualitéitsersatzdeeler fir all Marken',
      about_c3: 'Perséinlech Uspriechpartner, déi sech Zäit huelen',
      about_badge_t: '1·2·3 AutoService', about_badge_s: 'Partnergarage am Netzwierk',
      why_eyebrow: 'Firwat Autoservice Bettenduerf', why_title: 'Gutt Grënn fir ären Besuch',
      feat1_t: 'Éierlech Berodung', feat1_d: 'Mir reparéieren nëmmen dat, wat wierklech néideg ass – an erkläre jiddwer Schrëtt verständlech.',
      feat2_t: 'Fair Präisser', feat2_d: 'Kloer Devisen ier d’Aarbecht ufänkt. Dir behalt ëmmer den Iwwerbléck.',
      feat3_t: 'All Marken', feat3_d: 'Egal ob däitsch, franséisch oder asiatesch Autoen – mir kennen eis aus.',
      feat4_t: 'Séiere Service', feat4_d: 'Kuerz Waardezäiten a flexibel Rendez-vousen, fir datt Dir séier erëm mobil sidd.',
      hours_eyebrow: 'Ëffnungszäiten', hours_title: 'Nëmme mat Rendez-vous',
      hours_sub: 'Eis Werkstatt ass net reegelméisseg op – all Interventioun leeft iwwer e Rendez-vous.',
      hours_appt_t: 'Nëmme mat Rendez-vous',
      hours_appt_d: 'Eis Atelier ass net duerchgängeg op – mir schaffen ausschliisslech op Rendez-vous, fir datt mir eis genuch Zäit fir Äre Won huelen. Rufft un oder schéckt eis eng Ufro.',
      contact_eyebrow: 'Kontakt & Uwee', contact_title: 'Rendez-vous ufroen',
      contact_intro: 'Schreift eis kuerz, ëm wat et geet – mir mellen eis séier mat engem Terminvirschlag.',
      ci_addr_l: 'Adress', ci_phone_l: 'Telefon', ci_gsm_l: 'GSM', map_route: 'Navigatioun starten',
      f_name: 'Numm', f_name_ph: 'Ären Numm', f_email_ph: 'ären@email.lu',
      f_phone: 'Telefon', f_phone_ph: 'Optional',
      f_service: 'Ären Uleies', f_service_opt0: 'Wielt w.e.g. …', f_other: 'Anescht',
      f_message: 'Message', f_message_ph: 'Beschreift kuerz Ären Uleies an Äre Won (Mark, Modell, Baujoer) …',
      f_submit: 'E-Mail virbereeden', f_note: 'Är Ufro gëtt an Ärem E-Mail-Programm virbereet.',
      f_err: 'Gitt w.e.g. Numm, eng gülteg E-Mail an Är Noriicht un.',
      f_ok: 'D’E-Mail fir {name} gëtt elo an Ärem E-Mail-Programm opgemaach.',
      mobile_call: 'Uruffen', mobile_email: 'E-Mail',
      footer_tagline: 'Är modern Autosgarage fir Wartung, Reparatur a Service – éierlech an zouverlässeg.',
      footer_partner: 'Partner vu 1·2·3 AutoService',
      footer_nav_h: 'Navigatioun', footer_contact_h: 'Kontakt',
      footer_rights: 'All Rechter reservéiert.', footer_impressum: 'Impressum', footer_datenschutz: 'Dateschutz'
    },
    de: {
      nav_services: 'Leistungen', nav_tuning: 'Tuning', nav_about: 'Über uns', nav_why: 'Warum wir',
      nav_hours: 'Öffnungszeiten', nav_cta: 'Termin anfragen',
      topbar_partner: 'Offizieller Partnerbetrieb',
      hero_eyebrow: 'Autowerkstatt · Bettendorf, Luxemburg',
      hero_title_1: 'Ihr Auto in', hero_title_2: 'besten Händen.',
      hero_lead: 'Von der Inspektion bis zum Tuning – Autoservice Bettenduerf steht für ehrliche Beratung, saubere Arbeit und faire Preise. Für alle Marken, mit modernster Diagnosetechnik.',
      hero_btn2: 'Unsere Leistungen',
      hero_b1_v: 'Persönlich', hero_b1_l: 'Ehrliche Beratung',
      hero_b2_v: 'Alle Marken', hero_b2_l: 'Freie Werkstatt',
      hero_b3_v: '1·2·3 AutoService', hero_b3_l: 'Partnernetzwerk',
      trust1: '1·2·3 AutoService Partnerbetrieb', trust2: 'Alle Marken & Modelle',
      trust3: 'Reifenservice & Einlagerung', trust4: 'Nur nach Terminvereinbarung',
      coop_eyebrow: 'Kooperation 1·2·3 AutoService', coop_title: 'Ihre Herstellergarantie bleibt erhalten',
      coop_text: 'Durch unsere Kooperation mit dem 1·2·3 AutoService-Netzwerk wird der Service-Eintrag nach den Garantievorgaben des Herstellers durchgeführt. So bleibt Ihre Herstellergarantie bei einer Wartung in unserer Garage vollständig erhalten.',
      services_eyebrow: 'Unsere Leistungen',
      services_title: 'Alles rund ums Auto – aus einer Hand',
      services_sub: 'Von der klassischen Wartung bis zur elektronischen Diagnose. Wir kümmern uns um Ihr Fahrzeug, damit Sie sicher unterwegs sind.',
      svc1_t: 'Wartung & Inspektion', svc1_d: 'Regelmäßige Inspektion nach Herstellervorgabe – für Werterhalt und Sicherheit Ihres Fahrzeugs.',
      svc2_t: 'Ölwechsel & Filter', svc2_d: 'Frisches Öl, neue Filter und ein prüfender Blick auf alle Flüssigkeiten – schnell und sauber erledigt.',
      svc3_t: 'Reifenservice', svc3_d: 'Reifenwechsel, Wuchten, Einlagerung und Beratung zu Sommer-, Winter- und Ganzjahresreifen.',
      svc4_t: 'Bremsen & Fahrwerk', svc4_d: 'Bremsbeläge, Scheiben, Stoßdämpfer und Achsvermessung – für optimalen Halt auf der Straße.',
      svc5_t: 'Fehlerdiagnose', svc5_d: 'Moderne Diagnosegeräte finden die Ursache von Warnleuchten und Elektronikproblemen zuverlässig.',
      svc6_t: 'Klimaservice', svc6_d: 'Klimaanlage prüfen, desinfizieren und befüllen – für kühlen Kopf im Sommer und klare Sicht.',
      svc7_t: 'Contrôle Technique', svc7_d: 'Wir bereiten Ihr Fahrzeug optimal auf die technische Kontrolle vor – und begleiten Sie zum Termin.',
      svc8_t: 'Batterie & Elektrik', svc8_d: 'Batterietest, Start-Stopp-Systeme, Beleuchtung und Bordelektronik – alles im Blick.',
      svc9_t: 'Tuning & Motorsport', svc9_d: 'Rallye- und Rennstreckenvorbereitung, Tieferlegung und Sportfahrwerke – abgestimmt auf Ihre Wünsche.',
      svc10_t: 'Karosserie & Lackierung', svc10_d: 'Karosseriearbeiten, Spoiler, Verbreiterungen und saubere Lackierung.',
      about_eyebrow: 'Über Autoservice Bettenduerf',
      about_title: 'Ein Familienbetrieb, dem Sie vertrauen können',
      about_p1: 'In Bettendorf sind wir die verlässliche Adresse, wenn es um das Wohl Ihres Fahrzeugs geht. Bei uns arbeiten erfahrene Mechaniker, die ihr Handwerk verstehen – und Ihnen ehrlich sagen, was wirklich nötig ist.',
      about_p2: 'Als Partner im 1·2·3 AutoService-Netzwerk verbinden wir persönliche Betreuung mit moderner Technik und Qualitätsteilen. Ob Kleinwagen, Familienauto oder Transporter – jedes Fahrzeug bekommt die gleiche Sorgfalt.',
      about_c1: 'Transparente Kostenvoranschläge – keine bösen Überraschungen',
      about_c2: 'Original- und Qualitätsersatzteile für alle Marken',
      about_c3: 'Persönliche Ansprechpartner, die sich Zeit nehmen',
      about_badge_t: '1·2·3 AutoService', about_badge_s: 'Partnerbetrieb im Netzwerk',
      why_eyebrow: 'Warum Autoservice Bettenduerf', why_title: 'Gute Gründe für Ihren Besuch',
      feat1_t: 'Ehrliche Beratung', feat1_d: 'Wir reparieren nur, was wirklich nötig ist – und erklären Ihnen jeden Schritt verständlich.',
      feat2_t: 'Faire Preise', feat2_d: 'Klare Kostenvoranschläge vor Beginn der Arbeit. Sie behalten immer den Überblick.',
      feat3_t: 'Alle Marken', feat3_d: 'Ob deutsche, französische oder asiatische Fahrzeuge – wir kennen uns aus.',
      feat4_t: 'Schneller Service', feat4_d: 'Kurze Wartezeiten und flexible Termine, damit Sie schnell wieder mobil sind.',
      hours_eyebrow: 'Öffnungszeiten', hours_title: 'Nur nach Termin',
      hours_sub: 'Unsere Werkstatt ist nicht regulär geöffnet – jede Arbeit läuft über einen Termin.',
      hours_appt_t: 'Nur mit Termin',
      hours_appt_d: 'Unsere Werkstatt ist nicht durchgehend geöffnet – wir arbeiten ausschließlich nach Terminvereinbarung, damit wir uns genügend Zeit für Ihr Fahrzeug nehmen. Rufen Sie an oder senden Sie uns eine Anfrage.',
      contact_eyebrow: 'Kontakt & Anfahrt', contact_title: 'Termin anfragen',
      contact_intro: 'Schreiben Sie uns kurz, worum es geht – wir melden uns schnellstmöglich mit einem Terminvorschlag zurück.',
      ci_addr_l: 'Adresse', ci_phone_l: 'Telefon', ci_gsm_l: 'Mobil', map_route: 'Route berechnen',
      f_name: 'Name', f_name_ph: 'Ihr Name', f_email_ph: 'ihre@email.lu',
      f_phone: 'Telefon', f_phone_ph: 'Optional',
      f_service: 'Anliegen', f_service_opt0: 'Bitte wählen …', f_other: 'Sonstiges',
      f_message: 'Nachricht', f_message_ph: 'Beschreiben Sie kurz Ihr Anliegen und Ihr Fahrzeug (Marke, Modell, Baujahr) …',
      f_submit: 'E-Mail vorbereiten', f_note: 'Ihre Anfrage wird in Ihrem E-Mail-Programm vorbereitet.',
      f_err: 'Bitte füllen Sie Name, eine gültige E-Mail und Ihre Nachricht aus.',
      f_ok: 'Die E-Mail für {name} wird jetzt in Ihrem E-Mail-Programm geöffnet.',
      mobile_call: 'Anrufen', mobile_email: 'E-Mail',
      footer_tagline: 'Ihre moderne Autowerkstatt für Wartung, Reparatur und Service – ehrlich und zuverlässig.',
      footer_partner: 'Partner von 1·2·3 AutoService',
      footer_nav_h: 'Navigation', footer_contact_h: 'Kontakt',
      footer_rights: 'Alle Rechte vorbehalten.', footer_impressum: 'Impressum', footer_datenschutz: 'Datenschutz'
    },
    fr: {
      nav_services: 'Prestations', nav_tuning: 'Tuning', nav_about: 'À propos', nav_why: 'Pourquoi nous',
      nav_hours: 'Horaires', nav_cta: 'Prendre rendez-vous',
      topbar_partner: 'Garage partenaire officiel',
      hero_eyebrow: 'Garage automobile · Bettendorf, Luxembourg',
      hero_title_1: 'Votre voiture entre', hero_title_2: 'de bonnes mains.',
      hero_lead: 'De l’entretien au tuning – Autoservice Bettenduerf, c’est un conseil honnête, un travail soigné et des prix justes. Pour toutes les marques, avec un diagnostic moderne.',
      hero_btn2: 'Nos prestations',
      hero_b1_v: 'Personnel', hero_b1_l: 'Conseil honnête',
      hero_b2_v: 'Toutes marques', hero_b2_l: 'Garage multimarque',
      hero_b3_v: '1·2·3 AutoService', hero_b3_l: 'Réseau partenaire',
      trust1: 'Garage partenaire 1·2·3 AutoService', trust2: 'Toutes marques et modèles',
      trust3: 'Service pneus & stockage', trust4: 'Sur rendez-vous',
      coop_eyebrow: 'Coopération 1·2·3 AutoService', coop_title: 'Votre garantie constructeur est préservée',
      coop_text: 'Grâce à notre coopération avec le réseau 1·2·3 AutoService, l’entrée d’entretien est effectuée selon les prescriptions de garantie du constructeur. Votre garantie constructeur reste ainsi intégralement préservée lors d’un entretien dans notre garage.',
      services_eyebrow: 'Nos prestations',
      services_title: 'Tout pour votre voiture – au même endroit',
      services_sub: 'De l’entretien classique au diagnostic électronique. Nous prenons soin de votre véhicule pour que vous rouliez en toute sécurité.',
      svc1_t: 'Entretien & inspection', svc1_d: 'Entretien régulier selon les préconisations du constructeur – pour la valeur et la sécurité de votre véhicule.',
      svc2_t: 'Vidange & filtres', svc2_d: 'Huile neuve, filtres neufs et contrôle de tous les niveaux – rapidement et proprement.',
      svc3_t: 'Service pneus', svc3_d: 'Montage, équilibrage, stockage et conseils sur pneus été, hiver et toutes saisons.',
      svc4_t: 'Freins & suspension', svc4_d: 'Plaquettes, disques, amortisseurs et géométrie – pour une tenue de route optimale.',
      svc5_t: 'Diagnostic électronique', svc5_d: 'Nos appareils de diagnostic identifient précisément l’origine des voyants et des pannes électroniques.',
      svc6_t: 'Service climatisation', svc6_d: 'Contrôle, désinfection et recharge de la climatisation – pour un habitacle frais et une bonne visibilité.',
      svc7_t: 'Contrôle technique', svc7_d: 'Nous préparons votre véhicule au contrôle technique – et vous accompagnons au rendez-vous.',
      svc8_t: 'Batterie & électricité', svc8_d: 'Test de batterie, systèmes start-stop, éclairage et électronique embarquée – tout est contrôlé.',
      svc9_t: 'Tuning & sport auto', svc9_d: 'Préparation rallye et circuit, rabaissement et châssis sport – selon vos souhaits.',
      svc10_t: 'Carrosserie & peinture', svc10_d: 'Travaux de carrosserie, ailerons, élargisseurs et peinture soignée.',
      about_eyebrow: 'À propos d’Autoservice Bettenduerf',
      about_title: 'Une entreprise familiale de confiance',
      about_p1: 'À Bettendorf, nous sommes l’adresse de confiance pour le bien-être de votre véhicule. Des mécaniciens expérimentés qui maîtrisent leur métier – et vous disent honnêtement ce qui est vraiment nécessaire.',
      about_p2: 'Partenaire du réseau 1·2·3 AutoService, nous allions service personnalisé, technologie moderne et pièces de qualité. Citadine, familiale ou utilitaire – chaque véhicule reçoit le même soin.',
      about_c1: 'Devis transparents – aucune mauvaise surprise',
      about_c2: 'Pièces d’origine et de qualité pour toutes les marques',
      about_c3: 'Des interlocuteurs à l’écoute, qui prennent le temps',
      about_badge_t: '1·2·3 AutoService', about_badge_s: 'Garage du réseau',
      why_eyebrow: 'Pourquoi Autoservice Bettenduerf', why_title: 'De bonnes raisons de nous rendre visite',
      feat1_t: 'Conseil honnête', feat1_d: 'Nous ne réparons que le nécessaire – et vous expliquons chaque étape clairement.',
      feat2_t: 'Prix justes', feat2_d: 'Des devis clairs avant chaque intervention. Vous gardez la maîtrise.',
      feat3_t: 'Toutes marques', feat3_d: 'Véhicules allemands, français ou asiatiques – nous maîtrisons.',
      feat4_t: 'Service rapide', feat4_d: 'Des délais courts et des rendez-vous flexibles, pour retrouver votre mobilité au plus vite.',
      hours_eyebrow: 'Horaires', hours_title: 'Uniquement sur rendez-vous',
      hours_sub: 'Notre atelier n’est pas ouvert en continu – chaque intervention se fait sur rendez-vous.',
      hours_appt_t: 'Uniquement sur rendez-vous',
      hours_appt_d: 'Notre atelier n’est pas ouvert en continu – nous travaillons exclusivement sur rendez-vous, afin de consacrer le temps nécessaire à votre véhicule. Appelez-nous ou envoyez-nous une demande.',
      contact_eyebrow: 'Contact & accès', contact_title: 'Prendre rendez-vous',
      contact_intro: 'Dites-nous en quelques mots de quoi il s’agit – nous revenons vers vous rapidement avec une proposition de rendez-vous.',
      ci_addr_l: 'Adresse', ci_phone_l: 'Téléphone', ci_gsm_l: 'Mobile', map_route: 'Itinéraire',
      f_name: 'Nom', f_name_ph: 'Votre nom', f_email_ph: 'votre@email.lu',
      f_phone: 'Téléphone', f_phone_ph: 'Facultatif',
      f_service: 'Votre demande', f_service_opt0: 'Veuillez choisir …', f_other: 'Autre',
      f_message: 'Message', f_message_ph: 'Décrivez brièvement votre demande et votre véhicule (marque, modèle, année) …',
      f_submit: 'Préparer l’e-mail', f_note: 'Votre demande sera préparée dans votre logiciel de messagerie.',
      f_err: 'Merci d’indiquer votre nom, un e-mail valide et votre message.',
      f_ok: 'L’e-mail pour {name} va maintenant s’ouvrir dans votre logiciel de messagerie.',
      mobile_call: 'Appeler', mobile_email: 'E-mail',
      footer_tagline: 'Votre garage automobile moderne pour l’entretien, la réparation et le service – honnête et fiable.',
      footer_partner: 'Partenaire 1·2·3 AutoService',
      footer_nav_h: 'Navigation', footer_contact_h: 'Contact',
      footer_rights: 'Tous droits réservés.', footer_impressum: 'Mentions légales', footer_datenschutz: 'Confidentialité'
    },
    en: {
      nav_services: 'Services', nav_tuning: 'Tuning', nav_about: 'About us', nav_why: 'Why us',
      nav_hours: 'Hours', nav_cta: 'Book appointment',
      topbar_partner: 'Official partner garage',
      hero_eyebrow: 'Car garage · Bettendorf, Luxembourg',
      hero_title_1: 'Your car in', hero_title_2: 'the best hands.',
      hero_lead: 'From inspection to tuning – Autoservice Bettenduerf stands for honest advice, clean work and fair prices. For all makes, with modern diagnostic technology.',
      hero_btn2: 'Our services',
      hero_b1_v: 'Personal', hero_b1_l: 'Honest advice',
      hero_b2_v: 'All makes', hero_b2_l: 'Multi-brand garage',
      hero_b3_v: '1·2·3 AutoService', hero_b3_l: 'Partner network',
      trust1: '1·2·3 AutoService partner garage', trust2: 'All makes & models',
      trust3: 'Tyre service & storage', trust4: 'By appointment',
      coop_eyebrow: '1·2·3 AutoService cooperation', coop_title: 'Your manufacturer’s warranty stays intact',
      coop_text: 'Through our cooperation with the 1·2·3 AutoService network, the service entry is carried out according to the manufacturer’s warranty specifications. This means your manufacturer’s warranty remains fully intact when you have your car serviced with us.',
      services_eyebrow: 'Our services',
      services_title: 'Everything for your car – from one place',
      services_sub: 'From classic maintenance to electronic diagnostics. We take care of your vehicle so you stay safe on the road.',
      svc1_t: 'Maintenance & inspection', svc1_d: 'Regular servicing to manufacturer specifications – for the value and safety of your vehicle.',
      svc2_t: 'Oil & filter change', svc2_d: 'Fresh oil, new filters and a check of all fluids – done quickly and cleanly.',
      svc3_t: 'Tyre service', svc3_d: 'Tyre change, balancing, storage and advice on summer, winter and all-season tyres.',
      svc4_t: 'Brakes & suspension', svc4_d: 'Brake pads, discs, shock absorbers and wheel alignment – for optimum grip on the road.',
      svc5_t: 'Fault diagnostics', svc5_d: 'Modern diagnostic tools reliably find the cause of warning lights and electronic issues.',
      svc6_t: 'Air-con service', svc6_d: 'Check, disinfect and refill your air conditioning – for a cool head in summer and clear vision.',
      svc7_t: 'Roadworthiness prep', svc7_d: 'We prepare your vehicle optimally for the Contrôle Technique – and accompany you to the appointment.',
      svc8_t: 'Battery & electrics', svc8_d: 'Battery test, start-stop systems, lighting and on-board electronics – all covered.',
      svc9_t: 'Tuning & motorsport', svc9_d: 'Rally and race-track preparation, lowering and sport suspension – tailored to your wishes.',
      svc10_t: 'Bodywork & paint', svc10_d: 'Bodywork, spoilers, widenings and clean paintwork.',
      about_eyebrow: 'About Autoservice Bettenduerf',
      about_title: 'A family business you can trust',
      about_p1: 'In Bettendorf we are the reliable address when it comes to the wellbeing of your vehicle. Experienced mechanics who know their craft – and tell you honestly what really needs doing.',
      about_p2: 'As a partner in the 1·2·3 AutoService network we combine personal service with modern technology and quality parts. Whether small car, family car or van – every vehicle gets the same care.',
      about_c1: 'Transparent estimates – no nasty surprises',
      about_c2: 'Original and quality spare parts for all makes',
      about_c3: 'Personal contacts who take time for you',
      about_badge_t: '1·2·3 AutoService', about_badge_s: 'Partner in the network',
      why_eyebrow: 'Why Autoservice Bettenduerf', why_title: 'Good reasons to visit',
      feat1_t: 'Honest advice', feat1_d: 'We only repair what is really necessary – and explain every step clearly.',
      feat2_t: 'Fair prices', feat2_d: 'Clear estimates before we start. You always keep the overview.',
      feat3_t: 'All makes', feat3_d: 'German, French or Asian vehicles – we know our way around.',
      feat4_t: 'Fast service', feat4_d: 'Short waiting times and flexible appointments, so you’re mobile again quickly.',
      hours_eyebrow: 'Opening hours', hours_title: 'By appointment only',
      hours_sub: 'Our workshop isn’t open on a walk-in basis – every job runs via appointment.',
      hours_appt_t: 'By appointment only',
      hours_appt_d: 'Our workshop is not open on a walk-in basis – we work strictly by appointment, so we can dedicate enough time to your vehicle. Call us or send us a request.',
      contact_eyebrow: 'Contact & directions', contact_title: 'Request an appointment',
      contact_intro: 'Tell us briefly what it’s about – we’ll get back to you quickly with a suitable appointment.',
      ci_addr_l: 'Address', ci_phone_l: 'Phone', ci_gsm_l: 'Mobile', map_route: 'Get directions',
      f_name: 'Name', f_name_ph: 'Your name', f_email_ph: 'your@email.lu',
      f_phone: 'Phone', f_phone_ph: 'Optional',
      f_service: 'Your request', f_service_opt0: 'Please choose …', f_other: 'Other',
      f_message: 'Message', f_message_ph: 'Briefly describe your request and your vehicle (make, model, year) …',
      f_submit: 'Prepare email', f_note: 'Your request will be prepared in your email application.',
      f_err: 'Please fill in your name, a valid email and your message.',
      f_ok: 'The email for {name} will now open in your email application.',
      mobile_call: 'Call', mobile_email: 'Email',
      footer_tagline: 'Your modern car garage for maintenance, repair and service – honest and reliable.',
      footer_partner: 'Partner of 1·2·3 AutoService',
      footer_nav_h: 'Navigation', footer_contact_h: 'Contact',
      footer_rights: 'All rights reserved.', footer_impressum: 'Legal notice', footer_datenschutz: 'Privacy'
    }
  };

  var LANGS = ['lb', 'de', 'fr', 'en'];
  var DEFAULT_LANG = 'lb';
  var currentLang = DEFAULT_LANG;

  function getStoredLang() {
    try {
      var s = localStorage.getItem('gk_lang');
      if (s && LANGS.indexOf(s) !== -1) return s;
    } catch (e) {}
    return DEFAULT_LANG;
  }

  function applyLang(lang) {
    if (LANGS.indexOf(lang) === -1) lang = DEFAULT_LANG;
    currentLang = lang;
    var dict = I18N[lang];

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (dict[key] != null) el.textContent = dict[key];
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-ph');
      if (dict[key] != null) el.setAttribute('placeholder', dict[key]);
    });

    document.documentElement.lang = lang;

    document.querySelectorAll('.lang-switch button').forEach(function (btn) {
      var on = btn.getAttribute('data-lang') === lang;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    try { localStorage.setItem('gk_lang', lang); } catch (e) {}
  }

  document.querySelectorAll('.lang-switch button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyLang(btn.getAttribute('data-lang'));
    });
  });

  applyLang(getStoredLang());

  /* ============================================================
     Mobile-Navigatioun
     ============================================================ */
  var toggle = document.getElementById('nav-toggle');
  var nav = document.getElementById('main-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* Offiziellt 1·2·3 AutoService-Logo: Text-Ersatz, falls d'Datei nach feelt */
  document.querySelectorAll('.logo-official').forEach(function (img) {
    function fail() {
      var wrap = img.closest('.logo123');
      if (wrap) wrap.classList.add('missing');
    }
    img.addEventListener('error', fail);
    if (img.complete && img.naturalWidth === 0) fail();
  });

  /* Joer am Footer */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* Back-to-top */
  var backBtn = document.getElementById('back-to-top');
  if (backBtn) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 500) backBtn.classList.add('show');
      else backBtn.classList.remove('show');
    }, { passive: true });
  }

  /* Reveal beim Scrollen */
  var revealTargets = document.querySelectorAll('.card, .feature, .about-content, .about-media, .section-head, .hours-content, .hours-table, .contact-info, .contact-form');
  revealTargets.forEach(function (el) { el.classList.add('reveal'); });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealTargets.forEach(function (el) { io.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add('visible'); });
  }

  /* Kontaktformular */
  var form = document.getElementById('contact-form');
  var status = document.getElementById('form-status');

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var dict = I18N[currentLang];
      status.className = 'form-status';
      status.textContent = '';

      var name = form.name.value.trim();
      var email = form.email.value.trim();
      var message = form.message.value.trim();
      var emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      if (!name || !emailValid || !message) {
        status.classList.add('err');
        status.textContent = dict.f_err;
        return;
      }

      var phone = form.phone.value.trim();
      var service = form.service.value;
      var subject = 'Rendez-vous / Terminanfrage – ' + name;
      var body = [
        'Numm / Name: ' + name,
        'E-Mail: ' + email,
        'Telefon: ' + (phone || '—'),
        'Service: ' + (service || '—'),
        '',
        message
      ].join('\n');

      status.classList.add('ok');
      status.textContent = dict.f_ok.replace('{name}', name);
      window.location.href = 'mailto:Autoservicebettenduerf@outlook.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    });
  }
})();
