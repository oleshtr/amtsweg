// Active replay for the buffered production chain.
const Game = require('../src/game.js');
const stepMs = 100;

function simulate(clicksPerSecond) {
  const goals = {};
  const earlyEvents = [];
  let state = Game.createInitialState(1000);
  let now = 1000;
  let nextClickAt = now;
  let clicks = 0;
  const interval = 1000 / clicksPerSecond;
  const mark = name => {
    if (!(name in goals)) goals[name] = Math.round((now - 1000) / 6000) / 10;
  };
  const early = name => earlyEvents.push({ event: name, seconds: Math.round((now - 1000) / 1000) });

  for (; now < 1000 + 120 * 60 * 1000; now += stepMs) {
    while (now >= nextClickAt && !state.electionFinished) {
      if (!state.helperLevel || ((now - 1000) % 60000 < 15000)) {
        state = Game.distributeFlyer(state, now);
        clicks += 1;
      }
      nextClickAt += interval;
    }

    state = Game.tick(state, stepMs / 1000, now);

    if (state.campaignLevel < 18 && Game.canBuy(state, 'campaign') && !state.helperLevel) {
      state = Game.buyStation(state, 'campaign', now);
      if (state.campaignLevel === 2) { mark('campaign2'); early('campaign2'); }
      if (state.campaignLevel === 5) { mark('campaign5'); early('campaign5'); }
      if (state.campaignLevel === 10) { mark('campaign10'); early('campaign10'); }
    }
    if (Game.unlocks(state).cash && !('cash' in goals)) { mark('cash'); early('cash'); }
    if (!state.helperLevel && Game.canBuy(state, 'helper')) {
      state = Game.buyStation(state, 'helper', now); mark('helper'); early('helper');
    }
    if (state.helperLevel && state.helperLevel < 5 && Game.canBuy(state, 'helper')) {
      state = Game.buyStation(state, 'helper', now);
      if (state.helperLevel === 5) mark('helper5');
    }
    if (!state.standLevel && Game.canBuy(state, 'stand')) {
      state = Game.buyStation(state, 'stand', now); mark('stand');
    }
    if (state.standLevel && state.standLevel < 10 && Game.canBuy(state, 'stand')) {
      state = Game.buyStation(state, 'stand', now);
      if (state.standLevel === 10) mark('stand10');
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

  const gaps = earlyEvents.slice(1).map((event, index) => event.seconds - earlyEvents[index].seconds);
  return {
    clicksPerSecond, clicks, minutes: goals, earlyEvents,
    longestEarlyGapSeconds: Math.max(earlyEvents[0]?.seconds || 0, ...gaps, 0),
    final: {
      contacts: Math.round(state.contacts), supporters: Math.round(state.supporters),
      fundraisingBuffer: Math.round(state.fundraisingBuffer * 100) / 100,
      euros: Math.round(state.euros), campaignLevel: state.campaignLevel,
      helperLevel: state.helperLevel, standLevel: state.standLevel, officeLevel: state.officeLevel,
    },
  };
}

if (require.main === module) console.log(JSON.stringify([2, 4, 6].map(simulate), null, 2));
module.exports = { simulate };
