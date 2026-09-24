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
      assert.equal(await page.locator('[data-scene]').getAttribute('data-stage'), '0');
      assert.equal(await page.locator('[data-euro-stat]').isVisible(), false);
      assert.equal(await page.locator('[data-action="flyer"]').isVisible(), true);
      assert.equal(await page.locator('[data-action="donate"]').count(), 0);
      if (width === 390) {
        await page.screenshot({ path: path.join(os.tmpdir(), 'amtsweg-qa-fresh-390.png'), fullPage: true });
      }
      await page.locator('[data-action="flyer"]').click();
      assert.equal(await page.locator('[data-action="flyer"]').isDisabled(), true);
      assert.equal(await page.locator('[data-supporters]').innerText(), '0');
      await page.waitForTimeout(1900);
      assert.equal(await page.locator('[data-supporters]').innerText(), '1');
      await page.evaluate(() => { state.supporters = 50; state.euros = 10000; render(); });
      await page.locator('[data-action="helper"]').click();
      for (let i = 0; i < 4; i += 1) await page.locator('[data-upgrade="helper"]').click();
      await page.evaluate(() => { state.supporters = 150; render(); });
      await page.locator('[data-action="stand"]').click();
      for (let i = 0; i < 9; i += 1) await page.locator('[data-upgrade="stand"]').click();
      await page.evaluate(() => { state.supporters = 350; render(); });
      await page.locator('[data-action="office"]').click();
      for (let i = 0; i < 4; i += 1) await page.locator('[data-upgrade="office"]').click();
      await page.evaluate(() => { state.supporters = 650; render(); saveState(); });
      assert.equal(await page.locator('[data-scene]').getAttribute('data-stage'), '5');
      assert.equal(await page.locator('[data-chapter-progress]').isVisible(), true);
      await page.reload();
      assert.equal(await page.locator('[data-scene]').getAttribute('data-stage'), '5');
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
      if (width === 1440 || width === 390) {
        await page.screenshot({ path: path.join(os.tmpdir(), 'amtsweg-qa-' + width + '.png'), fullPage: true });
      }
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
