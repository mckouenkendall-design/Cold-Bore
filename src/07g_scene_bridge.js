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
//
// Reflections. A lamp over the river shows in the water as a long column of
// wavering light. Each plane that carries such a lamp remembers where it was
// drawn this frame (brProbe), and every stretch of water nearer the shooter
// draws its own piece of the column, so quays and boats in front still hide it.
// The helpers ydHash, ydGlow, ydLines and ydShape come from the yard file.
// ---------------------------------------------------------------------------

// Remember where a plane was drawn this frame: its scale and the left and top edges of
// the view on it. With that, a point on it can be found on any nearer plane.
function brSnap(P, env) { const q = P._snap || (P._snap = {}); q.s = env.s; q.x0 = env.x0; q.y1 = env.y1; q.t = env.t; }
function brProbe(P) { P.add({ x0: -1e7, x1: 1e7, layer: 0, draw(ctx, env) { brSnap(P, env); } }); }
// Which side the light comes from: -1 when the sun (or the moon) is on the left.
function brSide(S) { return S.sky.sun[0] < 0 ? -1 : 1; }

// Water in the middle, quays at the sides. Bullets that fall short splash in
// the river or spark on the quay, whichever is underneath. The water is lighter
// where it meets the far bank and darker toward us, and its ripples drift toward
// the shooter with the current. The quay walls carry a tide mark and weed, and a
// strip of mud at their foot. Options: glints (the lights of a far bank shining in
// the water), reeds, steps ([x, -1 or 1]: a flight down the quay into the river).
K.shore = function (S, P, o) {
  o = o || {};
  const xl = o.left === undefined ? -1e6 : o.left, xr = o.right === undefined ? 1e6 : o.right, qy = o.qy === undefined ? 4 : o.qy;
  const wcol = o.water || S.pal.water, wt = S.tone(wcol, P), hi = mix(wt, '#ffffff', 0.18), band = mix(wt, S.tone(S.pal.skyBot, P), 0.16), band2 = mix(wt, S.tone(S.pal.skyBot, P), 0.07);
  const land = S.tone(o.col || '#6b6660', P), landD = S.tone(darken(o.col || '#6b6660', 0.12), P), wall = S.tone(o.wall || '#4d4944', P), wallD = S.tone(darken(o.wall || '#4d4944', 0.3), P), cap = S.tone(o.cap || '#8c867c', P), capHi = S.tone(lighten(o.cap || '#8c867c', 0.12), P);
  const weed = S.tone('#2e3a2a', P), mud = S.tone('#4a3f34', P), reed = S.tone('#5a6a3c', P), reed2 = S.tone('#7a7a48', P);
  const dark = S.pal.dark, rain = S.weather === 'rain';
  P.groundY = 0; P._gm = 'water';
  P.groundFn = (x) => { const dry = x < xl || x > xr; P._gm = dry ? 'hard' : 'water'; return dry ? qy : 0; };
  Object.defineProperty(P, 'groundMat', { get() { return P._gm; }, set() {}, configurable: true });
  (S._brWater = S._brWater || []).push(P);
  // the lights of a far bank, shining in the water near it
  const glints = [];
  if (o.glints) { const D = makeRng(Math.round(P.z) + 77); for (let i = 0; i < 70; i++) { const nearBank = i < 46, x = nearBank ? (i % 2 ? xl + D.r(1, 70) : xr - D.r(1, 70)) : D.r(xl, xr); if (x < xl || x > xr) continue; glints.push([x, D.r(0.3, 4), D.r(0.6, 2.2), D.f() * TAU, D.chance(0.25)]); } }
  P.add({ x0: -4000, x1: 4000, layer: 0, draw(ctx, env) {
    brSnap(P, env);
    if (qy + 1 < env.y0 || -400 > env.y1) return;
    const s = env.s, t = env.t, a = Math.max(env.x0 - 2, xl), b = Math.min(env.x1 + 2, xr);
    if (b > a && env.y1 > -60) {
      R4(ctx, a, -400, b - a, 400, wt);
      R4(ctx, a, -1.6, b - a, 1.6, band2); R4(ctx, a, -0.55, b - a, 0.55, band);
      // ripples drifting toward us with the current; each row fades in at the far side.
      // Rows that nearer water would hide are left out.
      const step = Math.max(4, env.px * 30), flow = t * 0.05, ph = flow - Math.floor(flow), cut = brCut(S, P, env);
      ctx.strokeStyle = hi; ctx.lineWidth = Math.max(0.07, env.px);
      for (let row = 0; row < 7; row++) {
        const u = row + ph, yy = -0.3 - u * u * 0.95 - u * 0.75, id = row - Math.floor(flow), s0 = Math.floor(a / step) * step;
        if (yy < env.y0 - 1 || yy > env.y1 + 1 || yy < cut) continue;
        ctx.globalAlpha = Math.min(1, 0.15 + u); ctx.beginPath();
        for (let x = s0; x < b; x += step) { const r = ydHash(Math.round(x / step), id * 7 + 3); if (r > 0.55) continue; const dx = Math.sin(t * 0.6 + x + id) * 0.6, xx = x + dx + r * step; if (xx < a || xx + 3 > b) continue; ctx.moveTo(xx, yy); ctx.lineTo(xx + (1.4 + r * 2.4) * (0.8 + u * 0.12), yy); }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (rain && s > 2.2) { // rings where the rain lands
        ctx.strokeStyle = hi; ctx.lineWidth = Math.max(0.04, env.px * 0.8); ctx.globalAlpha = 0.5; ctx.beginPath();
        for (let i = 0; i < 16; i++) { const k = Math.floor(t * 1.4 + ydHash(i, 9)), u = t * 1.4 + ydHash(i, 9) - k, gx = env.x0 + ydHash(i, k * 3 + 1) * (env.x1 - env.x0), gy = -0.2 - ydHash(i + 5, k) * Math.min(8, -env.y0); if (gx < a || gx > b || gy < env.y0) continue; const r = 0.1 + u * 0.5; ctx.moveTo(gx + r, gy); ctx.ellipse(gx, gy, r, r * 0.2, 0, 0, TAU); }
        ctx.stroke(); ctx.globalAlpha = 1;
      }
      if (glints.length && dark > 0.3 && s > 0.4) { // the far bank's lights, trembling in the water
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,214,150,' + (0.45 * dark).toFixed(3) + ')'; ctx.beginPath();
        for (let i = 0; i < glints.length; i++) { const q = glints[i]; if (q[0] < a || q[0] > b || -q[1] < cut) continue; for (let j = 0; j < (q[4] ? 4 : 2); j++) { const w = q[2] * (0.5 + 0.5 * Math.sin(t * 1.3 + q[3] + j * 1.9)); ctx.rect(q[0] - w / 2 + Math.sin(t * 0.9 + j + q[3]) * 0.3, -q[1] - j * 1.1, w, Math.max(0.25, env.px * 1.2)); } }
        ctx.fill(); ctx.globalCompositeOperation = 'source-over';
      }
      // lamps over the river, reflected
      const L = S._brRefl; if (L && L.length && dark > 0.3) brReflections(ctx, env, S, P, L, a, b);
    }
    // the banks: the quay, its cap, and the wall at the water's edge with its tide mark
    for (let sg = -1; sg <= 1; sg += 2) {
      const edge = sg < 0 ? xl : xr; if (sg < 0 ? env.x0 >= xl : env.x1 <= xr) continue;
      const la = sg < 0 ? env.x0 - 2 : xr, lb = sg < 0 ? xl : env.x1 + 2, wx = sg < 0 ? xl - 1.1 : xr;
      R4(ctx, la, -400, lb - la, 400 + qy, land); R4(ctx, la, qy - 0.35, lb - la, 0.35, cap);
      if (s > 2.5) { R4(ctx, la, qy - 0.06, lb - la, 0.06, capHi); R4(ctx, la, qy - 1.1, lb - la, 0.05, landD); }
      if (o.pave && s > 0.9) { // the quay seen from above: rows of paving, a pair of crane rails, puddles
        const pts = []; for (let k = 1; k < 9; k++) { const yy = qy - 0.35 - k * k * 0.55 - k * 0.5; if (yy < env.y0) break; pts.push(la, yy, lb, yy); }
        if (s > 2) pts.push(la, qy - 2.0, lb, qy - 2.0, la, qy - 2.5, lb, qy - 2.5);
        ydLines(ctx, env, pts, landD, 0.06);
        if (s > 1.5) { ctx.fillStyle = mix(land, S.tone(S.pal.skyBot, P), 0.35); ctx.beginPath(); for (let i = 0; i < 24; i++) { const px = (sg < 0 ? edge - 6 : edge + 6) - sg * ydHash(i, 3) * 150, py = qy - 1.2 - ydHash(i, 5) * 8; if (px < la || px > lb || py < env.y0) continue; ctx.moveTo(px + 1.2, py); ctx.ellipse(px, py, 0.6 + ydHash(i, 7) * 1.4, 0.12, 0, 0, TAU); } ctx.fill(); }
      }
      R4(ctx, wx, -0.2, 1.1, qy + 0.2, wall);
      if (s > 1.5) { R4(ctx, wx, -0.2, 1.1, 1.3, wallD); R4(ctx, wx, -0.2, 1.1, 0.45, weed); ctx.fillStyle = mud; ctx.beginPath(); ydShape(ctx, [edge, -0.05, edge - sg * 1.8, -0.05, edge - sg * 0.9, -0.42, edge, -0.5]); ctx.fill(); }
      if (s > 4) { const pts = []; for (let yy = 0.6; yy < qy - 0.4; yy += 0.6) pts.push(wx, yy, wx + 1.1, yy); ydLines(ctx, env, pts, wallD, 0.03); }
      if (o.reeds && s > 1.2) { // reeds on the bank where the quay wall gives out
        for (let pass = 0; pass < 2; pass++) { ctx.fillStyle = pass ? reed2 : reed; ctx.beginPath(); for (let i = 0; i < 14; i++) { const rx = edge - sg * (0.3 + i * 0.55 + ydHash(i, pass) * 0.4), rh = 0.8 + ydHash(i, 7 + pass) * 1.2, ln = Math.sin(t * 0.9 + i) * 0.08 + (env.wind || 0) * 0.04; ydShape(ctx, [rx - 0.07, -0.1, rx + 0.07, -0.1, rx + ln, rh]); } ctx.fill(); }
      }
    }
    if (o.steps && s > 1.5) { // a flight of steps down the quay to the water
      const sx = o.steps[0], dir = o.steps[1], n = 8, st = qy / n; ctx.fillStyle = cap; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, qy); for (let i = 0; i < n; i++) { const xa = sx - dir * (i + 1) * 0.42; ctx.lineTo(xa, qy - i * st); ctx.lineTo(xa, qy - (i + 1) * st); } ctx.closePath(); ctx.fill();
      if (s > 4) { const pts = []; for (let i = 0; i < n; i++) pts.push(sx - dir * i * 0.42, qy - i * st, sx - dir * (i + 1) * 0.42, qy - i * st); ydLines(ctx, env, pts, wallD, 0.04); }
    }
  } });
  if (xl > -1e5) P.solid(xl - 1.1, -0.2, 1.1, qy + 0.2, 'hard');
  if (xr < 1e5) P.solid(xr, -0.2, 1.1, qy + 0.2, 'hard');
};

// Where the next stretch of water nearer the shooter starts, as a height on plane W: below
// it, that nearer water hides W's. Taken from where the nearer plane was drawn last frame.
function brCut(S, W, env) {
  const ws = S._brWater; let N = null;
  for (let i = 0; i < ws.length; i++) { const q = ws[i]; if (q.z < W.z && (!N || q.z > N.z) && q._snap) N = q; }
  return N ? env.y1 - (N._snap.s * N._snap.y1) / env.s - env.px * 3 : -1e9;
}
// Draws, on the water of plane W, its share of the reflection columns of every listed
// light that is at least as far away as W. A column runs from the waterline under the
// light toward us, to well past the light's mirror image; W draws the part between its
// own waterline and the next nearer stretch of water (that plane draws the rest).
function brReflections(ctx, env, S, W, list, a, b) {
  const sW = env.s, t = env.t, cut = brCut(S, W, env);
  for (let pass = 0; pass < 2; pass++) {
    let any = false;
    for (let i = 0; i < list.length; i++) {
      const Lt = list[i]; if (!!Lt.red !== !!pass) continue;
      const L = Lt.P; if (L.z < W.z) continue;
      const sn = L._snap; if (!sn || sn.t !== t) continue;
      if (Lt.ob ? !Lt.ob.alive || Lt.ob.on === false : Lt.on && !Lt.on(t)) continue;
      const k = sn.s / sW, lx = Lt.ob ? Lt.ob.x : Lt.x, ly = Lt.ob ? Lt.ob.y : Lt.y, xW = env.x0 + k * (lx - sn.x0);
      if (xW < a - 1 || xW > b + 1) continue;
      const yTop = Math.min(0, env.y1 - k * sn.y1), yBot = env.y1 - k * (sn.y1 + Math.min(ly, 32) * 1.15), yEnd = Math.max(yBot, cut, env.y0);
      if (yEnd >= yTop - env.px * 2) continue;
      const len = yTop - yBot, step = Math.max(env.px * 4, (yTop - yEnd) / 60), th = Math.max(env.px * 1.3, Math.min(step * 0.5, env.px * 2.4)), w0 = Math.max(env.px * 5, (Lt.w || 0.6) * k * 1.8);
      if (!any) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = pass ? 'rgba(255,90,70,' + (S.pal.dark > 0.8 ? 0.2 : 0.12) + ')' : 'rgba(255,214,150,' + (S.pal.dark > 0.8 ? 0.36 : 0.2) + ')'; ctx.beginPath(); any = true; }
      for (let yy = yTop - step * 0.5, j = Math.round((yTop - env.y1) / step); yy > yEnd; yy -= step, j++) {
        const f = (yTop - yy) / len; if (Math.sin(t * 2.9 + j * 1.37 + i * 2.1) < f * 1.4 - 0.7) continue;
        const ww = w0 * (0.75 + f * 0.9) * (1 - f * 0.75) * (0.45 + 0.55 * Math.abs(Math.sin(t * 1.9 + j * 0.83 + lx)));
        ctx.rect(xW - ww / 2 + Math.sin(t * 1.6 + j * 2.3 + lx) * w0 * 0.3 * (0.4 + f), yy, ww, th);
      }
    }
    if (any) { ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
  }
}

