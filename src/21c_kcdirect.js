// ---------------------------------------------------------------------------
// The kill camera's direction (the film itself is src/21_killcam.js): the shots the X-ray is
// cut into and how the camera moves between them, the real scene kept behind the X-ray, and
// the body's fall back in the real place.
//
// Shots. Every film picks one of four recipes from its own seed (where the round hit), then
// varies every angle a little, so no two films look alike:
//   cut    a close-up of the round going in from the shooter's side; a whip round to a tight
//          macro of the main thing it hits, where the film freezes for half a second; a whip out
//          to a side view of what comes out of the far side
//   ride   over the round's shoulder as it goes in, the macro from high in front, the way out low
//   orbit  one long unbroken move round the body, in close for the macro and out for the exit
//   low    from below as it goes in, the macro from above, the way out from beyond the body with
//          the spray coming toward the camera
// In every shot the camera keeps drifting slowly round. A round that stays in the body gets a
// last macro of where it came to rest. A macro of the spine is from behind.
//
// Angles are measured round the round's own line: 0 is from behind the round, looking the way it
// flies; 90 is square across it; 180 is from beyond the target, looking back at the shooter. Plus
// is the side the target faces (so we see their front), minus the other side.
//
// The scene. Halfway through the swing the real scene is drawn once, small, into a picture of its
// own (as the camera will see it when the swing ends, with the target left out), darkened and
// turned blue, and kept behind the X-ray. As the camera moves the picture slides a little the
// other way, as a distant background does, and drawn small and blown up it is softly out of focus.
//
// The fall. When the slow motion ends the camera comes round to a three-quarter view of the body
// from the shooter's side and a little above, and the X-ray fades back into the real scene (the
// car seat, the balcony, the quay, the blood on the wall), where the body falls just as the scope
// will show it once the film is over.
// ---------------------------------------------------------------------------
const kcRecipes = [
  // for the way in, the macro and the way out: [angle, height (degrees), size (half the picture's
  // height in metres), lens (1 normal, more is longer), drift (degrees a second)]; whip: seconds
  { id: 'cut', entry: [40, 12, 0.2, 1, 7], macro: [92, 16, 0.15, 1.5, 4], exit: [112, 8, 0.46, 0.9, 6], whip: 0.22 },
  { id: 'ride', entry: [17, 7, 0.24, 1.1, -4], macro: [70, 28, 0.155, 1.5, -5], exit: [96, -5, 0.5, 0.85, 5], whip: 0.2 },
  { id: 'orbit', entry: [52, 18, 0.22, 1, 14], macro: [100, 20, 0.17, 1.3, 14], exit: [140, 14, 0.5, 0.9, 14], whip: 0.5 },
  { id: 'low', entry: [62, -15, 0.21, 1, -6], macro: [86, 30, 0.145, 1.6, 5], exit: [150, 6, 0.55, 0.9, -8], whip: 0.2 },
];
const kcDeg = Math.PI / 180;
const kcNewOrbit = () => ({ fx: 0, fy: 0, fz: 0, phi: 0, el: 0, R: 1, f: 600, ax: 0.5, ay: 0.5 });
const kcNewPose = () => ({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, f: 600, fx: 0, fy: 0, fz: 0, ax: 0.5, ay: 0.5 });
const kcO1 = kcNewOrbit(), kcO2 = kcNewOrbit(), kcO3 = kcNewOrbit(), kcP1 = kcNewPose(), kcP2 = kcNewPose(), kcP3 = kcNewPose();
const kcWrap = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

