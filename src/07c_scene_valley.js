// ---------------------------------------------------------------------------
// The Ashlock valley: August Calloway's lodge, seen from high on the far side.
//
// Shots here are 350 to 700 m and the shooter looks DOWN into the valley, so
// the scene is planned in angles. From the mission's main position the near
// bank, the road, the slope, the lodge, four ranks of pine hills, two ranks of
// peaks and the sky stack up one above the other, each on its own plane at its
// own real distance, so they slide against each other as the scope pans.
//
// Kit pieces added here (all usable by other scenes):
//   K.alpPeaks    jagged snow peaks
//   K.forestHill  a hill covered in rows of pines, with valley mist at its foot
//   K.chalet      the timber lodge (windows are rooms, like K.building)
//   K.highSeat    a hunting tower: an open hide on legs with a stair
//   K.alpWindsock    the plainest wind tell there is
//   K.bigFlag     a flag large enough to read at half a kilometre
//   K.plume       chimney smoke that leans with the wind
//   K.dishMast    a radio dish on a mast (a shootable 'dish')
//   K.logLoad     a bundle of logs on a hook (a K.hang load with its own look)
//   K.farDuck     the rubber duck (K.thing 'duck'), drawn a little larger for long ranges
// Vehicle kinds added to CARS: gondola, chopper, suvbox.
// SCN.valley(o) returns handles H: planes, the lodge, and placement helpers
// H.deck(x), H.yard(x), H.road(x), H.inLodge(floor, column), H.tower.place(dx).
// H.kit is the list of pieces above, for missions that want to add one.
// ---------------------------------------------------------------------------

// One pine outline added to the current path (no fill), so a whole row of
// trees can be painted with a single fill.
function vlyPine(ctx, x, y, h, w) {
  ctx.moveTo(x, y + h);
  ctx.lineTo(x - w * 0.42, y + h * 0.62); ctx.lineTo(x - w * 0.2, y + h * 0.62);
  ctx.lineTo(x - w * 0.72, y + h * 0.33); ctx.lineTo(x - w * 0.36, y + h * 0.33);
  ctx.lineTo(x - w, y); ctx.lineTo(x + w, y);
  ctx.lineTo(x + w * 0.36, y + h * 0.33); ctx.lineTo(x + w * 0.72, y + h * 0.33);
  ctx.lineTo(x + w * 0.2, y + h * 0.62); ctx.lineTo(x + w * 0.42, y + h * 0.62);
  ctx.closePath();
}
// first index in a list sorted by [0] that is not left of x
function vlyFrom(arr, x) { let a = 0, b = arr.length; while (a < b) { const m = (a + b) >> 1; if (arr[m][0] < x) a = m + 1; else b = m; } return a; }

