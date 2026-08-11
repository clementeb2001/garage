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

- **Hero**, Trust-Leiste, **1·2·3 AutoService Partner-Banner**
- **Leistungen** – Wartung, Ölwechsel, Reifenservice, Bremsen, Diagnose, Klima, Contrôle Technique, Elektrik
- **Über uns**, **Warum wir**, **Öffnungszeiten**
- **Kontakt** – Anfrageformular + echte Kontaktdaten
- **Footer** mit Partnerhinweis

## Kontaktdaten (aus öffentlichen Verzeichnissen)

- **Adresse:** 63, rue de Diekirch-Echternach, L-9355 Bettendorf, Luxemburg
- **Telefon:** +352 80 86 87
- **E-Mail:** kremerlocation@gmail.com  *(bitte bestätigen)*

> Öffnungszeiten und E-Mail bitte vor Veröffentlichung noch einmal mit der
> Garage abgleichen. Termine erfolgen bevorzugt nach Vereinbarung.

## 1·2·3 AutoService Logo

Das im Partner-Banner und im Footer gezeigte Logo ist ein **Platzhalter-Wortbild**
(SVG). Bitte durch die offizielle Logo-Datei von 1·2·3 AutoService ersetzen
(z. B. `assets/123autoservice.svg`) – die entsprechenden `<span class="logo123">`-
Blöcke in `index.html` einfach austauschen.

## Technik

- Reines HTML, CSS und Vanilla JavaScript – keine Frameworks, kein Build
- Responsive inkl. mobilem Menü; Sprachumschalter
- Scroll-Animationen, „Nach oben"-Button
- Barrierearm: semantisches HTML, ARIA-Labels, `prefers-reduced-motion`

## Lokal ansehen

```bash
python3 -m http.server 8000
# danach: http://localhost:8000
```

Farben und Typografie zentral über die CSS-Variablen in `styles.css` (`:root`).
