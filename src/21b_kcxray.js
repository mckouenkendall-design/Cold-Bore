// ---------------------------------------------------------------------------
// The kill camera's X-ray of the body (the film itself is src/21_killcam.js).
//
// The look is a radiograph, not a picture book: a dark blue-black film; soft tissue a dim
// blue-green with a pale skin line; bone white with bright edges (the hard outer shell) and
// a duller middle; organs faint blue-green shapes, the dense ones a little brighter. Red is
// kept for one thing only: damage. What the round breaks stays broken for the rest of the
// film: ribs snapped with crack lines, cracks that run out over the skull from both holes, a
// heart split along the wound, a lung that collapses, bruising that spreads through organs,
// and the wound itself (a cavity that balloons open behind the round, ripples and falls in
// to a ragged channel).
//
// Everything is placed in the body's own axes (the trunk and head frames that kcBuildFig
// makes), so it turns and falls with the body and reads the same from any camera angle.
// Units are metres on a figure of normal height (times fig.sc). In the trunk, a is toward the
// person's left, b up from the hip joints (often as a share of the hip-to-neck length L) and
// c forward; in the head, a, u (up) and f (toward the face) from the middle of the head.
// With gore off the organs are left out and damage is shown in pale blue instead of red.
// ---------------------------------------------------------------------------
const kcXC = {
  rim: '#5aa9b2', flesh: '#0f343c', glow: 'rgba(52,128,138,',
  bone: '#e4f1ee', boneMid: '#93b8b9', boneFar: '#6c9496',
  organ: 'rgba(66,150,160,', organEdge: 'rgba(140,212,216,',
  red: '#e0303a', redHi: '#ff7a6c', redD: '#43040b', bruise: 'rgba(170,18,34,', crack: '#020609',
};
const kcXCold = { red: '#cfe8ee', redHi: '#ffffff', redD: '#06141c', bruise: 'rgba(60,110,130,' };
const kcXc = (K, k) => (K.gore || !kcXCold[k] ? kcXC[k] : kcXCold[k]);
// The ribs, top pair first: [height where it leaves the spine (share of L), half-width (m),
// how far its front end drops (m), how far round it reaches (share of a half turn), how deep
// the cage is at that height (share)]. The top seven reach the breastbone, the next three
// join the cartilage above them, the last two float.
const kcRibT = [
  [0.95, 0.058, 0.04, 1, 0.55], [0.905, 0.087, 0.06, 1, 0.74], [0.86, 0.106, 0.076, 1, 0.86], [0.815, 0.119, 0.09, 1, 0.94],
  [0.77, 0.128, 0.102, 1, 1], [0.725, 0.134, 0.112, 1, 1], [0.68, 0.136, 0.12, 1, 1], [0.635, 0.134, 0.124, 0.92, 1],
  [0.59, 0.129, 0.124, 0.87, 1], [0.545, 0.12, 0.118, 0.82, 1], [0.5, 0.106, 0.075, 0.56, 0.95], [0.455, 0.09, 0.05, 0.44, 0.9],
];
const kcRibC = 0.0165, kcRibD = 0.0715; // the cage's middle front to back, and its half-depth (m)
// a point on rib row i, side sg (+1 the person's left), q of the way round from the spine to the front
function kcRibPt(fig, i, sg, q, out) {
  const r = kcRibT[i], an = q * Math.PI, sc = fig.sc, L = fig.tor.L, sa = Math.sin(an), ca = Math.cos(an);
  // (each rib rises a little as it leaves the spine, then sweeps down and round to the front)
  out[0] = sg * (0.02 + r[1] * sa) * sc * fig.bw; out[1] = L * r[0] - r[2] * sc * (1 - ca) / 2 + 0.012 * sc * Math.sin(Math.min(an, 1.5) * 2.1); out[2] = (kcRibC - kcRibD * r[4] * ca) * sc;
  return out;
}
// Which rib row a round at height b0 and depth c0 (trunk metres) crosses, and where round it:
// { i, q, w: half-width there } or null.
function kcRibHit(fig, b0, c0) {
  const sc = fig.sc, L = fig.tor.L;
  let best = null;
  for (let i = 0; i < kcRibT.length; i++) {
    const r = kcRibT[i], q = Math.acos(clamp((kcRibC - c0 / sc) / (kcRibD * r[4]), -1, 1)) / Math.PI;
    if (q > r[3] + 0.02) continue;
    const an = q * Math.PI, bb = L * r[0] - r[2] * sc * (1 - Math.cos(an)) / 2 + 0.012 * sc * Math.sin(Math.min(an, 1.5) * 2.1), d = Math.abs(bb - b0);
    if (d < 0.024 * sc && (!best || d < best.d)) best = { i, q, d, w: (0.02 + r[1] * Math.sin(q * Math.PI)) * sc * fig.bw };
  }
  return best;
}
// The skull: the vault is an egg shape round this middle with these half-sizes (head axes, m).
const kcSkC = [0, 0.04, -0.022], kcSkR = [0.094, 0.093, 0.119];
const kcBrC = [0, 0.046, -0.024], kcBrR = [0.08, 0.078, 0.101];
const kcSkK = 1.1; // the skull is drawn this much larger than life, to fill the game's big round heads
// How far the round's line (along the head's side axis, at height u0 and depth f0) runs inside
// an egg shape of middle m and half-sizes r: half the chord, or 0 if it misses.
function kcChord(m, r, sc, u0, f0) {
  const k = 1 - Math.pow((u0 - m[1] * sc) / (r[1] * sc), 2) - Math.pow((f0 - m[2] * sc) / (r[2] * sc), 2);
  return k > 0 ? r[0] * sc * Math.sqrt(k) : 0;
}
// The vertebrae up the trunk: [height (share of L), half-width, half-height, depth (m)]
const kcVertT = [];
for (let i = 0; i < 17; i++) {
  const b = 0.1 + i * (0.85 / 16), lum = i < 5;
  kcVertT.push([b, lum ? 0.026 - i * 0.0006 : 0.0205 - (i - 5) * 0.0004, lum ? 0.0115 : 0.0092 - (i - 5) * 0.00012, -0.05 + 0.009 * Math.cos((b - 0.18) * 5.2)]);
}
// The teeth along one side of the jaw: [across, forward] at the biting edge, front tooth first
const kcTooth = [];
for (let k = 0; k < 8; k++) { const t = (k + 0.5) / 8; kcTooth.push([0.005 + 0.031 * Math.pow(t, 0.62), 0.114 - 0.074 * Math.pow(t, 1.45), k < 2 ? 0.0052 : k < 3 ? 0.0058 : k < 5 ? 0.0066 : 0.0085]); }
// lines through the lungs: the windpipe's branches, as [a, b share of L, c] runs from the root of each lung
const kcBronch = [
  [0.02, 0.76, 0, 0.05, 0.86, 0.01, 0.06, 0.9, 0.0], [0.02, 0.75, 0, 0.07, 0.74, 0.02, 0.1, 0.76, 0.03], [0.022, 0.73, 0, 0.06, 0.66, 0.0, 0.08, 0.6, -0.01],
  [0.05, 0.86, 0.01, 0.035, 0.9, 0.015], [0.07, 0.74, 0.02, 0.09, 0.71, 0.0], [0.06, 0.66, 0, 0.045, 0.6, 0.02], [0.08, 0.6, -0.01, 0.1, 0.62, 0.0],
];
const kcXQ = [0, 0, 0, 0], kcXQ2 = [0, 0, 0, 0], kcXL = [0, 0, 0], kcXV = [0, 0, 0], kcXV2 = [0, 0, 0], kcXV3 = [0, 0, 0];

// Put every joint of the figure through the camera (fig.S), as the outline drawing does.
// A joint behind the lens is marked (q[4] = 0) and whatever hangs on it is left out; the body is
// only given up if its middle cannot be seen.
function kcFigProj(c, fig) {
  const P = fig.P, S = fig.S;
  for (const k in P) { const q = S[k] || (S[k] = [0, 0, 0, 0, 1]); q[4] = kcProj(c, P[k][0], P[k][1], P[k][2], q) ? 1 : 0; }
  return !!(S.hip[4] && S.sh[4]);
}
const kcSeen = (S, a, b, d) => S[a][4] && S[b][4] && (!d || S[d][4]);
// A point in a frame's own axes, put through the camera into out.
const kcXP = (c, fr, a, b, cc, out) => { kcLoc(fr, a, b, cc, kcXL); return kcProj(c, kcXL[0], kcXL[1], kcXL[2], out); };
// An egg shape in a frame's own axes (half-sizes ra, rb, rc along S, U, F), added to the path.
function kcXEgg(ctx, c, fr, a, b, cc, ra, rb, rc) {
  kcLoc(fr, a, b, cc, kcXL);
  kcMul(kcXV, fr.S, ra); kcMul(kcXV2, fr.U, rb); kcMul(kcXV3, fr.F, rc);
  return kcEll(ctx, c, kcXL[0], kcXL[1], kcXL[2], kcXV, kcXV2, kcXV3);
}
// a run of points [a, b, c, ...] in a frame (times k, a times flip), added to the path; b may be a share of L (bl)
function kcXRun(ctx, c, fr, pts, k, flip, bl, close) {
  let ok = false;
  for (let i = 0; i < pts.length; i += 3) {
    if (!kcXP(c, fr, pts[i] * k * flip, bl ? pts[i + 1] * bl : pts[i + 1] * k, pts[i + 2] * k, kcXQ)) { ok = false; continue; }
    if (!ok) ctx.moveTo(kcXQ[0], kcXQ[1]); else ctx.lineTo(kcXQ[0], kcXQ[1]);
    ok = true;
  }
  if (close) ctx.closePath();
}
// Bone as a radiograph shows it: the stroke laid down wide in bone white (the hard edges), then
// narrower in a duller tone (the softer middle), so every bone has bright edges.
function kcXBand(ctx, w, al, far) {
  ctx.globalAlpha = al * (far ? 0.5 : 0.95); ctx.strokeStyle = far ? kcXC.boneMid : kcXC.bone; ctx.lineWidth = Math.max(1, w); ctx.stroke();
  if (w > 3) { const e = Math.max(1.1, w * 0.16); ctx.globalAlpha = al * (far ? 0.7 : 0.62); ctx.strokeStyle = far ? '#14262a' : '#203b40'; ctx.lineWidth = w - 2 * e; ctx.stroke(); }
}
// a filled bone (a plate: skull, pelvis, a shoulder blade): duller fill, bright edge
function kcXPlate(ctx, w, al, fillA, far) {
  ctx.globalAlpha = al * fillA * 0.75; ctx.fillStyle = far ? kcXC.boneFar : kcXC.boneMid; ctx.fill();
  ctx.globalAlpha = al * (far ? 0.6 : 0.95); ctx.strokeStyle = kcXC.bone; ctx.lineWidth = Math.max(1, w); ctx.stroke();
}
// the age of a piece of damage, in the film's own clock (which stands still in a freeze), or -1
const kcAge = (K, k) => (K.dmg[k] === undefined ? -1 : K.ct - K.dmg[k]);

