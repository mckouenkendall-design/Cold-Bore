// ---------------------------------------------------------------------------
// Ragdolls: how a body falls when somebody dies. Visual only.
//
// A dead person's gameplay position (a.x, a.y, a.plane, a.zone, a.room, behind,
// inVeh) never changes: guards find bodies by it. Only the picture moves. At the
// moment of death the simulation notes what happened (rdNote, called from killActor):
// the part that was hit, the round and how fast it was going, and what is around the
// person (the floor and where it ends, walls beside them, a seat, a desk, a car). From
// then on the body is a small physical model: sixteen weighted points held at fixed
// distances, joints that only bend the way real ones do, gravity, a floor with
// friction, and the walls next to them.
//
// One solver feeds both pictures: the scope (flat, side on) and the kill camera (3D).
// It always moves in the same fixed steps from the moment of death, so the same shot
// gives the same fall however fast the screen is drawn and whichever picture asks
// first. Once the body has settled it sleeps: the joints are kept and nothing more is
// worked out for it.
//
// Space: metres measured from where the person stood (a.x, a.y) and from their plane
// (z = 0). x across the screen, y up, z away from the shooter (the way the round flies).
// ---------------------------------------------------------------------------

// How heavy each round is (kilograms), and how readily it comes out of the far side of
// a head or a chest. The game only lets a round carry on (and hit something else) when
// its penetration is 1.2 or more; below that the picture may still show an exit wound
// where the round would plausibly come out, but the round itself goes no further.
const RD_CAL = {
  c22: { kg: 0.0026, head: 0, torso: 0, size: 0.15 },     // .22 rimfire: stays in
  c9s: { kg: 0.016, head: 0, torso: 0, size: 0.3 },       // heavy 9 mm subsonic: stays in
  c9p: { kg: 0.008, head: 0.3, torso: 0, size: 0.25 },    // a pistol (people shot by other people)
  c300s: { kg: 0.0143, head: 0.6, torso: 0.1, size: 0.35 },
  c556: { kg: 0.004, head: 0.75, torso: 0.15, size: 0.35 }, // usually stays in a chest
  c308: { kg: 0.0109, head: 1, torso: 0.65, size: 0.55 },
  c762r: { kg: 0.0097, head: 1, torso: 0.6, size: 0.55 },
  c8mm: { kg: 0.0127, head: 1, torso: 0.7, size: 0.6 },
  c65: { kg: 0.0091, head: 1, torso: 0.6, size: 0.5 },
  c300m: { kg: 0.0123, head: 1, torso: 1, size: 0.8 },     // magnum and up: through everything, large exit
  c338: { kg: 0.0162, head: 1, torso: 1, size: 0.85 },
  c408: { kg: 0.027, head: 1, torso: 1, size: 0.95 },
  c50: { kg: 0.042, head: 1, torso: 1, size: 1 },
  crail: { kg: 0.015, head: 1, torso: 1, size: 1 },
};
function rdCal(cal) { return RD_CAL[cal] || RD_CAL.c308; }
// A number from 0 to 1 for how hard a round hits, from its energy: a .22 is about 0.1,
// a .308 about 0.6, a .50 about 0.9. Used for the push and passed to the sound.
function rdPower(kg, v) { const e = 0.5 * kg * v * v; return clamp(Math.log(Math.max(1, e / 80)) / Math.log(25000 / 80), 0, 1); }
// Does the round come out of the far side? Always when the game lets it carry on. Below
// that it depends on the calibre, decided once per person so every picture agrees.
function rdExits(id, part, cal, pen) {
  if (pen >= 1.2) return true;
  const c = rdCal(cal), ch = part === 'head' ? c.head : c.torso;
  if (ch <= 0) return false; if (ch >= 1) return true;
  return (hashStr(String(id) + ':' + part + ':' + cal) % 1000) / 1000 < ch;
}
// How big the exit is, 0 to 1 (0 when there is none).
function rdExitSize(id, part, cal, pen) { return rdExits(id, part, cal, pen) ? clamp(rdCal(cal).size * (part === 'head' ? 1.1 : 1), 0.12, 1) : 0; }

// ---- the body ------------------------------------------------------------------------
// Sixteen points. The chest is a rigid block (both shoulders and the breastbone), so is the
// pelvis (both hip joints and the front of the pelvis), and the two meet at a point in the
// middle of the spine, where they can bend forward a long way, back a little, and only a
// little to the side or round. A dead spine cannot hold anybody up, which is why a body
// never ends sitting bolt upright. The head hangs from the shoulders; the limbs from the
// shoulders and hips.
const RD_SHL = 0, RD_SHR = 1, RD_HPL = 2, RD_HPR = 3, RD_FR = 4, RD_HEAD = 5, RD_ELL = 6, RD_HAL = 7, RD_ELR = 8, RD_HAR = 9, RD_KNL = 10, RD_FTL = 11, RD_KNR = 12, RD_FTR = 13, RD_FP = 14, RD_SP = 15, RD_N = 16;
// kilograms for a person of 76 kg, and how thick each point is (so a body lies ON the floor)
const RD_KG = [8, 8, 6.5, 6.5, 4, 5.5, 2.2, 1.6, 2.2, 1.6, 8, 4.5, 8, 4.5, 3, 2];
const RD_RAD = [0.09, 0.09, 0.095, 0.095, 0.03, 0.158, 0.045, 0.035, 0.045, 0.035, 0.055, 0.035, 0.055, 0.035, 0.03, 0.09];
// how firmly each point is kept side on to the scope (knees and elbows may flop over sideways)
const RD_FLATK = [1, 1, 1, 1, 1, 1, 0.08, 0.05, 0.08, 0.05, 0.12, 0.3, 0.12, 0.3, 1, 1];
// The lengths. The first 22 are fixed (chest, pelvis, head, limbs); the last five may change
// within limits, and that is how the spine bends (front of chest to front of pelvis: forward
// and back; the two sides: sideways; the two diagonals: twisting).
const RD_LINK = [0, 1, 0, 4, 1, 4, 0, 15, 1, 15, 4, 15, 2, 3, 2, 14, 3, 14, 2, 15, 3, 15, 14, 15,
  5, 0, 5, 1, 0, 6, 6, 7, 1, 8, 8, 9, 2, 10, 10, 11, 3, 12, 12, 13,
  4, 14, 0, 2, 1, 3, 0, 3, 1, 2];
const RD_NL = RD_LINK.length / 2, RD_NTRUNK = 12, RD_NFIX = 22;
const RDH = 1 / 120, RD_ITER = 6;   // the solver's step (seconds, the same as the game's) and how many times a step tidies its lengths
const RD_SLIDE = 1.2;               // the furthest a body may end up from where the person stood (metres)

