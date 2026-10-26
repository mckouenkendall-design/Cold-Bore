// ---------------------------------------------------------------------------
// Fine textures for the showpiece skins: Kintsugi, Magma, Live Wire, Paint
// Shop, Back Alley, Thunderhead and the glowing cracks of the mastery skins.
// Each tile is drawn once, at three times the usual detail (ST_RES), and then
// repeats along the rifle like every other texture (see PAT_KINDS in 11_gunart.js).
// Nothing here runs per frame.
// ---------------------------------------------------------------------------
const ST_RES = 3;

// ---- tools --------------------------------------------------------------------------------------
// A smooth random field in 0..1 that repeats across a w x h tile: value noise on a wrapped grid of
// roughly cell-sized squares.
function stNoise(R, w, h, cell) {
  const nx = Math.max(2, Math.round(w / cell)), ny = Math.max(2, Math.round(h / cell)), g = new Float32Array(nx * ny);
  for (let i = 0; i < g.length; i++) g[i] = R.f();
  const kx = nx / w, ky = ny / h;
  return (x, y) => {
    let fx = x * kx, fy = y * ky; fx -= Math.floor(fx / nx) * nx; fy -= Math.floor(fy / ny) * ny;
    const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const x1 = ix + 1 === nx ? 0 : ix + 1, y1 = iy + 1 === ny ? 0 : iy + 1, r0 = iy * nx, r1 = y1 * nx;
    const a = g[r0 + ix], b = g[r0 + x1], c = g[r1 + ix], d = g[r1 + x1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}
// Several layers of that noise, each half the size of the last: clouds, grime, stone.
function stFbm(R, w, h, cell, oct) {
  const L = []; let c = cell, amp = 1, tot = 0;
  for (let i = 0; i < oct; i++) { L.push([stNoise(R, w, h, c), amp]); tot += amp; c /= 2; amp *= 0.5; }
  return (x, y) => { let s = 0; for (let i = 0; i < L.length; i++) s += L[i][0](x, y) * L[i][1]; return s / tot; };
}
// Scattered cells that wrap round the tile, for anything broken into plates. q(x, y) returns (in a
// reused object) the nearest cell i, the cell j across the nearest edge, the distance e to that
// edge, the unit vector (ux, uy) pointing at it, and the distance d to the cell's own point.
function stCells(R, w, h, nx, ny, jit) {
  const cw = w / nx, ch = h / ny, P = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) P.push({ x: (i + 0.5 + R.r(-jit, jit)) * cw, y: (j + 0.5 + R.r(-jit, jit)) * ch, v: R.f() });
  const CX = new Float64Array(9), CY = new Float64Array(9), CI = new Int32Array(9);
  const out = { i: 0, j: 0, e: 0, ux: 0, uy: 0, d: 0, P };
  out.q = (x, y) => {
    const gi = Math.floor(x / cw), gj = Math.floor(y / ch); let n = 0, best = 1e18, bi = 0;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
      const ga = gi + a, gb = gj + b, ii = ((ga % nx) + nx) % nx, jj = ((gb % ny) + ny) % ny, p = P[jj * nx + ii];
      const px = p.x + (ga - ii) * cw, py = p.y + (gb - jj) * ch, dx = x - px, dy = y - py, dd = dx * dx + dy * dy;
      CX[n] = px; CY[n] = py; CI[n] = jj * nx + ii; if (dd < best) { best = dd; bi = n; } n++;
    }
    const ax = CX[bi], ay = CY[bi]; let e = 1e9, ej = bi, ux = 0, uy = 0;
    for (let k = 0; k < n; k++) {
      if (k === bi) continue;
      const dx = CX[k] - ax, dy = CY[k] - ay, L = Math.sqrt(dx * dx + dy * dy); if (L < 1e-6) continue;
      const vx = dx / L, vy = dy / L, dist = ((ax + CX[k]) / 2 - x) * vx + ((ay + CY[k]) / 2 - y) * vy;
      if (dist < e) { e = dist; ej = k; ux = vx; uy = vy; }
    }
    out.i = CI[bi]; out.j = CI[ej]; out.e = e; out.ux = ux; out.uy = uy; out.d = Math.sqrt(best); return out;
  };
  return out;
}
// A steady random number for a pair of cells (the same whichever way round) or for one cell.
function stHash2(a, b, s) {
  const lo = a < b ? a : b, hi = a < b ? b : a;
  let h = Math.imul(lo + 1, 73856093) ^ Math.imul(hi + 1, 19349663) ^ Math.imul(s + 7, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// Colour along a list of stops [[t, [r, g, b]], ...], written into out.
function stRamp(stops, t, out) {
  if (t <= stops[0][0]) { const c = stops[0][1]; out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; return out; }
  for (let k = 1; k < stops.length; k++) {
    if (t <= stops[k][0]) { const a = stops[k - 1], b = stops[k], u = (t - a[0]) / (b[0] - a[0]); out[0] = a[1][0] + (b[1][0] - a[1][0]) * u; out[1] = a[1][1] + (b[1][1] - a[1][1]) * u; out[2] = a[1][2] + (b[1][2] - a[1][2]) * u; return out; }
  }
  const c = stops[stops.length - 1][1]; out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; return out;
}
const stMix = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
const stCss = (c, a) => 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (a === undefined ? 1 : a) + ')';
// Every pixel of the tile from a function of texture coordinates: fn(x, y, out) sets out to r, g, b, a.
// (putImageData ignores the context's scale, so this works in real pixels and hands fn texture units.)
function stShade(ctx, w, h, res, fn) {
  const W = Math.round(w * res), H = Math.round(h * res), img = ctx.createImageData(W, H), d = img.data, o = [0, 0, 0, 255];
  for (let py = 0, k = 0; py < H; py++) for (let px = 0; px < W; px++, k += 4) {
    o[3] = 255; fn((px + 0.5) / res, (py + 0.5) / res, o);
    d[k] = o[0]; d[k + 1] = o[1]; d[k + 2] = o[2]; d[k + 3] = o[3];
  }
  ctx.putImageData(img, 0, 0);
}
// The direction of the light on every skin: from the upper left and in front.
const ST_L = [-0.42, -0.62, 0.66];

// ---- Kintsugi -------------------------------------------------------------------------------------
// Black lacquer broken into shards and mended with gold: the seams meander and branch, run thick and
// thin, stand proud of the surface as a rounded bead that catches the light, and a few chips knocked
// out of the edges are filled solid with gold. Hairline cracks run off the main breaks here and there.
// gleam: 1 draws only the bright glints on the gold (a clear tile, for a coat that comes and goes).
PAT_KINDS.kintsugi = [128, 96, (x, w, h, R, p, res) => {
  // big shards from a coarse set of cells; in a few places (where the blow landed) they are broken
  // again into smaller pieces; fine cells give the hairlines and the chips
  const C = stCells(R, w, h, 4, 3, 0.45), M = stCells(R, w, h, 9, 7, 0.45), F = stCells(R, w, h, 14, 10, 0.42);
  const Wx = stFbm(R, w, h, 32, 3), Wy = stFbm(R, w, h, 32, 3), Jx = stNoise(R, w, h, 3), Jy = stNoise(R, w, h, 3);
  const Wd = stFbm(R, w, h, 10, 2), Smash = stFbm(R, w, h, 48, 2), Hair = stFbm(R, w, h, 26, 2), Sheen = stFbm(R, w, h, 64, 2), Grain = stNoise(R, w, h, 1.2), Lac = stNoise(R, w, h, 6);
  const base = rgbOf(p.a || '#121316'), gold = rgbOf(p.b || '#f0c14a'), seed = hashStr(p.seed || 'k') % 9973, gleam = !!p.gleam;
  const ramp = [[0, [58, 36, 6]], [0.28, stMix(gold, [0, 0, 0], 0.5)], [0.6, gold], [0.86, stMix(gold, [255, 255, 255], 0.55)], [1, [255, 252, 232]]];
  const warp = (X, Y) => [X + (Wx(X, Y) - 0.5) * 9 + (Jx(X, Y) - 0.5) * 1.2, Y + (Wy(X, Y) - 0.5) * 9 + (Jy(X, Y) - 0.5) * 1.2];
  // a chip is a whole fine cell that sits on a main seam and lost its piece: filled with gold
  const chipOK = F.P.map((c, i) => { if (stHash2(i, i, seed + 11) > 0.16) return false; const wq = warp(c.x, c.y), q = C.q(wq[0], wq[1]); return q.e < 2.2 && stHash2(q.i, q.j, seed) >= 0.06; });
  const col = [0, 0, 0];
  stShade(x, w, h, res, (X, Y, o) => {
    const wq = warp(X, Y), wx = wq[0], wy = wq[1];
    let q = C.q(wx, wy), e = q.e, ux = q.ux, uy = q.uy, hp = stHash2(q.i, q.j, seed);
    let hw = hp < 0.06 ? 0 : (0.42 + 0.8 * stHash2(q.i, q.j, seed + 31)) * (0.55 + 0.9 * Wd(X, Y));
    const shard = q.i;
    // the smaller breaks, only where the rifle took the blow
    const sm = Smash(X, Y);
    if (sm > 0.52) {
      const m = M.q(wx, wy), mh = stHash2(m.i, m.j, seed + 5), mw = mh < 0.25 ? 0 : (0.3 + 0.45 * mh) * (0.6 + 0.8 * Wd(Y, X)) * smooth((sm - 0.52) / 0.12);
      if (mw > 0 && m.e - mw < e - hw) { e = m.e; ux = m.ux; uy = m.uy; hw = mw; }
    }
    const f = F.q(wx, wy), fe = f.e, fux = f.ux, fuy = f.uy;
    const hairW = stHash2(f.i, f.j, seed + 3) < 0.4 && Hair(X, Y) > 0.5 ? 0.16 + 0.12 * Wd(Y, X) : 0;
    // how much gold covers this pixel, and which way its surface faces
    let ga = 0, nx = 0, ny = 0, nz = 1;
    if (hw > 0 && e < hw + 0.5) {
      ga = clamp((hw - e) * res + 0.5, 0, 1); const s = clamp(e / hw, 0, 1) * 0.95;
      nx = -ux * s; ny = -uy * s; nz = Math.sqrt(Math.max(0.05, 1 - s * s));
    }
    if (chipOK[f.i]) { const ca = clamp(fe * res + 0.5, 0, 1); if (ca > ga) { const r = clamp(1 - fe / 0.9, 0, 1) * 0.8; ga = ca; nx = fux * r; ny = fuy * r; nz = Math.sqrt(1 - r * r); } }
    if (hairW > 0 && fe < hairW + 0.4) { const ha = clamp((hairW - fe) * res + 0.5, 0, 1) * 0.9; if (ha > ga) { ga = ha; nx = -fux * 0.5; ny = -fuy * 0.5; nz = 0.86; } }
    const lit = Math.max(0, nx * ST_L[0] + ny * ST_L[1] + nz * ST_L[2]), spec = Math.pow(lit, 26);
    if (gleam) { o[0] = 255; o[1] = 246; o[2] = 214; o[3] = 255 * ga * clamp(spec * 1.6 + Math.pow(lit, 8) * 0.35, 0, 1); return; }
    // the lacquer: nearly black, each shard a shade apart, a slow sheen, the faintest brush marks
    const tone = (C.P[shard].v - 0.5) * 9 + (Sheen(X, Y) - 0.5) * 16 + (Lac(X * 0.25, Y * 3) - 0.5) * 4;
    let r = base[0] + tone, g = base[1] + tone, b = base[2] + tone * 1.15;
    // the lacquer sinks a little where it meets the gold
    if (hw > 0 && e > hw) { const k = 1 - 0.6 * Math.exp(-(e - hw) / 0.45); r *= k; g *= k; b *= k; }
    if (ga > 0) {
      stRamp(ramp, clamp(0.12 + 0.88 * lit, 0, 1) * (0.9 + 0.2 * Grain(X, Y)), col);
      const sp = spec * 255 * 0.9;
      r += (col[0] + sp - r) * ga; g += (col[1] + sp - g) * ga; b += (col[2] + sp * 0.85 - b) * ga;
    }
    o[0] = r; o[1] = g; o[2] = b;
  });
}, { res: ST_RES }];

// ---- glowing cracks (Magma, and the Master skins) --------------------------------------------------
// Dark plates split by fissures that glow from inside: a white-hot core, then the paint's colour (or
// orange to deep red for lava), and a halo that heats the rock beside them. Rivers: a few fissures
// run wide. glowOnly: 1 draws only the light of the fissures in one group (0, 1 or 2) on a clear tile,
// so three coats breathing out of step make the heat wander through the cracks.
// lava: 1 colours the fissures as molten rock; cool: 1 gives fewer, thinner ones.
function stGlowCracks(x, w, h, R, p, res) {
  const lava = !!p.lava, cool = !!p.cool;
  const C = stCells(R, w, h, cool ? 4 : 5, cool ? 3 : 4, 0.45), M = stCells(R, w, h, 10, 7, 0.45);
  const Wx = stFbm(R, w, h, 32, 3), Wy = stFbm(R, w, h, 32, 3), Jx = stNoise(R, w, h, 2.5), Jy = stNoise(R, w, h, 2.5);
  const Wd = stFbm(R, w, h, 12, 2), Rough = stFbm(R, w, h, 6, 3), Sheen = stFbm(R, w, h, 40, 2), Fine = stNoise(R, w, h, 1.1), Sub = stFbm(R, w, h, 30, 2);
  const seed = hashStr(p.seed || 'g') % 9973, base = rgbOf(p.a && p.a !== 'none' ? p.a : '#161012'), glowOnly = !!p.glowOnly;
  const gc = lava ? [255, 120, 24] : rgbOf(p.b || '#ff6a2a'), hot = lava ? [255, 250, 214] : stMix(gc, [255, 255, 255], 0.78);
  const ramp = lava ? [[0, [255, 252, 222]], [0.28, [255, 222, 120]], [0.55, [255, 150, 36]], [0.8, [228, 70, 12]], [1, [150, 26, 6]]]
    : [[0, hot], [0.45, stMix(gc, [255, 255, 255], 0.35)], [1, gc]];
  const heat = lava ? [170, 34, 6] : gc, col = [0, 0, 0];
  stShade(x, w, h, res, (X, Y, o) => {
    const wx = X + (Wx(X, Y) - 0.5) * 10 + (Jx(X, Y) - 0.5) * 1.3, wy = Y + (Wy(X, Y) - 0.5) * 10 + (Jy(X, Y) - 0.5) * 1.3;
    const q = C.q(wx, wy), hp = stHash2(q.i, q.j, seed), grp = Math.floor(stHash2(q.j, q.i, seed + 9) * 3);
    let e = q.e, g = grp;
    let hw = hp < (cool ? 0.3 : 0.07) ? 0 : (hp > 0.85 ? 1.9 + (hp - 0.85) * 14 : 0.45 + hp * 1.1) * (0.5 + 0.9 * Wd(X, Y)) * (cool ? 0.6 : 1);
    // small branch cracks off the big ones
    const m = M.q(wx, wy), mh = stHash2(m.i, m.j, seed + 5);
    if (mh < 0.3 && Sub(X, Y) > 0.48) { const mw = 0.22 + 0.25 * mh; if (m.e - mw < e - hw) { e = m.e; hw = mw; g = Math.floor(mh * 10) % 3; } }
    const inA = hw > 0 ? clamp((hw - e) * res + 0.5, 0, 1) : 0, k = hw > 0 ? clamp(e / hw, 0, 1) : 1;
    const out = hw > 0 ? Math.max(0, e - hw) : 99, halo = Math.exp(-out / (0.9 + hw * 0.7)), wide = Math.exp(-out / (3 + hw * 2));
    if (glowOnly) {
      if (g !== p.group) { o[3] = 0; return; }
      stRamp(ramp, k * 0.7, col); o[0] = col[0]; o[1] = col[1]; o[2] = col[2]; o[3] = 255 * clamp(inA * (1 - 0.35 * k) + halo * 0.55 + wide * 0.18, 0, 1); return;
    }
    // the plates: black glass with a rough skin, faint ripples where it broke, each plate its own shade
    const v = C.P[q.i].v, rough = (Rough(X, Y) - 0.5) * (lava ? 22 : 14);
    const rip = Math.sin(q.d * 1.6 + v * 9) * 0.5 + 0.5, gloss = Math.pow(rip, 10) * smooth((Sheen(X, Y) - 0.45) / 0.3) * 26;
    let r = base[0] + rough + (v - 0.5) * 8 + gloss, gg = base[1] + rough * 0.9 + (v - 0.5) * 7 + gloss, b = base[2] + rough * 0.9 + (v - 0.5) * 8 + gloss * 1.15;
    // rock beside a fissure is hot
    r += heat[0] * (halo * 0.75 + wide * 0.22); gg += heat[1] * (halo * 0.75 + wide * 0.22); b += heat[2] * (halo * 0.75 + wide * 0.22);
    if (inA > 0) { stRamp(ramp, k, col); const f = 0.92 + 0.16 * Fine(X, Y); r += (col[0] * f - r) * inA; gg += (col[1] * f - gg) * inA; b += (col[2] * f - b) * inA; }
    // embers caught in the rock near the cracks
    if (out < 5 && Fine(X * 0.7, Y * 0.7) > 0.93) { const a = (Fine(X * 0.7, Y * 0.7) - 0.93) * 14; r += 255 * a; gg += 180 * a; b += 80 * a; }
    o[0] = r; o[1] = gg; o[2] = b;
  });
}
PAT_KINDS.cracks = [128, 96, stGlowCracks, { res: ST_RES }];
PAT_KINDS.magma = [128, 96, (x, w, h, R, p, res) => stGlowCracks(x, w, h, R, Object.assign({ lava: 1 }, p), res), { res: ST_RES }];

// ---- lightning (Live Wire, Thunderhead) ------------------------------------------------------------
// A bolt from (x0, y0) to (x1, y1) by midpoint displacement: each half bends at random, less and less,
// down to steps of about half a texture pixel. Branches fork off and wander away, thinner.
function stBoltPts(R, x0, y0, x1, y1, disp, out) {
  const L = Math.hypot(x1 - x0, y1 - y0);
  if (L < 0.6) { out.push(x1, y1); return; }
  const k = R.r(-1, 1) * disp, mx = (x0 + x1) / 2 - ((y1 - y0) / L) * k, my = (y0 + y1) / 2 + ((x1 - x0) / L) * k;
  stBoltPts(R, x0, y0, mx, my, disp * 0.55, out); stBoltPts(R, mx, my, x1, y1, disp * 0.55, out);
}
function stBolt(R, x0, y0, x1, y1, lw, depth, paths) {
  const pts = [x0, y0], L = Math.hypot(x1 - x0, y1 - y0); stBoltPts(R, x0, y0, x1, y1, L * 0.22, pts);
  paths.push({ pts, lw });
  if (depth <= 0) return;
  const n = pts.length / 2, nb = R.i(1, depth + 2);
  for (let b = 0; b < nb; b++) {
    const i = R.i(Math.floor(n * 0.15), Math.floor(n * 0.8)), bx = pts[i * 2], by = pts[i * 2 + 1];
    const an = Math.atan2(y1 - y0, x1 - x0) + R.pick([-1, 1]) * R.r(0.35, 1.0), bl = L * R.r(0.18, 0.42);
    stBolt(R, bx, by, bx + Math.cos(an) * bl, by + Math.sin(an) * bl, lw * 0.55, depth - 1, paths);
  }
}
// Glowing lines: wide faint halos, then the colour, then a white core. Wraps round the tile.
function stGlowLines(x, w, h, paths, colHex, k) {
  k = k || 1; x.lineCap = 'round'; x.lineJoin = 'round';
  const passes = [[9, 0.045, colHex], [5, 0.09, colHex], [2.4, 0.3, colHex], [1.25, 0.85, mix(colHex, '#ffffff', 0.45)], [0.5, 1, '#ffffff']];
  passes.forEach((ps) => paths.forEach((q) => txRep(x, w, h, () => { x.globalAlpha = ps[1]; x.strokeStyle = ps[2]; x.lineWidth = q.lw * ps[0] * k; txLine(x, q.pts); x.stroke(); })));
  x.globalAlpha = 1;
}
// Sparking arcs on a clear tile: a few bolts with forks and a flare where each one touches.
PAT_KINDS.arcs = [128, 96, (x, w, h, R, p) => {
  const paths = [], ends = [];
  for (let i = 0, n = p.n || 4; i < n; i++) {
    const x0 = R.r(0, w), y0 = R.r(0, h), an = R.r(-0.5, 0.5) + (R.chance(0.5) ? 0 : Math.PI), L = R.r(26, 58);
    const x1 = x0 + Math.cos(an) * L, y1 = y0 + Math.sin(an) * L; stBolt(R, x0, y0, x1, y1, R.r(0.55, 0.85), 2, paths); ends.push([x0, y0], [x1, y1]);
  }
  stGlowLines(x, w, h, paths, p.b || '#d470ff');
  ends.forEach((e) => txRep(x, w, h, () => { const g = x.createRadialGradient(e[0], e[1], 0, e[0], e[1], 4); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.3, rgba(p.b || '#d470ff', 0.5)); g.addColorStop(1, rgba(p.b || '#d470ff', 0)); x.fillStyle = g; x.fillRect(e[0] - 4, e[1] - 4, 8, 8); }));
}, { res: ST_RES }];
// Lichtenberg figures: the fern-like branching trees that a high-voltage discharge burns into a
// surface. Dim and burnt on the base (a: colour); with lit: 1 they glow (clear tile), and part
// picks the trunks (0) or the fine branches (1) so the glow can run outward from the trunk.
function stTrees(R, w, h) {
  const segs = [], grow = (x0, y0, an, len, lw, d) => {
    let cx = x0, cy = y0, a = an; const pts = [cx, cy];
    for (let s = 0; s < len; s++) {
      a += R.r(-0.38, 0.38); cx += Math.cos(a) * 1.1; cy += Math.sin(a) * 1.1; pts.push(cx, cy);
      if (d < 5 && R.chance(d === 0 ? 0.14 : 0.2)) grow(cx, cy, a + R.pick([-1, 1]) * R.r(0.4, 1.1), Math.floor(len * R.r(0.3, 0.6)), lw * 0.62, d + 1);
    }
    segs.push({ pts, lw, d });
  };
  for (let i = 0; i < 4; i++) { const ox = ((i * 0.618 + 0.1) % 1) * w, oy = ((i * 0.41 + 0.2) % 1) * h; for (let k = 0; k < 3; k++) grow(ox, oy, (k / 3) * TAU + R.r(-0.4, 0.4), R.i(18, 30), 1.0, 0); }
  return segs;
}
PAT_KINDS.plasma = [128, 96, (x, w, h, R, p, res) => {
  const base = rgbOf(p.a || '#0b0911'), tint = rgbOf(p.b || '#7a2cd0'), Hz = stFbm(R, w, h, 48, 4), Br = stNoise(R, w, h, 4), Fn = stNoise(R, w, h, 1);
  stShade(x, w, h, res, (X, Y, o) => {
    const hz = Math.pow(clamp((Hz(X, Y) - 0.38) / 0.62, 0, 1), 2.2) * 0.55, s = (Br(X * 0.15, Y * 2.5) - 0.5) * 7 + (Fn(X, Y) - 0.5) * 5;
    o[0] = base[0] + tint[0] * hz + s; o[1] = base[1] + tint[1] * hz + s; o[2] = base[2] + tint[2] * hz + s * 1.2;
  });
  const T = stTrees(makeRng(hashStr('trees:' + (p.seed || 'w'))), w, h);
  x.lineCap = 'round'; x.lineJoin = 'round';
  T.forEach((q) => txRep(x, w, h, () => { x.globalAlpha = 0.9; x.strokeStyle = p.c || '#4a2470'; x.lineWidth = q.lw * 1.2; txLine(x, q.pts, true); x.stroke(); }));
  x.globalAlpha = 1;
}, { res: ST_RES }];
PAT_KINDS.treeglow = [128, 96, (x, w, h, R, p) => {
  const T = stTrees(makeRng(hashStr('trees:' + (p.seed || 'w'))), w, h).filter((q) => (p.part ? q.d >= 2 : q.d < 2));
  stGlowLines(x, w, h, T, p.b || '#d470ff', 0.9);
}, { res: ST_RES }];

// ---- Paint Shop: real splatter ----------------------------------------------------------------------
// Thrown paint: each splat is a blob with arms shooting out, a bead of paint at the end of each arm,
// drops flung further along the same lines, a mist of specks, and runs dripping down. Brush flicks lay
// long tapering streaks with a trail of drops. Paint stands proud: a lit rim on the upper left, a dark
// rim on the lower right and a soft shadow on the ground under it. base: 'none' gives a clear tile.
PAT_KINDS.splat = [192, 144, (x, w, h, R, p, res) => {
  const clear = p.base === 'none', cols = p.cols || ['#e0413a', '#2f6db5', '#f2c318', '#3f8f4f'], sparse = p.sparse || 0;
  if (!clear) {
    const base = rgbOf(p.base || '#e9e4d6'), G = stFbm(R, w, h, 24, 3), Fn = stNoise(R, w, h, 1.2);
    stShade(x, w, h, res, (X, Y, o) => { const n = (G(X, Y) - 0.5) * 16 + (Fn(X, Y) - 0.5) * 9; o[0] = base[0] + n; o[1] = base[1] + n; o[2] = base[2] + n * 0.9; });
  }
  const shade = (hex, t) => mix(hex, t > 0 ? '#ffffff' : '#000000', Math.abs(t));
  // fill a shape as raised wet paint
  const blob = (path, col, rim) => txRep(x, w, h, () => {
    x.save(); x.shadowColor = 'rgba(30,20,10,0.32)'; x.shadowBlur = 1.2 * res; x.shadowOffsetX = 0.4 * res; x.shadowOffsetY = 0.55 * res;
    x.fillStyle = col; path(); x.fill(); x.restore();
    if (!rim) return;
    const d = rim;
    x.save(); path(); x.clip(); x.fillStyle = shade(col, 0.42); x.fillRect(-w, -h, w * 3, h * 3);
    x.translate(d, d * 1.2); path(); x.clip(); x.translate(-d, -d * 1.2); x.fillStyle = shade(col, -0.28); x.fillRect(-w, -h, w * 3, h * 3);
    x.translate(-d * 0.8, -d); x.fillStyle = col; path(); x.fill(); x.restore();
  });
  const dot = (cx, cy, r, col) => blob(() => { x.beginPath(); x.arc(cx, cy, r, 0, TAU); }, col, r > 0.9 ? 0.3 : 0);
  const splat = (cx, cy, r0, col, stretch, dir) => {
    const K = R.i(9, 18), arms = [];
    for (let k = 0; k < K; k++) arms.push({ a: R.r(0, TAU), wd: R.r(0.05, 0.16), L: r0 * R.r(0.35, 1.7) * (0.6 + 0.4 * Math.abs(Math.cos(R.r(0, 1)))) });
    const ca = Math.cos(dir), sa = Math.sin(dir), P = (u, v) => [cx + (u * stretch) * ca - v * sa, cy + (u * stretch) * sa + v * ca], wob = R.r(0, TAU);
    const pts = [];
    for (let i = 0; i < 160; i++) {
      const an = (i / 160) * TAU; let rr = r0 * (1 + 0.14 * Math.sin(an * 3 + wob) + 0.08 * Math.sin(an * 7 + wob * 2));
      arms.forEach((A) => { let da = Math.abs(an - A.a); da = Math.min(da, TAU - da); const u = da / A.wd; if (u < 1) rr += A.L * Math.pow(1 - u * u, 2.5); });
      pts.push(P(Math.cos(an) * rr, Math.sin(an) * rr));
    }
    blob(() => { x.beginPath(); pts.forEach((q, i) => (i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]))); x.closePath(); }, col, 0.35);
    arms.forEach((A) => {
      const tip = r0 + A.L, ca2 = Math.cos(A.a), sa2 = Math.sin(A.a);
      if (A.L > r0 * 0.5) { const q = P(ca2 * tip * 1.02, sa2 * tip * 1.02); dot(q[0], q[1], r0 * A.wd * 1.1 + 0.25, col); }
      let d = tip + R.r(1, 3), rr = r0 * R.r(0.06, 0.13);
      for (let n = R.i(0, 4); n > 0; n--) { const q = P(ca2 * d, sa2 * d); dot(q[0], q[1], rr, col); d += R.r(1.5, 4.5) + rr * 2; rr *= R.r(0.55, 0.85); }
    });
    for (let n = 0; n < 26; n++) { const an = R.r(0, TAU), d = r0 * R.r(1.4, 3.6), q = P(Math.cos(an) * d, Math.sin(an) * d); dot(q[0], q[1], R.r(0.12, 0.42) * (r0 > 8 ? 1.2 : 1), col); }
    // runs: paint gathers at the bottom and drips down
    for (let n = R.i(0, 2); n > 0; n--) {
      const dx = cx + R.r(-0.5, 0.5) * r0 * stretch, top = cy + r0 * 0.5, len = R.r(6, 22), dw = R.r(0.55, 1.1);
      blob(() => { x.beginPath(); x.moveTo(dx - dw, top); x.bezierCurveTo(dx - dw * 0.7, top + len * 0.5, dx - dw * 0.9, top + len * 0.8, dx - dw * 0.8, top + len); x.arc(dx, top + len, dw * 1.35, Math.PI, 0, true); x.bezierCurveTo(dx + dw * 0.9, top + len * 0.8, dx + dw * 0.7, top + len * 0.5, dx + dw, top); x.closePath(); }, col, 0.28);
    }
  };
  const flick = (col) => {
    const x0 = R.r(0, w), y0 = R.r(0, h), an = R.r(0, TAU), L = R.r(30, 60), bend = R.r(-0.5, 0.5), w0 = R.r(1.0, 1.8), L2 = [], R2 = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24, a = an + bend * t, cx = x0 + Math.cos(an) * L * t + Math.cos(an + Math.PI / 2) * bend * L * t * t * 0.5, cy = y0 + Math.sin(an) * L * t + Math.sin(an + Math.PI / 2) * bend * L * t * t * 0.5, ww = w0 * Math.pow(1 - t, 0.8) + 0.12; L2.push([cx - Math.sin(a) * ww, cy + Math.cos(a) * ww]); R2.unshift([cx + Math.sin(a) * ww, cy - Math.cos(a) * ww]); }
    blob(() => { x.beginPath(); L2.concat(R2).forEach((q, i) => (i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]))); x.closePath(); }, col, 0.25);
    let d = L + 2, rr = w0 * 0.7; for (let n = R.i(2, 6); n > 0; n--) { const a = an + bend; dot(x0 + Math.cos(a) * d, y0 + Math.sin(a) * d, rr, col); d += R.r(2, 5); rr *= 0.8; }
  };
  const tint = (c) => mix(c, R.chance(0.5) ? '#ffffff' : '#000000', R.r(0, 0.12));
  // mist first, then the big splats, flicks across them, then small splats on top
  for (let i = 0; i < (sparse ? 60 : 260); i++) { const c = R.pick(cols); txRep(x, w, h, () => { x.globalAlpha = R.r(0.5, 0.95); x.fillStyle = c; x.beginPath(); x.arc(R.r(0, w), R.r(0, h), R.r(0.1, 0.32), 0, TAU); x.fill(); }); }
  x.globalAlpha = 1;
  const nBig = sparse ? 3 : 11, nSmall = sparse ? 4 : 16;
  for (let i = 0; i < nBig; i++) splat(((i * 0.618 + R.r(-0.06, 0.06)) % 1) * w, ((i * 0.37 + 0.13 + R.r(-0.06, 0.06)) % 1) * h, sparse ? R.r(5, 9) : R.r(10, 18), tint(cols[i % cols.length]), R.r(1, 1.7), R.r(0, TAU));
  for (let i = 0; i < (sparse ? 2 : 6); i++) flick(tint(R.pick(cols)));
  for (let i = 0; i < nSmall; i++) splat(R.r(0, w), R.r(0, h), R.r(2.5, 6.5), tint(R.pick(cols)), R.r(1, 2.2), R.r(0, TAU));
}, { res: ST_RES }];

