// ---------------------------------------------------------------------------
// The sky: its colour, the sun or the moon, the stars and the Milky Way, sun rays and the
// clouds. Everything up here is placed by angle (mils from straight ahead, y up from the
// horizon), not by distance, so it never slides against itself as the eye moves; it only
// pans with the scope. None of it is gameplay: it reads the scene, never changes it.
//
// The look of a mission (S.look, see 07i_looks.js) can tune all of it: how much cloud,
// what kind, the moon's phase, how many stars a town's glow leaves, a Milky Way.
// ---------------------------------------------------------------------------

// ---- colour on the sky --------------------------------------------------------------
const skyRgbCache = new Map();
function skyRgb(r, g, b) {
  r = Math.round(clamp(r, 0, 255)); g = Math.round(clamp(g, 0, 255)); b = Math.round(clamp(b, 0, 255));
  const k = (r << 16) | (g << 8) | b; let s = skyRgbCache.get(k);
  if (!s) { if (skyRgbCache.size > 5000) skyRgbCache.clear(); s = 'rgb(' + r + ',' + g + ',' + b + ')'; skyRgbCache.set(k, s); }
  return s;
}
// A vertical run of colours on screen as thin flat bands: a gradient costs many times as much
// per pixel on a phone. stops: [[y, '#hex'], ...] in screen pixels from top to bottom.
function skyBands(ctx, stops, x0, x1, yA, yB) {
  const w = x1 - x0;
  if (yA < stops[0][0]) { ctx.fillStyle = stops[0][1]; ctx.fillRect(x0, yA, w, Math.min(yB, stops[0][0]) - yA); }
  for (let i = 0; i < stops.length - 1; i++) {
    const ya = stops[i][0], yb = stops[i + 1][0]; if (yb <= yA || ya >= yB || yb <= ya) continue;
    const A = rgbOf(stops[i][1]), B = rgbOf(stops[i + 1][1]);
    const diff = Math.max(Math.abs(A[0] - B[0]), Math.abs(A[1] - B[1]), Math.abs(A[2] - B[2]));
    const n = clamp(Math.ceil(diff * 1.2), 1, Math.max(1, Math.ceil((yb - ya) / 2.5)));
    for (let k = 0; k < n; k++) {
      const b0 = Math.round(ya + ((yb - ya) * k) / n), b1 = Math.round(ya + ((yb - ya) * (k + 1)) / n);
      if (b1 <= yA || b0 >= yB || b1 <= b0) continue;
      const u = (k + 0.5) / n;
      ctx.fillStyle = skyRgb(lerp(A[0], B[0], u), lerp(A[1], B[1], u), lerp(A[2], B[2], u));
      const c0 = Math.max(b0, yA), c1 = Math.min(b1, yB); ctx.fillRect(x0, c0, w, c1 - c0);
    }
  }
  const yl = stops[stops.length - 1][0];
  if (yB > yl) { ctx.fillStyle = stops[stops.length - 1][1]; ctx.fillRect(x0, Math.max(yA, yl), w, yB - Math.max(yA, yl)); }
}

// ---- what the sky is like for a scene, worked out once ---------------------------------
// Cloud colours for each time of day: the lit top, the body, the shaded side and the flat base.
const SKY_CLOUD = {
  day: { lit: '#ffffff', body: '#eef3f8', shade: '#c3d0de', under: '#a7b7ca' },
  dawn: { lit: '#fff0dc', body: '#f2cdbd', shade: '#b39aae', under: '#93809c' },
  dusk: { lit: '#ffcf8f', body: '#e2967c', shade: '#875a78', under: '#5f4466' },
  night: { lit: '#4f5f84', body: '#1d2843', shade: '#131b31', under: '#0e1427' },
  overcast: { lit: '#d9dfe5', body: '#b3bcc5', shade: '#919ba5', under: '#7b858f' },
  snow: { lit: '#ffffff', body: '#e7edf3', shade: '#c7d2dd', under: '#b2bfcc' },
};
// The light on smoke and steam: the colour of its lit side and of its shaded side.
const SKY_AIR = { day: ['#ffffff', '#7486a0'], dawn: ['#ffe4cc', '#7a6a8c'], dusk: ['#ffc48a', '#5a4468'], night: ['#9aa8c8', '#1a2032'], overcast: ['#eef1f4', '#7a838d'], snow: ['#ffffff', '#93a3b6'] };
// The colour between the zenith and the horizon (a sky is not a straight fade from one to the other).
const SKY_MID = { day: '#5ea4e2', dawn: '#9a7fa6', dusk: '#7b4670', night: '#0b1430', overcast: '#97a2ac', snow: '#b8c8d8' };