// ---- far snow peaks ---------------------------------------------------------
K.alpPeaks = function (S, z, o) {
  o = o || {};
  const P = S.plane(z, 'peaks'), sd = o.seed || 5, R = makeRng(sd * 13 + 1);
  const base = o.base || 0, top = o.top === undefined ? base + 600 : o.top, Hh = top - base;
  const x0 = o.x0 === undefined ? -z * 0.6 - 300 : o.x0, x1 = o.x1 === undefined ? z * 0.6 + 300 : o.x1;
  const sm = []; let sx = x0 - Hh;
  while (sx < x1 + Hh) { sm.push({ x: sx, h: Hh * R.r(0.5, 1), l: R.r(0.7, 1.35), r: R.r(0.7, 1.35) }); sx += Hh * R.r(0.5, 1.15); }
  const ridge = (x) => {
    let y = Hh * 0.2;
    for (let i = 0; i < sm.length; i++) { const d = x - sm[i].x, v = sm[i].h - Math.abs(d) * (d < 0 ? sm[i].l : sm[i].r); if (v > y) y = v; }
    return base + y + Hh * 0.03 * vnoise(x / (Hh * 0.07), sd) + Hh * 0.015 * vnoise(x / (Hh * 0.021), sd + 9);
  };
  const step = Hh * 0.04, pts = [], sn = [];
  for (let x = x0; x <= x1 + step; x += step) pts.push([x, ridge(x)]);
  const sl = o.snowLine === undefined ? 0.52 : o.snowLine;
  for (let x = x0, i = 0; x <= x1 + step; x += step * 1.5, i++) sn.push([x, base + Hh * (sl + 0.07 * vnoise(x / (Hh * 0.6), sd + 3)) + (i % 2 ? 1 : -1) * Hh * 0.045]);
  // far peaks would vanish into the haze at their true distance, so the haze is capped (unless it is a whiteout)
  const hz = S.fogK > 1.5 || o.haze === undefined ? P.haze : Math.min(P.haze, o.haze), tn = (hex) => mix(mix(hex, S.pal.amb, S.pal.ambT), S.pal.fog, hz);
  const rock = tn(o.col || '#56637a'), snow = tn(o.snowCol || '#f4f7fa'), shade = rgba(tn('#1b2a44'), 0.24);
  P.add({ x0, x1, layer: 0, draw(ctx, env) {
    const i0 = clamp(Math.floor((env.x0 - x0) / step) - 1, 0, pts.length - 2), i1 = clamp(Math.ceil((env.x1 - x0) / step) + 1, i0 + 1, pts.length - 1);
    ctx.beginPath(); ctx.moveTo(pts[i0][0], base - 80);
    for (let i = i0; i <= i1; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[i1][0], base - 80); ctx.closePath();
    ctx.fillStyle = rock; ctx.fill();
    if (o.snow === false) return;
    ctx.save(); ctx.clip();
    const j0 = clamp(vlyFrom(sn, env.x0) - 2, 0, sn.length - 2), j1 = clamp(vlyFrom(sn, env.x1) + 2, j0 + 1, sn.length - 1);
    ctx.beginPath(); ctx.moveTo(sn[j0][0], top + 50);
    for (let j = j0; j <= j1; j++) ctx.lineTo(sn[j][0], sn[j][1]);
    ctx.lineTo(sn[j1][0], top + 50); ctx.closePath(); ctx.fillStyle = snow; ctx.fill();
    // the right-hand face of every summit sits in shadow
    ctx.fillStyle = shade;
    for (let i = 0; i < sm.length; i++) {
      const s = sm[i]; if (s.x + s.h / s.r < env.x0 || s.x > env.x1) continue;
      ctx.beginPath(); ctx.moveTo(s.x, base + s.h + Hh * 0.05); ctx.lineTo(s.x + s.h / s.r, base); ctx.lineTo(s.x + s.h * 0.16, base); ctx.lineTo(s.x + s.h * 0.05, base + s.h * 0.55); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  } });
  return P;
};

// ---- a hill covered in pines --------------------------------------------------
// top/amp set the skyline (it wanders between top - amp and top). Rows of pines
// march down the face; `mist: [yLow, yHigh, alpha]` fades the foot of the hill
// into valley haze so each rank of hills reads as its own layer.
K.forestHill = function (S, z, o) {
  o = o || {};
  const P = S.plane(z, o.name || 'hill');
  const sd = o.seed || 3, top = o.top === undefined ? 40 : o.top, amp = o.amp === undefined ? 20 : o.amp, rough = o.rough || 200;
  const x0 = o.x0 === undefined ? -z * 0.7 - 260 : o.x0, x1 = o.x1 === undefined ? z * 0.7 + 260 : o.x1, step = o.step || Math.max(2.5, z * 0.01);
  const prof = (x) => top - amp * (0.5 - 0.5 * vnoise(x / rough, sd)) + amp * 0.12 * vnoise(x / (rough * 0.23), sd + 5) - (o.dip ? o.dip.d * Math.exp(-Math.pow((x - o.dip.x) / o.dip.w, 2)) : 0);
  const pts = []; for (let x = x0; x <= x1 + step; x += step) pts.push([x, prof(x)]);
  P.heightAt = (x) => { const i = clamp((x - x0) / step, 0, pts.length - 1.001), a = Math.floor(i); return lerp(pts[a][1], pts[a + 1][1], i - a); };
  const snowy = S.time === 'snow';
  const body = S.tone(o.col || '#2c4b3b', P), cap = S.tone('#f1f5f8', P);
  const th = o.th || 12, rows = o.rows === undefined ? 3 : o.rows, tw = o.tw || 0.2, dens = o.density === undefined ? 0.92 : o.density;
  const tx0 = o.tx0 === undefined ? x0 : o.tx0, tx1 = o.tx1 === undefined ? x1 : o.tx1;
  const R = makeRng(sd * 31 + 7), TR = [], cols = [];
  for (let r = 0; r < rows; r++) {
    const arr = []; let x = tx0 + R.r(0, th);
    while (x < tx1) {
      if (R.chance(dens) && !(o.clear && o.clear(x, r))) { const h = th * R.r(0.72, 1.28); arr.push([x, P.heightAt(x) - r * th * (o.rowDrop || 0.52) - R.r(0, th * 0.16) - (r === 0 ? h * 0.1 : 0), o.maxH ? Math.min(h, o.maxH) : h]); }
      x += th * (o.gap || 0.4) * R.r(0.6, 1.5);
    }
    TR.push(arr);
    cols.push(S.tone(r % 2 ? (o.treeCol2 || '#2f5a45') : (o.treeCol || '#24463a'), P));
  }
  const mist = o.mist, mistCol = S.pal.fog, mistDeep = z * 0.11;
  P.add({ x0, x1, layer: o.layer || 0, draw(ctx, env) {
    const i0 = clamp(Math.floor((env.x0 - x0) / step) - 1, 0, pts.length - 2), i1 = clamp(Math.ceil((env.x1 - x0) / step) + 1, i0 + 1, pts.length - 1);
    ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(pts[i0][0], top - amp - 600);
    for (let i = i0; i <= i1; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[i1][0], top - amp - 600); ctx.closePath(); ctx.fill();
    const simple = env.s * th < 5;
    for (let r = 0; r < TR.length; r++) {
      const arr = TR[r]; let n = 0;
      ctx.fillStyle = cols[r]; ctx.beginPath();
      for (let i = vlyFrom(arr, env.x0 - th); i < arr.length && arr[i][0] < env.x1 + th; i++, n++) {
        const t = arr[i];
        if (simple) { ctx.moveTo(t[0], t[1] + t[2]); ctx.lineTo(t[0] - t[2] * tw, t[1]); ctx.lineTo(t[0] + t[2] * tw, t[1]); ctx.closePath(); }
        else vlyPine(ctx, t[0], t[1], t[2], t[2] * tw);
      }
      if (n) ctx.fill();
      if (snowy && n && !simple) {
        ctx.fillStyle = cap; ctx.beginPath();
        for (let i = vlyFrom(arr, env.x0 - th); i < arr.length && arr[i][0] < env.x1 + th; i++) { const t = arr[i], w = t[2] * tw; ctx.moveTo(t[0], t[1] + t[2]); ctx.lineTo(t[0] - w * 0.4, t[1] + t[2] * 0.64); ctx.lineTo(t[0] + w * 0.05, t[1] + t[2] * 0.72); ctx.lineTo(t[0] + w * 0.4, t[1] + t[2] * 0.64); ctx.closePath(); ctx.moveTo(t[0] - w * 0.3, t[1] + t[2] * 0.62); ctx.lineTo(t[0] - w * 0.7, t[1] + t[2] * 0.35); ctx.lineTo(t[0] - w * 0.1, t[1] + t[2] * 0.46); ctx.closePath(); }
        ctx.fill();
      }
    }
    if (mist && env.y1 > mist[0] - mistDeep && env.y0 < mist[1]) {
      // a flat wash below the band (cheap), and the fade itself only across the band
      const xa = env.x0 - 5, w = env.x1 - env.x0 + 10;
      ctx.fillStyle = rgba(mistCol, mist[2]); ctx.fillRect(xa, mist[0] - mistDeep, w, mistDeep);
      const g = ctx.createLinearGradient(0, mist[0], 0, mist[1]);
      g.addColorStop(0, rgba(mistCol, mist[2])); g.addColorStop(1, rgba(mistCol, 0));
      ctx.fillStyle = g; ctx.fillRect(xa, mist[0], w, mist[1] - mist[0]);
    }
  } });
  if (o.ground !== false) { P.groundY = top - amp; P.groundMat = o.mat || S.groundMat; P.groundFn = P.heightAt; }
  return P;
};

// ---- wind tells ----------------------------------------------------------------
K.bigFlag = function (S, P, x, y, h, col, o) {
  o = o || {}; const pole = S.tone('#d5d9dd', P), c = S.tone(col || '#b3312b', P), c2 = S.tone(o.col2 || '#f1ede2', P), len = o.len || 4.6, wid = o.wid || 2.4;
  P.add({ x0: x - len - 1, x1: x + len + 1, layer: o.layer === undefined ? 1 : o.layer, draw(ctx, env) {
    line(ctx, x, y, x, y + h, pole, 0.14, env); circ(ctx, x, y + h + 0.12, 0.2, pole);
    const w = env.wind, a = Math.min(1, Math.abs(w) / 6), dir = w >= 0 ? 1 : -1, topY = y + h - 0.15, n = 9;
    const at = (u, v) => { // u along the flag, v down it
      const droop = (1 - a) * u * u * len * 0.55, fl = Math.sin(env.t * (3.5 + a * 8) - u * 5.5) * 0.24 * (0.25 + a) * u;
      return [x + dir * u * len * (0.22 + 0.78 * a), topY - v * wid * (1 - 0.25 * (1 - a) * u) - droop + fl];
    };
    ctx.beginPath(); ctx.moveTo(x, topY);
    for (let i = 1; i <= n; i++) { const p = at(i / n, 0); ctx.lineTo(p[0], p[1]); }
    for (let i = n; i >= 0; i--) { const p = at(i / n, 1); ctx.lineTo(p[0], p[1]); }
    ctx.closePath(); ctx.fillStyle = c; ctx.fill();
    ctx.strokeStyle = c2; ctx.lineWidth = Math.max(wid * 0.2, env.px);
    ctx.beginPath(); for (let i = 0; i <= n; i++) { const p = at(i / n, 0.5); if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); } ctx.stroke();
  } });
  return { x, y, h };
};
K.alpWindsock = function (S, P, x, y, h, o) {
  o = o || {}; const pole = S.tone('#cfd4d9', P), c1 = S.tone('#f07a22', P), c2 = S.tone('#f6f2ea', P), len = o.len || 3.6;
  P.add({ x0: x - len - 1, x1: x + len + 1, layer: o.layer === undefined ? 1 : o.layer, draw(ctx, env) {
    line(ctx, x, y, x, y + h, pole, 0.12, env);
    const w = env.wind, a = clamp(Math.abs(w) / 6.5, 0.06, 1), dir = w >= 0 ? 1 : -1, ang = (1 - a) * 1.35; // 0 = straight out, 1.35 = hanging
    let px = x, py = y + h - 0.35;
    for (let i = 0; i < 5; i++) {
      const u0 = i / 5, u1 = (i + 1) / 5, fl = Math.sin(env.t * (4 + a * 7) - i * 1.1) * 0.12 * (0.3 + a) * u1;
      const sag = ang + (1 - a) * u1 * 0.15, dx = Math.cos(sag) * len / 5 * dir, dy = -Math.sin(sag) * len / 5 + fl;
      const r0 = 0.52 * (1 - u0 * 0.55), r1 = 0.52 * (1 - u1 * 0.55), nx = -dy, ny = dx, nl = Math.hypot(nx, ny) || 1;
      poly(ctx, [px + nx / nl * r0, py + ny / nl * r0, px + dx + nx / nl * r1, py + dy + ny / nl * r1, px + dx - nx / nl * r1, py + dy - ny / nl * r1, px - nx / nl * r0, py - ny / nl * r0], i % 2 ? c2 : c1);
      px += dx; py += dy;
    }
  } });
  return { x, y, h };
};
K.plume = function (S, P, x, y, o) {
  o = o || {}; const n = o.n || 13, rise = o.rise || 15, lean = o.lean || 2.3;
  const col = S.pal.dark > 0.5 ? '120,130,150' : S.time === 'dawn' ? '250,226,214' : '244,246,248';
  P.add({ x0: x - 60, x1: x + 60, layer: o.layer || 0, draw(ctx, env) {
    for (let i = 0; i < n; i++) {
      const u = ((env.t * 0.11 + i / n) % 1), r = 0.45 + u * 2.6;
      ctx.fillStyle = 'rgba(' + col + ',' + ((1 - u) * (1 - u) * 0.62).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x + env.wind * Math.pow(u, 1.25) * lean + Math.sin(u * 7 + i * 1.7) * 0.45 * u, y + 0.4 + u * rise * (1 - Math.min(0.45, Math.abs(env.wind) * 0.05) * u), Math.max(r, env.px), 0, TAU); ctx.fill();
    }
  } });
};

