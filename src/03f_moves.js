// ---------------------------------------------------------------------------
// How people move when they are left to themselves, and when they are frightened.
// These are poses (figPose in src/03_figures.js calls them), so the shapes a round
// is tested against move with what is drawn: you can hit what you see. Nothing here
// changes anybody's routine, timing, speed, position or any decision the simulation
// makes; everything is worked out from who the person is (their id and look) and
// the clock, never from what happened to be drawn before.
//   traits     each person's own way of moving: a gait (brisk, swagger, shuffle, heavy),
//              a slouch, a build, the things they do while they wait, how they panic
//   standing   the weight shifting from leg to leg, and now and then checking a watch,
//              scratching their head, tugging a collar, a glance round; some keep their
//              hands in their pockets, guards clasp theirs behind their back
//   talking    gestures on the beat with pauses between, and spells of listening, nodding
//   working    a hammer, a spanner, a welding torch or a wad of cash, from the look
//   panic      five ways to run in a panic, three ways to cower, a hand to the mouth for
//              somebody who has just seen a killing
//   guards     a guard calling it in points, then has the radio to his mouth; a suspicious
//              one shades his eyes to peer about
// ---------------------------------------------------------------------------

function figHashN(n, h) { return (Math.imul(n | 0, 2654435761) ^ h) >>> 0; }

function figTraits(A) {
  let T = A._tr; if (T) return T;
  const L = A.look || {}, h = hashStr(String(A.id || 'x') + ':' + Math.round((A.seed || 0) * 1000));
  const r = (n) => ((h >>> n) & 255) / 255;
  const old = L.hair === 'white' || L.bag === 'cane', guard = A.role === 'guard' || A.role === 'hostile';
  const heavy = L.build === 'big' || (!L.build && !old && r(0) < 0.16), slight = !heavy && !L.build && r(0) > 0.84;
  const gait = old ? 'shuffle' : heavy ? 'heavy' : guard ? 'brisk' : r(8) < 0.22 ? 'swagger' : r(8) < 0.5 ? 'brisk' : 'plain';
  const pockets = !guard && !old && !L.bag && r(20) < 0.22;
  T = A._tr = {
    h, old, heavy, gait, guard, pockets, behind: guard && r(20) < 0.5,
    slouch: old ? 0.1 : guard ? 0 : r(16) * 0.06,
    bw: L.build ? null : heavy ? 1.17 : slight ? 0.9 : old ? 0.95 : 1, broad: !L.build && !heavy && r(4) > 0.7,
    panic: (h >>> 12) % 5, cower: (h >>> 22) % 3, ph: r(28) * 10, r1: r(24), r2: r(2),
  };
  return T;
}