// Pick and vary this film's recipe (from the shot's own seed: where the round hit).
function kcPickRecipe(K) {
  const R = makeRng(Math.round(K.cavSeed * 1000) + 31), pick = Math.floor(R.f() * kcRecipes.length) % kcRecipes.length;
  const r = kcRecipes.find((q) => q.id === KillCam.testRecipe) || kcRecipes[pick]; // (KillCam.testRecipe: for tests only)
  const szK = K.part === 'head' ? 0.7 : 1;
  const jit = (v) => [v[0] + (R.f() - 0.5) * 14, v[1] + (R.f() - 0.5) * 12, v[2] * szK * (0.9 + R.f() * 0.2), v[3], v[4] * (R.f() < 0.25 ? -1 : 1)];
  const rec = { id: r.id, entry: jit(r.entry), macro: jit(r.macro), exit: jit(r.exit), lodged: [88 + (R.f() - 0.5) * 30, 18, 0.075 * szK, 1.5, 5], whip: r.whip };
  rec.entrySide = R.f() < 0.25 ? -1 : 1;
  const key = K.plan && K.plan.key;
  rec.macroSide = key && (key.ref === 'spine' || key.ref === 'spineC') ? -1 : 1;
  rec.exitSide = R.f() < 0.2 ? -1 : 1;
  K.rec = rec;
}
// Where shot `name` puts the camera, t seconds into it, as orbit settings round a point.
function kcShotOrbit(K, V, name, t, o) {
  const pl = K.plan, d = K.dir, H = pl.H, rec = K.rec, W = V.W, Hh = V.H, fb = 0.55 * Math.max(W, Hh) * kcTune.lensX, short = K.short ? 1.6 : 1;
  const head = pl.part === 'head', szK = head ? 0.7 : 1;
  let p, side = K.side, s, size;
  if (name === 'entry') {
    p = rec.entry; side *= rec.entrySide;
    // the point looked at: between the round and the skin while it comes in, then following the tip
    s = K.hitT === null ? Math.max(pl.sIn - 0.15 * szK, (K.s + pl.sIn) / 2) : lerp(pl.sIn, K.s, 0.5);
    size = p[2] * (1 - 0.12 * smooth(t / 2));
  } else if (name === 'macro') {
    p = rec.macro; side *= rec.macroSide; s = pl.key ? pl.sKey : 0; size = p[2] * (1 - 0.15 * smooth(t / 1.4));
  } else if (name === 'lodged') {
    p = rec.lodged; s = K.s - K.len * 0.5; size = p[2] * (1 - 0.15 * smooth(t / 1.4));
  } else {
    p = rec.exit; side *= rec.exitSide; s = pl.sOut + 0.13 * szK; size = p[2] * (1 + 0.22 * smooth(t / 1.6));
    if (head) p = [Math.max(p[0], 128), p[1] + 14, p[2], p[3], p[4]]; // a head from further round and above: never face on to the wound
  }
  o.fx = H[0] + d[0] * s; o.fy = H[1] + d[1] * s; o.fz = H[2] + d[2] * s;
  o.phi = side * (p[0] + p[4] * t * short) * kcDeg; o.el = (p[1] + 2.5 * Math.sin(t * 0.8)) * kcDeg;
  o.f = fb * p[3]; o.R = Math.max(head ? 0.42 : 0.55, (o.f * size) / (0.5 * Hh)); o.f = (o.R * 0.5 * Hh) / size; o.ax = 0.5; o.ay = 0.5;
  return o;
}
// Orbit settings to a camera pose: round the line's own axes (sw.B back along the line, sw.N level
// and square to it, sw.U up), looking at the point.
function kcPoseFromOrbit(K, o, P) {
  const sw = K.sw, B = sw.B, N = sw.N, U = sw.U, cp = Math.cos(o.phi) * Math.cos(o.el), sp = Math.sin(o.phi) * Math.cos(o.el), se = Math.sin(o.el);
  P.x = o.fx + o.R * (B[0] * cp + N[0] * sp + U[0] * se); P.y = o.fy + o.R * (B[1] * cp + N[1] * sp + U[1] * se); P.z = o.fz + o.R * (B[2] * cp + N[2] * sp + U[2] * se);
  const dx = o.fx - P.x, dy = o.fy - P.y, dz = o.fz - P.z;
  P.yaw = Math.atan2(dx, dz); P.pitch = Math.atan2(-dy, Math.hypot(dx, dz));
  P.f = o.f; P.fx = o.fx; P.fy = o.fy; P.fz = o.fz; P.ax = o.ax; P.ay = o.ay;
  return P;
}
// Between two orbit settings: round the body (not through it), the distance eased on a log scale.
function kcBlendOrbit(a, b, w, o) {
  o.fx = lerp(a.fx, b.fx, w); o.fy = lerp(a.fy, b.fy, w); o.fz = lerp(a.fz, b.fz, w);
  o.phi = lerp(a.phi, b.phi, w); o.el = lerp(a.el, b.el, w); o.R = Math.exp(lerp(Math.log(a.R), Math.log(b.R), w));
  o.f = lerp(a.f, b.f, w); o.ax = lerp(a.ax, b.ax, w); o.ay = lerp(a.ay, b.ay, w);
  return o;
}
// Between two poses, in a straight line.
function kcBlendPose(a, b, w, o) {
  o.x = lerp(a.x, b.x, w); o.y = lerp(a.y, b.y, w); o.z = lerp(a.z, b.z, w);
  o.yaw = a.yaw + kcWrap(b.yaw - a.yaw) * w; o.pitch = lerp(a.pitch, b.pitch, w); o.f = Math.exp(lerp(Math.log(a.f), Math.log(b.f), w));
  o.fx = lerp(a.fx, b.fx, w); o.fy = lerp(a.fy, b.fy, w); o.fz = lerp(a.fz, b.fz, w); o.ax = lerp(a.ax, b.ax, w); o.ay = lerp(a.ay, b.ay, w);
  return o;
}
// Set the camera to a pose, sliding its picture so the point looked at sits where the pose wants it.
function kcApplyPose(c, P, W, H) {
  c.x = P.x; c.y = P.y; c.z = P.z; c.yaw = P.yaw; c.pitch = P.pitch; c.f = P.f; kcCamAim(c);
  c.px = 0; c.py = 0;
  if (kcProj(c, P.fx, P.fy, P.fz, kcQ)) { c.px = P.ax * W - kcQ[0]; c.py = P.ay * H - kcQ[1]; } else { c.px = W / 2; c.py = H / 2; }
  c.fpx = P.fx; c.fpy = P.fy; c.fpz = P.fz;
  return c;
}
// A whip: slow off, very fast through the middle, slow on.
const kcWhipK = (u) => { const s = smooth(u); return s * s * (3 - 2 * s); };

