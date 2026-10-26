// The in-mission notebook scrolls with a finger, and radio messages and hints close on a tap.
// Real touch events on a sideways phone. usage: node test/notebook.js [old]
// ("old" puts back the CSS rule that used to block scrolling, to show the test can fail.)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [], log = [];
  const ok = (c, what) => { log.push((c ? 'PASS ' : 'FAIL ') + what); if (!c) errs.push('FAIL ' + what); };
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  const cdp = await ctx.newCDPSession(page);
  let tid = 1;
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(700);
  if (process.argv[2] === 'old') await page.addStyleTag({ content: 'body.in-mission #overlay .sh-body * { touch-action: none !important; }' });
  await page.evaluate(() => CB.Game.start('c2m1'));
  await page.waitForTimeout(1800);
  // a hint and a radio message, then tap each. One at a time, and the box is marked and checked as an
  // object, so a hint the mission itself shows meanwhile (which replaces ours) is not mistaken for ours.
  for (const [sel, push] of [['.h-msg .hintbox', "CB.Game.pushMsg('hint', 'A test hint that should close when tapped.', 30)"], ['.h-sub .radio', "CB.Game.pushMsg('Marlow', 'A test radio line.', 30)"]]) {
    const b = await page.evaluate(([sel, push]) => { (0, eval)(push); const e = document.querySelector(sel); if (!e) return null; e.dataset.t = '1'; const r = e.getBoundingClientRect(); return r.width ? { x: r.x, y: r.y, width: r.width, height: r.height } : null; }, [sel, push]);
    ok(!!b, sel + ' is on screen');
    if (!b) continue;
    const id = tid++; await touch('touchStart', [{ x: b.x + b.width / 2, y: b.y + b.height / 2, id }]); await page.waitForTimeout(60); await touch('touchEnd', []);
    // a tap cuts the box's time to now; it then fades over 0.6 s of game time and goes
    const cut = await page.evaluate((sel) => { const e = document.querySelector(sel + '[data-t]'); return !e || e._until <= CB.Game.sim.t + 1e-6; }, sel);
    for (let w = 0; w < 80 && await page.locator(sel + '[data-t]').count() > 0; w++) await page.waitForTimeout(100);
    ok(cut && await page.locator(sel + '[data-t]').count() === 0, sel + ' closes on a tap');
  }
  // a drag that starts on a message still aims
  await page.evaluate(() => CB.Game.pushMsg('hint', 'Drag across me.', 30)); await page.waitForTimeout(300);
  const hb = await page.locator('.h-msg .hintbox').first().boundingBox();
  const a0 = await page.evaluate(() => CB.Game.sim.sh.ax);
  let id = tid++;
  await touch('touchStart', [{ x: hb.x + 20, y: hb.y + 10, id }]);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', [{ x: hb.x + 20 - i * 12, y: hb.y + 10, id }]); await page.waitForTimeout(16); }
  await touch('touchEnd', []); await page.waitForTimeout(200);
  const a1 = await page.evaluate(() => CB.Game.sim.sh.ax);
  ok(Math.abs(a1 - a0) > 1, 'a drag that starts on a hint still aims (' + a0.toFixed(1) + ' -> ' + a1.toFixed(1) + ')');
  ok(await page.locator('.h-msg .hintbox').count() === 1, 'and does not close it');
  // the notebook
  await page.evaluate(() => CB.Game.pause(true)); await page.waitForTimeout(500);
  const box = page.locator('#overlay .sh-body').first();
  const info = await box.evaluate((e) => ({ sh: e.scrollHeight, ch: e.clientHeight }));
  ok(info.sh > info.ch + 40, 'the notebook is taller than the screen (' + info.sh + ' > ' + info.ch + ')');
  const bb = await box.boundingBox();
  const p = await page.locator('#overlay .sh-body p, #overlay .sh-body li').first().boundingBox();
  const sx = p ? p.x + 30 : bb.x + bb.width / 2, sy = Math.min(bb.y + bb.height - 30, (p ? p.y + 6 : bb.y + bb.height - 30));
  const startY = bb.y + bb.height - 30;
  id = tid++;
  await touch('touchStart', [{ x: sx, y: startY, id }]);
  for (let i = 1; i <= 12; i++) { await touch('touchMove', [{ x: sx, y: startY - i * 14, id }]); await page.waitForTimeout(16); }
  await touch('touchEnd', []); await page.waitForTimeout(400);
  const top = await box.evaluate((e) => e.scrollTop);
  ok(top > 40, 'dragging up on the notebook text scrolls it down (scrollTop ' + top + ')');
  id = tid++;
  await touch('touchStart', [{ x: sx, y: bb.y + 40, id }]);
  for (let i = 1; i <= 12; i++) { await touch('touchMove', [{ x: sx, y: bb.y + 40 + i * 14, id }]); await page.waitForTimeout(16); }
  await touch('touchEnd', []); await page.waitForTimeout(400);
  const top2 = await box.evaluate((e) => e.scrollTop);
  ok(top2 < top - 30, 'dragging down scrolls it back up (scrollTop ' + top2 + ')');
  await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'notebook.png') });
  console.log(log.join('\n')); if (errs.length) { console.log(errs.join('\n')); process.exitCode = 1; } else console.log('notebook and messages: all good');
  await browser.close();
})();