// The pose a person was in as they died, as the scope draws it (local, facing +x, unmirrored).
function rdLivingPose(A, t, ph) {
  const p = figPose(A.deathPose || 'stand', t, ph, A);
  if (A.animFrom && A.animAt !== undefined && A.deathAt !== undefined) {
    const u = (t - A.animAt) / POSE_BLEND;
    if (u >= 0 && u < 1) { const q = figPose(A.animFrom, t, ph, A), k = smooth(u); for (let i = 0; i < POSE_KEYS.length; i++) { const key = POSE_KEYS[i]; p[key] = lerp(q[key] || 0, p[key] || 0, k); } }
  }
  return figJoints(p);
}
// The figure's half widths, the same as the kill camera's solid figure uses.
function rdWidths(L, sc) {
  const bw = L.build === 'big' ? 1.16 : L.build === 'thin' ? 0.9 : 1, ws = 0.18 * sc * bw, wh = 0.115 * sc * bw;
  return { ws, wh, za: ws + 0.06 * sc };
}
// Put a 2D pose (mirrored and scaled) into the 3D points.
function rdFromPose(J, f, sc, W, out) {
  const X = (q) => q[0] * f * sc, Y = (q) => q[1] * sc;
  const set = (i, x, y, z) => { out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z; };
  const hx = X(J.hip), hy = Y(J.hip), sx = X(J.sh), sy = Y(J.sh);
  let ux = sx - hx, uy = sy - hy; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
  const nx = f * uy, ny = -f * ux; // out of the chest
  set(RD_SHL, sx, sy, f * W.ws); set(RD_SHR, sx, sy, -f * W.ws);
  set(RD_HPL, hx, hy, f * W.wh); set(RD_HPR, hx, hy, -f * W.wh);
  set(RD_FR, hx + ux * ul * 0.75 + nx * 0.1 * sc, hy + uy * ul * 0.75 + ny * 0.1 * sc, 0);
  set(RD_FP, hx + ux * ul * 0.12 + nx * 0.09 * sc, hy + uy * ul * 0.12 + ny * 0.09 * sc, 0);
  set(RD_SP, hx + ux * ul * 0.5, hy + uy * ul * 0.5, 0);
  set(RD_HEAD, X(J.head), Y(J.head), 0);
  set(RD_ELL, X(J.elL), Y(J.elL), f * W.za); set(RD_HAL, X(J.haL), Y(J.haL), f * W.za);
  set(RD_ELR, X(J.elR), Y(J.elR), -f * W.za); set(RD_HAR, X(J.haR), Y(J.haR), -f * W.za);
  set(RD_KNL, X(J.knL), Y(J.knL), f * W.wh * 0.95); set(RD_FTL, X(J.ftL), Y(J.ftL), f * W.wh * 0.9);
  set(RD_KNR, X(J.knR), Y(J.knR), -f * W.wh * 0.95); set(RD_FTR, X(J.ftR), Y(J.ftR), -f * W.wh * 0.9);
}

// ---- what is noted at the moment of death ------------------------------------------------
// Called by Sim.killActor. Nothing here touches any random stream the game uses.
function rdNote(sim, a, part, how, bullet, src) {
  try {
    const st = sim.st || {}, P = a.plane, sc = (a.look && a.look.h) || 1;
    const shot = how === 'shot' && !!bullet;
    const cal = how === 'npc' ? 'c9p' : st.cal || 'c308', C = rdCal(cal);
    const R = { how, part, cal, kg: C.kg, v: null, pen: shot ? st.pen || 0 : 0, hx: 0, hy: 1.2 * sc, seed: hashStr(String(a.id)) ^ Math.round(sim.t * 977), vx0: a.inVeh ? 0 : a.vx || 0,
      run: !!a.running, eye: null, D: 100, env: null, src: null, car: null, s: null };
    if (shot) {
      R.v = [bullet.vx, bullet.vy, bullet.vz];
      const bz = P ? P.z : bullet.z, back = bullet.vz > 1 ? (bullet.z - bz) / bullet.vz : 0;
      R.hx = bullet.x - bullet.vx * back - a.x; R.hy = bullet.y - bullet.vy * back - a.y;
      R.eye = [bullet.ox, bullet.oy, bullet.oz]; R.D = Math.max(5, bz - bullet.oz);
    } else if (sim.eye0) { R.eye = [sim.eye0.x, sim.eye0.y, sim.eye0.z]; R.D = Math.max(5, (P ? P.z : 100) - sim.eye0.z); }
    R.through = shot && R.pen >= 1.2 && (part === 'head' || part === 'torso');
    R.exit = shot ? rdExits(a.id, part, cal, R.pen) : false;
    R.exitK = shot ? rdExitSize(a.id, part, cal, R.pen) : 0;
    const vi = R.v ? Math.hypot(R.v[0], R.v[1], R.v[2]) : how === 'npc' ? 340 : 0;
    R.power = vi ? rdPower(C.kg, vi) : 0;
    if (src) R.src = { x: src.x - a.x, y: src.y - a.y, r: src.r || 4, w: src.w || 0, h: src.h || 0, floor: src.floor === undefined ? 0 : src.floor - a.y };
    if (a.inVeh) { const v = a.inVeh; R.car = { v0: v.v || 0, dir: v.dir || 1, seat: a.seat || 0 }; }
    R.env = rdEnv(sim, a, R);
    a.rd = R;
  } catch (e) { a.rd = null; }
}

// What is around the body: the floor it stands on and where that floor ends, the walls next
// to it, and whatever a sitting person sits on. All in the body's own metres.
function rdEnv(sim, a, R) {
  const P = a.plane, S = sim.S, f = a.face < 0 ? -1 : 1, an = a.anim || 'stand';
  const E = { gfn: null, x0: -9, x1: 9, boxes: [], mat: S ? S.groundMat || 'dirt' : 'dirt', seat: null, desk: null, back: null, rail: null, car: null };
  if (!P) return E;
  const seated = /^(sit|type|drive|sleep)/.test(an) || an === 'sitphone' || an === 'sitdrink';
  if (a.inVeh) {
    // a seat in a car: the seat under them, its back behind, the dashboard in front, the roof above
    E.car = { lo: -0.24, hi: 0.58, well: 1.05, dash: 0.74, floor: -0.1, roof: 1.42 };
    E.seat = { x0: -0.3, x1: 0.36, top: 0.41 }; E.back = -0.16; E.mat = 'metal';
    return E;
  }
  // the floor
  let ground = null;
  if (P.groundY !== undefined) { const g = P.groundFn ? P.groundFn(a.x) : P.groundY; if (Math.abs(g - a.y) < 0.25) ground = g; }
  if (a.yFn) { const y0 = a.y, fn = a.yFn, x0 = a.x; E.gfn = (x) => fn(x0 + x) - y0; }
  else if (ground !== null && P.groundFn) { const fn = P.groundFn, x0 = a.x, y0 = a.y; E.gfn = (x) => fn(x0 + x) - y0; }
  let sup = null;
  if (ground === null && !a.yFn) for (let i = 0; i < P.solids.length; i++) { const s = P.solids[i]; if (a.x >= s.x - 0.02 && a.x <= s.x + s.w + 0.02 && Math.abs(s.y + s.h - a.y) < 0.15) { sup = s; break; } }
  if (ground !== null || a.yFn) { E.mat = P.groundMat || (S && S.groundMat) || 'dirt'; }
  else if (a.behind && !sup) { E.x0 = -2.5; E.x1 = 2.5; E.mat = 'interior'; }
  else {
    // standing on something: a quay, a deck, a roof. What holds them up, and how far does it go?
    if (sup) {
      let x0 = sup.x, x1 = sup.x + sup.w, grow = true, guard = 0;
      while (grow && guard++ < 8) { grow = false; for (let i = 0; i < P.solids.length; i++) { const s = P.solids[i]; if (Math.abs(s.y + s.h - a.y) > 0.15) continue; if (s.x < x0 && s.x + s.w >= x0 - 0.05) { x0 = s.x; grow = true; } if (s.x + s.w > x1 && s.x <= x1 + 0.05) { x1 = s.x + s.w; grow = true; } } }
      E.x0 = Math.max(-9, x0 - a.x); E.x1 = Math.min(9, x1 - a.x); E.mat = sup.mat || 'hard';
    } else {
      // nothing to go on: keep the body to the stretch they were seen walking on, and a little more
      let lo = a.x, hi = a.x; (a.routine || []).forEach((op) => { if ((op[0] === 'walk' || op[0] === 'run') && typeof op[1] === 'number' && Math.abs(op[1] - a.x) < 12) { lo = Math.min(lo, op[1]); hi = Math.max(hi, op[1]); } });
      E.x0 = Math.min(-0.75, lo - a.x - 0.45); E.x1 = Math.max(0.75, hi - a.x + 0.45); E.mat = 'hard';
    }
  }
  // walls and things beside them (anything they stand in front of is behind them, not in the way)
  for (let i = 0; i < P.solids.length; i++) {
    const s = P.solids[i], m = s.mat;
    if (m === 'leaf' || m === 'grid') continue;
    if (a.x >= s.x - 0.05 && a.x <= s.x + s.w + 0.05) continue;
    if (s.x > a.x + 3.2 || s.x + s.w < a.x - 3.2 || s.y > a.y + 2.2 || s.y + s.h < a.y + 0.06) continue;
    E.boxes.push([s.x - a.x, s.y - a.y, s.x + s.w - a.x, s.y + s.h - a.y]);
  }
  // seats, a desk, a rail to lean on
  if (seated) { E.seat = { x0: -0.28, x1: 0.36, top: 0.41 }; E.back = -0.14; }
  if (an === 'type') E.desk = { x0: 0.3, x1: 1.15, top: 0.75 };
  if (an === 'lean') E.rail = { x: 0.4, top: 1.06 };
  // a wall close behind the person, for blood (and for the kill camera)
  E.wall = rdWallBehind(sim, a, R);
  E.f = f;
  return E;
}
// The nearest surface behind the point that was hit, within a few metres: { dz, mat }.
function rdWallBehind(sim, a, R) {
  const P = a.plane, S = sim.S, hx = a.x + R.hx, hy = a.y + R.hy;
  if (a.inVeh) return null;
  if (a.behind) return { dz: 2.4, mat: 'interior' };
  for (let i = 0; i < P.solids.length; i++) { const s = P.solids[i]; if (s.mat === 'leaf' || s.mat === 'grid' || s.mat === 'glasswall') continue; if (hx >= s.x && hx <= s.x + s.w && hy >= s.y && hy <= s.y + s.h) return { dz: 0.3, mat: s.mat }; }
  let best = null;
  if (S && S.planes) for (let j = 0; j < S.planes.length; j++) {
    const Q = S.planes[j], dz = Q.z - P.z; if (dz <= 0.05 || dz > 5 || (best && dz >= best.dz)) continue;
    const ax = R.v ? hx + (R.v[0] / Math.max(1, R.v[2])) * dz : hx, ay = R.v ? hy + (R.v[1] / Math.max(1, R.v[2])) * dz : hy;
    for (let i = 0; i < Q.solids.length; i++) { const s = Q.solids[i]; if (s.mat === 'leaf' || s.mat === 'grid' || s.mat === 'glasswall') continue; if (ax >= s.x && ax <= s.x + s.w && ay >= s.y && ay <= s.y + s.h) { best = { dz, mat: s.mat }; break; } }
  }
  return best;
}

