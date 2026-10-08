# D1-Schreibzugriffe begrenzen

## Deployment und Katalogimport

`Deploy admin worker` bereitet fehlende Admin-Tabellen, Spalten und Indizes vor
und deployt den Worker. Er importiert keine Produkte. Der Schema-Planer prüft
den tatsächlichen Bestand lesend und erzeugt ausschließlich fehlende
Definitionen. Er benötigt die bereits vorhandene Basis-Tabelle `bookings`.
Er legt keine Benutzer oder Fahrzeuge an, ändert keine Mietbedingungen und
führt keinen historischen Snapshot-Backfill aus. Auf einer bereits aktuellen
Datenbank sind keine Schema-Schreibvorgänge nötig.

`Import changed shop catalog` reagiert auf Katalogdaten, den Importgenerator,
den Importprüfer und das Katalogschema. Ein manueller Start verwendet dieselbe
Prüfung. Beide Workflows teilen eine Concurrency-Gruppe, damit kein Import oder
Schema-Deployment parallel läuft. Laufende Vorgänge werden nicht abgebrochen.

Der Kataloghash umfasst Produkte, Metadaten und Bilder. Bereits vollständige
Versionen werden ohne Produkt-Schreibvorgänge wiederverwendet. Die vorherige
Hash-Konvention wird ebenfalls erkannt: Wenn Version, tatsächliche Produkt-
und Herstelleranzahlen, Versionsmetadaten und alle Metadatenzeilen passen,
bleibt der vorhandene Katalog aktiv. Der erste optimierte Lauf erzwingt daher
keinen Neuimport allein wegen der neuen Hash-Konvention.

Neue beziehungsweise unvollständige Versionen verwenden bedingte UPSERTs
statt `INSERT OR REPLACE`. Unveränderte Zeilen bleiben unverändert. Der
Aktivierungszeiger wird erst nach erfolgreicher Prüfung geändert. Eine
fehlgeschlagene Prüfung belässt den vorherigen aktiven Katalog. Alte Versionen
werden nicht automatisch gelöscht; das vermeidet zusätzliche Massenschreib-
vorgänge und erhält eine Rückfallmöglichkeit. Bei vielen echten Katalogupdates
Speicherverbrauch überwachen und separat eine begrenzte Bereinigung planen.

Bei einem wirklich neuen Katalog werden weiterhin mehrere Tausend Produkte
und Indexeinträge geschrieben. Mehrere echte Vollimporte an einem Tag können
also weiterhin das kontoweite Free-Limit erreichen. Der Fix beseitigt die
unnötigen Wiederholungen, erhöht aber nicht Cloudflares Tagesbudget.

## Öffentliche Formulare

Native Workers-Rate-Limit-Bindings begrenzen Formular- und Loginversuche ohne D1-Zähler:

- `PUBLIC_REQUEST_LIMITER`: 8 Versuche pro Minute und IP.
- `PUBLIC_GLOBAL_LIMITER`: 30 Versuche pro Minute für beide Formulare und Login zusammen.

Diese Cloudflare-Zähler sind ungefähr und gelten pro Standort, nicht als
strenges weltweites Tageslimit. Das bisherige D1-Limit von 8 syntaktisch gültigen
Versuchen pro Stunde/IP bleibt bestehen. Bereits gesperrte Buckets werden nur
noch gelesen; ein bedingter UPSERT schützt zusätzlich gegen parallele Versuche
und verlängert die Ablaufzeit bei Ablehnung nicht. Ungültige Formulardaten
werden vor jedem D1-Zugriff abgelehnt. Ohne Rate-Limit-Bindings oder ohne
Cloudflare-IP-Header werden öffentliche Schreibanfragen abgewiesen.

Das begrenzt den bekannten Zähler-Missbrauch, beweist aber nicht, dass ein
Absender ein Mensch ist. Für zusätzlichen Schutz gegen verteilte Bots sind
WAF-Regeln beziehungsweise Turnstile mit serverseitiger Tokenprüfung sinnvoll;
Turnstile ist in dieser Änderung nicht neu eingerichtet. Native Limits sind
keine Garantie gegen kontoweit mehr als 100.000 Schreibzeilen.

Abgelaufene Sessions werden beim Lesen lediglich als ungültig behandelt.
Der vorhandene tägliche Cron räumt höchstens 500 abgelaufene Sessions und
500 Rate-Limit-Buckets auf. Ein größerer Altbestand wird deshalb schrittweise
abgebaut. Aufräumfehler werden protokolliert. R2-Backups bleiben bestehen.

## Leserouten und interne Aktionen

GET-Routen ändern weder Schema noch Fahrzeuge noch Vertrags-Snapshots.
Verträge werden bei Bestätigung und relevanter Buchungsbearbeitung eingefroren.
Bestehende Datensätze ohne Snapshot bleiben unverändert; ein historischer
Backfill muss gesondert geplant werden. Finanzielle Altdaten werden nicht
mehr bei Webseitenbesuchen stillschweigend korrigiert, und ein absichtlich
gelöschter Renault Master wird nicht automatisch neu angelegt.

Suche und Filter verwenden die zuletzt geladenen Listen. Beim Öffnen einer
Ansicht und nach Aktionen wird frisch geladen. Parallele identische API-Aufrufe
werden innerhalb eines Browserfensters zusammengeführt. Die interne PWA lädt
die neue Script-Version nach dem üblichen Update-Hinweis.

Identische Statusänderungen ohne neue Notiz sind schreibfrei und senden keine
weitere E-Mail. Ausdrückliche neue Notizen bleiben speicherbar. Ein konkurrierender
Statuswechsel ergibt `stale_status` statt einer zweiten Audit-Zeile/E-Mail.
Identische Protokoll-POSTs schreiben keinen neuen Zustand oder Audit-Eintrag.
Der bedingte UPSERT schützt auch gleichzeitige identische Protokoll-Updates.
Öffentliche Formularanlagen haben weiterhin keinen dauerhaften Idempotency-Key;
bei einem unklaren Netzwerkfehler deshalb zuerst den Eingang im internen Bereich
prüfen, bevor eine echte Anfrage erneut abgesendet wird.

Katalog-Pagination bricht bei einem wiederholten Cursor oder mehr als
100 Seiten ab, statt unendlich weiterzulesen.

## Prüfung ohne produktive Daten

```bash
node tests/d1-write-budget.test.js
python3 tests/d1-sql.test.py
```

Die Tests verwenden D1-Mocks und zwei frei erfundene Produkte in lokalem
In-Memory-SQLite. Sie kontaktieren keine Live-API, lesen keine Secrets und
führen keine Remote-Datenbankoperationen aus. Sie prüfen unter anderem
lesende GET-Routen, ungültige/gesperrte Formulare, konkurrierende Anfragen,
unveränderte Statusaktionen, Katalog-Wiederverwendung, fehlgeschlagene
Aktivierungsprüfung, Schema-Planung und wiederholbare SQL-Anweisungen.

Nach einem später autorisierten Deployment die Cloudflare-Schreibmetriken
lesend kontrollieren. Keine Vollimporte als Lasttest starten.
