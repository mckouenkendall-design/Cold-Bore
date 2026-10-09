// ---------------------------------------------------------------------------
// Downtown Port Calder at night: SCN.towers.
//
// From far to near: the far skyline, a row of big glass towers, the Meridian
// (a hotel with a rooftop bar), the Aurel tower (offices with floor-to-ceiling
// glass, a service core and a window-cleaning cradle), a building site with a
// tower crane, the pavement and the road, and on the near side an old brick
// apartment block with a fire escape and a locksmith's shop at street level.
//
// Everything new in here is prefixed "tw" so it cannot clash with other
// location files.
//
// How this file keeps hundreds of windows cheap to draw:
//   - what stands in each window is worked out once, when the scene is built,
//     and stored as plain lists of rectangles and shapes sorted by colour and
//     by how small they are (see twRec);
//   - only windows on screen are drawn, and only the sizes worth drawing at the
//     current zoom;
//   - soft glows are stamped from a small ready-made picture (twGlow) instead
//     of building a gradient for each one in every frame.
// ---------------------------------------------------------------------------

// ---- soft light ---------------------------------------------------------------
// One small picture of a soft round blob per colour, made the first time it is asked for.
const twSprites = {};
function twSprite(hex) {
  let c = twSprites[hex];
  if (!c) {
    c = twSprites[hex] = document.createElement('canvas'); c.width = c.height = 64;
    const q = c.getContext('2d'), g = q.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, rgba(hex, 1)); g.addColorStop(0.18, rgba(hex, 0.72)); g.addColorStop(0.42, rgba(hex, 0.32)); g.addColorStop(0.7, rgba(hex, 0.09)); g.addColorStop(1, rgba(hex, 0));
    q.fillStyle = g; q.fillRect(0, 0, 64, 64);
  }
  return c;
}
// A soft glow that adds light to whatever is behind it. rx and ry are its half-width and half-height.
function twGlowE(ctx, x, y, rx, ry, hex, a) {
  if (a < 0.012) return;
  const op = ctx.globalCompositeOperation, al = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al * (a > 1 ? 1 : a);
  ctx.drawImage(twSprite(hex), x - rx, y - ry, rx * 2, ry * 2);
  ctx.globalAlpha = al; ctx.globalCompositeOperation = op;
}
function twGlow(ctx, x, y, r, hex, a) { twGlowE(ctx, x, y, r, r, hex, a); }
// The same soft blob laid over the picture instead of added to it: mist, vapour, low cloud.
function twPuff(ctx, x, y, rx, ry, hex, a) {
  if (a < 0.012) return;
  const al = ctx.globalAlpha; ctx.globalAlpha = al * a;
  ctx.drawImage(twSprite(hex), x - rx, y - ry, rx * 2, ry * 2);
  ctx.globalAlpha = al;
}
// A small red aircraft warning light. It swells and fades rather than switching.
function twBeacon(ctx, env, x, y, ph, hex) {
  const a = Math.pow(Math.max(0, Math.sin(env.t * 2.2 + (ph || 0))), 6), c = hex || '#ff3b30';
  circ(ctx, x, y, Math.max(0.16, env.px * 1.2), rgba(c, 0.4 + 0.6 * a));
  twGlow(ctx, x, y, Math.max(1.8, env.px * 10), c, 0.1 + 0.5 * a);
}
// A wash of lamp light along a strip of wall or ground. It is taken from S.lightAt, so it is
// brightest under each working lamp and fades out exactly where the game says the light ends.
// `keep` is any object owned by the caller; the gradient is remade only when a lamp changes.
function twLampWash(ctx, S, zone, x0, x1, y0, y1, rgb, a, keep) {
  const lamps = S.zoneLamps[zone] || []; let sig = '';
  for (let i = 0; i < lamps.length; i++) sig += lamps[i].alive && lamps[i].on !== false ? '1' : '0';
  if (keep.ctx !== ctx || keep.sig !== sig) {
    keep.ctx = ctx; keep.sig = sig; keep.any = sig.indexOf('1') >= 0;
    const g = ctx.createLinearGradient(x0, 0, x1, 0), n = clamp(Math.round((x1 - x0) / 1.1), 8, 44);
    for (let i = 0; i <= n; i++) g.addColorStop(i / n, 'rgba(' + rgb + ',' + (a * S.lightAt(zone, x0 + ((x1 - x0) * i) / n).l).toFixed(3) + ')');
    keep.g = g;
  }
  if (!keep.any) return;
  ctx.fillStyle = keep.g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
}
// A gradient that is made once per canvas and then kept (gradients are slow to make on phones).
function twGrad(keep, ctx, name, make) {
  if (keep.gctx !== ctx) { keep.gctx = ctx; keep.gm = {}; }
  return keep.gm[name] || (keep.gm[name] = make());
}

// ---- recorded shapes --------------------------------------------------------------
// Colour slots for what stands in a window, in the order they are painted. Each window
// belongs to a palette that gives every slot a colour mixed from the room's own light.
const twS = { LO: 0, LO2: 1, HI: 2, MD: 3, DK: 4, DK2: 5, HI2: 6, SCR: 7, ACA: 8, ACB: 9, WAT: 10, BL: 11, BL2: 12, N: 13 };
// A recorder. Shapes are added with a colour slot and a tier (0 = always drawn, 1 = from
// a middling zoom, 2 = close, 3 = very close). done() packs them into flat number lists.
function twRec() {
  const it = [];
  return {
    R(s, t, x, y, w, h) { it.push([s, t, 0, x, y, w, h]); },
    P(s, t, pts) { it.push([s, t, 1, pts]); },
    C(s, t, x, y, r) { it.push([s, t, 2, x, y, r]); },
    E(s, t, x, y, rx, ry) { it.push([s, t, 3, x, y, rx, ry]); },
    done() {
      const r = [], rn = [], q = [], qn = [];
      for (let s = 0; s < twS.N; s++) {
        let ra = null, qa = null; const rc = [0, 0, 0, 0], qc = [0, 0, 0, 0];
        for (let t = 0; t < 4; t++) {
          for (let i = 0; i < it.length; i++) {
            const e = it[i]; if (e[0] !== s || e[1] !== t) continue;
            if (e[2] === 0) (ra = ra || []).push(e[3], e[4], e[5], e[6]);
            else {
              qa = qa || [];
              if (e[2] === 1) { qa.push(e[3].length / 2); for (let j = 0; j < e[3].length; j++) qa.push(e[3][j]); }
              else if (e[2] === 2) qa.push(-1, e[3], e[4], e[5]);
              else qa.push(-2, e[3], e[4], e[5], e[6]);
            }
          }
          rc[t] = ra ? ra.length : 0; qc[t] = qa ? qa.length : 0;
        }
        r.push(ra); rn.push(rc); q.push(qa); qn.push(qc);
      }
      return { r, rn, q, qn };
    },
  };
}
function twRects(ctx, a, n) { for (let i = 0; i < n; i += 4) ctx.fillRect(a[i], a[i + 1], a[i + 2], a[i + 3]); }
// Add recorded polygons, circles and ovals to the path being built.
function twTrace(ctx, q, n) {
  let i = 0;
  while (i < n) {
    const k = q[i];
    if (k > 0) { ctx.moveTo(q[i + 1], q[i + 2]); for (let j = 1; j < k; j++) ctx.lineTo(q[i + 1 + j * 2], q[i + 2 + j * 2]); ctx.closePath(); i += 1 + k * 2; }
    else if (k === -1) { ctx.moveTo(q[i + 1] + q[i + 3], q[i + 2]); ctx.arc(q[i + 1], q[i + 2], q[i + 3], 0, TAU); i += 4; }
    else { ctx.moveTo(q[i + 1] + q[i + 3], q[i + 2]); ctx.ellipse(q[i + 1], q[i + 2], q[i + 3], q[i + 4], 0, 0, TAU); i += 5; }
  }
}

// ---- what stands in one window bay of an office floor -------------------------------
// The person who uses a desk sits in the middle of the bay; 'deskL' puts the desk on
// their left. Everything here is drawn behind the people. `named` is true for bays a
// mission placed on purpose: those are kept plain so nothing competes with the people.
// Nothing in an office is green, red or yellow: those colours belong to the green desk
// lamp, the camera lights and the hazard tape that mission briefings point at.
function twOffice(G, op, bay, v, named) {
  const LO = twS.LO, LO2 = twS.LO2, HI = twS.HI, MD = twS.MD, DK = twS.DK, DK2 = twS.DK2, HI2 = twS.HI2, SCR = twS.SCR, ACA = twS.ACA, ACB = twS.ACB, WAT = twS.WAT, BL = twS.BL, BL2 = twS.BL2;
  const X0 = op.x, w = op.w, fy = op.y, h = op.h, cx = X0 + w / 2, k = bay.kind, sd = bay.flip ? -1 : 1, fx = [];
  const R = (s, t, x, y, ww, hh) => G.R(s, t, x, fy + y, ww, hh);
  // a rectangle placed by its distance from the middle of the bay towards side d
  const side = (d) => (s, t, u0, u1, y, hh) => G.R(s, t, d > 0 ? cx + u0 : cx - u1, fy + y, u1 - u0, hh);
  const pic = (px, py, pw, ph) => { R(LO2, 1, px, py, pw, ph); R(HI, 2, px + 0.05, py + 0.05, pw - 0.1, ph - 0.1); R(MD, 2, px + 0.11, py + 0.11, pw * 0.38, ph - 0.22); R(ACB, 3, px + pw * 0.56, py + 0.13, pw * 0.3, ph * 0.3); };
  const door = (dx) => { R(LO, 1, dx, 0, 0.92, 2.12); R(LO2, 2, dx - 0.05, 0, 0.05, 2.17); R(LO2, 2, dx + 0.92, 0, 0.05, 2.17); R(LO2, 2, dx - 0.05, 2.12, 1.02, 0.05); R(HI, 2, dx + 0.6, 1.25, 0.18, 0.6); R(DK, 3, dx + 0.1, 1.0, 0.1, 0.03); };
  const leaf = (s, t, lx, ly, ang, len) => { const c = Math.cos(ang), n = Math.sin(ang), wd = len * 0.24; G.P(s, t, [lx, ly, lx + c * len * 0.5 - n * wd, ly + n * len * 0.5 + c * wd, lx + c * len, ly + n * len, lx + c * len * 0.5 + n * wd, ly + n * len * 0.5 - c * wd]); };
  // the dropped ceiling with light panels let into it, and the skirting
  R(LO, 0, X0, h - 0.2, w, 0.2);
  R(HI, 0, X0 + w * 0.1, h - 0.27, w * 0.32, 0.09); R(HI, 0, X0 + w * 0.58, h - 0.27, w * 0.32, 0.09);
  R(LO2, 2, X0, h - 0.215, w, 0.025); R(LO2, 3, X0 + w * 0.46, h - 0.19, 0.24, 0.05);
  R(LO2, 2, X0, 0, w, 0.05);
  // a roller blind part of the way down (never as low as anybody's head)
  if (v.blind > 0) { R(BL, 1, X0, h - v.blind, w, v.blind); R(BL2, 2, X0, h - v.blind, w, 0.035); for (let yy = h - v.blind + 0.11; yy < h - 0.04; yy += 0.09) R(BL2, 3, X0, yy, w, 0.012); }

  if (k === 'deskL' || k === 'deskR') {
    const d = k === 'deskL' ? -1 : 1, m = side(d);
    m(LO, 1, 0.22, 1.66, 0, 1.3); m(LO2, 2, 0.22, 1.66, 1.28, 0.04);                                                   // a low screen behind the desk
    m(HI, 2, 0.5, 0.74, 0.95, 0.24); m(ACA, 3, 0.56, 0.68, 1.02, 0.1); m(HI, 2, 1.22, 1.5, 0.9, 0.3);                  // notes pinned to it
    m(LO2, 3, 1.26, 1.46, 1.09, 0.02); m(LO2, 3, 1.26, 1.42, 1.01, 0.02); m(ACB, 3, 0.8, 0.9, 1.0, 0.1);
    m(MD, 1, 1.02, 1.4, 0.06, 0.6); m(DK, 2, 1.02, 1.4, 0.25, 0.025); m(DK, 2, 1.02, 1.4, 0.45, 0.025); m(HI2, 3, 1.17, 1.25, 0.34, 0.02); m(HI2, 3, 1.17, 1.25, 0.54, 0.02);   // drawers
    m(DK, 1, 0.36, 1.5, 0.66, 0.07); m(DK, 1, 1.38, 1.46, 0, 0.66);                                                   // desk top and leg
    m(DK, 1, 1.005, 1.075, 0.73, 0.48); m(SCR, 1, 0.965, 1.005, 0.84, 0.34); m(DK, 2, 0.93, 1.15, 0.73, 0.03);         // monitor, seen edge on
    m(DK2, 3, 0.5, 0.82, 0.73, 0.025); m(HI2, 2, 1.2, 1.27, 0.73, 0.1); m(HI2, 2, 1.3, 1.48, 0.73, 0.05); m(HI2, 3, 1.31, 1.47, 0.79, 0.02);   // keyboard, mug, papers
    m(DK2, 2, 0.78, 0.96, 0.03, 0.42); m(SCR, 3, 0.85, 0.88, 0.36, 0.03);                                             // computer under the desk
    R(DK, 1, cx - 0.26, 0.4, 0.52, 0.07); m(DK, 1, -0.34, -0.26, 0.4, 0.66); R(DK, 1, cx - 0.03, 0, 0.06, 0.4);        // chair
    R(DK, 2, cx - 0.3, 0.02, 0.6, 0.045); G.C(DK2, 3, cx - 0.28, fy + 0.04, 0.045); G.C(DK2, 3, cx + 0.28, fy + 0.04, 0.045);
    m(DK, 2, -0.42, -0.3, 0.52, 0.42); m(DK, 2, -0.26, 0.12, 0.6, 0.035);
    G.P(MD, 2, [cx - d * 0.6, fy, cx - d * 0.82, fy, cx - d * 0.86, fy + 0.3, cx - d * 0.56, fy + 0.3]);               // bin
    if (v.wall === 3) { G.C(LO2, 2, cx - d * 0.95, fy + 2.05, 0.2); G.C(HI, 2, cx - d * 0.95, fy + 2.05, 0.16); R(DK, 3, cx - d * 0.95 - 0.01, 2.05, 0.02, 0.11); }   // wall clock
    fx.push([2, cx + d * 0.8, fy + 1.0, 0.75, '#aee0ff', 0.2]);
  } else if (k === 'plant') {
    const px = cx + sd * 1.0;
    G.P(DK, 1, [px - 0.22, fy + 0.5, px + 0.22, fy + 0.5, px + 0.15, fy, px - 0.15, fy]); R(DK2, 2, px - 0.25, 0.45, 0.5, 0.06);
    G.C(MD, 1, px - 0.18, fy + 0.85, 0.28); G.C(MD, 1, px + 0.2, fy + 0.98, 0.3); G.C(MD, 1, px, fy + 1.3, 0.27);
    R(DK, 2, px - 0.015, 0.5, 0.03, 0.55);
    leaf(DK, 2, px, fy + 0.8, 2.4, 0.5); leaf(DK, 2, px, fy + 0.85, 0.7, 0.5); leaf(DK, 2, px, fy + 1.05, 1.9, 0.46); leaf(DK, 2, px, fy + 1.1, 1.2, 0.5); leaf(LO2, 3, px - 0.1, fy + 1.2, 2.2, 0.34);
    if (!named) { if (v.wall < 2) door(cx - sd * 1.05 - 0.46); else if (v.wall < 5) pic(cx - sd * 0.75 - 0.4, 1.3, 0.8, 0.6); }
    else pic(cx - sd * 0.75 - 0.4, 1.35, 0.8, 0.55);
  } else if (k === 'shelf') {
    const sx = cx + sd * 0.95, Rb = makeRng(Math.floor(v.a * 1e6) + 3);
    R(MD, 1, sx - 0.5, 0, 1.0, 2.05); for (let i = 1; i < 5; i++) R(DK, 1, sx - 0.5, i * 0.41, 1.0, 0.05);
    R(DK, 2, sx - 0.5, 0, 0.04, 2.05); R(DK, 2, sx + 0.46, 0, 0.04, 2.05); R(DK, 2, sx - 0.5, 2.03, 1.0, 0.04);
    // books and box files, shelf by shelf
    for (let i = 0; i < 5; i++) {
      let bx = sx - 0.44; const by = i * 0.41 + (i ? 0.05 : 0.03);
      while (bx < sx + 0.36) { const bw = Rb.r(0.045, 0.1), bh = Rb.r(0.2, 0.33), u = Rb.f(); if (u < 0.14) { bx += bw + 0.06; continue; } R(u < 0.42 ? DK : u < 0.62 ? HI2 : u < 0.82 ? ACA : ACB, 2, bx, by, bw, bh); bx += bw + 0.012; }
    }
    R(DK, 2, sx - 0.3, 2.07, 0.34, 0.2); R(HI2, 3, sx - 0.22, 2.13, 0.16, 0.06);
    if (!named && v.wall < 3) door(cx - sd * 1.0 - 0.46);
  } else if (k === 'sofa') {
    R(DK, 1, cx - 0.95, 0, 1.9, 0.42); R(DK, 1, cx - 0.95, 0.42, 0.24, 0.42); R(DK, 1, cx + 0.71, 0.42, 0.24, 0.42);
    R(MD, 1, cx - 0.71, 0.42, 1.42, 0.4); R(DK, 2, cx - 0.012, 0.42, 0.024, 0.4); R(DK2, 2, cx - 0.71, 0.4, 1.42, 0.03);
    G.P(ACA, 2, [cx + sd * 0.45 - 0.17, fy + 0.62, cx + sd * 0.45, fy + 0.45, cx + sd * 0.45 + 0.17, fy + 0.62, cx + sd * 0.45, fy + 0.79]);
    R(LO2, 1, cx - 0.55, 1.35, 1.1, 0.7); R(HI, 2, cx - 0.49, 1.41, 0.98, 0.58); R(MD, 2, cx - 0.4, 1.5, 0.34, 0.4); R(ACB, 2, cx, 1.5, 0.38, 0.2); R(ACA, 2, cx + 0.04, 1.76, 0.3, 0.14);
    R(DK, 2, cx - sd * 1.35 - 0.2, 0.5, 0.4, 0.04); R(DK, 2, cx - sd * 1.35 - 0.02, 0, 0.04, 0.5); R(HI2, 3, cx - sd * 1.35 - 0.13, 0.54, 0.22, 0.025);
  } else if (k === 'table') {
    R(DK, 1, cx - 0.8, 1.3, 1.6, 0.92); R(DK2, 2, cx - 0.75, 1.35, 1.5, 0.82);                                          // wall screen showing a few figures
    for (let i = 0; i < 4; i++) R(SCR, 2, cx - 0.6 + i * 0.16, 1.45, 0.1, 0.16 + ((i * 5) % 4) * 0.1);
    R(HI2, 2, cx + 0.12, 1.92, 0.5, 0.035); R(HI2, 3, cx + 0.12, 1.8, 0.38, 0.03); R(HI2, 3, cx + 0.12, 1.68, 0.44, 0.03);
    for (let i = -1; i <= 1; i++) { R(MD, 1, cx + i * 0.62 - 0.2, 0.5, 0.4, 0.5); R(LO2, 3, cx + i * 0.62 - 0.14, 0.82, 0.28, 0.03); }     // chairs on the far side
    R(DK, 1, cx - 1.15, 0.68, 2.3, 0.08); R(DK, 1, cx - 0.06, 0, 0.12, 0.68); R(DK, 2, cx - 0.4, 0, 0.8, 0.05);
    R(MD, 1, cx - 1.5, 0.4, 0.07, 0.62); R(MD, 1, cx + 1.43, 0.4, 0.07, 0.62);                                         // a chair at each end
    R(MD, 2, cx - 1.5, 0.4, 0.42, 0.06); R(MD, 2, cx + 1.08, 0.4, 0.42, 0.06); R(MD, 2, cx - 1.16, 0, 0.05, 0.4); R(MD, 2, cx + 1.11, 0, 0.05, 0.4);
    G.P(DK2, 2, [cx - 0.14, fy + 0.76, cx + 0.14, fy + 0.76, cx + 0.06, fy + 0.84, cx - 0.06, fy + 0.84]);
    R(HI2, 3, cx - 0.62, 0.76, 0.05, 0.09); R(HI2, 3, cx + 0.44, 0.76, 0.05, 0.09); R(HI2, 3, cx - 0.98, 0.76, 0.26, 0.018); R(DK2, 3, cx + 0.62, 0.76, 0.3, 0.02);
  } else if (k === 'cooler') {
    const px = cx + sd * 1.0, tx = cx - sd * 0.6, mx = tx - sd * 0.32;
    R(MD, 1, px - 0.2, 0, 0.4, 1.02); R(WAT, 1, px - 0.15, 1.02, 0.3, 0.44); R(DK, 1, tx - 0.5, 0.86, 1.0, 0.07); R(DK, 1, tx - 0.04, 0, 0.08, 0.86);
    G.E(WAT, 2, px, fy + 1.46, 0.15, 0.05); R(WAT, 2, px - 0.06, 0.97, 0.12, 0.06);
    R(DK, 2, px - 0.2, 0.62, 0.4, 0.03); R(DK2, 2, px - 0.12, 0.72, 0.06, 0.07); R(DK2, 2, px + 0.06, 0.72, 0.06, 0.07); R(DK, 2, px - 0.16, 0.55, 0.32, 0.05);
    R(HI2, 2, px - sd * 0.29 - 0.035, 0.45, 0.07, 0.42);                                                              // paper cups
    R(DK2, 2, mx - 0.17, 0.93, 0.34, 0.42); R(SCR, 3, mx - 0.1, 1.22, 0.08, 0.05); R(HI2, 2, tx + sd * 0.08 - 0.04, 0.93, 0.08, 0.1); R(HI2, 2, tx + sd * 0.22 - 0.04, 0.93, 0.08, 0.1);
    R(LO, 1, tx - 0.6, 1.76, 1.2, 0.6); R(LO2, 2, tx - 0.01, 1.76, 0.02, 0.6); R(LO2, 2, tx - 0.6, 1.76, 1.2, 0.03);     // cupboard above the counter
  } else if (k === 'board') {
    R(LO2, 1, cx - 1.0, 0.95, 2.0, 1.15); R(HI, 1, cx - 0.95, 1.0, 1.9, 1.05);
    for (let i = 0; i < 3; i++) R(MD, 1, cx - 0.75, 1.25 + i * 0.27, 1.1 + (i % 2) * 0.35, 0.05);
    R(MD, 2, cx - 0.6, 0.93, 1.2, 0.04); R(DK, 3, cx - 0.5, 0.97, 0.14, 0.025); R(ACB, 3, cx - 0.3, 0.97, 0.14, 0.025);
    R(ACA, 2, cx + 0.56, 1.7, 0.14, 0.14); R(ACB, 2, cx + 0.73, 1.64, 0.14, 0.14); R(ACA, 2, cx + 0.62, 1.46, 0.14, 0.14);
    for (let i = 0; i < 3; i++) R(MD, 2, cx + 0.5 + i * 0.1, 1.08, 0.06, 0.1 + i * 0.07);
  } else if (!named) {
    // an empty bay: whatever the floor happens to keep there
    const e = v.extra;
    if (e === 0) {          // the cleaner's trolley
      const tx = cx + sd * 0.5, bx = tx + sd * 0.2;
      R(DK, 1, tx - 0.5, 0.14, 1.0, 0.07); R(DK, 1, tx - sd * 0.5 - 0.03, 0.14, 0.06, 0.95); R(DK, 2, tx - sd * 0.5 - 0.12, 1.05, 0.24, 0.04);
      G.C(DK2, 2, tx - 0.36, fy + 0.07, 0.07); G.C(DK2, 2, tx + 0.36, fy + 0.07, 0.07);
      G.P(MD, 1, [bx - 0.17, fy + 0.21, bx + 0.17, fy + 0.21, bx + 0.22, fy + 0.55, bx - 0.22, fy + 0.55]); R(DK, 2, bx + sd * 0.1 - 0.015, 0.4, 0.03, 1.25);
      R(MD, 1, tx - sd * 0.26 - 0.18, 0.21, 0.36, 0.7); R(HI2, 2, tx - sd * 0.26 - 0.18, 0.86, 0.36, 0.05); R(ACB, 3, tx - 0.05, 0.21, 0.07, 0.2); R(HI2, 3, tx + 0.05, 0.21, 0.06, 0.16);
      pic(cx - sd * 0.9 - 0.35, 1.4, 0.7, 0.5);
    } else if (e === 1) {   // the copier
      const px = cx + sd * 0.5;
      R(MD, 1, px - 0.42, 0, 0.84, 0.95); R(DK, 1, px - 0.42, 0.95, 0.84, 0.12); R(DK, 2, px - 0.42, 0.3, 0.84, 0.03); R(DK, 2, px - 0.42, 0.6, 0.84, 0.03);
      R(HI2, 2, sd > 0 ? px + 0.42 : px - 0.7, 0.72, 0.28, 0.03); R(SCR, 2, px - 0.1, 0.99, 0.2, 0.05); R(HI2, 3, px - 0.3, 1.07, 0.3, 0.03);
      door(cx - sd * 1.05 - 0.46);
    } else if (e === 2) {   // filing cabinets
      for (let i = 0; i < 3; i++) { const fx0 = cx - 0.84 + i * 0.56; R(MD, 1, fx0, 0, 0.52, 1.32); for (let j = 1; j < 4; j++) R(DK, 2, fx0, j * 0.33, 0.52, 0.025); for (let j = 0; j < 4; j++) R(HI2, 3, fx0 + 0.2, j * 0.33 + 0.2, 0.12, 0.025); }
      R(DK, 2, cx - 0.7, 1.32, 0.36, 0.2); R(DK, 2, cx + 0.3, 1.32, 0.3, 0.26); R(HI2, 3, cx + 0.34, 1.42, 0.14, 0.05);
      pic(cx - 0.4, 1.85, 0.8, 0.5);
    } else if (e === 3) {   // a coat stand by the door
      const px = cx + sd * 1.1;
      R(DK, 2, px - 0.02, 0, 0.04, 1.75); R(DK, 2, px - 0.22, 0, 0.44, 0.04);
      G.P(MD, 1, [px - 0.05, fy + 1.62, px + 0.3, fy + 1.5, px + 0.36, fy + 0.7, px + 0.02, fy + 0.72]); G.P(DK, 1, [px + 0.02, fy + 1.6, px - 0.3, fy + 1.5, px - 0.32, fy + 0.85, px - 0.04, fy + 0.9]);
      door(cx - sd * 0.6 - 0.46);
    } else if (e === 4) door(cx - 0.46);
    else pic(cx - 0.5, 1.3, 1.0, 0.65);
  } else if (v.wall < 4) door(cx + sd * 1.1 - 0.46);
  return { fx };
}

