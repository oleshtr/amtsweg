# AMTSWEG

AMTSWEG ist ein browserbasiertes Pixel-Art-Tycoon-Spiel in einer fiktiven deutschen Kommune. V0.2 endet nach der ersten Kommunalwahl. Es gibt keine realen Parteien, kein Backend und keine Accounts.

## Spielen

```bash
npm run dev
```

Danach `http://localhost:8080` öffnen. Der Spielstand liegt in `localStorage`. Der Reset-Knopf ist auch am Start erreichbar. Vorhandene Saves ohne `campaignLevel` werden mit Level 1 geladen.

## V0.2-Loop

Flyer verteilen → Kampagnenplatz ausbauen → frühe automatische Wahlkampfkasse → Helferteam → Infostand → Ortsbüro → Kommunalwahl.

Jeder Flyer-Klick gibt sofort den aktuellen Kampagnenplatz-Output und bleibt ohne Cooldown nutzbar. Gleichzeitig sichtbare Flyer-Partikel sowie Arm- und Passantenreaktionen sind begrenzt; kein Klick geht dadurch verloren. Das Helferteam erzeugt Kontakte; sein sichtbarer Arbeitszyklus wird mit steigender Leistung schneller. Der Infostand verarbeitet Kontakte mit begrenzter Kapazität und verstärkt deren Wirkung. Das Ortsbüro verbessert das Fundraising aus der Unterstützerbasis, ebenfalls mit Kapazitätsgrenze. Warteschlangen und Materialstapel zeigen Engpässe in der Szene.

## Balancing

Die ursprüngliche Spielbeschreibung steht in [docs/V0.2_TYCOON_SPEC.md](docs/V0.2_TYCOON_SPEC.md); die späteren Nutzeranweisungen ersetzen deren Flyer-Cooldown und frühe Balancing-Richtwerte. Alle aktuellen Zahlen stehen in `CONFIG` in `src/game.js`.

Der Kampagnenplatz beginnt auf Level 1. Level 2 und 3 sind nach 30 bzw. 60 Unterstützern kostenlos; danach kosten Upgrades `0,60 × 1,29^(Level − 3) €`, auf Cent gerundet. Jeder Level erhöht den manuellen Output leicht. Die Meilensteine LV5, LV10 und LV20 ergeben genau 2, 3 und 5 Unterstützer pro Klick und verändern die Szene sichtbar.

Die Wahlkampfkasse erscheint ab 100 Unterstützern. Ihr Startwert beträgt `0,015 €/s`; danach wächst sie mit `1,8 × (Unterstützer − 100) / (Unterstützer − 100 + 2500) €/s`. Der frühe Ertrag ist klein, erreicht aber später ungefähr die bisherige Größenordnung. Das Ortsbüro multipliziert ihn weiter bis zu seiner Level-Kapazität.

| Wert | Neuer Wert |
| --- | ---: |
| Wahlkampfkasse ab | 100 Unterstützern |
| Helfer-Gate / Kauf / Levelkosten | Kampagnenplatz LV6, 350 Unterstützer / 95 € / `ceil(25 × 1,32^Level)` |
| Helfer-Startleistung | 1,25 Kontakte/s |
| Infostand-Gate / Bau / Levelkosten | Helfer LV5 und 900 Unterstützer / 150 € / `ceil(27 × 1,18^Level)` |
| Ortsbüro-Gate / Bau / Levelkosten | Infostand LV10 und 2.200 Unterstützer / 350 € / `ceil(90 × 1,27^Level)` |
| Wahl-Reveal / Antritt | Büro LV5 und 4.500 Unterstützer / 6.500 Unterstützer und 1.100 € |

Das Replay in `scripts/balance.cjs` klickt bis zum ersten Helfer fortlaufend mit 2, 4 oder 6 Klicks pro Sekunde. Es kauft zuerst Kampagnenplatz-Level bis LV18, spart dann auf den Helfer und klickt danach in jeder Minute 15 Sekunden lang. Spätere Stationslevel kauft es sofort, sobald sie bezahlbar sind. Alle Klicks und Tick-Effekte laufen durch die echte Spiellogik. Dies ist ein modellierter aktiver Lauf und keine gemessene menschliche Session. Beim Sparen auf den Helfer bleibt LV19 als alternative Kaufentscheidung verfügbar; die Helfer-Anzeige zeigt den Geldfortschritt. Die Straße reagiert zusätzlich alle 200 Unterstützer. Der längste Abstand zwischen Kauf- oder sichtbaren Reaktionsereignissen bis zum Helfer beträgt im Replay 26, 15 und 12 Sekunden bei 2, 4 und 6 Klicks/s.

| Klicks/s | Erstes Upgrade | Kasse | Platz LV5 | Platz LV10 | Helfer | Stand | Büro | Wahl fertig |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2 | 0:15 | 0:45 | 1:16 | 2:15 | 7:02 | 13:00 | 25:30 | 44:06 |
| 4 | 0:07 | 0:22 | 0:46 | 1:29 | 5:13 | 10:18 | 21:54 | 40:24 |
| 6 | 0:05 | 0:15 | 0:35 | 1:10 | 4:28 | 9:06 | 20:06 | 38:42 |

## Prüfen

Node.js 18+:

```bash
npm install
npm run check
npm test
npm run balance
npm run browser:qa
```

`browser:qa` startet einen lokalen HTTP-Server und prüft den frischen Spielstand, 110 schnelle Flyer-Klicks, Partikelbegrenzung, Kampagnenplatz LV2/3/5, Cash-Unlock, Helfer, spätere Stationen, Reload, Victory und Reset auf 1440×900, 900×800 und 390×844. Es speichert Screenshots im temporären Systemverzeichnis. Das Skript verwendet eine lokal installierte Chrome-Ausführung. Playwright ist nur eine Dev-Abhängigkeit; das Spiel selbst benötigt keine Runtime-Abhängigkeiten oder einen Build-Schritt.
