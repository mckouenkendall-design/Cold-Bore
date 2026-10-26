// ---------------------------------------------------------------------------
// The scope's own glass: each make of scope has its own coating and edge, rain and snow land
// on the lens, frost creeps in from the rim in the cold, a low sun throws flare across it, and
// at low power the blurred edge of the shooter's own hide shows along the bottom. After dark
// the middle of the reticle lights up (red, green or amber by make) so it never vanishes
// against a night sky. All of it is drawn on the glass, over the world and never into it.
// ---------------------------------------------------------------------------

// tint: the colour of the coating (laid on in soft light); edge: how dark the rim is;
// illum: the colour the reticle lights up in the dark (none for night vision).
const SCOPE_GLASS = {
  hunter: { tint: '#ffe2a8', ta: 0.07, edge: 0.34, illum: '255,52,36' },
  zf4: { tint: '#ffd890', ta: 0.09, edge: 0.4, illum: '255,150,40' },
  ranger: { tint: '#e8f0ff', ta: 0.05, edge: 0.3, illum: '255,52,36' },
  bdc: { tint: '#fff0d8', ta: 0.05, edge: 0.3, illum: '255,52,36' },
  pso: { tint: '#ffcf80', ta: 0.1, edge: 0.38, illum: '255,96,40' },
  tac: { tint: '#d8e8ff', ta: 0.05, edge: 0.26, illum: '70,255,110' },
  night: { tint: null, ta: 0, edge: 0.3, illum: null },
  lrf: { tint: '#d0e4ff', ta: 0.06, edge: 0.26, illum: '255,170,50' },
  tree: { tint: '#f0f4ff', ta: 0.04, edge: 0.24, illum: '255,52,36' },
  comp: { tint: '#f4f8ff', ta: 0.03, edge: 0.2, illum: '70,255,110' },
  oracle: { tint: '#c8f4ff', ta: 0.06, edge: 0.22, illum: '80,230,255' },
};
function glassOf(st) { return SCOPE_GLASS[st.scope.id] || SCOPE_GLASS.ranger; }

// Everything on the glass that lies over the picture, called by drawLens before the dark edge.
View.prototype.drawGlass = function (sim, cam) {
  const V = this, ctx = V.ctx, S = sim.S, st = sim.st, G = glassOf(st), nv = !!st.scope.nv;
  const x0 = cam.cx - cam.hw, y0 = cam.cy - cam.hh, W = cam.hw * 2, H = cam.hh * 2;
  // (the coating's tint is laid on with the colour of the hour, in one pass: see drawGrade)
  if (V.mode !== 'plain') V.drawHide(sim, cam);
  if (!nv) V.drawFlare(sim, cam);
  V.drawLensWet(sim, cam);
};