function skyStyle(S) {
  if (S._sky) return S._sky;
  const pal = S.pal, t = S.time, w = S.weather, L = (S.look && S.look.sky) || {};
  const wet = w === 'rain' || w === 'storm', grey = wet || t === 'overcast' || w === 'fog' || w === 'snow';
  const cc = Object.assign({}, SKY_CLOUD[t] || SKY_CLOUD.day, L.cloudCols || {});
  if (wet && t !== 'night') { cc.lit = mix(cc.lit, '#9aa3ac', 0.35); cc.body = mix(cc.body, '#7d8792', 0.45); cc.shade = mix(cc.shade, '#5a636d', 0.4); cc.under = mix(cc.under, '#4a525b', 0.45); }
  if (w === 'storm') { for (const k in cc) cc[k] = mix(cc[k], '#1c2028', 0.35); }
  const D = makeRng(hashStr((S.look && S.look.id) || t + w) * 7 + Math.round(S.refZ));
  const sky = {
    top: L.top || pal.skyTop, mid: L.mid || SKY_MID[t] || mix(pal.skyTop, pal.skyBot, 0.5), bot: L.bot || pal.skyBot, glow: L.glow || null, cc,
    night: pal.dark > 0.5 ? 1 : 0, grey, wet,
    // how much of each kind of cloud: puffy heaps, thin high streaks, a low grey deck
    heaps: L.heaps !== undefined ? L.heaps : wet || w === 'fog' ? 0 : t === 'overcast' || w === 'snow' ? 0.15 : t === 'night' ? 0.35 : 0.6,
    cirrus: L.cirrus !== undefined ? L.cirrus : grey ? 0 : t === 'night' ? 0.4 : 0.8,
    deck: L.deck !== undefined ? L.deck : wet ? 1 : t === 'overcast' || w === 'snow' ? 0.85 : w === 'fog' ? 0.6 : 0,
    stars: (L.stars === undefined ? 1 : L.stars) * pal.star * (wet || w === 'fog' ? 0 : t === 'overcast' ? 0.2 : 1),
    milky: L.milky || 0, moon: L.moon === undefined ? 0.72 : L.moon, rays: L.rays === undefined ? (t === 'dawn' || t === 'dusk') && !wet : L.rays,
    cityGlow: L.cityGlow === undefined ? (S.ambience === 'city' || S.ambience === 'harbour' ? 1 : 0) : L.cityGlow,
    drift: L.drift === undefined ? 1 : L.drift, clouds: [], streaks: [], deckRows: [], jets: [],
    sunX: S.sky.sun[0], lowSun: pal.dark < 0.5 && (t === 'dawn' || t === 'dusk' || S.sky.sun[1] < 30),
  };
  // The sun (or moon) sits where the scene says; keep the big clouds out of its band so it is never hidden for long.
  const sun = S.sky.sun, avoid = (y, h) => Math.abs(y + h * 0.4 - sun[1]) < 18 + h * 0.6;
  const nH = Math.round(sky.heaps * 22);
  for (let i = 0; i < nH; i++) {
    let y = D.r(8, 135); const W = D.r(22, 64) * (0.5 + y / 150); let tries = 0;
    while (avoid(y, W * 0.35) && tries++ < 6) y = D.r(8, 135);
    sky.clouds.push(skyMakeHeap(D, D.r(-600, 600), y, W, D.r(0.28, 0.42)));
  }
  sky.clouds.sort((a, b) => b.y - a.y);   // the highest (and so the farthest) first
  const nC = Math.round(sky.cirrus * 10);
  for (let i = 0; i < nC; i++) sky.streaks.push({ x: D.r(-600, 600), y: D.r(60, 210), w: D.r(40, 130), h: D.r(1.2, 3.6), sk: D.r(-0.3, 0.3), a: D.r(0.25, 0.6), n: D.i(2, 4), s: D.f() });
  if (sky.deck > 0) {
    // layers of a grey deck, like sheets of torn paper: high and pale to low and dark
    const rows = Math.round(3 + sky.deck * 3);
    for (let r = 0; r < rows; r++) {
      const u = r / Math.max(1, rows - 1), y = lerp(175, 8, Math.pow(u, 0.8)) + D.r(-5, 5);
      sky.deckRows.push({ y, k: u, s: D.r(0, 100), th: lerp(30, 9, u) * D.r(0.8, 1.2), sp: lerp(0.05, 0.16, u), rain: sky.wet && u > 0.45 ? D.r(0.4, 1) : 0 });
    }
  }
  // airliners passing high over, a few minutes apart
  if (!grey) for (let i = 0; i < 2; i++) sky.jets.push({ y: D.r(70, 150), dy: D.r(-12, 12), dir: D.chance(0.5) ? 1 : -1, per: D.r(170, 260), ph: D.f(), sp: D.r(7, 10) });
  S._sky = sky;
  return sky;
}
// A heap of cumulus: a flat base and lobes piled over it, biggest in the middle. Each lobe can
// be split into smaller ones along its upper edge when the scope is close enough to show them.
function skyMakeHeap(D, x, y, W, tall) {
  const H = W * tall, lobes = [], n = Math.max(5, Math.round(W / 6));
  // a row along the base so the bottom runs flat and unbroken
  const nb = Math.max(3, Math.round(W / 14));
  for (let k = 0; k < nb; k++) { const u = (k + 0.5) / nb, lx = (u - 0.5) * W * 0.9 + D.r(-0.2, 0.2) * (W / nb), r = H * D.r(0.2, 0.3) * (1 - 0.35 * Math.abs(2 * u - 1)); lobes.push({ x: lx, y: r * D.r(0.45, 0.7), r, s: D.f() }); }
  // then lobes of very different sizes heaped inside a lopsided dome
  const lean = D.r(-0.25, 0.25);
  for (let k = 0; k < n; k++) {
    const lx = D.r(-0.46, 0.46) * W, v = (lx / W) * 2 - lean, env = H * Math.pow(Math.max(0, 1 - v * v), 0.55) * D.r(0.75, 1.05);
    if (env < H * 0.25) continue;
    const r = H * Math.pow(D.f(), 1.6) * 0.32 + H * 0.1;
    lobes.push({ x: lx, y: clamp(env - r * D.r(0.7, 1.05), r * 0.45, H), r: Math.min(r, env * 0.6), s: D.f() });
  }
  let x0 = 1e9, x1 = -1e9, top = 0;
  for (const q of lobes) { x0 = Math.min(x0, q.x - q.r); x1 = Math.max(x1, q.x + q.r); top = Math.max(top, q.y + q.r); }
  return { x, y, W, H, lobes, x0, x1, top, seed: D.f() * 1000 };
}
// The smaller lobes along the upper edge of a lobe (made the first time they are wanted).
function skyKids(q, seed) {
  if (q.kids) return q.kids;
  const kids = q.kids = [], n = 5 + Math.floor(kxH(seed, q.s * 91) * 3);
  for (let i = 0; i < n; i++) {
    const a = 0.25 + ((i + 0.5) / n) * (Math.PI - 0.5) + (kxH(seed + i, q.s) - 0.5) * 0.3, cr = q.r * (0.26 + kxH(i * 3.1, seed + q.s) * 0.16);
    const d = q.r - cr * 0.5;
    kids.push({ x: q.x + Math.cos(a) * d, y: q.y + Math.sin(a) * d, r: cr, s: kxH(i * 7.7, q.s * 13 + seed) });
  }
  return kids;
}