// ---- the soft tissue --------------------------------------------------------------------------
// One silhouette for the whole body: everything is laid down first a little larger in the skin
// colour, then at its own size in the flesh colour, so the skin line runs round the outside only.
// A third, fainter pass in the middle of the trunk and limbs gives them thickness.
function kcXFlesh(ctx, K, c, fig, al) {
  const S = fig.S, tor = fig.tor, hd = fig.hd, sc = fig.sc, bw = fig.bw, L = tor.L;
  const limbs = [['shL', 'elL', 0.05, 0.04, 'haL'], ['shR', 'elR', 0.05, 0.04, 'haR'], ['hpL', 'knL', 0.078, 0.056, 'ftL'], ['hpR', 'knR', 0.078, 0.056, 'ftR']];
  const trunk = [[0, 0.72, 0.008, 0.168, 0.2, 0.112], [0, 0.42, 0.018, 0.148, 0.18, 0.106], [0, 0.08, -0.004, 0.172, 0.13, 0.104]];
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const shapes = (grow, k, inner) => {
    // trunk and head
    ctx.beginPath();
    for (let i = 0; i < trunk.length; i++) { const t = trunk[i]; kcXEgg(ctx, c, tor, t[0], t[1] * L, t[2] * sc, t[3] * sc * bw * k, t[4] * L * k, t[5] * sc * k); }
    if (!inner) {
      kcXEgg(ctx, c, hd, 0, -0.005 * sc, 0.006 * sc, fig.hr * 0.86, fig.hr * 0.93, fig.hr * 0.95);
      kcXEgg(ctx, c, tor, 0.17 * sc * bw, L * 0.92, -0.01 * sc, 0.06 * sc, 0.055 * sc, 0.06 * sc); kcXEgg(ctx, c, tor, -0.17 * sc * bw, L * 0.92, -0.01 * sc, 0.06 * sc, 0.055 * sc, 0.06 * sc);
    }
    ctx.fill(); if (grow) ctx.stroke();
    // the neck
    if (!inner && kcXP(c, tor, 0, L * 0.97, -0.01 * sc, kcXQ) && kcXP(c, hd, 0, -0.1 * sc, -0.02 * sc, kcXQ2)) { ctx.lineWidth = 0.056 * 2 * sc * kcXQ[2] * k + grow; ctx.beginPath(); ctx.moveTo(kcXQ[0], kcXQ[1]); ctx.lineTo(kcXQ2[0], kcXQ2[1]); ctx.stroke(); }
    // arms and legs: a fat upper part and a slimmer lower one, each its own width
    for (let i = 0; i < limbs.length; i++) {
      const l = limbs[i], a = S[l[0]], b = S[l[1]], d = S[l[4]]; if (!kcSeen(S, l[0], l[1], l[4])) continue;
      ctx.lineWidth = l[2] * 2 * sc * (a[2] + b[2]) / 2 * k + grow; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.lineWidth = l[3] * 2 * sc * (b[2] + d[2]) / 2 * k + grow; ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(d[0], d[1]); ctx.stroke();
    }
  };
  ctx.globalAlpha = al * 0.32; ctx.fillStyle = kcXC.rim; ctx.strokeStyle = kcXC.rim; ctx.lineWidth = 1.6; shapes(1.6, 1, false);
  ctx.globalAlpha = al * 0.5; ctx.fillStyle = kcXC.flesh; ctx.strokeStyle = kcXC.flesh; shapes(0, 1, false);
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al; ctx.fillStyle = kcXC.glow + '0.1)'; ctx.strokeStyle = kcXC.glow + '0.08)'; shapes(0, 0.72, true);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}

