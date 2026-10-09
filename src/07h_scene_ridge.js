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
//
// Wind matters more here than anywhere else in the game, so a lot of what is
// drawn moves with env.wind: the windsock, loose snow streaming over the
// ground, banners of snow off the crests, smoke and steam, pennants on the
// towers, the cups on top of the mast. They all lean the way it blows and
// work harder as it rises.
// ---------------------------------------------------------------------------

// Cold light for the three times of day this place is seen in.
function harrowLight(S, time) {
  const p = S.pal;
  if (time === 'dusk') Object.assign(p, { skyTop: '#2b2d5e', skyBot: '#f2a273', fog: '#c29aa0', fogD: 3000, amb: '#3b3562', ambT: 0.34, ground: '#f1eaf1', road: '#bcb3c6', cloud: '#eaa98f', sun: '#ffd09a', rim: 'rgba(255,236,222,0.6)' });
  else if (time === 'dawn') Object.assign(p, { skyTop: '#47609a', skyBot: '#f8d2b4', fog: '#e6d2c8', fogD: 3000, amb: '#8a7f9c', ambT: 0.2, ground: '#f4eff2', road: '#c5c0cd', cloud: '#fbdcc8', sun: '#ffe9c4', rim: 'rgba(255,246,236,0.62)' });
  else Object.assign(p, { skyTop: '#7f9bb8', skyBot: '#e4ecf3', fog: '#dfe7ee', fogD: 3200, amb: '#d3dde8', ambT: 0.1, ground: '#fafcfe', road: '#c9d2dc' });
}

// ---- helpers used all through this file -----------------------------------------
// A fixed "random" number from 0 to 1 for the whole number n. Used for variety at
// draw time, where a seeded stream would be in the wrong place.
function rgHash(n) { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }
// First place in a list (sorted by each entry's first number) that is not left of x.
function rgFrom(list, x) { let a = 0, b = list.length; while (a < b) { const m = (a + b) >> 1; if (list[m][0] < x) a = m + 1; else b = m; } return a; }
// Adds a pointed lens shape to the current path: l is half its length, up and dn
// how far it bulges above and below its middle line.
function rgLens(ctx, x, y, l, up, dn, skew) { ctx.moveTo(x - l, y); ctx.quadraticCurveTo(x + skew, y + up * 2, x + l, y); ctx.quadraticCurveTo(x + skew, y - dn * 2, x - l, y); }