// ---- drawing ------------------------------------------------------------------------------
// The view calls this first every frame, with whichever camera is drawing (the scope or the
// kill camera). dt is the frame time.
View.prototype.drawSky = function (sim, cam) {
  const V = this, ctx = V.ctx, S = sim.S, pal = S.pal, sky = skyStyle(S), t = V.rt;
  sky.windNow = sim.wind();
  // a loud shot: the birds about the scene take fright when the sound reaches them
  if (V._shotSim !== sim) { V._shotSim = sim; V._shotN = sim.stats.shots; }
  else if (sim.stats.shots > V._shotN) { V._shotN = sim.stats.shots; if (!sim.st.quiet) kxScareNow(S, sim.sh.lastFire); }
  // tell the smoke and steam how they are lit this frame
  const air = SKY_AIR[S.time] || SKY_AIR.day, side = S.sky.sun[0] < 0 ? -1 : 1;
  kxAir.side = side; kxAir.lit = sky.wet ? mix(air[0], '#9aa4ae', 0.5) : air[0]; kxAir.shade = air[1]; kxAir.soft = pal.dark > 0.5; kxAir.key = S.time + S.weather + side;
  const cx = cam.cx, cy = cam.cy, hw = cam.hw, hh = cam.hh, ppm = cam.ppm;
  const X = (mx) => cx + (mx - cam.ax) * ppm, Y = (my) => cy - (my - cam.ay) * ppm;
  const top = cy - hh, bot = cy + hh, left = cx - hw, right = cx + hw;
  // which part of the sky is on screen, in mils
  const my1 = cam.ay + hh / ppm, my0 = cam.ay - hh / ppm, mx0 = cam.ax - hw / ppm, mx1 = cam.ax + hw / ppm;
  // ---- the colour: zenith, a middle tone, the horizon and a band of haze right along it ----
  const glow = sky.glow || mix(sky.bot, '#ffffff', sky.night ? 0.04 : 0.18);
  skyBands(ctx, [[Y(260), sky.top], [Y(95), sky.mid], [Y(22), sky.bot], [Y(2), glow], [Y(-6), pal.fog]], left, right, top, bot);
  if (my1 < -10) return;   // looking down at the ground: nothing of the sky shows
  const sun = S.sky.sun, sx = X(sun[0]), sy = Y(sun[1]);
  // ---- stars and the Milky Way ----
  if (sky.stars > 0.01) { if (sky.milky > 0) V.skyMilky(ctx, cam, sky, X, Y); V.skyStars(ctx, cam, sky, mx0, mx1, my0, my1, t); }
  // ---- sun or moon ----
  const veiled = sky.wet || S.time === 'overcast' || S.weather === 'fog';
  if (sky.night) { if (!veiled || S.weather === 'fog') V.skyMoon(ctx, cam, sky, sx, sy, veiled); }
  else V.skySun(ctx, cam, sky, sx, sy, veiled, mx0, mx1, my1);
  // ---- clouds: high streaks, then the heaps, then the low deck ----
  const drift = (sim.t * sign(sim.windBase || 1)) * sky.drift;
  if (sky.streaks.length) V.skyCirrus(ctx, cam, sky, drift, X, Y, mx0, mx1, my0, my1, sx, sy);
  if (sky.jets.length) V.skyJets(ctx, cam, sim, sky, X, Y, mx0, mx1, my0, my1);
  if (sky.clouds.length) V.skyHeaps(ctx, cam, sky, drift, X, Y, mx0, mx1, my0, my1);
  V.skyBolt(ctx, cam, sim, X, Y);   // lightning, behind the lowest cloud
  if (sky.deckRows.length) V.skyDeck(ctx, cam, sky, drift, X, Y, mx0, mx1, my0, my1, S);
};

// Stars. They come from a fixed pattern over the whole sky, cell by cell, so they never swim;
// zooming in brings out fainter ones, as a real scope does. Each one twinkles on its own, and
// they thin out toward the horizon where the air is thick.
View.prototype.skyStars = function (ctx, cam, sky, mx0, mx1, my0, my1, t) {
  const ppm = cam.ppm, k = sky.stars, cx = cam.cx, cy = cam.cy;
  const cols = ['#ffffff', '#d4e2ff', '#ffe6c2'];
  if (!this._starBins) { this._starBins = []; for (let i = 0; i < 18; i++) this._starBins.push([]); }
  const bins = this._starBins; for (let i = 0; i < 18; i++) bins[i].length = 0;
  const lo = Math.max(my0, -2);
  for (let lv = 0; lv < 4; lv++) {
    const cell = [26, 9, 3, 1][lv], cp = cell * ppm; if (cp < 16) continue;
    const i0 = Math.floor(mx0 / cell), i1 = Math.floor(mx1 / cell), j0 = Math.floor(lo / cell), j1 = Math.floor(my1 / cell);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > 900) continue;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const h = kxH(i * 1.37 + lv * 101, j * 2.11 + lv * 37);
      // the Milky Way is crowded with faint stars
      const band = sky.milky ? skyMilkyAt(sky, (i + 0.5) * cell, (j + 0.5) * cell) : 0;
      if (h > 0.55 + band * 0.4) continue;
      const u = kxH(i * 3.7 + 11, j * 1.9 + lv), v = kxH(i * 5.3 + lv, j * 7.1 + 3), mx = (i + u) * cell, my = (j + v) * cell;
      if (my < -2) continue;
      const mag = Math.pow(kxH(i + 0.3, j + lv * 9.1), 2.6) * [1, 0.75, 0.5, 0.36][lv];
      const ext = smooth((my + 2) / 22), tw = 0.62 + 0.38 * Math.sin(t * (5 + h * 9) + u * 40) * (0.5 + 0.5 * Math.sin(t * 1.3 + v * 20));
      const a = clamp((0.2 + mag * 1.2) * k * ext * (0.7 + 0.3 * tw), 0, 1); if (a < 0.04) continue;
      const sz = 0.7 + mag * 1.6, col = v < 0.12 ? 1 : v > 0.9 ? 2 : 0;
      bins[col * 6 + Math.min(5, Math.floor(a * 6))].push(cx + (mx - cam.ax) * ppm - sz / 2, cy - (my - cam.ay) * ppm - sz / 2, sz);
    }
  }
  for (let b = 0; b < 18; b++) {
    const q = bins[b]; if (!q.length) continue;
    ctx.fillStyle = cols[Math.floor(b / 6)]; ctx.globalAlpha = ((b % 6) + 0.6) / 6; ctx.beginPath();
    for (let i = 0; i < q.length; i += 3) ctx.rect(q[i], q[i + 1], q[i + 2], q[i + 2]);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};
