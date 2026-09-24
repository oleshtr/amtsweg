# AMTSWEG

AMTSWEG ist ein browserbasiertes Pixel-Art-Tycoon-Spiel in einer fiktiven deutschen Kommune. V0.2 endet nach der ersten Kommunalwahl. Es gibt keine realen Parteien, kein Backend und keine Accounts.

## Spielen

```bash
python -m http.server 8080
```

Danach `http://localhost:8080` öffnen. Der Spielstand liegt in `localStorage`. Ein vorhandener V0.1-Spielstand wird beim ersten Laden defensiv migriert.

## V0.2-Loop

Flyer verteilen → Unterstützerbasis aufbauen → automatische Wahlkampfkasse → Helferteam → Infostand → Ortsbüro → Kommunalwahl.

Die manuelle Flyer-Aktion dauert 1,8 Sekunden; der Unterstützer wird erst bei der Übergabe gutgeschrieben. Das Helferteam erzeugt Kontakte. Der Infostand verarbeitet Kontakte mit begrenzter Kapazität und verstärkt deren Wirkung. Das Ortsbüro verbessert das Fundraising aus der Unterstützerbasis, ebenfalls mit Kapazitätsgrenze. Warteschlangen und Materialstapel zeigen Engpässe in der Szene.

## Balancing

Die verbindliche Spielbeschreibung steht in [docs/V0.2_TYCOON_SPEC.md](docs/V0.2_TYCOON_SPEC.md). Alle Zahlen stehen in `CONFIG` in `src/game.js`.

Die Cash-Startformel aus der Spec blieb unverändert: `0,06 + Unterstützer × 0,0015 €/s`. Die Werte wurden anhand einer deterministischen aktiven Session angepasst:

| Wert | Spec-Richtwert | V0.2 | Grund |
| --- | ---: | ---: | --- |
| Erster Helfer | ca. 35 € | 45 € | Erstkauf bei etwa fünf Minuten |
| Infostand-Levelkosten | nicht festgelegt | `ceil(25 × 1,18^Level)` | LV10 bei etwa 21 Minuten |
| Ortsbüro-Levelkosten | nicht festgelegt | `ceil(85 × 1,27^Level)` | Wahl-Reveal nach LV5 bei etwa 32 Minuten |
| Wahl-Antritt | nicht festgelegt | 1.100 € | Abschluss bei etwa 43 Minuten |

Das Replay in `scripts/balance.cjs` verteilt Flyer bis zum ersten Helfer fortlaufend, danach etwa alle fünf Sekunden. Es kauft den jeweils nächsten erforderlichen Stationslevel sofort, sobald er bezahlbar ist. Das ist ein Modell, kein beobachteter menschlicher Spieldurchlauf. Ergebnis in Minuten: Wahlkampfkasse 1,6; Helfer 5,0; Helfer LV5 9,4; Infostand 12,4; Infostand LV10 21,1; Ortsbüro 24,6; Wahl-Reveal 32,3; Wahlabschluss 42,7. Durchgehendes manuelles Verteilen oder andere Kaufentscheidungen verändern diese Zeiten.

## Prüfen

Node.js 18+:

```bash
npm install
npm run check
npm test
npm run balance
npm run browser:qa
```

`browser:qa` startet einen lokalen HTTP-Server und prüft den frischen Spielstand, den Flyer-Zyklus, alle Stationen, Reload, Victory und Reset auf 1440×900, 900×800 und 390×844. Das Skript verwendet eine lokal installierte Chrome-Ausführung. Playwright ist nur eine Dev-Abhängigkeit; das Spiel selbst benötigt keine Runtime-Abhängigkeiten oder einen Build-Schritt.
