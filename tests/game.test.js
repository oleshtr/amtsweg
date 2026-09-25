const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../src/game.js');
const World = require('../src/world.js');
const Storage = require('../src/storage.js');

const fresh = () => Game.createInitialState();
const rich = () => ({ ...fresh(), supporters: 1e12 });
const memory = () => {
  const data = new Map();
  return { getItem:k=>data.get(k)??null, setItem:(k,v)=>data.set(k,v) };
};

test('new game starts manual',()=>{
  const s=fresh();
  assert.equal(s.version,3);
  assert.equal(s.standLevel,1);
  assert.equal(s.teamLevel,0);
  assert.equal(s.street.active,false);
  assert.equal(Game.supporterRate(s),0);
});

test('flyer clicks always reward immediately',()=>{
  let s=fresh();
  for(let i=0;i<20;i++) s=Game.distributeFlyer(s);
  assert.equal(s.supporters,20);
  assert.equal(s.totalSupporters,20);
  assert.equal(Game.flyerGain(s),1);
});

test('stand continues beyond level 100',()=>{
  let s=rich();
  while(s.standLevel<105) s=Game.upgradeStand(s);
  assert.equal(s.standLevel,105);
  assert.equal(Game.canUpgrade(s),true);
  assert.equal(Game.standTier(s),4);
});

test('stand costs rise and milestone output jumps are meaningful',()=>{
  const levels=[1,2,5,10,25,50,100];
  const costs=levels.map(standLevel=>Game.upgradeCost({...fresh(),standLevel}));
  assert.ok(costs.every((v,i)=>i===0||v>costs[i-1]));
  assert.equal(costs[0],10);
  assert.equal(Game.flyerGain({...fresh(),standLevel:9}),1);
  assert.equal(Game.flyerGain({...fresh(),standLevel:10}),2);
  assert.equal(Game.flyerGain({...fresh(),standLevel:25}),12);
  assert.equal(Game.flyerGain({...fresh(),standLevel:50}),40);
  assert.equal(Game.flyerGain({...fresh(),standLevel:100}),240);
});

test('stand visual tiers follow 10 25 50 100 milestones',()=>{
  assert.equal(Game.standTier({...fresh(),standLevel:9}),0);
  assert.equal(Game.standTier({...fresh(),standLevel:10}),1);
  assert.equal(Game.standTier({...fresh(),standLevel:25}),2);
  assert.equal(Game.standTier({...fresh(),standLevel:50}),3);
  assert.equal(Game.standTier({...fresh(),standLevel:100}),4);
});

test('first team upgrade unlocks automation',()=>{
  let s={...fresh(),supporters:Game.teamUpgradeCost(fresh())};
  s=Game.upgradeTeam(s);
  assert.equal(s.teamLevel,1);
  assert.equal(s.supporters,0);
  assert.equal(s.street.active,true);
  assert.equal(Game.visibleHelpers(s),1);
  const stats=Game.standStats(s);
  s=Game.tick(s,stats.duration*3);
  assert.equal(s.supporters,stats.output*3);
});

test('team keeps scaling without early TEAM VOLL',()=>{
  const visible=[0,1,4,5,9,10,24,25,50].map(teamLevel=>Game.visibleHelpers({...fresh(),teamLevel}));
  assert.deepEqual(visible,[0,1,1,2,2,3,3,4,4]);
  const costs=[0,1,5,10,25,50].map(teamLevel=>Game.teamUpgradeCost({...fresh(),teamLevel}));
  assert.ok(costs.every((v,i)=>i===0||v>costs[i-1]));
  assert.equal(costs[0],20);
  assert.equal(Game.canUpgradeTeam({...fresh(),teamLevel:50,supporters:1e15}),true);
  assert.ok(Game.standStats({...fresh(),teamLevel:10}).output>Game.standStats({...fresh(),teamLevel:1}).output);
});

test('manual clicks and automation run together',()=>{
  let s=Game.upgradeTeam(rich());
  const stats=Game.standStats(s), before=s.supporters;
  s=Game.distributeFlyer(s);
  s=Game.tick(s,stats.duration);
  assert.equal(s.supporters,before+Game.flyerGain(s)+stats.output);
});

test('v2 helper saves migrate to team levels',()=>{
  const mapping=[0,1,5,10,25];
  for(let helpers=0;helpers<=4;helpers++){
    const s=Game.normalizeState({
      version:2,supporters:100,totalSupporters:100,helpers,standLevel:7,
      street:{active:helpers>0,elapsed:0,cycles:0},
      office:{phase:'locked',level:1}
    });
    assert.equal(s.version,3);
    assert.equal(s.teamLevel,mapping[helpers]);
    assert.equal(s.standLevel,7);
  }
});

test('very old save converts old cash once',()=>{
  const store=memory();
  const raw=JSON.stringify({supporters:25,euros:8,helpers:2,standOwned:true,lastUpdatedAt:1000});
  store.setItem(Game.CONFIG.legacyKey,raw);
  const result=Storage.load(store,Game,1000);
  assert.equal(result.state.supporters,33);
  assert.equal(result.state.teamLevel,5);
  assert.equal(result.state.standLevel,5);
  Storage.save(store,Game,result.state,1000);
  assert.equal(store.getItem(Game.CONFIG.legacyKey),raw);
});

test('offline production is capped',()=>{
  const store=memory(), s=Game.upgradeTeam(rich());
  Storage.save(store,Game,s,1000);
  const loaded=Storage.load(store,Game,1000+86400000);
  assert.equal(loaded.state.supporters,Game.tick(s,Game.CONFIG.offlineLimit).supporters);
});

test('pedestrians flow left to right and flyer recipient reacts',()=>{
  for(let slot=0;slot<4;slot++){
    const a=World.pedestrianAt(slot,1), b=World.pedestrianAt(slot,1.1);
    assert.equal(a.direction,1);
    if(a.visible&&b.visible) assert.ok(b.x>=a.x);
  }
  assert.ok(World.interactionAt(.1).x>World.interactionAt(.3).x);
  assert.equal(World.interactionAt(.6).flyer,true);
  assert.equal(World.interactionAt(.9).walking,true);
});

test('active play reaches early milestones gradually',()=>{
  let s=fresh(), elapsed=0;
  const reached={};
  for(let i=0;i<7200;i++){
    s=Game.distributeFlyer(s);
    s=Game.tick(s,.5);
    elapsed+=.5;
    let bought=true;
    while(bought){
      bought=false;
      const sc=Game.upgradeCost(s), tc=Game.teamUpgradeCost(s);
      const cs=Game.canUpgrade(s), ct=Game.canUpgradeTeam(s);
      if(cs&&(!ct||sc<=tc)){s=Game.upgradeStand(s);bought=true;}
      else if(ct){s=Game.upgradeTeam(s);bought=true;}
      for(const level of [10,25,50]) if(s.standLevel>=level&&reached['s'+level]==null) reached['s'+level]=elapsed;
      if(s.teamLevel>=1&&reached.t1==null) reached.t1=elapsed;
    }
    if(s.standLevel>=50&&s.teamLevel>=25) break;
  }
  assert.ok(reached.t1>=20&&reached.t1<120);
  assert.ok(reached.s10>=60&&reached.s10<180);
  assert.ok(reached.s25>=180&&reached.s25<600);
  assert.ok(reached.s50>=400&&reached.s50<1800);
});
