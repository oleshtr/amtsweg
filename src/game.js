(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AmtswegGame = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const CONFIG = Object.freeze({
    saveKey: 'amtsweg-v0.2-save', legacySaveKey: 'amtsweg-v0.1-save',
    tickMs: 250, saveMs: 3000, flyerContactsPerClick: 1,
    cashUnlockSupporters: 20,
    fundraising: Object.freeze({
      donationPerSupporter: 0.30,
      baseCapacityPerSecond: 0.03,
      supporterCapacityScale: 0.0006,
    }),
    campaign: Object.freeze({
      startingLevel: 1, freeThroughLevel: 3,
      freeSupporters: Object.freeze({ 2: 30, 3: 60 }),
      upgradeBase: 0.6, upgradeGrowth: 1.29,
      processingBasePerSecond: 2.0, processingPerLevel: 0.7,
      processingMilestones: Object.freeze({ 5: 1.5, 10: 3, 20: 6 }),
      milestones: Object.freeze([2, 3, 5, 10, 20]),
    }),
    visual: Object.freeze({
      maxFlyerParticles: 12, maxArmAnimations: 4, maxPasserAnimations: 6,
      flyerAnimationMs: 450, pressMs: 130,
      reactionMs: 360, coinIntervalMs: 5000,
      supporterCheerStep: 200, supporterCheerMs: 900,
    }),
    helper: Object.freeze({
      buildCost: 40, unlockCampaignLevel: 6, unlockSupporters: 350,
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
    return {
      contacts: 0, supporters: 0, fundraisingBuffer: 0, euros: 0,
      campaignLevel: 1, helperLevel: 0, standLevel: 0, officeLevel: 0,
      electionFinished: false, startedAt: now, lastUpdatedAt: now,
    };
  }

  function normalizeState(input, now = Date.now()) {
    const source = input && typeof input === 'object' ? input : {};
    const helperLevel = level(source.helperLevel ?? source.helpers);
    const campaignLevel = Math.max(CONFIG.campaign.startingLevel, level(source.campaignLevel));
    const standLevel = level(source.standLevel ?? (source.standOwned ? 1 : 0));
    const officeLevel = level(source.officeLevel ?? (source.officeOwned ? 1 : 0));
    const safeStand = helperLevel >= CONFIG.stand.unlockHelperLevel ? standLevel : 0;
    const safeOffice = safeStand >= CONFIG.office.unlockStandLevel ? officeLevel : 0;
    const supporters = nonnegative(source.supporters);
    const finished = Boolean(source.electionFinished) &&
      safeOffice >= CONFIG.election.revealOfficeLevel &&
      supporters >= CONFIG.election.targetSupporters;
    return {
      contacts: nonnegative(source.contacts),
      supporters,
      fundraisingBuffer: nonnegative(source.fundraisingBuffer),
      euros: nonnegative(source.euros),
      campaignLevel, helperLevel, standLevel: safeStand, officeLevel: safeOffice,
      electionFinished: finished,
      startedAt: nonnegative(source.startedAt) || now,
      lastUpdatedAt: nonnegative(source.lastUpdatedAt) || now,
    };
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

  function flyerOutput() {
    return CONFIG.flyerContactsPerClick;
  }

  function campaignCapacity(state) {
    const n = Math.max(CONFIG.campaign.startingLevel, state.campaignLevel || 0);
    const milestones = CONFIG.campaign.processingMilestones;
    return CONFIG.campaign.processingBasePerSecond +
      (n - 1) * CONFIG.campaign.processingPerLevel +
      (n >= 5 ? milestones[5] : 0) +
      (n >= 10 ? milestones[10] : 0) +
      (n >= 20 ? milestones[20] : 0);
  }

  function helperRate(state) {
    const n = state.helperLevel;
    return n ? CONFIG.helper.basePerSecond * (1 + (n - 1) * CONFIG.helper.levelBonus) *
      (n >= 5 ? CONFIG.helper.milestone5Multiplier : 1) : 0;
  }

  function standCapacity(state) {
    return state.standLevel ? CONFIG.stand.baseCapacityPerSecond +
      (state.standLevel - 1) * CONFIG.stand.capacityPerLevel : 0;
  }

  function contactProcessingCapacity(state) {
    return campaignCapacity(state) + standCapacity(state);
  }

  function supporterConversionMultiplier(state) {
    return state.standLevel ? CONFIG.stand.outputMultiplier +
      (state.standLevel - 1) * CONFIG.stand.multiplierPerLevel : 1;
  }

  // Estimated passive supporter throughput. Manual clicks enter the same contact buffer.
  function throughput(state) {
    return Math.min(helperRate(state), contactProcessingCapacity(state));
  }

  function supporterRate(state) {
    return throughput(state) * supporterConversionMultiplier(state);
  }

  function fundraisingCapacity(state) {
    if (state.supporters < CONFIG.cashUnlockSupporters) return 0;
    const organic = CONFIG.fundraising.baseCapacityPerSecond +
      state.supporters * CONFIG.fundraising.supporterCapacityScale;
    if (!state.officeLevel) return organic;
    const multiplier = CONFIG.office.fundraisingMultiplier +
      (state.officeLevel - 1) * CONFIG.office.multiplierPerLevel;
    const officeCap = CONFIG.office.baseCapacityPerSecond +
      (state.officeLevel - 1) * CONFIG.office.capacityPerLevel;
    return Math.min(organic * multiplier, officeCap);
  }

  function rawCashRate(state) {
    if (state.supporters < CONFIG.cashUnlockSupporters) return 0;
    return CONFIG.fundraising.baseCapacityPerSecond +
      state.supporters * CONFIG.fundraising.supporterCapacityScale;
  }

  function euroRate(state) {
    return fundraisingCapacity(state);
  }

  function bottlenecks(state) {
    const processing = contactProcessingCapacity(state);
    const campaign = state.contacts > Math.max(3, processing * 2);
    const stand = state.standLevel > 0 && state.contacts > Math.max(6, processing * 3);
    const office = state.officeLevel > 0 &&
      state.fundraisingBuffer > Math.max(1, fundraisingCapacity(state) * 6);
    return { campaign, stand, office };
  }

  function unlocks(state) {
    return {
      cash: state.supporters >= CONFIG.cashUnlockSupporters || state.euros > 0,
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
      next.contacts += flyerOutput(next);
      next.lastUpdatedAt = now;
    }
    return next;
  }

  function tick(state, deltaSeconds, now = Date.now()) {
    const next = normalizeState(state, now);
    if (next.electionFinished) return next;
    const seconds = Math.min(1, nonnegative(deltaSeconds));

    // Production: manual clicks and helpers feed one shared contact buffer.
    next.contacts += helperRate(next) * seconds;

    // Processing: campaign point + info stand convert contacts into supporters.
    const processedContacts = Math.min(next.contacts, contactProcessingCapacity(next) * seconds);
    next.contacts -= processedContacts;
    const supporterGain = processedContacts * supporterConversionMultiplier(next);
    next.supporters += supporterGain;

    // Every newly won supporter creates donation potential. Fundraising then drains it.
    next.fundraisingBuffer += supporterGain * CONFIG.fundraising.donationPerSupporter;
    if (next.supporters >= CONFIG.cashUnlockSupporters && next.fundraisingBuffer > 0) {
      const collected = Math.min(next.fundraisingBuffer, fundraisingCapacity(next) * seconds);
      next.fundraisingBuffer -= collected;
      next.euros = money(next.euros + collected);
    }

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
    campaignCapacity, helperRate, standCapacity, contactProcessingCapacity,
    supporterConversionMultiplier, throughput, supporterRate,
    fundraisingCapacity, rawCashRate, euroRate, bottlenecks,
    unlocks, worldStage, canBuy, buyStation, distributeFlyer, tick,
    canRunElection, runElection,
  };
});
