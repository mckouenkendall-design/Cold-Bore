// ---------------------------------------------------------------------------
// The kill camera's first moment (the film itself is src/21_killcam.js): the player's rifle
// where the player is, as the shot goes.
//
// The place: behind the rifle the real scene from the shooter's position (the far layers
// only, drawn once, small and soft, as a long lens would see it past a rifle in focus). In
// front, what the rifle rests on, chosen from the vantage's own name: the parapet of a roof,
// a steel rail (a crane, a tower, a stack), a wooden sill (a loft window), a rock ledge (a
// cairn, a scree shelf, a ridge), a snow bank, a log, the planks of a pier. Rain beads on the
// barrel and the scope and spatters off the ledge; snow lies on them.
//
// The shot: a gloved hand on the grip, the index finger on the trigger. The gas is shaped by
// what is on the muzzle: a fireball and tongues from a bare muzzle, short prongs from a flash
// hider, side jets from a brake (two pairs from a hammerhead, a ring from a radial brake),
// jets up out of a compensator's top ports, a forward cone from the blast cone, only a soft
// grey breath from a suppressor, a blue-white arc from the coil gun. The blast kicks dust (or
// snow, or spray) up off the ledge under the muzzle. Then the hand goes to the bolt, lifts it
// and draws it back, and the empty case spins out; a self-loader throws its own case.
//
// The camera: one of five set-ups from the shot's own seed: the whole rifle side on; close on
// the muzzle; close on the action and the hand; low, looking up past the rifle at the sky; or
// from the rifle's other side.
// ---------------------------------------------------------------------------
// Where the hand holds each kind of rifle (rifle units): the top and bottom of the grip, the trigger;
// and for a bolt action, the bolt handle's root and knob.
const kcGrip = {
  classic: { gt: [-1.4, -1.8], gb: [-7.4, 6.0], tr: [5.0, 4.2] },
  chassis: { gt: [0.5, 1.0], gb: [-2.4, 10.4], tr: [5.6, 3.3] },
  ar: { gt: [1.2, 2.6], gb: [-2.0, 10.8], tr: [6.3, 4.5] },
  svd: { gt: [-2.4, 1.8], gb: [-6.2, 9.2], tr: [6.2, 3.3] },
  rail: { gt: [-3.0, 2.2], gb: [-3.8, 9.4], tr: [3.2, 4.4] },
};
const kcBolt = { classic: { root: [4.5, -3.8], knob: [2.2, 0.7], r: 1.15 }, chassis: { root: [20, -3.2], knob: [17.4, 1.8], r: 1.2 }, take: { root: [8, -3.2], knob: [6.4, 0.3], r: 1.0 } };
// The camera set-ups: [zoom at the start, zoom at the end, what it looks at (share of the rifle
// from the butt), height of the rifle on screen (share), tilt (radians), mirrored]
const kcRifleShots = {
  side: [1.0, 1.12, 0.62, 0.52, 0, false],
  muzzle: [2.3, 2.6, 0.93, 0.5, -0.03, false],
  action: [2.0, 2.15, 0.36, 0.56, 0.02, false],
  low: [1.12, 1.3, 0.66, 0.6, -0.085, false],
  mirror: [1.05, 1.2, 0.6, 0.53, 0, true],
};

