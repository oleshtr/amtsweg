# AMTSWEG

AMTSWEG ist ein kleines Browser-Idle-/Tycoon-Spiel in einer vollständig fiktiven deutschen Kommune. V0.3 konzentriert sich auf einen sichtbaren, leicht verständlichen Produktionsloop: Was gekauft wird, erscheint in der Welt und arbeitet dort tatsächlich.

## Lokal spielen

```bash
npm run dev
```

Danach läuft das Spiel unter `http://localhost:8080`. Der Spielstand liegt in `localStorage`.

## V0.3: Visible Tycoon Loop

Der Kern ist jetzt:

**selbst Flyer verteilen → ersten Helfer automatisieren → echtes Helferteam aufbauen → Infostand als eigene Produktionsstation → Ortsbüro als Geldmaschine → Kommunalwahl → nächster Bezirk mit permanentem Erfahrungsbonus**

### Sichtbare Ursache und Wirkung

- Ein manueller Flyer-Klick erzeugt genau einen dazugehörigen Passantenkontakt.
- Gekaufte Helfer sind keine abstrakten Level mehr: `Helfer ×5` bedeutet fünf sichtbare Helfer in der Welt.
- Der Infostand produziert Unterstützer in eigenen Arbeitszyklen; er ist kein versteckter Multiplikator des Helferteams.
- Das Ortsbüro produziert Wahlkampfgeld in eigenen sichtbaren Zyklen.
- Zufällige Figuren ohne Gameplay-Funktion wurden aus dem Produktionsloop herausgehalten.

### Milestones

Helfer, Infostand und Ortsbüro besitzen klar sichtbare Milestones. Die nächste Schwelle wird direkt an der Station angezeigt.

- Helfer ×3: Team-Routine
- Helfer ×5: Materialwagen
- Helfer ×10: zweites Einsatzteam
- Infostand LV3: zweiter Betreuer
- Infostand LV5: Doppelstand
- Ortsbüro LV3: zweiter Arbeitsplatz
- Ortsbüro LV5: Telefonbank

Milestones erhöhen nicht nur Zahlen, sondern verändern die Szene.

### Pace

Der Balancing-Replay benutzt die echte Spiellogik inklusive schnellem manuellen Klicken und Kaufkosten:

| aktive Flyer-Zeit je Minute | erster Helfer | Infostand | Ortsbüro | Wahl |
| ---: | ---: | ---: | ---: | ---: |
| 20 s | 0:18 | 8:48 | 14:54 | 20:18 |
| 35 s | 0:18 | 6:12 | 11:36 | 16:48 |
| 50 s | 0:18 | 5:00 | 9:48 | 14:48 |

Damit entsteht früh Automation, während der komplette erste Bezirk lang genug bleibt, um mehrere deutliche Fortschrittssprünge zu enthalten.

### Prestige / nächster Bezirk

Die Kommunalwahl ist nicht mehr nur ein Endscreen. Ein Wahlsieg gibt permanente **Erfahrung**. Pro Erfahrungspunkt steigt die gesamte Produktion dauerhaft um 12 %. Danach kann der nächste Bezirk gestartet werden:

- Unterstützer, Geld und Stationen beginnen wieder bei null.
- Bezirk steigt um eins.
- Erfahrung und Bestwert bleiben erhalten.
- spätere Bezirke haben leicht höhere Wahlziele.

### Idle

Nach dem ersten Helfer wird bis zu zwei Stunden Offline-Fortschritt berechnet. Beim Zurückkehren zeigt das Spiel Unterstützer- und Geldgewinn als Zusammenfassung.

## Balancing

```bash
npm run balance
```

## Prüfen

```bash
npm run check
npm test
npm run balance
npm run browser:qa
```

`browser:qa` prüft den frischen Start, Rapid-Click-Verhalten, reale Helferzahl, Infostand- und Ortsbürozyklen, Wahl, Prestige, Reload und V0.2-Save-Migration bei Desktop, Tablet und Mobile.

## Architektur

- HTML
- CSS
- Vanilla JavaScript
- localStorage
- keine Runtime-Abhängigkeiten
- keine Accounts / kein Backend
- keine realen Parteien oder Politiker

Gameplay-Werte liegen zentral in `CONFIG` in `src/game.js`.
