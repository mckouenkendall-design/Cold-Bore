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

const K = {};

// ---- ground and backdrops --------------------------------------------------
K.ground = function (S, P, o) {
  o = o || {};
  const y = o.y || 0, col = S.tone(o.col || S.pal.ground, P), x0 = o.x0 === undefined ? -4000 : o.x0, x1 = o.x1 === undefined ? 4000 : o.x1;
  const edge = o.edge ? S.tone(o.edge, P) : mix(col, '#ffffff', 0.12);
  P.groundY = y; P.groundMat = o.mat || S.groundMat;
  P.add({ x0, x1, layer: o.layer || 0, draw(ctx, env) {
    R4(ctx, x0, y - 400, x1 - x0, 400, col);
    if (!o.noEdge) R4(ctx, x0, y - Math.max(0.12, env.px * 1.2), x1 - x0, Math.max(0.12, env.px * 1.2), edge);
    if (o.stripes) { // road markings
      ctx.fillStyle = S.tone('#d9d2b0', P);
      const a = Math.floor(env.x0 / 6) * 6;
      for (let x = a; x < env.x1; x += 6) ctx.fillRect(x, y - o.stripes - 0.08, 2.4, 0.16);
    }
  } });
};

K.water = function (S, P, o) {
  o = o || {};
  const y = o.y || 0, col = S.tone(o.col || S.pal.water, P), hi = mix(col, '#ffffff', 0.22);
  P.groundY = y; P.groundMat = 'water';
  P.add({ x0: -4000, x1: 4000, layer: o.layer || 0, draw(ctx, env) {
    R4(ctx, -4000, y - 400, 8000, 400, col);
    ctx.strokeStyle = hi; ctx.lineWidth = Math.max(0.06, env.px);
    const step = Math.max(3, env.px * 26);
    ctx.beginPath();
    for (let row = 0; row < 5; row++) {
      const yy = y - 0.3 - row * row * 0.9 - row * 0.6;
      const a = Math.floor(env.x0 / step) * step;
      for (let x = a; x < env.x1; x += step) {
        const ph = Math.sin(x * 12.9898 + row * 78.233) * 43758.5453; const r = ph - Math.floor(ph);
        if (r > 0.55) continue;
        const dx = Math.sin(env.t * 0.7 + x + row) * 0.5;
        ctx.moveTo(x + dx + r * step, yy); ctx.lineTo(x + dx + r * step + 1.2 + r * 2, yy);
      }
    }
    ctx.stroke();
  } });
};

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
  const lit = S.tone(S.pal.lit, P, true);
  P.add({ x0, x1, draw(ctx, env) {
    for (let i = 0; i < bl.length; i++) {
      const b = bl[i]; if (b.x + b.w < env.x0 || b.x > env.x1) continue;
      R4(ctx, b.x, base, b.w, b.h, b.c);
      if (b.top === 1) R4(ctx, b.x + b.w * 0.3, base + b.h, b.w * 0.4, b.h * 0.08, b.c);
      if (b.top === 2) { ctx.strokeStyle = b.c; ctx.lineWidth = Math.max(0.8, env.px); ctx.beginPath(); ctx.moveTo(b.x + b.w * 0.5, base + b.h); ctx.lineTo(b.x + b.w * 0.5, base + b.h * 1.18); ctx.stroke(); }
      if (env.s > 0.08) { ctx.fillStyle = lit; for (let j = 0; j < b.win.length; j++) ctx.fillRect(b.win[j][0], b.win[j][1], 3.2, 3.4); }
    }
  } });
  if (o.ground !== false) K.ground(S, P, { y: base, col: o.groundCol || '#6d7986', noEdge: true });
  return P;
};

K.mountains = function (S, z, o) {
  const P = S.plane(z, 'mtn'); o = o || {};
  const R = makeRng(o.seed || 5), x0 = o.x0 === undefined ? -3000 : o.x0, x1 = o.x1 === undefined ? 3000 : o.x1, base = o.base || 0, H = o.h || 600;
  const pts = []; let x = x0;
  while (x <= x1) { pts.push([x, base + H * (0.35 + 0.65 * Math.abs(vnoise(x / (o.rough || 420), o.seed || 5))) * (0.75 + 0.25 * R.f())]); x += R.r(60, 170) * (o.step || 1); }
  const rock = S.tone(o.col || '#5f6b78', P), shade = S.tone(darken(o.col || '#5f6b78', 0.22), P), snow = S.tone(o.snowCol || '#f2f6fa', P);
  P.add({ x0, x1, draw(ctx) {
    ctx.fillStyle = rock; ctx.beginPath(); ctx.moveTo(x0, base - 50);
    for (let i = 0; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineTo(x1, base - 50); ctx.closePath(); ctx.fill();
    // shaded right faces and snow caps on the peaks
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      if (b[1] > a[1] && b[1] > c[1]) {
        poly(ctx, [b[0], b[1], c[0], c[1], lerp(b[0], c[0], 0.35), base, b[0] + (c[0] - b[0]) * 0.1, base], shade);
        if (o.snow !== false && b[1] - base > H * (o.snowLine || 0.62)) {
          const d = (b[1] - base - H * (o.snowLine || 0.62)) * 0.9 + 12;
          const la = [lerp(b[0], a[0], d / Math.max(1, b[1] - a[1] + d)), b[1] - d * 0.9], rc = [lerp(b[0], c[0], d / Math.max(1, b[1] - c[1] + d)), b[1] - d];
          poly(ctx, [b[0], b[1], la[0], la[1], lerp(la[0], b[0], 0.45), la[1] + d * 0.25, b[0] - 2, la[1] - d * 0.12, lerp(b[0], rc[0], 0.5), rc[1] + d * 0.3, rc[0], rc[1]], snow);
        }
      }
    }
  } });
  return P;
};

K.hills = function (S, z, o) {
  const P = S.plane(z, 'hill'); o = o || {};
  const x0 = o.x0 === undefined ? -2500 : o.x0, x1 = o.x1 === undefined ? 2500 : o.x1, base = o.base || 0, H = o.h || 60, sd = o.seed || 3;
  const col = S.tone(o.col || S.pal.grass, P), step = o.step || 25;
  const pts = []; for (let x = x0; x <= x1; x += step) pts.push([x, base + H * (0.5 + 0.5 * vnoise(x / (o.rough || 160), sd))]);
  const trees = [];
  if (o.trees) { const R = makeRng(sd * 31); for (let i = 0; i < pts.length; i++) if (R.chance(o.trees)) trees.push([pts[i][0] + R.r(-8, 8), pts[i][1] - R.r(0, 2), R.r(6, 15)]); }
  const tcol = S.tone(o.treeCol || '#2f5140', P);
  P.heightAt = (x) => { const i = clamp((x - x0) / step, 0, pts.length - 1.001), a = Math.floor(i); return lerp(pts[a][1], pts[a + 1][1], i - a); };
  P.add({ x0, x1, draw(ctx, env) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0, base - 400);
    for (let i = 0; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineTo(x1, base - 400); ctx.closePath(); ctx.fill();
    ctx.fillStyle = tcol;
    for (let i = 0; i < trees.length; i++) { const t = trees[i]; if (t[0] < env.x0 - 10 || t[0] > env.x1 + 10) continue; pineShape(ctx, t[0], t[1], t[2]); }
  } });
  P.groundY = base; P.groundMat = o.mat || 'dirt'; P.groundFn = P.heightAt;
  return P;
};

