// ---------------------------------------------------------------------------
// The scope view: everything you see through the glass.
// ---------------------------------------------------------------------------
const FOV_AT_1X = 350; // mils across the scope at 1x. A 10x scope shows 35 mils.

function View(canvas) {
  this.cv = canvas; this.ctx = canvas.getContext('2d');
  this.fx = []; this.flash = 0; this.shake = 0; this.shadowX = 0; this.shadowY = 0; this.blackout = 0;
  this.W = 0; this.H = 0; this.dpr = 1; this.cx = 0; this.cy = 0; this.R = 100;
  this.hold = null; this.holdT = 0; this.rangeInfo = null; this.hitMark = 0; this.pulse = 0; this.zoomBlur = 0;
  this.assist = 'notes'; this.rt = 0; this.bdcCache = null;
}
View.prototype.layout = function (W, H, dpr, mode) {
  this.W = W; this.H = H; this.dpr = dpr;
  this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr);
  this.cv.style.width = W + 'px'; this.cv.style.height = H + 'px';
  this.round = true;
  if (mode === 'portrait') {
    this.R = Math.max(118, Math.min(W * 0.5 - 4, (H - 58 - (H < 720 ? 300 : 336)) / 2));
    this.cx = W / 2; this.cy = 58 + this.R;
  } else if (mode === 'attract') {
    this.R = Math.min(W * 0.5 - 14, H * 0.27); this.cx = W / 2; this.cy = H * 0.3;
  } else if (mode === 'plain') { // fills the whole canvas, no scope furniture (used for thumbnails)
    this.R = Math.hypot(W, H) / 2 + 6; this.cx = W / 2; this.cy = H / 2; this.round = false;
  } else {
    // "wide": the picture fills the whole screen. R is still the half-height, so the
    // magnification is the same as the round scope, you simply see more to each side.
    // RR is the big scope ring, taller than the screen, whose dark edge closes in at the sides.
    mode = 'wide';
    this.R = H / 2; this.cx = W / 2; this.cy = H / 2; this.round = false;
  }
  this.hw = this.round ? this.R : W / 2; this.hh = this.round ? this.R : H / 2;
  this.RR = mode === 'wide' ? Math.max(H * 0.62, Math.min(H * 0.9, W * 0.5 - 36)) : this.R;
  this.mode = mode;
};
View.prototype.ppm = function (zoom) { return (this.R * 2) / (FOV_AT_1X / zoom); };

View.prototype.add = function (f) { this.fx.push(f); if (this.fx.length > 400) this.fx.splice(0, this.fx.length - 400); };

// Turn simulation events into things you see.
View.prototype.onEvent = function (e, sim) {
  const V = this, R = Math.random;
  const burst = (n, o) => { for (let i = 0; i < n; i++) V.add(Object.assign({ t: 0 }, o(i))); };
  switch (e.k) {
    case 'fire': V.flash = e.quiet ? 0.25 : 1; V.shake = Math.min(1.6, 0.35 + e.recoil * 0.07); V.blackout = e.quiet ? 0.5 : 1; break;
    case 'impact': {
      const z = e.z, m = e.mat;
      if (m === 'water') burst(9, () => ({ k: 'drop', x: e.x + (R() - 0.5) * 0.3, y: e.y, z, vx: (R() - 0.5) * 2.4, vy: 3 + R() * 4, life: 0.9, col: '#d7e9f5', r: 0.07 + R() * 0.06 }));
      else if (m === 'metal' || m === 'hard') { burst(7, () => ({ k: 'spark', x: e.x, y: e.y, z, vx: (R() - 0.5) * 9, vy: (R() - 0.2) * 8, life: 0.25 + R() * 0.2, col: '#ffd98a' })); V.add({ k: 'puff', t: 0, x: e.x, y: e.y, z, r: 0.2, grow: 1.2, life: 0.5, col: '#c9ced3' }); }
      else if (m === 'interior') V.add({ k: 'puff', t: 0, x: e.x, y: e.y, z, r: 0.12, grow: 0.8, life: 0.4, col: '#e9e2d0' });
      else { const col = m === 'dirt' ? '#b9a27e' : m === 'snow' ? '#f2f6fa' : m === 'wood' ? '#c9a878' : '#cfc7bb';
        burst(e.small ? 2 : 5, () => ({ k: 'puff', x: e.x + (R() - 0.5) * 0.3, y: e.y + R() * 0.2, z, vx: (R() - 0.5) * 1.2, vy: 0.4 + R() * (e.ground ? 2.2 : 0.8), r: 0.14 + R() * 0.12, grow: 1.6 + R(), life: 0.9 + R() * 0.6, col }));
        burst(4, () => ({ k: 'drop', x: e.x, y: e.y, z, vx: (R() - 0.5) * 4, vy: 1 + R() * 4, life: 0.6, col: darken(col, 0.3), r: 0.035 })); }
      break;
    }
    case 'hit': {
      const z = e.plane.z;
      V.add({ k: 'star', t: 0, x: e.x, y: e.y, z, life: 0.16, r: e.part === 'head' ? 0.5 : 0.42 });
      burst(5, () => ({ k: 'puff', x: e.x, y: e.y, z, vx: (R() - 0.5) * 1.5, vy: R() * 1.2, r: 0.07 + R() * 0.07, grow: 0.9, life: 0.5 + R() * 0.3, col: '#f1ede2' }));
      V.hitMark = e.lethal ? 1 : 0.5;
      break;
    }
    case 'kill': {
      const a = sim.byId[e.id];
      if (a && a.look && a.look.hat && e.how === 'shot' && a.look.hat !== 'hood') { V.add({ k: 'hat', t: 0, x: a.x, y: a.y + 1.8, z: e.plane.z, vx: (R() - 0.5) * 3, vy: 3.2, rot: 0, vr: (R() - 0.5) * 14, life: 1.3, col: a.look.hatCol || '#2a2d33', floor: a.y }); a.look.hat = null; }
      break;
    }
    case 'glass': burst(14, () => ({ k: 'shard', x: e.x + (R() - 0.5) * 0.9, y: e.y + (R() - 0.5) * 0.9, z: e.plane.z, vx: (R() - 0.5) * 3, vy: R() * 2, rot: R() * 6, vr: (R() - 0.5) * 20, life: 0.9 + R() * 0.5, r: 0.06 + R() * 0.1 })); break;
    case 'lampout': case 'zap': case 'spark': burst(10, () => ({ k: 'spark', x: e.x, y: e.y, z: e.plane.z, vx: (R() - 0.5) * 7, vy: (R() - 0.3) * 7, life: 0.3 + R() * 0.35, col: '#bfe4ff' })); break;
    case 'boom': {
      const z = e.plane.z;
      V.add({ k: 'fire', t: 0, x: e.x, y: e.y, z, r: e.r * 0.25, grow: e.r * 3.2, life: 0.55 });
      burst(16, () => ({ k: 'puff', x: e.x + (R() - 0.5) * e.r * 0.6, y: e.y + R() * e.r * 0.3, z, vx: (R() - 0.5) * 3, vy: 1.5 + R() * 4, r: 0.5 + R() * 0.7, grow: 1.6, life: 2 + R() * 1.6, col: R() > 0.5 ? '#2a2c31' : '#4a4c52' }));
      burst(18, () => ({ k: 'spark', x: e.x, y: e.y, z, vx: (R() - 0.5) * 24, vy: (R() - 0.2) * 20, life: 0.6 + R() * 0.5, col: '#ffb14d' }));
      V.flash = Math.max(V.flash, 0.5); V.shake = Math.max(V.shake, 0.5);
      break;
    }
    case 'crash': burst(10, () => ({ k: 'puff', x: e.x + (R() - 0.5) * 2.4, y: e.y + R() * 0.3, z: e.plane.z, vx: (R() - 0.5) * 3.5, vy: 0.5 + R() * 1.6, r: 0.3 + R() * 0.3, grow: 1.4, life: 1.2 + R(), col: '#b7ab99' })); break;
    case 'duck': burst(10, () => ({ k: 'drop', x: e.x, y: e.y, z: e.plane.z, vx: (R() - 0.5) * 5, vy: 1 + R() * 5, life: 0.9, col: R() > 0.5 ? '#f7d038' : '#ffffff', r: 0.05 })); break;
    case 'smash': case 'clank': burst(7, () => ({ k: 'drop', x: e.x, y: e.y, z: e.plane.z, vx: (R() - 0.5) * 4, vy: R() * 4, life: 0.7, col: e.k === 'smash' ? '#9fd6b0' : '#c9ced3', r: 0.04 })); break;
    case 'tyre': V.add({ k: 'puff', t: 0, x: e.x, y: e.y, z: e.plane.z, vx: 0, vy: 0.4, r: 0.2, grow: 1.5, life: 0.7, col: '#d9dde2' }); break;
    case 'wound': burst(3, () => ({ k: 'puff', x: e.x, y: e.y + 1, z: e.plane.z, vx: (R() - 0.5), vy: R(), r: 0.08, grow: 0.8, life: 0.4, col: '#f1ede2' })); break;
    case 'npcshot': V.add({ k: 'star', t: 0, x: e.x, y: e.y + 1.4, z: sim.S.refZ, life: 0.12, r: 0.7 }); break;
    case 'flare': V.add({ k: 'flarelight', t: 0, x: e.x, y: e.y, z: e.plane.z, life: 8 }); break;
    default: break;
  }
};