// ---- Back Alley: a block wall covered in real graffiti -------------------------------------------------
// Letters are drawn from a skeleton (one or more strokes per letter, height 1). A throw-up strokes the
// skeleton with a fat round pen, which gives bubble letters: a block shadow behind, a dark outline, a
// two-colour fade fill, white shines, and paint running down. A tag is the same skeleton, thin, slanted
// and fast, with a swoosh under it.
const ST_GLYPH = (() => {
  const D = Math.PI / 180, arc = (cx, cy, rx, ry, a0, a1, n) => { const o = []; for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * (i / n)) * D; o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return o; };
  return {
    B: [[[0, 1], [0, 0], [0.24, 0], ...arc(0.24, 0.25, 0.25, 0.25, -90, 90, 10), [0, 0.5]], [[0, 0.5], [0.28, 0.5], ...arc(0.28, 0.75, 0.27, 0.25, -90, 90, 10), [0, 1]]],
    C: [arc(0.34, 0.5, 0.34, 0.5, -45, -315, 20)],
    D: [[[0, 1], [0, 0], [0.2, 0], ...arc(0.2, 0.5, 0.38, 0.5, -90, 90, 14), [0, 1]]],
    E: [[[0.55, 0], [0, 0], [0, 1], [0.55, 1]], [[0, 0.5], [0.42, 0.5]]],
    K: [[[0, 0], [0, 1]], [[0.56, 0], [0.04, 0.55]], [[0.2, 0.4], [0.6, 1]]],
    L: [[[0, 0], [0, 1], [0.5, 1]]],
    O: [arc(0.34, 0.5, 0.34, 0.5, 0, 360, 26)],
    R: [[[0, 1], [0, 0], [0.26, 0], ...arc(0.26, 0.25, 0.25, 0.25, -90, 90, 10), [0, 0.5]], [[0.18, 0.5], [0.58, 1]]],
    S: [[...arc(0.3, 0.25, 0.27, 0.25, -15, -270, 14), ...arc(0.3, 0.75, 0.29, 0.25, -90, 165, 14)]],
    T: [[[0, 0], [0.64, 0]], [[0.32, 0], [0.32, 1]]],
  };
})();
const ST_ADV = { B: 0.55, C: 0.62, D: 0.6, E: 0.55, K: 0.6, L: 0.5, O: 0.68, R: 0.6, S: 0.6, T: 0.64 };
PAT_KINDS.graffiti = [256, 128, (x, w, h, R, p, res) => {
  const tagsOnly = p.only === 'tags';
  if (!tagsOnly) {
    // the wall: cinder blocks, deep mortar, grime, water stains running down, rough pitted faces,
    // and patches where the council painted over older work
    const base = rgbOf(p.a || '#8f9499'), G = stFbm(R, w, h, 48, 4), Rf = stFbm(R, w, h, 3, 2), Pit = stNoise(R, w, h, 0.9), Stain = stFbm(R, w, h, 16, 3), Bt = stNoise(R, w, h, 1);
    const buffs = []; for (let i = 0; i < 4; i++) buffs.push([R.r(0, w), R.r(0, h), R.r(18, 46), R.r(10, 26), R.r(-14, 10)]);
    stShade(x, w, h, res, (X, Y, o) => {
      const row = Math.floor(Y / 20), bx = X + (row % 2 ? 20 : 0), u = ((bx % 40) + 40) % 40, v = Y - row * 20, md = Math.min(u, 40 - u, v, 20 - v);
      const blk = Bt(Math.floor(bx / 40) * 7.3, row * 5.1);
      let l = (blk - 0.5) * 14 + (Rf(X, Y) - 0.5) * 22 - (Pit(X, Y) > 0.86 ? 26 : 0);
      l -= Math.pow(clamp((G(X, Y) - 0.45) / 0.55, 0, 1), 1.5) * 38; // grime
      l -= Math.pow(clamp((Stain(X * 3, Y * 0.18) - 0.55) / 0.45, 0, 1), 1.3) * 30; // runs of dirty water
      if (md < 0.9) l -= 38 - md * 10; else if (v < 1.6) l += 8; // mortar, and the lit lip under it
      for (const b of buffs) { const dx = Math.abs(((X - b[0] + w * 1.5) % w) - w / 2), dy = Math.abs(((Y - b[1] + h * 1.5) % h) - h / 2); if (dx < b[2] / 2 + (Rf(Y, X) - 0.5) * 3 && dy < b[3] / 2) { l = b[4] + (Rf(X, Y) - 0.5) * 6 + (md < 0.9 ? -20 : 0); break; } }
      o[0] = base[0] + l; o[1] = base[1] + l; o[2] = base[2] + l * 1.05;
    });
  }
  x.lineCap = 'round'; x.lineJoin = 'round';
  const strokes = (txt, x0, y0, H, sp, jit, tilt) => { const out = []; let cx = x0; for (const ch of txt) { const g = ST_GLYPH[ch]; if (!g) { cx += H * 0.35; continue; } out.push({ g, x: cx, y: y0 + R.r(-jit, jit) * H, rot: R.r(-tilt, tilt), s: H * R.r(0.93, 1.07) }); cx += ST_ADV[ch] * H * sp; } return out; };
  const pen = (L, lw, style, dx, dy, alpha, skew) => L.forEach((it) => txRep(x, w, h, () => {
    x.translate(it.x + (dx || 0), it.y + (dy || 0)); if (skew) x.transform(1, 0, skew, 1, 0, 0); x.rotate(it.rot); x.scale(it.s, it.s);
    x.globalAlpha = alpha === undefined ? 1 : alpha; x.lineWidth = lw; x.strokeStyle = typeof style === 'function' ? style() : style;
    it.g.forEach((st) => { x.beginPath(); st.forEach((q, k) => (k ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]))); x.stroke(); });
  }));
  const fade = (c0, c1, c2) => () => { const g = x.createLinearGradient(0, -0.25, 0, 1.25); g.addColorStop(0, c0); g.addColorStop(0.5, c1); g.addColorStop(1, c2); return g; };
  const throwUp = (txt, x0, y0, H, o) => {
    const L = strokes(txt, x0, y0, H, 0.98, 0.07, 0.11), fat = o.fat || 0.3;
    pen(L, fat + 0.5, o.mist, 0, 0, 0.13); // overspray
    for (let k = 6; k >= 1; k--) pen(L, fat + 0.1, o.depth, k * 0.4, k * 0.36); // the block shadow
    pen(L, fat + 0.12, o.line);
    pen(L, fat, fade(o.fill[0], o.fill[1], o.fill[2]));
    // shines: a short white highlight along the start of each stroke, and a bubble or two
    L.forEach((it) => txRep(x, w, h, () => { x.translate(it.x, it.y); x.rotate(it.rot); x.scale(it.s, it.s); x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 0.035;
      it.g.forEach((st) => { const n = Math.max(2, Math.floor(st.length * 0.22)); x.beginPath(); for (let k = 0; k < n; k++) { const q = st[k]; if (k) x.lineTo(q[0] - 0.1, q[1] - 0.1); else x.moveTo(q[0] - 0.1, q[1] - 0.1); } x.stroke(); });
      x.fillStyle = '#ffffff'; x.beginPath(); x.arc(it.g[0][0][0] + 0.08, it.g[0][0][1] + 0.12, 0.035, 0, TAU); x.fill(); }));
    // drips running off the bottoms
    L.forEach((it) => { if (R.chance(0.55)) { const dx = it.x + R.r(0.05, 0.4) * it.s, top = it.y + it.s * 1.12, len = R.r(0.25, 0.85) * H, dw = 0.035 * H; txRep(x, w, h, () => { x.fillStyle = o.fill[2]; x.strokeStyle = o.line; x.lineWidth = 0.3; x.beginPath(); x.moveTo(dx - dw, top); x.lineTo(dx - dw * 0.8, top + len); x.arc(dx, top + len, dw * 1.5, Math.PI, 0, true); x.lineTo(dx + dw, top); x.closePath(); x.fill(); x.stroke(); }); } });
    return L;
  };
  const tag = (txt, x0, y0, H, col, lw) => {
    const L = strokes(txt, x0, y0, H, 0.66, 0.05, 0.06);
    pen(L, (lw || 0.09) * 2.2, col, 0, 0, 0.12, -0.38); pen(L, lw || 0.09, col, 0, 0, 0.95, -0.38);
    const ex = L.length ? L[L.length - 1].x + H * 0.6 : x0, sw = [x0 - H * 0.3, y0 + H * 1.25, (x0 + ex) / 2, y0 + H * 1.55, ex, y0 + H * 1.05];
    txRep(x, w, h, () => { x.strokeStyle = col; x.globalAlpha = 0.95; x.lineWidth = H * (lw || 0.09) * 0.9; x.beginPath(); x.moveTo(sw[0], sw[1]); x.quadraticCurveTo(sw[2], sw[3], sw[4], sw[5]); x.stroke(); });
    x.globalAlpha = 1;
  };
  const star = (cx, cy, r, fill) => txRep(x, w, h, () => { x.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k / 10) * TAU, rr = k % 2 ? r * 0.42 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fillStyle = fill; x.strokeStyle = '#121214'; x.lineWidth = 0.9; x.stroke(); x.fill(); });
  const crown = (cx, cy, s, col) => txRep(x, w, h, () => { x.strokeStyle = col; x.lineWidth = 0.9; x.beginPath(); x.moveTo(cx - s, cy); x.lineTo(cx - s, cy - s * 0.9); x.lineTo(cx - s * 0.5, cy - s * 0.35); x.lineTo(cx, cy - s * 1.1); x.lineTo(cx + s * 0.5, cy - s * 0.35); x.lineTo(cx + s, cy - s * 0.9); x.lineTo(cx + s, cy); x.closePath(); x.stroke(); });
  if (tagsOnly) {
    tag('KSTRL', 14, 20, 11, '#d9dde2', 0.08); tag('BORE', 150, 70, 9, '#c9cdd2', 0.08); tag('CB', 90, 100, 12, '#f2d21a', 0.1); crown(100, 95, 3.5, '#f2d21a');
    return;
  }
  // older work, faded and half buffed out
  tag('BORE', 170, 18, 12, 'rgba(40,40,60,0.45)', 0.07); tag('OK', 30, 98, 14, 'rgba(120,40,40,0.4)', 0.08); tag('DES', 205, 104, 10, 'rgba(30,70,90,0.45)', 0.07);
  // a cloud of colour behind the main piece
  for (let i = 0; i < 9; i++) { const cx = 24 + i * 18 + R.r(-5, 5), cy = 48 + R.r(-8, 8), r = R.r(12, 22), c = ['#7a2fd6', '#ff3d8a', '#22d3ee'][i % 3]; txRep(x, w, h, () => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, rgba(c, 0.38)); g.addColorStop(1, rgba(c, 0)); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); }); }
  throwUp('KESTREL', 10, 30, 28, { fill: ['#fff35a', '#ff9a1a', '#ff3d6a'], line: '#121214', depth: '#3a1050', mist: '#ff7a1a' });
  throwUp('CB', 182, 76, 32, { fill: ['#ffffff', '#cfd6de', '#8f9aa6'], line: '#121214', depth: '#1b2a6a', mist: '#22d3ee', fat: 0.34 });
  tag('BORE', 140, 6, 13, '#121214', 0.09); crown(150, 5, 4, '#121214');
  tag('KSTRL', 20, 96, 12, '#2a2aff', 0.09);
  star(170, 66, 4.5, '#22d3ee'); star(232, 22, 3.5, '#fff35a'); star(8, 70, 3, '#ff3d8a');
  // stray spray dots and a few drips of plain paint
  for (let i = 0; i < 120; i++) { const c = R.pick(['#ff3d8a', '#22d3ee', '#fff35a', '#121214', '#7ddc3a']); txRep(x, w, h, () => { x.globalAlpha = R.r(0.4, 0.9); x.fillStyle = c; x.beginPath(); x.arc(R.r(0, w), R.r(0, h), R.r(0.12, 0.35), 0, TAU); x.fill(); }); }
  x.globalAlpha = 1;
}, { res: ST_RES }];

