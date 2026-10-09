// Marking a target, and the Range never raising an alarm.
//
// Part 1, no drawing: the problem the mark solves. Maeve (c2m7), from the Harbour master's tower,
// with the crosshair on the guard g1 about 310 m away: RANGE and HOLD are right. Raise the scope
// by the hold, as you must to hit him, and the middle of the scope is on the water 400+ m behind
// him, so RANGE and HOLD now describe the water. The amber marker follows the bullet's own path,
// so it is right only while that path really touches him: a little higher and it jumps to the drop
// for the water behind. Then the same with a mark: the distance stays at the guard's and the
// marker and the read-outs stay put however the scope moves. Marking never changes the mission.
// Part 2, real touch on a phone held sideways (844 x 390 and 667 x 375, with notch insets) and
// upright (390 x 844): the MARK button sits clear of every other control, a tap locks the
// distance, the read-out says so, a long press clears it, a new start clears it, and only the
// players who should have it get it.
// Part 3: the M key on a computer.
// Part 4: the Range. A loud rifle at the Range used to raise the alarm (banner, pill, siren,
// shakier aim). Nothing can raise one there now, while a contract still does.
//
// Pictures land in shots/mark_*.png.
// usage: node test/mark.js          all four parts
//        node test/mark.js 1,4      only some of them
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
const SHOTS = path.join(__dirname, '..', 'shots');

const PARTS = (process.argv[2] || '1,2,3,4').split(',').map(Number), part = (n) => PARTS.indexOf(n) >= 0;
const log = [], errs = [];
const ok = (c, what) => { log.push((c ? 'PASS ' : 'FAIL ') + what); if (!c) errs.push('FAIL ' + what); };
const note = (s) => log.push('     ' + s);

// in the page: aim the crosshair (straight line, no allowance for drop) at a world point
const AIM_FN = `window.__aimAt = function (sim, x, y, z) { for (let i = 0; i < 4; i++) { const e = sim.eye(); sim.sh.ax = (x - e.x) / (z - e.z) * 1000; sim.sh.ay = (y - e.y) / (z - e.z) * 1000; } };
window.__sky = function (sim) { const L = sim.lim; for (let ay = L.y1; ay > L.y0; ay -= 0.5) for (let ax = L.x0; ax <= L.x1; ax += 1) { if (!sim.rangeAt(ax, ay)) return { ax, ay }; } return null; };`;