// The camera for the normal scope view: the shooter's eye, where the rifle points, and the zoom.
View.prototype.camFromSim = function (sim) {
  const e = sim.eye(), aim = sim.aimNow();
  return { cx: this.cx + this.jx, cy: this.cy + this.jy, hw: this.hw, hh: this.hh, ex: e.x, ey: e.y, ez: e.z, ax: aim.x, ay: aim.y, ppm: this.ppm(sim.sh.zoom) };
};
// World point to screen, through whichever camera drew the last frame.
View.prototype.project = function (sim, x, y, z) {
  const c = this.cam || this.camFromSim(sim), d = Math.max(0.5, z - c.ez);
  return [c.cx + (((x - c.ex) / d) * 1000 - c.ax) * c.ppm, c.cy - (((y - c.ey) / d) * 1000 - c.ay) * c.ppm, (c.ppm * 1000) / d];
};

View.prototype.draw = function (sim, dt, simDt) {
  const V = this, ctx = V.ctx, dpr = V.dpr, sh = sim.sh;
  V.rt += dt;
  // tiny mechanical shake after a shot
  V.shake *= Math.exp(-dt * 9); V.flash *= Math.exp(-dt * 16); V.blackout *= Math.exp(-dt * 7); V.hitMark *= Math.exp(-dt * 3.2);
  V.jx = (Math.random() - 0.5) * V.shake * 9; V.jy = (Math.random() - 0.5) * V.shake * 9;
  const cam = V.cam = V.camFromSim(sim), R = V.RR;
  // eye-box shadow follows how fast the rifle is moving
  const vx = sh.recvx * 0.02 + (sh.ax - (V.pax === undefined ? sh.ax : V.pax)) / Math.max(dt, 0.001) * 0.004 + sh.offx * 0.05;
  const vy = sh.recvy * 0.02 + (sh.ay - (V.pay === undefined ? sh.ay : V.pay)) / Math.max(dt, 0.001) * 0.004 + sh.offy * 0.05;
  V.pax = sh.ax; V.pay = sh.ay;
  V.shadowX += (clamp(vx, -1, 1) * R * 0.42 - V.shadowX) * Math.min(1, dt * 10);
  V.shadowY += (clamp(-vy, -1, 1) * R * 0.42 - V.shadowY) * Math.min(1, dt * 10);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, V.W, V.H);
  ctx.save();
  ctx.beginPath(); if (V.round) ctx.arc(cam.cx, cam.cy, V.R, 0, TAU); else ctx.rect(0, 0, V.W, V.H); ctx.clip();
  V.drawWorld(sim, cam, dt, simDt);
  V.drawLens(sim, cam);
  ctx.restore();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (V.mode === 'plain' || !V.round) return;
  // ---- scope body ----
  const RB = V.R;
  const ring = ctx.createRadialGradient(V.cx, V.cy, RB, V.cx, V.cy, RB + 16);
  ring.addColorStop(0, '#000'); ring.addColorStop(0.25, '#1c2026'); ring.addColorStop(0.55, '#0c0e11'); ring.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.strokeStyle = ring; ctx.lineWidth = 32; ctx.beginPath(); ctx.arc(V.cx, V.cy, RB + 15, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(120,135,150,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(V.cx, V.cy, RB + 3.5, Math.PI * 1.1, Math.PI * 1.75); ctx.stroke();
};

// Everything out in the world, as seen by a camera:
//   cam = { cx, cy, hw, hh,  centre and half-size of the picture on screen (CSS px)
//           ex, ey, ez,      where the eye is (metres)
//           ax, ay,          where it is looking (mils off the straight-ahead line)
//           ppm }            screen pixels per mil (the magnification)
// The scope uses the shooter's eye; the bullet camera moves the eye down range.
// o: { near }  planes closer to the eye than this many metres are skipped.
View.prototype.drawWorld = function (sim, cam, dt, simDt, o) {
  o = o || {};
  const V = this, ctx = V.ctx, dpr = V.dpr, S = sim.S, st = sim.st, pal = S.pal;
  V.cam = cam;
  const cx = cam.cx, cy = cam.cy, hw = cam.hw, hh = cam.hh, ppm = cam.ppm;
  const aim = { x: cam.ax, y: cam.ay }, eye = { x: cam.ex, y: cam.ey, z: cam.ez };
  const farStop = sim.farStop || 1e9;
  // ---- sky ----
  const hor = cy + aim.y * ppm - ((0 - eye.y) / 4000) * 1000 * ppm * 0; // horizon line (angle 0)
  const g = ctx.createLinearGradient(0, hor - 230 * ppm, 0, hor);
  g.addColorStop(0, pal.skyTop); g.addColorStop(1, pal.skyBot);
  ctx.fillStyle = g; ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2);
  if (pal.star > 0) {
    ctx.fillStyle = '#ffffff';
    const stars = S.sky.stars;
    for (let i = 0; i < stars.length; i++) {
      const sx = cx + (stars[i][0] - aim.x * 0.98) * ppm * 0.6, sy = cy - (stars[i][1] - aim.y * 0.98) * ppm * 0.6;
      if (Math.abs(sx - cx) > hw || Math.abs(sy - cy) > hh) continue;
      ctx.globalAlpha = pal.star * (0.35 + 0.65 * stars[i][3]) * (0.8 + 0.2 * Math.sin(V.rt * 2 + i));
      ctx.fillRect(sx, sy, stars[i][2] * 1.3, stars[i][2] * 1.3);
    }
    ctx.globalAlpha = 1;
  }
  { // sun or moon
    const sx = cx + (S.sky.sun[0] - aim.x) * ppm, sy = cy - (S.sky.sun[1] - aim.y) * ppm, sr = (pal.dark > 0.5 ? 4.5 : 7) * ppm;
    if (S.weather !== 'rain' && S.time !== 'overcast' && sx > cx - hw - sr * 4 && sx < cx + hw + sr * 4) {
      const gg = ctx.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr * 4);
      gg.addColorStop(0, rgba(pal.sun, 0.55)); gg.addColorStop(1, rgba(pal.sun, 0));
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(sx, sy, sr * 4, 0, TAU); ctx.fill();
      ctx.fillStyle = pal.sun; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
      if (pal.dark > 0.5) { ctx.fillStyle = pal.skyTop; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(sx + sr * 0.45, sy - sr * 0.2, sr * 0.9, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    }
  }
  ctx.fillStyle = pal.cloud;
  for (let i = 0; i < S.sky.clouds.length; i++) {
    const c = S.sky.clouds[i];
    const drift = ((sim.t * 0.25 * (1 + c.s) * sign(sim.windBase || 1) + c.x + 300) % 600) - 300;
    const px = cx + (drift - aim.x) * ppm, py = cy - (c.y - aim.y) * ppm;
    if (px < cx - hw - c.w * ppm || px > cx + hw + c.w * ppm || py < cy - hh - 40 * ppm || py > cy + hh + 40 * ppm) continue;
    ctx.globalAlpha = S.weather === 'clear' ? 0.75 : 0.9;
    for (let j = 0; j < c.n; j++) { ctx.beginPath(); ctx.ellipse(px + ((j / (c.n - 1)) - 0.5) * c.w * ppm * 0.8, py - Math.sin(j * 2.3 + c.s * 9) * c.h * ppm * 0.25, c.w * ppm * 0.26, c.h * ppm * (0.45 + 0.25 * Math.sin(j * 1.7 + c.s * 5)), 0, 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;

  // ---- the world, far to near ----
  const nv = !!st.scope.nv;
  const planes = S.planes;
  const env = { t: sim.t, wind: sim.wind(), nv, px: 1, s: 1, x0: 0, x1: 0, text: null, smoke: 'rgba(220,225,232,0.35)' };
  let curS = 1, curTx = 0, curTy = 0;
  env.text = (c2, str, x, y, size, col, align, glow) => {
    const px = size * curS; if (px < 4.5) return;
    c2.save(); c2.setTransform(dpr, 0, 0, dpr, 0, 0);
    c2.font = '700 ' + px.toFixed(1) + 'px "Avenir Next Condensed","DIN Condensed","Roboto Condensed","Arial Narrow",sans-serif';
    c2.textAlign = align || 'left'; c2.textBaseline = 'alphabetic';
    if (glow) { c2.shadowColor = col; c2.shadowBlur = px * 0.5; }
    c2.fillStyle = col; c2.fillText(str, curTx + curS * x, curTy - curS * y);
    c2.restore();
  };
  // How a person is lit. Light falls off smoothly with distance from a lamp, and it is
  // eased over time, so somebody walking out of a pool of light fades rather than snaps.
  const night = pal.dark > 0.5;
  const figEnv = (a) => {
    const zone = a.room && S.rooms[a.room] ? a.room : a.zone;
    const LA = S.lightAt(zone, a.x);
    if (a._lt === undefined || a._ltS !== S) { a._lt = LA.l; a._ltS = S; } else a._lt += (LA.l - a._lt) * Math.min(1, dt * 6);
    const lt = a._lt, k = 1 - lt;
    const e2 = { px: env.px, ink: pal.ink, rim: pal.rim, smoke: env.smoke, windDrift: env.wind * 0.08, wind: env.wind, light: lt, lampDx: LA.dx, lampH: LA.h, lampCol: LA.col || pal.lit, night, nv, t: env.t, pal, haze: a.plane ? a.plane.haze : 0, gore: V.gore !== false, weather: S.weather,
      lead: a.dead && CB.Game && CB.Game.sim === sim && !CB.Game.cine ? CB.Game.acc || 0 : 0 }; // how far the world is between its steps, so a body falling in slow motion moves smoothly
    if (night) {
      e2.dark = true; e2.dim = (nv ? 0.25 : 0.72) * k; e2.ink = mix(pal.ink, '#04060a', k);
      e2.rim = nv ? 'rgba(190,255,200,' + lerp(0.75, 0.9, k).toFixed(2) + ')' : 'rgba(' + Math.round(lerp(170, 120, k)) + ',' + Math.round(lerp(190, 140, k)) + ',' + Math.round(lerp(225, 175, k)) + ',' + lerp(0.42, 0.24, k).toFixed(2) + ')';
    } else if (nv) e2.rim = 'rgba(190,255,200,0.75)';
    return e2;
  };
  for (let pi = 0; pi < planes.length; pi++) {
    const P = planes[pi], d = P.z - eye.z;
    if (d <= (o.near || 2)) continue;
    const s = (ppm * 1000) / d, tx = cx - s * eye.x - ppm * aim.x, ty = cy + s * eye.y + ppm * aim.y;
    curS = s; curTx = tx; curTy = ty;
    ctx.setTransform(dpr * s, 0, 0, -dpr * s, dpr * tx, dpr * ty);
    env.s = s; env.px = 1 / s; env.x0 = (cx - hw - tx) / s; env.x1 = (cx + hw - tx) / s;
    env.y0 = (ty - (cy + hh)) / s; env.y1 = (ty - (cy - hh)) / s;
    const items = P.items;
    for (let i = 0; i < items.length; i++) { const it = items[i]; if (it.layer !== 0 || it.x1 < env.x0 || it.x0 > env.x1) continue; it.draw(ctx, env); }
    // people inside rooms, seen through the windows
    let anyBehind = false;
    for (let i = 0; i < sim.actors.length; i++) { const a = sim.actors[i]; if (a.plane === P && a.behind && !a.hidden && !a.gone && !a.inVeh) { anyBehind = true; break; } }
    if (anyBehind) {
      for (let j = 0; j < P.openings.length; j++) {
        const op = P.openings[j];
        if (op.x + op.w < env.x0 || op.x > env.x1) continue;
        let clipped = false;
        for (let i = 0; i < sim.actors.length; i++) {
          const a = sim.actors[i];
          if (a.plane !== P || !a.behind || a.hidden || a.gone || a.inVeh || a.room !== op.room) continue;
          if (a.x < op.x - 1.2 || a.x > op.x + op.w + 1.2) continue;
          if (!clipped) { ctx.save(); ctx.beginPath(); ctx.rect(op.x, op.y, op.w, op.h); ctx.clip(); clipped = true; }
          drawFigure(ctx, a, figEnv(a));
        }
        if (clipped) ctx.restore();
      }
    }
    for (let i = 0; i < items.length; i++) { const it = items[i]; if (it.layer !== 1 || it.x1 < env.x0 || it.x0 > env.x1) continue; it.draw(ctx, env); }
    // bullet holes
    for (let i = 0; i < S.decals.length; i++) { const dc = S.decals[i]; if (dc.plane !== P) continue; ctx.fillStyle = 'rgba(8,8,10,0.85)'; ctx.beginPath(); ctx.arc(dc.x, dc.y, Math.max(0.05, env.px * 1.1), 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(235,235,235,0.35)'; ctx.lineWidth = Math.max(0.02, env.px * 0.6); ctx.stroke(); }
    // vehicles with their passengers
    for (let i = 0; i < sim.vehicles.length; i++) {
      const v = sim.vehicles[i]; if (v.plane !== P || v.gone) continue;
      if (v.x + v.def.len < env.x0 || v.x - v.def.len > env.x1) continue;
      drawCar(ctx, env, S, P, v.kind, v.x, v.y, v.dir, v.col, v.st);
      const c = v.def;
      for (let sidx = 0; sidx < v.seats.length; sidx++) {
        const a = sim.byId[v.seats[sidx]]; if (!a || a.inVeh !== v) continue;
        let wi = -1; const lx = c.seats[sidx] * c.len;
        for (let w = 0; w < c.win.length; w++) if (lx >= c.win[w][0] * c.len - 0.05 && lx <= c.win[w][1] * c.len + 0.05) wi = w;
        if (wi < 0) continue;
        const wx0 = v.x + v.dir * c.win[wi][v.dir > 0 ? 0 : 1] * c.len, ww = (c.win[wi][1] - c.win[wi][0]) * c.len;
        ctx.save(); ctx.beginPath(); ctx.rect(wx0, v.y + c.body + 0.06, ww, c.h - c.body - 0.2); ctx.clip();
        drawFigure(ctx, a, figEnv(a)); ctx.restore();
      }
    }
    // loads and people in the open
    for (let i = 0; i < S.props.length; i++) { const p = S.props[i]; if (p.plane === P && !p.gone && p.x + p.w > env.x0 && p.x - p.w < env.x1) drawProp(ctx, env, S, p); }
    for (let i = 0; i < sim.actors.length; i++) {
      const a = sim.actors[i];
      if (a.plane !== P || a.behind || a.hidden || a.gone || a.inVeh) continue;
      if (a.x < env.x0 - 2.5 || a.x > env.x1 + 2.5) continue;
      drawFigure(ctx, a, figEnv(a));
    }
    for (let i = 0; i < items.length; i++) { const it = items[i]; if (it.layer !== 2 || it.x1 < env.x0 || it.x0 > env.x1) continue; it.draw(ctx, env); }
    for (let i = 0; i < S.objects.length; i++) { const ob = S.objects[i]; if (ob.plane !== P || ob.gone || !ob.draw) continue; if (ob.x < env.x0 - 12 || ob.x > env.x1 + 12) continue; ob.draw(ctx, env); }
    // steam clouds
    for (let i = 0; i < sim.steam.length; i++) {
      const sm = sim.steam[i]; if (sm.plane !== P || sm.until < sim.t) continue;
      const u = clamp((sim.t - sm.from) / 1.5, 0, 1) * clamp((sm.until - sim.t) / 2, 0, 1);
      ctx.fillStyle = 'rgba(232,236,240,0.5)';
      for (let j = 0; j < 9; j++) { const ph = sim.t * 0.5 + j * 1.7; ctx.globalAlpha = 0.5 * u; ctx.beginPath(); ctx.arc(sm.x + Math.sin(ph) * 2.2 + (j - 4) * 0.5, sm.y + 0.6 + ((ph * 0.9) % 4.5), 1.1 + (j % 3) * 0.5, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    // speech and alert marks
    for (let i = 0; i < sim.actors.length; i++) {
      const a = sim.actors[i];
      if (a.plane !== P || a.hidden || a.gone || a.dead || !a.bubble || a.bubbleT < sim.t) continue;
      if (a.x < env.x0 - 2 || a.x > env.x1 + 2) continue;
      const big = a.bubble === '!' || a.bubble === '?';
      const by = a.y + (a.inVeh ? 1.75 : 2.15) * ((a.look && a.look.h) || 1);
      if (big) env.text(ctx, a.bubble, a.x, by, 0.62, a.bubble === '!' ? '#ff4a3d' : '#ffc233', 'center', true);
      else { ctx.fillStyle = 'rgba(250,250,245,0.92)'; const w = a.bubble.length * 0.19 + 0.4; ctx.fillRect(a.x - w / 2, by - 0.1, w, 0.5); env.text(ctx, a.bubble, a.x, by + 0.03, 0.34, '#15181d', 'center'); }
    }
  }
  // ---- particles ----
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (let i = V.fx.length - 1; i >= 0; i--) {
    const f = V.fx[i]; f.t += simDt;
    if (f.t >= f.life) { V.fx.splice(i, 1); continue; }
    const u = f.t / f.life;
    if (f.vx !== undefined) { f.x += f.vx * simDt; f.y += f.vy * simDt; if (f.k !== 'puff') f.vy -= 9.8 * simDt; else { f.vx *= 0.97; f.vy *= 0.97; f.x += sim.wind() * 0.15 * simDt; } }
    if (f.floor !== undefined && f.y < f.floor) { f.y = f.floor; f.vy = 0; f.vx = 0; f.vr = 0; }
    const p = V.project(sim, f.x, f.y, f.z), s = p[2];
    if (Math.abs(p[0] - cx) > hw * 1.2 || Math.abs(p[1] - cy) > hh * 1.2) continue;
    if (f.k === 'puff') { ctx.globalAlpha = (1 - u) * 0.55; ctx.fillStyle = f.col; ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(1, (f.r + f.grow * u * f.r * 2) * s), 0, TAU); ctx.fill(); }
    else if (f.k === 'spark') { ctx.globalAlpha = 1 - u; ctx.strokeStyle = f.col; ctx.lineWidth = Math.max(1, 0.03 * s); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] - f.vx * 0.03 * s, p[1] + f.vy * 0.03 * s); ctx.stroke(); }
    else if (f.k === 'drop') { ctx.globalAlpha = 1 - u * u; ctx.fillStyle = f.col; ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(0.8, f.r * s), 0, TAU); ctx.fill(); }
    else if (f.k === 'shard') { f.rot += f.vr * simDt; ctx.globalAlpha = (1 - u) * 0.8; ctx.fillStyle = '#d7ecff'; ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(f.rot); const r = Math.max(1.2, f.r * s); ctx.beginPath(); ctx.moveTo(-r, -r * 0.4); ctx.lineTo(r, 0); ctx.lineTo(-r * 0.3, r * 0.7); ctx.closePath(); ctx.fill(); ctx.restore(); }
    else if (f.k === 'star') { ctx.globalAlpha = 1 - u; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.2, 0.05 * s); const r = f.r * s * (0.4 + u); ctx.beginPath(); for (let j = 0; j < 6; j++) { const an = j * (TAU / 6) + 0.3; ctx.moveTo(p[0] + Math.cos(an) * r * 0.35, p[1] + Math.sin(an) * r * 0.35); ctx.lineTo(p[0] + Math.cos(an) * r, p[1] + Math.sin(an) * r); } ctx.stroke(); }
    else if (f.k === 'hat') { f.rot += f.vr * simDt; ctx.globalAlpha = 1; ctx.fillStyle = f.col; ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(f.rot); ctx.fillRect(-0.28 * s, -0.03 * s, 0.56 * s, 0.06 * s); ctx.fillRect(-0.15 * s, -0.2 * s, 0.3 * s, 0.18 * s); ctx.restore(); }
    else if (f.k === 'fire') { const r = (f.r + f.grow * easeOut(u)) * s; const gg = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r); gg.addColorStop(0, 'rgba(255,250,220,' + (1 - u) + ')'); gg.addColorStop(0.4, 'rgba(255,170,60,' + (1 - u) * 0.9 + ')'); gg.addColorStop(1, 'rgba(200,60,20,0)'); ctx.globalAlpha = 1; ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill(); }
    else if (f.k === 'flarelight') { const r = 9 * s; const gg = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r); const a = (1 - u) * (0.75 + 0.25 * Math.sin(f.t * 40)); gg.addColorStop(0, 'rgba(255,240,230,' + a + ')'); gg.addColorStop(0.15, 'rgba(255,90,60,' + a * 0.7 + ')'); gg.addColorStop(1, 'rgba(255,60,40,0)'); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
  }
  ctx.globalAlpha = 1;

  // ---- bullet trace ----
  for (let i = 0; i < sim.bullets.length; i++) {
    const b = sim.bullets[i];
    const age = b.alive ? 0 : sim.t - b.endT;
    if (age > 0.9) continue;
    const tr = b.trail; if (tr.length < 3) continue;
    const fade = b.alive ? 1 : 1 - age / 0.9;
    ctx.lineCap = 'round';
    let prev = null;
    const n = tr.length, startI = Math.max(1, n - 90);
    for (let j = startI; j < n; j++) {
      const q = tr[j]; if (q[2] - eye.z < 12) continue; if (q[2] > farStop) break;
      const p = V.project(sim, q[0], q[1], q[2]);
      if (prev) {
        const u = ((j - startI) / (n - startI)) * clamp((farStop - q[2]) / 30, 0, 1);
        if (st.tracer) { ctx.strokeStyle = 'rgba(255,120,60,' + (0.85 * u * fade) + ')'; ctx.lineWidth = 2.2; }
        else { ctx.strokeStyle = 'rgba(255,255,255,' + (0.3 * u * fade) + ')'; ctx.lineWidth = 1 + 2.4 * (1 - u); }
        ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
      }
      prev = p;
    }
    if (b.alive && prev && b.z <= farStop) {
      const hp = V.project(sim, b.x, b.y, b.z);
      ctx.fillStyle = st.tracer ? '#ffb07a' : 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(hp[0], hp[1], st.tracer ? 2.6 : 1.5, 0, TAU); ctx.fill();
      if (st.tracer) { ctx.globalCompositeOperation = 'lighter'; const gg = ctx.createRadialGradient(hp[0], hp[1], 0, hp[0], hp[1], 12); gg.addColorStop(0, 'rgba(255,120,50,0.8)'); gg.addColorStop(1, 'rgba(255,120,50,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(hp[0], hp[1], 12, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    }
  }

  // ---- weather in front of everything ----
  if (S.weather === 'rain' || S.weather === 'storm') V.drawRain(sim, cam, S.weather === 'storm');
  else if (S.weather === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    const n = Math.round(80 * clamp((hw * hh) / 36000, 0.7, 3));
    for (let i = 0; i < n; i++) {
      const sp = 40 + (i % 5) * 22;
      const x = cx - hw + (((i * 97.3 + V.rt * (sim.wind() * 14 + Math.sin(V.rt + i) * 6)) % (hw * 2)) + hw * 2) % (hw * 2), y = cy - hh + ((i * 53.7 + V.rt * sp) % (hh * 2));
      ctx.beginPath(); ctx.arc(x, y, 1 + (i % 3) * 0.7, 0, TAU); ctx.fill();
    }
  }
  if (S.weather === 'fog') { ctx.fillStyle = rgba(pal.fog, 0.22); ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2); }
  // lightning flash
  if (sim.flashT && sim.t - sim.flashT < 0.35) { ctx.fillStyle = 'rgba(235,240,255,' + (0.55 * (1 - (sim.t - sim.flashT) / 0.35) * (Math.sin(sim.t * 70) > -0.3 ? 1 : 0.3)) + ')'; ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2); }

};

// Rain. Three depths of streaks, every drop with its own speed, length, brightness and
// lean, falling in uneven sheets that thicken and thin with the gusts, plus small splashes
// where it lands on the ground nearest the target.
View.prototype.drawRain = function (sim, cam, storm) {
  const V = this, ctx = V.ctx, cx = cam.cx, cy = cam.cy, hw = cam.hw, hh = cam.hh, W2 = hw * 2, H2 = hh * 2;
  if (!V.rain) { const R = makeRng(4421); V.rain = []; for (let i = 0; i < 260; i++) V.rain.push({ x: R.f(), y: R.f(), d: R.f(), sp: R.r(0.75, 1.3), len: R.r(0.6, 1.5), a: R.r(0.35, 1), lean: R.r(-0.05, 0.05), g: R.f() }); }
  const t = V.rt, wind = sim.wind(), slant = clamp(wind * 0.07, -0.6, 0.6);
  // how hard it is coming down right now: slow swells, with the odd lull
  const swell = 0.62 + 0.38 * vnoise(t * 0.23, 77) + 0.2 * vnoise(t * 0.9, 12);
  const area = clamp((W2 * H2) / 150000, 0.5, 3.2);
  const n = Math.min(V.rain.length, Math.round((storm ? 74 : 44) * area * clamp(swell, 0.35, 1.25)));
  ctx.lineCap = 'round';
  for (let layer = 0; layer < 3; layer++) {
    const far = layer === 0, near = layer === 2;
    ctx.strokeStyle = far ? 'rgba(190,205,228,0.16)' : near ? 'rgba(222,232,246,0.34)' : 'rgba(205,218,238,0.24)';
    ctx.lineWidth = far ? 0.8 : near ? 1.5 : 1.05;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const r = V.rain[i], L = r.d < 0.5 ? 0 : r.d < 0.86 ? 1 : 2; if (L !== layer) continue;
      // a sheet of rain passes: each drop sits out part of the time
      if (vnoise(t * 0.6 + r.g * 40, 5 + (i % 7)) < -0.25 + r.g * 0.3) continue;
      const sp = (far ? 520 : near ? 1500 : 900) * r.sp, len = (far ? 9 : near ? 34 : 18) * r.len, sl = slant + r.lean + (near ? slant * 0.25 : 0);
      const span = H2 + len + 20, tt = r.y * span + t * sp, cyc = Math.floor(tt / span), yy = (tt - cyc * span) - len - 10;
      const hsh = Math.sin(i * 91.7 + cyc * 47.3) * 43758.5453, lane = hsh - Math.floor(hsh); // a fresh place to fall every time round
      const xx = (((lane * W2 + sl * yy) % W2) + W2) % W2;
      ctx.moveTo(cx - hw + xx, cy - hh + yy); ctx.lineTo(cx - hw + xx + sl * len, cy - hh + yy + len);
    }
    ctx.stroke();
  }
  // splashes on the ground the target stands on
  const S = sim.S, planes = S.planes; let P = null, best = 1e9;
  for (let i = 0; i < planes.length; i++) { const q = planes[i]; if (q.groundY === undefined || q.groundFn || q.groundMat === 'water') continue; const dd = Math.abs(q.z - S.refZ); if (dd < best) { best = dd; P = q; } }
  if (P && P.z - cam.ez > 4) {
    const d = P.z - cam.ez, s = (cam.ppm * 1000) / d, gy = cam.cy + s * cam.ey + cam.ppm * cam.ay - s * P.groundY, tx = cam.cx - s * cam.ex - cam.ppm * cam.ax;
    if (gy > cy - hh - 4 && gy < cy + hh + 30 && s > 2.2) {
      ctx.strokeStyle = 'rgba(215,228,245,0.5)'; ctx.lineWidth = Math.max(0.8, Math.min(1.6, s * 0.03));
      ctx.beginPath();
      const k = Math.round((storm ? 34 : 20) * clamp(swell, 0.35, 1.2) * clamp(W2 / 420, 0.6, 2.4));
      for (let i = 0; i < k; i++) {
        const ph = t * (2.6 + (i % 5) * 0.37) + i * 1.7, c = Math.floor(ph), u = ph - c; if (u > 0.55) continue;
        const h1 = Math.sin((i * 127.1 + c * 311.7)) * 43758.5453, rx = h1 - Math.floor(h1), h2 = Math.sin((i * 269.5 + c * 183.3)) * 43758.5453, ry = h2 - Math.floor(h2);
        const px = cx - hw + rx * W2, py = gy + ry * Math.min(26, s * 0.9), r = (1.5 + u * 5) * clamp(s / 12, 0.5, 1.6), up = (1 - u / 0.55);
        ctx.moveTo(px - r, py); ctx.lineTo(px - r * 0.45, py - r * 0.75 * up); ctx.moveTo(px + r, py); ctx.lineTo(px + r * 0.45, py - r * 0.75 * up);
        if (u < 0.2) { ctx.moveTo(px, py - 1); ctx.lineTo(px, py - 1 - r * 1.1); }
      }
      ctx.stroke();
    }
  }
};

// The glass: night vision, flash, the dark edge of the scope, the reticle.
View.prototype.drawLens = function (sim, cam) {
  const V = this, ctx = V.ctx, st = sim.st, pal = sim.S.pal, nv = !!st.scope.nv;
  const cx = cam.cx, cy = cam.cy, hw = cam.hw, hh = cam.hh, ppm = cam.ppm, R = V.RR;
  // ---- the lens itself ----
  if (nv) {
    // amplify what little light there is (bright lamps blow out, as they do in a real tube), then tint it green
    if (pal.dark > 0.3) { ctx.globalCompositeOperation = 'color-dodge'; ctx.fillStyle = '#c4c4c4'; ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2); }
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(26,34,28,0.9)'; ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2);
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#5dff86'; ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = cy - hh + ((V.rt * 40) % 3); y < cy + hh; y += 3) ctx.fillRect(cx - hw, y, hw * 2, 1);
  }
  if (V.flash > 0.02) { ctx.fillStyle = 'rgba(255,244,214,' + V.flash * 0.5 + ')'; ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2); }
  // soft dark edge
  let vg = ctx.createRadialGradient(cx, cy, R * 0.62, cx, cy, R);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(0.82, 'rgba(0,0,0,0.28)'); vg.addColorStop(1, V.round ? 'rgba(0,0,0,0.92)' : 'rgba(0,0,0,0.96)');
  ctx.fillStyle = vg; ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2);
  // thin colour fringe, like real glass
  ctx.strokeStyle = 'rgba(90,150,255,0.16)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R - 4, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,170,90,0.10)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R - 8, 0, TAU); ctx.stroke();

  if (V.mode !== 'plain' && !V.noReticle) { V.drawMark(sim, cam); V.drawReticle(sim, cx, cy, ppm); }

  // eye-box shadow: a black crescent that swings in when the rifle moves
  const sm = Math.hypot(V.shadowX, V.shadowY) + V.blackout * R * 0.25;
  if (sm > 0.8) {
    const ox = V.shadowX, oy = V.shadowY - V.blackout * R * 0.22;
    const sg = ctx.createRadialGradient(cx - ox, cy - oy, R * 0.78, cx - ox, cy - oy, R * 1.02);
    sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = sg; ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2);
  }
  if (V.blackout > 0.03) { ctx.fillStyle = 'rgba(0,0,0,' + V.blackout * 0.35 + ')'; ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2); }
  ctx.restore();

};