// ---- Thunderhead: forked lightning ---------------------------------------------------------------------
// Two big bolts across the tile with forks, drawn like the Live Wire arcs (same size tile as before,
// so the flash timing and the jump to a new place each flash are unchanged).
PAT_KINDS.bolts = [160, 96, (x, w, h, R, p) => {
  const paths = [];
  stBolt(R, R.r(0, 30), R.r(18, 34), R.r(130, 160), R.r(10, 44), 1.0, 3, paths);
  stBolt(R, R.r(60, 90), R.r(60, 78), R.r(150, 190), R.r(50, 90), 0.8, 2, paths);
  stGlowLines(x, w, h, paths, p.b || '#a58cff', 1.1);
}, { res: ST_RES }];

// ---- Damascus: pattern-welded steel ------------------------------------------------------------------
// Hundreds of folded layers, forged and twisted, then etched: bright ridges and dark valleys that flow
// in waves, pinch into ladders and curl into raindrop eyes. a: bright steel, b: dark steel.
PAT_KINDS.damascus = [128, 96, (x, w, h, R, p, res) => {
  const A = rgbOf(p.a || '#8d98a3'), B = rgbOf(p.b || '#3d454e'), W1 = stFbm(R, w, h, 48, 3), W2 = stFbm(R, w, h, 20, 3), Fn = stNoise(R, w, h, 0.8), Dr = stCells(R, w, h, 5, 3, 0.4);
  stShade(x, w, h, res, (X, Y, o) => {
    const q = Dr.q(X, Y), eye = Math.exp(-q.d * q.d / 40) * 7; // raindrop eyes: the layers swirl round a point
    const f = Y * 0.55 + (W1(X, Y) - 0.5) * 34 + (W2(X, Y) - 0.5) * 9 + 2.2 * Math.sin(X * TAU / 32) + eye * Math.sin(Math.atan2(Y - q.e, X) * 2);
    const band = 0.5 + 0.5 * Math.sin(f * 1.35), fine = 0.5 + 0.5 * Math.sin(f * 4.05 + 1.3);
    let t = Math.pow(band, 1.6) * 0.75 + fine * 0.25; t = smooth((t - 0.15) / 0.75);
    const n = (Fn(X, Y) - 0.5) * 14;
    o[0] = B[0] + (A[0] - B[0]) * t + n; o[1] = B[1] + (A[1] - B[1]) * t + n; o[2] = B[2] + (A[2] - B[2]) * t + n * 1.05;
  });
}, { res: ST_RES }];