// ---- the skeleton ----------------------------------------------------------------------------
// Adds everything to items as { z: distance from the lens, f() }, to be drawn far to near.
function kcXBones(ctx, K, c, fig, al, items) {
  const tor = fig.tor, hd = fig.hd, P = fig.P, S = fig.S, sc = fig.sc, bw = fig.bw, fs = fig.fs, L = tor.L, pl = K.plan;
  const zAt = (fr, a, b, cc) => { kcLoc(fr, a, b, cc, kcXL); return (kcXL[0] - c.x) * c.fx + (kcXL[1] - c.y) * c.fy + (kcXL[2] - c.z) * c.fz; };
  if (!kcXP(c, tor, 0, L * 0.7, 0, kcXQ)) return;
  const ps = kcXQ[2] * sc; // pixels per metre at the chest
  const dA = kcDot(tor.S, c.fx, c.fy, c.fz), dC = kcDot(tor.F, c.fx, c.fy, c.fz);
  const red = kcXc(K, 'red'), crack = kcXC.crack;

  // ---- ribs: each row a band from the spine round to the front; cartilage (dimmer) to the breastbone.
  // The half of the cage turned away from us is drawn first and dimmer.
  const ribs = (near) => {
    const hit = pl && pl.part === 'torso' ? pl.rib : null, aIn = kcAge(K, 'ribIn'), aOut = kcAge(K, 'ribOut');
    const big = K.cal === 'c50' || K.cal === 'c408' || K.cal === 'crail';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const cart = [];
    for (let part = 0; part < 3; part++) { // the back, the side and the front of each rib: thinner toward the front
    ctx.beginPath(); ctx.lineCap = part === 2 ? 'round' : 'butt';
    for (let i = 0; i < kcRibT.length; i++) {
      const r = kcRibT[i];
      for (let sg = -1; sg <= 1; sg += 2) {
        // the rows the round broke: a gap where it went through, the ends knocked the way it was going
        const rows = hit ? Math.abs(i - hit.i) : 99, brk = rows === 0 || (big && rows === 1) ? (sg === -fs ? aIn : aOut) : -1;
        const push = brk >= 0 ? 0.016 * sc * easeOut(brk / 0.25) * (rows ? 0.6 : 1) : 0;
        let pen = false;
        const n = 12, qe = r[3];
        for (let j = Math.floor((part * n) / 3); j <= Math.min(n, Math.floor(((part + 1) * n) / 3)); j++) {
          const q = (j / n) * Math.min(qe, 0.86);
          kcRibPt(fig, i, sg, q, kcXV);
          if (brk >= 0) { const dq = Math.abs(q - hit.q); if (dq < 0.045 + (rows ? 0.02 : 0)) { pen = false; continue; } kcXV[0] += fs * push * Math.max(0, 1 - dq / 0.3); kcXV[1] -= push * 0.3 * Math.max(0, 1 - dq / 0.3); }
          const isNear = kcXV[0] * dA + kcXV[2] * dC < 0;
          if (!kcXP(c, tor, kcXV[0], kcXV[1], kcXV[2], kcXQ)) { pen = false; continue; }
          if (pen && isNear === near) ctx.lineTo(kcXQ[0], kcXQ[1]); else ctx.moveTo(kcXQ[0], kcXQ[1]);
          pen = true;
        }
        if (qe > 0.86 && part === 2) cart.push(i, sg);
      }
    }
    kcXBand(ctx, (0.0118 - part * 0.0022) * ps, al, !near);
    }
    // cartilage to the breastbone (the false ribs run up to the one above)
    ctx.beginPath();
    for (let k = 0; k < cart.length; k += 2) {
      const i = cart[k], sg = cart[k + 1], r = kcRibT[i];
      kcRibPt(fig, i, sg, 0.86, kcXV); if ((kcXV[0] * dA + kcXV[2] * dC < 0) !== near) continue;
      if (!kcXP(c, tor, kcXV[0], kcXV[1], kcXV[2], kcXQ)) continue; ctx.moveTo(kcXQ[0], kcXQ[1]);
      if (r[3] >= 1) { kcRibPt(fig, i, sg, 0.97, kcXV); if (kcXP(c, tor, sg * 0.024 * sc, kcXV[1], 0.086 * sc, kcXQ)) ctx.lineTo(kcXQ[0], kcXQ[1]); }
      else if (kcXP(c, tor, sg * 0.04 * sc * bw, L * (0.6 - (i - 7) * 0.012), 0.08 * sc, kcXQ)) ctx.lineTo(kcXQ[0], kcXQ[1]);
    }
    ctx.globalAlpha = al * (near ? 0.5 : 0.3); ctx.strokeStyle = kcXC.boneMid; ctx.lineWidth = Math.max(1, 0.009 * ps); ctx.stroke();
    // crack lines across the broken ends, and the splintered tips
    if (hit && (aIn >= 0 || aOut >= 0)) {
      const R = makeRng(hit.i * 31 + 7);
      ctx.beginPath();
      for (let sg = -1; sg <= 1; sg += 2) {
        const ag = sg === -fs ? aIn : aOut; if (ag < 0) continue;
        for (let rr = big ? -1 : 0; rr <= (big ? 1 : 0); rr++) {
          const i = hit.i + rr; if (i < 0 || i >= kcRibT.length) continue;
          for (let e = -1; e <= 1; e += 2) for (let k = 0; k < 3; k++) {
            const q = hit.q + e * (0.05 + 0.022 * k + R.f() * 0.01); kcRibPt(fig, i, sg, q, kcXV);
            const push = 0.016 * sc * easeOut(ag / 0.25) * (rr ? 0.6 : 1) * Math.max(0, 1 - Math.abs(q - hit.q) / 0.3);
            const isNear = kcXV[0] * dA + kcXV[2] * dC < 0; if (isNear !== near) continue;
            const x = kcXV[0] + fs * push, y = kcXV[1] - push * 0.3, z = kcXV[2], h = 0.009 * sc * (0.7 + R.f() * 0.6);
            if (kcXP(c, tor, x, y + h, z + (R.f() - 0.5) * 0.004, kcXQ) && kcXP(c, tor, x + (R.f() - 0.5) * 0.006 * sc, y - h, z, kcXQ2)) { ctx.moveTo(kcXQ[0], kcXQ[1]); ctx.lineTo(kcXQ2[0], kcXQ2[1]); }
          }
        }
      }
      ctx.globalAlpha = al; ctx.strokeStyle = crack; ctx.lineWidth = Math.max(1, 0.0035 * ps); ctx.stroke();
      if (K.gore) { ctx.globalAlpha = al * 0.55; ctx.strokeStyle = red; ctx.lineWidth = Math.max(1, 0.0016 * ps); ctx.stroke(); }
    }
  };
  const zr = zAt(tor, 0, L * 0.7, 0.02 * sc);
  items.push({ z: zr + 0.09, f() { ribs(false); } }, { z: zr - 0.09, f() { ribs(true); } });

  // ---- the spine: a stack of separate bones with a gap (the disc) between each, the spikes at the
  // back and the wings at the sides; seven small ones up the neck into the skull
  items.push({ z: zAt(tor, 0, L * 0.6, -0.06 * sc), f() {
    const aS = kcAge(K, 'spine'), aC = kcAge(K, 'spineC'), n = kcVertT.length;
    let iB = -1; if (aS >= 0 && pl) { let d = 1e9; for (let i = 0; i < n; i++) { const dd = Math.abs(kcVertT[i][0] * L - pl.b0); if (dd < d) { d = dd; iB = i; } } }
    const kk = aS >= 0 ? easeOut(aS / 0.3) : 0;
    // the neck: from the top of the trunk to the base of the skull
    kcLoc(tor, 0, L * 1.0, -0.042 * sc, kcXV2); kcLoc(hd, 0, -0.085 * sc, -0.035 * sc, kcXV3);
    let iC = -1; if (aC >= 0 && pl && pl.part === 'head') iC = clamp(Math.round(((pl.u0 / sc + 0.07) / -0.07) * 6), 1, 5);
    // each a short drum: a rounded middle and the flat plates at its top and bottom
    const body = (x, y, z, Uv, hw, hh) => {
      kcMul(kcXV, tor.S, hw); kcSet(kcL0, Uv[0] * hh, Uv[1] * hh, Uv[2] * hh); kcMul(kcL1, tor.F, hw * 0.85); kcEll(ctx, c, x, y, z, kcXV, kcL0, kcL1);
      const k = 0.78; kcEll(ctx, c, x + Uv[0] * hh * k, y + Uv[1] * hh * k, z + Uv[2] * hh * k, kcXV, kcL1); kcEll(ctx, c, x - Uv[0] * hh * k, y - Uv[1] * hh * k, z - Uv[2] * hh * k, kcXV, kcL1);
    };
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      if (i === iB) continue;
      const v = kcVertT[i]; let a = 0;
      if (iB >= 0 && Math.abs(i - iB) === 1) a = fs * 0.01 * sc * kk * (i > iB ? 1 : -0.6);
      kcLoc(tor, a, v[0] * L, v[3] * sc, kcXL); body(kcXL[0], kcXL[1], kcXL[2], tor.U, v[1] * sc, v[2] * sc);
    }
    for (let i = 0; i < 7; i++) {
      if (i === iC) continue;
      const t = (i + 0.5) / 7, x = lerp(kcXV2[0], kcXV3[0], t), y = lerp(kcXV2[1], kcXV3[1], t), z = lerp(kcXV2[2], kcXV3[2], t) + (iC >= 0 && Math.abs(i - iC) === 1 ? (i > iC ? 0.01 : -0.006) * sc * easeOut(aC / 0.3) : 0);
      kcMul(kcXV, tor.S, 0.0145 * sc); kcMul(kcL0, hd.U, 0.0068 * sc); kcMul(kcL1, tor.F, 0.012 * sc); kcEll(ctx, c, x, y, z, kcXV, kcL0, kcL1);
    }
    kcXPlate(ctx, 0.0022 * ps, al * 0.8, 0.6, false);
    // spikes and wings
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      if (i === iB) continue;
      const v = kcVertT[i], b = v[0] * L, cc = v[3] * sc, hw = v[1] * sc;
      if (kcXP(c, tor, 0, b, cc - hw * 0.8, kcXQ) && kcXP(c, tor, 0, b - v[2] * sc * 1.8, cc - hw * 2.1, kcXQ2)) { ctx.moveTo(kcXQ[0], kcXQ[1]); ctx.lineTo(kcXQ2[0], kcXQ2[1]); }
      if (kcXP(c, tor, -hw * 2, b + v[2] * sc * 0.3, cc - hw * 0.5, kcXQ) && kcXP(c, tor, hw * 2, b + v[2] * sc * 0.3, cc - hw * 0.5, kcXQ2)) { ctx.moveTo(kcXQ[0], kcXQ[1]); ctx.lineTo(kcXQ2[0], kcXQ2[1]); }
    }
    ctx.globalAlpha = al * 0.8; ctx.strokeStyle = kcXC.boneMid; ctx.lineWidth = Math.max(1, 0.0055 * ps); ctx.lineCap = 'round'; ctx.stroke();
    // the broken one: pieces knocked out along the round's way, cracks in its neighbours
    if (iB >= 0) {
      const v = kcVertT[iB], R = makeRng(iB * 13 + 5);
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const an = k * 1.7 + R.f(), d = 0.008 * sc + 0.03 * sc * kk * (0.5 + R.f()), a = fs * d + Math.cos(an) * 0.006 * sc, b = v[0] * L + Math.sin(an) * 0.01 * sc - 0.004 * sc * kk;
        kcXEgg(ctx, c, tor, a, b, v[3] * sc + (R.f() - 0.5) * 0.01 * sc, v[1] * sc * (0.32 + 0.2 * R.f()), v[2] * sc * (0.5 + 0.3 * R.f()), v[1] * sc * 0.4);
      }
      kcXPlate(ctx, 0.003 * ps, al, 0.9, false);
      ctx.beginPath();
      for (let e = -1; e <= 1; e += 2) { const w = kcVertT[clamp(iB + e, 0, n - 1)]; if (kcXP(c, tor, -w[1] * sc * 0.8, w[0] * L + e * 0.002, w[3] * sc, kcXQ) && kcXP(c, tor, w[1] * sc * 0.7, w[0] * L - e * 0.004 * sc, w[3] * sc, kcXQ2)) { ctx.moveTo(kcXQ[0], kcXQ[1]); ctx.lineTo((kcXQ[0] + kcXQ2[0]) / 2, (kcXQ[1] + kcXQ2[1]) / 2 + 2); ctx.lineTo(kcXQ2[0], kcXQ2[1]); } }
      ctx.globalAlpha = al; ctx.strokeStyle = crack; ctx.lineWidth = Math.max(1, 0.003 * ps); ctx.stroke();
    }
  } });

  // ---- breastbone, collar bones, shoulder blades
  items.push({ z: zAt(tor, 0, L * 0.8, 0.088 * sc), f() {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); kcXRun(ctx, c, tor, [-0.022, 0.935, 0.086, 0.022, 0.935, 0.086, 0.016, 0.87, 0.09, 0.013, 0.66, 0.088, 0.005, 0.62, 0.084, -0.005, 0.62, 0.084, -0.013, 0.66, 0.088, -0.016, 0.87, 0.09], sc, 1, L, true);
    kcXPlate(ctx, 0.0025 * ps, al * 0.55, 0.3, false);
    const bS = kcAge(K, fs > 0 ? 'shIn' : 'shOut') >= 0, bS2 = kcAge(K, fs > 0 ? 'shOut' : 'shIn') >= 0, w = fig.ws / sc;
    for (let sg = -1; sg <= 1; sg += 2) {
      const br = sg < 0 ? bS : bS2;
      ctx.beginPath();
      if (br) { kcXRun(ctx, c, tor, [0.024, 0.94, 0.084, w * 0.42, 0.958, 0.07], sc, sg, L); kcXRun(ctx, c, tor, [w * 0.58, 0.96, 0.05, w * 0.82, 0.966, 0.03, w, 0.96, 0.005], sc, sg, L); }
      else kcXRun(ctx, c, tor, [0.024, 0.94, 0.084, w * 0.42, 0.958, 0.072, w * 0.72, 0.968, 0.04, w, 0.96, 0.005], sc, sg, L);
      kcXBand(ctx, 0.012 * ps, al, false);
    }
  } });
  items.push({ z: zAt(tor, 0, L * 0.8, -0.09 * sc), f() {
    for (let sg = -1; sg <= 1; sg += 2) {
      ctx.beginPath(); kcXRun(ctx, c, tor, [0.05, 0.92, -0.082, 0.155 * bw, 0.93, -0.05, 0.14 * bw, 0.88, -0.055, 0.075, 0.66, -0.08], sc, sg, L, true);
      kcXPlate(ctx, 0.004 * ps, al * 0.75, 0.22, true);
      ctx.beginPath(); kcXRun(ctx, c, tor, [0.055, 0.885, -0.086, 0.15 * bw, 0.91, -0.056], sc, sg, L); ctx.globalAlpha = al * 0.5; ctx.strokeStyle = kcXC.boneMid; ctx.lineWidth = Math.max(1, 0.006 * ps); ctx.stroke();
    }
  } });

  // ---- the pelvis: two wings with thick rims, the sockets the thigh bones sit in, the ring in
  // front, the wedge of the lowest spine at the back
  items.push({ z: zAt(tor, 0, 0.03 * sc, 0), f() {
    const k = sc * bw, ac = Math.max(0.085, fig.wh / k - 0.012);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let sg = -1; sg <= 1; sg += 2) {
      const br = kcAge(K, sg === -fs ? 'pelvIn' : 'pelvOut'), sh = br >= 0 ? 0.012 * easeOut(br / 0.3) : 0;
      // the wing
      ctx.beginPath();
      kcXRun(ctx, c, tor, [0.032, 0.075, -0.075, 0.075, 0.122, -0.066, 0.118, 0.14, -0.032, 0.138, 0.122, 0.01, 0.125, 0.085, 0.05, 0.112, 0.048, 0.046, ac, 0.014, 0.034, ac - 0.02, -0.01, 0.0, 0.06, -0.028, -0.05, 0.046, 0.018, -0.07], k, sg, 0, true);
      kcXPlate(ctx, 0.0045 * ps, al, 0.32, false);
      // its rim
      ctx.beginPath(); kcXRun(ctx, c, tor, [0.032, 0.075 + sh, -0.075, 0.075, 0.122 + sh, -0.066, 0.118, 0.14, -0.032, 0.138, 0.122, 0.01, 0.125, 0.085, 0.05], k, sg, 0); kcXBand(ctx, 0.01 * ps, al, false);
      // the socket
      ctx.beginPath(); kcLoc(tor, sg * ac * k, -0.005 * sc, 0.022 * sc, kcXL); kcMul(kcXV, tor.U, 0.027 * sc); kcMul(kcXV2, tor.F, 0.027 * sc);
      if (kcEll(ctx, c, kcXL[0], kcXL[1], kcXL[2], kcXV, kcXV2)) { ctx.globalAlpha = al * 0.85; ctx.strokeStyle = kcXC.bone; ctx.lineWidth = Math.max(1, 0.006 * ps); ctx.stroke(); }
      // the ring below: the bones round the opening in front, joining in the middle
      ctx.beginPath(); kcXRun(ctx, c, tor, [ac - 0.01, -0.03, 0.045, 0.045, -0.058, 0.07, 0.006, -0.068, 0.076, 0.006, -0.085, 0.07, 0.048, -0.094, 0.03, 0.072, -0.082, -0.016, ac - 0.022, -0.035, -0.012], k, sg, 0); kcXBand(ctx, 0.009 * ps, al, false);
      ctx.beginPath(); kcLoc(tor, sg * 0.055 * k, -0.066 * sc, 0.036 * sc, kcXL); kcMul(kcXV, tor.U, 0.022 * sc); kcSet(kcXV2, tor.F[0] * 0.016 * sc + tor.S[0] * sg * 0.008 * sc, tor.F[1] * 0.016 * sc + tor.S[1] * sg * 0.008 * sc, tor.F[2] * 0.016 * sc + tor.S[2] * sg * 0.008 * sc);
      if (kcEll(ctx, c, kcXL[0], kcXL[1], kcXL[2], kcXV, kcXV2)) { ctx.globalAlpha = al * 0.55; ctx.fillStyle = '#03080c'; ctx.fill(); ctx.globalAlpha = al * 0.6; ctx.strokeStyle = kcXC.boneMid; ctx.lineWidth = 1; ctx.stroke(); }
      if (br >= 0) { // a fracture through the wing
        ctx.beginPath(); kcXRun(ctx, c, tor, [0.13, 0.13, -0.02, 0.105, 0.08, 0.0, 0.11, 0.05, 0.02, 0.09, 0.02, 0.03], k, sg, 0);
        ctx.globalAlpha = al; ctx.strokeStyle = crack; ctx.lineWidth = Math.max(1.2, 0.004 * ps); ctx.stroke();
      }
    }
    // the wedge at the back, with its holes
    ctx.beginPath(); kcXRun(ctx, c, tor, [-0.046, 0.07, -0.07, 0.046, 0.07, -0.07, 0.03, 0.0, -0.075, 0.012, -0.06, -0.072, 0, -0.085, -0.066, -0.012, -0.06, -0.072, -0.03, 0.0, -0.075], k, 1, 0, true);
    kcXPlate(ctx, 0.004 * ps, al, 0.4, false);
    ctx.beginPath(); for (let i = 0; i < 4; i++) for (let sg = -1; sg <= 1; sg += 2) { if (kcXP(c, tor, sg * (0.022 - i * 0.003) * k, (0.045 - i * 0.026) * sc, -0.074 * sc, kcXQ)) { const r = Math.max(0.8, 0.0045 * ps); ctx.moveTo(kcXQ[0] + r, kcXQ[1]); ctx.arc(kcXQ[0], kcXQ[1], r, 0, TAU); } }
    ctx.globalAlpha = al * 0.6; ctx.fillStyle = '#03080c'; ctx.fill();
  } });

  // ---- arms and legs: one bone above the joint (with its ball end), two below, the joints' knuckles,
  // a kneecap, and the small bones of the hands and feet when they are big enough to see
  const limb = (a, b, d, wU, brU, brF, leg) => kcSeen(S, a, b, d) && items.push({ z: (S[a][3] + S[b][3] + S[d][3]) / 3 - 0.01, f() {
    const s = ((S[a][2] + S[b][2]) / 2) * sc, aU = kcAge(K, brU), aF = kcAge(K, brF), far = (S[a][3] + S[d][3]) / 2 > (S.sh[3] + S.hip[3]) / 2 + 0.02;
    ctx.lineCap = 'round';
    const piece = (p, q, br, w, nudge) => {
      ctx.beginPath();
      const ox = nudge ? nudge[0] : 0, oy = nudge ? nudge[1] : 0;
      if (br >= 0) {
        const k = 0.05 * s * easeOut(br / 0.25), l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, dx = (q[1] - p[1]) / l, dy = -(q[0] - p[0]) / l, mx = (p[0] + q[0]) / 2 + ox, my = (p[1] + q[1]) / 2 + oy;
        ctx.moveTo(p[0] + ox, p[1] + oy); ctx.lineTo(mx - (q[0] - p[0]) * 0.05 + dx * k, my - (q[1] - p[1]) * 0.05 + dy * k);
        ctx.moveTo(mx + (q[0] - p[0]) * 0.05 - dx * k * 0.6, my + (q[1] - p[1]) * 0.05 - dy * k * 0.6); ctx.lineTo(q[0] + ox, q[1] + oy);
      } else { ctx.moveTo(p[0] + ox, p[1] + oy); ctx.lineTo(q[0] + ox, q[1] + oy); }
      kcXBand(ctx, w * s, al, far);
    };
    piece(S[a], S[b], aU, wU);
    const lx = S[d][0] - S[b][0], ly = S[d][1] - S[b][1], ll = Math.hypot(lx, ly) || 1, nx = -ly / ll, ny = lx / ll, off = 0.008 * s;
    piece(S[b], S[d], aF, wU * 0.62, [nx * off, ny * off]);
    piece(S[b], S[d], aF, wU * 0.36, [-nx * off * 1.2, -ny * off * 1.2]);
    // the ball at the top, knuckles at the middle joint
    ctx.beginPath(); const rb = wU * 0.95 * s; ctx.moveTo(S[a][0] + rb, S[a][1]); ctx.arc(S[a][0], S[a][1], rb, 0, TAU);
    const ux = S[b][0] - S[a][0], uy = S[b][1] - S[a][1], ul = Math.hypot(ux, uy) || 1, kx = -uy / ul * wU * 0.45 * s, ky = ux / ul * wU * 0.45 * s, rk = wU * 0.55 * s;
    ctx.moveTo(S[b][0] + kx + rk, S[b][1] + ky); ctx.arc(S[b][0] + kx, S[b][1] + ky, rk, 0, TAU); ctx.moveTo(S[b][0] - kx + rk, S[b][1] - ky); ctx.arc(S[b][0] - kx, S[b][1] - ky, rk, 0, TAU);
    kcXPlate(ctx, 1, al, 0.85, far);
    if (leg) { // the kneecap, in front of the knee
      const fx = tor.F[0] * 0.05 * sc, fy = tor.F[1] * 0.05 * sc, fz = tor.F[2] * 0.05 * sc, Pb = P[b];
      if (kcProj(c, Pb[0] + fx, Pb[1] + fy, Pb[2] + fz, kcXQ2)) { ctx.beginPath(); ctx.arc(kcXQ2[0], kcXQ2[1], Math.max(1, 0.02 * kcXQ2[2] * sc), 0, TAU); kcXPlate(ctx, 1, al, 0.7, far); }
    }
    // hands and feet
    const big = 0.06 * s > 5;
    if (big) {
      const Pd = P[d], Pb = P[b]; let ex, ey, ez;
      if (leg) { ex = tor.F[0]; ey = 0; ez = tor.F[2]; const el = Math.hypot(ex, ez) || 1; ex /= el; ez /= el; }
      else { ex = Pd[0] - Pb[0]; ey = Pd[1] - Pb[1]; ez = Pd[2] - Pb[2]; const el = Math.hypot(ex, ey, ez) || 1; ex /= el; ey /= el; ez /= el; }
      const len = leg ? 0.13 * sc : 0.08 * sc, sx = tor.S[0], sy = tor.S[1], sz = tor.S[2];
      ctx.beginPath();
      for (let i = 0; i < (leg ? 5 : 4); i++) {
        const sp = (i - (leg ? 2 : 1.5)) * (leg ? 0.012 : 0.009) * sc, x0 = Pd[0] + sx * sp * 0.5, y0 = Pd[1] + (leg ? -0.03 * sc : 0), z0 = Pd[2] + sz * sp * 0.5;
        if (!kcProj(c, x0, y0, z0, kcXQ)) continue;
        const l = len * (leg ? 1 - Math.abs(i - 2) * 0.08 : 0.9 + (i === 1 ? 0.1 : 0)), x1 = x0 + ex * l + sx * sp, y1 = y0 + ey * l + (leg ? -0.02 * sc : 0), z1 = z0 + ez * l + sz * sp;
        if (!kcProj(c, x1, y1, z1, kcXQ2)) continue;
        ctx.moveTo(kcXQ[0], kcXQ[1]); ctx.lineTo(kcXQ2[0], kcXQ2[1]);
      }
      kcXBand(ctx, (leg ? 0.008 : 0.0055) * s, al * 0.9, far);
      ctx.beginPath(); if (kcProj(c, Pd[0], Pd[1] + (leg ? -0.02 * sc : 0), Pd[2], kcXQ)) { const r = (leg ? 0.024 : 0.016) * s; ctx.moveTo(kcXQ[0] + r, kcXQ[1]); ctx.ellipse(kcXQ[0], kcXQ[1], r, r * 0.8, 0, 0, TAU); }
      kcXPlate(ctx, 1, al, 0.75, far);
    }
  } });
  limb('shL', 'elL', 'haL', 0.021, 'armLU', 'armLF', false); limb('shR', 'elR', 'haR', 0.021, 'armRU', 'armRF', false);
  limb('hpL', 'knL', 'ftL', 0.029, '', '', true); limb('hpR', 'knR', 'ftR', 0.029, '', '', true);
}

