// ---------------------------------------------------------------------------
// Calder Yard: a freight yard at dusk.
//
// Seen from high up and far away, the yard is a stack of parallel tracks at
// different distances. A train on a track NEARER than the people you are
// watching hides them (and stops bullets). A train on a track BEHIND them
// hides nothing. Either one is loud enough to cover a shot while it rumbles
// through the middle of the yard.
//
// A note on speed, for anyone adding to this file. What costs time is the
// NUMBER of fills and strokes, far more than how much each one covers. So
// shapes of one colour are gathered into one path and filled once, anything
// whose band of the picture is off screen (above or below as well as to the
// sides) returns at once, and fine detail waits until the scope is zoomed in,
// when there is less of the yard in view.
// ---------------------------------------------------------------------------

// ---- helpers shared by the three chapter 5 locations (yard, estate, bridge) ----

// A repeatable number from 0 to 1 for a pair of whole numbers. It scatters small
// decoration (stones, weeds, rivets) without touching the scene's own random streams.
function ydHash(i, j) {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Gradients are made once and reused. A gradient is placed by the transform in force
// when it is used, so one "unit" gradient serves every lamp: move, scale and fill.
const ydGradCache = new WeakMap();
function ydGrad(ctx, key, make) {
  let m = ydGradCache.get(ctx);
  if (!m) { m = new Map(); ydGradCache.set(ctx, m); }
  let g = m.get(key);
  if (!g) { g = make(ctx); m.set(key, g); }
  return g;
}
function ydStops(g, rgb, list) { for (let i = 0; i < list.length; i++) g.addColorStop(list[i][0], 'rgba(' + rgb + ',' + list[i][1].toFixed(3) + ')'); }
// YD_FALL is the falloff S.lightAt uses: full light out to 0.3 of a lamp's reach, about
// 0.2 at the reach (where isLit flips) and nothing at 1.3. YD_SOFT is a plain soft glow.
const YD_FALL = [[0, 1], [0.231, 1], [0.385, 0.896], [0.538, 0.648], [0.615, 0.5], [0.692, 0.352], [0.846, 0.104], [1, 0]];
const YD_SOFT = [[0, 1], [0.1, 0.66], [0.26, 0.34], [0.5, 0.13], [0.76, 0.035], [1, 0]];
function ydRadial(ctx, rgb, fall) { return ydGrad(ctx, (fall ? 'f' : 's') + rgb, (c) => { const q = c.createRadialGradient(0, 0, 0, 0, 0, 1); ydStops(q, rgb, fall ? YD_FALL : YD_SOFT); return q; }); }
// Fill the unit square (or its lower half) of a gradient that has been moved to x, y and
// stretched to rx by ry, adding its light to the picture. The transform is undone afterwards.
function ydUnit(ctx, g, x, y, rx, ry, a, half) {
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.fillStyle = g;
  ctx.transform(rx, 0, 0, ry, x, y); ctx.fillRect(-1, -1, 2, half ? 1 : 2); ctx.transform(1 / rx, 0, 0, 1 / ry, -x / rx, -y / ry);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
// A soft round (or oval) glow added to the picture. rgb is 'r,g,b'.
function ydGlow(ctx, x, y, rx, ry, rgb, a, fall) { if (a > 0.004) ydUnit(ctx, ydRadial(ctx, rgb, fall), x, y, rx, ry, a, false); }
// The pool a lamp throws on the ground: the lower half of a wide, flat oval, because
// the ground is seen at a low angle. Along the ground line it fades exactly as
// S.lightAt does. R is 1.3 times the lamp's reach.
function ydPool(ctx, x, y, R, depth, rgb, a) { if (a > 0.004) ydUnit(ctx, ydRadial(ctx, rgb, true), x, y, R, depth, a, true); }
// The beam under a lamp, seen in dusty air: bright at the head, fading toward the
// ground, with a soft edge made of two nested shapes.
function ydCone(ctx, x, yTop, yBot, w0, w1, rgb, a) {
  if (a <= 0.004) return;
  const g = ydGrad(ctx, 'c' + rgb, (c) => { const q = c.createLinearGradient(0, 0, 0, -1); ydStops(q, rgb, [[0, 1], [0.3, 0.5], [0.7, 0.2], [1, 0.06]]); return q; }), hy = yTop - yBot;
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.transform(1, 0, 0, hy, x, yTop);
  ctx.globalAlpha = a * 0.5; ctx.beginPath(); ctx.moveTo(-w0, 0); ctx.lineTo(w0, 0); ctx.lineTo(w1, -1); ctx.lineTo(-w1, -1); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = a * 0.6; ctx.beginPath(); ctx.moveTo(-w0, 0); ctx.lineTo(w0, 0); ctx.lineTo(w1 * 0.58, -1); ctx.lineTo(-w1 * 0.58, -1); ctx.closePath(); ctx.fill();
  ctx.transform(1, 0, 0, 1 / hy, -x, -yTop / hy); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
// Adds small flat stones to the current path, a few per cell, the same every frame.
function ydSpeck(ctx, env, xa, xb, yLo, yHi, cell, seed, n, size) {
  const i0 = Math.floor(Math.max(xa, env.x0) / cell), i1 = Math.floor(Math.min(xb, env.x1) / cell), sz = Math.max(size, env.px * 1.1);
  for (let i = i0; i <= i1; i++) for (let j = 0; j < n; j++) {
    const u = ydHash(i, seed + j * 7), v = ydHash(i + 911, seed + j * 13), x = (i + u) * cell;
    if (x < xa || x > xb) continue;
    ctx.rect(x, lerp(yLo, yHi, v), sz * (0.7 + u * 0.9), sz * 0.6);
  }
}
// Adds one tuft of grass (three blades) to the current path.
function ydTuft(ctx, x, y, h, lean) {
  ctx.moveTo(x - h * 0.3, y); ctx.lineTo(x - h * 0.46 + lean * 0.7, y + h * 0.7); ctx.lineTo(x - h * 0.1, y);
  ctx.lineTo(x + lean, y + h); ctx.lineTo(x + h * 0.12, y);
  ctx.lineTo(x + h * 0.5 + lean * 0.7, y + h * 0.62); ctx.lineTo(x + h * 0.3, y); ctx.closePath();
}
// Smoke or steam: a few soft discs that rise, swell, lean with the wind and fade in and out.
function ydSmoke(ctx, env, x, y, col, n, rise, r0, r1, speed, a, lean, ph) {
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const u = (env.t * speed + i / n + (ph || 0)) % 1;
    ctx.globalAlpha = a * (1 - u) * Math.min(1, u * 5);
    ctx.beginPath(); ctx.arc(x + lean * u * u + Math.sin(u * 6 + i * 2.1) * r1 * 0.22, y + u * rise, r0 + (r1 - r0) * u, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// Thin lines, many at once: pass a flat list [x1, y1, x2, y2, ...].
function ydLines(ctx, env, pts, col, w) {
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(w, env.px * 0.8); ctx.beginPath();
  for (let i = 0; i < pts.length; i += 4) { ctx.moveTo(pts[i], pts[i + 1]); ctx.lineTo(pts[i + 2], pts[i + 3]); }
  ctx.stroke();
}
// Adds a closed shape to the current path: pass a flat list [x, y, x, y, ...].
function ydShape(ctx, p) { ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); ctx.closePath(); }
// Adds a ladder (two rails and, when it is big enough to see, the rungs) to a list of lines.
function ydLadder(pts, env, x, y0, y1, w) {
  pts.push(x, y0, x, y1, x + w, y0, x + w, y1);
  if (env.s > 7) for (let yy = y0 + 0.25; yy < y1 - 0.05; yy += 0.36) pts.push(x, yy, x + w, yy);
}
// Streaks of rust or dirt running down a side. They are the same every frame.
function ydStreaks(ctx, x0, x1, yTop, len, seed, n, col, a) {
  ctx.fillStyle = col; ctx.globalAlpha = a; ctx.beginPath();
  for (let i = 0; i < n; i++) { const u = ydHash(seed, i * 3 + 1), v = ydHash(seed + 5, i * 3 + 2), x = lerp(x0, x1, u), l = len * (0.35 + v * 0.65), wd = 0.05 + v * 0.09; ctx.moveTo(x - wd, yTop); ctx.lineTo(x + wd, yTop); ctx.lineTo(x + wd * 0.2, yTop - l); ctx.closePath(); }
  ctx.fill(); ctx.globalAlpha = 1;
}

// ---- track ------------------------------------------------------------------
// One track: a bed of stone seen from above, sleepers, and two bright rails. The
// near rail is drawn lower than the far one, as it looks from the grain elevator.
K.track = function (S, P, o) {
  o = o || {};
  const y = o.y || 0, base = o.ballast || '#6c6660', T = (h) => S.tone(h, P);
  const bal = T(base), balHi = T(lighten(base, 0.13)), balLo = T(darken(base, 0.2));
  const tie = mix(T('#33291f'), bal, 0.3), tieHi = mix(T('#54463a'), bal, 0.3), rail = T(o.rail || '#c3c8d0'), railD = T('#3b3733'), rust = T('#6a4832'), oil = mix(bal, T('#1f1b19'), 0.34);
  const weedA = T('#566a3c'), weedB = T('#7d7748');
  // decoration only: oil stains between the rails, and weeds along the shoulder
  const D = makeRng(Math.round(P.z * 13) + 71), stains = [], weeds = [];
  for (let x = -170 + D.r(0, 9); x < 170; x += D.r(6, 19)) stains.push([x, D.r(1.0, 4.2), D.r(0.22, 0.5)]);
  for (let x = -170; x < 170; x += D.r(0.7, 5.5)) weeds.push([x, D.r(0.14, 0.4), D.chance(0.7) ? -0.84 : -0.62, D.f()]);
  const joint = 18, jph = D.r(0, joint), seed = Math.round(P.z) % 97;
  P.add({ x0: -4000, x1: 4000, layer: 0, draw(ctx, env) {
    if (y + 0.6 < env.y0 || y - 1.0 > env.y1) return;
    const a = env.x0 - 2, w = env.x1 - env.x0 + 4, s = env.s, px = env.px, b = Math.floor(env.x0 / 0.7) * 0.7;
    R4(ctx, a, y - 0.66, w, 0.74, bal);                       // the top of the bed
    R4(ctx, a, y - 0.92, w, 0.26, balLo);                     // its near shoulder
    if (s > 30) { // loose stone, once a stone is a pixel or two across
      ctx.fillStyle = balHi; ctx.beginPath(); ydSpeck(ctx, env, -400, 400, y - 0.84, y + 0.02, 0.5, seed, 2, 0.05); ctx.fill();
      ctx.fillStyle = balLo; ctx.beginPath(); ydSpeck(ctx, env, -400, 400, y - 0.62, y + 0.02, 0.5, seed + 31, 1, 0.05); ctx.fill();
    }
    if (s > 3.2) { // dark stains where engines stand and drip
      ctx.fillStyle = oil; ctx.beginPath();
      for (let i = 0; i < stains.length; i++) { const q = stains[i]; if (q[0] + q[1] < env.x0 || q[0] - q[1] > env.x1) continue; ctx.moveTo(q[0] + q[1], y - 0.24); ctx.ellipse(q[0], y - 0.24, q[1], 0.17 * (0.6 + q[2]), 0, 0, TAU); }
      ctx.fill();
    }
    if (s > 2.6) { // sleepers
      ctx.fillStyle = tie; ctx.beginPath(); for (let x = b; x < env.x1; x += 0.7) ctx.rect(x, y - 0.56, 0.24, 0.6); ctx.fill();
      if (s > 14) { ctx.fillStyle = tieHi; ctx.beginPath(); for (let x = b; x < env.x1; x += 0.7) ctx.rect(x, y - 0.56, 0.24, 0.05); ctx.fill(); }
    }
    const rh = Math.max(0.085, px * 1.15), j0 = Math.floor((env.x0 - jph) / joint) * joint + jph;
    if (s > 6) { // the dark underside of each rail, the plates where two lengths meet, and the chairs
      ctx.fillStyle = railD; ctx.beginPath(); ctx.rect(a, y - 0.1, w, 0.08); ctx.rect(a, y - 0.54, w, 0.08);
      if (s > 9) for (let x = j0; x < env.x1 + 1; x += joint) { ctx.rect(x - 0.32, y - 0.13, 0.64, 0.1); ctx.rect(x - 0.32, y - 0.57, 0.64, 0.1); }
      if (s > 26) for (let x = b; x < env.x1; x += 0.7) { ctx.rect(x + 0.03, y - 0.11, 0.18, 0.07); ctx.rect(x + 0.03, y - 0.55, 0.18, 0.07); }
      ctx.fill();
    }
    ctx.fillStyle = rail; ctx.beginPath(); ctx.rect(a, y - 0.03, w, rh); ctx.rect(a, y - 0.47, w, Math.max(0.075, px)); ctx.fill();
    if (s > 26) { ctx.fillStyle = rust; ctx.beginPath(); for (let x = j0; x < env.x1 + 1; x += joint) for (let q = 0; q < 4; q++) { ctx.rect(x - 0.25 + q * 0.15, y - 0.1, 0.05, 0.04); ctx.rect(x - 0.25 + q * 0.15, y - 0.54, 0.05, 0.04); } ctx.fill(); }
    if (s > 14) { // weeds, once they are big enough to see
      const lean = Math.sin(env.t * 1.3 + P.z) * 0.02 + (env.wind || 0) * 0.012;
      for (let pass = 0; pass < 2; pass++) {
        ctx.fillStyle = pass ? weedB : weedA; ctx.beginPath();
        for (let i = pass; i < weeds.length; i += 2) { const q = weeds[i]; if (q[0] < env.x0 - 1 || q[0] > env.x1 + 1) continue; ydTuft(ctx, q[0], y + q[2], q[1], lean * (0.5 + q[3])); }
        ctx.fill();
      }
    }
  } });
};

// ---- rolling stock ------------------------------------------------------------
// Every wagon is drawn to about the same height on purpose: a train stops bullets
// over its whole outline, so it should look solid.
const STOCK_LEN = { loco: 18, box: 16.4, tank: 16.4, cont: 16.4, hop: 16.4 };
// Colours every wagon on a plane shares, worked out once.
function ydInk(S, P) {
  if (P._ydInk) return P._ydInk;
  const t = (h, lit) => S.tone(h, P, lit), dusk = S.pal.dark > 0.3;
  return (P._ydInk = { dk: t('#15171c'), mid: t('#2b2e36'), steel: t('#4a4f58'), rim: t('#767c86'), rust: t('#7a4a2a'), chalk: t('#e6e0cf'), coal: t('#141418'), coalHi: t('#3c3c46'), yel: t('#e2b33c'),
    red: t('#b8352b'), white: t('#e8e4d6'), win: dusk ? t('#ffe7b3', true) : t(S.pal.glass), head: dusk ? '#fff3c4' : t('#e8e4d0'), tail: dusk ? '#ff4a3d' : t('#a8322a'), dusk, smoke: S.pal.dark > 0.5 ? 'rgb(96,102,120)' : 'rgb(74,72,78)' });
}
function ydTint(S, P, col) {
  const m = P._ydTint || (P._ydTint = {});
  return m[col] || (m[col] = { c: S.tone(col, P), c2: S.tone(darken(col, 0.22), P), c3: S.tone(darken(col, 0.42), P), hi: S.tone(lighten(col, 0.15), P), ink: S.tone(mix('#e8e4d6', col, 0.4), P) });
}
// Everything under the floor of one vehicle: wheels, bogie frames, the underframe and
// the couplings as one dark shape; then, closer, tyres, axle boxes and buffers; then,
// closer still, the small parts. The body runs x0..x1, the bogies start at b1 and b2 and
// have n wheels each. A fuel tank hangs between t0 and t1 if given.
function ydGear(ctx, env, I, x0, x1, b1, b2, n, roll, t0, t1) {
  const r = 0.45, gap = n === 3 ? 1.3 : 1.9, L = gap * (n - 1) + 1.1, s = env.s;
  ctx.fillStyle = I.dk; ctx.beginPath();
  for (let q = 0; q < 2; q++) { const bx = q ? b2 : b1; for (let i = 0; i < n; i++) { const cx = bx + 0.55 + i * gap; ctx.moveTo(cx + r, r); ctx.arc(cx, r, r, 0, TAU); } ctx.rect(bx + 0.12, 0.36, L - 0.24, 0.24); ctx.rect(bx + L / 2 - 0.4, 0.3, 0.8, 0.45); }
  ctx.rect(x0, 0.72, x1 - x0, 0.3); ctx.rect(x0 - 0.5, 0.78, 0.5, 0.1); ctx.rect(x1, 0.78, 0.5, 0.1);
  if (t0 !== undefined) { ctx.rect(t0, 0.3, t1 - t0, 0.62); ctx.moveTo(t0 + 0.31, 0.61); ctx.arc(t0, 0.61, 0.31, 0, TAU); ctx.moveTo(t1 + 0.31, 0.61); ctx.arc(t1, 0.61, 0.31, 0, TAU); }
  ctx.fill();
  if (s <= 4.5) return;
  ctx.strokeStyle = I.rim; ctx.lineWidth = Math.max(0.05, env.px * 0.8); ctx.beginPath();
  for (let q = 0; q < 2; q++) { const bx = q ? b2 : b1; for (let i = 0; i < n; i++) { const cx = bx + 0.55 + i * gap; ctx.moveTo(cx + r * 0.84, r); ctx.arc(cx, r, r * 0.84, 0, TAU); } }
  if (s > 24) for (let q = 0; q < 2; q++) { const bx = q ? b2 : b1; for (const sx of [-0.28, 0.28]) for (let j = 0; j < 4; j++) { const yy = 0.34 + j * 0.085; ctx.moveTo(bx + L / 2 + sx - 0.09, yy); ctx.lineTo(bx + L / 2 + sx + 0.09, yy + 0.05); } } // coil springs
  ctx.stroke();
  ctx.fillStyle = I.steel; ctx.beginPath();
  for (let q = 0; q < 2; q++) { const bx = q ? b2 : b1; for (let i = 0; i < n; i++) ctx.rect(bx + 0.55 + i * gap - 0.15, r - 0.15, 0.3, 0.3); }
  ctx.rect(x0 - 0.4, 0.98, 0.4, 0.1); ctx.rect(x1, 0.98, 0.4, 0.1); ctx.rect(x0 - 0.47, 0.85, 0.08, 0.36); ctx.rect(x1 + 0.39, 0.85, 0.08, 0.36);
  if (s > 24) for (let q = 0; q < 2; q++) { const bx = q ? b2 : b1; for (let i = 0; i < n; i++) { const cx = bx + 0.55 + i * gap; for (let j = 0; j < 4; j++) { const an = roll + j * (TAU / 4), hx = cx + Math.cos(an) * r * 0.55, hy = r + Math.sin(an) * r * 0.55; ctx.moveTo(hx + r * 0.11, hy); ctx.arc(hx, hy, r * 0.11, 0, TAU); } } } // holes in the wheel discs turn as it rolls
  ctx.fill();
}
// One vehicle, drawn with its left end at a and rail level at 0. T says where that
// frame sits in the world (needed only for lettering) and how far the wheels have turned.
function drawStock(ctx, env, S, P, kind, a, w, col, k, T) {
  const I = ydInk(S, P), C = ydTint(S, P, col), s = env.s, fine = s > 4.5, det = s > 11, micro = s > 24;
  const x0 = a + 0.1, x1 = a + w - 0.1, len = x1 - x0, xm = (x0 + x1) / 2, ln = [];
  if (kind === 'loco') { ydLoco(ctx, env, S, P, a, w, col, k, T, I, C); return; }
  ydGear(ctx, env, I, x0, x1, x0 + 1.1, x1 - 4.1, 2, T.roll);
  if (kind === 'tank') {
    const r = 1.5, cy = 2.56;
    // end frames, saddles and a catwalk square the outline off
    ctx.fillStyle = I.mid; ctx.beginPath(); ctx.rect(x0, 1.0, 0.22, 3.26); ctx.rect(x1 - 0.22, 1.0, 0.22, 3.26); ctx.rect(x0, 4.14, len, 0.12); ctx.rect(xm - 0.6, cy + r + 0.36, 1.2, 0.12);
    for (const bx of [x0 + 2.3, x1 - 2.3]) ydShape(ctx, [bx - 0.9, 1.0, bx + 0.9, 1.0, bx + 0.55, 1.5, bx - 0.55, 1.5]);
    ctx.fill();
    ctx.fillStyle = C.c; ctx.beginPath(); ctx.rect(x0 + r + 0.25, cy - r, len - 2 * r - 0.5, 2 * r); ctx.moveTo(x0 + 2 * r + 0.25, cy); ctx.arc(x0 + r + 0.25, cy, r, 0, TAU); ctx.moveTo(x1 - 0.25, cy); ctx.arc(x1 - r - 0.25, cy, r, 0, TAU); ctx.fill();
    // shade under the belly, the straps and the filling dome
    ctx.fillStyle = C.c2; ctx.beginPath(); ctx.rect(x0 + r + 0.25, cy - r, len - 2 * r - 0.5, 0.52); ctx.rect(xm - 0.85, cy + r - 0.06, 1.7, 0.42);
    if (fine) for (let i = 0; i < 4; i++) ctx.rect(x0 + 2.2 + i * ((len - 4.6) / 3), cy - r, 0.16, 2 * r);
    ctx.fill();
    R4(ctx, x0 + r * 0.75, cy + r * 0.52, len - r * 1.5, 0.26, C.hi);           // light along the top
    if (fine) { // what has been spilt at the dome runs down the side
      ctx.fillStyle = I.dk; ctx.globalAlpha = 0.3; ctx.beginPath(); ydShape(ctx, [xm - 0.7, cy + r, xm + 0.5, cy + r, xm + 0.15, cy - r * 0.5, xm - 0.35, cy - r * 0.15]); ctx.fill(); ctx.globalAlpha = 1;
      ydLadder(ln, env, xm + 1.5, 1.0, 4.14, 0.45);
    }
    if (det) {
      ln.push(x0 + 0.2, 4.38, x1 - 0.2, 4.38, x0 + 0.2, 4.2, x0 + 0.2, 4.38, x1 - 0.2, 4.2, x1 - 0.2, 4.38, xm - 2.5, 4.2, xm - 2.5, 4.38, xm + 2.5, 4.2, xm + 2.5, 4.38); // catwalk rail
      ctx.fillStyle = I.dk; ctx.beginPath(); ctx.rect(xm - 0.12, 0.72, 0.24, 0.36); ydShape(ctx, [xm - 3.6, cy - 0.52, xm - 3.18, cy - 0.1, xm - 3.6, cy + 0.32, xm - 4.02, cy - 0.1]); ctx.fill(); // outlet valve, warning diamond
      ctx.fillStyle = I.yel; ctx.beginPath(); ydShape(ctx, [xm - 3.6, cy - 0.42, xm - 3.28, cy - 0.1, xm - 3.6, cy + 0.22, xm - 3.92, cy - 0.1]); ctx.fill();
      ydStreaks(ctx, x0 + 1.6, x1 - 1.6, cy - 0.2, 1.2, k * 7 + 3, 7, I.rust, 0.3);
    }
    if (ln.length) ydLines(ctx, env, ln, I.mid, 0.04);
    if (micro) { T.text('P.C.R. ' + (30 + (k * 7) % 60), xm + 3.4, cy + 0.1, 0.42, C.ink, 'center'); T.text('45 000 L', xm + 3.4, cy - 0.45, 0.26, C.ink, 'center'); }
  } else if (kind === 'cont') {
    const cols = ['#a8452f', '#2f6a8a', '#c9a23a', '#4a7a52', '#8a8f96', '#7a3a5a'];
    for (let i = 0; i < 2; i++) {
      const cw = (len - 0.5) / 2, cx = x0 + 0.15 + i * (cw + 0.2), cc = cols[(k + i * 3) % cols.length], Q = ydTint(S, P, cc);
      R4(ctx, cx, 1.25, cw, 3.02, Q.c);
      ctx.fillStyle = Q.c2; ctx.beginPath(); ctx.rect(cx, 4.09, cw, 0.18); ctx.rect(cx, 1.25, cw, 0.16);
      if (fine) { const st = det ? 0.3 : 0.46; for (let x = cx + 0.24; x < cx + cw - 0.15; x += st) ctx.rect(x, 1.45, st * 0.3, 2.6); }
      ctx.fill();
      // a painted band, and (close up) the things a real box carries
      ctx.fillStyle = Q.hi; ctx.beginPath(); ctx.rect(cx + cw * 0.08, 3.1, cw * 0.36, 0.36); ctx.rect(cx + cw * 0.08, 2.72, cw * 0.22, 0.2); ctx.fill();
      if (det) {
        ctx.fillStyle = I.dk; ctx.beginPath(); for (const qx of [cx, cx + cw - 0.2]) { ctx.rect(qx, 1.25, 0.2, 0.2); ctx.rect(qx, 4.07, 0.2, 0.2); } ctx.rect(cx + cw * 0.3, 1.25, 0.5, 0.13); ctx.rect(cx + cw * 0.62, 1.25, 0.5, 0.13); ctx.fill();
        ydStreaks(ctx, cx + 0.3, cx + cw - 0.3, 4.05, 1.5, k * 11 + i * 5, 5, I.rust, 0.34);
      }
      if (micro) { T.text(['CLDU', 'PCRU', 'NTHU', 'AURU'][(k + i) % 4] + ' ' + (2000 + Math.floor(ydHash(k, i) * 7000)), cx + cw - 0.4, 3.62, 0.3, Q.ink, 'right'); T.text('MAX 30 480 KG', cx + cw - 0.4, 3.3, 0.17, Q.ink, 'right'); }
    }
  } else if (kind === 'hop') {
    // coal heaped above the rim
    ctx.fillStyle = I.coal; ctx.beginPath(); ctx.moveTo(x0 + 0.3, 3.9);
    for (let i = 0; i <= 10; i++) ctx.lineTo(x0 + 0.5 + (i * (len - 1.0)) / 10, 4.02 + 0.26 * ydHash(k, i + 60) * Math.sin((i / 10) * Math.PI));
    ctx.lineTo(x1 - 0.3, 3.9); ctx.closePath();
    if (det) for (const bx of [xm - 2.6, xm + 1.0]) ydShape(ctx, [bx, 1.0, bx + 1.6, 1.0, bx + 1.3, 0.62, bx + 0.3, 0.62]); // discharge doors
    ctx.fill();
    poly(ctx, [x0, 4.0, x1, 4.0, x1, 2.0, x1 - 2.1, 0.98, x0 + 2.1, 0.98, x0, 2.0], C.c);
    poly(ctx, [x0, 2.0, x1, 2.0, x1 - 2.1, 0.98, x0 + 2.1, 0.98], C.c2);  // the sloping sheets underneath
    ctx.fillStyle = C.c3; ctx.beginPath(); ctx.rect(x0 - 0.05, 3.86, len + 0.1, 0.2);
    if (fine) for (let x = x0 + 0.1; x < x1 - 0.1; x += 1.34) ctx.rect(x, 1.9, 0.15, 2.0);
    ctx.fill();
    if (det) {
      ctx.fillStyle = C.hi; ctx.beginPath(); for (let x = x0 + 0.1; x < x1 - 0.1; x += 1.34) ctx.rect(x, 1.9, 0.04, 2.0); ctx.fill();
      ydStreaks(ctx, x0 + 0.4, x1 - 0.4, 3.86, 1.7, k * 13 + 9, 9, I.coal, 0.3);
      ydLadder(ln, env, x1 - 0.55, 1.0, 4.0, 0.4); ydLines(ctx, env, ln, I.mid, 0.04);
      ctx.fillStyle = I.coalHi; ctx.beginPath(); for (let i = 0; i < 14; i++) ctx.rect(x0 + 0.8 + ydHash(k, i + 80) * (len - 1.6), 4.02 + ydHash(k, i + 99) * 0.14, 0.14, 0.05); ctx.fill();
    }
    if (micro) { T.text('COAL', x0 + 2.6, 3.1, 0.5, C.ink, 'left'); T.text('P.C.R. ' + (300 + (k * 13) % 500), x0 + 2.6, 2.55, 0.3, C.ink, 'left'); }
  } else { // box van
    R4(ctx, x0, 1.0, len, 3.0, C.c);
    // shade along the bottom, the frame posts and the sliding door
    ctx.fillStyle = C.c2; ctx.beginPath(); ctx.rect(x0, 1.0, len, 0.42); ctx.rect(xm - 1.6, 1.06, 3.2, 2.88);
    if (fine) for (let x = x0 + 0.05; x < x1 - 0.1; x += 1.62) if (Math.abs(x + 0.06 - xm) > 1.7) ctx.rect(x, 1.0, 0.13, 3.0);
    ctx.fill();
    // roof, and the runners the door hangs from
    ctx.fillStyle = C.c3; ctx.beginPath(); ctx.rect(x0 - 0.1, 3.98, len + 0.2, 0.27); ctx.rect(xm - 3.4, 3.9, 5.1, 0.09); ctx.rect(xm - 3.4, 0.98, 5.1, 0.07); ctx.fill();
    if (fine) R4(ctx, xm - 1.6, 1.06, 0.13, 2.88, C.hi);
    if (det) { // boards, a brace across each panel and across the door, and a ladder
      ctx.fillStyle = C.c2; ctx.globalAlpha = 0.5; ctx.beginPath(); for (let yy = 1.3; yy < 3.95; yy += 0.3) ctx.rect(x0, yy, len, 0.03); ctx.fill(); ctx.globalAlpha = 1;
      for (let i = 0, x = x0 + 0.11; x < x1 - 1.7; x += 1.62, i++) if (Math.abs(x + 0.87 - xm) > 2.4) ln.push(x, i % 2 ? 1.0 : 3.98, x + 1.62, i % 2 ? 3.98 : 1.0);
      ln.push(xm - 1.47, 1.06, xm + 1.6, 3.94, xm - 1.47, 3.94, xm + 1.6, 1.06); ydLadder(ln, env, x0 + 0.2, 1.0, 4.2, 0.4);
      ydLines(ctx, env, ln, C.c3, 0.06);
      ydStreaks(ctx, x0 + 0.3, x1 - 0.3, 3.98, 1.5, k * 17 + 1, 8, I.rust, 0.3);
      // chalk: a tally and a scrawl left by the shunters, and a waybill in its clip
      const cx = xm + 2.6 + ydHash(k, 7) * 2.5, cyy = 1.9 + ydHash(k, 8) * 0.6;
      ydLines(ctx, env, [cx, cyy, cx, cyy + 0.4, cx + 0.12, cyy, cx + 0.12, cyy + 0.4, cx + 0.24, cyy, cx + 0.24, cyy + 0.4, cx - 0.08, cyy + 0.1, cx + 0.34, cyy + 0.32, cx + 0.7, cyy + 0.4, cx + 1.3, cyy + 0.05, cx + 0.7, cyy + 0.05, cx + 1.3, cyy + 0.4], I.chalk, 0.03);
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.rect(x0 + 2.2, 1.62, 0.26, 0.34); ctx.rect(xm + 1.3, 2.0, 0.09, 1.0); ctx.rect(xm + 1.2, 2.4, 0.3, 0.12); ctx.fill();
    }
    if (micro) { T.text('P.C.R.', x0 + 3.9, 3.3, 0.42, C.ink, 'left'); T.text(String(4000 + (k * 37) % 5000), x0 + 3.9, 2.82, 0.36, C.ink, 'left'); }
  }
}
// The engine: a diesel with a long bonnet, a cab at the leading end (+x), lamps,
// and exhaust that streams back along the train or leans with the wind.
function ydLoco(ctx, env, S, P, a, w, col, k, T, I, C) {
  const s = env.s, fine = s > 4.5, det = s > 11, micro = s > 24, xR = a + 0.3, xF = a + w - 0.3, cab = a + w - 5.4;
  ydGear(ctx, env, I, xR, xF, xR + 0.9, xF - 5.0, 3, T.roll, xR + 5.3, xR + 10.9);
  // bonnet and cab (the cab has a raked front)
  ctx.fillStyle = C.c; ctx.beginPath(); ctx.rect(xR + 0.4, 1.22, cab - xR - 0.4, 2.54); ydShape(ctx, [cab, 1.22, xF, 1.22, xF, 2.62, xF - 0.55, 4.14, cab, 4.14]); ctx.fill();
  // shade along the bottom, the radiator grille, the door seams
  ctx.fillStyle = C.c2; ctx.beginPath(); ctx.rect(xR + 0.4, 1.22, xF - xR - 0.4, 0.5); ctx.rect(xR + 0.7, 2.42, 2.5, 1.12);
  if (fine) { for (let x = xR + 3.7; x < cab - 0.6; x += 1.45) ctx.rect(x, 1.3, 0.09, 2.4); ctx.rect(xR + 9.2, 3.84, 1.9, 0.16); }
  ctx.fill();
  ctx.fillStyle = C.c3; ctx.beginPath(); ctx.rect(xR + 0.4, 3.74, cab - xR - 0.4, 0.1); ydShape(ctx, [cab - 0.16, 4.1, xF - 0.42, 4.1, xF - 0.52, 4.28, cab - 0.16, 4.28]);
  if (fine) { ctx.rect(cab - 0.04, 1.22, 0.08, 2.9); ctx.rect(cab + 2.34, 1.3, 0.06, 2.6); }
  ctx.fill();
  R4(ctx, xR + 0.4, 2.0, xF - xR - 0.4, 0.27, I.yel);
  // pilot, warning stripes on the nose, the exhaust stack and two fans on the roof
  ctx.fillStyle = I.dk; ctx.beginPath(); ydShape(ctx, [xF, 1.2, xF + 0.22, 0.34, xF - 0.55, 0.3, xF - 0.55, 1.0]);
  for (let i = 0; i < 4; i++) ydShape(ctx, [xF, 1.22 + i * 0.34, xF, 1.4 + i * 0.34, xF - 0.5, 1.58 + i * 0.34, xF - 0.5, 1.4 + i * 0.34]);
  ctx.rect(xR + 7.3, 3.84, 0.7, 0.42); ctx.rect(xR + 0.8, 3.84, 1.0, 0.2); ctx.rect(xR + 2.1, 3.84, 1.0, 0.2);
  ctx.fill();
  ctx.fillStyle = I.win; ctx.beginPath(); ctx.rect(cab + 0.6, 2.72, 1.5, 1.05); ctx.rect(cab + 2.6, 2.72, 1.7, 1.05); ydShape(ctx, [xF - 0.5, 2.72, xF - 0.08, 2.72, xF - 0.42, 3.77, xF - 0.5, 3.77]); ctx.fill();
  if (det) {
    const pts = [cab + 0.6, 2.72, cab + 2.1, 2.72, cab + 0.6, 3.77, cab + 2.1, 3.77, cab + 0.6, 2.72, cab + 0.6, 3.77, cab + 2.1, 2.72, cab + 2.1, 3.77, cab + 2.6, 2.72, cab + 4.3, 2.72, cab + 2.6, 3.77, cab + 4.3, 3.77, cab + 2.6, 2.72, cab + 2.6, 3.77, cab + 4.3, 2.72, cab + 4.3, 3.77];
    for (let yy = 2.5; yy < 3.5; yy += 0.14) pts.push(xR + 0.8, yy, xR + 3.1, yy);                       // grille bars
    for (let x = xR + 3.9; x < cab - 1.8; x += 1.45) for (let q = 0; q < 5; q++) pts.push(x + 0.2, 2.5 + q * 0.2, x + 1.1, 2.5 + q * 0.2); // louvres
    ydLines(ctx, env, pts, C.c3, 0.035);
    const rl = [xR + 0.5, 1.9, cab - 0.2, 1.9, cab + 0.3, 1.3, cab + 0.3, 3.4, cab + 2.2, 1.3, cab + 2.2, 3.4, cab + 0.25, 0.5, cab + 0.25, 1.2, cab + 0.75, 0.5, cab + 0.75, 1.2, cab + 0.25, 0.5, cab + 0.75, 0.5, cab + 0.25, 0.85, cab + 0.75, 0.85];
    for (let x = xR + 0.5; x < cab; x += 1.45) rl.push(x, 1.22, x, 1.9);   // handrail along the walkway, grab rails and steps
    ydLines(ctx, env, rl, I.rim, 0.035);
    ydStreaks(ctx, xR + 6.6, xR + 8.6, 3.74, 1.3, k + 5, 4, I.dk, 0.35);  // soot below the exhaust
    R4(ctx, xF - 0.1, 0.72, 0.14, 0.4, I.red);
  }
  if (micro) T.text(String(7100 + (k * 23) % 80), cab + 3.45, 1.52, 0.34, C.ink, 'center');
  // lamps
  ctx.fillStyle = I.head; ctx.beginPath(); ctx.arc(xF - 0.16, 2.3, 0.17, 0, TAU); ctx.moveTo(xF - 0.37, 3.98); ctx.arc(xF - 0.48, 3.98, 0.11, 0, TAU); ctx.fill();
  if (fine) R4(ctx, xR, 1.5, 0.1, 0.2, I.tail);
  if (I.dusk) {
    const g = ydGrad(ctx, 'beam', (c) => { const q = c.createLinearGradient(0, 0, 1, 0); ydStops(q, '255,238,185', [[0, 0.4], [0.3, 0.16], [1, 0]]); return q; });
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.transform(28, 0, 0, 1, xF, 0);
    ctx.beginPath(); ctx.moveTo(0, 2.3); ctx.lineTo(1, 5.0); ctx.lineTo(1, 0); ctx.closePath(); ctx.fill();
    ctx.transform(1 / 28, 0, 0, 1, -xF / 28, 0); ctx.globalCompositeOperation = 'source-over';
    ydGlow(ctx, xF - 0.1, 2.3, 1.5, 1.5, '255,240,200', 0.7);
  }
  // exhaust: it streams back over the train when she is moving
  if (s > 1.5) ydSmoke(ctx, env, xR + 7.65, 4.3, I.smoke, 5, T.moving ? 2.6 : 6, 0.3, T.moving ? 1.5 : 1.7, T.moving ? 0.5 : 0.17, 0.42, T.moving ? -20 : (env.wind || 0) * T.dir * 2.6, k * 0.37);
}
const STOCK_COLS = ['#7a4a38', '#4a5a6a', '#6a6a52', '#5a4038', '#3f5a52', '#70583a'];
const STOCK_MIX = [['box', 'tank', 'cont', 'box', 'hop'], ['cont', 'box', 'hop', 'tank', 'box'], ['hop', 'hop', 'box', 'cont', 'tank'], ['tank', 'cont', 'box', 'box', 'cont']];

// A freight train as a vehicle kind: an engine and five wagons. Solid.
CARS.freight = { len: 104, h: 4.3, body: 4.3, cab: [-0.5, 0.5], win: [], seats: [], wheel: 0, solid: true, train: true,
  draw(ctx, env, S, P, x, y, dir, colHex, st) {
    if (y + 12 < env.y0 || y - 0.2 > env.y1) return;
    const L = 104, k = (st && st.seed) || 0, mixk = STOCK_MIX[k % STOCK_MIX.length];
    const T = { dir, roll: (-x * dir) / 0.45, moving: !!(st && st.moving), text: (str, lx, ly, size, col, al) => env.text(ctx, str, x + dir * lx, y + ly, size, col, dir > 0 ? al : al === 'left' ? 'right' : al === 'right' ? 'left' : al) };
    // which part of the train, in its own coordinates, is on screen
    const l0 = dir > 0 ? env.x0 - x : x - env.x1, l1 = dir > 0 ? env.x1 - x : x - env.x0;
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    let a = L / 2 - 18;
    if (a - 24 < l1 && a + 48 > l0) drawStock(ctx, env, S, P, 'loco', a, 18, colHex || '#3d5a80', k, T);
    for (let i = 0; i < 5; i++) { a -= 17.2; if (a + 18 < l0 || a - 1 > l1) continue; drawStock(ctx, env, S, P, mixk[i], a + 0.4, 16.4, STOCK_COLS[(k * 2 + i * 5) % STOCK_COLS.length], k + i, T); }
    ctx.restore();
  } };

// Wagons that never move: scenery on a siding. kinds is a list of wagon kinds.
K.wagons = function (S, P, x, kinds, o) {
  o = o || {}; const y = o.y || 0, n = kinds.length, w = n * 17.2, k = o.seed || 0;
  P.add({ x0: x, x1: x + w, layer: o.layer || 0, draw(ctx, env) {
    if (y + 4.8 < env.y0 || y > env.y1) return;
    const T = { dir: 1, roll: k * 0.7, moving: false, text: (str, lx, ly, size, col, al) => env.text(ctx, str, lx, y + ly, size, col, al) };
    ctx.save(); ctx.translate(0, y);
    for (let i = 0; i < n; i++) { const a = x + i * 17.2; if (a + 17.6 < env.x0 || a > env.x1) continue; T.roll = (k + i) * 0.7; drawStock(ctx, env, S, P, kinds[i], a + 0.4, 16.4, STOCK_COLS[(k + i * 5) % STOCK_COLS.length], k + i, T); }
    ctx.restore();
  } });
  if (o.solid !== false) P.solid(x + 0.4, y, w - 0.8, 4.3, 'hard');
  return { x0: x, x1: x + w };
};

// ---- signals and lights ---------------------------------------------------------
// A signal on a post: an arm that lifts, and a pair of lamps. state.on true shows
// green and raises the arm, otherwise red with the arm level.
K.railSignal = function (S, P, x, h, state, o) {
  o = o || {}; const y = o.y || 0, T = (c) => S.tone(c, P);
  const post = T('#20242b'), head = T('#0d0f13'), steel = T('#3a3f47'), white = T('#e8e4d6'), red = T('#c8372d'), conc = T('#8a857c');
  let arm = state && state.on ? 1 : 0, lastT = null;
  P.add({ x0: x - 4, x1: x + 4, layer: o.layer === undefined ? 2 : o.layer, draw(ctx, env) {
    if (y + h + 2 < env.y0 || y > env.y1) return;
    const on = !!(state && state.on), s = env.s, top = y + h;
    if (lastT !== null) arm = approach(arm, on ? 1 : 0, clamp(Math.abs(env.t - lastT), 0, 0.2) * 2.4); else arm = on ? 1 : 0;
    lastT = env.t;
    const pts = [x, y, x, top];
    if (s > 3) { ydLadder(pts, env, x + 0.2, y + 0.4, top - 1.72, 0.34); if (s > 6) pts.push(x + 0.85, top - 1.7, x + 0.85, top - 0.9, x + 0.5, top - 0.9, x + 0.85, top - 0.9); }
    ydLines(ctx, env, pts, post, s > 3 ? 0.07 : 0.16);
    ctx.fillStyle = post; ctx.beginPath(); ctx.rect(x - 0.08, y, 0.16, h); if (s > 3) ctx.rect(x - 0.99, y + 0.9, 0.58, 0.07); ctx.fill();
    if (s > 3) { ctx.fillStyle = steel; ctx.beginPath(); ctx.rect(x - 0.25, top - 1.78, 1.1, 0.08); ctx.rect(x - 0.95, y, 0.5, 0.92); ctx.fill(); R4(ctx, x - 0.32, y, 0.64, 0.2, conc); } // landing, relay cabinet, footing
    // the arm, hinged on the post under the lamps
    const an = 0.8 * smooth(arm), ca = Math.cos(an), sa = Math.sin(an), px = x, py = top - 2.5;
    const arm4 = (u0, u1, col) => { ctx.fillStyle = col; ctx.beginPath(); ydShape(ctx, [px - u0 * ca + 0.14 * sa, py + u0 * sa + 0.14 * ca, px - u1 * ca + 0.14 * sa, py + u1 * sa + 0.14 * ca, px - u1 * ca - 0.14 * sa, py + u1 * sa - 0.14 * ca, px - u0 * ca - 0.14 * sa, py + u0 * sa - 0.14 * ca]); ctx.fill(); };
    arm4(-0.3, 1.6, red); arm4(1.1, 1.32, white);
    // lamp head with its hoods
    ctx.fillStyle = head; ctx.beginPath(); ctx.rect(x - 0.4, top - 1.5, 0.8, 1.6); ctx.moveTo(x + 0.4, top + 0.1); ctx.arc(x, top + 0.1, 0.4, 0, TAU);
    if (s > 9) { ydShape(ctx, [x - 0.3, top - 0.08, x + 0.3, top - 0.08, x + 0.22, top + 0.03, x - 0.22, top + 0.03]); ydShape(ctx, [x - 0.3, top - 0.83, x + 0.3, top - 0.83, x + 0.22, top - 0.72, x - 0.22, top - 0.72]); }
    ctx.fill();
    if (s > 9) { ctx.strokeStyle = white; ctx.lineWidth = Math.max(0.03, env.px * 0.6); ctx.strokeRect(x - 0.4, top - 1.5, 0.8, 1.6); R4(ctx, x - 0.2, top - 2.02, 0.4, 0.3, white); }
    const live = on ? '#4dff8a' : '#ff4034';
    circ(ctx, x, top - 0.3, 0.2, on ? live : '#1c2a20'); circ(ctx, x, top - 1.05, 0.2, on ? '#2a1614' : live);
    const r = Math.max(1.1, env.px * 7);
    ydGlow(ctx, x, on ? top - 0.3 : top - 1.05, r, r, on ? '80,255,140' : '255,70,55', 0.8);
  } });
};

// A tall lattice mast with a bank of lamps. It is a real, shootable light. The beam
// and the pool on the ground are a separate item so that they do not vanish when the
// lamp itself is just off screen.
K.floodlight = function (S, P, x, h, zone, o) {
  o = o || {}; const y = o.y || 0, T = (c) => S.tone(c, P), steel = T('#2a2e36'), steelHi = T('#474d57'), conc = T('#8a857c'), deadC = T('#3a3f47');
  const reach = o.reach || 16, RGB = '255,232,176', dark = S.pal.dark, top = y + h, n = Math.floor(h / 1.4);
  let dieT = null;
  const glow = (ob, env) => { // 1 while lit, fading quickly when the glass is shot out
    if (ob.alive && ob.on !== false) { dieT = null; return 1; }
    if (dieT === null) dieT = env.t;
    return clamp(1 - (env.t - dieT) / 0.3, 0, 1);
  };
  const ob = S.obj({ kind: 'lamp', id: o.id, plane: P, x, y: y + h, r: o.r || 0.55, zone, on: true, mat: 'glass', layer: 2, reach: o.reach || 16, col: '#fff0cf',
    draw(ctx, env) {
      if (top + 5 < env.y0 || y > env.y1) return;
      const s = env.s, k = glow(ob, env);
      // two legs leaning in, tied with cross braces; a working platform under the lamps
      ctx.strokeStyle = steel; ctx.lineWidth = Math.max(0.09, env.px * 0.8);
      ctx.beginPath(); ctx.moveTo(x - 0.58, y); ctx.lineTo(x - 0.2, top - 0.4); ctx.moveTo(x + 0.58, y); ctx.lineTo(x + 0.2, top - 0.4);
      if (s > 1.6) for (let i = 0; i < n; i++) { const u0 = i / n, u1 = (i + 1) / n, w0 = lerp(0.58, 0.2, u0), w1 = lerp(0.58, 0.2, u1), ya = y + (h - 0.4) * u0, yb = y + (h - 0.4) * u1; ctx.moveTo(x - w0, ya); ctx.lineTo(x + w1, yb); ctx.moveTo(x + w0, ya); ctx.lineTo(x - w1, yb); if (s > 5) { ctx.moveTo(x - w1, yb); ctx.lineTo(x + w1, yb); } }
      if (s > 8) { ctx.moveTo(x - 1.15, top - 1.5); ctx.lineTo(x + 1.15, top - 1.5); ctx.lineTo(x + 1.15, top - 0.7); ctx.lineTo(x - 1.15, top - 0.7); ctx.lineTo(x - 1.15, top - 1.5); }
      ctx.stroke();
      // the lamp bank
      ctx.fillStyle = steel; ctx.beginPath(); ctx.rect(x - 1.4, top - 0.42, 2.8, 0.16); ctx.rect(x - 0.12, top - 0.42, 0.24, 0.8); for (let i = 0; i < 4; i++) ctx.rect(x - 1.2 + i * 0.6, top - 0.27, 0.54, 0.54); ctx.fill();
      ctx.fillStyle = k > 0.02 ? mix(deadC, '#fff6d8', k) : deadC; ctx.beginPath(); for (let i = 0; i < 4; i++) ctx.rect(x - 1.15 + i * 0.6, top - 0.22, 0.44, 0.44); ctx.fill();
      if (s > 9) { ctx.fillStyle = steelHi; ctx.beginPath(); for (let i = 0; i < 4; i++) { const lx = x - 1.15 + i * 0.6; ctx.rect(lx - 0.07, top + 0.24, 0.58, 0.07); ctx.rect(lx + 0.2, top - 0.22, 0.03, 0.44); } ctx.fill(); R4(ctx, x - 0.85, y, 1.7, 0.28, conc); }
      if (k > 0.02 && dark > 0.25) ydGlow(ctx, x, top, 4.6, 4.6, RGB, k * (0.62 * dark + 0.2));
    } });
  P.add({ x0: x - reach * 1.3 - 1, x1: x + reach * 1.3 + 1, layer: 2, draw(ctx, env) {
    if (dark <= 0.25 || top < env.y0 || y - 2 > env.y1) return;
    const k = glow(ob, env); if (k <= 0.02) return;
    ydCone(ctx, x, top - 0.3, y, 1.3, reach * 1.05, RGB, k * (0.26 * dark + 0.05));
    ydPool(ctx, x, y, reach * 1.3, o.pool || reach * 0.1, RGB, k * (0.4 * dark + 0.1));
  } });
  return ob;
};

// ---- buildings ----------------------------------------------------------------
// The signal box: brick below, a glazed cabin above. People inside the cabin
// are in the room `<id>` and are seen through its long window.
K.signalBox = function (S, P, x, o) {
  o = o || {}; const y = o.y || 0, w = o.w || 8, id = o.id || 'sigbox', T = (c, lit) => S.tone(c, P, lit);
  const brick = T('#7a4a3c'), brick2 = T('#5e382e'), brickHi = T('#8d5a48'), mortar = mix(T('#7a4a3c'), T('#4a2c24'), 0.55), wood = T('#d8cfb8'), wood2 = T('#b3a98f'), roof = T('#2c3038'), roof2 = T('#3a3f49'), inRoom = T(S.pal.inRoom), stone = T('#9a9488');
  const iron = T('#20242b'), red = T('#b8352b'), door = T('#2f4638'), doorHi = T('#3f5a48'), litC = T('#ffd98a', true), litD = T('#8a6a3a', true), litB = T('#5a4526', true), board = T('#1c1f26'), boardTx = T('#f3e9c9', true);
  const leverCols = ['#c8372d', '#2f6db5', '#e2b33c', '#15171c', '#f1ede2'].map((c) => T(c, true)), leverOf = [0, 0, 1, 2, 3, 0, 1, 4, 3, 2, 0, 1];
  const room = S.room(id, o.lit !== false), fy = y + 3.4;
  const op = P.open({ x: x + 0.5, y: fy + 0.9, w: w - 1.0, h: 1.7, room: id, glass: true, blind: 0, deco: 3, tint: '#ffd98a', f: 1, c: 0 });
  P.solid(x, y, w, 3.4 + 0.9, 'wall'); P.solid(x, fy + 2.6, w, 0.5, 'wood'); P.solid(x, fy + 0.9, 0.5, 1.7, 'wood'); P.solid(x + w - 0.5, fy + 0.9, 0.5, 1.7, 'wood');
  const D = makeRng(Math.round(x * 31) + 977), odd = [];
  for (let i = 0; i < 26; i++) odd.push([x + D.r(0.2, w - 0.9), y + 0.35 + Math.floor(D.r(0, 9.5)) * 0.3, D.chance(0.5)]);
  P.add({ x0: x - 3.2, x1: x + w + 1.6, layer: 0, draw(ctx, env) {
    if (fy + 3.2 < env.y0 || y > env.y1) return;
    const s = env.s;
    // brick base
    R4(ctx, x, y, w, 3.4, brick);
    ctx.fillStyle = brick2; ctx.beginPath(); ctx.rect(x + w - 0.5, y, 0.5, 3.4); ctx.rect(x - 0.25, fy, w + 0.5, 0.2); ydShape(ctx, [x - 2.7, y, x - 0.25, fy, x - 0.25, fy - 0.32, x - 2.3, y]); ctx.rect(x - 1.1, fy - 0.1, 0.9, 0.1);
    if (s > 7) for (let i = 0; i < odd.length; i++) if (!odd[i][2]) ctx.rect(odd[i][0], odd[i][1], 0.5, 0.25);
    ctx.fill();
    if (s > 7) {
      ctx.fillStyle = mortar; ctx.beginPath(); for (let yy = y + 0.6; yy < y + 3.35; yy += 0.3) ctx.rect(x, yy, w - 0.5, 0.035); ctx.fill();
      ctx.fillStyle = brickHi; ctx.beginPath(); for (let i = 0; i < odd.length; i++) if (odd[i][2]) ctx.rect(odd[i][0], odd[i][1], 0.5, 0.25); ctx.fill();
    }
    // stone: plinth, door case, window surround, and (close up) the stair treads
    ctx.fillStyle = stone; ctx.beginPath(); ctx.rect(x - 0.08, y, w + 0.16, 0.3); ctx.rect(x + 0.88, y, 1.54, 2.45); ctx.rect(x + w - 3.3, y + 1.0, 1.8, 1.4);
    if (s > 8) for (let i = 0; i < 12; i++) { const u = (i + 0.5) / 12; ctx.rect(x - 2.6 + 2.35 * u, y + 3.4 * u - 0.02, 0.24, 0.05); }
    ctx.fill();
    R4(ctx, x + 1.0, y, 1.3, 2.3, door); R4(ctx, x + w - 3.2, y + 1.1, 1.6, 1.2, inRoom);
    if (s > 6) {
      ydLines(ctx, env, [x + 1.33, y + 0.1, x + 1.33, y + 2.2, x + 1.65, y + 0.1, x + 1.65, y + 2.2, x + 1.97, y + 0.1, x + 1.97, y + 2.2], doorHi, 0.03);
      ydLines(ctx, env, [x + w - 2.4, y + 1.1, x + w - 2.4, y + 2.3, x + w - 3.2, y + 1.7, x + w - 1.6, y + 1.7], stone, 0.05);
      // three fire buckets on their hooks
      ctx.fillStyle = red; ctx.beginPath(); for (let i = 0; i < 3; i++) ydShape(ctx, [x + 3.1 + i * 0.6, y + 1.9, x + 3.5 + i * 0.6, y + 1.9, x + 3.44 + i * 0.6, y + 1.48, x + 3.16 + i * 0.6, y + 1.48]); ctx.fill();
    }
    // the cabin on top
    R4(ctx, x - 0.25, fy + 0.2, w + 0.5, 2.9, wood);
    ctx.fillStyle = wood2; ctx.beginPath(); ctx.rect(x + w + 0.02, fy + 0.2, 0.23, 2.9);
    if (s > 6) { for (let yy = fy + 0.38; yy < fy + 0.9; yy += 0.17) ctx.rect(x - 0.25, yy, w + 0.5, 0.03); for (let yy = fy + 2.72; yy < fy + 3.1; yy += 0.17) ctx.rect(x - 0.25, yy, w + 0.5, 0.03); }
    ctx.fill();
    if (room.lit) {
      R4(ctx, op.x, op.y, op.w, op.h, litC);
      if (s > 3) {
        // the back wall: a shelf of block instruments and the diagram of the yard
        ctx.fillStyle = litD; ctx.beginPath(); ctx.rect(op.x, op.y + 1.3, op.w, 0.07); for (let i = 0; i < 5; i++) ctx.rect(op.x + 0.5 + i * 1.25, op.y + 1.0, 0.5, 0.3); if (s > 9) ctx.rect(op.x + op.w - 2.7, op.y + 1.42, 2.2, 0.26); ctx.fill();
        if (s > 9) { ctx.fillStyle = litC; ctx.beginPath(); for (let i = 0; i < 5; i++) { ctx.moveTo(op.x + 0.85 + i * 1.25, op.y + 1.16); ctx.arc(op.x + 0.75 + i * 1.25, op.y + 1.16, 0.1, 0, TAU); } ctx.rect(op.x + op.w - 2.6, op.y + 1.53, 2.0, 0.03); ctx.fill(); }
        // the lever frame: a row of levers with painted handles
        ctx.fillStyle = litB; ctx.beginPath(); ctx.rect(op.x + 0.3, op.y, op.w - 0.6, 0.12);
        for (let i = 0; i < 12; i++) { const lx = op.x + 0.55 + i * 0.5, lean = (i * 5) % 7 < 2 ? 0.16 : 0; ydShape(ctx, [lx - 0.035, op.y, lx + 0.035, op.y, lx + 0.035 + lean, op.y + 0.78, lx - 0.035 + lean, op.y + 0.78]); }
        ctx.fill();
        if (s > 6) for (let c = 0; c < 5; c++) { ctx.fillStyle = leverCols[c]; ctx.beginPath(); for (let i = 0; i < 12; i++) if (leverOf[i] === c) ctx.rect(op.x + 0.5 + i * 0.5 + ((i * 5) % 7 < 2 ? 0.14 : 0), op.y + 0.5, 0.1, 0.3); ctx.fill(); }
      }
    } else R4(ctx, op.x, op.y, op.w, op.h, env.nv ? mix(inRoom, '#2c5a3a', 0.5) : inRoom);
    // handrail of the outside stair, and the rail the buckets hang from
    if (s > 4) ydLines(ctx, env, [x - 2.7, y + 1.0, x - 0.3, fy + 1.0, x - 2.7, y, x - 2.7, y + 1.0, x - 1.5, y + 1.66, x - 1.5, y + 2.66, x - 0.3, fy, x - 0.3, fy + 1.0, x + 3.0, y + 1.95, x + 4.9, y + 1.95], iron, 0.05);
  } });
  P.add({ x0: x - 1.5, x1: x + w + 6, layer: 1, draw(ctx, env) {
    if (fy + 12 < env.y0 || y > env.y1) return;
    const s = env.s;
    if (!op.broken) { ctx.fillStyle = room.lit ? 'rgba(255,255,255,0.07)' : 'rgba(170,205,235,0.12)'; ctx.beginPath(); ctx.rect(op.x, op.y, op.w, op.h); if (s > 4) for (let i = 0; i < 6; i += 2) { const gx = op.x + (i * op.w) / 6; ydShape(ctx, [gx + 0.25, op.y, gx + 0.6, op.y, gx + 1.05, op.y + op.h, gx + 0.7, op.y + op.h]); } ctx.fill(); }
    ctx.strokeStyle = wood; ctx.lineWidth = Math.max(0.09, env.px * 0.9); ctx.beginPath(); ctx.rect(op.x, op.y, op.w, op.h);
    for (let i = 1; i < 6; i++) { ctx.moveTo(op.x + (i * op.w) / 6, op.y); ctx.lineTo(op.x + (i * op.w) / 6, op.y + op.h); } ctx.stroke();
    // slate roof, gutter, stove pipe and downpipe
    ctx.fillStyle = iron; ctx.beginPath(); ctx.rect(x + w - 2.25, fy + 3.6, 0.3, 2.0); ctx.rect(x + w - 2.34, fy + 5.5, 0.48, 0.12); ctx.rect(x - 0.95, fy + 3.02, w + 1.9, 0.12); if (s > 5) ctx.rect(x + w + 0.3, y, 0.12, fy + 3.05 - y); ctx.fill();
    poly(ctx, [x - 0.9, fy + 3.1, x + w + 0.9, fy + 3.1, x + w - 1.1, fy + 4.5, x + 1.1, fy + 4.5], roof);
    if (s > 5) { const pts = []; for (let i = 1; i < 5; i++) { const u = i / 5; pts.push(x - 0.9 + 2.0 * u, fy + 3.1 + 1.4 * u, x + w + 0.9 - 2.0 * u, fy + 3.1 + 1.4 * u); } pts.push(x + 1.05, fy + 4.5, x + w - 1.05, fy + 4.5); ydLines(ctx, env, pts, roof2, 0.04); }
    if (S.pal.dark < 0.9 && s > 2.5) ydSmoke(ctx, env, x + w - 2.1, fy + 5.7, 'rgb(190,186,190)', 4, 5.5, 0.22, 1.1, 0.12, 0.3, (env.wind || 0) * 2.4, 0.2);
    // name board
    R4(ctx, x + 1.1, y + 2.5, w - 2.2, 0.72, wood); R4(ctx, x + 1.2, y + 2.55, w - 2.4, 0.62, board); env.text(ctx, o.name || 'CALDER YARD', x + w / 2, y + 2.68, 0.42, boardTx, 'center');
    // light from the long window falls on the cabin front and the landing
    if (room.lit && S.pal.dark > 0.25) ydGlow(ctx, x + w / 2, op.y + 0.5, w * 0.72, 2.6, '255,210,130', 0.2 * S.pal.dark + 0.06);
  } });
  return { x, w, room: id, floor: fy, op, at: (xx, extra) => Object.assign({ plane: P, x: xx, y: fy, room: id, zone: id, behind: true }, extra || {}) };
};

// A water tower on a lattice of legs, with a swinging spout for filling engines.
K.yardTank = function (S, P, x, o) {
  o = o || {}; const y = o.y || 0, h = o.h || 11, w = o.w || 7.5, th = o.th || 5, T = (c) => S.tone(c, P), tc = o.col || '#7d5a45';
  const leg = T('#2f333b'), legHi = T('#4a505a'), tank = T(tc), band = T(darken(tc, 0.28)), hi = T(lighten(tc, 0.14)), lo = T(darken(tc, 0.14)), stave = T(darken(tc, 0.1)), roofL = T(darken(tc, 0.18)), conc = T('#8a857c'), wet = T('#221d1a'), lime = T('#cfc8b6'), moss = T('#3c5236'), white = T('#e9e0c8'), red = T('#c8372d'), bag = T('#a89a7c');
  const ty = y + h + 0.35, sx4 = [-1, -0.33, 0.33, 1];
  P.add({ x0: x - w, x1: x + w + 5, layer: o.layer || 0, draw(ctx, env) {
    if (ty + th + 3 < env.y0 || y - 0.5 > env.y1) return;
    const s = env.s;
    // legs, girts and cross braces
    ctx.strokeStyle = leg; ctx.lineWidth = Math.max(0.2, env.px);
    ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(x + sx4[i] * w * 0.5, y); ctx.lineTo(x + sx4[i] * w * 0.42, y + h); } ctx.stroke();
    ctx.lineWidth = Math.max(0.09, env.px * 0.7); ctx.beginPath();
    for (let i = 0; i < 3; i++) { const y0 = y + (h * i) / 3, y1 = y + (h * (i + 1)) / 3; ctx.moveTo(x - w * 0.49, y0); ctx.lineTo(x + w * 0.45, y1); ctx.moveTo(x + w * 0.49, y0); ctx.lineTo(x - w * 0.45, y1); ctx.moveTo(x - w * 0.47, y1); ctx.lineTo(x + w * 0.47, y1); }
    if (s > 5) { const pts = []; ydLadder(pts, env, x - w * 0.5 + 0.35, y + 0.4, y + h + 0.3, 0.4); pts.push(x + w / 2 + 1.7, y + h - 0.15, x + w / 2 + 1.7, y + h - 1.9, x + w / 2 + 0.1, y + h + 2.6, x + w / 2 + 2.2, y + h - 0.4); for (let i = 0; i < pts.length; i += 4) { ctx.moveTo(pts[i], pts[i + 1]); ctx.lineTo(pts[i + 2], pts[i + 3]); } }
    ctx.stroke();
    // the feed pipe, the ring the tank sits on, the spout arm, and the finial
    ctx.fillStyle = leg; ctx.beginPath(); ctx.rect(x - 0.22, y, 0.44, h); ctx.rect(x - w / 2 - 0.3, y + h, w + 0.6, 0.35);
    ydShape(ctx, [x + w / 2, y + h + 1.05, x + w / 2 + 3.52, y + h - 1.12, x + w / 2 + 3.52, y + h - 2.2, x + w / 2 + 3.28, y + h - 2.2, x + w / 2 + 3.28, y + h - 1.3, x + w / 2, y + h + 0.75]);
    ctx.rect(x - 0.08, ty + th + 1.9, 0.16, 0.5); ctx.moveTo(x + 0.16, ty + th + 2.45); ctx.arc(x, ty + th + 2.45, 0.16, 0, TAU);
    if (s > 5) ctx.rect(x + w / 2 + 1.55, y + h - 2.3, 0.3, 0.42);
    if (s > 9) for (let i = 0; i < 4; i++) ctx.rect(x + w * 0.2 + (i % 2) * 0.5, y + h + 0.74 + i * (th - 0.9) / 3, 0.3, 0.28);
    ctx.fill();
    if (s > 5) {
      ctx.fillStyle = conc; ctx.beginPath(); for (let i = 0; i < 4; i++) ctx.rect(x + sx4[i] * w * 0.5 - 0.4, y, 0.8, 0.3); ctx.fill();
      ctx.fillStyle = legHi; ctx.beginPath(); ctx.rect(x - 0.3, y + 1.1, 0.6, 0.16); for (let i = 0; i <= 8; i++) ctx.rect(x - w / 2 - 0.25 + (i * (w + 0.4)) / 8, y + h + 0.04, 0.1, 0.27); ctx.fill();
    }
    // the tank: wooden staves held by iron bands
    R4(ctx, x - w / 2, ty, w, th, tank); R4(ctx, x - w / 2, ty, w * 0.16, th, hi); R4(ctx, x + w * 0.34, ty, w * 0.16, th, lo);
    if (s > 5) { ctx.fillStyle = stave; ctx.beginPath(); for (let xx = x - w / 2 + 0.42; xx < x + w / 2 - 0.1; xx += 0.42) ctx.rect(xx, ty, 0.035, th); ctx.fill(); }
    // where it has overflowed and leaked for years
    ctx.fillStyle = wet; ctx.globalAlpha = 0.3; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const sx = x - w / 2 + 0.5 + ydHash(i, 31) * (w - 1), l = 1 + ydHash(i, 37) * 3.2; ydShape(ctx, [sx - 0.22, ty + th, sx + 0.22, ty + th, sx + 0.06, ty + th - l, sx - 0.06, ty + th - l]); }
    ctx.rect(x - w / 2, ty, w, 0.4); ctx.moveTo(x + w / 2 + 5.0, y - 0.2); ctx.ellipse(x + w / 2 + 3.3, y - 0.2, 1.7, 0.16, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    if (s > 5) { R4(ctx, x - w / 2, ty, w, 0.16, moss); ctx.fillStyle = lime; ctx.globalAlpha = 0.35; ctx.beginPath(); for (let i = 0; i < 4; i++) { const sx = x - w / 2 + 0.8 + ydHash(i, 53) * (w - 1.6); ctx.rect(sx, ty + 0.5 + ydHash(i, 59) * 1.5, 0.07, 1.4); } ctx.fill(); ctx.globalAlpha = 1; }
    // bands and the conical roof
    ctx.fillStyle = band; ctx.beginPath(); for (let i = 0; i < 4; i++) ctx.rect(x - w / 2, y + h + 0.8 + i * (th - 0.9) / 3, w, 0.16); ydShape(ctx, [x - w / 2 - 0.4, ty + th, x + w / 2 + 0.4, ty + th, x, ty + th + 1.95]); ctx.fill();
    poly(ctx, [x - w / 2 - 0.4, ty + th, x - w * 0.12, ty + th, x, ty + th + 1.95], roofL);
    // water level board (a pointer on a scale), the valve wheel, the leather bag on the spout and a drip
    const sw = Math.sin(env.t * 0.9 + x) * 0.06 + (env.wind || 0) * 0.035;
    poly(ctx, [x + w / 2 + 3.22, y + h - 2.2, x + w / 2 + 3.58, y + h - 2.2, x + w / 2 + 3.56 + sw, y + h - 3.7, x + w / 2 + 3.28 + sw, y + h - 3.7], bag);
    if (s > 4) {
      R4(ctx, x + w / 2 + 0.12, ty + 0.5, 0.3, th - 1.0, white);
      ctx.fillStyle = red; ctx.beginPath(); ctx.rect(x + w / 2 + 0.06, ty + th * 0.62, 0.46, 0.14); ctx.moveTo(x + 0.76, y + 1.18); ctx.arc(x + 0.5, y + 1.18, 0.26, 0, TAU); ctx.fill();
      if (s > 7) { const u = (env.t * 0.7) % 1; R4(ctx, x + w / 2 + 3.4 + sw, y + h - 3.7 - u * u * (h - 3.7), 0.05, 0.16, lime); }
    }
    if (o.text) env.text(ctx, o.text, x, y + h + th * 0.42, 1.25, white, 'center');
  } });
  P.solid(x - w / 2, y + h, w, th + 0.35, 'hard');
  return { x, top: y + h + th + 0.35, rim: y + h + th + 0.35, w };
};

// A long brick engine shed with arched doors and a saw-tooth glass roof.
K.engineShed = function (S, P, x, w, o) {
  o = o || {}; const y = o.y || 0, h = o.h || 9, bc = o.col || '#6b4a40', T = (c, lit) => S.tone(c, P, lit);
  const brick = T(bc), brickLo = T(darken(bc, 0.16)), brickHi = T(lighten(bc, 0.09)), dark = T('#16181d'), soot = mix(T(darken(bc, 0.16)), T('#16181d'), 0.25), trim = T('#8a6a5a'), stone = T('#9a8e80'), lit = T('#ffcf7a', true), litD = T('#b98a48', true), litG = T('#e0b468', true);
  const roof = T('#30343c'), roofHi = T('#474c56'), wood = T('#4a3d32'), woodHi = T('#5d4e40'), glass = T(S.pal.glass), iron = T('#20242b');
  const n = Math.max(2, Math.floor(w / 13)), bw = w / n, dusk = S.pal.dark > 0.25, xr = Math.abs(Math.round(x));
  const arch = (ctx, cx, r) => { ctx.moveTo(cx - r, y); ctx.lineTo(cx - r, y + 4.2); ctx.arc(cx, y + 4.2, r, Math.PI, 0, true); ctx.lineTo(cx + r, y); ctx.closePath(); };
  P.add({ x0: x - 1, x1: x + w + 1, layer: 0, draw(ctx, env) {
    if (y + h + 14 < env.y0 || y > env.y1) return;
    const s = env.s, i0 = Math.max(0, Math.floor((env.x0 - x) / bw) - 1), i1 = Math.min(n - 1, Math.floor((env.x1 - x) / bw) + 1), a0 = Math.max(x, env.x0), a1 = Math.min(x + w, env.x1);
    const cxOf = (i) => x + (i + 0.5) * bw, open = (i) => (i + xr) % 3 !== 1, glow = (i) => dusk && i % 2 === 0;
    R4(ctx, x, y, w, h, brick);
    ctx.fillStyle = brickLo; ctx.beginPath(); ctx.rect(x, y, w, 0.5); ctx.rect(x, y + h * 0.62, w, h * 0.38);
    if (s > 9) for (let yy = y + 0.8; yy < y + h * 0.62; yy += 0.32) ctx.rect(a0, yy, a1 - a0, 0.035);
    ctx.fill();
    // soot above each doorway
    ctx.fillStyle = soot; ctx.beginPath(); for (let i = i0; i <= i1; i++) { const cx = cxOf(i); ctx.moveTo(cx - 2.2, y + 6.2); ctx.quadraticCurveTo(cx, y + 7.6, cx + 2.2, y + 6.2); ctx.lineTo(cx + 1.3, y + h); ctx.lineTo(cx - 1.3, y + h); ctx.closePath(); } ctx.fill();
    // stone arches and keystones, pier bases, and the rings of the round windows
    ctx.fillStyle = stone; ctx.beginPath();
    for (let i = i0; i <= i1; i++) { const cx = cxOf(i); arch(ctx, cx, 2.95); ctx.rect(cx - 0.3, y + 7.1, 0.6, 0.62); ctx.rect(cx - bw / 2 - 0.55, y, 1.1, 0.6); if (s > 2.5) { ctx.moveTo(cx - bw * 0.36 + 0.75, y + h - 2.2); ctx.arc(cx - bw * 0.36, y + h - 2.2, 0.75, 0, TAU); } }
    ctx.fill();
    // doorways and unlit windows
    ctx.fillStyle = dark; ctx.beginPath();
    for (let i = i0; i <= i1; i++) { const cx = cxOf(i); if (open(i)) arch(ctx, cx, 2.6); if (s > 2.5 && !glow(i)) { ctx.moveTo(cx - bw * 0.36 + 0.58, y + h - 2.2); ctx.arc(cx - bw * 0.36, y + h - 2.2, 0.58, 0, TAU); } }
    ctx.fill();
    if (dusk) { // lit roads inside, the front of an engine standing on one, lit round windows
      for (let i = i0; i <= i1; i++) if (open(i) && glow(i)) ydGlow(ctx, cxOf(i), y + 0.6, 2.9, 4.6, '255,200,120', 0.5);
      ctx.fillStyle = dark; ctx.beginPath(); for (let i = i0; i <= i1; i++) if (open(i) && glow(i) && i % 4 === 0) { const cx = cxOf(i); ctx.rect(cx - 1.5, y + 0.5, 3.0, 3.3); ctx.rect(cx - 1.7, y + 0.5, 3.4, 0.5); } ctx.fill();
      ctx.fillStyle = litD; ctx.beginPath(); for (let i = i0; i <= i1; i++) { const cx = cxOf(i); if (s > 2.5 && glow(i)) { ctx.moveTo(cx - bw * 0.36 + 0.58, y + h - 2.2); ctx.arc(cx - bw * 0.36, y + h - 2.2, 0.58, 0, TAU); } if (s > 4 && open(i) && glow(i) && i % 4 === 0) { ctx.rect(cx - 0.9, y + 2.7, 1.8, 0.7); ctx.moveTo(cx - 0.74, y + 1.5); ctx.arc(cx - 0.9, y + 1.5, 0.16, 0, TAU); ctx.moveTo(cx + 1.06, y + 1.5); ctx.arc(cx + 0.9, y + 1.5, 0.16, 0, TAU); } } ctx.fill();
    }
    // wooden doors: folded back against the wall, or shut
    ctx.fillStyle = wood; ctx.beginPath(); for (let i = i0; i <= i1; i++) { const cx = cxOf(i); if (open(i)) { ctx.rect(cx - 3.5, y, 0.5, 6.0); ctx.rect(cx + 3.0, y, 0.5, 6.0); } else arch(ctx, cx, 2.6); } ctx.fill();
    if (s > 4) {
      const pts = [];
      for (let i = i0; i <= i1; i++) { const cx = cxOf(i);
        if (open(i)) { if (s > 6) pts.push(cx - 3.5, y + 2, cx - 3.0, y + 2, cx - 3.5, y + 4, cx - 3.0, y + 4, cx + 3.0, y + 2, cx + 3.5, y + 2, cx + 3.0, y + 4, cx + 3.5, y + 4); }
        else { pts.push(cx, y, cx, y + 6.8, cx - 2.6, y + 2.2, cx + 2.6, y + 2.2, cx - 2.6, y + 4.3, cx + 2.6, y + 4.3); if (s > 9) for (let q = -2; q <= 2; q++) if (q) pts.push(cx + q * 0.87, y, cx + q * 0.87, y + 5.9); }
        if (s > 8) pts.push(cx - bw * 0.36 - 0.58, y + h - 2.2, cx - bw * 0.36 + 0.58, y + h - 2.2, cx - bw * 0.36, y + h - 2.78, cx - bw * 0.36, y + h - 1.62);
      }
      if (pts.length) ydLines(ctx, env, pts, woodHi, 0.05);
    }
    // brick piers between bays, and the cornice
    ctx.fillStyle = brickHi; ctx.beginPath(); for (let i = i0; i <= i1; i++) ctx.rect(cxOf(i) - bw / 2 - 0.4, y + 0.6, 0.8, h - 0.6); ctx.rect(x + w - 0.4, y, 0.8, h); ctx.fill();
    ctx.fillStyle = trim; ctx.beginPath(); ctx.rect(x - 0.3, y + h - 0.5, w + 0.6, 0.5);
    if (s > 7) for (let xx = Math.max(x, Math.floor(env.x0 / 0.6) * 0.6); xx < a1; xx += 0.6) ctx.rect(xx, y + h - 0.95, 0.3, 0.24);
    ctx.fill();
    // saw-tooth roof: slate on the long slope, glass on the steep one, a smoke vent on each ridge
    ctx.fillStyle = roof; ctx.beginPath(); for (let i = i0; i <= i1; i++) { const cx = cxOf(i); ydShape(ctx, [cx - bw / 2, y + h, cx + bw / 2, y + h, cx + bw / 2, y + h + 3.2]); ctx.rect(cx + bw / 2 - 1.9, y + h + 2.2, 1.3, 1.5); if (s > 5) ctx.rect(cx - bw / 2 + 0.5, y, 0.14, h); } ctx.fill();
    ctx.fillStyle = dusk ? litG : glass; ctx.beginPath(); for (let i = i0; i <= i1; i++) { const cx = cxOf(i); ydShape(ctx, [cx - bw / 2 + 0.4, y + h + 0.1, cx + bw / 2 - 0.6, y + h + 2.8, cx + bw / 2 - 0.6, y + h + 0.1]); } ctx.fill();
    if (s > 3) { const pts = []; for (let i = i0; i <= i1; i++) { const cx = cxOf(i); for (let q = 1; q < 6; q++) { const gx = cx - bw / 2 + 0.4 + (q * (bw - 1.0)) / 6; pts.push(gx, y + h + 0.1, gx, y + h + 0.1 + 2.7 * (q / 6)); } pts.push(cx - bw / 2 + 0.4, y + h + 0.1, cx + bw / 2 - 0.6, y + h + 2.8); } ydLines(ctx, env, pts, roof, 0.06); }
    ctx.fillStyle = roofHi; ctx.beginPath(); for (let i = i0; i <= i1; i++) { const vx = cxOf(i) + bw / 2 - 1.9; ctx.rect(vx - 0.2, y + h + 3.6, 1.7, 0.2); if (s > 6) for (let q = 0; q < 3; q++) ctx.rect(vx + 0.1, y + h + 2.7 + q * 0.3, 1.1, 0.05); } ctx.fill();
    if (s > 1.5) for (let i = i0; i <= i1; i++) if (i % 2 === 0) ydSmoke(ctx, env, cxOf(i) + bw / 2 - 1.25, y + h + 3.9, 'rgb(120,112,118)', 3, 9, 0.5, 2.4, 0.07, 0.3, (env.wind || 0) * 4, i * 0.21);
  } });
  P.solid(x, y, w, h, 'wall');
};

// The coaling tower: a concrete bunker that fills tenders from above, with a hoist
// house on top and a coal stage beside it.
function ydCoalTower(S, P, x, w, h) {
  const T = (c, lit) => S.tone(c, P, lit), conc = T('#3a3d46'), concHi = T('#4a4e58'), concLo = T('#2d3038'), dark = T('#16181d'), iron = T('#20242b'), lit = T('#ffcf7a', true), coal = T('#131316'), coalHi = T('#34343c'), white = T('#d8d2c0'), wood = T('#4a3d32');
  const dusk = S.pal.dark > 0.25;
  P.add({ x0: x - 15, x1: x + w + 3, layer: 0, draw(ctx, env) {
    if (h + 7 < env.y0 || 0 > env.y1) return;
    const s = env.s;
    // the skip hoist: a lattice ramp from the coal stage to the top, on two trestles
    ctx.strokeStyle = iron; ctx.lineWidth = Math.max(0.16, env.px); ctx.beginPath(); ctx.moveTo(x - 11.5, 1.2); ctx.lineTo(x + 2.2, h + 4.6); ctx.moveTo(x - 10.3, 0.6); ctx.lineTo(x + 3.2, h + 3.8);
    for (const u of [0.3, 0.62]) { ctx.moveTo(lerp(x - 10.9, x + 2.7, u), lerp(0.9, h + 4.2, u)); ctx.lineTo(lerp(x - 10.9, x + 2.7, u), 0); }
    ctx.stroke();
    if (s > 2.5) { const pts = []; for (let i = 0; i < 12; i++) { const u0 = i / 12, u1 = (i + 1) / 12; pts.push(lerp(x - 11.5, x + 2.2, u0), lerp(1.2, h + 4.6, u0), lerp(x - 10.3, x + 3.2, u1), lerp(0.6, h + 3.8, u1)); } ydLines(ctx, env, pts, iron, 0.07); }
    // the coal stage: a timber platform and the heap on it
    R4(ctx, x - 14.2, 0, 9.8, 1.25, wood);
    ctx.fillStyle = coal; ctx.beginPath(); ctx.moveTo(x - 14.0, 1.25); for (let i = 0; i <= 9; i++) ctx.lineTo(x - 13.8 + i * 0.95, 1.25 + (1.3 + ydHash(i, 71) * 0.5) * Math.sin(((i + 0.6) / 10.2) * Math.PI)); ctx.lineTo(x - 4.7, 1.25); ctx.closePath(); ctx.fill();
    // the bunker
    R4(ctx, x, 0, w, h, conc); R4(ctx, x, 0, w * 0.14, h, concHi);
    ctx.fillStyle = concLo; ctx.beginPath(); ctx.rect(x + w * 0.8, 0, w * 0.2, h); ctx.rect(x - 0.2, h - 1.2, w + 0.4, 1.2); ctx.rect(x + 2, h, 3.5, 6);
    if (s > 4) for (let yy = 2.4; yy < h - 1.3; yy += 2.4) ctx.rect(x + w * 0.14, yy, w * 0.66, 0.06);
    ctx.fill();
    // the portal an engine stands in, the chutes over it, and the hoist house roof and rail
    ctx.fillStyle = dark; ctx.beginPath(); ctx.rect(x + 2.6, 0, 5.4, 5.6); ctx.rect(x + 1.7, h + 5.8, 4.1, 0.4); ctx.rect(x + w - 3.5, h, 0.2, 1.4); ctx.rect(x + w - 0.6, h, 0.2, 1.4); ctx.rect(x + 5.5, h + 1.3, w - 5.5, 0.12);
    if (!dusk) { ctx.rect(x + 2.7, h + 3.4, 1.2, 1.2); if (s > 2.6) for (let i = 0; i < 3; i++) ctx.rect(x + 1.6 + i * 3.4, h - 4.2, 1.3, 0.9); }
    ctx.fill();
    ctx.fillStyle = concHi; ctx.beginPath(); ctx.rect(x + 2.3, 5.6, 6.0, 0.35); ydShape(ctx, [x + 3.6, 5.6, x + 4.9, 5.6, x + 4.6, 4.3, x + 3.9, 4.3]); ydShape(ctx, [x + 5.8, 5.6, x + 7.1, 5.6, x + 6.8, 4.3, x + 6.1, 4.3]); ctx.fill();
    if (dusk) { ctx.fillStyle = lit; ctx.beginPath(); ctx.rect(x + 2.7, h + 3.4, 1.2, 1.2); if (s > 2.6) for (let i = 0; i < 3; i++) ctx.rect(x + 1.6 + i * 3.4, h - 4.2, 1.3, 0.9); ctx.fill(); ydGlow(ctx, x + 5.3, 0.4, 3.2, 3.6, '255,200,120', 0.3); }
    if (s > 5) {
      ydStreaks(ctx, x + 1, x + w - 1, h - 1.2, 6, 211, 8, dark, 0.22);
      ydLines(ctx, env, [x - 14.2, 0.42, x - 4.4, 0.42, x - 14.2, 0.84, x - 4.4, 0.84, x - 11.8, 0, x - 11.8, 1.25, x - 9.2, 0, x - 9.2, 1.25, x - 6.6, 0, x - 6.6, 1.25], dark, 0.05);
      ctx.fillStyle = coalHi; ctx.beginPath(); for (let i = 0; i < 16; i++) ctx.rect(x - 13.2 + ydHash(i, 73) * 7.4, 1.4 + ydHash(i, 79) * 1.0, 0.2, 0.08); ctx.fill();
    }
    env.text(ctx, 'COAL', x + w / 2, h - 2.8, 1.5, white, 'center');
  } });
  P.solid(x, 0, w, h, 'wall');
}

// The works on the horizon: chimneys, gas holders, cooling towers, sheds.
K.industry = function (S, z, o) {
  o = o || {};
  const P = S.plane(z, 'works'), R = makeRng((o.seed || 3) * 17 + 5), x0 = o.x0 === undefined ? -620 : o.x0, x1 = o.x1 === undefined ? 620 : o.x1, base = o.base || 0;
  const cb = o.col || '#3d4150', cb2 = o.col2 || '#4a4e5e';
  const c1 = S.tone(cb, P), c2 = S.tone(cb2, P), c3 = S.tone('#2f3340', P), ch = S.tone(lighten(cb2, 0.09), P), cd = S.tone(darken(cb, 0.16), P), lit = S.tone(S.pal.lit, P, true), redB = S.tone('#b04a3a', P);
  const things = []; let x = x0;
  const kinds = ['shed', 'stack', 'gas', 'shed', 'cool', 'stack', 'frame', 'shed'];
  while (x < x1) {
    const t = kinds[R.i(0, kinds.length - 1)];
    const th = { t, x, w: 30, h: 20, ph: R.f(), win: [] };
    if (t === 'shed') { th.w = R.r(40, 95); th.h = R.r(11, 22); if (S.pal.litChance > 0.1) for (let i = 0; i < th.w / 6; i++) if (R.chance(0.45)) th.win.push([th.x + 2 + i * 6, base + th.h * R.r(0.3, 0.7)]); }
    else if (t === 'stack') { th.w = R.r(5, 8); th.h = R.r(58, 105); }
    else if (t === 'gas') { th.w = R.r(40, 56); th.h = R.r(26, 40); }
    else if (t === 'cool') { th.w = R.r(46, 62); th.h = R.r(52, 72); }
    else { th.w = R.r(16, 24); th.h = R.r(34, 52); }
    things.push(th); x += th.w + R.r(6, 34);
  }
  if (o.ground !== false) K.ground(S, P, { y: base, col: o.groundCol || '#4c4a52', noEdge: true });
  const dark = S.pal.dark, smokeCol = dark > 0.5 ? 'rgb(110,118,140)' : 'rgb(215,205,205)', steamCol = dark > 0.5 ? 'rgb(120,128,150)' : 'rgb(232,226,226)', vis = [];
  // the outline of a cooling tower between two fractions of its width
  const cool = (ctx, a, w, h, u0, u1) => { ctx.moveTo(a + w * u0, base); ctx.quadraticCurveTo(a + w * (0.3 + (u0 - 0) * 0.4), base + h * 0.6, a + w * (0.16 + u0 * 0.68), base + h); ctx.lineTo(a + w * (0.16 + u1 * 0.68), base + h); ctx.quadraticCurveTo(a + w * (0.3 + u1 * 0.4), base + h * 0.6, a + w * u1, base); ctx.closePath(); };
  P.add({ x0, x1, draw(ctx, env) {
    if (base + 160 < env.y0 || base > env.y1) return;
    const s = env.s, fine = s > 2.4;
    vis.length = 0; for (let i = 0; i < things.length; i++) { const th = things[i]; if (th.x + th.w + 60 >= env.x0 && th.x - 60 <= env.x1) vis.push(i); }
    // big shapes first, in two wall colours
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? c2 : c1; ctx.beginPath();
      for (let q = 0; q < vis.length; q++) { const i = vis[q], th = things[i], a = th.x, w = th.w, h = th.h;
        if (th.t === 'shed' && (i % 2 === 0) === !!pass) ctx.rect(a, base, w, h);
        else if (th.t === 'cool' && (i % 2 === 0) === !!pass) cool(ctx, a, w, h, 0, 1);
        else if (th.t === 'gas' && pass) { ctx.rect(a + 2, base, w - 4, h * 0.82); ctx.moveTo(a + w - 2, base + h * 0.82); ctx.ellipse(a + w / 2, base + h * 0.82, w / 2 - 2, h * 0.09, 0, 0, Math.PI); }
        else if (th.t === 'stack' && !pass) ydShape(ctx, [a, base, a + w * 0.3, base, a + w * 0.42, base + h, a + w * 0.28, base + h]); }
      ctx.fill();
    }
    // the dark side of each thing: lower walls, the shaded side of towers and holders
    ctx.fillStyle = cd; ctx.beginPath();
    for (let q = 0; q < vis.length; q++) { const th = things[vis[q]], a = th.x, w = th.w, h = th.h;
      if (th.t === 'shed') { ctx.rect(a, base, w, h * 0.3); if (fine) { for (let xx = a + 6; xx < a + w - 1; xx += 6) ctx.rect(xx, base + h * 0.3, 0.3, h * 0.7); ctx.rect(a + w * 0.42, base, 9, h * 0.52); } }
      else if (th.t === 'cool') cool(ctx, a, w, h, 0.74, 1);
      else if (th.t === 'gas') ctx.rect(a + 2 + (w - 4) * 0.76, base, (w - 4) * 0.24, h * 0.82); }
    ctx.fill();
    // the light side
    ctx.fillStyle = ch; ctx.beginPath();
    for (let q = 0; q < vis.length; q++) { const th = things[vis[q]], a = th.x, w = th.w, h = th.h; if (th.t === 'cool') cool(ctx, a, w, h, 0, 0.2); else if (th.t === 'gas') ctx.rect(a + 2, base, (w - 4) * 0.18, h * 0.82); }
    ctx.fill();
    // darkest: saw-tooth roofs, chimneys, pipe bridges, the legs under cooling towers
    ctx.fillStyle = c3; ctx.beginPath();
    for (let q = 0; q < vis.length; q++) { const th = things[vis[q]], a = th.x, w = th.w, h = th.h;
      if (th.t === 'shed') { const n = Math.max(2, Math.floor(w / 11)); for (let k = 0; k < n; k++) ydShape(ctx, [a + (k * w) / n, base + h, a + ((k + 1) * w) / n, base + h, a + ((k + 1) * w) / n, base + h + 5]); if (fine) { ctx.rect(a + w, base + h * 0.55, 40, 0.7); ctx.rect(a + w + 12, base, 0.8, h * 0.55); ctx.rect(a + w + 27, base, 0.8, h * 0.55); } }
      else if (th.t === 'stack') { ydShape(ctx, [a + w * 0.3, base, a + w, base, a + w * 0.72, base + h, a + w * 0.42, base + h]); if (s > 4) ctx.rect(a + w * 0.2, base + h * 0.7, w * 0.6, 0.5); }
      else if (th.t === 'cool' && fine) for (let k = 0; k < 12; k++) ctx.rect(a + 2 + (k * (w - 4)) / 12, base, (w - 4) / 24, 3.2); }
    ctx.fill();
    // lattice: gas holder frames and pylons with their wires
    ctx.strokeStyle = c3; ctx.lineWidth = Math.max(0.6, env.px); ctx.beginPath();
    for (let q = 0; q < vis.length; q++) { const th = things[vis[q]], a = th.x, w = th.w, h = th.h;
      if (th.t === 'gas') { for (let k = 0; k <= 6; k++) { ctx.moveTo(a + (k * w) / 6, base); ctx.lineTo(a + (k * w) / 6, base + h); } for (let k = 1; k <= 3; k++) { ctx.moveTo(a, base + (h * k) / 3); ctx.lineTo(a + w, base + (h * k) / 3); } if (s > 3) for (let k = 0; k < 6; k++) for (let j = 0; j < 3; j++) { ctx.moveTo(a + (k * w) / 6, base + (h * j) / 3); ctx.lineTo(a + ((k + 1) * w) / 6, base + (h * (j + 1)) / 3); } }
      else if (th.t === 'frame') { ctx.moveTo(a, base); ctx.lineTo(a + w * 0.4, base + h); ctx.moveTo(a + w, base); ctx.lineTo(a + w * 0.6, base + h);
        for (let k = 0; k < 5; k++) { const u0 = k / 5, u1 = (k + 1) / 5; ctx.moveTo(a + w * 0.4 * u0, base + h * u0); ctx.lineTo(a + w - w * 0.4 * u1, base + h * u1); ctx.moveTo(a + w - w * 0.4 * u0, base + h * u0); ctx.lineTo(a + w * 0.4 * u1, base + h * u1); }
        ctx.moveTo(a - w * 0.5, base + h * 0.88); ctx.lineTo(a + w * 1.5, base + h * 0.88); ctx.moveTo(a - w * 0.3, base + h * 0.7); ctx.lineTo(a + w * 1.3, base + h * 0.7);
        if (fine) for (const p of [[-0.5, 0.88], [1.5, 0.88], [-0.3, 0.7], [1.3, 0.7]]) { const sx = p[0] < 0.5 ? -1 : 1; ctx.moveTo(a + w * p[0], base + h * p[1]); ctx.quadraticCurveTo(a + w * p[0] + sx * 45, base + h * p[1] - 14, a + w * p[0] + sx * 90, base + h * p[1] - 6); } } }
    ctx.stroke();
    // red bands and winking lamps on the chimneys, lit windows and doors in the sheds
    ctx.fillStyle = redB; ctx.beginPath();
    for (let q = 0; q < vis.length; q++) { const th = things[vis[q]], a = th.x, w = th.w, h = th.h; if (th.t === 'stack') { ctx.rect(a + w * 0.26, base + h * 0.9, w * 0.48, h * 0.035); ctx.rect(a + w * 0.24, base + h * 0.8, w * 0.52, h * 0.035); } }
    ctx.fill();
    ctx.fillStyle = '#ff5a48'; ctx.beginPath();
    for (let q = 0; q < vis.length; q++) { const th = things[vis[q]]; if (th.t === 'stack' && Math.sin(env.t * 2.2 + th.ph * 6) > 0.2) { const r = Math.max(0.9, env.px * 1.6); ctx.moveTo(th.x + th.w / 2 + r, base + th.h + 1.2); ctx.arc(th.x + th.w / 2, base + th.h + 1.2, r, 0, TAU); } }
    ctx.fill();
    if (s > 0.25) { ctx.fillStyle = lit; ctx.beginPath(); for (let q = 0; q < vis.length; q++) { const i = vis[q], th = things[i]; if (th.t !== 'shed') continue; for (let k = 0; k < th.win.length; k++) ctx.rect(th.win[k][0], th.win[k][1], 3, 1.6); if (fine && dark > 0.25 && i % 3 === 0) ctx.rect(th.x + th.w * 0.42 + 1, base, 7, th.h * 0.3); } ctx.fill(); }
    // smoke and steam, leaning with the wind
    for (let q = 0; q < vis.length; q++) { const th = things[vis[q]];
      if (th.t === 'stack') ydSmoke(ctx, env, th.x + th.w / 2, base + th.h + 4, smokeCol, 5, 48, 4, 21, 0.035, dark > 0.5 ? 0.2 : 0.26, (env.wind || 0) * 26, th.ph);
      else if (th.t === 'cool') ydSmoke(ctx, env, th.x + th.w / 2, base + th.h + 4, steamCol, 4, 42, 10, 32, 0.03, dark > 0.5 ? 0.16 : 0.22, (env.wind || 0) * 18, th.ph); }
  } });
  return P;
};

// A line of telegraph poles with sagging wires, for something near the eye.
K.telegraph = function (S, P, xs, h, o) {
  o = o || {}; const y = o.y || 0, wood = S.tone('#2a2420', P), wire = S.tone('#121418', P), cup = S.tone('#9aa89a', P), can = S.tone('#3a3f47', P);
  const at = [[-1.2, -0.6], [1.2, -0.6], [-0.9, -1.4], [0.9, -1.4]];
  const birds = [[xs[0] + 9, 0], [xs[0] + 10.1, 0], [xs[0] + 13, 0], [xs[2] + 20, 1], [xs[2] + 21.3, 1], [xs[4] + 7, 0], [xs[4] + 30, 1], [xs[4] + 31, 1], [xs[4] + 32.4, 1]];
  P.add({ x0: xs[0] - 2, x1: xs[xs.length - 1] + 2, layer: 2, draw(ctx, env) {
    if (y + h + 1 < env.y0 || y > env.y1) return;
    const s = env.s, sway = Math.sin(env.t * 0.8) * 0.12 + (env.wind || 0) * 0.07;
    // poles and cross arms in one go, then (closer) braces and climbing steps
    ctx.fillStyle = wood; ctx.beginPath();
    for (let i = 0; i < xs.length; i++) { const x = xs[i]; if (x < env.x0 - 3 || x > env.x1 + 3) continue; ctx.rect(x - 0.12, y, 0.24, h); ctx.rect(x - 1.3, y + h - 0.68, 2.6, 0.16); ctx.rect(x - 1.0, y + h - 1.47, 2.0, 0.14); if (s > 5 && i % 3 === 1) ctx.rect(x + 0.14, y + h - 2.35, 0.72, 0.1); }
    ctx.fill();
    if (s > 5) {
      const pts = [];
      for (let i = 0; i < xs.length; i++) { const x = xs[i]; if (x < env.x0 - 3 || x > env.x1 + 3) continue; pts.push(x - 0.8, y + h - 0.6, x, y + h - 1.9, x + 0.8, y + h - 0.6, x, y + h - 1.9); if (s > 14) for (let yy = y + 2.4; yy < y + h - 3.6; yy += 0.6) pts.push(x - 0.3, yy, x + 0.3, yy); }
      if (pts.length) ydLines(ctx, env, pts, wood, 0.05);
      ctx.fillStyle = cup; ctx.beginPath(); for (let i = 0; i < xs.length; i++) { const x = xs[i]; if (x < env.x0 - 3 || x > env.x1 + 3) continue; for (let q = 0; q < 4; q++) ctx.rect(x + at[q][0] - 0.07, y + h + at[q][1] + 0.06, 0.14, 0.2); } ctx.fill();
      ctx.fillStyle = can; ctx.beginPath(); for (let i = 1; i < xs.length; i += 3) ctx.rect(xs[i] + 0.2, y + h - 3.4, 0.6, 1.1); ctx.fill();
    }
    ctx.strokeStyle = wire; ctx.lineWidth = Math.max(0.03, env.px * 0.7); ctx.beginPath();
    for (let i = 0; i < xs.length - 1; i++) { const x = xs[i]; if (xs[i + 1] < env.x0 || x > env.x1) continue; for (let q = 0; q < 4; q++) { ctx.moveTo(x + at[q][0], y + h + at[q][1] + 0.26); ctx.quadraticCurveTo((x + xs[i + 1]) / 2 + at[q][0] + sway, y + h + at[q][1] - 1.5, xs[i + 1] + at[q][0], y + h + at[q][1] + 0.26); } }
    ctx.stroke();
    if (s > 8) { // birds on the wire, shifting from foot to foot
      ctx.fillStyle = wire; ctx.beginPath();
      for (let b = 0; b < birds.length; b++) {
        const bx = birds[b][0]; if (bx < env.x0 - 1 || bx > env.x1 + 1) continue;
        let i = 0; while (i < xs.length - 2 && xs[i + 1] < bx) i++;
        const q = at[birds[b][1]], u = (bx - xs[i]) / (xs[i + 1] - xs[i]), wy = y + h + q[1] + 0.26 - 4 * u * (1 - u) * 0.88, hop = Math.max(0, Math.sin(env.t * 0.9 + b * 2.3) - 0.96) * 2.5;
        ctx.moveTo(bx + q[0] + 0.14, wy + 0.14 + hop); ctx.ellipse(bx + q[0], wy + 0.14 + hop, 0.14, 0.11, 0, 0, TAU); ctx.moveTo(bx + q[0] + 0.19, wy + 0.27 + hop); ctx.arc(bx + q[0] + 0.11, wy + 0.27 + hop, 0.08, 0, TAU); ctx.rect(bx + q[0] - 0.3, wy + 0.1 + hop, 0.18, 0.05);
      }
      ctx.fill();
    }
  } });
};

// ---- ground dressing ------------------------------------------------------------
// Things lying on a strip of open ground: puddles that hold the sky, wheel ruts,
// loose stone and weeds. All of it is flat, so nothing here can be taken for cover.
// depth is how far down the picture the strip runs before the next plane hides it.
function ydGround(S, P, o) {
  const y = o.y || 0, depth = o.depth || 1.2, gc = S.tone(o.col, P), T = (c) => S.tone(c, P);
  const hi = mix(gc, T(lighten(o.col, 0.09)), 0.5), lo = mix(gc, T(darken(o.col, 0.14)), 0.55), lo2 = T(darken(o.col, 0.3)), sky = mix(T(o.sky || S.pal.skyBot), gc, 0.62), skyHi = mix(T(o.sky || S.pal.skyBot), '#ffffff', 0.3), weedA = T(o.weedA || '#566a3c'), weedB = T(o.weedB || '#7d7748');
  const D = makeRng((o.seed || 1) * 131 + Math.round(P.z)), puddles = [], weeds = [], patches = [];
  const xa = o.x0 === undefined ? -130 : o.x0, xb = o.x1 === undefined ? 130 : o.x1, wet = o.puddles === undefined ? 1 : o.puddles;
  if (wet) for (let x = xa + D.r(2, 14); x < xb; x += D.r(9, 30) / wet) puddles.push([x, D.r(0.5, 2.1), D.r(0.2, 0.85)]);
  for (let x = xa; x < xb; x += D.r(1.5, 9)) weeds.push([x, D.r(0.12, 0.34), D.r(0.02, 0.9), D.f()]);
  for (let x = xa; x < xb; x += D.r(6, 22)) patches.push([x, D.r(3, 11), D.r(0.1, 0.8), D.chance(0.5)]);
  const ruts = o.ruts || [];
  P.add({ x0: xa - 12, x1: xb + 12, layer: 0, draw(ctx, env) {
    if (y + 0.5 < env.y0 || y - depth - 0.3 > env.y1) return;
    const s = env.s;
    // patches of darker cinder (with the wheel ruts) and of paler dust
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? hi : lo; ctx.beginPath();
      for (let i = 0; i < patches.length; i++) { const q = patches[i]; if (q[3] !== !!pass || q[0] + q[1] < env.x0 || q[0] - q[1] > env.x1) continue; ctx.moveTo(q[0] + q[1], y - depth * q[2]); ctx.ellipse(q[0], y - depth * q[2], q[1], depth * 0.14, 0, 0, TAU); }
      if (!pass) for (let i = 0; i < ruts.length; i++) { const r = ruts[i]; ctx.rect(r[0], y - depth * r[2] - 0.035, r[1] - r[0], 0.07); ctx.rect(r[0], y - depth * (r[2] + 0.13) - 0.04, r[1] - r[0], 0.08); }
      ctx.fill();
    }
    if (s > 2.4 && puddles.length) { // standing water: a dark rim, then the sky in it
      for (let pass = 0; pass < 2; pass++) {
        ctx.fillStyle = pass ? sky : lo2; ctx.beginPath();
        for (let i = 0; i < puddles.length; i++) { const q = puddles[i]; if (q[0] + q[1] < env.x0 - 1 || q[0] - q[1] > env.x1 + 1) continue; const py = y - depth * (0.18 + q[2] * 0.74), ry = Math.min(0.2, q[1] * 0.085), e = pass ? 0 : 0.1; ctx.moveTo(q[0] + q[1] + e, py); ctx.ellipse(q[0], py, q[1] + e, ry + e * 0.3, 0, 0, TAU); }
        ctx.fill();
      }
      if (s > 9) { ctx.fillStyle = skyHi; ctx.beginPath(); for (let i = 0; i < puddles.length; i++) { const q = puddles[i]; if (q[0] + q[1] < env.x0 || q[0] - q[1] > env.x1) continue; ctx.rect(q[0] - q[1] * 0.5, y - depth * (0.18 + q[2] * 0.74) + 0.02, q[1] * 0.7, Math.max(0.02, env.px)); } ctx.fill(); }
    }
    if (s > 30) { // loose cinders, once they are a pixel or two across
      ctx.fillStyle = hi; ctx.beginPath(); ydSpeck(ctx, env, xa, xb, y - Math.min(depth, 3), y - 0.03, 0.6, (o.seed || 1) + 3, 2, 0.045); ctx.fill();
      ctx.fillStyle = lo; ctx.beginPath(); ydSpeck(ctx, env, xa, xb, y - Math.min(depth, 3), y - 0.03, 0.6, (o.seed || 1) + 57, 2, 0.045); ctx.fill();
    }
    if (s > 14) {
      const lean = Math.sin(env.t * 1.3 + P.z) * 0.02 + (env.wind || 0) * 0.012;
      for (let pass = 0; pass < 2; pass++) {
        ctx.fillStyle = pass ? weedB : weedA; ctx.beginPath();
        for (let i = pass; i < weeds.length; i += 2) { const q = weeds[i]; if (q[0] < env.x0 - 1 || q[0] > env.x1 + 1) continue; ydTuft(ctx, q[0], y - depth * q[2], q[1], lean * (0.5 + q[3])); }
        ctx.fill();
      }
    }
  } });
}

// ---- the yard ---------------------------------------------------------------
// Tracks, from the shooter outward: a spare road, the NEAR running line, the
// service strip where people walk (the main plane), the FAR running line, a
// siding with parked wagons and the signal box, then the water tower and the
// engine sheds, and the works beyond.
SCN.yard = function (o) {
  o = o || {};
  const z = o.z || 450, sd = o.seed || 5;
  const S = makeScene({ time: o.time || 'dusk', weather: o.weather, seed: sd, refZ: z, exits: [-82, 82], bounds: { x0: -62, x1: 62, y0: -4, y1: 44 }, ambience: 'city', groundMat: 'dirt', sun: o.sun || [-58, 16] });
  const H = { S, z }, dusk = S.pal.dark > 0.25;
  K.skyline(S, z + 1900, { seed: 31 + sd, hMin: 40, hMax: 170, cols: ['#4c4660', '#574f6a', '#433d58'], groundCol: '#4a4654' });
  H.PI = K.industry(S, z + 820, { seed: sd });

  const PSh = H.PSh = S.plane(z + 124, 'sheds');
  K.ground(S, PSh, { col: '#55504e', noEdge: true });
  ydGround(S, PSh, { col: '#55504e', depth: 3.2, seed: 2, x0: -150, x1: 150 });
  K.engineShed(S, PSh, -96, 70, {}); K.engineShed(S, PSh, 30, 44, { h: 7.5, col: '#5e5248' });
  ydCoalTower(S, PSh, -22, 12, 13);
  K.track(S, PSh, {});

  const PW = H.PW = S.plane(z + 66, 'tower');
  K.ground(S, PW, { col: '#5a5450', noEdge: true }); ydGround(S, PW, { col: '#5a5450', depth: 2.0, seed: 3 }); K.track(S, PW, {});
  H.tank = K.yardTank(S, PW, o.tankX === undefined ? -34 : o.tankX, { text: 'P.C.R.' });
  K.wagons(S, PW, 6, ['hop', 'hop', 'hop'], { seed: 2 });
  K.floodlight(S, PW, -58, 19, 'tower', { id: 'fl_far1' }); K.floodlight(S, PW, 52, 19, 'tower', { id: 'fl_far2' });

  const PSd = H.PSd = S.plane(z + 32, 'siding');
  K.ground(S, PSd, { col: '#625b55', noEdge: true }); K.track(S, PSd, {});
  H.parked = K.wagons(S, PSd, -70, ['box', 'cont', 'box', 'tank'], { seed: 1 });
  H.box = K.signalBox(S, PSd, o.boxX === undefined ? 30 : o.boxX, {});
  K.box(S, PSd, 44, 0, 3.2, 1.5, '#3a3f47', { mat: 'hard' });
  H.sig = { near: { on: false }, far: { on: false } };

  const PT2 = H.PT2 = S.plane(z + 16, 'far line');
  K.ground(S, PT2, { col: '#69615a', noEdge: true }); K.track(S, PT2, {});
  K.railSignal(S, PT2, 22, 6.2, H.sig.far, { layer: 0 });

  const PM = H.PM = S.plane(z, 'strip');
  K.ground(S, PM, { col: '#746a60', edge: '#8d8377' });
  ydGround(S, PM, { col: '#746a60', depth: 1.2, seed: 1, x0: -110, x1: 110, ruts: [[19, 110, 0.22]] });
  const tm = (c, lit) => S.tone(c, PM, lit);
  // a boarded crossing where the cars pull up, behind anybody standing on the strip
  const cross = { wd: tm('#5a4a3a'), wd2: tm('#40342a') };
  PM.add({ x0: 14, x1: 24, layer: 0, draw(ctx, env) {
    if (0.2 < env.y0 || -1.3 > env.y1) return;
    poly(ctx, [15.2, 0, 22.8, 0, 23.4, -1.15, 14.6, -1.15], cross.wd);
    if (env.s > 5) { const pts = []; for (let i = 1; i < 5; i++) pts.push(15.2 - i * 0.12, -i * 0.23, 22.8 + i * 0.12, -i * 0.23); for (let xx = 16.5; xx < 22.5; xx += 1.5) pts.push(xx, 0, xx + (xx - 19) * 0.04, -1.15); ydLines(ctx, env, pts, cross.wd2, 0.035); }
  } });
  // the lamp hut stands in front of anyone passing behind it
  H.hut = { x0: -9.5, x1: -5.5 };
  K.box(S, PM, -9.5, 0, 4, 3.0, '#6a4a3e', { band: 0.35, layer: 2 }); P_roof(S, PM, -9.9, 3.0, 4.8, '#2c3038');
  const hut = { dk: tm('#2a2420'), frame: tm('#8a6a58'), warm: tm(dusk ? '#ffd98a' : S.pal.glass, true), brass: tm('#c9a23a'), broom: tm('#6b5440'), tx: tm('#e9e0c8') };
  PM.add({ x0: -9.5, x1: -5.5, layer: 2, draw(ctx, env) {
    if (3.2 < env.y0 || 0 > env.y1) return;
    const s = env.s;
    ctx.fillStyle = hut.frame; ctx.beginPath(); ctx.rect(-9.02, 0, 1.34, 2.22); ctx.rect(-7.32, 1.08, 1.34, 1.14); ctx.fill();
    R4(ctx, -7.2, 1.2, 1.1, 0.9, hut.warm);
    // the door, and (close up) hand lamps on the sill
    ctx.fillStyle = hut.dk; ctx.beginPath(); ctx.rect(-8.9, 0, 1.1, 2.1); if (s > 7) for (let i = 0; i < 3; i++) { ctx.rect(-7.05 + i * 0.3, 1.2, 0.16, 0.26); ctx.rect(-7.01 + i * 0.3, 1.46, 0.08, 0.08); } ctx.fill();
    if (s > 7) {
      ydLines(ctx, env, [-8.54, 0.05, -8.54, 2.05, -8.17, 0.05, -8.17, 2.05, -6.65, 1.2, -6.65, 2.1, -7.2, 1.65, -6.1, 1.65, -5.75, 0, -5.9, 1.7], hut.frame, 0.035);
      R4(ctx, -8.0, 1.0, 0.1, 0.18, hut.brass);
    }
    env.text(ctx, 'LAMPS', -7.5, 2.42, 0.34, hut.tx, 'center');
    if (dusk) ydGlow(ctx, -6.65, 1.5, 2.2, 1.6, '255,210,130', 0.18 * S.pal.dark + 0.05);
  } });
  K.box(S, PM, 10.2, 0, 1.6, 1.1, '#8a6a45', { mat: 'wood' }); K.box(S, PM, 10.5, 1.1, 1.1, 0.8, '#7a5c3c', { mat: 'wood' });
  K.box(S, PM, -30, 0, 2.2, 1.3, '#4a5560', { mat: 'hard', ribs: 0.4 });
  H.lamps = [K.floodlight(S, PM, -22, 11, 'west', { id: 'fl1', reach: 13 }), K.floodlight(S, PM, 8.4, 11, 'meet', { id: 'fl2', reach: 13 }), K.floodlight(S, PM, 40, 11, 'meet', { id: 'fl3', reach: 13 })];
  // buffer stop at the left end of the strip: two rail frames, a red beam and a lamp
  const buf = { iron: tm('#2a2e36'), red: tm('#c8372d'), white: tm('#e8e4d6') };
  PM.add({ x0: -48, x1: -42, layer: 0, draw(ctx, env) {
    if (2.2 < env.y0 || 0 > env.y1) return;
    const s = env.s;
    ctx.strokeStyle = buf.iron; ctx.lineWidth = Math.max(0.14, env.px); ctx.beginPath();
    ctx.moveTo(-46, 0); ctx.lineTo(-46, 1.5); ctx.moveTo(-44.2, 0); ctx.lineTo(-44.2, 1.5); ctx.moveTo(-46, 1.3); ctx.lineTo(-47.6, 0); ctx.moveTo(-44.2, 1.3); ctx.lineTo(-42.9, 0);
    if (s > 5) { ctx.moveTo(-46, 0.5); ctx.lineTo(-44.2, 0.5); ctx.lineTo(-46, 1.2); ctx.moveTo(-46, 0.5); ctx.lineTo(-44.2, 1.2); }
    ctx.stroke();
    R4(ctx, -46.4, 1.1, 2.9, 0.42, buf.red);
    if (s > 4) { ctx.fillStyle = buf.white; ctx.beginPath(); ctx.rect(-46.4, 1.1, 0.4, 0.42); ctx.rect(-43.9, 1.1, 0.4, 0.42); ctx.fill(); R4(ctx, -45.2, 1.52, 0.3, 0.34, buf.iron); circ(ctx, -45.05, 1.69, 0.1, '#ff4034'); if (dusk) ydGlow(ctx, -45.05, 1.69, 0.9, 0.9, '255,70,55', 0.5); }
  } });

  const PT1 = H.PT1 = S.plane(z - 18, 'near line');
  K.ground(S, PT1, { col: '#6c645c', noEdge: true }); K.track(S, PT1, {});
  K.railSignal(S, PT1, -31, 6.2, H.sig.near, { layer: 0 });

  const PT0 = H.PT0 = S.plane(z - 40, 'spare road');
  K.ground(S, PT0, { col: '#5f5850', noEdge: true }); ydGround(S, PT0, { col: '#5f5850', depth: 4.2, seed: 4, x0: -140, x1: 140, ruts: [[-140, 140, 0.72]] }); K.track(S, PT0, { ballast: '#5e5750' });
  // a spur off the spare road, ending at a stop block, and the lever that sets the points
  const sp = { rail: S.tone('#aeb3ba', PT0), tie: mix(S.tone('#33291f', PT0), S.tone('#5f5850', PT0), 0.3), iron: S.tone('#20242b', PT0), white: S.tone('#e8e4d6', PT0), red: S.tone('#c8372d', PT0) };
  PT0.add({ x0: -80, x1: 60, layer: 0, draw(ctx, env) {
    const s = env.s, yy = -2.0;
    if (0.2 < env.y0 || yy - 0.8 > env.y1) return;
    if (s > 2.6) { ctx.fillStyle = sp.tie; ctx.beginPath(); const b = Math.max(-58, Math.floor(env.x0 / 0.7) * 0.7); for (let x = b; x < Math.min(22, env.x1); x += 0.7) ctx.rect(x, yy - 0.5, 0.24, 0.56); ctx.fill(); }
    ctx.fillStyle = sp.rail; ctx.beginPath(); ctx.rect(-58, yy - 0.03, 80, Math.max(0.08, env.px)); ctx.rect(-58, yy - 0.45, 80, Math.max(0.07, env.px)); ctx.fill();
    // the two rails curve up to join the spare road
    ctx.strokeStyle = sp.rail; ctx.lineWidth = Math.max(0.08, env.px); ctx.beginPath(); ctx.moveTo(22, yy); ctx.bezierCurveTo(34, yy, 36, 0, 50, 0); ctx.moveTo(22, yy - 0.42); ctx.bezierCurveTo(36, yy - 0.42, 40, -0.44, 54, -0.44); ctx.stroke();
    // stop block, and the point lever with its target
    ctx.strokeStyle = sp.iron; ctx.lineWidth = Math.max(0.1, env.px); ctx.beginPath(); ctx.moveTo(-58, yy - 0.4); ctx.lineTo(-58, yy + 0.9); ctx.moveTo(-58, yy + 0.8); ctx.lineTo(-59.4, yy - 0.4); ctx.moveTo(55.8, -1.2); ctx.lineTo(56.3, -0.2); ctx.stroke();
    ctx.fillStyle = sp.red; ctx.beginPath(); ctx.rect(-58.3, yy + 0.55, 0.5, 0.36); ctx.rect(55.2, -1.25, 1.2, 0.14); ctx.fill();
    if (s > 4) { circ(ctx, 56.34, -0.1, 0.24, sp.white); R4(ctx, 56.1, -0.14, 0.48, 0.08, sp.red); }
  } });

  const PY = H.PY = S.plane(z - 92, 'fence');
  K.ground(S, PY, { col: '#4a4a44', noEdge: true });
  ydGround(S, PY, { col: '#4a4a44', depth: 7.8, seed: 5, x0: -150, x1: 150, ruts: [[-150, 150, 0.2], [-150, 150, 0.62]] });
  for (let fx = -120; fx < 120; fx += 24) K.fence(S, PY, fx, fx + 24, 2.3, { kind: 'mesh' }); // in lengths, so only those on screen are drawn
  // an old siding outside the fence, half buried and rusted, lying flat on the ground
  K.track(S, PY, { y: -3.6, ballast: '#56524c', rail: '#7a5a44' });
  K.box(S, PY, -44, 0, 6.1, 2.6, '#3f5a52', { ribs: 0.42, mat: 'hard' });

  K.box(S, PY, 18, 0, 2.4, 1.2, '#6b5440', { mat: 'wood' }); K.box(S, PY, 21, 0, 2.0, 2.0, '#4a5560', { mat: 'hard', ribs: 0.4 });
  K.parked(S, PY, 'truck', 44, -1, '#8a3b2a', { y: 0 });
  // a stack of old sleepers, a heap of rail, and warnings on the fence
  const st = { c: S.tone('#3a2f28', PY), c2: S.tone('#5a4a3c', PY), end: S.tone('#231c17', PY), rl: S.tone('#6a4832', PY), yel: S.tone('#e2b33c', PY), dk: S.tone('#15171c', PY) };
  PY.add({ x0: -30, x1: 6, layer: 0, draw(ctx, env) {
    if (1.4 < env.y0 || 0 > env.y1) return;
    for (let pass = 0; pass < 2; pass++) { ctx.fillStyle = pass ? st.c2 : st.c; ctx.beginPath(); for (let i = pass; i < 4; i += 2) for (let j = 0; j < 4 - i; j++) ctx.rect(-24 + j * 2.7 + i * 1.35, i * 0.28, 2.6, 0.24); ctx.fill(); }
    ctx.fillStyle = st.rl; ctx.beginPath(); for (let i = 0; i < 3; i++) ctx.rect(-9 + i * 0.3, i * 0.12, 9 - i * 0.6, 0.1); ctx.fill();
    if (env.s > 7) { ctx.fillStyle = st.end; ctx.beginPath(); for (let i = 0; i < 4; i++) for (let j = 0; j < 4 - i; j++) { const bx = -24 + j * 2.7 + i * 1.35; ctx.rect(bx, i * 0.28, 0.12, 0.24); ctx.rect(bx + 2.48, i * 0.28, 0.12, 0.24); } ctx.fill(); }
  } });
  PY.add({ x0: -70, x1: 80, layer: 2, draw(ctx, env) {
    if (env.s < 4 || 2 < env.y0 || 1 > env.y1) return;
    ctx.fillStyle = st.yel; ctx.beginPath(); for (const sx of [-63, -9, 63]) ctx.rect(sx - 0.55, 1.1, 1.1, 0.8); ctx.fill();
    if (env.s > 9) { ctx.strokeStyle = st.dk; ctx.lineWidth = Math.max(0.05, env.px * 0.7); ctx.beginPath(); for (const sx of [-63, -9, 63]) ctx.rect(sx - 0.44, 1.21, 0.88, 0.58); ctx.stroke(); for (const sx of [-63, -9, 63]) env.text(ctx, 'DANGER', sx, 1.4, 0.2, st.dk, 'center'); }
  } });

  const PN = H.PN = S.plane(z - 170, 'near');
  K.ground(S, PN, { col: '#3b4038', noEdge: true });
  ydGround(S, PN, { col: '#3b4038', depth: 14, seed: 6, x0: -170, x1: 170, ruts: [[-170, 170, 0.3], [-170, 170, 0.66]] });
  // warehouse roofs below the line of sight, for something close to the eye
  const roof = (x0, w, h, col) => { const c = S.tone(col, PN), c2 = S.tone(darken(col, 0.3), PN), c3 = S.tone(darken(col, 0.14), PN), hi = S.tone(lighten(col, 0.1), PN), lit = S.tone('#ffcf7a', PN, true), n = Math.max(2, Math.floor(w / 9)), k0 = Math.floor(x0);
    PN.add({ x0, x1: x0 + w, layer: 0, draw(ctx, env) {
      if (h + 3 < env.y0 || 0 > env.y1) return;
      const s = env.s, a0 = Math.max(x0, env.x0), a1 = Math.min(x0 + w, env.x1);
      R4(ctx, x0, 0, w, h, c);
      ctx.fillStyle = c3; ctx.beginPath(); ctx.rect(x0, 0, w, h * 0.35); if (s > 13) for (let xx = Math.max(x0, Math.floor(env.x0 / 0.5) * 0.5); xx < a1; xx += 0.5) ctx.rect(xx, h * 0.35, 0.06, h * 0.65 - 0.3); ctx.fill();
      // roof teeth, their vents, and the gutter
      ctx.fillStyle = c2; ctx.beginPath(); ctx.rect(x0, h - 0.3, w, 0.3);
      for (let k = 0; k < n; k++) { const a = x0 + (k * w) / n, b = x0 + ((k + 1) * w) / n; if (b < env.x0 || a > env.x1) continue; ydShape(ctx, [a, h, b, h, b, h + 2.3]); if (k % 2 === 0) ctx.rect(b - 0.7, h + 2.2, 0.5, 0.6); }
      ctx.fill();
      ctx.fillStyle = lit; ctx.beginPath(); for (let k = 0; k < n; k++) { const a = x0 + (k * w) / n, b = x0 + ((k + 1) * w) / n; if (b < env.x0 || a > env.x1 || (k + k0) % 3 !== 0) continue; ydShape(ctx, [a + 0.5, h + 0.1, b - 0.5, h + 2.0, b - 0.5, h + 0.1]); } ctx.fill();
      if (s > 6) { const pts = []; for (let k = 0; k < n; k++) { const a = x0 + (k * w) / n, b = x0 + ((k + 1) * w) / n; if (b < env.x0 || a > env.x1) continue; if ((k + k0) % 3 === 0) for (let q = 1; q < 5; q++) { const gx = a + 0.5 + (q * (b - a - 1)) / 5; pts.push(gx, h + 0.1, gx, h + 0.1 + 1.9 * (q / 5)); } else pts.push(a + (b - a) * 0.33, h, a + (b - a) * 0.33, h + 0.76, a + (b - a) * 0.66, h, a + (b - a) * 0.66, h + 1.52); } if (pts.length) ydLines(ctx, env, pts, c2, 0.05); }
      ctx.fillStyle = hi; ctx.beginPath(); ctx.rect(a0, h - 0.06, a1 - a0, 0.06); for (let k = 0; k < n; k += 2) ctx.rect(x0 + ((k + 1) * w) / n - 0.82, h + 2.75, 0.74, 0.14); ctx.fill();
    } });
    PN.solid(x0, 0, w, h, 'wall'); };
  roof(-150, 62, 4.2, '#4a4650'); roof(-80, 44, 3.4, '#54484a'); roof(22, 52, 4.0, '#463f4c'); roof(82, 70, 3.2, '#4c4a52');
  // in the gap between the warehouses: oil drums, a stack of old sleepers, a cable drum and
  // a platelayers' trolley. All of it is low and close to the eye, so it lies well below
  // the yard in the picture.
  const ydN = { drum: S.tone('#3f4a52', PN), drumR: S.tone('#7a3a2e', PN), band: S.tone('#2a2e36', PN), rust: S.tone('#6a4832', PN), tie: S.tone('#3a2f28', PN), tie2: S.tone('#4d3f33', PN), end: S.tone('#231c17', PN), reel: S.tone('#6b5440', PN), cable: S.tone('#1c1f26', PN), iron: S.tone('#20242b', PN), wheel: S.tone('#15171c', PN) };
  PN.add({ x0: -34, x1: 20, layer: 0, draw(ctx, env) {
    if (2.2 < env.y0 || 0 > env.y1) return;
    const s = env.s;
    // oil drums, one fallen on its side, with their hoops
    ctx.fillStyle = ydN.drum; ctx.beginPath(); ctx.rect(-30, 0, 0.6, 0.9); ctx.rect(-29.3, 0, 0.6, 0.9); ctx.fill();
    R4(ctx, -28.6, 0, 0.6, 0.9, ydN.drumR); ctx.fillStyle = ydN.drum; ctx.beginPath(); ctx.ellipse(-27.4, 0.3, 0.45, 0.3, 0, 0, TAU); ctx.fill();
    if (s > 4) { ctx.fillStyle = ydN.band; ctx.beginPath(); for (const dx of [-30, -29.3, -28.6]) { ctx.rect(dx, 0.28, 0.6, 0.05); ctx.rect(dx, 0.6, 0.6, 0.05); } ctx.fill(); ydStreaks(ctx, -30, -28.1, 0.9, 0.5, 41, 5, ydN.rust, 0.4); }
    // old sleepers, stacked crosswise
    for (let pass = 0; pass < 2; pass++) { ctx.fillStyle = pass ? ydN.tie2 : ydN.tie; ctx.beginPath(); for (let i = pass; i < 4; i += 2) for (let j = 0; j < 3 - (i >> 1); j++) ctx.rect(-18 + j * 2.7 + (i % 2) * 0.4, i * 0.26, 2.5, 0.23); ctx.fill(); }
    if (s > 6) { ctx.fillStyle = ydN.end; ctx.beginPath(); for (let i = 0; i < 4; i++) for (let j = 0; j < 3 - (i >> 1); j++) { const bx = -18 + j * 2.7 + (i % 2) * 0.4; ctx.rect(bx, i * 0.26, 0.1, 0.23); ctx.rect(bx + 2.4, i * 0.26, 0.1, 0.23); } ctx.fill(); }
    // a cable drum: two round cheeks, the wound cable between
    ctx.fillStyle = ydN.reel; ctx.beginPath(); ctx.arc(-4, 0.75, 0.75, 0, TAU); ctx.fill();
    R4(ctx, -4.75, 0.25, 1.5, 1.0, ydN.cable);
    if (s > 4) { ctx.strokeStyle = ydN.reel; ctx.lineWidth = Math.max(0.05, env.px); ctx.beginPath(); ctx.arc(-4, 0.75, 0.55, 0, TAU); ctx.moveTo(-4.75, 0.75); ctx.lineTo(-3.25, 0.75); ctx.stroke(); }
    // a platelayers' trolley: a flat deck on four small wheels, a push bar
    R4(ctx, 6, 0.35, 2.6, 0.14, ydN.reel);
    ctx.fillStyle = ydN.wheel; ctx.beginPath(); for (const wx of [6.4, 8.2]) { ctx.moveTo(wx + 0.2, 0.2); ctx.arc(wx, 0.2, 0.2, 0, TAU); } ctx.fill();
    if (s > 3) ydLines(ctx, env, [8.6, 0.45, 9.2, 1.3, 9.0, 1.3, 9.4, 1.3], ydN.iron, 0.05);
  } });
  K.telegraph(S, PN, [-150, -104, -58, -12, 34, 80, 126], 9.5);

  // placements
  H.strip = (x, extra) => Object.assign({ plane: PM, x, y: 0, zone: x < H.hut.x0 ? 'west' : 'meet', behind: false, room: null }, extra || {});
  H.siding = (x, extra) => Object.assign({ plane: PSd, x, y: 0, zone: 'siding', behind: false, room: null }, extra || {});
  H.inBox = (dx, extra) => H.box.at(H.box.x + H.box.w / 2 + (dx || 0), extra);

  // A freight train that runs through once. track is 'near' or 'far'.
  // Returns { veh, trig, t0, t1 }: put veh in the vehicle list and trig in the
  // trigger list. Noise cover lasts while any part of it is within 75 m of
  // the middle of the yard, from t0 to t1.
  H.train = function (q) {
    const P = q.track === 'near' ? PT1 : PT2, dir = q.dir || 1, sp = q.speed || 14, L = CARS.freight.len, run = 190 + L / 2;
    const veh = { id: q.id, kind: 'freight', plane: P, x: -dir * 900, y: 0, dir, col: q.col || '#3d5a80', routine: [], st: { glass: [], flat: [], moving: false, seed: q.seed || 0 } };
    const t0 = q.at + (190 - 75) / sp, t1 = q.at + (190 + L + 75) / sp, sg = H.sig[q.track === 'near' ? 'near' : 'far'];
    const trig = { at: Math.max(0, q.at - 7), do(sim) {
      sg.on = true;
      sim.after(q.at - sim.t, () => { const v = sim.byId[q.id]; v.x = -dir * run; v.gone = false; v.v = sp; v.routine = [['drive', dir * run, sp]]; v.pc = 0; v.goal = null; v.wait = 0; });
      sim.after(t0 - sim.t, () => sim.cover(t1 - t0, 'train'));
      sim.after(t1 - sim.t + 2, () => { sg.on = false; });
    } };
    // when is the spot x hidden by this train (only matters on the near line)
    const hides = (x) => [q.at + (190 + dir * x) / sp, q.at + (190 + L + dir * x) / sp];
    return { veh, trig, t0, t1, hides };
  };
  return H;
};

// a small pitched slate roof, drawn in front
function P_roof(S, P, x, y, w, col) {
  const c = S.tone(col, P), c2 = S.tone(lighten(col, 0.12), P), sh = S.tone('#14161a', P);
  P.add({ x0: x, x1: x + w, layer: 2, draw(ctx, env) {
    if (y + 1 < env.y0 || y - 0.2 > env.y1) return;
    ctx.fillStyle = c; ctx.beginPath(); ydShape(ctx, [x, y, x + w, y, x + w - 0.5, y + 0.9, x + 0.5, y + 0.9]); ctx.fill();
    if (env.s > 7) { R4(ctx, x + 0.4, y - 0.14, w - 0.8, 0.14, sh); ydLines(ctx, env, [x + 0.17, y + 0.3, x + w - 0.17, y + 0.3, x + 0.33, y + 0.6, x + w - 0.33, y + 0.6, x + 0.5, y + 0.9, x + w - 0.5, y + 0.9], c2, 0.03); }
  } });
}

// ---- a tin lock-up with its shutter half up (c5m8) --------------------------------------------
// A corrugated-iron lock-up on the service strip, lit inside. Its roller shutter, side walls and
// roof hang on a cover plane (K.coverPlane) just in front of the strip, so a round meets them
// first. They are 'thin': only armour-piercing rounds go through. Whoever is inside is an
// ordinary person on the strip behind, hidden above the bottom edge of the shutter. Below it the
// lit floor shows, and their shoes, and the hem of a long coat or a skirt. A brick back wall on
// the strip stops a round that has gone through somebody.
//   H        the yard handles (uses H.PM, H.z)
//   o.eye    the shooting position; o.x0, o.x1 the ends of the lock-up; o.gap height of the
//            shutter's bottom edge
//   o.sim()  returns the running simulation, or null: the bulb inside throws the legs of whoever
//            stands in there as long shadows out across the lit ground in front (picture only)
// Returns { C, x0, x1, s0, s1, gap, inside(x, extra) } where s0 and s1 are the shutter's ends and
// inside() is a placement on the floor (zone 'lockup', which is lit).
K.lockUp = function (S, H, o) {
  o = o || {};
  const PM = H.PM, x0 = o.x0 === undefined ? 24 : o.x0, x1 = o.x1 === undefined ? 30.4 : o.x1, gap = o.gap || 0.62, s0 = x0 + 0.5, s1 = x1 - 0.5, sTop = 2.35, hTop = 2.62, rTop = 2.86;
  const C = K.coverPlane(S, PM, H.z - 0.9, o.eye || [0, 30, 0]);
  S.litZones.lockup = true;
  const T = (c, lit) => S.tone(c, PM, lit), night = S.pal.dark > 0.3;
  const tin = T('#6f7a78'), tinD = T('#56605f'), tinL = T('#8d9896'), rust = T('#7a4a2a'), slat = T('#7d8584'), slatD = T('#5e6665'), rail = T('#2a2e36'), roofC = T('#4a4f55'), roofL = T('#646a70'), paint = T('#e8e2cc');
  const edgeC = mix(T('#c9d0d2'), T('#c9d0d2', true), 0.35), shutC = mix(T('#9aa3a2'), T('#9aa3a2', true), 0.25);
  const warm = T('#e7b46a', true), warmD = T('#a7743e', true), floorC = T('#8a6f52', true), wallIn = T('#4a3a2c', true), wood = T('#6b5038', true), woodD = T('#4a3626', true), cable = T('#15171b'), heat = '#ff8a3a';
  // inside, on the strip itself: only the bottom of it is ever seen, under the shutter
  PM.add({ x0: x0, x1: x1, layer: 0, draw(ctx, env) {
    if (gap + 0.4 < env.y0 || -0.3 > env.y1) return;
    const s = env.s;
    R4(ctx, s0, 0, s1 - s0, gap + 0.3, wallIn); R4(ctx, s0, -0.06, s1 - s0, 0.07, floorC);
    // light spilling across the floor from the bulb above, brightest in the middle
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55; kxSpillAt(ctx, kxSpill('#ffcf8a'), s0, 0, s1 - s0, gap + 0.3, 1); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // the bench legs and its cross bar, a crate, a cable across the floor, a paraffin heater
    ctx.fillStyle = wood; ctx.beginPath(); ctx.rect(x0 + 1.25, 0, 0.07, gap + 0.3); ctx.rect(x0 + 3.55, 0, 0.07, gap + 0.3); ctx.rect(x0 + 1.25, 0.22, 2.37, 0.05); ctx.rect(x1 - 1.75, 0, 0.7, 0.46); ctx.fill();
    if (s > 6) { ctx.fillStyle = woodD; ctx.beginPath(); ctx.rect(x1 - 1.75, 0.2, 0.7, 0.04); ctx.rect(x1 - 1.42, 0, 0.04, 0.46); ctx.fill(); }
    if (s > 4) { ctx.strokeStyle = cable; ctx.lineWidth = Math.max(0.025, env.px * 0.7); ctx.beginPath(); ctx.moveTo(x0 + 1.6, gap + 0.3); ctx.quadraticCurveTo(x0 + 1.9, 0.02, x0 + 2.8, 0.02); ctx.quadraticCurveTo(x0 + 3.9, 0.02, x1 - 1.3, 0.46); ctx.stroke(); }
    R4(ctx, x1 - 0.95, 0, 0.3, 0.42, T('#3a3f47')); circ(ctx, x1 - 0.8, 0.28, 0.08, heat);
    if (night) ydGlow(ctx, x1 - 0.8, 0.28, 0.5, 0.4, '255,140,60', 0.35);
  } });
  // the brick back wall: a round that has gone through somebody stops here
  PM.solid(s0, 0, s1 - s0, hTop, 'wall');
  // the front: tin walls, the shutter, its housing, the roof, and the light that gets out under it
  const ribs = []; for (let x = x0 + 0.06; x < s0 - 0.02; x += 0.11) ribs.push(x); for (let x = s1 + 0.05; x < x1 - 0.02; x += 0.11) ribs.push(x);
  const D = makeRng(Math.floor(x0 * 17) + 5113), streaks = []; for (let i = 0; i < 7; i++) streaks.push([D.r(x0 + 0.1, x1 - 0.1), D.r(0.3, 1.1), D.r(0.03, 0.07)]);
  C.add(x0 - 2, x1 + 2, 2, (ctx, env) => {
    if (rTop + 0.4 < env.y0 || -1 > env.y1) return;
    const s = env.s, fine = s > 12, low = s < 14, px = env.px;
    // the warm light under the shutter, out across the ground in front (stronger at low zoom, where
    // the bright slot under the shutter is the thing the eye finds first)
    if (night && s > 2) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = low ? 0.42 : 0.28; kxSpillAt(ctx, kxSpill('#ffcf8a'), s0, -0.42, s1 - s0, 0.42, 0.6); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    // the shadows of the legs inside, thrown out across that light by the bulb above them
    const sim = o.sim && o.sim();
    if (night && sim && s > 2.5) {
      ctx.fillStyle = 'rgba(12,10,8,0.5)'; ctx.beginPath();
      for (let i = 0; i < sim.actors.length; i++) { const a = sim.actors[i]; if (a.zone !== 'lockup' || a.hidden || a.gone || a.plane !== PM) continue;
        const sw = Math.max(0.09, px * 1.2), mid = (s0 + s1) / 2; for (const dx of [-0.07, 0.07]) { const fx = a.x + dx, lean = (fx - mid) * 0.12; ctx.moveTo(fx - sw / 2, -0.01); ctx.lineTo(fx + sw / 2, -0.01); ctx.lineTo(fx + sw * 0.9 + lean, -0.4); ctx.lineTo(fx - sw * 0.9 + lean, -0.4); ctx.closePath(); } }
      ctx.fill();
    }
    // tin walls either side of the shutter, ribbed
    ctx.fillStyle = tin; ctx.fillRect(x0, 0, s0 - x0, hTop); ctx.fillRect(s1, 0, x1 - s1, hTop);
    if (s > 3) { ctx.fillStyle = tinD; ctx.beginPath(); for (let i = 0; i < ribs.length; i++) ctx.rect(ribs[i], 0, Math.max(0.025, env.px * 0.7), hTop); ctx.fill(); }
    if (fine) { ctx.fillStyle = tinL; ctx.beginPath(); for (let i = 0; i < ribs.length; i++) ctx.rect(ribs[i] + 0.035, 0, 0.02, hTop); ctx.fill(); }
    // the shutter: horizontal slats, a heavier bottom rail with a handle and an open padlock, guide rails
    ctx.fillStyle = slat; ctx.fillRect(s0, gap, s1 - s0, sTop - gap);
    if (s > 3) { ctx.fillStyle = slatD; ctx.beginPath(); for (let y = gap + 0.09; y < sTop; y += 0.085) ctx.rect(s0, y, s1 - s0, Math.max(0.018, env.px * 0.7)); ctx.fill(); }
    if (fine) { ctx.fillStyle = tinL; ctx.globalAlpha = 0.5; ctx.beginPath(); for (let y = gap + 0.11; y < sTop; y += 0.085) ctx.rect(s0, y, s1 - s0, 0.012); ctx.fill(); ctx.globalAlpha = 1; }
    R4(ctx, s0, gap, s1 - s0, 0.08, rail);
    if (s > 5) { R4(ctx, (s0 + s1) / 2 - 0.2, gap + 0.025, 0.4, 0.03, tinL); ctx.strokeStyle = T('#b89a4a'); ctx.lineWidth = Math.max(0.02, env.px * 0.6); ctx.beginPath(); ctx.arc(s0 + 0.5, gap - 0.04, 0.045, 0, Math.PI, true); ctx.stroke(); R4(ctx, s0 + 0.45, gap - 0.11, 0.1, 0.08, T('#b89a4a')); }
    R4(ctx, s0 - 0.06, 0, 0.08, sTop, rail); R4(ctx, s1 - 0.02, 0, 0.08, sTop, rail);
    if (low) { // at low zoom: the shutter's edges and the box's corners catch the yard lights
      const e = Math.max(0.03, px * 0.9); ctx.fillStyle = edgeC; ctx.beginPath();
      ctx.rect(s0, sTop - e, s1 - s0, e); ctx.rect(s0 + 0.02, gap + 0.08, e, sTop - gap - 0.08); ctx.rect(s1 - 0.02 - e, gap + 0.08, e, sTop - gap - 0.08);
      ctx.rect(x0, 0, e, hTop); ctx.rect(x1 - e, 0, e, hTop); ctx.fill();
      ctx.fillStyle = shutC; ctx.globalAlpha = 0.5; ctx.fillRect(s0 + 0.02 + e, gap + 0.08, s1 - s0 - 0.04 - 2 * e, sTop - gap - 0.08 - e); ctx.globalAlpha = 1;
    }
    // rust running down from the top, and the yard's painted number
    if (s > 5) { ctx.fillStyle = rust; ctx.globalAlpha = 0.4; ctx.beginPath(); for (let i = 0; i < streaks.length; i++) { const q = streaks[i]; ctx.moveTo(q[0] - q[2], hTop); ctx.lineTo(q[0] + q[2], hTop); ctx.lineTo(q[0] + q[2] * 0.2, hTop - q[1]); ctx.closePath(); } ctx.fill(); ctx.globalAlpha = 1; }
    env.text(ctx, '7', x0 + 0.25, 1.35, 0.42, paint, 'center');
    // the shutter housing and a tin roof with an overhang and a gutter
    R4(ctx, x0, sTop, x1 - x0, hTop - sTop, tinD);
    ctx.fillStyle = roofC; ctx.beginPath(); ctx.moveTo(x0 - 0.3, hTop); ctx.lineTo(x1 + 0.3, hTop); ctx.lineTo(x1 + 0.1, rTop); ctx.lineTo(x0 - 0.1, rTop); ctx.closePath(); ctx.fill();
    if (s > 5) R4(ctx, x0 - 0.3, hTop - 0.07, x1 - x0 + 0.6, 0.07, rail);
    ctx.fillStyle = low ? edgeC : roofL; ctx.fillRect(x0 - 0.1, rTop - Math.max(0.04, px * 0.9), x1 - x0 + 0.2, Math.max(0.04, px * 0.9));   // the roof edge, lit
    // light leaking at the shutter's ends, where the guides do not quite meet it
    if (night && s > 4) { ydGlow(ctx, s0, gap * 0.5, 0.25, gap * 0.7, '255,207,138', 0.35); ydGlow(ctx, s1, gap * 0.5, 0.25, gap * 0.7, '255,207,138', 0.35); }
  });
  // tin all round, except the gap under the shutter
  C.solid(x0, 0, s0 - x0, rTop, 'thin'); C.solid(s1, 0, x1 - s1, rTop, 'thin'); C.solid(s0, gap, s1 - s0, rTop - gap, 'thin');
  return { C, x0, x1, s0, s1, gap,
    inside: (x, extra) => Object.assign({ plane: PM, x, y: 0, zone: 'lockup', room: null, behind: false }, extra || {}) };
};
