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
// ---------------------------------------------------------------------------
function dkHash(n) { const v = Math.sin(n * 12.9898 + 4.1) * 43758.5453; return v - Math.floor(v); }
// A soft halo round a small light. rgb is "r,g,b".
function dkGlow(ctx, x, y, r, rgb, a) {
  const g = ctx.createRadialGradient(x, y, r * 0.05, x, y, r); g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
}

// Open water. A harbour is several of these at different distances: each one
// paints from its own waterline down, so near water overlaps far water and a
// boat sits "in" its own strip. lights: [{ x, col, len, w, a, ob }] are
// reflections; give `ob` (a lamp) and the reflection dies with the lamp.
K.sea = function (S, P, o) {
  o = o || {};
  const y = o.y === undefined ? -2.2 : o.y, night = S.pal.dark > 0.5;
  const base = o.deep ? darken(o.col || S.pal.water, o.deep) : (o.col || S.pal.water);
  const col = S.tone(base, P), hi = mix(col, night ? '#8fa6cc' : '#ffffff', o.shine === undefined ? (night ? 0.17 : 0.26) : o.shine);
  const sheen = o.sheen ? S.tone(o.sheen, P, true) : null, sheenD = o.sheenD || 20;
  const lights = o.lights || [], rows = o.rows || 6, sd = o.seed || Math.round(P.z);
  const X0 = o.x0 === undefined ? -6000 : o.x0, X1 = o.x1 === undefined ? 6000 : o.x1;
  if (o.ground !== false) { P.groundY = y; P.groundMat = 'water'; }
  P.add({ x0: X0, x1: X1, layer: o.layer || 0, draw(ctx, env) {
    const xa = Math.max(env.x0 - 2, X0), xb = Math.min(env.x1 + 2, X1); if (xb <= xa) return;
    const yb = env.y0 === undefined ? y - 400 : Math.max(y - 400, env.y0 - 2); if (yb >= y) return;
    R4(ctx, xa, yb, xb - xa, y - yb, col);
    if (sheen) { // the sky lying on the water near the horizon
      const g = ctx.createLinearGradient(0, y, 0, y - sheenD); g.addColorStop(0, rgba(sheen, 0.62)); g.addColorStop(1, rgba(sheen, 0));
      ctx.fillStyle = g; ctx.fillRect(xa, Math.max(yb, y - sheenD), xb - xa, Math.min(sheenD, y - yb));
    }
    // short moving streaks, closer together toward the horizon
    ctx.strokeStyle = hi; ctx.lineWidth = Math.max(0.05, env.px);
    const step = Math.max(2.6, env.px * 24), dirw = env.wind >= 0 ? 1 : -1;
    ctx.beginPath();
    for (let r = 0; r < rows; r++) {
      const yy = y - 0.22 - r * 0.5 - r * r * 0.42; if (yy < yb) break;
      const sh = env.t * (0.18 + r * 0.05) * dirw, a = Math.floor((xa - sh) / step) * step;
      for (let x = a; x < xb - sh; x += step) {
        const h = dkHash(x * 0.37 + r * 17.3 + sd); if (h > 0.52) continue;
        const px = x + sh + h * step + Math.sin(env.t * 0.7 + x + r) * 0.35;
        ctx.moveTo(px, yy); ctx.lineTo(px + 0.7 + h * 3.4, yy);
      }
    }
    ctx.stroke();
    if (lights.length) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < lights.length; i++) {
        const L = lights[i]; if (L.x < xa - 4 || L.x > xb + 4) continue;
        if (L.ob && (!L.ob.alive || L.ob.on === false)) continue;
        const len = L.len || 4, w = L.w || 0.5; ctx.fillStyle = L.col;
        for (let j = 0; j < 10; j++) {
          const u = j / 10, yy = y - 0.1 - u * len; if (yy < yb) break;
          const wob = Math.sin(env.t * (1.5 + j * 0.21) + j * 1.9 + L.x) * (0.08 + u * 0.55) * w, th = Math.max(0.07, env.px * 1.1);
          ctx.globalAlpha = (1 - u) * (L.a || 0.5);
          ctx.fillRect(L.x - w * (0.5 + u * 0.5) + wob, yy - th, w * (1 + u), th);
        }
      }
      ctx.restore();
    }
  } });
};

// A wind sock on a pole: hangs limp in a calm, stands straight out at about 6 m/s.
K.windsock = function (S, P, x, y, h, o) {
  o = o || {}; const pole = S.tone('#c9ced3', P), c1 = S.tone('#e2672b', P, true), c2 = S.tone('#f1ede2', P, true), len = o.len || 1.9;
  P.add({ x0: x - len - 1, x1: x + len + 1, layer: o.layer === undefined ? 2 : o.layer, draw(ctx, env) {
    line(ctx, x, y, x, y + h, pole, 0.08, env);
    const w = env.wind, a = clamp(Math.abs(w) / 6.5, 0.06, 1), dir = w >= 0 ? 1 : -1, top = y + h - 0.3;
    const ang = a * (Math.PI / 2 - 0.1) + Math.sin(env.t * (3 + a * 8)) * 0.06 * (0.4 + a);
    const ux = dir * Math.sin(ang), uy = -Math.cos(ang), nx = -uy, ny = ux;
    for (let i = 0; i < 5; i++) {
      const u0 = i / 5, u1 = (i + 1) / 5, r0 = 0.3 * (1 - u0 * 0.55), r1 = 0.3 * (1 - u1 * 0.55);
      poly(ctx, [x + ux * len * u0 + nx * r0, top + uy * len * u0 + ny * r0, x + ux * len * u1 + nx * r1, top + uy * len * u1 + ny * r1,
        x + ux * len * u1 - nx * r1, top + uy * len * u1 - ny * r1, x + ux * len * u0 - nx * r0, top + uy * len * u0 - ny * r0], i % 2 ? c2 : c1);
    }
  } });
};

// A small pennant on a masthead. Streams with the wind, droops without it.
K.pennant = function (S, P, x, y, len, col, o) {
  o = o || {}; const c = S.tone(col || '#c0392b', P, true);
  P.add({ x0: x - len - 1, x1: x + len + 1, layer: o.layer === undefined ? 2 : o.layer, draw(ctx, env) {
    const w = env.wind, a = clamp(Math.abs(w) / 6, 0.05, 1), dir = w >= 0 ? 1 : -1, n = 6;
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y);
    for (let i = 1; i <= n; i++) { const u = i / n; ctx.lineTo(x + dir * u * len * (0.3 + 0.7 * a), y - (1 - a) * u * u * len * 0.8 + Math.sin(env.t * (4 + a * 8) - u * 5) * 0.1 * (0.3 + a) * u); }
    for (let i = n - 1; i >= 0; i--) { const u = i / n, hh = len * 0.34 * (1 - u); ctx.lineTo(x + dir * u * len * (0.3 + 0.7 * a), y - hh - (1 - a) * u * u * len * 0.8 + Math.sin(env.t * (4 + a * 8) - u * 5) * 0.1 * (0.3 + a) * u); }
    ctx.closePath(); ctx.fill();
  } });
};

// A shipping container. Stacks of these are the walls of the place.
const DOCK_BOX_COLS = ['#a3402f', '#2f5f8a', '#3f7a58', '#c98a2b', '#7d838a', '#8a3b5c', '#2f7f86', '#b5562c'];
const DOCK_BOX_NAMES = ['CALDER LINE', 'NORHAV', 'TRITON', 'HALVARD', 'OKA', 'SEAWAY', 'BOREAL', 'P & C'];
K.cbox = function (S, P, x, y, col, o) {
  o = o || {}; const w = o.w || 6.1, h = o.h || 2.6;
  const c = S.tone(col, P), d = S.tone(darken(col, 0.2), P), d2 = S.tone(darken(col, 0.42), P), l = S.tone(lighten(col, 0.16), P), tc = S.tone(o.textCol || '#f1ede2', P);
  P.add({ x0: x, x1: x + w, layer: o.layer || 0, draw(ctx, env) {
    R4(ctx, x, y, w, h, c);
    if (env.s > 2.4) { ctx.fillStyle = d; for (let xx = x + 0.34; xx < x + w - 0.25; xx += 0.3) ctx.fillRect(xx, y + 0.17, 0.09, h - 0.34); }
    R4(ctx, x, y + h - 0.13, w, 0.13, l); R4(ctx, x, y, w, 0.15, d2);
    R4(ctx, x, y, 0.16, h, d2); R4(ctx, x + w - 0.16, y, 0.16, h, d2);
    if (o.door && env.s > 2) { ctx.fillStyle = d2; for (let i = 0; i < 4; i++) ctx.fillRect(x + w * (0.14 + i * 0.24), y + 0.2, 0.07, h - 0.4); R4(ctx, x + w / 2 - 0.03, y + 0.15, 0.06, h - 0.3, d2); }
    if (o.text) { if (env.s > 2.4) R4(ctx, x + w * 0.18, y + h * 0.3, w * 0.64, h * 0.36, c); env.text(ctx, o.text, x + w / 2, y + h * 0.37, Math.min(0.72, (w * 0.6) / (o.text.length * 0.5)), tc, 'center'); }
  } });
  if (o.solid !== false) P.solid(x, y, w, h, 'hard');
};

