// ---------------------------------------------------------------------------
// HARROW RIDGE. The old army proving ground, snowed in: a white valley, a
// compound of concrete bunkers and watch towers, and a far wall of rock with
// sniper hides cut into it.
//
// The shooter lies high on the opposite side of the valley, so you look DOWN
// on everything. Each row of buildings sits a little higher in the glass than
// the row in front of it, and the strip of ground you can see in front of a
// row is only a few metres tall on its plane. Tracks, pads and shadows are
// drawn squashed into that strip so they read as lying on the snow.
// ---------------------------------------------------------------------------

// Cold light for the three times of day this place is seen in.
function harrowLight(S, time) {
  const p = S.pal;
  if (time === 'dusk') Object.assign(p, { skyTop: '#2b2d5e', skyBot: '#f2a273', fog: '#c29aa0', fogD: 3000, amb: '#3b3562', ambT: 0.34, ground: '#f1eaf1', road: '#bcb3c6', cloud: '#eaa98f', sun: '#ffd09a', rim: 'rgba(255,236,222,0.6)' });
  else if (time === 'dawn') Object.assign(p, { skyTop: '#47609a', skyBot: '#f8d2b4', fog: '#e6d2c8', fogD: 3000, amb: '#8a7f9c', ambT: 0.2, ground: '#f4eff2', road: '#c5c0cd', cloud: '#fbdcc8', sun: '#ffe9c4', rim: 'rgba(255,246,236,0.62)' });
  else Object.assign(p, { skyTop: '#7f9bb8', skyBot: '#e4ecf3', fog: '#dfe7ee', fogD: 3200, amb: '#d3dde8', ambT: 0.1, ground: '#fafcfe', road: '#c9d2dc' });
}

// The standard duck is four pixels wide at a kilometre. This one is drawn
// big enough to find at the ranges in this chapter (use it as a drawFn).
K.bigDuck = function (ctx, env, S, ob) {
  if (!ob.alive) return;
  const x = ob.x, y = ob.y - 0.12, k = 2.2;
  circ(ctx, x, y, 0.2 * k, '#f7d038'); circ(ctx, x + 0.14 * k, y + 0.2 * k, 0.13 * k, '#f7d038');
  poly(ctx, [x + 0.24 * k, y + 0.22 * k, x + 0.4 * k, y + 0.17 * k, x + 0.24 * k, y + 0.13 * k], '#f08a24'); circ(ctx, x + 0.17 * k, y + 0.24 * k, 0.03 * k, '#1b1b1b');
};