// ---- a ground-floor lobby bay ---------------------------------------------------------
// `mod` says what this stretch of the lobby holds: 'desk' (reception), 'seat', 'lift',
// 'gate' (turnstiles), and for a hotel 'front' (front desk), 'bags', 'sofa', 'palm'.
function twLobby(G, op, mod, v) {
  const LO = twS.LO, LO2 = twS.LO2, HI = twS.HI, MD = twS.MD, DK = twS.DK, DK2 = twS.DK2, HI2 = twS.HI2, SCR = twS.SCR, ACA = twS.ACA, ACB = twS.ACB;
  const X0 = op.x, w = op.w, fy = op.y, h = op.h, cx = X0 + w / 2, fx = [];
  const R = (s, t, x, y, ww, hh) => G.R(s, t, x, fy + y, ww, hh);
  R(LO, 0, X0, h - 0.16, w, 0.16); R(HI, 0, X0 + w * 0.18, h - 0.22, w * 0.64, 0.07);                                   // ceiling with a cove of light
  R(LO2, 2, X0, 0, w, 0.06);
  for (let i = 1; i < 4; i++) R(LO, 2, X0 + (i * w) / 4 - 0.015, 0.06, 0.03, h - 0.22);                                 // wall panelling
  const pend = (px, drop) => { R(DK, 2, px - 0.012, h - 0.16 - drop, 0.024, drop); G.C(HI, 1, px, fy + h - 0.16 - drop - 0.12, 0.14); fx.push([2, px, fy + h - 0.3 - drop, 0.8, '#ffe2b4', 0.2]); };
  const urn = (px, big) => {   // a tall plant in a pot
    G.P(DK, 1, [px - 0.24, fy + 0.55, px + 0.24, fy + 0.55, px + 0.16, fy, px - 0.16, fy]);
    G.C(MD, 1, px - 0.2, fy + 1.0, 0.3 * big); G.C(MD, 1, px + 0.22, fy + 1.15, 0.32 * big); G.C(MD, 1, px, fy + 1.5 * big, 0.3 * big); R(DK, 2, px - 0.015, 0.55, 0.03, 0.6);
  };
  const chair = (xc, d) => {   // a lounge chair seen from the side, facing d
    R(DK, 1, xc - 0.36, 0.14, 0.72, 0.28); G.P(DK, 1, [xc - d * 0.36, fy + 0.14, xc - d * 0.2, fy + 0.14, xc - d * 0.32, fy + 0.92, xc - d * 0.48, fy + 0.92]);
    R(DK2, 2, xc - 0.3, 0, 0.05, 0.14); R(DK2, 2, xc + 0.25, 0, 0.05, 0.14); R(MD, 2, xc - 0.3, 0.42, 0.6, 0.06);
  };
  const lifts = () => {
    for (const i of [-0.8, 0.8]) {
      R(LO, 1, cx + i - 0.56, 0, 1.12, 2.22); R(LO2, 1, cx + i - 0.48, 0, 0.96, 2.12); R(LO, 2, cx + i - 0.012, 0, 0.024, 2.12);
      R(HI, 2, cx + i - 0.2, 2.3, 0.4, 0.1); R(SCR, 2, cx + i - 0.04, 2.31, 0.08, 0.08);
    }
    R(HI2, 3, cx - 0.03, 1.1, 0.06, 0.12);
  };
  const desk = () => {
    R(DK, 1, X0 + 0.3, 0, w - 0.6, 1.02); R(MD, 1, X0 + 0.3, 0.96, w - 0.6, 0.07);
    R(DK2, 2, X0 + 0.3, 0, w - 0.6, 0.06); for (let xx = X0 + 0.5; xx < X0 + w - 0.4; xx += 0.28) R(DK2, 2, xx, 0.06, 0.03, 0.86);
  };
  if (mod === 'desk') {
    R(LO2, 1, cx - 0.9, 1.75, 1.8, 0.55); for (let i = 0; i < 5; i++) R(HI, 2, cx - 0.7 + i * 0.3, 1.9, 0.2, 0.25);     // a plaque on the wall behind
    desk();
    R(DK, 2, cx - 1.0, 1.03, 0.05, 0.36); R(SCR, 2, cx - 0.95, 1.08, 0.03, 0.26);
    R(HI2, 2, cx + 1.1, 1.03, 0.1, 0.2); G.C(MD, 2, cx + 1.15, fy + 1.42, 0.2); G.C(ACA, 2, cx + 1.05, fy + 1.47, 0.08); G.C(ACA, 2, cx + 1.26, fy + 1.52, 0.07);
    pend(cx - 0.9, 0.55); pend(cx + 0.9, 0.55);
  } else if (mod === 'seat') {
    R(LO2, 1, cx - 1.0, 1.25, 1.7, 1.0); R(MD, 2, cx - 0.92, 1.33, 0.5, 0.84); R(ACA, 2, cx - 0.36, 1.33, 0.4, 0.84); R(HI, 2, cx + 0.1, 1.33, 0.52, 0.84);   // a big canvas
    chair(cx - 0.75, 1); chair(cx + 0.45, -1); R(DK, 2, cx - 0.4, 0.36, 0.5, 0.05); R(DK, 2, cx - 0.17, 0, 0.04, 0.36);
    urn(cx + 1.3, 1.1); pend(cx - 0.15, 0.4);
  } else if (mod === 'lift') { lifts(); }
  else if (mod === 'gate') {
    for (let i = -1; i <= 1; i++) { R(DK, 1, cx + i * 0.95 - 0.12, 0, 0.24, 0.98); R(MD, 2, cx + i * 0.95 - 0.14, 0.94, 0.28, 0.05); R(SCR, 2, cx + i * 0.95 - 0.05, 0.99, 0.1, 0.03); if (i < 1) R(HI, 2, cx + i * 0.95 + 0.12, 0.25, 0.3, 0.6); }
    pend(cx, 0.5);
  } else if (mod === 'front') {
    R(LO2, 1, cx - 1.0, 1.35, 2.0, 1.05); for (let i = 1; i < 6; i++) R(LO, 2, cx - 1.0 + i * 0.333 - 0.012, 1.35, 0.024, 1.05); for (let j = 1; j < 3; j++) R(LO, 2, cx - 1.0, 1.35 + j * 0.35, 2.0, 0.024);   // pigeonholes for the keys
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) if ((i * 7 + j * 5 + op.c) % 3) R(ACA, 3, cx - 0.9 + i * 0.333, 1.44 + j * 0.35, 0.05, 0.14);
    desk();
    R(DK, 2, cx + 0.7, 1.03, 0.03, 0.22); G.P(HI, 1, [cx + 0.55, fy + 1.25, cx + 0.88, fy + 1.25, cx + 0.8, fy + 1.45, cx + 0.63, fy + 1.45]); G.C(HI2, 3, cx - 0.5, fy + 1.07, 0.06);
    fx.push([2, cx + 0.72, fy + 1.3, 0.7, '#ffe2b4', 0.22]);
  } else if (mod === 'bags') {
    R(ACA, 2, cx - 0.62, 0.2, 1.24, 0.06); R(ACA, 2, cx - 0.62, 0.2, 0.045, 1.5); R(ACA, 2, cx + 0.575, 0.2, 0.045, 1.5); R(ACA, 2, cx - 0.62, 1.68, 1.24, 0.045);   // luggage cart
    G.C(DK2, 2, cx - 0.48, fy + 0.1, 0.1); G.C(DK2, 2, cx + 0.48, fy + 0.1, 0.1);
    R(DK, 1, cx - 0.5, 0.26, 0.5, 0.36); R(MD, 1, cx + 0.04, 0.26, 0.44, 0.5); R(ACB, 1, cx - 0.42, 0.62, 0.4, 0.28); R(HI2, 3, cx - 0.3, 0.42, 0.1, 0.04); R(HI2, 3, cx + 0.2, 0.5, 0.1, 0.04);
    pend(cx - 1.1, 0.45); pend(cx + 1.1, 0.45);
  } else if (mod === 'sofa') {
    R(LO2, 1, cx - 0.7, 1.4, 1.4, 0.8); R(HI, 2, cx - 0.63, 1.47, 1.26, 0.66); R(MD, 2, cx - 0.5, 1.55, 0.5, 0.5); R(ACA, 2, cx + 0.1, 1.6, 0.4, 0.3);
    R(DK, 1, cx - 1.0, 0, 2.0, 0.44); R(DK, 1, cx - 1.0, 0.44, 0.26, 0.4); R(DK, 1, cx + 0.74, 0.44, 0.26, 0.4); R(MD, 1, cx - 0.74, 0.44, 1.48, 0.42);
    for (let i = -1; i <= 1; i++) G.C(DK, 3, cx + i * 0.45, fy + 0.66, 0.03);
    pend(cx, 0.4);
  } else if (mod === 'palm') {
    urn(cx - 0.9, 1.25); chair(cx + 0.5, -1); R(DK, 2, cx - 0.2, 0.4, 0.4, 0.05); R(DK, 2, cx - 0.02, 0, 0.04, 0.4); pend(cx + 0.3, 0.45);
  } else { desk(); }
  return { fx };
}

// ---- a hotel room -----------------------------------------------------------------------
function twHotel(G, op, bay, v) {
  const LO2 = twS.LO2, HI = twS.HI, MD = twS.MD, DK = twS.DK, DK2 = twS.DK2, HI2 = twS.HI2, SCR = twS.SCR, ACA = twS.ACA, ACB = twS.ACB, WAT = twS.WAT;
  const X0 = op.x, w = op.w, fy = op.y, h = op.h, cx = X0 + w / 2, sd = bay.flip ? -1 : 1, fx = [], k = v.room;
  const R = (s, t, x, y, ww, hh) => G.R(s, t, x, fy + y, ww, hh);
  const m = (s, t, u0, u1, y, hh) => G.R(s, t, sd > 0 ? cx + u0 : cx - u1, fy + y, u1 - u0, hh);
  const pic = (px, py, pw, ph) => { R(LO2, 1, px, py, pw, ph); R(HI, 2, px + 0.05, py + 0.05, pw - 0.1, ph - 0.1); R(MD, 2, px + 0.11, py + 0.11, pw * 0.38, ph - 0.22); R(ACB, 3, px + pw * 0.56, py + 0.13, pw * 0.3, ph * 0.3); };
  // curtains drawn back to both sides under a pelmet
  R(ACA, 1, X0, 0, 0.26, h); R(ACA, 1, X0 + w - 0.26, 0, 0.26, h); R(ACA, 1, X0, h - 0.17, w, 0.17);
  for (const u of [0.07, 0.16]) { R(ACB, 2, X0 + u, 0, 0.03, h - 0.17); R(ACB, 2, X0 + w - u - 0.03, 0, 0.03, h - 0.17); }
  R(ACB, 2, X0, h - 0.19, w, 0.03); R(LO2, 2, X0 + 0.26, 0, w - 0.52, 0.05);
  if (k === 0) {            // a floor lamp and an armchair
    const lx = cx + sd * 0.9;
    R(DK, 1, lx - 0.03, 0, 0.06, 1.45); G.P(HI, 1, [lx - 0.25, fy + 1.45, lx + 0.25, fy + 1.45, lx + 0.14, fy + 1.78, lx - 0.14, fy + 1.78]); R(DK, 2, lx - 0.17, 0, 0.34, 0.04);
    m(DK, 1, -0.92, -0.08, 0, 0.44); m(DK, 1, -1.02, -0.82, 0.44, 0.5); m(MD, 2, -0.8, -0.14, 0.44, 0.09);
    m(DK, 2, 0.1, 0.5, 0.5, 0.04); m(DK, 2, 0.28, 0.32, 0, 0.5); m(HI2, 3, 0.16, 0.36, 0.54, 0.03);
    pic(cx - sd * 0.5 - 0.4, 1.5, 0.8, 0.55);
    fx.push([1, lx, fy + 1.55, 1.1, '#ffd9a0', 0.28]);
  } else if (k === 1) {     // a bed, seen from the side
    pic(cx - sd * 0.1 - 0.4, 1.45, 0.8, 0.5);
    m(DK, 1, 1.22, 1.32, 0, 1.2); m(MD, 1, -0.8, 1.22, 0.06, 0.26); m(WAT, 1, -0.8, 1.22, 0.32, 0.2); m(ACB, 2, -0.62, -0.25, 0.3, 0.24);
    G.E(WAT, 1, cx + sd * 0.95, fy + 0.6, 0.24, 0.11); G.E(WAT, 2, cx + sd * 0.7, fy + 0.58, 0.2, 0.09);
    m(DK2, 2, -0.76, -0.7, 0, 0.06); m(DK2, 2, 1.12, 1.18, 0, 0.06);
    G.P(HI, 1, [cx + sd * 1.0 - 0.14, fy + 1.32, cx + sd * 1.0 + 0.14, fy + 1.32, cx + sd * 1.0 + 0.08, fy + 1.5, cx + sd * 1.0 - 0.08, fy + 1.5]);   // reading light
    m(MD, 1, -1.28, -0.96, 0, 0.56); m(DK, 2, -1.2, -1.04, 0.56, 0.1); m(DK2, 3, -1.28, -0.96, 0.26, 0.02);                                              // a suitcase
    fx.push([1, cx + sd * 1.0, fy + 1.25, 0.9, '#ffd9a0', 0.28]);
  } else if (k === 2) {     // a desk, a chair and a television
    m(DK, 1, 1.24, 1.3, 0.95, 0.62); m(SCR, 1, 1.2, 1.24, 1.0, 0.52);
    m(DK, 1, 0.55, 1.3, 0.66, 0.06); m(DK, 1, 0.58, 0.64, 0, 0.66); m(HI2, 2, 0.75, 0.87, 0.72, 0.14); m(HI2, 3, 0.92, 1.0, 0.72, 0.07);
    m(DK, 1, -0.05, 0.4, 0.42, 0.06); m(DK, 1, -0.1, -0.03, 0.42, 0.55); m(DK, 2, 0.1, 0.16, 0, 0.42);
    m(DK, 1, -1.25, -0.5, 0, 0.42); m(DK, 1, -1.32, -1.14, 0.42, 0.48); m(MD, 2, -1.14, -0.56, 0.42, 0.08);
    pic(cx - sd * 0.55 - 0.35, 1.5, 0.7, 0.5);
    fx.push([1, cx + sd * 0.9, fy + 1.25, 1.2, '#9fd0ff', 0.26, 1]);
  } else {                  // a sofa and a table lamp
    pic(cx - 0.55, 1.4, 1.1, 0.6);
    R(DK, 1, cx - 0.8, 0, 1.6, 0.4); R(DK, 1, cx - 0.8, 0.4, 0.2, 0.36); R(DK, 1, cx + 0.6, 0.4, 0.2, 0.36); R(MD, 1, cx - 0.6, 0.4, 1.2, 0.34); R(DK, 2, cx - 0.012, 0.4, 0.024, 0.34);
    m(DK, 2, 0.95, 1.25, 0.55, 0.04); m(DK, 2, 1.08, 1.12, 0, 0.55); m(DK, 2, 1.085, 1.115, 0.59, 0.2);
    G.P(HI, 1, [cx + sd * 1.1 - 0.2, fy + 0.79, cx + sd * 1.1 + 0.2, fy + 0.79, cx + sd * 1.1 + 0.12, fy + 1.03, cx + sd * 1.1 - 0.12, fy + 1.03]);
    fx.push([1, cx + sd * 1.1, fy + 0.95, 0.9, '#ffd9a0', 0.28]);
  }
  return { fx, tv: k === 2 };
}
const twCurtains = ['#8a4a52', '#5d6f8f', '#8c7a55', '#6a5a78'];

