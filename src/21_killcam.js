// ---------------------------------------------------------------------------
// The kill camera. A short film of the shot that finishes a contract.
//
// Contract with the game loop (src/20_game.js):
//   KillCam.start(o)      begin. o = { sim, view, gunId, cfg, bullet, path, t0, tHit, hit,
//                         actor, kills, gore, step }. Return false to decline.
//   KillCam.advance(dt)   dt = real seconds since last frame. Returns the simulation time
//                         the world should have reached. The game steps the world up to it.
//   KillCam.draw(dt)      paint the whole frame onto the game canvas.
//   KillCam.onEvent(e)    world events, as they happen.
//   KillCam.skip()        the player tapped: finish quickly.
//   KillCam.stop()        tidy up.
//   KillCam.active, KillCam.done, KillCam.rate (how fast time is passing, for the sound)
//
// The film has five stages, each with its own picture:
//   0  THE RIFLE    the player's rifle side on, the flash, the round leaving the muzzle.
//   1  THE FLIGHT   a camera riding just behind the round through the real scene.
//   2  THE SWING    the camera lets go of the round and swings round the target until it
//                   looks across the line of fire, a little from the shooter's side (75
//                   degrees off the line, drifting to 80), so the round is seen going into,
//                   through and out of the body rather than flat across it. The scene fades
//                   into "X-ray space".
//   3  THE X-RAY    the deep slow motion. The round brakes over its last hand spans, all but
//                   stops as it touches the skin, then crawls through the body. Bones and
//                   organs on its line break; it comes out of the far side (or stays in).
//   4  THE HOLD     the world speeds back up toward real time and the body is seen to fall
//                   (the ragdoll, src/13_ragdoll.js); a moment after it lands, a flash back to
//                   the scope, where the same body carries on from where the film left it.
//
// Timeline (real seconds, a 155 m chest shot with a .308): rifle 0.95, flight 1.3 to 2.1 by
// distance, swing 1.3, then the slow motion: approach 1.05, the touch 0.35, through the body
// about 1.6, the exit hanging in the air 0.85; then the hold until the body is down. About
// 10.5 s in all; a tap skips it at any point (KillCam.skip).
//
// Sound: the film tells the sound engine every beat as it happens on screen (kcSay, below) and
// keeps KillCam.rate up to date: how fast time is passing in the picture, 1 = real time. It is
// the speed the world's clock is running at (world seconds per film second), never below
// kcTune.rateMin: in the flight it rises and falls with the round's apparent speed (a short
// shot never gets near real time), at the rifle and from the swing until the hold the picture
// is far slower than the sound engine can follow and it sits at rateMin, and in the hold it
// is exactly the speed the falling body is shown at, rising toward 0.55.
//
// Two kinds of space are used. "World" is the game's own: x across, y up, z down range,
// in metres. "X-ray space" is the same axes but measured from the target's feet, so the
// body always stands at the origin however the target was moving.
// ---------------------------------------------------------------------------
const KillCam = CB.KillCam = { active: false, done: false, rate: 0.05 };

const kcTune = {
  beat: 0.95,        // seconds spent at the rifle
  flightMin: 1.3,    // seconds of flight for a 100 m shot
  flightMax: 2.1,    // seconds of flight for a 900 m shot
  swing: 1.3,        // seconds for the camera to come round
  angle: 75,         // degrees off the line of fire the swing ends at (90 would be square across it)
  angleX: 80,        // and drifts toward during the X-ray
  lensX: 0.62,       // the X-ray's lens, as a share of the flight's (wider, from closer in)
  approach: 1.05,    // seconds from the end of the swing to the round touching the skin
  touchV: 0.09,      // metres per second the round is down to as it touches
  touch: 0.35,       // seconds it all but stops there, the moment of impact
  crawl: 0.36,       // metres per second the round is shown moving through the body
  linger: 0.85,      // seconds the exit hangs in the air before the hold
  rest: 0.5,         // seconds held on a round that stopped (in the body or just past it)
  insideMax: 4.6,    // seconds inside the body at most, whatever happens
  creep: 0.02,       // world seconds per film second while the round is inside the body
  rateMin: 0.05,     // the slowest KillCam.rate ever reported (the sound engine's own floor)
  hold: 0.85,        // seconds holding on the result, at least
  holdMax: 3.0,      // and at most, waiting for the body to come down
  out: 0.34,         // seconds of flash back to the scope
  swingFrom: 2.6,    // metres from the target at which the camera lets go of the round
  standOff: 0.55,    // metres short of the skin at which the swing ends
  bulletScale: 2.1,  // the round is drawn this many times life size so its shape can be read
  maxParts: 1100,    // bits in the air at once, at most
  deg: Math.PI / 180,
};
KillCam.tune = kcTune; // (for tests and tuning; nothing in the game changes it)
// bullet diameters in millimetres, by the rifle's calibre
const kcCalMm = { c22: 5.7, c556: 5.7, c308: 7.8, c762r: 7.9, c8mm: 8.2, c65: 6.7, c300m: 7.8, c338: 8.6, c408: 10.4, c50: 12.9, c300s: 7.8, c9s: 9, crail: 6 };
const kcPalDefault = { skyTop: '#22234f', skyBot: '#ef8a55', ink: '#0e1016', rim: 'rgba(255,225,205,0.45)', dark: 0.35, star: 0 };
// a standing figure, used only if the game cannot give us the target's pose
const kcStand = { hip: [0, 0.86], neck: [0, 1.42], head: [0, 1.62], sh: [0, 1.37], knL: [0.02, 0.42], ftL: [0.03, 0], knR: [-0.02, 0.42], ftR: [-0.03, 0], elL: [0.02, 1.08], haL: [0.05, 0.8], elR: [-0.02, 1.08], haR: [-0.04, 0.8], scale: 1, f: 1 };
// half-widths of the eight pairs of ribs, lowest first (metres on a figure of normal height)
const kcRibW = [0.108, 0.121, 0.13, 0.135, 0.134, 0.127, 0.113, 0.092];
// The organs, in the trunk's own axes: a = toward the person's left, b = up from the hip as a
// share of the hip-to-neck length, c = forward. ra, rb, rc are half-sizes in metres.
const kcOrgans = [
  { id: 'lungR', a: -0.066, b: 0.7, c: 0, ra: 0.046, rb: 0.118, rc: 0.062, col: '#c9727b', hi: '#e7a6aa', label: 'LUNG', pri: 6 },
  { id: 'lungL', a: 0.066, b: 0.7, c: 0, ra: 0.046, rb: 0.118, rc: 0.062, col: '#c9727b', hi: '#e7a6aa', label: 'LUNG', pri: 6 },
  { id: 'liver', a: -0.042, b: 0.415, c: 0.02, ra: 0.08, rb: 0.044, rc: 0.06, col: '#74302a', hi: '#9d4c3f', label: 'LIVER', pri: 7 },
  { id: 'stomach', a: 0.056, b: 0.4, c: 0.03, ra: 0.047, rb: 0.04, rc: 0.04, col: '#bd7d63', hi: '#dfab90', label: 'STOMACH', pri: 5 },
  { id: 'kidR', a: -0.058, b: 0.31, c: -0.045, ra: 0.021, rb: 0.034, rc: 0.02, col: '#7f3032', hi: '#a84a48', label: 'KIDNEY', pri: 5 },
  { id: 'kidL', a: 0.058, b: 0.31, c: -0.045, ra: 0.021, rb: 0.034, rc: 0.02, col: '#7f3032', hi: '#a84a48', label: 'KIDNEY', pri: 5 },
  { id: 'heart', a: 0.03, b: 0.655, c: 0.04, ra: 0.055, rb: 0.062, rc: 0.045, col: '#b01c28', hi: '#ea5257', label: 'HEART', pri: 10 },
];
// the round's outline: pairs of (distance along it, 0 at the base and 1 at the tip; radius, 1 = full calibre)
const kcProf = [0, 0.8, 0.05, 0.93, 0.11, 1, 0.3, 1, 0.335, 0.93, 0.37, 1, 0.52, 0.98, 0.64, 0.87, 0.75, 0.69, 0.85, 0.47, 0.93, 0.25, 1, 0.04];
// scratch space, so the drawing code does not make thousands of little arrays every frame
const kcQ = [0, 0, 0, 0], kcQ2 = [0, 0, 0, 0], kcE = [0, 0, 0], kcV1 = [0, 0, 0], kcV2 = [0, 0, 0], kcV3 = [0, 0, 0], kcL0 = [0, 0, 0], kcL1 = [0, 0, 0];
const kcBx = new Float32Array(16), kcBy = new Float32Array(16), kcBr = new Float32Array(16), kcBs = new Float32Array(16);

// ---- the 3D camera ----------------------------------------------------------------
// A camera is a place (x, y, z), a direction (yaw: turned right from straight down range,
// pitch: tipped down), a lens (f: pixels on screen for one metre seen from one metre away)
// and the spot on screen its centre line lands on (px, py).
function kcCamAim(c) { // work out the camera's own right, up and forward directions
  const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
  c.rx = cy; c.rz = -sy;
  c.fx = sy * cp; c.fy = -sp; c.fz = cy * cp;
  c.ux = sp * sy; c.uy = cp; c.uz = sp * cy;
  return c;
}
function kcLook(c, tx, ty, tz) { // point the camera at a place
  const dx = tx - c.x, dy = ty - c.y, dz = tz - c.z;
  c.yaw = Math.atan2(dx, dz); c.pitch = Math.atan2(-dy, Math.hypot(dx, dz));
  return kcCamAim(c);
}
// A point in space to a point on screen. out = [screen x, screen y, pixels per metre there, distance].
// Things further away are divided by a bigger distance, which is all perspective is.
function kcProj(c, x, y, z, out) {
  const dx = x - c.x, dy = y - c.y, dz = z - c.z;
  const d = dx * c.fx + dy * c.fy + dz * c.fz;
  out[3] = d;
  if (d < 0.03) return false; // behind the lens
  const s = c.f / d;
  out[0] = c.px + (dx * c.rx + dz * c.rz) * s;
  out[1] = c.py - (dx * c.ux + dy * c.uy + dz * c.uz) * s;
  out[2] = s;
  return true;
}
// The game's scenery is a stack of flat layers and can only be drawn by a camera that looks
// straight down range and slides its picture sideways to aim. This builds that kind of camera
// so that one chosen point (ax, ay, az) lands on the same screen spot, at the same size, as it
// does in the 3D camera. With no yaw or pitch the two cameras agree everywhere.
function kcLayerCam(V, c, ax, ay, az) {
  const d = Math.max(0.3, az - c.z), cx = V.W / 2, cy = V.H / 2;
  let ppm = c.f / 1000, sx = c.px + (c.f * (ax - c.x)) / d, sy = c.py - (c.f * (ay - c.y)) / d;
  if ((c.yaw || c.pitch) && kcProj(c, ax, ay, az, kcQ)) { ppm = (kcQ[2] * d) / 1000; sx = kcQ[0]; sy = kcQ[1]; }
  return { cx, cy, hw: V.W / 2, hh: V.H / 2, ex: c.x, ey: c.y, ez: c.z, ax: ((ax - c.x) / d) * 1000 - (sx - cx) / ppm, ay: ((ay - c.y) / d) * 1000 + (sy - cy) / ppm, ppm };
}
// The outline of a tilted disc or of an egg shape is always an ellipse on screen. Given the
// shape's axes as arrows in space (a, b and optionally cc), add up how each arrow looks on
// screen; the long and short directions of that sum are the ellipse. Adds it to the current path.
function kcEll(ctx, c, x, y, z, a, b, cc) {
  if (!kcProj(c, x, y, z, kcQ)) return false;
  const s = kcQ[2];
  const ax = (a[0] * c.rx + a[2] * c.rz) * s, ay = -(a[0] * c.ux + a[1] * c.uy + a[2] * c.uz) * s;
  const bx = (b[0] * c.rx + b[2] * c.rz) * s, by = -(b[0] * c.ux + b[1] * c.uy + b[2] * c.uz) * s;
  let m11 = ax * ax + bx * bx, m12 = ax * ay + bx * by, m22 = ay * ay + by * by;
  if (cc) { const qx = (cc[0] * c.rx + cc[2] * c.rz) * s, qy = -(cc[0] * c.ux + cc[1] * c.uy + cc[2] * c.uz) * s; m11 += qx * qx; m12 += qx * qy; m22 += qy * qy; }
  const h = (m11 + m22) / 2, d = Math.sqrt(Math.max(0, ((m11 - m22) * (m11 - m22)) / 4 + m12 * m12));
  kcE[0] = Math.sqrt(Math.max(0.06, h + d)); kcE[1] = Math.sqrt(Math.max(0.06, h - d)); kcE[2] = 0.5 * Math.atan2(2 * m12, m11 - m22);
  ctx.moveTo(kcQ[0] + Math.cos(kcE[2]) * kcE[0], kcQ[1] + Math.sin(kcE[2]) * kcE[0]);
  ctx.ellipse(kcQ[0], kcQ[1], kcE[0], kcE[1], kcE[2], 0, TAU);
  return true;
}
const kcSet = (o, x, y, z) => { o[0] = x; o[1] = y; o[2] = z; return o; };
const kcMul = (o, v, k) => { o[0] = v[0] * k; o[1] = v[1] * k; o[2] = v[2] * k; return o; };
// A point given in a body part's own axes: a toward the person's left, b up, c forward.
function kcLoc(fr, a, b, c, out) {
  out[0] = fr.o[0] + fr.S[0] * a + fr.U[0] * b + fr.F[0] * c; out[1] = fr.o[1] + fr.S[1] * a + fr.U[1] * b + fr.F[1] * c; out[2] = fr.o[2] + fr.S[2] * a + fr.U[2] * b + fr.F[2] * c;
  return out;
}
// The same, put straight through the camera.
function kcLocP(c, fr, a, b, cc, out) { kcLoc(fr, a, b, cc, kcL1); return kcProj(c, kcL1[0], kcL1[1], kcL1[2], out); }
// Add a run of such points to the current path. pts = [a, b, c, a, b, c, ...] in metres times k.
// Returns the picture scale at the last point (for line widths), or 0 if it cannot be drawn.
function kcRun(ctx, c, fr, pts, k, flipA, close) {
  let s = 0;
  for (let i = 0; i < pts.length; i += 3) {
    kcLoc(fr, pts[i] * k * flipA, pts[i + 1] * k, pts[i + 2] * k, kcL0);
    if (!kcProj(c, kcL0[0], kcL0[1], kcL0[2], kcQ)) return 0;
    if (i === 0) ctx.moveTo(kcQ[0], kcQ[1]); else ctx.lineTo(kcQ[0], kcQ[1]);
    s = kcQ[2];
  }
  if (close) ctx.closePath();
  return s;
}
function kcDistSeg(px, py, a, b) { // how far a point is from a line between two joints
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? clamp(((px - a[0]) * dx + (py - a[1]) * dy) / l2, 0, 1) : 0;
  return Math.hypot(px - (a[0] + dx * t), py - (a[1] + dy * t));
}
const kcHash = (n) => { const x = Math.sin(n * 127.1 + 11.7) * 43758.5453; return x - Math.floor(x); };
// sound: only ever through the game's two building blocks, and never allowed to break the film
// When the sound engine has kill camera sounds of its own (Sfx.kc), the film tells it each beat as
// it happens on screen (kcSay) and makes none itself; until then it uses the two building blocks.
const kcOwnSound = () => { const X = CB.Sfx; return !(X && X.kc); };
function kcNoise(p) { try { const X = CB.Sfx; if (kcOwnSound() && X && X.ok && X.noise) X.noise(p); } catch (e) { /* sound is optional */ } }
function kcTone(p) { try { const X = CB.Sfx; if (kcOwnSound() && X && X.ok && X.tone) X.tone(p); } catch (e) { /* sound is optional */ } }
// One beat, in the order they come:
//   'fly'     the round leaves the muzzle (0.08 s into the film)
//   'cover'   it goes through cover, in the flight or just before the body (mat; behind: the wall
//             behind the body)
//   'slow'    the swing is over and the deep slow motion begins (len: about how many real seconds
//             it lasts, until 'resume'): the round brakes toward the body, touches, goes through
//   'near'    half a second on screen before the round touches the skin
//   'enter'   it touches the skin: the moment of impact (spray: 0 to 1, how much blood is blown
//             back out of the hole, 0 with gore off)
//   'bone'    the tip reaches a bone (bone: skull, rib, spine or limb)
//   'organ'   the tip reaches an organ, only with gore on (organ: heart, lungL, lungR, liver,
//             stomach, kidL, kidR, gut or brain; key: true for the one the film slows down on and names)
//   'exit'    it breaks out of the far side (size: 0 to 1, how big the hole is; spray: 0 to 1, how
//             violent the burst of blood, mist and tissue is, 0 with gore off)
//   'resume'  the slow motion ends: the world speeds back up toward real time over about a second
//   'fall'    the body lands (mat: the ground; speed)
//   'end'     the film is over or was skipped
// Every beat carries the film's speed (rate, see KillCam.rate above), the part hit, the calibre,
// how hard the round hits (power, 0 to 1) and whether gore is on, plus whatever the beat adds.
function kcSay(K, stage, extra) {
  try {
    const X = CB.Sfx; if (!X || !X.kc) return;
    const o = { rate: K.rate, part: K.part, cal: K.cal, power: K.power, gore: K.gore };
    if (extra) for (const k in extra) o[k] = extra[k];
    X.kc(stage, o);
  } catch (e) { /* sound is optional */ }
}
function kcSayEnd(K) { if (K.snd && !K.snd.end) { K.snd.end = 1; kcSay(K, 'end'); } }

// ---- starting, stopping --------------------------------------------------------------
KillCam.start = function (o) {
  const K = KillCam;
  if (!o || !o.sim || !o.view || !o.view.ctx || !o.hit || !isFinite(o.tHit)) return false;
  if (o.actor && o.actor.dead) return false;            // the round has already landed: nothing left to film
  const h = o.hit, step = o.step > 0 ? o.step : 1 / 120, st = o.sim.st || {};
  if (!(o.tHit > o.sim.t - step * 0.2)) return false;
  K.o = o; K.step = step; K.T = 0; K.stage = 0;
  // the round's direction and speed as it arrives
  let v = Math.hypot(h.vx || 0, h.vy || 0, h.vz || 0);
  if (!(v > 20) || !(h.vz > 10)) { K.dir = [0, 0, 1]; v = v > 20 ? v : 600; } else K.dir = [h.vx / v, h.vy / v, h.vz / v];
  K.v = v; K.sonic = v > 343;
  // the flight, trimmed to end exactly at the hit
  const t0 = isFinite(o.t0) ? o.t0 : o.sim.t, path = [];
  (o.path || []).forEach((p) => { if (p && isFinite(p[0]) && isFinite(p[1]) && isFinite(p[2]) && isFinite(p[3]) && p[3] < h.z - 0.01 && (!path.length || p[3] > path[path.length - 1][3] + 1e-4)) path.push(p); });
  if (!path.length) { const back = Math.max(8, v * Math.max(0.02, o.tHit - t0)); path.push([t0, h.x - K.dir[0] * back, h.y - K.dir[1] * back, h.z - K.dir[2] * back]); }
  path.push([o.tHit, h.x, h.y, h.z]);
  K.path = path; K.pi = 1;
  K.dist = Math.max(1, h.z - path[0][3]);
  K.dS = Math.min(kcTune.swingFrom, K.dist * 0.3);       // how far out the camera lets go of the round
  K.zA = path[0][3] + Math.min(1.3, K.dist * 0.08);      // where the chase picks the round up
  K.zS = h.z - K.dS * K.dir[2];
  // the timeline, in real seconds
  const far = clamp((K.dist - 100) / 800, 0, 1);
  K.Tf = lerp(kcTune.flightMin, kcTune.flightMax, far) * clamp(K.dist / 100, 0.45, 1);
  K.Ta = kcTune.beat; K.Tb = K.Ta + K.Tf; K.Tc = K.Tb + kcTune.swing;
  // the round itself
  const mm = kcCalMm[st.cal] || 7.8;
  K.rad = (mm / 2000) * kcTune.bulletScale; K.len = K.rad * 2 * (st.cal === 'crail' ? 5.4 : 4.1);
  K.steel = st.cal === 'crail'; K.quiet = !!st.quiet; K.action = st.action || 'bolt';
  // Does the round come out of the far side? The game decides whether it carries on (and may hit
  // something else). The picture adds an exit wound where the calibre would plausibly make one (the
  // same choice the body's wounds use), but such a round goes no further than just past the body.
  const a0 = o.actor, aid = a0 ? a0.id : 'x', pen = typeof st.pen === 'number' ? st.pen : 0;
  K.part = h.part === 'head' ? 'head' : 'torso'; K.cal = st.cal || 'c308'; K.power = rdPower(rdCal(K.cal).kg, v);
  K.simThrough = typeof st.pen === 'number' ? st.pen >= 1.2 : null;
  K.exit = rdExits(aid, K.part, K.cal, pen) || K.simThrough === true;
  K.exitK = K.exit ? Math.max(0.2, rdExitSize(aid, K.part, K.cal, Math.max(pen, K.simThrough ? 1.2 : 0))) : 0;
  K.through = K.exit; K.spent = K.exit && K.simThrough === false;
  // How violent the wounds are drawn, from how hard the round hits: about 0.16 for a .22, 0.55
  // for a .308 and 0.85 for a .50 (so a .50 throws five times what a .22 does). gx is the same
  // for the way out, which also depends on how big a hole the round makes there.
  K.gk = 0.15 + 0.85 * Math.pow(K.power, 1.6);
  K.gx = K.exit ? clamp(K.exitK * (0.35 + 0.75 * K.power), 0.08, 1.1) : 0;
  // which side the camera swings to: the side the target is facing, so we end up looking at their front
  const a = o.actor;
  K.side = a && (a.face || 1) < 0 ? -1 : 1;
  K.look = Object.assign({}, (a && a.look) || {});       // the game knocks the hat off at the kill; keep our own copy
  K.gore = o.gore !== false;
  // book-keeping
  K.ret = Math.min(o.sim.t, o.tHit - step * 0.25); K.prevRet = K.ret; K.simDt = 0;
  K.bp = [path[0][1], path[0][2], path[0][3], path[0][0]]; K.s = -K.dS; K.spd = 0; K.speedK = 0;
  K.Td = K.Tc + kcTune.approach; // the moment of impact
  K.hitT = null; K.holdT0 = null; K.outT0 = null; K.killSeen = false; K.skipN = 0; K.stopped = false;
  K.plan = null; K.fig = null; K.sw = null; K.dmg = {}; K.parts = []; K.lens = []; K.rip = []; K.cap = null; K.mush = 0; K.spin = 0;
  K.hat = null; K.plate = null; K.chan = null; K.streak = 0; K.gunLay = null; K.snd = {}; K.err = null;
  K.cam = kcCamAim({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, f: 600, px: 0, py: 0 });
  K.rng = makeRng((Math.round(h.x * 977) ^ Math.round(h.y * 7919) ^ Math.round(h.z * 13)) + 4099);
  K.wparts = []; K.landT = undefined; K.spentT = undefined; K.exitT = undefined; K.stopT = undefined; K.follow = null;
  K.covers = kcCoverList(K, o, h, a0); K.wallB = kcWallList(K, o, h, a0);
  K.active = true; K.done = false; K.skipped = false; K.wr = 0; K.rate = kcTune.rateMin;
  return true;
};
KillCam.stop = function () { const K = KillCam; if (K.o) kcSayEnd(K); K.active = false; K.o = null; K.parts = []; K.wparts = []; K.fig = null; K.plan = null; };
KillCam.skip = function () { KillCam.skipped = true; };
KillCam.onEvent = function (e) {
  const K = KillCam, o = K.o;
  if (!o || !e) return;
  if (e.k === 'kill' && o.hit && e.id === o.hit.id) { K.killSeen = true; if (K.simThrough === null) { K.simThrough = !!(o.bullet && o.bullet.alive); K.spent = K.exit && !K.simThrough; } }
};
// where the round is when it has got to distance z down range (the flight is a list of samples)
function kcPathAtZ(K, z, out) {
  const p = K.path; let i = K.pi || 1;
  while (i < p.length - 1 && p[i][3] < z) i++;
  while (i > 1 && p[i - 1][3] > z) i--;
  K.pi = i;
  const a = p[i - 1], b = p[i], u = clamp((z - a[3]) / Math.max(1e-6, b[3] - a[3]), 0, 1);
  out[0] = lerp(a[1], b[1], u); out[1] = lerp(a[2], b[2], u); out[2] = lerp(a[3], b[3], u); out[3] = lerp(a[0], b[0], u);
  return out;
}

