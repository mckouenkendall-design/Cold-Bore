// ---------------------------------------------------------------------------
// Stick figures: poses, drawing, and the shapes bullets are tested against.
// Local space: feet at (0,0), y up, facing +x. Units are metres.
// ---------------------------------------------------------------------------
const FIG = { hip: 0.86, torso: 0.56, headUp: 0.2, headR: 0.17, thigh: 0.44, shin: 0.44, arm: 0.29, fore: 0.29, lw: 0.085 };

// Build joint positions from a handful of angles. Angles are measured from
// "hanging straight down"; positive swings forward.
function figJoints(p) {
  const hx = p.hx || 0, hy = p.hy === undefined ? FIG.hip : p.hy;
  const lean = p.lean || 0;
  const nx = hx + Math.sin(lean) * FIG.torso, ny = hy + Math.cos(lean) * FIG.torso;
  const ht = lean * 0.6 + (p.head || 0);
  const J = {
    hip: [hx, hy], neck: [nx, ny],
    head: [nx + Math.sin(ht) * FIG.headUp, ny + Math.cos(ht) * FIG.headUp],
  };
  const sx = hx + Math.sin(lean) * (FIG.torso - 0.05), sy = hy + Math.cos(lean) * (FIG.torso - 0.05);
  J.sh = [sx, sy];
  const limb = (ox, oy, a, l1, b, l2) => {
    const mx = ox + Math.sin(a) * l1, my = oy - Math.cos(a) * l1;
    return [[mx, my], [mx + Math.sin(b) * l2, my - Math.cos(b) * l2]];
  };
  let r = limb(hx, hy, p.tL || 0, FIG.thigh, (p.tL || 0) - (p.kL || 0), FIG.shin); J.knL = r[0]; J.ftL = r[1];
  r = limb(hx, hy, p.tR || 0, FIG.thigh, (p.tR || 0) - (p.kR || 0), FIG.shin); J.knR = r[0]; J.ftR = r[1];
  r = limb(sx, sy, p.aL || 0, FIG.arm, (p.aL || 0) + (p.eL || 0), FIG.fore); J.elL = r[0]; J.haL = r[1];
  r = limb(sx, sy, p.aR || 0, FIG.arm, (p.aR || 0) + (p.eR || 0), FIG.fore); J.elR = r[0]; J.haR = r[1];
  return J;
}

// ---- walking and running ---------------------------------------------------
// The feet are placed, not swung. Each foot stands on the ground for part of the stride and
// travels back under the body at exactly the speed the person is walking, so on the ground it
// stays where it was put; then it lifts, swings forward and lands again. The legs are fitted to
// the feet (thigh and shin reaching from the hip). That only works if one cycle of the walk
// phase (A.ph, 2 pi) covers the same ground as the body does, so the simulation advances A.ph by
// `k` radians for every metre walked (src/05_sim.js) and the stride below is worked out from it.
//   k     phase per metre: one whole cycle (two steps) covers 2 pi / k metres
//   duty  the part of a cycle each foot is on the ground (more than half: both feet are down for a
//         moment at every step when walking; less than half: nobody is on the ground for a moment
//         when running)
//   lift  how high the foot is carried at the top of its swing, hy the hip height, dip how far the
//         hip sinks onto a running leg
const FIG_GAIT = {
  walk: { k: 4.8, duty: 0.58, lift: 0.055, hy: FIG.hip - 0.004, dip: 0, kick: 0.5 },
  run: { k: 2.6, duty: 0.34, lift: 0.22, hy: FIG.hip - 0.035, dip: 0.04, kick: 0.6 },
};
const FIG_FOOT_Y = -0.018; // where the ankle joint sits when the shoe is flat on the ground (as in the standing pose)
// Fit one leg to a foot at (fx, fy), with the hip at (0, hy). Thigh and shin are the same length.
function figLegTo(p, side, hy, fx, fy) {
  const l = FIG.thigh, dy = hy - fy, d = Math.min(Math.hypot(fx, dy), 2 * l - 0.002);
  const k = 2 * Math.acos(Math.min(1, d / (2 * l))), a = Math.atan2(fx, dy);
  if (side) { p.tR = a + k / 2; p.kR = k; } else { p.tL = a + k / 2; p.kL = k; }
}
// Where a foot is at leg phase s (0 to 1, 0 = the moment it lands, out in front).
const FIG_FT = [0, 0, 0];
function figFoot(G, D, h, s) {
  if (s < G.duty) { // planted: straight back at the walking speed, the heel and then the toes taking the weight at either end
    const u = s / G.duty, e = (2 * u - 1) * (2 * u - 1);
    FIG_FT[0] = h * (1 - 2 * u); FIG_FT[1] = FIG_FOOT_Y + 0.05 * e * e; FIG_FT[2] = u; return true;
  }
  // in the air: forward on a curve that leaves and meets the ground moving at the same speed as the planted foot
  const u = (s - G.duty) / (1 - G.duty), u2 = u * u, u3 = u2 * u, m = -D * (1 - G.duty);
  FIG_FT[0] = (2 * u3 - 3 * u2 + 1) * -h + (u3 - 2 * u2 + u) * m + (-2 * u3 + 3 * u2) * h + (u3 - u2) * m;
  // a running foot kicks up behind first and comes through low, a walking one just clears the ground
  const bump = Math.sin(Math.PI * u) * (1 + G.kick * (0.5 - u));
  FIG_FT[1] = FIG_FOOT_Y + 0.05 + G.lift * Math.max(0, bump); FIG_FT[2] = u; return false;
}
function figGait(p, G, ph) {
  const D = TAU / G.k, h = (D * G.duty) / 2, R = 2 * FIG.thigh - 0.006;
  let sL = (ph - Math.PI / 2) / TAU; sL -= Math.floor(sL); let sR = sL + 0.5; if (sR >= 1) sR -= 1;
  const onL = figFoot(G, D, h, sL), xL = FIG_FT[0], yL = FIG_FT[1], uL = FIG_FT[2];
  const onR = figFoot(G, D, h, sR), xR = FIG_FT[0], yR = FIG_FT[1], uR = FIG_FT[2];
  // the hip rides as high as it likes, but never so high that a planted foot cannot reach the ground
  let hy = G.hy;
  if (onL) hy = Math.min(hy - G.dip * Math.sin(Math.PI * uL), yL + Math.sqrt(R * R - xL * xL));
  if (onR) hy = Math.min(hy - G.dip * Math.sin(Math.PI * uR), yR + Math.sqrt(R * R - xR * xR));
  p.hy = hy;
  figLegTo(p, 0, hy, xL, yL); figLegTo(p, 1, hy, xR, yR);
}

// What somebody holds up when they aim: their rifle if they carry one, otherwise a pistol. The
// simulation gives a rifle (look.gun) to anyone a mission ever shows holding one (see figHoldsRifle),
// so a gunman never raises a pistol while a rifle hangs on his back, nor pulls a rifle out of nowhere.
function figAimAs(A, an) { return an === 'aim' || an === 'aimrifle' ? (A.look && A.look.gun === 'rifle' ? 'aimrifle' : 'aim') : an; }
function figHoldsRifle(d) {
  const has = (r) => !!r && r.some((op) => Array.isArray(op) && ((op[0] === 'wait' && (op[2] === 'guard' || op[2] === 'aimrifle')) || (op[0] === 'anim' && (op[1] === 'guard' || op[1] === 'aimrifle'))));
  return d.anim === 'guard' || d.anim === 'aimrifle' || has(d.routine) || has(d.flee);
}

// Pose for a named animation at time t (seconds). `ph` is the walk phase.
function figPose(anim, t, ph, A) {
  const b = Math.sin(t * 1.6 + (A.seed || 0)) * 0.015;
  const p = { hy: FIG.hip + b * 0.4, lean: 0, tL: 0.04, tR: -0.04, kL: 0.02, kR: 0.02, aL: 0.06, aR: -0.06, eL: 0.12, eR: 0.12 };
  const s = Math.sin(ph);
  anim = figAimAs(A, anim);
  switch (anim) {
    case 'walk':
      figGait(p, FIG_GAIT.walk, ph);
      p.aL = -0.38 * s; p.aR = 0.38 * s; p.eL = 0.28; p.eR = 0.28; p.lean = 0.05;
      break;
    case 'run': case 'panic':
      figGait(p, FIG_GAIT.run, ph); p.lean = 0.24;
      if (anim === 'panic') { p.aL = 2.7 + 0.3 * s; p.aR = 2.5 - 0.3 * s; p.eL = 0.5; p.eR = 0.5; p.lean = 0.16; }
      else { p.aL = -0.9 * s; p.aR = 0.9 * s; p.eL = 1.4; p.eR = 1.4; }
      break;
    case 'climb': { // up a ladder: hand over hand, a foot up to the next rung with each
      const c = t * 3.4 + (A.seed || 0), u = Math.sin(c), v = Math.max(0, Math.sin(c + 1.2));
      p.lean = 0.12; p.head = -0.25;
      p.aL = 2.55 + 0.35 * u; p.eL = 0.45 - 0.3 * u; p.aR = 2.55 - 0.35 * u; p.eR = 0.45 + 0.3 * u;
      p.tL = 0.35 + 0.55 * Math.max(0, u); p.kL = 0.3 + 1.0 * Math.max(0, u); p.tR = 0.35 + 0.55 * Math.max(0, -u); p.kR = 0.3 + 1.0 * Math.max(0, -u);
      p.hy = FIG.hip - 0.06 - 0.04 * v;
      break;
    }
    case 'held': { // the pose somebody was in when they began to change it (see figPoseChange)
      const q = A.poseFrom; if (q) for (let i = 0; i < POSE_KEYS.length; i++) { const key = POSE_KEYS[i]; if (q[key] !== undefined) p[key] = q[key]; }
      break;
    }
    case 'phone':
      p.aR = 0.35; p.eR = 2.45; p.head = 0.06;
      p.aL = 0.05 + 0.04 * Math.sin(t * 0.7);
      break;
    case 'smoke': {
      const cyc = (t + (A.seed || 0) * 3) % 5.2;
      const up = cyc < 1.4 ? smooth(cyc / 0.35) * (1 - smooth((cyc - 1.05) / 0.35)) : 0;
      p.aR = lerp(0.1, 0.5, up); p.eR = lerp(0.35, 2.3, up);
      break;
    }
    case 'drink': {
      const cyc = (t + (A.seed || 0) * 3) % 6.5;
      const up = cyc < 1.6 ? smooth(cyc / 0.4) * (1 - smooth((cyc - 1.2) / 0.4)) : 0;
      p.aR = lerp(0.35, 0.55, up); p.eR = lerp(1.2, 2.25, up); p.head = -0.12 * up;
      break;
    }
    case 'talk':
      p.aR = 0.5 + 0.2 * Math.sin(t * 3.1 + (A.seed || 0)); p.eR = 1.3 + 0.45 * Math.sin(t * 2.3);
      p.aL = 0.15; p.eL = 0.5 + 0.2 * Math.sin(t * 1.7);
      p.head = 0.05 * Math.sin(t * 1.3);
      break;
    case 'sit': case 'type': case 'sitphone': case 'sitdrink':
      p.hy = 0.5; p.tL = 1.5; p.tR = 1.42; p.kL = 1.5; p.kR = 1.42; p.lean = 0.04;
      if (anim === 'type') { p.aL = 0.75; p.eL = 0.8 + 0.06 * Math.sin(t * 9); p.aR = 0.7; p.eR = 0.85 + 0.06 * Math.cos(t * 11); p.lean = 0.12; }
      else if (anim === 'sitphone') { p.aR = 0.35; p.eR = 2.45; p.aL = 0.5; p.eL = 0.9; }
      else if (anim === 'sitdrink') { const u = (Math.sin(t * 0.9 + (A.seed || 0)) > 0.75) ? 1 : 0; p.aR = 0.5; p.eR = u ? 2.2 : 1.2; p.aL = 0.5; p.eL = 0.9; }
      else { p.aL = 0.55; p.eL = 0.9; p.aR = 0.5; p.eR = 0.95; }
      break;
    case 'lean':
      p.lean = 0.3; p.aL = 0.75; p.eL = 0.55; p.aR = 0.85; p.eR = 0.5; p.tL = -0.12; p.tR = -0.2; p.hy = FIG.hip - 0.02;
      break;
    case 'guard':
      p.aL = 0.55; p.eL = 1.15; p.aR = 0.12; p.eR = 1.55; p.tL = 0.1; p.tR = -0.1;
      break;
    case 'aim':
      p.aL = 1.45; p.eL = 0.1; p.aR = 1.5; p.eR = 0.05; p.tL = 0.22; p.tR = -0.2; p.lean = 0.06;
      break;
    case 'aimrifle':
      p.aL = 1.25; p.eL = 0.4; p.aR = 0.7; p.eR = 1.5; p.tL = 0.25; p.tR = -0.22; p.lean = 0.1;
      break;
    case 'look':
      p.aL = 0.75; p.eL = 2.2; p.aR = 0.7; p.eR = 2.25; p.head = -0.05;
      break;
    case 'wave':
      p.aR = 2.6 + 0.25 * Math.sin(t * 7); p.eR = 0.4;
      break;
    case 'point':
      p.aR = 1.5; p.eR = 0.05; p.lean = 0.06;
      break;
    case 'kneel':
      p.hy = 0.47; p.tL = 0.4; p.kL = 1.95; p.tR = 0.3; p.kR = 1.9; p.aL = -0.5; p.eL = -0.7; p.aR = -0.55; p.eR = -0.7; p.lean = 0.08; p.head = 0.25;
      break;
    case 'cower':
      p.hy = 0.5; p.tL = 1.25; p.kL = 2.3; p.tR = 1.15; p.kR = 2.25; p.lean = 0.55; p.aL = 2.5; p.eL = 0.9; p.aR = 2.4; p.eR = 1.0;
      p.hx = 0.02 * Math.sin(t * 18);
      break;
    case 'work': // hands busy at waist height (welding, fishing, counting money)
      p.lean = 0.18; p.aL = 0.7; p.eL = 0.8 + 0.1 * Math.sin(t * 5); p.aR = 0.6; p.eR = 0.9 + 0.1 * Math.cos(t * 6);
      break;
    case 'sweep':
      p.lean = 0.22; p.aL = 0.6 + 0.2 * Math.sin(t * 2.4); p.eL = 0.5; p.aR = 0.3 + 0.2 * Math.sin(t * 2.4); p.eR = 0.9;
      break;
    case 'arms': // arms crossed, bored
      p.aL = 0.35; p.eL = 1.9; p.aR = 0.3; p.eR = 1.95;
      break;
    case 'hands': // hands up, surrendering
      p.aL = 2.75; p.eL = 0.25; p.aR = 2.6; p.eR = 0.3;
      break;
    case 'drive':
      p.hy = 0.5; p.tL = 1.5; p.tR = 1.45; p.kL = 1.3; p.kR = 1.3; p.aL = 1.0; p.eL = 0.5; p.aR = 1.05; p.eR = 0.45; p.lean = -0.08;
      break;
    case 'sleep':
      p.hy = 0.5; p.tL = 1.5; p.tR = 1.42; p.kL = 1.5; p.kR = 1.42; p.lean = -0.25; p.head = 0.5; p.aL = 0.2; p.aR = 0.15;
      break;
    // Handing something over. The near arm goes out over half a second (k), slower than the
    // quarter second every change of pose takes, so it reads as a reach rather than a twitch.
    // When it is the pose being left behind, the figure eases out of it from wherever the arm had got to.
    case 'handover': { // standing, stooped a little, holding something out at waist height
      const k = (A.animCur || A.anim) === anim && A.animAt !== undefined ? smooth((t - A.animAt) / 0.5) : 1;
      p.lean = 0.05 + 0.25 * k; p.head = 0.08 * k; p.tL = 0.14; p.tR = -0.12; p.aL = 0.12; p.eL = 0.3;
      p.aR = lerp(0.1, 1.0, k); p.eR = lerp(0.2, 0.25, k);
      break;
    }
    // Seated in a car with the near hand busy, as a chain: 'sitreach' rises from the wheel to take
    // something held out, 'sitread' brings it in to the chest to look at, 'sitpass' carries it back
    // over the shoulder to whoever sits behind. Each one starts where the one before it ends, so
    // the hand never drops out of the window on the way. The head and body stay where they are.
    case 'sitreach': case 'sitpass': case 'sitread': {
      const k = (A.animCur || A.anim) === anim && A.animAt !== undefined ? smooth((t - A.animAt) / 0.5) : 1;
      p.hy = 0.5; p.tL = 1.5; p.tR = 1.45; p.kL = 1.3; p.kR = 1.3; p.aL = 1.0; p.eL = 0.5; p.lean = -0.08;
      if (anim === 'sitreach') { p.aR = lerp(1.05, 1.65, k); p.eR = lerp(0.45, 0.95, k); }
      else if (anim === 'sitread') { p.aR = lerp(1.65, 0.9, k); p.eR = lerp(0.95, 1.78, k); p.head = 0.14 * k; }
      else { // the forearm turns up and over (its angle runs from 2.68 to 3.85) while the upper arm swings back
        p.aR = lerp(0.9, -1.85, k); p.eR = k < 1 ? lerp(1.78, 5.7, k) : -0.58; p.head = lerp(0.14, -0.12, k);
      }
      break;
    }
    default: // stand
      p.aL = 0.07 + b; p.aR = -0.05 - b;
  }
  return p;
}

const POSE_BLEND = 0.26, POSE_KEYS = ['hx', 'hy', 'lean', 'head', 'tL', 'tR', 'kL', 'kR', 'aL', 'aR', 'eL', 'eR'];

// ---- changing pose ----------------------------------------------------------
// Every change of pose eases over POSE_BLEND seconds, out of whatever the figure looked like at
// that moment. The simulation calls figPoseChange when it notices that A.anim has changed (in its
// step for that person, src/05_sim.js). Until then the figure goes on showing A.animCur, the pose
// it was already in, so a pose set from outside the person's own step (by a shot, an alarm or a
// mission's trigger) is never drawn for a frame before its ease begins.
// The pose being left is frozen, exactly as it was on screen, in A.poseFrom and goes by the name
// 'held'. Because it is the pose as drawn, a change that comes while the last one is still easing
// in starts from that half-way pose, and nothing jumps. A pose that lasts a single step (a walker
// reaching a waypoint goes to his idle pose for one step before setting off to the next) is
// forgotten, and the ease that was running before it carries on as if it had never happened.
function figAnimNow(A) { return figAimAs(A, A.animCur || A.anim || 'stand'); }
function figLivePose(A) {
  const t = A.t || 0, ph = A.ph || 0, p = figPose(A.animCur || A.anim || 'stand', t, ph, A);
  if (A.animFrom && A.animAt !== undefined) {
    const u = (t - A.animAt) / POSE_BLEND;
    if (u >= 0 && u < 1) { const q = figPose(A.animFrom, t, ph, A), k = smooth(u); for (let i = 0; i < POSE_KEYS.length; i++) { const key = POSE_KEYS[i]; p[key] = lerp(q[key] || 0, p[key] || 0, k); } }
  }
  return p;
}
// How much the person is walking (1) or running (2) right now, eased like the pose.
function figMv(A) {
  let mv = figMoving(A.animCur || A.anim);
  if (A.animFrom && A.animAt !== undefined) {
    const u = ((A.t || 0) - A.animAt) / POSE_BLEND;
    if (u >= 0 && u < 1) mv = lerp(A.animFrom === 'held' ? (A.poseFrom && A.poseFrom.mv) || 0 : figMoving(A.animFrom), mv, smooth(u));
  }
  return mv;
}
function figPoseChange(A) {
  const to = A.anim, B = A.animBack;
  if (B && B.anim === to && (A.t || 0) - A.animAt < 0.05) { A.animCur = to; A.animFrom = B.from; A.animAt = B.at; A.poseFrom = B.pose; A.animBack = null; return; }
  const p = figLivePose(A), q = { mv: figMv(A) };
  for (let i = 0; i < POSE_KEYS.length; i++) { const key = POSE_KEYS[i]; q[key] = p[key] || 0; }
  A.animBack = { anim: A.animCur, from: A.animFrom, at: A.animAt, pose: A.poseFrom };
  A.poseFrom = q; A.animFrom = 'held'; A.animAt = A.t || 0; A.animCur = to;
}

// ---- dying -----------------------------------------------------------------
// A dead body is a ragdoll: see src/13_ragdoll.js. The pose it died in comes from figPose
// above; from then on the solver there moves it, and actorJoints below asks it where the
// joints are.

// Joints for an actor right now, in the actor's local space (already
// mirrored for facing and scaled for height).
function actorJoints(A) {
  // the dead: wherever the ragdoll has got to (already facing the right way and scaled)
  if (A.dead) return rdJoints(A, (A.deadT || 0) + rdLead);
  const J = figJoints(figLivePose(A));
  // turning round: the figure narrows through the turn rather than flipping in one frame
  let f = A.face || 1;
  if (A.faceS !== undefined && Math.abs(A.faceS) < 1) f = (A.faceS < 0 ? -1 : 1) * Math.max(0.22, Math.abs(A.faceS));
  const sc = (A.look && A.look.h) || 1;
  for (const k in J) { J[k][0] *= f * sc; J[k][1] *= sc; }
  J.scale = sc; J.f = f; // f: which way the figure faces right now, between -1 and 1 while it is turning
  return J;
}

// Which part of the figure, if any, is at point (px, py) in local space.
function distSeg(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - a[0]) * dx + (py - a[1]) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (a[0] + dx * t), py - (a[1] + dy * t));
}
function figHit(J, px, py) {
  const sc = J.scale || 1;
  if (Math.hypot(px - J.head[0], py - J.head[1]) <= FIG.headR * sc + 0.012) return 'head';
  if (distSeg(px, py, J.hip, J.neck) <= 0.15 * sc) return 'torso';
  const limbR = 0.07 * sc;
  if (distSeg(px, py, J.hip, J.knL) <= limbR || distSeg(px, py, J.knL, J.ftL) <= limbR ||
      distSeg(px, py, J.hip, J.knR) <= limbR || distSeg(px, py, J.knR, J.ftR) <= limbR) return 'leg';
  if (distSeg(px, py, J.sh, J.elL) <= limbR || distSeg(px, py, J.elL, J.haL) <= limbR ||
      distSeg(px, py, J.sh, J.elR) <= limbR || distSeg(px, py, J.elR, J.haR) <= limbR) return 'arm';
  return null;
}

// ---- drawing ---------------------------------------------------------------
// How much is drawn depends on how tall the person is on screen:
//   under 14 px     a bare stick in its colours (figDrawFar)
//   14 to 45 px     proper shapes: clothes, hat, bag, shoes, but no small detail
//   above 45 px     everything, and from about 110 px the finest touches (seams, zips, buckles)
// The skeleton is never changed here. All of this is paint on top of the joints.
const FIG_FAR = 14, FIG_MID = 45, FIG_FINE = 110;
const FIG_JN = ['hip', 'neck', 'head', 'sh', 'knL', 'ftL', 'knR', 'ftR', 'elL', 'haL', 'elR', 'haR'];
// Everyday clothes for people whose look does not say what they wear. Quiet on purpose:
// nothing here may ever be mistaken for something a mission tells the player to look for.
const FIG_TOPS = ['#3c424b', '#2f3a4e', '#4a4035', '#424a38', '#50545a', '#33383f'];
const FIG_LEGS = ['#2a2f3a', '#31353b', '#3a3229', '#33392d', '#25292f'];
const FIG_SHOES = ['#101114', '#2b2119', '#1c1e23'];

// The figure being drawn right now. One at a time, so one shared record and no garbage.
const FGS = { ctx: null, A: null, L: null, env: null, st: null, anim: 'stand', px: 1, hi: false, fine: false, f: 1, fs: 1, fa: 1, fl: 1, wl: 1,
  sc: 1, ink: '#13161b', rim: null, rw: 0.02, light: 1, la: 0, lc: '#ffffff', lx: 0, ly: 1, hlx: 0, hly: 1, t: 0, seed: 0, bw: 1, lag: 0, mv: 0, dead: false, dT: 0, seated: false, grip: false,
  ux: 0, uy: 1, nx: 1, ny: 0, T: 0.56, ww: 0.08, wc: 0.09, wsh: 0.1, hdx: 0, hdy: 0, htilt: 0, wind: 0,
  cR: null, cL: null, dR: [0, 0], dL: [0, 0], nearHand: false,
  hip: [0, 0], neck: [0, 0], head: [0, 0], sh: [0, 0], knL: [0, 0], ftL: [0, 0], knR: [0, 0], ftR: [0, 0], elL: [0, 0], haL: [0, 0], elR: [0, 0], haR: [0, 0] };

function figSeg(ctx, a, b) { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }

// Colours as they look in this light. `figDimK` is how far into the dark the person is.
let figDimK = 0;
const figHex = (c) => typeof c === 'string' && c.charAt(0) === '#';
function figC(c) { return figDimK > 0 && figHex(c) ? mix(c, '#05070b', figDimK) : c; }
function figSh(c, k) { return figHex(c) ? figC(mix(c, '#07090d', k)) : c; } // a darker shade of it
function figHi(c, k) { return figHex(c) ? figC(mix(c, '#ffffff', k)) : c; } // a paler tint of it

