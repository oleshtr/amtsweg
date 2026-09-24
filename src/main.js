'use strict';

const Game = window.AmtswegGame;
const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));
const integerFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const moneyFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const formatNumber = value => value < 100 ? oneDecimal.format(value) : integerFormat.format(value);
const formatMoney = value => moneyFormat.format(value);

const elements = {
  scene: $('[data-scene]'), operations: $('[data-operations]'),
  supporters: $('[data-supporters]'), euros: $('[data-euros]'),
  supporterHud: $('[data-supporter-stat]'), cashHud: $('[data-euro-stat]'),
  supportRate: $('[data-rate]'), cashRate: $('[data-cash-rate]'),
  district: $('[data-district]'), careerBonus: $('[data-career-bonus]'),
  flyer: $('[data-action="flyer"]'), flyerCopy: $('[data-flyer-copy]'), manualCooldown: $('[data-manual-cooldown]'),
  helperField: $('[data-helper-field]'), helperOverflow: $('[data-helper-overflow]'),
  progress: $('[data-chapter-progress]'), percent: $('[data-election-percent]'),
  bar: $('[data-election-bar]'), electionMini: $('[data-election-mini]'),
  election: $('[data-action="election"]'), electionCost: $('[data-election-cost]'),
  ending: $('[data-ending]'), electionReward: $('[data-election-reward]'),
  endingBonus: $('[data-ending-bonus]'), nextDistrict: $('[data-action="next-district"]'),
  status: $('[data-status-copy]'), toast: $('[data-toast]'), reset: $('[data-action="reset"]'),
  burstLayer: $('[data-resource-burst-layer]'),
};

function loadState() {
  try {
    let source = null;
    const modern = localStorage.getItem(Game.CONFIG.saveKey);
    if (modern) source = JSON.parse(modern);
    if (!source) {
      for (const key of Game.CONFIG.legacySaveKeys) {
        const legacy = localStorage.getItem(key);
        if (legacy) { source = JSON.parse(legacy); break; }
      }
    }
    if (!source) return { state: Game.createInitialState(), offline: null };
    const normalized = Game.normalizeState(source);
    const offline = Game.applyOfflineProgress(normalized);
    return { state: offline.state, offline };
  } catch {
    return { state: Game.createInitialState(), offline: null };
  }
}

const loaded = loadState();
let state = loaded.state;
let lastFrame = performance.now();
let lastRender = lastFrame;
let lastSave = lastFrame;
let previousStage = null;
let previousSupporterHundred = Math.floor(state.supporters / 100);
let helperPulseIndex = 0;
let manualRecipientSide = 0;

function saveState() {
  try {
    localStorage.setItem(Game.CONFIG.saveKey, JSON.stringify(state));
    lastSave = performance.now();
  } catch {
    // Local storage can be unavailable in private contexts; gameplay remains functional.
  }
}