// ---- time ---------------------------------------------------------------------------
KillCam.advance = function (dt) {
  const K = KillCam, o = K.o;
  if (!o) { K.done = true; return K.ret || 0; }
  try { return kcAdvance(K, o, clamp(+dt || 0, 0, 0.05)); } catch (e) { K.err = e; K.skipped = true; return kcEnd(K, o); }
};
// Finish now. The game can only move the world on by half a second each frame, so after a very
// early skip of a long shot we keep asking for a few frames until the round has really landed.
function kcEnd(K, o) {
  K.ret = Math.max(K.ret, o.tHit + K.step * 2.5); K.skipN++; K.rate = 0.25;
  if (o.sim.t >= o.tHit + K.step * 0.5 || o.sim.state !== 'play' || K.skipN > 12 || K.hitT !== null) { K.done = true; kcSayEnd(K); }
  return K.ret;
}
function kcAdvance(K, o, dt) {
  if (K.skipped) return kcEnd(K, o);
  K.T += dt; K.spin += dt * 9;
  const T = K.T, cap = o.tHit - K.step * 0.25; // before the hit is shown the world may not pass this
  K.prevRet = K.ret;
  let wr = 0; // how fast the world's clock runs this frame (world seconds per film second), for KillCam.rate
  if (!K.snd.fly && T >= 0.08) { K.snd.fly = 1; kcSay(K, 'fly'); } // the tip clears the muzzle
  if (T < K.Ta) {
    // ---- 0: at the rifle. Time is all but stopped.
    K.stage = 0; K.speedK = 0;
  } else if (T < K.Tb) {
    // ---- 1: the flight. Distance covered follows a curve that starts slowly, runs fast in the
    // middle and arrives slowly: a cubic that leaves with slope k0 and lands with slope k1.
    if (K.stage < 1) { K.stage = 1; kcNoise({ type: 'bandpass', f: 150, f1: 640, sweep: K.Tf * 0.6, q: 0.9, dur: K.Tf * 0.9, att: K.Tf * 0.5, gain: 0.06, brown: true }); }
    const u = (T - K.Ta) / K.Tf, D = Math.max(0.5, K.zS - K.zA), t0 = K.bp[3];
    const k0 = clamp((7 * K.Tf) / D, 0, 0.8), k1 = clamp((kcSwingV0(K) * K.Tf) / D, 0, 0.8);
    const g = (u * u * u - 2 * u * u + u) * k0 + (-2 * u * u * u + 3 * u * u) + (u * u * u - u * u) * k1;
    const gv = (3 * u * u - 4 * u + 1) * k0 + (-6 * u * u + 6 * u) + (3 * u * u - 2 * u) * k1;
    kcPathAtZ(K, lerp(K.zA, K.zS, clamp(g, 0, 1)), K.bp);
    K.speedK = clamp(gv / 1.5, 0, 1); K.fu = u;
    if (dt > 0) wr = Math.max(0, K.bp[3] - t0) / dt; // the round's own flight time covered this frame
    K.ret = Math.max(K.ret, Math.min(K.bp[3], cap));
    // (the bits thrown off cover out there fly at the pace the round seems to rush along)
    kcFlightCovers(K); kcStepParts(K, dt * clamp(0.2 + 0.85 * K.speedK, 0.2, 1), K.wparts, true);
  } else {
    // ---- 2 to 4: the round is on its last straight few metres. s is how far its tip is past
    // the middle of the body, in metres (negative while it is still on its way).
    if (K.stage < 2) kcBeginSwing(K, o);
    const pl = K.plan;
    if (K.hitT === null) {
      if (T < K.Tc) {
        // the swing: the round eases down from the flight's last speed
        const u = (T - K.Tb) / kcTune.swing, D = Math.max(0.05, K.dS - pl.sFrom);
        K.s = -K.dS + D * (1.28 * u - 0.28 * u * u); K.spd = (D * (1.28 - 0.56 * u)) / kcTune.swing;
        if (!K.snd.h1 && u > 0.12) { K.snd.h1 = 1; kcBeat(0.1); }
        if (!K.snd.h2 && u > 0.7) { K.snd.h2 = 1; kcBeat(0.12); }
      } else {
        // The approach: the round brakes over its last hand spans and is all but stopped when it
        // touches the skin, exactly approach seconds after the swing (a cubic in time that starts
        // at the swing's last speed and ends at touchV).
        K.stage = 3;
        if (!K.snd.slow) { K.snd.slow = 1; kcSay(K, 'slow', { len: +kcSlowLen(K).toFixed(2) }); }
        const Ta = kcTune.approach, u = clamp((T - K.Tc) / Ta, 0, 1), D = Math.max(0.01, pl.sIn - pl.sA);
        const m0 = clamp((pl.vA * Ta) / D, 0, 2.9), m1 = clamp((kcTune.touchV * Ta) / D, 0, 1);
        const h = (u * u * u - 2 * u * u + u) * m0 + (-2 * u * u * u + 3 * u * u) + (u * u * u - u * u) * m1;
        const hv = (3 * u * u - 4 * u + 1) * m0 + (-6 * u * u + 6 * u) + (3 * u * u - 2 * u) * m1;
        K.s = pl.sA + D * h; K.spd = (D * hv) / Ta;
      }
      wr = K.spd / K.v;
      K.ret = Math.max(K.ret, Math.min(o.tHit + K.s / K.v, cap));
      // half a second (on screen) before the round reaches the body
      if (!K.snd.near && T >= K.Td - 0.5) { K.snd.near = 1; kcSay(K, 'near'); }
      if (T >= K.Td) {
        // the tip touches the skin: this is the frame the world is allowed to make the kill
        K.hitT = T; K.stage = 3; K.s = pl.sIn;
        K.ret = Math.max(K.ret, o.tHit + K.step * 1.002);
      }
    } else {
      // Inside the body. For a moment after it touches, the round hardly moves (the hit lands);
      // then a slow crawl that all but stops again as it reaches the main thing it hits.
      const since = T - K.hitT, a = o.actor, tch = kcTune.touch;
      const wake = since < tch ? lerp(kcTune.touchV / kcTune.crawl, 0.12, smooth(since / (tch * 0.4))) : lerp(0.12, 1, smooth((since - tch) / 0.45));
      let sp = kcTune.crawl * (since < tch ? wake : wake * (1 - 0.8 * Math.exp(-Math.pow((K.s - pl.sKey) / 0.04, 2))));
      if (K.exit && !K.spent) { if (K.s > pl.sOut) { if (K.exitT === undefined) K.exitT = T; sp = Math.min(7, kcTune.crawl + (K.s - pl.sOut) * 5); } }
      else if (K.spent) {
        // out of the far side with nothing left: it tumbles a hand's width further and drops
        if (K.s > pl.sOut) { if (K.spentT === undefined) K.spentT = T; sp = kcTune.crawl * 1.6 * clamp((pl.sSpent - K.s) / 0.12, 0, 1); }
        if (pl.sSpent - K.s < 0.004) K.stopped = true;
      } else { sp *= clamp((pl.sStop - K.s) / 0.06, 0, 1); if (pl.sStop - K.s < 0.004) K.stopped = true; }
      if (K.stopped && K.stopT === undefined) K.stopT = T;
      K.spd = sp; K.s += sp * dt;
      // the exit hangs in the air a moment; a round that stayed in is held on a moment
      if (K.holdT0 === null && ((K.exitT !== undefined && T - K.exitT > kcTune.linger) || (K.stopT !== undefined && T - K.stopT > kcTune.rest) || since > kcTune.insideMax)) {
        K.holdT0 = T; K.stage = 4; kcSay(K, 'resume');
        kcTone({ at: 0.18, f: 55, dur: 1.3, att: 0.05, gain: 0.07, verb: 0.4 }); kcTone({ at: 0.18, f: 110, dur: 0.9, att: 0.05, gain: 0.018, verb: 0.4 });
      }
      // the body hitting the ground, as the film shows it
      if (K.hitT !== null && !K.snd.fall && a && a.dead && isFinite(a.deathAtT)) { const L = rdLanded(a, K.ret - a.deathAtT); if (L) { K.snd.fall = 1; K.landT = T; kcSay(K, 'fall', { mat: L.mat, speed: L.v }); } }
      // The hold: the world speeds up toward real time so the fall is seen, and the film ends a
      // moment after the body is down (or after a few seconds at most).
      if (K.holdT0 !== null && K.outT0 === null) { const ht = T - K.holdT0; if ((K.landT !== undefined && T - K.landT > 0.5 && ht > kcTune.hold) || ht > kcTune.holdMax) K.outT0 = T; }
      if (K.outT0 !== null && T - K.outT0 > kcTune.out) { K.done = true; kcSayEnd(K); try { o.view.flash = Math.max(o.view.flash || 0, 1); } catch (e) { /* the scope picture is not ours to break */ } }
      wr = K.holdT0 === null ? kcTune.creep : lerp(0.06, 0.55, smooth((T - K.holdT0 - 0.1) / 0.9));
      if (K.outT0 !== null) wr = Math.max(0.3, wr);
      K.ret += dt * wr;
    }
    // things on the round's line break as its tip reaches them (cover before it reaches the body)
    for (let i = 0; i < pl.evs.length; i++) { const ev = pl.evs[i]; if (!ev.done && K.s >= ev.s && (ev.kind === 'skin0' || ev.kind === 'cover' || K.hitT !== null)) { ev.done = true; kcFire(K, ev); } }
    kcStepParts(K, dt * (K.holdT0 !== null ? Math.max(0.3, wr) : 0.15));
  }
  // what the sound is told: the world's clock, a little smoothed, never below the floor
  K.wr = K.T <= dt + 1e-9 ? wr : K.wr + (wr - K.wr) * Math.min(1, dt * 18);
  K.rate = clamp(K.wr, kcTune.rateMin, 1);
  K.simDt = Math.max(0, K.ret - K.prevRet);
  return K.ret;
}
// the speed the round is shown at as the swing begins (metres per second), so the flight can land on it
function kcSwingV0(K) { return (1.28 * Math.max(0.2, K.dS - kcTune.standOff - 0.2)) / kcTune.swing; }
// About how long the deep slow motion lasts, from the end of the swing to the hold (for the sound).
function kcSlowLen(K) {
  const pl = K.plan; if (!pl) return 3;
  const inside = ((K.exit ? pl.sOut : pl.sStop) - pl.sIn) / kcTune.crawl;
  return kcTune.approach + kcTune.touch + 0.3 + inside * 1.25 + (K.exit && !K.spent ? kcTune.linger + 0.1 : kcTune.rest + 0.2);
}
function kcBeat(g) { kcTone({ f: 62, f1: 40, dur: 0.09, gain: g }); kcTone({ at: 0.16, f: 54, f1: 36, dur: 0.11, gain: g * 0.7 }); }

// ---- the plan: what the round will meet, worked out from where it goes in ----------------
// Called as the swing begins, when the target is within a few thousandths of a second of the
// pose it will be hit in.
function kcBeginSwing(K, o) {
  K.stage = 2;
  kcPathAtZ(K, K.zS, K.bp); // the round, exactly where the flight was to end
  const fig = kcBuildFig(K), h = o.hit, sc = fig.sc, fs = fig.fs, bw = fig.bw, J = fig.J;
  const lx = h.x - (isFinite(h.ax) ? h.ax : h.x), ly = h.y - (isFinite(h.ay) ? h.ay : h.y - 1); // the hit, measured from the target's feet
  const evs = [], pl = K.plan = { part: h.part === 'head' ? 'head' : 'torso', evs, fs };
  const add = (s, kind, ref, label, pri) => evs.push({ s, kind, ref: ref || kind, label: label || '', pri: pri || 0, done: false });
  if (pl.part === 'head') {
    // u0 = how far up the head from its middle, c0 = how far toward the face
    const hd = fig.hd, hr = fig.hr, rx = lx - hd.o[0], ry = ly - hd.o[1];
    let u0 = rx * hd.U[0] + ry * hd.U[1], c0 = rx * hd.F[0] + ry * hd.F[1];
    const rr = Math.hypot(u0, c0), mx = hr * 0.8; if (rr > mx) { u0 *= mx / rr; c0 *= mx / rr; }
    pl.u0 = u0; pl.c0 = c0; pl.H = [hd.o[0] + hd.U[0] * u0 + hd.F[0] * c0, hd.o[1] + hd.U[1] * u0 + hd.F[1] * c0, 0];
    // the round crosses a ball from side to side: how much ball is on its line is a chord, sqrt(r*r - d*d)
    const rs = 0.142 * sc, uc = u0 - 0.018 * sc, skin = Math.sqrt(Math.max(0.0036 * sc * sc, hr * hr - u0 * u0 - c0 * c0));
    add(-skin, 'skin0'); add(skin, 'skin1');
    if (uc * uc + c0 * c0 < rs * rs * 0.9 && u0 > -0.075 * sc) {
      const ch = Math.sqrt(Math.max(0.0009 * sc * sc, rs * rs - uc * uc - c0 * c0)), ub = (u0 - 0.02 * sc) / (0.085 * sc), cb = c0 / (0.115 * sc);
      add(-ch, 'bone', 'skullIn', 'SKULL', 4); add(ch, 'bone', 'skullOut');
      if (K.gore && ub * ub + cb * cb < 1) add(-0.105 * sc * Math.sqrt(1 - ub * ub - cb * cb) * 0.45, 'organ', 'brain', 'BRAIN', 9);
      pl.chord = ch;
    } else {
      add(-0.095 * sc, 'bone', 'jawIn', 'JAW', 4); add(0.095 * sc, 'bone', 'jawOut');
      if (c0 < 0.012 * sc) add(-0.01 * sc, 'spine', 'spineC', 'SPINE', 9);
    }
  } else {
    // b0 = how far up the trunk from the hip, c0 = how far in front of the spine line
    const t = fig.tor, rx = lx - t.o[0], ry = ly - t.o[1];
    const b0 = clamp(rx * t.U[0] + ry * t.U[1], -0.05 * sc, t.L * 1.03), c0 = clamp(rx * t.F[0] + ry * t.F[1], -0.085 * sc, 0.085 * sc);
    pl.b0 = b0; pl.c0 = c0; pl.H = [t.o[0] + t.U[0] * b0 + t.F[0] * c0, t.o[1] + t.U[1] * b0 + t.F[1] * c0, 0];
    const tt = b0 / t.L, hw = lerp(fig.wh, fig.wt, clamp(tt, 0, 1)) + (K.look.coat ? 0.09 : 0.07) * sc;
    let sIn = -hw, sOut = hw;
    // an arm hanging across the line is gone through first (near side) or last (far side)
    const arm = (sh, el, ha) => (kcDistSeg(lx, ly, sh, el) < 0.05 * sc ? 'U' : kcDistSeg(lx, ly, el, ha) < 0.05 * sc ? 'F' : '');
    const near = fs > 0 ? 'R' : 'L', farS = fs > 0 ? 'L' : 'R';
    const aIn = arm(J.sh, J['el' + near], J['ha' + near]), aOut = arm(J.sh, J['el' + farS], J['ha' + farS]);
    if (aIn) { add(-fig.za, 'bone', 'arm' + near + aIn, 'ARM', 1); sIn = Math.min(sIn, -fig.za - 0.055 * sc); }
    if (aOut) { add(fig.za, 'bone', 'arm' + farS + aOut); sOut = Math.max(sOut, fig.za + 0.055 * sc); }
    add(sIn, 'skin0'); add(sOut, 'skin1');
    if (tt > 0.44 && tt < 0.9) {
      // the rib cage: its wall is met going in and coming out
      const ri = clamp((tt - 0.47) / 0.058, 0, 7), i0 = Math.floor(ri), rw = lerp(kcRibW[i0], kcRibW[Math.min(7, i0 + 1)], ri - i0) * sc * bw;
      add(-rw, 'bone', 'ribIn', 'RIBS', 2); add(rw, 'bone', 'ribOut');
      pl.ribAl = Math.acos(clamp(-(c0 + 0.012 * sc) / (0.085 * sc), -0.95, 0.95)); // where round the rib the line crosses
    } else if (tt >= 0.9) { add(-fig.ws * 0.9, 'bone', 'shIn', 'SHOULDER', 3); add(fig.ws * 0.9, 'bone', 'shOut'); }
    else if (tt < 0.2) { add(-0.105 * sc * bw, 'bone', 'pelvIn', 'PELVIS', 3); add(0.105 * sc * bw, 'bone', 'pelvOut'); }
    // the spine runs just behind the middle line
    if (Math.abs(c0 + 0.032 * sc) < 0.03 * sc && tt > 0.02) add(-0.012 * sc, 'spine', 'spine', 'SPINE', 9);
    if (K.gore) {
      for (let i = 0; i < kcOrgans.length; i++) {
        // (the test is generous front to back: from side on nobody can see how far forward the round is,
        // and a round that looks as if it went through the heart must be seen to go through the heart)
        const g = kcOrgans[i], eb = (b0 - g.b * t.L) / (g.rb * sc), ec = (c0 - g.c * sc) / (g.rc * sc * 1.6), e2 = eb * eb + ec * ec;
        if (e2 < 1) add(g.a * sc * bw * fs - g.ra * sc * bw * Math.sqrt(1 - e2) * 0.45, 'organ', g.id, g.label, g.pri);
      }
      if (tt > 0.05 && tt < 0.3 && c0 > -0.05 * sc) add(-0.05 * sc, 'organ', 'gut', 'GUT', 3);
    }
  }
  evs.sort((p, q) => p.s - q.s);
  pl.sIn = evs[0].s; pl.sOut = evs[evs.length - 1].s;
  pl.sFrom = -pl.sIn + kcTune.standOff;                  // where the round has got to when the swing ends (metres short of the middle)
  { const D = Math.max(0.05, K.dS - pl.sFrom); pl.sA = -K.dS + D; pl.vA = (D * 0.72) / kcTune.swing; } // exactly where, and how fast it is going
  pl.sStop = Math.min(0.07 * sc, pl.sOut - 0.06);        // a light round comes to rest just past the middle
  pl.sSpent = pl.sOut + 0.1 + 0.2 * K.exitK;             // one with nothing left after the far side stops here
  // the caption goes to the most important thing the round actually reaches
  let key = null;
  for (let i = 0; i < evs.length; i++) { const e = evs[i]; if (e.pri > 0 && (K.through !== false || e.s <= pl.sStop) && (!key || e.pri > key.pri)) key = e; }
  pl.key = key; pl.sKey = key ? key.s + 0.012 : 0;
  pl.samples = []; for (let s = pl.sIn; s <= pl.sOut + 1e-6; s += 0.024) pl.samples.push(s, -1); // the wound track: (place, when the tip passed)
  // cover on the round's last few metres (anything further was passed in the flight), and the
  // wall behind if the round really goes on into it
  (K.covers || []).forEach((cv) => { if (cv.done) return; cv.flight = false; cv.s = cv.dz / Math.max(0.3, K.dir[2]); evs.push({ s: Math.max(cv.s, -K.dS + 0.01), kind: 'cover', ref: 'cover', label: '', pri: 0, done: false, cv }); });
  if (K.wallB && K.wallB.hole && K.simThrough) evs.push({ s: K.wallB.dz / Math.max(0.3, K.dir[2]), kind: 'wall', ref: 'wall', label: '', pri: 0, done: false });
  // ---- the camera's path for the swing, in X-ray space, starting from where the chase camera ended
  const V = o.view, W = V.W, H = V.H, vis = H * 0.85, Hx = pl.H, g = kcRig(K, W, H, 1), f = g.f;
  const bz = K.dS + K.len; // the round's base is this far short of the hit
  const cx = Hx[0] - K.dir[0] * bz + g.lat, cy = Hx[1] - K.dir[1] * bz + g.up, cz = Hx[2] - K.dir[2] * bz - g.back;
  const vx = cx - Hx[0], vy = cy - Hx[1], vz = cz - Hx[2], R0 = Math.hypot(vx, vy, vz);
  const top = K.look.bag === 'umbrella' ? Math.max(J.head[1] + fig.hr, 2.55 * sc) : J.head[1] + fig.hr + (K.look.hat ? 0.24 : 0.04) * sc, low = Math.min(J.ftL[1], J.ftR[1], J.hip[1]);
  const mid = [J.hip[0] * 0.5, Math.max(top - 0.78 * sc, (top + low) / 2), 0];
  // The swing is measured from the round's own line, so that "75 degrees off the line of fire"
  // means just that however the round came in (across from a long way to one side, or down from
  // a roof): b points back along the line toward the shooter, n level and square to it, u = n x b.
  const d = K.dir, nl = Math.hypot(d[0], d[2]) || 1, B = [-d[0], -d[1], -d[2]], Nn = [d[2] / nl, 0, -d[0] / nl];
  const U = [Nn[1] * B[2] - Nn[2] * B[1], Nn[2] * B[0] - Nn[0] * B[2], Nn[0] * B[1] - Nn[1] * B[0]];
  const vb = vx * B[0] + vy * B[1] + vz * B[2], vn = vx * Nn[0] + vz * Nn[2], vu = vx * U[0] + vy * U[1] + vz * U[2];
  K.sw = { f, R0, B, N: Nn, U, phi0: Math.atan2(K.side * vn, vb), el0: Math.asin(clamp(vu / R0, -0.9, 0.9)), H: Hx.slice(), mid, focus: [Hx[0], Hx[1] + 0.02, 0],
    sW: W, sH: H, R1: f / Math.min(W / 1.5, vis / 1.62), R2: f / Math.min(W / 0.86, vis / 0.6), phx: g.sx, phy: g.sy,
    px0: g.sx - (f * (Hx[0] - cx)) / (Hx[2] - cz), py0: g.sy + (f * (Hx[1] - cy)) / (Hx[2] - cz), // where the chase camera's centre line was on screen
    // where the X-ray origin sits in the world: first as the flight has it, then pinned to the live target
    ox: K.bp[0] - (Hx[0] - K.dir[0] * K.dS), oy: K.bp[1] - (Hx[1] - K.dir[1] * K.dS), oz: h.z };
  kcTone({ f: 70, f1: 230, dur: kcTune.swing + 0.4, att: kcTune.swing, gain: 0.03, lp: 900 });
}

