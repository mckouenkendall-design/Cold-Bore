// ---------------------------------------------------------------------------
// The kill camera. A short film of the shot that finishes a contract.
//
// Contract with the game loop (src/20_game.js):
//   KillCam.start(o)      begin. o = { sim, view, gunId, cfg, bullet, path, t0, tHit, hit,
//                         actor, kills, gore, step, cut }. Return false to decline.
//   KillCam.advance(dt)   dt = real seconds since last frame. Returns the simulation time
//                         the world should have reached. The game steps the world up to it.
//   KillCam.draw(dt)      paint the whole frame onto the game canvas.
//   KillCam.onEvent(e)    world events, as they happen.
//   KillCam.skip()        the player tapped: finish quickly.
//   KillCam.stop()        tidy up.
//   KillCam.active, KillCam.done, KillCam.rate (how fast time is passing, for the sound)
//
// Two options:
//   THE SHORT CUT   KillCam.cut = 'short' (a setting the game keeps), or o.cut = 'short' for one
//                   film: the same film in about five seconds (a glimpse of the muzzle, a quick
//                   chase, the way in, the main thing hit, the way out, the fall), for replays
//                   and second kills. Anything else, or nothing, is the full film.
//   A MISSION'S OWN STYLE  a mission may carry cine: 'take' (or cine: { style: 'take' }). Its
//                   film is then one unbroken real-time shot of the target in the real scene
//                   from the shooter's side, at three-quarters: no rifle, no chase, no X-ray, no
//                   numbers, captions or stamps. The round arrives, the body falls, the camera
//                   holds on it and the picture goes down to black. (For a story moment: Rook,
//                   hands raised.) It sends the beats fly, enter, exit (if it comes out), fall,
//                   end, all at rate 1; never slow, near or resume.
//
// The film has five stages, each with its own picture:
//   0  THE RIFLE    the player's rifle where the player is, the shot (src/21d_kcrifle.js).
//   1  THE FLIGHT   a camera riding just behind the round through the real scene, the shot's
//                   numbers along the bottom (src/21e_kctext.js).
//   2  THE SWING    the camera lets go of the round and swings round to the first shot of the
//                   X-ray; the real scene stays behind as a dark blue backdrop.
//   3  THE X-RAY    the deep slow motion, as a radiograph (src/21b_kcxray.js), cut into shots
//                   by the director (src/21c_kcdirect.js): the round brakes and goes in, a whip
//                   to a macro of the main thing it hits (the film freezes there for half a
//                   second), a whip out to the side as it comes out (or a last macro of where it
//                   came to rest).
//   4  THE FALL     the world speeds back up toward real time, the camera comes round to a
//                   three-quarter view and the X-ray fades back into the real scene, where the
//                   body falls (src/13_ragdoll.js); a stamp for what the shot was; a moment after
//                   it lands, down to black and back to the scope, where the same body carries on.
//
// Timeline (real seconds, a 155 m chest shot with a .308): rifle 0.95, flight 1.3 to 2.1 by
// distance, swing 1.3, then the slow motion: approach 1.05, the touch 0.35, through the body
// about 1.6 with half a second's freeze at the main thing hit, the exit hanging in the air 0.85;
// then the fall until the body is down. About 11 s in all; a tap skips it at any point.
//
// Sound: the film tells the sound engine every beat as it happens on screen (kcSay, below) and
// keeps KillCam.rate up to date: how fast time is passing in the picture, 1 = real time. It is
// the speed the world's clock is running at (world seconds per film second), never below
// kcTune.rateMin: in the flight it rises and falls with the round's apparent speed (a short
// shot never gets near real time), at the rifle and from the swing until the fall the picture
// is far slower than the sound engine can follow and it sits at rateMin, and in the fall it
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
  freeze: 0.5,       // seconds the film stops dead as the round reaches the main thing it hits
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
  bgRes: 0.42,       // the backdrop is drawn at this share of the screen's own resolution (soft, and cheap)
  fallIn: 0.75,      // seconds for the camera to come round to the fall, the real scene fading back in on the way
  deg: Math.PI / 180,
};
// The short cut (KillCam.cut = 'short', or o.cut): the same film in about five seconds, for
// replays and second kills: a glimpse of the muzzle, a quick chase, the way in, the main thing
// hit, the way out, the fall.
const kcShortTune = Object.assign({}, kcTune, { beat: 0.14, flightMin: 0.4, flightMax: 0.55, swing: 0.6, approach: 0.45, touch: 0.16, crawl: 0.85, linger: 0.42, rest: 0.3, insideMax: 2.2, freeze: 0.32, hold: 0.45, holdMax: 1.5, out: 0.22, fallIn: 0.55 });
KillCam.tune = kcTune; // (for tests and tuning; nothing in the game changes it)
// bullet diameters in millimetres, by the rifle's calibre
const kcCalMm = { c22: 5.7, c556: 5.7, c308: 7.8, c762r: 7.9, c8mm: 8.2, c65: 6.7, c300m: 7.8, c338: 8.6, c408: 10.4, c50: 12.9, c300s: 7.8, c9s: 9, crail: 6 };
// how wide (metres, half) the hollow behind each round opens in flesh at its widest
const kcCavT = { c22: 0.009, c9s: 0.017, c300s: 0.021, c556: 0.03, c65: 0.035, c308: 0.042, c762r: 0.042, c8mm: 0.045, c300m: 0.052, c338: 0.06, c408: 0.07, c50: 0.1, crail: 0.062 };
const kcPalDefault = { skyTop: '#22234f', skyBot: '#ef8a55', ink: '#0e1016', rim: 'rgba(255,225,205,0.45)', dark: 0.35, star: 0 };
// a standing figure, used only if the game cannot give us the target's pose
const kcStand = { hip: [0, 0.86], neck: [0, 1.42], head: [0, 1.62], sh: [0, 1.37], knL: [0.02, 0.42], ftL: [0.03, 0], knR: [-0.02, 0.42], ftR: [-0.03, 0], elL: [0.02, 1.08], haL: [0.05, 0.8], elR: [-0.02, 1.08], haR: [-0.04, 0.8], scale: 1, f: 1 };
// The organs, in the trunk's own axes: a = toward the person's left, b = up from the hip as a
// share of the hip-to-neck length, c = forward. ra, rb, rc are half-sizes in metres.
const kcOrgans = [
  { id: 'lungR', a: -0.07, b: 0.71, c: 0.004, ra: 0.054, rb: 0.124, rc: 0.068, col: '#c9727b', hi: '#e7a6aa', label: 'LUNG', pri: 6 },
  { id: 'lungL', a: 0.07, b: 0.71, c: 0.004, ra: 0.052, rb: 0.12, rc: 0.066, col: '#c9727b', hi: '#e7a6aa', label: 'LUNG', pri: 6 },
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
  // the style (see the top of this file): a mission's own single take, or the short cut
  const cs = o.sim.M && o.sim.M.cine, style = typeof cs === 'string' ? cs : cs && cs.style;
  K.take = style === 'take'; K.short = !K.take && (o.cut || KillCam.cut) === 'short';
  K.tn = K.short ? kcShortTune : kcTune;
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
  K.Tf = lerp(K.tn.flightMin, K.tn.flightMax, far) * clamp(K.dist / 100, 0.45, 1);
  K.Ta = K.tn.beat; K.Tb = K.Ta + K.Tf; K.Tc = K.Tb + K.tn.swing;
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
  // The wound (src/21b_kcxray.js): how wide the hollow behind the round opens and the channel it
  // leaves (metres), by calibre. Hollow points and soft points open into petals and tear a wider
  // hole sooner; a light round (a .22, a 5.56) tumbles end over end; a .50 bursts a head.
  const am = (o.cfg && o.cfg.ammo) || 'am_ball';
  K.petal = am === 'am_sp' || am === 'am_sg_hollow';
  K.tumbleK = K.cal === 'c22' || K.cal === 'c556' ? 1 : 0;
  K.cavR = (kcCavT[K.cal] || 0.042) * (K.petal ? 1.35 : 1) * (0.75 + 0.45 * K.power);
  K.chanR = Math.max(0.0026, ((kcCalMm[K.cal] || 7.8) / 1000) * 0.55) * (K.petal ? 1.6 : 1);
  K.burst = K.part === 'head' && K.cal === 'c50';
  K.cavSeed = kcHash(h.x * 3.1 + h.y * 7.7) * 100;
  K.ct = 0; K.frz = null; K.plates = null; K.rT = null; K.rP = null;
  // which side the camera swings to: the side the target is facing, so we end up looking at their front
  const a = o.actor;
  K.side = a && (a.face || 1) < 0 ? -1 : 1;
  K.look = Object.assign({}, (a && a.look) || {});       // the game knocks the hat off at the kill; keep our own copy
  K.gore = o.gore !== false;
  // book-keeping
  K.ret = Math.min(o.sim.t, o.tHit - step * 0.25); K.prevRet = K.ret; K.simDt = 0;
  K.bp = [path[0][1], path[0][2], path[0][3], path[0][0]]; K.s = -K.dS; K.spd = 0; K.speedK = 0;
  K.Td = K.Tc + K.tn.approach; // the moment of impact
  K.hitT = null; K.holdT0 = null; K.outT0 = null; K.killSeen = false; K.skipN = 0; K.stopped = false;
  K.plan = null; K.fig = null; K.sw = null; K.dmg = {}; K.parts = []; K.lens = []; K.rip = []; K.cap = null; K.mush = 0; K.spin = 0;
  K.hat = null; K.plate = null; K.chan = null; K.streak = 0; K.rifle = null; K.snd = {}; K.err = null;
  K.cam = kcCamAim({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, f: 600, px: 0, py: 0 });
  K.rng = makeRng((Math.round(h.x * 977) ^ Math.round(h.y * 7919) ^ Math.round(h.z * 13)) + 4099);
  K.wparts = []; K.landT = undefined; K.spentT = undefined; K.exitT = undefined; K.stopT = undefined; K.follow = null;
  K.covers = kcCoverList(K, o, h, a0); K.wallB = kcWallList(K, o, h, a0);
  // the director (src/21c_kcdirect.js): the recipe, the shot now and the one before, the backdrop
  K.rec = null; K.shot = null; K.shotPrev = null; K.shotT0 = 0; K.shotPrevT0 = 0; K.shotWhip = 0; K.whipping = 0; K.fallK = 0;
  K.bg = null; K.cutKey = false; K.cutExit = false; K.cutLodge = false; K.burstDone = false;
  kcTextInit(K, o); // the shot's numbers and its stamps (src/21e_kctext.js)
  if (K.take) kcTakeSetup(K, o); // a mission's own single take (src/21c_kcdirect.js)
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
  try { return K.take ? (K.skipped ? kcEnd(K, o) : kcAdvanceTake(K, o, clamp(+dt || 0, 0, 0.05))) : kcAdvance(K, o, clamp(+dt || 0, 0, 0.05)); } catch (e) { K.err = e; K.skipped = true; return kcEnd(K, o); }
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
  K.T += dt;
  // the film's own clock: it stands still in a freeze, and with it the spray and the damage
  const frozen = !!K.frz && K.T - K.frz.t0 < K.frz.len;
  if (!frozen) { K.ct += dt; K.spin += dt * 9; }
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
    if (T >= K.Tc && !K.shot) kcCut(K, 'entry', 0); // the swing ends on the first shot
    if (K.hitT === null) {
      if (T < K.Tc) {
        // the swing: the round eases down from the flight's last speed
        const u = (T - K.Tb) / K.tn.swing, D = Math.max(0.05, K.dS - pl.sFrom);
        K.s = -K.dS + D * (1.28 * u - 0.28 * u * u); K.spd = (D * (1.28 - 0.56 * u)) / K.tn.swing;
        if (!K.snd.h1 && u > 0.12) { K.snd.h1 = 1; kcBeat(0.1); }
        if (!K.snd.h2 && u > 0.7) { K.snd.h2 = 1; kcBeat(0.12); }
      } else {
        // The approach: the round brakes over its last hand spans and is all but stopped when it
        // touches the skin, exactly approach seconds after the swing (a cubic in time that starts
        // at the swing's last speed and ends at touchV).
        K.stage = 3;
        if (!K.snd.slow) { K.snd.slow = 1; kcSay(K, 'slow', { len: +kcSlowLen(K).toFixed(2) }); }
        const Ta = K.tn.approach, u = clamp((T - K.Tc) / Ta, 0, 1), D = Math.max(0.01, pl.sIn - pl.sA);
        const m0 = clamp((pl.vA * Ta) / D, 0, 2.9), m1 = clamp((kcTune.touchV * Ta) / D, 0, 1);
        const h = (u * u * u - 2 * u * u + u) * m0 + (-2 * u * u * u + 3 * u * u) + (u * u * u - u * u) * m1;
        const hv = (3 * u * u - 4 * u + 1) * m0 + (-6 * u * u + 6 * u) + (3 * u * u - 2 * u) * m1;
        K.s = pl.sA + D * h; K.spd = (D * hv) / Ta;
      }
      wr = K.spd / K.v;
      K.ret = Math.max(K.ret, Math.min(o.tHit + K.s / K.v, cap));
      // half a second (on screen) before the round reaches the body
      if (!K.snd.near && T >= K.Td - Math.min(0.5, K.tn.approach * 0.8)) { K.snd.near = 1; kcSay(K, 'near'); }
      if (T >= K.Td) {
        // the tip touches the skin: this is the frame the world is allowed to make the kill
        K.hitT = T; K.stage = 3; K.s = pl.sIn;
        K.ret = Math.max(K.ret, o.tHit + K.step * 1.002);
      }
    } else {
      // Inside the body. For a moment after it touches, the round hardly moves (the hit lands);
      // then a slow crawl that all but stops again as it reaches the main thing it hits.
      const since = T - K.hitT, a = o.actor, tch = K.tn.touch;
      const wake = since < tch ? lerp(kcTune.touchV / K.tn.crawl, 0.12, smooth(since / (tch * 0.4))) : lerp(0.12, 1, smooth((since - tch) / 0.45));
      let sp = K.tn.crawl * (since < tch ? wake : wake * (1 - 0.55 * Math.exp(-Math.pow((K.s - pl.sKey) / 0.04, 2))));
      // at the main thing it hits, the film stops dead for a moment (the round, the spray, everything)
      if (pl.key && !K.frz && K.s >= pl.sKey && since > tch) K.frz = { t0: T, len: K.tn.freeze };
      if (frozen) sp = 0;
      if (K.exit && !K.spent) { if (K.s > pl.sOut) { if (K.exitT === undefined) K.exitT = T; sp = Math.min(7, K.tn.crawl + (K.s - pl.sOut) * 5); } }
      else if (K.spent) {
        // out of the far side with nothing left: it tumbles a hand's width further and drops
        if (K.s > pl.sOut) { if (K.spentT === undefined) K.spentT = T; sp = K.tn.crawl * 1.6 * clamp((pl.sSpent - K.s) / 0.12, 0, 1); }
        if (pl.sSpent - K.s < 0.004) K.stopped = true;
      } else { sp *= clamp((pl.sStop - K.s) / 0.06, 0, 1); if (pl.sStop - K.s < 0.004) K.stopped = true; }
      if (K.stopped && K.stopT === undefined) K.stopT = T;
      K.spd = sp; K.s += sp * dt;
      // the director's cuts (src/21c_kcdirect.js): a whip to the macro just before the round reaches
      // the main thing it hits, out to the side as it comes out, or in close where it came to rest
      if (pl.key && !K.cutKey && K.s >= pl.sKey - 0.035) { K.cutKey = true; kcCut(K, 'macro', K.rec.whip); }
      if (K.exit && !K.cutExit && K.s >= pl.sOut - 0.03) { K.cutExit = true; kcCut(K, 'exit', K.rec.whip * 1.15); }
      if (!K.exit && K.stopped && !K.cutLodge) { K.cutLodge = true; kcCut(K, 'lodged', K.rec.whip); K.cap = { ref: 'lodged', t0: T + K.rec.whip * 0.6, s: K.s - K.len * 0.5 }; }
      // the exit hangs in the air a moment; a round that stayed in is held on a moment
      if (K.holdT0 === null && ((K.exitT !== undefined && T - K.exitT > K.tn.linger) || (K.stopT !== undefined && T - K.stopT > K.tn.rest) || since > K.tn.insideMax)) {
        K.holdT0 = T; K.stage = 4; kcSay(K, 'resume');
        kcTone({ at: 0.18, f: 55, dur: 1.3, att: 0.05, gain: 0.07, verb: 0.4 }); kcTone({ at: 0.18, f: 110, dur: 0.9, att: 0.05, gain: 0.018, verb: 0.4 });
      }
      // the body hitting the ground, as the film shows it
      if (K.hitT !== null && !K.snd.fall && a && a.dead && isFinite(a.deathAtT)) { const L = rdLanded(a, K.ret - a.deathAtT); if (L) { K.snd.fall = 1; K.landT = T; kcSay(K, 'fall', { mat: L.mat, speed: L.v }); } }
      // The hold: the world speeds up toward real time so the fall is seen, and the film ends a
      // moment after the body is down (or after a few seconds at most).
      if (K.holdT0 !== null && K.outT0 === null) { const ht = T - K.holdT0; if ((K.landT !== undefined && T - K.landT > 0.5 && ht > K.tn.hold) || ht > K.tn.holdMax) K.outT0 = T; }
      if (K.outT0 !== null && T - K.outT0 > K.tn.out) { K.done = true; kcSayEnd(K); try { o.view.blackout = Math.max(o.view.blackout || 0, 0.8); } catch (e) { /* the scope picture is not ours to break */ } }
      wr = K.holdT0 === null ? (frozen ? 0 : K.tn.creep) : lerp(0.06, 0.55, smooth((T - K.holdT0 - 0.1) / 0.9));
      if (K.outT0 !== null) wr = Math.max(0.3, wr);
      K.ret += dt * wr;
    }
    // things on the round's line break as its tip reaches them (cover before it reaches the body)
    for (let i = 0; i < pl.evs.length; i++) { const ev = pl.evs[i]; if (!ev.done && K.s >= ev.s && (ev.kind === 'skin0' || ev.kind === 'cover' || K.hitT !== null)) { ev.done = true; kcFire(K, ev); } }
    kcStepParts(K, frozen ? 0 : dt * (K.holdT0 !== null ? Math.max(0.3, wr) : 0.15));
    // a .50 through the head: a moment after it goes in, the vault bursts
    if (K.burst && K.dmg.burst !== undefined && !K.burstDone && K.ct >= K.dmg.burst) { K.burstDone = true; kcBurst(K); }
    // the coil slug's channel is seared: steam curls up out of the holes it made
    if (K.steel && K.hitT !== null && !frozen && K.parts.length < kcTune.maxParts) {
      K.steamT = (K.steamT || 0) + dt;
      while (K.steamT > 0.05) {
        K.steamT -= 0.05;
        const out = K.dmg.skin1 !== undefined && K.rng.f() < 0.5, sh = out ? pl.sOut : pl.sIn, Hh = pl.H, d0 = K.dir;
        kcSpray(K, 12, 1, [Hh[0] + d0[0] * sh, Hh[1] + d0[1] * sh + 0.01, Hh[2] + d0[2] * sh], out ? 1 : -1, 0.9, 0.05, 0.25, 0.008, 0.016, 2.6);
      }
    }
  }
  // what the sound is told: the world's clock, a little smoothed, never below the floor
  K.wr = K.T <= dt + 1e-9 ? wr : K.wr + (wr - K.wr) * Math.min(1, dt * 18);
  K.rate = clamp(K.wr, kcTune.rateMin, 1);
  K.simDt = Math.max(0, K.ret - K.prevRet);
  return K.ret;
}
// the speed the round is shown at as the swing begins (metres per second), so the flight can land on it
function kcSwingV0(K) { return (1.28 * Math.max(0.2, K.dS - kcTune.standOff - 0.2)) / K.tn.swing; }
// About how long the deep slow motion lasts, from the end of the swing to the hold (for the sound).
function kcSlowLen(K) {
  const pl = K.plan; if (!pl) return 3;
  const inside = ((K.exit ? pl.sOut : pl.sStop) - pl.sIn) / K.tn.crawl;
  return K.tn.approach + K.tn.touch + 0.2 + inside * 1.15 + (pl.key ? K.tn.freeze : 0) + (K.exit && !K.spent ? K.tn.linger + 0.1 : K.tn.rest + 0.2);
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
    // u0 = how far up the head from its middle, c0 = how far toward the face. The line is kept where
    // there is skull to go through: the vault, or low down, the jaw.
    const hd = fig.hd, hr = fig.hr, rx = lx - hd.o[0], ry = ly - hd.o[1];
    let u0 = rx * hd.U[0] + ry * hd.U[1], c0 = rx * hd.F[0] + ry * hd.F[1];
    const ss = sc * kcSkK; // the skull's own size (see src/21b_kcxray.js)
    if (u0 > -0.035 * sc) { const eu = (u0 - kcSkC[1] * ss) / (0.088 * ss), ef = (c0 - kcSkC[2] * ss) / (0.104 * ss), er = Math.hypot(eu, ef); if (er > 1) { u0 = (kcSkC[1] + (eu / er) * 0.088) * ss; c0 = (kcSkC[2] + (ef / er) * 0.104) * ss; } }
    else { u0 = clamp(u0, -0.105 * sc, -0.035 * sc); c0 = clamp(c0, -0.02 * sc, 0.085 * sc); }
    pl.u0 = u0; pl.c0 = c0; pl.H = [hd.o[0] + hd.U[0] * u0 + hd.F[0] * c0, hd.o[1] + hd.U[1] * u0 + hd.F[1] * c0, 0];
    // the skin of the head (the X-ray draws it as an egg a little inside the outline's circle)
    const ku = (u0 + 0.005 * sc) / (hr * 0.93), kf = (c0 - 0.006 * sc) / (hr * 0.95), skin = hr * 0.86 * Math.sqrt(Math.max(0.12, 1 - ku * ku - kf * kf));
    add(-skin, 'skin0'); add(skin, 'skin1');
    const ch = kcChord(kcSkC, kcSkR, ss, u0, c0);
    if (ch > 0.02 * sc && u0 > -0.035 * sc) {
      add(-ch, 'bone', 'skullIn', 'SKULL', 4); add(ch, 'bone', 'skullOut');
      const bch = kcChord(kcBrC, kcBrR, ss, u0, c0);
      if (K.gore && bch > 0.01 * sc) add(-bch * 0.5, 'organ', 'brain', 'BRAIN', 9);
      pl.chord = ch;
    } else {
      add(-0.066 * sc, 'bone', 'jawIn', 'JAW', 4); add(0.066 * sc, 'bone', 'jawOut');
      if (c0 < 0.01 * sc && u0 < -0.06 * sc) add(-0.01 * sc, 'spine', 'spineC', 'SPINE', 9);
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
    const rh = kcRibHit(fig, b0, c0);
    if (rh) { pl.rib = rh; add(-rh.w, 'bone', 'ribIn', 'RIBS', 2); add(rh.w, 'bone', 'ribOut'); } // the rib cage: its wall is met going in and coming out
    else if (tt >= 0.9) { add(-fig.ws * 0.9, 'bone', 'shIn', 'SHOULDER', 3); add(fig.ws * 0.9, 'bone', 'shOut'); }
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
  { const D = Math.max(0.05, K.dS - pl.sFrom); pl.sA = -K.dS + D; pl.vA = (D * 0.72) / K.tn.swing; } // exactly where, and how fast it is going
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
  K.sw = { f, R0, B, N: Nn, U, phi0: Math.atan2(vn, vb), el0: Math.asin(clamp(vu / R0, -0.9, 0.9)), H: Hx.slice(), mid, focus: [Hx[0], Hx[1] + 0.02, 0],
    sW: W, sH: H, R1: f / Math.min(W / 1.5, vis / 1.62), R2: f / Math.min(W / 0.86, vis / 0.6), phx: g.sx, phy: g.sy,
    px0: g.sx - (f * (Hx[0] - cx)) / (Hx[2] - cz), py0: g.sy + (f * (Hx[1] - cy)) / (Hx[2] - cz), // where the chase camera's centre line was on screen
    // where the X-ray origin sits in the world: first as the flight has it, then pinned to the live target
    ox: K.bp[0] - (Hx[0] - K.dir[0] * K.dS), oy: K.bp[1] - (Hx[1] - K.dir[1] * K.dS), oz: h.z };
  kcPickRecipe(K);
  if (K.part !== 'head' && key && K.stamps) { if (key.ref === 'heart') K.stamps.unshift('HEART SHOT'); else if (key.ref === 'spine') K.stamps.unshift('SPINE SHOT'); }
  kcTone({ f: 70, f1: 230, dur: K.tn.swing + 0.4, att: K.tn.swing, gain: 0.03, lp: 900 });
}

// One thing on the round's line gives way.
function kcFire(K, ev) {
  const pl = K.plan, R = K.rng, d = K.dir, H = pl.H;
  const at = [H[0] + d[0] * ev.s, H[1] + d[1] * ev.s, H[2] + d[2] * ev.s];
  if (ev.kind === 'cover') { kcCoverBurst(K, ev.cv, at, false); return; }
  if (ev.kind === 'wall') { kcWallHit(K, at); return; }
  K.dmg[ev.ref] = K.ct;
  if (pl.key === ev) K.cap = { text: ev.label, ref: ev.ref, kind: ev.kind, t0: K.T, s: ev.s };
  if (ev.ref === 'skullIn' && K.burst) K.dmg.burst = K.ct + 0.1;
  // (lifetimes are in the spray's own slowed time: 0.15 of a second of it is a second on screen)
  // Everything with blood in it is scaled by how hard the round hits (K.gk, K.gx: see KillCam.start),
  // so a .22 leaves a small neat hole and a puff, and a .50 tears the body open.
  const G = K.gk, N = (x) => Math.max(0, Math.round(x));
  if (ev.kind === 'skin0') {
    kcSay(K, 'enter', { spray: K.gore ? +clamp(G, 0, 1).toFixed(2) : 0 });
    K.rip.push({ t0: K.ct, s: ev.s, k: G, way: -1 }); // the shock of it running out over the skin
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
    K.rip.push({ t0: K.ct, s: ev.s, k: Math.max(G * 0.6, X), way: 1 });
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
      if (false) for (let i = 0, nl = 3 + N(3 * X); i < nl; i++) K.lens.push({ t0: K.T + 0.22 + i * 0.13, x: 0.5 + (K.side > 0 ? 1 : -1) * (0.16 + R.f() * 0.26), y: 0.25 + R.f() * 0.45, r: 5 + R.f() * (9 + 6 * X), sd: R.f() * 9 });
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
// (12 is steam, which rises)
const kcDrag = [3.2, 0.5, 0.5, 0.5, 3.2, 0.8, 0.6, 1.6, 0.5, 4.5, 0.6, 0.5, 2.8], kcFall = [1.2, 9.8, 9.8, 9.8, 1.2, 9.8, 9.8, 3.5, 9.8, 0.35, 9.8, 9.8, -0.9];
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
function kcDrawPanes(ctx, K, c, al0) {
  const h = K.o.hit, ox = isFinite(h.ax) ? h.ax : h.x, oy = isFinite(h.ay) ? h.ay : h.y - 1, d = K.dir, pl = K.plan;
  const pane = (cx, cy, z, w, ht, mat, broken, hx, hy) => {
    const y0 = Math.max(0, cy - ht / 2), y1 = y0 + ht, x0 = cx - w / 2, x1 = cx + w / 2;
    // As the camera swings in, a corner of a wall can pass the lens. Fade the pane out as its nearest
    // corner comes up to the lens, rather than have it vanish from one frame to the next.
    const dep = (x, y) => (x - c.x) * c.fx + (y - c.y) * c.fy + (z - c.z) * c.fz;
    const near = Math.min(dep(x0, y0), dep(x1, y0), dep(x1, y1), dep(x0, y1));
    if (near < 0.03) return;
    const al = al0 * smooth((near - 0.03) / 0.6);
    if (al < 0.003) return;
    ctx.beginPath();
    if (!kcProj(c, x0, y0, z, kcQ)) return; ctx.moveTo(kcQ[0], kcQ[1]);
    if (!kcProj(c, x1, y0, z, kcQ)) return; ctx.lineTo(kcQ[0], kcQ[1]);
    if (!kcProj(c, x1, y1, z, kcQ)) return; ctx.lineTo(kcQ[0], kcQ[1]);
    if (!kcProj(c, x0, y1, z, kcQ)) return; ctx.lineTo(kcQ[0], kcQ[1]); ctx.closePath();
    const col = mat === 'glass' ? '#b9dcff' : mat === 'wood' ? '#7a5634' : mat === 'metal' ? '#8d96a0' : mat === 'interior' ? '#55525e' : '#8b7e72';
    ctx.globalAlpha = al * (mat === 'glass' ? 0.06 : 0.18); ctx.fillStyle = col; ctx.fill();
    ctx.globalAlpha = al * 0.18; ctx.strokeStyle = mix(col, '#ffffff', 0.35); ctx.lineWidth = 1; ctx.stroke();
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
    else if (K.take) kcDrawTake(K, V, ctx, dt || 0);
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
  // a whip: the picture streaks across for a moment
  if (K.whipping > 0.05 && !K.skipped) {
    ctx.strokeStyle = 'rgba(200,232,240,' + (0.16 * K.whipping).toFixed(3) + ')'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i = 0; i < 30; i++) { const y = kcHash(i + 11) * H, x = kcHash(i + 50) * W - W * 0.2, l = W * (0.15 + 0.35 * kcHash(i * 3.3)) * K.whipping; ctx.moveTo(x, y); ctx.lineTo(x + l, y); }
    ctx.stroke();
  }
  if (!K.skipped) { kcStatsDraw(ctx, K, V); kcStampDraw(ctx, K, V); }
  // the end: down to black, and the scope comes back out of it
  if (K.outT0 !== null) { const a = clamp((T - K.outT0) / K.tn.out, 0, 1); ctx.fillStyle = 'rgba(0,0,0,' + (a * a).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
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

// ---- stage 0: at the rifle: see src/21d_kcrifle.js ----------------------------------------------

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
  // a light round tumbling end over end, about its own middle
  if (o.tumble) { const ct = Math.cos(o.tumble), st = Math.sin(o.tumble), nx0 = dx * ct + e2x * st, ny0 = dy * ct + e2y * st, nz0 = dz * ct + e2z * st; dx = nx0; dy = ny0; dz = nz0; }
  dx += e1x * wx + e2x * wy; dy += e2y * wy; dz += e1z * wx + e2z * wy; l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
  e1x = dz; e1z = -dx; l = Math.hypot(e1x, e1z) || 1; e1x /= l; e1z /= l; e2x = dy * e1z; e2y = dz * e1x - dx * e1z; e2z = -dy * e1x;
  const bx0 = mx - dx * len * 0.45, by0 = my - dy * len * 0.45, bz0 = mz - dz * len * 0.45; // the base
  const pe = o.petal || 0;
  for (let i = 0; i < n; i++) {
    let u = kcProf[i * 2], r = kcProf[i * 2 + 1];
    if (m > 0) { const fr = clamp((u - 0.5) / 0.5, 0, 1); r += m * (0.78 * Math.sin(Math.PI * Math.pow(fr, 1.6)) + 0.55 * Math.pow(fr, 6)); u -= m * 0.2 * fr * fr; } // the nose spreads and shortens
    if (pe > 0 && u > 0.64) { u = lerp(u, 0.64, pe); r = lerp(r, 0.86, pe); } // a hollow point: the nose is gone into its petals
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
  if (pe > 0.02) {
    // Opened into petals: six strips of jacket peeled back from the nose, the lead core showing
    // between them. Each is a pointed blade in 3D, so they turn with the round.
    const fx = bx0 + dx * len * 0.64, fy = by0 + dy * len * 0.64, fz = bz0 + dz * len * 0.64, rr = 0.86 * rad;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const an = o.spin * 0.5 + (k * TAU) / 6;
      const c0 = Math.cos(an - 0.45), s0 = Math.sin(an - 0.45), c1 = Math.cos(an + 0.45), s1 = Math.sin(an + 0.45), cm = Math.cos(an), sm = Math.sin(an);
      const reach = rad * (0.5 + 1.25 * pe), back = len * (0.1 * (1 - pe) - 0.34 * pe); // peeled back along the body
      if (!kcProj(c, fx + (e1x * c0 + e2x * s0) * rr, fy + e2y * s0 * rr, fz + (e1z * c0 + e2z * s0) * rr, kcQ)) continue; ctx.moveTo(kcQ[0], kcQ[1]);
      if (!kcProj(c, fx + dx * back + (e1x * cm + e2x * sm) * (rr + reach), fy + dy * back + e2y * sm * (rr + reach), fz + dz * back + (e1z * cm + e2z * sm) * (rr + reach), kcQ)) continue; ctx.lineTo(kcQ[0], kcQ[1]);
      if (!kcProj(c, fx + (e1x * c1 + e2x * s1) * rr, fy + e2y * s1 * rr, fz + (e1z * c1 + e2z * s1) * rr, kcQ)) continue; ctx.lineTo(kcQ[0], kcQ[1]); ctx.closePath();
    }
    ctx.fillStyle = o.steel ? '#9aa6b2' : '#c87a3e'; ctx.fill(); ctx.strokeStyle = 'rgba(30,12,4,0.7)'; ctx.lineWidth = Math.max(0.6, R * 0.05); ctx.stroke();
    ctx.beginPath(); kcSet(kcV1, e1x * rr * 0.72, 0, e1z * rr * 0.72); kcSet(kcV2, e2x * rr * 0.72, e2y * rr * 0.72, e2z * rr * 0.72);
    if (kcEll(ctx, c, fx + dx * len * 0.01, fy + dy * len * 0.01, fz + dz * len * 0.01, kcV1, kcV2)) { ctx.fillStyle = o.steel ? '#3a4048' : '#5f6168'; ctx.fill(); }
  }
  if (o.hot > 0.02) { // still hot from the barrel (the coil slug glows blue-white)
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = (o.steel && o.hot > 0.5 ? 'rgba(120,210,255,' : 'rgba(255,130,50,') + (0.3 * o.hot).toFixed(3) + ')';
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

// ---- stages 2 to 4: the swing, the X-ray, the fall ----------------------------------------------
// Where the camera is comes from the director (src/21c_kcdirect.js). The scene: live through the
// first half of the swing, then the backdrop picture (darkened, blue) behind the X-ray, then live
// again as the body falls.
function kcDrawXray(K, V, ctx, dt) {
  const o = K.o, W = V.W, H = V.H, T = K.T, pl = K.plan, pal = kcPal(o), d = K.dir;
  const fig = kcBuildFig(K);
  // the middle of the body, for the fall's camera to follow (a little below, so the floor shows)
  { const P = fig.P, fx = (P.hip[0] + P.neck[0]) / 2, fy = Math.max(0.35, (P.hip[1] + P.neck[1]) / 2 - 0.15), fz = (P.hip[2] + P.neck[2]) / 2; if (!K.follow) K.follow = [fx, fy, fz]; else { const k = Math.min(1, (dt || 0) * 5); K.follow[0] += (fx - K.follow[0]) * k; K.follow[1] += (fy - K.follow[1]) * k; K.follow[2] += (fz - K.follow[2]) * k; } }
  const c = kcDirect(K, V);
  const u = clamp((T - K.Tb) / K.tn.swing, 0, 1), figA = smooth((u - 0.01) / 0.11);
  if (!K.bg && u >= 0.5) kcBgRender(K, V); // the backdrop, drawn once
  // how far the real scene has come back as the body falls
  const back = K.holdT0 !== null ? smooth((T - K.holdT0 - K.tn.fallIn * 0.35) / (K.tn.fallIn * 0.6)) : 0;
  const bgA = (K.bg ? smooth((u - 0.5) / 0.45) : 0) * (1 - back), xa = 1 - back;
  if (bgA < 0.999) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    // the flat figure is left out of the scene once the solid one is fully there, until the fall
    kcWorld(K, V, ctx, c, W, H, V.dpr, dt, K.simDt, figA > 0.99 && K.holdT0 === null, K.holdT0 !== null ? 1.2 : 0.6);
    ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  if (bgA > 0.004) { kcBgDraw(K, V, ctx, c, bgA); kcDrawPanes(ctx, K, c, bgA); }
  // how far the skin has turned to film
  const xr = smooth((T - (K.Tc - 0.65 * K.tn.swing)) / (0.38 * K.tn.swing)), infl = smooth((u - 0.12) / 0.5);
  if (xr < 0.99 && xa > 0.01) kcShell(ctx, K, c, fig, figA * xa, xr, infl, pal);
  if (xr > 0.01) kcXDraw(ctx, K, c, fig, figA * xr * xa);
  if (K.hitT !== null && xa > 0.01) { kcHoles(ctx, K, c, fig, figA * xa); kcRipples(ctx, K, c, fig); }
  // the round, while any of it is still to be seen
  const tipx = pl.H[0] + d[0] * K.s, tipz = pl.H[2] + d[2] * K.s;
  let tipy = pl.H[1] + d[1] * K.s, tum = 0;
  // a round with nothing left after the far side drops, turning over, to the floor
  if (K.spent && K.spentT !== undefined) { const ft = T - K.spentT; tipy = Math.max(K.rad, tipy - 1.6 * ft * ft); tum = Math.sin(Math.min(ft, 1.2) * 3) * 1.4; }
  const inside = K.hitT !== null ? clamp((K.s - pl.sIn) / 0.25, 0, 1) : 0;
  const bo = kcRoundLook(K, inside, tum);
  if (K.hitT === null) kcWake(ctx, c, tipx, tipy, tipz, d[0], d[1], d[2], { len: K.len, rad: K.rad, a: (K.sonic ? 0.9 : 0.35) * (1 - 0.5 * u), t: T, cone: K.sonic });
  kcDrawParts(ctx, K, c, null, 1 - back);
  if (back < 0.6) {
    // The round is drawn over the spray, so it can always be followed through the body. While it is
    // inside, a soft light round it lifts it off the gore (it is the one thing the eye must not lose).
    const glow = K.hitT !== null && (!K.exit || K.s < pl.sOut + 0.25) && !(K.spent && K.spentT !== undefined) ? smooth((K.s - pl.sIn + 0.01) / 0.03) : 0;
    if (glow > 0.01 && kcProj(c, tipx - d[0] * K.len * 0.5, tipy - d[1] * K.len * 0.5, tipz - d[2] * K.len * 0.5, kcQ)) {
      const gr = Math.max(8, K.len * kcQ[2] * 1.1), gg = ctx.createRadialGradient(kcQ[0], kcQ[1], 0, kcQ[0], kcQ[1], gr);
      gg.addColorStop(0, K.steel ? 'rgba(200,240,255,0.55)' : K.gore ? 'rgba(255,236,200,0.5)' : 'rgba(225,242,255,0.5)'); gg.addColorStop(1, 'rgba(255,236,200,0)');
      ctx.globalAlpha = glow * xa; ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(kcQ[0], kcQ[1], gr, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
    kcBullet(ctx, c, tipx, tipy, tipz, d[0], d[1], d[2], bo);
  }
  kcCaption(ctx, K, c, V);
}
// How the round looks now: spinning, its nose spreading (a soft or hollow point opens into petals),
// tumbling end over end (a light round), still hot.
function kcRoundLook(K, inside, tum) {
  const pl = K.plan, dep = K.hitT !== null ? Math.max(0, K.s - pl.sIn) : 0;
  const tumble = K.tumbleK && K.hitT !== null ? (K.cal === 'c22' ? 3.2 : 1.6) * smooth(dep / (K.cal === 'c22' ? 0.12 : 0.18)) : 0;
  return { len: K.len, rad: K.rad, spin: K.spin * (K.hitT !== null ? 0.5 : 2.2), mush: K.petal ? 0 : K.mush * 0.9, petal: K.petal ? easeOut(dep / 0.035) : 0, steel: K.steel || !K.gore, hot: K.steel ? 0.9 : 0.2 * (1 - inside),
    tilt: (K.through === false ? 0.42 : 0.2) * inside * Math.sin(inside * 2.1) * (K.tumbleK ? 0 : 1) + tum, tumble };
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
  // as the X-ray comes up, the outside fades away (the radiograph's own skin line takes over)
  const ink = pal.ink, aInk = 1 - xr, aCl = 1 - xr, rim = pal.rim;
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
  ctx.globalAlpha = alpha * (1 - xr); ctx.strokeStyle = rim; ctx.fillStyle = rim;
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
  ctx.globalAlpha = 1;
}
// Where the round went in and came out, on the skin: a small neat hole going in; coming out, a
// larger torn one, far more so for a big round.
function kcHoles(ctx, K, c, fig, alpha) {
  const pl = K.plan; if (!pl || alpha < 0.01) return;
  const fr = pl.part === 'head' ? fig.hd : fig.tor, bb = pl.part === 'head' ? pl.u0 : pl.b0, U = fr.U, F = fr.F;
  // (each lies flat on the skin, square to the round's line, so seen edge on it is a sliver)
  const ring = (cx, cy, cz, n, rf) => {
    for (let j = 0; j <= n; j++) {
      const an = (j % n) * (TAU / n), rr = rf(j % n), ca = Math.cos(an) * rr, sa = Math.sin(an) * rr;
      if (!kcProj(c, cx + U[0] * ca + F[0] * sa, cy + U[1] * ca + F[1] * sa, cz + U[2] * ca + F[2] * sa, kcQ)) return false;
      if (j) ctx.lineTo(kcQ[0], kcQ[1]); else ctx.moveTo(kcQ[0], kcQ[1]);
    }
    ctx.closePath(); return true;
  };
  for (let i = 0; i < 2; i++) {
    if (i === 1 && K.dmg.skin1 === undefined) break;
    kcLoc(fr, (i ? pl.sOut : pl.sIn) * fig.fs, bb, pl.c0, kcL0);
    const x = kcL0[0], y = kcL0[1], z = kcL0[2], r = Math.max(0.003, (i ? 0.006 + 0.026 * K.gx : 0.004 + 0.006 * K.gk) * (K.petal ? 1.4 : 1)), sd = i ? pl.sOut * 37 : pl.c0 * 53;
    if (K.gore) { // a ring of bruised, torn skin round it, in ragged tongues on the way out
      ctx.beginPath();
      if (ring(x, y, z, i ? 18 : 12, (j) => (i ? r * (j % 2 ? 0.95 : 1.4 + 1.1 * kcHash(j * 5.1 + sd)) : r * 1.6))) { ctx.globalAlpha = alpha * 0.75; ctx.fillStyle = '#7a0d15'; ctx.fill(); }
    }
    ctx.beginPath();
    if (ring(x, y, z, i ? 14 : 10, (j) => r * (i ? 0.6 + 0.6 * kcHash(j * 3.7 + sd) : 1))) { ctx.globalAlpha = alpha; ctx.fillStyle = K.gore ? '#2a0306' : '#020a10'; ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}
// A .50 through the head: the vault bursts (the pieces are drawn by kcXBurst); out with them go
// brain, blood and bone.
function kcBurst(K) {
  const pl = K.plan, d = K.dir, H = pl.H, at = [H[0], H[1] + 0.02, H[2]], N = (x) => Math.max(0, Math.round(x));
  if (K.gore) {
    kcSpray(K, 3, N(22), at, 1, 0.9, 0.6, 4, 0.005, 0.012, 3);
    kcSpray(K, 1, N(120), at, 1, 0.85, 0.8, 6, 0.003, 0.012, 3);
    kcSpray(K, 0, N(60), at, 1, 0.9, 0.4, 3, 0.004, 0.01, 0.8);
    kcSpray(K, 9, N(8), at, 1, 0.8, 0.3, 1.6, 0.04, 0.09, 2.4);
  }
  kcSpray(K, 2, N(40), at, 1, 0.9, 1, 5, 0.008, 0.024, 3);
  kcSay(K, 'bone', { bone: 'skull' });
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

// The shock of the round going in (and coming out) running out over the skin as a ring, and just
// before a round breaks out, the skin of the far side pushed out ahead of it. Bigger for a bigger round.
function kcRipples(ctx, K, c, fig) {
  const pl = K.plan, d = K.dir, T = K.ct, fr = pl.part === 'head' ? fig.hd : fig.tor, bb = pl.part === 'head' ? pl.u0 : pl.b0;
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
function kcDrawParts(ctx, K, c, list, al) {
  const ps = list || K.parts; if (!ps.length) return;
  if (al === undefined) al = 1; if (al < 0.01) return;
  ctx.lineCap = 'round';
  const flat = Math.max(0.12, Math.abs(Math.sin(c.pitch)));
  // the hanging cloud: soft red puffs that swell, drift and thin out, behind everything else
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]; if (p.k !== 9 || !kcProj(c, p.x, p.y, p.z, kcQ)) continue;
    const u = clamp(p.age / p.life, 0, 1), r = Math.max(2, p.r * kcQ[2] * (1 + 2.2 * Math.sqrt(u))), a = 0.34 * smooth(p.age / 0.04) * (1 - u) * (1 - u);
    if (a < 0.01) continue;
    const g = ctx.createRadialGradient(kcQ[0], kcQ[1], 0, kcQ[0], kcQ[1], r);
    g.addColorStop(0, 'rgba(150,14,24,' + a.toFixed(3) + ')'); g.addColorStop(0.55, 'rgba(120,10,20,' + (a * 0.55).toFixed(3) + ')'); g.addColorStop(1, 'rgba(90,6,14,0)');
    ctx.globalAlpha = al * 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(kcQ[0], kcQ[1], r, 0, TAU); ctx.fill();
  }
  // mist and dust: soft dots that swell and thin (a faint wider ring round each, so they blur together)
  for (let pass = 0; pass < 13; pass += pass === 4 ? 8 : 4) {
    ctx.fillStyle = pass === 0 ? '#a3141c' : pass === 4 ? '#cfe4f5' : '#eaf7fc';
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]; if (p.k !== pass || !kcProj(c, p.x, p.y, p.z, kcQ)) continue;
      const u = p.age / p.life, st = pass === 12, a = (st ? 0.11 * smooth(u / 0.15) : pass ? 0.22 : 0.4) * (1 - u) * (1 - u * 0.5), r = Math.max(1, p.r * kcQ[2] * (st ? 1 : pass ? 0.7 : 1) * (1 + u * (st ? 5 : pass ? 1.4 : 2.4)));
      ctx.globalAlpha = al * a * 0.3; ctx.beginPath(); ctx.arc(kcQ[0], kcQ[1], r * 1.9, 0, TAU); ctx.fill();
      ctx.globalAlpha = al * a * 0.75; ctx.beginPath(); ctx.arc(kcQ[0], kcQ[1], r, 0, TAU); ctx.fill();
    }
  }
  // drops: a round head and a tail drawn back along the way it came. Tails and heads are
  // filled as two separate shapes so that where they overlap they cannot cancel out.
  for (let pass = 1; pass <= 3; pass += 2) {
    ctx.fillStyle = pass === 1 ? '#b3151d' : '#a86a72';
    for (let shape = 0; shape < 2; shape++) {
      ctx.globalAlpha = al * 0.95; ctx.beginPath();
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i]; if (p.k !== pass || !kcProj(c, p.x, p.y, p.z, kcQ)) continue;
        const s = kcQ[2], x = kcQ[0], y = kcQ[1], fade = clamp((p.life - p.age) / 0.05, 0, 1), r = Math.max(0.7, p.r * s * 0.62) * (0.4 + 0.6 * fade);
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
      const r = Math.max(1.1, p.r * kcQ[2] * 0.7) * (pass ? 0.45 : 1) * (0.4 + 0.6 * clamp((p.life - p.age) / 0.06, 0, 1)), sq = p.stuck ? flat : 0.6 + 0.4 * Math.abs(Math.sin(p.rot * 0.7));
      const x = kcQ[0] - (pass ? r * 0.35 : 0), y = kcQ[1] - (pass ? r * 0.4 : 0), ro = p.rot, ca = Math.cos(ro), sa = Math.sin(ro);
      for (let j = 0; j < 5; j++) { // five lobes of uneven size round the middle
        const an = j * 1.2566, rr = r * (0.7 + 0.5 * kcHash(j * 7.3 + p.r * 9e3)), lx = Math.cos(an) * rr, ly = Math.sin(an) * rr * sq;
        const px = x + lx * ca - ly * sa, py = y + lx * sa + ly * ca;
        if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
    }
    ctx.globalAlpha = al * pass ? 0.55 : 0.95; ctx.fill();
  }
  // splinters (of bone, of wood) and chips of brick: short sticks, turning
  for (let pass = 0; pass < 3; pass++) {
    const kind = pass === 0 ? 2 : pass === 1 ? 6 : 8;
    ctx.strokeStyle = kind === 2 ? (K.gore ? '#efe7d2' : '#d9ecfa') : kind === 6 ? '#b88a55' : '#a29a90';
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]; if (p.k !== kind || !kcProj(c, p.x, p.y, p.z, kcQ)) continue;
      const s = kcQ[2], l = p.r * s * (kind === 8 ? 0.3 : kind === 2 ? 0.42 : 0.5), cs = Math.cos(p.rot), sn = Math.sin(p.rot) * (p.stuck ? flat : 1);
      ctx.globalAlpha = al * clamp((p.life - p.age) / 0.06, 0, 1); ctx.lineWidth = Math.max(1, p.r * s * (kind === 8 ? 0.45 : kind === 2 ? 0.11 : 0.28)); ctx.beginPath(); ctx.moveTo(kcQ[0] - cs * l, kcQ[1] - sn * l); ctx.lineTo(kcQ[0] + cs * l, kcQ[1] + sn * l); ctx.stroke();
    }
  }
  // glass: small bright shards that turn and catch the light
  ctx.fillStyle = '#d6ecff';
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]; if (p.k !== 5 || !kcProj(c, p.x, p.y, p.z, kcQ)) continue;
    const r = Math.max(1.2, p.r * kcQ[2]), a = p.rot, w = 0.45 + 0.55 * Math.abs(Math.sin(p.rot * 1.7));
    ctx.globalAlpha = al * 0.85 * clamp((p.life - p.age) / 0.1, 0, 1);
    ctx.beginPath(); ctx.moveTo(kcQ[0] + Math.cos(a) * r, kcQ[1] + Math.sin(a) * r * w); ctx.lineTo(kcQ[0] + Math.cos(a + 2.3) * r * 0.6, kcQ[1] + Math.sin(a + 2.3) * r * 0.6 * w); ctx.lineTo(kcQ[0] + Math.cos(a + 4.1) * r * 0.8, kcQ[1] + Math.sin(a + 4.1) * r * 0.8 * w); ctx.closePath(); ctx.fill();
  }
  // sparks: bright streaks along the way they fly
  ctx.strokeStyle = '#ffd98a'; ctx.lineCap = 'round';
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]; if (p.k !== 7 || !kcProj(c, p.x, p.y, p.z, kcQ) || !kcProj(c, p.x - p.vx * 0.012, p.y - p.vy * 0.012, p.z - p.vz * 0.012, kcQ2)) continue;
    ctx.globalAlpha = al * clamp(1 - p.age / p.life, 0, 1); ctx.lineWidth = Math.max(1, p.r * kcQ[2]); ctx.beginPath(); ctx.moveTo(kcQ[0], kcQ[1]); ctx.lineTo(kcQ2[0], kcQ2[1]); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