// What is on the muzzle, as far as the gas goes.
function kcDevice(K, o) {
  const m = (o.cfg && o.cfg.muzzle) || 'mz_none', A = (typeof GUN_ART !== 'undefined' && GUN_ART[o.gunId]) || {};
  if (K.steel) return m === 'mz_sg_damper' ? 'coilD' : 'coil';
  if (K.quiet || A.can || A.mod || /sup|can/.test(m)) return 'can';
  if (m === 'mz_flash' || (A.type === 'svd' && !A.short && m === 'mz_none')) return 'hider';
  if (m === 'mz_brake' || (A.amr && m === 'mz_none')) return 'brake';
  if (m === 'mz_av_hammer') return 'hammer';
  if (m === 'mz_rad') return 'radial';
  if (m === 'mz_comp') return 'comp';
  if (m === 'mz_av_cone') return 'cone';
  return 'bare';
}
// What the rifle rests on, from the vantage's name and the scene.
function kcLedgeKind(sim) {
  const S = sim.S || {}, n = String((sim.vantage && sim.vantage.name) || '').toLowerCase(), snowy = S.time === 'snow' || S.weather === 'snow';
  if (/window|loft|sill/.test(n)) return 'sill';
  if (/crane|tower|stack|hoist|elevator|signal/.test(n)) return 'steel';
  if (/pier|deck|jetty/.test(n)) return 'planks';
  if (/stump|larch|log|tree/.test(n)) return 'log';
  if (/snow hole|fence/.test(n)) return 'snow';
  if (/cairn|scree|rock|ridge|ledge|eagle|goat|fall/.test(n) || S.ambience === 'wild' || S.ambience === 'snow') return snowy ? 'rocksnow' : 'rock';
  return 'roof';
}
// Pick this film's set-up and draw the place behind the rifle (once).
function kcRifleSetup(K, V) {
  const o = K.o, sim = o.sim, S = sim.S || {}, R = makeRng(Math.round(K.cavSeed * 777) + 5);
  const names = ['side', 'muzzle', 'action', 'low', 'mirror'];
  // (KillCam.testRifle picks the set-up: for tests only)
  const R0 = { shot: KillCam.testRifle || names[Math.floor(R.f() * names.length) % names.length], dev: kcDevice(K, o), ledge: kcLedgeKind(sim), rain: S.weather === 'rain' || S.weather === 'storm', snow: S.time === 'snow' || S.weather === 'snow', seed: R.f() * 100, W: 0, H: 0 };
  let G = null; try { G = gunShapes(o.gunId, o.cfg); } catch (e) { G = null; }
  const A = G ? G.art : {};
  R0.type = A.type === 'chassis' ? 'chassis' : A.type === 'ar' ? 'ar' : A.type === 'svd' ? 'svd' : A.type === 'rail' ? 'rail' : 'classic';
  R0.bolt = K.action === 'bolt' ? (A.take ? kcBolt.take : R0.type === 'classic' ? kcBolt.classic : R0.type === 'chassis' ? kcBolt.chassis : null) : null;
  R0.x0 = G ? G.x0 : -38; R0.x1 = G ? G.x1 : 92; R0.tri = o.cfg && o.cfg.support === 'sp_tripod';
  R0.by = A.type === 'rail' ? -4.6 : -3.4;
  // What it rests on, in rifle units: the top of the ledge (v), and where the ledge starts and ends
  // along the rifle (seen side on, the parapet is a block under the front half, the drop beyond it).
  const sup = (o.cfg && o.cfg.support) || 'sp_none', legs = /bipod|mono/.test(sup) || (A.amr && (sup === 'sp_none' || sup === 'sp_av_mono'));
  const fb = { classic: 39, chassis: 42, ar: 37, svd: 42, rail: 36 }[R0.type], under = { classic: 2.4, chassis: -0.6, ar: -0.7, svd: -0.9, rail: -0.2 }[R0.type], back = { classic: 22, chassis: 27, ar: 22, svd: 27, rail: 34 }[R0.type];
  if (R0.tri) { R0.lv = 26.6; R0.lu0 = R0.x0 - 400; R0.lu1 = R0.x1 + 8; }
  else if (legs || sup === 'sp_sticks') { R0.lv = 16; R0.lu0 = fb - 15; R0.lu1 = fb + 26; }
  else if (/bag/.test(sup)) { R0.lv = sup === 'sp_bag' ? 14.8 : 16; R0.lu0 = R0.x0 - 400; R0.lu1 = R0.x1 - 10; }
  else { R0.lv = under + 0.15; R0.lu0 = back; R0.lu1 = back + 30; }
  if (R0.ledge === 'log') R0.lu1 = R0.lu0 + 24;
  K.rifle = R0;
  // the place behind: the far layers of the real scene from the shooter's eye, looking toward the target
  try {
    const W = V.W, H = V.H, q = 0.34, Wb = W * 1.5, Hb = H * 1.4, cv = document.createElement('canvas');
    cv.width = Math.max(2, Math.round(Wb * q)); cv.height = Math.max(2, Math.round(Hb * q));
    const x = cv.getContext('2d'), e = sim.eye0, h = o.hit, d = Math.max(1, h.z - e.z);
    const cam = { cx: Wb / 2, cy: Hb / 2, hw: Wb / 2, hh: Hb / 2, ex: e.x, ey: e.y, ez: e.z, ax: ((h.x - e.x) / d) * 1000, ay: ((h.y - e.y) / d) * 1000 + 40, ppm: Wb / 900 };
    const keepCtx = V.ctx, keepDpr = V.dpr, held = V.fx; V.fx = [];
    try { V.ctx = x; V.dpr = q; x.setTransform(q, 0, 0, q, 0, 0); V.drawWorld(sim, cam, 0, 0, { near: 25 }); } finally { V.ctx = keepCtx; V.dpr = keepDpr; V.fx = held; }
    x.setTransform(1, 0, 0, 1, 0, 0);
    // a touch of haze over it: it is far off and out of focus
    x.fillStyle = rgba((S.pal && S.pal.fog) || '#808890', 0.18); x.fillRect(0, 0, cv.width, cv.height);
    R0.bg = { cv, Wb, Hb };
  } catch (e) { R0.bg = null; }
  return R0;
}