// One thing on the round's line gives way.
function kcFire(K, ev) {
  const pl = K.plan, R = K.rng, d = K.dir, H = pl.H;
  const at = [H[0] + d[0] * ev.s, H[1] + d[1] * ev.s, H[2] + d[2] * ev.s];
  if (ev.kind === 'cover') { kcCoverBurst(K, ev.cv, at, false); return; }
  if (ev.kind === 'wall') { kcWallHit(K, at); return; }
  K.dmg[ev.ref] = K.T;
  if (pl.key === ev) K.cap = { text: ev.label, t0: K.T, s: ev.s };
  // (lifetimes are in the spray's own slowed time: 0.15 of a second of it is a second on screen)
  // Everything with blood in it is scaled by how hard the round hits (K.gk, K.gx: see KillCam.start),
  // so a .22 leaves a small neat hole and a puff, and a .50 tears the body open.
  const G = K.gk, N = (x) => Math.max(0, Math.round(x));
  if (ev.kind === 'skin0') {
    kcSay(K, 'enter', { spray: K.gore ? +clamp(G, 0, 1).toFixed(2) : 0 });
    K.rip.push({ t0: K.T, s: ev.s, k: G, way: -1 }); // the shock of it running out over the skin
    if (K.gore) {
      // blown back out of the hole toward the shooter: a puff of mist, drops, flecks of skin and cloth
      kcSpray(K, 0, N(10 + 40 * G), at, -1, 0.8, 0.3, 1.2 + 2.6 * G, 0.003, 0.005 + 0.005 * G, 0.4 + 0.3 * G);
      kcSpray(K, 1, N((K.through === false ? 8 : 4) + 26 * G), at, -1, 0.5, 0.6, 2 + 4 * G, 0.0025, 0.006 + 0.005 * G, 2.5);
      if (G > 0.3) kcSpray(K, 10, N(12 * (G - 0.25)), at, -1, 0.6, 0.5, 1.4 + 2.4 * G, 0.004, 0.008 + 0.006 * G, 2.5);
      kcSpray(K, 9, N(0.6 + 2.6 * G), at, -1, 0.4, 0.12, 0.3 + 0.5 * G, 0.03 + 0.02 * G, 0.045 + 0.05 * G, 1.4);
      kcNoise({ type: 'lowpass', f: 480, f1: 180, dur: 0.16, gain: 0.14 }); kcTone({ f: 95, f1: 48, dur: 0.14, gain: 0.11 });
    } else { kcSpray(K, 4, 8, at, -1, 0.9, 0.2, 1.1, 0.004, 0.008, 0.4); kcTone({ f: 110, f1: 60, dur: 0.08, gain: 0.08 }); }
  } else if (ev.kind === 'bone' || ev.kind === 'spine') {
    K.mush = Math.min(1, K.mush + (ev.kind === 'spine' ? 0.3 : 0.22));
    const rf = ev.ref; kcSay(K, 'bone', { bone: ev.kind === 'spine' ? 'spine' : /^(skull|jaw)/.test(rf) ? 'skull' : /^rib/.test(rf) ? 'rib' : 'limb' });
    kcSpray(K, 2, N((ev.kind === 'spine' ? 1.5 : 1) * (4 + 14 * G)), at, 1, 0.75, 0.4, 2 + 4 * G, 0.008, 0.02 + 0.012 * G, K.through === false ? 0.22 : 2);
    if (K.gore) { kcSpray(K, 1, N(3 + 10 * G), at, 1, 0.7, 0.2, 1.1 + 1.4 * G, 0.003, 0.006 + 0.004 * G, 0.15); if (G > 0.4) kcSpray(K, 10, N(8 * (G - 0.3)), at, 1, 0.7, 0.3, 1 + 2 * G, 0.004, 0.009, 0.2); }
    kcNoise({ type: 'bandpass', f: 1500, q: 1.6, dur: 0.03, gain: 0.11 }); kcTone({ type: 'square', f: 520, f1: 180, dur: 0.035, gain: 0.03, lp: 2000 });
    if (ev.ref === 'skullOut' && K.through !== false) K.plate = { t0: K.T, x: 0, y: 0, z: 0, vx: d[0] * (1.2 + 1.2 * K.gx) + K.side * 0.5, vy: 0.9, vz: d[2] * (1.4 + 1.4 * K.gx), rot: 0, vr: 5 + 4 * K.gx };
  } else if (ev.kind === 'organ') {
    K.mush = Math.min(1, K.mush + 0.12);
    kcSay(K, 'organ', { organ: ev.ref, key: pl.key === ev });
    // (organs are only on the round's line with gore on, so all of this is gore)
    kcSpray(K, 1, N((ev.ref === 'heart' ? 1.6 : 1) * (8 + 20 * G)), at, 1, 0.9, 0.2, 1.2 + 1.6 * G, 0.003, 0.007 + 0.005 * G, 0.15);
    kcSpray(K, 0, N(3 + 10 * G), at, 1, 0.9, 0.1, 0.6 + 0.8 * G, 0.003, 0.007, 0.12);
    if (ev.ref === 'brain') kcSpray(K, 3, N(5 + 14 * G), at, 1, 0.8, 0.3, 1.5 + 1.5 * G, 0.005, 0.011, 0.16);
    kcNoise({ type: 'bandpass', f: 520, f1: 220, q: 1.2, dur: 0.12, att: 0.01, gain: 0.07 });
  } else if (ev.kind === 'skin1') {
    // Out of the far side: how much comes with it depends on the round. A .308 makes a ragged hole
    // and a cone of blood; a magnum or a .50 bursts the far side open, a jet of blood and mist, torn
    // tissue and bone, and a red cloud that hangs in the air. A round with nothing left, much less.
    const ek = K.exitK * (K.spent ? 0.65 : 1), X = K.gx * (K.spent ? 0.55 : 1);
    kcSay(K, 'exit', { size: +ek.toFixed(2), spray: K.gore ? +clamp(X, 0, 1).toFixed(2) : 0 });
    K.rip.push({ t0: K.T, s: ev.s, k: Math.max(G * 0.6, X), way: 1 });
    if (K.gore) {
      kcSpray(K, 0, N(16 + 50 * X), at, 1, 0.2, 2, 6 + 10 * X, 0.003, 0.007 + 0.008 * X, 0.45);                    // the jet, straight on along the line
      kcSpray(K, 1, N(30 + 140 * X), at, 1, 0.3 + 0.22 * X, 1, 5 + 8 * X, 0.0025, 0.011 + 0.01 * X, 3);          // drops, a widening cone
      kcSpray(K, 0, N(14 + 50 * X), at, 1, 0.6, 0.4, 2 + 3 * X, 0.003, 0.008 + 0.008 * X, 0.7);                  // mist
      kcSpray(K, 9, N(1 + 9 * X), at, 1, 0.45, 0.25, 1.1 + 2.4 * X, 0.025 + 0.03 * X, 0.05 + 0.09 * X, 2.2);     // the cloud that hangs
      kcSpray(K, 10, N(2 + 20 * X), at, 1, 0.45, 1, 3.5 + 5 * X, 0.005, 0.011 + 0.017 * X, 3);                   // torn tissue
      if (pl.part === 'head') kcSpray(K, 3, N(6 + 26 * X), at, 1, 0.4, 1, 3 + 5 * X, 0.005, 0.012 + 0.008 * X, 3);
      if (pl.part === 'head' || K.dmg.spine !== undefined || K.dmg.ribOut !== undefined) kcSpray(K, 2, N(2 + 18 * X), at, 1, 0.45, 1.2, 3 + 5 * X, 0.008, 0.02 + 0.01 * X, 2.5); // bone carried out with it
      // a few strings of drops that stretch out as they fly
      for (let j = 0, nj = 2 + N(7 * X); j < nj; j++) { const ax = (R.f() - 0.5) * 0.5, ay = (R.f() - 0.2) * 0.5; for (let i = 0; i < 6; i++) { const sp = 2.2 + i * 1.05 + j * 0.3; K.parts.push({ k: 1, x: at[0], y: at[1], z: at[2], vx: (d[0] + K.side * 0.25 + ax) * sp, vy: (d[1] + ay) * sp, vz: d[2] * sp, r: 0.008 - i * 0.0009, age: 0, life: 3, rot: 0, vr: 0, stuck: false }); } }
      if (kcHash(H[0] * 31 + H[1] * 17) < 0.4 + X) for (let i = 0, nl = 3 + N(3 * X); i < nl; i++) K.lens.push({ t0: K.T + 0.22 + i * 0.13, x: 0.5 + (K.side > 0 ? 1 : -1) * (0.16 + R.f() * 0.26), y: 0.25 + R.f() * 0.45, r: 5 + R.f() * (9 + 6 * X), sd: R.f() * 9 });
      kcNoise({ type: 'bandpass', f: 900, f1: 400, q: 0.8, dur: 0.2, att: 0.01, gain: 0.04 });
    } else kcSpray(K, 4, 10, at, 1, 0.7, 0.3, 1.6, 0.004, 0.008, 0.4);
    if (K.hat && !K.hat.fly) K.hat.fly = K.T;
  }
}
// Throw n bits from a point. kind: 0 fine mist, 1 blood drops, 2 bone splinters, 3 brain matter, 4 pale dust,
// 9 a cloud of blood mist that hangs, 10 torn tissue (5 to 8 are cover: see kcCoverBurst).
// way: +1 along the round's travel, -1 back toward the shooter. spread: 0 a jet, 1 nearly a ball.
// sp0..sp1 speeds in metres per second, r0..r1 sizes in metres, life in seconds of the spray's own time.
function kcSpray(K, kind, n, at, way, spread, sp0, sp1, r0, r1, life, list) {
  const L = list || K.parts;
  if (L.length > kcTune.maxParts) return;
  n = Math.min(n, kcTune.maxParts + 40 - L.length);
  const R = K.rng, d = K.dir;
  for (let i = 0; i < n; i++) {
    let rx = R.f() * 2 - 1, ry = R.f() * 2 - 1, rz = R.f() * 2 - 1; const rl = Math.hypot(rx, ry, rz) || 1;
    rx = d[0] * way + (rx / rl) * spread + K.side * 0.12; ry = d[1] * way + (ry / rl) * spread + 0.12; rz = d[2] * way + (rz / rl) * spread;
    const l = Math.hypot(rx, ry, rz) || 1, u = R.f(), v = R.f(), sp = lerp(sp0, sp1, u * u);
    L.push({ k: kind, x: at[0], y: at[1], z: at[2], vx: (rx / l) * sp, vy: (ry / l) * sp, vz: (rz / l) * sp, r: lerp(r0, r1, v * v), age: 0, life: life * (0.7 + 0.6 * R.f()), rot: R.f() * 6, vr: (R.f() - 0.5) * 30, stuck: false });
  }
}
// how the bits in the air slow down (drag) and fall (gravity), by kind: 0 mist, 1 drops, 2 bone,
// 3 brain, 4 dust, 5 glass, 6 splinters of wood, 7 sparks, 8 chips of brick or plaster, 9 a hanging
// cloud of mist, 10 tissue
const kcDrag = [3.2, 0.5, 0.5, 0.5, 3.2, 0.8, 0.6, 1.6, 0.5, 4.5, 0.6], kcFall = [1.2, 9.8, 9.8, 9.8, 1.2, 9.8, 9.8, 3.5, 9.8, 0.35, 9.8];
function kcStepParts(K, dt, list, world) { // dt here is already slowed: the spray flies in slow motion
  const ps = list || K.parts, wz = !world && K.wallB ? K.wallB.dz : 1e9;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i]; p.age += dt;
    if (p.age > p.life) { ps.splice(i, 1); continue; }
    if (p.stuck) continue;
    const drag = kcDrag[p.k] || 0.5, g = kcFall[p.k] || 9.8;
    p.vx -= p.vx * drag * dt; p.vy -= (p.vy * drag + g) * dt; p.vz -= p.vz * drag * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.vr * dt;
    if (p.k === 9) { if (p.y < p.r) { p.y = p.r; p.vy = Math.max(0, p.vy); } if (p.z > wz - p.r) { p.z = wz - p.r; p.vz = Math.min(0, p.vz); } continue; } // a cloud only drifts
    if (!world && p.y < 0.004) { p.y = 0.004; p.stuck = true; p.life = p.age + 3; } // landed: a mark on the floor
    else if (p.z >= wz && p.k !== 7) { p.z = wz; p.stuck = true; p.wall = true; p.life = p.age + (p.k === 1 || p.k === 0 || p.k === 10 ? 9 : 2); } // the wall behind: blood stays on it
  }
  if (!list && K.plate) { const q = K.plate; q.vy -= 9.8 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.rot += q.vr * dt; }
}

// ---- cover, and the wall behind ------------------------------------------------------------
// The things the round really went through on its way (the oracle saw them: see src/22_oracle.js),
// as { dz: metres before the target along the line (negative), x, y: where (world), mat: 'glass',
// 'wood', 'metal' or 'wall', flight: true when it is passed during the flight }. Glass and doors
// in the same flat layer as the target (a window in front of somebody in a room, a car door) are
// put just in front of them.
function kcCoverList(K, o, h, a) {
  const out = [], evs = h.cover || [];
  for (let i = 0; i < evs.length; i++) {
    const e = evs[i]; if (e.ground || e.k === 'vest' || e.k === 'tyre') continue;
    let dz = e.z - h.z, mat;
    if (dz > 0.01) continue;
    if (e.k === 'glass') mat = 'glass';
    else if (e.k === 'objhit') mat = 'metal';
    else if (!e.small) continue; // only what the round went on through
    else if (e.mat === 'wood') mat = 'wood';
    else if (e.mat === 'thin') mat = kcThinMat(o.sim, e);
    else if (e.mat === 'metal' || e.mat === 'hard') mat = 'metal';
    else if (e.mat === 'wall') mat = 'wall';
    else continue;
    if (Math.abs(dz) < 0.01) dz = -(a && a.inVeh ? 0.32 : a && a.behind ? 0.9 : 0.45);
    out.push({ dz, x: e.x, y: e.y, mat, flight: dz / Math.max(0.3, K.dir[2]) < -K.dS + 0.02, done: false });
  }
  // through the body of a car to somebody inside: nothing is recorded for the door, but it is there
  if (a && a.inVeh && a.inVeh.def && !out.some((c) => c.dz > -0.5)) { const v = a.inVeh; if (h.y - v.y <= v.def.body + 0.02) out.push({ dz: -0.32, x: h.x, y: h.y, mat: 'metal', flight: false, done: false }); }
  out.sort((p, q) => p.dz - q.dz);
  return out;
}
// A thin solid is a board fence or a door, or the panel of a parked car (low and car length).
function kcThinMat(sim, e) {
  const S = sim && sim.S; if (!S) return 'wood';
  for (let i = 0; i < S.planes.length; i++) { const P = S.planes[i]; if (Math.abs(P.z - e.z) > 0.01) continue; for (let j = 0; j < P.solids.length; j++) { const s = P.solids[j]; if (s.mat === 'thin' && e.x >= s.x && e.x <= s.x + s.w && e.y >= s.y && e.y <= s.y + s.h) return s.h <= 1.3 && s.w >= 3 && s.w <= 9 ? 'metal' : 'wood'; } }
  return 'wood';
}
// The wall close behind: where the round really went on into it, or (for blood only) the surface
// a few metres behind the body. { dz, x, y (world), mat, hole }.
function kcWallList(K, o, h, a) {
  const ev = h.after && h.after.length ? h.after[0] : null;
  if (K.simThrough && ev && !ev.ground && (ev.k === 'impact' || ev.k === 'glass')) {
    const dz = ev.z - h.z;
    if (dz < 6) return { dz: Math.max(0.45, dz), x: ev.x, y: ev.y, mat: ev.k === 'glass' ? 'glass' : ev.mat === 'interior' ? 'interior' : ev.mat === 'wood' || ev.mat === 'thin' ? 'wood' : ev.mat === 'metal' || ev.mat === 'hard' ? 'metal' : 'wall', hole: true };
  }
  if (!a || a.inVeh || !K.exit) return null;
  const vz = Math.max(1, h.vz || 800), w = rdWallBehind(o.sim, a, { hx: h.x - a.x, hy: h.y - a.y, v: [h.vx || 0, h.vy || 0, vz] });
  if (!w || w.dz > 5) return null;
  const dz = Math.max(0.45, w.dz);
  return { dz, x: h.x + ((h.vx || 0) / vz) * dz, y: h.y + ((h.vy || 0) / vz) * dz, mat: w.mat === 'interior' ? 'interior' : w.mat === 'wood' || w.mat === 'thin' ? 'wood' : w.mat === 'metal' || w.mat === 'hard' ? 'metal' : 'wall', hole: false };
}
// During the flight: cover the round reaches is punched through out there in the real scene.
function kcFlightCovers(K) {
  const cs = K.covers; if (!cs || !cs.length) return;
  const h = K.o.hit;
  for (let i = 0; i < cs.length; i++) { const cv = cs[i]; if (cv.flight && !cv.done && K.bp[2] >= h.z + cv.dz) kcCoverBurst(K, cv, [cv.x, cv.y, h.z + cv.dz], true); }
}
// The round punching through cover: glass shatters into shards, wood into splinters, metal throws
// sparks, a wall bursts into dust and chips. Most of it goes on the way the round was going.
function kcCoverBurst(K, cv, at, world) {
  if (!cv || cv.done) return;
  cv.done = true; cv.t0 = K.T; cv.hx = at[0]; cv.hy = at[1];
  const L = world ? K.wparts : K.parts, m = cv.mat, sp = (kind, n, way, spread, s0, s1, r0, r1, life) => kcSpray(K, kind, n, at, way, spread, s0, s1, r0, r1, life, L);
  if (m === 'glass') { sp(5, 28, 1, 0.55, 0.8, 4.5, 0.01, 0.035, 2.2); sp(5, 9, -1, 0.7, 0.3, 1.6, 0.008, 0.02, 1.6); sp(4, 6, 1, 0.8, 0.2, 0.8, 0.01, 0.02, 0.5); }
  else if (m === 'wood') { sp(6, 20, 1, 0.5, 0.8, 4, 0.012, 0.04, 2.2); sp(6, 7, -1, 0.6, 0.4, 1.5, 0.01, 0.03, 1.8); sp(4, 10, 1, 0.8, 0.2, 1.0, 0.012, 0.03, 0.6); }
  else if (m === 'metal') { sp(7, 24, 1, 0.7, 2, 7, 0.004, 0.008, 0.5); sp(7, 10, -1, 0.8, 1, 4, 0.004, 0.008, 0.4); sp(4, 5, 1, 0.8, 0.2, 0.6, 0.01, 0.02, 0.5); }
  else { sp(4, 22, 1, 0.8, 0.3, 1.6, 0.015, 0.04, 0.9); sp(8, 16, 1, 0.6, 0.8, 3.5, 0.008, 0.025, 2); sp(4, 10, -1, 0.8, 0.3, 1.4, 0.015, 0.04, 0.8); }
  kcSay(K, 'cover', { mat: m });
}
// The round going on into the wall behind the body: a puff of dust and chips back out of the hole.
function kcWallHit(K, at) {
  const W = K.wallB; if (!W || W.holeT !== undefined) return;
  W.holeT = K.T; W.hz = at[2];
  kcSpray(K, 4, 16, at, -1, 0.8, 0.3, 1.5, 0.015, 0.04, 0.9); kcSpray(K, W.mat === 'glass' ? 5 : W.mat === 'wood' ? 6 : W.mat === 'metal' ? 7 : 8, 12, at, -1, 0.6, 0.8, 3, 0.008, 0.022, 1.8);
  kcSay(K, 'cover', { mat: W.mat === 'interior' ? 'wall' : W.mat, behind: true });
}
// Cover and the wall behind, in X-ray space: panes square to the round's line, with the hole the
// round made (and on the wall, whatever blood reached it, drawn with the other bits).
function kcDrawPanes(ctx, K, c, al) {
  const h = K.o.hit, ox = isFinite(h.ax) ? h.ax : h.x, oy = isFinite(h.ay) ? h.ay : h.y - 1, d = K.dir, pl = K.plan;
  const pane = (cx, cy, z, w, ht, mat, broken, hx, hy) => {
    const y0 = Math.max(0, cy - ht / 2), y1 = y0 + ht, x0 = cx - w / 2, x1 = cx + w / 2;
    ctx.beginPath();
    if (!kcProj(c, x0, y0, z, kcQ)) return; ctx.moveTo(kcQ[0], kcQ[1]);
    if (!kcProj(c, x1, y0, z, kcQ)) return; ctx.lineTo(kcQ[0], kcQ[1]);
    if (!kcProj(c, x1, y1, z, kcQ)) return; ctx.lineTo(kcQ[0], kcQ[1]);
    if (!kcProj(c, x0, y1, z, kcQ)) return; ctx.lineTo(kcQ[0], kcQ[1]); ctx.closePath();
    const col = mat === 'glass' ? '#b9dcff' : mat === 'wood' ? '#7a5634' : mat === 'metal' ? '#8d96a0' : mat === 'interior' ? '#55525e' : '#8b7e72';
    ctx.globalAlpha = al * (mat === 'glass' ? 0.12 : 0.4); ctx.fillStyle = col; ctx.fill();
    ctx.globalAlpha = al * 0.55; ctx.strokeStyle = mix(col, '#ffffff', 0.35); ctx.lineWidth = 1; ctx.stroke();
    // the grain of it: boards, courses of brick, a panel's fold
    ctx.globalAlpha = al * 0.22; ctx.beginPath();
    if (mat === 'wood') for (let x = x0 + 0.15; x < x1; x += 0.15) { if (kcProj(c, x, y0, z, kcQ) && kcProj(c, x, y1, z, kcQ2)) { ctx.moveTo(kcQ[0], kcQ[1]); ctx.lineTo(kcQ2[0], kcQ2[1]); } }
    else if (mat === 'wall' || mat === 'interior') for (let y = y0 + 0.25; y < y1; y += 0.25) { if (kcProj(c, x0, y, z, kcQ) && kcProj(c, x1, y, z, kcQ2)) { ctx.moveTo(kcQ[0], kcQ[1]); ctx.lineTo(kcQ2[0], kcQ2[1]); } }
    else if (mat === 'metal') { const y = lerp(y0, y1, 0.62); if (kcProj(c, x0, y, z, kcQ) && kcProj(c, x1, y, z, kcQ2)) { ctx.moveTo(kcQ[0], kcQ[1]); ctx.lineTo(kcQ2[0], kcQ2[1]); } }
    ctx.stroke();
    if (broken === undefined) return;
    // the hole, and for glass the cracks running out from it
    const age = K.T - broken, r = mat === 'glass' ? 0.035 : mat === 'wall' || mat === 'interior' ? 0.045 : 0.02;
    ctx.globalAlpha = al * 0.9; ctx.fillStyle = mat === 'metal' ? '#20252b' : '#100c0a'; ctx.beginPath();
    if (kcEll(ctx, c, hx, hy, z, kcSet(kcV1, r, 0, 0), kcSet(kcV2, 0, r, 0))) ctx.fill();
    if (mat === 'glass') {
      ctx.globalAlpha = al * 0.6; ctx.strokeStyle = '#e8f4ff'; ctx.beginPath(); const g = smooth(age / 0.15);
      for (let i = 0; i < 9; i++) { const an = i * 0.7 + kcHash(i + hx * 7) * 0.5, l = (0.12 + 0.3 * kcHash(i * 3 + hy)) * g; if (kcProj(c, hx, hy, z, kcQ) && kcProj(c, hx + Math.cos(an) * l, hy + Math.sin(an) * l, z, kcQ2)) { ctx.moveTo(kcQ[0], kcQ[1]); ctx.lineTo(kcQ2[0], kcQ2[1]); } }
      ctx.stroke();
    }
  };
  const cs = K.covers || [];
  for (let i = 0; i < cs.length; i++) {
    const cv = cs[i]; if (cv.flight) continue;
    const z = cv.dz, cx = cv.x - ox, cy = cv.y - oy, m = cv.mat;
    const w = m === 'glass' ? 1.0 : m === 'wood' ? 0.9 : m === 'metal' ? 1.3 : 1.7, ht = m === 'glass' ? 0.9 : m === 'wood' ? 1.4 : m === 'metal' ? 0.6 : 1.7;
    pane(cx, m === 'metal' ? cy - 0.12 : cy, z, w, ht, m, cv.done ? cv.t0 : undefined, cx, cy);
  }
  const W = K.wallB;
  if (W) { const cx = W.x - ox, cy = W.y - oy; pane(cx, Math.max(1.25, cy), W.dz, 2.8, 2.5, W.mat, W.holeT, cx + (pl ? d[0] * 0 : 0), cy); }
  ctx.globalAlpha = 1;
}

// ---- the picture ------------------------------------------------------------------------
KillCam.draw = function (dt) {
  const K = KillCam, o = K.o;
  if (!o || !o.view || !o.view.ctx) return;
  const V = o.view, ctx = V.ctx, W = V.W, H = V.H;
  ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  try {
    if (K.skipped || K.err) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = 'rgba(255,246,224,0.55)'; ctx.fillRect(0, 0, W, H); }
    else if (K.stage === 0) kcDrawBeat(K, V, ctx);
    else if (K.stage === 1) kcDrawFlight(K, V, ctx, dt || 0);
    else kcDrawXray(K, V, ctx, dt || 0);
  } catch (e) { K.err = e; K.skipped = true; if (window.console && console.error) console.error(e); }
  ctx.restore();
  ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  try { kcOverlay(K, V, ctx); } catch (e) { /* the frame is already drawn */ }
  ctx.globalAlpha = 1;
};
const kcPal = (o) => { const p = o && o.sim && o.sim.S && o.sim.S.pal; return p && p.skyTop && p.skyBot && p.ink ? p : kcPalDefault; };
const kcBars = (W, H) => Math.round(H * (W >= H ? 0.075 : 0.065)); // height of the black bars top and bottom