// ---- starting the fall ------------------------------------------------------------------------
// A record for somebody who died without one (a test picture, a person made dead by a script).
function rdDefault(A) {
  const sc = (A.look && A.look.h) || 1, dir = A.deathDir || 0;
  return { how: A.deathHow || 'shot', part: A.deathPart || 'torso', cal: 'c308', kg: 0.0109, v: A.deathHow === 'shot' || !A.deathHow ? [dir * 60, -4, 760] : null, pen: 0.6, hx: 0.02 * (A.face || 1), hy: (A.deathPart === 'head' ? 1.62 : 1.22) * sc,
    seed: hashStr(String(A.id || 'x')), vx0: 0, run: false, eye: null, D: 100, env: null, src: null, car: null, s: null, through: false, exit: true, exitK: 0.55, power: 0.6 };
}
// Where the wound is, in the body's own measures, so it stays put on the body as it falls:
// for the trunk, t up the spine from the hip (0) to the neck (1) and o across it (the
// figure drawing's own figPX measures); for the head, u along the neck and n across it.
function rdWoundAt(R, J, f, sc) {
  const X = (q) => q[0] * f * sc, Y = (q) => q[1] * sc;
  const w = R.wound = { t: 0.62, o: 0.02 * f, u: 0, n: 0.06 * f };
  if (R.how !== 'shot' || !R.v) return;
  if (R.part === 'head') {
    let ux = X(J.head) - X(J.neck), uy = Y(J.head) - Y(J.neck); const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
    const dx = R.hx - X(J.head), dy = R.hy - Y(J.head); w.u = dx * ux + dy * uy; w.n = dx * uy - dy * ux;
    const r = Math.hypot(w.u, w.n), m = 0.13 * sc; if (r > m) { w.u *= m / r; w.n *= m / r; }
  } else {
    let ux = X(J.neck) - X(J.hip), uy = Y(J.neck) - Y(J.hip); const T = Math.hypot(ux, uy) || 1; ux /= T; uy /= T;
    const dx = R.hx - X(J.hip), dy = R.hy - Y(J.hip);
    w.t = clamp((dx * ux + dy * uy) / T, 0.05, 1); w.o = clamp(dx * uy - dy * ux, -0.08 * sc, 0.08 * sc);
  }
}
function rdDist(p, i, j) { return Math.hypot(p[j * 3] - p[i * 3], p[j * 3 + 1] - p[i * 3 + 1], p[j * 3 + 2] - p[i * 3 + 2]); }
function rdInit(A, R) {
  const sc = (A.look && A.look.h) || 1, f = A.face < 0 ? -1 : 1, L = A.look || {}, W = rdWidths(L, sc);
  const E = R.env || (R.env = { gfn: null, x0: -9, x1: 9, boxes: [], mat: 'dirt', seat: null, desk: null, back: null, rail: null, car: null, wall: null });
  if (!E.f) E.f = f;
  if (A.inVeh && !E.car) { E.car = { lo: -0.24, hi: 0.58, well: 1.05, dash: 0.74, floor: -0.1, roof: 1.42 }; E.seat = { x0: -0.3, x1: 0.36, top: 0.41 }; E.back = -0.16; }
  if (!E.seat && /^(sit|type|drive|sleep)/.test(A.deathPose || '')) { E.seat = { x0: -0.28, x1: 0.36, top: 0.41 }; E.back = -0.14; if (A.deathPose === 'type' && !E.desk) E.desk = { x0: 0.3, x1: 1.15, top: 0.75 }; }
  const N3 = RD_N * 3;
  const s = { t: 0, p: new Float64Array(N3), o: new Float64Array(N3), z0: new Float64Array(RD_N), w: new Float64Array(RD_N), r: new Float64Array(RD_N), lo: new Float64Array(RD_NL), hi: new Float64Array(RD_NL),
    cn: new Float64Array(RD_N), Uc: [0, 1, 0], Sc: [0, 0, f], Fc: [f, 0, 0], Up: [0, 1, 0], Sp: [0, 0, f], Fp: [f, 0, 0], f, sc, W,
    sleep: false, quiet: 0, landT: null, landV: 0, out: null, crush: null, lean: 0, legSide: 0.45, toneK: 0, toneT: 0.1, toneL: null, carF: null };
  const t0 = A.deathAt || 0, ph = A.deathPh || 0, dt = 1 / 60, J0 = rdLivingPose(A, t0, ph);
  rdFromPose(J0, f, sc, W, s.p);
  rdWoundAt(R, J0, f, sc);
  // the same pose a moment earlier: the difference is how each part was already moving
  const rate = Math.abs(R.vx0) * (R.run ? 2.6 : 4.3);
  rdFromPose(rdLivingPose(A, t0 - dt, ph - rate * dt), f, sc, W, s.o);
  for (let i = 0; i < RD_N; i++) { s.w[i] = 1 / (RD_KG[i] * sc * sc); s.r[i] = RD_RAD[i] * sc; s.z0[i] = s.p[i * 3 + 2]; }
  for (let k = 0; k < RD_NL; k++) s.lo[k] = s.hi[k] = rdDist(s.p, RD_LINK[k * 2], RD_LINK[k * 2 + 1]);
  // how far the spine bends: forward to about 65 degrees, back to 20 (measured on the front of the
  // chest and of the pelvis, turned about the middle of the spine)
  {
    const p = s.p, sp = RD_SP * 3, ax = p[RD_FR * 3] - p[sp], ay = p[RD_FR * 3 + 1] - p[sp + 1], bx = p[RD_FP * 3] - p[sp], by = p[RD_FP * 3 + 1] - p[sp + 1];
    const d = (th) => { const a = -th * f, c = Math.cos(a), n = Math.sin(a); return Math.hypot(ax * c - ay * n - bx, ax * n + ay * c - by); };
    const k = RD_NFIX; s.lo[k] = Math.min(d(1.15), d(-0.35)); s.hi[k] = Math.max(d(1.15), d(-0.35));
    for (let q = 1; q <= 4; q++) { s.lo[k + q] -= 0.1 * sc; s.hi[k + q] += (q < 3 ? 0.02 : 0.04) * sc; }
  }
  // crushed under a falling load: squashed flat beneath it
  if (R.how === 'accident' && R.src && !A.inVeh) { const sr = R.src; s.crush = { x0: sr.x - sr.w / 2 - 0.05, x1: sr.x + sr.w / 2 + 0.05, top: 0.07 * sc }; for (let i = 0; i < RD_N; i++) s.r[i] = Math.min(s.r[i], 0.03); }
  // velocities (metres per second) from the pose, plus walking or running speed, plus the hit
  const v = new Float64Array(N3);
  for (let i = 0; i < N3; i++) v[i] = (s.p[i] - s.o[i]) / dt;
  for (let i = 0; i < RD_N; i++) v[i * 3] += R.vx0;
  rdKick(A, R, s, v);
  // A standing foot is a little lower than a lying one rests (the sole is under the ankle). Its
  // thickness grows in as the body goes down, rather than kicking the body off the ground.
  s.r0 = new Float64Array(RD_N);
  for (let i = 0; i < RD_N; i++) { const g = E.gfn ? E.gfn(s.p[i * 3]) : 0; s.r0[i] = clamp(s.p[i * 3 + 1] - g, -0.1, s.r[i]); }
  s.rf = s.r; s.r = new Float64Array(s.r0);
  for (let i = 0; i < N3; i++) s.o[i] = s.p[i] - v[i] * RDH;
  // Anything the pose already breaks (a seat it overlaps, a joint just past its limit) is put
  // right on both the present and the previous positions, so that putting it right adds no speed.
  const p0 = new Float64Array(s.p);
  // the knees unlock: a standing leg is a straight column that will not fold by itself
  if (!E.seat && !E.car && !/^(kneel|cower)/.test(A.deathPose || '') && R.how !== 'blast' && !s.crush) {
    const kb = (R.part === 'head' ? 0.09 : 0.06) * sc;
    s.p[RD_KNL * 3] += f * kb; s.p[RD_KNR * 3] += f * kb;
  }
  for (let k = 0; k < 12; k++) { rdLinks(s); rdFrames(s); rdLimits(s); rdCollide(s, E); }
  rdLinks(s);
  for (let i = 0; i < N3; i++) s.o[i] += s.p[i] - p0[i];
  s.cn.fill(0);
  // muscle tone: a little resistance to folding, gone a moment after death (none after a head shot)
  s.toneK = R.part === 'head' || R.how !== 'shot' ? 0 : 0.03; s.toneT = 0.12;
  s.toneL = new Float64Array([rdDist(s.p, RD_HPL, RD_FTL), rdDist(s.p, RD_HPR, RD_FTR), rdDist(s.p, RD_HEAD, RD_HPL), rdDist(s.p, RD_HEAD, RD_HPR), rdDist(s.p, RD_FR, RD_FP)]);
  R.s = s;
  return s;
}

