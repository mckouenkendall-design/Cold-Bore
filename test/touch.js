// End-to-end test with REAL touch input on a phone-sized screen:
// fresh save, title, story cards, mission list, briefing, then the first
// mission played with finger drags, the zoom slider, hold breath, fire and
// reload, through to the results screen and into the armory.
// usage: node test/touch.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [], log = [];
  const ok = (cond, what) => { log.push((cond ? 'PASS ' : 'FAIL ') + what); if (!cond) errs.push('FAIL ' + what); };
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  const cdp = await ctx.newCDPSession(page);
  let tid = 1;
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const tap = async (x, y) => { const id = tid++; await touch('touchStart', [{ x, y, id }]); await page.waitForTimeout(40); await touch('touchEnd', []); await page.waitForTimeout(60); };
  const tapSel = async (sel) => { const b = await page.locator(sel).first().boundingBox(); if (!b) throw new Error('no element ' + sel); await tap(b.x + b.width / 2, b.y + b.height / 2); };
  const shot = (n) => page.screenshot({ path: path.join(__dirname, '..', 'shots', 'touch_' + n + '.png') });
  const ev = (fn, arg) => page.evaluate(fn, arg);

  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await ev(() => { try { localStorage.clear(); } catch (e) { /* ok */ } });
  await page.reload(); await page.waitForTimeout(900);
  ok(await page.locator('.logo').count() === 1, 'title screen shows');
  await shot('01_title');
  await tapSel('[data-a="play"]'); await page.waitForTimeout(300);
  ok(await page.locator('.story').count() === 1, 'prologue card shows after Begin');
  for (let i = 0; i < 12 && (await page.locator('.story').count()); i++) { await tap(195, 500); await page.waitForTimeout(150); }
  ok(await page.locator('.mrow').count() === 7, 'contracts list shows seven chapter one missions');
  await shot('02_contracts');
  await tapSel('.mrow[data-id="c1m1"]'); await page.waitForTimeout(500);
  ok(await page.locator('.brief').count() === 1, 'briefing opens');
  await shot('03_brief');
  await tapSel('[data-a="go"]'); await page.waitForTimeout(1500);
  ok(await ev(() => CB.Game.state === 'mission' && !!CB.Game.sim), 'mission starts');

  // --- drag to aim ---
  const a0 = await ev(() => ({ ax: CB.Game.sim.sh.ax, ay: CB.Game.sim.sh.ay }));
  let id = tid++;
  await touch('touchStart', [{ x: 200, y: 300, id }]);
  for (let i = 1; i <= 10; i++) { await touch('touchMove', [{ x: 200 + i * 8, y: 300 + i * 4, id }]); await page.waitForTimeout(16); }
  await touch('touchEnd', []);
  const a1 = await ev(() => ({ ax: CB.Game.sim.sh.ax, ay: CB.Game.sim.sh.ay }));
  ok(a1.ax < a0.ax - 2 && a1.ay > a0.ay + 1, 'dragging right and down pans the view (scene follows the finger): ' + JSON.stringify([a0, a1]));
  // drag starting in the empty area below the scope also aims
  id = tid++;
  await touch('touchStart', [{ x: 150, y: 560, id }]);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [{ x: 150 - i * 10, y: 560, id }]); await page.waitForTimeout(16); }
  await touch('touchEnd', []);
  const a2 = await ev(() => CB.Game.sim.sh.ax);
  ok(a2 > a1.ax + 1, 'dragging outside the scope circle also aims');

  // --- zoom slider ---
  const zb = await page.locator('.h-zoom .zt').boundingBox();
  id = tid++;
  await touch('touchStart', [{ x: zb.x + zb.width / 2, y: zb.y + zb.height - 4, id }]);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', [{ x: zb.x + zb.width / 2, y: zb.y + zb.height - 4 - (i * (zb.height - 8)) / 8, id }]); await page.waitForTimeout(16); }
  await touch('touchEnd', []); await page.waitForTimeout(500);
  const z = await ev(() => [CB.Game.sim.sh.zoom, CB.Game.sim.st.zoomMin, CB.Game.sim.st.zoomMax]);
  ok(z[0] > z[2] - 0.6, 'zoom slider dragged to the top reaches full zoom: ' + z.map((v) => v.toFixed(1)).join('/'));
  // pinch to zoom out
  await touch('touchStart', [{ x: 120, y: 250, id: 50 }, { x: 280, y: 250, id: 51 }]);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', [{ x: 120 + i * 8, y: 250, id: 50 }, { x: 280 - i * 8, y: 250, id: 51 }]); await page.waitForTimeout(16); }
  await touch('touchEnd', []); await page.waitForTimeout(400);
  const z2 = await ev(() => CB.Game.sim.sh.zoom);
  ok(z2 < z[0] - 1, 'pinching in zooms out: ' + z2.toFixed(1));
  await ev(() => CB.Game.sim.setZoom(9));

  // --- notebook (pause) and back ---
  await tapSel('.h-pause'); await page.waitForTimeout(300);
  ok(await ev(() => CB.Game.paused) && (await page.locator('.nb').count()) === 1, 'notebook pauses the mission');
  await shot('04_notebook');
  await tapSel('.nb .sh-foot [data-a="resume"]'); await page.waitForTimeout(250);
  ok(await ev(() => !CB.Game.paused), 'resume works');

  // --- wait for the collector to stop for his cigarette, then aim at him using drags only ---
  // (the headless browser draws slowly, so give the test a long cigarette to work with)
  await ev(() => { CB.Game.sim.byId.t.routine[1][1] = 90; });
  await page.waitForFunction(() => { const t = CB.Game.sim && CB.Game.sim.byId.t; return t && t.anim === 'smoke' && t.goal === null; }, null, { timeout: 200000 }).catch(async (e) => { console.log(log.join('\n')); console.log(await ev(() => { const s = CB.Game.sim; return s ? { t: s.t, state: s.state, fail: s.failInfo, tgt: s.byId.t && [s.byId.t.x, s.byId.t.anim, s.byId.t.state], alarm: s.alarmBy } : 'no sim'; })); throw e; });
  const aimErr = () => ev(() => { const s = CB.Game.sim, t = s.byId.t, p = s.partPoint(t, 'torso'), sol = s.aimFor(p.x, p.y, p.z), ppm = CB.Game.view.ppm(s.sh.zoom); return { dx: sol.ax - s.sh.ax, dy: sol.ay - s.sh.ay, ppm, sens: CB.Save.data.settings.sens, now: s.aimNow(), sol: { ax: sol.ax, ay: sol.ay } }; });
  for (let k = 0; k < 14; k++) {
    const e = await aimErr();
    if (Math.hypot(e.dx, e.dy) < 0.12) break;
    // slow drags use the fine-control factor 0.5; scene follows the finger, so drag opposite to the needed aim change
    const px = clamp(-(e.dx * e.ppm) / (e.sens * 0.5), -140, 140), py = clamp((e.dy * e.ppm) / (e.sens * 0.5), -140, 140);
    id = tid++;
    await touch('touchStart', [{ x: 195, y: 620, id }]);
    const steps = Math.max(4, Math.ceil(Math.hypot(px, py) / 2.2));
    for (let i = 1; i <= steps; i++) { await touch('touchMove', [{ x: 195 + (px * i) / steps, y: 620 + (py * i) / steps, id }]); await page.waitForTimeout(18); }
    await touch('touchEnd', []); await page.waitForTimeout(30);
  }
  const e1 = await aimErr();
  ok(Math.hypot(e1.dx, e1.dy) < 0.5, 'fine drags bring the crosshair onto the target (error ' + Math.hypot(e1.dx, e1.dy).toFixed(2) + ' mils)');
  await shot('05_aimed');

  // --- hold breath, then fire the moment the wobble is small ---
  await tapSel('.h-breath'); await page.waitForTimeout(450);
  ok(await ev(() => CB.Game.sim.sh.holding), 'hold breath button steadies the rifle');
  const sway = await ev(() => Math.hypot(CB.Game.sim.sh.swx, CB.Game.sim.sh.swy));
  ok(sway < 0.6, 'sway while holding breath is small (' + sway.toFixed(2) + ' mils)');
  const fb = await page.locator('.h-fire').boundingBox();
  await tap(fb.x + fb.width / 2, fb.y + fb.height / 2);
  await page.waitForTimeout(250);
  ok(await ev(() => CB.Game.sim.stats.shots === 1 && CB.Game.sim.sh.ammo === CB.Game.sim.st.mag - 1), 'fire button fires exactly one round');
  await shot('06_fired');
  await page.waitForFunction(() => !CB.Game.sim || CB.Game.sim.state !== 'play', null, { timeout: 20000 });
  await page.waitForTimeout(1800);
  ok(await page.locator('.results').count() === 1, 'results screen appears');
  const won = await page.locator('.results.win').count();
  ok(won === 1, 'the touch-played mission was won');
  await page.waitForTimeout(1600);
  await shot('07_results');
  const saved = await ev(() => { const d = JSON.parse(localStorage.getItem('coldbore.save.v1')); return { done: d.missions.c1m1 && d.missions.c1m1.done, stars: d.missions.c1m1 && d.missions.c1m1.stars, cr: d.credits, xp: d.xp }; });
  ok(saved.done && saved.cr > 0, 'progress was saved on the device: ' + JSON.stringify(saved));

  // --- next contract unlocked, armory reachable, a purchase works ---
  await tapSel('[data-a="next"]'); await page.waitForTimeout(500);
  ok(await page.locator('.brief').count() === 1 && (await page.locator('.brief h2').innerText()).toUpperCase().includes('LIGHTS OUT'), 'next contract briefing opens');
  await tapSel('.brief [data-a="back"]'); await page.waitForTimeout(300);
  await tapSel('.tabb[data-tab="armory"]'); await page.waitForTimeout(400);
  ok(await page.locator('.acard').count() === 16, 'armory lists sixteen rifles');
  await shot('08_armory');
  await ev(() => { CB.Save.data.credits = 5000; });
  await tapSel('.acard[data-id="ratter"]'); await page.waitForTimeout(400);
  await tapSel('[data-a="buy"]'); await page.waitForTimeout(400);
  ok(await ev(() => !!CB.Save.data.guns.ratter && CB.Save.data.credits === 4100 && CB.Save.data.equipped === 'ratter'), 'buying a rifle spends credits and equips it');
  await page.locator('.slot[data-slot="skin"]').scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
  await shot('09_bench');
  // reload survives
  await page.reload(); await page.waitForTimeout(800);
  ok(await ev(() => !!CB.Save.data.guns.ratter && CB.Save.data.missions.c1m1.done), 'save survives a page reload');
  ok(await page.locator('[data-a="play"]').innerText().then((t) => /continue/i.test(t)), 'title offers Continue on a returning save');

  console.log(log.join('\n'));
  if (errs.length) { console.log('\n' + errs.join('\n')); process.exitCode = 1; } else console.log('\nALL TOUCH CHECKS PASSED');
  await browser.close();
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
})();
