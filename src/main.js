'use strict';

const Game = window.AmtswegGame;
const Storage = window.AmtswegStorage;
const World = window.AmtswegWorld;
const $ = selector => document.querySelector(selector);
const ui = {};

document.querySelectorAll('*').forEach(el => {
  for (const key of Object.keys(el.dataset)) {
    if (key !== 'action' && key !== 'select' && key !== 'goto' && key !== 'pan') ui[key] = el;
  }
});

const actions = Object.fromEntries(
  [...document.querySelectorAll('[data-action]')].map(el => [el.dataset.action, el])
);

let storage;
try { storage = window.localStorage; } catch { storage = null; }

const loaded = Storage.load(storage, Game);
let state = loaded.state;
let writable = loaded.writable;
let lastSimulation = Date.now();
let lastSaved = performance.now();
let lastPaint = 0;
let lastUI = 0;
let visualTime = 0;
let toastTimer;
let stageScale = 1;

const world = World.mount(document);
const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const compactNumber = new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 });
const format = value => number.format(value);
const compact = value => value >= 10000 ? compactNumber.format(value) : number.format(value);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function setText(el, text) {
  if (el && el.textContent !== text) el.textContent = text;
}

function setMarkup(el, markup) {
  if (el && el.innerHTML !== markup) el.innerHTML = markup;
}

function paintWorld() {
  // A broken visual must not stop scheduling, production, controls or autosaving.
  try {
    world.render(state, visualTime, Game);
  } catch (error) {
    if (!paintWorld.warned) {
      console.warn('Welt-Darstellung unterbrochen; Produktion läuft weiter.', error);
      paintWorld.warned = true;
    }
  }
}

function notify(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('visible'), 4400);
}

function saveState() {
  if (!writable) {
    setText(ui.saveStatus, 'Speichern nicht verfügbar');
    return;
  }
  const saved = Storage.save(storage, Game, state);
  setText(ui.saveStatus, saved ? '✓ Lokal gespeichert' : 'Speichern fehlgeschlagen');
  if (!saved && !saveState.warned) {
    notify('Speichern nicht möglich. Bitte prüfe den Browserspeicher.');
    saveState.warned = true;
  }
  lastSaved = performance.now();
}

function burst(amount, location) {
  if (ui.rewards.childElementCount >= 6) ui.rewards.firstElementChild.remove();
  const node = document.createElement('span');
  node.className = 'reward';
  node.textContent = '+' + compact(amount) + ' ✦';
  node.style.left = (location === 'street' ? 635 : 1572) + 'px';
  node.style.top = (location === 'street' ? 344 : 252) + 'px';
  ui.rewards.append(node);
  node.addEventListener('animationend', () => node.remove(), { once: true });
  setTimeout(() => node.remove(), 1800);
}

function advance(now = Date.now(), feedback = true) {
  const before = state;
  const delta = Math.max(0, (now - lastSimulation) / 1000);
  lastSimulation = now;
  state = Game.tick(state, delta);

  if (feedback && delta < 5) {
    if (state.street.cycles > before.street.cycles) {
      burst((state.street.cycles - before.street.cycles) * Game.standStats(state).output, 'street');
    }
    if (state.office.cycles > before.office.cycles) {
      burst((state.office.cycles - before.office.cycles) * Game.officeStats(state).output, 'office');
    }
  }

  if (before.office.phase === 'building' && state.office.phase === 'ready') {
    notify('Die Tür steht offen! Dein Büro organisiert jetzt automatisch Kampagnen.');
  }
}