// What the BDC and PSO marks should read for this rifle (cached).
View.prototype.bdcMarks = function (sim) {
  const st = sim.st, key = st.id + ':' + st.v0.toFixed(0) + ':' + st.k.toFixed(6) + ':' + sim.sh.zeroR;
  if (this.bdcCache && this.bdcCache.key === key) return this.bdcCache.marks;
  const ranges = st.eff <= 320 ? [75, 100, 125, 150, 175, 200, 250, 300] : [200, 300, 400, 500, 600, 700, 800, 900, 1000];
  const marks = [];
  ranges.forEach((r) => { if (r <= sim.sh.zeroR + 5 || r > st.eff * 1.15) return; const d = Bal.dope(st, sim.sh.zeroAng, r, 0); if (d.reached && d.dropMil > 0.15 && d.dropMil < 60) marks.push({ r, mil: d.dropMil, label: r % 100 === 0 ? String(r / 100) : String(r) }); });
  this.bdcCache = { key, marks };
  return marks;
};

View.prototype.drawReticle = function (sim, cx, cy, ppm) {
  const V = this, ctx = V.ctx, st = sim.st, R = V.RR || V.R, Rv = Math.min(R, V.hh || R), type = st.scope.ret;
  const nvc = st.scope.nv;
  const col = nvc ? 'rgba(10,30,14,0.95)' : 'rgba(6,7,9,0.94)';
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = 'butt';
  const L = (x1, y1, x2, y2, w) => { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(cx + x1, cy + y1); ctx.lineTo(cx + x2, cy + y2); ctx.stroke(); };
  const thin = clamp(ppm * 0.035, 0.9, 1.6);
  const font = (px) => { ctx.font = '600 ' + px + 'px ui-monospace,"SF Mono",Menlo,Consolas,monospace'; };
  if (type === 'duplex') {
    const gapR = Rv * 0.2;
    L(-R, 0, -gapR, 0, 4); L(gapR, 0, R, 0, 4); L(0, gapR, 0, R, 4); L(0, -R, 0, -gapR, 4);
    L(-gapR, 0, -3, 0, 1.1); L(3, 0, gapR, 0, 1.1); L(0, 3, 0, gapR, 1.1); L(0, -gapR, 0, -3, 1.1);
    ctx.beginPath(); ctx.arc(cx, cy, 1, 0, TAU); ctx.fill();
  } else if (type === 'post') {
    L(-R, 0, -Rv * 0.16, 0, 5.5); L(Rv * 0.16, 0, R, 0, 5.5);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 5, cy + 16); ctx.lineTo(cx + 5, cy + R); ctx.lineTo(cx - 5, cy + R); ctx.lineTo(cx - 5, cy + 16); ctx.closePath(); ctx.fill();
  } else if (type === 'pso') {
    // range ladder (bottom left), chevrons for holdover, mil hashes for wind
    const chev = (y, sz, w) => { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(cx - sz, cy + y + sz); ctx.lineTo(cx, cy + y); ctx.lineTo(cx + sz, cy + y + sz); ctx.stroke(); };
    chev(0, Math.max(5, ppm * 0.7), 1.5);
    const marks = V.bdcMarks(sim); font(clamp(ppm * 0.9, 8, 12)); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    marks.forEach((m) => { const y = m.mil * ppm; if (y > Rv * 0.93) return; chev(y, Math.max(3.5, ppm * 0.45), 1.2); if (ppm > 7) ctx.fillText(m.label, cx + Math.max(8, ppm * 1.1), cy + y + 3); });
    for (let i = 1; i <= 10; i++) { const x = i * ppm; if (x > R * 0.9) break; const h = i % 5 === 0 ? 6 : 3.5; L(x, -h, x, h, 1.1); L(-x, -h, -x, h, 1.1); }
    // stadiametric ladder: stand a 1.8 m figure on the base line
    const bx = -10 * ppm, byy = 9 * ppm;
    if (Math.hypot(bx * 0.6, byy) < Rv * 0.95) {
      L(-10.4 * ppm, byy, -1.6 * ppm, byy, 1.1);
      ctx.lineWidth = 1.1; ctx.beginPath();
      for (let r = 200; r <= 1000; r += 25) { const x = cx + (-10 + (r - 200) / 100) * ppm, y = cy + byy - (1800 / r) * ppm; if (r === 200) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
      if (ppm > 6) { ctx.textAlign = 'center'; ctx.textBaseline = 'top'; for (let r = 200; r <= 1000; r += 200) ctx.fillText(String(r / 100), cx + (-10 + (r - 200) / 100) * ppm, cy + byy + 3); }
    }
  } else {
    // mil-based reticles: marks are true at every zoom level
    const maxMil = R / ppm;
    L(-R, 0, -4, 0, thin); L(4, 0, R, 0, thin); L(0, 4, 0, R, thin); L(0, -R, 0, -4, thin);
    ctx.beginPath(); ctx.arc(cx, cy, 1.1, 0, TAU); ctx.fill();
    if (type === 'mildot') {
      const dr = clamp(ppm * 0.11, 1.4, 4);
      for (let i = 1; i <= 12; i++) { const d = i * ppm; if (d > R * 0.95) break;
        if (i <= 5) { ctx.beginPath(); ctx.arc(cx + d, cy, dr, 0, TAU); ctx.moveTo(cx - d + dr, cy); ctx.arc(cx - d, cy, dr, 0, TAU); ctx.moveTo(cx + dr, cy - d); ctx.arc(cx, cy - d, dr, 0, TAU); ctx.fill(); }
        ctx.beginPath(); ctx.arc(cx, cy + d, dr, 0, TAU); ctx.fill();
        if (ppm > 11) { L(-3, d - ppm / 2, 3, d - ppm / 2, 1); }
        if (i % 5 === 0 && ppm > 6) { font(clamp(ppm * 0.8, 8, 12)); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(String(i), cx + 8, cy + d); }
      }
      const post = Math.max(6, Math.min(maxMil, 6)) * ppm;
      if (post < R) { L(-R, 0, -post, 0, 3.5); L(post, 0, R, 0, 3.5); L(0, -R, 0, -post, 3.5); }
    } else if (type === 'bdc') {
      const marks = V.bdcMarks(sim); font(clamp(ppm * 0.9, 9, 13)); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      marks.forEach((m) => { const y = m.mil * ppm; if (y > Rv * 0.93) return; const w = clamp(ppm * 1.2, 7, 22) * (m.r % 200 === 0 || m.r < 200 ? 1 : 0.65); L(-w, y, w, y, 1.4); ctx.beginPath(); ctx.arc(cx, cy + y, 1.6, 0, TAU); ctx.fill(); if (ppm > 5) ctx.fillText(m.label, cx + w + 5, cy + y + 0.5); });
      for (let i = 1; i <= 8; i++) { const x = i * ppm; if (x > R * 0.9) break; L(x, -3.5, x, 3.5, 1); L(-x, -3.5, -x, 3.5, 1); }
      L(-R, 0, -Rv * 0.55, 0, 3.5); L(Rv * 0.55, 0, R, 0, 3.5); L(0, -R, 0, -Rv * 0.55, 3.5);
    } else {
      // milhash / tree / fine
      const step = type === 'fine' && ppm > 28 ? 0.2 : ppm > 9 ? 0.5 : 1;
      const numEvery = ppm > 24 ? 1 : 2;
      font(clamp(ppm * 0.55, 8, 12));
      const lim = Math.min(maxMil * 0.95, 24);
      for (let m = step; m <= lim + 1e-6; m += step) {
        const d = m * ppm, whole = Math.abs(m - Math.round(m)) < 1e-6, half = Math.abs(m * 2 - Math.round(m * 2)) < 1e-6;
        const h = whole ? clamp(ppm * 0.3, 3, 9) : half ? clamp(ppm * 0.17, 2, 5) : clamp(ppm * 0.09, 1.5, 3);
        L(-h, d, h, d, thin);
        if (m <= Math.min(lim, 12)) { L(d, -h, d, h, thin); L(-d, -h, -d, h, thin); }
        if (m <= Math.min(lim, 6)) L(-h, -d, h, -d, thin);
        if (whole && Math.round(m) % numEvery === 0 && ppm > 9) { ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(String(Math.round(m)), cx - h - 4, cy + d + 0.5); if (m <= 12 && Math.round(m) % 2 === 0) { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(String(Math.round(m)), cx + d, cy - h - 2); ctx.fillText(String(Math.round(m)), cx - d, cy - h - 2); } }
      }
      if (type === 'tree' && ppm > 8.5) {
        const dr = clamp(ppm * 0.07, 1.1, 2.4), rstep = ppm < 15 ? 2 : 1;
        for (let r = rstep; r <= lim; r += rstep) { const wmax = Math.min(1 + Math.floor(r * 0.6), 8); for (let c = 1; c <= wmax; c++) { ctx.beginPath(); ctx.arc(cx + c * ppm, cy + r * ppm, dr, 0, TAU); ctx.arc(cx - c * ppm, cy + r * ppm, dr, 0, TAU); ctx.fill(); if (ppm > 16 && c <= wmax) { ctx.beginPath(); ctx.arc(cx + (c - 0.5) * ppm, cy + r * ppm, dr * 0.7, 0, TAU); ctx.arc(cx - (c - 0.5) * ppm, cy + r * ppm, dr * 0.7, 0, TAU); ctx.fill(); } } }
      }
    }
  }
  // electronic overlays
  const info = V.rangeInfo;
  if ((st.scope.lrf || st.scope.smart) && info) {
    ctx.fillStyle = nvc ? 'rgba(220,255,225,0.95)' : 'rgba(255,170,60,0.95)';
    ctx.font = '700 ' + clamp(Rv * 0.075, 11, 17) + 'px ui-monospace,"SF Mono",Menlo,Consolas,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // Sideways the picture runs up under the objective line, so the game says where there is room (V.lrfY).
    const ly = !V.round && V.lrfY ? V.lrfY : cy - Math.min(R * 0.72, Rv - 34);
    ctx.fillText(info.d ? (info.mark ? 'MARK ' : '') + Math.round(info.d) + ' m' : '- - -', cx, ly);
  }
  // The pip sits where the round would land right now (see Sim.impactAt), not at the hold for the
  // crosshair's range. With a mark it sits at the drop and drift for the marked distance instead.
  const pip = V.pip;
  if ((st.scope.smart || V.assist === 'full') && pip && pip.ok) {
    const px = cx - pip.right * ppm, py = cy + pip.up * ppm;
    if (Math.hypot(px - cx, py - cy) < R * 0.94) {
      ctx.strokeStyle = 'rgba(255,170,60,0.95)'; ctx.lineWidth = 1.6; const r = 6;
      ctx.beginPath(); ctx.moveTo(px, py - r); ctx.lineTo(px + r, py); ctx.lineTo(px, py + r); ctx.lineTo(px - r, py); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,170,60,0.95)'; ctx.beginPath(); ctx.arc(px, py, 1.3, 0, TAU); ctx.fill();
    }
  }
  // hit confirmation tick marks
  if (V.hitMark > 0.05) {
    ctx.strokeStyle = 'rgba(255,255,255,' + Math.min(1, V.hitMark * 1.4) + ')'; ctx.lineWidth = 2; const a = 9 + (1 - V.hitMark) * 8, b2 = a + 8;
    ctx.beginPath(); [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach((q) => { ctx.moveTo(cx + q[0] * a, cy + q[1] * a); ctx.lineTo(cx + q[0] * b2, cy + q[1] * b2); }); ctx.stroke();
  }
};

