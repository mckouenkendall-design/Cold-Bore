// ---------------------------------------------------------------------------
// The Port Calder docks: a finger quay seen from across the fishing basin.
//
// From far to near: the city, the far shore with its cranes, the breakwater
// and its lighthouse, the open channel, a freighter moored on the far side of
// the quay, the quay itself (warehouse and office, container stacks, a crane,
// lamps), a wooden pier that carries on from the end of the quay, and the
// basin water in front, where launches, barges and yachts tie up.
//
// Heights: the quay top and the pier deck are y = 0. The water is y = -2.2.
// Everything a mission needs is switched on or moved with options, and the
// function hands back placement helpers: H.quay(x), H.pier(x),
// H.onContainers(x), H.inOffice(x), H.onShip(x), H.barge(x), H.deck(x),
// H.sun(x), H.fore(x), H.saloon(x).
//
// How the picture hangs together (this is art only, none of it changes what a
// mission is):
//   dkOf(S)     what several pieces must agree on: the water planes, the
//               lights and hulls that the water mirrors, and the camera.
//   dkCamNote   works out where the eye is from the planes as they are drawn,
//               so a reflection sits under the light that casts it, and the
//               quay top, the pier deck and the far row of piles are drawn
//               with real depth from wherever the shooter is.
//   dkPool      lamp light lying on a surface. It follows S.lightAt, so the
//               light you see is the light the guards have.
//   dkGlow      a soft halo, stamped from a ready-made picture (cheap).
// ---------------------------------------------------------------------------
function dkHash(n) { const v = Math.sin(n * 12.9898 + 4.1) * 43758.5453; return v - Math.floor(v); }

// ---- soft light ---------------------------------------------------------------
// Halos are stamped from a small ready-made picture instead of building a
// gradient every time: much cheaper on a phone and just as smooth. rgb is "r,g,b".
const dkGlowPics = {};
function dkGlowPic(rgb) {
  let c = dkGlowPics[rgb]; if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 96;
  const x = c.getContext('2d'), g = x.createRadialGradient(48, 48, 0, 48, 48, 48), st = [0, 1, 0.07, 0.88, 0.18, 0.56, 0.34, 0.3, 0.54, 0.13, 0.76, 0.04, 1, 0];
  for (let i = 0; i < st.length; i += 2) g.addColorStop(st[i], 'rgba(' + rgb + ',' + st[i + 1] + ')');
  x.fillStyle = g; x.fillRect(0, 0, 96, 96);
  return (dkGlowPics[rgb] = c);
}
function dkGlow(ctx, x, y, r, rgb, a, ry) {
  if (!(a > 0.004)) return;
  const ga = ctx.globalAlpha, op = ctx.globalCompositeOperation; ry = ry || r;
  ctx.globalAlpha = ga * Math.min(1, a); ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(dkGlowPic(rgb), x - r, y - ry, r * 2, ry * 2);
  ctx.globalAlpha = ga; ctx.globalCompositeOperation = op;
}
// A beacon that swells and fades instead of snapping on and off. It is lit
// while sin(t * rate + phase) is above `thr`.
function dkPulse(t, rate, phase, thr) { return smooth((Math.sin(t * rate + phase) - thr) / 0.32 + 0.5); }

// Lamp light lying on a surface: for every working lamp of the zone, one soft
// bar that is brightest under the lamp and gone at 1.3 times its reach. That is
// the curve S.lightAt uses. kk and ex shift it for a surface that is on a
// different plane from the lamps (see dkCamNote). xa..xb is as far as the
// surface runs.
const DK_POOL_U = [0, 0.077, 0.154, 0.231, 0.308, 0.385, 0.615, 0.692, 0.769, 0.846, 0.923, 1];
const DK_POOL_V = [0, 0.104, 0.352, 0.648, 0.896, 1, 1, 0.896, 0.648, 0.352, 0.104, 0];
const dkPoolCss = {};
function dkPool(ctx, env, S, zone, y, h, str, kk, ex, xa, xb) {
  const ls = S.zoneLamps[zone]; if (!ls || S.pal.dark <= 0.3 || h <= 0) return;
  kk = kk || 1; ex = ex || 0; str *= S.pal.dark > 0.5 ? 1 : 0.45;
  const lo = Math.max(env.x0 - 1, xa === undefined ? -1e9 : xa), hi = Math.min(env.x1 + 1, xb === undefined ? 1e9 : xb); if (hi <= lo) return;
  const key = str.toFixed(2); let css = dkPoolCss[key];
  if (!css) { css = dkPoolCss[key] = []; for (let i = 0; i < 12; i++) css.push('rgba(255,222,150,' + (DK_POOL_V[i] * str).toFixed(3) + ')'); }
  const op = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < ls.length; i++) {
    const lp = ls[i]; if (!lp.alive || lp.on === false) continue;
    const r = (lp.reach || 9) * 1.3 * kk, x = ex + (lp.x - ex) * kk, a = Math.max(lo, x - r), b = Math.min(hi, x + r); if (b <= a) continue;
    const g = ctx.createLinearGradient(x - r, 0, x + r, 0);
    for (let j = 0; j < 12; j++) g.addColorStop(DK_POOL_U[j], css[j]);
    ctx.fillStyle = g; ctx.fillRect(a, y, b - a, h);
  }
  ctx.globalCompositeOperation = op;
}

// ---- what the pieces of one docks scene share -----------------------------------
function dkOf(S) {
  return S.dk || (S.dk = { seas: [], lights: [], mirrors: [], dyn: [], ready: false, far: null, sunA: 0, sunCss: '#fff',
    cam: { ex: 0, ey: 20, ez: 0, s0: 1, xc0: 0, yc0: 0, z0: 0, fresh: false } });
}
// Every water plane reports here as it is drawn. From the first two of a frame
// this works out where the eye is (x, y and distance). Nearer planes then use
// it: a point (X, Y) on a plane at distance Z shows on a plane at distance z at
//   x = ex + (X - ex) * k,  y = ey + (Y - ey) * k,  k = (z - ez) / (Z - ez).
function dkCamNote(dk, P, env) {
  const c = dk.cam, xc = (env.x0 + env.x1) / 2, yc = env.y0 === undefined ? 0 : (env.y0 + env.y1) / 2;
  if (P === dk.far) { c.s0 = env.s; c.xc0 = xc; c.yc0 = yc; c.z0 = P.z; c.fresh = true; dk.dyn.length = 0; return; }
  if (!c.fresh) return;
  c.fresh = false;
  const s1 = c.s0, s2 = env.s; if (Math.abs(s1 - s2) < 1e-9 || env.y0 === undefined) return;
  const ez = (s1 * c.z0 - s2 * P.z) / (s1 - s2), d1 = c.z0 - ez, d2 = P.z - ez;
  const ax = (c.xc0 - xc) / (d1 - d2), ay = (c.yc0 - yc) / (d1 - d2);
  c.ez = ez; c.ex = xc - ax * d2; c.ey = yc - ay * d2;
}
// A light the water should mirror. o: { P, x, y, rgb, a, w, ob (a lamp: the
// reflection dies with it), fn(t) (0..1, for lights that flash), len (how far
// past its mirror point the streak runs), near (water closer to the shooter
// than this distance does not show it: something is in the way) }.
function dkLight(S, o) { o.css = 'rgb(' + (o.rgb || '255,222,150') + ')'; dkOf(S).lights.push(o); return o; }
// Something standing in the water whose dark shape the water should mirror.
// h0..h1 is how high above the water the mirrored part is.
function dkMirror(S, P, x0, x1, h0, h1, col, a) { dkOf(S).mirrors.push({ P, x0, x1, h0, h1, col, a: a === undefined ? 0.5 : a }); }

// One light lying on the water: a column of short bright bars from the waterline
// under it (y0) through its mirror point (ym) to yEnd, brightest at the mirror
// point, widening and wandering more the nearer they come. Only the part
// between top and bot is drawn, so several strips of water can share one
// reflection. The caller sets the 'lighter' blend and resets globalAlpha after.
function dkStreak(ctx, px, t, x, y0, ym, yEnd, top, bot, w, a, css, seed) {
  if (bot >= top) return;
  const full = y0 - yEnd, step = Math.max(px * 3.2, full / 32, 0.3 * w), th = Math.max(px * 1.1, Math.min(step * 0.3, 0.12 * w)), um = (y0 - ym) / full;
  ctx.fillStyle = css;
  for (let j = Math.max(0, Math.ceil((y0 - top) / step - 0.5)); ; j++) {
    const yy = y0 - (j + 0.5) * step; if (yy < bot) break;
    const u = (y0 - yy) / full, pr = u < um ? 0.5 + 0.5 * (u / um) : 1 - (u - um) / (1 - um), hj = Math.sin(j * 7.13 + seed) * 0.5 + 0.5, ww = w * (0.7 + 1.5 * u) * (0.45 + 0.9 * hj);
    ctx.globalAlpha = Math.min(1, a * pr * pr * (0.72 + 0.28 * Math.sin(t * 3.1 + j * 2.7 + seed)));
    ctx.fillRect(x - ww / 2 + Math.sin(t * (1.5 + (j % 5) * 0.21) + j * 1.9 + seed) * ww * (0.12 + 0.5 * u), yy - th / 2, ww, th);
  }
}

// Foam lapping where something stands in the water: a broken pale line that breathes.
function dkFoam(ctx, env, x0, x1, y, seed, col) {
  const xa = Math.max(x0, env.x0 - 1), xb = Math.min(x1, env.x1 + 1); if (xb <= xa || env.s < 3.2) return;
  const step = 0.5 * Math.pow(2, Math.max(0, Math.ceil(Math.log2(env.px * 16)))), t = env.t;
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(env.px * 1.1, 0.045); ctx.beginPath();
  for (let x = Math.floor(xa / step) * step; x < xb; x += step) {
    const h = dkHash(x * 1.31 + seed); if (h > 0.66) continue;
    const br = 0.5 + 0.5 * Math.sin(t * (0.9 + h) + h * 40), a = Math.max(x0, x + h * step * 0.5), b = Math.min(x1, a + step * (0.22 + 0.62 * br)); if (b <= a) continue;
    const yy = y - (h > 0.33 ? 0.01 : 0.09 + 0.03 * br);
    ctx.moveTo(a, yy); ctx.lineTo(b, yy);
  }
  ctx.stroke();
}