// ---- snow and rock ----------------------------------------------------------
// Snow-covered ground for one plane. `band` is how tall the visible strip of
// ground is (metres on this plane) before the next nearer row covers it.
K.snow = function (S, P, o) {
  o = o || {};
  const y = o.y || 0, base = o.col || S.pal.ground, band = o.band || 7, sd = (o.seed || 1) * 131 + Math.round(P.z);
  K.ground(S, P, { y, col: base, noEdge: true, mat: 'snow' });
  const hollow = S.tone(mix(base, '#6f86a8', 0.2), P), crest = S.tone(lighten(base, 0.65), P);
  const R = makeRng(sd), x0 = o.x0 === undefined ? -330 : o.x0, x1 = o.x1 === undefined ? 330 : o.x1, dr = [];
  for (let x = x0; x < x1; x += R.r(4, 11)) dr.push([x, R.r(3, 9), R.f(), R.r(0.6, 1.3)]);
  P.add({ x0, x1, layer: 0, draw(ctx, env) {
    for (let i = 0; i < dr.length; i++) {
      const q = dr[i]; if (q[0] + q[1] < env.x0 || q[0] - q[1] > env.x1) continue;
      const yy = y - 0.3 - q[2] * band * 0.92, hh = 0.1 * q[3] + band * 0.014;
      ctx.fillStyle = hollow; ctx.beginPath(); ctx.ellipse(q[0], yy, q[1], hh, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = crest; ctx.beginPath(); ctx.ellipse(q[0] - q[1] * 0.12, yy + hh * 0.9, q[1] * 0.82, hh * 0.6, 0, 0, TAU); ctx.fill();
    }
  } });
  // spindrift: loose snow streaming along the ground with the wind
  if (o.drift !== false) P.add({ x0, x1, layer: 2, draw(ctx, env) {
    const w = env.wind, a = Math.min(1, Math.abs(w) / 7); if (a < 0.1) return;
    const span = 52, first = Math.floor(env.x0 / span) - 1, last = Math.ceil(env.x1 / span);
    ctx.fillStyle = '#ffffff';
    for (let i = first; i <= last; i++) for (let j = 0; j < 2; j++) {
      const h = Math.sin(i * 12.9898 + j * 78.233 + sd) * 43758.5453, ph = h - Math.floor(h);
      const u = (((env.t * w * 0.8 + ph * span * 7) % span) + span) % span, x = i * span + u, len = 4 + 9 * a + 5 * ph;
      ctx.globalAlpha = (0.1 + 0.22 * a) * Math.sin((u / span) * Math.PI);
      ctx.beginPath(); ctx.ellipse(x, y + 0.2 + ph * 1.2 - j * band * 0.3, len, 0.1 + 0.22 * ph, 0, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  } });
};

// Packed-snow track squashed into a plane's ground strip: from xTop on the
// ground line down to xBot at the bottom of the strip.
K.snowTrack = function (S, P, xTop, xBot, band, o) {
  o = o || {}; const w = o.w || 2.6, c = S.tone(o.col || S.pal.road, P), rut = S.tone(darken(o.col || S.pal.road, 0.16), P), y = o.y || 0;
  P.add({ x0: Math.min(xTop, xBot) - w - 1, x1: Math.max(xTop, xBot) + w + 1, layer: 0, draw(ctx, env) {
    poly(ctx, [xTop - w, y, xTop + w, y, xBot + w * 1.1, y - band, xBot - w * 1.1, y - band], c);
    line(ctx, xTop - w * 0.55, y, xBot - w * 0.6, y - band, rut, 0.12, env); line(ctx, xTop + w * 0.55, y, xBot + w * 0.6, y - band, rut, 0.12, env);
  } });
};

// A wall of rock with snow along its crest, on ledges and in the gullies.
// Returns its plane, with heightAt(x). Bullets stop on it.
K.crag = function (S, z, o) {
  o = o || {};
  const P = S.plane(z, o.name || 'crag');
  const sd = o.seed || 4, x0 = o.x0 === undefined ? -1200 : o.x0, x1 = o.x1 === undefined ? 1200 : o.x1, step = o.step || 10, floor = o.floor || 0, base = floor - (o.depth || 70), H = o.h || 150;
  const hex = o.col || '#3a4452', pts = [];
  for (let x = x0; x <= x1 + 0.1; x += step) {
    const big = 0.5 + 0.5 * vnoise(x / (o.rough || 230), sd), mid = 1 - Math.abs(vnoise(x / 61, sd + 9)), tooth = Math.abs(vnoise(x / 17, sd + 21));
    pts.push([x, floor + H * (0.42 + 0.36 * big + 0.16 * mid * mid + 0.06 * tooth) * (o.shape ? o.shape(x) : 1)]);
  }
  const n = pts.length, ix = (x) => clamp(Math.floor((x - x0) / step), 0, n - 1);
  P.heightAt = (x) => { const i = clamp((x - x0) / step, 0, n - 1.001), a = Math.floor(i); return lerp(pts[a][1], pts[a + 1][1], i - a); };
  const tones = [S.tone(hex, P), S.tone(darken(hex, 0.3), P), S.tone(lighten(hex, 0.24), P), S.tone(darken(hex, 0.14), P)], dark = S.tone(darken(hex, 0.42), P), snow = S.tone(o.snowCol || '#f6f9fc', P), snowSh = S.tone('#9fb3ca', P);
  const R = makeRng(sd * 53 + 7), cap = [], ledges = [], cracks = [], ribs = [];
  // the face is cut into slanting slabs of slightly different rock
  for (let i = 0; i < n - 1;) { const w = R.i(1, 3); ribs.push([i, R.r(-0.9, 0.9) * step * 1.6, R.i(0, 3)]); i += w; }
  ribs.push([n - 1, 0, 0]);
  for (let r = 1; r < ribs.length - 1; r++) if (ribs[r][2] === ribs[r - 1][2]) ribs[r][2] = (ribs[r][2] + 1) % 4;
  // snow lies deep where the crest is flat and thin where it is steep
  for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], sl = Math.abs((b[1] - a[1]) / (b[0] - a[0])); cap.push(clamp((o.snow || 1) * (9 - 7 * sl) * (0.5 + 0.5 * R.f()), 0.8, 12)); }
  for (let x = x0 + 20; x < x1 - 20; x += R.r(5, 15)) { const top = P.heightAt(x), y = lerp(floor + 6, top - 12, R.f()), w = R.chance(0.22) ? R.r(18, 40) : R.r(4, 13), t = R.r(0.6, 1.6); if (top - floor > 34) ledges.push([x, y, w, t, R.r(-0.06, 0.06)]); }
  for (let x = x0 + 9; x < x1 - 9; x += R.r(5, 15)) { const top = P.heightAt(x); cracks.push([x, top - R.r(8, 50), R.r(6, 26), R.r(-3, 3)]); }
  P.add({ x0, x1, layer: 0, draw(ctx, env) {
    const i0 = Math.max(0, ix(env.x0) - 5), i1 = Math.min(n - 1, ix(env.x1) + 5);
    for (let r = 0; r < ribs.length - 1; r++) {
      const a = ribs[r], b = ribs[r + 1]; if (b[0] < i0 || a[0] > i1) continue;
      ctx.fillStyle = tones[a[2]]; ctx.beginPath(); ctx.moveTo(pts[a[0]][0] + a[1], base);
      for (let i = a[0]; i <= b[0]; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[b[0]][0] + b[1] + 0.6, base); ctx.closePath(); ctx.fill();
    }
    if (env.s > 2) { ctx.strokeStyle = dark; ctx.lineWidth = Math.max(0.2, env.px * 0.8); ctx.beginPath(); for (let i = 0; i < cracks.length; i++) { const q = cracks[i]; if (q[0] < env.x0 - 6 || q[0] > env.x1 + 6) continue; ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + q[3] * 0.4, q[1] - q[2] * 0.5); ctx.lineTo(q[0] + q[3], q[1] - q[2]); } ctx.stroke(); }
    // gullies: snow packed into every notch in the crest
    for (let i = Math.max(1, i0); i < i1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      if (b[1] > a[1] || b[1] >= c[1]) continue;
      const len = 18 + ((i * 37) % 31);
      poly(ctx, [b[0] - step * 0.55, b[1] + (a[1] - b[1]) * 0.55, b[0] + step * 0.55, b[1] + (c[1] - b[1]) * 0.55, b[0] + 2.2 + (i % 3), b[1] - len * 0.55, b[0] + (i % 5) - 2, b[1] - len], snow);
    }
    // the cap of snow along the top, with its shadow under the lip
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? snow : snowSh; ctx.beginPath(); ctx.moveTo(pts[i0][0], pts[i0][1]);
      for (let i = i0; i <= i1; i++) ctx.lineTo(pts[i][0], pts[i][1] + 0.7);
      for (let i = i1; i >= i0; i--) ctx.lineTo(pts[i][0] + (i % 2 ? 2.2 : -1.6), pts[i][1] - cap[i] - (pass ? 0 : 1.3));
      ctx.closePath(); ctx.fill();
    }
    for (let i = 0; i < ledges.length; i++) {
      const q = ledges[i], x = q[0], y = q[1], w = q[2], t = q[3], sl = q[4] * w; if (x + w < env.x0 || x - w > env.x1) continue;
      poly(ctx, [x - w / 2 + 0.6, y - 0.5 - sl, x + w / 2 - 0.4, y - 0.4 + sl, x + w * 0.3, y - 2.0 - t + sl * 0.5, x - w * 0.25, y - 2.5 - t - sl * 0.5], dark);
      poly(ctx, [x - w / 2, y - 0.3 - sl, x - w * 0.3, y + t - sl * 0.5, x + w * 0.25, y + t * 0.9 + sl * 0.5, x + w / 2, y - 0.2 + sl, x + w * 0.3, y - 0.7 + sl * 0.6, x - w * 0.2, y - 0.8 - sl * 0.4], snow);
    }
  } });
  // snow blowing off the crest: the plume leans with the wind
  if (o.plume !== false) P.add({ x0, x1, layer: 1, draw(ctx, env) {
    const w = env.wind, a = Math.min(1, Math.abs(w) / 7); if (a < 0.15) return;
    const dir = w >= 0 ? 1 : -1; ctx.fillStyle = '#ffffff';
    for (let i = Math.max(1, ix(env.x0) - 6); i < Math.min(n - 1, ix(env.x1) + 6); i++) {
      const a0 = pts[i - 1], b = pts[i], c = pts[i + 1]; if (b[1] < a0[1] || b[1] <= c[1]) continue;
      for (let k = 0; k < 4; k++) { const u = (env.t * (0.16 + 0.1 * a) + k / 4 + i * 0.37) % 1; ctx.globalAlpha = 0.34 * a * (1 - u) * Math.min(1, u * 5); ctx.beginPath(); ctx.ellipse(b[0] + dir * u * (16 + 26 * a), b[1] + 1 + u * 3.5, 3 + u * 11, 1.1 + u * 2.8, 0, 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  } });
  if (o.solid !== false) for (let i = 0; i < n - 1; i++) P.solid(pts[i][0], base, step, Math.min(pts[i][1], pts[i + 1][1]) - base - 0.4, 'hard');
  P.groundY = floor; P.groundMat = 'snow';
  return P;
};

// Snow thrown up by a blasting charge: a white burst on a slope that billows
// and drifts off down the wind. B.fire(t, x, y) sets one off (t is the
// mission time); `k` scales it for the distance of the plane it is on.
K.snowBlasts = function (S, P, k) {
  const list = [], shade = S.tone('#7d93ae', P); k = k || 1;
  P.add({ x0: -2000, x1: 2000, layer: 1, draw(ctx, env) {
    for (let i = 0; i < list.length; i++) {
      const b = list[i], u = (env.t - b.t) / 6.5; if (u < 0 || u > 1) continue;
      for (let pass = 0; pass < 2; pass++) {   // a blue-grey underside, then the lit top, so it shows against snow
        ctx.fillStyle = pass ? '#ffffff' : shade;
        for (let j = 0; j < 9; j++) { const a = j * 2.4 + b.x, q = Math.min(1, u * (1.7 + (j % 3) * 0.6)); ctx.globalAlpha = (pass ? 0.8 : 0.6) * (1 - u) * Math.min(1, u * 16); ctx.beginPath(); ctx.ellipse(b.x + (Math.cos(a) * q * 9 + env.wind * u * 2.5 + (pass ? -0.6 : 0.5)) * k, b.y + (Math.abs(Math.sin(a)) * q * 11 + q * 5 - u * u * 7 + (pass ? 0.9 : -0.7)) * k, (2.5 + q * 6) * k * (pass ? 0.86 : 1), (2 + q * 4.5) * k * (pass ? 0.8 : 1), 0, 0, TAU); ctx.fill(); }
      }
      if (u < 0.05) { ctx.globalAlpha = 1 - u / 0.05; circ(ctx, b.x, b.y + 1.5 * k, (2 + u * 60) * k, '#ffd58a'); }
    }
    ctx.globalAlpha = 1;
  } });
  return { P, fire(t, x, y) { list.push({ t, x, y: y === undefined ? P.heightAt(x) : y }); if (list.length > 8) list.shift(); } };
};

// A sniper hide on a snowy ledge: a low wall of stacked stone, a dark slot,
// and a slab roof. All hides look the same from across the valley.
K.hide = function (S, P, x, y, o) {
  o = o || {};
  const rock = S.tone('#3d4651', P), rockL = S.tone('#6b7785', P), snow = S.tone('#f3f6fa', P), sh = S.tone('#a9bace', P), hole = S.tone('#0f1318', P), net = S.tone('#7f8a78', P);
  const L = o.left === undefined ? 5 : o.left, Rt = o.right === undefined ? 11 : o.right;
  P.add({ x0: x - L - 2, x1: x + Rt + 2, layer: 0, draw(ctx, env) {
    poly(ctx, [x - L, y - 0.2, x + Rt, y - 0.2, x + Rt - 1.4, y - 3.0, x + Rt * 0.3, y - 4.1, x - L + 1.6, y - 3.4], rock);
    poly(ctx, [x - L - 0.9, y - 0.3, x - L + 0.5, y + 0.3, x + Rt - 0.6, y + 0.24, x + Rt + 0.8, y - 0.35, x + Rt - 0.5, y - 0.8, x - L + 0.4, y - 0.85], snow);
    poly(ctx, [x - L + 0.4, y - 0.85, x + Rt - 0.5, y - 0.8, x + Rt - 1.0, y - 1.25, x - L + 1.0, y - 1.3], sh);
    R4(ctx, x - 1.9, y + 0.2, 3.8, 1.5, rock);
    for (let k = 0; k < 5; k++) R4(ctx, x - 1.9 + k * 0.76, y + 0.2, 0.7, 0.52, k % 2 ? rockL : rock);
    R4(ctx, x - 1.5, y + 0.72, 3.0, 0.5, hole); R4(ctx, x - 1.5, y + 0.72, 3.0, 0.5, 'rgba(6,8,12,0.6)');
    poly(ctx, [x - 2.2, y + 1.22, x + 2.1, y + 1.22, x + 1.8, y + 1.64, x - 1.9, y + 1.68], rockL);
    poly(ctx, [x - 2.3, y + 1.6, x - 1.5, y + 2.1, x + 1.2, y + 2.15, x + 2.2, y + 1.58], snow);
    if (env.s > 9) { ctx.strokeStyle = net; ctx.lineWidth = Math.max(0.04, env.px * 0.7); ctx.beginPath(); for (let k = 0; k < 7; k++) { const xx = x - 1.4 + k * 0.46; ctx.moveTo(xx, y + 1.22); ctx.lineTo(xx + 0.1, y + 1.05 - (k % 3) * 0.06); } ctx.stroke(); }
  } });
  return { x, y, P, lens: [x + 0.15, y + 0.97], at: (dx, extra) => Object.assign({ plane: P, x: x + (dx || 0), y: y + 0.26, zone: 'ridge', room: null, behind: false }, extra || {}) };
};

// ---- the compound -----------------------------------------------------------
// A concrete bunker with sloped walls, firing slits and a slab roof under snow.
// People can stand on the roof: B.on(x) is a placement up there.
K.bunker = function (S, P, x, w, h, o) {
  o = o || {};
  const y = o.y || 0, id = o.id || ('bk' + Math.round(x)), hex = o.col || '#79818b';
  const c = S.tone(hex, P), c2 = S.tone(darken(hex, 0.16), P), c3 = S.tone(darken(hex, 0.42), P), snow = S.tone('#f4f7fa', P), sh = S.tone(mix(S.pal.ground, '#6f86a8', 0.3), P), glow = S.tone('#ffd98a', P, true);
  const slits = o.slits === undefined ? Math.max(1, Math.floor(w / 6.5)) : o.slits, roofY = y + h + 0.45;
  P.add({ x0: x - 4, x1: x + w + 4, layer: 0, draw(ctx, env) {
    const lit = S.pal.dark > 0.3 && S.power !== false;   // windows glow at dusk while the generator runs
    ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(x + w / 2 + 1.5, y - 0.35, w / 2 + 2.5, 0.5, 0, 0, TAU); ctx.fill();
    poly(ctx, [x - 0.9, y, x + w + 0.9, y, x + w, y + h, x, y + h], c);
    poly(ctx, [x + w - 2.2, y, x + w + 0.9, y, x + w, y + h, x + w - 1.6, y + h], c2);
    R4(ctx, x - 0.9, y, w + 1.8, 0.5, c2);
    for (let i = 0; i < slits; i++) { const sx = x + ((i + 0.5) * w) / slits - 1.1; if (o.door !== undefined && Math.abs(sx + 1.1 - o.door) < 2.4) continue; R4(ctx, sx - 0.15, y + h * 0.56 - 0.12, 2.5, 0.75, c2); R4(ctx, sx, y + h * 0.56, 2.2, 0.48, lit ? glow : c3); }
    if (o.door !== undefined) { R4(ctx, o.door - 0.85, y, 1.7, 2.45, c2); R4(ctx, o.door - 0.65, y, 1.3, 2.2, c3); if (lit) R4(ctx, o.door - 0.3, y + 1.45, 0.6, 0.4, glow); }
    R4(ctx, x - 0.55, y + h, w + 1.1, 0.45, c2);
    if (o.text) env.text(ctx, o.text, x + (o.textX === undefined ? w * 0.8 : o.textX), y + h * 0.22, Math.min(1.3, h * 0.3), c3, 'center');
    // snow on the roof and drifted against the foot of the wall
    ctx.fillStyle = snow; ctx.beginPath(); ctx.moveTo(x - 0.6, roofY - 0.05);
    const nb = Math.max(3, Math.round(w / 3.2));
    for (let i = 0; i <= nb; i++) { const u = i / nb; ctx.lineTo(x - 0.6 + (w + 1.2) * u, roofY + 0.34 + 0.2 * Math.sin(i * 2.4 + x)); }
    ctx.lineTo(x + w + 0.6, roofY - 0.05); ctx.closePath(); ctx.fill();
    poly(ctx, [x - 2.6, y, x - 0.9, y, x - 0.6, y + 0.75], snow); poly(ctx, [x + w + 2.8, y, x + w + 0.9, y, x + w + 0.55, y + 0.6], snow);
  } });
  P.solid(x, y, w, h + 0.45, o.mat || 'wall', { bid: id });
  return { id, x, w, h, y, roofY: roofY + 0.2, P, zone: id + ':roof', on: (xx, extra) => Object.assign({ plane: P, x: xx, y: roofY + 0.2, zone: id + ':roof', room: null, behind: false }, extra || {}) };
};

// A watch tower: lattice legs, an open cab with a knee-high rail, a roof under
// snow. Whoever is inside shows from the hips up. T.at(dx) is a placement.
K.watch = function (S, P, x, h, o) {
  o = o || {};
  const y = o.y || 0, w = o.w || 4, id = o.id || ('wt' + Math.round(x)), rail = 0.8, f = y + h;
  const steel = S.tone('#39414b', P), wood = S.tone(o.col || '#6b5f52', P), woodD = S.tone(darken(o.col || '#6b5f52', 0.32), P), snow = S.tone('#f4f7fa', P), sh = S.tone(mix(S.pal.ground, '#6f86a8', 0.3), P);
  const room = S.room(id, false), lx = x - w / 2, rx = x + w / 2, sp = o.spread === undefined ? 0.9 : o.spread;
  P.add({ x0: x - w - 2, x1: x + w + 2, layer: 0, draw(ctx, env) {
    ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(x + 1, y - 0.3, w / 2 + 1.6, 0.4, 0, 0, TAU); ctx.fill();
    line(ctx, lx + 0.2, f, lx - sp, y, steel, 0.2, env); line(ctx, rx - 0.2, f, rx + sp, y, steel, 0.2, env);
    for (let k = 0; k < 3; k++) {
      const a = k / 3, b = (k + 1) / 3, la = lerp(lx - sp, lx + 0.2, a), ra = lerp(rx + sp, rx - 0.2, a), lb = lerp(lx - sp, lx + 0.2, b), rb = lerp(rx + sp, rx - 0.2, b);
      line(ctx, la, y + h * a, rb, y + h * b, steel, 0.08, env); line(ctx, ra, y + h * a, lb, y + h * b, steel, 0.08, env); line(ctx, lb, y + h * b, rb, y + h * b, steel, 0.08, env);
    }
    if (env.s > 3) { ctx.strokeStyle = steel; ctx.lineWidth = Math.max(0.05, env.px * 0.6); ctx.beginPath(); ctx.moveTo(x - 0.3, y); ctx.lineTo(x - 0.3, f); ctx.moveTo(x + 0.3, y); ctx.lineTo(x + 0.3, f); for (let yy = y + 0.4; yy < f; yy += 0.45) { ctx.moveTo(x - 0.3, yy); ctx.lineTo(x + 0.3, yy); } ctx.stroke(); }
    R4(ctx, lx - 0.3, f - 0.24, w + 0.6, 0.24, steel);
    R4(ctx, lx, f, w, rail, wood); R4(ctx, lx, f + rail - 0.12, w, 0.12, woodD);
    if (env.s > 6) { ctx.fillStyle = woodD; for (let xx = lx + 0.5; xx < rx; xx += 0.5) ctx.fillRect(xx, f, 0.04, rail - 0.12); }
    line(ctx, lx + 0.07, f + rail, lx + 0.07, f + 2.65, woodD, 0.14, env); line(ctx, rx - 0.07, f + rail, rx - 0.07, f + 2.65, woodD, 0.14, env);
  } });
  P.add({ x0: x - w - 1, x1: x + w + 1, layer: 1, draw(ctx, env) {
    poly(ctx, [lx - 0.7, f + 2.6, rx + 0.7, f + 2.6, rx + 0.15, f + 3.2, lx - 0.15, f + 3.2], woodD);
    poly(ctx, [lx - 0.75, f + 2.82, lx - 0.2, f + 3.5, x, f + 3.66, rx + 0.2, f + 3.5, rx + 0.75, f + 2.82, rx + 0.5, f + 2.74, lx - 0.5, f + 2.74], snow);
    R4(ctx, rx + 0.05, f + 1.95, 0.5, 0.42, steel); circ(ctx, rx + 0.56, f + 2.16, 0.2, S.pal.dark > 0.3 && S.power !== false ? '#fff3c4' : S.tone('#cfd6dc', P));
  } });
  P.solid(lx, f - 0.24, w, rail + 0.24, 'wood');
  P.solid(lx - 0.7, f + 2.6, w + 1.4, 0.7, 'thin');
  P.open({ x: lx, y: f + rail, w, h: 1.8, room: room.id, glass: false, through: true });
  return { id, x, w, floor: f, room: room.id, zone: room.id, P, at: (dx, extra) => Object.assign({ plane: P, x: x + (dx || 0), y: f, room: room.id, zone: room.id, behind: true }, extra || {}) };
};

// A search radar: a dish on a lattice pedestal that turns slowly.
K.radar = function (S, P, x, o) {
  o = o || {}; const y = o.y || 0, h = o.h || 8, steel = S.tone('#414a55', P), dishC = S.tone('#d5dbe1', P), dishD = S.tone('#8f99a4', P), red = S.tone('#c8372d', P), snow = S.tone('#f4f7fa', P);
  P.add({ x0: x - 6, x1: x + 6, layer: 0, draw(ctx, env) {
    R4(ctx, x - 2.4, y, 4.8, 2.2, S.tone('#7d858d', P)); R4(ctx, x - 2.6, y + 2.2, 5.2, 0.3, steel); poly(ctx, [x - 2.6, y + 2.5, x + 2.6, y + 2.5, x + 2.2, y + 2.85, x - 2.2, y + 2.85], snow);
    line(ctx, x - 1.1, y + 2.5, x - 0.35, y + h, steel, 0.16, env); line(ctx, x + 1.1, y + 2.5, x + 0.35, y + h, steel, 0.16, env);
    for (let k = 0; k < 3; k++) { const a = y + 2.5 + ((h - 2.5) * k) / 3, b = y + 2.5 + ((h - 2.5) * (k + 1)) / 3; line(ctx, x - 1.1 + 0.25 * k, a, x + 1.1 - 0.25 * (k + 1), b, steel, 0.07, env); line(ctx, x + 1.1 - 0.25 * k, a, x - 1.1 + 0.25 * (k + 1), b, steel, 0.07, env); }
    const th = env.t * 0.55, cw = Math.cos(th), wd = Math.abs(cw) * 2.9 + 0.22;
    R4(ctx, x - 0.3, y + h, 0.6, 0.7, steel);
    ctx.fillStyle = cw > 0 ? dishC : dishD; ctx.beginPath(); ctx.ellipse(x, y + h + 2.1, wd, 1.6, 0, 0, TAU); ctx.fill();
    if (wd > 0.8) { ctx.fillStyle = cw > 0 ? dishD : dishC; ctx.beginPath(); ctx.ellipse(x, y + h + 2.1, wd * 0.72, 1.18, 0, 0, TAU); ctx.fill(); R4(ctx, x - wd, y + h + 2.02, wd * 2, 0.16, red); }
  } });
  P.solid(x - 2.4, y, 4.8, 2.5, 'wall'); P.solid(x - 1.1, y + 2.5, 2.2, h - 2.5, 'grid');
  return { x, top: y + h + 3.7, roofY: y + 2.85 };
};

// A radio mast with guy wires and a red light that blinks.
K.mast = function (S, P, x, h, o) {
  o = o || {}; const y = o.y || 0, steel = S.tone('#3f4852', P), red = S.tone('#c8372d', P), white = S.tone('#e9edf1', P);
  P.add({ x0: x - h * 0.5, x1: x + h * 0.5, layer: 0, draw(ctx, env) {
    for (let k = 0; k < 6; k++) R4(ctx, x - 0.22, y + (h * k) / 6, 0.44, h / 6, k % 2 ? white : red);
    ctx.strokeStyle = steel; ctx.lineWidth = Math.max(0.04, env.px * 0.6); ctx.beginPath(); ctx.moveTo(x, y + h * 0.92); ctx.lineTo(x - h * 0.42, y); ctx.moveTo(x, y + h * 0.92); ctx.lineTo(x + h * 0.42, y); ctx.moveTo(x, y + h * 0.55); ctx.lineTo(x - h * 0.26, y); ctx.moveTo(x, y + h * 0.55); ctx.lineTo(x + h * 0.26, y); ctx.stroke();
    line(ctx, x, y + h, x, y + h + 1.6, steel, 0.08, env);
    if (Math.sin(env.t * 2.6) > 0.2) { circ(ctx, x, y + h + 0.1, 0.24, '#ff4a3d'); if (S.pal.dark > 0.3) { ctx.globalAlpha = 0.25; circ(ctx, x, y + h + 0.1, 1.1, '#ff4a3d'); ctx.globalAlpha = 1; } }
  } });
  P.solid(x - 0.22, y, 0.44, h, 'hard');
  return { x, top: y + h };
};

// A windsock: fills and lifts as the wind rises, and points where it blows.
K.windsock = function (S, P, x, h, o) {
  o = o || {}; const y = o.y || 0, pole = S.tone('#c9ced3', P), a0 = S.tone('#e8672c', P), a1 = S.tone('#f4f1ea', P);
  P.add({ x0: x - 5, x1: x + 5, layer: 2, draw(ctx, env) {
    line(ctx, x, y, x, y + h, pole, 0.1, env);
    const w = env.wind, a = Math.min(1, Math.abs(w) / 8), dir = w >= 0 ? 1 : -1, len = 3.0, n = 5, top = y + h - 0.15;
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n, f = (u) => Math.sin(env.t * (3 + a * 8) - u * 4) * 0.1 * (0.3 + a) * u, dr = (u) => (1 - a) * u * u * 2.3;
      const x0 = x + dir * u0 * len * (0.2 + 0.8 * a), x1 = x + dir * u1 * len * (0.2 + 0.8 * a), r0 = lerp(0.48, 0.2, u0), r1 = lerp(0.48, 0.2, u1);
      poly(ctx, [x0, top - dr(u0) + f(u0), x1, top - dr(u1) + f(u1), x1, top - dr(u1) + f(u1) - r1 * 2, x0, top - dr(u0) + f(u0) - r0 * 2], i % 2 ? a1 : a0);
    }
  } });
  return { x, top: y + h };
};

// A fuel tank on a cradle. Shooting it sets it off.
K.fuelTank = function (S, P, x, o) {
  o = o || {}; const y = (o.y || 0) + 1.9;
  return K.thing(S, P, 'tank', x, y, Object.assign({ r: 1.25, blast: 8, drawFn(ctx, env, S2, ob) {
    if (!ob.alive) { ctx.fillStyle = 'rgba(14,14,18,0.6)'; ctx.beginPath(); ctx.ellipse(x, y - 1.7, 4.2, 0.8, 0, 0, TAU); ctx.fill(); R4(ctx, x - 2.2, y - 1.9, 0.3, 1.4, S.tone('#23272d', P)); R4(ctx, x + 1.9, y - 1.9, 0.3, 1.1, S.tone('#23272d', P)); return; }
    R4(ctx, x - 2.0, y - 1.9, 0.35, 1.0, S.tone('#2a2e36', P)); R4(ctx, x + 1.65, y - 1.9, 0.35, 1.0, S.tone('#2a2e36', P));
    ctx.fillStyle = S.tone('#f6f9fc', P); ctx.beginPath(); ctx.ellipse(x, y + 0.16, 2.9, 1.22, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = S.tone('#c3cad1', P); ctx.beginPath(); ctx.ellipse(x, y - 0.08, 3.0, 1.14, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = S.tone('#9aa3ad', P); ctx.beginPath(); ctx.ellipse(x, y - 0.3, 2.86, 0.86, 0, Math.PI, TAU); ctx.fill();
    poly(ctx, [x, y + 0.5, x - 0.55, y - 0.4, x + 0.55, y - 0.4], S.tone('#e2572b', P)); R4(ctx, x - 0.07, y - 0.25, 0.14, 0.42, S.tone('#f4f1ea', P));
  } }, o));
};

// The generator: an open shed with a yellow set inside that shakes and smokes
// while it runs. Shoot it and the lamps and lit windows go dark.
K.genShed = function (S, P, x, o) {
  o = o || {}; const y = o.y || 0, steel = S.tone('#414a55', P), tin = S.tone('#77818b', P), snow = S.tone('#f4f7fa', P), back = S.tone('#2a313a', P);
  P.add({ x0: x - 5, x1: x + 5, layer: 0, draw(ctx, env) {
    R4(ctx, x - 3.6, y, 7.2, 3.0, back);
    line(ctx, x - 3.6, y, x - 3.6, y + 3.1, steel, 0.2, env); line(ctx, x + 3.6, y, x + 3.6, y + 3.1, steel, 0.2, env);
    poly(ctx, [x - 4.2, y + 3.0, x + 4.2, y + 3.0, x + 3.9, y + 3.5, x - 3.9, y + 3.6], tin);
    poly(ctx, [x - 4.2, y + 3.4, x - 3.0, y + 3.95, x + 2.4, y + 3.9, x + 4.2, y + 3.35], snow);
  } });
  const ob = S.obj({ kind: 'gen', id: o.id || 'gen', plane: P, x, y: y + 0.95, w: 3.0, h: 1.7, r: 1.0, mat: 'metal', breakable: true, layer: 2, onHit: o.onHit,
    draw(ctx, env) {
      const live = ob.alive, j = live ? Math.sin(env.t * 41) * 0.025 : 0, bx = x + j, by = y + 0.2;
      R4(ctx, bx - 1.5, by, 3.0, 1.5, S.tone(live ? '#e2b33c' : '#5c5340', P)); R4(ctx, bx - 1.5, by, 3.0, 0.3, S.tone('#2a2e36', P));
      R4(ctx, bx - 1.2, by + 0.55, 1.1, 0.7, S.tone('#2a2e36', P)); R4(ctx, bx + 0.3, by + 0.6, 0.9, 0.16, S.tone('#2a2e36', P)); R4(ctx, bx + 0.3, by + 0.9, 0.9, 0.16, S.tone('#2a2e36', P));
      R4(ctx, bx + 1.0, by + 1.5, 0.2, 1.5, S.tone('#2a2e36', P));
      if (live) { circ(ctx, bx - 0.65, by + 0.9, 0.12, Math.sin(env.t * 5) > 0 ? '#52e07a' : '#1f6a37'); ctx.fillStyle = 'rgba(70,74,84,0.5)'; for (let i = 0; i < 6; i++) { const u = (env.t * 0.45 + i / 6) % 1; ctx.globalAlpha = (1 - u) * 0.6; ctx.beginPath(); ctx.arc(bx + 1.1 + env.wind * u * u * 2.2, by + 3.1 + u * 4.5, 0.25 + u * 1.2, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; }
      else if (Math.sin(env.t * 23) > 0.7) circ(ctx, bx - 0.4, by + 1.0, 0.16, '#bfe4ff');
    } });
  P.solid(x - 4.2, y + 3.0, 8.4, 0.6, 'thin');
  return ob;
};

// The landing pad: a circle of cleared concrete seen from above, so it is drawn
// as a flat ellipse on the snow, with corner lights and a windsock beside it.
K.helipad = function (S, P, x, o) {
  o = o || {}; const y = o.y || 0, r = o.r || 9, k = o.squash || 0.14, pad = S.tone('#8f979f', P), mark = S.tone('#e2b33c', P), white = S.tone('#f2f2ec', P);
  P.add({ x0: x - r - 2, x1: x + r + 2, layer: 0, draw(ctx, env) {
    ctx.fillStyle = pad; ctx.beginPath(); ctx.ellipse(x, y - 0.15, r, r * k, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = mark; ctx.lineWidth = Math.max(0.12, env.px); ctx.beginPath(); ctx.ellipse(x, y - 0.15, r * 0.78, r * k * 0.78, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = white; ctx.fillRect(x - 2.0, y - 0.15 - r * k * 0.42, 0.55, r * k * 0.84); ctx.fillRect(x + 1.45, y - 0.15 - r * k * 0.42, 0.55, r * k * 0.84); ctx.fillRect(x - 2.0, y - 0.15 - r * k * 0.08, 4.0, r * k * 0.16);
    const on = Math.sin(env.t * 3.2) > 0;
    for (let i = -1; i <= 1; i += 2) { const lx = x + i * r * 0.97; R4(ctx, lx - 0.1, y - 0.15, 0.2, 0.45, S.tone('#2a2e36', P)); circ(ctx, lx, y + 0.4, 0.16, on ? '#52e07a' : S.tone('#27603a', P)); if (on && S.pal.dark > 0.3) { ctx.globalAlpha = 0.22; circ(ctx, lx, y + 0.4, 0.9, '#52e07a'); ctx.globalAlpha = 1; } }
  } });
  return { x, y, r };
};

// A low concrete block, the kind you put across a road. Good cover.
K.block = function (S, P, x, o) {
  o = o || {}; const y = o.y || 0, w = o.w || 3, h = o.h || 1.15, c = S.tone('#9aa1a8', P), d = S.tone('#6e757c', P), snow = S.tone('#f4f7fa', P);
  P.add({ x0: x - w, x1: x + w, layer: o.layer === undefined ? 2 : o.layer, draw(ctx) {
    poly(ctx, [x - w / 2 - 0.25, y, x + w / 2 + 0.25, y, x + w / 2, y + h, x - w / 2, y + h], c); R4(ctx, x - w / 2 - 0.25, y, w + 0.5, 0.22, d);
    poly(ctx, [x - w / 2, y + h, x - w / 4, y + h + 0.22, x + w / 4, y + h + 0.26, x + w / 2, y + h], snow);
  } });
  P.solid(x - w / 2, y, w, h, 'hard');
};

// ---- the helicopter ----------------------------------------------------------
// Drawn nose to the right. The cabin has two windows: the pilot's bubble at
// the front and a wide one behind it for the passengers. The tail rotor (a
// yellow ring when it spins) is a separate shootable object: see K.heli.
CARS.heli = { len: 7, h: 2.5, body: 1.2, cab: [-0.3, 0.4], win: [[-0.2, 0.1], [0.17, 0.36]], seats: [0.265, -0.12, 0.02], wheel: 0,
  draw(ctx, env, S, P, x, y, dir, colHex, st) {
    st = st || {};
    const hex = colHex || '#262b33', col = S.tone(hex, P), dk = S.tone(darken(hex, 0.4), P), hi = S.tone(lighten(hex, 0.18), P), trim = S.tone(st.stripe || '#c8372d', P), gl = S.tone(S.pal.glass, P), metal = S.tone('#8d949a', P), snow = S.tone('#f4f7fa', P);
    const spin = st.spin || 0, t = env.t, parked = st.padY === undefined, alt = parked ? 0 : y - st.padY;
    if (!parked) {
      const k = clamp(1 - alt / 22, 0, 1);
      ctx.fillStyle = 'rgba(40,52,70,' + (0.1 + 0.2 * k).toFixed(2) + ')'; ctx.beginPath(); ctx.ellipse(x - dir * 1.5, st.padY - 0.3, 5.5 * (0.5 + 0.5 * k), 0.5 * (0.5 + 0.5 * k), 0, 0, TAU); ctx.fill();
      if (spin > 0.35 && alt < 16) { // snow thrown up by the rotor wash
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 12; i++) { const u = (t * 0.7 + i / 12) % 1, side = i % 2 ? 1 : -1; ctx.globalAlpha = 0.34 * spin * (1 - alt / 16) * (1 - u); ctx.beginPath(); ctx.ellipse(x + side * (3 + u * 13) + Math.sin(i * 5.1) * 2, st.padY + 0.3 + u * 2.6 + (i % 3) * 0.3, 1.2 + u * 3.4, 0.5 + u * 1.3, 0, 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
    }
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); if (st.tilt) ctx.rotate(st.tilt);
    const lw = (w) => Math.max(w, env.px * 0.9);
    // skids
    ctx.strokeStyle = dk; ctx.lineWidth = lw(0.12); ctx.beginPath(); ctx.moveTo(-2.0, 0.07); ctx.lineTo(2.3, 0.07); ctx.quadraticCurveTo(2.75, 0.1, 2.85, 0.42); ctx.moveTo(-1.2, 0.07); ctx.lineTo(-1.0, 0.55); ctx.moveTo(1.5, 0.07); ctx.lineTo(1.3, 0.55); ctx.stroke();
    // tail boom, fin and stabiliser
    poly(ctx, [-3.4, 1.98, -3.4, 1.3, -8.25, 1.6, -8.25, 1.88], col);
    poly(ctx, [-7.5, 1.86, -8.25, 1.6, -8.75, 1.2, -8.5, 1.72, -9.0, 3.15, -8.5, 3.2], col);
    R4(ctx, -7.1, 1.66, 1.1, 0.12, dk);
    // body
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(3.3, 1.05); ctx.quadraticCurveTo(3.2, 0.55, 2.6, 0.5); ctx.lineTo(-2.4, 0.5); ctx.lineTo(-3.5, 1.15); ctx.lineTo(-3.5, 1.98); ctx.lineTo(-2.9, 2.76); ctx.lineTo(0.9, 2.86); ctx.lineTo(1.9, 2.5); ctx.quadraticCurveTo(2.9, 1.9, 3.3, 1.05); ctx.fill();
    R4(ctx, -3.45, 0.93, 6.6, 0.2, trim);
    poly(ctx, [-2.9, 2.76, 0.9, 2.86, 0.6, 2.62, -2.7, 2.55], hi);
    circ(ctx, -2.75, 2.25, 0.2, dk);
    // glass
    const g = st.glass || [];
    R4(ctx, -1.4, 1.26, 2.1, 1.1, g[0] ? S.tone('#0d1016', P) : gl); R4(ctx, 1.19, 1.26, 1.33, 1.1, g[1] ? S.tone('#0d1016', P) : gl);
    poly(ctx, [2.52, 1.26, 3.12, 1.26, 2.52, 2.2], gl);
    ctx.fillStyle = 'rgba(210,230,255,0.16)'; if (!g[0]) ctx.fillRect(-1.4, 1.26, 0.7, 1.1); if (!g[1]) ctx.fillRect(1.19, 1.26, 0.45, 1.1);
    ctx.strokeStyle = dk; ctx.lineWidth = lw(0.07); ctx.strokeRect(-1.4, 1.26, 2.1, 1.1); ctx.strokeRect(1.19, 1.26, 1.33, 1.1);
    // mast and main rotor
    R4(ctx, -0.28, 2.82, 0.36, 0.62, dk); circ(ctx, -0.1, 3.48, 0.2, dk);
    if (spin < 0.06) {
      ctx.strokeStyle = dk; ctx.lineWidth = lw(0.14); ctx.beginPath(); ctx.moveTo(-0.1, 3.5); ctx.quadraticCurveTo(3.4, 3.5, 6.5, 3.05); ctx.moveTo(-0.1, 3.5); ctx.quadraticCurveTo(-3.4, 3.5, -6.6, 3.1); ctx.stroke();
      if (parked) { ctx.strokeStyle = snow; ctx.lineWidth = lw(0.1); ctx.beginPath(); ctx.moveTo(0.6, 3.6); ctx.quadraticCurveTo(3.4, 3.62, 6.3, 3.2); ctx.moveTo(-0.8, 3.6); ctx.quadraticCurveTo(-3.4, 3.62, -6.4, 3.24); ctx.stroke(); poly(ctx, [-2.6, 2.86, -1.2, 3.05, 0.4, 2.96, 0.9, 2.86], snow); }
    } else {
      ctx.fillStyle = 'rgba(20,24,30,' + (0.1 + 0.16 * spin).toFixed(2) + ')'; ctx.beginPath(); ctx.ellipse(-0.1, 3.5, 6.7, 0.2 + 0.1 * spin, 0, 0, TAU); ctx.fill();
      const ph = t * (3 + 30 * spin), bx = Math.cos(ph) * 6.7;
      ctx.strokeStyle = dk; ctx.lineWidth = lw(0.1); ctx.globalAlpha = 0.75 - 0.4 * spin; ctx.beginPath(); ctx.moveTo(-0.1 - bx, 3.5); ctx.lineTo(-0.1 + bx, 3.5); ctx.stroke(); ctx.globalAlpha = 1;
    }
    // tail rotor: a yellow ring while it turns
    const tx = -8.3, ty = 2.05;
    if (st.tail !== false) {
      if (spin < 0.06) { ctx.strokeStyle = S.tone('#e2b33c', P); ctx.lineWidth = lw(0.16); ctx.beginPath(); ctx.moveTo(tx - 0.25, ty - 0.95); ctx.lineTo(tx + 0.25, ty + 0.95); ctx.stroke(); }
      else {
        ctx.fillStyle = 'rgba(226,179,60,' + (0.16 + 0.12 * spin).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(tx, ty, 1.0, 0, TAU); ctx.fill();
        ctx.strokeStyle = S.tone('#e2b33c', P); ctx.lineWidth = lw(0.13); ctx.beginPath(); ctx.arc(tx, ty, 0.98, 0, TAU); ctx.stroke();
        const a = t * (5 + 44 * spin); ctx.strokeStyle = dk; ctx.lineWidth = lw(0.09); ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(tx - Math.cos(a) * 0.95, ty - Math.sin(a) * 0.95); ctx.lineTo(tx + Math.cos(a) * 0.95, ty + Math.sin(a) * 0.95); ctx.stroke(); ctx.globalAlpha = 1;
      }
      circ(ctx, tx, ty, 0.16, dk);
    } else {
      ctx.strokeStyle = dk; ctx.lineWidth = lw(0.12); ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + 0.5, ty - 0.55); ctx.moveTo(tx, ty); ctx.lineTo(tx - 0.2, ty + 0.4); ctx.stroke();
      ctx.fillStyle = 'rgba(30,32,38,0.55)'; for (let i = 0; i < 5; i++) { const u = (t * 0.9 + i / 5) % 1; ctx.globalAlpha = 0.6 * (1 - u); ctx.beginPath(); ctx.arc(tx - u * 1.5, ty + 0.3 + u * 3.2, 0.3 + u * 0.9, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1;
    }
    // lights
    if (!parked && (t * 1.1) % 1 < 0.16) { circ(ctx, -8.75, 3.2, 0.16, '#ff4a3d'); if (S.pal.dark > 0.3) { ctx.globalAlpha = 0.3; circ(ctx, -8.75, 3.2, 0.8, '#ff4a3d'); ctx.globalAlpha = 1; } }
    if (!parked && (t * 1.1 + 0.5) % 1 < 0.08) circ(ctx, 0.4, 0.42, 0.14, '#ffffff');
    ctx.restore();
  } };

// A helicopter that can fly: sit on the pad, lift, hover, leave, or come back
// down. Returns a handle:
//   H.veh(extra)    the vehicle definition for the mission's vehicle list
//   H.tail          the tail rotor object (id 'tail'): shoot it and the
//                   machine settles to the ground and emits 'down:<id>'
//   H.step(sim, dt) call this from the mission's tick()
// The vehicle's routine steers it with ['call', (sim, v) => { v.altTo = 8; v.climb = 2; }]
// (height above the pad and how fast to get there), v.spinTo (rotor speed
// 0 to 1) and the normal ['drive', x, speed] and ['wait', s] steps.
K.heli = function (S, P, x, o) {
  o = o || {};
  const y = o.y || 0, id = o.id || 'heli', dir = o.dir || 1, sp = o.spin === undefined ? 1 : o.spin;
  const tail = S.obj({ kind: 'tailrotor', id: o.tailId || 'tail', plane: P, x: x - dir * 8.3, y: y + 2.05, r: o.tailR || 0.95, mat: 'metal', breakable: true, layer: 2 });
  const H = { id, tail, x, padY: y, P };
  H.veh = (extra) => Object.assign({ id, kind: 'heli', plane: P, x, y, dir, col: o.col || '#262b33', scared: true, seats: [], routine: [], alt: 0, altTo: 0, climb: 2, spinTo: sp,
    st: { glass: [], flat: [], moving: false, spin: o.spin0 === undefined ? sp : o.spin0, tail: true, padY: y, stripe: o.stripe, tilt: 0 } }, extra || {});
  H.step = (sim, dt) => {
    const v = sim.byId[id];
    if (!v || v.gone) { tail.gone = true; return; }
    v.st.spin = approach(v.st.spin, v.spinTo, dt * 0.14);
    if (!tail.alive && v.st.tail) { v.st.tail = false; v.hitT = sim.t; v.altTo = 0; v.climb = 1.8; v.routine = []; v.pc = 0; v.goal = null; v.wait = 0; v.waitFor = null; v.v = 0; }
    v.alt = approach(v.alt, v.altTo, dt * v.climb);
    v.y = y + v.alt;
    // with no tail rotor it swings from side to side as it comes down
    v.st.tilt = !v.st.tail && v.alt > 0.02 ? Math.sin((sim.t - v.hitT) * 3.3) * Math.min(0.13, v.alt * 0.03) : 0;
    if (!v.st.tail && v.alt <= 0.01 && !v.downT) { v.downT = sim.t; v.spinTo = 0; sim.emit('down:' + id); }
    tail.x = v.x - v.dir * 8.3; tail.y = v.y + 2.05;
  };
  return H;
};

// ---- the location --------------------------------------------------------------
// Options: z (distance to the compound's main row), ridge (distance to the far
// rock ridge, default z + 420), focus ('compound' or 'ridge': which of the two
// the mission is about), time ('snow', 'dusk' or 'dawn'), weather ('snow' or
// 'clear'), eye ([x, y, z] of the main firing position: the near slopes and
// the squashed ground are laid out for it), near (false leaves out the closest
// slopes, for missions with a second position further forward), heli
// ('parked', 'live' or nothing), lamps (true lights the yard), fog, seed.
SCN.ridge = function (o) {
  o = o || {};
  const zc = o.z || 900, zr = o.ridge || zc + 420, time = o.time || 'snow', sd = o.seed || 6;
  const eye = o.eye || [0, Math.round(zc * 0.14), 0], E = eye[1], ez = eye[2] || 0, onRidge = o.focus === 'ridge';
  const S = makeScene({ time, weather: o.weather || 'snow', seed: sd, refZ: onRidge ? zr : zc, exits: [-120, 120], ambience: 'snow', groundMat: 'snow', fog: o.fog || 1,
    sun: o.sun || (time === 'dusk' ? [-58, 15] : time === 'dawn' ? [66, 19] : [52, 64]) });
  harrowLight(S, time);
  const d = (z) => z - ez, yAt = (z, mil) => E + (mil / 1000) * d(z), band = (z, zn) => (E * (z - zn)) / d(zn);
  const zA = zc - 170, zF = zc - 45, zB = zc + 45, zRr = zc + 110, zV = zc + 230;
  const lowMil = (-E / d(zA)) * 1000 - 24, k = d(zr) / d(zc), fs = E / d(zc);
  S.bounds = onRidge ? { x0: -78 * k, x1: 78 * k, y0: yAt(zr, lowMil + 14), y1: yAt(zr, 58) } : { x0: -94, x1: 94, y0: yAt(zc, lowMil), y1: yAt(zc, 60) };
  const H = { S, z: zc, zr, eye, E };
  const snowC = S.pal.ground;

  // far to near: two ranges of peaks, forested hills, the back wall, the sniper ridge
  // (the air is thinned for the peaks while they are built, or they would fade to nothing)
  const fogD = S.pal.fogD; S.pal.fogD = fogD * 3.2;
  K.mountains(S, zc + 9000, { seed: sd + 2, h: 1200, base: -500, col: '#8497b0', snowCol: '#ffffff', snowLine: 0.5, rough: 520, step: 1.5 });
  K.mountains(S, zc + 5200, { seed: sd + 5, h: 880, base: -400, col: '#6f829b', snowCol: '#fbfdff', snowLine: 0.5, rough: 380 });
  S.pal.fogD = fogD;
  K.hills(S, zr + 1150, { seed: sd + 8, h: 150, base: -70, col: lighten(snowC, 0.1), trees: 0.8, treeCol: '#40595a', rough: 300, step: 26, mat: 'snow' });
  K.crag(S, zr + 300, { seed: sd + 11, h: 190, col: '#586574', snow: 1.35, name: 'backwall', solid: false, depth: 90 });
  const PRg = H.PRg = K.crag(S, zr, { seed: sd + 4, h: 150, col: '#364050', name: 'ridge', depth: 80, shape: (x) => 1 + 0.34 * Math.exp(-(x * x) / 26000) });
  const hx = o.hides || [-31, 3, 33], hy = o.hideY || [60, 82, 69];
  H.hides = hx.map((x, i) => K.hide(S, PRg, x, Math.min(hy[i], PRg.heightAt(x) - 16)));
  H.ridgeTop = (x) => PRg.heightAt(x);
  K.hills(S, zr - 70, { seed: sd + 14, h: 24, base: -4, col: snowC, trees: 0.9, treeCol: '#2d4843', rough: 90, step: 9, mat: 'snow' });
  H.PV = K.hills(S, zV, { seed: sd + 17, h: 11, base: -3, col: snowC, trees: 0.28, treeCol: '#2f4a44', rough: 130, step: 13, mat: 'snow' });
  H.blasts = K.snowBlasts(S, H.PV, 1);   // the slopes behind the compound, where the snow crew sets its charges

  // rear row: a tower, the search radar, the radio mast
  const PRr = H.PRr = S.plane(zRr, 'rear');
  K.snow(S, PRr, { band: band(zRr, zB), seed: sd + 1 });
  H.towerR = K.watch(S, PRr, -12, 9, { id: 'towerR' });
  H.radar = K.radar(S, PRr, 24, { h: 8 });
  H.mast = K.mast(S, PRr, -58, 19);
  K.fence(S, PRr, -100, 100, 2.6, { kind: 'mesh', col: '#58626e', layer: 0 });
  [[-84, 13], [-76, 9], [78, 12], [88, 15], [96, 10]].forEach((q) => K.pine(S, PRr, q[0], q[1], { snow: true }));

  // back row: generator shed, two bunkers, the fuel tanks
  const PB = H.PB = S.plane(zB, 'back');
  K.snow(S, PB, { band: band(zB, zc), seed: sd + 2 });
  H.gen = K.genShed(S, PB, -30, { onHit: o.genHit });
  H.b1 = K.bunker(S, PB, -20, 24, 3.8, { id: 'b1', door: -9, text: '2', textX: 20 });
  H.b2 = K.bunker(S, PB, 12, 18, 3.4, { id: 'b2', slits: 2, text: '3', textX: 14.5 });
  // (the second tank is set where a round that misses the hovering helicopter's tail will not find it)
  H.tanks = [K.fuelTank(S, PB, 44, { id: 'tank1' }), K.fuelTank(S, PB, 55.5, { id: 'tank2' })];
  P_pipe(S, PB, 40, 60);

  // main row: two towers, the command bunker with its dish and flag, the pad
  const PM = H.PM = S.plane(zc, 'main');
  K.snow(S, PM, { band: band(zc, zF), seed: sd + 3 });
  K.snowTrack(S, PM, -2, -34, band(zc, zF), { w: 2.2 });
  H.towerW = K.watch(S, PM, -48, 8, { id: 'towerW' });
  H.towerE = K.watch(S, PM, 36, 8, { id: 'towerE' });
  H.cmd = K.bunker(S, PM, -8, 28, 4.6, { id: 'cmd', door: -2, text: 'HARROW 1', textX: 20 });
  H.door = -2;
  line2(S, PM, 14, H.cmd.roofY - 0.2, 14, H.cmd.roofY + 2.0);
  H.dish = K.thing(S, PM, 'dish', 14, H.cmd.roofY + 2.7, { id: 'dish', r: 0.85, onHit: o.dishHit, drawFn(ctx, env, S2, ob) {
    const live = ob.alive, c = S.tone(live ? '#e4e8ec' : '#4d5258', PM), c2 = S.tone(live ? '#aab3bc' : '#33373c', PM);
    ctx.save(); ctx.translate(ob.x, ob.y); ctx.rotate(live ? -0.45 : 0.95);
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, 0, 0.42, 0.9, 0, 0, TAU); ctx.fill(); ctx.fillStyle = c2; ctx.beginPath(); ctx.ellipse(0.08, 0, 0.26, 0.7, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = S.tone('#2a2e36', PM); ctx.lineWidth = Math.max(0.05, env.px * 0.7); ctx.beginPath(); ctx.moveTo(0.1, 0); ctx.lineTo(0.85, 0); ctx.stroke(); ctx.restore();
    if (live && Math.sin(env.t * 3) > 0) circ(ctx, ob.x, ob.y - 1.0, 0.1, '#52e07a');
  } });
  K.flag(S, PM, -15, 0, 10.5, '#c8372d', { col2: '#f1ede2' });
  H.pad = K.helipad(S, PM, 58, { squash: fs });
  H.sock = K.windsock(S, PM, 72, 6.5);
  H.lamps = [];
  if (o.lamps) [-39.5, 24, 46].forEach((lx, i) => H.lamps.push(K.lamp(S, PM, lx, 6.2, 'yard', { id: 'lamp' + (i + 1), reach: 16, r: 0.4 })));
  if (o.heli === 'parked') K.parked(S, PM, 'heli', 58, 1, '#262b33', { layer: 0 });
  else if (o.heli === 'live') H.heli = K.heli(S, PM, 58, { spin: o.heliSpin, spin0: o.heliSpin0 });

  // front row: the wire, the gate and gatehouse, a truck, road blocks, a lone pine
  const PF = H.PF = S.plane(zF, 'front');
  K.snow(S, PF, { band: band(zF, zA), seed: sd + 4 });
  K.snowTrack(S, PF, -62, -30, band(zF, zA), { w: 2.4 });
  K.fence(S, PF, -110, -66, 3, { kind: 'mesh', col: '#4a535e' }); K.fence(S, PF, -58, 110, 3, { kind: 'mesh', col: '#4a535e' });
  K.box(S, PF, -66.4, 0, 0.4, 3.6, '#39414b', { solid: false }); K.box(S, PF, -58, 0, 0.4, 3.6, '#39414b', { solid: false });
  H.gatehouse = K.bunker(S, PF, -77, 7, 3.0, { id: 'gate', slits: 1, col: '#7f868e' });
  if (o.truck !== false) K.parked(S, PF, 'truck', -36, 1, '#5b6770', { layer: 0 });
  H.blocks = [-13, -8.5, -4];
  H.blocks.forEach((bx) => K.block(S, PF, bx, { w: 4.2, h: 1.25, layer: 0 }));
  K.box(S, PF, 40, 0, 3.2, 1.6, '#6f6253', { mat: 'wood', band: 0.2 }); K.box(S, PF, 43.6, 0, 2.4, 1.2, '#7b6d5c', { mat: 'wood' });
  K.pine(S, PF, o.pineX === undefined ? 28.6 : o.pineX, 17, { snow: true, layer: 2 });
  [[-98, 11], [-90, 14], [84, 12], [97, 9]].forEach((q) => K.pine(S, PF, q[0], q[1], { snow: true }));

  // the approach: a checkpoint on the road in, and open snow
  const PA = H.PA = S.plane(zA, 'approach');
  K.snow(S, PA, { band: 30, seed: sd + 5 });
  K.snowTrack(S, PA, -28, -44, 30, { w: 2.8 });
  H.post = K.bunker(S, PA, -24, 6, 2.9, { id: 'post', slits: 1, col: '#82898f' });
  K.box(S, PA, -31.6, 0, 0.3, 1.2, '#39414b', { solid: false });
  PA.add({ x0: -33, x1: -24, layer: 2, draw(ctx, env) { for (let i = 0; i < 6; i++) R4(ctx, -31.5 + i * 1.2, 1.0, 1.2, 0.2, S.tone(i % 2 ? '#f1ede2' : '#c8372d', PA)); } });
  K.billboard(S, PA, -46, 1.6, 5.4, 2.4, 'HARROW RIDGE|NO ENTRY', { col: '#e9dcc0', textCol: '#8a2a22' });
  [[-74, 12], [-66, 8], [-58, 14], [22, 10], [31, 15], [38, 9], [62, 13], [74, 10], [86, 15]].forEach((q) => K.pine(S, PA, q[0], q[1], { snow: true, layer: q[1] > 12 ? 2 : 0 }));

  // the shooter's own side of the valley. These nearer slopes are what slide
  // past as the scope pans.
  const zK = ez + d(zc) * 0.5;
  K.hills(S, zK, { seed: sd + 31, h: 16, base: yAt(zK, lowMil + 9) - 31, col: snowC, trees: 0.55, treeCol: '#29423d', rough: 70, step: 11, mat: 'snow' });
  if (o.near !== false) {
    const zS = ez + 170, PS = S.plane(zS, 'spur'), sy = yAt(zS, lowMil - 13), rockC = S.tone('#59636f', PS), rockD = S.tone('#3f4852', PS), snowS = S.tone(snowC, PS);
    PS.add({ x0: -200, x1: 200, layer: 0, draw(ctx, env) {
      ctx.fillStyle = snowS; ctx.beginPath(); ctx.moveTo(-200, sy - 60);
      for (let x = -200; x <= 200; x += 4) ctx.lineTo(x, sy + 1.6 * vnoise(x / 9, sd) + 0.7 * vnoise(x / 2.3, sd + 3) + Math.max(0, Math.abs(x) - 12) * 0.12);
      ctx.lineTo(200, sy - 60); ctx.closePath(); ctx.fill();
      [[-11.5, 1.4, 2.2], [9.8, 1.1, 1.7], [14.4, 1.9, 2.6], [-17, 2.2, 3]].forEach((q) => {
        const bx = q[0], by = sy + Math.abs(bx) * 0.1 - 0.3, h = q[1], w = q[2];
        poly(ctx, [bx - w, by, bx - w * 0.55, by + h * 0.8, bx - w * 0.1, by + h, bx + w * 0.5, by + h * 0.75, bx + w, by], rockC);
        poly(ctx, [bx - w * 0.1, by + h, bx + w * 0.5, by + h * 0.75, bx + w, by, bx + w * 0.2, by], rockD);
        poly(ctx, [bx - w * 0.62, by + h * 0.72, bx - w * 0.1, by + h + 0.12, bx + w * 0.55, by + h * 0.72, bx + w * 0.2, by + h * 0.6, bx - w * 0.3, by + h * 0.55], snowS);
      });
    } });
    [[-15.5, 9.5], [-19.5, 12], [16.5, 11], [20.5, 8]].forEach((q) => K.pine(S, PS, q[0], q[1], { snow: true, y: sy + Math.abs(q[0]) * 0.1 - 0.5, solid: false }));
    const zL = ez + 46, PL = S.plane(zL, 'lip'), ly = yAt(zL, lowMil - 30), lipC = S.tone(lighten(snowC, 0.3), PL), grass = S.tone('#8a8468', PL);
    PL.add({ x0: -60, x1: 60, layer: 0, draw(ctx, env) {
      ctx.fillStyle = lipC; ctx.beginPath(); ctx.moveTo(-60, ly - 30);
      for (let x = -60; x <= 60; x += 1) ctx.lineTo(x, ly + 0.35 * vnoise(x / 2.1, sd + 5) + 0.15 * vnoise(x / 0.6, sd + 7));
      ctx.lineTo(60, ly - 30); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = grass; ctx.lineWidth = Math.max(0.012, env.px * 0.8); ctx.beginPath();
      for (let i = 0; i < 26; i++) { const gx = -9 + i * 0.71 + Math.sin(i * 7.3) * 0.3, gy = ly + 0.35 * vnoise(gx / 2.1, sd + 5); for (let b = -1; b <= 1; b++) { ctx.moveTo(gx, gy - 0.02); ctx.lineTo(gx + b * 0.07 + env.wind * 0.012, gy + 0.2 + (i % 3) * 0.06); } }
      ctx.stroke();
    } });
  }

  // placements
  const spot = (P, zone) => (x, extra) => Object.assign({ plane: P, x, y: 0, zone, room: null, behind: false }, extra || {});
  H.yard = spot(PM, 'yard'); H.back = spot(PB, 'back'); H.rear = spot(PRr, 'rear'); H.front = spot(PF, 'front'); H.road = spot(PA, 'road');
  H.onPad = (x, extra) => Object.assign({ plane: PM, x, y: 0, zone: 'pad', room: null, behind: false }, extra || {});
  H.milOf = (z, y) => ((y - E) / d(z)) * 1000;
  return H;
};

// small dressing used above: a pipe run on trestles, and a plain post
function P_pipe(S, P, x0, x1) {
  const c = S.tone('#6e7780', P), d = S.tone('#2a2e36', P);
  P.add({ x0, x1, layer: 0, draw(ctx, env) { R4(ctx, x0, 3.55, x1 - x0, 0.22, c); for (let x = x0; x <= x1; x += 4) line(ctx, x, 0, x, 3.6, d, 0.1, env); } });
}
function line2(S, P, xa, ya, xb, yb) { const c = S.tone('#2a2e36', P); P.add({ x0: Math.min(xa, xb) - 1, x1: Math.max(xa, xb) + 1, layer: 0, draw(ctx, env) { line(ctx, xa, ya, xb, yb, c, 0.12, env); } }); }