// ---- the mark: a distance the player has locked -------------------------------------------
// Without a mark the read-outs measure whatever is in the middle of the scope, and the amber
// marker follows the bullet's own path to whatever it meets first. Both go wrong the moment the
// scope is raised to allow for drop: the middle of the scope is then on whatever is behind the
// target, and once the bullet's path clears the target the marker jumps to the drop for the
// backdrop (it can sit on the target while the round would pass over). A mark fixes that: put the
// crosshair on the target and mark it, and its distance is measured once and kept. Until the
// player marks something else or clears it, RANGE, HOLD and the amber marker use that distance
// however the scope moves. It is a fixed distance, not a person: if they move, mark them again.
// Display only, like the read-outs: nothing in the simulation reads it.
// Who gets it: everyone on Full help, and anyone whose scope has a built-in rangefinder.
View.prototype.canMark = function (sim) { return this.assist === 'full' || !!(sim && sim.st.scope.lrf); };
// Measure what is under the crosshair right now and lock it. Nothing there (the open sky) clears the mark.
View.prototype.setMark = function (sim) {
  const a = sim.aimNow(), r = sim.rangeAt(a.x, a.y), e = sim.eye();
  this.holdT = 0; // fresh numbers on the next frame
  if (!r || !(r.d > 1)) { this.mark = null; return null; }
  // the spot on the line of sight at that distance, for the little marker drawn in the world
  this.mark = { sim, d: r.d, x: e.x + (a.x / 1000) * r.d, y: e.y + (a.y / 1000) * r.d, z: e.z + r.d, at: this.rt };
  return this.mark;
};
View.prototype.clearMark = function () { this.mark = null; this.holdT = 0; };
// the mark, if there is one for this mission (a mark never carries over to another one)
View.prototype.markFor = function (sim) { const m = this.mark; return m && m.sim === sim ? m : null; };

