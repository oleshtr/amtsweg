# AMTSWEG

AMTSWEG ist ein browserbasiertes Pixel-Art-Tycoon-Spiel in einer fiktiven deutschen Kommune. V0.2 endet nach der ersten Kommunalwahl. Es gibt keine realen Parteien, kein Backend und keine Accounts.

## Spielen

```bash
python -m http.server 8080
```

Danach `http://localhost:8080` öffnen. Der Spielstand liegt in `localStorage`. Ein vorhandener V0.1-Spielstand wird beim ersten Laden defensiv migriert.

## V0.2-Loop

Flyer verteilen → Unterstützerbasis aufbauen → automatische Wahlkampfkasse → Helferteam → Infostand → Ortsbüro → Kommunalwahl.

Jeder Flyer-Klick gibt sofort einen Unterstützer und bleibt ohne Cooldown nutzbar. Nur die gleichzeitig sichtbaren Flyer-Partikel sind auf zwölf begrenzt. Das Helferteam erzeugt Kontakte; sein sichtbarer Arbeitszyklus wird mit steigender Leistung schneller. Der Infostand verarbeitet Kontakte mit begrenzter Kapazität und verstärkt deren Wirkung. Das Ortsbüro verbessert das Fundraising aus der Unterstützerbasis, ebenfalls mit Kapazitätsgrenze. Warteschlangen und Materialstapel zeigen Engpässe in der Szene.

## Balancing

Die ursprüngliche Spielbeschreibung steht in [docs/V0.2_TYCOON_SPEC.md](docs/V0.2_TYCOON_SPEC.md); der spätere Clicker-Polish-Pass ersetzt deren Flyer-Cooldown und frühere Balancing-Richtwerte. Alle aktuellen Zahlen stehen in `CONFIG` in `src/game.js`.

Mit sofortigen Klicks wäre die bisherige lineare Cash-Formel zu schnell. Fundraising steigt deshalb mit der Unterstützerbasis und sättigt sich allmählich: `0,06 + 1,8 × Unterstützer / (Unterstützer + 2500) €/s`. Das Ortsbüro multipliziert diesen Ertrag bis zu seiner Level-Kapazität.

| Wert | Neuer Wert |
| --- | ---: |
| Wahlkampfkasse ab | 350 Unterstützern |
| Helfer-Kauf / Levelkosten | 130 € / `ceil(25 × 1,32^Level)` |
| Helfer-Startleistung | 1,25 Kontakte/s |
| Infostand-Gate / Bau / Levelkosten | Helfer LV5 und 900 Unterstützer / 150 € / `ceil(27 × 1,18^Level)` |
| Ortsbüro-Gate / Bau / Levelkosten | Infostand LV10 und 2.200 Unterstützer / 350 € / `ceil(90 × 1,27^Level)` |
| Wahl-Reveal / Antritt | Büro LV5 und 4.500 Unterstützer / 6.500 Unterstützer und 1.100 € |

Das Replay in `scripts/balance.cjs` klickt bis zum ersten Helfer fortlaufend mit 2, 4 oder 6 Klicks pro Sekunde. Danach klickt es in jeder Minute 15 Sekunden lang mit derselben Frequenz. Es kauft den jeweils nächsten erforderlichen Stationslevel sofort, sobald er bezahlbar ist. Alle Klicks und Tick-Effekte laufen durch die echte Spiellogik. Dies ist ein modellierter aktiver Lauf und keine gemessene menschliche Session.

| Klicks/s während aktiver Phasen | Kasse | Helfer | Helfer LV5 | Stand | Stand LV10 | Büro | Wahl sichtbar | Wahl fertig |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2 | 2,9 | 8,0 | 13,2 | 16,2 | 25,6 | 30,1 | 38,3 | 48,7 |
| 4 | 1,5 | 5,7 | 10,2 | 12,8 | 21,7 | 26,1 | 34,2 | 44,7 |
| 6 | 1,0 | 4,8 | 8,8 | 11,3 | 19,7 | 24,0 | 32,1 | 42,6 |

## Prüfen

Node.js 18+:

```bash
npm install
npm run check
npm test
npm run balance
npm run browser:qa
```

`browser:qa` startet einen lokalen HTTP-Server und prüft den frischen Spielstand, 110 schnelle Flyer-Klicks, Partikelbegrenzung, alle Stationen, lokale Level-Effekte, Reload, Victory und Reset auf 1440×900, 900×800 und 390×844. Es speichert Screenshots der sechs Spielphasen im temporären Systemverzeichnis. Das Skript verwendet eine lokal installierte Chrome-Ausführung. Playwright ist nur eine Dev-Abhängigkeit; das Spiel selbst benötigt keine Runtime-Abhängigkeiten oder einen Build-Schritt.
