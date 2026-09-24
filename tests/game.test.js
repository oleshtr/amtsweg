const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../src/game.js');
const { simulate } = require('../scripts/balance.cjs');
const C = Game.CONFIG;
const fresh = () => Game.createInitialState(1000);
const withResources = (state, supporters, euros) => ({ ...state, supporters, euros });

test('fresh start has only manual play and no passive production', () => {
  const s = fresh();
  assert.equal(s.supporters, 0);
  assert.equal(s.euros, 0);
  assert.equal(s.helperCount, 0);
  assert.equal(Game.supporterRate(s), 0);
  assert.equal(Game.officeRate(s), 0);
  assert.equal(Game.unlocks(s).cash, false);
});

test('manual flyer action has a real cooldown instead of click spam', () => {
  let s = fresh();
  s = Game.distributeFlyer(s, 1000);
  assert.equal(s.supporters, 1);
  const blocked = Game.distributeFlyer(s, 1001);
  assert.equal(blocked.supporters, 1);
  s = Game.distributeFlyer(s, 1000 + C.manual.cooldownMs);
  assert.equal(s.supporters, 2);
});

test('first helper unlocks early, is free and becomes a real count', () => {
  let s = withResources(fresh(), C.helper.unlockSupporters - 1, 0);
  assert.equal(Game.canBuy(s, 'helper'), false);
  s.supporters += 1;
  assert.equal(Game.stationCost('helper', 0), 0);
  s = Game.buyStation(s, 'helper', 2000);
  assert.equal(s.helperCount, 1);
  assert.equal(Game.worldStage(s), 1);
});

test('every purchased helper increases actual automated cycle throughput', () => {
  let s = withResources(fresh(), C.donation.unlockSupporters + 50, 100);
  s.helperCount = 1;
  const one = Game.helperRate(s);
  s = Game.buyStation(s, 'helper', 2000);
  assert.equal(s.helperCount, 2);
  assert.ok(Game.helperRate(s) > one);
});

test('helper milestones create meaningful production jumps', () => {
  let s = withResources(fresh(), 500, 500);
  s.helperCount = 2;
  const before = Game.helperRate(s);
  s = Game.buyStation(s, 'helper', 2000);
  assert.equal(s.helperCount, 3);
  assert.ok(Game.helperRate(s) / before > 1.5);
});

test('cash appears only after automation and supporter threshold', () => {
  let s = withResources(fresh(), C.donation.unlockSupporters, 0);
  assert.equal(Game.unlocks(s).cash, false);
  s.helperCount = 1;
  assert.equal(Game.unlocks(s).cash, true);
});

test('organic donations are tied to supporter gains', () => {
  let s = withResources(fresh(), C.donation.unlockSupporters, 0);
  s.helperCount = 1;
  s.lastManualAt = 0;
  const step = C.manual.cooldownMs + 1;
  for (let i = 1; i <= C.donation.supportersPerDonation; i += 1) s = Game.distributeFlyer(s, 1000 + i * step);
  assert.ok(s.euros >= C.donation.baseEuros);
});

test('infostand is its own production station, not a helper multiplier', () => {
  let s = withResources(fresh(), C.stand.unlockSupporters, 1000);
  s.helperCount = C.stand.unlockHelpers;
  const helperBefore = Game.helperRate(s);
  s = Game.buyStation(s, 'stand', 2000);
  assert.equal(s.standLevel, 1);
  assert.equal(Game.helperRate(s), helperBefore);
  assert.ok(Game.standRate(s) > 0);
  assert.ok(Game.supporterRate(s) > helperBefore);
});

test('office produces euros in independent visible cycles', () => {
  let s = withResources(fresh(), C.office.unlockSupporters, 1000);
  s.helperCount = 5;
  s.standLevel = C.office.unlockStandLevel;
  s = Game.buyStation(s, 'office', 2000);
  assert.equal(s.officeLevel, 1);
  assert.ok(Game.officeOutputPerCycle(s) > 0);
  const before = s.euros;
  for (let i = 0; i < 8; i += 1) s = Game.tick(s, 2, 3000 + i * 2000);
  assert.ok(s.euros > before);
});

test('election cannot be skipped without the full station chain', () => {
  let s = withResources(fresh(), 5000, 5000);
  assert.equal(Game.canRunElection(s), false);
  const normalized = Game.normalizeState({ ...s, helperCount: 0, standLevel: 10, officeLevel: 10 });
  assert.equal(normalized.standLevel, 0);
  assert.equal(normalized.officeLevel, 0);
});

test('winning grants permanent experience and next district keeps only meta progress', () => {
  let s = withResources(fresh(), C.election.targetSupporters, C.election.entryCost + 100);
  s.helperCount = 5;
  s.standLevel = 3;
  s.officeLevel = 3;
  assert.equal(Game.canRunElection(s), true);
  s = Game.runElection(s, 20000);
  assert.equal(s.electionFinished, true);
  assert.ok(s.careerPoints >= 1);
  const multiplier = Game.careerMultiplier(s);
  const next = Game.startNextDistrict(s, 21000);
  assert.equal(next.district, 2);
  assert.equal(next.supporters, 0);
  assert.equal(next.helperCount, 0);
  assert.equal(next.careerPoints, s.careerPoints);
  assert.equal(Game.careerMultiplier(next), multiplier);
});

test('offline progress is capped and only exists after first automation', () => {
  let s = fresh();
  let result = Game.applyOfflineProgress({ ...s, lastUpdatedAt: 1000 }, 1000 + 60 * 60 * 1000);
  assert.equal(result.seconds, 0);
  s = withResources(fresh(), 100, 0);
  s.helperCount = 2;
  s.lastUpdatedAt = 1000;
  result = Game.applyOfflineProgress(s, 1000 + 5 * 60 * 60 * 1000);
  assert.equal(result.seconds, C.offline.maxSeconds);
  assert.ok(result.state.supporters > s.supporters);
});

test('v0.2 saves migrate helperLevel into helperCount', () => {
  const old = Game.normalizeState({ supporters: 100, contacts: 17, euros: -3, helperLevel: 2,
    standLevel: 0, officeLevel: 0, campaignLevel: 15 }, 9000);
  assert.equal(old.supporters, 117);
  assert.equal(old.euros, 0);
  assert.equal(old.helperCount, 2);
  assert.equal('campaignLevel' in old, false);
});

test('balanced active replay preserves progression and finishes first district in target corridor', () => {
  const m = simulate(35).minutes;
  assert.ok(m.helper1 < m.cash);
  assert.ok(m.cash < m.stand1);
  assert.ok(m.stand1 < m.office1);
  assert.ok(m.office1 < m.reveal);
  assert.ok(m.reveal < m.finished);
  assert.ok(m.finished >= 10 && m.finished <= 24, 'finished at ' + m.finished + ' minutes');
});
