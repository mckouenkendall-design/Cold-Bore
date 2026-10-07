// ---------------------------------------------------------------------------
// The estate: a walled villa in the hills above Port Calder.
//
// By day it hosts a garden party. By night it is the Ledger's safehouse.
// From the shooter outward: an olive grove, the front wall and gate, a verge
// with low hedges, the gravel drive (cars), the garden itself (the main plane:
// pool on the left, terrace in the middle, rose walk on the right), the house
// with its garage and glasshouse, a back tower with the radio dish, the rear
// wall and its cypresses, and the hills.
// ---------------------------------------------------------------------------

// A tall, narrow cypress. The foliage hides what is behind it but does not
// stop a bullet; the trunk does.
K.cypress = function (S, P, x, h, o) {
  o = o || {}; const y = o.y || 0, w = o.w || h * 0.2, c = S.tone(o.col || '#25432f', P), c2 = S.tone(o.col2 || '#1b3324', P);
  P.add({ x0: x - w, x1: x + w, layer: o.layer === undefined ? 0 : o.layer, draw(ctx, env) {
    R4(ctx, x - 0.12, y, 0.24, h * 0.14, S.tone('#3a2c22', P));
    const sw = Math.sin(env.t * 0.8 + x) * 0.012 * h * (0.4 + Math.abs(env.wind || 0) * 0.15);
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - w * 0.42, y + h * 0.08); ctx.quadraticCurveTo(x - w * 0.62, y + h * 0.45, x + sw, y + h); ctx.quadraticCurveTo(x + w * 0.62, y + h * 0.45, x + w * 0.42, y + h * 0.08); ctx.closePath(); ctx.fill();
    ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(x + w * 0.05, y + h * 0.08); ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.45, x + sw, y + h); ctx.quadraticCurveTo(x + w * 0.62, y + h * 0.45, x + w * 0.42, y + h * 0.08); ctx.closePath(); ctx.fill();
  } });
  if (o.solid !== false) { P.solid(x - 0.12, y, 0.24, h * 0.14, 'wood'); P.solid(x - w * 0.5, y + h * 0.08, w, h * 0.8, 'leaf'); }
};

// A clipped hedge. Bullets pass through leaves.
K.hedge = function (S, P, x0, x1, h, o) {
  o = o || {}; const y = o.y || 0, c = S.tone(o.col || '#3f6a3c', P), c2 = S.tone(lighten(o.col || '#3f6a3c', 0.12), P), c3 = S.tone(darken(o.col || '#3f6a3c', 0.2), P);
  P.add({ x0, x1, layer: o.layer || 0, draw(ctx, env) {
    R4(ctx, x0, y, x1 - x0, h, c); R4(ctx, x0, y + h - Math.max(0.12, env.px), x1 - x0, Math.max(0.12, env.px), c2); R4(ctx, x0, y, x1 - x0, h * 0.25, c3);
    if (o.flowers && env.s > 2) { for (let x = x0 + 0.5; x < x1; x += 1.1) circ(ctx, x + Math.sin(x * 3.1) * 0.2, y + h * (0.55 + 0.3 * Math.sin(x * 7.7)), 0.13, S.tone(o.flowers[Math.floor(Math.abs(Math.sin(x * 12.9)) * o.flowers.length) % o.flowers.length], P)); }
  } });
  P.solid(x0, y, x1 - x0, h, 'leaf');
};

