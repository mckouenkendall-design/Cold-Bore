// Fast-forward and "Retry from just before your first shot", through the real game loop.
//
// 1. Fast-forward: holding it runs the world three times faster, and only while no round is in the
//    air and no alarm is up. It lets go by itself the moment a round leaves the barrel.
// 2. Retry: play a contract, wander the scope about, fire, finish. Then retry from just before the
//    first shot: the world is run again off screen with the same scope movements, and must arrive in
//    exactly the state the first attempt was in at that moment (every person, car, lamp and the clock).
//    A second retry from the retried attempt must work too.
// 3. The results screen offers the retry (the menus may draw their own button; if not, one is added).
//
// usage: node test/retry.js [missionId,missionId]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const ids = (process.argv[2] || 'c1m1,c1m3,c2m2,c6m4').split(',');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [], log = [];
  const ok = (c, w) => { log.push((c ? 'PASS ' : 'FAIL ') + w); if (!c) errs.push('FAIL ' + w); };
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ok */ } });
  await page.reload(); await page.waitForTimeout(600);
  await page.evaluate(() => {
    window.requestAnimationFrame = () => 0; CB.Game.noAutoPause = true; CB.UI.attractStop();
    // what the world looks like: everyone's place and state, the cars, the lamps, the clock
    window.__sig = (s) => s.t.toFixed(6) + '|' + s.actors.map((a) => a.id + ':' + a.x.toFixed(5) + ',' + a.y.toFixed(4) + (a.dead ? 'd' : '') + a.state + (a.hidden ? 'h' : '')).join(' ') + '|' + s.vehicles.map((v) => v.x.toFixed(4)).join(',') + '|' + s.S.objects.map((o) => (o.alive === false ? 0 : 1)).join('') + '|' + (s.alarmT === null ? '-' : s.alarmT.toFixed(3)) + '|' + s.coverUntil.toFixed(3);
    window.__ts = 1000; window.__frame = (n) => { for (let i = 0; i < (n || 1); i++) { window.__ts += 1000 / 60; CB.Game.loop(window.__ts); } };
  });

  // ---- 1. fast-forward ----
  const ff = await page.evaluate(() => {
    const G = CB.Game; CB.Save.data.settings.killcam = false;
    CB.UI.launch('c1m1', { gun: 'fenwick', shotSeed: 1 }); window.__frame(30);
    const s = G.sim, t0 = s.t; window.__frame(60); const normal = s.t - t0;
    G.ffHeld = true; const t1 = s.t; window.__frame(60); const fast = s.t - t1; const lit = G.hud.ff.classList.contains('on');
    // fire into the sky: fast-forward lets go while the round is out
    s.sh.ay = s.lim.y1; s.fire(); window.__frame(2); const during = G.ffOn, rate = G.simRate;
    G.ffHeld = false; window.__frame(1);
    return { normal, fast, lit, during, rate };
  });
  ok(Math.abs(ff.normal - 1) < 0.05, 'one second of frames is one second of world (' + ff.normal.toFixed(3) + ')');
  ok(Math.abs(ff.fast - 3) < 0.1, 'held, fast-forward runs the world three times faster (' + ff.fast.toFixed(3) + ' s in one second)');
  ok(ff.lit, 'the fast-forward button lights while it runs');
  ok(!ff.during && ff.rate === 1, 'it lets go by itself while a round is in the air');
  await page.evaluate(() => CB.Game.stop());

  // ---- 2. retry from just before the first shot ----
  for (const id of ids) {
    const r = await page.evaluate((id) => {
      const G = CB.Game, M = CB.MISSION_BY_ID[id];
      const gun = ['fenwick', 'halden', 'northwind'].find((g) => !CB.gunAllowed(M, CB.buildStats(g, CB.Test.cfgFor(M, g))));
      CB.Save.data.settings.killcam = false;
      CB.UI.launch(id, { gun, cfg: CB.Test.cfgFor(M, gun), shotSeed: 7 });
      const s = G.sim, sigs = {}, step0 = G.simStep;
      G.simStep = function () { step0(); if (G.ilog) sigs[G.ilog.length / 4] = window.__sig(G.sim); };
      // wander the scope and the zoom about, turn the dial if there is one, hold fast-forward for a while
      let k = 0;
      while (s.t < 16 && s.state === 'play') {
        k++; G.aimDelta(Math.sin(k * 0.05) * 9, Math.cos(k * 0.031) * 5, 300); if (k % 70 === 0) G.zoomTo((k % 3) / 2); if (k === 200) s.dial(2);
        G.ffHeld = k > 300 && k < 420;
        window.__frame(1);
      }
      G.ffHeld = false; G.simStep = step0;
      // fire at the first person in the kill list (or anywhere), then let it play out
      const first = s.t, tid = s.rules.kill[0], a = tid && s.byId[tid];
      if (a && !a.dead && !a.hidden) { const p = s.partPoint(a, 'torso'), sol = s.aimFor(p.x, p.y, p.z); s.sh.ax = sol.ax - s.sh.swx - s.sh.recx - s.sh.offx; s.sh.ay = sol.ay - s.sh.swy - s.sh.recy - s.sh.offy; }
      s.fire();
      for (let i = 0; i < 2400 && G.sim && !G.endShown; i++) window.__frame(1);
      if (!G.endShown && s.state === 'play') { s.fail('test', 'stopped by the test', 0); for (let i = 0; i < 30 && !G.endShown; i++) window.__frame(1); }
      const res = s.result, last = G.lastStart;
      if (!res) return { id, err: 'no result, state ' + s.state + ' t=' + s.t };
      const at = CB.Game.retryPoint(res);
      // the retry, straight from the game (not through a screen)
      G.stop();
      const went = CB.Game.retryShot(last, res);
      const s2 = G.sim, n2 = G.ilog.length / 4;
      const same = sigs[n2] === window.__sig(s2);
      const out = { id, gun, first: +first.toFixed(2), at, went, t2: s2 && +s2.t.toFixed(3), same, mine: window.__sig(s2).slice(0, 160), theirs: (sigs[n2] || '-').slice(0, 160), shots2: s2.stats.shots, ffAfter: CB.Game.canFF() };
      // and once more, from the retried attempt: play two seconds, fire, finish, retry again
      for (let i = 0; i < 120; i++) window.__frame(1);
      const sigB = {}; sigB[G.ilog.length / 4] = window.__sig(s2);
      s2.fire(); for (let i = 0; i < 2400 && G.sim && !G.endShown; i++) window.__frame(1);
      if (!G.endShown && s2.state === 'play') { s2.fail('test', 'stopped by the test', 0); for (let i = 0; i < 30 && !G.endShown; i++) window.__frame(1); }
      const res2 = s2.result, last2 = G.lastStart; G.stop();
      const at2 = CB.Game.retryPoint(res2);
      if (at2 !== null) { CB.Game.retryShot(last2, res2); const s3 = G.sim; out.again = +s3.t.toFixed(3); out.againOk = Math.abs(s3.t - at2) < 0.02; G.stop(); }
      else out.againOk = true;
      return out;
    }, id);
    if (r.err) { ok(false, id + ': ' + r.err); continue; }
    ok(r.went && Math.abs(r.t2 - r.at) < 0.02, id + ': retry picks up at ' + r.at + ' s, 5 s before the first shot at ' + r.first + ' s (now ' + r.t2 + ')');
    ok(r.same, id + ': the replayed world is exactly the world the first attempt had at that moment' + (r.same ? '' : '\n   mine   ' + r.mine + '\n   theirs ' + r.theirs));
    ok(r.shots2 === 0, id + ': no shot has been fired yet in the retried attempt');
    ok(r.againOk, id + ': a retry from a retried attempt works too' + (r.again !== undefined ? ' (' + r.again + ')' : ''));
  }

  // ---- 3. the results screen offers it ----
  const scr = await page.evaluate(() => {
    const G = CB.Game; window.requestAnimationFrame = () => 0;
    CB.UI.launch('c1m1', { gun: 'fenwick', shotSeed: 3 });
    const s = G.sim; for (let i = 0; i < 60 * 12; i++) window.__frame(1);
    s.sh.ay = s.lim.y1; s.fire(); // a miss into the sky: heard, alarm, he runs
    for (let i = 0; i < 60 * 40 && G.sim && !G.endShown; i++) window.__frame(1);
    return { ended: G.endShown, at: s.result && s.result.retryAt, seen: s.result && s.result.seenBy && s.result.seenBy.who + ' ' + s.result.seenBy.what };
  });
  await page.waitForTimeout(1500);
  const btn = await page.locator('.results [data-a="retryShot"]').count();
  ok(scr.ended && btn === 1, 'the results screen offers "Retry from just before your first shot" (retry at ' + scr.at + ', ' + scr.seen + ')');
  await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'retry_results.png') });
  if (btn) {
    await page.locator('.results [data-a="retryShot"]').click(); await page.waitForTimeout(300);
    ok(await page.evaluate(() => CB.Game.state === 'mission' && Math.abs(CB.Game.sim.t - 7) < 0.6), 'and the button starts the retry (t=' + await page.evaluate(() => CB.Game.sim && CB.Game.sim.t.toFixed(2)) + ')');
  }
  console.log(log.join('\n'));
  if (errs.length) { console.log(errs.join('\n')); process.exitCode = 1; } else console.log('fast-forward and retry: all good');
  await browser.close();
})();