// ---- open water -------------------------------------------------------------
// A harbour is several of these at different distances. Each one paints the
// strip of water between its own waterline and the next nearer one, so a boat
// sits "in" its own strip. The ripples lie at fixed places on the surface, so
// they slide past each other correctly as the scope pans, and every light and
// hull registered with dkLight / dkMirror is mirrored in whichever strips its
// reflection crosses.
const DK_BUF = 1536, dkBuf = new Float32Array(DK_BUF);
function dkSeaSetup(S, dk) {
  dk.ready = true;
  const seas = dk.seas; seas.sort((a, b) => b.P.z - a.P.z); dk.far = seas[0].P;
  const q = 0.984; let zr = seas[0].P.z * q, k = 0;
  for (let i = 0; i < seas.length; i++) {
    const me = seas[i], nx = seas[i + 1] || null; me.nxt = nx; me.bot = nx ? nx.col : mix(me.col, '#00040a', 0.35);
    const zEnd = nx ? nx.P.z : Math.max(16, me.P.z * 0.15);
    while (zr > zEnd) { me.rows.push(zr, k); zr *= q; k++; }
  }
  // every lamp in the scene shines on the water (the missions add their own after the scene is built)
  for (let i = 0; i < S.objects.length; i++) { const ob = S.objects[i]; if (ob.kind === 'lamp' && ob.plane) dkLight(S, { P: ob.plane, x: ob.x, y: ob.y, a: S.pal.dark > 0.5 ? 0.85 : 0.32, w: 0.55, ob }); }
  const clear = S.weather === 'clear', fog = S.weather === 'fog';
  dk.sunA = clear ? (S.pal.dark > 0.5 ? 0.42 : 0.6) : fog ? 0.22 : 0; dk.sunCss = S.pal.sun;
}
K.sea = function (S, P, o) {
  o = o || {};
  const y = o.y === undefined ? -2.2 : o.y, night = S.pal.dark > 0.5;
  const base = o.deep ? darken(o.col || S.pal.water, o.deep) : (o.col || S.pal.water);
  let col = S.tone(base, P);
  if (o.sheen) col = mix(col, S.tone(o.sheen, P, true), 0.6);       // the sky lying on the water near the horizon
  const hi = mix(col, night ? '#8fa6cc' : '#ffffff', o.shine === undefined ? (night ? 0.17 : 0.26) : o.shine), lo = mix(col, '#000812', night ? 0.34 : 0.17);
  const X0 = o.x0 === undefined ? -6000 : o.x0, X1 = o.x1 === undefined ? 6000 : o.x1;
  const dk = dkOf(S), me = { P, y, col, hi, lo, X0, X1, nxt: null, bot: col, rows: [], sd: o.seed || Math.round(P.z) };
  dk.seas.push(me);
  if (o.ground !== false) { P.groundY = y; P.groundMat = 'water'; }
  P.add({ x0: X0, x1: X1, layer: o.layer || 0, draw(ctx, env) { dkSeaDraw(ctx, env, S, dk, me); } });
};
function dkSeaDraw(ctx, env, S, dk, me) {
  if (!dk.ready) dkSeaSetup(S, dk);
  const P = me.P, y = me.y;
  dkCamNote(dk, P, env);
  const c = dk.cam, dP = P.z - c.ez; if (dP < 1) return;
  const px = env.px, s = env.s, t = env.t, exx = c.ex, eyy = c.ey;
  const xa = Math.max(env.x0 - 2 * px, me.X0), xb = Math.min(env.x1 + 2 * px, me.X1); if (xb <= xa) return;
  const e0 = env.y0 === undefined ? y - 400 : env.y0, e1 = env.y1 === undefined ? y : env.y1;
  let ybn = y - dP * 0.22, cut = false;                    // where the next nearer water starts, in this plane's metres
  if (me.nxt) { const dn = me.nxt.P.z - c.ez; if (dn > 2.2) { ybn = eyy + (me.nxt.y - eyy) * dP / dn; cut = true; } }
  const yb = Math.max(e0 - 2 * px, cut ? ybn - 2 * px : y - 400), yt = Math.min(y, e1 + 2 * px); if (yb >= yt) return;
  if ((y - ybn) * s < 6) R4(ctx, xa, yb, xb - xa, yt - yb, me.col);
  else { const g = ctx.createLinearGradient(0, y, 0, ybn); g.addColorStop(0, me.col); g.addColorStop(1, me.bot); ctx.fillStyle = g; ctx.fillRect(xa, yb, xb - xa, yt - yb); }

  // dark shapes: the quay wall, piles and hulls mirrored in the water, broken into bands
  const ms = dk.mirrors;
  for (let i = 0; i < ms.length; i++) {
    const M = ms[i]; if (M.P.z < P.z - 0.01) continue;
    const kk = dP / (M.P.z - c.ez), x0 = Math.max(xa, exx + (M.x0 - exx) * kk), x1 = Math.min(xb, exx + (M.x1 - exx) * kk); if (x1 <= x0) continue;
    const full0 = eyy + (y - M.h0 - eyy) * kk, full1 = eyy + (y - M.h1 - eyy) * kk, top = Math.min(yt, full0), bot = Math.max(yb, full1); if (bot >= top - px * 0.6) continue;
    const n = clamp(Math.ceil((top - bot) * s / 3.4), 1, 7), bh = (top - bot) / n, small = M.x1 - M.x0 < 60, wd = Math.min(0.3, (x1 - x0) * 0.2);
    ctx.fillStyle = M.col;
    for (let j = 0; j < n; j++) {
      const yy = top - (j + 1) * bh, u = (y - (yy + bh * 0.5)) / Math.max(0.01, y - full1), wob = small ? Math.sin(t * 1.3 + j * 1.9 + M.x0) * wd * (0.25 + u) : 0;
      ctx.globalAlpha = M.a * (1 - 0.72 * u);
      ctx.fillRect(x0 + wob, yy, x1 - x0, bh * (n > 2 ? 0.8 : 1));
    }
  }
  ctx.globalAlpha = 1;

  // ripples
  const rows = me.rows, nr = rows.length >> 1, refZ = S.refZ;
  let stride = 1;
  if (nr) {
    const d0 = rows[0] - c.ez, gapPx = (eyy - y) * dP * rows[0] * 0.016 / Math.max(1, d0 * (d0 - rows[0] * 0.016)) * s;
    if (gapPx > 0 && gapPx < 2.9) stride = Math.pow(2, Math.ceil(Math.log2(2.9 / gapPx)));
    const dirw = env.wind >= 0 ? 1 : -1, sd = me.sd; let nd = 0;
    ctx.lineWidth = Math.max(px * 1.05, 0.03); ctx.strokeStyle = me.hi; ctx.beginPath();
    for (let i = 0; i < nr; i++) {
      const zr = rows[i * 2], kI = rows[i * 2 + 1]; if (kI % stride) continue;
      const dr = zr - c.ez; if (dr < 4) break;
      const k = dP / dr, yy0 = eyy + (y - eyy) * k; if (yy0 > yt) continue; if (yy0 < yb) break;
      const W0 = 2.3 * zr / refZ, lv = Math.max(0, Math.ceil(Math.log2(26 / (W0 * k * s)))), m = Math.pow(2, lv), W = W0 * m;
      const sh = t * (0.2 + (kI % 3) * 0.07) * dirw * (zr / refZ), w0 = exx + (xa - exx) / k - sh, w1 = (exx + (xb - exx) / k - sh) / W0;
      const bob = zr * 0.016 * k * ((eyy - y) / dr) * 0.2;
      for (let I = Math.floor(w0 / W) * m; I < w1; I += m) {
        const h = dkHash(I * 0.3713 + kI * 17.31 + sd); if (h > 0.5) continue;
        const xw = (I + h * 0.9) * W0 + sh, len = W0 * (0.22 + h * 1.5) * (0.72 + 0.28 * Math.sin(t * 1.1 + I * 2.3 + kI)) * k;
        const x1 = exx + (xw - exx) * k, yy = yy0 + Math.sin(t * 0.8 + I * 1.7 + kI * 0.9) * bob;
        if ((h * 61.7) % 1 > 0.68) { if (nd < DK_BUF - 3) { dkBuf[nd++] = x1; dkBuf[nd++] = yy; dkBuf[nd++] = x1 + len * 0.8; } }
        else { ctx.moveTo(x1, yy); ctx.lineTo(x1 + len, yy); }
      }
    }
    ctx.stroke();
    if (nd) { ctx.strokeStyle = me.lo; ctx.beginPath(); for (let i = 0; i < nd; i += 3) { ctx.moveTo(dkBuf[i], dkBuf[i + 1]); ctx.lineTo(dkBuf[i + 2], dkBuf[i + 1]); } ctx.stroke(); }

    // the sun or the moon laid along the water toward you: a path of glitter under it
    if (dk.sunA > 0) {
      const ths = S.sky.sun[1] / 1000, sx = S.sky.sun[0] / 1000; let any = false;
      ctx.strokeStyle = dk.sunCss; ctx.beginPath();
      for (let i = 0; i < nr; i++) {
        const zr = rows[i * 2], kI = rows[i * 2 + 1]; if (kI % stride) continue;
        const dr = zr - c.ez; if (dr < 4) break;
        const th = (eyy - y) / dr; if (th < ths * 0.9) continue;
        const wgt = 1 - (th - ths) / (ths * 2.1); if (wgt <= 0) break;
        const k = dP / dr, yy0 = eyy + (y - eyy) * k; if (yy0 > yt) continue; if (yy0 < yb) break;
        const xs = exx + sx * dr, spread = dr * (0.006 + 0.012 * (th / ths - 1)), x0 = exx + (xs - exx) * k;
        if (x0 + spread * k < xa || x0 - spread * k > xb) continue;
        const n = 2 + Math.round(5 * wgt);
        for (let j = 0; j < n; j++) {
          const h = dkHash(kI * 7.7 + j * 3.3 + me.sd), tw = Math.sin(t * (1.6 + h * 2.6) + j * 5.1 + kI * 2.3); if (tw < -0.2) continue;
          const xw = xs + (h - 0.5) * 2 * spread * (0.35 + 0.65 * dkHash(j * 1.7 + kI)), len = spread * (0.1 + 0.2 * h) * (0.5 + 0.5 * tw) * k, x1 = exx + (xw - exx) * k;
          ctx.moveTo(x1 - len / 2, yy0); ctx.lineTo(x1 + len / 2, yy0); any = true;
        }
      }
      if (any) { ctx.globalAlpha = dk.sunA; ctx.lineWidth = Math.max(px * 1.3, 0.04); ctx.stroke(); ctx.globalAlpha = 1; }
    }
  }

  // lights: each one a column of short bright bars under it, longest and widest toward you
  if (dk.lights.length || dk.dyn.length) {
    ctx.globalCompositeOperation = 'lighter';
    for (let pass = 0; pass < 2; pass++) {
      const ls = pass ? dk.dyn : dk.lights;
      for (let i = 0; i < ls.length; i++) {
        const L = ls[i]; if (L.P.z < P.z - 0.01 || (L.near && P.z < L.near)) continue;
        if (L.ob && (!L.ob.alive || L.ob.on === false)) continue;
        let a = L.a; if (L.fn) a *= L.fn(t); if (a < 0.02) continue;
        const kk = dP / (L.P.z - c.ez), x = exx + (L.x - exx) * kk; if (x < xa - 8 || x > xb + 8) continue;
        const H = Math.max(0.3, L.y - y), y0 = eyy + (y - eyy) * kk, ym = eyy + (y - H - eyy) * kk, yEnd = y0 - (y0 - ym) * (L.len || 1.9) - 0.6 * kk;
        dkStreak(ctx, px, t, x, y0, ym, yEnd, Math.min(yt, y0), Math.max(yb, yEnd), (L.w || 0.5) * kk, a, L.css, L.x);
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  // rain: rings where the drops land
  if ((S.weather === 'rain' || S.weather === 'storm') && P.z <= refZ + 40 && (yt - yb) * s > 5) {
    const n = S.weather === 'storm' ? 16 : 11, kq = 1 / (y - eyy);
    ctx.strokeStyle = me.hi; ctx.lineWidth = Math.max(px, 0.025);
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = pass ? 0.3 : 0.75; ctx.beginPath();
      for (let i = pass; i < n; i += 2) {
        const ph = t * (0.9 + (i % 4) * 0.13) + i * 0.37, cyc = Math.floor(ph), u = ph - cyc;
        const rx = xa + dkHash(i * 12.7 + cyc * 3.1 + me.sd) * (xb - xa), ry = yb + dkHash(i * 5.3 + cyc * 9.7 + me.sd) * (yt - yb), k = (ry - eyy) * kq;
        const r = (0.1 + (u + pass) * 0.32) * k, tilt = clamp(((eyy - y) * k) / dP * 1.3, 0.08, 0.5);
        ctx.moveTo(rx + r, ry); ctx.ellipse(rx, ry, r, r * tilt, 0, 0, TAU);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

// What a thing standing in the water looks like mirrored in it: its own colour sunk into the water's.
function dkMirCol(S, P, hex) { return mix(S.tone(hex, P), S.tone(darken(S.pal.water, 0.25), P), 0.5); }
// A gull, standing. About 0.4 m long: obviously a bird, and drawn behind the people.
// w, g, b are its white, grey and beak colours. dir 1 faces right.
function dkGull(ctx, env, x, y, dir, w, g, b, ink, asleep) {
  const s = env.s;
  if (s < 3.5) return;
  if (s < 9) { R4(ctx, x - 0.17, y + 0.1, 0.34, 0.16, w); R4(ctx, x + dir * 0.08 - 0.06, y + 0.24, 0.12, 0.12, w); return; }
  const t = env.t, look = asleep ? 0 : (Math.sin(t * 0.43 + x * 3.1) > 0.55 ? -1 : 1) * dir, nod = asleep ? -0.04 : Math.sin(t * 2.1 + x) > 0.93 ? -0.03 : 0;
  ctx.strokeStyle = b; ctx.lineWidth = Math.max(0.018, env.px * 0.7); ctx.beginPath(); ctx.moveTo(x - 0.03, y); ctx.lineTo(x - 0.03, y + 0.1); ctx.moveTo(x + 0.04, y); ctx.lineTo(x + 0.04, y + 0.1); ctx.stroke();
  ctx.fillStyle = w; ctx.beginPath(); ctx.ellipse(x, y + 0.19, 0.2, 0.1, dir * 0.12, 0, TAU); ctx.fill();
  poly(ctx, [x - dir * 0.26, y + 0.2, x - dir * 0.02, y + 0.27, x + dir * 0.08, y + 0.18, x - dir * 0.06, y + 0.14], g);       // folded wing
  poly(ctx, [x - dir * 0.33, y + 0.17, x - dir * 0.2, y + 0.23, x - dir * 0.2, y + 0.16], ink);                              // dark wing tip
  const hx = x + dir * (asleep ? 0.06 : 0.14), hy = y + 0.33 + nod;
  circ(ctx, hx, hy, 0.065, w);
  if (!asleep) { poly(ctx, [hx + look * 0.05, hy + 0.02, hx + look * 0.15, hy - 0.01, hx + look * 0.05, hy - 0.03], b); if (s > 26) circ(ctx, hx + look * 0.025, hy + 0.015, 0.012, ink); }
}

// A wind sock on a pole: hangs limp in a calm, stands straight out at about 6 m/s.
// (Kept under its own name: another location has a wind sock of its own.)
K.dkWindsock = function (S, P, x, y, h, o) {
  o = o || {};
  const pole = S.tone('#c9ced3', P), pole2 = S.tone('#868d94', P), c1 = S.tone('#e2672b', P, true), c2 = S.tone('#f1ede2', P, true), c1d = S.tone('#b9501f', P, true), c2d = S.tone('#cfcabd', P, true), len = o.len || 1.9;
  P.add({ x0: x - len - 1.2, x1: x + len + 1.2, layer: o.layer === undefined ? 2 : o.layer, draw(ctx, env) {
    const s = env.s;
    if (s > 6) { ctx.strokeStyle = pole2; ctx.lineWidth = Math.max(0.018, env.px * 0.5); ctx.beginPath(); ctx.moveTo(x, y + h * 0.6); ctx.lineTo(x - 0.8, y); ctx.moveTo(x, y + h * 0.6); ctx.lineTo(x + 0.8, y); ctx.stroke(); }
    R4(ctx, x - 0.17, y, 0.34, 0.08, pole2);
    line(ctx, x, y, x, y + h, pole, 0.085, env);
    if (s > 9) { R4(ctx, x - 0.07, y + h * 0.33, 0.14, 0.05, pole2); R4(ctx, x - 0.07, y + h * 0.66, 0.14, 0.05, pole2); }
    const w = env.wind, a = clamp(Math.abs(w) / 6.5, 0.06, 1), dir = w >= 0 ? 1 : -1, top = y + h - 0.3, t = env.t;
    const ang = a * (Math.PI / 2 - 0.1) + Math.sin(t * (3 + a * 8)) * 0.06 * (0.4 + a);
    const ux = dir * Math.sin(ang), uy = -Math.cos(ang), nx = -uy, ny = ux;
    const wav = (u) => Math.sin(t * (5 + a * 7) - u * 5.2) * 0.07 * u * (0.25 + a);
    for (let i = 0; i < 5; i++) {
      const u0 = i / 5, u1 = (i + 1) / 5, r0 = 0.3 * (1 - u0 * 0.55), r1 = 0.3 * (1 - u1 * 0.55), w0 = wav(u0), w1 = wav(u1);
      const ax = x + ux * len * u0 + nx * w0, ay = top + uy * len * u0 + ny * w0, bx = x + ux * len * u1 + nx * w1, by = top + uy * len * u1 + ny * w1;
      poly(ctx, [ax + nx * r0, ay + ny * r0, bx + nx * r1, by + ny * r1, bx - nx * r1, by - ny * r1, ax - nx * r0, ay - ny * r0], i % 2 ? c2 : c1);
      // the underside of the cloth sits in its own shade
      if (s > 5) { const sg = ny >= 0 ? -1 : 1; poly(ctx, [ax + sg * nx * r0 * 0.25, ay + sg * ny * r0 * 0.25, bx + sg * nx * r1 * 0.25, by + sg * ny * r1 * 0.25, bx + sg * nx * r1, by + sg * ny * r1, ax + sg * nx * r0, ay + sg * ny * r0], i % 2 ? c2d : c1d); }
    }
    // the hoop that holds its mouth open, and the swivel
    ctx.strokeStyle = pole2; ctx.lineWidth = Math.max(0.04, env.px * 0.8); ctx.beginPath(); ctx.moveTo(x + nx * 0.31, top + ny * 0.31); ctx.lineTo(x - nx * 0.31, top - ny * 0.31); ctx.stroke();
    circ(ctx, x, y + h, 0.07, pole2);
  } });
};

// A small pennant on a masthead. Streams with the wind, droops without it.
// o.sway(t) gives the sideways movement of the mast it flies from.
K.pennant = function (S, P, x, y, len, col, o) {
  o = o || {}; const c = S.tone(col || '#c0392b', P, true), cd = S.tone(darken(col || '#c0392b', 0.24), P, true), sway = o.sway || null;
  P.add({ x0: x - len - 1.5, x1: x + len + 1.5, layer: o.layer === undefined ? 2 : o.layer, draw(ctx, env) {
    const x0 = x + (sway ? sway(env.t) : 0), w = env.wind, a = clamp(Math.abs(w) / 6, 0.05, 1), dir = w >= 0 ? 1 : -1, n = 6, t = env.t;
    const px = (u) => x0 + dir * u * len * (0.3 + 0.7 * a), py = (u) => y - (1 - a) * u * u * len * 0.8 + Math.sin(t * (4 + a * 8) - u * 5) * 0.1 * (0.3 + a) * u;
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x0, y);
    for (let i = 1; i <= n; i++) ctx.lineTo(px(i / n), py(i / n));
    for (let i = n - 1; i >= 0; i--) { const u = i / n; ctx.lineTo(px(u), py(u) - len * 0.34 * (1 - u)); }
    ctx.closePath(); ctx.fill();
    if (env.s > 7) { // the lower edge, in shade
      ctx.fillStyle = cd; ctx.beginPath(); ctx.moveTo(px(1), py(1));
      for (let i = n - 1; i >= 0; i--) { const u = i / n; ctx.lineTo(px(u), py(u) - len * 0.34 * (1 - u)); }
      for (let i = 0; i < n; i++) { const u = i / n; ctx.lineTo(px(u), py(u) - len * 0.23 * (1 - u)); }
      ctx.closePath(); ctx.fill();
    }
  } });
};

// A shipping container. Stacks of these are the walls of the place.
const DOCK_BOX_COLS = ['#a3402f', '#2f5f8a', '#3f7a58', '#c98a2b', '#7d838a', '#8a3b5c', '#2f7f86', '#b5562c'];
const DOCK_BOX_NAMES = ['CALDER LINE', 'NORHAV', 'TRITON', 'HALVARD', 'OKA', 'SEAWAY', 'BOREAL', 'P & C'];
const DK_BOX_OWNERS = ['CLDU', 'NRHU', 'TRTU', 'HLVU', 'OKAU', 'SWYU', 'BRLU', 'PNCU'];
K.cbox = function (S, P, x, y, col, o) {
  o = o || {}; const w = o.w || 6.1, h = o.h || 2.6;
  const c = S.tone(col, P), d = S.tone(darken(col, 0.2), P), d2 = S.tone(darken(col, 0.42), P), l = S.tone(lighten(col, 0.16), P), l2 = S.tone(lighten(col, 0.08), P), tc = S.tone(o.textCol || '#f1ede2', P);
  const steel = S.tone('#23272e', P), tcA = rgba(tc, 0.5), rust = rgba(S.tone('#6e3520', P), 0.55), shade = 'rgba(0,0,0,0.09)';
  // everything that differs from box to box is worked out here, once, from where the box is
  const hs = dkHash(x * 3.71 + y * 1.37 + col.charCodeAt(2) * 0.11), marks = [];
  for (let i = 0; i < 5; i++) { const q = dkHash(hs * 31 + i * 7.3); marks.push(x + 0.45 + q * (w - 0.9), dkHash(q * 91 + i), dkHash(q * 17 + 2.2)); }
  const idText = DK_BOX_OWNERS[Math.floor(dkHash(hs * 5.1) * 8)] + ' ' + (100000 + Math.floor(dkHash(hs * 77.7) * 899999)) + ' ' + Math.floor(dkHash(hs * 3.3) * 10);
  P.add({ x0: x, x1: x + w, layer: o.layer || 0, draw(ctx, env) {
    const s = env.s;
    R4(ctx, x, y, w, h, c);
    if (s > 2.4) { // corrugation: a dark groove, and close up the lit edge of each rib beside it
      ctx.fillStyle = d; for (let xx = x + 0.34; xx < x + w - 0.25; xx += 0.3) ctx.fillRect(xx, y + 0.17, 0.09, h - 0.34);
      if (s > 9) { ctx.fillStyle = l2; for (let xx = x + 0.43; xx < x + w - 0.25; xx += 0.3) ctx.fillRect(xx, y + 0.17, 0.04, h - 0.34); }
    }
    if (s > 3) R4(ctx, x, y, w, h * 0.32, shade);                                         // the lower part of the face sits in a little shade
    if (s > 5) { // rust weeping from the top rail, and scuffs where another box rubbed
      for (let i = 0; i < 15; i += 3) { const mx = marks[i], q = marks[i + 1], k = marks[i + 2];
        if (k < 0.55) { ctx.fillStyle = rust; ctx.fillRect(mx, y + h - 0.13 - (0.3 + q * 1.1), 0.05 + k * 0.08, 0.3 + q * 1.1); }
        else if (k < 0.8) { ctx.fillStyle = l2; ctx.fillRect(mx, y + 0.35 + q * (h - 0.9), 0.35 + k * 0.5, 0.045); } }
    }
    R4(ctx, x, y + h - 0.13, w, 0.13, l); R4(ctx, x, y, w, 0.15, d2);
    R4(ctx, x, y, 0.16, h, d2); R4(ctx, x + w - 0.16, y, 0.16, h, d2);
    if (s > 6) { // corner castings and the pockets a fork lift uses
      ctx.fillStyle = steel; ctx.fillRect(x, y, 0.2, 0.15); ctx.fillRect(x + w - 0.2, y, 0.2, 0.15); ctx.fillRect(x, y + h - 0.15, 0.2, 0.15); ctx.fillRect(x + w - 0.2, y + h - 0.15, 0.2, 0.15);
      ctx.fillRect(x + w * 0.3 - 0.18, y + 0.02, 0.36, 0.09); ctx.fillRect(x + w * 0.7 - 0.18, y + 0.02, 0.36, 0.09);
    }
    if (o.door && s > 2) { // locking bars, their keepers and handles
      ctx.fillStyle = d2; for (let i = 0; i < 4; i++) ctx.fillRect(x + w * (0.14 + i * 0.24), y + 0.2, 0.07, h - 0.4); R4(ctx, x + w / 2 - 0.03, y + 0.15, 0.06, h - 0.3, d2);
      if (s > 7) { ctx.fillStyle = steel; for (let i = 0; i < 4; i++) { const bx = x + w * (0.14 + i * 0.24); ctx.fillRect(bx - 0.06, y + 0.24, 0.19, 0.1); ctx.fillRect(bx - 0.06, y + h - 0.36, 0.19, 0.1); ctx.fillRect(bx - 0.02 + (i % 2 ? 0.07 : -0.3), y + h * 0.4, 0.3, 0.05); }
        ctx.fillRect(x + 0.2, y + h * 0.3, 0.12, 0.2); ctx.fillRect(x + 0.2, y + h * 0.68, 0.12, 0.2); ctx.fillRect(x + w - 0.32, y + h * 0.3, 0.12, 0.2); ctx.fillRect(x + w - 0.32, y + h * 0.68, 0.12, 0.2); }
    }
    if (o.text) {
      if (s > 2.4) R4(ctx, x + w * 0.18, y + h * 0.3, w * 0.64, h * 0.36, c);
      if (s > 7) { R4(ctx, x + w * 0.2, y + h * 0.3 + 0.05, w * 0.6, 0.04, tcA); R4(ctx, x + w * 0.2, y + h * 0.66 - 0.09, w * 0.6, 0.04, tcA); }
      env.text(ctx, o.text, x + w / 2, y + h * 0.37, Math.min(0.72, (w * 0.6) / (o.text.length * 0.5)), tc, 'center');
    } else if (s > 5 && !o.door) { R4(ctx, x + 0.55, y + h * 0.6, 1.2, 0.13, tcA); R4(ctx, x + 0.55, y + h * 0.49, 0.75, 0.13, tcA); }
    // owner's number and size code top right, the weights panel bottom right
    env.text(ctx, idText, x + w - 0.3, y + h - 0.5, 0.21, tc, 'right');
    env.text(ctx, '22G1', x + w - 0.3, y + h - 0.78, 0.18, tc, 'right');
    if (s > 14) { ctx.fillStyle = tcA; for (let i = 0; i < 4; i++) ctx.fillRect(x + w - 1.25, y + 0.3 + i * 0.1, 0.95 - (i % 2) * 0.3, 0.035); }
  } });
  if (o.solid !== false) P.solid(x, y, w, h, 'hard');
};

// A dockside crane: a portal the cargo passes under, a machinery house and a
// lattice jib. Returns where the tip of the jib is, for hanging a load from it.
K.dockCrane = function (S, P, x, o) {
  o = o || {};
  const reach = o.reach === undefined ? 9 : o.reach, dir = reach >= 0 ? 1 : -1, R = Math.abs(reach), tipY = o.tipY || 19, y = o.y || 0;
  const colHex = o.col || '#d6922a', c = S.tone(colHex, P), d = S.tone(darken(colHex, 0.3), P), hi = S.tone(lighten(colHex, 0.2), P), steel = S.tone('#2b3038', P), steel2 = S.tone('#48505b', P), ink = S.tone('#14171c', P);
  const lit = S.pal.dark > 0.3, win = S.tone(lit ? S.pal.lit : S.pal.glass, P, true), white = S.tone('#e6e2d6', P), rust = rgba(S.tone('#6e3a22', P), 0.5), shade = 'rgba(0,0,0,0.1)';
  const legH = 6.4, g = 2.7;
  if (lit) dkLight(S, { P, x: x + dir * -1.5, y: y + legH + 10.2, rgb: '255,70,50', a: 0.4, w: 0.4, fn: (t) => dkPulse(t, 2.4, x, 0.2) });
  P.add({ x0: x - Math.max(7, R + 1), x1: x + Math.max(7, R + 1), layer: o.layer || 0, draw(ctx, env) {
    const s = env.s, lw = (v) => Math.max(v, env.px * 0.9);
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    // portal: two box legs on wheeled bogies, knee braces, and the beam across
    R4(ctx, -g - 0.26, 0, 0.52, legH, steel); R4(ctx, g - 0.26, 0, 0.52, legH, steel);
    R4(ctx, -g - 0.26, 0, 0.1, legH, steel2); R4(ctx, g - 0.26, 0, 0.1, legH, steel2);
    if (s > 7) { // lacing up each leg
      ctx.strokeStyle = steel2; ctx.lineWidth = lw(0.035); ctx.beginPath();
      for (let k = -1; k <= 1; k += 2) for (let yy = 0.7; yy < legH - 1.6; yy += 0.9) { ctx.moveTo(k * g - 0.14, yy); ctx.lineTo(k * g + 0.24, yy + 0.45); ctx.lineTo(k * g - 0.14, yy + 0.9); }
      ctx.stroke();
    }
    R4(ctx, -g - 0.8, 0, 1.6, 0.42, steel); R4(ctx, g - 0.8, 0, 1.6, 0.42, steel);
    if (s > 5) { R4(ctx, -g - 0.8, 0.36, 1.6, 0.06, steel2); R4(ctx, g - 0.8, 0.36, 1.6, 0.06, steel2); ctx.fillStyle = ink; ctx.beginPath(); for (let k = -1; k <= 1; k += 2) for (let j = -1; j <= 1; j += 2) { ctx.moveTo(k * g + j * 0.45 + 0.15, 0.15); ctx.arc(k * g + j * 0.45, 0.15, 0.15, 0, TAU); } ctx.fill(); }
    ctx.strokeStyle = steel; ctx.lineWidth = lw(0.13);
    ctx.beginPath(); ctx.moveTo(-g, legH - 2.2); ctx.lineTo(-g + 1.7, legH - 0.5); ctx.moveTo(g, legH - 2.2); ctx.lineTo(g - 1.7, legH - 0.5); ctx.stroke();
    R4(ctx, -g - 0.55, legH - 0.75, g * 2 + 1.1, 0.75, c); R4(ctx, -g - 0.55, legH - 0.75, g * 2 + 1.1, 0.16, d); R4(ctx, -g - 0.55, legH - 0.07, g * 2 + 1.1, 0.07, hi);
    if (s > 3) { // hazard hatching: slanted black bars
      ctx.fillStyle = steel; ctx.beginPath();
      for (let i = 0; i < 9; i++) { const bx = -g - 0.3 + i * 0.68; ctx.moveTo(bx, legH - 0.54); ctx.lineTo(bx + 0.3, legH - 0.54); ctx.lineTo(bx + 0.46, legH - 0.3); ctx.lineTo(bx + 0.16, legH - 0.3); ctx.closePath(); }
      ctx.fill();
    }
    if (s > 6) { // a ladder up the outside of one leg, and a hand rail along the beam
      ctx.strokeStyle = steel2; ctx.lineWidth = lw(0.03); ctx.beginPath();
      ctx.moveTo(-g - 0.5, 0.45); ctx.lineTo(-g - 0.5, legH + 0.9); ctx.moveTo(-g - 0.32, 0.45); ctx.lineTo(-g - 0.32, legH);
      for (let yy = 0.7; yy < legH; yy += 0.36) { ctx.moveTo(-g - 0.5, yy); ctx.lineTo(-g - 0.32, yy); }
      ctx.moveTo(-g - 0.5, legH + 0.9); ctx.lineTo(-1.0, legH + 0.9); ctx.moveTo(1.1, legH + 0.9); ctx.lineTo(g + 0.5, legH + 0.9); ctx.lineTo(g + 0.5, legH);
      for (let xx = -g + 0.4; xx < -1.0; xx += 0.9) { ctx.moveTo(xx, legH); ctx.lineTo(xx, legH + 0.9); } for (let xx = 1.9; xx < g + 0.5; xx += 0.9) { ctx.moveTo(xx, legH); ctx.lineTo(xx, legH + 0.9); }
      ctx.stroke();
    }
    // slewing ring, counterweight, machinery house
    R4(ctx, -0.9, legH, 1.8, 0.55, steel); if (s > 8) R4(ctx, -0.9, legH + 0.2, 1.8, 0.05, steel2);
    R4(ctx, -4.3, legH + 0.75, 1.8, 2.0, steel);
    if (s > 4) { R4(ctx, -4.3, legH + 0.75, 0.14, 2.0, c); ctx.fillStyle = steel2; ctx.fillRect(-4.16, legH + 1.4, 1.66, 0.04); ctx.fillRect(-4.16, legH + 2.06, 1.66, 0.04); }
    R4(ctx, -2.5, legH + 0.55, 4.6, 2.9, c); R4(ctx, -2.5, legH + 3.2, 4.6, 0.25, d); R4(ctx, -2.5, legH + 0.55, 4.6, 0.18, d);
    if (s > 3) { // lower half in shade, a louvred panel, a door
      R4(ctx, -2.5, legH + 0.73, 4.6, 1.0, shade);
      R4(ctx, -2.25, legH + 1.05, 1.95, 1.8, d); ctx.fillStyle = c; for (let i = 0; i < 6; i++) ctx.fillRect(-2.17, legH + 1.14 + i * 0.28, 1.79, 0.13);
      if (s > 5) { R4(ctx, -0.12, legH + 0.75, 0.72, 1.95, d); R4(ctx, -0.05, legH + 0.82, 0.58, 1.81, c); R4(ctx, 0.38, legH + 1.65, 0.09, 0.06, steel); }
      if (s > 8) { ctx.fillStyle = rust; ctx.fillRect(-1.75, legH + 2.75, 0.07, 0.42); ctx.fillRect(-0.72, legH + 2.5, 0.06, 0.68); ctx.fillRect(1.05, legH + 0.75, 0.06, 0.6); ctx.fillRect(-g + 0.6, legH - 0.75, 0.06, 0.4); ctx.fillRect(g - 1.1, legH - 0.75, 0.07, 0.5); }
    }
    // the cab: glazed, leaning out toward the hook
    poly(ctx, [0.75, legH + 1.5, 2.12, legH + 1.5, 2.3, legH + 2.15, 2.08, legH + 2.85, 0.75, legH + 2.85], steel);
    poly(ctx, [0.87, legH + 1.92, 2.11, legH + 1.92, 2.18, legH + 2.15, 2.0, legH + 2.73, 0.87, legH + 2.73], win);
    if (s > 6) { R4(ctx, 1.42, legH + 1.92, 0.05, 0.81, steel); poly(ctx, [0.95, legH + 2.73, 1.2, legH + 2.73, 0.98, legH + 1.92, 0.87, legH + 1.92, 0.87, legH + 2.4], lit ? 'rgba(255,255,255,0.18)' : 'rgba(200,225,255,0.16)'); }
    // A-frame and stays
    const ax = -1.5, ay = legH + 10, px = 1.7, py = legH + 1.4, tx = R, ty = tipY;
    ctx.strokeStyle = c; ctx.lineWidth = lw(0.2);
    ctx.beginPath(); ctx.moveTo(-2.3, legH + 3.4); ctx.lineTo(ax, ay); ctx.lineTo(-0.2, legH + 3.4); ctx.stroke();
    if (s > 5) { ctx.lineWidth = lw(0.06); ctx.beginPath(); for (let i = 1; i < 6; i++) { const u = i / 6, v = (i + 1) / 6, yy = legH + 3.4 + (ay - legH - 3.4) * u, y2 = legH + 3.4 + (ay - legH - 3.4) * v; ctx.moveTo(-2.3 + (ax + 2.3) * u, yy); ctx.lineTo(-0.2 + (ax + 0.2) * u, yy); if (i < 5) ctx.lineTo(-2.3 + (ax + 2.3) * v, y2); } ctx.stroke(); }
    ctx.strokeStyle = steel; ctx.lineWidth = lw(0.07);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tx, ty); ctx.moveTo(ax, ay); ctx.lineTo(-3.6, legH + 2.7); ctx.stroke();
    // jib: two chords and the lacing between them
    const ux = tx - px, uy = ty - py, ul = Math.hypot(ux, uy), nx = -uy / ul, ny = ux / ul, wide = 0.95;
    if (s > 5) { ctx.lineWidth = lw(0.04); ctx.beginPath(); ctx.moveTo(ax, ay - 0.3); ctx.lineTo(px + ux * 0.6 + nx * wide * 0.4, py + uy * 0.6 + ny * wide * 0.4); ctx.stroke(); }
    ctx.strokeStyle = c; ctx.lineWidth = lw(0.19);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.moveTo(px + nx * wide, py + ny * wide); ctx.lineTo(tx, ty); ctx.stroke();
    if (s > 1.3) {
      ctx.lineWidth = lw(0.08); ctx.beginPath(); const n = Math.max(6, Math.round(ul / 1.5));
      for (let i = 0; i < n; i++) { const u0 = i / n, u1 = (i + 1) / n, w0 = wide * (1 - u0), w1 = wide * (1 - u1); const a0 = i % 2 ? w0 : 0, a1 = i % 2 ? 0 : w1; ctx.moveTo(px + ux * u0 + nx * a0, py + uy * u0 + ny * a0); ctx.lineTo(px + ux * u1 + nx * a1, py + uy * u1 + ny * a1);
        if (s > 9 && i % 2) { ctx.moveTo(px + ux * u0, py + uy * u0); ctx.lineTo(px + ux * u0 + nx * w0, py + uy * u0 + ny * w0); } }
      ctx.stroke();
      if (s > 9) { ctx.strokeStyle = hi; ctx.lineWidth = lw(0.04); ctx.beginPath(); ctx.moveTo(px + nx * (wide + 0.08), py + ny * (wide + 0.08)); ctx.lineTo(tx + nx * 0.08, ty + ny * 0.08); ctx.stroke(); }
    }
    circ(ctx, tx, ty, 0.3, steel); circ(ctx, px, py, 0.3, steel);
    if (s > 8) { circ(ctx, tx, ty, 0.11, steel2); circ(ctx, px, py, 0.11, steel2); }
    if (lit) { const b = dkPulse(env.t, 2.4, x, 0.2); dkGlow(ctx, ax, ay + 0.2, 1.5, '255,70,50', 0.85 * b); circ(ctx, ax, ay + 0.2, 0.15, mix('#5a1f1a', '#ff5a48', b)); }
    else circ(ctx, ax, ay + 0.2, 0.13, S.tone('#8a2f28', P));
    ctx.restore();
    // lettering is drawn the right way round whichever way the crane faces
    env.text(ctx, 'PC 3', x + dir * -1.27, y + legH + 2.92, 0.24, white, 'center');
  } });
  P.solid(x - g - 0.26, y, 0.52, legH, 'hard'); P.solid(x + g - 0.26, y, 0.52, legH, 'hard');
  return { x, tipX: x + reach, tipY: y + tipY, legs: [x - g, x + g] };
};

// A flashing amber lamp on a crane hook, so the block can be found after dark.
// It swells and fades, and the water below picks it up.
K.hookLight = function (S, ob) {
  const base = ob.draw;
  if (ob.plane) dkLight(S, { P: ob.plane, x: ob.x, y: ob.y + 0.32, rgb: '255,180,60', a: 0.5, w: 0.4, ob, fn: (t) => (S.pal.dark > 0.3 ? 0.2 + 0.8 * dkPulse(t, 5.2, 0, -0.2) : 0) });
  ob.draw = function (ctx, env) {
    base(ctx, env);
    if (!ob.alive || S.pal.dark <= 0.3) return;
    const b = dkPulse(env.t, 5.2, 0, -0.2);
    R4(ctx, ob.x - 0.2, ob.y - 0.22, 0.4, 0.44, '#e0a82e'); R4(ctx, ob.x - 0.11, ob.y - 0.13, 0.22, 0.26, '#20242b');
    R4(ctx, ob.x - 0.2, ob.y + 0.16, 0.4, 0.06, mix('#e0a82e', '#ffe7a8', b));
    dkGlow(ctx, ob.x, ob.y + 0.32, 1.35, '255,180,60', 0.22 + 0.6 * b);
    circ(ctx, ob.x, ob.y + 0.32, 0.085, mix('#6a4a1a', '#ffd27a', b));
  };
  return ob;
};

// A channel buoy with a bell in its cage. The bell is a shootable lure.
K.buoy = function (S, P, x, wy, o) {
  o = o || {}; const hex = o.col || '#c0392b', red = S.tone(hex, P), red2 = S.tone(darken(hex, 0.26), P), redHi = S.tone(lighten(hex, 0.2), P), dk = S.tone('#1f2329', P), white = S.tone('#e9e4d6', P), weed = S.tone('#2c3a31', P);
  const lampCol = o.lamp || '#ff5a48', rgb = rgbOf(lampCol).join(','), lit = S.pal.dark > 0.1, foam = rgba(S.tone('#e6edf2', P), 0.6);
  const fl = (t) => dkPulse(t, 1.7, x * 0.3, 0.55);
  if (lit) dkLight(S, { P, x, y: wy + 3.32, rgb, a: 0.6, w: 0.42, fn: fl });
  dkMirror(S, P, x - 0.85, x + 0.85, 0, 0.9, dkMirCol(S, P, hex), 0.55);
  P.add({ x0: x - 2.5, x1: x + 2.5, layer: o.layer === undefined ? 1 : o.layer, draw(ctx, env) {
    const s = env.s, t = env.t, rock = Math.sin(t * 0.9 + x) * 0.036 + Math.sin(t * 1.7 + x * 2) * 0.012;
    ctx.save(); ctx.translate(x, wy + Math.sin(t * 0.7 + x * 1.3) * 0.035); ctx.rotate(rock);
    // the float: lit on one side, shaded on the other, a white band, and a skirt of weed at the water
    poly(ctx, [-0.95, 0, 0.95, 0, 0.7, 0.8, -0.7, 0.8], red);
    if (s > 4) { poly(ctx, [-0.95, 0, -0.62, 0, -0.46, 0.8, -0.7, 0.8], redHi); poly(ctx, [0.5, 0, 0.95, 0, 0.7, 0.8, 0.37, 0.8], red2); poly(ctx, [-0.83, 0.37, 0.83, 0.37, 0.78, 0.53, -0.78, 0.53], white); }
    R4(ctx, -0.95, -0.1, 1.9, 0.22, dk); if (s > 5) R4(ctx, -0.9, -0.16, 1.8, 0.1, weed);
    ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.08, env.px * 0.8);
    ctx.beginPath(); ctx.moveTo(-0.6, 0.8); ctx.lineTo(-0.28, 2.95); ctx.moveTo(0.6, 0.8); ctx.lineTo(0.28, 2.95); ctx.moveTo(-0.5, 1.6); ctx.lineTo(0.5, 1.6); ctx.moveTo(-0.3, 2.95); ctx.lineTo(0.3, 2.95); ctx.stroke();
    if (s > 7) { ctx.lineWidth = Math.max(0.04, env.px * 0.6); ctx.beginPath(); ctx.moveTo(-0.36, 2.5); ctx.lineTo(0.36, 2.5); ctx.moveTo(-0.6, 0.8); ctx.lineTo(-0.5, 0.86); ctx.lineTo(0.5, 0.86); ctx.lineTo(0.6, 0.8); ctx.stroke(); }
    R4(ctx, -0.14, 2.95, 0.28, 0.26, dk);
    if (lit) { const b = fl(t); dkGlow(ctx, 0, 3.32, 1.5, rgb, 0.85 * b); circ(ctx, 0, 3.32, 0.13, mix('#1f2329', lampCol, b)); }
    else circ(ctx, 0, 3.32, 0.12, S.tone(lampCol, P));
    ctx.restore();
    dkFoam(ctx, env, x - 1.2, x + 1.2, wy, x * 3.1, foam);
  } });
  if (o.bell === false) return null;
  return K.thing(S, P, 'bell', x, wy + 1.95, Object.assign({ id: 'bell', lure: 24, lureY: 0, r: 0.46 }, o.bell || {}));
};

// A ribbon of smoke: rises from (x, y), leans with the wind, and thins out in four steps.
function dkSmoke(ctx, x, y, t, wind, len, w0, w1, css, a0, seed) {
  // puffs that rise along a path leaning with the wind, swelling and thinning as they go
  ctx.fillStyle = css;
  for (let i = 0; i < 12; i++) {
    const u = (((t * 0.07 + i / 12 + seed * 0.013) % 1) + 1) % 1, r = (w0 + (w1 - w0) * u) * 0.5;
    ctx.globalAlpha = a0 * (1 - u) * (1 - u) * 1.4;
    ctx.beginPath(); ctx.ellipse(x + wind * u * u * len * 0.42 + Math.sin(u * 7 + i * 1.3 + seed) * 0.05 * len * u, y + u * len, r, r * 0.8, 0, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// A container seen from a long way off: its colour, and close enough, its ribs and frame.
function dkBoxLite(ctx, s, x, y, w, h, c, d) {
  R4(ctx, x, y, w, h, c);
  if (s > 6) { ctx.fillStyle = d; for (let xx = x + 0.3; xx < x + w - 0.2; xx += 0.3) ctx.fillRect(xx, y + 0.14, 0.09, h - 0.28); ctx.fillRect(x, y, w, 0.1); ctx.fillRect(x, y, 0.12, h); ctx.fillRect(x + w - 0.12, y, 0.12, h); }
}

// The freighter on the far berth. Its funnel smoke and stern flag show the
// wind, and S.hornUntil (set by H.horn) makes the whistle blow steam.
K.freighter = function (S, P, sx, wy, o) {
  o = o || {};
  const L = o.len || 78, D = o.deck === undefined ? 6 : o.deck, lit = S.pal.dark > 0.3, night = S.pal.dark > 0.5;
  const hullHex = o.hull || '#222a37', hull = S.tone(hullHex, P), hullHi = S.tone(lighten(hullHex, 0.1), P), boot = S.tone('#8a2f28', P), white = S.tone('#dfe2e0', P), white2 = S.tone('#b9bfc2', P), white3 = S.tone('#9aa1a6', P), dk = S.tone('#14181f', P);
  const funHex = o.funnel || '#b3312b', fun = S.tone(funHex, P), fun2 = S.tone(darken(funHex, 0.22), P), funHi = S.tone(lighten(funHex, 0.14), P);
  const winC = S.tone(lit ? S.pal.lit : S.pal.glass, P, true), nameC = S.tone('#e9e4d6', P), buff = S.tone('#c9a25a', P), buff2 = S.tone('#96763c', P), hatch = S.tone('#5d666f', P), hatchHi = S.tone('#7b858f', P), hatchLo = S.tone('#474f57', P);
  const iron = S.tone('#3a3f47', P), rust = rgba(S.tone('#7a3d22', P), 0.5), boatC = S.tone('#e4e0d4', P), boatTop = S.tone('#b8643a', P), band = S.tone('#2a313b', P), shade = 'rgba(0,0,0,0.1)';
  const boxA = S.tone('#a3402f', P), boxB = S.tone('#2f5f8a', P), boxC = S.tone('#c98a2b', P), boxAd = S.tone(darken('#a3402f', 0.22), P), boxBd = S.tone(darken('#2f5f8a', 0.22), P), boxCd = S.tone(darken('#c98a2b', 0.22), P);
  const flagCols = [S.tone('#d6b42a', P, true), S.tone('#2f5f8a', P, true), S.tone('#c8372d', P, true), S.tone('#e9e4d6', P, true)];
  const hx = sx + 4, fx = sx + 10.5, top = D + 1.6;      // deckhouse start, funnel centre, poop deck
  const ma = sx + 39.2, mb = sx + L - 15;                // the two masts
  const bowX = (yy) => sx + L - 2.6 + 6.0 * (yy - wy) / (D + 2.5 - wy);
  // wear, worked out once: rust weeping down the side from the deck edge
  const WR = makeRng(9100 + Math.round(L * 3)), streaks = [];
  for (let i = 0; i < 20; i++) { const xx = sx + 2 + WR.f() * (L - 7); streaks.push(xx, (xx < sx + 26 || xx > sx + L - 13 ? top : D) - 0.2, WR.r(1.0, 4.0), WR.r(0.07, 0.2)); }
  P.add({ x0: sx - 16, x1: sx + L + 16, layer: 0, draw(ctx, env) {
    const s = env.s, px = env.px, t = env.t, v0 = env.x0, v1 = env.x1, th = Math.max(0.035, px * 0.8);
    const vis = (a, b) => sx + b > v0 && sx + a < v1;
    // hull with raised poop and forecastle
    poly(ctx, [sx, top, sx + 26, top, sx + 26, D, sx + L - 13, D, sx + L - 13, top, sx + L + 3.4, D + 2.5, sx + L - 2.6, wy, sx + 1.6, wy, sx, wy + 3.2], hull);
    poly(ctx, [sx + 0.7, wy + 1.15, sx + L - 1.9, wy + 1.15, sx + L - 2.6, wy, sx + 1.6, wy], boot);
    R4(ctx, sx + 0.5, wy + 1.15, L - 2.3, 0.12, white2);
    if (s > 4) { // plating: the long seams between strakes, and the butts where plates meet end to end
      ctx.fillStyle = hullHi;
      for (let j = 0; j < 4; j++) { const yy = D - 1.5 - j * 1.5, a = Math.max(sx + 0.5, v0), b = Math.min(bowX(yy) - 0.5, v1); if (b > a) ctx.fillRect(a, yy, b - a, th); }
      if (s > 6) for (let j = 0; j < 4; j++) { const yy = D - 1.5 - j * 1.5, e = Math.min(bowX(yy) - 1.2, v1); for (let xx = sx + 3 + (j % 2) * 3.2 + Math.max(0, Math.floor((v0 - sx - 6.4) / 6.4)) * 6.4; xx < e; xx += 6.4) ctx.fillRect(xx, yy, th, 1.5); }
    }
    if (s > 3.5) { ctx.fillStyle = rust; for (let i = 0; i < streaks.length; i += 4) { const xx = streaks[i]; if (xx > v0 - 1 && xx < v1) ctx.fillRect(xx, streaks[i + 1] - streaks[i + 2], streaks[i + 3], streaks[i + 2]); } }
    R4(ctx, sx, top - 0.16, 26, 0.16, white2); R4(ctx, sx + L - 13, top - 0.1, 15, 0.14, white2); R4(ctx, sx + 26, D - 0.13, L - 39, 0.13, white3);
    if (s > 5) { ctx.fillStyle = dk; for (let xx = sx + 28.4; xx < sx + L - 14; xx += 4.4) if (xx > v0 - 1 && xx < v1) ctx.fillRect(xx, D - 0.42, 0.5, 0.13); }       // freeing ports
    if (s > 7) { // draught marks at bow and stern, and the load line amidships
      ctx.fillStyle = nameC;
      for (let i = 0; i < 7; i++) { ctx.fillRect(sx + L - 7.3, wy + 1.45 + i * 0.45, 0.3, 0.1); ctx.fillRect(sx + 2.4, wy + 1.45 + i * 0.45, 0.3, 0.1); }
      ctx.strokeStyle = nameC; ctx.lineWidth = Math.max(0.07, px * 0.8); ctx.beginPath(); ctx.arc(sx + 55, wy + 2.7, 0.42, 0, TAU); ctx.moveTo(sx + 54.3, wy + 2.7); ctx.lineTo(sx + 55.7, wy + 2.7); ctx.moveTo(sx + 56.3, wy + 2.2); ctx.lineTo(sx + 56.3, wy + 3.4); ctx.moveTo(sx + 56.3, wy + 3.1); ctx.lineTo(sx + 56.8, wy + 3.1); ctx.moveTo(sx + 56.3, wy + 2.5); ctx.lineTo(sx + 56.8, wy + 2.5); ctx.stroke();
    }
    env.text(ctx, o.name || 'CALDER STAR', sx + L - 13.5, D - 1.75, 1.2, nameC, 'right');
    env.text(ctx, o.name || 'CALDER STAR', sx + 3.2, top - 1.55, 0.6, nameC, 'left'); env.text(ctx, 'PORT CALDER', sx + 3.2, top - 2.2, 0.42, nameC, 'left');
    if (vis(L - 9, L + 5)) { // the anchor home in its hawse pipe, and the rust it has wept
      if (s > 3.5) R4(ctx, sx + L - 4.47, D - 3.3, 0.22, 2.0, rust);
      ctx.fillStyle = dk; ctx.beginPath(); ctx.ellipse(sx + L - 4.35, D + 0.25, 0.46, 0.34, 0, 0, TAU); ctx.fill();
      R4(ctx, sx + L - 4.5, D - 1.25, 0.3, 1.5, iron);
      poly(ctx, [sx + L - 5.15, D - 1.15, sx + L - 3.55, D - 1.15, sx + L - 3.7, D - 1.7, sx + L - 4.35, D - 1.42, sx + L - 5.0, D - 1.7], iron);
    }
    if (s > 5) { // rails round the poop and the forecastle
      ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.04, px * 0.6); ctx.beginPath();
      ctx.moveTo(sx + 0.1, top + 0.9); ctx.lineTo(sx + 4, top + 0.9); ctx.moveTo(sx + 23, top + 0.9); ctx.lineTo(sx + 26, top + 0.9); ctx.lineTo(sx + 26, top);
      ctx.moveTo(sx + L - 13, top); ctx.lineTo(sx + L - 13, top + 0.9); ctx.lineTo(sx + L + 3.0, D + 3.3);
      for (let i = 0; i < 4; i++) { ctx.moveTo(sx + 0.1 + i * 1.3, top); ctx.lineTo(sx + 0.1 + i * 1.3, top + 0.9); }
      for (let i = 1; i < 8; i++) { const u = i / 8, xx = sx + L - 13 + u * 16, yy = top + u * 0.85; ctx.moveTo(xx, yy); ctx.lineTo(xx, yy + 0.9); }
      ctx.stroke();
    }
    // hatches, deck cargo and ventilators
    for (let i = 0; i < 3; i++) { if (!vis(29 + i * 11.5, 37.5 + i * 11.5)) continue; const hx0 = sx + 29 + i * 11.5; R4(ctx, hx0, D, 8.5, 1.0, hatch); R4(ctx, hx0 - 0.1, D + 0.9, 8.7, 0.12, hatchHi); if (s > 6) { ctx.fillStyle = hatchLo; for (let k = 1; k < 8; k++) ctx.fillRect(hx0 + k * 1.06, D + 0.1, 0.06, 0.8); } }
    if (vis(30, 48)) { dkBoxLite(ctx, s, sx + 30, D + 1.0, 6.1, 2.4, boxA, boxAd); dkBoxLite(ctx, s, sx + 41.6, D + 1.0, 6.1, 2.4, boxB, boxBd); dkBoxLite(ctx, s, sx + 41.6, D + 3.4, 6.1, 2.4, boxC, boxCd); }
    if (s > 3.5) for (let i = 0; i < 2; i++) { const vx = sx + (i ? 50.6 : 27.8); if (vx < v0 - 2 || vx > v1 + 2) continue; R4(ctx, vx - 0.15, D, 0.3, 1.35, buff); poly(ctx, [vx - 0.15, D + 1.3, vx + 0.45, D + 1.3, vx + 0.66, D + 1.95, vx + 0.3, D + 2.05, vx - 0.15, D + 1.75], buff); ctx.fillStyle = dk; ctx.beginPath(); ctx.ellipse(vx + 0.5, D + 1.72, 0.12, 0.26, -0.3, 0, TAU); ctx.fill(); }
    // masts, their winch houses, derricks and stays
    if (s > 3) { R4(ctx, ma - 1.1, D, 2.2, 1.25, white2); R4(ctx, mb - 1.1, D, 2.2, 1.25, white2); R4(ctx, ma - 1.2, D + 1.25, 2.4, 0.12, white3); R4(ctx, mb - 1.2, D + 1.25, 2.4, 0.12, white3); }
    ctx.strokeStyle = buff; ctx.lineWidth = Math.max(0.3, px);
    ctx.beginPath(); ctx.moveTo(ma, D); ctx.lineTo(ma, D + 11); ctx.moveTo(mb, D); ctx.lineTo(mb, D + 13); ctx.stroke();
    ctx.lineWidth = Math.max(0.16, px * 0.8);
    ctx.beginPath(); ctx.moveTo(ma, D + 2); ctx.lineTo(sx + 31, D + 9.5); ctx.moveTo(ma, D + 2); ctx.lineTo(sx + 48, D + 8.5); ctx.moveTo(mb, D + 2); ctx.lineTo(sx + L - 25, D + 10.5); ctx.moveTo(mb - 2, D + 11); ctx.lineTo(mb + 2, D + 11); ctx.moveTo(ma - 1.5, D + 9.4); ctx.lineTo(ma + 1.5, D + 9.4); ctx.stroke();
    ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.05, px * 0.6);
    ctx.beginPath(); ctx.moveTo(ma, D + 11); ctx.lineTo(sx + 31, D + 9.5); ctx.moveTo(ma, D + 11); ctx.lineTo(sx + 48, D + 8.5); ctx.moveTo(mb, D + 13); ctx.lineTo(sx + L - 25, D + 10.5); ctx.moveTo(mb, D + 13); ctx.lineTo(sx + L + 2.6, D + 2.6); ctx.moveTo(mb, D + 13); ctx.lineTo(hx + 12, top + 9.6);
    if (s > 4) { // cargo runners hanging from the derrick heads, shrouds to the deck
      ctx.moveTo(sx + 31, D + 9.5); ctx.lineTo(sx + 31, D + 4.3); ctx.moveTo(sx + 48, D + 8.5); ctx.lineTo(sx + 48, D + 6.4); ctx.moveTo(sx + L - 25, D + 10.5); ctx.lineTo(sx + L - 25, D + 2.2);
      ctx.moveTo(ma, D + 9.4); ctx.lineTo(ma - 2.6, D + 1); ctx.moveTo(ma, D + 9.4); ctx.lineTo(ma + 2.6, D + 1); ctx.moveTo(mb, D + 11); ctx.lineTo(mb - 2.8, D + 1); ctx.moveTo(mb, D + 11); ctx.lineTo(mb + 2.2, D + 1.6);
    }
    ctx.stroke();
    if (s > 4) { ctx.fillStyle = buff2; ctx.fillRect(sx + 30.8, D + 3.9, 0.4, 0.45); ctx.fillRect(sx + 47.8, D + 6.0, 0.4, 0.45); ctx.fillRect(sx + L - 25.2, D + 1.8, 0.4, 0.45); }
    if (s > 9) { ctx.fillStyle = buff2; for (let yy = D + 1.6; yy < D + 9; yy += 0.5) ctx.fillRect(ma - 0.24, yy, 0.48, 0.05); for (let yy = D + 1.6; yy < D + 10.6; yy += 0.5) ctx.fillRect(mb - 0.24, yy, 0.48, 0.05); }
    if (vis(-2, 27)) {
      // deckhouse in three tiers, the bridge on top
      R4(ctx, hx, top, 19, 2.7, white); R4(ctx, hx + 1, top + 2.7, 16, 2.6, white); R4(ctx, hx + 3.5, top + 5.3, 12.5, 2.5, white);
      if (s > 3) { R4(ctx, hx + 18.2, top, 0.8, 2.7, white2); R4(ctx, hx + 16.3, top + 2.7, 0.7, 2.6, white2); R4(ctx, hx + 15.4, top + 5.3, 0.6, 2.5, white2); R4(ctx, hx, top, 19, 0.5, shade); }
      R4(ctx, hx, top + 2.6, 19, 0.14, white2); R4(ctx, hx + 1, top + 5.2, 16, 0.14, white2); R4(ctx, hx + 2.5, top + 7.8, 15, 0.22, white2);
      // bridge wings and their wind dodgers
      R4(ctx, hx + 1.2, top + 5.3, 2.3, 0.14, white2); R4(ctx, hx + 16, top + 5.3, 1.9, 0.14, white2); R4(ctx, hx + 1.2, top + 5.44, 0.13, 1.0, white); R4(ctx, hx + 17.77, top + 5.44, 0.13, 1.0, white);
      R4(ctx, hx + 3.9, top + 5.85, 11.8, 1.35, band);
      ctx.fillStyle = winC; for (let i = 0; i < 7; i++) ctx.fillRect(hx + 4.2 + i * 1.65, top + 6.0, 1.2, 1.05);
      for (let k = 0; k < 2; k++) for (let i = 0; i < 8; i++) { if (dkHash(i * 3.1 + k * 7 + sx) < (lit ? 0.62 : 2)) { ctx.fillStyle = lit ? winC : dk; ctx.beginPath(); ctx.arc(hx + 2 + k + i * 2.0, top + 1.4 + k * 2.65, 0.3, 0, TAU); ctx.fill(); } }
      if (s > 5) { // doors, rails on the open decks, and the boat in its davits
        ctx.fillStyle = white3; ctx.fillRect(hx + 0.55, top + 0.1, 0.75, 1.95); ctx.fillRect(hx + 9.05, top + 0.1, 0.75, 1.95); ctx.fillRect(hx + 17.25, top + 0.1, 0.75, 1.95); ctx.fillRect(hx + 1.6, top + 2.8, 0.7, 1.9);
        ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.04, px * 0.6); ctx.beginPath();
        ctx.moveTo(hx, top + 2.74); ctx.lineTo(hx, top + 3.6); ctx.lineTo(hx + 1, top + 3.6); ctx.moveTo(hx + 17, top + 3.6); ctx.lineTo(hx + 19, top + 3.6); ctx.lineTo(hx + 19, top + 2.74);
        ctx.moveTo(hx + 1.2, top + 6.4); ctx.lineTo(hx + 3.5, top + 6.4); ctx.moveTo(hx + 16, top + 6.4); ctx.lineTo(hx + 17.9, top + 6.4);
        ctx.moveTo(hx + 2.5, top + 8.9); ctx.lineTo(hx + 17.5, top + 8.9); for (let xx = hx + 2.5; xx <= hx + 17.6; xx += 2.5) { ctx.moveTo(xx, top + 8.02); ctx.lineTo(xx, top + 8.9); }
        ctx.stroke();
      }
      if (s > 3.5) {
        poly(ctx, [hx + 12.6, top + 3.55, hx + 16.9, top + 3.55, hx + 16.5, top + 2.9, hx + 13.0, top + 2.9], boatC); R4(ctx, hx + 12.6, top + 3.55, 4.3, 0.15, boatTop);
        ctx.strokeStyle = white3; ctx.lineWidth = Math.max(0.1, px * 0.8); ctx.beginPath(); ctx.moveTo(hx + 12.9, top + 2.74); ctx.lineTo(hx + 12.9, top + 4.3); ctx.quadraticCurveTo(hx + 12.95, top + 4.7, hx + 13.5, top + 4.7); ctx.moveTo(hx + 16.6, top + 2.74); ctx.lineTo(hx + 16.6, top + 4.3); ctx.quadraticCurveTo(hx + 16.55, top + 4.7, hx + 16.0, top + 4.7); ctx.stroke();
        ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.03, px * 0.5); ctx.beginPath(); ctx.moveTo(hx + 13.5, top + 4.7); ctx.lineTo(hx + 13.5, top + 3.7); ctx.moveTo(hx + 16.0, top + 4.7); ctx.lineTo(hx + 16.0, top + 3.7); ctx.stroke();
      }
      // funnel: lit on one side, shaded on the other, a white band with the company letter, a black top
      poly(ctx, [fx - 2.2, top + 7.9, fx + 2.2, top + 7.9, fx + 1.9, top + 13, fx - 1.9, top + 13], fun);
      if (s > 3) { poly(ctx, [fx + 0.95, top + 7.9, fx + 2.2, top + 7.9, fx + 1.9, top + 13, fx + 0.85, top + 13], fun2); poly(ctx, [fx - 2.2, top + 7.9, fx - 1.5, top + 7.9, fx - 1.32, top + 13, fx - 1.9, top + 13], funHi); }
      R4(ctx, fx - 1.95, top + 11.9, 3.9, 1.1, dk); R4(ctx, fx - 2.1, top + 9.6, 4.2, 0.9, white);
      env.text(ctx, 'C', fx, top + 9.72, 0.8, fun, 'center');
      R4(ctx, fx + 2.12, top + 8.0, 0.13, 3.6, white3); R4(ctx, fx + 2.05, top + 11.3, 0.5, 0.2, buff);     // the whistle on its pipe
      // radar mast with its yard and a hoist of signal flags, and the scanner turning on the bridge roof
      line(ctx, hx + 12, top + 7.8, hx + 12, top + 12.4, buff, 0.2, env); line(ctx, hx + 10.6, top + 10.8, hx + 13.4, top + 10.8, buff, 0.12, env);
      if (s > 4) {
        line(ctx, hx + 13.4, top + 10.8, hx + 15.4, top + 8.05, dk, 0.03, env);
        for (let i = 0; i < 4; i++) { const u = 0.14 + i * 0.2; R4(ctx, hx + 13.4 + 2.0 * u, top + 10.8 - 2.75 * u - 0.42, 0.5, 0.36, flagCols[i]); }
        const rw = 0.14 + 1.25 * Math.abs(Math.cos(t * 2.3)); R4(ctx, hx + 6.9, top + 8.02, 0.2, 0.75, white3); R4(ctx, hx + 7 - rw / 2, top + 8.77, rw, 0.15, white);
      }
    }
    // a thread of smoke from the funnel
    dkSmoke(ctx, fx, top + 13.1, t, env.wind, 13, 1.1, 5.2, night ? 'rgb(112,122,142)' : 'rgb(72,74,82)', night ? 0.24 : 0.34, sx);
    if (S.hornUntil && t < S.hornUntil) { // whistle steam while the horn sounds
      const k = clamp((t - S.hornFrom) / 0.4, 0, 1) * clamp((S.hornUntil - t) / 0.6, 0, 1); ctx.fillStyle = 'rgba(238,242,246,0.75)';
      for (let i = 0; i < 7; i++) { const u = ((t * 0.9 + i / 7) % 1); ctx.globalAlpha = (1 - u) * 0.8 * k; ctx.beginPath(); ctx.arc(fx + 2.4 + env.wind * u * 1.6 + u * 1.2, top + 11.4 + u * 4.4, 0.35 + u * 1.5, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    // main deck rail, and mooring lines that sag to the quay
    ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.05, px * 0.6);
    ctx.beginPath(); ctx.moveTo(sx + 26, D + 1); ctx.lineTo(sx + L - 13, D + 1);
    if (s > 5) for (let xx = sx + 26 + Math.max(0, Math.floor((v0 - sx - 26) / 2.2)) * 2.2; xx < Math.min(sx + L - 13, v1); xx += 2.2) { ctx.moveTo(xx, D); ctx.lineTo(xx, D + 1); }
    ctx.moveTo(sx + L - 12, top - 0.3); ctx.quadraticCurveTo(sx + L - 2, 0.2, sx + L + 12, 0.6); ctx.moveTo(sx + L - 6, top - 0.6); ctx.quadraticCurveTo(sx + L - 12, 0.4, sx + L - 22, 0.6);
    ctx.moveTo(sx + 2.5, top - 0.5); ctx.quadraticCurveTo(sx - 3, 0.3, sx - 11, 0.6);
    ctx.stroke();
    if (lit) { // working lights on the mastheads and the bridge, the green starboard light, a white stern light
      const k = S.pal.dark;
      dkGlow(ctx, ma, D + 11.2, 3.0, '255,232,170', 0.75 * k); dkGlow(ctx, mb, D + 13.2, 2.8, '255,232,170', 0.75 * k); dkGlow(ctx, hx + 12, top + 12.6, 2.0, '255,232,170', 0.7 * k); dkGlow(ctx, hx + 9, top + 8.3, 3.6, '255,232,170', 0.5 * k);
      dkGlow(ctx, hx + 17.9, top + 6.6, 1.0, '90,255,140', 0.7 * k); dkGlow(ctx, sx + 0.4, top + 1.3, 1.0, '255,244,214', 0.6 * k);
      circ(ctx, ma, D + 11.2, 0.22, '#fff3c4'); circ(ctx, mb, D + 13.2, 0.22, '#fff3c4'); circ(ctx, hx + 12, top + 12.6, 0.16, '#fff3c4'); circ(ctx, hx + 17.9, top + 6.6, 0.12, '#6dff9a'); circ(ctx, sx + 0.4, top + 1.3, 0.12, '#fff3c4');
    }
  } });
  P.solid(sx, wy - 4, L, D - wy + 4, 'hard'); P.solid(hx, top, 19, 7.8, 'wall'); P.solid(sx + L - 13, D, 15, 1.6, 'hard'); P.solid(sx, D, 26, 1.6, 'hard');
  K.flag(S, P, sx + 0.8, top, 4.6, '#c0392b', { layer: 0 });
  return { sx, L, deckY: D, x0: sx + 27, x1: sx + L - 14, funnel: [fx, top + 13] };
};

// A lighthouse on the end of the breakwater. The beam sweeps at night and in fog:
// long when it lies across your view, short as it swings toward you, and the
// lamp flares each time it points your way.
K.lighthouse = function (S, P, x, y, h) {
  const w = S.tone('#e3e1d8', P), w2 = S.tone('#bdbbb0', P), r = S.tone('#b3312b', P), r2 = S.tone('#8a2520', P), dk = S.tone('#20242b', P), stone = S.tone('#5b6268', P), glass = S.tone(S.pal.glass, P);
  const beamOn = S.pal.dark > 0.3 || S.weather === 'fog', fog = S.weather === 'fog';
  const flare = (t) => Math.pow(1 - Math.abs(Math.cos(t * 0.55)), 3);
  if (beamOn) dkLight(S, { P, x, y: y + h + 1.65, rgb: '255,240,200', a: 0.5, w: 3.0, len: 1.25, fn: (t) => 0.25 + 0.75 * flare(t) });
  P.add({ x0: x - 150, x1: x + 150, layer: 1, draw(ctx, env) {
    const s = env.s, t = env.t;
    if (x + 6 > env.x0 && x - 6 < env.x1) {
      poly(ctx, [x - 4.0, y - 0.3, x + 4.0, y - 0.3, x + 3.2, y + 1.0, x - 3.2, y + 1.0], stone);
      poly(ctx, [x - 2.6, y, x + 2.6, y, x + 1.7, y + h, x - 1.7, y + h], w);
      poly(ctx, [x + 1.1, y, x + 2.6, y, x + 1.7, y + h, x + 0.72, y + h], w2);                      // the side away from the light
      poly(ctx, [x - 2.3, y + h * 0.32, x + 2.3, y + h * 0.32, x + 2.05, y + h * 0.58, x - 2.05, y + h * 0.58], r);
      poly(ctx, [x + 0.98, y + h * 0.32, x + 2.3, y + h * 0.32, x + 2.05, y + h * 0.58, x + 0.88, y + h * 0.58], r2);
      if (s > 3) { ctx.fillStyle = dk; ctx.fillRect(x - 0.55, y + 1.0, 1.1, 2.0); ctx.fillRect(x - 0.28, y + h * 0.22, 0.56, 1.0); ctx.fillRect(x - 0.26, y + h * 0.44, 0.52, 0.95); ctx.fillRect(x - 0.24, y + h * 0.72, 0.48, 0.9); }
      R4(ctx, x - 2.3, y + h, 4.6, 0.5, dk); poly(ctx, [x - 2.1, y + h, x - 1.66, y + h, x - 1.72, y + h - 0.9], dk); poly(ctx, [x + 2.1, y + h, x + 1.66, y + h, x + 1.72, y + h - 0.9], dk);
      R4(ctx, x - 1.3, y + h + 0.5, 2.6, 2.3, beamOn ? '#fff3c4' : glass);
      if (s > 4) { // gallery rail and the glazing bars of the lantern
        ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.06, env.px * 0.6); ctx.beginPath();
        ctx.moveTo(x - 2.3, y + h + 1.45); ctx.lineTo(x + 2.3, y + h + 1.45); for (let i = 0; i <= 6; i++) { const xx = x - 2.3 + i * 0.767; ctx.moveTo(xx, y + h + 0.5); ctx.lineTo(xx, y + h + 1.45); }
        ctx.moveTo(x - 0.45, y + h + 0.5); ctx.lineTo(x - 0.45, y + h + 2.8); ctx.moveTo(x + 0.45, y + h + 0.5); ctx.lineTo(x + 0.45, y + h + 2.8); ctx.moveTo(x - 1.3, y + h + 0.5); ctx.lineTo(x - 1.3, y + h + 2.8); ctx.moveTo(x + 1.3, y + h + 0.5); ctx.lineTo(x + 1.3, y + h + 2.8);
        ctx.stroke();
      }
      poly(ctx, [x - 1.8, y + h + 2.8, x + 1.8, y + h + 2.8, x, y + h + 4.6], r); poly(ctx, [x + 0.7, y + h + 2.8, x + 1.8, y + h + 2.8, x, y + h + 4.6], r2);
      circ(ctx, x, y + h + 4.75, 0.24, dk); line(ctx, x, y + h + 4.9, x, y + h + 6.1, dk, 0.06, env);
    }
    if (!beamOn) return;
    const c = Math.cos(t * 0.55), ly = y + h + 1.65, ac = Math.abs(c);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let side = -1; side <= 1; side += 2) {
      const reach = 128 * ac + 5, dirx = side * (c >= 0 ? 1 : -1), a = (fog ? 0.1 : 0.06) + (fog ? 0.24 : 0.19) * (1 - ac), ex = x + dirx * reach, sp = 4.5 + reach * 0.05;
      if (Math.max(x, ex) < env.x0 || Math.min(x, ex) > env.x1) continue;
      const g = ctx.createLinearGradient(x, 0, ex, 0); g.addColorStop(0, 'rgba(255,244,205,' + a.toFixed(3) + ')'); g.addColorStop(0.55, 'rgba(255,244,205,' + (a * 0.32).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,244,205,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x, ly - 0.5); ctx.lineTo(ex, ly - sp); ctx.lineTo(ex, ly + sp); ctx.lineTo(x, ly + 0.5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x, ly - 0.3); ctx.lineTo(ex, ly - sp * 0.4); ctx.lineTo(ex, ly + sp * 0.4); ctx.lineTo(x, ly + 0.3); ctx.closePath(); ctx.fill();     // the bright heart of the beam
    }
    ctx.restore();
    const fl = flare(t);
    dkGlow(ctx, x, ly, 7 + 7 * fl, '255,246,214', 0.4 + 0.6 * fl);
  } });
};

// How much of a deck's top you can see from where the shooter is: a deck that
// runs `w` metres back from its front edge shows as a strip this many metres tall.
function dkDeckH(dk, P, y, w) { const c = dk.cam; return clamp((c.ey - y) * w / Math.max(20, P.z - c.ez + w), 0, 0.5); }

// A flat steel supply barge. Its deck is where the crew work.
K.supplyBarge = function (S, P, x, wy, o) {
  o = o || {}; const L = o.len || 30, D = wy + 1.3, dk0 = dkOf(S), lit = S.pal.dark > 0.3;
  const hull = S.tone('#3a3f47', P), hullHi = S.tone('#4d535c', P), rust = S.tone('#7a4a34', P), rustA = rgba(S.tone('#7a4a34', P), 0.55), dk = S.tone('#1b1e24', P), deck = S.tone('#5a616a', P), deckTop = S.tone('#6b737d', P), deckLine = S.tone('#565d66', P);
  const hut = S.tone('#6f7f6a', P), hut2 = S.tone('#5a6956', P), hutHi = S.tone('#8a9a84', P), tarp = S.tone('#55683f', P), tarp2 = S.tone('#3f4f30', P), tarpHi = S.tone('#6b7f52', P), tarpMid = S.tone('#4a5c37', P), rope = S.tone('#b9a27e', P), tyre = S.tone('#14161a', P);
  const rail = S.tone('#c9ced3', P, true), nameC = S.tone('#d7d2c4', P), foam = rgba(S.tone('#e6edf2', P), 0.55), ringW = S.tone('#e4e0d4', P), ringR = S.tone('#b8452f', P), shade = 'rgba(0,0,0,0.1)';
  const room = S.room('barge:hut', lit), winLit = S.tone(S.pal.lit, P, true), winLit2 = S.tone(darken(S.pal.lit, 0.25), P, true), winDark = S.tone(S.pal.inRoom, P);
  dkMirror(S, P, x + 1.5, x + L - 1.5, 0, 1.3, dkMirCol(S, P, '#3a3f47'), 0.6);
  if (room.lit) dkLight(S, { P, x: x + 2.3, y: D + 1.55, rgb: '255,214,130', a: 0.28, w: 1.0 });
  P.add({ x0: x - 4, x1: x + L + 4, layer: 0, draw(ctx, env) {
    const s = env.s, px = env.px, t = env.t, th = Math.max(0.03, px * 0.8);
    if (s > 2.5) { // mooring lines sagging up to the quay and the pier
      ctx.strokeStyle = rope; ctx.lineWidth = Math.max(0.05, px * 0.7); ctx.beginPath();
      ctx.moveTo(x + 0.6, D + 0.4); ctx.quadraticCurveTo(x - 0.9, D + 0.25, x - 2.4, 0.3); ctx.moveTo(x + L - 0.6, D + 0.4); ctx.quadraticCurveTo(x + L + 0.9, D + 0.25, x + L + 2.4, 0.3); ctx.stroke();
    }
    poly(ctx, [x, D, x + L, D, x + L - 1.5, wy - 0.05, x + 1.5, wy - 0.05], hull);
    if (s > 4) { // plating seams
      ctx.fillStyle = hullHi; ctx.fillRect(x + 0.7, D - 0.72, L - 1.4, th);
      if (s > 7) for (let xx = x + 3.75; xx < x + L - 2; xx += 3.75) ctx.fillRect(xx, wy, th, 1.3 - 0.16);
    }
    R4(ctx, x, D - 0.16, L, 0.16, deck); R4(ctx, x + 0.2, D - 0.3, L - 0.4, 0.09, rail); R4(ctx, x + 1.2, wy, L - 2.4, 0.3, rust);
    if (s > 3) { // rust weeping down from the rubbing strake, tyres hung along the side as fenders
      ctx.fillStyle = rustA; for (let i = 0; i < 9; i++) { const q = dkHash(i * 3.3 + x); ctx.fillRect(x + 2.2 + i * 3.05 + q, D - 0.3 - (0.25 + q * 0.55), 0.08 + q * 0.1, 0.25 + q * 0.55); }
      ctx.strokeStyle = rope; ctx.lineWidth = Math.max(0.03, px * 0.5); ctx.beginPath(); for (let i = 0; i < 5; i++) { const fx = x + 3.6 + i * 5.7; ctx.moveTo(fx, D - 0.16); ctx.lineTo(fx, D - 0.5); } ctx.stroke();
      ctx.strokeStyle = tyre; ctx.lineWidth = Math.max(0.17, px); ctx.beginPath(); for (let i = 0; i < 5; i++) { const fx = x + 3.6 + i * 5.7; ctx.moveTo(fx + 0.27, D - 0.78); ctx.arc(fx, D - 0.78, 0.27, 0, TAU); } ctx.stroke();
    }
    env.text(ctx, o.name || 'TENDER 9', x + L - 2.2, D - 0.95, 0.5, nameC, 'right');
    // the deck seen from above: a thin strip of plate, with the lamp light lying on it
    const dT = dkDeckH(dk0, P, D, 2.6);
    if (dT * s > 1.2) {
      R4(ctx, x + 0.15, D, L - 0.3, dT, deckTop);
      if (s > 9) { ctx.fillStyle = deckLine; for (let xx = x + 2.5; xx < x + L - 1; xx += 2.5) ctx.fillRect(xx, D, th, dT); }
    }
    dkPool(ctx, env, S, 'barge', D - 0.3, dT + 0.3, 0.36, 1, 0, x, x + L);
    // deck hut at the left end
    R4(ctx, x + 1.2, D, 3.6, 2.5, hut);
    if (s > 5) { ctx.fillStyle = hut2; for (let xx = x + 1.56; xx < x + 4.7; xx += 0.36) ctx.fillRect(xx, D + 0.05, 0.05, 2.4); }
    if (s > 3) R4(ctx, x + 1.2, D, 3.6, 0.6, shade);
    R4(ctx, x + 1.0, D + 2.5, 4.0, 0.22, dk); if (s > 6) R4(ctx, x + 1.0, D + 2.66, 4.0, 0.06, hut2);
    R4(ctx, x + 1.7, D + 1.1, 1.2, 0.95, room.lit ? winLit : winDark);
    if (s > 4) {
      if (room.lit && s > 7) { ctx.fillStyle = winLit2; ctx.fillRect(x + 1.78, D + 1.1, 0.5, 0.3); ctx.fillRect(x + 2.5, D + 1.62, 0.3, 0.07); ctx.fillRect(x + 2.5, D + 1.8, 0.3, 0.07); }
      ctx.strokeStyle = hutHi; ctx.lineWidth = Math.max(0.05, px * 0.8); ctx.strokeRect(x + 1.7, D + 1.1, 1.2, 0.95); ctx.beginPath(); ctx.moveTo(x + 2.3, D + 1.1); ctx.lineTo(x + 2.3, D + 2.05); ctx.stroke();
    }
    R4(ctx, x + 3.5, D, 0.95, 1.95, dk);
    if (s > 6) { R4(ctx, x + 3.58, D + 0.08, 0.79, 1.79, hut2); circ(ctx, x + 3.97, D + 1.45, 0.16, room.lit ? winLit : winDark); R4(ctx, x + 3.62, D + 0.95, 0.1, 0.05, hutHi); }
    if (s > 5) { // a life ring on the wall, a stove pipe and an aerial on the roof
      ctx.strokeStyle = ringW; ctx.lineWidth = Math.max(0.08, px); ctx.beginPath(); ctx.arc(x + 3.2, D + 1.62, 0.2, 0, TAU); ctx.stroke();
      ctx.strokeStyle = ringR; ctx.beginPath(); ctx.arc(x + 3.2, D + 1.62, 0.2, 0.3, 1.2); ctx.moveTo(x + 3.2 + 0.2 * Math.cos(3.44), D + 1.62 + 0.2 * Math.sin(3.44)); ctx.arc(x + 3.2, D + 1.62, 0.2, 3.44, 4.34); ctx.stroke();
      R4(ctx, x + 4.3, D + 2.72, 0.16, 0.85, dk); R4(ctx, x + 4.22, D + 3.5, 0.32, 0.09, dk); line(ctx, x + 1.45, D + 2.72, x + 1.45, D + 4.5, dk, 0.03, env);
    }
    if (room.lit) { dkSmoke(ctx, x + 4.38, D + 3.6, t, env.wind, 3.2, 0.2, 1.0, 'rgb(150,158,172)', 0.2, x); dkGlow(ctx, x + 2.3, D + 0.75, 1.5, '255,214,130', 0.22, 0.8); }
    // cargo under a tarpaulin amidships: a lit ridge, a shaded end, folds, and a hem
    poly(ctx, [x + 9.5, D, x + 15.5, D, x + 15.0, D + 1.5, x + 13.2, D + 1.9, x + 10.2, D + 1.4], tarp);
    if (s > 3) {
      poly(ctx, [x + 13.4, D, x + 15.5, D, x + 15.0, D + 1.5, x + 13.2, D + 1.9], tarpMid);
      poly(ctx, [x + 10.2, D + 1.4, x + 13.2, D + 1.9, x + 15.0, D + 1.5, x + 14.86, D + 1.33, x + 13.2, D + 1.72, x + 10.32, D + 1.23], tarpHi);
      ctx.strokeStyle = tarp2; ctx.lineWidth = Math.max(0.05, px * 0.6); ctx.beginPath(); ctx.moveTo(x + 11.2, D + 1.55); ctx.lineTo(x + 10.9, D); ctx.moveTo(x + 13.2, D + 1.9); ctx.lineTo(x + 13.3, D); ctx.moveTo(x + 14.6, D + 1.6); ctx.lineTo(x + 14.9, D); ctx.stroke();
      R4(ctx, x + 9.56, D, 5.9, 0.08, tarp2);
      if (s > 7) { ctx.strokeStyle = rope; ctx.lineWidth = Math.max(0.03, px * 0.5); ctx.beginPath(); ctx.moveTo(x + 9.9, D + 0.02); ctx.lineTo(x + 10.5, D + 1.44); ctx.lineTo(x + 12.1, D + 1.72); ctx.lineTo(x + 12.4, D + 0.02); ctx.moveTo(x + 14.0, D + 0.02); ctx.lineTo(x + 14.1, D + 1.7); ctx.stroke(); }
    }
    // bitts at each end, flush hatches in the deck, a drip tray under the fuel
    R4(ctx, x + 0.4, D, 0.4, 0.42, dk); R4(ctx, x + L - 0.8, D, 0.4, 0.42, dk);
    if (s > 5) {
      R4(ctx, x + 0.3, D + 0.34, 0.6, 0.1, dk); R4(ctx, x + L - 0.9, D + 0.34, 0.6, 0.1, dk);
      R4(ctx, x + 5.7, D, 3.0, 0.1, deckLine); R4(ctx, x + 16.4, D, 3.0, 0.1, deckLine); R4(ctx, x + 20.5, D, 7.4, 0.07, dk);
    }
    dkFoam(ctx, env, x + 1.5, x + L - 1.5, wy, x * 1.7, foam);
  } });
  P.solid(x, wy - 3, L, D - wy + 3, 'hard'); P.solid(x + 1.2, D, 3.6, 2.5, 'wall'); P.solid(x + 9.6, D, 5.8, 1.4, 'thin');
  return { x0: x, x1: x + L, y: D, L };
};

// Maeve Calloway's yacht. Aft deck, a glazed saloon, a sun deck above it and a
// foredeck. Each deck is its own zone with its own lamp.
K.yacht = function (S, P, x, wy, o) {
  o = o || {};
  const L = 36, D = wy + 2.7, sunY = D + 3.0, foreY = D + 0.7, lit = S.pal.dark > 0.3, dk0 = dkOf(S);
  const white = S.tone('#e9e6dd', P), white2 = S.tone('#c3c3bd', P), whiteLo = S.tone('#d3d1c9', P), navy = S.tone('#1e2a44', P), navyHi = S.tone('#34446a', P), gold = S.tone('#c9a23a', P, true), teak = S.tone('#8a6844', P), teakTop = S.tone('#a07a52', P), teakLine = S.tone('#7a5a3a', P);
  const dk = S.tone('#161a21', P), glass = S.tone(S.pal.glass, P), railC = S.tone('#cfd4d9', P), rope = S.tone('#b9a27e', P), fender = S.tone('#efece4', P), foam = rgba(S.tone('#e6edf2', P), 0.55), shade = 'rgba(0,0,0,0.07)';
  const sal = S.room('yacht:saloon', true);
  const sx0 = x + 11, sx1 = x + 23;                       // saloon walls
  const wins = [];
  for (let i = 0; i < 3; i++) wins.push(P.open({ x: sx0 + 0.9 + i * 3.7, y: D + 0.85, w: 2.9, h: 1.45, room: sal.id, glass: true, blind: 0, deco: 4, tint: '#ffe2a6', f: 0, c: i }));
  const drape = S.tone(darken('#ffe2a6', 0.3), P, true), drape2 = S.tone(darken('#ffe2a6', 0.16), P, true);
  dkMirror(S, P, x + 1.1, x + L - 3.4, 0, 2.7, dkMirCol(S, P, '#e9e6dd'), 0.42);
  dkMirror(S, P, sx0, sx1 + 0.5, 2.7, 5.7, dkMirCol(S, P, '#e9e6dd'), 0.22);
  for (let i = 0; i < 3; i++) dkLight(S, { P, x: sx0 + 2.35 + i * 3.7, y: D + 1.6, rgb: '255,226,166', a: 0.34, w: 2.0 });
  P.add({ x0: x - 5, x1: x + L + 6, layer: 0, draw(ctx, env) {
    const s = env.s, px = env.px, t = env.t;
    if (s > 2.5) { // mooring lines to the pier, sagging
      ctx.strokeStyle = rope; ctx.lineWidth = Math.max(0.05, px * 0.7); ctx.beginPath();
      ctx.moveTo(x + 0.5, D - 0.15); ctx.quadraticCurveTo(x - 1.2, 0.0, x - 3.0, 0.32); ctx.moveTo(x + L - 0.6, foreY - 0.05); ctx.quadraticCurveTo(x + L + 2.2, 0.1, x + L + 4.4, 0.32); ctx.stroke();
    }
    // hull: a long sheer line and a raked bow, the turn of the bilge in shade
    poly(ctx, [x, D, x + 22.5, D, x + 23.5, foreY, x + L + 1.6, foreY + 0.55, x + L - 3.4, wy - 0.05, x + 1.1, wy - 0.05], white);
    if (s > 3) poly(ctx, [x + 0.62, wy + 1.35, x + L - 1.95, wy + 1.35, x + L - 2.55, wy + 0.75, x + 0.75, wy + 0.75], whiteLo);
    poly(ctx, [x + 0.75, wy + 0.75, x + L - 2.55, wy + 0.75, x + L - 3.4, wy - 0.05, x + 1.1, wy - 0.05], navy);
    if (s > 5) R4(ctx, x + 0.78, wy + 0.75, L - 3.3, 0.07, navyHi);
    R4(ctx, x + 0.3, D - 0.55, 21.5, 0.09, gold);
    ctx.fillStyle = lit ? S.tone(S.pal.lit, P, true) : dk; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x + 4 + i * 4.6, D - 1.15, 0.24, 0, TAU); ctx.fill(); }
    if (s > 9) { ctx.strokeStyle = gold; ctx.lineWidth = Math.max(0.04, px * 0.7); ctx.beginPath(); for (let i = 0; i < 6; i++) { ctx.moveTo(x + 4.27 + i * 4.6, D - 1.15); ctx.arc(x + 4 + i * 4.6, D - 1.15, 0.27, 0, TAU); } ctx.stroke(); }
    env.text(ctx, o.name || 'SILVER TIDE', x + 1.2, D - 1.0, 0.44, gold, 'left');
    env.text(ctx, 'PORT CALDER', x + 1.2, D - 1.42, 0.24, gold, 'left');
    if (s > 3.5) { // fenders hanging along the side, an anchor at the stem, the exhaust
      ctx.strokeStyle = rope; ctx.lineWidth = Math.max(0.025, px * 0.5); ctx.beginPath(); for (let i = 0; i < 4; i++) { const fx = x + 6.3 + i * 4.6; ctx.moveTo(fx, D - 0.05); ctx.lineTo(fx, D - 0.75); } ctx.stroke();
      ctx.fillStyle = fender; for (let i = 0; i < 4; i++) ctx.fillRect(x + 6.3 + i * 4.6 - 0.15, D - 1.62, 0.3, 0.9);
      if (s > 7) { ctx.fillStyle = navy; for (let i = 0; i < 4; i++) { ctx.fillRect(x + 6.3 + i * 4.6 - 0.15, D - 0.82, 0.3, 0.1); ctx.fillRect(x + 6.3 + i * 4.6 - 0.15, D - 1.62, 0.3, 0.1); } }
      poly(ctx, [x + L - 0.9, foreY - 0.25, x + L - 0.3, foreY - 0.2, x + L - 0.45, foreY - 0.95, x + L - 0.7, foreY - 0.7], dk);
      R4(ctx, x + 1.5, wy + 1.0, 0.22, 0.14, dk);
    }
    // decks: a teak edge, and the planked top seen from above with the lamp light lying on it
    R4(ctx, x, D - 0.1, 22.5, 0.1, teak); R4(ctx, x + 23.5, foreY - 0.1, L - 22.6, 0.1, teak);
    const dT = dkDeckH(dk0, P, D, 2.0);
    if (dT * s > 1.2) {
      R4(ctx, x + 0.15, D, 10.85, dT, teakTop); R4(ctx, x + 23.6, foreY, L - 23.4, dT, teakTop); R4(ctx, sx0 - 0.4, sunY + 0.06, x + 18.2 - sx0 + 0.4, dT, teakTop);
      if (s > 10) { ctx.fillStyle = teakLine; const th = Math.max(0.02, px * 0.6); for (let xx = x + 0.8; xx < x + 11; xx += 0.6) ctx.fillRect(xx, D, th, dT); for (let xx = x + 24.2; xx < x + L; xx += 0.6) ctx.fillRect(xx, foreY, th, dT); for (let xx = sx0; xx < x + 18.2; xx += 0.6) ctx.fillRect(xx, sunY + 0.06, th, dT); }
    }
    dkPool(ctx, env, S, 'aft', D - 0.1, dT + 0.1, 0.36, 1, 0, x, sx0);
    // saloon and the wheelhouse above its forward end
    R4(ctx, sx0, D, sx1 - sx0, 2.9, white);
    if (s > 3) { R4(ctx, sx0, D, sx1 - sx0, 0.5, shade); R4(ctx, sx1 - 0.5, D, 0.5, 2.9, whiteLo); }
    R4(ctx, sx0 - 0.5, D + 2.9, sx1 - sx0 + 0.9, 0.16, white2);
    for (let i = 0; i < wins.length; i++) {
      const op = wins[i]; drawWindowBack(ctx, env, S, P, op, glass, S.tone(S.pal.inRoom, P));
      if (s > 5 && S.rooms[op.room].lit) { // inside: a pelmet across the top and curtains tied back at the sides, all above and beside the guests
        ctx.fillStyle = drape; ctx.fillRect(op.x, op.y + op.h - 0.2, op.w, 0.2); ctx.fillRect(op.x, op.y + op.h * 0.42, 0.2, op.h * 0.58); ctx.fillRect(op.x + op.w - 0.2, op.y + op.h * 0.42, 0.2, op.h * 0.58);
        ctx.fillStyle = drape2; ctx.fillRect(op.x + 0.2, op.y + op.h - 0.29, op.w - 0.4, 0.09);
      }
    }
    dkPool(ctx, env, S, 'sun', sunY - 0.1, dT + 0.16, 0.36, 1, 0, sx0 - 0.5, x + 18.2);
    R4(ctx, x + 18.2, sunY, 5.3, 2.3, white); if (s > 3) R4(ctx, x + 18.2, sunY, 5.3, 0.4, shade);
    poly(ctx, [x + 18.2, sunY + 2.3, x + 23.5, sunY + 2.3, x + 22.6, sunY + 2.75, x + 18.6, sunY + 2.75], white2);
    poly(ctx, [x + 20.3, sunY + 0.95, x + 23.2, sunY + 0.95, x + 22.9, sunY + 1.95, x + 20.3, sunY + 1.95], lit ? S.tone('#3a4a66', P, true) : glass);
    R4(ctx, x + 18.6, sunY + 0.1, 0.9, 1.9, navy);
    if (s > 6) { // windscreen bars, a port in the door, a searchlight and the horns on the roof
      ctx.fillStyle = white; ctx.fillRect(x + 21.25, sunY + 0.95, 0.07, 1.0); ctx.fillRect(x + 22.15, sunY + 0.95, 0.07, 1.0);
      circ(ctx, x + 19.05, sunY + 1.45, 0.17, glass); R4(ctx, x + 19.32, sunY + 0.95, 0.06, 0.12, gold);
      R4(ctx, x + 22.0, sunY + 2.75, 0.34, 0.3, white2); circ(ctx, x + 22.38, sunY + 2.9, 0.13, lit ? '#fff3c4' : glass); R4(ctx, x + 19.0, sunY + 2.75, 0.5, 0.14, gold);
    }
    // mast, turning radar and aerials
    line(ctx, x + 20.4, sunY + 2.75, x + 19.9, sunY + 6.4, white2, 0.16, env);
    { const rw = 0.2 + 1.4 * Math.abs(Math.cos(t * 2.6)); R4(ctx, x + 20.1 - rw / 2, sunY + 4.3, rw, 0.22, white2); R4(ctx, x + 19.75, sunY + 4.05, 0.7, 0.25, white2); }
    line(ctx, x + 21.6, sunY + 2.75, x + 21.6, sunY + 5.2, dk, 0.04, env);
    if (s > 5) { line(ctx, x + 19.55, sunY + 5.5, x + 20.55, sunY + 5.5, white2, 0.07, env); line(ctx, x + 18.9, sunY + 2.75, x + 18.7, sunY + 4.6, dk, 0.03, env); }
    // steps from the aft deck to the sun deck, with a hand rail
    ctx.strokeStyle = white2; ctx.lineWidth = Math.max(0.09, px * 0.8); ctx.beginPath(); ctx.moveTo(x + 8.0, D); ctx.lineTo(x + 11.0, sunY); ctx.stroke();
    if (s > 3) { ctx.lineWidth = Math.max(0.05, px * 0.6); ctx.beginPath(); for (let i = 1; i < 8; i++) { const u = i / 8; ctx.moveTo(x + 8.0 + u * 3.0, D + u * 3.0); ctx.lineTo(x + 8.0 + u * 3.0 + 0.34, D + u * 3.0); } ctx.stroke(); }
    // aft deck furniture: a table with a bucket on ice, and a cushioned bench
    line(ctx, x + 4.6, D, x + 4.6, D + 0.72, dk, 0.07, env); R4(ctx, x + 4.0, D + 0.72, 1.2, 0.07, white2); R4(ctx, x + 0.7, D, 1.7, 0.5, navy);
    if (s > 6) { R4(ctx, x + 4.35, D, 0.5, 0.05, dk); R4(ctx, x + 4.42, D + 0.79, 0.26, 0.24, railC); R4(ctx, x + 4.5, D + 0.95, 0.06, 0.26, S.tone('#2f5a3f', P)); R4(ctx, x + 0.7, D + 0.42, 1.7, 0.08, white); R4(ctx, x + 0.7, D + 0.5, 0.12, 0.42, navy); }
    if (lit) { // the saloon windows spill a little light onto the side deck, and the starboard light shows green
      for (let i = 0; i < 3; i++) dkGlow(ctx, sx0 + 2.35 + i * 3.7, D + 0.5, 1.9, '255,226,166', 0.2 * S.pal.dark, 0.7);
      dkGlow(ctx, x + 23.45, sunY + 2.1, 0.8, '90,255,140', 0.6);
    }
    circ(ctx, x + 23.45, sunY + 2.1, 0.08, lit ? '#6dff9a' : S.tone('#2f7a4a', P));
    dkFoam(ctx, env, x + 1.1, x + L - 3.4, wy, x * 1.3, foam);
  } });
  P.add({ x0: x - 1, x1: x + L + 3, layer: 1, draw(ctx, env) { for (let i = 0; i < wins.length; i++) drawWindowFront(ctx, env, S, P, wins[i], white2, true); } });
  P.add({ x0: x - 1, x1: x + L + 3, layer: 2, draw(ctx, env) {
    // rails in front of everyone on deck
    ctx.strokeStyle = railC; ctx.lineWidth = Math.max(0.035, env.px * 0.6);
    ctx.beginPath();
    ctx.moveTo(x + 0.1, D + 0.95); ctx.lineTo(x + 8.0, D + 0.95); ctx.moveTo(sx0 - 0.4, sunY + 0.95); ctx.lineTo(x + 18.2, sunY + 0.95); ctx.moveTo(x + 23.6, foreY + 0.85); ctx.lineTo(x + L + 1.2, foreY + 1.35);
    if (env.s > 2.5) { for (let xx = x + 0.1; xx <= x + 8.01; xx += 1.58) { ctx.moveTo(xx, D); ctx.lineTo(xx, D + 0.95); } for (let xx = sx0 - 0.4; xx < x + 18.2; xx += 1.5) { ctx.moveTo(xx, sunY); ctx.lineTo(xx, sunY + 0.95); } for (let i = 0; i <= 6; i++) { const u = i / 6, xx = x + 23.6 + u * (L - 22.4); ctx.moveTo(xx, foreY + u * 0.5); ctx.lineTo(xx, foreY + 0.85 + u * 0.5); } }
    ctx.stroke();
    // a string of party lights from the masthead down to the stern
    const ax = x + 19.9, ay = sunY + 6.4, bx = x + 0.2, by = D + 2.5;
    ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.02, env.px * 0.5); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2, by + 1.0, bx, by); ctx.stroke();
    line(ctx, bx, D, bx, by, railC, 0.05, env);
    const cols = ['#ffd27a', '#ff8a6a', '#9fe0ff', '#ffe9b0'], rgbs = ['255,210,122', '255,138,106', '159,224,255', '255,233,176'];
    for (let i = 1; i < 14; i++) { const u = i / 14, qx = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * ((ax + bx) / 2) + u * u * bx, qy = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * (by + 1.0) + u * u * by - 0.1;
      if (lit) dkGlow(ctx, qx, qy, 0.7, rgbs[i % 4], 0.5 + 0.12 * Math.sin(env.t * 1.7 + i * 2.1));
      circ(ctx, qx, qy, 0.09, lit ? cols[i % 4] : S.tone(cols[i % 4], P)); }
  } });
  K.pennant(S, P, x + 19.9, sunY + 6.4, 1.6, '#c0392b');
  P.solid(x, wy - 3, L, D - wy + 3, 'hard'); P.solid(x + 23.5, D, L - 22.4, 0.7, 'hard');
  P.solid(sx0, D, sx1 - sx0, 2.95, 'wall'); P.solid(x + 18.2, sunY, 5.3, 2.5, 'wall');
  return { x, L, deckY: D, sunY, foreY, room: sal.id, aft: [x + 0.6, x + 10.6], sun: [sx0 - 0.1, x + 17.9], fore: [x + 24, x + L - 1.5], sal: [sx0 + 0.6, sx1 - 0.6], stairs: [x + 8.0, x + 11.0] };
};

