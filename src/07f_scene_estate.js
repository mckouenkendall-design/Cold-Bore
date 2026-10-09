// ---------------------------------------------------------------------------
// The estate: a walled villa in the hills above Port Calder.
//
// By day it hosts a garden party. By night it is the Ledger's safehouse.
// From the shooter outward: an olive grove, the front wall and gate, a verge
// with low hedges, the gravel drive (cars), the garden itself (the main plane:
// pool on the left, terrace in the middle, rose walk on the right), the house
// with its garage and glasshouse, a back tower with the radio dish, the rear
// wall and its cypresses, and the hills.
//
// Everything added for looks only sits on surfaces, on the ground, or behind
// the people on its plane. The helpers ydHash, ydGlow, ydPool, ydLines and
// ydShape come from the railway yard file, which is loaded first.
// ---------------------------------------------------------------------------

// Which side the light comes from: -1 when the sun (or the moon) is on the left.
function esSide(S) { return S.sky.sun[0] < 0 ? -1 : 1; }
// A smooth, never-repeating wobble between -1 and 1, for flames and flicker.
function esWob(t, k) { return (Math.sin(t * 7.3 + k * 1.9) * 0.5 + Math.sin(t * 12.7 + k * 4.3) * 0.3 + Math.sin(t * 3.1 + k * 0.7) * 0.2); }
// A light seen in wet ground or rippled water: a column of short bright dashes under it
// that waver, widen and fade as they come toward us. rgb is 'r,g,b'.
function esShimmer(ctx, env, x, y, depth, rgb, a, w0) {
  if (a <= 0.01) return;
  const n = Math.max(3, Math.min(9, Math.round(depth / 0.13))), st = depth / n, th = Math.max(st * 0.5, env.px * 1.2), t = env.t;
  // the nearer dashes are fainter: three groups, each filled at once
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(' + rgb + ',1)';
  for (let g = 0; g < 3; g++) {
    ctx.globalAlpha = a * (1 - g * 0.3); ctx.beginPath();
    for (let i = g; i < n; i += 3) { const u = i / n, ww = w0 * (1 + u * 0.8) * (0.6 + 0.4 * Math.sin(t * 2.3 + i * 1.7)) * (1 - u * 0.5); ctx.rect(x - ww / 2 + Math.sin(t * 1.7 + i * 2.1) * 0.05 * (1 + i * 0.3), y - 0.06 - i * st - th, ww, th); }
    ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
// Adds an ellipse to the current path (no rotation).
function esEll(ctx, x, y, rx, ry) { ctx.moveTo(x + rx, y); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); }

// ---- trees and hedges --------------------------------------------------------

// Fill a shape that never changes. Where the browser can keep a shape (Path2D), it is
// built once and kept in cache[key]; otherwise it is built again each time. build(p)
// adds the shape to p, which is either the kept shape or the context itself.
const ES_P2D = typeof Path2D !== 'undefined';
function esFill(ctx, cache, key, col, build) {
  ctx.fillStyle = col;
  if (ES_P2D) { let p = cache[key]; if (!p) { p = cache[key] = new Path2D(); build(p); } ctx.fill(p); }
  else { ctx.beginPath(); build(ctx); ctx.fill(); }
}
// The same for thin lines; build(p) adds them as moveTo/lineTo pairs.
function esStroke(ctx, env, cache, key, col, w, build) {
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(w, env.px * 0.8);
  if (ES_P2D) { let p = cache[key]; if (!p) { p = cache[key] = new Path2D(); build(p); } ctx.stroke(p); }
  else { ctx.beginPath(); build(ctx); ctx.stroke(); }
}
// Adds a flat list of segments [x1, y1, x2, y2, ...] to a path.
function esSegs(p, pts) { for (let i = 0; i < pts.length; i += 4) { p.moveTo(pts[i], pts[i + 1]); p.lineTo(pts[i + 2], pts[i + 3]); } }

// How wide a cypress is at a height (as a fraction of the tree), as a fraction of its width.
function esCypProf(v) { return v < 0.3 ? lerp(0.84, 0.94, v / 0.3) : 0.94 * Math.pow(Math.max(0, (1 - v) / 0.7), 0.65); }
// The outline of a cypress: up the left side and down the right, with a gentle bump
// for each spray of foliage. L and R hold [height fraction, half width] pairs.
function esCypPath(p, L, R, x, y, h, hw, lobes) {
  const X = (u) => x + u * hw;
  p.moveTo(X(-L[0][1]), y + L[0][0] * h);
  for (let k = 1; k < L.length; k++) { const a = L[k - 1], b = L[k], vm = (a[0] + b[0]) / 2; if (lobes) p.quadraticCurveTo(X(-(a[1] + b[1]) / 2 - 0.14 * esCypProf(vm)), y + vm * h, X(-b[1]), y + b[0] * h); else p.lineTo(X(-b[1]), y + b[0] * h); }
  for (let k = R.length - 1; k > 0; k--) { const a = R[k], b = R[k - 1], vm = (a[0] + b[0]) / 2; if (lobes) p.quadraticCurveTo(X((a[1] + b[1]) / 2 + 0.14 * esCypProf(vm)), y + vm * h, X(b[1]), y + b[0] * h); else p.lineTo(X(b[1]), y + b[0] * h); }
  p.closePath();
}

// A tall, narrow cypress. The foliage hides what is behind it but does not
// stop a bullet; the trunk does. It is built of sprays of foliage, lit on the
// side the light comes from, and it leans a little in the wind. Its shapes are
// worked out once; each frame they are only leaned and filled.
K.cypress = function (S, P, x, h, o) {
  o = o || {}; const y = o.y || 0, w = o.w || h * 0.2, hw = w / 2, base = o.col || '#25432f', base2 = o.col2 || '#1b3324';
  const c = S.tone(base, P), c2 = S.tone(base2, P), hi = S.tone(lighten(base, 0.2), P), hi2 = S.tone(lighten(base, 0.1), P), lo = S.tone(darken(base2, 0.32), P), bark = S.tone('#3a2c22', P), barkHi = S.tone('#5a4636', P);
  const side = esSide(S), D = makeRng(Math.round(x * 17 + h * 31) + 4409), N = 14;
  const L = [], R = [];
  for (let k = 0; k <= N; k++) { const v = 0.08 + (0.92 * k) / N, p = esCypProf(v); L.push([v, p * (k % 2 ? 1.06 : 0.96) * D.r(0.96, 1.04)]); R.push([v, p * (k % 2 ? 0.96 : 1.06) * D.r(0.96, 1.04)]); }
  // sprays of foliage inside the outline: [across, -1 to 1; up, 0 to 1; size]
  const tufts = []; for (let i = 0; i < 20; i++) { const v = 0.11 + (0.82 * (i + D.f())) / 20; tufts.push([D.r(-0.92, 0.92), v, D.r(0.6, 1.1)]); }
  const rx = hw * 0.42, ry = h * 0.034, cache = {};
  // one spray: a flat, pointed lens of six corners (cheaper to fill than an ellipse)
  const spray = (p, X, Y, a, b) => ydShape(p, [X - a, Y, X - a * 0.4, Y + b, X + a * 0.5, Y + b * 0.9, X + a, Y + b * 0.1, X + a * 0.3, Y - b * 0.8, X - a * 0.5, Y - b * 0.7]);
  const S0 = side > 0 ? L : R, sg = side > 0 ? -1 : 1;
  const shade = (p) => { p.moveTo(x + side * 0.12 * hw, y + S0[0][0] * h); for (let k = 1; k < S0.length; k++) p.lineTo(x + (side * 0.12 * (1 - S0[k][0]) + sg * 0.05 * Math.sin(k * 2.1)) * hw, y + S0[k][0] * h); for (let k = S0.length - 1; k >= 0; k--) p.lineTo(x + sg * S0[k][1] * hw, y + S0[k][0] * h); p.closePath(); };
  // which 0: the deep sprays on the shaded side (and, near, the hollow under each lit one); 1: the lit sprays
  const sprays = (which, near) => (p) => { for (let i = 0; i < tufts.length; i++) { const q = tufts[i], u = q[0] * esCypProf(q[1]) * 0.8, lit = u * side > 0.05, X = x + u * hw, Y = y + q[1] * h;
    if (which === 0) { if (!lit) spray(p, X, Y - ry * 0.2, rx * q[2], ry * q[2]); else if (near) spray(p, X, Y - ry * 0.9, rx * q[2] * 0.8, ry * q[2] * 0.6); }
    else if (lit && (near || i % 2 === 0)) spray(p, X - (i % 2 ? 0.1 * rx : 0), Y + (i % 2 ? 0.3 * ry : 0), rx * q[2] * (i % 2 ? 0.8 : 1), ry * q[2] * (i % 2 ? 0.8 : 1)); } };
  P.add({ x0: x - w, x1: x + w, layer: o.layer === undefined ? 0 : o.layer, draw(ctx, env) {
    if (y + h + 1 < env.y0 || y > env.y1) return;
    const s = env.s, k = (Math.sin(env.t * 0.8 + x) * 0.012 * (0.4 + Math.abs(env.wind || 0) * 0.15)) * 0.7;
    // the trunk, flaring where it meets the ground
    ctx.fillStyle = bark; ctx.beginPath(); ydShape(ctx, [x - 0.24, y, x + 0.24, y, x + 0.12, y + 0.3, x + 0.11, y + h * 0.14, x - 0.11, y + h * 0.14, x - 0.12, y + 0.3]); ctx.fill();
    if (s > 6) R4(ctx, x - side * 0.08 - 0.03, y + 0.2, 0.06, h * 0.1, barkHi);
    // the crown leans with the wind: everything above the foot slides over in proportion
    ctx.transform(1, 0, k, 1, -k * y, 0);
    const lobes = s > 2.5;
    esFill(ctx, cache, lobes ? 'b1' : 'b0', c, (p) => esCypPath(p, L, R, x, y, h, hw, lobes));
    esFill(ctx, cache, 'sh', c2, shade);
    if (hw * s >= 5) { const near = s > 8; esFill(ctx, cache, near ? 'l1' : 'l0', lo, sprays(0, near)); esFill(ctx, cache, near ? 'h1' : 'h0', near ? hi2 : hi, sprays(1, near)); }
    ctx.transform(1, 0, -k, 1, k * y, 0);
  } });
  if (o.solid !== false) { P.solid(x - 0.12, y, 0.24, h * 0.14, 'wood'); P.solid(x - w * 0.5, y + h * 0.08, w, h * 0.8, 'leaf'); }
};

// A clipped hedge. Bullets pass through leaves. The top is clipped but never quite
// straight, the face is made of small clumps of leaves, the foot is in shade, and a
// hedge with flowers carries them in little clusters. Its shapes are worked out once.
K.hedge = function (S, P, x0, x1, h, o) {
  o = o || {}; const y = o.y || 0, base = o.col || '#3f6a3c';
  const c = S.tone(base, P), top = S.tone(lighten(base, 0.14), P), dk = S.tone(darken(base, 0.24), P), hi = S.tone(lighten(base, 0.12), P), lo = S.tone(darken(base, 0.17), P), shadow = S.tone('#1c2618', P), soil = S.tone('#3a2e24', P);
  const fc = o.flowers ? o.flowers.map((q) => S.tone(q, P)) : null, eyeC = S.tone('#f4d35e', P), side = esSide(S);
  const len = x1 - x0, nb = Math.max(2, Math.round(len / 0.55)), D = makeRng(Math.round(x0 * 13 + x1 * 7 + h * 101) + 911);
  const bumps = []; for (let i = 0; i <= nb; i++) bumps.push(D.r(-0.05, 0.06));
  const fl = []; if (fc) for (let x = x0 + D.r(0.2, 0.6); x < x1 - 0.2; x += D.r(0.4, 0.95)) fl.push([x, D.r(0.3, 0.9), D.i(0, fc.length - 1), D.r(0.7, 1.25)]);
  const sd = Math.round(x0 * 3 + h * 17) & 1023, st = len / nb, cache = {}, r = Math.min(0.12, h * 0.13);
  const topAt = (i) => y + h + bumps[clamp(i, 0, nb)];
  // the hedge is kept in pieces about twelve metres long; i0..i1 are the stretches of top in a piece
  const CH = Math.max(1, Math.round(12 / st)), nch = Math.ceil(nb / CH);
  const body = (i0, i1) => (p) => { const xa = x0 + i0 * st, xb = x0 + i1 * st; p.moveTo(xa, y); p.lineTo(xa, topAt(i0)); for (let i = i0 + 1; i <= i1; i++) { const xx = x0 + i * st; p.quadraticCurveTo(xx - st / 2, (topAt(i - 1) + topAt(i)) / 2 + 0.05, xx, topAt(i)); } p.lineTo(xb, y); p.closePath(); };
  const foot = (i0, i1) => (p) => { p.moveTo(x0 + i0 * st, y); for (let i = i0; i <= i1; i++) p.lineTo(x0 + i * st, y + h * (0.24 + bumps[i] * 1.6)); p.lineTo(x0 + i1 * st, y); p.closePath(); };
  const lip = (i0, i1) => (p) => { for (let i = i0; i < i1; i++) p.rect(x0 + i * st, topAt(i) - 0.1, st, 0.1); };
  const clumps = (i0, i1, pass) => (p) => { const cell = 0.34, xa = x0 + i0 * st, xb = x0 + i1 * st, c0 = Math.floor(xa / cell), c1 = Math.floor(xb / cell);
    for (let ci = c0; ci <= c1; ci++) for (let j = 0; j < 3; j++) { const u = ydHash(ci, sd + j * 7 + pass * 31), v = ydHash(ci + 77, sd + j * 13 + pass * 17), xx = (ci + u) * cell; if (xx < Math.max(xa, x0 + 0.1) || xx >= Math.min(xb, x1 - 0.1)) continue;
      esEll(p, xx + (pass ? -side : side) * 0.02, pass ? y + h * (0.55 + v * 0.38) : y + h * (0.12 + v * 0.6), r * (0.8 + u * 0.6), r * 0.6); } };
  const flowers = (i0, i1, k, near) => (p) => { const xa = x0 + i0 * st, xb = x0 + i1 * st; for (let i = 0; i < fl.length; i++) { const q = fl[i]; if (q[2] !== k || q[0] < xa || q[0] >= xb) continue; const fy = y + h * q[1];
    if (near) for (let j = 0; j < 4; j++) esEll(p, q[0] + Math.cos(j * 1.7 + i) * 0.12 * q[3], fy + Math.sin(j * 1.7 + i) * 0.08 * q[3], 0.07, 0.07); else esEll(p, q[0], fy, 0.14 * q[3], 0.12 * q[3]); } };
  const eyes = (i0, i1) => (p) => { const xa = x0 + i0 * st, xb = x0 + i1 * st; for (let i = 0; i < fl.length; i++) { const q = fl[i]; if (q[0] < xa || q[0] >= xb) continue; for (let j = 0; j < 4; j++) esEll(p, q[0] + Math.cos(j * 1.7 + i) * 0.12 * q[3], y + h * q[1] + Math.sin(j * 1.7 + i) * 0.08 * q[3], 0.025, 0.025); } };
  P.add({ x0: x0 - 0.3, x1: x1 + 0.3, layer: o.layer || 0, draw(ctx, env) {
    if (y + h + 0.3 < env.y0 || y - 0.3 > env.y1) return;
    const s = env.s, a = Math.max(x0, env.x0 - 1), b = Math.min(x1, env.x1 + 1); if (b <= a) return;
    // its shadow on the ground in front, and a strip of bare soil at the foot
    ctx.globalAlpha = 0.5; R4(ctx, a - 0.1, y - 0.16, b - a + 0.2, 0.16, shadow); ctx.globalAlpha = 1;
    if (s > 4) R4(ctx, a, y - 0.04, b - a, 0.06, soil);
    // piece by piece: the body with its uneven clipped top, light along the top, shade low
    // down, clumps of leaves, and flowers in clusters (each with a pale eye when close)
    // each detail only once it is big enough to see: clumps over about 1.6 pixels, flowers over one
    const k0 = Math.max(0, Math.floor((a - x0) / (st * CH))), k1 = Math.min(nch - 1, Math.floor((b - x0) / (st * CH))), near = s > 18, leaves = r * s > 1.6, blooms = s > 7;
    for (let kk = k0; kk <= k1; kk++) {
      const i0 = kk * CH, i1 = Math.min(nb, i0 + CH), key = kk + ':';
      esFill(ctx, cache, key + 'b', c, body(i0, i1));
      if (s > 1.5) esFill(ctx, cache, key + 't', top, lip(i0, i1));
      esFill(ctx, cache, key + 'f', dk, foot(i0, i1));
      if (leaves) { esFill(ctx, cache, key + 'c0', lo, clumps(i0, i1, 0)); esFill(ctx, cache, key + 'c1', hi, clumps(i0, i1, 1)); }
      if (fl.length && blooms) { for (let k = 0; k < fc.length; k++) esFill(ctx, cache, key + (near ? 'n' : 'm') + k, fc[k], flowers(i0, i1, k, near)); if (s > 30) esFill(ctx, cache, key + 'e', eyeC, eyes(i0, i1)); }
    }
  } });
  P.solid(x0, y, x1 - x0, h, 'leaf');
};

// ---- the pool ------------------------------------------------------------------

// A swimming pool, drawn as a band just in front of the ground line so that
// people at y = 0 stand along its far edge. Stone coping with its joints, a band of
// tiles at the waterline, light that ripples across the floor (moving caustics), and
// at night the water holds the light of any lamp near it, fading the way S.lightAt does.
K.pool = function (S, P, x0, x1, o) {
  o = o || {}; const y = o.y || 0, d = o.depth || 1.25, zone = o.zone || 'pool';
  const wt = S.tone(o.col || '#3aa6c8', P), deep = S.tone(darken(o.col || '#3aa6c8', 0.22), P), shal = S.tone(lighten(o.col || '#3aa6c8', 0.12), P), wt2 = S.tone('#a6e4f0', P), stone = S.tone('#e2dccb', P), stoneD = S.tone('#c3bba6', P), stoneHi = S.tone('#f2ecdc', P);
  const tileA = S.tone('#2f6f9a', P), tileB = S.tone('#e8eef0', P), steel = S.tone('#c9ced3', P), steelD = S.tone('#8d949a', P), board = S.tone('#f1ede2', P), boardD = S.tone('#2f6db5', P);
  const night = S.pal.dark > 0.5, rain = S.weather === 'rain';
  P.add({ x0: x0 - 1.8, x1: x1 + 1.2, layer: 0, draw(ctx, env) {
    if (y + 1 < env.y0 || y - d - 0.3 > env.y1) return;
    const s = env.s, t = env.t;
    // coping all round, the water inside it
    poly(ctx, [x0 - 0.5, y - 0.04, x1 + 0.5, y - 0.04, x1 + 1.0, y - d - 0.2, x0 - 1.0, y - d - 0.2], stone);
    R4(ctx, x0 - 1.0, y - d - 0.2, x1 - x0 + 2.0, 0.08, stoneD);
    poly(ctx, [x0, y - 0.14, x1, y - 0.14, x1 + 0.4, y - d, x0 - 0.4, y - d], wt);
    // deeper under the far wall, shallower toward us
    poly(ctx, [x0, y - 0.14, x1, y - 0.14, x1 + 0.08, y - 0.42, x0 - 0.08, y - 0.42], deep);
    poly(ctx, [x0 - 0.3, y - d * 0.78, x1 + 0.3, y - d * 0.78, x1 + 0.4, y - d, x0 - 0.4, y - d], shal);
    if (s > 3) { // the coping joints and the tiles at the waterline
      ctx.fillStyle = stoneD; ctx.beginPath(); for (let x = Math.ceil(Math.max(x0, env.x0)); x < Math.min(x1, env.x1); x += 1) { ctx.rect(x, y - 0.13, 0.03, 0.09); ctx.rect(x + (x - (x0 + x1) / 2) * 0.02, y - d - 0.2, 0.03, 0.18); } ctx.fill();
      R4(ctx, x0, y - 0.21, x1 - x0, 0.07, tileA);
      if (s > 9) { ctx.fillStyle = tileB; ctx.beginPath(); for (let x = Math.max(x0, Math.floor(env.x0 * 4) / 4); x < Math.min(x1, env.x1); x += 0.25) ctx.rect(x, y - 0.205, 0.11, 0.06); ctx.fill(); }
    }
    R4(ctx, x0 - 0.5, y - 0.07, x1 - x0 + 1, Math.max(0.03, env.px), stoneHi);
    if (s > 2.2) { // light rippling over the floor: two sets of wavy lines that cross
      ctx.strokeStyle = wt2; ctx.lineWidth = Math.max(0.03, env.px * 0.8); ctx.globalAlpha = night ? 0.25 : 0.6; ctx.beginPath();
      const a = Math.max(x0 + 0.2, env.x0 - 1), b = Math.min(x1 - 0.2, env.x1 + 1), st = s > 14 ? 0.4 : s > 7 ? 0.65 : 1.1;
      for (let r = 0; r < 3; r++) {
        const yy = y - 0.5 - r * (d - 0.6) / 2.4, amp = 0.05 + r * 0.015;
        for (let set = 0; set < 2; set++) {
          let first = true;
          for (let x = a; x <= b; x += st) { const yv = yy + Math.sin(x * (set ? 1.9 : 1.3) + t * (set ? -1.1 : 0.9) + r * 2.3) * amp + set * 0.06; const xs = x + (yy - y) * (x - (x0 + x1) / 2) * -0.01; if (first) { ctx.moveTo(xs, yv); first = false; } else ctx.lineTo(xs, yv); }
        }
      }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (!night && !rain && s > 3) { // the sun glinting on the ripples
      ctx.fillStyle = '#ffffff'; ctx.beginPath();
      for (let i = 0; i < 14; i++) { const gx = x0 + 1 + ydHash(i, 41) * (x1 - x0 - 2), k = Math.sin(t * (1.3 + ydHash(i, 43)) + i * 2.1); if (k < 0.75 || gx < env.x0 || gx > env.x1) continue; ctx.rect(gx, y - 0.4 - ydHash(i, 47) * (d - 0.6), 0.32 * (k - 0.6) * 2.5, Math.max(0.025, env.px)); }
      ctx.fill();
    }
    if (rain && s > 3) { // rings where the rain lands
      ctx.strokeStyle = wt2; ctx.lineWidth = Math.max(0.02, env.px * 0.7); ctx.globalAlpha = 0.35; ctx.beginPath();
      for (let i = 0; i < 18; i++) { const u = (t * 1.7 + ydHash(i, 61)) % 1, k = Math.floor(t * 1.7 + ydHash(i, 61)), gx = x0 + 0.6 + ydHash(i, k + 7) * (x1 - x0 - 1.2), gy = y - 0.35 - ydHash(i + 3, k) * (d - 0.5), r = 0.05 + u * 0.3; if (gx < env.x0 || gx > env.x1) continue; esEll(ctx, gx, gy, r, r * 0.22); }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    // the lamp nearby, held in the water and spread by the ripples
    if (night) {
      const lamps = S.zoneLamps[zone] || [];
      for (let i = 0; i < lamps.length; i++) { const lp = lamps[i]; if (!lp.alive || lp.on === false) continue; const r = (lp.reach || 9) * 1.3; if (lp.x + r < x0 || lp.x - r > x1) continue;
        ydPool(ctx, lp.x, y - 0.05, r, d * 1.4, '255,225,160', 0.38);
        const cx = clamp(lp.x, x0 + 0.3, x1 - 0.3), k = 1 - Math.min(1, Math.abs(cx - lp.x) / r);
        if (k > 0.05) esShimmer(ctx, env, cx, y - 0.16, d - 0.25, '255,230,170', 0.55 * k, 0.3);
      }
    }
    // a ladder at the right-hand end and a diving board at the left
    const lx = x1 - 1.2;
    ctx.strokeStyle = steel; ctx.lineWidth = Math.max(0.06, env.px); ctx.beginPath();
    for (const q of [0, 0.42]) { ctx.moveTo(lx + q, y - 0.25); ctx.lineTo(lx + q, y + 0.55); if (s > 4) ctx.arc(lx + q + 0.18, y + 0.55, 0.18, Math.PI, 0, true); else ctx.lineTo(lx + q, y + 0.7); }
    ctx.stroke();
    if (s > 5) { ctx.fillStyle = steelD; ctx.beginPath(); for (let i = 0; i < 3; i++) ctx.rect(lx, y - 0.3 - i * 0.22, 0.42, 0.04); ctx.fill(); }
    R4(ctx, x0 - 1.5, y, 0.25, 0.4, steelD); R4(ctx, x0 - 1.62, y + 0.35, 2.6, 0.1, board);
    if (s > 5) { R4(ctx, x0 - 1.62, y + 0.33, 2.6, 0.03, boardD); R4(ctx, x0 - 1.58, y, 0.5, 0.04, steelD); }
  } });
  return { x0, x1 };
};

// ---- fire --------------------------------------------------------------------

// A fire in an oil drum. It lights the ground around it like a lamp: the pool on the
// ground and the glow on things nearby fade the way S.lightAt does, and flicker gently
// rather than blinking. The flames are tongues that lick up and lean with the wind,
// with sparks and smoke above. Shot out, the fire dies down over half a second.
K.brazier = function (S, P, x, zone, o) {
  o = o || {}; const y = o.y || 0, reach = o.reach || 6;
  const drum = S.tone('#3a3f47', P), drumD = S.tone('#23262c', P), drumHi = S.tone('#5a6068', P), rust = S.tone('#7a4a2a', P), coal = S.tone('#1a1714', P);
  const fOut = S.tone('#ff5a1a', P, true), fMid = S.tone('#ff9a2e', P, true), fIn = S.tone('#ffd76a', P, true), fCore = S.tone('#fff4c8', P, true), ember = S.tone('#ffb050', P, true);
  let dieT = null;
  const fire = (env) => { if (ob.alive && ob.on !== false) { dieT = null; return 1; } if (dieT === null) dieT = env.t; return clamp(1 - (env.t - dieT) / 0.5, 0, 1); };
  const flick = (t) => 0.9 + 0.1 * esWob(t * 0.8, 3);
  // one tongue of flame: it bulges near its root and curls to a point that wanders
  const tongue = (ctx, bx, by, bw, hh, lean) => { ctx.moveTo(bx - bw, by); ctx.bezierCurveTo(bx - bw * 1.35, by + hh * 0.32, bx - bw * 0.3 + lean * 0.55, by + hh * 0.72, bx + lean, by + hh); ctx.bezierCurveTo(bx + bw * 0.35 + lean * 0.5, by + hh * 0.68, bx + bw * 1.35, by + hh * 0.3, bx + bw, by); ctx.closePath(); };
  const TH = [0.5, 0.78, 1, 0.72, 0.48];
  const ob = S.obj({ kind: 'lamp', id: o.id || 'brazier', plane: P, x, y: y + 1.05, r: 0.34, zone, on: true, mat: 'metal', layer: 2, reach, popR: 5, col: '#ffb070',
    draw(ctx, env) {
      if (y + 8 < env.y0 || y > env.y1) return;
      const s = env.s, t = env.t, k = fire(env), top = y + 0.95, wind = env.wind || 0;
      // the drum: ribs, a lip, rust, and air holes that glow
      R4(ctx, x - 0.3, y, 0.6, 0.95, drum);
      ctx.fillStyle = drumD; ctx.beginPath(); ctx.rect(x - 0.33, y + 0.3, 0.66, 0.07); ctx.rect(x - 0.33, y + 0.66, 0.66, 0.07); ctx.rect(x + 0.12, y, 0.18, 0.95); ctx.fill();
      R4(ctx, x - 0.32, top - 0.05, 0.64, 0.06, drumHi);
      if (s > 9) { ctx.fillStyle = rust; ctx.globalAlpha = 0.6; ctx.beginPath(); ydShape(ctx, [x - 0.26, y + 0.1, x - 0.1, y + 0.1, x - 0.14, y + 0.28, x - 0.24, y + 0.22]); ydShape(ctx, [x + 0.02, top - 0.06, x + 0.18, top - 0.06, x + 0.12, y + 0.5, x + 0.06, y + 0.62]); ctx.fill(); ctx.globalAlpha = 1; }
      if (k > 0.02 && s > 5) { ctx.fillStyle = mix(drumD, '#ff8a2a', 0.85 * k); ctx.beginPath(); for (let i = 0; i < 4; i++) esEll(ctx, x - 0.2 + i * 0.12, y + 0.18, 0.03, 0.03); ctx.fill(); }
      if (k <= 0.02) { // cold coals, a last wisp of smoke
        R4(ctx, x - 0.27, top - 0.02, 0.54, 0.05, coal);
        if (dieT !== null && t - dieT < 6) ydSmoke(ctx, env, x, top + 0.2, 'rgb(90,90,98)', 4, 4, 0.12, 0.7, 0.2, 0.4 * (1 - (t - dieT) / 6), wind * 1.6, 0.3);
        return;
      }
      // flames, outer to inner: five tongues that lick up and lean with the wind, a bed
      // of fire under them, and now and then a flicker that breaks off and rises
      const lean0 = wind * 0.05;
      const layers = [[fOut, 1, 0.15], [fMid, 0.74, 0.12], [fIn, 0.48, 0.09], [fCore, 0.24, 0.06]];
      for (let L = 0; L < (s > 4 ? 4 : 2); L++) {
        const q = layers[L]; ctx.fillStyle = q[0]; ctx.beginPath();
        esEll(ctx, x, top + 0.02, 0.29 - L * 0.05, (0.13 - L * 0.025) * k);
        for (let i = L === 3 ? 1 : 0; i < (L === 3 ? 4 : 5); i++) { const bx = x - 0.2 + i * 0.1, hh = (0.55 * TH[i] + 0.2 + 0.16 * esWob(t * 1.15, i * 2 + 1)) * q[1] * k; if (hh < 0.04) continue; tongue(ctx, bx, top - 0.01, q[2], hh, lean0 * hh * 5 + esWob(t * 1.7, i + 7) * 0.07 * q[1]); }
        if (L < 2) for (let j = 0; j < 2; j++) { const u = (t * 1.6 + j * 0.5) % 1, fx = x - 0.06 + j * 0.12 + esWob(t, j + 20) * 0.05 + lean0 * u * 6, fy = top + (0.62 + u * 0.5) * k * q[1], r = 0.06 * (1 - u) * q[1] * k; if (r > 0.01) { ctx.moveTo(fx - r, fy); ctx.quadraticCurveTo(fx, fy - r * 2.5, fx + r, fy); ctx.quadraticCurveTo(fx, fy + r * 3, fx - r, fy); } }
        ctx.fill();
      }
      // the glow round the fire itself, and sparks drifting up
      const f = flick(t) * k;
      ydGlow(ctx, x, top + 0.35, 1.6, 1.4, '255,150,60', 0.5 * f * (0.4 + 0.6 * S.pal.dark));
      if (s > 3) {
        ctx.fillStyle = ember; ctx.beginPath();
        for (let i = 0; i < 9; i++) { const u = (t * (0.45 + ydHash(i, 3) * 0.3) + ydHash(i, 5)) % 1, ex = x + (ydHash(i, 9) - 0.5) * 0.4 + wind * u * u * 0.9 + Math.sin(u * 9 + i) * 0.1, ey = top + 0.3 + u * 2.4, r = Math.max(0.025, env.px * 0.9) * (1 - u * 0.6); if (u > 0.85) continue; ctx.rect(ex - r / 2, ey, r, r); }
        ctx.fill();
      }
      // smoke, going up into the rain
      ydSmoke(ctx, env, x + wind * 0.1, top + 0.9, 'rgb(120,118,126)', 6, 5.5, 0.18, 1.0, 0.2, 0.32 * k, wind * 2.4, 0.1);
    } });
  // The light on the ground and on whatever stands near it, drawn behind the people.
  P.add({ x0: x - reach * 1.3 - 1, x1: x + reach * 1.3 + 1, layer: 0, draw(ctx, env) {
    if (S.pal.dark < 0.25 || y + 6 < env.y0 || y - 2 > env.y1) return;
    const k = fire(env); if (k <= 0.01) return;
    const f = flick(env.t) * k * S.pal.dark;
    ydPool(ctx, x, y, reach * 1.3, 1.1, '255,150,60', 0.5 * f);
    ydGlow(ctx, x, y + 1.6, reach * 0.9, 3.4, '255,140,50', 0.16 * f, true);
    if (S.weather === 'rain' && env.s > 2) esShimmer(ctx, env, x, y, 1.3, '255,150,70', 0.5 * f, 0.34); // wet paving holds the fire
  } });
  P.solid(x - 0.3, y, 0.6, 0.9, 'hard');
  return ob;
};

// ---- garden buildings and dressing -------------------------------------------------

// A glasshouse: a brick base, white glazing bars, a ridge with iron cresting, two
// roof lights propped open, and plants inside: palms, a vine on strings, pots on staging.
K.glasshouse = function (S, P, x, w, h, o) {
  o = o || {}; const y = o.y || 0, night = S.pal.dark > 0.5;
  const bar = S.tone('#eef0ea', P), barD = S.tone('#b9beb6', P), gl = S.tone(night ? '#16202c' : '#a9cfd6', P), glIn = S.tone(night ? '#101a16' : '#5f8a6c', P), sheen = night ? 'rgba(150,180,210,0.10)' : 'rgba(255,255,255,0.32)';
  const leaf = S.tone('#3f7a46', P), leaf2 = S.tone('#2d5e38', P), leafHi = S.tone('#6a9e5a', P), pot = S.tone('#b5583a', P), potD = S.tone('#8a3e28', P), brick = S.tone('#b9a48c', P), brickD = S.tone('#9a8670', P), cap = S.tone('#d8cdb8', P), iron = S.tone('#2a2e36', P), wood = S.tone('#7a5c3c', P), fruit = S.tone('#c8372d', P), door = S.tone(night ? '#0d1410' : '#4a6a52', P);
  const D = makeRng(Math.round(x * 7) + 3301), plants = [];
  for (let i = 0; i < 7; i++) plants.push([x + 0.9 + (i + D.r(0.1, 0.7)) * (w - 1.8) / 7, D.r(1.2, h - 0.7), D.i(0, 2), D.f()]);
  const roofH = 1.7, gx = (u) => x + u * w, C = {};
  // everything here is fixed, so each part is a shape worked out once (see esFill)
  const inside = (p) => { p.rect(x, y + 0.8, w, h - 0.8); ydShape(p, [x, y + h, x + w, y + h, x + w / 2, y + h + roofH]); };
  const staging = (p) => { p.rect(x + 0.3, y + 0.8, w - 0.6, 0.12); };
  const pots = (p) => { for (let px = x + 0.6; px < x + w - 0.5; px += 0.7) ydShape(p, [px - 0.17, y + 0.92, px + 0.17, y + 0.92, px + 0.13, y + 1.2, px - 0.13, y + 1.2]); };
  const backLeaves = (p) => { for (let i = 0; i < plants.length; i++) { const q = plants[i]; if (q[2] === 0) { for (let j = 0; j < 7; j++) { const an = -0.2 + (j / 6) * (Math.PI + 0.4), r = q[1] * 0.42; ydShape(p, [q[0], y + q[1] * 0.62, q[0] + Math.cos(an) * r - 0.1, y + q[1] * 0.62 + Math.sin(an) * r * 0.8, q[0] + Math.cos(an) * r * 1.05, y + q[1] * 0.62 + Math.sin(an) * r * 0.85 + 0.12, q[0] + Math.cos(an) * r + 0.1, y + q[1] * 0.62 + Math.sin(an) * r * 0.8]); } p.rect(q[0] - 0.05, y + 0.8, 0.1, q[1] * 0.62 - 0.8); } else { esEll(p, q[0], y + q[1] * 0.55, 0.65, q[1] * 0.32); esEll(p, q[0] + 0.35, y + q[1] * 0.68, 0.45, q[1] * 0.22); } } };
  const frontLeaves = (near) => (p) => { for (let i = 0; i < plants.length; i++) { const q = plants[i]; if (q[2] !== 0) { esEll(p, q[0] - 0.15, y + q[1] * 0.6, 0.45, q[1] * 0.22); if (near) esEll(p, q[0] + 0.2, y + q[1] * 0.45, 0.3, 0.16); } } if (near) for (let vx = x + 0.5; vx < x + w - 0.3; vx += w / 8) for (let j = 0; j < 5; j++) esEll(p, vx + Math.sin(j * 2.3 + vx) * 0.12, y + 1.2 + j * (h - 1.6) / 5, 0.16, 0.11); };
  const fine = { hi: (p) => { for (const q of plants) if (q[2] !== 0) esEll(p, q[0] - 0.3, y + q[1] * 0.68, 0.18, 0.1); }, fruit: (p) => { for (let vx = x + 0.5; vx < x + w - 0.3; vx += w / 8) for (let j = 1; j < 4; j += 2) esEll(p, vx + 0.12, y + 1.1 + j * (h - 1.6) / 5, 0.05, 0.05); },
    tubs: (p) => { for (const q of plants) ydShape(p, [q[0] - 0.3, y + 0.8, q[0] + 0.3, y + 0.8, q[0] + 0.36, y + 1.25, q[0] - 0.36, y + 1.25]); }, strings: (p) => esSegs(p, [x + 0.5, y + 1.0, x + 0.5, y + h, x + 0.5 + w / 8, y + 1.0, x + 0.5 + w / 8, y + h]) };
  const streaks = (p) => { for (let i = 0; i < 4; i++) { const sx = x + 0.8 + i * w * 0.27; ydShape(p, [sx, y + 0.8, sx + 0.7, y + 0.8, sx + 1.9, y + h, sx + 1.2, y + h]); } };
  const courses = (p) => { for (let yy = y + 0.16; yy < y + 0.74; yy += 0.16) p.rect(x, yy, w, 0.025); };
  const bars = (near) => (p) => { const pts = []; for (let i = 0; i <= 8; i++) { const xx = gx(i / 8); pts.push(xx, y + 0.8, xx, y + h); }
    pts.push(x, y + h, x + w, y + h, x, y + h * 0.55, x + w, y + h * 0.55, x, y + h, x + w / 2, y + h + roofH, x + w / 2, y + h + roofH, x + w, y + h);
    if (near) for (let i = 1; i < 8; i++) { const xx = gx(i / 8), yr = y + h + roofH * (1 - Math.abs(xx - x - w / 2) / (w / 2)); pts.push(xx, y + h, xx, yr); }
    esSegs(p, pts); };
  const fineBars = (p) => { const pts = []; for (let i = 0; i < 8; i++) { const xx = gx((i + 0.5) / 8); pts.push(xx, y + 0.8, xx, y + h); } for (let yy = y + 1.4; yy < y + h; yy += 0.6) pts.push(x, yy, x + w, yy); esSegs(p, pts); };
  const vents = (p) => { for (const u of [0.2, 0.68]) { const ax = gx(u), ay = y + h + roofH * (u < 0.5 ? u * 2 : (1 - u) * 2); ydShape(p, [ax, ay, ax + w * 0.12, ay + roofH * 0.24 * (u < 0.5 ? 1 : -1), ax + w * 0.12, ay + roofH * 0.24 * (u < 0.5 ? 1 : -1) + 0.22, ax, ay + 0.22]); } };
  const doorFrame = (p) => esSegs(p, [x + w - 1.25, y + 0.8, x + w - 1.25, y + 2.8, x + w - 0.3, y + 0.8, x + w - 0.3, y + 2.8, x + w - 1.25, y + 2.8, x + w - 0.3, y + 2.8]);
  const finial = (p) => { p.rect(x + w / 2 - 0.05, y + h + roofH - 0.05, 0.1, 0.5); esEll(p, x + w / 2, y + h + roofH + 0.5, 0.09, 0.09); };
  const brackets = (p) => { ydShape(p, [x - 0.25, y + h, x + 0.1, y + h, x + 0.1, y + h - 0.3]); ydShape(p, [x + w + 0.25, y + h, x + w - 0.1, y + h, x + w - 0.1, y + h - 0.3]); };
  P.add({ x0: x - 0.3, x1: x + w + 0.3, layer: 0, draw(ctx, env) {
    if (y + h + roofH + 1 < env.y0 || y > env.y1) return;
    const s = env.s;
    // inside: the far wall in shade, staging with pots, palms and shrubs, a vine on strings
    esFill(ctx, C, 'in', glIn, inside);
    if (s > 3) {
      if (s > 5) { esFill(ctx, C, 'st', wood, staging); esFill(ctx, C, 'po', pot, pots); }
      esFill(ctx, C, 'bl', leaf2, backLeaves);
      esFill(ctx, C, s > 6 ? 'fl1' : 'fl0', leaf, frontLeaves(s > 6));
      if (s > 9) { esFill(ctx, C, 'hi', leafHi, fine.hi); esFill(ctx, C, 'fr', fruit, fine.fruit); esFill(ctx, C, 'tu', potD, fine.tubs); esStroke(ctx, env, C, 'str', iron, 0.015, fine.strings); }
    }
    // the glass, with streaks of sky reflected in it
    ctx.globalAlpha = 0.45; esFill(ctx, C, 'gl', gl, inside); ctx.globalAlpha = 1;
    if (s > 2) esFill(ctx, C, 'sk', sheen, streaks);
    // the brick base and its coping
    R4(ctx, x, y, w, 0.8, brick); R4(ctx, x - 0.08, y + 0.74, w + 0.16, 0.1, cap);
    if (s > 5) esFill(ctx, C, 'co', brickD, courses);
    // glazing bars: posts, two rails, the eaves, the roof bars and the ridge
    esStroke(ctx, env, C, s > 3 ? 'b1' : 'b0', bar, 0.08, bars(s > 3));
    if (s > 7) esStroke(ctx, env, C, 'fb', barD, 0.025, fineBars);
    // two roof lights propped open, the door at the near end, a finial on the gable
    if (s > 2.5) {
      ctx.globalAlpha = 0.6; esFill(ctx, C, 've', barD, vents); ctx.globalAlpha = 1;
      R4(ctx, x + w - 1.25, y + 0.8, 0.95, 2.0, door);
      esStroke(ctx, env, C, 'df', bar, 0.05, doorFrame);
    }
    if (s > 4) { esFill(ctx, C, 'fi', iron, finial); esFill(ctx, C, 'br', bar, brackets); }
  } });
  P.solid(x, y, w, 0.8, 'wall'); P.solid(x, y + 0.8, w, h - 0.8, 'glasswall');
};

// A string of little flags between two points. Each flag swings on the string and
// turns side-on now and then, so it narrows and shows its darker back.
K.bunting = function (S, P, x0, y0, x1, y1, o) {
  o = o || {}; const base = o.cols || ['#c8372d', '#f1ede2', '#2f6db5', '#e2b33c'], cols = base.map((c) => S.tone(c, P)), backs = base.map((c) => S.tone(darken(c, 0.25), P)), wire = S.tone('#3a3f47', P), n = Math.max(4, Math.floor(Math.abs(x1 - x0) / 0.9)), sag = o.sag || 1.2;
  P.add({ x0: Math.min(x0, x1) - 0.5, x1: Math.max(x0, x1) + 0.5, layer: o.layer === undefined ? 1 : o.layer, draw(ctx, env) {
    if (Math.max(y0, y1) + 0.5 < env.y0 || Math.min(y0, y1) - sag - 1 > env.y1) return;
    const wind = env.wind || 0, sg = sag * (1 + Math.sin(env.t * 0.9) * 0.05 * Math.min(1.5, Math.abs(wind) * 0.3 + 0.3));
    const at = (u) => lerp(y0, y1, u) - sg * 4 * u * (1 - u);
    ctx.strokeStyle = wire; ctx.lineWidth = Math.max(0.03, env.px * 0.6); ctx.beginPath();
    for (let i = 0; i <= n; i++) { const u = i / n, px = lerp(x0, x1, u); if (i) ctx.lineTo(px, at(u)); else ctx.moveTo(px, at(u)); }
    ctx.stroke();
    if (env.s < 1.6) return;
    const gust = Math.min(1.6, Math.abs(wind) * 0.3 + 0.35);
    for (let pass = 0; pass < 2; pass++) for (let c = 0; c < cols.length; c++) {
      ctx.fillStyle = pass ? backs[c] : cols[c]; ctx.beginPath(); let any = false;
      for (let i = c; i < n; i += cols.length) {
        const u = (i + 0.5) / n, px = lerp(x0, x1, u); if (px < env.x0 - 1 || px > env.x1 + 1) continue;
        const py = at(u), ph = env.t * (3.2 + (i % 3) * 0.7) + i * 1.3, turn = Math.cos(ph * 0.45 + i), wdt = 0.22 * (0.35 + 0.65 * Math.abs(turn)), tip = Math.sin(ph) * 0.09 * gust + wind * 0.03;
        if ((turn < 0) !== !!pass) continue;
        ydShape(ctx, [px - wdt, py, px + wdt, py, px + tip, py - 0.5 + Math.abs(tip) * 0.3]); any = true;
      }
      if (any) ctx.fill();
    }
  } });
};

// ---- ground ----------------------------------------------------------------------

// Mown grass on the strip of ground in front of a plane: alternate bands of light and
// dark where the mower went up and back, and (close up) small tufts. skip is a list
// of [x0, x1] stretches left out (paving, the pool).
function esLawn(S, P, o) {
  const y = o.y || 0, depth = o.depth || 1.4, g = o.col || S.pal.grass, light = S.tone(lighten(g, 0.08), P), dark = S.tone(darken(g, 0.1), P), tuft = S.tone(darken(g, 0.25), P), skip = o.skip || [], band = o.band || 2.4;
  const xa = o.x0 === undefined ? -90 : o.x0, xb = o.x1 === undefined ? 90 : o.x1;
  const out = (x) => { for (let i = 0; i < skip.length; i++) if (x > skip[i][0] && x < skip[i][1]) return true; return false; };
  P.add({ x0: xa, x1: xb, layer: 0, draw(ctx, env) {
    if (y + 0.2 < env.y0 || y - depth > env.y1) return;
    const a = Math.max(xa, Math.floor(env.x0 / band) * band), b = Math.min(xb, env.x1 + band);
    ctx.fillStyle = light; ctx.beginPath();
    for (let x = a; x < b; x += band) { if (Math.round(x / band) & 1 || out(x + band / 2)) continue; ydShape(ctx, [x, y - 0.02, x + band, y - 0.02, x + band - 0.12, y - depth, x - 0.12, y - depth]); }
    ctx.fill();
    if (env.s > 30) {
      ctx.fillStyle = (o.dry ? dark : tuft); ctx.beginPath();
      const c0 = Math.floor(Math.max(xa, env.x0) / 0.7), c1 = Math.floor(Math.min(xb, env.x1) / 0.7);
      for (let i = c0; i <= c1; i++) for (let j = 0; j < 2; j++) { const u = ydHash(i, j * 5 + 3), v = ydHash(i + 31, j * 7 + 1), x = (i + u) * 0.7; if (out(x)) continue; const yy = y - 0.06 - v * (depth - 0.1); if (yy < env.y0) continue; ydTuft(ctx, x, yy, 0.08 + u * 0.06, 0.02); }
      ctx.fill();
    }
  } });
}

// A stone urn on a square pedestal, planted with something trailing.
function esUrn(S, P, x, o) {
  o = o || {}; const y = o.y || 0, st = S.tone('#ddd4bf', P), stD = S.tone('#b6ac96', P), stHi = S.tone('#efe8d6', P), plant = S.tone('#3f6a3c', P), flower = S.tone(o.flower || '#d9482b', P), side = esSide(S);
  P.add({ x0: x - 0.7, x1: x + 0.7, layer: 0, draw(ctx, env) {
    if (y + 2 < env.y0 || y > env.y1) return;
    const s = env.s;
    R4(ctx, x - 0.32, y, 0.64, 0.7, st); R4(ctx, x - 0.38, y + 0.66, 0.76, 0.08, stHi); R4(ctx, x - 0.38, y, 0.76, 0.08, stD);
    ctx.fillStyle = st; ctx.beginPath(); ydShape(ctx, [x - 0.12, y + 0.74, x + 0.12, y + 0.74, x + 0.16, y + 0.86, x + 0.36, y + 1.0, x + 0.38, y + 1.22, x - 0.38, y + 1.22, x - 0.36, y + 1.0, x - 0.16, y + 0.86]); ctx.fill();
    R4(ctx, x - 0.42, y + 1.2, 0.84, 0.07, stHi);
    if (s > 4) { ctx.fillStyle = stD; ctx.beginPath(); ctx.rect(x + side * -0.32 + (side > 0 ? 0 : 0.5), y + 0.08, 0.14, 0.58); ydShape(ctx, [x - side * 0.38, y + 1.2, x - side * 0.36, y + 1.0, x - side * 0.16, y + 0.86, x - side * 0.08, y + 0.86, x - side * 0.2, y + 1.2]); ctx.fill(); }
    ctx.fillStyle = plant; ctx.beginPath(); esEll(ctx, x, y + 1.36, 0.42, 0.2); if (s > 3) { esEll(ctx, x - 0.36, y + 1.18, 0.12, 0.2); esEll(ctx, x + 0.34, y + 1.12, 0.1, 0.24); } ctx.fill();
    if (s > 5) { ctx.fillStyle = flower; ctx.beginPath(); for (let i = 0; i < 6; i++) esEll(ctx, x - 0.3 + i * 0.12, y + 1.4 + Math.sin(i * 2.1) * 0.08, 0.05, 0.05); ctx.fill(); }
  } });
}

// ---- the estate -----------------------------------------------------------------
SCN.estate = function (o) {
  o = o || {};
  const z = o.z || 500, sd = o.seed || 7, night = (o.time || 'day') === 'night';
  const S = makeScene({ time: o.time || 'day', weather: o.weather, seed: sd, refZ: z, exits: [-78, 78], bounds: { x0: -64, x1: 64, y0: -5, y1: 40 }, ambience: 'wild', groundMat: 'dirt', sun: o.sun || (night ? [70, 40] : [-80, 30]) });
  const H = { S, z }, side = esSide(S), rain = S.weather === 'rain', dark = S.pal.dark;
  K.mountains(S, z + 5600, { seed: 4 + sd, h: 520, col: '#7d8a9a', snowLine: 0.6 });
  K.hills(S, z + 1500, { seed: 3 + sd, h: 150, base: -30, col: night ? '#1c3026' : '#7ea86a', trees: 0.5, rough: 260 });
  const PHl = K.hills(S, z + 380, { seed: 9 + sd, h: 46, base: -14, col: night ? '#18281f' : '#6e9c5c', trees: 0.85, rough: 140, treeCol: '#2d4f3a' });
  // vineyard rows on the slope behind the house, shaded at the foot, on posts
  const vine = S.tone('#4f7a4a', PHl), vineD = S.tone('#3a5c3a', PHl), post = S.tone('#5a4a3a', PHl);
  PHl.add({ x0: -400, x1: 400, layer: 0, draw(ctx, env) {
    if (14 < env.y0 || -12 > env.y1) return;
    const a = Math.floor(env.x0 / 6) * 6;
    for (let pass = 0; pass < (env.s > 2 ? 2 : 1); pass++) {
      ctx.fillStyle = pass ? vineD : vine; ctx.beginPath();
      for (let r = 0; r < 5; r++) { const yy = -8 + r * 5; for (let x = a; x < env.x1; x += 6) { const by = yy + Math.sin(x * 0.02 + r) * 2; if (pass) ctx.rect(x + r * 1.3, by, 4.2, 0.35); else ctx.rect(x + r * 1.3, by, 4.2, 1.2); } }
      ctx.fill();
    }
    if (env.s > 4) { ctx.fillStyle = post; ctx.beginPath(); for (let r = 0; r < 5; r++) { const yy = -8 + r * 5; for (let x = a; x < env.x1; x += 6) { const by = yy + Math.sin(x * 0.02 + r) * 2; ctx.rect(x + r * 1.3 - 0.15, by, 0.3, 1.5); } } ctx.fill(); }
  } });

  // rear wall and its cypresses
  const PRW = H.PRW = S.plane(z + 52, 'rear wall');
  K.ground(S, PRW, { col: S.pal.grass, noEdge: true });
  [-62, -51, -30, -25, 29, 34, 50, 63, 70].forEach((x, i) => K.cypress(S, PRW, x, 12 + (i * 7) % 5, { solid: false }));
  K.fence(S, PRW, -90, 90, 2.6, { kind: 'wall', col: '#d6cab0', layer: 0 });
  // piers along the wall, coursed stone, and ivy where nobody has cut it back
  const rw = { st: S.tone('#c4b79a', PRW), stD: S.tone('#a99c80', PRW), cap: S.tone('#e2d8c0', PRW), ivy: S.tone('#2f5232', PRW), ivy2: S.tone('#3f6a3c', PRW) };
  const rwC = {}, piers = []; for (let x = -90; x <= 90; x += 9) piers.push(x);
  const ivyAt = (x) => ydHash(x, 5) >= 0.45, ivyX = (x) => x + 2 + ydHash(x, 7) * 4, ivyW = (x) => 1.6 + ydHash(x, 9) * 1.8;
  PRW.add({ x0: -90, x1: 90, layer: 0, draw(ctx, env) {
    if (3.4 < env.y0 || 0 > env.y1) return;
    const s = env.s;
    if (s > 4) esFill(ctx, rwC, 'co', rw.stD, (p) => { for (let yy = 0.45; yy < 2.4; yy += 0.45) p.rect(-90, yy, 180, 0.03); });
    esFill(ctx, rwC, 'pi', rw.st, (p) => { for (const x of piers) p.rect(x - 0.35, 0, 0.7, 3.0); });
    esFill(ctx, rwC, 'ca', rw.cap, (p) => { for (const x of piers) ydShape(p, [x - 0.48, 3.0, x + 0.48, 3.0, x + 0.3, 3.18, x, 3.38, x - 0.3, 3.18]); });
    esFill(ctx, rwC, 'iv', rw.ivy, (p) => { for (const x of piers) { if (!ivyAt(x)) continue; const cx = ivyX(x), wd = ivyW(x); p.moveTo(cx - wd, 0); for (let j = 0; j <= 8; j++) { const u = j / 8, hh = (0.9 + 1.4 * Math.sin(u * Math.PI)) * (0.7 + 0.3 * ydHash(x + j, 13)); p.lineTo(cx - wd + u * wd * 2, Math.min(2.45, hh)); } p.lineTo(cx + wd, 0); p.closePath(); } });
    if (s > 3) esFill(ctx, rwC, 'il', rw.ivy2, (p) => { for (const x of piers) { if (!ivyAt(x)) continue; const cx = ivyX(x), wd = ivyW(x); for (let j = 0; j < 14; j++) { const u = ydHash(x + j, 17), v = ydHash(x + j, 19); esEll(p, cx - wd * 0.85 + u * wd * 1.7, 0.2 + v * 1.6 * Math.sin(u * Math.PI), 0.14, 0.09); } } });
  } });

  // back tower: the radio dish stands on it
  const PB = H.PB = S.plane(z + 34, 'tower');
  const tw = { x: 13, w: 6, h: 9.2 };
  const twC = {}, tc = { wall: S.tone('#d9cdb2', PB), wallD: S.tone('#bfb196', PB), cap: S.tone('#b9a98c', PB), dk: S.tone('#2a2e36', PB), iron: S.tone('#30343c', PB), glass: S.tone(night ? '#0d141e' : '#3a4e5e', PB), lit: S.tone('#ffd98a', PB, true) };
  PB.add({ x0: tw.x - 3, x1: tw.x + tw.w + 3, layer: 0, draw(ctx, env) {
    if (tw.h + 7 < env.y0 || 0 > env.y1) return;
    const s = env.s;
    R4(ctx, tw.x, 0, tw.w, tw.h, tc.wall); R4(ctx, side > 0 ? tw.x : tw.x + tw.w - 1.0, 0, 1.0, tw.h, tc.wallD); R4(ctx, tw.x - 0.3, tw.h - 0.4, tw.w + 0.6, 0.4, tc.cap);
    if (s > 3) { // coursed stone with quoins at the corners
      esFill(ctx, twC, 'co', tc.wallD, (p) => { for (let yy = 0.5; yy < tw.h - 0.5; yy += 0.5) p.rect(tw.x, yy, tw.w, 0.03); });
      esFill(ctx, twC, 'qu', tc.cap, (p) => { for (let i = 0; i < 9; i++) { const yy = i * 1.0, wq = i % 2 ? 0.45 : 0.75; p.rect(tw.x, yy + 0.05, wq, 0.45); p.rect(tw.x + tw.w - wq, yy + 0.05, wq, 0.45); } });
    }
    // a slit window on each floor and a door
    esFill(ctx, twC, 'wi', tc.glass, (p) => { for (const yy of [3.2, 6.4]) p.rect(tw.x + tw.w / 2 - 0.3, yy, 0.6, 1.4); p.rect(tw.x + 1.6, 0, 1.1, 2.1); });
    if (night && s > 2) { R4(ctx, tw.x + tw.w / 2 - 0.3, 6.4, 0.6, 1.4, tc.lit); }
    // the mast, its ladder, guy wires (kept clear of the dish), and the lamp on top
    esStroke(ctx, env, twC, s > 2.5 ? 'm1' : 'm0', tc.iron, 0.07, (p) => esSegs(p, [tw.x + 1.1, tw.h, tw.x + 1.1, tw.h + 5.5, tw.x + 0.4, tw.h + 4.4, tw.x + 1.8, tw.h + 4.4, tw.x + 0.6, tw.h + 3.6, tw.x + 1.6, tw.h + 3.6].concat(s > 2.5 ? [tw.x + 1.1, tw.h + 5, tw.x + 0.15, tw.h, tw.x + 1.1, tw.h + 5, tw.x + 2.0, tw.h] : [])));
    if (s > 6) esStroke(ctx, env, twC, 'la', tc.iron, 0.03, (p) => { for (let yy = tw.h + 0.3; yy < tw.h + 3.4; yy += 0.3) { p.moveTo(tw.x + 0.95, yy); p.lineTo(tw.x + 1.25, yy); } });
    if (Math.sin(env.t * 2.4) > 0.3) { circ(ctx, tw.x + 1.1, tw.h + 5.6, Math.max(0.12, env.px * 1.3), '#ff5a48'); if (dark > 0.3) ydGlow(ctx, tw.x + 1.1, tw.h + 5.6, 0.9, 0.9, '255,80,60', 0.5); }
  } });
  PB.solid(tw.x, 0, tw.w, tw.h, 'wall');
  H.dish = K.thing(S, PB, 'dish', o.dishX === undefined ? 16 : o.dishX, tw.h + 1.1, { id: 'dish' });

  // ---- the house ----
  const PH = H.PH = S.plane(z + 14, 'house');
  K.ground(S, PH, { col: S.pal.grass, noEdge: true });
  const wall = '#e6dbc2';
  // a gravel path along the front of the house and a border of flowers, on the strip
  // of ground between the house and the lawn
  const hpC = {}, hp = { grav: S.tone('#cfc4ac', PH), grav2: S.tone('#b3a88f', PH), soil: S.tone('#4a3a2c', PH), fl: ['#d9482b', '#f1ede2', '#b56bb0', '#e8a23a'].map((c) => S.tone(c, PH)), leaf: S.tone('#3f6a3c', PH) };
  PH.add({ x0: -60, x1: 48, layer: 0, draw(ctx, env) {
    if (0.2 < env.y0 || -1.4 > env.y1) return;
    const s = env.s, a = Math.max(-60, env.x0 - 1), b = Math.min(48, env.x1 + 1);
    R4(ctx, a, -0.55, b - a, 0.55, hp.grav); R4(ctx, a, -0.58, b - a, 0.05, hp.grav2);
    R4(ctx, Math.max(a, -9.8), -1.0, Math.min(b, 25.8) - Math.max(a, -9.8), 0.4, hp.soil);
    if (s > 3) {
      esFill(ctx, hpC, 'l', hp.leaf, (p) => { for (let i = 0; i < 59; i++) esEll(p, -9.6 + i * 0.6 + 0.3, -0.72, 0.32, 0.14); });
      const near = s > 8;
      for (let c = 0; c < 4; c++) esFill(ctx, hpC, (near ? 'n' : 'f') + c, hp.fl[c], (p) => { for (let i = c; i < 59; i += 4) for (let j = 0; j < (near ? 3 : 1); j++) p.rect(-9.6 + i * 0.6 + 0.1 + j * 0.14, -0.7 - (j % 2) * 0.08, near ? 0.1 : 0.16, near ? 0.1 : 0.16); });
    }
    if (s > 26) { ctx.fillStyle = hp.grav2; ctx.beginPath(); ydSpeck(ctx, env, a, b, -0.5, -0.05, 0.4, 17, 2, 0.04); ctx.fill(); }
  } });
  const B = H.house = K.building(S, PH, { x: -10, w: 36, floors: 2, fh: 3.7, cols: 8, winW: 1.7, winH: 2.2, sill: 0.8, id: 'house', wall, frame: '#f6f1e4', trim: '#f2ead6', door: 3, doorCol: '#3f5a48', ac: false, parapet: 0.3, roofAccess: false, seed: 5 + sd,
    spans: { 0: [[6, 7, 'study', !!o.studyLit]] },
    wins: Object.assign({ '0,3': { none: true }, '0,6': { blind: 0, lit: !!o.studyLit }, '0,7': { door: true, sill: 0.1, h: 2.6, blind: 0, lit: !!o.studyLit } }, o.wins || {}) });
  const tile = S.tone('#b5583a', PH), tile2 = S.tone('#96462e', PH), tileHi = S.tone('#c96a48', PH), green = S.tone('#3f6a52', PH), greenD = S.tone('#2c4c3a', PH), greenHi = S.tone('#5a8a6c', PH), stone = S.tone('#cfc3a8', PH), stoneD = S.tone('#b2a68a', PH), stoneHi = S.tone('#e6dcc6', PH);
  const shade = S.tone('#5a4a3a', PH), iron = S.tone('#20242b', PH), potC = S.tone('#a84e34', PH), gera = S.tone('#d9372b', PH), leafC = S.tone('#3f6a3c', PH), lampC = S.tone(night ? '#ffe2a0' : '#d8d2c0', PH, night);
  const ry = B.roofY + 0.3, ch = { x0: 14.5, x1: 16.4, y1: 13.3 }, dx = B.winX(3), hfC = {}, hwC = {}, capC = S.tone('#8f8370', PH);
  // on the wall itself (behind anyone at a window): corner stones, the plinth, the shade
  // under the eaves, downpipes, and the stains the sills leave
  const houseWall = PH.add({ x0: B.x - 0.5, x1: B.x + B.w + 0.5, layer: 0, draw(ctx, env) {
    if (ry + 0.5 < env.y0 || 0 > env.y1) return;
    const s = env.s;
    R4(ctx, B.x, 0, B.w, 0.42, stoneD); R4(ctx, B.x, 0.4, B.w, 0.06, stoneHi);
    ctx.globalAlpha = 0.22; R4(ctx, B.x, ry - 0.9, B.w, 0.9, shade); R4(ctx, B.x, ry - 0.4, B.w, 0.4, shade); ctx.globalAlpha = 1;
    if (s > 2) esFill(ctx, hwC, 'qu', stone, (p) => { for (let i = 0; i < 14; i++) { const yy = 0.46 + i * 0.5, wq = i % 2 ? 0.5 : 0.85; if (yy > ry - 0.6) break; p.rect(B.x, yy, wq, 0.44); p.rect(B.x + B.w - wq, yy, wq, 0.44); } });
    if (s > 4) {
      esFill(ctx, hwC, 'dp', iron, (p) => { for (const px of [B.x + 1.0, B.x + B.w - 1.0]) { p.rect(px - 0.06, 0, 0.12, ry - 0.3); p.rect(px - 0.14, ry - 0.55, 0.28, 0.25); p.rect(px - 0.14, 0, 0.28, 0.12); } });
      ctx.globalAlpha = 0.12; esFill(ctx, hwC, 'sn', shade, (p) => { for (const key in B.wins) { const op = B.wins[key]; if (op.f !== 1) continue; const sd = op.c * 7 + 3; for (let i = 0; i < 3; i++) { const u = ydHash(sd, i * 3 + 1), v = ydHash(sd + 5, i * 3 + 2), sx = lerp(op.x + 0.2, op.x + op.w - 0.2, u), l = 0.9 * (0.35 + v * 0.65), wd = 0.05 + v * 0.09; p.moveTo(sx - wd, op.y - 0.1); p.lineTo(sx + wd, op.y - 0.1); p.lineTo(sx + wd * 0.2, op.y - 0.1 - l); p.closePath(); } } }); ctx.globalAlpha = 1;
    }
    if (s > 5) esFill(ctx, hwC, 'cb', stoneD, (p) => { for (let x = B.x + 0.6; x < B.x + B.w - 0.4; x += 1.2) p.rect(x, ry - 0.42, 0.22, 0.22); });
  } });
  PH.add({ x0: -12, x1: 28, layer: 1, draw(ctx, env) {
    if (ch.y1 + 1.5 < env.y0 || 0 > env.y1) return;
    const s = env.s;
    // louvred shutters, folded back each side of the upper and side windows
    const wins = []; for (const key in B.wins) wins.push(B.wins[key]);
    esFill(ctx, hfC, 'sh', green, (p) => { for (const op of wins) { if (op.door) continue; p.rect(op.x - 0.5, op.y, 0.42, op.h); p.rect(op.x + op.w + 0.08, op.y, 0.42, op.h); } });
    if (s > 4) {
      const near = s > 7;
      esStroke(ctx, env, hfC, near ? 'lv' : 'lf', near ? greenD : greenHi, 0.025, (p) => { for (const op of wins) { if (op.door) continue; for (const sx of [op.x - 0.46, op.x + op.w + 0.12]) { if (near) for (let yy = op.y + 0.14; yy < op.y + op.h - 0.1; yy += 0.12) { p.moveTo(sx, yy); p.lineTo(sx + 0.34, yy - 0.04); } else { p.moveTo(sx + 0.17, op.y + 0.1); p.lineTo(sx + 0.17, op.y + op.h - 0.1); } } } });
      if (near) esFill(ctx, hfC, 'sr', greenD, (p) => { for (const op of wins) { if (op.door) continue; for (const sx of [op.x - 0.5, op.x + op.w + 0.08]) { p.rect(sx, op.y + op.h * 0.5 - 0.04, 0.42, 0.08); p.rect(sx, op.y, 0.42, 0.06); p.rect(sx, op.y + op.h - 0.06, 0.42, 0.06); } } });
    }
    // window boxes of geraniums under the upper windows
    if (s > 2.5) {
      const boxed = (op) => op.f === 1 && op.c !== 3 && op.c !== 4;
      esFill(ctx, hfC, 'wb', potC, (p) => { for (const op of wins) if (boxed(op)) p.rect(op.x - 0.05, op.y - 0.32, op.w + 0.1, 0.26); });
      esFill(ctx, hfC, 'wl', leafC, (p) => { for (const op of wins) if (boxed(op)) for (let i = 0; i < 4; i++) esEll(p, op.x + 0.2 + i * (op.w - 0.4) / 3, op.y - 0.04, 0.24, 0.12); });
      if (s > 4) esFill(ctx, hfC, 'wg', gera, (p) => { for (const op of wins) if (boxed(op)) for (let i = 0; i < 6; i++) esEll(p, op.x + 0.1 + i * (op.w - 0.2) / 5, op.y + 0.04 + (i % 2) * 0.06, 0.07, 0.07); });
    }
    // the chimney: coursed stone, a cap, two pots
    R4(ctx, ch.x0, ry + 0.5, ch.x1 - ch.x0, ch.y1 - ry - 0.5, stone); R4(ctx, side > 0 ? ch.x0 : ch.x1 - 0.5, ry + 0.5, 0.5, ch.y1 - ry - 0.5, stoneD); R4(ctx, ch.x0 - 0.2, ch.y1 - 0.35, ch.x1 - ch.x0 + 0.4, 0.35, capC);
    esFill(ctx, hfC, 'cp', potC, (p) => { for (const px of [ch.x0 + 0.5, ch.x1 - 0.5]) ydShape(p, [px - 0.2, ch.y1, px + 0.2, ch.y1, px + 0.15, ch.y1 + 0.7, px - 0.15, ch.y1 + 0.7]); });
    if (s > 4) { esStroke(ctx, env, hfC, 'cc', stoneD, 0.03, (p) => esSegs(p, [ch.x0, ry + 1.4, ch.x1, ry + 1.4, ch.x0, ry + 2.3, ch.x1, ry + 2.3, ch.x0, ry + 3.2, ch.x1, ry + 3.2, ch.x0, ry + 4.1, ch.x1, ry + 4.1])); R4(ctx, ch.x0 - 0.05, ch.y1 + 0.62, 1.9 + 0.1, 0.08, iron); }
    // the roof: pantiles in courses, a ridge of round tiles, the eaves
    poly(ctx, [B.x - 0.8, ry, B.x + B.w + 0.8, ry, B.x + B.w - 3.4, ry + 2.5, B.x + 3.4, ry + 2.5], tile);
    R4(ctx, B.x - 0.8, ry - 0.12, B.w + 1.6, 0.2, tile2); R4(ctx, B.x + 3.3, ry + 2.42, B.w - 6.6, 0.16, tileHi);
    if (s > 2) {
      esStroke(ctx, env, hfC, 'rc', tile2, 0.03, (p) => { const pts = []; for (let i = 1; i < 5; i++) { const u = i / 5; pts.push(B.x - 0.8 + 4.2 * u, ry + 2.5 * u, B.x + B.w + 0.8 - 4.2 * u, ry + 2.5 * u); } pts.push(B.x - 0.8, ry, B.x + 3.4, ry + 2.5, B.x + B.w + 0.8, ry, B.x + B.w - 3.4, ry + 2.5); esSegs(p, pts); });
      if (s > 5) esStroke(ctx, env, hfC, 'rt', tile2, 0.03, (p) => { for (let x = B.x - 0.4; x < B.x + B.w + 0.4; x += 0.36) { const t0 = Math.max(0, (B.x + 3.4 - x) / 4.2, (x - (B.x + B.w - 3.4)) / 4.2); if (t0 >= 1) continue; p.moveTo(x, ry + 2.5 * t0); p.lineTo(x, ry + 2.44); } });
      if (s > 6) esFill(ctx, hfC, 'rr', tile2, (p) => { for (let x = B.x + 3.5; x < B.x + B.w - 3.5; x += 0.42) esEll(p, x, ry + 2.5, 0.18, 0.08); });
    }
    // the porch over the front door: columns, a pediment, steps, a lantern each side
    esFill(ctx, hfC, 'p1', stoneD, (p) => { p.rect(dx - 1.8, 0, 3.6, 0.14); for (const sx of [-1.5, 1.5]) { p.rect(dx + sx - 0.17, 0.26, 0.34, 0.12); p.rect(dx + sx - 0.17, 2.86, 0.34, 0.14); } });
    esFill(ctx, hfC, 'p2', stone, (p) => { p.rect(dx - 1.6, 0.14, 3.2, 0.12); p.rect(dx - 1.75, 3.0, 3.5, 0.25); });
    esFill(ctx, hfC, 'p3', tile, (p) => ydShape(p, [dx - 1.9, 3.25, dx + 1.9, 3.25, dx, 3.95]));
    esFill(ctx, hfC, 'p4', stoneHi, (p) => { ydShape(p, [dx - 1.5, 3.32, dx + 1.5, 3.32, dx, 3.8]); for (const sx of [-1.5, 1.5]) p.rect(dx + sx - 0.11, 0.38, 0.22, 2.48); });
    if (s > 3) { esFill(ctx, hfC, 'l1', iron, (p) => { p.rect(dx - 2.25, 1.95, 0.22, 0.38); p.rect(dx + 2.03, 1.95, 0.22, 0.38); }); esFill(ctx, hfC, 'l2', lampC, (p) => { p.rect(dx - 2.2, 2.0, 0.12, 0.26); p.rect(dx + 2.08, 2.0, 0.12, 0.26); }); }
    if (night) { ydGlow(ctx, dx - 2.14, 2.13, 0.9, 0.9, '255,214,140', 0.35); ydGlow(ctx, dx + 2.14, 2.13, 0.9, 0.9, '255,214,140', 0.35); }
  } });
  PH.solid(B.x, ry, B.w, 2.5, 'wall'); PH.solid(ch.x0, ry, ch.x1 - ch.x0, ch.y1 - ry, 'wall');
  H.chimney = ch;
  if (o.smoke) K.chimney(S, PH, (ch.x0 + ch.x1) / 2, ch.y1 - 1.8, { col: '#cfc3a8' });
  H.bal = K.balcony(S, PH, B, 1, 3, 4, { rail: '#2a2e36' });
  // loggia on the left of the house: five columns, four arches, a tiled roof, and in
  // its shade a back wall with niches, a pair of chairs and hanging lanterns
  const lgC = {}, lg = { back: S.tone(night ? '#1c201e' : '#3b3f3a', PH), back2: S.tone(night ? '#151816' : '#2f332f', PH), col: S.tone('#efe6d0', PH), colD: S.tone('#cfc4aa', PH), wall: S.tone(wall, PH), wallD: S.tone(darken(wall, 0.1), PH), chair: S.tone('#7a5c3c', PH), lant: S.tone('#1c1f26', PH) };
  PH.add({ x0: -24.6, x1: -9.6, layer: 0, draw(ctx, env) {
    if (5.5 < env.y0 || 0 > env.y1) return;
    const s = env.s;
    R4(ctx, -24, 0, 14, 4.4, lg.back);
    if (s > 2.5) { // niches in the back wall, a floor of shadow, two chairs and a table
      esFill(ctx, lgC, 'ni', lg.back2, (p) => { for (let i = 0; i < 4; i++) { const cx = -22.25 + i * 3.5; p.moveTo(cx - 0.6, 0.9); p.lineTo(cx - 0.6, 2.4); p.arc(cx, 2.4, 0.6, Math.PI, 0, true); p.lineTo(cx + 0.6, 0.9); p.closePath(); } p.rect(-24, 0, 14, 0.5); });
      if (s > 4) esStroke(ctx, env, lgC, 'ch', lg.chair, 0.05, (p) => esSegs(p, [-19.6, 0, -19.4, 0.95, -19.4, 0.95, -18.9, 0.95, -18.9, 0.95, -18.9, 0, -19.6, 0.5, -18.9, 0.5, -15.8, 0, -15.6, 0.95, -15.6, 0.95, -15.1, 0.95, -15.1, 0.95, -15.1, 0, -15.8, 0.5, -15.1, 0.5, -17.6, 0, -17.6, 0.7, -18.0, 0.7, -17.2, 0.7]));
    }
    // the frieze over the arches (with the spandrels between them) and the tiled roof
    esFill(ctx, lgC, 'fr', lg.wall, (p) => { p.rect(-24, 3.6, 14, 1.0); for (let i = 0; i < 4; i++) { const cx = -22.25 + i * 3.5; p.moveTo(cx - 1.55, 3.7); p.lineTo(cx - 1.55, 3.1); p.quadraticCurveTo(cx, 4.3, cx + 1.55, 3.1); p.lineTo(cx + 1.55, 3.7); p.closePath(); } });
    R4(ctx, -24, 3.6, 14, 0.12, lg.wallD);
    esFill(ctx, lgC, 'rf', tile, (p) => ydShape(p, [-24.5, 4.6, -10, 4.6, -10, 5.3, -23.6, 5.3])); R4(ctx, -24.5, 4.56, 14.5, 0.1, tile2);
    if (s > 3) esStroke(ctx, env, lgC, s > 6 ? 'rt1' : 'rt0', tile2, 0.025, (p) => { const pts = []; for (let i = 1; i < 3; i++) pts.push(-24.5 + 0.3 * i, 4.6 + 0.23 * i, -10, 4.6 + 0.23 * i); if (s > 6) for (let x = -23.4; x < -10; x += 0.36) pts.push(x, 4.62, x, 5.28); esSegs(p, pts); });
    // columns with their bases, capitals and shaded side
    esFill(ctx, lgC, 'co', lg.col, (p) => { for (let i = 0; i < 5; i++) p.rect(-24 + i * 3.5 - 0.2, 0, 0.45, 3.7); });
    if (s > 3) {
      esFill(ctx, lgC, 'cd', lg.colD, (p) => { for (let i = 0; i < 5; i++) { const cx = -24 + i * 3.5; p.rect(cx - 0.3, 0, 0.65, 0.2); p.rect(cx - 0.3, 3.45, 0.65, 0.2); p.rect(cx + (side > 0 ? -0.2 : 0.11), 0.2, 0.14, 3.25); } });
      // the curve of each arch picked out, a keystone, and a lantern hanging in each bay
      esStroke(ctx, env, lgC, 'ar', lg.colD, 0.05, (p) => { for (let i = 0; i < 4; i++) { const cx = -22.25 + i * 3.5; p.moveTo(cx - 1.55, 3.1); p.quadraticCurveTo(cx, 4.3, cx + 1.55, 3.1); } });
      esFill(ctx, lgC, 'ks', lg.col, (p) => { for (let i = 0; i < 4; i++) { const cx = -22.25 + i * 3.5; ydShape(p, [cx - 0.14, 3.62, cx + 0.14, 3.62, cx + 0.2, 4.0, cx - 0.2, 4.0]); } });
      if (s > 5) { esStroke(ctx, env, lgC, 'lc', lg.lant, 0.02, (p) => { for (let i = 0; i < 4; i++) { const cx = -22.25 + i * 3.5; p.moveTo(cx, 3.72); p.lineTo(cx, 3.2); } }); esFill(ctx, lgC, 'la', lg.lant, (p) => { for (let i = 0; i < 4; i++) { const cx = -22.25 + i * 3.5; ydShape(p, [cx - 0.13, 3.2, cx + 0.13, 3.2, cx + 0.1, 2.85, cx - 0.1, 2.85]); } }); }
    }
  } });
  PH.solid(-24, 3.6, 14, 1.7, 'wall');
  // garage on the far left: plastered, panelled doors, a lamp over each, a tiled edge
  const gar = H.garage = { x0: -58, x1: -44, h: 4.2 };
  const gc = { wall: S.tone('#d2c6aa', PH), wallD: S.tone('#b9ad90', PH), door: S.tone('#6f7a72', PH), doorD: S.tone('#59635c', PH), doorHi: S.tone('#86918a', PH) };
  PH.add({ x0: gar.x0, x1: gar.x1, layer: 0, draw(ctx, env) {
    if (gar.h + 1 < env.y0 || 0 > env.y1) return;
    const s = env.s;
    R4(ctx, gar.x0, 0, 14, gar.h, gc.wall); R4(ctx, gar.x0, 0, 14, 0.35, gc.wallD); R4(ctx, gar.x0 - 0.3, gar.h - 0.35, 14.6, 0.35, tile2);
    ctx.globalAlpha = 0.2; R4(ctx, gar.x0, gar.h - 0.95, 14, 0.6, shade); ctx.globalAlpha = 1;
    for (let i = 0; i < 2; i++) { const ddx = gar.x0 + 1.2 + i * 6.4; R4(ctx, ddx - 0.15, 0, 5.5, 3.15, gc.wallD); R4(ctx, ddx, 0, 5.2, 3.0, gc.door);
      if (s > 2.5) { ctx.fillStyle = gc.doorD; ctx.beginPath(); for (let yy = 0.4; yy < 3.0; yy += 0.5) ctx.rect(ddx, yy, 5.2, 0.07); if (s > 6) for (let k = 1; k < 4; k++) ctx.rect(ddx + k * 1.3, 0.1, 0.04, 2.8); ctx.fill(); }
      if (s > 6) { R4(ctx, ddx + 2.4, 0.9, 0.4, 0.06, gc.doorHi); } }
    if (s > 3) { ctx.fillStyle = iron; ctx.beginPath(); for (let i = 0; i < 2; i++) { const lx = gar.x0 + 3.8 + i * 6.4; ctx.rect(lx - 0.15, 3.3, 0.3, 0.32); } ctx.fill(); }
  } });
  PH.solid(gar.x0, 0, 14, gar.h, 'wall');
  // glasshouse on the right
  K.glasshouse(S, PH, 33, 13, 4.4);
  H.glass = { x0: 33, x1: 46 };
  K.cypress(S, PH, -40.5, 9, { solid: false }); K.cypress(S, PH, -36.5, 7.5, { solid: false }); K.cypress(S, PH, 29.4, 8.5, { solid: false });

  // cameras (each watches one part of the grounds)
  H.cams = {};
  if (o.cams !== false) {
    H.cams.pool = K.thing(S, PH, 'cctv', gar.x1 + 0.4, 3.9, { id: 'cam_pool', zone: 'pool', range: 14, dir: 1 });
    H.cams.terrace = K.thing(S, PH, 'cctv', -10.5, 5.6, { id: 'cam_terrace', zone: 'terrace', range: 13, dir: 1 });
    H.cams.east = K.thing(S, PH, 'cctv', 46.4, 4.3, { id: 'cam_east', zone: 'east', range: 13.4, dir: -1 });
  }

  // ---- the garden (main plane) ----
  const PG = H.PG = S.plane(z, 'garden');
  K.ground(S, PG, { col: S.pal.grass, edge: mix(S.pal.grass, '#ffffff', 0.1) });
  esLawn(S, PG, { depth: 1.9, skip: [[-41.6, -17.8], [-13.8, 29.8]], x0: -90, x1: 90 });
  // the terrace: stone flags in staggered rows, a step at the front, and when it rains
  // the wet stone holds the lamps
  const pave = S.tone('#d9d0bc', PG), pave2 = S.tone('#bdb39d', PG), pave3 = S.tone('#cbc2ad', PG), wetC = S.tone('#9a927f', PG);
  PG.add({ x0: -14, x1: 30, layer: 0, draw(ctx, env) {
    if (0.2 < env.y0 || -1.8 > env.y1) return;
    const s = env.s;
    poly(ctx, [-13, 0, 29, 0, 29.6, -1.5, -13.6, -1.5], rain ? mix(pave, wetC, 0.5) : pave); R4(ctx, -13.6, -1.62, 43.2, 0.14, pave2);
    if (s > 2) {
      if (s > 4) { ctx.fillStyle = pave3; ctx.beginPath(); for (let i = 0; i < 40; i++) { const x = -12.6 + i * 1.03 + (i % 3) * 0.2; if (x < env.x0 - 2 || x > env.x1) continue; ctx.rect(x, i % 2 ? -0.74 : -1.48, 0.9, 0.7); } ctx.fill(); }
      ctx.fillStyle = pave2; ctx.beginPath(); for (let x = -12; x < 29; x += 2) { ctx.rect(x, -0.75, 0.05, 0.75); ctx.rect(x + 1 + (x - 8) * 0.004, -1.5, 0.05, 0.75); } ctx.rect(-13.3, -0.75, 42.6, 0.04); ctx.fill();
    }
    if (rain && dark > 0.3) { // long, broken reflections of the terrace lamps in the wet stone
      for (const id of ['lamp_t1', 'lamp_t2']) { const lp = H.lamps && H.lamps[id]; if (lp && lp.alive && lp.on !== false) esShimmer(ctx, env, lp.x, 0, 1.45, '255,225,160', 0.4, 0.26); }
    }
  } });
  H.poolBox = K.pool(S, PG, -40, -19, {});
  esUrn(S, PG, -17.6, {}); esUrn(S, PG, 61.4, { flower: '#f1ede2' });
  K.hedge(S, PG, 30.2, 30.8, 2.3, { layer: 0 }); K.hedge(S, PG, 33.2, 33.8, 2.3, { layer: 0 });
  // the arch over the way into the rose walk, trained on an iron hoop
  const arch = { c: S.tone('#3f6a3c', PG), hi: S.tone('#5a8a4c', PG), rose: S.tone('#e85d75', PG) };
  PG.add({ x0: 30, x1: 34, layer: 1, draw(ctx, env) {
    if (4.2 < env.y0 || 2 > env.y1) return;
    ctx.strokeStyle = arch.c; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(32, 2.3, 1.5, 0, Math.PI); ctx.stroke();
    if (env.s > 4) { ctx.fillStyle = arch.hi; ctx.beginPath(); for (let i = 0; i < 9; i++) { const an = 0.15 + i * 0.35; esEll(ctx, 32 + Math.cos(an) * 1.5, 2.3 + Math.sin(an) * 1.5 + 0.12, 0.2, 0.12); } ctx.fill(); ctx.fillStyle = arch.rose; ctx.beginPath(); for (let i = 0; i < 7; i++) { const an = 0.3 + i * 0.42; esEll(ctx, 32 + Math.cos(an) * 1.6, 2.3 + Math.sin(an) * 1.6, 0.08, 0.08); } ctx.fill(); }
  } });
  K.hedge(S, PG, 34.2, 60, 1.0, { layer: 0, flowers: ['#d9482b', '#e85d75', '#f1ede2', '#e8a23a'] });
  K.hedge(S, PG, -62, -42, 1.0, { layer: 0, flowers: ['#f1ede2', '#b56bb0'] });
  H.lamps = {};
  const lampAt = (id, x, zone, reach) => { H.lamps[id] = K.lamp(S, PG, x, 3.4, zone, { id, reach: reach || 8, arm: 0.5 }); };
  lampAt('lamp_pool', -42, 'pool'); lampAt('lamp_t1', -13.5, 'terrace'); lampAt('lamp_t2', 8.6, 'terrace'); lampAt('lamp_east', 44, 'east');
  if (o.brazier !== undefined) H.brazier = K.brazier(S, PG, o.brazier, 'terrace', { id: 'brazier' });
  if (o.party) {
    K.table(S, PG, -30, { umbrella: '#c8372d' }); K.table(S, PG, -24, { umbrella: '#f1ede2' }); K.table(S, PG, 14, { umbrella: '#2f6db5' }); K.table(S, PG, 21, { umbrella: '#e2b33c' });
    // the buffet: a long table under a white cloth, with food, glasses and flowers
    K.box(S, PG, -4.5, 0, 5, 0.85, '#f1ede2', { solid: false });
    const bf = { cloth: S.tone('#f1ede2', PG), fold: S.tone('#d6d0c2', PG), btl: S.tone('#3f8a5a', PG), btl2: S.tone('#c9ced3', PG), cake: S.tone('#e9d08a', PG), cake2: S.tone('#f6efe0', PG), plate: S.tone('#ffffff', PG), food: S.tone('#c8372d', PG), food2: S.tone('#e8a23a', PG), vase: S.tone('#2f6db5', PG), fl: S.tone('#e85d75', PG), leaf: S.tone('#3f6a3c', PG), glass: S.tone('#dfe9ee', PG), ice: S.tone('#9aa3aa', PG) };
    PG.add({ x0: -5, x1: 1, layer: 0, draw(ctx, env) {
      if (2 < env.y0 || 0 > env.y1) return;
      const s = env.s;
      if (s > 3) { ctx.fillStyle = bf.fold; ctx.beginPath(); for (let x = -4.4; x < 0.5; x += 0.55) ctx.rect(x, 0.05, 0.05, 0.62); ctx.rect(-4.5, 0.66, 5, 0.04); ctx.fill(); ctx.fillStyle = bf.cloth; ctx.beginPath(); for (let x = -4.5; x < 0.5; x += 0.5) { ctx.moveTo(x, 0.7); ctx.quadraticCurveTo(x + 0.25, 0.56, x + 0.5, 0.7); } ctx.fill(); }
      for (let i = 0; i < 6; i++) R4(ctx, -4.1 + i * 0.75, 0.85, 0.16, 0.36, i % 2 ? bf.btl : bf.btl2);
      circ(ctx, -0.4, 1.15, 0.34, bf.cake);
      if (s > 4) {
        R4(ctx, -0.74, 0.85, 0.68, 0.22, bf.cake2); R4(ctx, -0.6, 1.07, 0.4, 0.18, bf.cake2); circ(ctx, -0.4, 1.32, 0.06, bf.food);
        ctx.fillStyle = bf.plate; ctx.beginPath(); for (const px of [-3.75, -2.25, -1.5]) esEll(ctx, px, 0.88, 0.28, 0.05); ctx.fill();
        ctx.fillStyle = bf.food; ctx.beginPath(); for (const px of [-3.75, -1.5]) esEll(ctx, px, 0.94, 0.18, 0.06); ctx.fill(); ctx.fillStyle = bf.food2; ctx.beginPath(); esEll(ctx, -2.25, 0.94, 0.18, 0.06); ctx.fill();
        R4(ctx, -3.05, 0.85, 0.3, 0.32, bf.ice); R4(ctx, -2.98, 1.17, 0.07, 0.22, bf.btl); R4(ctx, -2.86, 1.17, 0.07, 0.18, bf.btl);
        R4(ctx, 0.05, 0.85, 0.16, 0.3, bf.vase); ctx.fillStyle = bf.leaf; ctx.beginPath(); esEll(ctx, 0.13, 1.25, 0.2, 0.12); ctx.fill(); ctx.fillStyle = bf.fl; ctx.beginPath(); for (let i = 0; i < 4; i++) esEll(ctx, 0.0 + i * 0.09, 1.3 + (i % 2) * 0.06, 0.05, 0.05); ctx.fill();
      }
      if (s > 7) { ctx.fillStyle = bf.glass; ctx.beginPath(); for (let i = 0; i < 6; i++) { const gx = -4.3 + i * 0.12 + (i > 2 ? 2.4 : 0); ydShape(ctx, [gx - 0.04, 1.02, gx + 0.04, 1.02, gx + 0.05, 1.12, gx - 0.05, 1.12]); ctx.rect(gx - 0.008, 0.86, 0.016, 0.16); ctx.rect(gx - 0.035, 0.85, 0.07, 0.015); } ctx.fill(); }
    } });
    K.bunting(S, PH, -10, 7.2, -24, 5.2, { sag: 0.7 }); K.bunting(S, PH, 26, 7.2, 33, 5.6, { sag: 0.5 });
  }

  // ---- the drive ----
  const PD = H.PD = S.plane(z - 16, 'drive');
  K.ground(S, PD, { col: night ? '#3a3c40' : '#b9ae98', edge: '#d8ceb8' });
  // gravel: two worn tracks, loose stones close up, a stone kerb, puddles in the rain
  const dv = { trk: S.tone(night ? '#2c2e32' : '#a39882', PD), stone: S.tone(night ? '#4a4c52' : '#d2c8b2', PD), stone2: S.tone(night ? '#26282c' : '#948a74', PD), kerb: S.tone('#cfc6b0', PD), pud: S.tone(night ? '#1c2230' : '#8a9aa8', PD) };
  PD.add({ x0: -90, x1: 90, layer: 0, draw(ctx, env) {
    if (0.2 < env.y0 || -1.6 > env.y1) return;
    const s = env.s, a = Math.max(-90, env.x0 - 1), b = Math.min(90, env.x1 + 1);
    ctx.fillStyle = dv.trk; ctx.beginPath(); ctx.rect(a, -0.3, b - a, 0.1); ctx.rect(a, -0.62, b - a, 0.12); ctx.fill();
    if (s > 3) R4(ctx, a, -1.05, b - a, 0.12, dv.kerb);
    if (rain && s > 2.5) { ctx.fillStyle = dv.pud; ctx.beginPath(); for (let i = -12; i < 12; i++) { const px = i * 7.3 + ydHash(i, 3) * 4; if (px < a - 2 || px > b + 2) continue; esEll(ctx, px, -0.45, 0.8 + ydHash(i, 5) * 1.2, 0.07); } ctx.fill(); }
    if (s > 26) { ctx.fillStyle = dv.stone; ctx.beginPath(); ydSpeck(ctx, env, a, b, -0.95, -0.04, 0.45, 5, 2, 0.04); ctx.fill(); ctx.fillStyle = dv.stone2; ctx.beginPath(); ydSpeck(ctx, env, a, b, -0.95, -0.04, 0.45, 23, 2, 0.04); ctx.fill(); }
  } });
  (o.cars || []).forEach((c) => K.parked(S, PD, c[0], c[1], c[2], c[3], { y: 0 }));
  // guard hut by the gate: boarded walls, a roof with an overhang, a lamp over the door
  const hut = H.hut = { x: 56, w: 4.2, room: 'gatehut' };
  S.room('gatehut', o.hutLit !== undefined ? o.hutLit : night);
  const hop = PD.open({ x: hut.x + 0.6, y: 1.0, w: 2.2, h: 1.3, room: 'gatehut', glass: true, blind: 0, deco: 5, tint: '#ffd98a', f: 0, c: 0 });
  PD.solid(hut.x, 0, hut.w, 3.0, 'wood');
  const hc = { wall: S.tone('#59635c', PD), wallD: S.tone('#47504a', PD), door: S.tone('#2a2420', PD), roof: S.tone('#2f3a34', PD), roofD: S.tone('#232b27', PD), sign: S.tone('#e9e0c8', PD) };
  PD.add({ x0: hut.x - 0.5, x1: hut.x + hut.w + 0.5, layer: 0, draw(ctx, env) {
    if (3.6 < env.y0 || 0 > env.y1) return;
    R4(ctx, hut.x, 0, hut.w, 2.8, hc.wall);
    if (env.s > 4) { ctx.fillStyle = hc.wallD; ctx.beginPath(); for (let yy = 0.25; yy < 2.8; yy += 0.25) ctx.rect(hut.x, yy, hut.w, 0.03); ctx.rect(hut.x, 0, hut.w, 0.2); ctx.fill(); }
    R4(ctx, hut.x + 3.1, 0, 0.9, 2.1, hc.door); drawWindowBack(ctx, env, S, PD, hop, S.tone(S.pal.glass, PD), S.tone(S.pal.inRoom, PD));
  } });
  PD.add({ x0: hut.x - 0.6, x1: hut.x + hut.w + 0.6, layer: 1, draw(ctx, env) {
    if (3.6 < env.y0 || 0 > env.y1) return;
    drawWindowFront(ctx, env, S, PD, hop, S.tone('#eef0ea', PD), true);
    poly(ctx, [hut.x - 0.5, 2.8, hut.x + hut.w + 0.5, 2.8, hut.x + hut.w - 0.2, 3.5, hut.x + 0.2, 3.5], hc.roof); R4(ctx, hut.x - 0.5, 2.74, hut.w + 1.0, 0.1, hc.roofD);
    if (env.s > 5) { R4(ctx, hut.x + 3.25, 2.25, 0.6, 0.3, hc.roofD); env.text(ctx, 'GATE', hut.x + 3.55, 2.33, 0.17, hc.sign, 'center'); }
  } });

  // ---- verge: low hedges, and (for the night job) a pair of cypresses ----
  const PC = H.PC = S.plane(z - 24, 'verge');
  K.ground(S, PC, { col: S.pal.grass, noEdge: true });
  esLawn(S, PC, { depth: 2.6, band: 3, x0: -110, x1: 110 });
  K.hedge(S, PC, -62, -2, 0.65, {}); K.hedge(S, PC, 4, 9, 0.65, {});
  (o.screen || []).forEach((x, i) => K.cypress(S, PC, x, 11 + (i % 2) * 0.8, { w: 2.6 }));

  // ---- front wall and gate ----
  const PF = H.PF = S.plane(z - 48, 'front wall');
  K.ground(S, PF, { col: night ? '#1f2a22' : '#8f9a62', noEdge: true });
  const gate = H.gate = { x0: 47.4, x1: 54.2 };
  // the lane outside the wall: a dirt road with two ruts and a grassy middle
  const ln = { road: S.tone(night ? '#2a2a26' : '#b3a582', PF), rut: S.tone(night ? '#1e1e1b' : '#998a68', PF), grav: S.tone(night ? '#34342e' : '#c7bb9c', PF) };
  const laneItem = PF.add({ x0: -110, x1: 110, layer: 0, draw(ctx, env) {
    if (0.2 < env.y0 || -3.6 > env.y1) return;
    const a = Math.max(-110, env.x0 - 1), b = Math.min(110, env.x1 + 1);
    R4(ctx, a, -3.2, b - a, 1.9, ln.road); ctx.fillStyle = ln.rut; ctx.beginPath(); ctx.rect(a, -1.75, b - a, 0.18); ctx.rect(a, -2.9, b - a, 0.2); ctx.fill();
    poly(ctx, [gate.x0 - 0.6, 0, gate.x1 + 0.6, 0, gate.x1 + 2.2, -1.4, gate.x0 - 2.2, -1.4], ln.grav);
  } });
  K.fence(S, PF, -110, gate.x0, 2.0, { kind: 'wall', col: '#d9cdb2', layer: 0 }); K.fence(S, PF, gate.x1, 110, 2.0, { kind: 'wall', col: '#d9cdb2', layer: 0 });
  const fwC = {}, fw = { pc: S.tone('#c4b79a', PF), pcD: S.tone('#a99c80', PF), pcHi: S.tone('#ddd2b8', PF), iron: S.tone('#20242b', PF), moss: S.tone('#5a6a3c', PF), brass: S.tone('#c9a23a', PF), plq: S.tone('#2a2420', PF) };
  PF.add({ x0: -110, x1: 110, layer: 1, draw(ctx, env) {
    if (3.6 < env.y0 || 0 > env.y1) return;
    const s = env.s;
    if (s > 3.5) { // courses on the wall face, and the green stain where rain runs off the coping
      esFill(ctx, fwC, 'co', fw.pcD, (p) => { for (let yy = 0.4; yy < 1.85; yy += 0.4) { p.rect(-110, yy, gate.x0 + 110, 0.03); p.rect(gate.x1, yy, 110 - gate.x1, 0.03); } });
      ctx.globalAlpha = 0.22; esFill(ctx, fwC, 'st', fw.moss, (p) => { for (let x = -108; x < 110; x += 12) { if (x + 12 >= gate.x0 - 1 && x <= gate.x1 + 1) continue; const sd = (x & 1023) + 7; for (let i = 0; i < 7; i++) { const u = ydHash(sd, i * 3 + 1), v = ydHash(sd + 5, i * 3 + 2), sx = lerp(x + 0.6, x + 11.4, u), l = 0.9 * (0.35 + v * 0.65), wd = 0.05 + v * 0.09; p.moveTo(sx - wd, 1.86); p.lineTo(sx + wd, 1.86); p.lineTo(sx + wd * 0.2, 1.86 - l); p.closePath(); } } }); ctx.globalAlpha = 1;
    }
    // piers with stepped caps and a stone ball every twelve metres; the gate piers have plain
    // flat caps (a lamp stands on each)
    esFill(ctx, fwC, s > 2 ? 'p1' : 'p0', fw.pc, (p) => { for (let x = -108; x < 110; x += 12) if (x < gate.x0 - 2 || x > gate.x1 + 2) { p.rect(x - 0.3, 0, 0.6, 2.25); p.rect(x - 0.4, 2.25, 0.8, 0.12); if (s > 2) esEll(p, x, 2.55, 0.2, 0.2); } p.rect(gate.x0 - 0.9, 0, 0.9, 2.9); p.rect(gate.x1, 0, 0.9, 2.9); });
    esFill(ctx, fwC, 'gc', fw.pcHi, (p) => { p.rect(gate.x0 - 1.05, 2.9, 1.2, 0.2); p.rect(gate.x1 - 0.15, 2.9, 1.2, 0.2); });
    if (s > 3) { esFill(ctx, fwC, 'gs', fw.pcD, (p) => { p.rect(side > 0 ? gate.x0 - 0.9 : gate.x0 - 0.3, 0, 0.3, 2.9); p.rect(side > 0 ? gate.x1 : gate.x1 + 0.6, 0, 0.3, 2.9); }); R4(ctx, gate.x0 - 0.75, 1.3, 0.6, 0.4, fw.plq); if (s > 8) env.text(ctx, 'VILLA', gate.x0 - 0.45, 1.44, 0.14, fw.brass, 'center'); }
    // iron leaves, swung open: bars with spear tops, rails, and scrolls
    esStroke(ctx, env, fwC, s > 6 ? 'g2' : s > 3 ? 'g1' : 'g0', fw.iron, 0.05, (p) => { const pts = [];
      for (let i = 0; i < 5; i++) pts.push(gate.x0 + i * 0.22, 0, gate.x0 + i * 0.22, 2.2 + i * 0.05, gate.x1 - i * 0.22, 0, gate.x1 - i * 0.22, 2.2 + i * 0.05);
      if (s > 3) pts.push(gate.x0, 0.3, gate.x0 + 0.88, 0.3, gate.x0, 1.9, gate.x0 + 0.88, 2.0, gate.x1, 0.3, gate.x1 - 0.88, 0.3, gate.x1, 1.9, gate.x1 - 0.88, 2.0);
      esSegs(p, pts);
      if (s > 6) for (const g of [[gate.x0 + 0.44, 1], [gate.x1 - 0.44, -1]]) { p.moveTo(g[0] + 0.15, 1.1); p.arc(g[0], 1.1, 0.15, 0, TAU); p.moveTo(g[0] + 0.3 * g[1], 2.0); p.quadraticCurveTo(g[0], 1.6, g[0] - 0.3 * g[1], 2.0); } });
    if (s > 5) esFill(ctx, fwC, 'sp', fw.iron, (p) => { for (let i = 0; i < 5; i++) for (const gx of [gate.x0 + i * 0.22, gate.x1 - i * 0.22]) ydShape(p, [gx - 0.05, 2.2 + i * 0.05, gx + 0.05, 2.2 + i * 0.05, gx, 2.36 + i * 0.05]); });
  } });
  PF.solid(gate.x0 - 0.9, 0, 0.9, 2.9, 'wall'); PF.solid(gate.x1, 0, 0.9, 2.9, 'wall');
  H.lamps.gate1 = K.lamp(S, PF, gate.x0 - 0.45, 3.3, 'drive', { id: 'lamp_gate1', reach: 10, arm: 0 });
  H.lamps.gate2 = K.lamp(S, PF, gate.x1 + 0.45, 3.3, 'drive', { id: 'lamp_gate2', reach: 10, arm: 0 });
  if (o.cams !== false) H.cams.gate = K.thing(S, PF, 'cctv', gate.x0 - 1.4, 2.6, { id: 'cam_gate', zone: 'drive', range: 12, dir: -1 });

  // ---- olive grove outside the wall ----
  const PT = H.PT = S.plane(z - 84, 'grove');
  K.ground(S, PT, { col: night ? '#1a231c' : '#9aa068', noEdge: true });
  // dry-stone terraces stepping down the slope, with tufts of dry grass and loose stones
  const gv = { wall: S.tone(night ? '#2a2c26' : '#b8ad8e', PT), wallD: S.tone(night ? '#1c1e1a' : '#8f8668', PT), dry: S.tone(night ? '#222a20' : '#b0aa70', PT), dryD: S.tone(night ? '#161c15' : '#7f8450', PT) };
  PT.add({ x0: -200, x1: 200, layer: 0, draw(ctx, env) {
    if (0.3 < env.y0) return;
    const s = env.s, a = Math.max(-200, env.x0 - 1), b = Math.min(200, env.x1 + 1);
    const rows = []; for (let r = 0; r < 9; r++) { const yy = -2.2 - r * 3.4 - r * r * 0.25; if (yy + 0.6 >= env.y0 && yy - 0.4 <= env.y1) rows.push([r, yy]); }
    ctx.fillStyle = gv.wall; ctx.beginPath(); for (const q of rows) ctx.rect(a, q[1] - 0.12, b - a, 0.5); ctx.fill();
    ctx.fillStyle = gv.wallD; ctx.beginPath(); for (const q of rows) ctx.rect(a, q[1] - 0.18, b - a, 0.08); ctx.fill();
    for (const [r, yy] of rows) {
      if (s > 14) { ctx.fillStyle = gv.wallD; ctx.beginPath(); const c0 = Math.floor(a / 0.7), c1 = Math.floor(b / 0.7); for (let i = c0; i <= c1; i++) { ctx.rect(i * 0.7 + ydHash(i, r) * 0.2, yy + 0.08, 0.04, 0.2); ctx.rect(i * 0.7 + 0.35, yy - 0.1, 0.04, 0.18); } ctx.rect(a, yy + 0.1, b - a, 0.025); ctx.fill(); } }
    if (s > 14) for (let pass = 0; pass < 2; pass++) { ctx.fillStyle = pass ? gv.dryD : gv.dry; ctx.beginPath(); const c0 = Math.floor(a / 0.9), c1 = Math.floor(b / 0.9); for (let i = c0; i <= c1; i++) { const u = ydHash(i, 41 + pass), v = ydHash(i, 43 + pass); const yy = -0.3 - v * 12; if (yy > env.y1 || yy < env.y0) continue; ydTuft(ctx, (i + u) * 0.9, yy, 0.18 + u * 0.12, (env.wind || 0) * 0.01); } ctx.fill(); }
  } });
  [-96, -78, -61, -47, -30, -14, 3, 19, 37, 52, 70, 88].forEach((x, i) => K.tree(S, PT, x + (i % 3) * 1.5, 3.6 + (i % 4) * 0.35, { col: '#7d9a6a', solid: false }));

  // placements
  H.zoneOf = (x) => (x < -16 ? 'pool' : x <= 30 ? 'terrace' : 'east');
  H.lawn = (x, extra) => Object.assign({ plane: PG, x, y: 0, zone: H.zoneOf(x), behind: false, room: null }, extra || {});
  H.drive = (x, extra) => Object.assign({ plane: PD, x, y: 0, zone: 'drive', behind: false, room: null }, extra || {});
  H.inWin = (f, c, dx, extra) => { const op = B.win(f, c); return Object.assign({ plane: PH, x: B.winX(c) + (dx || 0), y: B.floorY(f), room: op.room, zone: op.room, behind: true }, extra || {}); };
  H.study = (x, extra) => Object.assign({ plane: PH, x, y: 0, room: 'house:study', zone: 'house:study', behind: true }, extra || {});
  H.inHut = (extra) => Object.assign({ plane: PD, x: hut.x + 1.7, y: 0, room: 'gatehut', zone: 'gatehut', behind: true }, extra || {});
  H.onBalcony = (x, extra) => Object.assign({ plane: PH, x, y: H.bal.y, room: null, zone: H.bal.zone, behind: false }, extra || {});
  esDetail(S, H, { houseWall, laneItem, PHl, night, rain, side, trees: [-96, -78, -61, -47, -30, -14, 3, 19, 37, 52, 70, 88].map((x, i) => x + (i % 3) * 1.5) });
  return H;
};

// ---- an estate that is lived in ------------------------------------------------------
// Detail for looks only, from the scene kit's static layers (K.deco): hairline cracks in
// the render, rising damp, patched plaster and green streaks on the house, lichen and cracks
// on the walls, harvest nets, poppies and beehives in the olive grove, gravel and ruts on the
// drive and the lane, lemon trees in pots and a sprinkler in the east garden, and a farm with
// a cypress avenue on the vineyard hill. Everything lies on the ground, sits on a wall that
// already hides what is behind it, or stands low at the far end of the garden where nobody
// goes; nothing is solid or shootable.
function esDetail(S, H, q) {
  const B = H.house, PH = H.PH, night = q.night, rain = q.rain, side = q.side;
  const wins = Object.keys(B.wins).map((k) => B.wins[k]);
  const onWin = (x, y, m) => wins.some((op) => x > op.x - m && x < op.x + op.w + m && y > op.y - m && y < op.y + op.h + m);
  // ---- the house front: plaster that has lived through a lot of summers ----
  K.deco(S, PH, { after: q.houseWall, seed: 5101 }, (D, R) => {
    const x0 = B.x, x1 = B.x + B.w, top = B.roofY;
    // rising damp above the plinth: a darker band with a ragged edge, a salt line along its top
    KW.grime(D, R, x0 + 0.9, x1 - 0.9, 0.46, 0.75, '#8a7a5a', 0.3);
    for (let x = x0 + 1; x < x1 - 1; x += R.r(0.4, 1.0)) D.rect(x, 0.46 + R.r(0.45, 0.72), R.r(0.3, 0.9), 0.03, '#f4efe2', 0.45);
    // patches where the plaster has been made good, a shade off the rest
    for (let i = 0; i < 9; i++) { const w = R.r(0.7, 1.8), h = R.r(0.5, 1.2), x = R.r(x0 + 1, x1 - 1 - w), y = R.r(1.0, top - 1.5 - h); if (onWin(x + w / 2, y + h / 2, 0.6 + w / 2)) continue; D.rect(x, y, w, h, R.chance(0.5) ? '#efe6d0' : '#d8ccb0', 0.7); }
    // hairline cracks running out from the corners of the windows, the way old plaster goes
    for (const op of wins) {
      if (R.chance(0.45)) KW.cracks(D, R, op.x + op.w + 0.05, op.y + op.h + 0.05, R.r(0.5, 1.1), '#8a7c62', { dir: R.r(0.5, 1.1), w: 0.018, a: 0.6 });
      if (R.chance(0.35)) KW.cracks(D, R, op.x - 0.05, op.y - 0.05, R.r(0.4, 0.9), '#8a7c62', { dir: Math.PI + R.r(0.5, 1.0), w: 0.018, a: 0.6 });
    }
    // green and grey streaks where the gutter overflows at each end
    for (const ex of [x0 + 1.4, x1 - 1.6]) KW.streaks(D, R, ex - 0.5, ex + 0.5, top - 0.35, '#6a7a52', { n: 4, len: [1.2, 3.2], w: [0.1, 0.22], a: 0.25 });
    // paint coming away from the plinth here and there
    for (let i = 0; i < 6; i++) KW.peel(D, R, R.r(x0 + 1, x1 - 1), 0.22, R.r(0.3, 0.6), 0.16, '#b2a68a', 0.6);
  });
  // the garage and the loggia front: cracks, a stain where the gutter drips, oil on the apron
  K.deco(S, PH, { seed: 5113 }, (D, R) => {
    const g = H.garage;
    for (let i = 0; i < 4; i++) KW.cracks(D, R, R.r(g.x0 + 0.5, g.x1 - 0.5), R.r(3.2, 3.8), R.r(0.4, 0.9), '#8a7c62', { w: 0.018, a: 0.55 });
    KW.streaks(D, R, g.x0 + 0.2, g.x1 - 0.2, g.h - 0.35, '#7a6a4a', { per: 0.5, len: [0.3, 1.0], w: [0.06, 0.14], a: 0.22 });
    KW.grime(D, R, g.x0, g.x1, 0, 0.5, '#5a5040', 0.25);
  });
  K.deco(S, PH, { seed: 5117 }, (D, R) => {                 // (over the gravel path in front)
    const g = H.garage;
    for (let i = 0; i < 2; i++) KW.blob(D, R, g.x0 + 3.8 + i * 6.4, -0.25, 1.1, 0.12, '#3a3630', 0.4, 0.25);
  });

  // ---- the rear wall and the tower: lichen, and cracks in the old stone ----
  K.deco(S, H.PRW, { seed: 5121 }, (D, R) => {
    for (let i = 0; i < 160; i++) D.ell(R.r(-90, 90), R.r(0.2, 2.3), R.r(0.06, 0.16), R.r(0.04, 0.1), R.chance(0.6) ? '#a8ac84' : '#8a9466', 0.6);
    for (let i = 0; i < 14; i++) KW.cracks(D, R, R.r(-88, 88), R.r(1.4, 2.4), R.r(0.4, 1.0), '#7a6e58', { w: 0.02, a: 0.5 });
    KW.grime(D, R, -90, 90, 0, 0.45, '#5a5a3e', 0.25);
  });
  K.deco(S, H.PB, { seed: 5125 }, (D, R) => {
    const x0 = 13, x1 = 19;
    for (let i = 0; i < 30; i++) D.ell(R.r(x0 + 0.2, x1 - 0.2), R.r(0.3, 8.6), R.r(0.05, 0.14), R.r(0.04, 0.09), '#a8ac84', 0.55);
    KW.streaks(D, R, x0 + 0.2, x1 - 0.2, 8.8, '#6a6a4a', { n: 6, len: [1, 3.5], w: [0.08, 0.2], a: 0.22 });
    KW.cracks(D, R, x0 + 4.6, 6.2, 1.2, '#7a6e58', { w: 0.02, a: 0.5 });
  });

  // ---- the front wall and the lane outside it ----
  const gate = H.gate;
  K.deco(S, H.PF, { seed: 5131 }, (D, R) => {
    for (let i = 0; i < 150; i++) { const x = R.r(-110, 110); if (x > gate.x0 - 1.2 && x < gate.x1 + 1.2) continue; D.ell(x, R.r(0.15, 1.8), R.r(0.06, 0.16), R.r(0.04, 0.1), R.chance(0.6) ? '#a8ac84' : '#8a9466', 0.6); }
    for (let i = 0; i < 16; i++) { const x = R.r(-108, 108); if (x > gate.x0 - 2 && x < gate.x1 + 2) continue; KW.cracks(D, R, x, R.r(1.2, 1.9), R.r(0.4, 1.0), '#7a6e58', { w: 0.02, a: 0.5 }); }
    for (let x = -110; x < 110; x += R.r(3, 9)) { if (x > gate.x0 - 2 && x < gate.x1 + 2) continue; KW.moss(D, R, x, x + R.r(0.8, 2.4), 0.02, 0.1, night ? '#2a3a26' : '#5a6a3c', 0.85); }
  });
  K.deco(S, H.PF, { after: q.laneItem, seed: 5133 }, (D, R) => {
    // grass down the middle of the lane, potholes holding water, stones thrown out of the ruts
    for (let x = -110; x < 110; x += R.r(0.4, 1.4)) KC.tuft(D, R, x, -2.35 + R.r(-0.12, 0.12), R.r(0.12, 0.26), night ? '#24301e' : '#7a8a48');
    for (let i = 0; i < 18; i++) { const x = R.r(-108, 108), y = R.chance(0.5) ? -1.66 : -2.8, rx = R.r(0.4, 1.0); D.ell(x, y, rx, 0.09, night ? '#16161a' : '#7a6c50', 0.7); if (rain || !night) { D.pass = 1; D.ell(x - rx * 0.1, y + 0.01, rx * 0.7, 0.05, rain ? (night ? '#2a3448' : '#9fb0bc') : '#8f8062', 0.8); D.pass = 0; } }
    D.pass = 2; for (let i = 0; i < 160; i++) D.rect(R.r(-110, 110), -R.r(1.4, 3.1), R.r(0.06, 0.14), 0.05, night ? '#40403a' : '#d8ccae', 0.9); D.pass = 0;
  });

  // ---- the drive: more gravel, the marks the cars leave ----
  K.deco(S, H.PD, { ground: true, seed: 5141 }, (D, R) => {
    const st = night ? '#4a4c52' : '#d2c8b2', st2 = night ? '#26282c' : '#948a74';
    for (let i = 0; i < 420; i++) D.rect(R.r(-90, 90), -R.r(0.05, 0.95), R.r(0.05, 0.11), 0.04, R.chance(0.5) ? st : st2, 0.95);
    for (let i = 0; i < 12; i++) KW.blob(D, R, R.r(-88, 88), -R.r(0.2, 0.7), R.r(0.4, 1.2), 0.07, night ? '#1c1d20' : '#7a705c', 0.35, 0.25);
    for (let i = 0; i < 6; i++) { const x = R.r(-80, 70), l = R.r(5, 14); D.line([x, -0.42, x + l * 0.5, -0.45 + R.r(-0.04, 0.04), x + l, -0.4], 0.05, night ? '#202226' : '#9a8f78', 0.6); }
  });

  // ---- the olive grove outside the wall: harvest nets under the trees, poppies, beehives ----
  K.deco(S, H.PT, { ground: true, seed: 5151 }, (D, R) => {
    const dry = night ? '#20281c' : '#a8a46a', dry2 = night ? '#161c14' : '#8a8a52';
    for (let i = 0; i < 70; i++) { const rx = R.r(1.5, 5); KW.blob(D, R, R.r(-200, 200), -R.r(0.6, 22), rx, R.r(0.12, 0.3), R.chance(0.5) ? dry : dry2, 0.5, 0.25); }
    // nets spread under the trees for the picking, green and black, with olives lying on them
    for (const tx of q.trees) {
      if (R.chance(0.3)) continue;
      const c = R.chance(0.5) ? (night ? '#1c2a22' : '#4f7a5a') : (night ? '#141616' : '#3a3e3a'), w = R.r(5, 8), p = [tx - w / 2, -0.12];
      for (let k = 1; k <= 4; k++) p.push(tx - w / 2 + (w * k) / 4, -0.1 + R.r(-0.04, 0.04));
      p.push(tx + w / 2 + 0.6, -0.95); for (let k = 3; k >= 1; k--) p.push(tx - w / 2 - 0.4 + ((w + 1) * k) / 4, -0.95 + R.r(-0.06, 0.06)); p.push(tx - w / 2 - 0.4, -0.95);
      D.poly(p, c, 0.55, 0.5);
      if (!night) { D.pass = 1; for (let k = 0; k < 20; k++) D.ell(tx + R.r(-w / 2, w / 2), -R.r(0.25, 0.85), 0.05, 0.035, '#3a3a2a', 0.9); D.pass = 0; }
    }
    // a pair of crates of picked olives, and a ladder lying in the grass
    D.pass = 1; KC.crate(D, q.trees[5] + 2.8, -1.6, 0.7, 0.45, '#8a6a45'); KC.crate(D, q.trees[5] + 3.6, -1.65, 0.7, 0.45, '#7a5c3c');
    D.poly([q.trees[8] - 3, -1.9, q.trees[8] + 0.8, -1.7, q.trees[8] + 0.8, -1.6, q.trees[8] - 3, -1.8], '#8a6a45');
    // poppies along the terraces, and a few white campion among them
    if (!night) for (let i = 0; i < 90; i++) {
      const cx = R.r(-200, 200), cy = -R.r(1, 20), n = R.i(3, 8);
      D.pass = 1; for (let k = 0; k < n; k++) D.ell(cx + R.gauss() * 0.6, cy + R.gauss() * 0.12, 0.1, 0.08, R.chance(0.8) ? '#d9372b' : '#f1ede2');
    }
    // a stone field hut among the olives: rough walls, a pantiled roof, a plank door
    { const hx = 26, hy = -10.6, w = 4.2, h = 2.4, st = night ? '#2a2c26' : '#b8ad8e', stD = night ? '#1c1e1a' : '#8f8668';
      D.pass = 2; D.rect(hx, hy, w, h, st); D.poly([hx - 0.4, hy + h, hx + w + 0.4, hy + h, hx + w - 0.3, hy + h + 1.1, hx + 0.3, hy + h + 1.1], night ? '#2a1e1a' : '#a84e34');
      D.pass = 3; D.rect(hx + 1.6, hy, 0.95, 1.8, night ? '#161412' : '#5a4632'); D.rect(hx + 0.4, hy + 1.2, 0.6, 0.5, night ? '#121210' : '#3a3630');
      for (let k = 0; k < 18; k++) D.rect(hx + R.r(0.1, w - 0.5), hy + R.r(0.1, h - 0.3), R.r(0.25, 0.5), 0.16, stD, 0.7);
      for (let k = 1; k < 4; k++) D.rect(hx - 0.3 + k * 0.1, hy + h + k * 0.27, w + 0.6 - k * 0.2, 0.05, night ? '#1e1612' : '#8a3e2a', 0.8);
      D.pass = 0; }
    // beehives on one terrace: white boxes on stands, their roofs a little darker
    for (let k = 0; k < 4; k++) { const hx = -122 + k * 1.4, hy = -6.9; D.pass = 2; D.rect(hx + 0.08, hy, 0.06, 0.25, '#4a3a2c'); D.rect(hx + 0.62, hy, 0.06, 0.25, '#4a3a2c'); D.rect(hx, hy + 0.25, 0.76, 0.5, night ? '#5a5c58' : '#efe8d6'); D.pass = 3; D.rect(hx - 0.05, hy + 0.75, 0.86, 0.1, night ? '#3a3c3a' : '#b8b0a0'); D.rect(hx + 0.2, hy + 0.3, 0.36, 0.04, '#2a2420'); }
    D.pass = 0;
  });

  // ---- the east garden: lemon trees in pots, and a sprinkler going round ----
  const PG = H.PG;
  K.deco(S, PG, { seed: 5161 }, (D, R) => {
    for (const px of [63.6, 66.8]) {
      D.poly([px - 0.38, 0, px + 0.38, 0, px + 0.46, 0.62, px - 0.46, 0.62], '#b5583a'); D.rect(px - 0.5, 0.58, 1.0, 0.1, '#c96a48');
      D.rect(px - 0.04, 0.68, 0.08, 0.5, '#5a4632');
      KC.bush(D, R, px, 1.05, 1.2, 0.7, '#3f6a3c');
      D.pass = 2; for (let k = 0; k < 9; k++) D.ell(px + R.r(-0.5, 0.5), 1.1 + R.r(0.1, 0.6), 0.08, 0.09, '#f1d24a'); D.pass = 0;
    }
  });
  if (!night && !rain) {
    const sx = 71.5, wc = S.tone('#dfeef6', PG, true);
    PG.add({ x0: sx - 5, x1: sx + 5, layer: 0, draw(ctx, env) {
      if (env.s < 3 || 2.4 < env.y0 || -0.3 > env.y1) return;
      R4(ctx, sx - 0.06, -0.05, 0.12, 0.3, S.tone('#2a2e36', PG));
      // drops thrown up from the head, each flying its own arc; the head swings slowly side to side,
      // so the spray fans out one way and then the other
      const t = env.t, r = Math.max(0.03, env.px * 0.8);
      ctx.fillStyle = wc; ctx.globalAlpha = 0.8; ctx.beginPath();
      for (let k = 0; k < 26; k++) {
        const age = ((t + k / 26) % 1) * 0.95, te = t - age, an = Math.PI / 2 + 0.95 * Math.sin(te * 0.7), v = 4.4 + (k % 3) * 0.3;
        const x = sx + Math.cos(an) * v * age, y = 0.28 + Math.sin(an) * v * age - 4.9 * age * age; if (y < 0) continue;
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
      }
      ctx.fill(); ctx.globalAlpha = 1;
    } });
  }

  // ---- far off: a farm on the vineyard hill, with a line of cypresses up its track ----
  const PHl = q.PHl, hA = PHl.heightAt;
  K.deco(S, PHl, { seed: 5171 }, (D, R) => {
    for (const fx of [-138, 112]) {
      const y = hA(fx) - 9;
      D.rect(fx - 4, y, 8, 4.2, night ? '#3a3a3c' : '#e6dcc4'); D.rect(fx + 1.2, y, 4.5, 3.0, night ? '#323234' : '#d8ccb0');
      D.rect(fx - 2.45, y + 4.3, 0.5, 1.7, night ? '#2a2a2c' : '#c9bea4'); D.poly([fx - 4.6, y + 4.2, fx + 4.6, y + 4.2, fx, y + 6.2], night ? '#2a1e1a' : '#b5583a'); D.poly([fx + 0.8, y + 3.0, fx + 6.1, y + 3.0, fx + 3.4, y + 4.3], night ? '#2a1e1a' : '#a84e34');
      D.pass = 1; for (let k = 0; k < 3; k++) D.rect(fx - 3.2 + k * 2.1, y + 1.8, 0.8, 1.0, night ? '#ffd98a' : '#4a4038'); D.rect(fx + 2.4, y, 1.4, 2.0, night ? '#20201e' : '#6a5440'); D.pass = 0;
      // the track down the hill, lined with cypresses
      const dir = fx < 0 ? 1 : -1, trk = [fx + dir * 4, y - 0.2], cyp = [];
      for (let k = 1; k <= 7; k++) { const tx = fx + dir * (4 + k * 6.5), ty = Math.min(hA(tx) - 3, y - 0.2 - k * 1.7); trk.push(tx, ty); cyp.push(tx + dir * 0.9, ty + 0.2); }
      D.line(trk, 0.7, night ? '#26261e' : '#c9b98a', 0.85);
      D.pass = 1; for (let k = 0; k < cyp.length; k += 2) { const tx = cyp[k], ty = cyp[k + 1], h = 5.5 + R.r(0, 1.2); D.poly([tx - 0.45, ty, tx - 0.62, ty + h * 0.25, tx - 0.4, ty + h * 0.65, tx, ty + h, tx + 0.4, ty + h * 0.65, tx + 0.62, ty + h * 0.25, tx + 0.45, ty], night ? '#121a14' : '#2d4a32'); } D.pass = 0;
    }
  });
  // smoke from the farms' chimneys, leaning with the wind
  PHl.add({ x0: -150, x1: 125, layer: 0, draw(ctx, env) {
    if (env.s < 0.8) return;
    for (const fx of [-138, 112]) { const y = hA(fx) - 9 + 6.0; if (fx < env.x0 - 20 || fx > env.x1 + 20) continue; ydSmoke(ctx, env, fx - 2.2, y, night ? 'rgb(70,76,90)' : 'rgb(236,232,226)', 4, 9, 0.5, 2.6, 0.06, 0.32, (env.wind || 0) * 3, (Math.abs(fx) * 0.013) % 1); }
  } });
}