// A low sun in or near the picture: a veil of glare, and a line of ghosts (the reflections
// between the lens elements) running from the sun through the middle and out the other side.
View.prototype.drawFlare = function (sim, cam) {
  const V = this, S = sim.S, ctx = V.ctx; if (S.pal.dark > 0.5 || S.weather === 'rain' || S.weather === 'storm' || S.weather === 'fog' || S.time === 'overcast') return;
  const sx = cam.cx + (S.sky.sun[0] - cam.ax) * cam.ppm, sy = cam.cy - (S.sky.sun[1] - cam.ay) * cam.ppm;
  const R = Math.max(cam.hw, cam.hh), dx = sx - cam.cx, dy = sy - cam.cy, d = Math.hypot(dx, dy);
  if (d > R * 1.5) return;
  // is anything standing between us and the sun? (asked of the scene a few times a second; a sun
  // behind a building or a hill throws no flare)
  if (!V._sunSeen || V.rt - V._sunSeen.t > 0.25 || V._sunSeen.sim !== sim) {
    const hit = sim.rangeAt(S.sky.sun[0], S.sky.sun[1]), lit = hit ? 0 : 1;
    V._sunSeen = { t: V.rt, sim, lit: V._sunSeen && V._sunSeen.sim === sim ? V._sunSeen.lit * 0.4 + lit * 0.6 : lit };
  }
  const k = V._sunSeen.lit * clamp(1.5 - d / R, 0, 1) * (S.time === 'day' ? 0.8 : 1); if (k < 0.03) return;
  const low = S.time === 'dawn' || S.time === 'dusk';
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.12 * k; ctx.drawImage(kxBlob(low ? '#ffb070' : '#fff2d8'), sx - R * 0.9, sy - R * 0.9, R * 1.8, R * 1.8);
  // a thin streak across the glass through the sun
  ctx.globalAlpha = 0.16 * k; ctx.drawImage(kxBlob(low ? '#ffc890' : '#e8f0ff'), sx - R * 1.4, sy - 3, R * 2.8, 6);
  const ghosts = [[0.35, 0.05, '#7dffb0', 0.1], [0.62, 0.09, '#ffd27a', 0.08], [0.9, 0.035, '#b48aff', 0.14], [1.25, 0.14, '#7ac8ff', 0.06], [1.6, 0.06, '#ff9a6a', 0.1], [1.85, 0.2, '#9affd0', 0.05]];
  // (the ghosts line up through the middle of the glass, so with the sun dead centre they would all sit on it)
  const gk = smooth(d / (R * 0.3));
  for (let i = 0; i < ghosts.length && gk > 0.02; i++) {
    const g = ghosts[i], gx = sx - dx * 2 * g[0], gy = sy - dy * 2 * g[0], r = R * g[1];
    ctx.globalAlpha = g[3] * k * gk; ctx.fillStyle = g[2]; ctx.beginPath();
    for (let j = 0; j < 6; j++) { const a = j * TAU / 6 + 0.3; if (j) ctx.lineTo(gx + Math.cos(a) * r, gy + Math.sin(a) * r); else ctx.moveTo(gx + Math.cos(a) * r, gy + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
};

// Rain and snow on the lens, and frost round the rim in the cold. The drops sit out toward the
// edge (a shooter keeps the middle of the glass clear), bead and slide slowly down; flakes land,
// sit a while and melt. Out of focus, so they are soft: a dark rim, a lighter body, a glint.
View.prototype.drawLensWet = function (sim, cam) {
  const V = this, S = sim.S, ctx = V.ctx, w = S.weather, wet = w === 'rain' || w === 'storm', snow = w === 'snow';
  const R = Math.min(V.RR || cam.hh, Math.hypot(cam.hw, cam.hh)), dt = Math.min(0.1, Math.max(0, V.rt - (V._lwT || V.rt))); V._lwT = V.rt;
  if (!V.lens || V.lens.sim !== sim) V.lens = { sim, drops: [], R: makeRng(919) };
  const L = V.lens, rng = L.R;
  if ((wet || snow) && dt > 0) {
    const rate = wet ? (w === 'storm' ? 2.2 : 1.2) : 0.7, want = wet ? (w === 'storm' ? 26 : 16) : 14;
    if (L.drops.length < want && rng.f() < rate * dt * 4) {
      const a = rng.r(0, TAU), rr = rng.r(0.5, 0.98);
      L.drops.push({ a, rr, s: wet ? rng.r(0.012, 0.034) : rng.r(0.01, 0.022), life: wet ? rng.r(5, 12) : rng.r(4, 9), t: 0, slide: wet ? rng.r(0.002, 0.02) : 0, kind: wet ? 0 : 1, sp: rng.f() });
    }
  }
  if (L.drops.length) {
    // all the drops in a few fills (each grows in as it beads and shrinks away as it dries)
    const D = V._lwPos || (V._lwPos = []); D.length = 0;
    for (let i = L.drops.length - 1; i >= 0; i--) {
      const q = L.drops[i]; q.t += dt; if (q.t > q.life) { L.drops.splice(i, 1); continue; }
      const fade = Math.min(1, q.t * 3) * Math.min(1, (q.life - q.t) / 1.2);
      D.push(cam.cx + Math.cos(q.a) * q.rr * R, cam.cy + Math.sin(q.a) * q.rr * R + q.t * q.slide * R, q.s * R * (0.4 + 0.6 * fade), q.kind, q.slide > 0.012 ? q.t * q.slide * R : 0, q.sp, fade);
    }
    ctx.save();
    const pass = (style, fn) => { ctx.fillStyle = style; ctx.beginPath(); for (let i = 0; i < D.length; i += 7) if (D[i + 3] === 0) fn(D[i], D[i + 1], D[i + 2], D[i + 4]); ctx.fill(); };
    pass('rgba(10,14,20,0.3)', (x, y, r) => { ctx.moveTo(x + r, y + r * 0.08); ctx.ellipse(x, y + r * 0.08, r, r * 1.08, 0, 0, TAU); });
    pass('rgba(200,215,235,0.1)', (x, y, r, tr) => { if (tr > r) ctx.rect(x - r * 0.25, y - tr, r * 0.5, tr); });
    pass('rgba(200,215,235,0.2)', (x, y, r) => { ctx.moveTo(x + r * 0.78, y + r * 0.15); ctx.ellipse(x, y + r * 0.15, r * 0.78, r * 0.84, 0, 0, TAU); });
    pass('rgba(255,255,255,0.65)', (x, y, r) => { ctx.moveTo(x - r * 0.14, y - r * 0.35); ctx.arc(x - r * 0.32, y - r * 0.35, r * 0.18, 0, TAU); });
    // snowflakes: a soft white bloom each, then every flake's three strokes in one line
    let flakes = 0, rs = 0; const bl = kxBlob('#ffffff');
    for (let i = 0; i < D.length; i += 7) { if (D[i + 3] !== 1) continue; flakes++; rs += D[i + 2]; const r = D[i + 2]; ctx.globalAlpha = 0.5 * D[i + 6]; ctx.drawImage(bl, D[i] - r * 1.4, D[i + 1] - r * 1.4, r * 2.8, r * 2.8); }
    if (flakes) {
      ctx.globalAlpha = 0.65; ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(0.8, rs / flakes * 0.18); ctx.beginPath();
      for (let i = 0; i < D.length; i += 7) { if (D[i + 3] !== 1) continue; const x = D[i], y = D[i + 1], r = D[i + 2]; for (let k = 0; k < 3; k++) { const an = D[i + 5] * 3 + k * Math.PI / 3; ctx.moveTo(x - Math.cos(an) * r, y - Math.sin(an) * r); ctx.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r); } }
      ctx.stroke();
    }
    ctx.restore();
  }
};

// Frost grown in over the dark rim of the glass in the cold: white feathers on black.
View.prototype.drawFrost = function (sim, cam) {
  const V = this, S = sim.S, ctx = V.ctx, snow = S.weather === 'snow', cold = snow || S.time === 'snow' || (S.look && S.look.dress === 'frost');
  if (!cold || V.mode === 'plain') return;
  const R = Math.min(V.RR || cam.hh, Math.hypot(cam.hw, cam.hh));
  // frost: a feathery white fringe grown in from the rim (made once)
  if (!V.frostPic) {
    const N = 512, c = kxCanvas(N, N), g = c.getContext('2d'), D = makeRng(4242);
    g.strokeStyle = 'rgba(235,245,255,0.55)'; g.lineCap = 'round';
    for (let i = 0; i < 260; i++) {
      const a = D.r(0, TAU), r0 = N / 2 - D.r(0, 10), len = D.r(10, 60) * (0.5 + 0.5 * Math.abs(Math.sin(a * 3))), x = N / 2 + Math.cos(a) * r0, y = N / 2 + Math.sin(a) * r0;
      const ex = x - Math.cos(a + D.r(-0.4, 0.4)) * len, ey = y - Math.sin(a + D.r(-0.4, 0.4)) * len;
      g.lineWidth = D.r(0.6, 1.8); g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey);
      for (let k = 1; k < 4; k++) { const u = k / 4, bx = lerp(x, ex, u), by = lerp(y, ey, u), bl = len * 0.25 * (1 - u), ba = a + Math.PI + (k % 2 ? 0.7 : -0.7); g.moveTo(bx, by); g.lineTo(bx + Math.cos(ba) * bl, by + Math.sin(ba) * bl); }
      g.stroke();
    }
    V.frostPic = c;
  }
  const RR = (V.RR || R) * 0.985, k = snow ? 0.7 : 0.45;
  ctx.save(); ctx.globalAlpha = k; ctx.drawImage(V.frostPic, cam.cx - RR, cam.cy - RR, RR * 2, RR * 2); ctx.restore();
};

// The shooter's own hide, right in front of the objective and so far out of focus it is only a
// soft shape along the bottom of the glass: a roof parapet in town, grass on the hills. It shows
// only at low power and has gone by about 5x.
View.prototype.drawHide = function (sim, cam) {
  const V = this, ctx = V.ctx, S = sim.S, z = sim.sh.zoom, k = 1 - smooth((z - 3) / 2.2); if (k < 0.02) return;
  const kind = S.ambience === 'wild' || S.ambience === 'snow' ? 'grass' : 'wall';
  const x0 = cam.cx - cam.hw, W = cam.hw * 2, yb = cam.cy + cam.hh, H = cam.hh * 2, dark = S.pal.dark;
  const ink = dark > 0.5 ? '#05070b' : mix('#2a2622', S.pal.amb, S.pal.ambT * 0.6), panX = cam.ax * cam.ppm * 0.15;
  ctx.save(); ctx.globalAlpha = 0.85 * k;
  if (kind === 'wall') {
    // the coping of the parapet: a dark soft band with a lit top edge, along the very bottom
    const top = yb - H * 0.07; ctx.drawImage(kxBlob(ink), x0 - W * 0.2, top - H * 0.05, W * 1.4, H * 0.3);
    ctx.globalAlpha = 0.3 * k; ctx.drawImage(kxBlob(dark > 0.5 ? '#3a4660' : '#d8c8b0'), x0 - W * 0.1, top - H * 0.035, W * 1.2, H * 0.05);
  } else if (kind === 'grass') {
    // a few blurred blades leaning up into the bottom of the picture
    const col = S.time === 'snow' ? '#c8d2dc' : dark > 0.5 ? '#04080a' : mix('#3a5a32', S.pal.amb, S.pal.ambT * 0.6), sway = Math.sin(V.rt * 0.9) * 6 + (sim.wind() || 0) * 2;
    ctx.fillStyle = col;
    // each blade three times, wider and fainter each time: out of focus, without a blur filter
    for (let pass = 0; pass < 3; pass++) {
      const grow = [1, 1.6, 2.4][pass]; ctx.globalAlpha = [0.16, 0.1, 0.07][pass] * k; ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const bx = x0 + ((i * 83 + 40 - panX) % (W + 80) + W + 80) % (W + 80) - 40, h = H * (0.08 + kxH(i, 5) * 0.14) * (1 + (grow - 1) * 0.15), bw = (3 + kxH(i, 9) * 6) * grow, lean = (kxH(i, 2) - 0.5) * 60 + sway;
        ctx.moveTo(bx - bw, yb + 4); ctx.quadraticCurveTo(bx + lean * 0.4, yb - h * 0.5, bx + lean, yb - h); ctx.quadraticCurveTo(bx + lean * 0.5 + bw * 0.3, yb - h * 0.45, bx + bw, yb + 4); ctx.closePath();
      }
      ctx.fill();
    }
    ctx.globalAlpha = 0.6 * k; ctx.drawImage(kxBlob(col), x0 - W * 0.2, yb - H * 0.06, W * 1.4, H * 0.18);
  }
  ctx.restore();
};

