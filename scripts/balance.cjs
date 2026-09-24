// V0.3 active replay for the spammable manual action.
const Game = require('../src/game.js');
const stepMs = 50;

function simulate(clicksPerSecond = 4) {
  const goals = {};
  let state = Game.createInitialState(1000);
  let now = 1000;
  let nextClickAt = now;
  const clickInterval = 1000 / clicksPerSecond;
  const mark = name => {
    if (!(name in goals)) goals[name] = Math.round((now - 1000) / 6000) / 10;
  };

  for (; now < 1000 + 45 * 60 * 1000; now += stepMs) {
    const minutePosition = ((now - 1000) % 60000) / 1000;
    const manuallyActive = !state.helperCount || minutePosition < 15;

    while (manuallyActive && now >= nextClickAt && !state.electionFinished) {
      state = Game.distributeFlyer(state, now);
      nextClickAt += clickInterval;
    }
    if (!manuallyActive && now >= nextClickAt) nextClickAt = now + clickInterval;

    state = Game.tick(state, stepMs / 1000, now);

    if (!state.helperCount && Game.canBuy(state, 'helper')) {
      state = Game.buyStation(state, 'helper', now); mark('helper1');
    }
    if (Game.unlocks(state).cash) mark('cash');

    if (state.helperCount > 0 && state.helperCount < 5 && Game.canBuy(state, 'helper')) {
      state = Game.buyStation(state, 'helper', now);
      if (state.helperCount === 3) mark('helper3');
      if (state.helperCount === 5) mark('helper5');
    }

    if (!state.standLevel && Game.canBuy(state, 'stand')) {
      state = Game.buyStation(state, 'stand', now); mark('stand1');
    }
    if (state.standLevel > 0 && state.standLevel < 3 && Game.canBuy(state, 'stand')) {
      state = Game.buyStation(state, 'stand', now);
      if (state.standLevel === 3) mark('stand3');
    }

    if (!state.officeLevel && Game.canBuy(state, 'office')) {
      state = Game.buyStation(state, 'office', now); mark('office1');
    }
    if (state.officeLevel > 0 && state.officeLevel < 3 && Game.canBuy(state, 'office')) {
      state = Game.buyStation(state, 'office', now);
      if (state.officeLevel === 3) mark('office3');
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
      supporters: Math.round(state.supporters),
      euros: Math.round(state.euros),
      helperCount: state.helperCount,
      standLevel: state.standLevel,
      officeLevel: state.officeLevel,
      careerPoints: state.careerPoints,
    },
  };
}

if (require.main === module) console.log(JSON.stringify([2, 4, 6].map(simulate), null, 2));
module.exports = { simulate };
