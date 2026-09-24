const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../src/game.js');
const { simulate } = require('../scripts/balance.cjs');
const C = Game.CONFIG;
const fresh = () => Game.createInitialState(1000);
const withResources = (state, supporters, euros) => ({ ...state, supporters, euros });

test('fresh start has only supporters and no passive production', () => {
  const s = fresh();
  assert.equal(Game.worldStage(s), 0);
  assert.equal(s.supporters, 0);
  assert.equal(s.euros, 0);
  assert.equal(s.helperLevel, 0);
  assert.equal(Game.supporterRate(s), 0);
  assert.equal(Game.euroRate(s), 0);
  assert.equal(Game.unlocks(s).cash, false);
  assert.equal('contacts' in s, false);
});

test('ten and one hundred rapid clicks award exactly one supporter each', () => {
  let s = fresh();
  for (let i = 0; i < 10; i += 1) s = Game.distributeFlyer(s, 1000);
  assert.equal(s.supporters, 10);
  for (let i = 0; i < 90; i += 1) s = Game.distributeFlyer(s, 1000);
  assert.equal(s.supporters, 100);
  assert.equal(Game.flyerOutput(), 1);
  assert.equal('contacts' in s, false);
});

test('helper appears at thirty supporters and requires no early cash', () => {
  let s = withResources(fresh(), C.helper.unlockSupporters - 1, 0);
  assert.equal(Game.unlocks(s).helper, false);
  assert.equal(Game.canBuy(s, 'helper'), false);
  s.supporters += 1;
  assert.equal(Game.unlocks(s).helper, true);
  assert.equal(Game.stationCost('helper', 0), 0);
  s = Game.buyStation(s, 'helper', 1000);
  assert.equal(s.helperLevel, 1);
  assert.equal(s.supporters, C.helper.unlockSupporters);
  assert.equal(Game.worldStage(s), 1);
});

test('helper awards supporters in completed cycles without a queue', () => {
  let s = Game.buyStation(withResources(fresh(), C.helper.unlockSupporters, 0), 'helper', 1000);
  s = Game.tick(s, 0.4, 1400);
  assert.equal(s.supporters, C.helper.unlockSupporters);
  assert.ok(s.helperProgress > 0);
  s = Game.tick(s, 0.4, 1800);
  assert.equal(s.supporters, C.helper.unlockSupporters + 1);
  assert.ok(s.helperProgress < 1);
});

test('helper upgrade improves automated rate after the cash reveal', () => {
  let s = withResources(fresh(), C.cashUnlockSupporters, 100);
  s.helperLevel = 1;
  const first = Game.helperRate(s);
  s = Game.buyStation(s, 'helper', 1000);
  assert.equal(s.helperLevel, 2);
  assert.ok(Game.helperRate(s) > first);
  assert.ok(Game.stationCost('helper', 2) > Game.stationCost('helper', 1));
  assert.deepEqual(C.helper.milestones, [1, 5, 10, 20]);
});

test('cash follows the helper and seventy five supporters', () => {
  let s = withResources(fresh(), C.cashUnlockSupporters, 0);
  assert.equal(Game.unlocks(s).cash, false);
  s.helperLevel = 1;
  s.supporters -= 1;
  assert.equal(Game.unlocks(s).cash, false);
  s.supporters += 1;
  assert.equal(Game.unlocks(s).cash, true);
  assert.equal(Game.worldStage(s), 2);
  assert.ok(Game.euroRate(s) > 0);
  const before = s.euros;
  s = Game.tick(s, 1, 2000);
  assert.ok(s.euros > before);
});

test('infostand multiplies helper output without processing contacts', () => {
  let s = withResources(fresh(), C.stand.unlockSupporters, 10000);
  s.helperLevel = C.stand.unlockHelperLevel;
  const before = Game.supporterRate(s);
  s = Game.buyStation(s, 'stand', 1000);
  assert.equal(s.standLevel, 1);
  assert.ok(Game.supporterRate(s) > before);
  assert.equal('contacts' in s, false);
});

test('office gate and fundraising multiplier remain functional', () => {
  let s = withResources(fresh(), C.office.unlockSupporters, 1000);
  s.helperLevel = 5;
  s.standLevel = 9;
  assert.equal(Game.canBuy(s, 'office'), false);
  s.standLevel = 10;
  const before = Game.euroRate(s);
  s = Game.buyStation(s, 'office', 1000);
  assert.equal(s.officeLevel, 1);
  assert.ok(Game.euroRate(s) > before);
});

test('election cannot skip the helper, stand or office', () => {
  let s = withResources(fresh(), C.election.targetSupporters, C.election.entryCost);
  assert.equal(Game.canRunElection(s), false);
  s = Game.normalizeState({ ...s, helperLevel: 0, standLevel: 10, officeLevel: 10 });
  assert.equal(s.standLevel, 0);
  assert.equal(s.officeLevel, 0);
  s.helperLevel = 5; s.standLevel = 10; s.officeLevel = 5;
  assert.equal(Game.canRunElection(s), true);
  s = Game.runElection(s, 2000);
  assert.equal(Game.worldStage(s), 6);
});

test('old buffered saves convert pending contacts once and sanitize values', () => {
  const old = Game.normalizeState({ supporters: 100, contacts: 17, euros: -3,
    helperProgress: Infinity, helpers: 2, fundraisingBuffer: 10,
    campaignLevel: 15 }, 9000);
  assert.equal(old.supporters, 117);
  assert.equal(old.euros, 0);
  assert.equal(old.helperLevel, 2);
  assert.equal(old.helperProgress, 0);
  assert.equal('contacts' in old, false);
  assert.equal('campaignLevel' in old, false);
  assert.deepEqual(Game.normalizeState(old, 10000), old);
});

test('active replay unlocks helper before cash and preserves later order', () => {
  for (const clicksPerSecond of [2, 4, 6]) {
    const m = simulate(clicksPerSecond).minutes;
    assert.ok(m.helper < m.cash, `${clicksPerSecond} clicks/s`);
    assert.ok(m.cash < m.stand);
    assert.ok(m.stand < m.office);
    assert.ok(m.office < m.finished);
  }
});