// Bars, dark corners, the skip hint, and the flashes that join the stages.
function kcOverlay(K, V, ctx) {
  const W = V.W, H = V.H, T = K.T, lb = kcBars(W, H) * smooth(T / 0.25);
  // the whip from the rifle to the flight: a pale smear that clears
  const wf = T >= K.Ta ? 1 - (T - K.Ta) / 0.24 : (T - (K.Ta - 0.1)) / 0.1;
  if (wf > 0 && wf <= 1 && !K.skipped) { ctx.fillStyle = 'rgba(255,244,222,' + (0.6 * wf * wf).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.hypot(W, H) * 0.56);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // drops on the lens (they are wiped away as the camera draws back to watch the body fall)
  const lensA = K.holdT0 !== null ? 1 - smooth((T - K.holdT0 - 0.5) / 0.6) : 1;
  for (let i = 0; i < K.lens.length && lensA > 0.01; i++) {
    const d = K.lens[i], age = T - d.t0; if (age < 0) continue;
    // a splash on the glass: a flattened blot with a few flecks round it, too close to be in
    // focus, that slowly starts to run
    const k = Math.min(1.4, Math.max(W, H) / 760), r = d.r * 1.3 * k * (0.5 + 0.5 * smooth(age / 0.1)), x = d.x * W, y = d.y * H, run = Math.min(r * 2.6, age * age * 14 * k);
    ctx.globalAlpha = 0.5 * lensA; ctx.fillStyle = '#6e0a10';
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.86, d.sd, 0, TAU); ctx.fill();
    ctx.beginPath(); for (let j = 0; j < 4; j++) { const an = d.sd * 3 + j * 1.7, rr = r * (1.25 + 0.5 * kcHash(j + d.sd)); ctx.moveTo(x + Math.cos(an) * rr + r * 0.16, y + Math.sin(an) * rr); ctx.arc(x + Math.cos(an) * rr, y + Math.sin(an) * rr, r * 0.16 * (0.6 + kcHash(j * 3 + d.sd)), 0, TAU); } ctx.fill();
    if (run > 1) { ctx.lineCap = 'round'; ctx.strokeStyle = '#6e0a10'; ctx.lineWidth = r * 0.34; ctx.beginPath(); ctx.moveTo(x + r * 0.2, y + r * 0.5); ctx.lineTo(x + r * 0.24, y + r * 0.6 + run); ctx.stroke(); }
    ctx.globalAlpha = 0.32 * lensA; ctx.fillStyle = '#c4202a'; ctx.beginPath(); ctx.ellipse(x - r * 0.08, y - r * 0.06, r * 0.72, r * 0.6, d.sd, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.28 * lensA; ctx.strokeStyle = '#ffd9d2'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r * 0.78, 3.6, 4.6); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (K.outT0 !== null) { const a = clamp((T - K.outT0) / kcTune.out, 0, 1); ctx.fillStyle = 'rgba(255,246,224,' + (0.9 * a * a).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, lb); ctx.fillRect(0, H - lb, W, lb);
  const ha = 0.6 * smooth(T / 0.4) * (1 - smooth((T - 3) / 0.6));
  if (ha > 0.01 && !K.skipped) {
    const G = CB.Game || {}, sf = G.safe || {};
    ctx.globalAlpha = ha; ctx.fillStyle = '#e8ecf1'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.font = '700 ' + (W < 500 ? 10 : 11) + 'px "Avenir Next Condensed","DIN Condensed","Roboto Condensed","Arial Narrow",sans-serif';
    ctx.fillText(G.touch ? 'TAP TO SKIP' : 'CLICK OR SPACE TO SKIP', W - 14 - (sf.r || 0), H - Math.max(lb / 2, 10 + Math.min(sf.b || 0, 14)));
    ctx.globalAlpha = 1;
  }
}

// ---- stage 0: at the rifle ---------------------------------------------------------------
// Where the rifle sits and how big it is drawn. Sizes are worked out in "rifle units", the
// units the rifle artwork is drawn in (a rifle is about 130 of them long).
function kcGunLayout(o, W, H) {
  const wide = W >= H, bw = W * (wide ? 0.86 : 0.94), bh = wide ? H * 0.56 : H * 0.3;
  let x0 = -38, x1 = 92, by = -3.4;
  try { if (typeof gunShapes === 'function') { const G = gunShapes(o.gunId, o.cfg); if (G && isFinite(G.x0) && isFinite(G.x1) && G.x1 > G.x0) { x0 = G.x0; x1 = G.x1; if (G.art && G.art.type === 'rail') by = -4.6; } } } catch (e) { /* use the guess */ }
  const top = -15, bot = o.cfg && o.cfg.support === 'sp_tripod' ? 28 : 17, span = x1 - x0;
  const sc = Math.min(bw / span, bh / (bot - top)) * 0.96;
  const gcx = W * 0.5, gcy = H * 0.5;
  return { W, H, bw, bh, sc, gcx, gcy, span, mx: gcx + (span / 2 - 1) * sc, my: gcy + (by - (top + bot) / 2) * sc, floor: gcy + (bot - 0.5 - (top + bot) / 2) * sc };
}
function kcDrawBeat(K, V, ctx) {
  const o = K.o, W = V.W, H = V.H, T = K.T, pal = kcPal(o), dpr = V.dpr, wide = W >= H;
  if (!K.gunLay || K.gunLay.W !== W || K.gunLay.H !== H) K.gunLay = kcGunLayout(o, W, H);
  const L = K.gunLay, sc = L.sc;
  // the camera pushes in on the muzzle, then whips away after the round
  const e = easeOut((T - 0.1) / 0.7), z = lerp(1, wide ? 1.42 : 2.3, e), wh = clamp((T - (K.Ta - 0.2)) / 0.2, 0, 1);
  const Mx = lerp(L.mx, W * (wide ? 0.56 : 0.5), e) - W * 1.5 * wh * wh * wh, My = lerp(L.my, H * 0.5, e);
  const k = sc * z; // screen pixels per rifle unit
  // sky behind, a low wall under the rifle
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, mix(pal.skyTop, '#000000', 0.5)); g.addColorStop(1, mix(pal.skyBot, '#000000', 0.4));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (pal.star > 0.2) { ctx.fillStyle = '#ffffff'; for (let i = 0; i < 46; i++) { ctx.globalAlpha = pal.star * (0.2 + 0.5 * kcHash(i * 3.1)); ctx.fillRect(kcHash(i) * W - wh * W * 0.3, kcHash(i + 60) * H * 0.6, 1.3, 1.3); } ctx.globalAlpha = 1; }
  const fy = My + (L.floor - L.my) * z;
  ctx.fillStyle = mix(pal.ink, pal.skyBot, 0.1); ctx.fillRect(0, fy, W, H - fy);
  ctx.fillStyle = rgba(mix(pal.skyBot, '#ffffff', 0.3), 0.3); ctx.fillRect(0, fy, W, 1.5);
  // recoil: in this near-frozen moment the rifle has only begun to come back
  const rc = easeOut((T - 0.03) / 0.6) * 1.5, mxs = Mx - rc * k, mys = My - rc * 0.12 * k;
  const t1 = T - 0.03, loud = !K.quiet, rail = K.steel;
  const grow = easeOut(t1 / 0.16), fade = t1 > 0 ? 1 - smooth((t1 - 0.2) / 0.5) : 0;
  // gas behind the rifle first, so the muzzle stays crisp in front of it
  if (t1 > 0) {
    const e2 = easeOut(T / 0.95);
    ctx.fillStyle = loud ? '#e9e0cd' : '#c9ced3';
    for (let i = 0; i < 22; i++) { // a cone of small puffs, thick near the bore and thinning as it spreads
      const al = kcHash(i + 9), dist = (1 + 24 * e2) * (0.15 + 0.85 * al), off = (kcHash(i + 5) - 0.5) * (1.2 + dist * 0.55), r = k * (0.6 + (loud ? 2.6 : 1.6) * e2 * (0.5 + al)) * (0.7 + 0.6 * kcHash(i + 2));
      ctx.globalAlpha = (loud ? 0.13 : 0.1) * (1 - 0.55 * e2) * (1.2 - al);
      ctx.beginPath(); ctx.arc(mxs + dist * k, mys + off * k, r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // the rifle, in the player's own skin
  ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (Mx - L.mx * z), dpr * (My - L.my * z));
  ctx.translate(-rc * sc, -rc * 0.12 * sc);
  try { const r = drawGun(ctx, o.gunId, o.cfg, L.gcx, L.gcy, L.bw, L.bh, { time: 1.2 + T * 0.3 }); if (r && r.scale > 0 && Math.abs(r.scale - L.sc) > L.sc * 0.02) { const q = r.scale / L.sc; L.sc = r.scale; L.mx = L.gcx + (L.mx - L.gcx) * q; L.my = L.gcy + (L.my - L.gcy) * q; L.floor = L.gcy + (L.floor - L.gcy) * q; } } catch (er) { /* no rifle art: the flash and the round still play */ }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // the flash
  if (t1 > 0 && fade > 0.01) {
    const hot = rail ? [150, 235, 255] : [255, 196, 96], R1 = k * (loud ? 10 : 3.2) * grow;
    if (loud) {
      // spikes: one long tongue forward and shorter ones fanned around it
      const sp = [0, 20, 0.5, 10, -0.55, 11, 1.1, 7, -1.2, 6.5, 1.95, 4.5, -2.0, 4];
      ctx.fillStyle = 'rgba(' + hot[0] + ',' + hot[1] + ',' + hot[2] + ',' + (0.8 * fade).toFixed(3) + ')';
      ctx.beginPath();
      for (let i = 0; i < sp.length; i += 2) {
        const an = sp[i] + 0.06 * Math.sin(T * 50 + i), len = sp[i + 1] * k * grow * (0.85 + 0.15 * Math.sin(T * 37 + i * 2)), wd = len * 0.13 + k * 0.5;
        const ca = Math.cos(an), sa = Math.sin(an);
        ctx.moveTo(mxs, mys); ctx.lineTo(mxs + ca * len * 0.35 - sa * wd, mys + sa * len * 0.35 + ca * wd); ctx.lineTo(mxs + ca * len, mys + sa * len); ctx.lineTo(mxs + ca * len * 0.35 + sa * wd, mys + sa * len * 0.35 - ca * wd); ctx.closePath();
      }
      ctx.fill();
    }
    const fg = ctx.createRadialGradient(mxs + R1 * 0.2, mys, 0, mxs + R1 * 0.2, mys, R1);
    fg.addColorStop(0, 'rgba(255,253,240,' + fade.toFixed(3) + ')'); fg.addColorStop(0.35, 'rgba(' + hot[0] + ',' + hot[1] + ',' + hot[2] + ',' + (0.75 * fade).toFixed(3) + ')'); fg.addColorStop(1, 'rgba(' + hot[0] + ',' + Math.round(hot[1] * 0.6) + ',' + Math.round(hot[2] * 0.5) + ',0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(mxs + R1 * 0.2, mys, R1, 0, TAU); ctx.fill();
    if (loud) { // the flash lights everything near it
      ctx.globalCompositeOperation = 'lighter';
      const lg = ctx.createRadialGradient(mxs, mys, 0, mxs, mys, k * 70);
      lg.addColorStop(0, 'rgba(' + hot[0] + ',' + hot[1] + ',' + hot[2] + ',' + (0.3 * fade).toFixed(3) + ')'); lg.addColorStop(1, 'rgba(' + hot[0] + ',' + hot[1] + ',' + hot[2] + ',0)');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
    }
  }
  // the shock ring, a thin hoop seen edge on, moving out ahead of the muzzle
  const e3 = easeOut((T - 0.05) / 0.75);
  if (T > 0.05 && e3 < 0.99) {
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 * (1 - e3)).toFixed(3) + ')'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(mxs + k * (2 + 15 * e3), mys, k * (0.5 + 3.4 * e3), k * (2 + (loud ? 15 : 8) * e3), 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.22 * (1 - e3)).toFixed(3) + ')';
    ctx.beginPath(); ctx.ellipse(mxs + k * (1 + 8 * e3), mys, k * (0.3 + 1.8 * e3), k * (1.5 + (loud ? 9 : 5) * e3), 0, 0, TAU); ctx.stroke();
  }
  // the round, coming out of the bore. It is the same 3D round as in the rest of the film, seen
  // through a long lens from the side: a camera 1000 rifle units away looking square across the barrel.
  const tip = T < 0.76 ? -4 + 30 * Math.pow(T / 0.76, 0.9) : 26 + 50 * (T - 0.76) + 1500 * (T - 0.76) * (T - 0.76);
  const bc = kcCamAim({ x: 1000, y: 0, z: 0, yaw: -Math.PI / 2, pitch: 0, f: 1000 * k, px: mxs, py: mys });
  ctx.save(); ctx.beginPath(); ctx.rect(mxs, 0, W * 3, H); ctx.clip();
  const bo = { len: 6.4, rad: 0.78, spin: K.spin * 2.2, mush: 0, steel: rail, hot: 0.5 * fade };
  if (K.sonic && tip > 4) kcWake(ctx, bc, 0, 0, tip, 0, 0, 1, { len: 6.4, rad: 0.78, a: 0.8 * smooth((tip - 4) / 8), t: T });
  kcBullet(ctx, bc, 0, 0, tip, 0, 0, 1, bo);
  ctx.restore();
  // a spent case, from rifles that throw one out by themselves
  if (K.action === 'semi' && T > 0.42) {
    const u = (T - 0.42) / 0.6, cxs = mxs - Math.min(L.span * 0.66 * k, mxs * 0.6) - u * 5 * k, cys = mys - (4 + 13 * u - 7 * u * u) * k;
    ctx.save(); ctx.translate(cxs, cys); ctx.rotate(-0.6 - u * 5); ctx.fillStyle = '#c9a24a'; ctx.fillRect(-1.7 * k, -0.5 * k, 3.4 * k, k); ctx.fillStyle = '#8a6a26'; ctx.fillRect(-1.7 * k, -0.5 * k, 0.5 * k, k); ctx.restore();
  }
  // streaks as the camera whips after the round
  if (wh > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.35 * wh).toFixed(3) + ')'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i = 0; i < 26; i++) { const y = kcHash(i + 3) * H, x = kcHash(i + 40) * W; ctx.moveTo(x, y); ctx.lineTo(x + W * 0.5 * wh, y); }
    ctx.stroke();
  }
}

// ---- stage 1: the flight -------------------------------------------------------------------
// The chase camera, in world space. It sits a hand's width behind the round, a little above,
// and drifts out to one side so the round is seen three-quarter. The lens starts long, opens
// wide in the fast middle and closes a little for the arrival. The camera never turns: like
// the scope, it looks straight down range and slides its picture to frame things, which is
// the only way the layered scenery can be drawn. Up close that stretches the round a little
// toward the vanishing point, as a very wide lens would.
function kcRig(K, W, H, u) {
  // How the chase camera sits for a given point in the flight (u from 0 to 1). On a wide
  // screen it goes out to the side, on a tall one mostly above, so the round is seen
  // three-quarter from behind with the target ahead of it.
  const wide = clamp((W / H - 0.6) / 0.9, 0, 1), fw = 0.55 * Math.max(W, H);
  const f = fw * (1 + 1.0 * (1 - smooth(u / 0.35)) + 0.55 * smooth((u - 0.6) / 0.4));
  const back = (0.2 * f) / fw, drift = 0.25 + 0.75 * smooth(u * 2.2) - 0.45 * smooth((u - 0.55) / 0.45), dv = 0.5 + 0.5 * drift;
  return { f, back, lat: K.side * lerp(0.45, 1, wide) * drift * back, up: lerp(0.62, 0.26, wide) * dv * back,
    sx: W / 2 + K.side * lerp(0.2, 0.3, wide) * W * drift, sy: H / 2 - lerp(0.13, 0.05, wide) * H * dv };
}
function kcFlightCam(K, V) {
  const W = V.W, H = V.H, c = K.cam, h = K.o.hit, d = K.dir, g = kcRig(K, W, H, clamp(K.fu || 0, 0, 1));
  c.x = K.bp[0] - d[0] * K.len + g.lat; c.y = K.bp[1] - d[1] * K.len + g.up; c.z = K.bp[2] - d[2] * K.len - g.back;
  c.yaw = 0; c.pitch = 0; c.f = g.f; kcCamAim(c);
  // slide the picture so the place the round will land sits where we want it on screen
  const dd = Math.max(0.5, h.z - c.z), sh = K.speedK * 1.6;
  c.px = g.sx - (g.f * (h.x - c.x)) / dd + (kcHash(K.T * 91) - 0.5) * sh;
  c.py = g.sy + (g.f * (h.y - c.y)) / dd + (kcHash(K.T * 57 + 3) - 0.5) * sh;
}
function kcDrawFlight(K, V, ctx, dt) {
  const o = K.o, W = V.W, H = V.H, c = K.cam, h = o.hit, d = K.dir;
  kcFlightCam(K, V);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  // Layers closer than a couple of metres are left out: at this speed they would only be a
  // one-frame smear filling the screen, and with so wide a lens they are the costliest to draw.
  V.drawWorld(o.sim, kcLayerCam(V, c, h.x, h.y, h.z), dt, K.simDt, { near: 2 + 6 * K.speedK });
  ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  // speed lines, streaming out from the point the round is flying at
  const sk = K.speedK;
  if (sk > 0.04 && kcProj(c, h.x, h.y, h.z, kcQ)) {
    K.streak += dt * (0.5 + 2.6 * sk);
    const vx = kcQ[0], vy = kcQ[1], Rm = Math.hypot(W, H) * 0.6;
    ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,' + (0.2 * sk).toFixed(3) + ')'; ctx.lineWidth = 1.3; ctx.beginPath();
    for (let i = 0; i < 44; i++) {
      const an = kcHash(i) * TAU, r = (kcHash(i + 77) + K.streak * (0.5 + kcHash(i + 9))) % 1, r0 = 30 + r * r * Rm, r1 = r0 + (8 + 150 * r) * sk;
      ctx.moveTo(vx + Math.cos(an) * r0, vy + Math.sin(an) * r0); ctx.lineTo(vx + Math.cos(an) * r1, vy + Math.sin(an) * r1);
    }
    ctx.stroke();
  }
  const bo = { len: K.len, rad: K.rad, spin: K.spin * 2.2, mush: 0, steel: K.steel, hot: 0.25 };
  kcWake(ctx, c, K.bp[0], K.bp[1], K.bp[2], d[0], d[1], d[2], { len: K.len, rad: K.rad, a: K.sonic ? 1 : 0.4, t: K.T, cone: K.sonic });
  kcBullet(ctx, c, K.bp[0], K.bp[1], K.bp[2], d[0], d[1], d[2], bo);
  if (K.wparts.length) kcDrawParts(ctx, K, c, K.wparts); // glass, splinters or sparks from cover the round went through on the way
}

// ---- the round ------------------------------------------------------------------------------
// Drawn as a real solid: a row of rings along its length, each put through the camera, joined
// into an outline. (tx, ty, tz) is the tip, (dx, dy, dz) the way it points.
// o: { len, rad, spin, mush (0..1 how flattened the nose is), steel, hot, tilt }
function kcBullet(ctx, c, tx, ty, tz, dx, dy, dz, o) {
  const n = kcProf.length / 2, len = o.len, rad = o.rad, m = o.mush || 0;
  // a little wobble about its own middle (and a real tumble once it is inside the body)
  let e1x = dz, e1z = -dx, l = Math.hypot(e1x, e1z); if (l < 1e-4) { e1x = 1; e1z = 0; l = 1; } e1x /= l; e1z /= l;
  let e2x = dy * e1z, e2y = dz * e1x - dx * e1z, e2z = -dy * e1x;
  const wob = 0.035, tl = o.tilt || 0, wx = wob * Math.cos(o.spin * 0.31), wy = wob * Math.sin(o.spin * 0.31) + tl;
  const mx = tx - dx * len * 0.55, my = ty - dy * len * 0.55, mz = tz - dz * len * 0.55;
  dx += e1x * wx + e2x * wy; dy += e2y * wy; dz += e1z * wx + e2z * wy; l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
  e1x = dz; e1z = -dx; l = Math.hypot(e1x, e1z) || 1; e1x /= l; e1z /= l; e2x = dy * e1z; e2y = dz * e1x - dx * e1z; e2z = -dy * e1x;
  const bx0 = mx - dx * len * 0.45, by0 = my - dy * len * 0.45, bz0 = mz - dz * len * 0.45; // the base
  for (let i = 0; i < n; i++) {
    let u = kcProf[i * 2], r = kcProf[i * 2 + 1];
    if (m > 0) { const fr = clamp((u - 0.5) / 0.5, 0, 1); r += m * (0.78 * Math.sin(Math.PI * Math.pow(fr, 1.6)) + 0.55 * Math.pow(fr, 6)); u -= m * 0.2 * fr * fr; } // the nose spreads and shortens
    if (!kcProj(c, bx0 + dx * len * u, by0 + dy * len * u, bz0 + dz * len * u, kcQ)) return false;
    kcBx[i] = kcQ[0]; kcBy[i] = kcQ[1]; kcBs[i] = kcQ[2]; kcBr[i] = r * rad * kcQ[2];
  }
  // which way the round's length runs on screen, and the direction square to it
  let ax = kcBx[n - 1] - kcBx[0], ay = kcBy[n - 1] - kcBy[0]; const la = Math.hypot(ax, ay);
  if (la < 0.3) { ax = 1; ay = 0; } else { ax /= la; ay /= la; }
  let nx = -ay, ny = ax; if (ny > 0) { nx = -nx; ny = -ny; } // keep "n" pointing up the screen so the highlight sits on top
  // how squarely we are looking down its length: 1 = from dead ahead, -1 = from dead behind
  const vx = c.x - mx, vy = c.y - my, vz = c.z - mz, vl = Math.hypot(vx, vy, vz) || 1, cosg = (dx * vx + dy * vy + dz * vz) / vl, flat = Math.abs(cosg), ang = Math.atan2(ay, ax);
  const R = kcBr[3], gx = kcBx[3], gy = kcBy[3];
  const grad = ctx.createLinearGradient(gx + nx * R, gy + ny * R, gx - nx * R, gy - ny * R);
  if (o.steel) { grad.addColorStop(0, '#7d8894'); grad.addColorStop(0.22, '#f4f8fb'); grad.addColorStop(0.5, '#aab6c2'); grad.addColorStop(0.85, '#56606b'); grad.addColorStop(1, '#2c333b'); }
  else { grad.addColorStop(0, '#8f4d23'); grad.addColorStop(0.2, '#ffdca6'); grad.addColorStop(0.46, '#cf7c3d'); grad.addColorStop(0.82, '#74391a'); grad.addColorStop(1, '#3d1c0b'); }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < n; i++) { const x = kcBx[i] + nx * kcBr[i], y = kcBy[i] + ny * kcBr[i]; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(kcBx[i] - nx * kcBr[i], kcBy[i] - ny * kcBr[i]);
  ctx.closePath();
  ctx.fillStyle = grad; ctx.strokeStyle = 'rgba(18,9,4,0.6)'; ctx.lineWidth = Math.max(0.7, R * 0.06);
  ctx.fill(); ctx.stroke();
  // seen from nearly end on the outline shrinks to nothing: the fattest ring fills it in
  if (flat > 0.2) { ctx.beginPath(); ctx.ellipse(kcBx[2], kcBy[2], Math.max(0.4, kcBr[2] * flat), kcBr[2], ang, 0, TAU); ctx.fill(); if (flat > 0.6) ctx.stroke(); }
  // rifling marks: six shallow grooves that wind round the body, and turn as it spins
  const s3 = kcBs[3] * rad, a1x = (e1x * c.rx + e1z * c.rz) * s3, a1y = -(e1x * c.ux + e1z * c.uz) * s3, a2x = (e2x * c.rx + e2z * c.rz) * s3, a2y = -(e2x * c.ux + e2y * c.uy + e2z * c.uz) * s3;
  ctx.strokeStyle = o.steel ? 'rgba(30,40,52,0.45)' : 'rgba(58,24,8,0.5)'; ctx.lineWidth = Math.max(0.6, R * 0.09); ctx.beginPath();
  for (let g = 0; g < 6; g++) {
    let pen = false;
    for (let i = 2; i <= 7; i++) {
      const an = o.spin + (g * TAU) / 6 + kcProf[i * 2] * 1.7, ca = Math.cos(an), sa = Math.sin(an);
      const facing = (e1x * ca + e2x * sa) * vx + e2y * sa * vy + (e1z * ca + e2z * sa) * vz; // is this bit of the surface on our side?
      if (facing <= 0) { pen = false; continue; }
      const k = (kcProf[i * 2 + 1] * kcBs[i]) / kcBs[3] * 0.97, x = kcBx[i] + (a1x * ca + a2x * sa) * k, y = kcBy[i] + (a1y * ca + a2y * sa) * k;
      if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      pen = true;
    }
  }
  ctx.stroke();
  // the crimp groove round its waist
  ctx.strokeStyle = 'rgba(30,12,4,0.5)'; ctx.lineWidth = Math.max(0.6, R * 0.08);
  ctx.beginPath(); ctx.ellipse(kcBx[4], kcBy[4], Math.max(0.3, kcBr[4] * flat), kcBr[4], ang, 0, TAU); ctx.stroke();
  if (cosg < -0.04) { // from behind: the flat base, with its lead core showing
    ctx.fillStyle = o.steel ? '#4b545e' : '#7a4a22'; ctx.beginPath(); ctx.ellipse(kcBx[0], kcBy[0], Math.max(0.4, kcBr[0] * flat), kcBr[0], ang, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = o.steel ? '#2c333b' : '#5a5d65'; ctx.beginPath(); ctx.ellipse(kcBx[0], kcBy[0], Math.max(0.3, kcBr[0] * flat * 0.58), kcBr[0] * 0.58, ang, 0, TAU); ctx.fill();
  }
  if (o.hot > 0.02) { // still hot from the barrel
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,130,50,' + (0.3 * o.hot).toFixed(3) + ')';
    ctx.beginPath(); for (let i = 0; i < n; i++) { const x = kcBx[i] + nx * kcBr[i], y = kcBy[i] + ny * kcBr[i]; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(kcBx[i] - nx * kcBr[i], kcBy[i] - ny * kcBr[i]);
    ctx.fill(); ctx.globalCompositeOperation = 'source-over';
  }
  return true;
}
// The air behind the round: a faint cone of shock rings (only when it is faster than sound)
// and a wavering thread of disturbed air.
function kcWake(ctx, c, tx, ty, tz, dx, dy, dz, o) {
  let e1x = dz, e1z = -dx, l = Math.hypot(e1x, e1z); if (l < 1e-4) { e1x = 1; e1z = 0; l = 1; } e1x /= l; e1z /= l;
  const e2x = dy * e1z, e2y = dz * e1x - dx * e1z, e2z = -dy * e1x, a = o.a || 1;
  if (o.cone !== false) {
    const have = kcProj(c, tx, ty, tz, kcQ2), tsx = kcQ2[0], tsy = kcQ2[1];
    for (let i = 1; i <= 3; i++) {
      // a ring of radius r at distance d behind the tip. r grows with d: that slope is the Mach angle.
      const d = o.len * (0.25 + 0.42 * i * i), r = o.rad * 0.7 + d * 0.4;
      kcSet(kcV1, e1x * r, 0, e1z * r); kcSet(kcV2, e2x * r, e2y * r, e2z * r);
      ctx.beginPath();
      if (!kcEll(ctx, c, tx - dx * d, ty - dy * d, tz - dz * d, kcV1, kcV2)) continue;
      ctx.strokeStyle = 'rgba(255,255,255,' + ((0.22 * a) / i).toFixed(3) + ')'; ctx.lineWidth = 1.1; ctx.stroke();
      if (i === 3 && have) {
        const ex = Math.cos(kcE[2]) * kcE[0], ey = Math.sin(kcE[2]) * kcE[0];
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.12 * a).toFixed(3) + ')'; ctx.beginPath(); ctx.moveTo(tsx, tsy); ctx.lineTo(kcQ[0] + ex, kcQ[1] + ey); ctx.moveTo(tsx, tsy); ctx.lineTo(kcQ[0] - ex, kcQ[1] - ey); ctx.stroke();
      }
    }
  }
  // the thread of stirred air: a few thin lines that waver and fade
  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    let px = 0, py = 0, ok = false;
    for (let j = 0; j <= 9; j++) {
      const d = o.len * (1.0 + j * 1.25), w = (o.len / 0.065) * (j * 0.0028 * Math.sin(o.t * 24 + j * 1.3 + k * 2.1) + (k - 1) * 0.004 * Math.min(1, j / 3));
      const good = kcProj(c, tx - dx * d + e1x * w, ty - dy * d + w * 0.7, tz - dz * d + e1z * w, kcQ);
      if (good && ok) { ctx.strokeStyle = 'rgba(255,255,255,' + (0.2 * a * (1 - j / 10)).toFixed(3) + ')'; ctx.lineWidth = clamp(o.rad * kcQ[2] * 0.22, 0.8, 2.6); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(kcQ[0], kcQ[1]); ctx.stroke(); }
      px = kcQ[0]; py = kcQ[1]; ok = good;
      if (!good) break;
    }
  }
}

