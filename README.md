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
- **Kontakt** – Anfrageformular + echte Kontaktdaten
- **Footer** mit Partnerhinweis

## Kontaktdaten

- **Adresse:** 63, rue de Diekirch-Echternach, L-9355 Bettendorf, Luxemburg
- **Telefon / GSM:** +352 621 435 495
- **E-Mail:** Autoservicebettenduerf@outlook.com
- **Termine:** nur nach Vereinbarung (keine regulären Öffnungszeiten)

## 1·2·3 AutoService Logo — bitte einfügen

Das offizielle Logo wird über eine Bilddatei geladen:

```
assets/123autoservice-logo.svg   (oder .png – dann Pfad in index.html anpassen)
```

Solange die Datei fehlt, zeigt die Seite automatisch eine dezente
Text-Ersatzdarstellung. **Es wird kein Logo erfunden.** Bitte die offizielle
Logo-Datei von 1·2·3 AutoService in den Ordner `assets/` legen – dann erscheint
sie automatisch in Top-Bar, Kooperations-Bereich und Footer.

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
