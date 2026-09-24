(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AmtswegGame = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const CONFIG = Object.freeze({
    saveKey: 'amtsweg-v0.3-save',
    legacySaveKeys: Object.freeze(['amtsweg-v0.2-save', 'amtsweg-v0.1-save']),
    tickMs: 100,
    saveMs: 2500,
    offline: Object.freeze({ maxSeconds: 2 * 60 * 60, minSeconds: 5 }),
    manual: Object.freeze({
      supportersPerAction: 1,
      cooldownMs: 1000,
    }),
    donation: Object.freeze({
      unlockSupporters: 30,
      supportersPerDonation: 10,
      baseEuros: 2.5,
      milestoneSupporters: 250,
      milestoneMultiplier: 1.25,
    }),
    helper: Object.freeze({
      unlockSupporters: 18,
      firstCost: 0,
      additionalCostBase: 12,
      additionalCostGrowth: 1.52,
      cycleSeconds: 8.2,
      supportersPerCycle: 1,
      maxVisible: 10,
      milestones: Object.freeze([1, 3, 5, 10, 15]),
    }),
    stand: Object.freeze({
      unlockHelpers: 3,
      unlockSupporters: 150,
      buildCost: 30,
      upgradeBase: 24,
      upgradeGrowth: 1.55,
      baseCycleSeconds: 8,
      minCycleSeconds: 2.5,
      cycleSpeedPerLevel: 0.12,
      baseSupportersPerCycle: 3,
      outputPerLevel: 0.7,
      milestones: Object.freeze([1, 3, 5, 10]),
    }),
    office: Object.freeze({
      unlockStandLevel: 3,
      unlockSupporters: 450,
      buildCost: 120,
      upgradeBase: 90,
      upgradeGrowth: 1.52,
      baseCycleSeconds: 12,
      minCycleSeconds: 3.8,
      cycleSpeedPerLevel: 0.13,
      baseEurosPerCycle: 8,
      outputPerLevel: 2.2,
      milestones: Object.freeze([1, 3, 5, 10]),
    }),
    election: Object.freeze({
      revealOfficeLevel: 3,
      revealSupporters: 1000,
      targetSupporters: 1600,
      entryCost: 450,
      districtTargetGrowth: 0.08,
      districtCostGrowth: 0.08,
    }),
    prestige: Object.freeze({
      outputBonusPerPoint: 0.12,
      maxRewardPerElection: 3,
    }),
  });

  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const nonnegative = value => Math.max(0, finite(value));
  const integer = value => Math.max(0, Math.floor(nonnegative(value)));
  const money = value => Math.round((nonnegative(value) + Number.EPSILON) * 100) / 100;

  function createInitialState(now = Date.now(), meta = {}) {
    return {
      version: 3,
      supporters: 0,
      euros: 0,
      donationProgress: 0,
      helperProgress: 0,
      standProgress: 0,
      officeProgress: 0,
      helperCount: 0,
      standLevel: 0,
      officeLevel: 0,
      district: Math.max(1, integer(meta.district) || 1),
      careerPoints: integer(meta.careerPoints),
      bestSupporters: integer(meta.bestSupporters),
      electionFinished: false,
      lastElectionReward: 0,
      lastManualAt: 0,
      startedAt: now,
      lastUpdatedAt: now,
    };
  }

  function normalizeState(input, now = Date.now()) {
    const source = input && typeof input === 'object' ? input : {};
    const helperCount = integer(source.helperCount ?? source.helperLevel ?? source.helpers);
    let standLevel = integer(source.standLevel ?? (source.standOwned ? 1 : 0));
    let officeLevel = integer(source.officeLevel ?? (source.officeOwned ? 1 : 0));
    if (helperCount < CONFIG.stand.unlockHelpers) standLevel = 0;
    if (standLevel < CONFIG.office.unlockStandLevel) officeLevel = 0;

    const supporters = nonnegative(source.supporters) + nonnegative(source.contacts);
    const district = Math.max(1, integer(source.district) || 1);
    const state = {
      version: 3,
      supporters,
      euros: money(source.euros),
      donationProgress: Math.min(CONFIG.donation.supportersPerDonation - 0.000001,
        nonnegative(source.donationProgress)),
      helperProgress: Math.min(0.999999, nonnegative(source.helperProgress)),
      standProgress: Math.min(0.999999, nonnegative(source.standProgress)),
      officeProgress: Math.min(0.999999, nonnegative(source.officeProgress)),
      helperCount,
      standLevel,
      officeLevel,
      district,
      careerPoints: integer(source.careerPoints),
      bestSupporters: Math.max(integer(source.bestSupporters), Math.floor(supporters)),
      electionFinished: Boolean(source.electionFinished),
      lastElectionReward: integer(source.lastElectionReward),
      lastManualAt: nonnegative(source.lastManualAt),
      startedAt: nonnegative(source.startedAt) || now,
      lastUpdatedAt: nonnegative(source.lastUpdatedAt) || now,
    };

    if (state.electionFinished && (state.officeLevel < CONFIG.election.revealOfficeLevel ||
      state.supporters < electionTarget(state))) {
      state.electionFinished = false;
      state.lastElectionReward = 0;
    }
    return state;
  }

  function districtFactor(state) {
    return 1 + (Math.max(1, state.district) - 1) * CONFIG.election.districtTargetGrowth;
  }

  function electionTarget(state) {
    return Math.ceil(CONFIG.election.targetSupporters * districtFactor(state));
  }

  function electionRevealSupporters(state) {
    return Math.ceil(CONFIG.election.revealSupporters * districtFactor(state));
  }

  function electionEntryCost(state) {
    const factor = 1 + (Math.max(1, state.district) - 1) * CONFIG.election.districtCostGrowth;
    return Math.ceil(CONFIG.election.entryCost * factor);
  }

  function careerMultiplier(state) {
    return 1 + integer(state.careerPoints) * CONFIG.prestige.outputBonusPerPoint;
  }

  function helperMilestoneMultiplier(count) {
    if (count >= 15) return 2.8;
    if (count >= 10) return 2.25;
    if (count >= 5) return 1.7;
    if (count >= 3) return 1.32;
    return 1;
  }

  function standMilestoneMultiplier(level) {
    if (level >= 10) return 2.25;
    if (level >= 5) return 1.72;
    if (level >= 3) return 1.35;
    return 1;
  }

  function officeMilestoneMultiplier(level) {
    if (level >= 10) return 2.4;
    if (level >= 5) return 1.78;
    if (level >= 3) return 1.38;
    return 1;
  }

  function stationLevel(state, station) {
    if (station === 'helper') return state.helperCount;
    return state[station + 'Level'];
  }

  function stationCost(station, currentLevel) {
    if (station === 'helper') {
      if (currentLevel <= 0) return CONFIG.helper.firstCost;
      return Math.ceil(CONFIG.helper.additionalCostBase * CONFIG.helper.additionalCostGrowth ** (currentLevel - 1));
    }
    const settings = CONFIG[station];
    if (!settings) return Infinity;
    if (currentLevel <= 0) return settings.buildCost;
    return Math.ceil(settings.upgradeBase * settings.upgradeGrowth ** (currentLevel - 1));
  }

  function flyerOutput(state) {
    return CONFIG.manual.supportersPerAction * careerMultiplier(state);
  }

  function nextManualInMs(state, now = Date.now()) {
    return Math.max(0, CONFIG.manual.cooldownMs - Math.max(0, now - nonnegative(state.lastManualAt)));
  }

  function canDistributeFlyer(state, now = Date.now()) {
    return !state.electionFinished && nextManualInMs(state, now) <= 0;
  }

  function helperCycleSeconds(state) {
    const count = Math.max(1, state.helperCount);
    const teamEfficiency = 1 + Math.max(0, count - 1) * 0.025;
    return CONFIG.helper.cycleSeconds / teamEfficiency;
  }

  function helperCyclesPerSecond(state) {
    if (!state.helperCount) return 0;
    return state.helperCount / helperCycleSeconds(state);
  }

  function helperOutputPerCycle(state) {
    return CONFIG.helper.supportersPerCycle * helperMilestoneMultiplier(state.helperCount) * careerMultiplier(state);
  }

  function helperRate(state) {
    return helperCyclesPerSecond(state) * helperOutputPerCycle(state);
  }

  function standCycleSeconds(state) {
    if (!state.standLevel) return Infinity;
    return Math.max(CONFIG.stand.minCycleSeconds,
      CONFIG.stand.baseCycleSeconds / (1 + (state.standLevel - 1) * CONFIG.stand.cycleSpeedPerLevel));
  }

  function standCyclesPerSecond(state) {
    return state.standLevel ? 1 / standCycleSeconds(state) : 0;
  }

  function standOutputPerCycle(state) {
    if (!state.standLevel) return 0;
    const raw = CONFIG.stand.baseSupportersPerCycle + (state.standLevel - 1) * CONFIG.stand.outputPerLevel;
    return raw * standMilestoneMultiplier(state.standLevel) * careerMultiplier(state);
  }

  function standRate(state) {
    return standCyclesPerSecond(state) * standOutputPerCycle(state);
  }

  function supporterRate(state) {
    return helperRate(state) + standRate(state);
  }

  function donationValue(state) {
    const milestone = state.supporters >= CONFIG.donation.milestoneSupporters ? CONFIG.donation.milestoneMultiplier : 1;
    return money(CONFIG.donation.baseEuros * milestone * careerMultiplier(state));
  }

  function officeCycleSeconds(state) {
    if (!state.officeLevel) return Infinity;
    return Math.max(CONFIG.office.minCycleSeconds,
      CONFIG.office.baseCycleSeconds / (1 + (state.officeLevel - 1) * CONFIG.office.cycleSpeedPerLevel));
  }

  function officeCyclesPerSecond(state) {
    return state.officeLevel ? 1 / officeCycleSeconds(state) : 0;
  }

  function officeOutputPerCycle(state) {
    if (!state.officeLevel) return 0;
    const raw = CONFIG.office.baseEurosPerCycle + (state.officeLevel - 1) * CONFIG.office.outputPerLevel;
    return money(raw * officeMilestoneMultiplier(state.officeLevel) * careerMultiplier(state));
  }

  function officeRate(state) {
    return officeCyclesPerSecond(state) * officeOutputPerCycle(state);
  }

  function organicCashRate(state) {
    if (!unlocks(state).cash) return 0;
    return supporterRate(state) * donationValue(state) / CONFIG.donation.supportersPerDonation;
  }

  function euroRate(state) {
    return organicCashRate(state) + officeRate(state);
  }

  function supportersUntilDonation(state) {
    if (!unlocks(state).cash) return CONFIG.donation.supportersPerDonation;
    return Math.max(1, Math.ceil(CONFIG.donation.supportersPerDonation - state.donationProgress));
  }

  function addSupporters(state, amount) {
    const gain = nonnegative(amount);
    if (!gain) return state;
    const before = state.supporters;
    state.supporters += gain;
    state.bestSupporters = Math.max(state.bestSupporters, Math.floor(state.supporters));

    if (state.helperCount > 0 && state.supporters >= CONFIG.donation.unlockSupporters) {
      const eligibleStart = Math.max(before, CONFIG.donation.unlockSupporters);
      const eligibleGain = Math.max(0, state.supporters - eligibleStart);
      state.donationProgress += eligibleGain;
      const donations = Math.floor(state.donationProgress / CONFIG.donation.supportersPerDonation);
      if (donations > 0) {
        state.donationProgress -= donations * CONFIG.donation.supportersPerDonation;
        state.euros = money(state.euros + donations * donationValue(state));
      }
    }
    return state;
  }

  function unlocks(state) {
    return {
      cash: state.helperCount > 0 && state.supporters >= CONFIG.donation.unlockSupporters,
      helper: state.supporters >= CONFIG.helper.unlockSupporters || state.helperCount > 0,
      stand: state.helperCount >= CONFIG.stand.unlockHelpers && state.supporters >= CONFIG.stand.unlockSupporters,
      office: state.standLevel >= CONFIG.office.unlockStandLevel && state.supporters >= CONFIG.office.unlockSupporters,
      election: state.officeLevel >= CONFIG.election.revealOfficeLevel &&
        state.supporters >= electionRevealSupporters(state),
    };
  }

  function worldStage(state) {
    if (state.electionFinished) return 6;
    if (unlocks(state).election) return 5;
    if (state.officeLevel) return 4;
    if (state.standLevel) return 3;
    if (unlocks(state).cash) return 2;
    if (state.helperCount) return 1;
    return 0;
  }

  function canBuy(state, station) {
    if (state.electionFinished || !['helper', 'stand', 'office'].includes(station)) return false;
    const u = unlocks(state);
    if (!u[station]) return false;
    if (station === 'helper' && state.helperCount > 0 && !u.cash) return false;
    return state.euros >= stationCost(station, stationLevel(state, station));
  }

  function buyStation(state, station, now = Date.now()) {
    const next = normalizeState(state, now);
    if (!canBuy(next, station)) return next;
    const level = stationLevel(next, station);
    next.euros = money(next.euros - stationCost(station, level));
    if (station === 'helper') next.helperCount += 1;
    else next[station + 'Level'] += 1;
    next.lastUpdatedAt = now;
    return next;
  }

  function distributeFlyer(state, now = Date.now()) {
    const next = normalizeState(state, now);
    if (!canDistributeFlyer(next, now)) return next;
    addSupporters(next, flyerOutput(next));
    next.lastManualAt = now;
    next.lastUpdatedAt = now;
    return next;
  }

  function tick(state, deltaSeconds, now = Date.now()) {
    const next = normalizeState(state, now);
    if (next.electionFinished) return next;
    const seconds = Math.min(2, nonnegative(deltaSeconds));

    if (next.helperCount) {
      next.helperProgress += helperCyclesPerSecond(next) * seconds;
      const cycles = Math.floor(next.helperProgress);
      next.helperProgress -= cycles;
      if (cycles) addSupporters(next, cycles * helperOutputPerCycle(next));
    }

    if (next.standLevel) {
      next.standProgress += standCyclesPerSecond(next) * seconds;
      const cycles = Math.floor(next.standProgress);
      next.standProgress -= cycles;
      if (cycles) addSupporters(next, cycles * standOutputPerCycle(next));
    }

    if (next.officeLevel) {
      next.officeProgress += officeCyclesPerSecond(next) * seconds;
      const cycles = Math.floor(next.officeProgress);
      next.officeProgress -= cycles;
      if (cycles) next.euros = money(next.euros + cycles * officeOutputPerCycle(next));
    }

    next.lastUpdatedAt = now;
    return next;
  }

  function applyOfflineProgress(state, now = Date.now()) {
    const current = normalizeState(state, now);
    const elapsed = Math.max(0, (now - current.lastUpdatedAt) / 1000);
    if (current.electionFinished || current.helperCount <= 0 || elapsed < CONFIG.offline.minSeconds) {
      current.lastUpdatedAt = now;
      return { state: current, seconds: 0, supporterGain: 0, euroGain: 0 };
    }
    const seconds = Math.min(CONFIG.offline.maxSeconds, elapsed);
    const beforeSupporters = current.supporters;
    const beforeEuros = current.euros;
    let advanced = current;
    let remaining = seconds;
    while (remaining > 0.0001) {
      const chunk = Math.min(2, remaining);
      advanced = tick(advanced, chunk, now - Math.max(0, remaining - chunk) * 1000);
      remaining -= chunk;
    }
    advanced.lastUpdatedAt = now;
    return {
      state: advanced,
      seconds,
      supporterGain: Math.max(0, advanced.supporters - beforeSupporters),
      euroGain: money(Math.max(0, advanced.euros - beforeEuros)),
    };
  }

  function canRunElectionPrerequisites(state) {
    return state.officeLevel >= CONFIG.election.revealOfficeLevel &&
      state.supporters >= electionTarget(state) &&
      state.euros >= electionEntryCost(state);
  }

  function canRunElection(state) {
    return !state.electionFinished && canRunElectionPrerequisites(state);
  }

  function electionReward(state) {
    const overflow = Math.max(0, state.supporters - electionTarget(state));
    return Math.min(CONFIG.prestige.maxRewardPerElection, 1 + Math.floor(overflow / 500));
  }

  function runElection(state, now = Date.now()) {
    const next = normalizeState(state, now);
    if (!canRunElection(next)) return next;
    const reward = electionReward(next);
    next.euros = money(next.euros - electionEntryCost(next));
    next.electionFinished = true;
    next.lastElectionReward = reward;
    next.careerPoints += reward;
    next.lastUpdatedAt = now;
    return next;
  }

  function startNextDistrict(state, now = Date.now()) {
    const current = normalizeState(state, now);
    if (!current.electionFinished) return current;
    return createInitialState(now, {
      district: current.district + 1,
      careerPoints: current.careerPoints,
      bestSupporters: current.bestSupporters,
    });
  }

  function nextMilestone(station, state) {
    const value = stationLevel(state, station);
    const list = CONFIG[station].milestones;
    const target = list.find(milestone => milestone > value);
    if (!target) return null;
    const labels = {
      helper: {
        1: 'Erste Automatisierung', 3: 'Team-Routine · ×1,32', 5: 'Materialwagen · ×1,70',
        10: 'Zweites Einsatzteam · ×2,25', 15: 'Straßenmaschine · ×2,80',
      },
      stand: {
        1: 'Infostand eröffnet', 3: 'Zweiter Betreuer · ×1,35', 5: 'Doppelstand · ×1,72',
        10: 'Marktplatz-Stand · ×2,25',
      },
      office: {
        1: 'Fundraising startet', 3: 'Zweiter Arbeitsplatz · ×1,38', 5: 'Telefonbank · ×1,78',
        10: 'Kampagnenzentrale · ×2,40',
      },
    };
    return { target, label: labels[station][target] || ('Milestone ' + target) };
  }

  return {
    CONFIG,
    createInitialState,
    normalizeState,
    districtFactor,
    electionTarget,
    electionRevealSupporters,
    electionEntryCost,
    careerMultiplier,
    stationLevel,
    stationCost,
    flyerOutput,
    nextManualInMs,
    canDistributeFlyer,
    helperCycleSeconds,
    helperCyclesPerSecond,
    helperOutputPerCycle,
    helperRate,
    standCycleSeconds,
    standCyclesPerSecond,
    standOutputPerCycle,
    standRate,
    supporterRate,
    donationValue,
    officeCycleSeconds,
    officeCyclesPerSecond,
    officeOutputPerCycle,
    officeRate,
    organicCashRate,
    euroRate,
    supportersUntilDonation,
    unlocks,
    worldStage,
    canBuy,
    buyStation,
    distributeFlyer,
    tick,
    applyOfflineProgress,
    canRunElection,
    electionReward,
    runElection,
    startNextDistrict,
    nextMilestone,
  };
});
