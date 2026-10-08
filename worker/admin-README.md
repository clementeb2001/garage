# Interne Verwaltung — Deploy-Uleedung (Worker + D1)

Dëse Worker ass dat Backend fir d'**Interne Verwaltung** (`/intern/`):
Login, Reservatiounen bestätegen/ofleenen a Member-Verwaltung. D'Donnéeë
leien an enger Cloudflare-D1-Datebank.

## Shop-Katalog an D1

De selwechten D1-Worker liwwert de Shop-Katalog iwwer `/catalog/meta` an
`/catalog/products`. De Workflow **Import changed shop catalog** leeft separat
vum Worker-Deploy a kontrolléiert als éischt, ob d'Versioun scho komplett
besteet. Onverännert Kataloge ginn net nei geschriwwen. Nei Versioune ginn
nëmmen no enger Vollstännegkeetskontroll aktivéiert; al Versioune bleiwen
fir e Rollback erhalen. `catalog_products.price_cents` bleift déi verbindlech
Präisquell fir Shop a Bezuel-Worker.

Detailer zu D1-Schreiflimiten, Schema-Preparatioun an Tester:
[D1-OPERATIONS.md](D1-OPERATIONS.md).

> **Schonn erleedegt (vun Claude):**
> - D1-Datebank **`garage-admin`** ugeluecht (id `14fccce6-50bf-4dd7-9d76-e8576c47ce2a`).
> - Schema (Tabellen `users`, `bookings`, `booking_events`, `member_events`) ugeluecht.
> - Admin-Kont ugeluecht: Benotzernumm **`clement`** (Passwuert kritt der separat — beim 1. Login änneren).
> - 2 Beispill-Reservatiounen fir den Test.

## Fir et live ze maachen

```bash
# 1. Nëmme feelend Schema-Definitioune preparéieren (keng Seed-Donnéeën)
npm install --no-save --package-lock=false wrangler@4.149.0
node tools/prepare_admin_schema.js

# 2. Worker deployen (native Rate-Limit-Bindings stinn am TOML)
node node_modules/wrangler/bin/wrangler.js deploy -c worker/admin-wrangler.toml

# 2. (Cloudflare Dashboard) de Worker op d'Custom-Domain routen:
#    garage-admin.autoservicebettenduerf.lu
#    (Workers & Pages -> garage-admin -> Settings -> Domains & Routes)
```

Dono ass `/intern/` automatesch **live**. Et gëtt bewosst keen onsécheren Testmodus.

## Sécherheet
- Passwierder ginn **PBKDF2-SHA256 gehasht** gespäichert — ni am Klartext.
- D'Sessioun ass en zoufällegen, server-säiteg widderruffbare Schlëssel an engem **HttpOnly, Secure, SameSite=Strict Cookie** (8 h gëlteg).
- All Ufro gëtt **server-säiteg** nogekuckt (Rechter: viewer < validator < admin).
- Passwierder benotze PBKDF2-SHA256 mat 600.000 Iteratiounen; al Hashes ginn nom Login automatesch aktualiséiert.

## API (kuerz Iwwersiicht)
| Method | Pfad | Roll | Zweck |
|---|---|---|---|
| POST | `/auth/login` | — | Aloggen → séchere Sessiouns-Cookie |
| GET  | `/auth/me` | agelount | Aktuelle Benotzer |
| POST | `/auth/logout` | agelount | Sessioun widderruffen |
| POST | `/auth/password` | agelount | Eegent Passwuert änneren |
| GET  | `/bookings` | viewer+ | Reservatioune lëschten |
| POST | `/bookings/:id/status` | validator+ | Status änneren (+Audit) |
| POST | `/bookings` | public | Neng Ufro (vum Location-Formulaire) |
| GET/POST/DELETE | `/members[...]` | admin | Member-Verwaltung |

## Automatescht Deployen (recommandéiert — da muss een ni méi manuell pechen)
Et gëtt eng GitHub-Action (`.github/workflows/deploy-worker.yml`), déi de
Worker automatesch nei deployéiert soubal am `worker/` eppes geännert gëtt.
Eemoleg opzesetzen:

1. **Cloudflare API-Token uleeën**: dash.cloudflare.com → Profil (uewe riets)
   → **My Profile** → **API Tokens** → **Create Token** → Template
   **„Edit Cloudflare Workers"** → derbäi d'Permissioun **Account › D1 › Edit**
   → Token erstellen a kopéieren.
