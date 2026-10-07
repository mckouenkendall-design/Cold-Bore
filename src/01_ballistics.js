// ---------------------------------------------------------------------------
// Ballistics. Real units: metres, seconds, metres per second.
// Angles are in "mils" (milliradians): 1 mil = 1 metre wide at 1000 metres,
// or 10 cm at 100 metres. Scope markings are drawn in the same unit, so the
// marks on the glass are true to the bullet's flight.
//
// Axes: x = left/right, y = up, z = away from the shooter.
// ---------------------------------------------------------------------------
const GRAV = 9.81;
const SOUND = 343;

const Bal = CB.Bal = {
  // Advance one bullet by dt seconds. k is the drag factor (bigger = loses
  // speed faster). Wind is the air's own velocity; the bullet is dragged
  // toward moving with the air, which is what causes wind drift.
  step(b, dt, k, wx, wz) {
    const rx = b.vx - wx, ry = b.vy, rz = b.vz - wz;
    const sp = Math.sqrt(rx * rx + ry * ry + rz * rz);
    const d = k * sp * dt;
    b.vx -= d * rx;
    b.vy -= d * ry + GRAV * dt;
    b.vz -= d * rz;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    b.t += dt;
  },

  launch(v0, axMil, ayMil) {
    const dx = axMil / 1000, dy = ayMil / 1000;
    const n = 1 / Math.sqrt(dx * dx + dy * dy + 1);
    return { x: 0, y: 0, z: 0, vx: v0 * dx * n, vy: v0 * dy * n, vz: v0 * n, t: 0 };
  },

  // Fly a test bullet from the origin until it has travelled `dist` metres
  // downrange. Returns where it is (x, y), the flight time and its speed.
  flyTo(st, axMil, ayMil, dist, wx, wz) {
    const b = Bal.launch(st.v0, axMil, ayMil);
    const k = st.k;
    let guard = 0, px = 0, py = 0, pz = 0, pt = 0;
    while (b.z < dist && guard++ < 6000) {
      px = b.x; py = b.y; pz = b.z; pt = b.t;
      const sp = Math.max(60, Math.abs(b.vz));
      Bal.step(b, Math.min(1 / 240, 4 / sp), k, wx || 0, wz || 0);
      if (b.vz < 20) break;
    }
    const f = b.z > pz ? clamp((dist - pz) / (b.z - pz), 0, 1) : 1;
    return {
      x: lerp(px, b.x, f), y: lerp(py, b.y, f), t: lerp(pt, b.t, f),
      v: Math.sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz), reached: b.z >= dist,
    };
  },

  // How far the barrel must be tilted up (mils) so the bullet crosses the
  // line of sight at the zero range.
  zeroAngle(st, zeroRange) {
    let a = 0;
    for (let i = 0; i < 5; i++) {
      const r = Bal.flyTo(st, 0, a, zeroRange, 0, 0);
      a -= (r.y / zeroRange) * 1000;
    }
    return a;
  },

  // "Dope" is shooter slang for the correction a given shot needs.
  // dropMil > 0 means hold that many mils HIGH. driftMil > 0 means the
  // bullet lands to the right of the crosshair.
  dope(st, zeroAng, range, wx) {
    const r = Bal.flyTo(st, 0, zeroAng, range, wx || 0, 0);
    return { dropMil: -(r.y / range) * 1000, driftMil: (r.x / range) * 1000, tof: r.t, v: r.v, reached: r.reached };
  },

  // Find the aim (mils from straight ahead) that lands a bullet on the point
  // (dx, dy) at distance `dist`, allowing for drop and wind.
  solve(st, zeroAng, dx, dy, dist, wx, wz) {
    let ax = (dx / dist) * 1000, ay = (dy / dist) * 1000, tof = 0;
    for (let i = 0; i < 6; i++) {
      const r = Bal.flyTo(st, ax, ay + zeroAng, dist, wx || 0, wz || 0);
      ax -= ((r.x - dx) / dist) * 1000;
      ay -= ((r.y - dy) / dist) * 1000;
      tof = r.t;
    }
    return { ax, ay, tof };
  },
};
