(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AmtswegWorld = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const WIDTH = 2400;
  // Fixed slots, finite lifetimes, no collision or pathfinding state to accumulate.
  function pedestrianAt(slot, seconds) {
    // Ambient passers now share a readable left-to-right flow instead of wandering randomly.
    const age = (seconds + slot * 13) % 58;
    const visible = age < 44;
    return {
      visible,
      x: -55 + age * 56,
      y: slot % 2 ? 347 : 361,
      direction: 1,
      walking: true,
    };
  }
  function interactionAt(progress) {
    const p = Math.max(0, Math.min(1, progress));
    const approach = Math.min(1, p / .3);
    const departure = Math.max(0, (p - .67) / .33);
    return { x: 682 - approach * 76 + departure * 108, y: 348,
      working: p >= .3 && p <= .67, flyer: p >= .56,
      walking: p < .3 || p > .67, workerOffset: Math.min(1, p / .3) * 38 * (1 - departure) };
  }
  const palettes = [
    ['#527c82','#ebbd92','#4c423b'], ['#bc8954','#cd946b','#3e3633'],
    ['#8b786b','#eec7a3','#7a5740'], ['#6d8d66','#b77e59','#302f30'],
    ['#b97063','#e7b286','#8c6948'], ['#667eaa','#d4a582','#574635'],
  ];
  function personMarkup(index = 0, extra = '') {
    const [shirt, skin, hair] = palettes[index % palettes.length];
    return `<div class="person idle ${extra}" style="--shirt:${shirt};--skin:${skin};--hair:${hair}"><i class="leg left"></i><i class="leg right"></i><i class="arm left"></i><i class="body"></i><i class="head"></i><i class="arm right"></i><i class="flyer"></i></div>`;
  }
  function sceneryMarkup() {
    const rect = (x,y,w,h,c,extra='') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" ${extra}/>`;
    const line = (x,y,x2,y2,c,w=2) => `<path d="M${x} ${y}L${x2} ${y2}" stroke="${c}" stroke-width="${w}" fill="none"/>`;
    const text = (x,y,t,c='#496052',size=9) => `<text x="${x}" y="${y}" fill="${c}" font-family="monospace" font-size="${size}" font-weight="bold">${t}</text>`;
    function window(x,y,w=29,h=39) {
      return rect(x-4,y-4,w+8,h+8,'#ede4c9')+rect(x,y,w,h,'#819c98')+
        rect(x+3,y+3,w/2-5,h-6,'#b0c2b5')+rect(x+w/2-1,y,3,h,'#e6dec3')+
        rect(x,y+h/2,w,3,'#e6dec3')+rect(x-6,y+h+3,w+12,5,'#9f9980');
    }
    function house(x,y,w,h,wall,roof,shop='') {
      let s = rect(x+8,y+8,w,h,'#657c5c22')+rect(x,y,w,h,wall)+rect(x+w-12,y,12,h,'#56664d19');
      s += `<path d="M${x-9} ${y+3}L${x+20} ${y-41}H${x+w-20}L${x+w+9} ${y+3}Z" fill="${roof}"/>`;
      s += rect(x+w-40,y-48,13,30,'#a57d64')+rect(x+w-43,y-51,19,5,'#89624f');
      for (let r=0;r<4;r++) s += line(x+18-r*6,y-32+r*9,x+w-18+r*6,y-32+r*9,'#efd3a02b',2);
      s += rect(x-6,y+3,w+12,7,'#f0dfb7')+rect(x,y+11,w,4,'#56664d1c');
      const cols = Math.floor(w/55);
      for(let row=0;row<(shop?1:2);row++) for(let col=0;col<cols;col++) s+=window(x+18+col*55,y+26+row*63);
      if(shop) {
        s += rect(x+9,y+h-76,w-18,67,'#56776a')+rect(x+16,y+h-70,w-32,52,'#abc3ac');
        for(let i=0;i<Math.floor(w/22);i++) s+=rect(x+i*22,y+h-94,22,18,i%2?'#f3ddb3':'#b27655');
        s+=rect(x+13,y+h-122,w-26,23,'#ede2be')+text(x+25,y+h-107,shop,'#655e47',10);
        s+=rect(x+w/2,y+h-76,4,68,'#ece1bf');
        s+=rect(x+22,y+h-34,32,12,'#c28b57')+rect(x+68,y+h-37,20,15,'#e6c588');
      } else {
        s += rect(x+w/2-17,y+h-48,34,48,'#586b5e')+rect(x+w/2-12,y+h-44,24,24,'#a5b8a7');
        s += rect(x+w/2+8,y+h-18,3,5,'#e7c68b')+rect(x+w/2-23,y+h-4,47,7,'#a99b81');
        s += text(x+w/2+22,y+h-28,String(Math.floor(x/30)+2),'#6c7460',7);
      }
      s+=rect(x,y+h-7,w,7,'#9e9579');
      for(let i=0;i<6;i++) s+=rect(x+12+(i*31)%(w-20),y+h-12-(i%3)*22,7,2,'#56664d17');
      return s;
    }
    function tree(x,y,scale=1) {
      return `<g transform="translate(${x} ${y}) scale(${scale})">`+
        rect(-5,-48,10,53,'#827657')+rect(3,-36,4,39,'#645f49')+
        rect(-36,-95,63,41,'#7d9d6a')+rect(-26,-111,44,72,'#7d9d6a')+
        rect(-45,-83,83,31,'#7d9d6a')+rect(-31,-108,41,17,'#97b078')+
        rect(-43,-81,20,15,'#91aa74')+rect(10,-67,27,20,'#66875d')+
        rect(-21,-48,34,14,'#66875d')+rect(-27,-95,11,8,'#abc086')+`</g>`;
    }
    function lamp(x) {
      return rect(x,265,5,116,'#65746a')+rect(x-4,377,13,5,'#56665c')+
        rect(x-5,261,15,5,'#55685f')+rect(x-4,242,13,20,'#67786a')+
        rect(x-1,245,7,14,'#f6e5ac')+rect(x-7,239,19,4,'#53675d')+
        rect(x-2,234,9,5,'#53675d');
    }
    function bike(x,y) {
      return `<g stroke="#5f7469" stroke-width="3" fill="none"><circle cx="${x}" cy="${y}" r="12"/><circle cx="${x+39}" cy="${y}" r="12"/><path d="M${x} ${y}l15-23 9 23H${x}l27-18 12 18m-12-18-3-9h-7m-2 6h-8"/></g>`+
        rect(x+7,y-28,14,4,'#475c52');
    }
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2400 540" shape-rendering="crispEdges">`;
    s+=rect(0,0,2400,350,'#d9e8dc')+rect(0,110,2400,240,'#dce8d5');
    s+=`<circle cx="1050" cy="62" r="25" fill="#f9ecc2"/>`;
    for (const [x,y] of [[330,65],[900,99],[1320,42],[1920,74],[2280,110]]) s+=rect(x,y,78,9,'#f3f4e6')+rect(x+16,y-8,47,9,'#f3f4e6');
    for(let i=0;i<23;i++) {
      const x=i*117, h=38+(i*19)%76;
      s+=rect(x,300-h,100,h,'#bdceb7')+rect(x+9,292-h,80,8,'#bdceb7');
      for(let j=0;j<3;j++) s+=rect(x+17+j*26,315-h,10,15,'#afc3ad');
    }
    s+=rect(0,322,2400,36,'#aabb92');
    s+=house(40,195,162,157,'#e4cdad','#ae7b63');
    s+=house(229,158,168,191,'#d6dbba','#7a8c77');
    s+=house(734,178,175,171,'#e3c6a5','#b78668');
    s+=house(1000,161,212,188,'#cfceb0','#7b8b79','BÄCKEREI WEBER');
    s+=house(1850,155,170,194,'#d9ba9c','#997b66','BLUMEN & MEHR');
    s+=house(2110,137,223,212,'#d5d1b6','#7e8877','CAFÉ NEBENAN');
    s+=rect(0,350,2400,82,'#cdd0b8')+rect(0,350,2400,5,'#e2dfc5');
    for(let y=364;y<427;y+=18) s+=line(0,y,2400,y,'#b9c3ac',1);
    for(let x=0;x<2400;x+=39) { s+=line(x,350,x,430,'#bec6af',1); }
    s+=rect(0,425,2400,7,'#f0e8ce')+rect(0,432,2400,7,'#aab4a1')+rect(0,439,2400,78,'#879b90');
    for(let x=0;x<2400;x+=110) s+=rect(x,494,58,4,'#d9ddc8');
    s+=rect(0,517,2400,5,'#dfddc3')+rect(0,522,2400,18,'#a9bc91');
    for(let x=10;x<2400;x+=33) s+=rect(x,529+(x%3),8,2,'#8fa77d');
    s+=tree(18,373,1.25)+tree(677,365,1.05)+tree(1307,368,1.15)+tree(2359,371,1.2);
    s+=lamp(331)+lamp(943)+lamp(1365)+lamp(2054);
    // Bus stop, timetable, bench and bicycle parking make the street recognizably lived in.
    s+=rect(90,300,5,87,'#788775')+`<circle cx="92" cy="295" r="13" fill="#ebd780"/>`+
      `<circle cx="92" cy="295" r="10" fill="none" stroke="#688463" stroke-width="2"/>`+text(87,299,'H','#658060',12);
    s+=rect(83,315,19,27,'#f4e9c7')+rect(86,319,13,3,'#8a9b7e')+rect(86,325,13,2,'#b4b99b')+rect(86,330,13,2,'#b4b99b');
    s+=rect(141,351,68,7,'#a98a60')+rect(141,341,68,7,'#bb9b6c')+rect(138,367,74,6,'#a98a60')+rect(145,373,4,15,'#64775f')+rect(201,373,4,15,'#64775f');
    s+=bike(268,381)+bike(1238,382);
    s+=rect(952,369,20,25,'#78917a')+rect(950,365,24,5,'#516c5b');
    s+=rect(1145,363,4,28,'#657d6b')+rect(1134,357,29,17,'#eee4c3')+text(1138,368,'BROT','#8d795c',7);
    s+=rect(1335,297,4,90,'#7a8d75')+rect(1302,291,86,15,'#597b69')+text(1308,302,'LINDENSTR.','#f2edcf',9);
    for (const x of [17,710,1810,2318]) s+=rect(x,388,27,17,'#b39168')+rect(x-3,379,33,12,'#7d9666')+rect(x+4,375,5,5,'#d0b472')+rect(x+19,376,4,4,'#c9896c');
    s+='</svg>';
    return s;
  }
  function mount(doc) {
    doc.querySelector('[data-scenery]').innerHTML = sceneryMarkup();
    const workers = doc.querySelector('[data-workers]');
    const pedestrians = doc.querySelector('[data-pedestrians]');
    const recipient = doc.querySelector('[data-recipient]');
    pedestrians.innerHTML = Array.from({length: 4}, (_,i)=>personMarkup(i)).join('');
    recipient.innerHTML = personMarkup(4);
    doc.querySelector('[data-office-worker]').innerHTML = personMarkup(0);
    doc.querySelector('[data-office-walker]').innerHTML = personMarkup(3);
    let helperCount = -1;
    let manualStartedAt = -999;
    let flyerSerial = 0;
    const stand = doc.querySelector('[data-stand]'), office = doc.querySelector('[data-office]');
    const flyerEffects = doc.querySelector('[data-flyer-effects]');
    const reduced = doc.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function pose(node, x, y, mode, time, flyer=false, direction=1) {
      node.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px) scaleX(${direction})`;
      for (const name of ['idle', 'walking', 'working']) node.classList.toggle(name, name === mode);
      node.classList.toggle('has-flyer', flyer);
      node.style.setProperty('--stride', `${reduced ? 0 : Math.sin(time*11)*19}deg`);
      node.style.setProperty('--breath', `${reduced ? 0 : Math.floor(Math.sin(time*2)+1)}px`);
    }
    return {
      triggerFlyer(time) {
        manualStartedAt = time;
        flyerSerial++;
        if (!flyerEffects) return;
        if (flyerEffects.childElementCount >= 7) flyerEffects.firstElementChild.remove();
        const flyer = doc.createElement('i');
        flyer.className = 'flyer-projectile';
        flyer.style.setProperty('--flyer-arc', (flyerSerial % 2 ? '-12px' : '-22px'));
        flyerEffects.append(flyer);
        flyer.addEventListener('animationend', () => flyer.remove(), { once: true });
        setTimeout(() => flyer.remove(), 900);
      },
      render(state, time, game) {
        const tier = game.standTier(state);
        stand.dataset.tier = tier;
        office.dataset.phase = state.office.phase;
        office.dataset.level = state.office.level;
        office.style.setProperty('--build-inset', `${state.office.buildRemaining / game.CONFIG.buildSeconds * 100}%`);

        const visibleHelpers = game.visibleHelpers(state);
        if(helperCount !== visibleHelpers) {
          workers.innerHTML = Array.from(
            {length: visibleHelpers + 1},
            (_,i)=>personMarkup(i, i ? 'helper' : 'candidate')
          ).join('');
          helperCount = visibleHelpers;
        }

        const manualAge = time - manualStartedAt;
        const manualActive = manualAge >= 0 && manualAge < 1.15;
        const manualProgress = manualActive ? Math.min(1, manualAge / 1.15) : 0;
        const interaction = interactionAt(manualProgress);

        [...workers.children].forEach((node,i)=>{
          const candidateActive = manualActive && i === 0;
          const baseX = [82,150,112,40,-5][i] ?? 20;
          const travel = candidateActive ? interaction.workerOffset / 38 : 0;
          const mode = candidateActive
            ? (interaction.working ? 'working' : 'walking')
            : i > 0 && state.teamLevel
              ? 'working'
              : 'idle';
          pose(
            node,
            baseX + travel * (178 - baseX),
            i === 1 ? 113 : 87 + travel * 26,
            mode,
            time + i,
            candidateActive
          );
        });

        [...pedestrians.children].forEach((node,i)=>{
          const route = pedestrianAt(i,time);
          node.hidden = !route.visible;
          if(route.visible) pose(node,route.x,route.y,'walking',time+i,false,1);
        });

        recipient.hidden = !manualActive;
        if (manualActive) {
          pose(
            recipient.firstElementChild,
            interaction.x,
            interaction.y,
            interaction.walking ? 'walking' : 'idle',
            time,
            interaction.flyer,
            1
          );
        }

        const officeProgress = state.office.elapsed / game.officeStats(state).duration;
        pose(doc.querySelector('[data-office-worker] .person'),0,0,'working',time);
        pose(doc.querySelector('[data-office-walker] .person'),Math.sin(officeProgress*Math.PI*2)*24,0,'walking',time);
      }
    };
  }
  return { WIDTH, pedestrianAt, interactionAt, personMarkup, sceneryMarkup, mount };
});