// The push. The round shoves the body from the point it hit, in the way it was flying, in
// proportion to its momentum: a .22 barely moves anyone, a .50 knocks them over hard. Legs
// give way (at once for a head shot), and the body starts to topple the way it was going.
function rdKick(A, R, s, v) {
  const p = s.p, f = s.f, sc = s.sc, rng = makeRng(R.seed + 11), add = (i, x, y, z) => { v[i * 3] += x; v[i * 3 + 1] += y; v[i * 3 + 2] += z; };
  const push = (i, J, dx, dy, dz) => { const k = J * s.w[i]; v[i * 3] += dx * k; v[i * 3 + 1] += dy * k; v[i * 3 + 2] += dz * k; };
  const how = R.how, head = R.part === 'head', pw = R.power || 0, E = R.env || {};
  const seated = !!E.seat, kneel = /^(kneel|cower)/.test(A.deathPose || '');
  // which way the body tips in the picture: the game chose front or back for this death
  let dirK = A.deathKind === 'front' ? f : A.deathKind === 'back' ? -f : (rng.f() < 0.5 ? f : -f);
  if (seated) dirK = rng.f() < 0.8 ? f : -f;
  if (Math.abs(R.vx0) > 0.5) dirK = sign(R.vx0); // walking or running: they go down the way they were going
  // a drop close by on one side: they go the other way
  const room0 = -E.x0, room1 = E.x1; if (room0 < 1.6 && room1 > room0) dirK = 1; else if (room1 < 1.6 && room0 > room1) dirK = -1;
  s.lean = dirK;
  const UPPER = [RD_SHL, RD_SHR, RD_FR, RD_HEAD];
  if (how === 'shot' || how === 'npc') {
    // the round: its momentum, of which a round that goes on through only leaves part
    let dx = 0, dy = 0, dz = 1, vi = 340;
    if (R.v) { vi = Math.hypot(R.v[0], R.v[1], R.v[2]) || 1; dx = R.v[0] / vi; dy = R.v[1] / vi; dz = R.v[2] / vi; }
    else if (how === 'npc') { const sd = rng.f() < 0.5 ? -1 : 1; dx = sd * 0.9; dz = 0.4; dirK = sd; s.lean = sd; }
    const J = R.kg * vi * (R.exit ? 0.42 : 1) * (2.4 + 3.4 * pw * pw); // newton seconds, with some help so it reads on screen
    if (head) {
      const jh = Math.min(J * 0.65, 4.2 / s.w[RD_HEAD]), jr = J - jh;
      push(RD_HEAD, jh, dx, dy, dz); push(RD_SHL, jr * 0.5, dx, dy, dz); push(RD_SHR, jr * 0.5, dx, dy, dz);
    } else {
      // spread over the trunk by where it went in: high up pushes the chest, low down the pelvis
      const hx = (p[6] + p[9]) / 2, hy = (p[7] + p[10]) / 2, ux = (p[0] + p[3]) / 2 - hx, uy = (p[1] + p[4]) / 2 - hy, ul2 = ux * ux + uy * uy || 1;
      const tt = clamp(((R.hx - hx) * ux + (R.hy - hy) * uy) / ul2, 0, 1.1);
      const front = clamp(((R.hx - hx) * uy * f - (R.hy - hy) * ux * f) / (Math.sqrt(ul2) * 0.1), -1, 1);
      const wc = clamp((tt - 0.25) / 0.6, 0, 1), wp = clamp((0.75 - tt) / 0.6, 0, 1), wm = Math.max(0, 1 - Math.abs(tt - 0.5) * 2.5), sum = wc + wp + wm || 1;
      const fr = 0.15 + 0.25 * Math.max(0, front);
      push(RD_SHL, J * wc / sum * (1 - fr) / 2, dx, dy, dz); push(RD_SHR, J * wc / sum * (1 - fr) / 2, dx, dy, dz); push(RD_FR, J * wc / sum * fr, dx, dy, dz);
      push(RD_HPL, J * wp / sum * (1 - fr) / 2, dx, dy, dz); push(RD_HPR, J * wp / sum * (1 - fr) / 2, dx, dy, dz); push(RD_FP, J * wp / sum * fr, dx, dy, dz);
      push(RD_SP, J * wm / sum, dx, dy, dz);
    }
    // a heavy round also knocks them over sideways in the picture, the way they were going to fall
    const top = (head ? 0.2 : 0.3) + 1.25 * pw * pw * pw;
    for (const i of UPPER) add(i, dirK * top, 0, 0);
  } else if (how === 'blast') {
    if (!R.src) R.src = { x: -1.6 * dirK, y: 0.4, r: 4.5, w: 0, h: 0, floor: 0 }; // somewhere close, on the side they fall away from
    // A blast throws everyone away from it and up, and takes the legs out from under them first,
    // so the body turns over as it goes rather than flying off stiff.
    const sr = R.src, R0 = Math.max(1, sr.r), cx = (p[6] + p[9]) / 2, cy = (p[7] + p[10]) / 2 + 0.25 * sc;
    const ex = cx - sr.x, ey = cy - sr.y, d = Math.hypot(ex, ey) || 1, k = clamp(1 - d / (R0 * 1.3), 0.2, 1), away = ex < 0 ? -1 : 1;
    const vx = (ex / d) * (1.5 + 2.2 * k), vy = 0.8 + 1.5 * k, spin = away * (3 + 3.5 * k); // turning (radians a second): feet away from the blast first
    for (let i = 0; i < RD_N; i++) { const rx = p[i * 3] - cx, ry = p[i * 3 + 1] - cy, limb = i >= RD_ELL && i <= RD_FTR ? 1.6 : 0.3; add(i, vx - spin * ry + (rng.f() - 0.5) * limb, vy + spin * rx + (rng.f() - 0.5) * limb, (rng.f() - 0.5) * 0.5); } // arms and legs flail on their own
    s.lean = away;
  } else if (how === 'accident' && R.src && !A.inVeh) {
    // crushed by a falling load: everything under it goes down at once
    for (let i = 0; i < RD_N; i++) add(i, (p[i * 3] - R.src.x) * 1.5, -7, 0);
  } else {
    for (const i of UPPER) add(i, dirK * 0.25, 0, 0);
  }
  // The legs go: everything above the knees starts down, and the knees, which can only bend
  // one way, go forward to let it. At once and hard for a head shot.
  if (!seated && !kneel && how !== 'blast' && !(how === 'accident' && R.src)) {
    const vb = head ? 1.1 : 0.45 + 0.15 * rng.f(), side = 0.8 + 0.4 * rng.f();
    for (let i = 0; i < RD_N; i++) if (i !== RD_KNL && i !== RD_KNR && i !== RD_FTL && i !== RD_FTR) add(i, 0, -vb, 0);
    add(RD_KNL, f * vb * 0.5 * side, -vb * 0.5, 0); add(RD_KNR, f * vb * 0.5 * (2 - side), -vb * 0.5, 0);
  }
  // which way the knees will flop over once the body is down
  const kz = (rng.f() < 0.5 ? -1 : 1) * (0.1 + 0.1 * rng.f());
  add(RD_KNL, 0, 0, kz); add(RD_KNR, 0, 0, kz * (rng.f() < 0.7 ? 1 : -1));
  // a car that stops throws the people in it forward
  if (R.car) {
    const lurch = clamp(R.car.v0 * 0.12, 0, 1.3) + 0.3;
    for (let i = 0; i < RD_N; i++) if (i <= RD_HAR || i >= RD_FP) add(i, R.car.dir * lurch * (i === RD_HEAD ? 1.2 : i >= RD_ELL ? 1 : 0.8), 0, 0);
    s.carF = R.car.v0 > 0.5 ? { a: 5 * R.car.dir, until: R.car.v0 / 9 } : null; // the car brakes; the body, held by the seat, feels some of it
  }
}