// A rowing skiff with someone fishing from it. Returns where they sit.
K.skiff = function (S, P, x, wy, o) {
  o = o || {}; const hex = o.col || '#6f7f6a', hull = S.tone(hex, P), hull2 = S.tone(darken(hex, 0.22), P), dk = S.tone('#2a2620', P), trim = S.tone('#d9d2c0', P), wood = S.tone('#9a7a52', P), foam = rgba(S.tone('#e6edf2', P), 0.55), ring = rgba(S.tone('#e6edf2', P), 0.4);
  dkMirror(S, P, x - 1.6, x + 1.5, 0, 0.66, dkMirCol(S, P, hex), 0.5);
  P.add({ x0: x - 3.5, x1: x + 5, layer: 2, draw(ctx, env) {
    const s = env.s, t = env.t, bob = Math.sin(t * 1.3) * 0.04;
    // she lifts and tips a very little on the swell (her man sits still, so only a little)
    ctx.save(); ctx.translate(x, wy + Math.sin(t * 0.75 + x * 0.7) * 0.015); ctx.rotate(Math.sin(t * 0.9 + x) * 0.01);
    if (s > 5) { ctx.strokeStyle = wood; ctx.lineWidth = Math.max(0.05, env.px * 0.7); ctx.beginPath(); ctx.moveTo(-0.9, 0.66); ctx.lineTo(-2.45, 1.02); ctx.stroke(); poly(ctx, [-2.4, 0.94, -2.95, 1.05, -2.9, 1.2, -2.38, 1.08], wood); }     // a shipped oar, blade over the stern
    poly(ctx, [-2.0, 0.62, 2.2, 0.7, 1.5, -0.05, -1.6, -0.05], hull);
    if (s > 7) { ctx.strokeStyle = hull2; ctx.lineWidth = Math.max(0.025, env.px * 0.5); ctx.beginPath(); ctx.moveTo(-1.86, 0.4); ctx.lineTo(1.96, 0.45); ctx.moveTo(-1.73, 0.18); ctx.lineTo(1.73, 0.2); ctx.stroke(); R4(ctx, -0.95, 0.6, 0.12, 0.14, dk); }
    R4(ctx, -1.5, -0.05, 2.95, 0.1, hull2);
    R4(ctx, -1.95, 0.52, 4.05, 0.08, trim);
    ctx.restore();
    // the rod, the line and a float that dips
    ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.035, env.px * 0.6);
    ctx.beginPath(); ctx.moveTo(x + 0.35, wy + 1.25); ctx.quadraticCurveTo(x + 2.0, wy + 2.0, x + 3.1, wy + 2.3 - 0.05 * Math.sin(t * 1.3)); ctx.lineTo(x + 3.3, wy + 0.05 + bob); ctx.stroke();
    if (s > 6) { ctx.strokeStyle = ring; ctx.lineWidth = Math.max(0.02, env.px * 0.6); ctx.beginPath(); for (let i = 0; i < 2; i++) { const u = (t * 0.45 + i * 0.5) % 1, r = 0.12 + u * 0.5; ctx.moveTo(x + 3.3 + r, wy - 0.02); ctx.ellipse(x + 3.3, wy - 0.02, r, r * 0.22, 0, 0, TAU); } ctx.stroke(); }
    circ(ctx, x + 3.3, wy + 0.05 + bob, 0.07, S.tone('#c8372d', P, true));
    dkFoam(ctx, env, x - 1.6, x + 1.5, wy, x * 2.3, foam);
  } });
  return { plane: P, x, y: wy + 0.22, zone: o.zone || 'quay', behind: false, room: null };
};

