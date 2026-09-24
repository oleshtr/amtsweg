const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.join(root, pathname === '/' ? 'index.html' : pathname);
  if (!file.startsWith(root)) { response.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    response.end(data);
  });
});

async function run() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true, args: ['--no-sandbox'],
  });
  const errors = [];
  const results = [];
  try {
    for (const [width, height] of [[1440, 900], [900, 800], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      page.on('pageerror', error => errors.push(width + ' page: ' + error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(width + ' console: ' + message.text()); });
      await page.goto(url);
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      const capture = async phase => {
        await page.waitForTimeout(350);
        await page.screenshot({ path: path.join(os.tmpdir(), 'amtsweg-simple-' + width + '-' + phase + '.png'), fullPage: true });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
      };
      const spam = count => page.evaluate(n => {
        const button = document.querySelector('[data-action="flyer"]');
        for (let i = 0; i < n; i += 1) button.click();
      }, count);

      assert.equal(await page.locator('[data-scene]').getAttribute('data-stage'), '0');
      assert.equal(await page.locator('[data-euro-stat]').isVisible(), false);
      assert.equal(await page.locator('[data-action="reset"]').isVisible(), true);
      assert.equal(await page.locator('.passer, .campaign-point, [data-upgrade="campaign"]').count(), 0);
      assert.equal(await page.locator('.shaft, .soil-pattern, .locked-tunnel').count(), 0);
      for (const selector of ['.field-helper', '.room--helpers', '.info-stand', '.campaign-house', '.cityhall', '[data-build="helper"]']) {
        assert.equal(await page.locator(selector).isVisible(), false, selector + ' visible at start');
      }
      await capture('fresh');

      const audit = await page.evaluate(() => {
        const button = document.querySelector('[data-action="flyer"]');
        for (let i = 0; i < 10; i += 1) button.click();
        const ten = state.supporters;
        for (let i = 0; i < 100; i += 1) button.click();
        return {
          ten, total: state.supporters, disabled: button.disabled,
          particles: document.querySelectorAll('.flyer-particle').length,
          floating: document.querySelectorAll('.floating-gain').length,
          recipients: document.querySelectorAll('.flyer-recipient').length,
          armAnimations: document.querySelector('[data-candidate] .actor__arm').getAnimations().length,
        };
      });
      assert.equal(audit.ten, 10);
      assert.equal(audit.total, 110);
      assert.equal(audit.disabled, false);
      assert.equal(audit.particles, 12);
      assert.ok(audit.floating > 0 && audit.floating <= 8);
      assert.ok(audit.recipients > 0 && audit.recipients <= 4);
      assert.ok(audit.armAnimations <= 4);
      assert.equal(await page.locator('[data-euro-stat]').isVisible(), false);
      await page.waitForTimeout(900);
      assert.equal(await page.locator('.flyer-particle, .floating-gain, .flyer-recipient').count(), 0);

      page.once('dialog', dialog => dialog.accept());
      await page.locator('[data-action="reset"]').click();
      await spam(30);
      assert.equal(await page.evaluate(() => state.supporters), 30);
      assert.equal(await page.locator('[data-build="helper"]').isVisible(), true);
      await page.locator('[data-action="helper"]').click();
      assert.equal(await page.locator('[data-scene]').getAttribute('data-stage'), '1');
      assert.equal(await page.locator('.field-helper').count(), 1);
      assert.equal(await page.locator('.field-helper').first().isVisible(), true);
      assert.equal(await page.locator('.room--helpers').isVisible(), true);
      assert.equal(await page.locator('[data-euro-stat]').isVisible(), false);
      const beforeAuto = await page.evaluate(() => state.supporters);
      const helperStartX = await page.locator('.field-helper').first().evaluate(element => element.getBoundingClientRect().left);
      await page.evaluate(() => helperFeedback(1));
      assert.equal(await page.locator('.street-passer--street').count(), 1);
      const passerStartX = await page.locator('.street-passer--street').first().evaluate(element => element.getBoundingClientRect().left);
      await page.waitForTimeout(1100);
      assert.ok(await page.evaluate(() => state.supporters) >= beforeAuto);
      const helperLaterX = await page.locator('.field-helper').first().evaluate(element => element.getBoundingClientRect().left);
      const passerLaterX = await page.locator('.street-passer--street').first().evaluate(element => element.getBoundingClientRect().left);
      assert.ok(Math.abs(helperLaterX - helperStartX) < 8, 'helper must stay stationed at the campaign point');
      assert.ok(passerLaterX > passerStartX, 'passer must enter from the left and travel right');
      assert.ok(await page.locator('.operations__header').isVisible());
      await capture('helper');

      await spam(45);
      assert.equal(await page.locator('[data-scene]').getAttribute('data-stage'), '2');
      assert.equal(await page.locator('[data-euro-stat]').isVisible(), true);
      assert.equal(await page.locator('.donation-point').isVisible(), true);
      await capture('cash');
      await page.waitForTimeout(400);
      await page.evaluate(() => { state.euros = 10000; render(); });
      const helperCycleAtOne = await page.locator('.field-helper').first().evaluate(element => parseFloat(getComputedStyle(element).animationDuration));
      for (let i = 0; i < 4; i += 1) await page.locator('[data-upgrade="helper"]').click();
      assert.equal(await page.locator('.field-helper').count(), 5);
      const helperCycleAtFive = await page.locator('.field-helper').first().evaluate(element => parseFloat(getComputedStyle(element).animationDuration));
      assert.equal(helperCycleAtFive, helperCycleAtOne);
      assert.equal(await page.locator('[data-scene]').evaluate(element => element.classList.contains('world--stage-reveal')), false);
      await page.evaluate(() => { state.supporters = Game.CONFIG.stand.unlockSupporters; render(); });
      await page.locator('[data-action="stand"]').click();
      assert.equal(await page.locator('.info-stand').isVisible(), true);
      await page.evaluate(() => {
        for (let i = 0; i < 12; i += 1) helperFeedback(1);
      });
      const standPassers = await page.locator('.street-passer--stand').count();
      assert.ok(standPassers >= 1 && standPassers <= 4);
      assert.ok(await page.locator('.field-helper').count() <= 2);
      assert.equal(await page.locator('.info-stand__roof').isVisible(), true);
      assert.equal(await page.locator('.info-stand__counter').isVisible(), true);
      await capture('stand');
      for (let i = 0; i < 9; i += 1) await page.locator('[data-upgrade="stand"]').click();
      await page.evaluate(() => { state.supporters = Game.CONFIG.office.unlockSupporters; render(); });
      await page.locator('[data-action="office"]').click();
      assert.equal(await page.locator('.campaign-house').isVisible(), true);
      await capture('office');
      for (let i = 0; i < 4; i += 1) await page.locator('[data-upgrade="office"]').click();
      await page.evaluate(() => { state.supporters = Game.CONFIG.election.revealSupporters; render(); saveState(); });
      assert.equal(await page.locator('[data-scene]').getAttribute('data-stage'), '5');
      assert.equal(await page.locator('.cityhall').isVisible(), true);
      await capture('election');
      await page.reload();
      assert.equal(await page.locator('[data-scene]').getAttribute('data-stage'), '5');
      await page.evaluate(() => { state.supporters = Game.CONFIG.election.targetSupporters; state.euros = Game.CONFIG.election.entryCost; render(); });
      await page.locator('[data-action="election"]').click();
      assert.equal(await page.locator('[data-ending]').isVisible(), true);
      page.once('dialog', dialog => dialog.accept());
      await page.locator('[data-action="reset"]').click();
      assert.equal(await page.locator('[data-scene]').getAttribute('data-stage'), '0');

      await page.addInitScript(() => {
        localStorage.removeItem('amtsweg-v0.2-save');
        localStorage.setItem('amtsweg-v0.1-save', JSON.stringify({ supporters: 50, contacts: 17, euros: 20, helpers: 2 }));
      });
      await page.reload();
      assert.equal(await page.locator('[data-scene]').getAttribute('data-stage'), '1');
      assert.equal(await page.evaluate(() => state.supporters), 67);
      assert.equal(await page.evaluate(() => state.helperLevel), 2);
      assert.equal(await page.locator('.field-helper').count(), 2);
      results.push({ viewport: width + '×' + height, rapidClicks: audit.total, visibleHelperUnits: true, leftToRightPassers: true, campaignBooth: true, progression: true, reload: true, reset: true, migration: true });
      await page.close();
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ results, errors }, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
