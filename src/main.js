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
  contactBuffer: $('[data-contact-buffer]'),
};
const integerFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const smallFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const outputFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const moneyFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const format = value => (value < 100 ? smallFormat : integerFormat).format(value);
const cashFormat = value => moneyFormat.format(value);
let state = loadState();
let lastFrame = performance.now();
let lastSave = lastFrame;
let previousStage = null;
let lastCoin = 0;
let lastRender = lastFrame;
let reactionIndex = 0;
let previousCheerTier = null;

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
  if (name === 'campaign') {
    const point = $('.campaign-point');
    point.classList.remove('campaign-point--level-pulse', 'campaign-point--milestone-pulse');
    void point.offsetWidth;
    point.classList.add(milestone ? 'campaign-point--milestone-pulse' : 'campaign-point--level-pulse');
    setTimeout(() => point.classList.remove('campaign-point--level-pulse', 'campaign-point--milestone-pulse'), milestone ? 700 : 340);
    return;
  }
  const room = $('.room--' + (name === 'helper' ? 'helpers' : name));
  room.classList.remove('room--level-pulse', 'room--milestone-pulse');
  void room.offsetWidth;
  room.classList.add(milestone ? 'room--milestone-pulse' : 'room--level-pulse');
  setTimeout(() => room.classList.remove('room--level-pulse', 'room--milestone-pulse'), milestone ? 700 : 340);
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
  const passers = document.querySelectorAll('.passer');
  if (passers.length && [...passers].reduce((count, passer) => count + passer.getAnimations().length, 0) < visual.maxPasserAnimations) {
    const passer = passers[reactionIndex++ % passers.length];
    passer.animate([
      { filter: 'brightness(1)' }, { filter: 'brightness(1.6)', offset: 0.5 },
      { filter: 'brightness(1)' },
    ], { duration: visual.reactionMs, easing: 'steps(2, end)' });
  }
  const layer = $('[data-resource-burst-layer]');
  if (layer.querySelectorAll('.flyer-particle').length < visual.maxFlyerParticles) {
    const particle = document.createElement('span');
    particle.className = 'flyer-particle';
    particle.style.setProperty('--flyer-dx', Math.round(Math.random() * 90 - 45) + 'px');
    layer.appendChild(particle);
    setTimeout(() => particle.remove(), visual.flyerAnimationMs + 80);
  }
  const campaignControl = $('[data-upgrade="campaign"]');
  campaignControl.classList.remove('campaign-control--contact');
  void campaignControl.offsetWidth;
  campaignControl.classList.add('campaign-control--contact');
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
  elements.scene.dataset.stage = String(stage);
  elements.scene.dataset.campaignTier = state.campaignLevel >= 20 ? '20' :
    state.campaignLevel >= 10 ? '10' : state.campaignLevel >= 5 ? '5' :
      state.campaignLevel >= 3 ? '3' : state.campaignLevel >= 2 ? '2' : '1';
  elements.scene.dataset.helperTier = state.helperLevel >= 20 ? '20' : state.helperLevel >= 10 ? '10' : state.helperLevel >= 5 ? '5' : '1';
  elements.scene.dataset.standTier = state.standLevel >= 20 ? '20' : state.standLevel >= 10 ? '10' : state.standLevel >= 5 ? '5' : '1';
  elements.scene.dataset.officeTier = state.officeLevel >= 20 ? '20' : state.officeLevel >= 10 ? '10' : state.officeLevel >= 5 ? '5' : '1';
  elements.scene.classList.toggle('world--campaign-jam', bottleneck.campaign);
  elements.scene.classList.toggle('world--stand-jam', bottleneck.stand);
  elements.scene.classList.toggle('world--office-jam', bottleneck.office);
  elements.scene.dataset.queueTier = state.contacts >= 12 ? '3' :
    state.contacts >= 6 ? '2' : state.contacts >= 1 ? '1' : '0';
  elements.scene.style.setProperty('--helper-route-duration',
    Math.max(Game.CONFIG.helper.minVisualCycleSeconds,
      Game.CONFIG.helper.visualContactsPerCycle / Math.max(Game.helperRate(state), 0.001)) + 's');
  elements.supporters.textContent = format(state.supporters);
  elements.euros.textContent = cashFormat(state.euros);
  elements.supportRate.textContent = state.helperLevel ? '+' + format(Game.supporterRate(state) * 60) + '/min' : '';
  elements.cashRate.textContent = unlocked.cash ? '+' + cashFormat(Game.euroRate(state)) + ' €/s' : '';
  elements.cashHud.hidden = !unlocked.cash;
  $('.game-hud').classList.toggle('game-hud--compact', !unlocked.cash);
  elements.flyer.disabled = state.electionFinished;
  elements.flyer.querySelector('small').textContent = '+' + outputFormat.format(Game.flyerOutput(state)) + ' Kontakt · sofort';
  const campaign = Game.CONFIG.campaign;
  const campaignButton = $('[data-upgrade="campaign"]');
  const nextCampaignLevel = state.campaignLevel + 1;
  campaignButton.disabled = !Game.canBuy(state, 'campaign');
  $('[data-campaign-level]').textContent = state.campaignLevel;
  $('[data-campaign-output]').textContent = outputFormat.format(Game.campaignCapacity(state)) + ' Kontakte/s Verarbeitung';
  elements.contactBuffer.textContent = Math.ceil(state.contacts) + ' warten';
  $('[data-campaign-next]').textContent = nextCampaignLevel <= campaign.freeThroughLevel ?
    '↑ KOSTENLOS · AB ' + campaign.freeSupporters[nextCampaignLevel] + ' ★' :
    !unlocked.cash ? '↑ KASSE AB ' + Game.CONFIG.cashUnlockSupporters + ' ★' :
      '↑ ' + cashFormat(Game.stationCost('campaign', state.campaignLevel)) + ' €';
  renderStation('helper', state.helperLevel, unlocked.helper);
  const helperShortfall = Math.max(0, Game.stationCost('helper', 0) - state.euros);
  $('[data-helper-progress]').style.width = Math.min(100, state.euros / Game.stationCost('helper', 0) * 100) + '%';
  $('[data-helper-shortfall]').textContent = helperShortfall > 0 ?
    'Noch ' + cashFormat(helperShortfall) + ' €' : 'Bereit!';
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
    bottleneck.office ? 'Im Ortsbüro stauen sich Spenden.' :
    bottleneck.campaign ? 'Am Kampagnenplatz warten Kontakte auf Verarbeitung.' :
    bottleneck.stand ? 'Passanten warten am Infostand.' :
    stage >= 4 ? 'Das Ortsbüro organisiert die Spenden.' :
    stage >= 3 ? 'Der Infostand verarbeitet Kontakte.' :
    stage >= 2 ? 'Dein Helferteam verteilt Flyer.' :
    stage >= 1 && !state.helperLevel && !unlocked.helper ?
      'Helfer ab Kampagnenplatz LV ' + Game.CONFIG.helper.unlockCampaignLevel +
      ' und ' + Game.CONFIG.helper.unlockSupporters + ' Unterstützern.' :
    stage >= 1 && !state.helperLevel ? 'Der erste Helfer wartet auf die Wahlkampfkasse.' :
      'Baue deinen Kampagnenplatz aus.';
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
    toast((name === 'campaign' ? 'Kampagnenplatz' : name === 'helper' ? 'Helferteam' : name === 'stand' ? 'Infostand' : 'Ortsbüro') +
      ' · Level ' + state[name + 'Level']);
  }
}