// A small boat moored on the river: a hull with a sheer, a little cabin, a mast with a
// riding light at night, fenders, and a line ashore. It rides the swell gently.
function brBoat(S, P, x, len, o) {
  o = o || {}; const y = o.y || 0, dir = o.dir || 1, hullC = o.col || '#e2e2dc', cabC = o.cab || '#cfc8b6';
  const hull = S.tone(hullC, P), hullD = S.tone(darken(hullC, 0.3), P), band = S.tone(o.band || '#2f6db5', P), cab = S.tone(cabC, P), glass = S.tone(S.pal.dark > 0.5 ? '#ffd98a' : S.pal.glass, P, S.pal.dark > 0.5), dk = S.tone('#1c1f26', P), rope = S.tone('#8a7a5a', P);
  const night = S.pal.dark > 0.3, mast = o.mast !== false;
  P.add({ x0: x - len / 2 - 1, x1: x + len / 2 + 1, layer: o.layer || 0, draw(ctx, env) {
    if (y + 5 < env.y0 || y - 1 > env.y1) return;
    const s = env.s, bob = Math.sin(env.t * 1.1 + x) * 0.06, rk = Math.sin(env.t * 0.8 + x * 0.3) * 0.015;
    ctx.save(); ctx.translate(x, y + bob); ctx.rotate(rk); ctx.scale(dir, 1);
    const h0 = -0.35, h1 = 0.75, L2 = len / 2;
    poly(ctx, [-L2, h1, L2 + 0.35, h1 + 0.18, L2 - 0.3, h0, -L2 + 0.4, h0], hull);
    R4(ctx, -L2 + 0.2, h0 + 0.05, len - 0.4, 0.14, hullD);
    if (s > 2) R4(ctx, -L2, h1 - 0.16, len + 0.2, 0.1, band);
    R4(ctx, -L2 * 0.3, h1, len * 0.38, 0.75, cab); R4(ctx, -L2 * 0.3 - 0.08, h1 + 0.75, len * 0.38 + 0.16, 0.08, hullD);
    if (s > 2.5) { ctx.fillStyle = glass; ctx.beginPath(); for (let i = 0; i < 3; i++) ctx.rect(-L2 * 0.3 + 0.18 + i * len * 0.115, h1 + 0.3, len * 0.08, 0.3); ctx.fill(); }
    if (mast) { line(ctx, L2 * 0.12, h1 + 0.8, L2 * 0.12, h1 + 2.6, dk, 0.05, env); if (s > 4) line(ctx, L2 * 0.12, h1 + 2.5, L2 + 0.2, h1 + 0.2, dk, 0.015, env); }
    if (s > 4) { ctx.fillStyle = dk; ctx.beginPath(); for (let i = 0; i < 3; i++) { const fx = -L2 + 0.8 + i * (len - 1.6) / 2; ctx.moveTo(fx + 0.12, h1 - 0.35); ctx.ellipse(fx, h1 - 0.35, 0.12, 0.2, 0, 0, TAU); } ctx.fill(); }
    ctx.restore();
    if (s > 2 && o.rope) line(ctx, x - dir * len / 2, y + 0.6 + bob, o.rope[0], o.rope[1], rope, 0.03, env);
    if (mast && night) { const mx = x + dir * len / 2 * 0.12, my = y + bob + 3.4; circ(ctx, mx, my, Math.max(0.08, env.px * 1.2), '#fff3c4'); ydGlow(ctx, mx, my, 0.8, 0.8, '255,230,170', 0.4); }
  } });
}

