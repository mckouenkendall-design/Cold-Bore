// ---------------------------------------------------------------------------
// Ready-made locations. Each returns the scene plus named handles (buildings,
// street plane, lamps) so a mission can say "third-floor window of the hotel"
// instead of juggling coordinates.
// ---------------------------------------------------------------------------
const SCN = {};

// wind tells: a flag and chimney smoke that lean with the wind
K.flag = function (S, P, x, y, h, col, o) {
  o = o || {}; const pole = S.tone('#c9ced3', P), c = S.tone(col || '#c0392b', P), c2 = S.tone(o.col2 || '#f1ede2', P), poleD = S.tone('#8d949a', P), brass = S.tone('#c9a23a', P);
  const n = 8, tx = new Array(n + 1), ty = new Array(n + 1), by = new Array(n + 1);
  P.add({ x0: x - 5, x1: x + 5, layer: o.layer === undefined ? 2 : o.layer, draw(ctx, env) {
    line(ctx, x, y, x, y + h, pole, 0.09, env);
    if (env.s > 9) { R4(ctx, x + 0.012, y, 0.035, h, poleD); circ(ctx, x, y + h + 0.07, 0.09, brass); R4(ctx, x - 0.14, y, 0.28, 0.14, poleD); line(ctx, x + 0.07, y + 0.9, x + 0.07, y + h - 0.1, poleD, 0.015, env); R4(ctx, x + 0.04, y + 0.86, 0.1, 0.06, poleD); }
    const w = env.wind, a = Math.min(1, Math.abs(w) / 6), dir = w >= 0 ? 1 : -1, len = 2.6, top = y + h - 0.1;
    // the cloth: its top and bottom edges ripple from the hoist outwards and hang lower as the wind drops
    for (let i = 0; i <= n; i++) { const u = i / n, droop = (1 - a) * u * u * 1.5, fl = Math.sin(env.t * (4 + a * 9) - u * 5) * 0.14 * (0.3 + a) * u; tx[i] = x + dir * u * len * (0.25 + 0.75 * a); ty[i] = top - droop + fl; by[i] = top - 1.3 - droop * 0.75 + fl; }
    ctx.beginPath(); ctx.moveTo(x, top);
    for (let i = 1; i <= n; i++) ctx.lineTo(tx[i], ty[i]);
    for (let i = n; i >= 0; i--) ctx.lineTo(tx[i], by[i]);
    ctx.closePath(); ctx.fillStyle = c; ctx.fill();
    ctx.strokeStyle = c2; ctx.lineWidth = Math.max(0.16, env.px);
    ctx.beginPath(); for (let i = 0; i <= n; i++) { const py = (ty[i] + by[i]) / 2; if (i === 0) ctx.moveTo(tx[i], py); else ctx.lineTo(tx[i], py); } ctx.stroke();
    if (env.s > 6) { // folds: each strip of cloth is lit or shaded by which way it is turned
      for (let i = 0; i < n; i++) { const slope = (ty[i + 1] - ty[i]) / Math.max(0.05, Math.abs(tx[i + 1] - tx[i])); const sh = clamp(-slope * 0.9, -0.2, 0.3); if (Math.abs(sh) < 0.03) continue; ctx.fillStyle = sh > 0 ? 'rgba(0,0,0,' + sh.toFixed(2) + ')' : 'rgba(255,255,255,' + (-sh * 0.7).toFixed(2) + ')'; ctx.beginPath(); ctx.moveTo(tx[i], ty[i]); ctx.lineTo(tx[i + 1], ty[i + 1]); ctx.lineTo(tx[i + 1], by[i + 1]); ctx.lineTo(tx[i], by[i]); ctx.closePath(); ctx.fill(); }
      R4(ctx, x - 0.01, top - 1.3, 0.05, 1.3, c2);
    }
  } });
};
K.chimney = function (S, P, x, y, o) {
  o = o || {}; const c = S.tone(o.col || '#5a4038', P), capC = S.tone('#3a2a25', P), potC = S.tone('#a5562f', P), night = S.pal.dark > 0.5;
  const smoke = night ? '#788296' : '#ebeef2';
  P.add({ x0: x - 14, x1: x + 14, layer: 0, draw(ctx, env) {
    const s = env.s;
    R4(ctx, x - 0.45, y, 0.9, 1.8, c);
    if (s > 9) { kxBrickFill(ctx, env, x - 0.45, y, 0.9, 1.6, 0.9); R4(ctx, x + 0.25, y, 0.2, 1.6, 'rgba(0,0,0,0.18)'); R4(ctx, x - 0.55, y, 1.1, 0.1, S.tone('#6c737a', P)); kxFadeAt(ctx, '#000000', x - 0.45, y + 1.6, 0.9, -0.8, 0.3); }
    R4(ctx, x - 0.55, y + 1.6, 1.1, 0.25, capC);
    if (s > 9) { R4(ctx, x - 0.62, y + 1.72, 1.24, 0.08, capC); R4(ctx, x - 0.3, y + 1.85, 0.24, 0.34, potC); R4(ctx, x + 0.08, y + 1.85, 0.24, 0.28, potC); R4(ctx, x - 0.33, y + 2.15, 0.3, 0.05, S.tone('#7d3f22', P)); R4(ctx, x + 0.05, y + 2.09, 0.3, 0.05, S.tone('#7d3f22', P)); }
    // smoke: soft puffs that swell, thin and lean with the wind
    for (let i = 0; i < 9; i++) { const u = ((env.t * 0.16 + i / 9) % 1), r = 0.4 + u * 1.9; kxPuff(ctx, smoke, x + env.wind * u * u * 3.2 + Math.sin(u * 6 + i) * 0.3, y + 2.2 + u * 6.5, r * 1.15, r, (1 - u) * (night ? 0.3 : 0.5) * Math.min(1, u * 8)); }
  } });
};
// A cable.  o.birds: how many small birds sit on it; o.layer; o.sway: false keeps it still.
K.wire = function (S, P, x0, y0, x1, y1, sag, o) {
  o = o || {};
  const c = S.tone('#14161a', P), sg = sag || 1.5, birds = [], D = makeRng(Math.floor(x0 * 7 + y0 * 13 + x1 * 3) + 411);
  for (let i = 0; i < (o.birds || 0); i++) birds.push([D.r(0.15, 0.85), D.f(), D.chance(0.5) ? 1 : -1]);
  P.add({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), layer: o.layer === undefined ? 2 : o.layer, draw(ctx, env) {
    const sw = o.sway === false ? 0 : Math.sin(env.t * 0.7 + x0) * 0.03 * sg * (0.4 + Math.abs(env.wind || 0) * 0.2), my = Math.min(y0, y1) - sg + sw, mx = (x0 + x1) / 2 + (env.wind || 0) * 0.02 * sg;
    ctx.strokeStyle = c; ctx.lineWidth = Math.max(0.03, env.px * 0.8);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
    if (birds.length && env.s > 5) { // birds: a body, a head and a tail, bobbing now and then
      ctx.fillStyle = c; ctx.beginPath();
      for (let i = 0; i < birds.length; i++) {
        const u = birds[i][0], bx = (1 - u) * (1 - u) * x0 + 2 * u * (1 - u) * mx + u * u * x1, byy = (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * my + u * u * y1, f = birds[i][2];
        if (bx < env.x0 - 1 || bx > env.x1 + 1) continue;
        const bob = Math.sin(env.t * 0.9 + birds[i][1] * 30) > 0.93 ? 0.03 : 0;
        ctx.moveTo(bx + 0.11, byy + 0.09); ctx.ellipse(bx, byy + 0.09, 0.11, 0.075, 0, 0, TAU); ctx.moveTo(bx + f * 0.1 + 0.05, byy + 0.17 + bob); ctx.arc(bx + f * 0.1, byy + 0.17 + bob, 0.05, 0, TAU);
        ctx.moveTo(bx - f * 0.08, byy + 0.1); ctx.lineTo(bx - f * 0.24, byy + 0.04); ctx.lineTo(bx - f * 0.08, byy + 0.04); ctx.closePath();
        ctx.moveTo(bx + f * 0.14, byy + 0.18 + bob); ctx.lineTo(bx + f * 0.2, byy + 0.16 + bob); ctx.lineTo(bx + f * 0.14, byy + 0.15 + bob); ctx.closePath();
      }
      ctx.fill();
    }
  } });
};
K.fountain = function (S, P, x, o) {
  o = o || {}; const st = S.tone('#b7b2a8', P), st2 = S.tone('#8f8a80', P), wt = S.tone(S.pal.water, P), y = o.y || 0, stH = S.tone('#d2cdc2', P), stD = S.tone('#6f6a62', P), wtH = S.tone(lighten(S.pal.water, 0.3), P);
  P.add({ x0: x - 5, x1: x + 5, layer: 0, draw(ctx, env) {
    const s = env.s, t = env.t;
    if (s > 5) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x, y + 0.02, 4.5, 0.12, 0, 0, TAU); ctx.fill(); }
    R4(ctx, x - 4, y, 8, 0.7, st); R4(ctx, x - 4.2, y + 0.6, 8.4, 0.18, st2); R4(ctx, x - 3.7, y + 0.7, 7.4, 0.12, wt);
    if (s > 8) { // the basin wall in panels, a moulded rim, a plinth course
      R4(ctx, x - 4.2, y + 0.74, 8.4, 0.04, stH); R4(ctx, x - 4.1, y, 8.2, 0.12, st2); kxFadeAt(ctx, '#000000', x - 4, y + 0.12, 8, 0.48, 0.16);
      ctx.fillStyle = stD; ctx.beginPath(); for (let i = 1; i < 8; i++) ctx.rect(x - 4 + i, y + 0.12, Math.max(0.025, env.px * 0.5), 0.48); ctx.fill();
      ctx.fillStyle = wtH; ctx.beginPath(); for (let i = 0; i < 9; i++) { const rx = x - 3.4 + i * 0.8 + Math.sin(t * 1.3 + i) * 0.15; ctx.rect(rx, y + 0.76 + (i % 2) * 0.03, 0.34, 0.018); } ctx.fill();
    }
    R4(ctx, x - 0.3, y + 0.7, 0.6, 2.4, st2); R4(ctx, x - 1.4, y + 2.6, 2.8, 0.22, st);
    if (s > 8) {
      // the stem: a base, a waist, a bowl with a lip, and a finial the water rises from
      R4(ctx, x - 0.5, y + 0.82, 1.0, 0.2, st); R4(ctx, x - 0.3, y + 0.82, 0.14, 1.8, stH); R4(ctx, x + 0.16, y + 0.82, 0.14, 1.8, stD); R4(ctx, x - 0.4, y + 1.7, 0.8, 0.1, st);
      poly(ctx, [x - 1.4, y + 2.6, x + 1.4, y + 2.6, x + 0.5, y + 2.36, x - 0.5, y + 2.36], st2); R4(ctx, x - 1.5, y + 2.78, 3.0, 0.07, stH); R4(ctx, x - 0.12, y + 2.82, 0.24, 0.36, st2); circ(ctx, x, y + 3.22, 0.12, st);
      R4(ctx, x - 1.3, y + 2.82, 2.6, 0.03, wtH);
    }
    // jets falling outwards, with spray where they land
    ctx.strokeStyle = 'rgba(225,240,250,0.7)'; ctx.lineWidth = Math.max(0.05, env.px);
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const sx = x + (i - 2.5) * 0.4, ph = (t * 1.5 + i * 0.37) % 1; ctx.moveTo(sx, y + 2.9); ctx.quadraticCurveTo(sx + (i - 2.5) * 0.5, y + 4.2 - ph * 0.3, sx + (i - 2.5) * 1.0, y + 0.85); } ctx.stroke();
    if (s > 8) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = Math.max(0.025, env.px * 0.6); ctx.beginPath(); for (let i = 0; i < 6; i++) { const lx = x + (i - 2.5) * 1.4; for (let k = 0; k < 3; k++) { const ph = (t * 2.2 + i * 0.3 + k * 0.33) % 1; ctx.moveTo(lx + (k - 1) * 0.12, y + 0.84); ctx.lineTo(lx + (k - 1) * (0.12 + ph * 0.3), y + 0.84 + ph * 0.3 * (1 - ph) * 3); } } ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); for (let i = 0; i < 12; i++) { const ph = (t * 0.9 + i * 0.083) % 1, a = (i * 2.4), dx = Math.sin(a) * (0.3 + ph * 1.6), dy = 3.1 + ph * 1.2 - ph * ph * 3.6; ctx.rect(x + dx, y + dy, 0.035, 0.035); } ctx.fill();
    }
  } });
  P.solid(x - 4, y, 8, 0.7, 'hard'); P.solid(x - 0.3, y + 0.7, 0.6, 2.2, 'hard');
};
K.stall = function (S, P, x, col, o) {
  o = o || {}; const y = o.y || 0, c = S.tone(col, P), c2 = S.tone('#f1ede2', P), wood = S.tone('#6b4f3a', P), woodD = S.tone('#4a3526', P), skirt = S.tone(darken(col, 0.35), P), skirtD = S.tone(darken(col, 0.5), P);
  const fruit = ['#d9482b', '#e8a23a', '#7fae45', '#d9482b', '#b56bb0'];
  P.add({ x0: x - 2.2, x1: x + 2.2, layer: o.layer || 0, draw(ctx, env) {
    const s = env.s;
    if (s > 5) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(x, y + 0.02, 2.2, 0.08, 0, 0, TAU); ctx.fill(); }
    line(ctx, x - 1.7, y, x - 1.7, y + 2.5, wood, 0.09, env); line(ctx, x + 1.7, y, x + 1.7, y + 2.5, wood, 0.09, env);
    R4(ctx, x - 1.8, y + 0.75, 3.6, 0.2, wood); R4(ctx, x - 1.8, y, 3.6, 0.75, skirt);
    if (s > 9) { // the cloth round the trestle hangs in folds; the counter has an edge
      ctx.fillStyle = skirtD; ctx.beginPath(); for (let i = 0; i < 9; i++) ctx.rect(x - 1.7 + i * 0.4, y, 0.1, 0.75); ctx.fill(); R4(ctx, x - 1.8, y + 0.9, 3.6, 0.05, S.tone('#84644a', P)); R4(ctx, x - 1.8, y + 0.75, 3.6, 0.04, woodD);
      kxFadeAt(ctx, '#000000', x - 2.1, y + 2.35, 4.2, -1.0, 0.22);
    }
    // the awning: stripes, then a scalloped hem
    for (let i = 0; i < 6; i++) poly(ctx, [x - 2.1 + i * 0.7, y + 2.9, x - 1.4 + i * 0.7, y + 2.9, x - 1.4 + i * 0.7, y + 2.35, x - 2.1 + i * 0.7, y + 2.35], i % 2 ? c2 : c);
    if (s > 9) {
      for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? c2 : c; ctx.beginPath(); ctx.moveTo(x - 2.1 + i * 0.7, y + 2.36); ctx.quadraticCurveTo(x - 1.75 + i * 0.7, y + 2.12, x - 1.4 + i * 0.7, y + 2.36); ctx.closePath(); ctx.fill(); }
      R4(ctx, x - 2.1, y + 2.84, 4.2, 0.06, 'rgba(255,255,255,0.2)'); R4(ctx, x - 2.1, y + 2.35, 4.2, 0.03, 'rgba(0,0,0,0.2)');
    }
    // produce: boxes tipped towards the customer, each heaped with one thing
    if (s > 9) { for (let i = 0; i < 5; i++) { const bx = x - 1.7 + i * 0.7; R4(ctx, bx, y + 0.95, 0.62, 0.16, woodD); R4(ctx, bx + 0.03, y + 0.98, 0.56, 0.03, wood); ctx.fillStyle = S.tone(fruit[i], P); ctx.beginPath(); for (let k = 0; k < 4; k++) { ctx.moveTo(bx + 0.14 + k * 0.13 + 0.085, y + 1.14 + (k % 2) * 0.04); ctx.arc(bx + 0.14 + k * 0.13, y + 1.14 + (k % 2) * 0.04, 0.085, 0, TAU); } ctx.fill(); }
      // a scale hanging from the frame and a price card
      line(ctx, x + 1.1, y + 2.35, x + 1.1, y + 1.95, woodD, 0.02, env); circ(ctx, x + 1.1, y + 1.82, 0.14, S.tone('#c9ced3', P)); R4(ctx, x + 0.92, y + 1.56, 0.36, 0.04, S.tone('#8d949a', P)); R4(ctx, x - 1.3, y + 1.45, 0.4, 0.26, c2);
    } else for (let i = 0; i < 5; i++) circ(ctx, x - 1.4 + i * 0.7, y + 1.08, 0.16, S.tone(fruit[i], P));
  } });
  P.solid(x - 1.8, y, 3.6, 0.95, 'wood');
};

