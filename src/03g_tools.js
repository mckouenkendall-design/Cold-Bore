// ---------------------------------------------------------------------------
// Things in the hand while somebody works or calls for help (picked in src/03f_moves.js):
//   hammer, wrench   held in the fist, the head of it out on the thumb side
//   torch            a welding torch: its hose, a blue-white flame, a glow on the work at night,
//                    and sparks that fall and fade
//   cash             a wad in one hand, a note being counted off in the other
//   radio            a handset at the mouth with a light that blinks while the guard talks
// Drawn in the figure's own space (feet at the origin, facing G.fs), after the near arm.
// ---------------------------------------------------------------------------

function figTool(c, G, kind) {
  const ha = G.haR, el = G.elR, px = G.px, hi = G.hi, fs = G.fs, sq = Math.max(G.fa, 0.22);
  let dx = ha[0] - el[0], dy = ha[1] - el[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  const tx0 = -dy * fs, ty0 = dx * fs; // across the fist, toward the thumb
  // a tool is held out from the fist, between the line of the forearm and the thumb side
  const tk = kind === 'torch' ? 0.55 : kind === 'wrench' ? 0.35 : 0.95, nx = Math.cos(tk) * dx + Math.sin(tk) * tx0, ny = Math.cos(tk) * dy + Math.sin(tk) * ty0;
  const ink = G.ink, metal = figC('#2a2e35');
  c.lineCap = 'round';
  if (kind === 'hammer' || kind === 'wrench') {
    const L = kind === 'hammer' ? 0.32 : 0.27, ex = ha[0] + nx * L * sq, ey = ha[1] + ny * L, bx = ha[0] - nx * 0.04 * sq, by = ha[1] - ny * 0.04;
    c.strokeStyle = figC(kind === 'hammer' ? '#7a5634' : '#5d636c'); c.lineWidth = Math.max(px * 1.1, kind === 'hammer' ? 0.032 : 0.026);
    c.beginPath(); c.moveTo(bx, by); c.lineTo(ex, ey); c.stroke();
    if (kind === 'hammer') { // the head, across the end of the handle
      const hx = -ny * fs * sq, hy = nx * fs; // across the handle, the striking face on the far side from the thumb
      c.strokeStyle = metal; c.lineWidth = Math.max(px * 1.4, 0.052); c.lineCap = 'butt';
      c.beginPath(); c.moveTo(ex + hx * 0.06, ey + hy * 0.06); c.lineTo(ex - hx * 0.08, ey - hy * 0.08); c.stroke(); c.lineCap = 'round';
    } else if (hi) { // the open jaw
      c.strokeStyle = figC('#5d636c'); c.lineWidth = Math.max(px, 0.022); c.beginPath(); c.arc(ex, ey, 0.032, Math.atan2(ny, nx * sq) + 0.9, Math.atan2(ny, nx * sq) + TAU - 0.9); c.stroke();
    }
    if (G.rim && hi) { c.strokeStyle = G.rim; c.lineWidth = Math.max(0.008, px * 0.6); c.beginPath(); c.moveTo(ha[0] + nx * 0.06 * sq + dx * 0.018, ha[1] + ny * 0.06 + dy * 0.018); c.lineTo(ex + dx * 0.018, ey + dy * 0.018); c.stroke(); }
  } else if (kind === 'torch') {
    const tx = ha[0] + nx * 0.17 * sq + dx * 0.04, ty = ha[1] + ny * 0.17 + dy * 0.04; // the nozzle
    // the hose, back from the handle and down to the ground behind
    c.strokeStyle = figC('#1d2026'); c.lineWidth = Math.max(px, 0.018); c.beginPath(); c.moveTo(ha[0] - nx * 0.03, ha[1] - ny * 0.03);
    c.quadraticCurveTo(ha[0] - fs * 0.25, ha[1] - 0.1, ha[0] - fs * 0.32, 0.01); c.stroke();
    c.strokeStyle = metal; c.lineWidth = Math.max(px * 1.1, 0.028); c.beginPath(); c.moveTo(ha[0] - nx * 0.04 * sq, ha[1] - ny * 0.04); c.lineTo(tx, ty); c.stroke();
    const t = G.t, fl = 0.5 + 0.5 * Math.sin(t * 37 + G.seed) * Math.sin(t * 23), dark = G.env.dark || G.env.night;
    // the glow on everything near (dearest bits only close up)
    if (dark) { // a soft blue-white pool of light round the flame
      const R = 0.42, g = c.createRadialGradient(tx, ty, 0, tx, ty, R);
      g.addColorStop(0, 'rgba(200,232,255,' + (0.42 + 0.18 * fl).toFixed(2) + ')'); g.addColorStop(0.25, 'rgba(170,215,255,0.16)'); g.addColorStop(1, 'rgba(170,215,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(tx, ty, R, 0, TAU); c.fill();
    } else if (hi) { c.fillStyle = '#bfe2ff'; c.globalAlpha = 0.14 * (0.7 + 0.3 * fl); c.beginPath(); c.arc(tx, ty, 0.06, 0, TAU); c.fill(); c.globalAlpha = 1; }
    c.fillStyle = '#f4fbff'; c.beginPath(); c.arc(tx + nx * 0.012, ty + ny * 0.012, Math.max(px * 1.2, 0.018 + 0.01 * fl), 0, TAU); c.fill();
    // sparks: each one leaves the flame, falls on a curve and goes out; the same spark at the same time is always in the same place
    if (hi || dark) {
      c.strokeStyle = '#ffd27a'; c.lineWidth = Math.max(px * 0.8, 0.008); c.beginPath();
      for (let i = 0; i < 9; i++) {
        const per = 0.55 + 0.07 * (i % 4), u = ((t + i * 0.137 + G.seed) % per) / per, vx = (((i * 7919) % 13) / 13 - 0.35) * 1.1 * fs, vy = 0.35 + ((i * 31) % 7) * 0.08;
        const x = tx + vx * u * 0.5, y = ty + vy * u * 0.3 - 2.2 * u * u * 0.3, x2 = x - vx * 0.04, y2 = y - (vy - 4.4 * u * 0.3) * 0.04;
        if (y < 0 || u > 0.85) continue;
        c.moveTo(x, y); c.lineTo(x2, y2);
      }
      c.stroke();
    }
  } else if (kind === 'cash') {
    const hb = G.haL, note = figC('#93a684'), edge = figC('#5e7052');
    // the wad in the far hand, a note being peeled off it in the near one
    c.fillStyle = note; c.strokeStyle = edge; c.lineWidth = Math.max(px * 0.7, 0.008);
    c.save(); c.translate(hb[0] + fs * 0.03, hb[1] + 0.012); if (sq < 1) c.scale(sq, 1); c.rotate(fs * 0.25);
    c.beginPath(); c.rect(-0.07, -0.02, 0.14, 0.045); c.fill(); if (hi) c.stroke();
    c.restore();
    const fk = Math.max(0, Math.sin(G.t * 8 + figTraits(G.A).ph));
    c.save(); c.translate(ha[0] + fs * 0.02, ha[1] + 0.01); if (sq < 1) c.scale(sq, 1); c.rotate(fs * (0.4 + 0.9 * fk));
    c.beginPath(); c.rect(-0.01, -0.012, 0.13 * fs, 0.03); c.fill(); if (hi) c.stroke();
    c.restore();
    c.fillStyle = ink; c.beginPath(); c.arc(hb[0], hb[1], 0.033 * G.bw, 0, TAU); c.fill(); // the far hand round the wad
  } else if (kind === 'radio') {
    const rx = ha[0] + nx * 0.035 * sq, ry = ha[1] + ny * 0.035 + 0.02;
    c.save(); c.translate(rx, ry); if (sq < 1) c.scale(sq, 1); c.rotate(-fs * 0.25);
    c.fillStyle = figC('#15181d'); c.beginPath(); figRR(c, -0.03, -0.06, 0.06, 0.13, 0.012); c.fill();
    c.strokeStyle = figC('#15181d'); c.lineWidth = Math.max(px * 0.9, 0.012); c.beginPath(); c.moveTo(-0.015, 0.065); c.lineTo(-0.015, 0.14); c.stroke(); // the aerial
    // the light: red, blinking while he talks
    const on = (G.t * 2.6 + G.seed) % 1 < 0.55, dark = G.env.dark || G.env.night;
    if (on) {
      c.fillStyle = '#ff3b2f'; c.beginPath(); c.arc(0.012, 0.045, Math.max(px * 0.9, 0.011), 0, TAU); c.fill();
      if (dark) { c.globalAlpha = 0.22; c.beginPath(); c.arc(0.012, 0.045, 0.06, 0, TAU); c.fill(); c.globalAlpha = 1; }
    } else if (hi) { c.fillStyle = '#5a1512'; c.beginPath(); c.arc(0.012, 0.045, 0.009, 0, TAU); c.fill(); }
    if (G.rim && hi) { c.strokeStyle = G.rim; c.lineWidth = Math.max(0.008, px * 0.6); c.beginPath(); c.moveTo(0.032, -0.05); c.lineTo(0.032, 0.06); c.stroke(); }
    c.restore();
  }
  // the fist round it
  c.fillStyle = ink; c.beginPath(); c.arc(ha[0], ha[1], 0.036 * G.bw, 0, TAU); c.fill();
}
