// ---------------------------------------------------------------------------
// The Calder river and its bridge, seen from downstream.
//
// The river runs toward the shooter. The bridge crosses the view side-on, a
// long way off: a road deck with a railway slung underneath it, two towers
// and a pair of cables. The banks are to the left and right, and step back
// with distance:
//   zb          the bridge itself (road deck 20 m above the water)
//   zb - 60     the right-bank street: the Aurel records office and its row
//   zb - 180    the left-bank quay: a crane, a jetty, the armoury boat
// A mission chooses which of these is its main plane (refZ) and where the
// shooter sits, so one piece of geography serves four different jobs.
// ---------------------------------------------------------------------------

// Water in the middle, quays at the sides. Bullets that fall short splash in
// the river or spark on the quay, whichever is underneath.
K.shore = function (S, P, o) {
  o = o || {};
  const xl = o.left === undefined ? -1e6 : o.left, xr = o.right === undefined ? 1e6 : o.right, qy = o.qy === undefined ? 4 : o.qy;
  const wt = S.tone(o.water || S.pal.water, P), hi = mix(wt, '#ffffff', 0.18), land = S.tone(o.col || '#6b6660', P), wall = S.tone(o.wall || '#4d4944', P), cap = S.tone(o.cap || '#8c867c', P);
  P.groundY = 0; P._gm = 'water';
  P.groundFn = (x) => { const dry = x < xl || x > xr; P._gm = dry ? 'hard' : 'water'; return dry ? qy : 0; };
  Object.defineProperty(P, 'groundMat', { get() { return P._gm; }, set() {}, configurable: true });
  P.add({ x0: -4000, x1: 4000, layer: 0, draw(ctx, env) {
    const a = Math.max(env.x0 - 2, xl), b = Math.min(env.x1 + 2, xr);
    if (b > a) {
      R4(ctx, a, -400, b - a, 400, wt);
      ctx.strokeStyle = hi; ctx.lineWidth = Math.max(0.07, env.px); ctx.beginPath();
      const step = Math.max(4, env.px * 30);
      for (let row = 0; row < 5; row++) {
        const yy = -0.4 - row * row * 1.1 - row * 0.8, s0 = Math.floor(a / step) * step;
        for (let x = s0; x < b; x += step) { const ph = Math.sin(x * 12.9898 + row * 78.233) * 43758.5453, r = ph - Math.floor(ph); if (r > 0.5) continue; const dx = Math.sin(env.t * 0.6 + x + row) * 0.6, xx = x + dx + r * step; if (xx < a || xx + 3 > b) continue; ctx.moveTo(xx, yy); ctx.lineTo(xx + 1.4 + r * 2.4, yy); }
      }
      ctx.stroke();
    }
    if (env.x0 < xl) { R4(ctx, env.x0 - 2, -400, xl - env.x0 + 2, 400 + qy, land); R4(ctx, env.x0 - 2, qy - 0.35, xl - env.x0 + 2, 0.35, cap); R4(ctx, xl - 1.1, -0.2, 1.1, qy + 0.2, wall); }
    if (env.x1 > xr) { R4(ctx, xr, -400, env.x1 - xr + 2, 400 + qy, land); R4(ctx, xr, qy - 0.35, env.x1 - xr + 2, 0.35, cap); R4(ctx, xr, -0.2, 1.1, qy + 0.2, wall); }
  } });
  if (xl > -1e5) P.solid(xl - 1.1, -0.2, 1.1, qy + 0.2, 'hard');
  if (xr < 1e5) P.solid(xr, -0.2, 1.1, qy + 0.2, 'hard');
};

// A prison van: a cab, and a box with one barred window in the side.
// Seat 0 is the driver, seat 1 is whoever is locked in the back.
CARS.pvan = { len: 6.4, h: 2.6, body: 1.15, cab: [-0.5, 0.5], win: [[0.25, 0.43], [-0.31, -0.13]], seats: [0.34, -0.22], wheel: 0.42,
  draw(ctx, env, S, P, x, y, dir, colHex, st) {
    const c = CARS.pvan, L = c.len, col = S.tone(colHex || '#3d4b5c', P), dk = S.tone(darken(colHex || '#3d4b5c', 0.32), P), gl = S.tone(S.pal.glass, P), by = 0.32;
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    R4(ctx, -L / 2, by, L * 0.72, c.h - by, col); R4(ctx, -L / 2, c.h - 0.16, L * 0.72, 0.16, dk);
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(L * 0.22, by); ctx.lineTo(L / 2 - 0.1, by); ctx.quadraticCurveTo(L / 2 + 0.05, by + 0.4, L / 2 - 0.05, c.body + 0.1); ctx.lineTo(L * 0.44, c.h - 0.25); ctx.lineTo(L * 0.22, c.h - 0.25); ctx.closePath(); ctx.fill();
    R4(ctx, -L / 2, by + 0.75, L * 0.72, 0.2, S.tone('#d9dde2', P));
    for (let i = 0; i < 2; i++) { const w0 = c.win[i][0] * L, w1 = c.win[i][1] * L, broken = st && st.glass && st.glass[i]; R4(ctx, w0, c.body + 0.06, w1 - w0, c.h - c.body - 0.2, broken ? S.tone('#0d1016', P) : (i ? S.tone('#10141b', P) : gl)); }
    R4(ctx, L / 2 - 0.2, c.body - 0.3, 0.2, 0.18, S.pal.dark > 0.3 ? '#fff3c4' : S.tone('#e8e4d0', P)); R4(ctx, -L / 2, c.body - 0.2, 0.14, 0.16, S.pal.dark > 0.3 ? '#ff4a3d' : S.tone('#a8322a', P));
    R4(ctx, -L / 2 + 0.02, by + 0.1, L - 0.06, 0.08, dk);
    const wx = [-L * 0.31, L * 0.31];
    for (let i = 0; i < 2; i++) { const flat = st && st.flat && st.flat[i]; ctx.fillStyle = S.tone('#0e1014', P); ctx.beginPath(); ctx.ellipse(wx[i], c.wheel * (flat ? 0.8 : 1), c.wheel, c.wheel * (flat ? 0.8 : 1), 0, 0, TAU); ctx.fill(); circ(ctx, wx[i], c.wheel * (flat ? 0.8 : 1), c.wheel * 0.45, S.tone('#8d949a', P)); }
    ctx.restore();
  } };