// The swing: from where the chase camera ended, round to the first shot. On the way it frames the
// whole body for a moment, then pushes in.
function kcSwingPose(K, V, P) {
  const sw = K.sw, W = V.W, H = V.H, u = clamp((K.T - K.Tb) / K.tn.swing, 0, 1), e = smooth(u);
  kcShotOrbit(K, V, 'entry', 0, kcO2);
  const k1 = smooth(u * 1.25), push = smooth((u - 0.42) / 0.58), f = lerp(sw.f, kcO2.f, e), Rfull = f / Math.min(W / 1.5, (H * 0.85) / 1.62);
  const o = kcO1;
  o.fx = lerp(lerp(sw.H[0], sw.mid[0], k1), kcO2.fx, push); o.fy = lerp(lerp(sw.H[1], sw.mid[1], k1), kcO2.fy, push); o.fz = lerp(lerp(sw.H[2], sw.mid[2], k1), kcO2.fz, push);
  o.phi = lerp(sw.phi0, kcO2.phi, e); o.el = lerp(sw.el0, kcO2.el, e);
  o.R = Math.exp(lerp(Math.log(lerp(sw.R0, Rfull, e)), Math.log(kcO2.R), push)); o.f = f; o.ax = 0.5; o.ay = 0.5;
  kcPoseFromOrbit(K, o, P);
  // the chase camera looked straight down range with its picture slid sideways; over the first third
  // of the swing that becomes a camera that really looks at what it films
  const w = smooth(u / 0.3), k2 = smooth(u * 1.3);
  P.yaw *= w; P.pitch *= w; P.ax = lerp(sw.phx / W, 0.5, k2); P.ay = lerp(sw.phy / H, 0.5, k2);
  return P;
}
// The current shot (and during a whip, a blend from the last one, which keeps drifting meanwhile).
function kcShotPose(K, V, P) {
  const T = K.T;
  kcShotOrbit(K, V, K.shot, T - K.shotT0, kcO1);
  if (K.shotPrev && T - K.shotT0 < K.shotWhip) {
    kcShotOrbit(K, V, K.shotPrev, T - K.shotPrevT0, kcO2);
    const u = (T - K.shotT0) / K.shotWhip;
    kcBlendOrbit(kcO2, kcO1, K.rec.whip > 0.4 ? smooth(u) : kcWhipK(u), kcO3);
    K.whipping = Math.sin(u * Math.PI) * (K.rec.whip > 0.4 ? 0.35 : 1);
    K.orbNow = kcO3;
    return kcPoseFromOrbit(K, kcO3, P);
  }
  K.whipping = 0; K.orbNow = kcO1;
  return kcPoseFromOrbit(K, kcO1, P);
}
// A pose as orbit settings round the point it looks at (the inverse of kcPoseFromOrbit).
const kcO4 = kcNewOrbit(), kcO5 = kcNewOrbit();
function kcOrbitOf(K, P, o) {
  const sw = K.sw, B = sw.B, N = sw.N, U = sw.U, vx = P.x - P.fx, vy = P.y - P.fy, vz = P.z - P.fz, R = Math.max(1e-3, Math.hypot(vx, vy, vz));
  o.fx = P.fx; o.fy = P.fy; o.fz = P.fz; o.R = R;
  o.phi = Math.atan2(vx * N[0] + vy * N[1] + vz * N[2], vx * B[0] + vy * B[1] + vz * B[2]);
  o.el = Math.asin(clamp((vx * U[0] + vy * U[1] + vz * U[2]) / R, -1, 1));
  o.f = P.f; o.ax = P.ax; o.ay = P.ay;
  return o;
}
// Change shot (from the advance, so it happens on the film's own timing).
function kcCut(K, name, whip) {
  if (K.shot === name) return;
  K.shotPrev = K.shot; K.shotPrevT0 = K.shotT0; K.shot = name; K.shotT0 = K.T; K.shotWhip = whip * (K.short ? 0.65 : 1);
}
// The fall: a three-quarter view of the body from the shooter's side, a little above, looking
// straight down range (the only way the scene's flat layers can be shown truthfully), its picture
// slid to frame the body.
function kcFallPose(K, V, P) {
  const fl = K.follow || K.plan.H, H = V.H, N = K.sw.N, side = K.side * (K.rec ? K.rec.exitSide : 1), back = 3.3, lat = 1.85 * side;
  P.x = fl[0] + N[0] * lat; P.y = fl[1] + 0.95; P.z = fl[2] - back + N[2] * lat;
  P.yaw = 0; P.pitch = 0; P.f = (H * 0.5 * (fl[2] - P.z)) / 1.2;
  P.fx = fl[0]; P.fy = fl[1]; P.fz = fl[2]; P.ax = 0.5; P.ay = 0.56;
  return P;
}
// Every frame from the swing on: where the camera is.
function kcDirect(K, V) {
  const c = K.cam, W = V.W, H = V.H, T = K.T;
  let P;
  K.orbNow = null;
  if (T < K.Tc && !K.take) P = kcSwingPose(K, V, kcP1);
  else P = kcShotPose(K, V, kcP1);
  K.fallK = 0;
  if (K.holdT0 !== null || K.take) {
    const w = K.take ? 1 : smooth((T - K.holdT0) / K.tn.fallIn);
    if (w > 0) {
      kcFallPose(K, V, kcP2);
      if (w >= 1 || !K.orbNow) P = kcBlendPose(P, kcP2, w, kcP3);
      else {
        // round the body to the three-quarter view, not through it (a straight line from a close
        // side view to the fall's view can pass within a hand span of the chest), then square up to
        // look straight down range
        const a = K.orbNow, b = kcOrbitOf(K, kcP2, kcO4);
        b.phi = a.phi + kcWrap(b.phi - a.phi);
        kcBlendOrbit(a, b, w, kcO5); kcPoseFromOrbit(K, kcO5, kcP3);
        const wy = smooth((w - 0.3) / 0.7);
        kcP3.yaw += kcWrap(-kcP3.yaw) * wy; kcP3.pitch *= 1 - wy;
        P = kcP3;
      }
    }
    K.fallK = w;
  }
  kcApplyPose(c, P, W, H);
  return c;
}