// ---- the lodge -------------------------------------------------------------------
// A wide chalet seen gable-on: stone ground floor, timber upper floor, a row of
// attic windows under a low wide roof. Returns the same sort of handle as
// K.building: floorY(f), winX(c), win(f, c). Floor 2 is the attic (columns 2 to
// cols - 3 only). `spans` and `wins` work as they do for K.building.
K.chalet = function (S, P, o) {
  const x = o.x, w = o.w || 32, fh = o.fh || 3.4, id = o.id || 'lodge', cols = o.cols || 8, snowy = S.time === 'snow';
  const eave = fh * 2, rise = o.rise || 6.2, ridge = eave + rise, cx = x + w / 2, over = 1.8, door = o.door === undefined ? 3 : o.door;
  const R = makeRng(o.seed || 41);
  const tb = o.timber || '#8a5b36';
  const stone = S.tone('#9a968b', P), stone2 = S.tone('#7f7b72', P), timber = S.tone(tb, P), timber2 = S.tone(darken(tb, 0.22), P), timber3 = S.tone(lighten(tb, 0.12), P);
  const beam = S.tone(darken(tb, 0.42), P), roofC = S.tone(snowy ? '#eef2f6' : (o.roof || '#3d302a'), P), roofE = S.tone('#2a211d', P), frame = S.tone('#efe6cf', P);
  const glass = S.tone(S.pal.glass, P), inRoom = S.tone(S.pal.inRoom, P), shut = S.tone(o.shutter || '#3f6b4f', P), bloom = S.tone('#c8372d', P), doorC = S.tone('#3a2a20', P);
  const B = { id, x, w, fh, P, cols, wins: {}, roofY: eave, ridge, cx, door };
  B.floorY = (f) => f * fh; B.winX = (c) => x + ((c + 0.5) * w) / cols; B.win = (f, c) => B.wins[f + ',' + c]; B.roomId = (f, c) => id + ':' + f + ':' + c;
  const spans = o.spans || {}, over2 = o.wins || {};
  for (let f = 0; f < 3; f++) for (let c = 0; c < cols; c++) {
    if (f === 2 && (c < 2 || c > cols - 3)) continue;
    if (f === 0 && c === door) continue;
    const ov = over2[f + ',' + c] || {}; if (ov.none) continue;
    let room = B.roomId(f, c), lit;
    const sp = spans[f]; if (sp) for (let i = 0; i < sp.length; i++) if (c >= sp[i][0] && c <= sp[i][1]) { room = id + ':' + (sp[i][2] || ('s' + f + '_' + i)); lit = sp[i][3]; }
    if (ov.lit !== undefined) lit = ov.lit;
    if (lit === undefined) lit = S.rooms[room] ? S.rooms[room].lit : R.chance(S.pal.litChance);
    S.room(room, lit);
    const ww = ov.w || (f === 1 ? 2.0 : f === 0 ? 1.5 : 1.3), hh = ov.h || (f === 1 ? 2.25 : f === 0 ? 1.4 : 1.3), sy = ov.sill === undefined ? (f === 1 ? 0.25 : f === 0 ? 1.15 : 0.75) : ov.sill;
    B.wins[f + ',' + c] = P.open({ x: B.winX(c) - ww / 2, y: B.floorY(f) + sy, w: ww, h: hh, room, glass: !ov.open, blind: ov.blind || 0, curtain: ov.curtain, f, c, deco: R.i(0, 5), tint: R.pick(['#ffd98a', '#ffe7b3', '#f7c873', '#ffdca0']), door: f === 1 });
  }
  P.solid(x, 0, w, eave, 'wall', { bid: id });
  P.solid(cx - w * 0.36, eave, w * 0.72, rise * 0.38, 'wall'); P.solid(cx - w * 0.2, eave + rise * 0.38, w * 0.4, rise * 0.34, 'wall'); P.solid(cx - w * 0.07, eave + rise * 0.72, w * 0.14, rise * 0.2, 'wall');
  const blocks = []; for (let i = 0; i < 46; i++) blocks.push([x + R.r(0.3, w - 1.4), R.r(0.2, fh - 0.6), R.r(0.6, 1.3)]);
  P.add({ x0: x - over - 1, x1: x + w + over + 1, layer: 0, draw(ctx, env) {
    R4(ctx, x, 0, w, fh, stone);
    if (env.s > 3) { ctx.fillStyle = stone2; for (let i = 0; i < blocks.length; i++) ctx.fillRect(blocks[i][0], blocks[i][1], blocks[i][2], 0.34); }
    R4(ctx, x, fh, w, fh, timber);
    poly(ctx, [x - 0.2, eave, x + w + 0.2, eave, cx, ridge - 0.25], timber);
    if (env.s > 2.2) { // the logs
      ctx.fillStyle = timber2; for (let yy = fh + 0.42; yy < ridge - 0.6; yy += 0.42) { const half = yy <= eave ? w / 2 : (w / 2) * (1 - (yy - eave) / rise); ctx.fillRect(cx - half, yy, half * 2, Math.max(0.05, env.px * 0.7)); }
    }
    R4(ctx, x - 0.25, fh - 0.18, w + 0.5, 0.36, beam); R4(ctx, x - 0.25, eave - 0.16, w + 0.5, 0.32, beam);
    R4(ctx, x - 0.15, fh, 0.5, fh, beam); R4(ctx, x + w - 0.35, fh, 0.5, fh, beam);
    R4(ctx, x + w - 1.2, 0, 1.2, fh, stone2);
    for (const k in B.wins) { const op = B.wins[k]; if (op.x + op.w < env.x0 || op.x > env.x1) continue; drawWindowBack(ctx, env, S, P, op, glass, inRoom); }
    const dx = B.winX(door); R4(ctx, dx - 1.25, 0, 2.5, 2.75, beam); R4(ctx, dx - 1.05, 0, 2.1, 2.55, doorC); R4(ctx, dx - 0.04, 0, 0.08, 2.55, beam);
  } });
  P.add({ x0: x - over - 1, x1: x + w + over + 1, layer: 1, draw(ctx, env) {
    for (const k in B.wins) {
      const op = B.wins[k]; if (op.x + op.w < env.x0 || op.x > env.x1) continue;
      drawWindowFront(ctx, env, S, P, op, frame, false);
      if (op.f !== 0) { R4(ctx, op.x - 0.5, op.y, 0.42, op.h, shut); R4(ctx, op.x + op.w + 0.08, op.y, 0.42, op.h, shut); }
      if (op.f === 2) { R4(ctx, op.x - 0.1, op.y - 0.3, op.w + 0.2, 0.26, timber2); if (!snowy) for (let i = 0; i < 4; i++) circ(ctx, op.x + 0.15 + i * (op.w - 0.3) / 3, op.y - 0.02, Math.max(0.13, env.px * 0.7), bloom); }
    }
    // the roof: two heavy slabs meeting at the ridge, with a pale fascia
    const ex = x - over, ey = eave - over * (rise / (w / 2));
    poly(ctx, [ex - 0.3, ey, cx, ridge, cx, ridge + 0.85, ex - 0.3, ey + 0.85], roofC);
    poly(ctx, [x + w + over + 0.3, ey, cx, ridge, cx, ridge + 0.85, x + w + over + 0.3, ey + 0.85], roofC);
    poly(ctx, [ex - 0.3, ey, cx, ridge, cx, ridge + 0.26, ex - 0.3, ey + 0.26], roofE);
    poly(ctx, [x + w + over + 0.3, ey, cx, ridge, cx, ridge + 0.26, x + w + over + 0.3, ey + 0.26], roofE);
    if (env.s > 3) { ctx.fillStyle = timber3; ctx.fillRect(cx - 0.12, ridge - 2.6, 0.24, 2.4); ctx.fillRect(cx - 1.3, ridge - 1.75, 2.6, 0.2); }
  } });
  P.solid(cx - w * 0.5 - over, eave - 0.6, 3.2, 1.2, 'wood'); P.solid(cx + w * 0.5 + over - 3.2, eave - 0.6, 3.2, 1.2, 'wood');
  return B;
};

