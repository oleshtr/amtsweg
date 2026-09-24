'use strict';

const Game = window.AmtswegGame;
let state = loadState();
let lastFrame = performance.now();
let lastSaved = 0;
let lastAutoBurst = 0;

const els = {
  supporters: document.querySelector('[data-supporters]'),
  euros: document.querySelector('[data-euros]'),
  euroStat: document.querySelector('[data-euro-stat]'),
  supporterStat: document.querySelector('[data-supporter-stat]'),
  rate: document.querySelector('[data-rate]'),
  cashRate: document.querySelector('[data-cash-rate]'),
  flyerButton: document.querySelector('[data-action="flyer"]'),
  donateButton: document.querySelector('[data-action="donate"]'),
  helperCard: document.querySelector('[data-card="helper"]'),
  helperButton: document.querySelector('[data-action="helper"]'),
  helperCount: document.querySelector('[data-helper-count]'),
  helperCost: document.querySelector('[data-helper-cost]'),
  standCard: document.querySelector('[data-card="stand"]'),
  standButton: document.querySelector('[data-action="stand"]'),
  officeCard: document.querySelector('[data-card="office"]'),
  officeButton: document.querySelector('[data-action="office"]'),
  electionCard: document.querySelector('[data-card="election"]'),
  electionButton: document.querySelector('[data-action="election"]'),
  electionProgress: document.querySelector('[data-election-progress]'),
  electionPercent: document.querySelector('[data-election-percent]'),
  electionBar: document.querySelector('[data-election-bar]'),
  electionMini: document.querySelector('[data-election-mini]'),
  worldLevel: document.querySelector('[data-world-level]'),
  statusCopy: document.querySelector('[data-status-copy]'),
  toast: document.querySelector('[data-toast]'),
  resetButton: document.querySelector('[data-action="reset"]'),
  scene: document.querySelector('[data-scene]'),
  candidate: document.querySelector('[data-candidate]'),
  burstLayer: document.querySelector('[data-resource-burst-layer]'),
  ending: document.querySelector('[data-ending]'),
};

function formatNumber(value) {
  if (value >= 1000) {
    return new Intl.NumberFormat('de-DE', {
      maximumFractionDigits: 1,
      notation: 'compact',
    }).format(value);
  }

  return new Intl.NumberFormat('de-DE', {
    maximumFractionDigits: value < 100 ? 1 : 0,
  }).format(value);
}

function loadState() {
  try {
    const raw = localStorage.getItem(Game.CONFIG.saveKey);
    return raw ? Game.normalizeState(JSON.parse(raw)) : Game.createInitialState();
  } catch {
    return Game.createInitialState();
  }
}

function saveState() {
  localStorage.setItem(Game.CONFIG.saveKey, JSON.stringify(state));
  lastSaved = performance.now();
}

function notify(message) {
  els.toast.textContent = message;
  els.toast.classList.add('toast--visible');
  clearTimeout(notify.timeout);
  notify.timeout = setTimeout(() => els.toast.classList.remove('toast--visible'), 1900);
}

function pulse(element) {
  if (!element) return;
  element.classList.remove('hud-stat--pulse');
  void element.offsetWidth;
  element.classList.add('hud-stat--pulse');
  setTimeout(() => element.classList.remove('hud-stat--pulse'), 280);
}

function animateCandidate() {
  els.candidate.classList.remove('actor--action');
  void els.candidate.offsetWidth;
  els.candidate.classList.add('actor--action');
  setTimeout(() => els.candidate.classList.remove('actor--action'), 270);
}

function spawnResource(text, type = 'supporter', options = {}) {
  const pop = document.createElement('span');
  pop.className = 'resource-pop';
  if (type === 'cash') pop.classList.add('resource-pop--cash');
  if (options.auto) pop.classList.add('resource-pop--auto');
  pop.textContent = text;

  const left = options.left ?? (type === 'cash' ? 69 : 43);
  const top = options.top ?? (options.auto ? 39 : 34);
  pop.style.left = `${left + (Math.random() * 8 - 4)}%`;
  pop.style.top = `${top + (Math.random() * 5 - 2.5)}%`;

  els.burstLayer.appendChild(pop);
  pop.addEventListener('animationend', () => pop.remove(), { once: true });
}