// A limb segment that tapers from radius ra to rb, with round ends, added to the current path.
function figCap(c, ax, ay, bx, by, ra, rb) {
  let dx = bx - ax, dy = by - ay; const l = Math.hypot(dx, dy);
  if (l > 1e-4) {
    dx /= l; dy /= l;
    c.moveTo(ax + dy * ra, ay - dx * ra); c.lineTo(bx + dy * rb, by - dx * rb); c.lineTo(bx - dy * rb, by + dx * rb); c.lineTo(ax - dy * ra, ay + dx * ra); c.closePath();
    c.moveTo(bx + rb, by); c.arc(bx, by, rb, 0, TAU);
  }
  c.moveTo(ax + ra, ay); c.arc(ax, ay, ra, 0, TAU);
}
// Two tapering segments a-b-d (upper arm and forearm, thigh and shin) with one round joint at b
// and a round end at d. The round start at a is added only when it can be seen.
function figQuad(c, ax, ay, bx, by, ra, rb) {
  let dx = bx - ax, dy = by - ay; const l = Math.hypot(dx, dy);
  if (l < 1e-4) return;
  dx /= l; dy /= l;
  c.moveTo(ax + dy * ra, ay - dx * ra); c.lineTo(bx + dy * rb, by - dx * rb); c.lineTo(bx - dy * rb, by + dx * rb); c.lineTo(ax - dy * ra, ay + dx * ra); c.closePath();
}
function figChain(c, ax, ay, bx, by, dx, dy, r0, r1, r2, start) {
  figQuad(c, ax, ay, bx, by, r0, r1); figQuad(c, bx, by, dx, dy, r1, r2);
  c.moveTo(bx + r1, by); c.arc(bx, by, r1, 0, TAU); c.moveTo(dx + r2, dy); c.arc(dx, dy, r2, 0, TAU);
  if (start) { c.moveTo(ax + r0, ay); c.arc(ax, ay, r0, 0, TAU); }
}
// A box with rounded corners, added to the current path (x, y is the bottom left).
function figRR(c, x, y, w, h, r) {
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}
// A soft glint of the lamp (or the sky) on whatever path is current. figGlint is for small
// things (hats, bags) and only shows when the figure is big; figLit is for the body and head.
function figLit(c, G, w, k) {
  if (G.la < 0.03) return;
  c.globalAlpha = Math.min(1, G.la * (k || 1)); c.strokeStyle = G.lc; c.lineWidth = Math.max(w, G.px * 0.9); c.stroke(); c.globalAlpha = 1;
}
function figGlint(c, G, w, k) { if (G.fine) figLit(c, G, w, k); }

// What we remember about a person between frames: their everyday clothes, and a little
// spring that makes hanging things (coat tails, bags, hair, a scarf) lag behind and settle.
function figState(A, env, f) {
  let st = A._fg;
  const t = env.t === undefined ? (A.t || 0) : env.t;
  if (!st) {
    const h = ((typeof A.id === 'string' ? hashStr(A.id) : 0) ^ Math.floor((A.seed || 0) * 7919.3)) >>> 0;
    st = A._fg = { top: FIG_TOPS[h % FIG_TOPS.length], legs: FIG_LEGS[(h >>> 3) % FIG_LEGS.length], shoe: FIG_SHOES[(h >>> 6) % FIG_SHOES.length], sole: (h >>> 9) % 3 === 0,
      t, x: A.x, v: 0, vs: 0, s: 0, sv: 0, fl: f };
    return st;
  }
  const dt = t - st.t;
  if (dt > 0) {
    if (dt > 0.3 || Math.abs(A.x - st.x) > 2.5) { st.v = st.vs = st.s = st.sv = 0; st.fl = f; }
    else {
      const v = clamp((A.x - st.x) / dt, -9, 9), n = dt > 0.02 ? 3 : 1, h = dt / n;
      st.sv -= (v - st.v) * 0.5; st.v = v;
      for (let i = 0; i < n; i++) { st.sv += (-95 * st.s - 6.5 * st.sv) * h; st.s += st.sv * h; }
      st.s = clamp(st.s, -0.24, 0.24); st.sv = clamp(st.sv, -4, 4);
      st.vs += (v - st.vs) * Math.min(1, dt * 5);
      st.fl += (f - st.fl) * Math.min(1, dt * 7);
    }
  }
  if (dt !== 0) { st.t = t; st.x = A.x; }
  return st;
}

// A point on the body: t runs up the spine (0 hip, 1 neck), o is metres across it (+ is local +x when upright).
function figPX(G, t, o) { return G.hip[0] + G.ux * G.T * t + G.nx * o; }
function figPY(G, t, o) { return G.hip[1] + G.uy * G.T * t + G.ny * o; }

