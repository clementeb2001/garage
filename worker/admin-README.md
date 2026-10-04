# Interne Verwaltung — Deploy-Uleedung (Worker + D1)

Dëse Worker ass dat Backend fir d'**Interne Verwaltung** (`/intern/`):
Login, Reservatiounen bestätegen/ofleenen a Member-Verwaltung. D'Donnéeë
leien an enger Cloudflare-D1-Datebank.

> **Schonn erleedegt (vun Claude):**
> - D1-Datebank **`garage-admin`** ugeluecht (id `14fccce6-50bf-4dd7-9d76-e8576c47ce2a`).
> - Schema (Tabellen `users`, `bookings`, `booking_events`, `member_events`) ugeluecht.
> - Admin-Kont ugeluecht: Benotzernumm **`clement`** (Passwuert kritt der separat — beim 1. Login änneren).
> - 2 Beispill-Reservatiounen fir den Test.

## Fir et live ze maachen — 3 Kommandoen

```bash
# 1. Worker deployen (am Repo-Root)
wrangler deploy -c worker/admin-wrangler.toml

# 2. De Sessioun-Schlëssel als Secret setzen (eemoleg, e laangt Zoufallswuert)
wrangler secret put SESSION_SECRET -c worker/admin-wrangler.toml
#    -> fügt z. B. de Resultat vun `openssl rand -base64 32` an

# 3. (Cloudflare Dashboard) de Worker op d'Custom-Domain routen:
#    garage-admin.autoservicebettenduerf.lu
#    (Workers & Pages -> garage-admin -> Settings -> Domains & Routes)
```

Dono ass `/intern/` automatesch **live** (soss leeft et am Testmodus).

## Sécherheet
- Passwierder ginn **PBKDF2-SHA256 gehasht** gespäichert — ni am Klartext.
- D'Sessioun ass e **signéierten Bearer-Token** (HMAC, 8 h gëlteg).
- All Ufro gëtt **server-säiteg** nogekuckt (Rechter: viewer < validator < admin).
- `SESSION_SECRET` bleift e Cloudflare-Secret.

## API (kuerz Iwwersiicht)
| Method | Pfad | Roll | Zweck |
|---|---|---|---|
| POST | `/auth/login` | — | Aloggen → Token |
| GET  | `/auth/me` | agelount | Aktuelle Benotzer |
| POST | `/auth/password` | agelount | Eegent Passwuert änneren |
| GET  | `/bookings` | viewer+ | Reservatioune lëschten |
| POST | `/bookings/:id/status` | validator+ | Status änneren (+Audit) |
| POST | `/bookings` | public | Neng Ufro (vum Location-Formulaire) |
| GET/POST/DELETE | `/members[...]` | admin | Member-Verwaltung |

## Custom-Domain änneren?
Wann der eng aner URL benotzt wéi `garage-admin.autoservicebettenduerf.lu`,
musst der se op 2 Plazen upassen:
- `intern/intern.js` → Konstant `API_BASE`
- `intern/index.html` an `location.html` → CSP `connect-src`
