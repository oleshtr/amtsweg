const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../src/game.js');

test('start state exposes only the manual supporter loop', () => {
  const state = Game.createInitialState();
  assert.equal(state.supporters, 0);
  assert.equal(state.euros, 0);
  assert.deepEqual(Game.unlocks(state), {
    donations: false,
    helper: false,
    stand: false,
    office: false,
    election: false,
  });
});

test('flyers unlock donations after ten supporters', () => {
  let state = Game.createInitialState();
  for (let i = 0; i < 10; i += 1) state = Game.distributeFlyer(state);
  assert.equal(state.supporters, 10);
  assert.equal(Game.unlocks(state).donations, true);
});

test('helper purchase spends cash and creates passive supporters', () => {
  let state = Game.createInitialState();
  state.supporters = 10;
  state.euros = 20;
  state = Game.buyHelper(state);
  assert.equal(state.helpers, 1);
  assert.equal(state.euros, 0);
  state = Game.tick(state, 10);
  assert.equal(state.supporters, 18);
});

test('stand improves both manual and passive supporter gain', () => {
  let state = Game.createInitialState();
  state.supporters = 35;
  state.euros = 55;
  state = Game.buyStand(state);
  assert.equal(state.standOwned, true);
  assert.equal(Game.flyerGain(state), 2);
  assert.equal(Game.supporterRate(state), 2.2);
});

test('office adds passive donations', () => {
  let state = Game.createInitialState();
  state.supporters = 110;
  state.euros = 140;
  state = Game.buyOffice(state);
  assert.equal(state.officeOwned, true);
  state = Game.tick(state, 10);
  assert.equal(state.euros, 12);
  assert.equal(state.supporters, 155);
});

test('world stage follows earned progression from 0 through 6', () => {
  let state = Game.createInitialState();
  assert.equal(Game.worldStage(state), 0);

  state.supporters = Game.CONFIG.election.unlockSupporters;
  assert.equal(Game.worldStage(state), 1);
  assert.equal(Game.unlocks(state).election, false);

  state.supporters = Game.CONFIG.donationUnlockSupporters;
  assert.equal(Game.worldStage(state), 1);

  state.helpers = 1;
  assert.equal(Game.worldStage(state), 2);

  state.standOwned = true;
  assert.equal(Game.worldStage(state), 3);

  state.officeOwned = true;
  assert.equal(Game.worldStage(state), 4);

  state.supporters = Game.CONFIG.election.unlockSupporters;
  assert.equal(Game.worldStage(state), 5);

  state.electionFinished = true;
  assert.equal(Game.worldStage(state), 6);
});

test('election is fail-closed until office and both requirements are met', () => {
  let state = Game.createInitialState();
  state.supporters = 350;
  state.euros = 180;
  assert.equal(Game.canRunElection(state), false);
  state.officeOwned = true;
  state.supporters = 349;
  assert.equal(Game.canRunElection(state), false);
  state.supporters = 350;
  state.euros = 179;
  assert.equal(Game.canRunElection(state), false);
  state.euros = 180;
  assert.equal(Game.canRunElection(state), true);
  state = Game.runElection(state);
  assert.equal(state.electionFinished, true);
  assert.equal(state.euros, 0);
});

test('finished chapter no longer accrues idle progress', () => {
  let state = Game.createInitialState();
  state.supporters = 350;
  state.euros = 180;
  state.helpers = 3;
  state.officeOwned = true;
  state = Game.runElection(state);
  const finished = Game.tick(state, 60);
  assert.equal(finished.supporters, 350);
});
