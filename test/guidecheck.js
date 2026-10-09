// Checks the walkthrough text (`guide:` on every mission) and measures what it
// should say. Runs inside the real page in a headless browser.
//
//   node test/guidecheck.js
//       Lints every guide (3 to 7 steps, one or two sentences each, no em or en
//       dashes) and plays every mission once with the guide's rifle from the
//       first position, which must earn three stars.
//
//   node test/guidecheck.js measure c2m1,c2m3 [vantage] [gunId] [flagsJSON] [trace ids]
//       Plays the listed missions with the bot and prints a timeline: radio
//       lines, events, noise cover, and for every shot the exact hold a player
//       needs (drop, wind and lead, in mils), the HOLD box reading, the wind and
//       what the target was doing. "trace" ids (comma separated) are sampled
//       every second.
//
// The guide's rifle is the Fenwick 77 when the mission allows it, otherwise the
// first rifle in the armoury the mission allows, fitted the way the test bot
// fits it (Test.cfgFor).
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const mode = process.argv[2] === 'measure' ? 'measure' : 'lint';
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html') + '?test');
  await page.waitForTimeout(400);
  const pickGun = `(M) => { const ok = (id) => !CB.gunAllowed(M, CB.buildStats(id, CB.Test.cfgFor(M, id)));
      if (M.ch <= 2 && ok('fenwick')) return 'fenwick'; const g = CB.GUNS.find((g) => ok(g.id)); return g ? g.id : null; }`;
  if (mode === 'lint') {
    const out = await page.evaluate((pickSrc) => {
      const pick = eval(pickSrc), bad = [], rows = [];
      CB.MISSIONS.forEach((M) => {
        const g = M.guide, why = [];
        const flags = (M.testFlags || [{}])[0], text = typeof g === 'function' ? g(flags) : g;
        if (!Array.isArray(text)) why.push('no guide');
        else {
          if (text.length < 3 || text.length > 7) why.push(text.length + ' steps');
          text.forEach((s, i) => {
            if (typeof s !== 'string' || !s.trim()) { why.push('step ' + (i + 1) + ' empty'); return; }
            if (/[—–]/.test(s)) why.push('step ' + (i + 1) + ' has a dash character');
            const n = (s.match(/[.!?](\s|$)/g) || []).length;
            if (n > 2) why.push('step ' + (i + 1) + ' has ' + n + ' sentences');
            if (!/[.!?]$/.test(s.trim())) why.push('step ' + (i + 1) + ' does not end a sentence');
          });
        }
        const gun = pick(M), r = gun ? CB.Test.run(M.id, gun, { vantage: 0, flags, seed: 1 }) : null;
        if (!r || !r.ok || r.stars < 3) why.push('bot with ' + gun + ': ' + (r ? r.stars + ' stars ' + (r.fail || '') + ' ' + r.log.join('; ') : 'no rifle'));
        rows.push(M.id.padEnd(6) + ' ' + String(gun).padEnd(9) + ' ' + (Array.isArray(text) ? text.length : 0) + ' steps' + (why.length ? '   ' + why.join(', ') : ''));
        if (why.length) bad.push(M.id);
      });
      return { bad, rows };
    }, pickGun);
    out.rows.forEach((r) => console.log(r));
    console.log(out.bad.length ? 'GUIDE PROBLEMS: ' + out.bad.join(', ') : 'all ' + out.rows.length + ' guides ok');
    if (errs.length) console.log(errs.join('\n'));
    await browser.close();
    process.exit(out.bad.length || errs.length ? 1 : 0);
  }
  if (process.argv[3] === 'scan') {
    // node test/guidecheck.js measure scan c2m1 "[['wait', T], ['shoot', 't', 'torso']]" 0 80 1 [vantage] [gun]
    // plays the script for every T and prints the stars, to find the safe windows
    const [id, src, a, b, st, v, g] = process.argv.slice(4);
    const out = await page.evaluate(({ id, src, a, b, st, v, g, pickSrc }) => {
      const pick = eval(pickSrc), M = CB.MISSION_BY_ID[id], gun = g || pick(M), rows = [];
      for (let T = a; T <= b + 1e-9; T += st) {
        const script = eval('(T) => ' + src)(T);
        const r = CB.Test.run(id, gun, { vantage: v, flags: (M.testFlags || [{}])[0], seed: 1, script });
        rows.push('T=' + T.toFixed(1).padStart(5) + '  ' + (r.ok ? 'WIN ' : 'LOSS') + ' stars ' + r.stars + (r.clean ? '' : ' not-clean') + (r.precise ? '' : ' not-precise') + (r.fail ? '  ' + r.fail : '') + (r.alarmBy ? '  alarm:' + r.alarmBy : '') + (r.log.length ? '  | ' + r.log.join('; ') : ''));
      }
      return gun + '\n' + rows.join('\n');
    }, { id, src, a: +a, b: +b, st: +st, v: +(v || 0), g: g && g !== '-' ? g : null, pickSrc: pickGun });
    console.log(out);
    await browser.close();
    return;
  }
  const ids = (process.argv[3] || 'c2m1').split(',');
  const vant = +(process.argv[4] || 0), gunArg = process.argv[5] && process.argv[5] !== '-' ? process.argv[5] : null;
  const flags = process.argv[6] && process.argv[6] !== '-' ? JSON.parse(process.argv[6]) : null;
  const trace = process.argv[7] ? process.argv[7].split(',') : [];
  for (const id of ids) {
    const out = await page.evaluate(({ id, vant, gunArg, flags, trace, pickSrc }) => {
      const pick = eval(pickSrc), M = CB.MISSION_BY_ID[id], P = CB.Sim.prototype, L = [];
      const gun = gunArg || pick(M), fl = flags || (M.testFlags || [{}])[0];
      const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1), f2 = (v) => (Math.round(v * 100) / 100).toFixed(2);
      const saved = { aimFor: P.aimFor, _shoot: P._shoot, step: P.step, emit: P.emit, cover: P.cover, msg: P.msg, raiseAlarm: P.raiseAlarm };
      let sim = null, nextTrace = 0;
      P.aimFor = function (px, py, pz, lead) { this._req = { px, py, pz, lead }; return saved.aimFor.call(this, px, py, pz, lead); };
      P.step = function (dt) {
        sim = this;
        if (trace.length && this.t >= nextTrace) {
          nextTrace = Math.floor(this.t) + 1;
          trace.forEach((tid) => { const a = this.byId[tid]; if (!a) return; L.push(f1(this.t).padStart(6) + '  trace ' + tid + ' x=' + f1(a.x) + ' ' + (a.inVeh ? 'inVeh v=' + f1(a.inVeh.v) : a.anim) + ' face=' + a.face + ' ' + a.state + (a.goal !== null && a.goal !== undefined ? ' ->' + f1(a.goal) : '') + (a.hidden ? ' hidden' : '') + (a.dead ? ' DEAD' : '') + (a.room ? ' room=' + a.room : '') + ' zone=' + a.zone + (a.y ? ' y=' + f1(a.y) : '')); });
        }
        return saved.step.call(this, dt);
      };
      P.emit = function (name) { if (!/^(dead|gone):pb/.test(name)) L.push(f1(this.t).padStart(6) + '  emit  ' + name); return saved.emit.call(this, name); };
      P.cover = function (sec, name) { L.push(f1(this.t).padStart(6) + '  cover ' + (name || 'noise') + ' for ' + f1(sec) + ' s'); return saved.cover.call(this, sec, name); };
      P.msg = function (who, text, dur) { L.push(f1(this.t).padStart(6) + '  msg   ' + who + ': ' + text); return saved.msg.call(this, who, text, dur); };
      P.raiseAlarm = function (by, delay) { L.push(f1(this.t).padStart(6) + '  ALARM requested by ' + by); return saved.raiseAlarm.call(this, by, delay); };
      P._shoot = function () {
        const s = this, q = s._req, eye = s.eye(), aim = s.aimNow();
        if (q) {
          const d = q.pz - eye.z, tx = ((q.px - eye.x) / d) * 1000, ty = ((q.py - eye.y) / d) * 1000;
          const box = s.holdFor(d), w = s.wind();
          let who = '?';
          s.actors.forEach((a) => { if (a.dead || a.gone || a.plane.z !== q.pz) return; ['head', 'torso'].forEach((pt) => { const p = s.partPoint(a, pt); if (Math.hypot(p.x - q.px, p.y - q.py) < 0.05) who = a.id + ' ' + pt + ' (' + a.role + ', ' + (a.inVeh ? 'in ' + a.inVeh.id + ' v=' + f1(a.inVeh.v * a.inVeh.dir) : a.anim + ' face ' + a.face + (a.goal !== null ? ' walking vx=' + f2(a.vx) : '')) + ', x=' + f1(a.x) + ')'; }); });
          if (who === '?') s.S.objects.forEach((o) => { if (o.plane.z === q.pz && Math.hypot(o.x - q.px, o.y - q.py) < 0.05) who = 'object ' + o.id + ' (' + o.kind + ', x=' + f1(o.x) + ', y=' + f1(o.y) + ')'; });
          if (who === '?') who = 'point x=' + f1(q.px) + ' y=' + f1(q.py);
          const leadM = q.lead ? q.lead.vx * (box.tof + (q.lead.extra || 0)) : 0;
          L.push(f1(s.t).padStart(6) + '  SHOT  #' + (s.stats.shots + 1) + ' at ' + who + ' range ' + Math.round(d) + ' m' + (s.covered() ? ' [covered: ' + s.coverName + ', ' + f1(s.coverUntil - s.t) + ' s left]' : ''));
          L.push('          true hold: ' + (aim.y - ty >= 0 ? 'UP ' : 'DOWN ') + f2(Math.abs(aim.y - ty)) + '  ' + (aim.x - tx >= 0 ? 'RIGHT ' : 'LEFT ') + f2(Math.abs(aim.x - tx)) + ' mils' +
            '   | HOLD box: up ' + f2(box.up) + ' right ' + f2(box.right) + '   | wind ' + f1(w) + ' m/s ' + (w >= 0 ? 'L->R' : 'R->L') + '   | tof ' + f2(box.tof) + ' s' +
            (q.lead ? '   | lead ' + f2(leadM) + ' m (' + f2((leadM / d) * 1000) + ' mil)' : '') + '   | 1 mil = ' + Math.round(d) / 10 + ' cm here');
        }
        return saved._shoot.call(this);
      };
      let r;
      try { r = CB.Test.run(id, gun, { vantage: vant, flags: fl, seed: 1 }); } finally { Object.assign(P, saved); }
      const k = sim ? sim.kills.map((x) => x.id + ':' + x.part + ':' + x.how + '@' + f1(x.t)).join(' ') : '';
      return { head: id + ' ' + M.title + '  gun ' + gun + '  vantage ' + vant + '  flags ' + JSON.stringify(fl) + '  par ' + (typeof M.par === 'function' ? M.par(fl) : M.par) + '  wind ' + JSON.stringify(M.wind) + (M.needs ? '  needs ' + JSON.stringify(M.needs) : ''),
        res: 'result: ' + (r.skipped ? 'SKIPPED ' + r.why : (r.ok ? 'WIN' : 'LOSS') + ' stars ' + r.stars + ' clean ' + r.clean + ' precise ' + r.precise + ' shots ' + r.shots + ' t=' + r.t + (r.fail ? ' fail ' + r.fail : '') + (r.log.length ? ' log: ' + r.log.join('; ') : '') + (r.alarmBy ? ' alarmBy ' + r.alarmBy : '')) + '\nkills: ' + k,
        lines: L };
    }, { id, vant, gunArg, flags, trace, pickSrc: pickGun });
    console.log('=== ' + out.head);
    out.lines.forEach((l) => console.log(l));
    console.log(out.res + '\n');
  }
  if (errs.length) console.log(errs.join('\n'));
  await browser.close();
})();