// ---- standing about -----------------------------------------------------------
// What somebody standing about is doing right now: kind, and k (how far into it, eased in and out).
const FIG_IDLE = { kind: 'none', k: 0 };
const FIG_IDLE_KINDS = ['watch', 'glance', 'scratch', 'none', 'collar', 'glance', 'none'];
function figIdleAct(A, t) {
  const T = figTraits(A), P = 6.5 + 4 * T.r1, t2 = t + T.ph * 3, n = Math.floor(t2 / P), s = t2 - n * P;
  const kind = FIG_IDLE_KINDS[figHashN(n, T.h) % FIG_IDLE_KINDS.length], dur = kind === 'glance' ? 2.4 : 1.9;
  FIG_IDLE.kind = kind; FIG_IDLE.k = s < dur ? smooth(s / 0.4) * (1 - smooth((s - dur + 0.4) / 0.4)) : 0;
  return FIG_IDLE;
}
// Legs fitted so the feet stand where they are put (fx is from the person's own x, not the hip's).
function figStandOn(p, hy, fL, fR) { figLegTo(p, 0, hy, fL - (p.hx || 0), FIG_FOOT_Y); figLegTo(p, 1, hy, fR - (p.hx || 0), FIG_FOOT_Y); p.hy = hy; }
function figStand(p, t, A, b) {
  const T = figTraits(A);
  // the weight goes over to one leg, stays a while, and goes back
  const w = clamp(Math.sin((t + T.ph) * 0.33) * 1.8, -1, 1);
  p.hx = 0.016 * w; p.lean = T.slouch; p.head = T.slouch * 1.3;
  figStandOn(p, FIG.hip - 0.006 - 0.012 * Math.abs(w), 0.045, -0.045);
  if (T.pockets) { p.aL = -0.22 + b; p.eL = 0.62; p.aR = -0.18 - b; p.eR = 0.66; }
  else if (T.behind) { p.aL = -0.42; p.eL = 1.05; p.aR = -0.38; p.eR = 1.1; }
  else { p.aL = 0.07 + b; p.aR = -0.05 - b; }
  // and now and then something to do
  const I = figIdleAct(A, t), k = I.k; if (k <= 0) return;
  if (I.kind === 'watch') { p.aL = lerp(p.aL, 0.12, k); p.eL = lerp(p.eL, 1.85, k); p.head = lerp(p.head, 0.3, k); } // the wrist up in front, a look down at it
  else if (I.kind === 'scratch' && !T.behind) { p.aR = lerp(p.aR, 2.45, k); p.eR = lerp(p.eR, 2.55 + 0.12 * Math.sin(t * 15), k); p.head = lerp(p.head, 0.1, k); } // the back of the head
  else if (I.kind === 'collar') { p.aR = lerp(p.aR, 0.95, k); p.eR = lerp(p.eR, 2.35, k); p.head = lerp(p.head, -0.04, k); }
  else if (I.kind === 'glance') p.head = lerp(p.head, -0.07, k);
}
// Suspicious: a hand up to shade the eyes, the other on the hip, leaning in to look.
function figPeer(p, t, A) {
  const T = figTraits(A);
  figStandOn(p, FIG.hip - 0.01, 0.06, -0.05);
  p.lean = 0.07; p.head = -0.08 + 0.03 * Math.sin(t * 1.7 + T.ph);
  p.aR = 1.9; p.eR = 2.0; p.aL = -0.35; p.eL = 1.75;
}
// A guard who has seen something: weapon up at first, then (for the last 1.2 seconds before the alarm
// goes up) the radio to his mouth, the rifle hanging from the other hand. k: how far into that.
function figAlarmK(A) { return smooth((1.2 - (A.react || 0)) / 0.3); }
function figAlarm(p, t, A) {
  const k = figAlarmK(A); if (k <= 0) return;
  const q = FIG_ALARM; q.hx = 0; figStandOn(q, FIG.hip - 0.012, 0.12, -0.08);
  q.lean = 0.05; q.head = 0.05 + 0.02 * Math.sin(t * 9);
  q.aR = 0.32; q.eR = 2.5; q.aL = 0.25; q.eL = 0.3; // the radio at the mouth, the rifle (or the pistol) down by the side
  for (let i = 0; i < POSE_KEYS.length; i++) { const key = POSE_KEYS[i]; p[key] = lerp(p[key] || 0, q[key] || 0, k); }
}
const FIG_ALARM = {};
function figRadioUp(A, an) { return A.state === 'alarm' && !A.dead && (an === 'aimrifle' || an === 'aim') && figAlarmK(A) > 0.5; }

// ---- talking --------------------------------------------------------------------
// How much somebody is talking rather than listening right now (0 listening, 1 talking).
function figSpeaking(A, t) {
  const T = figTraits(A), x = Math.sin((t + T.ph * 3) * (TAU / (6 + 3 * T.r2)));
  return smooth((x + 0.3) / 0.45);
}
function figTalk(p, t, A) {
  const T = figTraits(A), sp = figSpeaking(A, t);
  figStandOn(p, FIG.hip - 0.008, 0.05, -0.045);
  p.lean = 0.02 + T.slouch; p.head = T.slouch;
  p.aR = 0.14; p.eR = 0.55; p.aL = 0.06; p.eL = 0.3; // at rest: the near hand a little forward
  // a gesture on each beat while talking, with gaps between
  const B = 1.15 + 0.4 * T.r1, t2 = t + T.ph, n = Math.floor(t2 / B), u = t2 / B - n, g = figHashN(n, T.h) % 7;
  const e = Math.pow(Math.sin(Math.PI * clamp(u * 1.25, 0, 1)), 0.6) * sp;
  if (e > 0) {
    if (g === 0) { p.aR = lerp(p.aR, 0.75, e); p.eR = lerp(p.eR, 0.8, e); } // an open hand out
    else if (g === 1) { p.aR = lerp(p.aR, 0.6, e); p.eR = lerp(p.eR, 1.75, e); } // making a point, a finger up
    else if (g === 2) { p.aR = lerp(p.aR, 0.6, e); p.eR = lerp(p.eR, 1.05, e); p.aL = lerp(p.aL, 0.5, e); p.eL = lerp(p.eL, 1.05, e); } // both hands
    else if (g === 3) { p.aR = lerp(p.aR, 0.3, e); p.eR = lerp(p.eR, 2.25, e); } // a hand to the chest
    else if (g === 4) { p.aR = lerp(p.aR, 0.25, e); p.eR = lerp(p.eR, 1.35, e); p.aL = lerp(p.aL, 0.25, e); p.eL = lerp(p.eL, 1.35, e); p.head = lerp(p.head, -0.06, e); } // a shrug, palms up
    p.head += 0.04 * e;
  }
  // listening: nods, a few at a time
  const ls = 1 - sp; if (ls > 0) { const nb = Math.max(0, Math.sin(t * 0.8 + T.ph)); p.head += ls * 0.07 * Math.max(0, Math.sin(t * 6.2)) * smooth(nb * 2 - 0.6); p.aL = lerp(p.aL, -0.35, ls * 0.6); p.eL = lerp(p.eL, 1.7, ls * 0.6); }
}

