(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AmtswegGame = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const CONFIG = Object.freeze({
    version: 3,
    saveKey: 'amtsweg-horizontal-v2',
    legacyKey: 'amtsweg-v0.1-save',
    maxStandLevel: 999,
    maxTeamLevel: 999,
    maxOfficeLevel: 10,
    officeCost: 250,
    buildSeconds: 5,
    offlineLimit: 8 * 3600,
  });

  const STAND_MILESTONES = Object.freeze([10, 25, 50, 100]);
  const TEAM_MILESTONES = Object.freeze([1, 5, 10, 25, 50]);
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, finite(value, min)));
  const money = value => clamp(value, 0, 1e15);

  function createInitialState() {
    return {
      version: CONFIG.version,
      supporters: 0,
      totalSupporters: 0,
      teamLevel: 0,
      standLevel: 1,
      street: { active: false, elapsed: 0, cycles: 0 },
      office: { phase: 'locked', buildRemaining: 0, elapsed: 0, cycles: 0, level: 1 },
      savedAt: Date.now(),
    };
  }

  function standMilestoneMultiplier(level) {
    let multiplier = 1;
    if (level >= 10) multiplier *= 2;
    if (level >= 25) multiplier *= 2;
    if (level >= 50) multiplier *= 2;
    if (level >= 100) multiplier *= 3;
    return multiplier;
  }

  function teamMilestoneMultiplier(level) {
    let multiplier = 1;
    if (level >= 5) multiplier *= 2;
    if (level >= 10) multiplier *= 2;
    if (level >= 25) multiplier *= 2;
    if (level >= 50) multiplier *= 2;
    return multiplier;
  }

  function flyerGain(state) {
    const level = Math.floor(clamp(state.standLevel, 1, CONFIG.maxStandLevel));
    const base = 1 + Math.floor((level - 1) / 10);
    return base * standMilestoneMultiplier(level);
  }

  function standStats(state) {
    const teamLevel = Math.floor(clamp(state.teamLevel, 0, CONFIG.maxTeamLevel));
    if (!teamLevel) return { duration: 4.5, output: 0 };
    const duration = Math.max(.8, 4.5 * .97 ** (teamLevel - 1));
    const efficiency = 1 + Math.floor((teamLevel - 1) / 3);
    return {
      duration,
      output: flyerGain(state) * efficiency * teamMilestoneMultiplier(teamLevel),
    };
  }

  function officeStats(state) {
    return { duration: 8, output: 18 + (state.office.level - 1) * 10 };
  }

  function standTier(state) {
    const level = state.standLevel;
    return level >= 100 ? 4 : level >= 50 ? 3 : level >= 25 ? 2 : level >= 10 ? 1 : 0;
  }

  function visibleHelpers(state) {
    const level = Math.floor(clamp(state.teamLevel, 0, CONFIG.maxTeamLevel));
    return level >= 25 ? 4 : level >= 10 ? 3 : level >= 5 ? 2 : level >= 1 ? 1 : 0;
  }

  function nextStandMilestone(state) {
    return STAND_MILESTONES.find(level => level > state.standLevel) || null;
  }

  function nextTeamMilestone(state) {
    return TEAM_MILESTONES.find(level => level > state.teamLevel) || null;
  }

  function oldHelpersToTeamLevel(helpers) {
    return [0, 1, 5, 10, 25][Math.floor(clamp(helpers, 0, 4))] || 0;
  }

  function normalizeState(input) {
    const s = input && typeof input === 'object' ? input : {};
    const next = createInitialState();
    const version = Math.floor(finite(s.version, 0));
    const v3 = version === CONFIG.version;
    const v2 = version === 2;

    next.supporters = money(s.supporters);
    next.standLevel = Math.floor(clamp(
      v3 || v2 ? s.standLevel : (s.standOwned ? 5 : 1),
      1,
      CONFIG.maxStandLevel
    ));
    next.teamLevel = Math.floor(clamp(
      v3 ? s.teamLevel : oldHelpersToTeamLevel(s.helpers),
      0,
      CONFIG.maxTeamLevel
    ));

    // Very old saves used a second currency. Convert it once while leaving the old raw save untouched.
    if (!v3 && !v2) next.supporters = money(next.supporters + money(s.euros));
    next.totalSupporters = Math.max(next.supporters, money(s.totalSupporters));

    const street = s.street || {};
    next.street.active = next.teamLevel > 0;
    next.street.cycles = Math.floor(money(street.cycles));
    next.street.elapsed = next.street.active
      ? clamp(street.elapsed, 0, standStats(next).duration - 1e-9)
      : 0;

    const office = s.office || {};
    next.office.phase = !v3 && !v2
      ? (s.officeOwned ? 'ready' : 'locked')
      : (['locked', 'building', 'ready'].includes(office.phase) ? office.phase : 'locked');
    next.office.level = Math.floor(clamp(office.level, 1, CONFIG.maxOfficeLevel));
    next.office.cycles = Math.floor(money(office.cycles));
    next.office.buildRemaining = next.office.phase === 'building'
      ? clamp(office.buildRemaining, 0, CONFIG.buildSeconds)
      : 0;
    next.office.elapsed = next.office.phase === 'ready'
      ? clamp(office.elapsed, 0, officeStats(next).duration - 1e-9)
      : 0;
    next.savedAt = clamp(s.savedAt ?? s.lastUpdatedAt ?? next.savedAt, 0, Number.MAX_SAFE_INTEGER);
    return next;
  }

  const scaledCost = (base, growth, exponent) => Math.min(1e15, Math.round(base * growth ** Math.max(0, exponent)));
  const upgradeCost = state => scaledCost(10, 1.14, state.standLevel - 1);
  const teamUpgradeCost = state => scaledCost(20, 1.32, state.teamLevel);
  const helperCost = teamUpgradeCost; // Compatibility alias for older UI/tests.
  const officeUpgradeCost = state => scaledCost(100, 1.65, state.office.level - 1);

  const canUpgrade = state => state.standLevel < CONFIG.maxStandLevel && state.supporters >= upgradeCost(state);
  const canUpgradeTeam = state => state.teamLevel < CONFIG.maxTeamLevel && state.supporters >= teamUpgradeCost(state);
  const canBuyHelper = canUpgradeTeam; // Compatibility alias.
  const canBuyOffice = state => state.office.phase === 'locked' && state.supporters >= CONFIG.officeCost;
  const canUpgradeOffice = state =>
    state.office.phase === 'ready' &&
    state.office.level < CONFIG.maxOfficeLevel &&
    state.supporters >= officeUpgradeCost(state);

  function reward(next, amount) {
    next.supporters = money(next.supporters + amount);
    next.totalSupporters = money(next.totalSupporters + amount);
  }

  function distributeFlyer(state) {
    const next = normalizeState(state);
    reward(next, flyerGain(next));
    return next;
  }

  function upgradeStand(state) {
    const next = normalizeState(state);
    if (!canUpgrade(next)) return next;
    const statsBefore = standStats(next);
    const progress = next.street.active && statsBefore.duration
      ? next.street.elapsed / statsBefore.duration
      : 0;
    next.supporters -= upgradeCost(next);
    next.standLevel++;
    if (next.street.active) next.street.elapsed = progress * standStats(next).duration;
    return next;
  }

  function upgradeTeam(state) {
    const next = normalizeState(state);
    if (!canUpgradeTeam(next)) return next;
    const wasActive = next.teamLevel > 0;
    const progress = wasActive ? next.street.elapsed / standStats(next).duration : 0;
    next.supporters -= teamUpgradeCost(next);
    next.teamLevel++;
    next.street.active = true;
    next.street.elapsed = progress * standStats(next).duration;
    return next;
  }

  const buyHelper = upgradeTeam; // Compatibility alias.

  function buyOffice(state) {
    const next = normalizeState(state);
    if (!canBuyOffice(next)) return next;
    next.supporters -= CONFIG.officeCost;
    next.office.phase = 'building';
    next.office.buildRemaining = CONFIG.buildSeconds;
    return next;
  }

  function upgradeOffice(state) {
    const next = normalizeState(state);
    if (!canUpgradeOffice(next)) return next;
    next.supporters -= officeUpgradeCost(next);
    next.office.level++;
    return next;
  }

  // O(1) catch-up: production never depends on a DOM node, NPC or animation event.
  function advanceCycle(next, cycle, seconds, stats, automatic) {
    if (!stats.output || !stats.duration) return;
    const elapsed = cycle.elapsed + seconds;
    const completed = Math.floor((elapsed + 1e-9) / stats.duration);
    if (completed > 0) {
      const count = automatic ? completed : 1;
      reward(next, count * stats.output);
      cycle.cycles += count;
      cycle.elapsed = automatic ? Math.max(0, elapsed - completed * stats.duration) : 0;
      if (!automatic) cycle.active = false;
    } else {
      cycle.elapsed = elapsed;
    }
  }

  function tick(state, deltaSeconds) {
    const next = normalizeState(state);
    const seconds = clamp(deltaSeconds, 0, CONFIG.offlineLimit);
    if (next.street.active) advanceCycle(next, next.street, seconds, standStats(next), true);

    let officeSeconds = seconds;
    if (next.office.phase === 'building') {
      officeSeconds = Math.max(0, seconds - next.office.buildRemaining);
      next.office.buildRemaining = Math.max(0, next.office.buildRemaining - seconds);
      if (officeSeconds < 1e-9) officeSeconds = 0;
      if (next.office.buildRemaining < 1e-9) next.office.buildRemaining = 0;
      if (next.office.buildRemaining === 0) next.office.phase = 'ready';
    }
    if (next.office.phase === 'ready') advanceCycle(next, next.office, officeSeconds, officeStats(next), true);
    return next;
  }

  function supporterRate(state) {
    const stand = standStats(state);
    const office = officeStats(state);
    return (state.teamLevel ? stand.output / stand.duration : 0) +
      (state.office.phase === 'ready' ? office.output / office.duration : 0);
  }

  return {
    CONFIG,
    STAND_MILESTONES,
    TEAM_MILESTONES,
    createInitialState,
    normalizeState,
    standStats,
    officeStats,
    standTier,
    visibleHelpers,
    nextStandMilestone,
    nextTeamMilestone,
    standMilestoneMultiplier,
    teamMilestoneMultiplier,
    upgradeCost,
    teamUpgradeCost,
    helperCost,
    officeUpgradeCost,
    canUpgrade,
    canUpgradeTeam,
    canBuyHelper,
    canBuyOffice,
    canUpgradeOffice,
    flyerGain,
    distributeFlyer,
    upgradeStand,
    upgradeTeam,
    buyHelper,
    buyOffice,
    upgradeOffice,
    tick,
    supporterRate,
  };
});
