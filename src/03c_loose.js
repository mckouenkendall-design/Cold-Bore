// ---------------------------------------------------------------------------
// Things that fall when their owner dies: the hat, whatever was in the hands, the rifle.
// Picture only. Each one is a small box that falls, spins, bounces, slides to a stop and
// settles flat, worked out in fixed steps from the moment of death (like the ragdoll), so
// the same death always looks the same however the frames fall. Then it stays where it lay.
//   a case      tumbles, and bursts open when it lands: papers slide out across the ground
//   a cup       tumbles and smashes: shards and a splash
//   an umbrella is caught by the wind and blown away along the ground
//   a rifle     clatters down, bounces twice and lies flat
//   a hat       keeps its real shape: knocked off by a head shot, or falling off as the body
//               lands, and comes to rest beside the body
// Space: the figure's own drawing space (metres, unscaled, feet at 0, already facing the
// right way), as in src/03_figures.js.
// ---------------------------------------------------------------------------

// w, h: half size of the box; cx, cy: where its middle is from the grip it was held by (in its own
// frame); e: how much it bounces; flat: the angles it can lie at rest; drag: how much the air holds it
// back (and the wind carries it); spin: how fast it was set turning
const FIG_LOOSE = {
  case: { w: 0.215, h: 0.143, cx: 0, cy: -0.19, e: 0.32, flat: Math.PI, spin: 7 },
  duffel: { w: 0.34, h: 0.14, cx: 0, cy: -0.305, e: 0.08, flat: Math.PI, spin: 3 },
  shopping: { w: 0.155, h: 0.18, cx: 0, cy: -0.285, e: 0.12, flat: Math.PI / 2, spin: 5 },
  cup: { w: 0.044, h: 0.068, cx: 0, cy: 0.037, e: 0, flat: Math.PI / 2, spin: 9 },
  flowers: { w: 0.14, h: 0.22, cx: 0, cy: 0.2, e: 0.1, flat: Math.PI, spin: 6, lie: Math.PI / 2 },
  cane: { w: 0.45, h: 0.02, cx: 0.0, cy: 0, e: 0.3, flat: Math.PI, spin: 4 },
  umbrella: { w: 0.64, h: 0.3, cx: 0, cy: 1.52, e: 0.15, flat: Math.PI, spin: 3, drag: 2.2 },
  clip: { w: 0.116, h: 0.158, cx: 0, cy: 0.015, e: 0.2, flat: Math.PI, spin: 6, lie: Math.PI / 2 },
  box: { w: 0.25, h: 0.185, cx: 0, cy: 0.095, e: 0.18, flat: Math.PI / 2, spin: 3 },
  paper: { w: 0.215, h: 0.155, cx: 0, cy: 0.125, e: 0, flat: Math.PI, spin: 3, drag: 4, lie: Math.PI / 2 },
  rifle: { w: 0.6, h: 0.05, cx: 0.3, cy: 0, e: 0.38, flat: Math.PI, spin: 5 },
  hat: { w: 0.24, h: 0.1, cx: 0, cy: 0, e: 0.25, flat: Math.PI, spin: 10 },
};
const FIG_LH = 1 / 120;

