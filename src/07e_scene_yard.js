// ---------------------------------------------------------------------------
// Calder Yard: a freight yard at dusk.
//
// Seen from high up and far away, the yard is a stack of parallel tracks at
// different distances. A train on a track NEARER than the people you are
// watching hides them (and stops bullets). A train on a track BEHIND them
// hides nothing. Either one is loud enough to cover a shot while it rumbles
// through the middle of the yard.
// ---------------------------------------------------------------------------

// One track: a strip of stone, sleepers and a bright rail.
K.track = function (S, P, o) {
  o = o || {};
  const y = o.y || 0, bal = S.tone(o.ballast || '#6c6660', P), tie = S.tone('#33291f', P), rail = S.tone('#c3c8d0', P), shade = S.tone('#2a2622', P);
  P.add({ x0: -4000, x1: 4000, layer: 0, draw(ctx, env) {
    const a = env.x0 - 2, w = env.x1 - env.x0 + 4;
    R4(ctx, a, y - 0.7, w, 0.7, bal);
    R4(ctx, a, y - 0.78, w, 0.1, shade);
    if (env.s > 2.6) { ctx.fillStyle = tie; const b = Math.floor(env.x0 / 0.8) * 0.8; for (let x = b; x < env.x1; x += 0.8) ctx.fillRect(x, y - 0.22, 0.3, 0.22); }
    R4(ctx, a, y - 0.02, w, Math.max(0.1, env.px * 1.2), rail);
    R4(ctx, a, y - 0.42, w, Math.max(0.07, env.px), rail);
  } });
};