// A dockside crane: a portal the cargo passes under, a machinery house and a
// lattice jib. Returns where the tip of the jib is, for hanging a load from it.
K.dockCrane = function (S, P, x, o) {
  o = o || {};
  const reach = o.reach === undefined ? 9 : o.reach, dir = reach >= 0 ? 1 : -1, R = Math.abs(reach), tipY = o.tipY || 19, y = o.y || 0;
  const colHex = o.col || '#d6922a', c = S.tone(colHex, P), d = S.tone(darken(colHex, 0.3), P), steel = S.tone('#2b3038', P), win = S.tone(S.pal.dark > 0.3 ? S.pal.lit : S.pal.glass, P, true);
  const legH = 6.4, g = 2.7;
  P.add({ x0: x - Math.max(7, R + 1), x1: x + Math.max(7, R + 1), layer: o.layer || 0, draw(ctx, env) {
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    const lw = (v) => Math.max(v, env.px * 0.9);
    // portal
    R4(ctx, -g - 0.26, 0, 0.52, legH, steel); R4(ctx, g - 0.26, 0, 0.52, legH, steel);
    R4(ctx, -g - 0.8, 0, 1.6, 0.42, steel); R4(ctx, g - 0.8, 0, 1.6, 0.42, steel);
    ctx.strokeStyle = steel; ctx.lineWidth = lw(0.13);
    ctx.beginPath(); ctx.moveTo(-g, legH - 2.2); ctx.lineTo(-g + 1.7, legH - 0.5); ctx.moveTo(g, legH - 2.2); ctx.lineTo(g - 1.7, legH - 0.5); ctx.stroke();
    R4(ctx, -g - 0.55, legH - 0.75, g * 2 + 1.1, 0.75, c); R4(ctx, -g - 0.55, legH - 0.75, g * 2 + 1.1, 0.16, d);
    if (env.s > 3) { ctx.fillStyle = steel; for (let i = 0; i < 9; i++) ctx.fillRect(-g - 0.3 + i * 0.68, legH - 0.52, 0.34, 0.2); } // hazard hatching
    // slewing house, cab and counterweight
    R4(ctx, -0.9, legH, 1.8, 0.55, steel);
    R4(ctx, -2.5, legH + 0.55, 4.6, 2.9, c); R4(ctx, -2.5, legH + 3.2, 4.6, 0.25, d); R4(ctx, -2.5, legH + 0.55, 4.6, 0.18, d);
    R4(ctx, 0.75, legH + 1.55, 1.2, 1.2, steel); R4(ctx, 0.85, legH + 1.65, 1.0, 1.0, win);
    R4(ctx, -4.3, legH + 0.75, 1.8, 2.0, steel);
    if (env.s > 3) { ctx.fillStyle = d; for (let i = 0; i < 5; i++) ctx.fillRect(-2.2 + i * 0.5, legH + 1.1, 0.12, 1.7); }
    // mast and stays
    const ax = -1.5, ay = legH + 10, px = 1.7, py = legH + 1.4, tx = R, ty = tipY;
    ctx.strokeStyle = c; ctx.lineWidth = lw(0.2);
    ctx.beginPath(); ctx.moveTo(-2.3, legH + 3.4); ctx.lineTo(ax, ay); ctx.lineTo(-0.2, legH + 3.4); ctx.stroke();
    ctx.strokeStyle = steel; ctx.lineWidth = lw(0.07);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tx, ty); ctx.moveTo(ax, ay); ctx.lineTo(-3.6, legH + 2.7); ctx.stroke();
    // jib: two chords and the lacing between them
    const ux = tx - px, uy = ty - py, ul = Math.hypot(ux, uy), nx = -uy / ul, ny = ux / ul, wide = 0.95;
    ctx.strokeStyle = c; ctx.lineWidth = lw(0.19);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.moveTo(px + nx * wide, py + ny * wide); ctx.lineTo(tx, ty); ctx.stroke();
    if (env.s > 1.3) {
      ctx.lineWidth = lw(0.08); ctx.beginPath(); const n = Math.max(6, Math.round(ul / 1.5));
      for (let i = 0; i < n; i++) { const u0 = i / n, u1 = (i + 1) / n, w0 = wide * (1 - u0), w1 = wide * (1 - u1); const a0 = i % 2 ? w0 : 0, a1 = i % 2 ? 0 : w1; ctx.moveTo(px + ux * u0 + nx * a0, py + uy * u0 + ny * a0); ctx.lineTo(px + ux * u1 + nx * a1, py + uy * u1 + ny * a1); }
      ctx.stroke();
    }
    circ(ctx, tx, ty, 0.3, steel); circ(ctx, px, py, 0.3, steel);
    if (S.pal.dark > 0.3 && Math.sin(env.t * 2.4 + x) > 0.2) { dkGlow(ctx, ax, ay + 0.2, 1.1, '255,70,50', 0.7); circ(ctx, ax, ay + 0.2, 0.15, '#ff5a48'); }
    ctx.restore();
  } });
  P.solid(x - g - 0.26, y, 0.52, legH, 'hard'); P.solid(x + g - 0.26, y, 0.52, legH, 'hard');
  return { x, tipX: x + reach, tipY: y + tipY, legs: [x - g, x + g] };
};

// A flashing amber lamp on a crane hook, so the block can be found after dark.
K.hookLight = function (S, ob) {
  const base = ob.draw;
  ob.draw = function (ctx, env) {
    base(ctx, env);
    if (!ob.alive || S.pal.dark <= 0.3) return;
    const on = Math.sin(env.t * 5.2) > -0.2;
    R4(ctx, ob.x - 0.2, ob.y - 0.22, 0.4, 0.44, '#e0a82e'); R4(ctx, ob.x - 0.11, ob.y - 0.13, 0.22, 0.26, '#20242b');
    if (on) dkGlow(ctx, ob.x, ob.y + 0.32, 1.0, '255,180,60', 0.6);
    circ(ctx, ob.x, ob.y + 0.32, 0.08, on ? '#ffd27a' : '#6a4a1a');
  };
  return ob;
};

// A channel buoy with a bell in its cage. The bell is a shootable lure.
K.buoy = function (S, P, x, wy, o) {
  o = o || {}; const red = S.tone(o.col || '#c0392b', P), dk = S.tone('#1f2329', P), lampCol = o.lamp || '#ff5a48';
  P.add({ x0: x - 2, x1: x + 2, layer: o.layer === undefined ? 1 : o.layer, draw(ctx, env) {
    const rock = Math.sin(env.t * 0.9 + x) * 0.05;
    ctx.save(); ctx.translate(x, wy); ctx.rotate(rock);
    poly(ctx, [-0.95, 0, 0.95, 0, 0.7, 0.8, -0.7, 0.8], red); R4(ctx, -0.95, -0.1, 1.9, 0.22, dk);
    ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.08, env.px * 0.8);
    ctx.beginPath(); ctx.moveTo(-0.6, 0.8); ctx.lineTo(-0.28, 2.95); ctx.moveTo(0.6, 0.8); ctx.lineTo(0.28, 2.95); ctx.moveTo(-0.5, 1.6); ctx.lineTo(0.5, 1.6); ctx.moveTo(-0.3, 2.95); ctx.lineTo(0.3, 2.95); ctx.stroke();
    R4(ctx, -0.14, 2.95, 0.28, 0.26, dk);
    if (S.pal.dark > 0.1) { const on = Math.sin(env.t * 1.7 + x * 0.3) > 0.55; if (on) dkGlow(ctx, 0, 3.32, 1.2, rgbOf(lampCol).join(','), 0.7); circ(ctx, 0, 3.32, 0.13, on ? lampCol : dk); }
    ctx.restore();
  } });
  if (o.bell === false) return null;
  return K.thing(S, P, 'bell', x, wy + 1.95, Object.assign({ id: 'bell', lure: 24, lureY: 0, r: 0.46 }, o.bell || {}));
};

