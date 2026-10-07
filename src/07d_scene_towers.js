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
// ---------------------------------------------------------------------------

// A soft round glow that adds light to whatever is behind it.
function twGlow(ctx, x, y, r, hex, a) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(hex, a)); g.addColorStop(1, rgba(hex, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.restore();
}
// A small red aircraft warning light that pulses.
function twBeacon(ctx, env, x, y, ph) {
  const a = 0.35 + 0.65 * Math.pow(Math.max(0, Math.sin(env.t * 2.2 + (ph || 0))), 6);
  circ(ctx, x, y, Math.max(0.16, env.px * 1.2), rgba('#ff3b30', 0.35 + 0.65 * a));
  if (a > 0.5) twGlow(ctx, x, y, Math.max(1.6, env.px * 9), '#ff3b30', 0.5 * a);
}

// What stands in one window bay of a lit office floor. The person who uses a
// desk sits in the middle of the bay; 'deskL' puts the desk on their left.
function twBay(ctx, env, S, P, op, bay) {
  const tint = op.tint, cx = op.x + op.w / 2, fy = op.y, sd = bay.flip ? -1 : 1;
  const hi = S.tone(lighten(tint, 0.6), P, true), dk = S.tone(darken(tint, 0.55), P, true), md = S.tone(darken(tint, 0.3), P, true);
  // strip lights in the ceiling
  R4(ctx, op.x + op.w * 0.1, op.y + op.h - 0.22, op.w * 0.32, 0.1, hi); R4(ctx, op.x + op.w * 0.58, op.y + op.h - 0.22, op.w * 0.32, 0.1, hi);
  if (env.s < 3.4) return;
  const k = bay.kind;
  if (k === 'deskL' || k === 'deskR') {
    const d = k === 'deskL' ? -1 : 1;
    R4(ctx, cx + (d > 0 ? 0.36 : -1.5), fy + 0.66, 1.14, 0.07, dk);                    // desk top
    R4(ctx, cx + d * 1.42 - 0.04, fy, 0.08, 0.66, dk);                                  // desk leg
    R4(ctx, cx + d * 1.04 - 0.035, fy + 0.73, 0.07, 0.48, dk);                          // monitor, seen edge on
    R4(ctx, cx + d * 1.04 - (d > 0 ? 0.075 : -0.035), fy + 0.84, 0.04, 0.34, S.tone('#aee0ff', P, true));
    R4(ctx, cx - 0.26, fy + 0.4, 0.52, 0.07, dk); R4(ctx, cx - d * 0.3 - 0.04, fy + 0.4, 0.08, 0.66, dk); R4(ctx, cx - 0.03, fy, 0.06, 0.4, dk); // chair
    if (bay.lamp) { R4(ctx, cx + d * 0.62 - 0.02, fy + 0.73, 0.04, 0.3, dk); poly(ctx, [cx + d * 0.62 - 0.17, fy + 1.0, cx + d * 0.62 + 0.17, fy + 1.0, cx + d * 0.62 + 0.09, fy + 1.16, cx + d * 0.62 - 0.09, fy + 1.16], S.tone(bay.lamp, P, true)); }
  } else if (k === 'plant') {
    poly(ctx, [cx + sd * 1.0 - 0.22, fy + 0.5, cx + sd * 1.0 + 0.22, fy + 0.5, cx + sd * 1.0 + 0.15, fy, cx + sd * 1.0 - 0.15, fy], dk);
    circ(ctx, cx + sd * 1.0 - 0.18, fy + 0.85, 0.28, md); circ(ctx, cx + sd * 1.0 + 0.2, fy + 0.98, 0.3, md); circ(ctx, cx + sd * 1.0, fy + 1.3, 0.27, md);
  } else if (k === 'shelf') {
    R4(ctx, cx + sd * 0.95 - 0.5, fy, 1.0, 2.05, md); ctx.fillStyle = dk; for (let i = 1; i < 5; i++) ctx.fillRect(cx + sd * 0.95 - 0.5, fy + i * 0.41, 1.0, 0.05);
  } else if (k === 'sofa') {
    R4(ctx, cx - 0.95, fy, 1.9, 0.42, dk); R4(ctx, cx - 0.95, fy + 0.42, 0.24, 0.42, dk); R4(ctx, cx + 0.71, fy + 0.42, 0.24, 0.42, dk);
  } else if (k === 'table') {
    R4(ctx, cx - 1.15, fy + 0.68, 2.3, 0.08, dk); R4(ctx, cx - 0.06, fy, 0.12, 0.68, dk);
    R4(ctx, cx - 1.5, fy + 0.4, 0.07, 0.62, md); R4(ctx, cx + 1.43, fy + 0.4, 0.07, 0.62, md);
  } else if (k === 'cooler') {
    R4(ctx, cx + sd * 1.0 - 0.2, fy, 0.4, 1.02, md); R4(ctx, cx + sd * 1.0 - 0.15, fy + 1.02, 0.3, 0.44, S.tone('#bfe6ff', P, true)); R4(ctx, cx - sd * 0.6 - 0.5, fy + 0.86, 1.0, 0.07, dk); R4(ctx, cx - sd * 0.6 - 0.04, fy, 0.08, 0.86, dk);
  } else if (k === 'board') {
    R4(ctx, cx - 0.95, fy + 1.0, 1.9, 1.05, hi); ctx.fillStyle = md; for (let i = 0; i < 3; i++) ctx.fillRect(cx - 0.75, fy + 1.25 + i * 0.27, 1.1 + (i % 2) * 0.35, 0.05);
  } else if (k === 'lobby') {
    R4(ctx, op.x + 0.3, fy, op.w - 0.6, 1.02, dk); R4(ctx, op.x + 0.3, fy + 0.96, op.w - 0.6, 0.07, md);
  } else if (k === 'room') { // a hotel room: armchair and a floor lamp
    R4(ctx, cx + sd * 0.9 - 0.03, fy, 0.06, 1.45, dk); poly(ctx, [cx + sd * 0.9 - 0.25, fy + 1.45, cx + sd * 0.9 + 0.25, fy + 1.45, cx + sd * 0.9 + 0.14, fy + 1.78, cx + sd * 0.9 - 0.14, fy + 1.78], hi);
    R4(ctx, cx - sd * 0.5 - 0.42, fy, 0.84, 0.44, dk); R4(ctx, cx - sd * 0.92 - 0.1, fy + 0.44, 0.2, 0.5, dk);
  }
}

// ---- a glass tower ------------------------------------------------------------
// Built on K.building (style 'glass') so every window is a real opening, but
// each floor is one long room unless told otherwise:
//   lit: { 6: true, 7: false, 3: [[0, 2, true], [3, 6, false]], 5: 'each' }
// 'each' leaves every window its own room (hotel floors). `bays` names what
// stands in a bay ('deskL', 'cooler', ...), keyed 'floor,column'.
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
  const para = o.parapet === undefined ? 0.3 : o.parapet;
  const B = K.building(S, P, { x, w, floors, fh, id, base, style: 'glass', cols, winW: colW - (o.mullion || 0.32), winH: fh - 0.62, sill: 0.12, wall: o.wall || '#1c2836',
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
  const roofY = B.roofY, edge = o.edge || '#5fd4ff';
  // inside the rooms: furniture on lit floors, the odd screen left on in dark ones
  P.add({ x0: x, x1: x + w, layer: 0, draw(ctx, env) {
    if (env.s < 1.6) return;
    for (const key in B.wins) {
      const op = B.wins[key];
      if (op.x + op.w < env.x0 || op.x > env.x1 || op.y > env.y1 || op.y + op.h < env.y0) continue;
      const room = S.rooms[op.room];
      if (room && room.lit) {
        const g = ctx.createLinearGradient(0, op.y, 0, op.y + op.h); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.34)');
        ctx.fillStyle = g; ctx.fillRect(op.x, op.y, op.w, op.h);
        twBay(ctx, env, S, P, op, bays[key]);
      }
      else if (bays[key].screen && env.s > 2.5) R4(ctx, op.x + op.w * (bays[key].flip ? 0.25 : 0.68), op.y + 0.82, 0.3, 0.2, env.nv ? '#9fe8b0' : 'rgba(110,170,235,0.5)');
    }
  } });
  // in front of the rooms: the sky in the glass, edge lighting, hazard tape on any pane that is out
  P.add({ x0: x - 1, x1: x + w + 1, layer: 1, draw(ctx, env) {
    const g = ctx.createLinearGradient(0, base, 0, roofY);
    g.addColorStop(0, 'rgba(60,100,165,0)'); g.addColorStop(1, 'rgba(60,100,165,0.17)');
    ctx.fillStyle = g; ctx.fillRect(x, base, w, roofY - base);
    const ec = rgba(edge, 0.75), ew = Math.max(0.1, env.px * 0.9);
    R4(ctx, x - ew, base, ew, roofY + para - base, ec); R4(ctx, x + w, base, ew, roofY + para - base, ec);
    R4(ctx, x - ew, roofY + para - ew * 0.5, w + ew * 2, ew, ec);
    if (env.s > 2) {
      for (const key in B.wins) {
        const op = B.wins[key]; if (op.glass || op.door || op.x + op.w < env.x0 || op.x > env.x1) continue;
        ctx.strokeStyle = '#f2c230'; ctx.lineWidth = Math.max(0.07, env.px * 1.1);
        ctx.beginPath(); ctx.moveTo(op.x, op.y + 0.5); ctx.lineTo(op.x + op.w, op.y + 1.25); ctx.moveTo(op.x, op.y + 1.25); ctx.lineTo(op.x + op.w, op.y + 0.5); ctx.stroke();
      }
    }
  } });
  return B;
};

// ---- the big towers behind everything: shapes and lit floors, nothing more ------
K.twBackTowers = function (S, z, o) {
  o = o || {};
  const P = S.plane(z, 'backtowers'), R = makeRng(o.seed || 41);
  const list = o.towers || [];
  const body = S.tone('#3b4960', P), body2 = S.tone('#2c3850', P);
  const lights = [S.tone('#ffd9a0', P, true), S.tone('#d6e6ff', P, true), S.tone('#ffe9c8', P, true), S.tone('#bfe0ff', P, true)];
  const tw = list.map((t, i) => {
    const cells = [], cw = t.w / Math.max(3, Math.round(t.w / 3.4)), n = Math.round(t.w / cw);
    for (let y = 5; y < t.h - 4; y += 3.6) {
      const mode = R.f();
      if (mode < 0.09) { cells.push([t.x + 0.6, y, t.w - 1.2, 1.9, R.i(0, 3)]); continue; }      // a whole floor working late
      if (mode < 0.4) continue;                                                              // a dark floor
      const col = R.i(0, 3);
      for (let c = 0; c < n; c++) if (R.chance(0.32)) cells.push([t.x + c * cw + 0.45, y, cw - 0.9, 1.9, col]);
    }
    return { t, cells, strip: t.strip, ph: i * 1.7 };
  });
  P.add({ x0: -400, x1: 400, layer: 0, draw(ctx, env) {
    for (let i = 0; i < tw.length; i++) {
      const T = tw[i], t = T.t; if (t.x + t.w < env.x0 || t.x > env.x1) continue;
      R4(ctx, t.x, 0, t.w, t.h, body); R4(ctx, t.x + t.w * 0.72, 0, t.w * 0.28, t.h, body2);
      if (t.top === 'step') { R4(ctx, t.x + t.w * 0.2, t.h, t.w * 0.6, 7, body); R4(ctx, t.x + t.w * 0.38, t.h + 7, t.w * 0.24, 6, body2); }
      if (t.top === 'needle') { poly(ctx, [t.x + t.w * 0.2, t.h, t.x + t.w * 0.8, t.h, t.x + t.w * 0.56, t.h + 14, t.x + t.w * 0.44, t.h + 14], body); line(ctx, t.x + t.w / 2, t.h + 14, t.x + t.w / 2, t.h + 34, body, 0.5, env); }
      if (t.top === 'slant') poly(ctx, [t.x, t.h, t.x + t.w, t.h, t.x + t.w, t.h + 12], body);
      for (let j = 0; j < T.cells.length; j++) { const c = T.cells[j]; ctx.fillStyle = lights[c[4]]; ctx.fillRect(c[0], c[1], c[2], c[3]); }
      if (T.strip) { ctx.fillStyle = rgba(T.strip, 0.8); ctx.fillRect(t.x + t.w * 0.08, 4, Math.max(0.5, env.px), t.h - 6); ctx.fillRect(t.x + 1, t.h - 1.6, t.w - 2, Math.max(0.6, env.px)); }
      const topY = t.h + (t.top === 'needle' ? 34 : t.top === 'step' ? 13 : t.top === 'slant' ? 12 : 0);
      twBeacon(ctx, env, t.top === 'slant' ? t.x + t.w - 0.5 : t.x + t.w / 2, topY + 0.4, T.ph);
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
  const steel = S.tone('#aab3bd', P), dark = S.tone('#20252d', P), yel = S.tone('#e2b33c', P, true);
  cr.solid = P.solid(cr.x - cr.w / 2, cr.y - 0.16, cr.w, 0.16, 'thin');
  cr.setY = (y) => { cr.y = y; cr.solid.y = y - 0.16; };
  cr.at = (dx, extra) => Object.assign({ plane: P, x: cr.x + (dx || 0), y: cr.y, zone: cr.zone, room: null, behind: false, flee: [['wait', 999, 'cower']] }, extra || {});
  P.add({ x0: cr.x - cr.w, x1: cr.x + cr.w, layer: 0, draw(ctx, env) {
    const a = cr.x - cr.w / 2, b = cr.x + cr.w / 2;
    line(ctx, a + 0.25, cr.y + 1.05, a + 0.25, cr.top + 0.5, dark, 0.05, env); line(ctx, b - 0.25, cr.y + 1.05, b - 0.25, cr.top + 0.5, dark, 0.05, env);
    line(ctx, a + 0.25, cr.top + 0.5, a + 0.25 - 0.9, cr.top + 0.9, steel, 0.12, env); line(ctx, b - 0.25, cr.top + 0.5, b - 0.25 + 0.9, cr.top + 0.9, steel, 0.12, env);   // davit arms on the roof
    R4(ctx, a, cr.y - 0.16, cr.w, 0.16, steel);
  } });
  P.add({ x0: cr.x - cr.w, x1: cr.x + cr.w, layer: 2, draw(ctx, env) {
    const a = cr.x - cr.w / 2, b = cr.x + cr.w / 2, y = cr.y;
    ctx.strokeStyle = steel; ctx.lineWidth = Math.max(0.06, env.px * 0.8);
    ctx.beginPath(); ctx.moveTo(a, y); ctx.lineTo(a, y + 1.05); ctx.lineTo(b, y + 1.05); ctx.lineTo(b, y); ctx.moveTo(a, y + 0.55); ctx.lineTo(b, y + 0.55); ctx.stroke();
    R4(ctx, a, y - 0.16, cr.w, 0.22, steel); R4(ctx, a, y - 0.16, cr.w, 0.07, yel);
    if (env.s > 5) { R4(ctx, b - 0.75, y + 0.06, 0.34, 0.3, S.tone('#3f6fb0', P)); line(ctx, b - 0.58, y + 0.36, b - 0.4, y + 1.2, dark, 0.03, env); }   // bucket and squeegee pole
  } });
  return cr;
};

// ---- the rooftop bar on the Meridian -----------------------------------------------
K.twTerrace = function (S, P, B, o) {
  o = o || {};
  const y = B.roofY, x0 = B.x, x1 = B.x + B.w, zone = B.roofRoom;
  const steel = S.tone('#2a3038', P), wood = S.tone('#6b4f3a', P), wood2 = S.tone('#4a3626', P), leaf = S.tone('#3f7a4c', P), pot = S.tone('#9a5a3a', P), top = S.tone('#e9e4d6', P);
  const T = { x0, x1, y, zone, lamps: [], posts: [] };
  const n = 4;
  for (let i = 0; i <= n; i++) T.posts.push(x0 + 0.5 + ((x1 - x0 - 1) * i) / n);
  (o.lamps || [x0 + 3.6, x0 + 11.95, x1 - 3.4]).forEach((lx, i) => T.lamps.push(K.lamp(S, P, lx, 3.0, zone, { id: 'tl' + (i + 1), y, reach: o.reach || 4.6, arm: 0 })));
  T.on = () => T.lamps.some((l) => l.alive && l.on !== false);
  T.barX = x0 + 3.1;
  const tables = o.tables || [x0 + 8.2, x0 + 12.4, x0 + 16.2];
  const bulbs = [];
  for (let i = 0; i < n; i++) { const a = T.posts[i], b = T.posts[i + 1]; for (let u = 0.08; u < 0.95; u += 0.11) bulbs.push([lerp(a, b, u), y + 3.25 - Math.sin(u * Math.PI) * 0.5, (bulbs.length % 3)]); }
  P.add({ x0: x0 - 1, x1: x1 + 1, layer: 0, draw(ctx, env) {
    R4(ctx, x0, y - 0.08, x1 - x0, 0.2, wood);                                                 // the deck
    if (T.on()) { const g = ctx.createLinearGradient(0, y, 0, y + 3.6); g.addColorStop(0, 'rgba(255,196,120,0.16)'); g.addColorStop(1, 'rgba(255,196,120,0.02)'); ctx.fillStyle = g; ctx.fillRect(x0, y, x1 - x0, 3.6); }
    for (let i = 0; i < T.posts.length; i++) R4(ctx, T.posts[i] - 0.07, y, 0.14, 3.3, steel);
    R4(ctx, x0 + 0.3, y + 3.24, x1 - x0 - 0.6, 0.12, steel);
    // the back of the bar: shelves of bottles
    R4(ctx, x0 + 1.0, y, 4.2, 2.3, wood2); R4(ctx, x0 + 1.15, y + 1.2, 3.9, 0.06, wood); R4(ctx, x0 + 1.15, y + 1.75, 3.9, 0.06, wood);
    if (env.s > 4) { const bc = ['#7fb86a', '#d9a441', '#b5523f', '#9fc6e0', '#e6dcc0']; for (let i = 0; i < 12; i++) { R4(ctx, x0 + 1.3 + i * 0.31, y + 1.26, 0.12, 0.34, S.tone(bc[i % 5], P, T.on())); R4(ctx, x0 + 1.4 + i * 0.31, y + 1.81, 0.11, 0.3, S.tone(bc[(i + 2) % 5], P, T.on())); } }
    // planters at both ends, tall tables in between
    for (const px of [x0 + 0.5, x1 - 0.5]) { R4(ctx, px - 0.32, y, 0.64, 0.6, pot); circ(ctx, px - 0.12, y + 0.95, 0.34, leaf); circ(ctx, px + 0.14, y + 1.25, 0.36, leaf); circ(ctx, px, y + 1.65, 0.3, leaf); }
    for (let i = 0; i < tables.length; i++) { const tx = tables[i]; R4(ctx, tx - 0.04, y, 0.08, 1.05, steel); R4(ctx, tx - 0.42, y + 1.05, 0.84, 0.06, top); R4(ctx, tx - 0.25, y, 0.5, 0.05, steel); }
  } });
  P.add({ x0: x0 - 1, x1: x1 + 1, layer: 1, draw(ctx, env) {
    R4(ctx, x0 + 0.8, y, 4.6, 1.1, wood); R4(ctx, x0 + 0.7, y + 1.06, 4.8, 0.09, top);         // the bar counter, in front of whoever is serving
    // glass rail along the edge
    ctx.fillStyle = 'rgba(150,195,230,0.10)'; ctx.fillRect(x0, y, x1 - x0, 1.05);
    R4(ctx, x0, y + 1.02, x1 - x0, Math.max(0.05, env.px * 0.8), 'rgba(200,225,245,0.55)');
    if (env.s > 3) { ctx.fillStyle = 'rgba(200,225,245,0.3)'; for (let x = x0; x <= x1 + 0.01; x += 1.75) ctx.fillRect(x - 0.02, y, 0.04, 1.05); }
    // string lights
    const on = T.on();
    ctx.strokeStyle = steel; ctx.lineWidth = Math.max(0.02, env.px * 0.5);
    ctx.beginPath(); for (let i = 0; i < n; i++) { ctx.moveTo(T.posts[i], y + 3.25); ctx.quadraticCurveTo((T.posts[i] + T.posts[i + 1]) / 2, y + 2.25, T.posts[i + 1], y + 3.25); } ctx.stroke();
    const cols = ['#ffe2a0', '#ffc66b', '#fff1cf'];
    for (let i = 0; i < bulbs.length; i++) { const b = bulbs[i]; if (b[0] < env.x0 || b[0] > env.x1) continue; circ(ctx, b[0], b[1], Math.max(0.075, env.px * 0.9), on ? cols[b[2]] : '#2a2e36'); }
    if (on && env.s > 2) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,200,120,0.2)'; for (let i = 0; i < bulbs.length; i++) { const b = bulbs[i]; ctx.beginPath(); ctx.arc(b[0], b[1], 0.17, 0, TAU); ctx.fill(); } ctx.restore(); }
  } });
  return T;
};

// ---- the building site -----------------------------------------------------------
// A concrete frame with open floors, scaffolding up its left face, a tower crane
// behind it with a girder on the hook, a cabin, floodlights and a mesh fence.
K.twSite = function (S, P, o) {
  o = o || {};
  const fx0 = o.x === undefined ? 31 : o.x, bw = 4, nb = o.bays || 4, fx1 = fx0 + nb * bw, lv = o.levels || 4, fh = 3.6, topY = lv * fh;
  const dark = S.tone('#22262d', P), orange = S.tone('#e07b2a', P, true), net = S.tone('#2f7a55', P);
  const two = (hex) => [S.tone(hex, P), mix(S.tone(hex, P, true), S.tone(hex, P), 0.35)];   // [in the dark, under the floodlights]
  const concC = two('#8c9198'), concDC = two('#5c6169'), steelC = two('#9aa3ad'), woodC = two('#a8916d');
  let conc = concC[1], concD = concDC[1], steel = steelC[1], wood = woodC[1];
  const relight = () => { const i = Z.lamps.some((l) => l.alive && l.on !== false) ? 1 : 0; conc = concC[i]; concD = concDC[i]; steel = steelC[i]; wood = woodC[i]; };
  const Z = { x0: fx0, x1: fx1, fh, levels: lv, lamps: [], yard0: o.yard0 === undefined ? fx0 - 11 : o.yard0 };
  const craneX = o.craneX === undefined ? fx1 - 2.5 : o.craneX, craneH = o.craneH || 26, reach = o.reach || 22;
  K.crane(S, P, craneX, craneH, -reach, { layer: 0 });
  Z.jibY = craneH; Z.craneX = craneX;
  // the frame
  P.add({ x0: fx0 - 0.5, x1: fx1 + 0.5, layer: 0, draw(ctx, env) {
    relight();
    for (let i = 0; i <= nb; i++) R4(ctx, fx0 + i * bw - 0.2, 0, 0.4, topY, concD);
    for (let l = 1; l <= lv; l++) { R4(ctx, fx0 - 0.2, l * fh - 0.3, fx1 - fx0 + 0.4, 0.3, conc); R4(ctx, fx0 - 0.2, l * fh - 0.3, fx1 - fx0 + 0.4, 0.07, concD); }
    // lift shaft in the last bay, starter bars sticking out of the top
    R4(ctx, fx1 - bw + 0.9, 0, bw - 1.8, topY + 1.2, concD);
    ctx.strokeStyle = dark; ctx.lineWidth = Math.max(0.04, env.px * 0.6); ctx.beginPath();
    for (let i = 0; i <= nb; i++) for (let k = -1; k <= 1; k++) { ctx.moveTo(fx0 + i * bw + k * 0.12, topY); ctx.lineTo(fx0 + i * bw + k * 0.12, topY + 1.1); }
    ctx.stroke();
    // props under the newest slab
    if (env.s > 3) { ctx.strokeStyle = steel; ctx.beginPath(); for (let x = fx0 + 1; x < fx1 - bw; x += 1) { ctx.moveTo(x, (lv - 1) * fh); ctx.lineTo(x, topY - 0.3); } ctx.stroke(); }
  } });
  for (let l = 1; l <= lv; l++) P.solid(fx0 - 0.2, l * fh - 0.3, fx1 - fx0 + 0.4, 0.3, 'hard');
  for (let i = 0; i <= nb; i++) P.solid(fx0 + i * bw - 0.2, 0, 0.4, topY, 'hard');
  P.solid(fx1 - bw + 0.9, 0, bw - 1.8, topY + 1.2, 'hard');
  // edge barriers on every open floor, drawn in front of whoever stands there
  P.add({ x0: fx0, x1: fx1, layer: 2, draw(ctx, env) {
    ctx.strokeStyle = orange; ctx.lineWidth = Math.max(0.05, env.px * 0.8); ctx.beginPath();
    for (let l = 1; l <= lv; l++) { ctx.moveTo(fx0, l * fh + 1.0); ctx.lineTo(fx1 - bw + 0.9, l * fh + 1.0); ctx.moveTo(fx0, l * fh + 0.5); ctx.lineTo(fx1 - bw + 0.9, l * fh + 0.5); }
    ctx.stroke();
  } });
  // scaffolding on the left face
  const sx0 = fx0 - 2.8, sx1 = fx0 - 0.2;
  P.add({ x0: sx0 - 0.3, x1: sx1 + 0.3, layer: 2, draw(ctx, env) {
    ctx.strokeStyle = steel; ctx.lineWidth = Math.max(0.05, env.px * 0.8); ctx.beginPath();
    for (const x of [sx0, (sx0 + sx1) / 2, sx1]) { ctx.moveTo(x, 0); ctx.lineTo(x, topY + 1.6); }
    for (let l = 0; l <= lv; l++) { ctx.moveTo(sx0, l * fh + 1.05); ctx.lineTo(sx1, l * fh + 1.05); }
    for (let l = 0; l < lv; l++) { ctx.moveTo(sx0, l * fh); ctx.lineTo(sx1, (l + 1) * fh); }
    ctx.stroke();
    for (let l = 1; l <= lv; l++) R4(ctx, sx0 - 0.1, l * fh - 0.08, sx1 - sx0 + 0.2, 0.1, wood);
    ctx.globalAlpha = 0.3; R4(ctx, sx0, 2 * fh + 1.1, sx1 - sx0, topY - 2 * fh + 0.5, net); ctx.globalAlpha = 1;
  } });
  for (let l = 1; l <= lv; l++) P.solid(sx0 - 0.1, l * fh - 0.08, sx1 - sx0 + 0.2, 0.08, 'wood');
  Z.scaf = { x0: sx0, x1: sx1 };
  // cabin, pallets, a skip
  const cabX = o.cabX === undefined ? fx0 + bw + 0.6 : o.cabX;
  Z.cabX = cabX;
  P.add({ x0: Z.yard0 - 2, x1: fx1, layer: 0, draw(ctx, env) {
    R4(ctx, cabX, 0.25, 5.6, 2.5, S.tone('#c9ced3', P)); R4(ctx, cabX, 2.6, 5.6, 0.15, concD); R4(ctx, cabX + 0.5, 0.25, 0.95, 2.05, S.tone('#3a4048', P));
    R4(ctx, cabX + 2.2, 1.2, 2.6, 1.05, S.tone('#ffe2b4', P, true)); R4(ctx, cabX + 3.45, 1.2, 0.08, 1.05, concD);
    env.text(ctx, 'SITE OFFICE', cabX + 2.8, 0.55, 0.36, S.tone('#2a2e36', P), 'center');
    for (const px of (o.pallets || [Z.yard0 + 1.6, Z.yard0 + 4.4])) { R4(ctx, px - 1.1, 0, 2.2, 0.16, wood); for (let i = 0; i < 3; i++) R4(ctx, px - 1.0 + i * 0.68, 0.16, 0.6, 0.85 + (i % 2) * 0.3, S.tone(i % 2 ? '#b9a27e' : '#8f949a', P)); }
  } });
  // mesh fence and the firm's board along the street side
  K.fence(S, P, Z.yard0 - 2.5, fx1 + 1.5, 2.0, { kind: 'mesh' });
  P.add({ x0: fx0 + 6, x1: fx0 + 13, layer: 2, draw(ctx, env) { R4(ctx, fx0 + 6.4, 0.5, 6, 1.5, S.tone('#e9e4d6', P, true)); R4(ctx, fx0 + 6.4, 0.5, 6, 0.28, orange); env.text(ctx, o.board || 'HALE & SONS', fx0 + 9.4, 1.05, 0.62, S.tone('#1c2430', P, true), 'center'); } });
  // floodlights
  (o.lamps === undefined ? [[Z.yard0 + 0.5, 8.5, 1.2, 12], [fx0 + 9.5, 3.15, 0, 9]] : o.lamps).forEach((l, i) => Z.lamps.push(K.lamp(S, P, l[0], l[1], 'site', { id: 'sl' + (i + 1), reach: l[3] || 11, arm: l[2] })));
  if (o.upperLit) for (let l = 1; l <= lv; l++) S.litZones['site' + l] = true;
  // the load on the crane
  if (o.girder !== false) {
    Z.gx = o.gx === undefined ? fx0 - 5.5 : o.gx;
    Z.hook = K.hang(S, P, Z.gx, o.hookY || 12.4, 'girder', { id: 'hook', top: craneH, floor: 0 });
    // a load slung over a working site at night carries lights: paint it so it can be found in the dark
    const hk = Z.hook, pr = hk.prop, drawHook = hk.draw, oxide = S.tone('#c0563c', P, true), oxide2 = S.tone('#8a3b2a', P, true), yel = S.tone('#f2c230', P, true);
    hk.draw = (ctx, env) => {
      drawHook(ctx, env);
      if (hk.alive) { R4(ctx, hk.x - 0.24, hk.y - 0.26, 0.48, 0.52, yel); R4(ctx, hk.x - 0.1, hk.y - 0.12, 0.2, 0.24, dark); twGlow(ctx, hk.x, hk.y, 1.1, '#f2c230', 0.28); }
    };
    P.add({ x0: Z.gx - 4, x1: Z.gx + 4, layer: 2, draw(ctx, env) {
      const x = pr.x - pr.w / 2;
      R4(ctx, x, pr.y, pr.w, pr.h, oxide); R4(ctx, x, pr.y + pr.h * 0.28, pr.w, pr.h * 0.44, oxide2);
      if (!pr.landed && Math.sin(env.t * 5) > 0) { circ(ctx, x + 0.12, pr.y + pr.h / 2, Math.max(0.1, env.px), '#ff3b30'); circ(ctx, x + pr.w - 0.12, pr.y + pr.h / 2, Math.max(0.1, env.px), '#ff3b30'); }
    } });
  }
  // a red light on the tip of the jib
  P.add({ x0: craneX - reach - 2, x1: craneX + 2, layer: 2, draw(ctx, env) { twBeacon(ctx, env, craneX - reach, craneH + 1.6, 2.1); twBeacon(ctx, env, craneX, craneH + 5.2, 0.4); } });
  Z.levelY = (l) => l * fh;
  return Z;
};

// ---- a helicopter (a vehicle kind, so it flies on a routine like any car) ----------
CARS.twheli = { len: 12, h: 3.8, body: 3.8, cab: [-0.5, 0.5], win: [], seats: [], wheel: 0, solid: true,
  draw(ctx, env, S, P, x, y, dir, colHex) {
    const c = S.tone(colHex || '#7f8b9a', P, true), c2 = S.tone('#4a5562', P, true), t = env.t;
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    // searchlight
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const sw = Math.sin(t * 0.9) * 9 + 6, g = ctx.createLinearGradient(0, 0.6, 0, -46);
    g.addColorStop(0, 'rgba(210,230,255,0.36)'); g.addColorStop(1, 'rgba(210,230,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(1.5, 0.9); ctx.lineTo(sw - 5.5, -46); ctx.lineTo(sw + 5.5, -46); ctx.closePath(); ctx.fill(); ctx.restore();
    poly(ctx, [-1.4, 2.2, -6.6, 2.75, -6.6, 2.4, -1.4, 1.2], c);                                  // tail boom
    poly(ctx, [-5.8, 2.5, -6.9, 4.1, -6.3, 4.1, -5.2, 2.6], c);                                   // fin
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0.3, 1.75, 2.7, 1.3, 0, 0, TAU); ctx.fill();   // cabin
    ctx.fillStyle = S.tone('#bfe0ff', P, true); ctx.beginPath(); ctx.ellipse(1.75, 1.85, 1.0, 0.8, 0, -1.2, 1.5); ctx.fill();
    line(ctx, -1.6, 0.25, 2.2, 0.25, c2, 0.12, env); line(ctx, -0.8, 0.25, -0.5, 0.7, c2, 0.1, env); line(ctx, 1.3, 0.25, 1.0, 0.7, c2, 0.1, env);   // skids
    line(ctx, 0.3, 3.0, 0.3, 3.5, c2, 0.16, env);
    const rw = 5.6 * (0.55 + 0.45 * Math.abs(Math.sin(t * 31)));
    ctx.globalAlpha = 0.5; R4(ctx, 0.3 - rw, 3.45, rw * 2, Math.max(0.08, env.px), S.tone('#c9d2dc', P)); ctx.globalAlpha = 1;
    ctx.globalAlpha = 0.5; circ(ctx, -6.6, 3.3, 0.75, 'rgba(200,210,222,0.25)'); ctx.globalAlpha = 1;
    if (Math.sin(t * 7) > 0.2) circ(ctx, -6.5, 2.6, Math.max(0.14, env.px), '#ff3b30');
    if (Math.sin(t * 7 + 2) > 0.2) circ(ctx, 0.2, 0.55, Math.max(0.14, env.px), '#f4f7ff');
    circ(ctx, 2.6, 1.3, Math.max(0.12, env.px), '#4dff88');
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

  // far away: the rest of the city
  K.skyline(S, z0 + 1500, { seed: 31 + seed, hMin: 70, hMax: 250, cols: ['#566478', '#5f6d82', '#4a586c'] });
  K.skyline(S, z0 + 560, { seed: 17 + seed, hMin: 16, hMax: 30, x0: -700, x1: 700, cols: ['#465264', '#4e5a6c', '#3c4858'] });
  // fireworks over the harbour (drawn only while they are going off)
  const PW = S.plane(z0 + 400, 'fireworks'); H.fw = null;
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
  // the helicopter's lane, between the back towers and the Meridian
  H.PH = S.plane(z0 + 92, 'air');

  // ---- the Meridian: a hotel with a rooftop bar, and its lift tower ----
  const PB = S.plane(z0 + 34, 'meridian'); H.PB = PB;
  K.ground(S, PB, { col: '#2a3040', noEdge: true });
  const ob = o.B || {};
  const B = K.twTower(S, PB, { x: 7, w: 21, floors: 9, id: 'B', cols: 6, wall: '#1d2c2e', frame: '#44605c', edge: '#ffb86b', litAll: 'each', lit: Object.assign({ 0: true }, ob.lit || {}), tint: Object.assign({ 0: '#ffd9a0' }, ob.tint || {}),
    wins: ob.wins, bays: ob.bays, parapet: 0, seed: seed * 3 + 2 });
  H.B = B;
  const coreB = { x: 28, w: 6.5, h: 44 };
  K.box(S, PB, coreB.x, 0, coreB.w, coreB.h, '#232c36', { mat: 'wall' });
  PB.add({ x0: coreB.x, x1: coreB.x + coreB.w, layer: 0, draw(ctx, env) {
    const lit = S.tone('#ffd9a0', PB, true), dk = S.tone('#141a22', PB);
    for (let f = 1; f < 12; f++) R4(ctx, coreB.x + 4.6, f * 3.6 + 0.8, 0.7, 1.9, (f * 7 + seed) % 3 === 0 ? lit : dk);
    R4(ctx, coreB.x + 0.5, B.roofY, 1.5, 2.35, lit); R4(ctx, coreB.x + 0.5, B.roofY, 1.5, 2.35, 'rgba(0,0,0,0.25)'); R4(ctx, coreB.x + 1.22, B.roofY, 0.06, 2.35, dk);   // the door onto the terrace
    R4(ctx, coreB.x, coreB.h, coreB.w, 0.5, S.tone('#39444f', PB));
    line(ctx, coreB.x + 5.2, coreB.h, coreB.x + 5.2, coreB.h + 7, dk, 0.14, env); twBeacon(ctx, env, coreB.x + 5.2, coreB.h + 7.2, 1.2);
  } });
  K.neon(S, PB, coreB.x + coreB.w / 2 - 0.4, coreB.h - 3.1, 'MERIDIAN', '#ff5a8a', 1.15);
  K.neon(S, PB, coreB.x + 1.25, B.roofY + 2.7, 'BAR', '#ffd27a', 0.6);
  H.coreB = coreB;
  H.terraceKit = K.twTerrace(S, PB, B, o.terrace || {});

  // ---- the Aurel tower ----
  const PA = S.plane(z0, 'aurel'); H.PA = PA;
  K.ground(S, PA, { col: '#2c3342', noEdge: true });
  const oa = o.A || {};
  const A = K.twTower(S, PA, { x: -27, w: 26, floors: 12, id: 'A', cols: 7, lit: Object.assign({ 0: true, 3: [[0, 2, true], [3, 6, false]], 5: true, 7: true, 10: [[0, 3, false], [4, 6, true]] }, oa.lit || {}),
    tint: Object.assign({ 0: '#ffe2b4', 10: '#ffe9c8' }, oa.tint || {}), wins: oa.wins, bays: oa.bays, lamps: oa.lamps, parapet: 0.3, seed: seed * 5 + 1 });
  H.A = A;
  // the service core: lifts, risers, and the junction boxes
  const coreA = { x: -1, w: 3.4, h: A.roofY + 3.6 };
  K.box(S, PA, coreA.x, 0, coreA.w, coreA.h, '#27303b', { mat: 'wall' });
  PA.add({ x0: coreA.x, x1: coreA.x + coreA.w, layer: 0, draw(ctx, env) {
    const lit = S.tone('#d6e6ff', PA, true), dk = S.tone('#141a22', PA), pipe = S.tone('#4a5562', PA);
    R4(ctx, coreA.x + 2.75, 0, 0.22, coreA.h, pipe); R4(ctx, coreA.x + 3.05, 0, 0.14, coreA.h - 2, pipe);
    for (let f = 0; f < 12; f++) R4(ctx, coreA.x + 0.4, f * 3.6 + 0.9, 0.5, 1.8, (f * 5 + seed) % 4 === 0 ? lit : dk);
    R4(ctx, coreA.x - 0.2, coreA.h, coreA.w + 0.4, 0.4, S.tone('#39444f', PA));
    if (env.s > 4) { ctx.fillStyle = dk; for (let i = 0; i < 6; i++) ctx.fillRect(coreA.x + 0.5, A.roofY + 0.9 + i * 0.36, 2.0, 0.14); }
    line(ctx, coreA.x + 1.7, coreA.h + 0.4, coreA.x + 1.7, coreA.h + 9, dk, 0.16, env); line(ctx, coreA.x + 1.0, coreA.h + 6, coreA.x + 2.4, coreA.h + 6, dk, 0.1, env);
    twBeacon(ctx, env, coreA.x + 1.7, coreA.h + 9.2, 0);
  } });
  PA.add({ x0: coreA.x, x1: coreA.x + coreA.w, layer: 1, draw(ctx, env) {
    const s = 'AUREL';
    for (let i = 0; i < s.length; i++) env.text(ctx, s.charAt(i), coreA.x + 1.72, A.roofY + 1.6 - i * 2.05, 1.75, '#8fe1ff', 'center', true);
  } });
  H.coreA = coreA; H.coreX = coreA.x + 1.75;
  // the lobby canopy and the firm's name over the doors
  PA.add({ x0: -27, x1: -1, layer: 1, draw(ctx, env) { R4(ctx, -18.6, 3.25, 9.2, 0.28, S.tone('#39444f', PA)); env.text(ctx, 'AUREL GROUP', -14, 3.75, 0.7, '#cfefff', 'center', true); } });
  // the window-cleaning cradle
  if (o.cradle !== false) {
    const oc = o.cradle || {};
    H.PCR = S.plane(z0 - 1.5, 'cradle');
    H.cradleKit = K.twCradle(S, H.PCR, { x: oc.x === undefined ? A.winX(1) : oc.x, y: A.floorY(oc.floor === undefined ? 11 : oc.floor) + (oc.dy || 0), top: A.roofY + 0.3 });
    H.cradle = (dx, extra) => H.cradleKit.at(dx, extra);
  }
  // the rooftop demonstration (only when the mission asks for it)
  if (o.demo) {
    const ry = A.roofY, D = H.demo = { y: ry, rigX: -24.4, capsX: -19.6, fuseX: -15.4, valveX: -10.2, camX: -6.5, hutX: -6.2, fireT: -99 };
    S.litZones['A:roof'] = false;
    D.lamps = [K.lamp(S, PA, -22.2, 4.3, 'A:roof', { id: 'rl1', y: ry + 0.3, reach: 9, arm: 0.9 }), K.lamp(S, PA, -9.2, 4.3, 'A:roof', { id: 'rl2', y: ry + 0.3, reach: 9.5, arm: -0.9 })];
    const steel = S.tone('#8f979e', PA), dark = S.tone('#20252d', PA), white = S.tone('#dfe5ea', PA), hut = S.tone('#3a4450', PA);
    PA.add({ x0: -27, x1: -1, layer: 0, draw(ctx, env) {
      const by = ry + 0.3;
      R4(ctx, D.hutX, by, 5.0, 2.9, hut); R4(ctx, D.hutX + 3.2, by, 1.1, 2.2, dark); R4(ctx, D.hutX - 0.1, by + 2.9, 5.2, 0.16, dark);              // stair hut
      R4(ctx, D.fuseX - 0.06, by, 0.12, 1.2, dark);                                                                                           // post under the breaker box
      R4(ctx, D.valveX - 2.5, by, 0.12, 1.05, dark); R4(ctx, D.valveX + 2.38, by, 0.12, 1.05, dark);                                           // pipe stands
      R4(ctx, D.capsX - 1.45, by, 2.9, 0.45, dark);                                                                                           // plinth under the capacitor bank
      // the prototype on its test stand, pointing out over the harbour
      line(ctx, D.rigX - 0.5, by, D.rigX, by + 1.25, dark, 0.1, env); line(ctx, D.rigX + 0.5, by, D.rigX, by + 1.25, dark, 0.1, env);
      R4(ctx, D.rigX - 1.75, by + 1.25, 2.6, 0.2, white); R4(ctx, D.rigX + 0.2, by + 1.1, 0.75, 0.5, dark); R4(ctx, D.rigX - 0.1, by + 1.45, 0.7, 0.16, dark);
      if (env.s > 5) { ctx.fillStyle = S.tone('#5fd4ff', PA, true); for (let i = 0; i < 5; i++) ctx.fillRect(D.rigX - 1.6 + i * 0.36, by + 1.22, 0.1, 0.26); }
      // heavy cable from the bank to the rifle
      ctx.strokeStyle = dark; ctx.lineWidth = Math.max(0.07, env.px * 0.9); ctx.beginPath(); ctx.moveTo(D.capsX - 1.3, by + 0.6); ctx.quadraticCurveTo(D.rigX + 1.6, by - 0.1, D.rigX + 0.6, by + 1.15); ctx.stroke();
      // yellow line the guests stand behind
      if (env.s > 3) R4(ctx, D.capsX + 2.2, by, 14, 0.06, S.tone('#e2b33c', PA, true));
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
  PS.add({ x0: 9, x1: 16, layer: 0, draw(ctx, env) {   // bus shelter with a lit advert
    const st = S.tone('#2a3038', PS); R4(ctx, 9.6, 0, 0.1, 2.5, st); R4(ctx, 14.3, 0, 0.1, 2.5, st); R4(ctx, 9.3, 2.5, 5.4, 0.14, st);
    ctx.fillStyle = 'rgba(150,195,230,0.10)'; ctx.fillRect(9.7, 0.3, 3.2, 2.2);
    R4(ctx, 13.0, 0.35, 1.25, 2.05, S.tone('#ffe9c8', PS, true)); env.text(ctx, 'CALDER', 13.62, 1.55, 0.26, S.tone('#b3312b', PS, true), 'center'); env.text(ctx, 'COLA', 13.62, 1.15, 0.3, S.tone('#b3312b', PS, true), 'center');
    R4(ctx, 10.0, 0.45, 2.4, 0.08, st);
  } });
  PS.add({ x0: -20, x1: -8, layer: 0, draw(ctx, env) {   // a steel ring on a plinth outside the Aurel doors
    R4(ctx, -15.4, 0, 2.8, 0.5, S.tone('#4a5562', PS)); ctx.strokeStyle = S.tone('#aab3bd', PS); ctx.lineWidth = Math.max(0.22, env.px);
    ctx.beginPath(); ctx.arc(-14, 2.0, 1.45, 0, TAU); ctx.stroke(); twGlow(ctx, -14, 0.7, 2.2, '#5fd4ff', 0.16);
  } });
  K.bench(S, PS, -24.5); K.bench(S, PS, 1.5);
  const PR = S.plane(z0 - 17, 'road'); H.PR = PR;
  K.ground(S, PR, { col: S.pal.road, stripes: 2.2, noEdge: true });
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
      // her desk, the typewriter and a lamp
      R4(ctx, wx - 0.72, fy + 0.68, 1.1, 0.07, dk); R4(ctx, wx - 0.66, fy + 0.4, 0.07, 0.28, dk);
      R4(ctx, wx - 0.28, fy + 0.75, 0.42, 0.16, ink); R4(ctx, wx - 0.2, fy + 0.91, 0.26, 0.2, paper);
      R4(ctx, wx - 0.6, fy + 0.75, 0.04, 0.34, ink); poly(ctx, [wx - 0.76, fy + 1.06, wx - 0.4, fy + 1.06, wx - 0.5, fy + 1.24, wx - 0.66, fy + 1.24], S.tone('#7fb86a', PF, true));
      R4(ctx, wx + 0.55, fy + 0.4, 0.5, 0.07, dk); R4(ctx, wx + 1.05, fy + 0.4, 0.08, 0.62, dk);                              // chair
    } });
  }
  H.nearLamps = [];
  (o.nearLamps || [-24, -2, 20, 42]).forEach((lx, i) => H.nearLamps.push(K.lamp(S, PF, lx, 5.6, 'near', { id: 'nlamp' + (i + 1), reach: 8 })));
  PF.add({ x0: -30, x1: 50, layer: 0, draw(ctx, env) {   // street furniture on the near pavement
    const st = S.tone('#2a3038', PF), red = S.tone('#a8322a', PF), blue = S.tone('#2f5d8a', PF);
    R4(ctx, -13.5, 0, 0.9, 2.3, red); R4(ctx, -13.35, 0.9, 0.6, 1.2, S.tone('#ffe9c8', PF, true)); R4(ctx, -13.6, 2.3, 1.1, 0.14, st);       // phone box
    R4(ctx, 8.6, 0, 0.6, 1.1, blue); R4(ctx, 8.5, 1.1, 0.8, 0.12, st);                                                                    // post box
    R4(ctx, 31.2, 0, 1.3, 1.0, S.tone('#3f6b4a', PF)); R4(ctx, 31.1, 1.0, 1.5, 0.1, st);                                                   // bin
    R4(ctx, -0.25, 0, 0.5, 0.75, red);                                                                                                    // hydrant
  } });

  // ---- close by: the roof you are shooting over, for depth ----
  const zN = Math.max(90, (z0 - 44) * 0.42), PN = S.plane(zN, 'nearroof'); H.PN = PN;
  const ny = eyeY - 13.5;
  PN.add({ x0: -400, x1: 400, layer: 0, draw(ctx, env) {
    const c = S.tone('#161b24', PN), c2 = S.tone('#222a36', PN);
    R4(ctx, -400, ny - 60, 800, 60, c); R4(ctx, -400, ny - 0.25, 800, 0.25, c2);
    R4(ctx, -zN * 0.19, ny, 4.2, 1.6, c); R4(ctx, -zN * 0.19 + 0.5, ny + 1.6, 1.2, 0.5, c2);
    line(ctx, -zN * 0.17, ny + 1.6, -zN * 0.17, ny + 5.5, c2, 0.07, env); line(ctx, -zN * 0.17 - 0.7, ny + 4.6, -zN * 0.17 + 0.7, ny + 4.6, c2, 0.05, env); line(ctx, -zN * 0.17 - 0.45, ny + 5.1, -zN * 0.17 + 0.45, ny + 5.1, c2, 0.05, env);
    R4(ctx, zN * 0.07, ny, 2.2, 0.9, c); R4(ctx, zN * 0.07 + 0.2, ny + 0.2, 1.8, 0.14, c2);
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
