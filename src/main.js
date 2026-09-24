'use strict';

const Game = window.AmtswegGame;
let state = loadState();
let lastFrame = performance.now();
let lastSaved = 0;

const els = {
  supporters: document.querySelector('[data-supporters]'),
  euros: document.querySelector('[data-euros]'),
  euroStat: document.querySelector('[data-euro-stat]'),
  rate: document.querySelector('[data-rate]'),
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
  toast: document.querySelector('[data-toast]'),
  resetButton: document.querySelector('[data-action="reset"]'),
  scene: document.querySelector('[data-scene]'),
  ending: document.querySelector('[data-ending]'),
};

function formatNumber(value) {
  if (value >= 1000) return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1, notation: 'compact' }).format(value);
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: value < 100 ? 1 : 0 }).format(value);
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

function updateScene() {
  els.scene.classList.toggle('scene--helpers', state.helpers > 0);
  els.scene.classList.toggle('scene--stand', state.standOwned);
  els.scene.classList.toggle('scene--office', state.officeOwned);
  els.scene.classList.toggle('scene--finished', state.electionFinished);
}

function render() {
  const unlocked = Game.unlocks(state);
  const helperPrice = Game.helperCost(state);
  const supportRate = Game.supporterRate(state);

  els.supporters.textContent = formatNumber(state.supporters);
  els.euros.textContent = formatNumber(state.euros);
  els.rate.textContent = supportRate > 0 ? `+${formatNumber(supportRate)} / Sek.` : '';
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

  els.electionCard.hidden = !unlocked.election;
  const supporterNeed = Math.max(0, Math.ceil(Game.CONFIG.election.targetSupporters - state.supporters));
  const euroNeed = Math.max(0, Math.ceil(Game.CONFIG.election.entryCost - state.euros));
  const needs = [];
  if (supporterNeed) needs.push(`${supporterNeed} Unterstützer`);
  if (euroNeed) needs.push(`${euroNeed} €`);
  els.electionProgress.textContent = needs.length ? `Noch nötig: ${needs.join(' · ')}` : 'Die Kampagne ist bereit.';
  els.electionButton.disabled = !Game.canRunElection(state);

  els.ending.hidden = !state.electionFinished;
  updateScene();
}

function apply(action, message) {
  const before = JSON.stringify(state);
  state = action(state);
  if (JSON.stringify(state) !== before && message) notify(message);
  render();
  saveState();
}

els.flyerButton.addEventListener('click', () => apply(Game.distributeFlyer));
els.donateButton.addEventListener('click', () => apply(Game.collectDonation));
els.helperButton.addEventListener('click', () => apply(Game.buyHelper, 'Ein Wahlkampfhelfer ist dabei.'));
els.standButton.addEventListener('click', () => apply(Game.buyStand, 'Der Infostand steht.'));
els.officeButton.addEventListener('click', () => apply(Game.buyOffice, 'Das Ortsbüro ist eröffnet.'));
els.electionButton.addEventListener('click', () => apply(Game.runElection, 'Kommunalwahl geschafft!'));

els.resetButton.addEventListener('click', () => {
  if (!window.confirm('Spielstand wirklich zurücksetzen?')) return;
  localStorage.removeItem(Game.CONFIG.saveKey);
  state = Game.createInitialState();
  render();
  notify('Neuer Spielstand gestartet.');
});

function loop(now) {
  const delta = Math.min((now - lastFrame) / 1000, 1);
  lastFrame = now;
  if (!state.electionFinished && Game.supporterRate(state) + Game.euroRate(state) > 0) {
    state = Game.tick(state, delta);
    render();
  }
  if (now - lastSaved > 3000) saveState();
  requestAnimationFrame(loop);
}

render();
requestAnimationFrame(loop);
window.addEventListener('beforeunload', saveState);
