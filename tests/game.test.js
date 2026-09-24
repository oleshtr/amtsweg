const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../src/game.js');
const { simulate } = require('../scripts/balance.cjs');
const C = Game.CONFIG;
const fresh = () => Game.createInitialState(1000);
const withResources = (state, supporters, euros) => ({ ...state, supporters, euros });

test('fresh start is simple and has no passive systems', () => {
  const s = fresh();
  assert.equal(s.supporters, 0);
  assert.equal(s.euros, 0);
  assert.equal(s.helperLevel, 0);
  assert.equal(Game.supporterRate(s), 0);
  assert.equal(Game.unlocks(s).cash, false);
});

test('every flyer click gives one supporter immediately', () => {
  let s = fresh();
  for (let i = 0; i < 100; i += 1) s = Game.distributeFlyer(s, 1000);
  assert.equal(s.supporters, 100);
  assert.equal(Game.flyerOutput(), 1);
});

test('first helper unlocks at twenty five supporters and is free', () => {
  let s = withResources(fresh(), C.helper.unlockSupporters - 1, 0);
  assert.equal(Game.canBuy(s, 'helper'), false);
  s.supporters += 1;
  assert.equal(Game.stationCost('helper', 0), 0);
  assert.equal(Game.canBuy(s, 'helper'), true);
  s = Game.buyStation(s, 'helper', 1000);
  assert.equal(s.helperLevel, 1);
  assert.equal(Game.worldStage(s), 1);
});

test('helper creates real supporter cycles, not hidden queue output', () => {
  let s = Game.buyStation(withResources(fresh(), C.helper.unlockSupporters, 0), 'helper', 1000);
  const start = s.supporters;
  for (let i = 1; i <= 4; i += 1) s = Game.tick(s, 1, 1000 + i * 1000);
  assert.ok(s.supporters > start);
  assert.equal('contacts' in s, false);
});

test('cash unlocks only after helper and fifty supporters', () => {
  let s = withResources(fresh(), C.cashUnlockSupporters, 0);
  assert.equal(Game.unlocks(s).cash, false);
  s.helperLevel = 1;
  assert.equal(Game.unlocks(s).cash, true);
  assert.equal(Game.worldStage(s), 2);
});

test('donations happen in discrete supporter milestones', () => {
  let s = withResources(fresh(), C.cashUnlockSupporters, 0);
  s.helperLevel = 1;
  for (let i = 0; i < C.donation.supportersPerDonation - 1; i += 1) s = Game.distributeFlyer(s, 1000);
  assert.equal(s.euros, 0);
  s = Game.distributeFlyer(s, 1000);
  assert.equal(s.euros, C.donation.baseEuros);
  assert.equal(s.donationProgress, 0);
});

test('helper upgrades cost money and increase automated rate', () => {
  let s = withResources(fresh(), C.cashUnlockSupporters, 100);
  s.helperLevel = 1;
  const first = Game.helperRate(s);
  s = Game.buyStation(s, 'helper', 1000);
  assert.equal(s.helperLevel, 2);
  assert.ok(Game.helperRate(s) > first);
  assert.ok(Game.stationCost('helper', 2) > Game.stationCost('helper', 1));
});

test('infostand unlocks after helper progression and boosts helper yield', () => {
  let s = withResources(fresh(), C.stand.unlockSupporters, 1000);
  s.helperLevel = C.stand.unlockHelperLevel;
  const before = Game.supporterRate(s);
  s = Game.buyStation(s, 'stand', 1000);
  assert.equal(s.standLevel, 1);
  assert.ok(Game.supporterRate(s) > before);
});

test('office increases the value of visible donation events', () => {
  let s = withResources(fresh(), C.office.unlockSupporters, 1000);
  s.helperLevel = 5;
  s.standLevel = C.office.unlockStandLevel;
  const before = Game.donationValue(s);
  s = Game.buyStation(s, 'office', 1000);
  assert.equal(s.officeLevel, 1);
  assert.ok(Game.donationValue(s) > before);
});

test('election chain still cannot be skipped', () => {
  let s = withResources(fresh(), C.election.targetSupporters, C.election.entryCost);
  assert.equal(Game.canRunElection(s), false);
  s = Game.normalizeState({ ...s, helperLevel: 0, standLevel: 10, officeLevel: 10 });
  assert.equal(s.standLevel, 0);
  assert.equal(s.officeLevel, 0);
});

test('old saves normalize into the simple loop', () => {
  const old = Game.normalizeState({ supporters: 100, contacts: 17, euros: -3,
    helperProgress: Infinity, helpers: 2, fundraisingBuffer: 10, campaignLevel: 15 }, 9000);
  assert.equal(old.supporters, 117);
  assert.equal(old.euros, 0);
  assert.equal(old.helperLevel, 2);
  assert.equal(old.helperProgress, 0);
  assert.equal('contacts' in old, false);
  assert.equal('campaignLevel' in old, false);
});

test('active replay preserves helper cash stand office election order', () => {
  const m = simulate(4).minutes;
  assert.ok(m.helper < m.cash);
  assert.ok(m.cash < m.stand);
  assert.ok(m.stand < m.office);
  assert.ok(m.office < m.finished);
});
