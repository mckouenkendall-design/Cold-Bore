// Finds people who jump from one place to another between two frames while the player can see them.
// Every mission is played twice, headless and fast: once left alone (nobody fires, and nothing is
// allowed to end it early, so every routine plays out), and once by the test bot. After every step
// each person who is on screen in both frames is checked: their x may move no further than they
// could run in one frame, their y no further than a stair or a slope allows, and they may not
// change plane.
// usage: node test/jumps.js [missionId,missionId] [seconds]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const only = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : null;
  const maxT = +(process.argv[3] || 240);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html') + '?test');
  await page.waitForTimeout(400);
  const out = await page.evaluate(({ only, maxT }) => {
    const found = [], dt = 1 / 60;
    // Can the player see this person right now? People inside a room only show through its windows.
    const seen = (a) => {
      if (a.dead || a.gone || a.hidden || !a.plane) return false;
      if (a.inVeh) return 'car';
      if (!a.behind) return 'open';
      const ops = a.plane.openings;
      for (let i = 0; i < ops.length; i++) { const op = ops[i]; if (op.room === a.room && a.x > op.x - 0.3 && a.x < op.x + op.w + 0.3) return 'room'; }
      return false;
    };
    const watch = (sim, M, tag) => {
      const prev = new Map();
      return () => {
        for (let i = 0; i < sim.actors.length; i++) {
          const a = sim.actors[i], v = seen(a), p = prev.get(a);
          // somebody in a vehicle is drawn in their seat (a.x and a.y only catch up a step later)
          const sv = a.inVeh, sc = sv && sv.def, sx = sc ? sv.x + sv.dir * sc.seats[a.seat] * sc.len : a.x, sy = sc ? sv.y + (sc.body + sc.h) / 2 - 1.2 : a.y;
          const now = { x: sx, y: sy, z: sv ? sv.plane.z : a.plane ? a.plane.z : 0, v, pc: a.pc, anim: a.anim };
          if (p && p.v && v && !(p.v === 'car' && v === 'car')) {
            const sp = Math.max(1, a.speed || 1), lim = 4.3 * sp * dt * 1.4 + 0.012;
            let dx = Math.abs(now.x - p.x), dy = Math.abs(now.y - p.y);
            if (Math.abs(now.z - p.z) > 0.01) {
              // A step from one plane to another (pavement to road, room to balcony) is only a jump if it
              // moves the person on the screen: measure it as seen from the shooter, in metres at the new plane.
              const e = sim.eye0, d0 = p.z - e.z, d1 = now.z - e.z;
              dx = Math.abs((now.x - e.x) / d1 - (p.x - e.x) / d0) * d1; dy = Math.abs((now.y - e.y) / d1 - (p.y - e.y) / d0) * d1;
              if (Math.abs(d1 / d0 - 1) > 0.06) dy = Math.max(dy, 0.13); // and it may not change their size by more than a few percent
            }
            if (dx > lim || dy > 0.12) {
              const key = M.id + tag + a.id;
              const rec = { m: M.id, tag, id: a.id, t: +sim.t.toFixed(2), on: [+dx.toFixed(2), +dy.toFixed(2)], from: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(1)], to: [+now.x.toFixed(2), +now.y.toFixed(2), +now.z.toFixed(1)], seen: p.v + '>' + v, pc: p.pc + '>' + now.pc, anim: p.anim + '>' + now.anim };
              if (!found.some((f) => f.key === key && Math.abs(f.t - rec.t) < 0.05)) { rec.key = key; found.push(rec); }
            }
          }
          prev.set(a, now);
        }
      };
    };
    const step0 = CB.Sim.prototype.step;
    CB.MISSIONS.forEach((M) => {
      if (only && only.indexOf(M.id) < 0) return;
      const variants = M.testFlags || [{}];
      const gun = (CB.GUNS.find((g) => !CB.gunAllowed(M, CB.buildStats(g.id, CB.Test.cfgFor(M, g.id)))) || CB.GUNS[0]).id;
      variants.forEach((flags, fi) => {
        const vt = variants.length > 1 ? '#' + fi : '';
        // 1. left alone: no shots, and no fail may stop it, so everybody's whole routine plays out
        {
          const sim = new CB.Sim(M, CB.buildStats(gun, CB.Test.cfgFor(M, gun)), 0, { flags, shotSeed: 1 });
          sim.fail = function () {};
          const check = watch(sim, M, vt + ' idle ');
          for (let n = 0; n < maxT * 60 && sim.state === 'play'; n++) { step0.call(sim, dt); sim.ev.length = 0; check(); }
        }
        // 2. the test bot's solution
        {
          let check = null, cur = null;
          CB.Sim.prototype.step = function (d) { step0.call(this, d); if (cur !== this) { cur = this; check = watch(this, M, vt + ' bot '); } check(); };
          try { CB.Test.run(M.id, gun, { vantage: 0, flags }); } finally { CB.Sim.prototype.step = step0; }
        }
      });
    });
    found.forEach((f) => { delete f.key; });
    return found;
  }, { only, maxT });
  if (errs.length) console.log(errs.join('\n'));
  if (!out.length) console.log('no jumps found');
  else {
    // the same jump in a loop, in the bot's run and in every variant is listed once, with a count
    const groups = new Map();
    out.forEach((f) => {
      const k = f.m + ' ' + f.id + ' ' + JSON.stringify(f.from) + JSON.stringify(f.to) + f.seen;
      const g = groups.get(k); if (g) { g.n++; if (g.tags.indexOf(f.tag.trim()) < 0) g.tags.push(f.tag.trim()); } else groups.set(k, Object.assign({ n: 1, tags: [f.tag.trim()] }, f));
    });
    console.log(groups.size + ' different jump(s), ' + out.length + ' in all:');
    for (const f of groups.values()) {
            console.log('  ' + f.m.padEnd(5) + ' ' + f.id.padEnd(8) + ' t=' + String(f.t).padEnd(7) + ' ' + JSON.stringify(f.from) + ' -> ' + JSON.stringify(f.to) + '  ' + Math.hypot(f.on[0], f.on[1]).toFixed(2) + ' m on screen' + (f.from[2] !== f.to[2] ? ', plane ' + f.from[2] + '>' + f.to[2] : '') + '  seen ' + f.seen + '  step ' + f.pc + '  ' + f.anim + '  x' + f.n + ' (' + f.tags.join(', ') + ')');
    }
  }
  process.exitCode = out.length ? 1 : 0;
  await browser.close();
})();