// The box for `key` at the moment being drawn (G.dT seconds after death), or null before it is loose.
//   o: { x, y, vx, vy, vr, t0 }   where its middle starts, how it starts moving, and when it is let go
function figLoose(G, key, o) {
  const st = G.st, C = FIG_LOOSE[key], T = G.dT;
  let L = st.loose && st.loose[key];
  if (L && T < L.t - 0.05) L = null; // the clock went back (test pictures only)
  if (!L) {
    if (!o || T < (o.t0 || 0)) return null;
    L = { x: o.x, y: o.y, vx: o.vx, vy: o.vy, r: o.r || 0, vr: o.vr, t: o.t0 || 0, land: null, rest: false, hits: 0 };
    (st.loose || (st.loose = {}))[key] = L;
  }
  const R = G.A.rd, E = R && R.env, sc = G.sc, wind = (G.wind || 0) / sc, drag = C.drag || 0.15;
  const x0 = E ? E.x0 / sc : -99, x1 = E ? E.x1 / sc : 99;
  let n = 0;
  while (!L.rest && L.t + FIG_LH <= T && n++ < 900) {
    const h = FIG_LH;
    L.vy -= 9.8 * h; L.vx += (wind * (C.drag ? 0.8 : 0) - L.vx) * drag * h;
    L.x += L.vx * h; L.y += L.vy * h; L.r += L.vr * h; L.t += h;
    // the floor (none past the end of a roof or a quay: it falls on out of sight)
    const off = L.x < x0 || L.x > x1, g = off ? -60 : figFloorAt(G, R || {}, L.x);
    const cs = Math.abs(Math.cos(L.r)), sn = Math.abs(Math.sin(L.r)), low = L.y - (cs * C.h + sn * C.w);
    if (low <= g + 0.004) {
      if (low < g) L.y += g - low;
      if (L.vy < 0) {
        if (L.land === null) L.land = L.t;
        L.hits++; L.vy = -L.vy * C.e; if (L.vy < 0.35) L.vy = 0;
        L.vx *= 0.55; L.vr = L.vr * 0.35 + L.vx * 4;
      }
      // on the ground: it slides to a stop and tips over on to its nearest flat side
      const lie = C.lie === undefined ? 0 : C.lie, tgt = Math.round((L.r - lie) / C.flat) * C.flat + lie;
      L.vx *= 1 - (C.drag ? 2.5 : 7) * h;
      if (C.drag && Math.abs(wind) > 0.3) L.vx += (wind * 0.55 - L.vx) * 3 * h; // the wind rolls it along
      L.vr += ((tgt - L.r) * 70 - L.vr * 11) * h;
      if (L.vy === 0 && Math.abs(L.vr) < 1) L.r += (tgt - L.r) * Math.min(1, 6 * h); // and lies down flat
      if (Math.abs(L.vx) < 0.03 && Math.abs(L.vr) < 0.3 && L.vy === 0 && Math.abs(tgt - L.r) < 0.03 && !(C.drag && Math.abs(wind) > 0.3)) { L.r = tgt; L.rest = true; }
    }
    if (L.y < -40) L.rest = true;
  }
  return L;
}
// The usual start: from where it was held, carried on with the body's own speed, tossed a little up and
// out the way the body falls, and set turning.
function figLooseFrom(G, key, x, y, k) {
  const R = G.A.rd, C = FIG_LOOSE[key], rng = makeRng(((R && R.seed) || 7) + hashStr(key)), sc = G.sc;
  const dir = R && R.s ? R.s.lean || G.fs : G.fs, vx0 = R ? (R.vx0 || 0) / sc : 0;
  return { x, y, vx: vx0 * 0.9 + dir * (0.35 + 0.7 * rng.f()) * (k || 1), vy: (0.5 + 1.1 * rng.f()) * (k || 1), vr: (rng.f() < 0.5 ? -1 : 1) * C.spin * (0.6 + 0.6 * rng.f()), t0: 0 };
}

// Sets up the drawing origin for a thing held in a hand: hanging from the grip while the owner lives,
// wherever it has fallen once they are dead. False if it is not to be drawn (a cup that has smashed).
function figHold(c, G, ha, depth, key) {
  if (!G.dead) { figHang(c, G, ha, depth); return true; }
  const C = FIG_LOOSE[key];
  const L = figLoose(G, key, figLooseFrom(G, key, ha[0] + C.cx, ha[1] + C.cy));
  if (!L) { c.translate(ha[0], ha[1]); return true; }
  if (key === 'cup' && L.land !== null) { c.translate(L.x, L.y); figCupSmash(c, G, L); return false; }
  c.translate(L.x, L.y); c.rotate(L.r); c.translate(-C.cx, -C.cy);
  return true;
}

