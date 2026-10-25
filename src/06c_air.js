// ---------------------------------------------------------------------------
// The air between the shooter and the world: falling snow in three depths, drifting fog,
// lightning, and the colour of the hour laid over the finished picture. All of it is drawn
// after the world and before the glass; none of it changes what anybody can see in the game.
// ---------------------------------------------------------------------------

View.prototype.drawWeather = function (sim, cam) {
  const V = this, S = sim.S, ctx = V.ctx, w = S.weather;
  if (w === 'rain' || w === 'storm') V.drawRain(sim, cam, w === 'storm');
  else if (w === 'snow') V.drawSnow(sim, cam);
  if (w === 'fog') V.drawFogVeil(sim, cam);
  // lightning: the whole picture lit for an instant, hardest on the side the bolt struck
  if (sim.flashT && sim.t - sim.flashT < 0.4) {
    const u = (sim.t - sim.flashT) / 0.4, fl = Math.sin(sim.t * 70) > -0.3 ? 1 : 0.3, k = (1 - u) * fl;
    const b = V.boltFor(sim, cam), side = b ? clamp((b.x - cam.ax) * cam.ppm / cam.hw, -1.4, 1.4) : 0;
    const x0 = cam.cx - cam.hw, W = cam.hw * 2, bx = cam.cx + side * cam.hw;
    // (a gradient here: it lasts a fraction of a second, and flat strips would show their seams)
    const g = ctx.createLinearGradient(bx - W * 1.1, 0, bx + W * 1.1, 0);
    g.addColorStop(0, 'rgba(200,212,255,0.12)'); g.addColorStop(0.5, 'rgba(200,212,255,0.54)'); g.addColorStop(1, 'rgba(200,212,255,0.12)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(k, 0, 1); ctx.fillStyle = g;
    ctx.fillRect(x0, cam.cy - cam.hh, W, cam.hh * 2);
    ctx.restore();
  }
};

// Where this flash's bolt is, in mils: chosen once per flash, somewhere the scope can see it.
View.prototype.boltFor = function (sim, cam) {
  const V = this; if (!sim.flashT) return null;
  if (!V._bolt || V._bolt.t !== sim.flashT || V._bolt.sim !== sim) {
    const h = kxH(sim.flashT * 13.1, 7), span = Math.min(260, (cam.hw / cam.ppm) * 0.8);
    const pts = [], D = makeRng(Math.floor(sim.flashT * 1000) + 3), x = cam.ax + (h * 2 - 1) * span;
    let px = x, py = 150; pts.push(px, py);
    while (py > -5) { py -= D.r(6, 16); px += D.r(-7, 7); pts.push(px, py); }
    const fork = []; { let fx = pts[6], fy = pts[7]; for (let i = 0; i < 4; i++) { fy -= D.r(5, 12); fx += D.r(2, 9) * (h > 0.5 ? -1 : 1); fork.push(fx, fy); } }
    V._bolt = { t: sim.flashT, sim, x, pts, fork };
  }
  return V._bolt;
};
// The bolt itself, in the sky behind everything (called by drawSky).
View.prototype.skyBolt = function (ctx, cam, sim, X, Y) {
  if (!sim.flashT || sim.t - sim.flashT > 0.32) return;
  const b = this.boltFor(sim, cam), u = (sim.t - sim.flashT) / 0.32, a = (1 - u) * (Math.sin(sim.t * 55) > -0.5 ? 1 : 0.2);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // the sky round it lit from inside the cloud
  ctx.globalAlpha = 0.5 * a; const gx = X(b.x), gy = Y(120), R = 180 * cam.ppm * 0.4; ctx.drawImage(kxBlob('#9fb4ff'), gx - R, gy - R * 0.6, R * 2, R * 1.2);
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass ? '#ffffff' : '#a8baff'; ctx.globalAlpha = (pass ? 0.95 : 0.35) * a; ctx.lineWidth = Math.max(pass ? 1.4 : 5, cam.ppm * (pass ? 0.35 : 1.4));
    ctx.beginPath(); ctx.moveTo(X(b.pts[0]), Y(b.pts[1])); for (let i = 2; i < b.pts.length; i += 2) ctx.lineTo(X(b.pts[i]), Y(b.pts[i + 1]));
    ctx.moveTo(X(b.pts[6]), Y(b.pts[7])); for (let i = 0; i < b.fork.length; i += 2) ctx.lineTo(X(b.fork[i]), Y(b.fork[i + 1]));
    ctx.stroke();
  }
  ctx.restore();
};

