// ---------------------------------------------------------------------------
// Ready-made locations. Each returns the scene plus named handles (buildings,
// street plane, lamps) so a mission can say "third-floor window of the hotel"
// instead of juggling coordinates.
// ---------------------------------------------------------------------------
const SCN = {};

// wind tells: a flag and chimney smoke that lean with the wind
K.flag = function (S, P, x, y, h, col, o) {
  o = o || {}; const pole = S.tone('#c9ced3', P), c = S.tone(col || '#c0392b', P), c2 = S.tone(o.col2 || '#f1ede2', P);
  P.add({ x0: x - 5, x1: x + 5, layer: o.layer === undefined ? 2 : o.layer, draw(ctx, env) {
    line(ctx, x, y, x, y + h, pole, 0.09, env);
    const w = env.wind, a = Math.min(1, Math.abs(w) / 6), dir = w >= 0 ? 1 : -1, len = 2.6, top = y + h - 0.1;
    ctx.beginPath(); ctx.moveTo(x, top);
    const n = 8;
    for (let i = 1; i <= n; i++) { const u = i / n; const droop = (1 - a) * u * u * 1.5; const fl = Math.sin(env.t * (4 + a * 9) - u * 5) * 0.14 * (0.3 + a) * u; ctx.lineTo(x + dir * u * len * (0.25 + 0.75 * a), top - droop + fl); }
    for (let i = n; i >= 0; i--) { const u = i / n; const droop = (1 - a) * u * u * 1.5; const fl = Math.sin(env.t * (4 + a * 9) - u * 5) * 0.14 * (0.3 + a) * u; ctx.lineTo(x + dir * u * len * (0.25 + 0.75 * a), top - 1.3 - droop * 0.75 + fl); }
    ctx.closePath(); ctx.fillStyle = c; ctx.fill();
    ctx.strokeStyle = c2; ctx.lineWidth = Math.max(0.16, env.px);
    ctx.beginPath(); for (let i = 0; i <= n; i++) { const u = i / n; const droop = (1 - a) * u * u * 1.5; const fl = Math.sin(env.t * (4 + a * 9) - u * 5) * 0.14 * (0.3 + a) * u; const px = x + dir * u * len * (0.25 + 0.75 * a), py = top - 0.65 - droop * 0.87 + fl; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.stroke();
  } });
};
K.chimney = function (S, P, x, y, o) {
  o = o || {}; const c = S.tone(o.col || '#5a4038', P);
  P.add({ x0: x - 14, x1: x + 14, layer: 0, draw(ctx, env) {
    R4(ctx, x - 0.45, y, 0.9, 1.8, c); R4(ctx, x - 0.55, y + 1.6, 1.1, 0.25, S.tone('#3a2a25', P));
    ctx.fillStyle = S.pal.dark > 0.5 ? 'rgba(120,130,150,0.25)' : 'rgba(235,238,242,0.42)';
    for (let i = 0; i < 9; i++) { const u = ((env.t * 0.16 + i / 9) % 1); ctx.globalAlpha = (1 - u) * 0.8; ctx.beginPath(); ctx.arc(x + env.wind * u * u * 3.2 + Math.sin(u * 6 + i) * 0.3, y + 2 + u * 6.5, 0.35 + u * 1.5, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  } });
};
K.wire = function (S, P, x0, y0, x1, y1, sag) {
  const c = S.tone('#14161a', P);
  P.add({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), layer: 2, draw(ctx, env) {
    ctx.strokeStyle = c; ctx.lineWidth = Math.max(0.03, env.px * 0.8);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - (sag || 1.5), x1, y1); ctx.stroke();
  } });
};
K.fountain = function (S, P, x, o) {
  o = o || {}; const st = S.tone('#b7b2a8', P), st2 = S.tone('#8f8a80', P), wt = S.tone(S.pal.water, P), y = o.y || 0;
  P.add({ x0: x - 5, x1: x + 5, layer: 0, draw(ctx, env) {
    R4(ctx, x - 4, y, 8, 0.7, st); R4(ctx, x - 4.2, y + 0.6, 8.4, 0.18, st2); R4(ctx, x - 3.7, y + 0.7, 7.4, 0.12, wt);
    R4(ctx, x - 0.3, y + 0.7, 0.6, 2.4, st2); R4(ctx, x - 1.4, y + 2.6, 2.8, 0.22, st);
    ctx.strokeStyle = 'rgba(225,240,250,0.7)'; ctx.lineWidth = Math.max(0.05, env.px);
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const sx = x + (i - 2.5) * 0.4, ph = (env.t * 1.5 + i * 0.37) % 1; ctx.moveTo(sx, y + 2.9); ctx.quadraticCurveTo(sx + (i - 2.5) * 0.5, y + 4.2 - ph * 0.3, sx + (i - 2.5) * 1.0, y + 0.85); } ctx.stroke();
  } });
  P.solid(x - 4, y, 8, 0.7, 'hard'); P.solid(x - 0.3, y + 0.7, 0.6, 2.2, 'hard');
};
K.stall = function (S, P, x, col, o) {
  o = o || {}; const y = o.y || 0, c = S.tone(col, P), c2 = S.tone('#f1ede2', P), wood = S.tone('#6b4f3a', P);
  P.add({ x0: x - 2.2, x1: x + 2.2, layer: o.layer || 0, draw(ctx, env) {
    line(ctx, x - 1.7, y, x - 1.7, y + 2.5, wood, 0.09, env); line(ctx, x + 1.7, y, x + 1.7, y + 2.5, wood, 0.09, env);
    R4(ctx, x - 1.8, y + 0.75, 3.6, 0.2, wood); R4(ctx, x - 1.8, y, 3.6, 0.75, S.tone(darken(col, 0.35), P));
    for (let i = 0; i < 6; i++) poly(ctx, [x - 2.1 + i * 0.7, y + 2.9, x - 1.4 + i * 0.7, y + 2.9, x - 1.4 + i * 0.7, y + 2.35, x - 2.1 + i * 0.7, y + 2.35], i % 2 ? c2 : c);
    for (let i = 0; i < 5; i++) circ(ctx, x - 1.4 + i * 0.7, y + 1.08, 0.16, S.tone(['#d9482b', '#e8a23a', '#7fae45', '#d9482b', '#b56bb0'][i], P));
  } });
  P.solid(x - 1.8, y, 3.6, 0.95, 'wood');
};