// How strongly the reticle lights up: off by day, coming on as the light goes, full at night.
View.prototype.reticleGlow = function (sim) {
  const S = sim.S, G = glassOf(sim.st); if (!G.illum || sim.st.scope.nv) return 0;
  const dark = S.pal.dark + (S.weather === 'storm' ? 0.2 : S.weather === 'rain' || S.weather === 'fog' ? 0.1 : 0);
  return smooth((dark - 0.32) / 0.4);
};
// The reticle: etched black, and after dark its middle lit in the scope's own colour. The lit
// part is the same drawing in another ink, cut to a circle round the middle, so every mark stays
// exactly where it was and true to scale.
View.prototype.drawReticleLit = function (sim, cam) {
  const V = this, ctx = V.ctx, k = V.reticleGlow(sim);
  V.drawReticle(sim, cam.cx, cam.cy, cam.ppm);
  if (k < 0.02) return;
  const G = glassOf(sim.st), Rv = Math.min(V.RR || V.R, V.hh || V.R), r = Rv * 0.62;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.14 * k; ctx.drawImage(kxBlob(kxHexOf(G.illum)), cam.cx - 26, cam.cy - 26, 52, 52);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(cam.cx, cam.cy, r, 0, TAU); ctx.clip();
  V.retInk = 'rgba(' + G.illum + ',' + (0.55 + 0.4 * k).toFixed(2) + ')';
  try { V.drawReticle(sim, cam.cx, cam.cy, cam.ppm); } finally { V.retInk = null; }
  ctx.restore();
};