elements.flyer.addEventListener('click', () => {
  if (state.electionFinished) return;
  state = Game.distributeFlyer(state);
  render();
  flyerFeedback();
});
for (const name of ['campaign', 'helper', 'stand', 'office']) {
  if (name !== 'campaign') $('[data-action="' + name + '"]').addEventListener('click', () => purchase(name));
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
  render();
  saveState();
  toast('Neuer Spielstand gestartet.');
});

function frame(now) {
  const delta = Math.min(1, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  const beforeSupporters = state.supporters;
  const beforeContacts = state.contacts;
  const beforeEuros = state.euros;
  if (!state.electionFinished) {
    state = Game.tick(state, delta);
    if (now - lastRender >= Game.CONFIG.tickMs &&
      (state.supporters !== beforeSupporters || state.contacts !== beforeContacts ||
        state.euros !== beforeEuros)) render();
  }
  if (state.fundraisingBuffer > 0 && Game.euroRate(state) &&
      now - lastCoin > Game.CONFIG.visual.coinIntervalMs) {
    elements.scene.classList.remove('world--coin');
    void elements.scene.offsetWidth;
    elements.scene.classList.add('world--coin');
    lastCoin = now;
  }
  if (now - lastSave > Game.CONFIG.saveMs) saveState();
  requestAnimationFrame(frame);
}

render();
requestAnimationFrame(() => elements.scene.classList.add('world--ready'));
requestAnimationFrame(frame);
window.addEventListener('beforeunload', saveState);
