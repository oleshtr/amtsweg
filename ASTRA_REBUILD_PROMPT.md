# AMTSWEG – Astra Horizontal World / Vertical Slice Rebuild

## GIT-ANWEISUNG

Du arbeitest im lokalen **AMTSWEG**-Repository auf dem bereits ausgecheckten Branch:

`astra-horizontal-world`

Prüfe **vor jeder Änderung** selbst den aktuellen Branch und `git status`.

- Arbeite ausschließlich auf `astra-horizontal-world`.
- Nicht auf `main` wechseln.
- Nicht direkt auf `main` arbeiten.
- Keine bestehenden lokalen Änderungen verwerfen.
- Kein `git reset --hard`.
- Keine Git-History überschreiben.
- Keine vorhandene Arbeit ohne zwingenden Grund entfernen.
- Falls der aktuelle Branch nicht `astra-horizontal-world` ist, führe keine Änderungen durch und melde das.
- Implementiere und teste die Änderungen tatsächlich lokal.
- Höre nicht nach einer Analyse oder einem Konzept auf.

---

## 1. ROLLE UND AUFTRAG

Du bist Lead Game Designer, Gameplay Engineer, UI/UX Designer und Pixel-Art Technical Director für mein Browsergame **AMTSWEG**.

Du arbeitest direkt am bestehenden Projekt. Deine Aufgabe ist nicht nur, Vorschläge zu machen oder einen Plan zu schreiben, sondern den nachfolgend beschriebenen Umbau **selbstständig im Code umzusetzen, lokal zu testen, Fehler zu beheben und bis zu einem funktionierenden Vertical Slice fertigzustellen**.

Analysiere zuerst die vorhandene Codebase, Architektur und den aktuellen Gameplay-Stand. Bewahre funktionierende Teile, sofern sie zum neuen Konzept passen. Refactore gezielt statt unnötig alles neu zu schreiben.

---

## 2. DAS SPIEL

AMTSWEG ist ein deutsches Political-Idle-/Tycoon-Browsergame.

Die langfristige Fantasy lautet:

> Vom improvisierten Straßenwahlkampf bis in die Bundespolitik.

Der Spieler beginnt extrem klein und baut Schritt für Schritt eine immer professionellere politische Organisation auf.

Die Inspiration für Progression, Automation und befriedigendes Wachstum ist **Idle Miner Tycoon**.

AMTSWEG soll jedoch **keine Kopie** davon werden.

Der zentrale Unterschied:

## Die Spielwelt wächst HORIZONTAL.

Nicht nach unten wie eine Mine.  
Nicht primär perspektivisch nach hinten.  
Nicht über abstrakte Menüs.

Der Spieler bewegt sich von **links nach rechts durch eine zusammenhängende Welt**.

Ganz links soll später weiterhin der kleine Ort sichtbar sein, an dem alles begonnen hat. Je weiter man nach rechts kommt, desto größer, urbaner, professioneller und politisch bedeutender wird die Umgebung.

---

## 3. DEN AKTUELLEN GAMEPLAY-ANSATZ NICHT WEITER FLICKEN

Im bestehenden Build gibt es unter anderem einen Kampagnenplatz / Straßenwahlkampf, Passanten, Flyer und Helfer.

Der aktuelle Ansatz funktioniert spielerisch nicht überzeugend genug:

- Passanten laufen teilweise zufällig herum.
- Figuren bleiben an Flyer-Bereichen oder hinter dem Stand hängen.
- Es entstehen Staus.
- Animation und tatsächliches Gameplay hängen nicht sinnvoll zusammen.
- Der Flyer-Bereich wirkt künstlich.
- Der „Flyer verteilen“-Mechanismus vermittelt kein befriedigendes Tycoon-Gefühl.

### Diese Mechanik soll nicht einfach weiter repariert werden.

Insbesondere möchte ich NICHT:

- endlose zufällige NPCs als eigentliche Produktionsmechanik
- Passanten, die an Triggerzonen hängen bleiben
- Figuren, die sinnlos hin und her laufen
- einen separaten Flyer-Bereich auf dem Boden
- einen „Flyer verteilen“-Button ohne sichtbaren Zusammenhang zur Welt
- abstrakte Animationen ohne Gameplay-Bedeutung
- eine überladene Kampagnenplatz-UI
- mehrere voneinander getrennte Screens für jeden kleinen Fortschritt

