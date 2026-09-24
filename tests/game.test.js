const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../src/game.js');
const { simulate } = require('../scripts/balance.cjs');
const C = Game.CONFIG;
const fresh = () => Game.createInitialState(1000);
const withResources = (state, supporters, euros) => ({ ...state, supporters, euros });

test('fresh save starts with empty production buffers', () => {
  const s = fresh();
  assert.equal(Game.worldStage(s), 0);
  assert.equal(s.contacts, 0);
  assert.equal(s.supporters, 0);
  assert.equal(s.fundraisingBuffer, 0);
  assert.equal(s.campaignLevel, 1);
  assert.equal(Game.unlocks(s).cash, false);
});

test('rapid flyer clicks create contacts, not instant supporters', () => {
  let s = fresh();
  for (let i = 0; i < 10; i += 1) s = Game.distributeFlyer(s, 1000);
  assert.equal(s.contacts, 10);
  assert.equal(s.supporters, 0);
  assert.equal(Game.flyerOutput(s), 1);
});

test('campaign point processes queued contacts into supporters', () => {
  let s = { ...fresh(), contacts: 10 };
  const capacity = Game.campaignCapacity(s);
  s = Game.tick(s, 1, 2000);
  assert.equal(s.contacts, 10 - capacity);
  assert.equal(s.supporters, capacity);
  assert.ok(s.fundraisingBuffer > 0);
});

test('campaign upgrades increase processing capacity', () => {
  const s = fresh();
  assert.ok(Game.campaignCapacity({ ...s, campaignLevel: 5 }) > Game.campaignCapacity(s));
  assert.ok(Game.campaignCapacity({ ...s, campaignLevel: 10 }) >
    Game.campaignCapacity({ ...s, campaignLevel: 5 }));
  assert.deepEqual(C.campaign.milestones, [2, 3, 5, 10, 20]);
});

test('cash unlocks early but only fundraising drains donation potential', () => {
  let s = { ...fresh(), supporters: C.cashUnlockSupporters, fundraisingBuffer: 5 };
  assert.equal(Game.unlocks(s).cash, true);
  const before = s.fundraisingBuffer;
  s = Game.tick(s, 1, 2000);
  assert.ok(s.euros > 0);
  assert.ok(s.fundraisingBuffer < before);
  assert.ok(Game.fundraisingCapacity({ ...s, supporters: 200 }) >
    Game.fundraisingCapacity({ ...s, supporters: 20 }));
});

test('campaign purchases still use supporter gates then cash', () => {
  let s = fresh();
  s.supporters = C.campaign.freeSupporters[2];
  s = Game.buyStation(s, 'campaign', 1000);
  assert.equal(s.campaignLevel, 2);
  s.supporters = C.campaign.freeSupporters[3];
  s = Game.buyStation(s, 'campaign', 1000);
  assert.equal(s.campaignLevel, 3);
  s.supporters = C.cashUnlockSupporters;
  s.euros = Game.stationCost('campaign', 3);
  s = Game.buyStation(s, 'campaign', 1000);
  assert.equal(s.campaignLevel, 4);
});

test('helper automates contact production instead of direct supporters', () => {
  let s = withResources(fresh(), C.helper.unlockSupporters, C.helper.buildCost);
  s.campaignLevel = C.helper.unlockCampaignLevel;
  s = Game.buyStation(s, 'helper', 1000);
  const beforeContacts = s.contacts;
  s = Game.tick(s, 1, 2000);
  assert.ok(s.contacts >= beforeContacts);
  assert.equal(s.helperLevel, 1);
  assert.equal(Game.helperRate(s), C.helper.basePerSecond);
});

test('contact bottleneck is visible in logic when queue outruns processing', () => {
  const s = { ...fresh(), contacts: Game.campaignCapacity(fresh()) * 4 };
  assert.equal(Game.bottlenecks(s).campaign, true);
});

test('stand adds processing capacity and conversion value', () => {
  let s = withResources(fresh(), C.stand.unlockSupporters, 10000);
  s.helperLevel = C.stand.unlockHelperLevel;
  s = Game.buyStation(s, 'stand', 1000);
  assert.equal(s.standLevel, 1);
  assert.ok(Game.contactProcessingCapacity(s) > Game.campaignCapacity(s));
  assert.ok(Game.supporterConversionMultiplier(s) > 1);
});

test('office gate still follows stand level and supporter threshold', () => {
  let s = withResources(fresh(), C.office.unlockSupporters, 1000);
  s.helperLevel = 5;
  s.standLevel = 9;
  assert.equal(Game.canBuy(s, 'office'), false);
  s.standLevel = 10;
  assert.equal(Game.canBuy(s, 'office'), true);
});

test('office raises fundraising capacity subject to its cap', () => {
  let s = withResources(fresh(), C.office.unlockSupporters, 10000);
  s.helperLevel = 5;
  s.standLevel = 10;
  const before = Game.fundraisingCapacity(s);
  s = Game.buyStation(s, 'office', 1000);
  assert.ok(Game.fundraisingCapacity(s) > before);
});

test('election cannot be revealed by skipping the production chain', () => {
  let s = withResources(fresh(), 5000, 5000);
  assert.equal(Game.unlocks(s).election, false);
  s = Game.normalizeState({ ...s, helperLevel: 0, standLevel: 10, officeLevel: 10 });
  assert.equal(s.officeLevel, 0);
});

test('election finish remains fail-closed', () => {
  let s = withResources(fresh(), C.election.targetSupporters, C.election.entryCost);
  s.helperLevel = 5; s.standLevel = 10; s.officeLevel = 5;
  assert.equal(Game.canRunElection(s), true);
  s = Game.runElection(s, 2000);
  assert.equal(s.electionFinished, true);
  assert.equal(Game.worldStage(s), 6);
});

test('normalization migrates old saves with safe empty buffers', () => {
  const old = Game.normalizeState({ supporters: 100, euros: 5, helpers: 2 }, 9000);
  assert.equal(old.contacts, 0);
  assert.equal(old.fundraisingBuffer, 0);
  assert.equal(old.campaignLevel, 1);
  assert.equal(old.helperLevel, 2);
});

test('active replay keeps the stage order with the buffered economy', () => {
  const run = simulate(4);
  const m = run.minutes;
  assert.ok(m.cash < m.helper);
  assert.ok(m.helper < m.stand);
  assert.ok(m.stand < m.office);
  assert.ok(m.office < m.finished);
});
