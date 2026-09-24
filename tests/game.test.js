const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../src/game.js');
const { simulate } = require('../scripts/balance.cjs');
const C = Game.CONFIG;
const fresh = () => Game.createInitialState(1000);
const withResources = (state, supporters, euros) => ({ ...state, supporters, euros });

test('fresh save exposes only stage zero and hides cash', () => {
  const s = fresh();
  assert.equal(Game.worldStage(s), 0);
  assert.equal(s.campaignLevel, 1);
  assert.equal(Game.unlocks(s).cash, false);
  assert.equal(Game.euroRate(s), 0);
  assert.equal(Game.supporterRate(s), 0);
});

test('cash unlocks early with a small initial rate', () => {
  assert.equal(Game.unlocks(withResources(fresh(), C.cashUnlockSupporters - 1, 0)).cash, false);
  const s = withResources(fresh(), C.cashUnlockSupporters, 0);
  assert.equal(Game.unlocks(s).cash, true);
  assert.ok(Game.euroRate(s) >= 0.01 && Game.euroRate(s) <= 0.03);
  assert.ok(Game.euroRate(withResources(s, 2000, 0)) > Game.euroRate(s));
  const earlyLift = Game.euroRate(withResources(s, 2000, 0)) - Game.euroRate(s);
  const lateLift = Game.euroRate(withResources(s, 3650, 0)) - Game.euroRate(withResources(s, 2000, 0));
  assert.ok(lateLift < earlyLift, 'fundraising should saturate as the base grows');
  assert.ok(Game.tick(s, 1, 2000).euros > 0);
});

test('active starter replay has early purchases and a helper around minute five', () => {
  const runs = [2, 4, 6].map(simulate);
  const [slow, normal, fast] = runs.map(run => run.minutes);
  for (const run of runs) assert.ok(run.longestEarlyGapSeconds <= 30,
    `${run.clicksPerSecond} clicks/s has a starter gap of ${run.longestEarlyGapSeconds}s`);
  assert.ok(normal.campaign2 <= 0.5);
  assert.ok(normal.cash >= 0.3 && normal.cash <= 0.75);
  assert.ok(normal.campaign5 < 1.5 && normal.campaign10 < 3);
  assert.ok(normal.helper >= 4 && normal.helper <= 6);
  assert.ok(normal.stand > normal.helper && normal.office > normal.stand);
  assert.ok(normal.finished > normal.office);
  for (const key of ['cash', 'helper', 'stand', 'office', 'finished']) {
    assert.ok(fast[key] < normal[key] && normal[key] < slow[key], key);
  }
});

test('no manual donation command exists', () => {
  assert.equal(Game.collectDonation, undefined);
  assert.equal(C.donationClickEuros, undefined);
});

test('every rapid flyer click is accepted and awarded immediately', () => {
  let s = fresh();
  for (let i = 0; i < 10; i += 1) {
    s = Game.distributeFlyer(s, 1000);
    assert.equal(s.supporters, i + 1);
  }
  assert.equal(Game.startFlyer, undefined);
  assert.equal(s.flyerEndsAt, undefined);
  for (let i = 0; i < 90; i += 1) s = Game.distributeFlyer(s, 1000);
  assert.equal(s.supporters, 100);
});

test('campaign costs and manual output grow through visible milestones', () => {
  const s = fresh();
  assert.equal(Game.stationCost('campaign', 1), 0);
  assert.equal(Game.stationCost('campaign', 2), 0);
  assert.equal(Game.stationCost('campaign', 3), C.campaign.upgradeBase);
  assert.ok(Game.stationCost('campaign', 10) > Game.stationCost('campaign', 5));
  assert.equal(Game.flyerOutput(s), 1);
  assert.equal(Game.flyerOutput({ ...s, campaignLevel: 5 }), 2);
  assert.equal(Game.flyerOutput({ ...s, campaignLevel: 10 }), 3);
  assert.equal(Game.flyerOutput({ ...s, campaignLevel: 20 }), 5);
  assert.deepEqual(C.campaign.milestones, [2, 3, 5, 10, 20]);
  assert.equal(Game.distributeFlyer({ ...s, campaignLevel: 10 }, 1000).supporters, 3);
});

test('campaign upgrades need supporter gates first and euros after cash reveal', () => {
  let s = fresh();
  assert.equal(Game.canBuy(s, 'campaign'), false);
  s.supporters = C.campaign.freeSupporters[2];
  s = Game.buyStation(s, 'campaign', 1000);
  assert.equal(s.campaignLevel, 2);
  s.supporters = C.campaign.freeSupporters[3];
  s = Game.buyStation(s, 'campaign', 1000);
  assert.equal(s.campaignLevel, 3);
  assert.equal(Game.canBuy({ ...s, euros: 100 }, 'campaign'), false);
  s.supporters = C.cashUnlockSupporters;
  s.euros = Game.stationCost('campaign', 3);
  s = Game.buyStation(s, 'campaign', 1000);
  assert.equal(s.campaignLevel, 4);
  assert.equal(s.euros, 0);
});

