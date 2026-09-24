// Deterministic active-run replay using the same exported game logic as the browser.
const Game = require('../src/game.js');
const goals = {};
let state = Game.createInitialState(1000);
let now = 1000;
let nextFlyerAt = now;
const stepMs = 100;

function mark(name) {
  if (!(name in goals)) goals[name] = Math.round((now - 1000) / 6000) / 10;
}

for (; now < 1000 + 60 * 60 * 1000; now += stepMs) {
  if (now >= nextFlyerAt && !state.flyerEndsAt) {
    state = Game.startFlyer(state, now);
    nextFlyerAt = now + (state.helperLevel ? 5000 : Game.CONFIG.flyerDurationMs);
  }
  state = Game.tick(state, stepMs / 1000, now);
  if (Game.unlocks(state).cash) mark('cash');
  if (!state.helperLevel && Game.canBuy(state, 'helper')) {
    state = Game.buyStation(state, 'helper', now);
    mark('helper');
  }
  if (state.helperLevel && state.helperLevel < 5 && Game.canBuy(state, 'helper')) {
    state = Game.buyStation(state, 'helper', now);
    if (state.helperLevel === 5) mark('helper5');
  }
  if (!state.standLevel && Game.canBuy(state, 'stand')) {
    state = Game.buyStation(state, 'stand', now);
    mark('stand');
  }
  if (state.standLevel && state.standLevel < 10 && Game.canBuy(state, 'stand')) {
    state = Game.buyStation(state, 'stand', now);
    if (state.standLevel === 10) mark('stand10');
  }
  if (!state.officeLevel && Game.canBuy(state, 'office')) {
    state = Game.buyStation(state, 'office', now);
    mark('office');
  }
  if (state.officeLevel && state.officeLevel < 5 && Game.canBuy(state, 'office')) {
    state = Game.buyStation(state, 'office', now);
  }
  if (Game.unlocks(state).election) mark('reveal');
  if (Game.canRunElection(state)) {
    state = Game.runElection(state, now);
    mark('finished');
    break;
  }
}

console.log(JSON.stringify({ minutes: goals, final: {
  supporters: Math.round(state.supporters), euros: Math.round(state.euros),
  helperLevel: state.helperLevel, standLevel: state.standLevel,
  officeLevel: state.officeLevel,
} }, null, 2));