function currentStatus(unlocked) {
  if (state.electionFinished) return 'Geschafft: Deine erste Kommunalwahl ist beendet.';
  if (state.officeOwned) return 'Das Ortsbüro arbeitet. Helfer und Spenden laufen automatisch.';
  if (state.standOwned) return 'Der Infostand läuft. Auf der Straße wird deine Kampagne sichtbar.';
  if (state.helpers > 0) return 'Dein Helferteam verteilt jetzt automatisch Flyer.';
  if (unlocked.donations) return 'Erste Leute kennen dich. Jetzt kannst du Spenden sammeln.';
  return 'Irgendwo in Deutschland. Noch kennt dich fast niemand.';
}

function chapterPercent() {
  const supporterPart = Math.min(1, state.supporters / Game.CONFIG.election.targetSupporters);
  const cashPart = Math.min(1, state.euros / Game.CONFIG.election.entryCost);
  return Math.min(100, Math.floor((supporterPart * 0.7 + cashPart * 0.3) * 100));
}

function updateScene(unlocked) {
  els.scene.classList.toggle('scene--helpers', state.helpers > 0);
  els.scene.classList.toggle('scene--stand', state.standOwned);
  els.scene.classList.toggle('scene--office', state.officeOwned);
  els.scene.classList.toggle('scene--finished', state.electionFinished);
  els.scene.classList.toggle('scene--donations', unlocked.donations);

  const worldLevel =
    1 +
    Number(state.helpers > 0) +
    Number(state.standOwned) +
    Number(state.officeOwned) +
    Number(state.electionFinished);

  els.worldLevel.textContent = worldLevel;
  els.statusCopy.textContent = currentStatus(unlocked);
}

function render() {
  const unlocked = Game.unlocks(state);
  const helperPrice = Game.helperCost(state);
  const supportRate = Game.supporterRate(state);
  const cashPerSecond = Game.euroRate(state);
  const percent = chapterPercent();

  els.supporters.textContent = formatNumber(state.supporters);
  els.euros.textContent = formatNumber(state.euros);
  els.rate.textContent = supportRate > 0 ? `+${formatNumber(supportRate)} / Sek.` : 'MANUELL';
  els.cashRate.textContent = cashPerSecond > 0 ? `+${formatNumber(cashPerSecond)} € / Sek.` : 'AKTIV SAMMELN';
  els.euroStat.hidden = !unlocked.donations;

  els.flyerButton.querySelector('small').textContent = `+${Game.flyerGain(state)} Unterstützer`;
  els.donateButton.hidden = !unlocked.donations;
  els.donateButton.disabled = state.electionFinished;
  els.flyerButton.disabled = state.electionFinished;

  els.helperCard.hidden = !unlocked.helper;
  els.helperCount.textContent = state.helpers;
  els.helperCost.textContent = helperPrice;
  els.helperButton.disabled = !Game.canBuyHelper(state) || state.electionFinished;

  els.standCard.hidden = !unlocked.stand || state.standOwned;
  els.standButton.disabled = !Game.canBuyStand(state) || state.electionFinished;

  els.officeCard.hidden = !unlocked.office || state.officeOwned;
  els.officeButton.disabled = !Game.canBuyOffice(state) || state.electionFinished;

  els.electionCard.hidden = !unlocked.election || state.electionFinished;
  const supporterNeed = Math.max(0, Math.ceil(Game.CONFIG.election.targetSupporters - state.supporters));
  const euroNeed = Math.max(0, Math.ceil(Game.CONFIG.election.entryCost - state.euros));
  const needs = [];
  if (supporterNeed) needs.push(`${supporterNeed} Unterstützer`);
  if (euroNeed) needs.push(`${euroNeed} €`);
  els.electionProgress.textContent = needs.length
    ? `Noch nötig: ${needs.join(' · ')}`
    : 'Die Kampagne ist bereit.';
  els.electionButton.disabled = !Game.canRunElection(state);

  els.electionPercent.textContent = percent;
  els.electionBar.style.width = `${percent}%`;
  if (state.electionFinished) {
    els.electionMini.textContent = 'Kapitelziel erreicht.';
  } else if (supporterNeed > 0) {
    els.electionMini.textContent = `Noch ${supporterNeed} Unterstützer bis zur Wahlreife.`;
  } else if (euroNeed > 0) {
    els.electionMini.textContent = `Unterstützerziel erreicht · noch ${euroNeed} € Wahlkampfkasse.`;
  } else {
    els.electionMini.textContent = 'Bereit für die Kommunalwahl.';
  }

  els.ending.hidden = !state.electionFinished;
  updateScene(unlocked);
}

