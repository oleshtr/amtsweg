'use strict';

const Game = window.AmtswegGame;
const Storage = window.AmtswegStorage;
const World = window.AmtswegWorld;
const $ = selector => document.querySelector(selector);
const ui = {};
document.querySelectorAll('*').forEach(el => {
  for (const key of Object.keys(el.dataset)) if (key !== 'action' && key !== 'select' && key !== 'goto' && key !== 'pan') ui[key] = el;
});
const actions = Object.fromEntries([...document.querySelectorAll('[data-action]')].map(el=>[el.dataset.action,el]));
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
const format = value => number.format(value);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function setText(el, text) { if (el.textContent !== text) el.textContent = text; }
function paintWorld() {
  // A broken visual must not stop scheduling, production, controls or autosaving.
  try { world.render(state,visualTime,Game); }
  catch (error) {
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
  toastTimer = setTimeout(()=>ui.toast.classList.remove('visible'), 4400);
}
function saveState() {
  if (!writable) { setText(ui.saveStatus, 'Speichern nicht verfügbar'); return; }
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
  node.textContent = '+' + format(amount) + ' ✦';
  node.style.left = (location === 'street' ? 540 : 1572) + 'px';
  node.style.top = (location === 'street' ? 398 : 252) + 'px';
  ui.rewards.append(node);
  node.addEventListener('animationend', ()=>node.remove(), {once:true});
  setTimeout(()=>node.remove(),1800);
}
function advance(now = Date.now(), feedback = true) {
  const before = state;
  const delta = Math.max(0, (now-lastSimulation)/1000);
  lastSimulation = now;
  state = Game.tick(state,delta);
  if (feedback && delta < 5) {
    if(state.street.cycles > before.street.cycles) burst((state.street.cycles-before.street.cycles)*Game.standStats(state).output,'street');
    if(state.office.cycles > before.office.cycles) burst((state.office.cycles-before.office.cycles)*Game.officeStats(state).output,'office');
  }
  if(before.office.phase === 'building' && state.office.phase === 'ready') notify('Die Tür steht offen! Dein Büro organisiert jetzt automatisch Kampagnen.');
}
function render() {
  const stand = Game.standStats(state), office = Game.officeStats(state);
  const streetProgress = state.street.active ? state.street.elapsed / stand.duration : 0;
  const officeProgress = state.office.phase === 'building' ? 1-state.office.buildRemaining/Game.CONFIG.buildSeconds : state.office.elapsed/office.duration;
  setText(ui.supporters, format(state.supporters));
  setText(ui.rate, state.helpers || state.office.phase === 'ready' ? '+'+format(Game.supporterRate(state))+' / Sek. automatisch' : 'Dein erster Schritt zählt.');
  setText(ui.standLabel,'Level '+state.standLevel+' · '+state.helpers+' Helfer');
  setText(ui.streetCycle,state.street.active ? '+'+stand.output+' ✦ in '+format(stand.duration-state.street.elapsed)+' Sek.' : 'Bereit zum Flyer verteilen');
  ui.streetBar.style.transform = 'scaleX('+streetProgress+')';
  ui.officeBar.style.transform = 'scaleX('+officeProgress+')';
  ui.buildBar.style.transform = 'scaleX('+officeProgress+')';
  setText(ui.officeLabel,state.office.phase === 'locked' ? 'Geschlossen · 250 Unterstützer' : state.office.phase === 'building' ? 'Dein Büro entsteht …' : 'Level '+state.office.level+' · Team vor Ort');
  setText(ui.officeCycle,state.office.phase === 'locked' ? 'Dein nächster großer Schritt' : state.office.phase === 'building' ? 'Noch '+format(state.office.buildRemaining)+' Sek.' : '+'+office.output+' ✦ in '+format(office.duration-state.office.elapsed)+' Sek.');
  ui.panelBar.style.transform = 'scaleX('+streetProgress+')';
  $('.panel-progress').setAttribute('aria-valuenow',String(Math.round(streetProgress*100)));
  setText(ui.panelEyebrow,'01 / STRASSENWAHLKAMPF · LEVEL '+state.standLevel);
  setText($('#panel-title'),['Ein Tisch. Eine Idee.','Dein Viertel hört dir zu.','Ein Dach für gute Ideen.','Kleine Straße. Großes Team.'][Game.standTier(state)]);
  setText(ui.panelDescription,state.helpers ? 'Dein Team hilft zusätzlich. Du kannst weiter Flyer verteilen.' : 'Sprich mit den Menschen in deinem Viertel.');
  setText(ui.production,'+'+Game.flyerGain(state)+' Unterstützer pro Flyer');
  setText(ui.automation,state.helpers ? '+'+format(Game.supporterRate(state))+' / SEK. AUTOMATISCH' : 'MANUELL');
  actions.start.disabled = false;
  setText(actions.start.querySelector('strong'),'FLYER VERTEILEN');
  setText(ui.clickGain,'+'+Game.flyerGain(state)+' Unterstützer');
  actions.upgrade.disabled = !Game.canUpgrade(state);
  setText(ui.upgradeCost,state.standLevel >= Game.CONFIG.maxLevel ? 'MAX' : Game.upgradeCost(state)+' ✦');
  const nextGain = Game.flyerGain({...state,standLevel:Math.min(Game.CONFIG.maxLevel,state.standLevel+1)});
  setText(ui.upgradeEffect,state.standLevel >= Game.CONFIG.maxLevel ? 'Dein Stand ist vollständig ausgebaut.' :
    (nextGain > Game.flyerGain(state) ? '+'+nextGain+' Unterstützer pro Flyer' : 'Helfer etwas schneller')+
    ([1,4,9].includes(state.standLevel) ? ' · neuer Look' : ''));
  actions.helper.disabled = !Game.canBuyHelper(state);
  setText(ui.helperCost,state.helpers >= Game.CONFIG.maxHelpers ? 'TEAM VOLL' : Game.helperCost(state)+' ✦');
  setText(ui.helperEffect,state.helpers >= Game.CONFIG.maxHelpers ? 'Vier Helfer sind für dich vor Ort.' : state.helpers ? 'Neue Person · zusätzliche Automation' : 'Sichtbarer Helfer · startet zusätzliche Automation');
  let goal;
  if(!state.totalSupporters) goal = 'Dein Anfang: Klicke auf „FLYER VERTEILEN“.';
  else if(state.standLevel === 1 && !state.helpers) goal = 'Erster Ausbau: Spare '+Game.upgradeCost(state)+' Unterstützer für einen sichtbaren Infostand.';
  else if(!state.helpers) goal = 'Zusätzliche Hilfe: Für '+Game.helperCost(state)+' Unterstützer arbeitet dein erster Helfer automatisch mit.';
  else if(state.standLevel < 5) goal = 'Verteile weiter Flyer und verbessere deinen Stand. Auf Level 5 bekommt er einen Pavillon.';
  else goal = 'Dein Straßenstand läuft: Flyer verteilen, Stand verbessern und dein Helferteam ausbauen.';
  setText(ui.goal,goal);
}
function moveTo(site, smooth = true) {
  const target = (site === 'street' ? 520 : 1605) * stageScale;
  ui.viewport.scrollTo({left:Math.max(0,target-ui.viewport.clientWidth/2),behavior:smooth && !reducedMotion ? 'smooth' : 'auto'});
}
function fitStage() {
  const maxScale = window.innerWidth <= 600 ? 1.35 : 1.85;
  stageScale = Math.max(1,Math.min(maxScale,ui.viewport.clientHeight/540));
  ui.worldScale.style.width = 2400*stageScale+'px';
  ui.worldScale.style.height = 540*stageScale+'px';
  ui.world.style.transform = 'scale('+stageScale+')';
  moveTo('street',false);
}
function apply(action, message) {
  advance();
  const before = state;
  state = action(state);
  if(JSON.stringify(before) !== JSON.stringify(state) && message) notify(message);
  render();
  paintWorld();
  saveState();
  return JSON.stringify(before) !== JSON.stringify(state);
}
actions.start.addEventListener('click',()=>{
  const gained = Game.flyerGain(state);
  apply(Game.distributeFlyer);
  actions.start.classList.remove('is-pressed');
  void actions.start.offsetWidth;
  actions.start.classList.add('is-pressed');
  setTimeout(()=>actions.start.classList.remove('is-pressed'),260);
  burst(gained,'street');
});
actions.upgrade.addEventListener('click',()=>apply(Game.upgradeStand,'Dein Stand wächst. Mehr Reichweite, kürzere Gespräche.'));
actions.helper.addEventListener('click',()=>apply(Game.buyHelper,state.helpers ? 'Verstärkung ist da. Dein Team wird größer!' : 'Dein erster Helfer ist da und hilft jetzt automatisch mit.'));
actions.reset.addEventListener('click',()=>{
  if(!window.confirm('Diesen Spielstand wirklich zurücksetzen? Der ursprüngliche Spielstand aus V0.1 bleibt erhalten.')) return;
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
  if(!document.hidden && now-lastPaint>=1000/30) {
    const elapsed=(now-lastPaint)/1000;
    lastPaint=now;
    visualTime+=Math.min(elapsed,.1);
    advance();
    paintWorld();
    if(now-lastUI>100) { render(); lastUI=now; }
    if(now-lastSaved>3000) saveState();
  }
  requestAnimationFrame(loop);
}
document.addEventListener('visibilitychange',()=>{
  advance(Date.now(),false);
  if(document.hidden) saveState();
  else { render(); lastPaint=performance.now(); }
});
window.addEventListener('pagehide',()=>{advance(Date.now(),false);saveState();});
window.addEventListener('beforeunload',()=>{advance(Date.now(),false);saveState();});
window.addEventListener('resize',fitStage);
fitStage();
render();
paintWorld();
moveTo('street',false);
if(loaded.note) notify(loaded.note);
if(!writable) setText(ui.saveStatus,'Speichern nicht verfügbar');
requestAnimationFrame(loop);