// ---- the scene behind the X-ray ---------------------------------------------------------------
// The camera for the scene's flat layers, matched to a 3D camera at one point, for a picture of
// any size (kcLayerCam is the same for the whole screen).
function kcLayerCamWH(Wd, Hd, c, ax, ay, az) {
  const d = Math.max(0.3, az - c.z), cx = Wd / 2, cy = Hd / 2;
  let ppm = c.f / 1000, sx = c.px + (c.f * (ax - c.x)) / d, sy = c.py - (c.f * (ay - c.y)) / d;
  if ((c.yaw || c.pitch) && kcProj(c, ax, ay, az, kcQ)) { ppm = (kcQ[2] * d) / 1000; sx = kcQ[0]; sy = kcQ[1]; }
  return { cx, cy, hw: Wd / 2, hh: Hd / 2, ex: c.x, ey: c.y, ez: c.z, ax: ((ax - c.x) / d) * 1000 - (sx - cx) / ppm, ay: ((ay - c.y) / d) * 1000 + (sy - cy) / ppm, ppm };
}
// Where the X-ray's origin (the target's feet) is in the world.
// (At first as the flight has it, so the swing starts exactly where the chase ended; pinned to the
// live target a third of the way into the swing.)
function kcOrigin(K) {
  const a = K.o.actor, sw = K.sw, w = smooth((K.T - K.Tb) / (K.tn.swing * 0.3));
  return [lerp(sw.ox, a && isFinite(a.x) ? a.x : sw.ox, w), lerp(sw.oy, a && isFinite(a.y) ? a.y : sw.oy, w), sw.oz];
}
// Draw the real scene through camera c (X-ray space) onto ctx; the target left out if hide.
// Only for the length of this one call: nothing in the world changes.
function kcWorld(K, V, ctx, c, Wd, Hd, dpr, dt, simDt, hide, near) {
  const o = K.o, sim = o.sim, a = o.actor, O = kcOrigin(K);
  const wc = { x: c.x + O[0], y: c.y + O[1], z: c.z + O[2], yaw: c.yaw, pitch: c.pitch, f: c.f, px: c.px, py: c.py, rx: c.rx, rz: c.rz, fx: c.fx, fy: c.fy, fz: c.fz, ux: c.ux, uy: c.uy, uz: c.uz };
  const lc = kcLayerCamWH(Wd, Hd, wc, (c.fpx || 0) + O[0], (c.fpy || 0) + O[1], (c.fpz || 0) + O[2]);
  const keepCtx = V.ctx, keepDpr = V.dpr, keepHide = a ? a.hidden : false, id = a ? a.id : null, keepById = id !== null ? sim.byId[id] : null;
  // (the blood thrown on a wall behind is placed for the shooter's eye; from this camera, close by,
  // it belongs on the wall where the round would reach it, so that correction is left off here)
  const rd = a && a.rd, keepEye = rd ? rd.eye : null;
  const held = [], fxAll = V.fx || [];
  // (puffs and glass shards near the target are sized to be seen through the scope from far off; close
  // up they would be great blots and slabs, and the film throws its own, true to size)
  if (fxAll.length) { const show = [], ax = a ? a.x : 0, az = O[2]; for (let i = 0; i < fxAll.length; i++) { const f = fxAll[i]; ((f.k === 'star' || ((f.k === 'puff' || f.k === 'shard') && Math.abs(f.x - ax) < 4 && Math.abs(f.z - az) < 8)) ? held : show).push(f); } V.fx = show; }
  try {
    V.ctx = ctx; V.dpr = dpr; if (rd) rd.eye = null;
    if (hide && a) { a.hidden = true; if (a.inVeh) sim.byId[id] = null; } // (a passenger is drawn through the car's window by id)
    V.drawWorld(sim, lc, dt, simDt, { near: near || 0.6 });
  } finally {
    V.ctx = keepCtx; V.dpr = keepDpr; if (rd) rd.eye = keepEye;
    if (hide && a) { a.hidden = keepHide; if (a.inVeh) sim.byId[id] = keepById; }
    for (let i = 0; i < held.length; i++) { const f = held[i]; f.t = (f.t || 0) + (simDt || 0); if (f.t < f.life) V.fx.push(f); }
  }
}
// Draw the backdrop picture once, for the pose the swing will end on.
function kcBgRender(K, V) {
  const W = V.W, H = V.H, mx = 0.42, my = 0.34, Wb = W * (1 + 2 * mx), Hb = H * (1 + 2 * my), q = kcTune.bgRes;
  let cv = K.bgCv;
  try { if (!cv) cv = K.bgCv = document.createElement('canvas'); } catch (e) { return; }
  cv.width = Math.max(2, Math.round(Wb * q)); cv.height = Math.max(2, Math.round(Hb * q));
  const x = cv.getContext('2d'); if (!x) return;
  kcShotOrbit(K, V, 'entry', 0, kcO2); kcPoseFromOrbit(K, kcO2, kcP2);
  const c = kcCamAim({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, f: 600, px: 0, py: 0 });
  kcApplyPose(c, kcP2, W, H); c.px += W * mx; c.py += H * my;
  x.setTransform(q, 0, 0, q, 0, 0); x.fillStyle = '#000'; x.fillRect(0, 0, Wb, Hb);
  kcWorld(K, V, x, c, Wb, Hb, q, 0, 0, true, 0.6);
  // darkened and turned to the film's blue
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1;
  x.globalCompositeOperation = 'multiply'; x.fillStyle = '#7ea4cc'; x.fillRect(0, 0, cv.width, cv.height);
  x.globalCompositeOperation = 'source-over'; x.fillStyle = 'rgba(3,9,18,0.34)'; x.fillRect(0, 0, cv.width, cv.height);
  K.bg = { cv, Wb, Hb, yaw: c.yaw, pitch: c.pitch, f: c.f, ax0: W * (0.5 + mx), ay0: H * (0.5 + my), fx: kcP2.fx, fy: kcP2.fy, fz: kcP2.fz, W, H };
}
// Show the backdrop for camera c: anchored where the point it was drawn round now is, slid the
// other way as the camera turns (a little, as a distant background does), and always covering the screen.
function kcBgDraw(K, V, ctx, c, al) {
  const B = K.bg; if (!B || al < 0.01) return;
  const W = V.W, H = V.H, kp = 0.38;
  let ax = W / 2, ay = H / 2; if (kcProj(c, B.fx, B.fy, B.fz, kcQ)) { ax = kcQ[0]; ay = kcQ[1]; }
  const s = Math.max(((c.f / B.f) * 0.92 + 0.08) * (W / B.W), (W / B.Wb) * 1.02, (H / B.Hb) * 1.02);
  ax -= kp * c.f * kcWrap(c.yaw - B.yaw); ay -= kp * c.f * (c.pitch - B.pitch);
  let x0 = ax - B.ax0 * s, y0 = ay - B.ay0 * s; const w = B.Wb * s, h = B.Hb * s;
  x0 = clamp(x0, W - w, 0); y0 = clamp(y0, H - h, 0);
  ctx.globalAlpha = al; ctx.drawImage(B.cv, x0, y0, w, h); ctx.globalAlpha = 1;
}

