# Vertical Slice – Abschlussprüfung

Datum: 24.09.2026. Branch: `astra-horizontal-world`.

## Ergebnis

Der vollständige Loop wurde lokal in Chrome gespielt und nach Korrekturen erneut geprüft:
Gespräch → Unterstützer → Stand-Upgrade → sichtbarer Helfer → Automation → Pavillon → horizontale Kamerafahrt → Büro freischalten → Aufbau → laufende Büroproduktion.

- `npm run check`: bestanden.
- `npm test`: 23/23 bestanden.
- `tests/browser.cjs`: 37/37 Browser-Prüfungen bestanden.
- `git diff --check`: bestanden.
- Lokaler Server: HTTP 200 unter `http://127.0.0.1:8080`.
- Keine neuen kritischen JavaScript- oder Konsolenfehler in den geprüften Abläufen.

Verwendet wurde Node.js 24.19.0 aus der vorhandenen lokalen Toolchain, Playwright und installiertes Chrome. Das systemweite Node.js 17 reicht für den Node-Test-Runner nicht; die dokumentierte Projektvoraussetzung ist Node.js 18+.

## Abgedeckte Prüfungen

Die Logiktests prüfen manuelle Zyklen ohne Sofortbelohnung, Klick-Spam, exakte Kaufkosten, unzureichende Mittel, Automation, Levelgrenzen, grafische Ausbaustufen, Erhalt laufenden Zyklusfortschritts, unabhängige Standortproduktion und Bauzeiten. Große Zeitschritte und viele kleine Schritte liefern dieselbe Economy.

Migration, Save-Roundtrip, Offline-Limit von acht Stunden, rückwärts laufende Uhr, ungültige Zahlen, beschädigtes JSON, verweigerter Speicherzugriff und fremde zukünftige Save-Versionen sind geprüft. Der originale V0.1-Spielstand bleibt unangetastet.

Passantenwege wurden über mehrere Lebenszyklen auf gerichtete Bewegung, begrenzte Slots und Despawn geprüft. Im Browser lief die Produktion auch nach Entfernen aller Umgebungs-NPCs weiter. Ein zusätzlich absichtlich geworfener Renderer-Fehler wurde abgefangen; Economy, UI und Speicherung arbeiteten weiter. Nur diese gezielte Fehlerfixture erzeugt eine erwartete Konsolenwarnung.

Der Browser-Test verwendet frische isolierte Kontexte und einen temporären lokalen Server. Ein manueller Zyklus läuft in Echtzeit; anschließend wird ausschließlich die Browserzeit beschleunigt, während Käufe über die tatsächlichen UI-Buttons erfolgen. Die Zustandsabfragen sind lesend; die Produktion wird nicht mit Testressourcen finanziert.

Geprüft wurden außerdem:

- Sichtbarkeit aller vier gekauften Helfer und des Spielers.
- Flyerübergabe entsprechend dem Zyklusfortschritt.
- Tisch-, Plakat-, Pavillon-, Banner- und Licht-Ausbaustufen.
- Mausrad, Drag, Tastatur, Wegleiste und Rückkehr zum Start.
- Normale und reduzierte Bewegung.
- Gesperrtes Büro, Ressourcenabzug, Gerüst, sichtbarer Aufbau und Bürointerieur.
- Reload mitten in der Bauphase sowie nach Eröffnung.
- Büroproduktion und anschließendes Büro-Upgrade.
- Zurücksetzen mit Bestätigung und anschließender Reload.
- Desktop mit 1440 × 1050 / 1280 × 900 sowie mobile Darstellung mit 390 × 844; kein horizontaler Dokumentüberlauf.

## Visuelle Kontrolle

Screenshots unter `artifacts/` wurden für Start, Pavillon, Bauphase, Büro, professionellen Stand und mobile Darstellung erzeugt. Start, Büro, professioneller Stand und Mobile wurden zusätzlich visuell inspiziert. Die zu starke Verdeckung von Helfern durch den Tisch wurde durch Arbeitspositionen und Zeichenreihenfolge behoben.

`artifacts/browser-report.json` enthält die 37 einzelnen Prüfergebnisse. Testartefakte sind bewusst nicht versioniert.

## Balancing

Der deterministische Durchlauf mit sofortigen Entscheidungen ergibt:

| Meilenstein | Zeit |
| --- | ---: |
| Erstes Stand-Upgrade | 8,4 s |
| Erster Helfer | 19,2 s |
| Pavillon, Level 5 | 35,7 s |
| Büro freischalten | 101,4 s |
| Erste Büro-Kampagne abgeschlossen | 114,4 s |

Die fünf Minuten sind damit ein gut erreichbares Einstiegsfenster. Ein Spieltest mit Menschen sollte als Nächstes prüfen, ob dieses Tempo genügend Raum zum Entdecken lässt.

## Grenzen und nächster Schritt

Keine bekannten blockierenden Fehler im geprüften Slice. Mobile wurde im Browser emuliert, nicht auf echten Touch-Geräten geprüft. Browserübergreifende Prüfung in Firefox/Safari und subjektives Balancing mit echten Spielern stehen aus. Die bewusst später vorgesehenen Standorte und das politische Endgame sind nicht Bestandteil dieses Umbaus.

Empfehlung: zuerst einen beobachteten Fünf-Minuten-Spieltest durchführen und Upgrade-/Unlock-Tempo justieren, danach das Stadtbüro rechts anschließen.

## Git

Ausschließlich auf `astra-horizontal-world` gearbeitet. Keine Commits oder Pushes erstellt, keine History verändert. Änderungen liegen zur Prüfung im Working Tree. Die bereits vorhandene unversionierte Datei `ASTRA_REBUILD_PROMPT.md` blieb unverändert erhalten.
