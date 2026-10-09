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
  if (!process.env.NOGAME) bad += await inTheGame(browser, errs);
  if (errs.length) { console.log(errs.join('\n')); bad++; }
  await browser.close();
  process.exit(bad ? 1 : 0);
})();

// One guided run through the real game on a sideways phone, from the briefing to the results:
// "Show me how", "Start a guided run", the coach's card on screen, a player who only does what
// the coach says (aiming with the same moves a finger makes, firing on FIRE NOW), then the
// results: three stars, the note, no caches, and the three-star cache still unpaid.
async function inTheGame(browser, errs) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage(), fails = [];
  const ok = (c, what) => { console.log((c ? '  PASS ' : '  FAIL ') + what); if (!c) fails.push(what); };
  page.on('pageerror', (e) => errs.push('PAGEERROR (in the game) ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  const cdp = await ctx.newCDPSession(page);
  let tid = 1;
  const tap = async (sel) => { const b = await page.locator(sel).first().boundingBox(); if (!b) return false; const id = tid++; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2, id }] }); await page.waitForTimeout(40); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(300); return true; };
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ok */ } });
  await page.reload(); await page.waitForTimeout(500);
  await page.addStyleTag({ content: ':root{--sal:50px;--sar:50px;--sab:21px}' });
  await page.evaluate(() => { CB.Game.resize(); CB.Game.noAutoPause = true; const d = CB.Save.data; d.seen.prologue = 1; d.seen.ch1 = 1; CB.Save.write(); CB.UI.attractStop(); CB.UI.brief(CB.MISSION_BY_ID.c1m1); });
  await page.waitForTimeout(300);
  console.log('in the game: c1m1, sideways, guided from the briefing');
  ok(await tap('.brief [data-a="showhow"]'), 'the briefing has "Show me how"');
  ok(await page.locator('.showhow .deal').count() === 1 && (await page.locator('.showhow .deal b').innerText()).includes('no caches from this run'), 'it explains the deal');
  ok(await tap('.showhow [data-a="guided"]'), 'it offers a guided run');
  await page.waitForTimeout(600);
  ok(await page.evaluate(() => !!CB.Game.coach && document.body.classList.contains('guided') && getComputedStyle(document.querySelector('.h-coach')).display !== 'none'), 'the guided run starts with the coach on screen');
  // play it: aim where the coach marks, fire on FIRE NOW, nothing else
  let seen = {}, t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    const s = await page.evaluate(() => {
      const G = CB.Game; if (!G.sim || !G.coach) return { done: !!document.querySelector('.results') };
      const sim = G.sim, o = G.coach.out || G.coach.update();
      if (o.kind === 'hold' && !sim.sh.holding) sim.holdBreath(true);
      if (o.aim) { const sh = sim.sh; for (let i = 0; i < 3; i++) { const e = sim.eye(), d = o.aim.z - e.z; sh.ax = ((o.aim.x - e.x) / d) * 1000 - (sh.swx + sh.recx + sh.offx); sh.ay = ((o.aim.y - e.y) / d) * 1000 - (sh.swy + sh.recy + sh.offy); } const o2 = G.coach.update(); if (o2.fire) { if (window._sawFire && document.querySelector('.h-coach .cc-hd').textContent.indexOf('FIRE NOW') >= 0) G.fire(); window._sawFire = true; } } // like a person: see FIRE NOW, then press
      return { kind: o.kind, head: o.head, card: document.querySelector('.h-coach .cc-hd').textContent, fireBtn: document.querySelector('.h-fire').classList.contains('go') };
    });
    if (s.done) break;
    if (s.kind) { seen[s.kind] = true; if (s.head === 'FIRE NOW') seen.fireNow = seen.fireNow || (s.card.indexOf('FIRE NOW') >= 0 && s.fireBtn); }
    await page.waitForTimeout(30);
  }
  ok(seen.wait, 'the coach said to wait');
  ok(!!seen.fireNow, 'FIRE NOW showed on the card and the fire button');
  await page.waitForTimeout(1500);
  ok(await page.locator('.results').count() === 1, 'the run ends on the results screen');
  const r = await page.evaluate(() => ({ stars: document.querySelectorAll('.bigstars .stars i.on').length, note: (document.querySelector('.gnote') || {}).innerText || '', caches: CB.Save.data.caches.length, rec: CB.Save.data.missions.c1m1, g: CB.Save.data.stats.guns.fenwick }));
  ok(r.stars === 3, 'three stars (' + r.stars + ')');
  ok(/guided run: no caches this time/i.test(r.note), 'the results say "Guided run: no caches this time."');
  ok(r.caches === 0 && r.rec && r.rec.stars === 3 && r.rec.c3paid === false, 'no cache was given, and the three-star cache is still to be earned');
  ok(r.g && r.g.kills === 1 && r.g.shots >= 1, 'the kill is recorded against the rifle');
  ok(await tap('.results [data-a="again"]'), '"Try it yourself" is offered');
  await page.waitForTimeout(700);
  ok(await page.evaluate(() => CB.Game.state === 'mission' && !CB.Game.coach && !document.body.classList.contains('guided')), 'and it starts the same contract without the guide');
  await ctx.close();
  return fails.length;
}
