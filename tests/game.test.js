const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../src/game.js');
const C = Game.CONFIG;
const fresh = () => Game.createInitialState(1000);
const withResources = (state, supporters, euros) => ({ ...state, supporters, euros });

test('fresh save exposes only stage zero and hides cash', () => {
  const s = fresh();
  assert.equal(Game.worldStage(s), 0);
  assert.equal(Game.unlocks(s).cash, false);
  assert.equal(Game.euroRate(s), 0);
  assert.equal(Game.supporterRate(s), 0);
});

test('cash unlocks at 50 and follows the supporter formula', () => {
  assert.equal(Game.unlocks(withResources(fresh(), 49, 0)).cash, false);
  const s = withResources(fresh(), 50, 0);
  assert.equal(Game.unlocks(s).cash, true);
  assert.equal(Game.euroRate(s), 0.135);
  assert.equal(Game.euroRate(withResources(s, 200, 0)), 0.36);
  assert.ok(Game.tick(s, 1, 2000).euros > 0);
});

test('no manual donation command exists', () => {
  assert.equal(Game.collectDonation, undefined);
  assert.equal(C.donationClickEuros, undefined);
});

test('flyer has a locked action state and awards only after completion', () => {
  let s = Game.startFlyer(fresh(), 1000);
  assert.equal(s.supporters, 0);
  assert.equal(s.flyerEndsAt, 2800);
  assert.deepEqual(Game.startFlyer(s, 1100), s);
  assert.equal(Game.completeFlyer(s, 2799).supporters, 0);
  s = Game.completeFlyer(s, 2800);
  assert.equal(s.supporters, 1);
  assert.equal(s.flyerEndsAt, 0);
  assert.equal(Game.completeFlyer(s, 2900).supporters, 1);
});

test('helper requires cash unlock and money; first purchase automates', () => {
  assert.equal(Game.canBuy(withResources(fresh(), 0, 999), 'helper'), false);
  let s = withResources(fresh(), 50, 45);
  assert.equal(Game.canBuy(s, 'helper'), true);
  s = Game.buyStation(s, 'helper', 1000);
  assert.equal(s.helperLevel, 1);
  assert.equal(s.euros, 0);
  assert.equal(Game.helperRate(s), 0.25);
});

test('helper costs grow and level five changes production', () => {
  let s = withResources(fresh(), 50, 1000);
  assert.equal(Game.stationCost('helper', 0), 45);
  assert.equal(Game.stationCost('helper', 1), 16);
  for (let i = 0; i < 4; i += 1) s = Game.buyStation(s, 'helper', 1000);
  const before = Game.helperRate(s);
  s = Game.buyStation(s, 'helper', 1000);
  assert.equal(s.helperLevel, 5);
  assert.ok(Game.helperRate(s) > before * 1.4);
  assert.deepEqual(C.helper.milestones, [1, 5, 10, 20]);
});

test('stand gate requires helper level five and supporters', () => {
  let s = withResources(fresh(), 150, 1000);
  assert.equal(Game.canBuy(s, 'stand'), false);
  s.helperLevel = 4;
  assert.equal(Game.canBuy(s, 'stand'), false);
  s.helperLevel = 5;
  s.supporters = 149;
  assert.equal(Game.canBuy(s, 'stand'), false);
  s.supporters = 150;
  assert.equal(Game.canBuy(s, 'stand'), true);
});

test('stand level raises capacity and processes helper output', () => {
  let s = withResources(fresh(), 200, 10000);
  s.helperLevel = 10;
  s = Game.buyStation(s, 'stand', 1000);
  assert.equal(s.standLevel, 1);
  assert.equal(Game.standCapacity(s), 0.5);
  assert.equal(Game.bottlenecks(s).stand, true);
  const firstRate = Game.supporterRate(s);
  for (let i = 0; i < 9; i += 1) s = Game.buyStation(s, 'stand', 1000);
  assert.equal(s.standLevel, 10);
  assert.ok(Game.standCapacity(s) > 1);
  assert.ok(Game.supporterRate(s) > firstRate);
});

test('office gate follows stand level ten and 350 supporters', () => {
  let s = withResources(fresh(), 350, 1000);
  s.helperLevel = 5;
  s.standLevel = 9;
  assert.equal(Game.canBuy(s, 'office'), false);
  s.standLevel = 10;
  s.supporters = 349;
  assert.equal(Game.canBuy(s, 'office'), false);
  s.supporters = 350;
  assert.equal(Game.canBuy(s, 'office'), true);
});

test('office levels improve fundraising subject to capacity', () => {
  let s = withResources(fresh(), 350, 10000);
  s.helperLevel = 5;
  s.standLevel = 10;
  const oldRate = Game.euroRate(s);
  s = Game.buyStation(s, 'office', 1000);
  assert.equal(s.officeLevel, 1);
  assert.ok(Game.euroRate(s) >= oldRate);
  const first = Game.euroRate(s);
  for (let i = 0; i < 4; i += 1) s = Game.buyStation(s, 'office', 1000);
  assert.equal(s.officeLevel, 5);
  assert.ok(Game.euroRate(s) > first);
  assert.deepEqual(C.office.milestones, [1, 5, 10, 20]);
});

test('election cannot be revealed or run by skipping the station chain', () => {
  let s = withResources(fresh(), 5000, 5000);
  assert.equal(Game.unlocks(s).election, false);
  assert.equal(Game.canRunElection(s), false);
  s = Game.normalizeState({ ...s, helperLevel: 0, standLevel: 10, officeLevel: 10 });
  assert.equal(s.officeLevel, 0);
  assert.equal(Game.worldStage(s), 1);
});

test('election reveal and finish require office five, supporters and cash', () => {
  let s = withResources(fresh(), 650, 1000);
  s.helperLevel = 5; s.standLevel = 10; s.officeLevel = 4;
  assert.equal(Game.unlocks(s).election, false);
  s.officeLevel = 5;
  assert.equal(Game.unlocks(s).election, true);
  assert.equal(Game.worldStage(s), 5);
  assert.equal(Game.canRunElection(s), false);
  s.supporters = C.election.targetSupporters;
  s.euros = C.election.entryCost - 1;
  assert.equal(Game.canRunElection(s), false);
  s.euros += 1;
  s = Game.runElection(s, 2000);
  assert.equal(s.electionFinished, true);
  assert.equal(Game.worldStage(s), 6);
  assert.equal(Game.tick(s, 1, 3000).supporters, C.election.targetSupporters);
});

test('normalization migrates legacy fields and sanitizes invalid values', () => {
  const old = Game.normalizeState({ supporters: 'NaN', euros: -10, helpers: 2,
    standOwned: true, officeOwned: true, electionFinished: true,
    startedAt: Infinity, lastUpdatedAt: -1 }, 9000);
  assert.equal(old.supporters, 0);
  assert.equal(old.euros, 0);
  assert.equal(old.helperLevel, 2);
  assert.equal(old.standLevel, 0);
  assert.equal(old.officeLevel, 0);
  assert.equal(old.electionFinished, false);
  assert.equal(old.startedAt, 9000);
  assert.equal(old.lastUpdatedAt, 9000);
  assert.deepEqual(Game.normalizeState(JSON.parse(JSON.stringify(old)), 10000), old);
});