function apply(action, message) {
  const before = JSON.stringify(state);
  state = action(state);
  const changed = JSON.stringify(state) !== before;
  if (changed && message) notify(message);
  render();
  saveState();
  return changed;
}

els.flyerButton.addEventListener('click', () => {
  const before = state.supporters;
  if (!apply(Game.distributeFlyer)) return;

  const gained = Math.max(0, state.supporters - before);
  spawnResource(`+${formatNumber(gained)} ★`, 'supporter', { left: 40, top: 30 });
  pulse(els.supporterStat);
  animateCandidate();
});

els.donateButton.addEventListener('click', () => {
  const before = state.euros;
  if (!apply(Game.collectDonation)) return;

  const gained = Math.max(0, state.euros - before);
  spawnResource(`+${formatNumber(gained)} €`, 'cash', { left: 62, top: 31 });
  pulse(els.euroStat);
});

els.helperButton.addEventListener('click', () => {
  if (apply(Game.buyHelper, 'Ein Wahlkampfhelfer ist dabei.')) {
    spawnResource('HELFER +1', 'supporter', { left: 49, top: 48 });
  }
});

els.standButton.addEventListener('click', () => {
  if (apply(Game.buyStand, 'Der Infostand steht.')) {
    spawnResource('INFOSTAND!', 'supporter', { left: 60, top: 23 });
  }
});

els.officeButton.addEventListener('click', () => {
  if (apply(Game.buyOffice, 'Das Ortsbüro ist eröffnet.')) {
    spawnResource('ORTSBÜRO!', 'cash', { left: 75, top: 55 });
  }
});

els.electionButton.addEventListener('click', () => {
  if (apply(Game.runElection, 'Kommunalwahl geschafft!')) {
    spawnResource('KAPITEL GESCHAFFT', 'supporter', { left: 78, top: 22 });
  }
});

els.resetButton.addEventListener('click', () => {
  if (!window.confirm('Spielstand wirklich zurücksetzen?')) return;
  localStorage.removeItem(Game.CONFIG.saveKey);
  state = Game.createInitialState();
  render();
  notify('Neuer Spielstand gestartet.');
});

function maybeShowAutoBurst(now) {
  if (now - lastAutoBurst < 1350 || state.electionFinished) return;

  const supporterRate = Game.supporterRate(state);
  const cashPerSecond = Game.euroRate(state);

  if (supporterRate > 0) {
    spawnResource(`+${formatNumber(supporterRate)} ★`, 'supporter', {
      left: state.standOwned ? 55 : 47,
      top: state.officeOwned ? 55 : 38,
      auto: true,
    });
  }

  if (cashPerSecond > 0) {
    spawnResource(`+${formatNumber(cashPerSecond)} €`, 'cash', {
      left: 75,
      top: 60,
      auto: true,
    });
  }

  lastAutoBurst = now;
}

function loop(now) {
  const delta = Math.min((now - lastFrame) / 1000, 1);
  lastFrame = now;

  if (!state.electionFinished && Game.supporterRate(state) + Game.euroRate(state) > 0) {
    state = Game.tick(state, delta);
    render();
    maybeShowAutoBurst(now);
  }

  if (now - lastSaved > 3000) saveState();
  requestAnimationFrame(loop);
}

render();
requestAnimationFrame(loop);
window.addEventListener('beforeunload', saveState);