// Snow in three depths: a haze of fine far flakes, a middle layer, and a few big soft flakes so
// close they are out of focus and cross the glass fast. They pan with the world (they are in it),
// drift with the wind, flutter as they fall, and the closer ones are magnified with the scope.
View.prototype.drawSnow = function (sim, cam) {
  const V = this, ctx = V.ctx, cx = cam.cx, cy = cam.cy, hw = cam.hw, hh = cam.hh, W2 = hw * 2, H2 = hh * 2;
  if (!V.snow) { const R = makeRng(5531); V.snow = []; for (let i = 0; i < 520; i++) V.snow.push([R.f(), R.f(), R.f(), R.r(0.7, 1.3), R.r(0, TAU), R.r(0.6, 1.4)]); }
  const S = sim.S, t = V.rt, wind = sim.wind(), mag = clamp(cam.ppm / 3.3, 0.6, 12), sm = Math.sqrt(mag);
  const heavy = S.time === 'snow' ? 1.35 : 1, area = clamp((W2 * H2) / 150000, 0.5, 3.2);
  const panX = cam.ax * cam.ppm, panY = cam.ay * cam.ppm;
  const L = [ // count, size px, fall px/s, drift px/s per m/s of wind, flutter px, alpha
    [Math.round(170 * area * heavy), 1.1, 26, 5, 3, 0.62],
    [Math.round(70 * area * heavy), 2.2, 58, 11, 6, 0.85],
    [Math.round(12 * area * heavy), 7, 170, 30, 14, 0.42],
  ];
  let base = 0;
  for (let li = 0; li < 3; li++) {
    const q = L[li], n = Math.min(q[0], li === 2 ? 40 : 300), near = li === 2;
    const sz0 = q[1] * (near ? Math.min(3, sm) : li === 1 ? Math.min(1.6, 0.8 + mag * 0.08) : 1), fall = q[2] * (near ? sm : Math.min(2.2, 0.75 + sm * 0.25)), drift = q[3] * (near ? sm : 1);
    if (!near) { ctx.fillStyle = '#ffffff'; ctx.globalAlpha = q[5]; ctx.beginPath(); }
    else ctx.globalAlpha = q[5];
    const blob = near ? kxBlob('#ffffff') : null;
    for (let i = 0; i < n; i++) {
      const f = V.snow[(base + i) % V.snow.length], sp = f[3], sz = sz0 * f[5];
      const fl = Math.sin(t * (1.1 + sp) + f[4]) * q[4] * (0.6 + f[2] * 0.6);
      const X = (((f[0] * W2 + t * wind * drift * sp + fl - panX) % W2) + W2) % W2, Yy = (((f[1] * H2 + t * fall * sp + panY) % (H2 + 20)) + H2 + 20) % (H2 + 20) - 10;
      if (near) ctx.drawImage(blob, cx - hw + X - sz, cy - hh + Yy - sz, sz * 2, sz * 2);
      else { ctx.moveTo(cx - hw + X + sz / 2, cy - hh + Yy); ctx.arc(cx - hw + X, cy - hh + Yy, sz / 2, 0, TAU); }
    }
    if (!near) ctx.fill();
    base += n;
  }
  ctx.globalAlpha = 1;
};

// Fog: a thin even veil and broad banks of thicker fog drifting slowly across through it.
View.prototype.drawFogVeil = function (sim, cam) {
  const V = this, ctx = V.ctx, S = sim.S, fog = S.pal.fog, t = V.rt, wind = sim.wind();
  ctx.fillStyle = rgba(fog, 0.14); ctx.fillRect(cam.cx - cam.hw, cam.cy - cam.hh, cam.hw * 2, cam.hh * 2);
  const blob = kxBlob(fog), W = cam.hw * 2, ppm = cam.ppm;
  ctx.save();
  for (let i = 0; i < 4; i++) {
    // each bank sits at a height (in mils) and drifts along; it is wide in the world, so it pans with it
    const my = [-12, -4, 6, -20][i], wd = [420, 300, 520, 360][i] * ppm * 0.6, sp = (8 + i * 5) * (wind < 0 ? -1 : 1);
    const mx = ((((i * 260 + t * sp) % 1600) + 1600) % 1600) - 800, x = cam.cx + (mx - cam.ax) * ppm, y = cam.cy - (my - cam.ay) * ppm;
    if (x + wd < cam.cx - cam.hw || x - wd > cam.cx + cam.hw) continue;
    ctx.globalAlpha = 0.22; ctx.drawImage(blob, x - wd, y - wd * 0.16, wd * 2, wd * 0.32);
  }
  ctx.restore();
};