// ---- a hunting tower ---------------------------------------------------------------
// An open hide on legs. Whoever stands in it is seen (and can be hit) from the
// waist up, over the boards. A stair runs up on one side.
K.highSeat = function (S, P, x, o) {
  o = o || {}; const y = o.y || 0, h = o.h || 6.5, w = o.w || 3.6, id = o.id || 'hide', side = o.side || 1, run = o.run || 4.6;
  const wood = S.tone('#7d5d3c', P), dark = S.tone('#4d3929', P), roof = S.tone(S.time === 'snow' ? '#eef2f6' : '#3b4a3b', P), back = S.tone('#cdb992', P), back2 = S.tone('#b29d78', P), fl = y + h;
  S.room(id, false);
  const sx0 = x + side * (w / 2 + 0.2), sx1 = x + side * (w / 2 + 0.2 + run);
  P.add({ x0: x - w - run, x1: x + w + run, layer: 0, draw(ctx, env) {
    line(ctx, x - w / 2 - 0.55, y, x - w / 2 + 0.1, fl, dark, 0.2, env); line(ctx, x + w / 2 + 0.55, y, x + w / 2 - 0.1, fl, dark, 0.2, env);
    line(ctx, x - w / 2 - 0.5, y + h * 0.08, x + w / 2 - 0.2, y + h * 0.5, dark, 0.1, env); line(ctx, x + w / 2 + 0.5, y + h * 0.08, x - w / 2 + 0.2, y + h * 0.5, dark, 0.1, env);
    line(ctx, x - w / 2 - 0.2, y + h * 0.5, x + w / 2 - 0.1, y + h * 0.93, dark, 0.1, env); line(ctx, x + w / 2 + 0.2, y + h * 0.5, x - w / 2 + 0.1, y + h * 0.93, dark, 0.1, env);
    line(ctx, x - w / 2 - 0.3, y + h * 0.5, x + w / 2 + 0.3, y + h * 0.5, dark, 0.12, env);
    // the stair
    line(ctx, sx1, y, sx0, fl - 0.2, wood, 0.2, env); line(ctx, sx1, y + 1, sx0, fl + 0.8, wood, 0.08, env);
    if (env.s > 2.5) for (let i = 1; i < 12; i++) { const u = i / 12, px = lerp(sx1, sx0, u), py = lerp(y, fl - 0.2, u); line(ctx, px - 0.3, py, px + 0.3, py, dark, 0.07, env); }
    // the back wall of the hide: pale weathered boards, so whoever is inside stands out against them
    R4(ctx, x - w / 2, fl + 0.9, w, 1.42, back);
    if (env.s > 3) { ctx.fillStyle = back2; for (let xx = x - w / 2 + 0.6; xx < x + w / 2; xx += 0.6) ctx.fillRect(xx, fl + 0.9, Math.max(0.04, env.px * 0.6), 1.42); }
    line(ctx, x - w / 2, fl, x - w / 2, fl + 2.35, dark, 0.14, env); line(ctx, x + w / 2, fl, x + w / 2, fl + 2.35, dark, 0.14, env);
  } });
  P.add({ x0: x - w, x1: x + w, layer: 1, draw(ctx, env) {
    R4(ctx, x - w / 2 - 0.35, fl - 0.28, w + 0.7, 0.28, dark);
    R4(ctx, x - w / 2, fl, w, 0.95, wood);
    if (env.s > 3) { ctx.fillStyle = dark; for (let xx = x - w / 2 + 0.45; xx < x + w / 2; xx += 0.45) ctx.fillRect(xx, fl, Math.max(0.04, env.px * 0.6), 0.95); }
    R4(ctx, x - w / 2 - 0.1, fl + 0.9, w + 0.2, 0.12, dark);
    poly(ctx, [x - w / 2 - 0.7, fl + 2.3, x + w / 2 + 0.7, fl + 2.3, x + w / 2 + 0.15, fl + 3.15, x - w / 2 - 0.15, fl + 3.15], roof);
    R4(ctx, x - w / 2 - 0.7, fl + 2.22, w + 1.4, 0.12, dark);
  } });
  P.solid(x - w / 2, fl - 0.28, w, 1.23, 'wood');
  P.open({ x: x - w / 2, y: fl + 0.95, w, h: 1.35, room: id, glass: false, through: true });
  return { x, floor: fl, room: id, w, P, stairTop: sx0, stairFoot: sx1, roofY: fl + 3.15,
    place: (dx, extra) => Object.assign({ plane: P, x: x + (dx || 0), y: fl, room: id, zone: id, behind: true }, extra || {}),
    stairY: (xx) => y + h * clamp((sx1 - xx) / (sx1 - sx0), 0, 1) };
};

// ---- a radio dish on a mast ------------------------------------------------------------
K.dishMast = function (S, P, x, y, h, o) {
  o = o || {}; const steel = S.tone('#8f979e', P), dark = S.tone('#2a2e36', P);
  P.add({ x0: x - 2, x1: x + 2, layer: 0, draw(ctx, env) {
    line(ctx, x, y, x, y + h, steel, 0.16, env); line(ctx, x - 1.1, y, x, y + h * 0.55, dark, 0.05, env); line(ctx, x + 1.1, y, x, y + h * 0.55, dark, 0.05, env);
    line(ctx, x, y + h, x, y + h + 1.6, dark, 0.05, env);
  } });
  return K.thing(S, P, 'dish', x + (o.face || -1) * 0.5, y + h - 0.4, Object.assign({ id: o.id || 'dish', r: 0.85,
    drawFn(ctx, env, S2, ob) {
      const live = ob.alive, f = o.face || -1;
      ctx.save(); ctx.translate(ob.x, ob.y); ctx.rotate(live ? f * 0.35 : f * -1.1);
      ctx.fillStyle = S.tone(live ? '#e6eaee' : '#5a5d62', P); ctx.beginPath(); ctx.ellipse(0, 0, 0.42, 0.95, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = S.tone(live ? '#b4bcc4' : '#3a3d42', P); ctx.beginPath(); ctx.ellipse(f * 0.1, 0, 0.26, 0.74, 0, 0, TAU); ctx.fill();
      line(ctx, 0, 0, f * 0.95, 0, dark, 0.06, env); circ(ctx, f * 0.95, 0, 0.11, dark);
      ctx.restore();
      if (live && Math.sin(env.t * 3.2) > 0.2) circ(ctx, x, y + h + 1.6, Math.max(0.1, env.px * 1.1), '#ff3b30');
    } }, o.extra || {}));
};

// ---- a bundle of logs on a hook ----------------------------------------------------------
// Built on K.hang, so shooting the yellow hook block drops it. The load is
// drawn here (the stock loads are crates and pianos).
K.logLoad = function (S, P, x, yHook, o) {
  o = o || {};
  const drop = o.drop === undefined ? 2.0 : o.drop, top = o.top === undefined ? yHook + 8 : o.top;
  const ob = K.hang(S, P, x, yHook, 'logs', { id: o.id || 'logs', floor: o.floor || 0, top, drop, r: o.r || 0.62 });
  const p = ob.prop; p.w = o.w || 6.4; p.h = 1.5; p.y = yHook - drop - p.h;
  p.gone = true; // tells the view not to draw a crate; the logs below stand in for it
  const bark = S.tone('#6a4a30', P), bark2 = S.tone('#553a26', P), cut = S.tone('#d8b889', P), chain = S.tone('#1c1f25', P), yel = S.tone('#f0b21e', P);
  // a hook block big enough to pick out (and to hit) at long range
  ob.draw = (ctx, env) => {
    line(ctx, x, yHook, x, top, chain, 0.09, env);
    if (!ob.alive) return;
    ctx.strokeStyle = chain; ctx.lineWidth = Math.max(0.07, env.px * 0.8);
    ctx.beginPath(); ctx.moveTo(x, yHook - 0.4); ctx.lineTo(p.x - p.w * 0.3, p.y + p.h); ctx.moveTo(x, yHook - 0.4); ctx.lineTo(p.x + p.w * 0.3, p.y + p.h); ctx.stroke();
    R4(ctx, x - 0.55, yHook - 0.5, 1.1, 1.0, yel); R4(ctx, x - 0.55, yHook - 0.5, 1.1, 0.16, chain); R4(ctx, x - 0.55, yHook + 0.34, 1.1, 0.16, chain); circ(ctx, x, yHook, 0.2, chain);
  };
  P.add({ x0: x - p.w, x1: x + p.w, layer: 2, draw(ctx, env) {
    if (p.cleared) return;   // dragged off the road
    const w = p.w, x0 = p.x - w / 2, y0 = p.y, rows = [[0, 0.02, 1], [0.04, 0.5, 0.94], [0.02, 0.98, 0.9]];
    for (let i = 0; i < rows.length; i++) {
      const lx = x0 + rows[i][0] * w + (p.landed ? (i - 1) * 0.5 : 0), ly = y0 + rows[i][1] * (p.landed ? 0.8 : 1), lw = w * rows[i][2];
      R4(ctx, lx, ly, lw, 0.5, i % 2 ? bark2 : bark);
      ctx.fillStyle = cut; ctx.beginPath(); ctx.ellipse(lx + 0.06, ly + 0.25, 0.1, 0.25, 0, 0, TAU); ctx.ellipse(lx + lw - 0.06, ly + 0.25, 0.1, 0.25, 0, 0, TAU); ctx.fill();
    }
    if (!p.landed) { R4(ctx, x0 + w * 0.2, y0 - 0.04, 0.16, p.h + 0.08, chain); R4(ctx, x0 + w * 0.8 - 0.16, y0 - 0.04, 0.16, p.h + 0.08, chain); }
  } });
  ob.logs = p;
  return ob;
};

// The collectible, drawn a little larger so it can still be found at 600 m.
K.farDuck = function (S, P, x, y, k) {
  k = k || 1.5;
  return K.thing(S, P, 'duck', x, y, { r: 0.26 * k, drawFn(ctx, env, S2, ob) {
    if (!ob.alive) return;
    const X = ob.x, Y = ob.y;
    circ(ctx, X, Y, 0.2 * k, '#f7d038'); circ(ctx, X + 0.14 * k, Y + 0.2 * k, 0.13 * k, '#f7d038');
    poly(ctx, [X + 0.24 * k, Y + 0.22 * k, X + 0.4 * k, Y + 0.17 * k, X + 0.24 * k, Y + 0.13 * k], '#f08a24'); circ(ctx, X + 0.17 * k, Y + 0.24 * k, 0.025 * k, '#1b1b1b');
  } });
};

// ---- new vehicles ---------------------------------------------------------------------------
// A cable-car cabin. Passengers stand; they are seen from the knees up through
// three big windows. `y` is the cabin floor: give the vehicle a yFn that
// follows the cable (H.cable.carY).
CARS.gondola = { len: 4.4, h: 2.5, body: 0.4, cab: [-0.5, 0.5], win: [[-0.44, -0.17], [-0.135, 0.135], [0.17, 0.44]], seats: [-0.305, 0, 0.305], wheel: 0, hang: 2.3,
  draw(ctx, env, S, P, x, y, dir, colHex, st) {
    const c = CARS.gondola, L = c.len, col = S.tone(colHex || '#c8372d', P), dk = S.tone(darken(colHex || '#c8372d', 0.35), P), cream = S.tone('#efe6cf', P), steel = S.tone('#2a2e36', P);
    const gl = S.tone(S.pal.dark > 0.5 ? '#f3dc9a' : '#bfd6e4', P, true);
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    // hanger arm and grip on the cable
    line(ctx, 0, c.h, 0.5, c.h + c.hang - 0.3, steel, 0.16, env); R4(ctx, -0.5, c.h + c.hang - 0.42, 1.9, 0.3, steel);
    circ(ctx, -0.25, c.h + c.hang - 0.02, 0.2, steel); circ(ctx, 1.15, c.h + c.hang - 0.02, 0.2, steel);
    // cabin
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-L / 2 + 0.3, 0); ctx.lineTo(L / 2 - 0.3, 0); ctx.quadraticCurveTo(L / 2, 0, L / 2, 0.35); ctx.lineTo(L / 2, c.h - 0.3); ctx.quadraticCurveTo(L / 2, c.h, L / 2 - 0.3, c.h);
    ctx.lineTo(-L / 2 + 0.3, c.h); ctx.quadraticCurveTo(-L / 2, c.h, -L / 2, c.h - 0.3); ctx.lineTo(-L / 2, 0.35); ctx.quadraticCurveTo(-L / 2, 0, -L / 2 + 0.3, 0); ctx.fill();
    R4(ctx, -L / 2 + 0.2, c.h, L - 0.4, 0.16, dk);
    R4(ctx, -L / 2, 0.22, L, 0.14, cream);
    for (let i = 0; i < c.win.length; i++) {
      const w0 = c.win[i][0] * L, w1 = c.win[i][1] * L, broken = st && st.glass && st.glass[i];
      R4(ctx, w0, c.body + 0.06, w1 - w0, c.h - c.body - 0.2, broken ? S.tone('#8fa6b6', P) : gl);
      if (!broken) { ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(w0, c.body + 0.06, (w1 - w0) * 0.22, c.h - c.body - 0.2); }
    }
    ctx.restore();
  } };

