(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AmtswegGame = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const CONFIG = Object.freeze({
    saveKey: 'amtsweg-v0.2-save', legacySaveKey: 'amtsweg-v0.1-save',
    tickMs: 250, saveMs: 3000,
    cashUnlockSupporters: 100, cashBasePerSecond: 0.015,
    cashSupporterScale: 1.8, cashSaturationSupporters: 2500,
    campaign: Object.freeze({
      startingLevel: 1, freeThroughLevel: 3,
      freeSupporters: Object.freeze({ 2: 30, 3: 60 }),
      upgradeBase: 0.6, upgradeGrowth: 1.29,
      outputBase: 1, outputPerLevel: 0.12,
      outputMilestones: Object.freeze({ 5: 0.52, 10: 0.4, 20: 0.8 }),
      milestones: Object.freeze([2, 3, 5, 10, 20]),
    }),
    visual: Object.freeze({
      maxFlyerParticles: 12, maxArmAnimations: 4, maxPasserAnimations: 6,
      flyerAnimationMs: 450, pressMs: 130,
      reactionMs: 360, coinIntervalMs: 5000,
      supporterCheerStep: 200, supporterCheerMs: 900,
    }),
    helper: Object.freeze({
      buildCost: 95, unlockCampaignLevel: 6, unlockSupporters: 350,
      upgradeBase: 25, upgradeGrowth: 1.32,
      basePerSecond: 1.25, levelBonus: 0.16, milestone5Multiplier: 1.4,
      visualContactsPerCycle: 10, minVisualCycleSeconds: 2.5,
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
      multiplierPerLevel: 0.1, baseCapacityPerSecond: 1.15, capacityPerLevel: 0.15,
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
    return { supporters: 0, euros: 0, campaignLevel: 1, helperLevel: 0, standLevel: 0, officeLevel: 0,
      electionFinished: false, startedAt: now, lastUpdatedAt: now };
  }

  function normalizeState(input, now = Date.now()) {
    const source = input && typeof input === 'object' ? input : {};
    const helperLevel = level(source.helperLevel ?? source.helpers);
    const campaignLevel = Math.max(CONFIG.campaign.startingLevel, level(source.campaignLevel));
    const standLevel = level(source.standLevel ?? (source.standOwned ? 1 : 0));
    const officeLevel = level(source.officeLevel ?? (source.officeOwned ? 1 : 0));
    // A V0.1 save may have skipped gates. Preserve resources and restore the chain.
    const safeStand = helperLevel >= CONFIG.stand.unlockHelperLevel ? standLevel : 0;
    const safeOffice = safeStand >= CONFIG.office.unlockStandLevel ? officeLevel : 0;
    const supporters = nonnegative(source.supporters);
    const finished = Boolean(source.electionFinished) &&
      safeOffice >= CONFIG.election.revealOfficeLevel &&
      supporters >= CONFIG.election.targetSupporters;
    return { supporters, euros: nonnegative(source.euros), campaignLevel, helperLevel,
      standLevel: safeStand, officeLevel: safeOffice,
      electionFinished: finished,
      startedAt: nonnegative(source.startedAt) || now,
      lastUpdatedAt: nonnegative(source.lastUpdatedAt) || now };
  }

  function stationCost(station, currentLevel) {
    if (station === 'campaign') {
      if (currentLevel < CONFIG.campaign.freeThroughLevel) return 0;
      return money(CONFIG.campaign.upgradeBase *
        CONFIG.campaign.upgradeGrowth ** (currentLevel - CONFIG.campaign.freeThroughLevel));
    }
    const settings = CONFIG[station];
    if (!settings || !Object.hasOwn(settings, 'buildCost')) return Infinity;
    return currentLevel === 0 ? settings.buildCost :
      Math.ceil(settings.upgradeBase * settings.upgradeGrowth ** currentLevel);
  }

  function flyerOutput(state) {
    const milestones = CONFIG.campaign.outputMilestones;
    const n = state.campaignLevel || CONFIG.campaign.startingLevel;
    return money(CONFIG.campaign.outputBase + (n - 1) * CONFIG.campaign.outputPerLevel +
      (n >= 5 ? milestones[5] : 0) + (n >= 10 ? milestones[10] : 0) +
      (n >= 20 ? milestones[20] : 0));
  }

  function helperRate(state) {
    const n = state.helperLevel;
    return n ? CONFIG.helper.basePerSecond * (1 + (n - 1) * CONFIG.helper.levelBonus) *
      (n >= 5 ? CONFIG.helper.milestone5Multiplier : 1) : 0;
  }

  function standCapacity(state) {
    return state.standLevel ? CONFIG.stand.baseCapacityPerSecond +
      (state.standLevel - 1) * CONFIG.stand.capacityPerLevel : Infinity;
  }

  function throughput(state) {
    return Math.min(helperRate(state), standCapacity(state));
  }

  function supporterRate(state) {
    if (!state.helperLevel) return 0;
    const multiplier = state.standLevel ? CONFIG.stand.outputMultiplier +
      (state.standLevel - 1) * CONFIG.stand.multiplierPerLevel : 1;
    return throughput(state) * multiplier;
  }

  function rawCashRate(state) {
    if (state.supporters < CONFIG.cashUnlockSupporters) return 0;
    const base = Math.max(0, state.supporters - CONFIG.cashUnlockSupporters);
    return CONFIG.cashBasePerSecond + CONFIG.cashSupporterScale * base /
      (base + CONFIG.cashSaturationSupporters);
  }

  function euroRate(state) {
    const raw = rawCashRate(state);
    if (!state.officeLevel) return raw;
    const multiplier = CONFIG.office.fundraisingMultiplier +
      (state.officeLevel - 1) * CONFIG.office.multiplierPerLevel;
    const capacity = CONFIG.office.baseCapacityPerSecond +
      (state.officeLevel - 1) * CONFIG.office.capacityPerLevel;
    return Math.min(raw * multiplier, capacity);
  }

  function bottlenecks(state) {
    const stand = state.standLevel > 0 && helperRate(state) > standCapacity(state) + 0.001;
    const office = state.officeLevel > 0 && rawCashRate(state) *
      (CONFIG.office.fundraisingMultiplier + (state.officeLevel - 1) * CONFIG.office.multiplierPerLevel) >
      CONFIG.office.baseCapacityPerSecond + (state.officeLevel - 1) * CONFIG.office.capacityPerLevel + 0.001;
    return { stand, office };
  }

  function unlocks(state) {
    return {
      cash: state.supporters >= CONFIG.cashUnlockSupporters || state.helperLevel > 0,
      helper: (state.campaignLevel >= CONFIG.helper.unlockCampaignLevel &&
        state.supporters >= CONFIG.helper.unlockSupporters) || state.helperLevel > 0,
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
    if (state.helperLevel) return 2;
    if (unlocks(state).cash) return 1;
    return 0;
  }

  function canBuy(state, station) {
    if (state.electionFinished || !['campaign', 'helper', 'stand', 'office'].includes(station)) return false;
    if (station === 'campaign') {
      const target = state.campaignLevel + 1;
      return (target > CONFIG.campaign.freeThroughLevel ? unlocks(state).cash :
        state.supporters >= CONFIG.campaign.freeSupporters[target]) &&
        state.euros >= stationCost(station, state.campaignLevel);
    }
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
    const priorSupporters = next.supporters;
    next.supporters += supporterRate(next) * seconds;
    next.euros = next.euros +
      (euroRate({ ...next, supporters: priorSupporters }) + euroRate(next)) * seconds / 2;
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

  return { CONFIG, createInitialState, normalizeState, stationCost, flyerOutput, helperRate,
    standCapacity, throughput, supporterRate, rawCashRate, euroRate, bottlenecks,
    unlocks, worldStage, canBuy, buyStation, distributeFlyer, tick,
    canRunElection, runElection };
});
