// ---------------------------------------------------------------------------
// Somebody hit in an arm or a leg who is still on their feet. Picture only: the
// simulation decides how they move (and how fast); this only changes how they look.
//   a flinch      the body jerks away from the hit for a moment
//   a hand        pressed to the wound (the other hand, if it is an arm), and kept there
//   a stain       spreading from the hole along the sleeve or trouser leg
//   a trail       drops left on the ground behind them wherever they go
// The view notes the wound when the round lands (figNoteWound, from src/06b_hitfx.js).
// ---------------------------------------------------------------------------

// the limb segments a round can wound: [from joint, to joint, which side]
const FIG_WSEG = [['hip', 'knL', 'L'], ['knL', 'ftL', 'L'], ['hip', 'knR', 'R'], ['knR', 'ftR', 'R'], ['sh', 'elL', 'L'], ['elL', 'haL', 'L'], ['sh', 'elR', 'R'], ['elR', 'haR', 'R']];

function figNoteWound(a, part, lx, ly, t) {
  const J = actorJoints(a), sc = J.scale || 1;
  let best = null, bd = 9;
  for (let i = 0; i < FIG_WSEG.length; i++) {
    const S = FIG_WSEG[i], arm = i >= 4; if ((part === 'arm') !== arm) continue;
    const p = J[S[0]], q = J[S[1]], dx = q[0] - p[0], dy = q[1] - p[1], l2 = dx * dx + dy * dy || 1, u = clamp(((lx - p[0]) * dx + (ly - p[1]) * dy) / l2, 0.1, 0.9);
    const d = Math.hypot(lx - p[0] - dx * u, ly - p[1] - dy * u); if (d < bd) { bd = d; best = { seg: i, u }; }
  }
  if (!best) best = { seg: part === 'arm' ? 6 : 2, u: 0.5 };
  a.woundFx = { part, seg: best.seg, u: best.u, t, at: a.t, trail: [], lastX: a.x, sc };
  a._woundT = a.t;
}

// Changes the joints about to be drawn (G.*, the figure's own unscaled space) for the flinch and the hand.
function figWounded(A, G, an) {
  const W = A.woundFx; if (!W || A.dead) return;
  const T = (A.t || 0) - W.at; if (T < 0) return;
  // the flinch: the upper body jerks back from the hit and comes back, in a third of a second
  const fl = Math.exp(-T * 7) * Math.sin(Math.min(T, 0.45) * 15) * 0.22;
  if (Math.abs(fl) > 0.004) {
    const hx = G.hip[0], hy = G.hip[1], cs = Math.cos(fl * G.fs), sn = Math.sin(fl * G.fs);
    for (const k of ['neck', 'head', 'sh', 'elL', 'haL', 'elR', 'haR']) { const p = G[k], x = p[0] - hx, y = p[1] - hy; p[0] = hx + x * cs - y * sn; p[1] = hy + x * sn + y * cs; }
  }
  // the hand to the wound: the other hand for an arm, the far hand for a leg (the near one may be carrying)
  const S = FIG_WSEG[W.seg], hand = S[2] === 'L' && W.part === 'arm' ? 'R' : 'L', k = smooth((T - 0.15) / 0.3);
  if (k <= 0 || (hand === 'R' && G.L.bag && FIG_HAND_BAGS[G.L.bag] === 1)) return;
  const busy = an === 'aim' || an === 'aimrifle' || an === 'guard' || an === 'phone' || an === 'hands' || an === 'climb';
  if (busy) return;
  const p = G[S[0]], q = G[S[1]], tx = lerp(p[0], q[0], W.u), ty = lerp(p[1], q[1], W.u);
  const el = G['el' + hand], ha = G['ha' + hand], sh = G.sh;
  // reach from the shoulder to the wound (two equal bones; the elbow bends back, away from the face)
  let dx = tx - sh[0], dy = ty - sh[1]; const d = Math.hypot(dx, dy) || 1, L = FIG.arm, reach = Math.min(d, 2 * L - 0.01);
  dx /= d; dy /= d;
  // the elbow bends down (and a little forward), so a short reach folds the arm across the body
  let bx = -dy, by = dx; if (-by + bx * G.fs * 0.9 < 0) { bx = -bx; by = -by; }
  const ex = (reach / 2), ey = Math.sqrt(Math.max(0, L * L - ex * ex));
  // (a short reach would throw the elbow out level with the shoulder: it is tucked in lower, as a held arm is)
  const tuck = clamp((0.4 - reach) / 0.3, 0, 1), nx = sh[0] + dx * ex + bx * ey * (1 - 0.45 * tuck), ny = sh[1] + dy * ex + by * ey - 0.12 * tuck, hx = sh[0] + dx * reach, hy = sh[1] + dy * reach;
  el[0] = lerp(el[0], nx, k); el[1] = lerp(el[1], ny, k); ha[0] = lerp(ha[0], hx, k); ha[1] = lerp(ha[1], hy, k);
  G.pressHand = hand;
}

