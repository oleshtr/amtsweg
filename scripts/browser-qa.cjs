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
  const viewports = [[1440, 900], [900, 800], [390, 844]];
  const results = [];
  try {
    for (const [width, height] of viewports) {
      const page = await browser.newPage({ viewport: { width, height } });
      page.on('pageerror', error => errors.push(width + ' page: ' + error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(width + ' console: ' + message.text()); });
      await page.goto(url);
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      const capture = async phase => {
        await page.waitForTimeout(600);
        await page.screenshot({
          path: path.join(os.tmpdir(), 'amtsweg-polish-' + width + '-' + phase + '.png'),
          fullPage: true,
        });
      };
      assert.equal(await page.locator('[data-scene]').getAttribute('data-stage'), '0');
      assert.equal(await page.locator('[data-euro-stat]').isVisible(), false);
      assert.equal(await page.locator('[data-action="flyer"]').isVisible(), true);
      assert.equal(await page.locator('[data-action="reset"]').isVisible(), true);
      assert.equal(await page.locator('[data-campaign-level]').textContent(), '1');
      assert.equal(await page.locator('[data-action="donate"]').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
      for (const selector of ['.room--helpers', '.info-stand', '.campaign-house', '.cityhall', '[data-build="helper"]']) {
        assert.equal(await page.locator(selector).isVisible(), false, selector + ' visible at start');
      }
      await capture('fresh');
      const clickAudit = await page.evaluate(() => {
        const button = document.querySelector('[data-action="flyer"]');
        for (let i = 0; i < 10; i += 1) button.click();
        const ten = state.supporters;
        for (let i = 0; i < 100; i += 1) button.click();
        return { ten, total: state.supporters, disabled: button.disabled,
          particles: document.querySelectorAll('.flyer-particle').length,
          armAnimations: document.querySelector('[data-candidate] .actor__arm').getAnimations().length,
          passerAnimations: [...document.querySelectorAll('.passer')].reduce((sum, passer) => sum + passer.getAnimations().length, 0) };
      });
      assert.equal(clickAudit.ten, 10);
      assert.equal(clickAudit.total, 110);
      assert.equal(clickAudit.disabled, false);
      assert.equal(clickAudit.particles, 12);
      assert.ok(clickAudit.armAnimations <= 4);
      assert.ok(clickAudit.passerAnimations <= 6);
      await page.waitForTimeout(700);
      assert.equal(await page.locator('.flyer-particle').count(), 0);
      page.once('dialog', dialog => dialog.accept());
      await page.locator('[data-action="reset"]').click();
      const spam = count => page.evaluate(n => {
        const button = document.querySelector('[data-action="flyer"]');
        for (let i = 0; i < n; i += 1) button.click();
      }, count);
      await spam(30);
      await page.locator('[data-upgrade="campaign"]').click();
      assert.equal(await page.locator('[data-campaign-level]').textContent(), '2');
      await capture('campaign2');
      await spam(27);
      await page.locator('[data-upgrade="campaign"]').click();
      assert.equal(await page.locator('[data-campaign-level]').textContent(), '3');
      await capture('campaign3');
      await spam(33);
      assert.equal(await page.locator('[data-euro-stat]').isVisible(), true);
      await capture('cash');
      await page.evaluate(() => { state.supporters = Game.CONFIG.helper.unlockSupporters; state.euros = 10000; render(); });
      assert.equal(await page.locator('.crowd-reaction').evaluate(element => element.classList.contains('crowd-reaction--active')), true);
      await page.locator('[data-upgrade="campaign"]').click();
      await page.locator('[data-upgrade="campaign"]').click();
      assert.equal(await page.locator('[data-campaign-level]').textContent(), '5');
      await capture('campaign5');
      await page.locator('[data-upgrade="campaign"]').click();
      assert.equal(await page.locator('[data-campaign-level]').textContent(), '6');
      await page.locator('[data-action="helper"]').click();
      await capture('helper');
      const helperCycleAtOne = await page.locator('.helper--one').evaluate(element => parseFloat(getComputedStyle(element).animationDuration));
      await page.waitForTimeout(150);
      await page.locator('[data-upgrade="helper"]').click();
      assert.equal(await page.locator('[data-scene]').evaluate(element => element.classList.contains('world--stage-reveal')), false);
      assert.equal(await page.locator('.room--helpers').evaluate(element => element.classList.contains('room--level-pulse')), true);
      for (let i = 0; i < 3; i += 1) await page.locator('[data-upgrade="helper"]').click();
      const helperCycleAtFive = await page.locator('.helper--one').evaluate(element => parseFloat(getComputedStyle(element).animationDuration));
      assert.ok(helperCycleAtFive < helperCycleAtOne);
      assert.equal(await page.locator('.room--helpers').evaluate(element => element.classList.contains('room--milestone-pulse')), true);
      await page.evaluate(() => { state.supporters = Game.CONFIG.stand.unlockSupporters; render(); });
      await page.locator('[data-action="stand"]').click();
      await capture('stand');
      for (let i = 0; i < 9; i += 1) await page.locator('[data-upgrade="stand"]').click();
      await page.evaluate(() => { state.supporters = Game.CONFIG.office.unlockSupporters; render(); });
      await page.locator('[data-action="office"]').click();
      await capture('office');
      for (let i = 0; i < 4; i += 1) await page.locator('[data-upgrade="office"]').click();
      await page.evaluate(() => { state.supporters = Game.CONFIG.election.revealSupporters; render(); saveState(); });
      assert.equal(await page.locator('[data-scene]').getAttribute('data-stage'), '5');
      assert.equal(await page.locator('[data-chapter-progress]').isVisible(), true);
      await capture('election');
      await page.reload();
      assert.equal(await page.locator('[data-scene]').getAttribute('data-stage'), '5');
      assert.equal(await page.locator('[data-campaign-level]').textContent(), '6');
      await page.waitForTimeout(550);
      assert.equal(await page.locator('[data-scene]').evaluate(element => element.classList.contains('world--stage-reveal')), false);
      const visibleMilestones = await page.evaluate(() => {
        state.helperLevel = 10;
        state.officeLevel = 10;
        render();
        return {
          secondHelper: getComputedStyle(document.querySelector('.helper--two')).display !== 'none',
          secondDesk: getComputedStyle(document.querySelector('.station-detail--desk')).display !== 'none',
          secondWorker: getComputedStyle(document.querySelector('.station-detail--second-worker')).display !== 'none',
        };
      });
      assert.deepEqual(visibleMilestones, { secondHelper: true, secondDesk: true, secondWorker: true });
      await page.evaluate(() => { state.helperLevel = 5; state.officeLevel = 5; render(); });
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        flyer: document.querySelector('[data-action="flyer"]').getBoundingClientRect().width > 0,
        helper: document.querySelector('[data-upgrade="helper"]').getBoundingClientRect().width > 0,
        stand: document.querySelector('[data-upgrade="stand"]').getBoundingClientRect().width > 0,
        office: document.querySelector('[data-upgrade="office"]').getBoundingClientRect().width > 0,
      }));
      assert.equal(layout.overflow, false);
      assert.ok(layout.flyer && layout.helper && layout.stand && layout.office);
      await page.evaluate(() => {
        state.supporters = Game.CONFIG.election.targetSupporters;
        state.euros = Game.CONFIG.election.entryCost;
        render();
      });
      await page.locator('[data-action="election"]').click();
      assert.equal(await page.locator('[data-scene]').getAttribute('data-stage'), '6');
      assert.equal(await page.locator('[data-ending]').isVisible(), true);
      page.once('dialog', dialog => dialog.accept());
      await page.locator('[data-action="reset"]').click();
      assert.equal(await page.locator('[data-scene]').getAttribute('data-stage'), '0');
      await page.addInitScript(() => {
        localStorage.removeItem('amtsweg-v0.2-save');
        localStorage.setItem('amtsweg-v0.1-save', JSON.stringify({
          supporters: 50, euros: 20, helpers: 2, standOwned: true, officeOwned: true,
        }));
      });
      await page.reload();
      assert.equal(await page.locator('[data-scene]').getAttribute('data-stage'), '2');
      assert.equal(await page.evaluate(() => state.helperLevel), 2);
      page.once('dialog', dialog => dialog.accept());
      await page.locator('[data-action="reset"]').click();
      results.push({ viewport: width + '×' + height, layout, fresh: true, progression: true, reload: true, victory: true, reset: true, migration: true });
      await page.close();
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ results, errors }, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