// ---- the skull --------------------------------------------------------------------------------
// The vault (an egg with a double line for its two layers of bone, and its seams), the eye sockets
// (a rim with a tunnel going back into the head), the hole of the nose, the cheekbones, both rows
// of teeth, the jaw hinged below each ear. A head shot leaves a small clean hole going in and a
// larger one coming out with a plate knocked loose, and cracks run out over the vault from both.
// A .50 bursts the vault into pieces.
function kcXSkull(ctx, K, c, fig, al, items) {
  const hd = fig.hd, sc = fig.sc * kcSkK, fs = fig.fs, pl = K.plan, head = pl && pl.part === 'head';
  kcLoc(hd, kcSkC[0] * sc, kcSkC[1] * sc, kcSkC[2] * sc, kcXL);
  const cx3 = kcXL[0], cy3 = kcXL[1], cz3 = kcXL[2];
  if (!kcProj(c, cx3, cy3, cz3, kcXQ)) return;
  const s = kcXQ[2] * sc, zH = kcXQ[3];
  const aIn = kcAge(K, 'skullIn'), aOut = kcAge(K, 'skullOut'), burst = K.burst && head && (aIn >= 0) ? kcAge(K, 'burst') : -1;
  const red = kcXc(K, 'red'), crack = kcXC.crack;
  const surf = (n0, n1, n2, out) => { kcLoc(hd, (kcSkC[0] + kcSkR[0] * n0) * sc, (kcSkC[1] + kcSkR[1] * n1) * sc, (kcSkC[2] + kcSkR[2] * n2) * sc, out); return out; };
  items.push({ z: zH + 0.01, f() {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // ---- the vault
    if (burst < 0) {
      ctx.beginPath(); kcXEgg(ctx, c, hd, kcSkC[0] * sc, kcSkC[1] * sc, kcSkC[2] * sc, kcSkR[0] * sc, kcSkR[1] * sc, kcSkR[2] * sc);
      kcXPlate(ctx, 0.0065 * s, al, 0.3, false);
      ctx.beginPath(); kcXEgg(ctx, c, hd, kcSkC[0] * sc, kcSkC[1] * sc, kcSkC[2] * sc, (kcSkR[0] - 0.009) * sc, (kcSkR[1] - 0.009) * sc, (kcSkR[2] - 0.009) * sc);
      ctx.globalAlpha = al * 0.45; ctx.strokeStyle = kcXC.bone; ctx.lineWidth = Math.max(1, 0.0028 * s); ctx.stroke();
      // the seams: across the top behind the brow, down the middle, and round the back
      if (0.1 * s > 30) {
        ctx.beginPath();
        let pen = false;
        for (let i = 0; i <= 14; i++) { const t = -1.1 + (i / 14) * 2.2, z = (i % 2 ? 0.035 : -0.035); surf(Math.sin(t), Math.cos(t) * 0.97, 0.18 + z * 0.4, kcXV); if (kcProj(c, kcXV[0], kcXV[1], kcXV[2], kcXQ)) { if (pen) ctx.lineTo(kcXQ[0], kcXQ[1]); else ctx.moveTo(kcXQ[0], kcXQ[1]); pen = true; } else pen = false; }
        pen = false;
        for (let i = 0; i <= 12; i++) { const t = 0.18 - (i / 12) * 1.25, z = (i % 2 ? 0.04 : -0.04); surf(z * 0.5, Math.cos(t * 1.2), Math.sin(t * 1.2), kcXV); if (kcProj(c, kcXV[0], kcXV[1], kcXV[2], kcXQ)) { if (pen) ctx.lineTo(kcXQ[0], kcXQ[1]); else ctx.moveTo(kcXQ[0], kcXQ[1]); pen = true; } else pen = false; }
        ctx.globalAlpha = al * 0.3; ctx.strokeStyle = kcXC.boneMid; ctx.lineWidth = 1; ctx.stroke();
      }
    } else kcXBurst(ctx, K, c, fig, al, burst, s);
    // ---- the face: thin plates of bone, so fine bright lines (edge) and soft bright bands (plateLine)
    const edge = (w, a) => { ctx.globalAlpha = al * a; ctx.strokeStyle = kcXC.bone; ctx.lineWidth = clamp(w * s, 1, 3.2); ctx.stroke(); };
    const plateLine = (w, w2) => { ctx.globalAlpha = al * 0.22; ctx.strokeStyle = kcXC.boneMid; ctx.lineWidth = Math.max(1.5, w * s); ctx.stroke(); edge(w2, 0.85); };
    // eye sockets: a rim, thick along the brow, and a tunnel back into the head
    for (let sg = -1; sg <= 1; sg += 2) {
      const ox = sg * 0.043, ct = Math.cos(0.26), st = Math.sin(0.26) * sg;
      const ring = (k, back, close) => {
        let pen = false;
        for (let i = 0; i <= 16; i++) {
          const an = (i / 16) * TAU, ca = Math.cos(an), sa = Math.sin(an), rx = 0.0275 * k * (1 + 0.12 * Math.abs(ca) * (sa < 0 ? 0.6 : 0)), ry = 0.0235 * k * (sa > 0 ? 1.05 : 1);
          // in the socket's own plane, turned a little outward: across (ct, -st), up, and the way it faces (st, ct)
          const a = ox + ca * rx * ct - back * st, f = 0.094 - ca * rx * st * sg * sg - back * ct, u = -0.002 + sa * ry;
          if (!kcXP(c, hd, a * sc, u * sc, f * sc, kcXQ)) { pen = false; continue; }
          if (pen) ctx.lineTo(kcXQ[0], kcXQ[1]); else ctx.moveTo(kcXQ[0], kcXQ[1]); pen = true;
        }
        if (close) ctx.closePath();
      };
      ctx.beginPath(); ring(1, 0, true); ctx.globalAlpha = al * 0.55; ctx.fillStyle = '#02070b'; ctx.fill();
      ctx.beginPath(); ring(0.62, 0.032, true); ctx.globalAlpha = al * 0.45; ctx.fill(); ctx.globalAlpha = al * 0.4; ctx.strokeStyle = kcXC.boneMid; ctx.lineWidth = Math.max(1, 0.0022 * s); ctx.stroke();
      // the walls of the tunnel
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const an = 0.6 + k * (TAU / 4), ca = Math.cos(an), sa = Math.sin(an);
        const p0 = [ox + ca * 0.0275 * ct, -0.002 + sa * 0.0235, 0.094 - ca * 0.0275 * Math.sin(0.26)], p1 = [ox + ca * 0.017 * ct - 0.032 * st, -0.002 + sa * 0.0146, 0.094 - ca * 0.017 * Math.sin(0.26) - 0.032 * ct];
        if (kcXP(c, hd, p0[0] * sc, p0[1] * sc, p0[2] * sc, kcXQ) && kcXP(c, hd, p1[0] * sc, p1[1] * sc, p1[2] * sc, kcXQ2)) { ctx.moveTo(kcXQ[0], kcXQ[1]); ctx.lineTo(kcXQ2[0], kcXQ2[1]); }
      }
      ctx.globalAlpha = al * 0.32; ctx.strokeStyle = kcXC.boneMid; ctx.lineWidth = 1; ctx.stroke();
      // the rim: a fine bright line all round, with a heavier ridge along the top and outer side
      ctx.beginPath(); ring(1, 0, true); edge(0.0024, 0.8);
      ctx.beginPath(); let pen = false;
      for (let i = 0; i <= 14; i++) {
        const an = sg > 0 ? -0.9 + (i / 14) * 3.5 : Math.PI + 0.9 - (i / 14) * 3.5, ca = Math.cos(an), sa = Math.sin(an);
        const a = ox + ca * 0.0292 * ct, f = 0.094 - ca * 0.0292 * Math.sin(0.26) * sg * sg, u = -0.002 + sa * 0.0252 * (sa > 0 ? 1.06 : 1);
        if (!kcXP(c, hd, a * sc, u * sc, f * sc, kcXQ)) { pen = false; continue; }
        if (pen) ctx.lineTo(kcXQ[0], kcXQ[1]); else ctx.moveTo(kcXQ[0], kcXQ[1]); pen = true;
      }
      plateLine(0.0075, 0.0028);
    }
    // the nose: a pear-shaped hole and the bridge above it
    ctx.beginPath(); kcXRun(ctx, c, hd, [0, -0.014, 0.118, 0.011, -0.03, 0.116, 0.0145, -0.045, 0.112, 0.009, -0.056, 0.112, 0, -0.054, 0.114, -0.009, -0.056, 0.112, -0.0145, -0.045, 0.112, -0.011, -0.03, 0.116], sc, 1, 0, true);
    ctx.globalAlpha = al * 0.45; ctx.fillStyle = '#02070b'; ctx.fill(); edge(0.0022, 0.85);
    ctx.beginPath(); kcXRun(ctx, c, hd, [0, 0.014, 0.118, 0, -0.004, 0.124, 0, -0.014, 0.12], sc, 1, 0); plateLine(0.006, 0.0024);
    // cheekbones and the arches back to the ears, the bump behind each ear: thin plates of bone
    for (let sg = -1; sg <= 1; sg += 2) {
      ctx.beginPath(); kcXRun(ctx, c, hd, [0.03, -0.034, 0.106, 0.056, -0.03, 0.088, 0.07, -0.02, 0.062, 0.076, -0.028, 0.03, 0.072, -0.026, -0.006], sc, sg, 0); plateLine(0.009, 0.0026);
      ctx.beginPath(); kcXRun(ctx, c, hd, [0.032, -0.03, 0.104, 0.05, -0.046, 0.09, 0.04, -0.056, 0.098], sc, sg, 0); edge(0.0018, 0.5); // the lower edge of the cheek
      ctx.beginPath(); kcXRun(ctx, c, hd, [0.068, -0.03, -0.03, 0.072, -0.05, -0.04], sc, sg, 0); plateLine(0.01, 0.0026);
    }
    // the upper jaw's ridge and its teeth
    const jIn = kcAge(K, 'jawIn'), jOut = kcAge(K, 'jawOut');
    ctx.beginPath();
    for (let sg = -1; sg <= 1; sg += 2) { let pen = false; for (let k = 7; k >= 0; k--) { const t = kcTooth[k]; if (!kcXP(c, hd, sg * t[0] * sc, -0.058 * sc, t[1] * sc, kcXQ)) { pen = false; continue; } if (pen) ctx.lineTo(kcXQ[0], kcXQ[1]); else ctx.moveTo(kcXQ[0], kcXQ[1]); pen = true; } }
    plateLine(0.007, 0.0022);
    const teeth = (u0, u1, root, dj) => {
      for (let pass = 0; pass < 2; pass++) {
        ctx.beginPath();
        for (let sg = -1; sg <= 1; sg += 2) for (let k = 0; k < 8; k++) {
          const t = kcTooth[k], lost = dj >= 0 && ((sg === -fs) === (k < 4)) && k % 3 === 1; if (lost) continue;
          const du = dj >= 0 ? 0.012 * easeOut(dj / 0.3) * (sg === fs ? 1 : -0.4) : 0, a = sg * t[0] * sc, f = t[1] * sc;
          const ua = pass ? u0 : root, ub = pass ? u1 : u0;
          if (kcXP(c, hd, a, (ua + du) * sc, f, kcXQ) && kcXP(c, hd, a, (ub + du) * sc, f, kcXQ2)) { ctx.moveTo(kcXQ[0], kcXQ[1]); ctx.lineTo(kcXQ2[0], kcXQ2[1]); }
        }
        ctx.globalAlpha = al * (pass ? 0.9 : 0.3); ctx.strokeStyle = pass ? kcXC.bone : kcXC.boneMid; ctx.lineCap = pass ? 'round' : 'butt'; ctx.lineWidth = clamp((pass ? 0.0038 : 0.0024) * s, 1, pass ? 5 : 3); ctx.stroke();
      }
      ctx.lineCap = 'round';
    };
    teeth(-0.064, -0.075, -0.05, -1);
    // the lower jaw: a plate of bone hinged below each ear, round to the chin, with the spur in
    // front of the hinge; broken, each half swings away
    const jaw = [0.07, -0.006, -0.014, 0.068, -0.04, -0.024, 0.064, -0.075, -0.024, 0.058, -0.1, -0.01, 0.05, -0.11, 0.032, 0.03, -0.116, 0.083, 0.01, -0.119, 0.106, 0, -0.119, 0.108,
      0, -0.098, 0.112, 0.01, -0.087, 0.108, 0.03, -0.086, 0.093, 0.045, -0.085, 0.058, 0.052, -0.082, 0.024, 0.06, -0.06, 0.012, 0.064, -0.028, 0.012, 0.066, -0.04, 0.0, 0.07, -0.016, -0.008];
    const dj = Math.max(jIn, jOut);
    for (let sg = -1; sg <= 1; sg += 2) {
      const br = (sg === -fs ? jIn : jOut), k = br >= 0 ? easeOut(br / 0.3) : 0, part = [];
      for (let i = 0; i < jaw.length; i += 3) part.push(jaw[i] + 0.012 * k, jaw[i + 1] - 0.018 * k, jaw[i + 2]);
      ctx.beginPath(); kcXRun(ctx, c, hd, part, sc, sg, 0, true);
      ctx.globalAlpha = al * 0.16; ctx.fillStyle = kcXC.boneMid; ctx.fill(); edge(0.0026, 0.85);
      // its thick lower border
      ctx.beginPath(); kcXRun(ctx, c, hd, part.slice(6, 24), sc, sg, 0); plateLine(0.006, 0.0026);
    }
    teeth(-0.084, -0.094, -0.106, dj);
    // ---- where the round went in and came out, the plate knocked loose, and the cracks
    if (head && pl.chord && aIn >= 0 && burst < 0) kcXSkullHoles(ctx, K, c, fig, al, s, cx3, cy3, cz3, aIn, aOut);
  } });
}
// The holes in the vault and the cracks running out from them.
function kcXSkullHoles(ctx, K, c, fig, al, s, cx3, cy3, cz3, aIn, aOut) {
  const hd = fig.hd, sc = fig.sc * kcSkK, fs = fig.fs, pl = K.plan, red = kcXc(K, 'red'), crack = kcXC.crack;
  const uc = (pl.u0 / sc - kcSkC[1]) / kcSkR[1], fc = (pl.c0 / sc - kcSkC[2]) / kcSkR[2];
  if (!pl.cracks) {
    pl.cracks = [];
    const R2 = makeRng(Math.round(pl.u0 * 9001 + pl.c0 * 7001) + 77), nk = K.power > 0.7 ? 11 : K.power > 0.4 ? 9 : 6;
    for (let e = 0; e < 2; e++) {
      const a0 = (e ? 1 : -1) * Math.sqrt(Math.max(0.05, 1 - uc * uc - fc * fc)) * fs; // in at the near side, out at the far side
      for (let k = 0; k < nk; k++) {
        const th = (k / nk) * TAU + R2.f(), len = 4 + Math.floor(R2.f() * (3 + 5 * K.power)); let n = [a0, uc, fc], tu = Math.cos(th), tf = Math.sin(th); const line = [n[0], n[1], n[2]];
        for (let j = 0; j < len; j++) { // bone breaks in straight runs and sharp corners, not curves
          tu += (R2.f() - 0.5) * 1.6; tf += (R2.f() - 0.5) * 1.6; const tl = Math.hypot(tu, tf) || 1; tu /= tl; tf /= tl;
          const st = 0.08 + R2.f() * 0.09; n = [n[0] + (e ? -1 : 1) * fs * st * 0.45, n[1] + tu * st, n[2] + tf * st]; const l = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / l, n[1] / l, n[2] / l]; line.push(n[0], n[1], n[2]);
          if (R2.f() < 0.22 && j > 1) { // a short side branch
            const b = [n[0], n[1], n[2]], bt = j % 2 ? 1 : -1; const br = [b[0], b[1], b[2]];
            for (let m = 0; m < 2; m++) { b[1] += -tf * bt * 0.09; b[2] += tu * bt * 0.09; const bl = Math.hypot(b[0], b[1], b[2]) || 1; br.push(b[0] / bl, b[1] / bl, b[2] / bl); }
            pl.cracks.push({ e, line: br, at: (j + 1) / (len + 1) });
          }
        }
        pl.cracks.push({ e, line, at: 0 });
      }
    }
  }
  const pt = (n0, n1, n2, out) => kcProj(c, cx3 + (hd.S[0] * kcSkR[0] * n0 + hd.U[0] * kcSkR[1] * n1 + hd.F[0] * kcSkR[2] * n2) * sc, cy3 + (hd.S[1] * kcSkR[0] * n0 + hd.U[1] * kcSkR[1] * n1 + hd.F[1] * kcSkR[2] * n2) * sc, cz3 + (hd.S[2] * kcSkR[0] * n0 + hd.U[2] * kcSkR[1] * n1 + hd.F[2] * kcSkR[2] * n2) * sc, out);
  // the cracks grow out from the holes over half a second, a dark line with a fleck of bright bone beside it
  ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
  for (let pass = 0; pass < 2; pass++) {
    ctx.beginPath();
    for (let i = 0; i < pl.cracks.length; i++) {
      const cr = pl.cracks[i], ag = cr.e ? aOut : aIn; if (ag < 0) continue;
      const nseg = cr.line.length / 3 - 1, grow = clamp((ag - cr.at * 0.3) / (0.35 + 0.3 * cr.at), 0, 1) * nseg; if (grow <= 0) continue;
      let pen = false;
      for (let j = 0; j <= Math.min(nseg, Math.ceil(grow)); j++) {
        let a = cr.line[j * 3], u = cr.line[j * 3 + 1], f = cr.line[j * 3 + 2];
        if (j > grow) { const k = grow - (j - 1); a = lerp(cr.line[j * 3 - 3], a, k); u = lerp(cr.line[j * 3 - 2], u, k); f = lerp(cr.line[j * 3 - 1], f, k); }
        if (!pt(a, u, f, kcXQ)) { pen = false; continue; }
        if (pass) { kcXQ[0] += 1.1; kcXQ[1] -= 0.8; }
        if (pen) ctx.lineTo(kcXQ[0], kcXQ[1]); else ctx.moveTo(kcXQ[0], kcXQ[1]); pen = true;
      }
    }
    ctx.globalAlpha = al * (pass ? 0.55 : 0.95); ctx.strokeStyle = pass ? kcXC.bone : crack; ctx.lineWidth = pass ? 0.8 : Math.max(1.3, 0.0034 * s); ctx.stroke();
  }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // the holes: a neat one going in, its edge bevelled inward (a bright ring just inside); a larger,
  // torn one coming out, bevelled outward, with a plate of bone punched loose and tumbling away
  for (let e = 0; e < 2; e++) {
    const ag = e ? aOut : aIn; if (ag < 0) continue;
    const a0 = (e ? 1 : -1) * Math.sqrt(Math.max(0.05, 1 - uc * uc - fc * fc)) * fs;
    if (!pt(a0, uc, fc, kcXQ)) continue;
    const r = (e ? 0.01 + 0.02 * K.gx : 0.004 + 0.0035 * K.gk) * kcXQ[2] * sc * smooth(ag / 0.06) + 1;
    ctx.globalAlpha = al; ctx.fillStyle = K.gore ? kcXC.redD : '#02070b'; ctx.beginPath();
    if (e) { const R = makeRng(7 + Math.round(pl.u0 * 1000)); for (let j = 0; j < 7; j++) { const an = j * (TAU / 7) + R.f() * 0.6, rr = r * (0.75 + 0.5 * R.f()); const x = kcXQ[0] + Math.cos(an) * rr, y = kcXQ[1] + Math.sin(an) * rr; if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.closePath(); }
    else ctx.arc(kcXQ[0], kcXQ[1], r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = al * 0.8; ctx.strokeStyle = e ? kcXC.boneMid : kcXC.bone; ctx.lineWidth = Math.max(1, r * 0.35); ctx.beginPath(); ctx.arc(kcXQ[0], kcXQ[1], r * (e ? 1.35 : 1.25), 0, TAU); ctx.stroke();
    if (K.gore) { ctx.globalAlpha = al * 0.7; ctx.strokeStyle = red; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(kcXQ[0], kcXQ[1], r * 1.02, 0, TAU); ctx.stroke(); }
  }
  // the plate punched out of the far side
  if (aOut >= 0 && K.plate) {
    const q = K.plate, a0 = Math.sqrt(Math.max(0.05, 1 - uc * uc - fc * fc)) * fs, n = 7, pr = 0.42 + 0.25 * K.gx;
    const cr = Math.cos(q.rot), sr = Math.sin(q.rot);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const an = (i / n) * TAU, rr = pr * (0.75 + 0.45 * kcHash(i * 5.3 + pl.u0 * 50)), du = Math.cos(an) * rr * 0.55, df = Math.sin(an) * rr * 0.5;
      const ru = du * cr - df * sr * 0.5, rz = du * sr * 0.03;
      const n0 = a0, n1 = uc + ru, n2 = fc + df;
      if (!kcProj(c, cx3 + (hd.S[0] * kcSkR[0] * n0 + hd.U[0] * kcSkR[1] * n1 + hd.F[0] * kcSkR[2] * n2) * sc + q.x, cy3 + (hd.S[1] * kcSkR[0] * n0 + hd.U[1] * kcSkR[1] * n1 + hd.F[1] * kcSkR[2] * n2) * sc + q.y, cz3 + (hd.S[2] * kcSkR[0] * n0 + hd.U[2] * kcSkR[1] * n1 + hd.F[2] * kcSkR[2] * n2) * sc + q.z + rz, kcXQ)) break;
      if (i) ctx.lineTo(kcXQ[0], kcXQ[1]); else ctx.moveTo(kcXQ[0], kcXQ[1]);
    }
    ctx.closePath(); kcXPlate(ctx, 1.2, al * clamp(2 - aOut * 0.4, 0, 1), 0.7, false);
  }
}
// The vault burst by a .50: the pieces (worked out once, on the egg shape) fly apart.
function kcXBurst(ctx, K, c, fig, al, age, s) {
  const hd = fig.hd, sc = fig.sc * kcSkK, d = K.dir;
  if (!K.plates) {
    K.plates = [];
    const R = makeRng(4421 + Math.round((K.plan.u0 || 0) * 999)), n = 10;
    for (let i = 0; i < n; i++) {
      // a patch of the vault round a direction, as seven points; the base of the skull stays
      const th = (i / n) * TAU + R.f() * 0.4, ph = 0.3 + R.f() * 0.9, dir = [Math.cos(th) * Math.sin(ph), Math.cos(ph), Math.sin(th) * Math.sin(ph)], pts = [];
      for (let k = 0; k < 7; k++) {
        const an = (k / 7) * TAU + R.f() * 0.4, rr = 0.42 + R.f() * 0.18;
        // two directions square to dir
        let ex = -dir[2], ez = dir[0]; const el = Math.hypot(ex, ez) || 1; ex /= el; ez /= el; const fx = dir[1] * ez, fy = dir[2] * ex - dir[0] * ez, fz = -dir[1] * ex;
        let p0 = dir[0] + (ex * Math.cos(an) + fx * Math.sin(an)) * rr, p1 = dir[1] + fy * Math.sin(an) * rr, p2 = dir[2] + (ez * Math.cos(an) + fz * Math.sin(an)) * rr; const pl2 = Math.hypot(p0, p1, p2) || 1;
        pts.push(p0 / pl2, p1 / pl2, p2 / pl2);
      }
      const sp = 0.9 + R.f() * 1.6;
      K.plates.push({ pts, vx: dir[0] * sp + d[0] * 1.2, vy: dir[1] * sp * 0.8 + 0.4, vz: dir[2] * sp + d[2] * 1.8, rot: 0, vr: (R.f() - 0.5) * 8 });
    }
  }
  const t = age * 0.22; // the pieces fly in the spray's own slowed time
  kcLoc(hd, kcSkC[0] * sc, kcSkC[1] * sc, kcSkC[2] * sc, kcXL);
  const cx = kcXL[0], cy = kcXL[1], cz = kcXL[2];
  for (let i = 0; i < K.plates.length; i++) {
    const q = K.plates[i], ox = q.vx * t * sc, oy = (q.vy * t - 4.9 * t * t) * sc, oz = q.vz * t * sc, rot = q.vr * t;
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      const n0 = q.pts[k * 3], n1 = q.pts[k * 3 + 1], n2 = q.pts[k * 3 + 2], ca = Math.cos(rot), sa = Math.sin(rot);
      const m0 = n0 * ca - n1 * sa * 0.4, m1 = n1 * ca + n0 * sa * 0.4;
      const wx = cx + (hd.S[0] * kcSkR[0] * m0 + hd.U[0] * kcSkR[1] * m1 + hd.F[0] * kcSkR[2] * n2) * sc + ox, wy = cy + (hd.S[1] * kcSkR[0] * m0 + hd.U[1] * kcSkR[1] * m1 + hd.F[1] * kcSkR[2] * n2) * sc + oy, wz = cz + (hd.S[2] * kcSkR[0] * m0 + hd.U[2] * kcSkR[1] * m1 + hd.F[2] * kcSkR[2] * n2) * sc + oz;
      if (!kcProj(c, wx, wy, wz, kcXQ)) break;
      if (k) ctx.lineTo(kcXQ[0], kcXQ[1]); else ctx.moveTo(kcXQ[0], kcXQ[1]);
    }
    ctx.closePath(); kcXPlate(ctx, 0.005 * s, al, 0.55, false);
  }
}

