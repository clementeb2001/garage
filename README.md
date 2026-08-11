# Garage Kremer Bettendorf — Website

Moderne, responsive Website für die **Garage Kremer** in Bettendorf (Luxemburg).
Statische Single-Page-Website ohne Build-Schritt oder Abhängigkeiten.

## Inhalt

- **Hero** — Einstieg mit klarer Botschaft und Call-to-Action
- **Kennzahlen** — animierte Zähler (Erfahrung, gewartete Fahrzeuge …)
- **Leistungen** — Wartung, Ölwechsel, Reifenservice, Bremsen, Diagnose, Klima, Contrôle Technique, Elektrik
- **Über uns** — Vorstellung des Familienbetriebs
- **Warum wir** — Verkaufsargumente
- **Öffnungszeiten**
- **Kontakt** — Anfrageformular (clientseitige Validierung) + Anfahrt
- **Footer** mit Navigation und Kontaktdaten

## Technik

- Reines HTML, CSS und Vanilla JavaScript — keine Frameworks, kein Build
- Responsive (Desktop, Tablet, Mobil) inkl. mobilem Menü
- Scroll-Animationen, Zähler-Animation, „Nach oben"-Button
- Barrierearm: semantisches HTML, ARIA-Labels, `prefers-reduced-motion`

## Lokal ansehen

Einfach `index.html` im Browser öffnen, oder ein kleiner lokaler Server:

```bash
python3 -m http.server 8000
# danach: http://localhost:8000
```

## Anpassen

Die wichtigsten Platzhalter (bitte durch echte Daten ersetzen):

- **Telefonnummer** — `+352 00 00 00` (in `index.html`)
- **E-Mail** — `info@garage-kremer.lu`
- **Adresse** — vollständige Straße/Hausnummer in Bettendorf
- **Kennzahlen** — Werte in der Trust-Bar (`data-count`)
- **Kartenausschnitt** — bei Bedarf durch eine echte Karteneinbindung ersetzen
- **Formular** — für den Live-Betrieb an ein Backend / einen E-Mail-Dienst anbinden

Farben und Typografie lassen sich zentral über die CSS-Variablen in
`styles.css` (`:root`) anpassen.
