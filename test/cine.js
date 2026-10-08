// Fire the winning shot of a mission in the real game loop and capture the kill camera.
// usage: node test/cine.js <mission> <gun> <targetId> [part=torso] [frames=10] [gap ms=300] [w=844] [h=390]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [m = 'c1m1', gun = 'fenwick', tid = 't', part = 'torso', frames = '10', gap = '300', w = '844', h = '390'] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +(process.env.DPR || 1.5), hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 6).join('\n')));
  page.on('console', (mm) => { if (mm.type() === 'error') errs.push('CONSOLE ' + mm.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html') + '?test&m=' + m + '&gun=' + gun + (process.env.Q ? '&' + process.env.Q : ''));
  await page.waitForTimeout(+(process.env.WAIT || 1500));
  if (process.env.PRE) await page.evaluate(process.env.PRE);
  // kill everyone on the list except the chosen target, quietly, so this shot is the last one
  const info = await page.evaluate(([tid, part]) => {
    const G = CB.Game, s = G.sim;
    s.rules.kill.forEach((id) => { if (id !== tid) { const a = s.byId[id]; if (a && !a.dead) { a.dead = true; a.hidden = true; a.state = 'dead'; a.deadT = 9; a.deathAtT = -9; if (G.oracle) { const b = G.oracle.s.byId[id]; b.dead = true; b.hidden = true; b.state = 'dead'; b.deadT = 9; b.deathAtT = -9; } } } });
    s.rules.destroy = []; s.rules.until = null; s.rules.done = null; if (G.oracle) { const r = G.oracle.s.rules; r.destroy = []; r.until = null; r.done = null; }
    const t = s.byId[tid], p = s.partPoint(t, part), lead = { vx: t.goal !== null ? t.vx : 0 }, sol = s.aimFor(p.x, p.y, p.z, lead);
    s.setZoom(s.st.zoomMax); s.sh.zoom = s.st.zoomMax;
    s.sh.ax = sol.ax - (s.sh.swx + s.sh.recx + s.sh.offx); s.sh.ay = sol.ay - (s.sh.swy + s.sh.recy + s.sh.offy);
    G.fire();
    return { synced: G.oracle && G.oracle.synced, dist: p.z, tof: sol.tof };
  }, [tid, part]);
  console.log(JSON.stringify(info));
  for (let i = 0; i < +frames; i++) { await page.waitForTimeout(+gap); await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'cine_' + m + '_' + i + '.png') }); }
  const st = await page.evaluate(() => { const G = CB.Game, s = G.sim; return s ? { cine: G.cine, kills: s.kills.map((k) => k.id + ':' + k.part), win: !!s.winAt, t: s.t, state: s.state, misses: G.oracle && G.oracle.misses } : 'ended'; });
  console.log(JSON.stringify(st));
  if (errs.length) { console.log(errs.join('\n')); process.exitCode = 1; } else console.log('ok');
  await browser.close();
})();