Baue stattdessen den Core Loop entsprechend dieses Dokuments um.

---

## 4. NEUES KERNKONZEPT

Die Hauptwelt ist eine große horizontal scrollbare 2D-Welt.

Grundprinzip:

`[ START ] → → → → → → → → → [ POLITISCHE SPITZE ]`

Der Spieler beginnt links.

Neue Bereiche werden rechts freigeschaltet.

Bereits entwickelte Bereiche bleiben sichtbar und existent.

Die Kamera kann horizontal durch die Welt bewegt werden.

Langfristig soll die Welt ungefähr diese Entwicklung ermöglichen:

### STUFE 1 – STRASSENWAHLKAMPF

Kleine deutsche Straße.

Improvisierter Infostand.

Am Anfang beispielsweise:

- kleiner Tisch
- Flyer
- eine Person
- Wohnhäuser
- Bürgersteig
- Laternen
- Bushaltestelle
- Fahrräder
- kleine Umgebungsdetails

Es soll bewusst bescheiden aussehen.

### STUFE 2 – WAHLKREISBÜRO

Weiter rechts entsteht ein kleines Ladenlokal / Büro.

Beispielsweise:

- Schaufenster
- Plakate
- kleiner Büroraum
- Schreibtisch
- Mitarbeiter
- Telefon
- Computer

Die Welt wird etwas urbaner.

### STUFE 3 – STADTBÜRO

Größeres Office.

Mehrere Mitarbeiter.

Mehr Aktivität.

Größere Stadt im Hintergrund.

### STUFE 4 – LANDESGESCHÄFTSSTELLE

Deutlich professioneller.

Mehrstöckiges Gebäude.

Mehr Personal.

Presse.

Dienstwagen.

Professionelle Kampagnenstruktur.

### STUFE 5 – HAUPTSTADTBÜRO / BERLIN

Moderne Großstadt.

Große politische Organisation.

Professionelle Büros.

Mehrere Teams.

Berlin soll visuell erkennbar werden.

### STUFE 6 – BUNDESPOLITIK

Regierungsviertel / Bundestag als visuelles Endgame.

Wichtig:

Der Spieler soll nicht einfach „den Bundestag kaufen“.

Es geht um politische Karriere und Organisationswachstum.

Denkbar wären später:

- Abgeordnetenbüro
- Fraktionsbüro
- Parteizentrale
- Regierungsviertel

Der Reichstag kann als starkes visuelles Landmark im Hintergrund erscheinen.

### WICHTIG

Diese späteren Bereiche müssen jetzt **nicht vollständig implementiert** werden.

Sie definieren die langfristige räumliche und technische Richtung.

---

## 5. WAS DU JETZT TATSÄCHLICH BAUEN SOLLST

Implementiere zunächst einen hochwertigen **Vertical Slice** aus:

### A. Straßenwahlkampf

und

### B. erstem Wahlkreisbüro

Diese beiden Bereiche sollen beweisen, dass der neue Core Loop funktioniert.

**Qualität vor Umfang.**

Baue nicht vorschnell sechs halbfertige Welten.

---

## 6. HORIZONTALER WELTAUFBAU

Baue eine zusammenhängende Welt, die horizontal größer als der Viewport ist.

Der Spieler soll nach rechts und wieder zurück nach links navigieren können.

Desktop first.

Die Kamera muss sich angenehm anfühlen.

Mögliche Steuerung:

- Mausrad / Shift + Mausrad
- Drag/Pan
- sinnvolle automatische Kamerabewegung beim Unlock
- optional Keyboard

Entscheide anhand der bestehenden Architektur, was technisch am sinnvollsten ist.

### Wichtig

Die Welt darf nicht wie mehrere isolierte Karten nebeneinander wirken.

Sie soll wie **eine zusammenhängende Landschaft** wirken.

Langfristiges Beispiel:

`Wohngebiet → kleine Geschäftsstraße → Innenstadt → Großstadt → Berlin`

Die Übergänge sollen organisch sein.

---

## 7. CORE LOOP

Das wichtigste Prinzip:

## Die Welt selbst visualisiert die Produktion.

Nicht irgendeine abstrakte Tabelle.

Beispiel Straßenstand:

1. Ein Helfer nimmt Flyer.
2. Er bewegt sich sinnvoll.
3. Er interagiert kurz mit einem Passanten.
4. Der Passant erhält sichtbar einen Flyer.
5. Die Animation endet.
6. Der Produktionszyklus wird abgeschlossen.
7. Der Spieler erhält beispielsweise `+1 Unterstützer`.
8. Der nächste Zyklus beginnt.