// ---- one step ------------------------------------------------------------------------------
function rdStep(R) {
  const s = R.s, p = s.p, o = s.o, w = s.w, h2 = RDH * RDH;
  let ax = 0;
  if (s.carF && s.t < s.carF.until) ax = s.carF.a;
  // energy at the start of the step (movement plus height), in the solver's own units
  let e0 = 0;
  for (let i = 0; i < RD_N * 3; i += 3) {
    const m = 1 / w[i / 3], vx = (p[i] - o[i]) * 0.999, vy = (p[i + 1] - o[i + 1]) * 0.999, vz = (p[i + 2] - o[i + 2]) * 0.999;
    e0 += m * (0.5 * (vx * vx + vy * vy + vz * vz) + 9.81 * h2 * p[i + 1] - ax * h2 * p[i]);
    o[i] = p[i]; o[i + 1] = p[i + 1]; o[i + 2] = p[i + 2];
    p[i] += vx + ax * h2; p[i + 1] += vy - 9.81 * h2; p[i + 2] += vz;
  }
  s.cn.fill(0);
  if (s.t < 0.6) { const k = smooth(s.t / 0.5); for (let i = 0; i < RD_N; i++) s.r[i] = lerp(s.r0[i], s.rf[i], k); }
  if (s.landT !== null && s.legSide < 0.85) s.legSide = Math.min(0.85, s.legSide + RDH * 0.6);
  rdTone(s); rdFlat(s);
  for (let it = 0; it < RD_ITER; it++) {
    rdLinks(s);
    if (!(it & 1)) { rdFrames(s); rdLimits(s); } // the joints every other pass: they change slowly
    rdCollide(s, R.env);
  }
  rdFriction(s, R.env);
  // A step may lose energy (the floor, friction, the joints) but never gain it: when the many
  // little corrections disagree they can push a body about, and a dead body does not bounce.
  let ke = 0, pe = 0;
  for (let i = 0; i < RD_N * 3; i += 3) { const m = 1 / w[i / 3], vx = p[i] - o[i], vy = p[i + 1] - o[i + 1], vz = p[i + 2] - o[i + 2]; ke += m * 0.5 * (vx * vx + vy * vy + vz * vz); pe += m * (9.81 * h2 * p[i + 1] - ax * h2 * p[i]); }
  if (ke > 1e-12 && ke + pe > e0) {
    const k = Math.sqrt(clamp((e0 - pe) / ke, 0, 1));
    for (let i = 0; i < RD_N * 3; i++) o[i] = p[i] - (p[i] - o[i]) * k;
  }
  s.t += RDH;
  rdWatch(R, s);
}
function rdLinks(s) {
  const p = s.p, w = s.w, lo = s.lo, hi = s.hi;
  // every length once, then the chest and pelvis again, so they stay solid under a hard push
  for (let n = 0; n < RD_NL + RD_NTRUNK; n++) {
    const k = n < RD_NL ? n : n - RD_NL;
    const a = RD_LINK[k * 2], b = RD_LINK[k * 2 + 1], i = a * 3, j = b * 3, wi = w[a], wj = w[b];
    const dx = p[j] - p[i], dy = p[j + 1] - p[i + 1], dz = p[j + 2] - p[i + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 1e-9) continue;
    const L = d < lo[k] ? lo[k] : d > hi[k] ? hi[k] : d; if (L === d) continue;
    const c = (d - L) / (d * (wi + wj));
    p[i] += dx * c * wi; p[i + 1] += dy * c * wi; p[i + 2] += dz * c * wi;
    p[j] -= dx * c * wj; p[j + 1] -= dy * c * wj; p[j + 2] -= dz * c * wj;
  }
}
// The chest's and the pelvis's own directions: U up the spine, S toward the person's left, F
// out of the front. (F = U x S.)
function rdFrame(p, ux, uy, uz, sx, sy, sz, U, S, F) {
  let l = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1; ux /= l; uy /= l; uz /= l;
  const d = sx * ux + sy * uy + sz * uz; sx -= ux * d; sy -= uy * d; sz -= uz * d;
  l = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1; sx /= l; sy /= l; sz /= l;
  U[0] = ux; U[1] = uy; U[2] = uz; S[0] = sx; S[1] = sy; S[2] = sz;
  F[0] = uy * sz - uz * sy; F[1] = uz * sx - ux * sz; F[2] = ux * sy - uy * sx;
}
function rdFrames(s) {
  const p = s.p, m = RD_SP * 3;
  rdFrame(p, (p[0] + p[3]) / 2 - p[m], (p[1] + p[4]) / 2 - p[m + 1], (p[2] + p[5]) / 2 - p[m + 2], p[0] - p[3], p[1] - p[4], p[2] - p[5], s.Uc, s.Sc, s.Fc);
  rdFrame(p, p[m] - (p[6] + p[9]) / 2, p[m + 1] - (p[7] + p[10]) / 2, p[m + 2] - (p[8] + p[11]) / 2, p[6] - p[9], p[7] - p[10], p[8] - p[11], s.Up, s.Sp, s.Fp);
}
// Is angle a inside lo..hi (hi may be past half a turn)? If not, the nearer end.
function rdWrap(a, lo, hi) {
  let x = a; if (x < lo) x += TAU; if (x <= hi) return a;
  const dLo = Math.abs(Math.atan2(Math.sin(a - lo), Math.cos(a - lo))), dHi = Math.abs(Math.atan2(Math.sin(a - hi), Math.cos(a - hi)));
  return dLo < dHi ? lo : hi;
}
// Move the end c of a segment from j to where it should be (n, already the segment's length),
// sharing the move with j so the push and its answer balance. c2 hangs below c and goes with it.
function rdPut(p, j, c, c2, nx, ny, nz, share) {
  const j3 = j * 3, c3 = c * 3, ex = p[j3] + nx - p[c3], ey = p[j3 + 1] + ny - p[c3 + 1], ez = p[j3 + 2] + nz - p[c3 + 2], b = 1 - share;
  p[c3] += ex * share; p[c3 + 1] += ey * share; p[c3 + 2] += ez * share;
  if (c2 >= 0) { const q = c2 * 3; p[q] += ex * share; p[q + 1] += ey * share; p[q + 2] += ez * share; }
  p[j3] -= ex * b; p[j3 + 1] -= ey * b; p[j3 + 2] -= ez * b;
}
// A ball joint (hip, shoulder): the limb may swing forward and back between lo and hi (0 is
// straight down the trunk, positive is forward) and only so far out to the side.
function rdBall(s, j, c, c2, U, S, F, lo, hi, side, share) {
  const p = s.p, j3 = j * 3, c3 = c * 3, cx = p[c3] - p[j3], cy = p[c3 + 1] - p[j3 + 1], cz = p[c3 + 2] - p[j3 + 2];
  const L = Math.sqrt(cx * cx + cy * cy + cz * cz); if (L < 1e-6) return;
  let nd = -(cx * U[0] + cy * U[1] + cz * U[2]), nf = cx * F[0] + cy * F[1] + cz * F[2], cs = cx * S[0] + cy * S[1] + cz * S[2];
  const cl = Math.sqrt(nd * nd + nf * nf); let moved = false;
  if (cl > 0.2 * L) { const ang = Math.atan2(nf, nd), tg = rdWrap(ang, lo, hi); if (tg !== ang) { nd = Math.cos(tg) * cl; nf = Math.sin(tg) * cl; moved = true; } }
  if (Math.abs(cs) > side * L) { cs = (cs < 0 ? -side : side) * L; moved = true; }
  if (!moved) return;
  const nx = -U[0] * nd + F[0] * nf + S[0] * cs, ny = -U[1] * nd + F[1] * nf + S[1] * cs, nz = -U[2] * nd + F[2] * nf + S[2] * cs, k = L / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
  rdPut(p, j, c, c2, nx * k, ny * k, nz * k, share);
}
// A hinge (knee, elbow): the lower part may turn between lo and hi from the line of the upper
// part (a, j), about the trunk's side axis; positive is forward when the limb hangs down.
function rdHinge(s, a, j, c, S, lo, hi, side, share) {
  const p = s.p, a3 = a * 3, j3 = j * 3, c3 = c * 3;
  let ux = p[j3] - p[a3], uy = p[j3 + 1] - p[a3 + 1], uz = p[j3 + 2] - p[a3 + 2]; const ul = Math.sqrt(ux * ux + uy * uy + uz * uz); if (ul < 1e-6) return; ux /= ul; uy /= ul; uz /= ul;
  const d = S[0] * ux + S[1] * uy + S[2] * uz; let kx = S[0] - ux * d, ky = S[1] - uy * d, kz = S[2] - uz * d; const kl = Math.sqrt(kx * kx + ky * ky + kz * kz); if (kl < 0.3) return; kx /= kl; ky /= kl; kz /= kl;
  const vx = ky * uz - kz * uy, vy = kz * ux - kx * uz, vz = kx * uy - ky * ux; // the way the joint opens: k x u
  const cx = p[c3] - p[j3], cy = p[c3 + 1] - p[j3 + 1], cz = p[c3 + 2] - p[j3 + 2], L = Math.sqrt(cx * cx + cy * cy + cz * cz); if (L < 1e-6) return;
  let cu = cx * ux + cy * uy + cz * uz, cv = cx * vx + cy * vy + cz * vz, ck = cx * kx + cy * ky + cz * kz;
  const cl = Math.sqrt(cu * cu + cv * cv); let moved = false;
  if (cl > 0.2 * L) { const ang = Math.atan2(cv, cu), tg = rdWrap(ang, lo, hi); if (tg !== ang) { cu = Math.cos(tg) * cl; cv = Math.sin(tg) * cl; moved = true; } }
  if (Math.abs(ck) > side * L) { ck = (ck < 0 ? -side : side) * L; moved = true; }
  if (!moved) return;
  const nx = ux * cu + vx * cv + kx * ck, ny = uy * cu + vy * cv + ky * ck, nz = uz * cu + vz * cv + kz * ck, k = L / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
  rdPut(p, j, c, -1, nx * k, ny * k, nz * k, share);
}
function rdLimits(s) {
  const ls = s.legSide;
  // hips: thighs swing forward a long way and back a little, and (once down) flop out to the side
  rdBall(s, RD_HPL, RD_KNL, RD_FTL, s.Up, s.Sp, s.Fp, -0.9, 2.55, ls, 0.8); rdBall(s, RD_HPR, RD_KNR, RD_FTR, s.Up, s.Sp, s.Fp, -0.9, 2.55, ls, 0.8);
  // knees bend backward only
  rdHinge(s, RD_HPL, RD_KNL, RD_FTL, s.Sp, -2.55, 0, 0.25, 0.64); rdHinge(s, RD_HPR, RD_KNR, RD_FTR, s.Sp, -2.55, 0, 0.25, 0.64);
  // shoulders reach most ways but not far behind the back
  rdBall(s, RD_SHL, RD_ELL, RD_HAL, s.Uc, s.Sc, s.Fc, -1.1, 3.35, 0.85, 0.9); rdBall(s, RD_SHR, RD_ELR, RD_HAR, s.Uc, s.Sc, s.Fc, -1.1, 3.35, 0.85, 0.9);
  // elbows bend forward only
  rdHinge(s, RD_SHL, RD_ELL, RD_HAL, s.Sc, 0, 2.6, 0.35, 0.58); rdHinge(s, RD_SHR, RD_ELR, RD_HAR, s.Sc, 0, 2.6, 0.35, 0.58);
  // the neck: chin to chest, a little way back, hardly at all to the side
  rdNeck(s);
}
function rdNeck(s) {
  const p = s.p, U = s.Uc, S = s.Sc, F = s.Fc, sc = s.sc;
  const nx = (p[0] + p[3]) / 2 + U[0] * 0.05 * sc, ny = (p[1] + p[4]) / 2 + U[1] * 0.05 * sc, nz = (p[2] + p[5]) / 2 + U[2] * 0.05 * sc; // the base of the neck
  const q = RD_HEAD * 3, vx = p[q] - nx, vy = p[q + 1] - ny, vz = p[q + 2] - nz;
  let cu = vx * U[0] + vy * U[1] + vz * U[2], cf = vx * F[0] + vy * F[1] + vz * F[2], cs = vx * S[0] + vy * S[1] + vz * S[2];
  const ang = Math.atan2(cf, cu), tg = clamp(ang, -0.65, 1.15), sm = 0.056 * sc;
  if (tg === ang && Math.abs(cs) <= sm) return;
  const cl = Math.sqrt(cu * cu + cf * cf) || 0.2 * sc; cu = Math.cos(tg) * cl; cf = Math.sin(tg) * cl; cs = clamp(cs, -sm, sm);
  const ex = nx + U[0] * cu + F[0] * cf + S[0] * cs - p[q], ey = ny + U[1] * cu + F[1] * cf + S[1] * cs - p[q + 1], ez = nz + U[2] * cu + F[2] * cf + S[2] * cs - p[q + 2];
  // the head gives most of the way, the shoulders the rest (so the push and its answer balance)
  p[q] += ex * 0.77; p[q + 1] += ey * 0.77; p[q + 2] += ez * 0.77;
  for (let i = 0; i < 2; i++) { p[i * 3] -= ex * 0.23; p[i * 3 + 1] -= ey * 0.23; p[i * 3 + 2] -= ez * 0.23; }
}
// The body stays side on to the scope: the spread of its points toward and away from the
// shooter is eased back to how it was, slowly at first so the push of the round still shows.
// Moving away from the shooter as a whole is kept. Knees and elbows may flop over.
function rdFlat(s) {
  const p = s.p, w = s.w, z0 = s.z0;
  let m = 0, zc = 0; for (let i = 0; i < RD_N; i++) { const mi = 1 / w[i]; m += mi; zc += mi * p[i * 3 + 2]; } zc /= m;
  const k = 0.0025 + 0.03 * smooth(s.t / 1.1);
  for (let i = 0; i < RD_N; i++) { const q = i * 3 + 2; p[q] += (zc + z0[i] - p[q]) * k * RD_FLATK[i]; }
}
// What is left of the muscles for a moment after death: the legs, the neck and the spine resist folding.
const RD_TONE = [RD_HPL, RD_FTL, RD_HPR, RD_FTR, RD_HEAD, RD_HPL, RD_HEAD, RD_HPR, RD_FR, RD_FP];
function rdTone(s) {
  const k = s.toneK * Math.exp(-s.t / s.toneT); if (k < 0.002) return;
  const p = s.p, w = s.w, L = s.toneL;
  for (let n = 0; n < 5; n++) {
    const a = RD_TONE[n * 2], b = RD_TONE[n * 2 + 1], i = a * 3, j = b * 3, wi = w[a], wj = w[b];
    const dx = p[j] - p[i], dy = p[j + 1] - p[i + 1], dz = p[j + 2] - p[i + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d < 1e-9) continue;
    const c = ((d - L[n]) / (d * (wi + wj))) * k;
    p[i] += dx * c * wi; p[i + 1] += dy * c * wi; p[i + 2] += dz * c * wi; p[j] -= dx * c * wj; p[j + 1] -= dy * c * wj; p[j + 2] -= dz * c * wj;
  }
}
// The floor, its ends, the walls beside, the seat, the desk, the car, a falling load.
function rdCollide(s, E) {
  const p = s.p, o = s.o, r = s.r, cn = s.cn, f = s.f, seat = E.seat, desk = E.desk, car = E.car, rail = E.rail, back = E.back, boxes = E.boxes;
  for (let i = 0; i < RD_N; i++) {
    const q = i * 3, ri = r[i];
    let x = p[q], y = p[q + 1];
    // the ends of the floor (a drop, the end of a quay or a balcony): nothing goes past them
    if (x < E.x0 + ri * 0.5) x = E.x0 + ri * 0.5; else if (x > E.x1 - ri * 0.5) x = E.x1 - ri * 0.5;
    // the floor itself
    const g = E.gfn ? E.gfn(x) : 0;
    if (y < g + ri) { cn[i] += g + ri - y; y = g + ri; }
    // walls and things beside: pushed out sideways, or onto the top if it is low
    for (let b = 0; b < boxes.length; b++) {
      const B = boxes[b];
      if (x <= B[0] - ri || x >= B[2] + ri || y <= B[1] - ri || y >= B[3] + ri) continue;
      const dl = x - (B[0] - ri), dr = B[2] + ri - x, dt = B[3] + ri - y;
      if (dt < dl && dt < dr) { cn[i] += dt; y = B[3] + ri; } else if (dl < dr) x = B[0] - ri; else x = B[2] + ri;
    }
    const lx = x * f, trunk = i <= RD_FR || i === RD_HEAD || i >= RD_FP; // forward of where they sat
    // a seat holds up whatever comes down on it (and always the pelvis); from the side it is not in the way
    if (seat && lx > seat.x0 && lx < seat.x1 && y < seat.top + ri && (o[q + 1] >= seat.top + ri * 0.4 || i === RD_HPL || i === RD_HPR || i === RD_FP)) { cn[i] += seat.top + ri - y; y = seat.top + ri; }
    if (back !== null && back !== undefined && trunk && y > (seat ? seat.top : 0.4) && lx < back) x = back * f;
    if (desk && lx > desk.x0 - ri && lx < desk.x1 && y < desk.top + ri && o[q + 1] >= desk.top - 0.02) { cn[i] += desk.top + ri - y; y = desk.top + ri; }
    if (rail && i !== RD_FTL && i !== RD_FTR && i !== RD_KNL && i !== RD_KNR && y < rail.top && lx > rail.x - ri && o[q] * f <= rail.x) x = (rail.x - ri) * f;
    // in a car: the seat back behind, the dashboard in front (the legs go on under it), the roof above
    if (car) { const hi = y > car.dash ? car.hi : car.well; if (lx < car.lo) x = car.lo * f; else if (lx > hi) { cn[i] += lx - hi; x = hi * f; } if (y < car.floor + ri) { cn[i] += car.floor + ri - y; y = car.floor + ri; } else if (y > car.roof - ri) y = car.roof - ri; }
    if (s.crush && x > s.crush.x0 && x < s.crush.x1 && y > s.crush.top) y = s.crush.top;
    p[q] = x; p[q + 1] = y;
  }
  // never further than RD_SLIDE from where they stood
  const hx = (p[6] + p[9]) / 2, hz = (p[8] + p[11]) / 2;
  const ox = hx > RD_SLIDE ? RD_SLIDE - hx : hx < -RD_SLIDE ? -RD_SLIDE - hx : 0, oz = hz > 0.7 ? 0.7 - hz : hz < -0.7 ? -0.7 - hz : 0;
  if (ox || oz) for (let i = 0; i < RD_N; i++) { p[i * 3] += ox; p[i * 3 + 2] += oz; }
}
// Friction where a point is pressed on something: it can only slide so far for how hard it is pressed.
function rdFriction(s, E) {
  const p = s.p, o = s.o, cn = s.cn, mu = E.mat === 'snow' || E.mat === 'water' ? 0.35 : E.mat === 'metal' ? 0.45 : 0.62;
  for (let i = 0; i < RD_N; i++) {
    if (cn[i] <= 0) continue;
    const q = i * 3, dx = p[q] - o[q], dz = p[q + 2] - o[q + 2], d = Math.sqrt(dx * dx + dz * dz); if (d < 1e-9) continue;
    const k = Math.min(1, ((i === RD_HAL || i === RD_HAR || i === RD_ELL || i === RD_ELR ? 0.4 : 1) * mu * cn[i] + 0.00004) / d); // a limp arm slides easily
    p[q] -= dx * k; p[q + 2] -= dz * k;
  }
}
// Note when the body hits the ground and when it has stopped moving.
const RD_LAND = [RD_SHL, RD_SHR, RD_HPL, RD_HPR, RD_FR, RD_HEAD, RD_FP, RD_SP];
function rdWatch(R, s) {
  const p = s.p, o = s.o, cn = s.cn;
  if (s.landT === null && s.t > 0.05) {
    // the trunk or the head meeting something hard on the way down (for somebody sitting, the
    // pelvis is on the seat all along, so only the chest and head count: the desk, the dashboard)
    const sat = !!(R.env.seat || R.env.car);
    let hit = 0; for (let k = 0; k < RD_LAND.length; k++) { const i = RD_LAND[k]; if (sat && (i === RD_HPL || i === RD_HPR || i === RD_FP)) continue; if (cn[i] > hit) hit = cn[i]; }
    const hy = (p[7] + p[10]) / 2;
    if (hit > 0.0012 && (sat || hy < 0.45 * s.sc)) { s.landT = s.t; s.landV = hit / RDH; }
  }
  let vmax = 0; for (let i = 0; i < RD_N * 3; i += 3) { const v = Math.abs(p[i] - o[i]) + Math.abs(p[i + 1] - o[i + 1]) + Math.abs(p[i + 2] - o[i + 2]); if (v > vmax) vmax = v; }
  if (vmax / RDH < 0.035) s.quiet += RDH; else s.quiet = 0;
  if ((s.quiet > 0.3 && s.t > 0.7) || s.t > 5) { s.sleep = true; if (s.landT === null) { s.landT = s.t; s.landV = 0.5; } o.set(p); }
}

