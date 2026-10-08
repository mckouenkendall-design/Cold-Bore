// Every mission through the real loop with drawing on. usage: node test/smoke.js [gun] [frames]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const gun = process.argv[2] || 'aria', frames = +(process.argv[3] || 480);
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  // WIDE=1 runs it as a phone held sideways (844 x 390), which is how the game is meant to be played
  const wide = !!process.env.WIDE;
  const ctx = await browser.newContext({ viewport: wide ? { width: 844, height: 390 } : { width: 390, height: 844 }, deviceScaleFactor: +(process.env.DPR || 1), hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 6).join('\n')));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html') + '?test');
  await page.waitForTimeout(300);
  await page.evaluate(() => { CB.Sfx.unlock(); CB.UI.attractStop(); });
  const ids = await page.evaluate(() => CB.MISSIONS.map((m) => m.id));
  let n = 0; const slow = [];
  for (const id of ids) {
    const t0 = Date.now();
    const cfgOver = process.argv[4] ? JSON.parse(process.argv[4]) : null;
    const r = await page.evaluate(({ id, gun, frames, cfgOver }) => { try { return CB.Test.smoke(id, gun, frames, cfgOver); } catch (e) { return { err: e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n') }; } }, { id, gun, frames, cfgOver });
    const ms = (Date.now() - t0) / frames;
    if (r.err) { errs.push(id + ': ' + r.err); } else n++;
    slow.push([id, ms.toFixed(1)]);
  }
  console.log('smoke', gun, 'ok', n, '/', ids.length, ' ms per frame (headless, incl. sim):', slow.map((s) => s.join(':')).join(' '));
  if (errs.length) { console.log(errs.slice(0, 12).join('\n')); process.exitCode = 1; }
  await browser.close();
})();