// The papers out of a burst case: they slide and flutter out across the ground and lie there.
// (Drawn in the case's own frame, before the case, so they come out from under it.)
function figCasePapers(c, G) {
  const L = G.st.loose && G.st.loose.case; if (!L || L.land === null) return;
  const T = G.dT - L.land, rng = makeRng(((G.A.rd && G.A.rd.seed) || 3) + 77), px = G.px;
  c.save(); c.translate(L.x, L.y); // level: the papers lie on the floor, whichever way the case came to rest
  for (let i = 0; i < 5; i++) {
    // each sheet is thrown up out of the case and drifts down, rocking, to lie on the ground near it
    const side = rng.f() < 0.5 ? -1 : 1, d = (0.25 + 0.6 * rng.f()) * side, del = 0.04 * i, dur = 0.9 + 0.5 * rng.f(), u = clamp((T - del) / dur, 0, 1), w = 0.1 + 0.03 * rng.f(), h = 0.07 + 0.02 * rng.f();
    if (u <= 0) continue;
    const lift = Math.sin(Math.PI * Math.min(1, u * 1.15)) * (0.35 + 0.25 * rng.f()) * (1 - u * 0.3), x = d * easeOut(u) + rng.r(-0.05, 0.05), rock = Math.sin(T * (7 + i) + i) * 0.6 * (1 - u);
    const g = -L.y + figFloorAt(G, G.A.rd || {}, L.x + x), down = u >= 1;
    c.fillStyle = figC(i % 2 ? '#e9e5d8' : '#f4f1e8');
    c.save();
    if (down) { // lying on the ground, seen from a little above: a flat sheet
      c.translate(x, g + 0.008); c.beginPath(); c.moveTo(-w, -0.006); c.lineTo(w, -0.006); c.lineTo(w * 0.85, 0.022); c.lineTo(-w * 1.1, 0.022); c.closePath(); c.fill();
      if (G.fine) { c.strokeStyle = figC('#a3a8ad'); c.lineWidth = Math.max(0.004, px * 0.5); c.beginPath(); c.moveTo(-w * 0.7, 0.008); c.lineTo(w * 0.5, 0.008); c.stroke(); }
    } else { // in the air: turning over as it falls, so it shows its face and then its edge
      c.translate(x, g + 0.03 + lift); c.rotate(rock + side * 0.3); c.scale(1, 0.25 + 0.75 * Math.abs(Math.cos(T * (5 + i) + i)));
      c.beginPath(); c.rect(-w, -h, w * 2, h * 2); c.fill();
      if (G.fine) { c.strokeStyle = figC('#9aa0a6'); c.lineWidth = Math.max(0.005, px * 0.5); c.beginPath(); for (let k = 0; k < 3; k++) { c.moveTo(-w * 0.75, h * 0.5 - k * h * 0.45); c.lineTo(w * (k === 2 ? 0.2 : 0.7), h * 0.5 - k * h * 0.45); } c.stroke(); }
    }
    c.restore();
  }
  c.restore();
}