// Where the light comes from. The sun hangs over the far side of the valley, so
// shadows fall toward the shooter (down the glass) and away from the sun's side.
// They are long when the sun is low.
function rgSun(S) {
  if (!S.rgSun) { const low = S.sky.sun[1] < 30; S.rgSun = { side: S.sky.sun[0] >= 0 ? -1 : 1, kx: low ? 0.8 : 0.3, ky: low ? 0.32 : 0.23, low }; }
  return S.rgSun;
}
// Adds the shadow that an outline throws on the snow to the current path.
// pts is x, height above the ground, x, height and so on; y0 is the ground.
function rgCast(ctx, L, y0, pts) {
  for (let i = 0; i < pts.length; i += 2) { const X = pts[i] + L.side * L.kx * pts[i + 1], Y = y0 - 0.05 - L.ky * pts[i + 1]; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }
  ctx.closePath();
}
// How bright the station's own lights burn: nothing by day, full at dusk, and when
// the generator dies they stutter and fade over half a second instead of snapping off.
function rgPower(S, env) {
  if (S.pal.dark <= 0.3) return 0;
  if (S.power !== false) { S.rgOffT = undefined; return 1; }
  if (S.rgOffT === undefined || env.t < S.rgOffT) S.rgOffT = env.t;
  const u = (env.t - S.rgOffT) / 0.55;
  return u >= 1 ? 0 : (1 - u) * (Math.sin(u * 40) > -0.4 ? 1 : 0.35);
}
// A soft round glow that fades smoothly to nothing. rgb is 'r,g,b'. ky squashes
// it, for a pool of light lying on the ground.
function rgGlow(ctx, x, y, r, rgb, a, ky) {
  if (a < 0.01) return;
  const flat = ky !== undefined && ky !== 1;
  if (flat) { ctx.save(); ctx.translate(x, y); ctx.scale(1, ky); x = 0; y = 0; }
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, 'rgba(' + rgb + ',' + a.toFixed(3) + ')'); g.addColorStop(0.4, 'rgba(' + rgb + ',' + (a * 0.42).toFixed(3) + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
  if (flat) ctx.restore();
}
// Smoke or steam rising from a point and bending away with the wind: the harder
// it blows, the flatter the plume lies. o: n puffs, rise (metres), speed, r0 and
// r1 (puff size at the start and end), a (strength), col, lean, ph.
function rgSmoke(ctx, env, x, y, o) {
  const n = o.n || 6, rise = o.rise || 4, w = env.wind, flat = Math.min(1, Math.abs(w) / 9), r0 = o.r0 || 0.2, r1 = o.r1 || 1.1, a0 = o.a || 0.5;
  ctx.fillStyle = o.col;
  for (let i = 0; i < n; i++) {
    const u = (((env.t * (o.speed || 0.4) + i / n + (o.ph || 0)) % 1) + 1) % 1;
    ctx.globalAlpha = a0 * (1 - u) * Math.min(1, u * 7);
    ctx.beginPath(); ctx.arc(x + w * u * u * rise * (o.lean || 0.5) + Math.sin(i * 2.4 + env.t * 0.8) * 0.1 * u * rise * 0.3, y + rise * u * (1 - 0.45 * flat * u), r0 + (r1 - r0) * u, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// Loose snow torn off a roof edge at (x, y) once the wind gets up: little streamers
// that fly out downwind, sink and thin away. It is the plainest tell of a strong
// wind on a roof, and it says nothing at all in a calm. k scales it, ph staggers
// one roof from the next, sh is the blue-grey drawn under the white so it shows on snow.
function rgSpill(ctx, env, x, y, k, ph, sh) {
  const a = Math.min(1, Math.abs(env.wind) / 8); if (a < 0.2) return;
  const q = Math.min(1, (a - 0.2) * 1.6), dir = env.wind < 0 ? -1 : 1;
  for (let pass = 0; pass < 2; pass++) {
    ctx.fillStyle = pass ? '#ffffff' : sh;
    for (let i = 0; i < 3; i++) {
      const u = (env.t * (0.5 + 0.6 * a) + i / 3 + ph * 0.071) % 1, ln = ((0.8 + 3.4 * a) * u + 0.4) * k;
      ctx.globalAlpha = (pass ? 0.8 : 0.55) * q * (1 - u) * Math.min(1, u * 6); ctx.beginPath();
      rgLens(ctx, x + dir * (ln * 0.5 + 0.2 * k), y - u * 0.5 * k - (pass ? 0 : 0.05 * k), ln * 0.5 + 0.15 * k, (0.05 + 0.08 * u) * k, (0.04 + 0.06 * u) * k, 0); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
// Icicles hanging from an edge between xa and xb at height y. Adds them to the
// current path; len is the longest one. The same edge always gets the same icicles.
function rgIcicles(ctx, env, xa, xb, y, len, gap, seed) {
  const a = Math.max(xa, env.x0 - 1), b = Math.min(xb, env.x1 + 1); if (b <= a) return;
  for (let k = Math.ceil((a - xa) / gap); xa + k * gap < b; k++) {
    const h = rgHash(k * 7.3 + seed), xx = xa + k * gap + (h - 0.5) * gap * 0.5; if (h < 0.22) continue;
    const l = len * (0.25 + 0.75 * rgHash(k * 3.1 + seed + 5) * (h > 0.86 ? 1 : 0.6)), wd = Math.max(0.035, l * 0.16);
    ctx.moveTo(xx - wd, y); ctx.lineTo(xx + wd, y); ctx.lineTo(xx + wd * 0.2, y - l); ctx.closePath();
  }
}
// A small warning plate with a picture and no words. kind: 'stop' (red disc with
// a white bar), 'volt' (yellow triangle and a bolt), 'fire' (orange diamond and a
// flame), 'wave' (yellow triangle with rings: the radar), 'ear' (blue disc).
function rgSign(ctx, env, S, P, x, y, r, kind) {
  if (r < env.px * 1.6) return;
  const ink = S.tone('#15181d', P), white = S.tone('#f4f1ea', P);
  if (kind === 'stop') { circ(ctx, x, y, r, S.tone('#c8372d', P)); R4(ctx, x - r * 0.62, y - r * 0.17, r * 1.24, r * 0.34, white); return; }
  if (kind === 'ear') { circ(ctx, x, y, r, S.tone('#2f6fb0', P)); circ(ctx, x, y, r * 0.45, white); circ(ctx, x, y, r * 0.2, S.tone('#2f6fb0', P)); return; }
  if (kind === 'fire') {
    poly(ctx, [x, y + r * 1.15, x + r * 1.15, y, x, y - r * 1.15, x - r * 1.15, y], white); poly(ctx, [x, y + r, x + r, y, x, y - r, x - r, y], S.tone('#e2572b', P));
    if (r > env.px * 3.5) poly(ctx, [x, y + r * 0.62, x + r * 0.34, y + r * 0.02, x + r * 0.26, y - r * 0.4, x, y - r * 0.56, x - r * 0.28, y - r * 0.38, x - r * 0.36, y, x - r * 0.1, y + r * 0.22], white);
    return;
  }
  poly(ctx, [x, y + r * 1.2, x + r * 1.18, y - r * 0.85, x - r * 1.18, y - r * 0.85], ink); poly(ctx, [x, y + r * 0.88, x + r * 0.88, y - r * 0.68, x - r * 0.88, y - r * 0.68], S.tone('#e9c23a', P));
  if (r < env.px * 3.5) return;
  if (kind === 'volt') poly(ctx, [x + r * 0.14, y + r * 0.5, x - r * 0.26, y - r * 0.12, x + r * 0.02, y - r * 0.12, x - r * 0.14, y - r * 0.58, x + r * 0.28, y + r * 0.02, x, y + r * 0.02], ink);
  else { ctx.strokeStyle = ink; ctx.lineWidth = Math.max(r * 0.12, env.px * 0.7); ctx.beginPath(); ctx.arc(x, y - r * 0.5, r * 0.34, 0.5, Math.PI - 0.5); ctx.moveTo(x + r * 0.62 * Math.cos(0.6), y - r * 0.5 + r * 0.62 * Math.sin(0.6)); ctx.arc(x, y - r * 0.5, r * 0.62, 0.6, Math.PI - 0.6); ctx.stroke(); circ(ctx, x, y - r * 0.5, r * 0.11, ink); }
}

// The standard duck is four pixels wide at a kilometre. This one is drawn
// big enough to find at the ranges in this chapter (use it as a drawFn).
// It keeps a thin dark outline so that it shows on a snowy roof.
K.bigDuck = function (ctx, env, S, ob) {
  if (!ob.alive) return;
  const x = ob.x, y = ob.y - 0.12, k = 2.2, bob = env.s > 7 ? Math.sin(env.t * 1.3 + x) * 0.012 * k : 0;
  if (env.s > 4) { const e = Math.max(0.035 * k, env.px * 0.9); ctx.fillStyle = '#7a5a12'; ctx.beginPath(); ctx.arc(x, y, 0.2 * k + e, 0, TAU); ctx.arc(x + 0.14 * k, y + 0.2 * k + bob, 0.13 * k + e, 0, TAU); ctx.fill(); }
  circ(ctx, x, y, 0.2 * k, '#f7d038'); circ(ctx, x + 0.14 * k, y + 0.2 * k + bob, 0.13 * k, '#f7d038');
  poly(ctx, [x + 0.24 * k, y + 0.22 * k + bob, x + 0.4 * k, y + 0.17 * k + bob, x + 0.24 * k, y + 0.13 * k + bob], '#f08a24'); circ(ctx, x + 0.17 * k, y + 0.24 * k + bob, 0.03 * k, '#1b1b1b');
  if (env.s > 9) { poly(ctx, [x - 0.02 * k, y + 0.04 * k, x - 0.16 * k, y - 0.03 * k, x - 0.02 * k, y - 0.09 * k, x + 0.08 * k, y - 0.03 * k], '#e3b521'); poly(ctx, [x - 0.2 * k, y + 0.02 * k, x - 0.29 * k, y + 0.12 * k, x - 0.14 * k, y + 0.1 * k], '#f7d038'); circ(ctx, x + 0.09 * k, y + 0.26 * k + bob, 0.035 * k, '#fff3b0'); }
};

// ---- snow and rock ----------------------------------------------------------
// Snow-covered ground for one plane. `band` is how tall the visible strip of
// ground is (metres on this plane) before the next nearer row covers it.
// Seen from above and squashed flat: long drifts with a blue hollow on the side
// away from the sun, short wind-cut ridges (sastrugi), patches the wind has
// polished, a little glitter, and loose snow snaking along with the wind.
K.snow = function (S, P, o) {
  o = o || {};
  const y = o.y || 0, base = o.col || S.pal.ground, band = o.band || 7, sd = (o.seed || 1) * 131 + Math.round(P.z);
  K.ground(S, P, { y, col: base, noEdge: true, mat: 'snow' });
  const x0 = o.x0 === undefined ? -330 : o.x0, x1 = o.x1 === undefined ? 330 : o.x1, L = rgSun(S);
  const hollow = S.tone(mix(base, '#6f86a8', 0.3), P), hollow2 = S.tone(mix(base, '#6f86a8', 0.2), P), crest = S.tone(lighten(base, 0.9), P), glaze = S.tone(mix(base, '#8fb4d6', 0.16), P);
  const spark = S.pal.dark > 0.1 ? '#fff0d2' : '#ffffff', shade = S.tone('#7d93ae', P);
  const D = makeRng(sd * 7 + 3), dr = [], sg = [], gl = [], rows = [], thick = clamp(7 / band, 0.3, 1), rise = 0.2 + band * 0.022;
  for (let x = x0; x < x1; x += D.r(3, 7.5)) { const f = D.f(); dr.push([x, D.r(3.5, 10) * (0.8 + 0.5 * f), f, D.r(0.5, 1.4), D.r(-2, 2), D.f()]); }
  for (let x = x0; x < x1; x += D.r(2.2, 5.5) * thick) sg.push([x, D.f(), D.i(3, 6), D.r(1.1, 3.0), D.r(0.35, 0.8), D.f()]);
  for (let x = x0; x < x1; x += D.r(22, 50)) gl.push([x, D.r(0.12, 0.9), D.r(9, 24), D.r(0.5, 1.2)]);
  // long wind rows: the grain the whole surface takes from the prevailing wind
  const nRow = clamp(Math.round(band / 1.0), 5, 16);
  for (let r = 0; r < nRow; r++) for (let x = x0 + D.r(0, 20); x < x1; ) { const l = D.r(7, 30); rows.push([x, x + l, y - ((r + 0.3 + 0.6 * D.f()) / nRow) * band, D.r(-0.5, 0.5) * (band / nRow) * 0.5]); x += l + D.r(4, 16); }
  rows.sort((p, q) => p[0] - q[0]);
  P.add({ x0, x1, layer: 0, draw(ctx, env) {
    if (env.y0 > y + 1 || env.y1 < y - band - 2) return;   // the strip is off the glass
    const s = env.s, a = env.x0, b = env.x1, lw = Math.max(0.045, env.px * 0.85), minH = env.px * 0.75;
    // patches the wind has scoured down to a hard blue crust
    ctx.fillStyle = glaze; ctx.beginPath();
    for (let i = rgFrom(gl, a - 30); i < gl.length && gl[i][0] < b + 30; i++) { const q = gl[i]; rgLens(ctx, q[0], y - 0.3 - q[1] * band * 0.9, q[2], rise * 1.3 * q[3], rise * 1.1 * q[3], q[2] * 0.2); }
    ctx.fill();
    if (s > 3) {
      ctx.strokeStyle = hollow2; ctx.globalAlpha = 0.75; ctx.lineWidth = lw; ctx.beginPath();
      for (let i = rgFrom(rows, a - 32); i < rows.length && rows[i][0] < b; i++) { const q = rows[i]; ctx.moveTo(q[0], q[2]); ctx.quadraticCurveTo((q[0] + q[1]) / 2, q[2] + q[3], q[1], q[2] + q[3] * 0.3); }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    // drifts: a blue hollow on the side away from the sun, a bright crest above it
    const i0 = rgFrom(dr, a - 16);
    ctx.fillStyle = hollow; ctx.beginPath();
    for (let i = i0; i < dr.length && dr[i][0] < b + 16; i++) { const q = dr[i], hh = Math.max(minH, rise * q[3]); rgLens(ctx, q[0], y - 0.3 - q[2] * band * 0.93, q[1], hh * 0.12, hh, q[4] + L.side * q[1] * 0.25); }
    ctx.fill();
    ctx.fillStyle = crest; ctx.beginPath();
    for (let i = i0; i < dr.length && dr[i][0] < b + 16; i++) { const q = dr[i], hh = Math.max(minH, rise * q[3]); rgLens(ctx, q[0] - L.side * q[1] * 0.06, y - 0.3 - q[2] * band * 0.93 + hh * 0.2, q[1] * 0.84, hh * 0.62, hh * 0.08, q[4]); }
    ctx.fill();
    if (s < 4.5) return;
    // sastrugi: short hard ridges the wind has cut, in staggered rows
    const every = s < 10 ? 2 : 1, dy = 0.09 + band * 0.007, j0 = rgFrom(sg, a - 6);
    ctx.strokeStyle = hollow; ctx.lineWidth = lw; ctx.beginPath();
    for (let i = j0; i < sg.length && sg[i][0] < b + 6; i++) {
      if (i % every) continue;
      const q = sg[i], gy = y - 0.25 - q[1] * band * 0.95;
      for (let k = 0; k < q[2]; k++) { const xx = q[0] + k * q[4] * (k % 2 ? 1 : -0.6), yy = gy - k * dy, l = q[3] * (0.6 + 0.4 * rgHash(i + k * 5.3)); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + l * 0.5, yy + dy * 0.6, xx + l, yy - dy * 0.15); }
    }
    ctx.stroke();
    if (s < 10) return;
    ctx.strokeStyle = crest; ctx.beginPath();
    for (let i = j0; i < sg.length && sg[i][0] < b + 6; i++) {
      const q = sg[i], gy = y - 0.25 - q[1] * band * 0.95 + lw * 1.1;
      for (let k = 0; k < q[2]; k += 2) { const xx = q[0] + k * q[4] * (k % 2 ? 1 : -0.6), yy = gy - k * dy, l = q[3] * (0.6 + 0.4 * rgHash(i + k * 5.3)); ctx.moveTo(xx + l * 0.1, yy); ctx.quadraticCurveTo(xx + l * 0.5, yy + dy * 0.6, xx + l * 0.9, yy - dy * 0.1); }
    }
    ctx.stroke();
    // glitter: a few crystals catch the light, each for a moment
    const sz = Math.max(0.035, env.px * 1.3), tick = env.t * 1.4;
    ctx.fillStyle = spark; ctx.beginPath();
    for (let i = i0; i < dr.length && dr[i][0] < b + 16; i++) {
      const q = dr[i], hh = Math.max(minH, rise * q[3]), yy = y - 0.3 - q[2] * band * 0.93;
      for (let k = 0; k < 3; k++) { if (rgHash(i * 3.1 + k * 17 + Math.floor(tick + q[5] * 9 + k * 0.37)) < 0.7) continue; const xx = q[0] + (rgHash(i + k * 2.7) - 0.5) * q[1] * 1.3; ctx.rect(xx, yy - hh * (0.25 + 0.5 * rgHash(i * 1.3 + k)), sz, sz); }
    }
    ctx.fill();
  } });
  // spindrift: loose snow snaking along the ground with the wind, at the wind's own
  // speed. Each streamer has a blue-grey underside so that it shows on white.
  if (o.drift !== false) P.add({ x0, x1, layer: 2, draw(ctx, env) {
    if (env.y0 > y + 2 || env.y1 < y - band - 2) return;
    const w = env.wind, a = Math.min(1, Math.abs(w) / 7); if (a < 0.08) return;
    const dir = w >= 0 ? 1 : -1, span = 46, first = Math.floor(env.x0 / span) - 1, last = Math.ceil(env.x1 / span), n = 3 + Math.round(4 * a);
    for (let pass = 0; pass < 4; pass++) {   // faint then strong, underside then top
      const strong = pass > 1, top = pass % 2 === 1;
      ctx.fillStyle = top ? '#ffffff' : shade; ctx.globalAlpha = (top ? 0.5 : 0.3) * (strong ? 0.45 + 0.55 * a : 0.3 + 0.2 * a);
      ctx.beginPath();
      for (let i = first; i <= last; i++) for (let j = 0; j < n; j++) {
        const ph = rgHash(i * 7.13 + j * 3.7 + sd), u = (((env.t * w * 0.9 + ph * span * 7) % span) + span) % span, fade = Math.sin((u / span) * Math.PI);
        if ((fade > 0.6) !== strong) continue;
        const dp = rgHash(i * 1.7 + j * 9.1 + sd * 0.3), len = (4 + 11 * a) * (0.6 + 0.8 * ph) * (0.5 + 0.5 * fade), th = (0.05 + 0.09 * dp) * (0.7 + 0.6 * a) + band * 0.004;
        const xh = i * span + u, yy = (j === 0 ? y + 0.08 + 0.3 * dp : y - 0.2 - dp * band * 0.92) + Math.sin(env.t * 2.1 + ph * 20) * th * 0.6 - (top ? 0 : th * 1.3);
        ctx.moveTo(xh - dir * len, yy); ctx.quadraticCurveTo(xh - dir * len * 0.35, yy + th * 2.6, xh, yy + th * 0.4); ctx.quadraticCurveTo(xh - dir * len * 0.3, yy - th * 1.2, xh - dir * len, yy);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } });
};

// Packed-snow track squashed into a plane's ground strip: from xTop on the
// ground line down to xBot at the bottom of the strip. Two ruts with a lit
// edge and a shaded edge, a ploughed bank down each side, tread marks up
// close, and marker stakes so a driver can find it after a storm.
K.snowTrack = function (S, P, xTop, xBot, band, o) {
  o = o || {}; const w = o.w || 2.6, y = o.y || 0, hex = o.col || S.pal.road, L = rgSun(S);
  const bed = S.tone(hex, P), rut = S.tone(darken(mix(hex, '#5f7694', 0.3), 0.14), P), lit = S.tone(lighten(S.pal.ground, 0.8), P), bank = S.tone(mix(S.pal.ground, '#6f86a8', 0.3), P), stake = S.tone('#e8672c', P), ink = S.tone('#20242b', P);
  const N = 10, cx = [], bend = (xBot - xTop) * 0.16;
  for (let i = 0; i <= N; i++) { const f = i / N; cx.push([lerp(xTop, xBot, f) + Math.sin(f * Math.PI) * bend, y - f * band, w * (1 + 0.14 * f)]); }
  const side = (ctx, k, back) => { for (let i = 0; i <= N; i++) { const q = cx[back ? N - i : i]; if (i || back) ctx.lineTo(q[0] + q[2] * k, q[1]); else ctx.moveTo(q[0] + q[2] * k, q[1]); } };
  P.add({ x0: Math.min(xTop, xBot) - w - 3, x1: Math.max(xTop, xBot) + w + 3, layer: 0, draw(ctx, env) {
    if (env.y0 > y + 2 || env.y1 < y - band - 1) return;
    // the banks the plough leaves: shaded on one side of the road, lit on the other
    ctx.fillStyle = bank; ctx.beginPath(); side(ctx, L.side * 1.0, false); side(ctx, L.side * 1.3, true); ctx.closePath(); ctx.fill();
    ctx.fillStyle = lit; ctx.beginPath(); side(ctx, -L.side * 1.0, false); side(ctx, -L.side * 1.22, true); ctx.closePath(); ctx.fill();
    ctx.fillStyle = bed; ctx.beginPath(); side(ctx, -1, false); side(ctx, 1, true); ctx.closePath(); ctx.fill();
    const lw = Math.max(0.16, env.px * 0.9);
    for (let pass = 0; pass < 2; pass++) {   // each rut: a dark floor, and a bright lip on the side the light reaches
      ctx.strokeStyle = pass ? lit : rut; ctx.lineWidth = pass ? lw * 0.45 : lw; ctx.beginPath();
      for (let k = -1; k <= 1; k += 2) for (let i = 0; i <= N; i++) { const q = cx[i], xx = q[0] + q[2] * 0.55 * k + (pass ? -L.side * lw * 0.75 : 0); if (i) ctx.lineTo(xx, q[1]); else ctx.moveTo(xx, q[1]); }
      ctx.stroke();
    }
    if (env.s > 12) {   // tread marks across the ruts
      ctx.strokeStyle = bed; ctx.lineWidth = Math.max(0.03, env.px * 0.6); ctx.beginPath();
      const gap = Math.max(0.16, env.px * 3.5), f0 = clamp((y - env.y1) / band, 0, 1), f1 = clamp((y - env.y0) / band, 0, 1);
      for (let f = Math.ceil((f0 * band) / gap) * gap; f < f1 * band; f += gap) {
        const u = f / band, i = Math.min(N - 1, Math.floor(u * N)), t = u * N - i, xc = lerp(cx[i][0], cx[i + 1][0], t), ww = lerp(cx[i][2], cx[i + 1][2], t);
        for (let k = -1; k <= 1; k += 2) { ctx.moveTo(xc + ww * 0.55 * k - lw * 0.5, y - f); ctx.lineTo(xc + ww * 0.55 * k + lw * 0.5, y - f); }
      }
      ctx.stroke();
    }
    if (o.stakes === false || env.s < 3) return;
    // marker stakes: orange, with a dark band and a pale reflector
    const sh = 1.5, slw = Math.max(0.07, env.px * 0.9);
    for (let j = 0; j < 3; j++) {
      const q = cx[[3, 6, 9][j]];
      for (let k = -1; k <= 1; k += 2) {
        const px = q[0] + (q[2] * 1.3 + 0.5) * k, py = q[1];
        line(ctx, px, py, px + L.side * L.kx * sh, py - L.ky * sh, bank, slw, env);
        line(ctx, px, py, px, py + sh, stake, slw, env);
        if (env.s > 7) { line(ctx, px, py + sh * 0.72, px, py + sh * 0.86, ink, slw, env); line(ctx, px, py + sh * 0.86, px, py + sh, lit, slw, env); }
      }
    }
  } });
};

// Footprints: a beaten trail across a plane's ground strip. pts is x, depth
// (0 at the ground line, 1 at the bottom of the strip), x, depth and so on.
// From far off it is a faint line; close up you can count the steps.
function rgTrail(S, P, pts, band, o) {
  o = o || {}; const y = o.y || 0, L = rgSun(S), dark = S.tone(mix(S.pal.ground, '#5f7694', 0.42), P), lit = S.tone(lighten(S.pal.ground, 0.85), P), steps = [];
  let xa = 1e9, xb = -1e9;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const ax = pts[i], ay = y - pts[i + 1] * band, bx = pts[i + 2], by = y - pts[i + 3] * band, len = Math.hypot(bx - ax, (by - ay) * 5), n = Math.max(1, Math.round(len / 0.75));
    for (let k = 0; k < n; k++) { const t = k / n, sdn = (steps.length % 2 ? 1 : -1) * 0.14; steps.push([lerp(ax, bx, t) + sdn, lerp(ay, by, t) + sdn * 0.12]); }
    xa = Math.min(xa, ax, bx); xb = Math.max(xb, ax, bx);
  }
  P.add({ x0: xa - 1, x1: xb + 1, layer: 0, draw(ctx, env) {
    if (env.s < 3.5 || env.y0 > y + 1 || env.y1 < y - band - 1) return;
    if (env.s < 11) {   // far off: one soft line
      ctx.strokeStyle = dark; ctx.globalAlpha = 0.5; ctx.lineWidth = Math.max(0.1, env.px * 0.9); ctx.beginPath();
      for (let i = 0; i + 1 < pts.length; i += 2) { if (i) ctx.lineTo(pts[i], y - pts[i + 1] * band); else ctx.moveTo(pts[i], y - pts[i + 1] * band); }
      ctx.stroke(); ctx.globalAlpha = 1; return;
    }
    const rw = 0.13, rh = Math.max(0.035, env.px * 1.1);
    ctx.fillStyle = dark; ctx.beginPath();
    for (let i = 0; i < steps.length; i++) { const q = steps[i]; if (q[0] < env.x0 - 1 || q[0] > env.x1 + 1) continue; ctx.rect(q[0] - rw, q[1] - rh, rw * 2, rh * 2); }
    ctx.fill();
    if (env.s < 18) return;
    ctx.fillStyle = lit; ctx.beginPath();   // the far lip of each print catches the light
    for (let i = 0; i < steps.length; i++) { const q = steps[i]; if (q[0] < env.x0 - 1 || q[0] > env.x1 + 1) continue; ctx.rect(q[0] - rw - L.side * 0.05, q[1] + rh, rw * 2, rh * 0.7); }
    ctx.fill();
  } });
}

// A wall of rock with snow along its crest, on ledges and in the gullies.
// Returns its plane, with heightAt(x). Bullets stop on it.
// The face is cut into slanting slabs. Each slab has its own bedding lines
// (strata), a lit or shaded facet, cracks, and patches of snow where it is not
// too steep. Gullies hold snow with a streak of blue ice down the middle.
// Along the top the snow builds a cornice on the side the wind blows toward,
// and a banner of loose snow streams off every peak.
// Other pieces (the hides) can ask for a patch of plain dark rock by adding
// [x0, x1, y0, y1] to P.rgKeep: no snow is drawn there.
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
  const lite = S.tone(lighten(hex, 0.45), P), ice = S.tone('#b5d2ea', P), shade = S.tone('#7d93ae', P);
  const R = makeRng(sd * 53 + 7), cap = [], ledges = [], cracks = [], ribs = [];
  // the face is cut into slanting slabs of slightly different rock
  for (let i = 0; i < n - 1;) { const w = R.i(1, 3); ribs.push([i, R.r(-0.9, 0.9) * step * 1.6, R.i(0, 3)]); i += w; }
  ribs.push([n - 1, 0, 0]);
  for (let r = 1; r < ribs.length - 1; r++) if (ribs[r][2] === ribs[r - 1][2]) ribs[r][2] = (ribs[r][2] + 1) % 4;
  // snow lies deep where the crest is flat and thin where it is steep
  for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], sl = Math.abs((b[1] - a[1]) / (b[0] - a[0])); cap.push(clamp((o.snow || 1) * (9 - 7 * sl) * (0.5 + 0.5 * R.f()), 0.8, 12)); }
  for (let x = x0 + 20; x < x1 - 20; x += R.r(5, 15)) { const top = P.heightAt(x), y = lerp(floor + 6, top - 12, R.f()), w = R.chance(0.22) ? R.r(18, 40) : R.r(4, 13), t = R.r(0.6, 1.6); if (top - floor > 34) ledges.push([x, y, w, t, R.r(-0.06, 0.06)]); }
  for (let x = x0 + 9; x < x1 - 9; x += R.r(5, 15)) { const top = P.heightAt(x); cracks.push([x, top - R.r(8, 50), R.r(6, 26), R.r(-3, 3)]); }

  // ---- the extra dressing, from a stream of its own ----
  const D = makeRng(sd * 977 + 31), nr = ribs.length - 1, strata = [], facets = [], pat = [], gul = [];
  const xAt = (r, yy) => { const a = ribs[r], p = pts[a[0]]; return p[0] + a[1] * clamp((p[1] - yy) / (p[1] - base), 0, 1); };   // where a slab's edge is at height yy
  for (let r = 0; r < nr; r++) {
    const a = ribs[r][0], b = ribs[r + 1][0], list = []; let top = 0, m = a;
    for (let i = a; i <= b; i++) if (pts[i][1] - cap[i] > top) { top = pts[i][1] - cap[i]; m = i; }
    const dip0 = D.chance(0.15) ? D.r(-0.5, 0.5) : D.r(-0.2, 0.2), sp = D.r(4.5, 9);
    for (let yy = floor + 12 + D.r(0, sp); yy < top - 3; yy += sp * D.r(0.6, 1.5)) {
      let ia = a, ib = b; while (ia < ib && pts[ia][1] - cap[ia] < yy + 2.5) ia++; while (ib > ia && pts[ib][1] - cap[ib] < yy + 2.5) ib--;
      const kind = D.f(), th = D.r(0.8, 2.2), dip = yy > top - 14 ? dip0 * 0.25 : dip0;
      const xl = Math.max(xAt(r, yy), ia > a ? pts[ia][0] : -1e9) + 0.8, xr = Math.min(xAt(r + 1, yy), ib < b ? pts[ib][0] : 1e9) - 0.8; if (xr - xl < 3) continue;
      const xc = (xl + xr) / 2; list.push([xl, yy + dip * (xl - xc), xr, yy + dip * (xr - xc), kind < 0.7 ? 0 : kind < 0.88 ? 1 : 2, th]);
      if (D.chance(0.3) && xr - xl > 6) {   // snow lying along this bed for part of its length
        const fa = D.r(0, 0.45), fb = D.r(0.6, 1), xa = lerp(xl, xr, fa), xb = lerp(xl, xr, fb);
        pat.push([xa, yy + dip * (xa - xc), xb, yy + dip * (xb - xc), D.r(0.5, 1.3), 0]);
      }
    }
    strata.push(list);
    if (D.chance(0.55) && top - floor > 30) {   // one facet per slab, catching the light or turned from it
      const y1 = lerp(top, floor, D.r(0.25, 0.45)), y2 = lerp(top, floor, D.r(0.7, 1.0)), left = D.chance(0.5);
      facets.push([pts[m][0], top - 0.5, xAt(left ? r : r + 1, y1), y1, lerp(xAt(r, y2), xAt(r + 1, y2), left ? 0.25 : 0.75), y2, D.chance(0.5) ? 1 : 0, pts[a][0], pts[b][0]]);
    }
  }
  pat.sort((p, q) => p[0] - q[0]);
  for (let i = 1; i < n - 1; i++) if (pts[i][1] <= pts[i - 1][1] && pts[i][1] < pts[i + 1][1]) gul.push([i, 20 + ((i * 37) % 37)]);
  const apron = []; for (let i = 0; i < n; i++) apron.push(floor + 10 + 6 * vnoise(pts[i][0] / 37, sd + 5) + 3 * vnoise(pts[i][0] / 9, sd + 6));
  // water that ran down the face and froze (blue ice), and rust-brown stains where it
  // ran over iron in the rock. Each is [x, top, length, width, lean, hidden].
  const D2 = makeRng(sd * 1931 + 57), glaze = [], stain = [];
  for (let x = x0 + 15; x < x1 - 15; x += D2.r(9, 24)) { const top = P.heightAt(x); if (top - floor > 34) glaze.push([x, lerp(floor + 16, top - 9, D2.f()), D2.r(4, 15), D2.r(0.35, 1.2), D2.r(-0.5, 0.5), 0]); }
  for (let x = x0 + 12; x < x1 - 12; x += D2.r(14, 40)) { const top = P.heightAt(x); if (top - floor > 34) stain.push([x, lerp(floor + 18, top - 8, D2.f()), D2.r(5, 18), D2.r(0.8, 2.6), D2.r(-0.4, 0.4), 0]); }
  const rust = S.tone('#7a5442', P);
  // keep snow away from the places other pieces asked to be left dark
  let keepN = -1;
  const blocked = (xa, xb, ya, yb) => { const K2 = P.rgKeep || []; for (let i = 0; i < K2.length; i++) if (xb > K2[i][0] && xa < K2[i][1] && yb > K2[i][2] && ya < K2[i][3]) return K2[i]; return null; };
  const sortKeep = () => {
    keepN = (P.rgKeep || []).length;
    glaze.forEach((q) => { q[5] = blocked(q[0] - 3, q[0] + 3, q[1] - q[2], q[1]) ? 1 : 0; });
    stain.forEach((q) => { q[5] = blocked(q[0] - 3, q[0] + 3, q[1] - q[2], q[1]) ? 1 : 0; });
    ledges.forEach((q) => { q[5] = blocked(q[0] - q[2] / 2, q[0] + q[2] / 2, q[1] - 4, q[1] + 2) ? 1 : 0; });
    pat.forEach((q) => { q[5] = blocked(q[0], q[2], Math.min(q[1], q[3]) - 1, Math.max(q[1], q[3]) + 3) ? 1 : 0; });
    cracks.forEach((q) => { q[4] = blocked(q[0] - 4, q[0] + 4, q[1] - q[2], q[1]) ? 1 : 0; });
    gul.forEach((q) => { const b = pts[q[0]], len = 20 + ((q[0] * 37) % 37), k = blocked(b[0] - 6, b[0] + 6, b[1] - len, b[1]); q[1] = k ? Math.max(6, b[1] - k[3] - 1) : len; });
  };
  P.add({ x0, x1, layer: 0, draw(ctx, env) {
    if ((P.rgKeep || []).length !== keepN) sortKeep();
    const s = env.s, i0 = Math.max(0, ix(env.x0) - 5), i1 = Math.min(n - 1, ix(env.x1) + 5), lw = Math.max(0.2, env.px * 0.8);
    let r0 = 0, r1 = nr - 1; while (r0 < nr - 1 && ribs[r0 + 1][0] < i0) r0++; while (r1 > r0 && ribs[r1][0] > i1) r1--;
    for (let r = r0; r <= r1; r++) {
      const a = ribs[r], b = ribs[r + 1];
      ctx.fillStyle = tones[a[2]]; ctx.beginPath(); ctx.moveTo(pts[a[0]][0] + a[1], base);
      for (let i = a[0]; i <= b[0]; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[b[0]][0] + b[1] + 0.6, base); ctx.closePath(); ctx.fill();
    }
    if (s > 1.2) {
      // facets, then the shadowed joint between one slab and the next
      for (let k = 0; k < 2; k++) {
        ctx.fillStyle = k ? lite : dark; ctx.globalAlpha = k ? 0.13 : 0.2; ctx.beginPath();
        for (let i = 0; i < facets.length; i++) { const q = facets[i]; if (q[6] !== k || q[8] < env.x0 - 30 || q[7] > env.x1 + 30) continue; ctx.moveTo(q[0], q[1]); ctx.lineTo(q[2], q[3]); ctx.lineTo(q[4], q[5]); ctx.closePath(); }
        ctx.fill();
      }
      ctx.strokeStyle = dark; ctx.globalAlpha = 0.4; ctx.lineWidth = Math.max(0.3, env.px); ctx.beginPath();
      for (let r = Math.max(1, r0); r <= r1; r++) { const a = ribs[r], p = pts[a[0]]; ctx.moveTo(p[0], p[1] - cap[a[0]]); ctx.lineTo(p[0] + a[1], base); }
      ctx.stroke();
    }
    if (s > 1.6) {
      // strata: pale and dark beds, and the fine lines between them
      for (let k = 1; k <= 2; k++) {
        ctx.fillStyle = k === 1 ? lite : dark; ctx.globalAlpha = k === 1 ? 0.2 : 0.28; ctx.beginPath();
        for (let r = r0; r <= r1; r++) { const list = strata[r]; for (let j = 0; j < list.length; j++) { const q = list[j]; if (q[4] !== k) continue; ctx.moveTo(q[0], q[1]); ctx.lineTo(q[2], q[3]); ctx.lineTo(q[2], q[3] - q[5]); ctx.lineTo(q[0], q[1] - q[5]); ctx.closePath(); } }
        ctx.fill();
      }
      if (s > 3) {   // each bed steps back a little, and the top of the step catches the sky
        ctx.strokeStyle = lite; ctx.globalAlpha = 0.34; ctx.lineWidth = Math.max(0.2, env.px * 0.8); ctx.beginPath();
        for (let r = r0; r <= r1; r++) { const list = strata[r]; for (let j = 0; j < list.length; j++) { const q = list[j]; if (q[4] !== 0) continue; ctx.moveTo(q[0] + 0.4, q[1] + 0.32); ctx.lineTo(q[2] - 0.4, q[3] + 0.32); } }
        ctx.stroke();
      }
      ctx.strokeStyle = dark; ctx.globalAlpha = 0.62; ctx.lineWidth = Math.max(0.16, env.px * 0.75); ctx.beginPath();
      for (let r = r0; r <= r1; r++) { const list = strata[r]; for (let j = 0; j < list.length; j++) { const q = list[j]; if (q[4] !== 0 || (s < 3 && j % 2)) continue; ctx.moveTo(q[0], q[1]); ctx.lineTo(q[2], q[3]); } }
      ctx.stroke();
      if (s > 8) {   // up close, thinner partings inside the thick beds, each running only part way
        ctx.globalAlpha = 0.3; ctx.lineWidth = Math.max(0.08, env.px * 0.6); ctx.beginPath();
        for (let r = r0; r <= r1; r++) {
          const list = strata[r];
          for (let j = 1; j < list.length; j++) {
            const q = list[j], p = list[j - 1], ya = (p[1] + p[3]) / 2, yb = (q[1] + q[3]) / 2, m = Math.floor((yb - ya) / 2.3);
            if (m < 1 || yb < env.y0 || ya > env.y1) continue;
            const xa = Math.max(q[0], p[0]) + 0.6, xb = Math.min(q[2], p[2]) - 0.6; if (xb - xa < 2 || xb < env.x0 || xa > env.x1) continue;
            for (let i = 1; i <= m; i++) {
              const h1 = rgHash(j * 9.1 + i * 3.3 + r * 1.7), u = i / (m + 1) + (h1 - 0.5) * 0.25, f0 = rgHash(h1 * 41) * 0.5, f1 = 0.5 + rgHash(h1 * 23) * 0.5;
              const x2 = lerp(xa, xb, f0), x3 = lerp(xa, xb, f1); ctx.moveTo(x2, lerp(p[1], q[1], u) + (x2 - xa) * (q[3] - q[1]) / (q[2] - q[0])); ctx.lineTo(x3, lerp(p[1], q[1], u) + (x3 - xa) * (q[3] - q[1]) / (q[2] - q[0]));
            }
          }
        }
        ctx.stroke();
      }
    }
    if (s > 5.5) {
      // joints: each bed is split into blocks by short upright cracks, offset from
      // the bed above like courses of masonry. Worked out here, not stored.
      const cw = 4.2, jw = Math.max(0.12, env.px * 0.7); ctx.fillStyle = dark; ctx.globalAlpha = 0.5; ctx.beginPath();
      for (let r = r0; r <= r1; r++) {
        const list = strata[r];
        for (let j = 0; j < list.length; j++) {
          const q = list[j], xa = Math.max(q[0] + 0.5, env.x0), xb = Math.min(q[2] - 0.5, env.x1); if (xb <= xa) continue;
          const ym = (q[1] + q[3]) / 2; if (ym < env.y0 - 2 || ym - 9 > env.y1) continue;
          const gap = j ? Math.max(1.2, ym - (list[j - 1][1] + list[j - 1][3]) / 2) : 5, sl = (q[3] - q[1]) / (q[2] - q[0]);
          for (let c = Math.floor(xa / cw); c * cw < xb; c++) {
            const h1 = rgHash(c * 3.71 + j * 17.3 + r * 5.13); if (h1 < 0.3) continue;
            const jx = (c + h1) * cw; if (jx < xa || jx > xb) continue;
            const yt = q[1] + sl * (jx - q[0]) - 0.12, ln = gap * (0.35 + 0.6 * rgHash(c * 1.37 + j * 7.1 + r));
            ctx.rect(jx, yt - ln, jw, ln);
          }
        }
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (s > 2) {   // cracks: a jagged line and a short branch
      ctx.strokeStyle = dark; ctx.lineWidth = lw; ctx.beginPath();
      for (let i = 0; i < cracks.length; i++) {
        const q = cracks[i]; if (q[4] || q[0] < env.x0 - 6 || q[0] > env.x1 + 6) continue;
        ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + q[3] * 0.5, q[1] - q[2] * 0.3); ctx.lineTo(q[0] + q[3] * 0.25, q[1] - q[2] * 0.62); ctx.lineTo(q[0] + q[3], q[1] - q[2]);
        if (s > 5) { ctx.moveTo(q[0] + q[3] * 0.5, q[1] - q[2] * 0.3); ctx.lineTo(q[0] + q[3] * 0.5 - (i % 2 ? 2.2 : -2.2), q[1] - q[2] * 0.5); }
      }
      ctx.stroke();
    }
    if (s > 2.5) {
      // rust stains first, then the ice that has run down over the rock: a tapering
      // streak, glassy blue, with a bright edge along one side up close
      const g0 = rgFrom(stain, env.x0 - 4);
      ctx.fillStyle = rust; ctx.globalAlpha = 0.24; ctx.beginPath();
      for (let i = g0; i < stain.length && stain[i][0] < env.x1 + 4; i++) { const q = stain[i]; if (q[5]) continue; ctx.moveTo(q[0] - q[3] / 2, q[1]); ctx.lineTo(q[0] + q[3] / 2, q[1]); ctx.quadraticCurveTo(q[0] + q[3] * 0.3 + q[4] * q[2] * 0.4, q[1] - q[2] * 0.5, q[0] + q[4] * q[2], q[1] - q[2]); ctx.quadraticCurveTo(q[0] - q[3] * 0.3 + q[4] * q[2] * 0.4, q[1] - q[2] * 0.5, q[0] - q[3] / 2, q[1]); }
      ctx.fill();
      const i0g = rgFrom(glaze, env.x0 - 4);
      ctx.fillStyle = ice; ctx.globalAlpha = 0.6; ctx.beginPath();
      for (let i = i0g; i < glaze.length && glaze[i][0] < env.x1 + 4; i++) { const q = glaze[i]; if (q[5]) continue; const w2 = q[3] / 2, ex = q[0] + q[4] * q[2]; ctx.moveTo(q[0] - w2, q[1]); ctx.lineTo(q[0] + w2, q[1]); ctx.lineTo(lerp(q[0], ex, 0.5) + w2 * 0.8, q[1] - q[2] * 0.5); ctx.lineTo(ex + w2 * 0.15, q[1] - q[2]); ctx.lineTo(lerp(q[0], ex, 0.6) - w2 * 0.7, q[1] - q[2] * 0.6); ctx.closePath(); }
      ctx.fill();
      if (s > 7) {
        ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.55; ctx.lineWidth = Math.max(0.06, env.px * 0.7); ctx.beginPath();
        for (let i = i0g; i < glaze.length && glaze[i][0] < env.x1 + 4; i++) { const q = glaze[i]; if (q[5]) continue; const w2 = q[3] / 2, ex = q[0] + q[4] * q[2]; ctx.moveTo(q[0] - w2 * 0.6, q[1] - 0.1); ctx.lineTo(lerp(q[0], ex, 0.6) - w2 * 0.5, q[1] - q[2] * 0.6); }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // snow banked against the foot of the wall
    if (env.y0 < floor + 20) { ctx.fillStyle = snow; ctx.beginPath(); ctx.moveTo(pts[i0][0], base); for (let i = i0; i <= i1; i++) ctx.lineTo(pts[i][0], apron[i]); ctx.lineTo(pts[i1][0], base); ctx.closePath(); ctx.fill(); }
    if (s > 1.2) {   // snow lying along the beds: a thin white wedge on each, with a line of shade under it
      ctx.fillStyle = snow; ctx.beginPath();
      for (let i = rgFrom(pat, env.x0 - 40); i < pat.length && pat[i][0] < env.x1; i++) { const q = pat[i]; if (q[5]) continue; const dx = q[2] - q[0]; ctx.moveTo(q[0], q[1]); ctx.lineTo(q[2], q[3]); ctx.lineTo(q[2] - dx * 0.12, q[3] + q[4] * 0.8); ctx.lineTo(q[0] + dx * 0.45, q[1] + (q[3] - q[1]) * 0.45 + q[4]); ctx.lineTo(q[0] + dx * 0.15, q[1] + q[4] * 0.6); ctx.closePath(); }
      ctx.fill();
      if (s > 4) {
        ctx.strokeStyle = snowSh; ctx.lineWidth = Math.max(0.14, env.px * 0.7); ctx.beginPath();
        for (let i = rgFrom(pat, env.x0 - 40); i < pat.length && pat[i][0] < env.x1; i++) { const q = pat[i]; if (q[5]) continue; ctx.moveTo(q[0], q[1] - 0.1); ctx.lineTo(q[2], q[3] - 0.1); }
        ctx.stroke();
      }
    }
    // gullies: snow packed into every notch in the crest, with a streak of ice
    for (let k = 0; k < 2; k++) {
      if (k && s < 2.2) break;
      ctx.fillStyle = k ? ice : snow; ctx.beginPath();
      for (let j = 0; j < gul.length; j++) {
        const i = gul[j][0]; if (i < i0 || i > i1 || i < 1 || i > n - 2) continue;
        const a = pts[i - 1], b = pts[i], c = pts[i + 1], len = gul[j][1], tx = b[0] + (i % 5) - 2;
        if (k) { ctx.moveTo(b[0] - 0.7, b[1] - len * 0.12); ctx.lineTo(b[0] + 0.9, b[1] - len * 0.2); ctx.lineTo(tx + 0.5, b[1] - len * 0.8); ctx.lineTo(tx - 0.3, b[1] - len * 0.86); ctx.closePath(); continue; }
        ctx.moveTo(b[0] - step * 0.55, b[1] + (a[1] - b[1]) * 0.55); ctx.lineTo(b[0] + step * 0.55, b[1] + (c[1] - b[1]) * 0.55); ctx.lineTo(b[0] + 2.4 + (i % 3), b[1] - len * 0.45); ctx.lineTo(tx + 1.3, b[1] - len * 0.78);
        ctx.lineTo(tx, b[1] - len); ctx.lineTo(tx - 1.5, b[1] - len * 0.7); ctx.lineTo(b[0] - 2.6 - (i % 2), b[1] - len * 0.36); ctx.closePath();
      }
      ctx.fill();
    }
    // the cap of snow along the top, with its shadow under the lip. Its lower
    // edge sags between the high points, as if it were about to let go.
    const dir = env.wind < 0 ? -1 : 1;
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? snow : snowSh; ctx.beginPath(); ctx.moveTo(pts[i0][0], pts[i0][1]);
      for (let i = i0; i <= i1; i++) ctx.lineTo(pts[i][0], pts[i][1] + 0.7);
      for (let i = i1; i >= i0; i--) {
        ctx.lineTo(pts[i][0] + (i % 2 ? 2.2 : -1.6), pts[i][1] - cap[i] - (pass ? 0 : 1.3));
        if (i > i0 && s > 1.5) ctx.lineTo((pts[i][0] + pts[i - 1][0]) / 2 + (rgHash(i) - 0.5) * 3, (pts[i][1] + pts[i - 1][1]) / 2 - (cap[i] + cap[i - 1]) * 0.5 * (0.55 + 0.9 * rgHash(i * 1.7)) - (pass ? 0 : 1.3));
      }
      ctx.closePath(); ctx.fill();
    }
    if (s > 1.5) {
      // cornices: on every peak the snow overhangs the side the wind blows toward
      for (let pass = 0; pass < 2; pass++) {
        ctx.fillStyle = pass ? snow : snowSh; ctx.beginPath();
        for (let i = Math.max(1, i0); i < Math.min(n - 1, i1 + 1); i++) {
          const b = pts[i]; if (b[1] < pts[i - 1][1] || b[1] <= pts[i + 1][1]) continue;
          const h = rgHash(i * 2.3), up = pts[i - dir], dn = pts[i + dir], tipX = b[0] + dir * (3.4 + 2.6 * h), hookX = b[0] + dir * (2.7 + 1.8 * h);
          if (pass) { ctx.moveTo(b[0] - dir * 3, lerp(b[1], up[1], 0.3) + 0.7); ctx.lineTo(b[0], b[1] + 1.5); ctx.lineTo(tipX, b[1] + 0.9); ctx.lineTo(hookX, b[1] - 0.9); ctx.lineTo(b[0] + dir * 1.5, lerp(b[1], dn[1], 0.15) - 0.3); ctx.closePath(); }
          else { ctx.moveTo(tipX, b[1] + 0.7); ctx.lineTo(hookX - dir * 0.3, b[1] - 2.9); ctx.lineTo(b[0] + dir * 1.0, lerp(b[1], dn[1], 0.3) - cap[i] * 0.4); ctx.lineTo(b[0] + dir * 1.5, b[1] - 0.2); ctx.closePath(); }
        }
        ctx.fill();
      }
    }
    // ledges: a dark underside, snow on top, icicles up close
    const l0 = rgFrom(ledges, env.x0 - 22);
    for (let k = 0; k < 2; k++) {
      ctx.fillStyle = k ? snow : dark; ctx.beginPath();
      for (let i = l0; i < ledges.length && ledges[i][0] < env.x1 + 22; i++) {
        const q = ledges[i], x = q[0], y = q[1], w = q[2], t = q[3], sl = q[4] * w; if (q[5]) continue;
        if (k) { ctx.moveTo(x - w / 2, y - 0.3 - sl); ctx.lineTo(x - w * 0.3, y + t - sl * 0.5); ctx.lineTo(x + w * 0.25, y + t * 0.9 + sl * 0.5); ctx.lineTo(x + w / 2, y - 0.2 + sl); ctx.lineTo(x + w * 0.3, y - 0.7 + sl * 0.6); ctx.lineTo(x - w * 0.2, y - 0.8 - sl * 0.4); }
        else { ctx.moveTo(x - w / 2 + 0.6, y - 0.5 - sl); ctx.lineTo(x + w / 2 - 0.4, y - 0.4 + sl); ctx.lineTo(x + w * 0.3, y - 2.0 - t + sl * 0.5); ctx.lineTo(x - w * 0.25, y - 2.5 - t - sl * 0.5); }
        ctx.closePath();
      }
      ctx.fill();
    }
    if (s > 9) {
      ctx.fillStyle = ice; ctx.beginPath();
      for (let i = l0; i < ledges.length && ledges[i][0] < env.x1 + 22; i++) { const q = ledges[i]; if (q[5] || q[2] < 6) continue; rgIcicles(ctx, env, q[0] - q[2] * 0.3, q[0] + q[2] * 0.32, q[1] - 0.72, 1.5, 0.8, i * 13); }
      ctx.fill();
    }
  } });
  // snow blowing off the crest: a banner streams from every peak, longer and
  // flatter as the wind rises, with puffs that travel along it
  if (o.plume !== false) P.add({ x0, x1, layer: 1, draw(ctx, env) {
    const w = env.wind, a = Math.min(1, Math.abs(w) / 7); if (a < 0.12 || env.y1 < floor + H * 0.4) return;
    const dir = w >= 0 ? 1 : -1, ia = Math.max(1, ix(env.x0) - 8), ib = Math.min(n - 1, ix(env.x1) + 8), tt = env.t * (0.13 + 0.13 * a);
    for (let pass = 0; pass < 2; pass++) {   // the grey underside first, so the white shows against a pale sky
      ctx.fillStyle = pass ? '#ffffff' : shade; ctx.globalAlpha = (pass ? 0.3 : 0.2) * a; ctx.beginPath();
      for (let i = ia; i < ib; i++) {
        const b = pts[i]; if (b[1] < pts[i - 1][1] || b[1] <= pts[i + 1][1]) continue;
        const len = (14 + 34 * a) * (0.6 + 0.8 * rgHash(i * 1.3)), lift = 2 + 5 * rgHash(i * 2.1), yy = b[1] - (pass ? 0 : 1.3), wob = Math.sin(env.t * 1.3 + i) * 1.2;
        ctx.moveTo(b[0] - dir, yy + 0.7); ctx.quadraticCurveTo(b[0] + dir * len * 0.4, yy + lift + 3 + 2 * a + wob, b[0] + dir * len, yy + 0.6 + lift + wob); ctx.quadraticCurveTo(b[0] + dir * len * 0.5, yy - 1.6 + lift * 0.3, b[0] - dir, yy - 0.9);
      }
      ctx.fill();
    }
    for (let i = ia; i < ib; i++) {
      const b = pts[i]; if (b[1] < pts[i - 1][1] || b[1] <= pts[i + 1][1]) continue;
      const len = (14 + 34 * a) * (0.6 + 0.8 * rgHash(i * 1.3)), lift = 2 + 5 * rgHash(i * 2.1);
      for (let k = 0; k < 3; k++) {
        const u = (tt + k / 3 + i * 0.37) % 1, px = b[0] + dir * u * len, py = b[1] + 1 + u * lift + Math.sin(env.t * 1.7 + i + k * 2) * 0.6, al = 0.36 * a * (1 - u) * Math.min(1, u * 5);
        ctx.globalAlpha = al * 0.6; ctx.fillStyle = shade; ctx.beginPath(); ctx.ellipse(px + dir * 0.6, py - 1 - u * 1.5, 2.6 + u * 9, 1 + u * 2.4, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = al; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(px, py, 2.4 + u * 8.4, 0.9 + u * 2.1, 0, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  } });
  if (o.solid !== false) for (let i = 0; i < n - 1; i++) P.solid(pts[i][0], base, step, Math.min(pts[i][1], pts[i + 1][1]) - base - 0.4, 'hard');
  P.groundY = floor; P.groundMat = 'snow';
  return P;
};

// Snow thrown up by a blasting charge: lumps flung out, a white burst on a
// slope that billows and drifts off down the wind, and powder running away
// under it. B.fire(t, x, y) sets one off (t is the mission time); `k` scales
// it for the distance of the plane it is on.
K.snowBlasts = function (S, P, k) {
  const list = [], shade = S.tone('#7d93ae', P), dirt = S.tone('#46505b', P); k = k || 1;
  P.add({ x0: -2000, x1: 2000, layer: 1, draw(ctx, env) {
    for (let i = 0; i < list.length; i++) {
      const b = list[i], u = (env.t - b.t) / 6.5; if (u < 0 || u > 1 || b.x < env.x0 - 70 * k || b.x > env.x1 + 70 * k) continue;
      const drift = env.wind * u * 2.5;
      // powder spreading along the slope under the cloud
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.45 * (1 - u) * Math.min(1, u * 8); ctx.beginPath(); ctx.ellipse(b.x + drift * 0.6 * k, b.y - u * 3 * k, (5 + u * 24) * k, (1 + u * 2.2) * k, 0, 0, TAU); ctx.fill();
      for (let pass = 0; pass < 2; pass++) {   // a blue-grey underside, then the lit top, so it shows against snow
        ctx.fillStyle = pass ? '#ffffff' : shade;
        for (let j = 0; j < 11; j++) { const a = j * 2.4 + b.x, q = Math.min(1, u * (1.7 + (j % 3) * 0.6)); ctx.globalAlpha = (pass ? 0.8 : 0.6) * (1 - u) * Math.min(1, u * 16); ctx.beginPath(); ctx.ellipse(b.x + (Math.cos(a) * q * 9 + drift + (pass ? -0.6 : 0.5)) * k, b.y + (Math.abs(Math.sin(a)) * q * 11 + q * 5 - u * u * 7 + (pass ? 0.9 : -0.7)) * k, (2.5 + q * 6) * k * (pass ? 0.86 : 1), (2 + q * 4.5) * k * (pass ? 0.8 : 1), 0, 0, TAU); ctx.fill(); }
      }
      if (u < 0.16) {   // lumps of snow and frozen earth flung out
        const v = u / 0.16; ctx.strokeStyle = dirt; ctx.globalAlpha = 1 - v; ctx.lineWidth = Math.max(0.3 * k, env.px); ctx.beginPath();
        for (let j = 0; j < 9; j++) { const an = 0.3 + j * 0.32, ra = (3 + v * 17) * k, rb = ra + (1.5 + (j % 3)) * k, fall = v * v * 6 * k; ctx.moveTo(b.x + Math.cos(an) * ra, b.y + Math.sin(an) * ra - fall); ctx.lineTo(b.x + Math.cos(an) * rb, b.y + Math.sin(an) * rb - fall); }
        ctx.stroke();
      }
      if (u < 0.05) { ctx.globalAlpha = 1 - u / 0.05; circ(ctx, b.x, b.y + 1.5 * k, (2 + u * 60) * k, '#ffd58a'); }
    }
    ctx.globalAlpha = 1;
  } });
  return { P, fire(t, x, y) { list.push({ t, x, y: y === undefined ? P.heightAt(x) : y }); if (list.length > 8) list.shift(); } };
};

// A sniper hide on a snowy ledge: a low wall of stacked stone, a dark slot,
// and a slab roof, tucked under an overhang. All hides look the same from
// across the valley: nothing here is random, on purpose.
// The rock behind the ledge is cut back and dark, so whoever stands on it
// shows clearly, and the crag keeps its snow away from this spot.
K.hide = function (S, P, x, y, o) {
  o = o || {};
  const rock = S.tone('#3d4651', P), rockL = S.tone('#6b7785', P), rockM = S.tone('#545f6c', P), back = S.tone('#151a21', P), back2 = S.tone('#262d37', P), snow = S.tone('#f3f6fa', P), sh = S.tone('#a9bace', P), hole = S.tone('#0f1318', P), net = S.tone('#7f8a78', P), ice = S.tone('#b5d2ea', P);
  const L = o.left === undefined ? 5 : o.left, Rt = o.right === undefined ? 11 : o.right;
  (P.rgKeep = P.rgKeep || []).push([x - L - 15, x + Rt + 15, y - 11, y + 14]);
  const stones = [0.62, 0.9, 0.7, 0.86, 0.72];
  P.add({ x0: x - L - 4, x1: x + Rt + 4, layer: 0, draw(ctx, env) {
    const s = env.s, lw = Math.max(0.05, env.px * 0.7);
    // the undercut behind the ledge, and the lip of rock over it with its own snow
    poly(ctx, [x - L - 2.4, y - 0.3, x - L - 1.0, y + 2.7, x - L + 2.2, y + 4.1, x + Rt * 0.45, y + 4.7, x + Rt - 0.4, y + 4.2, x + Rt + 1.7, y + 2.5, x + Rt + 2.5, y - 0.3], back);
    if (s > 4) {
      ctx.strokeStyle = back2; ctx.lineWidth = Math.max(0.12, env.px * 0.8); ctx.beginPath();
      ctx.moveTo(x - L - 0.6, y + 1.6); ctx.lineTo(x - L + 3.5, y + 1.9); ctx.moveTo(x - L + 1.0, y + 3.0); ctx.lineTo(x + 3, y + 3.5); ctx.lineTo(x + Rt - 1, y + 3.2); ctx.moveTo(x + 4.5, y + 2.2); ctx.lineTo(x + Rt + 1.2, y + 1.8); ctx.moveTo(x + 3, y + 1.0); ctx.lineTo(x + Rt + 1.8, y + 0.8);
      ctx.stroke();
    }
    poly(ctx, [x - L + 1.6, y + 4.0, x - L + 2.6, y + 4.75, x + Rt * 0.45, y + 5.4, x + Rt - 1.6, y + 4.85, x + Rt - 0.6, y + 4.15, x + Rt * 0.45, y + 4.62, x - L + 2.4, y + 4.02], snow);
    if (s > 6) {
      // icicles hanging off the lip into the dark of the undercut, pale against it
      const xa = x - L + 2.6, xm = x + Rt * 0.45, xb = x + Rt - 0.9;
      ctx.fillStyle = ice; ctx.beginPath();
      for (let k = 0; k < 40; k++) {
        const xx = lerp(xa, xb, (k + 0.5) / 40), h = rgHash(k * 5.7 + 3); if (h < 0.3) continue;
        const yl = xx < xm ? lerp(y + 4.02, y + 4.62, (xx - xa) / (xm - xa)) : lerp(y + 4.62, y + 4.15, (xx - xm) / (xb - xm)), l = 0.25 + 0.9 * h * h, wd = Math.max(0.04, l * 0.13);
        ctx.moveTo(xx - wd, yl + 0.06); ctx.lineTo(xx + wd, yl + 0.06); ctx.lineTo(xx + wd * 0.15, yl - l); ctx.closePath();
      }
      ctx.fill();
    }
    // the block the ledge sits on
    poly(ctx, [x - L, y - 0.2, x + Rt, y - 0.2, x + Rt - 1.4, y - 3.0, x + Rt * 0.3, y - 4.1, x - L + 1.6, y - 3.4], rock);
    poly(ctx, [x + Rt * 0.3, y - 0.2, x + Rt, y - 0.2, x + Rt - 1.4, y - 3.0, x + Rt * 0.3, y - 4.1], back2);
    if (s > 4) {   // its bedding: a dark joint with a lit step above each one, and a crack
      ctx.strokeStyle = rockL; ctx.globalAlpha = 0.4; ctx.lineWidth = Math.max(0.08, env.px * 0.8); ctx.beginPath();
      ctx.moveTo(x - L + 0.6, y - 1.55); ctx.lineTo(x + Rt - 0.7, y - 1.45); ctx.moveTo(x - L + 1.4, y - 2.75); ctx.lineTo(x + Rt - 1.2, y - 2.62); ctx.stroke();
      ctx.strokeStyle = back; ctx.globalAlpha = 0.7; ctx.beginPath();
      ctx.moveTo(x - L + 0.5, y - 1.72); ctx.lineTo(x + Rt - 0.6, y - 1.62); ctx.moveTo(x - L + 1.3, y - 2.92); ctx.lineTo(x + Rt - 1.1, y - 2.8);
      ctx.moveTo(x - L + 3.2, y - 1.72); ctx.lineTo(x - L + 3.6, y - 2.4); ctx.lineTo(x - L + 3.3, y - 2.92); ctx.moveTo(x + 5.5, y - 1.66); ctx.lineTo(x + 5.2, y - 2.3);
      ctx.moveTo(x - 1.4, y - 2.86); ctx.lineTo(x - 1.1, y - 3.5); ctx.stroke(); ctx.globalAlpha = 1;
    }
    // the ledge: snow, and the blue shadow under its edge
    poly(ctx, [x - L - 0.9, y - 0.3, x - L + 0.5, y + 0.3, x + Rt - 0.6, y + 0.24, x + Rt + 0.8, y - 0.35, x + Rt - 0.5, y - 0.8, x - L + 0.4, y - 0.85], snow);
    poly(ctx, [x - L + 0.4, y - 0.85, x + Rt - 0.5, y - 0.8, x + Rt - 1.0, y - 1.25, x - L + 1.0, y - 1.3], sh);
    if (s > 9) { ctx.fillStyle = ice; ctx.beginPath(); rgIcicles(ctx, env, x - L + 1.2, x + Rt - 1.2, y - 1.24, 0.9, 0.55, 77); ctx.fill(); }
    if (s > 6) {
      // the ledge is trodden: a line of boot prints, each a small blue hollow, and
      // the shade the overhang throws across the back of it
      ctx.fillStyle = sh; ctx.globalAlpha = 0.32; ctx.beginPath(); rgLens(ctx, x + (Rt - L) / 2, y + 0.26, (L + Rt) / 2 - 0.6, 0.01, 0.08, 0); ctx.fill();
      // (no glitter on these ledges: the player is timing flashes up here)
      ctx.globalAlpha = 0.9; ctx.beginPath();
      for (let k = 0; k < 15; k++) { const px2 = x - L + 1.3 + k * ((L + Rt - 2.4) / 14), py2 = y - 0.12 - (k % 2) * 0.2 + rgHash(k + 1.5) * 0.05; rgLens(ctx, px2, py2, 0.2, 0.005, 0.06, 0.04); }
      ctx.fill(); ctx.globalAlpha = 1;
    }
    // the wall: a course of stones, two uprights, the slot between them
    R4(ctx, x - 1.9, y + 0.2, 3.8, 1.5, rock);
    let sx = x - 1.9;
    for (let k = 0; k < 5; k++) { R4(ctx, sx + 0.03, y + 0.2, stones[k] - 0.06, 0.52, k % 2 ? rockL : rockM); sx += stones[k]; }
    R4(ctx, x - 1.9, y + 0.72, 0.4, 0.5, rockM); R4(ctx, x + 1.5, y + 0.72, 0.4, 0.5, rockL);
    R4(ctx, x - 1.5, y + 0.72, 3.0, 0.5, hole); R4(ctx, x - 1.5, y + 0.72, 3.0, 0.5, 'rgba(6,8,12,0.6)');
    if (s > 9) {   // the top edge of each stone catches a little light
      ctx.fillStyle = S.tone('#8793a0', P); sx = x - 1.9;
      for (let k = 0; k < 5; k++) { ctx.fillRect(sx + 0.05, y + 0.66, stones[k] - 0.1, 0.05); sx += stones[k]; }
    }
    // the slab roof and the snow on it
    poly(ctx, [x - 2.2, y + 1.22, x + 2.1, y + 1.22, x + 1.8, y + 1.64, x - 1.9, y + 1.68], rockL);
    R4(ctx, x - 2.2, y + 1.22, 4.3, 0.1, rock);
    poly(ctx, [x - 2.3, y + 1.6, x - 1.5, y + 2.1, x + 1.2, y + 2.15, x + 2.2, y + 1.58], snow);
    if (s > 6) poly(ctx, [x - 2.3, y + 1.6, x + 2.2, y + 1.58, x + 1.9, y + 1.72, x - 2.0, y + 1.76], sh);
    if (s > 9) {   // a scrap of netting hung over the slot
      ctx.strokeStyle = net; ctx.lineWidth = lw; ctx.beginPath();
      for (let k = 0; k < 7; k++) { const xx = x - 1.4 + k * 0.46; ctx.moveTo(xx, y + 1.22); ctx.lineTo(xx + 0.1, y + 1.05 - (k % 3) * 0.06); }
      ctx.stroke();
    }
  } });
  return { x, y, P, lens: [x + 0.15, y + 0.97], at: (dx, extra) => Object.assign({ plane: P, x: x + (dx || 0), y: y + 0.26, zone: 'ridge', room: null, behind: false }, extra || {}) };
};

// ---- the compound -----------------------------------------------------------
// A concrete bunker with sloped walls, firing slits and a slab roof under snow.
// People can stand on the roof: B.on(x) is a placement up there.
// The concrete shows the boards it was cast against, pour joints, tie holes
// and the stains under every slit. The door is steel, with a wheel, a lamp
// over it and a no-entry disc beside it. After dark the slits glow, the glow
// falls on the snow outside, and all of it dies with the generator.
// Options: door (x of the door), slits, text and textX (stencilled number),
// vent (x of the stove pipe on the roof, null for none), col, id.
K.bunker = function (S, P, x, w, h, o) {
  o = o || {};
  const y = o.y || 0, id = o.id || ('bk' + Math.round(x)), hex = o.col || '#79818b', L = rgSun(S);
  const c = S.tone(hex, P), c2 = S.tone(darken(hex, 0.16), P), c3 = S.tone(darken(hex, 0.42), P), cL = S.tone(lighten(hex, 0.16), P), seam = S.tone(darken(hex, 0.09), P), snow = S.tone('#f4f7fa', P), snowSh = S.tone('#a9bace', P), sh = S.tone(mix(S.pal.ground, '#6f86a8', 0.34), P), glow = S.tone('#ffd98a', P, true), hot = S.tone('#fff1c9', P, true);
  const steel = S.tone('#3a434e', P), steelL = S.tone('#5d6876', P), ice = S.tone('#cfe2f2', P), ink = S.tone('#20242b', P), smoke = S.tone('#8a93a1', P), cold = S.tone('#cfd6dc', P);
  const slits = o.slits === undefined ? Math.max(1, Math.floor(w / 6.5)) : o.slits, roofY = y + h + 0.45, sy = y + h * 0.56, slitX = [];
  for (let i = 0; i < slits; i++) { const sx = x + ((i + 0.5) * w) / slits - 1.1; if (o.door !== undefined && Math.abs(sx + 1.1 - o.door) < 2.4) continue; slitX.push(sx); }
  const vent = o.vent === undefined ? x + w * 0.3 : o.vent, d = o.door, nj = Math.max(1, Math.round(w / 4.6));
  const xl = (yy) => x - 0.9 * (1 - (yy - y) / h), xf = (yy) => x + w - 2.2 + (0.6 * (yy - y)) / h;   // the left edge of the face, and where the end wall begins
  P.add({ x0: x - 6, x1: x + w + 7, layer: 0, draw(ctx, env) {
    const s = env.s, px = env.px, pw = rgPower(S, env), dir = env.wind < 0 ? -1 : 1;
    ctx.fillStyle = sh; ctx.beginPath(); rgCast(ctx, L, y, [x - 0.9, 0, x + w + 0.9, 0, x + w + 0.55, h + 0.6, x - 0.55, h + 0.6]); ctx.fill();
    poly(ctx, [x - 0.9, y, x + w + 0.9, y, x + w, y + h, x, y + h], c);
    ctx.globalAlpha = 0.4; poly(ctx, [xl(y + h * 0.6), y + h * 0.6, xf(y + h * 0.6), y + h * 0.6, xf(y + h), y + h, x, y + h], cL); ctx.globalAlpha = 1;   // the top of the wall takes more light
    poly(ctx, [x + w - 2.2, y, x + w + 0.9, y, x + w, y + h, x + w - 1.6, y + h], c2);
    if (s > 6) {
      // the marks of the boards the concrete was cast against, and the joints between pours
      ctx.strokeStyle = seam; ctx.lineWidth = Math.max(0.03, px * 0.55); ctx.beginPath();
      for (let yy = y + 0.75; yy < y + h - 0.15; yy += 0.5) { ctx.moveTo(xl(yy) + 0.06, yy); ctx.lineTo(xf(yy) - 0.05, yy); }
      ctx.stroke();
      ctx.strokeStyle = c2; ctx.lineWidth = Math.max(0.045, px * 0.7); ctx.beginPath();
      for (let j = 1; j < nj; j++) { const jx = x + (w * j) / nj; if (jx < xf(y) - 0.3) { ctx.moveTo(jx, y + 0.5); ctx.lineTo(jx, y + h); } }
      ctx.stroke();
      // rain and rust have run down from every slit and from the roof drains
      ctx.fillStyle = 'rgba(16,20,26,0.15)'; ctx.beginPath();
      for (let i = 0; i < slitX.length; i++) { const sx = slitX[i]; for (let k = 0; k < 3; k++) { const xx = sx + 0.3 + k * 0.75 + rgHash(i * 3 + k + x) * 0.3, ln = 0.5 + 1.0 * rgHash(i * 5 + k * 2 + x); ctx.moveTo(xx, sy - 0.1); ctx.lineTo(xx + 0.22, sy - 0.1); ctx.lineTo(xx + 0.13, sy - 0.1 - ln); ctx.closePath(); } }
      for (let k = 0; k < nj; k++) { const xx = x + (w * (k + 0.37)) / nj; if (xx > xf(y + h) - 0.4) continue; ctx.moveTo(xx, y + h); ctx.lineTo(xx + 0.3, y + h); ctx.lineTo(xx + 0.17, y + h - 0.7 - rgHash(k + x) * 0.6); ctx.closePath(); }
      ctx.fill();
    }
    if (s > 14) {   // the holes left by the form ties
      ctx.fillStyle = c2; ctx.beginPath();
      for (let yy = y + 1.0; yy < y + h - 0.3; yy += 1.0) for (let xx = Math.max(x + 0.6, Math.ceil((env.x0 - x) / 1.15) * 1.15 + x + 0.6); xx < Math.min(xf(yy) - 0.3, env.x1); xx += 1.15) ctx.rect(xx, yy, 0.07, 0.07);
      ctx.fill();
    }
    R4(ctx, x - 0.9, y, w + 1.8, 0.5, c2);
    // firing slits: a splayed recess, snow on the sill, bars, and light inside after dark
    for (let i = 0; i < slitX.length; i++) {
      const sx = slitX[i]; if (sx + 4 < env.x0 || sx - 2 > env.x1) continue;
      R4(ctx, sx - 0.15, sy - 0.12, 2.5, 0.75, c2); R4(ctx, sx - 0.15, sy + 0.54, 2.5, 0.09, c3); R4(ctx, sx, sy, 2.2, 0.48, c3);
      if (pw > 0) { ctx.globalAlpha = pw; R4(ctx, sx, sy, 2.2, 0.48, glow); if (s > 8) R4(ctx, sx + 0.3, sy + 0.1, 1.6, 0.26, hot); ctx.globalAlpha = 1; }
      if (s > 7) R4(ctx, sx - 0.15, sy - 0.12, 2.5, 0.07, snow);
      if (s > 12) {
        ctx.fillStyle = c3; ctx.fillRect(sx + 0.71, sy, 0.05, 0.48); ctx.fillRect(sx + 1.44, sy, 0.05, 0.48);
        if (pw > 0) { ctx.globalAlpha = 0.6 * pw; ctx.fillStyle = ice; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 0.4, sy); ctx.lineTo(sx, sy + 0.22); ctx.moveTo(sx + 2.2, sy); ctx.lineTo(sx + 1.75, sy); ctx.lineTo(sx + 2.2, sy + 0.26); ctx.moveTo(sx, sy + 0.48); ctx.lineTo(sx + 0.25, sy + 0.48); ctx.lineTo(sx, sy + 0.34); ctx.moveTo(sx + 2.2, sy + 0.48); ctx.lineTo(sx + 1.9, sy + 0.48); ctx.lineTo(sx + 2.2, sy + 0.36); ctx.fill(); ctx.globalAlpha = 1; }   // frost in the corners of the glass
      }
      if (pw > 0) { if (s > 9) rgGlow(ctx, sx + 1.1, sy + 0.24, 2.4, '255,205,120', 0.3 * pw); else { ctx.globalAlpha = 0.15 * pw; R4(ctx, sx - 0.5, sy - 0.4, 3.2, 1.3, glow); ctx.globalAlpha = 1; } }
    }
    if (d !== undefined) {
      // the door: a steel leaf in a concrete surround, with a step swept clear
      R4(ctx, d - 0.95, y, 1.9, 2.6, c2); R4(ctx, d - 0.65, y, 1.3, 2.2, steel); R4(ctx, d - 1.15, y, 2.3, 0.12, cL);
      if (s > 6) {
        ctx.fillStyle = steelL; ctx.fillRect(d - 0.65, y + 0.66, 1.3, 0.09); ctx.fillRect(d - 0.65, y + 1.38, 1.3, 0.09); ctx.fillRect(d - 0.65, y + 2.1, 1.3, 0.1);
        ctx.fillStyle = ink; ctx.fillRect(d - 0.7, y + 0.34, 0.12, 0.24); ctx.fillRect(d - 0.7, y + 1.62, 0.12, 0.24);
        ctx.strokeStyle = cold; ctx.lineWidth = Math.max(0.045, px * 0.7); ctx.beginPath(); ctx.arc(d + 0.3, y + 1.05, 0.19, 0, TAU); ctx.moveTo(d + 0.11, y + 1.05); ctx.lineTo(d + 0.49, y + 1.05); ctx.moveTo(d + 0.3, y + 0.86); ctx.lineTo(d + 0.3, y + 1.24); ctx.stroke();
      }
      if (s > 15) { ctx.fillStyle = steelL; ctx.beginPath(); for (let k = 0; k < 6; k++) { ctx.rect(d - 0.59, y + 0.2 + k * 0.36, 0.05, 0.05); ctx.rect(d + 0.54, y + 0.2 + k * 0.36, 0.05, 0.05); } ctx.fill(); }
      R4(ctx, d - 0.3, y + 1.6, 0.6, 0.34, c3); if (pw > 0) { ctx.globalAlpha = pw; R4(ctx, d - 0.3, y + 1.6, 0.6, 0.34, glow); ctx.globalAlpha = 1; }
      R4(ctx, d - 0.2, y + 2.66, 0.4, 0.14, ink); circ(ctx, d, y + 2.62, 0.09, pw > 0.5 ? '#fff3c4' : cold);
      if (s > 5) rgSign(ctx, env, S, P, d + 1.7, y + 1.6, 0.3, 'stop');
      if (pw > 0) { rgGlow(ctx, d, y + 2.5, 1.7, '255,222,150', 0.5 * pw); rgGlow(ctx, d, y - 0.35, 4.2, '255,205,120', 0.34 * pw, 0.3); }   // the lamp, and its pool on the doorstep
    }
    if (pw > 0 && slitX.length) {   // light from the slits lying on the snow outside
      const g = ctx.createLinearGradient(0, y, 0, y - 1.8); g.addColorStop(0, 'rgba(255,205,120,' + (0.3 * pw).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,205,120,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath();
      for (let i = 0; i < slitX.length; i++) { const sx = slitX[i]; ctx.moveTo(sx - 0.2, y); ctx.lineTo(sx + 2.4, y); ctx.lineTo(sx + 3.7, y - 1.8); ctx.lineTo(sx - 1.5, y - 1.8); ctx.closePath(); }
      ctx.fill(); ctx.globalCompositeOperation = 'source-over';
    }
    // the roof slab, the shade under it, and a cable clipped along the wall
    ctx.fillStyle = 'rgba(10,14,20,0.15)'; ctx.fillRect(x + 0.04, y + h - 0.32, w - 0.08, 0.32);
    R4(ctx, x - 0.55, y + h, w + 1.1, 0.45, c2);
    if (s > 6) {
      ctx.strokeStyle = ink; ctx.lineWidth = Math.max(0.05, px * 0.6); ctx.beginPath(); ctx.moveTo(x + 0.75, y + 0.95); ctx.lineTo(x + 0.75, y + h - 0.55); ctx.lineTo(xf(y + h) - 0.5, y + h - 0.55); ctx.stroke();
      R4(ctx, x + 0.5, y + 0.6, 0.5, 0.55, steelL); R4(ctx, x + 0.5, y + 1.08, 0.5, 0.07, snow);
    }
    if (o.text) env.text(ctx, o.text, x + (o.textX === undefined ? w * 0.8 : o.textX), y + h * 0.22, Math.min(1.3, h * 0.3), c3, 'center');
    // a stove pipe, and its smoke leaning with the wind
    if (vent !== null) {
      R4(ctx, vent - 0.13, roofY, 0.26, 0.82, ink); R4(ctx, vent - 0.3, roofY + 0.86, 0.6, 0.1, ink); R4(ctx, vent - 0.06, roofY + 0.8, 0.12, 0.08, c3); R4(ctx, vent - 0.2, roofY + 0.36, 0.4, 0.07, c3);
      if (s > 3.5) rgSmoke(ctx, env, vent, roofY + 1.05, { n: 5, rise: 2.6, speed: 0.34, r0: 0.14, r1: 0.66, a: 0.45, col: smoke, lean: 0.5, ph: x * 0.13 });
    }
    // snow on the roof: heaped by the wind, sagging over the edge, icicles under it.
    // A fine grey-blue line along its top keeps it from vanishing against a white hill.
    const nb = Math.max(3, Math.round(w / 3.2));
    const top = () => { ctx.moveTo(x - 0.6, roofY + 0.2); for (let i = 1; i <= nb; i++) { const u0 = (i - 0.5) / nb, u1 = i / nb; ctx.quadraticCurveTo(x - 0.6 + (w + 1.2) * u0 + dir * 0.4, roofY + 0.42 + 0.2 * Math.sin(i * 2.4 + x), x - 0.6 + (w + 1.2) * u1, roofY + 0.32 + 0.13 * Math.sin(i * 1.7 + x)); } };
    ctx.fillStyle = snow; ctx.beginPath(); top(); ctx.lineTo(x + w + 0.6, roofY - 0.05); ctx.lineTo(x - 0.6, roofY - 0.05); ctx.closePath();
    const ex = dir > 0 ? x + w + 0.6 : x - 0.6;   // the cornice hangs off the downwind end
    ctx.moveTo(ex - dir * 0.9, roofY + 0.3); ctx.lineTo(ex + dir * 0.5, roofY + 0.24); ctx.lineTo(ex + dir * 0.42, roofY - 0.2); ctx.lineTo(ex, roofY - 0.1); ctx.closePath();
    if (s > 6) for (let k = 0; k < nb; k++) { const xx = x + ((k + 0.2 + 0.6 * rgHash(k * 3 + x)) * w) / nb; ctx.moveTo(xx - 0.55, roofY); ctx.lineTo(xx + 0.5, roofY); ctx.lineTo(xx + 0.32, roofY - 0.24); ctx.lineTo(xx - 0.3, roofY - 0.3); ctx.closePath(); }
    ctx.fill();
    if (s > 4) { ctx.strokeStyle = snowSh; ctx.lineWidth = Math.max(0.035, px * 0.6); ctx.beginPath(); top(); ctx.stroke(); }
    if (s > 7) { ctx.fillStyle = ice; ctx.beginPath(); rgIcicles(ctx, env, x - 0.45, x + w + 0.45, y + h, 0.55, 0.42, x * 3.3); ctx.fill(); }
    if (s > 2.5) { rgSpill(ctx, env, ex + dir * 0.3, roofY + 0.3, 1.3, x, snowSh); rgSpill(ctx, env, x + w * 0.5, roofY + 0.45, 0.8, x + 7, snowSh); }   // snow blowing off the roof
    // drifts against the foot of the wall, deepest at the downwind end
    ctx.fillStyle = snow; ctx.beginPath();
    ctx.moveTo(x - 3.0 - (dir < 0 ? 1.6 : 0), y); ctx.lineTo(x - 0.9, y); ctx.lineTo(x - 0.55, y + (dir < 0 ? 1.2 : 0.8)); ctx.closePath();
    ctx.moveTo(x + w + 3.0 + (dir > 0 ? 1.6 : 0), y); ctx.lineTo(x + w + 0.9, y); ctx.lineTo(x + w + 0.5, y + (dir > 0 ? 1.2 : 0.75)); ctx.closePath();
    for (let k = 0; k < nb; k++) { const xx = x + ((k + 0.5 * rgHash(k * 7 + x) + 0.25) * w) / nb; if (d !== undefined && Math.abs(xx - d) < 2.4) continue; rgLens(ctx, xx, y, 1.1 + rgHash(k + x) * 1.2, 0.2 + 0.14 * rgHash(k * 2 + x), 0, dir * 0.4); }
    ctx.fill();
  } });
  P.solid(x, y, w, h + 0.45, o.mat || 'wall', { bid: id });
  return { id, x, w, h, y, roofY: roofY + 0.2, P, zone: id + ':roof', on: (xx, extra) => Object.assign({ plane: P, x: xx, y: roofY + 0.2, zone: id + ':roof', room: null, behind: false }, extra || {}) };
};

// A watch tower: lattice legs on concrete feet, a ladder, an open cab with a
// knee-high plank rail, a tin roof under snow. Whoever is inside shows from
// the hips up. T.at(dx) is a placement.
// On the roof a pennant streams with the wind. At the side hangs a
// searchlight: after dark its beam shows in the air, and in falling snow you
// can see the flakes cross it.
K.watch = function (S, P, x, h, o) {
  o = o || {};
  const y = o.y || 0, w = o.w || 4, id = o.id || ('wt' + Math.round(x)), rail = 0.8, f = y + h, L = rgSun(S), hexW = o.col || '#6b5f52';
  const steel = S.tone('#39414b', P), steelB = S.tone('#5f6975', P), wood = S.tone(hexW, P), woodD = S.tone(darken(hexW, 0.32), P), woodL = S.tone(lighten(hexW, 0.2), P), snow = S.tone('#f4f7fa', P), snowSh = S.tone('#a9bace', P), sh = S.tone(mix(S.pal.ground, '#6f86a8', 0.34), P);
  const tin = S.tone('#56606b', P), ice = S.tone('#cfe2f2', P), ink = S.tone('#20242b', P), conc = S.tone('#8b9299', P), pen = S.tone('#1f3350', P), penW = S.tone('#f1ede2', P), cold = S.tone('#cfd6dc', P);
  const room = S.room(id, false), lx = x - w / 2, rx = x + w / 2, sp = o.spread === undefined ? 0.9 : o.spread;
  P.add({ x0: x - w - 12, x1: x + w + 12, layer: 0, draw(ctx, env) {
    const s = env.s, px = env.px, kx = L.side * L.kx, ky = L.ky;
    // its shadow on the snow: two legs and the box of the cab
    ctx.strokeStyle = sh; ctx.lineWidth = Math.max(0.24, px); ctx.beginPath();
    ctx.moveTo(lx - sp, y - 0.05); ctx.lineTo(lx + 0.2 + kx * h, y - 0.05 - ky * h); ctx.moveTo(rx + sp, y - 0.05); ctx.lineTo(rx - 0.2 + kx * h, y - 0.05 - ky * h); ctx.stroke();
    ctx.fillStyle = sh; ctx.beginPath(); rgCast(ctx, L, y, [lx - 0.3, h - 0.24, rx + 0.3, h - 0.24, rx, h + rail, lx, h + rail]); rgCast(ctx, L, y, [lx - 0.7, h + 2.6, rx + 0.7, h + 2.6, x, h + 3.6]); ctx.fill();
    // concrete feet, half buried
    R4(ctx, lx - sp - 0.45, y, 0.9, 0.3, conc); R4(ctx, rx + sp - 0.45, y, 0.9, 0.3, conc);
    ctx.fillStyle = snow; ctx.beginPath(); rgLens(ctx, lx - sp, y + 0.02, 1.2, 0.22, 0, 0); rgLens(ctx, rx + sp, y + 0.02, 1.2, 0.22, 0, 0); ctx.fill();
    if (s > 3) {   // the two legs on the far side
      ctx.strokeStyle = steelB; ctx.lineWidth = Math.max(0.12, px * 0.8); ctx.beginPath();
      ctx.moveTo(lx + 0.85, f); ctx.lineTo(lx + 0.35 - sp * 0.4, y + 0.1); ctx.moveTo(rx - 0.85, f); ctx.lineTo(rx - 0.35 + sp * 0.4, y + 0.1);
      ctx.moveTo(lerp(lx + 0.35 - sp * 0.4, lx + 0.85, 0.5), y + h * 0.5); ctx.lineTo(lerp(rx - 0.35 + sp * 0.4, rx - 0.85, 0.5), y + h * 0.5); ctx.stroke();
    }
    line(ctx, lx + 0.2, f, lx - sp, y, steel, 0.2, env); line(ctx, rx - 0.2, f, rx + sp, y, steel, 0.2, env);
    ctx.strokeStyle = steel; ctx.lineWidth = Math.max(0.08, px * 0.9); ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = k / 3, b = (k + 1) / 3, la = lerp(lx - sp, lx + 0.2, a), ra = lerp(rx + sp, rx - 0.2, a), lb = lerp(lx - sp, lx + 0.2, b), rb = lerp(rx + sp, rx - 0.2, b);
      ctx.moveTo(la, y + h * a); ctx.lineTo(rb, y + h * b); ctx.moveTo(ra, y + h * a); ctx.lineTo(lb, y + h * b); ctx.moveTo(lb, y + h * b); ctx.lineTo(rb, y + h * b);
    }
    ctx.stroke();
    if (s > 7) {   // snow lying along the cross members, and plates where they meet the legs
      ctx.strokeStyle = snow; ctx.lineWidth = Math.max(0.05, px * 0.6); ctx.beginPath();
      for (let k = 1; k < 3; k++) { const b = k / 3; ctx.moveTo(lerp(lx - sp, lx + 0.2, b) + 0.15, y + h * b + 0.09); ctx.lineTo(lerp(rx + sp, rx - 0.2, b) - 0.15, y + h * b + 0.09); }
      ctx.stroke();
      ctx.fillStyle = steel; ctx.beginPath(); for (let k = 1; k < 3; k++) { const b = k / 3; ctx.rect(lerp(lx - sp, lx + 0.2, b) - 0.16, y + h * b - 0.16, 0.32, 0.32); ctx.rect(lerp(rx + sp, rx - 0.2, b) - 0.16, y + h * b - 0.16, 0.32, 0.32); } ctx.fill();
    }
    if (s > 3) {   // the ladder
      ctx.strokeStyle = steel; ctx.lineWidth = Math.max(0.05, px * 0.6); ctx.beginPath(); ctx.moveTo(x - 0.3, y); ctx.lineTo(x - 0.3, f); ctx.moveTo(x + 0.3, y); ctx.lineTo(x + 0.3, f);
      for (let yy = y + 0.4; yy < f; yy += 0.45) { ctx.moveTo(x - 0.3, yy); ctx.lineTo(x + 0.3, yy); }
      ctx.stroke();
    }
    R4(ctx, lx - 0.3, f - 0.24, w + 0.6, 0.24, steel); R4(ctx, lx - 0.3, f - 0.07, w + 0.6, 0.07, steelB);
    // the cab: plank rail, corner posts, braces under the roof, a radio on the post
    R4(ctx, lx, f, w, rail, wood);
    if (s > 9) { ctx.fillStyle = woodL; ctx.globalAlpha = 0.3; ctx.beginPath(); for (let k = 0; lx + k * 0.5 < rx - 0.1; k += 2) ctx.rect(lx + k * 0.5 + 0.04, f + 0.03, 0.44, rail - 0.16); ctx.fill(); ctx.globalAlpha = 1; }
    R4(ctx, lx, f + rail - 0.12, w, 0.12, woodD);
    if (s > 6) { ctx.fillStyle = woodD; for (let xx = lx + 0.5; xx < rx; xx += 0.5) ctx.fillRect(xx, f, 0.04, rail - 0.12); R4(ctx, lx, f + rail - 0.02, w, 0.045, snow); }
    line(ctx, lx + 0.07, f + rail, lx + 0.07, f + 2.65, woodD, 0.14, env); line(ctx, rx - 0.07, f + rail, rx - 0.07, f + 2.65, woodD, 0.14, env);
    if (s > 7) {
      ctx.strokeStyle = woodD; ctx.lineWidth = Math.max(0.07, px * 0.7); ctx.beginPath(); ctx.moveTo(lx + 0.1, f + 2.12); ctx.lineTo(lx + 0.58, f + 2.6); ctx.moveTo(rx - 0.1, f + 2.12); ctx.lineTo(rx - 0.58, f + 2.6); ctx.stroke();
      R4(ctx, lx + 0.15, f + 1.3, 0.28, 0.36, ink); if (s > 12) { R4(ctx, lx + 0.19, f + 1.5, 0.2, 0.1, steelB); line(ctx, lx + 0.38, f + 1.66, lx + 0.44, f + 2.05, ink, 0.02, env); }
    }
  } });
  P.add({ x0: x - w - 12, x1: x + w + 12, layer: 1, draw(ctx, env) {
    const s = env.s, px = env.px, pw = rgPower(S, env), wv = env.wind, a = Math.min(1, Math.abs(wv) / 8), dir = wv < 0 ? -1 : 1, t = env.t;
    // the tin roof: a dark fascia board along the eave, the slope above it
    poly(ctx, [lx - 0.7, f + 2.6, rx + 0.7, f + 2.6, rx + 0.15, f + 3.2, lx - 0.15, f + 3.2], tin); R4(ctx, lx - 0.72, f + 2.56, w + 1.44, 0.16, woodD);
    // snow on the roof: it follows the slope, lies thickest just downwind of the
    // ridge and curls over the downwind eave. Its front edge is in shade, a blue
    // band that keeps the white roof from melting into a white valley.
    const ex = dir > 0 ? rx + 0.75 : lx - 0.75, rise = 0.2 + 0.12 * a;
    const cap = () => { ctx.moveTo(lx - 0.8, f + 2.74); ctx.lineTo(lx - 0.22, f + 3.26); ctx.quadraticCurveTo(x + dir * 0.7, f + 3.26 + rise * 2, rx + 0.22, f + 3.28); ctx.lineTo(rx + 0.8, f + 2.74); };
    ctx.fillStyle = snow; ctx.beginPath(); cap(); ctx.closePath();
    ctx.moveTo(ex - dir * 0.6, f + 2.9); ctx.lineTo(ex + dir * 0.38, f + 2.86); ctx.quadraticCurveTo(ex + dir * 0.42, f + 2.6, ex + dir * 0.22, f + 2.48); ctx.lineTo(ex - dir * 0.1, f + 2.62); ctx.closePath(); ctx.fill();
    if (s > 3) { poly(ctx, [lx - 0.8, f + 2.74, rx + 0.8, f + 2.74, rx + 0.66, f + 2.86, lx - 0.66, f + 2.86], snowSh); }
    if (s > 4) { ctx.strokeStyle = snowSh; ctx.lineWidth = Math.max(0.035, px * 0.6); ctx.beginPath(); cap(); ctx.stroke(); }
    if (s > 7) { ctx.fillStyle = ice; ctx.beginPath(); rgIcicles(ctx, env, lx - 0.6, rx + 0.6, f + 2.56, 0.36, 0.3, x * 1.7); ctx.fill(); }
    if (s > 2.5) rgSpill(ctx, env, ex, f + 3.0, 1, x, snowSh);   // loose snow torn off the downwind eave
    // a pennant on the roof: it streams with the wind and hangs without it, and
    // the stronger it blows the faster it ripples
    if (s > 2.2) {
      const sx = x - w * 0.3, top = f + 4.65, len = 1.45 * (0.32 + 0.68 * a), hg = 0.48, droop = (1 - a) * 0.95, sp = t * (4 + 11 * a) + x, w1 = Math.sin(sp) * 0.1 * (0.3 + a), w2 = Math.sin(sp - 2.1) * 0.15 * (0.3 + a);
      line(ctx, sx, f + 3.3, sx, top + 0.08, steel, 0.06, env);
      ctx.fillStyle = pen; ctx.beginPath(); ctx.moveTo(sx, top); ctx.quadraticCurveTo(sx + dir * len * 0.5, top - droop * 0.35 + w1, sx + dir * len, top - hg * 0.5 - droop + w2); ctx.quadraticCurveTo(sx + dir * len * 0.5, top - hg - droop * 0.35 + w1, sx, top - hg); ctx.closePath(); ctx.fill();
      if (s > 5) { ctx.strokeStyle = penW; ctx.lineWidth = Math.max(0.06, hg * 0.22); ctx.beginPath(); ctx.moveTo(sx, top - hg * 0.5); ctx.quadraticCurveTo(sx + dir * len * 0.4, top - hg * 0.5 - droop * 0.3 + w1, sx + dir * len * 0.72, top - hg * 0.5 - droop * 0.62 + (w1 + w2) * 0.5); ctx.stroke(); }
    }
    // the searchlight on its bracket
    const bx = rx + 0.56, by = f + 2.16;
    line(ctx, rx - 0.05, by + 0.3, rx + 0.3, by + 0.05, steel, 0.07, env);
    R4(ctx, rx + 0.05, f + 1.95, 0.5, 0.42, steel); circ(ctx, bx, by, 0.2, pw > 0.5 ? '#fff3c4' : cold);
    if (s > 6) { ctx.strokeStyle = ink; ctx.lineWidth = Math.max(0.03, px * 0.5); ctx.beginPath(); ctx.arc(bx, by, 0.2, 0, TAU); ctx.stroke(); R4(ctx, rx + 0.05, f + 2.37, 0.56, 0.06, snow); }
    if (pw > 0.02 && s > 2.2) {
      // the beam: brightest at the lamp, fading out along its length
      const an = -0.66 + 0.11 * Math.sin(t * 0.23 + x), ca = Math.cos(an), sa = Math.sin(an), len = 11, k = (S.weather === 'snow' ? 1 : 0.6) * pw, ex2 = bx + ca * len, ey2 = by + sa * len;
      const g = ctx.createLinearGradient(bx, by, ex2, ey2); g.addColorStop(0, 'rgba(255,240,200,' + (0.34 * k).toFixed(3) + ')'); g.addColorStop(0.35, 'rgba(255,240,200,' + (0.13 * k).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(bx + sa * 0.16, by - ca * 0.16); ctx.lineTo(bx - sa * 0.16, by + ca * 0.16); ctx.lineTo(ex2 - sa * 1.9, ey2 + ca * 1.9); ctx.lineTo(ex2 + sa * 1.9, ey2 - ca * 1.9); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      rgGlow(ctx, bx, by, 1.2, '255,236,185', 0.6 * pw);
      if (S.weather === 'snow' && s > 5) {   // flakes crossing the beam
        ctx.fillStyle = '#ffffff'; const sz = Math.max(0.05, px * 1.2);
        for (let j = 0; j < 9; j++) { const u = (j * 0.37 + t * 0.07) % 1, v = (((j * 0.61 + t * (0.25 + wv * 0.06)) % 1) + 1) % 1 - 0.5, hw = 0.16 + u * 1.74; ctx.globalAlpha = 0.85 * pw * (1 - u * 0.8); ctx.fillRect(bx + ca * u * len - sa * v * 2 * hw, by + sa * u * len + ca * v * 2 * hw, sz, sz); }
        ctx.globalAlpha = 1;
      }
    }
  } });
  P.solid(lx, f - 0.24, w, rail + 0.24, 'wood');
  P.solid(lx - 0.7, f + 2.6, w + 1.4, 0.7, 'thin');
  P.open({ x: lx, y: f + rail, w, h: 1.8, room: room.id, glass: false, through: true });
  return { id, x, w, floor: f, room: room.id, zone: room.id, P, at: (dx, extra) => Object.assign({ plane: P, x: x + (dx || 0), y: f, room: room.id, zone: room.id, behind: true }, extra || {}) };
};

// A search radar: an equipment hut, a lattice pedestal with a platform, and a
// ribbed dish that turns slowly. From the front you see the bowl and the feed
// horn held out on its struts; from behind, the frame.
K.radar = function (S, P, x, o) {
  o = o || {}; const y = o.y || 0, h = o.h || 8, L = rgSun(S);
  const steel = S.tone('#414a55', P), steelL = S.tone('#6a7581', P), hut = S.tone('#7d858d', P), hutD = S.tone('#666e77', P), hutL = S.tone('#939aa1', P), dishC = S.tone('#d5dbe1', P), dishD = S.tone('#8f99a4', P), red = S.tone('#c8372d', P), snow = S.tone('#f4f7fa', P), sh = S.tone(mix(S.pal.ground, '#6f86a8', 0.34), P), ink = S.tone('#20242b', P), ice = S.tone('#cfe2f2', P), glow = S.tone('#ffd98a', P, true);
  const cy = y + h + 2.1, a0 = 0.896;
  P.add({ x0: x - 12, x1: x + 12, layer: 0, draw(ctx, env) {
    const s = env.s, px = env.px, pw = rgPower(S, env), th = env.t * 0.55, cw = Math.cos(th), sw = Math.sin(th), wd = Math.abs(cw) * 2.9 + 0.22, front = cw > 0;
    ctx.fillStyle = sh; ctx.beginPath(); rgCast(ctx, L, y, [x - 2.6, 0, x + 2.6, 0, x + 2.6, 2.6, x - 2.6, 2.6]); rgCast(ctx, L, y, [x - 1.1, 2.5, x + 1.1, 2.5, x + 0.4, h, x - 0.4, h]); rgCast(ctx, L, y, [x - wd, h + 2.1, x, h + 0.7, x + wd, h + 2.1, x, h + 3.5]); ctx.fill();
    // the hut: insulated panels, a door, a louvre, a warning plate
    R4(ctx, x - 2.4, y, 4.8, 2.2, hut); R4(ctx, x + 1.9, y, 0.5, 2.2, hutD); R4(ctx, x - 2.4, y + 1.5, 4.3, 0.7, hutL); R4(ctx, x - 2.5, y, 5.0, 0.22, hutD);
    if (s > 6) { ctx.fillStyle = hutD; for (let k = 1; k < 4; k++) ctx.fillRect(x - 2.4 + k * 1.2, y + 0.22, 0.05, 1.98); }
    R4(ctx, x - 2.05, y + 0.22, 0.95, 1.7, steel); R4(ctx, x - 1.85, y + 1.3, 0.55, 0.4, pw > 0.5 ? glow : ink);
    R4(ctx, x + 0.45, y + 1.15, 1.1, 0.62, hutD);
    if (s > 10) { ctx.fillStyle = steel; for (let k = 0; k < 4; k++) ctx.fillRect(x + 0.5, y + 1.2 + k * 0.14, 1.0, 0.05); ctx.fillStyle = hutL; ctx.fillRect(x - 1.2, y + 1.0, 0.07, 0.2); }
    if (s > 5) rgSign(ctx, env, S, P, x - 0.45, y + 1.02, 0.3, 'wave');
    R4(ctx, x - 2.6, y + 2.2, 5.2, 0.3, steel); poly(ctx, [x - 2.6, y + 2.5, x + 2.6, y + 2.5, x + 2.2, y + 2.85, x - 2.2, y + 2.85], snow);
    if (s > 7) { ctx.fillStyle = ice; ctx.beginPath(); rgIcicles(ctx, env, x - 2.5, x + 2.5, y + 2.2, 0.4, 0.36, x); ctx.fill(); }
    // the pedestal: legs, bracing, a cable, a platform with a rail
    line(ctx, x - 1.1, y + 2.5, x - 0.35, y + h, steel, 0.16, env); line(ctx, x + 1.1, y + 2.5, x + 0.35, y + h, steel, 0.16, env);
    ctx.strokeStyle = steel; ctx.lineWidth = Math.max(0.07, px * 0.9); ctx.beginPath();
    for (let k = 0; k < 3; k++) { const a = y + 2.5 + ((h - 2.5) * k) / 3, b = y + 2.5 + ((h - 2.5) * (k + 1)) / 3; ctx.moveTo(x - 1.1 + 0.25 * k, a); ctx.lineTo(x + 1.1 - 0.25 * (k + 1), b); ctx.moveTo(x + 1.1 - 0.25 * k, a); ctx.lineTo(x - 1.1 + 0.25 * (k + 1), b); ctx.moveTo(x - 1.1 + 0.25 * (k + 1), b); ctx.lineTo(x + 1.1 - 0.25 * (k + 1), b); }
    ctx.stroke();
    if (s > 6) {
      line(ctx, x + 0.75, y + 2.85, x + 0.12, y + h, ink, 0.05, env);
      ctx.strokeStyle = steelL; ctx.lineWidth = Math.max(0.045, px * 0.6); ctx.beginPath(); ctx.moveTo(x - 1.15, y + h - 0.1); ctx.lineTo(x - 1.15, y + h + 0.85); ctx.lineTo(x - 0.5, y + h + 0.85); ctx.moveTo(x + 1.15, y + h - 0.1); ctx.lineTo(x + 1.15, y + h + 0.85); ctx.lineTo(x + 0.5, y + h + 0.85); ctx.stroke();
    }
    R4(ctx, x - 1.2, y + h - 0.16, 2.4, 0.16, steel); R4(ctx, x - 0.42, y + h, 0.84, 0.72, steel); R4(ctx, x - 0.42, y + h + 0.5, 0.84, 0.08, steelL);
    // the feed horn sits out in front of the bowl, so it swings from side to side as the dish turns
    const fx = x + sw * 2.0, fy = cy - 0.35;
    const feed = () => { ctx.strokeStyle = steel; ctx.lineWidth = Math.max(0.06, px * 0.7); ctx.beginPath(); ctx.moveTo(x - wd * 0.55, cy - 1.15); ctx.lineTo(fx, fy); ctx.moveTo(x + wd * 0.55, cy - 1.15); ctx.lineTo(fx, fy); ctx.moveTo(x, cy + 1.1); ctx.lineTo(fx, fy); ctx.stroke(); R4(ctx, fx - 0.17, fy - 0.17, 0.34, 0.34, ink); };
    if (!front && s > 4) feed();
    // the dish: a slice of a bowl, wider than it is tall
    ctx.fillStyle = front ? dishC : dishD; ctx.beginPath(); ctx.ellipse(x, cy, wd, 1.6, 0, -a0, a0); ctx.ellipse(x, cy, wd, 1.6, 0, Math.PI - a0, Math.PI + a0); ctx.closePath(); ctx.fill();
    if (wd > 0.7) {
      ctx.fillStyle = front ? dishD : steelL; ctx.globalAlpha = front ? 0.55 : 0.5; ctx.beginPath(); ctx.ellipse(x - sw * 0.25, cy, wd * 0.74, 1.05, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      if (s > 4.5) {   // ribs
        ctx.strokeStyle = front ? dishD : steel; ctx.lineWidth = Math.max(front ? 0.04 : 0.07, px * 0.6); ctx.beginPath();
        for (let k = -2; k <= 2; k++) { const u = k * 0.31, xx = x + u * wd, hh = Math.min(1.25, 1.6 * Math.sqrt(1 - u * u)); ctx.moveTo(xx, cy - hh); ctx.lineTo(xx, cy + hh); }
        ctx.moveTo(x - wd * 0.92, cy + 0.62); ctx.lineTo(x + wd * 0.92, cy + 0.62); ctx.moveTo(x - wd * 0.92, cy - 0.62); ctx.lineTo(x + wd * 0.92, cy - 0.62);
        if (!front) { ctx.moveTo(x - wd * 0.62, cy - 1.2); ctx.lineTo(x + wd * 0.62, cy + 1.2); ctx.moveTo(x + wd * 0.62, cy - 1.2); ctx.lineTo(x - wd * 0.62, cy + 1.2); }
        ctx.stroke();
      }
      R4(ctx, x - wd, cy - 0.08, wd * 2, 0.16, red);
      if (s > 7) R4(ctx, x - wd * 0.86, cy + 1.2, wd * 1.72, 0.07, snow);   // rime along the top edge
    }
    if (front && s > 4) feed();
    // a red light on top that breathes rather than blinks
    const b = smooth(0.5 + 0.8 * Math.sin(env.t * 1.9));
    line(ctx, x, cy + 1.25, x, cy + 1.6, steel, 0.06, env); circ(ctx, x, cy + 1.6, 0.13, b > 0.5 ? '#ff4a3d' : S.tone('#7d2620', P));
    if (S.pal.dark > 0.3 && s > 4) rgGlow(ctx, x, cy + 1.6, 1.3, '255,74,61', 0.5 * b);
  } });
  P.solid(x - 2.4, y, 4.8, 2.5, 'wall'); P.solid(x - 1.1, y + 2.5, 2.2, h - 2.5, 'grid');
  return { x, top: y + h + 3.7, roofY: y + 2.85 };
};

// A radio mast: lattice painted in red and white bands, guy wires down to
// concrete anchors, aerials, rime ice on the side the wind comes from, a
// breathing red light on top, and a cup anemometer that spins as fast as the
// wind blows beside a vane that points into it.
K.mast = function (S, P, x, h, o) {
  o = o || {}; const y = o.y || 0, L = rgSun(S), steel = S.tone('#3f4852', P), red = S.tone('#c8372d', P), white = S.tone('#d5dce3', P), redD = S.tone('#8f251e', P), whiteD = S.tone('#a3adb8', P), ink = S.tone('#20242b', P), snow = S.tone('#f4f7fa', P), sh = S.tone(mix(S.pal.ground, '#6f86a8', 0.34), P), conc = S.tone('#8b9299', P), box = S.tone('#6f7780', P);
  const guys = [[0.92, 0.42], [0.62, 0.3], [0.34, 0.18]];
  P.add({ x0: x - h * 0.9, x1: x + h * 0.9, layer: 0, draw(ctx, env) {
    const s = env.s, px = env.px, t = env.t, wv = env.wind, dir = wv < 0 ? -1 : 1, a = Math.min(1, Math.abs(wv) / 8);
    line(ctx, x, y - 0.05, x + L.side * L.kx * h, y - 0.05 - L.ky * h, sh, 0.34, env);
    // guy wires, each sagging a little, down to its anchor
    ctx.strokeStyle = steel; ctx.lineWidth = Math.max(0.04, px * 0.6); ctx.beginPath();
    for (let g = 0; g < 3; g++) for (let k = -1; k <= 1; k += 2) { const ax = k * guys[g][1] * h; ctx.moveTo(x, y + h * guys[g][0]); ctx.quadraticCurveTo(x + ax * 0.52, y + h * guys[g][0] * 0.44, x + ax, y + 0.3); }
    ctx.stroke();
    if (s > 3) {
      for (let g = 0; g < 3; g++) for (let k = -1; k <= 1; k += 2) { const ax = x + k * guys[g][1] * h; R4(ctx, ax - 0.4, y, 0.8, 0.36, conc); }
      ctx.fillStyle = snow; ctx.beginPath(); for (let g = 0; g < 3; g++) for (let k = -1; k <= 1; k += 2) rgLens(ctx, x + k * guys[g][1] * h, y + 0.34, 0.6, 0.14, 0, 0); ctx.fill();
    }
    if (s > 8) {   // hoar frost strung along the upper wires
      ctx.strokeStyle = snow; ctx.lineWidth = Math.max(0.05, px * 0.8); ctx.beginPath();
      for (let k = -1; k <= 1; k += 2) for (let u = 0.12; u < 0.9; u += 0.11) { const q = (v) => { const ax = k * guys[0][1] * h, m = 1 - v; return [x * m * m + 2 * m * v * (x + ax * 0.52) + v * v * (x + ax), (y + h * guys[0][0]) * m * m + 2 * m * v * (y + h * guys[0][0] * 0.44) + v * v * (y + 0.3)]; }, p0 = q(u), p1 = q(u + 0.04); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); }
      ctx.stroke();
    }
    // the mast itself: flat bands from far off, lattice up close
    if (s < 5) { for (let k = 0; k < 6; k++) R4(ctx, x - 0.22, y + (h * k) / 6, 0.44, h / 6, k % 2 ? white : red); }
    else {
      for (let k = 0; k < 6; k++) {
        const ya = y + (h * k) / 6, hb = h / 6, col = k % 2 ? white : red, colD = k % 2 ? whiteD : redD;
        ctx.fillStyle = colD; ctx.fillRect(x - 0.13, ya, 0.26, hb);
        ctx.fillStyle = col; ctx.fillRect(x - 0.26, ya, 0.1, hb); ctx.fillRect(x + 0.16, ya, 0.1, hb);
        if (s > 9) { ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.035, px * 0.5); ctx.beginPath(); for (let j = 0; j < 4; j++) { const yb = ya + (hb * j) / 4; ctx.moveTo(x - 0.2, yb); ctx.lineTo(x + 0.2, yb + hb / 8); ctx.lineTo(x - 0.2, yb + hb / 4); } ctx.stroke(); }
      }
    }
    if (s > 3.5) {
      // aerials: two folded dipoles and a small drum
      ctx.strokeStyle = steel; ctx.lineWidth = Math.max(0.05, px * 0.7); ctx.beginPath();
      ctx.moveTo(x, y + h * 0.82); ctx.lineTo(x - 1.25, y + h * 0.82); ctx.moveTo(x - 1.25, y + h * 0.82 - 0.55); ctx.lineTo(x - 1.25, y + h * 0.82 + 0.55); ctx.moveTo(x - 0.7, y + h * 0.82 - 0.4); ctx.lineTo(x - 0.7, y + h * 0.82 + 0.4);
      ctx.moveTo(x, y + h * 0.56); ctx.lineTo(x + 1.15, y + h * 0.56); ctx.moveTo(x + 1.15, y + h * 0.56 - 0.5); ctx.lineTo(x + 1.15, y + h * 0.56 + 0.5); ctx.stroke();
      circ(ctx, x + 0.62, y + h * 0.7, 0.45, ink); circ(ctx, x + 0.62, y + h * 0.7, 0.37, whiteD); circ(ctx, x + 0.56, y + h * 0.7 + 0.06, 0.2, white);
      // rime: ice grows out toward the wind on the top third
      ctx.fillStyle = snow; ctx.beginPath();
      for (let yy = y + h * 0.66; yy < y + h - 0.2; yy += 0.7) { const g = 0.25 + 0.4 * rgHash(yy * 3.7 + x); ctx.moveTo(x - dir * 0.24, yy); ctx.lineTo(x - dir * (0.26 + g), yy + 0.25); ctx.lineTo(x - dir * 0.24, yy + 0.62); ctx.closePath(); }
      ctx.fill();
      // a cabinet at the foot, and the feeder cable
      R4(ctx, x + 0.6, y, 0.85, 0.95, box); R4(ctx, x + 0.6, y + 0.93, 0.85, 0.12, snow); if (s > 9) { R4(ctx, x + 0.68, y + 0.1, 0.3, 0.7, steel); line(ctx, x + 0.7, y + 0.95, x + 0.2, y + 1.6, ink, 0.04, env); }
    }
    // the top: a spike, a cross arm, the cups on one end and the vane on the other
    line(ctx, x, y + h, x, y + h + 1.6, steel, 0.08, env);
    if (s > 3.5) {
      const ay = y + h + 1.0; line(ctx, x - 0.85, ay, x + 0.85, ay, steel, 0.05, env); line(ctx, x - 0.85, ay, x - 0.85, ay + 0.3, steel, 0.04, env); line(ctx, x + 0.85, ay, x + 0.85, ay + 0.3, steel, 0.04, env);
      const sp = t * (1.2 + Math.abs(wv) * 1.5);
      ctx.fillStyle = ink; ctx.beginPath(); for (let k = 0; k < 3; k++) { const an = sp + k * 2.094, cxk = Math.cos(an) * 0.34; ctx.rect(x - 0.85 + Math.min(0, cxk), ay + 0.29, Math.abs(cxk), 0.035); ctx.moveTo(x - 0.85 + cxk + 0.1, ay + 0.3); ctx.arc(x - 0.85 + cxk, ay + 0.3, 0.075 + 0.03 * Math.sin(an), 0, TAU); } ctx.fill();
      const wob = Math.sin(t * 2.3) * 0.05 * (1.2 - a), vx = x + 0.85, vy = ay + 0.3;
      ctx.strokeStyle = ink; ctx.lineWidth = Math.max(0.04, px * 0.7); ctx.beginPath(); ctx.moveTo(vx - dir * 0.5, vy - wob); ctx.lineTo(vx + dir * 0.45, vy + wob); ctx.stroke();
      poly(ctx, [vx + dir * 0.3, vy + wob * 0.6, vx + dir * 0.7, vy + 0.2 + wob, vx + dir * 0.7, vy - 0.2 + wob], red);
    }
    // warning lights: a steady one half way up, and the top one, which swells and fades
    circ(ctx, x, y + h * 0.5, 0.13, '#e0362c');
    const b = smooth(0.5 + 0.9 * Math.sin(t * 2.6));
    circ(ctx, x, y + h + 0.1, 0.24, b > 0.45 ? '#ff4a3d' : redD);
    if (S.pal.dark > 0.3 && s > 3) { rgGlow(ctx, x, y + h + 0.1, 1.9, '255,74,61', 0.6 * b); rgGlow(ctx, x, y + h * 0.5, 0.9, '255,74,61', 0.4); }
  } });
  P.solid(x - 0.22, y, 0.44, h, 'hard');
  return { x, top: y + h };
};

// A windsock: the plainest wind gauge on the station. It hangs limp in a
// calm, lifts as the wind rises and stands straight out in a gale, pointing
// where the wind is going. The cloth is drawn with a shaded underside and a
// dark edge so the white bands do not vanish against the snow.
K.windsock = function (S, P, x, h, o) {
  o = o || {}; const y = o.y || 0, len = o.len || 3.6, mouth = o.mouth || 0.58, n = 5;
  const pole = S.tone('#4a535e', P), a0 = S.tone('#e8672c', P), a0d = S.tone('#b54a1c', P), a1 = S.tone('#f4f1ea', P), a1d = S.tone('#c2c4c8', P), ink = S.tone('#20242b', P), conc = S.tone('#8b9299', P), snow = S.tone('#f4f7fa', P);
  const cx = new Array(n + 1), cyv = new Array(n + 1), nx = new Array(n + 1), ny = new Array(n + 1);
  P.add({ x0: x - len - 2, x1: x + len + 2, layer: 2, draw(ctx, env) {
    const s = env.s, px = env.px, w = env.wind, a = Math.pow(Math.min(1, Math.abs(w) / 10), 0.85), dir = w >= 0 ? 1 : -1, top = y + h - mouth, t = env.t;
    if (s > 3) { R4(ctx, x - 0.3, y, 0.6, 0.22, conc); ctx.fillStyle = snow; ctx.beginPath(); rgLens(ctx, x, y + 0.2, 0.6, 0.13, 0, 0); ctx.fill(); }
    line(ctx, x, y, x, y + h, pole, 0.11, env);
    if (s > 5) { R4(ctx, x - 0.07, y + h * 0.55, 0.14, 0.5, a0); R4(ctx, x - 0.07, y + h * 0.55 + 0.5, 0.14, 0.5, a1); }
    // the middle line of the sock, then its width across that line
    for (let i = 0; i <= n; i++) {
      const u = i / n, fl = Math.sin(t * (3 + a * 9) - u * 4.5) * 0.14 * (0.25 + a) * u;
      cx[i] = x + dir * (0.12 + u * len * (0.2 + 0.8 * a)); cyv[i] = top - Math.pow(1 - a, 1.3) * u * u * len * 0.85 + fl;
    }
    for (let i = 0; i <= n; i++) { const tx = cx[Math.min(n, i + 1)] - cx[Math.max(0, i - 1)], ty = cyv[Math.min(n, i + 1)] - cyv[Math.max(0, i - 1)], l = Math.hypot(tx, ty) || 1; nx[i] = (-ty / l) * dir; ny[i] = (tx / l) * dir; }
    const r = (i) => lerp(mouth, mouth * 0.42, i / n);
    for (let i = 0; i < n; i++) {
      const r0 = r(i), r1 = r(i + 1), x0 = cx[i], y0 = cyv[i], x1 = cx[i + 1], y1 = cyv[i + 1];
      poly(ctx, [x0 + nx[i] * r0, y0 + ny[i] * r0, x1 + nx[i + 1] * r1, y1 + ny[i + 1] * r1, x1 - nx[i + 1] * r1, y1 - ny[i + 1] * r1, x0 - nx[i] * r0, y0 - ny[i] * r0], i % 2 ? a1 : a0);
      poly(ctx, [x0 - nx[i] * r0 * 0.3, y0 - ny[i] * r0 * 0.3, x1 - nx[i + 1] * r1 * 0.3, y1 - ny[i + 1] * r1 * 0.3, x1 - nx[i + 1] * r1, y1 - ny[i + 1] * r1, x0 - nx[i] * r0, y0 - ny[i] * r0], i % 2 ? a1d : a0d);
    }
    if (s > 3.5) {   // a dark edge all round, and the hoop that holds the mouth open
      ctx.strokeStyle = ink; ctx.globalAlpha = 0.55; ctx.lineWidth = Math.max(0.035, px * 0.6); ctx.beginPath();
      for (let i = 0; i <= n; i++) { const q = r(i); if (i) ctx.lineTo(cx[i] + nx[i] * q, cyv[i] + ny[i] * q); else ctx.moveTo(cx[i] + nx[i] * q, cyv[i] + ny[i] * q); }
      for (let i = n; i >= 0; i--) { const q = r(i); ctx.lineTo(cx[i] - nx[i] * q, cyv[i] - ny[i] * q); }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    line(ctx, x, top + mouth, cx[0], cyv[0] + mouth, pole, 0.06, env); line(ctx, x, top - mouth, cx[0], cyv[0] - mouth, pole, 0.06, env);
    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(0.06, px * 0.8); ctx.beginPath(); ctx.ellipse(cx[0], cyv[0], 0.1, mouth, 0, 0, TAU); ctx.stroke();
    // a lamp on the pole, so the sock can be read after dark
    circ(ctx, x, y + h + 0.12, 0.12, S.pal.dark > 0.3 ? '#fff3c4' : S.tone('#cfd6dc', P));
    if (S.pal.dark > 0.3 && s > 3) rgGlow(ctx, x, y + h + 0.12, 2.6, '255,236,185', 0.34);
  } });
  return { x, top: y + h };
};

// A fuel tank on a cradle. Shooting it sets it off.
// A welded steel cylinder inside a low concrete bund: a ladder to the filler
// hatch, a sight gauge with a red float, a flame diamond, snow on its back and
// stains where fuel has run. Once it has gone up there is a scorched ring, a
// torn plate and smoke that leans with the wind.
K.fuelTank = function (S, P, x, o) {
  o = o || {}; const y = (o.y || 0) + 1.9, g = y - 1.9, L = rgSun(S), cy = y - 0.07;
  const shell = S.tone('#c3cad1', P), shellL = S.tone('#e3e8ec', P), shellD = S.tone('#96a0ab', P), seam = S.tone('#7f8994', P), sad = S.tone('#2a2e36', P), conc = S.tone('#8b9299', P), concD = S.tone('#6f767d', P), snow = S.tone('#f6f9fc', P), snowSh = S.tone('#a9bace', P), red = S.tone('#c8372d', P), ink = S.tone('#20242b', P), white = S.tone('#f4f1ea', P), burnt = S.tone('#23272d', P);
  const sh = S.tone(mix(S.pal.ground, '#6f86a8', 0.34), P), soot = S.tone('#3c4046', P);
  return K.thing(S, P, 'tank', x, y, Object.assign({ r: 1.25, blast: 8, drawFn(ctx, env, S2, ob) {
    const s = env.s, px = env.px;
    if (!ob.alive) {
      // what is left: soot blown outward over the snow, a cracked bund, a curl of plate
      ctx.fillStyle = soot; ctx.globalAlpha = 0.5; ctx.beginPath(); rgLens(ctx, x, g - 0.3, 6.5, 0.5, 0.8, 0); ctx.fill();
      ctx.globalAlpha = 0.8; ctx.fillStyle = 'rgba(14,14,18,0.75)'; ctx.beginPath(); ctx.ellipse(x, g - 0.2, 4.2, 0.6, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      R4(ctx, x - 3.7, g, 3.1, 0.36, concD); R4(ctx, x + 0.9, g, 2.8, 0.3, concD);
      R4(ctx, x - 2.2, g, 0.3, 1.4, burnt); R4(ctx, x + 1.9, g, 0.3, 1.1, burnt);
      ctx.strokeStyle = burnt; ctx.lineWidth = Math.max(0.16, px); ctx.beginPath(); ctx.moveTo(x - 2.0, g + 1.3); ctx.quadraticCurveTo(x - 0.4, g + 2.5, x + 0.9, g + 0.8); ctx.moveTo(x + 1.4, g + 0.3); ctx.quadraticCurveTo(x + 2.6, g + 1.4, x + 3.2, g + 0.5); ctx.stroke();
      if (s > 3.5) rgSmoke(ctx, env, x - 0.4, g + 1.2, { n: 6, rise: 6, speed: 0.22, r0: 0.3, r1: 1.5, a: 0.4, col: soot, lean: 0.6 });
      return;
    }
    ctx.fillStyle = sh; ctx.beginPath(); rgCast(ctx, L, g, [x - 3.7, 0, x + 3.7, 0, x + 3, 3, x - 3, 3]); ctx.fill();
    // the cradles, then the cylinder with its domed ends
    poly(ctx, [x - 2.35, g, x - 1.45, g, x - 1.6, y - 0.6, x - 2.2, y - 0.6], sad); poly(ctx, [x + 1.45, g, x + 2.35, g, x + 2.2, y - 0.6, x + 1.6, y - 0.6], sad);
    ctx.fillStyle = shell; ctx.beginPath(); ctx.ellipse(x - 2.3, cy, 0.72, 1.13, 0, Math.PI / 2, Math.PI * 1.5); ctx.ellipse(x + 2.3, cy, 0.72, 1.13, 0, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shellD; ctx.beginPath(); ctx.moveTo(x - 3.0, cy - 0.25); ctx.lineTo(x + 3.0, cy - 0.25); ctx.ellipse(x + 2.3, cy, 0.72, 1.13, 0, -0.2, -Math.PI / 2, true); ctx.ellipse(x - 2.3, cy, 0.72, 1.13, 0, Math.PI * 1.5, Math.PI + 0.2, true); ctx.closePath(); ctx.fill();
    R4(ctx, x - 2.25, cy + 0.6, 4.5, 0.17, shellL);
    if (s > 5) {   // weld seams, and where fuel and rust have run
      ctx.fillStyle = seam; ctx.fillRect(x - 2.3, cy - 1.12, 0.06, 2.24); ctx.fillRect(x - 0.78, cy - 1.12, 0.05, 2.24); ctx.fillRect(x + 0.74, cy - 1.12, 0.05, 2.24); ctx.fillRect(x + 2.26, cy - 1.12, 0.06, 2.24);
      ctx.fillStyle = 'rgba(40,34,28,0.24)'; ctx.beginPath(); ctx.moveTo(x + 1.05, cy + 1.1); ctx.lineTo(x + 1.4, cy + 1.1); ctx.lineTo(x + 1.3, cy - 0.5); ctx.closePath(); ctx.moveTo(x - 1.7, cy + 1.0); ctx.lineTo(x - 1.45, cy + 1.0); ctx.lineTo(x - 1.52, cy + 0.1); ctx.closePath(); ctx.moveTo(x + 0.7, cy - 0.5); ctx.lineTo(x + 0.84, cy - 0.5); ctx.lineTo(x + 0.78, cy - 1.1); ctx.closePath(); ctx.fill();
    }
    // the filler hatch and a breather pipe, then the snow on its back
    R4(ctx, x + 0.95, cy + 1.05, 0.56, 0.36, sad); R4(ctx, x + 0.88, cy + 1.38, 0.7, 0.1, seam);
    if (s > 5) { ctx.strokeStyle = sad; ctx.lineWidth = Math.max(0.07, px * 0.7); ctx.beginPath(); ctx.moveTo(x - 1.9, cy + 1.0); ctx.lineTo(x - 1.9, cy + 1.75); ctx.quadraticCurveTo(x - 1.9, cy + 1.95, x - 2.15, cy + 1.95); ctx.stroke(); }
    poly(ctx, [x - 2.85, cy + 0.55, x - 2.3, cy + 1.15, x - 0.9, cy + 1.4, x + 0.6, cy + 1.36, x + 2.3, cy + 1.15, x + 2.85, cy + 0.55, x + 2.35, cy + 1.0, x - 2.35, cy + 1.0], snow);
    if (s > 4) { ctx.strokeStyle = snowSh; ctx.lineWidth = Math.max(0.035, px * 0.6); ctx.beginPath(); ctx.moveTo(x - 2.85, cy + 0.55); ctx.lineTo(x - 2.3, cy + 1.15); ctx.lineTo(x - 0.9, cy + 1.4); ctx.lineTo(x + 0.6, cy + 1.36); ctx.lineTo(x + 2.3, cy + 1.15); ctx.lineTo(x + 2.85, cy + 0.55); ctx.stroke(); }
    if (s > 6) {
      // ladder and hand loops
      ctx.strokeStyle = ink; ctx.lineWidth = Math.max(0.05, px * 0.65); ctx.beginPath(); ctx.moveTo(x - 0.4, g + 0.3); ctx.lineTo(x - 0.4, cy + 1.55); ctx.quadraticCurveTo(x - 0.4, cy + 1.85, x - 0.1, cy + 1.85); ctx.moveTo(x + 0.02, g + 0.3); ctx.lineTo(x + 0.02, cy + 1.55); ctx.quadraticCurveTo(x + 0.02, cy + 1.85, x + 0.32, cy + 1.85);
      for (let yy = g + 0.55; yy < cy + 1.5; yy += 0.36) { ctx.moveTo(x - 0.4, yy); ctx.lineTo(x + 0.02, yy); }
      ctx.stroke();
      // the sight gauge: a pale tube with a red float
      R4(ctx, x + 1.72, cy - 0.85, 0.12, 1.75, white); R4(ctx, x + 1.67, cy + 0.25, 0.22, 0.13, red);
      if (s > 12) { ctx.fillStyle = ink; for (let k = 0; k < 6; k++) ctx.fillRect(x + 1.86, cy - 0.8 + k * 0.32, 0.1, 0.03); }
    }
    rgSign(ctx, env, S, P, x - 1.25, cy - 0.05, 0.5, 'fire');
    // the outlet with its valve, and the bund wall in front of it all
    if (s > 4) { R4(ctx, x + 2.95, g + 0.3, 0.14, 0.75, sad); R4(ctx, x + 2.75, g + 0.95, 0.5, 0.12, sad); circ(ctx, x + 3.02, g + 0.75, 0.17, red); }
    R4(ctx, x - 3.7, g, 7.4, 0.4, conc); R4(ctx, x - 3.7, g, 7.4, 0.1, concD); R4(ctx, x - 3.7, g + 0.37, 7.4, 0.09, snow);
    if (s > 6) { ctx.fillStyle = 'rgba(40,34,28,0.28)'; ctx.beginPath(); rgLens(ctx, x + 2.9, g - 0.22, 1.3, 0.1, 0.16, 0.4); ctx.fill(); }
  } }, o));
};

// The generator: an open tin shed with a yellow set inside that shakes and
// smokes while it runs. Shoot it and the lamps and lit windows go dark.
// The shed is dark inside on purpose, so the yellow canopy is the brightest
// thing in the row. A work lamp under the roof lights it after dark for as
// long as it runs.
K.genShed = function (S, P, x, o) {
  o = o || {}; const y = o.y || 0, L = rgSun(S), steel = S.tone('#414a55', P), tin = S.tone('#77818b', P), tinD = S.tone('#5a646e', P), snow = S.tone('#f4f7fa', P), snowSh = S.tone('#a9bace', P), back = S.tone('#2a313a', P), back2 = S.tone('#333b45', P), side = S.tone('#3d4651', P), conc = S.tone('#8b9299', P), ink = S.tone('#20242b', P), ice = S.tone('#cfe2f2', P), sh = S.tone(mix(S.pal.ground, '#6f86a8', 0.34), P);
  const yel = S.tone('#e2b33c', P), yelL = S.tone('#f0cb5e', P), yelD = S.tone('#b78a22', P), deadC = S.tone('#5c5340', P), deadD = S.tone('#463f30', P), dark = S.tone('#2a2e36', P), dial = S.tone('#e4e8ec', P), smokeC = 'rgb(70,74,84)';
  P.add({ x0: x - 9, x1: x + 9, layer: 0, draw(ctx, env) {
    const s = env.s, px = env.px, dir = env.wind < 0 ? -1 : 1, pw = rgPower(S, env);
    ctx.fillStyle = sh; ctx.beginPath(); rgCast(ctx, L, y, [x - 4.2, 0, x + 4.2, 0, x + 4.2, 3.7, x - 4.2, 3.7]); ctx.fill();
    R4(ctx, x - 3.6, y, 7.2, 3.0, back);
    if (s > 6) { ctx.fillStyle = back2; for (let xx = x - 3.3; xx < x + 3.5; xx += 0.42) ctx.fillRect(xx, y + 0.14, 0.07, 2.86); }   // corrugated tin
    R4(ctx, x - 3.6, y, 0.95, 3.0, side); R4(ctx, x - 3.95, y, 7.9, 0.14, conc);
    if (s > 5) { rgSign(ctx, env, S, P, x - 3.12, y + 2.15, 0.3, 'volt'); rgSign(ctx, env, S, P, x - 3.12, y + 1.4, 0.24, 'ear'); }
    if (s > 7) {   // cans of fuel on the floor, a cable up the post to a junction box
      R4(ctx, x + 2.2, y + 0.14, 0.42, 0.55, S.tone('#4f5a3c', P)); R4(ctx, x + 2.7, y + 0.14, 0.42, 0.55, S.tone('#36475e', P)); R4(ctx, x + 2.32, y + 0.69, 0.18, 0.08, dark); R4(ctx, x + 2.82, y + 0.69, 0.18, 0.08, dark);
      line(ctx, x + 1.5, y + 0.6, x + 3.5, y + 1.9, ink, 0.04, env); R4(ctx, x + 3.3, y + 1.8, 0.36, 0.44, tin);
    }
    line(ctx, x - 3.6, y, x - 3.6, y + 3.1, steel, 0.2, env); line(ctx, x + 3.6, y, x + 3.6, y + 3.1, steel, 0.2, env);
    if (pw > 0) { circ(ctx, x - 0.6, y + 2.85, 0.1, '#fff3c4'); rgGlow(ctx, x - 0.6, y + 2.4, 3.4, '255,225,160', 0.34 * pw); }   // the work lamp
    poly(ctx, [x - 4.2, y + 3.0, x + 4.2, y + 3.0, x + 3.9, y + 3.5, x - 3.9, y + 3.6], tin); R4(ctx, x - 4.2, y + 3.0, 8.4, 0.1, tinD);
    // snow on the roof, heaped toward the downwind end, with a hollow melted round the exhaust
    const ex = dir > 0 ? x + 4.2 : x - 4.2;
    R4(ctx, x - 4.0, y + 3.36, 8.0, 0.1, snowSh);
    ctx.fillStyle = snow; ctx.beginPath(); ctx.moveTo(x - 4.25, y + 3.42); ctx.quadraticCurveTo(x - 3.2 + dir * 0.3, y + 3.98, x - 1.0 + dir * 0.5, y + 3.98); ctx.quadraticCurveTo(x + 0.6, y + 4.0, x + 0.82, y + 3.6); ctx.lineTo(x + 1.42, y + 3.6); ctx.quadraticCurveTo(x + 2.6 + dir * 0.3, y + 4.02, x + 4.25, y + 3.38); ctx.closePath();
    ctx.moveTo(ex - dir * 0.8, y + 3.5); ctx.lineTo(ex + dir * 0.45, y + 3.46); ctx.lineTo(ex + dir * 0.38, y + 3.0); ctx.lineTo(ex - dir * 0.05, y + 3.12); ctx.closePath(); ctx.fill();
    if (s > 4) { ctx.strokeStyle = snowSh; ctx.lineWidth = Math.max(0.035, px * 0.6); ctx.beginPath(); ctx.moveTo(x - 4.25, y + 3.42); ctx.quadraticCurveTo(x - 3.2 + dir * 0.3, y + 3.98, x - 1.0 + dir * 0.5, y + 3.98); ctx.quadraticCurveTo(x + 0.6, y + 4.0, x + 0.82, y + 3.6); ctx.moveTo(x + 1.42, y + 3.6); ctx.quadraticCurveTo(x + 2.6 + dir * 0.3, y + 4.02, x + 4.25, y + 3.38); ctx.stroke(); }
    if (s > 7) { ctx.fillStyle = ice; ctx.beginPath(); rgIcicles(ctx, env, x - 4.1, x + 4.1, y + 3.0, 0.5, 0.4, x * 2.1); ctx.fill(); }
    ctx.fillStyle = snow; ctx.beginPath(); rgLens(ctx, x + dir * 4.6, y, 1.7, 0.3, 0, dir * 0.5); ctx.fill();   // a drift in the lee of the shed
  } });
  const ob = S.obj({ kind: 'gen', id: o.id || 'gen', plane: P, x, y: y + 0.95, w: 3.0, h: 1.7, r: 1.0, mat: 'metal', breakable: true, layer: 2, onHit: o.onHit,
    draw(ctx, env) {
      const s = env.s, px = env.px, live = ob.alive, j = live ? Math.sin(env.t * 41) * 0.025 : 0, bx = x + j, by = y + 0.2;
      R4(ctx, bx + 1.0, by + 1.5, 0.2, 2.75, dark); R4(ctx, bx + 0.9, by + 4.2, 0.4, 0.1, dark);   // the exhaust, up through the roof
      R4(ctx, bx - 1.5, by, 3.0, 1.5, live ? yel : deadC); R4(ctx, bx - 1.5, by + 1.36, 3.0, 0.14, live ? yelL : deadC); R4(ctx, bx - 1.5, by + 0.3, 3.0, 0.2, live ? yelD : deadD); R4(ctx, bx - 1.5, by, 3.0, 0.3, dark);
      R4(ctx, bx - 1.2, by + 0.55, 1.1, 0.7, dark); R4(ctx, bx + 0.3, by + 0.55, 0.95, 0.75, dark);
      ctx.fillStyle = live ? yelD : deadD; for (let k = 0; k < 4; k++) ctx.fillRect(bx + 0.34, by + 0.62 + k * 0.17, 0.87, 0.07);   // louvres
      if (s > 8) {
        R4(ctx, bx - 0.02, by + 0.5, 0.05, 0.86, live ? yelD : deadD); R4(ctx, bx + 0.1, by + 1.5, 0.3, 0.1, dark);
        circ(ctx, bx - 0.98, by + 1.02, 0.12, dial); circ(ctx, bx - 0.98, by + 0.72, 0.09, dial);
        if (s > 14) { line(ctx, bx - 0.98, by + 1.02, bx - 0.98 + (live ? 0.07 : -0.08), by + 1.02 + (live ? 0.07 : -0.05), ink, 0.02, env); for (let k = 0; k < 6; k++) R4(ctx, bx - 1.45 + k * 0.5, by + 0.03, 0.25, 0.12, k % 2 ? dark : (live ? yel : deadC)); }
        rgSign(ctx, env, S, P, bx + 1.25, by + 1.12, 0.14, 'volt');
      }
      if (live) {
        circ(ctx, bx - 0.65, by + 0.9, 0.12, Math.sin(env.t * 5) > 0 ? '#52e07a' : '#1f6a37');
        rgSmoke(ctx, env, bx + 1.1, by + 4.35, { n: 7, rise: 5, speed: 0.45, r0: 0.25, r1: 1.4, a: 0.6, col: smokeC, lean: 0.5 });
      } else {
        if (Math.sin(env.t * 23) > 0.7) circ(ctx, bx - 0.4, by + 1.0, 0.16, '#bfe4ff');
        if (s > 3.5) rgSmoke(ctx, env, bx + 0.4, by + 1.5, { n: 4, rise: 3, speed: 0.2, r0: 0.15, r1: 0.7, a: 0.3, col: smokeC, lean: 0.5 });
      }
    } });
  P.solid(x - 4.2, y + 3.0, 8.4, 0.6, 'thin');
  return ob;
};

// The landing pad: a circle of cleared concrete seen from above, so it is drawn
// as a flat ellipse on the snow. A ploughed bank round the edge, slab joints,
// a yellow ring and a white H that the wind has half scoured away, tongues of
// drifted snow lying across it, and a ring of green edge lights that chase
// round one after another.
K.helipad = function (S, P, x, o) {
  o = o || {}; const y = o.y || 0, r = o.r || 9, k = o.squash || 0.14, L = rgSun(S), cy = y - 0.15, ry = r * k;
  const pad = S.tone('#8f979f', P), padD = S.tone('#7a828a', P), padL = S.tone('#a3aab1', P), mark = S.tone('#e2b33c', P), white = S.tone('#f2f2ec', P), snow = S.tone('#f6f9fc', P), bank = S.tone(mix(S.pal.ground, '#6f86a8', 0.34), P), post = S.tone('#2a2e36', P), off = S.tone('#27603a', P);
  const N = 10, lamps = [], tongues = [[-0.55, 0.5, 2.6], [0.3, 0.62, 3.2], [-0.2, -0.45, 2.2], [0.62, -0.3, 2.8], [-0.7, -0.1, 1.9], [0.1, 0.1, 1.6], [0.45, -0.7, 2.0]];
  for (let i = 0; i < N; i++) { const a = (i / N) * TAU + 0.1; lamps.push([x + Math.cos(a) * r * 0.97, cy + Math.sin(a) * ry * 0.97, i]); }
  P.add({ x0: x - r - 3, x1: x + r + 3, layer: 0, draw(ctx, env) {
    const s = env.s, px = env.px, dark = S.pal.dark > 0.3;
    // the bank the plough left, then the slab
    ctx.fillStyle = bank; ctx.beginPath(); ctx.ellipse(x + L.side * 0.5, cy - 0.1, r + 1.0, ry + 0.24, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = snow; ctx.beginPath(); ctx.ellipse(x, cy, r + 0.7, ry + 0.15, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = pad; ctx.beginPath(); ctx.ellipse(x, cy, r, ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = padL; ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.ellipse(x - L.side * 1.2, cy + ry * 0.12, r * 0.8, ry * 0.72, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    if (s > 5) {   // joints between the slabs
      ctx.strokeStyle = padD; ctx.lineWidth = Math.max(0.04, px * 0.6); ctx.beginPath();
      for (let j = -2; j <= 2; j++) { const u = j / 3, hh = ry * Math.sqrt(1 - u * u); ctx.moveTo(x + u * r, cy - hh); ctx.lineTo(x + u * r, cy + hh); }
      for (let j = -1; j <= 1; j += 2) { const v = j * 0.45, ww = r * Math.sqrt(1 - v * v); ctx.moveTo(x - ww, cy + v * ry); ctx.lineTo(x + ww, cy + v * ry); }
      ctx.stroke();
    }
    // paint: the ring in four worn arcs, a thin white edge, and the H
    ctx.strokeStyle = mark; ctx.lineWidth = Math.max(0.14, px); ctx.beginPath();
    for (let q = 0; q < 4; q++) { const a0 = q * 1.571 + 0.12 + 0.1 * (q % 2); ctx.moveTo(x + Math.cos(a0) * r * 0.78, cy + Math.sin(a0) * ry * 0.78); ctx.ellipse(x, cy, r * 0.78, ry * 0.78, 0, a0, a0 + 1.3 - 0.12 * (q % 3)); }
    ctx.stroke();
    if (s > 6) { ctx.strokeStyle = white; ctx.globalAlpha = 0.6; ctx.lineWidth = Math.max(0.05, px * 0.6); ctx.beginPath(); ctx.ellipse(x, cy, r * 0.95, ry * 0.95, 0, 0.4, 2.6); ctx.moveTo(x + Math.cos(3.4) * r * 0.95, cy + Math.sin(3.4) * ry * 0.95); ctx.ellipse(x, cy, r * 0.95, ry * 0.95, 0, 3.4, 5.9); ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.fillStyle = white; ctx.fillRect(x - 2.0, cy - ry * 0.42, 0.55, ry * 0.84); ctx.fillRect(x + 1.45, cy - ry * 0.42, 0.55, ry * 0.84); ctx.fillRect(x - 2.0, cy - ry * 0.08, 4.0, ry * 0.16);
    if (s > 7) { ctx.fillStyle = pad; ctx.fillRect(x - 2.0, cy + ry * 0.2, 0.3, ry * 0.07); ctx.fillRect(x + 1.62, cy - ry * 0.3, 0.38, ry * 0.06); ctx.fillRect(x - 0.6, cy - ry * 0.02, 0.7, ry * 0.05); ctx.fillRect(x + 1.45, cy + ry * 0.3, 0.2, ry * 0.12); }
    if (s > 3.5) {   // tongues of snow the wind has laid across the slab
      ctx.fillStyle = snow; ctx.globalAlpha = 0.85; ctx.beginPath();
      for (let j = 0; j < tongues.length; j++) { const q = tongues[j]; rgLens(ctx, x + q[0] * r, cy + q[1] * ry, q[2], ry * 0.045, ry * 0.03, q[2] * 0.3); }
      ctx.fill(); ctx.globalAlpha = 1;
    }
    // edge lights: each swells and fades in turn, round and round
    for (let i = 0; i < N; i++) {
      const q = lamps[i], u = (((env.t * 0.9 - i / N) % 1) + 1) % 1, b = 0.25 + 0.75 * smooth(1 - Math.abs(u - 0.25) * 4);
      // a squat housing with a domed green lens: they sit low, so the rotor clears them
      if (s > 4) R4(ctx, q[0] - 0.09, q[1], 0.18, 0.15, post);
      ctx.fillStyle = b > 0.55 ? '#52e07a' : off; ctx.beginPath(); ctx.ellipse(q[0], q[1] + 0.17, 0.17, 0.13, 0, 0, TAU); ctx.fill();
      if (dark) { if (s > 6) rgGlow(ctx, q[0], q[1] + 0.17, 1.1, '82,224,122', 0.5 * b); else { ctx.globalAlpha = 0.22 * b; circ(ctx, q[0], q[1] + 0.17, 0.9, '#52e07a'); ctx.globalAlpha = 1; } }
    }
  } });
  return { x, y, r };
};

// A low concrete block, the kind you put across a road. Good cover.
// Plain cast concrete: a darker end, a foot, two lifting loops, drain slots,
// and a cap of snow drifted over to the downwind side.
K.block = function (S, P, x, o) {
  o = o || {}; const y = o.y || 0, w = o.w || 3, h = o.h || 1.15, L = rgSun(S), c = S.tone('#9aa1a8', P), d = S.tone('#6e757c', P), l = S.tone('#b3b9bf', P), d2 = S.tone('#4f555c', P), snow = S.tone('#f4f7fa', P), snowSh = S.tone('#a9bace', P), sh = S.tone(mix(S.pal.ground, '#6f86a8', 0.34), P);
  P.add({ x0: x - w - 2, x1: x + w + 2, layer: o.layer === undefined ? 2 : o.layer, draw(ctx, env) {
    const s = env.s, dir = env.wind < 0 ? -1 : 1;
    ctx.fillStyle = sh; ctx.beginPath(); rgCast(ctx, L, y, [x - w / 2 - 0.25, 0, x + w / 2 + 0.25, 0, x + w / 2, h, x - w / 2, h]); ctx.fill();
    poly(ctx, [x - w / 2 - 0.25, y, x + w / 2 + 0.25, y, x + w / 2, y + h, x - w / 2, y + h], c);
    poly(ctx, [x + w / 2 - 0.45, y, x + w / 2 + 0.25, y, x + w / 2, y + h, x + w / 2 - 0.32, y + h], d);
    R4(ctx, x - w / 2 - 0.25, y, w + 0.5, 0.22, d);
    if (s > 6) {
      R4(ctx, x - w / 2 + 0.03, y + h - 0.13, w - 0.4, 0.09, l); R4(ctx, x - 0.02, y + 0.22, 0.04, h - 0.35, d);
      R4(ctx, x - w * 0.28 - 0.2, y, 0.4, 0.15, d2); R4(ctx, x + w * 0.2 - 0.2, y, 0.4, 0.15, d2);
    }
    ctx.fillStyle = snow; ctx.beginPath(); ctx.moveTo(x - w / 2, y + h); ctx.quadraticCurveTo(x - w / 4 + dir * 0.3, y + h + 0.3, x + dir * 0.3, y + h + 0.27); ctx.quadraticCurveTo(x + w / 4 + dir * 0.3, y + h + 0.3, x + w / 2, y + h); ctx.closePath();
    rgLens(ctx, x + dir * (w / 2 + 0.7), y, 1.0, 0.2, 0, dir * 0.3); ctx.fill();
    if (s > 5) { ctx.strokeStyle = snowSh; ctx.lineWidth = Math.max(0.035, env.px * 0.6); ctx.beginPath(); ctx.moveTo(x - w / 2, y + h); ctx.quadraticCurveTo(x - w / 4 + dir * 0.3, y + h + 0.3, x + dir * 0.3, y + h + 0.27); ctx.quadraticCurveTo(x + w / 4 + dir * 0.3, y + h + 0.3, x + w / 2, y + h); ctx.stroke(); }
    if (s > 8) { ctx.strokeStyle = d2; ctx.lineWidth = Math.max(0.04, env.px * 0.6); ctx.beginPath(); ctx.arc(x - w * 0.27, y + h + 0.14, 0.13, 0, Math.PI); ctx.moveTo(x + w * 0.27 + 0.13, y + h + 0.14); ctx.arc(x + w * 0.27, y + h + 0.14, 0.13, 0, Math.PI); ctx.stroke(); }
  } });
  P.solid(x - w / 2, y, w, h, 'hard');
};

// ---- the helicopter ----------------------------------------------------------
// Drawn nose to the right. The cabin has two windows: the pilot's bubble at
// the front and a wide one behind it for the passengers. The tail rotor (a
// yellow ring when it spins) is a separate shootable object: see K.heli.
// The numbers on the first line are what the game shoots at and must not
// change. Everything in draw() is paint: skids and cross tubes, door seams,
// a chin window, the rotor as a blurred disc with a blade sweeping through
// it, lights, and the snow the rotor wash throws out across the pad. Parked,
// it has snow on the blades, straps on the blade tips and a red streamer on
// the nose that flaps in the wind.
CARS.heli = { len: 7, h: 2.5, body: 1.2, cab: [-0.3, 0.4], win: [[-0.2, 0.1], [0.17, 0.36]], seats: [0.265, -0.12, 0.02], wheel: 0,
  draw(ctx, env, S, P, x, y, dir, colHex, st) {
    st = st || {};
    const hex = colHex || '#262b33', col = S.tone(hex, P), dk = S.tone(darken(hex, 0.4), P), hi = S.tone(lighten(hex, 0.18), P), trim = S.tone(st.stripe || '#c8372d', P), gl = S.tone(S.pal.glass, P), metal = S.tone('#8d949a', P), snow = S.tone('#f4f7fa', P), yel = S.tone('#e2b33c', P), ink = S.tone('#15181d', P), shade = S.tone('#7d93ae', P);
    const spin = st.spin || 0, t = env.t, parked = st.padY === undefined, alt = parked ? 0 : y - st.padY, gy = parked ? y : st.padY, s = env.s, L = rgSun(S), dusk = S.pal.dark > 0.3;
    {
      // its shadow on the ground: the body, and a faint disc for the turning rotor
      const k = clamp(1 - alt / 22, 0, 1), sx = x - dir * 1.5 + L.side * (0.8 + alt * 0.4);
      if (spin > 0.2) { ctx.fillStyle = 'rgba(40,52,70,' + (0.07 * spin * k).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(sx + dir * 1.4, gy - 0.3, 6.9, 0.95, 0, 0, TAU); ctx.fill(); }
      ctx.fillStyle = 'rgba(40,52,70,' + (0.1 + 0.2 * k).toFixed(2) + ')'; ctx.beginPath(); ctx.ellipse(sx, gy - 0.3, 5.5 * (0.5 + 0.5 * k), 0.5 * (0.5 + 0.5 * k), 0, 0, TAU); ctx.fill();
    }
    if (!parked && spin > 0.35 && alt < 16) {
      // snow thrown out by the rotor wash: rings racing outward over the ground, and
      // billows at their edges that the wind carries off
      const q = spin * (1 - alt / 16);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(0.1, env.px * 0.8);
      for (let i = 0; i < 3; i++) { const u = (t * 0.8 + i / 3) % 1, rr = 3.5 + u * 13; ctx.globalAlpha = 0.3 * q * (1 - u); ctx.beginPath(); ctx.ellipse(x, gy - 0.2, rr, rr * 0.13, 0, 0.3 + i, 2.6 + i); ctx.stroke(); ctx.beginPath(); ctx.ellipse(x, gy - 0.2, rr, rr * 0.13, 0, 3.5 + i, 5.6 + i); ctx.stroke(); }
      for (let pass = 0; pass < 2; pass++) {
        ctx.fillStyle = pass ? '#ffffff' : shade;
        for (let i = 0; i < 12; i++) { const u = (t * 0.7 + i / 12) % 1, side = i % 2 ? 1 : -1; ctx.globalAlpha = (pass ? 0.36 : 0.2) * q * (1 - u); ctx.beginPath(); ctx.ellipse(x + side * (3 + u * 13) + Math.sin(i * 5.1) * 2 + env.wind * u * 0.9, gy + 0.3 + u * 2.6 + (i % 3) * 0.3 - (pass ? 0 : 0.3), 1.2 + u * 3.4, 0.5 + u * 1.3, 0, 0, TAU); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
    }
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); if (st.tilt) ctx.rotate(st.tilt);
    const lw = (w) => Math.max(w, env.px * 0.9), wl = env.wind * dir;   // wl: the wind as the machine feels it, nose to the right
    // skids on their cross tubes
    ctx.strokeStyle = dk; ctx.lineWidth = lw(0.12); ctx.beginPath(); ctx.moveTo(-2.1, 0.07); ctx.lineTo(2.3, 0.07); ctx.quadraticCurveTo(2.75, 0.1, 2.9, 0.45); ctx.moveTo(-1.2, 0.07); ctx.quadraticCurveTo(-1.15, 0.45, -0.95, 0.6); ctx.moveTo(1.5, 0.07); ctx.quadraticCurveTo(1.45, 0.45, 1.25, 0.6); ctx.stroke();
    if (s > 7) { R4(ctx, -0.2, 0.26, 0.9, 0.06, dk); if (parked) R4(ctx, -2.0, 0.13, 4.2, 0.05, snow); }
    // tail boom, fin and stabiliser
    poly(ctx, [-3.4, 1.98, -3.4, 1.3, -8.25, 1.6, -8.25, 1.88], col);
    poly(ctx, [-7.5, 1.86, -8.25, 1.6, -8.75, 1.2, -8.5, 1.72, -9.0, 3.15, -8.5, 3.2], col);
    if (s > 5) { poly(ctx, [-3.4, 1.98, -8.25, 1.88, -8.25, 1.8, -3.4, 1.86], hi); poly(ctx, [-8.92, 2.93, -9.0, 3.15, -8.5, 3.2, -8.44, 2.98], trim); }
    R4(ctx, -7.1, 1.66, 1.1, 0.12, dk); R4(ctx, -7.16, 1.5, 0.09, 0.44, dk);
    if (s > 7) { ctx.strokeStyle = dk; ctx.lineWidth = lw(0.05); ctx.beginPath(); ctx.moveTo(-8.45, 1.3); ctx.lineTo(-8.1, 0.82); ctx.moveTo(-5.2, 1.94); ctx.lineTo(-5.2, 2.5); ctx.lineTo(-8.6, 3.12); ctx.stroke(); }
    // body
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(3.3, 1.05); ctx.quadraticCurveTo(3.2, 0.55, 2.6, 0.5); ctx.lineTo(-2.4, 0.5); ctx.lineTo(-3.5, 1.15); ctx.lineTo(-3.5, 1.98); ctx.lineTo(-2.9, 2.76); ctx.lineTo(0.9, 2.86); ctx.lineTo(1.9, 2.5); ctx.quadraticCurveTo(2.9, 1.9, 3.3, 1.05); ctx.fill();
    poly(ctx, [-2.4, 0.5, 2.6, 0.5, 2.98, 0.74, -2.8, 0.74], dk);
    R4(ctx, -3.45, 0.93, 6.6, 0.2, trim);
    poly(ctx, [-2.9, 2.76, 0.9, 2.86, 0.6, 2.62, -2.7, 2.55], hi);
    circ(ctx, -2.75, 2.25, 0.2, dk);
    if (s > 6) {
      R4(ctx, -3.45, 1.15, 6.4, 0.045, hi);
      ctx.strokeStyle = dk; ctx.lineWidth = lw(0.035); ctx.beginPath(); ctx.moveTo(-1.6, 0.76); ctx.lineTo(-1.6, 2.52); ctx.moveTo(0.95, 0.76); ctx.lineTo(0.95, 2.48); ctx.moveTo(2.66, 0.76); ctx.lineTo(2.66, 2.1); ctx.stroke();
      R4(ctx, 0.66, 0.8, 0.22, 0.06, metal); R4(ctx, -1.5, 0.8, 0.22, 0.06, metal);
      ctx.strokeStyle = metal; ctx.lineWidth = lw(0.04); ctx.beginPath(); ctx.arc(-2.75, 2.25, 0.2, 0, TAU); ctx.moveTo(3.28, 1.02); ctx.lineTo(3.8, 0.98); ctx.stroke();
    }
    // glass
    const g = st.glass || [];
    R4(ctx, -1.4, 1.26, 2.1, 1.1, g[0] ? S.tone('#0d1016', P) : gl); R4(ctx, 1.19, 1.26, 1.33, 1.1, g[1] ? S.tone('#0d1016', P) : gl);
    poly(ctx, [2.52, 1.26, 3.12, 1.26, 2.52, 2.2], gl);
    if (s > 4) poly(ctx, [2.62, 0.78, 3.14, 0.96, 2.62, 1.12], gl);
    ctx.fillStyle = 'rgba(210,230,255,0.16)';
    if (!g[0]) { ctx.beginPath(); ctx.moveTo(-1.15, 1.26); ctx.lineTo(-0.6, 1.26); ctx.lineTo(-0.95, 2.36); ctx.lineTo(-1.4, 2.36); ctx.lineTo(-1.4, 2.0); ctx.closePath(); ctx.fill(); }
    if (!g[1]) { ctx.beginPath(); ctx.moveTo(1.4, 1.26); ctx.lineTo(1.78, 1.26); ctx.lineTo(1.5, 2.36); ctx.lineTo(1.19, 2.36); ctx.lineTo(1.19, 1.9); ctx.closePath(); ctx.fill(); }
    if (parked && s > 9) { ctx.fillStyle = 'rgba(232,240,248,0.5)'; ctx.beginPath(); ctx.moveTo(-1.4, 1.26); ctx.lineTo(-0.8, 1.26); ctx.lineTo(-1.4, 1.6); ctx.moveTo(0.7, 1.26); ctx.lineTo(0.2, 1.26); ctx.lineTo(0.7, 1.52); ctx.moveTo(1.19, 1.26); ctx.lineTo(1.6, 1.26); ctx.lineTo(1.19, 1.5); ctx.moveTo(2.52, 1.26); ctx.lineTo(2.1, 1.26); ctx.lineTo(2.52, 1.5); ctx.fill(); }   // frost in the corners
    ctx.strokeStyle = dk; ctx.lineWidth = lw(0.07); ctx.strokeRect(-1.4, 1.26, 2.1, 1.1); ctx.strokeRect(1.19, 1.26, 1.33, 1.1);
    // mast and main rotor
    R4(ctx, -0.28, 2.82, 0.36, 0.62, dk); if (s > 7) R4(ctx, -0.44, 3.12, 0.68, 0.07, metal); circ(ctx, -0.1, 3.48, 0.2, dk);
    if (spin < 0.06) {
      ctx.strokeStyle = dk; ctx.lineWidth = lw(0.14); ctx.beginPath(); ctx.moveTo(-0.1, 3.5); ctx.quadraticCurveTo(3.4, 3.5, 6.5, 3.05); ctx.moveTo(-0.1, 3.5); ctx.quadraticCurveTo(-3.4, 3.5, -6.6, 3.1); ctx.stroke();
      if (parked) {
        ctx.strokeStyle = snow; ctx.lineWidth = lw(0.1); ctx.beginPath(); ctx.moveTo(0.6, 3.6); ctx.quadraticCurveTo(3.4, 3.62, 6.3, 3.2); ctx.moveTo(-0.8, 3.6); ctx.quadraticCurveTo(-3.4, 3.62, -6.4, 3.24); ctx.stroke(); poly(ctx, [-2.6, 2.86, -1.2, 3.05, 0.4, 2.96, 0.9, 2.86], snow);
        if (s > 4) {   // straps from the blade tips to the pad, a cover on the intake, and a streamer on the nose
          ctx.strokeStyle = S.tone('#d8572a', P); ctx.lineWidth = lw(0.04); ctx.beginPath(); ctx.moveTo(6.5, 3.05); ctx.lineTo(4.9, 0.05); ctx.moveTo(-6.6, 3.1); ctx.lineTo(-5.4, 0.05); ctx.stroke();
          poly(ctx, [-2.98, 2.02, -2.5, 2.02, -2.5, 2.5, -2.98, 2.5], trim);
          const a = Math.min(1, Math.abs(wl) / 8), sd = wl < 0 ? -1 : 1, ln = 1.1;
          ctx.strokeStyle = trim; ctx.lineWidth = lw(0.09); ctx.beginPath(); ctx.moveTo(3.78, 0.98);
          for (let i = 1; i <= 4; i++) { const u = i / 4; ctx.lineTo(3.78 + sd * u * ln * (0.25 + 0.75 * a), 0.98 - (1 - a) * u * u * 0.8 + Math.sin(t * (6 + 8 * a) - u * 5) * 0.09 * u * (0.3 + a)); }
          ctx.stroke();
        }
      }
    } else {
      // the disc: a dark blur with a darker rim, one blade sweeping through it and its ghost just behind
      ctx.fillStyle = 'rgba(20,24,30,' + (0.1 + 0.16 * spin).toFixed(2) + ')'; ctx.beginPath(); ctx.ellipse(-0.1, 3.5, 6.7, 0.2 + 0.1 * spin, 0, 0, TAU); ctx.fill();
      if (s > 5) { ctx.strokeStyle = 'rgba(20,24,30,' + (0.2 + 0.2 * spin).toFixed(2) + ')'; ctx.lineWidth = lw(0.04); ctx.beginPath(); ctx.ellipse(-0.1, 3.5, 6.7, 0.2 + 0.1 * spin, 0, 0, TAU); ctx.stroke(); }
      const ph = t * (3 + 30 * spin), bx = Math.cos(ph) * 6.7, bx2 = Math.cos(ph - 0.5) * 6.7;
      ctx.strokeStyle = dk; ctx.lineWidth = lw(0.1);
      ctx.globalAlpha = (0.75 - 0.4 * spin) * 0.4; ctx.beginPath(); ctx.moveTo(-0.1 - bx2, 3.5); ctx.lineTo(-0.1 + bx2, 3.5); ctx.stroke();
      ctx.globalAlpha = 0.75 - 0.4 * spin; ctx.beginPath(); ctx.moveTo(-0.1 - bx, 3.5); ctx.lineTo(-0.1 + bx, 3.5); ctx.stroke(); ctx.globalAlpha = 1;
    }
    // tail rotor: a yellow ring while it turns, with a dark rim so it shows on snow
    const tx = -8.3, ty = 2.05;
    if (st.tail !== false) {
      if (spin < 0.06) { ctx.strokeStyle = yel; ctx.lineWidth = lw(0.16); ctx.beginPath(); ctx.moveTo(tx - 0.25, ty - 0.95); ctx.lineTo(tx + 0.25, ty + 0.95); ctx.stroke(); }
      else {
        ctx.fillStyle = 'rgba(226,179,60,' + (0.16 + 0.12 * spin).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(tx, ty, 1.0, 0, TAU); ctx.fill();
        if (s > 3.5) { ctx.strokeStyle = ink; ctx.globalAlpha = 0.6; ctx.lineWidth = lw(0.05); ctx.beginPath(); ctx.arc(tx, ty, 1.08, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
        ctx.strokeStyle = yel; ctx.lineWidth = lw(0.13); ctx.beginPath(); ctx.arc(tx, ty, 0.98, 0, TAU); ctx.stroke();
        const a = t * (5 + 44 * spin); ctx.strokeStyle = dk; ctx.lineWidth = lw(0.09); ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(tx - Math.cos(a) * 0.95, ty - Math.sin(a) * 0.95); ctx.lineTo(tx + Math.cos(a) * 0.95, ty + Math.sin(a) * 0.95); ctx.stroke(); ctx.globalAlpha = 1;
      }
      circ(ctx, tx, ty, 0.16, dk);
    } else {
      ctx.strokeStyle = dk; ctx.lineWidth = lw(0.12); ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + 0.5, ty - 0.55); ctx.moveTo(tx, ty); ctx.lineTo(tx - 0.2, ty + 0.4); ctx.stroke();
      ctx.fillStyle = 'rgba(30,32,38,0.55)'; for (let i = 0; i < 5; i++) { const u = (t * 0.9 + i / 5) % 1; ctx.globalAlpha = 0.6 * (1 - u); ctx.beginPath(); ctx.arc(tx - u * 1.5 + wl * u * u * 0.8, ty + 0.3 + u * 3.2, 0.3 + u * 0.9, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1;
    }
    // lights: a red beacon on the fin, a white strobe under the belly, a green
    // lamp on the side, and at dusk a landing light throwing a soft cone ahead
    if (!parked) {
      circ(ctx, 2.2, 0.62, 0.07, '#52e07a');
      if ((t * 1.1) % 1 < 0.16) { circ(ctx, -8.75, 3.2, 0.16, '#ff4a3d'); if (dusk) rgGlow(ctx, -8.75, 3.2, 1.3, '255,74,61', 0.5); }
      if ((t * 1.1 + 0.5) % 1 < 0.08) { circ(ctx, 0.4, 0.42, 0.14, '#ffffff'); if (dusk) rgGlow(ctx, 0.4, 0.42, 1.0, '255,255,255', 0.4); }
      if (dusk && spin > 0.3) {
        circ(ctx, 2.75, 0.52, 0.1, '#fff3c4');
        const gg = ctx.createLinearGradient(2.75, 0.5, 8.2, -0.5); gg.addColorStop(0, 'rgba(255,240,200,0.3)'); gg.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gg; ctx.beginPath(); ctx.moveTo(2.75, 0.6); ctx.lineTo(2.75, 0.44); ctx.lineTo(8.2, -1.5); ctx.lineTo(8.2, 0.6); ctx.closePath(); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
      }
    }
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

// ---- dressing used by the location -----------------------------------------------
// More to look at on a snow slope built by K.hills: blue hollows that follow
// the fall of the ground, the pale tongues old slides have left (slides: true),
// and a few outcrops with snow on their heads (rocks: true). Nothing here
// stops a bullet or could be taken for a person.
function rgSlope(S, P, o) {
  o = o || {}; const D = makeRng((o.seed || 3) * 613 + 11), x0 = o.x0 === undefined ? -420 : o.x0, x1 = o.x1 === undefined ? 420 : o.x1, depth = o.depth || 12, base = o.col || S.pal.ground, L = rgSun(S);
  const hollow = S.tone(mix(base, '#6f86a8', 0.2), P), crest = S.tone(lighten(base, 0.85), P), slide = S.tone(mix(base, '#6f86a8', 0.11), P), rock = S.tone('#5a6571', P), rockD = S.tone('#3b444f', P), snow = S.tone('#f4f7fa', P);
  const lens = [], slides = [], rocks = [];
  for (let x = x0; x < x1; x += D.r(6, 15)) { const dd = D.r(0.8, depth), l = D.r(4, 12); lens.push([x, P.heightAt(x) - dd, l, (P.heightAt(x + l) - P.heightAt(x - l)) / (2 * l), D.r(0.25, 0.6) * (0.6 + dd / depth)]); }
  if (o.slides) for (let x = x0; x < x1; x += D.r(45, 95)) slides.push([x, P.heightAt(x), D.r(2.5, 5), D.r(depth * 0.5, depth * 1.1), D.r(-4, 4)]);
  if (o.rocks) for (let x = x0; x < x1; x += D.r(28, 70)) rocks.push([x, P.heightAt(x) - D.r(1.5, depth * 0.8), D.r(1.6, 4.2), D.r(0.8, 2.2)]);
  P.add({ x0, x1, layer: 0, draw(ctx, env) {
    const s = env.s; if (s < 1.6) return;
    if (slides.length) {
      ctx.fillStyle = slide; ctx.beginPath();
      for (let i = rgFrom(slides, env.x0 - 14); i < slides.length && slides[i][0] < env.x1 + 14; i++) { const q = slides[i]; ctx.moveTo(q[0] - q[2] * 0.6, q[1] - 0.4); ctx.lineTo(q[0] + q[2] * 0.6, q[1] - 0.4); ctx.lineTo(q[0] + q[2] * 1.6 + q[4], q[1] - q[3]); ctx.quadraticCurveTo(q[0] + q[4], q[1] - q[3] * 1.18, q[0] - q[2] * 1.4 + q[4], q[1] - q[3] * 0.92); ctx.closePath(); }
      ctx.fill();
      if (s > 4) { ctx.fillStyle = crest; ctx.beginPath(); for (let i = rgFrom(slides, env.x0 - 14); i < slides.length && slides[i][0] < env.x1 + 14; i++) { const q = slides[i]; for (let k = 0; k < 4; k++) rgLens(ctx, q[0] + q[4] + (k - 1.5) * q[2] * 0.7, q[1] - q[3] * (0.9 + 0.05 * (k % 2)), q[2] * 0.4, 0.3, 0.05, 0); } ctx.fill(); }
    }
    for (let k = 0; k < 2; k++) {
      ctx.fillStyle = k ? crest : hollow; ctx.beginPath();
      for (let i = rgFrom(lens, env.x0 - 14); i < lens.length && lens[i][0] < env.x1 + 14; i++) {
        const q = lens[i], l = k ? q[2] * 0.82 : q[2], y0 = q[1] + (k ? q[4] * 0.25 : 0), up = k ? q[4] * 0.6 : q[4] * 0.1, dn = k ? q[4] * 0.05 : q[4];
        ctx.moveTo(q[0] - l, y0 - q[3] * l); ctx.quadraticCurveTo(q[0] + L.side * l * 0.2, y0 + up * 2, q[0] + l, y0 + q[3] * l); ctx.quadraticCurveTo(q[0] + L.side * l * 0.2, y0 - dn * 2, q[0] - l, y0 - q[3] * l);
      }
      ctx.fill();
    }
    for (let i = rgFrom(rocks, env.x0 - 6); i < rocks.length && rocks[i][0] < env.x1 + 6; i++) {
      const q = rocks[i], bx = q[0], by = q[1], w = q[2], h = q[3];
      ctx.fillStyle = hollow; ctx.beginPath(); rgLens(ctx, bx + L.side * w * 0.5, by - 0.1, w * 1.3, 0.05, h * 0.22, 0); ctx.fill();
      poly(ctx, [bx - w, by, bx - w * 0.6, by + h * 0.7, bx - w * 0.1, by + h, bx + w * 0.55, by + h * 0.7, bx + w, by], rock);
      poly(ctx, [bx - w * 0.1, by + h, bx + w * 0.55, by + h * 0.7, bx + w, by, bx + w * 0.15, by], rockD);
      poly(ctx, [bx - w * 0.66, by + h * 0.62, bx - w * 0.1, by + h + 0.14, bx + w * 0.6, by + h * 0.66, bx + w * 0.2, by + h * 0.52, bx - w * 0.3, by + h * 0.46], snow);
    }
  } });
}

// What hangs in the sky and between the far ranges. The scope draws the sun
// itself. Here the sun gets a ring of ice-light with a bright sun dog on each
// side (and a pillar of light over it when it is low), the far peaks stand in
// valley haze, and thin banner clouds trail from them.
// A drawn item only knows its own plane, not where the eye is, and the ring
// has to sit exactly on the sun. So the farthest plane and one near plane each
// note what they are shown, and the eye is worked out from the pair.
function rgSky(S, P1, P2, PN, eye) {
  const cam = { ex: eye[0], ey: eye[1], ez: eye[2] || 0, s1: 0, cx1: 0, cy1: 0 }, sun = S.sky.sun, low = sun[1] < 30, dark = S.pal.dark;
  const ring = dark > 0.3 ? '255,214,170' : dark > 0.1 ? '255,236,214' : '255,255,255', D = makeRng(S.planes.length * 71 + Math.round(P1.z));
  PN.add({ x0: -1e6, x1: 1e6, layer: 0, draw(ctx, env) {
    if (!cam.s1 || !(env.y1 > env.y0) || Math.abs(cam.s1 - env.s) < 1e-9) return;
    const ez = (cam.s1 * P1.z - env.s * PN.z) / (cam.s1 - env.s), d1 = P1.z - ez, d2 = PN.z - ez; if (!isFinite(ez) || Math.abs(d2 - d1) < 1) return;
    cam.ez = ez; cam.ex = (cam.cx1 * d2 - ((env.x0 + env.x1) / 2) * d1) / (d2 - d1); cam.ey = (cam.cy1 * d2 - ((env.y0 + env.y1) / 2) * d1) / (d2 - d1);
  } });
  P1.items.unshift({ x0: -1e6, x1: 1e6, layer: 0, draw(ctx, env) {
    cam.s1 = env.s; cam.cx1 = (env.x0 + env.x1) / 2; cam.cy1 = (env.y0 + env.y1) / 2;
    if (S.weather === 'rain' || S.time === 'overcast') return;
    const m = (P1.z - cam.ez) / 1000, X = cam.ex + sun[0] * m, Y = cam.ey + sun[1] * m, sr = (dark > 0.5 ? 4.5 : 7) * m, R = sr * 3.1;
    if (!(X + R * 1.6 > env.x0 && X - R * 1.6 < env.x1 && Y + R * 2.4 > env.y0 && Y - R * 1.3 < env.y1)) return;
    ctx.strokeStyle = 'rgba(' + ring + ',0.13)'; ctx.lineWidth = sr * 0.55; ctx.beginPath(); ctx.arc(X, Y, R + sr * 0.3, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(' + ring + ',0.34)'; ctx.lineWidth = Math.max(sr * 0.14, env.px); ctx.beginPath(); ctx.arc(X, Y, R, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(' + ring + ',0.2)'; ctx.beginPath(); rgLens(ctx, X - R - sr * 0.8, Y, sr * 1.1, sr * 0.09, sr * 0.09, 0); rgLens(ctx, X + R + sr * 0.8, Y, sr * 1.1, sr * 0.09, sr * 0.09, 0); ctx.fill();
    rgGlow(ctx, X - R, Y, sr * 0.55, ring, 0.5); rgGlow(ctx, X + R, Y, sr * 0.55, ring, 0.5); rgGlow(ctx, X, Y + R, sr * 0.6, ring, 0.22);
    if (low) {   // a pillar of light standing over a low sun
      const g = ctx.createLinearGradient(0, Y, 0, Y + sr * 6.5); g.addColorStop(0, 'rgba(' + ring + ',0.24)'); g.addColorStop(1, 'rgba(' + ring + ',0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(X - sr * 0.34, Y); ctx.lineTo(X + sr * 0.34, Y); ctx.lineTo(X + sr * 0.14, Y + sr * 6.5); ctx.lineTo(X - sr * 0.14, Y + sr * 6.5); ctx.closePath(); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
    }
  } });
  [P1, P2].forEach((Pm, j) => {
    const m = (Pm.z - (eye[2] || 0)) / 1000, yLo = eye[1] + (j ? 8 : 18) * m, yHi = eye[1] + (j ? 44 : 54) * m, clouds = [];
    for (let i = 0; i < 9; i++) clouds.push([D.r(-150, 150) * m, eye[1] + D.r(30, 60) * m, D.r(16, 44) * m, D.r(0.45, 1.0) * m]);
    Pm.add({ x0: -1e6, x1: 1e6, layer: 0, draw(ctx, env) {
      if (env.y0 > eye[1] + 64 * m || env.y1 < yLo - 60 * m) return;
      // valley haze: thick below yLo, thinning in four soft steps up to yHi (flat steps
      // paint far faster than one gradient, and at this distance they read as layers of mist)
      const a0 = j ? 0.6 : 0.5, yb = Math.max(env.y0, yLo - 60 * m), xw = env.x1 - env.x0, st = (yHi - yLo) / 4;
      ctx.fillStyle = S.pal.fog;
      if (yLo > yb) { ctx.globalAlpha = a0; ctx.fillRect(env.x0, yb, xw, yLo - yb); }
      for (let k = 0; k < 4; k++) { const ya = yLo + k * st, yc = Math.max(ya, yb); if (ya + st <= yc || ya > env.y1) continue; ctx.globalAlpha = a0 * (0.84 - k * 0.24); ctx.fillRect(env.x0, yc, xw, ya + st - yc); }
      ctx.globalAlpha = 1;
      // banner clouds: thin, flat, drifting the way the wind goes
      const dx = env.t * (env.wind < 0 ? -1 : 1) * 0.12 * m; ctx.fillStyle = S.pal.cloud; ctx.globalAlpha = 0.36; ctx.beginPath();
      for (let i = 0; i < clouds.length; i++) { const q = clouds[i], cx = ((((q[0] + dx) / m + 150) % 300) + 300) % 300 * m - 150 * m; if (cx + q[2] < env.x0 || cx - q[2] > env.x1) continue; rgLens(ctx, cx, q[1], q[2], q[3], q[3] * 0.5, q[2] * 0.25); }
      ctx.fill(); ctx.globalAlpha = 1;
    } });
  });
}

// A fuel line on trestles, wrapped in lagging against the cold: bands on the
// wrapping, snow along the top, icicles, a drop pipe to each tank and a loop
// in the middle to take up the shrinkage. drops is the x of each tank.
function rgPipe(S, P, x0, x1, drops) {
  const c = S.tone('#8a939c', P), cD = S.tone('#5f6973', P), d = S.tone('#2a2e36', P), snow = S.tone('#f4f7fa', P), ice = S.tone('#cfe2f2', P), conc = S.tone('#8b9299', P), red = S.tone('#c8372d', P), y = 3.55, xm = (x0 + x1) / 2;
  P.add({ x0: x0 - 1, x1: x1 + 1, layer: 0, draw(ctx, env) {
    const s = env.s, px = env.px;
    for (let x = x0; x <= x1; x += 4) { line(ctx, x, 0, x, y + 0.05, d, 0.1, env); if (s > 5) { R4(ctx, x - 0.3, 0, 0.6, 0.16, conc); R4(ctx, x - 0.28, y - 0.08, 0.56, 0.08, d); } }
    if (s > 4) { ctx.strokeStyle = d; ctx.lineWidth = Math.max(0.05, px * 0.6); ctx.beginPath(); for (let x = x0; x + 4 <= x1; x += 8) { ctx.moveTo(x, 0.3); ctx.lineTo(x + 4, y - 0.2); } ctx.stroke(); }
    R4(ctx, x0, y, xm - 1.2 - x0, 0.26, c); R4(ctx, xm + 1.2, y, x1 - xm - 1.2, 0.26, c);
    // the loop
    ctx.strokeStyle = c; ctx.lineWidth = Math.max(0.24, px); ctx.beginPath(); ctx.moveTo(xm - 1.2, y + 0.13); ctx.lineTo(xm - 1.2, y + 1.3); ctx.lineTo(xm + 1.2, y + 1.3); ctx.lineTo(xm + 1.2, y + 0.13); ctx.stroke();
    R4(ctx, x0, y, x1 - x0, 0.07, cD);
    for (let i = 0; i < drops.length; i++) R4(ctx, drops[i] + 1.12, y - 0.75, 0.2, 0.75, c);
    if (s > 6) {
      ctx.fillStyle = cD; for (let x = x0 + 0.6; x < x1; x += 1.2) if (Math.abs(x - xm) > 1.3) ctx.fillRect(x, y, 0.07, 0.26);
      ctx.fillStyle = snow; ctx.fillRect(x0, y + 0.24, xm - 1.2 - x0, 0.07); ctx.fillRect(xm + 1.2, y + 0.24, x1 - xm - 1.2, 0.07); ctx.fillRect(xm - 1.1, y + 1.4, 2.2, 0.07);
      circ(ctx, x0 + 1.4, y + 0.13, 0.22, red); R4(ctx, x0 + 1.34, y + 0.13, 0.12, 0.42, d);
    }
    if (s > 8) { ctx.fillStyle = ice; ctx.beginPath(); rgIcicles(ctx, env, x0 + 0.3, x1 - 0.3, y, 0.42, 0.5, x0); ctx.fill(); }
  } });
}

// Power lines along a row: thin poles with a cross arm, and two wires that sag
// between them and swing a little in the wind.
function rgWires(S, P, xs, h) {
  const pole = S.tone('#4a4038', P), wire = S.tone('#20242b', P), snow = S.tone('#f4f7fa', P), sh = S.tone(mix(S.pal.ground, '#6f86a8', 0.34), P), L = rgSun(S);
  P.add({ x0: xs[0] - 6, x1: xs[xs.length - 1] + 6, layer: 0, draw(ctx, env) {
    const s = env.s, px = env.px, sway = Math.sin(env.t * 0.9) * Math.min(0.5, Math.abs(env.wind) * 0.035) + env.wind * 0.03;
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i]; if (x < env.x0 - 6 || x > env.x1 + 6) continue;
      line(ctx, x, -0.05, x + L.side * L.kx * h, -0.05 - L.ky * h, sh, 0.16, env);
      line(ctx, x, 0, x, h, pole, 0.16, env); line(ctx, x - 0.7, h - 0.5, x + 0.7, h - 0.5, pole, 0.1, env);
      if (s > 6) { R4(ctx, x - 0.66, h - 0.45, 0.1, 0.2, snow); R4(ctx, x + 0.56, h - 0.45, 0.1, 0.2, snow); R4(ctx, x - 0.7, h - 0.45, 1.4, 0.04, snow); }
    }
    ctx.strokeStyle = wire; ctx.lineWidth = Math.max(0.03, px * 0.55); ctx.beginPath();
    for (let i = 0; i + 1 < xs.length; i++) for (let k = -1; k <= 1; k += 2) { const xa = xs[i] + k * 0.6, xb = xs[i + 1] + k * 0.6, sag = Math.min(1.1, (xb - xa) * 0.035); ctx.moveTo(xa, h - 0.3); ctx.quadraticCurveTo((xa + xb) / 2 + sway * 2, h - 0.3 - sag * 2, xb, h - 0.3); }
    ctx.stroke();
  } });
}

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
  const snowC = S.pal.ground, L = rgSun(S);

  // far to near: two ranges of peaks, forested hills, the back wall, the sniper ridge
  // (the air is thinned for the peaks while they are built, or they would fade to nothing)
  const fogD = S.pal.fogD; S.pal.fogD = fogD * 3.2;
  const PM1 = K.mountains(S, zc + 9000, { seed: sd + 2, h: 1200, base: -500, col: '#8497b0', snowCol: '#ffffff', snowLine: 0.5, rough: 520, step: 1.5 });
  const PM2 = K.mountains(S, zc + 5200, { seed: sd + 5, h: 880, base: -400, col: '#6f829b', snowCol: '#fbfdff', snowLine: 0.5, rough: 380 });
  S.pal.fogD = fogD;
  K.hills(S, zr + 1150, { seed: sd + 8, h: 150, base: -70, col: lighten(snowC, 0.1), trees: 0.8, treeCol: '#40595a', rough: 300, step: 26, mat: 'snow' });
  K.crag(S, zr + 300, { seed: sd + 11, h: 190, col: '#586574', snow: 1.35, name: 'backwall', solid: false, depth: 90 });
  const PRg = H.PRg = K.crag(S, zr, { seed: sd + 4, h: 150, col: '#364050', name: 'ridge', depth: 80, shape: (x) => 1 + 0.34 * Math.exp(-(x * x) / 26000) });
  const hx = o.hides || [-31, 3, 33], hy = o.hideY || [60, 82, 69];
  H.hides = hx.map((x, i) => K.hide(S, PRg, x, Math.min(hy[i], PRg.heightAt(x) - 16)));
  H.ridgeTop = (x) => PRg.heightAt(x);
  const PFt = K.hills(S, zr - 70, { seed: sd + 14, h: 24, base: -4, col: snowC, trees: 0.9, treeCol: '#2d4843', rough: 90, step: 9, mat: 'snow' });
  rgSlope(S, PFt, { seed: sd + 14, depth: 14 });
  H.PV = K.hills(S, zV, { seed: sd + 17, h: 11, base: -3, col: snowC, trees: 0.28, treeCol: '#2f4a44', rough: 130, step: 13, mat: 'snow' });
  rgSlope(S, H.PV, { seed: sd + 17, depth: 9, slides: true });
  H.blasts = K.snowBlasts(S, H.PV, 1);   // the slopes behind the compound, where the snow crew sets its charges

  // rear row: a tower, the search radar, the radio mast
  const PRr = H.PRr = S.plane(zRr, 'rear');
  K.snow(S, PRr, { band: band(zRr, zB), seed: sd + 1 });
  rgTrail(S, PRr, [-12, 0.04, -3, 0.2, 13, 0.22, 22.4, 0.05], band(zRr, zB));
  H.towerR = K.watch(S, PRr, -12, 9, { id: 'towerR' });
  H.radar = K.radar(S, PRr, 24, { h: 8 });
  H.mast = K.mast(S, PRr, -58, 19);
  K.fence(S, PRr, -100, 100, 2.6, { kind: 'mesh', col: '#58626e', layer: 0 });
  PRr.add({ x0: -100, x1: 100, layer: 0, draw(ctx, env) { if (env.s > 5) for (let i = 0; i < 5; i++) { const sx = -81 + i * 39; if (sx > env.x0 - 1 && sx < env.x1 + 1) rgSign(ctx, env, S, PRr, sx, 1.7, 0.34, 'stop'); } } });   // no-entry discs on the wire
  [[-84, 13], [-76, 9], [78, 12], [88, 15], [96, 10]].forEach((q) => K.pine(S, PRr, q[0], q[1], { snow: true }));

  // back row: generator shed, two bunkers, the fuel tanks
  const PB = H.PB = S.plane(zB, 'back');
  K.snow(S, PB, { band: band(zB, zc), seed: sd + 2 });
  rgTrail(S, PB, [-9, 0.03, -14, 0.2, -23, 0.24, -28.5, 0.05], band(zB, zc));
  rgTrail(S, PB, [-8.6, 0.03, -6, 0.45, -3.5, 1], band(zB, zc));
  rgWires(S, PB, [-24.4, 8, 34.5], 8.2);
  H.gen = K.genShed(S, PB, -30, { onHit: o.genHit });
  H.b1 = K.bunker(S, PB, -20, 24, 3.8, { id: 'b1', door: -9, text: '2', textX: 20, vent: -1.2 });
  H.b2 = K.bunker(S, PB, 12, 18, 3.4, { id: 'b2', slits: 2, text: '3', textX: 14.5, vent: 15 });
  // (the second tank is set where a round that misses the hovering helicopter's tail will not find it)
  H.tanks = [K.fuelTank(S, PB, 44, { id: 'tank1' }), K.fuelTank(S, PB, 55.5, { id: 'tank2' })];
  rgPipe(S, PB, 40, 60, [44, 55.5]);

  // main row: two towers, the command bunker with its dish and flag, the pad
  const PM = H.PM = S.plane(zc, 'main');
  K.snow(S, PM, { band: band(zc, zF), seed: sd + 3 });
  K.snowTrack(S, PM, -2, -34, band(zc, zF), { w: 2.2 });
  rgTrail(S, PM, [-3.2, 0.02, -20, 0.3, -40, 0.26, -47.6, 0.04], band(zc, zF));
  rgTrail(S, PM, [-0.8, 0.02, 12, 0.36, 33.5, 0.42, 50, 0.2], band(zc, zF));
  rgTrail(S, PM, [36, 0.03, 34.4, 0.42], band(zc, zF));
  H.towerW = K.watch(S, PM, -48, 8, { id: 'towerW' });
  H.towerE = K.watch(S, PM, 36, 8, { id: 'towerE' });
  H.cmd = K.bunker(S, PM, -8, 28, 4.6, { id: 'cmd', door: -2, text: 'HARROW 1', textX: 20, vent: 6.5 });
  H.door = -2;
  {
    // the dish stands on a short mast with two stays and a cable back to the roof
    const steel = S.tone('#2a2e36', PM), ry = H.cmd.roofY;
    PM.add({ x0: 12, x1: 16, layer: 0, draw(ctx, env) {
      line(ctx, 14, ry - 0.2, 14, ry + 2.0, steel, 0.12, env);
      if (env.s > 5) { ctx.strokeStyle = steel; ctx.lineWidth = Math.max(0.04, env.px * 0.6); ctx.beginPath(); ctx.moveTo(14, ry + 1.5); ctx.lineTo(13.1, ry); ctx.moveTo(14, ry + 1.5); ctx.lineTo(14.9, ry); ctx.moveTo(14, ry + 0.9); ctx.quadraticCurveTo(14.6, ry + 0.3, 15.6, ry + 0.1); ctx.stroke(); R4(ctx, 13.8, ry - 0.05, 0.4, 0.14, steel); }
    } });
  }
  H.dish = K.thing(S, PM, 'dish', 14, H.cmd.roofY + 2.7, { id: 'dish', r: 0.85, onHit: o.dishHit, drawFn(ctx, env, S2, ob) {
    const live = ob.alive, c = S.tone(live ? '#e4e8ec' : '#4d5258', PM), c2 = S.tone(live ? '#aab3bc' : '#33373c', PM), ink = S.tone('#20242b', PM), e = Math.max(0.05, env.px * 0.8);
    ctx.save(); ctx.translate(ob.x, ob.y); ctx.rotate(live ? -0.45 : 0.95);
    if (env.s > 4) { ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(0, 0, 0.42 + e, 0.9 + e, 0, 0, TAU); ctx.fill(); }   // a dark rim, so a pale dish shows against snow
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, 0, 0.42, 0.9, 0, 0, TAU); ctx.fill(); ctx.fillStyle = c2; ctx.beginPath(); ctx.ellipse(0.08, 0, 0.26, 0.7, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(0.05, env.px * 0.7); ctx.beginPath(); ctx.moveTo(0.1, 0); ctx.lineTo(0.85, 0);
    if (env.s > 9) { ctx.moveTo(0.12, 0.72); ctx.lineTo(0.85, 0); ctx.moveTo(0.12, -0.72); ctx.lineTo(0.85, 0); }
    ctx.stroke(); if (env.s > 6) R4(ctx, 0.78, -0.09, 0.2, 0.18, ink); ctx.restore();
    if (live && Math.sin(env.t * 3) > 0) circ(ctx, ob.x, ob.y - 1.0, 0.1, '#52e07a');
    if (!live && Math.sin(env.t * 19) > 0.8) circ(ctx, ob.x - 0.2, ob.y - 0.3, 0.1, '#bfe4ff');
  } });
  K.flag(S, PM, -15, 0, 10.5, '#c8372d', { col2: '#f1ede2' });
  H.pad = K.helipad(S, PM, 58, { squash: fs });
  H.sock = K.windsock(S, PM, 72, 6.5);
  H.lamps = [];
  if (o.lamps) [-39.5, 24, 46].forEach((lx, i) => H.lamps.push(K.lamp(S, PM, lx, 6.2, 'yard', { id: 'lamp' + (i + 1), reach: 16, r: 0.4, style: 'flood' })));
  if (o.heli === 'parked') K.parked(S, PM, 'heli', 58, 1, '#262b33', { layer: 0 });
  else if (o.heli === 'live') H.heli = K.heli(S, PM, 58, { spin: o.heliSpin, spin0: o.heliSpin0 });

  // front row: the wire, the gate and gatehouse, a truck, road blocks, a lone pine
  const PF = H.PF = S.plane(zF, 'front');
  K.snow(S, PF, { band: band(zF, zA), seed: sd + 4 });
  K.snowTrack(S, PF, -62, -30, band(zF, zA), { w: 2.4 });
  rgTrail(S, PF, [-73, 0.01, -68, 0.05, -63.5, 0.02], band(zF, zA));
  K.fence(S, PF, -110, -66, 3, { kind: 'mesh', col: '#4a535e' }); K.fence(S, PF, -58, 110, 3, { kind: 'mesh', col: '#4a535e' });
  K.box(S, PF, -66.4, 0, 0.4, 3.6, '#39414b', { solid: false }); K.box(S, PF, -58, 0, 0.4, 3.6, '#39414b', { solid: false });
  {
    // the gate stands open: a red and white pole raised on its pivot, with a weight on the short end
    const red = S.tone('#c8372d', PF), white = S.tone('#f1ede2', PF), steel = S.tone('#39414b', PF);
    PF.add({ x0: -68, x1: -56, layer: 0, draw(ctx, env) {
      const ca = Math.cos(1.2), sa = Math.sin(1.2), px0 = -65.7, py0 = 1.15, lw = Math.max(0.16, env.px);
      for (let i = 0; i < 6; i++) line(ctx, px0 + ca * i * 1.05, py0 + sa * i * 1.05, px0 + ca * (i + 1) * 1.05, py0 + sa * (i + 1) * 1.05, i % 2 ? white : red, lw, env);
      line(ctx, px0, py0, px0 - ca * 0.9, py0 - sa * 0.9, steel, lw * 1.6, env);
      if (env.s > 5) rgSign(ctx, env, S, PF, -57.8, 2.6, 0.36, 'stop');
    } });
  }
  H.gatehouse = K.bunker(S, PF, -77, 7, 3.0, { id: 'gate', slits: 1, col: '#7f868e', vent: -71.2 });
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
  rgTrail(S, PA, [-24.5, 0.01, -27, 0.05, -31, 0.02], 30);
  H.post = K.bunker(S, PA, -24, 6, 2.9, { id: 'post', slits: 1, col: '#82898f', vent: -18.7 });
  K.box(S, PA, -31.6, 0, 0.3, 1.2, '#39414b', { solid: false });
  {
    // the barrier across the road: red and white, a stop disc in the middle, a fork to rest in
    const red = S.tone('#c8372d', PA), white = S.tone('#f1ede2', PA), steel = S.tone('#39414b', PA);
    PA.add({ x0: -33, x1: -24, layer: 2, draw(ctx, env) {
      for (let i = 0; i < 6; i++) R4(ctx, -31.5 + i * 1.2, 1.0, 1.2, 0.2, i % 2 ? white : red);
      line(ctx, -24.4, 0, -24.4, 1.0, steel, 0.09, env); R4(ctx, -32.3, 0.95, 0.75, 0.3, steel);
      if (env.s > 5) rgSign(ctx, env, S, PA, -27.9, 1.1, 0.36, 'stop');
    } });
  }
  K.billboard(S, PA, -46, 1.6, 5.4, 2.4, 'HARROW RIDGE|NO ENTRY', { col: '#e9dcc0', textCol: '#8a2a22' });
  [[-74, 12], [-66, 8], [-58, 14], [22, 10], [31, 15], [38, 9], [62, 13], [74, 10], [86, 15]].forEach((q) => K.pine(S, PA, q[0], q[1], { snow: true, layer: q[1] > 12 ? 2 : 0 }));

  // the shooter's own side of the valley. These nearer slopes are what slide
  // past as the scope pans.
  const zK = ez + d(zc) * 0.5;
  const PK = K.hills(S, zK, { seed: sd + 31, h: 16, base: yAt(zK, lowMil + 9) - 31, col: snowC, trees: 0.55, treeCol: '#29423d', rough: 70, step: 11, mat: 'snow' });
  rgSlope(S, PK, { seed: sd + 31, depth: 10, rocks: true, x0: -260, x1: 260 });
  if (o.near !== false) {
    const zS = ez + 170, PS = S.plane(zS, 'spur'), sy = yAt(zS, lowMil - 13), rockC = S.tone('#59636f', PS), rockD = S.tone('#3f4852', PS), rockL = S.tone('#748090', PS), snowS = S.tone(snowC, PS);
    const hol = S.tone(mix(snowC, '#6f86a8', 0.2), PS), crestS = S.tone(lighten(snowC, 0.85), PS), shadeS = S.tone('#7d93ae', PS);
    const top = (x) => sy + 1.6 * vnoise(x / 9, sd) + 0.7 * vnoise(x / 2.3, sd + 3) + Math.max(0, Math.abs(x) - 12) * 0.12, line0 = [], DS = makeRng(sd * 41 + 9), dips = [];
    for (let x = -200; x <= 200; x += 2) line0.push([x, top(x)]);
    for (let x = -60; x < 60; x += DS.r(2.5, 6)) dips.push([x, top(x) - DS.r(0.4, 5), DS.r(1.5, 4.5), DS.r(0.1, 0.3)]);
    PS.add({ x0: -200, x1: 200, layer: 0, draw(ctx, env) {
      ctx.fillStyle = snowS; ctx.beginPath(); ctx.moveTo(-200, sy - 60);
      for (let i = 0; i < line0.length; i++) ctx.lineTo(line0[i][0], line0[i][1]);
      ctx.lineTo(200, sy - 60); ctx.closePath(); ctx.fill();
      for (let k2 = 0; k2 < 2; k2++) {   // hollows and crests down the slope
        ctx.fillStyle = k2 ? crestS : hol; ctx.beginPath();
        for (let i = rgFrom(dips, env.x0 - 6); i < dips.length && dips[i][0] < env.x1 + 6; i++) { const q = dips[i]; if (k2) rgLens(ctx, q[0], q[1] + q[3] * 0.25, q[2] * 0.8, q[3] * 0.6, q[3] * 0.05, 0); else rgLens(ctx, q[0], q[1], q[2], q[3] * 0.1, q[3], L.side * q[2] * 0.2); }
        ctx.fill();
      }
      [[-11.5, 1.4, 2.2], [9.8, 1.1, 1.7], [14.4, 1.9, 2.6], [-17, 2.2, 3]].forEach((q) => {
        const bx = q[0], by = sy + Math.abs(bx) * 0.1 - 0.3, h = q[1], w = q[2];
        ctx.fillStyle = hol; ctx.beginPath(); rgLens(ctx, bx + L.side * w * 0.6, by - 0.1, w * 1.4, 0.05, h * 0.25, 0); ctx.fill();
        poly(ctx, [bx - w, by, bx - w * 0.55, by + h * 0.8, bx - w * 0.1, by + h, bx + w * 0.5, by + h * 0.75, bx + w, by], rockC);
        poly(ctx, [bx - w * 0.1, by + h, bx + w * 0.5, by + h * 0.75, bx + w, by, bx + w * 0.2, by], rockD);
        poly(ctx, [bx - w, by, bx - w * 0.55, by + h * 0.8, bx - w * 0.35, by + h * 0.3, bx - w * 0.6, by], rockL);
        if (env.s > 12) { ctx.strokeStyle = rockD; ctx.lineWidth = Math.max(0.03, env.px * 0.7); ctx.beginPath(); ctx.moveTo(bx - w * 0.3, by + h * 0.35); ctx.lineTo(bx + w * 0.1, by + h * 0.5); ctx.lineTo(bx + w * 0.05, by + h * 0.1); ctx.moveTo(bx + w * 0.4, by + h * 0.55); ctx.lineTo(bx + w * 0.6, by + h * 0.15); ctx.stroke(); }
        poly(ctx, [bx - w * 0.62, by + h * 0.72, bx - w * 0.1, by + h + 0.12, bx + w * 0.55, by + h * 0.72, bx + w * 0.2, by + h * 0.6, bx - w * 0.3, by + h * 0.55], snowS);
      });
    } });
    // loose snow blowing over the brow of the spur
    PS.add({ x0: -200, x1: 200, layer: 2, draw(ctx, env) {
      const w = env.wind, a = Math.min(1, Math.abs(w) / 7); if (a < 0.1 || env.y0 > sy + 6) return;
      const dir = w < 0 ? -1 : 1, span = 14, first = Math.floor(env.x0 / span) - 1, last = Math.ceil(env.x1 / span);
      for (let pass = 0; pass < 2; pass++) {
        ctx.fillStyle = pass ? '#ffffff' : shadeS; ctx.globalAlpha = (pass ? 0.5 : 0.28) * (0.4 + 0.6 * a); ctx.beginPath();
        for (let i = first; i <= last; i++) for (let j = 0; j < 2; j++) {
          const ph = rgHash(i * 5.3 + j * 2.9 + sd), u = (((env.t * w * 0.9 + ph * span * 5) % span) + span) % span, fade = Math.sin((u / span) * Math.PI), xh = i * span + u, len = (1.5 + 3.5 * a) * (0.6 + 0.8 * ph) * (0.4 + 0.6 * fade), th = 0.05 + 0.05 * ph;
          const yy = top(xh) + 0.05 + j * 0.12 + Math.sin(env.t * 2 + ph * 9) * 0.03 - (pass ? 0 : th * 1.4);
          ctx.moveTo(xh - dir * len, yy - 0.05); ctx.quadraticCurveTo(xh - dir * len * 0.35, yy + th * 2.4, xh, yy + th * 0.5); ctx.quadraticCurveTo(xh - dir * len * 0.3, yy - th * 1.2, xh - dir * len, yy - 0.05);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } });
    [[-15.5, 9.5], [-19.5, 12], [16.5, 11], [20.5, 8]].forEach((q) => K.pine(S, PS, q[0], q[1], { snow: true, y: sy + Math.abs(q[0]) * 0.1 - 0.5, solid: false }));
    const zL = ez + 46, PL = S.plane(zL, 'lip'), ly = yAt(zL, lowMil - 30), lipC = S.tone(lighten(snowC, 0.3), PL), grass = S.tone('#8a8468', PL), lipH = S.tone(mix(snowC, '#6f86a8', 0.16), PL), lipTop = [];
    for (let x = -60; x <= 60; x += 1) lipTop.push(ly + 0.35 * vnoise(x / 2.1, sd + 5) + 0.15 * vnoise(x / 0.6, sd + 7));
    PL.add({ x0: -60, x1: 60, layer: 0, draw(ctx, env) {
      ctx.fillStyle = lipC; ctx.beginPath(); ctx.moveTo(-60, ly - 30);
      for (let i = 0; i < lipTop.length; i++) ctx.lineTo(i - 60, lipTop[i]);
      ctx.lineTo(60, ly - 30); ctx.closePath(); ctx.fill();
      ctx.fillStyle = lipH; ctx.beginPath(); for (let i = 0; i < 30; i++) { const gx = -14 + i * 0.97 + Math.sin(i * 4.1) * 0.4; rgLens(ctx, gx, ly - 0.25 - (i % 5) * 0.22, 0.5 + (i % 3) * 0.25, 0.005, 0.035, L.side * 0.1); } ctx.fill();
      ctx.strokeStyle = grass; ctx.lineWidth = Math.max(0.012, env.px * 0.8); ctx.beginPath();
      for (let i = 0; i < 26; i++) { const gx = -9 + i * 0.71 + Math.sin(i * 7.3) * 0.3, gy = ly + 0.35 * vnoise(gx / 2.1, sd + 5), sw = env.wind * 0.012 + Math.sin(env.t * 3 + i) * 0.006 * Math.min(4, Math.abs(env.wind)); for (let b = -1; b <= 1; b++) { ctx.moveTo(gx, gy - 0.02); ctx.quadraticCurveTo(gx + b * 0.04, gy + 0.1, gx + b * 0.07 + sw, gy + 0.2 + (i % 3) * 0.06); } }
      ctx.stroke();
    } });
  }
  rgSky(S, PM1, PM2, PA, eye);

  // placements
  const spot = (P, zone) => (x, extra) => Object.assign({ plane: P, x, y: 0, zone, room: null, behind: false }, extra || {});
  H.yard = spot(PM, 'yard'); H.back = spot(PB, 'back'); H.rear = spot(PRr, 'rear'); H.front = spot(PF, 'front'); H.road = spot(PA, 'road');
  H.onPad = (x, extra) => Object.assign({ plane: PM, x, y: 0, zone: 'pad', room: null, behind: false }, extra || {});
  H.milOf = (z, y) => ((y - E) / d(z)) * 1000;
  return H;
};
