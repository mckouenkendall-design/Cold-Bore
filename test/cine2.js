// Film the kill camera: stage a mission's final shot, fire it through the real game loop,
// and save a dense run of frames plus contact sheets, at phone-sideways and phone-upright sizes.
//
// usage: node test/cine2.js <mission> <gun> <targetId> [part=torso]
// environment (all optional):
//   SIZES="844x390,390x844"   screen sizes to film at
//   GAP=120                   milliseconds of film between saved frames
//   AT=12                     play the mission for this many seconds before firing (default 0.8)
//   UNTIL="<js>"              or: play until this expression (in the page, `s` is the sim) is true
//   EMIT=parked AFTER=0.7      or: play until the mission has signalled this, plus AFTER seconds
//   GORE=0                    switch blood off
//   KILLCAM=0                 switch the kill camera off (the game should simply play on)
//   CFG='{"muzzle":"mz_supl"}' parts to fit to the rifle
//   SKIP=2.5                  call skip() this many seconds into the film
//   NAME=tag                  extra tag in the file names
//   RESIZE=3                  turn the screen round this many seconds into the film
//   VANTAGE=1                 shooting position, for missions that offer more than one
//   DPR=1.5                   device pixel ratio
//   SETUP="<js>" or "@file"   code run in the page before the mission starts (to stage a test scene)
// Frames: shots/k2_<mission>_<part>[_tag]_<WxH>_<nn>.png, sheets: shots/k2_..._sheet<n>.png
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const [m = 'c1m1', gun = 'fenwick', tid = 't', part = 'torso'] = process.argv.slice(2);
  const E = process.env, sizes = (E.SIZES || '844x390,390x844').split(',').map((s) => s.split('x').map(Number));
  const gap = +(E.GAP || 120), shots = path.join(__dirname, '..', 'shots');
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  let bad = 0;
  for (const [w, h] of sizes) {
    const tag = 'k2_' + m + '_' + part + (E.NAME ? '_' + E.NAME : '') + '_' + w + 'x' + h;
    fs.readdirSync(shots).forEach((f) => { if (f.indexOf(tag + '_') === 0) fs.unlinkSync(path.join(shots, f)); });
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: +(E.DPR || 1.5), hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 6).join('\n')));
    page.on('console', (mm) => { if (mm.type() === 'error') errs.push('CONSOLE ' + mm.text()); });
    await page.goto('file://' + path.join(__dirname, '..', 'index.html') + '?test' + (E.Q ? '&' + E.Q : ''));
    await page.waitForTimeout(700);
    // take the loop over: from here every frame is exactly one sixtieth of a second, whatever the machine is doing
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
    await page.waitForTimeout(120);
    await page.evaluate(({ m, gun, vantage, cfgJ, gore, killcam, setup }) => {
      if (setup) (0, eval)(setup);
      if (gore === '0') CB.Save.data.settings.gore = false;
      if (killcam === '0') CB.Save.data.settings.killcam = false;
      // start from the menus, the way a player does, so the results screen has somewhere to appear
      try { CB.Sfx.unlock(); } catch (e) { /* no sound in this browser */ }
      CB.UI.launch(m, { gun, cfg: Object.assign(CB.defaultConfig(gun), cfgJ ? JSON.parse(cfgJ) : {}), shotSeed: 1, vantage });
    }, { m, gun, vantage: +(E.VANTAGE || 0), cfgJ: E.CFG || '', gore: E.GORE || '', killcam: E.KILLCAM || '', setup: E.SETUP ? (E.SETUP.charAt(0) === '@' ? fs.readFileSync(E.SETUP.slice(1), 'utf8') : E.SETUP) : '' });
    await page.waitForTimeout(1000); // let the fade-in at the start of the mission clear
    const info = await page.evaluate(({ tid, part, at, until, pre }) => {
      const G = CB.Game;
      if (pre) (0, eval)(pre);
      window.__ts = G.last || performance.now();
      window.__frame = () => { window.__ts += 1000 / 60; G.loop(window.__ts); };
      const s = G.sim; let guard = 0;
      const want = until ? new Function('s', 'return (' + until + ')') : null;
      while (G.sim === s && s.state === 'play' && guard++ < 6000 && (want ? !want(s) : s.t < at)) window.__frame();
      // everyone else on the list goes quietly, so this shot is the last one
      s.rules.kill.forEach((id) => { if (id !== tid) { const a = s.byId[id]; if (a && !a.dead) { a.dead = true; a.hidden = true; a.state = 'dead'; a.deadT = 9; a.deathAtT = -9; if (G.oracle) { const b = G.oracle.s.byId[id]; if (b) { b.dead = true; b.hidden = true; b.state = 'dead'; b.deadT = 9; b.deathAtT = -9; } } } } });
      if (s.rules.kill.indexOf(tid) < 0) { s.rules.kill = [tid]; if (G.oracle) G.oracle.s.rules.kill = [tid]; }
      s.rules.destroy = []; s.rules.until = null; s.rules.done = null; s.rules.protect = []; s.rules.civFail = false;
      if (G.oracle) { const r = G.oracle.s.rules; r.destroy = []; r.until = null; r.done = null; r.protect = []; r.civFail = false; G.oracle.catchUp(1e6); }
      const t = s.byId[tid];
      if (!t) return { err: 'no actor ' + tid + ' (have ' + Object.keys(s.byId).join(',') + ')' };
      const p = s.partPoint(t, part), vx = t.inVeh ? t.inVeh.v * t.inVeh.dir * (t.inVeh.goal !== null ? 1 : 0) : (t.goal !== null ? t.vx : 0);
      const sol = s.aimFor(p.x, p.y, p.z, { vx });
      s.setZoom(s.st.zoomMax); s.sh.zoom = s.st.zoomMax;
      s.sh.ax = sol.ax - (s.sh.swx + s.sh.recx + s.sh.offx); s.sh.ay = sol.ay - (s.sh.swy + s.sh.recy + s.sh.offy);
      // time every frame the kill camera draws
      const KC = CB.KillCam, d0 = KC.draw; window.__ms = []; window.__film = [];
      KC.draw = function (dt) { const t0 = performance.now(); d0.call(KC, dt); if (window.__skipT) window.__skipT = false; else window.__ms.push([KC.stage, performance.now() - t0, +(KC.fu || 0).toFixed(3), +KC.T.toFixed(2)]); };
      const a0 = KC.advance; let last = -1e9;
      KC.advance = function (dt) { const r = a0.call(KC, dt); if (r < last - 1e-9) window.__back = (window.__back || 0) + 1; last = r; window.__film.push([+KC.T.toFixed(3), KC.stage, +(r - (KC.o ? KC.o.tHit : 0)).toFixed(4), s.kills.length]); return r; };
      // for comparison: what the ordinary scope picture costs to draw here, at the widest and the closest zoom
      const tScope = (z) => { const z0 = s.sh.zoom; s.sh.zoom = z; const t0 = performance.now(); for (let i = 0; i < 20; i++) G.view.draw(s, 1 / 60, 1 / 60); s.sh.zoom = z0; return +((performance.now() - t0) / 20).toFixed(2); };
      const scopeMs = [tScope(s.st.zoomMin), tScope(s.st.zoomMax)];
      G.fire();
      return { scopeMs, dist: +(p.z - s.eye0.z).toFixed(0), tof: +sol.tof.toFixed(3), synced: !!(G.oracle && G.oracle.synced), anim: t.anim, moving: vx, inVeh: !!t.inVeh, behind: !!t.behind, face: t.face, pen: s.st.pen, pal: s.S.time, t: +s.t.toFixed(2), look: t.look };
    }, { tid, part, at: +(E.AT || 0.8), until: E.UNTIL || (E.EMIT ? 's.did("' + E.EMIT + '") && s.t - s.emitted["' + E.EMIT + '"] > ' + (+(E.AFTER || 0)) : ''), pre: E.PRE || '' });
    console.log(tag, JSON.stringify(info));
    if (info.err) { bad++; await ctx.close(); continue; }
    const per = Math.max(1, Math.round(gap / (1000 / 60))), files = [];
    let n = 0, filmEnd = null, started = false, after = 0, stageAt = {}, resized = false;
    for (let i = 0; i < 900; i++) {
      const st = await page.evaluate(({ per, skip }) => {
        const G = CB.Game, KC = CB.KillCam; let ended = null; window.__skipT = true; // the frame drawn just after a screenshot is slowed by the screenshot itself
        for (let k = 0; k < per && G.sim; k++) {
          const was = G.cine; window.__frame();
          if (skip >= 0 && G.cine && KC.T >= skip && !window.__skipped) { window.__skipped = true; KC.skip(); }
          if (was && !G.cine) ended = KC.T;
        }
        return { cine: G.cine, T: G.cine ? +KC.T.toFixed(2) : null, stage: G.cine ? KC.stage : null, ended, sim: !!G.sim, simState: G.sim ? G.sim.state : 'gone', kills: G.sim ? G.sim.kills.map((k) => k.id + ':' + k.part) : null };
      }, { per, skip: E.SKIP === undefined ? -1 : +E.SKIP });
      if (st.cine) started = true;
      // RESIZE: the phone is turned round partway through the film
      if (E.RESIZE && st.cine && st.T >= +E.RESIZE && !resized) { resized = true; await page.setViewportSize({ width: h, height: w }); await page.waitForTimeout(150); }
      if (st.cine && st.stage !== null && stageAt[st.stage] === undefined) stageAt[st.stage] = st.T;
      if (st.ended !== null && filmEnd === null) filmEnd = st.ended;
      if (started || i < 3) {
        const f = path.join(shots, tag + '_' + String(n++).padStart(2, '0') + '.png');
        await page.screenshot({ path: f }); files.push([f, st.cine ? st.T.toFixed(2) + 's  stage ' + st.stage : (filmEnd !== null ? 'scope' : 'no film')]);
      }
      if (!st.cine && (filmEnd !== null || i >= 3)) { if (++after >= 3) break; }
      if (!st.sim) break;
    }
    // hand-back: the mission must now finish by itself and show the results
    let res = false, endState = null;
    for (let i = 0; i < 80 && !res; i++) {
      endState = await page.evaluate(() => { const G = CB.Game; for (let k = 0; k < 30 && G.sim; k++) window.__frame(); return G.sim ? { state: G.sim.state, t: +G.sim.t.toFixed(2), win: !!G.sim.winAt, kills: G.sim.kills.map((k) => k.id + ':' + k.part), cine: G.cine } : 'ended'; });
      if (endState === 'ended' || (endState.state !== 'play')) { await page.waitForTimeout(1300); res = (await page.locator('.scr.results').count()) > 0; if (res || endState === 'ended') break; }
    }
    const resWin = res ? (await page.locator('.scr.results.win').count()) > 0 : false;
    const tm = await page.evaluate(() => {
      const by = {}; (window.__ms || []).forEach(([st, ms]) => { const b = by[st] || (by[st] = { n: 0, sum: 0, max: 0 }); b.n++; b.sum += ms; b.max = Math.max(b.max, ms); });
      const out = {}; for (const k in by) out['stage' + k] = { frames: by[k].n, avg: +(by[k].sum / by[k].n).toFixed(2), max: +by[k].max.toFixed(2) };
      // checks on the time contract: never backwards, below the hit until the kill, at least one step past it from then on
      const film = window.__film || []; let early = 0, firstPast = null, killAt = null;
      film.forEach((f, i) => { if (f[2] >= 0 && firstPast === null) firstPast = i; if (f[3] > 0 && killAt === null) killAt = i; });
      return { all1: (window.__ms || []).filter((x) => x[0] === 1).map((x) => x[3] + ':' + x[1].toFixed(0)).join(' '), slow: (window.__ms || []).slice().sort((a, b) => b[1] - a[1]).slice(0, 4).map((x) => x.map((v) => +(+v).toFixed(2))), draw: out, back: window.__back || 0, firstPastT: firstPast !== null ? film[firstPast][0] : null, pastBy: firstPast !== null ? film[firstPast][2] : null, killSeenT: killAt !== null ? film[killAt][0] : null, frames: film.length, gore: CB.Save.data.settings.gore };
    });
    console.log('  film ' + (filmEnd === null ? (started ? 'did not end' : 'did not run') : filmEnd.toFixed(2) + ' s') + '  stages begin at ' + JSON.stringify(stageAt) + '  frames saved ' + n);
    console.log('  draw ms per frame (headless): ' + JSON.stringify(tm.draw) + '  slowest [stage, ms, flight share, film s]: ' + JSON.stringify(tm.slow) + (E.ALL ? '\n' + tm.all1 : ''));
    console.log('  time contract: went backwards ' + tm.back + ' times; first at or past the hit at film ' + tm.firstPastT + ' s by ' + tm.pastBy + ' s; kill seen in the world by film ' + tm.killSeenT + ' s');
    console.log('  hand-back: ' + JSON.stringify(endState) + '  results screen: ' + (res ? (resWin ? 'yes, contract complete' : 'yes, FAILED contract') : 'NO'));
    if (E.KILLCAM === '0') { if (started) { console.log('  FAIL: the kill camera ran although it is switched off'); bad++; } }
    else if (!started || filmEnd === null) bad++;
    if (!res || !resWin || tm.back) bad++;
    if (errs.length) { console.log(errs.slice(0, 8).join('\n')); bad++; }
    await ctx.close();
    // contact sheets: twenty frames to a sheet, small enough to read at a glance
    const cols = w >= h ? 4 : 8, rows = w >= h ? 5 : 3, perSheet = cols * rows, tw = w >= h ? 422 : 211, th = Math.round((tw * h) / w);
    const c2 = await browser.newContext({ viewport: { width: cols * (tw + 4) + 4, height: rows * (th + 18) + 4 }, deviceScaleFactor: 1 });
    const p2 = await c2.newPage();
    for (let s0 = 0, k = 0; s0 < files.length; s0 += perSheet, k++) {
      const cells = files.slice(s0, s0 + perSheet).map(([f, cap]) => '<div><img src="file://' + f + '" width="' + tw + '" height="' + th + '"><i>' + path.basename(f).slice(-6, -4) + '  ' + cap + '</i></div>').join('');
      const html = '<body style="margin:4px;background:#111;display:grid;grid-template-columns:repeat(' + cols + ',' + tw + 'px);gap:4px;font:11px monospace;color:#bbb">' + cells + '<style>div{display:flex;flex-direction:column}i{font-style:normal;height:14px;overflow:hidden}img{display:block}</style></body>';
      const hf = path.join(shots, tag + '_sheet.html'); fs.writeFileSync(hf, html);
      await p2.goto('file://' + hf); await p2.waitForTimeout(150);
      await p2.screenshot({ path: path.join(shots, tag + '_sheet' + k + '.png') });
      fs.unlinkSync(hf);
    }
    await c2.close();
  }
  await browser.close();
  console.log(bad ? 'FAILED (' + bad + ')' : 'ok');
  process.exit(bad ? 1 : 0);
})();