2. **Als GitHub-Secret setzen**: op github.com am Repo
   `clementeb2001/garage` → **Settings** → **Secrets and variables** →
   **Actions** → **New repository secret**:
   - Numm `CLOUDFLARE_API_TOKEN`, Wäert = de Token.
   - (Optional) Numm `CLOUDFLARE_ACCOUNT_ID`, Wäert = deng Account-ID
     (steet am Cloudflare-Dashboard riets).
3. Fäerdeg. Vun elo un deployéiert all Ännerung um Worker sech vun eleng.
   Fir et direkt eng Kéier auszeléisen: Repo → **Actions** → „Deploy admin
   worker" → **Run workflow**.

> D'Websäit selwer (`/intern/`, Shop, asw.) geet souwisou automatesch live
> iwwer GitHub Pages. Mat dëser Action ass elo och de Worker automatesch.

## Bestätegungs-E-Mail un de Client (Resend)
Beim **Bestätegen** vun enger Reservatioun schéckt de Worker optional eng
Bestätegungs-E-Mail un de Client (a senger Sprooch). Dat leeft iwwer
**Resend** (gratis bis 3.000 Mails/Mount) — eemoleg opzesetzen:

1. Op <https://resend.com> e gratis Kont uleeën.
2. **Domain verifizéieren**: Resend → *Domains* → `autoservicebettenduerf.lu`
   dobäisetzen → déi ugewisen DNS-Anträg (SPF/DKIM) bei Cloudflare
   hannerleeën (DNS-Astellungen vun der Domain). No e puer Minutten „verified".
3. **API-Key** erstellen (Resend → *API Keys*) a kopéieren.
4. Als Worker-Secret setzen:
   - Dashboard → Worker `garage-admin` → *Settings* → *Variables and Secrets*
     → *Add* → **Secret** → Numm `RESEND_API_KEY`, Wäert = de Key.
   - (Optional) eng Variabel `MAIL_FROM`, z. B.
     `Autoservice Bettenduerf <noreply@autoservicebettenduerf.lu>`
     (muss op der verifizéierter Domain leien).

De Worker schéckt dräi Mailen (all mat HTML **an** Text-Deel, a jeeweils an
der Sprooch vum Client — lb/de/fr/en):
- **Nei Ufro** → un d'Garage (`MAIL_TO`, soss `Autoservicebettenduerf@outlook.com`).
- **Bestätegung** → un de Client, wann eng Reservatioun bestätegt gëtt.
- **Ofso** („et deet eis leed") → un de Client, wann eng Reservatioun ofgeleent gëtt.

> Solaang `RESEND_API_KEY` net gesat ass, gëtt **keng** Mail geschéckt — alles
> anescht funktionéiert normal weider. All Mail-Versuch gëtt an der
> Reservatiouns-Historie agedroen („… geschéckt" / „… feelgeschloen").

### Fir d'Mailen net am Spam ze landen (Deliverability)
Resend setzt beim Verifizéieren schonn **SPF** a **DKIM**. Fir datt
Outlook/Hotmail d'Mailen sécher an d'Postfach leet, nach e **DMARC**-Antrag
bei Cloudflare (DNS) derbäisetzen:

| Typ | Numm | Wäert |
|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:Autoservicebettenduerf@outlook.com` |

(`p=none` = just iwwerwaachen, blockéiert näischt.) Zousätzlech hëlleft e
plausibele Ofsender-Numm (schonn esou) an datt all Mail en Text-Deel huet
(schonn esou).

## Custom-Domain änneren?
Wann der eng aner URL benotzt wéi `garage-admin.autoservicebettenduerf.lu`,
musst der se op 2 Plazen upassen:
- `intern/intern.js` → Konstant `API_BASE`
- `intern/index.html` an `location.html` → CSP `connect-src`

## Gefierfotoen (R2)

D'PWA kann Fotoen direkt mat der Handykamera maachen oder aus der Galerie
auswielen. De Browser verklengert se op maximal 1600 Pixel a späichert se als
WebP. De Worker kontrolléiert Format a Gréisst a späichert d'Bild am private
R2-Bucket; ëffentlech gelies gëtt et nëmmen iwwer `/media/...`.

Eemoleg néideg:

1. Cloudflare → **R2 Object Storage** → **Create bucket**.
2. Bucket-Numm genee: **`garage-media`**.
3. De bestehende GitHub-Token brauch zousätzlech **Account › Workers R2 Storage › Edit**.

D'Binding `MEDIA` ass schonn an `worker/admin-wrangler.toml` definéiert an
gëtt beim nächsten Worker-Deploy automatesch verbonnen.

