// Mouse and keyboard check on a computer-sized window. usage: node test/desktop.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [], log = [];
  const ok = (c, w) => { log.push((c ? 'PASS ' : 'FAIL ') + w); if (!c) errs.push('FAIL ' + w); };
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ok */ } });
  await page.reload(); await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'desk_title.png') });
  await page.click('[data-a="play"]'); await page.waitForTimeout(200);
  for (let i = 0; i < 12 && (await page.locator('.story').count()); i++) { await page.click('.story'); await page.waitForTimeout(120); }
  ok(await page.locator('.mrow').count() === 7, 'contracts list shows');
  await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'desk_hub.png') });
  await page.click('.mrow[data-id="c1m1"]'); await page.waitForTimeout(400);
  // headless pointer lock swallows synthetic mouse movement, so test the fallback path a browser without it would use
  await page.evaluate(() => { CB.Game.stage.requestPointerLock = null; });
  await page.click('[data-a="go"]'); await page.waitForTimeout(1500);
  ok(await page.evaluate(() => CB.Game.state === 'mission'), 'mission starts');
  await page.evaluate(() => { const st = CB.Game.stop; CB.Game.stop = function () { window.__stopTrace = new Error('stop').stack + ' | result=' + JSON.stringify(CB.Game.sim && CB.Game.sim.result && CB.Game.sim.result.fail) + ' t=' + (CB.Game.sim && CB.Game.sim.t); return st.apply(this, arguments); }; });
  ok(await page.evaluate(() => !document.body.classList.contains('touch')), 'computer layout in use (no touch buttons)');
  try {
  await page.mouse.move(640, 400); await page.waitForTimeout(50);
  const a0 = await page.evaluate(() => ({ ax: CB.Game.sim.sh.ax, ay: CB.Game.sim.sh.ay }));
  for (let i = 1; i <= 12; i++) { await page.mouse.move(640 + i * 10, 400 + i * 5); await page.waitForTimeout(16); }
  const a1 = await page.evaluate(() => ({ ax: CB.Game.sim.sh.ax, ay: CB.Game.sim.sh.ay }));
  ok(a1.ax > a0.ax + 2 && a1.ay < a0.ay - 1, 'moving the mouse right and down moves the crosshair right and down ' + JSON.stringify([a0, a1]));
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(30); } await page.waitForTimeout(500);
  const z = await page.evaluate(() => CB.Game.sim.sh.zoom);
  ok(z > 4, 'wheel zooms in: ' + z.toFixed(1));
  await page.keyboard.down('Shift'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => CB.Game.sim.sh.holding), 'Shift holds breath');
  await page.keyboard.up('Shift'); await page.waitForTimeout(100);
  ok(await page.evaluate(() => !CB.Game.sim.sh.holding), 'releasing Shift lets go');
  console.log(await page.evaluate(() => window.__stopTrace || 'not stopped'));
  await page.evaluate(() => { const s = CB.Game.sim; s.sh.ay = s.lim.y1; s.sh.ax = 0; });
  await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(200);
  console.log(await page.evaluate(() => ({ st: CB.Game.state, sim: !!CB.Game.sim, paused: CB.Game.paused, locked: CB.Game.locked, ui: document.getElementById('ui').className, res: (document.querySelector('.results h1') || {}).innerText, why: (document.querySelector('.why') || {}).innerText })));
  ok(await page.evaluate(() => CB.Game.sim.stats.shots === 1), 'left click fires');
  await page.waitForTimeout(1500);
  await page.keyboard.press('r'); await page.waitForTimeout(200);
  ok(await page.evaluate(() => CB.Game.sim && CB.Game.sim.sh.reloadT > 0), 'R reloads');
  await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'desk_mission.png') });
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => CB.Game.paused), 'Esc opens the notebook');
  await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'desk_notebook.png') });
  } catch (e) { console.log('EXC', e.message.split('\n')[0]); console.log(await page.evaluate(() => window.__stopTrace || 'not stopped via Game.stop; state=' + CB.Game.state + ' sim=' + !!CB.Game.sim)); }
  console.log(log.join('\n')); if (errs.length) { console.log(errs.join('\n')); process.exitCode = 1; } else console.log('ALL DESKTOP CHECKS PASSED');
  await browser.close();
})();