// Rolling stock. Every wagon is drawn to about the same height on purpose:
// a train stops bullets over its whole outline, so it should look solid.
const STOCK_LEN = { loco: 18, box: 16.4, tank: 16.4, cont: 16.4, hop: 16.4 };
function drawStock(ctx, env, S, P, kind, a, w, col, k) {
  const dk = S.tone('#15171c', P), mid = S.tone('#2b2e36', P), c = S.tone(col, P), c2 = S.tone(darken(col, 0.24), P), hi = S.tone(lighten(col, 0.14), P);
  const fine = env.s > 2.2;
  // running gear
  R4(ctx, a + 0.3, 0.62, w - 0.6, 0.36, mid);
  for (let i = 0; i < 2; i++) {
    const bx = i ? a + w - 4.3 : a + 1.3;
    R4(ctx, bx, 0.26, 3.0, 0.4, dk); circ(ctx, bx + 0.6, 0.42, 0.42, dk); circ(ctx, bx + 2.4, 0.42, 0.42, dk);
    if (env.s > 5) { circ(ctx, bx + 0.6, 0.42, 0.15, mid); circ(ctx, bx + 2.4, 0.42, 0.15, mid); }
  }
  R4(ctx, a - 0.12, 0.7, 0.5, 0.18, dk); R4(ctx, a + w - 0.38, 0.7, 0.5, 0.18, dk);
  if (kind === 'loco') {
    R4(ctx, a + 0.3, 0.95, w - 0.6, 2.75, c);
    R4(ctx, a + 0.3, 0.95, w - 0.6, 0.5, c2);
    R4(ctx, a + 0.3, 1.9, w - 0.6, 0.28, S.tone('#e2b33c', P));
    // cab at the leading end (+x), with lit windows
    R4(ctx, a + w - 5.2, 0.95, 4.9, 3.3, c); R4(ctx, a + w - 5.4, 4.15, 5.3, 0.16, c2);
    const glow = S.pal.dark > 0.3 ? S.tone('#ffe7b3', P, true) : S.tone(S.pal.glass, P);
    R4(ctx, a + w - 4.7, 2.7, 1.5, 1.05, glow); R4(ctx, a + w - 2.7, 2.7, 1.7, 1.05, glow);
    if (fine) { ctx.fillStyle = c2; for (let x = a + 1.2; x < a + w - 6.2; x += 0.55) ctx.fillRect(x, 2.45, 0.22, 0.95); R4(ctx, a + 2, 3.7, 2.2, 0.3, mid); R4(ctx, a + 7, 3.7, 2.2, 0.3, mid); }
    // warning stripes on the nose
    for (let i = 0; i < 4; i++) poly(ctx, [a + w - 0.3, 0.95 + i * 0.36, a + w - 0.3, 1.13 + i * 0.36, a + w - 0.8, 1.31 + i * 0.36, a + w - 0.8, 1.13 + i * 0.36], S.tone('#e2b33c', P));
    circ(ctx, a + w - 0.42, 3.0, 0.2, S.pal.dark > 0.3 ? '#fff3c4' : S.tone('#e8e4d0', P));
    if (S.pal.dark > 0.3) { ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(a + w, 0, a + w + 26, 0); g.addColorStop(0, 'rgba(255,238,185,0.3)'); g.addColorStop(1, 'rgba(255,238,185,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(a + w - 0.3, 3.0); ctx.lineTo(a + w + 26, 5.2); ctx.lineTo(a + w + 26, 0); ctx.closePath(); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
  } else if (kind === 'tank') {
    const r = 1.52, cy = 2.52;
    R4(ctx, a + 0.3 + r, cy - r, w - 0.6 - 2 * r, 2 * r, c); circ(ctx, a + 0.3 + r, cy, r, c); circ(ctx, a + w - 0.3 - r, cy, r, c);
    R4(ctx, a + 0.3 + r, cy - r, w - 0.6 - 2 * r, 0.5, hi); R4(ctx, a + 0.6, cy - 0.16, w - 1.2, 0.32, c2);
    R4(ctx, a + w / 2 - 0.9, cy + r - 0.05, 1.8, 0.42, c2);
    // end frames and a catwalk square the outline off
    R4(ctx, a + 0.3, 0.95, 0.22, 3.3, mid); R4(ctx, a + w - 0.52, 0.95, 0.22, 3.3, mid); R4(ctx, a + 0.3, 4.12, w - 0.6, 0.13, mid);
    if (fine) { line(ctx, a + w / 2 + 1.6, 0.95, a + w / 2 + 1.6, 4.1, mid, 0.07, env); line(ctx, a + w / 2 + 2.1, 0.95, a + w / 2 + 2.1, 4.1, mid, 0.07, env); }
  } else if (kind === 'cont') {
    R4(ctx, a + 0.3, 0.95, w - 0.6, 0.28, mid);
    const cols = ['#a8452f', '#2f6a8a', '#c9a23a', '#4a7a52', '#8a8f96', '#7a3a5a'];
    for (let i = 0; i < 2; i++) {
      const cx = a + 0.5 + i * ((w - 1.0) / 2), cw = (w - 1.0) / 2 - 0.15, cc = cols[(k + i * 3) % cols.length];
      R4(ctx, cx, 1.23, cw, 3.02, S.tone(cc, P)); R4(ctx, cx, 4.05, cw, 0.2, S.tone(darken(cc, 0.25), P));
      if (fine) { ctx.fillStyle = S.tone(darken(cc, 0.2), P); for (let x = cx + 0.3; x < cx + cw; x += 0.46) ctx.fillRect(x, 1.4, 0.1, 2.55); }
    }
  } else if (kind === 'hop') {
    poly(ctx, [a + 0.3, 4.25, a + w - 0.3, 4.25, a + w - 0.3, 2.0, a + w - 2.2, 0.95, a + 2.2, 0.95, a + 0.3, 2.0], c);
    R4(ctx, a + 0.3, 3.95, w - 0.6, 0.3, c2);
    if (fine) { ctx.fillStyle = c2; for (let x = a + 1.2; x < a + w - 0.6; x += 1.5) ctx.fillRect(x, 1.9, 0.14, 2.1); }
  } else { // box van
    R4(ctx, a + 0.3, 0.95, w - 0.6, 3.15, c); R4(ctx, a + 0.2, 4.05, w - 0.4, 0.2, c2);
    R4(ctx, a + w / 2 - 1.5, 1.1, 3.0, 2.85, c2); R4(ctx, a + w / 2 - 1.5, 1.1, 0.14, 2.85, hi);
    if (fine) { ctx.fillStyle = c2; for (let x = a + 0.9; x < a + w - 0.6; x += 1.15) if (Math.abs(x - (a + w / 2)) > 1.7) ctx.fillRect(x, 1.1, 0.1, 2.85); }
  }
}
const STOCK_COLS = ['#7a4a38', '#4a5a6a', '#6a6a52', '#5a4038', '#3f5a52', '#70583a'];
const STOCK_MIX = [['box', 'tank', 'cont', 'box', 'hop'], ['cont', 'box', 'hop', 'tank', 'box'], ['hop', 'hop', 'box', 'cont', 'tank'], ['tank', 'cont', 'box', 'box', 'cont']];

// A freight train as a vehicle kind: an engine and five wagons. Solid.
CARS.freight = { len: 104, h: 4.3, body: 4.3, cab: [-0.5, 0.5], win: [], seats: [], wheel: 0, solid: true, train: true,
  draw(ctx, env, S, P, x, y, dir, colHex, st) {
    const L = 104, k = (st && st.seed) || 0, mixk = STOCK_MIX[k % STOCK_MIX.length];
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    let a = L / 2 - 18;
    drawStock(ctx, env, S, P, 'loco', a, 18, colHex || '#3d5a80', k);
    for (let i = 0; i < 5; i++) { a -= 17.2; drawStock(ctx, env, S, P, mixk[i], a + 0.4, 16.4, STOCK_COLS[(k * 2 + i * 5) % STOCK_COLS.length], k + i); }
    ctx.restore();
  } };

// Wagons that never move: scenery on a siding. kinds is a list of wagon kinds.
K.wagons = function (S, P, x, kinds, o) {
  o = o || {}; const y = o.y || 0, n = kinds.length, w = n * 17.2, k = o.seed || 0;
  P.add({ x0: x, x1: x + w, layer: o.layer || 0, draw(ctx, env) {
    ctx.save(); ctx.translate(0, y);
    for (let i = 0; i < n; i++) { const a = x + i * 17.2; if (a + 17 < env.x0 || a > env.x1) continue; drawStock(ctx, env, S, P, kinds[i], a + 0.4, 16.4, STOCK_COLS[(k + i * 5) % STOCK_COLS.length], k + i); }
    ctx.restore();
  } });
  if (o.solid !== false) P.solid(x + 0.4, y, w - 0.8, 4.3, 'hard');
  return { x0: x, x1: x + w };
};

// A colour-light signal on a post. state.on true shows green, otherwise red.
K.railSignal = function (S, P, x, h, state, o) {
  o = o || {}; const y = o.y || 0, post = S.tone('#20242b', P), head = S.tone('#0d0f13', P);
  P.add({ x0: x - 4, x1: x + 4, layer: o.layer === undefined ? 2 : o.layer, draw(ctx, env) {
    line(ctx, x, y, x, y + h, post, 0.16, env);
    if (env.s > 3) { for (let yy = y + 0.6; yy < y + h - 1.6; yy += 0.5) line(ctx, x + 0.08, yy, x + 0.45, yy, post, 0.04, env); line(ctx, x + 0.45, y + 0.4, x + 0.45, y + h - 1.6, post, 0.05, env); }
    R4(ctx, x - 0.38, y + h - 1.5, 0.76, 1.6, head); circ(ctx, x, y + h + 0.1, 0.38, head);
    const on = state && state.on, live = on ? '#4dff8a' : '#ff4034';
    circ(ctx, x, y + h - 0.3, 0.2, on ? live : '#1c2a20'); circ(ctx, x, y + h - 1.05, 0.2, on ? '#2a1614' : live);
    const ly = on ? y + h - 0.3 : y + h - 1.05;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const r = Math.max(1.1, env.px * 7);
    const g = ctx.createRadialGradient(x, ly, 0, x, ly, r); g.addColorStop(0, on ? 'rgba(80,255,140,0.75)' : 'rgba(255,70,55,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, ly, r, 0, TAU); ctx.fill(); ctx.restore();
  } });
};

// A tall lattice mast with a bank of lamps. It is a real, shootable light.
K.floodlight = function (S, P, x, h, zone, o) {
  o = o || {}; const y = o.y || 0, steel = S.tone('#2a2e36', P);
  const ob = S.obj({ kind: 'lamp', id: o.id, plane: P, x, y: y + h, r: o.r || 0.55, zone, on: true, mat: 'glass', layer: 2, reach: o.reach || 16,
    draw(ctx, env) {
      ctx.strokeStyle = steel; ctx.lineWidth = Math.max(0.1, env.px * 0.9);
      ctx.beginPath(); ctx.moveTo(x - 0.55, y); ctx.lineTo(x - 0.2, y + h); ctx.moveTo(x + 0.55, y); ctx.lineTo(x + 0.2, y + h);
      if (env.s > 1.6) { const n = Math.floor(h / 1.5); for (let i = 0; i < n; i++) { const u0 = i / n, u1 = (i + 1) / n, w0 = lerp(0.55, 0.2, u0), w1 = lerp(0.55, 0.2, u1), sg = i % 2 ? 1 : -1; ctx.moveTo(x - sg * w0, y + h * u0); ctx.lineTo(x + sg * w1, y + h * u1); } }
      ctx.stroke();
      R4(ctx, x - 1.3, y + h - 0.35, 2.6, 0.7, steel);
      const live = ob.alive && ob.on !== false;
      for (let i = 0; i < 4; i++) R4(ctx, x - 1.15 + i * 0.6, y + h - 0.22, 0.44, 0.44, live ? '#fff3c4' : S.tone('#3a3f47', P));
      if (live && S.pal.dark > 0.25) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, y + h, 0.2, x, y + h, 4.5); g.addColorStop(0, 'rgba(255,232,170,' + (0.7 * S.pal.dark + 0.15) + ')'); g.addColorStop(1, 'rgba(255,232,170,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y + h, 4.5, 0, TAU); ctx.fill();
        const sp = (o.reach || 16) * 0.9, g2 = ctx.createLinearGradient(0, y + h, 0, y);
        g2.addColorStop(0, 'rgba(255,226,160,' + (0.22 * S.pal.dark + 0.04) + ')'); g2.addColorStop(1, 'rgba(255,226,160,0.02)');
        ctx.fillStyle = g2; ctx.beginPath(); ctx.moveTo(x - 1.2, y + h); ctx.lineTo(x + 1.2, y + h); ctx.lineTo(x + sp, y); ctx.lineTo(x - sp, y); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    } });
  return ob;
};

// The signal box: brick below, a glazed cabin above. People inside the cabin
// are in the room `<id>` and are seen through its long window.
K.signalBox = function (S, P, x, o) {
  o = o || {}; const y = o.y || 0, w = o.w || 8, id = o.id || 'sigbox';
  const brick = S.tone('#7a4a3c', P), brick2 = S.tone('#5e382e', P), wood = S.tone('#d8cfb8', P), roof = S.tone('#2c3038', P), glass = S.tone(S.pal.glass, P), inRoom = S.tone(S.pal.inRoom, P);
  const room = S.room(id, o.lit !== false), fy = y + 3.4;
  const op = P.open({ x: x + 0.5, y: fy + 0.9, w: w - 1.0, h: 1.7, room: id, glass: true, blind: 0, deco: 3, tint: '#ffd98a', f: 1, c: 0 });
  P.solid(x, y, w, 3.4 + 0.9, 'wall'); P.solid(x, fy + 2.6, w, 0.5, 'wood'); P.solid(x, fy + 0.9, 0.5, 1.7, 'wood'); P.solid(x + w - 0.5, fy + 0.9, 0.5, 1.7, 'wood');
  P.add({ x0: x - 2.5, x1: x + w + 1, layer: 0, draw(ctx, env) {
    R4(ctx, x, y, w, 3.4, brick); R4(ctx, x + w - 0.5, y, 0.5, 3.4, brick2);
    R4(ctx, x + 1.0, y, 1.3, 2.3, S.tone('#2a2420', P)); R4(ctx, x + w - 3.2, y + 1.1, 1.6, 1.2, inRoom);
    R4(ctx, x - 0.25, fy, w + 0.5, 3.1, wood); R4(ctx, x - 0.25, fy, w + 0.5, 0.2, brick2);
    if (room.lit) { R4(ctx, op.x, op.y, op.w, op.h, S.tone('#ffd98a', P, true)); if (env.s > 3) { ctx.fillStyle = S.tone('#8a6a3a', P, true); for (let i = 0; i < 9; i++) ctx.fillRect(op.x + 0.5 + i * 0.5, op.y, 0.09, 0.7 + (i % 3) * 0.12); } }
    else R4(ctx, op.x, op.y, op.w, op.h, env.nv ? mix(inRoom, '#2c5a3a', 0.5) : inRoom);
    // outside stair
    poly(ctx, [x - 2.4, y, x - 0.25, fy, x - 0.25, fy - 0.3, x - 2.0, y], brick2);
  } });
  P.add({ x0: x - 1.5, x1: x + w + 1.5, layer: 1, draw(ctx, env) {
    ctx.fillStyle = room.lit ? 'rgba(255,255,255,0.05)' : 'rgba(150,190,230,0.10)'; if (!op.broken) ctx.fillRect(op.x, op.y, op.w, op.h);
    ctx.strokeStyle = wood; ctx.lineWidth = Math.max(0.09, env.px * 0.9); ctx.strokeRect(op.x, op.y, op.w, op.h);
    ctx.beginPath(); for (let i = 1; i < 6; i++) { ctx.moveTo(op.x + (i * op.w) / 6, op.y); ctx.lineTo(op.x + (i * op.w) / 6, op.y + op.h); } ctx.stroke();
    poly(ctx, [x - 0.9, fy + 3.1, x + w + 0.9, fy + 3.1, x + w - 1.1, fy + 4.5, x + 1.1, fy + 4.5], roof);
    R4(ctx, x + 1.2, y + 2.55, w - 2.4, 0.62, S.tone('#1c1f26', P)); env.text(ctx, o.name || 'CALDER YARD', x + w / 2, y + 2.68, 0.42, S.tone('#f3e9c9', P, true), 'center');
  } });
  return { x, w, room: id, floor: fy, op, at: (xx, extra) => Object.assign({ plane: P, x: xx, y: fy, room: id, zone: id, behind: true }, extra || {}) };
};

// A water tower on a lattice of legs.
K.yardTank = function (S, P, x, o) {
  o = o || {}; const y = o.y || 0, h = o.h || 11, w = o.w || 7.5, th = o.th || 5;
  const leg = S.tone('#2f333b', P), tank = S.tone(o.col || '#7d5a45', P), band = S.tone(darken(o.col || '#7d5a45', 0.28), P), hi = S.tone(lighten(o.col || '#7d5a45', 0.14), P);
  P.add({ x0: x - w, x1: x + w + 4, layer: o.layer || 0, draw(ctx, env) {
    ctx.strokeStyle = leg; ctx.lineWidth = Math.max(0.2, env.px);
    ctx.beginPath();
    for (const sx of [-1, -0.33, 0.33, 1]) { ctx.moveTo(x + sx * w * 0.5, y); ctx.lineTo(x + sx * w * 0.42, y + h); }
    ctx.stroke(); ctx.lineWidth = Math.max(0.09, env.px * 0.7); ctx.beginPath();
    for (let i = 0; i < 3; i++) { const y0 = y + (h * i) / 3, y1 = y + (h * (i + 1)) / 3; ctx.moveTo(x - w * 0.49, y0); ctx.lineTo(x + w * 0.45, y1); ctx.moveTo(x + w * 0.49, y0); ctx.lineTo(x - w * 0.45, y1); ctx.moveTo(x - w * 0.47, y1); ctx.lineTo(x + w * 0.47, y1); }
    ctx.stroke();
    R4(ctx, x - w / 2 - 0.3, y + h, w + 0.6, 0.35, leg);
    R4(ctx, x - w / 2, y + h + 0.35, w, th, tank); R4(ctx, x - w / 2, y + h + 0.35, w * 0.16, th, hi);
    ctx.fillStyle = band; for (let i = 0; i < 4; i++) ctx.fillRect(x - w / 2, y + h + 0.8 + i * (th - 0.9) / 3, w, 0.16);
    poly(ctx, [x - w / 2 - 0.4, y + h + th + 0.35, x + w / 2 + 0.4, y + h + th + 0.35, x, y + h + th + 2.3], band);
    // the spout arm
    line(ctx, x + w / 2, y + h + 0.9, x + w / 2 + 3.4, y + h - 1.2, leg, 0.3, env); line(ctx, x + w / 2 + 3.4, y + h - 1.2, x + w / 2 + 3.4, y + h - 2.2, leg, 0.24, env);
    if (o.text) env.text(ctx, o.text, x, y + h + th * 0.42, 1.25, S.tone('#e9e0c8', P), 'center');
  } });
  P.solid(x - w / 2, y + h, w, th + 0.35, 'hard');
  return { x, top: y + h + th + 0.35, rim: y + h + th + 0.35, w };
};

// A long brick engine shed with arched doors and a saw-tooth glass roof.
K.engineShed = function (S, P, x, w, o) {
  o = o || {}; const y = o.y || 0, h = o.h || 9, brick = S.tone(o.col || '#6b4a40', P), dark = S.tone('#16181d', P), trim = S.tone('#8a6a5a', P), lit = S.tone('#ffcf7a', P, true), roof = S.tone('#30343c', P);
  const n = Math.max(2, Math.floor(w / 13));
  P.add({ x0: x, x1: x + w, layer: 0, draw(ctx, env) {
    R4(ctx, x, y, w, h, brick); R4(ctx, x, y + h - 0.5, w, 0.5, trim);
    for (let i = 0; i < n; i++) {
      const cx = x + ((i + 0.5) * w) / n;
      if (cx + 8 < env.x0 || cx - 8 > env.x1) continue;
      ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(cx - 2.6, y); ctx.lineTo(cx - 2.6, y + 4.2); ctx.arc(cx, y + 4.2, 2.6, Math.PI, 0, true); ctx.lineTo(cx + 2.6, y); ctx.closePath(); ctx.fill();
      if (S.pal.dark > 0.25 && i % 2 === 0) { ctx.globalAlpha = 0.35; R4(ctx, cx - 2.2, y, 4.4, 2.2, lit); ctx.globalAlpha = 1; }
      poly(ctx, [cx - (w / n) / 2, y + h, cx + (w / n) / 2, y + h, cx + (w / n) / 2, y + h + 3.2], roof);
      poly(ctx, [cx - (w / n) / 2 + 0.4, y + h + 0.1, cx + (w / n) / 2 - 0.6, y + h + 2.8, cx + (w / n) / 2 - 0.6, y + h + 0.1], S.pal.dark > 0.25 ? lit : S.tone(S.pal.glass, P));
    }
  } });
  P.solid(x, y, w, h, 'wall');
};

// The works on the horizon: chimneys, gas holders, cooling towers, sheds.
K.industry = function (S, z, o) {
  o = o || {};
  const P = S.plane(z, 'works'), R = makeRng((o.seed || 3) * 17 + 5), x0 = o.x0 === undefined ? -620 : o.x0, x1 = o.x1 === undefined ? 620 : o.x1, base = o.base || 0;
  const c1 = S.tone(o.col || '#3d4150', P), c2 = S.tone(o.col2 || '#4a4e5e', P), c3 = S.tone('#2f3340', P), lit = S.tone(S.pal.lit, P, true);
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
  P.add({ x0, x1, draw(ctx, env) {
    for (let i = 0; i < things.length; i++) {
      const th = things[i], a = th.x, w = th.w, h = th.h;
      if (a + w + 60 < env.x0 || a - 60 > env.x1) continue;
      if (th.t === 'shed') {
        R4(ctx, a, base, w, h, i % 2 ? c1 : c2);
        const n = Math.max(2, Math.floor(w / 11)); for (let k = 0; k < n; k++) poly(ctx, [a + (k * w) / n, base + h, a + ((k + 1) * w) / n, base + h, a + ((k + 1) * w) / n, base + h + 5], c3);
        if (env.s > 0.25) { ctx.fillStyle = lit; for (let k = 0; k < th.win.length; k++) ctx.fillRect(th.win[k][0], th.win[k][1], 3, 1.6); }
      } else if (th.t === 'stack') {
        poly(ctx, [a, base, a + w, base, a + w * 0.72, base + h, a + w * 0.28, base + h], c3);
        R4(ctx, a + w * 0.26, base + h * 0.9, w * 0.48, h * 0.035, S.tone('#b04a3a', P)); R4(ctx, a + w * 0.24, base + h * 0.8, w * 0.52, h * 0.035, S.tone('#b04a3a', P));
        if (Math.sin(env.t * 2.2 + th.ph * 6) > 0.2) circ(ctx, a + w / 2, base + h + 1.2, Math.max(0.9, env.px * 1.6), '#ff5a48');
        ctx.fillStyle = S.pal.dark > 0.5 ? 'rgba(110,118,140,0.2)' : 'rgba(215,205,205,0.26)';
        for (let k = 0; k < 8; k++) { const u = (env.t * 0.035 + k / 8 + th.ph) % 1; ctx.globalAlpha = (1 - u) * 0.9; ctx.beginPath(); ctx.arc(a + w / 2 + env.wind * u * 26 + Math.sin(u * 7 + k) * 3, base + h + 4 + u * 46, 4 + u * 17, 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
      } else if (th.t === 'gas') {
        R4(ctx, a + 2, base, w - 4, h * 0.82, c2); ctx.fillStyle = c2; ctx.beginPath(); ctx.ellipse(a + w / 2, base + h * 0.82, w / 2 - 2, h * 0.09, 0, Math.PI, 0, true); ctx.fill();
        ctx.strokeStyle = c3; ctx.lineWidth = Math.max(0.6, env.px); ctx.beginPath();
        for (let k = 0; k <= 6; k++) { ctx.moveTo(a + (k * w) / 6, base); ctx.lineTo(a + (k * w) / 6, base + h); }
        for (let k = 1; k <= 3; k++) { ctx.moveTo(a, base + (h * k) / 3); ctx.lineTo(a + w, base + (h * k) / 3); }
        ctx.stroke();
      } else if (th.t === 'cool') {
        ctx.fillStyle = i % 2 ? c1 : c2; ctx.beginPath(); ctx.moveTo(a, base); ctx.quadraticCurveTo(a + w * 0.3, base + h * 0.6, a + w * 0.16, base + h); ctx.lineTo(a + w * 0.84, base + h); ctx.quadraticCurveTo(a + w * 0.7, base + h * 0.6, a + w, base); ctx.closePath(); ctx.fill();
        ctx.fillStyle = S.pal.dark > 0.5 ? 'rgba(120,128,150,0.16)' : 'rgba(232,226,226,0.22)';
        for (let k = 0; k < 6; k++) { const u = (env.t * 0.03 + k / 6 + th.ph) % 1; ctx.globalAlpha = 1 - u; ctx.beginPath(); ctx.arc(a + w / 2 + env.wind * u * 18 + Math.sin(u * 5 + k) * 5, base + h + 4 + u * 40, 10 + u * 22, 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
      } else {
        ctx.strokeStyle = c3; ctx.lineWidth = Math.max(0.7, env.px); ctx.beginPath();
        ctx.moveTo(a, base); ctx.lineTo(a + w * 0.4, base + h); ctx.moveTo(a + w, base); ctx.lineTo(a + w * 0.6, base + h);
        for (let k = 0; k < 5; k++) { const u0 = k / 5, u1 = (k + 1) / 5; ctx.moveTo(a + w * 0.4 * u0, base + h * u0); ctx.lineTo(a + w - w * 0.4 * u1, base + h * u1); ctx.moveTo(a + w - w * 0.4 * u0, base + h * u0); ctx.lineTo(a + w * 0.4 * u1, base + h * u1); }
        ctx.moveTo(a - w * 0.5, base + h * 0.88); ctx.lineTo(a + w * 1.5, base + h * 0.88); ctx.moveTo(a - w * 0.3, base + h * 0.7); ctx.lineTo(a + w * 1.3, base + h * 0.7);
        ctx.stroke();
      }
    }
  } });
  return P;
};

// A line of telegraph poles with sagging wires, for something near the eye.
K.telegraph = function (S, P, xs, h, o) {
  o = o || {}; const y = o.y || 0, wood = S.tone('#2a2420', P), wire = S.tone('#121418', P);
  P.add({ x0: xs[0] - 2, x1: xs[xs.length - 1] + 2, layer: 2, draw(ctx, env) {
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i];
      if (x > env.x0 - 3 && x < env.x1 + 3) { line(ctx, x, y, x, y + h, wood, 0.24, env); line(ctx, x - 1.3, y + h - 0.6, x + 1.3, y + h - 0.6, wood, 0.16, env); line(ctx, x - 1.0, y + h - 1.4, x + 1.0, y + h - 1.4, wood, 0.14, env); }
      if (i < xs.length - 1) {
        ctx.strokeStyle = wire; ctx.lineWidth = Math.max(0.03, env.px * 0.7); ctx.beginPath();
        for (const q of [[-1.2, -0.6], [1.2, -0.6], [-0.9, -1.4], [0.9, -1.4]]) { ctx.moveTo(x + q[0], y + h + q[1]); ctx.quadraticCurveTo((x + xs[i + 1]) / 2 + q[0], y + h + q[1] - 1.5, xs[i + 1] + q[0], y + h + q[1]); }
        ctx.stroke();
      }
    }
  } });
};

// ---- the yard ---------------------------------------------------------------
// Tracks, from the shooter outward: a spare road, the NEAR running line, the
// service strip where people walk (the main plane), the FAR running line, a
// siding with parked wagons and the signal box, then the water tower and the
// engine sheds, and the works beyond.
SCN.yard = function (o) {
  o = o || {};
  const z = o.z || 450, sd = o.seed || 5;
  const S = makeScene({ time: o.time || 'dusk', weather: o.weather, seed: sd, refZ: z, exits: [-82, 82], bounds: { x0: -62, x1: 62, y0: -4, y1: 44 }, ambience: 'city', groundMat: 'dirt', sun: o.sun || [-58, 16] });
  const H = { S, z };
  K.skyline(S, z + 1900, { seed: 31 + sd, hMin: 40, hMax: 170, cols: ['#4c4660', '#574f6a', '#433d58'], groundCol: '#4a4654' });
  H.PI = K.industry(S, z + 820, { seed: sd });

  const PSh = H.PSh = S.plane(z + 124, 'sheds');
  K.ground(S, PSh, { col: '#55504e', noEdge: true });
  K.engineShed(S, PSh, -96, 70, {}); K.engineShed(S, PSh, 30, 44, { h: 7.5, col: '#5e5248' });
  K.box(S, PSh, -22, 0, 12, 13, '#3a3d46', { band: 1.2 }); K.box(S, PSh, -20, 13, 3.5, 6, '#2d3038', { solid: false });
  K.track(S, PSh, {});

  const PW = H.PW = S.plane(z + 66, 'tower');
  K.ground(S, PW, { col: '#5a5450', noEdge: true }); K.track(S, PW, {});
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
  // the lamp hut stands in front of anyone passing behind it
  H.hut = { x0: -9.5, x1: -5.5 };
  K.box(S, PM, -9.5, 0, 4, 3.0, '#6a4a3e', { band: 0.35, layer: 2 }); P_roof(S, PM, -9.9, 3.0, 4.8, '#2c3038');
  PM.add({ x0: -9.5, x1: -5.5, layer: 2, draw(ctx, env) { R4(ctx, -8.9, 0, 1.1, 2.1, S.tone('#2a2420', PM)); R4(ctx, -7.2, 1.2, 1.1, 0.9, S.tone(S.pal.dark > 0.25 ? '#ffd98a' : S.pal.glass, PM, true)); env.text(ctx, 'LAMPS', -7.5, 2.42, 0.34, S.tone('#e9e0c8', PM), 'center'); } });
  K.box(S, PM, 10.2, 0, 1.6, 1.1, '#8a6a45', { mat: 'wood' }); K.box(S, PM, 10.5, 1.1, 1.1, 0.8, '#7a5c3c', { mat: 'wood' });
  K.box(S, PM, -30, 0, 2.2, 1.3, '#4a5560', { mat: 'hard', ribs: 0.4 });
  H.lamps = [K.floodlight(S, PM, -22, 11, 'west', { id: 'fl1', reach: 13 }), K.floodlight(S, PM, 8.4, 11, 'meet', { id: 'fl2', reach: 13 }), K.floodlight(S, PM, 40, 11, 'meet', { id: 'fl3', reach: 13 })];
  // buffer stop at the left end of the strip
  PM.add({ x0: -47, x1: -43, layer: 0, draw(ctx, env) { R4(ctx, -46, 0, 0.3, 1.5, S.tone('#2a2e36', PM)); R4(ctx, -44.2, 0, 0.3, 1.5, S.tone('#2a2e36', PM)); R4(ctx, -46.4, 1.1, 2.9, 0.42, S.tone('#c8372d', PM)); } });

  const PT1 = H.PT1 = S.plane(z - 18, 'near line');
  K.ground(S, PT1, { col: '#6c645c', noEdge: true }); K.track(S, PT1, {});
  K.railSignal(S, PT1, -31, 6.2, H.sig.near, { layer: 0 });

  const PT0 = H.PT0 = S.plane(z - 40, 'spare road');
  K.ground(S, PT0, { col: '#5f5850', noEdge: true }); K.track(S, PT0, { ballast: '#5e5750' });

  const PY = H.PY = S.plane(z - 92, 'fence');
  K.ground(S, PY, { col: '#4a4a44', noEdge: true });
  K.fence(S, PY, -120, 120, 2.3, { kind: 'mesh' });
  K.box(S, PY, -44, 0, 6.1, 2.6, '#3f5a52', { ribs: 0.42, mat: 'hard' });

  K.box(S, PY, 18, 0, 2.4, 1.2, '#6b5440', { mat: 'wood' }); K.box(S, PY, 21, 0, 2.0, 2.0, '#4a5560', { mat: 'hard', ribs: 0.4 });
  K.parked(S, PY, 'truck', 44, -1, '#8a3b2a', { y: 0 });
  PY.add({ x0: -30, x1: 6, layer: 0, draw(ctx, env) { const c = S.tone('#3a2f28', PY), c2 = S.tone('#5a4a3c', PY); for (let i = 0; i < 4; i++) for (let j = 0; j < 4 - i; j++) { R4(ctx, -24 + j * 2.7 + i * 1.35, i * 0.28, 2.6, 0.24, i % 2 ? c2 : c); } } });

  const PN = H.PN = S.plane(z - 170, 'near');
  K.ground(S, PN, { col: '#3b4038', noEdge: true });
  // warehouse roofs below the line of sight, for something close to the eye
  const roof = (x0, w, h, col) => { const c = S.tone(col, PN), c2 = S.tone(darken(col, 0.3), PN), lit = S.tone('#ffcf7a', PN, true), n = Math.max(2, Math.floor(w / 9));
    PN.add({ x0, x1: x0 + w, layer: 0, draw(ctx, env) { R4(ctx, x0, 0, w, h, c); for (let k = 0; k < n; k++) { const a = x0 + (k * w) / n, b = x0 + ((k + 1) * w) / n; poly(ctx, [a, h, b, h, b, h + 2.3], c2); if ((k + Math.floor(x0)) % 3 === 0) poly(ctx, [a + 0.5, h + 0.1, b - 0.5, h + 2.0, b - 0.5, h + 0.1], lit); } R4(ctx, x0, h - 0.3, w, 0.3, c2); } });
    PN.solid(x0, 0, w, h, 'wall'); };
  roof(-150, 62, 4.2, '#4a4650'); roof(-80, 44, 3.4, '#54484a'); roof(22, 52, 4.0, '#463f4c'); roof(82, 70, 3.2, '#4c4a52');
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

// a small pitched roof, drawn in front
function P_roof(S, P, x, y, w, col) {
  const c = S.tone(col, P);
  P.add({ x0: x, x1: x + w, layer: 2, draw(ctx) { poly(ctx, [x, y, x + w, y, x + w - 0.5, y + 0.9, x + 0.5, y + 0.9], c); } });
}