// A prison van: a cab, and a box with one barred window in the side.
// Seat 0 is the driver, seat 1 is whoever is locked in the back. Drawn as a proper
// vehicle: rounded roof, panel seams, rear doors, a livery band, wheel arches, mud
// flaps and hubs, mirrors and lamps.
CARS.pvan = { len: 6.4, h: 2.6, body: 1.15, cab: [-0.5, 0.5], win: [[0.25, 0.43], [-0.31, -0.13]], seats: [0.34, -0.22], wheel: 0.42,
  draw(ctx, env, S, P, x, y, dir, colHex, st) {
    const c = CARS.pvan, L = c.len, base = colHex || '#3d4b5c', col = S.tone(base, P), dk = S.tone(darken(base, 0.32), P), hiC = S.tone(lighten(base, 0.14), P), seam = S.tone(darken(base, 0.18), P), gl = S.tone(S.pal.glass, P), glHi = S.tone(lighten(S.pal.glass, 0.25), P);
    const white = S.tone('#d9dde2', P), blue = S.tone('#27365a', P), tyre = S.tone('#0e1014', P), hub = S.tone('#8d949a', P), hubD = S.tone('#5a6068', P), black = S.tone('#16181c', P), amber = S.tone('#e8a23a', P, true), s = env.s, by = 0.32, night = S.pal.dark > 0.3;
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    // shadow on the road
    ctx.globalAlpha = 0.35; R4(ctx, -L / 2 - 0.1, -0.06, L + 0.2, 0.1, black); ctx.globalAlpha = 1;
    // the box, with a rounded roof edge, and the cab with its raked front
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-L / 2, by); ctx.lineTo(-L / 2, c.h - 0.2); ctx.quadraticCurveTo(-L / 2, c.h, -L / 2 + 0.2, c.h); ctx.lineTo(L * 0.22 - 0.1, c.h); ctx.quadraticCurveTo(L * 0.22, c.h, L * 0.22, c.h - 0.1); ctx.lineTo(L * 0.22, by); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(L * 0.22, by); ctx.lineTo(L / 2 - 0.1, by); ctx.quadraticCurveTo(L / 2 + 0.05, by + 0.4, L / 2 - 0.05, c.body + 0.1); ctx.lineTo(L * 0.44, c.h - 0.25); ctx.lineTo(L * 0.22, c.h - 0.25); ctx.closePath(); ctx.fill();
    R4(ctx, -L / 2, c.h - 0.16, L * 0.72, 0.16, dk);
    if (s > 3) { R4(ctx, -L / 2 + 0.1, c.h - 0.34, L * 0.72 - 0.2, 0.06, hiC); }
    // livery: a white band with a thin dark line
    R4(ctx, -L / 2, by + 0.75, L * 0.72, 0.2, white); if (s > 4) R4(ctx, -L / 2, by + 0.95, L * 0.72, 0.05, blue);
    // windows: the cab side glass and the barred window in the box
    for (let i = 0; i < 2; i++) { const w0 = c.win[i][0] * L, w1 = c.win[i][1] * L, broken = st && st.glass && st.glass[i]; R4(ctx, w0, c.body + 0.06, w1 - w0, c.h - c.body - 0.2, broken ? S.tone('#0d1016', P) : (i ? S.tone('#10141b', P) : gl)); }
    if (s > 3 && !(st && st.glass && st.glass[0])) { ctx.fillStyle = glHi; ctx.beginPath(); ydShape(ctx, [c.win[0][0] * L + 0.15, c.h - 0.16, c.win[0][0] * L + 0.4, c.h - 0.16, c.win[0][0] * L + 0.2, c.body + 0.08, c.win[0][0] * L + 0.02, c.body + 0.08]); ctx.fill(); }
    // the windscreen on the raked front, and the bumper
    poly(ctx, [L * 0.44 + 0.04, c.h - 0.3, L / 2 - 0.12, c.body + 0.18, L / 2 - 0.02, c.body + 0.12, L * 0.44 + 0.12, c.h - 0.24], gl);
    R4(ctx, -L / 2 - 0.08, by - 0.02, L + 0.12, 0.16, dk);
    if (s > 3.5) { // seams, rear doors and their handle, the cab door, the step and mirror
      const pts = [L * 0.22, by + 0.05, L * 0.22, c.h - 0.2, -L / 2 + 0.05, by + 0.1, -L / 2 + 0.05, c.h - 0.2, -L * 0.1, by + 0.05, -L * 0.1, c.h - 0.18, L * 0.23 + 0.05, by + 0.1, L * 0.23 + 0.05, c.h - 0.3, c.win[0][1] * L + 0.12, by + 0.12, c.win[0][1] * L + 0.12, c.body + 0.04];
      ydLines(ctx, env, pts, seam, 0.025);
      ctx.fillStyle = black; ctx.beginPath(); ctx.rect(-L / 2 + 0.12, by + 0.62, 0.05, 0.22); ctx.rect(c.win[0][0] * L + 0.1, c.body - 0.05, 0.22, 0.05); ctx.rect(L * 0.44 + 0.02, c.h - 0.55, 0.08, 0.32); ctx.rect(L * 0.44 + 0.02, c.h - 0.58, 0.22, 0.06); ctx.rect(L * 0.24, by - 0.12, 0.6, 0.08); ctx.fill();
    }
    // lamps: head and indicator in front, tail at the back, an amber beacon on the roof
    R4(ctx, L / 2 - 0.2, c.body - 0.3, 0.2, 0.18, night ? '#fff3c4' : S.tone('#e8e4d0', P)); R4(ctx, -L / 2, c.body - 0.2, 0.14, 0.16, night ? '#ff4a3d' : S.tone('#a8322a', P));
    if (s > 3) { R4(ctx, L / 2 - 0.16, c.body - 0.47, 0.14, 0.1, amber); R4(ctx, -L * 0.05, c.h, 0.36, 0.12, amber); }
    if (night) { ydGlow(ctx, L / 2, c.body - 0.21, 1.2, 0.8, '255,240,200', 0.5); }
    // wheels: arches, tyres (flattened when shot), hubs with nuts, mud flaps
    const wx = [-L * 0.31, L * 0.31];
    ctx.fillStyle = black; ctx.beginPath(); for (let i = 0; i < 2; i++) { ctx.moveTo(wx[i] + c.wheel + 0.1, by + 0.1); ctx.arc(wx[i], c.wheel, c.wheel + 0.1, 0, Math.PI); } ctx.fill();
    for (let i = 0; i < 2; i++) { const flat = st && st.flat && st.flat[i], ry = c.wheel * (flat ? 0.8 : 1); ctx.fillStyle = tyre; ctx.beginPath(); ctx.ellipse(wx[i], ry, c.wheel + (flat ? 0.06 : 0), ry, 0, 0, TAU); ctx.fill(); circ(ctx, wx[i], ry, c.wheel * 0.45, hub);
      if (s > 6) { circ(ctx, wx[i], ry, c.wheel * 0.2, hubD); ctx.fillStyle = hubD; ctx.beginPath(); for (let j = 0; j < 5; j++) { const an = j * TAU / 5 - (x * dir) / c.wheel; /* rolling forward turns a wheel clockwise */ ctx.moveTo(wx[i] + Math.cos(an) * c.wheel * 0.32 + 0.025, ry + Math.sin(an) * c.wheel * 0.32); ctx.arc(wx[i] + Math.cos(an) * c.wheel * 0.32, ry + Math.sin(an) * c.wheel * 0.32, 0.025, 0, TAU); } ctx.fill(); } }
    if (s > 4) { R4(ctx, wx[0] - c.wheel - 0.2, 0.06, 0.06, 0.38, black); R4(ctx, wx[1] + c.wheel + 0.12, 0.06, 0.06, 0.38, black); }
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

// A police launch: white hull with a sheer, a blue and yellow chequered band, fenders,
// a wheelhouse with three panes, a radar mast with a searchlight and a blue lamp that
// flashes. It throws a bow wave and, under way, a wake. At night the blue lamp and the
// lit wheelhouse shine in the water under her.
CARS.plaunch = { len: 7.6, h: 2.0, body: 0.95, cab: [-0.14, 0.18], win: [[-0.1, 0.14]], seats: [0.02, -0.3], wheel: 0,
  draw(ctx, env, S, P, x, y, dir, colHex, st) {
    const c = CARS.plaunch, L = c.len, hull = S.tone('#e4e8ec', P, true), hullD = S.tone('#b9c0c8', P, true), band = S.tone(colHex || '#27365a', P, true), yel = S.tone('#e8c13a', P, true), dk = S.tone('#1b1e24', P), fend = S.tone('#2a2e36', P), s = env.s, night = S.pal.dark > 0.3, t = env.t;
    const bob = Math.sin(t * 1.3 + x * 0.2) * 0.05, on = Math.sin(t * 9) > 0;
    ctx.save(); ctx.translate(x, y + bob); ctx.scale(dir, 1);
    // water round the hull: a bow wave, and a wake when she is moving
    ctx.fillStyle = 'rgba(230,240,250,0.45)'; ctx.beginPath(); ydShape(ctx, [L / 2 - 0.6, -0.1, L / 2 + 0.6, -0.1, L / 2 + 1.0, -0.22, L / 2 - 0.2, -0.24]); if (st && st.moving) ydShape(ctx, [-L / 2, -0.12, -L / 2 - 3.6, -0.18, -L / 2 - 3.6, -0.3, -L / 2 + 0.4, -0.22]); ctx.fill();
    // the hull: sheer rising to the bow, a dark rubbing strake, the band with its chequers
    ctx.fillStyle = hull; ctx.beginPath(); ctx.moveTo(-L / 2, 0.95); ctx.quadraticCurveTo(0, 0.9, L / 2 + 0.7, 1.12); ctx.lineTo(L / 2 - 0.2, -0.15); ctx.lineTo(-L / 2 + 0.2, -0.15); ctx.closePath(); ctx.fill();
    R4(ctx, -L / 2 + 0.2, -0.15, L - 0.4, 0.22, hullD);
    R4(ctx, -L / 2, 0.5, L + 0.45, 0.2, band);
    if (s > 4) { ctx.fillStyle = yel; ctx.beginPath(); for (let i = 0; i < 12; i++) ctx.rect(-L / 2 + 0.3 + i * 0.6, i % 2 ? 0.5 : 0.6, 0.3, 0.1); ctx.fill(); }
    R4(ctx, -L / 2, 0.88, L + 0.6, 0.08, fend);
    // the wheelhouse: raked front, three panes, a door, a rail round the roof
    poly(ctx, [c.cab[0] * L - 0.2, 0.95, c.cab[1] * L + 0.5, 0.95, c.cab[1] * L + 0.1, 2.0, c.cab[0] * L, 2.0], hull);
    R4(ctx, c.win[0][0] * L, c.body + 0.06, (c.win[0][1] - c.win[0][0]) * L, c.h - c.body - 0.2, st && st.glass && st.glass[0] ? dk : S.tone(night ? '#ffe7b3' : S.pal.glass, P, true));
    if (s > 4) { ydLines(ctx, env, [c.win[0][0] * L + 0.6, c.body + 0.06, c.win[0][0] * L + 0.6, c.h - 0.14, c.win[0][0] * L + 1.2, c.body + 0.06, c.win[0][0] * L + 1.2, c.h - 0.14, c.cab[0] * L - 0.3, 2.15, c.cab[1] * L + 0.2, 2.15, c.cab[0] * L - 0.3, 2.0, c.cab[0] * L - 0.3, 2.15], dk, 0.03); }
    // fenders over the side, the stern rail
    if (s > 3) { ctx.fillStyle = fend; ctx.beginPath(); for (let i = 0; i < 3; i++) { const fx = -L / 2 + 1.0 + i * 2.2; ctx.moveTo(fx + 0.12, 0.62); ctx.ellipse(fx, 0.62, 0.12, 0.22, 0, 0, TAU); } ctx.fill(); ydLines(ctx, env, [-L / 2 + 0.1, 0.95, -L / 2 + 0.1, 1.5, -L / 2 + 0.1, 1.5, c.cab[0] * L - 0.3, 1.5, -L / 2 + 1.2, 0.95, -L / 2 + 1.2, 1.5], dk, 0.03); }
    // the radar mast, the searchlight, the blue lamp
    R4(ctx, -L / 2 - 0.25, 0.3, 0.3, 0.9, dk); line(ctx, 0.3, 2.0, 0.3, 2.7, dk, 0.06, env);
    if (s > 3) { R4(ctx, -0.1, 2.38, 0.8, 0.08, dk); R4(ctx, 0.62, 2.0, 0.22, 0.2, dk); }
    if (on) { circ(ctx, 0.3, 2.78, Math.max(0.13, env.px * 1.5), '#4a9dff'); if (night) ydGlow(ctx, 0.3, 2.78, 2.2, 2.2, '80,160,255', 0.5); }
    else circ(ctx, 0.3, 2.78, Math.max(0.1, env.px), S.tone('#1c3a6a', P));
    ctx.restore();
    if (s > 6) env.text(ctx, 'POLICE', x, y + bob + 0.12, 0.26, band, 'center');
    if (night && s > 1) { // the blue lamp and the lit wheelhouse in the water under her
      ctx.globalCompositeOperation = 'lighter'; ctx.beginPath(); ctx.fillStyle = on ? 'rgba(80,160,255,0.45)' : 'rgba(255,220,150,0.25)';
      const cx = x + dir * (on ? 0.3 : 0.1);
      for (let j = 0; j < 6; j++) { const ww = (on ? 0.4 : 0.9) * (1 - j * 0.1) * (0.6 + 0.4 * Math.sin(t * 2.4 + j * 1.9)); ctx.rect(cx - ww / 2 + Math.sin(t * 1.7 + j) * 0.08, y - 0.35 - j * 0.32, ww, Math.max(0.06, env.px * 1.3)); }
      ctx.fill(); ctx.globalCompositeOperation = 'source-over';
    }
  } };

// A helicopter. It is flown along x by its routine; give it a yFn to climb. A long
// cabin with a rounded nose and side windows, the engine housing on top with its
// exhaust, a tail boom with a fin, a tailplane and a spinning tail rotor, skids on
// cross tubes, and the main rotor as a blur with two blades sweeping through it.
CARS.bheli = { len: 13, h: 3.6, body: 3.6, cab: [-0.5, 0.5], win: [], seats: [], wheel: 0, solid: true,
  draw(ctx, env, S, P, x, y, dir, colHex, st) {
    const base = colHex || '#1d2026', col = S.tone(base, P), hiC = S.tone(lighten(base, 0.16), P), dk = S.tone('#0d0f13', P), gl = S.tone('#6f8ea6', P), glHi = S.tone('#a9c2d4', P), seam = S.tone(lighten(base, 0.08), P), s = env.s, t = env.t, night = S.pal.dark > 0.3;
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); ctx.rotate(st && st.moving ? -0.09 : 0);
    // tail boom, fin and tailplane
    ctx.fillStyle = col; ctx.beginPath(); ydShape(ctx, [-1, 2.2, -7.2, 2.0, -7.2, 1.55, -1, 0.9]); ydShape(ctx, [-7.4, 1.4, -6.2, 1.5, -6.6, 3.4, -7.6, 3.4]); ydShape(ctx, [-5.6, 1.7, -4.6, 1.7, -4.8, 1.85, -5.5, 1.85]); ctx.fill();
    // the cabin: a rounded body, the engine housing on top
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(1.6, 1.5, 3.4, 1.45, 0, 0, TAU); ctx.rect(-0.6, 2.4, 3.0, 0.62); ctx.fill();
    if (s > 2.5) { R4(ctx, -0.2, 2.95, 2.4, 0.12, hiC); ctx.fillStyle = hiC; ctx.beginPath(); ctx.ellipse(1.8, 2.45, 2.8, 0.22, 0, Math.PI, TAU); ctx.fill(); }
    // glass: the big nose screen and two side windows, with a sheen
    ctx.fillStyle = gl; ctx.beginPath(); ctx.ellipse(3.3, 1.75, 1.5, 0.95, 0, -1.2, 1.4); ctx.closePath(); if (s > 2) { ctx.rect(0.7, 1.55, 1.0, 0.75); ctx.rect(-0.6, 1.55, 0.9, 0.7); } ctx.fill();
    if (s > 4) { ctx.fillStyle = glHi; ctx.beginPath(); ydShape(ctx, [3.6, 2.45, 4.0, 2.3, 3.5, 1.6, 3.2, 1.75]); ctx.fill(); }
    if (s > 3.5) { // door seams, a step, the exhaust, panel lines along the boom
      ydLines(ctx, env, [0.55, 0.45, 0.55, 2.35, 1.85, 0.4, 1.85, 2.35, -0.75, 0.6, -0.75, 2.3, -1.6, 2.0, -6.8, 1.88, -2.5, 1.0, -2.5, 2.05, -4.2, 1.2, -4.2, 1.95], seam, 0.03);
      R4(ctx, -0.95, 2.55, 0.5, 0.3, dk); R4(ctx, 0.6, 0.32, 1.2, 0.06, dk);
    }
    // skids and their cross tubes
    ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.1, env.px); ctx.beginPath(); ctx.moveTo(-0.2, 0.05); ctx.lineTo(3.6, 0.05); ctx.quadraticCurveTo(4.1, 0.05, 4.2, 0.35); ctx.moveTo(0.8, 0.05); ctx.lineTo(1.0, 0.7); ctx.moveTo(2.8, 0.05); ctx.lineTo(2.6, 0.7); ctx.stroke();
    // rotor mast and hub; the disc is a faint blur with the two blades sweeping across it
    R4(ctx, 1.4, 2.9, 0.4, 0.55, dk);
    const ph = t * 31, rw = 7.2 * Math.abs(Math.cos(ph)) + 0.6;
    ctx.globalAlpha = 0.16; R4(ctx, 1.6 - 7.6, 3.4, 15.2, 0.16, dk); ctx.globalAlpha = 0.55; R4(ctx, 1.6 - rw, 3.42, rw * 2, 0.12, dk);
    if (s > 3) { const rw2 = 7.2 * Math.abs(Math.sin(ph)) + 0.4; ctx.globalAlpha = 0.3; R4(ctx, 1.6 - rw2, 3.44, rw2 * 2, 0.08, dk); }
    ctx.globalAlpha = 1; R4(ctx, 1.25, 3.38, 0.7, 0.16, dk);
    // tail rotor: a spinning disc
    ctx.fillStyle = 'rgba(13,15,19,0.14)'; ctx.beginPath(); ctx.arc(-7.1, 2.6, 0.95, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(-7.1, 2.6); ctx.rotate(ph * 1.7); R4(ctx, -0.95, -0.06, 1.9, 0.12, 'rgba(13,15,19,0.55)'); ctx.restore(); circ(ctx, -7.1, 2.6, 0.12, dk);
    // lights: a red beacon on top of the fin, a white strobe underneath, red and green at the sides
    if (Math.sin(t * 7) > 0.2) { circ(ctx, -7.3, 3.5, Math.max(0.16, env.px * 1.4), '#ff4034'); if (night) ydGlow(ctx, -7.3, 3.5, 1.4, 1.4, '255,64,52', 0.5); }
    if (Math.sin(t * 7 + 2) > 0.5) { circ(ctx, 1.6, 0.1, Math.max(0.14, env.px * 1.3), '#f4f6ff'); if (night) ydGlow(ctx, 1.6, 0.1, 1.6, 1.6, '240,244,255', 0.5); }
    if (s > 2) { circ(ctx, 4.6, 1.2, Math.max(0.07, env.px), '#ff4034'); circ(ctx, -1.2, 2.25, Math.max(0.07, env.px), '#3aff7a'); }
    ctx.restore();
  } };