// The freighter on the far berth. Its funnel smoke and stern flag show the
// wind, and S.hornUntil (set by H.horn) makes the whistle blow steam.
K.freighter = function (S, P, sx, wy, o) {
  o = o || {};
  const L = o.len || 78, D = o.deck === undefined ? 6 : o.deck, lit = S.pal.dark > 0.3;
  const hull = S.tone(o.hull || '#222a37', P), boot = S.tone('#8a2f28', P), white = S.tone('#dfe2e0', P), white2 = S.tone('#b9bfc2', P), dk = S.tone('#14181f', P);
  const fun = S.tone(o.funnel || '#b3312b', P), winC = S.tone(lit ? S.pal.lit : S.pal.glass, P, true), nameC = S.tone('#e9e4d6', P), buff = S.tone('#c9a25a', P), hatch = S.tone('#5d666f', P);
  const hx = sx + 4, fx = sx + 10.5, top = D + 1.6;      // deckhouse start, funnel centre, poop deck
  P.add({ x0: sx - 6, x1: sx + L + 6, layer: 0, draw(ctx, env) {
    // hull with raised poop and forecastle
    poly(ctx, [sx, top, sx + 26, top, sx + 26, D, sx + L - 13, D, sx + L - 13, top, sx + L + 3.4, D + 2.5, sx + L - 2.6, wy, sx + 1.6, wy, sx, wy + 3.2], hull);
    poly(ctx, [sx + 0.7, wy + 1.15, sx + L - 1.9, wy + 1.15, sx + L - 2.6, wy, sx + 1.6, wy], boot);
    R4(ctx, sx + 0.5, wy + 1.15, L - 2.3, 0.12, white2);
    R4(ctx, sx, top - 0.16, 26, 0.16, white2); R4(ctx, sx + L - 13, top - 0.1, 15, 0.14, white2);
    // hatches, deck cargo and cargo gear
    for (let i = 0; i < 3; i++) R4(ctx, sx + 29 + i * 11.5, D, 8.5, 1.0, hatch);
    R4(ctx, sx + 30, D + 1.0, 6.1, 2.4, S.tone('#a3402f', P)); R4(ctx, sx + 41.6, D + 1.0, 6.1, 2.4, S.tone('#2f5f8a', P)); R4(ctx, sx + 41.6, D + 3.4, 6.1, 2.4, S.tone('#c98a2b', P));
    ctx.strokeStyle = buff; ctx.lineWidth = Math.max(0.3, env.px);
    ctx.beginPath(); ctx.moveTo(sx + 39.2, D); ctx.lineTo(sx + 39.2, D + 11); ctx.moveTo(sx + L - 15, D); ctx.lineTo(sx + L - 15, D + 13); ctx.stroke();
    ctx.lineWidth = Math.max(0.16, env.px * 0.8);
    ctx.beginPath(); ctx.moveTo(sx + 39.2, D + 2); ctx.lineTo(sx + 31, D + 9.5); ctx.moveTo(sx + 39.2, D + 2); ctx.lineTo(sx + 48, D + 8.5); ctx.moveTo(sx + L - 15, D + 2); ctx.lineTo(sx + L - 25, D + 10.5); ctx.moveTo(sx + L - 17, D + 11); ctx.lineTo(sx + L - 13, D + 11); ctx.stroke();
    ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.05, env.px * 0.6);
    ctx.beginPath(); ctx.moveTo(sx + 39.2, D + 11); ctx.lineTo(sx + 31, D + 9.5); ctx.moveTo(sx + 39.2, D + 11); ctx.lineTo(sx + 48, D + 8.5); ctx.moveTo(sx + L - 15, D + 13); ctx.lineTo(sx + L - 25, D + 10.5); ctx.moveTo(sx + L - 15, D + 13); ctx.lineTo(sx + L + 2.6, D + 2.6); ctx.moveTo(sx + L - 15, D + 13); ctx.lineTo(hx + 12, top + 9.6); ctx.stroke();
    // deckhouse in three tiers, bridge on top
    R4(ctx, hx, top, 19, 2.7, white); R4(ctx, hx + 1, top + 2.7, 16, 2.6, white); R4(ctx, hx + 3.5, top + 5.3, 12.5, 2.5, white);
    R4(ctx, hx, top + 2.6, 19, 0.14, white2); R4(ctx, hx + 1, top + 5.2, 16, 0.14, white2); R4(ctx, hx + 2.5, top + 7.8, 15, 0.22, white2);
    ctx.fillStyle = winC; for (let i = 0; i < 7; i++) ctx.fillRect(hx + 4.2 + i * 1.65, top + 6.0, 1.2, 1.05);
    for (let t = 0; t < 2; t++) for (let i = 0; i < 8; i++) { if (dkHash(i * 3.1 + t * 7 + sx) < (lit ? 0.62 : 2)) { ctx.fillStyle = lit ? winC : dk; ctx.beginPath(); ctx.arc(hx + 2 + t + i * 2.0, top + 1.4 + t * 2.65, 0.3, 0, TAU); ctx.fill(); } }
    // funnel and its smoke
    poly(ctx, [fx - 2.2, top + 7.9, fx + 2.2, top + 7.9, fx + 1.9, top + 13, fx - 1.9, top + 13], fun); R4(ctx, fx - 1.95, top + 11.9, 3.9, 1.1, dk); R4(ctx, fx - 2.1, top + 9.6, 4.2, 0.9, white);
    env.text(ctx, 'C', fx, top + 9.72, 0.8, fun, 'center');
    line(ctx, hx + 12, top + 7.8, hx + 12, top + 12.4, buff, 0.2, env); line(ctx, hx + 10.6, top + 10.8, hx + 13.4, top + 10.8, buff, 0.12, env);
    ctx.fillStyle = S.pal.dark > 0.5 ? 'rgba(110,120,140,0.22)' : 'rgba(70,72,80,0.3)';
    for (let i = 0; i < 9; i++) { const u = ((env.t * 0.1 + i / 9) % 1); ctx.globalAlpha = (1 - u) * 0.9; ctx.beginPath(); ctx.arc(fx + env.wind * u * u * 5 + Math.sin(u * 6 + i) * 0.5, top + 13.3 + u * 9, 0.8 + u * 2.6, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (S.hornUntil && env.t < S.hornUntil) { // whistle steam while the horn sounds
      const k = clamp((env.t - S.hornFrom) / 0.4, 0, 1) * clamp((S.hornUntil - env.t) / 0.6, 0, 1); ctx.fillStyle = 'rgba(238,242,246,0.75)';
      for (let i = 0; i < 7; i++) { const u = ((env.t * 0.9 + i / 7) % 1); ctx.globalAlpha = (1 - u) * 0.8 * k; ctx.beginPath(); ctx.arc(fx + 2.4 + env.wind * u * 1.6 + u * 1.2, top + 11.4 + u * 4.4, 0.35 + u * 1.5, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    env.text(ctx, o.name || 'CALDER STAR', sx + L - 13.5, D - 1.75, 1.2, nameC, 'right');
    // anchor, rail and mooring lines
    R4(ctx, sx + L - 4.6, D - 1.2, 0.5, 1.5, dk);
    ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.05, env.px * 0.6);
    ctx.beginPath(); ctx.moveTo(sx + 26, D + 1); ctx.lineTo(sx + L - 13, D + 1); ctx.moveTo(sx + L - 12, top - 0.3); ctx.lineTo(sx + L + 12, 0.6); ctx.moveTo(sx + L - 6, top - 0.6); ctx.lineTo(sx + L - 22, 0.6); ctx.stroke();
    if (lit) { // working lights
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const pts = [[sx + 39.2, D + 11.2, 2.4], [sx + L - 15, D + 13.2, 2.2], [hx + 12, top + 12.6, 1.6], [hx + 9, top + 8.3, 3.2]];
      for (let i = 0; i < pts.length; i++) { const q = pts[i], gr = ctx.createRadialGradient(q[0], q[1], 0.1, q[0], q[1], q[2]); gr.addColorStop(0, 'rgba(255,232,170,' + (0.5 * S.pal.dark) + ')'); gr.addColorStop(1, 'rgba(255,232,170,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(q[0], q[1], q[2], 0, TAU); ctx.fill(); }
      ctx.restore();
      circ(ctx, sx + 39.2, D + 11.2, 0.22, '#fff3c4'); circ(ctx, sx + L - 15, D + 13.2, 0.22, '#fff3c4');
    }
  } });
  P.solid(sx, wy - 4, L, D - wy + 4, 'hard'); P.solid(hx, top, 19, 7.8, 'wall'); P.solid(sx + L - 13, D, 15, 1.6, 'hard'); P.solid(sx, D, 26, 1.6, 'hard');
  K.flag(S, P, sx + 0.8, top, 4.6, '#c0392b', { layer: 0 });
  return { sx, L, deckY: D, x0: sx + 27, x1: sx + L - 14, funnel: [fx, top + 13] };
};

// A lighthouse on the end of the breakwater. The beam sweeps at night and in fog.
K.lighthouse = function (S, P, x, y, h) {
  const w = S.tone('#e3e1d8', P), r = S.tone('#b3312b', P), dk = S.tone('#20242b', P), beamOn = S.pal.dark > 0.3 || S.weather === 'fog';
  P.add({ x0: x - 140, x1: x + 140, layer: 1, draw(ctx, env) {
    poly(ctx, [x - 2.6, y, x + 2.6, y, x + 1.7, y + h, x - 1.7, y + h], w);
    poly(ctx, [x - 2.3, y + h * 0.32, x + 2.3, y + h * 0.32, x + 2.05, y + h * 0.58, x - 2.05, y + h * 0.58], r);
    R4(ctx, x - 2.3, y + h, 4.6, 0.5, dk); R4(ctx, x - 1.3, y + h + 0.5, 2.6, 2.3, beamOn ? '#fff3c4' : S.tone(S.pal.glass, P)); poly(ctx, [x - 1.8, y + h + 2.8, x + 1.8, y + h + 2.8, x, y + h + 4.6], r);
    if (!beamOn) return;
    const ph = env.t * 0.55, c = Math.cos(ph), ly = y + h + 1.6;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let side = -1; side <= 1; side += 2) {
      const reach = 120 * Math.abs(c), dirx = side * (c >= 0 ? 1 : -1), a = 0.07 + 0.2 * (1 - Math.abs(c));
      const g = ctx.createLinearGradient(x, 0, x + dirx * (reach + 6), 0); g.addColorStop(0, 'rgba(255,244,205,' + a + ')'); g.addColorStop(1, 'rgba(255,244,205,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, ly - 0.5); ctx.lineTo(x + dirx * (reach + 6), ly - 5 - reach * 0.05); ctx.lineTo(x + dirx * (reach + 6), ly + 5 + reach * 0.05); ctx.lineTo(x, ly + 0.5); ctx.closePath(); ctx.fill();
    }
    const fl = 0.35 + 0.65 * Math.pow(1 - Math.abs(c), 3), gr = ctx.createRadialGradient(x, ly, 0.2, x, ly, 9); gr.addColorStop(0, 'rgba(255,246,214,' + fl + ')'); gr.addColorStop(1, 'rgba(255,246,214,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, ly, 9, 0, TAU); ctx.fill();
    ctx.restore();
  } });
};

// A flat steel supply barge. Its deck is where the crew work.
K.supplyBarge = function (S, P, x, wy, o) {
  o = o || {}; const L = o.len || 30, D = wy + 1.3;
  const hull = S.tone('#3a3f47', P), rust = S.tone('#7a4a34', P), dk = S.tone('#1b1e24', P), deck = S.tone('#5a616a', P), hut = S.tone('#6f7f6a', P), tarp = S.tone('#55683f', P), tarp2 = S.tone('#3f4f30', P);
  const room = S.room('barge:hut', S.pal.dark > 0.3);
  P.add({ x0: x - 1, x1: x + L + 1, layer: 0, draw(ctx, env) {
    poly(ctx, [x, D, x + L, D, x + L - 1.5, wy - 0.05, x + 1.5, wy - 0.05], hull);
    R4(ctx, x, D - 0.16, L, 0.16, deck); R4(ctx, x + 0.2, D - 0.3, L - 0.4, 0.09, S.tone('#c9ced3', P, true)); R4(ctx, x + 1.2, wy, L - 2.4, 0.3, rust);
    if (env.s > 3) { ctx.fillStyle = rust; for (let i = 0; i < 7; i++) ctx.fillRect(x + 2.5 + i * 4.1, D - 0.9 - dkHash(i + x) * 0.3, 0.5 + dkHash(i * 3 + x) * 1.4, 0.07); }
    env.text(ctx, o.name || 'TENDER 9', x + L - 2.2, D - 0.95, 0.5, S.tone('#d7d2c4', P), 'right');
    // deck hut at the left end
    R4(ctx, x + 1.2, D, 3.6, 2.5, hut); R4(ctx, x + 1.0, D + 2.5, 4.0, 0.22, dk);
    R4(ctx, x + 1.7, D + 1.1, 1.2, 0.95, room.lit ? S.tone(S.pal.lit, P, true) : S.tone(S.pal.inRoom, P)); R4(ctx, x + 3.5, D, 0.95, 1.95, dk);
    // cargo under a tarpaulin amidships
    poly(ctx, [x + 9.5, D, x + 15.5, D, x + 15.0, D + 1.5, x + 13.2, D + 1.9, x + 10.2, D + 1.4], tarp);
    if (env.s > 3) { ctx.strokeStyle = tarp2; ctx.lineWidth = Math.max(0.05, env.px * 0.6); ctx.beginPath(); ctx.moveTo(x + 11.2, D + 1.55); ctx.lineTo(x + 10.9, D); ctx.moveTo(x + 13.2, D + 1.9); ctx.lineTo(x + 13.3, D); ctx.moveTo(x + 14.6, D + 1.6); ctx.lineTo(x + 14.9, D); ctx.stroke(); }
    // bollards
    R4(ctx, x + 0.4, D, 0.4, 0.42, dk); R4(ctx, x + L - 0.8, D, 0.4, 0.42, dk);
  } });
  P.solid(x, wy - 3, L, D - wy + 3, 'hard'); P.solid(x + 1.2, D, 3.6, 2.5, 'wall'); P.solid(x + 9.6, D, 5.8, 1.4, 'thin');
  return { x0: x, x1: x + L, y: D, L };
};

// Maeve Calloway's yacht. Aft deck, a glazed saloon, a sun deck above it and a
// foredeck. Each deck is its own zone with its own lamp.
K.yacht = function (S, P, x, wy, o) {
  o = o || {};
  const L = 36, D = wy + 2.7, sunY = D + 3.0, foreY = D + 0.7, lit = S.pal.dark > 0.3;
  const white = S.tone('#e9e6dd', P), white2 = S.tone('#c3c3bd', P), navy = S.tone('#1e2a44', P), gold = S.tone('#c9a23a', P, true), teak = S.tone('#8a6844', P), dk = S.tone('#161a21', P), glass = S.tone(S.pal.glass, P);
  const sal = S.room('yacht:saloon', true);
  const sx0 = x + 11, sx1 = x + 23;                       // saloon walls
  const wins = [];
  for (let i = 0; i < 3; i++) wins.push(P.open({ x: sx0 + 0.9 + i * 3.7, y: D + 0.85, w: 2.9, h: 1.45, room: sal.id, glass: true, blind: 0, deco: 4, tint: '#ffe2a6', f: 0, c: i }));
  P.add({ x0: x - 1, x1: x + L + 3, layer: 0, draw(ctx, env) {
    // hull: a long sheer line and a raked bow
    poly(ctx, [x, D, x + 22.5, D, x + 23.5, foreY, x + L + 1.6, foreY + 0.55, x + L - 3.4, wy - 0.05, x + 1.1, wy - 0.05], white);
    poly(ctx, [x + 0.75, wy + 0.75, x + L - 2.55, wy + 0.75, x + L - 3.4, wy - 0.05, x + 1.1, wy - 0.05], navy);
    R4(ctx, x + 0.3, D - 0.55, 21.5, 0.09, gold);
    ctx.fillStyle = lit ? S.tone(S.pal.lit, P, true) : dk; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x + 4 + i * 4.6, D - 1.15, 0.24, 0, TAU); ctx.fill(); }
    env.text(ctx, o.name || 'SILVER TIDE', x + 1.2, D - 1.0, 0.44, gold, 'left');
    // decks
    R4(ctx, x, D - 0.1, 22.5, 0.1, teak); R4(ctx, x + 23.5, foreY - 0.1, L - 22.6, 0.1, teak);
    // saloon and the wheelhouse above its forward end
    R4(ctx, sx0, D, sx1 - sx0, 2.9, white); R4(ctx, sx0 - 0.5, D + 2.9, sx1 - sx0 + 0.9, 0.16, white2);
    for (let i = 0; i < wins.length; i++) drawWindowBack(ctx, env, S, P, wins[i], glass, S.tone(S.pal.inRoom, P));
    R4(ctx, x + 18.2, sunY, 5.3, 2.3, white); poly(ctx, [x + 18.2, sunY + 2.3, x + 23.5, sunY + 2.3, x + 22.6, sunY + 2.75, x + 18.6, sunY + 2.75], white2);
    poly(ctx, [x + 20.3, sunY + 0.95, x + 23.2, sunY + 0.95, x + 22.9, sunY + 1.95, x + 20.3, sunY + 1.95], lit ? S.tone('#3a4a66', P, true) : glass);
    R4(ctx, x + 18.6, sunY + 0.1, 0.9, 1.9, navy);
    // mast, radar and aerials
    line(ctx, x + 20.4, sunY + 2.75, x + 19.9, sunY + 6.4, white2, 0.16, env); R4(ctx, x + 19.3, sunY + 4.3, 1.6, 0.22, white2); line(ctx, x + 21.6, sunY + 2.75, x + 21.6, sunY + 5.2, dk, 0.04, env);
    // steps from the aft deck to the sun deck
    ctx.strokeStyle = white2; ctx.lineWidth = Math.max(0.09, env.px * 0.8); ctx.beginPath(); ctx.moveTo(x + 8.0, D); ctx.lineTo(x + 11.0, sunY); ctx.stroke();
    if (env.s > 3) { ctx.lineWidth = Math.max(0.05, env.px * 0.6); ctx.beginPath(); for (let i = 1; i < 8; i++) { const u = i / 8; ctx.moveTo(x + 8.0 + u * 3.0, D + u * 3.0); ctx.lineTo(x + 8.0 + u * 3.0 + 0.34, D + u * 3.0); } ctx.stroke(); }
    // aft deck furniture: a table and a bench
    line(ctx, x + 4.6, D, x + 4.6, D + 0.72, dk, 0.07, env); R4(ctx, x + 4.0, D + 0.72, 1.2, 0.07, white2); R4(ctx, x + 0.7, D, 1.7, 0.5, navy);
  } });
  P.add({ x0: x - 1, x1: x + L + 3, layer: 1, draw(ctx, env) { for (let i = 0; i < wins.length; i++) drawWindowFront(ctx, env, S, P, wins[i], white2, true); } });
  P.add({ x0: x - 1, x1: x + L + 3, layer: 2, draw(ctx, env) {
    // rails in front of everyone on deck
    ctx.strokeStyle = S.tone('#cfd4d9', P); ctx.lineWidth = Math.max(0.035, env.px * 0.6);
    ctx.beginPath();
    ctx.moveTo(x + 0.1, D + 0.95); ctx.lineTo(x + 8.0, D + 0.95); ctx.moveTo(sx0 - 0.4, sunY + 0.95); ctx.lineTo(x + 18.2, sunY + 0.95); ctx.moveTo(x + 23.6, foreY + 0.85); ctx.lineTo(x + L + 1.2, foreY + 1.35);
    if (env.s > 2.5) { for (let xx = x + 0.1; xx <= x + 8.01; xx += 1.58) { ctx.moveTo(xx, D); ctx.lineTo(xx, D + 0.95); } for (let xx = sx0 - 0.4; xx < x + 18.2; xx += 1.5) { ctx.moveTo(xx, sunY); ctx.lineTo(xx, sunY + 0.95); } for (let i = 0; i <= 6; i++) { const u = i / 6, xx = x + 23.6 + u * (L - 22.4); ctx.moveTo(xx, foreY + u * 0.5); ctx.lineTo(xx, foreY + 0.85 + u * 0.5); } }
    ctx.stroke();
    // a string of party lights from the masthead down to the stern
    const ax = x + 19.9, ay = sunY + 6.4, bx = x + 0.2, by = D + 2.5;
    ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.02, env.px * 0.5); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2, by + 1.0, bx, by); ctx.stroke();
    line(ctx, bx, D, bx, by, S.tone('#cfd4d9', P), 0.05, env);
    const cols = ['#ffd27a', '#ff8a6a', '#9fe0ff', '#ffe9b0'];
    for (let i = 1; i < 14; i++) { const u = i / 14, qx = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * ((ax + bx) / 2) + u * u * bx, qy = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * (by + 1.0) + u * u * by - 0.1;
      if (lit) dkGlow(ctx, qx, qy, 0.75, rgbOf(cols[i % 4]).join(','), 0.5);
      circ(ctx, qx, qy, 0.09, lit ? cols[i % 4] : S.tone(cols[i % 4], P)); }
  } });
  K.pennant(S, P, x + 19.9, sunY + 6.4, 1.6, '#c0392b');
  P.solid(x, wy - 3, L, D - wy + 3, 'hard'); P.solid(x + 23.5, D, L - 22.4, 0.7, 'hard');
  P.solid(sx0, D, sx1 - sx0, 2.95, 'wall'); P.solid(x + 18.2, sunY, 5.3, 2.5, 'wall');
  return { x, L, deckY: D, sunY, foreY, room: sal.id, aft: [x + 0.6, x + 10.6], sun: [sx0 - 0.1, x + 17.9], fore: [x + 24, x + L - 1.5], sal: [sx0 + 0.6, sx1 - 0.6], stairs: [x + 8.0, x + 11.0] };
};

// A rowing skiff with someone fishing from it. Returns where they sit.
K.skiff = function (S, P, x, wy, o) {
  o = o || {}; const hull = S.tone(o.col || '#6f7f6a', P), dk = S.tone('#2a2620', P), trim = S.tone('#d9d2c0', P);
  P.add({ x0: x - 3, x1: x + 5, layer: 2, draw(ctx, env) {
    poly(ctx, [x - 2.0, wy + 0.62, x + 2.2, wy + 0.7, x + 1.5, wy - 0.05, x - 1.6, wy - 0.05], hull); R4(ctx, x - 1.95, wy + 0.52, 4.05, 0.08, trim);
    ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.035, env.px * 0.6);
    ctx.beginPath(); ctx.moveTo(x + 0.35, wy + 1.25); ctx.lineTo(x + 3.1, wy + 2.3); ctx.lineTo(x + 3.3, wy + 0.05 + Math.sin(env.t * 1.3) * 0.04); ctx.stroke();
    circ(ctx, x + 3.3, wy + 0.05, 0.07, S.tone('#c8372d', P, true));
  } });
  return { plane: P, x, y: wy + 0.22, zone: o.zone || 'quay', behind: false, room: null };
};

// A sailing boat moored out in the basin. Her mast, and the bundle of furled
// sail at its head, stand between some shooting positions and the quay: from
// one place they hide something, from another they are out of the way.
K.ketch = function (S, P, x, wy, o) {
  o = o || {};
  const top = o.top || 9, w = o.w || 1.8, h = o.h || 1.7, off = o.off || 0, hx0 = x + (o.hull ? o.hull[0] : -9), hx1 = x + (o.hull ? o.hull[1] : 3);
  const hull = S.tone(o.col || '#27483a', P), trim = S.tone('#d9d2c0', P), spar = S.tone('#8a6d4c', P), sail = S.tone('#cdbf9f', P, true), sail2 = S.tone('#8f8064', P, true), dk = S.tone('#1b1e24', P);
  P.add({ x0: Math.min(hx0, x + off - w) - 2, x1: Math.max(hx1, x + off + w) + 3, layer: 1, draw(ctx, env) {
    poly(ctx, [hx0, wy + 1.15, hx1 + 1.3, wy + 1.4, hx1 - 0.7, wy - 0.05, hx0 + 0.7, wy - 0.05], hull); R4(ctx, hx0 + 0.1, wy + 0.92, hx1 - hx0 + 1.0, 0.1, trim);
    line(ctx, x, wy + 1.1, x, top + h / 2 + 1.0, spar, 0.2, env);
    const bd = hx0 + 1 < x - 1 ? -1 : 1, bl = Math.min(6, Math.abs((bd < 0 ? hx0 : hx1) - x) - 1);
    line(ctx, x, wy + 2.3, x + bd * bl, wy + 2.5, spar, 0.16, env); R4(ctx, Math.min(x, x + bd * bl) + 0.3, wy + 2.5, bl - 0.6, 0.42, sail);
    ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.03, env.px * 0.55);
    ctx.beginPath(); ctx.moveTo(x, top + h / 2 + 0.9); ctx.lineTo(hx0 + 0.4, wy + 1.2); ctx.moveTo(x, top + h / 2 + 0.9); ctx.lineTo(hx1 + 0.9, wy + 1.4); ctx.stroke();
    // furled topsail lashed to its yard at the masthead
    line(ctx, x + off - w / 2 - 0.5, top + h / 2, x + off + w / 2 + 0.5, top + h / 2, spar, 0.16, env);
    const sx0 = x + off - w / 2, sy0 = top - h / 2;
    ctx.fillStyle = sail; ctx.beginPath(); ctx.moveTo(sx0, sy0 + h); ctx.lineTo(sx0 + w, sy0 + h); ctx.quadraticCurveTo(sx0 + w + 0.12, sy0 + h * 0.4, sx0 + w - 0.2, sy0); ctx.lineTo(sx0 + 0.2, sy0); ctx.quadraticCurveTo(sx0 - 0.12, sy0 + h * 0.4, sx0, sy0 + h); ctx.fill();
    if (env.s > 2) { ctx.strokeStyle = sail2; ctx.lineWidth = Math.max(0.05, env.px * 0.6); ctx.beginPath(); for (let i = 1; i < 6; i++) { const u = i / 6; ctx.moveTo(sx0 + w * u, sy0 + h); ctx.quadraticCurveTo(sx0 + w * u + 0.1, sy0 + h * 0.5, sx0 + w * u - 0.05, sy0); } ctx.stroke(); }
  } });
  P.solid(x + off - w / 2, top - h / 2, w, h, 'hard');
  K.pennant(S, P, x, top + h / 2 + 1.0, 1.3, '#e2b33c');
};

