// Tester mode (temporary): the switch in Settings unlocks everything in a separate save, and
// switching it off brings the real save back exactly as it was.
// usage: node test/tester.js
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
  const tap = async (sel) => {
    const b = await page.locator(sel).first().boundingBox(); if (!b) throw new Error('no ' + sel);
    const id = tid++, x = b.x + b.width / 2, y = b.y + b.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id }] }); await page.waitForTimeout(40);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(350);
  };
  const shot = (n) => page.screenshot({ path: path.join(__dirname, '..', 'shots', 'tester_' + n + '.png') });
  const ev = (fn, a) => page.evaluate(fn, a);
  const url = 'file://' + path.join(__dirname, '..', 'index.html');

  // a real save with a little progress
  await page.goto(url);
  await ev(() => localStorage.clear());
  await page.reload(); await page.waitForTimeout(700);
  await ev(() => { const d = CB.Save.data; d.credits = 512; d.xp = 300; d.seen.prologue = 1; d.seen.ch1 = 1; d.missions.c1m1 = { done: true, stars: 2, plays: 1 }; CB.Save.write(); });
  const realBefore = await ev(() => localStorage.getItem('coldbore.save.v1'));
  await ev(() => { CB.UI.tab = 'settings'; CB.UI.hub(); }); await page.waitForTimeout(500);
  ok(await page.locator('[data-a="tester"]').count() === 1, 'settings shows the tester mode switch');
  await shot('01_settings_off');

  // switch on
  await tap('[data-a="tester"]');
  const on = await ev(() => {
    const d = CB.Save.data, M = CB.MISSIONS;
    return {
      tester: !!d.tester && CB.Tester.on, guns: CB.GUNS.every((g) => !!d.guns[g.id]),
      parts: CB.PARTS.every((p) => p.price === 0 || !!d.parts[p.id]), scopes: CB.SCOPES.every((s) => !!d.scopes[s.id]),
      lastOpen: CB.Progress.missionOpen(M[M.length - 1]), allOpen: M.every((m) => CB.Progress.missionOpen(m)),
      credits: d.credits, caches: d.caches.length, badge: getComputedStyle(document.body, '::after').content,
      keptStars: d.missions.c1m1 && d.missions.c1m1.stars,
    };
  });
  ok(on.tester, 'tester mode is on');
  ok(on.guns && on.parts && on.scopes, 'every rifle, part and scope is owned');
  ok(on.allOpen && on.lastOpen, 'every contract is open, including the last one');
  ok(on.credits >= 1000000 && on.caches >= 6, 'a million credits and some caches (' + on.credits + ', ' + on.caches + ')');
  ok(/TESTER/.test(on.badge), 'the menus show a TESTER MODE badge');
  ok(on.keptStars === 2, 'the tester save starts from a copy of the real progress');
  ok(await ev(() => localStorage.getItem('coldbore.save.v1')) === realBefore, 'the real save in storage is untouched');
  await shot('02_settings_on');

  // every skin, and the armory with everything
  ok(await ev(() => { const d = CB.Save.data; return CB.SKINS ? CB.SKINS.every((s) => !!d.skins[s.id]) : Object.keys(d.skins).length >= 94; }), 'every skin is owned');
  await ev(() => { CB.UI.tab = 'armory'; CB.UI.hub(); }); await page.waitForTimeout(700); await shot('03_armory');
  await ev(() => { CB.UI.tab = 'contracts'; CB.UI._chSet = true; CB.UI.chapter = 6; CB.Save.data.seen.ch6 = 1; CB.UI.hub(); }); await page.waitForTimeout(700); await shot('04_chapter6');
  ok(await page.locator('.mrow').count() > 0 && await page.locator('.mrow .lock, .mrow.shut').count() === 0, 'chapter 6 contracts are listed without locks');

  // change things in tester mode, then play a late contract with a late rifle for a few seconds
  await ev(() => { const d = CB.Save.data; d.equipped = 'anvil'; d.guns.anvil.cfg.skin = 'kintsugi'; CB.Save.write(); });
  await ev(() => CB.Game.start('c6m6', { gun: 'anvil' })); await page.waitForTimeout(2500);
  ok(await ev(() => CB.Game.state === 'mission' && !!CB.Game.sim), 'a chapter 6 contract starts with the Anvil');
  await shot('05_mission');
  await ev(() => CB.Game.stop()); await page.waitForTimeout(300);

  // reload: still in tester mode, tester changes kept
  await page.reload(); await page.waitForTimeout(800);
  ok(await ev(() => CB.Tester.on && CB.Save.data.equipped === 'anvil'), 'after a reload tester mode is still on and its changes are kept');

  // switch off
  await ev(() => { CB.UI.tab = 'settings'; CB.UI.hub(); }); await page.waitForTimeout(500);
  await tap('[data-a="tester"]');
  const off = await ev(() => { const d = CB.Save.data; return { tester: !!d.tester || CB.Tester.on, credits: d.credits, guns: Object.keys(d.guns), eq: d.equipped, stars: d.missions.c1m1 && d.missions.c1m1.stars, open7: CB.Progress.missionOpen(CB.MISSIONS[6]), badge: getComputedStyle(document.body, '::after').content }; });
  ok(!off.tester, 'tester mode is off');
  ok(off.credits === 512 && off.guns.join() === 'fenwick' && off.eq === 'fenwick' && off.stars === 2, 'the real save is back exactly: ' + JSON.stringify(off));
  ok(!off.open7, 'locked contracts are locked again');
  ok(!/TESTER/.test(off.badge), 'the badge is gone');
  await shot('06_settings_back');
  await page.reload(); await page.waitForTimeout(800);
  ok(await ev(() => !CB.Tester.on && CB.Save.data.credits === 512), 'after a reload the real save is still the one in use');

  // on again: the tester save remembers; "start again" makes a fresh one
  await ev(() => { CB.UI.tab = 'settings'; CB.UI.hub(); }); await page.waitForTimeout(500);
  await tap('[data-a="tester"]');
  ok(await ev(() => CB.Tester.on && CB.Save.data.equipped === 'anvil'), 'switching on again returns to the same tester save');
  await tap('[data-a="testerAgain"]');
  ok(await ev(() => CB.Tester.on && CB.Save.data.equipped === 'fenwick' && !!CB.Save.data.guns.aria), '"Start the tester save again" makes a fresh copy, still with everything');
  ok(await ev(() => localStorage.getItem('coldbore.save.v1')) !== null && await ev(() => JSON.parse(localStorage.getItem('coldbore.save.v1')).credits) === 512, 'the real save in storage still has its own credits');
  await ev(() => CB.Tester.set(false));

  console.log(log.join('\n'));
  if (errs.length) { console.log(errs.join('\n')); process.exitCode = 1; } else console.log('tester mode: all good');
  await browser.close();
})();
