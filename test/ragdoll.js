// Contact sheets of ragdoll falls: how bodies go down for different rounds, parts hit,
// poses and places. Each row is one death; the columns are moments after it. Under each
// scope-view picture (side on, as the scope sees it) a thin stick figure shows the same body
// from beside the line of fire (z across, as the kill camera sees it), to check the push.
//   usage: node test/ragdoll.js [sheet,...|all] [dpr]     sheets: calibre pose place other bench
// Pictures go in shots/rd_<sheet>.png.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

function pageMain(name) {
  const RG = CB.Ragdoll, fig = CB.fig;
  const GUN = { ratter: ['c22', 0, 300], hush: ['c9s', 0.9, 290], lark: ['c556', 0.3, 860], fenwick: ['c308', 0.6, 720], vantage: ['c300m', 0.9, 840], northwind: ['c338', 1.2, 830], anvil: ['c50', 3, 800], storm: ['crail', 3.2, 2400] };
  let uid = 0;
  // a scene: a plane with a floor, solids, and the bits the ragdoll looks for
  const plane = (o) => Object.assign({ z: 200, groundY: 0, solids: [], openings: [] }, o || {});
  const make = (o) => {
    const P = o.P || plane(o.plane), gun = GUN[o.gun || 'fenwick'];
    const a = Object.assign({ id: 'r' + (uid++) + (o.label || ''), x: 0, y: 0, face: 1, anim: 'stand', t: 3.7, ph: 1.1, seed: 4.2, look: { coat: '#4a515c' }, state: 'calm', goal: null, plane: P, zone: 'street', routine: [], vx: 0 }, o.a || {});
    a.dead = true; a.deathPose = a.anim; a.deathAt = a.t; a.deathPh = a.ph; a.deathHow = o.how || 'shot'; a.deathPart = o.part || 'torso'; a.deathKind = o.kind || (a.anim.match(/^(sit|type|drive|sleep|kneel)/) || a.inVeh ? 'slump' : 'back'); a.deadT = 0;
    const sim = { st: { cal: gun[0], pen: gun[1] }, S: { planes: [P], groundMat: o.mat || 'dirt' }, t: 1, eye0: { x: -20, y: 6, z: 0 } };
    const J = fig.actorJoints(Object.assign({}, a, { dead: false })); // the living pose, to aim at
    const tgt = o.part === 'head' ? J.head : [J.hip[0] + (J.neck[0] - J.hip[0]) * 0.62, J.hip[1] + (J.neck[1] - J.hip[1]) * 0.62];
    const v = gun[2], hx = a.x + tgt[0], hy = a.y + tgt[1], dir = o.dir === undefined ? 0.04 : o.dir;
    const b = o.how === 'shot' || !o.how ? { vx: v * dir, vy: -v * 0.01, vz: v, x: hx + dir * 0.5, y: hy - 0.005, z: P.z + 0.5, ox: -20, oy: 6, oz: 0 } : null;
    a.dead = false; a.goal = o.moving ? a.x + 10 * a.face : null;
    RG.note(sim, a, o.part || 'torso', o.how || 'shot', b, o.src || null);
    a.dead = true; a.goal = null;
    return a;
  };
  const rows = [];
  const add = (label, o) => rows.push({ label, o });
  const N = { torso: 'torso', head: 'head' };
  if (name === 'calibre') {
    ['ratter', 'fenwick', 'anvil'].forEach((g) => { add(g + ' torso', { gun: g }); add(g + ' head', { gun: g, part: 'head' }); });
    add('lark torso', { gun: 'lark' }); add('storm torso', { gun: 'storm' });
  } else if (name === 'pose') {
    add('walking, fenwick torso', { a: { anim: 'walk', vx: 1.3, ph: 0.7 }, moving: true });
    add('running, fenwick head', { a: { anim: 'run', vx: 4.3, running: true, ph: 2.1 }, part: 'head', moving: true });
    add('walking left, anvil torso', { gun: 'anvil', a: { anim: 'walk', vx: -1.3, face: -1, ph: 2.4 }, moving: true });
    add('phone, ratter head', { gun: 'ratter', part: 'head', a: { anim: 'phone' } });
    add('kneeling, fenwick torso', { a: { anim: 'kneel' } });
    add('guard with rifle, front', { a: { anim: 'guard', look: { gun: 'rifle', coat: '#2a2d33' } }, kind: 'front' });
    add('hands up, anvil head', { gun: 'anvil', part: 'head', a: { anim: 'hands' } });
    add('leaning on a rail', { a: { anim: 'lean' } });
  } else if (name === 'place') {
    add('seated at a desk (type)', { a: { anim: 'type' } });
    add('seated, head, anvil', { gun: 'anvil', part: 'head', a: { anim: 'sit' } });
    add('in a car, driving', { a: { anim: 'drive', inVeh: { x: 0, y: 0, dir: 1, v: 9, def: null } } });
    add('behind a window (room)', { a: { behind: true, room: 'r1' }, plane: { groundY: undefined } });
    add('roof edge 0.4 m to the right', { plane: { groundY: -20, solids: [{ x: -10, y: -20, w: 10.4, h: 20, mat: 'wall' }] } });
    add('roof edge, walking toward it', { plane: { groundY: -20, solids: [{ x: -10, y: -20, w: 10.6, h: 20, mat: 'wall' }] }, a: { anim: 'walk', vx: 1.3 }, moving: true });
    add('wall 0.5 m behind them (left)', { kind: 'back', plane: { solids: [{ x: -1.5, y: 0, w: 1.0, h: 3, mat: 'wall' }] } });
    add('on a slope', { a: { yFn: (x) => x * 0.3 } , kind: 'front' });
  } else if (name === 'other') {
    add('blast 2 m to the left', { how: 'blast', src: { x: -2, y: 0.5, r: 4.5 } });
    add('crushed by a falling crate', { how: 'accident', src: { x: 0.3, y: 0, w: 1.4, h: 1.2, floor: 0 } });
    add('shot by a guard (npc)', { how: 'npc' });
    add('fenwick torso, gore off', { gore: false });
  }
  if (name === 'bench') {
    // How long one moving body costs per frame (a sixtieth of a second of falling), in microseconds.
    // The machine may be busy with other work, so each figure is the best of several short runs.
    const out = {};
    ['fenwick', 'anvil'].forEach((g) => {
      let best = 1e9, bestS = 1e9;
      for (let rep = 0; rep < 12; rep++) {
        const as = []; for (let i = 0; i < 30; i++) as.push(make({ gun: g, part: i % 2 ? 'head' : 'torso', a: { anim: i % 3 ? 'stand' : 'walk', vx: i % 3 ? 0 : 1.3 } }));
        const t0 = performance.now();
        for (let f = 1; f <= 30; f++) as.forEach((a) => { a.deadT = f / 60; fig.actorJoints(a); });
        best = Math.min(best, (performance.now() - t0) / 30 / as.length);
        as.forEach((a) => { a.deadT = 6; fig.actorJoints(a); });
        const t1 = performance.now(); for (let k = 0; k < 100; k++) as.forEach((a) => { a.deadT = 6 + k / 60; fig.actorJoints(a); });
        bestS = Math.min(bestS, (performance.now() - t1) / 100 / as.length);
      }
      out[g] = +(best * 1000).toFixed(1) + ' us per moving body per frame';
      out[g + ' asleep'] = +(bestS * 1000).toFixed(2) + ' us';
    });
    return { bench: out };
  }
  const T = [0, 0.08, 0.16, 0.25, 0.35, 0.5, 0.7, 1.0, 1.5, 4];
  const cw = 98, ch = 132, lab = 14, W = cw * T.length + 8, H = rows.length * (ch + lab) + 8, dpr = window.devicePixelRatio || 1;
  document.body.innerHTML = ''; document.body.style.cssText = 'margin:0;background:#20242b;';
  const cv = document.createElement('canvas'); cv.width = W * dpr; cv.height = H * dpr; cv.style.cssText = 'width:' + W + 'px;height:' + H + 'px;display:block'; document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  const pal = { ink: '#13161b', rim: 'rgba(255,255,255,0.55)', dark: 0 };
  let err = '';
  rows.forEach((row, ri) => {
    const a = make(row.o), y0 = 4 + ri * (ch + lab), E = a.rd && a.rd.env;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#c8d0da'; ctx.font = '11px sans-serif'; ctx.fillText(row.label + (a.rd ? '   power ' + a.rd.power.toFixed(2) + (a.rd.exit ? ', exits ' + a.rd.exitK.toFixed(2) : ', stays in') : ''), 6, y0 + 11);
    T.forEach((t, ci) => {
      const x0 = 4 + ci * cw, cy = y0 + lab, s = 30; // pixels per metre
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#b7b1a4'; ctx.fillRect(x0, cy, cw - 3, ch); ctx.fillStyle = '#20242b'; ctx.fillText(t + ' s', x0 + 3, cy + 11);
      const ox = x0 + cw / 2, oy = cy + ch * 0.62;
      // the place: floor (with its ends), walls, seat, desk, car
      ctx.save(); ctx.beginPath(); ctx.rect(x0, cy, cw - 3, ch); ctx.clip();
      ctx.setTransform(dpr * s, 0, 0, -dpr * s, dpr * ox, dpr * oy);
      ctx.fillStyle = '#8f8a80';
      const gx0 = E ? Math.max(-3, E.x0) : -3, gx1 = E ? Math.min(3, E.x1) : 3;
      ctx.beginPath(); ctx.moveTo(gx0, -3); for (let x = gx0; x <= gx1 + 1e-6; x += 0.1) ctx.lineTo(x, E && E.gfn ? E.gfn(x) : 0); ctx.lineTo(gx1, -3); ctx.closePath(); ctx.fill();
      if (E) {
        ctx.fillStyle = '#6d6a64'; E.boxes.forEach((B) => ctx.fillRect(B[0], B[1], B[2] - B[0], B[3] - B[1]));
        const f = E.f || 1;
        if (E.seat) { ctx.fillStyle = '#5a4a3a'; ctx.fillRect(Math.min(E.seat.x0 * f, E.seat.x1 * f), 0.33, Math.abs(E.seat.x1 - E.seat.x0), E.seat.top - 0.33); ctx.fillRect(E.back * f - 0.03 * f, 0.4, 0.04 * f, 0.6); }
        if (E.desk) { ctx.fillStyle = '#7a5a3a'; ctx.fillRect(Math.min(E.desk.x0 * f, E.desk.x1 * f), E.desk.top - 0.05, Math.abs(E.desk.x1 - E.desk.x0), 0.05); }
        if (E.rail) { ctx.fillStyle = '#3a3e45'; ctx.fillRect(E.rail.x * f - 0.02, 0, 0.04, E.rail.top); }
        if (E.car) { ctx.strokeStyle = '#30343c'; ctx.lineWidth = 0.03; ctx.strokeRect(E.car.lo * f, E.car.floor, (E.car.hi - E.car.lo) * f, E.car.roof - E.car.floor); }
      }
      a.deadT = t;
      const env = { px: 1 / s, ink: pal.ink, rim: pal.rim, light: 1, night: false, t: 0, pal, gore: row.o.gore !== false, weather: 'clear' };
      try { fig.drawFigure(ctx, a, env); } catch (e) { err += row.label + ': ' + e.message + '\n' + (e.stack || '').split('\n').slice(1, 4).join('\n') + '\n'; }
      ctx.restore();
      // beside the line of fire: z across (away from the shooter to the right), y up
      const J = fig.actorJoints(a), j = J.j3;
      if (j) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const bx = x0 + cw - 22, by = cy + ch - 6, k = 12, P = (i) => [bx + j[i * 3 + 2] * k, by - j[i * 3 + 1] * k];
        ctx.strokeStyle = 'rgba(20,30,60,0.8)'; ctx.lineWidth = 1; ctx.beginPath();
        [[0, 1], [2, 3], [0, 15], [1, 15], [2, 15], [3, 15], [0, 6], [6, 7], [1, 8], [8, 9], [2, 10], [10, 11], [3, 12], [12, 13], [0, 5], [1, 5]].forEach(([u, w]) => { const p = P(u), q = P(w); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); });
        ctx.stroke(); ctx.fillStyle = 'rgba(20,30,60,0.8)'; const hh = P(5); ctx.beginPath(); ctx.arc(hh[0], hh[1], 2, 0, 6.3); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.moveTo(bx - 18, by); ctx.lineTo(bx + 18, by); ctx.moveTo(bx, by); ctx.lineTo(bx, by - 24); ctx.stroke();
      }
    });
  });
  return { w: W, h: H, err };
}

(async () => {
  const arg = process.argv[2] || 'all', dpr = +(process.argv[3] || 2);
  const sheets = arg === 'all' ? ['calibre', 'pose', 'place', 'other', 'bench'] : arg.split(',');
  const browser = await chromium.launch();
  const shots = path.join(__dirname, '..', 'shots'); fs.mkdirSync(shots, { recursive: true });
  for (const sh of sheets) {
    const page = await browser.newPage({ deviceScaleFactor: dpr, viewport: { width: 1000, height: 800 } });
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'index.html') + '?test');
    await page.waitForTimeout(400);
    const r = await page.evaluate(pageMain, sh);
    if (r.bench) { console.log(sh, JSON.stringify(r.bench)); await page.close(); continue; }
    await page.setViewportSize({ width: r.w, height: Math.min(4000, r.h) });
    const f = path.join(shots, 'rd_' + sh + '.png');
    await page.screenshot({ path: f, clip: { x: 0, y: 0, width: r.w, height: r.h } });
    console.log(f, r.err || '', errs.join('\n'));
    await page.close();
  }
  await browser.close();
})();