// A sailing boat moored out in the basin. Her mast, and the bundle of furled
// sail at its head, stand between some shooting positions and the quay: from
// one place they hide something, from another they are out of the way.
K.ketch = function (S, P, x, wy, o) {
  o = o || {};
  const top = o.top || 9, w = o.w || 1.8, h = o.h || 1.7, off = o.off || 0, hx0 = x + (o.hull ? o.hull[0] : -9), hx1 = x + (o.hull ? o.hull[1] : 3);
  const hex = o.col || '#27483a', hull = S.tone(hex, P), hull2 = S.tone(darken(hex, 0.3), P), hullHi = S.tone(lighten(hex, 0.12), P), trim = S.tone('#d9d2c0', P), spar = S.tone('#8a6d4c', P), spar2 = S.tone('#6a5238', P), sail = S.tone('#cdbf9f', P, true), sail2 = S.tone('#8f8064', P, true), dk = S.tone('#1b1e24', P), cabin = S.tone('#b9b2a0', P), foam = rgba(S.tone('#e6edf2', P), 0.55);
  const hl = hx1 - hx0, mastTop = top + h / 2 + 1.0, cab0 = hx0 + hl * 0.34, cabW = Math.min(3.4, hl * 0.26), deckAt = (xx) => wy + 1.15 + 0.25 * (xx - hx0) / (hl + 1.3);
  dkMirror(S, P, hx0 + 0.7, hx1 - 0.7, 0, 1.25, dkMirCol(S, P, hex), 0.55);
  dkMirror(S, P, x - 0.1, x + 0.1, 1.25, mastTop - wy, dkMirCol(S, P, '#8a6d4c'), 0.5);
  P.add({ x0: Math.min(hx0, x + off - w) - 2, x1: Math.max(hx1, x + off + w) + 3, layer: 1, draw(ctx, env) {
    const s = env.s, px = env.px;
    poly(ctx, [hx0, wy + 1.15, hx1 + 1.3, wy + 1.4, hx1 - 0.7, wy - 0.05, hx0 + 0.7, wy - 0.05], hull);
    if (s > 4) { R4(ctx, hx0 + 0.66, wy - 0.05, hl - 1.3, 0.2, hull2); if (s > 7) { ctx.fillStyle = hullHi; ctx.fillRect(hx0 + 0.3, wy + 0.62, hl + 0.2, Math.max(0.025, px * 0.6)); } }
    R4(ctx, hx0 + 0.1, wy + 0.92, hl + 1.0, 0.1, trim);
    if (s > 4 && cabW > 1.6) { // a low cabin trunk with ports
      const cy = deckAt(cab0); R4(ctx, cab0, cy, cabW, 0.4, cabin); R4(ctx, cab0 - 0.1, cy + 0.4, cabW + 0.2, 0.07, spar2);
      if (s > 7) { ctx.fillStyle = dk; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cab0 + cabW * (0.2 + i * 0.3), cy + 0.2, 0.09, 0, TAU); ctx.fill(); } }
    }
    env.text(ctx, o.name || 'MARY ELLEN', hx0 + 0.9, wy + 0.32, 0.3, trim, 'left');
    line(ctx, x, wy + 1.1, x, mastTop, spar, 0.2, env);
    const bd = hx0 + 1 < x - 1 ? -1 : 1, bl = Math.min(6, Math.abs((bd < 0 ? hx0 : hx1) - x) - 1);
    line(ctx, x, wy + 2.3, x + bd * bl, wy + 2.5, spar, 0.16, env); R4(ctx, Math.min(x, x + bd * bl) + 0.3, wy + 2.5, bl - 0.6, 0.42, sail);
    if (s > 5) { ctx.fillStyle = sail2; for (let xx = Math.min(x, x + bd * bl) + 0.9; xx < Math.max(x, x + bd * bl) - 0.4; xx += 0.8) ctx.fillRect(xx, wy + 2.5, 0.06, 0.42); }      // sail ties
    ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.03, px * 0.55);
    ctx.beginPath(); ctx.moveTo(x, top + h / 2 + 0.9); ctx.lineTo(hx0 + 0.4, wy + 1.2); ctx.moveTo(x, top + h / 2 + 0.9); ctx.lineTo(hx1 + 0.9, wy + 1.4);
    if (s > 5) { const sh = wy + 1.2 + (top - wy) * 0.62; ctx.moveTo(x, sh); ctx.lineTo(x - 0.75, deckAt(x)); ctx.moveTo(x, sh); ctx.lineTo(x + 0.75, deckAt(x)); ctx.moveTo(x - 0.45, sh - 1.2); ctx.lineTo(x + 0.45, sh - 1.2); }
    ctx.stroke();
    // furled topsail lashed to its yard at the masthead
    line(ctx, x + off - w / 2 - 0.5, top + h / 2, x + off + w / 2 + 0.5, top + h / 2, spar, 0.16, env);
    const sx0 = x + off - w / 2, sy0 = top - h / 2;
    ctx.fillStyle = sail; ctx.beginPath(); ctx.moveTo(sx0, sy0 + h); ctx.lineTo(sx0 + w, sy0 + h); ctx.quadraticCurveTo(sx0 + w + 0.12, sy0 + h * 0.4, sx0 + w - 0.2, sy0); ctx.lineTo(sx0 + 0.2, sy0); ctx.quadraticCurveTo(sx0 - 0.12, sy0 + h * 0.4, sx0, sy0 + h); ctx.fill();
    if (s > 2) { ctx.strokeStyle = sail2; ctx.lineWidth = Math.max(0.05, px * 0.6); ctx.beginPath(); for (let i = 1; i < 6; i++) { const u = i / 6; ctx.moveTo(sx0 + w * u, sy0 + h); ctx.quadraticCurveTo(sx0 + w * u + 0.1, sy0 + h * 0.5, sx0 + w * u - 0.05, sy0); } ctx.stroke(); }
    if (s > 6) { ctx.strokeStyle = spar2; ctx.lineWidth = Math.max(0.04, px * 0.6); ctx.beginPath(); ctx.moveTo(sx0 - 0.05, sy0 + h * 0.3); ctx.lineTo(sx0 + w + 0.05, sy0 + h * 0.3); ctx.moveTo(sx0 - 0.02, sy0 + h * 0.7); ctx.lineTo(sx0 + w + 0.02, sy0 + h * 0.7); ctx.stroke(); }
    circ(ctx, x, mastTop, 0.12, spar2);
    dkFoam(ctx, env, hx0 + 0.7, hx1 - 0.7, wy, x * 1.9, foam);
  } });
  P.solid(x + off - w / 2, top - h / 2, w, h, 'hard');
  K.pennant(S, P, x, top + h / 2 + 1.0, 1.3, '#e2b33c');
};

