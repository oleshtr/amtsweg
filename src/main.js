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
  helperField: $('[data-helper-field]'),
};
const integerFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const smallFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const moneyFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const format = value => (value < 100 ? smallFormat : integerFormat).format(value);
const cashFormat = value => moneyFormat.format(value);
let state = loadState();
let lastFrame = performance.now();
let lastSave = lastFrame;
let previousStage = null;
let lastRender = lastFrame;
let previousCheerTier = null;
let helperPulseIndex = 0;

function loadState() {
  try {
    const modern = localStorage.getItem(Game.CONFIG.saveKey);
    if (modern) return Game.normalizeState(JSON.parse(modern));
    const legacy = localStorage.getItem(Game.CONFIG.legacySaveKey);
    return legacy ? Game.normalizeState(JSON.parse(legacy)) : Game.createInitialState();
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

function pulseStation(name, milestone) {
  const room = $('.room--' + (name === 'helper' ? 'helpers' : name));
  room.classList.remove('room--level-pulse', 'room--milestone-pulse');
  void room.offsetWidth;
  room.classList.add(milestone ? 'room--milestone-pulse' : 'room--level-pulse');
  setTimeout(() => room.classList.remove('room--level-pulse', 'room--milestone-pulse'), milestone ? 700 : 340);
}

function showGain(amount, source) {
  const visual = Game.CONFIG.visual;
  const layer = $('[data-resource-burst-layer]');
  if (layer.querySelectorAll('.floating-gain').length < visual.maxFloatingTexts) {
    const gain = document.createElement('span');
    gain.className = 'floating-gain floating-gain--' + source;
    gain.textContent = '+' + smallFormat.format(amount) + ' Unterstützer';
    layer.appendChild(gain);
    setTimeout(() => gain.remove(), visual.flyerAnimationMs + 350);
  }
  if (layer.querySelectorAll('.flyer-recipient').length < visual.maxRecipients) {
    const recipient = document.createElement('span');
    recipient.className = 'flyer-recipient flyer-recipient--' + source;
    layer.appendChild(recipient);
    setTimeout(() => recipient.remove(), visual.flyerAnimationMs + 100);
  }
}

function flyerFeedback() {
  const visual = Game.CONFIG.visual;
  const button = elements.flyer;
  button.classList.remove('game-button--pressed');
  void button.offsetWidth;
  button.classList.add('game-button--pressed');
  clearTimeout(flyerFeedback.pressTimer);
  flyerFeedback.pressTimer = setTimeout(() => button.classList.remove('game-button--pressed'), visual.pressMs);
  const arm = $('[data-candidate] .actor__arm');
  if (arm.getAnimations().length < visual.maxArmAnimations) {
    arm.animate([
      { transform: 'rotate(0deg)' }, { transform: 'rotate(-55deg)', offset: 0.45 },
      { transform: 'rotate(0deg)' },
    ], { duration: visual.flyerAnimationMs, easing: 'steps(4, end)' });
  }
  const layer = $('[data-resource-burst-layer]');
  if (layer.querySelectorAll('.flyer-particle').length < visual.maxFlyerParticles) {
    const particle = document.createElement('span');
    particle.className = 'flyer-particle';
    particle.style.setProperty('--flyer-dx', Math.round(Math.random() * 90 - 45) + 'px');
    layer.appendChild(particle);
    setTimeout(() => particle.remove(), visual.flyerAnimationMs + 80);
  }
  showGain(Game.flyerOutput(), 'player');
  elements.supporterHud.classList.remove('hud-stat--pulse');
  void elements.supporterHud.offsetWidth;
  elements.supporterHud.classList.add('hud-stat--pulse');
}

function helperFeedback(amount) {
  const helpers = Array.from(document.querySelectorAll('.field-helper'));
  if (helpers.length) {
    const helper = helpers[helperPulseIndex % helpers.length];
    helperPulseIndex += 1;
    helper.classList.remove('field-helper--handoff');
    void helper.offsetWidth;
    helper.classList.add('field-helper--handoff');
    setTimeout(() => helper.classList.remove('field-helper--handoff'), 340);
  }
  if (state.standLevel) {
    const stand = $('.info-stand');
    stand.classList.remove('info-stand--working');
    void stand.offsetWidth;
    stand.classList.add('info-stand--working');
  }
  showGain(amount, 'helper');
}

function donationFeedback(amount) {
  if (amount <= 0) return;
  elements.scene.classList.remove('world--coin');
  void elements.scene.offsetWidth;
  elements.scene.classList.add('world--coin');
  const layer = $('[data-resource-burst-layer]');
  if (layer.querySelectorAll('.money-gain').length < 3) {
    const gain = document.createElement('span');
    gain.className = 'money-gain';
    gain.textContent = '+' + cashFormat(amount) + ' €';
    layer.appendChild(gain);
    setTimeout(() => gain.remove(), 900);
  }
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

function cheerCrowd() {
  const reaction = $('.crowd-reaction');
  reaction.style.setProperty('--cheer-duration', Game.CONFIG.visual.supporterCheerMs + 'ms');
  reaction.classList.remove('crowd-reaction--active');
  void reaction.offsetWidth;
  reaction.classList.add('crowd-reaction--active');
  setTimeout(() => reaction.classList.remove('crowd-reaction--active'), Game.CONFIG.visual.supporterCheerMs);
}

function renderVisibleHelpers() {
  const count = Math.max(0, Math.floor(state.helperLevel));
  while (elements.helperField.children.length < count) {
    const index = elements.helperField.children.length;
    const helper = document.createElement('div');
    helper.className = 'field-helper actor actor--helper';
    helper.dataset.helperNumber = String(index + 1);
    helper.setAttribute('aria-hidden', 'true');
    helper.innerHTML = '<div class="actor__cap"></div><div class="actor__head"></div><div class="actor__body"></div><div class="actor__legs"></div><div class="helper__flyers"></div>';

    const column = index % 6;
    const row = Math.floor(index / 6);
    const direction = index % 2 === 0 ? 1 : -1;
    helper.style.left = (43 + column * 7.2) + '%';
    helper.style.bottom = (69 + row * 8) + 'px';
    helper.style.setProperty('--helper-scale', row >= 2 ? '.68' : row >= 1 ? '.75' : '.82');
    helper.style.setProperty('--helper-distance-a', (direction * (22 + (index % 3) * 5)) + 'px');
    helper.style.setProperty('--helper-distance-b', (direction * (44 + (index % 3) * 8)) + 'px');
    helper.style.setProperty('--helper-delay', (-index * .47) + 's');
    helper.style.setProperty('--helper-duration', Math.max(3.2, 7.2 - Math.min(index, 10) * .18) + 's');
    elements.helperField.appendChild(helper);
  }
  while (elements.helperField.children.length > count) {
    elements.helperField.lastElementChild.remove();
  }
}

function renderStation(name, level, unlocked) {
  const build = $('[data-build="' + name + '"]');
  const buy = $('[data-action="' + name + '"]');
  const upgrade = $('[data-upgrade="' + name + '"]');
  build.hidden = !unlocked || level > 0 || state.electionFinished;
  buy.disabled = !Game.canBuy(state, name);
  $('[data-' + name + '-cost]').textContent = name === 'helper' ?
    'AB ' + Game.CONFIG.helper.unlockSupporters + ' ★ · GRATIS' : Game.stationCost(name, 0) + ' €';
  upgrade.disabled = !Game.canBuy(state, name);
  $('[data-' + name + '-level]').textContent = level;
  if (name === 'helper') {
    $('[data-helper-upgrade-label]').textContent = !Game.unlocks(state).cash ?
      'KASSE AB ' + Game.CONFIG.cashUnlockSupporters + ' ★' :
      '↑ ' + Game.stationCost(name, level) + ' €';
  } else {
    $('[data-' + name + '-upgrade-cost]').textContent = Game.stationCost(name, level);
  }
}

function render() {
  const unlocked = Game.unlocks(state);
  const stage = Game.worldStage(state);
  const bottleneck = Game.bottlenecks(state);
  elements.scene.dataset.stage = String(stage);
  elements.scene.dataset.helperTier = state.helperLevel >= 20 ? '20' : state.helperLevel >= 10 ? '10' : state.helperLevel >= 5 ? '5' : '1';
  elements.scene.dataset.standTier = state.standLevel >= 20 ? '20' : state.standLevel >= 10 ? '10' : state.standLevel >= 5 ? '5' : '1';
  elements.scene.dataset.officeTier = state.officeLevel >= 20 ? '20' : state.officeLevel >= 10 ? '10' : state.officeLevel >= 5 ? '5' : '1';
  elements.scene.dataset.supporterTier = state.supporters >= 50 ? '50' :
    state.supporters >= 25 ? '25' : state.supporters >= 10 ? '10' : '0';
  elements.scene.classList.toggle('world--office-jam', bottleneck.office);
  elements.scene.style.setProperty('--helper-route-duration',
    Math.max(1.1, 3 / Math.max(Game.helperRate(state), 0.001)) + 's');
  elements.supporters.textContent = format(state.supporters);
  elements.euros.textContent = cashFormat(state.euros);
  elements.supportRate.textContent = state.helperLevel ? '+' + format(Game.supporterRate(state) * 60) + '/min' : '';
  elements.cashRate.textContent = unlocked.cash ?
    'Nächste Spende in ' + Game.supportersUntilDonation(state) + ' ★' : '';
  elements.cashHud.hidden = !unlocked.cash;
  $('.game-hud').classList.toggle('game-hud--compact', !unlocked.cash);
  elements.flyer.disabled = state.electionFinished;
  elements.flyer.querySelector('small').textContent = '+1 Unterstützer · sofort';
  renderVisibleHelpers();
  renderStation('helper', state.helperLevel, unlocked.helper);
  renderStation('stand', state.standLevel, unlocked.stand);
  renderStation('office', state.officeLevel, unlocked.office);
  $('[data-helper-rate]').textContent = format(Game.supporterRate(state) * 60) + ' Unterstützer/min';
  $('[data-stand-rate]').textContent = '×' + smallFormat.format(Game.supporterConversionMultiplier(state)) + ' Helfer-Ertrag';
  $('[data-office-rate]').textContent = cashFormat(Game.donationValue(state)) + ' € je Spende';
  $('[data-helper-count]').textContent = state.helperLevel;
  elements.progress.hidden = stage < 5;
  $('[data-control-deck]').classList.toggle('control-deck--election', stage >= 5);
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
    bottleneck.office ? 'Das Ortsbüro erreicht seine Spendenkapazität.' :
    stage >= 4 ? 'Das Ortsbüro organisiert die Spenden.' :
    stage >= 3 ? 'Der Infostand verstärkt die Helferarbeit.' :
    stage >= 2 ? 'Je 10 neue Unterstützer kommt sichtbar eine Spende.' :
    stage >= 1 ? 'Dein Helfer verteilt sichtbar Flyer und gewinnt Unterstützer.' :
      'Verteile Flyer. Ab 25 Unterstützern kannst du einen Helfer anwerben.';
  if (previousStage !== null && stage > previousStage) {
    flashScene();
    if (stage === 6) confetti();
  }
  const cheerTier = Math.floor(state.supporters / Game.CONFIG.visual.supporterCheerStep);
  if (previousCheerTier !== null && cheerTier > previousCheerTier && !state.electionFinished) cheerCrowd();
  previousCheerTier = cheerTier;
  previousStage = stage;
  lastRender = performance.now();
}

function purchase(name) {
  const before = state[name + 'Level'];
  state = Game.buyStation(state, name);
  if (state[name + 'Level'] > before) {
    render();
    if (before > 0) pulseStation(name, Game.CONFIG[name].milestones.includes(state[name + 'Level']));
    saveState();
    toast(name === 'helper' ?
      'Helfer #' + state.helperLevel + ' ist jetzt sichtbar unterwegs.' :
      (name === 'stand' ? 'Infostand' : 'Ortsbüro') + ' · Level ' + state[name + 'Level']);
  }
}

elements.flyer.addEventListener('click', () => {
  if (state.electionFinished) return;
  const beforeEuros = state.euros;
  state = Game.distributeFlyer(state);
  render();
  flyerFeedback();
  if (state.euros > beforeEuros) donationFeedback(state.euros - beforeEuros);
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
  previousCheerTier = null;
  helperPulseIndex = 0;
  elements.helperField.replaceChildren();
  render();
  saveState();
  toast('Neuer Spielstand gestartet.');
});

function frame(now) {
  const delta = Math.min(1, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  const beforeSupporters = state.supporters;
  const beforeEuros = state.euros;
  if (!state.electionFinished) {
    state = Game.tick(state, delta);
    if (state.helperLevel && state.supporters > beforeSupporters) {
      helperFeedback(state.supporters - beforeSupporters);
    }
    if (state.euros > beforeEuros) donationFeedback(state.euros - beforeEuros);
    if (now - lastRender >= Game.CONFIG.tickMs &&
      (state.supporters !== beforeSupporters || state.euros !== beforeEuros)) render();
  }
  if (now - lastSave > Game.CONFIG.saveMs) saveState();
  requestAnimationFrame(frame);
}

render();
requestAnimationFrame(() => elements.scene.classList.add('world--ready'));
requestAnimationFrame(frame);
window.addEventListener('beforeunload', saveState);