// ---- a city street: a row of tenements facing the shooter -------------------
SCN.street = function (o) {
  o = o || {};
  const z = o.z || 220;
  const S = makeScene({ time: o.time || 'dusk', weather: o.weather, seed: o.seed || 3, refZ: z, exits: [-50, 50], bounds: { x0: -40, x1: 40, y0: -1.5, y1: 27 }, ambience: 'city', groundMat: 'hard' });
  K.skyline(S, z + 1400, { seed: 21 + (o.seed || 0), hMin: 60, hMax: 240 });
  K.skyline(S, z + 420, { seed: 9 + (o.seed || 0), hMin: 30, hMax: 85, x0: -500, x1: 500, cols: ['#4a5566', '#56616f', '#3f4a5a'] });
  const PB = S.plane(z + 7, 'row');
  K.ground(S, PB, { col: S.pal.road, noEdge: true });
  const H = { S, PB, z };
  const styles = o.row || [
    { w: 17, floors: 5, wall: '#8a5444', tank: 0.7 },
    { w: 15, floors: 4, wall: '#a0876e', shop: { sign: 'LAUNDRY', awning: '#3b6ea5' }, antenna: 0.3 },
    { w: 19, floors: 6, wall: '#6d727c', hut: 0.15, door: 2 },
    { w: 14, floors: 4, wall: '#94614c', shop: { sign: 'DELI', awning: '#b33a3a', door: true } },
    { w: 16, floors: 5, wall: '#7c6a5a', tank: 0.3 },
  ];
  let x = -(styles.reduce((s, b) => s + b.w, 0) + (styles.length - 1) * (o.gap || 0)) / 2;
  H.b = [];
  styles.forEach((bd, i) => {
    const B = K.building(S, PB, Object.assign({ x, id: 'b' + (i + 1), seed: (o.seed || 3) * 13 + i * 7 }, bd));
    H.b.push(B); H['b' + (i + 1)] = B; x += bd.w + (o.gap || 0);
  });
  const PS = S.plane(z, 'street');
  K.ground(S, PS, { col: mix(S.pal.ground, '#000000', 0.08), edge: '#c9ccd0' });
  H.PS = PS; H.lamps = [];
  (o.lamps || [-27, -9, 9, 27]).forEach((lx, i) => H.lamps.push(K.lamp(S, PS, lx, 5.4, 'street', { id: 'lamp' + (i + 1) })));
  const PR = S.plane(z - 7, 'road');
  K.ground(S, PR, { col: S.pal.road, stripes: 2.2, noEdge: true });
  H.PR = PR;
  (o.cars || [['sedan', -30, 1, '#7a2e2e'], ['van', 18, -1, '#d9dde2'], ['sedan', 33, 1, '#2f4a6b']]).forEach((c) => K.parked(S, PR, c[0], c[1], c[2], c[3], { y: 0 }));
  // something close by for depth: a flag on a nearer roof and a run of cable
  if (o.flag !== false) { const PF = S.plane(z * 0.62, 'near'); K.flag(S, PF, o.flagX === undefined ? -19 : o.flagX, 2, 8, o.flagCol || '#c0392b'); K.box(S, PF, (o.flagX === undefined ? -19 : o.flagX) - 9, -6, 13, 8, '#3a3f49', { band: 0.5 }); H.PF = PF; }
  H.street = (xx, extra) => Object.assign({ plane: PS, x: xx, y: 0, zone: 'street', behind: false, room: null }, extra || {});
  H.inWin = (B, f, c, dx, extra) => { const op = B.win(f, c); return Object.assign({ plane: B.P, x: B.winX(c) + (dx || 0), y: B.floorY(f), room: op.room, zone: op.room, behind: true }, extra || {}); };
  H.onRoof = (B, xx, extra) => Object.assign({ plane: B.P, x: xx, y: B.roofY, room: B.roofRoom, zone: B.roofRoom, behind: true }, extra || {});
  return H;
};

CB.SCN = SCN;