// ---- boats that move ---------------------------------------------------------
// An open launch: a helmsman under a little canopy forward, passengers on the
// thwarts aft. Nobody is behind glass, so both "windows" count as open.
// (She does not rock: the people in her are drawn by the game at fixed seats.)
CARS.launch = { len: 7.6, h: 2.75, body: 0.85, cab: [0, 0], win: [[-0.44, 0.04], [0.08, 0.36]], seats: [0.22, -0.2, -0.36], wheel: 0,
  draw(ctx, env, S, P, x, y, dir, colHex, st) {
    const L = 7.6, hex = colHex || '#3d4f5c', col = S.tone(hex, P, true), dk = S.tone(darken(hex, 0.35), P), trim = S.tone('#d9d2c0', P, true), steel = S.tone('#1b1e24', P), steel2 = S.tone('#3d434c', P), lit = S.pal.dark > 0.3;
    const wood = S.tone('#8a6a45', P), wood2 = S.tone('#6a5034', P), canvas = S.tone('#6f7f6a', P), canvas2 = S.tone('#57654f', P), fender = S.tone('#e6e2d6', P), rope = S.tone('#b9a27e', P);
    const s = env.s, px = env.px, t = env.t, moving = !!(st && st.moving);
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    const wl = 0.25; // the waterline: the hull below this is under water
    { // her dark shape in the water under her
      ctx.fillStyle = dkMirCol(S, P, hex);
      for (let j = 0; j < 4; j++) { ctx.globalAlpha = 0.5 * (1 - j / 4.6); ctx.fillRect(-L / 2 + 0.3 + Math.sin(t * 1.3 + j * 1.9) * 0.07 * (j + 1), wl - (j + 1) * 0.19, L - 0.5, 0.14); }
      ctx.globalAlpha = 1;
    }
    if (moving) {
      // white water astern breaking up as it falls behind, and the bow wave curling off the stem
      ctx.strokeStyle = 'rgba(228,238,247,0.62)'; ctx.lineWidth = Math.max(0.07, px);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const u = (t * 1.2 + i / 8) % 1, xx = -L / 2 - 0.3 - u * 8.5, yy = wl + 0.03 + (((i * 7) % 5) - 2) * 0.035 * (1 + u * 3), ln = 1.0 * (1 - u * 0.6); ctx.moveTo(xx, yy); ctx.lineTo(xx - ln, yy); }
      ctx.moveTo(L / 2 - 0.2, wl + 0.05); ctx.quadraticCurveTo(L / 2 + 0.55, wl + 0.55, L / 2 - 1.3, wl + 0.02);
      ctx.stroke();
      // the two arms of the wake spreading behind her: the near one falls toward you, the far one lifts away
      ctx.strokeStyle = 'rgba(228,238,247,0.34)'; ctx.beginPath();
      for (let i = 0; i < 6; i++) { const u = (t * 0.9 + i / 6) % 1, a = 0.6 + u * 11;
        ctx.moveTo(L / 2 - 0.8 - a, wl - 0.05 - a * 0.06); ctx.lineTo(L / 2 - 2.1 - a, wl - 0.05 - (a + 1.3) * 0.06);
        if (a > L - 0.4) { ctx.moveTo(L / 2 - 0.8 - a, wl + 0.03 + (a - L) * 0.035); ctx.lineTo(L / 2 - 2.1 - a, wl + 0.03 + (a + 1.3 - L) * 0.035); } }
      ctx.stroke();
    } else if (s > 3) { // lying still: a line from the bow up to the quay
      ctx.strokeStyle = rope; ctx.lineWidth = Math.max(0.04, px * 0.6); ctx.beginPath(); ctx.moveTo(L / 2 - 0.2, 0.95); ctx.quadraticCurveTo(L / 2 + 0.9, 1.0, L / 2 + 1.5, -y + 0.25); ctx.stroke();
    }
    // outboard motor: a leg in the water, a cowl, a tiller
    R4(ctx, -L / 2 - 0.34, wl - 0.12, 0.2, 1.1, steel);
    poly(ctx, [-L / 2 - 0.5, 0.84, -L / 2 + 0.06, 0.84, -L / 2 + 0.06, 1.2, -L / 2 - 0.3, 1.3, -L / 2 - 0.5, 1.14], steel2);
    if (s > 7) { R4(ctx, -L / 2 - 0.46, 0.98, 0.5, 0.05, trim); line(ctx, -L / 2 + 0.02, 1.12, -L / 2 + 0.62, 1.2, steel, 0.04, env); }
    // hull: planked, a pale gunwale, a dark waterline
    poly(ctx, [-L / 2, 0.85, L / 2 + 0.55, 0.98, L / 2 - 0.55, wl, -L / 2 + 0.12, wl], col);
    if (s > 5) { ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.025, px * 0.5); ctx.beginPath(); for (let k = 1; k < 3; k++) { const f = k / 3; ctx.moveTo(-L / 2 + 0.12 * (1 - f), wl + (0.85 - wl) * f); ctx.lineTo(L / 2 - 0.62 + 1.1 * f, wl + (0.98 - wl) * f); } ctx.stroke(); }
    poly(ctx, [-L / 2 + 0.02, 0.66, L / 2 + 0.3, 0.76, L / 2 + 0.4, 0.86, -L / 2 + 0.01, 0.76], trim);
    R4(ctx, -L / 2 + 0.1, wl, L - 0.7, 0.1, dk);
    if (s > 4) { // fenders hung along the side
      ctx.strokeStyle = rope; ctx.lineWidth = Math.max(0.02, px * 0.4); ctx.beginPath(); for (let i = 0; i < 3; i++) { const fx = -2.6 + i * 2.25; ctx.moveTo(fx, 0.72); ctx.lineTo(fx, 0.6); } ctx.stroke();
      ctx.fillStyle = fender; for (let i = 0; i < 3; i++) ctx.fillRect(-2.6 + i * 2.25 - 0.07, 0.33, 0.14, 0.3);
    }
    // canopy over the helm, on two posts, with a windscreen, the wheel and its console
    line(ctx, 0.7, 0.85, 0.7, 2.5, steel, 0.07, env); line(ctx, 2.62, 0.85, 2.5, 2.5, steel, 0.07, env);
    R4(ctx, 0.45, 2.5, 2.4, 0.13, dk); if (s > 5) { R4(ctx, 0.45, 2.58, 2.4, 0.07, canvas); ctx.fillStyle = canvas2; for (let xx = 0.5; xx < 2.8; xx += 0.3) ctx.fillRect(xx, 2.42, 0.22, 0.08); }
    line(ctx, 2.62, 0.95, 2.95, 1.75, trim, 0.05, env);
    R4(ctx, 2.2, 0.85, 0.42, 0.62, dk);
    if (s > 7) { ctx.strokeStyle = steel; ctx.lineWidth = Math.max(0.035, px * 0.6); ctx.beginPath(); ctx.moveTo(2.3, 1.56); ctx.arc(2.13, 1.56, 0.17, 0, TAU); ctx.stroke(); }
    // cargo, a coil of rope in the bow, and a stern lantern on a staff
    R4(ctx, -0.55, 0.85, 0.7, 0.42, wood); R4(ctx, -3.3, 0.85, 0.5, 0.36, canvas);
    if (s > 7) { ctx.fillStyle = wood2; ctx.fillRect(-0.55, 1.03, 0.7, 0.04); ctx.fillRect(-0.24, 0.85, 0.04, 0.42); ctx.fillStyle = rope; ctx.fillRect(3.05, 0.96, 0.5, 0.06); ctx.fillRect(3.1, 1.02, 0.4, 0.05); }
    line(ctx, -L / 2 + 0.3, 0.85, -L / 2 + 0.3, 2.35, steel, 0.05, env);
    if (s > 9) R4(ctx, -L / 2 + 0.2, 2.26, 0.2, 0.08, steel);
    circ(ctx, -L / 2 + 0.3, 2.42, 0.11, lit ? '#fff3c4' : trim);
    if (lit) { // a small oil lamp astern, a coloured light forward: green to starboard, red to port
      dkGlow(ctx, -L / 2 + 0.3, 2.42, 1.7, '255,226,150', 0.62 * S.pal.dark);
      dkGlow(ctx, 2.75, 2.7, 0.8, dir > 0 ? '90,255,140' : '255,80,60', 0.7);
    }
    circ(ctx, 2.75, 2.7, 0.07, dir > 0 ? '#6dff9a' : '#ff5a48');
    // lamp light from the jetty catching her gunwale as she comes under it
    if (S.pal.dark > 0.5) { const l = S.lightAt('veh:launch', x).l; if (l > 0.03 && S.zoneLamps['veh:launch']) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.34 * l; poly(ctx, [-L / 2 + 0.02, 0.66, L / 2 + 0.3, 0.76, L / 2 + 0.4, 0.86, -L / 2 + 0.01, 0.76], 'rgb(255,222,150)'); ctx.globalAlpha = 0.1 * l; R4(ctx, -L / 2 + 0.1, 0.36, L - 0.3, 0.3, 'rgb(255,222,150)'); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
    ctx.restore();
    env.text(ctx, 'KITTIWAKE', x + dir * (L / 2 - 1.8), y + 0.4, 0.21, trim, 'center');
    if (lit) { // the lantern on the water: in her own strip here, and handed on to the nearer water
      const lx = x + dir * (-L / 2 + 0.3), wy = y + wl, a = 0.5 * S.pal.dark;
      ctx.globalCompositeOperation = 'lighter'; dkStreak(ctx, px, t, lx, wy, wy - 2.17, wy - 4.7, wy, wy - 6, 0.36, a, 'rgb(255,226,150)', lx); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (st) { const d = st.dkL || (st.dkL = { css: 'rgb(255,226,150)', w: 0.36 }); d.P = P; d.x = lx; d.y = y + 2.42; d.a = a; dkOf(S).dyn.push(d); }
    }
  } };
// The night ferry: scenery that crosses the channel with all its windows lit.
CARS.ferry = { len: 54, h: 12, body: 4.2, cab: [-0.5, 0.5], win: [], seats: [], wheel: 0, solid: true,
  draw(ctx, env, S, P, x, y, dir, colHex) {
    const L = 54, lit = S.pal.dark > 0.3, hex = colHex || '#1f3350';
    const white = S.tone('#dfe2e0', P), white2 = S.tone('#b9bfc2', P), hull = S.tone(hex, P), hullHi = S.tone(lighten(hex, 0.13), P), boot = S.tone('#8a2f28', P), winC = S.tone(lit ? S.pal.lit : S.pal.glass, P, true), fun = S.tone('#c98a2b', P), fun2 = S.tone('#9c6a1f', P), dk = S.tone('#14181f', P), boatC = S.tone('#c0683c', P);
    const s = env.s, px = env.px, t = env.t;
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    // she is always under way: a wake astern, foam along her side and a bow wave
    ctx.strokeStyle = 'rgba(228,238,247,0.55)'; ctx.lineWidth = Math.max(0.18, px); ctx.beginPath();
    for (let i = 0; i < 10; i++) { const u = (t * 0.5 + i / 10) % 1, xx = -L / 2 + 1 - u * 30, yy = 0.05 + (((i * 7) % 5) - 2) * 0.12 * (0.5 + u * 2), ln = 4 * (1 - u * 0.6); ctx.moveTo(xx, yy); ctx.lineTo(xx - ln, yy); }
    for (let i = 0; i < 6; i++) { const u = (t * 0.8 + i / 6) % 1, xx = L / 2 - 4 - u * (L - 8); ctx.moveTo(xx, 0.1); ctx.lineTo(xx - 2.2 * (1 - u * 0.5), 0.1); }
    ctx.moveTo(L / 2 - 2.4, 0.2); ctx.quadraticCurveTo(L / 2 - 0.5, 2.0, L / 2 - 6.5, 0.12);
    ctx.stroke();
    poly(ctx, [-L / 2, 4.2, L / 2 + 2, 4.6, L / 2 - 3, 0, -L / 2 + 1, 0], hull);
    poly(ctx, [-L / 2 + 0.8, 0.85, L / 2 - 2.08, 0.85, L / 2 - 3, 0, -L / 2 + 1, 0], boot);
    R4(ctx, -L / 2 + 0.3, 3.4, L + 0.4, 0.3, white);
    if (s > 3) { // a rubbing strake, a row of ports, the anchor
      R4(ctx, -L / 2 + 0.6, 1.75, L - 2.5, 0.1, hullHi);
      ctx.fillStyle = lit ? winC : dk; ctx.beginPath(); for (let i = 0; i < 19; i++) { const px0 = -L / 2 + 3 + i * 2.5; ctx.moveTo(px0 + 0.22, 2.55); ctx.arc(px0, 2.55, 0.22, 0, TAU); } ctx.fill();
      poly(ctx, [L / 2 - 1.5, 3.1, L / 2 - 0.5, 3.1, L / 2 - 0.7, 2.3, L / 2 - 1.0, 2.6, L / 2 - 1.3, 2.3], dk);
    }
    R4(ctx, -L / 2 + 3, 4.2, L - 11, 2.5, white); R4(ctx, -L / 2 + 6, 6.7, L - 18, 2.4, white); R4(ctx, L / 2 - 17, 9.1, 7, 1.9, white);
    R4(ctx, -L / 2 + 2.6, 6.62, L - 10.2, 0.16, white2); R4(ctx, -L / 2 + 5.6, 9.02, L - 17.2, 0.16, white2); R4(ctx, L / 2 - 17.4, 11.0, 7.8, 0.18, white2);
    poly(ctx, [-L / 2 + 13, 9.1, -L / 2 + 18, 9.1, -L / 2 + 17, 12, -L / 2 + 13.5, 12], fun); R4(ctx, -L / 2 + 13.4, 11.2, 3.8, 0.8, dk);
    if (s > 3) { poly(ctx, [-L / 2 + 16.3, 9.1, -L / 2 + 18, 9.1, -L / 2 + 17, 12, -L / 2 + 15.9, 12], fun2); R4(ctx, -L / 2 + 13.25, 10.1, 4.4, 0.5, white); R4(ctx, -L / 2 + 13.4, 11.2, 3.8, 0.8, dk); }
    ctx.fillStyle = winC;
    for (let i = 0; i < 17; i++) ctx.fillRect(-L / 2 + 4.2 + i * 2.4, 4.9, 1.5, 1.1);
    for (let i = 0; i < 13; i++) ctx.fillRect(-L / 2 + 7.2 + i * 2.4, 7.3, 1.5, 1.1);
    ctx.fillRect(L / 2 - 16.3, 9.6, 5.6, 0.9);
    if (s > 3) { // boats in their davits on the top deck, rails on the open decks, a mast over the bridge
      for (let i = 0; i < 2; i++) { const bx = -L / 2 + 21 + i * 7.5; poly(ctx, [bx, 10.2, bx + 5.2, 10.2, bx + 4.7, 9.4, bx + 0.5, 9.4], boatC); R4(ctx, bx, 10.2, 5.2, 0.16, white2); }
      ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.05, px * 0.6); ctx.beginPath();
      ctx.moveTo(-L / 2 + 0.4, 5.2); ctx.lineTo(-L / 2 + 3, 5.2); ctx.moveTo(L / 2 - 8, 5.5); ctx.lineTo(L / 2 + 1.6, 5.6); ctx.moveTo(-L / 2 + 3, 7.7); ctx.lineTo(-L / 2 + 6, 7.7); ctx.moveTo(L / 2 - 12, 7.7); ctx.lineTo(L / 2 - 8, 7.7);
      ctx.moveTo(-L / 2 + 6, 10.05); ctx.lineTo(-L / 2 + 12.6, 10.05); ctx.moveTo(L / 2 - 13.5, 11.2); ctx.lineTo(L / 2 - 13.5, 15); ctx.moveTo(L / 2 - 14.6, 13.6); ctx.lineTo(L / 2 - 12.4, 13.6);
      ctx.stroke();
    }
    dkSmoke(ctx, -L / 2 + 15.3, 12.1, t, env.wind * dir - 3.5, 11, 1.4, 5.5, S.pal.dark > 0.5 ? 'rgb(112,122,142)' : 'rgb(72,74,82)', 0.26, x * 0.01);
    if (lit) { // masthead and stern lights, and her coloured side light: red to port, green to starboard
      dkGlow(ctx, L / 2 - 13.5, 15.1, 2.4, '255,244,214', 0.8); circ(ctx, L / 2 - 13.5, 15.1, 0.2, '#fff3c4');
      dkGlow(ctx, L / 2 - 9.6, 10.3, 1.5, dir > 0 ? '90,255,140' : '255,80,60', 0.8); circ(ctx, L / 2 - 9.6, 10.3, 0.15, dir > 0 ? '#6dff9a' : '#ff5a48');
      dkGlow(ctx, -L / 2 + 0.6, 5.4, 1.5, '255,244,214', 0.6);
    }
    ctx.restore();
    env.text(ctx, 'CALDER FERRIES', x - dir * 2, y + 1.95, 1.05, white, 'center');
    if (lit) { // her lit decks lying on the water under her, in broken columns
      const k = S.pal.dark;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) { const lx = x + dir * (-L / 2 + 5 + i * 5.2); if (lx < env.x0 - 4 || lx > env.x1 + 4) continue; dkStreak(ctx, px, t, lx, y, y - 6, y - 13, y, y - 14, 2.4, 0.2 * k, 'rgb(255,214,130)', lx * 0.37); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  } };