// ---- Contour: a real topographic map ------------------------------------------------------------------
// Hills and valleys from layered noise, with a contour line every few metres (every fifth one heavier),
// faint hill shading, and lines kept an even width however steep the ground.
PAT_KINDS.topo = [128, 96, (x, w, h, R, p, res) => {
  const A = rgbOf(p.a || '#1f3a35'), Bc = rgbOf(p.b || '#7fd6b8'), H = stFbm(R, w, h, 64, 4), d = 0.35;
  stShade(x, w, h, res, (X, Y, o) => {
    const z = H(X, Y) * 14, gx = (H(X + d, Y) - H(X - d, Y)) * 14 / (2 * d), gy = (H(X, Y + d) - H(X, Y - d)) * 14 / (2 * d), g = Math.hypot(gx, gy) + 1e-4;
    const fr = z - Math.round(z), dist = Math.abs(fr) / g, idx = ((Math.round(z) % 5) + 5) % 5 === 0, lw = idx ? 0.45 : 0.22;
    const a = clamp((lw - dist) * res + 0.5, 0, 1) * (idx ? 1 : 0.8);
    const shade = clamp(0.5 - (gx * 0.6 + gy * 0.8) * 1.6, 0, 1), l = (shade - 0.5) * 22 + (H(X, Y) - 0.5) * 18;
    o[0] = A[0] + l + (Bc[0] - A[0] - l) * a; o[1] = A[1] + l + (Bc[1] - A[1] - l) * a; o[2] = A[2] + l + (Bc[2] - A[2] - l) * a;
  });
}, { res: ST_RES }];