// ---- boats that move ---------------------------------------------------------
// An open launch: a helmsman under a little canopy forward, passengers on the
// thwarts aft. Nobody is behind glass, so both "windows" count as open.
CARS.launch = { len: 7.6, h: 2.75, body: 0.85, cab: [0, 0], win: [[-0.44, 0.04], [0.08, 0.36]], seats: [0.22, -0.2, -0.36], wheel: 0,
  draw(ctx, env, S, P, x, y, dir, colHex, st) {
    const L = 7.6, col = S.tone(colHex || '#3d4f5c', P, true), dk = S.tone(darken(colHex || '#3d4f5c', 0.35), P), trim = S.tone('#d9d2c0', P, true), steel = S.tone('#1b1e24', P), lit = S.pal.dark > 0.3;
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    const wl = 0.25; // the waterline: the hull below this is under water
    if (st && st.moving) { // bow wave and wake
      ctx.strokeStyle = 'rgba(225,236,246,0.6)'; ctx.lineWidth = Math.max(0.07, env.px);
      ctx.beginPath();
      for (let i = 0; i < 5; i++) { const u = ((env.t * 1.4 + i / 5) % 1); ctx.moveTo(-L / 2 - 0.3 - u * 5.5, wl + 0.02 + (i % 2) * 0.07); ctx.lineTo(-L / 2 - 1.2 - u * 5.5, wl + 0.02 + (i % 2) * 0.07); }
      ctx.moveTo(L / 2 - 0.2, wl + 0.05); ctx.quadraticCurveTo(L / 2 + 0.5, wl + 0.5, L / 2 - 1.2, wl + 0.02);
      ctx.stroke();
    }
    R4(ctx, -L / 2 - 0.34, wl + 0.05, 0.36, 0.95, steel); R4(ctx, -L / 2 - 0.4, wl + 0.85, 0.5, 0.3, steel);     // outboard motor
    poly(ctx, [-L / 2, 0.85, L / 2 + 0.55, 0.98, L / 2 - 0.55, wl, -L / 2 + 0.12, wl], col);
    poly(ctx, [-L / 2 + 0.02, 0.66, L / 2 + 0.3, 0.76, L / 2 + 0.4, 0.86, -L / 2 + 0.01, 0.76], trim);
    R4(ctx, -L / 2 + 0.1, wl, L - 0.7, 0.1, dk);
    // canopy over the helm, on two posts, with a windscreen
    line(ctx, 0.7, 0.85, 0.7, 2.5, steel, 0.07, env); line(ctx, 2.62, 0.85, 2.5, 2.5, steel, 0.07, env);
    R4(ctx, 0.45, 2.5, 2.4, 0.13, dk); line(ctx, 2.62, 0.95, 2.95, 1.75, trim, 0.05, env);
    R4(ctx, 2.2, 0.85, 0.42, 0.62, dk);
    // cargo and a stern lantern on a staff
    R4(ctx, -0.55, 0.85, 0.7, 0.42, S.tone('#8a6a45', P)); R4(ctx, -3.3, 0.85, 0.5, 0.36, S.tone('#6f7f6a', P));
    line(ctx, -L / 2 + 0.3, 0.85, -L / 2 + 0.3, 2.35, steel, 0.05, env);
    circ(ctx, -L / 2 + 0.3, 2.42, 0.11, lit ? '#fff3c4' : trim);
    if (lit) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(-L / 2 + 0.3, 2.42, 0.05, -L / 2 + 0.3, 2.42, 2.6); g.addColorStop(0, 'rgba(255,226,150,' + (0.5 * S.pal.dark) + ')'); g.addColorStop(1, 'rgba(255,226,150,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(-L / 2 + 0.3, 2.42, 2.6, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      dkGlow(ctx, 2.75, 2.7, 0.7, dir > 0 ? '90,255,140' : '255,80,60', 0.6);
    }
    circ(ctx, 2.75, 2.7, 0.07, dir > 0 ? '#6dff9a' : '#ff5a48');
    ctx.restore();
  } };