// The colour of the hour. Every look (07i_looks.js) can lay a wash over the finished picture:
// a soft-light tint from the top and another from the bottom (blue in the shadows on a moonlit
// night, amber low down at sunset), a little more colour by day, and the glow of a low sun in
// the air. Painted in thin flat bands, never as a gradient, and kept light enough that people
// and the things players look for stay as easy to see as before.
const AIR_GRADE = {
  day: { top: '#3f6fb8', bot: '#ffd29a', a: 0.06 }, dawn: { bot: '#ffb08a', top: '#8a9ad0', a: 0.08, glow: 0.12 }, dusk: { bot: '#ff9a50', top: '#5a4aa0', a: 0.1, glow: 0.14 },
  night: { top: '#3050a0', a: 0.1 }, overcast: { top: '#a8b4c0', a: 0.05 }, snow: { top: '#c4d4e6', a: 0.06 },
};
View.prototype.drawGrade = function (sim, cam) {
  const V = this, ctx = V.ctx, S = sim.S, G = S._grade || (S._grade = Object.assign({}, AIR_GRADE[S.time] || AIR_GRADE.day, (S.look && S.look.grade) || {}));
  const x0 = cam.cx - cam.hw, y0 = cam.cy - cam.hh, W = cam.hw * 2, H = cam.hh * 2, a = G.a || 0.08;
  ctx.save();
  // one pass of soft light in flat bands: the top tint fading down, the bottom tint fading up,
  // a warm cast over all of it (each band is cut on whole pixels so none overlap)
  const top = G.top || null, bot = G.bot || null, warm = G.warm || 0;
  if (top || bot || warm) {
    const n = 12; ctx.globalCompositeOperation = 'soft-light';
    let prev = Math.round(y0);
    for (let i = 0; i < n; i++) {
      const v = (i + 0.5) / n, ka = top ? 1 - v : 0, kb = bot ? v : 0, next = Math.round(y0 + (H * (i + 1)) / n);
      let col = top && bot ? mix(top, bot, kb / Math.max(1e-6, ka + kb)) : (top || bot || '#ffb86a'), al = a * 2.4 * Math.max(ka, kb);
      if (warm) { col = mix(col, '#ffb86a', warm / (warm + al + 1e-6)); al += warm * 2.5; }
      if (al > 0.005 && next > prev) { ctx.fillStyle = col; ctx.globalAlpha = clamp(al, 0, 1); ctx.fillRect(x0, prev, W, next - prev); }
      prev = next;
    }
  }
  // the haze round a low sun, lit up over everything near it
  if (G.glow && S.pal.dark < 0.5) {
    const sx = cam.cx + (S.sky.sun[0] - cam.ax) * cam.ppm, sy = cam.cy - (S.sky.sun[1] - cam.ay) * cam.ppm, R = Math.max(W, H) * 0.9;
    if (sx > x0 - R && sx < x0 + W + R && sy < y0 + H + R) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = G.glow; ctx.drawImage(kxBlob(S.time === 'day' ? '#fff0d0' : '#ff9a50'), sx - R, sy - R * 0.8, R * 2, R * 1.6); }
  }
  ctx.restore();
};

// Keep a copy of the finished world for the water to mirror next frame (only where there is
// water: it costs one copy of the picture).
View.prototype.keepFrame = function (sim) {
  const S = sim.S; if (!S._water) return;
  const cv = this.ctx.canvas;
  if (!this._frame || this._frame.width !== cv.width || this._frame.height !== cv.height) { this._frame = kxCanvas(cv.width, cv.height); this._frameG = this._frame.getContext('2d'); }
  this._frameG.globalCompositeOperation = 'copy'; this._frameG.drawImage(cv, 0, 0);
  kxRefl.src = this._frame; kxRefl.srcCv = cv;
};
