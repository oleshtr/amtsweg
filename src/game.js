(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AmtswegGame = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const CONFIG = Object.freeze({
    version: 2, saveKey: 'amtsweg-horizontal-v2', legacyKey: 'amtsweg-v0.1-save',
    maxHelpers: 4, maxLevel: 10, officeCost: 250, buildSeconds: 5, offlineLimit: 8 * 3600,
  });
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, finite(value, min)));
  const money = value => clamp(value, 0, 1e12);
  function createInitialState() {
    return { version: 2, supporters: 0, totalSupporters: 0, helpers: 0, standLevel: 1,
      street: { active: false, elapsed: 0, cycles: 0 },
      office: { phase: 'locked', buildRemaining: 0, elapsed: 0, cycles: 0, level: 1 },
      savedAt: Date.now() };
  }
  function standStats(state) {
    return { duration: Math.max(3, 4 - (state.standLevel - 1) * .08 - Math.max(0, state.helpers - 1) * .08),
      output: state.helpers };
  }
  function flyerGain(state) {
    const level = Math.floor(clamp(state.standLevel, 1, CONFIG.maxLevel));
    return Math.max(1, Math.floor((level - 1) / 2)) + (level === CONFIG.maxLevel ? 1 : 0);
  }
  function officeStats(state) {
    return { duration: 8, output: 18 + (state.office.level - 1) * 10 };
  }
  function standTier(state) {
    return state.standLevel >= 10 ? 3 : state.standLevel >= 5 ? 2 : state.standLevel >= 2 ? 1 : 0;
  }
  function normalizeState(input) {
    const s = input && typeof input === 'object' ? input : {};
    const next = createInitialState();
    const legacy = s.version !== CONFIG.version;
    next.supporters = money(s.supporters);
    next.helpers = Math.floor(clamp(s.helpers, 0, CONFIG.maxHelpers));
    next.standLevel = Math.floor(clamp(legacy ? (s.standOwned ? 5 : 1) : s.standLevel, 1, CONFIG.maxLevel));
    // Old currency is converted once; the original save is never overwritten.
    if (legacy) next.supporters = money(next.supporters + money(s.euros));
    next.totalSupporters = Math.max(next.supporters, money(s.totalSupporters));
    const street = s.street || {};
    next.street.active = next.helpers > 0;
    next.street.cycles = Math.floor(money(street.cycles));
    next.street.elapsed = next.street.active ? clamp(street.elapsed, 0, standStats(next).duration - 1e-9) : 0;
    const office = s.office || {};
    next.office.phase = legacy ? (s.officeOwned ? 'ready' : 'locked') :
      (['locked', 'building', 'ready'].includes(office.phase) ? office.phase : 'locked');
    next.office.level = Math.floor(clamp(office.level, 1, CONFIG.maxLevel));
    next.office.cycles = Math.floor(money(office.cycles));
    next.office.buildRemaining = next.office.phase === 'building' ? clamp(office.buildRemaining, 0, CONFIG.buildSeconds) : 0;
    next.office.elapsed = next.office.phase === 'ready' ? clamp(office.elapsed, 0, officeStats(next).duration - 1e-9) : 0;
    next.savedAt = clamp(s.savedAt ?? s.lastUpdatedAt ?? next.savedAt, 0, Number.MAX_SAFE_INTEGER);
    return next;
  }
  const helperCost = state => Math.round(18 * 2.2 ** state.helpers);
  const upgradeCost = state => Math.round(8 * 1.65 ** (state.standLevel - 1));
  const officeUpgradeCost = state => Math.round(100 * 1.65 ** (state.office.level - 1));
  const canBuyHelper = s => s.helpers < CONFIG.maxHelpers && s.supporters >= helperCost(s);
  const canUpgrade = s => s.standLevel < CONFIG.maxLevel && s.supporters >= upgradeCost(s);
  const canBuyOffice = s => s.office.phase === 'locked' && s.supporters >= CONFIG.officeCost;
  const canUpgradeOffice = s => s.office.phase === 'ready' && s.office.level < CONFIG.maxLevel && s.supporters >= officeUpgradeCost(s);
  function distributeFlyer(state) {
    const next = normalizeState(state);
    reward(next, flyerGain(next));
    return next;
  }
  function buyHelper(state) {
    const next = normalizeState(state);
    if (!canBuyHelper(next)) return next;
    const progress = next.street.elapsed / standStats(next).duration;
    next.supporters -= helperCost(next);
    next.helpers++;
    next.street.elapsed = progress * standStats(next).duration;
    next.street.active = true;
    return next;
  }
  function upgradeStand(state) {
    const next = normalizeState(state);
    if (!canUpgrade(next)) return next;
    const progress = next.street.elapsed / standStats(next).duration;
    next.supporters -= upgradeCost(next);
    next.standLevel++;
    next.street.elapsed = progress * standStats(next).duration;
    return next;
  }
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
  function reward(next, amount) {
    next.supporters = money(next.supporters + amount);
    next.totalSupporters = money(next.totalSupporters + amount);
  }
  // O(1) catch-up: production never reads a DOM node, NPC or animation event.
  function advanceCycle(next, cycle, seconds, stats, automatic) {
    const elapsed = cycle.elapsed + seconds;
    const completed = Math.floor((elapsed + 1e-9) / stats.duration);
    if (completed > 0) {
      const count = automatic ? completed : 1;
      reward(next, count * stats.output);
      cycle.cycles += count;
      cycle.elapsed = automatic ? Math.max(0, elapsed - completed * stats.duration) : 0;
      if (!automatic) cycle.active = false;
    } else cycle.elapsed = elapsed;
  }
  function tick(state, deltaSeconds) {
    const next = normalizeState(state);
    const seconds = clamp(deltaSeconds, 0, CONFIG.offlineLimit);
    if (next.street.active) advanceCycle(next, next.street, seconds, standStats(next), next.helpers > 0);
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
    const stand = standStats(state), office = officeStats(state);
    return (state.helpers ? stand.output / stand.duration : 0) +
      (state.office.phase === 'ready' ? office.output / office.duration : 0);
  }
  return { CONFIG, createInitialState, normalizeState, standStats, officeStats, standTier,
    helperCost, upgradeCost, officeUpgradeCost, canBuyHelper, canUpgrade, canBuyOffice,
    canUpgradeOffice, flyerGain, distributeFlyer, buyHelper, upgradeStand, buyOffice, upgradeOffice, tick, supporterRate };
});