// The marked spot, out in the world: four short ticks pointing in at it (unlike the coach's
// corners, the amber diamond or the coach's ring) and the locked distance beside it. It stays
// where the target was when it was marked, so a target who walks away walks out of it.
View.prototype.drawMark = function (sim, cam) {
  const V = this, mk = V.markFor(sim); if (!mk) return;
  const ctx = V.ctx, p = V.project(sim, mk.x, mk.y, mk.z), x = p[0], y = p[1];
  if (Math.abs(x - cam.cx) > cam.hw - 6 || Math.abs(y - cam.cy) > cam.hh - 6) return;
  const nv = !!sim.st.scope.nv, col = nv ? 'rgba(225,255,230,0.95)' : 'rgba(150,226,255,0.95)';
  const pop = clamp((V.rt - mk.at) / 0.25, 0, 1), r0 = 5 + (1 - pop) * 12, r1 = r0 + 6; // closes in on the spot when it is set
  ctx.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass ? col : 'rgba(0,0,0,0.55)'; ctx.lineWidth = pass ? 1.7 : 3.6;
    ctx.beginPath();
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach((q) => { ctx.moveTo(x + q[0] * r0, y + q[1] * r0); ctx.lineTo(x + q[0] * r1, y + q[1] * r1); });
    ctx.stroke();
  }
  ctx.font = '700 10.5px ui-monospace,"SF Mono",Menlo,Consolas,monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const s = Math.round(mk.d) + ' m', tx = x + r1 + 3, ty = y - r1 + 2;
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeText(s, tx, ty);
  ctx.fillStyle = col; ctx.fillText(s, tx, ty);
  ctx.lineCap = 'butt';
};

// Refresh the spotter's numbers a few times a second (range and hold).
View.prototype.updateReadout = function (sim, dt) {
  this.holdT -= dt;
  if (this.holdT > 0) return;
  this.holdT = 0.14;
  const mk = this.markFor(sim);
  if (mk) { // a marked distance: the same numbers wherever the crosshair goes
    this.rangeInfo = { d: mk.d, mark: true };
    this.hold = mk.d > 20 ? sim.holdFor(mk.d) : null;
    this.pip = this.hold ? Object.assign({ d: mk.d, what: 'mark' }, this.hold) : null;
    return;
  }
  const r = sim.rangeAt(sim.sh.ax, sim.sh.ay);
  this.rangeInfo = r ? { d: r.d, ground: r.ground } : { d: 0 };
  this.hold = r && r.d > 20 ? sim.holdFor(r.d) : null;
  const a = sim.aimNow(), imp = sim.impactAt(a.x, a.y);
  this.pip = imp && imp.d > 20 ? imp : null;
};

CB.View = View;