// ---- stages 2 to 4: the swing, the X-ray, the hold --------------------------------------------
// The camera circles the target. phi is how far round it has come (0 = behind the round,
// a quarter turn = looking square across the line of fire), R how far away it is, el how high.
// It stops short of a quarter turn (kcTune.angle, then drifting to angleX), on the shooter's
// side, so it still looks a little along the round's path: the round is seen to go into the
// body, through it and out, instead of sliding flat across the picture.
function kcOrbitCam(K, V) {
  const W = V.W, H = V.H, sw = K.sw, c = K.cam, T = K.T, deg = kcTune.deg;
  if (sw.sW !== W || sw.sH !== H) { // the phone was turned: frame the shots again for the new shape
    const vis = H * 0.85, kx = W / sw.sW, ky = H / sw.sH;
    sw.R1 = sw.f / Math.min(W / 1.5, vis / 1.62); sw.R2 = sw.f / Math.min(W / 0.86, vis / 0.6);
    sw.phx *= kx; sw.phy *= ky; sw.px0 *= kx; sw.py0 *= ky; sw.sW = W; sw.sH = H;
  }
  const u = clamp((T - K.Tb) / kcTune.swing, 0, 1), e = smooth(u), tau = Math.max(0, T - K.Tc), push = smooth(tau / 0.9);
  // in the hold the camera draws back, comes round toward the shooter's side a little (so a wall
  // behind is seen, not edge on) and follows the body down
  const hold = K.holdT0 !== null ? smooth((T - K.holdT0 - 0.15) / 1.1) : 0, fl = K.follow;
  const phi = lerp(lerp(sw.phi0, kcTune.angle * deg, e) + (kcTune.angleX - kcTune.angle) * (1 - Math.exp(-tau * 0.6)) * deg, (K.wallB ? 52 : 70) * deg, hold);
  // For the X-ray the camera comes in closer with a wider lens (the body is framed the same): the
  // stronger perspective makes the round's path read in depth, the near end coming toward us.
  const fk = lerp(1, kcTune.lensX, push * (1 - hold));
  const R = lerp(lerp(sw.R0, sw.R1, e), sw.R2 * fk, push) * (1 + 0.85 * hold), el = lerp(lerp(sw.el0, 0.11, e), 0.22, hold);
  const k1 = smooth(u * 1.2);
  let px = lerp(lerp(sw.H[0], sw.mid[0], k1), sw.focus[0], push), py = lerp(lerp(sw.H[1], sw.mid[1], k1), sw.focus[1], push), pz = 0;
  if (fl && hold > 0) { px = lerp(px, fl[0], hold); py = lerp(py, fl[1], hold); pz = lerp(pz, fl[2], hold); }
  const B = sw.B, Nn = sw.N, U = sw.U, cb = Math.cos(phi) * Math.cos(el), cn = K.side * Math.sin(phi) * Math.cos(el), cu = Math.sin(el);
  c.x = px + R * (B[0] * cb + Nn[0] * cn + U[0] * cu); c.y = py + R * (B[1] * cb + U[1] * cu); c.z = pz + R * (B[2] * cb + Nn[2] * cn + U[2] * cu);
  c.f = sw.f * fk;
  // The chase camera looked straight down range with its picture slid sideways. Over the first
  // third of the swing that turns into a camera that really looks at the target.
  kcLook(c, px, py, pz);
  const w = smooth(u / 0.3), k2 = smooth(u * 1.3);
  c.yaw *= w; c.pitch *= w; kcCamAim(c);
  c.px = lerp(sw.px0, lerp(sw.phx, W / 2, k2), w); c.py = lerp(sw.py0, lerp(sw.phy, H / 2, k2), w);
  return u;
}
function kcDrawXray(K, V, ctx, dt) {
  const o = K.o, sim = o.sim, W = V.W, H = V.H, c = K.cam, T = K.T, pl = K.plan, sw = K.sw, pal = kcPal(o), d = K.dir;
  const u = kcOrbitCam(K, V), voidA = smooth((u - 0.1) / 0.48), figA = smooth((u - 0.01) / 0.11);
  const fig = kcBuildFig(K);
  // the middle of the body, for the camera to follow as it falls (a little below, so the floor shows)
  { const P = fig.P, fx = (P.hip[0] + P.neck[0]) / 2, fy = Math.max(0.2, (P.hip[1] + P.neck[1]) / 2 - 0.1), fz = (P.hip[2] + P.neck[2]) / 2; if (!K.follow) K.follow = [fx, fy, fz]; else { const k = Math.min(1, (dt || 0) * 6); K.follow[0] += (fx - K.follow[0]) * k; K.follow[1] += (fy - K.follow[1]) * k; K.follow[2] += (fz - K.follow[2]) * k; } }
  if (voidA < 0.995) {
    // The real scene, still there for the first part of the swing. Its camera is our 3D camera
    // moved into world space and matched on the target, so the scene slides and parts as we go round.
    const a = o.actor, w = smooth(u / 0.3);
    const ox = lerp(sw.ox, a && isFinite(a.x) ? a.x : sw.ox, w), oy = lerp(sw.oy, a && isFinite(a.y) ? a.y : sw.oy, w);
    const wc = { x: c.x + ox, y: c.y + oy, z: c.z + sw.oz, yaw: c.yaw, pitch: c.pitch, f: c.f, px: c.px, py: c.py, rx: c.rx, rz: c.rz, fx: c.fx, fy: c.fy, fz: c.fz, ux: c.ux, uy: c.uy, uz: c.uz };
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    // Once the solid figure is fully there, the flat one underneath is left out of the scene's
    // picture (only for the length of this one drawing call: nothing in the world changes).
    const hide = a && figA > 0.99 && !a.hidden && !a.inVeh;
    if (hide) a.hidden = true;
    try { V.drawWorld(sim, kcLayerCam(V, wc, ox, oy + sw.mid[1], sw.oz), dt, K.simDt, { near: 0.6 }); } finally { if (hide) a.hidden = false; }
    ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  if (voidA > 0.004) {
    // X-ray space: a dark room lit with the colours of the place we just left
    ctx.globalAlpha = voidA;
    const gc = K.gore ? mix('#1b2130', pal.skyBot, 0.2 + 0.12 * (1 - (pal.dark || 0))) : '#16283a', ge = K.gore ? mix('#030407', pal.skyTop, 0.1) : '#03070c';
    let gx = W / 2, gy = H / 2; if (kcProj(c, 0, sw.mid[1], 0, kcQ)) { gx = kcQ[0]; gy = kcQ[1]; }
    const bg = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(W, H) * 0.72);
    bg.addColorStop(0, gc); bg.addColorStop(0.55, mix(gc, ge, 0.7)); bg.addColorStop(1, ge);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    kcFloor(ctx, K, c, pal, voidA);
    kcDrawPanes(ctx, K, c, voidA);
    ctx.globalAlpha = 1;
  }
  // how far the skin has turned to glass
  const xr = smooth((T - (K.Tc - 0.5)) / 0.55), infl = smooth((u - 0.12) / 0.5);
  kcShell(ctx, K, c, fig, figA, xr, infl, pal);
  if (xr > 0.01) kcInnards(ctx, K, c, fig, figA * xr);
  if (K.hitT !== null) { kcTrack(ctx, K, c, fig); kcRipples(ctx, K, c, fig); }
  // the round, while any of it is still to be seen
  const tipx = pl.H[0] + d[0] * K.s, tipz = pl.H[2] + d[2] * K.s;
  let tipy = pl.H[1] + d[1] * K.s, tum = 0;
  // a round with nothing left after the far side drops, turning over, to the floor
  if (K.spent && K.spentT !== undefined) { const ft = T - K.spentT; tipy = Math.max(K.rad, tipy - 1.6 * ft * ft); tum = Math.sin(Math.min(ft, 1.2) * 3) * 1.4; }
  const inside = K.hitT !== null ? clamp((K.s - pl.sIn) / 0.25, 0, 1) : 0;
  const bo = { len: K.len, rad: K.rad, spin: K.spin * (K.hitT !== null ? 0.5 : 2.2), mush: K.mush * 0.9, steel: K.steel || !K.gore, hot: 0.2 * (1 - inside), tilt: (K.through === false ? 0.42 : 0.2) * inside * Math.sin(inside * 2.1) + tum };
  if (K.hitT === null) kcWake(ctx, c, tipx, tipy, tipz, d[0], d[1], d[2], { len: K.len, rad: K.rad, a: (K.sonic ? 0.9 : 0.35) * (1 - 0.5 * u), t: T, cone: K.sonic });
  kcDrawParts(ctx, K, c);
  // The round is drawn over the spray, so it can always be followed through the body. While it is
  // inside, a soft light round it lifts it off the gore (it is the one thing the eye must not lose).
  const glow = K.hitT !== null && (!K.exit || K.s < pl.sOut + 0.25) && !(K.spent && K.spentT !== undefined) ? smooth((K.s - pl.sIn + 0.01) / 0.03) : 0;
  if (glow > 0.01 && kcProj(c, tipx - d[0] * K.len * 0.5, tipy - d[1] * K.len * 0.5, tipz - d[2] * K.len * 0.5, kcQ)) {
    const gr = Math.max(8, K.len * kcQ[2] * 1.1), gg = ctx.createRadialGradient(kcQ[0], kcQ[1], 0, kcQ[0], kcQ[1], gr);
    gg.addColorStop(0, K.gore ? 'rgba(255,236,200,0.5)' : 'rgba(225,242,255,0.5)'); gg.addColorStop(1, 'rgba(255,236,200,0)');
    ctx.globalAlpha = glow; ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(kcQ[0], kcQ[1], gr, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  kcBullet(ctx, c, tipx, tipy, tipz, d[0], d[1], d[2], bo);
  kcCaption(ctx, K, c, V);
}
// The floor of X-ray space: faint rings and spokes round the target's feet, and a soft shadow.
function kcFloor(ctx, K, c, pal, a) {
  const col = K.gore ? mix(pal.skyBot, '#ffffff', 0.35) : '#bfe0ff', rings = [0.6, 1.2, 1.9, 2.8, 4];
  ctx.lineWidth = 1; ctx.strokeStyle = rgba(col, 0.11); ctx.beginPath();
  for (let r = 0; r < rings.length; r++) {
    let pen = false;
    for (let i = 0; i <= 32; i++) { const an = (i / 32) * TAU, ok = kcProj(c, Math.cos(an) * rings[r], 0, Math.sin(an) * rings[r], kcQ); if (!ok) { pen = false; continue; } if (pen) ctx.lineTo(kcQ[0], kcQ[1]); else ctx.moveTo(kcQ[0], kcQ[1]); pen = true; }
  }
  for (let i = 0; i < 12; i++) { const an = (i / 12) * TAU + 0.26; if (kcProj(c, Math.cos(an) * 0.6, 0, Math.sin(an) * 0.6, kcQ) && kcProj(c, Math.cos(an) * 4, 0, Math.sin(an) * 4, kcQ2)) { ctx.moveTo(kcQ[0], kcQ[1]); ctx.lineTo(kcQ2[0], kcQ2[1]); } }
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath();
  const J = K.fig ? K.fig.J : kcStand;
  if (kcEll(ctx, c, (J.ftL[0] + J.ftR[0] + J.hip[0]) / 3, 0, 0, kcSet(kcV1, 0.46, 0, 0), kcSet(kcV2, 0, 0, 0.4))) ctx.fill();
}

// ---- the target as a 3D figure ----------------------------------------------------------------
// The game's people are flat: a set of joints seen from the side. Here each joint is given a
// depth as well: the left arm and leg go to one side of the body and the right to the other,
// shoulders 36 cm apart and hips 23. Once the person is dead the ragdoll (src/13_ragdoll.js)
// already has every point in 3D, pushed by the round and turning as it falls, and the figure
// is built straight from those, so this picture and the scope's always show the same fall.
function kcBuildFig(K) {
  const o = K.o, a = o.actor; let J = null;
  try {
    if (a) {
      let src = a;
      // The world moves in steps while the film crawls, so a falling body would jerk. Read the
      // pose through a stand-in that reports a smoothly growing time since death.
      if (a.dead && K.hitT !== null && isFinite(a.deathAtT)) { src = Object.create(a); src.deadT = clamp(K.ret - a.deathAtT, a.deadT || 0, (a.deadT || 0) + K.step); }
      J = actorJoints(src);
    }
  } catch (e) { J = null; }
  if (!J || !J.hip || !J.neck || !J.head || !J.ftL || !J.haR || !isFinite(J.hip[1])) J = (K.fig && K.fig.J) || kcStand;
  const sc = J.scale || 1, fs = (J.f || 1) < 0 ? -1 : 1, L = K.look || {};
  const bw = L.build === 'big' ? 1.16 : L.build === 'thin' ? 0.9 : 1, lw = 0.085 * sc * (L.build === 'big' ? 1.3 : L.build === 'thin' ? 0.85 : 1);
  const ws = 0.18 * sc * bw, wh = 0.115 * sc * bw, wt = ws - 0.045 * sc, za = ws + 0.06 * sc;
  let P;
  if (J.j3) {
    const j = J.j3, H = RD_N * 3, g = (i) => [j[i * 3], j[i * 3 + 1], j[i * 3 + 2]], sh = [j[H + 3], j[H + 4], j[H + 5]], shL = g(RD_SHL), shR = g(RD_SHR), k = wt / ws;
    P = { hip: [j[H], j[H + 1], j[H + 2]], neck: [j[H + 6], j[H + 7], j[H + 8]], head: g(RD_HEAD), sh, shL, shR,
      tsL: [lerp(sh[0], shL[0], k), lerp(sh[1], shL[1], k), lerp(sh[2], shL[2], k)], tsR: [lerp(sh[0], shR[0], k), lerp(sh[1], shR[1], k), lerp(sh[2], shR[2], k)],
      elL: g(RD_ELL), haL: g(RD_HAL), elR: g(RD_ELR), haR: g(RD_HAR), hpL: g(RD_HPL), hpR: g(RD_HPR), knL: g(RD_KNL), ftL: g(RD_FTL), knR: g(RD_KNR), ftR: g(RD_FTR) };
  } else {
    const sh = J.sh || J.neck;
    // a person facing right (+x) has their right side toward the shooter, so right is -z and left is +z
    P = {
      hip: [J.hip[0], J.hip[1], 0], neck: [J.neck[0], J.neck[1], 0], head: [J.head[0], J.head[1], 0], sh: [sh[0], sh[1], 0],
      shL: [sh[0], sh[1], fs * ws], shR: [sh[0], sh[1], -fs * ws], tsL: [sh[0], sh[1], fs * wt], tsR: [sh[0], sh[1], -fs * wt], elL: [J.elL[0], J.elL[1], fs * za], haL: [J.haL[0], J.haL[1], fs * za], elR: [J.elR[0], J.elR[1], -fs * za], haR: [J.haR[0], J.haR[1], -fs * za],
      hpL: [J.hip[0], J.hip[1], fs * wh], hpR: [J.hip[0], J.hip[1], -fs * wh], knL: [J.knL[0], J.knL[1], fs * wh * 0.95], ftL: [J.ftL[0], J.ftL[1], fs * wh * 0.9], knR: [J.knR[0], J.knR[1], -fs * wh * 0.95], ftR: [J.ftR[0], J.ftR[1], -fs * wh * 0.9],
    };
  }
  // the trunk's own axes (U up the spine, S toward the person's left, F out of the chest) and the head's
  const tor = { o: P.hip, U: [0, 1, 0], S: [0, 0, fs], F: [fs, 0, 0], L: 0.56 * sc }, hd = { o: P.head, U: [0, 1, 0], S: [0, 0, fs], F: [fs, 0, 0] };
  tor.L = kcAxes(tor, P.neck[0] - P.hip[0], P.neck[1] - P.hip[1], P.neck[2] - P.hip[2], P.shL[0] - P.shR[0] + P.hpL[0] - P.hpR[0], P.shL[1] - P.shR[1] + P.hpL[1] - P.hpR[1], P.shL[2] - P.shR[2] + P.hpL[2] - P.hpR[2]) || 0.56 * sc;
  kcAxes(hd, P.head[0] - P.neck[0], P.head[1] - P.neck[1], P.head[2] - P.neck[2], tor.S[0], tor.S[1], tor.S[2]);
  K.fig = { J, P, S: (K.fig && K.fig.S) || {}, sc, fs, bw, lw, ws, wh, wt, za, hr: 0.17 * sc, look: L, tor, hd };
  return K.fig;
}
// Set a frame's U along (ux, uy, uz) and S along (sx, sy, sz) made square to it; F = U x S.
// Returns the length of U as given.
function kcAxes(fr, ux, uy, uz, sx, sy, sz) {
  const l = Math.hypot(ux, uy, uz); if (l < 1e-6) return 0;
  ux /= l; uy /= l; uz /= l;
  const d = sx * ux + sy * uy + sz * uz; sx -= ux * d; sy -= uy * d; sz -= uz * d;
  const m = Math.hypot(sx, sy, sz); if (m < 1e-6) return l;
  sx /= m; sy /= m; sz /= m;
  fr.U[0] = ux; fr.U[1] = uy; fr.U[2] = uz; fr.S[0] = sx; fr.S[1] = sy; fr.S[2] = sz;
  fr.F[0] = uy * sz - uz * sy; fr.F[1] = uz * sx - ux * sz; fr.F[2] = ux * sy - uy * sx;
  return l;
}
// How much one of a frame's axes points along a camera direction (for "can we see the face").
const kcDot = (v, x, y, z) => v[0] * x + v[1] * y + v[2] * z;
// The outside of the figure, in the game's own look: dark ink limbs with a pale edge, the coat,
// the hat. xr (0..1) turns it to glass. infl (0..1) lets the trunk fill out from the flat
// stick it is in the scope to something with a chest.
function kcShell(ctx, K, c, fig, alpha, xr, infl, pal) {
  if (alpha < 0.01) return;
  const P = fig.P, S = fig.S, L = fig.look, sc = fig.sc, lw = fig.lw, hd = fig.hd, tor = fig.tor;
  for (const k in P) { const q = S[k] || (S[k] = [0, 0, 0, 0]); if (!kcProj(c, P[k][0], P[k][1], P[k][2], q)) return; }
  const dimK = 0.1 + 0.22 * (pal.dark || 0), D = (col) => (typeof col === 'string' && col.charAt(0) === '#' && (col.length === 7 || col.length === 4) ? mix(col, '#05070b', dimK) : '#3a3f48');
  const glass = K.gore ? '#7f9cba' : '#9cc6ea';
  const ink = mix(pal.ink, glass, xr * 0.85), aInk = lerp(1, 0.2, xr), aCl = lerp(1, 0.15, xr), rim = xr > 0.5 ? 'rgba(190,222,255,0.5)' : pal.rim;
  const rl = lw / 2, rT = lerp(rl, 0.07 * sc, infl), pad = 0.024;
  const wOf = (r, a, b) => Math.max(1, r * (S[a][2] + S[b][2]));
  const two = (a, b) => { ctx.beginPath(); ctx.moveTo(S[a][0], S[a][1]); ctx.lineTo(S[b][0], S[b][1]); };
  const three = (a, b, d) => { ctx.beginPath(); ctx.moveTo(S[a][0], S[a][1]); ctx.lineTo(S[b][0], S[b][1]); ctx.lineTo(S[d][0], S[d][1]); };
  const quad = (a, b, d, e) => { ctx.beginPath(); ctx.moveTo(S[a][0], S[a][1]); ctx.lineTo(S[b][0], S[b][1]); ctx.lineTo(S[d][0], S[d][1]); ctx.lineTo(S[e][0], S[e][1]); ctx.closePath(); };
  // the hem of a coat or the bottom of a vest: points below (or above) the hips on each side
  const hemK = L.coat ? (L.long ? 0.55 : 0.05) : 0;
  const low = (key, a, kk) => { const q = S[key] || (S[key] = [0, 0, 0, 0]); kcLocP(c, tor, a, -tor.L * kk, 0, q); };
  low('lowL', fig.wh * 1.05, hemK); low('lowR', -fig.wh * 1.05, hemK); low('vstL', fig.wh, -0.3); low('vstR', -fig.wh, -0.3);
  const hs = S.head[2], hr = fig.hr * hs, hx = S.head[0], hy = S.head[1];
  const camF = kcDot(hd.F, c.x - P.head[0], c.y - P.head[1], c.z - P.head[2]); // above zero when we can see the face
  const tilt = Math.atan2(hd.U[0] * c.rx + hd.U[2] * c.rz, kcDot(hd.U, c.ux, c.uy, c.uz)); // how the head's "up" leans on screen
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // ---- pale outline under everything, so the figure reads against any background
  ctx.globalAlpha = alpha * lerp(1, 0.9, xr); ctx.strokeStyle = rim; ctx.fillStyle = rim;
  const rimLimb = (a, b, d) => { three(a, b, d); ctx.lineWidth = wOf(rl + pad, a, d); ctx.stroke(); };
  rimLimb('hpL', 'knL', 'ftL'); rimLimb('hpR', 'knR', 'ftR'); rimLimb('shL', 'elL', 'haL'); rimLimb('shR', 'elR', 'haR');
  quad('tsL', 'tsR', 'hpR', 'hpL'); ctx.lineWidth = wOf(rT + pad, 'sh', 'hip'); ctx.stroke();
  two('sh', 'head'); ctx.lineWidth = wOf(rl + pad, 'sh', 'head'); ctx.stroke();
  ctx.beginPath(); ctx.arc(hx, hy, hr + Math.max(1, pad * hs), 0, TAU); ctx.fill();
  // ---- the parts, far ones first
  const parts = [];
  const limb = (a, b, d, sleeve) => parts.push({ z: (S[a][3] + S[b][3] + S[d][3]) / 3, f() {
    ctx.globalAlpha = alpha * aInk; ctx.strokeStyle = ink; three(a, b, d); ctx.lineWidth = wOf(rl, a, d); ctx.stroke();
    if (sleeve) { // a sleeve, a shade darker than the coat and edged, so the arm reads against the body
      const sw = wOf(rl * 1.35, a, b), cl = D(L.coat);
      ctx.globalAlpha = alpha * aCl; ctx.beginPath(); ctx.moveTo(S[a][0], S[a][1]); ctx.lineTo(S[b][0], S[b][1]); ctx.lineTo(lerp(S[b][0], S[d][0], 0.7), lerp(S[b][1], S[d][1], 0.7));
      ctx.strokeStyle = mix(cl, '#000000', 0.42); ctx.lineWidth = sw + 2.2; ctx.stroke();
      ctx.strokeStyle = mix(cl, '#000000', 0.12); ctx.lineWidth = sw; ctx.stroke();
    }
  } });
  limb('hpL', 'knL', 'ftL', false); limb('hpR', 'knR', 'ftR', false); limb('shL', 'elL', 'haL', !!L.coat); limb('shR', 'elR', 'haR', !!L.coat);
  parts.push({ z: (S.sh[3] + S.hip[3]) / 2, f() {
    ctx.globalAlpha = alpha * aInk; ctx.strokeStyle = ink; ctx.fillStyle = ink;
    quad('tsL', 'tsR', 'hpR', 'hpL'); ctx.lineWidth = wOf(rT, 'sh', 'hip'); ctx.fill(); ctx.stroke();
    two('sh', 'head'); ctx.lineWidth = wOf(rl, 'sh', 'head'); ctx.stroke();
    ctx.globalAlpha = alpha * aCl;
    if (L.dress) { // a skirt: a cone from the neck to below the hips
      const cl = D(L.dress); ctx.fillStyle = cl;
      if (kcLocP(c, tor, 0, tor.L - 0.08 * sc, 0, kcQ) && kcLocP(c, tor, 0, -0.38 * sc, 0, kcQ2)) {
        const wt = 0.12 * sc * kcQ[2], wb = 0.27 * sc * kcQ2[2]; let ax = kcQ2[0] - kcQ[0], ay = kcQ2[1] - kcQ[1]; const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
        ctx.beginPath(); ctx.moveTo(kcQ[0] - ay * wt, kcQ[1] + ax * wt); ctx.lineTo(kcQ[0] + ay * wt, kcQ[1] - ax * wt); ctx.lineTo(kcQ2[0] + ay * wb, kcQ2[1] - ax * wb); ctx.lineTo(kcQ2[0] - ay * wb, kcQ2[1] + ax * wb); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.ellipse(kcQ2[0], kcQ2[1], wb, wb * 0.14, Math.atan2(ax, -ay), 0, TAU); ctx.fill();
      }
    }
    if (L.coat) {
      const cl = D(L.coat), cr = lerp(rl * 2.5, 0.092 * sc, infl); ctx.strokeStyle = cl; ctx.fillStyle = cl; quad('tsL', 'tsR', 'lowR', 'lowL'); ctx.lineWidth = wOf(cr, 'sh', 'hip'); ctx.fill(); ctx.stroke();
      // the opening down the front, once we have come far enough round to see it
      if (camF > 0.3 && kcLocP(c, tor, 0, tor.L - 0.05 * sc, cr, kcQ) && kcLocP(c, tor, 0, -tor.L * hemK - 0.09 * sc, cr, kcQ2)) {
        ctx.strokeStyle = mix(cl, '#000000', 0.38); ctx.lineWidth = Math.max(1.2, 0.012 * sc * kcQ[2]); ctx.beginPath(); ctx.moveTo(kcQ[0], kcQ[1]); ctx.lineTo(kcQ2[0], kcQ2[1]); ctx.stroke();
      }
    }
    if (L.vest) { const cl = D(L.vest); ctx.strokeStyle = cl; ctx.fillStyle = cl; quad('tsL', 'tsR', 'vstR', 'vstL'); ctx.lineWidth = wOf(lerp(rl * 2.4, 0.088 * sc, infl), 'sh', 'hip'); ctx.fill(); ctx.stroke(); }
    if (L.tie && camF > -0.2 && kcLocP(c, tor, 0, tor.L - 0.04 * sc, rT + 0.02, kcQ) && kcLocP(c, tor, 0, tor.L - 0.32 * sc, rT + 0.035, kcQ2)) {
      ctx.strokeStyle = D(L.tie); ctx.lineCap = 'butt'; ctx.lineWidth = Math.max(1.5, 0.06 * sc * kcQ[2]); ctx.beginPath(); ctx.moveTo(kcQ[0], kcQ[1]); ctx.lineTo(kcQ2[0], kcQ2[1]); ctx.stroke(); ctx.lineCap = 'round';
    }
    if (L.scarf) { ctx.strokeStyle = D(L.scarf); ctx.lineWidth = Math.max(2, 0.07 * sc * S.neck[2]); ctx.beginPath(); if (kcEll(ctx, c, P.neck[0], P.neck[1] + 0.01, P.neck[2], kcMul(kcV1, tor.F, 0.085 * sc), kcMul(kcV2, tor.S, 0.085 * sc))) ctx.stroke(); }
  } });
  // things carried
  kcBag(ctx, K, c, fig, parts, alpha * aCl, D);
  // the head, with whatever is on it
  parts.push({ z: S.head[3] - 0.02, f() {
    const hairFirst = camF >= 0, hc = L.hair, hcol = D(L.hair === 'white' ? '#e8e8e2' : L.hairCol || (hc === 'long' ? '#6b4a2b' : hc === 'bun' ? '#3a2a20' : hc === 'mohawk' ? '#e0413a' : '#7a5a3a'));
    const hairBack = () => {
      if (hc !== 'long' && hc !== 'bun') return;
      ctx.globalAlpha = alpha * aCl; ctx.fillStyle = hcol; ctx.strokeStyle = hcol;
      if (hc === 'long') {
        if (kcLocP(c, hd, 0, 0.015, -0.04 * sc, kcQ)) { ctx.beginPath(); ctx.arc(kcQ[0], kcQ[1], hr * 1.13, 0, TAU); ctx.fill(); }
        if (kcLocP(c, hd, 0, 0, -0.11 * sc, kcQ) && kcLocP(c, hd, 0, -0.3 * sc, -0.15 * sc, kcQ2)) { ctx.lineWidth = 0.2 * sc * kcQ[2]; ctx.beginPath(); ctx.moveTo(kcQ[0], kcQ[1]); ctx.lineTo(kcQ2[0], kcQ2[1]); ctx.stroke(); }
      } else if (kcLocP(c, hd, 0, 0.14 * sc, -0.13 * sc, kcQ)) { ctx.beginPath(); ctx.arc(kcQ[0], kcQ[1], 0.08 * sc * kcQ[2], 0, TAU); ctx.fill(); }
    };
    if (hairFirst) hairBack();
    ctx.globalAlpha = alpha * aInk; ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU); ctx.fill();
    if (!hairFirst) hairBack();
    ctx.globalAlpha = alpha * aCl;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(tilt);
    if (hc === 'short' || hc === 'white' || hc === 'bun' || hc === 'long') { ctx.fillStyle = hcol; ctx.beginPath(); ctx.arc(0, -hr * 0.06, hr * 1.05, Math.PI + 0.22, TAU - 0.22); ctx.closePath(); ctx.fill(); }
    else if (hc === 'mohawk') { ctx.fillStyle = hcol; ctx.beginPath(); ctx.ellipse(0, -hr * 0.95, hr * (0.25 + 0.6 * Math.abs(c.rx * hd.F[0] + c.rz * hd.F[2])), hr * 0.42, 0, 0, TAU); ctx.fill(); }
    if (L.mask) { ctx.fillStyle = D(L.mask); ctx.beginPath(); ctx.arc(0, 0, hr * 1.02, 0.25, Math.PI - 0.25); ctx.closePath(); ctx.fill(); }
    if (L.phones) { ctx.strokeStyle = D(L.phones); ctx.lineWidth = Math.max(1.5, 0.04 * sc * hs); ctx.beginPath(); ctx.arc(0, 0, hr * 1.12, Math.PI + 0.3, TAU - 0.3); ctx.stroke(); }
    ctx.restore();
    if (L.beard && kcLocP(c, hd, 0, -0.08 * sc, 0.07 * sc, kcQ)) { ctx.fillStyle = D(L.beard === true ? '#8a8f96' : L.beard); ctx.beginPath(); ctx.arc(kcQ[0], kcQ[1], hr * 0.66, 0, TAU); ctx.fill(); }
    if (L.glasses && camF > -0.25) {
      const sh = L.glasses === 'shades'; ctx.strokeStyle = D(sh ? '#f2f4f7' : '#cfd6de'); ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = Math.max(1, (sh ? 0.05 : 0.024) * sc * hs);
      const e0 = kcLocP(c, hd, 0.062 * sc, 0.03 * sc, 0.165 * sc, kcQ), e1 = kcLocP(c, hd, -0.062 * sc, 0.03 * sc, 0.165 * sc, kcQ2);
      if (e0 && e1) {
        if (sh) { ctx.beginPath(); ctx.moveTo(kcQ[0], kcQ[1]); ctx.lineTo(kcQ2[0], kcQ2[1]); ctx.stroke(); }
        else { const rr = Math.max(1.2, 0.045 * sc * hs), sq = Math.max(0.25, Math.abs(c.rz)); ctx.beginPath(); ctx.ellipse(kcQ[0], kcQ[1], rr * sq, rr, 0, 0, TAU); ctx.moveTo(kcQ2[0] + rr * sq, kcQ2[1]); ctx.ellipse(kcQ2[0], kcQ2[1], rr * sq, rr, 0, 0, TAU); ctx.moveTo(kcQ[0], kcQ[1]); ctx.lineTo(kcQ2[0], kcQ2[1]); ctx.stroke(); }
      }
    }
  } });
  parts.sort((p, q) => q.z - p.z);
  for (let i = 0; i < parts.length; i++) parts[i].f();
  kcHat(ctx, K, c, fig, alpha * aCl, D, tilt, ink);
  // where the round went in and came out
  if (K.hitT !== null && K.plan) {
    const pl = K.plan, fr = pl.part === 'head' ? hd : tor, bb = pl.part === 'head' ? pl.u0 : pl.b0;
    ctx.globalAlpha = alpha;
    for (let i = 0; i < 2; i++) {
      if (i === 1 && K.dmg.skin1 === undefined) break;
      kcLoc(fr, (i ? pl.sOut : pl.sIn) * fig.fs, bb, pl.c0, kcL0);
      if (!kcProj(c, kcL0[0], kcL0[1], kcL0[2], kcQ)) continue;
      // the way in is a small neat hole; the way out is larger and torn, far more so for a big round
      const r = Math.max(1.5, (i ? 0.01 + 0.04 * K.gx : 0.006 + 0.01 * K.gk) * kcQ[2]);
      if (K.gore) { ctx.fillStyle = '#8c1219'; ctx.beginPath(); ctx.arc(kcQ[0], kcQ[1], r * (1.3 + (i ? 0.5 * K.gx : 0.3 * K.gk)), 0, TAU); ctx.fill(); }
      ctx.fillStyle = K.gore ? '#3a0408' : '#0a1018'; ctx.beginPath();
      if (i) for (let j = 0, nj = 6 + Math.round(4 * K.gx); j < nj; j++) { const an = j * (TAU / nj) + kcHash(j + pl.c0 * 40) * 0.7, rr = r * (0.55 + 0.6 * kcHash(j * 3.7 + pl.sOut * 20)); ctx.moveTo(kcQ[0] + Math.cos(an) * r * 0.4 + rr, kcQ[1] + Math.sin(an) * r * 0.4); ctx.arc(kcQ[0] + Math.cos(an) * r * 0.4, kcQ[1] + Math.sin(an) * r * 0.4, rr, 0, TAU); }
      else ctx.arc(kcQ[0], kcQ[1], r, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
// A case, a bag, an umbrella: simple solids that turn with the camera.
function kcBag(ctx, K, c, fig, parts, al, D) {
  const L = fig.look, P = fig.P, S = fig.S, sc = fig.sc, bag = L.bag, tor = fig.tor;
  if (!bag) return;
  const blob = (x, y, z, a, b, d, col, zb) => parts.push({ z: zb, f() { ctx.globalAlpha = al; ctx.fillStyle = col; ctx.beginPath(); if (kcEll(ctx, c, x, y, z, a, b, d)) ctx.fill(); } });
  // a box drawn as the outline of its eight corners (they are sorted round their middle)
  const box = (x, y, z, hx, hy, hz, col, zb) => parts.push({ z: zb, f() {
    const pts = []; let mx = 0, my = 0;
    for (let i = 0; i < 8; i++) { if (!kcProj(c, x + (i & 1 ? hx : -hx), y + (i & 2 ? hy : -hy), z + (i & 4 ? hz : -hz), kcQ)) return; pts.push([kcQ[0], kcQ[1]]); mx += kcQ[0] / 8; my += kcQ[1] / 8; }
    // gift wrapping: walk round the outside of the points
    let st = 0; for (let i = 1; i < 8; i++) if (pts[i][0] < pts[st][0]) st = i;
    ctx.globalAlpha = al; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(pts[st][0], pts[st][1]);
    let cur = st, guard = 0;
    do { let nx = (cur + 1) % 8; for (let i = 0; i < 8; i++) { const cr = (pts[nx][0] - pts[cur][0]) * (pts[i][1] - pts[cur][1]) - (pts[nx][1] - pts[cur][1]) * (pts[i][0] - pts[cur][0]); if (cr < 0) nx = i; } cur = nx; ctx.lineTo(pts[cur][0], pts[cur][1]); } while (cur !== st && guard++ < 9);
    ctx.closePath(); ctx.fill();
  } });
  const h = P.haR, zh = S.haR ? S.haR[3] : 0;
  if (bag === 'case') box(h[0], h[1] - 0.17 * sc, h[2], 0.2 * sc, 0.13 * sc, 0.055 * sc, D(L.bagCol || '#7b5a36'), zh - 0.05);
  else if (bag === 'shopping') box(h[0], h[1] - 0.22, h[2], 0.15, 0.17, 0.06, D(L.bagCol || '#e9e2d0'), zh - 0.05);
  else if (bag === 'duffel') blob(h[0], h[1] - 0.2 * sc, h[2], kcSet([0, 0, 0], 0.34 * sc, 0, 0), kcSet([0, 0, 0], 0, 0.16 * sc, 0), kcSet([0, 0, 0], 0, 0, 0.15 * sc), D(L.bagCol || '#3f4a5c'), zh - 0.05);
  else if (bag === 'box' || bag === 'paper' || bag === 'clip') { const m = [(P.haL[0] + P.haR[0]) / 2, (P.haL[1] + P.haR[1]) / 2]; if (bag === 'box') box(m[0], m[1] + 0.1, 0, 0.24, 0.18, 0.2, D(L.bagCol || '#b08a52'), S.sh[3] - 0.3 * kcDot(tor.F, c.fx, c.fy, c.fz)); else box(m[0], m[1] + 0.1, 0, 0.03, 0.15, 0.2, D(bag === 'paper' ? '#e9e6dc' : L.bagCol || '#e7e2d4'), S.sh[3] - 0.3 * kcDot(tor.F, c.fx, c.fy, c.fz)); }
  else if (bag === 'backpack') { const q = kcLoc(tor, 0, tor.L * 0.62, -0.17 * sc, [0, 0, 0]); blob(q[0], q[1], q[2], kcMul([0, 0, 0], tor.F, 0.1 * sc), kcMul([0, 0, 0], tor.U, 0.22 * sc), kcMul([0, 0, 0], tor.S, 0.16 * sc), D(L.bagCol || '#5d6b4a'), (S.sh[3] + S.hip[3]) / 2 + 0.17 * kcDot(tor.F, c.fx, c.fy, c.fz)); }
  else if (bag === 'umbrella') parts.push({ z: zh - 0.3, f() {
    if (!kcProj(c, h[0], h[1], h[2], kcQ) || !kcProj(c, h[0], 2.2 * sc, h[2], kcQ2)) return;
    ctx.globalAlpha = al; ctx.strokeStyle = D('#22252b'); ctx.lineWidth = Math.max(1, 0.03 * kcQ[2]); ctx.beginPath(); ctx.moveTo(kcQ[0], kcQ[1]); ctx.lineTo(kcQ2[0], kcQ2[1]); ctx.stroke();
    const r = 0.62 * sc * kcQ2[2], x = kcQ2[0], y = kcQ2[1]; ctx.fillStyle = D(L.bagCol || '#c0392b');
    ctx.beginPath(); ctx.arc(x, y, r, Math.PI, TAU); ctx.ellipse(x, y, r, r * Math.max(0.05, Math.abs(Math.sin(c.pitch))), 0, 0, Math.PI); ctx.closePath(); ctx.fill();
  } });
  else if (bag === 'cane') parts.push({ z: zh, f() { if (kcProj(c, h[0], h[1], h[2], kcQ) && kcProj(c, h[0] + fig.fs * 0.12, 0.02, h[2], kcQ2)) { ctx.globalAlpha = al; ctx.strokeStyle = D(L.bagCol || '#d8d2c4'); ctx.lineWidth = Math.max(1, 0.035 * kcQ[2]); ctx.beginPath(); ctx.moveTo(kcQ[0], kcQ[1]); ctx.lineTo(kcQ2[0], kcQ2[1]); ctx.stroke(); } } });
}
// Hats: a brim (a flat disc), a crown (a drum or a dome), sometimes a peak. After the hit the
// hat comes off, as it does in the scope view.
function kcHat(ctx, K, c, fig, al, D, tilt, ink) {
  const L = fig.look, hat = L.hat; if (!hat) return;
  const hd = fig.hd, P = fig.P, sc = fig.sc, hr0 = fig.hr;
  if (!K.hat) K.hat = { fly: 0 };
  if (K.hitT !== null && !K.hat.fly && hat !== 'hood' && (K.plan.part === 'head' || K.T - K.hitT > 0.5)) K.hat.fly = K.T;
  // once loose it lifts off and turns, in the same slow time as the spray
  let ox = 0, oy = 0, oz = 0, rot = 0;
  if (K.hat.fly) { const t = (K.T - K.hat.fly) * 0.3, hp = K.plan.part === 'head' ? 1 : 0.45; ox = K.side * 0.25 * t * hp; oy = (2.6 * t - 4.9 * t * t) * hp; oz = K.dir[2] * 1.6 * t * hp; rot = t * 3.2 * hp * K.side; }
  kcLoc(hd, 0, hr0 * 0.62, 0, kcL1); const bx = kcL1[0] + ox, by = kcL1[1] + oy, bz = kcL1[2] + oz;
  if (!kcProj(c, bx, by, bz, kcQ)) return;
  const x = kcQ[0], y = kcQ[1], s = kcQ[2] * sc, col = D(L.hatCol || '#2a2d33'), sq = Math.max(0.06, Math.abs(Math.sin(c.pitch)) + 0.04); // how open a flat ring looks from this height
  const camF = hd.F[0] * c.rx + hd.F[2] * c.rz; // which way "forward" points across the screen
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt + rot); ctx.globalAlpha = al; ctx.fillStyle = col; ctx.strokeStyle = col;
  const brim = (r) => { ctx.beginPath(); ctx.ellipse(0, 0, r * s, Math.max(1.2, r * s * sq), 0, 0, TAU); ctx.fill(); };
  const drum = (r, h, r2) => { ctx.beginPath(); ctx.moveTo(-r * s, 0); ctx.lineTo(-(r2 || r) * s, -h * s); ctx.ellipse(0, -h * s, (r2 || r) * s, (r2 || r) * s * sq, 0, Math.PI, TAU); ctx.lineTo(r * s, 0); ctx.ellipse(0, 0, r * s, r * s * sq, 0, 0, Math.PI); ctx.closePath(); ctx.fill(); };
  const dome = (r, dy) => { ctx.beginPath(); ctx.arc(0, (dy || 0) * s, r * s, Math.PI, TAU); ctx.ellipse(0, (dy || 0) * s, r * s, r * s * sq, 0, 0, Math.PI); ctx.closePath(); ctx.fill(); };
  const peak = (len, dy) => { ctx.lineWidth = Math.max(1.5, 0.045 * s); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, (dy || 0) * s); ctx.lineTo(camF * len * s, (dy || 0) * s + 0.02 * s); ctx.stroke(); };
  const band = (r, y0, h) => { if (L.hatBand) { ctx.fillStyle = D(L.hatBand); ctx.fillRect(-r * s, -(y0 + h) * s, r * 2 * s, h * s); ctx.fillStyle = col; } };
  if (hat === 'fedora') { brim(0.3); drum(0.17, 0.19, 0.15); band(0.166, 0.015, 0.05); }
  else if (hat === 'tophat') { brim(0.26); drum(0.15, 0.3); band(0.15, 0.02, 0.05); }
  else if (hat === 'sun') { brim(0.38); dome(0.16, 0); band(0.155, 0, 0.04); }
  else if (hat === 'cap') { dome(0.177, 0.03); peak(0.3, 0.02); }
  else if (hat === 'peaked') { drum(0.17, 0.1, 0.2); peak(0.27, 0.02); }
  else if (hat === 'hardhat') { dome(0.187, 0.05); brim(0.23); }
  else if (hat === 'beanie') { dome(0.184, 0.07); ctx.beginPath(); ctx.arc(0, -0.09 * s, 0.045 * s, 0, TAU); ctx.fill(); }
  else if (hat === 'helmet') dome(0.197, 0.09);
  else if (hat === 'beret') { ctx.beginPath(); ctx.ellipse(-camF * 0.04 * s, -0.02 * s, 0.21 * s, 0.08 * s, -camF * 0.2, 0, TAU); ctx.fill(); }
  else if (hat === 'hood') { // a ball of cloth round the head, open at the face
    const toCam = -kcDot(hd.F, c.fx, c.fy, c.fz);
    ctx.beginPath(); ctx.arc(-camF * 0.03 * s, 0.105 * s, 0.204 * s, 0, TAU); ctx.fill();
    if (toCam > -0.35) { ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(camF * 0.085 * s, 0.11 * s, 0.11 * s * (0.3 + 0.7 * Math.max(0, toCam)), 0.115 * s, 0, 0, TAU); ctx.fill(); }
  }
  ctx.restore(); ctx.globalAlpha = 1;
}

// ---- the inside --------------------------------------------------------------------------------
// Skeleton and organs, each sorted by distance so nearer things cover farther ones and the
// whole lot turns properly with the camera. With gore off only the skeleton is drawn, in one
// cold colour.
function kcInnards(ctx, K, c, fig, al) {
  const tor = fig.tor, hd = fig.hd, P = fig.P, S = fig.S, sc = fig.sc, bw = fig.bw, fs = fig.fs, pl = K.plan, T = K.T, dmg = K.dmg, L = tor.L;
  const bone = K.gore ? '#efe7d2' : '#d9ecfa', boneD = K.gore ? '#b9ad94' : '#8fb1cc', dark = K.gore ? '#1c0a0b' : '#06101a';
  const items = [];
  const age = (k) => (dmg[k] === undefined ? -1 : T - dmg[k]);
  // how much further from us a point is for each metre along the trunk's side and front axes
  const dA = kcDot(tor.S, c.fx, c.fy, c.fz), dC = kcDot(tor.F, c.fx, c.fy, c.fz);
  const zAt = (a, b, cc) => { kcLoc(tor, a, b, cc, kcL0); return (kcL0[0] - c.x) * c.fx + (kcL0[1] - c.y) * c.fy + (kcL0[2] - c.z) * c.fz; };
  const z0 = zAt(0, L * 0.6, 0);
  if (!kcProj(c, P.sh[0], P.sh[1], P.sh[2], kcQ)) return;
  const ps = kcQ[2] * sc; // pixels per metre at the chest, times the figure's size
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // ---- ribs: each one a hoop from the spine round to the breastbone, cut into short pieces.
  // Pieces on the far side of the chest are drawn dim and early, near ones bright and late.
  const ribs = (wantNear) => {
    const aIn = age('ribIn'), aOut = age('ribOut');
    ctx.strokeStyle = wantNear ? bone : boneD; ctx.lineWidth = Math.max(1.2, 0.0125 * ps); ctx.globalAlpha = al * (wantNear ? 0.96 : 0.6);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const b = L * (0.47 + 0.058 * i), wa = kcRibW[i] * sc * bw, amax = (i === 0 ? 0.6 : i === 1 ? 0.78 : 0.96) * Math.PI;
      const hitRow = pl.part === 'torso' && pl.ribAl !== undefined && Math.abs(b - pl.b0) < 0.036 * sc;
      for (let sg = -1; sg <= 1; sg += 2) {
        // the ribs on the side the round comes in at are the person's right if they face right
        const brk = hitRow ? (sg === -fs ? aIn : aOut) : -1, bend = brk >= 0 ? 0.04 * sc * easeOut(brk / 0.25) : 0;
        let pen = false;
        for (let j = 0; j <= 9; j++) {
          const an = (j / 9) * amax, sa = Math.sin(an), ca = Math.cos(an);
          let a = sg * (0.012 * sc + wa * sa); const cc = -ca * (an < Math.PI / 2 ? 0.068 : 0.085) * sc - 0.012 * sc, bb = b - 0.045 * sc * Math.pow(Math.sin(an * 0.5), 2);
          if (brk >= 0) { const da = Math.abs(an - pl.ribAl); if (da < 0.21) { pen = false; continue; } a += fs * bend * Math.max(0, 1 - da / 0.75); } // snapped: a gap, and the ends pushed the way the round went
          const near = a * dA + cc * dC < 0;
          kcLoc(tor, a, bb, cc, kcL0);
          if (!kcProj(c, kcL0[0], kcL0[1], kcL0[2], kcQ)) { pen = false; continue; }
          if (pen && near === wantNear) ctx.lineTo(kcQ[0], kcQ[1]); else ctx.moveTo(kcQ[0], kcQ[1]);
          pen = true;
        }
      }
    }
    ctx.stroke();
  };
  items.push({ z: z0 + 0.09, f() { ribs(false); } }, { z: z0 - 0.09, f() { ribs(true); } });

  // ---- spine: a stack of blocks from the pelvis to the skull
  items.push({ z: zAt(0, L * 0.6, -0.06 * sc), f() {
    const aS = age('spine'), aC = age('spineC'), n = 15, gap = (L * 0.99) / (n - 1);
    const iB = aS >= 0 ? clamp(Math.round((pl.b0 - L * 0.03) / gap), 0, n - 1) : -1;
    ctx.lineCap = 'butt'; ctx.globalAlpha = al;
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? bone : boneD; ctx.lineWidth = Math.max(1, (pass ? 0.042 : 0.012) * ps); ctx.beginPath();
      for (let i = 0; i < n + 3; i++) {
        let b = L * 0.03 + i * gap, a = 0, cc = -0.032 * sc, fr = tor;
        if (i >= n) { // neck bones: a short run from the top of the trunk into the head
          const k = (i - n + 1) / 4; fr = null;
          kcLoc(tor, 0, tor.L, -0.03 * sc, kcL1); kcLoc(hd, 0, -0.1 * sc, -0.02 * sc, kcV3);
          kcSet(kcL0, lerp(kcL1[0], kcV3[0], k), lerp(kcL1[1], kcV3[1], k), lerp(kcL1[2], kcV3[2], k));
          if (aC >= 0 && i === n + 1) continue;
          if (aC >= 0) kcL0[2] += (i > n + 1 ? 0.014 : -0.008) * sc * easeOut(aC / 0.3);
        } else {
          if (i === iB) continue; // the one that was hit is gone: it is flying about as splinters
          if (iB >= 0 && Math.abs(i - iB) === 1) a = fs * 0.012 * sc * easeOut(aS / 0.3) * (i > iB ? 1 : -0.6);
          kcLoc(tor, a, b, cc, kcL0);
        }
        const Uv = fr ? tor.U : hd.U, Sv = tor.S, hh = gap * 0.34, ww = 0.036 * sc;
        if (pass) { if (kcProj(c, kcL0[0] - Uv[0] * hh, kcL0[1] - Uv[1] * hh, kcL0[2] - Uv[2] * hh, kcQ) && kcProj(c, kcL0[0] + Uv[0] * hh, kcL0[1] + Uv[1] * hh, kcL0[2] + Uv[2] * hh, kcQ2)) { ctx.moveTo(kcQ[0], kcQ[1]); ctx.lineTo(kcQ2[0], kcQ2[1]); } }
        else if (kcProj(c, kcL0[0] - Sv[0] * ww, kcL0[1] - Sv[1] * ww, kcL0[2] - Sv[2] * ww, kcQ) && kcProj(c, kcL0[0] + Sv[0] * ww, kcL0[1] + Sv[1] * ww, kcL0[2] + Sv[2] * ww, kcQ2)) { ctx.moveTo(kcQ[0], kcQ[1]); ctx.lineTo(kcQ2[0], kcQ2[1]); } // the little wings each side
      }
      ctx.stroke();
    }
    ctx.lineCap = 'round';
  } });

  // ---- breastbone, collar bones, shoulder blades
  items.push({ z: zAt(0, L * 0.75, 0.085 * sc), f() {
    ctx.globalAlpha = al; ctx.strokeStyle = bone; ctx.lineWidth = Math.max(1.5, 0.021 * ps);
    ctx.beginPath(); kcRun(ctx, c, tor, [0, L * 0.6 / sc, 0.073, 0, L * 0.88 / sc, 0.068], sc, 1); ctx.stroke();
    ctx.lineWidth = Math.max(1.2, 0.015 * ps); ctx.beginPath();
    const bS = age(fs > 0 ? 'shIn' : 'shOut') >= 0, bS2 = age(fs > 0 ? 'shOut' : 'shIn') >= 0; // which collar bone the round broke (right is the near one if facing right)
    for (let sg = -1; sg <= 1; sg += 2) {
      const br = sg < 0 ? bS : bS2, w = fig.ws / sc;
      if (br) { kcRun(ctx, c, tor, [0.02, L * 0.9 / sc, 0.066, w * 0.5, L * 0.935 / sc, 0.05], sc, sg); kcRun(ctx, c, tor, [w * 0.62, L * 0.9 / sc, 0.03, w, L * 0.93 / sc, 0.005], sc, sg); }
      else kcRun(ctx, c, tor, [0.02, L * 0.9 / sc, 0.066, w * 0.55, L * 0.945 / sc, 0.045, w, L * 0.95 / sc, 0.005], sc, sg);
    }
    ctx.stroke();
  } });
  items.push({ z: zAt(0, L * 0.78, -0.09 * sc), f() {
    ctx.globalAlpha = al * 0.7; ctx.strokeStyle = boneD; ctx.fillStyle = rgba(boneD, 0.22); ctx.lineWidth = Math.max(1, 0.014 * ps);
    for (let sg = -1; sg <= 1; sg += 2) { ctx.beginPath(); kcRun(ctx, c, tor, [0.055, L * 0.9 / sc, -0.08, 0.15 * bw, L * 0.9 / sc, -0.06, 0.09, L * 0.6 / sc, -0.085], sc, sg, true); ctx.fill(); ctx.stroke(); }
  } });

  // ---- pelvis: two wings and the wedge of bone between them
  items.push({ z: zAt(0, 0.04 * sc, 0), f() {
    ctx.globalAlpha = al; ctx.strokeStyle = bone; ctx.fillStyle = rgba(bone, 0.16); ctx.lineWidth = Math.max(1.4, 0.017 * ps);
    const wing = [0.03, 0.1, -0.045, 0.09, 0.125, -0.02, 0.125, 0.1, 0.02, 0.118, 0.04, 0.045, 0.085, -0.01, 0.05, 0.045, -0.055, 0.065, 0.012, -0.06, 0.07, 0.05, -0.075, 0.03, 0.07, -0.02, -0.01, 0.03, 0.03, -0.05];
    for (let sg = -1; sg <= 1; sg += 2) {
      const br = age(sg === -fs ? 'pelvIn' : 'pelvOut');
      ctx.beginPath();
      if (br >= 0) { const sh = 0.016 * easeOut(br / 0.3); kcRun(ctx, c, tor, wing.slice(0, 12), sc * bw, sg); kcRun(ctx, c, tor, wing.slice(12).map((v, i) => (i % 3 === 1 ? v - sh : i % 3 === 0 ? v + sh * 0.6 : v)), sc * bw, sg); ctx.stroke(); }
      else { kcRun(ctx, c, tor, wing, sc * bw, sg, true); ctx.fill(); ctx.stroke(); }
    }
    ctx.beginPath(); kcRun(ctx, c, tor, [-0.03, 0.1, -0.05, 0.03, 0.1, -0.05, 0, -0.03, -0.06], sc, 1, true); ctx.fill(); ctx.stroke();
  } });

  // ---- arms and legs: one bone above the joint, two thin ones below, a knob at each joint
  const limb = (a, b, d, wU, brU, brF) => items.push({ z: (S[a][3] + S[b][3] + S[d][3]) / 3 - 0.01, f() {
    const s = (S[a][2] + S[b][2]) / 2 * sc, aU = age(brU), aF = age(brF);
    ctx.globalAlpha = al; ctx.strokeStyle = bone; ctx.fillStyle = bone;
    // a broken bone is drawn as two pieces knocked out of line
    const piece = (p, q, br, w) => {
      ctx.lineWidth = Math.max(1.3, w * s); ctx.beginPath();
      if (br >= 0) { const k = 0.07 * s * easeOut(br / 0.25), mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, dx = (q[1] - p[1]) / (Math.hypot(q[0] - p[0], q[1] - p[1]) || 1), dy = -(q[0] - p[0]) / (Math.hypot(q[0] - p[0], q[1] - p[1]) || 1);
        ctx.moveTo(p[0], p[1]); ctx.lineTo(mx - (q[0] - p[0]) * 0.06 + dx * k, my - (q[1] - p[1]) * 0.06 + dy * k); ctx.moveTo(mx + (q[0] - p[0]) * 0.06 - dx * k * 0.6, my + (q[1] - p[1]) * 0.06 - dy * k * 0.6); ctx.lineTo(q[0], q[1]);
      } else { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); }
      ctx.stroke();
    };
    piece(S[a], S[b], aU, wU);
    const ox = (S[d][1] - S[b][1]), oy = -(S[d][0] - S[b][0]), ol = Math.hypot(ox, oy) || 1, off = 0.009 * s;
    piece([S[b][0] + (ox / ol) * off, S[b][1] + (oy / ol) * off], [S[d][0] + (ox / ol) * off, S[d][1] + (oy / ol) * off], aF, wU * 0.5);
    piece([S[b][0] - (ox / ol) * off, S[b][1] - (oy / ol) * off], [S[d][0] - (ox / ol) * off, S[d][1] - (oy / ol) * off], aF, wU * 0.5);
    ctx.beginPath(); ctx.arc(S[a][0], S[a][1], Math.max(1.5, wU * 0.8 * s), 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(S[b][0], S[b][1], Math.max(1.5, wU * 0.75 * s), 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(S[d][0], S[d][1], Math.max(1.3, wU * 0.7 * s), 0, TAU); ctx.fill();
  } });
  limb('shL', 'elL', 'haL', 0.019, 'armLU', 'armLF'); limb('shR', 'elR', 'haR', 0.019, 'armRU', 'armRF');
  limb('hpL', 'knL', 'ftL', 0.023, '', ''); limb('hpR', 'knR', 'ftR', 0.023, '', '');

  // ---- organs: egg shapes that swell and tear when the round reaches them
  if (K.gore) {
    for (let i = 0; i < kcOrgans.length; i++) {
      const g = kcOrgans[i];
      items.push({ z: zAt(g.a * sc * bw, g.b * L, g.c * sc), f() {
        const ag = age(g.id), beat = g.id === 'heart' && ag < 0 ? 0.05 * Math.pow(Math.max(0, Math.sin(T * 5.2)), 6) : 0;
        const sw = ag >= 0 ? 0.3 * Math.exp(-ag * 3.2) * (0.6 + 0.4 * Math.cos(ag * 16)) - 0.07 * smooth(ag / 0.9) : beat, k = sc * (1 + sw);
        kcLoc(tor, g.a * sc * bw, g.b * L, g.c * sc, kcL1);
        kcMul(kcV1, tor.S, g.ra * bw * k); kcMul(kcV2, tor.U, g.rb * k * (ag >= 0 && g.id.charAt(0) === 'l' ? 1 - 0.12 * smooth(ag / 1.2) : 1)); kcMul(kcV3, tor.F, g.rc * k);
        ctx.globalAlpha = al; ctx.beginPath(); if (!kcEll(ctx, c, kcL1[0], kcL1[1], kcL1[2], kcV1, kcV2, kcV3)) return;
        ctx.fillStyle = ag >= 0 ? mix(g.col, '#ff5a4a', 0.75 * Math.exp(-ag * 4)) : g.col; ctx.fill();
        ctx.strokeStyle = 'rgba(40,6,10,0.55)'; ctx.lineWidth = 1; ctx.stroke();
        const cx = kcQ[0], cy = kcQ[1], ra = kcE[0], rb = kcE[1], an = kcE[2];
        ctx.fillStyle = g.hi; ctx.globalAlpha = al * 0.55; ctx.beginPath(); ctx.ellipse(cx - rb * 0.22, cy - rb * 0.28, ra * 0.5, rb * 0.42, an, 0, TAU); ctx.fill();
        if (g.id === 'heart') { ctx.globalAlpha = al; ctx.strokeStyle = g.col; ctx.lineWidth = Math.max(1.5, 0.018 * ps); ctx.beginPath(); kcRun(ctx, c, tor, [0.012, g.b * L / sc + 0.045, 0.03, 0.0, g.b * L / sc + 0.085, 0.02, -0.02, g.b * L / sc + 0.095, 0.0], sc, 1); ctx.stroke(); }
        if (ag >= 0) { // the tear along the round's line
          kcLoc(tor, g.a * sc * bw, pl.b0, pl.c0, kcL1); kcMul(kcV1, tor.S, g.ra * sc * bw * 0.95 * easeOut(ag / 0.2)); kcMul(kcV2, tor.U, 0.016 * sc * (0.5 + easeOut(ag / 0.4)));
          ctx.globalAlpha = al; ctx.fillStyle = '#35040a'; ctx.beginPath(); if (kcEll(ctx, c, kcL1[0], kcL1[1], kcL1[2], kcV1, kcV2)) ctx.fill();
        }
      } });
    }
    // the gut: one long tube folded back and forth
    items.push({ z: zAt(0, L * 0.18, 0.03 * sc), f() {
      const ag = age('gut'), pts = [];
      for (let i = 0; i <= 24; i++) { const r = Math.floor(i / 5), u = (i % 5) / 4; pts.push((r % 2 ? 1 - u : u) * 0.17 - 0.085 + (ag >= 0 ? 0.008 * Math.sin(i * 2.1) * easeOut(ag / 0.4) : 0), (L / sc) * (0.29 - r * 0.052) - (u === 0 || u === 1 ? 0.012 : 0), 0.03); }
      ctx.globalAlpha = al; ctx.strokeStyle = '#8f5a4c'; ctx.lineWidth = Math.max(2, 0.036 * ps); ctx.beginPath(); kcRun(ctx, c, tor, pts, sc * bw, 1); ctx.stroke();
      ctx.strokeStyle = ag >= 0 ? mix('#cf9580', '#ff5a4a', 0.6 * Math.exp(-ag * 4)) : '#cf9580'; ctx.lineWidth = Math.max(1.2, 0.024 * ps); ctx.stroke();
      if (ag >= 0) { kcLoc(tor, 0, pl.b0, pl.c0, kcL1); kcMul(kcV1, tor.S, 0.09 * sc * easeOut(ag / 0.25)); kcMul(kcV2, tor.U, 0.02 * sc); ctx.fillStyle = '#35040a'; ctx.beginPath(); if (kcEll(ctx, c, kcL1[0], kcL1[1], kcL1[2], kcV1, kcV2)) ctx.fill(); }
    } });
  }
  items.push({ z: S.head[3], f() { kcSkull(ctx, K, c, fig, al, bone, boneD, dark); } });
  items.sort((p, q) => q.z - p.z);
  for (let i = 0; i < items.length; i++) items[i].f();
  ctx.globalAlpha = 1;
}
// The skull: a dome, eye sockets and a jaw, with the brain inside. A head shot cracks it along
// lines that spread from where the round went in and came out, and knocks a plate off the far side.
function kcSkull(ctx, K, c, fig, al, bone, boneD, dark) {
  const hd = fig.hd, sc = fig.sc, fs = fig.fs, pl = K.plan, T = K.T, dmg = K.dmg;
  const age = (k) => (dmg[k] === undefined ? -1 : T - dmg[k]);
  const cx3 = hd.o[0] + hd.U[0] * 0.018 * sc, cy3 = hd.o[1] + hd.U[1] * 0.018 * sc, cz3 = hd.o[2] + hd.U[2] * 0.018 * sc, rs = 0.142 * sc;
  if (!kcProj(c, cx3, cy3, cz3, kcQ)) return;
  const x = kcQ[0], y = kcQ[1], s = kcQ[2], R = rs * s;
  const camF = kcDot(hd.F, c.x - cx3, c.y - cy3, c.z - cz3) / (Math.hypot(c.x - cx3, c.y - cy3, c.z - cz3) || 1); // 1 = looking straight at the face
  const aIn = age('skullIn'), aOut = age('skullOut'), aBr = age('brain'), head = pl.part === 'head';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // the brain first, since the skull is drawn round it
  if (K.gore) {
    const sw = aBr >= 0 ? 0.26 * Math.exp(-aBr * 3) * (0.6 + 0.4 * Math.cos(aBr * 15)) : 0;
    kcMul(kcV1, hd.S, 0.105 * sc * (1 + sw * 1.6)); kcMul(kcV2, hd.U, 0.085 * sc * (1 - sw * 0.4)); kcMul(kcV3, hd.F, 0.115 * sc);
    const bz = aBr >= 0 ? 0.012 * sc * smooth(aBr / 0.3) : 0; // pushed toward the way out
    ctx.globalAlpha = al; ctx.beginPath();
    if (kcEll(ctx, c, hd.o[0] + hd.U[0] * 0.03 * sc + hd.S[0] * bz * fs, hd.o[1] + hd.U[1] * 0.03 * sc + hd.S[1] * bz * fs, hd.o[2] + hd.U[2] * 0.03 * sc + hd.S[2] * bz * fs, kcV1, kcV2, kcV3)) {
      ctx.fillStyle = aBr >= 0 ? mix('#d9979f', '#ff5a4a', 0.7 * Math.exp(-aBr * 4)) : '#d9979f'; ctx.fill();
      const bx = kcQ[0], by = kcQ[1], ra = kcE[0], rb = kcE[1], an = kcE[2];
      // the folds: a split down the middle and a few curls each side
      ctx.strokeStyle = '#a8626f'; ctx.lineWidth = Math.max(1, 0.01 * s * sc);
      ctx.save(); ctx.translate(bx, by); ctx.rotate(an); ctx.beginPath();
      const sq = Math.abs(camF) * 0.9 + 0.1; ctx.moveTo(0, -rb * 0.95); ctx.quadraticCurveTo(ra * 0.08 * sq, 0, 0, rb * 0.9);
      for (let i = -1; i <= 1; i += 2) for (let j = 0; j < 3; j++) { const px = i * ra * (0.3 + 0.22 * j), py = rb * (-0.45 + 0.4 * j); ctx.moveTo(px - ra * 0.14, py); ctx.quadraticCurveTo(px, py - rb * 0.28, px + ra * 0.14, py + rb * 0.05); }
      ctx.stroke(); ctx.restore();
      ctx.fillStyle = '#f0bcc0'; ctx.globalAlpha = al * 0.45; ctx.beginPath(); ctx.ellipse(bx - rb * 0.2, by - rb * 0.32, ra * 0.42, rb * 0.3, an, 0, TAU); ctx.fill();
      if (aBr >= 0) { kcLoc(hd, 0, pl.u0, pl.c0, kcL1); kcMul(kcV1, hd.S, 0.1 * sc * easeOut(aBr / 0.2)); kcMul(kcV2, hd.U, 0.016 * sc * (0.5 + easeOut(aBr / 0.4))); ctx.globalAlpha = al; ctx.fillStyle = '#35040a'; ctx.beginPath(); if (kcEll(ctx, c, kcL1[0], kcL1[1], kcL1[2], kcV1, kcV2)) ctx.fill(); }
    }
  }
  // the dome
  ctx.globalAlpha = al; ctx.fillStyle = rgba(bone, 0.2); ctx.strokeStyle = bone; ctx.lineWidth = Math.max(1.6, 0.014 * s * sc);
  ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill(); ctx.stroke();
  // face: sockets, nose, teeth. Only when we are on the face side; they narrow as it turns away.
  const pt = (a, u, f, out) => { kcLoc(hd, a * sc, u * sc, f * sc, kcL0); return kcProj(c, kcL0[0], kcL0[1], kcL0[2], out); };
  if (camF > 0.12) {
    ctx.fillStyle = dark; ctx.globalAlpha = al * Math.min(1, camF * 2);
    for (let sg = -1; sg <= 1; sg += 2) { ctx.beginPath(); kcLoc(hd, sg * 0.052 * sc, 0.012 * sc, 0.118 * sc, kcL1); if (kcEll(ctx, c, kcL1[0], kcL1[1], kcL1[2], kcMul(kcV1, hd.S, 0.034 * sc), kcMul(kcV2, hd.U, 0.03 * sc))) ctx.fill(); }
    if (pt(0, -0.035, 0.14, kcQ) && pt(0.016, -0.07, 0.132, kcQ2)) { ctx.beginPath(); ctx.moveTo(kcQ[0], kcQ[1]); ctx.lineTo(kcQ2[0], kcQ2[1]); if (pt(-0.016, -0.07, 0.132, kcQ2)) ctx.lineTo(kcQ2[0], kcQ2[1]); ctx.closePath(); ctx.fill(); }
  }
  // the jaw: a U of bone hinged below each ear
  ctx.globalAlpha = al; ctx.strokeStyle = bone; ctx.lineWidth = Math.max(1.4, 0.016 * s * sc);
  const jIn = age('jawIn'), jOut = age('jawOut'), jaw = [0.108, -0.045, 0.0, 0.1, -0.118, 0.015, 0.045, -0.165, 0.1, -0.045, -0.165, 0.1, -0.1, -0.118, 0.015, -0.108, -0.045, 0.0];
  if (jIn >= 0 || jOut >= 0) { // broken: each half swings away on its own
    for (let hf = 0; hf < 2; hf++) { const br = (hf === 0) === (fs < 0) ? jIn : jOut, k = br >= 0 ? easeOut(br / 0.3) : 0, part = jaw.slice(hf * 9, hf * 9 + 9).map((v, i) => (i % 3 === 1 ? v - 0.022 * k : i % 3 === 0 ? v + (hf ? -1 : 1) * 0.02 * k : v)); ctx.beginPath(); kcRun(ctx, c, hd, part, sc, 1); ctx.stroke(); }
  } else { ctx.beginPath(); kcRun(ctx, c, hd, jaw, sc, 1); ctx.stroke(); }
  if (camF > -0.3) { ctx.lineWidth = Math.max(1, 0.012 * s * sc); ctx.beginPath(); kcRun(ctx, c, hd, [0.05, -0.1, 0.112, 0, -0.105, 0.128, -0.05, -0.1, 0.112], sc, 1); ctx.stroke(); }
  // ---- cracks. Each is a wandering line over the dome, kept as directions from the skull's
  // middle (so it turns with the head) and drawn a little further every frame.
  if (head && pl.chord && aIn >= 0) {
    if (!pl.cracks) {
      pl.cracks = [];
      const R2 = makeRng(Math.round(pl.u0 * 9001 + pl.c0 * 7001) + 77), uc = (pl.u0 - 0.018 * sc) / rs, cc = pl.c0 / rs;
      for (let e = 0; e < 2; e++) {
        const a0 = (e ? 1 : -1) * Math.sqrt(Math.max(0.05, 1 - uc * uc - cc * cc)) * fs; // entry on the near side, exit on the far side
        for (let k = 0; k < 9; k++) {
          const th = (k / 9) * TAU + R2.f(), len = 5 + Math.floor(R2.f() * 6); let n = [a0, uc, cc], tu = Math.cos(th), tf = Math.sin(th); const line = [n[0], n[1], n[2]];
          for (let j = 0; j < len; j++) { // each step turns sharply: bone breaks in straight runs and corners, not curves
            tu += (R2.f() - 0.5) * 1.7; tf += (R2.f() - 0.5) * 1.7; const tl = Math.hypot(tu, tf) || 1; tu /= tl; tf /= tl;
            const st = 0.09 + R2.f() * 0.09; n = [n[0] + (e ? -1 : 1) * fs * st * 0.5, n[1] + tu * st, n[2] + tf * st]; const l = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / l, n[1] / l, n[2] / l]; line.push(n[0], n[1], n[2]);
          }
          pl.cracks.push({ e, line });
        }
      }
    }
    for (let i = 0; i < pl.cracks.length; i++) {
      const cr = pl.cracks[i], ag = cr.e ? aOut : aIn; if (ag < 0) continue;
      const nseg = cr.line.length / 3 - 1, grow = clamp(ag / 0.5, 0, 1) * nseg;
      ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? dark : rgba(bone, 0.5); ctx.lineWidth = pass ? Math.max(1.1, 0.0055 * s * sc) : Math.max(2.2, 0.013 * s * sc); ctx.beginPath();
        let pen = false;
        for (let j = 0; j <= Math.min(nseg, Math.ceil(grow)); j++) {
          let a = cr.line[j * 3], u = cr.line[j * 3 + 1], f = cr.line[j * 3 + 2];
          if (j > grow) { const k = grow - (j - 1); a = lerp(cr.line[j * 3 - 3], a, k); u = lerp(cr.line[j * 3 - 2], u, k); f = lerp(cr.line[j * 3 - 1], f, k); }
          const wx = cx3 + (hd.S[0] * a + hd.U[0] * u + hd.F[0] * f) * rs, wy = cy3 + (hd.S[1] * a + hd.U[1] * u + hd.F[1] * f) * rs, wz = cz3 + (hd.S[2] * a + hd.U[2] * u + hd.F[2] * f) * rs;
          const facing = (wx - cx3) * (c.x - cx3) + (wy - cy3) * (c.y - cy3) + (wz - cz3) * (c.z - cz3) > -0.02; // only the half of the dome turned toward us
          if (!facing || !kcProj(c, wx, wy, wz, kcQ)) { pen = false; continue; }
          if (pen) ctx.lineTo(kcQ[0], kcQ[1]); else ctx.moveTo(kcQ[0], kcQ[1]); pen = true;
        }
        ctx.stroke();
      }
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    }
    // the plate: a piece of skull round the way out, punched loose and tumbling away
    if (aOut >= 0 && K.plate) {
      const q = K.plate, uc = (pl.u0 - 0.018 * sc), n = 7, hole = [], pr = 0.062 * sc;
      for (let i = 0; i < n; i++) { const an = (i / n) * TAU, rr = pr * (0.8 + 0.4 * kcHash(i * 5.3 + pl.u0 * 50)); hole.push(uc + Math.cos(an) * rr, pl.c0 + Math.sin(an) * rr); }
      const ez = pl.chord * 0.96;
      ctx.fillStyle = dark; ctx.globalAlpha = al * 0.9; ctx.beginPath();
      for (let i = 0; i < n; i++) { const hu = hole[i * 2], hf = hole[i * 2 + 1], ea = ez * fs; if (!kcProj(c, cx3 + hd.S[0] * ea + hd.U[0] * hu + hd.F[0] * hf, cy3 + hd.S[1] * ea + hd.U[1] * hu + hd.F[1] * hf, cz3 + hd.S[2] * ea + hd.U[2] * hu + hd.F[2] * hf, kcQ)) break; if (i) ctx.lineTo(kcQ[0], kcQ[1]); else ctx.moveTo(kcQ[0], kcQ[1]); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = bone; ctx.strokeStyle = boneD; ctx.lineWidth = 1; ctx.globalAlpha = al * clamp(1.6 - aOut * 0.5, 0, 1); ctx.beginPath();
      const cr = Math.cos(q.rot), sr = Math.sin(q.rot);
      for (let i = 0; i < n; i++) { const du = hole[i * 2] - uc, df = hole[i * 2 + 1] - pl.c0, ru = du * cr - df * sr * 0.5, rz = du * sr, hu = uc + ru, hf = pl.c0 + df, ea = ez * fs; if (!kcProj(c, cx3 + hd.S[0] * ea + hd.U[0] * hu + hd.F[0] * hf + q.x, cy3 + hd.S[1] * ea + hd.U[1] * hu + hd.F[1] * hf + q.y, cz3 + hd.S[2] * ea + hd.U[2] * hu + hd.F[2] * hf + q.z + rz, kcQ)) break; if (i) ctx.lineTo(kcQ[0], kcQ[1]); else ctx.moveTo(kcQ[0], kcQ[1]); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}
// The track the round leaves: a hollow that balloons open just behind it and falls shut again,
// leaving a ragged dark channel. Its width at each point depends on how long ago the tip went by,
// and on the round: a .22 leaves a pencil line, a .50 a hollow the width of a fist that leaves a
// channel as thick as a thumb. With gore on, the channel bleeds out into the flesh round it.
function kcTrack(ctx, K, c, fig) {
  const pl = K.plan, sm = pl.samples, T = K.T, fr = pl.part === 'head' ? fig.hd : fig.tor, bb = pl.part === 'head' ? pl.u0 : pl.b0, fs = fig.fs, G = K.gk;
  const lim = K.through === false ? pl.sStop : pl.sOut, open = 0.16 + 0.22 * G;
  let n = 0;
  for (let i = 0; i < sm.length; i += 2) { if (sm[i + 1] < 0 && K.s >= sm[i]) sm[i + 1] = T; if (sm[i + 1] >= 0 && sm[i] <= lim + 0.012) n++; }
  if (n < 2) return;
  const xs = [], ys = [], ws = [], wl = [], wb = [];
  for (let i = 0; i < n; i++) {
    kcLoc(fr, sm[i * 2] * fs, bb, pl.c0, kcL0);
    if (!kcProj(c, kcL0[0], kcL0[1], kcL0[2], kcQ)) return;
    const age = T - sm[i * 2 + 1], x = age / open, ends = Math.min(1, (sm[i * 2] - pl.sIn) / 0.04 + 0.25, (pl.sOut - sm[i * 2]) / 0.04 + 0.25);
    const core = (0.004 + 0.012 * G) * (0.7 + 0.6 * kcHash(i * 3.1 + G * 7)) * Math.min(1, ends * 1.6) * kcQ[2]; // torn, so never quite even
    xs.push(kcQ[0]); ys.push(kcQ[1]); ws.push((0.012 + 0.075 * G) * x * Math.exp(1 - x) * ends * kcQ[2]); wl.push(core);
    wb.push(core * (1.4 + (1.6 + 2.2 * G) * smooth(age / 1.6))); // the bleed spreading out from it
  }
  let ax = xs[n - 1] - xs[0], ay = ys[n - 1] - ys[0]; const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
  const shape = (w, add) => { ctx.beginPath(); for (let i = 0; i < n; i++) { const x = xs[i] - ay * (w[i] + add), y = ys[i] + ax * (w[i] + add); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } for (let i = n - 1; i >= 0; i--) ctx.lineTo(xs[i] + ay * (w[i] + add), ys[i] - ax * (w[i] + add)); ctx.closePath(); };
  ctx.lineJoin = 'round';
  if (K.gore) {
    ctx.globalAlpha = 0.42; ctx.fillStyle = '#7a0a12'; shape(wb, 0); ctx.fill();
    ctx.globalAlpha = 0.34; ctx.fillStyle = '#ff6a5c'; shape(ws, wl[0] * 0.5); ctx.fill(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#ffb0a4'; ctx.lineWidth = 1; ctx.stroke();
    ctx.globalAlpha = 0.95; ctx.fillStyle = '#3a0408'; shape(wl, 0); ctx.fill();
    // shreds of flesh hanging into the channel along its edges
    ctx.strokeStyle = '#a3141c'; ctx.lineWidth = Math.max(1, wl[0] * 0.35); ctx.globalAlpha = 0.8; ctx.beginPath();
    for (let i = 1; i < n - 1; i++) { const sd = i & 1 ? 1 : -1, l = wl[i] * (1.2 + 1.6 * kcHash(i * 5.7)), sl = (kcHash(i * 2.3) - 0.5) * wl[i] * 2; ctx.moveTo(xs[i] - ay * wl[i] * sd, ys[i] + ax * wl[i] * sd); ctx.lineTo(xs[i] - ay * (wl[i] + l) * sd + ax * sl, ys[i] + ax * (wl[i] + l) * sd + ay * sl); }
    ctx.stroke();
  } else { ctx.globalAlpha = 0.2; ctx.fillStyle = '#e6f3ff'; shape(ws, wl[0] * 0.5); ctx.fill(); ctx.globalAlpha = 0.45; ctx.strokeStyle = '#e6f3ff'; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 0.88; ctx.fillStyle = '#06101a'; shape(wl, 0); ctx.fill(); }
  ctx.globalAlpha = 1;
}
// The shock of the round going in (and coming out) running out over the skin as a ring, and just
// before a round breaks out, the skin of the far side pushed out ahead of it. Bigger for a bigger round.
function kcRipples(ctx, K, c, fig) {
  const pl = K.plan, d = K.dir, T = K.T, fr = pl.part === 'head' ? fig.hd : fig.tor, bb = pl.part === 'head' ? pl.u0 : pl.b0;
  // two directions square to the round's line: across (level) and up
  let e1x = d[2], e1z = -d[0]; const l1 = Math.hypot(e1x, e1z) || 1; e1x /= l1; e1z /= l1;
  const e2x = d[1] * e1z, e2y = d[2] * e1x - d[0] * e1z, e2z = -d[1] * e1x;
  const col = K.gore ? '#ffc2b8' : '#e6f3ff', fill = K.gore ? '#d0303a' : '#bfe0ff';
  for (let i = 0; i < K.rip.length; i++) {
    const r = K.rip[i], dur = 0.35 + 0.45 * r.k, u = (T - r.t0) / dur; if (u < 0 || u > 1) continue;
    kcLoc(fr, r.s * fig.fs, bb, pl.c0, kcL1);
    for (let j = 0; j < 2; j++) {
      const rad = (0.012 + (0.04 + 0.15 * r.k) * easeOut(clamp(u * (j ? 1.6 : 1), 0, 1))) * (j ? 0.6 : 1);
      ctx.beginPath(); if (!kcEll(ctx, c, kcL1[0], kcL1[1], kcL1[2], kcSet(kcV1, e1x * rad, 0, e1z * rad), kcSet(kcV2, e2x * rad, e2y * rad, e2z * rad))) break;
      if (j === 0) { ctx.globalAlpha = 0.22 * (1 - u) * (0.4 + r.k); ctx.fillStyle = fill; ctx.fill(); }
      ctx.globalAlpha = (j ? 0.35 : 0.6) * (1 - u); ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, (1.5 + 2 * r.k) * (1 - u)); ctx.stroke();
    }
  }
  // the far side tenting out as the tip comes up to it
  const togo = pl.sOut - K.s;
  if (K.exit && K.hitT !== null && togo > 0 && togo < 0.07) {
    const k = 1 - togo / 0.07, b = (0.012 + 0.03 * K.gx) * k * k;
    kcLoc(fr, (pl.sOut + b * 0.45) * fig.fs, bb, pl.c0, kcL1);
    kcSet(kcV1, e1x * b * 0.85, 0, e1z * b * 0.85); kcSet(kcV2, e2x * b * 0.85, e2y * b * 0.85, e2z * b * 0.85); kcMul(kcV3, d, b * 0.6);
    ctx.beginPath(); if (kcEll(ctx, c, kcL1[0], kcL1[1], kcL1[2], kcV1, kcV2, kcV3)) { ctx.globalAlpha = 0.55; ctx.fillStyle = K.gore ? '#9a6f7a' : '#9cc6ea'; ctx.fill(); ctx.globalAlpha = 0.8; ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
}
// Blood, bone and dust in flight. Each bit is a point in space put through the camera; drops
// are drawn stretched along the way they are moving.
function kcDrawParts(ctx, K, c, list) {
  const ps = list || K.parts; if (!ps.length) return;
  ctx.lineCap = 'round';
  const flat = Math.max(0.12, Math.abs(Math.sin(c.pitch)));
  // the hanging cloud: soft red puffs that swell, drift and thin out, behind everything else
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]; if (p.k !== 9 || !kcProj(c, p.x, p.y, p.z, kcQ)) continue;
    const u = clamp(p.age / p.life, 0, 1), r = Math.max(2, p.r * kcQ[2] * (1 + 2.2 * Math.sqrt(u))), a = 0.34 * smooth(p.age / 0.04) * (1 - u) * (1 - u);
    if (a < 0.01) continue;
    const g = ctx.createRadialGradient(kcQ[0], kcQ[1], 0, kcQ[0], kcQ[1], r);
    g.addColorStop(0, 'rgba(150,14,24,' + a.toFixed(3) + ')'); g.addColorStop(0.55, 'rgba(120,10,20,' + (a * 0.55).toFixed(3) + ')'); g.addColorStop(1, 'rgba(90,6,14,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(kcQ[0], kcQ[1], r, 0, TAU); ctx.fill();
  }
  // mist and dust: soft dots that swell and thin (a faint wider ring round each, so they blur together)
  for (let pass = 0; pass < 5; pass += 4) {
    ctx.fillStyle = pass === 0 ? '#a3141c' : '#cfe4f5';
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]; if (p.k !== pass || !kcProj(c, p.x, p.y, p.z, kcQ)) continue;
      const u = p.age / p.life, a = 0.4 * (1 - u) * (1 - u * 0.5), r = Math.max(1, p.r * kcQ[2] * (1 + u * 2.4));
      ctx.globalAlpha = a * 0.3; ctx.beginPath(); ctx.arc(kcQ[0], kcQ[1], r * 1.9, 0, TAU); ctx.fill();
      ctx.globalAlpha = a * 0.75; ctx.beginPath(); ctx.arc(kcQ[0], kcQ[1], r, 0, TAU); ctx.fill();
    }
  }
  // drops: a round head and a tail drawn back along the way it came. Tails and heads are
  // filled as two separate shapes so that where they overlap they cannot cancel out.
  for (let pass = 1; pass <= 3; pass += 2) {
    ctx.fillStyle = pass === 1 ? '#b3151d' : '#dba0a6';
    for (let shape = 0; shape < 2; shape++) {
      ctx.globalAlpha = 0.95; ctx.beginPath();
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i]; if (p.k !== pass || !kcProj(c, p.x, p.y, p.z, kcQ)) continue;
        const s = kcQ[2], x = kcQ[0], y = kcQ[1], fade = clamp((p.life - p.age) / 0.05, 0, 1), r = Math.max(0.8, p.r * s) * (0.4 + 0.6 * fade);
        if (p.stuck) { if (shape) { if (p.wall) { kcEll(ctx, c, p.x, p.y, p.z, kcSet(kcV1, p.r * 2.6, 0, 0), kcSet(kcV2, 0, p.r * 2.2, 0)); } else { ctx.moveTo(x + r * 2.2, y); ctx.ellipse(x, y, r * 2.2, Math.max(0.6, r * 2.2 * flat), 0, 0, TAU); } } continue; }
        if (shape) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); continue; }
        if (!kcProj(c, p.x - p.vx * 0.011, p.y - p.vy * 0.011, p.z - p.vz * 0.011, kcQ2)) continue;
        let tx = kcQ2[0] - x, ty = kcQ2[1] - y; const tl = Math.hypot(tx, ty); if (tl < r * 0.7) continue;
        const k = Math.min(1, (r * 6) / tl), nx = (-ty / tl) * r * 0.92, ny = (tx / tl) * r * 0.92; tx *= k; ty *= k;
        ctx.moveTo(x + nx, y + ny); ctx.lineTo(x + tx, y + ty); ctx.lineTo(x - nx, y - ny); ctx.closePath();
      }
      ctx.fill();
    }
  }
  // torn tissue: ragged dark lumps with a wet edge, turning as they fly (flattened once they land)
  for (let pass = 0; pass < 2; pass++) {
    ctx.fillStyle = pass ? '#c23a40' : '#5c0910'; ctx.beginPath();
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]; if (p.k !== 10 || !kcProj(c, p.x, p.y, p.z, kcQ)) continue;
      const r = Math.max(1.2, p.r * kcQ[2]) * (pass ? 0.45 : 1) * (0.4 + 0.6 * clamp((p.life - p.age) / 0.06, 0, 1)), sq = p.stuck ? flat : 0.6 + 0.4 * Math.abs(Math.sin(p.rot * 0.7));
      const x = kcQ[0] - (pass ? r * 0.35 : 0), y = kcQ[1] - (pass ? r * 0.4 : 0), ro = p.rot, ca = Math.cos(ro), sa = Math.sin(ro);
      for (let j = 0; j < 5; j++) { // five lobes of uneven size round the middle
        const an = j * 1.2566, rr = r * (0.7 + 0.5 * kcHash(j * 7.3 + p.r * 9e3)), lx = Math.cos(an) * rr, ly = Math.sin(an) * rr * sq;
        const px = x + lx * ca - ly * sa, py = y + lx * sa + ly * ca;
        if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
    }
    ctx.globalAlpha = pass ? 0.55 : 0.95; ctx.fill();
  }
  // splinters (of bone, of wood) and chips of brick: short sticks, turning
  for (let pass = 0; pass < 3; pass++) {
    const kind = pass === 0 ? 2 : pass === 1 ? 6 : 8;
    ctx.strokeStyle = kind === 2 ? (K.gore ? '#efe7d2' : '#d9ecfa') : kind === 6 ? '#b88a55' : '#a29a90';
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]; if (p.k !== kind || !kcProj(c, p.x, p.y, p.z, kcQ)) continue;
      const s = kcQ[2], l = p.r * s * (kind === 8 ? 0.3 : 0.5), cs = Math.cos(p.rot), sn = Math.sin(p.rot) * (p.stuck ? flat : 1);
      ctx.globalAlpha = clamp((p.life - p.age) / 0.06, 0, 1); ctx.lineWidth = Math.max(1, p.r * s * (kind === 8 ? 0.45 : 0.28)); ctx.beginPath(); ctx.moveTo(kcQ[0] - cs * l, kcQ[1] - sn * l); ctx.lineTo(kcQ[0] + cs * l, kcQ[1] + sn * l); ctx.stroke();
    }
  }
  // glass: small bright shards that turn and catch the light
  ctx.fillStyle = '#d6ecff';
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]; if (p.k !== 5 || !kcProj(c, p.x, p.y, p.z, kcQ)) continue;
    const r = Math.max(1.2, p.r * kcQ[2]), a = p.rot, w = 0.45 + 0.55 * Math.abs(Math.sin(p.rot * 1.7));
    ctx.globalAlpha = 0.85 * clamp((p.life - p.age) / 0.1, 0, 1);
    ctx.beginPath(); ctx.moveTo(kcQ[0] + Math.cos(a) * r, kcQ[1] + Math.sin(a) * r * w); ctx.lineTo(kcQ[0] + Math.cos(a + 2.3) * r * 0.6, kcQ[1] + Math.sin(a + 2.3) * r * 0.6 * w); ctx.lineTo(kcQ[0] + Math.cos(a + 4.1) * r * 0.8, kcQ[1] + Math.sin(a + 4.1) * r * 0.8 * w); ctx.closePath(); ctx.fill();
  }
  // sparks: bright streaks along the way they fly
  ctx.strokeStyle = '#ffd98a'; ctx.lineCap = 'round';
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]; if (p.k !== 7 || !kcProj(c, p.x, p.y, p.z, kcQ) || !kcProj(c, p.x - p.vx * 0.012, p.y - p.vy * 0.012, p.z - p.vz * 0.012, kcQ2)) continue;
    ctx.globalAlpha = clamp(1 - p.age / p.life, 0, 1); ctx.lineWidth = Math.max(1, p.r * kcQ[2]); ctx.beginPath(); ctx.moveTo(kcQ[0], kcQ[1]); ctx.lineTo(kcQ2[0], kcQ2[1]); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
