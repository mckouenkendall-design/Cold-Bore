// ---------------------------------------------------------------------------
// Things in a scene that kill by accident, beyond the hooks and loads in the
// scene kit. Each one is a shootable object with its own drawing; what it does
// runs on the simulation's clock (sim.after), so a replay or the shot oracle
// sees exactly the same thing happen at exactly the same moment.
// ---------------------------------------------------------------------------

// A live cable in a puddle. A junction box hangs under a shop awning and feeds
// the sign above it, and the pavement under it is wet. Shoot the box and the
// cable tears loose, swings down into the water, and whoever is standing in the
// puddle is electrocuted: an accident, which people gawk at rather than run
// from. The breaker trips a moment later and the cable goes dead.
//   o.x, o.y   the box        o.top   where the cable comes down from (the sign)
//   o.px, o.pr the puddle's middle and half width       o.floor  the ground
const CABLE_FALL = 0.62, CABLE_LIVE = 0.75;
K.liveCable = function (S, P, o) {
  const bx = o.x, by = o.y, top = o.top, floor = o.floor || 0, px = o.px === undefined ? bx + 0.5 : o.px, pr = o.pr || 0.8;
  const lx = bx + (o.lie === undefined ? 0.3 : o.lie);             // where the torn end comes to rest
  const cab = S.tone('#101215', P), box = S.tone('#6b737c', P), boxD = S.tone('#3c4249', P), yel = S.tone('#e2b33c', P, true);
  const C = { id: o.id || 'junction', x: bx, y: by, px, pr, floor, lx, plane: P };
  // the puddle, under everyone's feet: dark water with the light lying on it, and rings from the rain
  P.add({ x0: px - pr - 1, x1: px + pr + 1, layer: 0, draw(ctx, env) {
    const s = env.s, y = floor + 0.015, ry = Math.max(0.05, pr * 0.085);
    ctx.fillStyle = 'rgba(8,10,14,0.55)'; ctx.beginPath(); ctx.ellipse(px, y, pr, ry, 0, 0, TAU); ctx.fill();
    if (s > 5) { ctx.fillStyle = 'rgba(170,190,210,0.2)'; ctx.beginPath(); ctx.ellipse(px - pr * 0.15, y + ry * 0.2, pr * 0.62, ry * 0.32, 0, 0, TAU); ctx.fill(); }
    if (s > 9) {
      ctx.strokeStyle = 'rgba(200,215,230,0.35)'; ctx.lineWidth = Math.max(0.012, env.px * 0.6); ctx.beginPath();
      for (let i = 0; i < 4; i++) { const u = (env.t * 0.9 + i * 0.27 + kxH(i, px)) % 1, cx = px + (kxH(i * 3 + Math.floor(env.t * 0.9 + i * 0.27), 9) - 0.5) * pr * 1.3, r = 0.04 + u * 0.22; ctx.moveTo(cx + r, y); ctx.ellipse(cx, y, r, r * 0.18, 0, 0, TAU); }
      ctx.stroke();
    }
    // while the cable is live the water flickers blue-white
    const u = C.hitT === undefined ? -1 : env.t - C.hitT - CABLE_FALL;
    if (u >= 0 && u < CABLE_LIVE + 0.2) {
      const f = (0.55 + 0.45 * Math.sin(env.t * 71)) * (1 - u / (CABLE_LIVE + 0.2));
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(lx, y, 0.02, lx, y, pr * 1.4); g.addColorStop(0, 'rgba(190,225,255,' + (0.85 * f).toFixed(3) + ')'); g.addColorStop(1, 'rgba(120,170,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(px, y, pr * 1.2, ry * 3.5, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
  } });
  // where the end of the cable is: on the box, falling, or lying in the water
  const endAt = (t) => {
    if (C.hitT === undefined || t < C.hitT) return [bx, by - 0.22, 0];
    const u = Math.min(1, (t - C.hitT) / CABLE_FALL), e = u * u;
    return [bx + (lx - bx) * e + Math.sin(u * Math.PI) * 0.35, by - 0.22 + (floor + 0.04 - by + 0.22) * e, u];
  };
  const ob = S.obj({ kind: 'junction', id: C.id, plane: P, x: bx, y: by, r: 0.26, mat: 'metal', breakable: true, layer: 2, cable: C,
    draw(ctx, env) {
      const s = env.s, [ex, ey, u] = endAt(env.t);
      // the cable from the sign: taut down to the box, then slack once it has torn loose
      ctx.strokeStyle = cab; ctx.lineWidth = Math.max(0.045, env.px * 1.1); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx, top);
      if (C.hitT === undefined) ctx.lineTo(bx, by + 0.22);
      else if (u < 1) ctx.quadraticCurveTo(bx + (ex - bx) * 0.2, (top + ey) * 0.5 - 0.3 * u, ex, ey);
      else { ctx.quadraticCurveTo(bx - 0.05, floor + 0.6, bx + (lx - bx) * 0.5, floor + 0.05); ctx.lineTo(lx, floor + 0.04); }
      ctx.stroke(); ctx.lineCap = 'butt';
      if (C.hitT === undefined) {
        // the box: grey steel with a lid seam, a yellow warning label and a gland at the bottom
        R4(ctx, bx - 0.18, by - 0.22, 0.36, 0.44, box); R4(ctx, bx - 0.18, by + 0.17, 0.36, 0.05, boxD);
        if (s > 6) { R4(ctx, bx - 0.09, by - 0.04, 0.18, 0.13, yel); R4(ctx, bx - 0.04, by - 0.3, 0.08, 0.08, boxD); }
        if (s > 14) { ctx.fillStyle = cab; ctx.beginPath(); ctx.moveTo(bx, by + 0.07); ctx.lineTo(bx - 0.035, by - 0.005); ctx.lineTo(bx + 0.005, by - 0.005); ctx.lineTo(bx - 0.02, by - 0.06); ctx.lineTo(bx + 0.035, by + 0.02); ctx.lineTo(bx - 0.005, by + 0.02); ctx.closePath(); ctx.fill(); }
        return;
      }
      // torn loose: the broken box rides the end down, spitting sparks while the line is live
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(u * 2.2); R4(ctx, -0.13, -0.06, 0.26, 0.2, boxD); if (s > 6) R4(ctx, -0.07, 0, 0.12, 0.08, yel); ctx.restore();
      const live = env.t - C.hitT < CABLE_FALL + CABLE_LIVE;
      if (live && s > 2) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(205,232,255,0.95)'; ctx.lineWidth = Math.max(0.02, env.px * 0.9); ctx.beginPath();
        const k = Math.floor(env.t * 30);
        for (let i = 0; i < 4; i++) { let x = ex, y = ey; ctx.moveTo(x, y); for (let j = 0; j < 3; j++) { x += (kxH(k + i * 7, j) - 0.5) * 0.5; y += (kxH(k + i * 5, j + 3) - 0.3) * 0.28; ctx.lineTo(x, Math.max(floor, y)); } }
        ctx.stroke();
        const g = ctx.createRadialGradient(ex, ey, 0.01, ex, ey, 0.6); g.addColorStop(0, 'rgba(220,240,255,0.9)'); g.addColorStop(1, 'rgba(140,190,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, ey, 0.6, 0, TAU); ctx.fill(); ctx.restore();
      }
    },
    onHit(sim, ob) {
      if (C.hitT !== undefined) return;
      C.hitT = sim.t;
      sim.after(CABLE_FALL, () => {
        // the end hits the water: everyone standing in it, now and while the breaker holds
        const zap = () => {
          sim.ev.push({ k: 'zap', x: lx, y: floor + 0.1, plane: P });
          sim.actors.forEach((a) => {
            if (a.dead || a.gone || a.hidden || a.inVeh || a.room || a.behind || !a.plane) return;
            if (Math.abs(a.plane.z - P.z) > 1.5 || Math.abs(a.x - px) > pr + 0.25 || Math.abs(a.y - floor) > 0.4) return;
            sim.killActor(a, 'torso', 'accident', null);
          });
        };
        zap(); sim.noise(lx, floor + 0.5, P, 'pop', 7); sim.emit('zap:' + C.id);
        for (let i = 1; i <= 3; i++) sim.after((i * CABLE_LIVE) / 3, zap);
      });
    } });
  C.ob = ob;
  return C;
};