// ---- drawing ----------------------------------------------------------------------------------
function kcDrawBeat(K, V, ctx) {
  const o = K.o, W = V.W, H = V.H, T = K.T, pal = kcPal(o), dpr = V.dpr, S = o.sim.S || {};
  const Rf = K.rifle || kcRifleSetup(K, V);
  const sh = kcRifleShots[Rf.shot] || kcRifleShots.side, flip = sh[5] ? -1 : 1;
  // the layout: rifle units to screen. The rifle fits the screen's width at zoom 1.
  const span = Rf.x1 - Rf.x0, top = -15, bot = Rf.tri ? 28 : 17, base = Math.min((W * 0.86) / span, (H * 0.56) / (bot - top)) * 0.96;
  const e = easeOut((T - 0.05) / 0.85), z = lerp(sh[0], sh[1], e), sc = base * z, wh = clamp((T - (K.Ta - 0.2)) / 0.2, 0, 1);
  const fx = lerp(Rf.x0, Rf.x1, sh[2]), cx = W * 0.5 - flip * W * 1.5 * wh * wh * wh, cy = H * sh[3];
  // recoil: in this all-but-frozen moment the rifle has only begun to come back
  const rc = easeOut((T - 0.03) / 0.6) * 1.5 * (K.power > 0.7 ? 1.4 : 1);
  const tilt = sh[4] - 0.01 * rc;
  // rifle units (u, v) to screen: about (fx, 0), rotated by tilt, scaled, mirrored, placed at (cx, cy)
  const ca = Math.cos(tilt), sa = Math.sin(tilt);
  const gun = () => ctx.setTransform(dpr * sc * ca * flip, dpr * sc * sa, -dpr * sc * sa * flip, dpr * sc * ca, dpr * (cx - (fx + rc * 0) * sc * ca * flip), dpr * (cy - fx * sc * sa));
  const toS = (u, v, out) => { const du = u - fx; out[0] = cx + flip * (du * ca - v * sa) * sc; out[1] = cy + (du * sa + v * ca) * sc; return out; };
  const P = [0, 0], night = (pal.dark || 0) > 0.5, t1 = T - 0.03, loud = Rf.dev !== 'can' && Rf.dev !== 'coilD';
  const mx = Rf.x1 - 1, my = Rf.by, groundV = Rf.lv;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // ---- the sky and the place behind
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, pal.skyTop); g.addColorStop(1, pal.skyBot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (Rf.bg) {
    const B = Rf.bg, k = 1 + 0.06 * e, w = B.Wb * k, h = B.Hb * k;
    // as the camera whips away the place slides off, smeared out sideways so that its far edge never
    // comes into the picture
    let x0 = W * 0.5 - w * 0.5 - flip * W * 0.04 * e - flip * W * 0.9 * wh * wh, x1 = x0 + w;
    if (flip > 0) x1 = Math.max(x1, W * 1.02); else x0 = Math.min(x0, -W * 0.02);
    ctx.globalAlpha = 0.92; ctx.drawImage(B.cv, x0, H * (Rf.shot === 'low' ? 0.5 : 0.36) - h * 0.5 - H * 0.03 * e, x1 - x0, h); ctx.globalAlpha = 1;
  }
  // the light falls off toward the bottom (the rifle and the ledge are in the shooter's shade)
  const sg = ctx.createLinearGradient(0, H * 0.35, 0, H);
  sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,' + (night ? 0.55 : 0.32) + ')');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
  // ---- the ledge
  gun(); kcLedge(ctx, Rf, pal, S);
  // ---- what the blast throws up off the ledge, behind the rifle
  kcBlastDust(ctx, K, Rf, mx, my, groundV, t1, loud);
  // gas behind the rifle first, so the muzzle stays crisp in front of it
  kcMuzzleGas(ctx, K, Rf, mx, my, t1, T, false);
  // ---- the rifle, in the player's own skin, with its rest under the fore-end if it has no legs
  ctx.setTransform(dpr * sc * ca * flip, dpr * sc * sa, -dpr * sc * sa * flip, dpr * sc * ca, dpr * (cx - fx * sc * ca * flip), dpr * (cy - fx * sc * sa));
  ctx.translate(-rc, -rc * 0.1);
  // drawGun centres the rifle in a box: give it a box whose scale comes out at exactly one unit
  const top2 = -15, bot2 = Rf.tri ? 28 : 17, bxW = span / 0.96, bxH = (bot2 - top2) / 0.96;
  try { drawGun(ctx, o.gunId, o.cfg, (Rf.x0 + Rf.x1) / 2, (top2 + bot2) / 2, bxW, bxH, { time: 1.2 + T * 0.3, shadow: false }); } catch (er) { /* no rifle art: the rest still plays */ }
  // weather on the rifle, the hand, the bolt
  kcRifleWeather(ctx, Rf, T, S);
  kcHand(ctx, K, Rf, T);
  ctx.translate(rc, rc * 0.1);
  // ---- the flash and the gas in front
  kcMuzzleGas(ctx, K, Rf, mx, my, t1, T, true);
  // the shock ring of the blast, moving out ahead of the muzzle (a suppressor has none)
  const e3 = easeOut((T - 0.05) / 0.75);
  if (loud && T > 0.05 && e3 < 0.99) {
    ctx.lineWidth = 1.6 / sc;
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.45 * (1 - e3)).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(mx + 2 + 15 * e3, my, 0.5 + 3.4 * e3, 2 + 15 * e3, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.2 * (1 - e3)).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(mx + 1 + 8 * e3, my, 0.3 + 1.8 * e3, 1.5 + 9 * e3, 0, 0, TAU); ctx.stroke();
  }
  // ---- the round, coming out of the bore: the same 3D round as in the rest of the film, seen from
  // the side through a long lens. In screen space (the camera for it is set from the muzzle's place).
  toS(mx - rc, my - rc * 0.1, P);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const tip = T < 0.76 ? -4 + 30 * Math.pow(T / 0.76, 0.9) : 26 + 50 * (T - 0.76) + 1500 * (T - 0.76) * (T - 0.76);
  const bc = kcCamAim({ x: 1000 * flip, y: 0, z: 0, yaw: -Math.PI / 2 * flip, pitch: 0, f: 1000 * sc, px: P[0], py: P[1] });
  ctx.save(); ctx.translate(P[0], P[1]); ctx.rotate(tilt * flip); ctx.translate(-P[0], -P[1]);
  ctx.beginPath(); if (flip > 0) ctx.rect(P[0], -H, W * 3, H * 3); else ctx.rect(P[0] - W * 3, -H, W * 3, H * 3); ctx.clip();
  const bo = { len: 6.4, rad: 0.78, spin: K.spin * 2.2, mush: 0, steel: K.steel, hot: 0.5 * (1 - smooth((t1 - 0.2) / 0.5)) };
  if (K.sonic && tip > 4) kcWake(ctx, bc, 0, 0, tip, 0, 0, 1, { len: 6.4, rad: 0.78, a: 0.8 * smooth((tip - 4) / 8), t: T });
  kcBullet(ctx, bc, 0, 0, tip, 0, 0, 1, bo);
  ctx.restore();
  // ---- rain and snow in front of everything
  kcFrontWeather(ctx, Rf, T, W, H);
  // streaks as the camera whips after the round
  if (wh > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.35 * wh).toFixed(3) + ')'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i = 0; i < 26; i++) { const y = kcHash(i + 3) * H, x = kcHash(i + 40) * W; ctx.moveTo(x, y); ctx.lineTo(x + flip * W * 0.5 * wh, y); }
    ctx.stroke();
  }
  K.muzzleScr = P; // (for the flash's light in the overlay)
}

