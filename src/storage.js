(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AmtswegStorage = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  function load(storage, game, now = Date.now()) {
    let state = game.createInitialState(), note = '', writable = true;
    try {
      const current = storage.getItem(game.CONFIG.saveKey);
      const raw = current || storage.getItem(game.CONFIG.legacyKey);
      if (raw) {
        let parsed;
        try { parsed = JSON.parse(raw); }
        catch {
          storage.setItem(game.CONFIG.saveKey + '-recovery', raw);
          note = 'Beschädigter Spielstand gesichert. Ein neuer Anfang ist bereit.';
        }
        if (parsed && typeof parsed === 'object') {
          if (parsed.version > game.CONFIG.version) {
            return { state, note: 'Dieser Spielstand stammt aus einer neueren Version. Speichern ist deaktiviert.', writable: false };
          }
          state = game.normalizeState(parsed);
          if (!current) note = 'Spielstand übernommen: Die alte Wahlkampfkasse wurde in Unterstützer umgewandelt.';
          const before = state.supporters;
          state = game.tick(state, Math.max(0, (now - state.savedAt) / 1000));
          if (state.supporters > before) note += `${note ? ' ' : ''}Dein Team hat inzwischen ${Math.floor(state.supporters-before)} Unterstützer gewonnen.`;
        }
      }
    } catch { note = 'Lokales Speichern ist nicht verfügbar. Dein Spiel läuft in dieser Sitzung weiter.'; writable = false; }
    state.savedAt = now;
    return { state, note, writable };
  }
  function save(storage, game, state, now = Date.now()) {
    try {
      storage.setItem(game.CONFIG.saveKey, JSON.stringify({ ...state, savedAt: now }));
      return true;
    } catch { return false; }
  }
  return { load, save };
});