function render() {
  const stand = Game.standStats(state);
  const office = Game.officeStats(state);
  const streetProgress = state.street.active ? state.street.elapsed / stand.duration : 0;
  const officeProgress = state.office.phase === 'building'
    ? 1 - state.office.buildRemaining / Game.CONFIG.buildSeconds
    : state.office.elapsed / office.duration;
  const rate = Game.supporterRate(state);
  const nextStandMilestone = Game.nextStandMilestone(state);
  const nextTeamMilestone = Game.nextTeamMilestone(state);

  setText(ui.supporters, compact(state.supporters));
  setText(
    ui.rate,
    state.teamLevel || state.office.phase === 'ready'
      ? '+' + format(rate) + ' / Sek. automatisch'
      : 'Dein erster Schritt zählt.'
  );

  setText(ui.standLabel, 'Level ' + state.standLevel + ' · Team-Level ' + state.teamLevel);
  setText(
    ui.streetCycle,
    state.teamLevel
      ? '+' + compact(stand.output) + ' ✦ in ' + format(stand.duration - state.street.elapsed) + ' Sek.'
      : 'Automation noch nicht freigeschaltet'
  );
  ui.streetBar.style.transform = 'scaleX(' + streetProgress + ')';

  ui.officeBar.style.transform = 'scaleX(' + officeProgress + ')';
  ui.buildBar.style.transform = 'scaleX(' + officeProgress + ')';
  setText(
    ui.officeLabel,
    state.office.phase === 'locked'
      ? 'Geschlossen · 250 Unterstützer'
      : state.office.phase === 'building'
        ? 'Dein Büro entsteht …'
        : 'Level ' + state.office.level + ' · Team vor Ort'
  );
  setText(
    ui.officeCycle,
    state.office.phase === 'locked'
      ? 'Dein nächster großer Schritt'
      : state.office.phase === 'building'
        ? 'Noch ' + format(state.office.buildRemaining) + ' Sek.'
        : '+' + office.output + ' ✦ in ' + format(office.duration - state.office.elapsed) + ' Sek.'
  );

  ui.panelBar.style.transform = 'scaleX(' + streetProgress + ')';
  $('.panel-progress').setAttribute('aria-valuenow', String(Math.round(streetProgress * 100)));
  setText(ui.panelEyebrow, '01 / STRASSENWAHLKAMPF · LEVEL ' + state.standLevel);

  const titles = [
    'Ein Tisch. Eine Idee.',
    'Der Stand fällt auf.',
    'Das Viertel kennt dich.',
    'Ein eingespieltes Team.',
    'Eine feste Größe im Viertel.',
  ];
  setText($('#panel-title'), titles[Game.standTier(state)]);

  if (!state.teamLevel) {
    setText(ui.panelDescription, 'Flyer verteilen, den Stand ausbauen und die erste Automation freischalten.');
  } else if (nextStandMilestone) {
    setText(
      ui.panelDescription,
      'Team-Level ' + state.teamLevel + ' arbeitet automatisch · nächster Stand-Meilenstein: Level ' + nextStandMilestone + '.'
    );
  } else {
    setText(ui.panelDescription, 'Der Straßenstand skaliert weiter. Aktives Verteilen beschleunigt deinen Fortschritt.');
  }

  setText(ui.production, '+' + compact(Game.flyerGain(state)) + ' Unterstützer pro Flyer');
  setText(
    ui.automation,
    state.teamLevel
      ? 'TEAM L' + state.teamLevel + ' · +' + format(rate) + ' / SEK.'
      : 'MANUELL'
  );

  actions.start.disabled = false;
  setText(actions.start.querySelector('strong'), 'FLYER VERTEILEN');
  setText(ui.clickGain, '+' + compact(Game.flyerGain(state)) + ' Unterstützer');

  const standMaxed = state.standLevel >= Game.CONFIG.maxStandLevel;
  actions.upgrade.disabled = !Game.canUpgrade(state);
  setMarkup(
    actions.upgrade.querySelector('strong'),
    standMaxed ? 'STAND<br>MAX' : 'STAND<br>LEVEL ' + (state.standLevel + 1)
  );
  setText(ui.upgradeCost, standMaxed ? 'MAX' : compact(Game.upgradeCost(state)) + ' ✦');

  const nextLevel = Math.min(Game.CONFIG.maxStandLevel, state.standLevel + 1);
  const hitsStandMilestone = Game.STAND_MILESTONES.includes(nextLevel);
  setText(
    ui.upgradeEffect,
    standMaxed
      ? 'Der Straßenstand ist vollständig ausgebaut.'
      : hitsStandMilestone
        ? 'MEILENSTEIN · neuer Look + großer Produktionsbonus'
        : nextStandMilestone
          ? 'Noch ' + (nextStandMilestone - state.standLevel) + ' Level bis Meilenstein ' + nextStandMilestone
          : 'Ertrag und Skalierung steigen weiter'
  );

  const teamMaxed = state.teamLevel >= Game.CONFIG.maxTeamLevel;
  actions.helper.disabled = !Game.canUpgradeTeam(state);
  setMarkup(
    actions.helper.querySelector('strong'),
    teamMaxed
      ? 'TEAM<br>MAX'
      : state.teamLevel
        ? 'TEAM<br>LEVEL ' + (state.teamLevel + 1)
        : 'AUTO<br>STARTEN'
  );
  setText(ui.helperCost, teamMaxed ? 'MAX' : compact(Game.teamUpgradeCost(state)) + ' ✦');

  const nextTeamLevel = Math.min(Game.CONFIG.maxTeamLevel, state.teamLevel + 1);
  const hitsTeamMilestone = Game.TEAM_MILESTONES.includes(nextTeamLevel);
  const visibleNow = Game.visibleHelpers(state);
  const visibleNext = Game.visibleHelpers({ ...state, teamLevel: nextTeamLevel });
  setText(
    ui.helperEffect,
    teamMaxed
      ? 'Dein Team ist vollständig entwickelt.'
      : !state.teamLevel
        ? 'Erster Helfer · automatische Flyer-Verteilung'
        : visibleNext > visibleNow
          ? 'MEILENSTEIN · zusätzlicher sichtbarer Helfer'
          : hitsTeamMilestone
            ? 'MEILENSTEIN · deutlicher Automationsbonus'
            : nextTeamMilestone
              ? 'Automation stärker · Meilenstein bei Team-Level ' + nextTeamMilestone
              : 'Automation wird schneller und stärker'
  );

  let goal;
  if (!state.totalSupporters) {
    goal = 'Dein Anfang: Klicke auf „FLYER VERTEILEN“.';
  } else if (!state.teamLevel) {
    goal = 'Automation freischalten: Spare ' + compact(Game.teamUpgradeCost(state)) + ' Unterstützer für deinen ersten Helfer.';
  } else if (state.standLevel < 10) {
    goal = 'Erster großer Meilenstein: Baue deinen Straßenstand bis Level 10 aus.';
  } else if (nextStandMilestone) {
    goal = 'Nächster Stand-Meilenstein: Level ' + nextStandMilestone + ' · weiter klicken, leveln und Automation verbessern.';
  } else {
    goal = 'Dein Straßenstand skaliert weiter: Stand und Team haben kein frühes Ende.';
  }
  setText(ui.goal, goal);
}