async function newPage(browser, o) {
  const ctx = await browser.newContext({ viewport: { width: o.w, height: o.h }, deviceScaleFactor: o.dpr || 2, hasTouch: !!o.touch, isMobile: !!o.touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await page.goto(URL + (o.query ? '?' + o.query : ''));
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ok */ } });
  await page.reload(); await page.waitForTimeout(700);
  await page.evaluate(AIM_FN);
  if (o.ins) await page.evaluate((i) => { const r = document.documentElement.style; r.setProperty('--sal', i[0] + 'px'); r.setProperty('--sar', i[1] + 'px'); r.setProperty('--sab', (i[2] || 0) + 'px'); if (window.CB && CB.Game && CB.Game.resize) CB.Game.resize(); }, o.ins);
  page.__ctx = ctx;
  return page;
}
// start a mission straight from the page with a given aiming help setting and scope
const start = (page, assist, scope, mission) => page.evaluate(({ assist, scope, mission }) => {
  CB.Save.data.settings.assist = assist; CB.Save.data.settings.killcam = false;
  const cfg = Object.assign(CB.defaultConfig('fenwick'), { scope });
  CB.UI.launch(mission || 'c2m7', { gun: 'fenwick', cfg, shotSeed: 1 });
  return CB.Game.state;
}, { assist, scope, mission });

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

  // ---------------------------------------------------------------- part 1: the problem, and the fix
  if (part(1)) {
    const page = await newPage(browser, { w: 844, h: 390, query: 'test' });
    const r = await page.evaluate(() => {
      const M = CB.MISSION_BY_ID.c2m7, st = CB.buildStats('fenwick', CB.defaultConfig('fenwick'));
      const sim = new CB.Sim(M, st, 0, { shotSeed: 1 });
      const V = new CB.View(document.createElement('canvas')); V.assist = 'full';
      const g = sim.byId.g1, p = sim.partPoint(g, 'torso');
      const read = () => { V.holdT = 0; V.updateReadout(sim, 0); return { d: V.rangeInfo && V.rangeInfo.d, mark: !!(V.rangeInfo && V.rangeInfo.mark), up: V.hold && V.hold.up, pd: V.pip ? V.pip.d : null, pu: V.pip ? V.pip.up : null, what: V.pip ? V.pip.what : null }; };
      window.__aimAt(sim, p.x, p.y, p.z);
      const base = { ax: sim.sh.ax, ay: sim.sh.ay }, dist = p.z - sim.eye().z, hold = sim.holdFor(dist);
      const out = { dist, holdUp: hold.up, holdRight: hold.right };
      out.on = read();
      // raise the scope by the hold (and over by the drift), as a player must to hit him
      sim.sh.ax = base.ax + hold.right; sim.sh.ay = base.ay + hold.up;
      out.raised = read();
      // keep going up a tenth of a mil at a time: where does the marker's distance jump?
      let last = out.raised, jump = null;
      for (let k = 1; k <= 60; k++) {
        sim.sh.ay = base.ay + hold.up + k * 0.1;
        const now = read();
        if (last.pd !== null && now.pd !== null && Math.abs(now.pd - last.pd) > 40) {
          // where is the marker drawn now, against the guard? (mils above the straight-line aim at him)
          const pipAy = sim.sh.ay - now.pu, J = sim.partPoint(g, 'head'), e = sim.eye();
          const headAy = (J.y + 0.12 - e.y) / (J.z - e.z) * 1000, feetAy = (g.y - e.y) / (g.plane.z - e.z) * 1000;
          jump = { at: k * 0.1, from: last, to: now, pipOnGuard: pipAy <= headAy && pipAy >= feetAy };
          break;
        }
        last = now;
      }
      out.jump = jump;
      // ---- now with a mark ----
      out.hasMark = typeof V.setMark === 'function';
      if (out.hasMark) {
        const sig = () => JSON.stringify([sim.t, sim.sh.ax, sim.sh.ay, sim.actors.map((a) => [a.x, a.state]), sim.alarmT, sim.stats]);
        sim.sh.ax = base.ax; sim.sh.ay = base.ay;
        const s0 = sig();
        const mk = V.setMark(sim);
        out.markD = mk && mk.d;
        out.same = sig() === s0;
        out.marked = [0, hold.up, hold.up + 1, hold.up + 3, hold.up + 8, -4].map((u) => { sim.sh.ax = base.ax + hold.right; sim.sh.ay = base.ay + u; return read(); });
        out.wantUp = sim.holdFor(mk.d).up;
        // a mark on another sim (a different mission) is ignored
        const other = new CB.Sim(M, st, 0, { shotSeed: 1 }); V.holdT = 0; V.updateReadout(other, 0); out.otherMarked = !!(V.rangeInfo && V.rangeInfo.mark);
        // the sky clears it, and so does clearMark
        const sky = window.__sky(sim);
        out.sky = !!sky;
        if (sky) { sim.sh.ax = sky.ax; sim.sh.ay = sky.ay; V.setMark(sim); out.skyClears = !V.mark; }
        sim.sh.ax = base.ax; sim.sh.ay = base.ay; V.setMark(sim); V.clearMark(); out.cleared = !V.mark && !read().mark;
      }
      return out;
    });
    note('guard g1 is ' + r.dist.toFixed(0) + ' m away; the hold for him is ' + r.holdUp.toFixed(2) + ' up, ' + r.holdRight.toFixed(2) + ' right');
    note('crosshair on him:        RANGE ' + r.on.d.toFixed(0) + ' m, HOLD up ' + r.on.up.toFixed(2) + ', marker for ' + (r.on.pd ? r.on.pd.toFixed(0) + ' m' : '-'));
    note('scope raised by the hold: RANGE ' + r.raised.d.toFixed(0) + ' m, HOLD up ' + r.raised.up.toFixed(2) + ', marker for ' + (r.raised.pd ? r.raised.pd.toFixed(0) + ' m (' + r.raised.what + ')' : '-'));
    ok(Math.abs(r.on.d - r.dist) < 3, 'with the crosshair on the guard, RANGE reads his distance');
    ok(r.raised.d > r.dist + 60, 'PROBLEM REPRODUCED: raise the scope by the hold and RANGE jumps to the backdrop (' + r.raised.d.toFixed(0) + ' m instead of ' + r.dist.toFixed(0) + ' m)');
    ok(r.raised.up > r.holdUp + 0.3, 'PROBLEM REPRODUCED: and HOLD then gives the hold for the backdrop (' + r.raised.up.toFixed(2) + ' up instead of ' + r.holdUp.toFixed(2) + ')');
    ok(!!r.jump, 'PROBLEM REPRODUCED: the amber marker jumps to the backdrop\'s distance once the bullet\'s path clears him' + (r.jump ? ' (' + r.jump.from.pd.toFixed(0) + ' m to ' + r.jump.to.pd.toFixed(0) + ' m, ' + (r.jump.to.pu - r.jump.from.pu).toFixed(2) + ' mils lower, after ' + r.jump.at.toFixed(1) + ' mils more)' : ''));
    if (r.jump) note('after the jump the marker is ' + (r.jump.pipOnGuard ? 'still drawn ON the guard, though the round would pass over him' : 'drawn off the guard'));
    ok(r.hasMark, 'the view can mark a distance');
    if (r.hasMark) {
      ok(Math.abs(r.markD - r.dist) < 3, 'marking with the crosshair on him locks his distance (' + r.markD.toFixed(1) + ' m)');
      ok(r.same, 'marking does not change anything in the mission');
      ok(r.marked.every((m) => m.mark && Math.abs(m.d - r.markD) < 1e-6), 'with a mark, RANGE stays at the marked distance wherever the scope points');
      ok(r.marked.every((m) => Math.abs(m.up - r.wantUp) < 1e-9), 'with a mark, HOLD stays the hold for the marked distance');
      ok(r.marked.every((m) => m.pd === r.markD && Math.abs(m.pu - r.marked[0].pu) < 1e-9), 'with a mark, the amber marker stays at the marked distance and does not move against the crosshair');
      ok(!r.otherMarked, 'a mark made in one mission is ignored by another');
      if (r.sky) ok(r.skyClears, 'marking the empty sky clears the mark'); else note('no open sky in this scene to test against');
      ok(r.cleared, 'clearing the mark gives the live read-outs back');
    }
    await page.__ctx.close();
  }

  // ---------------------------------------------------------------- part 2: the button, by touch
  const touchPass = async (P) => {
    const page = await newPage(browser, { w: P.w, h: P.h, touch: true, ins: P.ins });
    const cdp = await page.__ctx.newCDPSession(page);
    let tid = 1;
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    const tapAt = async (x, y, hold) => { const id = tid++; await touch('touchStart', [{ x, y, id }]); await page.waitForTimeout(hold || 40); await touch('touchEnd', []); await page.waitForTimeout(80); };
    const box = (sel) => page.locator(sel).first().boundingBox();
    const tapSel = async (sel, hold) => { const b = await box(sel); await tapAt(b.x + b.width / 2, b.y + b.height / 2, hold); };
    const shot = (n) => page.screenshot({ path: path.join(SHOTS, 'mark_' + P.name + '_' + n + '.png') });
    await start(page, 'full', 'hunter'); await page.waitForTimeout(900);
    // the button: visible, big enough, inside the safe area, clear of everything else
    const lay = await page.evaluate(() => {
      const W = innerWidth, H = innerHeight, cs = getComputedStyle(document.documentElement), px = (k) => parseFloat(cs.getPropertyValue(k)) || 0;
      const safe = { l: px('--sal'), r: W - px('--sar'), t: px('--sat'), b: H - px('--sab') };
      const m = document.querySelector('.h-mark'); if (!m) return null;
      const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
      const mb = R(m), shown = getComputedStyle(m).display !== 'none' && mb.w > 0;
      const others = ['.h-fire', '.h-breath', '.h-reload', '.h-ammo', '.h-strip', '.h-zoom', '.h-pause', '.h-obj', '.h-pills', '.h-msg', '.h-timer'].map((s) => [s, document.querySelector(s)]).filter((x) => x[1] && getComputedStyle(x[1]).display !== 'none');
      const hits = others.filter(([s, e]) => { const b = R(e); if (b.w < 1 || b.h < 1) return false; return !(b.r <= mb.l - 4 || b.l >= mb.r + 4 || b.b <= mb.t - 4 || b.t >= mb.b + 4); }).map((x) => x[0]);
      return { shown, mb, safe, hits, W, H };
    });
    ok(lay && lay.shown, P.name + ': MARK button shows with Full help');
    if (lay) {
      ok(lay.mb.w >= 40 && lay.mb.h >= 40, P.name + ': MARK is at least 40 px each way (' + lay.mb.w.toFixed(0) + ' x ' + lay.mb.h.toFixed(0) + ')');
      ok(lay.mb.l >= lay.safe.l - 0.5 && lay.mb.r <= lay.safe.r + 0.5 && lay.mb.t >= lay.safe.t - 0.5 && lay.mb.b <= lay.safe.b + 0.5, P.name + ': MARK is inside the safe area ' + JSON.stringify(lay.mb));
      ok(!lay.hits.length, P.name + ': MARK covers nothing else' + (lay.hits.length ? ' (touches ' + lay.hits.join(', ') + ')' : ''));
    }
    // a radio message and a hint at the same time must not reach the button either
    await page.evaluate(() => { CB.Game.pushMsg('Marlow', 'A long radio message to see how far down the messages reach on this screen, two or three lines of it.', 30); CB.Game.pushMsg('hint', 'And a long hint at the same time, which is the most the message box ever holds at once, also a few lines long.', 30); });
    await page.waitForTimeout(400);
    const msgHit = await page.evaluate(() => { const a = document.querySelector('.h-mark').getBoundingClientRect(), b = document.querySelector('.h-msg').getBoundingClientRect(); return !(b.right <= a.left || b.left >= a.right || b.bottom <= a.top || b.top >= a.bottom); });
    ok(!msgHit, P.name + ': two messages at once stay clear of MARK');
    await shot('1_start');
    await page.evaluate(() => { const h = CB.Game.hud.msg; h.innerHTML = ''; });
    // put the crosshair on the guard, steady, and tap MARK
    const aim = await page.evaluate(() => { const s = CB.Game.sim, g = s.byId.g1, p = s.partPoint(g, 'torso'); s.setZoom(9); window.__aimAt(s, p.x, p.y, p.z); s.holdBreath(true); return { d: p.z - s.eye().z, hold: s.holdFor(p.z - s.eye().z) }; });
    await page.waitForTimeout(500);
    await page.evaluate(() => { const s = CB.Game.sim, g = s.byId.g1, p = s.partPoint(g, 'torso'); window.__aimAt(s, p.x, p.y, p.z); });
    await tapSel('.h-mark');
    await page.waitForTimeout(350);
    const m1 = await page.evaluate(() => { const V = CB.Game.view, m = V.mark, c = CB.Game.hud.sRange; return { d: m && m.d, label: c.firstChild.textContent, val: c.lastChild.textContent, on: document.querySelector('.h-mark').classList.contains('on'), btn: document.querySelector('.h-mark').innerText.replace(/\s+/g, ' ') }; });
    ok(m1.d && Math.abs(m1.d - aim.d) < 4, P.name + ': tapping MARK on the guard locks his distance (' + (m1.d ? m1.d.toFixed(0) : '-') + ' m, he is ' + aim.d.toFixed(0) + ' m away)');
    ok(/MARK/i.test(m1.label) && m1.val.indexOf(String(Math.round(m1.d || -1))) >= 0, P.name + ': the read-out shows the locked distance: "' + m1.label + ' ' + m1.val + '"');
    ok(m1.on && m1.btn.indexOf(String(Math.round(m1.d || -1))) >= 0, P.name + ': the button shows that a mark is set: "' + m1.btn + '"');
    await shot('2_marked');
    // raise the scope well past the guard: the read-out and the marker stay on his distance
    await page.evaluate((h) => { const s = CB.Game.sim; s.sh.ay += h.up + 1.5; s.sh.ax += h.right; }, aim.hold);
    await page.waitForTimeout(450);
    const m2 = await page.evaluate(() => { const V = CB.Game.view, s = CB.Game.sim, a = s.aimNow(), live = s.rangeAt(a.x, a.y); return { d: V.rangeInfo.d, mark: V.rangeInfo.mark, pd: V.pip && V.pip.d, live: live && live.d, val: CB.Game.hud.sRange.lastChild.textContent, up: V.hold && V.hold.up, want: s.holdFor(V.mark.d).up }; });
    ok(m2.mark && Math.abs(m2.d - m1.d) < 1e-6 && m2.pd === m1.d && Math.abs(m2.up - m2.want) < 0.05 && m2.val.indexOf(String(Math.round(m1.d))) >= 0, P.name + ': with the scope raised (crosshair now on something ' + (m2.live ? m2.live.toFixed(0) + ' m' : 'out of range') + ' away) RANGE, HOLD and the marker keep the marked distance ' + JSON.stringify({ range: m2.d, marker: m2.pd, hold: +m2.up.toFixed(2), holdForMark: +m2.want.toFixed(2) }));
    await shot('3_raised');
    // a long press clears it
    await tapSel('.h-mark', 900);
    await page.waitForTimeout(300);
    const m3 = await page.evaluate(() => ({ mark: CB.Game.view.mark, label: CB.Game.hud.sRange.firstChild.textContent, on: document.querySelector('.h-mark').classList.contains('on') }));
    ok(!m3.mark && /RANGE/i.test(m3.label) && !m3.on, P.name + ': holding MARK down clears the mark');
    // mark again, then start over: a new start has no mark
    await page.evaluate(() => { const s = CB.Game.sim, g = s.byId.g1, p = s.partPoint(g, 'torso'); window.__aimAt(s, p.x, p.y, p.z); });
    await tapSel('.h-mark'); await page.waitForTimeout(150);
    const had = await page.evaluate(() => !!CB.Game.view.mark);
    await tapSel('.h-pause'); await page.waitForTimeout(300);
    await tapSel('.nb .sh-foot [data-a="restart"]'); await page.waitForTimeout(700);
    ok(had && await page.evaluate(() => CB.Game.state === 'mission' && !CB.Game.view.markFor(CB.Game.sim) && !document.querySelector('.h-mark').classList.contains('on') && /RANGE/i.test(CB.Game.hud.sRange.firstChild.textContent)), P.name + ': starting the mission again clears the mark');
    // tap MARK on the empty sky: clears
    if (P.sky) {
      const sky = await page.evaluate(() => { const s = CB.Game.sim, g = s.byId.g1, p = s.partPoint(g, 'torso'); window.__aimAt(s, p.x, p.y, p.z); return true; });
      await tapSel('.h-mark'); await page.waitForTimeout(150);
      const sk = await page.evaluate(() => { const s = CB.Game.sim, k = window.__sky(s); if (k) { s.sh.ax = k.ax; s.sh.ay = k.ay; } return !!k; });
      if (sk && sky) { await page.waitForTimeout(150); await page.evaluate(() => { const s = CB.Game.sim, k = window.__sky(s); s.sh.ax = k.ax; s.sh.ay = k.ay; s.sh.swx = s.sh.swy = 0; }); await tapSel('.h-mark'); await page.waitForTimeout(150); ok(await page.evaluate(() => !CB.Game.view.mark), P.name + ': tapping MARK on the empty sky clears the mark'); }
    }
    // who gets the button
    if (P.who) {
      const cases = [['full', 'hunter', true], ['notes', 'hunter', false], ['veteran', 'hunter', false], ['notes', 'lrf', true], ['veteran', 'lrf', true], ['notes', 'oracle', true], ['veteran', 'oracle', true], ['notes', 'tac', false]];
      for (const [assist, scope, want] of cases) {
        await start(page, assist, scope); await page.waitForTimeout(500);
        const st = await page.evaluate(() => { const m = document.querySelector('.h-mark'); return { shown: getComputedStyle(m).display !== 'none', can: CB.Game.markTarget ? true : null }; });
        // try to mark the guard, whether or not the button shows
        const res = await page.evaluate(() => { const s = CB.Game.sim, g = s.byId.g1, p = s.partPoint(g, 'torso'); window.__aimAt(s, p.x, p.y, p.z); s.sh.swx = s.sh.swy = 0; const r = CB.Game.markTarget ? CB.Game.markTarget() : null; return { marked: !!CB.Game.view.markFor(s), d: CB.Game.view.mark && CB.Game.view.mark.d }; });
        await page.waitForTimeout(350);
        const ro = await page.evaluate(() => { const h = CB.Game.hud; return { range: h.sRange.firstChild.textContent + ' ' + h.sRange.lastChild.textContent, hold: h.sHold.style.display === 'none' ? '(hidden)' : h.sHold.lastChild.textContent.replace(/\s+/g, ' ') }; });
        ok(st.shown === want && res.marked === want, P.name + ': ' + assist + ' + ' + scope + ' scope: MARK ' + (want ? 'available' : 'not available') + ' (read-out "' + ro.range + '", hold "' + ro.hold + '")');
        if (want && (scope === 'lrf' || scope === 'oracle') && assist !== 'full') await shot('4_' + assist + '_' + scope);
      }
    }
    await page.__ctx.close();
  };
  if (part(2)) {
    await touchPass({ name: 'w844', w: 844, h: 390, ins: [50, 50, 21], sky: true, who: true });
    await touchPass({ name: 'w667', w: 667, h: 375, ins: [50, 50, 21] });
    await touchPass({ name: 'tall', w: 390, h: 844, ins: [0, 0, 20] });
    await touchPass({ name: 'tallsmall', w: 375, h: 667, ins: [0, 0, 0] });
  }

  // ---------------------------------------------------------------- part 3: a computer, the M key
  if (part(3)) {
    const page = await newPage(browser, { w: 1280, h: 800, dpr: 1 });
    await page.evaluate(() => { CB.Game.stage.requestPointerLock = null; });
    await start(page, 'full', 'hunter'); await page.waitForTimeout(700);
    const keys = await page.evaluate(() => CB.Game.hud.keys.innerText);
    ok(/\bM\b/.test(keys) && /mark/i.test(keys), 'computer: the key line mentions M for mark: "' + keys.replace(/\s+/g, ' ') + '"');
    await page.evaluate(() => { const s = CB.Game.sim, g = s.byId.g1, p = s.partPoint(g, 'torso'); window.__aimAt(s, p.x, p.y, p.z); s.sh.swx = s.sh.swy = 0; });
    await page.keyboard.press('m'); await page.waitForTimeout(200);
    const d = await page.evaluate(() => CB.Game.view.mark && CB.Game.view.mark.d);
    ok(d > 280 && d < 340, 'computer: M marks the guard (' + (d ? d.toFixed(0) : '-') + ' m)');
    await page.screenshot({ path: path.join(SHOTS, 'mark_desk.png') });
    await page.keyboard.down('m'); await page.waitForTimeout(900); await page.keyboard.up('m'); await page.waitForTimeout(150);
    ok(await page.evaluate(() => !CB.Game.view.mark), 'computer: holding M clears the mark');
    await start(page, 'notes', 'hunter'); await page.waitForTimeout(500);
    const keys2 = await page.evaluate(() => CB.Game.hud.keys.innerText);
    await page.keyboard.press('m'); await page.waitForTimeout(150);
    ok(!/mark/i.test(keys2) && await page.evaluate(() => !CB.Game.view.mark), 'computer: with Spotter\'s notes and a plain scope there is no M key and no mark');
    await page.__ctx.close();
  }

  // ---------------------------------------------------------------- part 4: the Range
  if (part(4)) {
    const page = await newPage(browser, { w: 844, h: 390, touch: true, ins: [50, 50, 21] });
    // sim level: every distance, a loud .308 and a loud .50, the alarm is asked for and never comes
    const sl = await page.evaluate(() => {
      const out = [];
      for (const dist of [100, 300, 500, 1200]) for (const gun of ['fenwick', 'anvil']) {
        CB.UI.rangeCfg.dist = dist; CB.UI.rangeCfg.wind = 0; CB.Save.data.equipped = gun; CB.Save.data.guns[gun] = CB.Save.data.guns[gun] || { cfg: CB.defaultConfig(gun) };
        CB.UI.range(); const M0 = CB.MISSION_BY_ID.range;
        // build the mission the way the Go button does, without leaving the menu
        const goBtn = document.querySelector('[data-a="go"]');
        const keepLaunch = CB.UI.launch; let M = null; CB.UI.launch = function () { M = CB.MISSION_BY_ID.range; }; goBtn.click(); CB.UI.launch = keepLaunch;
        const st = CB.buildStats(gun, CB.defaultConfig(gun)), sim = new CB.Sim(M, st, 0, { shotSeed: 3 });
        let banners = 0;
        for (let i = 0; i < 3; i++) { sim.fire(); for (let k = 0; k < 360; k++) sim.step(1 / 120); }
        sim.raiseAlarm('guard', 0); sim.raiseAlarm('camera', 0.5); sim.raiseAlarm('shot', 0);
        for (let k = 0; k < 600; k++) sim.step(1 / 120);
        sim.ev.forEach((e) => { if (e.k === 'alarm') banners++; });
        out.push({ dist, gun, practice: !!M.practice, loud: !st.quiet && dist <= st.noise, alarmT: sim.alarmT, pending: !!sim.alarmPending, alarmEv: banners, heart: sim.sh.heart, did: sim.did('alarm'), shots: sim.stats.shots, clean: sim.summarise(false).clean });
      }
      return out;
    });
    sl.forEach((x) => ok(x.practice && x.alarmT === null && !x.pending && !x.alarmEv && !x.did && x.heart === 0 && x.clean, 'Range ' + x.dist + ' m with the ' + x.gun + (x.loud ? ' (loud enough to be heard)' : '') + ': ' + x.shots + ' shots and three alarm requests, no alarm ' + JSON.stringify({ alarmT: x.alarmT, ev: x.alarmEv, heart: +x.heart.toFixed(3) })));
    // a contract still raises it: the same loud shot in Rent Day
    const camp = await page.evaluate(() => { const st = CB.buildStats('fenwick', CB.defaultConfig('fenwick')), sim = new CB.Sim(CB.MISSION_BY_ID.c1m1, st, 0, { shotSeed: 1 }); sim.sh.ay = sim.lim.y1; sim.fire(); for (let k = 0; k < 480; k++) sim.step(1 / 120); return { alarmT: sim.alarmT, by: sim.alarmBy }; });
    ok(camp.alarmT !== null && camp.by === 'shot', 'a loud shot in a contract (Rent Day) still raises the alarm (' + camp.by + ')');
    // the real thing, by touch: the Range screen, Go, three loud shots, nothing about an alarm on screen
    await page.evaluate(() => { CB.UI.rangeCfg.dist = 300; CB.UI.rangeCfg.wind = 0; CB.Save.data.equipped = 'fenwick'; CB.UI.tab = 'range'; CB.UI.range(); });
    await page.waitForTimeout(300);
    const gb = await page.locator('[data-a="go"]').first().boundingBox();
    const cdp = await page.__ctx.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: gb.x + gb.width / 2, y: gb.y + gb.height / 2, id: 1 }] }); await page.waitForTimeout(40); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(1200);
    const inRange = await page.evaluate(() => CB.Game.state === 'mission' && !!CB.Game.sim.M.practice);
    ok(inRange, 'the Range starts from its screen');
    await page.evaluate(() => { window.__banners = []; const b = CB.Game.banner; CB.Game.banner = function (t, c) { window.__banners.push(t); return b.apply(this, arguments); }; });
    const fb = await page.locator('.h-fire').boundingBox();
    for (let i = 0; i < 3; i++) {
      await page.waitForFunction(() => CB.Game.sim.canFire(), null, { timeout: 15000 });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fb.x + fb.width / 2, y: fb.y + fb.height / 2, id: 10 + i }] }); await page.waitForTimeout(40); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(1600);
    }
    await page.waitForTimeout(1200);
    const rr = await page.evaluate(() => { const s = CB.Game.sim; return { shots: s.stats.shots, alarmT: s.alarmT, pill: CB.Game.hud.alarm.classList.contains('show'), banners: window.__banners, heart: s.sh.heart }; });
    await page.screenshot({ path: path.join(SHOTS, 'mark_range.png') });
    ok(rr.shots === 3 && rr.alarmT === null && !rr.pill && !rr.banners.some((t) => /alarm/i.test(t)) && rr.heart === 0, 'the Range, three loud shots by touch: no alarm, no banner, no pill, steady pulse ' + JSON.stringify(rr));
    await page.__ctx.close();
  }

  await browser.close();
  console.log(log.join('\n'));
  if (errs.length) { console.log('\n' + errs.join('\n')); process.exitCode = 1; } else console.log('\nALL MARK AND RANGE CHECKS PASSED');
})();
