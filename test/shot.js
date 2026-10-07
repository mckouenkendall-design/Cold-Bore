// Take screenshots of the game in a headless phone-sized browser.
// usage: node test/shot.js "<query>" <name> [wait ms] [w] [h] [js to run before shot]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [query = '', name = 'shot', wait = '1500', w = '390', h = '844', script = ''] = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
  const mobile = +w < 700;
  const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html') + (query ? '?' + query : ''));
  await page.waitForTimeout(+wait);
  if (script) { const r = await page.evaluate(script); if (r !== undefined) console.log('eval:', JSON.stringify(r)); await page.waitForTimeout(350); }
  await page.screenshot({ path: path.join(__dirname, '..', 'shots', name + '.png') });
  if (errs.length) console.log(errs.join('\n')); else console.log('ok', name);
  await browser.close();
})();