function moveTo(site, smooth = true) {
  const target = (site === 'street' ? 520 : 1605) * stageScale;
  ui.viewport.scrollTo({
    left: Math.max(0, target - ui.viewport.clientWidth / 2),
    behavior: smooth && !reducedMotion ? 'smooth' : 'auto',
  });
}

function fitStage() {
  const maxScale = window.innerWidth <= 600 ? 1.35 : 1.85;
  stageScale = Math.max(1, Math.min(maxScale, ui.viewport.clientHeight / 540));
  ui.worldScale.style.width = 2400 * stageScale + 'px';
  ui.worldScale.style.height = 540 * stageScale + 'px';
  ui.world.style.transform = 'scale(' + stageScale + ')';
  moveTo('street', false);
}

function apply(action, message) {
  advance();
  const before = state;
  state = action(state);
  const changed = JSON.stringify(before) !== JSON.stringify(state);
  if (changed && message) notify(message);
  render();
  paintWorld();
  saveState();
  return changed;
}

actions.start.addEventListener('click', () => {
  const gained = Game.flyerGain(state);
  apply(Game.distributeFlyer);
  world.triggerFlyer(visualTime);
  paintWorld();

  actions.start.classList.remove('is-pressed');
  void actions.start.offsetWidth;
  actions.start.classList.add('is-pressed');
  setTimeout(() => actions.start.classList.remove('is-pressed'), 260);
  burst(gained, 'street');
});

actions.upgrade.addEventListener('click', () => {
  const nextLevel = state.standLevel + 1;
  const milestone = Game.STAND_MILESTONES.includes(nextLevel);
  apply(
    Game.upgradeStand,
    milestone
      ? 'Meilenstein erreicht! Dein Straßenstand wächst sichtbar und produziert stärker.'
      : 'Stand-Level ' + nextLevel + ' erreicht.'
  );
});

actions.helper.addEventListener('click', () => {
  const nextLevel = state.teamLevel + 1;
  const visibleBefore = Game.visibleHelpers(state);
  const visibleAfter = Game.visibleHelpers({ ...state, teamLevel: nextLevel });
  apply(
    Game.upgradeTeam,
    !state.teamLevel
      ? 'Dein erster Helfer ist da. Flyer werden jetzt automatisch verteilt.'
      : visibleAfter > visibleBefore
        ? 'Team-Meilenstein! Eine weitere Person hilft sichtbar am Stand mit.'
        : 'Team-Level ' + nextLevel + ': Deine Automation wird stärker.'
  );
});

actions.reset.addEventListener('click', () => {
  if (!window.confirm('Diesen Spielstand wirklich zurücksetzen? Der ursprüngliche Spielstand aus V0.1 bleibt erhalten.')) return;
  state = Game.createInitialState();
  lastSimulation = Date.now();
  ui.rewards.replaceChildren();
  moveTo('street');
  render();
  paintWorld();
  saveState();
  notify('Ein neuer Anfang in der Lindenstraße.');
});

function loop(now) {
  if (!document.hidden && now - lastPaint >= 1000 / 30) {
    const elapsed = (now - lastPaint) / 1000;
    lastPaint = now;
    visualTime += Math.min(elapsed, .1);
    advance();
    paintWorld();
    if (now - lastUI > 100) {
      render();
      lastUI = now;
    }
    if (now - lastSaved > 3000) saveState();
  }
  requestAnimationFrame(loop);
}

document.addEventListener('visibilitychange', () => {
  advance(Date.now(), false);
  if (document.hidden) saveState();
  else {
    render();
    lastPaint = performance.now();
  }
});

window.addEventListener('pagehide', () => {
  advance(Date.now(), false);
  saveState();
});

window.addEventListener('beforeunload', () => {
  advance(Date.now(), false);
  saveState();
});

window.addEventListener('resize', fitStage);

fitStage();
render();
paintWorld();
moveTo('street', false);
if (loaded.note) notify(loaded.note);
if (!writable) setText(ui.saveStatus, 'Speichern nicht verfügbar');
requestAnimationFrame(loop);