// ---- the location ------------------------------------------------------------
SCN.docks = function (o) {
  o = o || {};
  const z = o.z || 255, wy = -2.2, seed = o.seed || 4;
  const end = o.end === undefined ? 22 : o.end, pierLen = o.pier === undefined ? 30 : o.pier, pierEnd = end + pierLen;
  const S = makeScene({ time: o.time || 'dusk', weather: o.weather, seed, refZ: z, exits: o.exits || [-68], fog: o.fog,
    bounds: o.bounds || { x0: -52, x1: 58, y0: -7, y1: 30 }, ambience: 'harbour', groundMat: 'hard', sun: o.sun || [92, 19] });
  if (o.pal) Object.assign(S.pal, o.pal);
  if (o.glow) S.pal.dark = Math.max(S.pal.dark, 0.34);     // lamps and beams show in fog and half light
  if (o.seeMul) S.seeMul = o.seeMul;
  const lit = S.pal.dark > 0.3, night = S.pal.dark > 0.5, rainy = S.weather === 'rain' || S.weather === 'storm';
  const H = { S, z, wy, end, pierEnd };
  const dk = dkOf(S), A = makeRng(seed * 131 + 977);      // A: a stream of its own for decoration, so nothing that matters to play moves
  const gulls = S.weather !== 'storm';
  const lampRgb = rgbOf(S.pal.lit).join(',');

  // ---- far away: city, far shore, breakwater, channel ----
  K.skyline(S, z + 1700, { seed: 31 + seed, hMin: 16, hMax: 84, base: -40, ground: false, x0: -1300, x1: 1300 });
  const PFS = S.plane(z + 900, 'farshore');
  {
    const hillHex = '#3c4a52', hill = S.tone(hillHex, PFS), hill2 = S.tone(lighten(hillHex, 0.13), PFS), low = S.tone(darken(hillHex, 0.2), PFS), craneC = S.tone('#55626c', PFS), lampC = S.tone(S.pal.lit, PFS, true);
    const houseC = [S.tone('#5d696e', PFS), S.tone('#6a6c66', PFS), S.tone('#525e66', PFS)], roofC = S.tone('#34404a', PFS), tankC = S.tone('#75808a', PFS), tankD = S.tone('#5c6770', PFS), stackC = S.tone('#6e6a68', PFS), stackR = S.tone('#8a4a40', PFS), shedC = S.tone('#4a5660', PFS), shipH = S.tone('#27303a', PFS), shipW = S.tone('#9aa3aa', PFS);
    const boxC = [S.tone('#8a4a40', PFS), S.tone('#3f5f80', PFS), S.tone('#4a7460', PFS), S.tone('#a8823f', PFS), S.tone('#6f777f', PFS), S.tone('#7a4862', PFS)];
    const pts = []; for (let x = -900; x <= 900; x += 30) pts.push([x, wy + 5 + 26 * (0.5 + 0.5 * vnoise(x / 190, seed + 9)) * (0.6 + 0.4 * vnoise(x / 61, seed + 3))]);
    const pts2 = []; for (let x = -900; x <= 900; x += 30) pts2.push([x, wy + 13 + 19 * (0.5 + 0.5 * vnoise(x / 270, seed + 21))]);
    const hillAt = (x) => { const i = clamp((x + 900) / 30, 0, pts.length - 1.001), a = Math.floor(i); return lerp(pts[a][1], pts[a + 1][1], i - a); };
    // the town on the hillside, the container terminal under the cranes, sheds, oil tanks and chimneys along the shore
    const houses = []; for (let i = 0; i < 54; i++) { const hx = A.r(-870, 870), top = hillAt(hx); houses.push(hx, wy + 3 + A.f() * Math.max(0, top - wy - 11) * 0.85, A.r(5, 9), A.r(3.2, 5.2), A.i(0, 2), A.chance(0.62) ? 1 : 0); }
    const boxes = [[], [], [], [], [], []]; for (let bx = -322; bx < 46; bx += 12.7) { const n = A.i(0, 4); for (let j = 0; j < n; j++) boxes[A.i(0, 5)].push(bx, wy + 1.4 + j * 2.6); }
    const lamps = [], refl = [];
    for (let lx = -885 + A.r(0, 12); lx < 885; lx += A.r(9, 26)) { const ly = wy + 1.4 + A.f() * 2.4; lamps.push(lx, ly, A.chance(0.22) ? 1 : 0); refl.push(lx, A.r(5, 13), A.r(1.1, 2.1), A.r(0.2, 0.42)); }
    for (let i = 0; i < houses.length; i += 6) if (houses[i + 5]) lamps.push(houses[i] + houses[i + 2] * 0.3, houses[i + 1] + houses[i + 3] * 0.45, 0);
    dkMirror(S, PFS, -900, 900, 0, 9, mix(hill, S.tone(S.pal.water, PFS), 0.35), 0.5);
    PFS.add({ x0: -900, x1: 900, layer: 0, draw(ctx, env) {
      const s = env.s, px = env.px, t = env.t, v0 = env.x0 - 30, v1 = env.x1 + 30;
      ctx.fillStyle = hill2; ctx.beginPath(); ctx.moveTo(-900, wy - 1); for (let i = 0; i < pts2.length; i++) ctx.lineTo(pts2[i][0], pts2[i][1]); ctx.lineTo(900, wy - 1); ctx.closePath(); ctx.fill();
      // a radio mast on the far ridge
      if (-600 > v0 && -600 < v1) { const my = wy + 22; ctx.strokeStyle = low; ctx.lineWidth = Math.max(0.6, px); ctx.beginPath(); ctx.moveTo(-600, my); ctx.lineTo(-600, my + 52); ctx.stroke();
        if (s > 1) { ctx.lineWidth = Math.max(0.2, px * 0.6); ctx.beginPath(); ctx.moveTo(-600, my + 46); ctx.lineTo(-622, my); ctx.moveTo(-600, my + 46); ctx.lineTo(-578, my); ctx.moveTo(-600, my + 26); ctx.lineTo(-612, my); ctx.moveTo(-600, my + 26); ctx.lineTo(-588, my); ctx.stroke(); }
        if (lit) { const b = dkPulse(t, 1.6, 1, 0); dkGlow(ctx, -600, my + 52.5, 5, '255,70,50', 0.8 * b); R4(ctx, -600.8, my + 51.7, 1.6, 1.6, mix('#5a1f1a', '#ff5a48', b)); R4(ctx, -600.6, my + 26, 1.2, 1.2, '#b8443a'); } }
      ctx.fillStyle = hill; ctx.beginPath(); ctx.moveTo(-900, wy - 1); for (let i = 0; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.lineTo(900, wy - 1); ctx.closePath(); ctx.fill();
      if (s > 0.8) { // houses up the slope, their roofs showing when you are close enough
        for (let k = 0; k < 3; k++) { ctx.fillStyle = houseC[k]; for (let i = 0; i < houses.length; i += 6) { if (houses[i + 4] !== k) continue; const hx = houses[i]; if (hx < v0 || hx > v1) continue; ctx.fillRect(hx, houses[i + 1], houses[i + 2], houses[i + 3]); } }
        if (s > 1.5) { ctx.fillStyle = roofC; ctx.beginPath(); for (let i = 0; i < houses.length; i += 6) { const hx = houses[i]; if (hx < v0 || hx > v1) continue; const hy = houses[i + 1] + houses[i + 3], w = houses[i + 2]; ctx.moveTo(hx - 0.5, hy); ctx.lineTo(hx + w + 0.5, hy); ctx.lineTo(hx + w * 0.5, hy + 2.2); ctx.closePath(); } ctx.fill(); }
        // a church with a spire
        if (655 > v0 && 655 < v1) { const cy = hillAt(655) - 4; R4(ctx, 648, cy, 16, 9, houseC[1]); R4(ctx, 660, cy, 6, 17, houseC[1]); poly(ctx, [659.4, cy + 17, 666.6, cy + 17, 663, cy + 30], roofC); poly(ctx, [647, cy + 9, 660, cy + 9, 660, cy + 13.5], roofC); }
      }
      // the shore: a strip of quay, sheds with saw tooth roofs, oil tanks, two chimneys
      R4(ctx, Math.max(-900, v0), wy - 0.6, Math.min(900, v1) - Math.max(-900, v0), 2.0, low);
      for (let i = 0; i < 3; i++) { const x0 = 66 + i * 62; if (x0 + 56 < v0 || x0 > v1) continue; R4(ctx, x0, wy + 1.4, 56, 9, shedC);
        ctx.fillStyle = roofC; ctx.beginPath(); for (let k = 0; k < 4; k++) { ctx.moveTo(x0 + k * 14, wy + 10.4); ctx.lineTo(x0 + k * 14 + 14, wy + 10.4); ctx.lineTo(x0 + k * 14 + 3.5, wy + 14.6); ctx.closePath(); } ctx.fill(); }
      for (let i = 0; i < 5; i++) { const x0 = 292 + i * 37; if (x0 + 28 < v0 || x0 > v1) continue; R4(ctx, x0, wy + 1.4, 28, 13, tankC); R4(ctx, x0 + 20, wy + 1.4, 8, 13, tankD);
        ctx.fillStyle = tankC; ctx.beginPath(); ctx.ellipse(x0 + 14, wy + 14.4, 14, 2.1, 0, 0, Math.PI); ctx.fill(); if (s > 1.6) { ctx.strokeStyle = tankD; ctx.lineWidth = Math.max(0.3, px * 0.7); ctx.beginPath(); ctx.moveTo(x0 + 1, wy + 1.4); ctx.lineTo(x0 + 11, wy + 14.2); ctx.stroke(); } }
      for (let i = 0; i < 2; i++) { const cx = i ? 548 : 262, ch = i ? 44 : 58; if (cx < v0 - 60 || cx > v1 + 60) continue;
        poly(ctx, [cx - 2.6, wy + 1.4, cx + 2.6, wy + 1.4, cx + 1.7, wy + ch, cx - 1.7, wy + ch], stackC);
        if (s > 1.2) { R4(ctx, cx - 1.85, wy + ch - 6, 3.7, 2.2, stackR); R4(ctx, cx - 1.95, wy + ch - 12, 3.9, 2.2, stackR); }
        dkSmoke(ctx, cx, wy + ch + 0.5, t * 0.7, env.wind, 46, 3.4, 20, night ? 'rgb(96,106,128)' : 'rgb(120,116,120)', night ? 0.22 : 0.3, cx);
        if (lit) { const b = dkPulse(t, 1.3, cx, 0); R4(ctx, cx - 1, wy + ch, 2, 2, mix('#5a1f1a', '#ff5a48', b)); dkGlow(ctx, cx, wy + ch + 1, 5, '255,70,50', 0.7 * b); } }
      // a ship lying at the terminal, its boxes stacked on the quay, and the big cranes over them
      if (-420 < v1 && -335 > v0) { poly(ctx, [-424, wy + 9, -338, wy + 9, -334, wy + 12, -344, wy - 0.2, -420, wy - 0.2], shipH); R4(ctx, -420, wy + 9, 20, 11, shipW); R4(ctx, -414, wy + 20, 6, 6, stackR);
        if (s > 0.8) for (let k = 0; k < 6; k++) R4(ctx, -396 + (k % 3) * 17, wy + 9 + Math.floor(k / 3) * 3, 15.5, 3 + (k % 2) * 3, boxC[(k * 2 + 1) % 6]); }
      if (s > 0.7) for (let k = 0; k < 6; k++) { ctx.fillStyle = boxC[k]; const b = boxes[k]; for (let i = 0; i < b.length; i += 2) { if (b[i] < v0 || b[i] > v1) continue; ctx.fillRect(b[i], b[i + 1], 12.2, 2.45); } }
      ctx.strokeStyle = craneC; ctx.lineWidth = Math.max(1.4, px);
      ctx.beginPath();
      for (let i = 0; i < 5; i++) { const cx = -250 + i * 58; if (cx + 30 < v0 || cx - 40 > v1) continue; ctx.moveTo(cx - 9, wy); ctx.lineTo(cx - 9, wy + 46); ctx.moveTo(cx + 9, wy); ctx.lineTo(cx + 9, wy + 46); ctx.moveTo(cx - 34, wy + 34); ctx.lineTo(cx + 24, wy + 34); ctx.moveTo(cx - 9, wy + 46); ctx.lineTo(cx - 34, wy + 34); ctx.moveTo(cx + 9, wy + 46); ctx.lineTo(cx + 24, wy + 34); ctx.moveTo(cx - 9, wy + 18); ctx.lineTo(cx + 9, wy + 18); }
      ctx.stroke();
      if (s > 1.4) { // their bracing, trolley, cab and the spreader hanging on its falls
        ctx.lineWidth = Math.max(0.5, px * 0.7); ctx.beginPath();
        for (let i = 0; i < 5; i++) { const cx = -250 + i * 58; if (cx + 30 < v0 || cx - 40 > v1) continue; const tr = cx - 26 + ((Math.sin(t * 0.08 + i * 2.1) + 1) * 0.5) * 30;
          ctx.moveTo(cx - 9, wy + 1); ctx.lineTo(cx + 9, wy + 18); ctx.moveTo(cx + 9, wy + 1); ctx.lineTo(cx - 9, wy + 18); ctx.moveTo(cx - 9, wy + 18); ctx.lineTo(cx + 9, wy + 34); ctx.moveTo(cx + 9, wy + 18); ctx.lineTo(cx - 9, wy + 34);
          ctx.moveTo(cx - 34, wy + 36.5); ctx.lineTo(cx + 24, wy + 36.5); ctx.moveTo(tr, wy + 34); ctx.lineTo(tr, wy + 22 + i % 2 * 6); ctx.moveTo(tr + 3, wy + 34); ctx.lineTo(tr + 3, wy + 22 + i % 2 * 6); }
        ctx.stroke();
        ctx.fillStyle = craneC; for (let i = 0; i < 5; i++) { const cx = -250 + i * 58; if (cx + 30 < v0 || cx - 40 > v1) continue; const tr = cx - 26 + ((Math.sin(t * 0.08 + i * 2.1) + 1) * 0.5) * 30; ctx.fillRect(tr - 2, wy + 30.5, 7, 3.5); ctx.fillRect(tr - 4.5, wy + 20.5 + i % 2 * 6, 12, 1.6); ctx.fillRect(cx - 12, wy + 36.5, 6, 4); }
      }
      if (lit) {
        ctx.fillStyle = lampC; const sz = Math.max(1.1, px * 1.6);
        for (let i = 0; i < lamps.length; i += 3) { const lx = lamps[i]; if (lx < v0 || lx > v1) continue; ctx.fillRect(lx - sz / 2, lamps[i + 1] - sz / 2, sz, sz); }
        if (s > 0.9) for (let i = 0; i < lamps.length; i += 3) { if (!lamps[i + 2]) continue; const lx = lamps[i]; if (lx < v0 || lx > v1) continue; dkGlow(ctx, lx, lamps[i + 1], 4.5, lampRgb, 0.5); }
        const b = dkPulse(t, 2.1, 0, 0), bc = mix('#5a1f1a', '#ff5a48', b);
        for (let i = 0; i < 5; i++) { const cx = -250 + i * 58; if (cx < v0 || cx > v1) continue; R4(ctx, cx - 1.3, wy + 46, 2.6, 2.6, bc); dkGlow(ctx, cx, wy + 47.3, 5.5, '255,70,50', 0.7 * b); }
        // cars on the shore road, and an aeroplane a long way off
        for (let i = 0; i < 4; i++) { const dirc = i % 2 ? 1 : -1, cxx = ((((t * (11 + i * 2) * dirc + i * 431) % 1700) + 1700) % 1700) - 850; if (cxx < v0 || cxx > v1) continue; R4(ctx, cxx, wy + 1.7, 1.6, 1.0, '#fff3c4'); R4(ctx, cxx - dirc * 3.4, wy + 1.7, 1.2, 0.9, '#c8443a'); }
        if (night) { const pxx = (((t * 9) % 2600) + 2600) % 2600 - 1300, pyy = wy + 150 + pxx * 0.02; if (pxx > v0 && pxx < v1) { R4(ctx, pxx, pyy, 1.4, 1.4, '#ff5a48'); if (Math.sin(t * 5) > 0.82) dkGlow(ctx, pxx + 4, pyy, 4, '255,255,255', 0.9); } }
      }
    } });
    K.sea(S, PFS, { y: wy, rows: 4, sheen: rainy ? null : S.pal.skyBot, sheenD: 150, seed: 3 });
    if (lit) PFS.add({ x0: -900, x1: 900, layer: 0, draw(ctx, env) { // the shore lights lying on the water
      const c = dk.cam, yb = Math.max(c.ey + (wy - c.ey) * (PFS.z - c.ez) / Math.max(8, z + 400 - c.ez), env.y0 === undefined ? wy - 30 : env.y0), t = env.t, v0 = env.x0 - 4, v1 = env.x1 + 4;
      if (yb >= wy || env.s < 0.5) return;
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = lampC;
      for (let i = 0; i < refl.length; i += 4) { const lx = refl[i]; if (lx < v0 || lx > v1) continue; const len = refl[i + 1], w = refl[i + 2], bh = len / 5;
        for (let j = 0; j < 5; j++) { const yy = wy - 0.5 - (j + 1) * bh; if (yy < yb) break; ctx.globalAlpha = refl[i + 3] * (1 - j / 5.5) * (0.7 + 0.3 * Math.sin(t * 2.2 + i + j * 1.7)); ctx.fillRect(lx - w / 2 + Math.sin(t * 1.5 + j * 1.9 + i) * w * 0.3, yy, w * (0.5 + 0.5 * Math.abs(Math.sin(j * 3.7 + i))), Math.max(env.px * 1.1, bh * 0.22)); } }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    } });
  }
  const PBW = S.plane(z + 400, 'breakwater');
  {
    const stone = S.tone('#565d63', PBW), stone2 = S.tone('#6b7278', PBW), stone3 = S.tone('#474e54', PBW), wetS = S.tone('#3e4549', PBW), railC = S.tone('#2c3138', PBW), foam = rgba(S.tone('#e6edf2', PBW), 0.5), bx1 = o.lightX === undefined ? 96 : o.lightX;
    K.sea(S, PBW, { y: wy, rows: 5, seed: 5 });
    dkMirror(S, PBW, -1200, bx1 + 6, 0, 3, dkMirCol(S, PBW, '#565d63'), 0.5);
    PBW.add({ x0: -1200, x1: bx1 + 8, layer: 1, draw(ctx, env) {
      const xa = Math.max(env.x0 - 4, -1200), xb = Math.min(env.x1 + 4, bx1 + 6); if (xb <= xa) return;
      const s = env.s;
      R4(ctx, xa, wy - 0.4, xb - xa, 3.2, stone); R4(ctx, xa, wy - 0.4, xb - xa, 1.0, wetS); R4(ctx, xa, wy + 2.5, xb - xa, 0.5, stone2);
      ctx.fillStyle = stone2; const a = Math.floor(xa / 9) * 9; for (let x = a; x < xb; x += 9) ctx.fillRect(x + dkHash(x) * 5, wy + 0.7 + dkHash(x * 3) * 1.1, 3 + dkHash(x * 7) * 3, 0.5);
      if (s > 3) { // the big blocks it is built of, and a hand rail along the top out to the light
        ctx.fillStyle = stone3; const th = Math.max(0.06, env.px * 0.8), a3 = Math.floor(xa / 3.4) * 3.4;
        ctx.fillRect(xa, wy + 1.55, xb - xa, th); for (let x = a3; x < xb; x += 3.4) { ctx.fillRect(x, wy + 0.6, th, 0.95); ctx.fillRect(x + 1.7, wy + 1.55, th, 0.95); }
        const r0 = Math.max(xa, bx1 - 80), r1 = Math.min(xb, bx1 - 3);
        if (r1 > r0) { ctx.strokeStyle = railC; ctx.lineWidth = Math.max(0.07, env.px * 0.6); ctx.beginPath(); ctx.moveTo(r0, wy + 4.0); ctx.lineTo(r1, wy + 4.0); for (let x = Math.ceil(r0 / 6) * 6; x < r1; x += 6) { ctx.moveTo(x, wy + 3.0); ctx.lineTo(x, wy + 4.0); } ctx.stroke(); }
      }
      dkFoam(ctx, env, xa, xb, wy, 31, foam);
    } });
    K.lighthouse(S, PBW, bx1, wy + 2.8, 19);
    if (S.pal.dark < 0.5 && !rainy) { // gulls wheeling off the breakwater, a long way off: gliding mostly, a few beats now and then
      const gc = S.tone('#eef0ee', PBW);
      PBW.add({ x0: bx1 - 130, x1: bx1 + 40, layer: 2, draw(ctx, env) {
        if (env.s < 2.2) return; const t = env.t;
        ctx.strokeStyle = gc; ctx.lineWidth = Math.max(env.px * 1.1, 0.13); ctx.lineJoin = 'round'; ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = t * (0.16 + i * 0.023) + i * 2.4, gx = bx1 - 46 + Math.cos(a) * (24 + i * 5) + Math.sin(a * 0.37 + i) * 9, gy = wy + 15 + i * 2.6 + Math.sin(a * 1.31) * 5;
          const up = 0.16 + 0.4 * Math.max(-0.4, Math.sin(t * (3.2 + i * 0.4) + i)) * (Math.sin(t * 0.31 + i * 1.7) > 0.2 ? 1 : 0.2), sp = 1.2;
          ctx.moveTo(gx - sp, gy + up); ctx.quadraticCurveTo(gx - sp * 0.45, gy + up * 1.5 + 0.12, gx, gy); ctx.quadraticCurveTo(gx + sp * 0.45, gy + up * 1.5 + 0.12, gx + sp, gy + up);
        }
        ctx.stroke(); ctx.lineJoin = 'miter';
      } });
    }
    H.PBW = PBW;
  }
  const PCH = S.plane(z + 135, 'channel');
  K.sea(S, PCH, { y: wy, rows: 6, seed: 8 });
  K.buoy(S, PCH, o.farBuoyX === undefined ? 86 : o.farBuoyX, wy, { bell: false, col: '#2f7a4a', lamp: '#6dff9a' });
  if (o.anchored !== false) { // a fishing boat lying at anchor out in the channel, lifting to the swell
    const ax = o.anchoredX === undefined ? 50 : o.anchoredX, hc = S.tone('#3d4f5c', PCH), hc2 = S.tone('#2a3640', PCH), wc = S.tone('#d9d2c0', PCH), wc2 = S.tone('#b3ac9a', PCH), dkc = S.tone('#1b1e24', PCH), wn = S.tone(lit ? S.pal.lit : S.pal.glass, PCH, true), tyre = S.tone('#14161a', PCH), sailC = S.tone('#9a5a3a', PCH), foam = rgba(S.tone('#e6edf2', PCH), 0.5);
    dkMirror(S, PCH, ax - 7, ax + 7, 0, 2.1, dkMirCol(S, PCH, '#3d4f5c'), 0.55);
    if (lit) { dkLight(S, { P: PCH, x: ax + 1.6, y: wy + 9.9, rgb: '255,240,200', a: 0.5, w: 0.7, near: z + 1 }); dkLight(S, { P: PCH, x: ax - 3.3, y: wy + 3.4, rgb: lampRgb, a: 0.3, w: 1.6, near: z + 1 }); }
    PCH.add({ x0: ax - 14, x1: ax + 14, layer: 1, draw(ctx, env) {
      const s = env.s, t = env.t;
      ctx.save(); ctx.translate(ax, wy + Math.sin(t * 0.6 + 1) * 0.07); ctx.rotate(Math.sin(t * 0.8) * 0.016 + Math.sin(t * 1.37 + 2) * 0.007);
      if (s > 3) { ctx.strokeStyle = dkc; ctx.lineWidth = Math.max(0.05, env.px * 0.6); ctx.beginPath(); ctx.moveTo(8.9, 1.9); ctx.lineTo(12.4, -0.1); ctx.stroke(); }      // her anchor cable
      poly(ctx, [-8, 1.9, 9.5, 2.4, 7, -0.05, -7, -0.05], hc); R4(ctx, -6.95, -0.05, 13.9, 0.4, hc2); R4(ctx, -7.8, 1.55, 16.6, 0.16, wc);
      R4(ctx, -5.6, 1.9, 4.6, 2.5, wc); R4(ctx, -1.6, 1.9, 0.6, 2.5, wc2); R4(ctx, -5.0, 2.95, 3.3, 0.95, wn); R4(ctx, -5.9, 4.4, 5.2, 0.25, dkc);
      if (s > 4) { ctx.fillStyle = wc; ctx.fillRect(-3.95, 2.95, 0.1, 0.95); ctx.fillRect(-2.85, 2.95, 0.1, 0.95); R4(ctx, -1.5, 1.95, 0.42, 1.7, hc2);
        ctx.strokeStyle = tyre; ctx.lineWidth = Math.max(0.22, env.px); ctx.beginPath(); for (let i = 0; i < 3; i++) { ctx.moveTo(-3.6 + i * 4.2 + 0.36, 0.95); ctx.arc(-3.6 + i * 4.2, 0.95, 0.36, 0, TAU); } ctx.stroke();
        R4(ctx, -7.7, 1.9, 0.26, 2.3, dkc); R4(ctx, -7.9, 4.1, 1.6, 0.2, dkc); circ(ctx, -6.6, 2.5, 0.55, hc2); }
      line(ctx, 1.6, 2.1, 1.6, 9.6, dkc, 0.26, env); line(ctx, 1.6, 7.6, 7.6, 4.2, dkc, 0.16, env); line(ctx, 1.6, 9.4, -7.6, 2.0, dkc, 0.05, env); line(ctx, 1.6, 9.4, 9.2, 2.4, dkc, 0.05, env);
      if (s > 3) poly(ctx, [1.75, 4.3, 1.75, 7.3, 2.25, 7.1, 6.9, 4.5, 6.6, 4.1], sailC);                    // a steadying sail, loosely furled along its gaff
      if (lit) { dkGlow(ctx, 1.6, 9.9, 2.6, '255,240,200', 0.75); circ(ctx, 1.6, 9.9, 0.3, '#fff3c4'); dkGlow(ctx, -3.3, 3.4, 2.0, lampRgb, 0.3); }
      ctx.restore();
      env.text(ctx, 'PC 114', ax + 5.4, wy + 0.75, 0.7, wc, 'center');
      dkFoam(ctx, env, ax - 7, ax + 7, wy, 77, foam);
    } });
  }
  H.PCH = PCH;

  // ---- the far berth: a freighter, and the water round her ----
  const PSH = S.plane(z + 26, 'berth');
  K.sea(S, PSH, { y: wy, rows: 6, seed: 11 });
  if (o.ship !== false) { H.ship = K.freighter(S, PSH, o.shipX === undefined ? -58 : o.shipX, wy, { name: o.shipName }); }
  H.PSH = PSH;
  H.onShip = (x, extra) => Object.assign({ plane: PSH, x, y: H.ship ? H.ship.deckY : 6, zone: 'ship', behind: false, room: null }, extra || {});
  // Sound the freighter's horn: loud shots are covered while it lasts.
  H.horn = (sim, dur) => { S.hornFrom = sim.t; S.hornUntil = sim.t + dur; sim.cover(dur, 'ship horn'); };

  // ---- the back of the quay: warehouse, office and container stacks ----
  const PB = S.plane(z + 7, 'yard');
  const gHex = mix(S.pal.ground, '#2a2e36', 0.25);
  K.ground(S, PB, { col: gHex, x1: end, noEdge: true });
  PB.groundFn = (x) => (x <= end ? 0 : -1e6);
  H.PB = PB;
  const wx = -62, ww = 26, wh = 8.2;                        // the warehouse
  const condC = S.tone('#8d949a', PB);                     // electrical conduit on the office wall
  { // the top of the quay as you look down on it: paving, the crane rails, a painted line, puddles, and the lamp light lying on it
    const joint = S.tone(darken(gHex, 0.17), PB), patch = S.tone(darken(gHex, 0.1), PB), patchL = S.tone(lighten(gHex, 0.06), PB), railC = S.tone('#8f969c', PB), yel = S.tone('#c79a2e', PB);
    const pudC = mix(S.tone(darken(gHex, 0.3), PB), S.tone(S.pal.skyBot, PB), 0.16), pudHi = mix(pudC, S.tone(S.pal.skyBot, PB, true), 0.22), ringC = rgba(S.tone('#dfe6ee', PB), 0.5);
    const pud = []; for (let px0 = -74 + A.r(0, 6); px0 < end - 3; px0 += A.r(rainy ? 4 : 7, rainy ? 9 : 14)) { const rx = A.r(0.7, 1.9); pud.push(px0, A.r(rx + 0.4, 6.2), rx); }
    const marks = []; for (let i = 0; i < 16; i++) marks.push(A.r(-74, end - 4), A.r(0.6, 5.6), A.r(1.4, 3.6), A.i(0, 1));
    PB.add({ x0: -400, x1: end, layer: 0, draw(ctx, env) {
      const c = dk.cam, dq = z - c.ez, dB = PB.z - c.ez; if (dq < 4) return;
      const kk = dB / dq, yb = c.ey * (1 - kk), s = env.s, px = env.px;
      if (-yb * s < 1.6) return;
      const xa = Math.max(env.x0 - 1, -400), xb = Math.min(env.x1 + 1, end); if (xb <= xa) return;
      const yAt = (w) => c.ey * (1 - dB / (dq + w)), xAt = (x, w) => c.ex + (x - c.ex) * dB / (dq + w), th = Math.max(px * 0.8, 0.012);
      R4(ctx, xa, yAt(6.2), xb - xa, -yAt(6.2), 'rgba(0,0,0,0.17)');                   // shade along the foot of the buildings
      if (s > 4) { // patches of newer tarmac and old oil
        for (let i = 0; i < marks.length; i += 4) { const w = marks[i + 1], xx = xAt(marks[i], w); if (xx > xb || xx + 4 < xa) continue; const y0 = yAt(w); ctx.fillStyle = marks[i + 3] ? patch : patchL; ctx.fillRect(xx, y0, marks[i + 2], yAt(w + 0.9) - y0); }
      }
      if (s > 5) { // paving joints along the quay and across it
        ctx.fillStyle = joint; ctx.fillRect(xa, yAt(1.7), xb - xa, th); ctx.fillRect(xa, yAt(3.3), xb - xa, th); ctx.fillRect(xa, yAt(4.9), xb - xa, th);
        if (s > 8) { ctx.strokeStyle = joint; ctx.lineWidth = th; ctx.beginPath(); for (let x = Math.floor((xa - 3) / 4) * 4; x < xb + 3; x += 4) { if (x > end) break; ctx.moveTo(xAt(x, 0), yb); ctx.lineTo(x, 0); } ctx.stroke(); }
      }
      if (s > 3) { // the crane rails, and a yellow line set back from the edge
        ctx.fillStyle = railC; ctx.fillRect(xa, yAt(0.8), xb - xa, Math.max(px, 0.014)); ctx.fillRect(xa, yAt(5.9), xb - xa, Math.max(px * 0.8, 0.01));
        ctx.fillStyle = yel; ctx.fillRect(xa, yAt(0.28), xb - xa, Math.max(px, yAt(0.46) - yAt(0.28)));
      }
      if (s > 3.5) { // puddles, each showing a little sky, and at night the lamp light it catches
        ctx.fillStyle = pudC; ctx.beginPath();
        for (let i = 0; i < pud.length; i += 3) { const w = pud[i + 1], rx = pud[i + 2], xx = xAt(pud[i], w); if (xx + rx < xa || xx - rx > xb) continue; ctx.moveTo(xx + rx, yAt(w)); ctx.ellipse(xx, yAt(w), rx, Math.max(px * 0.7, (yAt(w + rx) - yAt(w - rx)) / 2), 0, 0, TAU); }
        ctx.fill();
        for (let i = 0; i < pud.length; i += 3) { const w = pud[i + 1], rx = pud[i + 2], xx = xAt(pud[i], w); if (xx + rx < xa || xx - rx > xb) continue; const ry = Math.max(px * 0.5, (yAt(w + rx) - yAt(w - rx)) / 2), yy = yAt(w);
          const l = night ? S.lightAt('quay', pud[i]).l : 0;
          ctx.fillStyle = pudHi; ctx.globalAlpha = night ? 0.3 : 0.6; ctx.beginPath(); ctx.ellipse(xx - rx * 0.18, yy + ry * 0.25, rx * 0.62, ry * 0.5, 0, 0, TAU); ctx.fill();
          if (l > 0.03) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * l; ctx.fillStyle = 'rgb(255,222,150)'; ctx.beginPath(); ctx.ellipse(xx, yy, rx * 0.8, ry * 0.7, 0, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
          ctx.globalAlpha = 1;
          if (rainy && s > 6) { const u = (env.t * 1.3 + i * 0.37) % 1, r2 = rx * (0.15 + 0.5 * u); ctx.strokeStyle = ringC; ctx.lineWidth = Math.max(px * 0.8, 0.01); ctx.globalAlpha = 1 - u; ctx.beginPath(); ctx.ellipse(xx + rx * 0.3 * Math.sin(i * 3.3 + Math.floor(env.t * 1.3 + i * 0.37)), yy, r2, r2 * ry / rx, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
        }
      }
      dkPool(ctx, env, S, 'quay', yb, -yb, rainy ? 0.4 : 0.3, kk, c.ex, xa, xb);
      if (lit && !o.gate) dkGlow(ctx, xAt(wx + 19.15, 5), yAt(5), 3.2, lampRgb, 0.3, Math.max(px, -yb * 0.5));        // light from the open shed door lying on the ground
    } });
  }
  {
    // warehouse: a corrugated shed with a sliding door, vents, a gutter and down pipes, and its name on a board
    const wallHex = '#556470', wall = S.tone(wallHex, PB), rib = S.tone('#46535e', PB), ribHi = S.tone(lighten(wallHex, 0.07), PB), roof = S.tone('#343c44', PB), roofHi = S.tone('#4a545e', PB), door = S.tone('#2b2420', PB), door2 = S.tone('#3a322c', PB), paint = S.tone('#d9d2c0', PB), glowC = S.tone(S.pal.lit, PB, true), glow2 = S.tone(darken(S.pal.lit, 0.22), PB, true);
    const plinth = S.tone('#4c555d', PB), rustA = rgba(S.tone('#7a4a2e', PB), 0.42), grime = rgba(S.tone('#1c2026', PB), 0.3), pipe = S.tone('#2a3138', PB), board = S.tone('#27323c', PB), palletC = S.tone('#8a6f4a', PB), pallet2 = S.tone('#5f4b30', PB), drumC = S.tone('#3f5870', PB), drum2 = S.tone('#2c4054', PB), yelC = S.tone('#c79a2e', PB), shade = 'rgba(0,0,0,0.12)';
    const streaks = []; for (let i = 0; i < 14; i++) streaks.push(wx + 0.6 + A.f() * (ww - 1.2), A.r(0.5, 2.6), A.r(0.06, 0.16));
    if (lit && !o.gate) dkLight(S, { P: PB, x: wx + 19.15, y: 2.8, rgb: lampRgb, a: 0.22, w: 2.0 });
    PB.add({ x0: wx - 1, x1: wx + ww + 1, layer: 0, draw(ctx, env) {
      const s = env.s, px = env.px, th = Math.max(0.03, px * 0.8);
      R4(ctx, wx, 0, ww, wh, wall);
      if (s > 2.2) { ctx.fillStyle = rib; const x0 = Math.max(wx + 0.3, Math.floor(env.x0 / 0.45) * 0.45 + 0.3), x1 = Math.min(wx + ww, env.x1); for (let x = x0; x < x1; x += 0.45) ctx.fillRect(x, 0.1, 0.1, wh - 0.2);
        if (s > 9) { ctx.fillStyle = ribHi; for (let x = x0 + 0.1; x < x1; x += 0.45) ctx.fillRect(x, 0.1, 0.05, wh - 0.2); } }
      if (s > 3) { // rust under the eaves, a shaded band beneath them, a grimy plinth
        ctx.fillStyle = rustA; for (let i = 0; i < streaks.length; i += 3) ctx.fillRect(streaks[i], wh - streaks[i + 1], streaks[i + 2], streaks[i + 1]);
        R4(ctx, wx, wh - 0.5, ww, 0.5, shade); R4(ctx, wx, 0, ww, 0.6, plinth); R4(ctx, wx, 0.6, ww, 0.35, grime);
      }
      poly(ctx, [wx - 0.5, wh, wx + ww + 0.5, wh, wx + ww + 0.5, wh + 0.5, wx + ww / 2, wh + 2.1, wx - 0.5, wh + 0.5], roof);
      if (s > 3) { // the lit edge of the roof, a gutter, down pipes at the corners, and a louvred vent in the gable
        ctx.strokeStyle = roofHi; ctx.lineWidth = Math.max(0.07, px); ctx.beginPath(); ctx.moveTo(wx - 0.5, wh + 0.5); ctx.lineTo(wx + ww / 2, wh + 2.1); ctx.lineTo(wx + ww + 0.5, wh + 0.5); ctx.stroke();
        R4(ctx, wx - 0.5, wh - 0.06, ww + 1, 0.14, pipe); R4(ctx, wx + 0.25, 0, 0.16, wh, pipe); R4(ctx, wx + ww - 0.45, 0, 0.16, wh, pipe);
        R4(ctx, wx + ww / 2 - 0.9, wh + 0.45, 1.8, 0.9, door); if (s > 7) { ctx.fillStyle = roofHi; for (let i = 0; i < 4; i++) ctx.fillRect(wx + ww / 2 - 0.8, wh + 0.55 + i * 0.2, 1.6, 0.07); }
        ctx.fillStyle = door; for (let i = 0; i < 3; i++) ctx.fillRect(wx + 2.2 + i * 3.4, 5.9, 1.9, 0.9);                     // vents high on the wall
        if (s > 7) { ctx.fillStyle = rib; for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++) ctx.fillRect(wx + 2.3 + i * 3.4, 6.0 + k * 0.2, 1.7, 0.07); }
      }
      // the sliding door on its track
      R4(ctx, wx + 13.2, 0, 7.2, 5.2, door); R4(ctx, wx + 13.2, 5.2, 7.2, 0.3, roof);
      if (s > 3) { R4(ctx, wx + 6.4, 5.26, 14.2, 0.14, pipe);
        ctx.fillStyle = door2; for (let x = wx + 13.6; x < wx + 20.3; x += 0.6) ctx.fillRect(x, 0.1, 0.07, 5.0);
        if (s > 6) { R4(ctx, wx + 16.75, 0, 0.1, 5.2, pipe); ctx.fillStyle = pipe; for (let i = 0; i < 4; i++) ctx.fillRect(wx + 13.7 + i * 2.0, 5.12, 0.4, 0.2); } }
      if (lit) { // one leaf stands open on a lit store: shelves, a crate, and light on the floor
        R4(ctx, wx + 17.9, 0, 2.5, 5.2, glowC);
        if (s > 4) { ctx.fillStyle = glow2; ctx.fillRect(wx + 17.9, 3.9, 2.5, 0.1); ctx.fillRect(wx + 17.9, 2.7, 2.5, 0.1); ctx.fillRect(wx + 19.5, 2.8, 0.6, 0.7); ctx.fillRect(wx + 18.1, 4.0, 0.9, 0.5); ctx.fillRect(wx + 17.9, 0, 2.5, 0.25); }
        R4(ctx, wx + 18.3, 0, 1.3, 1.6, door);
        if (s > 6) { ctx.fillStyle = door2; ctx.fillRect(wx + 18.3, 0.75, 1.3, 0.06); ctx.fillRect(wx + 18.9, 0, 0.06, 1.6); }
      } else if (s > 5) { // shut: a wicket door, and warning stripes along the foot
        R4(ctx, wx + 18.6, 0, 1.1, 2.2, door2); R4(ctx, wx + 18.68, 0.08, 0.94, 2.04, door); R4(ctx, wx + 19.45, 1.05, 0.1, 0.06, paint);
        ctx.fillStyle = yelC; ctx.beginPath(); for (let x = wx + 13.3; x < wx + 18.4; x += 0.7) { ctx.moveTo(x, 0); ctx.lineTo(x + 0.35, 0); ctx.lineTo(x + 0.6, 0.35); ctx.lineTo(x + 0.25, 0.35); ctx.closePath(); } ctx.fill();
      }
      R4(ctx, wx + 13.0, 6.05, 12.6, 1.5, board);
      if (s > 4) { ctx.strokeStyle = paint; ctx.lineWidth = Math.max(0.04, px * 0.6); ctx.strokeRect(wx + 13.12, 6.17, 12.36, 1.26); }
      env.text(ctx, 'CALDER WHARF', wx + 19.3, 6.3, 1.0, paint, 'center'); env.text(ctx, 'SHED 4', wx + 6.6, 3.0, 1.3, paint, 'center');
      if (s > 4 && !o.gate) { // against the wall beside the door: a stack of pallets, two drums and a notice
        for (let i = 0; i < 5; i++) { R4(ctx, wx + 21.2, i * 0.17, 1.25, 0.13, palletC); if (s > 9) { ctx.fillStyle = pallet2; ctx.fillRect(wx + 21.25, i * 0.17, 0.1, 0.05); ctx.fillRect(wx + 21.78, i * 0.17, 0.1, 0.05); ctx.fillRect(wx + 22.3, i * 0.17, 0.1, 0.05); } }
        R4(ctx, wx + 23.3, 0, 0.62, 0.9, drumC); R4(ctx, wx + 24.05, 0, 0.62, 0.9, drumC); ctx.fillStyle = drum2; ctx.fillRect(wx + 23.3, 0.28, 0.62, 0.06); ctx.fillRect(wx + 23.3, 0.6, 0.62, 0.06); ctx.fillRect(wx + 24.05, 0.28, 0.62, 0.06); ctx.fillRect(wx + 24.05, 0.6, 0.62, 0.06);
        R4(ctx, wx + 21.5, 2.2, 1.5, 1.0, paint); env.text(ctx, 'NOTICE', wx + 22.25, 2.85, 0.24, door, 'center');
        if (s > 12) { ctx.fillStyle = door2; for (let i = 0; i < 3; i++) ctx.fillRect(wx + 21.65, 2.35 + i * 0.14, 1.2 - i * 0.25, 0.04); }
      }
    } });
    PB.solid(wx, 0, ww, wh, 'wall');
    const B = K.building(S, PB, { x: wx + ww, w: 9, floors: 2, fh: 3.5, id: 'off', wall: '#7a6156', seed: 5 + seed, ac: false, parapet: 0.6, door: 0, antenna: 0.72,
      spans: { 1: [[0, 1, 'room', lit || o.officeLit === true]] }, wins: { '0,0': { none: true }, '0,1': { lit: false, blind: 0.4 }, '1,0': { blind: 0 }, '1,1': { blind: 0 } } });
    H.off = B; H.office = 'off:room';
    H.inOffice = (x, extra) => Object.assign({ plane: PB, x: x === undefined ? B.winX(1) : x, y: B.floorY(1), room: 'off:room', zone: 'off:room', behind: true }, extra || {});
    dkLight(S, { P: PB, x: B.winX(1), y: B.floorY(1) + 1.7, rgb: lampRgb, a: 0.3, w: 1.3, fn: () => (S.pal.dark > 0.3 && S.rooms['off:room'].lit ? 1 : 0) });
    const signC = S.tone('#1c1f26', PB), signT = S.tone('#f3e9c9', PB, true), brass = S.tone('#b9a06a', PB), paper = S.tone('#e4dfd0', PB), ink = S.tone('#3a3f47', PB);
    PB.add({ x0: B.x, x1: B.x + B.w, layer: 1, draw(ctx, env) {
      const s = env.s;
      R4(ctx, B.x + 4.6, 2.55, 3.8, 0.7, signC);
      if (s > 6) { ctx.strokeStyle = brass; ctx.lineWidth = Math.max(0.03, env.px * 0.6); ctx.strokeRect(B.x + 4.67, 2.62, 3.66, 0.56); }
      env.text(ctx, 'HARBOUR OFFICE', B.x + 6.5, 2.74, 0.4, signT, 'center');
      if (s > 6) { // the tide tables, pinned up in a glazed case by the door
        R4(ctx, B.x + 3.55, 1.25, 0.95, 1.15, signC); R4(ctx, B.x + 3.62, 1.32, 0.81, 1.01, paper);
        if (s > 14) { ctx.fillStyle = ink; for (let i = 0; i < 6; i++) ctx.fillRect(B.x + 3.7, 1.42 + i * 0.13, 0.65 - (i % 3) * 0.12, 0.035); }
        env.text(ctx, 'TIDES', B.x + 4.02, 2.14, 0.15, ink, 'center');
      }
    } });
  }
  // containers: [x, how many high]
  const R = makeRng(seed * 71 + 5);
  H.stacks = [];
  (o.stacks || [[-25.6, 2], [-19.3, 3], [-13, 1], [5, 2], [11.3, 2]]).forEach((st, si) => {
    const sx = st[0], n = st[1];
    for (let i = 0; i < n; i++) { const ci = R.i(0, DOCK_BOX_COLS.length - 1); K.cbox(S, PB, sx, i * 2.6, (st[2] && st[2][i]) || DOCK_BOX_COLS[ci], { text: R.chance(0.6) ? DOCK_BOX_NAMES[R.i(0, DOCK_BOX_NAMES.length - 1)] : null, door: R.chance(0.25) }); }
    H.stacks.push({ x0: sx, x1: sx + 6.1, top: n * 2.6 });
  });
  H.stackTop = (x) => { let t = 0; H.stacks.forEach((s) => { if (x >= s.x0 && x <= s.x1) t = Math.max(t, s.top); }); return t; };
  H.onContainers = (x, extra) => Object.assign({ plane: PB, x, y: H.stackTop(x), zone: 'stack', behind: false, room: null }, extra || {});
  if (o.fuse !== false) {
    const f = o.fuse || {}, fx = f.x === undefined ? -27.6 : f.x, fy = f.y === undefined ? 1.9 : f.y;
    if (H.off && fx > H.off.x && fx < H.off.x + H.off.w) { // the conduit that carries the quay lamps' supply up the office wall from the fuse box
      const cond = condC, plate = S.tone('#c79a2e', PB), ink = S.tone('#20242b', PB);
      PB.add({ x0: fx - 1, x1: fx + 1, layer: 1, draw(ctx, env) {
        if (env.s < 4) return;
        R4(ctx, fx - 0.04, fy + 0.5, 0.08, 4.2, cond); R4(ctx, fx - 0.09, fy + 1.6, 0.18, 0.07, cond); R4(ctx, fx - 0.09, fy + 3.2, 0.18, 0.07, cond); R4(ctx, fx - 0.16, fy + 4.6, 0.32, 0.26, cond);
        if (env.s > 9) { R4(ctx, fx - 0.32, fy + 0.62, 0.64, 0.2, plate); ctx.fillStyle = ink; ctx.fillRect(fx - 0.24, fy + 0.69, 0.48, 0.05); }
      } });
    }
    H.fuse = K.thing(S, PB, 'fuse', fx, fy, { id: 'fuse', cuts: f.cuts || ['quay'] });
  }
  if (o.gate) { // the dock gate at the landward end: fence, booth and a raised barrier
    const gx = o.gate.x === undefined ? -44 : o.gate.x, dkc = S.tone('#22262d', PB), dkHi = S.tone('#3d444d', PB), booth = S.tone('#8a8f7a', PB), booth2 = S.tone('#6f7462', PB), sign = S.tone('#1c1f26', PB), signT = S.tone('#f3e9c9', PB, true), winL = S.tone(S.pal.lit, PB, true), winL2 = S.tone(darken(S.pal.lit, 0.25), PB, true), winD = S.tone(S.pal.glass, PB), red = S.tone('#c8372d', PB, true), cream = S.tone('#e9e4d6', PB, true);
    K.fence(S, PB, gx - 30, gx - 4.5, 3.2, { kind: 'mesh', layer: 1 });
    PB.add({ x0: gx - 6, x1: gx + 8, layer: 1, draw(ctx, env) {
      const s = env.s;
      R4(ctx, gx - 4.6, 0, 0.3, 4.6, dkc); R4(ctx, gx + 3.6, 0, 0.3, 4.6, dkc);
      if (s > 5) { R4(ctx, gx - 4.6, 0, 0.09, 4.6, dkHi); R4(ctx, gx + 3.6, 0, 0.09, 4.6, dkHi); R4(ctx, gx - 4.75, 0, 0.6, 0.18, dkc); R4(ctx, gx + 3.45, 0, 0.6, 0.18, dkc); }
      R4(ctx, gx - 4.6, 4.0, 8.5, 0.9, sign);
      if (s > 5) { ctx.strokeStyle = signT; ctx.lineWidth = Math.max(0.03, env.px * 0.6); ctx.strokeRect(gx - 4.5, 4.1, 8.3, 0.7); }
      env.text(ctx, 'PORT CALDER  GATE 3', gx - 0.35, 4.25, 0.5, signT, 'center');
      // the gate keeper's booth: an overhanging roof, a lit window with the shape of a desk lamp in it, a door
      R4(ctx, gx + 4.2, 0, 2.6, 2.7, booth); if (s > 4) { R4(ctx, gx + 4.2, 0, 2.6, 0.5, booth2); R4(ctx, gx + 6.55, 0, 0.25, 2.7, booth2); }
      R4(ctx, gx + 4.0, 2.7, 3.0, 0.2, dkc);
      R4(ctx, gx + 4.6, 1.2, 1.3, 1.0, lit ? winL : winD);
      if (s > 5) { if (lit) { ctx.fillStyle = winL2; ctx.fillRect(gx + 4.6, 1.2, 1.3, 0.14); ctx.fillRect(gx + 5.45, 1.34, 0.06, 0.35); ctx.fillRect(gx + 5.3, 1.66, 0.36, 0.12); }
        ctx.strokeStyle = dkc; ctx.lineWidth = Math.max(0.05, env.px * 0.7); ctx.strokeRect(gx + 4.6, 1.2, 1.3, 1.0); R4(ctx, gx + 6.05, 0, 0.45, 2.05, booth2); R4(ctx, gx + 4.5, 1.1, 1.5, 0.08, dkc); }
      if (lit) dkGlow(ctx, gx + 5.25, 1.0, 1.5, lampRgb, 0.2, 0.7);
      // the barrier, raised: a striped arm on a post with a counterweight
      R4(ctx, gx + 3.2, 0, 0.3, 1.3, dkc);
      ctx.save(); ctx.translate(gx + 3.4, 1.1); ctx.rotate(1.25); R4(ctx, -0.75, -0.14, 0.75, 0.28, dkc); for (let i = 0; i < 6; i++) R4(ctx, i * 0.7, -0.07, 0.7, 0.14, i % 2 ? cream : red); ctx.restore();
    } });
    PB.solid(gx + 4.2, 0, 2.6, 2.7, 'wall');
    H.gate = { x: gx };
  }

  // ---- the quay front and the pier ----
  const PQ = S.plane(z, 'quay');
  H.PQ = PQ;
  const weed = S.tone('#3d4a3f', PQ), weed2 = S.tone('#4f6149', PQ), wetC = S.tone('#474d54', PQ), barn = S.tone('#7f8478', PQ), dkc = S.tone('#22262d', PQ), dkHi = S.tone('#4c535c', PQ), rope = S.tone('#b9a27e', PQ), rope2 = S.tone('#8a7650', PQ);
  const foamQ = rgba(S.tone('#e6edf2', PQ), 0.55), gullW = S.tone('#f1f1ec', PQ), gullG = S.tone('#8f979e', PQ), gullB = S.tone('#d6a12a', PQ), gullK = S.tone('#20242b', PQ);
  {
    const wallHex = '#6c7278', wall = S.tone(wallHex, PQ), wall2 = S.tone('#585e64', PQ), wallHi = S.tone(lighten(wallHex, 0.1), PQ), wallLo = S.tone(darken(wallHex, 0.1), PQ), cope = S.tone('#9aa0a4', PQ), copeHi = S.tone('#b4b9bc', PQ), copeLo = S.tone('#7d8388', PQ);
    const tyre = S.tone('#14161a', PQ), tyreHi = S.tone('#343940', PQ), yel = S.tone('#d6a12a', PQ), timber = S.tone('#4a3a2c', PQ), timber2 = S.tone('#35291f', PQ), rustA = rgba(S.tone('#7a4a2e', PQ), 0.5), stainA = rgba(S.tone('#23272c', PQ), 0.3);
    K.sea(S, PQ, { y: wy, rows: 2, seed: 14 });
    dkMirror(S, PQ, -400, end, 0, 2.2, dkMirCol(S, PQ, '#585e64'), 0.55);
    PQ.add({ x0: -400, x1: end, layer: 0, draw(ctx, env) {
      const xa = Math.max(env.x0 - 2, -400), xb = Math.min(env.x1 + 2, end); if (xb <= xa) return;
      const s = env.s, px = env.px, th = Math.max(0.03, px * 0.8);
      R4(ctx, xa, wy - 0.6, xb - xa, 0.6 - wy, wall);
      if (s > 2.4) { // stone courses: the long joints, the upright ones staggered course to course, and here and there a block of another colour
        ctx.fillStyle = wall2; for (let i = 1; i < 4; i++) ctx.fillRect(xa, -0.3 - i * 0.44, xb - xa, th);
        if (s > 5) {
          const a = Math.floor(xa / 1.5) * 1.5 - 1.5;
          ctx.beginPath(); for (let i = 0; i < 3; i++) { const yy = -0.3 - (i + 1) * 0.44, off = (i % 2) * 0.75; for (let x = a + off; x < xb; x += 1.5) ctx.rect(x, yy, th, 0.44); } ctx.fill();
          if (s > 7) for (let pass = 0; pass < 2; pass++) { ctx.fillStyle = pass ? wallHi : wallLo; ctx.beginPath(); for (let i = 0; i < 3; i++) { const yy = -0.3 - (i + 1) * 0.44, off = (i % 2) * 0.75; for (let x = a + off; x < xb; x += 1.5) { const h = dkHash(x * 0.71 + i * 5.3); if (pass ? h < 0.1 : h > 0.9) ctx.rect(x + th, yy + th, 1.5 - th, 0.44 - th); } } ctx.fill(); }
        }
      }
      // the tide mark: wet stone, a ragged fringe of weed, barnacles above it
      R4(ctx, xa, wy - 0.6, xb - xa, 1.12, wetC); R4(ctx, xa, wy - 0.6, xb - xa, 0.82, weed);
      if (s > 6) {
        const a = Math.floor(xa / 0.4) * 0.4;
        ctx.fillStyle = weed; ctx.beginPath(); ctx.moveTo(a, wy + 0.2); for (let x = a; x < xb + 0.4; x += 0.4) ctx.lineTo(x + 0.2, wy + 0.22 + dkHash(x * 2.3) * 0.2); ctx.lineTo(xb + 0.6, wy + 0.2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = weed2; ctx.beginPath(); for (let x = a; x < xb; x += 0.4) { const h = dkHash(x * 5.1 + 3); if (h < 0.45) ctx.rect(x + 0.08, wy - 0.02 + h * 0.3, 0.2, 0.06); } ctx.fill();
        if (s > 22) { ctx.fillStyle = barn; ctx.beginPath(); for (let x = Math.floor(xa / 0.22) * 0.22; x < xb; x += 0.22) { const h = dkHash(x * 9.7 + 1); if (h < 0.5) ctx.rect(x, wy + 0.32 + h * 0.46, 0.05, 0.05); } ctx.fill(); }
      }
      if (s > 4) { // drains, each with the stain it has left
        for (let x = Math.floor(xa / 17) * 17; x < xb; x += 17) { const dx = x + 9.2; if (dx > end - 1) continue; R4(ctx, dx - 0.1, wy + 0.5, 0.2, -1.05 - wy - 0.5, stainA); circ(ctx, dx, -1.0, 0.13, dkc); if (rainy) R4(ctx, dx - 0.025, wy, 0.05, -1.05 - wy, foamQ); }
      }
      R4(ctx, xa, -0.3, xb - xa, 0.3, cope); R4(ctx, xa, -0.07, xb - xa, 0.07, copeHi);
      if (s > 5) { ctx.fillStyle = copeLo; for (let x = Math.floor(xa / 2.2) * 2.2; x < xb; x += 2.2) ctx.fillRect(x, -0.3, th, 0.3); }
      if (s > 2.6) { ctx.fillStyle = yel; const a = Math.floor(xa / 1.6) * 1.6; for (let x = a; x < xb; x += 1.6) ctx.fillRect(x, -0.3, 0.8, 0.09); }
      dkPool(ctx, env, S, 'quay', -0.3, 0.3, 0.3, 1, 0, xa, xb); dkPool(ctx, env, S, 'quay', -1.3, 1.0, 0.09, 1, 0, xa, xb);
      const a8 = Math.floor(xa / 8.5) * 8.5 - 8.5;
      if (s > 2) for (let x = a8; x < xb; x += 8.5) { // timber rubbing posts down the face
        const tx = x + 6.4; if (tx > end - 0.6 || tx < xa - 1) continue;
        R4(ctx, tx - 0.12, wy - 0.3, 0.24, -wy, timber); R4(ctx, tx - 0.12, wy - 0.3, 0.24, 0.8, weed);
        if (s > 9) { R4(ctx, tx - 0.12, wy + 0.5, 0.06, -wy - 0.8, timber2); ctx.fillStyle = dkHi; ctx.fillRect(tx - 0.03, -0.72, 0.06, 0.06); ctx.fillRect(tx - 0.03, -1.4, 0.06, 0.06); }
      }
      // tyre fenders on chains, with the scuff each has worn on the wall
      for (let x = a8; x < xb; x += 8.5) { const fx = x + 2.2; if (fx > end - 1 || fx < xa - 1) continue;
        if (s > 5) R4(ctx, fx - 0.5, -1.86, 1.0, 1.0, stainA);
        if (s > 8) { line(ctx, fx - 0.2, -0.3, fx - 0.2, -1.0, dkc, 0.035, env); line(ctx, fx + 0.2, -0.3, fx + 0.2, -1.0, dkc, 0.035, env); } else line(ctx, fx, -0.3, fx, -0.95, dkc, 0.05, env);
        ctx.strokeStyle = tyre; ctx.lineWidth = Math.max(0.22, px); ctx.beginPath(); ctx.arc(fx, -1.35, 0.4, 0, TAU); ctx.stroke();
        if (s > 9) { ctx.strokeStyle = tyreHi; ctx.lineWidth = Math.max(0.03, px * 0.6); ctx.beginPath(); ctx.arc(fx, -1.35, 0.48, 0.5, 2.5); ctx.moveTo(fx + 0.3, -1.35); ctx.arc(fx, -1.35, 0.3, 0, TAU); ctx.stroke(); }
      }
      if (s > 4) { // mooring rings, each weeping a little rust
        ctx.strokeStyle = dkc; ctx.lineWidth = Math.max(0.05, px * 0.7);
        for (let x = Math.floor(xa / 11) * 11; x < xb; x += 11) { const rx = x + 0.9; if (rx > end - 0.5) continue; R4(ctx, rx - 0.05, -1.55, 0.1, 0.7, rustA); R4(ctx, rx - 0.11, -0.7, 0.22, 0.09, dkc); ctx.beginPath(); ctx.arc(rx, -0.84, 0.15, 0, TAU); ctx.stroke(); }
      }
      { // a ladder near the end, its rails hooped over the top
        ctx.strokeStyle = dkc; ctx.lineWidth = Math.max(0.06, px * 0.7); ctx.beginPath(); const lx = end - 3.4; ctx.moveTo(lx, wy); ctx.lineTo(lx, 0.1); ctx.moveTo(lx + 0.5, wy); ctx.lineTo(lx + 0.5, 0.1); for (let yy = wy + 0.3; yy < 0; yy += 0.38) { ctx.moveTo(lx, yy); ctx.lineTo(lx + 0.5, yy); }
        if (s > 4) { ctx.moveTo(lx, 0.1); ctx.lineTo(lx, 0.7); ctx.quadraticCurveTo(lx, 0.95, lx - 0.3, 0.95); ctx.moveTo(lx + 0.5, 0.1); ctx.lineTo(lx + 0.5, 0.7); ctx.quadraticCurveTo(lx + 0.5, 0.95, lx + 0.2, 0.95); }
        ctx.stroke(); }
      // bollards, some with a hawser looped on, some with a coil of rope beside them, and a gull on one or two
      for (let x = Math.floor(xa / 11) * 11 - 11; x < xb; x += 11) { const bx = x + 6.3; if (bx > end - 0.6 || bx < xa - 2) continue; const h = dkHash(bx * 0.37 + seed);
        R4(ctx, bx - 0.34, 0, 0.68, 0.06, dkc); poly(ctx, [bx - 0.17, 0.05, bx + 0.17, 0.05, bx + 0.14, 0.36, bx - 0.14, 0.36], dkc); R4(ctx, bx - 0.28, 0.34, 0.56, 0.16, dkc);
        if (s > 9) { R4(ctx, bx - 0.13, 0.08, 0.05, 0.26, dkHi); R4(ctx, bx - 0.26, 0.45, 0.52, 0.035, dkHi); }
        if (s > 5) {
          if (h < 0.34) { R4(ctx, bx - 0.2, 0.12, 0.4, 0.06, rope); R4(ctx, bx - 0.2, 0.2, 0.4, 0.05, rope2); ctx.strokeStyle = rope; ctx.lineWidth = Math.max(0.05, px * 0.7); ctx.beginPath(); ctx.moveTo(bx + 0.2, 0.15); ctx.quadraticCurveTo(bx + 0.6, 0.2, bx + 0.85, 0); ctx.lineTo(bx + 0.9, -0.34); ctx.stroke(); }
          else if (h < 0.64) { for (let i = 0; i < 3; i++) { ctx.fillStyle = i % 2 ? rope2 : rope; ctx.beginPath(); ctx.ellipse(bx + 0.85, 0.06 + i * 0.055, 0.33 - i * 0.04, 0.05, 0, 0, TAU); ctx.fill(); } }
        }
        if (gulls && h > 0.8) dkGull(ctx, env, bx, 0.5, h > 0.9 ? 1 : -1, gullW, gullG, gullB, gullK, night);
      }
      dkFoam(ctx, env, xa, xb, wy, 5, foamQ);
    } });
    PQ.solid(-400, wy - 8, end + 400, 8 - wy, 'hard');
    if (pierLen > 0) {
      const wood = S.tone('#6f563c', PQ), wood2 = S.tone('#55412d', PQ), wood3 = S.tone('#8a6d4c', PQ), woodTop = S.tone('#7b6146', PQ), woodTopL = S.tone('#8d7254', PQ), woodTopD = S.tone('#65503a', PQ), pile = S.tone('#3b2f24', PQ), pileHi = S.tone('#56463a', PQ), pileFar = mix(S.tone('#3b2f24', PQ), S.tone(S.pal.water, PQ), 0.28), iron = S.tone('#20242b', PQ);
      const piles = []; for (let x = end + 2.4; x < pierEnd + 0.1; x += 4.6) piles.push(x);
      const pileMir = dkMirCol(S, PQ, '#3b2f24'), WID = 3.4;                 // WID: how far the pier runs back from its front edge
      for (let i = 0; i < piles.length; i++) dkMirror(S, PQ, piles[i] - 0.2, piles[i] + 0.2, 0, 1.84, pileMir, 0.6);
      dkMirror(S, PQ, end, pierEnd, 1.84, 2.2, dkMirCol(S, PQ, '#55412d'), 0.5);
      const ladX = end + 2.4 + 4.6 * 4 + 1.1;
      PQ.add({ x0: end - 1.5, x1: pierEnd + 1.5, layer: 0, draw(ctx, env) {
        const s = env.s, px = env.px, c = dk.cam, dq = Math.max(6, z - c.ez), kf = dq / (dq + WID), ex = c.ex, ey = c.ey;
        const xf = (x) => ex + (x - ex) * kf, yf = (y) => ey + (y - ey) * kf, dTop = Math.max(0, yf(0)), v0 = env.x0 - 1, v1 = env.x1 + 1;
        if (s > 2) { // the far row of piles and its bracing, seen through the near row
          const yw = yf(wy), yt = yf(-0.36);
          ctx.fillStyle = pileFar; for (let i = 0; i < piles.length; i++) { const xx = xf(piles[i]); if (xx > v0 && xx < v1) ctx.fillRect(xx - 0.19, yw - 0.1, 0.38, yt - yw + 0.1); }
          if (s > 4) { ctx.strokeStyle = pileFar; ctx.lineWidth = Math.max(0.08, px * 0.7); ctx.beginPath(); for (let i = 1; i + 1 < piles.length; i += 2) { const a = xf(piles[i]), b = xf(piles[i + 1]); ctx.moveTo(a, yt - 0.1); ctx.lineTo(b, yw + 0.5); ctx.moveTo(b, yt - 0.1); ctx.lineTo(a, yw + 0.5); } ctx.stroke(); }
        }
        for (let i = 0; i < piles.length; i++) { // the near row: a lit edge, an iron band, a tide mark with weed and barnacles, a cap under the deck
          const x = piles[i]; if (x < v0 || x > v1) continue;
          R4(ctx, x - 0.2, wy - 0.8, 0.4, 0.5 - wy, pile);
          if (s > 6) { R4(ctx, x - 0.2, wy, 0.1, -0.36 - wy, pileHi); R4(ctx, x - 0.2, wy + 0.6, 0.4, 0.34, wetC); }
          R4(ctx, x - 0.2, wy - 0.1, 0.4, 0.75, weed);
          if (s > 6) { R4(ctx, x - 0.22, -0.8, 0.44, 0.07, iron); R4(ctx, x - 0.36, -0.54, 0.72, 0.18, wood2);
            if (s > 22) { ctx.fillStyle = barn; for (let k = 0; k < 4; k++) ctx.fillRect(x - 0.17 + dkHash(k * 3.1 + x) * 0.3, wy + 0.62 + dkHash(k * 7.7 + x) * 0.3, 0.05, 0.05); ctx.fillStyle = weed2; ctx.fillRect(x - 0.14, wy + 0.3, 0.12, 0.3); ctx.fillRect(x + 0.06, wy + 0.2, 0.1, 0.3); } }
        }
        if (s > 1.6) { ctx.strokeStyle = pile; ctx.lineWidth = Math.max(0.09, px * 0.7); ctx.beginPath(); for (let x = end + 2.4; x < pierEnd - 4; x += 9.2) { ctx.moveTo(x, -0.4); ctx.lineTo(x + 4.6, wy + 0.5); ctx.moveTo(x + 4.6, -0.4); ctx.lineTo(x, wy + 0.5); } ctx.stroke();
          if (s > 6) { ctx.fillStyle = iron; for (let x = end + 2.4; x < pierEnd - 4; x += 9.2) ctx.fillRect(x + 2.22, (wy + 0.1) / 2 - 0.08, 0.16, 0.16); } }
        if (s > 5 && ladX < pierEnd - 2) { // a ladder down to the water, and a tyre on the pile beside it
          ctx.strokeStyle = iron; ctx.lineWidth = Math.max(0.05, px * 0.7); ctx.beginPath(); ctx.moveTo(ladX, wy + 0.1); ctx.lineTo(ladX, 0.05); ctx.moveTo(ladX + 0.45, wy + 0.1); ctx.lineTo(ladX + 0.45, 0.05); for (let yy = wy + 0.4; yy < -0.4; yy += 0.36) { ctx.moveTo(ladX, yy); ctx.lineTo(ladX + 0.45, yy); } ctx.stroke();
          ctx.strokeStyle = S.tone('#14161a', PQ); ctx.lineWidth = Math.max(0.2, px); ctx.beginPath(); ctx.arc(ladX - 1.1, -1.25, 0.36, 0, TAU); ctx.stroke(); line(ctx, ladX - 1.1, -0.36, ladX - 1.1, -0.88, iron, 0.04, env);
        }
        // the deck: its top seen from above, planks running across it, then the front beam with the plank ends showing
        if (dTop * s > 1) {
          poly(ctx, [end, 0, pierEnd, 0, xf(pierEnd), dTop, xf(end), dTop], woodTop);
          if (s > 4) {
            const step = s > 13 ? 0.3 : s > 7 ? 0.6 : 1.2, a = Math.max(end, Math.floor(v0 / step) * step), b = Math.min(pierEnd, v1 + 1);
            if (s > 13) for (let pass = 0; pass < 2; pass++) { ctx.fillStyle = pass ? woodTopL : woodTopD; ctx.beginPath(); for (let x = a; x < b; x += 0.3) { const h = dkHash(x * 3.3 + 1); if (pass ? h < 0.17 : h > 0.85) { ctx.moveTo(x, 0); ctx.lineTo(Math.min(pierEnd, x + 0.3), 0); ctx.lineTo(xf(Math.min(pierEnd, x + 0.3)), dTop); ctx.lineTo(xf(x), dTop); ctx.closePath(); } } ctx.fill(); }
            ctx.strokeStyle = woodTopD; ctx.lineWidth = Math.max(0.016, px * 0.55); ctx.beginPath(); for (let x = a; x < b; x += step) { ctx.moveTo(x, 0); ctx.lineTo(xf(x), dTop); } ctx.stroke();
          }
          line(ctx, xf(end), dTop, xf(pierEnd), dTop, wood2, 0.04, env);
        }
        R4(ctx, end, -0.36, pierLen, 0.36, wood); R4(ctx, end, -0.08, pierLen, 0.08, wood3); R4(ctx, end, -0.36, pierLen, 0.09, wood2);
        if (s > 3) { ctx.fillStyle = wood2; const a = Math.max(end + 0.4, Math.floor(v0 / 0.8) * 0.8 + 0.4), b = Math.min(pierEnd, v1); for (let x = a; x < b; x += 0.8) ctx.fillRect(x, -0.28, 0.04, 0.2);
          if (s > 9) { const a2 = Math.max(end, Math.floor(v0 / 0.3) * 0.3); for (let x = a2; x < b; x += 0.3) ctx.fillRect(x, -0.08, 0.025, 0.08); } }
        dkPool(ctx, env, S, 'quay', -0.36, 0.36 + dTop, 0.3, 1, 0, end, pierEnd);
        // bollards, cleats and coiled lines along the edge
        for (let x = end + 6.8; x < pierEnd - 1; x += 9.2) { if (x < v0 - 1 || x > v1 + 1) continue; R4(ctx, x - 0.14, 0, 0.28, 0.36, dkc); R4(ctx, x - 0.24, 0.3, 0.48, 0.14, dkc); if (s > 9) R4(ctx, x - 0.11, 0.04, 0.05, 0.25, dkHi);
          if (s > 5) { const h = dkHash(x * 0.53 + seed); if (h < 0.5) for (let i = 0; i < 3; i++) { ctx.fillStyle = i % 2 ? rope2 : rope; ctx.beginPath(); ctx.ellipse(x - 0.75, 0.06 + i * 0.055, 0.32 - i * 0.04, 0.05, 0, 0, TAU); ctx.fill(); }
            R4(ctx, x + 2.9, 0, 0.5, 0.05, dkc); R4(ctx, x + 2.75, 0.09, 0.8, 0.06, dkc); R4(ctx, x + 3.08, 0.04, 0.14, 0.06, dkc); } }
        // marker post on the pier head
        line(ctx, pierEnd - 0.4, 0, pierEnd - 0.4, 2.6, dkc, 0.1, env);
        if (s > 6) { R4(ctx, pierEnd - 0.56, 0, 0.32, 0.07, dkc); R4(ctx, pierEnd - 0.52, 2.55, 0.24, 0.08, dkc); }
        if (lit) dkGlow(ctx, pierEnd - 0.4, 2.75, 1.5, '90,255,140', 0.62 + 0.24 * Math.sin(env.t * 3));
        circ(ctx, pierEnd - 0.4, 2.75, 0.14, lit ? '#6dff9a' : S.tone('#2f7a4a', PQ));
        if (s > 3.2) { ctx.strokeStyle = foamQ; ctx.lineWidth = Math.max(px, 0.04); ctx.beginPath(); for (let i = 0; i < piles.length; i++) { const x = piles[i]; if (x < v0 || x > v1) continue; const b = 0.5 + 0.5 * Math.sin(env.t * 1.1 + x); ctx.moveTo(x + 0.3 + 0.1 * b, wy - 0.02); ctx.ellipse(x, wy - 0.02, 0.3 + 0.1 * b, 0.06, 0, 0, TAU); } ctx.stroke(); }
      } });
      PQ.solid(end, -0.36, pierLen, 0.36, 'wood');
      if (lit) dkLight(S, { P: PQ, x: pierEnd - 0.4, y: 2.75, rgb: '90,255,140', a: 0.5, w: 0.36, fn: (t) => 0.75 + 0.25 * Math.sin(t * 3) });
      if (o.shed !== false) { // net shed at the root of the pier
        const sx = o.shedX === undefined ? end + 1.2 : o.shedX, sc = S.tone('#7a6248', PQ), sc2 = S.tone('#4a3a2c', PQ), scHi = S.tone('#8c7356', PQ), scLo = S.tone('#6a543d', PQ), roofHi = S.tone('#655240', PQ), netC = rgba(S.tone('#4f6a5a', PQ), 0.55), netL = S.tone('#3d5346', PQ), floatC = S.tone('#c9853a', PQ), boxC = S.tone('#3f6a8a', PQ), boxD = S.tone('#2c4c66', PQ), oar = S.tone('#b9a27e', PQ);
        dkMirror(S, PQ, sx, sx + 4, 2.2, 4.9, dkMirCol(S, PQ, '#7a6248'), 0.3);
        PQ.add({ x0: sx - 0.6, x1: sx + 4.8, layer: 0, draw(ctx, env) {
          const s = env.s, px = env.px;
          R4(ctx, sx, 0, 4, 2.7, sc);
          if (s > 3) { ctx.fillStyle = sc2; for (let x = sx + 0.4; x < sx + 4; x += 0.45) ctx.fillRect(x, 0.05, 0.04, 2.6);
            if (s > 8) for (let i = 0; i < 9; i++) { const h = dkHash(i * 2.7 + sx); if (h < 0.3) R4(ctx, sx + i * 0.45 - 0.01, 0.05, 0.41, 2.6, h < 0.15 ? scHi : scLo); }
            R4(ctx, sx, 0, 4, 0.4, 'rgba(0,0,0,0.13)'); R4(ctx, sx, 2.48, 4, 0.22, 'rgba(0,0,0,0.2)'); }
          poly(ctx, [sx - 0.35, 2.7, sx + 4.35, 2.7, sx + 4.0, 3.25, sx + 0.2, 3.5], sc2);
          if (s > 4) { ctx.strokeStyle = roofHi; ctx.lineWidth = Math.max(0.05, px * 0.8); ctx.beginPath(); ctx.moveTo(sx + 0.2, 3.5); ctx.lineTo(sx + 4.0, 3.25); ctx.moveTo(sx + 1.3, 2.74); ctx.lineTo(sx + 1.45, 3.4); ctx.moveTo(sx + 2.75, 2.74); ctx.lineTo(sx + 2.85, 3.3); ctx.stroke(); }
          R4(ctx, sx + 2.5, 0, 1.0, 2.05, sc2);
          if (s > 6) { ctx.strokeStyle = scLo; ctx.lineWidth = Math.max(0.035, px * 0.6); ctx.beginPath(); ctx.moveTo(sx + 2.56, 1.8); ctx.lineTo(sx + 3.44, 1.8); ctx.lineTo(sx + 2.56, 0.25); ctx.lineTo(sx + 3.44, 0.25); ctx.moveTo(sx + 2.83, 0.05); ctx.lineTo(sx + 2.83, 2.0); ctx.moveTo(sx + 3.16, 0.05); ctx.lineTo(sx + 3.16, 2.0); ctx.stroke(); R4(ctx, sx + 2.6, 1.0, 0.1, 0.12, dkc); }
          if (s > 5) { // a net hung up to dry with its floats, an oar against the wall, fish boxes at the foot of it
            ctx.fillStyle = netC; ctx.beginPath(); ctx.moveTo(sx + 0.12, 2.5); ctx.lineTo(sx + 2.38, 2.5); ctx.quadraticCurveTo(sx + 2.2, 2.05, sx + 1.25, 2.1); ctx.quadraticCurveTo(sx + 0.4, 2.12, sx + 0.12, 1.75); ctx.closePath(); ctx.fill();
            if (s > 11) { ctx.strokeStyle = netL; ctx.lineWidth = Math.max(0.015, px * 0.4); ctx.beginPath(); for (let i = 0; i < 9; i++) { ctx.moveTo(sx + 0.2 + i * 0.26, 2.5); ctx.lineTo(sx + 0.05 + i * 0.26, 2.08); ctx.moveTo(sx + 0.2 + i * 0.26, 2.5); ctx.lineTo(sx + 0.38 + i * 0.26, 2.12); } ctx.stroke(); }
            ctx.fillStyle = floatC; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(sx + 0.3 + i * 0.5, 2.5, 0.07, 0, TAU); ctx.fill(); }
            line(ctx, sx + 3.72, 0, sx + 3.86, 2.3, oar, 0.05, env); poly(ctx, [sx + 3.8, 1.75, sx + 3.92, 1.75, sx + 3.95, 2.42, sx + 3.82, 2.42], oar);
            R4(ctx, sx + 0.15, 0, 0.85, 0.3, boxC); R4(ctx, sx + 0.22, 0.3, 0.85, 0.3, boxC); ctx.fillStyle = boxD; ctx.fillRect(sx + 0.15, 0.22, 0.85, 0.05); ctx.fillRect(sx + 0.22, 0.52, 0.85, 0.05);
          }
          // a life ring on the wall
          // (kept in the dull colour of old rope, so nothing on the pier competes with a red hat)
          ctx.strokeStyle = oar; ctx.lineWidth = Math.max(s > 6 ? 0.12 : 0.05, px * 0.6); ctx.beginPath(); ctx.arc(sx + 1.2, 1.5, 0.5, 0, TAU); if (s <= 6) { ctx.moveTo(sx + 0.75, 1.5); ctx.lineTo(sx + 1.65, 1.5); } ctx.stroke();
          if (s > 6) { ctx.strokeStyle = sc2; ctx.lineWidth = Math.max(0.03, px * 0.5); ctx.beginPath(); for (let k = 0; k < 4; k++) { const a0 = k * 1.5708 + 0.5; ctx.moveTo(sx + 1.2 + 0.56 * Math.cos(a0), 1.5 + 0.56 * Math.sin(a0)); ctx.lineTo(sx + 1.2 + 0.44 * Math.cos(a0), 1.5 + 0.44 * Math.sin(a0)); } ctx.stroke(); }
        } });
        PQ.solid(sx, 0, 4, 2.7, 'wood'); H.shed = { x0: sx, x1: sx + 4 };
      }
    }
    H.lamps = [];
    (o.lamps || [-34, -12, 10]).forEach((lx, i) => H.lamps.push(K.lamp(S, PQ, lx, 5.6, 'quay', { id: 'lamp' + (i + 1), reach: o.lampReach })));
    (o.pierLamps || (pierLen > 0 ? [end + 14] : [])).forEach((lx, i) => H.lamps.push(K.lamp(S, PQ, lx, 4.6, 'quay', { id: 'plamp' + (i + 1), reach: o.pierReach || o.lampReach })));
    (o.barrels || []).forEach((b, i) => { const bx = typeof b === 'number' ? b : b[0]; K.thing(S, PQ, 'barrel', bx, 0.62, { id: (typeof b === 'number' ? null : b[1]) || ('barrel' + (i + 1)) }); });
    if (o.crane !== false) {
      const c = o.crane || {};
      H.crane = K.dockCrane(S, PQ, c.x === undefined ? -3 : c.x, { reach: c.reach === undefined ? 9 : c.reach, tipY: c.tipY, col: c.col });
      if (c.load !== false) H.hook = K.hookLight(S, K.hang(S, PQ, c.hookX === undefined ? H.crane.tipX : c.hookX, c.hookY || 10.5, c.load || 'net', { id: c.id || 'hook', top: H.crane.tipY, floor: c.floor || 0, drop: c.drop, col: c.loadCol }));
    }
    if (o.sock !== false && pierLen > 0) K.dkWindsock(S, PQ, o.sockX === undefined ? pierEnd - 2.2 : o.sockX, 0, 5.2, { layer: 0 });
  }
  const zq = 'quay';
  H.quay = (x, extra) => Object.assign({ plane: PQ, x, y: 0, zone: zq, behind: false, room: null }, extra || {});
  H.pier = (x, extra) => Object.assign({ plane: PQ, x, y: 0, zone: zq, behind: false, room: null }, extra || {});

  // ---- the basin in front: boat lane, then open water toward the shooter ----
  const PL = S.plane(z - 5, 'lane');
  K.sea(S, PL, { y: wy, rows: 5, seed: 17, deep: 0.08 });
  H.PL = PL; H.laneY = wy - 0.25;                 // y for a launch so that it floats at its waterline
  if (o.bell !== undefined && o.bell !== false) H.bell = K.buoy(S, PL, typeof o.bell === 'number' ? o.bell : o.bell.x, wy, { bell: typeof o.bell === 'number' ? {} : o.bell });
  if (o.barge) {
    const B = K.supplyBarge(S, PL, o.barge.x, wy, o.barge); H.bargeAt = B;
    H.barge = (x, extra) => Object.assign({ plane: PL, x, y: B.y, zone: 'barge', behind: false, room: null }, extra || {});
  }
  if (o.yacht) {
    const Y = K.yacht(S, PL, o.yacht.x, wy, o.yacht); H.yacht = Y;
    H.deck = (x, extra) => Object.assign({ plane: PL, x, y: Y.deckY, zone: 'aft', behind: false, room: null }, extra || {});
    H.sun = (x, extra) => Object.assign({ plane: PL, x, y: Y.sunY, zone: 'sun', behind: false, room: null }, extra || {});
    H.fore = (x, extra) => Object.assign({ plane: PL, x, y: Y.foreY, zone: 'fore', behind: false, room: null }, extra || {});
    H.saloon = (x, extra) => Object.assign({ plane: PL, x, y: Y.deckY, zone: Y.room, room: Y.room, behind: true }, extra || {});
  }
  if (o.skiff) H.skiff = K.skiff(S, PL, o.skiff.x, wy, o.skiff);
  const PW = S.plane(z - 42, 'basin');
  K.sea(S, PW, { y: wy, rows: 5, seed: 23, deep: 0.16 });
  H.PW = PW;
  if (o.ketch) K.ketch(S, PW, o.ketch.x, wy, o.ketch);
  const dolX = o.dolphinX === undefined ? -27 : o.dolphinX;
  if (o.dolphin !== false) { // a mooring dolphin: three piles lashed together, a gull-white cap on the tall one, for depth
    const dx = dolX, pc = S.tone('#3b2f24', PW), pc2 = S.tone('#2f251c', PW), pcHi = S.tone('#57473a', PW), cap = S.tone('#d9d2c0', PW), weedW = S.tone('#3d4a3f', PW), ropeW = S.tone('#b9a27e', PW), ropeW2 = S.tone('#8a7650', PW), foam = rgba(S.tone('#e6edf2', PW), 0.55);
    const gW = S.tone('#f1f1ec', PW), gG = S.tone('#8f979e', PW), gB = S.tone('#d6a12a', PW), gK = S.tone('#20242b', PW);
    dkMirror(S, PW, dx - 0.62, dx + 0.64, 0, 2.2, dkMirCol(S, PW, '#3b2f24'), 0.55);
    PW.add({ x0: dx - 1.6, x1: dx + 1.6, layer: 1, draw(ctx, env) {
      const s = env.s;
      R4(ctx, dx - 0.62, wy - 0.3, 0.42, 1.8, pc2); R4(ctx, dx + 0.24, wy - 0.3, 0.4, 1.55, pc2);
      R4(ctx, dx - 0.3, wy - 0.3, 0.6, 2.3, pc); R4(ctx, dx - 0.36, wy + 2.0, 0.72, 0.2, cap);
      if (s > 4) { R4(ctx, dx - 0.3, wy + 0.4, 0.14, 1.6, pcHi); R4(ctx, dx - 0.66, wy - 0.3, 1.32, 0.7, weedW); R4(ctx, dx - 0.66, wy + 0.92, 1.34, 0.17, ropeW); R4(ctx, dx - 0.66, wy + 0.98, 1.34, 0.035, ropeW2); }
      if (gulls) dkGull(ctx, env, dx + 0.44, wy + 1.25, -1, gW, gG, gB, gK, night);
      dkFoam(ctx, env, dx - 0.8, dx + 0.8, wy, 13, foam);
    } });
  }
  { // a rowing dinghy lying to a mooring out in the basin: low on the water, rocking a little
    let gx = dolX + 9.5; const kt = o.ketch ? [o.ketch.x + (o.ketch.hull ? o.ketch.hull[0] : -9) - 3, o.ketch.x + (o.ketch.hull ? o.ketch.hull[1] : 3) + 4] : null;
    if (kt && gx + 4 > kt[0] && gx - 2 < kt[1]) gx = dolX - 8;
    const hc = S.tone('#c9c2ae', PW), hc2 = S.tone('#3f5f80', PW), hc3 = S.tone('#8d8674', PW), dkd = S.tone('#2a2620', PW), ropeW = S.tone('#b9a27e', PW), floatC = S.tone('#e4e0d4', PW), foam = rgba(S.tone('#e6edf2', PW), 0.55);
    dkMirror(S, PW, gx - 1.3, gx + 1.3, 0, 0.55, dkMirCol(S, PW, '#c9c2ae'), 0.4);
    PW.add({ x0: gx - 3, x1: gx + 5.5, layer: 1, draw(ctx, env) {
      const s = env.s, t = env.t; if (s < 2.5) return;
      if (s > 4) { ctx.strokeStyle = ropeW; ctx.lineWidth = Math.max(0.03, env.px * 0.5); ctx.beginPath(); ctx.moveTo(gx + 1.7, wy + 0.45); ctx.quadraticCurveTo(gx + 2.8, wy + 0.05, gx + 4.1, wy + 0.08); ctx.stroke(); ctx.fillStyle = floatC; ctx.beginPath(); ctx.ellipse(gx + 4.2, wy + 0.06 + Math.sin(t * 1.1) * 0.02, 0.2, 0.13, 0, 0, TAU); ctx.fill(); }
      ctx.save(); ctx.translate(gx, wy + Math.sin(t * 0.8 + gx) * 0.03); ctx.rotate(Math.sin(t * 1.0 + gx * 0.5) * 0.03);
      poly(ctx, [-1.6, 0.5, 1.75, 0.56, 1.25, -0.04, -1.3, -0.04], hc); R4(ctx, -1.56, 0.4, 3.3, 0.07, hc2); R4(ctx, -1.28, -0.04, 2.52, 0.1, hc3);
      if (s > 7) { ctx.strokeStyle = hc3; ctx.lineWidth = Math.max(0.02, env.px * 0.5); ctx.beginPath(); ctx.moveTo(-1.47, 0.22); ctx.lineTo(1.5, 0.25); ctx.stroke(); R4(ctx, -0.5, 0.5, 0.1, 0.1, dkd); R4(ctx, 0.3, 0.5, 0.1, 0.1, dkd); }
      ctx.restore();
      dkFoam(ctx, env, gx - 1.3, gx + 1.25, wy, gx * 1.3, foam);
    } });
  }
  // ---- nearest: a trawler's masthead in the corner, with a pennant that shows the wind ----
  const PN = S.plane(Math.round(z * 0.6), 'near');
  K.sea(S, PN, { y: wy, rows: 4, seed: 29, deep: 0.24 });
  H.PN = PN;
  if (o.mast !== false) {
    const mx = o.mastX === undefined ? -26.5 : o.mastX, my = o.mastY === undefined ? 6.3 : o.mastY, mc = S.tone('#2a2620', PN), mc2 = S.tone('#8a6d4c', PN), mc3 = S.tone('#a88a62', PN), steel = S.tone('#c9ced3', PN);
    const gW = S.tone('#f1f1ec', PN), gG = S.tone('#8f979e', PN), gB = S.tone('#d6a12a', PN), gK = S.tone('#20242b', PN);
    // she rolls a very little at her mooring: the mast leans, pivoting well below the water
    const lean = (t) => Math.sin(t * 0.7) * 0.011 + Math.sin(t * 1.13 + 1) * 0.005, piv = wy - 3;
    if (lit) dkLight(S, { P: PN, x: mx, y: my - 2.0, rgb: '255,240,200', a: 0.3, w: 0.3 });
    PN.add({ x0: mx - 9.5, x1: mx + 9.5, layer: 1, draw(ctx, env) {
      const a = lean(env.t), s = env.s;
      ctx.save(); ctx.transform(1, 0, a, 1, -a * piv, 0);
      line(ctx, mx, wy, mx, my, mc2, 0.2, env); if (s > 8) line(ctx, mx - 0.06, wy, mx - 0.06, my, mc3, 0.05, env);
      line(ctx, mx - 1.5, my - 2.2, mx + 1.5, my - 2.2, mc2, 0.12, env);
      ctx.strokeStyle = mc; ctx.lineWidth = Math.max(0.035, env.px * 0.6); ctx.beginPath(); ctx.moveTo(mx, my - 0.2); ctx.lineTo(mx - 8, wy + 1); ctx.moveTo(mx, my - 0.2); ctx.lineTo(mx + 7, wy + 1); ctx.moveTo(mx - 1.5, my - 2.2); ctx.lineTo(mx - 2.6, wy + 1); ctx.moveTo(mx + 1.5, my - 2.2); ctx.lineTo(mx + 2.6, wy + 1);
      if (s > 6) { ctx.moveTo(mx, my + 0.05); ctx.lineTo(mx, my + 1.3); }      // an aerial whip at the masthead
      ctx.stroke();
      if (s > 6) { ctx.fillStyle = mc; ctx.fillRect(mx - 0.13, my - 2.3, 0.26, 0.09); ctx.fillRect(mx - 0.13, my - 0.3, 0.26, 0.09); ctx.fillRect(mx - 0.13, wy + 2.4, 0.26, 0.09); ctx.fillRect(mx + 1.36, my - 2.5, 0.12, 0.24);
        poly(ctx, [mx + 0.55, my - 1.25, mx + 0.75, my - 1.0, mx + 0.55, my - 0.75, mx + 0.35, my - 1.0], steel); }
      if (lit) dkGlow(ctx, mx, my - 2.0, 0.75, '255,240,200', 0.7); circ(ctx, mx, my - 2.0, 0.08, lit ? '#fff3c4' : mc);
      if (gulls) dkGull(ctx, env, mx - 1.1, my - 2.14, 1, gW, gG, gB, gK, night);
      ctx.restore();
    } });
    K.pennant(S, PN, mx, my, 1.7, o.flagCol || '#c0392b', { sway: (t) => lean(t) * (my - piv) });
  }
  return H;
};
