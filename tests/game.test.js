const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../src/game.js');
const World = require('../src/world.js');
const Storage = require('../src/storage.js');
const fresh = () => Game.createInitialState();
const rich = () => ({...fresh(), supporters:10000});
const memory = () => {
  const data = new Map();
  return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
};
test('new game is manual, locked and has only one spendable resource',()=>{
  const s=fresh();
  assert.equal(s.supporters,0); assert.equal(s.helpers,0);
  assert.equal(s.street.active,false); assert.equal(s.office.phase,'locked');
  assert.equal(Game.supporterRate(s),0); assert.equal('euros' in s,false);
  assert.deepEqual(Game.tick(s,100).street,s.street);
});
test('every flyer click immediately rewards supporters',()=>{
  let s=fresh();
  for(let i=0;i<20;i++) s=Game.distributeFlyer(s);
  assert.equal(s.supporters,20); assert.equal(s.totalSupporters,20);
  assert.equal(s.street.active,false); assert.equal(s.street.elapsed,0);
});
test('manual play never creates offline production',()=>{
  const clicked=Game.distributeFlyer(fresh());
  const s=Game.tick(clicked,3600);
  assert.equal(s.supporters,1); assert.equal(s.street.cycles,0);
});
test('purchases fail closed without sufficient supporters and do not mutate input',()=>{
  const s=fresh(), copy=JSON.stringify(s);
  for(const action of [Game.buyHelper,Game.upgradeStand,Game.buyOffice,Game.upgradeOffice]) assert.deepEqual(action(s),s);
  assert.equal(JSON.stringify(s),copy);
});
test('first helper deducts exact cost and immediately starts automation',()=>{
  let s={...fresh(),supporters:Game.helperCost(fresh())};
  s=Game.buyHelper(s);
  assert.equal(s.supporters,0); assert.equal(s.helpers,1); assert.equal(s.street.active,true);
  const stats=Game.standStats(s);
  assert.ok(Game.supporterRate(s)>=.2&&Game.supporterRate(s)<=.3);
  s=Game.tick(s,stats.duration*3);
  assert.equal(s.supporters,stats.output*3); assert.equal(s.street.cycles,3); assert.equal(s.street.active,true);
});
test('upgrades use a flat manual gain curve and modestly speed up helpers',()=>{
  let s=Game.buyHelper(rich());
  const gains=[Game.flyerGain(s)], durations=[Game.standStats(s).duration];
  while(s.standLevel<Game.CONFIG.maxLevel) {
    const before=s.supporters, cost=Game.upgradeCost(s);
    s=Game.upgradeStand(s);
    assert.equal(s.supporters,before-cost);
    gains.push(Game.flyerGain(s)); durations.push(Game.standStats(s).duration);
  }
  assert.deepEqual(gains,[1,1,1,1,2,2,3,3,4,5]);
  assert.ok(durations.every((duration,index)=>index===0||duration<durations[index-1]));
  assert.equal(Game.standTier({...s,standLevel:2}),1);
  assert.equal(Game.standTier({...s,standLevel:5}),2);
  assert.equal(Game.standTier(s),3);
  assert.equal(Game.canUpgrade(s),false);
});
test('helper automation and manual flyer clicks work in parallel',()=>{
  let s=Game.buyHelper(rich());
  const stats=Game.standStats(s), before=s.supporters;
  s=Game.distributeFlyer(s);
  assert.equal(s.supporters,before+Game.flyerGain(s));
  s=Game.tick(s,stats.duration);
  assert.equal(s.supporters,before+Game.flyerGain(s)+stats.output);
  assert.equal(s.street.active,true);
});
test('helper count is bounded and every hire has a real cost',()=>{
  let s=rich();
  for(let i=0;i<4;i++) {const before=s.supporters, cost=Game.helperCost(s); s=Game.buyHelper(s);assert.equal(s.supporters,before-cost);}
  const before=JSON.stringify(s);
  s=Game.buyHelper(s);
  assert.equal(s.helpers,4);assert.equal(JSON.stringify(s),before);
  const earlyRates=[1,2,3,4].map(helpers=>Game.supporterRate({...fresh(),helpers}));
  assert.ok(earlyRates[1]>=.5&&earlyRates[1]<=.7);
  assert.ok(earlyRates[3]>=1&&earlyRates[3]<=2);
});
test('office unlock charges 250 once and does not produce during construction',()=>{
  let s={...fresh(),supporters:249};
  assert.equal(Game.canBuyOffice(s),false);
  s.supporters=250; s=Game.buyOffice(s);
  assert.equal(s.supporters,0);assert.equal(s.office.phase,'building');
  assert.deepEqual(Game.buyOffice(s),s);
  s=Game.tick(s,4.9); assert.equal(s.office.phase,'building');assert.equal(s.supporters,0);
  s=Game.tick(s,.1);assert.equal(s.office.phase,'ready');assert.equal(s.office.elapsed,0);
});
test('a large tick applies only the post-construction remainder to office production',()=>{
  const s=Game.tick(Game.buyOffice({...fresh(),supporters:250}),14);
  assert.equal(s.office.phase,'ready');assert.equal(s.office.cycles,1);
  assert.equal(s.office.elapsed,1);assert.equal(s.supporters,18);
});
test('two locations produce independently, including while office builds',()=>{
  let s=Game.buyHelper(rich()); s=Game.buyOffice(s);
  const start=s.supporters, stats=Game.standStats(s);
  s=Game.tick(s,21);
  assert.equal(s.supporters,start+Math.floor(21/stats.duration)*stats.output+36);
  assert.equal(s.office.cycles,2);
});
test('office upgrades deduct exact cost and raise future production',()=>{
  let s=Game.tick(Game.buyOffice(rich()),5);
  const cost=Game.officeUpgradeCost(s),before=s.supporters;
  s=Game.upgradeOffice(s);
  assert.equal(s.supporters,before-cost);assert.equal(s.office.level,2);
  assert.equal(Game.tick(s,8).supporters,s.supporters+28);
});
test('chunked time and one large tick produce the same economy without any renderer or NPCs',()=>{
  const base=Game.buyOffice(Game.buyHelper(rich()));
  const whole=Game.tick(base,300);
  let chunked=base;
  for(let i=0;i<3000;i++) chunked=Game.tick(chunked,.1);
  assert.equal(chunked.supporters,whole.supporters);
  assert.equal(chunked.street.cycles,whole.street.cycles);
  assert.equal(chunked.office.cycles,whole.office.cycles);
  assert.ok(Math.abs(chunked.street.elapsed-whole.street.elapsed)<1e-7);
  assert.ok(Math.abs(chunked.office.elapsed-whole.office.elapsed)<1e-7);
});
test('invalid, negative and infinite deltas cannot mint supporters',()=>{
  const s=Game.buyHelper(rich());
  for(const dt of [-1,NaN,Infinity,'broken']) assert.equal(Game.tick(s,dt).supporters,s.supporters);
});
test('normalization handles malformed and hostile saves without non-finite numbers',()=>{
  for(const input of [null,[],42,'bad',{supporters:Infinity,euros:-20,helpers:Infinity},{version:2,standLevel:999,helpers:999,office:{phase:'invalid'},street:{elapsed:NaN}}]) {
    const s=Game.normalizeState(input);
    assert.ok(Number.isFinite(s.supporters));assert.ok(s.supporters>=0);
    assert.ok(s.helpers<=4);assert.ok(s.standLevel>=1&&s.standLevel<=10);
    assert.doesNotThrow(()=>Game.tick(s,10));
  }
});
test('legacy save preserves accumulated progression and converts cash once',()=>{
  const s=Game.normalizeState({supporters:100,euros:55,helpers:2,standOwned:true,officeOwned:true,electionFinished:true});
  assert.equal(s.supporters,155);assert.equal(s.helpers,2);assert.equal(s.standLevel,5);assert.equal(s.office.phase,'ready');
  assert.deepEqual(Game.normalizeState(s),s);
  assert.ok(Game.tick(s,10).supporters>155);
});
test('save round trip preserves in-flight cycles, helpers, levels and build time',()=>{
  let s=Game.tick(Game.buyOffice(Game.buyHelper(rich())),2);
  const store=memory(); assert.equal(Storage.save(store,Game,s,1000),true);
  const loaded=Storage.load(store,Game,1000);
  assert.deepEqual(loaded.state,{...s,savedAt:1000});
});
test('offline production is capped at eight hours and backward clocks award nothing',()=>{
  const store=memory(), s=Game.buyHelper(rich());
  Storage.save(store,Game,s,1000);
  const loaded=Storage.load(store,Game,1000+86400000);
  assert.equal(loaded.state.supporters,Game.tick(s,Game.CONFIG.offlineLimit).supporters);
  assert.equal(Storage.load(store,Game,0).state.supporters,s.supporters);
});
test('migration keeps the original raw save untouched',()=>{
  const store=memory(), raw=JSON.stringify({supporters:25,euros:8,lastUpdatedAt:1000});
  store.setItem(Game.CONFIG.legacyKey,raw);
  const result=Storage.load(store,Game,1000);
  assert.equal(result.state.supporters,33);
  Storage.save(store,Game,result.state,1000);
  assert.equal(store.getItem(Game.CONFIG.legacyKey),raw);
  assert.equal(Storage.load(store,Game,1000).state.supporters,33);
});
test('corrupt save is backed up; blocked storage and future versions fail safely',()=>{
  const store=memory();
  store.setItem(Game.CONFIG.saveKey,'{corrupt');
  const result=Storage.load(store,Game,1000);
  assert.equal(result.state.supporters,0);assert.equal(store.getItem(Game.CONFIG.saveKey+'-recovery'),'{corrupt');
  assert.equal(Storage.load(null,Game).writable,false);
  assert.equal(Storage.save(null,Game,fresh()),false);
  store.setItem(Game.CONFIG.saveKey,JSON.stringify({version:99}));
  assert.equal(Storage.load(store,Game).writable,false);
});
test('pedestrians move monotonically, leave the world and despawn with bounded slots',()=>{
  for(let slot=0;slot<5;slot++) {
    let previous=null, hidden=0;
    for(let time=0;time<128;time+=.1) {
      const p=World.pedestrianAt(slot,time);
      assert.ok(Number.isFinite(p.x));
      if(!p.visible) hidden++;
      if(previous?.visible&&p.visible) assert.ok((p.x-previous.x)*p.direction>=0);
      previous=p;
    }
    assert.ok(hidden>0);
  }
});
test('flyer recipient approaches, accepts flyer and continues walking',()=>{
  assert.ok(World.interactionAt(.1).x>World.interactionAt(.3).x);
  assert.equal(World.interactionAt(.5).working,true);
  assert.equal(World.interactionAt(.6).flyer,true);
  assert.equal(World.interactionAt(.9).walking,true);
  assert.ok(World.interactionAt(1).x>World.interactionAt(.7).x);
});
test('two-clicks-per-second progression takes several minutes to complete',()=>{
  let s=fresh(), elapsed=0, firstUpgrade, firstHelper, maxStand, fullTeam;
  for(let i=0;i<1200;i++) {
    if(Game.canUpgrade(s)) {
      s=Game.upgradeStand(s);firstUpgrade??=elapsed;
      if(s.standLevel===Game.CONFIG.maxLevel) maxStand=elapsed;
    } else if(Game.canBuyHelper(s)) {
      s=Game.buyHelper(s);firstHelper??=elapsed;
      if(s.helpers===Game.CONFIG.maxHelpers) fullTeam=elapsed;
    }
    s=Game.distributeFlyer(s);
    s=Game.tick(s,.5); elapsed+=.5;
    if(maxStand&&fullTeam) break;
  }
  assert.ok(firstUpgrade>=3&&firstUpgrade<15);
  assert.ok(maxStand>=900&&maxStand<1800);
  assert.ok(fullTeam>=600&&fullTeam<1400);
  assert.equal(s.standLevel,10);assert.equal(s.helpers,4);assert.equal(s.street.active,true);
  console.log('Pacing (seconds):',JSON.stringify({firstUpgrade,firstHelper,maxStand,fullTeam}));
});