// ---- Black Ice: frozen over ---------------------------------------------------------------------------
// Dark ice with depth: plates split by fine bright fractures, frost ferns growing across the surface in
// sixty-degree branches, and trapped bubbles. a: ice, b: the light in it.
PAT_KINDS.frost = [128, 96, (x, w, h, R, p, res) => {
  const A = rgbOf(p.a || '#0e1a26'), Bc = rgbOf(p.b || '#9fd8ff'), C = stCells(R, w, h, 6, 4, 0.45), Dp = stFbm(R, w, h, 40, 3), Wx = stFbm(R, w, h, 24, 2), Jg = stNoise(R, w, h, 2.5), Fn = stNoise(R, w, h, 1);
  stShade(x, w, h, res, (X, Y, o) => {
    const q = C.q(X + (Wx(X, Y) - 0.5) * 12 + (Jg(X, Y) - 0.5) * 1.6, Y + (Wx(Y, X) - 0.5) * 12 + (Jg(Y, X) - 0.5) * 1.6), hp = stHash2(q.i, q.j, 3), hw = hp < 0.2 ? 0 : 0.12 + 0.24 * hp;
    const crack = hw ? clamp((hw - q.e) * res + 0.5, 0, 1) : 0, halo = hw ? Math.exp(-q.e / 1.4) * 0.35 : 0;
    const depth = Dp(X, Y), l = depth * 0.45 + halo + (C.P[q.i].v - 0.5) * 0.12 + (Fn(X, Y) - 0.5) * 0.06;
    o[0] = A[0] + Bc[0] * l * 0.4; o[1] = A[1] + Bc[1] * l * 0.4; o[2] = A[2] + Bc[2] * l * 0.45;
    o[0] += (235 - o[0]) * crack; o[1] += (248 - o[1]) * crack; o[2] += (255 - o[2]) * crack;
  });
  // frost ferns: a stem with side shoots at sixty degrees, and shoots on the shoots
  const fern = (x0, y0, an, L, lw, d) => {
    const pts = [x0, y0]; let cx = x0, cy = y0;
    for (let s = 1; s <= L; s++) {
      cx += Math.cos(an) * 1.2; cy += Math.sin(an) * 1.2; pts.push(cx, cy);
      if (d < 2 && s % 2 === 0 && s < L - 1) { const k = (L - s) * 0.42; fern(cx, cy, an + Math.PI / 3, Math.floor(k), lw * 0.6, d + 1); fern(cx, cy, an - Math.PI / 3, Math.floor(k), lw * 0.6, d + 1); }
    }
    txRep(x, w, h, () => { x.strokeStyle = rgba(p.b || '#9fd8ff', 0.25); x.lineWidth = lw * 3; txLine(x, pts); x.stroke(); x.strokeStyle = 'rgba(235,248,255,0.85)'; x.lineWidth = lw; x.stroke(); });
  };
  x.lineCap = 'round';
  for (let i = 0; i < 11; i++) fern(R.r(0, w), R.r(0, h), R.r(0, TAU), R.i(12, 24), 0.4, 0);
  for (let i = 0; i < 40; i++) { const cx = R.r(0, w), cy = R.r(0, h), r = R.r(0.25, 1.1); txRep(x, w, h, () => { x.strokeStyle = 'rgba(220,240,255,0.5)'; x.lineWidth = 0.15; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.stroke(); x.fillStyle = 'rgba(255,255,255,0.7)'; x.beginPath(); x.arc(cx - r * 0.35, cy - r * 0.35, r * 0.25, 0, TAU); x.fill(); }); }
}, { res: ST_RES }];