// Bars over the back window of a prison van. They are drawn in front of the
// prisoner, so the scene adds them as a late layer that follows the van.
K.vanBars = function (S, P, ref) {
  P.add({ x0: -4000, x1: 4000, layer: 2, draw(ctx, env) {
    const v = ref.v; if (!v || v.gone) return;
    const c = CARS.pvan, L = c.len, w0 = v.x + v.dir * c.win[1][v.dir > 0 ? 0 : 1] * L, ww = (c.win[1][1] - c.win[1][0]) * L, y0 = v.y + c.body + 0.06, hh = c.h - c.body - 0.2;
    ctx.strokeStyle = S.tone('#c9ced3', P); ctx.lineWidth = Math.max(0.045, env.px * 0.7); ctx.beginPath();
    for (let i = 0; i <= 5; i++) { ctx.moveTo(w0 + (i * ww) / 5, y0); ctx.lineTo(w0 + (i * ww) / 5, y0 + hh); }
    ctx.moveTo(w0, y0); ctx.lineTo(w0 + ww, y0); ctx.moveTo(w0, y0 + hh); ctx.lineTo(w0 + ww, y0 + hh); ctx.stroke();
  } });
};

// A police launch: white hull, blue band, a lit cabin and a blue lamp.
CARS.plaunch = { len: 7.6, h: 2.0, body: 0.95, cab: [-0.14, 0.18], win: [[-0.1, 0.14]], seats: [0.02, -0.3], wheel: 0,
  draw(ctx, env, S, P, x, y, dir, colHex, st) {
    const c = CARS.plaunch, L = c.len, hull = S.tone('#e4e8ec', P, true), band = S.tone(colHex || '#27365a', P, true), dk = S.tone('#1b1e24', P);
    ctx.save(); ctx.translate(x, y + Math.sin(env.t * 1.3 + x * 0.2) * 0.05); ctx.scale(dir, 1);
    poly(ctx, [-L / 2, 0.95, L / 2 + 0.7, 0.95, L / 2 - 0.2, -0.15, -L / 2 + 0.2, -0.15], hull); R4(ctx, -L / 2, 0.5, L + 0.45, 0.2, band);
    poly(ctx, [c.cab[0] * L - 0.2, 0.95, c.cab[1] * L + 0.5, 0.95, c.cab[1] * L + 0.1, 2.0, c.cab[0] * L, 2.0], hull);
    R4(ctx, c.win[0][0] * L, c.body + 0.06, (c.win[0][1] - c.win[0][0]) * L, c.h - c.body - 0.2, st && st.glass && st.glass[0] ? dk : S.tone(S.pal.dark > 0.3 ? '#ffe7b3' : S.pal.glass, P, true));
    R4(ctx, -L / 2 - 0.25, 0.3, 0.3, 0.9, dk); line(ctx, 0.3, 2.0, 0.3, 2.7, dk, 0.06, env);
    if (Math.sin(env.t * 9) > 0) { circ(ctx, 0.3, 2.78, Math.max(0.13, env.px * 1.5), '#4a9dff'); if (S.pal.dark > 0.3) { ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(0.3, 2.78, 0, 0.3, 2.78, 2.2); g.addColorStop(0, 'rgba(80,160,255,0.5)'); g.addColorStop(1, 'rgba(80,160,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0.3, 2.78, 2.2, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; } }
    if (st && st.moving) { ctx.strokeStyle = 'rgba(230,240,250,0.5)'; ctx.lineWidth = Math.max(0.06, env.px); ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(-L / 2 - 0.4 - i * 1.1, -0.05); ctx.lineTo(-L / 2 - 1.2 - i * 1.1, 0.12 - i * 0.03); } ctx.stroke(); }
    ctx.restore();
  } };

// A helicopter. It is flown along x by its routine; give it a yFn to climb.
CARS.bheli = { len: 13, h: 3.6, body: 3.6, cab: [-0.5, 0.5], win: [], seats: [], wheel: 0, solid: true,
  draw(ctx, env, S, P, x, y, dir, colHex, st) {
    const col = S.tone(colHex || '#1d2026', P), dk = S.tone('#0d0f13', P), gl = S.tone('#6f8ea6', P);
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); ctx.rotate(st && st.moving ? -0.09 : 0);
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(1.6, 1.5, 3.4, 1.45, 0, 0, TAU); ctx.fill();
    poly(ctx, [-1, 2.2, -7.2, 2.0, -7.2, 1.55, -1, 0.9], col); poly(ctx, [-7.4, 1.4, -6.2, 1.5, -6.6, 3.4, -7.6, 3.4], col);
    ctx.fillStyle = gl; ctx.beginPath(); ctx.ellipse(3.3, 1.75, 1.5, 0.95, 0, -1.2, 1.4); ctx.closePath(); ctx.fill();
    R4(ctx, 1.4, 2.9, 0.4, 0.55, dk); line(ctx, 0, 0.05, 3.6, 0.05, dk, 0.12, env); line(ctx, 0.8, 0.05, 1.0, 0.7, dk, 0.08, env); line(ctx, 2.8, 0.05, 2.6, 0.7, dk, 0.08, env);
    const ph = env.t * 31, rw = 7.2 * Math.abs(Math.cos(ph)) + 0.6;
    ctx.globalAlpha = 0.55; R4(ctx, 1.6 - rw, 3.42, rw * 2, 0.12, dk); ctx.globalAlpha = 0.16; R4(ctx, 1.6 - 7.6, 3.4, 15.2, 0.16, dk); ctx.globalAlpha = 1;
    circ(ctx, -7.1, 2.6, 0.9 * Math.abs(Math.sin(ph * 1.7)) + 0.12, 'rgba(13,15,19,0.5)');
    if (Math.sin(env.t * 7) > 0.2) circ(ctx, -7.3, 3.5, Math.max(0.16, env.px * 1.4), '#ff4034');
    if (Math.sin(env.t * 7 + 2) > 0.5) circ(ctx, 1.6, 0.1, Math.max(0.14, env.px * 1.3), '#f4f6ff');
    ctx.restore();
  } };

// The armoury boat: a fat river launch with a wheelhouse, crates on deck and
// fuel drums at the stern (the right-hand end). Shoot the fuel and she goes
// down. Returns { fuel, deckY, x0, x1 }.
K.armsBoat = function (S, P, x0, o) {
  o = o || {};
  const len = o.len || 16, x1 = x0 + len, dy = o.deckY === undefined ? 1.6 : o.deckY;
  const st = { sunkT: null };
  const fuel = K.thing(S, P, 'tank', x1 - 2.6, dy + 0.75, { id: o.id || 'fuel', blast: o.blast || 8, r: 0.95, onHit(sim) { if (st.sunkT === null) st.sunkT = sim.t; } });
  fuel.draw = function () {}; // drawn with the boat (below) so that it sinks with her
  const drums = function (ctx) {
    for (let i = 0; i < 2; i++) { const bx = fuel.x - 0.55 + i * 1.1; R4(ctx, bx - 0.45, dy, 0.9, 1.3, S.tone(i ? '#c23a2e' : '#d4443a', P, true)); R4(ctx, bx - 0.45, dy + 0.4, 0.9, 0.1, S.tone('#8a241c', P, true)); R4(ctx, bx - 0.45, dy + 0.9, 0.9, 0.1, S.tone('#8a241c', P, true)); }
    poly(ctx, [fuel.x, dy + 1.05, fuel.x - 0.26, dy + 0.62, fuel.x + 0.26, dy + 0.62], S.tone('#f4c542', P, true));
  };
  const hull = S.tone(o.col || '#2f3d4a', P), hull2 = S.tone('#1c242c', P), house = S.tone('#cfc8b6', P), wood = S.tone('#8a6a45', P), lit = S.tone('#ffd98a', P, true);
  P.add({ x0: x0 - 6, x1: x1 + 6, layer: 1, draw(ctx, env) {
    const u = st.sunkT === null ? 0 : clamp((env.t - st.sunkT) / 7, 0, 1), bob = Math.sin(env.t * 0.9) * 0.06 * (1 - u);
    ctx.save(); ctx.translate(x1 - 2, dy - 1.4); ctx.rotate(-0.42 * smooth(u * 1.4)); ctx.translate(-(x1 - 2), -(dy - 1.4) + bob - 4.6 * u * u);
    poly(ctx, [x0 - 1.4, dy, x1 + 0.3, dy, x1 - 0.4, dy - 2.1, x0 + 1.2, dy - 2.1], hull); R4(ctx, x0 - 1.2, dy - 0.38, len + 1.4, 0.16, S.tone('#b3312b', P)); poly(ctx, [x0 + 1.2, dy - 2.1, x1 - 0.4, dy - 2.1, x1 - 0.6, dy - 2.6, x0 + 1.5, dy - 2.6], hull2);
    // wheelhouse
    R4(ctx, x0 + 3.2, dy, 3.6, 2.5, house); R4(ctx, x0 + 3.0, dy + 2.5, 4.0, 0.22, hull2); R4(ctx, x0 + 3.6, dy + 1.2, 1.2, 0.9, st.sunkT === null && S.pal.dark > 0.3 ? lit : S.tone(S.pal.glass, P)); R4(ctx, x0 + 5.2, dy + 1.2, 1.2, 0.9, st.sunkT === null && S.pal.dark > 0.3 ? lit : S.tone(S.pal.glass, P));
    line(ctx, x0 + 5, dy + 2.7, x0 + 5, dy + 5.6, hull2, 0.1, env); circ(ctx, x0 + 5, dy + 5.7, Math.max(0.14, env.px), st.sunkT === null ? '#fff3c4' : '#3a3f47');
    // crates of "tools"
    R4(ctx, x0 + 8.0, dy, 1.9, 1.1, wood); R4(ctx, x0 + 8.3, dy + 1.1, 1.4, 0.9, S.tone('#7a5c3c', P)); R4(ctx, x0 + 10.2, dy, 1.5, 0.9, S.tone('#5d6b4a', P));
    if (env.s > 5) env.text(ctx, 'TOOLS', x0 + 8.95, dy + 0.38, 0.3, S.tone('#2a2420', P), 'center');
    line(ctx, x0 - 1.3, dy, x0 - 1.3, dy + 1.0, hull2, 0.07, env); line(ctx, x1, dy, x1, dy + 1.0, hull2, 0.07, env); line(ctx, x1 - 5, dy + 1.0, x1, dy + 1.0, hull2, 0.05, env);
    if (st.sunkT === null) drums(ctx);
    ctx.restore();
    if (st.sunkT !== null) { // smoke where she went down
      ctx.fillStyle = 'rgba(40,42,48,0.5)';
      for (let i = 0; i < 9; i++) { const q = ((env.t - st.sunkT) * 0.22 + i / 9) % 1; ctx.globalAlpha = (1 - q) * 0.7 * clamp((env.t - st.sunkT) / 1.2, 0, 1); ctx.beginPath(); ctx.arc(x1 - 3 + (env.wind || 0) * q * 5 + Math.sin(q * 6 + i) * 0.8, dy + 0.5 + q * 13, 0.9 + q * 2.6, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  } });
  P.solid(x0 - 1.2, dy - 2.1, len + 1.2, 2.1, 'hard');
  return { fuel, deckY: dy, x0, x1, st };
};

// A scope lens, or something made to look like one. `kind` chooses what you
// see at high zoom: 'rook' is a man lying behind a rifle, 'mirror' is a
// scrap of looking-glass on a string. `rate` and `phase` set the flashing.
K.lens = function (S, P, x, y, o) {
  o = o || {};
  const ob = K.thing(S, P, 'glint', x, y, Object.assign({ r: 0.42 }, o));
  ob.drawFn = function (ctx, env) {
    const dark = S.tone('#14171c', P);
    if (o.look === 'rook') {
      const f = o.face || -1, gone = !ob.alive ? clamp((env.t - (ob.deadT || env.t)) / 2.2, 0, 1) : 0;
      if (gone < 1) {
        ctx.save(); ctx.globalAlpha = 1 - gone; ctx.translate(-f * gone * 2.2, 0);
        // a man lying behind a rifle: legs, the hump of his back, a hooded head
        const up = gone * 0.7;
        const body = [x - f * 0.45, y - 0.42, x - f * 0.55, y - 0.02 + up, x - f * 1.2, y + 0.06 + up, x - f * 2.15, y - 0.18, x - f * 2.2, y - 0.42];
        poly(ctx, body, dark); ctx.strokeStyle = 'rgba(255,225,205,0.22)'; ctx.lineWidth = Math.max(0.03, env.px * 0.8); ctx.beginPath(); ctx.moveTo(body[2], body[3]); ctx.lineTo(body[4], body[5]); ctx.lineTo(body[6], body[7]); ctx.stroke();
        circ(ctx, x - f * 0.32, y - 0.06 + up, 0.19, dark); circ(ctx, x - f * 0.32, y - 0.06 + up, 0.19 + Math.max(0.02, env.px * 0.6), 'rgba(255,225,205,0.18)'); circ(ctx, x - f * 0.32, y - 0.06 + up, 0.19, dark);
        if (!gone) { ctx.strokeStyle = dark; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(0.07, env.px * 0.8); ctx.beginPath(); ctx.moveTo(x - f * 0.4, y - 0.1); ctx.lineTo(x + f * 1.05, y - 0.1); ctx.moveTo(x + f * 0.55, y - 0.1); ctx.lineTo(x + f * 0.45, y - 0.42); ctx.stroke(); R4(ctx, x - 0.2, y - 0.06, 0.4, 0.13, dark); circ(ctx, x + f * 0.2, y + 0.005, 0.075, ob.alive ? '#6a7c8e' : dark); }
        ctx.restore();
      }
      if (ob.flashT !== undefined && env.t - ob.flashT < 0.14) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const r = Math.max(0.9, env.px * 9); const g = ctx.createRadialGradient(x + f, y, 0, x + f, y, r); g.addColorStop(0, 'rgba(255,240,200,0.95)'); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + f, y, r, 0, TAU); ctx.fill(); ctx.restore(); }
    } else {
      const sw = Math.sin(env.t * 1.7 + x) * 0.07;
      line(ctx, x, y + 0.55, x + sw, y + 0.16, dark, 0.02, env);
      if (ob.alive) { poly(ctx, [x + sw - 0.13, y + 0.16, x + sw + 0.13, y + 0.16, x + sw + 0.1, y - 0.16, x + sw - 0.1, y - 0.16], S.tone('#9fb6c8', P)); poly(ctx, [x + sw - 0.1, y + 0.13, x + sw + 0.02, y + 0.13, x + sw - 0.08, y - 0.1], S.tone('#dfeaf2', P)); }
    }
    if (!ob.alive) return;
    // the flash itself
    let a = 0;
    if (o.flashFn) a = o.flashFn(env.t); else { const u = (env.t * (ob.rate || 0.5) + (ob.phase || 0)) % 1, wdt = ob.duty || 0.16; if (u < wdt) a = Math.sin((u / wdt) * Math.PI); }
    if (a <= 0.02) return;
    const r = Math.max(0.55, env.px * 6) * a;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = Math.max(0.05, env.px * 1.2);
    ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke(); circ(ctx, x, y, r * 0.3, 'rgba(255,255,255,' + a + ')'); ctx.restore();
  };
  return ob;
};

// A church tower with an open belfry. state.ring true swings the bell.
K.belfry = function (S, P, x, o) {
  o = o || {}; const y = o.y || 0, w = o.w || 9, h = o.h || 34, stone = S.tone(o.col || '#8f8a80', P), dark = S.tone('#3a3833', P), roof = S.tone('#3f4a52', P), st = o.state || {};
  P.add({ x0: x - 2, x1: x + w + 2, layer: 0, draw(ctx, env) {
    R4(ctx, x, y, w, h, stone); R4(ctx, x + w - 1.0, y, 1.0, h, S.tone('#7a766c', P));
    R4(ctx, x + w / 2 - 1.6, y + h - 7.5, 3.2, 5, dark); ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(x + w / 2, y + h - 2.5, 1.6, 0, Math.PI); ctx.fill();
    const sw = st.ring ? Math.sin(env.t * 4.6) * 0.5 : 0;
    ctx.save(); ctx.translate(x + w / 2, y + h - 2.6); ctx.rotate(sw); poly(ctx, [-0.35, 0, 0.35, 0, 1.0, -2.0, -1.0, -2.0], S.tone('#c9a23a', P)); circ(ctx, 0, -2.15, 0.25, S.tone('#3a2f1a', P)); ctx.restore();
    circ(ctx, x + w / 2, y + h - 12, 2.2, S.tone('#e9e4d6', P)); line(ctx, x + w / 2, y + h - 12, x + w / 2, y + h - 10.4, dark, 0.14, env); line(ctx, x + w / 2, y + h - 12, x + w / 2 + 1.1, y + h - 12.6, dark, 0.14, env);
    poly(ctx, [x - 0.6, y + h, x + w + 0.6, y + h, x + w / 2, y + h + 15], roof); R4(ctx, x - 0.8, y + h - 0.3, w + 1.6, 0.6, S.tone('#a8a296', P));
  } });
  P.solid(x, y, w, h - 7.5, 'wall'); P.solid(x, y + h - 2.5, w, 2.5, 'wall');
};

// A row of low warehouses with saw-tooth roofs (left bank dressing).
K.sheds = function (S, P, x0, x1, o) {
  o = o || {}; const y = o.y || 0, h = o.h || 9, R = makeRng(Math.floor(x0 * 3 + 11)), list = []; let x = x0;
  while (x < x1 - 8) { const w = Math.min(x1 - x, R.r(16, 30)); list.push([x, w, h * R.r(0.75, 1.15), R.pick(['#6b5a52', '#5a6068', '#7a6a55', '#4f585c'])]); x += w + 0.6; }
  P.add({ x0, x1, layer: 0, draw(ctx, env) {
    for (let i = 0; i < list.length; i++) { const b = list[i]; if (b[0] + b[1] < env.x0 || b[0] > env.x1) continue;
      R4(ctx, b[0], y, b[1], b[2], S.tone(b[3], P)); const n = Math.max(2, Math.floor(b[1] / 7));
      for (let k = 0; k < n; k++) poly(ctx, [b[0] + (k * b[1]) / n, y + b[2], b[0] + ((k + 1) * b[1]) / n, y + b[2], b[0] + ((k + 1) * b[1]) / n, y + b[2] + 2.6], S.tone(darken(b[3], 0.3), P));
      R4(ctx, b[0] + b[1] * 0.3, y, b[1] * 0.4, b[2] * 0.5, S.tone(darken(b[3], 0.45), P));
      if (S.pal.dark > 0.3) for (let k = 0; k < n; k++) if ((k + i) % 3 === 0) R4(ctx, b[0] + (k + 0.25) * b[1] / n, y + b[2] * 0.68, 2.2, 1.0, S.tone(S.pal.lit, P, true)); }
  } });
  list.forEach((b) => P.solid(b[0], y, b[1], b[2], 'wall'));
};

SCN.bridge = function (o) {
  o = o || {};
  const zb = o.zb || 700, sd = o.seed || 9, D = 20, RD = 13.6, QY = 4, EDGE = 98, TX = 62, TOP = 64;
  const S = makeScene({ time: o.time || 'overcast', weather: o.weather, seed: sd, refZ: o.refZ || zb, exits: o.exits || [-200, 200], bounds: o.bounds || { x0: -108, x1: 108, y0: -6, y1: 76 }, ambience: 'harbour', groundMat: 'hard', sun: o.sun || [60, 50], fog: o.fog });
  const H = { S, zb, D, RD, QY, EDGE, TX, TOP };
  const dark = S.pal.dark > 0.5;

  // ---- far away: hills, the city on both banks, open water between ----
  K.mountains(S, zb + 7000, { seed: 6 + sd, h: 620, col: '#6f7b8a', snowLine: 0.66 });
  const PCl = K.skyline(S, zb + 2100, { seed: 12 + sd, hMin: 40, hMax: 190, x0: -1500, x1: -260, base: 5, ground: false });
  const PCr = K.skyline(S, zb + 2110, { seed: 19 + sd, hMin: 50, hMax: 230, x0: 230, x1: 1500, base: 5, ground: false });
  K.shore(S, PCl, { left: -250, right: 220, qy: 5, col: '#5d6470' }); K.shore(S, PCr, { left: -250, right: 220, qy: 5, col: '#5d6470' });
  const PU = H.PU = S.plane(zb + 520, 'upstream');
  K.shore(S, PU, { left: -118, right: 122, qy: QY, col: '#666a70' });
  // an older stone bridge upstream, and the nearer bank buildings
  PU.add({ x0: -200, x1: 200, layer: 0, draw(ctx, env) {
    const c = S.tone('#7c7a78', PU), c2 = S.tone('#5f5d5c', PU);
    ctx.fillStyle = c; ctx.beginPath(); ctx.rect(-210, 0, 420, 12.2);
    for (let x = -84; x <= 84; x += 42) { ctx.moveTo(x - 17, 0); ctx.quadraticCurveTo(x - 17, 9.6, x, 9.6); ctx.quadraticCurveTo(x + 17, 9.6, x + 17, 0); ctx.closePath(); }
    ctx.fill('evenodd'); R4(ctx, -210, 12.2, 420, 0.7, c2);
  } });
  const mkRow = (P, x0, x1, seed, hMin, hMax, base) => { const R = makeRng(seed), bl = []; let x = x0; while (x < x1) { const w = R.r(12, 26), h = R.r(hMin, hMax); const b = { x, w, h, c: S.tone(R.pick(['#6a6f7a', '#75695f', '#5f6670', '#7d7468', '#565c66']), P), win: [] }; if (S.pal.litChance > 0.1) for (let i = 0; i < Math.floor(w / 4); i++) for (let j = 1; j < Math.floor(h / 4); j++) if (R.chance(S.pal.litChance * 0.6)) b.win.push([x + 1.4 + i * 4, base + j * 4 - 1.2]); bl.push(b); x += w + R.r(0, 3); }
    const lit = S.tone(S.pal.lit, P, true);
    P.add({ x0, x1, layer: 0, draw(ctx, env) { for (let i = 0; i < bl.length; i++) { const b = bl[i]; if (b.x + b.w < env.x0 || b.x > env.x1) continue; R4(ctx, b.x, base, b.w, b.h, b.c); if (i % 3 === 0) poly(ctx, [b.x, base + b.h, b.x + b.w, base + b.h, b.x + b.w / 2, base + b.h + 3], b.c); if (env.s > 0.5) { ctx.fillStyle = lit; for (let j = 0; j < b.win.length; j++) ctx.fillRect(b.win[j][0], b.win[j][1], 1.5, 1.8); } } } }); };
  mkRow(PU, -330, -122, 7 + sd, 12, 30, QY); mkRow(PU, 126, 330, 13 + sd, 14, 36, QY);

  // ---- the bridge ----
  const cableY = H.cableY = (x) => { const ax = Math.abs(x); if (ax <= TX) return D + 4.2 + (TOP - D - 4.2) * (ax / TX) * (ax / TX); const u = clamp((ax - TX) / (160 - TX), 0, 1); return lerp(TOP, D + 1.5, u) - 7 * Math.sin(Math.PI * u) * 0.6; };
  const steel = o.steel || '#a34a34', steelD = darken(steel, 0.3);
  const drawSide = (P, near) => {
    const c = S.tone(near ? steel : darken(steel, 0.12), P), cD = S.tone(steelD, P), cab = S.tone(near ? '#2a2420' : '#3a3430', P);
    P.add({ x0: -180, x1: 180, layer: near ? 2 : 0, draw(ctx, env) {
      // main cable and hangers
      ctx.strokeStyle = cab; ctx.lineWidth = Math.max(near ? 0.5 : 0.4, env.px * 1.2); ctx.beginPath();
      const a = Math.max(-160, Math.floor(env.x0 / 4) * 4 - 4), b = Math.min(160, env.x1 + 4);
      for (let x = a; x <= b; x += 4) { if (x === a) ctx.moveTo(x, cableY(x)); else ctx.lineTo(x, cableY(x)); }
      ctx.stroke();
      ctx.lineWidth = Math.max(0.09, env.px * 0.7); ctx.beginPath();
      for (let x = Math.max(-156, Math.ceil(a / 4) * 4); x <= Math.min(156, b); x += 4) { if (Math.abs(Math.abs(x) - TX) < 3) continue; ctx.moveTo(x, cableY(x)); ctx.lineTo(x, D + 0.2); }
      ctx.stroke();
      // truss around the railway deck
      ctx.strokeStyle = c; ctx.lineWidth = Math.max(0.3, env.px); ctx.beginPath();
      ctx.moveTo(-170, D - 0.9); ctx.lineTo(170, D - 0.9); ctx.moveTo(-170, RD - 0.6); ctx.lineTo(170, RD - 0.6); ctx.stroke();
      if (env.s > 0.6) { ctx.lineWidth = Math.max(0.2, env.px * 0.8); ctx.beginPath(); const t0 = Math.max(-168, Math.floor(env.x0 / 6) * 6 - 6), t1 = Math.min(168, env.x1 + 6); for (let x = t0; x < t1; x += 6) { ctx.moveTo(x, RD - 0.6); ctx.lineTo(x + 3, D - 0.9); ctx.lineTo(x + 6, RD - 0.6); } ctx.stroke(); }
      // railing along the road
      ctx.strokeStyle = cD; ctx.lineWidth = Math.max(0.06, env.px * 0.6); ctx.beginPath(); ctx.moveTo(-170, D + 1.05); ctx.lineTo(170, D + 1.05);
      if (env.s > 2.4) { const r0 = Math.max(-170, Math.floor(env.x0 / 2) * 2), r1 = Math.min(170, env.x1); for (let x = r0; x <= r1; x += 2) { ctx.moveTo(x, D); ctx.lineTo(x, D + 1.05); } }
      ctx.stroke();
    } });
    // towers: a stone pier in the water, a steel leg above it
    [-TX, TX].forEach((tx) => {
      P.add({ x0: tx - 8, x1: tx + 8, layer: near ? 2 : 0, draw(ctx, env) {
        poly(ctx, [tx - 6.5, -1.5, tx + 6.5, -1.5, tx + 5, 6, tx - 5, 6], S.tone('#77726a', P)); R4(ctx, tx - 5.4, 5.4, 10.8, 0.7, S.tone('#8f8a80', P));
        poly(ctx, [tx - 2.9, 6, tx + 2.9, 6, tx + 2.0, TOP + 1, tx - 2.0, TOP + 1], c); poly(ctx, [tx + 1.0, 6, tx + 2.9, 6, tx + 2.0, TOP + 1, tx + 0.8, TOP + 1], cD);
        for (const yy of [D - 1.4, D + 9, 44, 55]) R4(ctx, tx - 3.4, yy, 6.8, 1.3, cD);
        R4(ctx, tx - 3.0, TOP + 1, 6.0, 1.6, cD); poly(ctx, [tx - 2.2, TOP + 2.6, tx + 2.2, TOP + 2.6, tx, TOP + 5.2], c);
        if (Math.sin(env.t * 2.6 + tx) > 0.1) circ(ctx, tx, TOP + 5.5, Math.max(0.3, env.px * 1.6), '#ff4a3d');
      } });
      if (near) { P.solid(tx - 5.4, -1.5, 10.8, 7.5, 'hard'); P.solid(tx - 2.6, 6, 5.2, TOP - 5, 'hard'); }
    });
  };
  const PRf = H.PRf = S.plane(zb + 6, 'bridge far side');
  drawSide(PRf, false);
  const PR = H.PR = S.plane(zb, 'bridge');
  K.shore(S, PR, { left: -EDGE - 4, right: EDGE + 4, qy: QY, col: '#5f5d5c' });
  PR.add({ x0: -400, x1: 400, layer: 0, draw(ctx, env) {
    const c = S.tone('#3a3d44', PR), c2 = S.tone('#565a62', PR), st = S.tone(steelD, PR), stone = S.tone('#77726a', PR), stoneD = S.tone('#5c5852', PR);
    // stone approaches on the banks, with arches
    for (const sg of [-1, 1]) {
      const a = sg > 0 ? EDGE + 4 : -400, w = sg > 0 ? 400 - EDGE - 4 : 400 - EDGE - 4;
      R4(ctx, a, QY, w, D - 0.8 - QY, stone); ctx.fillStyle = stoneD;
      for (let k = 0; k < 9; k++) { const cx = sg * (EDGE + 16 + k * 22); if (cx + 9 < env.x0 || cx - 9 > env.x1) continue; ctx.beginPath(); ctx.moveTo(cx - 7, QY); ctx.lineTo(cx - 7, QY + 6); ctx.arc(cx, QY + 6, 7, Math.PI, 0, true); ctx.lineTo(cx + 7, QY); ctx.closePath(); ctx.fill(); }
      R4(ctx, sg > 0 ? 148 : -160, QY, 12, D + 3 - QY, stone); R4(ctx, sg > 0 ? 147 : -161, D + 3, 14, 1, stoneD);
    }
    R4(ctx, -400, RD - 0.8, 800, 0.5, st); // railway floor
    R4(ctx, -400, D - 0.8, 800, 0.8, c); R4(ctx, -400, D - 0.12, 800, 0.12, c2);
    if (env.s > 1.5) { ctx.fillStyle = S.tone('#d9d2b0', PR); const a0 = Math.floor(env.x0 / 8) * 8; for (let x = a0; x < env.x1; x += 8) ctx.fillRect(x, D - 0.07, 3, 0.07); }
  } });
  PR.solid(-400, D - 0.8, 800, 0.8, 'hard'); PR.solid(-400, RD - 0.9, 800, 0.6, 'hard');
  PR.solid(-400, QY, 400 - EDGE - 4, D - 0.8 - QY, 'wall'); PR.solid(EDGE + 4, QY, 400 - EDGE - 4, D - 0.8 - QY, 'wall');
  H.deckLamps = [];
  if (o.deckLamps !== false) [-132, -108, -84, -36, -12, 12, 36, 84, 108, 132].forEach((x, i) => H.deckLamps.push(K.lamp(S, PRf, x, 6.2, 'deck', { id: 'dl' + i, y: D, reach: 11, arm: 0.7 })));
  // toll booth on the far kerb, with a barrier arm across the lane
  H.barrier = { up: false, x: o.toll === undefined ? 30 : o.toll };
  if (o.toll !== undefined) {
    const bx = o.toll + 1.2;
    S.room('toll', true);
    const top = PRf.open({ x: bx + 0.35, y: D + 1.0, w: 1.9, h: 1.25, room: 'toll', glass: true, blind: 0, deco: 5, tint: '#ffd98a', f: 0, c: 0 });
    PRf.solid(bx, D, 2.6, 2.9, 'wood');
    PRf.add({ x0: bx - 1, x1: bx + 4, layer: 0, draw(ctx, env) { R4(ctx, bx, D, 2.6, 2.7, S.tone('#d9dde2', PRf)); R4(ctx, bx, D, 2.6, 0.95, S.tone('#c8372d', PRf)); drawWindowBack(ctx, env, S, PRf, top, S.tone(S.pal.glass, PRf), S.tone(S.pal.inRoom, PRf)); } });
    PRf.add({ x0: bx - 5, x1: bx + 5, layer: 1, draw(ctx, env) { drawWindowFront(ctx, env, S, PRf, top, S.tone('#eef0ea', PRf), true); R4(ctx, bx - 0.4, D + 2.7, 3.4, 0.3, S.tone('#2a2e36', PRf)); line(ctx, bx + 1.3, D + 3.0, bx + 1.3, D + 5.4, S.tone('#2a2e36', PRf), 0.14, env); R4(ctx, bx - 0.5, D + 5.2, 3.6, 1.2, S.tone('#1c1f26', PRf)); env.text(ctx, 'TOLL', bx + 1.3, D + 5.48, 0.8, S.tone('#f4c542', PRf, true), 'center'); } });
    H.tollAt = (extra) => Object.assign({ plane: PRf, x: bx + 1.3, y: D, room: 'toll', zone: 'toll', behind: true }, extra || {});
  }

  // people on the bridge stand on the near kerb, in front of the traffic
  const PS = H.PS = S.plane(zb - 3, 'kerb');
  if (o.toll !== undefined) PS.add({ x0: o.toll - 7, x1: o.toll + 2, layer: 2, draw(ctx, env) {
    const px = o.toll + 0.6, u = H.barrier.up ? 1 : 0; H.barrier.a = approach(H.barrier.a === undefined ? u : H.barrier.a, u, 0.03);
    const an = Math.PI - H.barrier.a * 1.45; R4(ctx, px - 0.2, D, 0.4, 1.15, S.tone('#2a2e36', PS));
    ctx.save(); ctx.translate(px, D + 1.05); ctx.rotate(an); for (let i = 0; i < 6; i++) R4(ctx, i * 0.9, -0.08, 0.9, 0.16, S.tone(i % 2 ? '#f1ede2' : '#c8372d', PS)); ctx.restore();
  } });
  const PRn = H.PRn = S.plane(zb - 6, 'bridge near side');
  drawSide(PRn, true);

  // ---- right bank: the records office and its row ----
  const PO = H.PO = S.plane(zb - 60, 'office row');
  K.shore(S, PO, { left: -EDGE, right: EDGE, qy: QY, col: '#66625e' });
  if (o.office !== false) {
    const row = [
      { id: 'chand', x: 100, w: 15, floors: 3, wall: '#8a6a58', shop: { sign: 'CHANDLER', awning: '#2f6b4a' }, antenna: 0.3 },
      { id: 'rec', x: 116.5, w: 26, floors: 5, fh: 3.4, wall: '#8f97a0', trim: '#c9ced3', door: 3, hut: 0.72 },
      { id: 'ten', x: 144, w: 16, floors: 4, wall: '#7d5a4a', tank: 0.3 },
      { id: 'cafe', x: 161.5, w: 18, floors: 3, wall: '#a08a70', shop: { sign: 'CAFE', awning: '#b33a3a', door: true } },
      { id: 'mill', x: 181, w: 22, floors: 6, wall: '#6b6f78', tank: 0.6 },
    ];
    H.b = {};
    row.forEach((bd, i) => { H.b[bd.id] = K.building(S, PO, Object.assign({ base: QY, seed: sd * 11 + i * 7 }, bd, (o.row && o.row[bd.id]) || {})); });
    const R = H.b.rec;
    H.bal = { rec2: K.balcony(S, PO, R, 2, 0, 1), rec3: K.balcony(S, PO, R, 3, 5, 6), ten2: K.balcony(S, PO, H.b.ten, 2, 2, 3), ten1: K.balcony(S, PO, H.b.ten, 1, 0, 0) };
    K.fireEscape(S, PO, H.b.cafe, 3, 1, 3);
    PO.add({ x0: R.x, x1: R.x + R.w, layer: 1, draw(ctx, env) { R4(ctx, R.x + 5, R.roofY + 1.0, 16, 1.9, S.tone('#1c1f26', PO)); env.text(ctx, 'AUREL RECORDS', R.x + 13, R.roofY + 1.45, 1.25, dark ? '#9fd0ff' : S.tone('#dfe6ee', PO, true), 'center', dark); line(ctx, R.x + 7, R.roofY + 0.9, R.x + 7, R.roofY + 1.0, S.tone('#2a2e36', PO), 0.2, env); line(ctx, R.x + 19, R.roofY + 0.9, R.x + 19, R.roofY + 1.0, S.tone('#2a2e36', PO), 0.2, env); } });
    PO.solid(R.x + 5, R.roofY + 1.0, 16, 1.9, 'thin');
  }
  H.bell = { ring: false };
  const PCh = H.PCh = S.plane(zb - 28, 'church');
  K.belfry(S, PCh, o.churchX === undefined ? 196 : o.churchX, { y: QY, state: H.bell });
  // left bank at the same depth: warehouses
  K.sheds(S, PO, -240, -EDGE - 6, { y: QY, h: 10 });
  const PSt = H.PSt = S.plane(zb - 67, 'street');
  K.shore(S, PSt, { left: -EDGE, right: EDGE, qy: QY, col: '#6e6a66' });
  H.stLamps = [];
  if (o.office !== false) [109, 131, 153, 175].forEach((x, i) => H.stLamps.push(K.lamp(S, PSt, x, 5.4, 'street', { id: 'sl' + i, y: QY, reach: 9 })));

  // ---- left bank quay: crane, jetty and the armoury boat ----
  const PJ = H.PJ = S.plane(zb - 180, 'quay');
  K.shore(S, PJ, { left: -EDGE + 2, right: EDGE + 6, qy: QY, col: '#5f5b57' });
  K.sheds(S, PJ, -210, -116, { y: QY, h: 8 });
  K.sheds(S, PJ, 214, 300, { y: QY, h: 9 });
  // the near right-bank quay is kept low so that it never hides the street behind it
  [[122, 5.5, 1.6, '#6b5440'], [129.5, 2.4, 2.4, '#3f5a52'], [150, 6.1, 2.6, '#7a3a2e'], [171, 3.2, 1.4, '#8a6a45'], [186, 6.1, 2.6, '#4a5560'], [199, 2.0, 1.2, '#6b5440']].forEach((q) => K.box(S, PJ, q[0], QY, q[1], q[2], q[3], { ribs: q[2] > 2 ? 0.42 : 0, mat: 'hard' }));
  PJ.add({ x0: 100, x1: 210, layer: 0, draw(ctx, env) { const c = S.tone('#2a2e36', PJ); for (let x = 104; x < 210; x += 9) { R4(ctx, x - 0.2, QY, 0.4, 0.6, c); R4(ctx, x - 0.3, QY + 0.5, 0.6, 0.16, c); } } });
  H.rcrane = { x: 112, h: 22 }; K.crane(S, PJ, 112, 22, -15, { y: QY, col: '#c9a23a' });
  if (o.jetty) {
    const jy = 1.6, jx0 = -EDGE + 2, jx1 = -63;
    H.jettyY = jy;
    PJ.add({ x0: jx0 - 6, x1: jx1 + 1, layer: 0, draw(ctx, env) {
      const wood = S.tone('#6b5440', PJ), woodD = S.tone('#3f3226', PJ);
      for (let x = jx0 + 1.5; x < jx1; x += 4) R4(ctx, x - 0.2, -1.2, 0.4, jy + 1.2, woodD);
      R4(ctx, jx0, jy - 0.32, jx1 - jx0, 0.32, wood); R4(ctx, jx0, jy - 0.36, jx1 - jx0, 0.07, woodD);
      poly(ctx, [jx0 - 5, QY, jx0, jy, jx0, jy - 0.3, jx0 - 5, QY - 0.3], wood); // ramp up to the quay
      for (let i = 0; i < 3; i++) R4(ctx, jx1 - 1.2 - i * 9, jy, 0.3, 0.75, woodD);
    } });
    PJ.solid(jx0, jy - 0.36, jx1 - jx0, 0.36, 'wood');
    H.boat = K.armsBoat(S, PJ, -62, { len: 16, deckY: jy, id: 'fuel', blast: o.blast });
    H.jlamp = K.lamp(S, PJ, -82, 5.2, 'jetty', { id: 'jlamp', y: jy, reach: 10 });
    H.blamp = K.lamp(S, PJ, -56, 3.2, 'jetty', { id: 'blamp', y: jy + 2.7, reach: 9, arm: 0 });
    H.crane = { x: -106, h: 17 }; K.crane(S, PJ, -106, 17, 20, { y: QY, col: '#c9a23a' });
    // a work lamp under the jib, so the hook and its load can be seen at night
    PJ.add({ x0: -96, x1: -80, layer: 2, draw(ctx, env) { const lx = -88, ly = QY + 16.7; R4(ctx, lx - 0.35, ly - 0.25, 0.7, 0.25, S.tone('#2a2e36', PJ)); circ(ctx, lx, ly - 0.3, 0.16, '#fff3c4');
      if (S.pal.dark > 0.3) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(0, ly, 0, H.jettyY); g.addColorStop(0, 'rgba(255,225,150,' + 0.3 * S.pal.dark + ')'); g.addColorStop(1, 'rgba(255,225,150,0.03)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(lx - 0.3, ly - 0.3); ctx.lineTo(lx + 0.3, ly - 0.3); ctx.lineTo(lx + 4.2, H.jettyY); ctx.lineTo(lx - 4.2, H.jettyY); ctx.closePath(); ctx.fill(); ctx.restore(); } } });
    H.jetty = (x, extra) => Object.assign({ plane: PJ, x, y: jy, zone: 'jetty', behind: false, room: null }, extra || {});
    H.quay = (x, extra) => Object.assign({ plane: PJ, x, y: QY, zone: 'quay', behind: false, room: null }, extra || {});
  }
  // channel markers nearer the shooter
  const PNr = H.PNr = S.plane(zb - 330, 'channel');
  K.shore(S, PNr, {});
  [[-30, '#3f8f4f'], [34, '#c8372d']].forEach((q) => { PNr.add({ x0: q[0] - 2, x1: q[0] + 2, layer: 0, draw(ctx, env) { const bob = Math.sin(env.t * 1.1 + q[0]) * 0.12, c = S.tone(q[1], PNr); poly(ctx, [q[0] - 0.9, bob, q[0] + 0.9, bob, q[0] + 0.5, 1.5 + bob, q[0] - 0.5, 1.5 + bob], c); line(ctx, q[0], 1.5 + bob, q[0], 3.2 + bob, S.tone('#20242b', PNr), 0.08, env); if (dark && Math.sin(env.t * 2 + q[0]) > 0.4) circ(ctx, q[0], 3.3 + bob, Math.max(0.14, env.px * 1.4), q[1] === '#c8372d' ? '#ff5a48' : '#5aff8a'); } }); });

  // placements
  H.deck = (x, extra) => Object.assign({ plane: PS, x, y: D, zone: 'deck', behind: false, room: null }, extra || {});
  H.street = (x, extra) => Object.assign({ plane: PSt, x, y: QY, zone: 'street', behind: false, room: null }, extra || {});
  H.inWin = (B, f, c, dx, extra) => { const op = B.win(f, c); return Object.assign({ plane: B.P, x: B.winX(c) + (dx || 0), y: B.floorY(f), room: op.room, zone: op.room, behind: true }, extra || {}); };
  H.onRoof = (B, x, extra) => Object.assign({ plane: B.P, x, y: B.roofY, room: B.roofRoom, zone: B.roofRoom, behind: true }, extra || {});
  H.onBal = (bal, x, extra) => Object.assign({ plane: PO, x, y: bal.y, room: null, zone: bal.zone, behind: false }, extra || {});

  // A train across the lower deck. kind is 'train' (passenger) or 'freight'.
  // Returns { veh, trig, t0, t1 }; noise cover runs from t0 to t1.
  H.train = function (q) {
    const kind = q.kind || 'train', L = CARS[kind].len, dir = q.dir || 1, sp = q.speed || 16, run = 200 + L / 2, near = q.near === undefined ? 120 : q.near;
    const veh = { id: q.id, kind, plane: PR, x: -dir * 2000, y: RD, dir, col: q.col || '#56606e', routine: [], st: { glass: [], flat: [], moving: false, seed: q.seed || 0 } };
    const t0 = q.at + (200 - near) / sp, t1 = q.at + (200 + L + near) / sp;
    const start = (sim, at) => { sim.after(at - sim.t, () => { const v = sim.byId[q.id]; v.x = -dir * run; v.gone = false; v.v = sp; v.dir = dir; v.routine = [['drive', dir * run, sp]]; v.pc = 0; v.goal = null; v.wait = 0; }); sim.after(at + (200 - near) / sp - sim.t, () => sim.cover(t1 - t0, 'train')); };
    const trig = q.every ? { at: Math.max(0, q.at - 0.1), every: q.every, do(sim) { start(sim, sim.t + 0.1); } } : { at: Math.max(0, q.at - 0.1), do(sim) { start(sim, q.at); } };
    return { veh, trig, t0, t1, every: q.every };
  };
  return H;
};