test('helper requires campaign level, supporters and money; first purchase automates', () => {
  assert.equal(Game.canBuy(withResources(fresh(), 0, 999), 'helper'), false);
  let s = withResources(fresh(), C.helper.unlockSupporters, C.helper.buildCost);
  assert.equal(Game.canBuy(s, 'helper'), false);
  s.campaignLevel = C.helper.unlockCampaignLevel;
  assert.equal(Game.canBuy(s, 'helper'), true);
  s = Game.buyStation(s, 'helper', 1000);
  assert.equal(s.helperLevel, 1);
  assert.equal(s.euros, 0);
  assert.equal(Game.helperRate(s), C.helper.basePerSecond);
});

test('helper costs grow and level five changes production', () => {
  let s = withResources(fresh(), C.helper.unlockSupporters, 1000);
  s.campaignLevel = C.helper.unlockCampaignLevel;
  assert.equal(Game.stationCost('helper', 0), C.helper.buildCost);
  assert.equal(Game.stationCost('helper', 1), Math.ceil(C.helper.upgradeBase * C.helper.upgradeGrowth));
  for (let i = 0; i < 4; i += 1) s = Game.buyStation(s, 'helper', 1000);
  const before = Game.helperRate(s);
  s = Game.buyStation(s, 'helper', 1000);
  assert.equal(s.helperLevel, 5);
  assert.ok(Game.helperRate(s) > before * 1.4);
  assert.deepEqual(C.helper.milestones, [1, 5, 10, 20]);
});

test('stand gate requires helper level five and supporters', () => {
  let s = withResources(fresh(), C.stand.unlockSupporters, 1000);
  assert.equal(Game.canBuy(s, 'stand'), false);
  s.helperLevel = 4;
  assert.equal(Game.canBuy(s, 'stand'), false);
  s.helperLevel = 5;
  s.supporters = C.stand.unlockSupporters - 1;
  assert.equal(Game.canBuy(s, 'stand'), false);
  s.supporters = C.stand.unlockSupporters;
  assert.equal(Game.canBuy(s, 'stand'), true);
});

test('stand level raises capacity and processes helper output', () => {
  let s = withResources(fresh(), C.stand.unlockSupporters, 10000);
  s.helperLevel = 10;
  s = Game.buyStation(s, 'stand', 1000);
  assert.equal(s.standLevel, 1);
  assert.equal(Game.standCapacity(s), C.stand.baseCapacityPerSecond);
  assert.equal(Game.bottlenecks(s).stand, true);
  const firstRate = Game.supporterRate(s);
  for (let i = 0; i < 9; i += 1) s = Game.buyStation(s, 'stand', 1000);
  assert.equal(s.standLevel, 10);
  assert.ok(Game.standCapacity(s) > 1);
  assert.ok(Game.supporterRate(s) > firstRate);
});

test('office gate follows stand level ten and the supporter threshold', () => {
  let s = withResources(fresh(), C.office.unlockSupporters, 1000);
  s.helperLevel = 5;
  s.standLevel = 9;
  assert.equal(Game.canBuy(s, 'office'), false);
  s.standLevel = 10;
  s.supporters = C.office.unlockSupporters - 1;
  assert.equal(Game.canBuy(s, 'office'), false);
  s.supporters = C.office.unlockSupporters;
  assert.equal(Game.canBuy(s, 'office'), true);
});

test('office levels improve fundraising subject to capacity', () => {
  let s = withResources(fresh(), C.office.unlockSupporters, 10000);
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
  let s = withResources(fresh(), C.election.revealSupporters, 1000);
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
  assert.equal(old.campaignLevel, 1);
  assert.equal(old.standLevel, 0);
  assert.equal(old.officeLevel, 0);
  assert.equal(old.electionFinished, false);
  assert.equal(old.startedAt, 9000);
  assert.equal(old.lastUpdatedAt, 9000);
  assert.deepEqual(Game.normalizeState(JSON.parse(JSON.stringify(old)), 10000), old);
  const previousV02 = Game.normalizeState({ supporters: 1000, euros: 10,
    helperLevel: 5, standLevel: 1, officeLevel: 0 }, 11000);
  assert.equal(previousV02.campaignLevel, 1);
  assert.equal(previousV02.helperLevel, 5);
  assert.equal(previousV02.standLevel, 1);
});