// The Milky Way: a long soft band across the sky with dark lanes of dust down it.
const SKY_MW = { a: -0.42, x: 40, y: 120, len: 1400, w: 70 };
function skyMilkyAt(sky, mx, my) {
  const c = Math.cos(SKY_MW.a), s = Math.sin(SKY_MW.a), dx = mx - SKY_MW.x, dy = my - SKY_MW.y, across = -dx * s + dy * c;
  return Math.max(0, 1 - Math.abs(across) / SKY_MW.w);
}
let skyMwPic = null;
View.prototype.skyMilky = function (ctx, cam, sky, X, Y) {
  if (!skyMwPic) {
    const W = 512, H = 96, c = kxCanvas(W, H), g = c.getContext('2d'), im = g.createImageData(W, H), d = im.data;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const u = i / W, v = (j + 0.5) / H * 2 - 1, wob = 0.18 * vnoise(u * 9, 3) + 0.08 * vnoise(u * 31, 8);
      const core = Math.exp(-Math.pow((v - wob) / 0.42, 2)), dust = Math.max(0, vnoise(u * 22 + v * 3, 21) * 0.8 + vnoise(u * 60 + v * 9, 4) * 0.4);
      const lane = Math.exp(-Math.pow((v - wob * 0.7 + 0.08) / 0.12, 2)) * (0.5 + 0.5 * vnoise(u * 14, 9));
      let a = core * (0.55 + 0.45 * dust) * (1 - 0.75 * lane) * Math.min(1, u * 6, (1 - u) * 6);
      a = clamp(a, 0, 1); const k = (j * W + i) * 4;
      d[k] = 200 + 40 * dust; d[k + 1] = 208 + 30 * dust; d[k + 2] = 255; d[k + 3] = Math.round(a * 255);
    }
    g.putImageData(im, 0, 0); skyMwPic = c;
  }
  const ppm = cam.ppm, x = X(SKY_MW.x), y = Y(SKY_MW.y), L = SKY_MW.len * ppm, Wd = SKY_MW.w * 2 * ppm;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(0.32 * sky.milky * sky.stars, 0, 0.5);
  ctx.translate(x, y); ctx.rotate(-SKY_MW.a); ctx.drawImage(skyMwPic, -L / 2, -Wd / 2, L, Wd);
  ctx.restore();
};

