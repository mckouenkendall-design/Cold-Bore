// ---------------------------------------------------------------------------
// The kill camera (placeholder version: a plain chase camera behind the round).
//
// Contract with the game loop (src/20_game.js):
//   KillCam.start(o)      begin. o = { sim, view, gunId, cfg, bullet, path, t0, tHit, hit,
//                         actor, kills, gore, step }. Return false to decline.
//   KillCam.advance(dt)   dt = real seconds since last frame. Returns the simulation time
//                         the world should have reached. The game steps the world up to it.
//   KillCam.draw(dt)      paint the whole frame onto the game canvas.
//   KillCam.skip()        the player tapped: finish quickly.
//   KillCam.stop()        tidy up.
//   KillCam.active, KillCam.done, KillCam.rate (how fast time is passing, for the sound)
// ---------------------------------------------------------------------------
const KillCam = CB.KillCam = { active: false, done: false, rate: 0.2 };

KillCam.start = function (o) {
  const K = KillCam;
  K.o = o; K.t = 0; K.active = true; K.done = false; K.skipped = false;
  K.flight = Math.max(0.02, o.tHit - o.t0);
  K.dur = clamp(1.5 + K.flight * 1.5, 1.8, 3.4); K.after = 1.2;
  K.simT = o.t0;
  return true;
};
KillCam.stop = function () { KillCam.active = false; KillCam.o = null; };
KillCam.skip = function () { KillCam.skipped = true; };
KillCam.pos = function (t) { // where the round is at simulation time t, from the predicted flight
  const p = KillCam.o.path, h = KillCam.o.hit;
  if (t >= h.t) return [h.x, h.y, h.z];
  for (let i = 1; i < p.length; i++) if (p[i][0] >= t) { const a = p[i - 1], b = p[i], u = clamp((t - a[0]) / Math.max(1e-6, b[0] - a[0]), 0, 1); const q = [lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u)]; if (q[2] > h.z) return [h.x, h.y, h.z]; return q; }
  return [h.x, h.y, h.z];
};
KillCam.advance = function (dt) {
  const K = KillCam, o = K.o;
  if (K.skipped) { K.done = true; return Math.max(K.simT, o.tHit + o.step * 2); }
  K.t += dt;
  if (K.t < K.dur) {
    const u = K.t / K.dur, e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    K.simT = o.t0 + (o.tHit - o.step * 0.5 - o.t0) * e; K.rate = 0.3;
  } else {
    K.simT = Math.max(K.simT, o.tHit + o.step) + dt * 0.08; K.rate = 0.08;
    if (K.t > K.dur + K.after) K.done = true;
  }
  return K.simT;
};
KillCam.draw = function (dt) {
  const K = KillCam, o = K.o, V = o.view, ctx = V.ctx, sim = o.sim, h = o.hit;
  const u = clamp(K.t / K.dur, 0, 1), b = K.pos(K.simT);
  const back = lerp(1.2, 5, smooth(u * 3)), ez = Math.min(b[2] - back, h.z - 3.2), ex = b[0] + (h.x - b[0]) * 0, ey = b[1] + 0.25;
  const d = Math.max(1, h.z - ez);
  const scopePpm = V.ppm(sim.sh.zoom), widePpm = V.hh / 260;
  const ppm = Math.exp(lerp(Math.log(scopePpm), Math.log(widePpm), smooth(u * 2.2)));
  const cam = { cx: V.W / 2, cy: V.H / 2, hw: V.W / 2, hh: V.H / 2, ex, ey, ez, ax: ((h.x - ex) / d) * 1000, ay: ((h.y - ey) / d) * 1000, ppm };
  ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, V.W, V.H);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, V.W, V.H); ctx.clip();
  V.drawWorld(sim, cam, dt, dt * K.rate, { near: 0.6 });
  ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  if (K.simT < h.t) { const p = V.project(sim, b[0], b[1], b[2]); ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.ellipse(p[0], p[1], Math.max(2, 0.05 * p[2]), Math.max(1.5, 0.02 * p[2]), 0, 0, TAU); ctx.fill(); }
  ctx.restore();
};