function toast(message, duration = 2200) {
  elements.toast.textContent = message;
  elements.toast.classList.add('toast--visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => elements.toast.classList.remove('toast--visible'), duration);
}

function flashScene() {
  elements.scene.classList.remove('world--stage-reveal');
  void elements.scene.offsetWidth;
  elements.scene.classList.add('world--stage-reveal');
  setTimeout(() => elements.scene.classList.remove('world--stage-reveal'), 720);
}

function showGain(text, source) {
  const gain = document.createElement('span');
  gain.className = 'v03-gain v03-gain--' + source;
  gain.textContent = text;
  elements.burstLayer.appendChild(gain);
  setTimeout(() => gain.remove(), 920);
}

function spawnRecipient(source) {
  const recipient = document.createElement('span');
  recipient.className = 'production-recipient production-recipient--' + source;
  if (source === 'manual') {
    recipient.classList.add(manualRecipientSide % 2 ? 'production-recipient--right' : 'production-recipient--left');
    manualRecipientSide += 1;
  }
  recipient.innerHTML = '<i></i><b></b>';
  elements.burstLayer.appendChild(recipient);
  setTimeout(() => recipient.remove(), 820);
}

function manualFeedback(amount) {
  elements.flyer.classList.remove('game-button--pressed');
  void elements.flyer.offsetWidth;
  elements.flyer.classList.add('game-button--pressed');
  setTimeout(() => elements.flyer.classList.remove('game-button--pressed'), 150);

  const arm = $('[data-candidate] .actor__arm');
  if (arm) {
    arm.animate([
      { transform: 'rotate(0deg)' },
      { transform: 'rotate(-58deg)', offset: .42 },
      { transform: 'rotate(-28deg)', offset: .65 },
      { transform: 'rotate(0deg)' },
    ], { duration: 560, easing: 'steps(5, end)' });
  }
  const flyer = document.createElement('span');
  flyer.className = 'v03-flyer';
  elements.burstLayer.appendChild(flyer);
  setTimeout(() => flyer.remove(), 650);
  spawnRecipient('manual');
  showGain('+' + formatNumber(amount) + ' ★', 'manual');
  elements.supporterHud.classList.remove('hud-stat--pulse');
  void elements.supporterHud.offsetWidth;
  elements.supporterHud.classList.add('hud-stat--pulse');
}

function helperFeedback(amount) {
  const helpers = $$('.field-helper');
  if (helpers.length) {
    const helper = helpers[helperPulseIndex % helpers.length];
    helperPulseIndex += 1;
    helper.classList.remove('field-helper--handoff');
    void helper.offsetWidth;
    helper.classList.add('field-helper--handoff');
    setTimeout(() => helper.classList.remove('field-helper--handoff'), 520);
  }
  spawnRecipient('helper');
  showGain('+' + formatNumber(amount) + ' ★', 'helper');
}

function standFeedback(amount) {
  const stand = $('[data-stand-world]');
  stand.classList.remove('info-stand--working');
  void stand.offsetWidth;
  stand.classList.add('info-stand--working');
  setTimeout(() => stand.classList.remove('info-stand--working'), 650);
  const pop = $('[data-stand-pop]');
  pop.textContent = '+' + formatNumber(amount) + ' ★';
  pop.classList.remove('work-pop--active');
  void pop.offsetWidth;
  pop.classList.add('work-pop--active');
  spawnRecipient('stand');
}

function officeFeedback(amount) {
  const office = $('[data-office-world]');
  office.classList.remove('campaign-house--working');
  void office.offsetWidth;
  office.classList.add('campaign-house--working');
  setTimeout(() => office.classList.remove('campaign-house--working'), 650);
  const pop = $('[data-office-pop]');
  pop.textContent = '+' + formatMoney(amount) + ' €';
  pop.classList.remove('work-pop--active');
  void pop.offsetWidth;
  pop.classList.add('work-pop--active');
}

function donationFeedback(amount) {
  if (amount <= 0) return;
  const point = $('.donation-point');
  point.classList.remove('donation-point--working');
  void point.offsetWidth;
  point.classList.add('donation-point--working');
  setTimeout(() => point.classList.remove('donation-point--working'), 650);
  showGain('+' + formatMoney(amount) + ' €', 'donation');
}

function cheerCrowd() {
  const reaction = $('.crowd-reaction');
  reaction.classList.remove('crowd-reaction--active');
  void reaction.offsetWidth;
  reaction.classList.add('crowd-reaction--active');
  setTimeout(() => reaction.classList.remove('crowd-reaction--active'), 900);
}

function renderHelpers() {
  const visible = Math.min(state.helperCount, Game.CONFIG.helper.maxVisible);
  while (elements.helperField.children.length < visible) {
    const index = elements.helperField.children.length;
    const helper = document.createElement('span');
    helper.className = 'field-helper';
    helper.style.setProperty('--helper-index', index);
    helper.style.setProperty('--helper-delay', (-index * .73) + 's');
    helper.style.left = (48 + (index % 5) * 4.8) + '%';
    helper.style.top = (188 + Math.floor(index / 5) * 14) + 'px';
    helper.innerHTML = '<i class="field-helper__cap"></i><i class="field-helper__head"></i><i class="field-helper__body"></i><i class="field-helper__legs"></i><i class="field-helper__flyer"></i>';
    elements.helperField.appendChild(helper);
  }
  while (elements.helperField.children.length > visible) elements.helperField.lastElementChild.remove();

  const duration = Math.max(2.8, Game.helperCycleSeconds(state));
  $$('.field-helper').forEach(helper => helper.style.setProperty('--helper-cycle', duration + 's'));
  const overflow = Math.max(0, state.helperCount - visible);
  elements.helperOverflow.hidden = overflow <= 0;
  elements.helperOverflow.textContent = overflow > 0 ? '+' + overflow + ' HELFER IM AUSSENDIENST' : '';
}

function milestoneText(station) {
  const milestone = Game.nextMilestone(station, state);
  if (!milestone) return 'MAX. MEILENSTEINE ERREICHT';
  const current = Game.stationLevel(state, station);
  return current + ' / ' + milestone.target + ' · ' + milestone.label;
}

function renderStation(station) {
  const level = Game.stationLevel(state, station);
  const unlock = Game.unlocks(state)[station];
  const build = $('[data-build="' + station + '"]');
  const upgrade = $('[data-upgrade="' + station + '"]');
  const lane = $('[data-lane="' + station + '"]');
  const built = level > 0;

  build.hidden = state.electionFinished || built || !unlock;
  lane.hidden = !built;
  upgrade.disabled = !Game.canBuy(state, station);

  const cost = Game.stationCost(station, level);
  if (station === 'helper') {
    $('[data-helper-count]').textContent = state.helperCount;
    $('[data-helper-rate]').textContent = '+' + formatNumber(Game.helperRate(state) * 60) + ' Unterstützer/min';
    $('[data-helper-cycle]').textContent = state.helperCount ? 'jeder Helfer arbeitet sichtbar · ~' + oneDecimal.format(Game.helperCycleSeconds(state)) + ' s/Zyklus' : '';
    $('[data-helper-milestone]').textContent = milestoneText('helper');
    $('[data-helper-cost]').textContent = Game.CONFIG.helper.firstCost === 0 ? 'GRATIS' : formatMoney(Game.CONFIG.helper.firstCost) + ' €';
    $('[data-helper-upgrade-label]').textContent = !Game.unlocks(state).cash && built ?
      'KASSE AB ' + Game.CONFIG.donation.unlockSupporters + ' ★' : '↑ ' + formatMoney(cost) + ' €';
  }
  if (station === 'stand') {
    $('[data-stand-level]').textContent = state.standLevel;
    $('[data-stand-rate]').textContent = '+' + formatNumber(Game.standRate(state) * 60) + ' Unterstützer/min';
    $('[data-stand-cycle]').textContent = built ? '+' + formatNumber(Game.standOutputPerCycle(state)) + ' ★ je Kontakt · ' + oneDecimal.format(Game.standCycleSeconds(state)) + ' s' : '';
    $('[data-stand-milestone]').textContent = milestoneText('stand');
    $('[data-stand-cost]').textContent = formatMoney(Game.stationCost('stand', 0)) + ' €';
    $('[data-stand-upgrade-cost]').textContent = formatMoney(cost);
  }
  if (station === 'office') {
    $('[data-office-level]').textContent = state.officeLevel;
    $('[data-office-rate]').textContent = '+' + formatMoney(Game.officeRate(state) * 60) + ' €/min';
    $('[data-office-cycle]').textContent = built ? '+' + formatMoney(Game.officeOutputPerCycle(state)) + ' € je Zyklus · ' + oneDecimal.format(Game.officeCycleSeconds(state)) + ' s' : '';
    $('[data-office-milestone]').textContent = milestoneText('office');
    $('[data-office-cost]').textContent = formatMoney(Game.stationCost('office', 0)) + ' €';
    $('[data-office-upgrade-cost]').textContent = formatMoney(cost);
  }
}

function statusCopy(stage, unlocked) {
  if (state.electionFinished) return 'Kommunalwahl geschafft. Dein dauerhafter Erfahrungsbonus ist gestiegen.';
  if (stage === 0 && unlocked.helper) return 'Du hast erste Unterstützer. Hol dir jetzt deinen ersten Helfer – kostenlos.';
  if (stage === 0) return 'Verteile Flyer. Bei ' + Game.CONFIG.helper.unlockSupporters + ' Unterstützern hilft dir die erste Person.';
  if (stage === 1) return 'Dein Helfer arbeitet jetzt wirklich. Ab ' + Game.CONFIG.donation.unlockSupporters + ' Unterstützern entstehen Spenden.';
  if (stage === 2 && !unlocked.stand) {
    const missingHelpers = Math.max(0, Game.CONFIG.stand.unlockHelpers - state.helperCount);
    const missingSupporters = Math.max(0, Math.ceil(Game.CONFIG.stand.unlockSupporters - state.supporters));
    return 'Nächstes Ziel: Infostand · noch ' + missingHelpers + ' Helfer und ' + missingSupporters + ' Unterstützer.';
  }
  if (stage === 2) return 'Infostand verfügbar. Er wird eine eigene sichtbare Unterstützer-Maschine.';
  if (stage === 3 && !unlocked.office) {
    return 'Baue den Infostand auf LV ' + Game.CONFIG.office.unlockStandLevel + ' und erreiche ' + Game.CONFIG.office.unlockSupporters + ' Unterstützer.';
  }
  if (stage === 3) return 'Ortsbüro verfügbar. Ab jetzt produziert eine eigene Station Wahlkampfgeld.';
  if (stage === 4 && !unlocked.election) {
    return 'Ortsbüro auf LV ' + Game.CONFIG.election.revealOfficeLevel + ' bringen und ' + Game.electionRevealSupporters(state) + ' Unterstützer erreichen.';
  }
  if (stage === 5) return 'Das Rathaus ist sichtbar. Unterstützer und Wahlkampfkasse auf Wahl-Niveau bringen.';
  return 'Wahlkampf läuft.';
}

function render(now = Date.now()) {
  const unlocked = Game.unlocks(state);
  const stage = Game.worldStage(state);
  elements.scene.dataset.stage = String(stage);
  elements.scene.dataset.helperCount = String(Math.min(state.helperCount, Game.CONFIG.helper.maxVisible));
  elements.scene.dataset.standLevel = String(state.standLevel);
  elements.scene.dataset.officeLevel = String(state.officeLevel);

  elements.supporters.textContent = integerFormat.format(Math.floor(state.supporters));
  elements.euros.textContent = formatMoney(state.euros);
  elements.supportRate.textContent = state.helperCount ? '+' + formatNumber(Game.supporterRate(state) * 60) + '/min automatisch' : '';
  elements.cashRate.textContent = unlocked.cash ? '+' + formatMoney(Game.euroRate(state) * 60) + ' €/min Ø' : '';
  elements.cashHud.hidden = !unlocked.cash;
  $('.game-hud').classList.toggle('game-hud--compact', !unlocked.cash);
  elements.district.textContent = state.district;
  elements.careerBonus.textContent = '+' + Math.round((Game.careerMultiplier(state) - 1) * 100) + '%';

  const remaining = Game.nextManualInMs(state, now);
  const ready = remaining <= 0 && !state.electionFinished;
  elements.flyer.disabled = state.electionFinished;
  elements.flyer.classList.toggle('game-button--cooldown', !ready && !state.electionFinished);
  elements.flyer.setAttribute('aria-disabled', ready ? 'false' : 'true');
  elements.flyerCopy.textContent = '+' + formatNumber(Game.flyerOutput(state)) + ' Unterstützer · selbst machen';
  const manualProgress = state.electionFinished ? 0 : Math.max(0, Math.min(1, 1 - remaining / Game.CONFIG.manual.cooldownMs));
  elements.manualCooldown.style.width = (manualProgress * 100) + '%';

  elements.operations.hidden = state.helperCount <= 0;
  renderHelpers();
  renderStation('helper');
  renderStation('stand');
  renderStation('office');

  $('[data-helper-progress]').style.width = (state.helperProgress * 100) + '%';
  $('[data-stand-progress]').style.width = (state.standProgress * 100) + '%';
  $('[data-office-progress]').style.width = (state.officeProgress * 100) + '%';

  const standWorld = $('[data-stand-world]');
  standWorld.hidden = state.standLevel <= 0;
  $('[data-office-world]').hidden = state.officeLevel <= 0;
  elements.scene.classList.toggle('stand--two-workers', state.standLevel >= 3);
  elements.scene.classList.toggle('office--two-workers', state.officeLevel >= 3);

  elements.progress.hidden = stage < 5 || state.electionFinished;
  $('[data-control-deck]').classList.toggle('control-deck--election', stage >= 5 && !state.electionFinished);
  const target = Game.electionTarget(state);
  const entry = Game.electionEntryCost(state);
  const supporterRatio = Math.min(1, state.supporters / target);
  const moneyRatio = Math.min(1, state.euros / entry);
  const percent = Math.floor(Math.min(supporterRatio, moneyRatio) * 100);
  elements.percent.textContent = percent;
  elements.bar.style.width = percent + '%';
  elements.electionCost.textContent = formatMoney(entry);
  elements.election.disabled = !Game.canRunElection(state);
  elements.electionMini.textContent = 'Noch ' + Math.max(0, Math.ceil(target - state.supporters)) + ' Unterstützer · ' +
    Math.max(0, Math.ceil(entry - state.euros)) + ' € fehlen';

  elements.ending.hidden = !state.electionFinished;
  if (state.electionFinished) {
    elements.electionReward.textContent = '+' + state.lastElectionReward + ' Erfahrung';
    elements.endingBonus.textContent = '+' + Math.round((Game.careerMultiplier(state) - 1) * 100) + ' % Produktion dauerhaft';
  }

  elements.status.textContent = statusCopy(stage, unlocked);

  if (previousStage !== null && stage > previousStage && !state.electionFinished) flashScene();
  previousStage = stage;
  lastRender = performance.now();
}

function purchase(name) {
  const before = Game.stationLevel(state, name);
  const milestoneBefore = Game.nextMilestone(name, state);
  state = Game.buyStation(state, name, Date.now());
  const after = Game.stationLevel(state, name);
  if (after <= before) return;

  render();
  saveState();
  const hitMilestone = milestoneBefore && after === milestoneBefore.target;
  if (name === 'helper') {
    toast(hitMilestone ? milestoneBefore.label + '!' : 'Helfer #' + after + ' ist jetzt sichtbar unterwegs.');
  } else {
    const title = name === 'stand' ? 'Infostand' : 'Ortsbüro';
    toast(hitMilestone ? milestoneBefore.label + '!' : title + ' · Level ' + after);
  }
  flashScene();
}

elements.flyer.addEventListener('click', () => {
  const now = Date.now();
  if (!Game.canDistributeFlyer(state, now)) return;
  const beforeSupporters = state.supporters;
  const beforeEuros = state.euros;
  state = Game.distributeFlyer(state, now);
  manualFeedback(state.supporters - beforeSupporters);
  if (state.euros > beforeEuros) donationFeedback(state.euros - beforeEuros);
  render(now);
});

for (const name of ['helper', 'stand', 'office']) {
  $('[data-action="' + name + '"]').addEventListener('click', () => purchase(name));
  $('[data-upgrade="' + name + '"]').addEventListener('click', () => purchase(name));
}

elements.election.addEventListener('click', () => {
  if (!Game.canRunElection(state)) return;
  state = Game.runElection(state, Date.now());
  render();
  saveState();
  cheerCrowd();
  toast('Kommunalwahl geschafft · +' + state.lastElectionReward + ' Erfahrung!', 3000);
});

elements.nextDistrict.addEventListener('click', () => {
  if (!state.electionFinished) return;
  state = Game.startNextDistrict(state, Date.now());
  previousStage = null;
  previousSupporterHundred = 0;
  render();
  saveState();
  toast('Bezirk ' + state.district + ' gestartet · dein Erfahrungsbonus bleibt.');
});

elements.reset.addEventListener('click', () => {
  if (!window.confirm('Gesamten AMTSWEG-Spielstand inklusive Erfahrungsbonus zurücksetzen?')) return;
  localStorage.removeItem(Game.CONFIG.saveKey);
  for (const key of Game.CONFIG.legacySaveKeys) localStorage.removeItem(key);
  state = Game.createInitialState();
  previousStage = null;
  previousSupporterHundred = 0;
  elements.helperField.replaceChildren();
  render();
  saveState();
  toast('Neuer Spielstand gestartet.');
});

function frame(now) {
  const delta = Math.min(2, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  const before = state;
  const helperCycles = before.helperCount ? Math.floor(before.helperProgress + Game.helperCyclesPerSecond(before) * delta) : 0;
  const standCycles = before.standLevel ? Math.floor(before.standProgress + Game.standCyclesPerSecond(before) * delta) : 0;
  const officeCycles = before.officeLevel ? Math.floor(before.officeProgress + Game.officeCyclesPerSecond(before) * delta) : 0;
  const beforeEuros = before.euros;

  if (!before.electionFinished) state = Game.tick(before, delta, Date.now());

  if (helperCycles > 0) helperFeedback(helperCycles * Game.helperOutputPerCycle(before));
  if (standCycles > 0) standFeedback(standCycles * Game.standOutputPerCycle(before));
  if (officeCycles > 0) officeFeedback(officeCycles * Game.officeOutputPerCycle(before));

  const totalCashGain = Math.max(0, state.euros - beforeEuros);
  const officeGain = officeCycles * Game.officeOutputPerCycle(before);
  const donationGain = Math.max(0, totalCashGain - officeGain);
  if (donationGain > .001) donationFeedback(donationGain);

  const supporterHundred = Math.floor(state.supporters / 100);
  if (supporterHundred > previousSupporterHundred && state.supporters >= 100) cheerCrowd();
  previousSupporterHundred = supporterHundred;

  if (now - lastRender >= Game.CONFIG.tickMs) render(Date.now());
  if (now - lastSave >= Game.CONFIG.saveMs) saveState();
  requestAnimationFrame(frame);
}

render();
requestAnimationFrame(() => elements.scene.classList.add('world--ready'));
requestAnimationFrame(frame);
window.addEventListener('beforeunload', saveState);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveState(); });

if (loaded.offline && loaded.offline.seconds > 0) {
  const minutes = Math.max(1, Math.round(loaded.offline.seconds / 60));
  setTimeout(() => toast('Während ' + minutes + ' Min. Pause: +' + integerFormat.format(Math.floor(loaded.offline.supporterGain)) +
    ' ★ · +' + formatMoney(loaded.offline.euroGain) + ' €', 4200), 450);
}
