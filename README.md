# AMTSWEG

AMTSWEG ist ein kleines Browser-Tycoon-Spiel in einer fiktiven deutschen Kommune. V0.2 endet nach der ersten Kommunalwahl. Es gibt keine realen Parteien, kein Backend und keine Accounts.

## Lokal spielen

```bash
npm run dev
```

Das Spiel ist dann unter `http://localhost:8080` erreichbar. Der Spielstand liegt in `localStorage`; der Reset-Knopf ist jederzeit erreichbar. Ältere Saves werden beim Laden normalisiert. Noch ausstehende Kontakte aus dem vorherigen Puffer-Modell werden einmalig in Unterstützer umgewandelt.

## Spielablauf

Flyer verteilen → Helfer anwerben → Wahlkampfkasse → Infostand → Ortsbüro → Kommunalwahl.

Jeder Klick auf **Flyer verteilen** gibt sofort genau einen Unterstützer. Der Button bleibt ohne Cooldown nutzbar. Die Szene zeigt einen kurzen Flyerwurf, einen reagierenden Empfänger und `+1 Unterstützer`. Bei schnellem Klicken begrenzt das Spiel nur gleichzeitig sichtbare Effekte.

Ab 30 Unterstützern kann ein erster Helfer kostenlos angeworben werden. Er erscheint in der Welt und erzeugt Unterstützer in sichtbaren Arbeitszyklen. Helfer-Upgrades erhöhen seine Rate. Die Wahlkampfkasse erscheint erst, wenn ein Helfer vorhanden ist und mindestens 75 Unterstützer gewonnen wurden. Spenden entstehen dann passiv aus der Unterstützerbasis.

Der Infostand verstärkt Helfer-Erträge. Das Ortsbüro verbessert das Fundraising. Stationen und spätere Weltbereiche bleiben bis zu ihrem Fortschritt verborgen. Alle zentralen Werte stehen in `CONFIG` in `src/game.js`. Die frühere Kontakt-Queue und der Kampagnenplatz als Upgrade-Station sind entfernt.

## Balancing

`npm run balance` spielt den aktiven Weg mit 2, 4 und 6 Klicks pro Sekunde nach. Bis zum Helfer wird durchgehend geklickt; danach werden pro Minute 15 Sekunden aktiv Flyer verteilt. Der Replay benutzt die echte Spiellogik und ist kein gemessener menschlicher Playtest.

| Klicks/s | Helfer | Kasse | Helfer LV5 | Infostand | Ortsbüro | Wahl fertig |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2 | 0:15 | 0:51 | 5:24 | 11:30 | 25:30 | 36:36 |
| 4 | 0:07 | 0:19 | 4:36 | 10:18 | 23:24 | 34:36 |
| 6 | 0:05 | 0:11 | 4:12 | 9:30 | 21:54 | 32:54 |

## Prüfen

```bash
npm run check
npm test
npm run balance
npm run browser:qa
```

`browser:qa` prüft den frischen Start, 110 schnelle Klicks, sichtbare Helferproduktion, Geld-Unlock, spätere Stationen, Reload, Reset und Save-Migration bei 1440×900, 900×800 und 390×844. Screenshots liegen nur im temporären Systemverzeichnis. Playwright ist eine Dev-Abhängigkeit; das Spiel selbst benötigt keine Runtime-Abhängigkeiten und keinen Build-Schritt.