### Entscheidende technische Regel

**Passanten sind visuelles Feedback. Sie sind nicht die technische Grundlage der Produktion.**

Wenn ein NPC-Pfad oder eine Animation fehlschlägt, darf dadurch niemals die Economy stehen bleiben.

Die Economy muss deterministisch und unabhängig von NPC-Kollisionen funktionieren.

> Animation visualisiert den State. Animation bestimmt nicht den State.

---

## 8. NPC-SYSTEM

Ersetze das aktuelle chaotische Passantenverhalten.

Passanten sollen:

- grundsätzlich über definierte Laufwege laufen
- sinnvoll von links nach rechts oder rechts nach links laufen
- nicht dauerhaft am Stand hängen
- nicht kollidieren und dadurch Staus verursachen
- nicht hinter Gebäuden feststecken
- nicht zufällig auf kleinen Flächen herumwandern
- nach einer Interaktion weiterlaufen
- nach Verlassen des relevanten Bereichs sauber despawnen

Wenn ein Passant für eine Flyeranimation gebraucht wird:

1. geeigneten Passanten auswählen oder spawnen
2. kurze Interaktion am Stand
3. Flyerübergabe visuell zeigen
4. Passant setzt seinen Weg fort
5. sauber despawnen

Keine physikalische Crowd-Simulation bauen.

Das System soll deterministisch, robust und performant sein.

---

## 9. HELFER MÜSSEN SICHTBARE FIGUREN SEIN

Wenn ich einen Helfer kaufe, möchte ich tatsächlich sehen:

> Da arbeitet jetzt eine zusätzliche Person.

Nicht nur:

`+10 % Produktion`

Beispiel:

**0 Helfer:**  
Grundfigur / Spieler arbeitet langsam.

**1 Helfer:**  
Eine zusätzliche Figur erscheint und übernimmt Arbeit.

**2 Helfer:**  
Eine zweite Figur erscheint.

Weitere Upgrades können Animationen effizienter machen, den Stand entwickeln oder den Output erhöhen.

### Figurenqualität

Die Figuren sollen erkennbare Menschen sein.

Sie brauchen mindestens:

- Kopf
- erkennbare Gesichtszüge
- Haare
- Oberkörper
- Hose / Beine
- Kleidung
- Arme
- einfache Walk Animation
- Idle Animation
- Working Animation

Keine gesichtslosen Rechtecke.

Keine primitiven Entwickler-Platzhalter, sofern die bestehende Rendering-Technik eine bessere Darstellung zulässt.

Stil:

- charmante moderne Pixel-Art / 2D-Tycoon-Ästhetik
- lesbar
- leicht humorvoll
- nicht hyperrealistisch
- nicht infantil

---

## 10. SICHTBARE STAND- UND GEBÄUDEENTWICKLUNG

Upgrades sollen nicht nur Zahlen verändern.

Sie sollen die Welt sichtbar verändern.

Beispiel Straßenwahlkampf:

**Level 1:**  
einfacher Tapeziertisch

↓

**Level 5:**  
ordentlicher Infostand

↓

**Level 10:**  
Pavillon / kleiner professioneller Stand

↓

**Level 20 oder 25:**  
großer professioneller Kampagnenstand

Die exakten Schwellen darfst du passend zur bestehenden Economy bestimmen.

Beim Upgrade sollen schrittweise sichtbare Dinge hinzukommen:

- größerer Tisch
- Pavillon
- Plakate
- Flyer
- Banner
- Beleuchtung
- zusätzliche Ausstattung
- Mitarbeiter
- Dekoration

Nicht alles gleichzeitig.

Der Fortschritt muss visuell klar lesbar sein.

---

## 11. WAHLKREISBÜRO

Rechts vom Straßenstand soll zunächst ein gesperrter Bereich sichtbar sein.

Beispiel:

`🔒 WAHLKREISBÜRO`

`Benötigt: 250 Unterstützer`

Die konkrete Zahl darfst du an die vorhandene Economy anpassen.

### Beim Freischalten

Es soll einen befriedigenden sichtbaren Übergang geben:

- kurze Build Animation
- Baustelle / Gerüst / Aufbau oder vergleichbare Darstellung
- Gebäude entsteht sichtbar
- Kamera darf leicht nach rechts führen
- anschließend beginnt dort ein neuer Produktionsprozess

Das Wahlkreisbüro soll **kein statisches Icon** sein.

Es ist ein echtes sichtbares Gebäude in der Welt.

Man soll beispielsweise durch Fenster Aktivität erkennen:

- Mitarbeiter am PC
- Telefon
- Papier
- Person läuft kurz durchs Büro
- Monitor
- Licht
- kleine Details

Die Animationen dürfen im Vertical Slice simpel sein.

Sie müssen aber vermitteln:

> Hier wird tatsächlich gearbeitet.

---

## 12. PRODUKTION

Jeder Standort besitzt einen klaren Produktionszyklus.

Beispiel:

### STRASSENWAHLKAMPF

`Flyer verteilen`

`████████░░`

`4.2 Sekunden`

→ `+ Unterstützer`

### WAHLKREISBÜRO

`Bürger erreichen / Kampagne organisieren`

`████████░░`

`12 Sekunden`

→ `+ Unterstützer / Einfluss`

Die genauen Ressourcen und Werte darfst du anhand des bestehenden Games sinnvoll vereinfachen.

### Wichtig

Keine unnötig komplizierte Multi-Currency-Economy in dieser Phase.

Das Spiel muss innerhalb weniger Sekunden verständlich sein.

---

## 13. AUTOMATION

Ein wichtiger Idle-Tycoon-Moment:

Am Anfang muss der Spieler eventuell selbst eine Aktion auslösen.

Dann kauft er den ersten Helfer.

Danach läuft der Prozess automatisch.

Dieser Moment soll sich deutlich anfühlen.

Der Spieler soll unmittelbar verstehen:

> Ich habe jemanden eingestellt. Jetzt arbeitet diese Person für mich.

Spätere Mitarbeiter können erhöhen:

- Geschwindigkeit
- Output
- Parallelisierung

Aber jede wichtige Automation soll visuell nachvollziehbar sein.

---

## 14. DIE ERSTEN FÜNF MINUTEN

Design die Economy so, dass die ersten fünf Minuten ungefähr dieses Erlebnis erzeugen:

`0:00`

kleiner Straßenstand

↓

erste Aktion

↓

erste Unterstützer

↓

erstes Upgrade

↓

erster Helfer

↓

Automation beginnt

↓

Stand entwickelt sich sichtbar

↓

Produktion wird schneller

↓

Spieler entdeckt rechts das gesperrte Wahlkreisbüro

↓

spart darauf

↓

Unlock

↓

sichtbare Build Animation

↓

neuer Bereich startet

Das ist der zentrale Vertical Slice.

Wenn diese fünf Minuten Spaß machen, funktioniert das Grundprinzip.

Achte deshalb besonders auf:

- kurze erste Belohnung
- verständliche Kosten
- sichtbare Verbesserung
- sinnvolle Beschleunigung
- klares nächstes Ziel
- möglichst wenig Leerlauf
- keine unnötige Komplexität

---

## 15. UI

Die UI soll wesentlich ruhiger werden.

Ich möchte nicht überall Panels, Boxen und Buttons.

Die Welt soll im Mittelpunkt stehen.

Permanent sichtbar reichen zunächst beispielsweise:

- `AMTSWEG`
- `Unterstützer: 124`
- `Einfluss: 8`
- ggf. später Geld

Die konkrete Ressourcenstruktur darfst du sinnvoll vereinfachen.

Gebäude-/Standortinformationen sollen möglichst kontextuell erscheinen:

- Standort anklicken
- kleines Upgrade-Panel
- klare Kosten
- klarer Effekt

Beispiel:

`STRASSENSTAND`  
`Level 4`

`+2 Unterstützer / Zyklus`

`[ Upgrade – 40 Unterstützer ]`

Keine riesigen Managementfenster.

---

## 16. ART DIRECTION

Die Grafik ist ein wichtiger Bestandteil des Gameplay-Feedbacks.

Orientierung:

- moderne Pixel-Art
- charmantes Tycoon Game
- klare Silhouetten
- angenehme Animationen
- leicht überzeichnet
- Deutschland visuell erkennbar
- urbane Entwicklung sichtbar
- hochwertige Browsergame-Anmutung
- konsistente Perspektive und Skalierung

Nicht:

- generische Entwickler-Platzhalter
- primitive Rechtecke mit Text als finale Lösung
- sterile Dashboard-Optik
- zufällige Asset-Mischung
- extrem detaillierter Realismus
- inkonsistente Figuren- und Gebäudegrößen

Nutze vorhandene Assets sinnvoll.

Wenn für den Vertical Slice neue einfache Assets erforderlich sind, implementiere sie konsistent mit dem bestehenden Stil und der vorhandenen technischen Lösung.

---

## 17. TIEFE UND PERSPEKTIVE

Sehr wichtig:

Die Progression soll nicht hauptsächlich „nach hinten“ in die Tiefe gehen.

Wir wollen keine Welt, bei der neue Gebäude immer weiter hinten platziert werden.

Die primäre Progressionsachse ist:

# LINKS → RECHTS

Natürlich darf die Szene räumliche Tiefe besitzen:

- Hintergrundgebäude
- Straße
- Bürgersteig
- Vordergrunddetails
- Bäume
- Laternen
- Fahrzeuge
- Skyline

Aber neue Gameplay-Standorte entstehen primär rechts vom vorherigen Standort.

---

## 18. TECHNISCHE PRIORITÄTEN

Bevor du größere Änderungen machst:

1. Repository und aktuelle Architektur vollständig prüfen.
2. Aktuellen Branch und `git status` prüfen.
3. Bestehenden Core Loop identifizieren.
4. Minimal notwendige Refactor-Grenze bestimmen.
5. Prüfen, welche bestehenden Systeme weiterverwendet werden können.
6. Keine vorhandene Arbeit verlieren.
7. Änderungen logisch und wartbar strukturieren.

Bevorzugt:

- deterministische Game State Machine
- Rendering getrennt von Economy
- Animationen reagieren auf Game State
- NPCs dürfen niemals Core Economy blockieren
- klar definierte Upgrade States
- klare Unlock Conditions
- Save State kompatibel halten oder sauber migrieren
- keine unnötigen Dependencies
- keine riesige Architektur für Features bauen, die wir noch nicht brauchen
- bestehende Architektur respektieren, sofern sie sinnvoll ist

---

## 19. PERFORMANCE

Da es ein Browsergame ist:

Keine unnötig teure Simulation.

Insbesondere keine komplexe Physik für Passanten.

NPCs dürfen visuell lebendig wirken, aber technisch simpel sein.

Die Architektur muss später mehrere gleichzeitig aktive Standorte ermöglichen.

Vermeide:

- unnötige permanente Re-Renders
- unkontrolliertes Spawning
- Memory Leaks
- dauerhaft laufende unnötige Timer
- überdimensionierte Physics-/Pathfinding-Systeme

---

## 20. RESPONSIVE DESIGN

Desktop ist aktuell Priorität.

Das Spiel sollte aber nicht so gebaut werden, dass Mobile später unmöglich wird.

Keine wichtigen Gameplay-Systeme ausschließlich auf Hover aufbauen.

---

## 21. WAS DU NICHT MACHEN SOLLST

Bitte NICHT:

- nur einen Plan schreiben
- nur Mockups erstellen
- nach jeder Kleinigkeit auf meine Freigabe warten
- den alten Flyer-Stau lediglich patchen
- fünf neue Menüs bauen
- sofort das komplette Endgame implementieren
- unnötig Backend-Infrastruktur hinzufügen
- das Projekt komplett neu schreiben, wenn vorhandene Systeme wiederverwendbar sind
- funktionierende Dinge ohne Grund entfernen
- `main` verändern
- visuelle Placeholder als „fertig“ betrachten
- die Economy von NPC-Kollisionen abhängig machen
- nach der Codeanalyse stoppen

---

## 22. ARBEITSWEISE

Arbeite selbstständig in folgenden Phasen:

### PHASE 1
Codebase analysieren.

### PHASE 2
Bestehenden Core Loop identifizieren und minimal notwendige Refactor-Grenze bestimmen.

### PHASE 3
Horizontale Welt implementieren.

### PHASE 4
Straßenwahlkampf neu bauen.

### PHASE 5
Robustes NPC-/Helfersystem implementieren.

### PHASE 6
Automation und Produktionszyklen implementieren.

### PHASE 7
Sichtbare Stand-Upgrades implementieren.

### PHASE 8
Wahlkreisbüro + Unlock + Build Animation implementieren.

### PHASE 9
UI vereinfachen und visuell aufräumen.