// The armoury boat: a fat river launch with a wheelhouse, crates on deck and
// fuel drums at the stern (the right-hand end). Shoot the fuel and she goes
// down. Returns { fuel, deckY, x0, x1 }. Close up: a rising bow with her name,
// portholes, rust weeping from the scuppers, tyres for fenders, a wheelhouse with a
// door and a radar on its mast, a lashed and tarpaulined deck cargo, a life ring,
// and mooring lines to the jetty.
K.armsBoat = function (S, P, x0, o) {
  o = o || {};
  const len = o.len || 16, x1 = x0 + len, dy = o.deckY === undefined ? 1.6 : o.deckY;
  const st = { sunkT: null };
  const fuel = K.thing(S, P, 'tank', x1 - 2.6, dy + 0.75, { id: o.id || 'fuel', blast: o.blast || 8, r: 0.95, onHit(sim) { if (st.sunkT === null) st.sunkT = sim.t; } });
  fuel.draw = function () {}; // drawn with the boat (below) so that it sinks with her
  const drumA = S.tone('#d4443a', P, true), drumB = S.tone('#c23a2e', P, true), drumD = S.tone('#8a241c', P, true), drumHi = S.tone('#ea6a5a', P, true), warn = S.tone('#f4c542', P, true), ink = S.tone('#1c1f26', P);
  const drums = function (ctx, s) {
    for (let i = 0; i < 2; i++) { const bx = fuel.x - 0.55 + i * 1.1; R4(ctx, bx - 0.45, dy, 0.9, 1.3, i ? drumB : drumA); R4(ctx, bx - 0.45, dy + 0.4, 0.9, 0.1, drumD); R4(ctx, bx - 0.45, dy + 0.9, 0.9, 0.1, drumD); if (s > 5) { R4(ctx, bx - 0.36, dy + 0.05, 0.12, 1.2, drumHi); R4(ctx, bx - 0.47, dy + 1.24, 0.94, 0.08, drumD); R4(ctx, bx + 0.12, dy + 1.3, 0.16, 0.06, drumD); } }
    poly(ctx, [fuel.x, dy + 1.05, fuel.x - 0.26, dy + 0.62, fuel.x + 0.26, dy + 0.62], warn);
    if (s > 9) { R4(ctx, fuel.x - 0.02, dy + 0.74, 0.04, 0.16, ink); R4(ctx, fuel.x - 0.02, dy + 0.68, 0.04, 0.04, ink); }
  };
  const hullBase = o.col || '#2f3d4a', hull = S.tone(hullBase, P), hull2 = S.tone('#1c242c', P), hullHi = S.tone(lighten(hullBase, 0.12), P), red = S.tone('#b3312b', P), rust = S.tone('#7a4a2a', P), house = S.tone('#cfc8b6', P), houseD = S.tone('#aaa290', P), wood = S.tone('#8a6a45', P), wood2 = S.tone('#7a5c3c', P), green = S.tone('#5d6b4a', P), tarp = S.tone('#4f5a46', P), tarpD = S.tone('#3d4636', P);
  const lit = S.tone('#ffd98a', P, true), rope = S.tone('#a08a5a', P), tyre = S.tone('#16181c', P), ring = S.tone('#e8603a', P), white = S.tone('#e8e4d6', P), glass = S.tone(S.pal.glass, P);
  P.add({ x0: x0 - 6, x1: x1 + 6, layer: 1, draw(ctx, env) {
    const s = env.s, u = st.sunkT === null ? 0 : clamp((env.t - st.sunkT) / 7, 0, 1), bob = Math.sin(env.t * 0.9) * 0.06 * (1 - u), afloat = st.sunkT === null, night = S.pal.dark > 0.3;
    if (afloat && s > 2.5) { // mooring lines to the jetty, slack and swinging a little
      const sw = Math.sin(env.t * 0.9) * 0.05; ctx.strokeStyle = rope; ctx.lineWidth = Math.max(0.03, env.px * 0.8); ctx.beginPath();
      ctx.moveTo(x0 - 0.8, dy + 0.9 + bob); ctx.quadraticCurveTo(x0 - 1.3, dy + 0.5 + sw, x0 - 1.9, dy + 0.75); ctx.moveTo(x0 + 2, dy + 0.9 + bob); ctx.quadraticCurveTo(x0 + 0.2, dy + 0.3 + sw, x0 - 2.0, dy + 0.75); ctx.stroke();
    }
    ctx.save(); ctx.translate(x1 - 2, dy - 1.4); ctx.rotate(-0.42 * smooth(u * 1.4)); ctx.translate(-(x1 - 2), -(dy - 1.4) + bob - 4.6 * u * u);
    // hull: a bow that rises at the left, the waterline in red below
    ctx.fillStyle = hull; ctx.beginPath(); ctx.moveTo(x0 - 1.4, dy + 0.3); ctx.quadraticCurveTo(x0 + 3, dy - 0.05, x1 + 0.3, dy); ctx.lineTo(x1 - 0.4, dy - 2.1); ctx.lineTo(x0 + 1.2, dy - 2.1); ctx.closePath(); ctx.fill();
    R4(ctx, x0 - 1.2, dy - 0.38, len + 1.4, 0.16, red); poly(ctx, [x0 + 1.2, dy - 2.1, x1 - 0.4, dy - 2.1, x1 - 0.6, dy - 2.6, x0 + 1.5, dy - 2.6], hull2);
    if (s > 3) {
      R4(ctx, x0 - 1.0, dy - 0.05, len + 1.2, 0.12, hull2); R4(ctx, x0 - 0.6, dy - 1.0, len + 0.6, 0.08, hullHi);
      ctx.fillStyle = hull2; ctx.beginPath(); for (let i = 0; i < 5; i++) { const px = x0 + 2.4 + i * 2.6; ctx.moveTo(px + 0.16, dy - 0.62); ctx.arc(px, dy - 0.62, 0.16, 0, TAU); } ctx.fill();
      if (s > 6) { ydStreaks(ctx, x0 + 1.5, x1 - 1.5, dy - 0.08, 1.1, 77, 8, rust, 0.4); if (afloat) env.text(ctx, 'MARGIT', x0 + 0.6, dy - 0.82 + bob, 0.32, white, 'center'); }
    }
    // tyre fenders on the jetty side
    if (s > 3) { ctx.fillStyle = tyre; ctx.beginPath(); for (let i = 0; i < 3; i++) { const fx = x0 + 2.2 + i * 4.6; ctx.moveTo(fx + 0.3, dy - 0.75); ctx.ellipse(fx, dy - 0.75, 0.3, 0.38, 0, 0, TAU); } ctx.fill(); }
    // wheelhouse: walls, roof, two windows, a door, the mast with its radar and lamp
    R4(ctx, x0 + 3.2, dy, 3.6, 2.5, house); R4(ctx, x0 + 3.0, dy + 2.5, 4.0, 0.22, hull2);
    if (s > 3) { R4(ctx, x0 + 6.4, dy, 0.4, 2.5, houseD); R4(ctx, x0 + 3.25, dy + 0.1, 0.25, 1.9, houseD); }
    const win = afloat && night ? lit : glass;
    R4(ctx, x0 + 3.6, dy + 1.2, 1.2, 0.9, win); R4(ctx, x0 + 5.2, dy + 1.2, 1.2, 0.9, win);
    if (s > 4) { ydLines(ctx, env, [x0 + 4.2, dy + 1.2, x0 + 4.2, dy + 2.1, x0 + 5.8, dy + 1.2, x0 + 5.8, dy + 2.1, x0 + 3.0, dy + 2.95, x0 + 7.0, dy + 2.95, x0 + 3.2, dy + 2.72, x0 + 3.2, dy + 2.95, x0 + 6.8, dy + 2.72, x0 + 6.8, dy + 2.95], hull2, 0.035); }
    line(ctx, x0 + 5, dy + 2.7, x0 + 5, dy + 5.6, hull2, 0.1, env); circ(ctx, x0 + 5, dy + 5.7, Math.max(0.14, env.px), afloat ? '#fff3c4' : '#3a3f47');
    if (s > 3) { R4(ctx, x0 + 4.2, dy + 4.6, 1.6, 0.14, hull2); R4(ctx, x0 + 4.9, dy + 4.45, 0.2, 0.18, hull2); }
    if (afloat && night) ydGlow(ctx, x0 + 5, dy + 5.7, 1.0, 1.0, '255,240,200', 0.45);
    if (s > 4) { ctx.strokeStyle = ring; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.arc(x0 + 2.4, dy + 0.75, 0.3, 0, TAU); ctx.stroke(); }
    // crates of "tools", one stack under a lashed tarpaulin, a coil of rope
    R4(ctx, x0 + 8.0, dy, 1.9, 1.1, wood); R4(ctx, x0 + 8.3, dy + 1.1, 1.4, 0.9, wood2); R4(ctx, x0 + 10.2, dy, 1.5, 0.9, green);
    if (s > 3) { ctx.fillStyle = tarp; ctx.beginPath(); ctx.moveTo(x0 + 10.1, dy); ctx.lineTo(x0 + 10.1, dy + 0.95); ctx.quadraticCurveTo(x0 + 10.95, dy + 1.25, x0 + 11.8, dy + 0.95); ctx.lineTo(x0 + 11.8, dy); ctx.closePath(); ctx.fill(); R4(ctx, x0 + 10.1, dy, 1.7, 0.18, tarpD); }
    if (s > 5) {
      ydLines(ctx, env, [x0 + 8.0, dy + 0.55, x0 + 9.9, dy + 0.55, x0 + 8.95, dy, x0 + 8.95, dy + 1.1, x0 + 8.3, dy + 1.55, x0 + 9.7, dy + 1.55, x0 + 10.6, dy, x0 + 10.6, dy + 1.0, x0 + 11.3, dy, x0 + 11.3, dy + 1.0], rope, 0.03);
      ctx.strokeStyle = rope; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.ellipse(x0 + 7.4, dy + 0.1, 0.35, 0.1, 0, 0, TAU); ctx.ellipse(x0 + 7.4, dy + 0.18, 0.3, 0.08, 0, 0, TAU); ctx.stroke();
    }
    if (s > 5 && afloat) env.text(ctx, 'TOOLS', x0 + 8.95, dy + 0.38 + bob, 0.3, S.tone('#2a2420', P), 'center');
    // rails at bow and stern
    line(ctx, x0 - 1.3, dy + 0.3, x0 - 1.3, dy + 1.2, hull2, 0.07, env); line(ctx, x1, dy, x1, dy + 1.0, hull2, 0.07, env); line(ctx, x1 - 5, dy + 1.0, x1, dy + 1.0, hull2, 0.05, env);
    if (s > 4) ydLines(ctx, env, [x0 - 1.3, dy + 1.2, x0 + 3.0, dy + 1.0, x0 + 1, dy + 0.15, x0 + 1, dy + 1.05, x1 - 2.5, dy, x1 - 2.5, dy + 1.0], hull2, 0.035);
    if (afloat) drums(ctx, s);
    ctx.restore();
    if (afloat && night && s > 1.5) { // her lit wheelhouse in the water beside the jetty
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,214,140,0.28)'; ctx.beginPath();
      for (let j = 0; j < 6; j++) { const ww = 2.2 * (1 - j * 0.12) * (0.6 + 0.4 * Math.sin(env.t * 2.1 + j * 1.7)); ctx.rect(x0 + 5 - ww / 2 + Math.sin(env.t * 1.5 + j) * 0.15, dy - 2.75 - j * 0.42, ww, Math.max(0.08, env.px * 1.5)); }
      ctx.fill(); ctx.globalCompositeOperation = 'source-over';
    }
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

// A church tower with an open belfry. state.ring true swings the bell. Coursed stone
// with corner quoins, a buttressed base with a door, a tall lancet window, louvred
// openings each side of the bell chamber, a clock with its hours marked, and a slate
// spire with a cross. The bell hangs from a beam on its yoke, with its clapper and rope.
K.belfry = function (S, P, x, o) {
  o = o || {}; const y = o.y || 0, w = o.w || 9, h = o.h || 34, sc = o.col || '#8f8a80', st = o.state || {}, side = brSide(S);
  const stone = S.tone(sc, P), stoneD = S.tone(darken(sc, 0.15), P), stoneHi = S.tone(lighten(sc, 0.12), P), joint = S.tone(darken(sc, 0.25), P), dark = S.tone('#3a3833', P), deep = S.tone('#24221f', P), roof = S.tone('#3f4a52', P), roofD = S.tone('#323b42', P);
  const bronze = S.tone('#c9a23a', P), bronzeD = S.tone('#8a6a24', P), beam = S.tone('#3a2f1a', P), face = S.tone('#e9e4d6', P), gold = S.tone('#d9b44a', P), louvre = S.tone('#5a554c', P), glass = S.tone(S.pal.dark > 0.5 ? '#1a1f2a' : '#3a4a5a', P), wood = S.tone('#4a3626', P);
  const cx = x + w / 2, oy0 = y + h - 7.5, oy1 = y + h - 2.5;
  P.add({ x0: x - 2.5, x1: x + w + 2.5, layer: 0, draw(ctx, env) {
    if (y + h + 17 < env.y0 || y > env.y1) return;
    const s = env.s;
    // the shaft, its shaded side, two buttresses
    R4(ctx, x, y, w, h, stone); R4(ctx, side > 0 ? x : x + w - 1.0, y, 1.0, h, stoneD);
    poly(ctx, [x - 1.6, y, x, y, x, y + 9, x - 0.4, y + 9], stoneD); poly(ctx, [x + w, y, x + w + 1.6, y, x + w + 0.4, y + 9, x + w, y + 9], stoneD);
    if (s > 2.5) { // courses and quoins
      ctx.fillStyle = joint; ctx.beginPath(); for (let yy = y + 0.6; yy < y + h - 0.3; yy += 0.6) { if (yy > oy0 - 0.1 && yy < oy1 + 0.1) continue; ctx.rect(x, yy, w, 0.04); } ctx.fill();
      ctx.fillStyle = stoneHi; ctx.beginPath(); for (let i = 0; i < h / 1.2 - 1; i++) { const yy = y + i * 1.2, wq = i % 2 ? 0.55 : 0.95; ctx.rect(x, yy + 0.05, wq, 0.55); ctx.rect(x + w - wq, yy + 0.05, wq, 0.55); } ctx.fill();
      R4(ctx, x - 0.3, y + h - 12 - 3.6, w + 0.6, 0.35, stoneHi); R4(ctx, x - 0.3, y + 9, w + 0.6, 0.3, stoneHi);
    }
    // the door and the lancet window above it
    ctx.fillStyle = deep; ctx.beginPath(); ctx.moveTo(cx - 1.1, y); ctx.lineTo(cx - 1.1, y + 2.6); ctx.quadraticCurveTo(cx, y + 3.9, cx + 1.1, y + 2.6); ctx.lineTo(cx + 1.1, y); ctx.closePath(); ctx.fill();
    if (s > 3) { R4(ctx, cx - 0.95, y, 1.9, 2.5, wood); ydLines(ctx, env, [cx, y, cx, y + 2.5, cx - 0.95, y + 1.2, cx + 0.95, y + 1.2], deep, 0.04); }
    ctx.fillStyle = glass; ctx.beginPath(); ctx.moveTo(cx - 0.75, y + 11); ctx.lineTo(cx - 0.75, y + 15.5); ctx.quadraticCurveTo(cx, y + 17, cx + 0.75, y + 15.5); ctx.lineTo(cx + 0.75, y + 11); ctx.closePath(); ctx.fill();
    if (s > 4) ydLines(ctx, env, [cx, y + 11, cx, y + 16.2, cx - 0.75, y + 13.2, cx + 0.75, y + 13.2], stoneD, 0.06);
    // the bell chamber: a deep opening, louvred side openings
    R4(ctx, cx - 1.6, oy0, 3.2, 5, deep); ctx.fillStyle = deep; ctx.beginPath(); ctx.arc(cx, oy1, 1.6, 0, Math.PI); ctx.fill();
    for (const sx of [cx - 3.1, cx + 2.0]) { R4(ctx, sx, oy0 + 0.3, 1.1, 4.0, deep); if (s > 2.5) { ctx.fillStyle = louvre; ctx.beginPath(); for (let yy = oy0 + 0.45; yy < oy0 + 4.2; yy += 0.36) ctx.rect(sx, yy, 1.1, 0.16); ctx.fill(); } }
    // the bell: a beam, its yoke, the bell swinging, the clapper, the rope
    const sw = st.ring ? Math.sin(env.t * 4.6) * 0.5 : 0, top = y + h - 2.6;
    R4(ctx, cx - 1.6, top + 0.05, 3.2, 0.22, beam);
    ctx.save(); ctx.translate(cx, top); ctx.rotate(sw);
    ctx.fillStyle = bronze; ctx.beginPath(); ctx.moveTo(-0.3, 0); ctx.lineTo(0.3, 0); ctx.quadraticCurveTo(0.42, -0.4, 0.55, -1.2); ctx.quadraticCurveTo(0.68, -1.75, 1.0, -2.0); ctx.lineTo(-1.0, -2.0); ctx.quadraticCurveTo(-0.68, -1.75, -0.55, -1.2); ctx.quadraticCurveTo(-0.42, -0.4, -0.3, 0); ctx.closePath(); ctx.fill();
    if (s > 3) { R4(ctx, -1.02, -2.0, 2.04, 0.14, bronzeD); R4(ctx, -0.36, -0.1, 0.72, 0.12, bronzeD); R4(ctx, side > 0 ? 0.1 : -0.35, -1.6, 0.25, 1.3, S.tone('#e0bf5a', P)); R4(ctx, -0.5, 0.0, 1.0, 0.28, beam); }
    ctx.restore();
    const cs = st.ring ? Math.sin(env.t * 4.6 - 0.5) * 0.45 : 0;
    ctx.save(); ctx.translate(cx, top - 0.3); ctx.rotate(cs); R4(ctx, -0.04, -1.9, 0.08, 1.9, beam); circ(ctx, 0, -1.95, 0.16, beam); ctx.restore();
    if (s > 4) line(ctx, cx + 0.9 + sw * 0.6, top - 1.2, cx + 0.9, oy0, S.tone('#9a8a6a', P), 0.03, env);
    // the clock: a face, hour marks, two hands
    circ(ctx, cx, y + h - 12, 2.2, face); if (s > 2) { ctx.strokeStyle = gold; ctx.lineWidth = Math.max(0.08, env.px); ctx.beginPath(); ctx.arc(cx, y + h - 12, 2.2, 0, TAU); ctx.stroke(); }
    if (s > 4) { ctx.fillStyle = dark; ctx.beginPath(); for (let i = 0; i < 12; i++) { const an = (i * TAU) / 12, r0 = i % 3 ? 1.85 : 1.65; ctx.moveTo(cx + Math.cos(an) * 2.0, y + h - 12 + Math.sin(an) * 2.0); ctx.lineTo(cx + Math.cos(an) * r0, y + h - 12 + Math.sin(an) * r0); ctx.lineTo(cx + Math.cos(an + 0.03) * r0, y + h - 12 + Math.sin(an + 0.03) * r0); ctx.closePath(); } ctx.fill(); }
    line(ctx, cx, y + h - 12, cx, y + h - 10.4, dark, 0.14, env); line(ctx, cx, y + h - 12, cx + 1.1, y + h - 12.6, dark, 0.14, env);
    // the spire: slates in courses, a dormer each side, a cross
    poly(ctx, [x - 0.6, y + h, x + w + 0.6, y + h, cx, y + h + 15], roof); poly(ctx, [side > 0 ? x - 0.6 : cx, y + h, side > 0 ? cx : x + w + 0.6, y + h, cx, y + h + 15], roofD);
    if (s > 2.5) { const pts = []; for (let i = 1; i < 12; i++) { const u = i / 12, hw = (w / 2 + 0.6) * (1 - u); pts.push(cx - hw, y + h + 15 * u, cx + hw, y + h + 15 * u); } ydLines(ctx, env, pts, roofD, 0.04); }
    if (s > 2) { ctx.fillStyle = stoneD; ctx.beginPath(); for (const sx of [-1, 1]) ydShape(ctx, [cx + sx * 1.6 - 0.5, y + h + 4, cx + sx * 1.6 + 0.5, y + h + 4, cx + sx * 1.6, y + h + 5.4]); ctx.fill(); }
    R4(ctx, x - 0.8, y + h - 0.3, w + 1.6, 0.6, S.tone('#a8a296', P));
    R4(ctx, cx - 0.08, y + h + 15, 0.16, 1.6, gold); R4(ctx, cx - 0.5, y + h + 16, 1.0, 0.14, gold);
  } });
  P.solid(x, y, w, h - 7.5, 'wall'); P.solid(x, y + h - 2.5, w, 2.5, 'wall');
};

// A row of low warehouses with saw-tooth roofs (left bank dressing): corrugated walls,
// roller doors, glazing on the steep side of each roof tooth, gutters and downpipes,
// rust, painted numbers, and at night lit windows and a lamp over a door.
K.sheds = function (S, P, x0, x1, o) {
  o = o || {}; const y = o.y || 0, h = o.h || 9, R = makeRng(Math.floor(x0 * 3 + 11)), list = []; let x = x0;
  while (x < x1 - 8) { const w = Math.min(x1 - x, R.r(16, 30)); list.push([x, w, h * R.r(0.75, 1.15), R.pick(['#6b5a52', '#5a6068', '#7a6a55', '#4f585c'])]); x += w + 0.6; }
  const night = S.pal.dark > 0.3, litC = S.tone(S.pal.lit, P, true), glass = S.tone(night ? '#1a2230' : '#7f98aa', P), white = S.tone('#d8d2c0', P), rust = S.tone('#7a4a2a', P), iron = S.tone('#2a2e36', P);
  const cols = list.map((b) => ({ c: S.tone(b[3], P), d: S.tone(darken(b[3], 0.3), P), dd: S.tone(darken(b[3], 0.45), P), rib: S.tone(darken(b[3], 0.14), P), hi: S.tone(lighten(b[3], 0.1), P) }));
  P.add({ x0, x1, layer: 0, draw(ctx, env) {
    if (y + h * 1.2 + 3 < env.y0 || y > env.y1) return;
    const s = env.s;
    for (let i = 0; i < list.length; i++) { const b = list[i], C = cols[i]; if (b[0] + b[1] < env.x0 || b[0] > env.x1) continue;
      const bx = b[0], bw = b[1], bh = b[2], n = Math.max(2, Math.floor(bw / 7));
      R4(ctx, bx, y, bw, bh, C.c);
      if (s > 2.5) { ctx.fillStyle = C.rib; ctx.beginPath(); const a0 = Math.max(bx, Math.floor(env.x0 / 0.5) * 0.5), a1 = Math.min(bx + bw, env.x1); for (let xx = a0; xx < a1; xx += s > 6 ? 0.25 : 0.5) ctx.rect(xx, y, 0.06, bh); ctx.fill(); }
      // roof teeth, slate on the long slope, glass on the steep side
      ctx.fillStyle = C.d; ctx.beginPath(); for (let k = 0; k < n; k++) ydShape(ctx, [bx + (k * bw) / n, y + bh, bx + ((k + 1) * bw) / n, y + bh, bx + ((k + 1) * bw) / n, y + bh + 2.6]); ctx.fill();
      if (s > 1.5) { ctx.fillStyle = night && (i % 2) ? litC : glass; ctx.globalAlpha = night && (i % 2) ? 0.55 : 1; ctx.beginPath(); for (let k = 0; k < n; k++) { const xe = bx + ((k + 1) * bw) / n; ydShape(ctx, [xe - 0.5, y + bh + 0.15, xe - 0.08, y + bh + 0.15, xe - 0.08, y + bh + 2.3]); } ctx.fill(); ctx.globalAlpha = 1; }
      // the big door: a roller shutter in its frame
      R4(ctx, bx + bw * 0.3, y, bw * 0.4, bh * 0.5, C.dd);
      if (s > 3) { ctx.fillStyle = C.d; ctx.beginPath(); for (let yy = y + 0.3; yy < y + bh * 0.5; yy += 0.3) ctx.rect(bx + bw * 0.3, yy, bw * 0.4, 0.06); ctx.fill(); R4(ctx, bx + bw * 0.3 - 0.2, y + bh * 0.5, bw * 0.4 + 0.4, 0.3, C.d); }
      if (s > 2) { R4(ctx, bx, y + bh - 0.2, bw, 0.2, C.dd); ctx.fillStyle = iron; ctx.beginPath(); ctx.rect(bx + 0.3, y, 0.12, bh - 0.2); ctx.rect(bx + bw - 0.42, y, 0.12, bh - 0.2); ctx.fill(); }
      if (s > 4) { ydStreaks(ctx, bx + 0.6, bx + bw - 0.6, y + bh - 0.2, bh * 0.4, i * 13 + 5, 6, rust, 0.3); env.text(ctx, String(3 + i * 2), bx + bw * 0.15, y + bh * 0.62, Math.min(1.6, bh * 0.16), white, 'center'); }
      if (night) { for (let k = 0; k < n; k++) if ((k + i) % 3 === 0) R4(ctx, bx + (k + 0.25) * bw / n, y + bh * 0.68, 2.2, 1.0, litC);
        if (i % 2 === 0) { R4(ctx, bx + bw * 0.5 - 0.2, y + bh * 0.5 + 0.35, 0.4, 0.2, iron); circ(ctx, bx + bw * 0.5, y + bh * 0.5 + 0.3, 0.12, '#fff3c4'); ydGlow(ctx, bx + bw * 0.5, y + bh * 0.5 + 0.3, 2.6, 2.0, '255,220,150', 0.3); } }
    }
  } });
  list.forEach((b) => P.solid(b[0], y, b[1], b[2], 'wall'));
};

SCN.bridge = function (o) {
  o = o || {};
  const zb = o.zb || 700, sd = o.seed || 9, D = 20, RD = 13.6, QY = 4, EDGE = 98, TX = 62, TOP = 64;
  const S = makeScene({ time: o.time || 'overcast', weather: o.weather, seed: sd, refZ: o.refZ || zb, exits: o.exits || [-200, 200], bounds: o.bounds || { x0: -108, x1: 108, y0: -6, y1: 76 }, ambience: 'harbour', groundMat: 'hard', sun: o.sun || [60, 50], fog: o.fog });
  const H = { S, zb, D, RD, QY, EDGE, TX, TOP };
  const dark = S.pal.dark > 0.5, dusk = S.pal.dark > 0.3, side = brSide(S);
  S._brWater = []; S._brRefl = [];
  const refl = S._brRefl;

  // ---- far away: hills, the city on both banks, open water between ----
  K.mountains(S, zb + 7000, { seed: 6 + sd, h: 620, col: '#6f7b8a', snowLine: 0.66 });
  const PCl = K.skyline(S, zb + 2100, { seed: 12 + sd, hMin: 40, hMax: 190, x0: -1500, x1: -260, base: 5, ground: false });
  const PCr = K.skyline(S, zb + 2110, { seed: 19 + sd, hMin: 50, hMax: 230, x0: 230, x1: 1500, base: 5, ground: false });
  K.shore(S, PCl, { left: -250, right: 220, qy: 5, col: '#5d6470', glints: true }); K.shore(S, PCr, { left: -250, right: 220, qy: 5, col: '#5d6470', glints: true });
  const PU = H.PU = S.plane(zb + 520, 'upstream');
  K.shore(S, PU, { left: -118, right: 122, qy: QY, col: '#666a70', glints: true, reeds: true });
  // an older stone bridge upstream: arches with their voussoirs, cutwaters, a parapet with
  // a lamp on each pier, and the dark of each arch held in the water under it
  const ob = { c: S.tone('#7c7a78', PU), c2: S.tone('#5f5d5c', PU), hi: S.tone('#8e8c88', PU), arch: S.tone('#4a4948', PU), wat: S.tone(darken(S.pal.water, 0.25), PU), post: S.tone('#2a2e36', PU) };
  PU.add({ x0: -200, x1: 200, layer: 0, draw(ctx, env) {
    if (14 < env.y0 || -6 > env.y1) return;
    const s = env.s;
    if (s > 0.8) { ctx.fillStyle = ob.wat; ctx.beginPath(); for (let x = -84; x <= 84; x += 42) { ctx.moveTo(x - 15, -0.05); ctx.quadraticCurveTo(x, -5.2, x + 15, -0.05); ctx.closePath(); } ctx.fill(); }
    ctx.fillStyle = ob.c; ctx.beginPath(); ctx.rect(-210, 0, 420, 12.2);
    for (let x = -84; x <= 84; x += 42) { ctx.moveTo(x - 17, 0); ctx.quadraticCurveTo(x - 17, 9.6, x, 9.6); ctx.quadraticCurveTo(x + 17, 9.6, x + 17, 0); ctx.closePath(); }
    ctx.fill('evenodd'); R4(ctx, -210, 12.2, 420, 0.7, ob.c2);
    if (s > 1.2) {
      ctx.strokeStyle = ob.hi; ctx.lineWidth = Math.max(0.5, env.px); ctx.beginPath(); for (let x = -84; x <= 84; x += 42) { ctx.moveTo(x - 17.6, 0); ctx.quadraticCurveTo(x - 17.6, 10.2, x, 10.2); ctx.quadraticCurveTo(x + 17.6, 10.2, x + 17.6, 0); } ctx.stroke();
      ctx.fillStyle = ob.c2; ctx.beginPath(); for (let x = -105; x <= 105; x += 42) { ydShape(ctx, [x - 4, 0, x + 4, 0, x + 2.5, 3.6, x - 2.5, 3.6]); ctx.rect(x - 0.4, 12.9, 0.8, 1.2); } ctx.rect(-210, 11.6, 420, 0.25); ctx.fill();
    }
    if (dusk) { ctx.fillStyle = '#ffe2a0'; ctx.beginPath(); for (let x = -105; x <= 105; x += 42) { ctx.moveTo(x + 0.6, 14.4); ctx.arc(x, 14.4, Math.max(0.5, env.px * 1.6), 0, TAU); } ctx.fill(); }
  } });
  if (dusk) for (let x = -105; x <= 105; x += 42) refl.push({ P: PU, x, y: 14.4, w: 2.2 });
  const mkRow = (P, x0, x1, seed, hMin, hMax, base) => { const R = makeRng(seed), bl = []; let x = x0; while (x < x1) { const w = R.r(12, 26), h = R.r(hMin, hMax); const b = { x, w, h, c: S.tone(R.pick(['#6a6f7a', '#75695f', '#5f6670', '#7d7468', '#565c66']), P), win: [] }; if (S.pal.litChance > 0.1) for (let i = 0; i < Math.floor(w / 4); i++) for (let j = 1; j < Math.floor(h / 4); j++) if (R.chance(S.pal.litChance * 0.6)) b.win.push([x + 1.4 + i * 4, base + j * 4 - 1.2]); bl.push(b); x += w + R.r(0, 3); }
    const lit = S.tone(S.pal.lit, P, true), roofC = S.tone('#3a3e46', P), dim = S.tone(darken('#565c66', 0.25), P);
    P.add({ x0, x1, layer: 0, draw(ctx, env) {
      for (let i = 0; i < bl.length; i++) { const b = bl[i]; if (b.x + b.w < env.x0 || b.x > env.x1) continue; R4(ctx, b.x, base, b.w, b.h, b.c); if (i % 3 === 0) poly(ctx, [b.x, base + b.h, b.x + b.w, base + b.h, b.x + b.w / 2, base + b.h + 3], b.c);
        if (env.s > 1) { R4(ctx, b.x, base + b.h - 0.6, b.w, 0.6, roofC); if (i % 3 !== 0) R4(ctx, b.x + b.w * 0.7, base + b.h, 1.0, 1.8, roofC); ctx.fillStyle = dim; ctx.beginPath(); for (let k = 0; k < Math.floor(b.w / 4); k++) for (let j = 1; j < Math.floor(b.h / 4); j++) ctx.rect(b.x + 1.4 + k * 4, base + j * 4 - 1.2, 1.5, 1.8); ctx.fill(); }
        if (env.s > 0.5) { ctx.fillStyle = lit; for (let j = 0; j < b.win.length; j++) ctx.fillRect(b.win[j][0], b.win[j][1], 1.5, 1.8); } } } }); };
  mkRow(PU, -330, -122, 7 + sd, 12, 30, QY); mkRow(PU, 126, 330, 13 + sd, 14, 36, QY);
  // boats moored along the far banks
  brBoat(S, PU, -110, 6, { y: 0.1, dir: 1, col: '#d9dde2', band: '#a8452f' }); brBoat(S, PU, 113, 7, { y: 0.1, dir: -1, col: '#2f3d4a', band: '#c9a23a', cab: '#8a8f96' });

  // ---- the bridge ----
  const cableY = H.cableY = (x) => { const ax = Math.abs(x); if (ax <= TX) return D + 4.2 + (TOP - D - 4.2) * (ax / TX) * (ax / TX); const u = clamp((ax - TX) / (160 - TX), 0, 1); return lerp(TOP, D + 1.5, u) - 7 * Math.sin(Math.PI * u) * 0.6; };
  const steel = o.steel || '#a34a34', steelD = darken(steel, 0.3);
  const drawSide = (P, near) => {
    const c = S.tone(near ? steel : darken(steel, 0.12), P), cD = S.tone(steelD, P), cHi = S.tone(lighten(steel, 0.12), P), rivet = S.tone(darken(steel, 0.45), P), cab = S.tone(near ? '#2a2420' : '#3a3430', P), cabHi = S.tone(near ? '#5a4e46' : '#5e5650', P);
    const stoneC = S.tone('#77726a', P), stoneD = S.tone('#5f5b55', P), stoneHi = S.tone('#8f8a80', P), joint = S.tone('#4f4b46', P), wet = S.tone('#3e3b37', P), weed = S.tone('#2c3a2a', P), salt = S.tone('#a8a296', P);
    P.add({ x0: -180, x1: 180, layer: near ? 2 : 0, draw(ctx, env) {
      if (TOP + 8 < env.y0 || RD - 2 > env.y1) return;
      const s = env.s;
      // main cable (with a lit upper edge close up) and hangers
      const a = Math.max(-160, Math.floor(env.x0 / 4) * 4 - 4), b = Math.min(160, env.x1 + 4);
      ctx.strokeStyle = cab; ctx.lineWidth = Math.max(near ? 0.5 : 0.4, env.px * 1.2); ctx.beginPath();
      for (let x = a; x <= b; x += 4) { if (x === a) ctx.moveTo(x, cableY(x)); else ctx.lineTo(x, cableY(x)); }
      ctx.stroke();
      if (s > 3) { ctx.strokeStyle = cabHi; ctx.lineWidth = Math.max(0.1, env.px * 0.8); ctx.beginPath(); for (let x = a; x <= b; x += 4) { if (x === a) ctx.moveTo(x, cableY(x) + 0.16); else ctx.lineTo(x, cableY(x) + 0.16); } ctx.stroke(); }
      ctx.strokeStyle = cab; ctx.lineWidth = Math.max(0.09, env.px * 0.7); ctx.beginPath();
      for (let x = Math.max(-156, Math.ceil(a / 4) * 4); x <= Math.min(156, b); x += 4) { if (Math.abs(Math.abs(x) - TX) < 3) continue; ctx.moveTo(x, cableY(x)); ctx.lineTo(x, D + 0.2); }
      ctx.stroke();
      if (s > 5) { ctx.fillStyle = cab; ctx.beginPath(); for (let x = Math.max(-156, Math.ceil(a / 4) * 4); x <= Math.min(156, b); x += 4) { if (Math.abs(Math.abs(x) - TX) < 3) continue; const cy = cableY(x); ctx.rect(x - 0.18, cy - 0.3, 0.36, 0.42); } ctx.fill(); }
      // truss around the railway deck: chords, diagonals, posts and gusset plates
      ctx.strokeStyle = c; ctx.lineWidth = Math.max(0.3, env.px); ctx.beginPath();
      ctx.moveTo(-170, D - 0.9); ctx.lineTo(170, D - 0.9); ctx.moveTo(-170, RD - 0.6); ctx.lineTo(170, RD - 0.6); ctx.stroke();
      const t0 = Math.max(-168, Math.floor(env.x0 / 6) * 6 - 6), t1 = Math.min(168, env.x1 + 6);
      if (s > 0.6) { ctx.lineWidth = Math.max(0.2, env.px * 0.8); ctx.beginPath(); for (let x = t0; x < t1; x += 6) { ctx.moveTo(x, RD - 0.6); ctx.lineTo(x + 3, D - 0.9); ctx.lineTo(x + 6, RD - 0.6); } if (s > 3) for (let x = t0; x < t1; x += 6) { ctx.moveTo(x + 3, RD - 0.6); ctx.lineTo(x + 3, D - 0.9); } ctx.stroke(); }
      if (s > 2.5) { ctx.fillStyle = cHi; ctx.beginPath(); ctx.rect(Math.max(-170, env.x0), D - 0.9 + 0.15, Math.min(170, env.x1) - Math.max(-170, env.x0), Math.max(0.06, env.px)); ctx.rect(Math.max(-170, env.x0), RD - 0.6 + 0.15, Math.min(170, env.x1) - Math.max(-170, env.x0), Math.max(0.06, env.px)); ctx.fill(); }
      if (s > 5) { ctx.fillStyle = cD; ctx.beginPath(); for (let x = t0; x < t1; x += 6) { ctx.rect(x - 0.45, RD - 1.0, 0.9, 0.8); ctx.rect(x + 2.55, D - 1.3, 0.9, 0.8); } ctx.fill(); }
      if (s > 12) { ctx.fillStyle = rivet; ctx.beginPath(); for (let x = t0; x < t1; x += 6) for (let q = 0; q < 3; q++) for (let r2 = 0; r2 < 2; r2++) { ctx.rect(x - 0.3 + q * 0.28, RD - 0.85 + r2 * 0.4, 0.06, 0.06); ctx.rect(x + 2.7 + q * 0.28, D - 1.15 + r2 * 0.4, 0.06, 0.06); } ctx.fill(); }
      // railing along the road: top rail, posts, and on the far side a mid rail and (close up)
      // balusters. The near railing stays open, so the wheels of anything on the road are clear.
      ctx.strokeStyle = cD; ctx.lineWidth = Math.max(0.06, env.px * 0.6); ctx.beginPath(); ctx.moveTo(-170, D + 1.05); ctx.lineTo(170, D + 1.05);
      if (env.s > 2.4 && !near) { ctx.moveTo(-170, D + 0.55); ctx.lineTo(170, D + 0.55); }
      if (env.s > 4) { const r0 = Math.max(-170, Math.floor(env.x0 / 2) * 2), r1 = Math.min(170, env.x1); for (let x = r0; x <= r1; x += 2) { ctx.moveTo(x, D); ctx.lineTo(x, D + 1.05); } }
      ctx.stroke();
      if (s > 10 && !near) { ctx.lineWidth = Math.max(0.02, env.px * 0.5); ctx.beginPath(); const r0 = Math.max(-170, Math.floor(env.x0 / 0.25) * 0.25), r1 = Math.min(170, env.x1); for (let x = r0; x <= r1; x += 0.25) { ctx.moveTo(x, D + 0.1); ctx.lineTo(x, D + 0.55); } ctx.stroke(); }
    } });
    // towers: a stone pier in the water, a steel leg above it
    [-TX, TX].forEach((tx) => {
      const lw = (yy) => 2.9 - ((yy - 6) / (TOP + 1 - 6)) * 0.9, bands = [D - 1.4, D + 9, 44, 55];
      P.add({ x0: tx - 12, x1: tx + 12, layer: near ? 2 : 0, draw(ctx, env) {
        if (TOP + 7 < env.y0 || -5 > env.y1) return;
        const s = env.s, t = env.t, sh = -side;
        // the pier: its nose faces downstream, toward us, so one face is lit and one is in shade
        poly(ctx, [tx - 6.5, -1.5, tx + 6.5, -1.5, tx + 5, 6, tx - 5, 6], stoneC); poly(ctx, [tx, -1.5, tx + sh * 6.5, -1.5, tx + sh * 5, 6, tx, 6], stoneD);
        if (s > 1.5) { // tide marks: wet stone, weed at the waterline, a line of salt above
          poly(ctx, [tx - 6.5, -1.5, tx + 6.5, -1.5, tx + 6.18, 0.1, tx - 6.18, 0.1], wet); poly(ctx, [tx - 6.5, -1.5, tx + 6.5, -1.5, tx + 6.3, -0.3, tx - 6.3, -0.3], weed);
          poly(ctx, [tx - 6.0, 1.1, tx + 6.0, 1.1, tx + 5.98, 1.22, tx - 5.98, 1.22], salt);
        }
        if (s > 3) { const pts = [tx, -1.5, tx, 5.4]; for (let yy = 0.6; yy < 5.4; yy += 0.75) { const hw = 6.5 - ((yy + 1.5) / 7.5) * 1.5; pts.push(tx - hw, yy, tx + hw, yy); } ydLines(ctx, env, pts, joint, 0.04); }
        R4(ctx, tx - 5.4, 5.4, 10.8, 0.7, stoneHi); if (s > 3) R4(ctx, tx - 5.4, 5.4, 10.8, 0.12, joint);
        if (near && s > 1.2) { // foam where the current parts round the nose, and the eddies behind
          ctx.fillStyle = 'rgba(235,240,245,0.55)'; ctx.beginPath();
          for (let i = 0; i < 9; i++) { const u = (i / 8) * 2 - 1, fx = tx + u * 6.4, fw = 0.5 + 0.4 * Math.sin(t * 2.3 + i * 1.7); ctx.rect(fx - fw, -0.08 + Math.sin(t * 1.6 + i) * 0.04, fw * 2, Math.max(0.1, env.px * 1.4)); }
          ctx.fill();
          if (s > 2) { ctx.strokeStyle = 'rgba(235,240,245,0.22)'; ctx.lineWidth = Math.max(0.05, env.px * 0.8); ctx.beginPath();
            for (const sx of [-1, 1]) { for (let k = 0; k < 2; k++) { const ph = (t * 0.25 + k / 2) % 1; ctx.moveTo(tx + sx * (6.3 + ph * 0.8), -0.25 - ph * 0.4); ctx.quadraticCurveTo(tx + sx * (7.0 + ph * 1.2), -0.5 - ph * 0.7, tx + sx * (7.6 + ph * 1.8), -0.7 - ph * 1.1); }
              const ex = tx + sx * 7.6, ey = -1.3, ea = t * 1.3 * sx; ctx.moveTo(ex + Math.cos(ea) * 0.6, ey + Math.sin(ea) * 0.16); ctx.ellipse(ex, ey, 0.6, 0.16, 0, ea, ea + 4.2); }
            ctx.stroke(); }
        }
        // the steel leg, its shaded side, the bands that tie it
        poly(ctx, [tx - 2.9, 6, tx + 2.9, 6, tx + 2.0, TOP + 1, tx - 2.0, TOP + 1], c); poly(ctx, [tx + 1.0, 6, tx + 2.9, 6, tx + 2.0, TOP + 1, tx + 0.8, TOP + 1], cD);
        if (s > 2.5) { // cross bracing between the bands, picked out in the shade colour
          const pts = []; const ys = [6, ...bands, TOP];
          for (let i = 0; i < ys.length - 1; i++) { const ya = ys[i] + 1.4, yb = ys[i + 1] - 0.2; if (yb - ya < 2) continue; const wa = lw(ya) - 0.5, wb = lw(yb) - 0.5; pts.push(tx - wa, ya, tx + wb, yb, tx + wa, ya, tx - wb, yb); }
          ctx.globalAlpha = 0.55; ydLines(ctx, env, pts, rivet, 0.13); ctx.globalAlpha = 1;
        }
        if (s > 5 && !near) { // a ladder up the leg (on the far towers only: the near ones are kept
          // clear, because the mirrors and the marksman of one mission hang and lie on them)
          const pts = [tx - 0.2, 6, tx - 0.2, TOP, tx + 0.25, 6, tx + 0.25, TOP]; if (s > 9) for (let yy = Math.max(6.3, env.y0); yy < Math.min(TOP, env.y1); yy += 0.35) pts.push(tx - 0.2, yy, tx + 0.25, yy);
          ydLines(ctx, env, pts, rivet, 0.03);
        }
        if (s > 10) { ctx.fillStyle = rivet; ctx.beginPath(); for (let yy = Math.max(6.2, Math.floor(env.y0 / 0.5) * 0.5); yy < Math.min(TOP, env.y1); yy += 0.5) { const hw = lw(yy) - 0.12; ctx.rect(tx - hw, yy, 0.06, 0.06); ctx.rect(tx + hw - 0.06, yy, 0.06, 0.06); } ctx.fill(); }
        ctx.fillStyle = cD; ctx.beginPath(); for (const yy of bands) ctx.rect(tx - 3.4, yy, 6.8, 1.3); ctx.fill();
        if (s > 3) { ctx.fillStyle = cHi; ctx.beginPath(); for (const yy of bands) ctx.rect(tx - 3.4, yy + 1.18, 6.8, 0.12); ctx.fill(); }
        // the cap, the saddle the cable rides over, the finial and its beacon
        R4(ctx, tx - 3.0, TOP + 1, 6.0, 1.6, cD); poly(ctx, [tx - 2.2, TOP + 2.6, tx + 2.2, TOP + 2.6, tx, TOP + 5.2], c);
        if (s > 3) { ctx.fillStyle = cab; ctx.beginPath(); ctx.moveTo(tx - 1.6, TOP - 0.2); ctx.quadraticCurveTo(tx, TOP + 1.3, tx + 1.6, TOP - 0.2); ctx.closePath(); ctx.fill(); }
        if (Math.sin(t * 2.6 + tx) > 0.1) { circ(ctx, tx, TOP + 5.5, Math.max(0.3, env.px * 1.6), '#ff4a3d'); if (dusk) ydGlow(ctx, tx, TOP + 5.5, 2.2, 2.2, '255,74,61', 0.45); }
      } });
      if (near) { P.solid(tx - 5.4, -1.5, 10.8, 7.5, 'hard'); P.solid(tx - 2.6, 6, 5.2, TOP - 5, 'hard'); }
    });
  };
  const PRf = H.PRf = S.plane(zb + 6, 'bridge far side');
  brProbe(PRf);
  drawSide(PRf, false);
  const PR = H.PR = S.plane(zb, 'bridge');
  K.shore(S, PR, { left: -EDGE - 4, right: EDGE + 4, qy: QY, col: '#5f5d5c' });
  const bd = { c: S.tone('#3a3d44', PR), c2: S.tone('#565a62', PR), st: S.tone(steelD, PR), stone: S.tone('#77726a', PR), stoneD: S.tone('#5c5852', PR), stoneHi: S.tone('#8a857c', PR), joint: S.tone('#4f4b46', PR), mark: S.tone('#d9d2b0', PR), rail: S.tone('#9aa0a8', PR), tie: S.tone('#2a2622', PR), under: S.tone('#24272c', PR) };
  PR.add({ x0: -400, x1: 400, layer: 0, draw(ctx, env) {
    if (D + 5 < env.y0 || QY - 1 > env.y1) return;
    const s = env.s;
    // stone approaches on the banks: coursed, with arches whose rings are picked out
    for (const sg of [-1, 1]) {
      const a = sg > 0 ? EDGE + 4 : -400, w = 400 - EDGE - 4;
      if (a + w < env.x0 || a > env.x1) continue;
      R4(ctx, a, QY, w, D - 0.8 - QY, bd.stone);
      if (s > 2) { ctx.fillStyle = bd.joint; ctx.beginPath(); for (let yy = QY + 0.9; yy < D - 1.2; yy += 0.9) ctx.rect(Math.max(a, env.x0), yy, Math.min(a + w, env.x1) - Math.max(a, env.x0), 0.05); ctx.fill(); }
      ctx.fillStyle = bd.stoneD; ctx.beginPath();
      for (let k = 0; k < 9; k++) { const cx = sg * (EDGE + 16 + k * 22); if (cx + 9 < env.x0 || cx - 9 > env.x1) continue; ctx.moveTo(cx - 7, QY); ctx.lineTo(cx - 7, QY + 6); ctx.arc(cx, QY + 6, 7, Math.PI, 0, true); ctx.lineTo(cx + 7, QY); ctx.closePath(); }
      ctx.fill();
      if (s > 1.5) { ctx.strokeStyle = bd.stoneHi; ctx.lineWidth = Math.max(0.5, env.px); ctx.beginPath(); for (let k = 0; k < 9; k++) { const cx = sg * (EDGE + 16 + k * 22); if (cx + 9 < env.x0 || cx - 9 > env.x1) continue; ctx.moveTo(cx - 7.4, QY + 6); ctx.arc(cx, QY + 6, 7.4, Math.PI, 0, true); } ctx.stroke(); }
      if (s > 4) { const pts = []; for (let k = 0; k < 9; k++) { const cx = sg * (EDGE + 16 + k * 22); if (cx + 9 < env.x0 || cx - 9 > env.x1) continue; for (let q = 1; q < 12; q++) { const an = Math.PI + (q * Math.PI) / 12; pts.push(cx + Math.cos(an) * 7, QY + 6 - Math.sin(an) * 7 * -1, cx + Math.cos(an) * 7.8, QY + 6 - Math.sin(an) * 7.8 * -1); } } ydLines(ctx, env, pts, bd.joint, 0.05); }
      R4(ctx, sg > 0 ? 148 : -160, QY, 12, D + 3 - QY, bd.stone); R4(ctx, sg > 0 ? 147 : -161, D + 3, 14, 1, bd.stoneD);
      if (s > 2) { R4(ctx, sg > 0 ? 147 : -161, D + 3.9, 14, 0.12, bd.stoneHi); R4(ctx, sg > 0 ? 148 : -160, QY, 12, 1.0, bd.stoneD); }
    }
    // the railway floor with its rails, the road deck, the kerb and the lane markings
    R4(ctx, -400, RD - 0.8, 800, 0.5, bd.st);
    if (s > 2.5) { R4(ctx, Math.max(-400, env.x0), RD - 0.34, Math.min(400, env.x1) - Math.max(-400, env.x0), Math.max(0.08, env.px), bd.rail); if (s > 6) { ctx.fillStyle = bd.tie; ctx.beginPath(); for (let x = Math.floor(env.x0 / 0.7) * 0.7; x < env.x1; x += 0.7) ctx.rect(x, RD - 0.42, 0.24, 0.1); ctx.fill(); } }
    R4(ctx, -400, D - 0.8, 800, 0.8, bd.c); R4(ctx, -400, D - 0.12, 800, 0.12, bd.c2);
    if (s > 3) { R4(ctx, Math.max(-400, env.x0), D - 0.8, Math.min(400, env.x1) - Math.max(-400, env.x0), 0.14, bd.under); ctx.fillStyle = bd.under; ctx.beginPath(); for (let x = Math.floor(env.x0 / 24) * 24; x < env.x1; x += 24) ctx.rect(x, D - 0.8, 0.12, 0.7); ctx.fill(); }
    if (s > 1.5) { ctx.fillStyle = bd.mark; const a0 = Math.floor(env.x0 / 8) * 8; for (let x = a0; x < env.x1; x += 8) ctx.fillRect(x, D - 0.07, 3, 0.07); }
  } });
  PR.solid(-400, D - 0.8, 800, 0.8, 'hard'); PR.solid(-400, RD - 0.9, 800, 0.6, 'hard');
  PR.solid(-400, QY, 400 - EDGE - 4, D - 0.8 - QY, 'wall'); PR.solid(EDGE + 4, QY, 400 - EDGE - 4, D - 0.8 - QY, 'wall');
  H.deckLamps = [];
  if (o.deckLamps !== false) [-132, -108, -84, -36, -12, 12, 36, 84, 108, 132].forEach((x, i) => H.deckLamps.push(K.lamp(S, PRf, x, 6.2, 'deck', { id: 'dl' + i, y: D, reach: 11, arm: 0.7 })));
  H.deckLamps.forEach((lp) => refl.push({ P: PRf, ob: lp, w: 0.9 }));
  [-TX, TX].forEach((tx) => refl.push({ P: PRf, x: tx, y: TOP + 5.5, w: 0.9, red: true, on: (t) => Math.sin(t * 2.6 + tx) > 0.1 }));
  // toll booth on the far kerb, with a barrier arm across the lane
  H.barrier = { up: false, x: o.toll === undefined ? 30 : o.toll };
  if (o.toll !== undefined) {
    const bx = o.toll + 1.2;
    S.room('toll', true);
    const top = PRf.open({ x: bx + 0.35, y: D + 1.0, w: 1.9, h: 1.25, room: 'toll', glass: true, blind: 0, deco: 5, tint: '#ffd98a', f: 0, c: 0 });
    PRf.solid(bx, D, 2.6, 2.9, 'wood');
    const tb = { w: S.tone('#d9dde2', PRf), wD: S.tone('#b9bec4', PRf), red: S.tone('#c8372d', PRf), white: S.tone('#f1ede2', PRf), dk: S.tone('#2a2e36', PRf), sign: S.tone('#1c1f26', PRf), amber: S.tone('#e8a23a', PRf, true) };
    PRf.add({ x0: bx - 1, x1: bx + 4, layer: 0, draw(ctx, env) {
      R4(ctx, bx, D, 2.6, 2.7, tb.w); R4(ctx, bx, D, 2.6, 0.95, tb.red);
      if (env.s > 4) { ctx.fillStyle = tb.white; ctx.beginPath(); for (let i = 0; i < 4; i++) ydShape(ctx, [bx + i * 0.7, D, bx + i * 0.7 + 0.35, D, bx + i * 0.7 + 0.75, D + 0.95, bx + i * 0.7 + 0.4, D + 0.95]); ctx.fill(); R4(ctx, bx + 2.3, D, 0.3, 2.7, tb.wD); }
      drawWindowBack(ctx, env, S, PRf, top, S.tone(S.pal.glass, PRf), S.tone(S.pal.inRoom, PRf));
    } });
    PRf.add({ x0: bx - 5, x1: bx + 5, layer: 1, draw(ctx, env) {
      drawWindowFront(ctx, env, S, PRf, top, S.tone('#eef0ea', PRf), true);
      if (env.s > 4) R4(ctx, bx + 0.2, D + 0.95, 2.2, 0.08, tb.dk);
      R4(ctx, bx - 0.4, D + 2.7, 3.4, 0.3, tb.dk); line(ctx, bx + 1.3, D + 3.0, bx + 1.3, D + 5.4, tb.dk, 0.14, env); R4(ctx, bx - 0.5, D + 5.2, 3.6, 1.2, tb.sign); env.text(ctx, 'TOLL', bx + 1.3, D + 5.48, 0.8, S.tone('#f4c542', PRf, true), 'center');
      if (env.s > 3) { R4(ctx, bx + 2.6, D + 3.0, 0.24, 0.22, tb.amber); }
    } });
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
  brProbe(PRn);
  drawSide(PRn, true);

  // ---- right bank: the records office and its row ----
  const PO = H.PO = S.plane(zb - 60, 'office row');
  K.shore(S, PO, { left: -EDGE, right: EDGE, qy: QY, col: '#66625e', pave: true });
  if (o.office !== false) {
    const row = [
      { id: 'chand', x: 100, w: 15, floors: 3, wall: '#8a6a58', shop: { sign: 'CHANDLER', awning: '#2f6b4a' }, antenna: 0.3 },
      { id: 'rec', x: 116.5, w: 26, floors: 5, fh: 3.4, wall: '#8f97a0', trim: '#c9ced3', door: 3, hut: 0.72 },
      { id: 'ten', x: 144, w: 16, floors: 4, wall: '#7d5a4a', tank: 0.3 },
      { id: 'cafe', x: 161.5, w: 18, floors: 3, wall: '#a08a70', shop: { sign: 'CAFE', awning: '#b33a3a', door: true } },
      { id: 'mill', x: 181, w: 22, floors: 6, wall: '#6b6f78', tank: 0.6 },
    ];
    H.b = {};
    row.forEach((bd2, i) => { H.b[bd2.id] = K.building(S, PO, Object.assign({ base: QY, seed: sd * 11 + i * 7 }, bd2, (o.row && o.row[bd2.id]) || {})); });
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
  K.shore(S, PSt, { left: -EDGE, right: EDGE, qy: QY, col: '#6e6a66', steps: [EDGE - 0.1, 1], pave: true });
  brBoat(S, PSt, 90.5, 6.5, { y: 0.1, dir: -1, col: '#e2e2dc', band: '#2f6b4a', rope: [EDGE - 1.6, QY - 0.6] });
  H.stLamps = [];
  if (o.office !== false) [109, 131, 153, 175].forEach((x, i) => H.stLamps.push(K.lamp(S, PSt, x, 5.4, 'street', { id: 'sl' + i, y: QY, reach: 9 })));
  H.stLamps.forEach((lp) => refl.push({ P: PSt, ob: lp, w: 0.8 }));

  // ---- left bank quay: crane, jetty and the armoury boat ----
  const PJ = H.PJ = S.plane(zb - 180, 'quay');
  K.shore(S, PJ, { left: -EDGE + 2, right: EDGE + 6, qy: QY, col: '#5f5b57', pave: true });
  K.sheds(S, PJ, -210, -116, { y: QY, h: 8 });
  K.sheds(S, PJ, 214, 300, { y: QY, h: 9 });
  brBoat(S, PJ, 95, 7, { y: 0.1, dir: 1, col: '#2f3d4a', band: '#c9a23a', cab: '#8a8f96', mast: false });
  // the near right-bank quay is kept low so that it never hides the street behind it
  [[122, 5.5, 1.6, '#6b5440'], [129.5, 2.4, 2.4, '#3f5a52'], [150, 6.1, 2.6, '#7a3a2e'], [171, 3.2, 1.4, '#8a6a45'], [186, 6.1, 2.6, '#4a5560'], [199, 2.0, 1.2, '#6b5440']].forEach((q) => K.box(S, PJ, q[0], QY, q[1], q[2], q[3], { ribs: q[2] > 2 ? 0.42 : 0, mat: 'hard' }));
  const bol = { c: S.tone('#2a2e36', PJ), hi: S.tone('#4a505a', PJ) };
  PJ.add({ x0: 100, x1: 210, layer: 0, draw(ctx, env) { if (QY + 1 < env.y0 || QY > env.y1) return; for (let x = 104; x < 210; x += 9) { R4(ctx, x - 0.2, QY, 0.4, 0.6, bol.c); R4(ctx, x - 0.3, QY + 0.5, 0.6, 0.16, bol.c); if (env.s > 6) R4(ctx, x - 0.14, QY + 0.05, 0.08, 0.45, bol.hi); } } });
  H.rcrane = { x: 112, h: 22 }; K.crane(S, PJ, 112, 22, -15, { y: QY, col: '#c9a23a' });
  if (o.jetty) {
    const jy = 1.6, jx0 = -EDGE + 2, jx1 = -63;
    H.jettyY = jy;
    const jw = { wood: S.tone('#6b5440', PJ), woodD: S.tone('#3f3226', PJ), woodHi: S.tone('#7d6650', PJ), weed: S.tone('#2c3a2a', PJ), rope: S.tone('#a08a5a', PJ) };
    PJ.add({ x0: jx0 - 6, x1: jx1 + 1, layer: 0, draw(ctx, env) {
      if (QY + 1 < env.y0 || -2 > env.y1) return;
      const s = env.s;
      // piles with weed at the waterline, cross bracing, the deck of planks, the ramp
      ctx.fillStyle = jw.woodD; ctx.beginPath(); for (let x = jx0 + 1.5; x < jx1; x += 4) ctx.rect(x - 0.2, -1.2, 0.4, jy + 1.2); ctx.fill();
      if (s > 2) { ctx.fillStyle = jw.weed; ctx.beginPath(); for (let x = jx0 + 1.5; x < jx1; x += 4) ctx.rect(x - 0.22, -0.4, 0.44, 0.5); ctx.fill(); const pts = []; for (let x = jx0 + 1.5; x < jx1 - 4; x += 4) pts.push(x, 0.2, x + 4, jy - 0.4, x + 4, 0.2, x, jy - 0.4); ydLines(ctx, env, pts, jw.woodD, 0.06); }
      R4(ctx, jx0, jy - 0.32, jx1 - jx0, 0.32, jw.wood); R4(ctx, jx0, jy - 0.36, jx1 - jx0, 0.07, jw.woodD);
      if (s > 5) { ctx.fillStyle = jw.woodD; ctx.beginPath(); for (let x = Math.max(jx0, Math.floor(env.x0 / 0.3) * 0.3); x < Math.min(jx1, env.x1); x += 0.3) ctx.rect(x, jy - 0.3, 0.025, 0.28); ctx.fill(); R4(ctx, jx0, jy - 0.06, jx1 - jx0, 0.05, jw.woodHi); }
      poly(ctx, [jx0 - 5, QY, jx0, jy, jx0, jy - 0.3, jx0 - 5, QY - 0.3], jw.wood); // ramp up to the quay
      // mooring posts (one of them by the ramp), each with a turn of rope
      ctx.fillStyle = jw.woodD; ctx.beginPath(); for (let i = 0; i < 3; i++) ctx.rect(jx1 - 1.2 - i * 9, jy, 0.3, 0.75); ctx.rect(-93.55, jy, 0.3, 0.75); ctx.fill();
      if (s > 4) { ctx.fillStyle = jw.rope; ctx.beginPath(); for (let i = 0; i < 3; i++) ctx.rect(jx1 - 1.25 - i * 9, jy + 0.45, 0.4, 0.08); ctx.rect(-93.6, jy + 0.45, 0.4, 0.08); ctx.fill(); }
    } });
    PJ.solid(jx0, jy - 0.36, jx1 - jx0, 0.36, 'wood');
    H.boat = K.armsBoat(S, PJ, -62, { len: 16, deckY: jy, id: 'fuel', blast: o.blast });
    H.jlamp = K.lamp(S, PJ, -82, 5.2, 'jetty', { id: 'jlamp', y: jy, reach: 10 });
    H.blamp = K.lamp(S, PJ, -56, 3.2, 'jetty', { id: 'blamp', y: jy + 2.7, reach: 9, arm: 0 });
    refl.push({ P: PJ, ob: H.jlamp, w: 0.8 }); refl.push({ P: PJ, ob: H.blamp, w: 0.7 });
    H.crane = { x: -106, h: 17 }; K.crane(S, PJ, -106, 17, 20, { y: QY, col: '#c9a23a' });
    // a work lamp under the jib, so the hook and its load can be seen at night
    PJ.add({ x0: -96, x1: -80, layer: 2, draw(ctx, env) { const lx = -88, ly = QY + 16.7; R4(ctx, lx - 0.35, ly - 0.25, 0.7, 0.25, S.tone('#2a2e36', PJ)); circ(ctx, lx, ly - 0.3, 0.16, '#fff3c4');
      if (S.pal.dark > 0.3) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(0, ly, 0, H.jettyY); g.addColorStop(0, 'rgba(255,225,150,' + 0.3 * S.pal.dark + ')'); g.addColorStop(1, 'rgba(255,225,150,0.03)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(lx - 0.3, ly - 0.3); ctx.lineTo(lx + 0.3, ly - 0.3); ctx.lineTo(lx + 4.2, H.jettyY); ctx.lineTo(lx - 4.2, H.jettyY); ctx.closePath(); ctx.fill(); ctx.restore(); } } });
    H.jetty = (x, extra) => Object.assign({ plane: PJ, x, y: jy, zone: 'jetty', behind: false, room: null }, extra || {});
    H.quay = (x, extra) => Object.assign({ plane: PJ, x, y: QY, zone: 'quay', behind: false, room: null }, extra || {});
  }
  // channel markers nearer the shooter: a can and a cone, each with its top mark, a band,
  // a ring of ripples where it sits, and at night a lamp that flashes and shows in the water
  const PNr = H.PNr = S.plane(zb - 330, 'channel');
  K.shore(S, PNr, {});
  const buoyDk = S.tone('#20242b', PNr), buoyW = S.tone('#e8e4d6', PNr), rip = mix(S.tone(S.pal.water, PNr), '#ffffff', 0.25);
  [[-30, '#3f8f4f'], [34, '#c8372d']].forEach((q) => { const c = S.tone(q[1], PNr), cD = S.tone(darken(q[1], 0.3), PNr), red = q[1] === '#c8372d';
    PNr.add({ x0: q[0] - 3, x1: q[0] + 3, layer: 0, draw(ctx, env) {
      if (5 < env.y0 || -1 > env.y1) return;
      const t = env.t, bob = Math.sin(t * 1.1 + q[0]) * 0.12, lean = Math.sin(t * 0.9 + q[0]) * 0.04, s = env.s;
      if (s > 1.5) { ctx.strokeStyle = rip; ctx.lineWidth = Math.max(0.05, env.px); ctx.beginPath(); for (let k = 0; k < 2; k++) { const u = (t * 0.4 + k * 0.5) % 1; ctx.moveTo(q[0] + 1.0 + u * 1.6, -0.05); ctx.ellipse(q[0], -0.05, 1.0 + u * 1.6, 0.12 + u * 0.15, 0, 0, TAU); } ctx.stroke(); }
      ctx.save(); ctx.translate(q[0], bob); ctx.rotate(lean);
      poly(ctx, [-0.9, 0, 0.9, 0, 0.5, 1.5, -0.5, 1.5], c); R4(ctx, -0.9, 0, 1.8, 0.25, cD);
      if (s > 2.5) { R4(ctx, -0.72, 0.65, 1.44, 0.22, buoyW); }
      line(ctx, 0, 1.5, 0, 3.2, buoyDk, 0.08, env);
      if (s > 2) { if (red) R4(ctx, -0.3, 2.6, 0.6, 0.5, c); else poly(ctx, [-0.35, 2.6, 0.35, 2.6, 0, 3.15], c); }
      ctx.restore();
      if (dark && Math.sin(t * 2 + q[0]) > 0.4) { const lx = q[0] + lean * -3.3, ly = 3.3 + bob; circ(ctx, lx, ly, Math.max(0.14, env.px * 1.4), red ? '#ff5a48' : '#5aff8a'); ydGlow(ctx, lx, ly, 1.4, 1.4, red ? '255,90,72' : '90,255,138', 0.45);
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = red ? 'rgba(255,90,72,0.4)' : 'rgba(90,255,138,0.35)'; ctx.beginPath(); for (let j = 0; j < 5; j++) { const ww = 0.5 * (1 - j * 0.12) * (0.6 + 0.4 * Math.sin(t * 2.5 + j * 1.8)); ctx.rect(lx - ww / 2 + Math.sin(t * 1.6 + j) * 0.06, -0.25 - j * 0.35, ww, Math.max(0.06, env.px * 1.3)); } ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    } }); });

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