// ---- working --------------------------------------------------------------------
// What is in the hand: the look's own tool if it has one, otherwise one that suits the clothes.
function figWorkTool(A) {
  const L = A.look || {}, T = figTraits(A);
  if (L.tool !== undefined) return L.tool;
  if (L.bag && (FIG_HAND_BAGS[L.bag] === 1 || L.bag === 'clip' || L.bag === 'box' || L.bag === 'paper')) return null;
  if (L.hat === 'hardhat') return ['hammer', 'wrench', 'torch'][T.h % 3];
  if (L.hat === 'helmet' || L.vest) return 'wrench';
  if (L.tie || (L.coat && L.long)) return 'cash';
  return T.h % 2 ? 'wrench' : 'hammer';
}
function figWork(p, t, A) {
  const tool = figWorkTool(A), T = figTraits(A);
  figStandOn(p, FIG.hip - 0.02, 0.1, -0.06);
  p.lean = 0.18; p.head = 0.2;
  if (tool === 'hammer') { // up slowly, down hard, a beat between
    const c = (t * 1.1 + T.ph) % 1, up = c < 0.6 ? smooth(c / 0.6) : 1 - smooth((c - 0.6) / 0.1);
    p.aR = lerp(0.65, 1.85, up); p.eR = lerp(0.5, 1.95, up); p.aL = 0.75; p.eL = 0.8;
  } else if (tool === 'wrench') { const s1 = Math.sin(t * 2.6 + T.ph); p.aR = 0.75 + 0.12 * s1; p.eR = 1.0 + 0.32 * s1; p.aL = 0.72; p.eL = 0.85; }
  else if (tool === 'torch') { p.lean = 0.26; p.head = 0.24; p.aR = 0.85 + 0.03 * Math.sin(t * 7); p.eR = 0.62; p.aL = 0.72; p.eL = 0.95; }
  else if (tool === 'cash') { p.lean = 0.06; p.head = 0.2; p.aL = 0.5; p.eL = 1.55; p.aR = 0.55; p.eR = 1.42 + 0.16 * Math.max(0, Math.sin(t * 8 + T.ph)); }
  else { p.aL = 0.7; p.eL = 0.8 + 0.1 * Math.sin(t * 5); p.aR = 0.6; p.eR = 0.9 + 0.1 * Math.cos(t * 6); }
}

