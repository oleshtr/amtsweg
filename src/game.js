(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AmtswegGame = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const CONFIG = Object.freeze({
    saveKey: 'amtsweg-v0.1-save',
    tickMs: 250,
    flyerSupporters: 1,
    donationUnlockSupporters: 10,
    donationClickEuros: 2,
    helper: Object.freeze({
      unlockEuros: 12,
      baseCost: 20,
      costGrowth: 1.55,
      supportersPerSecond: 0.8,
    }),
    stand: Object.freeze({
      unlockSupporters: 35,
      cost: 55,
      supportersPerSecond: 2.2,
      flyerBonus: 1,
    }),
    office: Object.freeze({
      unlockSupporters: 110,
      cost: 140,
      supportersPerSecond: 4.5,
      eurosPerSecond: 1.2,
    }),
    election: Object.freeze({
      unlockSupporters: 280,
      entryCost: 180,
      targetSupporters: 350,
    }),
  });

  function round(value, places = 2) {
    const factor = 10 ** places;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  function createInitialState() {
    return {
      supporters: 0,
      euros: 0,
      helpers: 0,
      standOwned: false,
      officeOwned: false,
      electionFinished: false,
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
    };
  }

  function normalizeState(input) {
    const base = createInitialState();
    const source = input && typeof input === 'object' ? input : {};
    return {
      supporters: Math.max(0, Number(source.supporters) || 0),
      euros: Math.max(0, Number(source.euros) || 0),
      helpers: Math.max(0, Math.floor(Number(source.helpers) || 0)),
      standOwned: Boolean(source.standOwned),
      officeOwned: Boolean(source.officeOwned),
      electionFinished: Boolean(source.electionFinished),
      startedAt: Number(source.startedAt) || base.startedAt,
      lastUpdatedAt: Number(source.lastUpdatedAt) || base.lastUpdatedAt,
    };
  }

  function helperCost(state) {
    return Math.round(CONFIG.helper.baseCost * CONFIG.helper.costGrowth ** state.helpers);
  }

  function flyerGain(state) {
    return CONFIG.flyerSupporters + (state.standOwned ? CONFIG.stand.flyerBonus : 0);
  }

  function supporterRate(state) {
    return round(
      state.helpers * CONFIG.helper.supportersPerSecond +
        (state.standOwned ? CONFIG.stand.supportersPerSecond : 0) +
        (state.officeOwned ? CONFIG.office.supportersPerSecond : 0),
      3,
    );
  }

  function euroRate(state) {
    return state.officeOwned ? CONFIG.office.eurosPerSecond : 0;
  }

  function unlocks(state) {
    return {
      donations: state.supporters >= CONFIG.donationUnlockSupporters || state.helpers > 0 || state.standOwned || state.officeOwned,
      helper: state.euros >= CONFIG.helper.unlockEuros || state.helpers > 0 || state.standOwned || state.officeOwned,
      stand: state.supporters >= CONFIG.stand.unlockSupporters || state.standOwned || state.officeOwned,
      office: state.supporters >= CONFIG.office.unlockSupporters || state.officeOwned,
      election: state.supporters >= CONFIG.election.unlockSupporters || state.electionFinished,
    };
  }

  function worldStage(state) {
    const next = normalizeState(state);
    if (next.electionFinished) return 6;
    if (unlocks(next).election) return 5;
    if (next.officeOwned) return 4;
    if (next.standOwned) return 3;
    if (next.helpers > 0) return 2;
    if (unlocks(next).donations) return 1;
    return 0;
  }

  function canBuyHelper(state) {
    return state.euros >= helperCost(state);
  }

  function canBuyStand(state) {
    return !state.standOwned && state.euros >= CONFIG.stand.cost;
  }

  function canBuyOffice(state) {
    return !state.officeOwned && state.euros >= CONFIG.office.cost;
  }

  function canRunElection(state) {
    return (
      !state.electionFinished &&
      state.supporters >= CONFIG.election.targetSupporters &&
      state.euros >= CONFIG.election.entryCost
    );
  }

  function distributeFlyer(state) {
    const next = normalizeState(state);
    next.supporters = round(next.supporters + flyerGain(next));
    next.lastUpdatedAt = Date.now();
    return next;
  }

  function collectDonation(state) {
    const next = normalizeState(state);
    if (!unlocks(next).donations) return next;
    next.euros = round(next.euros + CONFIG.donationClickEuros);
    next.lastUpdatedAt = Date.now();
    return next;
  }

  function buyHelper(state) {
    const next = normalizeState(state);
    const cost = helperCost(next);
    if (next.euros < cost) return next;
    next.euros = round(next.euros - cost);
    next.helpers += 1;
    next.lastUpdatedAt = Date.now();
    return next;
  }

  function buyStand(state) {
    const next = normalizeState(state);
    if (next.standOwned || next.euros < CONFIG.stand.cost) return next;
    next.euros = round(next.euros - CONFIG.stand.cost);
    next.standOwned = true;
    next.lastUpdatedAt = Date.now();
    return next;
  }

  function buyOffice(state) {
    const next = normalizeState(state);
    if (next.officeOwned || next.euros < CONFIG.office.cost) return next;
    next.euros = round(next.euros - CONFIG.office.cost);
    next.officeOwned = true;
    next.lastUpdatedAt = Date.now();
    return next;
  }

  function runElection(state) {
    const next = normalizeState(state);
    if (!canRunElection(next)) return next;
    next.euros = round(next.euros - CONFIG.election.entryCost);
    next.electionFinished = true;
    next.lastUpdatedAt = Date.now();
    return next;
  }

  function tick(state, deltaSeconds) {
    const next = normalizeState(state);
    if (next.electionFinished) return next;
    const seconds = Math.max(0, Number(deltaSeconds) || 0);
    next.supporters = round(next.supporters + supporterRate(next) * seconds);
    next.euros = round(next.euros + euroRate(next) * seconds);
    next.lastUpdatedAt = Date.now();
    return next;
  }

  return {
    CONFIG,
    createInitialState,
    normalizeState,
    helperCost,
    flyerGain,
    supporterRate,
    euroRate,
    unlocks,
    worldStage,
    canBuyHelper,
    canBuyStand,
    canBuyOffice,
    canRunElection,
    distributeFlyer,
    collectDonation,
    buyHelper,
    buyStand,
    buyOffice,
    runElection,
    tick,
  };
});
