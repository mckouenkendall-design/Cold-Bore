// Screenshot helper for a phone held sideways (or any size), with real touch flags and
// optional fake notch insets.
// usage: node test/snap.js "<query>" <name> [w=844] [h=390] [wait=1500] [js to run] [insets "l,r,b"] [more waits/js pairs...]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const a = process.argv.slice(2);
  const query = a[0] || '', name = a[1] || 'snap', w = +(a[2] || 844), h = +(a[3] || 390), wait = +(a[4] || 1500), script = a[5] || '', ins = (a[6] || '').split(',').map(Number);
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const touch = process.env.NOTOUCH ? false : true;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: +(process.env.DPR || 2), hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html') + (query ? '?' + query : ''));
  if (ins.length >= 2 && !isNaN(ins[0])) await page.evaluate((i) => { const r = document.documentElement.style; r.setProperty('--sal', i[0] + 'px'); r.setProperty('--sar', i[1] + 'px'); r.setProperty('--sab', (i[2] || 0) + 'px'); if (window.CB && CB.Game && CB.Game.resize) CB.Game.resize(); }, ins);
  await page.waitForTimeout(wait);
  if (script) { const r = await page.evaluate(script); if (r !== undefined) console.log('eval:', JSON.stringify(r)); await page.waitForTimeout(400); }
  await page.screenshot({ path: path.join(__dirname, '..', 'shots', name + '.png') });
  // extra frames: pairs of (wait ms, suffix)
  for (let i = 7; i + 1 < a.length; i += 2) { await page.waitForTimeout(+a[i]); await page.screenshot({ path: path.join(__dirname, '..', 'shots', name + '_' + a[i + 1] + '.png') }); }
  if (errs.length) console.log(errs.join('\n')); else console.log('ok', name);
  await browser.close();
})();
