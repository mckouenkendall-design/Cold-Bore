// ---------------------------------------------------------------------------
// Scene kit. A scene is a stack of flat "planes" at different distances from
// the shooter, drawn far to near. Because each plane sits at a real distance,
// they slide against each other as the scope pans, and they shrink or grow
// correctly when the shooter picks a different position.
//
// Each plane holds:
//   items     things to draw (walls, cars, trees)
//   solids    rectangles that stop bullets (with a material)
//   openings  windows and gaps that bullets and eyes can pass through
// All positions are in metres, y up, ground normally at y = 0.
// ---------------------------------------------------------------------------
const PALS = {
  day: { skyTop: '#3f8fd6', skyBot: '#cde6f5', fog: '#bcd6e6', fogD: 2600, amb: '#ffffff', ambT: 0, ink: '#13161b', rim: 'rgba(255,255,255,0.55)',
    glass: '#2b4257', lit: '#f6e2a0', litChance: 0.06, star: 0, cloud: '#ffffff', ground: '#a3a9ad', road: '#4c5259', grass: '#6c9d58', water: '#3d7ca6', sun: '#fff7d6', inRoom: '#34404e', dark: 0 },
  dawn: { skyTop: '#3b4f86', skyBot: '#f6c9a0', fog: '#d9bfae', fogD: 2000, amb: '#6a5a78', ambT: 0.22, ink: '#12141a', rim: 'rgba(255,240,225,0.5)',
    glass: '#2a3b52', lit: '#f8dc98', litChance: 0.3, star: 0.15, cloud: '#f8d6c0', ground: '#8f8f96', road: '#44474f', grass: '#5d8452', water: '#56789c', sun: '#ffe2b0', inRoom: '#2a3442', dark: 0.15 },
  dusk: { skyTop: '#22234f', skyBot: '#ef8a55', fog: '#b77b78', fogD: 2100, amb: '#33274d', ambT: 0.46, ink: '#0e1016', rim: 'rgba(255,225,205,0.45)',
    glass: '#1f2c44', lit: '#ffd98a', litChance: 0.5, star: 0.25, cloud: '#e9a07c', ground: '#6b6672', road: '#34343f', grass: '#3f5c44', water: '#4a5a80', sun: '#ffc27a', inRoom: '#1d2535', dark: 0.35 },
  night: { skyTop: '#03050b', skyBot: '#142040', fog: '#0f1830', fogD: 1900, amb: '#060a16', ambT: 0.76, ink: '#07090d', rim: 'rgba(170,190,225,0.42)',
    glass: '#0c1424', lit: '#ffd27a', litChance: 0.36, star: 1, cloud: '#1a2644', ground: '#2a3040', road: '#161a24', grass: '#16261f', water: '#0d1a30', sun: '#e8eefc', inRoom: '#0a0f1b', dark: 1 },
  overcast: { skyTop: '#6f7c88', skyBot: '#bcc4ca', fog: '#aeb7be', fogD: 1300, amb: '#56626c', ambT: 0.24, ink: '#13161b', rim: 'rgba(240,245,250,0.5)',
    glass: '#2b3a48', lit: '#f3dfa4', litChance: 0.22, star: 0, cloud: '#9aa5ae', ground: '#8b9196', road: '#454a50', grass: '#57795a', water: '#55707f', sun: '#d7dde2', inRoom: '#2a333d', dark: 0.12 },
  snow: { skyTop: '#8ea6be', skyBot: '#e6edf3', fog: '#dbe4ec', fogD: 1500, amb: '#c7d3df', ambT: 0.16, ink: '#12151a', rim: 'rgba(255,255,255,0.6)',
    glass: '#2b4257', lit: '#ffe0a0', litChance: 0.25, star: 0, cloud: '#ffffff', ground: '#eef2f6', road: '#b9c3cc', grass: '#e4eaef', water: '#7f9db4', sun: '#ffffff', inRoom: '#34404e', dark: 0.05 },
};

function makeScene(o) {
  o = o || {};
  const pal = Object.assign({}, PALS[o.time || 'day']);
  const S = {
    time: o.time || 'day', weather: o.weather || 'clear', pal, planes: [], objects: [], props: [], rooms: {}, zoneLamps: {},
    exits: o.exits || [-60, 60], rng: makeRng(o.seed || 7), refZ: o.refZ || 300, fogK: o.fog || 1, groundMat: o.groundMat || 'dirt',
    sky: { stars: [], clouds: [], sun: o.sun || [40, 60] }, darkZones: {}, litZones: {}, bounds: o.bounds || { x0: -45, x1: 45, y0: -2, y1: 32 }, decals: [], ambience: o.ambience || 'city',
  };
  S.haze = (z) => 1 - Math.exp((-z * S.fogK) / pal.fogD);
  S.plane = (z, name) => {
    const P = { z, name: name || 'p' + z, items: [], solids: [], openings: [], haze: S.haze(z), scene: S };
    P.add = (it) => { it.layer = it.layer || 0; P.items.push(it); return it; };
    P.solid = (x, y, w, h, mat, extra) => { const s = Object.assign({ x, y, w, h, mat: mat || 'wall' }, extra || {}); P.solids.push(s); return s; };
    P.open = (op) => { op.glass = op.glass !== false; op.broken = false; P.openings.push(op); return op; };
    S.planes.push(P);
    S.planes.sort((a, b) => b.z - a.z);
    return P;
  };
  // Colour as seen in this scene: darkened by time of day, faded by distance.
  S.tone = (hex, P, selfLit) => mix(mix(hex, pal.amb, selfLit ? pal.ambT * 0.25 : pal.ambT), pal.fog, P ? P.haze : 0);
  S.obj = (ob) => {
    ob.alive = ob.alive !== false; ob.id = ob.id || ('o' + S.objects.length);
    S.objects.push(ob);
    if (ob.kind === 'lamp' && ob.zone) (S.zoneLamps[ob.zone] = S.zoneLamps[ob.zone] || []).push(ob);
    return ob;
  };
  S.room = (id, lit) => { if (!S.rooms[id]) S.rooms[id] = { id, lit: !!lit }; else if (lit !== undefined) S.rooms[id].lit = !!lit; return S.rooms[id]; };
  // Is this spot lit well enough to see a body in? Rooms are lit or dark as a
  // whole; outdoors at night it depends on being near a working lamp.
  S.isLit = (zone, x) => {
    if (S.darkZones[zone]) return false;
    if (S.rooms[zone]) return S.rooms[zone].lit || pal.dark < 0.5;
    if (pal.dark < 0.5) return true;
    const l = S.zoneLamps[zone];
    if (!l) return !!S.litZones[zone];
    for (let i = 0; i < l.length; i++) if (l[i].alive && l[i].on !== false && (x === undefined || Math.abs(l[i].x - x) <= (l[i].reach || 9))) return true;
    return false;
  };
  // How brightly a spot is lit, from 0 (dark) to 1 (full light), for drawing. It falls away
  // smoothly from each lamp instead of switching at the edge, and is about 0.2 at the point
  // where isLit() above flips, so what you see agrees with what the guards can see.
  // Returns a shared object: { l, dx (which side the lamp is on, in metres), h, col }.
  const _la = { l: 1, dx: 0, h: 5, col: null };
  S.lightAt = (zone, x) => {
    _la.dx = 0; _la.h = 5; _la.col = null;
    if (S.darkZones[zone]) { _la.l = 0; return _la; }
    if (S.rooms[zone]) { _la.l = (S.rooms[zone].lit || pal.dark < 0.5) ? 1 : 0; return _la; }
    if (pal.dark < 0.5) { _la.l = 1; return _la; }
    const l = S.zoneLamps[zone];
    if (!l) { _la.l = S.litZones[zone] ? 1 : 0; return _la; }
    let best = 0;
    for (let i = 0; i < l.length; i++) {
      const lp = l[i]; if (!lp.alive || lp.on === false) continue;
      if (x === undefined) { best = 1; break; }
      const r = lp.reach || 9, d = Math.abs(lp.x - x), v = 1 - smooth((d - r * 0.3) / r);
      if (v > best) { best = v; _la.dx = lp.x - x; _la.h = lp.y; _la.col = lp.col || null; }
    }
    _la.l = best; return _la;
  };
  // sky dressing
  const R = S.rng;
  if (pal.star > 0) for (let i = 0; i < 150; i++) S.sky.stars.push([R.r(-260, 260), R.r(-20, 240), R.r(0.4, 1.4), R.f()]);
  const nCloud = S.weather === 'clear' ? 5 : 9;
  for (let i = 0; i < nCloud; i++) S.sky.clouds.push({ x: R.r(-240, 240), y: R.r(25, 130), w: R.r(40, 110), h: R.r(8, 20), n: R.i(3, 6), s: R.f() });
  return S;
}

// ---- small drawing helpers --------------------------------------------------
function R4(ctx, x, y, w, h, fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
function poly(ctx, pts, fill) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath(); ctx.fill();
}
function line(ctx, x1, y1, x2, y2, col, w, env) {
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(w, env ? env.px * 0.9 : 0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function circ(ctx, x, y, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }


// ---- helpers for the detailed art ---------------------------------------------
// A repeatable "random" number from 0 to 1 made from one or two numbers. It uses no
// random stream, so decoration can vary without disturbing anything a mission depends on.
function kxH(a, b) { const s = Math.sin(a * 127.1 + (b || 0) * 311.7 + 74.7) * 43758.5453; return s - Math.floor(s); }

// Small pictures made once and reused every frame: soft glows, the light under a lamp,
// shading strips and the brick tiles. Drawing one of these is far cheaper than building
// a gradient each frame, and none of them needs a blur.
const kxSprites = {};
function kxCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
// A round glow in one colour, strongest in the middle. Draw it with 'lighter'.
function kxBlob(col) {
  const key = 'b' + col; let c = kxSprites[key]; if (c) return c;
  c = kxSprites[key] = kxCanvas(64, 64);
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32), q = rgbOf(col);
  for (let i = 0; i <= 8; i++) { const u = i / 8; gr.addColorStop(u, 'rgba(' + q[0] + ',' + q[1] + ',' + q[2] + ',' + Math.pow(1 - u * u, 2).toFixed(3) + ')'); }
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
}
// The falloff of lamp light with distance, as a fraction of 1.3 x reach. This is the
// same curve S.lightAt uses: full out to 0.3 of the reach, gone at 1.3 of the reach.
function kxFall(q) { return q >= 1 ? 0 : 1 - smooth(1.3 * q - 0.3); }
// The pool a lamp throws on the ground: a round patch with the lamp falloff.
function kxPool(col) {
  const key = 'p' + col; let c = kxSprites[key]; if (c) return c;
  c = kxSprites[key] = kxCanvas(96, 96);
  const g = c.getContext('2d'), gr = g.createRadialGradient(48, 48, 0, 48, 48, 48), q = rgbOf(col);
  for (let i = 0; i <= 12; i++) { const u = i / 12; gr.addColorStop(u, 'rgba(' + q[0] + ',' + q[1] + ',' + q[2] + ',' + kxFall(u).toFixed(3) + ')'); }
  g.fillStyle = gr; g.fillRect(0, 0, 96, 96); return c;
}
// The cone of light in the air under a lamp (and on the wall behind it). Row 0 is the
// ground, the last row is the lantern. Across the bottom it has the lamp falloff.
function kxCone(col) {
  const key = 'c' + col; let c = kxSprites[key]; if (c) return c;
  const W = 160, H = 96; c = kxSprites[key] = kxCanvas(W, H);
  const g = c.getContext('2d'), im = g.createImageData(W, H), d = im.data, q = rgbOf(col);
  for (let j = 0; j < H; j++) {
    const v = 1 - j / (H - 1);                         // 0 at the lantern, 1 at the ground
    const half = 0.05 + 0.95 * Math.pow(v, 0.85);       // how wide the cone is at this height
    const up = 0.42 + 0.58 * Math.pow(1 - v, 1.6);      // brighter close to the lantern
    const top = smooth(v / 0.06);                        // eases in just under the lantern
    for (let i = 0; i < W; i++) {
      const u = Math.abs((i + 0.5) / W * 2 - 1), a = kxFall(u / half) * up * top, k = (j * W + i) * 4;
      d[k] = q[0]; d[k + 1] = q[1]; d[k + 2] = q[2]; d[k + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(im, 0, 0); return c;
}
// The same cone with the glow of rain or mist caught in the beam added in (k is how strong
// the mist is next to the cone), so a wet night costs one pass under each lamp, not two.
// Stored at two thirds strength so the brightest part does not clip: draw it 1.5 times as strong.
function kxConeMist(col, k) {
  const key = 'm' + col + k; let c = kxSprites[key]; if (c) return c;
  const W = 160, H = 96, src = kxCone(col).getContext('2d').getImageData(0, 0, W, H).data; c = kxSprites[key] = kxCanvas(W, H);
  const g = c.getContext('2d'), im = g.createImageData(W, H), d = im.data, q = rgbOf(col);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const kk = (j * W + i) * 4, hy = (j + 0.5) / H, ux = ((i + 0.5) / W * 2 - 1) / 0.5, uy = (hy - 0.625) / 0.475, u2 = ux * ux + uy * uy;
    const mist = u2 < 1 ? Math.pow(1 - u2, 2) : 0, a = (src[kk + 3] / 255 + k * mist) / 1.5;
    d[kk] = q[0]; d[kk + 1] = q[1]; d[kk + 2] = q[2]; d[kk + 3] = Math.round(Math.min(1, a) * 255);
  }
  g.putImageData(im, 0, 0); return c;
}
// Draw a cone picture under a lantern at lx, from the ground y up hh metres, R1 metres to each
// side. It goes in three bands, each cut to where the light is still worth painting (what is
// left out is under a thirtieth of the brightest part), so the dim corners cost nothing.
const kxConeCut = [10, 28, 50], kxMistCut = [10, 26, 38];
function kxConeAt(ctx, sp, lx, y, R1, hh, mist) {
  const sx = (2 * R1) / 160, sy = hh / 96, cut = mist ? kxMistCut : kxConeCut;
  for (let b = 0; b < 3; b++) { const c = cut[b]; ctx.drawImage(sp, c, b * 32, 160 - 2 * c, 32, lx - R1 + c * sx, y + b * 32 * sy, (160 - 2 * c) * sx, 32 * sy); }
}
// Light from a lit window falling on the wall round it: a soft-edged box. The bright
// middle is the central 30 of the 48 pixels and the glow fades out over the 9 each side.
function kxSpill(col) {
  const key = 's' + col; let c = kxSprites[key]; if (c) return c;
  const N = 48; c = kxSprites[key] = kxCanvas(N, N);
  const g = c.getContext('2d'), im = g.createImageData(N, N), d = im.data, q = rgbOf(col);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const dx = Math.max(0, Math.abs(i + 0.5 - N / 2) - 15), dy = Math.max(0, Math.abs(j + 0.5 - N / 2) - 15), a = 1 - smooth(Math.hypot(dx, dy) / 9), k = (j * N + i) * 4;
    d[k] = q[0]; d[k + 1] = q[1]; d[k + 2] = q[2]; d[k + 3] = Math.round(a * a * 255);
  }
  g.putImageData(im, 0, 0); return c;
}
// Draw that soft box so its bright middle covers the rectangle x, y, w, h. The glow reaches
// three tenths of the box's size beyond it, or for a long low shape (a shop window, a sign) m
// metres beyond each end. ring = true leaves out the middle, for a window that will be drawn
// over it anyway: only the soft border is painted. Kept tight on purpose, since every pixel of
// it costs a blend on a phone.
function kxSpillAt(ctx, sp, x, y, w, h, m, ring) {
  const ky = h / 30, my = 9 * ky, wide = w > h * 2.2, kx = wide ? 0 : w / 30, e = wide ? Math.min(m, h * 1.2) : 9 * kx;
  if (!ring) {
    if (!wide) { ctx.drawImage(sp, x - e, y - my, w + 2 * e, h + 2 * my); return; }
    ctx.drawImage(sp, 0, 0, 9, 48, x - e, y - my, e, h + 2 * my);
    ctx.drawImage(sp, 9, 0, 30, 48, x, y - my, w, h + 2 * my);
    ctx.drawImage(sp, 39, 0, 9, 48, x + w, y - my, e, h + 2 * my);
    return;
  }
  ctx.drawImage(sp, 0, 0, 9, 48, x - e, y - my, e, h + 2 * my);        // the two ends, full height
  ctx.drawImage(sp, 39, 0, 9, 48, x + w, y - my, e, h + 2 * my);
  ctx.drawImage(sp, 9, 0, 30, 9, x, y - my, w, my);                   // above and below the middle
  ctx.drawImage(sp, 9, 39, 30, 9, x, y + h, w, my);
}
// The soft border of a window's glow (kxSpillAt with ring) made at an exact size in screen
// pixels, kept for reuse: a few sizes at a time, the canvases recycled as the zoom changes.
const kxRings = new Map();
function kxRing(sp, wPx, hPx) {
  const W = Math.max(2, Math.round(wPx)), H = Math.max(2, Math.round(hPx)), key = W * 10000 + H;
  let c = kxRings.get(key); if (c) return c;
  let old = null; if (kxRings.size >= 6) { const k0 = kxRings.keys().next().value; old = kxRings.get(k0); kxRings.delete(k0); }
  const ex = Math.round(W * 0.3), ey = Math.round(H * 0.3);
  c = old || kxCanvas(2, 2); c.width = W + 2 * ex; c.height = H + 2 * ey; c.ex = ex; c.ey = ey;
  const g = c.getContext('2d', { willReadFrequently: true }); g.clearRect(0, 0, c.width, c.height);
  g.drawImage(sp, 0, 0, 9, 48, 0, 0, ex, c.height); g.drawImage(sp, 39, 0, 9, 48, ex + W, 0, ex, c.height);
  g.drawImage(sp, 9, 0, 30, 9, ex, 0, W, ey); g.drawImage(sp, 9, 39, 30, 9, ex, ey + H, W, ey);
  kxRings.set(key, c); return c;
}
// Big soft lights (cones, pools) are painted once at their exact size on screen and then
// stamped on whole pixels: a straight copy costs about a quarter of stretching the picture
// every frame. While the zoom is changing their size changes too, and then they are simply
// stretched as before. paint(g) draws the light in plane units inside x, y, w, h (y up), at
// full strength; the caller sets the alpha and the blend on ctx first. Stamps are kept to a
// few megapixels in all so a phone never runs short of memory.
const kxStamps = new Map(); let kxStampPx = 0;
function kxLight(ctx, key, x, y, w, h, paint) {
  const m = kxM(ctx);
  if (m.b || m.c || m.d >= 0 || m.a <= 0 || w <= 0 || h <= 0) { paint(ctx); return; }
  const W = Math.round(m.a * w), H = Math.round(-m.d * h);
  if (W * H < 20000) { paint(ctx); return; }                       // small: stretching it is cheap enough
  let st = kxStamps.get(key);
  if (!st) { st = { W: 0, H: 0, c: null, ok: false, n: 0 }; kxStamps.set(key, st); }
  if (st.W !== W || st.H !== H) { st.W = W; st.H = H; st.ok = false; st.n = 0; }
  if (!st.ok) {
    const px = W * H, have = st.c ? st.c.width * st.c.height : 0;
    if (++st.n < 3 || px > 1e6 || W < 4 || H < 4) { paint(ctx); return; }
    if (kxStampPx - have + px > 4e6) { // over budget: let all the others go (they are cheap to make again when wanted)
      kxStamps.forEach((q) => { if (q !== st && q.c) { q.c.width = q.c.height = 0; q.c = null; q.ok = false; } });
      kxStamps.clear(); kxStamps.set(key, st); kxStampPx = have;
    }
    if (!st.c) st.c = kxCanvas(W, H); else { st.c.width = W; st.c.height = H; }
    kxStampPx += px - have;
    // (kept as a plain bitmap in memory: copying it is what it is for, and a picture held on the
    // graphics card would have to be fetched back for every copy on some browsers)
    const g = st.c.getContext('2d', { willReadFrequently: true }); g.setTransform(W / w, 0, 0, -H / h, (-x * W) / w, H + (y * H) / h); paint(g); st.ok = true;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(st.c, Math.round(m.a * x + m.e), Math.round(m.d * (y + h) + m.f)); ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
}
// ---- shading in flat bands ---------------------------------------------------
// In the browsers this game runs in, a gradient or a stretched picture costs twenty to forty
// times as much per pixel as a flat fill. So the gentle top-to-bottom shades are drawn as a
// stack of thin flat bands instead: a band a few pixels tall with one per cent less light than
// its neighbour cannot be told from a smooth fade. The colours are worked out once and kept.
const kxBandCols = new Map();
function kxBandList(col, a, n, opaque) {      // n colours from full strength (band 0) fading to nothing
  const key = col + '|' + a + '|' + n + (opaque ? 'o' : 't'); let l = kxBandCols.get(key); if (l) return l;
  if (kxBandCols.size > 4000) kxBandCols.clear();
  l = []; const q = rgbOf(col), hx = (v) => { const t = Math.round(clamp(v, 0, 255)).toString(16); return t.length < 2 ? '0' + t : t; };
  const shade = (k) => '#' + hx(q[0] * (1 - k)) + hx(q[1] * (1 - k)) + hx(q[2] * (1 - k));
  for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, k = a * Math.pow(1 - u, 1.25); l.push(opaque ? shade(k) : 'rgba(' + q[0] + ',' + q[1] + ',' + q[2] + ',' + k.toFixed(3) + ')'); }
  l.full = opaque ? shade(a) : null;
  kxBandCols.set(key, l); return l;
}
// How many bands a shade spanning h metres needs at the current zoom (about one per 10 pixels).
function kxBandN(m, h) { const px = Math.abs(h * m.d); return px < 16 ? 2 : px < 48 ? 4 : px < 128 ? 8 : px < 320 ? 16 : px < 700 ? 32 : 48; }
function kxM(ctx) { try { return ctx.getTransform(); } catch (err) { return { a: 1, b: 0, c: 0, d: 2, e: 0, f: 0 }; } }
// A colour (alpha times col at y, nothing at y + h; h may be negative) laid over x, w.
// Band edges sit on whole screen pixels, so neighbouring see-through bands never double up.
function kxFadeAt(ctx, col, x, y, w, h, alpha) {
  if (w <= 0 || !h || alpha <= 0.002) return;
  const m = kxM(ctx), n = kxBandN(m, h), L = kxBandList(col, alpha, n, false), snap = !m.b && !m.c && m.d;
  let prev = y;
  if (snap) prev = (Math.round(m.d * y + m.f) - m.f) / m.d;
  for (let i = 0; i < n; i++) {
    let next = y + (h * (i + 1)) / n; if (snap) next = (Math.round(m.d * next + m.f) - m.f) / m.d;
    if (next !== prev) { ctx.fillStyle = L[i]; ctx.fillRect(x, Math.min(prev, next), w, Math.abs(next - prev)); }
    prev = next;
  }
}
// Fill x, w from fy0 up to fy1 with col, darkened by k at gy0 and easing to nothing at gy1
// (gy0 < gy1): below gy0 the full shade, above gy1 the plain colour. All opaque.
function kxShadeFill(ctx, col, k, gy0, gy1, x, w, fy0, fy1) {
  if (fy1 <= fy0) return;
  if (!k) { ctx.fillStyle = col; ctx.fillRect(x, fy0, w, fy1 - fy0); return; }
  const m = kxM(ctx), n = kxBandN(m, gy1 - gy0), L = kxBandList(col, k, n, true);
  if (fy0 < gy0) { ctx.fillStyle = L.full; ctx.fillRect(x, fy0, w, Math.min(gy0, fy1) - fy0); }
  if (fy1 > gy1) { ctx.fillStyle = col; ctx.fillRect(x, Math.max(gy1, fy0), w, fy1 - Math.max(gy1, fy0)); }
  const step = (gy1 - gy0) / n;
  for (let i = 0; i < n; i++) {
    const b0 = Math.max(fy0, gy0 + i * step), b1 = Math.min(fy1, gy0 + (i + 1) * step + step * 0.02);
    if (b1 > b0) { ctx.fillStyle = L[i]; ctx.fillRect(x, b0, w, b1 - b0); }
  }
}
// A glow at a point: the round blob, drawn additively.
function kxGlow(ctx, col, x, y, r, alpha) {
  if (alpha <= 0.004) return;
  const op = ctx.globalCompositeOperation, a = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(kxBlob(col), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = a; ctx.globalCompositeOperation = op;
}
// A soft-edged puff (smoke, steam, mist) in normal paint.
function kxPuff(ctx, col, x, y, rx, ry, alpha) {
  const a = ctx.globalAlpha; ctx.globalAlpha = a * alpha; ctx.drawImage(kxBlob(col), x - rx, y - ry, rx * 2, ry * 2); ctx.globalAlpha = a;
}

// Brick tiles. One tile holds a patch of running-bond brickwork as see-through dark
// mortar lines and the odd darker or paler brick, so the same tile works over a wall of
// any colour. There are a few sizes; the wall picks the one nearest the zoom.
function kxBrick(cp) {
  const key = 'k' + cp; let t = kxSprites[key]; if (t) return t;
  const bl = cp * 3, nb = cp >= 24 ? 8 : cp >= 6 ? 16 : 32, nc = cp >= 12 ? 16 : 32, W = nb * bl, H = nc * cp;
  const c = kxCanvas(W, H), g = c.getContext('2d'), R = makeRng(90210 + cp), mw = Math.max(1, Math.round(cp / 7));
  for (let r = 0; r < nc; r++) {
    const off = (r % 2) * (bl / 2);
    for (let b = -1; b < nb; b++) {
      const u = R.f(), x = b * bl + off;
      if (u < 0.2) g.fillStyle = 'rgba(0,0,0,' + R.r(0.04, 0.1).toFixed(3) + ')';
      else if (u < 0.3) g.fillStyle = 'rgba(0,0,0,' + R.r(0.12, 0.22).toFixed(3) + ')';
      else if (u < 0.36) g.fillStyle = 'rgba(255,236,214,' + R.r(0.04, 0.09).toFixed(3) + ')';
      else if (u < 0.39) g.fillStyle = 'rgba(70,20,10,' + R.r(0.1, 0.2).toFixed(3) + ')';
      else continue;
      g.fillRect(x, r * cp, bl, cp);
      if (x < 0) g.fillRect(x + W, r * cp, bl, cp);
    }
  }
  g.fillStyle = 'rgba(12,10,14,0.3)';
  for (let r = 0; r < nc; r++) {
    g.fillRect(0, r * cp, W, mw);
    const off = (r % 2) * (bl / 2);
    for (let b = 0; b < nb; b++) g.fillRect(b * bl + off, r * cp, mw, cp);
  }
  if (cp >= 12) { // a touch of light along the top of each brick when you are close enough to see it
    g.fillStyle = 'rgba(255,240,225,0.07)';
    for (let r = 0; r < nc; r++) g.fillRect(0, r * cp + cp - Math.max(1, mw), W, Math.max(1, mw));
  }
  t = kxSprites[key] = { c, k: 0.075 / cp, pats: new WeakMap() };
  return t;
}
// How many real screen pixels one CSS pixel is on this canvas (worked out once a frame).
function kxDpr(ctx, env) {
  if (env._kxDpr) return env._kxDpr;
  let d = 2;
  try { const m = ctx.getTransform(); d = Math.abs(m.a) / env.s || 2; } catch (err) { d = 2; }
  env._kxDpr = d; return d;
}
// Fill a rectangle with brickwork at the right fineness for the zoom. parts, if given, is a
// list of [x, y, w, h] pieces inside it that actually show (a wall without its windows).
function kxBrickFill(ctx, env, x, y, w, h, strength, parts) {
  const ppc = 0.075 * env.s * kxDpr(ctx, env);          // screen pixels per brick course
  if (ppc < 3) return;                                   // finer than that it only reads as noise, and costs a full pass
  const fade = clamp((ppc - 3) / 1.5, 0, 1) * (strength === undefined ? 1 : strength);
  if (ppc < 6) {
    // still small: only the bed joints, as thin lines (far cheaper than the patterned fill;
    // the odd darker brick drawn by the wall itself does the rest)
    const xa = Math.max(x, env.x0), xb = Math.min(x + w, env.x1), ya = Math.max(y, env.y0 === undefined ? y : env.y0), yb = Math.min(y + h, env.y1 === undefined ? y + h : env.y1);
    if (xb <= xa || yb <= ya) return;
    const lw = env.px / kxDpr(ctx, env) * 1.1, list = parts || [[x, y, w, h]];
    ctx.fillStyle = 'rgba(12,10,14,' + (0.3 * fade).toFixed(3) + ')'; ctx.beginPath();
    for (let i = 0; i < list.length; i++) {
      const q = list[i], a0 = Math.max(q[0], xa), a1 = Math.min(q[0] + q[2], xb), b0 = Math.max(q[1], ya), b1 = Math.min(q[1] + q[3], yb); if (a1 <= a0 || b1 <= b0) continue;
      for (let yy = y + Math.ceil((b0 - y) / 0.075) * 0.075; yy < b1; yy += 0.075) ctx.rect(a0, yy, a1 - a0, lw);
    }
    ctx.fill();
    return;
  }
  const cp = ppc < 8.5 ? 6 : ppc < 17 ? 12 : 24, t = kxBrick(cp);
  let pat = t.pats.get(ctx); if (!pat) { pat = ctx.createPattern(t.c, 'repeat'); t.pats.set(ctx, pat); }
  const x0 = Math.max(x, env.x0), x1 = Math.min(x + w, env.x1), y0 = Math.max(y, env.y0 === undefined ? y : env.y0), y1 = Math.min(y + h, env.y1 === undefined ? y + h : env.y1);
  if (x1 <= x0 || y1 <= y0) return;
  ctx.save(); ctx.scale(t.k, t.k); ctx.fillStyle = pat; ctx.imageSmoothingEnabled = false;   // plain sampling: several times cheaper than smoothing, and the tile is drawn at nearly its own size ctx.globalAlpha = fade;
  if (!parts) ctx.fillRect(x0 / t.k, y0 / t.k, (x1 - x0) / t.k, (y1 - y0) / t.k);
  else {
    ctx.beginPath();
    for (let i = 0; i < parts.length; i++) { const q = parts[i], a0 = Math.max(q[0], x0), a1 = Math.min(q[0] + q[2], x1), b0 = Math.max(q[1], y0), b1 = Math.min(q[1] + q[3], y1); if (a1 > a0 && b1 > b0) ctx.rect(a0 / t.k, b0 / t.k, (a1 - a0) / t.k, (b1 - b0) / t.k); }
    ctx.fill();
  }
  ctx.restore();
}

// Where the viewer's eye is, worked out from how two planes at different distances are
// being drawn this frame. It lets detail on the ground be drawn in true perspective and
// lets a wet road on one plane mirror a lamp on another. The ground calls it for every
// plane; until two planes have been seen it falls back to a sensible guess.
function kxSee(env, P) {
  const e = env._kx || (env._kx = { ok: false, ex: 0, ey: 16, ez: 0, P: null, s: 0, x0: 0, y0: 0 });
  if (e.P === P) return e;
  if (e.P && e.P.z !== P.z && Math.abs(e.s - env.s) > 1e-9 && env.y0 !== undefined) {
    const ds = env.s - e.s;
    const ex = (env.s * env.x0 - e.s * e.x0) / ds, ey = (env.s * env.y0 - e.s * e.y0) / ds, ez = (env.s * P.z - e.s * e.P.z) / ds;
    if (isFinite(ex) && isFinite(ey) && isFinite(ez) && Math.abs(ex) < 3000 && Math.abs(ey) < 3000 && ez < P.z - 1) { e.ex = ex; e.ey = ey; e.ez = ez; e.ok = true; }
  }
  e.P = P; e.s = env.s; e.x0 = env.x0; e.y0 = env.y0;
  return e;
}
// A point at height wy and distance wz from the shooter's side, as coordinates on plane P.
function kxOnX(e, P, wx, wz) { return e.ex + (wx - e.ex) * (P.z - e.ez) / Math.max(1, wz - e.ez); }
function kxOnY(e, P, wy, wz) { return e.ey + (wy - e.ey) * (P.z - e.ez) / Math.max(1, wz - e.ez); }
// How much of a metre of ground depth shows as height on the card at plane P (about 0.1 from a rooftop).
function kxTilt(e, P, gy) { return e.ok ? clamp((e.ey - gy) / Math.max(1, P.z - e.ez), 0, 0.5) : 0.1; }

// Every working lamp that could light a given plane's ground, found once and remembered.
function kxLampsNear(S, P, gy) {
  if (P._kxLamps && P._kxLampsN === S.objects.length) return P._kxLamps;
  const l = [];
  for (let i = 0; i < S.objects.length; i++) { const ob = S.objects[i]; if (ob.kind === 'lamp' && ob.baseY !== undefined && Math.abs(ob.baseY - gy) < 0.4 && ob.plane.z - P.z > -1 && ob.plane.z - P.z < 1.3 * (ob.reach || 9)) l.push(ob); }
  P._kxLamps = l; P._kxLampsN = S.objects.length; return l;
}

// Lettering drawn by the kit itself (the view's own text has no outline or glow control).
// Returns false when the letters would be too small to bother with.
function kxText(ctx, env, str, x, y, size, col, align, o) {
  const px = size * env.s; if (px < 4.5) return false;
  o = o || {};
  let m; try { m = ctx.getTransform(); } catch (err) { return false; }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  const dp = Math.abs(m.d), sx = m.a * x + m.e, sy = m.d * y + m.f;
  ctx.font = (o.weight || '700') + ' ' + (size * dp).toFixed(1) + 'px ' + (o.font || '"Avenir Next Condensed","DIN Condensed","Roboto Condensed","Arial Narrow",sans-serif');
  ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (o.rot) { ctx.translate(sx, sy); ctx.rotate(o.rot); ctx.translate(-sx, -sy); }
  if (o.strokes) for (let i = 0; i < o.strokes.length; i++) { const q = o.strokes[i]; ctx.globalAlpha = q[2] === undefined ? 1 : q[2]; ctx.strokeStyle = q[0]; ctx.lineWidth = q[1] * dp; ctx.strokeText(str, sx, sy); }
  if (col) { ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha; ctx.fillStyle = col; ctx.fillText(str, sx, sy); }
  ctx.restore();
  return true;
}
// Several shapes in one colour with one fill: start, add, finish.
function kxRects(ctx, col, list, env) { // list of [x, y, w, h], culled sideways
  ctx.fillStyle = col; ctx.beginPath();
  for (let i = 0; i < list.length; i++) { const q = list[i]; if (q[0] + q[2] < env.x0 || q[0] > env.x1) continue; ctx.rect(q[0], q[1], q[2], q[3]); }
  ctx.fill();
}
// A rectangle with rounded corners as a path.
function kxRR(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

const K = {};

// ---- ground and backdrops --------------------------------------------------
// The ground of a plane is everything below its ground line. Seen from a rooftop that
// strip is really a floor running towards the viewer, so the detailed kinds draw their
// joints, patches and puddles in perspective.
//   o.kind     'plain' (default), 'road' (default when o.stripes is set) or 'pavement'
//   o.kerb     pavement only: metres of paving in front of the plane before the kerb
//   o.roadCol  pavement only: colour of the road beyond the kerb
//   o.zebra    road only: [x0, x1] a pedestrian crossing between these x positions
//   o.near     road only: height on the card where the pavement on the viewer's side starts
//   o.nearCol  road only: colour of that pavement
//   o.cover    metres of ground in front of this plane after which a nearer plane's own
//              ground hides it; nothing is painted beyond that (it would never be seen)
K.ground = function (S, P, o) {
  o = o || {};
  const y = o.y || 0, col = S.tone(o.col || S.pal.ground, P), x0 = o.x0 === undefined ? -4000 : o.x0, x1 = o.x1 === undefined ? 4000 : o.x1;
  const edge = o.edge ? S.tone(o.edge, P) : mix(col, '#ffffff', 0.12);
  P.groundY = y; P.groundMat = o.mat || S.groundMat;
  const kind = o.kind || (o.stripes ? 'road' : 'plain');
  const wet = S.weather === 'rain' || S.weather === 'storm', dark = S.pal.dark;
  const D = makeRng(8101 + Math.round(P.z * 3) + (o.seed || 0) * 17);
  const joint = mix(col, '#000000', 0.2), jointHi = mix(col, '#ffffff', 0.07), paint = S.tone('#d9d2b0', P), paintOld = mix(paint, col, 0.45);
  const bx0 = Math.max(x0, -95), bx1 = Math.min(x1, 95);
  let patches = null, holes = null, cracks = null, puddles = null, spots = null, covers = null, drains = null, kerbTop = null, kerbFace = null, roadCol = null, nearCol = null, nearJoint = null;
  if (kind === 'road') {
    const st = o.stripes || 2.2, deep = o.near || st * 2.35;
    patches = []; holes = []; cracks = []; spots = [];
    for (let xx = bx0; xx < bx1; xx += D.r(9, 19)) patches.push([xx, D.r(0.35, deep - 0.8), D.r(1.2, 3.6), D.r(0.25, 0.8), D.chance(0.6) ? mix(col, '#000000', D.r(0.1, 0.2) * 0.5) : mix(col, '#ffffff', D.r(0.04, 0.08) * 0.45)]);
    for (let xx = bx0 + D.r(4, 20); xx < bx1; xx += D.r(24, 40)) holes.push([xx, D.pick([st * 0.5, st * 1.5]) + D.r(-0.2, 0.2)]);
    for (let xx = bx0; xx < bx1; xx += D.r(7, 16)) { const h0 = D.r(0.3, deep - 0.5), pts = [xx, h0]; let cx = xx, ch = h0; for (let i = 0; i < 5; i++) { cx += D.r(0.4, 1.3); ch += D.r(-0.16, 0.16); pts.push(cx, clamp(ch, 0.15, deep - 0.2)); } cracks.push(pts); }
    for (let xx = bx0; xx < bx1; xx += D.r(3, 8)) spots.push([xx, D.r(0.12, 0.6), D.r(0.2, 0.55), D.r(0.1, 0.22)]);       // oil where cars stand
    nearCol = o.nearCol ? S.tone(o.nearCol, P) : null; nearJoint = nearCol ? mix(nearCol, '#000000', 0.2) : null;
  } else if (kind === 'pavement') {
    covers = []; spots = [];
    for (let xx = bx0 + D.r(2, 9); xx < bx1; xx += D.r(11, 23)) covers.push([xx, D.r(0.6, 2.2), D.r(0.5, 0.9), D.chance(0.5)]);
    for (let xx = bx0; xx < bx1; xx += D.r(1.5, 5)) spots.push([xx, D.r(0.2, 5.5), D.r(0.05, 0.12)]);
    if (o.kerb) { drains = []; for (let xx = bx0 + D.r(3, 12); xx < bx1; xx += D.r(15, 21)) drains.push(xx); kerbTop = mix(col, '#ffffff', 0.2); kerbFace = mix(col, '#000000', 0.34); roadCol = S.tone(o.roadCol || S.pal.road, P); }
  }
  if (wet && kind !== 'plain') { puddles = []; for (let xx = bx0; xx < bx1; xx += D.r(2.5, 7)) puddles.push([xx, D.r(0.1, kind === 'road' ? 4.6 : 2.6), D.r(0.5, 1.7), D.r(0.5, 1.3), D.f()]); }
  const lampCol = '#ffe196', shadeK = o.shade === false ? 0 : kind === 'plain' ? 0.1 : 0.16;
  // big fills carry the gentle shade towards the viewer themselves (one pass, not three)

  P.add({ x0, x1, layer: o.layer || 0, draw(ctx, env) {
    const e = kxSee(env, P), vx0 = Math.max(x0, env.x0), vx1 = Math.min(x1, env.x1), vw = vx1 - vx0, s = env.s;
    const eyr = e.ok ? e.ey - y : 15.5, d = e.ok ? P.z - e.ez : 155, ex = e.ok ? e.ex : 0, floor = eyr > 1.5 && d > 20;
    // a point on the floor, given where it is across the street and how far down the card it shows
    const F = (h) => 1 + h / eyr, fx = (X, h) => ex + (X - ex) * (1 + h / eyr), hOf = (dz) => (eyr * dz) / Math.max(1, d - dz);
    const invX = (xc, h) => ex + (xc - ex) / (1 + h / eyr);
    // how far down the card anything needs painting: to the bottom of the view, or to where a nearer ground takes over
    let lo = env.y0 === undefined ? y - 400 : Math.max(y - 400, env.y0 - 1);
    if (o.cover && floor && e.ok && o.cover < d - 2) lo = Math.max(lo, y - hOf(o.cover + 1.5));
    P._kxLo = lo;   // lamps standing on this plane crop their pools here too
    // the base colour only down to where the road beyond a kerb, or the near pavement, takes over
    let baseLo = lo;
    if (kind === 'pavement' && floor && o.kerb) { const hk = hOf(o.kerb); baseLo = Math.max(lo, y - hk - 0.15 * F(hk) - 0.02); }
    else if (kind === 'road' && o.near && nearCol) baseLo = Math.max(lo, y - o.near - 0.02);
    kxShadeFill(ctx, col, shadeK, y - 14, y, x0, x1 - x0, baseLo, y);
    if (vw <= 0 || lo >= y) return;
    const tilt = floor ? eyr / d : 0.1, bot = Math.max(lo, env.y0 === undefined ? y - 30 : Math.max(env.y0, y - 60));

    if (kind === 'pavement' && floor) {
      const hk = o.kerb ? hOf(o.kerb) : 1e9, slab = o.slab || 0.9, hEnd = Math.min(hk, y - bot);
      if (o.kerb) {
        const hk0 = hOf(Math.max(0.1, o.kerb - 0.32)), face = 0.15 * F(hk);
        kxShadeFill(ctx, roadCol, shadeK, y - 14, y, vx0, vw, lo, y - hk - face);
        R4(ctx, vx0, y - hk, vw, hk - hk0, kerbTop);
        R4(ctx, vx0, y - hk - face, vw, face, kerbFace);
        if (s * face > 3) { // kerb stones, a gutter line and the drains
          ctx.fillStyle = mix(kerbFace, '#000000', 0.3); ctx.beginPath();
          const k0 = Math.floor(invX(vx0, hk) / 1.2) * 1.2;
          for (let X = k0; fx(X, hk) < vx1; X += 1.2) ctx.rect(fx(X, hk), y - hk - face, Math.max(0.025, env.px * 0.7), face + (hk - hk0));
          for (let i = 0; i < drains.length; i++) { const xd = fx(drains[i], hk); if (xd < vx0 - 2 || xd > vx1 + 2) continue; ctx.rect(xd - 0.3 * F(hk), y - hk - face * 0.9, 0.6 * F(hk), face * 0.62); }
          ctx.fill();
          if (s > 24) { // the grating in the gutter below each drain
            ctx.fillStyle = mix(roadCol, '#000000', 0.45);
            for (let i = 0; i < drains.length; i++) { const xd = fx(drains[i], hk + face); if (xd < vx0 - 2 || xd > vx1 + 2) continue; const gw = 0.62 * F(hk), gh = Math.max(0.05, face * 0.42); ctx.fillRect(xd - gw / 2, y - hk - face - gh, gw, gh); ctx.fillStyle = mix(roadCol, '#ffffff', 0.12); for (let b = 1; b < 6; b++) ctx.fillRect(xd - gw / 2 + (b * gw) / 6 - 0.012, y - hk - face - gh, 0.024, gh); ctx.fillStyle = mix(roadCol, '#000000', 0.45); }
          }
        }
        R4(ctx, vx0, y - hk - face - Math.max(0.03, env.px), vw, Math.max(0.03, env.px), mix(roadCol, '#000000', 0.3));
      }
      // paving joints: rows across, then the short joints between slabs, each row offset from the last
      const rowPx = s * tilt * slab;
      if (rowPx > 0.9) {
        ctx.fillStyle = joint; ctx.beginPath();
        const z0 = P.z - Math.floor(P.z / slab) * slab, lw = Math.max(0.012, env.px * 0.7), lim = o.kerb ? o.kerb - 0.33 : (o.depth || 12);
        const rows = [];
        for (let dz = z0 > 0.05 ? z0 : z0 + slab; dz < lim; dz += slab) { const h = hOf(dz); if (h > y - bot) break; rows.push(dz); ctx.rect(vx0, y - h - lw / 2, vw, lw); }
        ctx.fill();
        if (rowPx > 2.2) {
          ctx.strokeStyle = joint; ctx.lineWidth = lw; ctx.beginPath();
          let prev = 0;
          for (let r = 0; r <= rows.length; r++) {
            const dz = r < rows.length ? rows[r] : Math.min(lim, prev + slab), h0 = hOf(prev), h1 = Math.min(hOf(dz), hEnd), n = Math.round((P.z - prev) / slab), off = (n % 2) * slab * 0.5;
            if (h1 > h0 + 1e-4) {
              const a = Math.floor((invX(vx0, h1) - off) / slab) * slab + off, bEnd = invX(vx1, h1) + slab;
              for (let X = a; X < bEnd; X += slab) { ctx.moveTo(fx(X, h0), y - h0); ctx.lineTo(fx(X, h1), y - h1); }
            }
            prev = dz; if (r >= rows.length) break;
          }
          ctx.stroke();
        }
      }
      if (s > 9) { // covers and gratings let into the paving
        for (let i = 0; i < covers.length; i++) {
          const c = covers[i], h = hOf(c[1]); if (h > hEnd - 0.03) continue; const xc = fx(c[0], h); if (xc < vx0 - 2 || xc > vx1 + 2) continue;
          const w = c[2] * F(h), hh = Math.max(env.px * 1.2, c[2] * tilt * F(h) * F(h));
          R4(ctx, xc - w / 2, y - h - hh / 2, w, hh, mix(col, '#000000', 0.3));
          if (s * hh > 5) { ctx.fillStyle = mix(col, '#ffffff', 0.1); if (c[3]) for (let b = 1; b < 7; b++) ctx.fillRect(xc - w / 2 + (b * w) / 7 - 0.012, y - h - hh / 2, 0.024, hh); else ctx.fillRect(xc - w * 0.38, y - h - hh * 0.08, w * 0.76, hh * 0.16); }
        }
      }
      if (s > 26) { // the odd dark spot
        ctx.fillStyle = joint; ctx.beginPath();
        for (let i = 0; i < spots.length; i++) { const q = spots[i], h = hOf(q[1]); if (h > hEnd - 0.02) continue; const xc = fx(q[0], h); if (xc < vx0 || xc > vx1) continue; ctx.rect(xc, y - h, q[2] * 1.6, Math.max(env.px, q[2] * 0.5)); }
        ctx.fill();
      }
    } else if (kind === 'road') {
      const st = o.stripes || 2.2, near = o.near || 0, deep = near || st * 2.35;
      if (near && nearCol) { // the pavement on the viewer's own side of the street
        const face = 0.14 * F(near);
        kxShadeFill(ctx, nearCol, shadeK, y - 14, y, vx0, vw, lo, y - near);
        R4(ctx, vx0, y - near - face * 0.5, vw, face * 0.5, mix(nearCol, '#ffffff', 0.2));
        R4(ctx, vx0, y - near, vw, Math.max(0.05, face * 0.5), mix(col, '#000000', 0.4));
        if (floor && s * tilt * 0.9 * F(near) * F(near) > 2.2 && y - near - 0.05 > bot) {
          ctx.strokeStyle = nearJoint; ctx.lineWidth = Math.max(0.015, env.px * 0.7); ctx.beginPath();
          let hp = near + face * 0.5;
          for (let r = 0; r < 14; r++) {
            const dzp = (d * hp) / (eyr + hp), hn = hOf(dzp + 0.9 * F(hp)); if (y - hp < bot) break;
            ctx.moveTo(vx0, y - hn); ctx.lineTo(vx1, y - hn);
            const off = (r % 2) * 0.45, a = Math.floor((invX(vx0, hn) - off) / 0.9) * 0.9 + off, bEnd = invX(vx1, hn) + 0.9;
            for (let X = a; X < bEnd; X += 0.9) { ctx.moveTo(fx(X, hp), y - hp); ctx.lineTo(fx(X, hn), y - hn); }
            hp = hn;
          }
          ctx.stroke();
        }
      }
      // lanes worn darker where the wheels run
      ctx.fillStyle = 'rgba(0,0,0,0.07)'; ctx.fillRect(vx0, y - st * 0.5 - 0.42, vw, 0.3); ctx.fillRect(vx0, y - st * 0.5 + 0.22, vw, 0.26); ctx.fillRect(vx0, y - st * 1.5 - 0.55, vw, 0.36); ctx.fillRect(vx0, y - st * 1.5 + 0.3, vw, 0.32);
      if (floor) {
        // patched tarmac
        const seam = s > 8; if (seam) { ctx.strokeStyle = mix(col, '#000000', 0.22); ctx.lineWidth = Math.max(0.02, env.px * 0.8); }
        for (let i = 0; i < patches.length; i++) {
          const q = patches[i], xa = fx(q[0], q[1]), xb = fx(q[0] + q[2], q[1] + q[3]); if (Math.max(xa, xb) < vx0 - 4 || Math.min(xa, xb) > vx1 + 4 || y - q[1] < bot) continue;
          if (near && q[1] + q[3] > near - 0.1) continue;
          poly(ctx, [xa, y - q[1], fx(q[0] + q[2], q[1]), y - q[1], xb, y - q[1] - q[3], fx(q[0], q[1] + q[3]), y - q[1] - q[3]], q[4]);
          if (seam) ctx.stroke();                                               // the tar seam round the patch
        }
        if (s > 7) { // cracks
          ctx.strokeStyle = mix(col, '#000000', 0.32); ctx.lineWidth = Math.max(0.014, env.px * 0.7); ctx.beginPath();
          for (let i = 0; i < cracks.length; i++) { const q = cracks[i], xa = fx(q[0], q[1]); if (xa < vx0 - 12 || xa > vx1 + 4) continue; ctx.moveTo(xa, y - q[1]); for (let j = 2; j < q.length; j += 2) ctx.lineTo(fx(q[j], q[j + 1]), y - q[j + 1]); }
          ctx.stroke();
        }
        if (s > 5) { // oil spots along the kerb, then manhole covers
          ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.beginPath();
          for (let i = 0; i < spots.length; i++) { const q = spots[i], xc = fx(q[0], q[1]); if (xc < vx0 - 1 || xc > vx1 + 1) continue; ctx.moveTo(xc + q[2], y - q[1]); ctx.ellipse(xc, y - q[1], q[2], q[2] * tilt * 2.4, 0, 0, TAU); }
          ctx.fill();
          for (let i = 0; i < holes.length; i++) {
            const q = holes[i], xc = fx(q[0], q[1]); if (xc < vx0 - 1 || xc > vx1 + 1) continue;
            const rx = 0.45 * F(q[1]), ry = Math.max(env.px * 0.8, 0.45 * tilt * F(q[1]) * F(q[1]));
            ctx.fillStyle = mix(col, '#000000', 0.35); ctx.beginPath(); ctx.ellipse(xc, y - q[1], rx, ry, 0, 0, TAU); ctx.fill();
            if (s * ry > 2) { ctx.strokeStyle = mix(col, '#ffffff', 0.16); ctx.lineWidth = Math.max(0.012, env.px * 0.6); ctx.beginPath(); ctx.ellipse(xc, y - q[1], rx * 0.78, ry * 0.78, 0, 0, TAU); ctx.moveTo(xc - rx * 0.6, y - q[1]); ctx.lineTo(xc + rx * 0.6, y - q[1]); ctx.stroke(); }
          }
        }
        if (o.zebra) { // a crossing: bars that run away from you, so they fan out
          const h0 = 0.14, h1 = (near || st * 2.2) - 0.14;
          ctx.fillStyle = paintOld; ctx.beginPath();
          for (let X = o.zebra[0]; X < o.zebra[1]; X += 1.1) { ctx.moveTo(fx(X, h0), y - h0); ctx.lineTo(fx(X + 0.55, h0), y - h0); ctx.lineTo(fx(X + 0.55, h1), y - h1); ctx.lineTo(fx(X, h1), y - h1); ctx.closePath(); }
          ctx.fill();
        }
      }
      // painted lines, with the paint worn through here and there
      ctx.fillStyle = paint; ctx.beginPath();
      const a = Math.floor(vx0 / 6) * 6;
      for (let x = a; x < vx1; x += 6) ctx.rect(x, y - st - 0.08, 2.4, 0.16);
      ctx.fill();
      ctx.fillStyle = paintOld; ctx.fillRect(vx0, y - 0.3, vw, Math.max(0.05, env.px * 0.8)); if (near) ctx.fillRect(vx0, y - near + 0.36, vw, Math.max(0.06, env.px * 0.8));
      if (s > 11) {
        ctx.fillStyle = col; ctx.beginPath();
        for (let x = a; x < vx1; x += 6) { const k = kxH(x, P.z); ctx.rect(x + 0.3 + k * 1.6, y - st - 0.08, 0.1 + k * 0.25, 0.07); ctx.rect(x + 2.2 - k * 1.3, y - st + 0.01, 0.18, 0.07); ctx.rect(x - 0.02, y - st - 0.08, 0.06, 0.05 + k * 0.06); }
        const g0 = Math.floor(vx0 / 2.7) * 2.7; for (let x = g0; x < vx1; x += 2.7) { const k = kxH(x, 3.3); if (k < 0.55) ctx.rect(x, y - 0.31, 0.3 + k, 0.08); }
        ctx.fill();
      }
    }
    // detail layers lying on this ground (K.deco with ground: true): under the water and the light
    if (P.groundDeco) for (let i = 0; i < P.groundDeco.length; i++) P.groundDeco[i].draw(ctx, env);
    // rain: standing water, and lamp light running down the wet surface towards you
    if (puddles && floor && s > 4) {
      const lamps = kxLampsNear(S, P, y), hMax = kind === 'pavement' && o.kerb ? hOf(o.kerb) - 0.06 : (o.near || 1e9) - 0.1;
      ctx.fillStyle = mix(col, S.pal.skyBot, 0.2); ctx.beginPath();
      for (let i = 0; i < puddles.length; i++) {
        const q = puddles[i]; if (q[1] > hMax || y - q[1] < bot) continue; const xc = fx(q[0], q[1]); if (xc < vx0 - 3 || xc > vx1 + 3) continue;
        const rx = q[2] * F(q[1]), ry = Math.max(env.px * 0.9, q[3] * tilt * F(q[1]) * F(q[1]) * 0.5);
        ctx.moveTo(xc + rx, y - q[1]); ctx.ellipse(xc, y - q[1], rx, ry, 0, 0, TAU);
        ctx.moveTo(xc + rx * 1.3, y - q[1] - ry * 0.3); ctx.ellipse(xc + rx * 0.6, y - q[1] - ry * 0.3, rx * 0.7, ry * 0.8, 0, 0, TAU);
      }
      ctx.fill();
      if (dark > 0.3 && lamps.length && e.ok) {
        ctx.globalCompositeOperation = 'lighter';
        const blob = kxBlob(lampCol);
        for (let j = 0; j < lamps.length; j++) {
          const lp = lamps[j]; if (!lp.alive || lp.on === false) continue;
          const lx = kxOnX(e, P, lp.x, lp.plane.z), R1 = 1.3 * (lp.reach || 9); if (lx < vx0 - R1 * 1.4 || lx > vx1 + R1 * 1.4) continue;
          // each puddle in reach holds a little of the lamp
          for (let i = 0; i < puddles.length; i++) {
            const q = puddles[i]; if (q[1] > hMax || y - q[1] < bot) continue; const xc = fx(q[0], q[1]), v = kxFall(Math.abs(xc - lx) / (R1 * F(q[1]) * 1.25)); if (v < 0.03 || xc < vx0 - 3 || xc > vx1 + 3) continue;
            const rx = q[2] * F(q[1]), ry = Math.max(env.px * 0.9, q[3] * tilt * F(q[1]) * F(q[1]) * 0.5);
            ctx.globalAlpha = Math.min(1, 0.5 * v * dark); ctx.drawImage(blob, xc - rx * 0.8 + (lx - xc) * 0.06, y - q[1] - ry, rx * 1.6, ry * 2);
          }
          // and the long smear below the lamp itself
          if (kind === 'road') { const top = Math.min(y, kxOnY(e, P, y, lp.plane.z)), len = (lp.y - lp.baseY) * 1.5 * (d / Math.max(1, lp.plane.z - e.ez)); ctx.globalAlpha = 0.2 * dark; ctx.drawImage(blob, lx - 0.9, y - len - 0.4, 1.8, len + 0.6 + (top - y)); ctx.globalAlpha = 0.16 * dark; ctx.drawImage(blob, lx - 0.35, y - len * 0.8, 0.7, len * 0.8); }
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
    }
    // the part of a nearby lamp's pool of light that falls on this ground
    if (dark > 0.3 && e.ok && floor) {
      const lamps = kxLampsNear(S, P, y);
      if (lamps.length) {
        let any = false; const sp = kxPool(lampCol);
        for (let j = 0; j < lamps.length; j++) {
          const lp = lamps[j]; if (lp.plane === P || !lp.alive || lp.on === false) continue;
          const zl = lp.plane.z, R1 = 1.3 * (lp.reach || 9), cx = kxOnX(e, P, lp.x, zl), cy = kxOnY(e, P, y, zl), rx = R1 * (d / Math.max(1, zl - e.ez)), ry = cy - kxOnY(e, P, y, Math.max(e.ez + 8, zl - R1));
          if (cx + rx < vx0 || cx - rx > vx1 || ry <= 0) continue;
          const frac = (y - (cy - ry)) / (2 * ry); if (frac <= 0.01) continue;
          if (!any) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, (wet ? 0.27 : 0.32) * dark * (lp.poolK === undefined ? 1 : lp.poolK)); any = true; }
          const fr = Math.min(1, frac), b0 = Math.max(cy - ry, lo), r0 = ((b0 - (cy - ry)) / (2 * ry)) * 96, hh = ry * 2 * fr - (b0 - (cy - ry)); if (96 * fr - r0 > 0.5) kxLight(ctx, 'gp' + P.z + lampCol + rx.toFixed(2) + hh.toFixed(2) + r0.toFixed(1), cx - rx, b0, rx * 2, hh, (g) => g.drawImage(sp, 0, r0, 96, 96 * fr - r0, cx - rx, b0, rx * 2, hh));
        }
        if (any) { ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      }
    }
    if (!o.noEdge) R4(ctx, x0, y - Math.max(0.12, env.px * 1.2), x1 - x0, Math.max(0.12, env.px * 1.2), edge);
    if (kind === 'plain' && o.stripes) { ctx.fillStyle = paint; const a = Math.floor(env.x0 / 6) * 6; for (let x = a; x < env.x1; x += 6) ctx.fillRect(x, y - o.stripes - 0.08, 2.4, 0.16); }
  } });
};

// Open water.  o.lights: [[x, colour], ...] puts a rippling streak of light under each.
K.water = function (S, P, o) {
  o = o || {};
  const y = o.y || 0, col = S.tone(o.col || S.pal.water, P), hi = mix(col, '#ffffff', 0.22), lo = mix(col, '#000000', 0.2), sky = mix(col, S.pal.skyBot, 0.3);
  P.groundY = y; P.groundMat = 'water';
  P.add({ x0: -4000, x1: 4000, layer: o.layer || 0, draw(ctx, env) {
    const e = kxSee(env, P), vx0 = env.x0, vw = env.x1 - env.x0, t = env.t;
    R4(ctx, -4000, y - 400, 8000, 400, col);
    // the far water takes the sky, the near water goes deep
    kxFadeAt(ctx, sky, vx0, y, vw, -5, 0.8);
    kxFadeAt(ctx, lo, vx0, y - 22, vw, 22, 0.55);
    ctx.fillStyle = lo; ctx.globalAlpha = 0.55; ctx.fillRect(vx0, y - 400, vw, 378); ctx.globalAlpha = 1;
    // ripples: short where they are far away, long and slow close to
    const lw = Math.max(0.05, env.px);
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? hi : lo; ctx.lineWidth = lw * (pass ? 1 : 1.3);
      ctx.beginPath();
      for (let row = 0; row < 9; row++) {
        const yy = y - 0.12 - row * row * 0.34 - row * 0.3 - pass * (0.06 + row * 0.05); if (env.y0 !== undefined && yy < env.y0) break;
        const step = Math.max(1.6 + row * 0.5, env.px * 22), len = 0.5 + row * 0.42;
        const a = Math.floor(env.x0 / step) * step;
        for (let x = a; x < env.x1; x += step) {
          const r = kxH(x * 0.731 + row * 7.7, pass * 3.1 + 1); if (r > 0.6) continue;
          const dx = Math.sin(t * (0.5 + r) + x + row) * (0.25 + row * 0.07), wob = Math.sin(t * 1.3 + x * 0.7 + row) * 0.03 * (1 + row * 0.3);
          ctx.moveTo(x + dx + r * step, yy + wob); ctx.quadraticCurveTo(x + dx + r * step + len * 0.5, yy + wob + 0.05 + row * 0.012, x + dx + r * step + len * (0.7 + r), yy - wob);
        }
      }
      ctx.stroke();
    }
    // lights on the water
    const lights = o.lights;
    if (lights && lights.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < lights.length; i++) {
        const L = lights[i]; if (L[0] < env.x0 - 4 || L[0] > env.x1 + 4) continue;
        const sp = kxBlob(L[1] || '#ffe196');
        for (let k = 0; k < 7; k++) { const yy = y - 0.25 - k * 0.75, w = 0.5 + k * 0.22 + Math.sin(t * 2.1 + k * 1.7 + i) * 0.2; ctx.globalAlpha = 0.5 * (1 - k / 8) * (0.6 + 0.4 * Math.sin(t * 3 + k * 2.3 + i)); ctx.drawImage(sp, L[0] - w + Math.sin(t * 1.4 + k) * 0.12, yy - 0.22, w * 2, 0.44); }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    if (e.ok && S.pal.dark > 0.3) {
      const lamps = kxLampsNear(S, P, y), blob = kxBlob('#ffe196');
      if (lamps.length) {
        ctx.globalCompositeOperation = 'lighter';
        for (let j = 0; j < lamps.length; j++) { const lp = lamps[j]; if (!lp.alive || lp.on === false) continue; const lx = kxOnX(e, P, lp.x, lp.plane.z); if (lx < env.x0 - 3 || lx > env.x1 + 3) continue; for (let k = 0; k < 6; k++) { const w = 0.4 + k * 0.2 + Math.sin(t * 2.3 + k * 1.9 + j) * 0.16; ctx.globalAlpha = 0.42 * S.pal.dark * (1 - k / 7); ctx.drawImage(blob, lx - w + Math.sin(t * 1.6 + k) * 0.1, y - 0.5 - k * 0.7, w * 2, 0.4); } }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
    }
  } });
};

// A row of far buildings.  New: o.plain = true keeps the old bare boxes; o.haze (0 to 1)
// sets how strongly the bottom of the row fades into the air (default 0.3); o.groundCover is
// passed to its ground as o.cover (how far in front of it the next nearer ground starts).
K.skyline = function (S, z, o) {
  const P = S.plane(z, 'skyline'); o = o || {};
  const R = makeRng(o.seed || 11), x0 = o.x0 === undefined ? -900 : o.x0, x1 = o.x1 === undefined ? 900 : o.x1, base = o.base || 0;
  const bl = [];
  let x = x0;
  while (x < x1) {
    const w = R.r(18, 60) * (o.scale || 1), h = R.r(o.hMin || 30, o.hMax || 160) * (R.chance(0.15) ? 1.5 : 1);
    const b = { x, w, h, c: S.tone(R.pick(o.cols || ['#5c6a7c', '#667488', '#4f5d70', '#727f90']), P), win: [], top: R.i(0, 3) };
    if (S.pal.litChance > 0.1) {
      const cols = Math.floor(w / 7), rows = Math.floor(h / 8);
      for (let i = 0; i < cols; i++) for (let j = 1; j < rows; j++) if (R.chance(S.pal.litChance * 0.55)) b.win.push([x + 3 + i * 7, base + j * 8]);
    }
    bl.push(b); x += w + R.r(-4, 14);
  }
  // decoration from its own stream: roof shapes, setbacks, tanks, masts and how the windows sit
  const D = makeRng((o.seed || 11) * 53 + 19), night = S.pal.dark > 0.3, hMaxAll = (o.hMax || 160);
  for (let i = 0; i < bl.length; i++) {
    const b = bl[i], tall = b.h > hMaxAll * 0.7;
    b.c2 = mix(b.c, '#000000', 0.14); b.c3 = mix(b.c, '#ffffff', 0.07); b.wc = mix(b.c, S.tone(S.pal.glass, P), 0.42);
    b.kind = o.plain ? 0 : D.pick(tall ? [1, 1, 2, 5, 5, 6] : [0, 0, 3, 3, 4, 7, 2, 6]);
    b.k1 = D.f(); b.k2 = D.f(); b.blink = tall || b.top === 2 ? D.f() : -1;
    b.cols = Math.floor(b.w / 7); b.rows = Math.floor(b.h / 8);
    b.set = b.kind === 1 ? [0.14 + D.f() * 0.1, 0.1 + D.f() * 0.12] : null;   // setback: how far in, how far down
    // cool-lit windows are picked out of the warm ones
    b.cool = []; b.warm = [];
    for (let j = 0; j < b.win.length; j++) (D.chance(0.16) ? b.cool : b.warm).push(b.win[j]);
    if (b.set) { const xi = b.x + b.w * b.set[0], xo = b.x + b.w * (1 - b.set[0]), yt = base + b.h * (1 - b.set[1]); const keep = (q) => q[1] + 3.4 < yt || (q[0] > xi && q[0] + 3.2 < xo); b.cool = b.cool.filter(keep); b.warm = b.warm.filter(keep); }
  }
  const lit = S.tone(S.pal.lit, P, true), cool = S.tone('#cfe0ff', P, true), fogC = S.pal.fog, hz = o.haze === undefined ? 0.3 : o.haze, dkc = S.tone('#20242c', P);
  P.add({ x0, x1, draw(ctx, env) {
    kxSee(env, P);
    const s = env.s, lw = Math.max(0.8, env.px);
    for (let i = 0; i < bl.length; i++) {
      const b = bl[i]; if (b.x + b.w < env.x0 - 8 || b.x > env.x1 + 8) continue;
      const top = base + b.h;
      if (b.set) { // a tower that steps in near the top
        const xi = b.w * b.set[0], yt = base + b.h * (1 - b.set[1]);
        R4(ctx, b.x, base, b.w, yt - base, b.c); R4(ctx, b.x + xi, yt, b.w - xi * 2, top - yt, b.c);
        if (s > 0.5) { R4(ctx, b.x + b.w * 0.86, base, b.w * 0.14, yt - base, b.c2); R4(ctx, b.x + b.w - xi - (b.w - xi * 2) * 0.14, yt, (b.w - xi * 2) * 0.14, top - yt, b.c2); R4(ctx, b.x, yt - 1.2, b.w, 1.2, b.c3); }
      } else {
        R4(ctx, b.x, base, b.w, b.h, b.c);
        if (s > 0.5) R4(ctx, b.x + b.w * 0.86, base, b.w * 0.14, b.h, b.c2);
      }
      // what stands on the roof
      if (b.top === 1) R4(ctx, b.x + b.w * 0.3, top, b.w * 0.4, b.h * 0.08, b.c);
      if (b.top === 2) { ctx.strokeStyle = b.c; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(b.x + b.w * 0.5, top); ctx.lineTo(b.x + b.w * 0.5, base + b.h * 1.18); ctx.stroke(); }
      if (b.kind === 2) poly(ctx, [b.x, top, b.x + b.w, top, b.x + b.w * (0.6 + b.k1 * 0.3), top + b.w * 0.16, b.x + b.w * (0.1 + b.k1 * 0.2), top + b.w * 0.16], b.c2);               // hipped roof
      else if (b.kind === 3) { const tx = b.x + b.w * (0.2 + b.k1 * 0.5), th = 5.5; ctx.fillStyle = b.c2; ctx.fillRect(tx - 0.25, top, 0.5, th * 0.5); ctx.fillRect(tx + 2.6, top, 0.5, th * 0.5); ctx.fillRect(tx - 0.6, top + th * 0.5, 4, th * 0.6); poly(ctx, [tx - 0.9, top + th * 1.1, tx + 3.7, top + th * 1.1, tx + 1.4, top + th * 1.5], b.c2); }   // water tank
      else if (b.kind === 4) { ctx.fillStyle = b.c2; ctx.fillRect(b.x + b.w * 0.12, top, 3.2, 4.2 + b.k1 * 5); ctx.fillRect(b.x + b.w * 0.62, top, 2.6, 3 + b.k2 * 4); if (s > 1) { ctx.fillStyle = b.c3; ctx.fillRect(b.x + b.w * 0.12 - 0.3, top + 4.2 + b.k1 * 5, 3.8, 0.7); } }   // chimney stacks
      else if (b.kind === 5) { const cx = b.x + b.w * 0.5; poly(ctx, [cx - b.w * 0.22, top, cx + b.w * 0.22, top, cx + b.w * 0.1, top + b.h * 0.07, cx + b.w * 0.03, top + b.h * 0.07, cx, top + b.h * (0.16 + b.k1 * 0.1), cx - b.w * 0.03, top + b.h * 0.07, cx - b.w * 0.1, top + b.h * 0.07], b.c); }   // crown and spire
      else if (b.kind === 6) { ctx.fillStyle = b.c2; ctx.fillRect(b.x + b.w * 0.08, top, b.w * 0.3, 2.4); ctx.fillRect(b.x + b.w * 0.55, top, b.w * 0.2, 3.6); ctx.strokeStyle = b.c2; ctx.lineWidth = lw; ctx.beginPath(); const ax = b.x + b.w * (0.3 + b.k2 * 0.5); ctx.moveTo(ax, top); ctx.lineTo(ax, top + 9 + b.k1 * 8); ctx.moveTo(ax - 1.6, top + 6); ctx.lineTo(ax + 1.6, top + 6); ctx.stroke(); }   // plant room and aerial
      else if (b.kind === 7) poly(ctx, [b.x, top, b.x + b.w, top, b.x + b.w, top + 2 + b.k1 * 4, b.x, top + 0.6], b.c2);   // lean-to roof
      if (s > 0.9 && b.kind !== 2 && b.kind !== 7) R4(ctx, b.x - 0.4, top - 0.2, b.w + 0.8, 1.1, b.c3);                    // parapet
    }
    // windows, dark ones first, each colour in one go
    if (s > 2.5) {
      for (let i = 0; i < bl.length; i++) {
        const b = bl[i]; if (b.x + b.w < env.x0 || b.x > env.x1 || b.cols < 1) continue;
        ctx.fillStyle = b.wc; ctx.beginPath();
        const yt = b.set ? base + b.h * (1 - b.set[1]) : 1e9, xi = b.set ? b.x + b.w * b.set[0] : 0, xo = b.set ? b.x + b.w * (1 - b.set[0]) : 0;
        const j0 = Math.max(1, env.y0 === undefined ? 1 : Math.floor((env.y0 - base) / 8)), j1 = Math.min(b.rows, env.y1 === undefined ? b.rows : Math.ceil((env.y1 - base) / 8));
        for (let j = j0; j < j1; j++) { const wy = base + j * 8; for (let c = 0; c < b.cols; c++) { const wx = b.x + 3 + c * 7; if (wx + 3.2 > b.x + b.w - 0.5) continue; if (wy + 3.4 >= yt && (wx <= xi || wx + 3.2 >= xo)) continue; ctx.rect(wx, wy, 3.2, 3.4); } }
        ctx.fill();
        if (s > 5) { ctx.fillStyle = b.c3; ctx.beginPath(); for (let j = j0; j < j1; j++) ctx.rect(b.x, base + j * 8 - 1.5, b.w * 0.86, 0.5); ctx.fill(); }   // floor bands
      }
    }
    if (env.s > 0.08) {
      for (let pass = 0; pass < 2; pass++) {
        ctx.fillStyle = pass ? cool : lit; ctx.beginPath();
        for (let i = 0; i < bl.length; i++) { const b = bl[i]; if (b.x + b.w < env.x0 || b.x > env.x1) continue; const l = pass ? b.cool : b.warm; for (let j = 0; j < l.length; j++) ctx.rect(l[j][0], l[j][1], 3.2, 3.4); }
        ctx.fill();
      }
      if (s > 6) { // glazing bars once the windows are big enough to want them
        ctx.fillStyle = dkc; ctx.globalAlpha = 0.5; ctx.beginPath();
        for (let i = 0; i < bl.length; i++) { const b = bl[i]; if (b.x + b.w < env.x0 || b.x > env.x1) continue; for (let j = 0; j < b.win.length; j++) { const q = b.win[j]; if (q[0] > env.x1 || q[0] + 3.2 < env.x0) continue; ctx.rect(q[0] + 1.5, q[1], 0.2, 3.4); ctx.rect(q[0], q[1] + 1.9, 3.2, 0.18); } }
        ctx.fill(); ctx.globalAlpha = 1;
      }
    }
    // warning lights on the tall masts
    if (night) for (let i = 0; i < bl.length; i++) {
      const b = bl[i]; if (b.blink < 0 || b.x + b.w < env.x0 || b.x > env.x1) continue;
      const on = Math.sin(env.t * (1.6 + b.blink) + b.blink * 40) > 0.25; if (!on) continue;
      const bx = b.x + b.w * 0.5, by = b.top === 2 ? base + b.h * 1.18 : b.kind === 5 ? base + b.h * (1.16 + b.k1 * 0.1) : base + b.h + 1.4, r = Math.max(0.7, env.px * 1.3);
      circ(ctx, bx, by, r, '#ff4a3d'); if (s > 0.8) kxGlow(ctx, '#ff4a3d', bx, by, r * 5, 0.5);
    }
    // the foot of the row sinks into the air
    if (hz > 0) kxFadeAt(ctx, fogC, Math.max(x0, env.x0), base, Math.min(x1, env.x1) - Math.max(x0, env.x0), (o.hMin || 30) * 1.6, hz);
  } });
  P.kxBuildings = bl;
  if (o.ground !== false) K.ground(S, P, { y: base, col: o.groundCol || '#6d7986', noEdge: true, shade: false, cover: o.groundCover });
  return P;
};

// A mountain range.  New: o.ridges = false leaves the faces plain; o.treeLine = false
// leaves out the dark band of forest along the foot (it is left out in snow anyway).
K.mountains = function (S, z, o) {
  const P = S.plane(z, 'mtn'); o = o || {};
  const R = makeRng(o.seed || 5), x0 = o.x0 === undefined ? -3000 : o.x0, x1 = o.x1 === undefined ? 3000 : o.x1, base = o.base || 0, H = o.h || 600;
  const pts = []; let x = x0;
  while (x <= x1) { pts.push([x, base + H * (0.35 + 0.65 * Math.abs(vnoise(x / (o.rough || 420), o.seed || 5))) * (0.75 + 0.25 * R.f())]); x += R.r(60, 170) * (o.step || 1); }
  const rock = S.tone(o.col || '#5f6b78', P), shade = S.tone(darken(o.col || '#5f6b78', 0.22), P), snow = S.tone(o.snowCol || '#f2f6fa', P);
  const light = S.tone(lighten(o.col || '#5f6b78', 0.1), P), snowSh = mix(snow, shade, 0.3), deep = mix(shade, '#000000', 0.12);
  // ridges, gullies and the tree line come from a stream of their own
  const D = makeRng((o.seed || 5) * 71 + 3), peaks = [], sl = o.snowLine || 0.62;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    if (!(b[1] > a[1] && b[1] > c[1])) continue;
    const pk = { i, ridge: [], gul: [] };
    // a ridge wandering down from the summit towards the left foot, and two gullies on the lit side
    let rx = b[0], ry = b[1]; const fall = (b[1] - base);
    for (let k = 0; k < 6; k++) { rx -= (b[0] - a[0]) * D.r(0.06, 0.2) * (k % 2 ? 0.4 : 1) - (k % 2 ? fall * 0.03 : 0); ry -= fall * D.r(0.1, 0.19); pk.ridge.push(rx, ry); }
    for (let g = 0; g < 2; g++) { const u = D.r(0.25, 0.75), gx = lerp(b[0], a[0], u), gy = lerp(b[1], a[1], u) - 4; pk.gul.push([gx, gy, gx + D.r(-30, 10), gy - fall * D.r(0.12, 0.26)]); }
    peaks.push(pk);
  }
  const trees = o.treeLine !== false && S.time !== 'snow' && !o.noTrees, tl = [];
  if (trees) { for (let xx = x0; xx <= x1; xx += 46) tl.push([xx, base + H * (0.07 + 0.06 * (0.5 + 0.5 * vnoise(xx / 210, (o.seed || 5) + 9))) + D.r(0, 9)]); }
  const forest = S.tone(mix(o.col || '#5f6b78', '#22382e', 0.62), P);
  P.add({ x0, x1, draw(ctx, env) {
    kxSee(env, P);
    ctx.fillStyle = rock; ctx.beginPath(); ctx.moveTo(x0, base - 50);
    for (let i = 0; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineTo(x1, base - 50); ctx.closePath(); ctx.fill();
    // shaded right faces and snow caps on the peaks
    for (let q = 0; q < peaks.length; q++) {
      const i = peaks[q].i, a = pts[i - 1], b = pts[i], c = pts[i + 1];
      if (c[0] < env.x0 - 300 || a[0] > env.x1 + 300) continue;
      poly(ctx, [b[0], b[1], c[0], c[1], lerp(b[0], c[0], 0.35), base, b[0] + (c[0] - b[0]) * 0.1, base], shade);
      if (o.ridges !== false) {
        const rg = peaks[q].ridge;
        // the lit flank of the ridge, then a darker fold under it
        ctx.fillStyle = light; ctx.beginPath(); ctx.moveTo(b[0], b[1]); for (let k = 0; k < rg.length; k += 2) ctx.lineTo(rg[k], rg[k + 1]); ctx.lineTo(rg[rg.length - 2] - (b[1] - base) * 0.12, rg[rg.length - 1]); ctx.lineTo(lerp(b[0], a[0], 0.45), lerp(b[1], a[1], 0.45)); ctx.closePath(); ctx.fill();
        ctx.fillStyle = deep; ctx.beginPath(); ctx.moveTo(b[0] + (c[0] - b[0]) * 0.1, b[1] - (b[1] - c[1]) * 0.1); ctx.lineTo(lerp(b[0], c[0], 0.5), lerp(b[1], c[1], 0.5)); ctx.lineTo(lerp(b[0], c[0], 0.3), base + (b[1] - base) * 0.2); ctx.closePath(); ctx.fill();
        if (env.s > 0.05) { ctx.strokeStyle = shade; ctx.lineWidth = Math.max(1.2, env.px); ctx.beginPath(); const gl = peaks[q].gul; for (let g = 0; g < gl.length; g++) { ctx.moveTo(gl[g][0], gl[g][1]); ctx.lineTo(gl[g][2], gl[g][3]); } ctx.stroke(); }
      }
      if (o.snow !== false && b[1] - base > H * sl) {
        const d = (b[1] - base - H * sl) * 0.9 + 12;
        const la = [lerp(b[0], a[0], d / Math.max(1, b[1] - a[1] + d)), b[1] - d * 0.9], rc = [lerp(b[0], c[0], d / Math.max(1, b[1] - c[1] + d)), b[1] - d];
        poly(ctx, [b[0], b[1], la[0], la[1], lerp(la[0], b[0], 0.45), la[1] + d * 0.25, b[0] - 2, la[1] - d * 0.12, lerp(b[0], rc[0], 0.5), rc[1] + d * 0.3, rc[0], rc[1]], snow);
        poly(ctx, [b[0], b[1], b[0] - 2, la[1] - d * 0.12, lerp(b[0], rc[0], 0.5), rc[1] + d * 0.3, rc[0], rc[1]], snowSh);   // the shaded side of the cap
        if (o.ridges !== false) { // streaks of snow lying in the gullies below the cap
          ctx.fillStyle = snow; const gl = peaks[q].gul;
          for (let g = 0; g < gl.length; g++) if (gl[g][1] - base > H * sl * 0.8) poly(ctx, [gl[g][0] - 5, gl[g][1], gl[g][0] + 5, gl[g][1], lerp(gl[g][0], gl[g][2], 0.6) + 2, lerp(gl[g][1], gl[g][3], 0.6), lerp(gl[g][0], gl[g][2], 0.6) - 2, lerp(gl[g][1], gl[g][3], 0.6)], snow);
        }
      }
    }
    if (tl.length) { // forest along the foot
      ctx.fillStyle = forest; ctx.beginPath(); ctx.moveTo(x0, base - 50);
      for (let i = 0; i < tl.length; i++) { const q = tl[i]; if (q[0] < env.x0 - 100 || q[0] > env.x1 + 100) { if (i === 0 || i === tl.length - 1) ctx.lineTo(q[0], q[1]); continue; } ctx.lineTo(q[0] - 14, q[1] - 7); ctx.lineTo(q[0], q[1] + 9); ctx.lineTo(q[0] + 14, q[1] - 5); }
      ctx.lineTo(x1, base - 50); ctx.closePath(); ctx.fill();
    }
    kxFadeAt(ctx, S.pal.fog, Math.max(x0, env.x0), base, Math.min(x1, env.x1) - Math.max(x0, env.x0), H * 0.45, 0.3);
  } });
  return P;
};

// Rolling hills.  New: o.rim = false leaves off the lit crest line.
K.hills = function (S, z, o) {
  const P = S.plane(z, 'hill'); o = o || {};
  const x0 = o.x0 === undefined ? -2500 : o.x0, x1 = o.x1 === undefined ? 2500 : o.x1, base = o.base || 0, H = o.h || 60, sd = o.seed || 3;
  const col = S.tone(o.col || S.pal.grass, P), step = o.step || 25;
  const pts = []; for (let x = x0; x <= x1; x += step) pts.push([x, base + H * (0.5 + 0.5 * vnoise(x / (o.rough || 160), sd))]);
  const trees = [];
  if (o.trees) { const R = makeRng(sd * 31); for (let i = 0; i < pts.length; i++) if (R.chance(o.trees)) trees.push([pts[i][0] + R.r(-8, 8), pts[i][1] - R.r(0, 2), R.r(6, 15)]); }
  const tcol = S.tone(o.treeCol || '#2f5140', P), tcol2 = mix(tcol, '#000000', 0.2), rim = mix(col, '#ffffff', 0.16), fold = mix(col, '#000000', 0.1);
  for (let i = 0; i < trees.length; i++) trees[i][3] = kxH(trees[i][0], sd);       // which trees are the darker sort
  P.heightAt = (x) => { const i = clamp((x - x0) / step, 0, pts.length - 1.001), a = Math.floor(i); return lerp(pts[a][1], pts[a + 1][1], i - a); };
  P.add({ x0, x1, draw(ctx, env) {
    kxSee(env, P);
    const i0 = clamp(Math.floor((env.x0 - x0) / step) - 1, 0, pts.length - 1), i1 = clamp(Math.ceil((env.x1 - x0) / step) + 1, 0, pts.length - 1);
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(pts[i0][0], base - 400);
    for (let i = i0; i <= i1; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[i1][0], base - 400); ctx.closePath(); ctx.fill();
    if (env.s > 0.25) {
      // a second, lower fold of the land, a shade darker
      ctx.fillStyle = fold; ctx.beginPath(); ctx.moveTo(pts[i0][0], base - 400);
      for (let i = i0; i <= i1; i++) ctx.lineTo(pts[i][0], pts[i][1] - H * (0.16 + 0.12 * Math.sin(i * 0.9 + sd)));
      ctx.lineTo(pts[i1][0], base - 400); ctx.closePath(); ctx.fill();
      if (o.rim !== false) { ctx.strokeStyle = rim; ctx.lineWidth = Math.max(H * 0.012, env.px * 1.1); ctx.beginPath(); for (let i = i0; i <= i1; i++) { if (i === i0) ctx.moveTo(pts[i][0], pts[i][1]); else ctx.lineTo(pts[i][0], pts[i][1]); } ctx.stroke(); }
    }
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? tcol2 : tcol; ctx.beginPath();
      for (let i = 0; i < trees.length; i++) { const t = trees[i]; if (t[0] < env.x0 - 10 || t[0] > env.x1 + 10 || (t[3] > 0.6) !== !!pass) continue; kxPinePath(ctx, t[0], t[1], t[2]); }
      ctx.fill();
    }
  } });
  P.groundY = base; P.groundMat = o.mat || 'dirt'; P.groundFn = P.heightAt;
  return P;
};

function pineShape(ctx, x, y, h) {
  ctx.beginPath();
  kxPinePath(ctx, x, y, h);
  ctx.fill();
}
// The outline of a small fir as one closed shape (no fill, so many can share one).
function kxPinePath(ctx, x, y, h) {
  ctx.moveTo(x, y + h); ctx.lineTo(x - h * 0.2, y + h * 0.55); ctx.lineTo(x - h * 0.1, y + h * 0.55); ctx.lineTo(x - h * 0.28, y + h * 0.25); ctx.lineTo(x - h * 0.14, y + h * 0.25);
  ctx.lineTo(x - h * 0.34, y + h * 0.02); ctx.lineTo(x - h * 0.04, y + h * 0.02); ctx.lineTo(x - h * 0.04, y - 0.3); ctx.lineTo(x + h * 0.04, y - 0.3); ctx.lineTo(x + h * 0.04, y + h * 0.02);
  ctx.lineTo(x + h * 0.34, y + h * 0.02); ctx.lineTo(x + h * 0.14, y + h * 0.25); ctx.lineTo(x + h * 0.28, y + h * 0.25); ctx.lineTo(x + h * 0.1, y + h * 0.55); ctx.lineTo(x + h * 0.2, y + h * 0.55);
  ctx.closePath();
}
// A full-size fir: trunk, five tiers of boughs with ragged edges, a shaded side, snow if asked.
K.pine = function (S, P, x, h, o) {
  o = o || {}; const col = S.tone(o.col || '#27483a', P), snow = o.snow ? S.tone('#eef3f7', P) : null, y = o.y || 0;
  const dk = mix(col, '#000000', 0.2), hi = mix(col, '#ffffff', 0.1), trunk = S.tone('#4a3a2c', P), snowSh = snow ? mix(snow, col, 0.25) : null;
  const tiers = [[1.0, 0.72, 0.15], [0.8, 0.5, 0.21], [0.6, 0.3, 0.27], [0.42, 0.14, 0.32], [0.25, 0.02, 0.36]];   // top, bottom, half width (fractions of the height)
  const jag = []; for (let i = 0; i < tiers.length; i++) { const q = []; for (let k = 0; k < 7; k++) q.push(kxH(x * 3.1 + i * 7.3, k + h)); jag.push(q); }
  P.add({ x0: x - h * 0.42, x1: x + h * 0.42, layer: o.layer || 0, draw(ctx, env) {
    const s = env.s, sway = Math.sin(env.t * 0.8 + x) * 0.012 * h * (0.3 + Math.abs(env.wind || 0) * 0.14) + (env.wind || 0) * 0.004 * h;
    if (s * h < 26) { ctx.fillStyle = col; pineShape(ctx, x, y, h); if (snow) { poly(ctx, [x, y + h, x - h * 0.13, y + h * 0.7, x, y + h * 0.78, x + h * 0.12, y + h * 0.68], snow); poly(ctx, [x - h * 0.1, y + h * 0.55, x - h * 0.22, y + h * 0.32, x - h * 0.04, y + h * 0.4], snow); poly(ctx, [x + h * 0.1, y + h * 0.55, x + h * 0.24, y + h * 0.3, x + h * 0.03, y + h * 0.42], snow); } return; }
    R4(ctx, x - h * 0.035, y - 0.3, h * 0.07, h * 0.16 + 0.3, trunk); R4(ctx, x + h * 0.008, y - 0.3, h * 0.027, h * 0.16 + 0.3, mix(trunk, '#000000', 0.25));
    const lean = (u) => sway * u * u;
    for (let i = tiers.length - 1; i >= 0; i--) {
      const t = tiers[i], yt = y + h * t[0], yb = y + h * t[1], hw = h * t[2], q = jag[i], lt = lean(t[0]), lb = lean(t[1]);
      // the whole tier, then its shaded right half
      for (let pass = 0; pass < 2; pass++) {
        ctx.fillStyle = pass ? dk : col; ctx.beginPath(); ctx.moveTo(x + lt, yt + (i === 0 ? 0 : h * 0.07));
        if (!pass) { ctx.lineTo(x + lb - hw, yb + h * 0.012); for (let k = 0; k < 7; k++) { const u = (k + 0.5) / 7; ctx.lineTo(x + lb - hw + u * hw * 2, yb - h * 0.03 * (0.4 + q[k]) * (k % 2 ? 1 : 0.2)); } }
        else { ctx.lineTo(x + lb + hw * 0.08, yb + h * 0.01); for (let k = 4; k < 7; k++) { const u = (k + 0.5) / 7; ctx.lineTo(x + lb - hw + u * hw * 2, yb - h * 0.03 * (0.4 + q[k]) * (k % 2 ? 1 : 0.2)); } }
        ctx.lineTo(x + lb + hw, yb + h * 0.012); ctx.closePath(); ctx.fill();
      }
      if (s * h > 60) { ctx.fillStyle = hi; ctx.beginPath(); ctx.moveTo(x + lt - hw * 0.1, yt - (yt - yb) * 0.25); ctx.lineTo(x + lb - hw * 0.92, yb + h * 0.02); ctx.lineTo(x + lb - hw * 0.5, yb + h * 0.035); ctx.closePath(); ctx.fill(); }
      if (snow) { // snow lying on the upper part of each bough, with a ragged lower edge
        const ya = yt + (i === 0 ? 0 : h * 0.07), xm = x + (lt + lb) / 2, m = (u) => lerp(ya, yb, u);
        poly(ctx, [x + lt, ya, xm - hw * 0.55, m(0.58), xm - hw * 0.3, m(0.46 + q[1] * 0.1), xm - hw * 0.12, m(0.62), xm + hw * 0.1, m(0.44 + q[2] * 0.1), xm + hw * 0.3, m(0.6), xm + hw * 0.52, m(0.55)], snow);
        poly(ctx, [x + lt, ya, xm + hw * 0.1, m(0.44 + q[2] * 0.1), xm + hw * 0.3, m(0.6), xm + hw * 0.52, m(0.55)], snowSh);
      }
    }
  } });
  if (o.solid !== false) P.solid(x - h * 0.04, y, h * 0.08, h * 0.3, 'wood');
};
// A broad-leaved tree: trunk, a few boughs, and leaf masses in three tones that stir in the wind.
K.tree = function (S, P, x, h, o) {
  o = o || {}; const leaf = S.tone(o.col || '#4d7f4a', P), leaf2 = S.tone(darken(o.col || '#4d7f4a', 0.18), P), trunk = S.tone('#4a3a2c', P), y = o.y || 0;
  const leaf3 = S.tone(lighten(o.col || '#4d7f4a', 0.14), P), trunk2 = mix(trunk, '#000000', 0.25);
  const R = makeRng(Math.floor(x * 13 + h * 7) + 3), blobs = [];
  for (let i = 0; i < 6; i++) blobs.push([R.r(-0.32, 0.32) * h, h * R.r(0.55, 0.95), h * R.r(0.16, 0.26)]);
  // extra leaf masses and the boughs come from their own stream
  const D = makeRng(Math.floor(x * 29 + h * 11) + 77), tufts = [], boughs = [];
  for (let i = 0; i < 9; i++) tufts.push([D.r(-0.3, 0.3) * h, h * D.r(0.6, 0.98), h * D.r(0.07, 0.13), D.f()]);
  for (let i = 0; i < 3; i++) boughs.push([D.r(0.42, 0.56), (i - 1) * D.r(0.14, 0.26) + D.r(-0.04, 0.04), D.r(0.68, 0.82)]);
  P.add({ x0: x - h * 0.5, x1: x + h * 0.5, layer: o.layer || 0, draw(ctx, env) {
    const s = env.s, w = Math.abs(env.wind || 0), sw = Math.sin(env.t * 0.9 + x) * 0.02 * h * (0.3 + w * 0.12);
    poly(ctx, [x - h * 0.045, y, x + h * 0.045, y, x + h * 0.022, y + h * 0.62, x - h * 0.022, y + h * 0.62], trunk);
    if (s * h > 30) {
      poly(ctx, [x + h * 0.008, y, x + h * 0.045, y, x + h * 0.022, y + h * 0.62, x + h * 0.004, y + h * 0.62], trunk2);
      ctx.strokeStyle = trunk; ctx.lineWidth = Math.max(h * 0.018, env.px); ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i < boughs.length; i++) { const b = boughs[i]; ctx.moveTo(x, y + h * b[0]); ctx.quadraticCurveTo(x + h * b[1] * 0.4, y + h * (b[0] + 0.1), x + h * b[1] + sw * 0.5, y + h * b[2]); }
      ctx.stroke(); ctx.lineCap = 'butt';
    }
    ctx.fillStyle = leaf2; ctx.beginPath();
    for (let i = 1; i < blobs.length; i += 2) { const b = blobs[i], bx = x + b[0] + sw * (b[1] / h); ctx.moveTo(bx + b[2], y + b[1]); ctx.arc(bx, y + b[1], b[2], 0, TAU); }
    ctx.fill();
    ctx.fillStyle = leaf; ctx.beginPath();
    for (let i = 0; i < blobs.length; i += 2) { const b = blobs[i], bx = x + b[0] + sw * (b[1] / h); ctx.moveTo(bx + b[2], y + b[1]); ctx.arc(bx, y + b[1], b[2], 0, TAU); }
    ctx.fill();
    if (s * h > 22) { // smaller clumps on top: dark below, light where the sky catches them, each moving a little on its own
      for (let pass = 0; pass < 2; pass++) {
        ctx.fillStyle = pass ? leaf3 : leaf2; ctx.beginPath();
        for (let i = 0; i < tufts.length; i++) { const q = tufts[i]; if ((q[3] > 0.5) !== !!pass) continue; const fl = Math.sin(env.t * (1.4 + q[3]) + i * 2.1 + x) * 0.012 * h * (0.2 + w * 0.2); const bx = x + q[0] + sw * (q[1] / h) + fl, by = y + q[1] + (pass ? q[2] * 0.3 : -q[2] * 0.5) + fl * 0.4; ctx.moveTo(bx + q[2], by); ctx.arc(bx, by, q[2], 0, TAU); }
        ctx.fill();
      }
    }
  } });
  if (o.solid !== false) P.solid(x - h * 0.03, y, h * 0.06, h * 0.5, 'wood');
  if (o.canopy) P.solid(x - h * 0.3, y + h * 0.5, h * 0.6, h * 0.45, 'leaf');
};
// ---- buildings -------------------------------------------------------------
// The workhorse. Lays out a wall with a grid of windows; every window is an
// opening into a room, and a room can be lit or dark.
K.building = function (S, P, o) {
  const R = makeRng(o.seed || Math.floor(o.x * 7 + 13));
  const fh = o.fh || 3.3, floors = o.floors || 4, base = o.base || 0, w = o.w, x = o.x;
  const cols = o.cols || Math.max(1, Math.floor(w / 3.6));
  const style = o.style || 'brick';
  const tall = style === 'glass';
  const winW = o.winW || (tall ? (w / cols) * 0.86 : 1.5), winH = o.winH || (tall ? fh - 0.7 : 1.55), sill = o.sill === undefined ? (tall ? 0.25 : 0.95) : o.sill;
  const para = o.parapet === undefined ? 0.9 : o.parapet;
  const roofY = base + floors * fh;
  const id = o.id || ('b' + Math.round(x));
  const wallBase = o.wall || R.pick(['#8c5a48', '#9a6a52', '#7d6a5c', '#a08572', '#6f7680', '#8a7f72']);
  const wall = S.tone(wallBase, P), wall2 = S.tone(darken(wallBase, 0.14), P), trim = S.tone(o.trim || lighten(wallBase, 0.35), P), wallHi = S.tone(lighten(wallBase, 0.1), P);
  const frame = S.tone(o.frame || '#e6e0d2', P), glass = S.tone(S.pal.glass, P), inRoom = S.tone(S.pal.inRoom, P);
  const B = { id, x, w, base, fh, floors, roofY, cols, P, wins: {}, para };
  B.floorY = (f) => base + f * fh;
  B.winX = (c) => x + ((c + 0.5) * w) / cols;
  B.roomId = (f, c) => id + ':' + f + ':' + c;
  B.roofRoom = id + ':roof';
  B.win = (f, c) => B.wins[f + ',' + c];
  const startF = o.shop ? 1 : 0;
  const spans = o.spans || {}; // { floor: [[c0,c1,roomName,lit], ...] } merges windows into one room
  const over = o.wins || {};
  for (let f = startF; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const ov = over[f + ',' + c] || {};
      if (ov.none) continue;
      let room = B.roomId(f, c), lit;
      const sp = spans[f];
      if (sp) for (let i = 0; i < sp.length; i++) if (c >= sp[i][0] && c <= sp[i][1]) { room = id + ':' + (sp[i][2] || ('s' + f + '_' + i)); lit = sp[i][3]; }
      if (ov.lit !== undefined) lit = ov.lit;
      if (lit === undefined) lit = S.rooms[room] ? S.rooms[room].lit : R.chance(S.pal.litChance);
      S.room(room, lit);
      const ww = ov.w || winW, hh = ov.h || winH, sy = ov.sill === undefined ? sill : ov.sill;
      const op = P.open({ x: B.winX(c) - ww / 2, y: B.floorY(f) + sy, w: ww, h: hh, room, glass: ov.open ? false : true, blind: ov.blind === undefined ? (R.chance(0.2) ? R.r(0.15, 0.5) : 0) : ov.blind,
        curtain: ov.curtain, f, c, deco: R.i(0, 5), tint: R.pick(['#ffd98a', '#ffe7b3', '#f7c873', '#d6e6ff', '#ffdca0']), door: ov.door });
      B.wins[f + ',' + c] = op;
    }
  }
  // roof: figures up there stand behind the parapet, visible above it
  if (o.roofAccess !== false) P.open({ x, y: roofY + para, w, h: 4.5, room: B.roofRoom, glass: false, through: true, roof: true });
  P.solid(x, base, w, floors * fh + para, o.mat || 'wall', { bid: id });
  if (o.shop) {
    const sr = S.room(id + ':shop', o.shop.lit !== undefined ? o.shop.lit : S.pal.litChance > 0.2);
    B.shop = P.open({ x: x + 0.8, y: base + 0.5, w: w - 1.6 - (o.shop.door ? 1.6 : 0), h: fh - 1.5, room: sr.id, glass: true, blind: 0, deco: 9, tint: '#ffe7b3', f: 0, c: 0 });
  }
  const decoR = makeRng((o.seed || 3) * 97 + 5);
  const acs = []; if (o.ac !== false && !tall) for (let f = startF; f < floors; f++) for (let c = 0; c < cols; c++) if (decoR.chance(0.14) && B.wins[f + ',' + c]) acs.push(B.wins[f + ',' + c]);
  const bricks = []; for (let i = 0; i < Math.floor(w * floors * 0.5); i++) bricks.push([x + decoR.r(0.4, w - 1.2), base + decoR.r(0.3, floors * fh - 0.5), decoR.r(0.5, 1.1)]);

  // ---- everything below is decoration, made from its own random stream ----
  //   o.style   'brick' (default), 'concrete' (also chosen for a grey wall), 'glass'
  //   o.dish    a small satellite dish on the roof (true, or 0..1 across the roof)
  //   o.roofDeco false leaves the small roof vents off
  //   o.plain   true draws the wall without pipes, vents, alarm box or cables
  const D = makeRng((o.seed || 3) * 131 + 977 + Math.round(w * 7 + x * 3));
  const kStyle = tall ? 'glass' : o.style === 'concrete' || (o.style === undefined && kxSat(wallBase) < 0.2) ? 'concrete' : 'brick';
  const stone = S.tone(o.trim || lighten(wallBase, 0.3), P), stoneSh = S.tone(darken(o.trim || lighten(wallBase, 0.3), 0.22), P), wallLo = S.tone(darken(wallBase, 0.28), P), pipeC = S.tone('#272b32', P), pipeHi = S.tone('#4a505a', P);
  const sideW = Math.min(0.9, w * 0.06), dark = S.pal.dark, night = dark > 0.3, H = floors * fh + para;
  const pier = (c) => x + (c * w) / cols;
  const barKind = D.pick([0, 0, 1, 2, 1, 3]), lintel = D.pick(['stone', 'stone', 'arch', 'brick']), quoin = kStyle === 'brick' && D.chance(0.55), drapeCols = ['#b9a48c', '#8a5a5a', '#5f7a8c', '#c9c2a8', '#7a8a6a', '#a8704a'], boxCols = ['#d9482b', '#e8a23a', '#b56bb0', '#f1ede2', '#e86a8a'];
  for (const key in B.wins) {
    const op = B.wins[key], hh = kxH(op.f * 17.3 + op.c * 5.1, (o.seed || 3) + x * 0.37);
    const kd = op.kd = { bars: tall ? -1 : barKind, drape: 0, box: 0, id };
    if (tall || op.door || !op.glass) continue;
    if (op.curtain === undefined && !op.blind) { const u = kxH(hh * 91.7, 2); kd.drape = u < 0.17 ? 1 : u < 0.28 ? 2 : u < 0.36 ? 3 : 0; kd.drapeCol = drapeCols[Math.floor(kxH(hh * 7.9, 5) * drapeCols.length)]; }
    if (op.f > 0 && kxH(hh * 53.3, 9) < 0.12 && acs.indexOf(op) < 0) { kd.box = 1; kd.boxCol = boxCols[Math.floor(kxH(hh * 3.3, 4) * boxCols.length)]; }
  }
  if (B.shop) B.shop.kd = { bars: -1, drape: 0, box: 0, id, shop: String(o.shop.sign || '').toUpperCase() };
  const vents = [], oddBricks = [], copeStains = [], pipes = [];
  if (!tall && !o.plain) {
    for (let i = 0; i < Math.max(1, Math.round((w * floors) / 34)); i++) if (cols > 1) vents.push([pier(D.i(1, cols - 1)) - 0.17, B.floorY(D.i(startF, floors - 1)) + D.r(1.2, 2.3), D.chance(0.5)]);
    if (w > 7) { pipes.push(x + 0.24); if (w > 16 && D.chance(0.6)) pipes.push(x + w - sideW - 0.36); }
    for (let i = 0; i < Math.round(w / 3.2); i++) copeStains.push([x + D.r(0.3, w - 0.5), D.r(0.6, 2.6), D.r(0.07, 0.17)]);
  }
  if (kStyle === 'brick') for (let i = 0; i < bricks.length; i++) { const b = bricks[i]; oddBricks.push([Math.round(b[0] / 0.1125) * 0.1125, Math.round(b[1] / 0.075) * 0.075, Math.max(1, Math.round(b[2] / 0.45)) * 0.225, i % 3]); }
  const alarm = !tall && !o.plain && D.chance(0.7) ? { x: x + w - sideW - 0.78, y: base + fh + D.r(1.0, 1.7), col: S.tone(D.pick(['#d6a12a', '#2f6fb0', '#c0392b', '#e9e4d6']), P) } : null;
  const cable = !tall && !o.plain && floors > 2 && cols > 2 && D.chance(0.8) ? { f: D.i(2, floors - 1), c0: D.i(0, Math.max(0, cols - 3)), n: D.i(2, 3), sag: D.r(0.1, 0.22) } : null;
  const houseNo = String(D.i(2, 148)), doorOp = o.door !== undefined && !o.shop ? B.wins['0,' + o.door] : null;
  const doorCol = S.tone(o.doorCol || '#3b2c26', P), doorHi = S.tone(lighten(o.doorCol || '#3b2c26', 0.16), P), brass = S.tone('#c9a23a', P);
  const shopDark = S.tone('#2a2420', P), shopTrim = S.tone(lighten(wallBase, 0.18), P), acC = S.tone('#c9ced3', P), acD = S.tone('#8d9499', P), acK = S.tone('#5d6469', P);
  const spillOn = night && !tall;
  let WL = null; const winList = () => WL || (WL = Object.keys(B.wins).map((k) => B.wins[k]));
  // the brickwork that shows: bands between the rows of windows and the piers between windows
  // (painting it under the glass as well would cost a fifth more for nothing)
  let BP = null; const brickParts = () => {
    if (BP) return BP; BP = [];
    for (let f = 0; f < floors; f++) {
      const fy0 = B.floorY(f), fy1 = f === floors - 1 ? roofY + para : B.floorY(f + 1), row = winList().filter((op) => op.f === f).sort((a, b) => a.x - b.x);
      if (f === 0 && o.shop) { BP.push([x, fy1 - 0.3, w, 0.3]); continue; }
      if (!row.length) { BP.push([x, fy0, w, fy1 - fy0]); continue; }
      let y0 = 1e9, y1 = -1e9; row.forEach((op) => { y0 = Math.min(y0, op.y); y1 = Math.max(y1, op.y + op.h); });
      BP.push([x, fy0, w, y0 - fy0], [x, y1, w, fy1 - y1]);
      let px0 = x; row.forEach((op) => { BP.push([px0, y0, op.x - px0, y1 - y0]); if (op.y > y0) BP.push([op.x, y0, op.w, op.y - y0]); if (op.y + op.h < y1) BP.push([op.x, op.y + op.h, op.w, y1 - op.y - op.h]); px0 = op.x + op.w; });
      BP.push([px0, y0, x + w - px0, y1 - y0]);
    }
    BP = BP.filter((q) => q[2] > 0.01 && q[3] > 0.01);
    return BP;
  };

  // back layer: wall and what is inside the windows
  P.add({ x0: x, x1: x + w, layer: 0, draw(ctx, env) {
    const s = env.s, vx0 = Math.max(x, env.x0), vx1 = Math.min(x + w, env.x1), vw = vx1 - vx0, px = env.px;
    kxShadeFill(ctx, wall, tall ? 0.16 : 0.2, base, base + H, x, w, Math.max(base, env.y0 === undefined ? base : env.y0 - 1), Math.min(base + H, env.y1 === undefined ? base + H : env.y1 + 1));
    if (tall) {
      // glass tower: spandrel bands at each floor and a fine mullion between panes
      ctx.fillStyle = wall2; ctx.beginPath(); for (let f = 0; f <= floors; f++) ctx.rect(x, B.floorY(f) - 0.18, w, 0.36); ctx.fill();
      if (s > 6) { ctx.fillStyle = wallHi; ctx.beginPath(); for (let f = 1; f <= floors; f++) ctx.rect(vx0, B.floorY(f) + 0.14, vw, Math.max(0.03, px * 0.6)); for (let c = 0; c <= cols; c++) { const mx = pier(c); if (mx > vx0 - 1 && mx < vx1 + 1) ctx.rect(mx - 0.03, base, 0.06, floors * fh); } ctx.fill(); }
    } else {
      if (kStyle === 'brick') {
        kxBrickFill(ctx, env, x, base, w, H, 1, brickParts());
        if (s > 14) { // the odd brick that fired darker or paler than its neighbours
          for (let pass = 0; pass < 2; pass++) { ctx.fillStyle = pass ? wallHi : wall2; ctx.beginPath(); for (let i = 0; i < oddBricks.length; i++) { const b = oddBricks[i]; if ((b[3] === 0) !== !!pass || b[0] < vx0 - 1 || b[0] > vx1) continue; ctx.rect(b[0], b[1], b[2], 0.075); } ctx.fill(); }
        } else if (s > 6) { ctx.fillStyle = wall2; ctx.beginPath(); for (let i = 0; i < oddBricks.length; i += 2) { const b = oddBricks[i]; if (b[0] > vx0 - 1 && b[0] < vx1) ctx.rect(b[0], b[1], b[2] * 2, 0.09); } ctx.fill(); }
      } else {
        // cast concrete: panel seams, the marks left by the shuttering, bolt holes when close
        ctx.fillStyle = wall2; ctx.beginPath();
        const lw = Math.max(0.035, px * 0.7);
        for (let f = startF; f < floors; f++) { ctx.rect(vx0, B.floorY(f) + fh * 0.5 - lw / 2, vw, lw); }
        for (let c = 0; c <= cols; c++) { const mx = pier(c); if (mx > vx0 - 1 && mx < vx1 + 1) ctx.rect(mx - lw / 2, base, lw, H); }
        ctx.fill();
        if (s > 12) {
          ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.beginPath(); const b0 = Math.floor((env.y0 === undefined ? base : Math.max(base, env.y0)) / 0.4) * 0.4, b1 = Math.min(base + H, env.y1 === undefined ? base + H : env.y1);
          for (let yy = b0; yy < b1; yy += 0.8) ctx.rect(vx0, yy, vw, 0.4);
          ctx.fill();
          if (s > 30) { ctx.fillStyle = wallLo; ctx.beginPath(); for (let f = startF; f < floors; f++) for (let c = 0; c <= cols; c++) { const mx = pier(c); if (mx < vx0 - 1 || mx > vx1 + 1) continue; for (let k = 0; k < 2; k++) { const hy = B.floorY(f) + fh * (0.14 + k * 0.72); ctx.rect(mx + 0.18, hy, 0.05, 0.05); ctx.rect(mx - 0.23, hy, 0.05, 0.05); } } ctx.fill(); }
        }
      }
      // weathering that runs down from the coping
      if (s > 12 && copeStains.length) { ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.beginPath(); for (let i = 0; i < copeStains.length; i++) { const q = copeStains[i]; if (q[0] < vx0 - 1 || q[0] > vx1 + 1) continue; ctx.moveTo(q[0] - q[2], roofY + para - 0.2); ctx.lineTo(q[0] + q[2], roofY + para - 0.2); ctx.lineTo(q[0] + q[2] * 0.3, roofY + para - 0.2 - q[1]); ctx.lineTo(q[0] - q[2] * 0.4, roofY + para - 0.2 - q[1] * 0.8); ctx.closePath(); } ctx.fill(); }
      R4(ctx, x + w - sideW, base, sideW, H, 'rgba(0,0,0,0.14)');
      // string courses, each with a line of shadow under it
      ctx.fillStyle = wallHi; ctx.beginPath(); for (let f = 1; f < floors; f++) ctx.rect(x, B.floorY(f) - 0.08, w, 0.14); ctx.fill();
      if (s > 6) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); for (let f = 1; f < floors; f++) ctx.rect(vx0, B.floorY(f) - 0.08 - Math.max(0.035, px * 0.7), vw, Math.max(0.035, px * 0.7)); ctx.fill(); }
      // plinth
      if (!o.shop) { R4(ctx, x, base, w, 0.52, wallLo); R4(ctx, x, base + 0.52, w, Math.max(0.05, px * 0.8), stoneSh); }
      // cornice with dentils and the shade under it, then the parapet coping
      R4(ctx, x - 0.1, roofY - 0.14, w + 0.2, 0.3, trim);
      if (s > 5) {
        kxFadeAt(ctx, '#000000', vx0, roofY - 0.14, vw, -0.9, 0.24);
        R4(ctx, x - 0.1, roofY - 0.14, w + 0.2, Math.max(0.04, px * 0.7), stoneSh);
        if (s > 13) { ctx.fillStyle = trim; ctx.beginPath(); const d0 = x + Math.max(0, Math.floor((vx0 - x) / 0.36)) * 0.36; for (let dx = d0; dx < vx1; dx += 0.36) ctx.rect(dx + 0.06, roofY - 0.3, 0.2, 0.16); ctx.fill(); }
      }
      ctx.fillStyle = trim; ctx.fillRect(x - 0.15, roofY + para - 0.22, w + 0.3, 0.3);
      if (s > 5) R4(ctx, x - 0.15, roofY + para - 0.22, w + 0.3, Math.max(0.04, px * 0.7), stoneSh);
      if (quoin && s > 12) { // dressed stones up both corners
        ctx.fillStyle = stoneSh; ctx.beginPath();
        const q0 = env.y0 === undefined ? 0 : Math.max(0, Math.floor((env.y0 - base) / 0.6)), q1 = Math.min(Math.floor((floors * fh) / 0.6), env.y1 === undefined ? 999 : Math.ceil((env.y1 - base) / 0.6));
        for (let i = q0; i < q1; i++) { const ww = i % 2 ? 0.34 : 0.55, yy = base + i * 0.6 + 0.04; if (x + 0.6 > vx0) ctx.rect(x, yy, ww, 0.5); if (x + w - 1.6 < vx1) ctx.rect(x + w - sideW - ww, yy, ww, 0.5); }
        ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
      }
      // downpipes with their brackets and a hopper at the top
      for (let i = 0; i < pipes.length; i++) {
        const px0 = pipes[i]; if (px0 < vx0 - 1 || px0 > vx1 + 1) continue;
        const pw = Math.max(0.12, px * 1.1);
        R4(ctx, px0 - pw / 2, base, pw, floors * fh - 0.3, pipeC);
        if (s > 14) {
          R4(ctx, px0 - pw / 2, base, pw * 0.3, floors * fh - 0.3, pipeHi);
          ctx.fillStyle = pipeC; ctx.beginPath(); for (let f = 0; f < floors; f++) ctx.rect(px0 - 0.11, B.floorY(f) + fh * 0.5, 0.22, 0.07); ctx.rect(px0 - 0.19, roofY - 0.52, 0.38, 0.26); ctx.rect(px0 - 0.02, base, 0.26, 0.12); ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fillRect(px0 + pw / 2, base, 0.06, floors * fh - 0.3);
        }
      }
      if (s > 14) {
        // vents, the alarm box, a run of cable
        for (let i = 0; i < vents.length; i++) {
          const v = vents[i]; if (v[0] < vx0 - 1 || v[0] > vx1 + 1) continue;
          R4(ctx, v[0], v[1], 0.34, 0.26, stoneSh); R4(ctx, v[0] + 0.03, v[1] + 0.03, 0.28, 0.2, wallLo);
          if (s > 26) { ctx.fillStyle = stoneSh; for (let k = 0; k < 3; k++) ctx.fillRect(v[0] + 0.03, v[1] + 0.06 + k * 0.06, 0.28, 0.02); }
          if (v[2]) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(v[0] + 0.08, v[1] - 0.7, 0.14, 0.7); }
        }
        if (alarm && alarm.x > vx0 - 1 && alarm.x < vx1 + 1) {
          R4(ctx, alarm.x, alarm.y, 0.36, 0.3, alarm.col); R4(ctx, alarm.x, alarm.y, 0.36, 0.05, 'rgba(0,0,0,0.25)');
          if (s > 24) { R4(ctx, alarm.x + 0.06, alarm.y + 0.11, 0.24, 0.05, 'rgba(0,0,0,0.3)'); if (Math.sin(env.t * 2.2 + x) > 0.86) { circ(ctx, alarm.x + 0.29, alarm.y + 0.23, 0.028, '#ff4a3d'); if (night) kxGlow(ctx, '#ff4a3d', alarm.x + 0.29, alarm.y + 0.23, 0.22, 0.6); } }
        }
        if (cable) {
          ctx.strokeStyle = pipeC; ctx.lineWidth = Math.max(0.025, px * 0.6); ctx.beginPath();
          const cy = B.floorY(cable.f) - 0.28;
          for (let k = 0; k < cable.n; k++) { const xa = pier(cable.c0 + k), xb = pier(cable.c0 + k + 1); if (xb < vx0 || xa > vx1) continue; ctx.moveTo(xa, cy); ctx.quadraticCurveTo((xa + xb) / 2, cy - cable.sag * 2, xb, cy); }
          const xe = pier(cable.c0); if (xe > vx0 - 1 && xe < vx1 + 1) { ctx.moveTo(xe, cy); ctx.lineTo(xe, cy + 0.7); }
          ctx.stroke();
          if (s > 24) { ctx.fillStyle = pipeC; ctx.beginPath(); for (let k = 0; k <= cable.n; k++) ctx.rect(pier(cable.c0 + k) - 0.04, cy - 0.03, 0.08, 0.07); ctx.fill(); }
        }
      }
    }
    // the doorway behind a glazed front door, so the window drawn next becomes its glass
    if (doorOp && doorOp.x < vx1 + 1 && doorOp.x + doorOp.w > vx0 - 1) {
      const d = doorOp, top = d.y + d.h;
      R4(ctx, d.x - 0.2, base, d.w + 0.4, top - base + 0.22, trim); R4(ctx, d.x - 0.34, top + 0.16, d.w + 0.68, 0.16, trim);
      if (s > 8) { R4(ctx, d.x - 0.34, top + 0.16 - Math.max(0.03, px * 0.6), d.w + 0.68, Math.max(0.03, px * 0.6), stoneSh); R4(ctx, d.x - 0.04, base, d.w + 0.08, top - base + 0.05, wallLo); }
    }
    // light from lit windows falling on the wall round them, then the windows themselves
    if (spillOn && s > 2.2) {
      let any = false; const spillSp = kxSpill('#ffd98a'), m = kxM(ctx), stamp = !m.b && !m.c && m.d < 0;
      for (const key in B.wins) {
        const op = B.wins[key]; if (op.x + op.w < vx0 - 2 || op.x > vx1 + 2) continue;
        if (env.y0 !== undefined && (op.y > env.y1 + 2 || op.y + op.h < env.y0 - 2)) continue;
        const room = S.rooms[op.room]; if (!room || !room.lit) continue;
        if (!any) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3 * dark; any = true; if (stamp) ctx.setTransform(1, 0, 0, 1, 0, 0); }
        // one warm colour for all; the glow is made once for this window size and zoom, then
        // stamped on whole pixels, which is several times cheaper than stretching it each time
        if (stamp) { const r = kxRing(spillSp, op.w * m.a, -op.h * m.d); ctx.drawImage(r, Math.round(m.a * op.x + m.e - r.ex), Math.round(m.d * (op.y + op.h) + m.f - r.ey)); }
        else kxSpillAt(ctx, spillSp, op.x, op.y, op.w, op.h, 1, true);
      }
      if (any && stamp) ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
      if (o.shop && S.rooms[B.shop.room].lit && B.shop.x < vx1 + 2 && B.shop.x + B.shop.w > vx0 - 2) { if (!any) { ctx.globalCompositeOperation = 'lighter'; any = true; } ctx.globalAlpha = 0.3 * dark; kxSpillAt(ctx, kxSpill('#ffe7b3'), B.shop.x, B.shop.y, B.shop.w, B.shop.h, 1.6); }
      if (any) { ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    // lintels over the windows and a stain under each sill
    if (!tall && s > 3.2) {
      const y0v = env.y0 === undefined ? -1e9 : env.y0 - 3, y1v = env.y1 === undefined ? 1e9 : env.y1 + 3;
      if (lintel === 'arch' && s > 7) {
        ctx.fillStyle = stone; ctx.beginPath();
        for (const key in B.wins) { const op = B.wins[key]; if (op.door || op.x + op.w < vx0 || op.x > vx1 || op.y > y1v || op.y < y0v) continue; const t = op.y + op.h; ctx.moveTo(op.x - 0.16, t); ctx.lineTo(op.x - 0.16, t + 0.12); ctx.quadraticCurveTo(op.x + op.w / 2, t + 0.46, op.x + op.w + 0.16, t + 0.12); ctx.lineTo(op.x + op.w + 0.16, t); ctx.closePath(); }
        ctx.fill();
        if (s > 22) { ctx.fillStyle = stoneSh; ctx.beginPath(); for (const key in B.wins) { const op = B.wins[key]; if (op.door || op.x + op.w < vx0 || op.x > vx1 || op.y > y1v || op.y < y0v) continue; ctx.rect(op.x + op.w / 2 - 0.09, op.y + op.h, 0.18, 0.3); } ctx.fill(); }
      } else {
        ctx.fillStyle = lintel === 'brick' ? wallLo : stone; ctx.beginPath();
        for (const key in B.wins) { const op = B.wins[key]; if (op.door || op.x + op.w < vx0 || op.x > vx1 || op.y > y1v || op.y < y0v) continue; ctx.rect(op.x - 0.15, op.y + op.h, op.w + 0.3, 0.22); }
        ctx.fill();
        if (lintel === 'brick' && s > 26) { ctx.fillStyle = wall; ctx.beginPath(); for (const key in B.wins) { const op = B.wins[key]; if (op.door || op.x + op.w < vx0 || op.x > vx1 || op.y > y1v || op.y < y0v) continue; for (let bx = op.x - 0.15 + 0.11; bx < op.x + op.w + 0.14; bx += 0.115) ctx.rect(bx, op.y + op.h + 0.01, 0.018, 0.2); } ctx.fill(); }
      }
      if (s > 14) { // shadow under the lintel and streaks below the sill
        ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.beginPath();
        for (const key in B.wins) {
          const op = B.wins[key]; if (op.door || op.x + op.w < vx0 || op.x > vx1 || op.y > y1v || op.y < y0v) continue;
          const k = kxH(op.x * 1.7, op.y * 0.9);
          ctx.rect(op.x + 0.06 + k * 0.2, op.y - 0.14 - 0.5 - k * 0.5, 0.09, 0.5 + k * 0.5); ctx.rect(op.x + op.w - 0.22 - k * 0.25, op.y - 0.14 - 0.35 - (1 - k) * 0.5, 0.11, 0.35 + (1 - k) * 0.5);
          if (k > 0.5) ctx.rect(op.x + op.w * 0.5, op.y - 0.14 - 0.3, 0.07, 0.3);
        }
        ctx.fill();
      }
    }
        if (s <= 3.5) kxWinsBackFar(ctx, env, S, P, winList(), inRoom);
    else for (const key in B.wins) {
      const op = B.wins[key]; if (op.x + op.w < env.x0 || op.x > env.x1) continue;
      drawWindowBack(ctx, env, S, P, op, glass, inRoom);
    }
    if (o.shop) {
      const sh = B.shop, sLit = S.rooms[sh.room].lit;
      // the shop front: a dark surround, pilasters either side, a panelled riser under the glass
      R4(ctx, x, base, w, fh - 0.3, wall2);
      if (s > 5) {
        R4(ctx, x, base, 0.42, fh - 0.3, shopTrim); R4(ctx, x + w - 0.42 - (o.shop.door ? 0 : 0), base, 0.42, fh - 0.3, shopTrim);
        R4(ctx, x + 0.42, base, w - 0.84, 0.5, shopDark); R4(ctx, x + 0.42, base + 0.44, w - 0.84, 0.06, shopTrim);
        if (s > 14) { ctx.fillStyle = wall2; ctx.beginPath(); for (let px0 = x + 0.8; px0 < sh.x + sh.w - 0.5; px0 += 1.5) if (px0 > vx0 - 2 && px0 < vx1) ctx.rect(px0, base + 0.09, 1.2, 0.27); ctx.rect(x + 0.08, base + 0.3, 0.26, fh - 1.0); ctx.rect(x + w - 0.34, base + 0.3, 0.26, fh - 1.0); ctx.fill(); }
        R4(ctx, x, base, w, 0.1, stoneSh);
      }
      drawWindowBack(ctx, env, S, P, sh, glass, inRoom);
      if (o.shop.door) {
        const dx = x + w - 2.1;
        R4(ctx, dx, base, 1.5, 2.4, shopDark);
        if (s > 5) {
          R4(ctx, dx + 0.13, base + 0.12, 1.24, 2.16, doorCol);
          R4(ctx, dx + 0.26, base + 0.95, 0.98, 1.2, sLit ? S.tone('#ffe7b3', P, true) : glass);
          if (s > 14) {
            R4(ctx, dx + 0.26, base + 0.25, 0.98, 0.5, doorHi); R4(ctx, dx + 0.26, base + 0.95, 0.98, Math.max(0.03, px * 0.6), 'rgba(0,0,0,0.3)');
            R4(ctx, dx + 0.2, base + 1.18, 0.07, 0.42, brass);
            if (sLit) { R4(ctx, dx + 0.52, base + 1.62, 0.46, 0.22, S.tone('#f6f1e4', P, true)); env.text(ctx, 'OPEN', dx + 0.75, base + 1.66, 0.15, S.tone('#b3312b', P, true), 'center'); }
            R4(ctx, dx + 0.26, base + 0.95, 0.3, 1.2, 'rgba(255,255,255,0.07)');
          }
          R4(ctx, dx - 0.12, base, 1.74, 0.1, stone);
        } else R4(ctx, dx + 0.15, base + 1.2, 1.2, 1.0, glass);
      }
    }
    if (o.door !== undefined && !o.shop) {
      const cx = B.winX(o.door);
      if (doorOp) {
        // the lower half of a pair of glazed doors; the window above the rail is their glass
        const d = doorOp, lh = d.y - base;
        if (d.x < vx1 + 1 && d.x + d.w > vx0 - 1) {
          R4(ctx, d.x, base, d.w, lh, doorCol);
          if (s > 9) {
            ctx.fillStyle = doorHi; ctx.beginPath(); ctx.rect(d.x + 0.1, base + 0.2, d.w / 2 - 0.17, lh - 0.36); ctx.rect(d.x + d.w / 2 + 0.07, base + 0.2, d.w / 2 - 0.17, lh - 0.36); ctx.fill();
            R4(ctx, d.x + d.w / 2 - 0.015, base, 0.03, lh, 'rgba(0,0,0,0.45)'); R4(ctx, d.x, base, d.w, 0.14, brass);
            if (s > 22) { R4(ctx, d.x + d.w / 2 - 0.13, d.y - 0.1, 0.07, 0.2, brass); R4(ctx, d.x + d.w / 2 + 0.06, d.y - 0.1, 0.07, 0.2, brass); R4(ctx, d.x + 0.14, base + 0.24, d.w / 2 - 0.25, lh - 0.44, doorCol); R4(ctx, d.x + d.w / 2 + 0.11, base + 0.24, d.w / 2 - 0.25, lh - 0.44, doorCol); }
          }
          R4(ctx, d.x - 0.34, base, d.w + 0.68, 0.12, stone); if (s > 9) R4(ctx, d.x - 0.34, base + 0.12 - Math.max(0.025, px * 0.5), d.w + 0.68, Math.max(0.025, px * 0.5), stoneSh);
        }
      } else {
        const dx = cx - 0.65;
        R4(ctx, dx - 0.15, base, 1.6, 2.55, trim); R4(ctx, dx, base, 1.3, 2.4, doorCol);
        if (s > 9) { ctx.fillStyle = doorHi; ctx.beginPath(); ctx.rect(dx + 0.14, base + 0.22, 0.44, 0.8); ctx.rect(dx + 0.72, base + 0.22, 0.44, 0.8); ctx.rect(dx + 0.14, base + 1.2, 0.44, 1.0); ctx.rect(dx + 0.72, base + 1.2, 0.44, 1.0); ctx.fill(); R4(ctx, dx + 1.1, base + 1.08, 0.08, 0.08, brass); R4(ctx, dx + 0.45, base + 1.06, 0.4, 0.06, brass); R4(ctx, dx - 0.3, base, 1.9, 0.12, stone); }
      }
      // the number, and a small light over the door
      const top = doorOp ? doorOp.y + doorOp.h : base + 2.55, side = doorOp ? doorOp.x + doorOp.w + 0.34 : cx + 0.95;
      if (s > 16 && side > vx0 - 1 && side < vx1 + 1) { R4(ctx, side, base + 1.6, 0.42, 0.3, S.tone('#1c2733', P)); env.text(ctx, houseNo, side + 0.21, base + 1.67, 0.2, S.tone('#f1ede2', P, true), 'center'); }
      if (s > 5 && cx > vx0 - 2 && cx < vx1 + 2) {
        R4(ctx, cx - 0.13, top + 0.42, 0.26, 0.08, pipeC); poly(ctx, [cx - 0.11, top + 0.42, cx + 0.11, top + 0.42, cx + 0.07, top + 0.28, cx - 0.07, top + 0.28], night ? '#ffe9b0' : S.tone('#e8e4d0', P));
        if (night) { kxGlow(ctx, '#ffdc96', cx, top + 0.3, 1.5, 0.3 * dark); if (s > 9) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.16 * dark; ctx.drawImage(kxCone('#ffdc96'), cx - 1.5, base, 3, top + 0.3 - base); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
      }
    }
  } });
  // front layer: glass sheen, frames, signs
  P.add({ x0: x - 1, x1: x + w + 1, layer: 1, draw(ctx, env) {
    const s = env.s, vx0 = env.x0, vx1 = env.x1, px = env.px;
    kxWinsFront(ctx, env, S, P, winList(), frame, tall);
    if (o.shop) {
      const sh = B.shop, aw = S.tone(o.shop.awning || '#b33a3a', P), aw2 = S.tone('#efe9da', P), y1 = base + fh - 0.3, y0 = base + fh - 1.1;
      drawWindowFront(ctx, env, S, P, sh, frame, true);
      if (s > 5) { // glazing bars that split the shop window into panes, and the shade the awning throws on it
        const np = Math.max(2, Math.round(sh.w / 2.4)); ctx.fillStyle = frame; ctx.beginPath(); for (let i = 1; i < np; i++) ctx.rect(sh.x + (i * sh.w) / np - 0.035, sh.y, 0.07, sh.h); ctx.fill();
        kxFadeAt(ctx, '#000000', Math.max(x, vx0), y0 + 0.02, Math.min(x + w, vx1) - Math.max(x, vx0), -0.75, 0.34);
      }
      const n = Math.max(4, Math.floor(w / 1.2));
      // the sloping cloth in stripes, wider at the front edge than at the wall
      for (let pass = 0; pass < 2; pass++) {
        ctx.fillStyle = pass ? aw2 : aw; ctx.beginPath();
        for (let i = pass; i < n; i += 2) { const xa = x + (i * w) / n, xb = x + ((i + 1) * w) / n, ua = i / n, ub = (i + 1) / n; if (xb < vx0 - 1 || xa > vx1 + 1) continue; ctx.moveTo(xa + 0.12 - ua * 0.24, y1); ctx.lineTo(xb + 0.12 - ub * 0.24, y1); ctx.lineTo(xb - 0.22 + ub * 0.44, y0); ctx.lineTo(xa - 0.22 + ua * 0.44, y0); ctx.closePath(); }
        ctx.fill();
      }
      if (s > 5) {
        // light along the top fold, shade along the front, then the scalloped edge hanging below
        ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(x + 0.12, y1 - 0.07, w - 0.24, 0.07);
        kxFadeAt(ctx, '#000000', x - 0.22, y0, w + 0.44, 0.42, 0.26);
        const sc = w / n / 2, sd = 0.17;
        for (let pass = 0; pass < 2; pass++) {
          ctx.fillStyle = pass ? aw2 : aw; ctx.beginPath();
          for (let i = pass; i < n; i += 2) for (let hlf = 0; hlf < 2; hlf++) { const xa = x - 0.22 + ((i + hlf * 0.5) / n) * (w + 0.44), ww = (w + 0.44) / n / 2; if (xa + ww < vx0 || xa > vx1) continue; ctx.moveTo(xa, y0 + 0.01); ctx.lineTo(xa + ww, y0 + 0.01); ctx.lineTo(xa + ww, y0 - sd * 0.45); ctx.quadraticCurveTo(xa + ww / 2, y0 - sd * 1.35, xa, y0 - sd * 0.45); ctx.closePath(); }
          ctx.fill();
        }
        R4(ctx, x - 0.22, y0 - Math.max(0.025, px * 0.5), w + 0.44, Math.max(0.025, px * 0.5), 'rgba(0,0,0,0.28)');
        if (s > 12) { ctx.strokeStyle = pipeC; ctx.lineWidth = Math.max(0.03, px * 0.6); ctx.beginPath(); ctx.moveTo(x + 0.2, y0 - 0.5); ctx.lineTo(x - 0.18, y0 + 0.02); ctx.moveTo(x + w - 0.2, y0 - 0.5); ctx.lineTo(x + w + 0.18, y0 + 0.02); ctx.stroke(); }
      }
      if (o.shop.sign) {
        // the fascia: a framed board, lettering, and lamps over it after dark
        const bx = x + w * 0.15, bw = w * 0.7, by = base + fh - 0.25;
        R4(ctx, bx, by, bw, 0.75, S.tone('#1c1f26', P));
        if (s > 8) {
          ctx.strokeStyle = S.tone(o.shop.signCol || '#f3e9c9', P); ctx.globalAlpha = 0.5; ctx.lineWidth = Math.max(0.025, px * 0.6); ctx.strokeRect(bx + 0.07, by + 0.07, bw - 0.14, 0.61); ctx.globalAlpha = 1;
          R4(ctx, bx - 0.06, by - 0.04, bw + 0.12, 0.06, pipeC); R4(ctx, bx - 0.06, by + 0.73, bw + 0.12, 0.07, pipeC);
        }
        if (night && s > 4) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.2 * dark; const sp = kxSpill('#ffe2a8'); kxSpillAt(ctx, sp, bx + 0.3, by + 0.25, bw - 0.6, 0.3, 0.8); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
        env.text(ctx, o.shop.sign, x + w / 2, base + fh + 0.02, 0.5, S.tone(o.shop.signCol || '#f3e9c9', P, true), 'center');
        if (s > 12) { ctx.strokeStyle = pipeC; ctx.lineWidth = Math.max(0.03, px * 0.6); ctx.beginPath(); for (let i = 0; i < 3; i++) { const lx = bx + bw * (0.2 + i * 0.3); ctx.moveTo(lx, by + 0.8); ctx.quadraticCurveTo(lx, by + 1.08, lx + 0.2, by + 1.0); } ctx.stroke(); for (let i = 0; i < 3; i++) { const lx = bx + bw * (0.2 + i * 0.3) + 0.2; poly(ctx, [lx - 0.09, by + 1.03, lx + 0.09, by + 1.0, lx + 0.05, by + 0.9, lx - 0.08, by + 0.94], night ? '#ffe9b0' : pipeC); } }
      }
    }
    // air conditioners: grille, side brackets and the stain where they drip
    for (let i = 0; i < acs.length; i++) {
      const op = acs[i]; if (op.x < vx0 - 2 || op.x > vx1) continue;
      const ax = op.x + 0.2, ay = op.y - 0.55;
      if (s > 14) { ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fillRect(ax + 0.3, ay - 0.9, 0.12, 0.9); ctx.fillRect(ax + 0.52, ay - 0.5, 0.07, 0.5); ctx.strokeStyle = acK; ctx.lineWidth = Math.max(0.03, px * 0.6); ctx.beginPath(); ctx.moveTo(ax + 0.08, ay); ctx.lineTo(ax + 0.08, ay - 0.2); ctx.lineTo(ax + 0.3, ay); ctx.moveTo(ax + 0.82, ay); ctx.lineTo(ax + 0.82, ay - 0.2); ctx.lineTo(ax + 0.6, ay); ctx.stroke(); }
      R4(ctx, ax, ay, 0.9, 0.5, acC); R4(ctx, ax + 0.08, ay + 0.08, 0.74, 0.12, acD);
      if (s > 14) {
        R4(ctx, ax, ay + 0.44, 0.9, 0.06, 'rgba(255,255,255,0.3)'); R4(ctx, ax + 0.78, ay, 0.12, 0.5, acD); R4(ctx, ax, ay, 0.9, 0.04, acK);
        if (s > 20) { ctx.fillStyle = acK; ctx.beginPath(); for (let k = 0; k < 5; k++) ctx.rect(ax + 0.08, ay + 0.24 + k * 0.04, 0.64, 0.016); ctx.rect(ax + 0.08, ay + 0.08, 0.74, 0.02); ctx.rect(ax + 0.08, ay + 0.13, 0.74, 0.02); ctx.fill(); }
      }
    }
  } });
  // rooftop clutter
  if (o.tank) K.watertank(S, P, x + w * (o.tank === true ? 0.7 : o.tank), roofY + para);
  if (o.hut) {
    const hx = x + w * (o.hut === true ? 0.2 : o.hut), hy = roofY + para - 0.1;
    P.add({ x0: hx - 0.3, x1: hx + 3.3, layer: 0, draw(ctx, env) {
      const s = env.s;
      R4(ctx, hx, hy, 3, 2.5, wall2);
      if (s > 6) { if (kStyle === 'brick') kxBrickFill(ctx, env, hx, hy, 3, 2.5, 0.8); R4(ctx, hx + 2.7, hy, 0.3, 2.5, 'rgba(0,0,0,0.16)'); }
      R4(ctx, hx - 0.15, hy + 2.4, 3.3, 0.18, trim); if (s > 6) R4(ctx, hx - 0.15, hy + 2.4, 3.3, Math.max(0.03, env.px * 0.6), stoneSh);
      R4(ctx, hx + 0.82, hy, 1.26, 2.12, stoneSh); R4(ctx, hx + 0.9, hy, 1.1, 2.0, S.tone('#2a2f38', P));
      if (s > 10) {
        ctx.fillStyle = S.tone('#3a414c', P); ctx.beginPath(); ctx.rect(hx + 1.0, hy + 0.18, 0.9, 0.72); ctx.rect(hx + 1.0, hy + 1.06, 0.9, 0.78); ctx.fill(); R4(ctx, hx + 1.82, hy + 0.95, 0.07, 0.14, brass);
        R4(ctx, hx + 2.3, hy + 1.5, 0.3, 0.2, pipeC); poly(ctx, [hx + 2.32, hy + 1.5, hx + 2.58, hy + 1.5, hx + 2.54, hy + 1.38, hx + 2.36, hy + 1.38], night ? '#ffe9b0' : S.tone('#d8d4c4', P));
        if (night) kxGlow(ctx, '#ffdc96', hx + 2.45, hy + 1.42, 1.1, 0.26 * dark);
        ctx.strokeStyle = pipeC; ctx.lineWidth = Math.max(0.05, env.px * 0.7); ctx.beginPath(); ctx.moveTo(hx + 0.35, hy + 2.58); ctx.lineTo(hx + 0.35, hy + 3.1); ctx.stroke(); R4(ctx, hx + 0.22, hy + 3.1, 0.26, 0.1, pipeC);
      }
    } });
    P.solid(hx, roofY + para, 3, 2.4, 'wall');
  }
  if (o.antenna) {
    const ax = x + w * (o.antenna === true ? 0.85 : o.antenna), ay = roofY + para, ac = S.tone('#30343c', P);
    P.add({ x0: ax - 2.6, x1: ax + 2.6, layer: 1, draw(ctx, env) {
      const s = env.s;
      line(ctx, ax, ay, ax, ay + 6, ac, 0.08, env); line(ctx, ax - 0.8, ay + 4.6, ax + 0.8, ay + 4.6, ac, 0.06, env); line(ctx, ax - 0.5, ay + 5.4, ax + 0.5, ay + 5.4, ac, 0.06, env);
      if (s > 7) {
        ctx.strokeStyle = ac; ctx.lineWidth = Math.max(0.035, env.px * 0.6); ctx.beginPath();
        for (let k = 0; k < 5; k++) { ctx.moveTo(ax - 0.8 + k * 0.4, ay + 4.4); ctx.lineTo(ax - 0.8 + k * 0.4, ay + 4.8); }
        ctx.moveTo(ax - 0.5, ay + 5.25); ctx.lineTo(ax - 0.5, ay + 5.55); ctx.moveTo(ax + 0.5, ay + 5.25); ctx.lineTo(ax + 0.5, ay + 5.55); ctx.moveTo(ax - 0.3, ay + 6); ctx.lineTo(ax + 0.3, ay + 6);
        ctx.stroke();
        ctx.lineWidth = Math.max(0.018, env.px * 0.45); ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(ax, ay + 3.6); ctx.lineTo(ax - 2.3, ay + 0.02); ctx.moveTo(ax, ay + 3.6); ctx.lineTo(ax + 2.3, ay + 0.02); ctx.stroke(); ctx.globalAlpha = 1;
        R4(ctx, ax - 0.14, ay, 0.28, 0.16, ac);
      }
    } });
  }
  // small things on the roof: vent pipes, a cowl, a skylight, perhaps a dish. All behind anyone up there.
  if (!tall && o.roofDeco !== false && o.roofAccess !== false) {
    const taken = []; if (o.tank) taken.push(x + w * (o.tank === true ? 0.7 : o.tank)); if (o.hut) taken.push(x + w * (o.hut === true ? 0.2 : o.hut) + 1.5); if (o.antenna) taken.push(x + w * (o.antenna === true ? 0.85 : o.antenna));
    const bits = [], free = (rx) => taken.every((t) => Math.abs(t - rx) > 2.6);
    for (let i = 0; i < Math.max(2, Math.round(w / 5)); i++) { const rx = x + D.r(1.2, w - 1.4); if (!free(rx)) continue; taken.push(rx - 1.4); bits.push([rx, D.i(0, 2), D.r(0.7, 1.3)]); }
    if (o.dish) { const rx = x + w * (o.dish === true ? 0.5 : o.dish); bits.push([rx, 3, 1]); }
    const ry = roofY + para, vc = S.tone('#3a3f48', P), vc2 = S.tone('#565c66', P), dishC = S.tone('#9aa1a8', P), dishD = S.tone('#6c737a', P);
    if (bits.length) P.add({ x0: x, x1: x + w, layer: 0, draw(ctx, env) {
      if (env.s < 4) return;
      for (let i = 0; i < bits.length; i++) {
        const b = bits[i], bx = b[0]; if (bx < env.x0 - 2 || bx > env.x1 + 2) continue;
        if (b[1] === 0) { R4(ctx, bx - 0.07, ry - 0.1, 0.14, 0.75 * b[2], vc); poly(ctx, [bx - 0.2, ry - 0.1 + 0.75 * b[2], bx + 0.2, ry - 0.1 + 0.75 * b[2], bx, ry + 0.75 * b[2] + 0.08], vc); }
        else if (b[1] === 1) { R4(ctx, bx - 0.12, ry - 0.1, 0.24, 0.5, vc); ctx.fillStyle = vc2; ctx.beginPath(); ctx.ellipse(bx, ry + 0.42, 0.34, 0.16, 0, 0, TAU); ctx.fill(); if (env.s > 18) { ctx.fillStyle = vc; ctx.fillRect(bx - 0.3, ry + 0.38, 0.6, 0.03); } }
        else if (b[1] === 2) { R4(ctx, bx - 0.6, ry - 0.1, 1.2, 0.4, vc); poly(ctx, [bx - 0.6, ry + 0.3, bx + 0.6, ry + 0.3, bx + 0.45, ry + 0.56, bx - 0.45, ry + 0.56], S.tone(S.pal.glass, P)); if (env.s > 14) { ctx.fillStyle = vc2; ctx.fillRect(bx - 0.02, ry + 0.3, 0.04, 0.26); ctx.fillRect(bx - 0.6, ry + 0.28, 1.2, 0.04); } }
        else { line(ctx, bx, ry - 0.1, bx, ry + 0.5, vc, 0.06, env); ctx.fillStyle = dishC; ctx.beginPath(); ctx.ellipse(bx + 0.06, ry + 0.62, 0.16, 0.36, -0.5, 0, TAU); ctx.fill(); if (env.s > 12) { ctx.fillStyle = dishD; ctx.beginPath(); ctx.ellipse(bx + 0.1, ry + 0.6, 0.09, 0.27, -0.5, 0, TAU); ctx.fill(); line(ctx, bx + 0.08, ry + 0.6, bx + 0.42, ry + 0.82, vc, 0.03, env); } }
      }
    } });
  }
  return B;
};
// How colourful a wall colour is, 0 (grey) to 1.
function kxSat(hex) { const q = rgbOf(hex), mx = Math.max(q[0], q[1], q[2]), mn = Math.min(q[0], q[1], q[2]); return mx ? (mx - mn) / mx : 0; }

// Colours and fixed choices for one window, worked out the first time it is drawn.
function kxOp(S, P, op) {
  let k = op._kx; if (k && k.S === S) return k;
  const tint = op.tint || '#ffd98a', h = kxH(op.x * 3.71 + op.y * 9.13, (op.f || 0) + 2.5);
  k = op._kx = { S, h, h2: kxH(h * 977.1, 3), h3: kxH(h * 131.7, 7), tint,
    lit: S.tone(tint, P, true), back: S.tone(darken(tint, 0.07), P, true), mid: S.tone(darken(tint, 0.2), P, true), fur: S.tone(darken(tint, 0.34), P, true), fur2: S.tone(darken(tint, 0.5), P, true),
    hi: S.tone(lighten(tint, 0.45), P, true) };
  return k;
}
// What a lit room shows through its window: the back wall, then furniture as soft
// silhouettes a little darker than the wall, and the lamp a little brighter. Nothing in
// here is as dark as a person, so somebody standing in the room still stands out.
function drawWindowBack(ctx, env, S, P, op, glass, inRoom) {
  const room = S.rooms[op.room], lit = room && room.lit, x = op.x, y = op.y, w = op.w, h = op.h, s = env.s;
  if (!lit) { R4(ctx, x, y, w, h, env.nv ? mix(inRoom, '#2c5a3a', 0.5) : inRoom); return; }
  const k = kxOp(S, P, op);
  if (s <= 3.5 || (env.y0 !== undefined && (y > env.y1 || y + h < env.y0))) { R4(ctx, x, y, w, h, k.lit); return; }
  R4(ctx, x, y, w, h, k.back);
  const d = op.deco, hi = s > 15, fine = s > 32;
  if (d === 9) { kxShopInside(ctx, env, S, P, op, k); return; }
  if (d === undefined || d < 0 || d > 5) return;
  if (hi) { R4(ctx, x, y + h * 0.84, w, Math.max(0.03, env.px * 0.6), k.mid); if (k.h2 > 0.4) R4(ctx, x, y, w, h * 0.1, k.mid); }   // picture rail, skirting
  ctx.fillStyle = k.fur;
  if (d === 0) { // a wardrobe, and a small picture
    ctx.fillRect(x + w * 0.6, y, w * 0.32, h * 0.72);
    if (hi) { R4(ctx, x + w * 0.58, y + h * 0.72, w * 0.36, h * 0.035, k.fur2); R4(ctx, x + w * 0.755, y + h * 0.04, Math.max(0.02, env.px * 0.5), h * 0.66, k.fur2); R4(ctx, x + w * 0.12, y + h * 0.5, w * 0.24, h * 0.2, k.fur); R4(ctx, x + w * 0.15, y + h * 0.53, w * 0.18, h * 0.14, k.hi); }
    if (fine) { R4(ctx, x + w * 0.725, y + h * 0.34, w * 0.016, h * 0.05, k.hi); R4(ctx, x + w * 0.78, y + h * 0.34, w * 0.016, h * 0.05, k.hi); R4(ctx, x + w * 0.64, y + h * 0.75, w * 0.12, h * 0.07, k.mid); }
  } else if (d === 1) { // pictures on the wall
    ctx.fillRect(x + w * 0.12, y + h * 0.55, w * 0.32, h * 0.28);
    if (hi) { R4(ctx, x + w * 0.155, y + h * 0.585, w * 0.25, h * 0.21, k.hi); R4(ctx, x + w * 0.19, y + h * 0.6, w * 0.18, h * 0.1, k.mid); R4(ctx, x + w * 0.6, y + h * 0.5, w * 0.2, h * 0.24, k.fur); R4(ctx, x + w * 0.625, y + h * 0.53, w * 0.15, h * 0.18, k.back); }
    if (fine) { poly(ctx, [x + w * 0.19, y + h * 0.6, x + w * 0.27, y + h * 0.7, x + w * 0.3, y + h * 0.65, x + w * 0.37, y + h * 0.6], k.fur); R4(ctx, x + w * 0.56, y, w * 0.34, h * 0.13, k.fur); R4(ctx, x + w * 0.56, y + h * 0.13, w * 0.34, h * 0.02, k.fur2); }
  } else if (d === 2) { // a standard lamp, lit
    const lx = x + w * 0.7;
    ctx.fillRect(lx - 0.035, y, 0.07, h * 0.6);
    if (hi) { ctx.globalAlpha = 0.5; ctx.fillStyle = k.hi; ctx.beginPath(); ctx.ellipse(lx, y + h * 0.72, w * 0.3, h * 0.26, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    poly(ctx, [lx - 0.25, y + h * 0.6, lx + 0.32 - 0.07, y + h * 0.6, lx + 0.15, y + h * 0.82, lx - 0.15, y + h * 0.82], hi ? k.hi : k.fur);
    if (hi) { R4(ctx, lx - 0.25, y + h * 0.6, 0.5, Math.max(0.025, env.px * 0.5), k.mid); R4(ctx, x + w * 0.08, y, w * 0.34, h * 0.24, k.fur); R4(ctx, x + w * 0.06, y + h * 0.24, w * 0.38, h * 0.03, k.fur2); }
  } else if (d === 3) { // shelves of books
    for (let i = 0; i < 3; i++) ctx.fillRect(x + w * 0.08, y + h * (0.25 + i * 0.25), w * 0.4, 0.06);
    if (hi) {
      ctx.fillRect(x + w * 0.08, y + h * 0.1, 0.05, h * 0.72); ctx.fillRect(x + w * 0.48 - 0.05, y + h * 0.1, 0.05, h * 0.72);
      ctx.fillStyle = k.mid; ctx.beginPath();
      for (let i = 0; i < 3; i++) for (let b = 0; b < 7; b++) { const q = kxH(k.h * 50 + i * 9, b); if (q < 0.2) continue; ctx.rect(x + w * (0.11 + b * 0.05), y + h * (0.25 + i * 0.25) + 0.06, w * 0.036, h * (0.09 + q * 0.09)); }
      ctx.fill();
      if (fine) { ctx.fillStyle = k.fur2; ctx.beginPath(); for (let i = 0; i < 3; i++) for (let b = 1; b < 7; b += 2) { const q = kxH(k.h * 50 + i * 9, b); if (q < 0.45) continue; ctx.rect(x + w * (0.11 + b * 0.05), y + h * (0.25 + i * 0.25) + 0.06, w * 0.036, h * (0.09 + q * 0.09)); } ctx.fill(); }
      // a plant in a pot at the other side
      R4(ctx, x + w * 0.72, y, w * 0.12, h * 0.1, k.fur); ctx.fillStyle = k.fur; ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = -1.1 + i * 0.55, px = x + w * 0.78, py = y + h * 0.1; ctx.moveTo(px, py); ctx.quadraticCurveTo(px + Math.sin(a) * w * 0.08, py + h * 0.16, px + Math.sin(a) * w * 0.17, py + h * (0.2 + 0.06 * Math.cos(a * 2))); ctx.quadraticCurveTo(px + Math.sin(a) * w * 0.03, py + h * 0.12, px, py); } ctx.fill();
    }
  } else if (d === 4) { // a television, on
    const tx = x + w * 0.1, tw = w * 0.38, th = h * 0.26, ty = y + h * 0.06, fl = kxH(Math.floor(env.t * 7 + k.h * 20), k.h * 9), tv = ['#9fc4ff', '#d8e6ff', '#7fa6e8', '#c0d2f0', '#e8eeff'][Math.floor(fl * 5)];
    ctx.fillRect(tx, y, tw, h * 0.06); ctx.fillRect(tx, ty, tw, th);
    R4(ctx, tx + tw * 0.07, ty + th * 0.1, tw * 0.86, th * 0.8, S.tone(tv, P, true));
    if (hi) { ctx.globalAlpha = 0.16 + fl * 0.1; ctx.fillStyle = S.tone(tv, P, true); ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; R4(ctx, tx + tw * 0.3, ty + th, 0.03, h * 0.14, k.fur); R4(ctx, tx + tw * 0.6, ty + th, 0.03, h * 0.1, k.fur); R4(ctx, x + w * 0.66, y + h * 0.5, w * 0.22, h * 0.22, k.fur); R4(ctx, x + w * 0.69, y + h * 0.53, w * 0.16, h * 0.16, k.back); }
  } else { // a hanging lamp and a door in the far wall
    const lx = x + w * (0.3 + k.h2 * 0.2);
    R4(ctx, x + w * 0.62, y, w * 0.3, h * 0.78, k.mid);
    if (hi) { R4(ctx, x + w * 0.65, y, w * 0.24, h * 0.74, k.fur); ctx.fillStyle = k.mid; ctx.beginPath(); ctx.rect(x + w * 0.675, y + h * 0.4, w * 0.19, h * 0.3); ctx.rect(x + w * 0.675, y + h * 0.03, w * 0.19, h * 0.32); ctx.fill(); R4(ctx, x + w * 0.67, y + h * 0.36, w * 0.02, h * 0.04, k.hi); }
    R4(ctx, lx - 0.012, y + h * 0.8, 0.024, h * 0.2, k.fur);
    if (hi) { ctx.globalAlpha = 0.45; ctx.fillStyle = k.hi; ctx.beginPath(); ctx.ellipse(lx, y + h * 0.62, w * 0.3, h * 0.2, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    poly(ctx, [lx - 0.2, y + h * 0.7, lx + 0.2, y + h * 0.7, lx + 0.08, y + h * 0.8, lx - 0.08, y + h * 0.8], hi ? k.hi : k.fur);
  }
}
// The inside of a shop, by what the sign says it sells.
function kxShopInside(ctx, env, S, P, op, k) {
  const x = op.x, y = op.y, w = op.w, h = op.h, s = env.s, kind = (op.kd && op.kd.shop) || '', hi = s > 12, fine = s > 26, vx0 = env.x0 - 2, vx1 = env.x1 + 2;
  const T = (c) => S.tone(c, P, true);
  R4(ctx, x, y + h * 0.9, w, h * 0.1, k.mid);                                   // a pelmet of shadow along the top
  if (kind.indexOf('LAUND') >= 0) {
    // a row of washing machines with round doors, a shelf of soap above, shirts on a rail
    const n = Math.max(2, Math.floor(w / 0.95)), mw = w / n;
    for (let i = 0; i < n; i++) {
      const mx = x + i * mw; if (mx + mw < vx0 || mx > vx1) continue;
      R4(ctx, mx + mw * 0.07, y, mw * 0.86, h * 0.5, T('#e9eef2')); R4(ctx, mx + mw * 0.07, y + h * 0.42, mw * 0.86, h * 0.08, T('#c3ccd4'));
      circ(ctx, mx + mw * 0.5, y + h * 0.21, Math.min(mw * 0.3, h * 0.16), T('#5d7c93'));
      if (hi) { circ(ctx, mx + mw * 0.5, y + h * 0.21, Math.min(mw * 0.22, h * 0.115), T(i % 3 === 1 ? '#a8c8de' : '#33485a')); if (i % 3 === 1) { ctx.save(); ctx.translate(mx + mw * 0.5, y + h * 0.21); ctx.rotate(env.t * 3 + i); R4(ctx, -mw * 0.14, -0.02, mw * 0.28, 0.04, T('#e9eef2')); ctx.restore(); } R4(ctx, mx + mw * 0.14, y + h * 0.44, mw * 0.2, h * 0.035, T('#33485a')); R4(ctx, mx + mw * 0.7, y + h * 0.445, mw * 0.08, h * 0.03, T(i % 2 ? '#d9482b' : '#52e07a')); }
    }
    if (hi) {
      R4(ctx, x, y + h * 0.62, w, 0.05, k.fur);
      const cols = ['#3b6ea5', '#d9482b', '#e8a23a', '#f1ede2', '#4f8a4a'];
      for (let bx = x + 0.3; bx < x + w - 0.3; bx += 0.42) { if (bx < vx0 || bx > vx1) continue; const q = kxH(bx, 4.4); if (q < 0.3) continue; R4(ctx, bx, y + h * 0.62 + 0.05, 0.2 + q * 0.12, h * (0.08 + q * 0.07), T(cols[Math.floor(q * 5)])); }
    }
  } else if (kind.indexOf('DELI') >= 0) {
    // a glass counter, shelves of jars and tins, sausages and hams hanging from a rail
    R4(ctx, x, y, w, h * 0.3, T('#dfe9ee')); R4(ctx, x, y + h * 0.28, w, h * 0.05, T('#8a6a45'));
    if (hi) {
      const cols = ['#d9482b', '#e8a23a', '#f4e6b0', '#7fae45', '#b56bb0', '#f1ede2'];
      for (let bx = x + 0.2; bx < x + w - 0.3; bx += 0.5) { if (bx < vx0 || bx > vx1) continue; const q = kxH(bx, 1.7); ctx.fillStyle = T(cols[Math.floor(q * 6)]); ctx.beginPath(); ctx.ellipse(bx + 0.18, y + h * 0.1, 0.17, h * 0.07, 0, 0, TAU); ctx.fill(); }
      for (let r = 0; r < 2; r++) { R4(ctx, x, y + h * (0.5 + r * 0.19), w, 0.045, k.fur); for (let bx = x + 0.15; bx < x + w - 0.2; bx += 0.27) { if (bx < vx0 || bx > vx1) continue; const q = kxH(bx * 1.3, r + 2.2); if (q < 0.18) continue; R4(ctx, bx, y + h * (0.5 + r * 0.19) + 0.045, 0.15, h * (0.07 + q * 0.07), T(cols[Math.floor(q * 6)])); if (fine) R4(ctx, bx, y + h * (0.5 + r * 0.19) + 0.045 + h * 0.03, 0.15, h * 0.03, T('#f6f1e4')); } }
    }
    R4(ctx, x, y + h * 0.88, w, 0.035, k.fur2);
    for (let bx = x + 0.5; bx < x + w - 0.3; bx += 0.62) { if (bx < vx0 || bx > vx1) continue; const q = kxH(bx, 8.8), len = h * (0.14 + q * 0.12); ctx.fillStyle = T(q > 0.6 ? '#8f3a2a' : '#a8553a'); ctx.beginPath(); ctx.ellipse(bx, y + h * 0.88 - len / 2, q > 0.6 ? 0.11 : 0.06, len / 2, 0, 0, TAU); ctx.fill(); }
  } else if (kind.indexOf('BILLIARD') >= 0 || kind.indexOf('POOL') >= 0) {
    // green tables under low shaded lamps, a rack of cues on the wall
    const n = Math.max(1, Math.floor(w / 4.4)), tw = w / n;
    R4(ctx, x, y, w, h, T('#5a4a3a')); R4(ctx, x, y, w, h * 0.34, T('#3f342a'));
    for (let i = 0; i < n; i++) {
      const cx = x + (i + 0.5) * tw; if (cx + tw < vx0 || cx - tw > vx1) continue;
      R4(ctx, cx - tw * 0.36, y + h * 0.12, tw * 0.72, h * 0.14, T('#2f7a4a')); R4(ctx, cx - tw * 0.38, y + h * 0.08, tw * 0.76, h * 0.05, T('#6b4a2f')); R4(ctx, cx - tw * 0.38, y + h * 0.25, tw * 0.76, h * 0.03, T('#8a6a45'));
      ctx.globalAlpha = 0.32; poly(ctx, [cx - tw * 0.06, y + h * 0.64, cx + tw * 0.06, y + h * 0.64, cx + tw * 0.34, y + h * 0.26, cx - tw * 0.34, y + h * 0.26], T('#ffe9b0')); ctx.globalAlpha = 1;
      R4(ctx, cx - 0.012, y + h * 0.72, 0.024, h * 0.28, T('#1c1f26')); poly(ctx, [cx - tw * 0.09, y + h * 0.62, cx + tw * 0.09, y + h * 0.62, cx + tw * 0.04, y + h * 0.74, cx - tw * 0.04, y + h * 0.74], T('#2f6b4a'));
      if (hi) { R4(ctx, cx - tw * 0.07, y + h * 0.62, tw * 0.14, h * 0.025, T('#fff3c4')); circ(ctx, cx - tw * 0.1, y + h * 0.275, 0.045, T('#f1ede2')); circ(ctx, cx + tw * 0.14, y + h * 0.275, 0.045, T('#d9482b')); circ(ctx, cx + tw * 0.05, y + h * 0.275, 0.045, T('#e8a23a')); }
    }
    if (hi) { R4(ctx, x + w * 0.02, y + h * 0.42, 0.5, h * 0.4, T('#3f2e20')); ctx.fillStyle = T('#c9a878'); for (let i = 0; i < 4; i++) ctx.fillRect(x + w * 0.02 + 0.08 + i * 0.1, y + h * 0.44, 0.025, h * 0.36); }
  } else if (kind.indexOf('PAWN') >= 0) {
    // shelves of other people's things: a guitar, a clock, a wireless, cases
    for (let r = 0; r < 3; r++) R4(ctx, x, y + h * (0.22 + r * 0.24), w, 0.045, k.fur);
    if (hi) for (let bx = x + 0.3; bx < x + w - 0.6; bx += 0.95) {
      if (bx < vx0 || bx > vx1) continue; const q = kxH(bx, 6.1), r = Math.floor(q * 3), yy = y + h * (0.22 + r * 0.24) + 0.045;
      if (q < 0.3) { R4(ctx, bx, yy, 0.5, h * 0.14, T('#6b4a2f')); R4(ctx, bx + 0.05, yy + h * 0.03, 0.22, h * 0.08, T('#c9b386')); circ(ctx, bx + 0.39, yy + h * 0.07, 0.06, T('#2a2e36')); }
      else if (q < 0.55) { ctx.fillStyle = T('#a8703a'); ctx.beginPath(); ctx.ellipse(bx + 0.2, yy + h * 0.07, 0.16, h * 0.07, 0, 0, TAU); ctx.ellipse(bx + 0.2, yy + h * 0.15, 0.11, h * 0.05, 0, 0, TAU); ctx.fill(); R4(ctx, bx + 0.18, yy + h * 0.18, 0.04, h * 0.02, T('#3a2a1a')); }
      else if (q < 0.8) { R4(ctx, bx, yy, 0.36, h * 0.17, T('#3a3f47')); R4(ctx, bx + 0.05, yy + h * 0.04, 0.26, h * 0.1, T('#e9e4d6')); }
      else { R4(ctx, bx, yy, 0.6, h * 0.1, T('#7a4a3a')); R4(ctx, bx + 0.24, yy + h * 0.1, 0.12, h * 0.02, T('#2a2e36')); }
    }
    R4(ctx, x, y, w, h * 0.12, k.fur);
  } else {
    // goods of some kind on stands
    for (let i = 0; i < 5; i++) R4(ctx, x + w * (0.06 + i * 0.19), y, w * 0.1, h * (0.3 + ((i * 7) % 4) * 0.1), k.fur);
    if (hi) for (let i = 0; i < 5; i++) R4(ctx, x + w * (0.06 + i * 0.19), y + h * (0.3 + ((i * 7) % 4) * 0.1), w * 0.1, h * 0.04, k.mid);
  }
}
// Far off, a whole building's windows are drawn in a handful of batched passes instead of
// one at a time. The rooms behind: dark ones in one fill, lit ones in one fill per colour.
function kxWinsBackFar(ctx, env, S, P, list, inRoom) {
  const ty0 = env.y0 === undefined ? -1e9 : env.y0 - 1, ty1 = env.y1 === undefined ? 1e9 : env.y1 + 1, ex0 = env.x0, ex1 = env.x1;
  ctx.fillStyle = env.nv ? mix(inRoom, '#2c5a3a', 0.5) : inRoom; ctx.beginPath();
  let anyLit = false;
  for (let i = 0; i < list.length; i++) { const op = list[i]; if (op.x + op.w < ex0 || op.x > ex1 || op.y > ty1 || op.y + op.h < ty0) continue; const r = S.rooms[op.room]; if (r && r.lit) { anyLit = true; continue; } ctx.rect(op.x, op.y, op.w, op.h); }
  ctx.fill();
  if (!anyLit) return;
  const done = [];
  for (let i = 0; i < list.length; i++) {
    const op = list[i]; if (op.x + op.w < ex0 || op.x > ex1 || op.y > ty1 || op.y + op.h < ty0) continue; const r = S.rooms[op.room]; if (!r || !r.lit) continue;
    const c = kxOp(S, P, op).lit; if (done.indexOf(c) >= 0) continue; done.push(c);
    ctx.fillStyle = c; ctx.beginPath();
    for (let j = i; j < list.length; j++) { const q = list[j]; if (q.x + q.w < ex0 || q.x > ex1 || q.y > ty1 || q.y + q.h < ty0) continue; const rq = S.rooms[q.room]; if (!rq || !rq.lit || kxOp(S, P, q).lit !== c) continue; ctx.rect(q.x, q.y, q.w, q.h); }
    ctx.fill();
  }
}
// A leaning stripe of reflected light on a pane, kept inside the pane.
function kxStreak(ctx, x, y, w, h, a, kw, lean) {
  const b0 = clamp(a, x, x + w), b1 = clamp(a + kw, x, x + w), t0 = clamp(a - lean, x, x + w), t1 = clamp(a + kw - lean, x, x + w);
  if (b1 - b0 < 0.01 && t1 - t0 < 0.01) return;
  ctx.moveTo(b0, y); ctx.lineTo(b1, y); ctx.lineTo(t1, y + h); ctx.lineTo(t0, y + h); ctx.closePath();
}
// What sits in front of anyone in the room: curtains, blinds, the glass and the frame.
function drawWindowFront(ctx, env, S, P, op, frame, tall) {
  kxOne[0] = op; kxWinsFront(ctx, env, S, P, kxOne, frame, tall);
}
const kxOne = [null], kxVis = [];
// The same for a whole list of windows at once. Whatever looks the same on every window
// (the wash on the glass, the streaks, the shade in the reveal, the frames, the sills) goes
// in one fill per kind for the lot; curtains, blinds, broken panes and window boxes are
// drawn window by window. A building calls this for all its windows every frame.
function kxWinsFront(ctx, env, S, P, list, frame, tall) {
  const s = env.s, px = env.px, ex0 = env.x0, ex1 = env.x1, ty0 = env.y0 === undefined ? -1e9 : env.y0 - 0.3, ty1 = env.y1 === undefined ? 1e9 : env.y1 + 0.6, V = kxVis;
  let m = 0;
  for (let i = 0; i < list.length; i++) {
    const op = list[i]; if (op.roof || op.x + op.w < ex0 || op.x > ex1 || op.y > ty1 || op.y + op.h < ty0) continue;
    const r = S.rooms[op.room]; op._kxL = !!(r && r.lit); V[m++] = op;
  }
  if (!m) return;
  // curtains, drapes and blinds
  for (let i = 0; i < m; i++) { const op = V[i]; if (op.curtain || op.blind > 0 || (op.kd && op.kd.drape && s > 6)) kxWinCloth(ctx, env, S, P, op, op._kxL); }
  // the glass: a pale wash, the sky in the upper part of a dark pane, and leaning streaks
  // that slide across as the view pans
  const span = Math.max(1, ex1 - ex0), mid = (ex0 + ex1) / 2;
  for (let pass = 0; pass < 2; pass++) {
    const litPass = pass === 1;
    // a dark pane also holds the sky in its upper part: that part gets the wash and the sky
    // mixed into one colour, so no pixel of glass is painted twice
    const sky = !litPass && s > 7, top = sky ? 0.55 : 1;
    ctx.fillStyle = litPass ? 'rgba(255,255,255,0.06)' : 'rgba(150,190,230,0.10)'; ctx.beginPath();
    for (let i = 0; i < m; i++) { const op = V[i]; if (!op.glass || op.broken || op._kxL !== litPass) continue; ctx.rect(op.x, op.y, op.w, op.h * top); }
    ctx.fill();
    if (sky) {
      if (!S._kxSkyW) { const q = rgbOf(mix(S.pal.skyBot, '#ffffff', 0.25)), a1 = 0.1, a2 = 0.1, A = a1 + a2 - a1 * a2, c = (w, k) => Math.round((w * a1 * (1 - a2) + q[k] * a2) / A); S._kxSkyW = 'rgba(' + c(150, 0) + ',' + c(190, 1) + ',' + c(230, 2) + ',' + A.toFixed(3) + ')'; }
      ctx.fillStyle = S._kxSkyW; ctx.beginPath();
      for (let i = 0; i < m; i++) { const op = V[i]; if (!op.glass || op.broken || op._kxL) continue; ctx.rect(op.x, op.y + op.h * 0.55, op.w, op.h * 0.45); }
      ctx.fill();
    }
    if (s > (tall ? 6 : 3)) {
      ctx.fillStyle = litPass ? 'rgba(255,255,255,0.10)' : 'rgba(200,225,255,0.13)'; ctx.beginPath();
      for (let i = 0; i < m; i++) {
        const op = V[i]; if (!op.glass || op.broken || op._kxL !== litPass) continue;
        const x = op.x, y = op.y, w = op.w, h = op.h, u = clamp((x + w / 2 - mid) / span, -0.6, 0.6), lean = h * 0.35, a = x + w * (0.42 - u * 0.75);
        kxStreak(ctx, x, y, w, h, a, w * (tall ? 0.12 : 0.2), lean);
        if (s > 14) kxStreak(ctx, x, y, w, h, a + w * (tall ? 0.2 : 0.3), w * 0.06, lean);
        if (tall && s > 14) kxStreak(ctx, x, y, w, h, a - w * 0.42, w * 0.2, lean);
      }
      ctx.fill();
    }
  }
  if (s > 2) for (let i = 0; i < m; i++) if (V[i].broken) kxWinBroken(ctx, env, V[i]);
  // the depth of the opening: shade under the head and down one side
  if (s > 14) {
    ctx.fillStyle = 'rgba(0,0,0,0.26)'; ctx.beginPath(); for (let i = 0; i < m; i++) { const op = V[i]; if (!op.door) ctx.rect(op.x, op.y + op.h - 0.07, op.w, 0.07); } ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.beginPath(); for (let i = 0; i < m; i++) { const op = V[i]; if (!op.door) ctx.rect(op.x, op.y, 0.05, op.h - 0.07); } ctx.fill();
  }
  // frames, glazing bars and sills
  // (as thin filled strips rather than strokes: one fill of plain rectangles is far cheaper)
  const fw = Math.max(0.07, px * 0.9), bars = !tall && s > 2.5, bw = s > 14 ? Math.max(0.045, px * 0.8) : fw, f2 = fw / 2;
  ctx.fillStyle = frame; ctx.beginPath();
  for (let i = 0; i < m; i++) {
    const op = V[i], x = op.x, y = op.y, w = op.w, h = op.h;
    ctx.rect(x - f2, y - f2, w + fw, fw); ctx.rect(x - f2, y + h - f2, w + fw, fw); ctx.rect(x - f2, y + f2, fw, h - fw); ctx.rect(x + w - f2, y + f2, fw, h - fw);
    if (bars && !op.door) kxBars(ctx, op, bw);
  }
  ctx.fill();
  if (bars) {
    ctx.fillStyle = frame; ctx.beginPath(); for (let i = 0; i < m; i++) { const op = V[i]; if (!op.door) ctx.rect(op.x - 0.12, op.y - 0.12, op.w + 0.24, 0.12); } ctx.fill();
    if (s > 14) {
      const sh = Math.max(0.03, px * 0.6);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); for (let i = 0; i < m; i++) { const op = V[i]; if (!op.door) ctx.rect(op.x - 0.12, op.y - 0.12 - sh, op.w + 0.24, sh); } ctx.fill();
      if (s > 22) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); for (let i = 0; i < m; i++) { const op = V[i]; if (!op.door) ctx.rect(op.x - 0.12, op.y - 0.02, op.w + 0.24, 0.02); } ctx.fill(); }
    }
  }
  if (s > 5) for (let i = 0; i < m; i++) { const op = V[i]; if (op.kd && op.kd.box) kxWinBox(ctx, env, S, P, op); }
  for (let i = 0; i < m; i++) V[i] = null;
}
// The glazing bars of one window, added to the current path.
// The glazing bars of one window, bw thick, added to the current path as thin rectangles.
function kxBars(ctx, op, bw) {
  const x = op.x, y = op.y, w = op.w, h = op.h, bars = op.kd ? op.kd.bars : 0, b2 = bw / 2, H = (k) => ctx.rect(x, y + h * k - b2, w, bw), V = (k0, k1) => ctx.rect(x + w / 2 - b2, y + h * k0, bw, h * (k1 - k0));
  if (bars === 1) { H(0.5); V(0.5, 1); }                     // sash, split above
  else if (bars === 2) { V(0, 1); H(0.36); H(0.7); }         // six panes
  else if (bars === 3) { V(0, 0.74); H(0.74); }              // casements under a top light
  else if (bars !== -1) { V(0, 1); H(0.55); }
}
// Curtains, drapes and a blind, in front of whoever is in the room.
function kxWinCloth(ctx, env, S, P, op, lit) {
  const x = op.x, y = op.y, w = op.w, h = op.h, s = env.s, px = env.px, kd = op.kd;
  if (op.curtain) {
    const cc = S.tone(op.curtain === true ? '#b9a48c' : op.curtain, P, lit);
    ctx.fillStyle = cc;
    ctx.globalAlpha = 0.86; ctx.fillRect(x, y, w * 0.26, h); ctx.fillRect(x + w * 0.74, y, w * 0.26, h); ctx.globalAlpha = 1;
    if (s > 9) { // folds, a hem and the rail
      ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.beginPath(); for (let i = 0; i < 3; i++) { ctx.rect(x + w * (0.05 + i * 0.075), y, w * 0.022, h); ctx.rect(x + w * (0.79 + i * 0.075), y, w * 0.022, h); } ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); for (let i = 0; i < 3; i++) { ctx.rect(x + w * (0.02 + i * 0.075), y, w * 0.018, h); ctx.rect(x + w * (0.76 + i * 0.075), y, w * 0.018, h); } ctx.fill();
      R4(ctx, x, y + h - 0.06, w, 0.035, S.tone('#3a2f28', P, lit));
    }
  } else if (kd && kd.drape && s > 6) {
    // decoration only: narrow drapes that never cover the middle of the window
    const cc = S.tone(kd.drapeCol, P, lit); ctx.fillStyle = cc; ctx.globalAlpha = 0.9; ctx.beginPath();
    if (kd.drape === 1) { // a pair, tied back
      ctx.moveTo(x, y + h); ctx.lineTo(x + w * 0.15, y + h); ctx.quadraticCurveTo(x + w * 0.13, y + h * 0.62, x + w * 0.035, y + h * 0.42); ctx.quadraticCurveTo(x + w * 0.1, y + h * 0.2, x + w * 0.085, y); ctx.lineTo(x, y); ctx.closePath();
      ctx.moveTo(x + w, y + h); ctx.lineTo(x + w * 0.85, y + h); ctx.quadraticCurveTo(x + w * 0.87, y + h * 0.62, x + w * 0.965, y + h * 0.42); ctx.quadraticCurveTo(x + w * 0.9, y + h * 0.2, x + w * 0.915, y); ctx.lineTo(x + w, y); ctx.closePath();
    } else if (kd.drape === 2) { // a pelmet with a scalloped edge
      ctx.moveTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h * 0.93); for (let i = 3; i > 0; i--) ctx.quadraticCurveTo(x + (w * (i - 0.5)) / 3, y + h * 0.86, x + (w * (i - 1)) / 3, y + h * 0.93); ctx.closePath();
    } else { ctx.rect(x, y, w * 0.11, h); }                                       // one curtain, drawn back
    ctx.fill(); ctx.globalAlpha = 1;
    if (s > 20 && kd.drape !== 2) { ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x + w * 0.03, y, w * 0.016, h * (kd.drape === 1 ? 0.4 : 1)); ctx.fillRect(x + w * 0.07, y, w * 0.014, h * (kd.drape === 1 ? 0.25 : 1)); if (kd.drape === 1) { ctx.fillRect(x + w * 0.945, y, w * 0.016, h * 0.4); R4(ctx, x, y + h * 0.4, w * 0.05, h * 0.035, 'rgba(0,0,0,0.3)'); R4(ctx, x + w * 0.95, y + h * 0.4, w * 0.05, h * 0.035, 'rgba(0,0,0,0.3)'); } }
  }
  if (op.blind > 0) {
    const by = y + h * (1 - op.blind), bh = h * op.blind;
    ctx.fillStyle = S.tone('#d8d2c2', P, lit); ctx.fillRect(x, by, w, bh);
    if (s > 6) {
      // slats, the bottom rail and the cord
      const step = Math.max(0.1, px * 3), lw = Math.max(0.022, px * 0.7);
      ctx.fillStyle = S.tone('#b7b0a0', P, lit); ctx.beginPath(); for (let yy = by + step * 0.5; yy < y + h; yy += step) ctx.rect(x, yy, w, lw); ctx.fill();
      R4(ctx, x, by, w, Math.max(0.05, px), S.tone('#8f8878', P, lit));
      if (s > 18) { R4(ctx, x + w * 0.2, by, 0.02, bh, 'rgba(0,0,0,0.18)'); R4(ctx, x + w * 0.8, by, 0.02, bh, 'rgba(0,0,0,0.18)'); R4(ctx, x + w - 0.1, by - h * 0.2, 0.018, h * 0.2, S.tone('#e8e2d2', P, lit)); R4(ctx, x + w - 0.12, by - h * 0.2 - 0.05, 0.06, 0.06, S.tone('#e8e2d2', P, lit)); }
    }
  }
}
// A pane that has been shot out: jagged teeth of glass left round the frame, cracks
// running into them, and a clear dark hole.
function kxWinBroken(ctx, env, op) {
  const x = op.x, y = op.y, w = op.w, h = op.h, s = env.s, px = env.px;
  const q = op._kxB || (op._kxB = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((i) => kxH(x * 7.7 + i * 3.1, y + i)));
  ctx.fillStyle = 'rgba(190,215,240,0.34)'; ctx.beginPath();
  // teeth along the bottom, top and both sides
  let bx = x; for (let i = 0; i < 5; i++) { const ww = w * (0.12 + q[i] * 0.16); if (bx + ww > x + w) break; ctx.moveTo(bx, y); ctx.lineTo(bx + ww, y); ctx.lineTo(bx + ww * (0.2 + q[i + 1] * 0.6), y + h * (0.08 + q[i + 2] * 0.24)); ctx.closePath(); bx += ww; }
  bx = x; for (let i = 5; i < 9; i++) { const ww = w * (0.14 + q[i] * 0.2); if (bx + ww > x + w) break; ctx.moveTo(bx, y + h); ctx.lineTo(bx + ww, y + h); ctx.lineTo(bx + ww * (0.2 + q[i + 1] * 0.6), y + h * (0.9 - q[i + 2] * 0.22)); ctx.closePath(); bx += ww; }
  ctx.moveTo(x, y + h * 0.2); ctx.lineTo(x, y + h * 0.58); ctx.lineTo(x + w * (0.12 + q[9] * 0.14), y + h * 0.4); ctx.closePath();
  ctx.moveTo(x, y + h * 0.62); ctx.lineTo(x, y + h * 0.86); ctx.lineTo(x + w * (0.08 + q[10] * 0.1), y + h * 0.7); ctx.closePath();
  ctx.moveTo(x + w, y + h * 0.14); ctx.lineTo(x + w, y + h * 0.5); ctx.lineTo(x + w * (0.84 - q[11] * 0.12), y + h * 0.3); ctx.closePath();
  ctx.moveTo(x + w, y + h * 0.56); ctx.lineTo(x + w, y + h * 0.9); ctx.lineTo(x + w * (0.8 - q[12] * 0.14), y + h * 0.76); ctx.closePath();
  ctx.fill();
  if (s > 9) {
    ctx.strokeStyle = 'rgba(225,240,255,0.5)'; ctx.lineWidth = Math.max(0.012, px * 0.6); ctx.beginPath();
    const cx = x + w * (0.4 + q[13] * 0.2), cy = y + h * (0.4 + q[0] * 0.2);
    for (let i = 0; i < 8; i++) { const an = (i / 8) * TAU + q[i] * 0.6, r0 = 0.5 + q[i + 2] * 0.2; const ex = cx + Math.cos(an) * w, ey = cy + Math.sin(an) * h; ctx.moveTo(clamp(cx + Math.cos(an) * w * r0 * 0.6, x, x + w), clamp(cy + Math.sin(an) * h * r0 * 0.6, y, y + h)); ctx.lineTo(clamp(ex, x, x + w), clamp(ey, y, y + h)); }
    ctx.stroke();
  }
}
// A window box with plants and flowers, on the sill.
function kxWinBox(ctx, env, S, P, op) {
  const x = op.x, y = op.y, w = op.w, s = env.s, kd = op.kd;
  if (kd && kd.box && s > 5) { // a window box
    const bc = S.tone('#7a4a34', P), g1 = S.tone('#4f8a4a', P), g2 = S.tone('#3d6e3c', P);
    R4(ctx, x + 0.08, y - 0.36, w - 0.16, 0.24, bc);
    if (s > 12) { R4(ctx, x + 0.08, y - 0.15, w - 0.16, 0.03, 'rgba(255,255,255,0.14)'); R4(ctx, x + 0.08, y - 0.36, w - 0.16, 0.04, 'rgba(0,0,0,0.25)'); }
    const n = Math.max(4, Math.round((w - 0.2) / 0.2));
    for (let pass = 0; pass < 2; pass++) { ctx.fillStyle = pass ? g1 : g2; ctx.beginPath(); for (let i = pass; i < n; i += 2) { const fx = x + 0.14 + (i * (w - 0.28)) / (n - 1), q = kxH(fx, y); ctx.moveTo(fx + 0.12, y - 0.1 + q * 0.06); ctx.arc(fx, y - 0.1 + q * 0.06, 0.1 + q * 0.04, 0, TAU); } ctx.fill(); }
    if (s > 12) { ctx.fillStyle = S.tone(kd.boxCol, P); ctx.beginPath(); for (let i = 0; i < n; i++) { const fx = x + 0.14 + (i * (w - 0.28)) / (n - 1), q = kxH(fx * 3, y + 1); if (q < 0.35) continue; ctx.moveTo(fx + 0.045, y - 0.05 + q * 0.1); ctx.arc(fx + (q - 0.5) * 0.1, y - 0.05 + q * 0.1, 0.04, 0, TAU); } ctx.fill(); }
  }
}

// A balcony on the front of a building. Figures on it stand in the open.
K.balcony = function (S, P, B, f, c0, c1, o) {
  o = o || {};
  const x0 = B.winX(c0) - 1.3, x1 = B.winX(c1 === undefined ? c0 : c1) + 1.3, y = B.floorY(f);
  const slab = S.tone('#8f949a', P), rail = S.tone(o.rail || '#22262d', P), slabD = S.tone('#5f646a', P), slabH = S.tone('#b3b8bd', P);
  P.add({ x0, x1, layer: 0, draw(ctx, env) {
    // the slab with a lit top edge, the shadow it throws on the wall, and the brackets that carry it
    if (env.s > 6) kxFadeAt(ctx, '#000000', x0, y - 0.22, x1 - x0, -0.7, 0.28);
    R4(ctx, x0, y - 0.22, x1 - x0, 0.22, slab);
    if (env.s > 6) {
      R4(ctx, x0, y - 0.05, x1 - x0, 0.05, slabH); R4(ctx, x0, y - 0.22, x1 - x0, 0.05, slabD);
      ctx.fillStyle = slabD; ctx.beginPath();
      for (const bx of [x0 + 0.25, x1 - 0.25, (x0 + x1) / 2]) { if (x1 - x0 < 4 && bx === (x0 + x1) / 2) continue; ctx.moveTo(bx - 0.09, y - 0.22); ctx.lineTo(bx + 0.09, y - 0.22); ctx.lineTo(bx + 0.09, y - 0.5); ctx.quadraticCurveTo(bx + 0.06, y - 0.78, bx - 0.09, y - 0.86); ctx.closePath(); }
      ctx.fill();
    }
  } });
  P.add({ x0, x1, layer: 2, draw(ctx, env) {
    ctx.strokeStyle = rail; ctx.lineWidth = Math.max(0.05, env.px * 0.8);
    ctx.beginPath(); ctx.moveTo(x0, y + 1.0); ctx.lineTo(x1, y + 1.0); ctx.moveTo(x0, y); ctx.lineTo(x0, y + 1.0); ctx.moveTo(x1, y); ctx.lineTo(x1, y + 1.0);
    if (env.s > 4) { ctx.stroke(); ctx.lineWidth = Math.max(0.025, env.px * 0.5); ctx.beginPath(); for (let x = x0 + 0.28; x < x1; x += 0.28) { ctx.moveTo(x, y + 0.07); ctx.lineTo(x, y + 1.0); } ctx.moveTo(x0, y + 0.07); ctx.lineTo(x1, y + 0.07); }
    ctx.stroke();
    if (env.s > 12) { // a rounded hand rail and a knob on each corner post
      ctx.lineWidth = Math.max(0.07, env.px); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0 - 0.04, y + 1.02); ctx.lineTo(x1 + 0.04, y + 1.02); ctx.stroke(); ctx.lineCap = 'butt';
      ctx.fillStyle = rail; ctx.beginPath(); ctx.arc(x0, y + 1.09, 0.06, 0, TAU); ctx.moveTo(x1 + 0.06, y + 1.09); ctx.arc(x1, y + 1.09, 0.06, 0, TAU); ctx.fill();
      R4(ctx, x0 - 0.04, y + 1.04, x1 - x0 + 0.08, Math.max(0.012, env.px * 0.4), 'rgba(255,255,255,0.22)');
    }
  } });
  return { x0, x1, y, zone: B.id + ':bal' + f };
};

K.fireEscape = function (S, P, B, c, f0, f1) {
  const x0 = B.winX(c) - 1.5, x1 = B.winX(c) + 1.5, col = S.tone('#1b1e24', P), hiC = S.tone('#3a404a', P);
  P.add({ x0, x1, layer: 2, draw(ctx, env) {
    const s = env.s;
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.06, env.px * 0.8);
    ctx.beginPath();
    for (let f = f0; f <= f1; f++) {
      const y = B.floorY(f);
      ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.moveTo(x0, y + 1); ctx.lineTo(x1, y + 1); ctx.moveTo(x0, y); ctx.lineTo(x0, y + 1); ctx.moveTo(x1, y); ctx.lineTo(x1, y + 1);
      if (f < f1) { ctx.moveTo(x0 + 0.3, y); ctx.lineTo(x1 - 0.3, y + B.fh); }
    }
    ctx.stroke();
    if (s > 6) {
      // slatted landings, thin balusters, the treads of each flight, and the drop ladder at the bottom
      ctx.lineWidth = Math.max(0.022, env.px * 0.5); ctx.beginPath();
      for (let f = f0; f <= f1; f++) {
        const y = B.floorY(f);
        if (env.y0 !== undefined && (y > env.y1 + 1 || y + B.fh < env.y0 - 1)) continue;
        ctx.moveTo(x0, y - 0.07); ctx.lineTo(x1, y - 0.07); ctx.moveTo(x0, y + 0.5); ctx.lineTo(x1, y + 0.5);
        for (let x = x0 + 0.3; x < x1 - 0.05; x += 0.3) { ctx.moveTo(x, y); ctx.lineTo(x, y + 1); }
        if (f < f1) { const n = 11; for (let k = 1; k < n; k++) { const u = k / n, sx = x0 + 0.3 + u * (x1 - x0 - 0.6), sy = y + u * B.fh; ctx.moveTo(sx - 0.12, sy); ctx.lineTo(sx + 0.16, sy); } ctx.moveTo(x0 + 0.3, y + 0.9); ctx.lineTo(x1 - 0.3, y + B.fh + 0.9); }
      }
      const yb = B.floorY(f0); ctx.moveTo(x0 + 0.5, yb); ctx.lineTo(x0 + 0.5, yb - 1.9); ctx.moveTo(x0 + 0.95, yb); ctx.lineTo(x0 + 0.95, yb - 1.9); for (let k = 1; k < 7; k++) { ctx.moveTo(x0 + 0.5, yb - k * 0.28); ctx.lineTo(x0 + 0.95, yb - k * 0.28); }
      ctx.stroke();
      if (s > 16) { ctx.strokeStyle = hiC; ctx.lineWidth = Math.max(0.015, env.px * 0.4); ctx.beginPath(); for (let f = f0; f <= f1; f++) { const y = B.floorY(f); ctx.moveTo(x0, y + 1.03); ctx.lineTo(x1, y + 1.03); } ctx.stroke(); }
    }
  } });
};

K.watertank = function (S, P, x, y) {
  const wood = S.tone('#6b4f3a', P), dark = S.tone('#3a2c22', P), leg = S.tone('#23262c', P), woodHi = S.tone('#84644a', P), woodLo = S.tone('#553d2c', P), hoop = S.tone('#2c2f35', P);
  P.add({ x0: x - 2, x1: x + 2, layer: 0, draw(ctx, env) {
    const s = env.s;
    line(ctx, x - 1.2, y, x - 1.0, y + 2.2, leg, 0.1, env); line(ctx, x + 1.2, y, x + 1.0, y + 2.2, leg, 0.1, env); line(ctx, x - 1.2, y + 0.2, x + 1.2, y + 1.8, leg, 0.05, env);
    if (s > 6) { line(ctx, x + 1.2, y + 0.2, x - 1.2, y + 1.8, leg, 0.05, env); line(ctx, x, y, x, y + 2.2, leg, 0.08, env); R4(ctx, x - 1.6, y + 2.08, 3.2, 0.14, leg); line(ctx, x - 1.25, y + 1.1, x + 1.25, y + 1.1, leg, 0.05, env); }
    R4(ctx, x - 1.5, y + 2.2, 3, 2.6, wood);
    if (s > 6) {
      // staves: lighter towards the left where the light falls, darker round the right-hand curve
      R4(ctx, x - 1.5, y + 2.2, 0.75, 2.6, woodHi); R4(ctx, x + 0.75, y + 2.2, 0.75, 2.6, woodLo);
      if (s > 12) { ctx.fillStyle = dark; ctx.globalAlpha = 0.45; ctx.beginPath(); for (let k = 1; k < 12; k++) { const u = k / 12, sx = x - 1.5 * Math.cos(u * Math.PI); ctx.rect(sx, y + 2.2, Math.max(0.02, env.px * 0.5), 2.6); } ctx.fill(); ctx.globalAlpha = 1; }
      ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.beginPath(); ctx.moveTo(x - 0.5, y + 4.8); ctx.lineTo(x - 0.2, y + 4.8); ctx.lineTo(x - 0.3, y + 3.0); ctx.lineTo(x - 0.42, y + 3.4); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = s > 6 ? hoop : dark; ctx.fillRect(x - 1.5, y + 2.9, 3, 0.1); ctx.fillRect(x - 1.5, y + 4.0, 3, 0.1);
    if (s > 6) { ctx.fillRect(x - 1.5, y + 2.35, 3, 0.07); ctx.fillRect(x - 1.5, y + 3.45, 3, 0.07); ctx.fillRect(x - 1.5, y + 4.55, 3, 0.07); }
    poly(ctx, [x - 1.7, y + 4.8, x + 1.7, y + 4.8, x, y + 5.9], dark);
    if (s > 6) {
      poly(ctx, [x - 1.7, y + 4.8, x - 0.2, y + 4.8, x, y + 5.9], S.tone('#4a3a2e', P)); R4(ctx, x - 1.72, y + 4.74, 3.44, 0.08, leg); R4(ctx, x - 0.05, y + 5.85, 0.1, 0.3, leg);
      if (s > 12) { // a ladder up the side and the fill pipe
        ctx.strokeStyle = leg; ctx.lineWidth = Math.max(0.03, env.px * 0.6); ctx.beginPath(); ctx.moveTo(x + 1.56, y); ctx.lineTo(x + 1.56, y + 4.9); ctx.moveTo(x + 1.86, y); ctx.lineTo(x + 1.86, y + 4.9); for (let k = 1; k < 16; k++) { ctx.moveTo(x + 1.56, y + k * 0.3); ctx.lineTo(x + 1.86, y + k * 0.3); } ctx.moveTo(x - 1.5, y + 2.5); ctx.lineTo(x - 1.75, y + 2.5); ctx.lineTo(x - 1.75, y); ctx.stroke();
      }
    }
  } });
  P.solid(x - 1.5, y + 2.2, 3, 2.6, 'wood');
};

K.billboard = function (S, P, x, y, w, h, text, o) {
  o = o || {};
  const lit = S.pal.dark > 0.5, face = S.tone(o.col || '#e9dcc0', P, lit), post = S.tone('#2a2e36', P), tc = S.tone(o.textCol || '#b3312b', P, lit), postHi = S.tone('#474d58', P);
  const faceD = mix(face, '#000000', 0.1), ls = String(text).split('|');
  P.add({ x0: x - 0.6, x1: x + w + 0.6, layer: o.layer || 0, draw(ctx, env) {
    const s = env.s, by = o.base || 0;
    line(ctx, x + w * 0.2, by, x + w * 0.2, y, post, 0.25, env); line(ctx, x + w * 0.8, by, x + w * 0.8, y, post, 0.25, env);
    if (s > 5) { // bracing between the posts and a walkway under the board
      ctx.strokeStyle = post; ctx.lineWidth = Math.max(0.07, env.px * 0.7); ctx.beginPath();
      for (let yy = by; yy + 1.6 < y; yy += 1.8) { ctx.moveTo(x + w * 0.2, yy); ctx.lineTo(x + w * 0.8, yy + 1.8 > y ? y : yy + 1.8); ctx.moveTo(x + w * 0.8, yy); ctx.lineTo(x + w * 0.2, yy + 1.8 > y ? y : yy + 1.8); }
      ctx.stroke();
      R4(ctx, x - 0.4, y - 0.45, w + 0.8, 0.1, post);
      ctx.lineWidth = Math.max(0.03, env.px * 0.5); ctx.beginPath(); ctx.moveTo(x - 0.4, y - 0.05); ctx.lineTo(x - 0.4, y - 0.4); ctx.moveTo(x + w + 0.4, y - 0.05); ctx.lineTo(x + w + 0.4, y - 0.4); ctx.stroke();
    }
    R4(ctx, x - 0.15, y - 0.15, w + 0.3, h + 0.3, post); R4(ctx, x, y, w, h, face);
    if (s > 5) {
      // the poster is pasted up in sheets, and has weathered a little
      ctx.fillStyle = faceD; ctx.beginPath(); const n = Math.max(2, Math.round(w / 1.3)); for (let i = 1; i < n; i++) ctx.rect(x + (i * w) / n, y, Math.max(0.02, env.px * 0.5), h); ctx.rect(x, y + h * 0.5, w, Math.max(0.02, env.px * 0.5)); ctx.fill();
      kxFadeAt(ctx, '#000000', x, y, w, h * 0.5, 0.12);
      ctx.strokeStyle = tc; ctx.globalAlpha = 0.7; ctx.lineWidth = Math.max(0.05, env.px * 0.7); ctx.strokeRect(x + 0.16, y + 0.16, w - 0.32, h - 0.32); ctx.globalAlpha = 1;
      R4(ctx, x - 0.15, y + h + 0.08, w + 0.3, 0.07, postHi);
    }
    for (let i = 0; i < ls.length; i++) env.text(ctx, ls[i], x + w / 2, y + h - (h / (ls.length + 1)) * (i + 1) - h * 0.1, Math.min(h / (ls.length + 0.6) * 0.6, w / (ls[i].length * 0.62)), tc, 'center');
    if (s > 9) { // a corner of the sheet that has come away, and small lamps along the foot
      poly(ctx, [x + w, y, x + w - 0.5, y, x + w, y + 0.42], post); poly(ctx, [x + w - 0.5, y, x + w - 0.34, y + 0.3, x + w, y + 0.42], faceD);
      const n = Math.max(2, Math.round(w / 1.6));
      for (let i = 0; i < n; i++) { const lx = x + ((i + 0.5) * w) / n; R4(ctx, lx - 0.03, y - 0.42, 0.06, 0.2, post); R4(ctx, lx - 0.13, y - 0.26, 0.26, 0.09, lit ? '#ffe9b0' : postHi); }
    }
    if (lit && s > 3) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.14 * S.pal.dark; kxSpillAt(ctx, kxSpill('#ffe2a8'), x + 0.4, y, w - 0.8, h * 0.4, 1); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  } });
  P.solid(x, y, w, h, o.mat || 'thin');
};

K.fence = function (S, P, x0, x1, h, o) {
  o = o || {}; const col = S.tone(o.col || '#3a3f47', P), y = o.y || 0;
  const wd = S.tone(darken(o.col || '#7a6248', 0.25), P), wl = S.tone(lighten(o.col || '#7a6248', 0.1), P), cap = S.tone(lighten(o.col || '#8a8f96', 0.2), P), colD = mix(col, '#000000', 0.2), colH = mix(col, '#ffffff', 0.12);
  P.add({ x0, x1, layer: o.layer === undefined ? 2 : o.layer, draw(ctx, env) {
    const s = env.s, vx0 = Math.max(x0, env.x0), vx1 = Math.min(x1, env.x1);
    if (vx1 <= vx0) return;
    if (o.kind === 'wood') {
      R4(ctx, x0, y, x1 - x0, h, col);
      if (s > 4) {
        // boards with gaps between them, uneven tops, two rails and their nails
        const a = x0 + Math.floor((vx0 - x0) / 0.3) * 0.3;
        ctx.fillStyle = wd; ctx.beginPath(); for (let x = a; x < vx1; x += 0.3) ctx.rect(x, y, Math.max(0.03, env.px * 0.6), h); ctx.fill();
        if (s > 10) {
          ctx.fillStyle = wl; ctx.beginPath(); for (let x = a; x < vx1; x += 0.3) { const k = kxH(x, h); if (k > 0.55) ctx.rect(x + 0.04, y, 0.24, h); } ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1;
          ctx.fillStyle = wd; ctx.beginPath(); ctx.rect(vx0, y + h * 0.22, vx1 - vx0, 0.035); ctx.rect(vx0, y + h * 0.78, vx1 - vx0, 0.035); ctx.fill();
          if (s > 22) { ctx.fillStyle = colD; ctx.beginPath(); for (let x = a; x < vx1; x += 0.3) { ctx.rect(x + 0.14, y + h * 0.22, 0.03, 0.03); ctx.rect(x + 0.14, y + h * 0.78, 0.03, 0.03); const k = kxH(x * 2, 7); if (k > 0.8) ctx.rect(x + 0.1, y + h * (0.3 + k * 0.3), 0.06, 0.09); } ctx.fill(); }
        }
        kxFadeAt(ctx, '#000000', vx0, y, vx1 - vx0, h, 0.18);
      }
      return;
    }
    if (o.kind === 'wall') {
      R4(ctx, x0, y, x1 - x0, h, col);
      if (s > 5) { kxBrickFill(ctx, env, x0, y, x1 - x0, h - 0.15, 0.8); kxFadeAt(ctx, '#000000', vx0, y, vx1 - vx0, h, 0.2); }
      R4(ctx, x0, y + h - 0.15, x1 - x0, 0.15, cap);
      if (s > 5) {
        R4(ctx, x0, y + h - 0.15 - Math.max(0.03, env.px * 0.6), x1 - x0, Math.max(0.03, env.px * 0.6), 'rgba(0,0,0,0.25)');
        if (s > 9) { ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.beginPath(); const a = Math.floor(vx0 / 2.3) * 2.3; for (let x = a; x < vx1; x += 2.3) { const k = kxH(x, y + 3); if (x + k * 2 < x0 || x + k * 2 > x1 - 0.2) continue; ctx.rect(x + k * 2, y + h - 0.15 - 0.3 - k * 0.9, 0.08 + k * 0.1, 0.3 + k * 0.9); } ctx.fill(); }
      }
      return;
    }
    // chain link: posts with caps, a top rail and tension wires, then the mesh itself
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.05, env.px * 0.8);
    ctx.beginPath(); ctx.moveTo(x0, y + h); ctx.lineTo(x1, y + h);
    for (let x = x0; x <= x1 + 0.01; x += 3) { if (x < vx0 - 1 || x > vx1 + 1) continue; ctx.moveTo(x, y); ctx.lineTo(x, y + h + 0.25); }
    ctx.stroke();
    if (s > 5) {
      const a = x0 + Math.floor((vx0 - x0 - h) / 0.35) * 0.35;
      ctx.lineWidth = Math.max(0.015, env.px * 0.4); ctx.globalAlpha = 0.55; ctx.beginPath(); for (let x = Math.max(x0, a); x < vx1 + h; x += 0.35) { if (x >= x1) break; ctx.moveTo(x, y); ctx.lineTo(Math.min(x1, x + h * 0.5), y + (Math.min(x1, x + h * 0.5) - x) * 2); ctx.moveTo(x + 0.35, y); ctx.lineTo(Math.max(x0, x + 0.35 - h * 0.5), y + (x + 0.35 - Math.max(x0, x + 0.35 - h * 0.5)) * 2); } ctx.stroke(); ctx.globalAlpha = 1;
      if (s > 10) {
        ctx.lineWidth = Math.max(0.02, env.px * 0.5); ctx.beginPath(); ctx.moveTo(vx0, y + 0.08); ctx.lineTo(vx1, y + 0.08); ctx.moveTo(vx0, y + h * 0.5); ctx.lineTo(vx1, y + h * 0.5); ctx.stroke();
        ctx.fillStyle = colH; ctx.beginPath(); for (let x = x0; x <= x1 + 0.01; x += 3) { if (x < vx0 - 1 || x > vx1 + 1) continue; ctx.rect(x - 0.07, y + h + 0.2, 0.14, 0.09); ctx.rect(x - 0.03, y, 0.02, h + 0.2); } ctx.fill();
      }
    }
  } });
  if (o.kind === 'wood') P.solid(x0, y, x1 - x0, h, 'thin'); else if (o.kind === 'wall') P.solid(x0, y, x1 - x0, h, 'wall');
};

// A shootable light. When it dies the area it lit goes dark.
//   o.col      colour of the light (default a warm sodium yellow)
//   o.pool     false leaves out the pool on the ground (for a lamp that stands on a roof edge, say)
//   o.cone     false leaves out the cone in the air
//   o.style    'post' draws a plain bracket lamp without the scroll work. The scroll-work street
//              lamp belongs on a city pavement only: anywhere else pick the fitting that would
//              really be there (see kxLampKit below: 'harbour', 'deck', 'wall', 'mast', 'flood',
//              'site', 'terrace'). The style changes the picture only, never the light or its place.
// The light fades with distance exactly as S.lightAt does: full to 0.3 of the reach, gone at 1.3.
K.lamp = function (S, P, x, h, zone, o) {
  o = o || {}; const y = o.y || 0, post = S.tone('#20242b', P);
  const arm = o.arm === undefined ? 0.9 : o.arm;
  const postHi = S.tone('#414855', P), lc = o.col || '#ffe196', glassOn = lighten(lc, 0.55), wet = S.weather === 'rain' || S.weather === 'storm', foggy = S.weather === 'fog';
  let kit = null;
  const ob = S.obj({ kind: 'lamp', id: o.id, plane: P, x: x + arm, y: y + h - 0.12, r: o.r || 0.3, zone, on: true, mat: 'glass', layer: 2, reach: o.reach || 9,
    draw(ctx, env) {
      if (kit && kit.ride) { ctx.save(); kit.ride(ctx, env); }
      kxLampDraw(ctx, env);
      if (kit && kit.ride) ctx.restore();
    } });
  function kxLampDraw(ctx, env) {
      const s = env.s, lx = ob.x, ly = ob.y, live = ob.alive && ob.on !== false && !(kit && kit.dim && kit.dim()), dir = arm >= 0 ? 1 : -1, dark = S.pal.dark, lit = live && dark > 0.3;
      // ---- light first, so the ironwork stands in front of its own glow ----
      if (lit) {
        const R1 = 1.3 * (ob.reach || 9), e = kxSee(env, P), tilt = kxTilt(e, P, y);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const mist = (wet || foggy) && s > 5 && ly - y > 1.5, cA = (wet ? 0.3 : foggy ? 0.36 : 0.2) * dark;
        // the cone, with the rain or mist lit up in the beam baked into the same picture
        if (o.cone !== false && ly - y > 0.6) {
          const ch = ly - y - 0.05, sp = mist ? kxConeMist(lc, wet ? 0.53 : 0.44) : kxCone(lc);
          ctx.globalAlpha = Math.min(1, mist ? cA * 1.5 : cA);
          kxLight(ctx, 'cone' + lc + mist + R1 + ch, lx - R1, y, R1 * 2, ch, (g) => kxConeAt(g, sp, lx, y, R1, ch, mist));
        }
        if (o.pool !== false && tilt > 0.01) { const ry = e.ok ? Math.min(R1 * 0.5, ((e.ey - y) * R1) / Math.max(8, P.z - e.ez - R1)) : R1 * tilt; ctx.globalAlpha = Math.min(1, (wet ? 0.3 : 0.36) * dark); const b0 = Math.max(y - ry, P._kxLo === undefined ? -1e9 : P._kxLo), r0 = ((b0 - (y - ry)) / (2 * ry)) * 96, sp = kxPool(lc); if (r0 < 95) kxLight(ctx, 'pool' + lc + R1 + ry.toFixed(3) + r0.toFixed(1), lx - R1, b0, R1 * 2, y + ry - b0, (g) => g.drawImage(sp, 0, r0, 96, 96 - r0, lx - R1, b0, R1 * 2, y + ry - b0)); }
        { ctx.globalAlpha = Math.min(1, 0.5 * dark); ctx.drawImage(kxBlob(lc), lx - 1.9, ly - 1.9, 3.8, 3.8); }
        if (mist) {
          if (o.cone === false) { ctx.globalAlpha = 0.16 * dark; ctx.drawImage(kxBlob(lc), lx - R1 * 0.5, y + (ly - y) * 0.15, R1, (ly - y) * 0.95); }
          // drops flash as they fall through the beam
          if (wet) {
            ctx.globalAlpha = 0.5 * dark; ctx.strokeStyle = glassOn; ctx.lineWidth = Math.max(0.018, env.px * 0.7); ctx.beginPath();
            const slant = clamp((env.wind || 0) * 0.07, -0.6, 0.6);
            for (let i = 0; i < 16; i++) {
              const ph = env.t * (1.7 + (i % 5) * 0.23) + i * 0.37, c = Math.floor(ph), u = ph - c, v = kxH(i * 3.3, c), hh = ly - y;
              const fy = ly - 0.3 - u * (hh - 0.3), half = (0.05 + 0.5 * (1 - (fy - y) / hh)) * R1 * 0.75, fx = lx + (v * 2 - 1) * half;
              ctx.moveTo(fx, fy); ctx.lineTo(fx + slant * 0.5, fy - 0.42);
            }
            ctx.stroke();
          }
        }
        ctx.restore();
      }
      // ---- a fitting other than the street lamp ----
      if (kit) { kit.draw(ctx, env, live); return; }
      // ---- the post ----
      if (s < 7) {
        line(ctx, x, y, x, y + h, post, 0.14, env);
        if (arm) line(ctx, x, y + h, x + arm, y + h, post, 0.1, env);
        circ(ctx, lx, ly, 0.2, live ? '#fff3c4' : '#2a2e36');
        return;
      }
      const top = arm ? y + h - 0.32 : ly - 0.34;
      ctx.fillStyle = post; ctx.beginPath();
      ctx.rect(x - 0.2, y, 0.4, 0.1); ctx.rect(x - 0.15, y + 0.1, 0.3, 0.42); ctx.rect(x - 0.18, y + 0.52, 0.36, 0.07);
      ctx.moveTo(x - 0.09, y + 0.59); ctx.lineTo(x + 0.09, y + 0.59); ctx.lineTo(x + 0.05, top); ctx.lineTo(x - 0.05, top); ctx.closePath();
      ctx.rect(x - 0.08, y + Math.min(h * 0.45, 2.2), 0.16, 0.06); ctx.rect(x - 0.075, top - 0.09, 0.15, 0.09);
      ctx.fill();
      if (s > 14) { ctx.fillStyle = postHi; ctx.beginPath(); ctx.moveTo(x - 0.09, y + 0.59); ctx.lineTo(x - 0.05, y + 0.59); ctx.lineTo(x - 0.028, top); ctx.lineTo(x - 0.05, top); ctx.closePath(); ctx.rect(x - 0.15, y + 0.1, 0.05, 0.42); ctx.rect(x - 0.2, y + 0.07, 0.4, 0.03); ctx.fill(); }
      if (arm) {
        // the bracket: a swan neck up and over to the lantern, with a scroll in the crook
        ctx.strokeStyle = post; ctx.lineWidth = Math.max(0.075, env.px * 0.9); ctx.lineCap = 'round'; ctx.beginPath();
        ctx.moveTo(x, top); ctx.bezierCurveTo(x, y + h + 0.5, x + arm * 0.95, y + h + 0.62, lx, ly + 0.3);
        ctx.stroke();
        if (s > 12 && o.style !== 'post') { ctx.lineWidth = Math.max(0.035, env.px * 0.6); ctx.beginPath(); ctx.moveTo(x, top - 0.5); ctx.quadraticCurveTo(x + arm * 0.55, top - 0.35, x + arm * 0.6, y + h + 0.28); ctx.moveTo(x + arm * 0.33, top + 0.02); ctx.arc(x + arm * 0.24, top + 0.02, Math.abs(arm) * 0.09, 0, TAU); ctx.stroke(); }
        ctx.lineCap = 'butt';
      }
      // ---- the lantern, centred on the spot a bullet has to find ----
      const broken = !ob.alive;
      poly(ctx, [lx - 0.27, ly + 0.11, lx + 0.27, ly + 0.11, lx + 0.11, ly + 0.25, lx - 0.11, ly + 0.25], post);
      R4(ctx, lx - 0.045, ly + 0.25, 0.09, 0.07, post);
      if (!broken) {
        poly(ctx, [lx - 0.22, ly + 0.11, lx + 0.22, ly + 0.11, lx + 0.15, ly - 0.2, lx - 0.15, ly - 0.2], live ? '#fff3c4' : S.tone('#39414d', P));
        if (live) { circ(ctx, lx, ly - 0.03, 0.1, '#ffffff'); }
        else if (s > 12) poly(ctx, [lx - 0.17, ly + 0.08, lx - 0.08, ly + 0.08, lx - 0.1, ly - 0.17, lx - 0.13, ly - 0.17], 'rgba(200,225,255,0.22)');
        if (s > 20) { ctx.fillStyle = post; ctx.beginPath(); ctx.rect(lx - 0.012, ly - 0.2, 0.024, 0.31); ctx.moveTo(lx - 0.22, ly + 0.11); ctx.lineTo(lx - 0.2, ly + 0.11); ctx.lineTo(lx - 0.135, ly - 0.2); ctx.lineTo(lx - 0.15, ly - 0.2); ctx.closePath(); ctx.moveTo(lx + 0.22, ly + 0.11); ctx.lineTo(lx + 0.2, ly + 0.11); ctx.lineTo(lx + 0.135, ly - 0.2); ctx.lineTo(lx + 0.15, ly - 0.2); ctx.closePath(); ctx.fill(); }
      } else {
        // shot out: jagged glass left in the frame, the dead bulb holder, a strut bent outwards
        ctx.fillStyle = 'rgba(190,215,240,0.4)'; ctx.beginPath();
        ctx.moveTo(lx - 0.22, ly + 0.11); ctx.lineTo(lx - 0.1, ly + 0.11); ctx.lineTo(lx - 0.17, ly - 0.02); ctx.lineTo(lx - 0.13, ly - 0.08); ctx.lineTo(lx - 0.19, ly - 0.14); ctx.closePath();
        ctx.moveTo(lx + 0.22, ly + 0.11); ctx.lineTo(lx + 0.13, ly + 0.11); ctx.lineTo(lx + 0.16, ly + 0.02); ctx.lineTo(lx + 0.2, ly - 0.04); ctx.closePath();
        ctx.moveTo(lx - 0.15, ly - 0.2); ctx.lineTo(lx - 0.04, ly - 0.2); ctx.lineTo(lx - 0.1, ly - 0.11); ctx.closePath();
        ctx.fill();
        R4(ctx, lx - 0.04, ly - 0.02, 0.08, 0.13, S.tone('#3a3f48', P)); R4(ctx, lx - 0.025, ly - 0.07, 0.05, 0.05, S.tone('#15171b', P));
        ctx.strokeStyle = post; ctx.lineWidth = Math.max(0.025, env.px * 0.6); ctx.beginPath(); ctx.moveTo(lx + 0.2, ly + 0.11); ctx.lineTo(lx + 0.24, ly - 0.08); ctx.lineTo(lx + 0.3, ly - 0.22); ctx.moveTo(lx - 0.2, ly + 0.11); ctx.lineTo(lx - 0.15, ly - 0.2); ctx.stroke();
      }
      R4(ctx, lx - 0.17, ly - 0.235, 0.34, 0.04, post);
      if (!broken) R4(ctx, lx - 0.04, ly - 0.29, 0.08, 0.06, post);
  }
  if (o.style && o.style !== 'post') kit = kxLampKit(S, P, ob, o, x, y, h, arm);
  ob.baseY = y; ob.postX = x; ob.poolK = o.pool === false ? 0 : 1;
  return ob;
};

// ---- lamps that are not street lamps ------------------------------------------------------------
// Each fitting keeps the light exactly where the gameplay lamp is (ob.x, ob.y, the spot a bullet
// has to find, no bigger and no smaller than before) and changes only what holds it up:
//   'harbour'  a dock lamp: a plain steel standard with a braced arm and an enamel dome shade.
//              o.wood puts it on a tarred timber post instead (piers and jetties)
//   'deck'     a boat's deck light: a slim pole bolted to the deck with a floodlight on a yoke.
//              o.paint 'stainless' (a yacht) or 'steel' (a working boat, the default)
//   'wall'     the same floodlight on a bracket fixed to a wall at the top of the post line;
//              nothing reaches down to the floor
//   'mast'     an all-round lantern at the head of a short mast stepped on a cabin roof.
//              o.noPole when the boat already draws the mast. o.ride(ctx, env) moves the
//              picture with the boat (a sinking one), o.dim() says when its power has gone
//   'flood'    a floodlight on a galvanised pole. o.base 'ballast' stands it on a flat roof on a
//              weighted foot; otherwise it is set in a concrete footing in the ground
//   'site'     a builder's work light: a yellow lamp on a scaffold tube with a sandbag on its
//              foot. o.foot starts the tube higher up, clamped to something already there
//   'terrace'  a modern lantern on a slim square post, for a hotel roof terrace
// Returns { draw(ctx, env, live), ride, dim } or null for an unknown style.
function kxLampKit(S, P, ob, o, x, y, h, arm) {
  const st = o.style, T = (c, l) => S.tone(c, P, l), dir = arm >= 0 ? 1 : -1, yt = y + h;
  const snowy = S.time === 'snow' || S.weather === 'snow', snowC = T('#f1f4f7');
  const glassOff = T('#39414d'), glassOn = '#fff3c4', shard = 'rgba(190,215,240,0.45)', ink = T('#15171b');
  // the floodlight head shared by several fittings: a box housing with its lens on the underside,
  // tilted toward where it shines, hung in a yoke from the end of its arm
  const head = (ctx, env, lx, ly, w, hh, tilt, body, bodyHi, live, yoke) => {
    const s = env.s, broken = !ob.alive;
    ctx.save(); ctx.translate(lx, ly); ctx.rotate(tilt);
    if (yoke && s > 5) { ctx.strokeStyle = body; ctx.lineWidth = Math.max(0.03, env.px * 0.7); ctx.beginPath(); ctx.moveTo(-w * 0.42, 0); ctx.lineTo(-w * 0.42, hh * 0.5 + 0.08); ctx.lineTo(w * 0.42, hh * 0.5 + 0.08); ctx.lineTo(w * 0.42, 0); ctx.stroke(); }
    R4(ctx, -w / 2, -hh / 2, w, hh, body);
    if (s > 9) { R4(ctx, -w / 2, hh / 2 - Math.max(0.02, env.px * 0.7), w, Math.max(0.02, env.px * 0.7), bodyHi); ctx.fillStyle = bodyHi; ctx.beginPath(); for (let i = 1; i < 4; i++) ctx.rect(-w / 2 + (i * w) / 4 - 0.01, hh / 2, 0.02, 0.05); ctx.fill(); }   // cooling fins on the back
    const lw = w - 0.05, lh = Math.max(hh * 0.34, env.px * 1.2);
    if (!broken) { R4(ctx, -lw / 2, -hh / 2 - 0.01, lw, lh, live ? glassOn : glassOff); if (live && s > 6) R4(ctx, -lw * 0.3, -hh / 2 - 0.01, lw * 0.6, lh * 0.55, '#ffffff'); }
    else { R4(ctx, -lw / 2, -hh / 2 - 0.01, lw, lh, ink); ctx.fillStyle = shard; ctx.beginPath(); ctx.moveTo(-lw / 2, -hh / 2); ctx.lineTo(-lw * 0.2, -hh / 2); ctx.lineTo(-lw * 0.36, -hh / 2 + lh); ctx.closePath(); ctx.moveTo(lw / 2, -hh / 2); ctx.lineTo(lw * 0.28, -hh / 2); ctx.lineTo(lw * 0.42, -hh / 2 + lh * 0.9); ctx.closePath(); ctx.fill(); }
    if (snowy && s > 5) R4(ctx, -w / 2 - 0.02, hh / 2, w + 0.04, 0.06, snowC);
    ctx.restore();
  };
  let draw = null;
  if (st === 'harbour') {
    const wood = !!o.wood, pole = T(wood ? '#3b3026' : '#2c3a36'), poleHi = T(wood ? '#5a4a3a' : '#4a5e58'), poleLo = T(wood ? '#2a221b' : '#1f2a27'), iron = T('#20242b'), shade = T('#2f4a3f'), shadeHi = T('#4d6e60'), enamel = T('#e9e4d6');
    draw = (ctx, env, live) => {
      const s = env.s, lx = ob.x, ly = ob.y, broken = !ob.alive, armY = ly + 0.14;
      if (s < 6) {
        line(ctx, x, y, x, yt + 0.06, pole, wood ? 0.22 : 0.14, env);
        if (arm) line(ctx, x, armY, lx, armY, iron, 0.08, env);
        poly(ctx, [lx - 0.3, ly - 0.04, lx + 0.3, ly - 0.04, lx + 0.1, ly + 0.14, lx - 0.1, ly + 0.14], shade);
        circ(ctx, lx, ly - 0.1, 0.11, live ? glassOn : '#2a2e36');
        return;
      }
      if (wood) { // a tarred timber post with iron bands, its top cut on the slant to shed the rain
        R4(ctx, x - 0.12, y, 0.24, yt + 0.02 - y, pole); R4(ctx, x + 0.05, y, 0.07, yt + 0.02 - y, poleLo);
        poly(ctx, [x - 0.12, yt + 0.02, x + 0.12, yt + 0.02, x + 0.12, yt + 0.07, x - 0.12, yt + 0.12], poleHi);
        ctx.fillStyle = iron; ctx.beginPath(); ctx.rect(x - 0.13, y + 0.9, 0.26, 0.06); ctx.rect(x - 0.13, yt - 0.62, 0.26, 0.06); ctx.fill();
        if (s > 14) { ctx.fillStyle = poleHi; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.rect(x - 0.08, y + 0.2, 0.012, h * 0.7); ctx.rect(x - 0.02, y + 1.4, 0.012, h * 0.5); ctx.fill(); ctx.globalAlpha = 1; }
      } else { // a plain steel standard: a cast base with a door in it, a collar, a tapering shaft, a cap
        R4(ctx, x - 0.22, y, 0.44, 0.06, poleLo);
        poly(ctx, [x - 0.14, y + 0.06, x + 0.14, y + 0.06, x + 0.1, y + 0.9, x - 0.1, y + 0.9], pole);
        poly(ctx, [x - 0.075, y + 0.9, x + 0.075, y + 0.9, x + 0.05, yt, x - 0.05, yt], pole);
        R4(ctx, x - 0.11, y + 0.88, 0.22, 0.05, poleLo); R4(ctx, x - 0.08, yt - 0.02, 0.16, 0.08, poleLo);
        if (s > 12) { poly(ctx, [x - 0.075, y + 0.93, x - 0.04, y + 0.93, x - 0.028, yt, x - 0.05, yt], poleHi); ctx.strokeStyle = poleHi; ctx.lineWidth = Math.max(0.012, env.px * 0.5); ctx.strokeRect(x - 0.05, y + 0.28, 0.1, 0.32); }
      }
      if (arm) { // a straight arm with a stay under it, and the shade hung from its end
        ctx.strokeStyle = iron; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(0.06, env.px * 0.9); ctx.beginPath(); ctx.moveTo(x, armY); ctx.lineTo(lx, armY); ctx.stroke();
        ctx.lineWidth = Math.max(0.035, env.px * 0.7); ctx.beginPath(); ctx.moveTo(x, armY - 0.6); ctx.lineTo(x + arm * 0.6, armY); ctx.stroke(); ctx.lineCap = 'butt';
        if (s > 12) circ(ctx, x + arm * 0.6, armY, 0.035, poleHi);
      }
      // the enamel dome: dark green outside, white inside, the lamp under its rim
      poly(ctx, [lx - 0.32, ly - 0.04, lx + 0.32, ly - 0.04, lx + 0.11, ly + 0.12, lx - 0.11, ly + 0.12], shade);
      R4(ctx, lx - 0.04, ly + 0.12, 0.08, armY - ly - 0.1, iron);
      if (s > 10) { poly(ctx, [lx - 0.32, ly - 0.04, lx - 0.22, ly - 0.04, lx - 0.06, ly + 0.12, lx - 0.11, ly + 0.12], shadeHi); R4(ctx, lx - 0.31, ly - 0.07, 0.62, 0.03, live ? T('#fff3d0', true) : enamel); }
      if (!broken) {
        circ(ctx, lx, ly - 0.1, 0.075, live ? '#ffffff' : glassOff);
        if (live) { ctx.globalAlpha = 0.7; circ(ctx, lx, ly - 0.1, 0.11, glassOn); ctx.globalAlpha = 1; circ(ctx, lx, ly - 0.1, 0.06, '#ffffff'); }
        if (s > 16) { ctx.strokeStyle = iron; ctx.lineWidth = Math.max(0.01, env.px * 0.5); ctx.beginPath(); ctx.moveTo(lx - 0.13, ly - 0.05); ctx.quadraticCurveTo(lx, ly - 0.32, lx + 0.13, ly - 0.05); ctx.moveTo(lx, ly - 0.05); ctx.lineTo(lx, ly - 0.22); ctx.stroke(); }
      } else { R4(ctx, lx - 0.03, ly - 0.08, 0.06, 0.05, ink); ctx.fillStyle = shard; ctx.beginPath(); ctx.moveTo(lx - 0.07, ly - 0.06); ctx.lineTo(lx - 0.02, ly - 0.06); ctx.lineTo(lx - 0.06, ly - 0.15); ctx.closePath(); ctx.fill(); }
    };
  } else if (st === 'deck' || st === 'wall') {
    const ss = o.paint === 'stainless', pole = T(ss ? '#c9ced3' : '#3a4048'), poleHi = T(ss ? '#eef1f3' : '#58606a'), poleLo = T(ss ? '#8d949a' : '#23282e'), body = T(ss ? '#d9dde0' : '#2c3138'), bodyHi = T(ss ? '#f4f6f7' : '#4a515a');
    const thick = st === 'deck' && !ss ? 0.09 : 0.06;
    draw = (ctx, env, live) => {
      const s = env.s, lx = ob.x, ly = ob.y, armY = ly + 0.1, wall = st === 'wall';
      if (!wall) {
        if (s < 5) { line(ctx, x, y, x, armY, pole, thick + 0.02, env); if (arm) line(ctx, x, armY, lx, armY, pole, 0.06, env); R4(ctx, lx - 0.17, ly - 0.07, 0.34, 0.16, body); circ(ctx, lx, ly - 0.08, 0.1, live ? glassOn : '#2a2e36'); return; }
        // the foot bolted to the deck, the pole with a clamp half way, a stay down to the deck
        R4(ctx, x - 0.13, y, 0.26, 0.035, poleLo); R4(ctx, x - 0.07, y + 0.035, 0.14, 0.06, pole);
        R4(ctx, x - thick / 2, y, thick, armY + 0.04 - y, pole);
        if (s > 10) { R4(ctx, x - thick / 2, y, Math.max(0.012, thick * 0.3), armY - y, poleHi); R4(ctx, x - thick / 2 - 0.015, y + h * 0.5, thick + 0.03, 0.05, poleLo); }
        if (!ss && s > 6) line(ctx, x, y + h * 0.62, x - dir * 0.9, y + 0.02, poleLo, 0.02, env);
      } else {
        if (s < 5) { if (arm) line(ctx, x, armY, lx, armY, pole, 0.06, env); R4(ctx, lx - 0.17, ly - 0.07, 0.34, 0.16, body); circ(ctx, lx, ly - 0.08, 0.1, live ? glassOn : '#2a2e36'); return; }
        // a plate screwed to the wall, an arm with a stay under it
        R4(ctx, x - 0.05, armY - 0.2, 0.1, 0.32, poleLo); if (s > 12) { circ(ctx, x, armY - 0.14, 0.015, poleHi); circ(ctx, x, armY + 0.06, 0.015, poleHi); }
        if (arm) line(ctx, x, armY - 0.18, x + arm * 0.55, armY, pole, 0.03, env);
      }
      if (arm) { line(ctx, x, armY, lx, armY, pole, 0.05, env); if (s > 10) R4(ctx, lx - 0.03, armY - 0.03, 0.06, 0.07, poleLo); }
      head(ctx, env, lx, ly - 0.04, 0.44, 0.22, dir * 0.35, body, bodyHi, live, true);
    };
  } else if (st === 'mast') {
    const mc = T(o.paint === 'stainless' ? '#c9ced3' : '#2a3038'), mcHi = T('#4a525c'), brass = T('#8a7650'), cap = T('#1c2026');
    draw = (ctx, env, live) => {
      const s = env.s, lx = ob.x, ly = ob.y, broken = !ob.alive, top = ly - 0.2;
      if (!o.noPole) { // a short mast on a foot, with a crosstree and its stays
        poly(ctx, [x - 0.06, y, x + 0.06, y, x + 0.04, top, x - 0.04, top], mc);
        if (s > 4) { const ym = y + (top - y) * 0.62; R4(ctx, x - 0.4, ym, 0.8, 0.05, mc); line(ctx, x - 0.4, ym, x - 0.6, y, mcHi, 0.015, env); line(ctx, x + 0.4, ym, x + 0.6, y, mcHi, 0.015, env); R4(ctx, x - 0.13, y, 0.26, 0.08, cap); }
      }
      if (s < 5) { R4(ctx, lx - 0.13, ly - 0.16, 0.26, 0.3, live ? glassOn : glassOff); R4(ctx, lx - 0.15, ly + 0.14, 0.3, 0.08, cap); return; }
      // the lantern: a ring at its foot, a ribbed glass drum, a cap with a vent, an aerial above
      R4(ctx, lx - 0.15, top, 0.3, 0.05, brass);
      if (!broken) {
        R4(ctx, lx - 0.12, top + 0.05, 0.24, 0.28, live ? glassOn : glassOff);
        if (live) circ(ctx, lx, ly - 0.01, 0.07, '#ffffff');
        if (s > 11) { ctx.fillStyle = live ? 'rgba(160,120,40,0.55)' : cap; ctx.beginPath(); ctx.rect(lx - 0.065, top + 0.05, 0.016, 0.28); ctx.rect(lx + 0.05, top + 0.05, 0.016, 0.28); ctx.rect(lx - 0.12, ly - 0.02, 0.24, 0.018); ctx.fill(); }
      } else { R4(ctx, lx - 0.12, top + 0.05, 0.24, 0.06, ink); ctx.fillStyle = shard; ctx.beginPath(); ctx.moveTo(lx - 0.12, top + 0.05); ctx.lineTo(lx - 0.04, top + 0.05); ctx.lineTo(lx - 0.1, top + 0.2); ctx.closePath(); ctx.moveTo(lx + 0.12, top + 0.05); ctx.lineTo(lx + 0.06, top + 0.05); ctx.lineTo(lx + 0.11, top + 0.16); ctx.closePath(); ctx.fill(); }
      poly(ctx, [lx - 0.15, top + 0.33, lx + 0.15, top + 0.33, lx + 0.07, top + 0.43, lx - 0.07, top + 0.43], cap);
      R4(ctx, lx - 0.03, top + 0.43, 0.06, 0.05, cap);
      if (s > 7) line(ctx, lx + 0.02, top + 0.48, lx + 0.02, top + 1.5, cap, 0.012, env);
    };
  } else if (st === 'flood') {
    const ballast = o.base === 'ballast', galv = T('#7d858c'), galvHi = T('#a6adb3'), galvLo = T('#555c63'), conc = T('#8a857c'), concD = T('#6a665e'), body = T('#30353c'), bodyHi = T('#515861'), cable = T('#1a1d22');
    const hw = Math.max(0.46, (ob.r || 0.3) * 1.45), hh = hw * 0.55;
    draw = (ctx, env, live) => {
      const s = env.s, lx = ob.x, ly = ob.y, armY = arm ? ly + 0.12 : ly - hh * 0.6;
      if (s < 5) { line(ctx, x, y, x, armY, galv, 0.13, env); if (arm) line(ctx, x, armY, lx, armY, galv, 0.07, env); R4(ctx, lx - hw / 2, ly - hh / 2, hw, hh, body); circ(ctx, lx, ly - hh * 0.35, Math.min(0.14, hw * 0.3), live ? glassOn : '#2a2e36'); return; }
      if (ballast) { // a steel foot frame weighed down with two concrete blocks, struts up to the pole
        R4(ctx, x - 0.62, y, 1.24, 0.06, galvLo); R4(ctx, x - 0.62, y + 0.06, 0.34, 0.2, conc); R4(ctx, x + 0.28, y + 0.06, 0.34, 0.2, conc);
        if (s > 9) { R4(ctx, x - 0.62, y + 0.06, 0.34, 0.04, concD); R4(ctx, x + 0.28, y + 0.06, 0.34, 0.04, concD); }
        line(ctx, x - 0.4, y + 0.06, x - 0.04, y + 0.75, galvLo, 0.035, env); line(ctx, x + 0.4, y + 0.06, x + 0.04, y + 0.75, galvLo, 0.035, env);
      } else { R4(ctx, x - 0.22, y, 0.44, 0.16, conc); if (s > 9) R4(ctx, x - 0.22, y + 0.12, 0.44, 0.04, concD); }
      R4(ctx, x - 0.06, y + 0.06, 0.12, armY + 0.05 - y - 0.06, galv);
      if (s > 9) { R4(ctx, x + 0.025, y + 0.06, 0.035, armY - y - 0.06, galvLo); R4(ctx, x - 0.06, y + 0.06, 0.02, armY - y - 0.06, galvHi); }
      if (s > 11) { R4(ctx, x - dir * 0.09 - 0.012, y + 0.2, 0.024, armY - y - 0.4, cable); ctx.fillStyle = galvLo; ctx.beginPath(); for (let yy = y + 0.6; yy < armY - 0.3; yy += 0.9) ctx.rect(x - dir * 0.09 - 0.03, yy, 0.06, 0.03); ctx.fill(); }
      if (snowy && s > 5) R4(ctx, x - 0.09, armY + 0.05, 0.18, 0.05, snowC);
      if (arm) { R4(ctx, Math.min(x, lx), armY - 0.035, Math.abs(lx - x), 0.07, galv); if (snowy && s > 5) R4(ctx, Math.min(x, lx), armY + 0.035, Math.abs(lx - x), 0.04, snowC); }
      head(ctx, env, lx, ly, hw, hh, arm ? dir * 0.45 : 0, body, bodyHi, live, true);
    };
  } else if (st === 'site') {
    const tubeC = T('#9aa0a6'), tubeLo = T('#6c737a'), coup = T('#3a3f47'), sole = T('#8a6a45'), bag = T('#8f7f55'), bagD = T('#6f6142'), yel = mix(T('#e0a422'), T('#e0a422', true), 0.55), yelHi = mix(T('#f2c552'), T('#f2c552', true), 0.55), cable = T('#16181c');   // the yellow box catches its own light
    const foot = y + (o.foot || 0);
    draw = (ctx, env, live) => {
      const s = env.s, lx = ob.x, ly = ob.y, armY = arm ? ly + 0.16 : ly - 0.12;
      if (s < 5) { line(ctx, x, foot, x, armY, tubeC, 0.08, env); if (arm) line(ctx, x, armY, lx, armY, tubeC, 0.06, env); R4(ctx, lx - 0.2, ly - 0.12, 0.4, 0.26, yel); circ(ctx, lx, ly - 0.08, 0.1, live ? glassOn : '#2a2e36'); return; }
      R4(ctx, x - 0.03, foot, 0.06, armY + 0.04 - foot, tubeC);
      if (s > 10) R4(ctx, x + 0.012, foot, 0.018, armY - foot, tubeLo);
      if (s > 7) { ctx.fillStyle = coup; ctx.beginPath(); for (let yy = foot + 1.5; yy < armY - 0.3; yy += 1.6) ctx.rect(x - 0.05, yy, 0.1, 0.07); ctx.fill(); }
      if (!o.foot) { // a base plate on a sole board, and a sandbag to stop it walking
        R4(ctx, x - 0.32, y, 0.64, 0.05, sole); R4(ctx, x - 0.09, y + 0.05, 0.18, 0.025, coup);
        if (s > 6) { ctx.fillStyle = bag; ctx.beginPath(); ctx.ellipse(x + dir * 0.2, y + 0.13, 0.16, 0.08, 0, 0, TAU); ctx.ellipse(x - dir * 0.18, y + 0.12, 0.14, 0.07, 0, 0, TAU); ctx.fill(); if (s > 12) { R4(ctx, x + dir * 0.2 - 0.12, y + 0.12, 0.24, 0.015, bagD); } }
      } else { R4(ctx, x - 0.07, foot - 0.04, 0.14, 0.1, coup); R4(ctx, x - 0.07, foot + 0.3, 0.14, 0.08, coup); }
      if (arm) { R4(ctx, Math.min(x, lx), armY - 0.025, Math.abs(lx - x), 0.05, tubeC); R4(ctx, x - 0.05, armY - 0.05, 0.1, 0.1, coup); }
      if (s > 6) { ctx.strokeStyle = cable; ctx.lineWidth = Math.max(0.02, env.px * 0.6); ctx.beginPath(); ctx.moveTo(lx + dir * 0.12, ly - 0.1); ctx.quadraticCurveTo(lx + dir * 0.1, armY - 0.75, x + 0.04, armY - 0.55); ctx.lineTo(x + 0.04, foot + 0.15); ctx.stroke(); }   // its cable, looped back and taped down the tube
      // the work light: a yellow cast box in a tube frame with a handle over it
      head(ctx, env, lx, ly, 0.42, 0.28, arm ? dir * 0.4 : 0, yel, yelHi, live, false);
      if (s > 7) { ctx.strokeStyle = coup; ctx.lineWidth = Math.max(0.018, env.px * 0.6); ctx.beginPath(); ctx.moveTo(lx - 0.24, ly - 0.16); ctx.lineTo(lx - 0.24, ly + 0.2); ctx.lineTo(lx + 0.24, ly + 0.2); ctx.lineTo(lx + 0.24, ly - 0.16); ctx.stroke(); }
    };
  } else if (st === 'terrace') {
    const bronze = T('#3a342c'), bronzeHi = T('#5a5244'), frost = T('#e9e2cf', true);
    draw = (ctx, env, live) => {
      const s = env.s, lx = ob.x, ly = ob.y, broken = !ob.alive;
      R4(ctx, x - 0.13, y, 0.26, 0.06, bronze); R4(ctx, x - 0.045, y, 0.09, ly - 0.22 - y, bronze);
      if (s > 10) R4(ctx, x - 0.045, y + 0.06, 0.02, ly - 0.3 - y, bronzeHi);
      // the lantern: a slim box of frosted glass between a base and a flat cap
      R4(ctx, lx - 0.15, ly - 0.24, 0.3, 0.05, bronze); R4(ctx, lx - 0.18, ly + 0.2, 0.36, 0.05, bronze);
      if (!broken) { R4(ctx, lx - 0.12, ly - 0.19, 0.24, 0.39, live ? frost : glassOff); if (live) R4(ctx, lx - 0.05, ly - 0.12, 0.1, 0.25, '#ffffff'); if (s > 8) { R4(ctx, lx - 0.125, ly - 0.19, 0.025, 0.39, bronze); R4(ctx, lx + 0.1, ly - 0.19, 0.025, 0.39, bronze); } }
      else { R4(ctx, lx - 0.12, ly - 0.19, 0.24, 0.1, ink); ctx.fillStyle = shard; ctx.beginPath(); ctx.moveTo(lx - 0.12, ly - 0.09); ctx.lineTo(lx - 0.02, ly - 0.09); ctx.lineTo(lx - 0.1, ly + 0.08); ctx.closePath(); ctx.fill(); }
    };
  }
  if (!draw) return null;
  return { draw, ride: o.ride || null, dim: o.dim || null };
}

// A hanging load on a hook. Shoot the hook and it drops on whoever is below.
K.hang = function (S, P, x, yHook, kind, o) {
  o = o || {};
  const sz = { crate: [2.2, 1.8], piano: [2.6, 1.7], sign: [3.2, 1.3], ac: [1.4, 1.0], pallet: [2.6, 1.5], planter: [1.2, 0.8], lights: [3.4, 0.5], girder: [5, 0.5], net: [2.6, 2.2], boat: [5, 1.6] }[kind] || [2, 1.6];
  const drop = o.drop === undefined ? 1.8 : o.drop;
  const prop = { id: (o.id || 'load') + '_p', kind, plane: P, x, y: yHook - drop - sz[1], w: sz[0], h: sz[1], vy: 0, falling: false, landed: false, floor: o.floor || 0, col: o.col, text: o.text };
  S.props.push(prop);
  const top = o.top === undefined ? yHook + 8 : o.top, cable = S.tone('#1c1f25', P), yel = S.tone('#d6a12a', P), yelHi = S.tone('#f0c24a', P), yelLo = S.tone('#a87a1a', P), steel = S.tone('#20242b', P), steelHi = S.tone('#6c737a', P);
  const ob = S.obj({ kind: 'hook', id: o.id || 'hook', plane: P, x, y: yHook, r: o.r || 0.34, mat: 'metal', prop, layer: 2,
    draw(ctx, env) {
      const s = env.s;
      line(ctx, x, yHook, x, top, cable, 0.07, env);
      if (s > 14) { line(ctx, x + 0.07, yHook + 0.2, x + 0.07, top, cable, 0.03, env); }
      if (ob.alive) {
        ctx.strokeStyle = cable; ctx.lineWidth = Math.max(0.05, env.px * 0.7);
        ctx.beginPath(); ctx.moveTo(x, yHook - 0.3); ctx.lineTo(prop.x - prop.w * 0.42, prop.y + prop.h); ctx.moveTo(x, yHook - 0.3); ctx.lineTo(prop.x + prop.w * 0.42, prop.y + prop.h); ctx.stroke();
        if (s < 12) { R4(ctx, x - 0.2, yHook - 0.22, 0.4, 0.44, yel); R4(ctx, x - 0.11, yHook - 0.13, 0.22, 0.26, steel); return; }
        // the hook block: yellow cheek plates round a sheave, and the forged hook under it
        ctx.strokeStyle = steel; ctx.lineWidth = Math.max(0.07, env.px); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, yHook - 0.22); ctx.lineTo(x, yHook - 0.3); ctx.arc(x - 0.07, yHook - 0.36, 0.09, 0.3, Math.PI * 1.25, true); ctx.stroke(); ctx.lineCap = 'butt';
        ctx.fillStyle = yel; ctx.beginPath(); kxRR(ctx, x - 0.22, yHook - 0.24, 0.44, 0.48, 0.07); ctx.fill();
        R4(ctx, x - 0.22, yHook + 0.12, 0.44, 0.06, yelHi); R4(ctx, x - 0.22, yHook - 0.2, 0.44, 0.05, yelLo);
        circ(ctx, x, yHook, 0.13, steel); circ(ctx, x, yHook, 0.05, steelHi);
        if (s > 26) { ctx.fillStyle = steel; ctx.beginPath(); for (const q of [[-0.17, 0.18], [0.17, 0.18], [-0.17, -0.18], [0.17, -0.18]]) { ctx.moveTo(x + q[0] + 0.02, yHook + q[1]); ctx.arc(x + q[0], yHook + q[1], 0.02, 0, TAU); } ctx.fill(); R4(ctx, x - 0.2, yHook + 0.19, 0.12, 0.02, 'rgba(255,255,255,0.4)'); }
      } else if (s > 9) { // the cable end left swinging, strands sprung apart
        ctx.strokeStyle = cable; ctx.lineWidth = Math.max(0.02, env.px * 0.5); ctx.beginPath(); for (let i = -1; i <= 1; i++) { ctx.moveTo(x, yHook + 0.1); ctx.lineTo(x + i * 0.07, yHook - 0.12 - Math.abs(i) * 0.03); } ctx.stroke();
      }
    } });
  return ob;
};
function drawProp(ctx, env, S, p) {
  const P = p.plane, x = p.x - p.w / 2, y = p.y, w = p.w, h = p.h, s = env.s, fine = s > 12, T = (c, l) => S.tone(c, P, l);
  ctx.save();
  if (p.landed && p.kind !== 'girder') { ctx.translate(p.x, p.y); ctx.rotate(p.tilt || 0); ctx.translate(-p.x, -p.y); }
  if (p.landed && s > 4) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(p.x, y + 0.02, w * 0.56, 0.09, 0, 0, TAU); ctx.fill(); }
  if (p.kind === 'piano') {
    // an upright piano, roped for the hoist
    const c = T('#16171b'), c2 = T('#2c2e35'), ivory = T('#e8e4da');
    R4(ctx, x, y + h * 0.28, w, h * 0.72, c);
    R4(ctx, x + 0.1, y, 0.14, h * 0.3, c); R4(ctx, x + w - 0.24, y, 0.14, h * 0.3, c);
    R4(ctx, x - 0.1, y + h * 0.5, w + 0.2, h * 0.1, ivory);
    if (fine) {
      R4(ctx, x - 0.08, y + h - 0.07, w + 0.16, 0.09, c2);                                           // lid
      R4(ctx, x + 0.12, y + h * 0.66, w - 0.24, h * 0.26, c2); R4(ctx, x + 0.2, y + h * 0.7, w - 0.4, h * 0.18, c); // the panel above the keys
      R4(ctx, x - 0.1, y + h * 0.44, w + 0.2, h * 0.06, c2);                                         // key bed
      ctx.fillStyle = c; ctx.beginPath(); const nk = 30; for (let i = 0; i < nk; i++) { if (i % 7 === 2 || i % 7 === 6) continue; ctx.rect(x - 0.06 + ((i + 0.72) * (w + 0.12)) / nk, y + h * 0.54, (w / nk) * 0.5, h * 0.06); } ctx.fill();
      if (s > 26) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); for (let i = 1; i < nk; i++) ctx.rect(x - 0.06 + (i * (w + 0.12)) / nk, y + h * 0.5, 0.008, h * 0.1); ctx.fill(); }
      R4(ctx, x + 0.3, y + h * 0.28, w - 0.6, h * 0.06, c2); R4(ctx, x + w * 0.5 - 0.22, y + 0.06, 0.12, 0.05, T('#c9a23a')); R4(ctx, x + w * 0.5 + 0.1, y + 0.06, 0.12, 0.05, T('#c9a23a'));   // pedals
      R4(ctx, x + 0.06, y + h * 0.3, 0.05, h * 0.68, 'rgba(255,255,255,0.14)'); poly(ctx, [x + w * 0.55, y + h * 0.98, x + w * 0.7, y + h * 0.98, x + w * 0.62, y + h * 0.64, x + w * 0.5, y + h * 0.64], 'rgba(255,255,255,0.06)');
      const strap = T('#b9a27e'); R4(ctx, x + w * 0.2, y + h * 0.28, 0.1, h * 0.72, strap); R4(ctx, x + w * 0.8 - 0.1, y + h * 0.28, 0.1, h * 0.72, strap);
      circ(ctx, x + 0.17, y + 0.04, 0.05, c2); circ(ctx, x + w - 0.17, y + 0.04, 0.05, c2);
      if (p.landed) { ctx.fillStyle = ivory; for (let i = 0; i < 6; i++) ctx.fillRect(x + w * (0.1 + kxH(i, 3) * 0.9) + (kxH(i, 5) - 0.5) * 1.2, y + kxH(i, 7) * 0.08, 0.14, 0.035); poly(ctx, [x + w * 0.3, y + h, x + w * 0.42, y + h * 0.6, x + w * 0.46, y + h], 'rgba(0,0,0,0.5)'); }
    }
  } else if (p.kind === 'sign') {
    const lit = S.pal.dark > 0.3;
    R4(ctx, x, y, w, h, T(p.col || '#c0392b', true)); R4(ctx, x + 0.1, y + 0.1, w - 0.2, h - 0.2, T('#1b1e24'));
    if (fine) {
      // bulbs round the border and the two eyes it hangs from
      ctx.fillStyle = lit ? '#fff3c4' : T('#d8d2c2'); ctx.beginPath(); const n = Math.round(w / 0.3); for (let i = 0; i <= n; i++) { const bx = x + 0.05 + (i * (w - 0.1)) / n; ctx.rect(bx - 0.025, y + 0.025, 0.05, 0.05); ctx.rect(bx - 0.025, y + h - 0.075, 0.05, 0.05); } ctx.fill();
      R4(ctx, x + w * 0.08, y + h, 0.08, 0.14, T('#2a2e36')); R4(ctx, x + w * 0.92 - 0.08, y + h, 0.08, 0.14, T('#2a2e36'));
    }
    if (lit && s > 5) kxGlow(ctx, p.col || '#ff5a4d', p.x, y + h * 0.5, w * 0.7, 0.22 * S.pal.dark);
    env.text(ctx, p.text || 'HOTEL', p.x, y + h * 0.3, h * 0.5, T(p.col || '#ff5a4d', true), 'center');
  } else if (p.kind === 'ac') {
    const c = T('#c6ccd1'), d = T('#8d949a'), k = T('#5d6469');
    R4(ctx, x, y, w, h, c); R4(ctx, x + 0.1, y + 0.15, w - 0.2, h * 0.45, d);
    if (fine) {
      R4(ctx, x, y + h - 0.07, w, 0.07, 'rgba(255,255,255,0.3)'); R4(ctx, x + w - 0.14, y, 0.14, h, d); R4(ctx, x, y, w, 0.06, k);
      ctx.fillStyle = k; ctx.beginPath(); for (let i = 0; i < 6; i++) ctx.rect(x + 0.1, y + 0.18 + i * (h * 0.45 - 0.06) / 6, w - 0.34, 0.025); ctx.fill();
      ctx.strokeStyle = k; ctx.lineWidth = Math.max(0.03, env.px * 0.6); ctx.beginPath(); ctx.arc(x + w * 0.42, y + h * 0.38, h * 0.19, 0, TAU); ctx.moveTo(x + w * 0.42 - h * 0.19, y + h * 0.38); ctx.lineTo(x + w * 0.42 + h * 0.19, y + h * 0.38); ctx.moveTo(x + w * 0.42, y + h * 0.19); ctx.lineTo(x + w * 0.42, y + h * 0.57); ctx.stroke();
      R4(ctx, x + 0.1, y + h * 0.7, w * 0.3, h * 0.12, k); R4(ctx, x + w * 0.5, y + h * 0.72, 0.1, 0.06, T('#52e07a', true));
      R4(ctx, x + 0.08, y - 0.07, 0.16, 0.07, k); R4(ctx, x + w - 0.24, y - 0.07, 0.16, 0.07, k);
    }
  } else if (p.kind === 'planter') {
    const pot = T('#a5562f'), potD = T('#7d3f22'), potH = T('#c06e42');
    poly(ctx, [x + 0.06, y, x + w - 0.06, y, x + w, y + h * 0.6, x, y + h * 0.6], pot);
    if (fine) { R4(ctx, x - 0.03, y + h * 0.5, w + 0.06, h * 0.12, potH); R4(ctx, x - 0.03, y + h * 0.5, w + 0.06, 0.03, potD); poly(ctx, [x + w * 0.72, y, x + w - 0.06, y, x + w, y + h * 0.5, x + w * 0.76, y + h * 0.5], potD); }
    circ(ctx, p.x - 0.25, y + h * 0.8, 0.3, T('#4f8a4a')); circ(ctx, p.x + 0.25, y + h * 0.85, 0.33, T('#5c9a55'));
    if (fine) { circ(ctx, p.x, y + h * 0.95, 0.22, T('#6aa860')); ctx.fillStyle = T('#e86a8a'); ctx.beginPath(); for (let i = 0; i < 6; i++) { const fx = p.x - 0.42 + i * 0.17, fy = y + h * (0.86 + kxH(i, 2.2) * 0.26); ctx.moveTo(fx + 0.05, fy); ctx.arc(fx, fy, 0.05, 0, TAU); } ctx.fill(); }
  } else if (p.kind === 'girder') {
    // an I-beam: flanges catching the light, a darker web, stiffeners and bolt holes at the ends
    const web = T('#6a2c20'), fl = T('#8a3b2a'), flH = T('#a85040');
    R4(ctx, x, y, w, h, fl); R4(ctx, x, y + h * 0.3, w, h * 0.4, web);
    if (fine) {
      R4(ctx, x, y + h - 0.04, w, 0.04, flH); R4(ctx, x, y + h * 0.3 - 0.02, w, 0.02, 'rgba(0,0,0,0.3)');
      ctx.fillStyle = fl; ctx.beginPath(); for (let i = 1; i < 5; i++) ctx.rect(x + (i * w) / 5 - 0.03, y + h * 0.3, 0.06, h * 0.4); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); for (const ex of [x + 0.15, x + 0.33, x + w - 0.2, x + w - 0.38]) { ctx.rect(ex, y + h * 0.4, 0.05, 0.05); ctx.rect(ex, y + h * 0.56, 0.05, 0.05); } ctx.fill();
      ctx.fillStyle = 'rgba(60,20,10,0.35)'; ctx.fillRect(x + w * 0.22, y + h * 0.3, 0.5, h * 0.25); ctx.fillRect(x + w * 0.63, y + h * 0.42, 0.7, h * 0.28);
      env.text(ctx, 'W 8 x 31', x + w * 0.36, y + h * 0.36, h * 0.28, T('#e9dcc0'), 'left');
    }
  } else if (p.kind === 'pallet') {
    const wood = T('#8a6a45'), woodD = T('#6b5034');
    R4(ctx, x, y + 0.12, w, 0.06, wood); R4(ctx, x, y, w, 0.045, wood);
    ctx.fillStyle = woodD; ctx.beginPath(); for (let i = 0; i < 3; i++) ctx.rect(x + i * (w - 0.22) / 2, y + 0.045, 0.22, 0.075); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const bx = x + 0.1 + i * (w - 0.2) / 3, bw = (w - 0.2) / 3 - 0.08, c = i % 2 ? '#b9a27e' : '#a8916d';
      R4(ctx, bx, y + 0.18, bw, h - 0.2, T(c));
      if (fine) { R4(ctx, bx, y + 0.18 + (h - 0.2) * 0.5 - 0.01, bw, 0.02, T(darken(c, 0.25))); R4(ctx, bx + bw * 0.45, y + 0.18, bw * 0.1, h - 0.2, T(lighten(c, 0.18))); R4(ctx, bx + bw - 0.08, y + 0.18, 0.08, h - 0.2, 'rgba(0,0,0,0.14)'); R4(ctx, bx + bw * 0.12, y + 0.18 + (h - 0.2) * 0.62, bw * 0.26, (h - 0.2) * 0.16, T('#f1ede2')); }
    }
    if (fine) { R4(ctx, x + 0.04, y + 0.18 + (h - 0.2) * 0.28, w - 0.08, 0.035, T('#22262d')); R4(ctx, x + 0.04, y + 0.18 + (h - 0.2) * 0.8, w - 0.08, 0.035, T('#22262d')); }
  } else if (p.kind === 'boat') {
    const hull = T(p.col || '#e9e4d6'), hullD = T(darken(p.col || '#e9e4d6', 0.2)), red = T('#b3312b');
    poly(ctx, [x, y + h * 0.9, x + w, y + h * 0.9, x + w * 0.86, y, x + w * 0.1, y], hull);
    if (fine) { poly(ctx, [x + w * 0.035, y + h * 0.3, x + w * 0.955, y + h * 0.3, x + w * 0.86, y, x + w * 0.1, y], hullD); ctx.strokeStyle = hullD; ctx.lineWidth = Math.max(0.02, env.px * 0.5); ctx.beginPath(); for (let i = 1; i < 3; i++) { ctx.moveTo(x + w * 0.012 * i * 2, y + h * (0.3 + i * 0.2)); ctx.lineTo(x + w * (1 - 0.02 * i * 2.2), y + h * (0.3 + i * 0.2)); } ctx.stroke(); }
    R4(ctx, x + w * 0.05, y + h * 0.62, w * 0.9, 0.14, red);
    if (fine) { R4(ctx, x - 0.04, y + h * 0.88, w + 0.08, 0.09, T('#8a6a45')); R4(ctx, x + w * 0.45, y - 0.06, w * 0.12, 0.08, hullD); ctx.fillStyle = T('#8a6a45'); for (let i = 0; i < 3; i++) ctx.fillRect(x + w * (0.25 + i * 0.22), y + h * 0.9, 0.09, 0.14); env.text(ctx, 'No. 4', x + w * 0.14, y + h * 0.36, h * 0.16, T('#2a2e36'), 'left'); }
  } else if (p.kind === 'net') {
    // a cargo net full of sacks, drawn up tight at the top
    const sack = T('#7b6a4a'), sackD = T('#5d5038'), sackH = T('#94825e'), rope = T('#3a3024');
    ctx.fillStyle = sack; ctx.beginPath(); ctx.moveTo(x + w * 0.5, y + h); ctx.quadraticCurveTo(x - w * 0.08, y + h * 0.6, x + w * 0.06, y + h * 0.14); ctx.quadraticCurveTo(x + w * 0.5, y - h * 0.08, x + w * 0.94, y + h * 0.14); ctx.quadraticCurveTo(x + w * 1.08, y + h * 0.6, x + w * 0.5, y + h); ctx.fill();
    if (fine) {
      ctx.save(); ctx.clip();
      ctx.fillStyle = sackD; ctx.beginPath(); ctx.ellipse(x + w * 0.3, y + h * 0.2, w * 0.3, h * 0.14, 0.1, 0, TAU); ctx.ellipse(x + w * 0.72, y + h * 0.3, w * 0.28, h * 0.13, -0.2, 0, TAU); ctx.fill();
      ctx.fillStyle = sackH; ctx.beginPath(); ctx.ellipse(x + w * 0.42, y + h * 0.48, w * 0.3, h * 0.13, 0.2, 0, TAU); ctx.ellipse(x + w * 0.62, y + h * 0.68, w * 0.2, h * 0.1, -0.1, 0, TAU); ctx.fill();
      ctx.strokeStyle = rope; ctx.lineWidth = Math.max(0.03, env.px * 0.55); ctx.beginPath();
      for (let i = -6; i < 8; i++) { ctx.moveTo(x + (i * w) / 6, y); ctx.lineTo(x + (i * w) / 6 + h * 0.62, y + h); ctx.moveTo(x + ((i + 5) * w) / 6, y); ctx.lineTo(x + ((i + 5) * w) / 6 - h * 0.62, y + h); }
      ctx.stroke(); ctx.restore();
    } else { ctx.strokeStyle = rope; ctx.lineWidth = Math.max(0.04, env.px * 0.6); ctx.beginPath(); for (let i = 1; i < 5; i++) { ctx.moveTo(x + (i * w) / 5, y + h * 0.08); ctx.lineTo(x + (i * w) / 5, y + h * 0.86); ctx.moveTo(x + w * 0.06, y + (i * h) / 5); ctx.lineTo(x + w * 0.94, y + (i * h) / 5); } ctx.stroke(); }
    R4(ctx, x + w * 0.5 - 0.09, y + h - 0.16, 0.18, 0.16, rope);
  } else if (p.kind === 'lights') {
    // a lighting bar: a lattice truss with lamps hung under it
    const st = T('#2a2e36'), stH = T('#555c66'), lit = S.pal.dark > 0.3;
    R4(ctx, x, y + h - 0.07, w, 0.07, st); R4(ctx, x, y + h * 0.5, w, 0.06, st);
    ctx.strokeStyle = st; ctx.lineWidth = Math.max(0.03, env.px * 0.6); ctx.beginPath(); for (let i = 0; i < 12; i++) { const xa = x + (i * w) / 12; ctx.moveTo(xa, y + h * 0.5); ctx.lineTo(xa + w / 24, y + h - 0.04); ctx.lineTo(xa + w / 12, y + h * 0.5); } ctx.stroke();
    for (let i = 0; i < 5; i++) { const lx = x + w * (0.1 + i * 0.2); R4(ctx, lx - 0.02, y + h * 0.28, 0.04, h * 0.24, st); poly(ctx, [lx - 0.13, y + h * 0.3, lx + 0.13, y + h * 0.3, lx + 0.17, y, lx - 0.17, y], stH); R4(ctx, lx - 0.15, y, 0.3, 0.05, lit ? '#fff3c4' : T('#d8d2c2')); if (lit && s > 6) kxGlow(ctx, '#ffe196', lx, y, 0.7, 0.4 * S.pal.dark); }
  } else {
    // a packing crate: boards, a frame with a cross brace, and its stencils
    const c = T(p.col || '#a5793f'), d = T(darken(p.col || '#a5793f', 0.25)), hi = T(lighten(p.col || '#a5793f', 0.14)), d2 = T(darken(p.col || '#a5793f', 0.42));
    R4(ctx, x, y, w, h, c);
    if (fine) {
      ctx.fillStyle = d; ctx.beginPath(); for (let i = 1; i < 7; i++) ctx.rect(x, y + (i * h) / 7, w, Math.max(0.018, env.px * 0.5)); ctx.fill();
      ctx.fillStyle = hi; ctx.globalAlpha = 0.5; ctx.fillRect(x, y + (h * 2) / 7, w, h / 7); ctx.fillRect(x, y + (h * 5) / 7, w, h / 7); ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = d; ctx.lineWidth = Math.max(0.09, env.px);
    ctx.strokeRect(x + 0.06, y + 0.06, w - 0.12, h - 0.12); ctx.beginPath(); ctx.moveTo(x + 0.06, y + 0.06); ctx.lineTo(x + w - 0.06, y + h - 0.06); ctx.moveTo(x + w - 0.06, y + 0.06); ctx.lineTo(x + 0.06, y + h - 0.06); ctx.stroke();
    if (fine) {
      ctx.fillStyle = d2; ctx.beginPath(); for (const q of [[0.06, 0.06], [w - 0.06, 0.06], [0.06, h - 0.06], [w - 0.06, h - 0.06], [w / 2, 0.06], [w / 2, h - 0.06]]) ctx.rect(x + q[0] - 0.02, y + q[1] - 0.02, 0.04, 0.04); ctx.fill();
      R4(ctx, x + w - 0.1, y, 0.1, h, 'rgba(0,0,0,0.12)'); R4(ctx, x, y + h - 0.05, w, 0.05, 'rgba(255,255,255,0.14)');
      env.text(ctx, p.text || 'FRAGILE', x + w * 0.5, y + h * 0.12, h * 0.13, d2, 'center');
    }
  }
  ctx.restore();
}

// Generic shootable things: barrels, fuse boxes, bells, cameras, ducks.
K.thing = function (S, P, kind, x, y, o) {
  o = o || {};
  const defs = {
    barrel: { r: 0.48, mat: 'metal' }, fuse: { r: 0.42, mat: 'metal' }, bell: { r: 0.4, mat: 'metal' }, cctv: { r: 0.3, mat: 'metal' },
    duck: { r: 0.26, mat: 'soft' }, bottle: { r: 0.2, mat: 'glass' }, valve: { r: 0.36, mat: 'metal' }, radio: { r: 0.36, mat: 'metal' },
    lock: { r: 0.28, mat: 'metal' }, tank: { r: 0.9, mat: 'metal' }, dish: { r: 0.7, mat: 'metal' }, alarmcar: { r: 0.0, mat: 'metal' },
    bulb: { r: 0.26, mat: 'glass' }, flare: { r: 0.36, mat: 'metal' }, horn: { r: 0.4, mat: 'metal' }, can: { r: 0.2, mat: 'metal' }, pot: { r: 0.3, mat: 'glass' }, rope: { r: 0.3, mat: 'soft' },
    glint: { r: 0.35, mat: 'glass', breakable: true },
  };
  const d = defs[kind] || { r: 0.4, mat: 'metal' };
  const ob = S.obj(Object.assign({ kind, plane: P, x, y, r: d.r, mat: d.mat, breakable: d.breakable, layer: 2, draw(ctx, env) { drawThing(ctx, env, S, ob); } }, o));
  return ob;
};
// Each of these is something the player may be asked to find and hit, so each keeps its
// size and its place, has a strong outline shape of its own, and carries a small highlight.
function drawThing(ctx, env, S, ob) {
  const P = ob.plane, x = ob.x, y = ob.y, k = ob.kind, live = ob.alive, s = env.s, fine = s > 14, T = (c, l) => S.tone(c, P, l), lw = (v, m) => Math.max(v, env.px * (m || 0.7));
  if (ob.drawFn) { ob.drawFn(ctx, env, S, ob); return; }
  if (k === 'glint') { // a scope lens catching the light, now and then
    if (!live) return; const u = (env.t * (ob.rate || 0.5) + (ob.phase || 0)) % 1; if (u > 0.16) return; const a = Math.sin((u / 0.16) * Math.PI), r = Math.max(0.5, env.px * 5) * a;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = Math.max(0.05, env.px * 1.2); ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke(); circ(ctx, x, y, r * 0.3, 'rgba(255,255,255,' + a + ')');
    ctx.globalAlpha = a * 0.5; ctx.drawImage(kxBlob('#ffffff'), x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8); ctx.restore(); return;
  }
  if (k === 'barrel') {
    if (!live) { // burst: a scorch on the ground and the torn bottom of the drum
      circ(ctx, x, y - 0.5, 0.9, 'rgba(10,10,12,0.5)');
      if (fine) { ctx.fillStyle = 'rgba(10,10,12,0.4)'; ctx.beginPath(); ctx.ellipse(x, y - 0.6, 1.5, 0.16, 0, 0, TAU); ctx.fill(); poly(ctx, [x - 0.42, y - 0.62, x + 0.42, y - 0.62, x + 0.5, y - 0.3, x + 0.2, y - 0.42, x + 0.05, y - 0.2, x - 0.18, y - 0.4, x - 0.48, y - 0.24], T('#2a1512')); }
      return;
    }
    const c = ob.col || '#c4372c', body = T(c), dkc = T(darken(c, 0.36)), hic = T(lighten(c, 0.2));
    R4(ctx, x - 0.42, y - 0.62, 0.84, 1.24, body);
    if (fine) { R4(ctx, x - 0.42, y - 0.62, 0.13, 1.24, hic); R4(ctx, x + 0.25, y - 0.62, 0.17, 1.24, dkc); R4(ctx, x - 0.3, y - 0.56, 0.035, 1.12, 'rgba(255,255,255,0.3)'); }
    R4(ctx, x - 0.44, y - 0.2, 0.88, 0.1, dkc); R4(ctx, x - 0.44, y + 0.25, 0.88, 0.1, dkc);
    if (fine) {
      R4(ctx, x - 0.44, y - 0.13, 0.88, 0.02, hic); R4(ctx, x - 0.44, y + 0.32, 0.88, 0.02, hic);
      ctx.fillStyle = dkc; ctx.beginPath(); ctx.ellipse(x, y + 0.62, 0.42, 0.07, 0, 0, TAU); ctx.fill(); ctx.fillStyle = hic; ctx.beginPath(); ctx.ellipse(x, y + 0.63, 0.35, 0.045, 0, 0, TAU); ctx.fill(); R4(ctx, x + 0.14, y + 0.62, 0.1, 0.05, dkc);
      R4(ctx, x - 0.44, y - 0.64, 0.88, 0.05, dkc);
    }
    // the warning mark: a yellow triangle with a flame in it
    poly(ctx, [x, y + 0.2, x - 0.2, y - 0.12, x + 0.2, y - 0.12], T('#f4c542'));
    if (s > 24) poly(ctx, [x, y + 0.1, x - 0.06, y - 0.03, x - 0.02, y - 0.08, x + 0.05, y - 0.07, x + 0.07, y - 0.01], T('#2a1512'));
  } else if (k === 'tank') {
    if (!live) { circ(ctx, x, y - 0.6, 1.6, 'rgba(10,10,12,0.55)'); if (fine) { ctx.fillStyle = 'rgba(10,10,12,0.4)'; ctx.beginPath(); ctx.ellipse(x, y - 1.45, 2.6, 0.22, 0, 0, TAU); ctx.fill(); R4(ctx, x - 1.3, y - 1.5, 0.2, 0.5, T('#15171b')); R4(ctx, x + 1.1, y - 1.5, 0.2, 0.4, T('#15171b')); } return; }
    const c = ob.col || '#d9dde2', body = T(c), dkc = T(darken(c, 0.24)), hic = T(lighten(c, 0.35)), leg = T('#2a2e36');
    R4(ctx, x - 1.3, y - 1.5, 0.2, 0.7, leg); R4(ctx, x + 1.1, y - 1.5, 0.2, 0.7, leg);
    if (fine) { R4(ctx, x - 1.45, y - 1.5, 0.5, 0.09, leg); R4(ctx, x + 0.95, y - 1.5, 0.5, 0.09, leg); }
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(x, y, 1.9, 0.95, 0, 0, TAU); ctx.fill();
    if (fine) {
      // rounded: dark under the belly, a strip of light along the shoulder, bands and a filler on top
      ctx.save(); ctx.clip(); R4(ctx, x - 2, y - 1, 4, 0.52, dkc); R4(ctx, x - 2, y + 0.42, 4, 0.16, hic);
      ctx.fillStyle = dkc; ctx.fillRect(x - 1.25, y - 1, 0.07, 2); ctx.fillRect(x + 1.18, y - 1, 0.07, 2); ctx.restore();
      R4(ctx, x - 0.16, y + 0.9, 0.32, 0.2, leg); R4(ctx, x - 0.26, y + 1.06, 0.52, 0.07, leg); line(ctx, x + 0.16, y + 1.0, x + 0.7, y + 1.0, leg, 0.05, env); line(ctx, x + 0.7, y + 1.0, x + 0.7, y + 0.78, leg, 0.05, env);
      circ(ctx, x - 0.9, y + 0.1, 0.13, T('#f1ede2')); line(ctx, x - 0.9, y + 0.1, x - 0.84, y + 0.18, leg, 0.02, env);
    }
    poly(ctx, [x, y + 0.45, x - 0.4, y - 0.25, x + 0.4, y - 0.25], T('#e2572b'));
    if (s > 16) { poly(ctx, [x, y + 0.3, x - 0.27, y - 0.18, x + 0.27, y - 0.18], T('#f4c542')); poly(ctx, [x, y + 0.2, x - 0.07, y, x - 0.02, y - 0.1, x + 0.06, y - 0.09, x + 0.08, y + 0.02], T('#2a1512')); }
  } else if (k === 'fuse') {
    const box = T(live ? '#8f979e' : '#3a3d42'), inner = T(live ? '#6d757c' : '#2a2c30'), edge = T(live ? '#b3bac0' : '#4a4d52'), dk2 = T('#22262d');
    if (fine) { line(ctx, x - 0.18, y + 0.5, x - 0.18, y + 1.3, dk2, 0.07, env); line(ctx, x + 0.2, y - 0.5, x + 0.2, y - 1.2, dk2, 0.07, env); R4(ctx, x - 0.25, y + 0.5, 0.14, 0.08, dk2); R4(ctx, x + 0.13, y - 0.58, 0.14, 0.08, dk2); }
    R4(ctx, x - 0.4, y - 0.5, 0.8, 1.0, box);
    if (live || !fine) R4(ctx, x - 0.3, y - 0.4, 0.6, 0.8, inner);
    if (fine) {
      R4(ctx, x - 0.4, y + 0.44, 0.8, 0.06, edge); R4(ctx, x - 0.4, y - 0.5, 0.06, 1.0, edge); R4(ctx, x + 0.34, y - 0.5, 0.06, 1.0, dk2);
      if (live) { R4(ctx, x + 0.2, y - 0.08, 0.07, 0.18, dk2); R4(ctx, x - 0.3, y + 0.2, 0.03, 0.12, dk2); R4(ctx, x - 0.3, y - 0.3, 0.03, 0.12, dk2); }
      else { // blown: the door hangs open on a black, scorched inside
        R4(ctx, x - 0.3, y - 0.4, 0.6, 0.8, T('#0c0d10')); poly(ctx, [x + 0.3, y - 0.4, x + 0.3, y + 0.4, x + 0.72, y + 0.3, x + 0.72, y - 0.52], inner);
        ctx.fillStyle = T('#3a3d42'); for (let i = 0; i < 3; i++) ctx.fillRect(x - 0.22 + i * 0.16, y - 0.05, 0.09, 0.26);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 0.34, y + 0.5, 0.5, 0.4);
      }
    }
    if (live) poly(ctx, [x + 0.06, y + 0.3, x - 0.14, y - 0.03, x, y - 0.03, x - 0.06, y - 0.3, x + 0.14, y + 0.05, x, y + 0.05], T('#f4c542', true));
    else if (Math.sin(env.t * 30) > 0.6) { circ(ctx, x + 0.1, y, 0.12, '#bfe4ff'); if (s > 6) kxGlow(ctx, '#bfe4ff', x + 0.1, y, 0.5, 0.6); }
  } else if (k === 'bell' || k === 'horn') {
    const sw = ob.ringT ? Math.sin(env.t * 22) * 0.25 * Math.max(0, 1 - (env.t - ob.ringT) / 2) : 0, dk2 = T('#2a2e36');
    if (fine) { R4(ctx, x - 0.3, y + 0.4, 0.6, 0.07, dk2); R4(ctx, x - 0.04, y + 0.32, 0.08, 0.12, dk2); }
    ctx.save(); ctx.translate(x, y + 0.4); ctx.rotate(sw);
    if (k === 'bell') {
      const c = T('#c9a23a'), ch = T('#e8c766'), cd = T('#8f7222');
      if (!fine) { poly(ctx, [-0.14, 0, 0.14, 0, 0.4, -0.75, -0.4, -0.75], c); circ(ctx, 0, -0.82, 0.1, T('#3a2f1a')); }
      else {
        circ(ctx, 0, -0.84, 0.09, T('#3a2f1a'));
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-0.13, 0); ctx.lineTo(0.13, 0); ctx.quadraticCurveTo(0.2, -0.45, 0.42, -0.72); ctx.lineTo(0.42, -0.78); ctx.lineTo(-0.42, -0.78); ctx.lineTo(-0.42, -0.72); ctx.quadraticCurveTo(-0.2, -0.45, -0.13, 0); ctx.fill();
        ctx.fillStyle = cd; ctx.beginPath(); ctx.moveTo(0.04, 0); ctx.lineTo(0.13, 0); ctx.quadraticCurveTo(0.2, -0.45, 0.42, -0.72); ctx.lineTo(0.42, -0.78); ctx.lineTo(0.2, -0.78); ctx.quadraticCurveTo(0.1, -0.4, 0.04, 0); ctx.fill();
        ctx.fillStyle = ch; ctx.beginPath(); ctx.moveTo(-0.1, -0.04); ctx.quadraticCurveTo(-0.16, -0.45, -0.3, -0.68); ctx.lineTo(-0.22, -0.68); ctx.quadraticCurveTo(-0.1, -0.4, -0.05, -0.04); ctx.fill();
        R4(ctx, -0.42, -0.78, 0.84, 0.05, cd); R4(ctx, -0.09, -0.02, 0.18, 0.08, cd);
      }
    } else {
      // a loudhailer: the driver at the back and a wide flared mouth
      const c = T('#b8bec4'), ch = T('#e2e6ea'), cd = T('#7c858d');
      if (!fine) { poly(ctx, [-0.14, 0, 0.14, 0, 0.4, -0.75, -0.4, -0.75], c); circ(ctx, 0, -0.82, 0.1, T('#3a2f1a')); }
      else {
        R4(ctx, -0.11, -0.2, 0.22, 0.22, cd); R4(ctx, -0.15, -0.26, 0.3, 0.07, dk2);
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-0.1, -0.24); ctx.lineTo(0.1, -0.24); ctx.quadraticCurveTo(0.14, -0.6, 0.44, -0.76); ctx.lineTo(-0.44, -0.76); ctx.quadraticCurveTo(-0.14, -0.6, -0.1, -0.24); ctx.fill();
        ctx.fillStyle = cd; ctx.beginPath(); ctx.ellipse(0, -0.77, 0.44, 0.08, 0, 0, TAU); ctx.fill(); ctx.fillStyle = dk2; ctx.beginPath(); ctx.ellipse(0, -0.78, 0.34, 0.05, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = ch; ctx.beginPath(); ctx.moveTo(-0.07, -0.28); ctx.quadraticCurveTo(-0.12, -0.58, -0.32, -0.7); ctx.lineTo(-0.24, -0.7); ctx.quadraticCurveTo(-0.08, -0.56, -0.03, -0.28); ctx.fill();
      }
    }
    ctx.restore();
    if (ob.ringT && env.t - ob.ringT < 1.6 && s > 5) { // sound you can see for a moment
      const u = (env.t - ob.ringT) / 1.6; ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 * (1 - u)) + ')'; ctx.lineWidth = lw(0.03); ctx.beginPath(); for (let i = 0; i < 2; i++) { const r = 0.6 + u * 1.2 + i * 0.3; ctx.moveTo(x - r * 0.9, y - 0.3 - r * 0.2); ctx.quadraticCurveTo(x - r * 1.15, y, x - r * 0.9, y + 0.3 + r * 0.2); ctx.moveTo(x + r * 0.9, y - 0.3 - r * 0.2); ctx.quadraticCurveTo(x + r * 1.15, y, x + r * 0.9, y + 0.3 + r * 0.2); } ctx.stroke();
    }
  } else if (k === 'cctv') {
    const c = T('#dfe3e7'), cd = T('#a9b0b6'), dk2 = T('#2a2e36'), dir = ob.dir || 1;
    line(ctx, x, y + 0.3, x, y + 0.6, dk2, 0.08, env);
    if (fine) { R4(ctx, x - 0.12, y + 0.56, 0.24, 0.07, dk2); circ(ctx, x, y + 0.14, 0.07, dk2); }
    ctx.save(); ctx.translate(x, y + 0.1); ctx.rotate(dir * (live ? -0.35 + 0.25 * Math.sin(env.t * 0.6) : -1.2));
    if (dir < 0) ctx.scale(-1, 1);
    R4(ctx, -0.15, -0.14, 0.62, 0.28, c); R4(ctx, 0.42, -0.1, 0.12, 0.2, T('#1b1e24'));
    if (fine) {
      R4(ctx, -0.15, -0.14, 0.62, 0.07, cd); R4(ctx, -0.2, 0.12, 0.76, 0.05, cd); R4(ctx, 0.5, -0.07, 0.035, 0.14, live ? T('#5d8fc0', true) : T('#30343c'));
      R4(ctx, -0.19, -0.1, 0.05, 0.2, dk2); ctx.strokeStyle = dk2; ctx.lineWidth = lw(0.02, 0.5); ctx.beginPath(); ctx.moveTo(-0.17, 0); ctx.quadraticCurveTo(-0.3, -0.05, -0.2, 0.3); ctx.stroke();
      if (live) R4(ctx, 0.51, 0.02, 0.012, 0.035, 'rgba(255,255,255,0.8)');
    }
    if (live && Math.sin(env.t * 4) > 0) circ(ctx, -0.05, 0.02, 0.05, '#ff3b30'); ctx.restore();
    if (!live && fine && Math.sin(env.t * 23 + x) > 0.8) circ(ctx, x + dir * 0.1, y - 0.2, 0.05, '#bfe4ff');
  } else if (k === 'duck') {
    if (!live) return;
    // a small yellow rubber duck: body, head, orange bill, one black eye
    circ(ctx, x, y, 0.2, '#f7d038'); circ(ctx, x + 0.14, y + 0.2, 0.13, '#f7d038'); poly(ctx, [x + 0.24, y + 0.22, x + 0.4, y + 0.17, x + 0.24, y + 0.13], '#f08a24'); circ(ctx, x + 0.17, y + 0.24, 0.025, '#1b1b1b');
    if (s > 22) {
      poly(ctx, [x - 0.18, y + 0.06, x - 0.3, y + 0.17, x - 0.13, y + 0.14], '#f7d038');                                 // tail
      ctx.fillStyle = '#e0b520'; ctx.beginPath(); ctx.ellipse(x - 0.03, y - 0.01, 0.11, 0.07, 0.3, 0, TAU); ctx.fill();   // wing
      ctx.fillStyle = '#e0b520'; ctx.beginPath(); ctx.arc(x, y, 0.2, Math.PI * 1.1, Math.PI * 1.9); ctx.closePath(); ctx.fill(); // shade under the body
      poly(ctx, [x + 0.24, y + 0.175, x + 0.4, y + 0.17, x + 0.24, y + 0.13], '#d8701a');
      circ(ctx, x + 0.1, y + 0.26, 0.03, 'rgba(255,255,255,0.75)'); circ(ctx, x + 0.176, y + 0.247, 0.008, '#ffffff');
    }
  } else if (k === 'bottle' || k === 'can' || k === 'pot') {
    if (!live) return;
    if (k === 'pot') {
      const pot = T('#a5562f');
      poly(ctx, [x - 0.26, y + 0.1, x + 0.26, y + 0.1, x + 0.18, y - 0.3, x - 0.18, y - 0.3], pot); circ(ctx, x, y + 0.3, 0.26, T('#4f8a4a'));
      if (fine) {
        R4(ctx, x - 0.28, y + 0.04, 0.56, 0.08, T('#c06e42')); poly(ctx, [x + 0.08, y + 0.04, x + 0.26, y + 0.04, x + 0.18, y - 0.3, x + 0.06, y - 0.3], T('#7d3f22')); R4(ctx, x - 0.22, y - 0.33, 0.44, 0.04, T('#7d3f22'));
        ctx.fillStyle = T('#3d6e3c'); ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = -1.2 + i * 0.6; ctx.moveTo(x, y + 0.12); ctx.quadraticCurveTo(x + Math.sin(a) * 0.14, y + 0.34, x + Math.sin(a) * 0.32, y + 0.42 + Math.cos(a) * 0.14); ctx.quadraticCurveTo(x + Math.sin(a) * 0.06, y + 0.3, x, y + 0.12); } ctx.fill();
        circ(ctx, x - 0.08, y + 0.42, 0.06, T('#6aa860'));
      }
    } else if (k === 'can') {
      R4(ctx, x - 0.12, y - 0.18, 0.24, 0.36, T('#c9ced3'));
      if (fine) { R4(ctx, x - 0.12, y - 0.1, 0.24, 0.2, T('#c0392b')); R4(ctx, x - 0.12, y - 0.01, 0.24, 0.035, T('#f1ede2')); R4(ctx, x - 0.13, y + 0.16, 0.26, 0.03, T('#8d949a')); R4(ctx, x - 0.13, y - 0.19, 0.26, 0.03, T('#8d949a')); R4(ctx, x - 0.09, y - 0.16, 0.035, 0.32, 'rgba(255,255,255,0.45)'); R4(ctx, x + 0.07, y - 0.16, 0.05, 0.32, 'rgba(0,0,0,0.18)'); }
    } else {
      const g = T('#3f8a5a', true);
      R4(ctx, x - 0.09, y - 0.2, 0.18, 0.3, g); R4(ctx, x - 0.04, y + 0.1, 0.08, 0.16, g);
      if (fine) { poly(ctx, [x - 0.09, y + 0.1, x + 0.09, y + 0.1, x + 0.04, y + 0.16, x - 0.04, y + 0.16], g); R4(ctx, x - 0.09, y - 0.14, 0.18, 0.14, T('#f1ede2', true)); R4(ctx, x - 0.09, y - 0.1, 0.18, 0.025, T('#b3312b', true)); R4(ctx, x - 0.05, y + 0.24, 0.1, 0.04, T('#c9a23a')); R4(ctx, x - 0.065, y - 0.18, 0.025, 0.4, 'rgba(255,255,255,0.5)'); R4(ctx, x - 0.09, y - 0.2, 0.18, 0.025, 'rgba(0,0,0,0.3)'); }
    }
  } else if (k === 'valve') {
    const pipe = T('#7c858d'), pipeH = T('#a3abb2'), pipeD = T('#59616a'), red = T(live ? '#c4372c' : '#5a2520');
    R4(ctx, x - 2.5, y - 0.16, 5, 0.32, pipe);
    if (fine) { R4(ctx, x - 2.5, y + 0.08, 5, 0.05, pipeH); R4(ctx, x - 2.5, y - 0.16, 5, 0.08, pipeD); ctx.fillStyle = pipeD; ctx.beginPath(); for (const fx of [-2.2, -0.62, 0.5, 2.1]) ctx.rect(x + fx, y - 0.22, 0.12, 0.44); ctx.fill(); R4(ctx, x - 0.2, y - 0.24, 0.4, 0.48, pipeD); R4(ctx, x - 0.05, y - 0.02, 0.1, 0.1, T('#2a2e36')); }
    ctx.strokeStyle = red; ctx.lineWidth = Math.max(0.08, env.px);
    ctx.beginPath(); ctx.arc(x, y, 0.3, 0, TAU); ctx.moveTo(x - 0.3, y); ctx.lineTo(x + 0.3, y); ctx.moveTo(x, y - 0.3); ctx.lineTo(x, y + 0.3); ctx.stroke();
    if (fine) { ctx.lineWidth = lw(0.035, 0.5); ctx.beginPath(); ctx.moveTo(x - 0.21, y - 0.21); ctx.lineTo(x + 0.21, y + 0.21); ctx.moveTo(x - 0.21, y + 0.21); ctx.lineTo(x + 0.21, y - 0.21); ctx.stroke(); circ(ctx, x, y, 0.07, red); if (live) { ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = lw(0.025, 0.4); ctx.beginPath(); ctx.arc(x, y, 0.3, 0.5, 1.4); ctx.stroke(); } }
  } else if (k === 'radio' || k === 'dish') {
    const c = T(live ? '#cfd4d9' : '#4a4d52'), dk2 = T('#2a2e36');
    if (k === 'dish') {
      line(ctx, x, y - 1.2, x, y, dk2, 0.1, env);
      if (fine) { R4(ctx, x - 0.22, y - 1.24, 0.44, 0.08, dk2); line(ctx, x - 0.2, y - 1.2, x, y - 0.7, dk2, 0.04, env); line(ctx, x + 0.2, y - 1.2, x, y - 0.7, dk2, 0.04, env); }
      const rot = live ? -0.4 : 0.9;
      ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, 0.3, 0.7, rot, 0, TAU); ctx.fill();
      if (fine) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        ctx.fillStyle = T(live ? '#9aa1a8' : '#34373c'); ctx.beginPath(); ctx.ellipse(0.05, 0, 0.2, 0.6, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = T(live ? '#f1f3f5' : '#5a5d62'); ctx.lineWidth = lw(0.03, 0.5); ctx.beginPath(); ctx.ellipse(0, 0, 0.3, 0.7, 0, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
        ctx.strokeStyle = dk2; ctx.beginPath(); ctx.moveTo(0.04, 0.5); ctx.lineTo(0.62, 0); ctx.lineTo(0.04, -0.5); ctx.moveTo(0.1, 0); ctx.lineTo(0.62, 0); ctx.stroke(); R4(ctx, 0.56, -0.07, 0.14, 0.14, dk2);
        ctx.restore();
        if (live && Math.sin(env.t * 2.4) > 0.3) circ(ctx, x, y - 0.66, 0.04, '#ff3b30');
      }
    } else {
      R4(ctx, x - 0.32, y - 0.25, 0.64, 0.5, T('#2f3640')); line(ctx, x + 0.2, y + 0.25, x + 0.4, y + 1.1, c, 0.04, env);
      if (fine) {
        R4(ctx, x - 0.32, y + 0.2, 0.64, 0.05, T('#4a5460')); R4(ctx, x - 0.27, y - 0.18, 0.26, 0.22, T('#1b2028')); ctx.fillStyle = T('#59636f'); for (let i = 0; i < 4; i++) ctx.fillRect(x - 0.25, y - 0.15 + i * 0.05, 0.22, 0.02);
        circ(ctx, x + 0.12, y - 0.08, 0.07, T('#8d949a')); circ(ctx, x + 0.25, y - 0.08, 0.045, T('#8d949a')); R4(ctx, x + 0.02, y + 0.04, 0.26, 0.08, live ? T('#9fe8b0', true) : T('#1b2028'));
        ctx.strokeStyle = T('#4a5460'); ctx.lineWidth = lw(0.035, 0.5); ctx.beginPath(); ctx.moveTo(x - 0.2, y + 0.25); ctx.quadraticCurveTo(x, y + 0.42, x + 0.1, y + 0.25); ctx.stroke(); circ(ctx, x + 0.4, y + 1.1, 0.03, c);
      }
      if (live && Math.sin(env.t * 3) > 0) circ(ctx, x - 0.15, y + 0.08, 0.06, '#52e07a');
    }
  } else if (k === 'lock') {
    if (!live) return;
    ctx.strokeStyle = T('#8d949a'); ctx.lineWidth = Math.max(0.06, env.px); ctx.beginPath(); ctx.arc(x, y + 0.1, 0.13, 0, Math.PI); ctx.stroke();
    R4(ctx, x - 0.2, y - 0.24, 0.4, 0.34, T('#d6a12a'));
    if (fine) { R4(ctx, x - 0.2, y + 0.06, 0.4, 0.04, T('#f0c24a')); R4(ctx, x + 0.12, y - 0.24, 0.08, 0.34, T('#a87a1a')); circ(ctx, x, y - 0.05, 0.045, T('#2a2010')); R4(ctx, x - 0.015, y - 0.16, 0.03, 0.1, T('#2a2010')); R4(ctx, x - 0.17, y - 0.2, 0.03, 0.24, 'rgba(255,255,255,0.4)'); }
  } else if (k === 'bulb') {
    const dk2 = T('#1b1e24');
    line(ctx, x, y + 0.2, x, y + (ob.cord || 0.8), dk2, 0.03, env);
    if (fine) R4(ctx, x - 0.05, y + 0.12, 0.1, 0.12, T('#8d949a'));
    if (live && ob.on !== false) {
      kxGlow(ctx, '#ffe6a0', x, y, 1.3, 0.5);
      circ(ctx, x, y, 0.16, '#fff3c4'); if (fine) circ(ctx, x, y - 0.01, 0.07, '#ffffff');
    } else if (!ob.alive && fine) { // smashed: a ring of glass round the cap
      ctx.fillStyle = 'rgba(190,215,240,0.4)'; ctx.beginPath(); ctx.moveTo(x - 0.1, y + 0.12); ctx.lineTo(x - 0.15, y - 0.02); ctx.lineTo(x - 0.06, y + 0.04); ctx.lineTo(x - 0.02, y - 0.06); ctx.lineTo(x + 0.05, y + 0.05); ctx.lineTo(x + 0.14, y); ctx.lineTo(x + 0.1, y + 0.12); ctx.closePath(); ctx.fill();
    } else circ(ctx, x, y, 0.16, '#2a2e36');
  } else if (k === 'flare') {
    const c = T(live ? '#d8572a' : '#3a2a25');
    R4(ctx, x - 0.3, y - 0.3, 0.6, 0.6, c); R4(ctx, x - 0.2, y - 0.05, 0.4, 0.1, T('#f1ede2'));
    if (fine) {
      R4(ctx, x - 0.3, y + 0.24, 0.6, 0.06, T(live ? '#f07a44' : '#4a3a35')); R4(ctx, x + 0.22, y - 0.3, 0.08, 0.6, 'rgba(0,0,0,0.22)'); R4(ctx, x - 0.33, y + 0.12, 0.66, 0.04, T('#22262d')); R4(ctx, x - 0.05, y + 0.08, 0.1, 0.1, T('#c9ced3'));
      ctx.strokeStyle = T('#22262d'); ctx.lineWidth = lw(0.035, 0.5); ctx.beginPath(); ctx.moveTo(x - 0.14, y + 0.3); ctx.quadraticCurveTo(x, y + 0.44, x + 0.14, y + 0.3); ctx.stroke();
      if (live) { ctx.fillStyle = T('#f4c542'); for (let i = 0; i < 3; i++) ctx.fillRect(x - 0.2 + i * 0.15, y - 0.24, 0.07, 0.14); }
    }
  } else if (k === 'rope') {
    if (live) {
      const rope = T('#c9b386'), ropeD = T('#8a7650');
      R4(ctx, x - 0.16, y - 0.3, 0.32, 0.6, rope); ctx.fillStyle = ropeD; for (let i = 0; i < 4; i++) ctx.fillRect(x - 0.16, y - 0.26 + i * 0.15, 0.32, 0.04);
      if (fine) { // the turns of the rope, laid slantwise, and the pin it is made fast to
        ctx.strokeStyle = ropeD; ctx.lineWidth = lw(0.018, 0.4); ctx.beginPath(); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { ctx.moveTo(x - 0.14 + j * 0.08, y - 0.22 + i * 0.15); ctx.lineTo(x - 0.1 + j * 0.08, y - 0.12 + i * 0.15); } ctx.stroke();
        R4(ctx, x - 0.16, y - 0.3, 0.04, 0.6, 'rgba(255,255,255,0.25)'); R4(ctx, x + 0.11, y - 0.3, 0.05, 0.6, 'rgba(0,0,0,0.2)'); R4(ctx, x - 0.24, y + 0.3, 0.48, 0.06, T('#2a2e36')); R4(ctx, x - 0.24, y - 0.36, 0.48, 0.06, T('#2a2e36'));
      }
    } else if (fine) { const rope = T('#c9b386'); ctx.strokeStyle = rope; ctx.lineWidth = lw(0.03, 0.5); ctx.beginPath(); for (let i = -1; i <= 1; i++) { ctx.moveTo(x + i * 0.03, y + 0.3); ctx.lineTo(x + i * 0.11, y + 0.1 - Math.abs(i) * 0.04); } ctx.stroke(); R4(ctx, x - 0.24, y + 0.3, 0.48, 0.06, T('#2a2e36')); }
  }
}

// ---- vehicles ----------------------------------------------------------------
const CARS = {
  sedan: { len: 4.6, h: 1.45, body: 0.82, cab: [-0.26, 0.2], win: [[-0.23, -0.03], [0.0, 0.17]], seats: [0.07, -0.14], wheel: 0.33 },
  suv: { len: 4.9, h: 1.8, body: 0.95, cab: [-0.42, 0.2], win: [[-0.38, -0.2], [-0.17, -0.02], [0.01, 0.17]], seats: [0.08, -0.1, -0.29], wheel: 0.4 },
  limo: { len: 7.0, h: 1.45, body: 0.82, cab: [-0.34, 0.28], win: [[-0.31, -0.16], [-0.14, 0.0], [0.03, 0.14], [0.16, 0.26]], seats: [0.2, -0.07, -0.24], wheel: 0.33 },
  van: { len: 5.3, h: 2.15, body: 1.0, cab: [-0.5, 0.36], win: [[0.14, 0.33]], seats: [0.23], wheel: 0.38 },
  truck: { len: 8.0, h: 3.0, body: 1.0, cab: [0.24, 0.47], win: [[0.3, 0.45]], seats: [0.37], wheel: 0.5, box: [-0.5, 0.22] },
  pickup: { len: 5.3, h: 1.75, body: 0.95, cab: [-0.05, 0.25], win: [[-0.02, 0.11], [0.13, 0.22]], seats: [0.17, 0.04], wheel: 0.4 },
  boat: { len: 7.0, h: 1.5, body: 0.9, cab: [-0.1, 0.12], win: [[-0.08, 0.1]], seats: [0.0, -0.25], wheel: 0, boat: true },
  train: { len: 66, h: 3.6, body: 3.6, cab: [-0.5, 0.5], win: [], seats: [], wheel: 0, solid: true, train: true },
};
// Draw a vehicle centred on x, wheels on y. dir = 1 faces right.
// st (for vehicles that move) carries: glass[i] broken windows, flat[i] flat tyres (0 is
// the rear wheel), moving. A parked car that is only scenery passes null and shows no lights.
function drawCar(ctx, env, S, P, kind, x, y, dir, colHex, st) {
  if (CARS[kind].draw) { CARS[kind].draw(ctx, env, S, P, x, y, dir, colHex, st); return; }
  const c = CARS[kind], L = c.len, base = colHex || '#30343c', col = S.tone(base, P), dk = S.tone(darken(base, 0.3), P), gl = S.tone(S.pal.glass, P), s = env.s;
  const hi = S.tone(lighten(base, 0.16), P), dk2 = S.tone(darken(base, 0.5), P), night = S.pal.dark > 0.3, T = (q, l) => S.tone(q, P, l);
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  if (c.train) { kxTrain(ctx, env, S, P, c, col, dk, gl, st, dir); ctx.restore(); return; }
  if (c.boat) {
    // a work boat: hull with a rubbing strake, a small wheelhouse, an outboard at the stern
    const red = T('#b3312b'), wh = T('#e9e4d6');
    if (s > 6) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(0.2, -0.1, L * 0.56, 0.09, 0, 0, TAU); ctx.fill(); }
    poly(ctx, [-L / 2, 0.9, L / 2 + 0.6, 0.9, L / 2 - 0.3, -0.15, -L / 2 + 0.2, -0.15], col);
    if (s > 9) { poly(ctx, [-L / 2 + 0.13, 0.2, L / 2 + 0.03, 0.2, L / 2 - 0.3, -0.15, -L / 2 + 0.2, -0.15], dk); R4(ctx, -L / 2 - 0.03, 0.82, L + 0.66, 0.1, hi); }
    R4(ctx, -L / 2, 0.55, L + 0.2, 0.12, red);
    poly(ctx, [c.cab[0] * L, 0.9, c.cab[1] * L + 0.5, 0.9, c.cab[1] * L, 1.5, c.cab[0] * L + 0.2, 1.5], dk);
    if (s > 9) {
      R4(ctx, c.cab[0] * L + 0.12, 1.47, (c.cab[1] - c.cab[0]) * L + 0.1, 0.08, wh);
      R4(ctx, c.win[0][0] * L, c.body + 0.06, (c.win[0][1] - c.win[0][0]) * L, c.h - c.body - 0.2, gl);
      ctx.fillStyle = 'rgba(200,225,255,0.16)'; ctx.fillRect(c.win[0][0] * L, c.body + 0.06, (c.win[0][1] - c.win[0][0]) * L * 0.3, c.h - c.body - 0.2);
      ctx.strokeStyle = dk2; ctx.lineWidth = Math.max(0.03, env.px * 0.6); ctx.beginPath(); ctx.moveTo(L * 0.2, 0.9); ctx.lineTo(L * 0.2, 1.25); ctx.lineTo(L / 2 + 0.3, 1.2); ctx.lineTo(L / 2 + 0.5, 0.9); ctx.moveTo(L * 0.35, 0.9); ctx.lineTo(L * 0.35, 1.22); ctx.stroke();
      if (night && st) { circ(ctx, c.cab[1] * L - 0.1, 1.62, 0.06, '#fff3c4'); kxGlow(ctx, '#ffe196', c.cab[1] * L - 0.1, 1.62, 0.7, 0.4); }
    }
    R4(ctx, -L / 2 - 0.25, 0.3, 0.3, 0.9, T('#1b1e24'));
    if (s > 9) { R4(ctx, -L / 2 - 0.3, 1.05, 0.4, 0.22, T('#3a3f48')); R4(ctx, -L / 2 - 0.19, -0.05, 0.12, 0.4, T('#1b1e24')); }
    ctx.restore(); return;
  }
  const by = c.wheel * 0.75, flat = st && st.flat, wx = [-L * 0.31, L * 0.31], tyre = T('#0e1014'), rimC = T('#8d949a'), chrome = T('#b9c0c7');
  // where it meets the road
  if (s > 4) { ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.beginPath(); ctx.ellipse(0, 0.03, L * 0.53, Math.max(0.08, c.wheel * 0.24), 0, 0, TAU); ctx.fill(); }
  // A car that pulls up from speed stops dead in the simulation. So that it reads as hard
  // braking rather than a jolt, the body dips onto its nose and rocks back over most of a
  // second; the wheels stay on the road. (st carries the speed the picture last saw.)
  let pitch = 0;
  if (st) {
    if (st._kt !== undefined && env.t > st._kt + 0.3) st._ksp = 0; // not watched while it stopped: no dip when it comes back into view
    else if (st._kt !== undefined && env.t > st._kt + 1e-4) {
      const sp = Math.abs(x - st._kx) / (env.t - st._kt);
      if (st.moving) { st._ksp = sp; st._kst = undefined; } else if (st._ksp > 1.5 && st._kst === undefined) { st._kst = env.t; st._ksv = st._ksp; st._ksp = 0; }
    }
    if (env.t !== st._kt) { st._kt = env.t; st._kx = x; }
    const u = st._kst === undefined ? 9 : env.t - st._kst;
    if (u >= 0 && u < 1) pitch = Math.min(0.07, st._ksv * 0.008) * Math.exp(-u * 4) * Math.sin((u / 0.42) * Math.PI);
  }
  if (pitch) { ctx.save(); ctx.rotate(-pitch); }
  if (c.box) {
    const bx0 = c.box[0] * L, bw = (c.box[1] - c.box[0]) * L, bc = (st && st.boxCol) || '#d9dde2', boxC = T(bc);
    R4(ctx, bx0, by + 0.25, bw, c.h - by - 0.25, boxC); R4(ctx, bx0, by, L * 0.98, 0.4, dk);
    if (s > 8) {
      // the box body: a frame, ribbed sides, a coloured band, the catch of the roller door
      kxFadeAt(ctx, '#000000', bx0, by + 0.25, bw, c.h - by - 0.25, 0.14);
      ctx.fillStyle = T(darken(bc, 0.14)); ctx.beginPath(); for (let rx = bx0 + 0.5; rx < bx0 + bw - 0.2; rx += 0.62) ctx.rect(rx, by + 0.37, Math.max(0.03, env.px * 0.6), c.h - by - 0.5); ctx.fill();
      ctx.fillStyle = T(darken(bc, 0.34)); ctx.beginPath(); ctx.rect(bx0, by + 0.25, bw, 0.11); ctx.rect(bx0, c.h - 0.11, bw, 0.11); ctx.rect(bx0, by + 0.25, 0.11, c.h - by - 0.25); ctx.rect(bx0 + bw - 0.11, by + 0.25, 0.11, c.h - by - 0.25); ctx.fill();
      R4(ctx, bx0 + 0.11, by + 1.0, bw - 0.22, 0.36, col); R4(ctx, bx0 + 0.11, by + 0.92, bw - 0.22, 0.05, dk);
      R4(ctx, bx0 + 0.02, by + 0.5, 0.06, 0.3, T('#2a2e36')); R4(ctx, bx0 - 0.04, by + 0.05, 0.1, 0.14, T('#a8322a'));
      if (s > 20) { ctx.fillStyle = T('#e8a23a', true); ctx.fillRect(bx0 + bw * 0.3, c.h - 0.08, 0.1, 0.05); ctx.fillRect(bx0 + bw * 0.7, c.h - 0.08, 0.1, 0.05); R4(ctx, bx0 + bw * 0.35, by - 0.02, 0.9, 0.3, dk2); }
    }
  }
  // lower body with rounded nose
  ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(-L / 2, by); ctx.lineTo(L / 2 - 0.1, by); ctx.quadraticCurveTo(L / 2 + 0.05, by + 0.3, L / 2 - 0.05, c.body);
  ctx.lineTo(-L / 2 + 0.05, c.body + (c.box ? 0 : 0.03)); ctx.quadraticCurveTo(-L / 2 - 0.08, by + 0.3, -L / 2, by); ctx.fill();
  // cabin
  const c0 = c.cab[0] * L, c1 = c.cab[1] * L, slopeF = kind === 'van' || kind === 'truck' ? 0.25 : 0.55, slopeR = kind === 'sedan' || kind === 'limo' ? 0.45 : 0.12;
  poly(ctx, [c0, c.body, c1 + slopeF, c.body, c1, c.h, c0 + slopeR, c.h], col);
  if (s > 8) {
    // light along the roof and the shoulder, a darker sill, and the arches the wheels sit in
    R4(ctx, c0 + slopeR + 0.04, c.h - 0.05, c1 - c0 - slopeR - 0.06, 0.05, hi);
    R4(ctx, (c.box ? c0 : -L / 2 + 0.1), c.body - 0.1, (c.box ? L / 2 - c0 : L) - 0.22, 0.04, hi);
    ctx.fillStyle = dk2; ctx.beginPath(); for (let i = 0; i < 2; i++) { ctx.moveTo(wx[i] - c.wheel * 1.24, by); ctx.lineTo(wx[i] + c.wheel * 1.24, by); ctx.arc(wx[i], c.wheel, c.wheel * 1.24, 0, Math.PI); ctx.closePath(); } ctx.fill();
  }
  // windows
  const wy = c.body + 0.06, wh = c.h - c.body - 0.2;
  for (let i = 0; i < c.win.length; i++) {
    const w0 = c.win[i][0] * L, w1 = c.win[i][1] * L, pn = st && st.pane && st.pane[i], broken = st && st.glass && st.glass[i] && !(pn && pn.gone);
    const down = pn && !broken ? kxPaneAt(pn, env.t) : 0;
    if (down > 0.002) {
      // a window wound part or all of the way down: the open part shows the dark inside of the
      // car with no sheen on it, and the pane sinks into the door with its top edge catching the light
      const gh = wh * (1 - down);
      R4(ctx, w0, wy, w1 - w0, wh, S.tone('#151a22', P));
      if (gh > 0.004) {
        R4(ctx, w0, wy, w1 - w0, gh, gl);
        ctx.fillStyle = 'rgba(200,225,255,0.14)'; ctx.fillRect(w0, wy, (w1 - w0) * 0.35, gh);
        if (s > 6) R4(ctx, w0, wy + gh - Math.max(0.012, env.px * 0.9), w1 - w0, Math.max(0.012, env.px * 0.9), 'rgba(225,238,255,0.55)');
      }
      continue;
    }
    R4(ctx, w0, wy, w1 - w0, wh, broken ? S.tone('#0d1016', P) : gl);
    if (!broken) {
      ctx.fillStyle = 'rgba(200,225,255,0.14)'; ctx.fillRect(w0, wy, (w1 - w0) * 0.35, wh);
      if (s > 12) { // a second, thinner streak that slides as the car goes by
        const u = clamp((x - (env.x0 + env.x1) / 2) / Math.max(1, env.x1 - env.x0), -0.6, 0.6);
        ctx.fillStyle = 'rgba(220,235,255,0.2)'; ctx.beginPath(); kxStreak(ctx, w0, wy, w1 - w0, wh, w0 + (w1 - w0) * (0.55 - u * dir * 0.7), (w1 - w0) * 0.1, wh * 0.4); ctx.fill();
        R4(ctx, w0, wy + wh - 0.03, w1 - w0, 0.03, 'rgba(0,0,0,0.3)');
      }
    } else if (s > 8) {
      // broken: teeth of glass left round the opening
      ctx.fillStyle = 'rgba(190,215,240,0.42)'; ctx.beginPath(); const ww = w1 - w0;
      ctx.moveTo(w0, wy); ctx.lineTo(w0 + ww * 0.3, wy); ctx.lineTo(w0 + ww * 0.12, wy + wh * 0.35); ctx.lineTo(w0, wy + wh * 0.5); ctx.closePath();
      ctx.moveTo(w1, wy); ctx.lineTo(w1 - ww * 0.26, wy); ctx.lineTo(w1 - ww * 0.1, wy + wh * 0.28); ctx.lineTo(w1, wy + wh * 0.42); ctx.closePath();
      ctx.moveTo(w0, wy + wh); ctx.lineTo(w0 + ww * 0.22, wy + wh); ctx.lineTo(w0, wy + wh * 0.66); ctx.closePath();
      ctx.moveTo(w1, wy + wh); ctx.lineTo(w1 - ww * 0.34, wy + wh); ctx.lineTo(w1 - ww * 0.16, wy + wh * 0.72); ctx.lineTo(w1, wy + wh * 0.6); ctx.closePath();
      ctx.moveTo(w0 + ww * 0.42, wy); ctx.lineTo(w0 + ww * 0.62, wy); ctx.lineTo(w0 + ww * 0.5, wy + wh * 0.2); ctx.closePath();
      ctx.fill();
    }
  }
  R4(ctx, -L / 2 + 0.02, by + 0.18, L - 0.06, 0.07, dk);
  if (s > 8) {
    R4(ctx, -L / 2 + 0.03, by, L - 0.1, 0.18, dk);
    // door seams and handles, taken from where the windows are
    if (s > 13) {
      ctx.fillStyle = dk2; ctx.beginPath(); const sw = Math.max(0.018, env.px * 0.5);
      for (let i = 0; i < c.win.length; i++) { const w0 = c.win[i][0] * L, w1 = c.win[i][1] * L; if (i === 0 || c.win[i - 1][1] * L < w0 - 0.02) ctx.rect(w0 - 0.04, by + 0.2, sw, c.body - by - 0.14); ctx.rect(w1 + 0.03, by + 0.2, sw, c.body - by - 0.14); }
      if (kind === 'van') { ctx.rect(c0 + 0.5, by + 0.2, sw, c.h - by - 0.32); ctx.rect(c0 + 2.0, by + 0.2, sw, c.h - by - 0.32); ctx.rect(c0 + 0.5, c.h - 0.16, 1.5, sw); }
      if (kind === 'pickup') { ctx.rect(-L / 2 + 0.12, by + 0.2, sw, c.body - by - 0.2); ctx.rect(c0 - 0.06, by + 0.2, sw, c.body - by - 0.2); }
      ctx.fill();
      ctx.fillStyle = chrome; ctx.beginPath(); for (let i = 0; i < c.win.length; i++) ctx.rect(c.win[i][0] * L + 0.08, c.body - 0.2, 0.2, 0.045); if (kind === 'van') ctx.rect(c0 + 1.72, c.body - 0.05, 0.2, 0.045); ctx.fill();
      // mirror, filler cap, bumpers
      if (c.win.length) { const mw = c.win[c.win.length - 1][1] * L; R4(ctx, mw + 0.04, c.body + 0.04, 0.14, 0.1, dk2); }
      R4(ctx, -L * 0.36, c.body - 0.24, 0.1, 0.1, dk);
    }
    R4(ctx, L / 2 - 0.2, by - 0.02, 0.26, 0.17, kind === 'truck' || kind === 'van' || kind === 'pickup' ? dk2 : chrome); R4(ctx, -L / 2 - 0.06, by - 0.02, 0.26, 0.17, kind === 'truck' || kind === 'van' || kind === 'pickup' ? dk2 : chrome);
    R4(ctx, L / 2 - 0.1, by + 0.2, 0.08, c.body - by - 0.52, dk2);
  }
  // what each kind carries
  if (s > 8) {
    const rk = T('#2a2e36');
    if (kind === 'van') { // a roof rack with a ladder lashed to it
      ctx.strokeStyle = rk; ctx.lineWidth = Math.max(0.035, env.px * 0.6); ctx.beginPath(); ctx.moveTo(c0 + 0.4, c.h + 0.16); ctx.lineTo(c1 - 0.5, c.h + 0.16); for (let k = 0; k < 4; k++) { const rx = c0 + 0.5 + k * ((c1 - c0 - 1.1) / 3); ctx.moveTo(rx, c.h); ctx.lineTo(rx, c.h + 0.16); } ctx.stroke();
      if (s > 13) { ctx.strokeStyle = T('#c9ced3'); ctx.beginPath(); ctx.moveTo(c0 + 0.7, c.h + 0.21); ctx.lineTo(c1 - 0.9, c.h + 0.21); ctx.moveTo(c0 + 0.7, c.h + 0.3); ctx.lineTo(c1 - 0.9, c.h + 0.3); for (let rx = c0 + 0.85; rx < c1 - 0.9; rx += 0.32) { ctx.moveTo(rx, c.h + 0.21); ctx.lineTo(rx, c.h + 0.3); } ctx.stroke(); }
    } else if (kind === 'suv') { ctx.strokeStyle = rk; ctx.lineWidth = Math.max(0.035, env.px * 0.6); ctx.beginPath(); ctx.moveTo(c0 + 0.5, c.h + 0.07); ctx.lineTo(c1 - 0.6, c.h + 0.07); ctx.moveTo(c0 + 0.6, c.h); ctx.lineTo(c0 + 0.6, c.h + 0.07); ctx.moveTo(c1 - 0.7, c.h); ctx.lineTo(c1 - 0.7, c.h + 0.07); ctx.stroke(); R4(ctx, -L / 2 - 0.1, by + 0.25, 0.14, 0.5, tyre); }
    else if (kind === 'pickup') { R4(ctx, -L / 2 + 0.06, c.body, c0 + L / 2 - 0.1, 0.06, dk2); R4(ctx, c0 - 0.2, c.body, 0.16, 0.3, dk2); if (s > 13) { R4(ctx, -L / 2 + 0.5, c.body + 0.04, 0.9, 0.2, T('#6b5440')); R4(ctx, -L / 2 + 1.5, c.body + 0.04, 0.5, 0.14, T('#3f5a52')); } }
    else if (kind === 'limo') { R4(ctx, -L / 2 + 0.2, c.body - 0.16, L - 0.5, 0.03, chrome); line(ctx, -L * 0.42, c.body, -L * 0.45, c.body + 0.5, rk, 0.02, env); }
    else if (kind === 'truck') { R4(ctx, c0 + 0.02, c.body, 0.1, c.h - c.body + 0.25, rk); R4(ctx, c1 - 0.2, by - 0.05, 0.42, 0.14, rk); if (s > 13) { R4(ctx, c0 + 0.3, c.h - 0.04, c1 - c0 - 0.35, 0.16, dk); ctx.fillStyle = T('#e8a23a', true); for (let k = 0; k < 3; k++) ctx.fillRect(c0 + 0.5 + k * 0.45, c.h + 0.12, 0.1, 0.05); R4(ctx, wx[0] + c.wheel * 1.3, by + 0.02, 0.9, 0.3, dk2); } }
    else if (kind === 'sedan' && s > 13) line(ctx, -L * 0.3, c.h - 0.02, -L * 0.36, c.h + 0.3, rk, 0.02, env);
  }
  // lights: off on parked scenery, on at night for anything driven, brake lights once it has stopped
  if (st && st.moving) st._kxMoved = true;
  const lampsOn = night && !!st, braking = lampsOn && st._kxMoved && !st.moving;
  R4(ctx, L / 2 - 0.2, c.body - 0.28, 0.2, 0.16, lampsOn ? '#fff3c4' : S.tone('#e8e4d0', P));
  R4(ctx, -L / 2, c.body - 0.26, 0.14, 0.14, lampsOn ? (braking ? '#ff5a4a' : '#d83a30') : S.tone('#a8322a', P));
  if (s > 13) { R4(ctx, L / 2 - 0.2, c.body - 0.28, 0.2, 0.03, 'rgba(0,0,0,0.25)'); R4(ctx, L / 2 - 0.16, c.body - 0.42, 0.14, 0.07, T('#e8a23a', lampsOn)); R4(ctx, -L / 2, c.body - 0.36, 0.1, 0.07, T('#e8a23a', lampsOn)); }
  if (pitch) ctx.restore();
  // wheels
  for (let i = 0; i < 2; i++) {
    const fl = flat && flat[i], r = c.wheel, cy = r * (fl ? 0.8 : 1);
    ctx.fillStyle = tyre; ctx.beginPath(); ctx.ellipse(wx[i], cy, r * (fl ? 1.06 : 1), r * (fl ? 0.8 : 1), 0, 0, TAU); ctx.fill();
    if (fl && s > 6) { ctx.beginPath(); ctx.ellipse(wx[i], r * 0.16, r * 1.22, r * 0.2, 0, 0, TAU); ctx.fill(); }                 // the tyre spread on the road
    circ(ctx, wx[i], cy, r * 0.45, rimC);
    if (s > 13) {
      // a hub cap with five slots, turning with the wheel
      const a0 = -(x * dir) / r;
      circ(ctx, wx[i], cy, r * 0.56, T('#aab1b8')); circ(ctx, wx[i], cy, r * 0.42, rimC);
      ctx.fillStyle = T('#4a5058'); ctx.beginPath(); for (let k = 0; k < 5; k++) { const a = a0 + (k * TAU) / 5, hx = wx[i] + Math.cos(a) * r * 0.3, hy = cy + Math.sin(a) * r * 0.3; ctx.moveTo(hx + r * 0.08, hy); ctx.arc(hx, hy, r * 0.08, 0, TAU); } ctx.fill();
      circ(ctx, wx[i], cy, r * 0.12, T('#d6dbe0'));
      if (!fl) { ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = Math.max(0.02, env.px * 0.5); ctx.beginPath(); ctx.arc(wx[i], cy, r * 0.82, Math.PI * 0.15, Math.PI * 0.6); ctx.stroke(); }
    }
  }
  if (lampsOn) {
    kxGlow(ctx, '#fff0be', L / 2 - 0.05, c.body - 0.2, st.moving ? 1.1 : 0.7, st.moving ? 0.6 : 0.35);
    kxGlow(ctx, '#ff4a3d', -L / 2 + 0.04, c.body - 0.19, braking ? 1.0 : 0.5, braking ? 0.7 : 0.35);
    if (braking && s > 5) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.22; ctx.drawImage(kxBlob('#ff4a3d'), -L / 2 - 2.2, -0.12, 2.6, 0.3); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  }
  if (night && st && st.moving) { // headlight beam, and its patch on the road ahead
    ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(L / 2, 0, L / 2 + 9, 0); g.addColorStop(0, 'rgba(255,240,190,0.28)'); g.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(L / 2, c.body - 0.2); ctx.lineTo(L / 2 + 9, c.body + 0.9); ctx.lineTo(L / 2 + 9, 0); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.3; ctx.drawImage(kxBlob('#fff0be'), L / 2 + 0.5, -0.22, 7, 0.5); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}
// A side window that can be wound down. st.pane[i] = { a, b, t0, dur, gone }: the pane moves
// from a to b (0 = shut, 1 = all the way down) over dur seconds from time t0.
function kxPaneAt(pn, t) { return lerp(pn.a, pn.b, smooth((t - pn.t0) / pn.dur)); }
// Wind window i of vehicle v down (down = true) or back up, starting now. The picture and the
// simulation must agree, so for bullets the glass is gone from the moment the pane is halfway
// down until it is halfway back up. st.glass[i] is the flag the simulation reads (true: no
// glass to break); pane.gone remembers that the window took the glass away, not a bullet, so
// the car is not drawn with broken glass and the glass comes back when the window goes up.
function carWindow(sim, v, i, down, dur) {
  const st = v.st; st.pane = st.pane || [];
  const was = st.pane[i], pn = st.pane[i] = { a: was ? kxPaneAt(was, sim.t) : 0, b: down ? 1 : 0, t0: sim.t, dur: dur || 1.2, gone: !!(was && was.gone) };
  sim.after(pn.dur / 2, () => {
    if (st.pane[i] !== pn) return; // wound the other way since
    if (down && !st.glass[i]) { st.glass[i] = true; pn.gone = true; }
    else if (!down && pn.gone) { st.glass[i] = false; pn.gone = false; }
  });
}
// The elevated train: three cars, each with doors, a row of lit windows, roof gear and trucks.
function kxTrain(ctx, env, S, P, c, col, dk, gl, st, dir) {
  const L = c.len, car = L / 3, s = env.s, night = S.pal.dark > 0.3, T = (q, l) => S.tone(q, P, l);
  const stripe = T((st && st.stripe) || '#d6a12a'), winC = night ? T('#ffe7b3', true) : gl, dk2 = T('#15181d'), roofC = T('#3a4048'), hi = 'rgba(255,255,255,0.14)';
  for (let i = 0; i < 3; i++) {
    const x0 = -L / 2 + i * car, front = i === 2, rear = i === 0;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0 + 0.4, 0.5); ctx.lineTo(x0 + car - 0.4, 0.5); ctx.lineTo(x0 + car - 0.4, c.h - 0.3); ctx.quadraticCurveTo(x0 + car - 0.5, c.h, x0 + car - 1.2, c.h); ctx.lineTo(x0 + 1.2, c.h); ctx.quadraticCurveTo(x0 + 0.5, c.h, x0 + 0.4, c.h - 0.3); ctx.closePath(); ctx.fill();
    if (s > 4) { R4(ctx, x0 + 1.2, c.h - 0.16, car - 2.4, 0.16, roofC); R4(ctx, x0 + 0.4, 0.5, car - 0.8, 0.5, dk); R4(ctx, x0 + 0.4, 1.0, car - 0.8, 0.05, hi); }
    R4(ctx, x0 + 0.4, 1.3, car - 0.8, 0.22, stripe);
    const ww = (car - 3.2) / 7;
    ctx.fillStyle = winC; ctx.beginPath();
    for (let w = 0; w < 7; w++) ctx.rect(x0 + 1.6 + w * ww, 1.9, ww - 0.5, 1.1);
    ctx.fill();
    if (s > 5) {
      // sliding doors between the windows, each with its own narrow panes
      ctx.fillStyle = dk; ctx.beginPath(); for (const w of [1, 5]) ctx.rect(x0 + 1.6 + w * ww + ww - 0.5 + 0.04, 0.62, 0.42, 2.5); ctx.fill();
      ctx.fillStyle = winC; ctx.beginPath(); for (const w of [1, 5]) { const dx = x0 + 1.6 + w * ww + ww - 0.5 + 0.04; ctx.rect(dx + 0.05, 1.9, 0.13, 1.0); ctx.rect(dx + 0.24, 1.9, 0.13, 1.0); } ctx.fill();
      if (s > 9) {
        // seat backs and a grab rail inside, window frames outside, panel seams along the side
        ctx.fillStyle = night ? T('#b98a52', true) : T('#22303f'); ctx.beginPath(); for (let w = 0; w < 7; w++) { const wx = x0 + 1.6 + w * ww; ctx.rect(wx + 0.12, 1.9, 0.5, 0.34); ctx.rect(wx + ww - 1.15, 1.9, 0.5, 0.34); ctx.rect(wx, 2.86, ww - 0.5, 0.04); } ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); for (let w = 0; w < 7; w++) { const wx = x0 + 1.6 + w * ww; ctx.rect(wx, 2.96, ww - 0.5, 0.04); ctx.rect(wx + (ww - 0.5) / 2 - 0.02, 1.9, 0.04, 1.1); } for (let px = x0 + 2.4; px < x0 + car - 1; px += 2.9) ctx.rect(px, 0.55, Math.max(0.02, env.px * 0.5), 1.3); ctx.fill();
        ctx.fillStyle = 'rgba(200,225,255,0.14)'; ctx.beginPath(); for (let w = 0; w < 7; w++) { const wx = x0 + 1.6 + w * ww; ctx.moveTo(wx + (ww - 0.5) * 0.15, 1.9); ctx.lineTo(wx + (ww - 0.5) * 0.4, 1.9); ctx.lineTo(wx + (ww - 0.5) * 0.25, 3.0); ctx.lineTo(wx, 3.0); ctx.closePath(); } ctx.fill();
        // roof gear
        ctx.fillStyle = roofC; ctx.beginPath(); ctx.rect(x0 + car * 0.22, c.h, 3.2, 0.22); ctx.rect(x0 + car * 0.62, c.h, 3.2, 0.22); ctx.rect(x0 + car * 0.46, c.h, 0.9, 0.14); ctx.fill();
      }
    }
    // trucks and wheels
    R4(ctx, x0 + 1.5, 0.1, 3.4, 0.5, dk2); R4(ctx, x0 + car - 4.9, 0.1, 3.4, 0.5, dk2);
    if (s > 5) {
      ctx.fillStyle = T('#0e1014'); ctx.beginPath(); for (const bx of [x0 + 1.5, x0 + car - 4.9]) for (const wx of [0.7, 2.7]) { ctx.moveTo(bx + wx + 0.42, 0.42); ctx.arc(bx + wx, 0.42, 0.42, 0, TAU); } ctx.fill();
      if (s > 9) { ctx.fillStyle = T('#6c737a'); ctx.beginPath(); for (const bx of [x0 + 1.5, x0 + car - 4.9]) for (const wx of [0.7, 2.7]) { ctx.moveTo(bx + wx + 0.16, 0.42); ctx.arc(bx + wx, 0.42, 0.16, 0, TAU); } ctx.fill(); R4(ctx, x0 + car * 0.36, 0.2, car * 0.28, 0.36, dk2); R4(ctx, x0 + car * 0.4, 0.26, 0.9, 0.22, T('#3a4048')); }
      if (i < 2) R4(ctx, x0 + car - 0.4, 0.75, 0.8, 2.3, dk2);                                              // the bellows between cars
    }
    if (front && s > 4) {
      // the driver's end: windscreen, destination blind, a headlight
      R4(ctx, x0 + car - 1.15, 1.9, 0.6, 1.1, winC); R4(ctx, x0 + car - 1.3, 0.62, 0.05, 2.6, dk);
      if (s > 9) R4(ctx, x0 + car - 2.6, 3.12, 1.2, 0.26, T('#f4c542', true));
      circ(ctx, x0 + car - 0.5, 1.15, 0.13, night ? '#fff3c4' : T('#e8e4d0')); if (night) { kxGlow(ctx, '#fff0be', x0 + car - 0.45, 1.15, 1.6, 0.6); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.16; ctx.drawImage(kxBlob('#fff0be'), x0 + car - 0.4, 0.2, 12, 2); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (rear && s > 4) { R4(ctx, x0 + 0.55, 1.9, 0.6, 1.1, winC); circ(ctx, x0 + 0.5, 1.15, 0.11, night ? '#ff4a3d' : T('#a8322a')); if (night) kxGlow(ctx, '#ff4a3d', x0 + 0.5, 1.15, 0.9, 0.5); }
  }
}
// A parked car that never moves: scenery and cover.
K.parked = function (S, P, kind, x, dir, col, o) {
  o = o || {}; const c = CARS[kind], y = o.y || 0;
  P.add({ x0: x - c.len / 2 - 1, x1: x + c.len / 2 + 1, layer: o.layer === undefined ? 2 : o.layer, draw(ctx, env) { drawCar(ctx, env, S, P, kind, x, y, dir, col, null); } });
  P.solid(x - c.len / 2, y, c.len, c.body, 'thin');
  P.solid(x + (dir > 0 ? c.cab[0] : -c.cab[1]) * c.len, y + c.body, (c.cab[1] - c.cab[0]) * c.len, c.h - c.body, 'glasswall');
};

// ---- doors that open for people ------------------------------------------------
// Scenes draw their doors shut, and the simulation simply hides a person who walks into a
// door and shows one who comes out of it. Drawn on its own, that is somebody vanishing into a
// closed door. K.swingDoor draws over a door: the inside (dark, or lit) and the leaf turned
// back on its hinge, eased open and shut over a third of a second. Picture only: the
// simulation never reads it.
//   o = { H, x, y, w, h, open(sim), hinge, lit, col, layer }
//   H       the mission's handles; the mission keeps its simulation in H.sim (see start())
//   open    true while the door should stand open
//   hinge   -1 hinged on the left, 1 on the right, 0 a pair of doors opening from the middle
//   lit     false for a dark inside, true (or a colour) for a lit one
//   col     the colour of the door (its edge shows as it turns)
K.swingDoor = function (S, P, o) {
  const st = { k: 0, t: null }, hinge = o.hinge === undefined ? -1 : o.hinge;
  P.add({ x0: o.x - 0.6, x1: o.x + o.w + 0.6, layer: o.layer === undefined ? 1 : o.layer, draw(ctx, env) {
    const sim = o.H && o.H.sim; if (!sim) return;
    const want = o.open(sim) ? 1 : 0;
    if (st.t === null || env.t < st.t || env.t - st.t > 1) st.k = want; else st.k = approach(st.k, want, (env.t - st.t) / 0.33);
    st.t = env.t;
    const k = smooth(st.k); if (k < 0.01 || o.x > env.x1 || o.x + o.w < env.x0) return;
    // Only the gap is painted: the leaf keeps the scene's own drawing of the door (so it starts
    // to open looking exactly as it did shut), with its free edge showing and a little shade as
    // it turns away from us.
    const x = o.x, y = o.y, w = o.w, h = o.h, s = env.s, cs = Math.cos(k * 1.35);
    const base = o.col || '#4a3a2c', edge = S.tone(lighten(base, 0.18), P);
    const leaves = hinge === 0 ? [[x, (w / 2) * cs, 1], [x + w - (w / 2) * cs, (w / 2) * cs, -1]] : hinge < 0 ? [[x, w * cs, 1]] : [[x + w - w * cs, w * cs, -1]];
    const g0 = hinge > 0 ? x : hinge < 0 ? x + w * cs : x + (w / 2) * cs, g1 = hinge > 0 ? x + w - w * cs : hinge < 0 ? x + w : x + w - (w / 2) * cs;
    R4(ctx, g0, y, g1 - g0, h, o.lit ? S.tone(o.lit === true ? '#efd29a' : o.lit, P, true) : S.tone('#0b0e13', P));
    if (o.lit && s > 4) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(g0, y + h * 0.88, g1 - g0, h * 0.12); } // the shade under the lintel inside
    leaves.forEach(([lx, lw, side]) => {
      if (lw < env.px * 0.5) return;
      ctx.fillStyle = 'rgba(0,0,0,' + (0.3 * k).toFixed(3) + ')'; ctx.fillRect(lx, y, lw, h);
      const fe = Math.max(0.035, env.px), ex = side > 0 ? lx + lw : lx - fe;
      R4(ctx, ex, y, fe, h, edge);
    });
  } });
};
// Is anybody in `ids` going through a door at x right now? Somebody within `near` metres of
// it who is walking, or who is about to be hidden there, or somebody hidden there who is about
// to be shown (looking past steps that take no time, such as a change of clothes). Somebody
// who only stands about near the door does not hold it open.
const KX_NO_TIME = { look: 1, emit: 1, face: 1, anim: 1, speed: 1, role: 1, say: 1, call: 1 };
K.doorBusy = function (sim, ids, x, near, lead) {
  for (let i = 0; i < ids.length; i++) {
    const a = sim.byId[ids[i]]; if (!a || a.dead || a.gone || a.inVeh || Math.abs(a.x - x) > near) continue;
    let pc = a.pc, op = a.routine[pc];
    while (op && KX_NO_TIME[op[0]]) op = a.routine[++pc];
    if (!a.hidden) { if (a.goal !== null || (op && op[0] === 'hide' && a.wait < 0.3)) return true; continue; }
    if (op && op[0] === 'show' && a.wait < (lead === undefined ? 0.45 : lead) && !a.waitFor) return true;
  }
  return false;
};

// ---- an envelope in somebody's hand ----------------------------------------------
// The figures have no envelope to carry, so a mission that hands one about draws it here: in
// the near hand of whoever o.who(sim) names (an actor id, or null for nobody), lying along the
// forearm a little past the fingers. Inside a car only the part that shows through that
// person's window is drawn, as with the person. One item per plane the holder may be on.
//   o = { H, who(sim), col }
K.heldEnvelope = function (S, P, o) {
  const paper = S.tone(o.col || '#efe6cf', P), fold = S.tone(darken(o.col || '#efe6cf', 0.38), P), ink = S.tone('#13161b', P);
  P.add({ x0: -1e4, x1: 1e4, layer: 2, draw(ctx, env) {
    const sim = o.H && o.H.sim, who = sim && o.who(sim); if (!who || env.s < 2.2) return;
    const a = sim.byId[who]; if (!a || a.gone || a.hidden || a.plane !== P) return;
    const J = actorJoints(a), hx = a.x + J.haR[0], hy = a.y + J.haR[1];
    if (hx < env.x0 - 1 || hx > env.x1 + 1) return;
    ctx.save();
    const v = a.inVeh;
    if (v) {
      const c = v.def, lx = c.seats[a.seat] * c.len; let wi = -1;
      for (let w = 0; w < c.win.length; w++) if (lx >= c.win[w][0] * c.len - 0.05 && lx <= c.win[w][1] * c.len + 0.05) wi = w;
      if (wi < 0) { ctx.restore(); return; }
      ctx.beginPath(); ctx.rect(v.x + v.dir * c.win[wi][v.dir > 0 ? 0 : 1] * c.len, v.y + c.body + 0.06, (c.win[wi][1] - c.win[wi][0]) * c.len, c.h - c.body - 0.2); ctx.clip();
    }
    ctx.translate(hx, hy); ctx.rotate(Math.atan2(J.haR[1] - J.elR[1], J.haR[0] - J.elR[0]));
    R4(ctx, -0.04, -0.06, 0.24, 0.12, paper);
    if (env.s > 9) { ctx.strokeStyle = fold; ctx.lineWidth = Math.max(0.008, env.px * 0.7); ctx.beginPath(); ctx.moveTo(-0.04, -0.06); ctx.lineTo(0.06, 0); ctx.lineTo(-0.04, 0.06); ctx.stroke(); }
    if (env.s > 5) { ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(0, 0, 0.032, 0, TAU); ctx.fill(); } // the fingers round it
    ctx.restore();
  } });
};

// ---- a worker's power tool -------------------------------------------------------
// Some missions offer the noise of a jackhammer or a chainsaw as cover. This puts the tool in
// the worker's hands and makes it run exactly while that cover runs: the jackhammer chatters
// on the pavement and throws up grit, the chainsaw bites into a log on a sawbuck and sprays
// sawdust. If the worker stops working (frightened, or shot) the tool stays where he left it.
// Drawn on the worker's plane just before the people on it (his hands go over the grips),
// and behind anything that stands in front of him there. Picture only.
//   o = { H, who (actor id), kind: 'jackhammer' | 'chainsaw', cover (the cover's name) }
K.powerTool = function (S, P, o) {
  const at = { x: null, y: 0, f: 1, hx: 0, hy: 0 }, chain = o.kind === 'chainsaw';
  const T = (hex, self) => S.tone(hex, P, self);
  if (chain) { // the log he is cutting, on a sawbuck in front of where he stands (behind him in the picture, so it hides nothing)
    P.add({ x0: -1e4, x1: 1e4, layer: 0, draw(ctx, env) {
      if (at.x === null) { const a = o.H && o.H.sim && o.H.sim.byId[o.who]; if (!a) return; at.x = a.x; at.y = a.y; at.f = a.face < 0 ? -1 : 1; }
      if (env.s < 2 || at.x < env.x0 - 3 || at.x > env.x1 + 3) return;
      const f = at.f, lx = at.x + f * 0.82, y = at.y, wood = T('#7a5a3c'), bark = T('#4f3a28'), end = T('#c9a878');
      ctx.strokeStyle = T('#5a4634'); ctx.lineWidth = Math.max(0.045, env.px); ctx.beginPath();
      for (const dx of [-0.42, 0.42]) { ctx.moveTo(lx + dx - 0.22, y); ctx.lineTo(lx + dx + 0.18, y + 0.66); ctx.moveTo(lx + dx + 0.22, y); ctx.lineTo(lx + dx - 0.18, y + 0.66); }
      ctx.stroke();
      R4(ctx, lx - 0.72, y + 0.52, 1.44, 0.24, wood); R4(ctx, lx - 0.72, y + 0.52, 1.44, 0.06, bark);
      if (env.s > 8) { R4(ctx, f > 0 ? lx - 0.75 : lx + 0.69, y + 0.53, 0.06, 0.22, end); ctx.fillStyle = T('#d8c39a'); ctx.beginPath(); ctx.ellipse(at.x + f * 0.42, y + 0.02, 0.3, 0.05, 0, 0, TAU); ctx.fill(); } // the cut end, and the sawdust below it
    } });
  }
  P.add({ x0: -1e4, x1: 1e4, layer: 1, draw(ctx, env) {
    const sim = o.H && o.H.sim; if (!sim || env.s < 2) return;
    const a = sim.byId[o.who]; if (!a || a.gone || a.plane !== P) return;
    if (!a.dead && !a.hidden && a.anim === 'work') {
      const J = actorJoints(a); at.f = J.f < 0 ? -1 : 1; at.x = a.x; at.y = a.y;
      at.hx = a.x + (J.haR[0] + J.haL[0]) / 2; at.hy = a.y + (J.haR[1] + J.haL[1]) / 2; at.held = true;
    } else at.held = false;
    if (at.x === null || at.x < env.x0 - 3 || at.x > env.x1 + 3) return;
    const on = at.held && sim.covered() && sim.coverName === o.cover, f = at.f, t = env.t, y = at.y, s = env.s;
    const steel = T('#8d949a'), dark = T('#2a2e36'), paint = T(chain ? '#e8762a' : '#d8b52a');
    if (!chain) {
      // the jackhammer: T handle in his hands, the body, the chisel on the ground, its air hose trailing behind him
      const cx = at.held ? at.hx + f * 0.04 : at.x + f * 0.55, top = at.held ? at.hy : y + 0.95, vib = on ? Math.sin(t * 150) * 0.014 : 0;
      ctx.strokeStyle = dark; ctx.lineWidth = Math.max(0.035, env.px * 0.8); ctx.beginPath(); ctx.moveTo(cx - f * 0.07, top - 0.3); ctx.quadraticCurveTo(cx - f * 0.6, y + 0.5, cx - f * 1.0, y + 0.03); ctx.lineTo(cx - f * 3.2, y + 0.03); ctx.stroke();
      R4(ctx, cx - 0.018, y, 0.036, 0.36 + vib, steel);
      R4(ctx, cx - 0.07, y + 0.34 + vib, 0.14, top - y - 0.36, paint);
      if (s > 6) { R4(ctx, cx - 0.07, y + 0.34 + vib, 0.14, 0.06, dark); R4(ctx, cx - 0.035, y + 0.42 + vib, 0.07, top - y - 0.48, T('#f0d36a')); }
      R4(ctx, cx - 0.21, top - 0.03 + vib, 0.42, 0.055, dark);
      if (on) { // grit and dust kicked up round the chisel
        for (let i = 0; i < 6; i++) { const u = (t * 1.7 + i / 6) % 1, sd = i % 2 ? 1 : -1; ctx.globalAlpha = (1 - u) * 0.45; circ(ctx, cx + sd * (0.08 + 0.45 * u), y + 0.05 + 0.4 * u * (1 - 0.4 * u), 0.05 + 0.16 * u, T('#cfc7b8')); }
        ctx.globalAlpha = 1;
        if (s > 6) { ctx.fillStyle = T('#8a8378'); for (let i = 0; i < 5; i++) { const u = (t * 3.1 + i * 0.37) % 1, sd = i % 2 ? 1 : -1; ctx.fillRect(cx + sd * (0.05 + 0.5 * u), y + 0.02 + 0.5 * u - 0.9 * u * u, 0.025, 0.025); } }
      }
      return;
    }
    // the chainsaw: the engine in his hands, the bar down into the log
    const hx = at.held ? at.hx : at.x + f * 0.82, hy = at.held ? at.hy : y + 0.84, ang = at.held ? -0.62 : -0.05, bx = hx + f * 0.12, by = hy - 0.05;
    const tx = bx + f * Math.cos(ang) * 0.46, ty = by + Math.sin(ang) * 0.46, shake = on ? Math.sin(t * 120) * 0.008 : 0;
    ctx.strokeStyle = steel; ctx.lineWidth = Math.max(0.05, env.px); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx, by + shake); ctx.lineTo(tx, ty + shake); ctx.stroke(); ctx.lineCap = 'butt';
    if (on && s > 8) { ctx.strokeStyle = dark; ctx.lineWidth = Math.max(0.012, env.px * 0.6); ctx.setLineDash([0.03, 0.03]); ctx.lineDashOffset = -t * 2.4; ctx.beginPath(); ctx.moveTo(bx, by + 0.025 + shake); ctx.lineTo(tx, ty + 0.025 + shake); ctx.stroke(); ctx.setLineDash([]); }
    R4(ctx, hx - 0.16, hy - 0.11 + shake, 0.32, 0.19, paint); R4(ctx, hx - 0.1, hy + 0.08 + shake, 0.2, 0.04, dark);
    if (on) {
      // sawdust thrown back off the bar, and a little exhaust from the engine
      for (let i = 0; i < 7; i++) { const u = (t * 2.2 + i / 7) % 1; ctx.globalAlpha = (1 - u) * 0.7; circ(ctx, tx - f * (0.1 + 0.6 * u), ty - 0.05 - 0.55 * u * u + 0.12 * u, 0.02 + 0.03 * u, T('#e3cf9f')); }
      for (let i = 0; i < 3; i++) { const u = (t * 0.9 + i / 3) % 1; ctx.globalAlpha = (1 - u) * 0.3; circ(ctx, hx - f * (0.2 + 0.2 * u), hy + 0.05 + 0.6 * u, 0.06 + 0.14 * u, T('#b9bec4')); }
      ctx.globalAlpha = 1;
    }
  } });
};

// ---- assorted props -----------------------------------------------------------
// A plain block: a wall, a roof, a crate, a stack.  New: o.plain = true leaves off the
// light top edge and the shaded side that every block now gets.
K.box = function (S, P, x, y, w, h, col, o) {
  o = o || {}; const c = S.tone(col, P, o.selfLit), d = S.tone(darken(col, 0.2), P, o.selfLit);
  const hi = S.tone(lighten(col, 0.14), P, o.selfLit), wood = o.mat === 'wood';
  // a big plain block takes its shade in the fill itself; a ribbed one is shaded over its ribs
  const shadeIn = !o.ribs && !o.plain && !o.selfLit && w * h > 10;
  P.add({ x0: x, x1: x + w, layer: o.layer || 0, draw(ctx, env) {
    const s = env.s;
    if (shadeIn && s > 5) kxShadeFill(ctx, c, 0.14, y, y + h, x, w, Math.max(y, env.y0 === undefined ? y : env.y0 - 1), Math.min(y + h, env.y1 === undefined ? y + h : env.y1 + 1)); else R4(ctx, x, y, w, h, c);
    if (o.ribs && s > 2.2) {
      ctx.fillStyle = d; ctx.beginPath(); const a = x + 0.3 + Math.max(0, Math.floor((env.x0 - x - 0.3) / o.ribs)) * o.ribs; for (let xx = a; xx < Math.min(x + w, env.x1); xx += o.ribs) ctx.rect(xx, y + 0.15, 0.1, h - 0.3); ctx.fill();
      if (s > 9) { ctx.fillStyle = hi; ctx.beginPath(); for (let xx = a; xx < Math.min(x + w, env.x1); xx += o.ribs) if (xx + 0.14 < x + w) ctx.rect(xx + 0.1, y + 0.15, 0.04, h - 0.3); ctx.fill(); }
      if (wood && s > 9) { // sawn ends: a ring or two on each
        ctx.strokeStyle = d; ctx.lineWidth = Math.max(0.015, env.px * 0.5); ctx.beginPath(); for (let xx = a; xx < Math.min(x + w, env.x1) - o.ribs * 0.5; xx += o.ribs) for (let yy = y + 0.3; yy < y + h - 0.2; yy += o.ribs) { const k = kxH(xx, yy); ctx.moveTo(xx + o.ribs * 0.55 + 0.1, yy); ctx.arc(xx + o.ribs * 0.55, yy, 0.05 + k * 0.05, 0, TAU); } ctx.stroke();
      }
    }
    if (o.band) R4(ctx, x, y + h - o.band, w, o.band, d);
    if (!o.plain && s > 5 && !o.selfLit) {
      if (h * s > 14) { R4(ctx, x, y + h - Math.max(0.04, env.px * 0.9), w, Math.max(0.04, env.px * 0.9), hi); const sw = Math.min(0.35, w * 0.07); R4(ctx, x + w - sw, y, sw, h - Math.max(0.04, env.px * 0.9), 'rgba(0,0,0,0.13)'); }
      if (w * h > 10 && !shadeIn) kxFadeAt(ctx, '#000000', Math.max(x, env.x0), y, Math.min(x + w, env.x1) - Math.max(x, env.x0), h, 0.14);
    }
    if (o.text) env.text(ctx, o.text, x + w / 2, y + h * 0.36, Math.min(h * 0.34, (w / o.text.length) * 1.2), S.tone(o.textCol || '#f1ede2', P, o.selfLit), 'center');
  } });
  if (o.solid !== false) P.solid(x, y, w, h, o.mat || 'wall');
};
// A shipping container, side on: corrugated wall inside a steel frame, corner castings,
// the locking bars of a side door, its markings, and the rust it has earned.
K.container = function (S, P, x, y, col, text) {
  const w = 6.1, h = 2.6, c = S.tone(col, P), d = S.tone(darken(col, 0.2), P), d2 = S.tone(darken(col, 0.42), P), hi = S.tone(lighten(col, 0.14), P), txt = S.tone('#f1ede2', P), rust = S.tone('#7a3a22', P), steel = S.tone('#c9ced3', P);
  const R = makeRng(Math.floor(x * 31 + y * 7) + 1201), rusts = [], dents = [];
  for (let i = 0; i < 6; i++) rusts.push([x + R.r(0.3, w - 0.5), R.r(0.3, 1.5), R.r(0.05, 0.12)]);
  for (let i = 0; i < 3; i++) dents.push([x + R.r(0.6, w - 1.2), y + R.r(0.4, h - 0.7), R.r(0.3, 0.7)]);
  const code = ['PCLU', 'HRBU', 'KSTU', 'MRWU'][R.i(0, 3)] + ' ' + R.i(100000, 999999) + ' ' + R.i(0, 9);
  P.add({ x0: x, x1: x + w, layer: 0, draw(ctx, env) {
    const s = env.s;
    R4(ctx, x, y, w, h, c);
    if (s > 2.2) {
      const step = s > 12 ? 0.21 : 0.42;
      ctx.fillStyle = d; ctx.beginPath(); for (let xx = x + 0.3; xx < x + w - 0.15; xx += step) ctx.rect(xx, y + 0.15, step * 0.24, h - 0.3); ctx.fill();
      if (s > 9) { ctx.fillStyle = hi; ctx.beginPath(); for (let xx = x + 0.3; xx < x + w - 0.2; xx += step) ctx.rect(xx + step * 0.24, y + 0.15, step * 0.14, h - 0.3); ctx.fill(); }
    }
    if (s > 5) {
      kxFadeAt(ctx, '#000000', x, y, w, h, 0.18);
      // frame and corner castings
      ctx.fillStyle = d2; ctx.beginPath(); ctx.rect(x, y, w, 0.15); ctx.rect(x, y + h - 0.15, w, 0.15); ctx.rect(x, y, 0.13, h); ctx.rect(x + w - 0.13, y, 0.13, h); ctx.fill();
      R4(ctx, x, y + h - 0.04, w, 0.04, hi);
      if (s > 9) {
        ctx.fillStyle = S.tone('#2a2e36', P); ctx.beginPath(); for (const q of [[0, 0], [w - 0.2, 0], [0, h - 0.17], [w - 0.2, h - 0.17]]) ctx.rect(x + q[0], y + q[1], 0.2, 0.17); ctx.fill();
        // rust running down from the top rail, and a dent or two
        ctx.fillStyle = rust; ctx.globalAlpha = 0.5; ctx.beginPath(); for (let i = 0; i < rusts.length; i++) { const q = rusts[i]; ctx.moveTo(q[0] - q[2], y + h - 0.15); ctx.lineTo(q[0] + q[2], y + h - 0.15); ctx.lineTo(q[0] + q[2] * 0.2, y + h - 0.15 - q[1]); ctx.closePath(); } ctx.rect(x + 0.13, y + 0.15, w - 0.26, 0.07); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); for (let i = 0; i < dents.length; i++) { const q = dents[i]; ctx.ellipse(q[0], q[1], q[2], q[2] * 0.4, 0.3, 0, TAU); } ctx.fill();
        // locking bars with their handles and keepers
        ctx.fillStyle = steel; ctx.beginPath(); for (const bx of [w - 1.9, w - 1.25, w - 0.75]) { ctx.rect(x + bx, y + 0.15, 0.05, h - 0.3); ctx.rect(x + bx - 0.05, y + 0.25, 0.15, 0.07); ctx.rect(x + bx - 0.05, y + h - 0.32, 0.15, 0.07); } ctx.rect(x + w - 1.9, y + h * 0.42, 0.3, 0.05); ctx.rect(x + w - 1.25, y + h * 0.42, 0.3, 0.05); ctx.fill();
        R4(ctx, x + w - 2.25, y + 0.15, Math.max(0.025, env.px * 0.6), h - 0.3, d2);
      }
    }
    if (text) env.text(ctx, text, x + (w - 2.3) / 2 + 0.13, y + h * 0.36, Math.min(h * 0.34, ((w - 2.4) / text.length) * 1.2), txt, 'center');
    if (s > 16) { env.text(ctx, code, x + 0.3, y + h - 0.5, 0.2, txt, 'left'); ctx.fillStyle = txt; ctx.globalAlpha = 0.7; for (let i = 0; i < 4; i++) ctx.fillRect(x + w - 2.15, y + 0.5 + i * 0.12, 0.7 - (i % 2) * 0.2, 0.04); ctx.globalAlpha = 1; }
  } });
  P.solid(x, y, w, h, 'hard');
};

K.bench = function (S, P, x, o) {
  o = o || {}; const c = S.tone('#5b4634', P), m = S.tone('#22262c', P), y = o.y || 0, ch = S.tone('#75593f', P), cd = S.tone('#42321f', P);
  P.add({ x0: x - 1, x1: x + 1, layer: 0, draw(ctx, env) {
    const s = env.s;
    if (s > 6) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y + 0.02, 1.05, 0.06, 0, 0, TAU); ctx.fill(); }
    R4(ctx, x - 0.9, y + 0.42, 1.8, 0.09, c); R4(ctx, x - 0.9, y + 0.6, 1.8, 0.08, c); R4(ctx, x - 0.9, y + 0.8, 1.8, 0.08, c);
    if (s > 12) {
      // a lit edge and a shaded edge on each slat, bolt heads, and cast-iron ends with arm rests
      ctx.fillStyle = ch; ctx.beginPath(); ctx.rect(x - 0.9, y + 0.49, 1.8, 0.02); ctx.rect(x - 0.9, y + 0.66, 1.8, 0.02); ctx.rect(x - 0.9, y + 0.86, 1.8, 0.02); ctx.fill();
      ctx.fillStyle = cd; ctx.beginPath(); ctx.rect(x - 0.9, y + 0.42, 1.8, 0.02); ctx.rect(x - 0.9, y + 0.6, 1.8, 0.02); ctx.rect(x - 0.9, y + 0.8, 1.8, 0.02); for (const bx of [-0.75, 0.75]) for (const by of [0.46, 0.64, 0.84]) ctx.rect(x + bx - 0.015, y + by - 0.015, 0.03, 0.03); ctx.fill();
      ctx.strokeStyle = m; ctx.lineWidth = Math.max(0.05, env.px * 0.7); ctx.lineCap = 'round'; ctx.beginPath();
      for (const sx of [-1, 1]) { const bx = x + sx * 0.75; ctx.moveTo(bx - 0.12, y); ctx.quadraticCurveTo(bx - 0.02, y + 0.2, bx, y + 0.42); ctx.moveTo(bx + 0.12, y); ctx.quadraticCurveTo(bx + 0.02, y + 0.2, bx, y + 0.42); ctx.moveTo(bx, y + 0.42); ctx.lineTo(bx, y + 0.92); ctx.moveTo(bx, y + 0.62); ctx.quadraticCurveTo(bx + sx * 0.2, y + 0.72, bx + sx * 0.17, y + 0.5); }
      ctx.stroke(); ctx.lineCap = 'butt';
    } else { line(ctx, x - 0.75, y, x - 0.75, y + 0.9, m, 0.07, env); line(ctx, x + 0.75, y, x + 0.75, y + 0.9, m, 0.07, env); }
  } });
};
K.table = function (S, P, x, o) {
  o = o || {}; const y = o.y || 0, m = S.tone('#2a2e36', P), top = S.tone(o.col || '#e9e4d6', P), topD = S.tone(darken(o.col || '#e9e4d6', 0.2), P), mH = S.tone('#555c66', P);
  const um = o.umbrella ? S.tone(o.umbrella, P) : null, um2 = S.tone('#f1ede2', P), umD = o.umbrella ? S.tone(darken(o.umbrella, 0.25), P) : null;
  P.add({ x0: x - 1.6, x1: x + 1.6, layer: o.layer || 0, draw(ctx, env) {
    const s = env.s, fine = s > 12;
    if (s > 6) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(x, y + 0.02, 1.2, 0.06, 0, 0, TAU); ctx.fill(); }
    line(ctx, x, y, x, y + 0.72, m, 0.07, env); R4(ctx, x - 0.55, y + 0.72, 1.1, 0.07, top); R4(ctx, x - 0.25, y, 0.5, 0.05, m);
    if (fine) { R4(ctx, x - 0.55, y + 0.72, 1.1, 0.025, topD); R4(ctx, x - 0.09, y + 0.66, 0.18, 0.06, m); poly(ctx, [x - 0.25, y + 0.05, x + 0.25, y + 0.05, x + 0.05, y + 0.14, x - 0.05, y + 0.14], m); R4(ctx, x + 0.18, y + 0.79, 0.09, 0.1, S.tone('#f6f1e4', P)); R4(ctx, x - 0.3, y + 0.79, 0.16, 0.02, S.tone('#f6f1e4', P)); }
    if (um) {
      line(ctx, x, y + 0.78, x, y + 2.5, m, 0.05, env);
      if (!fine) poly(ctx, [x - 1.5, y + 2.35, x + 1.5, y + 2.35, x, y + 2.95], um);
      else {
        // panels in two colours meeting at the top, with a scalloped hem
        for (let i = 0; i < 6; i++) { const xa = x - 1.5 + i * 0.5, xb = xa + 0.5; ctx.fillStyle = i % 2 ? um2 : um; ctx.beginPath(); ctx.moveTo(x + (xa - x) * 0.04, y + 2.95); ctx.lineTo(xa, y + 2.36); ctx.quadraticCurveTo((xa + xb) / 2, y + 2.24, xb, y + 2.36); ctx.lineTo(x + (xb - x) * 0.04, y + 2.95); ctx.closePath(); ctx.fill(); }
        poly(ctx, [x, y + 2.95, x + 1.5, y + 2.36, x + 0.5, y + 2.36], 'rgba(0,0,0,0.12)'); R4(ctx, x - 0.03, y + 2.93, 0.06, 0.12, m);
        ctx.strokeStyle = umD; ctx.lineWidth = Math.max(0.018, env.px * 0.5); ctx.beginPath(); ctx.moveTo(x, y + 2.3); ctx.lineTo(x - 0.9, y + 2.38); ctx.moveTo(x, y + 2.3); ctx.lineTo(x + 0.9, y + 2.38); ctx.stroke();
      }
    }
    // two chairs
    for (const sx of [-1, 1]) {
      line(ctx, x + sx * 0.95, y, x + sx * 0.95, y + 0.9, m, 0.05, env); line(ctx, x + sx * 0.6, y, x + sx * 0.6, y + 0.47, m, 0.05, env); line(ctx, x + sx * 0.6, y + 0.47, x + sx * 0.95, y + 0.47, m, 0.06, env);
      if (fine) { R4(ctx, x + sx * 0.775 - 0.2, y + 0.47, 0.4, 0.04, mH); ctx.strokeStyle = m; ctx.lineWidth = Math.max(0.025, env.px * 0.5); ctx.beginPath(); ctx.moveTo(x + sx * 0.95, y + 0.9); ctx.quadraticCurveTo(x + sx * 1.02, y + 0.95, x + sx * 0.99, y + 0.84); ctx.moveTo(x + sx * 0.95, y + 0.62); ctx.lineTo(x + sx * 0.91, y + 0.62); ctx.moveTo(x + sx * 0.95, y + 0.76); ctx.lineTo(x + sx * 0.91, y + 0.76); ctx.moveTo(x + sx * 0.6, y + 0.24); ctx.lineTo(x + sx * 0.95, y + 0.24); ctx.stroke(); }
    }
  } });
};
K.crane = function (S, P, x, h, reach, o) {
  o = o || {}; const c = S.tone(o.col || '#d6a12a', P), d = S.tone('#2a2e36', P), y = o.y || 0, cD = S.tone(darken(o.col || '#d6a12a', 0.3), P), night = S.pal.dark > 0.3;
  P.add({ x0: Math.min(x, x + reach) - 4, x1: Math.max(x, x + reach) + 6, layer: o.layer || 0, draw(ctx, env) {
    const s = env.s;
    ctx.strokeStyle = c; ctx.lineWidth = Math.max(0.22, env.px);
    ctx.beginPath(); ctx.moveTo(x - 0.8, y); ctx.lineTo(x - 0.8, y + h); ctx.moveTo(x + 0.8, y); ctx.lineTo(x + 0.8, y + h);
    ctx.moveTo(x - reach * 0.3, y + h); ctx.lineTo(x + reach, y + h); ctx.moveTo(x - reach * 0.3, y + h + 1.4); ctx.lineTo(x + reach, y + h + 1.4);
    ctx.moveTo(x, y + h + 5); ctx.lineTo(x + reach, y + h + 1.4); ctx.moveTo(x, y + h + 5); ctx.lineTo(x - reach * 0.3, y + h + 1.4); ctx.moveTo(x, y + h); ctx.lineTo(x, y + h + 5);
    ctx.stroke();
    if (s > 1.2) {
      ctx.lineWidth = Math.max(0.1, env.px * 0.7); ctx.beginPath();
      const y0 = env.y0 === undefined ? y : Math.max(y, y + Math.floor((env.y0 - y) / 1.6) * 1.6), y1 = env.y1 === undefined ? y + h : Math.min(y + h, env.y1 + 1.6);
      for (let yy = y0; yy < y1; yy += 1.6) { ctx.moveTo(x - 0.8, yy); ctx.lineTo(x + 0.8, yy + 1.6); ctx.moveTo(x + 0.8, yy); ctx.lineTo(x - 0.8, yy + 1.6); if (s > 6) { ctx.moveTo(x - 0.8, yy); ctx.lineTo(x + 0.8, yy); } }
      const n = Math.floor(Math.abs(reach) * 1.3 / 1.4); for (let i = 0; i < n; i++) { const xa = x - reach * 0.3 + (i * reach * 1.3) / n, xb = x - reach * 0.3 + ((i + 1) * reach * 1.3) / n; ctx.moveTo(xa, y + h); ctx.lineTo(xb, y + h + 1.4); if (s > 6) { ctx.moveTo(xb, y + h + 1.4); ctx.lineTo(xb, y + h); } } ctx.stroke();
    }
    R4(ctx, x - 1.4, y + h - 2.4, 2.8, 2.4, d); R4(ctx, x - 1.1, y + h - 1.9, 1.5, 1.2, S.tone(night ? S.pal.lit : S.pal.glass, P, true));
    R4(ctx, x - reach * 0.3 - 1.5, y + h - 1.6, 3, 1.8, S.tone('#6c737a', P));
    if (s > 5) {
      // the cab: a window bar and a door; the counterweight in slabs; a base under the mast; a lamp on the peak
      R4(ctx, x - 0.38, y + h - 1.9, 0.06, 1.2, d); R4(ctx, x - 1.1, y + h - 1.3, 1.5, 0.05, d); R4(ctx, x + 0.6, y + h - 2.25, 0.6, 1.9, S.tone('#3a404a', P)); R4(ctx, x - 1.5, y + h - 2.5, 3.0, 0.14, S.tone('#444a54', P));
      ctx.fillStyle = S.tone('#4a5058', P); ctx.beginPath(); for (let i = 1; i < 4; i++) ctx.rect(x - reach * 0.3 - 1.5 + i * 0.75, y + h - 1.6, Math.max(0.04, env.px * 0.6), 1.8); ctx.fill();
      R4(ctx, x - 1.7, y, 3.4, 0.45, S.tone('#8a8f96', P)); R4(ctx, x - 1.7, y + 0.41, 3.4, 0.04, S.tone('#a9aeb4', P));
      ctx.fillStyle = cD; ctx.beginPath(); for (let k = 0; k < 4; k++) ctx.rect(x - 0.9, y + h * (0.18 + k * 0.22), 1.8, 0.14); ctx.fill();
      const bl = Math.sin(env.t * 2.6) > 0.2; circ(ctx, x, y + h + 5.15, Math.max(0.14, env.px * 1.2), bl ? '#ff4a3d' : S.tone('#6a2520', P)); if (bl && night) kxGlow(ctx, '#ff4a3d', x, y + h + 5.15, 1.2, 0.6);
      if (s > 9) { // a ladder up the mast
        ctx.strokeStyle = cD; ctx.lineWidth = Math.max(0.035, env.px * 0.5); ctx.beginPath(); ctx.moveTo(x - 0.25, y + 0.45); ctx.lineTo(x - 0.25, y + h - 2.5); ctx.moveTo(x + 0.25, y + 0.45); ctx.lineTo(x + 0.25, y + h - 2.5);
        const l0 = env.y0 === undefined ? y + 0.45 : Math.max(y + 0.45, y + Math.floor((env.y0 - y) / 0.4) * 0.4), l1 = env.y1 === undefined ? y + h - 2.5 : Math.min(y + h - 2.5, env.y1);
        for (let yy = l0; yy < l1; yy += 0.4) { ctx.moveTo(x - 0.25, yy); ctx.lineTo(x + 0.25, yy); } ctx.stroke();
      }
    }
  } });
  P.solid(x - 0.8, y, 1.6, h, 'grid');
};
// A neon sign: glass tube lettering with a hot core, a halo, and the wall behind it tinted.
// Now and then it stutters. The flicker is only drawn; nothing else knows about it.
K.neon = function (S, P, x, y, text, col, size) {
  const sz = size || 0.8, wide = text.length * sz * 0.5, seed = kxH(x, y);
  P.add({ x0: x - Math.max(6, wide * 0.6 + 2), x1: x + Math.max(6, wide * 0.6 + 2), layer: 1, draw(ctx, env) {
    // mostly steady; every few seconds a short stutter, and a rare longer dip
    const t = env.t + seed * 50, cyc = Math.floor(t / 5.3), u = t / 5.3 - cyc, hk = kxH(cyc, seed * 9);
    let flick = 1;
    if (u > 0.82 && hk > 0.35) flick = Math.sin(t * 61) > 0.1 ? 1 : 0.3; else if (u < 0.05 && hk > 0.8) flick = 0.45;
    flick *= 0.94 + 0.06 * Math.sin(t * 13.7);
    const on = S.pal.dark > 0.2, c = on ? col : S.tone(col, P);
    if (on && env.s > 2) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3 * flick * S.pal.dark; ctx.drawImage(kxBlob(col), x - wide * 0.75 - 1.2, y - sz * 1.6, wide * 1.5 + 2.4, sz * 4.2); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    if (env.s > 9) { // the standoffs and the lead that feeds it
      const dk = S.tone('#15171b', P); R4(ctx, x - wide * 0.52, y - sz * 0.12, wide * 1.04, Math.max(0.03, env.px * 0.6), dk); line(ctx, x + wide * 0.52, y - sz * 0.1, x + wide * 0.52 + 0.2, y - sz * 0.8, dk, 0.025, env);
    }
    const ok = on && kxText(ctx, env, text, x, y, sz, flick > 0.6 ? '#fff6f0' : c, 'center', { strokes: [[c, sz * 0.34, 0.14 * flick], [c, sz * 0.2, 0.5 * flick], [c, sz * 0.1, flick]], alpha: 0.9 * flick, weight: '600' });
    if (!ok) { ctx.globalAlpha = flick; env.text(ctx, text, x, y, sz, c, 'center'); ctx.globalAlpha = 1; }
  } });
};
K.steps = function (S, P, x0, x1, y0, y1, col) { // a simple ramp or stair drawn as a wedge
  const c = S.tone(col || '#7f868c', P), d = S.tone(darken(col || '#7f868c', 0.22), P), hi = S.tone(lighten(col || '#7f868c', 0.16), P);
  P.add({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), layer: 0, draw(ctx, env) {
    poly(ctx, [x0, y0, x1, y1, x1, y0], c);
    const run = Math.abs(x1 - x0), rise = Math.abs(y1 - y0);
    if (env.s > 6 && rise > 0.3) {
      // steep enough to be stairs: mark the treads; either way, a lit top edge
      if (rise / run > 0.25) { const n = Math.max(2, Math.round(rise / 0.19)); ctx.fillStyle = d; ctx.beginPath(); for (let i = 1; i < n; i++) { const u = i / n, sx = lerp(x0, x1, u), sy = lerp(y0, y1, u); ctx.rect(Math.min(sx, x1), y0 < y1 ? y0 : sy, Math.max(0.02, env.px * 0.5), Math.abs(sy - y0)); } ctx.fill(); }
      ctx.strokeStyle = hi; ctx.lineWidth = Math.max(0.04, env.px * 0.8); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
  } });
};
K.tower = function (S, P, x, h, o) { // guard tower or water tower on legs with a cabin
  o = o || {}; const leg = S.tone('#3a3f47', P), cab = S.tone(o.col || '#6d5a45', P), y = o.y || 0, w = o.w || 3.4;
  const cabD = S.tone(darken(o.col || '#6d5a45', 0.2), P), cabH = S.tone(lighten(o.col || '#6d5a45', 0.14), P), roofC = S.tone(darken(o.col || '#6d5a45', 0.3), P), roofD = S.tone(darken(o.col || '#6d5a45', 0.45), P);
  const room = S.room((o.id || 'tw' + Math.round(x)), o.lit);
  P.add({ x0: x - w, x1: x + w, layer: 0, draw(ctx, env) {
    const s = env.s;
    line(ctx, x - w / 2, y, x - w / 2 + 0.4, y + h, leg, 0.16, env); line(ctx, x + w / 2, y, x + w / 2 - 0.4, y + h, leg, 0.16, env);
    line(ctx, x - w / 2, y + h * 0.1, x + w / 2 - 0.3, y + h * 0.9, leg, 0.08, env); line(ctx, x + w / 2, y + h * 0.1, x - w / 2 + 0.3, y + h * 0.9, leg, 0.08, env);
    if (s > 6) { // a brace across the middle, feet, and a ladder up one leg
      line(ctx, x - w / 2 + 0.2, y + h * 0.5, x + w / 2 - 0.2, y + h * 0.5, leg, 0.07, env); R4(ctx, x - w / 2 - 0.25, y, 0.5, 0.14, leg); R4(ctx, x + w / 2 - 0.25, y, 0.5, 0.14, leg);
      ctx.strokeStyle = leg; ctx.lineWidth = Math.max(0.035, env.px * 0.5); ctx.beginPath(); ctx.moveTo(x - 0.25, y); ctx.lineTo(x - 0.25, y + h); ctx.moveTo(x + 0.25, y); ctx.lineTo(x + 0.25, y + h); for (let yy = y + 0.35; yy < y + h; yy += 0.35) { ctx.moveTo(x - 0.25, yy); ctx.lineTo(x + 0.25, yy); } ctx.stroke();
    }
    R4(ctx, x - w / 2 - 0.3, y + h, w + 0.6, 0.25, leg);
    R4(ctx, x - w / 2, y + h + 0.25, w, 1.0, cab);
    if (s > 6) { // boarded sides
      ctx.fillStyle = cabD; ctx.beginPath(); for (let bx = x - w / 2 + 0.3; bx < x + w / 2 - 0.05; bx += 0.3) ctx.rect(bx, y + h + 0.25, Math.max(0.025, env.px * 0.5), 1.0); ctx.fill();
      R4(ctx, x - w / 2, y + h + 1.17, w, 0.08, cabH); R4(ctx, x - w / 2, y + h + 0.25, w, 0.06, cabD); R4(ctx, x - w / 2 - 0.3, y + h + 0.21, w + 0.6, 0.04, S.tone('#555b65', P));
    }
    R4(ctx, x - w / 2, y + h + 1.25, w, 1.25, room.lit ? S.tone('#ffd98a', P, true) : S.tone(S.pal.inRoom, P));
    if (room.lit && s > 6) { R4(ctx, x - w / 2, y + h + 2.3, w, 0.2, S.tone('#e0b868', P, true)); R4(ctx, x - 0.02, y + h + 2.2, 0.04, 0.3, S.tone('#8a6a3a', P, true)); poly(ctx, [x - 0.18, y + h + 2.2, x + 0.18, y + h + 2.2, x + 0.08, y + h + 2.32, x - 0.08, y + h + 2.32], S.tone('#fff3c4', P, true)); }
    line(ctx, x - w / 2, y + h + 1.25, x - w / 2, y + h + 2.5, leg, 0.14, env); line(ctx, x + w / 2, y + h + 1.25, x + w / 2, y + h + 2.5, leg, 0.14, env);
    if (room.lit && S.pal.dark > 0.3 && s > 3) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.2 * S.pal.dark; kxSpillAt(ctx, kxSpill('#ffd98a'), x - w / 2, y + h + 1.25, w, 1.25, 1.2); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  } });
  P.add({ x0: x - w, x1: x + w, layer: 1, draw(ctx, env) {
    poly(ctx, [x - w / 2 - 0.5, y + h + 2.5, x + w / 2 + 0.5, y + h + 2.5, x + w / 2, y + h + 3.3, x - w / 2, y + h + 3.3], roofC);
    if (env.s > 6) { poly(ctx, [x + 0.2, y + h + 2.5, x + w / 2 + 0.5, y + h + 2.5, x + w / 2, y + h + 3.3, x + 0.1, y + h + 3.3], roofD); R4(ctx, x - w / 2 - 0.5, y + h + 2.44, w + 1, 0.08, roofD); R4(ctx, x - w / 2, y + h + 3.27, w, 0.05, cabH); if (env.s > 12) { ctx.fillStyle = roofD; ctx.beginPath(); for (let k = 1; k < 4; k++) ctx.rect(x - w / 2 - 0.5 + k * 0.1, y + h + 2.5 + k * 0.2, w + 1 - k * 0.2, Math.max(0.02, env.px * 0.5)); ctx.fill(); } }
  } });
  P.solid(x - w / 2, y + h, w, 1.25, 'wood');
  P.open({ x: x - w / 2, y: y + h + 1.25, w, h: 1.25, room: room.id, glass: false, through: true });
  return { x, floor: y + h + 0.25, room: room.id };
};

// ---- static detail layers -------------------------------------------------------
// Small things that never move (stains, cracks, joints, moss, litter, clutter lying about)
// are given once and then drawn with a handful of fills a frame, however many there are.
// Shapes are gathered by colour (one fill draws all of one colour); each colour is cut into
// strips along the plane so only what is on screen is drawn, and each strip is kept as a
// ready-made path where the browser allows it, one for each step of zoom, so at low zoom the
// shapes too small to see are left out. Colours go through S.tone here, once. Every colour
// (and opacity) used costs one more fill a frame, so keep to a few of each.
//
//   K.deco(S, P, { layer, after, ground, seed }, fill)
//     fill(D, R) adds the shapes. It runs the first time the plane is drawn, not when the
//     scene is built, so the test bot and the shot oracle (which never draw) pay nothing for
//     it. R is a random stream of its own (seed), so nothing a mission depends on moves.
//     layer   as for any item (0 behind people, 2 in front of them)
//     after   an item already on the plane to draw just after (default: after everything so far)
//     ground  true: drawn by the plane's ground (K.ground) after its own paving and before
//             puddles and the lamp light lying on it, so light still falls on top
//   In fill:
//     D.rect(x, y, w, h, hex, a)        D.poly([x, y, x, y, ...], hex, a)
//     D.ell(x, y, rx, ry, hex, a)       D.seg(x1, y1, x2, y2, w, hex, a)   D.line([x, y, ...], w, hex, a)
//     a is the opacity (1 if left out). A shape is drawn only once it is at least D.min
//     screen pixels across (1.4 unless changed); a line once it is a third of a pixel wide.
//     D.at = s     what follows waits until the zoom gives s pixels per metre
//     D.pass = n   what follows is drawn after everything with a lower pass (details on top)
//     D.lit = true what follows gives off its own light (signs), so night dims it less
const KD_TIERS = [0, 1.2, 2.5, 5, 10, 20, 40, 80, 160];      // the steps of zoom, in pixels per metre
const KD_P2D = typeof Path2D !== 'undefined';
K.deco = function (S, P, o, fill) {
  o = o || {};
  const D = { S, P, min: 1.4, at: 0, pass: 0, lit: false };
  const groups = new Map(), cols = new Map();
  let list = null, bx0 = 1e9, bx1 = -1e9;
  // opacity is kept to steps of a tenth (a twentieth when faint), so shapes share groups and fills
  const col = (hex, a) => {
    if (a !== undefined) a = a < 0.3 ? Math.max(0.05, Math.round(a * 20) / 20) : Math.round(a * 10) / 10;
    const key = hex + (D.lit ? '!' : '') + (a === undefined || a >= 1 ? '' : '|' + a);
    let c = cols.get(key);
    if (!c) { c = S.tone(hex, P, D.lit); if (a !== undefined && a < 1) c = rgba(c, a); cols.set(key, c); }
    return c;
  };
  // one group for each colour (and pass); each shape remembers the step of zoom it shows from
  const grp = (c, kind, w) => {
    const key = D.pass + '/' + kind + '/' + c + '/' + (w || 0);
    let g = groups.get(key); if (!g) { g = { pass: D.pass, kind, col: c, w: w || 0, sh: [], ord: groups.size, ti: 99 }; groups.set(key, g); }
    return g;
  };
  const put = (g, need, x0, x1, y0, y1, t, d) => {
    need = Math.max(D.at, need); if (need > KD_TIERS[KD_TIERS.length - 1]) return;      // never big enough to see
    let ti = 0; while (KD_TIERS[ti] < need) ti++;
    g.sh.push({ x0, x1, y0, y1, t, d, ti }); if (ti < g.ti) g.ti = ti;
    if (x0 < bx0) bx0 = x0; if (x1 > bx1) bx1 = x1;
  };
  D.rect = (x, y, w, h, hex, a) => { if (w > 0 && h > 0) put(grp(col(hex, a), 'f'), D.min / Math.min(w, h), x, x + w, y, y + h, 0, [x, y, w, h]); };
  D.ell = (x, y, rx, ry, hex, a) => { if (rx > 0 && ry > 0) put(grp(col(hex, a), 'f'), D.min / (2 * Math.min(rx, ry)), x - rx, x + rx, y - ry, y + ry, 2, [x, y, rx, ry]); };
  D.poly = (p, hex, a, size) => {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, ar = 0;
    for (let i = 0; i < p.length; i += 2) { const x = p[i], y = p[i + 1], j = (i + 2) % p.length; ar += x * p[j + 1] - p[j] * y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (ar < 0) { const q = []; for (let i = p.length - 2; i >= 0; i -= 2) q.push(p[i], p[i + 1]); p = q; }   // every shape winds the same way, so overlaps never cut holes
    put(grp(col(hex, a), 'f'), D.min / (size || Math.max(1e-4, Math.min(x1 - x0, y1 - y0))), x0, x1, y0, y1, 1, p);
  };
  D.line = (p, w, hex, a) => {
    w = w < 0.05 ? Math.max(0.005, Math.round(w * 200) / 200) : Math.round(w * 50) / 50;   // widths in steps too, so lines share groups
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, len = 0;
    for (let i = 0; i < p.length; i += 2) { if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i]; if (p[i + 1] < y0) y0 = p[i + 1]; if (p[i + 1] > y1) y1 = p[i + 1]; if (i) len += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]); }
    put(grp(col(hex, a), 's', w), Math.max(0.35 / w, 3 / Math.max(1e-4, len)), x0 - w, x1 + w, y0 - w, y1 + w, 3, p);
  };
  D.seg = (x1, y1, x2, y2, w, hex, a) => D.line([x1, y1, x2, y2], w, hex, a);
  const shape = (c, sh) => {
    const d = sh.d;
    if (sh.t === 0) c.rect(d[0], d[1], d[2], d[3]);
    else if (sh.t === 2) { c.moveTo(d[0] + d[2], d[1]); c.ellipse(d[0], d[1], d[2], d[3], 0, 0, TAU); }
    else { c.moveTo(d[0], d[1]); for (let i = 2; i < d.length; i += 2) c.lineTo(d[i], d[i + 1]); if (sh.t === 1) c.closePath(); }
  };
  // after filling: cut each colour into strips left to right, a sixteenth of its spread wide
  // (at least 12 m), so a screen usually holds two or three strips of it
  const finish = () => {
    list = [];
    groups.forEach((g) => {
      if (!g.sh.length) return;
      g.sh.sort((a, b) => a.x0 - b.x0);
      const W = Math.max(12, (g.sh[g.sh.length - 1].x0 - g.sh[0].x0) / 16);
      g.ch = [];
      let cur = null;
      for (let i = 0; i < g.sh.length; i++) {
        const sh = g.sh[i];
        if (!cur || sh.x0 > cur.start + W) { cur = { start: sh.x0, x0: sh.x0, x1: sh.x1, y0: sh.y0, y1: sh.y1, sh: [], ti: 99, p: [] }; g.ch.push(cur); }
        cur.sh.push(sh); if (sh.x1 > cur.x1) cur.x1 = sh.x1; if (sh.y0 < cur.y0) cur.y0 = sh.y0; if (sh.y1 > cur.y1) cur.y1 = sh.y1; if (sh.ti < cur.ti) cur.ti = sh.ti;
      }
      g.sh = null; list.push(g);
    });
    list.sort((a, b) => a.pass - b.pass || a.ord - b.ord);
    if (it) { it.x0 = bx0 - 1; it.x1 = bx1 + 1; }
  };
  D.draw = (ctx, env) => {
    if (!list) { if (fill) fill(D, makeRng(o.seed || 1)); finish(); }
    const s = env.s, x0 = env.x0, x1 = env.x1, y0 = env.y0 === undefined ? -1e9 : env.y0, y1 = env.y1 === undefined ? 1e9 : env.y1;
    let T = 0; while (T + 1 < KD_TIERS.length && KD_TIERS[T + 1] <= s) T++;            // the step of zoom we are at
    for (let gi = 0; gi < list.length; gi++) {
      const g = list[gi]; if (g.ti > T) continue;
      let set = false;
      for (let ci = 0; ci < g.ch.length; ci++) {
        const c = g.ch[ci]; if (c.x0 > x1) break; if (c.ti > T || c.x1 < x0 || c.y1 < y0 || c.y0 > y1) continue;
        if (!set) { set = true; if (g.kind === 'f') ctx.fillStyle = g.col; else { ctx.strokeStyle = g.col; ctx.lineWidth = Math.max(g.w, env.px * 0.9); } }
        if (KD_P2D) { // one kept path for each step of zoom, holding the shapes big enough to see at it
          let p = c.p[T];
          if (!p) { p = c.p[T] = new Path2D(); for (let i = 0; i < c.sh.length; i++) if (c.sh[i].ti <= T) shape(p, c.sh[i]); }
          if (g.kind === 'f') ctx.fill(p); else ctx.stroke(p);
        } else { ctx.beginPath(); for (let i = 0; i < c.sh.length; i++) if (c.sh[i].ti <= T) shape(ctx, c.sh[i]); if (g.kind === 'f') ctx.fill(); else ctx.stroke(); }
      }
    }
  };
  // for checking costs: how many groups and strips this layer has (once drawn)
  D.stats = () => { let n = 0, sh = 0; if (list) list.forEach((g) => { n += g.ch.length; g.ch.forEach((c) => { sh += c.sh.length; }); }); return { groups: list ? list.length : 0, strips: n, shapes: sh }; };
  let it = null;
  if (o.ground) (P.groundDeco = P.groundDeco || []).push(D);
  else if (o.item !== false) {
    it = P.add({ x0: -1e9, x1: 1e9, layer: o.layer || 0, draw: D.draw, deco: D });
    if (o.after) { const i = P.items.indexOf(o.after); if (i >= 0) { P.items.pop(); P.items.splice(i + 1, 0, it); } }
  }
  return D;
};

// ---- weathering, added to a detail layer -------------------------------------------
// R is the layer's own random stream. Colours are plain hex; each helper picks its own opacity.
const KW = {
  // Streaks running down from a line at yTop: rust under fixings, rain stains under sills.
  // Each is wide where it starts and runs to a point; o.n, o.len [lo, hi], o.w [lo, hi], o.a.
  streaks(D, R, x0, x1, yTop, hex, o) {
    o = o || {}; const n = o.n || Math.max(1, Math.round((x1 - x0) * (o.per || 0.6)));
    for (let i = 0; i < n; i++) {
      const x = R.r(x0, x1), l = R.r(o.len ? o.len[0] : 0.4, o.len ? o.len[1] : 1.6), w = R.r(o.w ? o.w[0] : 0.04, o.w ? o.w[1] : 0.12), dx = R.r(-0.04, 0.04), a = (o.a || 0.3) * R.r(0.55, 1);
      D.poly([x - w / 2, yTop, x + w / 2, yTop, x + w * 0.3 + dx, yTop - l * 0.55, x + dx * 2, yTop - l, x - w * 0.25 + dx, yTop - l * 0.5], hex, a, w);
    }
  },
  // A dirty band at the foot of a wall, its top edge ragged: splashes off the ground.
  grime(D, R, x0, x1, y, h, hex, a) {
    const p = [x1, y, x0, y]; for (let x = x0; x < x1; x += R.r(0.25, 0.7)) p.push(x, y + h * R.r(0.45, 1));
    p.push(x1, y + h * R.r(0.45, 1)); D.poly(p, hex, a === undefined ? 0.22 : a, h * 0.5);
  },
  // Hairline cracks: a wandering line with the odd branch. dir is the general heading in radians.
  cracks(D, R, x, y, len, hex, o) {
    o = o || {}; const w = o.w || 0.02, dir = o.dir === undefined ? -Math.PI / 2 : o.dir, p = [x, y]; let cx = x, cy = y, an = dir;
    const st = len / 6;
    for (let i = 0; i < 6; i++) {
      an = dir + R.r(-0.6, 0.6); cx += Math.cos(an) * st; cy += Math.sin(an) * st; p.push(cx, cy);
      if (i === 2 && R.chance(0.6)) { const b = an + (R.chance(0.5) ? 0.9 : -0.9); D.line([cx, cy, cx + Math.cos(b) * st * 1.3, cy + Math.sin(b) * st * 1.3, cx + Math.cos(b + 0.3) * st * 2, cy + Math.sin(b + 0.3) * st * 2], w * 0.8, hex, o.a || 0.5); }
    }
    D.line(p, w, hex, o.a || 0.55);
  },
  // An irregular patch (peeled paint, a damp stain, a moss bloom): a wobbly oval.
  blob(D, R, x, y, rx, ry, hex, a, k) {
    const n = 9, p = [], k0 = k === undefined ? 0.3 : k, ph = R.r(0, TAU);
    for (let i = 0; i < n; i++) { const an = ph + (i / n) * TAU, r = 1 - k0 + k0 * 2 * R.f(); p.push(x + Math.cos(an) * rx * r, y + Math.sin(an) * ry * r); }
    D.poly(p, hex, a, Math.min(rx, ry) * 2);
  },
  // Paint coming away: a pale patch where the coat has gone, with a dark lip along its top.
  peel(D, R, x, y, w, h, base, a) {
    KW.blob(D, R, x, y, w / 2, h / 2, lighten(base, 0.18), a === undefined ? 0.75 : a, 0.35);
    D.pass++; D.seg(x - w * 0.35, y + h * 0.42, x + w * 0.3, y + h * 0.46, Math.min(0.03, h * 0.12), darken(base, 0.4), 0.5); D.pass--;
  },
  // Moss or weed along a base line: a row of soft bumps.
  moss(D, R, x0, x1, y, h, hex, a) {
    for (let x = x0; x < x1; x += R.r(h * 0.8, h * 2.6)) { const r = h * R.r(0.5, 1.1); D.ell(x, y + r * 0.2, r * R.r(1, 1.8), r, hex, a === undefined ? 0.85 : a); }
  },
};

// ---- small things lying about, added to a detail layer -------------------------------
// All of them are low and drawn behind the people on their plane, or on a wall: none is
// big enough to pass for cover. x is the left end and y the ground unless it says otherwise.
const KC = {
  // A wooden crate with its boards and the darker frame across them.
  crate(D, x, y, w, h, hex) {
    const d = darken(hex, 0.28), l = lighten(hex, 0.14);
    D.rect(x, y, w, h, hex); D.pass++;
    D.rect(x, y + h - 0.04, w, 0.04, l); D.rect(x, y, 0.06, h, d); D.rect(x + w - 0.06, y, 0.06, h, d); D.rect(x, y, w, 0.06, d); D.rect(x, y + h - 0.1, w, 0.06, d);
    for (let k = 1; k < 3; k++) D.rect(x + 0.06, y + (h * k) / 3, w - 0.12, 0.015, d, 0.7);
    D.seg(x + 0.08, y + 0.08, x + w - 0.08, y + h - 0.12, 0.05, d, 0.85);
    D.pass--;
  },
  // A pallet lying flat, or several stacked: n of them.
  pallets(D, x, y, n, hex) {
    const d = darken(hex, 0.35);
    for (let i = 0; i < n; i++) { const yy = y + i * 0.15; D.rect(x, yy + 0.1, 1.2, 0.05, hex); D.rect(x + 0.02, yy, 0.12, 0.1, hex); D.rect(x + 0.54, yy, 0.12, 0.1, hex); D.rect(x + 1.06, yy, 0.12, 0.1, hex); D.rect(x + 0.14, yy + 0.02, 0.4, 0.06, d, 0.9); D.rect(x + 0.66, yy + 0.02, 0.4, 0.06, d, 0.9); }
  },
  // A coil of rope or hose seen from the side: flat rings, a lighter top.
  coil(D, cx, y, r, hex) {
    const d = darken(hex, 0.3), l = lighten(hex, 0.18);
    for (let i = 0; i < 3; i++) D.ell(cx, y + 0.04 + i * 0.05, r - i * r * 0.12, 0.05, i % 2 ? d : hex);
    D.pass++; D.ell(cx, y + 0.16, r * 0.62, 0.025, l, 0.8); D.ell(cx, y + 0.16, r * 0.3, 0.018, d, 0.9); D.pass--;
  },
  // A run of chain hanging between two points (or lying, if sag is 0): small links.
  chain(D, x0, y0, x1, y1, sag, hex) {
    const n = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) / 0.07));
    for (let i = 0; i <= n; i++) { const u = i / n, x = lerp(x0, x1, u), y = lerp(y0, y1, u) - sag * 4 * u * (1 - u); D.ell(x, y, i % 2 ? 0.035 : 0.022, i % 2 ? 0.02 : 0.03, hex, 0.95); }
  },
  // An old tyre lying flat, or a stack of them: n high.
  tyres(D, cx, y, n, r) {
    for (let i = 0; i < n; i++) { const yy = y + i * r * 0.62; D.rect(cx - r, yy, r * 2, r * 0.58, '#1a1c20'); D.ell(cx, yy + r * 0.58, r, r * 0.16, '#24272c'); D.pass++; D.ell(cx, yy + r * 0.58, r * 0.5, r * 0.08, '#0e0f12'); D.rect(cx - r, yy + r * 0.24, r * 2, r * 0.05, '#2c3036', 0.8); D.pass--; }
  },
  // A rock: a lumpy mound with its lit top and a shadow at its foot. k shifts its colour.
  rock(D, R, cx, y, w, h, hex) {
    const p = [cx - w / 2, y], n = 7;
    for (let i = 1; i < n; i++) { const u = i / n, an = Math.PI * (1 - u); p.push(cx + Math.cos(an) * w / 2 * R.r(0.85, 1.05), y + Math.sin(an) * h * R.r(0.75, 1.1)); }
    p.push(cx + w / 2, y);
    D.poly(p, hex); D.pass++;
    D.poly([cx - w * 0.3, y + h * 0.7, cx + w * 0.05, y + h * R.r(0.92, 1.02), cx + w * 0.28, y + h * 0.66, cx, y + h * 0.78], lighten(hex, 0.16), 0.8);
    D.rect(cx - w / 2, y, w, h * 0.12, darken(hex, 0.3), 0.6); D.pass--;
  },
  // A tuft of grass or scrub: thin blades, as one shape (a zig-zag along the ground).
  tuft(D, R, x, y, h, hex) {
    const n = R.i(3, 5), p = [x - h * 0.3, y];
    for (let i = 0; i < n; i++) { const bx = x + (i - (n - 1) / 2) * h * 0.15; p.push(bx + R.r(-0.35, 0.35) * h, y + h * R.r(0.6, 1), bx + h * 0.06, y + h * 0.08); }
    p.push(x + h * 0.3, y);
    D.poly(p, hex, 0.95, h * 0.3);
  },
  // A low bush: a few overlapping round clumps, darker underneath.
  bush(D, R, cx, y, w, h, hex) {
    const n = Math.max(3, Math.round(w / (h * 0.7)));
    for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, r = h * R.r(0.45, 0.65); D.ell(cx - w / 2 + u * w, y + r * 0.9, r * 1.1, r, hex); }
    D.pass++;
    for (let i = 0; i < n; i++) { const u = (i + 0.4) / n, r = h * R.r(0.2, 0.32); D.ell(cx - w / 2 + u * w - r * 0.3, y + h * 0.95, r, r * 0.8, lighten(hex, 0.12), 0.8); }
    D.rect(cx - w / 2, y, w, h * 0.15, darken(hex, 0.3), 0.6); D.pass--;
  },
};

CB.K = K; CB.makeScene = makeScene; CB.CARS = CARS;