// A cup that hit the ground: a splash of coffee on the floor and the pieces round it.
function figCupSmash(c, G, L) {
  const T = G.dT - L.land, rng = makeRng(((G.A.rd && G.A.rd.seed) || 5) + 31), col = G.L.bagCol || '#f1ede2';
  const g = -L.y + figFloorAt(G, G.A.rd || {}, L.x), k = easeOut(clamp(T / 0.25, 0, 1));
  c.fillStyle = figC('#5a3a22'); c.globalAlpha = 0.85; c.beginPath(); c.ellipse(0, g + 0.004, 0.06 + 0.16 * k, 0.012 + 0.006 * k, 0, 0, Math.PI); c.fill(); c.globalAlpha = 1;
  c.fillStyle = figC(col); c.beginPath();
  for (let i = 0; i < 6; i++) {
    const vx = rng.r(-1.4, 1.4), vy = rng.r(0.4, 1.4), t = Math.min(T, (vy + Math.sqrt(vy * vy)) / 9.8), x = vx * t * (T > t ? 1 : 1), y = g + Math.max(0, vy * Math.min(T, t) - 4.9 * Math.min(T, t) * Math.min(T, t)), s = 0.012 + 0.012 * rng.f(), a = rng.f() * TAU;
    c.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s); c.lineTo(x + Math.cos(a + 2.2) * s, y + Math.sin(a + 2.2) * s); c.lineTo(x + Math.cos(a + 4.1) * s * 0.7, y + Math.sin(a + 4.1) * s * 0.7); c.closePath();
  }
  c.fill();
  if (T < 0.4) { // drops thrown up
    c.fillStyle = figC('#6b4a2e'); c.beginPath();
    for (let i = 0; i < 5; i++) { const vx = rng.r(-1, 1), vy = rng.r(0.8, 1.6), x = vx * T, y = g + vy * T - 4.9 * T * T; if (y < g) continue; c.moveTo(x + 0.01, y); c.arc(x, y, 0.01, 0, TAU); }
    c.fill();
  }
}

// The hat, once it has left the head. True when it has (so the head is drawn bare).
function figHatOff(G) { return figHatGone(G.A, G.dead, G.dT); }
function figHatGone(A, dead, dT) {
  const hat = A.look && A.look.hat;
  if (!dead || !hat || hat === 'hood' || hat === 'helmet') return false;
  const R = A.rd; if (!R) return false;
  if (R.part === 'head' && (R.how === 'shot' || R.how === 'npc')) return true;
  return !!(R.s && R.s.land && dT >= R.s.landT);
}
// Draws the fallen hat (after the body, so it is in front of it when it comes to rest on top).
function figLooseHat(c, G) {
  const L = G.L, hat = L.hat, R = G.A.rd, s = R.s, sc = G.sc, top = FIG.headR * 0.62;
  let o = null;
  if (!(G.st.loose && G.st.loose.hat)) {
    const rng = makeRng((R.seed || 1) + 404), dir = s ? s.lean || G.fs : G.fs;
    if (R.part === 'head' && (R.how === 'shot' || R.how === 'npc')) {
      // knocked off by the round: up, spinning, the way the round was going if it came from the side
      const j = figJoints(figPose(G.A.deathPose || 'stand', G.A.deathAt || 0, G.A.deathPh || 0, G.A)), fd = G.A.face || 1;
      const side = R.v ? clamp(R.v[0] / Math.max(1, Math.abs(R.v[2])) * 8, -1, 1) : 0, vx = (side || dir * 0.6) * (1.2 + 1.1 * rng.f()) + (R.vx0 || 0) / sc;
      o = { x: j.head[0] * fd, y: j.head[1] + top + 0.05, vx, vy: 2.6 + 1.2 * rng.f() * (0.6 + R.power), vr: (rng.f() < 0.5 ? -1 : 1) * (8 + 7 * rng.f()), t0: 0 };
    } else if (s && s.land) {
      // shaken off as the body hits the ground
      o = { x: s.land[4] / sc, y: s.land[5] / sc + top + 0.05, vx: dir * (0.5 + 0.5 * rng.f()), vy: 0.7 + 0.5 * rng.f(), vr: dir * (4 + 4 * rng.f()), t0: s.landT };
    }
  }
  const Lz = figLoose(G, 'hat', o); if (!Lz) return;
  // drawn as the real hat, side on, in its own frame
  const f0 = G.f, wl0 = G.wl, fa0 = G.fa, hx0 = G.hlx, hy0 = G.hly;
  G.f = G.fs; G.wl = (1 + G.f) / 2; G.fa = 1; G.hlx = G.lx; G.hly = G.ly;
  c.save(); c.translate(Lz.x, Lz.y); c.rotate(Lz.r); c.translate(0, -(top + 0.06));
  figHat(c, G, hat);
  c.restore();
  G.f = f0; G.wl = wl0; G.fa = fa0; G.hlx = hx0; G.hly = hy0;
}
