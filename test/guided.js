// Guided runs: can a player who does nothing but follow the coach three-star every mission?
//
// For every mission, every shooting position and every set of story choices the mission is
// tested with, a bot plays using ONLY what the coach shows: it puts the crosshair on the coach's
// mark (a point out in the world), fires only when the coach says FIRE NOW, and holds its breath,
// turns the dial or reloads only when the coach asks. One rifle per mission: the Fenwick when the
// mission allows it, otherwise the first allowed one from a short list.
//
// It also checks that the coach only looks: the ordinary test bot is run twice on the same seed,
// once with a coach reading along every single step, and the two runs must end identically.
//
// usage: node test/guided.js [missionId,missionId|all] [seed,seed] [dt]
//   dt is the length of one world step: 1/60 like the test bot (default), or 120 for the game's own.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const only = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : null;
  const seeds = (process.argv[3] || '1').split(',').map(Number);
  const dt = 1 / (+process.argv[4] || 60);
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html') + '?test');
  await page.waitForTimeout(400);
  let bad = 0;
  for (const seed of seeds) {
    const out = await page.evaluate(({ only, seed, dt }) => {
      const T = CB.Test, C = CB.Coach, rows = [];
      const PREF = ['fenwick', 'halden', 'marrow', 'vantage', 'northwind', 'aria', 'anvil', 'stormglass'];
      // a fingerprint of how a run ended: who is where, who died when, what was hit
      const sig = (s) => s.t.toFixed(4) + '|' + s.stats.shots + '|' + s.kills.map((k) => k.id + k.part + k.t.toFixed(4)).join(',') + '|' + s.actors.map((a) => a.x.toFixed(3) + (a.dead ? 'd' : '')).join(',') + '|' + (s.alarmT === null ? '-' : s.alarmT.toFixed(3)) + '|' + s.S.objects.map((o) => (o.alive === false ? 0 : 1)).join('');
      const SimP = CB.Sim.prototype, step0 = SimP.step;
      let last = null;
      CB.MISSIONS.forEach((M) => {
        if (only && only.indexOf(M.id) < 0) return;
        const g = PREF.concat(CB.GUNS.map((x) => x.id)).find((id) => !CB.gunAllowed(M, CB.buildStats(id, T.cfgFor(M, id))));
        (M.testFlags || [{}]).forEach((flags) => {
          for (let v = 0; v < (M.vantages || [0]).length; v++) {
            const o = { vantage: v, flags, seed, dt };
            const r = C.play(M.id, g, o);
            // the ordinary bot, without and then with a coach reading along every step
            SimP.step = function (d) { last = this; return step0.call(this, d); };
            const a = T.run(M.id, g, { vantage: v, flags, seed }); const sa = sig(last);
            SimP.step = function (d) { last = this; if (!this._coach) this._coach = new C(this); this._coach.update(); return step0.call(this, d); };
            const b = T.run(M.id, g, { vantage: v, flags, seed }); const sb = sig(last);
            SimP.step = step0;
            rows.push({ m: M.id, v, flags: JSON.stringify(flags), gun: g, ok: r.ok, stars: r.stars, shots: r.shots, par: r.par, t: r.t, fail: r.fail, alarmBy: r.alarmBy, clean: r.clean, guide: r.guide, bot: a.ok ? a.stars : 0, botT: a.t, same: sa === sb && a.t === b.t && a.stars === b.stars });
          }
        });
      });
      return rows;
    }, { only, seed, dt });
    let won = 0, three = 0, diff = 0;
    console.log('seed', seed, ' step 1/' + Math.round(1 / dt));
    out.forEach((r) => {
      if (r.ok) won++; if (r.ok && r.stars === 3) three++; if (!r.same) diff++;
      const flags = r.flags === '{}' ? '' : ' ' + r.flags;
      const note = !r.ok ? '  FAIL ' + r.fail : r.stars < 3 ? '  ' + (r.clean ? '' : 'not clean (' + (r.alarmBy || 'panic') + ') ') + (r.shots > r.par ? r.shots + ' shots, par ' + r.par : '') : '';
      console.log('  ' + (r.m + ' v' + r.v).padEnd(9) + (r.gun).padEnd(11) + (r.ok ? 'won ' : 'lost') + '  ' + '*'.repeat(r.stars || 0).padEnd(3) + '  ' + String(r.shots).padStart(2) + ' shots  t=' + String(r.t).padStart(5) + '  (bot ' + r.bot + ' stars, t=' + r.botT + ')' + (r.guide ? '' : '  no walkthrough') + (r.same ? '' : '  COACH CHANGED THE RUN') + flags + note);
    });
    console.log('  runs', out.length, ' won', won, ' three stars', three, ' under three stars', out.length - three, ' runs the coach changed', diff);
    bad += out.length - three + diff;
  }
  if (errs.length) { console.log(errs.join('\n')); bad++; }
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
