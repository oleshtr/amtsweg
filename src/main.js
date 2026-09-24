'use strict';

const Game = window.AmtswegGame;
const $ = selector => document.querySelector(selector);
const elements = {
  scene: $('[data-scene]'), supporters: $('[data-supporters]'),
  euros: $('[data-euros]'), cashHud: $('[data-euro-stat]'),
  supportRate: $('[data-rate]'), cashRate: $('[data-cash-rate]'),
  flyer: $('[data-action="flyer"]'), progress: $('[data-chapter-progress]'),
  percent: $('[data-election-percent]'), bar: $('[data-election-bar]'),
  electionMini: $('[data-election-mini]'), election: $('[data-action="election"]'),
  electionCost: $('[data-election-cost]'), ending: $('[data-ending]'),
  status: $('[data-status-copy]'), toast: $('[data-toast]'),
  reset: $('[data-action="reset"]'), supporterHud: $('[data-supporter-stat]'),
};
const format = value => new Intl.NumberFormat('de-DE', { maximumFractionDigits: value < 100 ? 1 : 0 }).format(value);
const cashFormat = value => new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
let state = loadState();
let lastFrame = performance.now();
let lastSave = lastFrame;
let previousStage = null;
let previousLevels = null;
let lastCoin = 0;

function loadState() {
  try {
    const modern = localStorage.getItem(Game.CONFIG.saveKey);
    if (modern) return Game.completeFlyer(Game.normalizeState(JSON.parse(modern)));
    const legacy = localStorage.getItem(Game.CONFIG.legacySaveKey);
    return legacy ? Game.completeFlyer(Game.normalizeState(JSON.parse(legacy))) : Game.createInitialState();
  } catch {
    return Game.createInitialState();
  }
}

function saveState() {
  try {
    localStorage.setItem(Game.CONFIG.saveKey, JSON.stringify(state));
    lastSave = performance.now();
  } catch {
    // The game remains playable when storage is unavailable.
  }
}

function toast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('toast--visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => elements.toast.classList.remove('toast--visible'), 2000);
}

function flashScene() {
  elements.scene.classList.remove('world--stage-reveal');
  void elements.scene.offsetWidth;
  elements.scene.classList.add('world--stage-reveal');
  setTimeout(() => elements.scene.classList.remove('world--stage-reveal'), 700);
}

function confetti() {
  const layer = $('[data-resource-burst-layer]');
  for (let i = 0; i < 20; i += 1) {
    const bit = document.createElement('span');
    bit.className = 'confetti-bit';
    bit.style.left = Math.random() * 100 + '%';
    bit.style.animationDelay = Math.random() * 0.5 + 's';
    bit.style.setProperty('--drift', Math.round(Math.random() * 120 - 60) + 'px');
    layer.appendChild(bit);
    bit.addEventListener('animationend', () => bit.remove(), { once: true });
  }
}

function renderStation(name, level, unlocked) {
  const build = $('[data-build="' + name + '"]');
  const buy = $('[data-action="' + name + '"]');
  const upgrade = $('[data-upgrade="' + name + '"]');
  build.hidden = !unlocked || level > 0 || state.electionFinished;
  buy.disabled = !Game.canBuy(state, name);
  $('[data-' + name + '-cost]').textContent = Game.stationCost(name, 0) + ' €';
  upgrade.disabled = !Game.canBuy(state, name);
  $('[data-' + name + '-level]').textContent = level;
  $('[data-' + name + '-upgrade-cost]').textContent = Game.stationCost(name, level);
}