// The ledge the rifle rests on, in rifle units (about 9 mm each): a block from lu0 to lu1 with its
// top at lv, its wall going on down out of the picture, the roof behind it lower down.
function kcLedge(ctx, Rf, pal, S) {
  const tn = (hex) => (S.tone ? S.tone(hex) : hex), k = Rf.ledge, D = makeRng(Math.round(Rf.seed * 100) + 3);
  const u0 = Math.max(Rf.lu0, Rf.x0 - 400), u1 = Rf.lu1, v = Rf.lv, deep = 400, night = (pal.dark || 0) > 0.5;
  const C = {
    roof: ['#a29f97', '#7d5c50', '#5e4840'], steel: ['#5f6a75', '#353d45', '#262c32'], sill: ['#9a8262', '#a59a8a', '#7d7366'], planks: ['#7a644b', '#4d3e2f', '#3a2f24'],
    log: ['#6e5238', '#4a3624', '#3a2a1c'], snow: ['#f2f6fa', '#d4e0ec', '#c2d2e2'], rock: ['#8a857c', '#5f5a53', '#4a4640'], rocksnow: ['#eef3f7', '#5f5a53', '#4a4640'],
  }[k] || ['#a29f97', '#7d5c50', '#5e4840'];
  const top = tn(C[0]), face = tn(C[1]), dark = tn(C[2]);
  // the roof (or the slope) behind, lower down and in shade
  if (u0 > Rf.x0 - 300) { ctx.fillStyle = mix(dark, '#000000', 0.45); ctx.fillRect(u0 - 600, v + 24, 600, deep); ctx.fillStyle = rgba(mix(top, '#000000', 0.3), 0.6); ctx.fillRect(u0 - 600, v + 24, 600, 1.2); }
  if (k === 'snow') { // a bank of snow: a soft mound, bluer in its shade
    const w = u1 - u0;
    const sg = ctx.createLinearGradient(0, v, 0, v + 60); sg.addColorStop(0, top); sg.addColorStop(1, dark);
    ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(u0 - 20, v + 400); ctx.lineTo(u0 - 20, v + 30);
    ctx.bezierCurveTo(u0 - 8, v + 6, u0 + w * 0.1, v - 0.5, u0 + w * 0.4, v - 0.5); ctx.bezierCurveTo(u0 + w * 0.75, v - 0.5, u1 + 4, v + 4, u1 + 14, v + 30);
    ctx.lineTo(u1 + 14, v + 400); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(u0 - 6, v + 10); ctx.bezierCurveTo(u0 + w * 0.1, v + 0.4, u0 + w * 0.7, v + 0.1, u1 + 6, v + 8); ctx.stroke();
    ctx.fillStyle = 'rgba(120,150,190,0.18)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(u0 + D.f() * w, v + 8 + D.f() * 30, 6 + D.f() * 8, 1.2, 0, 0, TAU); ctx.fill(); } // drifts
    return;
  }
  if (k === 'log') { // a felled trunk: its cut end, rings and bark
    const r = (u1 - u0) / 2, cx = u0 + r, cy = v + r;
    ctx.fillStyle = face; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.fillStyle = tn('#b58c5e'); ctx.beginPath(); ctx.arc(cx, cy, r * 0.86, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(80,50,25,0.45)'; ctx.lineWidth = 0.35; ctx.beginPath(); for (let i = 1; i < 6; i++) { ctx.moveTo(cx + r * 0.15 * i, cy); ctx.arc(cx, cy, r * 0.15 * i, 0, TAU); } ctx.stroke();
    ctx.strokeStyle = 'rgba(40,25,10,0.5)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + r * 0.7, cy - r * 0.3); ctx.stroke();
    ctx.fillStyle = dark; ctx.fillRect(cx - r * 0.5, cy + r * 0.8, r, deep);
  } else {
    // the wall under the top, down out of the picture
    ctx.fillStyle = face; ctx.fillRect(u0, v + 3, u1 - u0, deep);
    // its texture
    ctx.lineWidth = 0.3;
    if (k === 'roof') { // brick courses with staggered joints
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath();
      for (let y = v + 3 + 8, row = 0; y < v + 120; y += 8, row++) { ctx.moveTo(u0, y); ctx.lineTo(u1, y); for (let x = u0 + (row % 2) * 11; x < u1; x += 22) { ctx.moveTo(x, y - 8); ctx.lineTo(x, y); } }
      ctx.stroke();
      ctx.fillStyle = 'rgba(120,40,30,0.25)'; for (let i = 0; i < 6; i++) ctx.fillRect(u0 + D.f() * (u1 - u0 - 20), v + 3 + 8 * Math.floor(1 + D.f() * 12), 20, 8); // the odd darker brick
    } else if (k === 'steel') { // a riveted girder, rust running from the rivets
      ctx.fillStyle = dark; ctx.fillRect(u0 + (u1 - u0) * 0.42, v + 6, (u1 - u0) * 0.16, deep); ctx.fillStyle = face; ctx.fillRect(u0, v + 3, u1 - u0, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; for (let x = u0 + 3; x < u1 - 1; x += 5) { ctx.beginPath(); ctx.arc(x, v + 4.5, 0.7, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = 'rgba(140,70,30,0.4)'; ctx.beginPath(); for (let i = 0; i < 8; i++) { const x = u0 + 3 + 5 * Math.floor(D.f() * ((u1 - u0) / 5)); ctx.moveTo(x, v + 5); ctx.lineTo(x + 0.3, v + 8 + D.f() * 10); } ctx.stroke();
    } else if (k === 'sill') { // painted plaster under a wooden sill, a crack, the paint flaking
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); let x = u0 + (u1 - u0) * 0.6, y = v + 4; ctx.moveTo(x, y); for (let i = 0; i < 6; i++) { x += (D.f() - 0.5) * 6; y += 4 + D.f() * 6; ctx.lineTo(x, y); } ctx.stroke();
    } else if (k === 'planks') { // posts under the planks
      ctx.fillStyle = dark; for (let x = u0 + 4; x < u1; x += 14) ctx.fillRect(x, v + 3, 4, deep);
    } else if (k === 'rock' || k === 'rocksnow') { // the rock face: cracks and lichen
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath();
      for (let i = 0; i < 6; i++) { let x = u0 + D.f() * (u1 - u0), y = v + 4 + D.f() * 6; ctx.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (D.f() - 0.5) * 8; y += 5 + D.f() * 7; ctx.lineTo(x, y); } }
      ctx.stroke();
      ctx.fillStyle = 'rgba(165,175,95,0.3)'; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(u0 + D.f() * (u1 - u0), v + 6 + D.f() * 30, 0.6 + D.f() * 1.4, 0, TAU); ctx.fill(); }
    }
    // the top: a slab (a coping, a sill, a plank, the rock's top) with a lit upper edge and a shadow under its lip
    ctx.fillStyle = top;
    if (k === 'rock' || k === 'rocksnow' || k === 'snow') { // lumpy
      ctx.beginPath(); ctx.moveTo(u0 - 1, v + 6);
      for (let x = u0 - 1; x <= u1 + 1; x += 3) ctx.lineTo(x, v + (k === 'snow' ? 0.4 : 0) - 0.6 * kcHash(x * 0.53 + Rf.seed) + (x < u0 + 4 || x > u1 - 4 ? 1.5 : 0));
      ctx.lineTo(u1 + 1, v + 6); ctx.closePath(); ctx.fill();
    } else ctx.fillRect(u0 - (k === 'roof' || k === 'sill' ? 1.5 : 0), v, u1 - u0 + (k === 'roof' || k === 'sill' ? 3 : 0), 3);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(u0, v + 3, u1 - u0, 0.9);
    ctx.fillStyle = rgba(mix(top, '#ffffff', 0.5), night ? 0.25 : 0.55); ctx.fillRect(u0 - 1, v - 0.05, u1 - u0 + 2, 0.4);
    // grit on top
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 0; i < 14; i++) ctx.fillRect(u0 + D.f() * (u1 - u0), v + 0.3 + D.f() * 1.8, 0.4, 0.3);
  }
  // snow lying on it; the wet shine of rain
  if (Rf.snow || k === 'rocksnow') { ctx.fillStyle = '#f5f8fb'; ctx.beginPath(); ctx.moveTo(u0 - 1, v + 0.6); for (let x = u0 - 1; x <= u1 + 1; x += 2) ctx.lineTo(x, v - 0.9 - 0.7 * kcHash(x * 0.37 + Rf.seed)); ctx.lineTo(u1 + 1, v + 0.6); ctx.closePath(); ctx.fill(); }
  if (Rf.rain) { ctx.fillStyle = rgba(mix(pal.skyBot, '#ffffff', 0.4), 0.35); ctx.fillRect(u0, v - 0.1, u1 - u0, 0.5); for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(u0 + D.f() * (u1 - u0), v + 0.3, 2 + D.f() * 3, 0.25, 0, 0, TAU); ctx.fill(); } }
}
// Dust (or snow, or spray) kicked up off the ledge by the blast under the muzzle: puffs that roll
// out along the surface and rise. More from a brake (its jets go sideways and down), little from a can.
function kcBlastDust(ctx, K, Rf, mx, my, gv, t1, loud) {
  if (t1 <= 0) return;
  const dev = Rf.dev, k = dev === 'brake' || dev === 'hammer' || dev === 'radial' ? 1.7 : dev === 'can' || dev === 'coilD' ? 0.35 : dev === 'coil' ? 0.6 : 1;
  const wet = Rf.rain, snowy = Rf.snow || Rf.ledge === 'snow' || Rf.ledge === 'rocksnow';
  const col = wet ? '#c9dbe8' : snowy ? '#f3f7fb' : Rf.ledge === 'steel' ? '#9a9a92' : Rf.ledge === 'rock' ? '#9a948a' : Rf.ledge === 'sill' || Rf.ledge === 'planks' || Rf.ledge === 'log' ? '#a08a6c' : '#a5a198';
  const e = easeOut(t1 / 0.9), n = Math.round(22 * k), ox = clamp(mx - 6, Rf.lu0 + 4, Rf.lu1 - 2);
  if (Math.abs(ox - (mx - 6)) > 30 && dev !== 'brake' && dev !== 'hammer' && dev !== 'radial') return; // the muzzle is well out past the ledge
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const h = kcHash(i * 1.7 + 4), side = i % 2 ? 1 : -1, dist = (2 + 26 * e * (0.3 + h)) * (side > 0 ? 1 : 0.6), rise = (0.6 + 8 * e * kcHash(i * 3.1)) * (wet ? 0.6 : 1);
    const r = (0.7 + 2.6 * e * (0.5 + h)) * (snowy ? 1.2 : 1);
    ctx.globalAlpha = (wet ? 0.2 : 0.13) * (1 - 0.6 * e) * (1.1 - h * 0.5);
    ctx.beginPath(); ctx.ellipse(ox + side * dist, gv - rise, r * 1.6, r, 0, 0, TAU); ctx.fill();
  }
  if (wet) { // spray of drops thrown off the wet ledge
    ctx.globalAlpha = 0.7 * (1 - e); ctx.fillStyle = '#e6f0f8';
    for (let i = 0; i < 18; i++) { const h = kcHash(i * 5.3 + 2), x = ox + (h - 0.5) * 40 * e, y = gv - 1 - 14 * e * kcHash(i * 2.9) + 9 * e * e; ctx.fillRect(x, y, 0.5, 0.9); }
  }
  ctx.globalAlpha = 1;
}
// The gas and the flash, by what is on the muzzle. front: false draws what is behind the rifle
// (smoke rolling back), true what is in front (the flash, the jets).
function kcMuzzleGas(ctx, K, Rf, mx, my, t1, T, front) {
  if (t1 <= 0) return;
  const dev = Rf.dev, grow = easeOut(t1 / 0.16), fade = 1 - smooth((t1 - 0.2) / 0.5), e2 = easeOut(T / 0.95);
  const smoke = (n, x, y, ax, ay, spread, size, a, col) => {
    ctx.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const h = kcHash(i + 9 + x), dist = (1 + 24 * e2) * (0.15 + 0.85 * h), off = (kcHash(i + 5) - 0.5) * (1.2 + dist * spread);
      const r = (0.6 + size * e2 * (0.5 + h)) * (0.7 + 0.6 * kcHash(i + 2));
      ctx.globalAlpha = a * (1 - 0.55 * e2) * (1.2 - h);
      ctx.beginPath(); ctx.arc(x + ax * dist - ay * off, y + ay * dist + ax * off, r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  // one tongue of flame from (bx, by) at angle an: white-hot at its root, orange, gone at its tip
  const jet = (bx, by, an, len, wd, a) => {
    if (len < 0.3) return;
    const c = Math.cos(an), s = Math.sin(an), lg = ctx.createLinearGradient(bx, by, bx + c * len, by + s * len);
    lg.addColorStop(0, 'rgba(255,252,236,' + (0.95 * fade * a).toFixed(3) + ')'); lg.addColorStop(0.35, 'rgba(255,205,110,' + (0.8 * fade * a).toFixed(3) + ')'); lg.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = lg; ctx.beginPath();
    ctx.moveTo(bx - s * wd * 0.3, by + c * wd * 0.3); ctx.quadraticCurveTo(bx + c * len * 0.4 - s * wd, by + s * len * 0.4 + c * wd, bx + c * len, by + s * len);
    ctx.quadraticCurveTo(bx + c * len * 0.4 + s * wd, by + s * len * 0.4 - c * wd, bx + s * wd * 0.3, by - c * wd * 0.3); ctx.closePath(); ctx.fill();
  };
  const tongue = (an, len, wd) => jet(mx, my, an, len, wd, 1);
  const fireball = (R1, hot, a) => {
    const fg = ctx.createRadialGradient(mx + R1 * 0.2, my, 0, mx + R1 * 0.2, my, R1);
    fg.addColorStop(0, 'rgba(255,253,240,' + (fade * a).toFixed(3) + ')'); fg.addColorStop(0.35, 'rgba(' + hot + ',' + (0.75 * fade * a).toFixed(3) + ')'); fg.addColorStop(1, 'rgba(' + hot + ',0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(mx + R1 * 0.2, my, R1, 0, TAU); ctx.fill();
  };
  const flame = 'rgba(255,196,96,', hotC = '255,196,96';
  if (!front) {
    if (dev === 'can') { smoke(10, mx + 1, my, 1, 0, 0.35, 1.4, 0.07, '#c9ced3'); return; }
    if (dev === 'coil' || dev === 'coilD') return;
    const side = dev === 'brake' || dev === 'hammer' || dev === 'radial';
    smoke(side ? 12 : 18, mx, my, 1, 0, 0.55, 2.6, 0.12, '#e9e0cd');
    if (side) { smoke(10, mx - 2, my, -0.35, -0.94, 0.5, 2.8, 0.14, '#e4dccb'); smoke(10, mx - 2, my, -0.35, 0.94, 0.5, 2.8, 0.12, '#e4dccb'); }
    if (dev === 'comp') smoke(10, mx - 3, my, 0.1, -1, 0.4, 2, 0.13, '#e4dccb');
    return;
  }
  if (fade < 0.01) return;
  const fl = (i) => 0.85 + 0.15 * Math.sin(T * 37 + i * 2); // the flame flickers
  if (dev === 'bare') {
    const sp = [0, 20, 0.5, 10, -0.55, 11, 1.1, 7, -1.2, 6.5, 1.95, 4.5, -2.0, 4];
    for (let i = 0; i < sp.length; i += 2) { const len = sp[i + 1] * grow * fl(i); tongue(sp[i] + 0.06 * Math.sin(T * 50 + i), len, len * 0.16 + 0.5); }
    fireball(10 * grow, hotC, 1);
  } else if (dev === 'hider') { // the prongs break the flash into short fingers
    for (let i = 0; i < 4; i++) { const len = (5 + 2 * kcHash(i)) * grow * fl(i); tongue((i - 1.5) * 0.32, len, 0.9); }
    fireball(4.2 * grow, hotC, 0.7);
  } else if (dev === 'brake' || dev === 'hammer' || dev === 'radial') {
    // the gas leaves through the side ports: jets out to each side (seen side on: up and down, swept back)
    const sets = dev === 'hammer' ? [-4.5, -1.5] : [-2];
    for (let j = 0; j < sets.length; j++) {
      const bx = mx + sets[j], n = dev === 'radial' ? 6 : 2;
      for (let i = 0; i < n; i++) {
        const an = dev === 'radial' ? (i % 2 ? 1 : -1) * (1.5 + 0.35 * Math.floor(i / 2)) : (i ? 1 : -1) * 1.95, len = (dev === 'radial' ? 7 : 12) * grow * fl(i + j);
        jet(bx, my, an, len, len * 0.3, 1); jet(bx, my, an + 0.25 * (i ? 1 : -1), len * 0.6, len * 0.2, 0.7);
      }
    }
    tongue(0, 6 * grow, 1); fireball(4.5 * grow, hotC, 0.8);
    // the ring of gas the brake throws round itself
    const ec = easeOut(t1 / 0.5); ctx.strokeStyle = 'rgba(255,240,220,' + (0.35 * (1 - ec)).toFixed(3) + ')'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.ellipse(mx - 2, my, 1 + 2 * ec, 3 + 13 * ec, 0, 0, TAU); ctx.stroke();
  } else if (dev === 'comp') { // jets up out of the top ports, a small flash ahead
    for (let i = 0; i < 3; i++) jet(mx - 4.5 + i * 1.65, my - 1, -Math.PI / 2 + 0.08, (6 + i) * grow * fl(i), 1.2, 1);
    tongue(0, 8 * grow, 1); fireball(5 * grow, hotC, 0.8);
  } else if (dev === 'cone') { // the cone throws it all forward, long and narrow
    tongue(0, 26 * grow * fl(1), 2.6); tongue(0.12, 16 * grow, 1.6); tongue(-0.12, 16 * grow, 1.6); fireball(7 * grow, hotC, 0.9);
  } else if (dev === 'can') { // no flash: a faint glow in the bore and a breath of gas
    fireball(1.6 * grow, '255,170,90', 0.35);
  } else { // the coil gun: a blue-white arc and a ring of vapour
    const big = dev === 'coil' ? 1 : 0.6;
    fireball(7 * grow * big, '150,235,255', 1);
    ctx.strokeStyle = 'rgba(200,245,255,' + (0.85 * fade).toFixed(3) + ')'; ctx.lineWidth = 0.45; ctx.beginPath();
    for (let a = 0; a < 5; a++) { // crackling arcs jumping off the rails
      let x = mx - 2 - a * 3, y = my + (a % 2 ? -2 : 2); ctx.moveTo(x, y);
      for (let j = 0; j < 5; j++) { x += 1.6 + kcHash(a * 9 + j + Math.floor(T * 30)) * 1.5; y += (kcHash(a * 7 + j * 3 + Math.floor(T * 30)) - 0.5) * 4 * big; ctx.lineTo(x, y); }
    }
    ctx.stroke();
    const ec = easeOut(t1 / 0.6); ctx.strokeStyle = 'rgba(220,245,255,' + (0.4 * (1 - ec)).toFixed(3) + ')'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.ellipse(mx + 3 + 10 * ec, my, 0.6 + 2 * ec, 2 + 9 * ec * big, 0, 0, TAU); ctx.stroke();
  }
  // the flash lights everything near it (not from a can)
  if (dev !== 'can' && dev !== 'coilD') {
    ctx.globalCompositeOperation = 'lighter';
    const hot = dev === 'coil' ? '150,235,255' : '255,196,96', lg = ctx.createRadialGradient(mx, my, 0, mx, my, 70);
    lg.addColorStop(0, 'rgba(' + hot + ',' + (0.3 * fade).toFixed(3) + ')'); lg.addColorStop(1, 'rgba(' + hot + ',0)');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(mx, my, 70, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
  }
}
// Rain beading on the top of the barrel and the scope (the blast throws the drops near the muzzle
// off); snow lying along them.
function kcRifleWeather(ctx, Rf, T, S) {
  if (!Rf.rain && !Rf.snow) return;
  const x0 = Rf.type === 'classic' ? 20 : 26, x1 = Rf.x1 - 2, by = Rf.by, top = by - 1.3;
  if (Rf.rain) {
    for (let i = 0; i < 15; i++) {
      const h = kcHash(i * 2.7 + Rf.seed), x = lerp(x0, x1, h), near = x > x1 - 14, t1 = T - 0.03, big = kcHash(i * 5.1);
      let dx = 0, dy = 0; if (near && t1 > 0) { dx = 30 * t1 * (0.5 + h); dy = -12 * t1 + 40 * t1 * t1; } // thrown off by the blast
      const r = 0.12 + 0.3 * big * big, y = top + 0.15 + (big > 0.7 ? 0.5 : 0) + dy;
      ctx.fillStyle = 'rgba(190,210,230,0.55)'; ctx.beginPath(); ctx.ellipse(x + dx, y, r * 1.2, r, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(245,250,255,0.9)'; ctx.beginPath(); ctx.arc(x + dx - r * 0.3, y - r * 0.35, r * 0.35, 0, TAU); ctx.fill(); // the light caught in it
    }
    // two drops running down the scope's bell
    ctx.fillStyle = 'rgba(225,238,250,0.6)'; for (let i = 0; i < 3; i++) { const x = 6 + i * 9, y = -11 + ((T * 6 + i * 2) % 4); ctx.beginPath(); ctx.ellipse(x, y, 0.25, 0.45, 0, 0, TAU); ctx.fill(); }
  } else {
    ctx.fillStyle = 'rgba(245,249,252,0.92)'; ctx.beginPath();
    ctx.moveTo(x0, top + 0.2); for (let x = x0; x <= x1; x += 2) ctx.lineTo(x, top - 0.25 - 0.35 * kcHash(x * 0.7 + Rf.seed)); ctx.lineTo(x1, top + 0.3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(2, -12.6); for (let x = 2; x <= 26; x += 2) ctx.lineTo(x, -13.1 - 0.3 * kcHash(x * 1.3)); ctx.lineTo(26, -12.5); ctx.closePath(); ctx.fill();
  }
}
// Rain streaks and snowflakes in front of the lens.
function kcFrontWeather(ctx, Rf, T, W, H) {
  if (Rf.rain) {
    ctx.strokeStyle = 'rgba(210,225,245,0.32)'; ctx.lineWidth = 1.1; ctx.beginPath();
    for (let i = 0; i < 70; i++) { const sp = 900 + 600 * kcHash(i), x = kcHash(i * 3.1) * W * 1.1, y = ((kcHash(i * 7.7) * (H + 60) + T * sp) % (H + 60)) - 30, l = 14 + 18 * kcHash(i * 1.3); ctx.moveTo(x, y); ctx.lineTo(x - l * 0.12, y + l); }
    ctx.stroke();
  } else if (Rf.snow) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 60; i++) { const sp = 40 + 50 * kcHash(i), x = (kcHash(i * 3.1) * W + Math.sin(T * 1.5 + i) * 10) % W, y = (kcHash(i * 7.7) * H + T * sp) % H, r = 0.8 + 1.6 * kcHash(i * 2.2); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  }
}
// The gloved hand: on the grip, finger on the trigger as the shot goes; then (a bolt action) up to
// the bolt, lifting it and drawing it back, and the empty case spinning out of the port.
function kcHand(ctx, K, Rf, T) {
  const gp = kcGrip[Rf.type] || kcGrip.classic, B = Rf.bolt;
  const glove = '#262826', glove2 = '#3d403c', seam = 'rgba(0,0,0,0.45)', sleeve = '#323a2d';
  // the bolt: lifted (up to 70 degrees about its root), then drawn back
  let lift = 0, back = 0, reach = 0;
  if (B) { reach = smooth((T - 0.3) / 0.14); lift = smooth((T - 0.44) / 0.16); back = smooth((T - 0.6) / 0.15); }
  if (B && lift > 0) {
    const an0 = Math.atan2(B.knob[1] - B.root[1], B.knob[0] - B.root[0]), an = an0 - lift * 1.25, l = Math.hypot(B.knob[0] - B.root[0], B.knob[1] - B.root[1]);
    const rx = B.root[0] - back * 5, ry = B.root[1];
    ctx.strokeStyle = '#141518'; ctx.lineWidth = 1.05; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + Math.cos(an) * l, ry + Math.sin(an) * l); ctx.stroke();
    ctx.fillStyle = '#2b2e33'; ctx.beginPath(); ctx.arc(rx + Math.cos(an) * l, ry + Math.sin(an) * l, B.r, 0, TAU); ctx.fill();
    // the bolt body showing in the open action as it comes back
    if (back > 0) { ctx.fillStyle = 'rgba(190,196,204,0.85)'; ctx.fillRect(rx - 5 * back, ry - 1.1, 5 * back + 1, 2.2); }
  }
  // the empty case: out of the port as the bolt comes back (a self-loader throws its own at once)
  const ct = B ? T - 0.66 : K.action === 'semi' ? T - 0.12 : -1;
  if (ct > 0) {
    const px = B ? B.root[0] + 4 : Rf.type === 'classic' ? 10 : 14, u = ct / 0.5, x = px - u * 5, y = -4 - (13 * u - 7 * u * u) * 1.3;
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.6 - u * 7); ctx.fillStyle = '#c9a24a'; ctx.fillRect(-1.7, -0.5, 3.4, 1); ctx.fillStyle = '#8a6a26'; ctx.fillRect(-1.7, -0.5, 0.5, 1); ctx.fillStyle = 'rgba(255,240,200,0.6)'; ctx.fillRect(-1.2, -0.45, 2.6, 0.25); ctx.restore();
    if (u < 0.4) { ctx.fillStyle = 'rgba(220,215,205,' + (0.25 * (1 - u / 0.4)).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(px, -4.5, 1.5 + 3 * u, 0, TAU); ctx.fill(); } // a wisp of smoke from the open breech
  }
  // where the hand is: on the grip, or travelling to the bolt knob
  const gx = (gp.gt[0] + gp.gb[0]) / 2, gy = (gp.gt[1] + gp.gb[1]) / 2;
  let hx = gx, hy = gy;
  if (B) { const kx = B.root[0] + Math.cos(Math.atan2(B.knob[1] - B.root[1], B.knob[0] - B.root[0]) - lift * 1.25) * 3 - back * 5, ky = B.root[1] + Math.sin(Math.atan2(B.knob[1] - B.root[1], B.knob[0] - B.root[0]) - lift * 1.25) * 3; hx = lerp(gx, kx, reach); hy = lerp(gy, ky + 1.2, reach); }
  // the sleeve, from off the bottom edge to the wrist
  const wx = hx - 5.5, wy = hy + 4.5;
  ctx.fillStyle = sleeve; ctx.beginPath(); ctx.moveTo(wx - 3, wy - 2.6); ctx.lineTo(wx - 40, wy + 34); ctx.lineTo(wx - 25, wy + 44); ctx.lineTo(wx + 3, wy + 3.2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(wx - 1, wy); ctx.lineTo(wx - 30, wy + 37); ctx.stroke();
  ctx.fillStyle = '#23281f'; ctx.beginPath(); ctx.moveTo(wx - 3.4, wy - 2.2); ctx.lineTo(wx + 3.2, wy + 3.4); ctx.lineTo(wx + 1.6, wy + 5.2); ctx.lineTo(wx - 5, wy - 0.4); ctx.closePath(); ctx.fill(); // the cuff
  // the back of the hand
  ctx.fillStyle = glove; ctx.beginPath(); ctx.ellipse(hx - 2.8, hy + 1.4, 4.4, 3.1, -0.7, 0, TAU); ctx.fill();
  // the fingers wrapped round the grip (or the knob), each a rounded roll with a seam between
  ctx.lineCap = 'round';
  const ax = gp.gb[0] - gp.gt[0], ay = gp.gb[1] - gp.gt[1], al = Math.hypot(ax, ay) || 1, ux = reach > 0.5 ? 0.3 : ax / al, uy = reach > 0.5 ? 0.95 : ay / al, nx = uy, ny = -ux;
  for (let i = 0; i < 3; i++) {
    const t = 0.15 + i * 0.27, x0 = hx - 2.5 + ux * (t * al * 0.55 - 1.5), y0 = hy + uy * (t * al * 0.55 - 1.5);
    ctx.strokeStyle = glove; ctx.lineWidth = 2.1; ctx.beginPath(); ctx.moveTo(x0 - nx * 1.5, y0 - ny * 1.5); ctx.lineTo(x0 + nx * 3.6, y0 + ny * 3.6); ctx.stroke();
    ctx.strokeStyle = glove2; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x0 + nx * 0.4 - ux * 0.6, y0 + ny * 0.4 - uy * 0.6); ctx.lineTo(x0 + nx * 3.4 - ux * 0.6, y0 + ny * 3.4 - uy * 0.6); ctx.stroke(); // the light on each knuckle
  }
  // the index finger along to the trigger (while the hand is on the grip)
  if (reach < 0.5) {
    const tx = gp.tr[0], ty = gp.tr[1], fx0 = hx + 0.5, fy0 = hy - 2.2;
    ctx.strokeStyle = glove; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(fx0, fy0); ctx.quadraticCurveTo((fx0 + tx) / 2, fy0 - 0.6, tx, ty); ctx.stroke();
    ctx.strokeStyle = seam; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(fx0 + 1, fy0 + 0.5); ctx.quadraticCurveTo((fx0 + tx) / 2, fy0, tx - 0.4, ty + 0.4); ctx.stroke();
  }
  // the thumb, along the top of the stock
  ctx.strokeStyle = glove; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(hx - 4.5, hy - 1); ctx.lineTo(hx - 1, hy - 3.6 - (reach > 0.5 ? 0.5 : 0)); ctx.stroke();
  ctx.strokeStyle = glove2; ctx.lineWidth = 0.45; ctx.beginPath(); ctx.moveTo(hx - 4.2, hy - 1.6); ctx.lineTo(hx - 1.2, hy - 4.1); ctx.stroke();
  // seams on the back of the glove
  ctx.strokeStyle = seam; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(hx - 5.5, hy + 2.2); ctx.quadraticCurveTo(hx - 3, hy + 0.5, hx - 0.8, hy + 1.6); ctx.stroke();
}