// ---- body parts ------------------------------------------------------------
function figTorsoPath(c, G, ww, wc, wsh, t0) {
  const bulge = 0.014 * G.f * G.bw + 0.004 * Math.sin(G.t * 1.6 + G.seed), belly = G.bw > 1.1 ? 0.035 * G.f : 0;
  c.moveTo(figPX(G, t0, -ww), figPY(G, t0, -ww)); c.lineTo(figPX(G, 0.32, -ww * 0.94 + belly * 0.2), figPY(G, 0.32, -ww * 0.94 + belly * 0.2)); c.lineTo(figPX(G, 0.8, -wc), figPY(G, 0.8, -wc));
  c.quadraticCurveTo(figPX(G, 1.035, -wsh), figPY(G, 1.035, -wsh), figPX(G, 1.005, -0.045), figPY(G, 1.005, -0.045));
  c.lineTo(figPX(G, 1.005, 0.045), figPY(G, 1.005, 0.045));
  c.quadraticCurveTo(figPX(G, 1.035, wsh), figPY(G, 1.035, wsh), figPX(G, 0.8, wc + bulge), figPY(G, 0.8, wc + bulge));
  c.lineTo(figPX(G, 0.32, ww * 0.94 + bulge * 0.5 + belly), figPY(G, 0.32, ww * 0.94 + bulge * 0.5 + belly)); c.lineTo(figPX(G, t0, ww), figPY(G, t0, ww)); c.closePath();
}
// Cloth that hangs from the waist over the thighs (coat tails, a jacket hem, a skirt). It follows
// both legs, so it opens with the stride, drapes over the lap of someone sitting, and swings.
// Fills FIG_HEM with the two hem corners for anything that wants to decorate the edge.
const FIG_HEM = [0, 0, 0, 0];
function figSkirtPath(c, G, ww, len, flare, sag, swing, follow) {
  const hx = G.hip[0], hy = G.hip[1];
  let ax = G.knL[0] - hx, ay = G.knL[1] - hy, bx = G.knR[0] - hx, by = G.knR[1] - hy;
  let la = Math.hypot(ax, ay) || 1, lb = Math.hypot(bx, by) || 1; ax /= la; ay /= la; bx /= lb; by /= lb;
  if (follow < 1) { // a short hem hangs from the body more than it follows the thighs
    ax = lerp(-G.ux, ax, follow); ay = lerp(-G.uy, ay, follow); bx = lerp(-G.ux, bx, follow); by = lerp(-G.uy, by, follow);
    la = Math.hypot(ax, ay) || 1; lb = Math.hypot(bx, by) || 1; ax /= la; ay /= la; bx /= lb; by /= lb;
  }
  if (ax * G.nx + ay * G.ny > bx * G.nx + by * G.ny) { const tx = ax, ty = ay; ax = bx; ay = by; bx = tx; by = ty; } // a is now the leg to the -n side
  const sw = G.lag * swing + (G.mv ? Math.sin(G.A.ph * 2 + 0.6) * 0.012 * G.mv * swing : 0);
  const x0 = hx + ax * len + ay * flare + G.nx * sw, y0 = hy + ay * len - ax * flare + G.ny * sw;
  const x1 = hx + bx * len - by * flare + G.nx * sw * 0.7, y1 = hy + by * len + bx * flare + G.ny * sw * 0.7;
  FIG_HEM[0] = x0; FIG_HEM[1] = y0; FIG_HEM[2] = x1; FIG_HEM[3] = y1;
  // (traced the same way round as the torso, so the two can be filled as one shape)
  c.moveTo(figPX(G, 0.06, ww), figPY(G, 0.06, ww)); c.lineTo(x1, y1);
  if (sag) c.quadraticCurveTo((x0 + x1) / 2 + (ax + bx) * sag, (y0 + y1) / 2 + (ay + by) * sag, x0, y0); else c.lineTo(x0, y0);
  c.lineTo(figPX(G, 0.06, -ww), figPY(G, 0.06, -ww)); c.closePath();
}
// A hand at the end of a forearm. Open hands curl a little and are never quite still.
function figHandPath(c, G, el, ha, grip) {
  const r = 0.033 * G.bw;
  if (grip) { c.moveTo(ha[0] + r * 1.08, ha[1]); c.arc(ha[0], ha[1], r * 1.08, 0, TAU); return; }
  let dx = ha[0] - el[0], dy = ha[1] - el[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  const k = (0.45 + 0.22 * Math.sin(G.t * 1.1 + G.seed * 3 + el[1] * 7)) * G.fs, cs = Math.cos(k), sn = Math.sin(k);
  const fx = dx * cs - dy * sn, fy = dx * sn + dy * cs;
  figCap(c, ha[0], ha[1], ha[0] + fx * 0.052, ha[1] + fy * 0.052, r, r * 0.66);
  const tx = ha[0] - dy * G.fs * r * 0.8 + dx * 0.012, ty = ha[1] + dx * G.fs * r * 0.8 + dy * 0.012;
  c.moveTo(tx + r * 0.5, ty); c.arc(tx, ty, r * 0.5, 0, TAU);
}
// Limbs are painted in as few goes as possible, because every fill and stroke costs time on a phone.
const FIG_ANKLE = 0.87, FIG_CUFF = 0.8; // how far down the shin the leg stops (inside the shoe), and where a sleeve or trouser leg ends
// Everything behind the body: the far arm, both legs and both shoes. The far side is a shade darker.
function figLimbsBack(c, G, K, farGrip) {
  const st = G.st, bw = G.bw, px = G.px, sl = K.sleeve, lg = K.legs, hip = G.hip, sh = G.sh, elL = G.elL, haL = G.haL, knL = G.knL, knR = G.knR, ftL = G.ftL, ftR = G.ftR;
  const cx = lerp(elL[0], haL[0], FIG_CUFF), cy = lerp(elL[1], haL[1], FIG_CUFF);
  const aLx = lerp(knL[0], ftL[0], FIG_ANKLE), aLy = lerp(knL[1], ftL[1], FIG_ANKLE), aRx = lerp(knR[0], ftR[0], FIG_ANKLE), aRy = lerp(knR[1], ftR[1], FIG_ANKLE);
  if (!G.hi) {
    // medium size: plain strokes
    const mn = px * 1.1;
    c.strokeStyle = G.ink; c.lineWidth = Math.max(0.066 * bw, mn); c.beginPath();
    if (sl) c.moveTo(cx, cy); else { c.moveTo(sh[0], sh[1]); c.lineTo(elL[0], elL[1]); }
    c.lineTo(haL[0], haL[1]);
    if (!lg) { c.moveTo(hip[0], hip[1]); c.lineTo(knL[0], knL[1]); c.lineTo(aLx, aLy); c.moveTo(hip[0], hip[1]); c.lineTo(knR[0], knR[1]); c.lineTo(aRx, aRy); }
    c.stroke();
    if (sl) { c.strokeStyle = figSh(sl, 0.22); c.lineWidth = Math.max(0.088 * bw, mn); c.beginPath(); c.moveTo(sh[0], sh[1]); c.lineTo(elL[0], elL[1]); c.lineTo(cx, cy); c.stroke(); }
    if (lg) { c.strokeStyle = figC(lg); c.lineWidth = Math.max(0.1 * bw, mn); c.beginPath(); c.moveTo(hip[0], hip[1]); c.lineTo(knL[0], knL[1]); c.lineTo(aLx, aLy); c.moveTo(hip[0], hip[1]); c.lineTo(knR[0], knR[1]); c.lineTo(aRx, aRy); c.stroke(); }
    c.fillStyle = figC(st.shoe); c.beginPath(); figShoePath(c, G, knL, ftL); figShoePath(c, G, knR, ftR); c.fill();
    return;
  }
  const ar0 = 0.037 * bw, ar1 = 0.031 * bw, ar2 = 0.026 * bw, lr0 = 0.047 * bw, lr1 = 0.04 * bw, lr2 = 0.031 * bw, sa = 0.013, la = 0.011, fine = G.fine;
  // trousers stop at the ankle bone close up; further off they simply run into the shoe
  const kc = fine ? FIG_CUFF : FIG_ANKLE;
  const kLx = lerp(knL[0], ftL[0], kc), kLy = lerp(knL[1], ftL[1], kc), kRx = lerp(knR[0], ftR[0], kc), kRy = lerp(knR[1], ftR[1], kc);
  // skin first: the far hand and whatever of the limbs is bare
  c.fillStyle = G.ink; c.beginPath();
  if (sl) figCap(c, cx, cy, haL[0], haL[1], ar2, ar2 * 0.94); else figChain(c, sh[0], sh[1], elL[0], elL[1], haL[0], haL[1], ar0, ar1, ar2, false);
  if (fine) figHandPath(c, G, elL, haL, farGrip); else { c.moveTo(haL[0] + 0.036 * bw, haL[1]); c.arc(haL[0], haL[1], 0.036 * bw, 0, TAU); }
  if (lg) { if (fine) { figCap(c, kLx, kLy, aLx, aLy, lr2, lr2); figCap(c, kRx, kRy, aRx, aRy, lr2, lr2); } }
  else { figChain(c, hip[0], hip[1], knL[0], knL[1], aLx, aLy, lr0 - 0.004, lr1 - 0.004, lr2, true); figChain(c, hip[0], hip[1], knR[0], knR[1], aRx, aRy, lr0 - 0.004, lr1 - 0.004, lr2, false); }
  c.fill();
  if (sl) { c.fillStyle = figSh(sl, 0.22); c.beginPath(); figChain(c, sh[0], sh[1], elL[0], elL[1], cx, cy, ar0 + sa, ar1 + sa, ar2 + sa * 0.8, false); c.fill(); }
  if (lg) {
    c.fillStyle = figSh(lg, 0.25); c.beginPath(); figChain(c, hip[0], hip[1], knL[0], knL[1], kLx, kLy, lr0 + la, lr1 + la, lr2 + la, true); c.fill();
    c.fillStyle = figC(lg); c.beginPath(); figChain(c, hip[0], hip[1], knR[0], knR[1], kRx, kRy, lr0 + la, lr1 + la, lr2 + la, true); c.fill();
  }
  if (!G.fine) { c.fillStyle = figC(st.shoe); c.beginPath(); figShoePath(c, G, knL, ftL); figShoePath(c, G, knR, ftR); c.fill(); return; }
  c.fillStyle = figSh(st.shoe, 0.2); c.beginPath(); figShoePath(c, G, knL, ftL); c.fill();
  c.fillStyle = figC(st.shoe); c.beginPath(); figShoePath(c, G, knR, ftR); c.fill();
  if (st.sole || K.dress) { c.strokeStyle = figC(K.dress ? '#3a3d44' : '#8d9399'); c.lineWidth = Math.max(0.014, px * 0.8); c.lineCap = 'butt'; c.beginPath(); c.moveTo(FIG_SOLE[0], FIG_SOLE[1]); c.lineTo(FIG_SOLE[2], FIG_SOLE[3]); c.stroke(); c.lineCap = 'round'; }
  figLimbGlint(c, G, hip, knR, ftR, 0.05 * bw);
}
// The arm nearer to us, in front of everything. (At medium size its hand was painted with the head.)
function figArmNear(c, G, K, grip) {
  const bw = G.bw, sl = K.sleeve, sh = G.sh, el = G.elR, ha = G.haR;
  const cx = lerp(el[0], ha[0], FIG_CUFF), cy = lerp(el[1], ha[1], FIG_CUFF);
  if (!G.hi) {
    if (sl) { c.strokeStyle = figC(sl); c.lineWidth = Math.max(0.088 * bw, G.px * 1.1); c.beginPath(); c.moveTo(sh[0], sh[1]); c.lineTo(el[0], el[1]); c.lineTo(cx, cy); c.stroke(); }
    else { c.strokeStyle = G.ink; c.lineWidth = Math.max(0.066 * bw, G.px * 1.1); c.beginPath(); c.moveTo(sh[0], sh[1]); c.lineTo(el[0], el[1]); c.lineTo(ha[0], ha[1]); c.stroke(); }
    return;
  }
  const r0 = 0.037 * bw, r1 = 0.031 * bw, r2 = 0.026 * bw, sa = 0.013;
  if (sl) { c.fillStyle = figC(sl); c.beginPath(); figChain(c, sh[0], sh[1], el[0], el[1], cx, cy, r0 + sa, r1 + sa, r2 + sa * 0.8, true); c.fill(); }
  c.fillStyle = G.ink; c.beginPath();
  if (sl) figCap(c, cx, cy, ha[0], ha[1], r2, r2 * 0.94); else figChain(c, sh[0], sh[1], el[0], el[1], ha[0], ha[1], r0, r1, r2, true);
  if (G.fine) figHandPath(c, G, el, ha, grip); else { c.moveTo(ha[0] + 0.036 * bw, ha[1]); c.arc(ha[0], ha[1], 0.036 * bw, 0, TAU); }
  c.fill();
  if (G.fine) figLimbGlint(c, G, sh, el, ha, (sl ? 0.048 : 0.036) * bw);
}
// A shoe. It points the way the person faces, lies flat when the foot is on the ground and
// follows the shin when it is in the air, so a walking foot rolls from heel to toe.
// Leaves the sole line in FIG_SOLE.
const FIG_SOLE = [0, 0, 0, 0];
function figShoePath(c, G, kn, ft) {
  let ux = kn[0] - ft[0], uy = kn[1] - ft[1]; const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
  const fs = G.fs, len = 0.55 + 0.45 * G.fa;
  let tx = uy * fs, ty = -ux * fs, by = ft[1];
  if (!G.dead) {
    const g = 1 - clamp((ft[1] - 0.03) / 0.1, 0, 1);
    tx = lerp(tx, fs, g); ty = lerp(ty - 0.3 * (1 - g), 0, g);
    if (g > 0.5 && by < 0.012) by = lerp(by, 0.012, (g - 0.5) * 2);
  }
  const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
  if (by + ty * 0.15 * len < 0.012) { ty = (0.012 - by) / (0.15 * len); tx = fs * Math.sqrt(Math.max(0.05, 1 - ty * ty)); }
  const wx = -ty * fs, wy = tx * fs, bx = ft[0], s = G.bw > 1.1 ? 1.1 : 1;
  const hx = bx - tx * 0.058 * len * s, hy = by - ty * 0.058 * len * s, ex = bx + tx * 0.148 * len * s, ey = by + ty * 0.148 * len * s;
  FIG_SOLE[0] = hx - wx * 0.004; FIG_SOLE[1] = hy - wy * 0.004; FIG_SOLE[2] = ex + tx * 0.012 - wx * 0.004; FIG_SOLE[3] = ey + ty * 0.012 - wy * 0.004;
  c.moveTo(hx - wx * 0.012, hy - wy * 0.012); c.lineTo(ex - wx * 0.012, ey - wy * 0.012);
  c.quadraticCurveTo(ex + tx * 0.04 * len + wx * 0.012, ey + ty * 0.04 * len + wy * 0.012, bx + tx * 0.11 * len + wx * 0.058, by + ty * 0.11 * len + wy * 0.058);
  c.lineTo(bx + tx * 0.03 * len + wx * 0.092, by + ty * 0.03 * len + wy * 0.092); c.lineTo(bx - tx * 0.05 * len + wx * 0.092, by - ty * 0.05 * len + wy * 0.092);
  c.quadraticCurveTo(hx - tx * 0.012 + wx * 0.04, hy - ty * 0.012 + wy * 0.04, hx - wx * 0.012, hy - wy * 0.012); c.closePath();
}
// The lamp's light along the limbs: a thin bright line on the side that faces it.
function figLimbGlint(c, G, a, b, d, r) {
  if (G.la < 0.04) return;
  // only the parts of the limb that lie across the light catch it: a leg straight under a lamp shows no bright side
  const ox = G.lx * r * 0.62, oy = G.ly * r * 0.62;
  const ux = b[0] - a[0], uy = b[1] - a[1], vx = d[0] - b[0], vy = d[1] - b[1];
  const lu = Math.hypot(ux, uy) || 1, lv = Math.hypot(vx, vy) || 1;
  const w1 = Math.abs(ux * G.ly - uy * G.lx) / lu, w2 = Math.abs(vx * G.ly - vy * G.lx) / lv;
  if (w1 < 0.3 && w2 < 0.3) return;
  c.beginPath();
  if (w1 >= 0.3) { c.moveTo(lerp(a[0], b[0], 0.12) + ox, lerp(a[1], b[1], 0.12) + oy); c.lineTo(b[0] + ox, b[1] + oy); } else c.moveTo(b[0] + ox, b[1] + oy);
  if (w2 >= 0.3) c.lineTo(lerp(b[0], d[0], 0.82) + ox, lerp(b[1], d[1], 0.82) + oy);
  c.globalAlpha = Math.min(1, G.la * 0.75 * Math.max(w1, w2)); c.strokeStyle = G.lc; c.lineWidth = Math.max(r * 0.26, G.px * 0.7); c.stroke(); c.globalAlpha = 1;
}

// ---- the head, and everything worn on it -----------------------------------
// All of this is drawn in "head space": the origin is the middle of the head, +y points
// out through the crown, and the face is on the +x side when G.f is positive. While a
// person turns round, G.f passes through small values. Shapes that wrap the head (hair,
// beanie, hood, helmet) are described by how far they come down on the left and on the
// right, so half way through a turn they sit evenly, as if seen from the front. Shapes
// that stick out one way (a cap's peak, a nose, a bun) shrink toward the middle and
// grow out again on the other side.

// Hair lying on the head: an arc over the crown that comes down to `front` radians from
// the top on the face side and `back` radians on the other.
function figCapPath(c, G, R, front, back) {
  const hr = FIG.headR, f = G.f, dl = lerp(front, back, G.wl), dr = lerp(back, front, G.wl), a0 = Math.PI / 2 - dr, a1 = Math.PI / 2 + dl;
  const sx = Math.cos(a0) * R, sy = Math.sin(a0) * R, ex = Math.cos(a1) * R, ey = Math.sin(a1) * R;
  c.moveTo(sx, sy); c.arc(0, 0, R, a0, a1);
  // back along the hairline: in from the nape, down in front of the ear, up over the temple to the brow
  c.bezierCurveTo(lerp(ex, 0, 0.5) - f * hr * 0.1, ey + hr * 0.1, -f * hr * 0.12, -hr * 0.42, f * hr * 0.1, hr * 0.02);
  c.quadraticCurveTo(f * hr * 0.3, hr * 0.5, sx, sy); c.closePath();
}
// Long hair hanging down one side (s is -1 for the left, 1 for the right; w is how much of it shows).
function figFallPath(c, G, s, w) {
  if (w < 0.07) return;
  const hr = FIG.headR, sw = clamp(G.lag * 0.9 + G.wind * 0.004, -0.09, 0.09) + (G.mv ? Math.sin(G.A.ph * 2) * 0.008 * G.mv : 0);
  const xo = s * hr * 1.1, xi = s * hr * (1.1 - 1.0 * w), yb = -0.1 - 0.3 * w;
  c.moveTo(xo * 0.72, hr * 0.78);
  c.quadraticCurveTo(xo * 1.06, hr * 0.25, xo + sw * 0.25, -0.05);
  c.quadraticCurveTo(xo + sw * 0.7 + s * 0.02, yb * 0.62, xo * 0.9 + sw, yb);
  c.lineTo(xi + sw * 0.85, yb + 0.035);
  c.quadraticCurveTo(xi + sw * 0.3, -0.08, xi, hr * 0.3); c.closePath();
}
// The peak of a cap: upper edge from (ax, ay) out to (bx, by), lower edge back from (b2x, b2y) to
// (a2x, a2y). x is measured toward the face. It is traced anticlockwise whichever way the person
// faces, so that it joins the crown cleanly when both are filled as one shape.
function figPeak(c, f, ax, ay, c1x, c1y, bx, by, b2x, b2y, c2x, c2y, a2x, a2y) {
  if (f > 0) { c.moveTo(f * ax, ay); c.lineTo(f * a2x, a2y); c.quadraticCurveTo(f * c2x, c2y, f * b2x, b2y); c.lineTo(f * bx, by); c.quadraticCurveTo(f * c1x, c1y, f * ax, ay); }
  else { c.moveTo(f * ax, ay); c.quadraticCurveTo(f * c1x, c1y, f * bx, by); c.lineTo(f * b2x, b2y); c.quadraticCurveTo(f * c2x, c2y, f * a2x, a2y); }
  c.closePath();
}
// The outline of a hat (crown and brim), for the pale rim and for the first fill.
function figHatPath(c, G, hat) {
  const hr = FIG.headR, top = hr * 0.62, f = G.f, wl = G.wl, wr = 1 - wl;
  switch (hat) {
    case 'fedora':
      c.moveTo(0.31, top + 0.006); c.ellipse(0, top + 0.006, 0.31, 0.036, -f * 0.05, 0, TAU);
      c.moveTo(0.172, top); c.lineTo(0.15, top + 0.178 + 0.028 * wr);
      c.quadraticCurveTo(0.07, top + 0.225 + 0.02 * wr, -f * 0.03, top + 0.178);
      c.quadraticCurveTo(-0.07, top + 0.225 + 0.02 * wl, -0.15, top + 0.178 + 0.028 * wl);
      c.lineTo(-0.172, top); c.closePath();
      break;
    case 'tophat':
      c.moveTo(0.27, top + 0.006); c.ellipse(0, top + 0.006, 0.27, 0.034, 0, 0, TAU);
      c.moveTo(0.15, top); c.lineTo(0.163, top + 0.3); c.quadraticCurveTo(0, top + 0.325, -0.163, top + 0.3); c.lineTo(-0.15, top); c.closePath();
      break;
    case 'sun':
      c.moveTo(-0.4, top - 0.05); c.quadraticCurveTo(-0.2, top + 0.005, 0, top + 0.002); c.quadraticCurveTo(0.2, top + 0.005, 0.4, top - 0.05);
      c.quadraticCurveTo(0.2, top - 0.045, 0, top - 0.04); c.quadraticCurveTo(-0.2, top - 0.045, -0.4, top - 0.05); c.closePath();
      c.moveTo(-0.158, top - 0.02); c.quadraticCurveTo(-0.16, top + 0.13, 0, top + 0.14); c.quadraticCurveTo(0.16, top + 0.13, 0.158, top - 0.02); c.closePath();
      break;
    case 'cap': {
      const cy = top - 0.03, R = hr * 1.06;
      c.moveTo(Math.cos(-0.3 * wr) * R, cy + Math.sin(-0.3 * wr) * R); c.arc(0, cy, R, -0.3 * wr, Math.PI + 0.3 * wl); c.closePath();
      figPeak(c, f, 0.07, cy + 0.014, 0.25, cy + 0.02, 0.34, cy - 0.03, 0.33, cy - 0.052, 0.2, cy - 0.022, 0.06, cy - 0.022);
      break;
    }
    case 'beanie': {
      const R = hr * 1.1, a0 = -0.05 - 0.25 * wr, a1 = Math.PI + 0.05 + 0.25 * wl;
      c.moveTo(Math.cos(a0) * R, 0.03 + Math.sin(a0) * R); c.arc(0, 0.03, R, a0, a1); c.closePath();
      c.moveTo(0.052, 0.03 + R + 0.028); c.arc(0, 0.03 + R + 0.028, 0.052, 0, TAU);
      break;
    }
    case 'hardhat': {
      const cy = top - 0.05, R = hr * 1.12;
      c.moveTo(R, cy); c.arc(0, cy, R, 0, Math.PI); c.closePath();
      figRR(c, -0.225 + Math.min(0, f) * 0.075, cy - 0.022, 0.45 + Math.abs(f) * 0.075, 0.044, 0.02);
      break;
    }
    case 'beret':
      c.moveTo(0.21 - f * 0.04, top + 0.022); c.ellipse(-f * 0.04, top + 0.022, 0.215, 0.082, -f * 0.2, 0, TAU);
      break;
    case 'hood': {
      const R = hr * 1.22, ox = -f * 0.03;
      c.moveTo(ox + R, 0); c.arc(ox, 0, R, 0, TAU);
      c.moveTo(-hr * 0.95, -0.02); c.lineTo(-hr * 0.6 - 0.04 * wl, -hr - 0.075); c.lineTo(hr * 0.6 + 0.04 * wr, -hr - 0.075); c.lineTo(hr * 0.95, -0.02); c.closePath();
      break;
    }
    case 'peaked':
      figRR(c, -0.172, top - 0.022, 0.344, 0.1, 0.02);
      c.moveTo(0.172, top + 0.05); c.quadraticCurveTo(0.235, top + 0.1 + 0.02 * wr, 0.2, top + 0.125 + 0.03 * wr); c.quadraticCurveTo(0, top + 0.165 + 0.02 * Math.abs(f), -0.2, top + 0.125 + 0.03 * wl);
      c.quadraticCurveTo(-0.235, top + 0.1 + 0.02 * wl, -0.172, top + 0.05); c.closePath();
      figPeak(c, f, 0.06, top + 0.012, 0.22, top + 0.012, 0.29, top - 0.045, 0.275, top - 0.062, 0.18, top - 0.025, 0.05, top - 0.02);
      break;
    case 'helmet': {
      // the shell comes right down at the back and stops at the brow in front; the cheek piece closes it
      const R = hr * 1.17, a0 = lerp(0.42, -1.05, wr), a1 = Math.PI - lerp(0.42, -1.05, wl);
      c.moveTo(Math.cos(a0) * R, 0.02 + Math.sin(a0) * R); c.arc(0, 0.02, R, a0, a1);
      if (f >= 0) { c.lineTo(f * R * 0.5, -R * 0.78); c.lineTo(f * R * 0.42, -R * 0.12); } else { c.lineTo(f * R * 0.42, -R * 0.12); c.lineTo(f * R * 0.5, -R * 0.78); }
      c.closePath();
      break;
    }
    default: break;
  }
}
// The hat itself: its colour, then band, seams, shade and shine.
function figHat(c, G, hat) {
  const L = G.L, hr = FIG.headR, top = hr * 0.62, f = G.f, wl = G.wl, wr = 1 - wl, hc = L.hatCol || '#2a2d33', hi = G.hi, fine = G.fine, px = G.px;
  const base = figC(hc), dark = figSh(hc, 0.32), pale = figHi(hc, 0.3), band = L.hatBand ? figC(L.hatBand) : null;
  const ls = G.hlx >= 0 ? 1 : -1; // which side the light is on
  c.fillStyle = base; c.beginPath(); figHatPath(c, G, hat); c.fill();
  switch (hat) {
    case 'fedora':
      c.fillStyle = band || dark; c.beginPath(); c.moveTo(-0.171, top + 0.012); c.lineTo(-0.164, top + 0.068); c.lineTo(0.164, top + 0.068); c.lineTo(0.171, top + 0.012); c.closePath(); c.fill();
      if (hi && band) { c.fillStyle = figHi(L.hatBand, 0.3); c.fillRect(-f * 0.115 - 0.02, top + 0.016, 0.04, 0.048); } // the bow
      if (fine) {
        c.fillStyle = '#000000'; c.globalAlpha = 0.2; c.beginPath(); c.moveTo(-ls * 0.172, top + 0.07); c.lineTo(-ls * 0.15, top + 0.19); c.lineTo(-ls * 0.06, top + 0.2); c.lineTo(-ls * 0.075, top + 0.07); c.closePath(); c.fill(); c.globalAlpha = 1;
        c.strokeStyle = dark; c.lineWidth = Math.max(0.012, px); c.beginPath(); c.moveTo(-f * 0.03, top + 0.178); c.quadraticCurveTo(-f * 0.05, top + 0.13, -f * 0.02, top + 0.085); c.stroke();
        c.beginPath(); c.ellipse(0, top + 0.012, 0.3, 0.03, -f * 0.05, 0.25, Math.PI - 0.25); figGlint(c, G, 0.014, 0.9);
      }
      break;
    case 'tophat':
      c.fillStyle = band || dark; c.fillRect(-0.153, top + 0.018, 0.306, 0.058);
      if (fine) {
        c.fillStyle = '#000000'; c.globalAlpha = 0.18; c.fillRect(-ls * 0.16 - (ls > 0 ? 0.0 : 0.07), top + 0.076, 0.07, 0.228); c.globalAlpha = 1;
        c.beginPath(); c.moveTo(ls * 0.105, top + 0.09); c.lineTo(ls * 0.112, top + 0.285); figGlint(c, G, 0.022, 0.8);
        c.beginPath(); c.ellipse(0, top + 0.012, 0.26, 0.028, 0, 0.25, Math.PI - 0.25); figGlint(c, G, 0.012, 0.8);
      }
      break;
    case 'sun':
      c.fillStyle = band || dark; c.beginPath(); c.moveTo(-0.158, top + 0.004); c.lineTo(-0.159, top + 0.05); c.lineTo(0.159, top + 0.05); c.lineTo(0.158, top + 0.004); c.closePath(); c.fill();
      if (hi) {
        c.strokeStyle = dark; c.lineWidth = Math.max(0.01, px * 0.8); c.beginPath();
        c.moveTo(-0.4, top - 0.05); c.quadraticCurveTo(-0.2, top - 0.045, 0, top - 0.04); c.quadraticCurveTo(0.2, top - 0.045, 0.4, top - 0.05);
        if (fine) { for (let i = -3; i <= 3; i++) { if (!i) continue; c.moveTo(i * 0.075, top - 0.004); c.lineTo(i * 0.105, top - 0.04 - Math.abs(i) * 0.002); } c.moveTo(-0.13, top + 0.085); c.quadraticCurveTo(0, top + 0.1, 0.13, top + 0.085); }
        c.stroke();
        c.beginPath(); c.moveTo(-0.36, top - 0.034); c.quadraticCurveTo(-0.2, top + 0.008, 0, top + 0.006); c.quadraticCurveTo(0.2, top + 0.008, 0.36, top - 0.034); figGlint(c, G, 0.012, 0.8);
      }
      break;
    case 'cap': {
      const cy = top - 0.03, R = hr * 1.06;
      if (hi) {
        c.fillStyle = dark; c.beginPath(); c.moveTo(f * 0.07, cy - 0.006); c.quadraticCurveTo(f * 0.2, cy - 0.008, f * 0.33, cy - 0.04); c.lineTo(f * 0.33, cy - 0.052); c.quadraticCurveTo(f * 0.2, cy - 0.022, f * 0.06, cy - 0.022); c.closePath(); c.fill();
        c.strokeStyle = dark; c.lineWidth = Math.max(0.011, px * 0.8); c.beginPath(); c.moveTo(f * 0.02, cy + R); c.quadraticCurveTo(f * 0.13, cy + R * 0.7, f * 0.12, cy + 0.01);
        if (fine) { c.moveTo(-f * 0.02, cy + R); c.quadraticCurveTo(-f * 0.14, cy + R * 0.7, -f * 0.14, cy + 0.005); }
        c.stroke();
        if (fine) { c.fillStyle = pale; c.beginPath(); c.arc(0, cy + R, 0.017, 0, TAU); c.fill(); }
        c.beginPath(); c.arc(0, cy, R - 0.014, Math.PI / 2 - ls * 0.2 - 0.6, Math.PI / 2 - ls * 0.2 + 0.6); figGlint(c, G, 0.016, 0.8);
      }
      break;
    }
    case 'beanie': {
      const R = hr * 1.1, a0 = -0.05 - 0.25 * wr, a1 = Math.PI + 0.05 + 0.25 * wl;
      // the turned-up cuff
      c.strokeStyle = dark; c.lineWidth = Math.max(0.058, px * 1.2); c.lineCap = 'butt';
      c.beginPath(); c.moveTo(Math.cos(a0) * (R - 0.004), 0.03 + Math.sin(a0) * R + 0.028); c.quadraticCurveTo(0, 0.05 + (Math.sin(a0) + Math.sin(a1)) * R * 0.5 + 0.028, Math.cos(a1) * (R - 0.004), 0.03 + Math.sin(a1) * R + 0.028); c.stroke(); c.lineCap = 'round';
      if (fine) {
        c.fillStyle = pale; c.beginPath(); c.arc(-ls * 0.012, 0.03 + R + 0.036, 0.03, 0, TAU); c.fill();
        if (fine) { c.strokeStyle = dark; c.lineWidth = Math.max(0.008, px * 0.7); c.beginPath(); for (let i = -2; i <= 2; i++) { const a = Math.PI / 2 + i * 0.36; c.moveTo(Math.cos(a) * R * 0.5, 0.03 + Math.sin(a) * R * 0.5 + 0.05); c.lineTo(Math.cos(a) * R * 0.93, 0.03 + Math.sin(a) * R * 0.93); } c.stroke(); }
        c.beginPath(); c.arc(0, 0.03, R - 0.014, Math.PI / 2 - ls * 0.25 - 0.55, Math.PI / 2 - ls * 0.25 + 0.55); figGlint(c, G, 0.016, 0.7);
      }
      break;
    }
    case 'hardhat': {
      const cy = top - 0.05, R = hr * 1.12;
      if (hi) {
        c.fillStyle = dark; c.beginPath(); c.rect(-0.225 + Math.min(0, f) * 0.075, cy - 0.022, 0.45 + Math.abs(f) * 0.075, 0.016); c.fill();
        // the ridge over the top, and the ribs beside it
        c.strokeStyle = pale; c.lineWidth = Math.max(0.03, px); c.beginPath(); c.arc(0, cy, R - 0.004, Math.PI / 2 - 0.42, Math.PI / 2 + 0.42); c.stroke();
        if (fine) {
          c.strokeStyle = dark; c.lineWidth = Math.max(0.009, px * 0.7); c.beginPath();
          c.moveTo(-0.075, cy + 0.03); c.quadraticCurveTo(-0.07, cy + R * 0.8, -0.03, cy + R - 0.012);
          c.moveTo(0.075, cy + 0.03); c.quadraticCurveTo(0.07, cy + R * 0.8, 0.03, cy + R - 0.012); c.stroke();
        }
        c.beginPath(); c.arc(0, cy, R - 0.03, Math.PI / 2 - ls * 0.75 - 0.3, Math.PI / 2 - ls * 0.75 + 0.3); figGlint(c, G, 0.022, 1);
      }
      break;
    }
    case 'beret':
      if (hi) {
        c.strokeStyle = dark; c.lineWidth = Math.max(0.022, px); c.beginPath(); c.moveTo(-0.15, top - 0.012 + f * 0.02); c.quadraticCurveTo(0, top - 0.03, 0.15, top - 0.012 - f * 0.02); c.stroke();
        if (fine) { c.lineWidth = Math.max(0.014, px); c.beginPath(); c.moveTo(-f * 0.05, top + 0.098); c.lineTo(-f * 0.06, top + 0.128); c.stroke(); }
        c.beginPath(); c.ellipse(-f * 0.04, top + 0.026, 0.17, 0.058, -f * 0.2, Math.PI / 2 - ls * 0.3 - 0.6, Math.PI / 2 - ls * 0.3 + 0.6); figGlint(c, G, 0.014, 0.7);
      }
      break;
    case 'hood': {
      // the opening, with the face inside it in shadow
      const R = hr * 1.22, fa = G.fa;
      c.fillStyle = G.ink; c.beginPath(); c.ellipse(f * hr * 0.62, -0.012, hr * (0.44 + 0.3 * (1 - fa)), hr * 0.8, 0, 0, TAU); c.fill();
      if (hi) {
        c.strokeStyle = dark; c.lineWidth = Math.max(0.016, px); c.beginPath(); c.ellipse(f * hr * 0.62, -0.012, hr * (0.44 + 0.3 * (1 - fa)) + 0.006, hr * 0.8 + 0.006, 0, 0, TAU); c.stroke();
        if (fine) { c.lineWidth = Math.max(0.009, px * 0.7); c.beginPath(); c.moveTo(-f * 0.05, R * 0.98); c.quadraticCurveTo(-f * 0.2, 0.05, -f * 0.13, -hr - 0.07); c.stroke(); }
        c.beginPath(); c.arc(-f * 0.03, 0, R - 0.016, Math.PI / 2 - ls * 0.3 - 0.6, Math.PI / 2 - ls * 0.3 + 0.6); figGlint(c, G, 0.018, 0.7);
      }
      break;
    }
    case 'peaked':
      // dark band, shiny peak, a badge
      c.fillStyle = dark; c.beginPath(); figRR(c, -0.172, top - 0.022, 0.344, 0.074, 0.02); c.fill();
      c.fillStyle = figC('#0b0c0f'); c.beginPath(); c.moveTo(f * 0.06, top + 0.012); c.quadraticCurveTo(f * 0.22, top + 0.012, f * 0.29, top - 0.045); c.lineTo(f * 0.275, top - 0.062); c.quadraticCurveTo(f * 0.18, top - 0.025, f * 0.05, top - 0.02); c.closePath(); c.fill();
      if (hi) {
        c.fillStyle = figC('#d8c98a'); c.beginPath(); c.arc(f * 0.14, top + 0.058, 0.02, 0, TAU); c.fill();
        if (fine) { c.strokeStyle = pale; c.lineWidth = Math.max(0.009, px * 0.7); c.beginPath(); c.moveTo(-0.172, top + 0.052); c.lineTo(0.172, top + 0.052); c.stroke(); }
        c.beginPath(); c.moveTo(f * 0.09, top + 0.004); c.quadraticCurveTo(f * 0.21, top + 0.004, f * 0.275, top - 0.042); figGlint(c, G, 0.01, 1);
        c.beginPath(); c.moveTo(-0.17, top + 0.132 + 0.03 * wl); c.quadraticCurveTo(0, top + 0.16 + 0.02 * Math.abs(f), 0.17, top + 0.132 + 0.03 * wr); figGlint(c, G, 0.014, 0.7);
      }
      break;
    case 'helmet': {
      const R = hr * 1.17;
      // the visor: dark glass over the eyes, hinged at the temple
      const bx = Math.cos(0.42) * R, by = 0.02 + Math.sin(0.42) * R;
      c.fillStyle = figC('#18212c'); c.beginPath(); c.moveTo(f * bx, by); c.quadraticCurveTo(f * R * 1.06, 0.0, f * R * 0.86, -R * 0.4); c.lineTo(f * R * 0.42, -R * 0.12); c.lineTo(f * R * 0.5, R * 0.42); c.closePath(); c.fill();
      if (fine) {
        c.strokeStyle = figC('#8fb0c8'); c.globalAlpha = 0.6; c.lineWidth = Math.max(0.014, px * 0.8); c.beginPath(); c.moveTo(f * R * 0.84, R * 0.34); c.quadraticCurveTo(f * R * 0.98, R * 0.05, f * R * 0.88, -R * 0.22); c.stroke(); c.globalAlpha = 1;
        c.fillStyle = dark; c.beginPath(); c.arc(f * R * 0.42, R * 0.14, 0.022, 0, TAU); c.fill(); // hinge
        c.strokeStyle = dark; c.lineWidth = Math.max(0.012, px * 0.8); c.beginPath(); c.moveTo(-f * R * 0.2, R * 0.98 + 0.02); c.quadraticCurveTo(-f * R * 0.75, R * 0.45, -f * R * 0.6, -R * 0.6); c.stroke(); // a stripe over the crown
        if (L.pilot) { c.strokeStyle = figC('#1a1d22'); c.lineWidth = Math.max(0.014, px); c.beginPath(); c.moveTo(-f * 0.02, -0.06); c.quadraticCurveTo(f * 0.1, -0.16, f * 0.17, -0.1); c.stroke(); c.fillStyle = figC('#1a1d22'); c.beginPath(); c.arc(f * 0.17, -0.1, 0.02, 0, TAU); c.fill(); }
        c.beginPath(); c.arc(0, 0.02, R - 0.03, Math.PI / 2 - ls * 0.6 - 0.35, Math.PI / 2 - ls * 0.6 + 0.35); figGlint(c, G, 0.024, 1);
      }
      break;
    }
    default: break;
  }
}
// The head: neck up. mode 0 only traces the outline (for the pale rim); mode 1 paints it.
function figHead(c, G, mode) {
  const L = G.L, hr = FIG.headR, f = G.f, wl = G.wl, wr = 1 - wl, hat = L.hat, hair = L.hair, hi = G.hi, fine = G.fine, px = G.px;
  c.save(); c.translate(G.hdx, G.hdy); if (G.htilt) c.rotate(G.htilt);
  if (mode === 0) {
    c.moveTo(hr, 0); c.arc(0, 0, hr, 0, TAU);
    if (hair === 'long' && hat !== 'hood') { if (fine) { figFallPath(c, G, -1, wl); figFallPath(c, G, 1, wr); } }
    else if (hair === 'bun' && !hat) { c.moveTo(-f * hr * 0.82 + 0.078, hr * 0.74); c.arc(-f * hr * 0.82, hr * 0.74, 0.078, 0, TAU); }
    else if (hair === 'mohawk' && !hat) { c.moveTo(-hr * 0.5, hr * 0.8); c.quadraticCurveTo(0, hr * 1.75, hr * 0.5, hr * 0.8); }
    if (hat) figHatPath(c, G, hat);
    if (L.phones && fine) { c.moveTo(hr * 1.13, 0); c.arc(0, 0, hr * 1.13, 0, Math.PI); }
    c.restore(); return;
  }
  const hcol = hair === 'white' ? '#e8e8e2' : (L.hairCol || (hair === 'long' ? '#6b4a2b' : hair === 'bun' ? '#3a2a20' : hair === 'mohawk' ? '#e0413a' : '#7a5a3a'));
  const hood = hat === 'hood';
  // hair that hangs behind the head goes on first
  if (hair === 'long' && !hood) { c.fillStyle = figSh(hcol, 0.14); c.beginPath(); figFallPath(c, G, -1, wl); figFallPath(c, G, 1, wr); c.fill(); }
  else if (hair === 'bun' && !hat) { c.fillStyle = figC(hcol); c.beginPath(); c.arc(-f * hr * 0.82, hr * 0.74, 0.078, 0, TAU); c.fill(); if (fine) { c.strokeStyle = figSh(hcol, 0.3); c.lineWidth = Math.max(0.009, px * 0.7); c.beginPath(); c.arc(-f * hr * 0.82, hr * 0.74, 0.045, 0.5, 3.4); c.stroke(); } }
  // the head itself: round, with a little jaw and nose so you can tell which way it looks
  c.fillStyle = G.ink; c.beginPath(); c.arc(0, 0, hr, 0, TAU);
  { // the neck, in the same fill
    const cs = Math.cos(G.htilt), sn = Math.sin(G.htilt), dx = figPX(G, 0.95, 0) - G.hdx, dy = figPY(G, 0.95, 0) - G.hdy, nx = dx * cs + dy * sn, ny = -dx * sn + dy * cs, r = 0.04 * G.bw;
    if (hi) figCap(c, 0, 0, nx, ny, r, r); else { c.moveTo(-r, 0); c.lineTo(nx - r, ny); c.lineTo(nx + r, ny); c.lineTo(r, 0); c.closePath(); }
    if (!hi && G.nearHand) { const ex = G.haR[0] - G.hdx, ey = G.haR[1] - G.hdy, x = ex * cs + ey * sn, y = -ex * sn + ey * cs; c.moveTo(x + 0.036 * G.bw, y); c.arc(x, y, 0.036 * G.bw, 0, TAU); }
  }
  if (hi) {
    c.moveTo(f * hr * 0.3 + hr * 0.56, -hr * 0.46); c.arc(f * hr * 0.3, -hr * 0.46, hr * 0.56, 0, TAU);
    if (f > 0) { c.moveTo(f * hr * 0.88, -0.055); c.lineTo(f * (hr + 0.027), -0.014); c.lineTo(f * hr * 0.9, 0.035); } else { c.moveTo(f * hr * 0.9, 0.035); c.lineTo(f * (hr + 0.027), -0.014); c.lineTo(f * hr * 0.88, -0.055); }
    c.closePath();
  }
  c.fill();
  if (hi && G.la > 0.03) { const a = Math.atan2(G.hly, G.hlx); c.beginPath(); c.arc(0, 0, hr - Math.max(0.011, px * 0.5), a - 0.85, a + 0.85); figLit(c, G, 0.02, 0.9); }
  if (fine && !hood && hat !== 'helmet' && hair !== 'long' && !L.phones && G.fa > 0.5) { c.strokeStyle = G.ear; c.lineWidth = Math.max(0.011, px * 0.8); c.beginPath(); if (f > 0) c.arc(-hr * 0.26, -hr * 0.03, 0.026, 0.9, 4.5); else c.arc(hr * 0.26, -hr * 0.03, 0.026, Math.PI - 4.5, Math.PI - 0.9); c.stroke(); }
  // hair on the head
  if (hair && !hood && hat !== 'helmet') {
    c.fillStyle = figC(hcol);
    if (hair === 'mohawk') {
      if (!hat) { // a crest from the brow to the nape
        const w = 0.4 + 0.6 * G.fa; c.beginPath(); c.moveTo(-w * hr * 0.75 - f * 0.02, hr * 0.62);
        for (let i = 0; i <= 5; i++) { const u = i / 5, x = lerp(-w * hr * 0.75, w * hr * 0.75, u) - f * 0.02; c.lineTo(x - 0.018, hr * (0.86 + 0.22 * Math.sin(u * Math.PI))); c.lineTo(x + 0.008, hr * (1.2 + 0.36 * Math.sin(u * Math.PI))); }
        c.lineTo(w * hr * 0.75 - f * 0.02, hr * 0.62); c.closePath(); c.fill();
      }
    } else {
      const R = hr * (hair === 'white' ? 1.1 : 1.075);
      const fr = hair === 'long' ? 0.85 : hair === 'bun' ? 0.8 : hair === 'white' ? 0.72 : 0.7, bk = hair === 'long' ? 1.95 : hair === 'bun' ? 1.6 : hair === 'white' ? 1.85 : 1.75;
      c.beginPath(); figCapPath(c, G, R, fr, bk); c.fill();
      if (fine && !hat) {
        c.strokeStyle = figSh(hcol, hair === 'white' ? 0.14 : 0.28); c.lineWidth = Math.max(0.008, px * 0.7); c.beginPath();
        c.moveTo(f * hr * 0.2, hr * 1.0); c.quadraticCurveTo(-f * hr * 0.3, hr * 0.8, -f * hr * 0.75, hr * 0.25);
        c.moveTo(-f * hr * 0.1, hr * 1.03); c.quadraticCurveTo(-f * hr * 0.65, hr * 0.85, -f * hr * 0.95, hr * 0.3); c.stroke();
      }
      if (hi && !hat) { c.beginPath(); c.arc(0, 0, R - 0.014, Math.PI / 2 - (G.hlx >= 0 ? 1 : -1) * 0.3 - 0.5, Math.PI / 2 - (G.hlx >= 0 ? 1 : -1) * 0.3 + 0.5); figGlint(c, G, 0.016, 0.6); }
    }
  }
  if (L.beard) {
    const bc = L.beard === true ? '#8a8f96' : L.beard, R = hr * 1.08, sl = lerp(1.36, 0.5, wl), sr = lerp(0.5, 1.36, wl), a0 = -Math.PI / 2 - sl;
    c.fillStyle = figC(bc); c.beginPath(); c.moveTo(Math.cos(a0) * R, Math.sin(a0) * R); c.arc(f * 0.012, -0.014, R, a0, -Math.PI / 2 + sr); c.quadraticCurveTo(f * hr * 0.36, -hr * 0.2, Math.cos(a0) * R, Math.sin(a0) * R); c.closePath(); c.fill();
    if (fine) { c.strokeStyle = figSh(bc, 0.3); c.lineWidth = Math.max(0.008, px * 0.7); c.beginPath(); c.moveTo(f * hr * 0.55, -hr * 0.5); c.lineTo(f * hr * 0.62, -hr * 0.92); c.moveTo(f * hr * 0.2, -hr * 0.62); c.lineTo(f * hr * 0.22, -hr * 1.02); c.stroke(); }
  }
  if (L.mask) {
    c.fillStyle = figC(L.mask); c.beginPath(); c.arc(0, 0, hr * 1.03, Math.PI + 0.22, TAU - 0.22); c.closePath(); c.fill();
    if (hi) { c.strokeStyle = figHi(L.mask, 0.3); c.lineWidth = Math.max(0.011, px * 0.8); c.beginPath(); c.moveTo(-hr * 0.99, -hr * 0.2); c.lineTo(hr * 0.99, -hr * 0.2); c.stroke(); }
  }
  if (L.phones) { c.strokeStyle = figC(L.phones); c.lineWidth = Math.max(0.04, px); c.beginPath(); c.arc(0, 0, hr * 1.13, 0.32, Math.PI - 0.32); c.stroke(); }
  if (hat) figHat(c, G, hat);
  if (L.phones) {
    c.fillStyle = figC(L.phones); c.beginPath(); c.ellipse(-f * 0.022, -0.004, 0.066, 0.085, 0, 0, TAU); c.fill();
    if (hi) { c.fillStyle = figSh(L.phones, 0.4); c.beginPath(); c.ellipse(-f * 0.022, -0.004, 0.036, 0.052, 0, 0, TAU); c.fill(); }
  }
  if (L.glasses) {
    const gx = f * hr * 0.6, gy = hr * 0.14;
    if (L.glasses === 'shades') {
      // wrap-round sunglasses: a pale mirrored lens that tapers back to the ear
      c.fillStyle = figC('#dfe6ee'); c.beginPath(); figCap(c, -f * 0.02, gy + 0.012, f * 0.07, gy + 0.008, 0.012, 0.03); figCap(c, f * 0.07, gy + 0.008, f * 0.166, gy + 0.004, 0.03, 0.032); c.fill();
      if (hi) { c.fillStyle = figC('#56677c'); c.beginPath(); figCap(c, f * 0.085, gy + 0.004, f * 0.158, gy + 0.002, 0.018, 0.02); c.fill(); }
      if (fine) { c.strokeStyle = figC('#f4f7fa'); c.lineWidth = Math.max(0.008, px * 0.7); c.beginPath(); c.moveTo(f * 0.1, gy + 0.018); c.lineTo(f * 0.135, gy - 0.01); c.stroke(); }
    } else {
      c.strokeStyle = figC('#cfd6de'); c.lineWidth = Math.max(0.02, px * 0.75);
      c.beginPath(); c.moveTo(gx + 0.047, gy); c.arc(gx, gy, 0.047, 0, TAU); c.moveTo(gx - f * 0.047, gy + 0.008); c.lineTo(-f * hr * 0.3, gy + 0.03); c.stroke();
      if (hi) { c.fillStyle = figC('#9db4c8'); c.globalAlpha = 0.35; c.beginPath(); c.arc(gx, gy, 0.04, 0, TAU); c.fill(); c.globalAlpha = 1; }
    }
  }
  c.restore();
}

// ---- things people carry ---------------------------------------------------
// Each of these can be asked for its outline only (mode 0, which adds to the current path
// so the pale rim goes round the person and the bag as one shape) or to paint itself (mode 1).

// Put the drawing origin at the grip of something that hangs from a hand. It swings a little
// with the walk, lags when the person starts or stops, and rests on the ground if the hand is low.
function figHang(c, G, ha, depth) {
  const room = clamp((ha[1] - depth) / 0.15, 0, 1);
  const sw = G.dead ? 0 : clamp(G.lag * 2.4 + (G.mv ? Math.sin(G.A.ph * 2 + 1.2) * 0.045 * G.mv : 0), -0.5, 0.5) * room;
  c.translate(ha[0], Math.max(ha[1], depth + 0.012)); if (sw) c.rotate(sw);
}
function figDuffelPath(c) {
  const x0 = -0.34, x1 = 0.34, yt = -0.165, yb = -0.445, r = 0.1;
  c.moveTo(x0 + r, yt); c.quadraticCurveTo(0, yt - 0.016, x1 - r, yt); c.quadraticCurveTo(x1, yt, x1, yt - r); c.lineTo(x1, yb + r); c.quadraticCurveTo(x1, yb, x1 - r, yb);
  c.quadraticCurveTo(0, yb - 0.032, x0 + r, yb); c.quadraticCurveTo(x0, yb, x0, yb + r); c.lineTo(x0, yt - r); c.quadraticCurveTo(x0, yt, x0 + r, yt); c.closePath();
}
function figGuitarPath(c) {
  c.moveTo(-0.058, 0.7); c.lineTo(-0.078, 0.725); c.lineTo(-0.07, 0.86); c.lineTo(0.07, 0.86); c.lineTo(0.078, 0.725); c.lineTo(0.058, 0.7); c.lineTo(0.058, 0.275);
  c.quadraticCurveTo(0.172, 0.24, 0.166, 0.1); c.quadraticCurveTo(0.16, 0.0, 0.135, -0.03); c.quadraticCurveTo(0.228, -0.1, 0.222, -0.28); c.quadraticCurveTo(0.2, -0.505, 0, -0.505);
  c.quadraticCurveTo(-0.2, -0.505, -0.222, -0.28); c.quadraticCurveTo(-0.228, -0.1, -0.135, -0.03); c.quadraticCurveTo(-0.16, 0.0, -0.166, 0.1); c.quadraticCurveTo(-0.172, 0.24, -0.058, 0.275); c.closePath();
}
// The seven rib tips of an umbrella, and its skin. R0 is how high the rim is above the hand.
function figBrollyX(i) { return -0.64 + i * (1.28 / 6); }
function figBrollyY(i, R0) { const x = figBrollyX(i) / 0.64; return R0 - 0.05 * (1 - x * x); }
function figBrollyPath(c, R0) {
  c.moveTo(-0.64, R0); c.quadraticCurveTo(-0.6, R0 + 0.35, 0, R0 + 0.41); c.quadraticCurveTo(0.6, R0 + 0.35, 0.64, R0);
  for (let i = 5; i >= 0; i--) { const x = figBrollyX(i), y = figBrollyY(i, R0), xp = figBrollyX(i + 1), yp = figBrollyY(i + 1, R0); c.quadraticCurveTo((x + xp) / 2, (y + yp) / 2 + 0.05, x, y); }
  c.closePath();
}

// Carried on the back: a rucksack or a guitar case. Drawn before the body so the body hides its near edge.
function figBack(c, G, mode) {
  const L = G.L, bag = L.bag, px = G.px, hi = G.hi, fine = G.fine, fl = G.fl, spine = Math.atan2(-G.ux, G.uy);
  if (bag === 'backpack') {
    const o = -fl * (G.wc + 0.088) + G.lag * 0.25, bob = G.mv ? Math.sin(G.A.ph * 2) * 0.006 * G.mv : 0;
    c.save(); c.translate(figPX(G, 0.56, o), figPY(G, 0.56, o) + bob); c.rotate(spine - fl * 0.05);
    if (!mode) { figRR(c, -0.105, -0.2, 0.21, 0.43, 0.075); c.restore(); return; }
    const col = L.bagCol || '#5d6b4a', dark = figSh(col, 0.34);
    c.fillStyle = figC(col); c.beginPath(); figRR(c, -0.105, -0.2, 0.21, 0.43, 0.075); c.fill();
    c.fillStyle = dark; c.beginPath(); figRR(c, -0.085 - fl * 0.012, -0.175, 0.165, 0.185, 0.045); c.fill();
    if (hi) {
      c.fillStyle = '#000000'; c.globalAlpha = 0.16; c.beginPath(); figRR(c, -0.105, -0.2, 0.21, 0.1, 0.06); c.fill(); c.globalAlpha = 1;
      c.strokeStyle = dark; c.lineWidth = Math.max(0.012, px * 0.8); c.beginPath(); c.moveTo(-0.1, 0.105); c.quadraticCurveTo(0, 0.075, 0.1, 0.105); // the lid
      c.moveTo(-0.03, 0.225); c.quadraticCurveTo(0, 0.275, 0.03, 0.225); c.stroke(); // the loop to hang it by
      if (fine) {
        c.strokeStyle = figHi(col, 0.35); c.lineWidth = Math.max(0.008, px * 0.7); c.beginPath(); c.moveTo(-0.06 - fl * 0.012, -0.03); c.lineTo(0.055 - fl * 0.012, -0.03); c.stroke(); // pocket zip
        c.fillStyle = figC('#b9bec4'); c.fillRect(-fl * 0.07 - 0.012, 0.03, 0.024, 0.03); // buckle
        c.strokeStyle = dark; c.lineWidth = Math.max(0.014, px * 0.8); c.beginPath(); c.moveTo(-fl * 0.07, 0.06); c.lineTo(-fl * 0.07, 0.1); c.stroke();
      }
      c.beginPath(); c.moveTo(-0.07, 0.205); c.quadraticCurveTo(0, 0.235, 0.07, 0.205); figGlint(c, G, 0.014, 0.7);
    }
    c.restore();
  } else if (bag === 'guitar') {
    const o = -fl * 0.17 + G.lag * 0.2;
    c.save(); c.translate(figPX(G, 0.55, o), figPY(G, 0.55, o)); c.rotate(spine + fl * 0.25);
    if (!mode) { figGuitarPath(c); c.restore(); return; }
    const col = L.bagCol || '#1d2026', dark = figSh(col, 0.4), pale = figHi(col, 0.3);
    c.fillStyle = figC(col); c.beginPath(); figGuitarPath(c); c.fill();
    if (hi) {
      c.strokeStyle = pale; c.lineWidth = Math.max(0.012, px * 0.8); c.globalAlpha = 0.7; c.beginPath(); figGuitarPath(c); c.stroke(); c.globalAlpha = 1; // the piping round the edge
      c.fillStyle = dark; c.beginPath(); figRR(c, -0.12, -0.42, 0.24, 0.2, 0.07); c.fill(); // pocket
      c.strokeStyle = pale; c.lineWidth = Math.max(0.009, px * 0.7); c.beginPath(); c.moveTo(-0.09, -0.24); c.lineTo(0.09, -0.24); // its zip
      c.moveTo(-fl * 0.04, 0.3); c.lineTo(-fl * 0.04, 0.68); c.stroke(); // seam up the neck
      if (fine) { c.fillStyle = figC('#b9bec4'); c.fillRect(-fl * 0.2 - 0.014, -0.2, 0.028, 0.03); c.fillRect(-fl * 0.15 - 0.014, 0.08, 0.028, 0.03); c.fillRect(-0.02, 0.78, 0.04, 0.03); }
    }
    c.restore();
  }
}
// The straps of whatever is on the back, where they cross the chest.
function figStraps(c, G) {
  const L = G.L, bag = L.bag, fl = G.fl, wc = G.wc;
  if (bag === 'backpack') {
    c.strokeStyle = figSh(L.bagCol || '#5d6b4a', 0.42); c.lineWidth = Math.max(0.03, G.px);
    c.beginPath(); c.moveTo(figPX(G, 0.98, -fl * 0.03), figPY(G, 0.98, -fl * 0.03)); c.quadraticCurveTo(figPX(G, 0.9, fl * wc * 1.05), figPY(G, 0.9, fl * wc * 1.05), figPX(G, 0.5, fl * wc * 0.55), figPY(G, 0.5, fl * wc * 0.55)); c.stroke();
  } else if (bag === 'guitar') {
    c.strokeStyle = figSh(L.bagCol || '#1d2026', 0.3); c.lineWidth = Math.max(0.03, G.px);
    c.beginPath(); c.moveTo(figPX(G, 0.96, -fl * 0.05), figPY(G, 0.96, -fl * 0.05)); c.lineTo(figPX(G, 0.14, fl * G.ww * 0.9), figPY(G, 0.14, fl * G.ww * 0.9)); c.stroke();
    if (G.fine) { c.fillStyle = figC('#b9bec4'); c.beginPath(); c.arc(figPX(G, 0.55, fl * 0.012), figPY(G, 0.55, fl * 0.012), 0.016, 0, TAU); c.fill(); }
  }
}

// Carried in both hands in front of the body: a box, or an open newspaper.
function figBoth(c, G, mode) {
  const L = G.L, bag = L.bag, px = G.px, hi = G.hi, fine = G.fine;
  const mx = (G.cL[0] + G.cR[0]) / 2, ls = G.lx >= 0 ? 1 : -1;
  let my = (G.cL[1] + G.cR[1]) / 2;
  if (bag === 'box') {
    my = Math.max(my, 0.1);
    if (!mode) { figRR(c, mx - 0.25, my - 0.09, 0.5, 0.37, 0.014); return; }
    const col = L.bagCol || '#b08a52', dark = figSh(col, 0.3);
    c.fillStyle = figC(col); c.beginPath(); figRR(c, mx - 0.25, my - 0.09, 0.5, 0.37, 0.014); c.fill();
    if (hi) {
      c.fillStyle = '#000000'; c.globalAlpha = 0.15; c.fillRect(mx - ls * 0.25 - (ls > 0 ? 0 : 0.12), my - 0.09, 0.12, 0.37); c.fillRect(mx - 0.25, my - 0.09, 0.5, 0.05); c.globalAlpha = 1;
      c.strokeStyle = dark; c.lineWidth = Math.max(0.011, px * 0.8); c.beginPath(); c.moveTo(mx - 0.25, my + 0.2); c.lineTo(mx + 0.25, my + 0.2); c.stroke(); // where the flaps fold
      c.fillStyle = figHi(col, 0.42); c.globalAlpha = 0.85; c.fillRect(mx - 0.034, my + 0.13, 0.068, 0.15); c.globalAlpha = 1; // tape
      if (fine) {
        c.fillStyle = figC('#ece8dc'); c.fillRect(mx + 0.07, my - 0.03, 0.12, 0.08);
        c.strokeStyle = figC('#6f747a'); c.lineWidth = Math.max(0.007, px * 0.6); c.beginPath(); c.moveTo(mx + 0.085, my + 0.025); c.lineTo(mx + 0.175, my + 0.025); c.moveTo(mx + 0.085, my + 0.003); c.lineTo(mx + 0.15, my + 0.003); c.stroke();
      }
      c.beginPath(); c.moveTo(mx - 0.23, my + 0.268); c.lineTo(mx + 0.23, my + 0.268); figGlint(c, G, 0.014, 0.8);
    }
  } else if (bag === 'paper') {
    my = Math.max(my, 0.06);
    const col = '#e9e6dc', dip = 0.03;
    const trace = () => { c.moveTo(mx - 0.215, my - 0.03); c.lineTo(mx, my - 0.03 - dip); c.lineTo(mx + 0.215, my - 0.03); c.lineTo(mx + 0.215, my + 0.28); c.lineTo(mx, my + 0.28 - dip); c.lineTo(mx - 0.215, my + 0.28); c.closePath(); };
    if (!mode) { trace(); return; }
    c.fillStyle = figC(col); c.beginPath(); trace(); c.fill();
    if (hi) {
      c.fillStyle = '#000000'; c.globalAlpha = 0.12; c.beginPath(); c.moveTo(mx, my - 0.03 - dip); c.lineTo(mx - ls * 0.215, my - 0.03); c.lineTo(mx - ls * 0.215, my + 0.28); c.lineTo(mx, my + 0.28 - dip); c.closePath(); c.fill(); c.globalAlpha = 1;
      c.strokeStyle = figSh(col, 0.4); c.lineWidth = Math.max(0.009, px * 0.7); c.beginPath(); c.moveTo(mx, my - 0.03 - dip); c.lineTo(mx, my + 0.28 - dip); c.stroke();
      c.fillStyle = figC('#3b3f45');
      c.beginPath(); c.moveTo(mx - 0.19, my + 0.245); c.lineTo(mx - 0.03, my + 0.223); c.lineTo(mx - 0.03, my + 0.193); c.lineTo(mx - 0.19, my + 0.215); c.closePath();
      c.moveTo(mx + 0.03, my + 0.223); c.lineTo(mx + 0.13, my + 0.237); c.lineTo(mx + 0.13, my + 0.207); c.lineTo(mx + 0.03, my + 0.193); c.closePath(); c.fill();
      if (fine) {
        c.fillStyle = figC('#8b9097'); c.fillRect(mx + 0.045, my + 0.02, 0.1, 0.085);
        c.strokeStyle = figC('#7d8289'); c.lineWidth = Math.max(0.007, px * 0.6); c.beginPath();
        for (let i = 0; i < 5; i++) { const y = my + 0.165 - i * 0.034; c.moveTo(mx - 0.19, y + 0.022); c.lineTo(mx - 0.03, y); if (i < 2) { c.moveTo(mx + 0.03, y); c.lineTo(mx + 0.19, y + 0.022); } }
        c.stroke();
      }
    }
  }
}

// Carried in the hand that is nearer to us.
function figCarry(c, G, mode) {
  const L = G.L, bag = L.bag, ha = G.cR, px = G.px, hi = G.hi, fine = G.fine, f = G.f, env = G.env, ls = G.lx >= 0 ? 1 : -1;
  switch (bag) {
    case 'case': {
      c.save(); figHang(c, G, ha, 0.34);
      if (!mode) { figRR(c, -0.215, -0.335, 0.43, 0.285, 0.03); c.restore(); return; }
      const col = L.bagCol || '#7b5a36', dark = figSh(col, 0.36), metal = figC('#cdb67a');
      c.strokeStyle = dark; c.lineWidth = Math.max(0.024, px); c.beginPath(); c.moveTo(-0.07, -0.055); c.lineTo(-0.07, -0.012); c.quadraticCurveTo(-0.07, 0.004, -0.05, 0.004); c.lineTo(0.05, 0.004); c.quadraticCurveTo(0.07, 0.004, 0.07, -0.012); c.lineTo(0.07, -0.055); c.stroke();
      c.fillStyle = figC(col); c.beginPath(); figRR(c, -0.215, -0.335, 0.43, 0.285, 0.03); c.fill();
      if (hi) {
        c.fillStyle = '#000000'; c.globalAlpha = 0.17; c.beginPath(); figRR(c, -0.215, -0.335, 0.43, 0.1, 0.03); c.fill(); c.globalAlpha = 1;
        c.strokeStyle = dark; c.lineWidth = Math.max(0.012, px * 0.8); c.beginPath(); c.moveTo(-0.215, -0.128); c.lineTo(0.215, -0.128); c.stroke(); // where the lid meets the body
        c.fillStyle = metal; c.fillRect(-0.135, -0.152, 0.04, 0.048); c.fillRect(0.095, -0.152, 0.04, 0.048); // clasps
        if (fine) {
          c.fillRect(-0.084, -0.062, 0.028, 0.02); c.fillRect(0.056, -0.062, 0.028, 0.02); // handle mounts
          c.fillStyle = dark; c.beginPath(); // corner guards
          c.moveTo(-0.215, -0.335 + 0.055); c.lineTo(-0.215 + 0.055, -0.335); c.lineTo(-0.195, -0.335); c.quadraticCurveTo(-0.215, -0.335, -0.215, -0.315); c.closePath();
          c.moveTo(0.215, -0.335 + 0.055); c.lineTo(0.215 - 0.055, -0.335); c.lineTo(0.195, -0.335); c.quadraticCurveTo(0.215, -0.335, 0.215, -0.315); c.closePath();
          c.moveTo(-0.215, -0.05 - 0.05); c.lineTo(-0.215 + 0.05, -0.05); c.lineTo(-0.195, -0.05); c.quadraticCurveTo(-0.215, -0.05, -0.215, -0.07); c.closePath();
          c.moveTo(0.215, -0.05 - 0.05); c.lineTo(0.215 - 0.05, -0.05); c.lineTo(0.195, -0.05); c.quadraticCurveTo(0.215, -0.05, 0.215, -0.07); c.closePath(); c.fill();
          c.strokeStyle = figHi(col, 0.3); c.globalAlpha = 0.5; c.lineWidth = Math.max(0.006, px * 0.6); c.beginPath(); figRR(c, -0.195, -0.315, 0.39, 0.17, 0.02); c.stroke(); c.globalAlpha = 1; // stitching
        }
        c.beginPath(); c.moveTo(-0.185, -0.064); c.lineTo(0.185, -0.064); figGlint(c, G, 0.013, 0.9);
      }
      c.restore(); return;
    }
    case 'duffel': {
      c.save(); figHang(c, G, ha, 0.47);
      if (!mode) { figDuffelPath(c); c.restore(); return; }
      const col = L.bagCol || '#3f4a5c', dark = figSh(col, 0.32), web = figSh(col, 0.56), yt = -0.165, yb = -0.445;
      // the far handle, behind the bag
      c.strokeStyle = figSh(col, 0.66); c.lineWidth = Math.max(0.028, px); c.beginPath();
      c.moveTo(-0.13, yt - 0.01); c.quadraticCurveTo(-0.1, -0.06, -0.006, -0.012); c.moveTo(0.17, yt - 0.01); c.quadraticCurveTo(0.14, -0.06, 0.03, -0.012); c.stroke();
      c.fillStyle = figC(col); c.beginPath(); figDuffelPath(c); c.fill();
      // round end panels, which is what makes it a barrel
      c.fillStyle = dark; c.beginPath(); c.ellipse(-0.292, -0.305, 0.04, 0.122, 0, 0, TAU); c.ellipse(0.292, -0.305, 0.04, 0.122, 0, 0, TAU); c.fill();
      if (hi) {
        c.fillStyle = '#000000'; c.globalAlpha = 0.17; c.beginPath(); c.moveTo(-0.34, -0.335); c.lineTo(0.34, -0.335); c.lineTo(0.34, yb + 0.1); c.quadraticCurveTo(0.34, yb, 0.24, yb); c.quadraticCurveTo(0, yb - 0.032, -0.24, yb); c.quadraticCurveTo(-0.34, yb, -0.34, yb + 0.1); c.closePath(); c.fill(); c.globalAlpha = 1;
        c.strokeStyle = figHi(col, 0.22); c.lineWidth = Math.max(0.008, px * 0.7); c.beginPath(); c.ellipse(-0.292, -0.305, 0.04, 0.122, 0, 0, TAU); c.moveTo(0.332, -0.305); c.ellipse(0.292, -0.305, 0.04, 0.122, 0, 0, TAU); c.stroke(); // piping
      }
      // webbing: two bands round the body that carry on up into the handles
      c.fillStyle = web; c.fillRect(-0.169, yb - 0.014, 0.038, yt - yb + 0.008); c.fillRect(0.131, yb - 0.014, 0.038, yt - yb + 0.008);
      c.strokeStyle = web; c.lineWidth = Math.max(0.034, px); c.beginPath();
      c.moveTo(-0.15, yt - 0.012); c.quadraticCurveTo(-0.125, -0.055, -0.02, -0.008); c.moveTo(0.15, yt - 0.012); c.quadraticCurveTo(0.125, -0.055, 0.02, -0.008); c.stroke();
      if (hi) {
        c.fillStyle = figSh(col, 0.7); c.beginPath(); figRR(c, -0.052, -0.03, 0.104, 0.044, 0.016); c.fill(); // the wrap that joins the two handles
        const zip = figC('#b9bec4');
        c.strokeStyle = zip; c.lineWidth = Math.max(0.011, px * 0.8); c.beginPath(); c.moveTo(-0.25, yt - 0.04); c.quadraticCurveTo(0, yt - 0.052, 0.25, yt - 0.04); c.stroke();
        c.fillStyle = zip; c.fillRect(0.2, yt - 0.078, 0.02, 0.042); // zip pull
        if (fine) {
          c.strokeStyle = dark; c.lineWidth = Math.max(0.008, px * 0.7); c.beginPath(); c.moveTo(-0.245, -0.34); c.lineTo(-0.175, -0.34); c.moveTo(-0.125, -0.34); c.lineTo(0.125, -0.34); c.moveTo(0.175, -0.34); c.lineTo(0.245, -0.34); c.stroke(); // seam
          // shoulder strap: a ring at each end and a slack strap with a pad
          c.strokeStyle = zip; c.lineWidth = Math.max(0.009, px * 0.7); c.beginPath(); c.arc(-0.305, yt - 0.02, 0.017, 0, TAU); c.moveTo(0.322, yt - 0.02); c.arc(0.305, yt - 0.02, 0.017, 0, TAU); c.stroke();
          c.strokeStyle = figSh(col, 0.62); c.lineWidth = Math.max(0.02, px); c.beginPath(); c.moveTo(-0.305, yt - 0.035); c.quadraticCurveTo(0, yt - 0.33, 0.305, yt - 0.035); c.stroke();
          c.lineWidth = Math.max(0.036, px); c.beginPath(); c.moveTo(-0.07, yt - 0.172); c.quadraticCurveTo(0, yt - 0.186, 0.07, yt - 0.172); c.stroke();
          // stitched boxes where the webbing is sewn on
          c.strokeStyle = figHi(col, 0.25); c.globalAlpha = 0.6; c.lineWidth = Math.max(0.006, px * 0.6); c.beginPath(); c.rect(-0.163, yt - 0.075, 0.026, 0.04); c.rect(0.137, yt - 0.075, 0.026, 0.04); c.stroke(); c.globalAlpha = 1;
        }
        c.beginPath(); c.moveTo(-0.24, yt - 0.016); c.quadraticCurveTo(0, yt - 0.03, 0.24, yt - 0.016); figGlint(c, G, 0.014, 0.9);
      }
      c.restore(); return;
    }
    case 'shopping': {
      c.save(); figHang(c, G, ha, 0.48);
      const trace = () => { c.moveTo(-0.125, -0.105); c.lineTo(0.125, -0.105); c.lineTo(0.155, -0.465); c.lineTo(-0.155, -0.465); c.closePath(); };
      if (!mode) { trace(); c.restore(); return; }
      const col = L.bagCol || '#e9e2d0', dark = figSh(col, 0.3);
      c.strokeStyle = figSh(col, 0.45); c.lineWidth = Math.max(0.014, px * 0.9); c.beginPath();
      c.moveTo(-0.07, -0.105); c.quadraticCurveTo(-0.06, -0.02, 0, -0.004); c.quadraticCurveTo(0.06, -0.02, 0.07, -0.105);
      if (hi) { c.moveTo(-0.04, -0.105); c.quadraticCurveTo(-0.03, -0.03, 0.012, -0.012); c.quadraticCurveTo(0.075, -0.03, 0.095, -0.105); }
      c.stroke();
      c.fillStyle = figC(col); c.beginPath(); trace(); c.fill();
      if (hi) {
        c.fillStyle = '#000000'; c.globalAlpha = 0.14; c.beginPath(); c.moveTo(-ls * 0.125, -0.105); c.lineTo(-ls * 0.155, -0.465); c.lineTo(-ls * 0.095, -0.465); c.lineTo(-ls * 0.085, -0.105); c.closePath(); c.fill(); // the gusset down the side
        c.fillRect(-0.153, -0.465, 0.306, 0.04); c.globalAlpha = 1;
        c.fillStyle = dark; c.globalAlpha = 0.55; c.fillRect(-0.127, -0.152, 0.254, 0.047); c.globalAlpha = 1; // the folded top
        if (fine) { c.strokeStyle = dark; c.lineWidth = Math.max(0.007, px * 0.6); c.beginPath(); c.moveTo(0.02, -0.152); c.lineTo(0.03, -0.465); c.moveTo(-0.14, -0.35); c.lineTo(0.14, -0.35); c.stroke(); }
        c.beginPath(); c.moveTo(ls * 0.11, -0.16); c.lineTo(ls * 0.14, -0.44); figGlint(c, G, 0.012, 0.6);
      }
      c.restore(); return;
    }
    case 'cup': {
      c.save();
      if (G.dead) { c.translate(ha[0] + G.fs * 0.06, Math.max(0.045, ha[1] - 0.02)); c.rotate(-G.fs * 1.5 * smooth(G.dT / 0.5)); }
      else { c.translate(ha[0], ha[1]); const up = clamp((ha[1] - G.neck[1]) / 0.12, 0, 1); if (up) c.rotate(f * 0.75 * up); }
      const trace = () => { c.moveTo(-0.032, -0.03); c.lineTo(0.032, -0.03); c.lineTo(0.044, 0.105); c.lineTo(-0.044, 0.105); c.closePath(); };
      if (!mode) { trace(); c.restore(); return; }
      const col = L.bagCol || '#f1ede2';
      c.fillStyle = figC(col); c.beginPath(); trace(); c.fill();
      if (hi) {
        c.fillStyle = figC('#a9865c'); c.beginPath(); c.moveTo(-0.036, 0.012); c.lineTo(0.036, 0.012); c.lineTo(0.04, 0.062); c.lineTo(-0.04, 0.062); c.closePath(); c.fill(); // the card sleeve
        c.fillStyle = figSh(col, 0.2); c.beginPath(); figRR(c, -0.049, 0.098, 0.098, 0.025, 0.009); c.fill(); // lid
        if (fine && !G.dead) { // steam
          const t = G.t * 1.2 + G.seed; c.strokeStyle = 'rgba(236,240,244,0.5)'; c.lineWidth = Math.max(0.01, px * 0.7); c.beginPath();
          c.moveTo(-0.012, 0.135); c.quadraticCurveTo(-0.012 + Math.sin(t) * 0.03, 0.18, -0.012 + Math.sin(t + 1) * 0.025, 0.225);
          c.moveTo(0.016, 0.14); c.quadraticCurveTo(0.016 + Math.sin(t + 2) * 0.03, 0.19, 0.016 + Math.sin(t + 3.2) * 0.03, 0.245); c.stroke();
        }
      }
      c.restore(); return;
    }
    case 'flowers': {
      c.save();
      if (G.dead) { c.translate(ha[0], Math.max(0.05, ha[1])); c.rotate(-G.fs * 1.45 * smooth(G.dT / 0.5)); } else { c.translate(ha[0], ha[1]); c.rotate(-f * 0.3 + G.lag * 1.2); }
      if (!mode) { c.moveTo(-0.03, -0.03); c.lineTo(0.03, -0.03); c.lineTo(0.14, 0.27); c.quadraticCurveTo(0.12, 0.44, 0, 0.44); c.quadraticCurveTo(-0.12, 0.44, -0.14, 0.27); c.closePath(); c.restore(); return; }
      const col = L.bagCol || '#e85d75', green = figC('#4c9a56');
      c.strokeStyle = green; c.lineWidth = Math.max(0.014, px * 0.9); c.beginPath(); c.moveTo(0, 0); c.lineTo(-0.02, -0.1); c.moveTo(0, 0); c.lineTo(0.015, -0.11); c.moveTo(0, 0); c.lineTo(0, -0.09); c.stroke();
      c.fillStyle = green; c.beginPath(); c.ellipse(-0.105, 0.265, 0.05, 0.022, 0.9, 0, TAU); c.ellipse(0.105, 0.27, 0.05, 0.022, -0.9, 0, TAU); c.ellipse(0, 0.3, 0.1, 0.06, 0, 0, TAU); c.fill();
      c.fillStyle = figC('#e6dcc4'); c.beginPath(); c.moveTo(-0.03, -0.025); c.lineTo(0.03, -0.025); c.lineTo(0.13, 0.25); c.lineTo(0, 0.2); c.lineTo(-0.13, 0.25); c.closePath(); c.fill(); // the paper round them
      if (hi) { c.fillStyle = '#000000'; c.globalAlpha = 0.13; c.beginPath(); c.moveTo(0, -0.025); c.lineTo(-ls * 0.03, -0.025); c.lineTo(-ls * 0.13, 0.25); c.lineTo(0, 0.2); c.closePath(); c.fill(); c.globalAlpha = 1; }
      c.fillStyle = figC(col); c.beginPath();
      c.arc(-0.075, 0.3, 0.056, 0, TAU); c.moveTo(0.13, 0.31); c.arc(0.075, 0.31, 0.056, 0, TAU); c.moveTo(0.06, 0.375); c.arc(0, 0.375, 0.06, 0, TAU); c.moveTo(0.02, 0.27); c.arc(-0.03, 0.27, 0.05, 0, TAU); c.moveTo(0.09, 0.265); c.arc(0.045, 0.265, 0.045, 0, TAU); c.fill();
      if (hi) {
        c.fillStyle = figHi(col, 0.5); c.beginPath(); c.arc(-0.075, 0.305, 0.02, 0, TAU); c.moveTo(0.095, 0.315); c.arc(0.075, 0.315, 0.02, 0, TAU); c.moveTo(0.022, 0.38); c.arc(0, 0.38, 0.022, 0, TAU); c.fill();
        c.fillStyle = figSh(col, 0.35); c.fillRect(-0.034, -0.012, 0.068, 0.026); // the tie round the stems
      }
      c.restore(); return;
    }
    case 'cane': {
      if (!mode) return;
      const col = L.bagCol || '#d8d2c4', w = Math.max(0.03, px);
      let x0 = ha[0], y0 = ha[1] + 0.035, x1 = ha[0] + f * 0.12, y1 = 0.004, hook = 1;
      if (G.dead) { const k = smooth(G.dT / 0.55); y0 = lerp(y0, 0.03, k); x1 = lerp(x1, ha[0] + G.fs * 0.86, k); y1 = lerp(0.004, 0.022, k); hook = 1 - k * 0.6; }
      c.strokeStyle = figC(col); c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x0, y0);
      c.quadraticCurveTo(x0 - f * 0.006, y0 + 0.075 * hook, x0 - f * 0.055, y0 + 0.075 * hook); c.quadraticCurveTo(x0 - f * 0.105, y0 + 0.075 * hook, x0 - f * 0.105, y0 + 0.02 * hook); c.stroke();
      if (hi) {
        c.strokeStyle = figC('#2a2420'); c.lineCap = 'butt'; c.beginPath(); c.moveTo(x1, y1); c.lineTo(lerp(x1, x0, 0.05), lerp(y1, y0, 0.05)); c.stroke(); c.lineCap = 'round'; // rubber tip
        if (fine) { c.strokeStyle = figC('#cdb67a'); c.lineCap = 'butt'; c.beginPath(); c.moveTo(lerp(x1, x0, 0.9), lerp(y1, y0, 0.9)); c.lineTo(lerp(x1, x0, 0.925), lerp(y1, y0, 0.925)); c.stroke(); c.lineCap = 'round'; }
      }
      return;
    }
    case 'umbrella': {
      let R0 = 2.16 - ha[1], hy = ha[1], tilt = clamp(-G.wind * 0.012, -0.1, 0.1) + G.lag * 0.5 - clamp(Math.atan2(lerp(ha[0], G.neck[0], 0.75) - ha[0], R0 + 0.2), -0.4, 0.4);
      if (G.dead) { const k = smooth(G.dT / 0.65); R0 = 1.32; hy = Math.max(0.04, ha[1]); tilt = G.fs * 1.08 * k; }
      c.save(); c.translate(ha[0], hy); c.rotate(tilt);
      if (!mode) { figBrollyPath(c, R0); c.restore(); return; }
      const col = L.bagCol || '#c0392b', dark = figSh(col, 0.4), top = R0 + 0.41;
      if (mode === 2) { // only the crook handle, which goes in front of the body
        c.strokeStyle = figC('#6b4a2b'); c.lineWidth = Math.max(0.034, px); c.beginPath(); c.moveTo(0, 0.045); c.lineTo(0, -0.085); c.quadraticCurveTo(0, -0.14, f * 0.045, -0.14); c.quadraticCurveTo(f * 0.09, -0.14, f * 0.09, -0.09); c.stroke();
        c.restore(); return;
      }
      c.strokeStyle = figC('#2b2e34'); c.lineWidth = Math.max(0.024, px * 0.9); c.beginPath(); c.moveTo(0, -0.05); c.lineTo(0, top + 0.085); c.stroke(); // shaft, and the tip above the cloth
      c.fillStyle = figC(col); c.beginPath(); figBrollyPath(c, R0); c.fill();
      if (hi) {
        // every second panel a little darker, and the side away from the light darker again
        c.fillStyle = '#000000';
        for (let i = 0; i < 6; i++) {
          const away = (figBrollyX(i) + 0.1) * ls < 0;
          if (!(i & 1) && !away) continue;
          c.globalAlpha = (i & 1 ? 0.1 : 0) + (away ? 0.13 : 0);
          const x = figBrollyX(i), y = figBrollyY(i, R0), xp = figBrollyX(i + 1), yp = figBrollyY(i + 1, R0);
          c.beginPath(); c.moveTo(0, top); c.quadraticCurveTo(x * 0.92, R0 + 0.33, x, y); c.quadraticCurveTo((x + xp) / 2, (y + yp) / 2 + 0.05, xp, yp); c.quadraticCurveTo(xp * 0.92, R0 + 0.33, 0, top); c.fill();
        }
        c.globalAlpha = 1;
        c.strokeStyle = dark; c.lineWidth = Math.max(0.01, px * 0.8); c.beginPath();
        for (let i = 1; i < 6; i++) { c.moveTo(0, top); c.quadraticCurveTo(figBrollyX(i) * 0.92, R0 + 0.33, figBrollyX(i), figBrollyY(i, R0)); }
        c.stroke();
        if (fine) { // the stretchers underneath, and a bead on every rib tip
          c.strokeStyle = figC('#2b2e34'); c.lineWidth = Math.max(0.008, px * 0.7); c.beginPath(); c.moveTo(0, R0 - 0.2); c.lineTo(-0.3, R0 - 0.02); c.moveTo(0, R0 - 0.2); c.lineTo(0.3, R0 - 0.02); c.stroke();
          c.fillStyle = dark; c.beginPath(); for (let i = 0; i <= 6; i++) { const x = figBrollyX(i), y = figBrollyY(i, R0); c.moveTo(x + 0.012, y); c.arc(x, y, 0.012, 0, TAU); } c.fill();
        }
        c.beginPath(); c.moveTo(ls * 0.1, top - 0.03); c.quadraticCurveTo(ls * 0.46, R0 + 0.33, ls * 0.56, R0 + 0.12); figGlint(c, G, 0.022, 0.8);
        // rain running off the rib tips
        if (!G.dead && (env.weather === 'rain' || env.weather === 'storm')) {
          c.strokeStyle = 'rgba(205,220,240,0.6)'; c.lineWidth = Math.max(0.012, px * 0.8); c.beginPath();
          for (let i = 0; i <= 6; i++) { const u = (G.t * 1.15 + i * 0.37 + G.seed) % 1, x = figBrollyX(i), y = figBrollyY(i, R0) - 0.015 - u * u * 0.8; if (u > 0.85) continue; c.moveTo(x, y); c.lineTo(x, y - 0.03 - u * 0.05); }
          c.stroke();
        }
      }
      c.restore(); return;
    }
    case 'balloon': {
      if (G.dead && G.dT > 6) return;
      const sway = Math.sin(G.t * 1.3 + G.seed) * 0.1 + clamp(G.wind * 0.045, -0.45, 0.45) + G.lag * 2.2;
      const bx = ha[0] + sway + (G.dead ? G.wind * 0.5 * G.dT : 0), by = 2.98 + Math.sin(G.t * 0.9 + G.seed * 2) * 0.025 + (G.dead ? G.dT * 1.7 : 0);
      const hx = G.dead ? bx - sway * 0.4 : ha[0], hy = G.dead ? by - 1.9 : ha[1], tilt = clamp(-sway * 0.3, -0.3, 0.3);
      if (!mode) { c.moveTo(bx + 0.2, by); c.ellipse(bx, by, 0.2, 0.25, tilt, 0, TAU); return; }
      const col = L.bagCol || '#e0413a';
      c.strokeStyle = figC('#d7dbe0'); c.lineWidth = Math.max(0.012, px * 0.7); c.beginPath(); c.moveTo(hx, hy);
      c.bezierCurveTo(hx + sway * 0.1 - 0.05, lerp(hy, by, 0.4), bx - sway * 0.5 + 0.06, lerp(hy, by, 0.7), bx + Math.sin(tilt) * 0.27, by - Math.cos(tilt) * 0.27); c.stroke();
      c.save(); c.translate(bx, by); c.rotate(tilt);
      c.fillStyle = figC(col); c.beginPath(); c.moveTo(0, -0.27); c.bezierCurveTo(-0.14, -0.2, -0.21, -0.08, -0.2, 0.03); c.bezierCurveTo(-0.19, 0.2, -0.1, 0.25, 0, 0.25); c.bezierCurveTo(0.1, 0.25, 0.19, 0.2, 0.2, 0.03); c.bezierCurveTo(0.21, -0.08, 0.14, -0.2, 0, -0.27); c.fill();
      c.beginPath(); c.moveTo(0, -0.26); c.lineTo(-0.028, -0.305); c.lineTo(0.028, -0.305); c.closePath(); c.fill(); // the knot
      if (hi) {
        c.fillStyle = '#000000'; c.globalAlpha = 0.14; c.beginPath(); c.moveTo(0, -0.27); c.bezierCurveTo(-ls * 0.14, -0.2, -ls * 0.21, -0.08, -ls * 0.2, 0.03); c.bezierCurveTo(-ls * 0.19, 0.2, -ls * 0.1, 0.25, 0, 0.25); c.bezierCurveTo(-ls * 0.13, 0.12, -ls * 0.13, -0.1, 0, -0.27); c.fill();
        c.fillStyle = '#ffffff'; c.globalAlpha = 0.2 + 0.5 * G.la; c.beginPath(); c.ellipse(ls * 0.085, 0.1, 0.03, 0.065, ls * 0.35, 0, TAU); c.fill(); c.globalAlpha = 1;
      }
      c.restore(); return;
    }
    default: return;
  }
}
// A clipboard, held in the further hand.
function figClip(c, G, mode) {
  const L = G.L, ha = G.cL, f = G.f, px = G.px;
  c.save();
  if (G.dead) { c.translate(ha[0], Math.max(0.03, ha[1])); c.rotate(G.fs * 1.5 * smooth(G.dT / 0.5)); } else { c.translate(ha[0], ha[1] + 0.085); c.rotate(-f * 0.12); }
  if (!mode) { figRR(c, -0.116, -0.15, 0.232, 0.315, 0.016); c.restore(); return; }
  const col = L.bagCol || '#e7e2d4';
  c.fillStyle = figSh(col, 0.26); c.beginPath(); figRR(c, -0.116, -0.15, 0.232, 0.315, 0.016); c.fill();
  c.fillStyle = figHi(col, 0.4); c.fillRect(-0.097, -0.134, 0.194, 0.262);
  if (G.hi) {
    c.fillStyle = figC('#8f969e'); c.beginPath(); figRR(c, -0.05, 0.122, 0.1, 0.044, 0.012); c.fill();
    if (G.fine) { c.strokeStyle = figC('#6f747a'); c.lineWidth = Math.max(0.007, px * 0.6); c.beginPath(); for (let i = 0; i < 6; i++) { const y = 0.085 - i * 0.036; c.moveTo(-0.075, y); c.lineTo(i % 3 === 2 ? 0.02 : 0.075, y); } c.stroke(); }
    if (!G.dead) { c.fillStyle = G.ink; c.beginPath(); c.arc(-f * 0.01, -0.082, 0.03, 0, TAU); c.fill(); } // the thumb that holds it
  }
  c.restore();
}

