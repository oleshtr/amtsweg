# AMTSWEG

AMTSWEG ist ein kleines browserbasiertes Pixel-Art Idle-/Incremental-Game in einer **fiktionalen politischen Welt innerhalb eines deutschen Settings**.

## V0.1

Der erste Build konzentriert sich ausschließlich auf den ersten befriedigenden Gameplay-Loop:

**Flyer verteilen → Unterstützer → Spenden → Wahlkampfhelfer → Infostand → Ortsbüro → erste Kommunalwahl**

Noch keine realen Parteien, kein Backend, kein Login, keine Cloud-Saves und keine komplexe Politiksimulation.

## Lokal starten

Es gibt keine Runtime-Abhängigkeiten und keinen Build-Schritt.

```bash
python -m http.server 8080
```

Danach `http://localhost:8080` öffnen.

Der Spielstand wird in `localStorage` gespeichert.

## Qualität prüfen

Node.js 18+ genügt:

```bash
npm run check
npm test
```

GitHub Actions/CI sind für dieses Projekt nicht erforderlich.

## Struktur

- `index.html` – UI und Spielszene
- `styles.css` – Pixel-Art-Look und Layout
- `src/game.js` – testbare Spiellogik + zentrale Balancing-Konfiguration
- `src/main.js` – Browser-Rendering, Eingaben und Autosave
- `tests/game.test.js` – Kernloop-Tests mit dem eingebauten Node-Test-Runner