// The night ferry: scenery that crosses the channel with all its windows lit.
CARS.ferry = { len: 54, h: 12, body: 4.2, cab: [-0.5, 0.5], win: [], seats: [], wheel: 0, solid: true,
  draw(ctx, env, S, P, x, y, dir, colHex) {
    const L = 54, white = S.tone('#dfe2e0', P), hull = S.tone(colHex || '#1f3350', P), winC = S.tone(S.pal.dark > 0.3 ? S.pal.lit : S.pal.glass, P, true), fun = S.tone('#c98a2b', P), dk = S.tone('#14181f', P);
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    poly(ctx, [-L / 2, 4.2, L / 2 + 2, 4.6, L / 2 - 3, 0, -L / 2 + 1, 0], hull); R4(ctx, -L / 2 + 0.3, 3.4, L + 0.4, 0.3, white);
    R4(ctx, -L / 2 + 3, 4.2, L - 11, 2.5, white); R4(ctx, -L / 2 + 6, 6.7, L - 18, 2.4, white); R4(ctx, L / 2 - 17, 9.1, 7, 1.9, white);
    poly(ctx, [-L / 2 + 13, 9.1, -L / 2 + 18, 9.1, -L / 2 + 17, 12, -L / 2 + 13.5, 12], fun); R4(ctx, -L / 2 + 13.4, 11.2, 3.8, 0.8, dk);
    ctx.fillStyle = winC;
    for (let i = 0; i < 17; i++) ctx.fillRect(-L / 2 + 4.2 + i * 2.4, 4.9, 1.5, 1.1);
    for (let i = 0; i < 13; i++) ctx.fillRect(-L / 2 + 7.2 + i * 2.4, 7.3, 1.5, 1.1);
    ctx.fillRect(L / 2 - 16.3, 9.6, 5.6, 0.9);
    if (S.pal.dark > 0.3) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,214,130,0.16)'; ctx.fillRect(-L / 2 + 2, -4.5, L - 8, 4.5); ctx.globalCompositeOperation = 'source-over'; }
    ctx.restore();
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
  const lit = S.pal.dark > 0.3, night = S.pal.dark > 0.5;
  const H = { S, z, wy, end, pierEnd };

  // ---- far away: city, far shore, breakwater, channel ----
  K.skyline(S, z + 1700, { seed: 31 + seed, hMin: 16, hMax: 84, base: -40, ground: false, x0: -1300, x1: 1300 });
  const PFS = S.plane(z + 900, 'farshore');
  {
    const hill = S.tone('#3c4a52', PFS), craneC = S.tone('#55626c', PFS), lampC = S.tone(S.pal.lit, PFS, true);
    const pts = []; for (let x = -900; x <= 900; x += 30) pts.push([x, wy + 5 + 26 * (0.5 + 0.5 * vnoise(x / 190, seed + 9)) * (0.6 + 0.4 * vnoise(x / 61, seed + 3))]);
    PFS.add({ x0: -900, x1: 900, layer: 0, draw(ctx, env) {
      ctx.fillStyle = hill; ctx.beginPath(); ctx.moveTo(-900, wy - 1); for (let i = 0; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.lineTo(900, wy - 1); ctx.closePath(); ctx.fill();
      // the container terminal across the water: a row of big cranes
      ctx.strokeStyle = craneC; ctx.lineWidth = Math.max(1.4, env.px);
      ctx.beginPath();
      for (let i = 0; i < 5; i++) { const cx = -250 + i * 58; ctx.moveTo(cx - 9, wy); ctx.lineTo(cx - 9, wy + 46); ctx.moveTo(cx + 9, wy); ctx.lineTo(cx + 9, wy + 46); ctx.moveTo(cx - 34, wy + 34); ctx.lineTo(cx + 24, wy + 34); ctx.moveTo(cx - 9, wy + 46); ctx.lineTo(cx - 34, wy + 34); ctx.moveTo(cx + 9, wy + 46); ctx.lineTo(cx + 24, wy + 34); ctx.moveTo(cx - 9, wy + 18); ctx.lineTo(cx + 9, wy + 18); }
      ctx.stroke();
      if (lit) { ctx.fillStyle = lampC; for (let i = 0; i < 70; i++) { const lx = -880 + dkHash(i * 1.7 + seed) * 1760; if (lx < env.x0 || lx > env.x1) continue; ctx.fillRect(lx, wy + 1 + dkHash(i * 5.3) * 7, 2.2, 2.2); }
        if (Math.sin(env.t * 2.1) > 0) { ctx.fillStyle = '#ff5a48'; for (let i = 0; i < 5; i++) ctx.fillRect(-250 + i * 58 - 1.5, wy + 46, 3, 3); } }
    } });
    K.sea(S, PFS, { y: wy, rows: 4, sheen: S.weather === 'rain' || S.weather === 'storm' ? null : S.pal.skyBot, sheenD: 150, seed: 3 });
  }
  const PBW = S.plane(z + 400, 'breakwater');
  {
    const stone = S.tone('#565d63', PBW), stone2 = S.tone('#6b7278', PBW), bx1 = o.lightX === undefined ? 96 : o.lightX;
    K.sea(S, PBW, { y: wy, rows: 5, seed: 5, lights: lit ? [{ x: bx1, col: 'rgba(255,240,200,0.55)', len: 40, w: 5, a: 0.3 }] : [] });
    PBW.add({ x0: -1200, x1: bx1 + 8, layer: 1, draw(ctx, env) {
      const xa = Math.max(env.x0 - 4, -1200), xb = Math.min(env.x1 + 4, bx1 + 6); if (xb <= xa) return;
      R4(ctx, xa, wy - 0.4, xb - xa, 3.2, stone); R4(ctx, xa, wy + 2.5, xb - xa, 0.5, stone2);
      ctx.fillStyle = stone2; const a = Math.floor(xa / 9) * 9; for (let x = a; x < xb; x += 9) ctx.fillRect(x + dkHash(x) * 5, wy + 0.3 + dkHash(x * 3) * 1.4, 3 + dkHash(x * 7) * 3, 0.5);
    } });
    K.lighthouse(S, PBW, bx1, wy + 2.8, 19);
    H.PBW = PBW;
  }
  const PCH = S.plane(z + 135, 'channel');
  K.sea(S, PCH, { y: wy, rows: 6, seed: 8, lights: lit ? [{ x: 0.092 * (z + 135), col: rgba(S.pal.sun, 0.5), len: 34, w: 3.4, a: S.weather === 'clear' ? 0.26 : 0 }] : [] });
  K.buoy(S, PCH, o.farBuoyX === undefined ? 86 : o.farBuoyX, wy, { bell: false, col: '#2f7a4a', lamp: '#6dff9a' });
  if (o.anchored !== false) { // a fishing boat lying at anchor out in the channel
    const ax = o.anchoredX === undefined ? 50 : o.anchoredX, hc = S.tone('#3d4f5c', PCH), wc = S.tone('#d9d2c0', PCH), dkc = S.tone('#1b1e24', PCH), wn = S.tone(lit ? S.pal.lit : S.pal.glass, PCH, true);
    PCH.add({ x0: ax - 12, x1: ax + 12, layer: 1, draw(ctx, env) {
      poly(ctx, [ax - 8, wy + 1.9, ax + 9.5, wy + 2.4, ax + 7, wy - 0.05, ax - 7, wy - 0.05], hc); R4(ctx, ax - 7.8, wy + 1.55, 16.6, 0.16, wc);
      R4(ctx, ax - 5.6, wy + 1.9, 4.6, 2.5, wc); R4(ctx, ax - 5.0, wy + 2.95, 3.3, 0.95, wn); R4(ctx, ax - 5.9, wy + 4.4, 5.2, 0.25, dkc);
      line(ctx, ax + 1.6, wy + 2.1, ax + 1.6, wy + 9.6, dkc, 0.26, env); line(ctx, ax + 1.6, wy + 7.6, ax + 7.6, wy + 4.2, dkc, 0.16, env); line(ctx, ax + 1.6, wy + 9.4, ax - 7.6, wy + 2.0, dkc, 0.05, env);
      if (lit) { dkGlow(ctx, ax + 1.6, wy + 9.9, 2.2, '255,240,200', 0.55); circ(ctx, ax + 1.6, wy + 9.9, 0.3, '#fff3c4'); }
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
  K.ground(S, PB, { col: mix(S.pal.ground, '#2a2e36', 0.25), x1: end, noEdge: true });
  PB.groundFn = (x) => (x <= end ? 0 : -1e6);
  H.PB = PB;
  {
    // warehouse: corrugated shed with a sliding door and a painted name
    const wx = -62, ww = 26, wh = 8.2, wall = S.tone('#556470', PB), rib = S.tone('#46535e', PB), roof = S.tone('#343c44', PB), door = S.tone('#2b2420', PB), paint = S.tone('#d9d2c0', PB), glowC = S.tone(S.pal.lit, PB, true);
    PB.add({ x0: wx - 1, x1: wx + ww + 1, layer: 0, draw(ctx, env) {
      R4(ctx, wx, 0, ww, wh, wall);
      if (env.s > 2.2) { ctx.fillStyle = rib; for (let x = Math.max(wx + 0.3, Math.floor(env.x0)); x < Math.min(wx + ww, env.x1); x += 0.45) ctx.fillRect(x, 0.1, 0.1, wh - 0.2); }
      poly(ctx, [wx - 0.5, wh, wx + ww + 0.5, wh, wx + ww + 0.5, wh + 0.5, wx + ww / 2, wh + 2.1, wx - 0.5, wh + 0.5], roof);
      R4(ctx, wx + 13.2, 0, 7.2, 5.2, door); R4(ctx, wx + 13.2, 5.2, 7.2, 0.3, roof);
      if (lit) { R4(ctx, wx + 17.9, 0, 2.5, 5.2, glowC); R4(ctx, wx + 18.3, 0, 1.3, 1.6, door); }
      R4(ctx, wx + 13.0, 6.05, 12.6, 1.5, wall);
      env.text(ctx, 'CALDER WHARF', wx + 19.3, 6.3, 1.0, paint, 'center'); env.text(ctx, 'SHED 4', wx + 6.6, 3.0, 1.3, paint, 'center');
    } });
    PB.solid(wx, 0, ww, wh, 'wall');
    const B = K.building(S, PB, { x: wx + ww, w: 9, floors: 2, fh: 3.5, id: 'off', wall: '#7a6156', seed: 5 + seed, ac: false, parapet: 0.6, door: 0, antenna: 0.72,
      spans: { 1: [[0, 1, 'room', lit || o.officeLit === true]] }, wins: { '0,0': { none: true }, '0,1': { lit: false, blind: 0.4 }, '1,0': { blind: 0 }, '1,1': { blind: 0 } } });
    H.off = B; H.office = 'off:room';
    H.inOffice = (x, extra) => Object.assign({ plane: PB, x: x === undefined ? B.winX(1) : x, y: B.floorY(1), room: 'off:room', zone: 'off:room', behind: true }, extra || {});
    PB.add({ x0: B.x, x1: B.x + B.w, layer: 1, draw(ctx, env) { R4(ctx, B.x + 4.6, 2.55, 3.8, 0.7, S.tone('#1c1f26', PB)); env.text(ctx, 'HARBOUR OFFICE', B.x + 6.5, 2.74, 0.4, S.tone('#f3e9c9', PB, true), 'center'); } });
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
  if (o.fuse !== false) { const f = o.fuse || {}; H.fuse = K.thing(S, PB, 'fuse', f.x === undefined ? -27.6 : f.x, f.y === undefined ? 1.9 : f.y, { id: 'fuse', cuts: f.cuts || ['quay'] }); }
  if (o.gate) { // the dock gate at the landward end: fence, booth and a raised barrier
    const gx = o.gate.x === undefined ? -44 : o.gate.x, dk = S.tone('#22262d', PB), booth = S.tone('#8a8f7a', PB), sign = S.tone('#1c1f26', PB);
    K.fence(S, PB, gx - 30, gx - 4.5, 3.2, { kind: 'mesh', layer: 1 });
    PB.add({ x0: gx - 6, x1: gx + 6, layer: 1, draw(ctx, env) {
      R4(ctx, gx - 4.6, 0, 0.3, 4.6, dk); R4(ctx, gx + 3.6, 0, 0.3, 4.6, dk); R4(ctx, gx - 4.6, 4.0, 8.5, 0.9, sign); env.text(ctx, 'PORT CALDER  GATE 3', gx - 0.35, 4.25, 0.5, S.tone('#f3e9c9', PB, true), 'center');
      R4(ctx, gx + 4.2, 0, 2.6, 2.7, booth); R4(ctx, gx + 4.0, 2.7, 3.0, 0.2, dk); R4(ctx, gx + 4.6, 1.2, 1.3, 1.0, lit ? S.tone(S.pal.lit, PB, true) : S.tone(S.pal.glass, PB));
      ctx.save(); ctx.translate(gx + 3.4, 1.1); ctx.rotate(1.25); for (let i = 0; i < 6; i++) R4(ctx, i * 0.7, -0.07, 0.7, 0.14, S.tone(i % 2 ? '#e9e4d6' : '#c8372d', PB, true)); ctx.restore();
    } });
    PB.solid(gx + 4.2, 0, 2.6, 2.7, 'wall');
    H.gate = { x: gx };
  }

  // ---- the quay front and the pier ----
  const PQ = S.plane(z, 'quay');
  H.PQ = PQ;
  const qLights = [];
  {
    const wall = S.tone('#6c7278', PQ), wall2 = S.tone('#585e64', PQ), cope = S.tone('#9aa0a4', PQ), weed = S.tone('#3d4a3f', PQ), tyre = S.tone('#14161a', PQ), dk = S.tone('#22262d', PQ), yel = S.tone('#d6a12a', PQ);
    K.sea(S, PQ, { y: wy, rows: 2, seed: 14 });
    PQ.add({ x0: -400, x1: end, layer: 0, draw(ctx, env) {
      const xa = Math.max(env.x0 - 2, -400), xb = Math.min(env.x1 + 2, end); if (xb <= xa) return;
      R4(ctx, xa, wy - 0.6, xb - xa, 0.6 - wy, wall);
      R4(ctx, xa, wy - 0.6, xb - xa, 1.25, weed);
      if (env.s > 1.6) { ctx.fillStyle = wall2; const a = Math.floor(xa / 3.2) * 3.2; for (let x = a; x < xb; x += 3.2) { ctx.fillRect(x, wy + 0.65, 0.08, -wy - 0.95); } ctx.fillRect(xa, -1.15, xb - xa, 0.07); }
      R4(ctx, xa, -0.3, xb - xa, 0.3, cope);
      if (env.s > 2.6) { ctx.fillStyle = yel; const a = Math.floor(xa / 1.6) * 1.6; for (let x = a; x < xb; x += 1.6) ctx.fillRect(x, -0.3, 0.8, 0.09); }
      // tyre fenders on chains, mooring rings, a ladder near the end
      const a2 = Math.floor(xa / 8.5) * 8.5;
      for (let x = a2; x < xb; x += 8.5) { const fx = x + 2.2; if (fx > end - 1) continue; line(ctx, fx, -0.3, fx, -0.95, dk, 0.05, env); ctx.strokeStyle = tyre; ctx.lineWidth = Math.max(0.22, env.px); ctx.beginPath(); ctx.arc(fx, -1.35, 0.4, 0, TAU); ctx.stroke(); }
      ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.06, env.px * 0.7); ctx.beginPath(); const lx = end - 3.4; ctx.moveTo(lx, wy); ctx.lineTo(lx, 0.1); ctx.moveTo(lx + 0.5, wy); ctx.lineTo(lx + 0.5, 0.1); for (let yy = wy + 0.3; yy < 0; yy += 0.38) { ctx.moveTo(lx, yy); ctx.lineTo(lx + 0.5, yy); } ctx.stroke();
      // bollards along the edge
      ctx.fillStyle = dk; const a3 = Math.floor(xa / 11) * 11; for (let x = a3; x < xb; x += 11) { const bx = x + 6.3; if (bx > end - 0.6) continue; ctx.fillRect(bx - 0.16, 0, 0.32, 0.4); ctx.fillRect(bx - 0.28, 0.34, 0.56, 0.16); }
    } });
    PQ.solid(-400, wy - 8, end + 400, 8 - wy, 'hard');
    if (pierLen > 0) {
      const wood = S.tone('#6f563c', PQ), wood2 = S.tone('#55412d', PQ), wood3 = S.tone('#8a6d4c', PQ), pile = S.tone('#3b2f24', PQ);
      PQ.add({ x0: end, x1: pierEnd + 1, layer: 0, draw(ctx, env) {
        for (let x = end + 2.4; x < pierEnd + 0.1; x += 4.6) { R4(ctx, x - 0.2, wy - 0.8, 0.4, 0.5 - wy, pile); R4(ctx, x - 0.2, wy - 0.1, 0.4, 0.75, weed); }
        if (env.s > 1.6) { ctx.strokeStyle = pile; ctx.lineWidth = Math.max(0.09, env.px * 0.7); ctx.beginPath(); for (let x = end + 2.4; x < pierEnd - 4; x += 9.2) { ctx.moveTo(x, -0.4); ctx.lineTo(x + 4.6, wy + 0.5); ctx.moveTo(x + 4.6, -0.4); ctx.lineTo(x, wy + 0.5); } ctx.stroke(); }
        R4(ctx, end, -0.36, pierLen, 0.36, wood); R4(ctx, end, -0.08, pierLen, 0.08, wood3); R4(ctx, end, -0.36, pierLen, 0.09, wood2);
        if (env.s > 3) { ctx.fillStyle = wood2; for (let x = end + 0.4; x < pierEnd; x += 0.8) ctx.fillRect(x, -0.28, 0.04, 0.2); }
        ctx.fillStyle = dk; for (let x = end + 6.8; x < pierEnd - 1; x += 9.2) { ctx.fillRect(x - 0.14, 0, 0.28, 0.36); ctx.fillRect(x - 0.24, 0.3, 0.48, 0.14); }
        // marker post on the pier head
        line(ctx, pierEnd - 0.4, 0, pierEnd - 0.4, 2.6, dk, 0.1, env);
        if (lit) dkGlow(ctx, pierEnd - 0.4, 2.75, 1.3, '90,255,140', 0.45 + 0.2 * Math.sin(env.t * 3));
        circ(ctx, pierEnd - 0.4, 2.75, 0.14, lit ? '#6dff9a' : S.tone('#2f7a4a', PQ));
      } });
      PQ.solid(end, -0.36, pierLen, 0.36, 'wood');
      if (lit) qLights.push({ x: pierEnd - 0.4, col: 'rgba(90,255,140,0.6)', len: 3, w: 0.35, a: 0.45 });
      if (o.shed !== false) { // net shed at the root of the pier
        const sx = o.shedX === undefined ? end + 1.2 : o.shedX, sc = S.tone('#7a6248', PQ), sc2 = S.tone('#4a3a2c', PQ);
        PQ.add({ x0: sx - 0.5, x1: sx + 4.6, layer: 0, draw(ctx, env) {
          R4(ctx, sx, 0, 4, 2.7, sc); if (env.s > 3) { ctx.fillStyle = sc2; for (let x = sx + 0.4; x < sx + 4; x += 0.45) ctx.fillRect(x, 0.05, 0.04, 2.6); }
          poly(ctx, [sx - 0.35, 2.7, sx + 4.35, 2.7, sx + 4.0, 3.25, sx + 0.2, 3.5], sc2); R4(ctx, sx + 2.5, 0, 1.0, 2.05, sc2);
          ctx.strokeStyle = S.tone('#b9a27e', PQ); ctx.lineWidth = Math.max(0.05, env.px * 0.6); ctx.beginPath(); ctx.arc(sx + 1.2, 1.5, 0.5, 0, TAU); ctx.moveTo(sx + 0.75, 1.5); ctx.lineTo(sx + 1.65, 1.5); ctx.stroke();
        } });
        PQ.solid(sx, 0, 4, 2.7, 'wood'); H.shed = { x0: sx, x1: sx + 4 };
      }
    }
    H.lamps = [];
    (o.lamps || [-34, -12, 10]).forEach((lx, i) => H.lamps.push(K.lamp(S, PQ, lx, 5.6, 'quay', { id: 'lamp' + (i + 1), reach: o.lampReach })));
    (o.pierLamps || (pierLen > 0 ? [end + 14] : [])).forEach((lx, i) => H.lamps.push(K.lamp(S, PQ, lx, 4.6, 'quay', { id: 'plamp' + (i + 1), reach: o.pierReach || o.lampReach })));
    if (lit) H.lamps.forEach((l) => qLights.push({ x: l.x * ((z - 5) / z), col: 'rgba(255,220,140,0.6)', len: 4.5, w: 0.6, a: 0.42, ob: l }));
    (o.barrels || []).forEach((b, i) => { const bx = typeof b === 'number' ? b : b[0]; K.thing(S, PQ, 'barrel', bx, 0.62, { id: (typeof b === 'number' ? null : b[1]) || ('barrel' + (i + 1)) }); });
    if (o.crane !== false) {
      const c = o.crane || {};
      H.crane = K.dockCrane(S, PQ, c.x === undefined ? -3 : c.x, { reach: c.reach === undefined ? 9 : c.reach, tipY: c.tipY, col: c.col });
      if (c.load !== false) H.hook = K.hookLight(S, K.hang(S, PQ, c.hookX === undefined ? H.crane.tipX : c.hookX, c.hookY || 10.5, c.load || 'net', { id: c.id || 'hook', top: H.crane.tipY, floor: c.floor || 0, drop: c.drop, col: c.loadCol }));
    }
    if (o.sock !== false && pierLen > 0) K.windsock(S, PQ, o.sockX === undefined ? pierEnd - 2.2 : o.sockX, 0, 5.2, { layer: 0 });
  }
  const zq = 'quay';
  H.quay = (x, extra) => Object.assign({ plane: PQ, x, y: 0, zone: zq, behind: false, room: null }, extra || {});
  H.pier = (x, extra) => Object.assign({ plane: PQ, x, y: 0, zone: zq, behind: false, room: null }, extra || {});

  // ---- the basin in front: boat lane, then open water toward the shooter ----
  const PL = S.plane(z - 5, 'lane');
  if (lit && H.off) qLights.push({ x: H.off.winX(1) * ((z - 5) / (z + 7)), col: 'rgba(255,214,130,0.5)', len: 3.4, w: 1.4, a: 0.3 });
  K.sea(S, PL, { y: wy, rows: 5, seed: 17, deep: 0.08, lights: qLights });
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
  if (o.dolphin !== false) { // a mooring post with a gull-white cap, for depth
    const dx = o.dolphinX === undefined ? -27 : o.dolphinX, pc = S.tone('#3b2f24', PW), cap = S.tone('#d9d2c0', PW);
    PW.add({ x0: dx - 1, x1: dx + 1, layer: 1, draw(ctx) { R4(ctx, dx - 0.3, wy - 0.3, 0.6, 2.3, pc); R4(ctx, dx - 0.36, wy + 2.0, 0.72, 0.2, cap); } });
  }
  // ---- nearest: a trawler's masthead in the corner, with a pennant that shows the wind ----
  const PN = S.plane(Math.round(z * 0.6), 'near');
  K.sea(S, PN, { y: wy, rows: 4, seed: 29, deep: 0.24 });
  H.PN = PN;
  if (o.mast !== false) {
    const mx = o.mastX === undefined ? -26.5 : o.mastX, my = o.mastY === undefined ? 6.3 : o.mastY, mc = S.tone('#2a2620', PN), mc2 = S.tone('#8a6d4c', PN);
    PN.add({ x0: mx - 9, x1: mx + 9, layer: 1, draw(ctx, env) {
      line(ctx, mx, wy, mx, my, mc2, 0.2, env); line(ctx, mx - 1.5, my - 2.2, mx + 1.5, my - 2.2, mc2, 0.12, env);
      ctx.strokeStyle = mc; ctx.lineWidth = Math.max(0.035, env.px * 0.6); ctx.beginPath(); ctx.moveTo(mx, my - 0.2); ctx.lineTo(mx - 8, wy + 1); ctx.moveTo(mx, my - 0.2); ctx.lineTo(mx + 7, wy + 1); ctx.moveTo(mx - 1.5, my - 2.2); ctx.lineTo(mx - 2.6, wy + 1); ctx.moveTo(mx + 1.5, my - 2.2); ctx.lineTo(mx + 2.6, wy + 1); ctx.stroke();
      if (lit) dkGlow(ctx, mx, my - 2.0, 0.6, '255,240,200', 0.5); circ(ctx, mx, my - 2.0, 0.08, lit ? '#fff3c4' : mc);
    } });
    K.pennant(S, PN, mx, my, 1.7, o.flagCol || '#c0392b');
  }
  return H;
};
