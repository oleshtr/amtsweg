(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AmtswegGame = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const CONFIG = Object.freeze({
    saveKey: 'amtsweg-v0.2-save', legacySaveKey: 'amtsweg-v0.1-save',
    tickMs: 250, saveMs: 3000, flyerSupportersPerClick: 1,
    cashUnlockSupporters: 75,
    fundraising: Object.freeze({
      baseCapacityPerSecond: 0.03,
      supporterCapacityScale: 0.0003,
    }),
    visual: Object.freeze({
      maxFlyerParticles: 12, maxArmAnimations: 4,
      maxFloatingTexts: 8, maxRecipients: 4,
      flyerAnimationMs: 450, pressMs: 130,
      reactionMs: 360, coinIntervalMs: 5000,
      supporterCheerStep: 200, supporterCheerMs: 900,
    }),
    helper: Object.freeze({
      buildCost: 0, unlockSupporters: 30,
      upgradeBase: 4, upgradeGrowth: 1.32,
      basePerSecond: 1.25, levelBonus: 0.16, milestone5Multiplier: 1.4,
      milestones: Object.freeze([1, 5, 10, 20]),
    }),
    stand: Object.freeze({
      unlockHelperLevel: 5, unlockSupporters: 900, buildCost: 150,
      upgradeBase: 27, upgradeGrowth: 1.18, baseCapacityPerSecond: 2,
      capacityPerLevel: 0.4, outputMultiplier: 1.3, multiplierPerLevel: 0.018,
      milestones: Object.freeze([1, 5, 10, 20]),
    }),
    office: Object.freeze({
      unlockStandLevel: 10, unlockSupporters: 2200, buildCost: 350,
      upgradeBase: 90, upgradeGrowth: 1.27, fundraisingMultiplier: 1.8,
      multiplierPerLevel: 0.1, baseCapacityPerSecond: 2.2, capacityPerLevel: 0.15,
      milestones: Object.freeze([1, 5, 10, 20]),
    }),
    election: Object.freeze({
      revealOfficeLevel: 5, revealSupporters: 4500,
      targetSupporters: 6500, entryCost: 1100,
    }),
  });

  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const nonnegative = value => Math.max(0, finite(value));
  const money = value => Math.round((value + Number.EPSILON) * 100) / 100;
  const level = value => Math.min(1000, Math.floor(nonnegative(value)));

  function createInitialState(now = Date.now()) {
    return {
      supporters: 0, euros: 0, helperProgress: 0,
      helperLevel: 0, standLevel: 0, officeLevel: 0,
      electionFinished: false, startedAt: now, lastUpdatedAt: now,
    };
  }

  function normalizeState(input, now = Date.now()) {
    const source = input && typeof input === 'object' ? input : {};
    const helperLevel = level(source.helperLevel ?? source.helpers);
    const standLevel = level(source.standLevel ?? (source.standOwned ? 1 : 0));
    const officeLevel = level(source.officeLevel ?? (source.officeOwned ? 1 : 0));
    const safeStand = helperLevel >= CONFIG.stand.unlockHelperLevel ? standLevel : 0;
    const safeOffice = safeStand >= CONFIG.office.unlockStandLevel ? officeLevel : 0;
    // Pending contacts from the buffered V0.2 build become supporters on load.
    const supporters = nonnegative(source.supporters) + nonnegative(source.contacts);
    const finished = Boolean(source.electionFinished) &&
      safeOffice >= CONFIG.election.revealOfficeLevel &&
      supporters >= CONFIG.election.targetSupporters;
    return {
      supporters,
      euros: nonnegative(source.euros),
      helperProgress: Math.min(0.999999, nonnegative(source.helperProgress)),
      helperLevel, standLevel: safeStand, officeLevel: safeOffice,
      electionFinished: finished,
      startedAt: nonnegative(source.startedAt) || now,
      lastUpdatedAt: nonnegative(source.lastUpdatedAt) || now,
    };
  }

  function stationCost(station, currentLevel) {
    const settings = CONFIG[station];
    if (!settings || !Object.hasOwn(settings, 'buildCost')) return Infinity;
    return currentLevel === 0 ? settings.buildCost :
      Math.ceil(settings.upgradeBase * settings.upgradeGrowth ** currentLevel);
  }

  function flyerOutput() {
    return CONFIG.flyerSupportersPerClick;
  }

  function helperRate(state) {
    const n = state.helperLevel;
    return n ? CONFIG.helper.basePerSecond * (1 + (n - 1) * CONFIG.helper.levelBonus) *
      (n >= 5 ? CONFIG.helper.milestone5Multiplier : 1) : 0;
  }

  function supporterConversionMultiplier(state) {
    return state.standLevel ? CONFIG.stand.outputMultiplier +
      (state.standLevel - 1) * CONFIG.stand.multiplierPerLevel : 1;
  }

  function throughput(state) {
    return helperRate(state);
  }

  function supporterRate(state) {
    return throughput(state) * supporterConversionMultiplier(state);
  }

  function fundraisingCapacity(state) {
    if (!unlocks(state).cash) return 0;
    const organic = CONFIG.fundraising.baseCapacityPerSecond +
      state.supporters * CONFIG.fundraising.supporterCapacityScale;
    if (!state.officeLevel) return organic;
    const multiplier = CONFIG.office.fundraisingMultiplier +
      (state.officeLevel - 1) * CONFIG.office.multiplierPerLevel;
    const officeCap = CONFIG.office.baseCapacityPerSecond +
      (state.officeLevel - 1) * CONFIG.office.capacityPerLevel;
    return Math.max(organic, Math.min(organic * multiplier, officeCap));
  }

  function rawCashRate(state) {
    if (!unlocks(state).cash) return 0;
    return CONFIG.fundraising.baseCapacityPerSecond +
      state.supporters * CONFIG.fundraising.supporterCapacityScale;
  }

  function euroRate(state) {
    return fundraisingCapacity(state);
  }

  function bottlenecks(state) {
    const office = state.officeLevel > 0 && rawCashRate(state) *
      (CONFIG.office.fundraisingMultiplier + (state.officeLevel - 1) * CONFIG.office.multiplierPerLevel) >
      CONFIG.office.baseCapacityPerSecond + (state.officeLevel - 1) * CONFIG.office.capacityPerLevel;
    return { office };
  }

  function unlocks(state) {
    return {
      cash: state.helperLevel > 0 && state.supporters >= CONFIG.cashUnlockSupporters,
      helper: state.supporters >= CONFIG.helper.unlockSupporters || state.helperLevel > 0,
      stand: state.helperLevel >= CONFIG.stand.unlockHelperLevel &&
        state.supporters >= CONFIG.stand.unlockSupporters,
      office: state.standLevel >= CONFIG.office.unlockStandLevel &&
        state.supporters >= CONFIG.office.unlockSupporters,
      election: state.officeLevel >= CONFIG.election.revealOfficeLevel &&
        state.supporters >= CONFIG.election.revealSupporters,
    };
  }

  function worldStage(state) {
    if (state.electionFinished) return 6;
    if (unlocks(state).election) return 5;
    if (state.officeLevel) return 4;
    if (state.standLevel) return 3;
    if (unlocks(state).cash) return 2;
    if (state.helperLevel) return 1;
    return 0;
  }

  function canBuy(state, station) {
    if (state.electionFinished || !['helper', 'stand', 'office'].includes(station)) return false;
    if (station === 'helper' && state.helperLevel > 0 && !unlocks(state).cash) return false;
    return unlocks(state)[station] &&
      state.euros >= stationCost(station, state[station + 'Level']);
  }

  function buyStation(state, station, now = Date.now()) {
    const next = normalizeState(state, now);
    if (!canBuy(next, station)) return next;
    const key = station + 'Level';
    next.euros = money(next.euros - stationCost(station, next[key]));
    next[key] += 1;
    next.lastUpdatedAt = now;
    return next;
  }

  function distributeFlyer(state, now = Date.now()) {
    const next = normalizeState(state, now);
    if (!next.electionFinished) {
      next.supporters += flyerOutput(next);
      next.lastUpdatedAt = now;
    }
    return next;
  }

  function tick(state, deltaSeconds, now = Date.now()) {
    const next = normalizeState(state, now);
    if (next.electionFinished) return next;
    const seconds = Math.min(1, nonnegative(deltaSeconds));

    // A completed helper cycle awards supporters in the same frame as its handoff.
    next.helperProgress += helperRate(next) * seconds;
    const completedCycles = Math.floor(next.helperProgress);
    next.helperProgress -= completedCycles;
    if (completedCycles) next.supporters += completedCycles * supporterConversionMultiplier(next);
    next.euros += euroRate(next) * seconds;

    next.lastUpdatedAt = now;
    return next;
  }

  function canRunElection(state) {
    return !state.electionFinished && unlocks(state).election &&
      state.supporters >= CONFIG.election.targetSupporters &&
      state.euros >= CONFIG.election.entryCost;
  }

  function runElection(state, now = Date.now()) {
    const next = normalizeState(state, now);
    if (!canRunElection(next)) return next;
    next.euros = money(next.euros - CONFIG.election.entryCost);
    next.electionFinished = true;
    next.lastUpdatedAt = now;
    return next;
  }

  return {
    CONFIG, createInitialState, normalizeState, stationCost, flyerOutput,
    helperRate, supporterConversionMultiplier, throughput, supporterRate,
    fundraisingCapacity, rawCashRate, euroRate, bottlenecks,
    unlocks, worldStage, canBuy, buyStation, distributeFlyer, tick,
    canRunElection, runElection,
  };
});