// A swimming pool, drawn as a band just in front of the ground line so that
// people at y = 0 stand along its far edge.
K.pool = function (S, P, x0, x1, o) {
  o = o || {}; const y = o.y || 0, d = o.depth || 1.25, wt = S.tone(o.col || '#3aa6c8', P), wt2 = S.tone('#8fd6e8', P), stone = S.tone('#e2dccb', P);
  P.add({ x0: x0 - 1, x1: x1 + 1, layer: 0, draw(ctx, env) {
    poly(ctx, [x0 - 0.5, y - 0.04, x1 + 0.5, y - 0.04, x1 + 1.0, y - d - 0.2, x0 - 1.0, y - d - 0.2], stone);
    poly(ctx, [x0, y - 0.14, x1, y - 0.14, x1 + 0.4, y - d, x0 - 0.4, y - d], wt);
    ctx.strokeStyle = wt2; ctx.lineWidth = Math.max(0.05, env.px); ctx.beginPath();
    for (let r = 0; r < 3; r++) for (let x = x0 + 1 + r * 0.9; x < x1 - 2; x += 3.4) { const dx = Math.sin(env.t * 0.8 + x + r) * 0.4; ctx.moveTo(x + dx, y - 0.35 - r * 0.36); ctx.lineTo(x + dx + 1.5, y - 0.35 - r * 0.36); }
    ctx.stroke();
    // a ladder and a diving board
    line(ctx, x1 - 1.2, y - 0.1, x1 - 1.2, y + 0.7, S.tone('#c9ced3', P), 0.06, env); line(ctx, x1 - 0.8, y - 0.1, x1 - 0.8, y + 0.7, S.tone('#c9ced3', P), 0.06, env);
    R4(ctx, x0 - 1.6, y + 0.35, 2.6, 0.1, S.tone('#f1ede2', P)); R4(ctx, x0 - 1.5, y, 0.25, 0.4, S.tone('#8d949a', P));
  } });
  return { x0, x1 };
};

// A fire in an oil drum. It lights the ground around it like a lamp, and its
// smoke leans with the wind.
K.brazier = function (S, P, x, zone, o) {
  o = o || {}; const y = o.y || 0;
  const ob = S.obj({ kind: 'lamp', id: o.id || 'brazier', plane: P, x, y: y + 1.05, r: 0.34, zone, on: true, mat: 'metal', layer: 2, reach: o.reach || 6, popR: 5,
    draw(ctx, env) {
      R4(ctx, x - 0.3, y, 0.6, 0.95, S.tone('#3a3f47', P)); R4(ctx, x - 0.33, y + 0.3, 0.66, 0.07, S.tone('#23262c', P)); R4(ctx, x - 0.33, y + 0.66, 0.66, 0.07, S.tone('#23262c', P));
      if (!ob.alive) return;
      for (let i = 0; i < 4; i++) { const fl = Math.sin(env.t * (9 + i * 3) + i * 2.1); poly(ctx, [x - 0.26 + i * 0.13, y + 0.95, x - 0.05 + i * 0.13, y + 0.95, x - 0.15 + i * 0.13 + fl * 0.07 + (env.wind || 0) * 0.02, y + 1.35 + fl * 0.14 + (i % 2) * 0.12], i % 2 ? '#ffd35a' : '#ff8a2a'); }
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y + 1.1, 0.1, x, y + 1.1, 3.4); g.addColorStop(0, 'rgba(255,170,70,0.5)'); g.addColorStop(1, 'rgba(255,150,60,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y + 1.1, 3.4, 0, TAU); ctx.fill(); ctx.restore();
      ctx.fillStyle = 'rgba(150,150,160,0.3)';
      for (let i = 0; i < 7; i++) { const u = (env.t * 0.22 + i / 7) % 1; ctx.globalAlpha = (1 - u) * 0.7; ctx.beginPath(); ctx.arc(x + (env.wind || 0) * u * u * 2.6 + Math.sin(u * 6 + i) * 0.2, y + 1.5 + u * 5, 0.2 + u * 0.9, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    } });
  P.solid(x - 0.3, y, 0.6, 0.9, 'hard');
  return ob;
};

// A glasshouse: a frame of white glazing bars with plants inside.
K.glasshouse = function (S, P, x, w, h, o) {
  o = o || {}; const y = o.y || 0, bar = S.tone('#eef0ea', P), gl = S.tone(S.pal.dark > 0.5 ? '#16202c' : '#a9cfd6', P), leaf = S.tone('#3f7a46', P), brick = S.tone('#b9a48c', P);
  P.add({ x0: x, x1: x + w, layer: 0, draw(ctx, env) {
    R4(ctx, x, y, w, 0.8, brick); R4(ctx, x, y + 0.8, w, h - 0.8, gl);
    poly(ctx, [x, y + h, x + w, y + h, x + w / 2, y + h + 1.7], gl);
    for (let i = 0; i < 6; i++) circ(ctx, x + 1.4 + i * (w - 2.8) / 5, y + 1.5 + (i % 2) * 0.7, 0.75, leaf);
    ctx.strokeStyle = bar; ctx.lineWidth = Math.max(0.08, env.px * 0.9); ctx.beginPath();
    for (let xx = x; xx <= x + w + 0.01; xx += w / 8) { ctx.moveTo(xx, y + 0.8); ctx.lineTo(xx, y + h); }
    ctx.moveTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.moveTo(x, y + h * 0.55); ctx.lineTo(x + w, y + h * 0.55);
    ctx.moveTo(x, y + h); ctx.lineTo(x + w / 2, y + h + 1.7); ctx.lineTo(x + w, y + h); ctx.stroke();
  } });
  P.solid(x, y, w, 0.8, 'wall'); P.solid(x, y + 0.8, w, h - 0.8, 'glasswall');
};

// A string of little flags between two points.
K.bunting = function (S, P, x0, y0, x1, y1, o) {
  o = o || {}; const cols = (o.cols || ['#c8372d', '#f1ede2', '#2f6db5', '#e2b33c']).map((c) => S.tone(c, P)), wire = S.tone('#3a3f47', P), n = Math.max(4, Math.floor(Math.abs(x1 - x0) / 0.9)), sag = o.sag || 1.2;
  P.add({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), layer: o.layer === undefined ? 1 : o.layer, draw(ctx, env) {
    const at = (u) => [lerp(x0, x1, u), lerp(y0, y1, u) - sag * 4 * u * (1 - u)];
    ctx.strokeStyle = wire; ctx.lineWidth = Math.max(0.03, env.px * 0.6); ctx.beginPath(); for (let i = 0; i <= n; i++) { const p = at(i / n); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); } ctx.stroke();
    if (env.s < 1.6) return;
    for (let i = 0; i < n; i++) { const p = at((i + 0.5) / n), fl = Math.sin(env.t * 5 + i) * 0.08 * Math.min(1.5, Math.abs(env.wind || 0) * 0.3 + 0.3); poly(ctx, [p[0] - 0.22, p[1], p[0] + 0.22, p[1], p[0] + fl, p[1] - 0.5], cols[i % cols.length]); }
  } });
};