### PHASE 10
Game selbst lokal ausführen und testen.

### PHASE 11
Gefundene Fehler beheben.

### PHASE 12
Noch einmal vollständigen Gameplay-Test durchführen.

Arbeite dabei tatsächlich am Projekt.

Nicht nach Phase 1 aufhören und mir lediglich einen Bericht geben.

Wenn während der Implementierung kleinere Designentscheidungen erforderlich sind, triff sie eigenständig anhand der Prioritäten dieses Dokuments.

---

## 23. TESTKRITERIEN

Vor Abschluss musst du mindestens prüfen:

- Spiel startet ohne kritische Fehler
- bestehender Save State verursacht möglichst keinen Crash
- neuer Save funktioniert
- Straßenstand produziert korrekt
- manueller Start funktioniert, falls vorgesehen
- Helfer kann gekauft werden
- Helfer erscheint sichtbar
- Automation funktioniert
- NPCs laufen sauber
- NPCs verursachen keinen Stau
- NPCs bleiben nicht am Stand hängen
- NPCs bleiben nicht hinter Gebäuden hängen
- Produktionsfortschritt funktioniert unabhängig von NPCs
- Upgrades verändern Werte
- Upgrades verändern die Grafik sichtbar
- horizontales Scrollen/Panning funktioniert
- Spieler kann zurück nach links navigieren
- Wahlkreisbüro ist zunächst gesperrt
- Unlock-Bedingung funktioniert
- Ressourcen werden korrekt abgezogen
- Build Animation läuft
- Wahlkreisbüro erscheint
- dessen Produktion funktioniert
- Reload erhält relevanten Fortschritt
- Browser-Konsole enthält keine neuen kritischen Fehler
- keine offensichtlichen Regressionen in weiterhin benötigten bestehenden Systemen

Wenn etwas davon fehlschlägt:

**Fehler untersuchen und beheben, bevor du die Aufgabe als abgeschlossen meldest.**

---

## 24. DEFINITION OF DONE

Die Aufgabe ist NICHT abgeschlossen, wenn lediglich:

- Code geschrieben wurde
- ein Mockup existiert
- ein Konzept erstellt wurde
- NPCs irgendwie laufen
- zwei Gebäude auf dem Bildschirm stehen

Sie ist abgeschlossen, wenn ich das Spiel öffnen und einen nachvollziehbaren Loop spielen kann:

**kleiner Straßenstand → Aktionen → Unterstützer → Upgrade → Helfer → Automation → sichtbares Wachstum → nach rechts bewegen → Wahlkreisbüro freischalten → Gebäude wird gebaut → neuer Produktionsbereich läuft**

Das Ganze soll bereits wie der Anfang eines echten Idle-Tycoon-Games wirken.

---

## 25. ENTSCHEIDUNGSFREIHEIT

Du darfst eigenständig kleinere Designentscheidungen treffen, wenn sie notwendig sind.

Prioritäten bei Zielkonflikten:

1. Spielspaß
2. verständlicher Core Loop
3. sichtbares Progressionsgefühl
4. technische Robustheit
5. visuelle Qualität
6. Erweiterbarkeit
7. Feature-Menge

Lieber zwei sehr gute Bereiche als sechs halbfertige.

Lieber drei überzeugende Animationen als zwanzig bedeutungslose.

Lieber eine einfache funktionierende Economy als zehn Ressourcen.

---

## 26. ABSCHLUSS

Wenn die Implementierung fertig und getestet ist, gib mir einen kompakten Abschlussbericht mit:

- was konkret verändert wurde
- welche alten Mechaniken entfernt oder ersetzt wurden
- wie der neue Gameplay Loop funktioniert
- welche Dateien wesentlich verändert wurden
- welche Tests durchgeführt wurden
- bekannte verbleibende Probleme
- aktueller Git-Status
- aktueller Branch
- Commit-Status
- Empfehlung für den unmittelbar nächsten Entwicklungsschritt

## JETZT STARTEN

Beginne jetzt mit:

1. Branch und Git-Status prüfen.
2. Bestehende Codebase und Gameplay-Architektur analysieren.
3. Danach unmittelbar mit der Implementierung beginnen.
4. Das Ergebnis lokal ausführen und testen.
5. Gefundene Fehler selbst beheben.

**Nicht nur beraten. Nicht nach der Analyse stoppen. Baue den Vertical Slice.**