// ---- the organs (gore on only) ---------------------------------------------------------------
// Each one is one or more egg shapes, laid on with 'lighter' so where they overlap they look
// denser. Lines run through the lungs (the airways) and up out of the heart (the great vessels).
// Damage: a bruise that spreads from where the round went through; the heart is split in two
// along the wound; a lung, once holed, slowly collapses, leaving the line of where it was.
function kcXOrgans(ctx, K, c, fig, al, items) {
  const tor = fig.tor, sc = fig.sc, bw = fig.bw, fs = fig.fs, L = tor.L, pl = K.plan;
  const zAt = (a, b, cc) => { kcLoc(tor, a, b, cc, kcXL); return (kcXL[0] - c.x) * c.fx + (kcXL[1] - c.y) * c.fy + (kcXL[2] - c.z) * c.fz; };
  if (!kcXP(c, tor, 0, L * 0.7, 0, kcXQ)) return;
  const ps = kcXQ[2] * sc, bruise = kcXc(K, 'bruise'), red = kcXc(K, 'red');
  // a bruise where the round crossed an organ: grows over a second, darkest at the middle
  const bruiseAt = (g, ag, k) => {
    if (ag < 0 || !pl || pl.part !== 'torso') return;
    const gr = smooth(ag / 1.1), a = g.a * sc * bw;
    ctx.beginPath(); kcXEgg(ctx, c, tor, a, pl.b0, pl.c0, g.ra * sc * bw * (0.4 + 0.5 * gr) * k, (0.012 + 0.03 * gr) * sc * k, (0.015 + 0.025 * gr) * sc * k);
    ctx.globalAlpha = al * 0.5; ctx.fillStyle = bruise + '1)'; ctx.fill();
    ctx.beginPath(); kcXEgg(ctx, c, tor, a, pl.b0, pl.c0, g.ra * sc * bw * 0.85, 0.008 * sc, 0.008 * sc); ctx.globalAlpha = al * 0.8; ctx.fillStyle = kcXC.redD; ctx.fill();
  };
  for (let i = 0; i < kcOrgans.length; i++) {
    const g = kcOrgans[i];
    items.push({ z: zAt(g.a * sc * bw, g.b * L, g.c * sc), f() {
      const ag = kcAge(K, g.id), lung = g.id.charAt(0) === 'l' && g.id !== 'liver';
      ctx.globalCompositeOperation = 'lighter';
      if (g.id === 'heart') { kcXHeart(ctx, K, c, fig, al, g, ag, ps); ctx.globalCompositeOperation = 'source-over'; return; }
      // a holed lung falls in toward its root over a second and a half
      const col = lung ? smooth(ag / 1.5) * (ag >= 0 ? 1 : 0) : 0, k = 1 - 0.38 * col, sh = col * 0.035 * sc;
      const ax = g.a * sc * bw, by = g.b * L, cz = g.c * sc;
      ctx.beginPath(); kcXEgg(ctx, c, tor, ax - Math.sign(g.a) * sh * 0.6, by - sh, cz, g.ra * sc * bw * k, g.rb * sc * k, g.rc * sc * k);
      if (lung) kcXEgg(ctx, c, tor, ax + Math.sign(g.a) * 0.012 * sc - Math.sign(g.a) * sh * 0.6, by - g.rb * sc * 0.42 * k - sh, cz, g.ra * sc * bw * 1.08 * k, g.rb * sc * 0.55 * k, g.rc * sc * 1.05 * k);
      if (g.id === 'liver') kcXEgg(ctx, c, tor, 0.045 * sc * bw, by + 0.01 * sc, cz + 0.015 * sc, 0.05 * sc * bw, 0.028 * sc, 0.042 * sc);
      ctx.globalAlpha = al; ctx.fillStyle = kcXC.organ + (lung ? 0.09 : g.id === 'liver' ? 0.15 : 0.13) + ')'; ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = al * 0.5; ctx.strokeStyle = kcXC.organEdge + '0.5)'; ctx.lineWidth = 1; ctx.stroke();
      if (lung) {
        // the airways
        ctx.beginPath(); const sg = Math.sign(g.a), kb = k;
        for (let j = 0; j < kcBronch.length; j++) { const r = kcBronch[j]; let pen = false; for (let m = 0; m < r.length; m += 3) { if (!kcXP(c, tor, sg * (r[m] * kb + (1 - kb) * 0.02) * sc * bw, L * (r[m + 1] - (1 - kb) * 0.08 * (r[m + 1] - 0.74)) - sh, r[m + 2] * sc, kcXQ)) { pen = false; continue; } if (pen) ctx.lineTo(kcXQ[0], kcXQ[1]); else ctx.moveTo(kcXQ[0], kcXQ[1]); pen = true; } }
        ctx.globalAlpha = al * 0.38; ctx.strokeStyle = kcXC.organEdge + '1)'; ctx.lineWidth = Math.max(1, 0.0035 * ps); ctx.stroke();
        if (col > 0.02) { // where it was, before it fell in
          ctx.beginPath(); kcXEgg(ctx, c, tor, ax, by, cz, g.ra * sc * bw, g.rb * sc, g.rc * sc);
          ctx.setLineDash([3, 5]); ctx.globalAlpha = al * 0.25 * col; ctx.strokeStyle = kcXC.organEdge + '1)'; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
        }
      }
      bruiseAt(g, ag, 1);
    } });
  }
  // the gut: one long tube folded back and forth
  items.push({ z: zAt(0, L * 0.18, 0.03 * sc), f() {
    const ag = kcAge(K, 'gut');
    ctx.beginPath();
    for (let r = 0; r < 5; r++) { let pen = false; for (let i = 0; i <= 6; i++) { const u = i / 6, a = ((r % 2 ? 1 - u : u) * 0.17 - 0.085) * sc * bw, b = L * (0.29 - r * 0.052) + Math.sin(u * 9 + r) * 0.006 * sc; if (!kcXP(c, tor, a, b, 0.035 * sc, kcXQ)) { pen = false; continue; } if (pen) ctx.lineTo(kcXQ[0], kcXQ[1]); else ctx.moveTo(kcXQ[0], kcXQ[1]); pen = true; } }
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al * 0.22; ctx.strokeStyle = kcXC.organEdge + '1)'; ctx.lineWidth = Math.max(1.5, 0.03 * ps); ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = al * 0.3; ctx.lineWidth = 1; ctx.stroke();
    if (ag >= 0) bruiseAt({ a: 0, ra: 0.1 }, ag, 1);
  } });
}
// The heart: an egg tipped toward the lower left, with a thick wall of muscle and two hollows
// inside (the left one bigger), the great vessels arching up out of the top. When it is what the
// round is heading for it is drawn a little brighter. Hit, it splits along the wound: the two
// halves drawn apart, torn red edges and blood between them.
function kcXHeart(ctx, K, c, fig, al, g, ag, ps) {
  const tor = fig.tor, sc = fig.sc, bw = fig.bw, L = tor.L, pl = K.plan;
  const beat = ag < 0 ? 0.04 * Math.pow(Math.max(0, Math.sin(K.T * 5.2)), 6) : 0, k = sc * (1 + beat);
  kcLoc(tor, g.a * sc * bw, g.b * L, g.c * sc, kcXL); const hx = kcXL[0], hy = kcXL[1], hz = kcXL[2];
  // its long axis, from the top (up, right, back) to the tip (down, left, forward)
  const ax = 0.5, ay = -0.68, az = 0.36, al2 = Math.hypot(ax, ay, az);
  const A = [(tor.S[0] * ax + tor.U[0] * ay + tor.F[0] * az) / al2, (tor.S[1] * ax + tor.U[1] * ay + tor.F[1] * az) / al2, (tor.S[2] * ax + tor.U[2] * ay + tor.F[2] * az) / al2];
  const B = [tor.S[1] * A[2] - tor.S[2] * A[1], tor.S[2] * A[0] - tor.S[0] * A[2], tor.S[0] * A[1] - tor.S[1] * A[0]], Cv = [A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]];
  // an egg in the heart's own axes: centre offset along its length (oa) and across (ob), half-sizes
  const egg = (oa, ob, ra, rb, rc) => kcEll(ctx, c, hx + (A[0] * oa + B[0] * ob) * k, hy + (A[1] * oa + B[1] * ob) * k, hz + (A[2] * oa + B[2] * ob) * k, kcMul(kcXV, A, ra * k), kcMul(kcXV2, B, rb * k), kcMul(kcXV3, Cv, rc * k));
  const hero = !!(pl && pl.key && pl.key.ref === 'heart');
  const heart = (red) => {
    ctx.beginPath(); if (!egg(0, 0, 0.068, 0.047, 0.043)) return;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al; ctx.fillStyle = kcXC.organ + (hero ? '0.34)' : '0.22)'); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    if (red > 0) { ctx.globalAlpha = al * 0.4 * red; ctx.fillStyle = kcXc(K, 'bruise') + '1)'; ctx.fill(); }
    ctx.globalAlpha = al * (hero ? 0.95 : 0.7); ctx.strokeStyle = kcXC.organEdge + '0.9)'; ctx.lineWidth = hero ? 1.6 : 1.2; ctx.stroke();
    // the inner face of the wall, and the two hollows
    ctx.beginPath(); egg(-0.004, 0, 0.056, 0.038, 0.035); ctx.globalAlpha = al * 0.35; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); egg(0.006, 0.013, 0.036, 0.017, 0.02); egg(-0.004, -0.017, 0.032, 0.014, 0.018);
    ctx.globalAlpha = al * 0.5; ctx.fillStyle = '#021017'; ctx.fill(); ctx.globalAlpha = al * 0.55; ctx.strokeStyle = kcXC.organEdge + '0.8)'; ctx.stroke();
  };
  // the great vessels: up out of the top and over, then down along the spine
  ctx.beginPath(); kcXRun(ctx, c, tor, [0.012, 0.71, 0.035, 0.0, 0.8, 0.03, 0.006, 0.845, 0.0, 0.026, 0.83, -0.03, 0.024, 0.66, -0.04, 0.018, 0.36, -0.035], sc, 1, L);
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al * 0.2; ctx.strokeStyle = kcXC.organEdge + '1)'; ctx.lineWidth = Math.max(1.5, 0.022 * ps); ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  const split = ag >= 0 ? easeOut(ag / 0.35) : 0;
  if (split <= 0) { heart(0); ctx.globalCompositeOperation = 'lighter'; return; }
  // split: the wound's line on screen, and the two halves drawn apart across it
  if (!kcXP(c, tor, -0.2 * sc, pl.b0, pl.c0, kcXQ) || !kcXP(c, tor, 0.2 * sc, pl.b0, pl.c0, kcXQ2)) { heart(1); ctx.globalCompositeOperation = 'lighter'; return; }
  let tx = kcXQ2[0] - kcXQ[0], ty = kcXQ2[1] - kcXQ[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
  const nx = -ty, ny = tx, gap = (0.008 + 0.012 * K.gk) * ps * split, BIG = 4000, px0 = kcXQ[0], py0 = kcXQ[1];
  // what shows in the gap: blood, dark at the middle
  ctx.save(); ctx.beginPath(); egg(0, 0, 0.068, 0.047, 0.043); ctx.clip();
  ctx.beginPath(); ctx.moveTo(px0 - tx * BIG, py0 - ty * BIG); ctx.lineTo(px0 + tx * BIG, py0 + ty * BIG);
  ctx.globalAlpha = al; ctx.strokeStyle = kcXc(K, 'red'); ctx.lineWidth = Math.max(2, gap * 1.15); ctx.stroke();
  ctx.strokeStyle = kcXc(K, 'redD'); ctx.lineWidth = Math.max(1.2, gap * 0.6); ctx.stroke();
  ctx.restore();
  for (let side = -1; side <= 1; side += 2) {
    ctx.save(); ctx.beginPath();
    ctx.moveTo(px0 - tx * BIG, py0 - ty * BIG); ctx.lineTo(px0 + tx * BIG, py0 + ty * BIG); ctx.lineTo(px0 + tx * BIG + nx * side * BIG, py0 + ty * BIG + ny * side * BIG); ctx.lineTo(px0 - tx * BIG + nx * side * BIG, py0 - ty * BIG + ny * side * BIG); ctx.closePath(); ctx.clip();
    ctx.translate(nx * side * gap * 0.5, ny * side * gap * 0.5);
    heart(split);
    // the torn edge
    ctx.beginPath(); for (let i = -14; i <= 14; i++) { const j = (kcHash(i * 3.3 + side) - 0.5) * gap * 0.7, x = px0 + tx * i * 5, y = py0 + ty * i * 5; if (i > -14) ctx.lineTo(x + nx * side * j, y + ny * side * j); else ctx.moveTo(x + nx * side * j, y + ny * side * j); }
    ctx.globalAlpha = al * 0.9; ctx.strokeStyle = kcXc(K, 'red'); ctx.lineWidth = 1.4; ctx.stroke();
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'lighter';
}
// The brain, inside the vault: soft, barely there on a radiograph, with its folds faintly showing.
// Hit, a bruise spreads out from the wound through it.
function kcXBrain(ctx, K, c, fig, al, items) {
  const hd = fig.hd, sc = fig.sc * kcSkK, fs = fig.fs, pl = K.plan;
  kcLoc(hd, kcBrC[0] * sc, kcBrC[1] * sc, kcBrC[2] * sc, kcXL); if (!kcProj(c, kcXL[0], kcXL[1], kcXL[2], kcXQ)) return;
  const s = kcXQ[2] * sc, ag = kcAge(K, 'brain'), burst = K.burst ? kcAge(K, 'burst') : -1;
  if (burst > 0.4) return; // blown out with the vault
  items.push({ z: kcXQ[3] + 0.02, f() {
    const k = burst >= 0 ? 1 - burst / 0.4 : 1, sw = ag >= 0 ? 0.08 * Math.exp(-ag * 3) * Math.cos(ag * 14) : 0;
    ctx.beginPath(); kcXEgg(ctx, c, hd, kcBrC[0] * sc, kcBrC[1] * sc, kcBrC[2] * sc, kcBrR[0] * sc * (1 + sw) * k, kcBrR[1] * sc * (1 - sw * 0.5) * k, kcBrR[2] * sc * k);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al; ctx.fillStyle = kcXC.organ + '0.16)'; ctx.fill(); ctx.globalCompositeOperation = 'source-over';
    // the folds: a few wandering lines over its surface, and the split down the middle
    if (0.08 * s > 22) {
      ctx.beginPath();
      for (let j = 0; j < 7; j++) {
        let pen = false;
        for (let i = 0; i <= 10; i++) {
          const t = -1.2 + (i / 10) * 2.4, side = j < 3 ? -1 : j < 6 ? 1 : 0, lat = side * (0.35 + 0.18 * (j % 3)), w = 0.06 * Math.sin(i * 2.1 + j * 1.3);
          const n0 = j === 6 ? 0.02 * Math.sin(i * 3) : lat + w, n1 = Math.cos(t) * 0.85, n2 = Math.sin(t) * 0.9;
          if (!kcXP(c, hd, (kcBrC[0] + kcBrR[0] * n0) * sc, (kcBrC[1] + kcBrR[1] * n1) * sc, (kcBrC[2] + kcBrR[2] * n2) * sc, kcXQ)) { pen = false; continue; }
          if (pen) ctx.lineTo(kcXQ[0], kcXQ[1]); else ctx.moveTo(kcXQ[0], kcXQ[1]); pen = true;
        }
      }
      ctx.globalAlpha = al * 0.22; ctx.strokeStyle = kcXC.organEdge + '1)'; ctx.lineWidth = 1; ctx.stroke();
    }
    if (ag >= 0 && pl && pl.part === 'head') { // bruised all through, slowly
      ctx.beginPath(); kcXEgg(ctx, c, hd, kcBrC[0] * sc, kcBrC[1] * sc, kcBrC[2] * sc, kcBrR[0] * sc * k, kcBrR[1] * sc * k, kcBrR[2] * sc * k);
      ctx.globalAlpha = al * 0.16 * smooth(ag / 1.5); ctx.fillStyle = kcXc(K, 'bruise') + '1)'; ctx.fill();
    }
  } });
}

// ---- the wound -------------------------------------------------------------------------------
// The round's track through the body. Just behind the round the tissue is thrown outward into a
// hollow far wider than the round (the temporary cavity: how wide depends on the round, a pencil
// for a .22, a fist for a .50); it ripples, and over a second falls in on itself, leaving a ragged
// permanent channel a few times the round's width, and a bruise that spreads out round it. Each
// slice of the track is a disc square to the round's line, so the hollow reads from any angle.
// With the Stormglass the channel glows and steams.
function kcXCavity(ctx, K, c, fig, al) {
  const pl = K.plan, sm = pl.samples, T = K.ct, fr = pl.part === 'head' ? fig.hd : fig.tor, bb = pl.part === 'head' ? pl.u0 : pl.b0, fs = fig.fs;
  const lim = K.through === false ? pl.sStop : pl.sOut;
  let n = 0;
  for (let i = 0; i < sm.length; i += 2) { if (sm[i + 1] < 0 && K.s >= sm[i]) sm[i + 1] = T; if (sm[i + 1] >= 0 && sm[i] <= lim + 0.012) n = i / 2 + 1; }
  if (n < 1) return;
  const Rm = K.cavR, Rc = K.chanR, sIn = pl.sIn, hp = K.petal ? 0.012 : 0.05, U = fr.U, F = fr.F;
  const disc = (i, r) => { kcLoc(fr, sm[i * 2] * fs, bb, pl.c0, kcXL); kcMul(kcXV, U, r); kcMul(kcXV2, F, r); return kcEll(ctx, c, kcXL[0], kcXL[1], kcXL[2], kcXV, kcXV2); };
  // per slice: how wide the hollow is now, and the channel it leaves
  const rT = K.rT || (K.rT = new Float32Array(160)), rP = K.rP || (K.rP = new Float32Array(160)), m = Math.min(n, 160);
  let anyT = false;
  for (let i = 0; i < m; i++) {
    const age = T - sm[i * 2 + 1], dep = sm[i * 2] - sIn, prof = smooth((dep - 0.004) / hp) * (pl.part === 'head' ? 0.72 : 1) * (K.tumbleK ? 0.5 + 0.9 * smooth((dep - 0.05) / 0.08) : 1);
    const env = (1 - Math.exp(-age / 0.05)) * Math.exp(-age / 0.55) * (0.8 + 0.2 * Math.cos(age * TAU / 0.3)) * 1.45;
    rT[i] = Rm * prof * Math.max(0, env); rP[i] = Rc * (pl.part === 'head' ? 0.55 : 1) * (0.6 + 0.8 * kcHash(i * 3.1 + K.cavSeed)) * smooth(age / 0.1) * (0.4 + 0.6 * smooth((dep + 0.01) / 0.03));
    if (rT[i] > rP[i] * 1.3) anyT = true;
  }
  // the slices' middles on screen, and pixels per metre there
  const qx = K.qX || (K.qX = new Float32Array(160)), qy = K.qY || (K.qY = new Float32Array(160)), qs = K.qS || (K.qS = new Float32Array(160));
  for (let i = 0; i < m; i++) { kcLoc(fr, sm[i * 2] * fs, bb, pl.c0, kcXL); if (!kcProj(c, kcXL[0], kcXL[1], kcXL[2], kcXQ)) return; qx[i] = kcXQ[0]; qy[i] = kcXQ[1]; qs[i] = kcXQ[2]; }
  const tx0 = qx[m - 1] - qx[0], ty0 = qy[m - 1] - qy[0], tl0 = Math.hypot(tx0, ty0);
  // A tube whose radius at slice i is f(i) metres: its outline seen from the side as one shape, and a
  // disc for every slice (which is what shows when the line points at the camera). Both go round the
  // same way, so they add up to one shape.
  const tube = (f) => {
    if (m > 1 && tl0 > 1) {
      const nx = ty0 / tl0, ny = -tx0 / tl0; let first = true;
      for (let i = 0; i < m; i++) { const r = Math.max(0, f(i)) * qs[i]; if (first) ctx.moveTo(qx[i] + nx * r, qy[i] + ny * r); else ctx.lineTo(qx[i] + nx * r, qy[i] + ny * r); first = false; }
      for (let i = m - 1; i >= 0; i--) { const r = Math.max(0, f(i)) * qs[i]; ctx.lineTo(qx[i] - nx * r, qy[i] - ny * r); }
      ctx.closePath();
    }
    for (let i = 0; i < m; i++) { const r = f(i); if (r > 0.0004) disc(i, r); }
  };
  ctx.lineJoin = 'round';
  // the bruise round the channel
  if (K.gore) {
    const bk = pl.part === 'head' ? 0.6 : 1;
    ctx.beginPath(); tube((i) => rP[i] * (1.5 + 1.5 * bk * smooth((T - sm[i * 2 + 1]) / 1.4)) + rT[i] * 0.2);
    ctx.globalAlpha = al * 0.2; ctx.fillStyle = kcXC.bruise + '1)'; ctx.fill();
  }
  // the hollow: its stretched wall, then the empty inside (filling over the inner halves of the wall)
  if (anyT) {
    ctx.beginPath(); tube((i) => (rT[i] > rP[i] ? rT[i] : rP[i]));
    ctx.globalAlpha = al * 0.75; ctx.strokeStyle = K.gore ? kcXC.redHi : '#bfe6ea'; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.globalAlpha = al * 0.86; ctx.fillStyle = K.gore ? '#1a0306' : '#02090f'; ctx.fill();
    // rings running out through the flesh as it bounces
    ctx.beginPath();
    for (let i = 0; i < m; i += 4) { const age = T - sm[i * 2 + 1]; if (age > 0.6) continue; const rr = rT[i] * (1.25 + 0.9 * ((age * 3.3) % 1)); disc(i, rr); }
    ctx.globalAlpha = al * 0.22; ctx.strokeStyle = K.gore ? '#ff9a8a' : '#d8f4f8'; ctx.lineWidth = 1; ctx.stroke();
  }
  // the channel it leaves
  ctx.beginPath(); tube((i) => rP[i]);
  ctx.globalAlpha = al * 0.7; ctx.strokeStyle = K.gore ? '#7a0c16' : '#9cc9d2'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.globalAlpha = al; ctx.fillStyle = kcXc(K, 'redD'); ctx.fill();
  // torn shreds along its edge
  if (K.gore && m > 3) {
    ctx.beginPath();
    for (let i = 1; i < m - 1; i += 2) {
      const age = T - sm[i * 2 + 1]; if (age < 0.2) continue;
      kcLoc(fr, sm[i * 2] * fs, bb, pl.c0, kcXL); if (!kcProj(c, kcXL[0], kcXL[1], kcXL[2], kcXQ)) continue;
      const an = kcHash(i * 7.7 + K.cavSeed) * TAU, r = rP[i] * kcXQ[2], l = r * (1.3 + 1.6 * kcHash(i * 2.3));
      ctx.moveTo(kcXQ[0] + Math.cos(an) * r, kcXQ[1] + Math.sin(an) * r); ctx.lineTo(kcXQ[0] + Math.cos(an) * (r + l), kcXQ[1] + Math.sin(an) * (r + l));
    }
    ctx.globalAlpha = al * 0.8; ctx.strokeStyle = '#a3141c'; ctx.lineWidth = 1.2; ctx.stroke();
  }
  // the coil slug's channel: seared, glowing, steaming
  if (K.steel && m > 1) {
    const heat = 0.55 + 0.45 * Math.exp(-(T - (sm[1] || T)) / 6) + 0.08 * Math.sin(K.T * 9);
    ctx.globalCompositeOperation = 'lighter'; ctx.beginPath(); let pen = false;
    for (let i = 0; i < m; i++) { kcLoc(fr, sm[i * 2] * fs, bb, pl.c0, kcXL); if (!kcProj(c, kcXL[0], kcXL[1], kcXL[2], kcXQ)) { pen = false; continue; } if (pen) ctx.lineTo(kcXQ[0], kcXQ[1]); else ctx.moveTo(kcXQ[0], kcXQ[1]); pen = true; }
    const w = Math.max(2, Rc * kcXQ[2] * 2.4);
    ctx.lineCap = 'round'; ctx.globalAlpha = al * 0.35 * heat; ctx.strokeStyle = '#46c8ff'; ctx.lineWidth = w * 2.4; ctx.stroke();
    ctx.globalAlpha = al * 0.7 * heat; ctx.strokeStyle = '#a8ecff'; ctx.lineWidth = w; ctx.stroke();
    ctx.globalAlpha = al * 0.8 * heat; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, w * 0.3); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
}

// ---- all of it -------------------------------------------------------------------------------
// The whole X-ray of the body at strength al (0..1): flesh first, then the organs, bones and the
// wound sorted far to near, so nearer things lie over farther ones as the camera goes round.
function kcXDraw(ctx, K, c, fig, al) {
  if (al < 0.01 || !kcFigProj(c, fig)) return;
  kcXFlesh(ctx, K, c, fig, al);
  const items = [];
  if (K.gore) { kcXOrgans(ctx, K, c, fig, al, items); kcXBrain(ctx, K, c, fig, al, items); }
  kcXBones(ctx, K, c, fig, al, items);
  kcXSkull(ctx, K, c, fig, al, items);
  if (K.hitT !== null && K.plan) {
    // the wound sits at the depth of the round's line through the body
    const pl = K.plan, fr = pl.part === 'head' ? fig.hd : fig.tor;
    kcLoc(fr, 0, pl.part === 'head' ? pl.u0 : pl.b0, pl.c0, kcXL);
    items.push({ z: (kcXL[0] - c.x) * c.fx + (kcXL[1] - c.y) * c.fy + (kcXL[2] - c.z) * c.fz - 0.03, f() { kcXCavity(ctx, K, c, fig, al); } });
  }
  items.sort((p, q) => q.z - p.z);
  for (let i = 0; i < items.length; i++) items[i].f();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
}
