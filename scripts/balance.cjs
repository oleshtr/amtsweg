// Active replay for the simple visible automation loop.
const Game = require('../src/game.js');
const stepMs = 100;

function simulate(clicksPerSecond) {
  const goals = {};
  let state = Game.createInitialState(1000);
  let now = 1000;
  let nextClickAt = now;
  const interval = 1000 / clicksPerSecond;
  const mark = name => {
    if (!(name in goals)) goals[name] = Math.round((now - 1000) / 6000) / 10;
  };

  for (; now < 1000 + 120 * 60 * 1000; now += stepMs) {
    while (now >= nextClickAt && !state.electionFinished) {
      if (!state.helperLevel || ((now - 1000) % 60000 < 15000)) {
        state = Game.distributeFlyer(state, now);
      }
      nextClickAt += interval;
    }

    state = Game.tick(state, stepMs / 1000, now);

    if (!state.helperLevel && Game.canBuy(state, 'helper')) {
      state = Game.buyStation(state, 'helper', now); mark('helper');
    }
    if (Game.unlocks(state).cash) mark('cash');
    if (state.helperLevel && state.helperLevel < 3 && Game.canBuy(state, 'helper')) {
      state = Game.buyStation(state, 'helper', now);
    }
    if (!state.standLevel && Game.canBuy(state, 'stand')) {
      state = Game.buyStation(state, 'stand', now); mark('stand');
    }
    if (state.standLevel && state.standLevel < 5 && Game.canBuy(state, 'stand')) {
      state = Game.buyStation(state, 'stand', now);
    }
    if (!state.officeLevel && Game.canBuy(state, 'office')) {
      state = Game.buyStation(state, 'office', now); mark('office');
    }
    if (state.officeLevel && state.officeLevel < 5 && Game.canBuy(state, 'office')) {
      state = Game.buyStation(state, 'office', now);
    }
    if (Game.unlocks(state).election) mark('reveal');
    if (Game.canRunElection(state)) {
      state = Game.runElection(state, now); mark('finished'); break;
    }
  }

  return {
    clicksPerSecond,
    minutes: goals,
    final: {
      supporters: Math.round(state.supporters), euros: Math.round(state.euros),
      helperLevel: state.helperLevel, standLevel: state.standLevel, officeLevel: state.officeLevel,
    },
  };
}

if (require.main === module) console.log(JSON.stringify([2, 4, 6].map(simulate), null, 2));
module.exports = { simulate };