// ---- Marble Hall: polished stone ------------------------------------------------------------------------
// Veins that follow a turbulent flow the way real marble forms: broad soft drifts, sharp dark veins with
// fine branches, and (c) a few veins filled with gold that catch the light. a: stone, b: veins.
PAT_KINDS.marble = [128, 96, (x, w, h, R, p, res) => {
  const A = rgbOf(p.a || '#efebe5'), Bv = rgbOf(p.b || '#6f727a'), G = p.c ? rgbOf(p.c) : null, T1 = stFbm(R, w, h, 48, 5), T2 = stFbm(R, w, h, 24, 4), Cl = stFbm(R, w, h, 32, 3), Fn = stNoise(R, w, h, 0.9);
  const vein = (v, sharp) => Math.pow(1 - Math.abs(Math.sin(v)), sharp);
  stShade(x, w, h, res, (X, Y, o) => {
    const t1 = (X * 0.9 + Y * 0.5) * TAU / 128 * 2 + T1(X, Y) * 13, t2 = (X * 0.4 - Y * 0.8) * TAU / 128 * 3 + T2(X, Y) * 10;
    const v1 = vein(t1, 10), v2 = vein(t2, 26) * smooth((Cl(X, Y) - 0.4) / 0.3), soft = vein(t1 * 0.5 + 0.7, 2.5) * 0.25 + (Cl(X, Y) - 0.5) * 0.25;
    const dk = clamp(v1 * 1.1 + v2 * 0.85 + soft * 1.4, 0, 1), n = (Fn(X, Y) - 0.5) * 6;
    let r = A[0] + (Bv[0] - A[0]) * dk + n, g = A[1] + (Bv[1] - A[1]) * dk + n, b = A[2] + (Bv[2] - A[2]) * dk + n;
    if (G) { const gv = clamp(vein(t2 * 0.5 + 1.9, 30) * 1.4, 0, 1) * smooth((Cl(Y, X) - 0.4) / 0.2); if (gv > 0.01) { const s = 0.8 + 0.4 * Fn(X * 2, Y * 2); r += (G[0] * s - r) * gv; g += (G[1] * s - g) * gv; b += (G[2] * s - b) * gv; } }
    o[0] = r; o[1] = g; o[2] = b;
  });
}, { res: ST_RES }];