// An elevated railway running across the view. Street level shows underneath.
K.viaduct = function (S, P, y, o) {
  o = o || {}; const steel = S.tone(o.col || '#3c4250', P), dark = S.tone('#20242c', P), x0 = o.x0 || -200, x1 = o.x1 || 200, base = o.base || 0;
  const steelH = S.tone(lighten(o.col || '#3c4250', 0.14), P), steelD = S.tone(darken(o.col || '#3c4250', 0.25), P), rust = S.tone('#6a3a28', P), conc = S.tone('#6f747c', P), night = S.pal.dark > 0.3;
  const pillars = o.pillars || [-42, -14, 14, 42];
  P.add({ x0, x1, layer: 0, draw(ctx, env) {
    const s = env.s, vx0 = Math.max(x0, env.x0), vx1 = Math.min(x1, env.x1), px = env.px;
    for (let i = 0; i < pillars.length; i++) {
      const pxx = pillars[i]; if (pxx + 3 < env.x0 || pxx - 3 > env.x1) continue;
      R4(ctx, pxx - 0.6, base, 1.2, y - base, steel); R4(ctx, pxx - 1.5, y - 1.2, 3, 1.2, steel); R4(ctx, pxx - 1.0, base, 2, 0.5, dark);
      if (s > 6) {
        // a built-up column: a lit flange, a shaded one, lacing between, a curved bracket under the girder, a concrete foot
        R4(ctx, pxx - 0.6, base + 0.5, 0.16, y - base - 1.7, steelH); R4(ctx, pxx + 0.4, base + 0.5, 0.2, y - base - 1.7, steelD);
        ctx.strokeStyle = steelD; ctx.lineWidth = Math.max(0.05, px * 0.6); ctx.beginPath();
        const l0 = env.y0 === undefined ? base + 0.6 : Math.max(base + 0.6, base + 0.6 + Math.floor((env.y0 - base - 0.6) / 0.9) * 0.9), l1 = Math.min(y - 1.3, env.y1 === undefined ? y : env.y1 + 1);
        for (let yy = l0; yy < l1; yy += 0.9) { ctx.moveTo(pxx - 0.4, yy); ctx.lineTo(pxx + 0.36, yy + 0.9 > y - 1.2 ? y - 1.2 : yy + 0.9); ctx.moveTo(pxx + 0.36, yy); ctx.lineTo(pxx - 0.4, yy + 0.9 > y - 1.2 ? y - 1.2 : yy + 0.9); }
        ctx.stroke();
        ctx.fillStyle = steel; ctx.beginPath(); for (const sx of [-1, 1]) { ctx.moveTo(pxx + sx * 0.6, y - 1.2); ctx.lineTo(pxx + sx * 2.6, y); ctx.lineTo(pxx + sx * 2.6, y - 0.25); ctx.quadraticCurveTo(pxx + sx * 1.1, y - 0.9, pxx + sx * 0.6, y - 2.6); ctx.closePath(); } ctx.fill();
        R4(ctx, pxx - 1.5, y - 1.2, 3, 0.08, steelD); R4(ctx, pxx - 1.15, base, 2.3, 0.6, conc); R4(ctx, pxx - 1.15, base + 0.55, 2.3, 0.05, S.tone('#8d939b', P));
        if (s > 12) { ctx.fillStyle = dark; ctx.beginPath(); for (let k = 0; k < 5; k++) { ctx.rect(pxx - 1.3 + k * 0.62, y - 0.42, 0.07, 0.07); ctx.rect(pxx - 1.3 + k * 0.62, y - 0.95, 0.07, 0.07); } ctx.fill(); ctx.fillStyle = rust; ctx.globalAlpha = 0.4; ctx.fillRect(pxx - 0.3, y - 3.4, 0.12, 2.2); ctx.fillRect(pxx + 0.12, y - 2.6, 0.1, 1.4); ctx.globalAlpha = 1; R4(ctx, pxx - 0.6, base + 0.6, 1.2, 0.5, '#d6a12a'); ctx.fillStyle = dark; ctx.beginPath(); for (let k = 0; k < 4; k++) { ctx.moveTo(pxx - 0.6 + k * 0.34, base + 0.6); ctx.lineTo(pxx - 0.43 + k * 0.34, base + 0.6); ctx.lineTo(pxx - 0.26 + k * 0.34, base + 1.1); ctx.lineTo(pxx - 0.43 + k * 0.34, base + 1.1); ctx.closePath(); } ctx.fill(); }
      }
    }
    // the deck girder
    R4(ctx, x0, y, x1 - x0, 1.3, steel); R4(ctx, x0, y + 1.3, x1 - x0, 0.25, dark);
    if (s > 1.5) {
      ctx.fillStyle = dark; ctx.beginPath(); const a = Math.floor(vx0 / 2.5) * 2.5; for (let x = a; x < vx1; x += 2.5) ctx.rect(x, y + 0.15, 0.22, 1.0); ctx.fill();
      if (s > 6) {
        // flanges top and bottom, a row of rivets, cross-bracing in each panel, the shade beneath
        R4(ctx, vx0, y + 1.16, vx1 - vx0, 0.14, steelH); R4(ctx, vx0, y, vx1 - vx0, 0.15, steelD);
        ctx.strokeStyle = steelD; ctx.lineWidth = Math.max(0.05, px * 0.6); ctx.beginPath(); for (let x = a; x < vx1; x += 2.5) { ctx.moveTo(x + 0.22, y + 0.17); ctx.lineTo(x + 2.5, y + 1.14); ctx.moveTo(x + 2.5, y + 0.17); ctx.lineTo(x + 0.22, y + 1.14); } ctx.stroke();
        kxFadeAt(ctx, '#000000', vx0, y, vx1 - vx0, -1.6, 0.32);
        if (s > 14) { ctx.fillStyle = steelH; ctx.beginPath(); const r0 = Math.floor(vx0 / 0.3) * 0.3; for (let x = r0; x < vx1; x += 0.3) { ctx.rect(x, y + 1.2, 0.05, 0.05); ctx.rect(x, y + 0.05, 0.05, 0.05); } ctx.fill(); ctx.fillStyle = rust; ctx.globalAlpha = 0.35; ctx.beginPath(); const s0 = Math.floor(vx0 / 3.7) * 3.7; for (let x = s0; x < vx1; x += 3.7) { const k = kxH(x, y); ctx.rect(x + k * 2, y + 0.15 - k * 0.5 - 0.2, 0.1 + k * 0.12, 0.2 + k * 0.5 + (k > 0.5 ? 0.5 : 0)); } ctx.fill(); ctx.globalAlpha = 1; }
      }
    }
    if (s > 6) { // sleepers, the rails, and the walkway boards on top
      R4(ctx, vx0, y + 1.55, vx1 - vx0, 0.07, S.tone('#8d949a', P));
      ctx.fillStyle = S.tone('#4a3a2c', P); ctx.beginPath(); const t0 = Math.floor(vx0 / 0.6) * 0.6; for (let x = t0; x < vx1; x += 0.6) ctx.rect(x, y + 1.42, 0.24, 0.13); ctx.fill();
    }
  } });
  P.add({ x0, x1, layer: 2, draw(ctx, env) {
    const s = env.s, vx0 = Math.max(x0, env.x0), vx1 = Math.min(x1, env.x1);
    ctx.strokeStyle = dark; ctx.lineWidth = Math.max(0.07, env.px * 0.8); ctx.beginPath(); ctx.moveTo(x0, y + 2.5); ctx.lineTo(x1, y + 2.5); const a = Math.floor(env.x0 / 3) * 3; for (let x = a; x < env.x1; x += 3) { ctx.moveTo(x, y + 1.5); ctx.lineTo(x, y + 2.5); } ctx.stroke();
    if (s > 6) { // a mid rail and thin uprights between the posts
      ctx.lineWidth = Math.max(0.03, env.px * 0.5); ctx.beginPath(); ctx.moveTo(vx0, y + 2.0); ctx.lineTo(vx1, y + 2.0); if (s > 14) { const b = Math.floor(vx0 / 0.5) * 0.5; for (let x = b; x < vx1; x += 0.5) { ctx.moveTo(x, y + 1.55); ctx.lineTo(x, y + 2.5); } } ctx.stroke();
    }
    // a signal on a post at one end, showing a colour after dark
    const sx = pillars[pillars.length - 1] - 6;
    if (sx > env.x0 - 2 && sx < env.x1 + 2 && s > 3) { line(ctx, sx, y + 1.5, sx, y + 4.4, dark, 0.09, env); R4(ctx, sx - 0.2, y + 3.5, 0.4, 0.95, dark); const g = Math.sin(env.t * 0.25) > -0.2; circ(ctx, sx, y + 4.2, 0.1, g ? S.tone('#2a3a2e', P) : '#ff4a3d'); circ(ctx, sx, y + 3.75, 0.1, g ? '#52e07a' : S.tone('#2a3a2e', P)); if (night && s > 5) kxGlow(ctx, g ? '#52e07a' : '#ff4a3d', sx, g ? y + 3.75 : y + 4.2, 0.6, 0.6); }
  } });
  pillars.forEach((px) => P.solid(px - 0.6, base, 1.2, y - base, 'hard'));
  P.solid(x0, y, x1 - x0, 1.5, 'hard');
  return { y: y + 1.55, P };
};

// ---- street dressing: flat things on walls, thin things on poles ---------------
// None of these stops a bullet or hides anyone. They go on the building plane, behind
// the people on the pavement, or they are thin enough that nobody would hide behind one.