// The moon: a real one, with its seas and craters, lit from one side by its phase, a soft glow
// round it and a wider faint halo. Nothing about it is ever darker than the sky behind it.
const skyMoonPics = new Map();
function skyMoonPic(phase, N) {
  const key = Math.round(phase * 40) + ':' + N; let c = skyMoonPics.get(key); if (c) return c;
  if (skyMoonPics.size > 6) skyMoonPics.clear();
  c = kxCanvas(N, N); const g = c.getContext('2d'), R = N / 2 - 1, im = g.createImageData(N, N), d = im.data;
  // phase 0 new, 0.5 full, 1 new again; lit from the right while waxing
  const k = Math.cos(phase * TAU), wax = phase < 0.5 ? 1 : -1;
  // the seas, laid out roughly as they are on the real moon, and craters scattered over the highlands
  const seas = [[-0.55, -0.05, 0.3, 0.5], [-0.28, -0.42, 0.3, 0.23], [0.18, -0.38, 0.16, 0.15], [0.32, -0.08, 0.2, 0.17], [0.68, -0.28, 0.1, 0.09], [0.55, 0.15, 0.12, 0.17], [-0.18, 0.35, 0.2, 0.14], [0.36, 0.28, 0.08, 0.08], [0.0, -0.68, 0.38, 0.06], [-0.48, 0.42, 0.09, 0.09]];
  const craters = []; const D = makeRng(77);
  for (let i = 0; i < 70; i++) { const a = D.r(0, TAU), rr = Math.sqrt(D.f()) * 0.93; craters.push([Math.cos(a) * rr, Math.sin(a) * rr, D.r(0.018, 0.075) * (i < 8 ? 1.5 : 1), D.f()]); }
  craters.push([-0.1, 0.72, 0.045, 2], [-0.3, -0.12, 0.05, 2]);   // two young bright ones, with rays
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i + 0.5 - N / 2) / R, y = (j + 0.5 - N / 2) / R, r2 = x * x + y * y; const kk = (j * N + i) * 4;
    if (r2 > 1.0) { d[kk + 3] = 0; continue; }
    const z = Math.sqrt(1 - r2);
    let sea = 0; const wob = vnoise(x * 9, 5) * 0.18 + vnoise(y * 13, 6) * 0.1;
    for (let q = 0; q < seas.length; q++) { const M = seas[q], u = Math.hypot((x - M[0]) / M[2], (y - M[1]) / M[3]) + wob; sea = Math.max(sea, 1 - smooth((u - 0.75) * 3)); }
    let alb = 1 - 0.3 * sea + 0.05 * vnoise(x * 17 + y * 6, 13) + 0.03 * vnoise(x * 41 - y * 33, 14);
    for (let q = 0; q < craters.length; q++) {
      const C = craters[q], dx = x - C[0], dy = y - C[1], reach = C[2] * (C[3] === 2 ? 9 : 1.2);
      if (dx > reach || dx < -reach || dy > reach || dy < -reach) continue;
      const dd = Math.sqrt(dx * dx + dy * dy) / C[2];
      if (C[3] === 2 && dd < 9) { const ang = Math.atan2(dy, dx); alb += 0.12 * Math.max(0, Math.sin(ang * 7 + C[0] * 30) * 0.5 + Math.sin(ang * 13) * 0.5) * (1 - dd / 9) * (dd > 1.2 ? 1 : 0); }
      if (dd > 1.2) continue;
      if (C[3] === 2) { alb += dd < 0.7 ? 0.14 : 0.08; continue; }
      if (dd < 0.78) alb -= 0.1 * (0.5 + C[3] * 0.5) * (1 - sea * 0.5);
      else alb += 0.11 * clamp((dx * wax) / (dd * C[2] + 1e-6), -0.5, 1);
    }
    // light: the terminator falls where the lit half ends, with a soft edge
    const L1 = smooth(skyTerm(x * wax, z, k) * 12 + 0.5), limb = 0.84 + 0.16 * z, b = clamp(alb, 0.45, 1.15) * limb * (0.86 + 0.14 * L1);
    // the unlit part is left almost clear (a trace of earthshine), so it is never darker than the sky
    d[kk] = Math.round(clamp(244 * b, 0, 255)); d[kk + 1] = Math.round(clamp(239 * b, 0, 255)); d[kk + 2] = Math.round(clamp(224 * b, 0, 255));
    const edge = clamp((1 - Math.sqrt(r2)) * R * 1.2, 0, 1);
    d[kk + 3] = Math.round(255 * edge * (L1 + (1 - L1) * 0.05));
  }
  g.putImageData(im, 0, 0); skyMoonPics.set(key, c); return c;
}
// How much of a point on the moon's face is in sunlight, as a signed distance (positive = lit).
// lx is across the face toward the sun, z out of the face, k the cosine of the phase angle.
function skyTerm(lx, z, k) { const s = Math.sqrt(Math.max(0, 1 - k * k)); return lx * s - z * k; }
View.prototype.skyMoon = function (ctx, cam, sky, sx, sy, veiled) {
  const ppm = cam.ppm, r = 4.6 * ppm, hw = cam.hw, hh = cam.hh;
  if (sx < cam.cx - hw - r * 14 || sx > cam.cx + hw + r * 14 || sy < cam.cy - hh - r * 14 || sy > cam.cy + hh + r * 14) return;
  const full = 1 - Math.abs(sky.moon - 0.5) * 2, bright = 0.35 + 0.65 * full;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  // a wide faint halo first, behind the disc
  ctx.globalAlpha = (veiled ? 0.3 : 0.16) * bright; ctx.drawImage(kxBlob('#8ea2d8'), sx - r * 16, sy - r * 16, r * 32, r * 32);
  if (veiled) { ctx.globalAlpha = 0.12; ctx.strokeStyle = '#cfd9ff'; ctx.lineWidth = Math.max(1, r * 0.35); ctx.beginPath(); ctx.arc(sx, sy, r * 7.5, 0, TAU); ctx.stroke(); }
  ctx.restore();
  if (!veiled) { const N = r * 2 > 180 ? 512 : r * 2 > 70 ? 256 : 128; ctx.drawImage(skyMoonPic(sky.moon, N), sx - r, sy - r, r * 2, r * 2); }
  // the glow close round it is in the air in front of the moon, so it lies over the whole disc
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = (veiled ? 0.45 : 0.26) * bright; ctx.drawImage(kxBlob('#dfe6ff'), sx - r * 5, sy - r * 5, r * 10, r * 10);
  ctx.restore();
};
// The sun: a soft glow, a bright disc, and when it is low a few thin bars of cloud across it,
// rays fanning out of it, and the light catching in the haze along the horizon.
View.prototype.skySun = function (ctx, cam, sky, sx, sy, veiled, mx0, mx1, my1) {
  const ppm = cam.ppm, r = 5.2 * ppm, low = sky.lowSun, cc = sky.cc, hw = cam.hw, hh = cam.hh;
  const near = sx > cam.cx - hw - r * 30 && sx < cam.cx + hw + r * 30 && sy > cam.cy - hh - r * 30 && sy < cam.cy + hh + r * 30;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (near) {
    // a wide warm bloom in the haze and a tighter one round the disc, both well below white
    ctx.globalAlpha = veiled ? 0.16 : low ? 0.3 : 0.16; ctx.drawImage(kxBlob(low ? '#ff9a50' : '#fff0c8'), sx - r * 20, sy - r * 20, r * 40, r * 40);
    ctx.globalAlpha = veiled ? 0.18 : low ? 0.32 : 0.22; ctx.drawImage(kxBlob(low ? '#ffd08a' : '#fff8e8'), sx - r * 4.5, sy - r * 4.5, r * 9, r * 9);
  }
  // rays: faint soft wedges fanning out of a low sun through the haze, slowly turning
  if (sky.rays && !veiled) {
    const L = Math.max(hw, hh) * 2.4, g = ctx.createRadialGradient(sx, sy, r * 1.5, sx, sy, L);
    g.addColorStop(0, 'rgba(255,214,160,0.09)'); g.addColorStop(0.25, 'rgba(255,200,150,0.045)'); g.addColorStop(1, 'rgba(255,190,140,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath();
    const n = 9, sway = Math.sin(this.rt * 0.04) * 0.03;
    for (let i = 0; i < n; i++) {
      const a0 = Math.PI * (-0.1 + 1.2 * (i + kxH(i, 3) * 0.5) / n) + sway, wd = 0.07 + kxH(i, 7) * 0.1, f = 0.5 + kxH(i, 5) * 0.5;
      ctx.moveTo(sx + Math.cos(a0) * r * 1.5, sy + Math.sin(a0) * r * 1.5); ctx.lineTo(sx + Math.cos(a0) * L * f, sy + Math.sin(a0) * L * f); ctx.lineTo(sx + Math.cos(a0 + wd) * L * f, sy + Math.sin(a0 + wd) * L * f); ctx.lineTo(sx + Math.cos(a0 + wd) * r * 1.5, sy + Math.sin(a0 + wd) * r * 1.5); ctx.closePath();
    }
    ctx.fill();
  }
  ctx.restore();
  if (!near || veiled) return;
  // the disc: a pale rim and a white heart, so it is the brightest thing in the sky
  ctx.fillStyle = low ? '#ffe2b0' : '#fff6dc'; ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
  ctx.fillStyle = low ? '#fff4dc' : '#ffffff'; ctx.beginPath(); ctx.arc(sx, sy, r * 0.86, 0, TAU); ctx.fill();
  if (low) {
    ctx.fillStyle = cc.shade; ctx.globalAlpha = 0.7; ctx.beginPath();
    for (let i = 0; i < 3; i++) { const yy = sy + r * (0.15 + i * 0.32), len = r * (2.4 - i * 0.3), th = r * (0.07 + i * 0.03), dx = Math.sin(this.rt * 0.03 + i) * r * 0.4; ctx.moveTo(sx - len + dx, yy); ctx.quadraticCurveTo(sx + dx, yy - th * 2, sx + len + dx, yy); ctx.quadraticCurveTo(sx + dx, yy + th * 1.2, sx - len + dx, yy); }
    ctx.fill(); ctx.globalAlpha = 1;
  }
};
// Thin high streaks, lit by the low sun or the moon, with fine combed lines inside once the
// scope is close enough to show them.
View.prototype.skyCirrus = function (ctx, cam, sky, drift, X, Y, mx0, mx1, my0, my1, sx, sy) {
  const ppm = cam.ppm, cc = sky.cc, col = sky.night ? mix(cc.lit, cc.body, 0.3) : mix(cc.lit, cc.body, 0.25);
  ctx.fillStyle = col;
  for (let i = 0; i < sky.streaks.length; i++) {
    const q = sky.streaks[i], x = ((((q.x + drift * 0.08 + 600) % 1200) + 1200) % 1200) - 600;
    if (x + q.w < mx0 || x - q.w > mx1 || q.y + q.h * 3 < my0 || q.y - q.h * 3 > my1) continue;
    const px = X(x), py = Y(q.y), L = q.w * ppm, th = q.h * ppm;
    ctx.globalAlpha = q.a * (sky.night ? 0.45 : 0.7) * smooth(q.y / 60);
    ctx.beginPath();
    for (let k = 0; k < q.n; k++) { const o = (k - (q.n - 1) / 2) * th * 1.6, l = L * (1 - Math.abs(k - (q.n - 1) / 2) * 0.22); rgLensPath(ctx, px + o * q.sk * 4 + k * L * 0.06, py + o, l, th * 0.9, th * 0.6, l * q.sk); }
    ctx.fill();
    if (th > 8) { // fine combing inside the streak
      ctx.globalAlpha *= 0.6; ctx.strokeStyle = mix(col, cc.lit, 0.6); ctx.lineWidth = Math.max(0.8, th * 0.06); ctx.beginPath();
      for (let k = 0; k < 7; k++) { const o = (k - 3) * th * 0.32, l = L * (0.5 + kxH(k, q.s * 9) * 0.4); ctx.moveTo(px - l + o * q.sk * 3, py + o); ctx.quadraticCurveTo(px + o * q.sk * 3, py + o - th * 0.25, px + l * 0.8 + o * q.sk * 3, py + o + th * 0.1); }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
};
function rgLensPath(ctx, x, y, l, up, dn, skew) { ctx.moveTo(x - l, y); ctx.quadraticCurveTo(x + skew, y - up * 2, x + l, y); ctx.quadraticCurveTo(x + skew, y + dn * 2, x - l, y); ctx.closePath(); }

// Heaps of cumulus. Each is drawn in four tones: the flat shaded base, the body of every lobe,
// the lit upper side of each lobe, and a bright rim on the side facing the sun. Lobes break
// into smaller lobes (and those into smaller still) as the scope closes in, so a cloud at 30x
// is as lumpy as one at 3x and never a smooth blob.
const skyL = [];
View.prototype.skyHeaps = function (ctx, cam, sky, drift, X, Y, mx0, mx1, my0, my1) {
  const ppm = cam.ppm, cc = sky.cc, S = this, side = 1;
  for (let ci = 0; ci < sky.clouds.length; ci++) {
    const c = sky.clouds[ci], sc = 0.55 + 0.45 * clamp(c.y / 110, 0, 1);
    const x = ((((c.x + drift * (0.12 + c.y * 0.0012) + 600) % 1200) + 1200) % 1200) - 600;
    if (x + c.x1 * sc < mx0 || x + c.x0 * sc > mx1 || c.y + c.top * sc < my0 || c.y > my1 + 2) continue;
    const bx = X(x), by = Y(c.y), k = ppm * sc, haze = clamp(1 - c.y / 70, 0, 0.55) * (sky.night ? 0.3 : 1);
    const hz = (col) => mix(col, sky.bot, haze);
    // gather the lobes to draw at this zoom
    skyL.length = 0;
    for (let i = 0; i < c.lobes.length; i++) {
      const q = c.lobes[i], rs = q.r * k;
      const qx = bx + q.x * k, qy = by - q.y * k, rb = rs * 1.25;   // the smaller lobes stand a little proud of their parent
      if (qx + rb < cam.cx - cam.hw || qx - rb > cam.cx + cam.hw || qy + rb < cam.cy - cam.hh || qy - rb > cam.cy + cam.hh) continue;
      skyL.push(qx, qy, rs, 0);
      if (rs > 34) {
        const kids = skyKids(q, c.seed);
        for (let j = 0; j < kids.length; j++) {
          const p = kids[j], ps = p.r * k, px = bx + p.x * k, py = by - p.y * k;
          if (px + ps < cam.cx - cam.hw || px - ps > cam.cx + cam.hw || py + ps < cam.cy - cam.hh || py - ps > cam.cy + cam.hh) continue;
          skyL.push(px, py, ps, 1);
          if (ps > 34) { const gk = skyKids(p, c.seed + 17); for (let m = 0; m < gk.length; m++) { const g2 = gk[m], gs = g2.r * k, gx = bx + g2.x * k, gy = by - g2.y * k; if (gx + gs < cam.cx - cam.hw || gx - gs > cam.cx + cam.hw || gy + gs < cam.cy - cam.hh || gy - gs > cam.cy + cam.hh) continue; skyL.push(gx, gy, gs, 2); } }
        }
      }
    }
    if (!skyL.length) continue;
    // where the light comes from: the sun's side, low at dawn and dusk, high by day
    const sdx = clamp((sky.sunX - x) / 160, -1, 1), lx = sdx * (sky.lowSun ? 0.85 : 0.45), ly = sky.lowSun ? 0.55 : 0.92;
    const Hs = c.H * k, a = Math.max(1.5, Hs * 0.075), b = Math.max(2.5, Hs * 0.12), base = Math.min(by, cam.cy + cam.hh + 2);
    const U = (ox, oy) => {
      ctx.beginPath();
      for (let i = 0; i < skyL.length; i += 4) { const qx = skyL[i] + ox, qy = skyL[i + 1] + oy; ctx.moveTo(qx + skyL[i + 2], qy); ctx.arc(qx, qy, skyL[i + 2], 0, TAU); }
      ctx.rect(bx + c.x0 * k * 0.8 + ox, by - Hs * 0.14 + oy, (c.x1 - c.x0) * k * 0.8, Hs * 0.3);
    };
    ctx.save(); ctx.beginPath(); ctx.rect(cam.cx - cam.hw, cam.cy - cam.hh, cam.hw * 2, base - (cam.cy - cam.hh)); ctx.clip();
    // the whole heap in shade, then (inside it) the same heap moved toward the light, lit; then
    // moved back the other way, in the body tone. A shaded rim is left on the side away from the
    // light, a lit rim on the side facing it, and both follow every lump of the outline.
    U(0, 0); ctx.fillStyle = hz(cc.shade); ctx.fill(); ctx.clip();
    U(lx * a, -ly * a); ctx.fillStyle = hz(cc.lit); ctx.fill(); ctx.clip();
    U(lx * (a - b), -ly * (a - b)); ctx.fillStyle = hz(cc.body); ctx.fill();
    ctx.restore();
    // folds inside the heap: a thin shaded arc under each big lobe, on the side away from the light
    if (Hs > 30) {
      ctx.save(); ctx.beginPath(); ctx.rect(cam.cx - cam.hw, cam.cy - cam.hh, cam.hw * 2, base - (cam.cy - cam.hh) - Hs * 0.12); ctx.clip();
      ctx.strokeStyle = hz(cc.shade); ctx.globalAlpha = 0.32; ctx.lineCap = 'round'; ctx.beginPath();
      const la = Math.atan2(ly, -lx), lw = Math.max(1, Hs * 0.022);   // on screen, pointing away from the light
      for (let i = 0; i < skyL.length; i += 4) { const r = skyL[i + 2]; if (r < Hs * 0.16 || r < 8 || skyL[i + 3]) continue; const a0 = la - 0.75, a1 = la + 0.75; ctx.moveTo(skyL[i] + Math.cos(a0) * r * 0.93, skyL[i + 1] + Math.sin(a0) * r * 0.93); ctx.arc(skyL[i], skyL[i + 1], r * 0.93, a0, a1); }
      ctx.lineWidth = lw; ctx.stroke(); ctx.restore(); ctx.globalAlpha = 1; ctx.lineCap = 'butt';
    }
  }
};
// A low grey deck: long rows of rolls with dark undersides, packed tighter and darker toward the
// horizon. Under it, far off, rain can hang in grey curtains.
// The edge of a layer of the deck at x (mils): a long slow swell, rounded lumps hanging down
// out of it, and finer ragged detail that only matters once the scope is close.
function skyDeckEdge(row, x, fine) {
  const s = row.s, th = row.th, sp = 16, c0 = Math.floor(x / sp);
  // soft rounded lumps hanging from the base, of very different sizes (many hardly there)
  let lump = 0;
  for (let c = c0 - 1; c <= c0 + 1; c++) {
    const h = kxH(c * 1.7 + s, s), amp = h * h * h, w = sp * (0.6 + kxH(c, s + 5) * 0.7), cx = (c + 0.5 + (kxH(c + 9, s) - 0.5) * 0.6) * sp, u = (x - cx) / w;
    if (u > -1 && u < 1) lump = Math.max(lump, amp * (1 - u * u));
  }
  return th * (0.3 * vnoise(x / 41 + s, 40) + 0.1 * vnoise(x / 9 + s, 45) - 0.34 * lump - (fine ? 0.04 * Math.abs(vnoise(x / 1.3 + s, 43)) : 0));
}
View.prototype.skyDeck = function (ctx, cam, sky, drift, X, Y, mx0, mx1, my0, my1, S) {
  const ppm = cam.ppm, cc = sky.cc, l = cam.cx - cam.hw, r = cam.cx + cam.hw, step = 7, fine = ppm > 9;
  const ys = []; // the bottom edge on screen, shared by the passes of one layer
  for (let ri = 0; ri < sky.deckRows.length; ri++) {
    const row = sky.deckRows[ri], y = row.y, th = row.th; if (y - th > my1 || y + th * 1.5 < my0) continue;
    const k = row.k, body = mix(mix(cc.body, cc.shade, k * 0.75), sky.bot, 0.3 * (1 - k) * (1 - k)), under = mix(body, cc.under, 0.55), lit = mix(body, cc.lit, 0.35 * (1 - k * 0.5));
    const off = drift * row.sp, n = Math.ceil((r - l) / step) + 1;
    ys.length = 0;
    for (let i = 0; i < n; i++) { const px = l + i * step, mx = cam.ax + (px - cam.cx) / ppm - off; ys.push(Y(y + skyDeckEdge(row, mx, fine))); }
    const topY = Y(y + th), topW = th * ppm * 0.18;
    // the layer itself, its top a soft long wave
    ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(l, cam.cy - cam.hh - 2);
    if (topY > cam.cy - cam.hh) { for (let i = 0; i < n; i += 3) { const px = l + i * step, mx = cam.ax + (px - cam.cx) / ppm - off; ctx.lineTo(px, topY - topW * vnoise(mx / 30 + row.s, 44)); } }
    else ctx.lineTo(r + step, cam.cy - cam.hh - 2);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(l + i * step, ys[i]);
    ctx.closePath(); ctx.fill();
    // the darker underside, following every lump
    ctx.fillStyle = under; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(l, ys[0]);
    for (let i = 1; i < n; i++) ctx.lineTo(l + i * step, ys[i]);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(l + i * step, ys[i] - Math.max(1.5, th * ppm * 0.09));
    ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    // rain hanging under the low layers in grey curtains, leaning with the wind and fading out
    if (row.rain > 0) {
      const lean = clamp(sky.windNow * 0.025, -0.35, 0.35), hor = Y(0);
      ctx.fillStyle = under;
      for (let c = 0; c < 4; c++) {
        const cx0 = ((((row.s * 37 + c * 310 + drift * 0.6) % 1240) + 1240) % 1240) - 620, w = (40 + 30 * kxH(c, row.s)) ;
        if (cx0 + w < mx0 - 40 || cx0 - w > mx1 + 40) continue;
        const x0 = X(cx0 - w / 2), x1 = X(cx0 + w / 2), yb = Y(y - th * 0.3), hgt = hor - yb; if (hgt <= 2) continue;
        for (let b = 0; b < 5; b++) {
          const ya = yb + (hgt * b) / 5, yz = yb + (hgt * (b + 1)) / 5;
          ctx.globalAlpha = 0.2 * row.rain * (1 - b / 5);
          ctx.beginPath(); ctx.moveTo(x0 + (ya - yb) * lean, ya); ctx.lineTo(x1 + (ya - yb) * lean, ya); ctx.lineTo(x1 + (yz - yb) * lean, yz); ctx.lineTo(x0 + (yz - yb) * lean, yz); ctx.closePath(); ctx.fill();
        }
        // streaks inside the curtain
        ctx.globalAlpha = 0.18 * row.rain; ctx.strokeStyle = mix(under, '#000000', 0.15); ctx.lineWidth = Math.max(1, (x1 - x0) * 0.02); ctx.beginPath();
        for (let q = 0; q < 9; q++) { const fx = x0 + (x1 - x0) * kxH(q, c + row.s); ctx.moveTo(fx, yb); ctx.lineTo(fx + hgt * lean, yb + hgt * (0.5 + kxH(q, 9) * 0.5)); }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
};

// Airliners crossing high over: by day a small grey shape drawing a white trail that spreads
// and drifts with the wind behind it (pink when the sun is low), after dark only its lights,
// red on one wing, green on the other and a white strobe. Close up it has wings and a tail.
View.prototype.skyJets = function (ctx, cam, sim, sky, X, Y, mx0, mx1, my0, my1) {
  const t = sim.t, ppm = cam.ppm, night = sky.night, low = sky.lowSun;
  for (let i = 0; i < sky.jets.length; i++) {
    const J = sky.jets[i], cyc = (t / J.per + J.ph) % 1, run = 1400 / J.sp; // seconds to cross
    const tt = cyc * J.per; if (tt > run + 60) continue;
    const x = J.dir * (-700 + tt * J.sp), y = J.y + J.dy * (tt / run);
    if (my1 < y - 10 || my0 > y + 10) continue;
    const trail = night ? 0 : Math.min(tt * J.sp, 170), tx0 = x - J.dir * trail;
    if (Math.max(x, tx0) < mx0 - 5 || Math.min(x, tx0) > mx1 + 5) continue;
    const px = X(x), py = Y(y);
    if (!night && trail > 0) { // the trail: thin and bright at the jet, wider, fainter and wind-blown behind
      ctx.save(); ctx.lineCap = 'round'; const col = low ? '#ffd8c8' : '#ffffff', n = 10;
      for (let k = 0; k < n; k++) {
        const u0 = k / n, u1 = (k + 1) / n, age0 = u0 * trail / J.sp, age1 = u1 * trail / J.sp;
        const ax = X(x - J.dir * trail * u0 + sky.windNow * age0 * 0.05), ay = Y(y - J.dy * u0 * 0.1 - age0 * 0.01), bx = X(x - J.dir * trail * u1 + sky.windNow * age1 * 0.05), by = Y(y - J.dy * u1 * 0.1 - age1 * 0.01);
        ctx.globalAlpha = 0.55 * (1 - u0) * Math.min(1, tt / 3); ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.8, (0.25 + u0 * 1.6) * ppm); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }
      ctx.restore();
    }
    if (px < cam.cx - cam.hw - 20 || px > cam.cx + cam.hw + 20) continue;
    const L = 2.6 * ppm, d = J.dir;
    if (!night) {
      ctx.fillStyle = low ? '#6a5a66' : '#7d8794';
      if (L < 6) { ctx.fillRect(px - Math.max(1, L / 2), py - 0.6, Math.max(2, L), 1.3); }
      else { // a fuselage, swept wings, a tail fin and the tailplane
        ctx.beginPath();
        ctx.moveTo(px + d * L * 0.5, py); ctx.quadraticCurveTo(px + d * L * 0.42, py - L * 0.05, px + d * L * 0.3, py - L * 0.05); ctx.lineTo(px - d * L * 0.45, py - L * 0.04); ctx.lineTo(px - d * L * 0.5, py - L * 0.2); ctx.lineTo(px - d * L * 0.44, py - L * 0.2); ctx.lineTo(px - d * L * 0.36, py - L * 0.04); ctx.lineTo(px - d * L * 0.36, py + L * 0.04); ctx.lineTo(px + d * L * 0.3, py + L * 0.04); ctx.closePath();
        ctx.moveTo(px + d * L * 0.08, py); ctx.lineTo(px - d * L * 0.14, py + L * 0.16); ctx.lineTo(px - d * L * 0.2, py + L * 0.16); ctx.lineTo(px - d * L * 0.06, py); ctx.closePath();
        ctx.fill();
      }
    } else { // lights only
      const blink = Math.sin(t * 6 + i * 3) > 0.6, strobe = (t * 1.1 + i) % 1 < 0.06;
      ctx.fillStyle = '#ff4a3d'; ctx.fillRect(px - d * Math.max(1.5, L * 0.12) - 1, py - 1, 2, 2);
      ctx.fillStyle = '#5aff8a'; ctx.fillRect(px + d * Math.max(1.5, L * 0.12) - 1, py - 1, 2, 2);
      if (blink) { ctx.fillStyle = '#ff6a50'; ctx.fillRect(px - 1.5, py + 1, 3, 2); }
      if (strobe) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8; ctx.drawImage(kxBlob('#ffffff'), px - 7, py - 7, 14, 14); ctx.restore(); }
    }
  }
};