// A light helicopter. `st.rotor` (0 to 1) spins the blades. `y` is the bottom
// of the skids, so a yFn can lift it off the pad.
CARS.chopper = { len: 10.4, h: 3.1, body: 1.25, cab: [0.06, 0.46], win: [[0.13, 0.43]], seats: [0.34, 0.2], wheel: 0,
  draw(ctx, env, S, P, x, y, dir, colHex, st) {
    const base = colHex || '#e4e0d4', col = S.tone(base, P), dk = S.tone(darken(base, 0.3), P), steel = S.tone('#20242b', P), stripe = S.tone((st && st.stripe) || '#b3312b', P);
    const gl = S.tone('#bfd6e4', P, true), spin = (st && st.rotor) || 0, t = env.t;
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    // skids
    line(ctx, -0.6, 0.06, 3.9, 0.06, steel, 0.12, env); line(ctx, 0.3, 0.06, 0.6, 0.95, steel, 0.09, env); line(ctx, 2.9, 0.06, 2.7, 0.95, steel, 0.09, env);
    // tail boom and fin
    poly(ctx, [0.6, 1.9, -4.9, 2.25, -4.9, 2.55, 0.6, 2.75], col);
    poly(ctx, [-4.5, 2.3, -5.2, 3.6, -4.75, 3.6, -3.9, 2.4], col); poly(ctx, [-4.6, 2.3, -5.0, 1.45, -4.6, 1.45, -4.2, 2.3], dk);
    // body: a teardrop with a glass nose
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-0.3, 0.9); ctx.quadraticCurveTo(-0.6, 2.9, 1.2, 3.02); ctx.lineTo(3.3, 3.02); ctx.quadraticCurveTo(5.0, 2.7, 5.15, 1.7); ctx.quadraticCurveTo(5.1, 0.8, 3.6, 0.75); ctx.closePath(); ctx.fill();
    R4(ctx, -0.2, 1.55, 5.2, 0.16, stripe);
    const broken = st && st.glass && st.glass[0];
    ctx.fillStyle = broken ? S.tone('#8fa6b6', P) : gl; ctx.beginPath(); ctx.moveTo(1.35, 1.31); ctx.lineTo(4.47, 1.31); ctx.quadraticCurveTo(4.6, 2.5, 3.5, 2.96); ctx.lineTo(1.35, 2.96); ctx.closePath(); ctx.fill();
    R4(ctx, 2.75, 1.31, 0.09, 1.65, dk);
    // rotor mast and blades
    R4(ctx, 1.9, 3.0, 0.5, 0.45, steel);
    if (spin > 0.25) {
      ctx.fillStyle = 'rgba(20,24,30,' + (0.2 + 0.1 * Math.sin(t * 31)).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(2.15, 3.52, 5.6, 0.16, 0, 0, TAU); ctx.fill();
      const a = Math.abs(Math.cos(t * (9 + 22 * spin))); line(ctx, 2.15 - 5.6 * a, 3.52, 2.15 + 5.6 * a, 3.52, steel, 0.07, env);
      ctx.fillStyle = 'rgba(20,24,30,0.3)'; ctx.beginPath(); ctx.arc(-4.95, 2.75, 0.85, 0, TAU); ctx.fill();
    } else {
      const a = spin > 0 ? Math.cos(t * 9 * spin * 4) : 0.92; line(ctx, 2.15 - 5.6 * a, 3.5 - (spin > 0 ? 0 : 0.22), 2.15 + 5.6 * a, 3.52, steel, 0.11, env);
      line(ctx, -4.95, 1.95, -4.95, 3.55, steel, 0.08, env);
    }
    ctx.restore();
  } };

// An SUV with a bright box on the roof, so one car in a convoy can be told
// from another at long range.
CARS.suvbox = Object.assign({}, CARS.suv, {
  draw(ctx, env, S, P, x, y, dir, colHex, st) {
    const c = CARS.suv;
    drawCar(ctx, env, S, P, 'suv', x, y, dir, colHex, st);
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    const bc = S.tone((st && st.boxCol) || '#e8761e', P), rail = S.tone('#14161a', P);
    R4(ctx, -1.75, c.h, 0.1, 0.2, rail); R4(ctx, 0.35, c.h, 0.1, 0.2, rail);
    ctx.fillStyle = bc; ctx.beginPath(); ctx.moveTo(-2.0, c.h + 0.18); ctx.lineTo(0.75, c.h + 0.18); ctx.quadraticCurveTo(1.0, c.h + 0.3, 0.6, c.h + 0.62); ctx.lineTo(-1.8, c.h + 0.62); ctx.quadraticCurveTo(-2.1, c.h + 0.5, -2.0, c.h + 0.18); ctx.fill();
    ctx.restore();
  } });

