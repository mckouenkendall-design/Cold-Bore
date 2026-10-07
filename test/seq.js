// Take a timed series of screenshots. usage:
// node test/seq.js "<query>" <name> <waitMs> "<js>" "<ms,ms,ms...>" [w] [h]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [query, name, wait, script, times, w = '390', h = '844'] = process.argv.slice(2);
  const browser = await chromium.launch();
  const mobile = +w < 700;
  const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message, (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html') + (query ? '?' + query : ''));
  await page.waitForTimeout(+wait);
  if (script) { const r = await page.evaluate(script); if (r !== undefined) console.log('eval:', JSON.stringify(r)); }
  let last = 0, i = 0;
  for (const t of times.split(',').map(Number)) {
    await page.waitForTimeout(Math.max(0, t - last)); last = t;
    await page.screenshot({ path: path.join(__dirname, '..', 'shots', name + '_' + (i++) + '.png'), clip: { x: 0, y: 40, width: +w, height: Math.min(+h - 40, 470) } });
  }
  await browser.close();
})();