SCN.estate = function (o) {
  o = o || {};
  const z = o.z || 500, sd = o.seed || 7, night = (o.time || 'day') === 'night';
  const S = makeScene({ time: o.time || 'day', weather: o.weather, seed: sd, refZ: z, exits: [-78, 78], bounds: { x0: -64, x1: 64, y0: -5, y1: 40 }, ambience: 'wild', groundMat: 'dirt', sun: o.sun || (night ? [70, 40] : [-80, 30]) });
  const H = { S, z };
  K.mountains(S, z + 5600, { seed: 4 + sd, h: 520, col: '#7d8a9a', snowLine: 0.6 });
  K.hills(S, z + 1500, { seed: 3 + sd, h: 150, base: -30, col: night ? '#1c3026' : '#7ea86a', trees: 0.5, rough: 260 });
  const PHl = K.hills(S, z + 380, { seed: 9 + sd, h: 46, base: -14, col: night ? '#18281f' : '#6e9c5c', trees: 0.85, rough: 140, treeCol: '#2d4f3a' });
  // vineyard rows on the slope behind the house
  PHl.add({ x0: -400, x1: 400, layer: 0, draw(ctx, env) { ctx.fillStyle = S.tone('#4f7a4a', PHl); for (let r = 0; r < 5; r++) { const yy = -8 + r * 5; const a = Math.floor(env.x0 / 6) * 6; for (let x = a; x < env.x1; x += 6) ctx.fillRect(x + r * 1.3, yy + Math.sin(x * 0.02 + r) * 2, 4.2, 1.1); } } });

  // rear wall and its cypresses
  const PRW = H.PRW = S.plane(z + 52, 'rear wall');
  K.ground(S, PRW, { col: S.pal.grass, noEdge: true });
  [-62, -51, -30, -25, 29, 34, 50, 63, 70].forEach((x, i) => K.cypress(S, PRW, x, 12 + (i * 7) % 5, { solid: false }));
  K.fence(S, PRW, -90, 90, 2.6, { kind: 'wall', col: '#d6cab0', layer: 0 });

  // back tower: the radio dish stands on it
  const PB = H.PB = S.plane(z + 34, 'tower');
  const tw = { x: 13, w: 6, h: 9.2 };
  PB.add({ x0: tw.x - 1, x1: tw.x + tw.w + 1, layer: 0, draw(ctx, env) {
    R4(ctx, tw.x, 0, tw.w, tw.h, S.tone('#d9cdb2', PB)); R4(ctx, tw.x - 0.3, tw.h - 0.4, tw.w + 0.6, 0.4, S.tone('#b9a98c', PB));
    line(ctx, tw.x + 1.1, tw.h, tw.x + 1.1, tw.h + 5.5, S.tone('#30343c', PB), 0.1, env); line(ctx, tw.x + 0.4, tw.h + 4.4, tw.x + 1.8, tw.h + 4.4, S.tone('#30343c', PB), 0.07, env); line(ctx, tw.x + 0.6, tw.h + 3.6, tw.x + 1.6, tw.h + 3.6, S.tone('#30343c', PB), 0.07, env);
    if (Math.sin(env.t * 2.4) > 0.3) circ(ctx, tw.x + 1.1, tw.h + 5.6, Math.max(0.12, env.px * 1.3), '#ff5a48');
  } });
  PB.solid(tw.x, 0, tw.w, tw.h, 'wall');
  H.dish = K.thing(S, PB, 'dish', o.dishX === undefined ? 16 : o.dishX, tw.h + 1.1, { id: 'dish' });

  // ---- the house ----
  const PH = H.PH = S.plane(z + 14, 'house');
  K.ground(S, PH, { col: S.pal.grass, noEdge: true });
  const wall = '#e6dbc2';
  const B = H.house = K.building(S, PH, { x: -10, w: 36, floors: 2, fh: 3.7, cols: 8, winW: 1.7, winH: 2.2, sill: 0.8, id: 'house', wall, frame: '#f6f1e4', trim: '#f2ead6', door: 3, doorCol: '#3f5a48', ac: false, parapet: 0.3, roofAccess: false, seed: 5 + sd,
    spans: { 0: [[6, 7, 'study', !!o.studyLit]] },
    wins: Object.assign({ '0,3': { none: true }, '0,6': { blind: 0, lit: !!o.studyLit }, '0,7': { door: true, sill: 0.1, h: 2.6, blind: 0, lit: !!o.studyLit } }, o.wins || {}) });
  const tile = S.tone('#b5583a', PH), tile2 = S.tone('#96462e', PH), green = S.tone('#3f6a52', PH), stone = S.tone('#cfc3a8', PH);
  const ry = B.roofY + 0.3, ch = { x0: 14.5, x1: 16.4, y1: 13.3 };
  PH.add({ x0: -12, x1: 28, layer: 1, draw(ctx, env) {
    // green shutters
    for (const key in B.wins) { const op = B.wins[key]; if (op.door) continue; R4(ctx, op.x - 0.5, op.y, 0.42, op.h, green); R4(ctx, op.x + op.w + 0.08, op.y, 0.42, op.h, green); }
    // the chimney stands in front of whatever is behind it on the back tower
    R4(ctx, ch.x0, ry + 0.5, ch.x1 - ch.x0, ch.y1 - ry - 0.5, stone); R4(ctx, ch.x0 - 0.2, ch.y1 - 0.35, ch.x1 - ch.x0 + 0.4, 0.35, S.tone('#8f8370', PH));
    poly(ctx, [B.x - 0.8, ry, B.x + B.w + 0.8, ry, B.x + B.w - 3.4, ry + 2.5, B.x + 3.4, ry + 2.5], tile);
    R4(ctx, B.x - 0.8, ry - 0.12, B.w + 1.6, 0.2, tile2);
    if (env.s > 2) { ctx.strokeStyle = tile2; ctx.lineWidth = Math.max(0.04, env.px * 0.5); ctx.beginPath(); for (let i = 1; i < 5; i++) { const u = i / 5; ctx.moveTo(B.x - 0.8 + 4.2 * u, ry + 2.5 * u); ctx.lineTo(B.x + B.w + 0.8 - 4.2 * u, ry + 2.5 * u); } ctx.stroke(); }
    // steps and a porch over the front door
    const dx = B.winX(3);
    R4(ctx, dx - 1.6, 0, 3.2, 0.22, stone); poly(ctx, [dx - 1.7, 3.0, dx + 1.7, 3.0, dx + 1.3, 3.5, dx - 1.3, 3.5], tile);
    line(ctx, dx - 1.5, 0, dx - 1.5, 3.0, stone, 0.16, env); line(ctx, dx + 1.5, 0, dx + 1.5, 3.0, stone, 0.16, env);
  } });
  PH.solid(B.x, ry, B.w, 2.5, 'wall'); PH.solid(ch.x0, ry, ch.x1 - ch.x0, ch.y1 - ry, 'wall');
  H.chimney = ch;
  if (o.smoke) K.chimney(S, PH, (ch.x0 + ch.x1) / 2, ch.y1 - 1.8, { col: '#cfc3a8' });
  H.bal = K.balcony(S, PH, B, 1, 3, 4, { rail: '#2a2e36' });
  // loggia on the left of the house
  PH.add({ x0: -24, x1: -10, layer: 0, draw(ctx, env) {
    R4(ctx, -24, 0, 14, 4.4, S.tone('#2b2f2c', PH)); R4(ctx, -24, 3.6, 14, 1.0, S.tone(wall, PH)); poly(ctx, [-24.5, 4.6, -10, 4.6, -10, 5.3, -23.6, 5.3], tile);
    for (let i = 0; i < 5; i++) { const cx = -24 + i * 3.5; R4(ctx, cx - 0.2, 0, 0.45, 3.7, S.tone('#efe6d0', PH)); }
    ctx.fillStyle = S.tone(wall, PH); for (let i = 0; i < 4; i++) { const cx = -22.25 + i * 3.5; ctx.beginPath(); ctx.moveTo(cx - 1.55, 3.7); ctx.lineTo(cx - 1.55, 3.1); ctx.quadraticCurveTo(cx, 4.3, cx + 1.55, 3.1); ctx.lineTo(cx + 1.55, 3.7); ctx.closePath(); ctx.fill(); }
  } });
  PH.solid(-24, 3.6, 14, 1.7, 'wall');
  // garage on the far left
  const gar = H.garage = { x0: -58, x1: -44, h: 4.2 };
  PH.add({ x0: gar.x0, x1: gar.x1, layer: 0, draw(ctx, env) {
    R4(ctx, gar.x0, 0, 14, gar.h, S.tone('#d2c6aa', PH)); R4(ctx, gar.x0 - 0.3, gar.h - 0.35, 14.6, 0.35, tile2);
    for (let i = 0; i < 2; i++) { const dx = gar.x0 + 1.2 + i * 6.4; R4(ctx, dx, 0, 5.2, 3.0, S.tone('#6f7a72', PH)); if (env.s > 2.5) { ctx.fillStyle = S.tone('#59635c', PH); for (let yy = 0.4; yy < 3.0; yy += 0.5) ctx.fillRect(dx, yy, 5.2, 0.07); } }
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
  const pave = S.tone('#d9d0bc', PG), pave2 = S.tone('#bdb39d', PG);
  PG.add({ x0: -14, x1: 30, layer: 0, draw(ctx, env) {
    poly(ctx, [-13, 0, 29, 0, 29.6, -1.5, -13.6, -1.5], pave); R4(ctx, -13.6, -1.62, 43.2, 0.14, pave2);
    if (env.s > 2) { ctx.fillStyle = pave2; for (let x = -12; x < 29; x += 2) ctx.fillRect(x, -1.5, 0.05, 1.5); ctx.fillRect(-13.3, -0.75, 42.6, 0.04); }
  } });
  H.poolBox = K.pool(S, PG, -40, -19, {});
  K.hedge(S, PG, 30.2, 30.8, 2.3, { layer: 0 }); K.hedge(S, PG, 33.2, 33.8, 2.3, { layer: 0 });
  PG.add({ x0: 30, x1: 34, layer: 1, draw(ctx) { ctx.strokeStyle = S.tone('#3f6a3c', PG); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(32, 2.3, 1.5, 0, Math.PI); ctx.stroke(); } });
  K.hedge(S, PG, 34.2, 60, 1.0, { layer: 0, flowers: ['#d9482b', '#e85d75', '#f1ede2', '#e8a23a'] });
  K.hedge(S, PG, -62, -42, 1.0, { layer: 0, flowers: ['#f1ede2', '#b56bb0'] });
  H.lamps = {};
  const lampAt = (id, x, zone, reach) => { H.lamps[id] = K.lamp(S, PG, x, 3.4, zone, { id, reach: reach || 8, arm: 0.5 }); };
  lampAt('lamp_pool', -42, 'pool'); lampAt('lamp_t1', -13.5, 'terrace'); lampAt('lamp_t2', 8.6, 'terrace'); lampAt('lamp_east', 44, 'east');
  if (o.brazier !== undefined) H.brazier = K.brazier(S, PG, o.brazier, 'terrace', { id: 'brazier' });
  if (o.party) {
    K.table(S, PG, -30, { umbrella: '#c8372d' }); K.table(S, PG, -24, { umbrella: '#f1ede2' }); K.table(S, PG, 14, { umbrella: '#2f6db5' }); K.table(S, PG, 21, { umbrella: '#e2b33c' });
    K.box(S, PG, -4.5, 0, 5, 0.85, '#f1ede2', { solid: false }); PG.add({ x0: -5, x1: 1, layer: 0, draw(ctx) { for (let i = 0; i < 6; i++) R4(ctx, -4.1 + i * 0.75, 0.85, 0.16, 0.36, S.tone(i % 2 ? '#3f8a5a' : '#c9ced3', PG)); circ(ctx, -0.4, 1.15, 0.34, S.tone('#e9d08a', PG)); } });
    K.bunting(S, PH, -10, 7.2, -24, 5.2, { sag: 0.7 }); K.bunting(S, PH, 26, 7.2, 33, 5.6, { sag: 0.5 });
  }

  // ---- the drive ----
  const PD = H.PD = S.plane(z - 16, 'drive');
  K.ground(S, PD, { col: night ? '#3a3c40' : '#b9ae98', edge: '#d8ceb8' });
  (o.cars || []).forEach((c) => K.parked(S, PD, c[0], c[1], c[2], c[3], { y: 0 }));
  // guard hut by the gate
  const hut = H.hut = { x: 56, w: 4.2, room: 'gatehut' };
  S.room('gatehut', o.hutLit !== undefined ? o.hutLit : night);
  const hop = PD.open({ x: hut.x + 0.6, y: 1.0, w: 2.2, h: 1.3, room: 'gatehut', glass: true, blind: 0, deco: 5, tint: '#ffd98a', f: 0, c: 0 });
  PD.solid(hut.x, 0, hut.w, 3.0, 'wood');
  PD.add({ x0: hut.x - 0.5, x1: hut.x + hut.w + 0.5, layer: 0, draw(ctx, env) { R4(ctx, hut.x, 0, hut.w, 2.8, S.tone('#59635c', PD)); R4(ctx, hut.x + 3.1, 0, 0.9, 2.1, S.tone('#2a2420', PD)); drawWindowBack(ctx, env, S, PD, hop, S.tone(S.pal.glass, PD), S.tone(S.pal.inRoom, PD)); } });
  PD.add({ x0: hut.x - 0.6, x1: hut.x + hut.w + 0.6, layer: 1, draw(ctx, env) { drawWindowFront(ctx, env, S, PD, hop, S.tone('#eef0ea', PD), true); poly(ctx, [hut.x - 0.5, 2.8, hut.x + hut.w + 0.5, 2.8, hut.x + hut.w - 0.2, 3.5, hut.x + 0.2, 3.5], S.tone('#2f3a34', PD)); } });

  // ---- verge: low hedges, and (for the night job) a pair of cypresses ----
  const PC = H.PC = S.plane(z - 24, 'verge');
  K.ground(S, PC, { col: S.pal.grass, noEdge: true });
  K.hedge(S, PC, -62, -2, 0.65, {}); K.hedge(S, PC, 4, 9, 0.65, {});
  (o.screen || []).forEach((x, i) => K.cypress(S, PC, x, 11 + (i % 2) * 0.8, { w: 2.6 }));

  // ---- front wall and gate ----
  const PF = H.PF = S.plane(z - 48, 'front wall');
  K.ground(S, PF, { col: night ? '#1f2a22' : '#8f9a62', noEdge: true });
  const gate = H.gate = { x0: 47.4, x1: 54.2 };
  K.fence(S, PF, -110, gate.x0, 2.0, { kind: 'wall', col: '#d9cdb2', layer: 0 }); K.fence(S, PF, gate.x1, 110, 2.0, { kind: 'wall', col: '#d9cdb2', layer: 0 });
  PF.add({ x0: -110, x1: 110, layer: 1, draw(ctx, env) {
    const pc = S.tone('#c4b79a', PF), iron = S.tone('#20242b', PF);
    for (let x = -108; x < 110; x += 12) if (x < gate.x0 - 2 || x > gate.x1 + 2) R4(ctx, x - 0.3, 0, 0.6, 2.25, pc);
    R4(ctx, gate.x0 - 0.9, 0, 0.9, 2.9, pc); R4(ctx, gate.x1, 0, 0.9, 2.9, pc); R4(ctx, gate.x0 - 1.05, 2.9, 1.2, 0.2, pc); R4(ctx, gate.x1 - 0.15, 2.9, 1.2, 0.2, pc);
    // iron leaves, swung open
    ctx.strokeStyle = iron; ctx.lineWidth = Math.max(0.05, env.px * 0.7); ctx.beginPath();
    for (let i = 0; i < 5; i++) { ctx.moveTo(gate.x0 + i * 0.22, 0); ctx.lineTo(gate.x0 + i * 0.22, 2.2 + i * 0.05); ctx.moveTo(gate.x1 - i * 0.22, 0); ctx.lineTo(gate.x1 - i * 0.22, 2.2 + i * 0.05); }
    ctx.stroke();
  } });
  PF.solid(gate.x0 - 0.9, 0, 0.9, 2.9, 'wall'); PF.solid(gate.x1, 0, 0.9, 2.9, 'wall');
  H.lamps.gate1 = K.lamp(S, PF, gate.x0 - 0.45, 3.3, 'drive', { id: 'lamp_gate1', reach: 10, arm: 0 });
  H.lamps.gate2 = K.lamp(S, PF, gate.x1 + 0.45, 3.3, 'drive', { id: 'lamp_gate2', reach: 10, arm: 0 });
  if (o.cams !== false) H.cams.gate = K.thing(S, PF, 'cctv', gate.x0 - 1.4, 2.6, { id: 'cam_gate', zone: 'drive', range: 12, dir: -1 });

  // ---- olive grove outside the wall ----
  const PT = H.PT = S.plane(z - 84, 'grove');
  K.ground(S, PT, { col: night ? '#1a231c' : '#9aa068', noEdge: true });
  [-96, -78, -61, -47, -30, -14, 3, 19, 37, 52, 70, 88].forEach((x, i) => K.tree(S, PT, x + (i % 3) * 1.5, 3.6 + (i % 4) * 0.35, { col: '#7d9a6a', solid: false }));

  // placements
  H.zoneOf = (x) => (x < -16 ? 'pool' : x <= 30 ? 'terrace' : 'east');
  H.lawn = (x, extra) => Object.assign({ plane: PG, x, y: 0, zone: H.zoneOf(x), behind: false, room: null }, extra || {});
  H.drive = (x, extra) => Object.assign({ plane: PD, x, y: 0, zone: 'drive', behind: false, room: null }, extra || {});
  H.inWin = (f, c, dx, extra) => { const op = B.win(f, c); return Object.assign({ plane: PH, x: B.winX(c) + (dx || 0), y: B.floorY(f), room: op.room, zone: op.room, behind: true }, extra || {}); };
  H.study = (x, extra) => Object.assign({ plane: PH, x, y: 0, room: 'house:study', zone: 'house:study', behind: true }, extra || {});
  H.inHut = (extra) => Object.assign({ plane: PD, x: hut.x + 1.7, y: 0, room: 'gatehut', zone: 'gatehut', behind: true }, extra || {});
  H.onBalcony = (x, extra) => Object.assign({ plane: PH, x, y: H.bal.y, room: null, zone: H.bal.zone, behind: false }, extra || {});
  return H;
};
