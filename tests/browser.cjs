'use strict';
// Optional integration runner: npm install --no-save playwright, then npm run test:browser.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createServer } = require('../server.js');

const checks = [];
function check(name, condition) {
  assert.ok(condition, name);
  checks.push(name);
  console.log('PASS ' + name);
}

(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

    await page.goto(url);
    await page.waitForSelector('[data-workers] .person');

    const read = () => page.evaluate(() => state);
    check('fresh street starts at level 1 with no automation', (await read()).standLevel === 1 && (await read()).teamLevel === 0);
    check('flyer action is visible', await page.locator('[data-action="start"]').isVisible());

    await page.locator('[data-action="start"]').click();
    check('flyer click rewards immediately', await page.locator('[data-supporters]').innerText() === '1');
    check('flyer click spawns a visible feedback element', await page.locator('.flyer-projectile').count() > 0);

    for (let i = 0; i < 9; i++) await page.locator('[data-action="start"]').click();
    await page.locator('[data-action="upgrade"]').click();
    check('first stand level costs 10', (await read()).standLevel === 2 && (await read()).supporters === 0);
    check('stand does not visually jump before milestone 10', await page.locator('[data-stand]').getAttribute('data-tier') === '0');

    while (!(await page.locator('[data-action="helper"]').isEnabled())) {
      await page.locator('[data-action="start"]').click();
    }
    await page.locator('[data-action="helper"]').click();
    check('first team level unlocks automation', (await read()).teamLevel === 1 && (await read()).street.active === true);
    check('first helper appears in the world', await page.locator('[data-workers] .helper').count() === 1);

    while ((await read()).standLevel < 10) {
      if (await page.locator('[data-action="upgrade"]').isEnabled()) {
        await page.locator('[data-action="upgrade"]').click();
      } else {
        await page.locator('[data-action="start"]').click();
      }
    }
    check('level 10 is first visible stand milestone', await page.locator('[data-stand]').getAttribute('data-tier') === '1');
    check('stand can keep upgrading after level 10', (await read()).standLevel === 10 && (await page.locator('[data-upgrade-cost]').innerText()) !== 'MAX');

    const xs = [];
    for (let i = 0; i < 4; i++) {
      const transform = await page.locator('[data-pedestrians] .person').nth(i).evaluate(el => el.style.transform);
      xs.push(transform);
    }
    check('ambient passers are rendered', xs.some(Boolean));

    await page.setViewportSize({ width: 390, height: 844 });
    check('mobile has no horizontal document overflow', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    check('mobile flyer action remains usable', await page.locator('[data-action="start"]').isVisible());

    check('gameplay produced no browser errors', errors.length === 0);

    page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-action="reset"]').click();
    check('reset returns to level 1 and team 0', (await read()).standLevel === 1 && (await read()).teamLevel === 0);

    await context.close();
    console.log(checks.length + ' browser checks passed.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
