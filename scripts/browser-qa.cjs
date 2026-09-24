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
        await page.waitForTimeout(220);
        await page.screenshot({ path: path.join(os.tmpdir(), 'amtsweg-v03-' + width + '-' + phase + '.png'), fullPage: true });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
      };

      assert.equal(await page.locator('[data-scene]').getAttribute('data-stage'), '0');
      assert.equal(await page.locator('[data-euro-stat]').isVisible(), false);
      assert.equal(await page.locator('[data-operations]').isVisible(), false);
      assert.equal(await page.locator('[data-helper-field] .field-helper').count(), 0);
      assert.equal(await page.locator('[data-stand-world]').isVisible(), false);
      assert.equal(await page.locator('[data-office-world]').isVisible(), false);
      assert.equal(await page.locator('.cityhall').isVisible(), false);
      await capture('fresh');

      const spamResult = await page.evaluate(() => {
        const button = document.querySelector('[data-action="flyer"]');
        for (let i = 0; i < 25; i += 1) button.click();
        return state.supporters;
      });
      assert.equal(spamResult, 1);

      await page.evaluate(() => { state.supporters = Game.CONFIG.helper.unlockSupporters; state.lastManualAt = 0; render(); });
      assert.equal(await page.locator('[data-build="helper"]').isVisible(), true);
      await page.locator('[data-action="helper"]').click();
      assert.equal(await page.locator('[data-scene]').getAttribute('data-stage'), '1');
      assert.equal(await page.locator('[data-helper-field] .field-helper').count(), 1);
      assert.equal(await page.locator('[data-operations]').isVisible(), true);
      await capture('helper');

      await page.evaluate(() => { state.helperProgress = .99; render(); });
      const beforeAuto = await page.evaluate(() => state.supporters);
      await page.waitForTimeout(350);
      assert.ok(await page.evaluate(() => state.supporters) > beforeAuto);

      await page.evaluate(() => { state.supporters = Game.CONFIG.donation.unlockSupporters; state.euros = 1000; render(); });
      assert.equal(await page.locator('[data-euro-stat]').isVisible(), true);
      assert.equal(await page.locator('.donation-point').isVisible(), true);
      await page.locator('[data-upgrade="helper"]').click();
      await page.locator('[data-upgrade="helper"]').click();
      assert.equal(await page.locator('[data-helper-field] .field-helper').count(), 3);

      await page.evaluate(() => { state.supporters = Game.CONFIG.stand.unlockSupporters; state.euros = 10000; render(); });
      await page.locator('[data-action="stand"]').click();
      assert.equal(await page.locator('[data-stand-world]').isVisible(), true);
      assert.equal(await page.locator('[data-lane="stand"]').isVisible(), true);
      await capture('stand');
      await page.locator('[data-upgrade="stand"]').click();
      await page.locator('[data-upgrade="stand"]').click();
      assert.equal(await page.evaluate(() => state.standLevel), 3);
      assert.equal(await page.locator('.stand-worker--two').isVisible(), true);

      await page.evaluate(() => { state.supporters = Game.CONFIG.office.unlockSupporters; state.euros = 10000; render(); });
      await page.locator('[data-action="office"]').click();
      assert.equal(await page.locator('[data-office-world]').isVisible(), true);
      await page.locator('[data-upgrade="office"]').click();
      await page.locator('[data-upgrade="office"]').click();
      assert.equal(await page.evaluate(() => state.officeLevel), 3);
      assert.equal(await page.locator('.office-window-worker--two').isVisible(), true);
      await capture('office');

      await page.evaluate(() => { state.supporters = Game.electionRevealSupporters(state); state.euros = 10000; render(); saveState(); });
      assert.equal(await page.locator('[data-scene]').getAttribute('data-stage'), '5');
      assert.equal(await page.locator('.cityhall').isVisible(), true);
      assert.equal(await page.locator('[data-chapter-progress]').isVisible(), true);
      await page.reload();
      assert.equal(await page.locator('[data-scene]').getAttribute('data-stage'), '5');

      await page.evaluate(() => { state.supporters = Game.electionTarget(state); state.euros = Game.electionEntryCost(state); render(); });
      await page.locator('[data-action="election"]').click();
      assert.equal(await page.locator('[data-ending]').isVisible(), true);
      const career = await page.evaluate(() => state.careerPoints);
      assert.ok(career >= 1);
      await capture('won');
      await page.locator('[data-action="next-district"]').click();
      assert.equal(await page.evaluate(() => state.district), 2);
      assert.equal(await page.evaluate(() => state.supporters), 0);
      assert.equal(await page.evaluate(() => state.careerPoints), career);

      await page.evaluate(() => {
        localStorage.clear();
        localStorage.setItem('amtsweg-v0.2-save', JSON.stringify({ supporters: 80, euros: 20, helperLevel: 2, lastUpdatedAt: Date.now() }));
      });
      await page.reload();
      assert.equal(await page.evaluate(() => state.helperCount), 2);
      assert.equal(await page.locator('[data-helper-field] .field-helper').count(), 2);

      results.push({ viewport: width + '×' + height, cooldown: true, helpersAreVisibleUnits: true,
        standCycles: true, officeCycles: true, prestige: true, reload: true, migration: true });
      await page.close();
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ results, errors }, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