// A small label on the main thing the round broke, for a moment.
function kcCaption(ctx, K, c, V) {
  const cp = K.cap; if (!cp || !cp.text || !K.fig) return;
  const pl = K.plan, age = K.T - cp.t0 - 0.12; if (age < 0 || age > 1.6) return;
  const fr = pl.part === 'head' ? K.fig.hd : K.fig.tor;
  kcLoc(fr, cp.s * K.fig.fs, pl.part === 'head' ? pl.u0 : pl.b0, pl.c0, kcL0);
  if (!kcProj(c, kcL0[0], kcL0[1], kcL0[2], kcQ)) return;
  const a = smooth(age / 0.15) * (1 - smooth((age - 1.25) / 0.35)), x = kcQ[0], y = kcQ[1], up = -Math.min(V.H * 0.17, 64), run = Math.min(V.W * 0.07, 40) * easeOut(age / 0.25);
  // it leans away from the side the spray goes
  ctx.font = '700 ' + (V.W < 500 ? 12 : 13) + 'px "Avenir Next Condensed","DIN Condensed","Roboto Condensed","Arial Narrow",sans-serif';
  ctx.textBaseline = 'bottom';
  let tw = 0; for (let i = 0; i < cp.text.length; i++) tw += ctx.measureText(cp.text[i]).width + 1.6; // letters set a little apart
  // it leans away from the side the spray goes, unless that would run it off the screen
  let dirX = c.rz > 0 ? -1 : 1;
  const reach = Math.abs(up) * 0.55 + Math.min(V.W * 0.07, 40) + tw + 12;
  if (x + dirX * reach > V.W - 4 || x + dirX * reach < 4) dirX = -dirX;
  const x1 = x + dirX * Math.abs(up) * 0.55, y1 = y + up, x2 = x1 + dirX * run;
  ctx.globalAlpha = a; ctx.strokeStyle = '#ffffff'; ctx.fillStyle = '#ffffff'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x1, y1); ctx.lineTo(x2, y1); ctx.stroke();
  ctx.fillRect(x - 2, y - 2, 4, 4);
  let tx = dirX > 0 ? x1 + 3 : x1 - 3 - tw; ctx.textAlign = 'left';
  for (let i = 0; i < cp.text.length; i++) { ctx.fillText(cp.text[i], tx, y1 - 3); tx += ctx.measureText(cp.text[i]).width + 1.6; }
  ctx.globalAlpha = 1;
}