function pineShape(ctx, x, y, h) {
  ctx.beginPath();
  ctx.moveTo(x, y + h); ctx.lineTo(x - h * 0.2, y + h * 0.55); ctx.lineTo(x - h * 0.1, y + h * 0.55); ctx.lineTo(x - h * 0.28, y + h * 0.25); ctx.lineTo(x - h * 0.14, y + h * 0.25);
  ctx.lineTo(x - h * 0.34, y + h * 0.02); ctx.lineTo(x - h * 0.04, y + h * 0.02); ctx.lineTo(x - h * 0.04, y - 0.3); ctx.lineTo(x + h * 0.04, y - 0.3); ctx.lineTo(x + h * 0.04, y + h * 0.02);
  ctx.lineTo(x + h * 0.34, y + h * 0.02); ctx.lineTo(x + h * 0.14, y + h * 0.25); ctx.lineTo(x + h * 0.28, y + h * 0.25); ctx.lineTo(x + h * 0.1, y + h * 0.55); ctx.lineTo(x + h * 0.2, y + h * 0.55);
  ctx.closePath(); ctx.fill();
}
K.pine = function (S, P, x, h, o) {
  o = o || {}; const col = S.tone(o.col || '#27483a', P), snow = o.snow ? S.tone('#eef3f7', P) : null, y = o.y || 0;
  P.add({ x0: x - h * 0.4, x1: x + h * 0.4, layer: o.layer || 0, draw(ctx) {
    ctx.fillStyle = col; pineShape(ctx, x, y, h);
    if (snow) { ctx.fillStyle = snow; poly(ctx, [x, y + h, x - h * 0.13, y + h * 0.7, x, y + h * 0.78, x + h * 0.12, y + h * 0.68], snow); poly(ctx, [x - h * 0.1, y + h * 0.55, x - h * 0.22, y + h * 0.32, x - h * 0.04, y + h * 0.4], snow); poly(ctx, [x + h * 0.1, y + h * 0.55, x + h * 0.24, y + h * 0.3, x + h * 0.03, y + h * 0.42], snow); }
  } });
  if (o.solid !== false) P.solid(x - h * 0.04, y, h * 0.08, h * 0.3, 'wood');
};
K.tree = function (S, P, x, h, o) {
  o = o || {}; const leaf = S.tone(o.col || '#4d7f4a', P), leaf2 = S.tone(darken(o.col || '#4d7f4a', 0.18), P), trunk = S.tone('#4a3a2c', P), y = o.y || 0;
  const R = makeRng(Math.floor(x * 13 + h * 7) + 3), blobs = [];
  for (let i = 0; i < 6; i++) blobs.push([R.r(-0.32, 0.32) * h, h * R.r(0.55, 0.95), h * R.r(0.16, 0.26)]);
  P.add({ x0: x - h * 0.5, x1: x + h * 0.5, layer: o.layer || 0, draw(ctx, env) {
    R4(ctx, x - h * 0.03, y, h * 0.06, h * 0.6, trunk);
    const sw = Math.sin(env.t * 0.9 + x) * 0.02 * h * (0.3 + Math.abs(env.wind || 0) * 0.12);
    for (let i = 0; i < blobs.length; i++) circ(ctx, x + blobs[i][0] + sw * (blobs[i][1] / h), y + blobs[i][1], blobs[i][2], i % 2 ? leaf2 : leaf);
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

  // back layer: wall and what is inside the windows
  P.add({ x0: x, x1: x + w, layer: 0, draw(ctx, env) {
    R4(ctx, x, base, w, floors * fh + para, wall);
    if (tall) {
      // glass tower: mullion grid
      ctx.fillStyle = wall2; for (let f = 0; f <= floors; f++) ctx.fillRect(x, B.floorY(f) - 0.18, w, 0.36);
    } else {
      R4(ctx, x + w - Math.min(0.9, w * 0.06), base, Math.min(0.9, w * 0.06), floors * fh + para, wall2);
      if (env.s > 5) { ctx.fillStyle = wall2; for (let i = 0; i < bricks.length; i++) { const b = bricks[i]; if (b[0] > env.x0 - 2 && b[0] < env.x1) ctx.fillRect(b[0], b[1], b[2], 0.09); } }
      ctx.fillStyle = trim; ctx.fillRect(x - 0.15, roofY + para - 0.22, w + 0.3, 0.3);
      ctx.fillStyle = wallHi; for (let f = 1; f < floors; f++) ctx.fillRect(x, B.floorY(f) - 0.08, w, 0.12);
    }
    for (const key in B.wins) {
      const op = B.wins[key]; if (op.x + op.w < env.x0 || op.x > env.x1) continue;
      drawWindowBack(ctx, env, S, P, op, glass, inRoom);
    }
    if (o.shop) {
      R4(ctx, x, base, w, fh - 0.3, wall2);
      drawWindowBack(ctx, env, S, P, B.shop, glass, inRoom);
      if (o.shop.door) { R4(ctx, x + w - 2.1, base, 1.5, 2.4, S.tone('#2a2420', P)); R4(ctx, x + w - 1.95, base + 1.2, 1.2, 1.0, glass); }
    }
    if (o.door !== undefined && !o.shop) { const dx = B.winX(o.door) - 0.65; R4(ctx, dx - 0.15, base, 1.6, 2.55, trim); R4(ctx, dx, base, 1.3, 2.4, S.tone(o.doorCol || '#3b2c26', P)); }
  } });
  // front layer: glass sheen, frames, signs
  P.add({ x0: x - 1, x1: x + w + 1, layer: 1, draw(ctx, env) {
    for (const key in B.wins) {
      const op = B.wins[key]; if (op.x + op.w < env.x0 || op.x > env.x1) continue;
      drawWindowFront(ctx, env, S, P, op, frame, tall);
    }
    if (o.shop) {
      drawWindowFront(ctx, env, S, P, B.shop, frame, true);
      const aw = S.tone(o.shop.awning || '#b33a3a', P), aw2 = S.tone('#efe9da', P);
      const n = Math.max(4, Math.floor(w / 1.2));
      for (let i = 0; i < n; i++) poly(ctx, [x + (i * w) / n, base + fh - 0.3, x + ((i + 1) * w) / n, base + fh - 0.3, x + ((i + 1) * w) / n + 0.25, base + fh - 1.1, x + (i * w) / n - 0.25 + (i === 0 ? 0.25 : 0.5), base + fh - 1.1], i % 2 ? aw2 : aw);
      if (o.shop.sign) { R4(ctx, x + w * 0.15, base + fh - 0.25, w * 0.7, 0.75, S.tone('#1c1f26', P)); env.text(ctx, o.shop.sign, x + w / 2, base + fh + 0.02, 0.5, S.tone(o.shop.signCol || '#f3e9c9', P, true), 'center'); }
    }
    ctx.fillStyle = S.tone('#c9ced3', P);
    for (let i = 0; i < acs.length; i++) { const op = acs[i]; if (op.x > env.x0 - 2 && op.x < env.x1) { ctx.fillStyle = S.tone('#c9ced3', P); ctx.fillRect(op.x + 0.2, op.y - 0.55, 0.9, 0.5); ctx.fillStyle = S.tone('#8d9499', P); ctx.fillRect(op.x + 0.28, op.y - 0.47, 0.74, 0.12); } }
  } });
  // rooftop clutter
  if (o.tank) K.watertank(S, P, x + w * (o.tank === true ? 0.7 : o.tank), roofY + para);
  if (o.hut) { const hx = x + w * (o.hut === true ? 0.2 : o.hut); P.add({ x0: hx, x1: hx + 3, layer: 0, draw(ctx) { R4(ctx, hx, roofY + para - 0.1, 3, 2.5, wall2); R4(ctx, hx + 0.9, roofY + para - 0.1, 1.1, 2.0, S.tone('#2a2f38', P)); } }); P.solid(hx, roofY + para, 3, 2.4, 'wall'); }
  if (o.antenna) { const ax = x + w * (o.antenna === true ? 0.85 : o.antenna); P.add({ x0: ax - 1, x1: ax + 1, layer: 1, draw(ctx, env) { line(ctx, ax, roofY + para, ax, roofY + para + 6, S.tone('#30343c', P), 0.08, env); line(ctx, ax - 0.8, roofY + para + 4.6, ax + 0.8, roofY + para + 4.6, S.tone('#30343c', P), 0.06, env); line(ctx, ax - 0.5, roofY + para + 5.4, ax + 0.5, roofY + para + 5.4, S.tone('#30343c', P), 0.06, env); } }); }
  return B;
};

function drawWindowBack(ctx, env, S, P, op, glass, inRoom) {
  const room = S.rooms[op.room], lit = room && room.lit;
  if (lit) {
    R4(ctx, op.x, op.y, op.w, op.h, S.tone(op.tint, P, true));
    if (env.s > 3.5) {
      const d = S.tone(darken(op.tint, 0.28), P, true);
      ctx.fillStyle = d;
      if (op.deco === 0) { ctx.fillRect(op.x + op.w * 0.62, op.y, op.w * 0.3, op.h * 0.5); }                    // cabinet
      else if (op.deco === 1) { ctx.fillRect(op.x + op.w * 0.12, op.y + op.h * 0.55, op.w * 0.32, op.h * 0.28); } // picture
      else if (op.deco === 2) { ctx.fillRect(op.x + op.w * 0.7, op.y, 0.07, op.h * 0.6); poly(ctx, [op.x + op.w * 0.7 - 0.25, op.y + op.h * 0.6, op.x + op.w * 0.7 + 0.32, op.y + op.h * 0.6, op.x + op.w * 0.7 + 0.2, op.y + op.h * 0.82, op.x + op.w * 0.7 - 0.13, op.y + op.h * 0.82], d); } // lamp
      else if (op.deco === 3) { for (let i = 0; i < 3; i++) ctx.fillRect(op.x + op.w * 0.08, op.y + op.h * (0.25 + i * 0.25), op.w * 0.4, 0.06); } // shelves
      else if (op.deco === 9) { for (let i = 0; i < 5; i++) ctx.fillRect(op.x + op.w * (0.06 + i * 0.19), op.y, op.w * 0.1, op.h * (0.3 + ((i * 7) % 4) * 0.1)); }
    }
  } else {
    R4(ctx, op.x, op.y, op.w, op.h, env.nv ? mix(inRoom, '#2c5a3a', 0.5) : inRoom);
  }
}
function drawWindowFront(ctx, env, S, P, op, frame, tall) {
  const room = S.rooms[op.room], lit = room && room.lit;
  if (op.curtain) {
    ctx.fillStyle = S.tone(op.curtain === true ? '#b9a48c' : op.curtain, P, lit);
    ctx.globalAlpha = 0.86; ctx.fillRect(op.x, op.y, op.w * 0.26, op.h); ctx.fillRect(op.x + op.w * 0.74, op.y, op.w * 0.26, op.h); ctx.globalAlpha = 1;
  }
  if (op.blind > 0) {
    ctx.fillStyle = S.tone('#d8d2c2', P, lit); ctx.fillRect(op.x, op.y + op.h * (1 - op.blind), op.w, op.h * op.blind);
    if (env.s > 6) { ctx.fillStyle = S.tone('#b7b0a0', P, lit); for (let yy = op.y + op.h * (1 - op.blind); yy < op.y + op.h; yy += 0.16) ctx.fillRect(op.x, yy, op.w, 0.03); }
  }
  if (op.glass && !op.broken) {
    // reflection: a pale wash and two diagonal streaks
    ctx.fillStyle = lit ? 'rgba(255,255,255,0.06)' : 'rgba(150,190,230,0.10)';
    ctx.fillRect(op.x, op.y, op.w, op.h);
    if (env.s > 3) {
      ctx.fillStyle = lit ? 'rgba(255,255,255,0.10)' : 'rgba(200,225,255,0.13)';
      const k = op.w * 0.2;
      ctx.beginPath(); ctx.moveTo(op.x + op.w * 0.12, op.y + op.h); ctx.lineTo(op.x + op.w * 0.12 + k, op.y + op.h); ctx.lineTo(op.x + op.w * 0.12 + k - op.h * 0.35, op.y); ctx.lineTo(op.x + op.w * 0.12 - op.h * 0.35 < op.x ? op.x : op.x + op.w * 0.12 - op.h * 0.35, op.y); ctx.closePath(); ctx.fill();
    }
  } else if (op.broken && env.s > 2) {
    // a few shards left in the frame
    ctx.fillStyle = 'rgba(190,215,240,0.32)';
    const a = op.x, b = op.y, w = op.w, h = op.h;
    poly(ctx, [a, b, a + w * 0.28, b, a, b + h * 0.3], ctx.fillStyle);
    poly(ctx, [a + w, b + h, a + w * 0.7, b + h, a + w, b + h * 0.62], ctx.fillStyle);
    poly(ctx, [a + w, b, a + w * 0.82, b, a + w, b + h * 0.2], ctx.fillStyle);
    poly(ctx, [a, b + h, a + w * 0.2, b + h, a, b + h * 0.8], ctx.fillStyle);
  }
  if (op.roof) return;
  const fw = Math.max(0.07, env.px * 0.9);
  ctx.strokeStyle = frame; ctx.lineWidth = fw;
  ctx.strokeRect(op.x, op.y, op.w, op.h);
  if (!tall && env.s > 2.5 && !op.door) {
    ctx.beginPath(); ctx.moveTo(op.x + op.w / 2, op.y); ctx.lineTo(op.x + op.w / 2, op.y + op.h); ctx.moveTo(op.x, op.y + op.h * 0.55); ctx.lineTo(op.x + op.w, op.y + op.h * 0.55); ctx.stroke();
    ctx.fillStyle = frame; ctx.fillRect(op.x - 0.12, op.y - 0.12, op.w + 0.24, 0.12);
  }
}

// A balcony on the front of a building. Figures on it stand in the open.
K.balcony = function (S, P, B, f, c0, c1, o) {
  o = o || {};
  const x0 = B.winX(c0) - 1.3, x1 = B.winX(c1 === undefined ? c0 : c1) + 1.3, y = B.floorY(f);
  const slab = S.tone('#8f949a', P), rail = S.tone(o.rail || '#22262d', P);
  P.add({ x0, x1, layer: 0, draw(ctx) { R4(ctx, x0, y - 0.22, x1 - x0, 0.22, slab); } });
  P.add({ x0, x1, layer: 2, draw(ctx, env) {
    ctx.strokeStyle = rail; ctx.lineWidth = Math.max(0.05, env.px * 0.8);
    ctx.beginPath(); ctx.moveTo(x0, y + 1.0); ctx.lineTo(x1, y + 1.0); ctx.moveTo(x0, y); ctx.lineTo(x0, y + 1.0); ctx.moveTo(x1, y); ctx.lineTo(x1, y + 1.0);
    if (env.s > 4) { ctx.lineWidth = Math.max(0.025, env.px * 0.5); for (let x = x0 + 0.28; x < x1; x += 0.28) { ctx.moveTo(x, y); ctx.lineTo(x, y + 1.0); } }
    ctx.stroke();
  } });
  return { x0, x1, y, zone: B.id + ':bal' + f };
};

K.fireEscape = function (S, P, B, c, f0, f1) {
  const x0 = B.winX(c) - 1.5, x1 = B.winX(c) + 1.5, col = S.tone('#1b1e24', P);
  P.add({ x0, x1, layer: 2, draw(ctx, env) {
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.06, env.px * 0.8);
    ctx.beginPath();
    for (let f = f0; f <= f1; f++) {
      const y = B.floorY(f);
      ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.moveTo(x0, y + 1); ctx.lineTo(x1, y + 1); ctx.moveTo(x0, y); ctx.lineTo(x0, y + 1); ctx.moveTo(x1, y); ctx.lineTo(x1, y + 1);
      if (f < f1) { ctx.moveTo(x0 + 0.3, y); ctx.lineTo(x1 - 0.3, y + B.fh); }
    }
    ctx.stroke();
  } });
};

K.watertank = function (S, P, x, y) {
  const wood = S.tone('#6b4f3a', P), dark = S.tone('#3a2c22', P), leg = S.tone('#23262c', P);
  P.add({ x0: x - 2, x1: x + 2, layer: 0, draw(ctx, env) {
    line(ctx, x - 1.2, y, x - 1.0, y + 2.2, leg, 0.1, env); line(ctx, x + 1.2, y, x + 1.0, y + 2.2, leg, 0.1, env); line(ctx, x - 1.2, y + 0.2, x + 1.2, y + 1.8, leg, 0.05, env);
    R4(ctx, x - 1.5, y + 2.2, 3, 2.6, wood);
    ctx.fillStyle = dark; ctx.fillRect(x - 1.5, y + 2.9, 3, 0.1); ctx.fillRect(x - 1.5, y + 4.0, 3, 0.1);
    poly(ctx, [x - 1.7, y + 4.8, x + 1.7, y + 4.8, x, y + 5.9], dark);
  } });
  P.solid(x - 1.5, y + 2.2, 3, 2.6, 'wood');
};

K.billboard = function (S, P, x, y, w, h, text, o) {
  o = o || {};
  const face = S.tone(o.col || '#e9dcc0', P, S.pal.dark > 0.5), post = S.tone('#2a2e36', P), tc = S.tone(o.textCol || '#b3312b', P, S.pal.dark > 0.5);
  P.add({ x0: x, x1: x + w, layer: o.layer || 0, draw(ctx, env) {
    line(ctx, x + w * 0.2, o.base || 0, x + w * 0.2, y, post, 0.25, env); line(ctx, x + w * 0.8, o.base || 0, x + w * 0.8, y, post, 0.25, env);
    R4(ctx, x - 0.15, y - 0.15, w + 0.3, h + 0.3, post); R4(ctx, x, y, w, h, face);
    const ls = String(text).split('|');
    for (let i = 0; i < ls.length; i++) env.text(ctx, ls[i], x + w / 2, y + h - (h / (ls.length + 1)) * (i + 1) - h * 0.1, Math.min(h / (ls.length + 0.6) * 0.6, w / (ls[i].length * 0.62)), tc, 'center');
  } });
  P.solid(x, y, w, h, o.mat || 'thin');
};

K.fence = function (S, P, x0, x1, h, o) {
  o = o || {}; const col = S.tone(o.col || '#3a3f47', P), y = o.y || 0;
  P.add({ x0, x1, layer: o.layer === undefined ? 2 : o.layer, draw(ctx, env) {
    if (o.kind === 'wood') { R4(ctx, x0, y, x1 - x0, h, col); if (env.s > 4) { ctx.fillStyle = S.tone(darken(o.col || '#7a6248', 0.25), P); for (let x = x0; x < x1; x += 0.3) ctx.fillRect(x, y, 0.03, h); } return; }
    if (o.kind === 'wall') { R4(ctx, x0, y, x1 - x0, h, col); R4(ctx, x0, y + h - 0.15, x1 - x0, 0.15, S.tone(lighten(o.col || '#8a8f96', 0.2), P)); return; }
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.05, env.px * 0.8);
    ctx.beginPath(); ctx.moveTo(x0, y + h); ctx.lineTo(x1, y + h);
    for (let x = x0; x <= x1 + 0.01; x += 3) { ctx.moveTo(x, y); ctx.lineTo(x, y + h + 0.25); }
    ctx.stroke();
    if (env.s > 5) { ctx.lineWidth = Math.max(0.015, env.px * 0.4); ctx.globalAlpha = 0.55; ctx.beginPath(); for (let x = x0; x < x1; x += 0.35) { ctx.moveTo(x, y); ctx.lineTo(x + h * 0.5, y + h); ctx.moveTo(x + 0.35, y); ctx.lineTo(x + 0.35 - h * 0.5, y + h); } ctx.stroke(); ctx.globalAlpha = 1; }
  } });
  if (o.kind === 'wood') P.solid(x0, y, x1 - x0, h, 'thin'); else if (o.kind === 'wall') P.solid(x0, y, x1 - x0, h, 'wall');
};

// A shootable light. When it dies the area it lit goes dark.
K.lamp = function (S, P, x, h, zone, o) {
  o = o || {}; const y = o.y || 0, post = S.tone('#20242b', P);
  const arm = o.arm === undefined ? 0.9 : o.arm;
  const ob = S.obj({ kind: 'lamp', id: o.id, plane: P, x: x + arm, y: y + h - 0.12, r: o.r || 0.3, zone, on: true, mat: 'glass', layer: 2, reach: o.reach || 9,
    draw(ctx, env) {
      line(ctx, x, y, x, y + h, post, 0.14, env);
      if (arm) line(ctx, x, y + h, x + arm, y + h, post, 0.1, env);
      const live = ob.alive && ob.on !== false;
      circ(ctx, ob.x, ob.y, 0.2, live ? '#fff3c4' : '#2a2e36');
      if (live && S.pal.dark > 0.3) {
        // pool of light under the lamp
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(ob.x, ob.y, 0.1, ob.x, ob.y, 2.2);
        g.addColorStop(0, 'rgba(255,225,150,' + (0.55 * S.pal.dark) + ')'); g.addColorStop(1, 'rgba(255,225,150,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ob.x, ob.y, 2.2, 0, TAU); ctx.fill();
        const spread = (o.reach || 9) * 0.8;
        const g2 = ctx.createLinearGradient(0, ob.y, 0, y);
        g2.addColorStop(0, 'rgba(255,220,140,' + (0.2 * S.pal.dark) + ')'); g2.addColorStop(1, 'rgba(255,220,140,' + (0.05 * S.pal.dark) + ')');
        ctx.fillStyle = g2; ctx.beginPath(); ctx.moveTo(ob.x - 0.2, ob.y); ctx.lineTo(ob.x + 0.2, ob.y); ctx.lineTo(ob.x + spread, y); ctx.lineTo(ob.x - spread, y); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    } });
  return ob;
};

// A hanging load on a hook. Shoot the hook and it drops on whoever is below.
K.hang = function (S, P, x, yHook, kind, o) {
  o = o || {};
  const sz = { crate: [2.2, 1.8], piano: [2.6, 1.7], sign: [3.2, 1.3], ac: [1.4, 1.0], pallet: [2.6, 1.5], planter: [1.2, 0.8], lights: [3.4, 0.5], girder: [5, 0.5], net: [2.6, 2.2], boat: [5, 1.6] }[kind] || [2, 1.6];
  const drop = o.drop === undefined ? 1.8 : o.drop;
  const prop = { id: (o.id || 'load') + '_p', kind, plane: P, x, y: yHook - drop - sz[1], w: sz[0], h: sz[1], vy: 0, falling: false, landed: false, floor: o.floor || 0, col: o.col, text: o.text };
  S.props.push(prop);
  const top = o.top === undefined ? yHook + 8 : o.top, cable = S.tone('#1c1f25', P);
  const ob = S.obj({ kind: 'hook', id: o.id || 'hook', plane: P, x, y: yHook, r: o.r || 0.34, mat: 'metal', prop, layer: 2,
    draw(ctx, env) {
      line(ctx, x, yHook, x, top, cable, 0.07, env);
      if (ob.alive) {
        ctx.strokeStyle = cable; ctx.lineWidth = Math.max(0.05, env.px * 0.7);
        ctx.beginPath(); ctx.moveTo(x, yHook); ctx.lineTo(prop.x - prop.w * 0.42, prop.y + prop.h); ctx.moveTo(x, yHook); ctx.lineTo(prop.x + prop.w * 0.42, prop.y + prop.h); ctx.stroke();
        R4(ctx, x - 0.2, yHook - 0.22, 0.4, 0.44, S.tone('#d6a12a', P));
        R4(ctx, x - 0.11, yHook - 0.13, 0.22, 0.26, S.tone('#20242b', P));
      }
    } });
  return ob;
};
function drawProp(ctx, env, S, p) {
  const P = p.plane, x = p.x - p.w / 2, y = p.y, w = p.w, h = p.h;
  ctx.save();
  if (p.landed && p.kind !== 'girder') { ctx.translate(p.x, p.y); ctx.rotate(p.tilt || 0); ctx.translate(-p.x, -p.y); }
  if (p.kind === 'piano') {
    const c = S.tone('#16171b', P); R4(ctx, x, y + h * 0.28, w, h * 0.72, c); R4(ctx, x - 0.1, y + h * 0.5, w + 0.2, h * 0.1, S.tone('#e8e4da', P));
    R4(ctx, x + 0.1, y, 0.14, h * 0.3, c); R4(ctx, x + w - 0.24, y, 0.14, h * 0.3, c);
  } else if (p.kind === 'sign') {
    R4(ctx, x, y, w, h, S.tone(p.col || '#c0392b', P, true)); R4(ctx, x + 0.1, y + 0.1, w - 0.2, h - 0.2, S.tone('#1b1e24', P));
    env.text(ctx, p.text || 'HOTEL', p.x, y + h * 0.3, h * 0.5, S.tone(p.col || '#ff5a4d', P, true), 'center');
  } else if (p.kind === 'ac') {
    R4(ctx, x, y, w, h, S.tone('#c6ccd1', P)); R4(ctx, x + 0.1, y + 0.15, w - 0.2, h * 0.45, S.tone('#8d949a', P));
  } else if (p.kind === 'planter') {
    R4(ctx, x, y, w, h * 0.6, S.tone('#a5562f', P)); circ(ctx, p.x - 0.25, y + h * 0.8, 0.3, S.tone('#4f8a4a', P)); circ(ctx, p.x + 0.25, y + h * 0.85, 0.33, S.tone('#5c9a55', P));
  } else if (p.kind === 'girder') {
    R4(ctx, x, y, w, h, S.tone('#8a3b2a', P)); R4(ctx, x, y + h * 0.3, w, h * 0.4, S.tone('#6a2c20', P));
  } else if (p.kind === 'pallet') {
    R4(ctx, x, y, w, 0.18, S.tone('#8a6a45', P));
    for (let i = 0; i < 3; i++) R4(ctx, x + 0.1 + i * (w - 0.2) / 3, y + 0.18, (w - 0.2) / 3 - 0.08, h - 0.2, S.tone(i % 2 ? '#b9a27e' : '#a8916d', P));
  } else if (p.kind === 'boat') {
    poly(ctx, [x, y + h * 0.9, x + w, y + h * 0.9, x + w * 0.86, y, x + w * 0.1, y], S.tone(p.col || '#e9e4d6', P)); R4(ctx, x + w * 0.05, y + h * 0.62, w * 0.9, 0.14, S.tone('#b3312b', P));
  } else if (p.kind === 'net') {
    R4(ctx, x, y, w, h, S.tone('#7b6a4a', P)); ctx.strokeStyle = S.tone('#3a3024', P); ctx.lineWidth = Math.max(0.04, env.px * 0.6);
    ctx.beginPath(); for (let i = 1; i < 5; i++) { ctx.moveTo(x + (i * w) / 5, y); ctx.lineTo(x + (i * w) / 5, y + h); ctx.moveTo(x, y + (i * h) / 5); ctx.lineTo(x + w, y + (i * h) / 5); } ctx.stroke();
  } else {
    const c = S.tone(p.col || '#a5793f', P), d = S.tone(darken(p.col || '#a5793f', 0.25), P);
    R4(ctx, x, y, w, h, c); ctx.strokeStyle = d; ctx.lineWidth = Math.max(0.09, env.px);
    ctx.strokeRect(x + 0.06, y + 0.06, w - 0.12, h - 0.12); ctx.beginPath(); ctx.moveTo(x + 0.06, y + 0.06); ctx.lineTo(x + w - 0.06, y + h - 0.06); ctx.moveTo(x + w - 0.06, y + 0.06); ctx.lineTo(x + 0.06, y + h - 0.06); ctx.stroke();
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
function drawThing(ctx, env, S, ob) {
  const P = ob.plane, x = ob.x, y = ob.y, k = ob.kind, live = ob.alive;
  if (ob.drawFn) { ob.drawFn(ctx, env, S, ob); return; }
  if (k === 'glint') { // a scope lens catching the light, now and then
    if (!live) return; const u = (env.t * (ob.rate || 0.5) + (ob.phase || 0)) % 1; if (u > 0.16) return; const a = Math.sin((u / 0.16) * Math.PI), r = Math.max(0.5, env.px * 5) * a;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = Math.max(0.05, env.px * 1.2); ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke(); circ(ctx, x, y, r * 0.3, 'rgba(255,255,255,' + a + ')'); ctx.restore(); return;
  }
  if (k === 'barrel') {
    if (!live) { circ(ctx, x, y - 0.5, 0.9, 'rgba(10,10,12,0.5)'); return; }
    R4(ctx, x - 0.42, y - 0.62, 0.84, 1.24, S.tone(ob.col || '#c4372c', P)); R4(ctx, x - 0.42, y - 0.2, 0.84, 0.1, S.tone('#7d1f18', P)); R4(ctx, x - 0.42, y + 0.25, 0.84, 0.1, S.tone('#7d1f18', P));
    poly(ctx, [x, y + 0.2, x - 0.2, y - 0.12, x + 0.2, y - 0.12], S.tone('#f4c542', P));
  } else if (k === 'tank') {
    if (!live) { circ(ctx, x, y - 0.6, 1.6, 'rgba(10,10,12,0.55)'); return; }
    ctx.fillStyle = S.tone(ob.col || '#d9dde2', P); ctx.beginPath(); ctx.ellipse(x, y, 1.9, 0.95, 0, 0, TAU); ctx.fill();
    R4(ctx, x - 1.3, y - 1.5, 0.2, 0.7, S.tone('#2a2e36', P)); R4(ctx, x + 1.1, y - 1.5, 0.2, 0.7, S.tone('#2a2e36', P));
    poly(ctx, [x, y + 0.45, x - 0.4, y - 0.25, x + 0.4, y - 0.25], S.tone('#e2572b', P));
  } else if (k === 'fuse') {
    R4(ctx, x - 0.4, y - 0.5, 0.8, 1.0, S.tone(live ? '#8f979e' : '#3a3d42', P)); R4(ctx, x - 0.3, y - 0.4, 0.6, 0.8, S.tone(live ? '#6d757c' : '#2a2c30', P));
    if (live) poly(ctx, [x + 0.06, y + 0.3, x - 0.14, y - 0.03, x, y - 0.03, x - 0.06, y - 0.3, x + 0.14, y + 0.05, x, y + 0.05], S.tone('#f4c542', P, true));
    else if (Math.sin(env.t * 30) > 0.6) circ(ctx, x + 0.1, y, 0.12, '#bfe4ff');
  } else if (k === 'bell' || k === 'horn') {
    const c = S.tone(k === 'bell' ? '#c9a23a' : '#b8bec4', P);
    const sw = ob.ringT ? Math.sin(env.t * 22) * 0.25 * Math.max(0, 1 - (env.t - ob.ringT) / 2) : 0;
    ctx.save(); ctx.translate(x, y + 0.4); ctx.rotate(sw); poly(ctx, [-0.14, 0, 0.14, 0, 0.4, -0.75, -0.4, -0.75], c); circ(ctx, 0, -0.82, 0.1, S.tone('#3a2f1a', P)); ctx.restore();
  } else if (k === 'cctv') {
    const c = S.tone('#dfe3e7', P); line(ctx, x, y + 0.3, x, y + 0.6, S.tone('#2a2e36', P), 0.08, env);
    ctx.save(); ctx.translate(x, y + 0.1); ctx.rotate((ob.dir || 1) * (live ? -0.35 + 0.25 * Math.sin(env.t * 0.6) : -1.2)); R4(ctx, -0.15, -0.14, 0.62, 0.28, c); R4(ctx, 0.42, -0.1, 0.12, 0.2, S.tone('#1b1e24', P));
    if (live && Math.sin(env.t * 4) > 0) circ(ctx, -0.05, 0.02, 0.05, '#ff3b30'); ctx.restore();
  } else if (k === 'duck') {
    if (!live) return;
    circ(ctx, x, y, 0.2, '#f7d038'); circ(ctx, x + 0.14, y + 0.2, 0.13, '#f7d038'); poly(ctx, [x + 0.24, y + 0.22, x + 0.4, y + 0.17, x + 0.24, y + 0.13], '#f08a24'); circ(ctx, x + 0.17, y + 0.24, 0.025, '#1b1b1b');
  } else if (k === 'bottle' || k === 'can' || k === 'pot') {
    if (!live) return;
    if (k === 'pot') { poly(ctx, [x - 0.26, y + 0.1, x + 0.26, y + 0.1, x + 0.18, y - 0.3, x - 0.18, y - 0.3], S.tone('#a5562f', P)); circ(ctx, x, y + 0.3, 0.26, S.tone('#4f8a4a', P)); }
    else if (k === 'can') R4(ctx, x - 0.12, y - 0.18, 0.24, 0.36, S.tone('#c9ced3', P));
    else { R4(ctx, x - 0.09, y - 0.2, 0.18, 0.3, S.tone('#3f8a5a', P, true)); R4(ctx, x - 0.04, y + 0.1, 0.08, 0.16, S.tone('#3f8a5a', P, true)); }
  } else if (k === 'valve') {
    R4(ctx, x - 2.5, y - 0.16, 5, 0.32, S.tone('#7c858d', P)); ctx.strokeStyle = S.tone(live ? '#c4372c' : '#5a2520', P); ctx.lineWidth = Math.max(0.08, env.px);
    ctx.beginPath(); ctx.arc(x, y, 0.3, 0, TAU); ctx.moveTo(x - 0.3, y); ctx.lineTo(x + 0.3, y); ctx.moveTo(x, y - 0.3); ctx.lineTo(x, y + 0.3); ctx.stroke();
  } else if (k === 'radio' || k === 'dish') {
    const c = S.tone(live ? '#cfd4d9' : '#4a4d52', P);
    if (k === 'dish') { line(ctx, x, y - 1.2, x, y, S.tone('#2a2e36', P), 0.1, env); ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, 0.3, 0.7, live ? -0.4 : 0.9, 0, TAU); ctx.fill(); }
    else { R4(ctx, x - 0.32, y - 0.25, 0.64, 0.5, S.tone('#2f3640', P)); line(ctx, x + 0.2, y + 0.25, x + 0.4, y + 1.1, c, 0.04, env); if (live && Math.sin(env.t * 3) > 0) circ(ctx, x - 0.15, y + 0.08, 0.06, '#52e07a'); }
  } else if (k === 'lock') {
    if (!live) return;
    R4(ctx, x - 0.2, y - 0.24, 0.4, 0.34, S.tone('#d6a12a', P)); ctx.strokeStyle = S.tone('#8d949a', P); ctx.lineWidth = Math.max(0.06, env.px); ctx.beginPath(); ctx.arc(x, y + 0.1, 0.13, 0, Math.PI); ctx.stroke();
  } else if (k === 'bulb') {
    line(ctx, x, y + 0.2, x, y + (ob.cord || 0.8), S.tone('#1b1e24', P), 0.03, env);
    circ(ctx, x, y, 0.16, live ? '#fff3c4' : '#2a2e36');
    if (live) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y, 0.05, x, y, 1.3); g.addColorStop(0, 'rgba(255,230,160,0.5)'); g.addColorStop(1, 'rgba(255,230,160,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 1.3, 0, TAU); ctx.fill(); ctx.restore(); }
  } else if (k === 'flare') {
    R4(ctx, x - 0.3, y - 0.3, 0.6, 0.6, S.tone(live ? '#d8572a' : '#3a2a25', P)); R4(ctx, x - 0.2, y - 0.05, 0.4, 0.1, S.tone('#f1ede2', P));
  } else if (k === 'rope') {
    if (live) { R4(ctx, x - 0.16, y - 0.3, 0.32, 0.6, S.tone('#c9b386', P)); ctx.fillStyle = S.tone('#8a7650', P); for (let i = 0; i < 4; i++) ctx.fillRect(x - 0.16, y - 0.26 + i * 0.15, 0.32, 0.04); }
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
function drawCar(ctx, env, S, P, kind, x, y, dir, colHex, st) {
  if (CARS[kind].draw) { CARS[kind].draw(ctx, env, S, P, x, y, dir, colHex, st); return; }
  const c = CARS[kind], L = c.len, col = S.tone(colHex || '#30343c', P), dk = S.tone(darken(colHex || '#30343c', 0.3), P), gl = S.tone(S.pal.glass, P);
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  if (c.train) {
    const car = L / 3;
    for (let i = 0; i < 3; i++) {
      const x0 = -L / 2 + i * car;
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0 + 0.4, 0.5); ctx.lineTo(x0 + car - 0.4, 0.5); ctx.lineTo(x0 + car - 0.4, c.h - 0.3); ctx.quadraticCurveTo(x0 + car - 0.5, c.h, x0 + car - 1.2, c.h); ctx.lineTo(x0 + 1.2, c.h); ctx.quadraticCurveTo(x0 + 0.5, c.h, x0 + 0.4, c.h - 0.3); ctx.closePath(); ctx.fill();
      R4(ctx, x0 + 0.4, 1.3, car - 0.8, 0.22, S.tone(st && st.stripe || '#d6a12a', P));
      ctx.fillStyle = S.pal.dark > 0.3 ? S.tone('#ffe7b3', P, true) : gl;
      for (let w = 0; w < 7; w++) ctx.fillRect(x0 + 1.6 + w * ((car - 3.2) / 7), 1.9, (car - 3.2) / 7 - 0.5, 1.1);
      R4(ctx, x0 + 1.5, 0.1, 3.4, 0.5, dk); R4(ctx, x0 + car - 4.9, 0.1, 3.4, 0.5, dk);
    }
    ctx.restore(); return;
  }
  if (c.boat) {
    poly(ctx, [-L / 2, 0.9, L / 2 + 0.6, 0.9, L / 2 - 0.3, -0.15, -L / 2 + 0.2, -0.15], col);
    R4(ctx, -L / 2, 0.55, L + 0.2, 0.12, S.tone('#b3312b', P));
    poly(ctx, [c.cab[0] * L, 0.9, c.cab[1] * L + 0.5, 0.9, c.cab[1] * L, 1.5, c.cab[0] * L + 0.2, 1.5], dk);
    R4(ctx, -L / 2 - 0.25, 0.3, 0.3, 0.9, S.tone('#1b1e24', P));
    ctx.restore(); return;
  }
  const by = c.wheel * 0.75;
  if (c.box) { R4(ctx, c.box[0] * L, by + 0.25, (c.box[1] - c.box[0]) * L, c.h - by - 0.25, S.tone(st && st.boxCol || '#d9dde2', P)); R4(ctx, c.box[0] * L, by, L * 0.98, 0.4, dk); }
  // lower body with rounded nose
  ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(-L / 2, by); ctx.lineTo(L / 2 - 0.1, by); ctx.quadraticCurveTo(L / 2 + 0.05, by + 0.3, L / 2 - 0.05, c.body);
  ctx.lineTo(-L / 2 + 0.05, c.body + (c.box ? 0 : 0.03)); ctx.quadraticCurveTo(-L / 2 - 0.08, by + 0.3, -L / 2, by); ctx.fill();
  // cabin
  const c0 = c.cab[0] * L, c1 = c.cab[1] * L, slopeF = kind === 'van' || kind === 'truck' ? 0.25 : 0.55, slopeR = kind === 'sedan' || kind === 'limo' ? 0.45 : 0.12;
  poly(ctx, [c0, c.body, c1 + slopeF, c.body, c1, c.h, c0 + slopeR, c.h], col);
  // windows
  for (let i = 0; i < c.win.length; i++) {
    const w0 = c.win[i][0] * L, w1 = c.win[i][1] * L, broken = st && st.glass && st.glass[i];
    R4(ctx, w0, c.body + 0.06, w1 - w0, c.h - c.body - 0.2, broken ? S.tone('#0d1016', P) : gl);
    if (!broken) { ctx.fillStyle = 'rgba(200,225,255,0.14)'; ctx.fillRect(w0, c.body + 0.06, (w1 - w0) * 0.35, c.h - c.body - 0.2); }
  }
  R4(ctx, -L / 2 + 0.02, by + 0.18, L - 0.06, 0.07, dk);
  // lights
  R4(ctx, L / 2 - 0.2, c.body - 0.28, 0.2, 0.16, S.pal.dark > 0.3 ? '#fff3c4' : S.tone('#e8e4d0', P));
  R4(ctx, -L / 2, c.body - 0.26, 0.14, 0.14, S.pal.dark > 0.3 ? '#ff4a3d' : S.tone('#a8322a', P));
  // wheels
  const wx = [-L * 0.31, L * 0.31];
  for (let i = 0; i < 2; i++) {
    const flat = st && st.flat && st.flat[i];
    ctx.fillStyle = S.tone('#0e1014', P); ctx.beginPath(); ctx.ellipse(wx[i], c.wheel * (flat ? 0.8 : 1), c.wheel, c.wheel * (flat ? 0.8 : 1), 0, 0, TAU); ctx.fill();
    circ(ctx, wx[i], c.wheel * (flat ? 0.8 : 1), c.wheel * 0.45, S.tone('#8d949a', P));
  }
  if (S.pal.dark > 0.3 && st && st.moving) { // headlight beam
    ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(L / 2, 0, L / 2 + 9, 0); g.addColorStop(0, 'rgba(255,240,190,0.28)'); g.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(L / 2, c.body - 0.2); ctx.lineTo(L / 2 + 9, c.body + 0.9); ctx.lineTo(L / 2 + 9, 0); ctx.closePath(); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}
// A parked car that never moves: scenery and cover.
K.parked = function (S, P, kind, x, dir, col, o) {
  o = o || {}; const c = CARS[kind], y = o.y || 0;
  P.add({ x0: x - c.len / 2 - 1, x1: x + c.len / 2 + 1, layer: o.layer === undefined ? 2 : o.layer, draw(ctx, env) { drawCar(ctx, env, S, P, kind, x, y, dir, col, null); } });
  P.solid(x - c.len / 2, y, c.len, c.body, 'thin');
  P.solid(x + (dir > 0 ? c.cab[0] : -c.cab[1]) * c.len, y + c.body, (c.cab[1] - c.cab[0]) * c.len, c.h - c.body, 'glasswall');
};

// ---- assorted props -----------------------------------------------------------
K.box = function (S, P, x, y, w, h, col, o) {
  o = o || {}; const c = S.tone(col, P, o.selfLit), d = S.tone(darken(col, 0.2), P, o.selfLit);
  P.add({ x0: x, x1: x + w, layer: o.layer || 0, draw(ctx, env) {
    R4(ctx, x, y, w, h, c);
    if (o.ribs && env.s > 2.2) { ctx.fillStyle = d; for (let xx = x + 0.3; xx < x + w; xx += o.ribs) ctx.fillRect(xx, y + 0.15, 0.1, h - 0.3); }
    if (o.band) R4(ctx, x, y + h - o.band, w, o.band, d);
    if (o.text) env.text(ctx, o.text, x + w / 2, y + h * 0.36, Math.min(h * 0.34, (w / o.text.length) * 1.2), S.tone(o.textCol || '#f1ede2', P, o.selfLit), 'center');
  } });
  if (o.solid !== false) P.solid(x, y, w, h, o.mat || 'wall');
};
K.container = function (S, P, x, y, col, text) { K.box(S, P, x, y, 6.1, 2.6, col, { ribs: 0.42, text, mat: 'hard' }); };

K.bench = function (S, P, x, o) {
  o = o || {}; const c = S.tone('#5b4634', P), m = S.tone('#22262c', P), y = o.y || 0;
  P.add({ x0: x - 1, x1: x + 1, layer: 0, draw(ctx, env) { R4(ctx, x - 0.9, y + 0.42, 1.8, 0.09, c); R4(ctx, x - 0.9, y + 0.6, 1.8, 0.08, c); R4(ctx, x - 0.9, y + 0.8, 1.8, 0.08, c); line(ctx, x - 0.75, y, x - 0.75, y + 0.9, m, 0.07, env); line(ctx, x + 0.75, y, x + 0.75, y + 0.9, m, 0.07, env); } });
};
K.table = function (S, P, x, o) {
  o = o || {}; const y = o.y || 0, m = S.tone('#2a2e36', P), top = S.tone(o.col || '#e9e4d6', P);
  P.add({ x0: x - 1.6, x1: x + 1.6, layer: o.layer || 0, draw(ctx, env) {
    line(ctx, x, y, x, y + 0.72, m, 0.07, env); R4(ctx, x - 0.55, y + 0.72, 1.1, 0.07, top); R4(ctx, x - 0.25, y, 0.5, 0.05, m);
    if (o.umbrella) { line(ctx, x, y + 0.78, x, y + 2.5, m, 0.05, env); poly(ctx, [x - 1.5, y + 2.35, x + 1.5, y + 2.35, x, y + 2.95], S.tone(o.umbrella, P)); }
    // two chairs
    for (const sx of [-1, 1]) { line(ctx, x + sx * 0.95, y, x + sx * 0.95, y + 0.9, m, 0.05, env); line(ctx, x + sx * 0.6, y, x + sx * 0.6, y + 0.47, m, 0.05, env); line(ctx, x + sx * 0.6, y + 0.47, x + sx * 0.95, y + 0.47, m, 0.06, env); }
  } });
};
K.crane = function (S, P, x, h, reach, o) {
  o = o || {}; const c = S.tone(o.col || '#d6a12a', P), d = S.tone('#2a2e36', P), y = o.y || 0;
  P.add({ x0: Math.min(x, x + reach) - 4, x1: Math.max(x, x + reach) + 6, layer: o.layer || 0, draw(ctx, env) {
    ctx.strokeStyle = c; ctx.lineWidth = Math.max(0.22, env.px);
    ctx.beginPath(); ctx.moveTo(x - 0.8, y); ctx.lineTo(x - 0.8, y + h); ctx.moveTo(x + 0.8, y); ctx.lineTo(x + 0.8, y + h);
    ctx.moveTo(x - reach * 0.3, y + h); ctx.lineTo(x + reach, y + h); ctx.moveTo(x - reach * 0.3, y + h + 1.4); ctx.lineTo(x + reach, y + h + 1.4);
    ctx.moveTo(x, y + h + 5); ctx.lineTo(x + reach, y + h + 1.4); ctx.moveTo(x, y + h + 5); ctx.lineTo(x - reach * 0.3, y + h + 1.4); ctx.moveTo(x, y + h); ctx.lineTo(x, y + h + 5);
    ctx.stroke();
    if (env.s > 1.2) { ctx.lineWidth = Math.max(0.1, env.px * 0.7); ctx.beginPath(); for (let yy = y; yy < y + h; yy += 1.6) { ctx.moveTo(x - 0.8, yy); ctx.lineTo(x + 0.8, yy + 1.6); ctx.moveTo(x + 0.8, yy); ctx.lineTo(x - 0.8, yy + 1.6); }
      const n = Math.floor(Math.abs(reach) * 1.3 / 1.4); for (let i = 0; i < n; i++) { const xa = x - reach * 0.3 + (i * reach * 1.3) / n, xb = x - reach * 0.3 + ((i + 1) * reach * 1.3) / n; ctx.moveTo(xa, y + h); ctx.lineTo(xb, y + h + 1.4); } ctx.stroke(); }
    R4(ctx, x - 1.4, y + h - 2.4, 2.8, 2.4, d); R4(ctx, x - 1.1, y + h - 1.9, 1.5, 1.2, S.tone(S.pal.dark > 0.5 ? S.pal.lit : S.pal.glass, P, true));
    R4(ctx, x - reach * 0.3 - 1.5, y + h - 1.6, 3, 1.8, S.tone('#6c737a', P));
  } });
  P.solid(x - 0.8, y, 1.6, h, 'grid');
};
K.neon = function (S, P, x, y, text, col, size) {
  P.add({ x0: x - 6, x1: x + 6, layer: 1, draw(ctx, env) {
    const flick = Math.sin(env.t * 37 + x) > -0.96 ? 1 : 0.35;
    ctx.globalAlpha = flick; env.text(ctx, text, x, y, size || 0.8, S.pal.dark > 0.2 ? col : S.tone(col, P), 'center', true); ctx.globalAlpha = 1;
  } });
};
K.steps = function (S, P, x0, x1, y0, y1, col) { // a simple ramp or stair drawn as a wedge
  const c = S.tone(col || '#7f868c', P);
  P.add({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), layer: 0, draw(ctx) { poly(ctx, [x0, y0, x1, y1, x1, y0], c); } });
};
K.tower = function (S, P, x, h, o) { // guard tower or water tower on legs with a cabin
  o = o || {}; const leg = S.tone('#3a3f47', P), cab = S.tone(o.col || '#6d5a45', P), y = o.y || 0, w = o.w || 3.4;
  const room = S.room((o.id || 'tw' + Math.round(x)), o.lit);
  P.add({ x0: x - w, x1: x + w, layer: 0, draw(ctx, env) {
    line(ctx, x - w / 2, y, x - w / 2 + 0.4, y + h, leg, 0.16, env); line(ctx, x + w / 2, y, x + w / 2 - 0.4, y + h, leg, 0.16, env);
    line(ctx, x - w / 2, y + h * 0.1, x + w / 2 - 0.3, y + h * 0.9, leg, 0.08, env); line(ctx, x + w / 2, y + h * 0.1, x - w / 2 + 0.3, y + h * 0.9, leg, 0.08, env);
    R4(ctx, x - w / 2 - 0.3, y + h, w + 0.6, 0.25, leg);
    R4(ctx, x - w / 2, y + h + 0.25, w, 1.0, cab);
    R4(ctx, x - w / 2, y + h + 1.25, w, 1.25, room.lit ? S.tone('#ffd98a', P, true) : S.tone(S.pal.inRoom, P));
    line(ctx, x - w / 2, y + h + 1.25, x - w / 2, y + h + 2.5, leg, 0.14, env); line(ctx, x + w / 2, y + h + 1.25, x + w / 2, y + h + 2.5, leg, 0.14, env);
  } });
  P.add({ x0: x - w, x1: x + w, layer: 1, draw(ctx) { poly(ctx, [x - w / 2 - 0.5, y + h + 2.5, x + w / 2 + 0.5, y + h + 2.5, x + w / 2, y + h + 3.3, x - w / 2, y + h + 3.3], S.tone(darken(o.col || '#6d5a45', 0.3), P)); } });
  P.solid(x - w / 2, y + h, w, 1.25, 'wood');
  P.open({ x: x - w / 2, y: y + h + 1.25, w, h: 1.25, room: room.id, glass: false, through: true });
  return { x, floor: y + h + 0.25, room: room.id };
};

CB.K = K; CB.makeScene = makeScene; CB.CARS = CARS;
