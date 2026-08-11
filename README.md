# Garage Kremer Bettenduerf — Website

Moderne, responsive Website für die **Garage Kremer Bettenduerf** (Bettendorf,
Luxemburg) – Partnerbetrieb im **1·2·3 AutoService**-Netzwerk.
Statische Single-Page-Website ohne Build-Schritt oder Abhängigkeiten.

## Mehrsprachig

Sprachumschalter im Header. Vier Sprachen:

- **Lëtzebuergesch (LB)** – Standardsprache
- **Deutsch (DE)**
- **Français (FR)**
- **English (EN)**

Die Sprachwahl wird im Browser gespeichert (`localStorage`). Alle Texte liegen
im `I18N`-Objekt in `script.js`.

## Inhalt

- **Top-Bar** mit 1·2·3 AutoService Partnerhinweis + Kontakt
- **Hero**, Trust-Leiste
- **Leistungen** – Wartung, Ölwechsel, Reifenservice, Bremsen, Diagnose, Klima, Contrôle Technique, Elektrik
- **Tuning & Motorsport** – Rallye/Rennstrecke, Tieferlegung, Karosserie
- **Über uns**, **Warum wir**
- **Kooperation & Garantie** – Herstellergarantie bleibt erhalten
- **Öffnungszeiten** – nur nach Terminvereinbarung
- **Kontakt** – Anfrageformular mit Übergabe an das E-Mail-Programm + echte Kontaktdaten
- **Footer** mit Partnerhinweis, Impressum und Datenschutzerklärung

## Kontaktdaten

- **Adresse:** 63, rue de Diekirch-Echternach, L-9355 Bettendorf, Luxemburg
- **Telefon (Festnetz):** +352 80 86 87  ← Hauptnummer
- **GSM / Mobil (Zusatz):** +352 621 435 495
- **E-Mail:** Autoservicebettenduerf@outlook.com
- **Termine:** nur nach Vereinbarung (keine regulären Öffnungszeiten)

## Standortkarte

Der Kontaktbereich enthält eine lokale Kartengrafik sowie einen
**„Route berechnen"-Button**, der Google Maps erst nach einem bewussten Klick
öffnet. Dadurch werden beim bloßen Seitenaufruf keine Kartendaten von Google
nachgeladen.

## 1·2·3 AutoService Logo

Das Logo ist als **Inline-SVG** direkt in `index.html` umgesetzt (Top-Bar,
Kooperations-Bereich, Footer) – nach Vorlage des offiziellen Logos
(blauer Rahmen, „1,2,3 AutoService" in Blau, orange „///", ®). Es lädt ohne
externe Datei und skaliert verlustfrei.

> Möchtest du stattdessen die **exakte Original-Grafik** (Rasterbild) verwenden,
> lege sie als `assets/123autoservice-logo.png` ins Repo – dann kann der
> Inline-SVG-Block gegen ein `<img>` getauscht werden.

## Technik

- Reines HTML, CSS und Vanilla JavaScript – keine Frameworks, kein Build
- Responsive inkl. mobilem Menü; Sprachumschalter
- Mobile Schnellkontakte für Telefon und E-Mail
- Strukturierte lokale Unternehmensdaten (JSON-LD)
- Scroll-Animationen, „Nach oben"-Button
- Barrierearm: semantisches HTML, ARIA-Labels, `prefers-reduced-motion`

## Lokal ansehen

```bash
python3 -m http.server 8000
# danach: http://localhost:8000
```

Farben und Typografie zentral über die CSS-Variablen in `styles.css` (`:root`).