// ---- a glass tower ------------------------------------------------------------
// Built on K.building (style 'glass') so every window is a real opening, but
// each floor is one long room unless told otherwise:
//   lit: { 6: true, 7: false, 3: [[0, 2, true], [3, 6, false]], 5: 'each' }
// 'each' leaves every window its own room (hotel floors). `bays` names what
// stands in a bay ('deskL', 'cooler', ...), keyed 'floor,column'. `lobby` lists
// what each ground-floor bay holds (see twLobby).
K.twTower = function (S, P, o) {
  const fh = o.fh || 3.6, floors = o.floors || 10, w = o.w, x = o.x, id = o.id || 'T', base = o.base || 0;
  const cols = o.cols || Math.max(2, Math.round(w / 3.7)), colW = w / cols;
  const litSpec = o.lit || {}, spans = {};
  for (let f = 0; f < floors; f++) {
    const L = litSpec[f] === undefined ? o.litAll : litSpec[f];
    if (L === 'each') continue;
    if (Array.isArray(L)) spans[f] = L.map((p, i) => [p[0], p[1], p[3] || ('f' + f + 'abcd'.charAt(i)), !!p[2]]);
    else spans[f] = [[0, cols - 1, 'f' + f, !!L]];
  }
  const para = o.parapet === undefined ? 0.3 : o.parapet, mul = o.mullion || 0.32;
  const B = K.building(S, P, { x, w, floors, fh, id, base, style: 'glass', cols, winW: colW - mul, winH: fh - 0.62, sill: 0.12, wall: o.wall || '#1c2836',
    frame: o.frame || '#40526a', spans, wins: o.wins, parapet: para, seed: o.seed || 5, ac: false, roofAccess: o.roofAccess });
  const R = makeRng((o.seed || 5) * 131 + 7), bays = {};
  const kinds = o.kinds || ['deskL', 'deskR', 'deskL', 'deskR', 'plant', 'shelf', 'table', 'sofa', 'board', 'none'];
  const warm = ['#ffd9a0', '#ffe2b4', '#ffcf8a', '#ffe9c8'];
  for (const key in B.wins) {
    const op = B.wins[key], each = !spans[op.f];
    op.deco = -1;
    op.tint = (o.tint && o.tint[op.f]) || (each ? R.pick(warm) : (o.tintAll || '#d6e6ff'));
    if (!(o.wins && o.wins[key] && o.wins[key].blind !== undefined)) op.blind = each && R.chance(0.3) ? R.r(0.2, 0.6) : 0;
    bays[key] = { kind: (o.bays && o.bays[key]) || (op.f === 0 ? 'lobby' : each ? 'room' : R.pick(kinds)), flip: R.chance(0.5), screen: R.chance(0.14) };
    const kk = bays[key].kind, last = kk.charAt(kk.length - 1);
    if (last === '-' || last === '+') { bays[key].kind = kk.slice(0, -1); bays[key].flip = last === '-'; }   // 'cooler-' puts the cooler on the left
    if (o.lamps && o.lamps[key]) bays[key].lamp = o.lamps[key];
  }
  B.cols = cols; B.colW = colW; B.bays = bays;
  // the column a given x falls in, and whether a round aimed there meets glass or a mullion
  B.colAt = (xx) => clamp(Math.floor((xx - x) / colW), 0, cols - 1);
  B.clearAt = (f, xx, margin) => { const op = B.win(f, B.colAt(xx)); return !!op && xx > op.x + (margin || 0.3) && xx < op.x + op.w - (margin || 0.3); };
  const roofY = B.roofY, edge = o.edge || '#5fd4ff', topY = roofY + para, H = topY - base;

  // ---- everything below is decoration, with its own random numbers ----
  const D = makeRng((o.seed || 5) * 977 + 31), SL = twS;
  const pals = [], palOf = {};
  const palFor = (tint, cur) => {
    const key = tint + '|' + cur; let p = palOf[key]; if (p) return p;
    const t = (hex) => S.tone(hex, P, true), col = [];
    col[SL.LO] = t(darken(tint, 0.13)); col[SL.LO2] = t(darken(tint, 0.27)); col[SL.HI] = t(lighten(tint, 0.6)); col[SL.MD] = t(darken(tint, 0.3)); col[SL.DK] = t(darken(tint, 0.55)); col[SL.DK2] = t(darken(tint, 0.72));
    col[SL.HI2] = col[SL.HI]; col[SL.SCR] = t('#aee0ff'); col[SL.BL] = t(mix('#d8d2c2', tint, 0.35)); col[SL.BL2] = t(darken(mix('#d8d2c2', tint, 0.35), 0.2));
    if (cur >= 0) { const c = mix(twCurtains[cur], tint, 0.22); col[SL.ACA] = t(c); col[SL.ACB] = t(darken(c, 0.3)); col[SL.WAT] = t('#f4efe6'); }
    else { col[SL.ACA] = t(mix(darken(tint, 0.3), '#c9774f', 0.45)); col[SL.ACB] = t(mix(darken(tint, 0.3), '#4f7fc9', 0.4)); col[SL.WAT] = t('#bfe6ff'); }
    p = palOf[key] = { col, wall: t(tint), spill: rgba(t(tint), 0.15), vis: [], n: 0 };
    pals.push(p); return p;
  };
  const wins = [];
  for (const key in B.wins) {
    const op = B.wins[key], bay = bays[key], hotel = bay.kind === 'room', named = !!(o.bays && o.bays[key]);
    const v = { wall: D.i(0, 6), blind: !hotel && op.f > 0 && !named && D.chance(0.4) ? D.r(0.14, 0.62) : 0, extra: D.i(0, 5), room: D.i(0, 3), cur: D.i(0, 3), a: D.f(), tvOn: D.chance(0.5), ph: D.r(0, 40) };
    const G = twRec();
    const ex = bay.kind === 'lobby' ? twLobby(G, op, (o.lobby || [])[op.c] || 'desk', v) : hotel ? twHotel(G, op, bay, v) : twOffice(G, op, bay, v, named);
    wins.push({ op, room: S.rooms[op.room], pal: palFor(op.tint, hotel ? v.cur : -1), sh: G.done(), fx: ex.fx, bay, tv: !!ex.tv && v.tvOn, ph: v.ph });
  }
  // colours of the wall itself
  const wallHex = o.wall || '#1c2836';
  const spCol = S.tone(lighten(wallHex, 0.09), P), capCol = S.tone(lighten(o.frame || '#40526a', 0.12), P), jointCol = S.tone(darken(wallHex, 0.35), P), sillCol = S.tone(lighten(wallHex, 0.2), P);
  const inRoom = S.tone(S.pal.inRoom, P), sil = mix(inRoom, '#7f9fd0', 0.11), silNv = mix(mix(inRoom, '#2c5a3a', 0.5), '#bfe8c8', 0.14);
  // the city in the glass: the outline of the buildings behind you, and a few of their lights
  const prof = []; let profLen = 0;
  while (profLen < Math.max(60, w * 2.6)) {
    const sw = D.r(3.5, 9), u = D.f(), hh = u < 0.22 ? D.r(0.06, 0.3) : u < 0.75 ? D.r(0.34, 0.72) : D.r(0.74, 0.96), dots = [];
    const n = Math.floor((sw * hh * H) / 55);
    for (let i = 0; i < n; i++) dots.push(D.r(0.3, sw - 0.9), base + D.r(0.04, hh - 0.03) * H);
    prof.push([profLen, sw, base + hh * H, dots]); profLen += sw;
  }
  const keep = {};

  // behind the people: the wall between the windows, the city in the glass, and the rooms
  P.add({ x0: x - 1, x1: x + w + 1, layer: 0, draw(ctx, env) {
    const s = env.s; if (s < 1.6) return;
    const vx0 = env.x0, vx1 = env.x1, vy0 = env.y0, vy1 = env.y1;
    const c0 = clamp(Math.floor((vx0 - x) / colW), 0, cols - 1), c1 = clamp(Math.floor((vx1 - x) / colW), 0, cols - 1);
    const f0 = clamp(Math.floor((vy0 - base) / fh) - 1, 0, floors - 1), f1 = clamp(Math.floor((vy1 - base) / fh), 0, floors - 1);
    // ---- the curtain wall: spandrel panels between the floors, mullion caps, slab joints ----
    if (s > 4.5) {
      ctx.fillStyle = spCol;
      for (let f = f0; f <= f1; f++) { const yy = base + f * fh + fh - 0.43, hh = f === floors - 1 ? 0.36 + para * 0.6 : 0.48; for (let c = c0; c <= c1; c++) ctx.fillRect(x + c * colW + mul / 2 + 0.05, yy, colW - mul - 0.1, hh); }
      ctx.fillStyle = capCol; const cw = Math.max(0.06, env.px * 0.8);
      for (let c = Math.max(1, c0); c <= Math.min(cols - 1, c1 + 1); c++) ctx.fillRect(x + c * colW - cw / 2, base, cw, H);
      if (s > 12) {
        ctx.fillStyle = jointCol; for (let f = Math.max(1, f0); f <= f1 + 1 && f <= floors; f++) ctx.fillRect(x, base + f * fh - 0.02, w, 0.04);
        ctx.fillStyle = sillCol; for (let f = f0; f <= f1; f++) ctx.fillRect(x, base + f * fh + fh - 0.5, w, 0.035);
      }
    }
    // ---- the glow of the edge lights on the wall beside them ----
    {
      const gw = Math.min(2.4, w * 0.2);
      ctx.globalCompositeOperation = 'lighter';
      if (x + gw > vx0) { ctx.fillStyle = twGrad(keep, ctx, 'el', () => { const g = ctx.createLinearGradient(x, 0, x + gw, 0); g.addColorStop(0, rgba(edge, 0.2)); g.addColorStop(1, rgba(edge, 0)); return g; }); ctx.fillRect(x, base, gw, H); }
      if (x + w - gw < vx1) { ctx.fillStyle = twGrad(keep, ctx, 'er', () => { const g = ctx.createLinearGradient(x + w, 0, x + w - gw, 0); g.addColorStop(0, rgba(edge, 0.2)); g.addColorStop(1, rgba(edge, 0)); return g; }); ctx.fillRect(x + w - gw, base, gw, H); }
      if (topY - 2 < vy1) { ctx.fillStyle = twGrad(keep, ctx, 'et', () => { const g = ctx.createLinearGradient(0, topY, 0, topY - 2); g.addColorStop(0, rgba(edge, 0.16)); g.addColorStop(1, rgba(edge, 0)); return g; }); ctx.fillRect(x, topY - 2, w, 2); }
      ctx.globalCompositeOperation = 'source-over';
    }
    // ---- the sky in the glass, cut by the outline of the buildings behind you. It slides as you pan. ----
    {
      let off = (((vx0 + vx1) / 2 - x) * 0.5 + w) % profLen; if (off < 0) off += profLen;
      let i0 = 0; while (prof[i0][0] + prof[i0][1] <= off) i0++;
      const start = x - (off - prof[i0][0]);
      ctx.beginPath(); ctx.moveTo(x, topY);
      for (let i = i0, px0 = start, n = 0; px0 < x + w && n < 60; n++) { const sg = prof[i]; ctx.lineTo(Math.max(x, px0), sg[2]); ctx.lineTo(Math.min(x + w, px0 + sg[1]), sg[2]); px0 += sg[1]; i = (i + 1) % prof.length; }
      ctx.lineTo(x + w, topY); ctx.closePath();
      ctx.fillStyle = twGrad(keep, ctx, 'sky', () => { const g = ctx.createLinearGradient(0, base, 0, topY); g.addColorStop(0, 'rgba(70,112,180,0.05)'); g.addColorStop(1, 'rgba(78,120,190,0.3)'); return g; });
      ctx.fill();
      if (s > 5) {
        ctx.fillStyle = 'rgba(255,214,150,0.2)';
        for (let i = i0, px0 = start, n = 0; px0 < x + w && n < 60; n++) {
          const sg = prof[i], d = sg[3];
          if (px0 + sg[1] > vx0 && px0 < vx1) for (let j = 0; j < d.length; j += 2) { const xx = px0 + d[j]; if (xx > x + 0.2 && xx < x + w - 0.8) ctx.fillRect(xx, d[j + 1], 0.55, 0.34); }
          px0 += sg[1]; i = (i + 1) % prof.length;
        }
      }
    }
    // ---- the rooms ----
    const tier = s < 6.5 ? 0 : s < 18 ? 1 : s < 42 ? 2 : 3;
    let nd = 0, nl = 0;
    for (let i = 0; i < pals.length; i++) pals[i].n = 0;
    for (let i = 0; i < wins.length; i++) {
      const q = wins[i], op = q.op; if (op.x + op.w < vx0 || op.x > vx1 || op.y > vy1 || op.y + op.h < vy0) continue;
      if (q.room && q.room.lit) { q.pal.vis[q.pal.n++] = q; nl++; } else keep.dark[nd++] = q;
    }
    if (nl) {
      const gl = twGrad(keep, ctx, 'lit', () => { const g = ctx.createLinearGradient(0, 0, 0, fh - 0.62); g.addColorStop(0, 'rgba(0,0,0,0.1)'); g.addColorStop(0.22, 'rgba(0,0,0,0)'); g.addColorStop(0.3, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.34)'); return g; });
      for (let pi = 0; pi < pals.length; pi++) {
        const pal = pals[pi], n = pal.n, vis = pal.vis; if (!n) continue;
        // a little of the room's light on the frame around it, then the room's back wall
        if (tier > 0) { ctx.fillStyle = pal.spill; for (let i = 0; i < n; i++) { const op = vis[i].op; ctx.fillRect(op.x - 0.16, op.y - 0.13, op.w + 0.32, op.h + 0.29); } }
        ctx.fillStyle = pal.wall; for (let i = 0; i < n; i++) { const op = vis[i].op; ctx.fillRect(op.x, op.y, op.w, op.h); }
        ctx.fillStyle = gl; for (let i = 0; i < n; i++) { const op = vis[i].op; ctx.translate(0, op.y); ctx.fillRect(op.x, 0, op.w, op.h); ctx.translate(0, -op.y); }
        for (let sl = 0; sl < SL.N; sl++) {
          let col = false, path = false;
          for (let i = 0; i < n; i++) { const sh = vis[i].sh, a = sh.r[sl]; if (!a) continue; const m = sh.rn[sl][tier]; if (!m) continue; if (!col) { ctx.fillStyle = pal.col[sl]; col = true; } twRects(ctx, a, m); }
          for (let i = 0; i < n; i++) { const sh = vis[i].sh, a = sh.q[sl]; if (!a) continue; const m = sh.qn[sl][tier]; if (!m) continue; if (!path) { ctx.beginPath(); path = true; } twTrace(ctx, a, m); }
          if (path) { if (!col) ctx.fillStyle = pal.col[sl]; ctx.fill(); }
        }
        // a desk lamp a mission asked for, and the soft light of lamps and screens
        for (let i = 0; i < n; i++) {
          const q = vis[i], op = q.op;
          if (q.bay.lamp && s >= 3.4) {
            const d = q.bay.kind === 'deskL' ? -1 : 1, lx = op.x + op.w / 2 + d * 0.62, fy = op.y;
            R4(ctx, lx - 0.02, fy + 0.73, 0.04, 0.3, pal.col[SL.DK]); if (tier > 1) R4(ctx, lx - 0.1, fy + 0.73, 0.2, 0.03, pal.col[SL.DK]);
            poly(ctx, [lx - 0.17, fy + 1.0, lx + 0.17, fy + 1.0, lx + 0.09, fy + 1.16, lx - 0.09, fy + 1.16], S.tone(q.bay.lamp, P, true));
            if (tier > 0) twGlowE(ctx, lx, fy + 0.9, 0.6, 0.42, q.bay.lamp, 0.3);
          }
          if (tier > 0) for (let j = 0; j < q.fx.length; j++) { const f = q.fx[j]; if (f[0] > tier) continue; twGlow(ctx, f[1], f[2], f[3], f[4], f[6] ? f[5] * (0.55 + 0.45 * vnoise(env.t * 6 + q.ph, 3)) : f[5]); }
        }
      }
    }
    // dark rooms: the faint shapes of the furniture, a screen somebody left on, a television nobody is watching
    if (nd) {
      const dark = keep.dark;
      if (tier > 0 && s > 9) {
        ctx.fillStyle = env.nv ? silNv : sil;
        let path = false;
        for (let i = 0; i < nd; i++) {
          const sh = dark[i].sh;
          for (let sl = SL.MD; sl <= SL.DK; sl++) { const a = sh.r[sl]; if (a) twRects(ctx, a, sh.rn[sl][1]); }
        }
        for (let i = 0; i < nd; i++) {
          const sh = dark[i].sh;
          for (let sl = SL.MD; sl <= SL.DK; sl++) { const a = sh.q[sl]; if (!a || !sh.qn[sl][1]) continue; if (!path) { ctx.beginPath(); path = true; } twTrace(ctx, a, sh.qn[sl][1]); }
        }
        if (path) ctx.fill();
      }
      if (s > 2.5) for (let i = 0; i < nd; i++) {
        const q = dark[i], op = q.op;
        if (q.bay.screen) { const sx = op.x + op.w * (q.bay.flip ? 0.25 : 0.68); R4(ctx, sx, op.y + 0.82, 0.3, 0.2, env.nv ? '#9fe8b0' : 'rgba(110,170,235,0.5)'); if (tier > 0) twGlow(ctx, sx + 0.15, op.y + 0.9, 0.9, '#6eaaeb', 0.2); }
        else if (q.tv && tier > 0) twGlowE(ctx, op.x + op.w / 2, op.y + 1.1, 1.3, 1.0, '#9fd0ff', 0.1 + 0.12 * (0.5 + 0.5 * vnoise(env.t * 6 + q.ph, 3)));
      }
    }
  } });
  keep.dark = [];
  // in front of the rooms: edge lighting, hazard tape on any pane that is out
  P.add({ x0: x - 1, x1: x + w + 1, layer: 1, draw(ctx, env) {
    const ec = rgba(edge, 0.75), ew = Math.max(0.1, env.px * 0.9);
    R4(ctx, x - ew, base, ew, roofY + para - base, ec); R4(ctx, x + w, base, ew, roofY + para - base, ec);
    R4(ctx, x - ew, roofY + para - ew * 0.5, w + ew * 2, ew, ec);
    if (env.s > 2) {
      for (const key in B.wins) {
        const op = B.wins[key]; if (op.glass || op.door || op.x + op.w < env.x0 || op.x > env.x1) continue;
        const lw = Math.max(0.07, env.px * 1.1);
        ctx.strokeStyle = '#f2c230'; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(op.x, op.y + 0.5); ctx.lineTo(op.x + op.w, op.y + 1.25); ctx.moveTo(op.x, op.y + 1.25); ctx.lineTo(op.x + op.w, op.y + 0.5); ctx.stroke();
        if (env.s > 16) {   // close up, the black bars printed on the tape
          ctx.strokeStyle = '#191a1c'; ctx.setLineDash([0.07, 0.22]);
          ctx.beginPath(); ctx.moveTo(op.x, op.y + 0.5); ctx.lineTo(op.x + op.w, op.y + 1.25); ctx.moveTo(op.x, op.y + 1.25); ctx.lineTo(op.x + op.w, op.y + 0.5); ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
  } });
  return B;
};

// ---- the big towers behind everything -----------------------------------------------
// Too far away for rooms: bodies with floor lines, a believable scatter of lit
// windows, lit crowns, roof plant, a helipad, warning lights, and mist at their feet.
K.twBackTowers = function (S, z, o) {
  o = o || {};
  const P = S.plane(z, 'backtowers'), D = makeRng((o.seed || 41) * 613 + 5);
  const list = o.towers || [];
  const body = S.tone('#3b4960', P), body2 = S.tone('#2c3850', P), body3 = S.tone('#212b3f', P), rim = S.tone('#55657f', P), deck = S.tone('#46525f', P);
  const lightHex = ['#ffd9a0', '#d6e6ff', '#ffe9c8', '#bfe0ff'];
  const lights = lightHex.map((h) => S.tone(h, P, true)).concat(lightHex.map((h) => mix(S.tone(h, P, true), body, 0.55)));
  const tw = list.map((t, i) => {
    const n = Math.max(3, Math.round(t.w / 3.4)), cw = t.w / n, cells = [[], [], [], [], [], [], [], []], bands = [];
    let fl = 0;
    for (let y = 5; y < t.h - 4; y += 3.6, fl++) {
      if (fl % 12 === 9) { bands.push(y - 0.6); continue; }                                                     // a plant floor: louvres, no windows
      const mode = D.f(), col = D.i(0, 3) + (D.chance(0.4) ? 4 : 0), put = (c, k) => cells[k].push(t.x + c * cw + 0.4, y, cw - 0.8, 1.9);
      if (mode < 0.1) { for (let c = 0; c < n; c++) put(c, col); }                                             // a whole floor working late
      else if (mode < 0.3) { if (D.chance(0.4)) put(D.i(0, n - 1), col); }                                      // dark, perhaps one light left on
      else if (mode < 0.66) { const a = D.i(0, n - 2), len = D.i(2, Math.max(2, Math.round(n * 0.6))); for (let c = a; c < Math.min(n, a + len); c++) if (D.chance(0.85)) put(c, col); }   // one department still in
      else for (let c = 0; c < n; c++) if (D.chance(0.38)) put(c, D.chance(0.8) ? col : D.i(0, 7));
    }
    return { t, n, cw, cells, bands, ph: i * 1.7, topH: t.top === 'needle' ? 34 : t.top === 'step' ? 13 : t.top === 'slant' ? 12 : 0,
      pad: !t.top && i % 3 === 2, crown: t.strip || (i % 2 ? '#bcd4ff' : '#ffe2b4'), puff: D.r(0, 9) };
  });
  const keep = {};
  P.add({ x0: -400, x1: 400, layer: 0, draw(ctx, env) {
    const s = env.s, lw = Math.max(0.1, env.px * 0.6), dot = Math.max(0.2, env.px * 1.1);
    for (let i = 0; i < tw.length; i++) {
      const T = tw[i], t = T.t; if (t.x + t.w + 8 < env.x0 || t.x - 8 > env.x1) continue;
      const x0 = t.x, x1 = t.x + t.w, mx = t.x + t.w / 2, crownC = rgba(T.crown, 0.75);
      R4(ctx, x0, 0, t.w, t.h, body); R4(ctx, x0 + t.w * 0.72, 0, t.w * 0.28, t.h, body2);
      if (t.top === 'step') {
        R4(ctx, x0 + t.w * 0.2, t.h, t.w * 0.6, 7, body); R4(ctx, x0 + t.w * 0.38, t.h + 7, t.w * 0.24, 6, body2);
        R4(ctx, x0 + t.w * 0.2, t.h + 6.2, t.w * 0.6, 0.55, crownC); R4(ctx, x0 + t.w * 0.38, t.h + 12.3, t.w * 0.24, 0.5, crownC);
        line(ctx, mx, t.h + 13, mx, t.h + 19, body3, 0.3, env);
      }
      if (t.top === 'needle') {
        poly(ctx, [x0 + t.w * 0.2, t.h, x0 + t.w * 0.8, t.h, x0 + t.w * 0.56, t.h + 14, x0 + t.w * 0.44, t.h + 14], body); line(ctx, mx, t.h + 14, mx, t.h + 34, body, 0.5, env);
        line(ctx, x0 + t.w * 0.2, t.h, x0 + t.w * 0.44, t.h + 14, crownC, 0.22, env); line(ctx, x0 + t.w * 0.8, t.h, x0 + t.w * 0.56, t.h + 14, crownC, 0.22, env);
        twBeacon(ctx, env, mx, t.h + 24, T.ph + 2.2);
      }
      if (t.top === 'slant') { poly(ctx, [x0, t.h, x1, t.h, x1, t.h + 12], body); line(ctx, x0, t.h, x1, t.h + 12, crownC, 0.3, env); }
      // floor lines, mullions, plant floors
      if (s > 2.5) {
        ctx.strokeStyle = rim; ctx.globalAlpha = 0.55; ctx.lineWidth = lw; ctx.beginPath();
        for (let y = Math.max(4.1, 4.1 + Math.floor((env.y0 - 4.1) / 3.6) * 3.6); y < Math.min(t.h, env.y1); y += 3.6) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
        if (s > 6) for (let c = 1; c < T.n; c++) { ctx.moveTo(x0 + c * T.cw, 0); ctx.lineTo(x0 + c * T.cw, t.h); }
        ctx.stroke(); ctx.globalAlpha = 1;
      }
      ctx.fillStyle = body3; for (let j = 0; j < T.bands.length; j++) ctx.fillRect(x0, T.bands[j], t.w, 3.2);
      R4(ctx, x0, 0, Math.max(0.2, env.px), t.h, rim);
      // lit windows, a colour at a time
      for (let k = 0; k < 8; k++) {
        const a = T.cells[k]; if (!a.length) continue;
        ctx.fillStyle = lights[k];
        for (let j = 0; j < a.length; j += 4) { if (a[j + 1] > env.y1 || a[j + 1] + 2 < env.y0) continue; ctx.fillRect(a[j], a[j + 1], a[j + 2], a[j + 3]); }
      }
      R4(ctx, x0 + 1.2, 0.6, t.w - 2.4, 3.6, lights[4 + (i % 4)]);                                                 // the lobby at its foot
      // lit crown, and the light it throws into the haze
      if (T.t.strip) { ctx.fillStyle = rgba(T.t.strip, 0.8); ctx.fillRect(x0 + t.w * 0.08, 4, Math.max(0.5, env.px), t.h - 6); }
      R4(ctx, x0 + 0.9, t.h - 2.5, t.w - 1.8, 1.1, crownC);
      if (t.h + 6 > env.y0 && t.h - 9 < env.y1) twGlowE(ctx, mx, t.h - 1.5, t.w * 0.7, 6, T.crown, 0.2);
      if (!t.top && !T.pad) {
        // roof plant: a plant room, two cooling towers breathing vapour, a mast
        R4(ctx, x0 + t.w * 0.12, t.h, t.w * 0.3, 3.2, body2); R4(ctx, x0 + t.w * 0.12, t.h + 3.0, t.w * 0.3, 0.3, body3);
        for (let k = 0; k < 2; k++) {
          const px = x0 + t.w * 0.56 + k * 4.4;
          R4(ctx, px, t.h, 3.4, 2.5, body2); R4(ctx, px + 0.7, t.h + 2.5, 2.0, 0.9, body3);
          if (s > 5) for (let j = 0; j < 3; j++) { const u = (env.t * 0.07 + j / 3 + T.puff + k * 0.37) % 1; twPuff(ctx, px + 1.7 + env.wind * u * u * 5, t.h + 3.6 + u * 11, 1.6 + u * 4.5, 1.3 + u * 3.2, '#8fa0c4', (1 - u) * Math.min(1, u * 5) * 0.3); }
        }
        line(ctx, x0 + t.w * 0.2, t.h + 3.2, x0 + t.w * 0.2, t.h + 10, body3, 0.25, env);
        twBeacon(ctx, env, x0 + t.w * 0.2, t.h + 10.3, T.ph + 1);
      } else if (T.pad) {
        // a helipad, seen from a little above: deck, landing circle, the H, and a ring of edge lights
        const rx = Math.min(9.5, t.w * 0.42), ry = 1.05, cy = t.h + 2.4;
        line(ctx, mx - rx * 0.5, t.h, mx - rx * 0.7, cy, body3, 0.3, env); line(ctx, mx + rx * 0.5, t.h, mx + rx * 0.7, cy, body3, 0.3, env); line(ctx, mx, t.h, mx, cy, body3, 0.3, env);
        R4(ctx, x0 + t.w * 0.1, t.h, t.w * 0.22, 1.8, body2);
        ctx.fillStyle = body3; ctx.beginPath(); ctx.ellipse(mx, cy - 0.35, rx, ry, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = deck; ctx.beginPath(); ctx.ellipse(mx, cy, rx, ry, 0, 0, TAU); ctx.fill();
        if (s > 4) {
          ctx.strokeStyle = S.tone('#e2c65a', P, true); ctx.lineWidth = Math.max(0.16, env.px * 0.8); ctx.beginPath(); ctx.ellipse(mx, cy, rx * 0.72, ry * 0.72, 0, 0, TAU); ctx.stroke();
          ctx.strokeStyle = S.tone('#e8ecf2', P, true); ctx.lineWidth = Math.max(0.22, env.px * 0.9);
          ctx.beginPath(); ctx.moveTo(mx - rx * 0.2, cy - ry * 0.36); ctx.lineTo(mx - rx * 0.26, cy + ry * 0.36); ctx.moveTo(mx + rx * 0.26, cy - ry * 0.36); ctx.lineTo(mx + rx * 0.2, cy + ry * 0.36); ctx.moveTo(mx - rx * 0.23, cy); ctx.lineTo(mx + rx * 0.23, cy); ctx.stroke();
        }
        for (let k = 0; k < 12; k++) {
          const an = (k / 12) * TAU, lx = mx + Math.cos(an) * rx, ly = cy + Math.sin(an) * ry, b = 0.45 + 0.55 * Math.pow(Math.max(0, Math.sin(env.t * 2.4 - k * 0.52)), 3);
          circ(ctx, lx, ly, dot * 0.8, rgba('#7dffb0', 0.35 + 0.65 * b)); if (s > 5) twGlow(ctx, lx, ly, 1.3, '#4dff88', 0.3 * b);
        }
        // windsock
        const wx = mx + rx * 0.86, wd = env.wind >= 0 ? 1 : -1, wa = Math.min(1, Math.abs(env.wind) / 5), wf = Math.sin(env.t * 5) * 0.12;
        line(ctx, wx, cy, wx, cy + 3.2, body3, 0.16, env);
        poly(ctx, [wx, cy + 3.2, wx, cy + 2.6, wx + wd * 2.4, cy + 2.75 - (1 - wa) * 1.5 + wf, wx + wd * 2.4, cy + 3.0 - (1 - wa) * 1.5 + wf], S.tone('#e07b2a', P, true));
      }
      twBeacon(ctx, env, t.top === 'slant' ? x1 - 0.5 : t.top === 'step' ? mx : mx, (t.top === 'step' ? t.h + 19 : t.h + T.topH) + 0.4, T.ph);
    }
    // mist lying between the towers, lit from below by the streets
    ctx.fillStyle = twGrad(keep, ctx, 'mist', () => { const g = ctx.createLinearGradient(0, 0, 0, 28); g.addColorStop(0, 'rgba(44,62,110,0.6)'); g.addColorStop(0.45, 'rgba(38,55,100,0.28)'); g.addColorStop(1, 'rgba(34,50,92,0)'); return g; });
    if (env.y0 < 28) ctx.fillRect(env.x0, Math.max(0, env.y0), env.x1 - env.x0, 28 - Math.max(0, env.y0));
    for (let k = -3; k <= 3; k++) {
      const gx = k * 62 + 12; if (gx + 36 < env.x0 || gx - 36 > env.x1) continue;
      if (env.y0 < 20) twGlowE(ctx, gx, 7, 30, 12, k & 1 ? '#ffb070' : '#7fa8ff', 0.11 + 0.04 * vnoise(env.t * 0.15 + k * 3.1, 9));
    }
  } });
  K.ground(S, P, { col: '#3a4658', noEdge: true });
  return P;
};

// ---- a window-cleaning cradle hanging on a tower face ----------------------------
// It hangs on its own plane just in front of the glass. People on it stand in
// the open. setY moves it (and the caller moves whoever is riding).
K.twCradle = function (S, P, o) {
  const cr = { x: o.x, y: o.y, w: o.w || 3.6, top: o.top, plane: P, zone: 'cradle' };
  const steel = S.tone('#aab3bd', P), steelD = S.tone('#6f7a86', P), dark = S.tone('#20252d', P), yel = S.tone('#e2b33c', P, true), blue = S.tone('#3f6fb0', P), rubber = S.tone('#12151a', P);
  cr.solid = P.solid(cr.x - cr.w / 2, cr.y - 0.16, cr.w, 0.16, 'thin');
  cr.setY = (y) => { cr.y = y; cr.solid.y = y - 0.16; };
  cr.at = (dx, extra) => Object.assign({ plane: P, x: cr.x + (dx || 0), y: cr.y, zone: cr.zone, room: null, behind: false, flee: [['wait', 999, 'cower']] }, extra || {});
  // behind whoever rides it: ropes, davit arms, hoists, the floor and the back rail
  P.add({ x0: cr.x - cr.w, x1: cr.x + cr.w, layer: 0, draw(ctx, env) {
    const a = cr.x - cr.w / 2, b = cr.x + cr.w / 2, y = cr.y, top = cr.top;
    line(ctx, a + 0.25, y + 1.05, a + 0.25, top + 0.5, dark, 0.05, env); line(ctx, b - 0.25, y + 1.05, b - 0.25, top + 0.5, dark, 0.05, env);       // the ropes that carry it
    if (env.s > 6) { line(ctx, a + 0.37, y + 1.05, a + 0.37, top + 0.5, dark, 0.025, null); line(ctx, b - 0.37, y + 1.05, b - 0.37, top + 0.5, dark, 0.025, null); }   // and the safety lines
    line(ctx, a + 0.25, top + 0.5, a + 0.25 - 0.9, top + 0.9, steel, 0.12, env); line(ctx, b - 0.25, top + 0.5, b - 0.25 + 0.9, top + 0.9, steel, 0.12, env);   // davit arms on the roof
    if (env.s > 5) {
      line(ctx, a - 0.65, top, a - 0.65, top + 0.9, steelD, 0.09, env); line(ctx, b + 0.65, top, b + 0.65, top + 0.9, steelD, 0.09, env);
      circ(ctx, a + 0.25, top + 0.5, 0.11, steelD); circ(ctx, b - 0.25, top + 0.5, 0.11, steelD);
      R4(ctx, a + 0.1, y + 1.05, 0.3, 0.32, steelD); R4(ctx, b - 0.4, y + 1.05, 0.3, 0.32, steelD);                                                     // hoist motors
      circ(ctx, a - 0.07, y + 0.45, 0.1, rubber); circ(ctx, b + 0.07, y + 0.45, 0.1, rubber);                                                         // rollers against the glass
      ctx.strokeStyle = steelD; ctx.lineWidth = Math.max(0.04, env.px * 0.6);
      ctx.beginPath(); ctx.moveTo(a + 0.06, y + 0.98); ctx.lineTo(b - 0.06, y + 0.98); ctx.moveTo(a + 0.06, y + 0.5); ctx.lineTo(b - 0.06, y + 0.5); ctx.stroke();
    }
    R4(ctx, a, y - 0.16, cr.w, 0.16, steel);
  } });
  // in front: the near rail, the toe board, the tools and the warning light
  P.add({ x0: cr.x - cr.w, x1: cr.x + cr.w, layer: 2, draw(ctx, env) {
    const a = cr.x - cr.w / 2, b = cr.x + cr.w / 2, y = cr.y;
    ctx.strokeStyle = steel; ctx.lineWidth = Math.max(0.06, env.px * 0.8);
    ctx.beginPath(); ctx.moveTo(a, y); ctx.lineTo(a, y + 1.05); ctx.lineTo(b, y + 1.05); ctx.lineTo(b, y); ctx.moveTo(a, y + 0.55); ctx.lineTo(b, y + 0.55); ctx.stroke();
    R4(ctx, a, y - 0.16, cr.w, 0.22, steel); R4(ctx, a, y - 0.16, cr.w, Math.max(0.07, env.px * 1.2), yel);
    if (env.s > 5) {
      R4(ctx, b - 0.75, y + 0.06, 0.34, 0.3, blue); R4(ctx, b - 0.77, y + 0.33, 0.38, 0.04, S.tone('#2c4f80', P));                                    // bucket
      line(ctx, b - 0.58, y + 0.36, b - 0.4, y + 1.2, dark, 0.03, env); line(ctx, b - 0.52, y + 1.22, b - 0.28, y + 1.18, dark, 0.05, env);            // squeegee on its pole
      ctx.strokeStyle = dark; ctx.lineWidth = Math.max(0.04, env.px * 0.6); ctx.beginPath(); ctx.arc(a + 0.8, y + 0.78, 0.2, 0, TAU); ctx.moveTo(a + 0.92, y + 0.78); ctx.arc(a + 0.8, y + 0.78, 0.12, 0, TAU); ctx.stroke();   // a coil of hose
      R4(ctx, a + 1.45, y + 0.6, 0.2, 0.28, steelD); R4(ctx, a + 1.45, y + 0.8, 0.2, 0.05, yel);                                                       // the control box
    }
    if (env.s > 14) { ctx.fillStyle = dark; for (let xx = a + 0.1; xx < b - 0.15; xx += 0.36) { ctx.beginPath(); ctx.moveTo(xx, y - 0.16); ctx.lineTo(xx + 0.1, y - 0.16); ctx.lineTo(xx + 0.17, y - 0.09); ctx.lineTo(xx + 0.07, y - 0.09); ctx.closePath(); ctx.fill(); } }
    // an amber light that turns while the cradle is in use
    const bl = Math.pow(Math.max(0, Math.sin(env.t * 3.6)), 2);
    R4(ctx, b - 0.29, y + 1.37, 0.08, 0.12, dark); circ(ctx, b - 0.25, y + 1.56, Math.max(0.09, env.px * 1.1), rgba('#ffb347', 0.45 + 0.55 * bl));
    twGlow(ctx, b - 0.25, y + 1.56, Math.max(1.1, env.px * 8), '#ffb347', 0.12 + 0.4 * bl);
  } });
  return cr;
};

// ---- the rooftop bar on the Meridian -----------------------------------------------
// Guests stand all along it, so everything at leg height behind them is kept plain:
// the detail is in the bar, on the deck edge and above head height.
K.twTerrace = function (S, P, B, o) {
  o = o || {};
  const y = B.roofY, x0 = B.x, x1 = B.x + B.w, zone = B.roofRoom;
  const steel = S.tone('#2a3038', P), steelL = S.tone('#58626e', P), wood = S.tone('#6b4f3a', P), wood2 = S.tone('#4a3626', P), wood3 = S.tone('#35271b', P), leaf = S.tone('#3f7a4c', P), leaf2 = S.tone('#2d5a3a', P), pot = S.tone('#9a5a3a', P), top = S.tone('#e9e4d6', P), brass = S.tone('#c9a24a', P);
  const T = { x0, x1, y, zone, lamps: [], posts: [] };
  const n = 4;
  for (let i = 0; i <= n; i++) T.posts.push(x0 + 0.5 + ((x1 - x0 - 1) * i) / n);
  (o.lamps || [x0 + 3.6, x0 + 11.95, x1 - 3.4]).forEach((lx, i) => T.lamps.push(K.lamp(S, P, lx, 3.0, zone, { id: 'tl' + (i + 1), y, reach: o.reach || 4.6, arm: 0 })));
  T.on = () => T.lamps.some((l) => l.alive && l.on !== false);
  T.barX = x0 + 3.1;
  const tables = o.tables || [x0 + 8.2, x0 + 12.4, x0 + 16.2], heaters = o.heaters || [x0 + 7.0, x0 + 14.3];
  const bulbs = [];
  for (let i = 0; i < n; i++) { const a = T.posts[i], b = T.posts[i + 1]; for (let u = 0.08; u < 0.95; u += 0.11) bulbs.push([lerp(a, b, u), y + 3.25 - Math.sin(u * Math.PI) * 0.5, (bulbs.length % 3)]); }
  const keep = {}, warmHex = '#ffd9a0', bc = ['#7fb86a', '#d9a441', '#b5523f', '#9fc6e0', '#e6dcc0'];
  P.add({ x0: x0 - 3, x1: x1 + 3, layer: 0, draw(ctx, env) {
    const on = T.on(), s = env.s, warm = S.tone(warmHex, P, true);
    // light hanging in the air over the deck: strongest under each working lamp, gone where the lamps do not reach
    if (on) {
      ctx.globalCompositeOperation = 'lighter';
      const wx0 = Math.max(x0 - 2, env.x0), wx1 = Math.min(x1 + 2, env.x1);
      twLampWash(ctx, S, zone, x0 - 2, x1 + 2, y, y + 1.6, '255,196,120', 0.16, keep);
      ctx.globalAlpha = 0.4; ctx.fillRect(wx0, y + 1.6, wx1 - wx0, 1.8);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    // the deck: boards on a steel edge beam, with small lights under it washing the top of the hotel
    R4(ctx, x0 - 0.1, y - 0.28, x1 - x0 + 0.2, 0.2, steel); R4(ctx, x0, y - 0.08, x1 - x0, 0.2, wood);
    if (s > 22) { ctx.fillStyle = wood2; for (let xx = Math.max(x0, Math.floor(env.x0 / 0.3) * 0.3); xx < Math.min(x1, env.x1); xx += 0.3) ctx.fillRect(xx, y - 0.08, 0.025, 0.2); }
    if (s > 4) for (let c = 0; c < B.cols; c++) { const lx = B.winX(c); if (lx < env.x0 - 2 || lx > env.x1 + 2) continue; R4(ctx, lx - 0.1, y - 0.34, 0.2, 0.07, on ? warm : steelL); if (on) twGlowE(ctx, lx, y - 0.95, 1.5, 1.0, warmHex, 0.2); }
    // pergola: posts, a beam, and slats across the top
    for (let i = 0; i < T.posts.length; i++) { R4(ctx, T.posts[i] - 0.07, y, 0.14, 3.3, steel); if (s > 9) R4(ctx, T.posts[i] - 0.16, y, 0.32, 0.06, steelL); }
    R4(ctx, x0 + 0.3, y + 3.24, x1 - x0 - 0.6, 0.12, steel);
    if (s > 7) { ctx.fillStyle = steel; for (let xx = x0 + 0.6; xx < x1 - 0.5; xx += 0.62) ctx.fillRect(xx, y + 3.36, 0.07, 0.15); }
    // the back of the bar: a mirror, shelves of bottles lit from underneath, glasses hanging from the cornice
    R4(ctx, x0 + 1.0, y, 4.2, 2.3, wood2); R4(ctx, x0 + 0.9, y + 2.3, 4.4, 0.12, wood); R4(ctx, x0 + 1.0, y, 0.1, 2.3, wood3); R4(ctx, x0 + 5.1, y, 0.1, 2.3, wood3);
    R4(ctx, x0 + 1.15, y + 1.26, 3.9, 0.49, 'rgba(150,185,220,0.10)');
    R4(ctx, x0 + 1.15, y + 1.2, 3.9, 0.06, wood); R4(ctx, x0 + 1.15, y + 1.75, 3.9, 0.06, wood);
    if (on) { R4(ctx, x0 + 1.15, y + 1.17, 3.9, 0.03, warm); R4(ctx, x0 + 1.15, y + 1.72, 3.9, 0.03, warm); twGlowE(ctx, x0 + 3.1, y + 1.6, 2.6, 0.9, warmHex, 0.2); }
    if (s > 4) {
      for (let i = 0; i < 12; i++) {
        const c1 = S.tone(bc[i % 5], P, on), c2 = S.tone(bc[(i + 2) % 5], P, on), bx = x0 + 1.3 + i * 0.31;
        R4(ctx, bx, y + 1.26, 0.12, 0.34, c1); R4(ctx, bx + 0.1, y + 1.81, 0.11, 0.3, c2);
        if (s > 14) { R4(ctx, bx + 0.04, y + 1.6, 0.04, 0.1, c1); R4(ctx, bx + 0.135, y + 2.11, 0.04, 0.09, c2); }
      }
    }
    if (s > 16) { ctx.fillStyle = 'rgba(200,225,245,0.4)'; for (let i = 0; i < 9; i++) { const gx = x0 + 1.5 + i * 0.4; ctx.fillRect(gx, y + 2.17, 0.02, 0.13); ctx.fillRect(gx - 0.06, y + 2.1, 0.14, 0.07); } }
    // three pendant lamps over the bar
    for (let i = 0; i < 3; i++) {
      const px = x0 + 1.9 + i * 1.3;
      R4(ctx, px - 0.012, y + 2.86, 0.024, 0.38, steel); poly(ctx, [px - 0.16, y + 2.7, px + 0.16, y + 2.7, px + 0.07, y + 2.88, px - 0.07, y + 2.88], brass);
      if (on) { R4(ctx, px - 0.12, y + 2.67, 0.24, 0.035, warm); twGlow(ctx, px, y + 2.6, 0.8, warmHex, 0.3); }
    }
    // planters at both ends: a box of grasses that lean with the wind
    const sway = Math.sin(env.t * 1.3) * 0.04 + clamp(env.wind, -6, 6) * 0.02;
    for (const px of [x0 + 0.5, x1 - 0.5]) {
      R4(ctx, px - 0.32, y, 0.64, 0.6, pot); R4(ctx, px - 0.36, y + 0.54, 0.72, 0.08, S.tone('#7a4630', P));
      circ(ctx, px - 0.12, y + 0.95, 0.34, leaf2); circ(ctx, px + 0.14, y + 1.25, 0.36, leaf); circ(ctx, px, y + 1.65, 0.3, leaf);
      if (s > 9) { ctx.strokeStyle = leaf2; ctx.lineWidth = Math.max(0.035, env.px * 0.6); ctx.beginPath(); for (let k = -3; k <= 3; k++) { ctx.moveTo(px + k * 0.07, y + 0.62); ctx.quadraticCurveTo(px + k * 0.13, y + 1.5, px + k * 0.2 + sway * 6, y + 2.0 - Math.abs(k) * 0.07); } ctx.stroke(); }
    }
    // tall tables with a candle on each
    for (let i = 0; i < tables.length; i++) {
      const tx = tables[i]; R4(ctx, tx - 0.04, y, 0.08, 1.05, steel); R4(ctx, tx - 0.42, y + 1.05, 0.84, 0.06, top); R4(ctx, tx - 0.25, y, 0.5, 0.05, steel);
      if (s > 8) { R4(ctx, tx - 0.05, y + 1.11, 0.1, 0.11, 'rgba(210,225,240,0.5)'); if (on) { R4(ctx, tx - 0.02, y + 1.13, 0.04, 0.07, '#ffd27a'); twGlow(ctx, tx, y + 1.2, 0.5, '#ffb347', 0.3 + 0.08 * Math.sin(env.t * 9 + i * 2)); } }
    }
    // patio heaters: a thin post, a glowing mantle and a hood, all above head height
    for (let i = 0; i < heaters.length; i++) {
      const hx = heaters[i];
      R4(ctx, hx - 0.035, y, 0.07, 2.25, steelL); R4(ctx, hx - 0.2, y, 0.4, 0.07, steel);
      R4(ctx, hx - 0.1, y + 2.25, 0.2, 0.26, on ? S.tone('#ff8a3c', P, true) : steel); R4(ctx, hx - 0.48, y + 2.5, 0.96, 0.06, steelL); R4(ctx, hx - 0.26, y + 2.56, 0.52, 0.05, steelL);
      if (on) twGlow(ctx, hx, y + 2.36, 1.0, '#ff8a3c', 0.28 + 0.05 * Math.sin(env.t * 5 + i));
    }
  } });
  P.add({ x0: x0 - 1, x1: x1 + 1, layer: 1, draw(ctx, env) {
    const on = T.on(), s = env.s;
    // the bar counter, in front of whoever is serving
    R4(ctx, x0 + 0.8, y, 4.6, 1.1, wood); R4(ctx, x0 + 0.8, y, 4.6, 0.1, wood3);
    if (s > 7) { ctx.fillStyle = wood2; for (let i = 1; i < 8; i++) ctx.fillRect(x0 + 0.8 + i * 0.575 - 0.015, y + 0.14, 0.03, 0.84); R4(ctx, x0 + 0.75, y + 0.24, 4.7, 0.035, brass); }
    if (on) R4(ctx, x0 + 0.8, y + 1.02, 4.6, 0.04, S.tone(warmHex, P, true));
    R4(ctx, x0 + 0.7, y + 1.06, 4.8, 0.09, top);
    if (s > 5) {
      for (let i = 0; i < 3; i++) { const sx = x0 + 1.5 + i * 1.25; R4(ctx, sx - 0.02, y, 0.04, 0.72, steel); R4(ctx, sx - 0.17, y + 0.72, 0.34, 0.06, steel); R4(ctx, sx - 0.13, y + 0.26, 0.26, 0.03, steel); }
      R4(ctx, x0 + 1.87, y + 1.15, 0.06, 0.28, brass); R4(ctx, x0 + 1.78, y + 1.4, 0.24, 0.05, brass);                                                // beer tap
      if (s > 12) { poly(ctx, [x0 + 4.45, y + 1.15, x0 + 4.75, y + 1.15, x0 + 4.8, y + 1.38, x0 + 4.4, y + 1.38], steelL); R4(ctx, x0 + 4.05, y + 1.15, 0.09, 0.2, steelL); R4(ctx, x0 + 4.065, y + 1.35, 0.06, 0.06, steelL); }   // ice bucket and shaker
    }
    // glass balustrade with a handrail along the edge
    ctx.fillStyle = 'rgba(150,195,230,0.10)'; ctx.fillRect(x0, y, x1 - x0, 1.05);
    R4(ctx, x0, y + 1.02, x1 - x0, Math.max(0.05, env.px * 0.8), 'rgba(200,225,245,0.55)');
    if (s > 3) { ctx.fillStyle = 'rgba(200,225,245,0.3)'; for (let x = x0; x <= x1 + 0.01; x += 1.75) ctx.fillRect(x - 0.02, y, 0.04, 1.05); }
    if (s > 9) {
      R4(ctx, x0, y, x1 - x0, 0.06, 'rgba(120,140,160,0.5)'); R4(ctx, x0, y + 1.065, x1 - x0, 0.015, 'rgba(235,245,255,0.6)');
      ctx.fillStyle = 'rgba(210,232,250,0.07)';
      for (let x = Math.max(x0, x0 + Math.floor((env.x0 - x0) / 1.75) * 1.75); x < Math.min(x1 - 0.5, env.x1); x += 1.75) { ctx.beginPath(); ctx.moveTo(x + 0.25, y + 0.06); ctx.lineTo(x + 0.5, y + 0.06); ctx.lineTo(x + 0.95, y + 1.02); ctx.lineTo(x + 0.7, y + 1.02); ctx.closePath(); ctx.fill(); }
    }
    // string lights
    ctx.strokeStyle = steel; ctx.lineWidth = Math.max(0.02, env.px * 0.5);
    ctx.beginPath(); for (let i = 0; i < n; i++) { ctx.moveTo(T.posts[i], y + 3.25); ctx.quadraticCurveTo((T.posts[i] + T.posts[i + 1]) / 2, y + 2.25, T.posts[i + 1], y + 3.25); } ctx.stroke();
    const cols = ['#ffe2a0', '#ffc66b', '#fff1cf'], br = Math.max(0.075, env.px * 0.9);
    if (on && s > 2) {
      // each bulb's glow: two soft discs, drawn together
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,196,110,0.09)'; ctx.beginPath(); for (let i = 0; i < bulbs.length; i++) { const b = bulbs[i]; if (b[0] < env.x0 - 1 || b[0] > env.x1 + 1) continue; ctx.moveTo(b[0] + 0.42, b[1]); ctx.arc(b[0], b[1], 0.42, 0, TAU); } ctx.fill();
      ctx.fillStyle = 'rgba(255,205,125,0.2)'; ctx.beginPath(); for (let i = 0; i < bulbs.length; i++) { const b = bulbs[i]; if (b[0] < env.x0 - 1 || b[0] > env.x1 + 1) continue; ctx.moveTo(b[0] + 0.2, b[1]); ctx.arc(b[0], b[1], 0.2, 0, TAU); } ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    for (let i = 0; i < bulbs.length; i++) { const b = bulbs[i]; if (b[0] < env.x0 || b[0] > env.x1) continue; if (s > 14) R4(ctx, b[0] - 0.02, b[1] + br * 0.8, 0.04, 0.07, steel); circ(ctx, b[0], b[1], br, on ? cols[b[2]] : '#2a2e36'); }
  } });
  return T;
};

// ---- the building site -----------------------------------------------------------
// A concrete frame with open floors, scaffolding up its left face, a tower crane
// behind it with a girder on the hook, a cabin, floodlights and a mesh fence.
// People walk the whole yard, so everything new at ground level is low, thin or
// behind them, and the stretch under the girder is left clear.
K.twSite = function (S, P, o) {
  o = o || {};
  const fx0 = o.x === undefined ? 31 : o.x, bw = 4, nb = o.bays || 4, fx1 = fx0 + nb * bw, lv = o.levels || 4, fh = 3.6, topY = lv * fh;
  const dark = S.tone('#22262d', P), orange = S.tone('#e07b2a', P, true), net = S.tone('#2f7a55', P), netD = S.tone('#1d5038', P);
  const two = (hex) => [S.tone(hex, P), mix(S.tone(hex, P, true), S.tone(hex, P), 0.35)];   // [in the dark, under the floodlights]
  const concC = two('#8c9198'), concDC = two('#5c6169'), steelC = two('#9aa3ad'), woodC = two('#a8916d');
  const concLC = two('#a9aeb4'), concSC = two('#474c54'), hoardC = two('#56789f'), hoardDC = two('#3d587a'), cabC = two('#c9ced3'), cabDC = two('#9aa1a8'), rustC = two('#8a5238'), genC = two('#a88c3a'), stripeC = two('#e2b33c');
  let conc = concC[1], concD = concDC[1], steel = steelC[1], wood = woodC[1], li = 1;
  const relight = () => { const i = Z.lamps.some((l) => l.alive && l.on !== false) ? 1 : 0; li = i; conc = concC[i]; concD = concDC[i]; steel = steelC[i]; wood = woodC[i]; };
  const Z = { x0: fx0, x1: fx1, fh, levels: lv, lamps: [], yard0: o.yard0 === undefined ? fx0 - 11 : o.yard0 };
  const craneX = o.craneX === undefined ? fx1 - 2.5 : o.craneX, craneH = o.craneH || 26, reach = o.reach || 22;
  const sx0 = fx0 - 2.8, sx1 = fx0 - 0.2, hx0 = sx0 - 0.3, hx1 = fx1 + 1.5, coreX = fx1 - bw + 0.9, coreW = bw - 1.8;
  const D = makeRng(7411 + Math.round(fx0 * 13)), keepG = {}, lampPosts = [];
  const stains = []; for (let i = 0; i < 16; i++) stains.push([D.r(fx0, fx1 - bw), D.i(1, lv), D.r(0.3, 1.1), D.r(0.06, 0.16)]);
  // the hoarding along the far side of the site, behind everything else (it stops short of the open yard)
  P.add({ x0: hx0 - 1, x1: hx1 + 1, layer: 0, draw(ctx, env) {
    relight();
    const s = env.s, len = hx1 - hx0;
    R4(ctx, hx0, 0, len, 2.2, hoardC[li]); R4(ctx, hx0, 0, len, 0.22, hoardDC[li]);
    if (s > 5) { ctx.fillStyle = hoardDC[li]; for (let xx = hx0; xx <= hx1 + 0.01; xx += 2.4) ctx.fillRect(xx - 0.03, 0, 0.06, 2.2); }
    R4(ctx, hx0, 2.2, len, 0.3, stripeC[li]);
    if (s > 6) {   // black warning stripes along the top
      ctx.fillStyle = dark; ctx.beginPath();
      for (let xx = Math.max(hx0, hx0 + Math.floor((env.x0 - hx0) / 0.6) * 0.6); xx < Math.min(hx1 - 0.3, env.x1); xx += 0.6) { ctx.moveTo(xx, 2.2); ctx.lineTo(xx + 0.3, 2.2); ctx.lineTo(xx + 0.6, 2.5); ctx.lineTo(xx + 0.3, 2.5); ctx.closePath(); }
      ctx.fill();
    }
    if (s > 7) {   // a warning notice near the far end
      const nx = hx1 - 1.25;
      R4(ctx, nx - 0.65, 1.22, 1.3, 0.9, S.tone('#e9e4d6', P, li > 0)); poly(ctx, [nx - 0.22, 1.6, nx + 0.22, 1.6, nx, 2.0], stripeC[li]); R4(ctx, nx - 0.025, 1.7, 0.05, 0.15, dark);
      env.text(ctx, 'KEEP OUT', nx, 1.3, 0.2, dark, 'center');
    }
    // the floodlights on the boards and on the ground, fading the way the light itself does
    ctx.globalCompositeOperation = 'lighter';
    twLampWash(ctx, S, 'site', Z.yard0 - 3, hx1, -1.5, 0, '255,214,150', 0.2, keepG);
    ctx.globalCompositeOperation = 'source-over';
  } });
  K.crane(S, P, craneX, craneH, -reach, { layer: 0 });
  Z.jibY = craneH; Z.craneX = craneX;
  // the frame
  P.add({ x0: fx0 - 0.5, x1: fx1 + 0.5, layer: 0, draw(ctx, env) {
    relight();
    const s = env.s, concL = concLC[li], concS = concSC[li];
    for (let i = 0; i <= nb; i++) { R4(ctx, fx0 + i * bw - 0.2, 0, 0.4, topY, concD); if (s > 8) { R4(ctx, fx0 + i * bw - 0.2, 0, 0.05, topY, conc); R4(ctx, fx0 + i * bw - 0.26, 0, 0.52, 0.12, concS); } }
    for (let l = 1; l <= lv; l++) { R4(ctx, fx0 - 0.2, l * fh - 0.3, fx1 - fx0 + 0.4, 0.3, conc); R4(ctx, fx0 - 0.2, l * fh - 0.3, fx1 - fx0 + 0.4, 0.07, concD); if (s > 8) R4(ctx, fx0 - 0.2, l * fh - 0.035, fx1 - fx0 + 0.4, 0.035, concL); }
    if (s > 10) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; for (let i = 0; i < stains.length; i++) { const q = stains[i]; ctx.fillRect(q[0], q[1] * fh - 0.3 - q[2], q[3], q[2]); } }
    // the lift shaft in the last bay: formwork seams, tie holes, floor numbers, starter bars sticking out of the top
    R4(ctx, coreX, 0, coreW, topY + 1.2, concD);
    if (s > 6) { ctx.fillStyle = concS; for (let yy = 1.2; yy < topY + 1.2; yy += 1.2) ctx.fillRect(coreX, yy - 0.02, coreW, 0.04); R4(ctx, coreX, 0, 0.06, topY + 1.2, conc); }
    if (s > 16) { ctx.fillStyle = concS; for (let yy = 0.6; yy < topY + 1; yy += 1.2) for (let k = 0; k < 4; k++) ctx.fillRect(coreX + 0.3 + k * 0.52, yy - 0.03, 0.06, 0.06); }
    for (let l = 1; l < lv; l++) env.text(ctx, 'L' + l, coreX + coreW / 2, l * fh + 1.25, 0.55, concL, 'center');
    ctx.strokeStyle = dark; ctx.lineWidth = Math.max(0.04, env.px * 0.6); ctx.beginPath();
    for (let i = 0; i <= nb; i++) for (let k = -1; k <= 1; k++) { ctx.moveTo(fx0 + i * bw + k * 0.12, topY); ctx.lineTo(fx0 + i * bw + k * 0.12, topY + 1.1); }
    if (s > 5) for (let k = 0; k < 6; k++) { ctx.moveTo(coreX + 0.2 + k * 0.36, topY + 1.2); ctx.lineTo(coreX + 0.2 + k * 0.36, topY + 2.0 + (k % 2) * 0.2); }
    ctx.stroke();
    // props under the newest slab
    if (s > 3) {
      ctx.strokeStyle = steel; ctx.beginPath(); for (let x = fx0 + 1; x < fx1 - bw; x += 1) { ctx.moveTo(x, (lv - 1) * fh); ctx.lineTo(x, topY - 0.3); } ctx.stroke();
      if (s > 12) { ctx.fillStyle = steel; for (let x = fx0 + 1; x < fx1 - bw; x += 1) { ctx.fillRect(x - 0.07, (lv - 1) * fh + 1.5, 0.14, 0.09); ctx.fillRect(x - 0.12, (lv - 1) * fh, 0.24, 0.04); ctx.fillRect(x - 0.12, topY - 0.34, 0.24, 0.04); } }
    }
    // a string of work lights under each slab when the upper floors are in use
    if (o.upperLit && s > 2.5) {
      const bulb = Math.max(0.07, env.px * 0.9);
      ctx.strokeStyle = dark; ctx.lineWidth = Math.max(0.025, env.px * 0.5); ctx.beginPath();
      for (let l = 1; l < lv; l++) { const yy = (l + 1) * fh - 0.34; for (let x = fx0 + 0.3; x < coreX - 1; x += 2) { ctx.moveTo(x, yy); ctx.quadraticCurveTo(x + 1, yy - 0.34, x + 2, yy); } }
      ctx.stroke();
      if (s > 5) for (let l = 1; l < lv; l++) { const yy = (l + 1) * fh - 0.52; for (let x = fx0 + 1.3; x < coreX - 0.5; x += 2) if (x > env.x0 - 1 && x < env.x1 + 1) twGlow(ctx, x, yy - 0.2, 1.1, '#ffd9a0', 0.32); }
      ctx.fillStyle = '#ffe9b8'; ctx.beginPath();
      for (let l = 1; l < lv; l++) { const yy = (l + 1) * fh - 0.52; for (let x = fx0 + 1.3; x < coreX - 0.5; x += 2) { ctx.moveTo(x + bulb, yy); ctx.arc(x, yy, bulb, 0, TAU); } }
      ctx.fill();
      // and a work light on a stand on the top deck
      line(ctx, fx0 + 6, topY, fx0 + 6, topY + 2.1, dark, 0.07, env); R4(ctx, fx0 + 5.78, topY + 2.1, 0.44, 0.26, '#ffe9b8'); twGlow(ctx, fx0 + 6, topY + 2.2, 2.2, '#ffd9a0', 0.3);
    }
    // the floodlights catching the dust in the air and the nearest concrete
    for (let i = 0; i < Z.lamps.length; i++) { const lp = Z.lamps[i]; if (lp.alive && lp.on !== false) twGlowE(ctx, lp.x, lp.y - 0.9, lp.reach * 0.6, lp.reach * 0.45, '#ffd9a0', 0.16); }
  } });
  for (let l = 1; l <= lv; l++) P.solid(fx0 - 0.2, l * fh - 0.3, fx1 - fx0 + 0.4, 0.3, 'hard');
  for (let i = 0; i <= nb; i++) P.solid(fx0 + i * bw - 0.2, 0, 0.4, topY, 'hard');
  P.solid(fx1 - bw + 0.9, 0, bw - 1.8, topY + 1.2, 'hard');
  // edge barriers on every open floor, drawn in front of whoever stands there
  P.add({ x0: fx0, x1: fx1, layer: 2, draw(ctx, env) {
    ctx.strokeStyle = orange; ctx.lineWidth = Math.max(0.05, env.px * 0.8); ctx.beginPath();
    for (let l = 1; l <= lv; l++) { ctx.moveTo(fx0, l * fh + 1.0); ctx.lineTo(fx1 - bw + 0.9, l * fh + 1.0); ctx.moveTo(fx0, l * fh + 0.5); ctx.lineTo(fx1 - bw + 0.9, l * fh + 0.5); }
    ctx.stroke();
    if (env.s > 7) { ctx.lineWidth = Math.max(0.035, env.px * 0.6); ctx.beginPath(); for (let l = 1; l <= lv; l++) for (let x = fx0 + 2; x < coreX; x += 2) { ctx.moveTo(x, l * fh); ctx.lineTo(x, l * fh + 1.03); } ctx.stroke(); }
  } });
  // scaffolding on the left face: tubes, couplers, boards, ladders, and debris netting higher up
  P.add({ x0: sx0 - 0.6, x1: sx1 + 0.3, layer: 2, draw(ctx, env) {
    const s = env.s, mid = (sx0 + sx1) / 2;
    ctx.strokeStyle = steel; ctx.lineWidth = Math.max(0.05, env.px * 0.8); ctx.beginPath();
    for (const x of [sx0, mid, sx1]) { ctx.moveTo(x, 0); ctx.lineTo(x, topY + 1.6); }
    for (let l = 0; l <= lv; l++) { ctx.moveTo(sx0, l * fh + 1.05); ctx.lineTo(sx1, l * fh + 1.05); }
    for (let l = 0; l < lv; l++) { ctx.moveTo(sx0, l * fh); ctx.lineTo(sx1, (l + 1) * fh); }
    ctx.stroke();
    if (s > 8) {
      // a lower rail, ladders from deck to deck, and ties back to the frame
      ctx.lineWidth = Math.max(0.03, env.px * 0.55); ctx.beginPath();
      for (let l = 0; l <= lv; l++) { ctx.moveTo(sx0, l * fh + 0.55); ctx.lineTo(sx1, l * fh + 0.55); ctx.moveTo(sx1, l * fh + 2.2); ctx.lineTo(sx1 + 0.25, l * fh + 2.2); }
      for (let l = 0; l < lv; l++) {
        const lx = l % 2 ? mid + 0.2 : sx0 + 0.2, y0 = l * fh, y1 = (l + 1) * fh + 0.9;
        ctx.moveTo(lx, y0); ctx.lineTo(lx + 0.75, y1); ctx.moveTo(lx + 0.34, y0); ctx.lineTo(lx + 1.09, y1);
        if (s > 14) for (let k = 1; k < 14; k++) { const u = k / 14; ctx.moveTo(lx + 0.75 * u, y0 + (y1 - y0) * u); ctx.lineTo(lx + 0.34 + 0.75 * u, y0 + (y1 - y0) * u); }
      }
      ctx.stroke();
    }
    for (let l = 1; l <= lv; l++) R4(ctx, sx0 - 0.1, l * fh - 0.08, sx1 - sx0 + 0.2, 0.1, wood);
    if (s > 9) for (let l = 1; l <= lv; l++) R4(ctx, sx0, l * fh, sx1 - sx0, 0.14, woodC[0]);                                                          // toe boards
    if (s > 13) {
      // couplers where tube meets tube, and base plates on timber
      ctx.fillStyle = S.tone('#c9a24a', P, li > 0);
      for (const x of [sx0, mid, sx1]) for (let l = 0; l <= lv; l++) { ctx.fillRect(x - 0.07, l * fh + 0.99, 0.14, 0.12); if (l < lv) ctx.fillRect(x - 0.07, l * fh + 0.49, 0.14, 0.12); }
      ctx.fillStyle = wood; for (const x of [sx0, mid, sx1]) ctx.fillRect(x - 0.22, 0, 0.44, 0.06);
      R4(ctx, sx0 + 0.06, 1.3, 0.2, 0.3, S.tone('#3f9a5a', P, li > 0));                                                                               // the inspection tag
    }
    // debris netting on the upper lifts
    const ny = 2 * fh + 1.1, nh = topY - 2 * fh + 0.5;
    ctx.globalAlpha = 0.3; R4(ctx, sx0, ny, sx1 - sx0, nh, net); ctx.globalAlpha = 1;
    if (s > 9) {
      ctx.strokeStyle = netD; ctx.globalAlpha = 0.5; ctx.lineWidth = Math.max(0.02, env.px * 0.45); ctx.beginPath();
      for (let xx = sx0 + 0.26; xx < sx1; xx += 0.26) { ctx.moveTo(xx, ny); ctx.lineTo(xx, ny + nh); }
      for (let yy = ny + 0.26; yy < ny + nh; yy += 0.26) { ctx.moveTo(sx0, yy); ctx.lineTo(sx1, yy); }
      ctx.stroke(); ctx.globalAlpha = 1;
      R4(ctx, sx0, ny + nh - 0.07, sx1 - sx0, 0.07, netD); R4(ctx, sx0, ny, sx1 - sx0, 0.06, netD);
    }
    // a gin wheel and rope at the top for hauling buckets
    if (s > 6) { line(ctx, sx0, topY + 1.5, sx0 - 0.5, topY + 1.5, steel, 0.06, env); circ(ctx, sx0 - 0.45, topY + 1.38, 0.13, dark); line(ctx, sx0 - 0.45, topY + 1.3, sx0 - 0.45, 3.2, dark, 0.025, null); R4(ctx, sx0 - 0.6, 2.9, 0.3, 0.3, dark); }
  } });
  for (let l = 1; l <= lv; l++) P.solid(sx0 - 0.1, l * fh - 0.08, sx1 - sx0 + 0.2, 0.08, 'wood');
  Z.scaf = { x0: sx0, x1: sx1 };
  // cabin, pallets, and what else a site leaves lying about
  const cabX = o.cabX === undefined ? fx0 + bw + 0.6 : o.cabX;
  Z.cabX = cabX;
  P.add({ x0: Z.yard0 - 4, x1: hx1 + 1, layer: 0, draw(ctx, env) {
    const s = env.s, cab = cabC[li], cabD = cabDC[li], cabDoor = S.tone('#3a4048', P), lit = S.tone('#ffe2b4', P, true);
    // the site office: a steel cabin on blocks
    R4(ctx, cabX + 0.3, 0, 0.5, 0.25, concD); R4(ctx, cabX + 4.8, 0, 0.5, 0.25, concD);
    R4(ctx, cabX, 0.25, 5.6, 2.5, cab); R4(ctx, cabX, 2.6, 5.6, 0.15, concD); R4(ctx, cabX, 0.25, 5.6, 0.1, cabD);
    if (s > 9) { ctx.fillStyle = cabD; for (let xx = cabX + 0.28; xx < cabX + 5.5; xx += 0.28) ctx.fillRect(xx, 0.35, 0.035, 2.25); }
    R4(ctx, cabX + 0.42, 0.25, 1.11, 2.13, cabD); R4(ctx, cabX + 0.5, 0.25, 0.95, 2.05, cabDoor);
    if (s > 8) { R4(ctx, cabX + 0.68, 1.45, 0.5, 0.55, S.tone('#56606e', P)); R4(ctx, cabX + 1.3, 1.2, 0.07, 0.14, cabD); R4(ctx, cabX + 0.35, 0, 1.25, 0.12, concD); R4(ctx, cabX + 0.45, 0.12, 1.05, 0.13, concD); }
    R4(ctx, cabX + 2.12, 1.12, 2.76, 1.21, cabD); R4(ctx, cabX + 2.2, 1.2, 2.6, 1.05, lit); R4(ctx, cabX + 3.45, 1.2, 0.08, 1.05, concD);
    if (s > 8) {   // what shows through the window: a blind half down, a desk lamp, a wall chart
      R4(ctx, cabX + 2.2, 1.9, 1.25, 0.35, S.tone('#d8d2c2', P, true)); R4(ctx, cabX + 3.75, 1.75, 0.7, 0.4, S.tone('#d6c8a8', P, true));
      R4(ctx, cabX + 2.5, 1.2, 0.5, 0.3, S.tone('#8a7458', P, true)); R4(ctx, cabX + 4.2, 1.2, 0.05, 0.3, S.tone('#5a4a3a', P, true)); poly(ctx, [cabX + 4.08, 1.48, cabX + 4.37, 1.48, cabX + 4.3, 1.64, cabX + 4.15, 1.64], S.tone('#f6efdc', P, true));
      twGlowE(ctx, cabX + 3.5, 1.7, 2.4, 1.4, '#ffd9a0', 0.16);
      R4(ctx, cabX + 1.72, 1.25, 0.3, 0.42, S.tone('#e9e4d6', P, li > 0)); R4(ctx, cabX + 1.76, 1.5, 0.22, 0.04, dark); R4(ctx, cabX + 1.76, 1.4, 0.16, 0.03, dark);   // notices by the door
      R4(ctx, cabX + 0.05, 2.5, 0.12, 0.1, dark); R4(ctx, cabX + 5.43, 2.5, 0.12, 0.1, dark);
    }
    env.text(ctx, 'SITE OFFICE', cabX + 2.8, 0.55, 0.36, S.tone('#2a2e36', P), 'center');
    for (const px of (o.pallets || [Z.yard0 + 1.6, Z.yard0 + 4.4])) {
      R4(ctx, px - 1.1, 0, 2.2, 0.16, wood); if (s > 12) { R4(ctx, px - 1.1, 0.05, 2.2, 0.05, dark); }
      for (let i = 0; i < 3; i++) {
        const bh = 0.85 + (i % 2) * 0.3, bc2 = S.tone(i % 2 ? '#b9a27e' : '#8f949a', P), bx = px - 1.0 + i * 0.68;
        R4(ctx, bx, 0.16, 0.6, bh, bc2);
        if (s > 10) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; for (let yy = 0.16 + 0.2; yy < 0.16 + bh - 0.02; yy += 0.2) ctx.fillRect(bx, yy, 0.6, 0.025); ctx.fillRect(bx + 0.29, 0.16, 0.025, bh); R4(ctx, bx, 0.16 + bh * 0.45, 0.6, 0.05, S.tone('#2a2e36', P)); }
      }
    }
    // rebar on bearers at the open end of the yard, and a couple of cones
    if (s > 4) {
      const rx = Z.yard0 - 2.2, rust = rustC[li];
      R4(ctx, rx + 0.3, 0, 0.16, 0.1, wood); R4(ctx, rx + 1.6, 0, 0.16, 0.1, wood);
      for (let k = 0; k < 4; k++) R4(ctx, rx + (k % 2) * 0.12, 0.1 + k * 0.045, 2.5 - (k % 3) * 0.2, 0.035, rust);
      if (s > 12) { R4(ctx, rx + 0.7, 0.09, 0.03, 0.2, dark); R4(ctx, rx + 1.9, 0.09, 0.03, 0.2, dark); }
      for (const cx of [Z.yard0 - 3.0, hx1 + 0.5]) { poly(ctx, [cx - 0.17, 0.05, cx + 0.17, 0.05, cx + 0.04, 0.55, cx - 0.04, 0.55], orange); R4(ctx, cx - 0.22, 0, 0.44, 0.05, orange); if (s > 10) R4(ctx, cx - 0.1, 0.25, 0.2, 0.08, S.tone('#f1ede2', P, true)); }
    }
    // the generator at the far end, with its exhaust
    const gx = fx1 - 0.6;
    R4(ctx, gx, 0.12, 1.7, 0.95, genC[li]); R4(ctx, gx + 0.1, 0, 0.2, 0.12, dark); R4(ctx, gx + 1.4, 0, 0.2, 0.12, dark); R4(ctx, gx + 0.12, 0.3, 0.7, 0.6, dark);
    if (s > 9) { ctx.fillStyle = genC[li]; for (let k = 0; k < 4; k++) ctx.fillRect(gx + 0.17, 0.38 + k * 0.13, 0.6, 0.04); R4(ctx, gx + 1.05, 0.7, 0.4, 0.22, cabDoor); circ(ctx, gx + 1.15, 0.81, 0.04, '#52e07a'); R4(ctx, gx + 1.3, 1.07, 0.1, 0.3, dark); }
    for (let k = 0; k < 4; k++) { const u = (env.t * 0.3 + k / 4) % 1; twPuff(ctx, gx + 1.35 + env.wind * u * u * 1.2, 1.45 + u * 2.2, 0.3 + u * 0.9, 0.3 + u * 0.8, '#8b93a3', (1 - u) * Math.min(1, u * 5) * 0.25); }
    // the cables that feed the floodlights: slung overhead from the cabin, and along the ground from the generator
    ctx.strokeStyle = dark; ctx.lineWidth = Math.max(0.035, env.px * 0.6); ctx.beginPath();
    for (let i = 0; i < Z.lamps.length; i++) {
      const lp = Z.lamps[i], px = lampPosts[i], fromX = px < cabX ? cabX : cabX + 5.6;
      if (Math.abs(px - fromX) > 2.5) { const sag = Math.min(1.4, Math.abs(px - fromX) * 0.09); ctx.moveTo(fromX, 2.7); ctx.quadraticCurveTo((fromX + px) / 2, Math.min(2.7, lp.y - 2) - sag * 0.5 + 0.9, px, Math.max(3.2, lp.y - 2)); }
    }
    ctx.moveTo(cabX + 5.6, 2.2); ctx.quadraticCurveTo(cabX + 6.6, 0.1, cabX + 7.6, 0.08); ctx.lineTo(gx, 0.08); ctx.lineTo(gx + 0.1, 0.5);
    ctx.stroke();
  } });
  // mesh fence and the firm's board along the street side
  K.fence(S, P, Z.yard0 - 2.5, fx1 + 1.5, 2.0, { kind: 'mesh' });
  P.add({ x0: fx0 + 6, x1: fx0 + 13, layer: 2, draw(ctx, env) {
    R4(ctx, fx0 + 6.4, 0.5, 6, 1.5, S.tone('#e9e4d6', P, true)); R4(ctx, fx0 + 6.4, 0.5, 6, 0.28, orange);
    if (env.s > 8) { R4(ctx, fx0 + 6.4, 1.94, 6, 0.06, dark); R4(ctx, fx0 + 6.4, 0.5, 0.06, 1.5, dark); R4(ctx, fx0 + 12.34, 0.5, 0.06, 1.5, dark); R4(ctx, fx0 + 7.1, 0, 0.1, 0.5, dark); R4(ctx, fx0 + 11.7, 0, 0.1, 0.5, dark); }
    env.text(ctx, o.board || 'HALE & SONS', fx0 + 9.4, 1.05, 0.62, S.tone('#1c2430', P, true), 'center');
    env.text(ctx, 'BUILDING CALDER SINCE 1921', fx0 + 9.4, 0.84, 0.17, S.tone('#1c2430', P, true), 'center');
  } });
  // floodlights
  (o.lamps === undefined ? [[Z.yard0 + 0.5, 8.5, 1.2, 12], [fx0 + 9.5, 3.15, 0, 9]] : o.lamps).forEach((l, i) => { lampPosts.push(l[0]); Z.lamps.push(K.lamp(S, P, l[0], l[1], 'site', { id: 'sl' + (i + 1), reach: l[3] || 11, arm: l[2] })); });
  if (o.upperLit) for (let l = 1; l <= lv; l++) S.litZones['site' + l] = true;
  // the load on the crane
  if (o.girder !== false) {
    Z.gx = o.gx === undefined ? fx0 - 5.5 : o.gx;
    Z.hook = K.hang(S, P, Z.gx, o.hookY || 12.4, 'girder', { id: 'hook', top: craneH, floor: 0 });
    // a load slung over a working site at night carries lights: paint it so it can be found in the dark
    const hk = Z.hook, pr = hk.prop, drawHook = hk.draw, oxide = S.tone('#c0563c', P, true), oxide2 = S.tone('#8a3b2a', P, true), oxide3 = S.tone('#d97a5c', P, true), yel = S.tone('#f2c230', P, true);
    hk.draw = (ctx, env) => {
      drawHook(ctx, env);
      if (hk.alive) { R4(ctx, hk.x - 0.24, hk.y - 0.26, 0.48, 0.52, yel); R4(ctx, hk.x - 0.1, hk.y - 0.12, 0.2, 0.24, dark); twGlow(ctx, hk.x, hk.y, 1.1, '#f2c230', 0.28); }
    };
    P.add({ x0: Z.gx - 4, x1: Z.gx + 4, layer: 2, draw(ctx, env) {
      const x = pr.x - pr.w / 2;
      // an I-beam seen from the side: two flanges and the web between them
      R4(ctx, x, pr.y, pr.w, pr.h, oxide); R4(ctx, x, pr.y + pr.h * 0.28, pr.w, pr.h * 0.44, oxide2);
      if (env.s > 9) { R4(ctx, x, pr.y + pr.h - 0.05, pr.w, 0.05, oxide3); R4(ctx, x + pr.w * 0.5 - 0.04, pr.y + pr.h * 0.28, 0.08, pr.h * 0.44, oxide); }
      if (env.s > 18) { ctx.fillStyle = dark; for (const u of [0.08, 0.14, 0.86, 0.92]) for (const vv of [0.38, 0.6]) ctx.fillRect(x + pr.w * u, pr.y + pr.h * vv, 0.05, 0.05); }
      if (!pr.landed) { const b = Math.pow(Math.max(0, Math.sin(env.t * 5)), 0.6), r = Math.max(0.1, env.px); if (b > 0.02) { circ(ctx, x + 0.12, pr.y + pr.h / 2, r, rgba('#ff3b30', b)); circ(ctx, x + pr.w - 0.12, pr.y + pr.h / 2, r, rgba('#ff3b30', b)); } }
    } });
    // the trolley on the jib that the hoist rope hangs from
    P.add({ x0: Z.gx - 2, x1: Z.gx + 2, layer: 0, draw(ctx, env) { R4(ctx, Z.gx - 0.7, craneH - 0.42, 1.4, 0.42, dark); circ(ctx, Z.gx - 0.45, craneH + 0.02, 0.14, dark); circ(ctx, Z.gx + 0.45, craneH + 0.02, 0.14, dark); if (env.s > 8) R4(ctx, Z.gx - 0.18, craneH - 0.62, 0.36, 0.2, steelC[1]); } });
  }
  // red lights on the tip of the jib and the top of the mast
  P.add({ x0: craneX - reach - 2, x1: craneX + 2, layer: 2, draw(ctx, env) { twBeacon(ctx, env, craneX - reach, craneH + 1.6, 2.1); twBeacon(ctx, env, craneX, craneH + 5.2, 0.4); twBeacon(ctx, env, craneX - reach * 0.5, craneH + 1.6, 3.4); } });
  Z.levelY = (l) => l * fh;
  return Z;
};

// ---- a helicopter (a vehicle kind, so it flies on a routine like any car) ----------
CARS.twheli = { len: 12, h: 3.8, body: 3.8, cab: [-0.5, 0.5], win: [], seats: [], wheel: 0, solid: true,
  draw(ctx, env, S, P, x, y, dir, colHex) {
    const c = S.tone(colHex || '#7f8b9a', P, true), c2 = S.tone('#4a5562', P, true), c3 = S.tone(darken(colHex || '#7f8b9a', 0.3), P, true), stripe = S.tone('#e9eef4', P, true), t = env.t, s = env.s;
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    // searchlight: three cones one inside the other, so its edges are soft
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const sw = Math.sin(t * 0.9) * 9 + 6, g = ctx.createLinearGradient(0, 0.6, 0, -46);
    g.addColorStop(0, 'rgba(210,230,255,0.17)'); g.addColorStop(1, 'rgba(210,230,255,0)');
    ctx.fillStyle = g;
    for (const wd of [5.5, 3.7, 2.0]) { ctx.beginPath(); ctx.moveTo(1.5 - wd * 0.04, 0.9); ctx.lineTo(1.5 + wd * 0.04, 0.9); ctx.lineTo(sw + wd, -46); ctx.lineTo(sw - wd, -46); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    twGlow(ctx, 1.5, 0.75, 1.3, '#d2e6ff', 0.5);
    poly(ctx, [-1.4, 2.2, -6.6, 2.75, -6.6, 2.4, -1.4, 1.2], c);                                  // tail boom
    poly(ctx, [-5.8, 2.5, -6.9, 4.1, -6.3, 4.1, -5.2, 2.6], c);                                   // fin
    poly(ctx, [-6.1, 2.42, -6.9, 2.3, -6.9, 2.52, -6.1, 2.64], c3);                               // tail plane
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0.3, 1.75, 2.7, 1.3, 0, 0, TAU); ctx.fill();   // cabin
    poly(ctx, [-1.5, 2.55, -0.9, 3.15, 1.2, 3.15, 1.7, 2.7], c3);                                 // engine cowl
    ctx.fillStyle = S.tone('#bfe0ff', P, true); ctx.beginPath(); ctx.ellipse(1.75, 1.85, 1.0, 0.8, 0, -1.2, 1.5); ctx.fill();
    if (s > 5) {
      R4(ctx, -1.3, 1.5, 2.3, 0.14, stripe); R4(ctx, -0.55, 1.75, 0.9, 0.62, S.tone('#9fc4e6', P, true)); R4(ctx, -0.1, 1.75, 0.05, 0.62, c);   // stripe and door window
      R4(ctx, 1.62, 1.2, 0.05, 1.35, c); R4(ctx, -1.75, 2.75, 0.5, 0.2, c2);                                                               // windscreen post, exhaust
    }
    line(ctx, -1.6, 0.25, 2.2, 0.25, c2, 0.12, env); line(ctx, -0.8, 0.25, -0.5, 0.7, c2, 0.1, env); line(ctx, 1.3, 0.25, 1.0, 0.7, c2, 0.1, env);   // skids
    line(ctx, 2.2, 0.25, 2.5, 0.42, c2, 0.1, env);
    line(ctx, 0.3, 3.0, 0.3, 3.5, c2, 0.16, env); R4(ctx, 0.05, 3.42, 0.5, 0.14, c2);
    // main rotor: a faint disc with the blades smeared across it
    ctx.fillStyle = 'rgba(200,212,226,0.14)'; ctx.beginPath(); ctx.ellipse(0.3, 3.5, 5.7, Math.max(0.14, env.px * 1.2), 0, 0, TAU); ctx.fill();
    const rw = 5.6 * (0.55 + 0.45 * Math.abs(Math.sin(t * 31))), rw2 = 5.6 * (0.55 + 0.45 * Math.abs(Math.sin(t * 31 + 1.6)));
    ctx.globalAlpha = 0.5; R4(ctx, 0.3 - rw, 3.45, rw * 2, Math.max(0.08, env.px), S.tone('#c9d2dc', P)); ctx.globalAlpha = 0.25; R4(ctx, 0.3 - rw2, 3.49, rw2 * 2, Math.max(0.06, env.px * 0.8), S.tone('#c9d2dc', P)); ctx.globalAlpha = 1;
    // tail rotor
    circ(ctx, -6.6, 3.3, 0.78, 'rgba(200,210,222,0.13)');
    { const an = t * 43; ctx.strokeStyle = 'rgba(210,220,232,0.45)'; ctx.lineWidth = Math.max(0.07, env.px * 0.8); ctx.beginPath(); ctx.moveTo(-6.6 - Math.cos(an) * 0.75, 3.3 - Math.sin(an) * 0.75); ctx.lineTo(-6.6 + Math.cos(an) * 0.75, 3.3 + Math.sin(an) * 0.75); ctx.stroke(); }
    // lights: a red flasher on the fin, a white strobe under the belly, a steady green one on the nose
    const lr = Math.max(0.14, env.px), f1 = Math.pow(Math.max(0, Math.sin(t * 7)), 2), f2 = Math.pow(Math.max(0, Math.sin(t * 7 + 2)), 4);
    circ(ctx, -6.5, 2.6, lr, rgba('#ff3b30', 0.25 + 0.75 * f1)); twGlow(ctx, -6.5, 2.6, 1.6, '#ff3b30', 0.5 * f1);
    circ(ctx, 0.2, 0.55, lr, rgba('#f4f7ff', 0.2 + 0.8 * f2)); twGlow(ctx, 0.2, 0.55, 2.0, '#f4f7ff', 0.55 * f2);
    circ(ctx, 2.6, 1.3, Math.max(0.12, env.px), '#4dff88'); twGlow(ctx, 2.6, 1.3, 0.9, '#4dff88', 0.35);
    ctx.restore();
  } };

// ---- the location -----------------------------------------------------------------
// o.focus says which part the mission is about, and o.range how far away that
// part is: 'office' or 'roof' (the Aurel tower), 'terrace' (the Meridian's
// rooftop bar), 'site', 'street' (the pavement under the towers), 'flat' or
// 'near' (the apartment block and the near pavement).
SCN.towers = function (o) {
  o = o || {};
  const OFF = { office: 0, roof: 0, terrace: 34, site: -4, street: -9, road: -17, flat: -44, near: -44 };
  const focus = o.focus || 'office', off = OFF[focus] || 0;
  const z0 = o.z !== undefined ? o.z : (o.range || 350) - off, refZ = z0 + off;
  const seed = o.seed || 4, eyeY = o.eyeY || 30;
  const S = makeScene({ time: 'night', weather: o.weather, seed, refZ, exits: [-64, 64], ambience: 'city', groundMat: 'hard',
    bounds: { x0: (-50 * refZ) / (z0 - 44) - 3, x1: (50 * refZ) / (z0 - 4) + 3, y0: -2, y1: 60 } });
  const H = { S, z0, refZ, focus };
  const DS = makeRng(seed * 389 + 77), wet = S.weather === 'rain' || S.weather === 'storm';   // decoration only

  // far away: the rest of the city
  K.skyline(S, z0 + 1500, { seed: 31 + seed, hMin: 70, hMax: 250, cols: ['#566478', '#5f6d82', '#4a586c'] });
  K.skyline(S, z0 + 560, { seed: 17 + seed, hMin: 16, hMax: 30, x0: -700, x1: 700, cols: ['#465264', '#4e5a6c', '#3c4858'] });
  // fireworks over the harbour (drawn only while they are going off)
  const PW = S.plane(z0 + 400, 'fireworks'); H.fw = null;
  // on the same plane: banks of low cloud drifting over the far rooftops
  const clouds = [];
  for (let i = 0; i < 3; i++) clouds.push([DS.r(-520, 520), DS.r(60, 120), DS.r(90, 140), DS.r(5, 9), DS.r(0.6, 1.4)]);
  PW.add({ x0: -4000, x1: 4000, layer: 0, draw(ctx, env) {
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i]; let cx = c[0] + env.t * (0.8 + env.wind * 0.45) * c[4]; cx = (((cx + 520) % 1040) + 1040) % 1040 - 520;
      if (cx + c[2] < env.x0 || cx - c[2] > env.x1 || c[1] - c[3] > env.y1 || c[1] + c[3] < env.y0) continue;
      twPuff(ctx, cx, c[1], c[2], c[3], '#3a4a7e', 0.5);
    }
  } });
  const fwCols = ['#ffd27a', '#ff6f91', '#7fd4ff', '#b8ff8a', '#ffffff', '#ff9a4d'];
  PW.add({ x0: -400, x1: 400, layer: 0, draw(ctx, env) {
    const F = H.fw; if (!F || env.t > F.until + 1.8) return;
    const zz = z0 + 400;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const k1 = Math.floor((env.t - F.t0) / 0.8);
    for (let k = Math.max(0, k1 - 3); k <= k1; k++) {
      const born = F.t0 + k * 0.8; if (born > F.until) continue;
      const u = (env.t - born) / 2.2; if (u < 0 || u > 1) continue;
      const hx = Math.sin(k * 12.9898 + 4.1) * 43758.5453, r1 = hx - Math.floor(hx), hy = Math.sin(k * 78.233 + 1.3) * 12543.117, r2 = hy - Math.floor(hy);
      const bx = ((F.x0 + r1 * (F.x1 - F.x0)) / 1000) * zz, by = eyeY + ((F.y0 + r2 * (F.y1 - F.y0)) / 1000) * zz, col = fwCols[k % fwCols.length], col2 = fwCols[(k + 3) % fwCols.length];
      const R0 = (12 + (k % 3) * 5) * (zz / 700), rad = R0 * easeOut(Math.min(1, u * 1.6)), fall = u * u * R0 * 0.5, al = u < 0.55 ? 1 : (1 - u) / 0.45, nR = 20;
      if (u < 0.16) twGlow(ctx, bx, by, R0 * 1.5, col, 0.6 * (1 - u / 0.16));
      twGlow(ctx, bx, by - fall * 0.5, R0 * 2.2, col, 0.16 * al);                                   // the burst lighting the haze around it
      for (let ring = 0; ring < 2; ring++) {
        const rr = ring ? rad * 0.55 : rad, n2 = ring ? 10 : nR, cc = ring ? col2 : col;
        ctx.strokeStyle = rgba(cc, 0.6 * al); ctx.lineWidth = Math.max(0.2, env.px * 1.1);
        ctx.beginPath();
        for (let i = 0; i < n2; i++) { const an = (i / n2) * TAU + k * 0.7 + ring * 0.3, jq = Math.sin(i * 7.31 + k * 3.7) * 99.1, jt = 0.84 + 0.16 * (jq - Math.floor(jq)); ctx.moveTo(bx + Math.cos(an) * rr * jt * 0.7, by + Math.sin(an) * rr * jt * 0.7 - fall * 0.6); ctx.lineTo(bx + Math.cos(an) * rr * jt, by + Math.sin(an) * rr * jt - fall); }
        ctx.stroke();
        ctx.fillStyle = rgba(ring ? cc : '#ffffff', al * (0.7 + 0.3 * Math.sin(env.t * 30 + k)));
        for (let i = 0; i < n2; i++) { const an = (i / n2) * TAU + k * 0.7 + ring * 0.3, jq = Math.sin(i * 7.31 + k * 3.7) * 99.1, jt = 0.84 + 0.16 * (jq - Math.floor(jq)); ctx.beginPath(); ctx.arc(bx + Math.cos(an) * rr * jt, by + Math.sin(an) * rr * jt - fall, Math.max(0.3, env.px * 1.3), 0, TAU); ctx.fill(); }
      }
    }
    ctx.restore();
  } });
  // start a display: sets the sky going and covers loud shots for as long as it lasts
  H.fireworks = (sim, dur, where) => { H.fw = Object.assign({ t0: sim.t, until: sim.t + dur, x0: -150, x1: -15, y0: 52, y1: 96 }, where || {}); sim.cover(dur, 'fireworks'); };

  // the big towers a block behind
  const PG = K.twBackTowers(S, z0 + 150, { seed: 40 + seed, towers: o.backTowers || [
    { x: -150, w: 30, h: 86, top: 'step' }, { x: -112, w: 24, h: 64 }, { x: -66, w: 27, h: 108, top: 'slant', strip: '#ff5a8a' },
    { x: -1.5, w: 8.5, h: 132, top: 'needle', strip: '#5fd4ff' }, { x: 56, w: 26, h: 92, top: 'step', strip: '#ffb347' }, { x: 88, w: 22, h: 70 }, { x: 116, w: 30, h: 118, top: 'slant' },
  ] });
  H.PG = PG;
  // the helicopter's lane, between the back towers and the Meridian. Thin mist drifts along it.
  H.PH = S.plane(z0 + 92, 'air');
  const wisps = [];
  for (let i = 0; i < 5; i++) wisps.push([DS.r(-160, 160), DS.r(14, 78), DS.r(18, 34), DS.r(2.5, 5), DS.r(0.6, 1.5)]);
  H.PH.add({ x0: -4000, x1: 4000, layer: 0, draw(ctx, env) {
    for (let i = 0; i < wisps.length; i++) {
      const c = wisps[i]; let cx = c[0] + env.t * (0.5 + env.wind * 0.35) * c[4]; cx = (((cx + 180) % 360) + 360) % 360 - 180;
      if (cx + c[2] < env.x0 || cx - c[2] > env.x1 || c[1] - c[3] > env.y1 || c[1] + c[3] < env.y0) continue;
      twPuff(ctx, cx, c[1], c[2], c[3], '#3f5288', 0.3);
    }
  } });

  // ---- the Meridian: a hotel with a rooftop bar, and its lift tower ----
  const PB = S.plane(z0 + 34, 'meridian'); H.PB = PB;
  K.ground(S, PB, { col: '#2a3040', noEdge: true });
  const coreB = { x: 28, w: 6.5, h: 44 };
  // the light of the sign and the bar in the damp air behind them
  PB.add({ x0: coreB.x - 6, x1: coreB.x + coreB.w + 6, layer: 0, draw(ctx, env) {
    twGlowE(ctx, coreB.x + coreB.w / 2, coreB.h - 2.6, 8.5, 4.2, '#ff5a8a', 0.16);
  } });
  const ob = o.B || {};
  const B = K.twTower(S, PB, { x: 7, w: 21, floors: 9, id: 'B', cols: 6, wall: '#1d2c2e', frame: '#44605c', edge: '#ffb86b', litAll: 'each', lit: Object.assign({ 0: true }, ob.lit || {}), tint: Object.assign({ 0: '#ffd9a0' }, ob.tint || {}),
    wins: ob.wins, bays: ob.bays, parapet: 0, seed: seed * 3 + 2, lobby: ['palm', 'front', 'bags', 'front', 'sofa', 'lift'] });
  H.B = B;
  K.box(S, PB, coreB.x, 0, coreB.w, coreB.h, '#232c36', { mat: 'wall' });
  PB.add({ x0: coreB.x - 1, x1: coreB.x + coreB.w + 1, layer: 0, draw(ctx, env) {
    const s = env.s, cx0 = coreB.x, lit = S.tone('#ffd9a0', PB, true), dk = S.tone('#141a22', PB), seam = S.tone('#19212a', PB), hi = S.tone('#323d49', PB), unit = S.tone('#56606e', PB);
    // concrete panels
    if (s > 5) { ctx.fillStyle = seam; for (let yy = 3.6; yy < coreB.h - 1; yy += 3.6) ctx.fillRect(cx0, yy - 0.03, coreB.w, 0.06); ctx.fillRect(cx0 + 2.95, 0, 0.05, B.roofY - 0.3); R4(ctx, cx0, 0, 0.08, coreB.h, hi); }
    // the lift: a strip of glass with the car riding up and down inside it (it stops below the terrace)
    R4(ctx, cx0 + 3.35, 1.2, 1.0, B.roofY - 2.6, dk);
    { const cy = 1.5 + (B.roofY - 6.4) * smooth(0.5 - 0.5 * Math.cos(env.t * 0.11)); R4(ctx, cx0 + 3.42, cy, 0.86, 2.3, lit); R4(ctx, cx0 + 3.42, cy + 1.0, 0.86, 0.05, dk); twGlowE(ctx, cx0 + 3.85, cy + 1.15, 1.6, 2.0, '#ffd9a0', 0.15); if (s > 6) line(ctx, cx0 + 3.85, cy + 2.3, cx0 + 3.85, B.roofY - 1.4, seam, 0.03, null); }
    for (let f = 1; f < 12; f++) R4(ctx, cx0 + 4.6, f * 3.6 + 0.8, 0.7, 1.9, (f * 7 + seed) % 3 === 0 ? lit : dk);
    // the door onto the terrace
    R4(ctx, cx0 + 0.42, B.roofY, 1.66, 2.43, dk);
    R4(ctx, cx0 + 0.5, B.roofY, 1.5, 2.35, lit); R4(ctx, cx0 + 0.5, B.roofY, 1.5, 2.35, 'rgba(0,0,0,0.25)'); R4(ctx, cx0 + 1.22, B.roofY, 0.06, 2.35, dk);
    if (s > 10) { R4(ctx, cx0 + 1.12, B.roofY + 0.95, 0.05, 0.3, dk); R4(ctx, cx0 + 1.33, B.roofY + 0.95, 0.05, 0.3, dk); R4(ctx, cx0 + 0.5, B.roofY + 1.9, 1.5, 0.05, dk); }
    twGlowE(ctx, cx0 + 1.25, B.roofY + 1.1, 2.3, 1.7, '#ffd9a0', 0.13);
    // the roof of the lift tower: cap, a pair of condensers, a rail, the mast
    R4(ctx, cx0, coreB.h, coreB.w, 0.5, S.tone('#39444f', PB));
    if (s > 4) {
      for (let k = 0; k < 2; k++) { R4(ctx, cx0 + 2.3 + k * 1.25, coreB.h + 0.5, 1.0, 0.8, unit); circ(ctx, cx0 + 2.8 + k * 1.25, coreB.h + 0.9, 0.28, dk); }
      ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.04, env.px * 0.6); ctx.beginPath(); ctx.moveTo(cx0 + 2.0, coreB.h + 1.6); ctx.lineTo(cx0 + coreB.w, coreB.h + 1.6); for (let xx = cx0 + 2.0; xx <= cx0 + coreB.w + 0.01; xx += 1.5) { ctx.moveTo(xx, coreB.h + 0.5); ctx.lineTo(xx, coreB.h + 1.6); } ctx.stroke();
    }
    line(ctx, cx0 + 5.2, coreB.h, cx0 + 5.2, coreB.h + 7, dk, 0.14, env); line(ctx, cx0 + 4.7, coreB.h + 5.4, cx0 + 5.7, coreB.h + 5.4, dk, 0.08, env);
    twBeacon(ctx, env, cx0 + 5.2, coreB.h + 7.2, 1.2);
  } });
  K.neon(S, PB, coreB.x + coreB.w / 2 - 0.4, coreB.h - 3.1, 'MERIDIAN', '#ff5a8a', 1.15);
  K.neon(S, PB, coreB.x + 1.25, B.roofY + 2.7, 'BAR', '#ffd27a', 0.6);
  H.coreB = coreB;
  H.terraceKit = K.twTerrace(S, PB, B, o.terrace || {});
  // the hotel's front door: an awning with lamps under it, and the lobby light lying on the pavement
  const keepB = {};
  PB.add({ x0: B.x, x1: B.x + B.w, layer: 0, draw(ctx, env) {
    if (!(S.rooms['B:f0'] && S.rooms['B:f0'].lit)) return;
    ctx.fillStyle = twGrad(keepB, ctx, 'sp', () => { const g = ctx.createLinearGradient(0, 0, 0, -1.5); g.addColorStop(0, 'rgba(255,214,150,0.3)'); g.addColorStop(1, 'rgba(255,214,150,0)'); return g; });
    ctx.fillRect(B.x, -1.5, B.w, 1.5);
  } });
  PB.add({ x0: B.x, x1: B.x + B.w, layer: 1, draw(ctx, env) {
    const ex = B.winX(2), s = env.s, aw = S.tone('#7a2438', PB, true), aw2 = S.tone('#e8dcc0', PB, true), br = S.tone('#c9a24a', PB, true);
    R4(ctx, ex - 2.1, 3.12, 4.2, 0.46, aw);
    if (s > 6) { ctx.fillStyle = aw2; for (let i = 0; i < 7; i += 2) ctx.fillRect(ex - 2.1 + i * 0.6, 3.12, 0.6, 0.46); ctx.fillStyle = aw; ctx.beginPath(); for (let i = 0; i < 7; i++) { ctx.moveTo(ex - 2.1 + i * 0.6, 3.13); ctx.arc(ex - 1.8 + i * 0.6, 3.13, 0.3, Math.PI, TAU); } ctx.fill(); }
    if (s > 4) { for (const dx of [-1.2, 0, 1.2]) { circ(ctx, ex + dx, 3.05, Math.max(0.06, env.px * 0.8), '#ffe9c8'); twGlow(ctx, ex + dx, 2.95, 0.55, '#ffd9a0', 0.3); } }
    if (s > 8) { R4(ctx, ex - 2.04, 0, 0.05, 3.12, br); R4(ctx, ex + 1.99, 0, 0.05, 3.12, br); R4(ctx, ex - 0.02, 0.12, 0.04, 2.5, 'rgba(210,225,240,0.5)'); R4(ctx, ex - 0.2, 1.05, 0.05, 0.4, br); R4(ctx, ex + 0.15, 1.05, 0.05, 0.4, br); }
  } });

  // ---- the Aurel tower ----
  const PA = S.plane(z0, 'aurel'); H.PA = PA;
  K.ground(S, PA, { col: '#2c3342', noEdge: true });
  const coreA = { x: -1, w: 3.4, h: 12 * 3.6 + 3.6 };
  PA.add({ x0: -5, x1: 8, layer: 0, draw(ctx, env) { twGlowE(ctx, coreA.x + 1.7, 12 * 3.6 - 3, 5, 8, '#5fd4ff', 0.13); } });   // the sign glowing in the air behind the core
  const oa = o.A || {};
  const A = K.twTower(S, PA, { x: -27, w: 26, floors: 12, id: 'A', cols: 7, lit: Object.assign({ 0: true, 3: [[0, 2, true], [3, 6, false]], 5: true, 7: true, 10: [[0, 3, false], [4, 6, true]] }, oa.lit || {}),
    tint: Object.assign({ 0: '#ffe2b4', 10: '#ffe9c8' }, oa.tint || {}), wins: oa.wins, bays: oa.bays, lamps: oa.lamps, parapet: 0.3, seed: seed * 5 + 1, lobby: ['seat', 'lift', 'gate', 'desk', 'gate', 'lift', 'seat'] });
  H.A = A;
  // the service core: lifts, risers, and the junction boxes. Its middle is left bare: that is where a mission hangs a junction box.
  K.box(S, PA, coreA.x, 0, coreA.w, coreA.h, '#27303b', { mat: 'wall' });
  PA.add({ x0: coreA.x - 1, x1: coreA.x + coreA.w + 1, layer: 0, draw(ctx, env) {
    const s = env.s, lit = S.tone('#d6e6ff', PA, true), dk = S.tone('#141a22', PA), pipe = S.tone('#4a5562', PA), seam = S.tone('#1c242d', PA), hi = S.tone('#36414d', PA);
    if (s > 5) { ctx.fillStyle = seam; for (let yy = 3.6; yy < coreA.h - 1; yy += 3.6) ctx.fillRect(coreA.x, yy - 0.03, coreA.w, 0.06); R4(ctx, coreA.x, 0, 0.07, coreA.h, hi); }
    R4(ctx, coreA.x + 2.75, 0, 0.22, coreA.h, pipe); R4(ctx, coreA.x + 3.05, 0, 0.14, coreA.h - 2, pipe);
    if (s > 10) { ctx.fillStyle = dk; for (let yy = 1.8; yy < coreA.h - 2; yy += 3.6) ctx.fillRect(coreA.x + 2.7, yy, 0.52, 0.07); }
    for (let f = 0; f < 12; f++) { const on = (f * 5 + seed) % 4 === 0; R4(ctx, coreA.x + 0.4, f * 3.6 + 0.9, 0.5, 1.8, on ? lit : dk); if (on && s > 6) twGlowE(ctx, coreA.x + 0.65, f * 3.6 + 1.8, 0.9, 1.5, '#d6e6ff', 0.12); }
    R4(ctx, coreA.x - 0.2, coreA.h, coreA.w + 0.4, 0.4, S.tone('#39444f', PA));
    if (s > 4) { ctx.fillStyle = dk; for (let i = 0; i < 6; i++) ctx.fillRect(coreA.x + 0.5, A.roofY + 0.9 + i * 0.36, 2.0, 0.14); }
    line(ctx, coreA.x + 1.7, coreA.h + 0.4, coreA.x + 1.7, coreA.h + 9, dk, 0.16, env); line(ctx, coreA.x + 1.0, coreA.h + 6, coreA.x + 2.4, coreA.h + 6, dk, 0.1, env);
    if (s > 4) { line(ctx, coreA.x + 0.6, coreA.h + 0.4, coreA.x + 0.6, coreA.h + 1.3, dk, 0.08, env); ctx.fillStyle = pipe; ctx.beginPath(); ctx.ellipse(coreA.x + 0.6, coreA.h + 1.5, 0.22, 0.5, -0.5, 0, TAU); ctx.fill(); line(ctx, coreA.x + 1.3, coreA.h + 4.2, coreA.x + 2.1, coreA.h + 4.2, dk, 0.07, env); }
    twBeacon(ctx, env, coreA.x + 1.7, coreA.h + 9.2, 0);
  } });
  PA.add({ x0: coreA.x, x1: coreA.x + coreA.w, layer: 1, draw(ctx, env) {
    const s = 'AUREL';
    for (let i = 0; i < s.length; i++) { const ly = A.roofY + 1.6 - i * 2.05; if (ly + 2 < env.y0 || ly - 1 > env.y1) continue; twGlow(ctx, coreA.x + 1.72, ly + 0.62, 1.7, '#5fd4ff', 0.3); env.text(ctx, s.charAt(i), coreA.x + 1.72, ly, 1.75, '#8fe1ff', 'center'); }
  } });
  H.coreA = coreA; H.coreX = coreA.x + 1.75;
  // the lobby light lying on the pavement outside
  const keepA = {};
  PA.add({ x0: -27, x1: -1, layer: 0, draw(ctx, env) {
    if (!(S.rooms['A:f0'] && S.rooms['A:f0'].lit)) return;
    ctx.fillStyle = twGrad(keepA, ctx, 'sp', () => { const g = ctx.createLinearGradient(0, 0, 0, -1.5); g.addColorStop(0, 'rgba(255,226,180,0.32)'); g.addColorStop(1, 'rgba(255,226,180,0)'); return g; });
    ctx.fillRect(-27, -1.5, 26, 1.5);
  } });
  // the lobby canopy, the firm's name over the doors, and a revolving door (all thin: the lobby guard sits behind it)
  PA.add({ x0: -27, x1: -1, layer: 1, draw(ctx, env) {
    const s = env.s, dx = A.winX(3), st = S.tone('#39444f', PA), stL = S.tone('#6c7885', PA);
    R4(ctx, -18.6, 3.25, 9.2, 0.28, st);
    if (s > 6) {
      R4(ctx, -18.6, 3.25, 9.2, 0.05, stL);
      ctx.strokeStyle = stL; ctx.lineWidth = Math.max(0.03, env.px * 0.5); ctx.beginPath(); for (const cx of [-18.2, -14, -9.8]) { ctx.moveTo(cx, 3.53); ctx.lineTo(cx, 3.72); } ctx.stroke();
      for (let cx = -17.6; cx < -9.5; cx += 1.8) { circ(ctx, cx, 3.22, Math.max(0.05, env.px * 0.7), '#fff3d6'); twGlow(ctx, cx, 3.1, 0.5, '#ffe2b4', 0.3); }
    }
    twGlowE(ctx, -14, 4.0, 4.4, 0.9, '#8fe1ff', 0.26);
    env.text(ctx, 'AUREL GROUP', -14, 3.75, 0.7, '#cfefff', 'center');
    if (s > 5) {
      // the drum of the door, and its four wings going round
      R4(ctx, dx - 1.3, 2.42, 2.6, 0.12, st);
      ctx.fillStyle = 'rgba(190,215,240,0.05)'; ctx.fillRect(dx - 1.25, 0.12, 2.5, 2.3);
      ctx.fillStyle = 'rgba(200,222,245,0.5)'; ctx.fillRect(dx - 1.27, 0.12, 0.045, 2.3); ctx.fillRect(dx + 1.225, 0.12, 0.045, 2.3);
      const th = env.t * 0.45;
      for (let k = 0; k < 4; k++) { const c = Math.cos(th + (k * Math.PI) / 2), sn = Math.sin(th + (k * Math.PI) / 2); ctx.fillStyle = 'rgba(205,225,245,' + (sn > 0 ? 0.42 : 0.16) + ')'; ctx.fillRect(dx + c * 1.18 - 0.018, 0.12, 0.036, 2.3); }
    }
  } });
  // the window-cleaning cradle
  if (o.cradle !== false) {
    const oc = o.cradle || {};
    H.PCR = S.plane(z0 - 1.5, 'cradle');
    H.cradleKit = K.twCradle(S, H.PCR, { x: oc.x === undefined ? A.winX(1) : oc.x, y: A.floorY(oc.floor === undefined ? 11 : oc.floor) + (oc.dy || 0), top: A.roofY + 0.3 });
    H.cradle = (dx, extra) => H.cradleKit.at(dx, extra);
  }
  // the roof of the Aurel tower on an ordinary night: plant room, cooling towers, the cradle's machine, masts
  if (!o.demo) {
    const by = A.roofY + 0.3;
    PA.add({ x0: -27, x1: -1, layer: 0, draw(ctx, env) {
      const s = env.s, c1 = S.tone('#3a4450', PA), c2 = S.tone('#28303a', PA), c3 = S.tone('#4c5866', PA);
      R4(ctx, -26.6, by, 25.4, 0.07, c2);                                                                             // the track the cradle's machine runs on
      R4(ctx, -25.2, by, 6.4, 2.6, c1); R4(ctx, -25.3, by + 2.6, 6.6, 0.16, c2);                                       // plant room
      if (s > 7) { ctx.fillStyle = c2; for (let k = 0; k < 6; k++) ctx.fillRect(-24.8, by + 0.55 + k * 0.3, 3.2, 0.1); R4(ctx, -20.5, by, 1.0, 2.1, c2); R4(ctx, -20.15, by + 2.2, 0.3, 0.1, '#ffe2b4'); twGlow(ctx, -20, by + 2.1, 1.1, '#ffd9a0', 0.25); }
      for (let k = 0; k < 2; k++) {                                                                                  // cooling towers, breathing
        const px = -16.6 + k * 3.7;
        R4(ctx, px + 0.2, by, 0.16, 0.45, c2); R4(ctx, px + 2.44, by, 0.16, 0.45, c2); R4(ctx, px, by + 0.45, 2.8, 2.1, c1); R4(ctx, px + 0.6, by + 2.55, 1.6, 0.7, c2); R4(ctx, px + 0.5, by + 3.2, 1.8, 0.1, c3);
        if (s > 7) { ctx.fillStyle = c2; for (let j = 0; j < 4; j++) ctx.fillRect(px + 0.2, by + 0.7 + j * 0.4, 2.4, 0.12); }
        for (let j = 0; j < 5; j++) { const u = (env.t * 0.09 + j / 5 + k * 0.43) % 1; twPuff(ctx, px + 1.4 + env.wind * u * u * 3.2, by + 3.5 + u * 6.5, 0.9 + u * 2.6, 0.8 + u * 2.0, '#8fa0c4', (1 - u) * Math.min(1, u * 5) * 0.3); }
      }
      if (H.cradleKit) { const cx = H.cradleKit.x; R4(ctx, cx - 1.1, by + 0.07, 2.2, 1.15, c3); R4(ctx, cx - 0.9, by + 1.22, 1.8, 0.1, c2); if (s > 8) { R4(ctx, cx - 0.8, by + 0.35, 0.7, 0.5, c2); circ(ctx, cx - 0.8, by + 0.1, 0.12, c2); circ(ctx, cx + 0.8, by + 0.1, 0.12, c2); } }
      line(ctx, -4.4, by, -4.4, by + 5.6, c2, 0.1, env); line(ctx, -3.6, by, -3.6, by + 3.8, c2, 0.08, env);              // masts
      if (s > 5) { line(ctx, -4.9, by + 4.6, -3.9, by + 4.6, c2, 0.06, env); line(ctx, -4.75, by + 5.1, -4.05, by + 5.1, c2, 0.06, env); ctx.fillStyle = c3; ctx.beginPath(); ctx.ellipse(-3.6, by + 3.2, 0.25, 0.55, 0.5, 0, TAU); ctx.fill(); }
      if (s > 7) { ctx.strokeStyle = c2; ctx.lineWidth = Math.max(0.035, env.px * 0.5); ctx.beginPath(); ctx.moveTo(-26.8, by + 1.05); ctx.lineTo(-1.2, by + 1.05); for (let xx = -26.8; xx < -1.1; xx += 2.56) { ctx.moveTo(xx, by); ctx.lineTo(xx, by + 1.05); } ctx.stroke(); }
    } });
  }
  // the rooftop demonstration (only when the mission asks for it)
  if (o.demo) {
    const ry = A.roofY, D = H.demo = { y: ry, rigX: -24.4, capsX: -19.6, fuseX: -15.4, valveX: -10.2, camX: -6.5, hutX: -6.2, fireT: -99 };
    S.litZones['A:roof'] = false;
    D.lamps = [K.lamp(S, PA, -22.2, 4.3, 'A:roof', { id: 'rl1', y: ry + 0.3, reach: 9, arm: 0.9 }), K.lamp(S, PA, -9.2, 4.3, 'A:roof', { id: 'rl2', y: ry + 0.3, reach: 9.5, arm: -0.9 })];
    const steel = S.tone('#8f979e', PA), dark = S.tone('#20252d', PA), white = S.tone('#dfe5ea', PA), hut = S.tone('#3a4450', PA), hutD = S.tone('#2a323c', PA), keepR = {};
    PA.add({ x0: -27, x1: -1, layer: 0, draw(ctx, env) {
      const by = ry + 0.3, s = env.s;
      // the roof lamps on the deck, fading the way the light itself does
      ctx.globalCompositeOperation = 'lighter'; twLampWash(ctx, S, 'A:roof', -27, -1, by - 0.3, by + 0.04, '255,220,160', 0.5, keepR); ctx.globalCompositeOperation = 'source-over';
      R4(ctx, D.hutX, by, 5.0, 2.9, hut); R4(ctx, D.hutX + 3.2, by, 1.1, 2.2, dark); R4(ctx, D.hutX - 0.1, by + 2.9, 5.2, 0.16, dark);              // stair hut
      if (s > 8) { ctx.fillStyle = hutD; for (let k = 0; k < 5; k++) ctx.fillRect(D.hutX + 0.4, by + 0.6 + k * 0.32, 1.8, 0.11); R4(ctx, D.hutX + 3.12, by, 0.08, 2.28, hutD); R4(ctx, D.hutX + 4.3, by, 0.08, 2.28, hutD); R4(ctx, D.hutX + 3.12, by + 2.2, 1.26, 0.08, hutD); R4(ctx, D.hutX + 4.05, by + 1.0, 0.12, 0.05, steel); }
      R4(ctx, D.fuseX - 0.06, by, 0.12, 1.2, dark);                                                                                           // post under the breaker box
      R4(ctx, D.valveX - 2.5, by, 0.12, 1.05, dark); R4(ctx, D.valveX + 2.38, by, 0.12, 1.05, dark);                                           // pipe stands
      R4(ctx, D.capsX - 1.45, by, 2.9, 0.45, dark);                                                                                           // plinth under the capacitor bank
      // the prototype on its test stand, pointing out over the harbour
      line(ctx, D.rigX - 0.5, by, D.rigX, by + 1.25, dark, 0.1, env); line(ctx, D.rigX + 0.5, by, D.rigX, by + 1.25, dark, 0.1, env);
      R4(ctx, D.rigX - 1.75, by + 1.25, 2.6, 0.2, white); R4(ctx, D.rigX + 0.2, by + 1.1, 0.75, 0.5, dark); R4(ctx, D.rigX - 0.1, by + 1.45, 0.7, 0.16, dark);
      if (s > 5) { ctx.fillStyle = S.tone('#5fd4ff', PA, true); for (let i = 0; i < 5; i++) ctx.fillRect(D.rigX - 1.6 + i * 0.36, by + 1.22, 0.1, 0.26); }
      if (s > 12) { R4(ctx, D.rigX - 1.75, by + 1.3, 0.1, 0.1, dark); R4(ctx, D.rigX - 0.6, by, 1.2, 0.06, dark); R4(ctx, D.rigX + 0.85, by + 1.18, 0.16, 0.3, steel); }
      // heavy cable from the bank to the rifle
      ctx.strokeStyle = dark; ctx.lineWidth = Math.max(0.07, env.px * 0.9); ctx.beginPath(); ctx.moveTo(D.capsX - 1.3, by + 0.6); ctx.quadraticCurveTo(D.rigX + 1.6, by - 0.1, D.rigX + 0.6, by + 1.15); ctx.stroke();
      // yellow line the guests stand behind
      if (s > 3) R4(ctx, D.capsX + 2.2, by, 14, 0.06, S.tone('#e2b33c', PA, true));
    } });
    PA.add({ x0: -60, x1: -20, layer: 2, draw(ctx, env) {   // the flash and streak of a test shot
      const u = (env.t - D.fireT) / 0.5; if (u < 0 || u > 1) return;
      const by = ry + 1.65;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(170,230,255,' + (1 - u) + ')'; ctx.lineWidth = Math.max(0.12, env.px * 2) * (1 - u * 0.6);
      ctx.beginPath(); ctx.moveTo(D.rigX - 1.75, by); ctx.lineTo(D.rigX - 40, by + 1.5); ctx.stroke(); ctx.restore();
      twGlow(ctx, D.rigX - 1.8, by, 3.2, '#bfeaff', 0.9 * (1 - u));
    } });
    D.caps = K.thing(S, PA, 'twcaps', D.capsX, ry + 1.5, { id: 'caps', w: 2.7, h: 1.5, r: 0.7, breakable: true, live: true,
      drawFn(ctx, env, S2, obj) {
        const x = obj.x, y = obj.y, on = obj.alive && obj.live;
        R4(ctx, x - 1.35, y - 0.75, 2.7, 1.5, S.tone('#2a323d', PA)); R4(ctx, x - 1.35, y + 0.62, 2.7, 0.13, steel); R4(ctx, x - 1.35, y - 0.75, 2.7, 0.1, steel);
        for (let i = 0; i < 5; i++) {
          const cx = x - 1.04 + i * 0.52, pulse = 0.6 + 0.4 * Math.sin(env.t * 5 + i * 0.9);
          R4(ctx, cx - 0.17, y - 0.6, 0.34, 1.16, on ? S.tone(mix('#2f7fd0', '#aee6ff', pulse), PA, true) : obj.alive ? S.tone(mix('#27496e', '#3f73a8', pulse), PA, true) : S.tone('#1a1e24', PA));
          R4(ctx, cx - 0.17, y + 0.4, 0.34, 0.1, dark);
        }
        if (on) twGlow(ctx, x, y, 2.6, '#5fb4ff', 0.28);
        else if (obj.alive) twGlow(ctx, x, y, 1.8, '#5fb4ff', 0.1);                 // power off, but still holding a little charge: findable in the dark
        else if (!obj.alive && Math.sin(env.t * 23) > 0.86) twGlow(ctx, x + Math.sin(env.t * 7) * 0.9, y + 0.2, 0.7, '#bfe4ff', 0.9);
      } });
    D.valve = K.thing(S, PA, 'valve', D.valveX, ry + 1.5, { id: 'valve', dur: 16, cover: true });
    D.fuse = K.thing(S, PA, 'fuse', D.fuseX, ry + 1.75, { id: 'breaker', cuts: ['A:roof'], killsCams: true });
    D.cam = K.thing(S, PA, 'cctv', D.camX, ry + 3.0, { id: 'rcam', zone: 'A:roof', range: 11, dir: -1 });
  }

  // ---- the building site, a little nearer than the towers ----
  const PC = S.plane(z0 - 4, 'site'); H.PC = PC;
  K.ground(S, PC, { col: '#3a3630', noEdge: true, x0: 16, mat: 'dirt' });
  H.siteKit = K.twSite(S, PC, Object.assign({ x: 31 }, o.site || {}));
  H.hook = H.siteKit.hook;

  // ---- the pavement and the road under the towers ----
  const PS = S.plane(z0 - 9, 'street'); H.PS = PS;
  K.ground(S, PS, { col: '#343a48', edge: '#8f97a3' });
  H.lamps = [];
  (o.lamps || [-34, -17, 5, 17.5]).forEach((lx, i) => H.lamps.push(K.lamp(S, PS, lx, 6, 'street', { id: 'lamp' + (i + 1), reach: 8 })));
  PS.add({ x0: 9, x1: 16.5, layer: 0, draw(ctx, env) {   // bus shelter with a lit advert
    const st = S.tone('#2a3038', PS), stL = S.tone('#4a5562', PS), s = env.s;
    R4(ctx, 9.6, 0, 0.1, 2.5, st); R4(ctx, 14.3, 0, 0.1, 2.5, st); R4(ctx, 9.3, 2.5, 5.4, 0.14, st);
    ctx.fillStyle = 'rgba(150,195,230,0.10)'; ctx.fillRect(9.7, 0.3, 3.2, 2.2);
    if (s > 8) { R4(ctx, 9.3, 2.5, 5.4, 0.035, stL); R4(ctx, 9.7, 1.35, 3.2, 0.04, stL); R4(ctx, 9.7, 0.3, 3.2, 0.04, stL); R4(ctx, 11.28, 0.3, 0.04, 2.2, stL); poly(ctx, [10.0, 0.4, 10.3, 0.4, 11.0, 2.4, 10.7, 2.4], 'rgba(200,225,250,0.07)'); }
    R4(ctx, 12.94, 0.29, 1.37, 2.17, st);
    R4(ctx, 13.0, 0.35, 1.25, 2.05, S.tone('#ffe9c8', PS, true)); env.text(ctx, 'CALDER', 13.62, 1.55, 0.26, S.tone('#b3312b', PS, true), 'center'); env.text(ctx, 'COLA', 13.62, 1.15, 0.3, S.tone('#b3312b', PS, true), 'center');
    if (s > 8) { R4(ctx, 13.42, 0.5, 0.4, 0.5, S.tone('#b3312b', PS, true)); R4(ctx, 13.52, 1.0, 0.2, 0.1, S.tone('#b3312b', PS, true)); }
    twGlowE(ctx, 13.62, 1.4, 1.9, 1.9, '#ffe9c8', 0.16);
    R4(ctx, 10.0, 0.45, 2.4, 0.08, st); if (s > 8) { R4(ctx, 10.15, 0, 0.06, 0.45, st); R4(ctx, 12.2, 0, 0.06, 0.45, st); }
    line(ctx, 15.6, 0, 15.6, 2.9, st, 0.07, env); R4(ctx, 15.35, 2.5, 0.5, 0.5, S.tone('#2f6db5', PS, true)); if (s > 8) R4(ctx, 15.43, 2.68, 0.34, 0.14, S.tone('#e9eef4', PS, true));
  } });
  PS.add({ x0: -20, x1: -8, layer: 0, draw(ctx, env) {   // a steel ring on a plinth outside the Aurel doors
    R4(ctx, -15.4, 0, 2.8, 0.5, S.tone('#4a5562', PS)); if (env.s > 8) { R4(ctx, -15.4, 0.44, 2.8, 0.06, S.tone('#6c7885', PS)); R4(ctx, -14.4, 0.14, 0.8, 0.2, S.tone('#c9a24a', PS)); }
    ctx.strokeStyle = S.tone('#aab3bd', PS); ctx.lineWidth = Math.max(0.22, env.px);
    ctx.beginPath(); ctx.arc(-14, 2.0, 1.45, 0, TAU); ctx.stroke();
    if (env.s > 8) { ctx.strokeStyle = S.tone('#dfe6ee', PS); ctx.lineWidth = Math.max(0.04, env.px * 0.6); ctx.beginPath(); ctx.arc(-14, 2.0, 1.52, 2.0, 3.6); ctx.stroke(); }
    twGlow(ctx, -14, 0.7, 2.2, '#5fd4ff', 0.16);
  } });
  // along the kerb: slim bollards with a band of light, a rack of bicycles, and steam from a grating
  PS.add({ x0: -40, x1: 30, layer: 0, draw(ctx, env) {
    const s = env.s, st = S.tone('#2a3038', PS), stL = S.tone('#5a6470', PS);
    if (s > 4) for (let bx = -30; bx <= 2; bx += 4) { if (bx < env.x0 - 1 || bx > env.x1 + 1 || Math.abs(bx + 14) < 2.5) continue; R4(ctx, bx - 0.07, 0, 0.14, 0.85, st); R4(ctx, bx - 0.07, 0.68, 0.14, 0.06, '#bfe6ff'); if (s > 9) twGlow(ctx, bx, 0.7, 0.4, '#8fd0ff', 0.25); }
    if (s > 6) {
      ctx.strokeStyle = stL; ctx.lineWidth = Math.max(0.04, env.px * 0.6); ctx.beginPath();
      for (let k = 0; k < 4; k++) { const hx = 6.0 + k * 0.8; ctx.moveTo(hx, 0); ctx.lineTo(hx, 0.6); ctx.arc(hx + 0.2, 0.6, 0.2, Math.PI, 0, true); ctx.lineTo(hx + 0.4, 0); }
      // one bicycle left in the rack
      const b0 = 6.75;
      ctx.moveTo(b0 + 0.3, 0.33); ctx.arc(b0, 0.33, 0.3, 0, TAU); ctx.moveTo(b0 + 1.3, 0.33); ctx.arc(b0 + 1.0, 0.33, 0.3, 0, TAU);
      ctx.moveTo(b0, 0.33); ctx.lineTo(b0 + 0.35, 0.78); ctx.lineTo(b0 + 0.85, 0.78); ctx.lineTo(b0 + 1.0, 0.33); ctx.moveTo(b0 + 0.35, 0.78); ctx.lineTo(b0 + 0.55, 0.33); ctx.lineTo(b0, 0.33); ctx.moveTo(b0 + 0.85, 0.78); ctx.lineTo(b0 + 0.81, 0.95); ctx.lineTo(b0 + 0.95, 0.98); ctx.moveTo(b0 + 0.29, 0.9); ctx.lineTo(b0 + 0.45, 0.9);
      ctx.stroke();
    }
    R4(ctx, 2.6, -0.06, 0.9, 0.06, st);
    for (let k = 0; k < 5; k++) { const u = (env.t * 0.22 + k / 5) % 1; twPuff(ctx, 3.05 + env.wind * u * u * 0.9 + Math.sin(u * 5 + k) * 0.12, 0.1 + u * 2.3, 0.3 + u * 0.7, 0.3 + u * 0.6, '#9aa6bd', (1 - u) * Math.min(1, u * 6) * 0.16); }
  } });
  K.bench(S, PS, -24.5); K.bench(S, PS, 1.5);
  const PR = S.plane(z0 - 17, 'road'); H.PR = PR;
  K.ground(S, PR, { col: S.pal.road, stripes: 2.2, noEdge: true });
  // the street lamps lying in long smears on the road when it is wet
  if (wet) PR.add({ x0: -80, x1: 80, layer: 0, draw(ctx, env) {
    const k = (z0 - 17) / (z0 - 9);
    for (let i = 0; i < H.lamps.length; i++) { const lp = H.lamps[i]; if (!lp.alive || lp.on === false) continue; twGlowE(ctx, lp.x * k, -1.5, 0.75, 2.4, '#ffe1a0', 0.22); twGlowE(ctx, lp.x * k, -0.8, 2.2, 0.9, '#ffe1a0', 0.08); }
    twGlowE(ctx, -14 * ((z0 - 17) / z0), -1.9, 5.5, 1.3, '#bfe6ff', 0.07);
  } });
  (o.cars || [['sedan', -37, 1, '#3a3f49'], ['van', -6, -1, '#c9ced3'], ['suv', 11.5, 1, '#20242c']]).forEach((c) => K.parked(S, PR, c[0], c[1], c[2], c[3], { y: 0 }));

  // ---- the near side: brick apartments, a fire escape, the locksmith's ----
  const PF = S.plane(z0 - 44, 'flats'); H.PF = PF;
  K.ground(S, PF, { col: '#2e3442', edge: '#8a929e' });
  const of = o.F || {};
  const F = K.building(S, PF, { x: -46, w: 18, floors: 6, fh: 3.3, id: 'F', cols: 5, wall: of.wall || '#74483e', seed: seed * 7 + 3, tank: 0.82,
    shop: Object.assign({ sign: 'OKORO LOCKS', awning: '#2f5d6b', door: true, lit: false }, of.shop || {}), spans: of.spans, wins: of.wins });
  H.F = F;
  K.fireEscape(S, PF, F, 3, 1, 5);
  S.litZones.fe = true; S.litZones.road = true;
  PF.add({ x0: F.winX(3) - 1.6, x1: F.winX(3) + 1.6, layer: 2, draw(ctx, env) { const c = S.tone('#1b1e24', PF); line(ctx, F.winX(3) + 1.1, 0.3, F.winX(3) + 1.1, F.floorY(1), c, 0.06, env); line(ctx, F.winX(3) + 0.75, 0.3, F.winX(3) + 0.75, F.floorY(1), c, 0.06, env); if (env.s > 4) { ctx.strokeStyle = c; ctx.lineWidth = Math.max(0.03, env.px * 0.5); ctx.beginPath(); for (let y = 0.5; y < F.floorY(1); y += 0.3) { ctx.moveTo(F.winX(3) + 0.75, y); ctx.lineTo(F.winX(3) + 1.1, y); } ctx.stroke(); } } });
  K.billboard(S, PF, -45.4, F.roofY + 2.6, 8.4, 3.5, 'CALDER|COLA', { base: F.roofY + 0.9, col: '#e9dcc0', textCol: '#b3312b' });
  // the reporter's flat: a desk at the big window and a wall of notes behind it
  if (of.brandt) {
    const bf = of.brandt.floor || 4, bc = of.brandt.col || 2, op = F.win(bf, bc), fy = F.floorY(bf), wx = F.winX(bc);
    op.deco = -1; op.tint = '#ffe2b4';
    H.brandtX = wx + 0.8;
    PF.add({ x0: op.x, x1: op.x + op.w, layer: 0, draw(ctx, env) {
      if (!(S.rooms[op.room] && S.rooms[op.room].lit)) return;
      const cork = S.tone('#b98f5c', PF, true), paper = S.tone('#f6f1e4', PF, true), ink = S.tone('#2a2019', PF, true), red = S.tone('#c8372d', PF, true), dk = S.tone('#5a4032', PF, true);
      const bx = wx - 1.52, by = fy + 1.28, bw = 2.02, bh = 1.4;
      R4(ctx, bx - 0.06, by - 0.06, bw + 0.12, bh + 0.12, dk); R4(ctx, bx, by, bw, bh, cork);
      R4(ctx, bx + 0.3, by + bh - 0.52, 1.42, 0.44, paper); env.text(ctx, 'AUREL', bx + 1.01, by + bh - 0.43, 0.38, red, 'center');
      R4(ctx, bx + 0.1, by + 0.44, 0.46, 0.38, paper); R4(ctx, bx + 0.14, by + 0.52, 0.38, 0.26, ink);                       // a photograph
      R4(ctx, bx + 0.7, by + 0.42, 1.22, 0.42, paper);                                                                    // a drawing of a long rifle
      R4(ctx, bx + 0.78, by + 0.66, 0.9, 0.05, ink); R4(ctx, bx + 1.5, by + 0.58, 0.3, 0.14, ink); R4(ctx, bx + 1.08, by + 0.7, 0.26, 0.07, ink);
      env.text(ctx, 'STORMGLASS', bx + 1.31, by + 0.46, 0.13, ink, 'center');
      R4(ctx, bx + 0.2, by + 0.06, 1.62, 0.3, paper); env.text(ctx, 'HARROW RIDGE', bx + 1.01, by + 0.12, 0.2, ink, 'center');
      ctx.strokeStyle = red; ctx.lineWidth = Math.max(0.025, env.px * 0.7);                                                 // red string from one to the next
      ctx.beginPath(); ctx.moveTo(bx + 1.0, by + bh - 0.52); ctx.lineTo(bx + 0.33, by + 0.82); ctx.moveTo(bx + 1.0, by + bh - 0.52); ctx.lineTo(bx + 1.3, by + 0.84); ctx.lineTo(bx + 1.0, by + 0.36); ctx.stroke();
      if (env.s > 30) { ctx.fillStyle = red; for (const q of [[1.0, bh - 0.52], [0.33, 0.82], [1.3, 0.84], [1.0, 0.36]]) { ctx.beginPath(); ctx.arc(bx + q[0], by + q[1], 0.025, 0, TAU); ctx.fill(); } }   // the pins
      // her desk, the typewriter and a lamp
      R4(ctx, wx - 0.72, fy + 0.68, 1.1, 0.07, dk); R4(ctx, wx - 0.66, fy + 0.4, 0.07, 0.28, dk);
      R4(ctx, wx - 0.28, fy + 0.75, 0.42, 0.16, ink); R4(ctx, wx - 0.2, fy + 0.91, 0.26, 0.2, paper);
      R4(ctx, wx - 0.6, fy + 0.75, 0.04, 0.34, ink); poly(ctx, [wx - 0.76, fy + 1.06, wx - 0.4, fy + 1.06, wx - 0.5, fy + 1.24, wx - 0.66, fy + 1.24], S.tone('#7fb86a', PF, true));
      twGlowE(ctx, wx - 0.58, fy + 0.95, 0.6, 0.4, '#bfe8a8', 0.22);
      R4(ctx, wx + 0.55, fy + 0.4, 0.5, 0.07, dk); R4(ctx, wx + 1.05, fy + 0.4, 0.08, 0.62, dk);                              // chair
    } });
  }
  H.nearLamps = [];
  (o.nearLamps || [-24, -2, 20, 42]).forEach((lx, i) => H.nearLamps.push(K.lamp(S, PF, lx, 5.6, 'near', { id: 'nlamp' + (i + 1), reach: 8 })));
  PF.add({ x0: -30, x1: 50, layer: 0, draw(ctx, env) {   // street furniture on the near pavement
    const s = env.s, st = S.tone('#2a3038', PF), red = S.tone('#a8322a', PF), redD = S.tone('#7a231d', PF), blue = S.tone('#2f5d8a', PF), blueD = S.tone('#224566', PF), grn = S.tone('#3f6b4a', PF), lit = S.tone('#ffe9c8', PF, true);
    // phone box
    R4(ctx, -13.5, 0, 0.9, 2.3, red); R4(ctx, -13.35, 0.9, 0.6, 1.2, lit); R4(ctx, -13.6, 2.3, 1.1, 0.14, st);
    if (s > 8) { ctx.fillStyle = red; ctx.fillRect(-13.07, 0.9, 0.04, 1.2); for (let k = 1; k < 4; k++) ctx.fillRect(-13.35, 0.9 + k * 0.3, 0.6, 0.035); R4(ctx, -13.5, 0, 0.9, 0.12, redD); R4(ctx, -13.38, 2.13, 0.66, 0.13, lit); R4(ctx, -13.22, 1.25, 0.2, 0.4, st); }
    twGlowE(ctx, -13.05, 1.5, 0.9, 1.1, '#ffe9c8', 0.16);
    // post box
    R4(ctx, 8.6, 0, 0.6, 1.1, blue); R4(ctx, 8.5, 1.1, 0.8, 0.12, st);
    if (s > 8) { R4(ctx, 8.6, 0, 0.6, 0.1, blueD); R4(ctx, 8.72, 0.82, 0.36, 0.05, st); R4(ctx, 8.74, 0.4, 0.32, 0.26, S.tone('#e9eef4', PF)); }
    // litter bin
    R4(ctx, 31.2, 0, 1.3, 1.0, grn); R4(ctx, 31.1, 1.0, 1.5, 0.1, st);
    if (s > 8) { ctx.fillStyle = S.tone('#2f5238', PF); for (let k = 1; k < 5; k++) ctx.fillRect(31.2 + k * 0.26, 0.08, 0.035, 0.84); R4(ctx, 31.5, 0.72, 0.7, 0.12, st); }
    // hydrant
    R4(ctx, -0.25, 0, 0.5, 0.75, red);
    if (s > 8) { R4(ctx, -0.31, 0, 0.62, 0.08, redD); R4(ctx, -0.2, 0.75, 0.4, 0.09, redD); R4(ctx, -0.12, 0.84, 0.24, 0.08, red); R4(ctx, -0.38, 0.42, 0.13, 0.16, redD); R4(ctx, 0.25, 0.42, 0.13, 0.16, redD); }
    // the near lamps smeared on the wet pavement
    if (wet) for (let i = 0; i < H.nearLamps.length; i++) { const lp = H.nearLamps[i]; if (lp.alive && lp.on !== false) twGlowE(ctx, lp.x, -1.3, 0.7, 2.0, '#ffe1a0', 0.2); }
  } });

  // ---- close by: the roof you are shooting over, for depth ----
  const zN = Math.max(90, (z0 - 44) * 0.42), PN = S.plane(zN, 'nearroof'); H.PN = PN;
  const ny = eyeY - 13.5;
  PN.add({ x0: -400, x1: 400, layer: 0, draw(ctx, env) {
    const c = S.tone('#161b24', PN), c2 = S.tone('#222a36', PN), c3 = S.tone('#2c3644', PN), s = env.s;
    R4(ctx, -400, ny - 60, 800, 60, c); R4(ctx, -400, ny - 0.25, 800, 0.25, c2);
    if (s > 12) {   // coping stones along the parapet, and the brick below them
      ctx.fillStyle = c3; ctx.fillRect(env.x0, ny - 0.04, env.x1 - env.x0, 0.04);
      ctx.fillStyle = c; for (let xx = Math.floor(env.x0 / 1.2) * 1.2; xx < env.x1; xx += 1.2) ctx.fillRect(xx, ny - 0.25, 0.03, 0.21);
      if (s > 30) { ctx.fillStyle = c2; for (let r = 0; r < 6; r++) { const yy = ny - 0.42 - r * 0.16; if (yy < env.y0) break; ctx.fillRect(env.x0, yy, env.x1 - env.x0, 0.02); } }
    }
    R4(ctx, -zN * 0.19, ny, 4.2, 1.6, c); R4(ctx, -zN * 0.19 + 0.5, ny + 1.6, 1.2, 0.5, c2);
    if (s > 8) { R4(ctx, -zN * 0.19 - 0.08, ny + 1.52, 4.36, 0.1, c2); R4(ctx, -zN * 0.19 + 2.6, ny, 0.9, 1.3, c2); R4(ctx, -zN * 0.19 + 0.62, ny + 2.1, 0.96, 0.08, c3); }
    line(ctx, -zN * 0.17, ny + 1.6, -zN * 0.17, ny + 5.5, c2, 0.07, env); line(ctx, -zN * 0.17 - 0.7, ny + 4.6, -zN * 0.17 + 0.7, ny + 4.6, c2, 0.05, env); line(ctx, -zN * 0.17 - 0.45, ny + 5.1, -zN * 0.17 + 0.45, ny + 5.1, c2, 0.05, env);
    R4(ctx, zN * 0.07, ny, 2.2, 0.9, c); R4(ctx, zN * 0.07 + 0.2, ny + 0.2, 1.8, 0.14, c2);
    if (s > 8) { R4(ctx, zN * 0.07 + 0.2, ny + 0.45, 1.8, 0.1, c2); R4(ctx, zN * 0.07 - 0.06, ny + 0.86, 2.32, 0.08, c2); }
    // a vent pipe with a cowl, and a low skylight with the stair light showing through
    R4(ctx, -zN * 0.05, ny, 0.24, 0.8, c2); R4(ctx, -zN * 0.05 - 0.1, ny + 0.8, 0.44, 0.16, c3);
    R4(ctx, zN * 0.115, ny, 1.9, 0.42, c2); R4(ctx, zN * 0.115 + 0.12, ny + 0.1, 1.66, 0.24, S.tone('#8f7a52', PN, true)); twGlowE(ctx, zN * 0.115 + 0.95, ny + 0.5, 1.6, 0.8, '#ffd9a0', 0.12);
  } });
  K.flag(S, PN, o.flagX === undefined ? zN * 0.165 : o.flagX, ny, 5.2, '#c0392b', { layer: 0 });
  K.wire(S, PN, -zN * 0.17, ny + 5.4, -zN * 0.5, ny + 3.2, 1.2);

  // ---- placements ----
  const towerOf = (T) => (T === 'B' ? B : (T === 'A' || !T) ? A : T);
  H.office = (T, f, x, extra) => { const Bd = towerOf(T), op = Bd.win(f, Bd.colAt(x)); return Object.assign({ plane: Bd.P, x, y: Bd.floorY(f), room: op.room, zone: op.room, behind: true }, extra || {}); };
  H.roof = (T, x, extra) => { const Bd = towerOf(T); return Object.assign({ plane: Bd.P, x, y: Bd.roofY + (Bd === A ? 0.3 : 0), room: Bd.roofRoom, zone: Bd.roofRoom, behind: true }, extra || {}); };
  H.terrace = (x, extra) => H.roof('B', x, extra);
  H.site = (x, level, extra) => Object.assign({ plane: PC, x, y: (level || 0) * 3.6, zone: level ? 'site' + level : 'site', room: null, behind: false }, level ? { flee: [['wait', 999, 'cower']] } : {}, extra || {});
  H.street = (x, extra) => Object.assign({ plane: PS, x, y: 0, zone: 'street', room: null, behind: false }, extra || {});
  H.road = (x, extra) => Object.assign({ plane: PR, x, y: 0, zone: 'road', room: null, behind: false }, extra || {});
  H.near = (x, extra) => Object.assign({ plane: PF, x, y: 0, zone: 'near', room: null, behind: false }, extra || {});
  H.flat = (f, c, dx, extra) => { const op = F.win(f, c); return Object.assign({ plane: PF, x: F.winX(c) + (dx || 0), y: F.floorY(f), room: op.room, zone: op.room, behind: true }, extra || {}); };
  H.escape = (f, dx, extra) => Object.assign({ plane: PF, x: F.winX(3) + (dx || 0), y: F.floorY(f), zone: 'fe', room: null, behind: false, flee: [['wait', 999, 'cower']] }, extra || {});
  // a helicopter that crosses behind the towers now and then and drowns out gunfire while it does
  H.heli = (q) => {
    q = q || {};
    const yy = q.y || 60, veh = { id: 'heli', kind: 'twheli', plane: H.PH, x: -260, y: yy, dir: 1, col: '#7f8b9a', routine: [], yFn: (x) => yy + Math.sin(x * 0.045) * 1.6 };
    let n = 0;
    const trig = { at: q.first === undefined ? 6 : q.first, every: q.period || 32, do(sim) {
      const v = sim.byId.heli, dir = (n++ % 2) ? -1 : 1; if (!v) return;
      v.x = -150 * dir; v.dir = dir; v.gone = false; v.v = 0; v.routine = [['drive', 260 * dir, q.speed || 21]]; v.pc = 0; v.goal = null; v.wait = 0;
      sim.after(q.lead === undefined ? 3.2 : q.lead, () => sim.cover(q.cover || 9, 'helicopter'));
    } };
    return { veh, trig };
  };
  return H;
};

// ---- a car armoured the wrong way round (c4m8) --------------------------------------------------
// Glass that stops anything, fitted to doors made of ordinary sheet steel. Each window carries a
// pane of armoured glass: a shootable 'armour' object on the car's own plane, which is tested
// before the car itself, so every round that meets it stops dead (and o.onHit is told). The doors
// and pillars are left as the car's own thin steel, which armour-piercing rounds go through.
// The panes are drawn over whoever sits behind them: thick glass, faintly green at the edges,
// in a heavy rubber frame, with a chip where each round struck.
// Call A.follow(sim) from the mission's start() and tick() so the panes ride along with the car.
K.armourGlass = function (S, P, vehId, kind, o) {
  o = o || {};
  const c = CARS[kind], y0 = c.body + 0.06, hh = c.h - 0.14 - y0, panes = [];
  const frame = S.tone('#121418', P), edge = 'rgba(126,196,160,0.55)', tint = 'rgba(70,120,104,0.2)', shine = 'rgba(220,240,235,0.16)', seam = 'rgba(150,160,175,0.35)', handle = S.tone('#8f98a3', P);
  c.win.forEach((wn, i) => {
    const ww = (wn[1] - wn[0]) * c.len;
    const ob = K.thing(S, P, 'armour', -999, -999, { id: vehId + '_pane' + i, r: 0.5, w: ww + 0.04, h: hh + 0.04, mat: 'metal', gone: true,
      onHit(sim, q) {
        // the simulation has just reported where the round struck: keep that spot for the chip
        for (let k = sim.ev.length - 1; k >= 0; k--) { const e = sim.ev[k]; if (e.k === 'objhit' && e.id === q.id) { q.chips.push([e.x - q.x, e.y - q.y, sim.t * 7.3]); break; } }
        if (o.onHit) o.onHit(sim, q);
      },
      drawFn(ctx, env) {
        const x0 = ob.x - ww / 2, yb = ob.y - hh / 2, s = env.s, v = ob.car;
        // the door under this window: its seams and handle, so it reads as a door and not as more car
        if (s > 4 && v) {
          const fl = v.y + 0.22, back = v.dir > 0 ? x0 : x0 + ww;
          ctx.strokeStyle = seam; ctx.lineWidth = Math.max(0.015, env.px * 0.7); ctx.beginPath();
          ctx.moveTo(x0 - 0.04, fl); ctx.lineTo(x0 - 0.04, yb - 0.02); ctx.moveTo(x0 + ww + 0.04, fl); ctx.lineTo(x0 + ww + 0.04, yb - 0.02); ctx.stroke();
          ctx.fillStyle = handle; ctx.fillRect(back + v.dir * 0.1 - (v.dir > 0 ? 0 : 0.22), yb - 0.17, 0.22, 0.045);
        }
        if (o.lamp === i) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,214,140,0.14)'; ctx.fillRect(x0, yb, ww, hh); ctx.globalCompositeOperation = 'source-over'; }   // his reading lamp
        ctx.fillStyle = tint; ctx.fillRect(x0, yb, ww, hh);
        ctx.strokeStyle = frame; ctx.lineWidth = Math.max(0.05, env.px); ctx.strokeRect(x0, yb, ww, hh);
        if (s > 5) {
          ctx.strokeStyle = edge; ctx.lineWidth = Math.max(0.025, env.px * 0.8); ctx.strokeRect(x0 + 0.045, yb + 0.045, ww - 0.09, hh - 0.09);   // the green of thick glass, seen at its edge
          ctx.fillStyle = shine; ctx.beginPath(); ctx.moveTo(x0 + ww * 0.12, yb + hh - 0.05); ctx.lineTo(x0 + ww * 0.3, yb + hh - 0.05); ctx.lineTo(x0 + ww * 0.12, yb + 0.06); ctx.lineTo(x0 + 0.06, yb + 0.06); ctx.closePath(); ctx.fill();
        }
        // where a round has struck: a white chip with cracks running out of it. The glass holds.
        if (ob.chips.length) {
          ctx.strokeStyle = 'rgba(240,246,250,0.85)'; ctx.lineWidth = Math.max(0.012, env.px * 0.6); ctx.beginPath();
          for (let k = 0; k < ob.chips.length; k++) { const q = ob.chips[k], cx = ob.x + q[0], cy = ob.y + q[1]; for (let j = 0; j < 6; j++) { const an = j * 1.05 + q[2]; ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(an) * 0.09, cy + Math.sin(an) * 0.09); } }
          ctx.stroke(); ctx.fillStyle = 'rgba(250,252,255,0.9)'; for (let k = 0; k < ob.chips.length; k++) { const q = ob.chips[k]; circ(ctx, ob.x + q[0], ob.y + q[1], Math.max(0.025, env.px), 'rgba(250,252,255,0.9)'); }
        }
      } });
    ob.chips = []; ob.win = i; ob.dx = (wn[0] + wn[1]) / 2 * c.len; ob.dy = y0 + hh / 2;
    panes.push(ob);
  });
  const A = { panes,
    // put each pane over its window. A moving car is a step ahead of the panes by the time the
    // next round flies, so they are moved on by one step's travel.
    follow(sim) {
      const v = sim.byId[vehId];
      panes.forEach((ob) => {
        if (!v || v.gone) { ob.gone = true; return; }
        ob.car = v; ob.gone = false; ob.x = v.x + v.dir * ob.dx + (v.goal !== null ? v.dir * v.v / 60 : 0); ob.y = v.y + ob.dy;
      });
    },
  };
  return A;
};
