# Mollie-Bezuel-Worker — Deploy-Uleedung

Dëse Cloudflare Worker ass dat klengt „Backend", dat d'Mollie-Bezuelung fir de
Shop ausléist. D'Websäit selwer (GitHub Pages) kann dat net maachen, well se
statesch ass an de Betrag serverseiteg berechent muss ginn.

> **Wichteg:** Solaang dëse Worker net deployé ass an de Shop-Katalog keng
> reell Präisser huet, funktionéiert d'Bezuelung **net**. D'Plombière ass
> agebaut, mä et feelen nach: (1) e Mollie-Kont, (2) dësen deployéierte Worker,
> (3) reell Präisser am Katalog.

## 1. Mollie-Kont
1. Op <https://www.mollie.com> e Business-Kont opmaachen (KYC/Verifikatioun).
2. Am Dashboard d'Bezuelmethoden aktivéieren, déi Der wëllt: **Kaart
   (Visa/Mastercard)**, **Wero**, **Bancontact/Revolut**, **SEPA-Iwwerweisung**.
3. Den **API-Schlëssel** kopéieren (`test_…` fir Tester, `live_…` fir Produktioun).

## 2. Worker deployen (Cloudflare)
Mat der [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/):

```bash
npm install -g wrangler
wrangler login
# dëse Repo-Dossier "worker/" als Projet:
wrangler deploy worker/mollie-payment.js --name mollie-pay
```

Dann de Mollie-Schlëssel als **Secret** setzen (ni am Code!):

```bash
wrangler secret put MOLLIE_API_KEY
# Ëffnung: fügt Ären test_… oder live_… Schlëssel an
```

## 3. URL verbannen
De Worker kritt eng URL, z.B. `https://mollie-pay.<account>.workers.dev`.
Fir datt d'CSP passt, sollt Der en op **`https://mollie-pay.autoservicebettenduerf.lu`**
routen (Cloudflare → Workers Routes / Custom Domain). Dat ass déi Adress, déi
schonn a folgende Plaze steet:

- `shop.js` → Variabel `PAYMENT_ENDPOINT`
- `shop.html` → CSP `connect-src`

Wann Der eng aner URL benotzt, béid Plaze uganss upassen.

## 4. Präisser androen
Zwou Plaze musse **déiselwecht** Präisser kréien:

1. **`shop.js`** — d'Produkter am Katalog (`price` pro Artikel, z.B. `"89,00"`).
   Aktuell ass `product.price = null` fir all Artikel → dofir ass de
   „An de Kuerf"-Knäppchen deaktivéiert.
2. **`worker/mollie-payment.js`** — d'`PRICES`-Lëscht (Artikelnummer → Cent).
   Dëst ass d'Autoritéit fir de Betrag; feelt en Artikel hei, gëtt en refuséiert.

## 5. Testen
Mat engem `test_…`-Schlëssel eng Bestellung duerchspillen — Mollie huet en
Test-Modus, deen keng echt Suen bewegt.

## Sécherheet
- De Betrag gëtt **ni** aus dem Browser vertraut, ëmmer serverseiteg gerechent.
- Kaartendaten lafen nëmmen op der Mollie-Hosted-Säit (PCI-konform).
- De Mollie-Schlëssel bleift e Cloudflare-Secret.