// The stain on the sleeve or trouser leg: from the hole, running down the limb, darker as it soaks.
function figWoundStain(c, G) {
  const A = G.A, W = A.woundFx; if (!W || A.dead || !G.hi || G.env.gore === false) return;
  const T = (A.t || 0) - W.at, S = FIG_WSEG[W.seg], p = G[S[0]], q = G[S[1]];
  const x = lerp(p[0], q[0], W.u), y = lerp(p[1], q[1], W.u), grow = 1 - Math.exp(-T / 5), down = Math.min(1 - W.u, 0.15 + 0.5 * grow);
  const x2 = lerp(p[0], q[0], W.u + down), y2 = lerp(p[1], q[1], W.u + down), w = (W.part === 'arm' ? 0.034 : 0.046) * G.bw;
  c.lineCap = 'round';
  c.strokeStyle = figC('#4d070c'); c.globalAlpha = 0.85; c.lineWidth = w * (1.4 + 0.5 * grow); c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
  c.globalAlpha = 1; c.fillStyle = figC('#9e1420'); c.beginPath(); c.arc(x, y, w * 0.45, 0, TAU); c.fill();
  // drops from the end of a hanging arm or the hem of a trouser leg, now and then
  if (G.fine) { const ph = (A.t * 1.3 + G.seed) % 1, dx = q[0], dy = q[1] - 0.02 - ph * 0.5; if (ph < 0.6 && dy > 0.02) { c.fillStyle = figC('#7a0d15'); c.beginPath(); c.arc(dx, dy, 0.012, 0, TAU); c.fill(); } }
}

// The trail: a drop on the ground every so often as they move, left where it fell. Drawn whether
// or not the person is still in the picture, in the person's own frame (ctx is in plane metres).
function figBloodTrail(ctx, A, env) {
  const W = A.woundFx; if (!W || env.gore === false) return;
  if (!A.dead && Math.abs(A.x - W.lastX) > 0.32 && W.trail.length < 90) {
    const r = makeRng(W.trail.length * 131 + 7);
    W.trail.push(A.x + (r.f() - 0.5) * 0.12, A.y, 0.018 + 0.022 * r.f(), r.f()); W.lastX = A.x;
  }
  const t = W.trail; if (!t.length) return;
  const px = env.px;
  if (1 / px < 3) return; // too far off to see a drop of blood
  ctx.fillStyle = mix('#4a070c', '#05070b', env.dim || 0); ctx.beginPath();
  for (let i = 0; i < t.length; i += 4) {
    const x = t[i], y = t[i + 1], r = t[i + 2];
    if (x < env.x0 - 1 || x > env.x1 + 1) continue;
    ctx.moveTo(x + r * 1.5, y + 0.004); ctx.ellipse(x, y + 0.004, r * 1.5, Math.max(px * 0.6, r * 0.35), 0, 0, TAU);
    if (t[i + 3] > 0.6) { ctx.moveTo(x + r * 2 + r * 0.5, y + 0.004); ctx.ellipse(x + r * 2, y + 0.004, r * 0.5, Math.max(px * 0.5, r * 0.18), 0, 0, TAU); }
  }
  ctx.fill();
}
CB.fig.noteWound = figNoteWound; // (for the test pictures)