// ---- Engraved scrollwork -------------------------------------------------------------------------------
// Hand-cut gunsmith's scroll: spiralling vines that tighten into curls, acanthus leaves with a centre
// vein and shading cuts along one side, a fine border, and a stippled ground. a: ground ('none' to lay
// over metal), b: the ink of the cuts.
PAT_KINDS.scroll = [96, 80, (x, w, h, R, p) => {
  txBg(x, w, h, p.a); const ink = p.b || '#2c3138';
  x.strokeStyle = ink; x.fillStyle = ink; x.lineCap = 'round'; x.lineJoin = 'round';
  // a curl: a spiral that tightens from radius r0 over turns, winding d (1 or -1)
  const curl = (cx, cy, r0, turns, a0, d) => { const pts = []; for (let k = 0; k <= 60; k++) { const u = k / 60, th = a0 + d * u * turns * TAU, r = r0 * Math.pow(1 - u, 1.3) + 0.4; pts.push(cx + Math.cos(th) * r, cy + Math.sin(th) * r); } return pts; };
  // a leaf from (bx, by) pointing along an, length L: outline, centre vein, cuts on its shaded side
  const leaf = (bx, by, an, L, d) => {
    const ca = Math.cos(an), sa = Math.sin(an), P = (u, v) => [bx + ca * u - sa * v, by + sa * u + ca * v], o = [];
    for (let i = 0; i <= 12; i++) { const u = i / 12, wv = Math.sin(u * Math.PI) * L * 0.3 * (1 + 0.25 * Math.sin(u * 9)); o.push(P(u * L, wv * d)); }
    for (let i = 12; i >= 0; i--) { const u = i / 12; o.push(P(u * L, -Math.sin(u * Math.PI) * L * 0.12 * d)); }
    x.lineWidth = 0.45; x.beginPath(); o.forEach((q, i) => (i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]))); x.closePath(); x.stroke();
    x.lineWidth = 0.22; x.beginPath(); let q = P(0, 0); x.moveTo(q[0], q[1]); for (let i = 1; i <= 8; i++) { q = P((i / 8) * L * 0.92, Math.sin((i / 8) * Math.PI) * L * 0.06 * d); x.lineTo(q[0], q[1]); } x.stroke();
    x.lineWidth = 0.14; for (let i = 1; i < 9; i++) { const u = i / 10, a = P(u * L, Math.sin(u * Math.PI) * L * 0.05 * d), b = P(u * L + L * 0.06, Math.sin(u * Math.PI) * L * 0.27 * d); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
  };
  const vine = (y0, sx, d) => {
    const main = []; for (let xx = -8; xx <= w + 8; xx += 2) main.push(xx + sx, y0 + 9 * Math.sin(((xx) / w) * TAU) * d);
    x.lineWidth = 1.3; txLine(x, main, true); x.stroke(); x.lineWidth = 0.35; x.globalAlpha = 0.7; x.save(); x.translate(0.6, 0.6); txLine(x, main, true); x.stroke(); x.restore(); x.globalAlpha = 1;
    for (const c of [[w * 0.25, -1], [w * 0.75, 1]]) {
      const cx = c[0] + sx, cy = y0 + 9 * Math.sin((c[0] / w) * TAU) * d - c[1] * d * 10, sp = curl(cx, cy, 11, 1.8, c[1] * d > 0 ? Math.PI / 2 : -Math.PI / 2, c[1] * d);
      x.lineWidth = 1.1; txLine(x, sp, true); x.stroke(); x.beginPath(); x.arc(sp[sp.length - 2], sp[sp.length - 1], 1.3, 0, TAU); x.fill();
      for (let k = 0; k < 4; k++) { const i = 6 + k * 9, an = Math.atan2(sp[i * 2 + 3] - sp[i * 2 + 1], sp[i * 2 + 2] - sp[i * 2]); leaf(sp[i * 2], sp[i * 2 + 1], an - c[1] * d * 0.9, 9 - k * 1.5, c[1] * d); }
      leaf(cx - 8, cy + c[1] * d * 8, -Math.PI / 2 * c[1] * d - 0.5, 10, 1); leaf(cx + 8, cy + c[1] * d * 8, -Math.PI / 2 * c[1] * d + 0.5, 10, -1); leaf(cx, cy + c[1] * d * 11, Math.PI / 2 * c[1] * d, 8, 1);
    }
  };
  txRep(x, w, h, () => { vine(20, 0, 1); vine(60, w / 2, -1); });
  x.globalAlpha = 0.5; for (let i = 0; i < 260; i++) { const cx = R.r(0, w), cy = R.r(0, h); txRep(x, w, h, () => { x.beginPath(); x.arc(cx, cy, 0.18, 0, TAU); x.fill(); }); }
  x.globalAlpha = 1;
}, { res: ST_RES }];