// ---- things that belong to what somebody is doing --------------------------
function figRifle(c, G) {
  const A = G.A, px = G.px, held = (G.anim === 'guard' || G.anim === 'aimrifle') && !G.dead;
  const a = G.haR, b = G.haL;
  let dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), ox = a[0], oy = a[1];
  if (G.dead) { ox = G.cR[0] - G.fs * 0.1; oy = Math.max(G.cR[1], 0.045); dx = G.fs; dy = 0.5 * (1 - smooth(G.dT / 0.45)); l = 0.34; }
  else if (!held || l < 0.05) { // not in the hands: slung on the back, muzzle up
    const o = -G.fl * (G.wc + 0.03); ox = figPX(G, 0.42, o); oy = figPY(G, 0.42, o); dx = G.ux + G.nx * G.fl * 0.2; dy = G.uy + G.ny * G.fl * 0.2; l = 0.3;
  }
  // While the person turns, the gun is seen end on: work out its true line, then squash it sideways with the body.
  const sq = Math.max(G.fa, 0.22); dx /= sq;
  const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl; if (held && !G.dead) l = dl;
  c.save(); c.translate(ox, oy); if (sq < 1) c.scale(sq, 1); c.rotate(Math.atan2(dy, dx)); if (dx < 0) c.scale(1, -1);
  const tip = clamp(l, 0.2, 0.5) + 0.4, metal = figC('#101216'), wood = figC('#3d2b1c');
  c.fillStyle = wood; c.beginPath(); c.moveTo(-0.3, 0.036); c.lineTo(-0.3, -0.072); c.lineTo(-0.07, -0.022); c.lineTo(-0.05, 0.032); c.closePath(); c.fill(); // stock
  c.fillStyle = metal; c.beginPath();
  c.rect(-0.07, -0.03, 0.29, 0.066); // receiver
  c.moveTo(0.085, -0.03); c.lineTo(0.07, -0.135); c.lineTo(0.125, -0.145); c.lineTo(0.145, -0.03); c.closePath(); // magazine
  c.moveTo(-0.03, -0.03); c.lineTo(-0.055, -0.105); c.lineTo(-0.015, -0.11); c.lineTo(0.015, -0.03); c.closePath(); // grip
  c.fill();
  c.fillStyle = wood; c.beginPath(); figRR(c, 0.22, -0.026, Math.max(0.1, tip - 0.52), 0.05, 0.012); c.fill(); // fore-end
  c.strokeStyle = metal; c.lineWidth = Math.max(0.022, px); c.lineCap = 'butt'; c.beginPath(); c.moveTo(0.2, 0.008); c.lineTo(tip, 0.008); c.stroke(); // barrel
  if (G.hi) {
    c.lineWidth = Math.max(0.012, px * 0.8); c.beginPath(); c.moveTo(tip - 0.03, 0.01); c.lineTo(tip - 0.03, 0.05); c.moveTo(0.02, 0.036); c.lineTo(0.02, 0.058); c.stroke(); // sights
    if (G.fine && held) { c.strokeStyle = figC('#4a4034'); c.lineWidth = Math.max(0.012, px * 0.8); c.lineCap = 'round'; c.beginPath(); c.moveTo(-0.26, -0.05); c.quadraticCurveTo(0, -0.2, tip - 0.14, -0.012); c.stroke(); } // sling
  }
  c.lineCap = 'round';
  // a thin pale line along the top, so a black rifle shows against a dark wall
  if (G.rim) { c.strokeStyle = G.rim; c.lineWidth = Math.max(0.011, px * 0.6); c.beginPath(); c.moveTo(-0.29, 0.044); c.lineTo(0.2, 0.044); c.moveTo(0.22, 0.026); c.lineTo(tip, 0.026); c.stroke(); }
  c.restore();
}
function figProps(c, G) {
  const anim = G.anim, ha = G.haR, f = G.f, px = G.px, env = G.env, hi = G.hi;
  if (anim === 'aim') {
    // a pistol, pointing where the arm points
    let dx = ha[0] - G.elR[0], dy = ha[1] - G.elR[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    c.save(); c.translate(ha[0], ha[1]); c.rotate(Math.atan2(dy, dx)); if (dx < 0) c.scale(1, -1);
    c.fillStyle = figC('#0e1013'); c.beginPath(); figRR(c, -0.03, 0.004, 0.235, 0.062, 0.01);
    c.moveTo(-0.03, 0.01); c.lineTo(-0.058, -0.1); c.lineTo(-0.008, -0.108); c.lineTo(0.03, 0.01); c.closePath(); c.fill();
    if (hi) {
      c.strokeStyle = figC('#0e1013'); c.lineWidth = Math.max(0.01, px * 0.7); c.beginPath(); c.moveTo(0.03, 0.004); c.quadraticCurveTo(0.05, -0.045, 0.012, -0.05); c.stroke();
      if (G.rim) { c.strokeStyle = G.rim; c.lineWidth = Math.max(0.009, px * 0.6); c.beginPath(); c.moveTo(-0.02, 0.072); c.lineTo(0.2, 0.072); c.stroke(); }
    }
    c.restore();
    c.fillStyle = G.ink; c.beginPath(); c.arc(ha[0], ha[1], 0.036 * G.bw, 0, TAU); c.fill();
  } else if (anim === 'look') {
    // binoculars at the eyes
    c.save(); c.translate(G.hdx, G.hdy); if (G.htilt) c.rotate(G.htilt);
    const y = 0.022;
    c.fillStyle = figC('#0e1013'); c.beginPath(); c.moveTo(f * 0.09, y + 0.036); c.lineTo(f * 0.19, y + 0.04); c.lineTo(f * 0.2, y + 0.06); c.lineTo(f * 0.33, y + 0.064); c.lineTo(f * 0.33, y - 0.064); c.lineTo(f * 0.2, y - 0.06); c.lineTo(f * 0.19, y - 0.04); c.lineTo(f * 0.09, y - 0.036); c.closePath(); c.fill();
    if (hi) {
      c.strokeStyle = figC('#3a3f47'); c.lineWidth = Math.max(0.012, px * 0.8); c.lineCap = 'butt'; c.beginPath(); c.moveTo(f * 0.2, y + 0.06); c.lineTo(f * 0.2, y - 0.06); c.moveTo(f * 0.3, y + 0.064); c.lineTo(f * 0.3, y - 0.064); c.stroke(); c.lineCap = 'round';
      c.strokeStyle = figC('#7fa8c8'); c.globalAlpha = 0.5 + 0.4 * G.la; c.lineWidth = Math.max(0.012, px * 0.8); c.beginPath(); c.moveTo(f * 0.333, y + 0.045); c.lineTo(f * 0.333, y - 0.02); c.stroke(); c.globalAlpha = 1; // the glass
      if (G.rim) { c.strokeStyle = G.rim; c.lineWidth = Math.max(0.009, px * 0.6); c.beginPath(); c.moveTo(f * 0.1, y + 0.046); c.lineTo(f * 0.19, y + 0.05); c.moveTo(f * 0.21, y + 0.072); c.lineTo(f * 0.32, y + 0.074); c.stroke(); }
    }
    c.restore();
    c.fillStyle = G.ink; c.beginPath(); c.arc(ha[0], ha[1], 0.036 * G.bw, 0, TAU); c.fill();
  } else if (anim === 'sweep') {
    // a broom: handle through both hands, head on the ground
    const tx = ha[0] - f * 0.1, ty = ha[1] + 0.3, bx = G.haL[0] + f * 0.35, by = 0.05;
    c.strokeStyle = figC('#b58d55'); c.lineWidth = Math.max(0.03, px * 0.9); c.beginPath(); c.moveTo(tx, ty); c.lineTo(bx, by + 0.03); c.stroke();
    let dx = bx - tx, dy = by - ty; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    c.fillStyle = figC('#7a5a36'); c.beginPath(); c.moveTo(bx - dy * 0.11, by + 0.05 + dx * 0.02); c.lineTo(bx + dy * 0.11, by + 0.05 - dx * 0.02); c.lineTo(bx + dy * 0.12, by + 0.01); c.lineTo(bx - dy * 0.12, by + 0.01); c.closePath(); c.fill();
    c.strokeStyle = figC('#c9a868'); c.lineWidth = Math.max(0.014, px * 0.8); c.lineCap = 'butt'; c.beginPath();
    for (let i = -3; i <= 3; i++) { c.moveTo(bx + i * 0.036 * (dy < 0 ? -dy : dy), by + 0.012); c.lineTo(bx + i * 0.044 * (dy < 0 ? -dy : dy) + f * 0.02, 0); }
    c.stroke(); c.lineCap = 'round';
  } else if (anim === 'phone' || anim === 'sitphone') {
    let dx = ha[0] - G.elR[0], dy = ha[1] - G.elR[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    c.save(); c.translate(ha[0] + dx * 0.02, ha[1] + dy * 0.02); c.rotate(Math.atan2(dy, dx) - Math.PI / 2);
    c.fillStyle = figC('#23272e'); c.beginPath(); figRR(c, -0.04, -0.045, 0.08, 0.155, 0.014); c.fill();
    if (env.dark) { c.fillStyle = '#cfe6ff'; c.fillRect(-0.03, -0.03, 0.06, 0.125); }
    else if (hi) { c.fillStyle = figC('#5d7691'); c.fillRect(-0.03, -0.03, 0.06, 0.125); }
    c.restore();
    if (env.dark) { // the screen lights the side of the face
      c.fillStyle = '#cfe6ff'; c.globalAlpha = 0.1; c.beginPath(); c.arc(ha[0], ha[1] + 0.04, 0.34, 0, TAU); c.fill();
      c.globalAlpha = 0.13; c.beginPath(); c.arc(ha[0], ha[1] + 0.04, 0.17, 0, TAU); c.fill(); c.globalAlpha = 1;
    }
    if (hi) { c.fillStyle = G.ink; c.beginPath(); c.arc(ha[0] - f * 0.012, ha[1] - 0.012, 0.03 * G.bw, 0, TAU); c.fill(); }
  } else if (anim === 'smoke') {
    // a cigarette between the fingers, its ember, and the smoke
    const cx = ha[0] + f * 0.03, cy = ha[1] + 0.012, ex = ha[0] + f * 0.105, ey = ha[1] + 0.03;
    const drag = clamp((ha[1] - G.neck[1] + 0.12) / 0.2, 0, 1); // brighter while it is at the mouth
    if (hi) { c.strokeStyle = figC('#eeeae0'); c.lineWidth = Math.max(0.018, px * 0.9); c.lineCap = 'butt'; c.beginPath(); c.moveTo(cx, cy); c.lineTo(ex, ey); c.stroke(); c.lineCap = 'round'; }
    const glow = env.dark ? 1 : 0.5;
    c.fillStyle = '#ff8a3a'; c.beginPath(); c.arc(ex, ey, Math.max(px * 0.8, (env.dark ? 0.03 : 0.016) + 0.012 * drag + 0.006 * Math.sin(G.t * 5)), 0, TAU); c.fill();
    if (env.dark) { c.globalAlpha = 0.16 + 0.2 * drag; c.beginPath(); c.arc(ex, ey, 0.2 + 0.08 * drag, 0, TAU); c.fill(); c.globalAlpha = 0.22 * glow; c.beginPath(); c.arc(ex, ey, 0.09, 0, TAU); c.fill(); c.globalAlpha = 1; }
    const base = G.t + G.seed * 3, drift = env.windDrift || 0;
    c.fillStyle = env.smoke || 'rgba(220,225,232,0.35)';
    for (let i = 0; i < 6; i++) {
      const u = (base * 0.3 + i / 6) % 1, r = 0.022 + u * 0.13;
      c.globalAlpha = (1 - u) * (1 - u) * 0.55;
      c.beginPath(); c.arc(ex + Math.sin(u * 5.5 + i * 1.9 + G.seed) * (0.03 + 0.1 * u) + drift * u * 1.6, ey + 0.03 + u * 1.05, r, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
  }
}

// ---- clothes ---------------------------------------------------------------
// K says what this person wears: { coat, long, smock, dress, vest, body, sleeve, legs, shirt }.
const FIG_K = { coat: null, long: false, smock: false, dress: null, body: '#3c424b', sleeve: null, legs: null, shirt: '#c5c6c4', t0: 0, len: 0, flare: 0, sag: 0, swing: 0, follow: 1 };
function figWear(G) {
  const L = G.L, st = G.st, K = FIG_K, k = G.bw * (1 + 0.35 * (1 - G.fa)); // while turning we see a little more of the chest
  K.coat = L.coat || L.smock || null; K.smock = !L.coat && !!L.smock; K.long = !!L.long && !!L.coat; K.dress = L.dress || null;
  K.body = K.coat || K.dress || st.top; K.sleeve = K.coat ? K.coat : K.dress ? null : st.top; K.legs = K.dress ? null : st.legs;
  G.ww = (K.coat ? 0.094 : K.dress ? 0.068 : 0.076) * k; G.wc = (K.coat ? 0.108 : K.dress ? 0.086 : 0.09) * k; G.wsh = (K.coat ? 0.12 : 0.1) * k;
  K.t0 = K.coat || K.dress ? 0.0 : -0.035;
  if (K.long) { K.len = 0.4; K.flare = G.ww + 0.03; K.sag = 0.012; K.swing = 1; K.follow = 0.9; }
  else if (K.smock) { K.len = 0.25; K.flare = G.ww + 0.022; K.sag = 0.008; K.swing = 0.7; K.follow = 0.75; }
  else if (K.coat) { K.len = 0.1; K.flare = G.ww + 0.008; K.sag = 0; K.swing = 0.4; K.follow = 0.3; }
  else K.len = 0;
  return K;
}
// Everything that is not a limb or a head: skirt, coat, shirt front, tie, vest, scarf.
function figClothes(c, G, K) {
  const L = G.L, hi = G.hi, fine = G.fine, px = G.px, f = G.f, ww = G.ww, wc = G.wc, wsh = G.wsh;
  const ls = G.lx * G.nx + G.ly * G.ny >= 0 ? 1 : -1; // which side of the body the light is on
  if (K.dress) {
    const fl = (0.17 + 0.03 * (1 - G.fa)) * G.bw;
    c.fillStyle = figC(K.dress); c.beginPath(); figSkirtPath(c, G, G.ww + 0.01, 0.41, fl, 0.022, 0.9, 0.92); c.fill();
    if (fine) {
      const x0 = FIG_HEM[0], y0 = FIG_HEM[1], x1 = FIG_HEM[2], y1 = FIG_HEM[3], wx = figPX(G, 0.06, 0), wy = figPY(G, 0.06, 0);
      c.strokeStyle = figSh(K.dress, 0.28); c.lineWidth = Math.max(0.012, px * 0.8); c.beginPath();
      c.moveTo(wx - G.nx * ww * 0.3, wy - G.ny * ww * 0.3); c.lineTo(lerp(x0, x1, 0.3), lerp(y0, y1, 0.3) - 0.018);
      c.moveTo(wx + G.nx * ww * 0.35, wy + G.ny * ww * 0.35); c.lineTo(lerp(x0, x1, 0.72), lerp(y0, y1, 0.72) - 0.018); c.stroke();
      c.beginPath(); c.moveTo(lerp(x0, x1, ls > 0 ? 0.62 : 0.06), lerp(y0, y1, ls > 0 ? 0.62 : 0.06) + 0.02); c.lineTo(lerp(x0, x1, ls > 0 ? 0.94 : 0.38), lerp(y0, y1, ls > 0 ? 0.94 : 0.38) + 0.02); figGlint(c, G, 0.014, 0.5);
    }
  }
  // the body of the coat, dress or shirt, with whatever hangs below the waist
  if (K.dress && !K.coat) {
    c.fillStyle = G.ink; c.beginPath(); figTorsoPath(c, G, ww, wc, wsh, 0.3); c.fill();
    const top = 0.84, rise = f * 0.03;
    c.fillStyle = figC(K.dress); c.beginPath(); c.moveTo(figPX(G, 0, -ww), figPY(G, 0, -ww)); c.lineTo(figPX(G, 0.32, -ww * 0.94), figPY(G, 0.32, -ww * 0.94)); c.lineTo(figPX(G, top - rise, -wc), figPY(G, top - rise, -wc));
    c.quadraticCurveTo(figPX(G, top - 0.05, 0), figPY(G, top - 0.05, 0), figPX(G, top + rise, wc + 0.012 * f), figPY(G, top + rise, wc + 0.012 * f)); c.lineTo(figPX(G, 0.32, ww * 0.94), figPY(G, 0.32, ww * 0.94)); c.lineTo(figPX(G, 0, ww), figPY(G, 0, ww)); c.closePath(); c.fill();
    c.strokeStyle = figC(K.dress); c.lineWidth = Math.max(0.022, px * 0.9); c.lineCap = 'butt'; c.beginPath();
    c.moveTo(figPX(G, top - rise - 0.02, -wc * 0.82), figPY(G, top - rise - 0.02, -wc * 0.82)); c.lineTo(figPX(G, 1.0, -wsh * 0.42), figPY(G, 1.0, -wsh * 0.42));
    c.moveTo(figPX(G, top + rise - 0.02, wc * 0.82), figPY(G, top + rise - 0.02, wc * 0.82)); c.lineTo(figPX(G, 1.0, wsh * 0.42), figPY(G, 1.0, wsh * 0.42)); c.stroke(); c.lineCap = 'round';
  } else {
    c.fillStyle = figC(K.body); c.beginPath(); figTorsoPath(c, G, ww, wc, wsh, K.t0);
    if (K.len) figSkirtPath(c, G, ww, K.len, K.flare, K.sag, K.swing, K.follow);
    c.fill();
  }
  const hx0 = FIG_HEM[0], hy0 = FIG_HEM[1], hx1 = FIG_HEM[2], hy1 = FIG_HEM[3];
  if (hi) {
    // shade down the side away from the light, a bright edge on the side toward it
    if (fine) {
      c.strokeStyle = '#000000'; c.globalAlpha = 0.2; c.lineWidth = Math.max(0.034, px);
      c.beginPath(); c.moveTo(figPX(G, 0.1, -ls * (ww - 0.02)), figPY(G, 0.1, -ls * (ww - 0.02))); c.lineTo(figPX(G, 0.34, -ls * (ww - 0.024)), figPY(G, 0.34, -ls * (ww - 0.024))); c.lineTo(figPX(G, 0.78, -ls * (wc - 0.022)), figPY(G, 0.78, -ls * (wc - 0.022))); c.stroke(); c.globalAlpha = 1;
    }
    if (G.la > 0.03) {
      c.beginPath(); c.moveTo(figPX(G, 0.08, ls * (ww - 0.012)), figPY(G, 0.08, ls * (ww - 0.012))); c.lineTo(figPX(G, 0.34, ls * (ww - 0.014)), figPY(G, 0.34, ls * (ww - 0.014))); c.lineTo(figPX(G, 0.8, ls * (wc - 0.012)), figPY(G, 0.8, ls * (wc - 0.012)));
      c.quadraticCurveTo(figPX(G, 0.985, ls * (wsh - 0.016)), figPY(G, 0.985, ls * (wsh - 0.016)), figPX(G, 0.985, ls * 0.05), figPY(G, 0.985, ls * 0.05)); figLit(c, G, 0.016, 0.16 + 0.74 * Math.abs(G.lx * G.nx + G.ly * G.ny));
      c.beginPath(); c.moveTo(figPX(G, 0.955, -ls * (wsh - 0.03)), figPY(G, 0.955, -ls * (wsh - 0.03))); c.lineTo(figPX(G, 0.985, -ls * 0.05), figPY(G, 0.985, -ls * 0.05)); figGlint(c, G, 0.014, 0.5 * Math.max(0, G.lx * G.ux + G.ly * G.uy));
    }
  }
  // What shows on the chest sits along its front edge: seen from the side, the arm hangs over the middle.
  const fe = f * (wc - 0.004), fn = f * 0.03, fsh = f * 0.088; // the front edge, the front of the neck, the front of the shoulder
  if (K.dress && !K.coat) {
    // a belt
    c.strokeStyle = figSh(K.dress, 0.34); c.lineWidth = Math.max(0.03, px); c.lineCap = 'butt'; c.beginPath(); c.moveTo(figPX(G, 0.07, -ww), figPY(G, 0.07, -ww)); c.lineTo(figPX(G, 0.07, ww), figPY(G, 0.07, ww)); c.stroke(); c.lineCap = 'round';
  } else if (K.coat) {
    const dark = figSh(K.coat, 0.36);
    if (K.len > 0.2 && fine) { // the split up the back of a long coat, and the weight of its hem
      c.strokeStyle = dark; c.lineWidth = Math.max(0.011, px * 0.8); c.beginPath();
      c.moveTo(figPX(G, 0.04, -f * ww * 0.55), figPY(G, 0.04, -f * ww * 0.55)); c.lineTo(lerp(hx0, hx1, 0.5 - f * 0.3), lerp(hy0, hy1, 0.5 - f * 0.3) - K.sag);
      c.moveTo(lerp(hx0, hx1, 0.03), lerp(hy0, hy1, 0.03) + 0.022); c.lineTo(lerp(hx0, hx1, 0.97), lerp(hy0, hy1, 0.97) + 0.022); c.stroke();
    }
    if (!K.smock) {
      // shirt front showing in the V of the lapels
      const vb = L.tie ? 0.46 : 0.66;
      if (px < 0.065) { c.fillStyle = figC(K.shirt); c.beginPath(); c.moveTo(figPX(G, 0.99, fn), figPY(G, 0.99, fn)); c.lineTo(figPX(G, vb, fe), figPY(G, vb, fe)); c.lineTo(figPX(G, 0.8, fe + f * 0.016), figPY(G, 0.8, fe + f * 0.016)); c.lineTo(figPX(G, 0.96, fsh), figPY(G, 0.96, fsh)); c.closePath(); c.fill(); }
      if (hi) {
        c.strokeStyle = dark; c.lineWidth = Math.max(0.022, px * 0.9); c.beginPath(); c.moveTo(figPX(G, 0.995, fn - f * 0.012), figPY(G, 0.995, fn - f * 0.012)); c.lineTo(figPX(G, vb, fe - f * 0.006), figPY(G, vb, fe - f * 0.006)); c.stroke(); // the lapel
        if (fine) {
          c.lineWidth = Math.max(0.011, px * 0.8); c.beginPath(); c.moveTo(figPX(G, vb, fe - f * 0.014), figPY(G, vb, fe - f * 0.014)); c.lineTo(figPX(G, 0.03, f * (ww - 0.016)), figPY(G, 0.03, f * (ww - 0.016))); // the front edge down to the hem
          if (K.len > 0.2) c.lineTo(lerp(hx0, hx1, 0.5 + f * 0.36), lerp(hy0, hy1, 0.5 + f * 0.36));
          c.stroke();
        }
        if (fine) { c.fillStyle = dark; c.beginPath(); for (let i = 0; i < 2; i++) { const t = vb - 0.1 - i * 0.15, o = f * (lerp(ww, wc, t) - 0.036), bx = figPX(G, t, o), by = figPY(G, t, o); c.moveTo(bx + 0.012, by); c.arc(bx, by, 0.012, 0, TAU); } c.fill(); } // buttons
      }
    } else if (hi) {
      c.strokeStyle = dark; c.lineWidth = Math.max(0.011, px * 0.8); c.beginPath(); c.moveTo(figPX(G, 0.95, fsh * 0.8), figPY(G, 0.95, fsh * 0.8)); c.lineTo(figPX(G, 0.03, f * (ww - 0.02)), figPY(G, 0.03, f * (ww - 0.02))); c.lineTo(lerp(hx0, hx1, 0.5 + f * 0.34), lerp(hy0, hy1, 0.5 + f * 0.34)); c.stroke();
    }
  } else if (hi) {
    // an everyday top: a belt and a neckline, nothing that draws the eye
    c.strokeStyle = figSh(K.body, 0.4); c.lineWidth = Math.max(0.022, px * 0.9); c.lineCap = 'butt';
    c.beginPath(); c.moveTo(figPX(G, 0.0, -ww), figPY(G, 0.0, -ww)); c.lineTo(figPX(G, 0.0, ww), figPY(G, 0.0, ww)); c.stroke(); c.lineCap = 'round';
    if (fine) { c.lineWidth = Math.max(0.011, px * 0.8); c.beginPath(); c.moveTo(figPX(G, 0.995, fn), figPY(G, 0.995, fn)); c.quadraticCurveTo(figPX(G, 0.9, fn + f * 0.02), figPY(G, 0.9, fn + f * 0.02), figPX(G, 0.955, fsh * 0.92), figPY(G, 0.955, fsh * 0.92)); c.stroke(); }
  }
  if (L.vest) {
    const wv = wc + 0.014, vw = ww + 0.014, bulge = 0.014 * f * G.bw;
    c.fillStyle = figC(L.vest); c.beginPath(); c.moveTo(figPX(G, 0.27, -vw), figPY(G, 0.27, -vw)); c.lineTo(figPX(G, 0.8, -wv), figPY(G, 0.8, -wv));
    c.quadraticCurveTo(figPX(G, 1.035, -wsh - 0.008), figPY(G, 1.035, -wsh - 0.008), figPX(G, 1.008, -0.05), figPY(G, 1.008, -0.05)); c.lineTo(figPX(G, 1.008, 0.05), figPY(G, 1.008, 0.05));
    c.quadraticCurveTo(figPX(G, 1.035, wsh + 0.008), figPY(G, 1.035, wsh + 0.008), figPX(G, 0.8, wv + bulge), figPY(G, 0.8, wv + bulge)); c.lineTo(figPX(G, 0.27, vw + bulge * 0.5), figPY(G, 0.27, vw + bulge * 0.5)); c.closePath(); c.fill();
    // the shirt in the neck of it
    c.fillStyle = figC(L.tie ? K.shirt : K.body); c.beginPath(); c.moveTo(figPX(G, 1.0, fn), figPY(G, 1.0, fn)); c.lineTo(figPX(G, 0.7, f * (wv + 0.004)), figPY(G, 0.7, f * (wv + 0.004))); c.lineTo(figPX(G, 0.82, f * (wv + 0.02)), figPY(G, 0.82, f * (wv + 0.02))); c.lineTo(figPX(G, 0.97, fsh + f * 0.012), figPY(G, 0.97, fsh + f * 0.012)); c.closePath(); c.fill();
    if (L.vestStripe) {
      // reflective tape: it stays bright where everything else has gone dim
      const keep = figDimK; figDimK = keep * 0.5; const tape = figC(L.vestStripe); figDimK = keep;
      c.fillStyle = tape; c.beginPath();
      c.moveTo(figPX(G, 0.47, -wv), figPY(G, 0.47, -wv)); c.lineTo(figPX(G, 0.47, wv + bulge), figPY(G, 0.47, wv + bulge)); c.lineTo(figPX(G, 0.56, wv + bulge), figPY(G, 0.56, wv + bulge)); c.lineTo(figPX(G, 0.56, -wv), figPY(G, 0.56, -wv)); c.closePath();
      if (hi) { c.moveTo(figPX(G, 0.31, -vw), figPY(G, 0.31, -vw)); c.lineTo(figPX(G, 0.31, vw + bulge * 0.5), figPY(G, 0.31, vw + bulge * 0.5)); c.lineTo(figPX(G, 0.38, vw + bulge * 0.6), figPY(G, 0.38, vw + bulge * 0.6)); c.lineTo(figPX(G, 0.38, -vw), figPY(G, 0.38, -vw)); c.closePath(); }
      c.fill();
      if (hi) { // braces over the shoulders, one down the back and one down the front
        const ob = wv - 0.028;
        c.strokeStyle = tape; c.lineWidth = Math.max(0.036, px); c.lineCap = 'butt'; c.beginPath();
        c.moveTo(figPX(G, 0.985, ob * 0.8), figPY(G, 0.985, ob * 0.8)); c.lineTo(figPX(G, 0.56, ob), figPY(G, 0.56, ob));
        c.moveTo(figPX(G, 0.985, -ob * 0.8), figPY(G, 0.985, -ob * 0.8)); c.lineTo(figPX(G, 0.56, -ob), figPY(G, 0.56, -ob)); c.stroke(); c.lineCap = 'round';
        if (fine) { c.strokeStyle = figSh(L.vest, 0.3); c.lineWidth = Math.max(0.008, px * 0.7); c.beginPath(); c.moveTo(figPX(G, 0.455, -wv), figPY(G, 0.455, -wv)); c.lineTo(figPX(G, 0.455, wv + bulge), figPY(G, 0.455, wv + bulge)); c.moveTo(figPX(G, 0.575, -wv), figPY(G, 0.575, -wv)); c.lineTo(figPX(G, 0.575, wv + bulge), figPY(G, 0.575, wv + bulge)); c.stroke(); }
      }
    } else if (hi) {
      c.strokeStyle = figSh(L.vest, 0.34); c.lineWidth = Math.max(0.012, px * 0.8); c.beginPath();
      c.moveTo(figPX(G, 0.7, f * (wv - 0.012)), figPY(G, 0.7, f * (wv - 0.012))); c.lineTo(figPX(G, 0.28, f * (vw - 0.012)), figPY(G, 0.28, f * (vw - 0.012)));
      c.moveTo(figPX(G, 0.295, -vw + 0.01), figPY(G, 0.295, -vw + 0.01)); c.lineTo(figPX(G, 0.295, vw - 0.01), figPY(G, 0.295, vw - 0.01));
      c.stroke();
      if (fine) { c.fillStyle = figSh(L.vest, 0.34); c.beginPath(); for (let i = 0; i < 3; i++) { const t = 0.62 - i * 0.12, o = f * (lerp(vw, wv, t) - 0.034), bx = figPX(G, t, o), by = figPY(G, t, o); c.moveTo(bx + 0.01, by); c.arc(bx, by, 0.01, 0, TAU); } c.fill(); }
    }
    if (hi && G.la > 0.03) { c.beginPath(); c.moveTo(figPX(G, 0.3, ls * (vw - 0.012)), figPY(G, 0.3, ls * (vw - 0.012))); c.lineTo(figPX(G, 0.8, ls * (wv - 0.012)), figPY(G, 0.8, ls * (wv - 0.012))); figGlint(c, G, 0.016, 0.6); }
  }
  if (L.tie) {
    // it hangs down the shirt front and swings a little
    const sw = G.lag * 0.5, o0 = f * 0.068, o1 = f * (wc - 0.034), nx = G.nx, ny = G.ny;
    const kx = figPX(G, 0.955, o0), ky = figPY(G, 0.955, o0), mx = figPX(G, 0.52, o1 + sw * 0.7), my = figPY(G, 0.52, o1 + sw * 0.7), tx = figPX(G, 0.4, o1 + f * 0.004 + sw), ty = figPY(G, 0.4, o1 + f * 0.004 + sw);
    c.fillStyle = figC(L.tie); c.beginPath(); c.moveTo(kx - nx * 0.026, ky - ny * 0.026); c.lineTo(mx - nx * 0.04, my - ny * 0.04); c.lineTo(tx, ty); c.lineTo(mx + nx * 0.04, my + ny * 0.04); c.lineTo(kx + nx * 0.026, ky + ny * 0.026); c.closePath(); c.fill();
    if (fine) { c.strokeStyle = figSh(L.tie, 0.35); c.lineWidth = Math.max(0.01, px * 0.7); c.beginPath(); c.moveTo(figPX(G, 0.9, o0 + f * 0.004 - 0.026), figPY(G, 0.9, o0 + f * 0.004 - 0.026)); c.lineTo(figPX(G, 0.9, o0 + f * 0.004 + 0.026), figPY(G, 0.9, o0 + f * 0.004 + 0.026)); c.stroke(); }
  }
  if (K.coat && fine && !L.scarf && L.hat !== 'hood') { // collar, turned up a little at the back of the neck
    c.fillStyle = figSh(K.coat, 0.3); c.beginPath(); figCap(c, figPX(G, 0.985, -0.052), figPY(G, 0.985, -0.052), figPX(G, 0.995, 0.03), figPY(G, 0.995, 0.03), 0.022, 0.018); c.fill();
  }
}
// A scarf: a wrap round the neck, an end hanging in front, and a tail down the back that
// trails behind a walker and streams out in the wind.
function figScarf(c, G) {
  const L = G.L, f = G.f, fl = G.fl, px = G.px, col = figC(L.scarf);
  c.fillStyle = col; c.beginPath(); figCap(c, figPX(G, 0.965, -0.082), figPY(G, 0.965, -0.082), figPX(G, 0.965, 0.082), figPY(G, 0.965, 0.082), 0.052, 0.052);
  // the short end in front
  const ax = figPX(G, 0.95, f * 0.06), ay = figPY(G, 0.95, f * 0.06), bx = figPX(G, 0.66, f * 0.085 + G.lag * 0.4), by = figPY(G, 0.66, f * 0.085 + G.lag * 0.4);
  c.moveTo(ax - G.nx * 0.036, ay - G.ny * 0.036); c.lineTo(bx - G.nx * 0.042, by - G.ny * 0.042); c.lineTo(bx + G.nx * 0.042, by + G.ny * 0.042); c.lineTo(ax + G.nx * 0.036, ay + G.ny * 0.036); c.closePath();
  c.fill();
  // the tail: four links, each pushed by the wind and by the person's own speed, the end fluttering most
  let x = figPX(G, 0.95, -fl * 0.085), y = figPY(G, 0.95, -fl * 0.085);
  const push = G.dead ? 0 : clamp(G.wind * 0.2 + G.lag * 9, -1.7, 1.7), amp = G.dead ? 0 : 0.01 + Math.min(0.03, Math.abs(G.wind) * 0.006) + 0.01 * G.mv;
  let dx = push - fl * 0.35, dy = -1; const dl = Math.hypot(dx, dy); dx /= dl; dy /= dl;
  if (G.dead) { dx = -G.fs * 0.96; dy = -0.28; }
  const seg = 0.094, w0 = 0.04, n = 4;
  c.beginPath(); c.moveTo(x + dy * w0, y - dx * w0);
  const xs = FIG_TMP; let k = 0;
  for (let i = 1; i <= n; i++) {
    const fl2 = Math.sin(G.t * 6.2 - i * 1.15 + G.seed) * amp * i;
    x += dx * seg - dy * fl2; y += dy * seg + dx * fl2; if (y < 0.03) y = 0.03;
    const w = w0 - i * 0.002; c.lineTo(x + dy * w, y - dx * w); xs[k++] = x - dy * w; xs[k++] = y + dx * w;
  }
  for (let i = n - 1; i >= 0; i--) c.lineTo(xs[i * 2], xs[i * 2 + 1]);
  c.lineTo(figPX(G, 0.95, -fl * 0.085) - dy * w0, figPY(G, 0.95, -fl * 0.085) + dx * w0); c.closePath(); c.fill();
  if (G.hi) {
    c.strokeStyle = figSh(L.scarf, 0.3); c.lineWidth = Math.max(0.011, px * 0.8); c.beginPath();
    c.moveTo(figPX(G, 0.94, -0.06), figPY(G, 0.94, -0.06)); c.quadraticCurveTo(figPX(G, 0.9, 0), figPY(G, 0.9, 0), figPX(G, 0.955, 0.075), figPY(G, 0.955, 0.075)); // a fold in the wrap
    if (G.fine) { for (let i = -1; i <= 1; i++) { c.moveTo(bx + G.nx * i * 0.026, by + G.ny * i * 0.026); c.lineTo(bx + G.nx * i * 0.03 - G.ux * 0.03, by + G.ny * i * 0.03 - G.uy * 0.03); } c.moveTo(x, y); c.lineTo(x + dx * 0.035, Math.max(0.01, y + dy * 0.035)); } // fringe
    c.stroke();
    c.beginPath(); c.moveTo(figPX(G, 0.99, -0.07), figPY(G, 0.99, -0.07)); c.lineTo(figPX(G, 0.99, 0.07), figPY(G, 0.99, 0.07)); figGlint(c, G, 0.016, 0.6);
  }
}
const FIG_TMP = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

// ---- ground: shadow and blood ----------------------------------------------
// A soft shadow where the person meets the ground. By day it sits under the feet. At night it
// is thrown away from the lamp, longer the further off the lamp is, and it fades with the light.
function figShadow(c, G) {
  const A = G.A, env = G.env;
  if (A.behind || A.inVeh || G.seated) return;
  let x0 = Math.min(G.ftL[0], G.ftR[0]), x1 = Math.max(G.ftL[0], G.ftR[0]), a, core = 1;
  if (G.dead) { x0 = Math.min(x0, G.head[0], G.hip[0]); x1 = Math.max(x1, G.head[0], G.hip[0]); }
  else if (Math.min(G.ftL[1], G.ftR[1]) > 0.12) core = 0.5; // both feet off the ground
  x0 -= 0.15; x1 += 0.15;
  const mid = (x0 + x1) / 2, half = (x1 - x0) / 2;
  if (env.night) {
    a = 0.5 * G.light; if (a < 0.02) return;
    const dx = env.lampDx || 0, h = Math.max(2.4, env.lampH || 5), throwX = clamp((-dx * 1.75) / (h - 1.3), -1.25, 1.25);
    if (throwX > 0) x1 += throwX; else x0 += throwX;
  } else a = 0.36 * (1 - 0.5 * ((env.pal && env.pal.dark) || 0)) * (env.weather === 'clear' || !env.weather ? 1 : 0.7);
  const ry = clamp(0.034 + (x1 - x0) * 0.014, G.px * 1.3, 0.075);
  c.fillStyle = '#020409';
  if (!G.fine) { c.globalAlpha = a * (0.4 + 0.5 * core); c.beginPath(); c.ellipse((x0 + x1) / 2, 0, (x1 - x0) / 2, ry, 0, 0, Math.PI); c.fill(); c.globalAlpha = 1; return; }
  c.globalAlpha = a * 0.55; c.beginPath(); c.ellipse((x0 + x1) / 2, 0, (x1 - x0) / 2, ry, 0, 0, Math.PI); c.fill();
  c.globalAlpha = a * core; c.beginPath(); c.ellipse(mid, 0, half * 0.82, ry * 0.62, 0, 0, Math.PI); c.fill();
  c.globalAlpha = 1;
}
// ---- blood -------------------------------------------------------------------
// Drawn only with gore on, and only for people who were shot. How much follows the round (see
// src/13_ragdoll.js): a .22 leaves a small hole and little blood; a round that comes out of the
// far side leaves far more, sprays a wall close behind, and spatters the ground.
const FIG_BLOOD = '#5c0f13', FIG_BLOOD2 = '#3b080b', FIG_BLOODL = '#7a141b';
function figBloody(A, env) { return env.gore !== false && (A.deathHow === 'shot' || A.deathHow === 'npc') && !!A.rd && !!A.rd.wound; }
// Where the wound is now, in the drawing's space: it rides on the body as it falls.
const FIG_WP = [0, 0];
function figWoundPos(G, R) {
  const w = R.wound, sc = G.sc;
  if (R.part === 'head') {
    let ux = G.head[0] - G.neck[0], uy = G.head[1] - G.neck[1]; const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
    FIG_WP[0] = G.head[0] + (ux * w.u + uy * w.n) / sc; FIG_WP[1] = G.head[1] + (uy * w.u - ux * w.n) / sc;
  } else { FIG_WP[0] = figPX(G, w.t, w.o / sc); FIG_WP[1] = figPY(G, w.t, w.o / sc); }
  return FIG_WP;
}
// The floor under a point of the body, in the drawing's space.
function figFloorAt(G, R, x) { const E = R.env; return E && E.gfn ? E.gfn(x * G.sc) / G.sc : 0; }
// Blood thrown out of the exit wound onto a wall close behind (drawn before the body, so behind it).
// The wall may be a little further back than the person; the spot is put where the eye sees it.
function figWallBlood(c, G, R) {
  const W = R.env && R.env.wall, T = G.dT - 0.03; if (!W || !R.exit || T <= 0 || !G.hi) return;
  const A = G.A, sc = G.sc, dz = W.dz, vz = R.v ? Math.max(1, R.v[2]) : 800;
  let wx = R.hx + (R.v ? (R.v[0] / vz) * dz : 0), wy = R.hy + (R.v ? (R.v[1] / vz) * dz : 0) - 0.05 * dz, k = 1;
  if (R.eye) { const ex = R.eye[0] - A.x, ey = R.eye[1] - A.y; k = R.D / (R.D + dz); wx = ex + (wx - ex) * k; wy = ey + (wy - ey) * k; }
  const x = wx / sc, y = Math.max(0.15, wy / sc), r = ((0.09 + 0.26 * R.exitK) * Math.min(1.3, 0.75 + dz * 0.2) * k) / sc, g = smooth(T / 0.1);
  const rng = makeRng(R.seed + 5);
  c.fillStyle = figC(FIG_BLOOD); c.globalAlpha = 0.86;
  c.beginPath(); c.ellipse(x, y, r * 0.5 * g, r * 0.4 * g, rng.f(), 0, TAU);
  // drops flung out round it, smaller the further they flew
  const n = 9 + Math.round(10 * R.exitK);
  for (let i = 0; i < n; i++) {
    const an = rng.f() * TAU, d = r * (0.45 + rng.f() * 1.25) * g, dr = Math.max(G.px * 0.7, r * (0.13 - 0.05 * (d / r)) * (0.5 + rng.f())), cx = x + Math.cos(an) * d, cy = y + Math.sin(an) * d * 0.85;
    c.moveTo(cx + dr * 1.7, cy); c.ellipse(cx, cy, dr * 1.7, dr, an, 0, TAU);
  }
  c.fill();
  // and it runs down the wall, slowly
  if (T > 0.4) {
    const run = 0.04 + 0.26 * smooth((T - 0.4) / 9);
    c.strokeStyle = figC(FIG_BLOOD); c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const ox = x + (rng.f() - 0.5) * r * 0.8, len = Math.min(y - 0.05, (run * (0.5 + rng.f() * 0.8)) / sc), lw = Math.max(G.px * 0.8, r * (0.07 + 0.05 * rng.f()));
      c.lineWidth = lw; c.beginPath(); c.moveTo(ox, y - r * 0.15); c.lineTo(ox + (rng.f() - 0.5) * 0.01, y - r * 0.15 - len); c.stroke();
      c.beginPath(); c.arc(ox, y - r * 0.15 - len, lw * 0.75, 0, TAU); c.fill();
    }
  }
  c.globalAlpha = 1;
}
// The spray in the air at the moment of the hit: a red mist out of the far side, thinning as
// it drifts and sinks. Behind the body.
function figMist(c, G, R) {
  const T = G.dT, life = R.exit ? 0.5 : 0.3; if (T > life || !G.hi) return;
  const A = G.A, sc = G.sc, big = R.exit ? 0.55 + 0.9 * R.exitK : 0.22, u = T / life, x0 = R.hx / sc, y0 = R.hy / sc;
  // a haze that blooms out of the wound and is gone in half a second
  const rr = (0.06 + 0.32 * big * easeOut(u * 1.3)) / sc, a = 0.6 * Math.pow(1 - u, 1.4) * Math.min(1, T / 0.03), cy = y0 - 0.12 * u * u;
  if (a > 0.02) {
    const g = c.createRadialGradient(x0, cy, 0, x0, cy, rr), col = figC('#7c0c14');
    g.addColorStop(0, rgba(col, a)); g.addColorStop(0.45, rgba(col, a * 0.45)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.beginPath(); c.arc(x0, cy, rr, 0, TAU); c.fill();
  }
  // and drops flung out of it, falling as they fly (each lands among the spots on the ground)
  const rng = makeRng(R.seed + 9), n = R.exit ? 8 + Math.round(10 * R.exitK) : 4;
  c.fillStyle = figC('#6a0f15'); c.beginPath();
  for (let i = 0; i < n; i++) {
    const an = rng.f() * TAU, sp = (0.8 + 2.2 * rng.f()) * (R.exit ? 0.6 + 0.6 * R.exitK : 0.5), r = Math.max(G.px * 0.8, (0.006 + 0.012 * rng.f()) / sc);
    const x = x0 + (Math.cos(an) * sp * T) / sc, y = y0 + (Math.sin(an) * sp * T * 0.7 - 4.9 * T * T) / sc;
    if (y < figFloorAt(G, R, x)) continue;
    c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU);
  }
  c.fill();
}
// Drops that came down on the ground round the body, and the pool that creeps out from under
// the wound once the body is down. Both lie ON the ground line and never go below it.
function figGroundBlood(c, G, R) {
  const A = G.A, s = R.s, sc = G.sc; if (A.inVeh || (R.env && R.env.seat)) return;
  const rng = makeRng(R.seed + 3), n = R.exit ? 4 + Math.round(7 * R.exitK) : 2, hx = R.hx / sc, fall = Math.sqrt(Math.max(0.1, R.hy) / 4.9);
  c.fillStyle = figC(FIG_BLOOD);
  if (G.hi) {
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const tl = fall * (0.8 + 0.5 * rng.f()), x = hx + (rng.f() - 0.5) * (R.exit ? 1.1 : 0.4), r = (0.012 + 0.03 * rng.f() * (R.exit ? 1 : 0.6)) * (1 + R.exitK * 0.6);
      if (G.dT < tl) continue;
      const y = figFloorAt(G, R, x); c.moveTo(x + r, y); c.ellipse(x, y, r, Math.min(0.012, r * 0.3), 0, 0, Math.PI);
    }
    c.fill();
  }
  if (!s || s.landT === null) return;
  const T = G.dT - s.landT - 0.35; if (T <= 0) return;
  const p = figWoundPos(G, R), x = p[0], y = figFloorAt(G, R, x);
  const full = (R.part === 'head' ? 0.32 : 0.26) + 0.3 * R.exitK + 0.08 * R.power;
  const r = 0.08 + full * (1 - Math.exp(-T / 4.5)), h = Math.min(0.04, 0.014 + r * 0.05);
  c.globalAlpha = 0.92 * smooth(T / 0.7); c.beginPath(); c.ellipse(x, y, r, h, 0, 0, Math.PI); c.fill();
  if (G.hi) {
    c.fillStyle = figC(FIG_BLOOD2); c.beginPath(); c.ellipse(x + r * 0.08, y, r * 0.58, h * 0.6, 0, 0, Math.PI); c.fill();
    if (G.la > 0.05 && G.fine) { c.globalAlpha = G.la * 0.45; c.strokeStyle = G.lc; c.lineWidth = Math.max(0.008, G.px * 0.7); c.beginPath(); c.ellipse(x + (G.lx >= 0 ? 1 : -1) * r * 0.25, y, r * 0.5, h * 0.82, 0, Math.PI * 0.3, Math.PI * 0.7); c.stroke(); }
  }
  c.globalAlpha = 1;
}
// The wound on the body: blood soaking out round it (more for a round that went through), and
// close up the hole itself; on the head, blood running down from it.
function figWound(c, G, R) {
  const p = figWoundPos(G, R), x = p[0], y = p[1], head = R.part === 'head', k = 0.55 + 0.45 * smooth(G.dT / 2.2);
  const r = (head ? 0.034 : 0.04) + 0.035 * R.exitK + 0.012 * R.power;
  c.fillStyle = figC('#6a1216'); c.beginPath(); c.arc(x, y, r * k, 0, TAU); c.moveTo(x + r * 0.5 + r * 0.6 * k, y - r * 0.5 * k); c.arc(x + r * 0.5, y - r * 0.5 * k, r * 0.6 * k, 0, TAU);
  if (G.hi) { c.moveTo(x - r * 0.2 + r * 0.32, y - r * 1.1 * k); c.arc(x - r * 0.2, y - r * 1.1 * k, r * 0.32, 0, TAU); }
  c.fill();
  if (!G.hi) return;
  c.fillStyle = figC('#170305'); c.beginPath(); c.arc(x, y, Math.max(G.px * 0.9, 0.007 + 0.008 * R.power), 0, TAU); c.fill();
  if (head) { // runs down (the way down in the world, whichever way the head now lies)
    const len = 0.025 + 0.085 * smooth((G.dT - 0.15) / 2.5);
    c.strokeStyle = figC(FIG_BLOODL); c.lineCap = 'round'; c.lineWidth = Math.max(G.px * 0.8, 0.016); c.beginPath(); c.moveTo(x, y); c.lineTo(x + 0.006, y - len); c.stroke();
  }
}

// ---- the figure ------------------------------------------------------------
function figMoving(a) { return a === 'walk' ? 1 : (a === 'run' || a === 'panic') ? 2 : 0; }
const FIG_HAND_BAGS = { case: 1, duffel: 1, shopping: 1, cup: 1, flowers: 1, cane: 1, umbrella: 1, balloon: 1 };
const FIG_GRIP_ANIM = { phone: 1, sitphone: 1, smoke: 1, aim: 1, guard: 1, aimrifle: 1, sweep: 1, look: 1 };

// The pale outline that lets a dark figure read against a dark wall. It runs round the whole
// person, hat, bag and all, in two strokes: one fat stroke along the limbs, and one round the
// outline of everything else.
function figRim(c, G, K) {
  const bw = G.bw, rw = G.rw, bag = G.L.bag;
  c.strokeStyle = G.rim;
  c.lineWidth = Math.max((K.sleeve ? 0.094 : 0.078) * bw + 2 * rw, G.px * 2.7);
  c.beginPath(); figSeg(c, G.sh, G.elL); figSeg(c, G.elL, G.haL); figSeg(c, G.sh, G.elR); figSeg(c, G.elR, G.haR);
  c.moveTo(G.hip[0], G.hip[1]); c.lineTo(G.knL[0], G.knL[1]); c.lineTo(lerp(G.knL[0], G.ftL[0], FIG_ANKLE), lerp(G.knL[1], G.ftL[1], FIG_ANKLE));
  c.moveTo(G.hip[0], G.hip[1]); c.lineTo(G.knR[0], G.knR[1]); c.lineTo(lerp(G.knR[0], G.ftR[0], FIG_ANKLE), lerp(G.knR[1], G.ftR[1], FIG_ANKLE));
  if (!G.hi) {
    // medium size, where a crowd of people may be on screen: the spine goes in the same stroke, and the
    // head and hat get a slightly enlarged pale fill behind them instead of a traced outline
    figSeg(c, G.hip, G.neck); c.stroke();
    c.fillStyle = G.rim; c.beginPath(); c.save(); c.translate(G.hdx, G.hdy); if (G.htilt) c.rotate(G.htilt);
    const k = 1 + rw / FIG.headR; c.scale(k, k); c.moveTo(FIG.headR, 0); c.arc(0, 0, FIG.headR, 0, TAU); if (G.L.hat) figHatPath(c, G, G.L.hat);
    c.restore(); c.fill();
    return;
  }
  c.stroke();
  // Stroking a long curved outline is one of the dearest things a canvas does, so below "fine"
  // size the outline keeps only the parts that stick out: the body, the head, the hat, the bag.
  c.beginPath();
  if (G.fine) {
    figShoePath(c, G, G.knL, G.ftL); figShoePath(c, G, G.knR, G.ftR);
    if (K.dress) figSkirtPath(c, G, G.ww + 0.01, 0.41, (0.17 + 0.03 * (1 - G.fa)) * bw, 0.022, 0.9, 0.92);
    if (K.len) figSkirtPath(c, G, G.ww, K.len, K.flare, K.sag, K.swing, K.follow);
  }
  figTorsoPath(c, G, G.ww, G.wc, G.wsh, K.t0);
  figHead(c, G, 0);
  if (bag) {
    if (bag === 'backpack' || bag === 'guitar') figBack(c, G, 0);
    else if (bag === 'box' || bag === 'paper') figBoth(c, G, 0);
    else if (bag === 'clip') figClip(c, G, 0);
    else figCarry(c, G, 0);
  }
  c.lineWidth = 2 * rw; c.stroke();
}

// Draw an actor. ctx is already in the plane's metre space with y up.
// env is described in docs/ART.md and built by figEnv in src/06_view.js. The fields used here:
//   px (metres per screen pixel), ink, rim, dim, dark, night, nv, light, lampDx, lampH, lampCol,
//   t, wind, windDrift, smoke, pal, gore, weather. Every one of them has a sensible default.
function drawFigure(ctx, A, env) {
  // Nothing to do for somebody who is off the top or bottom of the picture (people in tall
  // buildings often are). The margins leave room for an umbrella above and a body lying beside.
  if (ctx.getTransform && ctx.canvas && !(A.dead && A.look && A.look.bag === 'balloon')) {
    const m = ctx.getTransform(), W = ctx.canvas.width, H = ctx.canvas.height, top = 3.4 * ((A.look && A.look.h) || 1);
    const ya = m.f + m.d * (A.y - 0.3) + m.b * A.x, yb = m.f + m.d * (A.y + top) + m.b * A.x;
    const xa = m.e + m.a * (A.x - 2.3) + m.c * A.y, xb = m.e + m.a * (A.x + 2.3) + m.c * A.y;
    if ((ya > H && yb > H) || (ya < 0 && yb < 0) || (xa > W && xb > W) || (xa < 0 && xb < 0)) return;
  }
  if (A.dead) rdLead = env.lead || 0; // a fall drawn in slow motion moves every frame, not only on the world's steps
  const J = actorJoints(A), L = A.look || {}, sc = J.scale || 1, hpx = (1.8 * sc) / env.px;
  rdLead = 0;
  if (hpx < FIG_FAR) { figDrawFar(ctx, A, env, J, L); return; }
  const G = FGS, c = ctx, inv = 1 / sc;
  for (let i = 0; i < FIG_JN.length; i++) { const k = FIG_JN[i], s = J[k], d = G[k]; d[0] = s[0] * inv; d[1] = s[1] * inv; }
  const st = figState(A, env, J.f), px = env.px * inv, hi = hpx >= FIG_MID, f = J.f, dead = !!A.dead;
  G.ctx = c; G.A = A; G.L = L; G.env = env; G.st = st; G.px = px; G.hi = hi; G.fine = hpx >= FIG_FINE;
  G.sc = sc; G.f = f; G.fs = f < 0 ? -1 : 1; G.fa = Math.abs(f); G.fl = dead ? f : st.fl; G.wl = (1 + f) / 2;
  G.dead = dead; G.dT = A.deadT || 0; G.t = A.t || 0; G.seed = A.seed || 0; G.wind = env.wind || 0;
  G.bw = L.build === 'big' ? 1.3 : L.build === 'thin' ? 0.86 : 1;
  const an = dead ? figAimAs(A, A.deathPose) : figAnimNow(A);
  G.seated = an === 'sit' || an === 'type' || an === 'sitphone' || an === 'sitdrink' || an === 'drive' || an === 'sleep';
  const mv = dead ? 0 : figMv(A);
  G.mv = dead ? 0 : mv; G.lag = dead ? 0 : clamp((st.s - st.vs * 0.03) * inv, -0.2, 0.2);
  // the light: how dim, and where the bright edge goes
  figDimK = env.dim || 0;
  const light = env.light === undefined ? 1 : env.light;
  G.light = light; G.ink = env.ink || '#13161b'; G.rim = env.rim || null; G.rw = Math.max(px * 0.8, Math.min(0.0225, px * 2.3)) * (env.nv ? 1.3 : 1);
  if (env.night) {
    const dx = env.lampDx || 0, dy = Math.max(0.8, (env.lampH || 5) - 1.3), l = Math.hypot(dx, dy);
    G.lx = dx / l; G.ly = dy / l; G.la = 0.5 * light * (env.nv ? 0.5 : 1); G.lc = env.lampCol || '#ffd27a';
  } else { G.lx = 0.42; G.ly = 0.908; G.la = G.fine ? 0.17 * (1 - ((env.pal && env.pal.dark) || 0)) * (env.nv ? 0.5 : 1) : 0; G.lc = '#ffffff'; } // by day the sky's soft sheen is only worth drawing close up
  G.ear = figHex(G.ink) ? mix(G.ink, '#8d939c', 0.3) : G.ink;
  // the body's own directions: u runs up the spine, n across it
  { let ux = G.neck[0] - G.hip[0], uy = G.neck[1] - G.hip[1]; const T = Math.hypot(ux, uy) || 0.56; ux /= T; uy /= T; G.ux = ux; G.uy = uy; G.nx = uy; G.ny = -ux; G.T = T; }
  // the head rides on the neck: it tips with the spine, lags a touch when the body starts or stops, and is never dead still
  {
    const hx = G.head[0] - G.neck[0], hy = G.head[1] - G.neck[1];
    let tilt = Math.atan2(-hx, hy);
    if (!dead) tilt += clamp(-G.lag * 0.7, -0.09, 0.09) + 0.014 * Math.sin(G.t * 0.83 + G.seed * 2) + (mv ? 0.02 * mv * Math.sin(A.ph * 2 + 0.9) : 0);
    G.htilt = tilt; G.hdx = G.head[0] + (dead ? 0 : G.lag * 0.06); G.hdy = G.head[1];
    const cs = Math.cos(tilt), sn = Math.sin(tilt); G.hlx = G.lx * cs + G.ly * sn; G.hly = -G.lx * sn + G.ly * cs;
  }
  // where carried things are: in the hands, or, once dead, dropping from where the hands were
  G.cR = G.haR; G.cL = G.haL;
  if (dead) {
    if (!st.drop) { const j = figJoints(figPose(A.deathPose || 'stand', A.deathAt || 0, A.deathPh || 0, A)), fd = A.face || 1; st.drop = [j.haR[0] * fd, j.haR[1], j.haL[0] * fd, j.haL[1]]; }
    const fall = 4.9 * G.dT * G.dT, slide = (A.deathDir || 0) * 0.12 * Math.min(1, G.dT * 2);
    G.dR[0] = st.drop[0] + slide; G.dR[1] = Math.max(0, st.drop[1] - fall); G.dL[0] = st.drop[2] + slide; G.dL[1] = Math.max(0, st.drop[3] - fall);
    G.cR = G.dR; G.cL = G.dL;
  }
  const K = figWear(G), bag = L.bag, anim = G.anim = an;
  const gunHeld = (anim === 'guard' || anim === 'aimrifle') && !dead, hasRifle = L.gun === 'rifle' || anim === 'guard' || anim === 'aimrifle';
  const nearGrip = !dead && (FIG_HAND_BAGS[bag] === 1 || FIG_GRIP_ANIM[anim] === 1), farGrip = !dead && (bag === 'clip' || gunHeld || anim === 'sweep' || anim === 'look');

  c.save(); c.translate(A.x, A.y); if (sc !== 1) c.scale(sc, sc);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const gore = dead && figBloody(A, env);
  if (gore) { figWallBlood(c, G, A.rd); figMist(c, G, A.rd); }
  if ((light > 0.02 || !env.night) && hpx > 26) figShadow(c, G);
  if (gore) figGroundBlood(c, G, A.rd);
  if (G.rim) figRim(c, G, K);

  // far side first: the arm and leg that are further from us, a shade darker
  if (bag === 'backpack' || bag === 'guitar') figBack(c, G, 1);
  if (hasRifle && !gunHeld) figRifle(c, G);
  if (bag === 'umbrella') figCarry(c, G, 1); // held on the far side: only its handle shows in front
  figLimbsBack(c, G, K, farGrip);
  figClothes(c, G, K);
  if (bag === 'backpack' || bag === 'guitar') figStraps(c, G);
  if (gore && A.rd.part !== 'head') figWound(c, G, A.rd);
  G.nearHand = !!K.sleeve;
  figHead(c, G, 1);
  if (L.scarf) figScarf(c, G);
  if (gore && A.rd.part === 'head') figWound(c, G, A.rd);

  // near side: whatever is held, then the arm that holds it
  if (hasRifle && gunHeld) figRifle(c, G);
  if (FIG_HAND_BAGS[bag] === 1) figCarry(c, G, bag === 'umbrella' ? 2 : 1);
  figArmNear(c, G, K, nearGrip);
  if (bag === 'box' || bag === 'paper') {
    figBoth(c, G, 1);
    if (hi && !dead) { const mx = (G.haL[0] + G.haR[0]) / 2, my = Math.max((G.haL[1] + G.haR[1]) / 2, 0.1), w = bag === 'box' ? 0.25 : 0.212, y = bag === 'box' ? my - 0.07 : my + 0.03; c.fillStyle = G.ink; c.beginPath(); c.arc(mx - w, y, 0.03, 0, TAU); c.moveTo(mx + w + 0.03, y); c.arc(mx + w, y, 0.03, 0, TAU); c.fill(); }
  } else if (bag === 'clip') figClip(c, G, 1);
  if (!dead) figProps(c, G);
  c.restore();
}

// ---- far away --------------------------------------------------------------
// Under 14 pixels tall there is no room for detail: a stick, its colours, and the one or two
// things a mission might have told the player to look for.
function figDrawFar(ctx, A, env, J, L) {
  const sc = J.scale, f = J.f, dead = !!A.dead;
  const lw = FIG.lw * sc * (L.build === 'big' ? 1.3 : L.build === 'thin' ? 0.85 : 1), minw = env.px * 1.1;
  const ink = env.ink || '#13161b', rim = env.rim;
  figDimK = env.dim || 0;
  const D = figC;
  ctx.save(); ctx.translate(A.x, A.y);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const hx = J.head[0], hy = J.head[1], hr = FIG.headR * sc;
  if (rim) {
    ctx.strokeStyle = rim; ctx.lineWidth = Math.max(lw + 0.045, minw + env.px * 1.6);
    ctx.beginPath(); figSeg(ctx, J.sh, J.elL); figSeg(ctx, J.elL, J.haL); figSeg(ctx, J.hip, J.knL); figSeg(ctx, J.knL, J.ftL); figSeg(ctx, J.hip, J.neck); figSeg(ctx, J.hip, J.knR); figSeg(ctx, J.knR, J.ftR); figSeg(ctx, J.sh, J.elR); figSeg(ctx, J.elR, J.haR);
    ctx.stroke();
    ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(hx, hy, hr + Math.max(0.022, env.px * 0.8), 0, TAU); ctx.fill();
  }
  if (L.bag === 'backpack') { ctx.fillStyle = D(L.bagCol || '#5d6b4a'); const bx = lerp(J.hip[0], J.neck[0], 0.6) - f * 0.17 * sc, by = lerp(J.hip[1], J.neck[1], 0.6); ctx.beginPath(); ctx.ellipse(bx, by, 0.12 * sc, 0.22 * sc, 0, 0, TAU); ctx.fill(); }
  else if (L.bag === 'guitar') { ctx.strokeStyle = D(L.bagCol || '#1d2026'); ctx.lineWidth = Math.max(0.2 * sc, minw); const bx = lerp(J.hip[0], J.neck[0], 0.5) - f * 0.17 * sc, by = lerp(J.hip[1], J.neck[1], 0.5); ctx.beginPath(); ctx.moveTo(bx - f * 0.08 * sc, by - 0.4 * sc); ctx.lineTo(bx + f * 0.18 * sc, by + 0.75 * sc); ctx.stroke(); }
  ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = Math.max(lw, minw);
  ctx.beginPath(); figSeg(ctx, J.sh, J.elL); figSeg(ctx, J.elL, J.haL); figSeg(ctx, J.hip, J.knL); figSeg(ctx, J.knL, J.ftL); figSeg(ctx, J.hip, J.neck); figSeg(ctx, J.hip, J.knR); figSeg(ctx, J.knR, J.ftR); figSeg(ctx, J.sh, J.elR); figSeg(ctx, J.elR, J.haR); ctx.stroke();
  const tx = (t) => lerp(J.hip[0], J.neck[0], t), ty = (t) => lerp(J.hip[1], J.neck[1], t);
  if (L.dress) {
    ctx.fillStyle = D(L.dress); ctx.beginPath(); ctx.moveTo(J.neck[0] - 0.1 * sc, J.neck[1] - 0.06 * sc); ctx.lineTo(J.neck[0] + 0.1 * sc, J.neck[1] - 0.06 * sc);
    ctx.lineTo(J.hip[0] + 0.24 * sc, J.hip[1] - 0.4 * sc); ctx.lineTo(J.hip[0] - 0.24 * sc, J.hip[1] - 0.4 * sc); ctx.closePath(); ctx.fill();
  }
  const coat = L.coat || L.smock;
  if (coat) {
    const low = L.long && L.coat ? -0.6 : L.smock && !L.coat ? -0.35 : -0.12;
    ctx.strokeStyle = D(coat); ctx.lineWidth = Math.max(lw * 2.5, minw * 2); ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(tx(0.96), ty(0.96)); ctx.lineTo(tx(low), ty(low)); ctx.stroke(); ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(lw * 1.35, minw * 1.3);
    ctx.beginPath(); figSeg(ctx, J.sh, J.elR); figSeg(ctx, J.elR, [lerp(J.elR[0], J.haR[0], 0.75), lerp(J.elR[1], J.haR[1], 0.75)]); figSeg(ctx, J.sh, J.elL); figSeg(ctx, J.elL, [lerp(J.elL[0], J.haL[0], 0.75), lerp(J.elL[1], J.haL[1], 0.75)]); ctx.stroke();
  }
  if (L.vest) {
    ctx.strokeStyle = D(L.vest); ctx.lineWidth = Math.max(lw * 2.5, minw * 2); ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(tx(0.96), ty(0.96)); ctx.lineTo(tx(0.27), ty(0.27)); ctx.stroke();
    if (L.vestStripe) { ctx.strokeStyle = D(L.vestStripe); ctx.beginPath(); ctx.moveTo(tx(0.47), ty(0.47)); ctx.lineTo(tx(0.57), ty(0.57)); ctx.stroke(); }
    ctx.lineCap = 'round';
  }
  if (L.scarf) { ctx.strokeStyle = D(L.scarf); ctx.lineWidth = Math.max(lw * 1.5, minw * 1.3); ctx.beginPath(); ctx.moveTo(J.neck[0] - 0.08 * sc, J.neck[1] - 0.01 * sc); ctx.lineTo(J.neck[0] + 0.08 * sc, J.neck[1] - 0.01 * sc); ctx.moveTo(J.neck[0] - f * 0.07 * sc, J.neck[1]); ctx.lineTo(J.neck[0] - f * 0.16 * sc, J.neck[1] - 0.34 * sc); ctx.stroke(); }
  // head, hair, hat
  ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU); ctx.fill();
  const hair = L.hair, hat = L.hat;
  if (hair && hat !== 'hood' && hat !== 'helmet') {
    ctx.fillStyle = D(hair === 'white' ? '#e8e8e2' : (L.hairCol || (hair === 'long' ? '#6b4a2b' : hair === 'bun' ? '#3a2a20' : hair === 'mohawk' ? '#e0413a' : '#7a5a3a')));
    ctx.beginPath();
    if (hair === 'mohawk') ctx.ellipse(hx, hy + hr * 0.95, hr * 0.85, hr * 0.42, 0, 0, TAU);
    else { ctx.arc(hx, hy + 0.015 * sc, hr * 1.06, 0.2, Math.PI - 0.2); ctx.closePath(); if (hair === 'long') { ctx.rect(hx - f * hr * 1.05 - hr * 0.35, hy - 0.32 * sc, hr * 0.7, 0.36 * sc); } else if (hair === 'bun') { ctx.moveTo(hx - f * 0.13 * sc + 0.08 * sc, hy + 0.14 * sc); ctx.arc(hx - f * 0.13 * sc, hy + 0.14 * sc, 0.08 * sc, 0, TAU); } }
    ctx.fill();
  }
  if (L.phones) { ctx.fillStyle = D(L.phones); ctx.beginPath(); ctx.arc(hx - f * 0.02 * sc, hy, 0.075 * sc, 0, TAU); ctx.fill(); }
  if (hat) {
    const hc = L.hatCol || '#2a2d33', top = hy + hr * 0.62;
    ctx.fillStyle = D(hc); ctx.strokeStyle = D(hc); ctx.lineWidth = Math.max(0.045 * sc, minw); ctx.beginPath();
    if (hat === 'fedora') { ctx.moveTo(hx - 0.3 * sc, top); ctx.lineTo(hx + 0.3 * sc, top); ctx.stroke(); ctx.fillRect(hx - 0.165 * sc, top, 0.33 * sc, 0.2 * sc); if (L.hatBand) { ctx.fillStyle = D(L.hatBand); ctx.fillRect(hx - 0.168 * sc, top + 0.012 * sc, 0.336 * sc, 0.056 * sc); } }
    else if (hat === 'tophat') { ctx.moveTo(hx - 0.26 * sc, top); ctx.lineTo(hx + 0.26 * sc, top); ctx.stroke(); ctx.fillRect(hx - 0.155 * sc, top, 0.31 * sc, 0.31 * sc); if (L.hatBand) { ctx.fillStyle = D(L.hatBand); ctx.fillRect(hx - 0.155 * sc, top + 0.018 * sc, 0.31 * sc, 0.058 * sc); } }
    else if (hat === 'sun') { ctx.moveTo(hx - 0.39 * sc, top - 0.03 * sc); ctx.lineTo(hx + 0.39 * sc, top - 0.03 * sc); ctx.stroke(); ctx.beginPath(); ctx.arc(hx, top - 0.02 * sc, hr * 0.95, 0, Math.PI); ctx.closePath(); ctx.fill(); if (L.hatBand) { ctx.fillStyle = D(L.hatBand); ctx.fillRect(hx - 0.158 * sc, top, 0.316 * sc, 0.05 * sc); } }
    else if (hat === 'cap') { ctx.arc(hx, top - 0.03 * sc, hr * 1.06, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(hx, top - 0.03 * sc); ctx.lineTo(hx + f * 0.32 * sc, top - 0.05 * sc); ctx.stroke(); }
    else if (hat === 'beanie') { ctx.arc(hx, hy + 0.03 * sc, hr * 1.1, 0.05, Math.PI - 0.05); ctx.closePath(); ctx.moveTo(hx + 0.05 * sc, hy + hr * 1.26); ctx.arc(hx, hy + hr * 1.26, 0.05 * sc, 0, TAU); ctx.fill(); }
    else if (hat === 'hardhat') { ctx.arc(hx, top - 0.05 * sc, hr * 1.12, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(hx - 0.22 * sc + Math.min(0, f) * 0.07 * sc, top - 0.05 * sc); ctx.lineTo(hx + 0.22 * sc + Math.max(0, f) * 0.07 * sc, top - 0.05 * sc); ctx.stroke(); }
    else if (hat === 'beret') { ctx.ellipse(hx - f * 0.04 * sc, top + 0.022 * sc, 0.215 * sc, 0.082 * sc, -f * 0.2, 0, TAU); ctx.fill(); }
    else if (hat === 'hood') { ctx.arc(hx - f * 0.03 * sc, hy, hr * 1.22, 0, TAU); ctx.fill(); ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(hx + f * hr * 0.62, hy, hr * 0.5, hr * 0.8, 0, 0, TAU); ctx.fill(); }
    else if (hat === 'peaked') { ctx.fillRect(hx - 0.172 * sc, top - 0.02 * sc, 0.344 * sc, 0.1 * sc); ctx.ellipse(hx, top + 0.1 * sc, 0.21 * sc, 0.055 * sc, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(hx, top - 0.02 * sc); ctx.lineTo(hx + f * 0.28 * sc, top - 0.05 * sc); ctx.stroke(); }
    else if (hat === 'helmet') { ctx.arc(hx, hy + 0.02 * sc, hr * 1.17, -0.3, Math.PI + 0.3); ctx.closePath(); ctx.fill(); }
  }
  // carried
  const hand = J.haR, bag = L.bag;
  if (bag === 'case') { ctx.fillStyle = D(L.bagCol || '#7b5a36'); ctx.fillRect(hand[0] - 0.215 * sc, Math.max(0, hand[1] - 0.335 * sc), 0.43 * sc, 0.285 * sc); }
  else if (bag === 'duffel') { ctx.fillStyle = D(L.bagCol || '#3f4a5c'); ctx.beginPath(); figRR(ctx, hand[0] - 0.34 * sc, Math.max(0, hand[1] - 0.445 * sc), 0.68 * sc, 0.28 * sc, 0.1 * sc); ctx.fill(); }
  else if (bag === 'shopping') { ctx.fillStyle = D(L.bagCol || '#e9e2d0'); const y = Math.max(0.36 * sc, hand[1] - 0.105 * sc); ctx.beginPath(); ctx.moveTo(hand[0] - 0.125 * sc, y); ctx.lineTo(hand[0] + 0.125 * sc, y); ctx.lineTo(hand[0] + 0.155 * sc, y - 0.36 * sc); ctx.lineTo(hand[0] - 0.155 * sc, y - 0.36 * sc); ctx.closePath(); ctx.fill(); }
  else if (bag === 'umbrella') {
    ctx.fillStyle = D(L.bagCol || '#c0392b');
    if (dead) { ctx.beginPath(); ctx.ellipse(hand[0] + sign(f) * 1.1 * sc, 0.45 * sc, 0.3 * sc, 0.6 * sc, 0, 0, TAU); ctx.fill(); }
    else {
      ctx.strokeStyle = D('#2b2e34'); ctx.lineWidth = Math.max(0.03, minw * 0.8); ctx.beginPath(); ctx.moveTo(hand[0], hand[1] - 0.05); ctx.lineTo(hand[0], 2.6 * sc); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hand[0] - 0.64 * sc, 2.14 * sc); ctx.quadraticCurveTo(hand[0] - 0.6 * sc, 2.51 * sc, hand[0], 2.57 * sc); ctx.quadraticCurveTo(hand[0] + 0.6 * sc, 2.51 * sc, hand[0] + 0.64 * sc, 2.14 * sc); ctx.closePath(); ctx.fill();
    }
  } else if (bag === 'cane') { ctx.strokeStyle = D(L.bagCol || '#d8d2c4'); ctx.lineWidth = Math.max(0.035, minw * 0.8); ctx.beginPath(); if (dead) { ctx.moveTo(hand[0], 0.03); ctx.lineTo(hand[0] + sign(f) * 0.86 * sc, 0.03); } else { ctx.moveTo(hand[0], hand[1] + 0.05 * sc); ctx.lineTo(hand[0] + f * 0.12 * sc, 0.02); } ctx.stroke(); }
  else if (bag === 'clip') { ctx.fillStyle = D(L.bagCol || '#e7e2d4'); ctx.fillRect(J.haL[0] - 0.115 * sc, Math.max(0, J.haL[1] - 0.065 * sc), 0.23 * sc, 0.31 * sc); }
  else if (bag === 'cup') { ctx.fillStyle = D(L.bagCol || '#f1ede2'); ctx.fillRect(hand[0] - 0.045 * sc, Math.max(0, hand[1] - 0.03 * sc), 0.09 * sc, 0.15 * sc); }
  else if (bag === 'box') { ctx.fillStyle = D(L.bagCol || '#b08a52'); const mx = (J.haL[0] + J.haR[0]) / 2, my = Math.max(0.1 * sc, (J.haL[1] + J.haR[1]) / 2); ctx.fillRect(mx - 0.25 * sc, my - 0.09 * sc, 0.5 * sc, 0.37 * sc); }
  else if (bag === 'paper') { ctx.fillStyle = D('#e9e6dc'); const mx = (J.haL[0] + J.haR[0]) / 2, my = Math.max(0.06 * sc, (J.haL[1] + J.haR[1]) / 2); ctx.fillRect(mx - 0.215 * sc, my - 0.045 * sc, 0.43 * sc, 0.31 * sc); }
  else if (bag === 'flowers') { ctx.fillStyle = D('#4c9a56'); ctx.fillRect(hand[0] - 0.03 * sc, hand[1], 0.06 * sc, 0.25 * sc); ctx.fillStyle = D(L.bagCol || '#e85d75'); ctx.beginPath(); ctx.arc(hand[0] - f * 0.08 * sc, hand[1] + 0.32 * sc, 0.13 * sc, 0, TAU); ctx.fill(); }
  else if (bag === 'balloon' && !(dead && A.deadT > 6)) {
    const sway = Math.sin((A.t || 0) * 1.3 + (A.seed || 0)) * 0.1 + clamp((env.wind || 0) * 0.045, -0.45, 0.45), up = dead ? A.deadT * 1.7 : 0;
    ctx.strokeStyle = D('#d7dbe0'); ctx.lineWidth = Math.max(0.012, minw * 0.5); ctx.beginPath(); ctx.moveTo(hand[0], hand[1] + up); ctx.lineTo(hand[0] + sway * sc, 2.73 * sc + up); ctx.stroke();
    ctx.fillStyle = D(L.bagCol || '#e0413a'); ctx.beginPath(); ctx.ellipse(hand[0] + sway * sc, 2.98 * sc + up, 0.2 * sc, 0.25 * sc, 0, 0, TAU); ctx.fill();
  }
  const an = figAnimNow(A);
  if ((L.gun === 'rifle' || an === 'guard' || an === 'aimrifle') && !dead) {
    const held = an === 'guard' || an === 'aimrifle', a = J.haR, b2 = J.haL;
    let dx = b2[0] - a[0], dy = b2[1] - a[1], l = Math.hypot(dx, dy) || 1, x0, y0, x1, y1;
    if (held && l > 0.05 * sc) { dx /= l; dy /= l; x0 = a[0] - dx * 0.3 * sc; y0 = a[1] - dy * 0.3 * sc; x1 = b2[0] + dx * 0.4 * sc; y1 = b2[1] + dy * 0.4 * sc; }
    else { x0 = tx(0.42) - f * 0.14 * sc; y0 = ty(0.42) - 0.3 * sc; x1 = x0 - f * 0.12 * sc; y1 = y0 + 1.0 * sc; }
    ctx.strokeStyle = D('#0b0c0f'); ctx.lineWidth = Math.max(0.05, minw); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    if (rim) { ctx.strokeStyle = rim; ctx.lineWidth = Math.max(0.012, env.px * 0.6); ctx.beginPath(); ctx.moveTo(x0, y0 + 0.035); ctx.lineTo(x1, y1 + 0.035); ctx.stroke(); }
  }
  // small lights that give people away at night: a phone screen, a cigarette end
  if (!dead && env.dark) {
    if (an === 'phone' || an === 'sitphone') { ctx.fillStyle = '#cfe6ff'; ctx.fillRect(J.haR[0] - 0.035, J.haR[1] - 0.02, 0.07, 0.13); ctx.globalAlpha = 0.14; ctx.beginPath(); ctx.arc(J.haR[0], J.haR[1] + 0.04, 0.3, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    else if (an === 'smoke') { ctx.fillStyle = '#ff8a3a'; ctx.beginPath(); ctx.arc(J.haR[0] + f * 0.1, J.haR[1] + 0.03, Math.max(0.04, env.px * 0.8), 0, TAU); ctx.fill(); ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(J.haR[0] + f * 0.1, J.haR[1] + 0.03, 0.22, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
  }
  ctx.restore();
}

CB.fig = { drawFigure, actorJoints, figHit, figPose, figJoints };