// The valley is built from the pieces above through this private list, so it
// keeps working even if a later scene file reuses one of the K names.
const VLY = { peaks: K.alpPeaks, hill: K.forestHill, flag: K.bigFlag, sock: K.alpWindsock, plume: K.plume, chalet: K.chalet, seat: K.highSeat, dish: K.dishMast, logs: K.logLoad, duck: K.farDuck };

// ---- the valley -------------------------------------------------------------------------------
// o.z      distance to the plane the mission is about
// o.focus  which plane that is: 'deck' (default), 'road' or 'cable'
// o.eye    height of the main shooting position above the lodge yard
// o.time   'day' | 'dawn' | 'snow'      o.weather  defaults to snow for 'snow'
// o.top    upper edge of the scope's travel (metres, on the mission plane)
SCN.valley = function (o) {
  o = o || {};
  const time = o.time || 'day', snowy = time === 'snow', sd = o.seed || 3;
  const E = o.eye === undefined ? 45 : o.eye, focus = o.focus || 'deck', zR = o.z || 450;
  const zD = focus === 'road' ? zR + 70 : focus === 'cable' ? zR - 45 : zR;
  const roadY = -12, bankY = -16.5, deckY = 3.4;
  const lay = (th, z) => E + th * z;                       // height that sits at angle th on a plane at z
  const onRef = (y, z) => E + (y - E) * (zR / z);          // the same line of sight, read on the mission plane
  const span = (o.span || 94) * (zR / zD);
  // the backdrop, as angles above the pines behind the lodge
  const a1 = (24 - E) / (zD + 62), a2 = a1 + 0.022, a3 = a2 + 0.019, a4 = a3 + 0.017, a5 = a4 + 0.027, a6 = a5 + 0.024;
  const zH2 = zD + 270, zH3 = zD + 760, zH4 = zD + 1750, zP1 = zD + 3700, zP2 = zD + 7600;
  const S = makeScene({ time, weather: o.weather || (snowy ? 'snow' : 'clear'), seed: sd, refZ: zR, fog: o.fog, exits: [-112, 112], sun: o.sun || (time === 'dawn' ? [-58, (a6 + 0.016) * 1000] : [58, (a6 + 0.05) * 1000]),
    bounds: { x0: -span, x1: span, y0: onRef(bankY, zD - 95) - 0.02 * zR, y1: o.top === undefined ? lay(a6 + 0.03, zR) : o.top }, ambience: snowy ? 'snow' : 'wild', groundMat: snowy ? 'snow' : 'dirt' });
  const H = { S, z: zR, zD, eye: E, deckY, roadY, kit: VLY };
  const meadow = snowy ? '#e9eef3' : time === 'dawn' ? '#6f8f5a' : '#7fa860';

  // ---- peaks and hills, far to near ----
  VLY.peaks(S, zP2, { seed: sd + 11, base: lay(a4 - 0.05, zP2), top: lay(a6, zP2), col: '#6c7a96', snowLine: 0.42, haze: 0.62 });
  VLY.peaks(S, zP1, { seed: sd + 5, base: lay(a3 - 0.05, zP1), top: lay(a5, zP1), col: '#4b5870', snowLine: 0.58, haze: 0.46 });
  VLY.hill(S, zH4, { seed: sd + 23, top: lay(a4, zH4), amp: 0.02 * zH4, rough: 620, th: 20, rows: 2, gap: 0.5, rowDrop: 0.7, col: '#3d6a68', treeCol: '#3a6664', treeCol2: '#44736f', dip: { x: 60, w: 480, d: 0.011 * zH4 }, mist: [lay(a3 - 0.002, zH4), lay(a3 + 0.012, zH4), 0.7] });
  VLY.hill(S, zH3, { seed: sd + 17, top: lay(a3, zH3), amp: 0.022 * zH3, rough: 360, th: 17, rows: 2, gap: 0.46, rowDrop: 0.7, col: '#315a52', treeCol: '#2d554d', treeCol2: '#376358', dip: { x: -80, w: 260, d: 0.012 * zH3 }, mist: [lay(a2 - 0.002, zH3), lay(a2 + 0.012, zH3), 0.62] });
  VLY.hill(S, zH2, { seed: sd + 9, top: lay(a2, zH2), amp: 0.024 * zH2, rough: 230, th: 15, rows: 3, gap: 0.42, rowDrop: 0.6, col: '#274a3e', treeCol: '#234539', treeCol2: '#2c5443', dip: { x: 40, w: 170, d: 0.012 * zH2 }, mist: [lay(a1 - 0.004, zH2), lay(a1 + 0.012, zH2), 0.5] });
  // the rise right behind the lodge: the cable car runs up over it
  const PH1 = VLY.hill(S, zD + 62, { name: 'rise', seed: sd + 3, top: 11, amp: 7, rough: 90, th: 12.5, rows: 3, gap: 0.4, col: '#1f3b32', treeCol: '#1b362d', treeCol2: '#25493a', clear: (x, r) => r > 0 && Math.abs(((x + 300) % 60) - 30) > 27.5 });
  H.PH1 = PH1;

  // ---- the cable car line ----
  const PC = S.plane(zD + 45, 'cable'); H.PC = PC;
  PC.groundY = 1; PC.groundMat = S.groundMat;
  {
    const xa = -118, ya = 12, xb = 118, yb = 50, yAt = (x) => lerp(ya, yb, (x - xa) / (xb - xa)), pyl = o.pylons || [-60, 0, 60];
    const steel = S.tone('#5d6670', PC), rope = S.tone('#1a1c20', PC), dk = S.tone('#2f353d', PC);
    PC.add({ x0: xa, x1: xb, layer: 0, draw(ctx, env) {
      for (let i = 0; i < pyl.length; i++) {
        const px = pyl[i], ty = yAt(px) + 0.5, g = 1; if (px + 4 < env.x0 || px - 4 > env.x1) continue;
        line(ctx, px - 2.1, g, px - 0.45, ty, steel, 0.28, env); line(ctx, px + 2.1, g, px + 0.45, ty, steel, 0.28, env);
        if (env.s > 1.6) { ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.1, env.px * 0.7); ctx.beginPath(); const n = Math.max(4, Math.round((ty - g) / 3.2)); for (let k = 0; k < n; k++) { const u0 = k / n, u1 = (k + 1) / n, w0 = lerp(2.1, 0.45, u0), w1 = lerp(2.1, 0.45, u1); ctx.moveTo(px - w0, lerp(g, ty, u0)); ctx.lineTo(px + w1, lerp(g, ty, u1)); ctx.moveTo(px + w0, lerp(g, ty, u0)); ctx.lineTo(px - w1, lerp(g, ty, u1)); } ctx.stroke(); }
        R4(ctx, px - 2.6, ty - 0.2, 5.2, 0.5, dk); circ(ctx, px - 1.9, ty + 0.25, 0.42, dk); circ(ctx, px + 1.9, ty + 0.25, 0.42, dk);
      }
      ctx.strokeStyle = rope; ctx.lineWidth = Math.max(0.09, env.px * 0.9); ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke();
      ctx.lineWidth = Math.max(0.05, env.px * 0.6); ctx.beginPath(); ctx.moveTo(xa, ya + 0.75); ctx.lineTo(xb, yb + 0.75); ctx.stroke();
    } });
    H.cable = { yAt, carY: (x) => yAt(x) - CARS.gondola.h - CARS.gondola.hang, pylons: pyl, xa, xb };
  }

  // ---- big pines beside the lodge, and the lodge itself ----
  const PT = S.plane(zD + 16, 'trees'); H.PT = PT; PT.groundY = 0; PT.groundMat = S.groundMat;
  (o.pines || [[-50, 19], [-56.5, 24], [-73, 21], [-80, 26], [-88, 20], [6, 17], [68, 23], [75, 18], [84, 25], [91, 20]]).forEach((t) => K.pine(S, PT, t[0], t[1], { snow: snowy, col: '#1f3d33' }));
  const PL = S.plane(zD + 6, 'lodge'); H.PL = PL; PL.groundY = 0; PL.groundMat = S.groundMat;
  const B = VLY.chalet(S, PL, Object.assign({ x: -34, w: 32, id: 'lodge', seed: sd * 7 + 2 }, o.lodge || {})); H.lodge = B;
  { // stone chimney on the right-hand slope of the roof
    const cxx = B.cx + 8.5, cy0 = B.ridge - 8.5 * (6.2 / 16) - 0.4, st = S.tone('#8d8a80', PL), st2 = S.tone('#6f6c64', PL);
    PL.add({ x0: cxx - 2, x1: cxx + 2, layer: 1, draw(ctx) { R4(ctx, cxx - 0.85, cy0, 1.7, 3.6, st); R4(ctx, cxx + 0.35, cy0, 0.5, 3.6, st2); R4(ctx, cxx - 1.05, cy0 + 3.4, 2.1, 0.4, st2); if (snowy) R4(ctx, cxx - 1.05, cy0 + 3.8, 2.1, 0.22, S.tone('#f1f5f8', PL)); } });
    PL.solid(cxx - 0.85, cy0, 1.7, 3.8, 'hard');
    if (o.smoke !== false) VLY.plume(S, PL, cxx, cy0 + 3.9, { layer: 1 });
    H.chimney = { x: cxx, y: cy0 + 3.8 };
  }

  // ---- the yard and the deck (the main plane) ----
  const PD = S.plane(zD, 'deck'); H.PD = PD;
  K.ground(S, PD, { col: meadow, edge: snowy ? '#ffffff' : '#9cc078' });
  const dx0 = -36.5, dx1 = 7.5, stairW = 6.2; H.deckX0 = dx0; H.deckX1 = dx1;
  {
    const wood = S.tone('#7a5234', PD), wood2 = S.tone('#5a3c26', PD), rail = S.tone('#3e2b1d', PD), pathC = S.tone(snowy ? '#d5dde5' : '#b9b09a', PD), tuft = S.tone(snowy ? '#cfd8e0' : darken(meadow, 0.14), PD);
    const TU = []; const R = makeRng(sd * 5 + 3); for (let i = 0; i < 90; i++) TU.push([R.r(-140, 140), R.r(-9, -0.6), R.r(0.6, 2.2)]);
    PD.add({ x0: -4000, x1: 4000, layer: 0, draw(ctx, env) { // a path along the lodge front, and some texture on the meadow
      R4(ctx, -44, -1.5, 112, 0.95, pathC);
      ctx.fillStyle = tuft; for (let i = 0; i < TU.length; i++) { const t = TU[i]; if (t[0] < env.x0 - 3 || t[0] > env.x1 + 3) continue; ctx.fillRect(t[0], t[1], t[2], Math.max(0.1, env.px * 0.8)); }
    } });
    PD.add({ x0: dx0 - 1, x1: dx1 + stairW + 1, layer: 0, draw(ctx, env) {
      for (let px = dx0 + 0.6; px <= dx1 - 0.3; px += 6.1) { R4(ctx, px - 0.16, 0, 0.32, deckY - 0.3, wood2); line(ctx, px, deckY - 1.5, px + 1.2, deckY - 0.32, wood2, 0.12, env); line(ctx, px, deckY - 1.5, px - 1.2, deckY - 0.32, wood2, 0.12, env); }
      R4(ctx, dx0, deckY - 0.34, dx1 - dx0, 0.34, wood); R4(ctx, dx0, deckY - 0.34, dx1 - dx0, 0.09, wood2);
      // the stair down to the yard
      const n = 9; for (let i = 0; i < n; i++) R4(ctx, dx1 + (i * stairW) / n, 0, stairW / n + 0.02, deckY * (1 - (i + 1) / n) + 0.02, i % 2 ? wood : wood2);
    } });
    PD.add({ x0: dx0 - 1, x1: dx1 + stairW + 1, layer: 2, draw(ctx, env) { // railing, in front of whoever stands there
      ctx.strokeStyle = rail; ctx.lineWidth = Math.max(0.09, env.px * 0.9);
      ctx.beginPath(); ctx.moveTo(dx0, deckY + 1.02); ctx.lineTo(dx1, deckY + 1.02); ctx.lineTo(dx1 + stairW, 1.02); ctx.moveTo(dx0, deckY); ctx.lineTo(dx0, deckY + 1.02); ctx.stroke();
      if (env.s > 3.2) { ctx.lineWidth = Math.max(0.035, env.px * 0.55); ctx.beginPath(); for (let px = dx0 + 0.5; px < dx1; px += 0.5) { ctx.moveTo(px, deckY); ctx.lineTo(px, deckY + 1.02); } ctx.stroke(); }
      ctx.lineWidth = Math.max(0.12, env.px); ctx.beginPath(); for (let px = dx0 + 0.6; px <= dx1 + 0.1; px += 6.1) { ctx.moveTo(px, deckY); ctx.lineTo(px, deckY + 1.08); } ctx.stroke();
    } });
    PD.solid(dx0, deckY - 0.34, dx1 - dx0, 0.34, 'wood');
  }
  H.stairTop = dx1; H.stairFoot = dx1 + stairW;
  H.stairY = (x) => deckY * clamp((dx1 + stairW - x) / stairW, 0, 1);
  if (o.tables !== false) { K.table(S, PD, -26, { y: deckY }); K.table(S, PD, 2.6, { y: deckY, umbrella: '#b3312b' }); }
  // firewood stacked by the stair
  K.box(S, PD, 15.5, 0, 5.2, 1.7, '#8a6a45', { ribs: 0.36, band: 0.14, mat: 'wood' }); H.woodpile = { x: 18.1, y: 1.7 };
  // flag
  if (o.flag !== false) H.flag = VLY.flag(S, PD, o.flagX === undefined ? 27 : o.flagX, 0, 13, o.flagCol || '#b3312b');
  // helipad: a painted disc on the ground, lights, and a windsock
  const padX = 49; H.pad = { x: padX, x0: padX - 10, x1: padX + 10 };
  {
    const conc = S.tone(snowy ? '#c9d2da' : '#8f9499', PD), paint = S.tone('#f4f1e6', PD), lampC = S.tone('#2a2e36', PD);
    PD.add({ x0: padX - 12, x1: padX + 12, layer: 0, draw(ctx, env) {
      ctx.fillStyle = conc; ctx.beginPath(); ctx.ellipse(padX, -1.5, 10.5, 1.42, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = paint; ctx.lineWidth = Math.max(0.16, env.px); ctx.beginPath(); ctx.ellipse(padX, -1.5, 8.6, 1.08, 0, 0, TAU); ctx.stroke();
      R4(ctx, padX - 2.1, -2.05, 0.75, 1.1, paint); R4(ctx, padX + 1.35, -2.05, 0.75, 1.1, paint); R4(ctx, padX - 2.1, -1.62, 4.2, 0.24, paint);
      for (const lx of [padX - 10.4, padX + 10.4]) { R4(ctx, lx - 0.07, -1.5, 0.14, 1.9, lampC); circ(ctx, lx, 0.45, Math.max(0.16, env.px * 1.2), Math.sin(env.t * 2.4) > 0 ? '#ff5a4d' : '#7d2a25'); }
    } });
  }
  if (o.sock !== false) H.sock = VLY.sock(S, PD, padX + 14.5, 0, 7.2);
  // the hunting tower, at the edge of the trees on the left
  H.tower = VLY.seat(S, PD, o.towerX === undefined ? -64 : o.towerX, { id: 'hide', h: 6.5, side: 1 });

  // ---- the slope down to the road ----
  const PSL = VLY.hill(S, zD - 35, { name: 'slope', seed: sd + 29, top: -2.6, amp: 2.4, rough: 70, th: 4.2, rows: 2, gap: 2.6, density: 0.5, rowDrop: 1.6, maxH: 4.6, col: darken(meadow, 0.08), treeCol: '#28503d', treeCol2: '#2f5a45', x0: -700, x1: 700 });
  H.PSL = PSL;
  {
    const post = S.tone('#5a4634', PSL), R = makeRng(sd * 3 + 11), rocks = []; for (let i = 0; i < 26; i++) rocks.push([R.r(-150, 150), R.r(1.5, 9), R.r(0.5, 1.5)]);
    const rockC = S.tone(snowy ? '#aab4bf' : '#8b8f8c', PSL);
    PSL.add({ x0: -400, x1: 400, layer: 0, draw(ctx, env) { // a rail fence along the lip of the yard, and a few boulders
      ctx.strokeStyle = post; ctx.lineWidth = Math.max(0.1, env.px * 0.8); ctx.beginPath();
      const a = Math.floor((env.x0 - 4) / 4) * 4;
      for (let x = a; x < env.x1 + 4; x += 4) { const y = PSL.heightAt(x), y2 = PSL.heightAt(x + 4); ctx.moveTo(x, y - 0.2); ctx.lineTo(x, y + 1.1); ctx.moveTo(x, y + 0.9); ctx.lineTo(x + 4, y2 + 0.9); ctx.moveTo(x, y + 0.45); ctx.lineTo(x + 4, y2 + 0.45); }
      ctx.stroke();
      ctx.fillStyle = rockC; for (let i = 0; i < rocks.length; i++) { const r = rocks[i]; if (r[0] < env.x0 - 3 || r[0] > env.x1 + 3) continue; ctx.beginPath(); ctx.ellipse(r[0], PSL.heightAt(r[0]) - r[1], r[2], r[2] * 0.55, 0, 0, Math.PI); ctx.fill(); }
    } });
  }

  // ---- the mountain road ----
  const PR = S.plane(zD - 70, 'road'); H.PR = PR;
  K.ground(S, PR, { y: roadY, col: snowy ? '#dfe6ec' : darken(meadow, 0.16), noEdge: true });
  const gateX = o.gateX === undefined ? -62 : o.gateX; H.gate = { x: gateX };
  {
    const tar = S.tone(snowy ? '#8f9aa5' : '#4a4f57', PR), tar2 = S.tone(snowy ? '#a8b2bc' : '#5a6068', PR), paint = S.tone('#e9e2c4', PR), poleA = S.tone('#e2572b', PR), poleB = S.tone('#1d2026', PR), bank = S.tone(snowy ? '#f4f7fa' : '#93b274', PR);
    const hut = S.tone('#6d5a45', PR), hutR = S.tone(snowy ? '#eef2f6' : '#3d302a', PR), red = S.tone('#c8372d', PR), white = S.tone('#f1ede2', PR), stoneC = S.tone('#8d8a80', PR);
    PR.add({ x0: -4000, x1: 4000, layer: 0, draw(ctx, env) {
      R4(ctx, env.x0 - 2, roadY - 5.6, env.x1 - env.x0 + 4, 6.5, tar); R4(ctx, env.x0 - 2, roadY + 0.72, env.x1 - env.x0 + 4, 0.22, bank);
      R4(ctx, env.x0 - 2, roadY - 5.6, env.x1 - env.x0 + 4, 0.35, tar2);
      ctx.fillStyle = paint; const a = Math.floor(env.x0 / 9) * 9; for (let x = a; x < env.x1; x += 9) ctx.fillRect(x, roadY - 2.6, 3.6, Math.max(0.2, env.px));
      // marker poles along the far verge
      const b = Math.floor(env.x0 / 14) * 14; for (let x = b; x < env.x1 + 14; x += 14) { R4(ctx, x - 0.07, roadY + 0.9, 0.14, 1.5, poleA); R4(ctx, x - 0.07, roadY + 1.9, 0.14, 0.3, poleB); }
      // the gate: a hut, two stone posts and a striped boom (raised)
      R4(ctx, gateX - 5.2, roadY + 0.9, 3.4, 2.7, hut); R4(ctx, gateX - 4.6, roadY + 2.0, 1.1, 1.0, S.tone(S.pal.glass, PR)); poly(ctx, [gateX - 5.6, roadY + 3.6, gateX - 1.4, roadY + 3.6, gateX - 1.9, roadY + 4.25, gateX - 5.1, roadY + 4.25], hutR);
      R4(ctx, gateX - 0.5, roadY + 0.2, 1.0, 2.5, stoneC); R4(ctx, gateX - 0.65, roadY + 2.6, 1.3, 0.28, S.tone('#6f6c64', PR));
      ctx.save(); ctx.translate(gateX, roadY + 2.0); ctx.rotate(o.gateShut ? 0.02 : 1.05); for (let i = 0; i < 6; i++) R4(ctx, 0.2 + i * 1.05, -0.11, 1.05, 0.22, i % 2 ? white : red); ctx.restore();
    } });
    PR.solid(gateX - 5.2, roadY + 0.9, 3.4, 2.7, 'wood'); PR.solid(gateX - 0.5, roadY, 1.0, 2.7, 'hard');
  }

  // ---- the bank on the near side of the road ----
  const PN = VLY.hill(S, zD - 95, { name: 'bank', seed: sd + 37, top: bankY, amp: 1.6, rough: 60, th: 4.8, rows: 2, gap: 1.7, density: 0.62, rowDrop: 1.3, maxH: 5.2, col: snowy ? '#e4eaef' : darken(meadow, 0.24), treeCol: '#234a39', treeCol2: '#2c5843', x0: -700, x1: 700 });
  H.PN = PN;

  // ---- pine tops on the shooter's own slope, right at the bottom of the view ----
  if (o.near !== false) {
    const zF = Math.max(60, zR * 0.3), PF = S.plane(zF, 'near'); H.PF = PF;
    const aB = (S.bounds.y0 - E) / zR, tipY = lay(aB + 0.012, zF), col = S.tone('#16302a', PF), col2 = S.tone('#1d3a31', PF), R = makeRng(sd * 19 + 5), TT = [];
    for (let x = -zF * 0.5; x < zF * 0.5; x += R.r(2.4, 5.5)) { const h = R.r(11, 19); TT.push([x, tipY - h - R.r(0, 6), h]); }
    PF.add({ x0: -zF, x1: zF, layer: 2, draw(ctx, env) {
      R4(ctx, env.x0 - 2, tipY - 420, env.x1 - env.x0 + 4, 420 - 9.5, col);
      for (let k = 0; k < 2; k++) { ctx.fillStyle = k ? col2 : col; ctx.beginPath(); for (let i = vlyFrom(TT, env.x0 - 6) + k; i < TT.length && TT[i][0] < env.x1 + 6; i += 2) vlyPine(ctx, TT[i][0], TT[i][1], TT[i][2], TT[i][2] * 0.22); ctx.fill(); }
    } });
  }

  // ---- placements ----
  H.deck = (x, extra) => Object.assign({ plane: PD, x, y: deckY, zone: 'deck', room: null, behind: false }, extra || {});
  H.yard = (x, extra) => Object.assign({ plane: PD, x, y: 0, zone: 'yard', room: null, behind: false }, extra || {});
  H.road = (x, extra) => Object.assign({ plane: PR, x, y: roadY, zone: 'road', room: null, behind: false }, extra || {});
  H.inLodge = (f, c, dx, extra) => { const op = B.win(f, c); return Object.assign({ plane: PL, x: B.winX(c) + (dx || 0), y: B.floorY(f), room: op.room, zone: op.room, behind: true }, extra || {}); };
  // A tall pine planted part of the way across the valley so that, from the
  // given eye position, it hides the spot (x, y) on the deck plane. From any
  // other position it hides something else, or nothing.
  H.screenPine = (eye, x, y, oo) => {
    oo = oo || {}; const f = oo.f || 0.55, ez = eye[2] || 0, zt = ez + (zD - ez) * f;
    let PS = H.PScreen && H.PScreen.z === zt ? H.PScreen : null;
    if (!PS) { PS = H.PScreen = S.plane(zt, 'screen'); }
    const tx = eye[0] + (x - eye[0]) * f, ty = eye[1] + (y - eye[1]) * f, h = oo.h || 30, by = ty + (oo.above === undefined ? 14 : oo.above) * f - h, w = h * (oo.wide || 0.24), col = S.tone(oo.col || '#1c382f', PS), cap = S.tone('#f1f5f8', PS);
    PS.add({ x0: tx - w - 1, x1: tx + w + 1, layer: 2, draw(ctx) { ctx.fillStyle = col; ctx.beginPath(); vlyPine(ctx, tx, by + h * 0.12, h * 0.88, w); ctx.fill(); ctx.fillRect(tx - h * 0.018, by - 60, h * 0.036, 60 + h * 0.14);
      if (snowy) { ctx.fillStyle = cap; ctx.beginPath(); ctx.moveTo(tx, by + h); ctx.lineTo(tx - w * 0.4, by + h * 0.69); ctx.lineTo(tx + w * 0.4, by + h * 0.69); ctx.closePath(); ctx.fill(); } } });
    // the branches stop a bullet as well as the eye (heavy rounds go through)
    PS.solid(tx - w * 0.95, by + h * 0.12, w * 1.9, h * 0.3, 'wood'); PS.solid(tx - w * 0.68, by + h * 0.42, w * 1.36, h * 0.25, 'wood'); PS.solid(tx - w * 0.3, by + h * 0.67, w * 0.6, h * 0.2, 'wood'); PS.solid(tx - h * 0.018, by - 60, h * 0.036, 60 + h * 0.14, 'wood');
    return { x: tx, top: by + h, w, plane: PS };
  };
  return H;
};
