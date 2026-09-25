# AMTSWEG

Ein kleines Political-Idle-/Tycoon-Browsergame in einem fiktionalen deutschen Viertel.
Der Vertical Slice führt vom Tapeziertisch zum arbeitenden Wahlkreisbüro – in einer zusammenhängenden, horizontalen Welt.

## Lokal starten

Node.js 18 oder neuer:

```bash
npm start
```

Dann **http://127.0.0.1:8080** öffnen. Kein Build, keine Runtime-Abhängigkeiten, kein Backend.
Alternativ kann jeder statische Webserver das Projekt ausliefern.
Der mitgelieferte Server bindet ausschließlich an localhost und liefert nur Spielassets aus.

## So spielt es sich

1. Mit **FLYER VERTEILEN** sofort Unterstützer gewinnen. Der Klick bleibt dauerhaft aktiv.
2. Für 8 Unterstützer auf Level 2 ausbauen: Tischdecke, Plakat und schrittweise mehr Reichweite.
3. Für 18 Unterstützer den ersten Helfer einstellen. Er erscheint am Stand und arbeitet langsam zusätzlich zum manuellen Verteilen.
4. Weitere Helfer und Stand-Level erhöhen den passiven Ertrag behutsam. Auf Level 5 entsteht der Pavillon, auf Level 10 der professionelle Stand mit Banner und Licht.

Es gibt nur eine ausgebbare Ressource: Unterstützer. Käufe ziehen den angezeigten Betrag ab.
Vier Helfer sind einzeln sichtbar; der Straßenstand hat maximal zehn Level.

## Bedienung

- Der Start-Viewport bleibt auf den Straßenstand fokussiert.
- Wegleiste: direkt zum Straßenstand oder Büro springen.
- Bei fokussierter Spielwelt: Pfeiltasten, Pos1 und Ende.
- Tastaturbedienbare Buttons, sichtbare Fokusmarkierungen und reduzierte Bewegung werden unterstützt.
- Zurücksetzen verlangt eine Bestätigung.

## Spielstände

Der neue Spielstand liegt unter `amtsweg-horizontal-v2` im localStorage.
Käufe werden sofort, laufende Produktion spätestens alle drei Sekunden sowie beim Verlassen/Verbergen gespeichert.
Aktive Zyklen, Ausbau, Helfer und laufende Baustellen überleben einen Reload.

Alte Spielstände unter `amtsweg-v0.1-save` bleiben unverändert erhalten.
Unterstützer und Wahlkampfkasse werden einmalig zusammengeführt; Helfer, vorhandener Stand und Büro werden übernommen.
Ein alter Stand entspricht Level 5. Ein altes Wahl-Ende stoppt die neue Produktion nicht.
Beschädigtes JSON wird unter `amtsweg-horizontal-v2-recovery` gesichert.
Bei gesperrtem Speicher läuft die Sitzung weiter und zeigt den Speicherfehler an.
Speicherstände neuerer Versionen werden nicht überschrieben.

Automatisierte Standorte holen bis zu acht Stunden Abwesenheit nach. Ein manuell gestartetes Gespräch wird höchstens einmal abgeschlossen.
Der ursprüngliche V0.1-Spielstand wird auch beim Zurücksetzen nicht gelöscht.

## Architektur

- `src/game.js`: reine Zustandsübergänge, Balancing, Migration und deterministische Zyklen; unveränderte UMD-Modulstruktur.
- `src/storage.js`: sichere Speicherung, Wiederherstellung und Offline-Fortschritt.
- `src/world.js`: selbst gezeichnete SVG-Kulisse, CSS-Figuren, feste Passantenrouten und zustandsabhängige Arbeitsanimation.
- `src/main.js`: Eingaben, Kamera, UI, Speicherlebenszyklus und eine gemeinsame Animationsschleife.
- `index.html` / `styles.css`: zusammenhängende Straße, kontextuelles Panel, responsive Darstellung.
- `server.js`: kleiner lokaler Entwicklungsserver ohne Abhängigkeiten.

Die Economy kennt keine NPCs, DOM-Knoten, Kollisionen oder Animationsereignisse.
Große Zeitschritte werden ohne Schleifen pro Produktionszyklus berechnet.
Passanten verwenden fünf wiederverwendete Slots mit festen Wegen und endlicher Sichtbarkeit.
Ein separater Gesprächspartner visualisiert Annäherung, Flyerübergabe und Weitergehen.
Neue Standorte können später rechts ergänzt werden; Büro und Stand produzieren bereits unabhängig voneinander.

## Prüfen

```bash
npm run check
npm test
```

Der optionale Browser-Test benötigt Playwright (mit Clock-API) und Chromium bzw. Chrome:

```bash
npm install --no-save playwright
npx playwright install chromium
npm run test:browser
```

Alternativ zeigt `CHROME_PATH` auf ein installiertes Chrome. Der Test verwendet ein eigenes Browserprofil und einen temporären lokalen Server.
Er spielt den gesamten Loop über die UI, prüft einen Zyklus in Echtzeit und beschleunigt anschließend ausschließlich die Browserzeit.
Screenshots und Ergebnisprotokoll werden unter `artifacts/` erzeugt; dieser Ordner ist nicht versioniert.
Die unabhängigen Logiktests prüfen außerdem Zeitpartitionierung, Offline-Limits, Grenzwerte und Migration.

## Bewusst außerhalb dieses Slice

Stadtbüro, Landesgeschäftsstelle, Berlin, Wahlen und Endgame sind noch nicht implementiert.
Es gibt keine echten Parteien, Konten, Cloud-Saves oder zusätzliche Währungen.
Desktop ist der Schwerpunkt; die mobile Darstellung ist geprüft, eine Erprobung auf echten Touch-Geräten steht noch aus.