// ---- frightened ------------------------------------------------------------------
function figPanic(p, t, ph, A) {
  const T = figTraits(A), s = Math.sin(ph);
  switch (T.panic) {
    case 1: p.aL = 2.75; p.eL = 1.75 + 0.1 * s; p.aR = 2.6; p.eR = 1.85 - 0.1 * s; p.lean = 0.34; p.head = 0.22; break; // arms over the head
    case 2: p.aL = -0.8 * s; p.eL = 1.3; p.aR = 0.9 + 0.5 * s; p.eR = 0.6; p.lean = 0.12; p.head = -0.14; break; // looking back as they run
    case 3: { // stumbling: every so often a lurch forward, arms thrown out to catch themselves
      const c = (t * 0.8 + T.ph) % 1, lu = c < 0.22 ? Math.sin(Math.PI * c / 0.22) : 0;
      p.aL = lerp(-0.9 * s, 1.5, lu); p.eL = lerp(1.4, 0.3, lu); p.aR = lerp(0.9 * s, 1.35, lu); p.eR = lerp(1.4, 0.35, lu); p.lean = 0.22 + 0.3 * lu; break;
    }
    case 4: p.aL = 2.3; p.eL = 2.35 + 0.1 * s; p.aR = 2.2; p.eR = 2.45 - 0.1 * s; p.lean = 0.2; p.head = 0.1; break; // hands clutching the head
    default: p.aL = 2.6 + 0.35 * s; p.aR = 2.35 - 0.35 * s; p.eL = 0.55 + 0.2 * s; p.eR = 0.6 - 0.2 * s; p.lean = 0.16; // arms up and flailing
  }
  // just seen somebody killed: a hand over the mouth for the first moments
  if (A.sawKill && A.react > 0) { const k = smooth((0.9 - A.react) / 0.15) * smooth(A.react / 0.2); p.aR = lerp(p.aR, 0.75, k); p.eR = lerp(p.eR, 2.45, k); p.head = lerp(p.head || 0, -0.05, k); }
}
function figCower(p, t, A) {
  const T = figTraits(A), st = T.cower, tr = 0.006 * Math.sin(t * (13 + 5 * T.r1) + T.ph * 7);
  p.hx = tr - 0.03; p.lean = st === 2 ? 0.78 : 0.62; p.head = st === 2 ? 0.45 : 0.3;
  figStandOn(p, st === 2 ? 0.37 : 0.42, 0.13, -0.03);
  if (st === 0) { p.aL = 1.3; p.eL = 2.3; p.aR = 1.35; p.eR = 2.25; } // hands over the ears, elbows in front
  else if (st === 1) { p.aL = 1.6; p.eL = 1.65; p.aR = 1.68; p.eR = 1.6; } // hands clasped on top of the head
  else { p.aL = 0.95; p.eL = 1.9; p.aR = 0.85; p.eR = 2.0; } // arms round the knees
}

// ---- walking -----------------------------------------------------------------------
// Each walk keeps the same stride (k and duty: the feet land in the same places); what changes is
// how high the feet lift, how the hips ride, how the arms swing and how the body is carried.
const FIG_WALKS = {
  plain: { G: FIG_GAIT.walk, swing: 0.38, elbow: 0.28, eswing: 0.22, lean: 0.05, head: 0 },
  brisk: { G: Object.assign({}, FIG_GAIT.walk, { lift: 0.065 }), swing: 0.56, elbow: 0.5, eswing: 0.3, lean: 0.1, head: -0.02 },
  swagger: { G: Object.assign({}, FIG_GAIT.walk, { lift: 0.06 }), swing: 0.5, elbow: 0.1, eswing: 0.1, lean: -0.05, head: -0.07, roll: 0.07 },
  shuffle: { G: Object.assign({}, FIG_GAIT.walk, { lift: 0.028, hy: FIG.hip - 0.03 }), swing: 0.16, elbow: 0.45, eswing: 0.08, lean: 0.13, head: 0.12 },
  heavy: { G: Object.assign({}, FIG_GAIT.walk, { lift: 0.045, hy: FIG.hip - 0.015 }), swing: 0.3, elbow: 0.35, eswing: 0.15, lean: 0.03, head: 0.02, roll: 0.025 },
};
function figWalk(p, t, ph, A) {
  const T = figTraits(A), W = FIG_WALKS[T.gait] || FIG_WALKS.plain, s = Math.sin(ph);
  figGait(p, W.G, ph);
  // the arms swing from the shoulder, and the forearms follow a beat behind
  p.aL = -W.swing * s; p.aR = W.swing * s;
  p.eL = W.elbow + W.eswing * Math.max(0, Math.sin(ph + Math.PI - 0.7)); p.eR = W.elbow + W.eswing * Math.max(0, Math.sin(ph - 0.7));
  // the body rocks a little with each step, the head a moment later
  p.lean = W.lean + T.slouch * 0.5 + 0.014 * Math.sin(2 * ph + 0.4) + (W.roll || 0) * Math.sin(ph);
  p.head = W.head + T.slouch * 0.6 + 0.022 * Math.sin(2 * ph - 0.5);
}

CB.fig.traits = figTraits; CB.fig.idleAct = figIdleAct; // (for the test pictures)