function render() {
  const unlocked = Game.unlocks(state);
  const stage = Game.worldStage(state);
  const bottleneck = Game.bottlenecks(state);
  const levels = [state.helperLevel, state.standLevel, state.officeLevel];
  elements.scene.dataset.stage = String(stage);
  elements.scene.dataset.helperTier = state.helperLevel >= 20 ? '20' : state.helperLevel >= 10 ? '10' : state.helperLevel >= 5 ? '5' : '1';
  elements.scene.dataset.standTier = state.standLevel >= 20 ? '20' : state.standLevel >= 10 ? '10' : state.standLevel >= 5 ? '5' : '1';
  elements.scene.dataset.officeTier = state.officeLevel >= 20 ? '20' : state.officeLevel >= 10 ? '10' : state.officeLevel >= 5 ? '5' : '1';
  elements.scene.classList.toggle('world--stand-jam', bottleneck.stand);
  elements.scene.classList.toggle('world--office-jam', bottleneck.office);
  elements.scene.classList.toggle('world--flyer-cycle', Boolean(state.flyerEndsAt));
  elements.supporters.textContent = format(state.supporters);
  elements.euros.textContent = cashFormat(state.euros);
  elements.supportRate.textContent = state.helperLevel ? '+' + format(Game.supporterRate(state) * 60) + '/min' : '';
  elements.cashRate.textContent = unlocked.cash ? '+' + cashFormat(Game.euroRate(state)) + ' €/s' : '';
  elements.cashHud.hidden = !unlocked.cash;
  $('.game-hud').classList.toggle('game-hud--compact', !unlocked.cash);
  elements.reset.hidden = stage === 0;
  elements.flyer.disabled = Boolean(state.flyerEndsAt) || state.electionFinished;
  elements.flyer.querySelector('small').textContent = state.flyerEndsAt ? 'Übergabe läuft …' : '+1 Unterstützer';
  renderStation('helper', state.helperLevel, unlocked.helper);
  renderStation('stand', state.standLevel, unlocked.stand);
  renderStation('office', state.officeLevel, unlocked.office);
  $('[data-helper-rate]').textContent = format(Game.helperRate(state) * 60) + ' Kontakte/min';
  $('[data-stand-rate]').textContent = format(Game.standCapacity(state) * 60) + ' Kapazität/min';
  $('[data-office-rate]').textContent = cashFormat(Game.euroRate(state)) + ' €/s';
  $('[data-helper-count]').textContent = state.helperLevel;
  elements.progress.hidden = stage < 5;
  const percent = Math.min(100, Math.floor(100 * Math.min(
    state.supporters / Game.CONFIG.election.targetSupporters,
    state.euros / Game.CONFIG.election.entryCost,
  )));
  elements.percent.textContent = percent;
  elements.bar.style.width = percent + '%';
  elements.electionCost.textContent = Game.CONFIG.election.entryCost;
  elements.election.disabled = !Game.canRunElection(state);
  elements.electionMini.textContent = state.electionFinished ? 'Kapitelziel erreicht.' :
    'Noch ' + Math.max(0, Math.ceil(Game.CONFIG.election.targetSupporters - state.supporters)) +
    ' Unterstützer und ' + Math.max(0, Math.ceil(Game.CONFIG.election.entryCost - state.euros)) + ' €';
  elements.ending.hidden = !state.electionFinished;
  elements.status.textContent = state.electionFinished ? 'Kommunalwahl geschafft!' :
    stage >= 5 ? 'NÄCHSTES ZIEL: KOMMUNALWAHL' :
    bottleneck.stand ? 'Passanten warten am Infostand.' :
    bottleneck.office ? 'Im Ortsbüro stauen sich Spenden.' :
    stage >= 4 ? 'Das Ortsbüro organisiert die Spenden.' :
    stage >= 3 ? 'Der Infostand verarbeitet Kontakte.' :
    stage >= 2 ? 'Dein Helferteam verteilt Flyer.' :
    stage >= 1 ? 'Die Wahlkampfkasse füllt sich automatisch.' : '';
  if (previousStage !== null && stage > previousStage) {
    flashScene();
    if (stage === 6) confetti();
  } else if (previousLevels && levels.some((value, i) => value > previousLevels[i])) {
    flashScene();
  }
  previousStage = stage;
  previousLevels = levels;
}

function purchase(name) {
  const before = state[name + 'Level'];
  state = Game.buyStation(state, name);
  if (state[name + 'Level'] > before) {
    render();
    saveState();
    toast((name === 'helper' ? 'Helferteam' : name === 'stand' ? 'Infostand' : 'Ortsbüro') +
      ' · Level ' + state[name + 'Level']);
  }
}

elements.flyer.addEventListener('click', () => {
  if (state.flyerEndsAt || state.electionFinished) return;
  elements.scene.style.setProperty('--flyer-delay', '0ms');
  state = Game.startFlyer(state);
  render();
  saveState();
});
for (const name of ['helper', 'stand', 'office']) {
  $('[data-action="' + name + '"]').addEventListener('click', () => purchase(name));
  $('[data-upgrade="' + name + '"]').addEventListener('click', () => purchase(name));
}
elements.election.addEventListener('click', () => {
  if (!Game.canRunElection(state)) return;
  state = Game.runElection(state);
  render();
  saveState();
  toast('Kommunalwahl geschafft!');
});
elements.reset.addEventListener('click', () => {
  if (!window.confirm('Spielstand wirklich zurücksetzen?')) return;
  localStorage.removeItem(Game.CONFIG.saveKey);
  localStorage.removeItem(Game.CONFIG.legacySaveKey);
  state = Game.createInitialState();
  previousStage = null;
  previousLevels = null;
  render();
  saveState();
  toast('Neuer Spielstand gestartet.');
});

function frame(now) {
  const delta = Math.min(1, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  const beforeSupporters = state.supporters;
  const beforeFlyer = state.flyerEndsAt;
  if (!state.electionFinished) {
    state = Game.tick(state, delta);
    if (state.flyerEndsAt !== beforeFlyer || state.supporters !== beforeSupporters || Game.euroRate(state)) render();
  }
  if (Game.euroRate(state) && now - lastCoin > 5000) {
    elements.scene.classList.remove('world--coin');
    void elements.scene.offsetWidth;
    elements.scene.classList.add('world--coin');
    lastCoin = now;
  }
  if (now - lastSave > Game.CONFIG.saveMs) saveState();
  requestAnimationFrame(frame);
}

if (state.flyerEndsAt) {
  const elapsed = Math.max(0, Game.CONFIG.flyerDurationMs - (state.flyerEndsAt - Date.now()));
  elements.scene.style.setProperty('--flyer-delay', '-' + elapsed + 'ms');
}
render();
requestAnimationFrame(() => elements.scene.classList.add('world--ready'));
requestAnimationFrame(frame);
window.addEventListener('beforeunload', saveState);