// A bill pasted on a wall.  o.kind 0..3 picks the layout, o.col the paper, o.ink the print.
K.poster = function (S, P, x, y, w, h, o) {
  o = o || {}; const paper = S.tone(o.col || '#e9dcc0', P), ink = S.tone(o.ink || '#b3312b', P), ink2 = S.tone(o.ink2 || '#2a2e36', P), old = mix(paper, '#000000', 0.16), kind = o.kind || 0;
  P.add({ x0: x, x1: x + w, layer: o.layer || 0, draw(ctx, env) {
    const s = env.s; if (s < 5) return;
    R4(ctx, x, y, w, h, paper);
    if (s > 12) {
      if (kind === 0) { R4(ctx, x + w * 0.1, y + h * 0.62, w * 0.8, h * 0.26, ink); R4(ctx, x + w * 0.1, y + h * 0.42, w * 0.8, h * 0.05, ink2); R4(ctx, x + w * 0.1, y + h * 0.32, w * 0.6, h * 0.05, ink2); R4(ctx, x + w * 0.1, y + h * 0.1, w * 0.36, h * 0.14, ink); }
      else if (kind === 1) { circ(ctx, x + w * 0.5, y + h * 0.62, Math.min(w, h) * 0.26, ink); R4(ctx, x + w * 0.14, y + h * 0.2, w * 0.72, h * 0.06, ink2); R4(ctx, x + w * 0.24, y + h * 0.1, w * 0.52, h * 0.05, ink2); }
      else if (kind === 2) { R4(ctx, x, y + h * 0.72, w, h * 0.28, ink); poly(ctx, [x + w * 0.2, y + h * 0.2, x + w * 0.5, y + h * 0.62, x + w * 0.8, y + h * 0.2], ink2); R4(ctx, x + w * 0.15, y + h * 0.08, w * 0.7, h * 0.05, ink2); }
      else { ctx.fillStyle = ink2; for (let i = 0; i < 5; i++) ctx.fillRect(x + w * 0.12, y + h * (0.14 + i * 0.13), w * (0.76 - (i % 3) * 0.14), h * 0.05); R4(ctx, x + w * 0.12, y + h * 0.8, w * 0.5, h * 0.1, ink); }
      if (o.text) env.text(ctx, o.text, x + w / 2, y + h * (kind === 0 ? 0.68 : 0.84), Math.min(h * 0.16, (w / o.text.length) * 1.05), kind === 0 || kind === 2 ? paper : ink2, 'center');
      // a torn corner and the wrinkles left by the paste
      poly(ctx, [x + w, y + h, x + w - w * 0.2, y + h, x + w, y + h - h * 0.14], old); R4(ctx, x, y, w, Math.max(0.015, env.px * 0.5), old); R4(ctx, x + w * 0.33, y, Math.max(0.012, env.px * 0.4), h, 'rgba(0,0,0,0.08)');
    } else { R4(ctx, x + w * 0.1, y + h * 0.55, w * 0.8, h * 0.3, ink); }
  } });
};
// A scrawl of spray paint.
K.graffiti = function (S, P, x, y, w, col, seed) {
  const c = S.tone(col || '#d8d2c2', P), D = makeRng((seed || 1) * 613 + 7), pts = [];
  let cx = 0, cy = 0.5; for (let i = 0; i < 9; i++) { cx += D.r(0.06, 0.16); cy = clamp(cy + D.r(-0.6, 0.6), 0, 1); pts.push(cx, cy); }
  const sc = w / cx;
  P.add({ x0: x, x1: x + w, layer: 0, draw(ctx, env) {
    if (env.s < 9) return;
    ctx.strokeStyle = c; ctx.globalAlpha = 0.7; ctx.lineWidth = Math.max(0.035, env.px * 0.8); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y + 0.25 * w); for (let i = 0; i < pts.length; i += 2) ctx.quadraticCurveTo(x + (pts[i] - 0.05) * sc, y + (1 - pts[i + 1]) * w * 0.5, x + pts[i] * sc, y + pts[i + 1] * w * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - 0.03); ctx.lineTo(x + w * 0.8, y + 0.02); ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  } });
};
// A pillar box against the wall.
K.postBox = function (S, P, x, o) {
  o = o || {}; const y = o.y || 0, c = S.tone(o.col || '#b3312b', P), d = S.tone(darken(o.col || '#b3312b', 0.3), P), hi = S.tone(lighten(o.col || '#b3312b', 0.2), P), blk = S.tone('#1b1e24', P);
  P.add({ x0: x - 0.4, x1: x + 0.4, layer: 0, draw(ctx, env) {
    const s = env.s; if (s < 4) return;
    R4(ctx, x - 0.26, y, 0.52, 1.25, c);
    if (s > 10) {
      R4(ctx, x - 0.26, y, 0.1, 1.25, hi); R4(ctx, x + 0.12, y, 0.14, 1.25, d); R4(ctx, x - 0.3, y, 0.6, 0.16, blk);
      ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y + 1.25, 0.3, 0.14, 0, 0, Math.PI); ctx.fill(); R4(ctx, x - 0.3, y + 1.2, 0.6, 0.06, d);
      R4(ctx, x - 0.17, y + 0.98, 0.34, 0.05, blk); R4(ctx, x - 0.12, y + 0.56, 0.24, 0.26, S.tone('#f1ede2', P)); if (s > 30) { ctx.fillStyle = blk; for (let i = 0; i < 3; i++) ctx.fillRect(x - 0.09, y + 0.61 + i * 0.07, 0.18, 0.02); }
    } else R4(ctx, x - 0.3, y + 1.2, 0.6, 0.1, d);
  } });
};
// A fire hydrant.
K.hydrant = function (S, P, x, o) {
  o = o || {}; const y = o.y || 0, c = S.tone(o.col || '#c0392b', P), d = S.tone(darken(o.col || '#c0392b', 0.3), P), hi = S.tone(lighten(o.col || '#c0392b', 0.22), P);
  P.add({ x0: x - 0.4, x1: x + 0.4, layer: 0, draw(ctx, env) {
    const s = env.s; if (s < 5) return;
    R4(ctx, x - 0.13, y, 0.26, 0.6, c); R4(ctx, x - 0.18, y, 0.36, 0.08, d);
    if (s > 12) { R4(ctx, x - 0.13, y, 0.06, 0.6, hi); R4(ctx, x + 0.06, y, 0.07, 0.6, d); R4(ctx, x - 0.17, y + 0.42, 0.34, 0.06, d); R4(ctx, x - 0.24, y + 0.28, 0.1, 0.14, c); R4(ctx, x + 0.14, y + 0.28, 0.1, 0.14, c); R4(ctx, x - 0.27, y + 0.3, 0.04, 0.1, d); R4(ctx, x + 0.23, y + 0.3, 0.04, 0.1, d); }
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y + 0.6, 0.15, 0, Math.PI); ctx.fill(); R4(ctx, x - 0.04, y + 0.74, 0.08, 0.07, d);
  } });
};
// A bicycle leaning against the wall.
K.bicycle = function (S, P, x, o) {
  o = o || {}; const y = o.y || 0, c = S.tone(o.col || '#2f6b4a', P), blk = S.tone('#15171b', P), stl = S.tone('#9aa1a8', P), f = o.flip ? -1 : 1;
  P.add({ x0: x - 1.1, x1: x + 1.1, layer: 0, draw(ctx, env) {
    const s = env.s; if (s < 6) return;
    const r = 0.33, xa = x - f * 0.52, xb = x + f * 0.52, wy = y + r;
    ctx.strokeStyle = blk; ctx.lineWidth = Math.max(0.035, env.px * 0.7); ctx.beginPath(); ctx.arc(xa, wy, r, 0, TAU); ctx.moveTo(xb + r, wy); ctx.arc(xb, wy, r, 0, TAU); ctx.stroke();
    if (s > 16) { ctx.strokeStyle = stl; ctx.lineWidth = Math.max(0.008, env.px * 0.35); ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = (k * TAU) / 8; ctx.moveTo(xa, wy); ctx.lineTo(xa + Math.cos(a) * r, wy + Math.sin(a) * r); ctx.moveTo(xb, wy); ctx.lineTo(xb + Math.cos(a) * r, wy + Math.sin(a) * r); } ctx.stroke(); }
    // frame: two triangles, the fork, the bars and the saddle
    ctx.strokeStyle = c; ctx.lineWidth = Math.max(0.04, env.px * 0.8); ctx.lineJoin = 'round'; ctx.beginPath();
    ctx.moveTo(xa, wy); ctx.lineTo(x - f * 0.08, wy + 0.02); ctx.lineTo(x - f * 0.2, wy + 0.5); ctx.closePath(); ctx.moveTo(x - f * 0.08, wy + 0.02); ctx.lineTo(x + f * 0.36, wy + 0.5); ctx.lineTo(x - f * 0.2, wy + 0.5); ctx.moveTo(x + f * 0.36, wy + 0.5); ctx.lineTo(xb, wy); ctx.moveTo(x + f * 0.36, wy + 0.5); ctx.lineTo(x + f * 0.33, wy + 0.66);
    ctx.stroke(); ctx.lineJoin = 'miter';
    ctx.strokeStyle = blk; ctx.beginPath(); ctx.moveTo(x + f * 0.22, wy + 0.7); ctx.lineTo(x + f * 0.42, wy + 0.64); ctx.moveTo(x - f * 0.2, wy + 0.5); ctx.lineTo(x - f * 0.22, wy + 0.6); ctx.stroke();
    R4(ctx, x - f * 0.22 - 0.13, wy + 0.59, 0.26, 0.05, blk); if (s > 16) { circ(ctx, x - f * 0.08, wy + 0.02, 0.06, stl); line(ctx, x - f * 0.08, wy + 0.02, x - f * 0.02, wy - 0.14, stl, 0.02, env); }
  } });
};
// A dustbin.
K.bin = function (S, P, x, o) {
  o = o || {}; const y = o.y || 0, c = S.tone(o.col || '#7c858d', P), d = S.tone(darken(o.col || '#7c858d', 0.3), P), hi = S.tone(lighten(o.col || '#7c858d', 0.2), P);
  P.add({ x0: x - 0.5, x1: x + 0.5, layer: 0, draw(ctx, env) {
    const s = env.s; if (s < 5) return;
    poly(ctx, [x - 0.26, y, x + 0.26, y, x + 0.31, y + 0.8, x - 0.31, y + 0.8], c);
    if (s > 12) { ctx.fillStyle = d; ctx.beginPath(); for (let k = 0; k < 5; k++) ctx.rect(x - 0.22 + k * 0.11, y + 0.06, 0.025, 0.68); ctx.rect(x + 0.14, y, 0.14, 0.8); ctx.fill(); R4(ctx, x - 0.3, y + 0.52, 0.6, 0.035, d); R4(ctx, x - 0.27, y + 0.04, 0.06, 0.74, hi); }
    R4(ctx, x - 0.35, y + 0.8, 0.7, 0.08, d); ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y + 0.88, 0.3, 0.1, 0, 0, Math.PI); ctx.fill(); R4(ctx, x - 0.06, y + 0.96, 0.12, 0.05, d);
  } });
};
// Washing on a line between two points. The clothes swing with the wind.
K.clothesLine = function (S, P, x0, y0, x1, y1, o) {
  o = o || {}; const D = makeRng(Math.floor(x0 * 17 + y0 * 5) + 233), n = o.n || Math.max(2, Math.floor(Math.abs(x1 - x0) / 0.62)), items = [], rope = S.tone('#d8d2c2', P);
  const cols = ['#f1ede2', '#c9d6e6', '#d9482b', '#e8a23a', '#5f7a8c', '#f1ede2', '#8a5a5a', '#dfe9ee'];
  for (let i = 0; i < n; i++) items.push([(i + 0.5 + D.r(-0.15, 0.15)) / n, D.i(0, 3), S.tone(D.pick(cols), P), D.r(0.8, 1.2), D.f()]);
  P.add({ x0: Math.min(x0, x1) - 0.3, x1: Math.max(x0, x1) + 0.3, layer: o.layer === undefined ? 1 : o.layer, draw(ctx, env) {
    const s = env.s; if (s < 5) return;
    const sag = o.sag || 0.22, mx = (x0 + x1) / 2, my = Math.min(y0, y1) - sag;
    ctx.strokeStyle = rope; ctx.lineWidth = Math.max(0.015, env.px * 0.6); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
    if (s < 9) return;
    for (let i = 0; i < items.length; i++) {
      const q = items[i], u = q[0], px = (1 - u) * (1 - u) * x0 + 2 * u * (1 - u) * mx + u * u * x1, py = (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * my + u * u * y1;
      const sw = (env.wind || 0) * 0.02 + Math.sin(env.t * (1.3 + q[4]) + q[4] * 20) * 0.03 * (0.5 + Math.abs(env.wind || 0) * 0.3), k = q[3];
      ctx.fillStyle = q[2]; ctx.beginPath();
      if (q[1] === 0) { ctx.moveTo(px - 0.2 * k, py); ctx.lineTo(px + 0.2 * k, py); ctx.lineTo(px + 0.2 * k + sw, py - 0.52 * k); ctx.lineTo(px - 0.2 * k + sw, py - 0.52 * k); }                                         // a towel
      else if (q[1] === 1) { ctx.moveTo(px - 0.3 * k, py); ctx.lineTo(px + 0.3 * k, py); ctx.lineTo(px + 0.3 * k + sw * 0.4, py - 0.16 * k); ctx.lineTo(px + 0.17 * k + sw * 0.5, py - 0.14 * k); ctx.lineTo(px + 0.17 * k + sw, py - 0.5 * k); ctx.lineTo(px - 0.17 * k + sw, py - 0.5 * k); ctx.lineTo(px - 0.17 * k + sw * 0.5, py - 0.14 * k); ctx.lineTo(px - 0.3 * k + sw * 0.4, py - 0.16 * k); }   // a shirt
      else if (q[1] === 2) { ctx.moveTo(px - 0.15 * k, py); ctx.lineTo(px + 0.15 * k, py); ctx.lineTo(px + 0.17 * k + sw, py - 0.62 * k); ctx.lineTo(px + 0.03 * k + sw, py - 0.62 * k); ctx.lineTo(px + sw * 0.3, py - 0.2 * k); ctx.lineTo(px - 0.03 * k + sw, py - 0.62 * k); ctx.lineTo(px - 0.17 * k + sw, py - 0.62 * k); }   // trousers
      else { ctx.moveTo(px - 0.07 * k, py); ctx.lineTo(px + 0.07 * k, py); ctx.lineTo(px + 0.08 * k + sw, py - 0.3 * k); ctx.lineTo(px - 0.02 * k + sw, py - 0.34 * k); ctx.lineTo(px - 0.08 * k + sw, py - 0.26 * k); }      // a sock
      ctx.closePath(); ctx.fill();
      if (s > 22) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(px - 0.02, py - 0.02, 0.04, 0.07); }
    }
  } });
};
// A sign on a thin pole.  o.kind: 'stop' (round, red rim), 'bus' (a small flag), 'name' (a street name plate).
K.signPost = function (S, P, x, o) {
  o = o || {}; const y = o.y || 0, h = o.h || 2.9, pole = S.tone('#565c66', P), kind = o.kind || 'stop', wht = S.tone('#f1ede2', P), red = S.tone('#c0392b', P), blu = S.tone('#27457a', P), night = S.pal.dark > 0.5;
  P.add({ x0: x - 1.2, x1: x + 1.2, layer: o.layer || 0, draw(ctx, env) {
    const s = env.s; if (s < 4) return;
    line(ctx, x, y, x, y + h, pole, 0.06, env);
    if (kind === 'stop') { circ(ctx, x, y + h - 0.28, 0.28, red); if (s > 9) { circ(ctx, x, y + h - 0.28, 0.2, wht); R4(ctx, x - 0.15, y + h - 0.31, 0.3, 0.06, red); if (s > 12) R4(ctx, x - 0.22, y + h - 0.86, 0.44, 0.22, wht); } }
    else if (kind === 'bus') { R4(ctx, x, y + h - 0.5, 0.6, 0.46, blu); if (s > 9) { R4(ctx, x + 0.06, y + h - 0.44, 0.48, 0.34, wht); env.text(ctx, o.text || '14', x + 0.3, y + h - 0.4, 0.24, blu, 'center'); R4(ctx, x - 0.02, y + 1.2, 0.34, 0.5, wht); if (s > 24) { ctx.fillStyle = pole; for (let i = 0; i < 5; i++) ctx.fillRect(x + 0.03, y + 1.27 + i * 0.08, 0.24, 0.02); } } }
    else { const w = 0.3 + (o.text || 'CALDER ST').length * 0.105; R4(ctx, x + 0.04, y + h - 0.3, w, 0.26, blu); if (s > 9) { ctx.strokeStyle = wht; ctx.lineWidth = Math.max(0.012, env.px * 0.5); ctx.strokeRect(x + 0.065, y + h - 0.275, w - 0.05, 0.21); env.text(ctx, o.text || 'CALDER ST', x + 0.04 + w / 2, y + h - 0.235, 0.15, night ? wht : wht, 'center'); } }
  } });
};
// Extra shapes along a far skyline: tall factory chimneys that smoke, a gas holder, dock cranes.
//   o.stacks [[x, height], ...]   o.holder [x, height, width]   o.cranes [[x, height, reach], ...]
K.skyExtras = function (S, P, o) {
  o = o || {}; const base = o.base || 0, c = S.tone(o.col || '#454f5e', P), c2 = mix(c, '#000000', 0.16), night = S.pal.dark > 0.3, stacks = o.stacks || [], cranes = o.cranes || [], smoke = night ? '#56607a' : S.time === 'dusk' ? '#d8a48c' : '#e4e8ee';
  let x0 = 1e9, x1 = -1e9; stacks.forEach((q) => { x0 = Math.min(x0, q[0] - 80); x1 = Math.max(x1, q[0] + 80); }); cranes.forEach((q) => { x0 = Math.min(x0, q[0] - q[2] - 10); x1 = Math.max(x1, q[0] + q[2] + 10); }); if (o.holder) { x0 = Math.min(x0, o.holder[0] - o.holder[2]); x1 = Math.max(x1, o.holder[0] + o.holder[2]); }
  const item = { x0, x1, layer: 0, draw(ctx, env) {
    const s = env.s, lw = Math.max(0.5, env.px);
    for (let i = 0; i < stacks.length; i++) {
      const q = stacks[i], sx = q[0], h = q[1], w = h * 0.07; if (sx < env.x0 - 90 || sx > env.x1 + 90) continue;
      poly(ctx, [sx - w, base, sx + w, base, sx + w * 0.62, base + h, sx - w * 0.62, base + h], c);
      if (s > 0.8) { poly(ctx, [sx + w * 0.3, base, sx + w, base, sx + w * 0.62, base + h, sx + w * 0.2, base + h], c2); R4(ctx, sx - w * 0.72, base + h - h * 0.03, w * 1.44, h * 0.03, c2); if (s > 2) { ctx.fillStyle = c2; for (let k = 1; k < 5; k++) ctx.fillRect(sx - w * (1 - k * 0.07), base + h * k * 0.2, w * 2 * (1 - k * 0.07), h * 0.008); } }
      // smoke drifting off the top
      for (let k = 0; k < 7; k++) { const u = (env.t * 0.03 + k / 7 + i * 0.37) % 1, r = h * (0.07 + u * 0.3); kxPuff(ctx, smoke, sx + (env.wind || 1) * u * h * 0.5 + Math.sin(u * 7 + k) * h * 0.03, base + h + u * h * 0.5 + r * 0.4, r * 1.3, r, (1 - u) * 0.42 * Math.min(1, u * 6)); }
      if (night && Math.sin(env.t * 1.3 + i * 2.1) > 0) { circ(ctx, sx, base + h + 1, Math.max(0.8, env.px * 1.2), '#ff4a3d'); if (s > 0.6) kxGlow(ctx, '#ff4a3d', sx, base + h + 1, Math.max(4, env.px * 5), 0.5); }
    }
    if (o.holder) { // the gas holder: a drum inside a ring of lattice columns
      const hx = o.holder[0], hh = o.holder[1], hw = o.holder[2];
      if (hx + hw > env.x0 && hx - hw < env.x1) {
        R4(ctx, hx - hw * 0.86, base, hw * 1.72, hh * 0.62, c); if (s > 0.8) { R4(ctx, hx + hw * 0.4, base, hw * 0.46, hh * 0.62, c2); R4(ctx, hx - hw * 0.86, base + hh * 0.3, hw * 1.72, hh * 0.015, c2); }
        ctx.strokeStyle = c; ctx.lineWidth = Math.max(lw, hh * 0.012); ctx.beginPath(); for (let k = 0; k <= 6; k++) { const cx = hx - hw + (k * hw * 2) / 6; ctx.moveTo(cx, base); ctx.lineTo(cx, base + hh); } ctx.moveTo(hx - hw, base + hh); ctx.lineTo(hx + hw, base + hh); ctx.moveTo(hx - hw, base + hh * 0.72); ctx.lineTo(hx + hw, base + hh * 0.72); ctx.stroke();
        if (s > 1.5) { ctx.lineWidth = lw * 0.7; ctx.beginPath(); for (let k = 0; k < 6; k++) { const ca = hx - hw + (k * hw * 2) / 6, cb = ca + (hw * 2) / 6; ctx.moveTo(ca, base + hh * 0.72); ctx.lineTo(cb, base + hh); ctx.moveTo(cb, base + hh * 0.72); ctx.lineTo(ca, base + hh); } ctx.stroke(); }
      }
    }
    for (let i = 0; i < cranes.length; i++) { // dock cranes: a tower, a boom raised at an angle, a back stay
      const q = cranes[i], cx = q[0], h = q[1], r = q[2]; if (cx + r < env.x0 - 10 || cx - r > env.x1 + 10) continue;
      ctx.strokeStyle = c; ctx.lineWidth = Math.max(lw * 1.4, h * 0.02); ctx.beginPath(); ctx.moveTo(cx - h * 0.09, base); ctx.lineTo(cx - h * 0.03, base + h * 0.7); ctx.moveTo(cx + h * 0.09, base); ctx.lineTo(cx + h * 0.03, base + h * 0.7); ctx.moveTo(cx, base + h * 0.7); ctx.lineTo(cx + r, base + h); ctx.moveTo(cx, base + h * 0.7); ctx.lineTo(cx - r * 0.3, base + h * 0.62); ctx.stroke();
      ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(cx, base + h * 0.92); ctx.lineTo(cx + r, base + h); ctx.moveTo(cx, base + h * 0.92); ctx.lineTo(cx - r * 0.3, base + h * 0.62); ctx.moveTo(cx, base + h * 0.7); ctx.lineTo(cx, base + h * 0.92); ctx.moveTo(cx + r, base + h); ctx.lineTo(cx + r, base + h * 0.55); ctx.stroke();
      R4(ctx, cx - h * 0.06, base + h * 0.6, h * 0.12, h * 0.1, c);
      if (night && Math.sin(env.t * 1.7 + i) > 0.2) circ(ctx, cx + r, base + h + 0.6, Math.max(0.7, env.px * 1.1), '#ff4a3d');
    }
  } };
  item.layer = 0; P.items.push(item);
  return item;
};
// A row of low works buildings in the middle distance, seen past the ends of a street:
// sheds with saw-tooth roofs, gabled warehouses, a flat-roofed works with a tank on top, the
// odd chimney stack, loading doors and a few windows lit after dark. Scenery only: no solids,
// no openings, nothing anyone stands on. It adds no plane of its own (that would change the
// mission): it is painted on the farther plane P as it would look standing zv metres out,
// worked out from where the eye is.  o.seed, o.x0, o.x1, o.hMax (keep it low enough to stay
// hidden behind the street in front of it). In front of the works lies its yard, from zv back
// towards o.yardNear: a fence, two railway sidings with a few goods wagons, stacks of
// containers, yard lamps. All of it far behind anybody in the street.
K.worksRow = function (S, P, zv, o) {
  o = o || {}; const TP = { haze: S.haze(zv) };
  const D = makeRng((o.seed || 1) * 389 + 17), list = [], night = S.pal.dark > 0.3, hMax = o.hMax || 11.5;
  const walls = ['#6b4a3e', '#5d5048', '#4f5560', '#6a5a48', '#5a4440', '#55504a'], roofs = ['#3a3e46', '#46423e', '#3e4a52', '#4a3f3a'];
  const lit = S.tone(S.pal.lit, TP, true), dkW = S.tone(S.pal.glass, TP), dark = S.tone('#1e2128', TP);
  let x = o.x0 === undefined ? -420 : o.x0; const xEnd = o.x1 === undefined ? 420 : o.x1;
  while (x < xEnd) {
    const w = D.r(14, 38), h = D.r(5.5, hMax - 1.5), kind = D.pick([0, 0, 1, 1, 2, 3]), b = { x, w, h, kind, col: S.tone(D.pick(walls), TP), roof: S.tone(D.pick(roofs), TP), wins: [], bays: [] };
    b.col2 = mix(b.col, '#000000', 0.18); b.roof2 = mix(b.roof, '#000000', 0.2); b.hi = mix(b.roof, '#ffffff', 0.12);
    const nw = Math.floor((w - 2) / 2.4);
    for (let i = 0; i < nw; i++) b.wins.push([x + 1.4 + i * 2.4, h * 0.55, night && D.chance(S.pal.litChance * 0.6)]);
    if (D.chance(0.7)) b.bays.push(x + D.r(1.5, w - 5));
    if (D.chance(0.3)) b.stack = [x + D.r(2, w - 2), D.r(6, 12)];
    if (kind === 2 && D.chance(0.5)) b.tank = x + D.r(3, w - 4);
    list.push(b); x += w + D.r(0.5, 7);
  }
  const fogC = S.pal.fog;
  const lx0 = list.length ? list[0].x : 0, lx1 = x;
  // the yard, from its own stream so the works above never change
  const Y = makeRng((o.seed || 1) * 977 + 41), zN = o.yardNear === undefined ? zv - 125 : o.yardNear, TN = (d) => ({ haze: S.haze(d) });
  const dF = zv - 9, dT = [zv - 34, zv - 52], dC = zv - 78, dL = zv - 64;
  const ground = S.tone(o.groundCol || '#6d7986', P), strips = [];
  for (let d = zN; d < zv - 4; d += Y.r(12, 26)) strips.push([d, Math.min(zv - 4, d + Y.r(6, 14)), mix(ground, Y.chance(0.5) ? '#000000' : '#ffffff', Y.r(0.06, 0.12))]);
  // nearest of all, the back wall of the yards behind the street, and stacks of timber and pipe
  const dW = zN + 6, dS = zv - 100, wallC = S.tone('#6b4a3e', TN(dW)), wallD = mix(wallC, '#000000', 0.25), wallH = mix(wallC, '#ffffff', 0.12), stacks = [];
  for (let i = 0; i < 8; i++) stacks.push([(i % 2 ? 1 : -1) * Y.r(56, 260), Y.i(0, 1), Y.r(3, 7), Y.r(0.8, 1.8)]);
  const timber = S.tone('#7a5a3a', TN(dS)), pipe = S.tone('#5d6670', TN(dS));
  const steel = S.tone('#2a2e36', TN(dT[0])), railHi = S.tone('#8d949a', TN(dT[0])), sleeper = S.tone('#3a3026', TN(dT[0])), fenceC = S.tone('#3a3f47', TN(dF));
  const wagons = [], boxes = [], lamps = [];
  for (let i = 0; i < 9; i++) { const side = i % 2 ? 1 : -1, wx = side * Y.r(70, 330); wagons.push([wx, Y.i(0, 1), S.tone(Y.pick(['#6a3a2a', '#4a4f3a', '#5a4030', '#3f4a55']), TN(dT[0])), Y.i(2, 4)]); }
  for (let i = 0; i < 10; i++) { const side = i % 2 ? 1 : -1, bx = side * Y.r(64, 300), n = Y.i(1, 3), cols = []; for (let j = 0; j < n; j++) cols.push(S.tone(Y.pick(['#b3312b', '#27457a', '#2f6b4a', '#c9a23a', '#7a7f86', '#a8573a']), TN(dC))); boxes.push([bx, cols]); }
  for (let i = 0; i < 6; i++) lamps.push((i % 2 ? 1 : -1) * Y.r(60, 280));
  const night2 = S.pal.dark > 0.3, wagonDk = S.tone('#15171b', TN(dT[0]));
  P.add({ x0: -1e5, x1: 1e5, layer: 0, draw(ctx, env) {
    const e = kxSee(env, P); if (!e.ok || zN - e.ez < 20) return;
    // depth d to this plane: scale and offset
    const K_ = (d) => (P.z - e.ez) / (d - e.ez), at = (d) => { const kd = K_(d); ctx.save(); ctx.translate(e.ex * (1 - kd), e.ey * (1 - kd)); ctx.scale(kd, kd); return kd; };
    const vxAt = (d, xp) => { const kd = K_(d); return (xp - e.ex * (1 - kd)) / kd; };
    // the ground of the yard: broad patches of concrete and cinders
    for (let i = 0; i < strips.length; i++) { const q = strips[i], ya = e.ey + (0 - e.ey) * K_(q[0]), yb = e.ey + (0 - e.ey) * K_(q[1]); R4(ctx, env.x0, ya, env.x1 - env.x0, yb - ya, q[2]); }
    if (env.s * K_(zN) < 0.6) return;
    { // the works themselves, standing zv out
    const k = K_(zv), s = env.s * k, ox = e.ex * (1 - k), oy = e.ey * (1 - k), vx0 = (env.x0 - ox) / k, vx1 = (env.x1 - ox) / k;
    ctx.save(); ctx.translate(ox, oy); ctx.scale(k, k);
    for (let i = 0; i < list.length; i++) {
      const b = list[i]; if (b.x + b.w < vx0 - 4 || b.x > vx1 + 4) continue;
      const x0 = b.x, x1 = b.x + b.w, h = b.h;
      R4(ctx, x0, 0, b.w, h, b.col);
      // the roof: a row of north lights, a pitched roof, a flat roof with a parapet, or a barrel vault
      if (b.kind === 0) { const n = Math.max(2, Math.round(b.w / 4)), tw = b.w / n; ctx.fillStyle = b.roof; ctx.beginPath(); for (let k = 0; k < n; k++) { ctx.moveTo(x0 + k * tw, h); ctx.lineTo(x0 + k * tw + tw * 0.8, h + 2.2); ctx.lineTo(x0 + (k + 1) * tw, h + 2.2); ctx.lineTo(x0 + (k + 1) * tw, h); ctx.closePath(); } ctx.fill(); if (s > 2) { ctx.fillStyle = night ? lit : dkW; ctx.beginPath(); for (let k = 0; k < n; k++) ctx.rect(x0 + k * tw + tw * 0.82, h + 0.3, tw * 0.16, 1.7); ctx.globalAlpha = night ? 0.55 : 0.8; ctx.fill(); ctx.globalAlpha = 1; } }
      else if (b.kind === 1) { const rh = Math.min(4.2, b.w * 0.15); poly(ctx, [x0 - 0.4, h, x1 + 0.4, h, (x0 + x1) / 2, h + rh], b.roof); poly(ctx, [(x0 + x1) / 2, h + rh, x1 + 0.4, h, (x0 + x1) / 2 + 0.6, h], b.roof2); }
      else if (b.kind === 2) { R4(ctx, x0 - 0.2, h, b.w + 0.4, 0.6, b.roof); if (b.tank) { R4(ctx, b.tank, h + 0.6, 2.4, 2.6, b.roof2); poly(ctx, [b.tank - 0.3, h + 3.2, b.tank + 2.7, h + 3.2, b.tank + 1.2, h + 4.2], b.roof2); } }
      else { ctx.fillStyle = b.roof; ctx.beginPath(); ctx.moveTo(x0, h); ctx.quadraticCurveTo((x0 + x1) / 2, h + Math.min(7, b.w * 0.24), x1, h); ctx.closePath(); ctx.fill(); }
      if (b.stack) { R4(ctx, b.stack[0] - 0.5, h, 1.0, b.stack[1] + 2, b.col2); R4(ctx, b.stack[0] - 0.62, h + b.stack[1] + 1.6, 1.24, 0.4, b.roof2); }
      if (s > 1.2) {
        // a shaded end wall, a band of windows under the eaves, loading doors at the foot
        R4(ctx, x1 - Math.min(1.2, b.w * 0.08), 0, Math.min(1.2, b.w * 0.08), h, b.col2);
        ctx.fillStyle = dkW; ctx.beginPath(); for (let k = 0; k < b.wins.length; k++) if (!b.wins[k][2]) ctx.rect(b.wins[k][0], b.wins[k][1], 1.3, h * 0.25); ctx.fill();
        ctx.fillStyle = lit; ctx.beginPath(); let anyLit = false; for (let k = 0; k < b.wins.length; k++) if (b.wins[k][2]) { anyLit = true; ctx.rect(b.wins[k][0], b.wins[k][1], 1.3, h * 0.25); } if (anyLit) ctx.fill();
        ctx.fillStyle = dark; ctx.beginPath(); for (let k = 0; k < b.bays.length; k++) ctx.rect(b.bays[k], 0, 3.2, Math.min(4, h * 0.55)); ctx.fill();
        if (s > 4) { R4(ctx, x0, h - 0.25, b.w, 0.25, b.col2); ctx.fillStyle = b.hi; ctx.beginPath(); for (let k = 0; k < b.bays.length; k++) for (let r = 1; r < 6; r++) ctx.rect(b.bays[k], (Math.min(4, h * 0.55) * r) / 6, 3.2, Math.max(0.05, 0.6 / s)); ctx.globalAlpha = 0.3; ctx.fill(); ctx.globalAlpha = 1; }
      }
    }
    // the foot of the row in the haze
    const xa = Math.max(vx0, lx0), xb = Math.min(vx1, lx1); if (xb > xa) kxFadeAt(ctx, fogC, xa, 0, xb - xa, hMax * 0.9, o.haze === undefined ? 0.3 : o.haze);
    ctx.restore();
    }
    // the fence along the front of the works: posts, a top rail and a faint mesh
    { const kd = at(dF), fx0 = vxAt(dF, env.x0) - 2, fx1 = vxAt(dF, env.x1) + 2, sd = env.s * kd;
      if (sd > 1.5) { ctx.strokeStyle = fenceC; ctx.lineWidth = Math.max(0.06, 0.9 / sd); ctx.beginPath(); ctx.moveTo(fx0, 2.2); ctx.lineTo(fx1, 2.2); for (let fx = Math.floor(fx0 / 3) * 3; fx < fx1; fx += 3) { ctx.moveTo(fx, 0); ctx.lineTo(fx, 2.3); } ctx.stroke(); if (sd > 3) { ctx.fillStyle = fenceC; ctx.globalAlpha = 0.18; ctx.fillRect(fx0, 0, fx1 - fx0, 2.2); ctx.globalAlpha = 1; } }
      ctx.restore(); }
    // two sidings, each with a few goods wagons standing on it
    for (let t = 0; t < 2; t++) {
      const d = dT[t], kd = at(d), sd = env.s * kd, tx0 = vxAt(d, env.x0) - 2, tx1 = vxAt(d, env.x1) + 2;
      for (let i = 0; i < wagons.length; i++) {
        const q = wagons[i]; if (q[1] !== t || q[0] + 6 < tx0 || q[0] - 6 > tx1) continue;
        for (let j = 0; j < q[3]; j++) { const wx = q[0] + j * 9.6; R4(ctx, wx - 4.5, 0.9, 9, 3, q[2]); if (sd > 2) { R4(ctx, wx - 4.5, 3.75, 9, 0.15, wagonDk); R4(ctx, wx - 0.9, 1.1, 1.8, 2.5, mix(q[2], '#000000', 0.25)); ctx.fillStyle = wagonDk; ctx.beginPath(); for (const bx of [wx - 3, wx - 2, wx + 2, wx + 3]) { ctx.moveTo(bx + 0.42, 0.42); ctx.arc(bx, 0.42, 0.42, 0, TAU); } ctx.fill(); } }
      }
      if (sd > 1) { // rails on the ground in front of the wagons: two lines with sleepers between
        const yA = e.ey + (0 - e.ey) * (K_(d - 0.7) / kd), yB = e.ey + (0 - e.ey) * (K_(d + 0.7) / kd);   // the near and far rail, as heights on this card
        if (sd > 4) { ctx.fillStyle = sleeper; ctx.beginPath(); for (let sx = Math.floor(tx0 / 0.7) * 0.7; sx < tx1; sx += 0.7) ctx.rect(sx, yA - 0.05, 0.26, yB - yA + 0.1); ctx.fill(); }
        ctx.fillStyle = steel; ctx.fillRect(tx0, yA, tx1 - tx0, Math.max(0.05, 0.9 / sd)); ctx.fillRect(tx0, yB, tx1 - tx0, Math.max(0.05, 0.9 / sd));
        if (sd > 3) { ctx.fillStyle = railHi; ctx.globalAlpha = 0.5; ctx.fillRect(tx0, yA + 0.05, tx1 - tx0, Math.max(0.02, 0.5 / sd)); ctx.fillRect(tx0, yB + 0.05, tx1 - tx0, Math.max(0.02, 0.5 / sd)); ctx.globalAlpha = 1; }
      }
      ctx.restore();
    }
    // yard lamps on tall poles
    { const kd = at(dL), sd = env.s * kd, lx0v = vxAt(dL, env.x0) - 2, lx1v = vxAt(dL, env.x1) + 2;
      for (let i = 0; i < lamps.length; i++) { const lx = lamps[i]; if (lx < lx0v || lx > lx1v) continue; line(ctx, lx, 0, lx, 9, fenceC, Math.max(0.12, 0.8 / sd)); R4(ctx, lx - 0.5, 8.9, 1.0, 0.3, fenceC); if (night2) { circ(ctx, lx, 8.8, 0.22, '#fff0c4'); kxGlow(ctx, '#ffd98a', lx, 8.6, 3.2, 0.45 * S.pal.dark); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.12 * S.pal.dark; ctx.drawImage(kxPool('#ffd98a'), lx - 7, -0.6, 14, 1.2); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
      ctx.restore(); }
    // timber and pipe in stacks on the ground
    { const kd = at(dS), sd = env.s * kd, sx0 = vxAt(dS, env.x0) - 8, sx1 = vxAt(dS, env.x1) + 8;
      if (sd > 0.8) for (let i = 0; i < stacks.length; i++) {
        const q = stacks[i]; if (q[0] + q[2] < sx0 || q[0] > sx1) continue;
        if (q[1]) { R4(ctx, q[0], 0, q[2], q[3], timber); if (sd > 3) { ctx.fillStyle = mix(timber, '#000000', 0.25); ctx.beginPath(); for (let r = 0.25; r < q[3]; r += 0.3) ctx.rect(q[0], r, q[2], 0.04); ctx.fill(); R4(ctx, q[0] - 0.1, -0.1, 0.25, 0.2, wagonDk); R4(ctx, q[0] + q[2] - 0.15, -0.1, 0.25, 0.2, wagonDk); } }
        else { ctx.fillStyle = pipe; ctx.beginPath(); const r = 0.32; for (let row = 0; row * r * 1.7 < q[3]; row++) for (let c = 0; c < Math.floor(q[2] / (r * 2)) - row; c++) { const px = q[0] + r + row * r + c * r * 2, py = r + row * r * 1.7; ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, TAU); } ctx.fill(); }
      }
      ctx.restore(); }
    // stacks of containers nearer still
    { const kd = at(dC), sd = env.s * kd, cx0 = vxAt(dC, env.x0) - 4, cx1 = vxAt(dC, env.x1) + 4;
      for (let i = 0; i < boxes.length; i++) {
        const q = boxes[i]; if (q[0] + 4 < cx0 || q[0] - 4 > cx1) continue;
        for (let j = 0; j < q[1].length; j++) { const c = q[1][j], by = j * 2.6; R4(ctx, q[0] - 3.05 + (j % 2) * 0.4, by, 6.1, 2.6, c); if (sd > 2) { ctx.fillStyle = mix(c, '#000000', 0.22); ctx.beginPath(); for (let rx = 0.4; rx < 6; rx += 0.5) ctx.rect(q[0] - 3.05 + (j % 2) * 0.4 + rx, by + 0.15, 0.12, 2.3); ctx.rect(q[0] - 3.05 + (j % 2) * 0.4, by, 6.1, 0.12); ctx.fill(); } }
      }
      ctx.restore(); }
    // the back wall of the yards behind the street: brick, with piers and a coping
    { const kd = at(dW), sd = env.s * kd, wx0 = vxAt(dW, env.x0) - 1, wx1 = vxAt(dW, env.x1) + 1;
      if (sd > 0.8) { R4(ctx, wx0, 0, wx1 - wx0, 2.1, wallC); R4(ctx, wx0, 2.1, wx1 - wx0, 0.18, wallH);
        if (sd > 2) { ctx.fillStyle = wallD; ctx.beginPath(); for (let px = Math.floor(wx0 / 4.5) * 4.5; px < wx1; px += 4.5) ctx.rect(px, 0, 0.45, 2.35); ctx.rect(wx0, 0, wx1 - wx0, 0.25); ctx.fill(); }
        if (sd > 3) kxBrickFill(ctx, Object.assign({}, env, { s: sd, px: 1 / sd, x0: wx0, x1: wx1, y0: -1, y1: 3 }), wx0, 0.25, wx1 - wx0, 1.85, 0.6); }
      ctx.restore(); }
  } });
};
// What hangs in the sky behind the farthest buildings: the glow along the horizon, a few
// long clouds that take the evening light, an aeroplane's lamp after dark, birds by day.
K.skyBack = function (S, P, o) {
  o = o || {}; const base = o.base || 0, t = S.time, rainy = S.weather === 'rain' || S.weather === 'storm', D = makeRng((o.seed || 1) * 331 + 91);
  const glow = t === 'dusk' ? ['#ff8a4a', 0.5, 260] : t === 'dawn' ? ['#ffc9a0', 0.42, 230] : t === 'night' ? [rainy ? '#2c3a5c' : '#3b4a7c', rainy ? 0.5 : 0.42, 210] : t === 'overcast' ? ['#d6dce2', 0.3, 160] : t === 'snow' ? ['#ffffff', 0.4, 170] : ['#eaf4fb', 0.5, 200];
  const glow2 = t === 'dusk' ? ['#ffd27a', 0.34, 90] : t === 'night' ? ['#8a6a5a', rainy ? 0.16 : 0.22, 80] : t === 'dawn' ? ['#fff0c8', 0.3, 80] : null;
  const streaks = []; if (!rainy && t !== 'overcast') for (let i = 0; i < 7; i++) streaks.push([D.r(-1100, 1100), base + D.r(150, 420), D.r(160, 420), D.r(5, 13)]);
  const sc = t === 'dusk' ? ['#5a3a5a', '#ffb07a'] : t === 'dawn' ? ['#8a7a9a', '#ffe0c0'] : t === 'night' ? ['#141e3a', '#26345a'] : ['#ffffff', '#ffffff'];
  const birds = []; if (S.pal.dark < 0.3 && !rainy) for (let i = 0; i < 7; i++) birds.push([D.r(-30, 30), D.r(-12, 12), D.f()]);
  // both glows are worked out together as one stack of thin flat bands (far cheaper to paint
  // than a gradient or a stretched picture), so the sky behind the city costs one light pass
  const gH = glow[2] + 20, NB = 64, gBand = [];
  { const c1 = rgbOf(glow[0]), c2 = glow2 ? rgbOf(glow2[0]) : c1;
    for (let j = 0; j < NB; j++) {
      const yy = base - 20 + ((j + 0.5) / NB) * gH, a1 = glow[1] * Math.pow(1 - (j + 0.5) / NB, 1.25);
      let a2 = 0; if (glow2 && yy >= base - 10) { const u2 = clamp((yy - (base - 10)) / (glow2[2] + 10), 0, 1); a2 = glow2[1] * Math.pow(1 - u2, 1.25); }
      const A = 1 - (1 - a1) * (1 - a2), ch = (k) => (A > 0 ? Math.round((c1[k] * a1 * (1 - a2) + c2[k] * a2) / A) : 0);
      gBand.push(A > 0.003 ? 'rgba(' + ch(0) + ',' + ch(1) + ',' + ch(2) + ',' + A.toFixed(3) + ')' : null);
    } }
  const item = { x0: -4000, x1: 4000, layer: 0, draw(ctx, env) {
    kxSee(env, P);
    const vw = env.x1 - env.x0, s = env.s;
    // the glow, its band edges on whole screen pixels so neighbouring bands never overlap
    const m = kxM(ctx), snap = (v) => (m.d ? (Math.round(m.d * v + m.f) - m.f) / m.d : v), ya = env.y0 === undefined ? -1e9 : env.y0 - 1, yb = env.y1 === undefined ? 1e9 : env.y1 + 1;
    let prev = snap(base - 20);
    for (let j = 0; j < NB; j++) {
      const next = snap(base - 20 + ((j + 1) / NB) * gH), lo = Math.min(prev, next), hi = Math.max(prev, next);
      if (gBand[j] && hi > ya && lo < yb && hi > lo) { ctx.fillStyle = gBand[j]; ctx.fillRect(env.x0, lo, vw, hi - lo); }
      prev = next;
    }
    // long thin clouds: a dark body with the low light caught along its underside
    for (let i = 0; i < streaks.length; i++) {
      const q = streaks[i], cx = q[0] + ((env.t * 0.6 + i * 40) % 300) - 150; if (cx + q[2] < env.x0 || cx - q[2] > env.x1) continue;
      ctx.globalAlpha = t === 'night' ? 0.55 : t === 'day' ? 0.5 : 0.7;
      ctx.fillStyle = sc[0]; ctx.beginPath(); ctx.ellipse(cx, q[1], q[2], q[3], 0, 0, TAU); ctx.ellipse(cx + q[2] * 0.35, q[1] + q[3] * 0.6, q[2] * 0.5, q[3] * 0.7, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = sc[1]; ctx.beginPath(); ctx.ellipse(cx - q[2] * 0.1, q[1] - q[3] * 0.45, q[2] * 0.8, q[3] * 0.4, 0, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (S.pal.dark > 0.5 && !rainy) { // an aeroplane crossing, one lamp steady and one that winks
      const u = (env.t * 0.012 + 0.2) % 1, ax = -1300 + u * 2600, ay = base + 330 + u * 90;
      if (ax > env.x0 && ax < env.x1) { circ(ctx, ax, ay, Math.max(0.6, env.px), '#e8eefc'); if (Math.sin(env.t * 5) > 0.5) circ(ctx, ax - 6, ay - 0.5, Math.max(0.7, env.px * 1.2), '#ff4a3d'); }
    }
    if (birds.length && s > 0.35) { // a few birds wheeling, far too small and too high to be anything else
      const fx = Math.sin(env.t * 0.05) * 260 + 120, fy = base + 300 + Math.sin(env.t * 0.08) * 40;
      if (fx > env.x0 - 50 && fx < env.x1 + 50) { ctx.strokeStyle = S.tone('#2a2e36', P); ctx.lineWidth = Math.max(0.35, env.px * 0.9); ctx.beginPath(); for (let i = 0; i < birds.length; i++) { const b = birds[i], bx = fx + b[0] + Math.sin(env.t * 0.3 + i) * 6, byy = fy + b[1] + Math.cos(env.t * 0.25 + i * 2) * 4, fl = Math.sin(env.t * 7 + b[2] * 9) * 0.9; ctx.moveTo(bx - 2.2, byy + fl); ctx.lineTo(bx, byy); ctx.lineTo(bx + 2.2, byy + fl); } ctx.stroke(); }
    }
  } };
  P.items.unshift(item);
  return item;
};

// ---- a city street: a row of tenements facing the shooter -------------------
SCN.street = function (o) {
  o = o || {};
  const z = o.z || 220, time = o.time || 'dusk';
  const sun = o.sun || (time === 'dusk' ? [-64, 34] : time === 'dawn' ? [70, 30] : time === 'night' ? [52, 78] : [-80, 92]);
  const S = makeScene({ time, weather: o.weather, seed: o.seed || 3, refZ: z, exits: [-50, 50], bounds: { x0: -40, x1: 40, y0: -1.5, y1: 27 }, ambience: 'city', groundMat: 'hard', sun });
  const far = K.skyline(S, z + 1400, { seed: 21 + (o.seed || 0), hMin: 60, hMax: 240, haze: 0.42, groundCover: 980 });
  K.skyBack(S, far, { seed: o.seed || 3 });
  const mid = K.skyline(S, z + 420, { seed: 9 + (o.seed || 0), hMin: 30, hMax: 85, x0: -500, x1: 500, cols: ['#4a5566', '#56616f', '#3f4a5a'], haze: 0.36, groundCover: 413 });
  // Brickworks is an old industrial quarter by the docks: chimneys, a gas holder, cranes over the water
  const XR = makeRng((o.seed || 3) * 71 + 13);
  K.skyExtras(S, far, { col: '#56627a', stacks: [[XR.r(-520, -380), XR.r(230, 290)], [XR.r(-330, -230), XR.r(180, 240)], [XR.r(380, 520), XR.r(250, 300)]], cranes: [[XR.r(180, 260), 210, 110], [XR.r(300, 350), 180, -90]] });
  K.skyExtras(S, mid, { col: '#3a4452', stacks: [[XR.r(-170, -120), XR.r(96, 118)], [XR.r(110, 150), XR.r(88, 108)]], holder: [XR.r(-70, 40), XR.r(74, 88), 30] });
  // low works buildings between the city and this street, seen past both ends of the row
  K.worksRow(S, mid, z + 140, { seed: 5 + (o.seed || 0) });
  const pave = mix(S.pal.ground, '#000000', 0.08);
  const PB = S.plane(z + 7, 'row');
  K.ground(S, PB, { col: pave, noEdge: true, kind: 'pavement', depth: 7.6, cover: 7, seed: o.seed });
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
    const B = K.building(S, PB, Object.assign({ x, id: 'b' + (i + 1), seed: (o.seed || 3) * 13 + i * 7, dish: i % 2 === 0 ? 0.42 + i * 0.07 : undefined }, bd));
    H.b.push(B); H['b' + (i + 1)] = B; x += bd.w + (o.gap || 0);
  });
  const rowEnd = PB.items[PB.items.length - 1]; H.dress = [];   // where the detail layer for the walls goes, and what stands along their foot
  // dressing along the foot of the row and on its walls. All of it sits on the building
  // plane, seven metres behind anyone on the pavement.
  const DR = makeRng((o.seed || 3) * 977 + 31), inks = ['#b3312b', '#27457a', '#2f6b4a', '#8a6a2a', '#5a3a6a'], papers = ['#e9dcc0', '#f1ede2', '#e8c98a', '#cfe0e8'], words = ['DANCE', 'VOTE', 'BOXING', 'SALE', 'CIRCUS', 'ROOMS', 'JAZZ', 'LOST DOG'];
  H.b.forEach((B, i) => {
    const bd = styles[i], pw = B.w / B.cols;
    if (!bd.shop) {
      const piers = []; for (let c = 1; c < B.cols; c++) if (bd.door === undefined || (c !== bd.door && c !== bd.door + 1)) piers.push(B.x + c * pw);
      const kinds = ['box', 'bike', 'bin', 'poster', 'poster', 'tag', 'hydrant', 'poster'];
      piers.forEach((px0) => {
        const k = DR.pick(kinds), u = DR.f(); H.dress.push([k, px0, u]);
        if (k === 'box' && u < 0.6) K.postBox(S, PB, px0);
        else if (k === 'bike' && u < 0.75) K.bicycle(S, PB, px0, { col: DR.pick(['#2f6b4a', '#27457a', '#8a2a2a', '#2a2e36']), flip: DR.chance(0.5) });
        else if (k === 'bin') { K.bin(S, PB, px0 - 0.3); if (u > 0.5) K.bin(S, PB, px0 + 0.42, { col: '#6f7a6a' }); }
        else if (k === 'hydrant' && u < 0.6) K.hydrant(S, PB, px0);
        else if (k === 'tag') K.graffiti(S, PB, px0 - 0.6, 1.1 + u * 0.5, 1.2, DR.pick(['#d8d2c2', '#7fa6d8', '#d8a86a']), Math.floor(u * 1000));
        else if (k === 'poster') { const n = u > 0.55 ? 2 : 1; for (let j = 0; j < n; j++) K.poster(S, PB, px0 - (n === 2 ? 0.72 : 0.36) + j * 0.76, 1.0 + DR.r(0, 0.25), 0.68, 0.95, { kind: DR.i(0, 3), col: DR.pick(papers), ink: DR.pick(inks), text: DR.chance(0.7) ? DR.pick(words) : null }); }
      });
      // washing strung between two windows high up
      if (B.floors >= 4 && B.cols >= 3 && DR.chance(0.75)) { const f = DR.i(2, B.floors - 1), c = DR.i(0, B.cols - 2), a = B.win(f, c), b2 = B.win(f, c + 1); if (a && b2 && !a.door && !b2.door) K.clothesLine(S, PB, a.x + a.w + 0.06, a.y + 0.5, b2.x - 0.06, b2.y + 0.5, {}); }
    } else {
      // outside a shop: produce crates under the window, a bill or two on the pilaster
      if (String(bd.shop.sign || '').indexOf('DELI') >= 0) { const cx = B.x + 1.2; PB.add({ x0: cx - 0.2, x1: cx + 3.6, layer: 0, draw(ctx, env) { if (env.s < 7) return; const wd = S.tone('#8a6a45', PB), wd2 = S.tone('#6b5034', PB), fr = ['#d9482b', '#e8a23a', '#7fae45', '#b56bb0']; for (let k = 0; k < 4; k++) { const bx = cx + k * 0.82; R4(ctx, bx, 0, 0.74, 0.3, wd); R4(ctx, bx, 0.12, 0.74, 0.03, wd2); if (env.s > 14) { ctx.fillStyle = S.tone(fr[k], PB); ctx.beginPath(); for (let q = 0; q < 5; q++) { ctx.moveTo(bx + 0.12 + q * 0.13 + 0.075, 0.32 + (q % 2) * 0.035); ctx.arc(bx + 0.12 + q * 0.13, 0.32 + (q % 2) * 0.035, 0.075, 0, TAU); } ctx.fill(); } } } }); }
      else if (DR.chance(0.7)) { const bx = B.x + B.w - 0.5 - (bd.shop.door ? 2.3 : 0); K.bin(S, PB, bx, { col: '#6f7a6a' }); H.dress.push(['bin', bx, 0]); }
    }
  });
  const PS = S.plane(z, 'street');
  K.ground(S, PS, { col: pave, noEdge: true, kind: 'pavement', kerb: 3.3, roadCol: S.pal.road, cover: 7, seed: (o.seed || 0) + 5 });
  H.PS = PS; H.lamps = [];
  (o.lamps || [-27, -9, 9, 27]).forEach((lx, i) => H.lamps.push(K.lamp(S, PS, lx, 5.4, 'street', { id: 'lamp' + (i + 1), reach: o.lampReach })));
  // thin poles only on the pavement itself: a street name on the first lamp post, signs at the far ends
  const lampXs = o.lamps || [-27, -9, 9, 27];
  K.signPost(S, PS, lampXs[0], { kind: 'name', text: 'CALDER ST', h: 3.3 });
  K.signPost(S, PS, lampXs[lampXs.length - 1], { kind: 'name', text: 'TANNERY ROW', h: 3.3 });
  K.signPost(S, PS, -38.6, { kind: 'bus', text: '9' }); K.signPost(S, PS, 39.2, { kind: 'stop' });
  const PR = S.plane(z - 7, 'road');
  K.ground(S, PR, { col: S.pal.road, stripes: 2.2, noEdge: true, zebra: [-3.9, 0.6], near: 5.3, nearCol: pave, seed: (o.seed || 0) + 9 });
  H.PR = PR;
  (o.cars || [['sedan', -30, 1, '#7a2e2e'], ['van', 18, -1, '#d9dde2'], ['sedan', 34, 1, '#2f4a6b']]).forEach((c) => K.parked(S, PR, c[0], c[1], c[2], c[3], { y: 0 }));
  // something close by for depth: a flag on a nearer roof and a run of cable
  if (o.el) { const PE = S.plane(z - 22, 'el'); H.el = K.viaduct(S, PE, o.el === true ? 9.5 : o.el, { pillars: o.elPillars }); H.PE = PE; }
  if (o.flag !== false) {
    const PF = S.plane(z * 0.62, 'near'), fx = o.flagX === undefined ? -19 : o.flagX;
    K.flag(S, PF, fx, 2, 8, o.flagCol || '#c0392b'); K.box(S, PF, fx - 9, -6, 13, 8, '#3a3f49', { band: 0.5 }); H.PF = PF;
    // the near roof: a coping along its edge, a hatch and a vent, and telephone wires overhead with birds on them
    PF.add({ x0: fx - 9.2, x1: fx + 4.2, layer: 0, draw(ctx, env) { if (env.s < 4) return; const cp = S.tone('#6c737a', PF), dk = S.tone('#22262d', PF); R4(ctx, fx - 9.15, 1.9, 13.3, 0.16, cp); R4(ctx, fx - 9.15, 1.86, 13.3, 0.04, dk); if (env.s > 9) { ctx.fillStyle = dk; ctx.beginPath(); for (let k = 1; k < 9; k++) ctx.rect(fx - 9 + k * 1.45, 1.9, 0.03, 0.16); ctx.fill(); R4(ctx, fx - 6.5, 2.06, 1.3, 0.5, S.tone('#4a5058', PF)); R4(ctx, fx - 6.6, 2.52, 1.5, 0.08, cp); R4(ctx, fx + 1.8, 2.06, 0.16, 0.8, dk); poly(ctx, [fx + 1.6, 2.86, fx + 2.16, 2.86, fx + 1.88, 3.06], dk); } } });
    K.wire(S, PF, -75, 21.6, 75, 21.2, 1.3, { birds: 4 }); K.wire(S, PF, -75, 20.9, 75, 20.6, 1.5, { birds: 2 });
  }
  H.street = (xx, extra) => Object.assign({ plane: PS, x: xx, y: 0, zone: 'street', behind: false, room: null }, extra || {});
  H.inWin = (B, f, c, dx, extra) => { const op = B.win(f, c); return Object.assign({ plane: B.P, x: B.winX(c) + (dx || 0), y: B.floorY(f), room: op.room, zone: op.room, behind: true }, extra || {}); };
  H.onRoof = (B, xx, extra) => Object.assign({ plane: B.P, x: xx, y: B.roofY, room: B.roofRoom, zone: B.roofRoom, behind: true }, extra || {});
  stDetail(S, H, { styles, rowEnd, seed: o.seed || 3 });
  return H;
};

// ---- a lived-in street ----------------------------------------------------------------
// Detail for looks only, from the scene kit's static layers (K.deco) and a few cheap moving
// things. On the row: soot and rain run down from the cornices, salt bleeds from the string
// courses, damp rises at the foot of the walls, cracks step out from the window corners; old
// repairs, tie plates, rust under the air conditioners, a cable or two, a dish, a bell panel by
// the door, a weed on a cornice, and a hotel sign on a pier. On the ground: litter, gum, stains
// and leaves on the pavements and in the gutters, tar seams and skid marks on the road, a waste
// lot past each end of the row, and after dark the light of the shop windows lying on the
// paving. Moving: pigeons on the cornices, steam from the laundry vent, a sheet of newspaper
// blowing along the road, the sign's tubes stuttering at night. All of it is painted on a wall
// that already hides what is behind it, lies flat on the ground, or sits low in the lots seven
// metres behind the pavement; nothing is solid or shootable.
// How the ground of plane P lies as seen from the eye: card height of a point dz in front of it.
function stEye(D, P) {
  const e = D.env ? kxSee(D.env, P) : null, eyr = e && e.ok ? Math.max(4, e.ey - (P.groundY || 0)) : 16, d = e && e.ok ? P.z - e.ez : P.z;
  return { eyr, d, tilt: eyr / d, hOf: (dz) => (eyr * dz) / Math.max(1, d - dz) };
}
// A flat patch lying on the ground: a squashed wobbly oval, judged for size by its width.
function stFlat(D, R, x, y, rx, ry, hex, a) {
  const p = [], ph = R.r(0, TAU);
  for (let i = 0; i < 7; i++) { const an = ph + (i / 7) * TAU, r = R.r(0.75, 1.15); p.push(x + Math.cos(an) * rx * r, y + Math.sin(an) * ry * r); }
  D.poly(p, hex, a, rx * 1.4);
}
// Rubbish trodden into a pavement or blown along a road, between card heights yA (far) and
// yB (near): scraps of paper, cans and cups, leaves, gum, cigarette ends. sq is how flat a
// thing lying down looks from up here; dens is pieces to the metre.
function stLitter(D, R, x0, x1, yA, yB, sq, dens) {
  const paper = ['#ebe6d8', '#d8cdaa', '#c9d3da'], tin = ['#9aa3ab', '#3b6ea5', '#c9a24a', '#2f6b4a'], leaf = ['#7a5a32', '#94683a', '#5d4a2a'];
  for (let i = 0, n = Math.round((x1 - x0) * dens); i < n; i++) {
    const x = R.r(x0, x1), y = R.r(yB, yA), k = R.f();
    if (k < 0.2) { D.at = 5; const w = R.r(0.16, 0.34), h = Math.max(0.03, w * sq * R.r(0.8, 1.5)); D.poly([x, y, x + w, y + h * 0.15, x + w * 0.85, y + h, x + w * 0.1, y + h * 0.85], R.pick(paper), 0.9, w); }
    else if (k < 0.28) { D.at = 10; D.poly([x, y, x + 0.13, y, x + 0.13, y + 0.065, x, y + 0.065], R.pick(tin), 1, 0.13); D.pass = 1; D.poly([x, y + 0.045, x + 0.13, y + 0.045, x + 0.13, y + 0.06, x, y + 0.06], '#ffffff', 0.35, 0.13); D.pass = 0; }
    else if (k < 0.33) { D.at = 10; D.poly([x, y, x + 0.07, y, x + 0.085, y + 0.11, x - 0.015, y + 0.11], '#f1ede2', 1, 0.11); }
    else if (k < 0.55) { D.at = 10; const l = R.r(0.07, 0.13), hh = Math.max(0.012, l * sq * 0.7); D.poly([x, y, x + l * 0.5, y + hh, x + l, y, x + l * 0.5, y - hh], R.pick(leaf), 0.9, l); }
    else if (k < 0.8) { D.at = 20; stFlat(D, R, x, y, R.r(0.035, 0.06), 0.012 + sq * 0.03, '#2b2d30', 0.4); }
    else { D.at = 40; D.poly([x, y, x + 0.045, y, x + 0.045, y + 0.014, x, y + 0.014], '#e6dcc4', 1, 0.05); }
  }
  D.at = 0;
}
function stDetail(S, H, q) {
  const PB = H.PB, PS = H.PS, PR = H.PR, night = S.pal.dark > 0.3, wet = S.weather === 'rain' || S.weather === 'storm', seed = q.seed || 3;
  const last = H.b[H.b.length - 1], rowX0 = H.b[0].x, rowX1 = last.x + last.w;
  // what must stay clear on the face of the row: windows, doors, shop fronts, and the pipes,
  // vents, alarm boxes and air conditioners already fixed to the walls
  const obs = [];
  H.b.forEach((B) => {
    for (const k in B.wins) { const op = B.wins[k]; obs.push([op.x - 0.2, op.y - 0.18, op.x + op.w + 0.2, op.y + op.h + 0.32]); }
    if (B.shop) obs.push([B.x - 0.05, B.base - 1, B.x + B.w + 0.05, B.base + B.fh + 0.6]);
    if (B.doorC !== undefined && !B.shop) {
      if (B.doorOp) { const d = B.doorOp; obs.push([d.x - 0.42, B.base - 1, d.x + d.w + 0.82, d.y + d.h + 0.5]); }
      else { const cx = B.winX(B.doorC); obs.push([cx - 0.85, B.base - 1, cx + 1.45, B.base + 3.1]); }
    }
    (B.pipes || []).forEach((px) => obs.push([px - 0.2, B.base - 1, px + 0.2, B.roofY]));
    (B.vents || []).forEach((v) => obs.push([v[0] - 0.06, v[1] - (v[2] ? 0.75 : 0.06), v[0] + 0.4, v[1] + 0.32]));
    if (B.alarm) obs.push([B.alarm.x - 0.06, B.alarm.y - 0.06, B.alarm.x + 0.42, B.alarm.y + 0.36]);
    (B.acs || []).forEach((op) => obs.push([op.x + 0.1, op.y - 0.8, op.x + 1.2, op.y]));
  });
  // how far down from (x, y) the wall is clear, a strip hw either side; and whether a box is clear
  const roomDown = (x, y, hw) => { let d = y - 0.62; for (let i = 0; i < obs.length; i++) { const o = obs[i]; if (x + hw < o[0] || x - hw > o[2]) continue; if (y > o[1] && y < o[3]) return 0; if (o[3] <= y) d = Math.min(d, y - o[3]); } return d; };
  const clear = (x0, y0, x1, y1) => { for (let i = 0; i < obs.length; i++) { const o = obs[i]; if (x1 > o[0] && x0 < o[2] && y1 > o[1] && y0 < o[3]) return false; } return true; };
  // where the pigeons sit on the cornices (and so where the cornice is whitened under them)
  const birds = [];
  { const R = makeRng(5131 + seed * 7); H.b.forEach((B) => { if (B.kStyle === 'glass') return; for (let i = 0, n = R.i(0, 3); i < n; i++) birds.push([B.x + R.r(0.8, B.w - 1.4), B.roofY + 0.16, R.r(0, 20), R.chance(0.5) ? 1 : -1]); }); }

  // ---- the faces of the row ----
  K.deco(S, PB, { after: q.rowEnd, seed: 5101 + seed }, (D, R) => {
    const soot = '#1a1512', salt = '#f0eadc', wash = '#20242a', rust = '#7a3c1e', iron = '#24211f', cab = '#1f2227', green = '#3c4a32';
    const streak = (x, y, w, l, hex, a) => D.poly([x - w / 2, y, x + w / 2, y, x + w * 0.4, y - l * 0.55, x + w * 0.2, y - l, x - w * 0.12, y - l * 0.96, x - w * 0.36, y - l * 0.5], hex, a, w);
    H.b.forEach((B) => {
      if (B.kStyle === 'glass') return;
      const brick = B.kStyle === 'brick', x0 = B.x, x1 = B.x + B.w, top = B.roofY - 0.18, pw = B.w / B.cols;
      // soot (on brick) or rain (on cast concrete) running down from under the cornice
      D.at = 5;
      for (let i = 0, n = Math.round(B.w * 0.9); i < n; i++) {
        const w = R.r(0.06, 0.2), x = R.r(x0 + 0.35, x1 - 0.5), l = Math.min(R.r(0.8, brick ? 2.6 : 5), roomDown(x, top, w / 2) - 0.05);
        if (l > w * 3) streak(x, top, w, l, brick ? soot : wash, brick ? 0.13 : 0.15);
      }
      // salt bleeding out under each string course, or the grime that gathers under it
      for (let f = 1; f < B.floors; f++) {
        const y = B.floorY(f) - 0.11;
        for (let i = 0, n = Math.round(B.w * 0.35); i < n; i++) {
          const w = R.r(0.05, 0.16), x = R.r(x0 + 0.3, x1 - 0.4), l = Math.min(R.r(0.3, brick ? 0.9 : 1.6), roomDown(x, y, w / 2) - 0.05);
          if (l > w * 3) streak(x, y, w, l, brick ? salt : wash, brick ? 0.12 : 0.11);
        }
      }
      if (!brick) {
        // long rain marks down the piers of cast concrete, rust weeping from its tie bolts, a spalled patch
        for (let c = 0; c <= B.cols; c++) {
          const px = c === 0 ? x0 + 0.6 : c === B.cols ? x1 - 1.15 : x0 + c * pw;
          for (let k = 0; k < 2; k++) { const x = px + R.r(-0.32, 0.32), w = R.r(0.12, 0.3), l = roomDown(x, top, w / 2) * R.r(0.4, 0.95); if (l > 0.6) streak(x, top, w, l, wash, 0.1); }
        }
        for (let i = 0; i < 2; i++) {
          const x = x0 + R.i(1, Math.max(1, B.cols - 1)) * pw + R.r(-0.3, 0.3), y = B.floorY(R.i(1, B.floors - 1)) + R.r(0.4, 2.4);
          if (!clear(x - 0.34, y - 0.26, x + 0.34, y + 0.26)) continue;
          D.at = 10; KW.blob(D, R, x, y, R.r(0.18, 0.3), R.r(0.12, 0.2), '#ffffff', 0.14, 0.35);
          D.pass = 1; D.seg(x - 0.14, y + 0.04, x + 0.15, y + 0.05, 0.025, '#2a1a12', 0.85); D.seg(x - 0.12, y - 0.05, x + 0.13, y - 0.05, 0.025, '#2a1a12', 0.85); D.pass = 0;
          const l = Math.min(R.r(0.5, 1.2), roomDown(x, y - 0.15, 0.05)); if (l > 0.2) streak(x, y - 0.15, 0.14, l, rust, 0.28);
        }
        D.at = 20;
        for (let f = 0; f < B.floors; f++) for (let c = 0; c <= B.cols; c++) for (let k = 0; k < 2; k++) {
          if (R.f() > 0.25) continue;
          const mx = x0 + c * pw + (R.chance(0.5) ? 0.205 : -0.205), hy = B.floorY(f) + B.fh * (0.14 + k * 0.72), l = Math.min(R.r(0.15, 0.55), roomDown(mx, hy, 0.03));
          if (l > 0.1 && mx > x0 + 0.1 && mx < x1 - 0.1) streak(mx, hy, 0.05, l, rust, 0.3);
        }
      }
      // cracks running out from the corners of a few windows: stepping along the joints in brick
      D.at = 14;
      for (const key in B.wins) {
        const op = B.wins[key]; if (op.door || R.f() > 0.3) continue;
        const sx = R.chance(0.5) ? -1 : 1, sy = R.chance(0.6) ? 1 : -1, cx = sx < 0 ? op.x - 0.16 : op.x + op.w + 0.16, cy = sy > 0 ? op.y + op.h + 0.23 : op.y - 0.06;
        const p = [cx, cy]; let px = cx, py = cy;
        if (brick) for (let j = 0, n = R.i(4, 9); j < n; j++) { px += sx * R.pick([0.1125, 0.225, 0.1125]); p.push(px, py); py += sy * 0.075; p.push(px, py); }
        else for (let j = 0; j < 5; j++) { px += sx * R.r(0.04, 0.16); py += sy * R.r(0.07, 0.17); p.push(px, py); }
        if (clear(px - 0.02, py - 0.02, px + 0.02, py + 0.02)) D.line(p, 0.022, brick ? '#1c1512' : '#1a1d22', 0.55);
      }
      // damp rising at the foot of the wall, with a tide line of salt on brick, green on concrete
      D.at = 5;
      { const yb = B.base + 0.57; let seg = null;
        const flush = () => {
          if (seg && seg.length >= 6) { const n = seg.length; D.poly(seg.concat([seg[n - 2], yb, seg[0], yb]), brick ? '#1e1915' : green, brick ? 0.18 : 0.2, 0.3); if (brick) { D.pass = 1; D.line(seg, 0.03, salt, 0.14); D.pass = 0; } }
          seg = null;
        };
        const ph = R.r(0, TAU), ph2 = R.r(0, TAU), hb = brick ? R.r(0.2, 0.3) : R.r(0.14, 0.22);
        for (let x = x0 + 0.05; x <= x1 - 0.04; x += 0.25) {
          let hm = 0.5;
          for (let i = 0; i < obs.length; i++) { const o = obs[i]; if (x > o[0] - 0.04 && x < o[2] + 0.04 && o[1] < yb + 0.9) hm = Math.min(hm, o[1] - yb + 0.08); }
          if (hm < 0.1) { flush(); continue; }
          (seg = seg || []).push(x, yb + Math.min(hm, hb * (1 + 0.22 * Math.sin(x * 1.1 + ph) + 0.1 * Math.sin(x * 3.3 + ph2))));
        }
        flush();
      }
      // weeds where the paving meets the wall
      D.at = 10;
      for (let i = 0, n = Math.round(B.w * 0.25); i < n; i++) { const x = R.r(x0 + 0.3, x1 - 0.3); if (clear(x - 0.15, 0, x + 0.15, 0.3)) KC.tuft(D, R, x, 0, R.r(0.1, 0.24), R.chance(0.5) ? '#55683a' : '#6b7448'); }
      // old repairs: a stepped patch of newer brick, or fresh render
      for (let i = 0, n = R.i(2, 4); i < n; i++) {
        const w = R.r(0.5, 1.3), h = R.r(0.3, 0.75), x = Math.round(R.r(x0 + 0.5, x1 - w - 0.6) / 0.1125) * 0.1125, y = Math.round(R.r(B.base + 1.2, top - h - 0.4) / 0.075) * 0.075;
        if (!clear(x - 0.12, y, x + w + 0.12, y + h)) continue;
        if (brick) {
          const rows = Math.max(2, Math.round(h / 0.15)), p = [];
          for (let r = 0; r < rows; r++) { const xr = x + w + (r % 2 ? 0.1125 : 0); p.push(xr, y + r * 0.15, xr, y + (r + 1) * 0.15); }
          for (let r = rows - 1; r >= 0; r--) { const xl = x + (r % 2 ? 0.1125 : 0); p.push(xl, y + (r + 1) * 0.15, xl, y + r * 0.15); }
          D.poly(p, R.chance(0.5) ? '#000000' : '#ffffff', 0.08, Math.min(w, h));
        } else KW.blob(D, R, x + w / 2, y + h / 2, w / 2, h / 2, '#ffffff', 0.09, 0.2);
      }
      // iron tie plates at each floor up one pier, each weeping a little rust
      if (brick && B.cols > 1 && R.chance(0.7)) {
        const px = x0 + R.i(1, B.cols - 1) * pw;
        for (let f = 1; f < B.floors; f++) {
          const y = B.floorY(f) + 0.34; if (!clear(px - 0.2, y - 0.16, px + 0.2, y + 0.16)) continue;
          D.at = 10; streak(px + 0.02, y - 0.06, 0.09, R.r(0.25, 0.65), rust, 0.28);
          D.at = 12; D.pass = 1; D.seg(px - 0.12, y - 0.08, px + 0.12, y + 0.08, 0.04, iron, 0.8); D.seg(px - 0.12, y + 0.08, px + 0.12, y - 0.08, 0.04, iron, 0.8); D.ell(px, y, 0.045, 0.045, iron, 0.9); D.pass = 0;
        }
      }
      // rust run down from the brackets of the air conditioners
      D.at = 10;
      (B.acs || []).forEach((op) => { for (const sx of [op.x + 0.32, op.x + 0.98]) { const l = Math.min(R.r(0.4, 1.2), roomDown(sx, op.y - 0.82, 0.04)); if (l > 0.12) streak(sx, op.y - 0.75, 0.07, l + 0.07, rust, 0.22); } });
      // a television cable down a pier from the roof and in at a window
      if (brick && B.cols > 2 && B.floors > 3 && R.chance(0.65)) {
        const c = R.i(1, B.cols - 1), side = R.chance(0.5) ? -1 : 1, px = x0 + c * pw + side * 0.42, f = R.i(1, B.floors - 2), yE = B.floorY(f) + 1.7, wl = B.win(f, side < 0 ? c - 1 : c);
        if (wl && clear(px - 0.04, yE - 0.04, px + 0.04, top - 0.1)) {
          D.at = 10; D.line([px, top - 0.05, px, yE, side < 0 ? wl.x + wl.w + 0.03 : wl.x - 0.03, yE], 0.03, cab, 0.9);
          D.at = 30; for (let y = top - 0.5; y > yE + 0.2; y -= 0.65) D.rect(px - 0.025, y, 0.05, 0.035, cab);
        }
      }
      // pigeons have whitened the cornice where they sit
      D.at = 10;
      birds.forEach((b) => { if (b[0] < x0 || b[0] > x1) return; for (let k = 0; k < 3; k++) { const x = b[0] + R.r(-0.35, 0.35), l = Math.min(R.r(0.12, 0.5), roomDown(x, B.roofY - 0.15, 0.03)); if (l > 0.08) streak(x, B.roofY - 0.15, R.r(0.04, 0.09), l, '#ecebe4', 0.4); } });
    });
    // a dish bolted to a pier on one building, its cable run in at the window below
    { const cands = H.b.filter((B) => B.kStyle === 'brick' && B.floors >= 4 && B.cols > 2);
      if (cands.length) {
        const B = cands[R.i(0, cands.length - 1)], px = B.x + R.i(1, B.cols - 1) * (B.w / B.cols) + 0.3, y = B.floorY(B.floors - 2) + 1.5;
        if (clear(px - 0.4, y - 0.42, px + 0.5, y + 0.36)) {
          D.at = 6; D.rect(px - 0.05, y - 0.32, 0.1, 0.5, '#3a3f48'); D.ell(px + 0.04, y, 0.27, 0.31, '#c9ced3');
          D.pass = 1; D.ell(px + 0.08, y + 0.01, 0.19, 0.23, '#a7aeb5'); D.seg(px + 0.06, y - 0.02, px + 0.4, y - 0.08, 0.03, '#2a2e36'); D.rect(px + 0.37, y - 0.13, 0.08, 0.08, '#2a2e36'); D.pass = 0;
          D.at = 10; const l = roomDown(px, y - 0.34, 0.03); D.line([px, y - 0.32, px, y - 0.32 - Math.min(1.2, l * 0.9)], 0.025, cab, 0.9);
        }
      } }
    // a bell panel beside each street door
    H.b.forEach((B) => {
      if (!B.doorOp) return; const d = B.doorOp, bx = d.x - 0.72, by = B.base + 1.2; if (!clear(bx - 0.02, by, bx + 0.22, by + 0.36)) return;
      D.at = 10; D.rect(bx + 0.02, by, 0.16, 0.3, '#5d636b'); D.pass = 1; D.at = 20; for (let k = 0; k < 4; k++) D.poly([bx + 0.06, by + 0.04 + k * 0.055, bx + 0.14, by + 0.04 + k * 0.055, bx + 0.14, by + 0.07 + k * 0.055, bx + 0.06, by + 0.07 + k * 0.055], '#c9b98a', 1, 0.08); D.pass = 0;
    });
    // a buddleia rooted in the joint above a cornice, as they do
    { const B = H.b[R.i(0, H.b.length - 1)], bx = B.x + B.w * R.r(0.3, 0.75), by = B.roofY + 0.16;
      if (B.kStyle !== 'glass' && clear(bx - 0.45, by, bx + 0.45, by + 0.5)) {
        D.at = 6; KW.blob(D, R, bx, by + 0.03, 0.22, 0.06, '#3c4a32', 0.6, 0.3);
        const tips = []; for (let k = 0; k < 5; k++) { const tx = bx + (k - 2) * 0.1 + R.r(-0.05, 0.05), ty = by + R.r(0.22, 0.42); D.seg(bx + (k - 2) * 0.02, by, tx, ty, 0.025, '#4a5a34'); tips.push([tx, ty]); }
        D.pass = 1; tips.forEach((t) => { D.ell(t[0], t[1] - 0.04, 0.09, 0.045, '#56723c'); D.ell(t[0] - 0.05, t[1] - 0.12, 0.07, 0.035, '#4c6635'); });
        D.pass = 2; for (let k = 0; k < 3; k++) { const t = tips[k * 2]; D.ell(t[0] + 0.02, t[1] + 0.06, 0.03, 0.07, '#8a5aa8'); } D.pass = 0;
      } }
  });

  // ---- the pavement along the row, and the lots past its ends ----
  K.deco(S, PB, { ground: true, seed: 5121 + seed }, (D, R) => {
    const E = stEye(D, PB), bd = E.hOf(7) * 0.93, sq = Math.max(0.12, E.tilt * 1.5);
    stLitter(D, R, -75, 75, -0.03, -bd, sq, 1.1);
    // stains and spilt rubbish round the bins, wet under the deli's crates
    (H.dress || []).forEach((d) => {
      if (d[0] !== 'bin') return;
      D.at = 5; stFlat(D, R, d[1] + R.r(-0.2, 0.3), -bd * R.r(0.15, 0.35), R.r(0.5, 0.9), Math.max(0.05, 0.8 * sq), '#000000', 0.1);
      stLitter(D, R, d[1] - 0.8, d[1] + 1.2, -0.03, -bd * 0.6, sq, 4);
    });
    // the bare ground of a waste lot past each end of the row: cinders, rubble, weeds, an old tyre or two
    let trolley = 1, mattress = 1;
    for (const side of [-1, 1]) {
      const a = side > 0 ? rowX1 + 0.5 : rowX0 - 0.5, b = a + side * 26, lo = Math.min(a, b), hi = Math.max(a, b);
      D.at = 0;
      const edge = [hi, -0.02, lo, -0.02]; for (let x = lo; x <= hi; x += R.r(0.5, 1.4)) edge.push(x, -bd * R.r(0.3, 0.55)); edge.push(hi, -bd * 0.4);
      D.poly(edge, '#4a4038', 0.55, 2);
      for (let x = lo + 0.6; x < hi - 0.6; x += R.r(1.1, 2.8)) {
        const y = -R.r(0.04, bd * 0.42), k = R.f();
        if (k < 0.45) { // a heap of broken brick and plaster
          const w = R.r(0.8, 2), h = R.r(0.15, 0.4); D.at = 5; D.poly([x - w / 2, y, x - w * 0.3, y + h * 0.7, x - w * 0.05, y + h, x + w * 0.25, y + h * 0.8, x + w / 2, y], '#6e665e', 1, h);
          D.pass = 1; D.at = 14; for (let j = 0; j < 4; j++) D.rect(x + R.r(-w * 0.35, w * 0.3), y + R.r(0.02, h * 0.6), 0.2, 0.07, R.chance(0.6) ? '#8a5444' : '#b9b0a2'); D.pass = 0;
        } else if (k < 0.8) { D.at = 8; KC.tuft(D, R, x, y, R.r(0.2, 0.5), R.chance(0.5) ? '#55683a' : '#77744a'); }
        else if (k < 0.88) { D.at = 8; KC.tyres(D, x, y, R.i(1, 2), 0.3); }
        else if (k < 0.94 && mattress) { // a mattress dumped flat, stained, its ticking striped
          mattress = 0; D.at = 6; D.rect(x - 0.9, y, 1.8, 0.14, '#a59d8e'); D.pass = 1; D.at = 14; for (let j = 0; j < 6; j++) D.rect(x - 0.85 + j * 0.3, y + 0.02, 0.05, 0.1, '#6f7f92', 0.6); D.ell(x + 0.3, y + 0.08, 0.3, 0.05, '#5a4a32', 0.4); D.rect(x - 0.9, y, 1.8, 0.04, '#000000', 0.2); D.pass = 0;
        } else if (trolley) { // a shopping trolley on its side
          trolley = 0;
          D.at = 10; D.line([x - 0.45, y + 0.05, x + 0.4, y + 0.05, x + 0.45, y + 0.5, x - 0.4, y + 0.45, x - 0.45, y + 0.05], 0.03, '#9aa3ab', 0.9);
          D.at = 20; for (let j = 1; j < 5; j++) D.seg(x - 0.45 + j * 0.17, y + 0.05, x - 0.43 + j * 0.17, y + 0.47, 0.015, '#9aa3ab', 0.8);
          D.at = 10; D.ell(x - 0.35, y + 0.02, 0.06, 0.06, '#24272c'); D.ell(x + 0.3, y + 0.02, 0.06, 0.06, '#24272c');
        }
      }
    }
    // after dark the lit shop windows lay their light on the paving, and in the wet it runs towards you
    if (night) H.b.forEach((B) => {
      const r = B.shop && S.rooms[B.shop.room]; if (!r || !r.lit) return;
      const sx = B.shop.x, sw = B.shop.w; D.lit = true; D.at = 0;
      for (let k = 0; k < 3; k++) { const fl = 0.3 + k * 0.5, dep = bd * (0.3 + k * 0.28); D.poly([sx + 0.1 + k * 0.4, -0.01, sx + sw - 0.1 - k * 0.4, -0.01, sx + sw - 0.3 + fl, -dep, sx + 0.3 - fl, -dep], '#ffdfa0', 0.07, 1); }
      if (wet) for (let i = 0, n = Math.round(sw * 1.5); i < n; i++) { const x = R.r(sx + 0.2, sx + sw - 0.2), l = bd * R.r(0.4, 0.95); D.poly([x - 0.05, -0.01, x + 0.05, -0.01, x + 0.02, -l, x - 0.02, -l], '#ffe6b0', 0.15, 0.1); }
      D.lit = false;
    });
  });

  // ---- the pavement on the street side and the far gutter ----
  K.deco(S, PS, { ground: true, seed: 5141 + seed }, (D, R) => {
    const E = stEye(D, PS), hk = E.hOf(3.3), face = 0.15 * (1 + hk / E.eyr), gy = -(hk + face), sq = Math.max(0.12, E.tilt * 1.5), rb = E.hOf(7);
    stLitter(D, R, -75, 75, -0.02, -hk * 0.9, sq, 0.7);
    // leaves and rubbish drifted against the kerb
    const leaf = ['#7a5a32', '#94683a', '#5d4a2a', '#a07a3a'], paper = ['#ebe6d8', '#d8cdaa'];
    for (let x = -75; x < 75; x += R.r(0.8, 4.5)) for (let k = 0, n = R.i(2, 6); k < n; k++) {
      const lx = x + R.r(0, 1.3), ly = gy - R.r(0.005, 0.05);
      if (R.f() < 0.8) { D.at = 8; const l = R.r(0.08, 0.15); D.poly([lx, ly, lx + l * 0.5, ly + 0.012, lx + l, ly, lx + l * 0.5, ly - 0.012], R.pick(leaf), 0.95, l); }
      else { D.at = 5; D.poly([lx, ly, lx + 0.26, ly + 0.005, lx + 0.24, ly + 0.03, lx + 0.02, ly + 0.026], R.pick(paper), 0.9, 0.26); }
    }
    D.at = 0;
    if (gy - 0.03 > -rb) stLitter(D, R, -75, 75, gy - 0.03, -rb * 0.97, sq, 0.25);
  });

  // ---- the road and the near pavement ----
  K.deco(S, PR, { ground: true, seed: 5151 + seed }, (D, R) => {
    const near = 5.3;
    // tar run into old cracks: glossy black seams wandering across the lanes
    D.at = 5;
    for (let i = 0; i < 16; i++) { let x = R.r(-75, 70), y = -R.r(0.3, near - 0.4); const p = [x, y]; for (let j = 0; j < 7; j++) { x += R.r(0.5, 1.4); y = clamp(y + R.r(-0.25, 0.25), -near + 0.25, -0.2); p.push(x, y); } D.line(p, 0.05, '#121418', 0.5); }
    // rubber left by hard braking, two tyres' worth at a time
    for (let i = 0; i < 4; i++) { const x = R.r(-45, 40), y = -R.pick([1.1, 3.3]) + R.r(-0.4, 0.4), l = R.r(3, 7); for (const dy of [0, -0.42]) D.poly([x, y + dy, x + l, y + dy + 0.02, x + l * 0.98, y + dy - 0.05, x, y + dy - 0.07], '#0e1013', 0.16, 0.5); }
    // leaves and rubbish in the near gutter, and trodden into the near pavement
    const leaf = ['#7a5a32', '#94683a', '#5d4a2a', '#a07a3a'];
    for (let x = -75; x < 75; x += R.r(0.8, 4)) for (let k = 0, n = R.i(2, 5); k < n; k++) { const lx = x + R.r(0, 1.3), ly = -near + R.r(0.03, 0.22), l = R.r(0.08, 0.15); D.at = 8; D.poly([lx, ly, lx + l * 0.5, ly + 0.025, lx + l, ly, lx + l * 0.5, ly - 0.025], R.pick(leaf), 0.95, l); }
    stLitter(D, R, -75, 75, -near - 0.35, -near - 5, 0.22, 0.9);
    stLitter(D, R, -75, 75, -0.15, -near + 0.3, 0.16, 0.12);
  });

  // ---- pigeons on the cornices, by day ----
  if (S.pal.dark < 0.45 && !wet && birds.length) {
    const body = S.tone('#80868f', PB), head = S.tone('#5b616a', PB), dk = S.tone('#33373d', PB);
    PB.add({ x0: rowX0 - 1, x1: rowX1 + 1, layer: 0, draw(ctx, env) {
      if (env.s < 7) return;
      const t = env.t, st = [];
      for (let i = 0; i < birds.length; i++) {
        const b = birds[i]; if (b[0] < env.x0 - 1 || b[0] > env.x1 + 1) continue;
        // every few seconds each one pecks, turns about, or gives a little hop
        const cyc = (t + b[2]) / 3.7, c = Math.floor(cyc), u = cyc - c, hk = kxH(c, b[2]), dir = hk > 0.5 ? b[3] : -b[3];
        const hop = hk > 0.82 && u < 0.2 ? Math.sin((u / 0.2) * Math.PI) * 0.12 : 0, peck = hk > 0.3 && hk < 0.7 && u > 0.4 && u < 0.6 ? Math.sin(((u - 0.4) / 0.2) * Math.PI) : 0;
        st.push([b[0], b[1] + hop, dir, peck]);
      }
      if (!st.length) return;
      ctx.fillStyle = body; ctx.beginPath();
      for (const [x, y, d] of st) { ctx.moveTo(x + 0.15, y + 0.1); ctx.ellipse(x, y + 0.1, 0.15, 0.085, -0.15 * d, 0, TAU); ctx.moveTo(x - d * 0.1, y + 0.13); ctx.lineTo(x - d * 0.28, y + 0.07); ctx.lineTo(x - d * 0.26, y + 0.12); ctx.closePath(); }
      ctx.fill();
      ctx.fillStyle = head; ctx.beginPath();
      for (const [x, y, d, p] of st) { const hx = x + d * (0.13 + p * 0.06), hy = y + 0.22 - p * 0.13; ctx.moveTo(hx + 0.05, hy); ctx.arc(hx, hy, 0.05, 0, TAU); ctx.moveTo(x + d * 0.04, y + 0.12); ctx.lineTo(hx, hy - 0.03); ctx.lineTo(hx - d * 0.04, hy + 0.02); ctx.closePath(); }
      ctx.fill();
      if (env.s > 16) { ctx.fillStyle = dk; ctx.beginPath(); for (const [x, y, d, p] of st) { const hx = x + d * (0.13 + p * 0.06), hy = y + 0.22 - p * 0.13; ctx.moveTo(hx + d * 0.04, hy + 0.005); ctx.lineTo(hx + d * 0.1, hy - 0.015); ctx.lineTo(hx + d * 0.04, hy - 0.02); ctx.closePath(); ctx.rect(x - 0.03, y, 0.015, 0.03); ctx.rect(x + 0.02, y, 0.015, 0.03); } ctx.fill(); }
    } });
  }

  // ---- a hotel sign fixed flat to a pier of the last building, its tubes lit after dark ----
  { const B = last, R = makeRng(5171 + seed);
    let sx = null; const sh = 3.3, sy = B.floorY(1) + 0.55;
    if (!B.shop && B.floors >= 4 && B.kStyle !== 'glass') for (let c = 1; c < B.cols && sx === null; c++) { const px = B.x + c * (B.w / B.cols); if (clear(px - 0.5, sy - 0.1, px + 0.5, sy + sh + 0.1)) sx = px; }
    if (sx !== null) {
      const brd = S.tone('#5a1e1c', PB), brdK = S.tone('#20262c', PB), trim = S.tone('#c9b98a', PB), letD = S.tone('#efe4c8', PB), neon = '#ff6a48', ph = R.r(0, 50), word = 'HOTEL';
      PB.add({ x0: sx - 1.5, x1: sx + 1.5, layer: 0, draw(ctx, env) {
        const s = env.s, on = S.pal.dark > 0.3;
        R4(ctx, sx - 0.4, sy, 0.8, sh, on ? brdK : brd);
        if (s > 6) { R4(ctx, sx - 0.5, sy + sh - 0.12, 1.0, 0.07, brdK); R4(ctx, sx - 0.5, sy + 0.08, 1.0, 0.07, brdK); ctx.strokeStyle = trim; ctx.lineWidth = Math.max(0.025, env.px * 0.6); ctx.strokeRect(sx - 0.33, sy + 0.07, 0.66, sh - 0.14); }
        // mostly steady, a stutter every few seconds, and the T that never quite took
        let flick = 1, dead = 1;
        if (on) { const t = env.t + ph, cyc = Math.floor(t / 4.7), u = t / 4.7 - cyc, hk = kxH(cyc, ph); if (u > 0.85 && hk > 0.4) flick = Math.sin(t * 57) > 0.2 ? 1 : 0.35; dead = Math.sin(t * 23) > 0.6 || (hk < 0.3 && u < 0.3) ? 0.25 : 1; }
        if (on && s > 2) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.32 * flick * S.pal.dark; ctx.drawImage(kxBlob(neon), sx - 1.1, sy - 0.3, 2.2, sh + 0.6); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
        for (let i = 0; i < word.length; i++) {
          const a = on ? flick * (i === 2 ? dead : 1) : 1; if (a < 0.3 && on) { env.text(ctx, word[i], sx, sy + sh - 0.64 * (i + 1) - 0.02, 0.52, S.tone('#5a2a24', PB), 'center'); continue; }
          ctx.globalAlpha = a; env.text(ctx, word[i], sx, sy + sh - 0.64 * (i + 1) - 0.02, 0.52, on ? '#ffd8c8' : letD, 'center'); ctx.globalAlpha = 1;
        }
      } });
    }
  }

  // ---- steam from the laundry's vent, drifting up the pier beside it ----
  H.b.forEach((B, i) => {
    const sd = q.styles[i] && q.styles[i].shop; if (!sd || String(sd.sign || '').toUpperCase().indexOf('LAUNDRY') < 0) return;
    const vx = B.x + 0.62, vy = B.base + B.fh + 0.25, sc = S.tone('#f4f6f7', PB), gr = S.tone('#3a3f47', PB), gr2 = S.tone('#5d636c', PB);
    PB.add({ x0: vx - 1.5, x1: vx + 1.5, layer: 0, draw(ctx, env) {
      if (env.s < 4) return;
      R4(ctx, vx - 0.17, vy - 0.1, 0.34, 0.22, gr);
      if (env.s > 14) { ctx.fillStyle = gr2; ctx.beginPath(); for (let k = 0; k < 4; k++) ctx.rect(vx - 0.14, vy - 0.07 + k * 0.05, 0.28, 0.02); ctx.fill(); }
      for (let k = 0; k < 7; k++) { const u = (env.t * 0.3 + k / 7) % 1, r = 0.12 + u * 0.26; kxPuff(ctx, sc, vx - u * 0.3 + Math.sin(u * 7 + k) * 0.05, vy + 0.1 + u * 1.4, r * 1.25, r, 0.5 * (1 - u) * Math.min(1, u * 6)); }
    } });
  });

  // ---- a sheet of newspaper blowing along the road, when it is dry ----
  if (!wet) {
    const pc = S.tone('#e4dfd0', PR), pk = S.tone('#8d8a80', PR);
    PR.add({ x0: -1e4, x1: 1e4, layer: 0, draw(ctx, env) {
      if (env.s < 3) return;
      const t = env.t, w = env.wind || 1, dir = w >= 0 ? 1 : -1, sp = 0.6 + Math.min(2, Math.abs(w)) * 0.35, run = 150;
      const g = t * sp + Math.sin(t * 0.6) * 1.8 + Math.sin(t * 1.7) * 0.4, xx = -75 + (((g % run) + run) % run), x = dir * xx;
      if (x < env.x0 - 1 || x > env.x1 + 1) return;
      const y = -0.6 - Math.sin(t * 0.37) * 0.25, lift = Math.max(0, Math.sin(t * 2.3 + Math.sin(t))) * 0.22, fl = Math.cos(t * 3.1), hw = 0.3 * (0.35 + 0.65 * Math.abs(fl)), hh = 0.05 + lift * 0.6;
      R4(ctx, x - 0.25, y - 0.015, 0.5, 0.025, 'rgba(0,0,0,0.14)');
      poly(ctx, [x - hw, y + lift, x + hw, y + lift + 0.03, x + hw * 0.85, y + lift + hh, x - hw * 0.9, y + lift + hh * 0.8], pc);
      if (env.s > 14 && hh > 0.07) { ctx.fillStyle = pk; for (let k = 1; k < 4; k++) ctx.fillRect(x - hw * 0.7, y + lift + (hh * k) / 4, hw * 1.3, Math.max(0.008, env.px * 0.5)); }
    } });
  }
}

CB.SCN = SCN;