// ---- the single take ------------------------------------------------------------------------
// For a story moment (a mission with cine: 'take'): no rifle, no chase, no X-ray, no words. One
// unbroken shot of the target in the real scene, from the shooter's side at three-quarters, the
// world running at its own speed; the round arrives, the body falls, the camera holds on it a
// moment and the picture goes down to black.
function kcTakeSetup(K, o) {
  const a = o.actor, h = o.hit, d = K.dir, nl = Math.hypot(d[0], d[2]) || 1;
  K.sw = { N: [d[2] / nl, 0, -d[0] / nl], ox: a ? a.x : h.x, oy: a ? a.y : h.y - 1, oz: h.z };
  K.Ta = -10; K.Tb = -10; K.Tc = -10; K.plan = null; K.stamps = [];
}
function kcAdvanceTake(K, o, dt) {
  K.T += dt; K.ct += dt;
  const T = K.T, a = o.actor;
  K.prevRet = K.ret; K.stage = K.hitT === null ? 2 : 4;
  if (!K.snd.fly && T >= 0.02) { K.snd.fly = 1; kcSay(K, 'fly'); }
  K.ret += dt; // real time
  if (K.hitT === null && K.ret >= o.tHit + K.step) {
    K.hitT = T; K.holdT0 = T;
    kcSay(K, 'enter', { spray: K.gore ? +clamp(K.gk, 0, 1).toFixed(2) : 0 });
    if (K.exit) kcSay(K, 'exit', { size: +K.exitK.toFixed(2), spray: K.gore ? +clamp(K.gx, 0, 1).toFixed(2) : 0 });
  }
  if (K.hitT !== null && !K.snd.fall && a && a.dead && isFinite(a.deathAtT)) { const L = rdLanded(a, K.ret - a.deathAtT); if (L) { K.snd.fall = 1; K.landT = T; kcSay(K, 'fall', { mat: L.mat, speed: L.v }); } }
  if (K.hitT !== null && K.outT0 === null && ((K.landT !== undefined && T - K.landT > 1.4) || T - K.hitT > 4.5)) K.outT0 = T;
  if (K.outT0 !== null && T - K.outT0 > 0.5) { K.done = true; kcSayEnd(K); }
  K.rate = 1; K.wr = 1; K.simDt = Math.max(0, K.ret - K.prevRet);
  return K.ret;
}
function kcDrawTake(K, V, ctx, dt) {
  const W = V.W, H = V.H, fig = kcBuildFig(K), P = fig.P;
  const fx = (P.hip[0] + P.neck[0]) / 2, fy = Math.max(0.35, (P.hip[1] + P.neck[1]) / 2 - 0.15), fz = (P.hip[2] + P.neck[2]) / 2;
  if (!K.follow) K.follow = [fx, fy, fz]; else { const k = Math.min(1, (dt || 0) * 4); K.follow[0] += (fx - K.follow[0]) * k; K.follow[1] += (fy - K.follow[1]) * k; K.follow[2] += (fz - K.follow[2]) * k; }
  const Pz = kcFallPose(K, V, kcP2); Pz.f *= 1 + 0.08 * smooth(K.T / 4); // a slow push in
  const c = kcApplyPose(K.cam, Pz, W, H);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  kcWorld(K, V, ctx, c, W, H, V.dpr, dt, K.simDt, false, 1.2);
  ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