// ---- reading it ---------------------------------------------------------------------------
// The joints at time T after death, as actorJoints returns them (local, scaled, already
// facing the right way) plus j3: every point in 3D for the kill camera, followed by the hips,
// the shoulders and the neck.
let rdLead = 0; // the part of a step the scope picture is ahead of the world, so a slow-motion fall is smooth
function rdJoints(A, T) {
  let R = A.rd; if (!R) R = A.rd = rdDefault(A);
  let s = R.s;
  if (!s || T < s.t - RDH * 2.5) s = rdInit(A, R); // first look, or the clock went back (test pictures only)
  let n = 0; const lim = 5.2;
  while (!s.sleep && s.t + RDH * 0.5 <= Math.min(T, lim) && n++ < 2400) rdStep(R);
  if (!s.sleep && T > lim && s.t >= lim - RDH) { s.sleep = true; s.o.set(s.p); }
  // asleep: the same joints every time, worked out once (a body in a car still rides along with it)
  if (s.sleep && s.outDone && !A.inVeh) return s.out;
  const J = rdOut(A, s, s.sleep ? 1 : clamp((T - (s.t - RDH)) / RDH, 0, 1));
  if (s.sleep) s.outDone = true;
  return J;
}
function rdOut(A, s, q) {
  let J = s.out;
  if (!J) J = s.out = { hip: [0, 0], neck: [0, 0], head: [0, 0], sh: [0, 0], knL: [0, 0], ftL: [0, 0], knR: [0, 0], ftR: [0, 0], elL: [0, 0], haL: [0, 0], elR: [0, 0], haR: [0, 0], scale: s.sc, f: s.f, j3: new Float64Array(RD_N * 3 + 9), rd: true };
  const p = s.p, o = s.o, j3 = J.j3;
  // a body in a car rides along with the car, which may still be rolling to a stop
  let dx = 0, dy = 0;
  if (A.inVeh && A.inVeh.def) { const v = A.inVeh, c = v.def; dx = v.x + v.dir * c.seats[A.seat || 0] * c.len - A.x; dy = v.y + (c.body + c.h) / 2 - 1.2 - A.y; }
  for (let i = 0; i < RD_N * 3; i += 3) { j3[i] = o[i] + (p[i] - o[i]) * q + dx; j3[i + 1] = o[i + 1] + (p[i + 1] - o[i + 1]) * q + dy; j3[i + 2] = o[i + 2] + (p[i + 2] - o[i + 2]) * q; }
  // the hips, the shoulders, and the neck a little above the shoulders along the chest
  const H = RD_N * 3, m = RD_SP * 3;
  for (let k = 0; k < 3; k++) { j3[H + k] = (j3[6 + k] + j3[9 + k]) / 2; j3[H + 3 + k] = (j3[k] + j3[3 + k]) / 2; }
  let ux = j3[H + 3] - j3[m], uy = j3[H + 4] - j3[m + 1], uz = j3[H + 5] - j3[m + 2]; const ul = (Math.sqrt(ux * ux + uy * uy + uz * uz) || 1) / (0.05 * s.sc);
  j3[H + 6] = j3[H + 3] + ux / ul; j3[H + 7] = j3[H + 4] + uy / ul; j3[H + 8] = j3[H + 5] + uz / ul;
  const put = (a, i) => { a[0] = j3[i * 3]; a[1] = j3[i * 3 + 1]; };
  J.hip[0] = j3[H]; J.hip[1] = j3[H + 1]; J.sh[0] = j3[H + 3]; J.sh[1] = j3[H + 4]; J.neck[0] = j3[H + 6]; J.neck[1] = j3[H + 7];
  put(J.head, RD_HEAD); put(J.elL, RD_ELL); put(J.haL, RD_HAL); put(J.elR, RD_ELR); put(J.haR, RD_HAR);
  put(J.knL, RD_KNL); put(J.ftL, RD_FTL); put(J.knR, RD_KNR); put(J.ftR, RD_FTR);
  J.scale = s.sc; J.f = s.f;
  return J;
}
// Has the body hit the ground yet (by time T after death), and how hard? For the sound.
function rdLanded(A, T) { const R = A.rd, s = R && R.s; return s && s.landT !== null && T >= s.landT ? { t: s.landT, v: s.landV, mat: R.env ? R.env.mat : 'dirt' } : null; }

CB.Ragdoll = { note: rdNote, joints: rdJoints, landed: rdLanded, exits: rdExits, exitSize: rdExitSize, power: rdPower, cal: rdCal, step: RDH, N: RD_N };
