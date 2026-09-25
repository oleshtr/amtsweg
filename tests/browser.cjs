'use strict';
// Optional integration runner: npm install --no-save playwright, then npm run test:browser.
// Uses a fresh browser context and an ephemeral local port; never touches personal saves.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createServer } = require('../server.js');
const Game = require('../src/game.js');
const screenshots = path.join(__dirname, '../artifacts');
fs.mkdirSync(screenshots, { recursive: true });
const checks = [];
function check(name, condition) { assert.ok(condition, name); checks.push(name); console.log('PASS '+name); }
(async () => {
  const server = createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({headless:true, ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
    const context = await browser.newContext({viewport:{width:1440,height:1050},reducedMotion:'reduce'});
    const page = await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
    await page.goto(url);
    await page.waitForSelector('[data-workers] .person');
    // Read-only inspection of live state; persistence itself is tested by real reloads below.
    const read = ()=>page.evaluate(()=>state);
    const screenshot = name=>page.screenshot({path:path.join(screenshots,name+'.png'),fullPage:true});
    check('new game starts with one visible worker and a locked office',await page.locator('[data-workers] .person').count()===1 && await page.locator('[data-office]').getAttribute('data-phase')==='locked');
    await screenshot('01-start');
    await page.locator('[data-action="start"]').click();
    check('manual flyer click rewards immediately',await page.locator('[data-supporters]').innerText()==='1');
    await page.clock.install();
    const advance = async milliseconds=>{await page.clock.fastForward(milliseconds);await page.clock.runFor(120);};
    for(let i=0;i<7;i++) await page.locator('[data-action="start"]').click();
    await page.locator('[data-action="upgrade"]').click();
    check('first upgrade deducts eight and changes the stand art',await page.locator('[data-stand]').getAttribute('data-tier')==='1' && (await read()).supporters===0);
    check('early upgrade keeps the flat manual click gain',await page.locator('[data-click-gain]').innerText()==='+1 Unterstützer');
    while(!(await page.locator('[data-action="helper"]').isEnabled())) await page.locator('[data-action="start"]').click();
    await page.locator('[data-action="helper"]').click();
    check('hiring creates a second visible person and spends twelve',await page.locator('[data-workers] .person').count()===2 && (await read()).supporters===0);
    await page.locator('[data-action="start"]').click();
    check('manual flyer button stays enabled while helpers work',await page.locator('[data-action="start"]').isEnabled() && (await read()).supporters===1);
    await advance(5000);
    check('helper production is added slowly to manual clicks',(await read()).supporters>=2);
    check('area navigation and office actions are absent',await page.locator('.world-nav').count()===0 && await page.locator('[data-action="office"]').count()===0);
    const fixed=await page.locator('[data-viewport]').evaluate(el=>el.scrollLeft);
    await page.locator('[data-viewport]').hover();
    await page.mouse.wheel(0,800);
    await page.keyboard.press('End');
    const viewport=await page.locator('[data-viewport]').boundingBox();
    await page.mouse.move(viewport.x+700,viewport.y+70);
    await page.mouse.down();await page.mouse.move(viewport.x+250,viewport.y+70,{steps:8});await page.mouse.up();
    check('camera remains fixed on the street stand',await page.locator('[data-viewport]').evaluate((el,start)=>el.scrollLeft===start,fixed));
    // Use only the three rendered actions to grow the street stand.
    while((await page.locator('[data-stand]').getAttribute('data-tier'))!=='2') {
      if(await page.locator('[data-action="upgrade"]').isEnabled()) await page.locator('[data-action="upgrade"]').click();
      else await page.locator('[data-action="start"]').click();
    }
    check('level five visibly adds the pavilion',await page.locator('.canopy').isVisible());
    await screenshot('02-pavilion');
    // Renderer can lose all visual passers while economy keeps running.
    await page.locator('[data-pedestrians]').evaluate(el=>el.replaceChildren());
    const beforeNoNPC=(await read()).supporters;
    await advance(5000);
    check('economy continues with no ambient NPCs',(await read()).supporters>beforeNoNPC);
    await page.evaluate(()=>{window.restoreWorldRenderer=world.render;world.render=()=>{throw new Error('Intentional rendering failure fixture');};});
    const beforeBrokenRenderer=(await read()).supporters;
    await advance(5000);
    check('production and UI survive a throwing renderer',(await read()).supporters>beforeBrokenRenderer&&await page.locator('[data-supporters]').innerText()!==String(beforeBrokenRenderer));
    await page.evaluate(()=>{world.render=window.restoreWorldRenderer;delete window.restoreWorldRenderer;});
    const saved=await read();
    await page.reload();
    await advance(150);
    check('reload preserves helpers and stand level',await page.locator('[data-workers] .person').count()===saved.helpers+1 && await page.locator('[data-stand]').getAttribute('data-tier')==='2');
    // Exercise further street-stand progression without editing the game state.
    for(let i=0;i<3;i++) {
      while(!(await page.locator('[data-action="helper"]').isEnabled())) await page.locator('[data-action="start"]').click();
      await page.locator('[data-action="helper"]').click();
    }
    check('all four purchased helpers exist on screen',await page.locator('[data-workers] .helper').count()===4);
    while(await page.locator('[data-stand]').getAttribute('data-tier')!=='3') {
      if(await page.locator('[data-action="upgrade"]').isEnabled()) await page.locator('[data-action="upgrade"]').click();
      else await page.locator('[data-action="start"]').click();
    }
    check('level ten adds the professional banner and lights',await page.locator('.stand-banner').isVisible()&&await page.locator('.stand-light').isVisible());
    await screenshot('03-professional-stand');
    await page.setViewportSize({width:390,height:844});
    check('mobile layout has no horizontal document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    check('mobile actions remain usable',await page.locator('[data-action="start"]').isVisible());
    await screenshot('04-mobile');
    check('gameplay has no browser errors',errors.length===0);
    await context.close();
    const motionContext=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'no-preference'});
    const motionPage=await motionContext.newPage();
    motionPage.on('pageerror',error=>errors.push(error.message));
    await motionPage.goto(url);
    await motionPage.locator('[data-action="start"]').click();
    check('normal-motion gameplay rewards a flyer immediately',await motionPage.locator('[data-supporters]').innerText()==='1');
    motionPage.once('dialog',dialog=>dialog.accept());
    await motionPage.locator('[data-action="reset"]').click();
    check('confirmed reset returns to a new playable state',await motionPage.locator('[data-supporters]').innerText()==='0'&&await motionPage.locator('[data-action="start"]').isEnabled());
    await motionPage.reload();
    check('reset persists across reload',await motionPage.locator('[data-supporters]').innerText()==='0');
    await motionContext.close();
    // Independent migration and recovery fixtures in fresh contexts.
    for(const fixture of ['legacy','corrupt','blocked']) {
      const ctx=await browser.newContext();
      const p=await ctx.newPage();
      p.on('pageerror',error=>errors.push(error.message));
      await p.addInitScript(({fixture,legacyKey,key})=>{
        if(fixture==='legacy') localStorage.setItem(legacyKey,JSON.stringify({supporters:100,euros:55,helpers:2,standOwned:true,officeOwned:true,lastUpdatedAt:Date.now()}));
        if(fixture==='corrupt') localStorage.setItem(key,'{broken');
        if(fixture==='blocked') Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage blocked');}});
      },{fixture,legacyKey:Game.CONFIG.legacyKey,key:Game.CONFIG.saveKey});
      await p.goto(url);
      await p.waitForSelector('[data-workers] .person');
      if(fixture==='legacy') {
        check('legacy UI restores team and office',await p.locator('[data-workers] .person').count()===3&&await p.locator('[data-office]').getAttribute('data-phase')==='ready');
        check('legacy original remains intact',await p.evaluate(key=>JSON.parse(localStorage.getItem(key)).euros,Game.CONFIG.legacyKey)===55);
      } else if(fixture==='blocked') {
        await p.locator('[data-action="start"]').click();
        await p.waitForFunction(()=>document.querySelector('[data-supporters]').textContent==='1');
        check('blocked storage still allows manual gameplay',true);
      } else check('corrupt save recovers without crash',await p.locator('[data-supporters]').innerText()==='0');
      await ctx.close();
    }
    check('all browser contexts remain error-free',errors.length===0);
    fs.writeFileSync(path.join(screenshots,'browser-report.json'),JSON.stringify({checks,errors},null,2));
    console.log(checks.length+' browser checks passed. Screenshots in artifacts/.');
  } finally { if(browser) await browser.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
