// ---------------------------------------------------------------------------
// The Ashlock valley: August Calloway's lodge, seen from high on the far side.
//
// Shots here are 350 to 700 m and the shooter looks DOWN into the valley, so
// the scene is planned in angles. From the mission's main position the near
// bank, the road, the slope, the lodge, four ranks of pine hills, two ranks of
// peaks and the sky stack up one above the other, each on its own plane at its
// own real distance, so they slide against each other as the scope pans.
//
// Kit pieces added here (all usable by other scenes):
//   K.alpPeaks    jagged snow peaks
//   K.forestHill  a hill covered in rows of pines, with valley mist at its foot
//   K.chalet      the timber lodge (windows are rooms, like K.building)
//   K.highSeat    a hunting tower: an open hide on legs with a stair
//   K.alpWindsock    the plainest wind tell there is
//   K.bigFlag     a flag large enough to read at half a kilometre
//   K.plume       chimney smoke that leans with the wind
//   K.dishMast    a radio dish on a mast (a shootable 'dish')
//   K.logLoad     a bundle of logs on a hook (a K.hang load with its own look)
//   K.farDuck     the rubber duck (K.thing 'duck'), drawn a little larger for long ranges
// Vehicle kinds added to CARS: gondola, chopper, suvbox.
// SCN.valley(o) returns handles H: planes, the lodge, and placement helpers
// H.deck(x), H.yard(x), H.road(x), H.inLodge(floor, column), H.tower.place(dx).
// H.kit is the list of pieces above, for missions that want to add one.
// ---------------------------------------------------------------------------

// One pine outline added to the current path (no fill), so a whole row of
// trees can be painted with a single fill.
function vlyPine(ctx, x, y, h, w) {
  ctx.moveTo(x, y + h);
  ctx.lineTo(x - w * 0.42, y + h * 0.62); ctx.lineTo(x - w * 0.2, y + h * 0.62);
  ctx.lineTo(x - w * 0.72, y + h * 0.33); ctx.lineTo(x - w * 0.36, y + h * 0.33);
  ctx.lineTo(x - w, y); ctx.lineTo(x + w, y);
  ctx.lineTo(x + w * 0.36, y + h * 0.33); ctx.lineTo(x + w * 0.72, y + h * 0.33);
  ctx.lineTo(x + w * 0.2, y + h * 0.62); ctx.lineTo(x + w * 0.42, y + h * 0.62);
  ctx.closePath();
}
// first index in a list sorted by [0] that is not left of x
function vlyFrom(arr, x) { let a = 0, b = arr.length; while (a < b) { const m = (a + b) >> 1; if (arr[m][0] < x) a = m + 1; else b = m; } return a; }

// ---- shared drawing helpers for the valley ---------------------------------------
// A spruce with `n` drooping tiers of branches, added to the current path. `sw` pushes
// the top sideways (metres) so a row of trees can lean and nod in the wind; `fb` is how
// much of the height is bare trunk below the lowest branches.
function alpSpruce(ctx, x, y, h, w, n, sw, fb) {
  const y0 = y + h * fb, hh = h - h * fb, dn = (hh * 0.3) / n;
  ctx.moveTo(x + sw, y + h);
  for (let k = n - 1; k >= 0; k--) {
    const u = k / n, wo = w * (1 - u * 0.88), xo = x + sw * u * u, yy = y0 + hh * u;
    ctx.lineTo(xo - wo, yy);
    if (k) ctx.lineTo(xo - wo * 0.46, yy + dn);
  }
  for (let k = 0; k < n; k++) {
    const u = k / n, wo = w * (1 - u * 0.88), xo = x + sw * u * u, yy = y0 + hh * u;
    if (k) ctx.lineTo(xo + wo * 0.46, yy + dn);
    ctx.lineTo(xo + wo, yy);
  }
  ctx.closePath();
}
// The sunny side of the same tree (d = 1 right, -1 left): the branch tips on that side.
function alpSpruceLit(ctx, x, y, h, w, n, sw, fb, d) {
  const y0 = y + h * fb, hh = h - h * fb, dn = (hh * 0.3) / n;
  ctx.moveTo(x + sw, y + h);
  for (let k = n - 1; k >= 0; k--) {
    const u = k / n, wo = w * (1 - u * 0.88), xo = x + sw * u * u, yy = y0 + hh * u;
    ctx.lineTo(xo + d * wo, yy);
    if (k) ctx.lineTo(xo + d * wo * 0.46, yy + dn);
  }
  ctx.lineTo(x + d * w * 0.36, y0); ctx.closePath();
}
// Snow lying on the upper side of every tier of the same tree.
function alpSpruceSnow(ctx, x, y, h, w, n, sw, fb) {
  const y0 = y + h * fb, hh = h - h * fb, th = hh / n;
  for (let k = 0; k < n; k++) {
    const u = k / n, wo = w * (1 - u * 0.88), xo = x + sw * u * u, yy = y0 + hh * u, u1 = (k + 1) / n, xa = x + sw * u1 * u1;
    ctx.moveTo(xa, yy + th * (k === n - 1 ? 1 : 1.18)); ctx.lineTo(xo - wo * 0.82, yy + th * 0.22); ctx.lineTo(xo - wo * 0.55, yy + th * 0.4); ctx.lineTo(xo - wo * 0.05, yy + th * 0.72); ctx.lineTo(xo + wo * 0.5, yy + th * 0.42); ctx.lineTo(xo + wo * 0.8, yy + th * 0.2); ctx.closePath();
  }
}
// The air itself: how far the wind has carried things so far (metres). Mist, cloud shadow,
// grass ripples and drifting seeds all ride on this, so they travel the way the wind blows,
// faster when it blows harder, and all agree with each other.
const alpAir = { t: -1, x: 0 };
function alpDrift(env) {
  if (env.t !== alpAir.t) { alpAir.x += env.wind * clamp(env.t - alpAir.t, 0, 0.1); alpAir.t = env.t; }
  return alpAir.x;
}
// Wind strength on a 0 to 1 scale for drawing (7 m/s and over is "full").
function alpGale(env) { return Math.min(1, Math.abs(env.wind) / 7); }
// x wrapped into the stretch [a, a + span), for things that drift round and round
function alpWrap(x, a, span) { return a + ((((x - a) % span) + span) % span); }
// a closed polygon from a flat list of numbers, added to the current path
function alpPath(ctx, p) { ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); ctx.closePath(); }

// Grass for an open slope or a lawn: broad patches a shade deeper, the pale ripples wind
// sends through long grass, tufts whose blades lean downwind, and drifts of small flowers.
// q.yAt(x) is the top edge of the turf; everything is drawn below it, within q.depth metres.
// q.skip(x, y) can keep things off paths and paving. Returns the function that draws it.
function alpTurf(S, P, q) {
  const D = makeRng(q.seed || 5), snowy = S.time === 'snow', x0 = q.x0, x1 = q.x1, span = x1 - x0, dep = q.depth, yAt = q.yAt, top = q.top === undefined ? 0.5 : q.top, skip = q.skip || (() => false);
  const blade = S.tone(snowy ? '#cfd8e0' : darken(q.col, 0.17), P), pale = S.tone(snowy ? '#fbfcfd' : mix(lighten(q.col, 0.2), '#d9e2a0', 0.25), P), deep = S.tone(snowy ? '#dde4ea' : darken(q.col, 0.055), P);
  const flC = ['#f4f1e4', '#f1d24a', '#b48ad0'].map((c) => S.tone(c, P)), TU = [], FL = [], RP = [], PA = [];
  for (let i = 0, n = Math.round(span * (q.tufts === undefined ? 0.9 : q.tufts)); i < n; i++) { const x = D.r(x0, x1), y = yAt(x) - D.r(top, dep); if (!skip(x, y)) TU.push([x, y, D.r(0.22, 0.42), D.r(0, TAU)]); }
  TU.sort((a, b) => a[0] - b[0]);
  if (!snowy) {
    for (let i = 0, n = Math.round(span * 0.13); i < n; i++) { const x = D.r(x0, x1), y = yAt(x) - D.r(top + 0.4, dep * 0.85), c = D.i(0, 2), m = D.i(4, 9); for (let k = 0; k < m; k++) { const fx = x + D.gauss() * 1.3, fy = y + D.gauss() * 0.5; if (!skip(fx, fy) && fy < yAt(fx) - 0.2) FL.push([fx, fy, c, D.r(0.06, 0.1)]); } }
    FL.sort((a, b) => a[0] - b[0]);
  }
  for (let i = 0, n = Math.round(span / 12); i < n; i++) RP.push([x0 + span * (i + D.f()) / n, D.r(top + 0.6, dep * 0.92), D.r(4, 11), D.r(0.24, 0.48), D.r(0, TAU), D.r(0.7, 1.3)]);
  for (let i = 0, n = Math.round(span / 22); i < n; i++) { const x = x0 + span * (i + D.f()) / n; PA.push([x, D.r(top + 1, dep * 0.9), D.r(6, 15), D.r(0.5, 1.3)]); }
  return function (ctx, env) {
    const a = alpGale(env), dir = env.wind >= 0 ? 1 : -1, s = env.s;
    if (s > 0.9) { // patches
      ctx.fillStyle = deep; ctx.beginPath(); let n = 0;
      for (let i = 0; i < PA.length; i++) { const p = PA[i]; if (p[0] + p[2] < env.x0 || p[0] - p[2] > env.x1) continue; const y = yAt(p[0]) - p[1]; ctx.moveTo(p[0] + p[2], y); ctx.ellipse(p[0], y, p[2], p[3], 0, 0, TAU); n++; }
      if (n) ctx.fill();
    }
    if (s > 1.2) { // ripples that run with the wind: quicker, longer and brighter the harder it blows
      const dr = alpDrift(env) * 1.5;
      for (let g = 0; g < 2; g++) {
        ctx.fillStyle = rgba(pale, (g ? 0.26 : 0.14) + 0.42 * a); ctx.beginPath(); let n = 0;
        for (let i = g; i < RP.length; i += 2) {
          const r = RP[i], x = alpWrap(r[0] + dr * r[5], x0, span); if (x + r[2] * 1.5 < env.x0 || x - r[2] * 1.5 > env.x1) continue;
          const y = yAt(x) - r[1], k = 0.55 + 0.45 * Math.sin(env.t * (0.5 + a) + r[4]), w = r[2] * (0.45 + 0.75 * a + 0.2 * k), lead = dir * w * 0.45;
          ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x + lead, y + r[3] * k * 2, x + w, y); ctx.quadraticCurveTo(x + lead, y - r[3] * k, x - w, y); n++;
        }
        if (n) ctx.fill();
      }
    }
    if (s > 7) { // tufts
      const lean = dir * (0.1 + 0.85 * a), wt = env.t * (2 + a * 6);
      ctx.strokeStyle = blade; ctx.lineWidth = Math.max(0.035, env.px * 0.85); ctx.beginPath();
      for (let i = vlyFrom(TU, env.x0 - 1); i < TU.length && TU[i][0] < env.x1 + 1; i++) {
        const t = TU[i], h = t[2], sw = h * (lean + (0.1 + 0.22 * a) * Math.sin(wt + t[3]));
        ctx.moveTo(t[0] - h * 0.3, t[1]); ctx.lineTo(t[0] - h * 0.42 + sw * 0.8, t[1] + h * 0.8);
        ctx.moveTo(t[0], t[1]); ctx.lineTo(t[0] + sw, t[1] + h);
        ctx.moveTo(t[0] + h * 0.3, t[1]); ctx.lineTo(t[0] + h * 0.45 + sw * 0.9, t[1] + h * 0.75);
      }
      ctx.stroke();
    }
    if (s > 11 && FL.length) { // flowers
      for (let c = 0; c < 3; c++) {
        ctx.fillStyle = flC[c]; ctx.beginPath(); let n = 0;
        for (let i = vlyFrom(FL, env.x0 - 1); i < FL.length && FL[i][0] < env.x1 + 1; i++) { const f = FL[i]; if (f[2] !== c) continue; const r = Math.max(f[3], env.px * 0.7); ctx.moveTo(f[0] + r, f[1]); ctx.arc(f[0], f[1], r, 0, TAU); n++; }
        if (n) ctx.fill();
      }
    }
  };
}

// ---- far snow peaks ---------------------------------------------------------
// Each summit is a folded-paper mountain: a sharp ridge runs down from the top and
// splits a sunlit face from a shadowed one, gullies divide one summit from the next,
// and bands across both faces give them their ribs. Snow lies above a ragged line and
// runs lower down the couloirs; rock bands break through it; a glacier hangs on the
// highest summit; cloud shadow and valley mist drift across with the wind, and snow
// blows off the tops in a plume that points the way the wind goes.
K.alpPeaks = function (S, z, o) {
  o = o || {};
  const P = S.plane(z, 'peaks'), sd = o.seed || 5, R = makeRng(sd * 13 + 1), D = makeRng(sd * 71 + 13);
  const base = o.base || 0, top = o.top === undefined ? base + 600 : o.top, Hh = top - base;
  const x0 = o.x0 === undefined ? -z * 0.6 - 300 : o.x0, x1 = o.x1 === undefined ? z * 0.6 + 300 : o.x1;
  const sm = []; let sx = x0 - Hh;
  while (sx < x1 + Hh) { sm.push({ x: sx, h: Hh * R.r(0.5, 1), l: R.r(0.7, 1.35), r: R.r(0.7, 1.35) }); sx += Hh * R.r(0.5, 1.15); }
  const cone = (x) => { let y = Hh * 0.2; for (let i = 0; i < sm.length; i++) { const d = x - sm[i].x, v = sm[i].h - Math.abs(d) * (d < 0 ? sm[i].l : sm[i].r); if (v > y) y = v; } return y; };
  const ridge = (x) => base + cone(x) + Hh * 0.03 * vnoise(x / (Hh * 0.07), sd) + Hh * 0.015 * vnoise(x / (Hh * 0.021), sd + 9) + Hh * 0.008 * Math.abs(vnoise(x / (Hh * 0.0065), sd + 21));
  const step = Hh * 0.012, pts = [];
  for (let x = x0; x <= x1 + step; x += step) pts.push([x, ridge(x)]);
  const sl = o.snowLine === undefined ? 0.52 : o.snowLine, sunD = S.sky.sun[0] >= 0 ? 1 : -1;
  const snowY = (x) => base + Hh * (sl + 0.07 * vnoise(x / (Hh * 0.6), sd + 3));

  // the snow line: rock ribs poke up into it and snow runs down the gullies, now and then a long way
  const sn = [], fans = [];
  for (let x = x0; x <= x1 + step;) {
    const yl = snowY(x), w = Hh * D.r(0.014, 0.04), kind = D.f();
    if (kind < 0.1) {           // a couloir: a narrow tongue of snow far down a gully, with a fan of scree below it
      const deep = D.r(0.07, 0.16), xm = x + w * D.r(0.3, 0.7);
      sn.push([x, yl - Hh * 0.004], [x + w * 0.3, yl - Hh * deep * D.r(0.4, 0.6)], [xm, yl - Hh * deep], [x + w * 0.72, yl - Hh * deep * D.r(0.3, 0.5)]);
      fans.push([xm, yl - Hh * deep + Hh * 0.02, xm - w * D.r(1.1, 1.9), yl - Hh * (deep + 0.085), xm + w * D.r(1.1, 1.9), yl - Hh * (deep + 0.085)]);
      x += w;
    } else if (kind < 0.45) {   // a rib of rock standing up into the snow
      sn.push([x, yl - Hh * D.r(0, 0.012)], [x + w * D.r(0.35, 0.65), yl + Hh * D.r(0.02, 0.065)]); x += w * D.r(0.9, 1.3);
    } else { sn.push([x, yl + Hh * D.r(-0.016, 0.012)]); x += w * D.r(0.6, 1.5); }
  }

  // the summits that show on the skyline, the cols between them, and a wandering line down from each
  const vis = sm.filter((s) => cone(s.x) <= s.h + 1e-6);
  const zig = (xt, yt, xb, amp) => { const a = []; for (let k = 0; k <= 8; k++) { const u = k / 8; a.push([lerp(xt, xb, u) + (k > 0 && k < 8 ? (k % 2 ? 1 : -1) * D.r(0.35, 1) * amp : 0), k ? lerp(yt, base - 12, u) : yt + Hh * 0.07]); } return a; };
  const gul = [zig(vis[0].x - Hh * 2, base + Hh * 0.2, vis[0].x - Hh * 2, 0)];
  for (let i = 0; i + 1 < vis.length; i++) {
    const a = vis[i], b = vis[i + 1], xc = clamp((a.h - b.h + a.x * a.r + b.x * b.l) / (a.r + b.l), a.x + (b.x - a.x) * 0.15, b.x - (b.x - a.x) * 0.15), hc = Math.max(Hh * 0.2, a.h - (xc - a.x) * a.r);
    gul.push(zig(xc, base + hc, xc + D.r(-0.06, 0.06) * Hh, Hh * 0.016));
  }
  const last = vis[vis.length - 1]; gul.push(zig(last.x + Hh * 2, base + Hh * 0.2, last.x + Hh * 2, 0));
  const flat = (a) => { const p = []; for (let i = 0; i < a.length; i++) p.push(a[i][0], a[i][1]); return p; };
  const mid = (p, q, j) => [(p[0] + q[0]) / 2 + D.r(-1, 1) * j, (p[1] + q[1]) / 2 + D.r(-1, 1) * j];
  const shades = [], half = [], glow = [], bands = [], strata = [], tops = [];
  vis.forEach((s, i) => {
    const GL = gul[i], GR = gul[i + 1], wl = s.x - GL[0][0], wr = GR[0][0] - s.x;
    const A = zig(s.x, base + s.h, s.x + clamp(D.r(-0.2, 0.2) * s.h, -wl * 0.5, wr * 0.5), s.h * 0.035);
    const dark = sunD > 0 ? GL : GR, lit = sunD > 0 ? GR : GL;
    // the face turned away from the sun
    const sp = flat(A).concat(flat(dark.slice().reverse()), [dark[0][0], top + 60, A[0][0], top + 60]);
    shades.push({ a: Math.min(GL[0][0], GL[8][0]) - Hh * 0.05, b: Math.max(GR[0][0], GR[8][0]) + Hh * 0.05, p: sp });
    // ribs: slanting bands from the ridge out to the gully, a little darker on the sunny face and a little lighter on the dark one
    [[lit, half], [dark, glow]].forEach((q) => { for (let j = 1; j <= 5; j += 2) {
      const G = q[0], m1 = mid(A[j], G[j + 1], s.h * 0.02), m2 = mid(A[j + 1], G[j + 2], s.h * 0.02);
      q[1].push({ a: Math.min(A[j][0], G[j + 1][0], G[j + 2][0]) - 1, b: Math.max(A[j][0], G[j + 1][0], G[j + 2][0]) + 1, p: [A[j][0], A[j][1], m1[0], m1[1], G[j + 1][0], G[j + 1][1], G[j + 2][0], G[j + 2][1], m2[0], m2[1], A[j + 1][0], A[j + 1][1]] });
    } });
    // bands of rock breaking through the snow
    const nb = D.i(3, 5);
    for (let k = 0; k < nb; k++) {
      const sg = D.chance(0.5) ? 1 : -1, slope = sg > 0 ? s.r : s.l, yb = lerp(snowY(s.x) + Hh * 0.05, base + s.h * 0.93, D.f()); if (yb > base + s.h * 0.95 || yb < base + Hh * 0.2) continue;
      const hw = (base + s.h - yb) / slope, xc = s.x + sg * hw * D.r(0.2, 0.72), L = Math.max(Hh * 0.04, hw * D.r(0.3, 0.62)), t = Hh * D.r(0.007, 0.017), tilt = -sg * slope * 0.45, p = [], q = [];
      for (let m = 0; m <= 6; m++) { const u = m / 6 - 0.5, xx = xc + u * L, yy = yb + u * L * tilt + t * D.r(-0.5, 0.5), e = m === 0 || m === 6 ? 0.1 : 1; p.push(xx, yy + t * e * D.r(0.2, 0.6)); q.unshift(xx + D.r(-0.03, 0.03) * L, yy - t * e * D.r(0.5, 1.6)); }
      bands.push({ a: xc - L, b: xc + L, p: p.concat(q), t });   // upper edge left to right, then the lower edge back again
    }
    // lines of bedding on the bare rock, following the slope of the face
    for (let k = 0; k < 16; k++) {
      const sg = D.chance(0.5) ? 1 : -1, slope = sg > 0 ? s.r : s.l, yy = lerp(base + Hh * 0.22, Math.min(base + s.h * 0.9, snowY(s.x) + Hh * 0.04), D.f()), hw = (base + s.h - yy) / slope;
      const xa = s.x + sg * hw * D.r(0.05, 0.85), L = Hh * D.r(0.03, 0.09);
      strata.push([xa, yy, xa + sg * L, yy - L * slope * D.r(0.35, 0.7)]);
    }
    // where the summit really is on the wandering skyline
    let bi = clamp(Math.round((s.x - x0) / step), 0, pts.length - 1);
    for (let k = Math.max(0, bi - 4); k <= Math.min(pts.length - 1, bi + 4); k++) if (pts[k][1] > pts[bi][1]) bi = k;
    tops.push({ x: pts[bi][0], y: pts[bi][1], h: s.h, s, i });
  });
  strata.sort((a, b) => a[0] - b[0]);

  // a glacier hanging in the bowl on the sunny side of the highest summit in view, and a snow plume on the two highest
  const mainTops = tops.filter((t) => Math.abs(t.x) < z * 0.21).sort((a, b) => b.h - a.h);
  const plumes = mainTops.slice(0, 2);
  let ice = null;
  if (mainTops.length && o.glacier !== false) {
    const s = mainTops[0].s, slope = sunD > 0 ? s.r : s.l, ys = base + s.h * 0.86, ye = base + Math.max(Hh * 0.36, Hh * (sl - 0.17)), L = [], Rr = [], cr = [];
    const cx = (y) => s.x + sunD * 0.46 * ((base + s.h - y) / slope) + Hh * 0.012 * Math.sin((y - base) / (Hh * 0.05));
    for (let m = 0; m <= 9; m++) {
      const u = m / 9, y = lerp(ys, ye, u), hw = 0.3 * ((base + s.h - y) / slope) * (1 - 0.5 * u) * (m === 9 ? 0.35 : Math.min(1, 0.12 + u * 2.6)) * D.r(0.9, 1.1);
      L.push([cx(y) - hw, y]); Rr.push([cx(y) + hw, y]);
      if (m > 1 && m < 9) { const e0 = D.r(-0.85, -0.2), e1 = e0 + D.r(0.5, 1.0), yy = y + Hh * D.r(-0.012, 0.012); cr.push([cx(yy) + hw * e0, yy + Hh * 0.003, cx(yy) + hw * (e0 + e1) / 2, yy - Hh * D.r(0.004, 0.011), cx(yy) + hw * Math.min(0.85, e1), yy + Hh * D.r(-0.002, 0.005)]); }
    }
    const tip = [cx(ye - Hh * 0.02), ye - Hh * 0.02], edge = sunD > 0 ? L : Rr, inner = edge.map((e, m) => [lerp(e[0], cx(e[1]), 0.34), e[1]]);
    const brook = [tip[0], tip[1]]; for (let m = 1; m <= 6; m++) brook.push(tip[0] + (m % 2 ? 1 : -1) * Hh * 0.008 + sunD * m * Hh * 0.006, tip[1] - m * Hh * 0.028);
    ice = { a: Math.min(L[0][0], L[9][0]) - Hh * 0.1, b: Math.max(Rr[0][0], Rr[9][0]) + Hh * 0.1, body: flat(L).concat(tip, flat(Rr.slice().reverse())), dim: flat(edge).concat(tip, flat(inner.slice().reverse())), cr, brook, w: Hh * 0.1 };
  }
  // cloud shadow and mist, drifting
  const span = x1 - x0, clouds = [], mist = [];
  for (let i = 0; i < 9; i++) clouds.push([x0 + span * (i + D.f()) / 9, base + Hh * D.r(0.45, 0.95), Hh * D.r(0.5, 0.9), Hh * D.r(0.07, 0.13)]);
  for (let i = 0; i < 22; i++) mist.push([x0 + span * (i + D.f()) / 22, base + Hh * D.r(o.mistLo === undefined ? 0.44 : o.mistLo, o.mistHi === undefined ? 0.58 : o.mistHi), Hh * D.r(0.1, 0.3), Hh * D.r(0.007, 0.016), D.r(0.6, 1.3)]);
  const hzTop = o.hazeTop === undefined ? 0.62 : o.hazeTop;

  // far peaks would vanish into the haze at their true distance, so the haze is capped (unless it is a whiteout)
  const hz = S.fogK > 1.5 || o.haze === undefined ? P.haze : Math.min(P.haze, o.haze), tn = (hex) => mix(mix(hex, S.pal.amb, S.pal.ambT), S.pal.fog, hz);
  const rockHex = o.col || '#56637a', rock = tn(rockHex), rockDk = tn(darken(rockHex, 0.24)), rockLt = tn(lighten(rockHex, 0.2));
  const dawn = S.time === 'dawn', snow = dawn ? mix(tn(o.snowCol || '#f4f7fa'), mix('#ffc4a2', S.pal.fog, hz), 0.42) : tn(o.snowCol || '#f4f7fa');
  const shC = tn('#1b2a44'), shade = rgba(shC, 0.27), shade2 = rgba(shC, 0.1), shade3 = rgba(shC, 0.085), glint = rgba(tn('#ffffff'), 0.09), snowSh = mix(snow, tn('#4a6796'), 0.4);
  const iceC = tn('#b9dbee'), iceDk = tn('#8db7d6'), iceLn = tn('#5f8fb8'), fogC = S.pal.fog, mistC = mix(S.pal.fog, '#ffffff', 0.45), plain = hz > 0.93 || o.snow === false;
  const each = (ctx, list, env) => { let n = 0; ctx.beginPath(); for (let i = 0; i < list.length; i++) { const q = list[i]; if (q.b < env.x0 || q.a > env.x1) continue; alpPath(ctx, q.p); n++; } return n; };
  P.add({ x0, x1, layer: 0, draw(ctx, env) {
    const i0 = clamp(Math.floor((env.x0 - x0) / step) - 1, 0, pts.length - 2), i1 = clamp(Math.ceil((env.x1 - x0) / step) + 1, i0 + 1, pts.length - 1);
    // when the range is small on screen there is no point in walking every point of the skyline
    const sk = Math.max(1, Math.floor((env.px * 1.6) / step));
    ctx.beginPath(); ctx.moveTo(pts[i0][0], base - 80);
    ctx.lineTo(pts[i0][0], pts[i0][1]);
    for (let i = Math.ceil((i0 + 1) / sk) * sk; i < i1; i += sk) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[i1][0], pts[i1][1]); ctx.lineTo(pts[i1][0], base - 80); ctx.closePath();
    ctx.fillStyle = rock; ctx.fill();
    if (plain) return;
    const xa = env.x0 - 5, xb = env.x1 + 5, drift = alpDrift(env) * 2.2;
    ctx.save(); ctx.clip();
    // scree under the couloirs, and bedding lines in the rock
    ctx.fillStyle = rockLt; ctx.beginPath(); for (let i = 0; i < fans.length; i++) { const f = fans[i]; if (f[4] < xa || f[2] > xb) continue; alpPath(ctx, f); } ctx.fill();
    if (env.s * Hh * 0.05 > 7) {
      ctx.strokeStyle = rockDk; ctx.lineWidth = Math.max(Hh * 0.0035, env.px * 0.8); ctx.beginPath();
      for (let i = vlyFrom(strata, xa - Hh * 0.1); i < strata.length && strata[i][0] < xb + Hh * 0.1; i++) { const q = strata[i]; ctx.moveTo(q[0], q[1]); ctx.lineTo(q[2], q[3]); }
      ctx.stroke();
    }
    // snow
    const j0 = clamp(vlyFrom(sn, xa) - 2, 0, sn.length - 2), j1 = clamp(vlyFrom(sn, xb) + 2, j0 + 1, sn.length - 1);
    ctx.beginPath(); ctx.moveTo(sn[j0][0], top + 60);
    for (let j = j0; j <= j1; j++) ctx.lineTo(sn[j][0], sn[j][1]);
    ctx.lineTo(sn[j1][0], top + 60); ctx.closePath(); ctx.fillStyle = snow; ctx.fill();
    // the glacier: ice, its shaded edge, crevasses, and the melt stream below the snout
    if (ice && ice.b > xa && ice.a < xb) {
      ctx.fillStyle = iceC; ctx.beginPath(); alpPath(ctx, ice.body); ctx.fill();
      ctx.fillStyle = iceDk; ctx.beginPath(); alpPath(ctx, ice.dim); ctx.fill();
      if (env.s * ice.w > 9) {
        ctx.strokeStyle = iceLn; ctx.lineWidth = Math.max(Hh * 0.0028, env.px * 0.75); ctx.beginPath();
        for (let i = 0; i < ice.cr.length; i++) { const c = ice.cr[i]; ctx.moveTo(c[0], c[1]); ctx.quadraticCurveTo(c[2], c[3], c[4], c[5]); }
        ctx.stroke();
        ctx.strokeStyle = iceC; ctx.lineWidth = Math.max(Hh * 0.004, env.px); ctx.beginPath(); ctx.moveTo(ice.brook[0], ice.brook[1]); for (let i = 2; i < ice.brook.length; i += 2) ctx.lineTo(ice.brook[i], ice.brook[i + 1]); ctx.stroke();
      }
    }
    // rock bands, each with its strip of shadow on the snow below
    ctx.fillStyle = snowSh; ctx.beginPath(); let nb = 0;
    for (let i = 0; i < bands.length; i++) { const q = bands[i]; if (q.b < xa || q.a > xb) continue; const p = q.p, dy = -q.t * 0.7; ctx.moveTo(p[0] - sunD * q.t * 0.5, p[1] + dy); for (let k = 2; k < p.length; k += 2) ctx.lineTo(p[k] - sunD * q.t * 0.5, p[k + 1] + dy); ctx.closePath(); nb++; }
    if (nb) { ctx.fill(); ctx.fillStyle = rockDk; each(ctx, bands, env); ctx.fill(); }
    // shadowed faces, then the ribs on both faces
    ctx.fillStyle = shade; if (each(ctx, shades, env)) ctx.fill();
    ctx.fillStyle = shade2; if (each(ctx, half, env)) ctx.fill();
    ctx.fillStyle = glint; if (each(ctx, glow, env)) ctx.fill();
    // cloud shadow sliding across
    ctx.fillStyle = shade3; ctx.beginPath(); let nc = 0;
    for (let i = 0; i < clouds.length; i++) { const c = clouds[i], x = alpWrap(c[0] + drift, x0, span); if (x + c[2] < xa || x - c[2] > xb) continue; ctx.moveTo(x + c[2], c[1]); ctx.ellipse(x, c[1], c[2], c[3], 0, 0, TAU); nc++; }
    if (nc) ctx.fill();
    // the foot of the range fades into the air of the valley
    if (env.y0 < base + Hh * hzTop) {
      const g = ctx.createLinearGradient(0, base + Hh * (hzTop - 0.3), 0, base + Hh * hzTop); g.addColorStop(0, rgba(fogC, 0.5)); g.addColorStop(1, rgba(fogC, 0));
      ctx.fillStyle = g; ctx.fillRect(xa, base - 80, xb - xa, Hh * hzTop + 80);
    }
    ctx.restore();
    // ribbons of mist lying against the lower slopes
    ctx.fillStyle = rgba(mistC, 0.36); ctx.beginPath(); let nm = 0;
    for (let i = 0; i < mist.length; i++) { const c = mist[i], x = alpWrap(c[0] + drift * c[4], x0, span); if (x + c[2] < xa || x - c[2] > xb || c[1] + c[3] < env.y0 || c[1] - c[3] > env.y1) continue; ctx.moveTo(x + c[2], c[1]); ctx.ellipse(x, c[1], c[2], c[3], 0, 0, TAU); nm++; }
    if (nm) ctx.fill();
    // snow blowing off the highest tops, downwind
    const a = alpGale(env);
    if (a > 0.06) {
      const dir = env.wind >= 0 ? 1 : -1, len = Hh * (0.07 + 0.3 * a);
      for (let i = 0; i < plumes.length; i++) {
        const pk = plumes[i]; if (pk.x + len < xa || pk.x - len > xb || pk.y + len < env.y0 || pk.y - len > env.y1) continue;
        for (let k = 0; k < 2; k++) {
          const ph = env.t * (0.5 + a) + i * 2.1 + k * 1.7, n = 7;
          ctx.fillStyle = rgba(snow, (0.2 + 0.3 * a) * (k ? 0.8 : 1)); ctx.beginPath(); ctx.moveTo(pk.x - dir * len * 0.02, pk.y - len * 0.01);
          for (let m = 1; m <= n; m++) { const u = m / n; ctx.lineTo(pk.x + dir * len * u * (k ? 0.8 : 1), pk.y + len * (0.05 * u + 0.11 * u * (1.2 - u) + 0.025 * Math.sin(ph - u * 6) * u)); }
          for (let m = n - 1; m >= 1; m--) { const u = m / n; ctx.lineTo(pk.x + dir * len * u * (k ? 0.8 : 1), pk.y + len * (0.05 * u - 0.07 * u * (1.2 - u) + 0.02 * Math.sin(ph * 1.3 - u * 5) * u)); }
          ctx.closePath(); ctx.fill();
        }
      }
    }
  } });
  return P;
};

// ---- a hill covered in pines --------------------------------------------------
// top/amp set the skyline (it wanders between top - amp and top). Rows of pines
// march down the face; `mist: [yLow, yHigh, alpha]` fades the foot of the hill
// into valley haze so each rank of hills reads as its own layer.
// Dressing (none of it changes where the ground is):
//   more     extra rows of trees further down the face
//   sway     tree tops lean and nod with the wind (for the nearer hills)
//   accent   share of paler trees (larch) among the spruce
//   crags    [[x, width, height, waterfall], ...] rock outcrops standing out of the forest
//   glades   [[x0, x1, rows, hut, cattle], ...] high meadows cleared out of the top rows
//   meadow   true for an open slope: grass, flowers and wind ripples instead of forest
K.forestHill = function (S, z, o) {
  o = o || {};
  const P = S.plane(z, o.name || 'hill');
  const sd = o.seed || 3, top = o.top === undefined ? 40 : o.top, amp = o.amp === undefined ? 20 : o.amp, rough = o.rough || 200;
  const x0 = o.x0 === undefined ? -z * 0.7 - 260 : o.x0, x1 = o.x1 === undefined ? z * 0.7 + 260 : o.x1, step = o.step || Math.max(2.5, z * 0.01);
  const prof = (x) => top - amp * (0.5 - 0.5 * vnoise(x / rough, sd)) + amp * 0.12 * vnoise(x / (rough * 0.23), sd + 5) - (o.dip ? o.dip.d * Math.exp(-Math.pow((x - o.dip.x) / o.dip.w, 2)) : 0);
  const pts = []; for (let x = x0; x <= x1 + step; x += step) pts.push([x, prof(x)]);
  P.heightAt = (x) => { const i = clamp((x - x0) / step, 0, pts.length - 1.001), a = Math.floor(i); return lerp(pts[a][1], pts[a + 1][1], i - a); };
  const snowy = S.time === 'snow', sunD = S.sky.sun[0] >= 0 ? 1 : -1;
  const bodyHex = o.col || '#2c4b3b', body = S.tone(bodyHex, P), cap = S.tone('#f1f5f8', P);
  const th = o.th || 12, rows = o.rows === undefined ? 3 : o.rows, tw = o.tw || 0.2, dens = o.density === undefined ? 0.92 : o.density;
  const tx0 = o.tx0 === undefined ? x0 : o.tx0, tx1 = o.tx1 === undefined ? x1 : o.tx1, drop = o.rowDrop || 0.52;
  const crags = o.crags || [], glades = o.glades || [], accent = snowy ? 0 : (o.accent === undefined ? 0.07 : o.accent);
  const R = makeRng(sd * 31 + 7), D = makeRng(sd * 53 + 19), TR = [], cols = [], lits = [];
  const bare = (x, r) => { for (let i = 0; i < crags.length; i++) if (r < 2 && Math.abs(x - crags[i][0]) < crags[i][1] * (r ? 0.26 : 0.42)) return true; for (let i = 0; i < glades.length; i++) if (r < glades[i][2] && x > glades[i][0] && x < glades[i][1]) return true; return false; };
  for (let r = 0; r < rows + (o.more || 0); r++) {
    const G = r < rows ? R : D, arr = []; let x = tx0 + G.r(0, th);
    while (x < tx1) {
      if (G.chance(dens) && !(o.clear && o.clear(x, r))) {
        const h = th * G.r(0.72, 1.28), y = P.heightAt(x) - r * th * drop - G.r(0, th * 0.16) - (r === 0 ? h * 0.1 : 0);
        if (!bare(x, r)) arr.push([x, y, o.maxH ? Math.min(h, o.maxH) : h, D.r(0, TAU), D.chance(accent) ? 1 : 0]);
      }
      x += th * (o.gap || 0.4) * G.r(0.6, 1.5);
    }
    TR.push(arr);
    const hex = r % 2 ? (o.treeCol2 || '#2f5a45') : (o.treeCol || '#24463a');
    cols.push(S.tone(hex, P)); lits.push(S.tone(mix(lighten(hex, 0.13), '#9fb86a', 0.14), P));
  }
  const accHex = o.accentCol || mix(o.treeCol || '#24463a', '#86a857', 0.34), accC = S.tone(accHex, P), accL = S.tone(lighten(accHex, 0.14), P), trunkC = S.tone(mix(darken(o.treeCol || '#24463a', 0.45), '#3b2d22', 0.45), P);
  const mist = o.mist, mistCol = S.pal.fog, mistDeep = z * 0.11, wisps = [], hazy = P.haze > 0.5;
  if (mist) for (let i = 0; i < 12; i++) wisps.push([x0 + (x1 - x0) * (i + D.f()) / 12, lerp(mist[0], mist[1], D.r(0.15, 0.8)), z * D.r(0.05, 0.11), (mist[1] - mist[0]) * D.r(0.1, 0.2), D.r(0.6, 1.4)]);

  // rock outcrops: a jagged face with a sunny and a shaded side, and maybe a waterfall
  const rockC = S.tone(o.rockCol || '#8f9598', P), rockD = S.tone(darken(o.rockCol || '#8f9598', 0.28), P), rockL = S.tone(lighten(o.rockCol || '#8f9598', 0.2), P), water = S.tone('#f2f8fb', P, true);
  const CR = crags.map((c) => {
    const cx = c[0], w = c[1], h = c[2], yb = P.heightAt(cx) - h * 0.45, j = () => D.r(0.9, 1.1), px = (u) => cx + (u - 0.5) * w;
    const prf = [[0, 0], [0.07, 0.42 * j()], [0.16, 0.5 * j()], [0.24, 0.84 * j()], [0.36, 0.9 * j()], [0.44, 1], [0.56, 0.95 * j()], [0.63, 0.74 * j()], [0.76, 0.68 * j()], [0.86, 0.4 * j()], [1, 0]];
    const out = [], dk = []; prf.forEach((q) => out.push(px(q[0]), yb + h * q[1]));
    // the side away from the sun: from its foot up to the top, then back down a crooked line through the middle
    (sunD > 0 ? prf.slice(0, 6) : prf.slice(5).reverse()).forEach((q) => dk.push(px(q[0]), yb + h * q[1]));
    dk.push(px(0.41), yb + h * 0.62, px(0.49), yb + h * 0.3, px(0.44), yb);
    const lines = []; for (let k = 0; k < 7; k++) { const u = D.r(0.12, 0.8), yy = yb + h * D.r(0.15, 0.7); lines.push(px(u), yy, px(u + D.r(0.06, 0.16)), yy + h * D.r(-0.05, 0.05)); }
    return { cx, w, h, yb, out, dk, lines, fall: c[3] ? { x: px(sunD > 0 ? 0.6 : 0.3), y1: yb + h * 0.7, y0: yb + h * 0.02, w: Math.max(0.9, w * 0.045) } : null };
  });
  // glades: a bald shoulder of meadow, perhaps with a hay hut and a few cattle
  const gladeC = S.tone(o.gladeCol || (snowy ? '#e6ecf1' : '#7fa35c'), P), gladeD = S.tone(snowy ? '#cfd8e0' : '#648a4c', P), hutC = S.tone('#5b4130', P), hutD = S.tone('#3a2a20', P), hutR = S.tone(snowy ? '#eef2f6' : '#2e2622', P), cowA = S.tone('#6e4428', P), cowB = S.tone('#ece2cc', P);
  const GL = glades.map((g) => {
    const xa = g[0], xb = g[1], dep = g[2] * th * drop + th * 0.15, edge = [], n = Math.max(4, Math.round((xb - xa) / (th * 0.5)));
    for (let k = 0; k <= n; k++) { const x = lerp(xa, xb, k / n); edge.push(x, P.heightAt(x) + 0.05); }
    for (let k = n; k >= 0; k--) { const u = k / n, x = lerp(xa, xb, u); edge.push(x + D.r(-0.2, 0.2) * th, P.heightAt(x) - dep * Math.sin(Math.PI * clamp(u, 0.04, 0.96)) * D.r(0.8, 1.1) - th * 0.05); }
    const hx = lerp(xa, xb, g[5] === undefined ? 0.62 : g[5]), cows = [];
    for (let k = 0; k < (g[4] || 0); k++) { const cxx = lerp(xa, xb, 0.12 + 0.38 * (k + D.f() * 0.6) / g[4]); cows.push([cxx, P.heightAt(cxx) - D.r(0.5, dep * 0.3), D.chance(0.5) ? 1 : -1, D.chance(0.4)]); }
    return { xa, xb, edge, hut: g[3] ? [hx, P.heightAt(hx) - dep * 0.12] : null, cows, dep };
  });
  // open slopes get grass instead of forest floor
  const turf = o.meadow ? alpTurf(S, P, { seed: sd * 53 + 23, x0: o.mx0 === undefined ? -190 : o.mx0, x1: o.mx1 === undefined ? 190 : o.mx1, yAt: P.heightAt, depth: o.meadowDepth || 16, col: bodyHex }) : null;

  P.add({ x0, x1, layer: o.layer || 0, draw(ctx, env) {
    const i0 = clamp(Math.floor((env.x0 - x0) / step) - 1, 0, pts.length - 2), i1 = clamp(Math.ceil((env.x1 - x0) / step) + 1, i0 + 1, pts.length - 1);
    ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(pts[i0][0], top - amp - 600);
    for (let i = i0; i <= i1; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[i1][0], top - amp - 600); ctx.closePath(); ctx.fill();
    const a = alpGale(env), dir = env.wind >= 0 ? 1 : -1;
    if (turf) turf(ctx, env);
    // ---- glades and crags, behind the trees that fringe them ----
    for (let i = 0; i < GL.length; i++) {
      const g = GL[i]; if (g.xb < env.x0 - th || g.xa > env.x1 + th) continue;
      ctx.fillStyle = gladeC; ctx.beginPath(); alpPath(ctx, g.edge); ctx.fill();
      if (env.s > 1.6) {
        if (g.hut) {
          const hx = g.hut[0], hy = g.hut[1];
          ctx.fillStyle = gladeD; ctx.beginPath(); ctx.ellipse(hx - sunD * 1.2, hy, 5.4, 0.7, 0, 0, TAU); ctx.fill();
          R4(ctx, hx - 3.4, hy, 6.8, 0.6, rockC); R4(ctx, hx - 3.3, hy + 0.6, 6.6, 2.5, hutC);
          if (env.s > 5) { ctx.fillStyle = hutD; for (let k = 1; k < 6; k++) ctx.fillRect(hx - 3.3, hy + 0.6 + k * 0.42, 6.6, Math.max(0.05, env.px * 0.6)); R4(ctx, hx - 0.7, hy + 0.6, 1.4, 1.9, hutD); }
          poly(ctx, [hx - 4.1, hy + 3.0, hx + 4.1, hy + 3.0, hx + 0.2, hy + 5.0, hx - 0.2, hy + 5.0], hutR);
        }
        if (env.s > 2.4) for (let k = 0; k < g.cows.length; k++) {
          // cattle: long low bodies, head down in the grass, nothing a person could be taken for
          const c = g.cows[k], x = c[0], y = c[1], f = c[2], A = c[3] ? cowB : cowA, B = c[3] ? cowA : cowB;
          ctx.fillStyle = A; ctx.beginPath(); ctx.ellipse(x, y + 1.0, 1.25, 0.52, 0, 0, TAU); ctx.fill();
          R4(ctx, x - 1.0, y, 0.2, 0.7, A); R4(ctx, x - 0.6, y, 0.2, 0.7, A); R4(ctx, x + 0.5, y, 0.2, 0.7, A); R4(ctx, x + 0.85, y, 0.2, 0.7, A);
          poly(ctx, [x + f * 1.0, y + 1.3, x + f * 1.85, y + 0.55, x + f * 1.95, y + 0.2, x + f * 1.55, y + 0.25, x + f * 0.9, y + 0.8], A);
          ctx.fillStyle = B; ctx.beginPath(); ctx.ellipse(x - f * 0.2, y + 1.1, 0.5, 0.34, 0, 0, TAU); ctx.fill();
        }
      }
    }
    for (let i = 0; i < CR.length; i++) {
      const c = CR[i]; if (c.cx + c.w < env.x0 || c.cx - c.w > env.x1) continue;
      ctx.fillStyle = rockC; ctx.beginPath(); alpPath(ctx, c.out); ctx.fill();
      ctx.fillStyle = rockD; ctx.beginPath(); alpPath(ctx, c.dk); ctx.fill();
      if (env.s * c.h > 40) { ctx.strokeStyle = rockD; ctx.lineWidth = Math.max(c.h * 0.012, env.px * 0.8); ctx.beginPath(); for (let k = 0; k < c.lines.length; k += 4) { ctx.moveTo(c.lines[k], c.lines[k + 1]); ctx.lineTo(c.lines[k + 2], c.lines[k + 3]); } ctx.stroke(); }
      if (c.fall) {
        const f = c.fall, w = Math.max(f.w, env.px * 1.6);
        ctx.fillStyle = water; ctx.beginPath(); ctx.moveTo(f.x - w * 0.35, f.y1); ctx.lineTo(f.x + w * 0.35, f.y1); ctx.lineTo(f.x + w * 0.6, f.y0); ctx.lineTo(f.x - w * 0.6, f.y0); ctx.closePath(); ctx.fill();
        if (env.s * w > 3) {   // water slipping down, and spray at the foot
          ctx.fillStyle = rockL; ctx.beginPath();
          for (let k = 0; k < 5; k++) { const u = (env.t * 0.55 + k / 5) % 1, yy = lerp(f.y1, f.y0, u * u); ctx.rect(f.x + (((k * 7) % 5) / 5 - 0.5) * w * 0.7, yy, w * 0.13, (f.y1 - f.y0) * 0.09); }
          ctx.fill();
          ctx.fillStyle = rgba(water, 0.55); ctx.beginPath();
          for (let k = 0; k < 3; k++) { const r = w * (1.2 + 0.5 * Math.sin(env.t * 1.3 + k * 2)); ctx.moveTo(f.x + (k - 1) * w * 1.1 + r, f.y0); ctx.arc(f.x + (k - 1) * w * 1.1, f.y0, r, 0, TAU); }
          ctx.fill();
        }
      }
    }
    // ---- the trees, row by row from the skyline down ----
    // detail by size on screen; deep in the haze only the shapes are worth drawing, and in flat snow light there is no sunny side
    const pxh = env.s * th, tier = Math.min(pxh < 6 ? 0 : pxh < 26 ? 1 : pxh < 160 ? 2 : 3, hazy ? 1 : 3), nT = tier === 3 ? 6 : tier === 2 ? 4 : 3, fb = tier >= 2 ? 0.07 : 0, sunny = tier >= 2 && !snowy;
    const swing = o.sway && tier >= 1, lean = dir * a * 0.05, osc = 0.006 + 0.024 * a, wt = env.t * (1.1 + a * 2.4), xe = env.x1 + th;
    for (let r = 0; r < TR.length; r++) {
      const arr = TR[r], ia = vlyFrom(arr, env.x0 - th); if (ia >= arr.length || arr[ia][0] >= xe) continue;
      if (tier >= 2 && (o.meadow || r === TR.length - 1)) { ctx.fillStyle = trunkC; ctx.beginPath(); for (let i = ia; i < arr.length && arr[i][0] < xe; i++) { const t = arr[i]; ctx.rect(t[0] - t[2] * 0.016, t[1] - t[2] * 0.02, t[2] * 0.032, t[2] * 0.2); } ctx.fill(); }
      for (let pass = 0; pass < (accent && tier >= 2 ? 2 : 1); pass++) {
        let n = 0; ctx.fillStyle = pass ? accC : cols[r]; ctx.beginPath();
        for (let i = ia; i < arr.length && arr[i][0] < xe; i++) {
          const t = arr[i]; if (tier >= 2 && accent && t[4] !== pass) continue; n++;
          if (!tier) { ctx.moveTo(t[0], t[1] + t[2]); ctx.lineTo(t[0] - t[2] * tw, t[1]); ctx.lineTo(t[0] + t[2] * tw, t[1]); ctx.closePath(); }
          else alpSpruce(ctx, t[0], t[1], t[2], t[2] * tw, nT, swing ? t[2] * (lean + osc * Math.sin(wt + t[3])) : 0, fb);
        }
        if (n) ctx.fill();
        if (!sunny || !n) continue;
        ctx.fillStyle = pass ? accL : lits[r]; ctx.beginPath();
        for (let i = ia; i < arr.length && arr[i][0] < xe; i++) { const t = arr[i]; if (accent && t[4] !== pass) continue; alpSpruceLit(ctx, t[0], t[1], t[2], t[2] * tw, nT, swing ? t[2] * (lean + osc * Math.sin(wt + t[3])) : 0, fb, sunD); }
        ctx.fill();
      }
      if (snowy && tier) {
        ctx.fillStyle = cap; ctx.beginPath();
        for (let i = ia; i < arr.length && arr[i][0] < xe; i++) { const t = arr[i]; alpSpruceSnow(ctx, t[0], t[1], t[2], t[2] * tw, nT, swing ? t[2] * (lean + osc * Math.sin(wt + t[3])) : 0, fb); }
        ctx.fill();
      }
    }
    if (mist && env.y1 > mist[0] - mistDeep && env.y0 < mist[1]) {
      // a flat wash below the band (cheap), and the fade itself only across the band
      const xa = env.x0 - 5, w = env.x1 - env.x0 + 10;
      ctx.fillStyle = rgba(mistCol, mist[2]); ctx.fillRect(xa, mist[0] - mistDeep, w, mistDeep);
      const g = ctx.createLinearGradient(0, mist[0], 0, mist[1]);
      g.addColorStop(0, rgba(mistCol, mist[2])); g.addColorStop(1, rgba(mistCol, 0));
      ctx.fillStyle = g; ctx.fillRect(xa, mist[0], w, mist[1] - mist[0]);
      // loose wisps drifting along the top of the mist
      const dr = alpDrift(env) * 1.6, sp = x1 - x0; let n = 0;
      ctx.fillStyle = rgba(mistCol, mist[2] * 0.55); ctx.beginPath();
      for (let i = 0; i < wisps.length; i++) { const c = wisps[i], x = alpWrap(c[0] + dr * c[4], x0, sp); if (x + c[2] < env.x0 || x - c[2] > env.x1) continue; ctx.moveTo(x + c[2], c[1]); ctx.ellipse(x, c[1], c[2], c[3], 0, 0, TAU); n++; }
      if (n) ctx.fill();
    }
  } });
  if (o.ground !== false) { P.groundY = top - amp; P.groundMat = o.mat || S.groundMat; P.groundFn = P.heightAt; }
  return P;
};

// ---- wind tells ----------------------------------------------------------------
// All three read the same way: they point where the wind is going, and the harder it
// blows the flatter they fly. Dead calm hangs straight down; 7 m/s and over flies level.

// A big flag on a tall pole. The cloth is a chain of narrow strips, so it keeps its
// length whether it hangs or flies, and the folds running through it are shaded: strips
// turned to the light are a tone lighter, strips turned away a tone darker.
K.bigFlag = function (S, P, x, y, h, col, o) {
  o = o || {}; const len = o.len || 5.0, wid = o.wid || 2.6, hex = col || '#b3312b', hex2 = o.col2 || '#f1ede2', N = 12;
  const pole = S.tone('#d5d9dd', P), poleSh = S.tone('#a3a9b0', P), gold = S.tone('#d8b24c', P), rope = S.tone('#5f646b', P), foot = S.tone('#8d8a80', P), footD = S.tone('#6f6c64', P);
  const cl = [S.tone(lighten(hex, 0.16), P), S.tone(hex, P), S.tone(darken(hex, 0.24), P)], bl = [S.tone(lighten(hex2, 0.4), P), S.tone(hex2, P), S.tone(darken(hex2, 0.2), P)];
  const tx = new Float32Array(N + 1), ty = new Float32Array(N + 1), by = new Float32Array(N + 1), tone = new Int8Array(N);
  const sunD = S.sky.sun[0] >= 0 ? 1 : -1;
  P.add({ x0: x - len - 1, x1: x + len + 1, layer: o.layer === undefined ? 1 : o.layer, draw(ctx, env) {
    const w = env.wind, a = alpGale(env), dir = w >= 0 ? 1 : -1, topY = y + h - 0.15, big = env.s > 9;
    // the pole: a stone foot, a slim mast with a shaded side, a gilt ball on top
    R4(ctx, x - 0.45, y, 0.9, 0.35, foot); R4(ctx, x - 0.3, y + 0.35, 0.6, 0.2, footD);
    line(ctx, x, y + 0.5, x, y + h, pole, 0.16, env);
    if (env.s > 14) { R4(ctx, sunD > 0 ? x - 0.08 : x + 0.03, y + 0.5, 0.05, h - 0.5, poleSh); R4(ctx, x - 0.11, y + 1.3, 0.22, 0.09, poleSh); R4(ctx, x - 0.1, topY - wid - 0.2, 0.2, 0.07, poleSh); }
    circ(ctx, x, y + h + 0.14, Math.max(0.22, env.px * 1.1), gold);
    // how far below level the cloth flies, then the chain of strips with a ripple running out along it
    const droop = (1 - Math.pow(a, 0.6)) * 1.36, rip = 0.1 + 0.3 * a, om = env.t * (2.4 + 9 * a), seg = len / N;
    tx[0] = x; ty[0] = topY;
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N, wave = Math.sin(om - u * 7.2), th = -droop * (0.55 + 0.45 * u) + rip * wave * (0.25 + 0.75 * u);
      tx[i + 1] = tx[i] + dir * Math.cos(th) * seg; ty[i + 1] = ty[i] + Math.sin(th) * seg;
      tone[i] = wave * dir * sunD > 0.4 ? 0 : wave * dir * sunD < -0.4 ? 2 : 1;
    }
    // a limp flag bunches up toward the free end
    for (let i = 0; i <= N; i++) by[i] = ty[i] - wid * (1 - 0.3 * (1 - a) * (i / N));
    const strip = (v0, v1, cols) => {
      ctx.fillStyle = cols[1]; ctx.beginPath(); ctx.moveTo(tx[0], lerp(ty[0], by[0], v0));
      for (let i = 1; i <= N; i++) ctx.lineTo(tx[i], lerp(ty[i], by[i], v0));
      for (let i = N; i >= 0; i--) ctx.lineTo(tx[i], lerp(ty[i], by[i], v1));
      ctx.closePath(); ctx.fill();
      if (env.s * seg < 1.2) return;
      for (let k = 0; k < 3; k += 2) {
        let n = 0; ctx.fillStyle = cols[k]; ctx.beginPath();
        for (let i = 0; i < N; i++) { if (tone[i] !== k) continue; n++; ctx.moveTo(tx[i], lerp(ty[i], by[i], v0)); ctx.lineTo(tx[i + 1], lerp(ty[i + 1], by[i + 1], v0)); ctx.lineTo(tx[i + 1], lerp(ty[i + 1], by[i + 1], v1)); ctx.lineTo(tx[i], lerp(ty[i], by[i], v1)); ctx.closePath(); }
        if (n) ctx.fill();
      }
    };
    strip(0, 1, cl); strip(0.36, 0.64, bl);
    if (big) {   // the hoist rope, bowed a little by the wind, down to its cleat
      ctx.strokeStyle = rope; ctx.lineWidth = Math.max(0.025, env.px * 0.6); ctx.beginPath(); ctx.moveTo(x + 0.1, topY + 0.1); ctx.quadraticCurveTo(x + 0.12 + dir * (0.1 + 0.35 * a), y + h * 0.5, x + 0.1, y + 1.34); ctx.stroke();
    }
  } });
  return { x, y, h };
};

// A windsock on a mast. It fills from the mouth: each stripe that stands out straight
// is worth about 1.4 m/s, and whatever the wind cannot fill hangs limp off the end.
K.alpWindsock = function (S, P, x, y, h, o) {
  o = o || {}; const len = o.len || 4.0, r0 = o.r || 0.56, N = 5;
  const pole = S.tone('#cfd4d9', P), poleSh = S.tone('#9ea5ac', P), foot = S.tone('#8d8a80', P), steel = S.tone('#3b4048', P);
  const c1 = S.tone('#f07a22', P), c1d = S.tone('#c25a12', P), c2 = S.tone('#f6f2ea', P), c2d = S.tone('#cfc9bd', P), dk = S.tone('#8a3f0c', P);
  const qx = new Float32Array(N + 1), qy = new Float32Array(N + 1), nx = new Float32Array(N + 1), ny = new Float32Array(N + 1), rr = new Float32Array(N + 1);
  P.add({ x0: x - len - 1, x1: x + len + 1, layer: o.layer === undefined ? 1 : o.layer, draw(ctx, env) {
    const w = env.wind, aw = Math.abs(w), a = alpGale(env), dir = w >= 0 ? 1 : -1, hy = y + h - 0.45;
    R4(ctx, x - 0.4, y, 0.8, 0.3, foot);
    line(ctx, x, y + 0.3, x, y + h, pole, 0.13, env);
    if (env.s > 9) { R4(ctx, x - 0.065, y + 0.3, 0.04, h - 0.3, poleSh); line(ctx, x, hy, x + dir * 0.34, hy, steel, 0.06, env); circ(ctx, x, y + h + 0.05, 0.11, steel); }
    qx[0] = x + dir * 0.34; qy[0] = hy;
    for (let i = 0; i < N; i++) {
      const f = smooth(aw / 1.4 - i * 0.86), fl = Math.sin(env.t * (4 + 7 * a) - i * 1.15) * (0.05 + 0.1 * a) * (0.4 + 0.6 * f);
      const ang = -(1 - f) * 1.42 + fl;
      qx[i + 1] = qx[i] + dir * Math.cos(ang) * len / N; qy[i + 1] = qy[i] + Math.sin(ang) * len / N;
      rr[i + 1] = r0 * (1 - ((i + 1) / N) * 0.52) * (0.5 + 0.5 * f);
    }
    rr[0] = r0;
    for (let i = 0; i <= N; i++) { const dx = qx[Math.min(N, i + 1)] - qx[Math.max(0, i - 1)], dy = qy[Math.min(N, i + 1)] - qy[Math.max(0, i - 1)], l = Math.hypot(dx, dy) || 1; nx[i] = -dy / l * dir; ny[i] = dx / l * dir; }
    // each stripe: the full tube in its colour, then the underside a tone darker
    for (let k = 0; k < 2; k++) {
      ctx.fillStyle = k ? c2 : c1; ctx.beginPath();
      for (let i = k; i < N; i += 2) { ctx.moveTo(qx[i] + nx[i] * rr[i], qy[i] + ny[i] * rr[i]); ctx.lineTo(qx[i + 1] + nx[i + 1] * rr[i + 1], qy[i + 1] + ny[i + 1] * rr[i + 1]); ctx.lineTo(qx[i + 1] - nx[i + 1] * rr[i + 1], qy[i + 1] - ny[i + 1] * rr[i + 1]); ctx.lineTo(qx[i] - nx[i] * rr[i], qy[i] - ny[i] * rr[i]); ctx.closePath(); }
      ctx.fill();
      if (env.s * r0 < 2.2) continue;
      ctx.fillStyle = k ? c2d : c1d; ctx.beginPath();
      for (let i = k; i < N; i += 2) { ctx.moveTo(qx[i] - nx[i] * rr[i] * 0.25, qy[i] - ny[i] * rr[i] * 0.25); ctx.lineTo(qx[i + 1] - nx[i + 1] * rr[i + 1] * 0.25, qy[i + 1] - ny[i + 1] * rr[i + 1] * 0.25); ctx.lineTo(qx[i + 1] - nx[i + 1] * rr[i + 1], qy[i + 1] - ny[i + 1] * rr[i + 1]); ctx.lineTo(qx[i] - nx[i] * rr[i], qy[i] - ny[i] * rr[i]); ctx.closePath(); }
      ctx.fill();
    }
    if (env.s > 5) {   // the hoop at the mouth, seen nearly edge on, and the dark inside of the sock
      ctx.fillStyle = dk; ctx.beginPath(); ctx.ellipse(qx[0], qy[0], r0 * 0.2, r0, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = steel; ctx.lineWidth = Math.max(0.05, env.px * 0.8); ctx.beginPath(); ctx.ellipse(qx[0], qy[0], r0 * 0.2, r0, 0, 0, TAU); ctx.stroke();
    }
  } });
  return { x, y, h };
};

// Chimney smoke. In still air it climbs straight and tall; wind bends it over, lays it
// flatter and carries it further the harder it blows.
K.plume = function (S, P, x, y, o) {
  o = o || {}; const n = o.n || 15, rise = o.rise || 15, dawn = S.time === 'dawn';
  const col = S.pal.dark > 0.5 ? '120,130,150' : dawn ? '250,226,214' : '244,246,248', und = S.pal.dark > 0.5 ? '84,94,116' : dawn ? '212,184,180' : '203,211,220';
  P.add({ x0: x - 60, x1: x + 60, layer: o.layer || 0, draw(ctx, env) {
    const w = env.wind, aw = Math.abs(w), lift = rise / (1 + aw * 0.22), reach = w * 4.2, two = env.s > 4;
    for (let i = 0; i < n; i++) {
      const u = (env.t * 0.11 + i / n) % 1, r = Math.max(0.42 + u * (2.6 + aw * 0.12), env.px), al = (1 - u) * (1 - u) * 0.62;
      const px = x + reach * Math.pow(u, 1.4) + Math.sin(u * 7 + i * 1.7) * 0.45 * u, py = y + 0.4 + lift * Math.pow(u, 0.72);
      if (two) { ctx.fillStyle = 'rgba(' + und + ',' + (al * 0.8).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(px - r * 0.12, py - r * 0.22, r, 0, TAU); ctx.fill(); }
      ctx.fillStyle = 'rgba(' + col + ',' + al.toFixed(3) + ')'; ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
    }
  } });
};

// ---- the lodge -------------------------------------------------------------------
// A wide chalet seen gable-on: stone ground floor, timber upper floor, a row of
// attic windows under a low wide roof. Returns the same sort of handle as
// K.building: floorY(f), winX(c), win(f, c). Floor 2 is the attic (columns 2 to
// cols - 3 only). `spans` and `wins` work as they do for K.building.
// Dressing: coursed stone with corner blocks, log walls with their end grain showing at
// the corners, a boarded gable with a king-post truss and a pair of antlers, shutters,
// flower boxes, firewood stacked along the wall, a plank door with a lantern, a shingle
// roof with carved barge boards and stones to hold it down. Shade lies under the roof
// and under the deck (`o.deck: [x0, x1]`), and lit rooms glow onto the wall at dawn and in snow.
K.chalet = function (S, P, o) {
  const x = o.x, w = o.w || 32, fh = o.fh || 3.4, id = o.id || 'lodge', cols = o.cols || 8, snowy = S.time === 'snow';
  const eave = fh * 2, rise = o.rise || 6.2, ridge = eave + rise, cx = x + w / 2, over = 1.8, door = o.door === undefined ? 3 : o.door;
  const R = makeRng(o.seed || 41), D = makeRng((o.seed || 41) * 91 + 7);
  const tb = o.timber || '#8a5b36', sunD = S.sky.sun[0] >= 0 ? 1 : -1, T = (hex, self) => S.tone(hex, P, self);
  const stone = T('#9a968b'), stone2 = T('#7f7b72'), stone3 = T('#aaa69b'), timber = T(tb), timber2 = T(darken(tb, 0.22)), timber3 = T(lighten(tb, 0.12)), timber4 = T(darken(tb, 0.1));
  const beam = T(darken(tb, 0.42)), roofHex = o.roof || '#3d302a', roofC = T(snowy ? '#eef2f6' : roofHex), roofD = T(snowy ? '#cdd6de' : darken(roofHex, 0.3)), roofE = T('#2a211d'), trimC = T(lighten(tb, 0.16)), frame = T('#efe6cf');
  const glass = T(S.pal.glass), inRoom = T(S.pal.inRoom), shutHex = o.shutter || '#3f6b4f', shut = T(shutHex), shutD = T(darken(shutHex, 0.28)), bloom = T('#c8372d'), bloom2 = T('#e58fa6'), leaf = T('#4f7f45'), doorC = T('#3a2a20'), doorL = T('#52392a');
  const iron = T('#1f2227'), brass = T('#c9a23a'), snowC = T('#f4f7fa'), cutC = T('#d8b889'), cutD = T('#b08e62'), bark = T('#4f3826'), antler = T('#e6dcc2'), moss = T(snowy ? '#c5ced6' : '#77805f');
  const dim = 1 - P.haze * 0.7, shade = 'rgba(24,16,10,' + (0.17 * dim).toFixed(3) + ')', glowK = clamp(S.pal.dark * 3 + (snowy ? 0.4 : 0), 0, 0.7);
  const B = { id, x, w, fh, P, cols, wins: {}, roofY: eave, ridge, cx, door };
  B.floorY = (f) => f * fh; B.winX = (c) => x + ((c + 0.5) * w) / cols; B.win = (f, c) => B.wins[f + ',' + c]; B.roomId = (f, c) => id + ':' + f + ':' + c;
  const spans = o.spans || {}, over2 = o.wins || {};
  for (let f = 0; f < 3; f++) for (let c = 0; c < cols; c++) {
    if (f === 2 && (c < 2 || c > cols - 3)) continue;
    if (f === 0 && c === door) continue;
    const ov = over2[f + ',' + c] || {}; if (ov.none) continue;
    let room = B.roomId(f, c), lit;
    const sp = spans[f]; if (sp) for (let i = 0; i < sp.length; i++) if (c >= sp[i][0] && c <= sp[i][1]) { room = id + ':' + (sp[i][2] || ('s' + f + '_' + i)); lit = sp[i][3]; }
    if (ov.lit !== undefined) lit = ov.lit;
    if (lit === undefined) lit = S.rooms[room] ? S.rooms[room].lit : R.chance(S.pal.litChance);
    S.room(room, lit);
    const ww = ov.w || (f === 1 ? 2.0 : f === 0 ? 1.5 : 1.3), hh = ov.h || (f === 1 ? 2.25 : f === 0 ? 1.4 : 1.3), sy = ov.sill === undefined ? (f === 1 ? 0.25 : f === 0 ? 1.15 : 0.75) : ov.sill;
    B.wins[f + ',' + c] = P.open({ x: B.winX(c) - ww / 2, y: B.floorY(f) + sy, w: ww, h: hh, room, glass: !ov.open, blind: ov.blind || 0, curtain: ov.curtain, f, c, deco: R.i(0, 5), tint: R.pick(['#ffd98a', '#ffe7b3', '#f7c873', '#ffdca0']), door: f === 1 });
  }
  P.solid(x, 0, w, eave, 'wall', { bid: id });
  P.solid(cx - w * 0.36, eave, w * 0.72, rise * 0.38, 'wall'); P.solid(cx - w * 0.2, eave + rise * 0.38, w * 0.4, rise * 0.34, 'wall'); P.solid(cx - w * 0.07, eave + rise * 0.72, w * 0.14, rise * 0.2, 'wall');

  // ---- worked out once ----
  const WL = Object.keys(B.wins).map((k) => B.wins[k]);
  // stone courses: only the stones that differ from the wall colour are drawn, darker ones and paler ones
  const stones = [];
  for (let yy = 0.16, row = 0; yy < fh - 0.3; row++) {
    const ch = Math.min(D.r(0.36, 0.5), fh - 0.26 - yy);
    for (let xx = x - D.r(0, 0.5); xx < x + w;) { const sw = D.r(0.55, 1.35), t = D.f(), a = Math.max(x, xx) + 0.035, b = Math.min(x + w, xx + sw) - 0.035; if (t < 0.6 && b - a > 0.2) stones.push([a, yy + 0.035, b - a, ch - 0.07, t < 0.32 ? 0 : 1]); xx += sw; }
    yy += ch;
  }
  stones.sort((a, b) => a[0] - b[0]);
  // corner blocks, alternately long and short
  const quoins = []; for (let k = 0, yy = 0.16; yy < fh - 0.4; k++, yy += 0.5) { const l = k % 2 ? 0.95 : 0.6; quoins.push([x, yy, l, 0.44], [x + w - l, yy, l, 0.44]); }
  // grain: short streaks along the logs, and a few knots
  const grain = [], knots = [], nC = Math.floor((fh - 0.3) / 0.42);
  for (let i = 0; i < 300; i++) { const k = D.i(0, nC - 1); grain.push([x + D.r(0.4, w - 1.6), fh + 0.42 * k + D.r(0.1, 0.34), D.r(0.4, 1.3), D.chance(0.5) ? 0 : 1]); }
  grain.sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < 36; i++) knots.push([x + D.r(0.5, w - 0.5), fh + 0.42 * D.i(0, nC - 1) + 0.24, D.r(0.035, 0.06)]);
  // where one log butts against the next along each course
  const butts = []; for (let k = 0; k < nC; k++) for (let xx = x + D.r(1, 4); xx < x + w - 0.6; xx += D.r(3.2, 6.5)) butts.push([xx, fh + 0.42 * k + 0.45]);
  // firewood stacked under the windows at the end of the stone floor: rows of cut ends
  // (only at the left end: the right end is where August stops, and he should stand against plain stone)
  const stacks = [[x + 0.75, x + 7.6]].map((q) => {
    const logs = []; for (let k = 0; k < 4; k++) for (let xx = q[0] + 0.14 + (k % 2) * 0.12; xx < q[1] - 0.1; xx += 0.245) logs.push([xx + D.r(-0.012, 0.012), 0.14 + k * 0.205 + D.r(-0.01, 0.01), D.r(0.095, 0.118), D.chance(0.3) ? 1 : 0]);
    return { a: q[0], b: q[1], logs };
  });
  const SH = 0.98;   // height of the stacks
  // the roof: points along each slab, measured up from its underside
  const ex = x - over - 0.3, ey = eave - over * (rise / (w / 2)), rp = (side, u, d) => [side < 0 ? lerp(ex, cx, u) : lerp(x + w + over + 0.3, cx, u), lerp(ey, ridge, u) + d];
  const slabLen = Math.hypot(cx - ex, ridge - ey), rocks = [], patches = [];
  for (const side of [-1, 1]) { for (let i = 0; i < 6; i++) rocks.push([side, 0.1 + (i + D.r(0.2, 0.8)) / 6 * 0.8, D.r(0.2, 0.3)]); }
  patches.push([-sunD, 0.8, 0.97], [-sunD, 0.5, 0.6], [sunD, 0.88, 0.97]);
  const drift = []; for (let i = 0; i <= 22; i++) drift.push(0.3 + 0.1 * Math.sin(i * 1.9) + D.r(0, 0.07));

  // ---- behind whoever is indoors: the walls ----
  P.add({ x0: x - over - 1, x1: x + w + over + 1, layer: 0, draw(ctx, env) {
    const s = env.s, px = env.px, v0 = env.x0 - 1.5, v1 = env.x1 + 1.5;
    // stone ground floor
    R4(ctx, x, 0, w, fh, stone);
    if (s > 3) {
      for (let k = 0; k < (s > 10 ? 2 : 1); k++) {
        ctx.fillStyle = k ? stone3 : stone2; ctx.beginPath();
        for (let i = vlyFrom(stones, v0 - 1.4); i < stones.length && stones[i][0] < v1; i++) { const q = stones[i]; if (q[4] === k) ctx.rect(q[0], q[1], q[2], q[3]); }
        ctx.fill();
      }
      ctx.fillStyle = stone3; ctx.beginPath(); for (let i = 0; i < quoins.length; i++) { const q = quoins[i]; ctx.rect(q[0], q[1], q[2], q[3]); } ctx.fill();
    }
    R4(ctx, x, 0, w, 0.16, stone2);
    if (s > 6) R4(ctx, x, 0.16, w, Math.max(0.05, px * 0.7), moss);
    // firewood stacked against the wall
    for (let i = 0; i < stacks.length; i++) {
      const q = stacks[i]; if (q.b < v0 || q.a > v1 || s < 2.5) continue;
      R4(ctx, q.a, 0, q.b - q.a, SH, bark);
      if (s > 12) { for (let k = 0; k < 2; k++) { ctx.fillStyle = k ? cutD : cutC; ctx.beginPath(); for (let j = 0; j < q.logs.length; j++) { const l = q.logs[j]; if (l[3] !== k || l[0] < v0 || l[0] > v1) continue; ctx.moveTo(l[0] + l[2], l[1]); ctx.arc(l[0], l[1], l[2], 0, TAU); } ctx.fill(); } }
      else { ctx.fillStyle = cutD; for (let k = 0; k < 4; k++) ctx.fillRect(q.a + 0.06, 0.06 + k * 0.215, q.b - q.a - 0.12, Math.max(0.13, px)); }
      R4(ctx, q.a - 0.09, 0, 0.1, SH + 0.2, beam); R4(ctx, q.b - 0.01, 0, 0.1, SH + 0.2, beam);
      if (snowy) R4(ctx, q.a - 0.1, SH, q.b - q.a + 0.2, 0.14, snowC);
    }
    // log upper floor and boarded gable
    R4(ctx, x, fh, w, fh, timber);
    poly(ctx, [x - 0.2, eave, x + w + 0.2, eave, cx, ridge - 0.25], timber4);
    if (s > 2.2) { // the joints between the logs, and the light catching the top of each one
      ctx.fillStyle = timber2; for (let k = 1; k <= nC; k++) ctx.fillRect(x, fh + 0.42 * k, w, Math.max(0.05, px * 0.7));
      if (s > 10) { ctx.fillStyle = timber3; for (let k = 1; k <= nC; k++) ctx.fillRect(x, fh + 0.42 * k - 0.06, w, 0.045); }
    }
    if (s > 7) { // upright boards in the gable
      ctx.fillStyle = timber2; ctx.beginPath(); const bw = Math.max(0.035, px * 0.6);
      for (let xx = Math.max(x + 0.2, Math.ceil((v0 - x) / 0.36) * 0.36 + x); xx < Math.min(x + w, v1); xx += 0.36) { const top = eave + rise * (1 - Math.abs(xx - cx) / (w / 2)) - 0.4; if (top > eave + 0.2) ctx.rect(xx, eave + 0.16, bw, top - eave - 0.16); }
      ctx.fill();
    }
    if (s > 24) { // grain, knots and butt joints
      for (let k = 0; k < 2; k++) { ctx.fillStyle = k ? timber3 : timber2; ctx.beginPath(); for (let i = vlyFrom(grain, v0 - 1.4); i < grain.length && grain[i][0] < v1; i++) { const g = grain[i]; if (g[3] === k) ctx.rect(g[0], g[1], g[2], 0.022); } ctx.fill(); }
      ctx.fillStyle = beam; ctx.beginPath(); for (let i = 0; i < knots.length; i++) { const k = knots[i]; if (k[0] < v0 || k[0] > v1) continue; ctx.moveTo(k[0] + k[2] * 1.5, k[1]); ctx.ellipse(k[0], k[1], k[2] * 1.5, k[2], 0, 0, TAU); }
      for (let i = 0; i < butts.length; i++) { const b = butts[i]; if (b[0] > v0 && b[0] < v1) ctx.rect(b[0], b[1], 0.03, 0.36); }
      ctx.fill();
    }
    // sill beam, wall plate and corner posts; the log ends stand proud at the corners
    R4(ctx, x - 0.25, fh - 0.18, w + 0.5, 0.36, beam); R4(ctx, x - 0.25, eave - 0.16, w + 0.5, 0.32, beam);
    R4(ctx, x - 0.15, fh, 0.5, fh, beam); R4(ctx, x + w - 0.35, fh, 0.5, fh, beam);
    if (s > 6) {
      ctx.fillStyle = timber3; ctx.beginPath();
      for (let k = 0; k < nC; k++) { const jut = k % 2 ? 0.2 : 0; ctx.rect(x - 0.15 - jut, fh + 0.42 * k + 0.06, 0.5 + jut, 0.32); ctx.rect(x + w - 0.35, fh + 0.42 * k + 0.06, 0.5 + jut, 0.32); }
      ctx.fill();
      // carved brackets under the wall plate
      ctx.fillStyle = beam; ctx.beginPath(); for (let c = 0; c <= cols; c++) { const bx = x + (c * w) / cols; ctx.moveTo(bx - 0.14, eave - 0.16); ctx.lineTo(bx + 0.14, eave - 0.16); ctx.lineTo(bx + 0.1, eave - 0.62); ctx.lineTo(bx - 0.1, eave - 0.62); ctx.closePath(); } ctx.fill();
    }
    // king-post truss in the gable, and the lodge's trophy below it
    const ty = ridge - 2.25, hwT = (w / 2) * (1 - (ty - eave) / rise) - 0.3;
    R4(ctx, cx - hwT, ty - 0.12, hwT * 2, 0.24, beam); R4(ctx, cx - 0.13, ty, 0.26, ridge - 0.3 - ty, beam);
    if (s > 3) {
      ctx.strokeStyle = beam; ctx.lineWidth = Math.max(0.2, px); ctx.beginPath(); ctx.moveTo(cx - 2.7, ty); ctx.lineTo(cx, ridge - 0.95); ctx.lineTo(cx + 2.7, ty); ctx.stroke();
      const ay = ty - 1.62;
      poly(ctx, [cx - 0.3, ay + 0.52, cx + 0.3, ay + 0.52, cx + 0.22, ay + 0.05, cx, ay - 0.16, cx - 0.22, ay + 0.05], beam);
      ctx.strokeStyle = antler; ctx.lineWidth = Math.max(0.075, px * 0.9); ctx.lineCap = 'round'; ctx.beginPath();
      for (const d of [-1, 1]) {
        ctx.moveTo(cx + d * 0.08, ay + 0.3); ctx.quadraticCurveTo(cx + d * 1.05, ay + 0.42, cx + d * 1.18, ay + 1.36);
        ctx.moveTo(cx + d * 0.5, ay + 0.42); ctx.lineTo(cx + d * 0.42, ay + 0.95);
        ctx.moveTo(cx + d * 0.84, ay + 0.6); ctx.lineTo(cx + d * 0.7, ay + 1.18);
        ctx.moveTo(cx + d * 1.07, ay + 0.9); ctx.lineTo(cx + d * 1.42, ay + 1.2);
      }
      ctx.stroke(); ctx.lineCap = 'butt';
      circ(ctx, cx, ay + 0.26, Math.max(0.13, px), antler);
    }
    // shade: two bands under the slope of the roof, and a soft fall of shadow under the deck
    ctx.fillStyle = shade;
    for (const d of [1.05, 0.45]) { const k = (d * (w / 2 + 0.2)) / (rise - 0.25); ctx.beginPath(); ctx.moveTo(x - 0.2, eave); ctx.lineTo(cx, ridge - 0.25); ctx.lineTo(x + w + 0.2, eave); ctx.lineTo(x + w + 0.2 - k, eave); ctx.lineTo(cx, ridge - 0.25 - d); ctx.lineTo(x - 0.2 + k, eave); ctx.closePath(); ctx.fill(); }
    ctx.fillRect(x, eave - 0.16 - 0.55, w, 0.55);
    if (o.deck && s > 3) {
      const a = Math.max(x, o.deck[0], v0), b = Math.min(x + w, o.deck[1], v1);
      if (b > a) { const g = ctx.createLinearGradient(0, fh - 0.18, 0, fh - 2.1); g.addColorStop(0, 'rgba(24,16,10,' + (0.34 * dim).toFixed(3) + ')'); g.addColorStop(1, 'rgba(24,16,10,0)'); ctx.fillStyle = g; ctx.fillRect(a, fh - 2.1, b - a, 1.92); }
    }
    // window surrounds: a timber lintel and a dark sill in the stone, a heavier frame in the logs
    ctx.fillStyle = beam; ctx.beginPath();
    for (let i = 0; i < WL.length; i++) { const op = WL[i]; if (op.x + op.w < v0 || op.x > v1) continue; if (op.f === 0) { ctx.rect(op.x - 0.22, op.y + op.h, op.w + 0.44, 0.24); ctx.rect(op.x - 0.16, op.y - 0.13, op.w + 0.32, 0.13); } else ctx.rect(op.x - 0.13, op.y - 0.1, op.w + 0.26, op.h + 0.24); }
    ctx.fill();
    // lit rooms warm the wall around them: five faint rings of light stacked up, so it fades out gently
    if (glowK > 0 && s > 3 && !env.nv) {
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,205,130,' + (0.075 * glowK).toFixed(3) + ')';
      for (const e of [1.1, 0.84, 0.6, 0.38, 0.18]) {
        ctx.beginPath(); let n = 0;
        for (let i = 0; i < WL.length; i++) { const op = WL[i], rm = S.rooms[op.room]; if (!rm || !rm.lit || op.x + op.w < v0 - 2 || op.x > v1 + 2) continue; const gx = op.x + op.w / 2, gy = op.y + op.h / 2, rx = op.w / 2 + e, ry = op.h / 2 + e * 0.8; ctx.moveTo(gx + rx, gy); ctx.ellipse(gx, gy, rx, ry, 0, 0, TAU); n++; }
        if (n) ctx.fill(); else break;
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    for (let i = 0; i < WL.length; i++) { const op = WL[i]; if (op.x + op.w < env.x0 || op.x > env.x1) continue; drawWindowBack(ctx, env, S, P, op, glass, inRoom); }
    // the door: a stone step, double plank leaves on strap hinges
    const dx = B.winX(door);
    R4(ctx, dx - 1.7, 0, 3.4, 0.14, stone2); R4(ctx, dx - 1.25, 0, 2.5, 2.75, beam); R4(ctx, dx - 1.05, 0.14, 2.1, 2.41, doorC);
    if (s > 8) {
      ctx.fillStyle = doorL; for (let k = 0; k < 8; k++) ctx.fillRect(dx - 1.05 + k * 0.2625 + 0.03, 0.14, 0.2, 2.41);
      ctx.fillStyle = iron; for (const d of [-1, 1]) for (const hy of [0.62, 2.02]) ctx.fillRect(d < 0 ? dx - 1.05 : dx + 0.37, hy, 0.68, 0.08);
      circ(ctx, dx - 0.16, 1.22, Math.max(0.05, px * 0.6), brass); circ(ctx, dx + 0.16, 1.22, Math.max(0.05, px * 0.6), brass);
    }
    R4(ctx, dx - 0.035, 0.14, 0.07, 2.41, beam);
  } });

  // ---- in front of whoever is indoors: glass, shutters, flowers, the roof ----
  P.add({ x0: x - over - 1, x1: x + w + over + 1, layer: 1, draw(ctx, env) {
    const s = env.s, px = env.px, v0 = env.x0 - 1.5, v1 = env.x1 + 1.5;
    for (let i = 0; i < WL.length; i++) { const op = WL[i]; if (op.x + op.w < env.x0 || op.x > env.x1) continue; drawWindowFront(ctx, env, S, P, op, frame, false); }
    // shutters: board, frame, slats and a cut-out
    ctx.fillStyle = shut; ctx.beginPath();
    for (let i = 0; i < WL.length; i++) { const op = WL[i]; if (op.f === 0 || op.x + op.w < v0 || op.x > v1) continue; ctx.rect(op.x - 0.5, op.y, 0.42, op.h); ctx.rect(op.x + op.w + 0.08, op.y, 0.42, op.h); }
    ctx.fill();
    if (s > 9) {
      ctx.fillStyle = shutD; ctx.beginPath();
      for (let i = 0; i < WL.length; i++) {
        const op = WL[i]; if (op.f === 0 || op.x + op.w < v0 || op.x > v1) continue;
        for (const sx of [op.x - 0.5, op.x + op.w + 0.08]) {
          ctx.rect(sx, op.y, 0.035, op.h); ctx.rect(sx + 0.385, op.y, 0.035, op.h); ctx.rect(sx, op.y + op.h * 0.5 - 0.03, 0.42, 0.06);
          if (s > 18) { for (let yy = op.y + 0.12; yy < op.y + op.h * 0.5 - 0.08; yy += 0.13) ctx.rect(sx + 0.06, yy, 0.3, 0.03); const hy = op.y + op.h * 0.76; ctx.moveTo(sx + 0.21, hy + 0.11); ctx.lineTo(sx + 0.3, hy); ctx.lineTo(sx + 0.21, hy - 0.11); ctx.lineTo(sx + 0.12, hy); ctx.closePath(); }
        }
      }
      ctx.fill();
    }
    // flower boxes under the attic windows
    for (let i = 0; i < WL.length; i++) {
      const op = WL[i]; if (op.f !== 2 || op.x + op.w < v0 || op.x > v1) continue;
      R4(ctx, op.x - 0.14, op.y - 0.34, op.w + 0.28, 0.28, timber2);
      if (snowy) { R4(ctx, op.x - 0.16, op.y - 0.08, op.w + 0.32, 0.13, snowC); continue; }
      if (s > 7) { ctx.fillStyle = leaf; ctx.beginPath(); for (let k = 0; k < 6; k++) { const fx = op.x + (k / 5) * op.w, r = 0.17; ctx.moveTo(fx + r, op.y - 0.04); ctx.arc(fx, op.y - 0.04, r, 0, TAU); } ctx.fill(); }
      for (let c = 0; c < 2; c++) { ctx.fillStyle = c ? bloom2 : bloom; ctx.beginPath(); for (let k = c; k < 7; k += 2) { const fx = op.x + 0.06 + (k / 6) * (op.w - 0.12), fy = op.y + (k % 3) * 0.045, r = Math.max(0.11, px * 0.7); ctx.moveTo(fx + r, fy); ctx.arc(fx, fy, r, 0, TAU); } ctx.fill(); }
    }
    // a lantern by the door
    const dx = B.winX(door), lx = dx + 1.72, ly = 2.12;
    if (s > 4 && lx > v0 && lx < v1) {
      R4(ctx, lx - 0.03, ly + 0.14, 0.3, 0.05, iron); R4(ctx, lx - 0.12, ly - 0.2, 0.24, 0.36, iron);
      R4(ctx, lx - 0.085, ly - 0.15, 0.17, 0.26, glowK > 0 ? '#ffe2a0' : T('#c9c2a6'));
      if (glowK > 0 && !env.nv) { ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(lx, ly, 0.05, lx, ly, 2.3); g.addColorStop(0, 'rgba(255,200,120,' + (0.6 * glowK).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.fillRect(lx - 2.3, Math.max(0, ly - 2.3), 4.6, 4.6); ctx.globalCompositeOperation = 'source-over'; }
    }
    // the roof: two heavy slabs meeting at the ridge
    for (const side of [-1, 1]) {
      const a0 = rp(side, 0, 0), a1 = rp(side, 1, 0);
      poly(ctx, [a0[0], a0[1], a1[0], a1[1], a1[0], a1[1] + 0.85, a0[0], a0[1] + 0.85], roofC);
      if (s > 6) { // courses of shingles, and the breaks between them
        ctx.fillStyle = roofD; ctx.beginPath();
        for (const d of [0.44, 0.63]) { ctx.moveTo(a0[0], a0[1] + d); ctx.lineTo(a1[0], a1[1] + d); ctx.lineTo(a1[0], a1[1] + d + Math.max(0.035, px * 0.6)); ctx.lineTo(a0[0], a0[1] + d + Math.max(0.035, px * 0.6)); ctx.closePath(); }
        if (s > 18) for (let k = 0; k < 44; k++) { const u = (k + 0.5) / 44, q = rp(side, u, 0.27 + (k % 3) * 0.19); if (q[0] > v0 && q[0] < v1) ctx.rect(q[0], q[1], 0.03, 0.17); }
        ctx.fill();
      }
      // barge board with a pale edge and a scalloped hem
      poly(ctx, [a0[0], a0[1], a1[0], a1[1], a1[0], a1[1] + 0.26, a0[0], a0[1] + 0.26], roofE);
      if (s > 4) poly(ctx, [a0[0], a0[1] + 0.2, a1[0], a1[1] + 0.2, a1[0], a1[1] + 0.27, a0[0], a0[1] + 0.27], trimC);
      if (s > 10) { ctx.fillStyle = roofE; ctx.beginPath(); const n = Math.round(slabLen / 0.46); for (let k = 0; k < n; k++) { const q = rp(side, (k + 0.5) / n, 0.02); if (q[0] < v0 || q[0] > v1) continue; ctx.moveTo(q[0] + 0.17, q[1]); ctx.arc(q[0], q[1], 0.17, 0, TAU); } ctx.fill(); }
    }
    if (snowy) { // a thick quilt of snow, and icicles at the eaves
      for (const side of [-1, 1]) {
        ctx.fillStyle = snowC; ctx.beginPath(); let q = rp(side, 0, 0.8); ctx.moveTo(q[0], q[1]);
        for (let k = 0; k <= 22; k++) { q = rp(side, k / 22, 0.85 + drift[k]); ctx.lineTo(q[0], q[1]); }
        q = rp(side, 1, 0.8); ctx.lineTo(q[0], q[1]); ctx.closePath(); ctx.fill();
        if (s > 8) { ctx.beginPath(); for (let k = 0; k < 9; k++) { const q2 = rp(side, 0.01 + k * 0.012, 0); ctx.moveTo(q2[0] - 0.05, q2[1]); ctx.lineTo(q2[0] + 0.05, q2[1]); ctx.lineTo(q2[0], q2[1] - 0.25 - (k % 3) * 0.14); ctx.closePath(); } ctx.fill(); }
      }
    } else if (s > 4) { // stones that hold the shingles down, and the last of the old snow near the ridge
      ctx.fillStyle = stone3; ctx.beginPath();
      for (let i = 0; i < rocks.length; i++) { const r = rocks[i], q = rp(r[0], r[1], 0.85 + r[2] * 0.42); if (q[0] < v0 || q[0] > v1) continue; ctx.moveTo(q[0] + r[2], q[1]); ctx.ellipse(q[0], q[1], r[2], r[2] * 0.62, 0, 0, TAU); }
      ctx.fill();
      ctx.fillStyle = snowC; ctx.beginPath();
      for (let i = 0; i < patches.length; i++) { const p = patches[i], q0 = rp(p[0], p[1], 0.84), q1 = rp(p[0], p[2], 0.84), q2 = rp(p[0], lerp(p[1], p[2], 0.6), 1.02), q3 = rp(p[0], lerp(p[1], p[2], 0.25), 0.98); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q3[0], q3[1]); ctx.lineTo(q2[0], q2[1]); ctx.lineTo(q1[0], q1[1]); ctx.closePath(); }
      ctx.fill();
    }
    // ridge cap
    poly(ctx, [cx - 0.5, ridge + 0.8, cx + 0.5, ridge + 0.8, cx + 0.32, ridge + 1.12, cx - 0.32, ridge + 1.12], snowy ? snowC : roofE);
  } });
  P.solid(cx - w * 0.5 - over, eave - 0.6, 3.2, 1.2, 'wood'); P.solid(cx + w * 0.5 + over - 3.2, eave - 0.6, 3.2, 1.2, 'wood');
  return B;
};

// ---- a hunting tower ---------------------------------------------------------------
// An open hide on legs. Whoever stands in it is seen (and can be hit) from the
// waist up, over the boards. A stair runs up on one side.
// Built the way they are: four log legs on stone pads (the back pair shows between the
// front pair), cross braces bolted where they meet, a plank floor on joists, a boarded
// parapet with a rail to rest a rifle on, a pale boarded back wall and a low felt roof.
K.highSeat = function (S, P, x, o) {
  o = o || {}; const y = o.y || 0, h = o.h || 6.5, w = o.w || 3.6, id = o.id || 'hide', side = o.side || 1, run = o.run || 4.6, snowy = S.time === 'snow';
  const T = (hex) => S.tone(hex, P), sunD = S.sky.sun[0] >= 0 ? 1 : -1;
  const wood = T('#7d5d3c'), woodL = T('#93714b'), dark = T('#4d3929'), darker = T('#3a2b1f'), far = T('#5e4a37'), pad = T('#8d8a80');
  const roof = T(snowy ? '#eef2f6' : '#3b4a3b'), roofL = T(snowy ? '#ffffff' : '#4d5f4b'), roofD = T(snowy ? '#cdd6de' : '#2b362b'), mossC = T('#6f8a4c'), back = T('#cdb992'), back2 = T('#b29d78'), back3 = T('#d8c6a2'), nail = T('#2a2e36'), fl = y + h;
  S.room(id, false);
  const sx0 = x + side * (w / 2 + 0.2), sx1 = x + side * (w / 2 + 0.2 + run);
  const D = makeRng(Math.floor(x * 31 + h * 7) + 977), knots = []; for (let i = 0; i < 9; i++) knots.push([x - w / 2 + D.r(0.2, w - 0.2), fl + D.r(0.12, 0.8), D.r(0.03, 0.05)]);
  P.add({ x0: x - w - run, x1: x + w + run, layer: 0, draw(ctx, env) {
    const s = env.s, px = env.px;
    // stone pads, the back pair of legs, then the front pair with a lit edge
    ctx.fillStyle = pad; ctx.fillRect(x - w / 2 - 0.9, y, 0.7, 0.16); ctx.fillRect(x + w / 2 + 0.2, y, 0.7, 0.16); ctx.fillRect(sx1 - 0.4, y, 0.8, 0.14);
    line(ctx, x - w / 2 - 0.05, y, x - w / 2 + 0.45, fl, far, 0.15, env); line(ctx, x + w / 2 + 0.05, y, x + w / 2 - 0.45, fl, far, 0.15, env);
    if (s > 4) { line(ctx, x - w / 2 + 0.02, y + h * 0.3, x + w / 2 - 0.35, y + h * 0.72, far, 0.08, env); line(ctx, x + w / 2 - 0.02, y + h * 0.3, x - w / 2 + 0.35, y + h * 0.72, far, 0.08, env); }
    line(ctx, x - w / 2 - 0.55, y, x - w / 2 + 0.1, fl, dark, 0.22, env); line(ctx, x + w / 2 + 0.55, y, x + w / 2 - 0.1, fl, dark, 0.22, env);
    if (s > 10) { const o2 = sunD * 0.06; line(ctx, x - w / 2 - 0.55 + o2, y, x - w / 2 + 0.1 + o2, fl, wood, 0.05, null); line(ctx, x + w / 2 + 0.55 + o2, y, x + w / 2 - 0.1 + o2, fl, wood, 0.05, null); }
    // cross braces and ties
    line(ctx, x - w / 2 - 0.5, y + h * 0.08, x + w / 2 - 0.2, y + h * 0.5, dark, 0.11, env); line(ctx, x + w / 2 + 0.5, y + h * 0.08, x - w / 2 + 0.2, y + h * 0.5, dark, 0.11, env);
    line(ctx, x - w / 2 - 0.2, y + h * 0.5, x + w / 2 - 0.1, y + h * 0.93, dark, 0.11, env); line(ctx, x + w / 2 + 0.2, y + h * 0.5, x - w / 2 + 0.1, y + h * 0.93, dark, 0.11, env);
    line(ctx, x - w / 2 - 0.3, y + h * 0.5, x + w / 2 + 0.3, y + h * 0.5, dark, 0.13, env);
    if (s > 12) { ctx.fillStyle = nail; ctx.beginPath(); for (const q of [[-w / 2 - 0.47, 0.08], [w / 2 + 0.47, 0.08], [-w / 2 - 0.25, 0.5], [w / 2 + 0.25, 0.5], [0, 0.29], [0, 0.715], [-w / 2 + 0.08, 0.93], [w / 2 - 0.08, 0.93]]) { ctx.moveTo(x + q[0] + 0.05, y + h * q[1]); ctx.arc(x + q[0], y + h * q[1], 0.05, 0, TAU); } ctx.fill(); }
    // the stair: a stringer, treads, and a handrail on posts
    line(ctx, sx1, y, sx0, fl - 0.2, wood, 0.2, env); line(ctx, sx1, y + 1, sx0, fl + 0.8, wood, 0.08, env);
    if (s > 2.5) for (let i = 1; i < 12; i++) { const u = i / 12, qx = lerp(sx1, sx0, u), qy = lerp(y, fl - 0.2, u); line(ctx, qx - 0.3, qy, qx + 0.3, qy, dark, 0.07, env); }
    if (s > 5) for (let i = 0; i <= 3; i++) { const u = i / 3, qx = lerp(sx1, sx0, u), qy = lerp(y, fl - 0.2, u); line(ctx, qx, qy, qx, qy + 1, wood, 0.06, env); }
    // the back wall of the hide: pale weathered boards, so whoever is inside stands out against them
    R4(ctx, x - w / 2, fl + 0.9, w, 1.42, back);
    if (s > 3) { ctx.fillStyle = back2; for (let xx = x - w / 2 + 0.6; xx < x + w / 2; xx += 0.6) ctx.fillRect(xx, fl + 0.9, Math.max(0.04, px * 0.6), 1.42); }
    if (s > 12) { ctx.fillStyle = back3; for (let k = 0; k < 6; k += 2) ctx.fillRect(x - w / 2 + k * 0.6 + 0.05, fl + 0.9, 0.5, 1.42); ctx.fillStyle = back2; ctx.fillRect(x - w / 2, fl + 2.14, w, 0.18); }
    line(ctx, x - w / 2, fl, x - w / 2, fl + 2.35, dark, 0.14, env); line(ctx, x + w / 2, fl, x + w / 2, fl + 2.35, dark, 0.14, env);
  } });
  P.add({ x0: x - w, x1: x + w, layer: 1, draw(ctx, env) {
    const s = env.s, px = env.px;
    // floor on its joists, the boarded parapet, the rail
    R4(ctx, x - w / 2 - 0.35, fl - 0.28, w + 0.7, 0.28, dark);
    if (s > 8) { ctx.fillStyle = darker; for (let xx = x - w / 2 - 0.2; xx < x + w / 2 + 0.2; xx += 0.62) ctx.fillRect(xx, fl - 0.26, 0.16, 0.16); R4(ctx, x - w / 2 - 0.35, fl - 0.06, w + 0.7, 0.06, wood); }
    R4(ctx, x - w / 2, fl, w, 0.95, wood);
    if (s > 3) { ctx.fillStyle = dark; for (let xx = x - w / 2 + 0.45; xx < x + w / 2; xx += 0.45) ctx.fillRect(xx, fl, Math.max(0.04, px * 0.6), 0.95); }
    if (s > 12) {
      ctx.fillStyle = woodL; for (let k = 0; k < 8; k += 3) ctx.fillRect(x - w / 2 + k * 0.45 + 0.06, fl, 0.33, 0.95);
      ctx.fillStyle = dark; ctx.beginPath(); for (let i = 0; i < knots.length; i++) { const k = knots[i]; ctx.moveTo(k[0] + k[2] * 1.4, k[1]); ctx.ellipse(k[0], k[1], k[2] * 1.4, k[2], 0, 0, TAU); } ctx.fill();
      ctx.fillStyle = nail; ctx.beginPath(); for (let xx = x - w / 2 + 0.225; xx < x + w / 2; xx += 0.45) { ctx.rect(xx - 0.02, fl + 0.1, 0.04, 0.04); ctx.rect(xx - 0.02, fl + 0.78, 0.04, 0.04); } ctx.fill();
    }
    R4(ctx, x - w / 2 - 0.1, fl + 0.9, w + 0.2, 0.12, dark);
    if (s > 8) R4(ctx, x - w / 2 - 0.1, fl + 0.99, w + 0.2, 0.03, wood);
    // the roof: felt on boards, rafter ends under the eave, moss (or snow) on top
    poly(ctx, [x - w / 2 - 0.7, fl + 2.3, x + w / 2 + 0.7, fl + 2.3, x + w / 2 + 0.15, fl + 3.15, x - w / 2 - 0.15, fl + 3.15], roof);
    if (s > 5) {
      poly(ctx, [x - w / 2 - 0.15, fl + 3.15, x + w / 2 + 0.15, fl + 3.15, x + w / 2 + 0.24, fl + 3.02, x - w / 2 - 0.24, fl + 3.02], roofL);
      ctx.fillStyle = roofD; for (const yy of [fl + 2.56, fl + 2.8]) ctx.fillRect(x - w / 2 - 0.5, yy, w + 1.0, Math.max(0.03, px * 0.6));
      if (!snowy) { ctx.fillStyle = mossC; ctx.beginPath(); ctx.ellipse(x - w * 0.22, fl + 3.15, 0.5, 0.09, 0, 0, TAU); ctx.ellipse(x + w * 0.3, fl + 3.14, 0.34, 0.07, 0, 0, TAU); ctx.fill(); }
    }
    R4(ctx, x - w / 2 - 0.7, fl + 2.22, w + 1.4, 0.12, dark);
    if (s > 8) { ctx.fillStyle = darker; for (let xx = x - w / 2 - 0.5; xx < x + w / 2 + 0.5; xx += 0.7) ctx.fillRect(xx, fl + 2.1, 0.12, 0.13); }
  } });
  P.solid(x - w / 2, fl - 0.28, w, 1.23, 'wood');
  P.open({ x: x - w / 2, y: fl + 0.95, w, h: 1.35, room: id, glass: false, through: true });
  return { x, floor: fl, room: id, w, P, stairTop: sx0, stairFoot: sx1, roofY: fl + 3.15,
    place: (dx, extra) => Object.assign({ plane: P, x: x + (dx || 0), y: fl, room: id, zone: id, behind: true }, extra || {}),
    stairY: (xx) => y + h * clamp((sx1 - xx) / (sx1 - sx0), 0, 1) };
};

// ---- a radio dish on a mast ------------------------------------------------------------
// A guyed steel mast on a concrete foot: climbing pegs, a feeder cable clipped down one side to
// a junction box, warning bands near the top, a short aerial with cross rods and a red light.
// The dish itself is the thing to shoot: a white bowl with a dark rim, a feed horn on struts.
K.dishMast = function (S, P, x, y, h, o) {
  o = o || {}; const T = (hex) => S.tone(hex, P), steel = T('#8f979e'), steelD = T('#646c74'), dark = T('#2a2e36'), conc = T('#8d8a80'), red = T('#c8372d'), white = T('#f1ede2'), f = o.face || -1;
  P.add({ x0: x - 3, x1: x + 3, layer: 0, draw(ctx, env) {
    const s = env.s;
    R4(ctx, x - 0.55, y, 1.1, 0.28, conc);
    // guy wires down to their anchors
    line(ctx, x - 2.3, y, x, y + h * 0.8, dark, 0.04, env); line(ctx, x + 2.3, y, x, y + h * 0.8, dark, 0.04, env);
    line(ctx, x - 1.1, y, x, y + h * 0.55, dark, 0.05, env); line(ctx, x + 1.1, y, x, y + h * 0.55, dark, 0.05, env);
    line(ctx, x, y + 0.28, x, y + h, steel, 0.17, env);
    if (s > 7) {
      R4(ctx, x - 0.085, y + 0.28, 0.05, h - 0.28, steelD);
      ctx.fillStyle = steelD; ctx.beginPath(); for (let yy = y + 1.4, k = 0; yy < y + h - 1.2; yy += 0.42, k++) ctx.rect(k % 2 ? x + 0.08 : x - 0.3, yy, 0.22, 0.04); ctx.fill();   // climbing pegs
      for (const u of [0.3, 0.55, 0.8]) R4(ctx, x - 0.13, y + h * u - 0.05, 0.26, 0.1, dark);
      line(ctx, x + f * -0.14, y + 1.35, x + f * -0.14, y + h - 0.6, dark, 0.035, env);                         // feeder cable
      R4(ctx, x + f * -0.14 - 0.19, y + 0.95, 0.38, 0.46, steelD); R4(ctx, x + f * -0.14 - 0.13, y + 1.02, 0.26, 0.3, steel);
    }
    R4(ctx, x - 0.095, y + h - 1.75, 0.19, 0.3, red); R4(ctx, x - 0.095, y + h - 1.45, 0.19, 0.3, white); R4(ctx, x - 0.095, y + h - 1.15, 0.19, 0.3, red);
    line(ctx, x, y + h, x, y + h + 1.6, dark, 0.05, env);
    if (s > 5) { line(ctx, x - 0.42, y + h + 0.55, x + 0.42, y + h + 0.55, dark, 0.04, env); line(ctx, x - 0.3, y + h + 0.95, x + 0.3, y + h + 0.95, dark, 0.04, env); line(ctx, x - 0.2, y + h + 1.3, x + 0.2, y + h + 1.3, dark, 0.04, env); }
    line(ctx, x, y + h - 0.4, x + f * 0.5, y + h - 0.4, dark, 0.09, env);   // the arm the dish hangs on
  } });
  return K.thing(S, P, 'dish', x + f * 0.5, y + h - 0.4, Object.assign({ id: o.id || 'dish', r: 0.85,
    drawFn(ctx, env, S2, ob) {
      const live = ob.alive;
      ctx.save(); ctx.translate(ob.x, ob.y); ctx.rotate(live ? f * 0.35 : f * -1.1);
      // dark rim behind, so the pale bowl shows against snow and cloud
      ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(-f * 0.03, 0, 0.5, 1.03, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = T(live ? '#eef1f4' : '#5a5d62'); ctx.beginPath(); ctx.ellipse(0, 0, 0.42, 0.95, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = T(live ? '#b4bcc4' : '#3a3d42'); ctx.beginPath(); ctx.ellipse(f * 0.1, 0, 0.26, 0.74, 0, 0, TAU); ctx.fill();
      if (env.s > 7) { ctx.fillStyle = T(live ? '#d3d9df' : '#4a4d52'); ctx.beginPath(); ctx.ellipse(f * 0.13, 0.12, 0.13, 0.44, 0, 0, TAU); ctx.fill(); }
      // feed horn on its struts
      ctx.strokeStyle = dark; ctx.lineWidth = Math.max(0.04, env.px * 0.7); ctx.beginPath(); ctx.moveTo(f * 0.05, 0.86); ctx.lineTo(f * 0.95, 0); ctx.lineTo(f * 0.05, -0.86); ctx.stroke();
      line(ctx, 0, 0, f * 0.95, 0, dark, 0.06, env); R4(ctx, f * 0.95 - 0.12, -0.13, 0.24, 0.26, dark);
      if (!live) { ctx.strokeStyle = dark; ctx.lineWidth = Math.max(0.04, env.px * 0.7); ctx.beginPath(); ctx.moveTo(-0.1, 0.5); ctx.lineTo(0.08, 0.12); ctx.lineTo(-0.06, -0.1); ctx.lineTo(0.1, -0.5); ctx.stroke(); }
      ctx.restore();
      if (live && Math.sin(env.t * 3.2) > 0.2) circ(ctx, x, y + h + 1.6, Math.max(0.1, env.px * 1.1), '#ff3b30');
    } }, o.extra || {}));
};

// ---- a bundle of logs on a hook ----------------------------------------------------------
// Built on K.hang, so shooting the yellow hook block drops it. The load is
// drawn here (the stock loads are crates and pianos).
K.logLoad = function (S, P, x, yHook, o) {
  o = o || {};
  const drop = o.drop === undefined ? 2.0 : o.drop, top = o.top === undefined ? yHook + 8 : o.top;
  const ob = K.hang(S, P, x, yHook, 'logs', { id: o.id || 'logs', floor: o.floor || 0, top, drop, r: o.r || 0.62 });
  const p = ob.prop; p.w = o.w || 6.4; p.h = 1.5; p.y = yHook - drop - p.h;
  p.gone = true; // tells the view not to draw a crate; the logs below stand in for it
  const T = (hex) => S.tone(hex, P), bark = T('#6a4a30'), bark2 = T('#553a26'), barkL = T('#80603f'), barkD = T('#3f2b1c'), cut = T('#d8b889'), cutD = T('#b08e62'), chain = T('#1c1f25'), yel = T('#f0b21e'), yelD = T('#c98d0c'), steel = T('#8d949a');
  const D = makeRng(Math.floor(x * 17 + yHook * 5) + 431), marks = []; for (let i = 0; i < 40; i++) marks.push([D.f(), D.i(0, 2), D.r(0.1, 0.4), D.r(0.1, 0.4)]);
  // a hook block big enough to pick out (and to hit) at long range
  ob.draw = (ctx, env) => {
    const s = env.s;
    if (s > 9) { line(ctx, x - 0.16, yHook + 0.4, x - 0.16, top, chain, 0.045, env); line(ctx, x + 0.16, yHook + 0.4, x + 0.16, top, chain, 0.045, env); }
    else line(ctx, x, yHook, x, top, chain, 0.09, env);
    if (!ob.alive) return;
    // the sling: two chains from the hook out to the ends of the bundle
    ctx.strokeStyle = chain; ctx.lineWidth = Math.max(0.07, env.px * 0.8);
    if (s > 16 && ctx.setLineDash) ctx.setLineDash([0.16, 0.07]);
    ctx.beginPath(); ctx.moveTo(x, yHook - 0.78); ctx.lineTo(p.x - p.w * 0.3, p.y + p.h); ctx.moveTo(x, yHook - 0.78); ctx.lineTo(p.x + p.w * 0.3, p.y + p.h); ctx.stroke();
    if (s > 16 && ctx.setLineDash) ctx.setLineDash([]);
    if (s > 6) { ctx.strokeStyle = chain; ctx.lineWidth = Math.max(0.1, env.px); ctx.beginPath(); ctx.moveTo(x, yHook - 0.5); ctx.lineTo(x, yHook - 0.66); ctx.arc(x - 0.13, yHook - 0.7, 0.13, 0, -Math.PI, true); ctx.stroke(); }   // the hook under the block
    // the block: yellow cheeks, black bands, the sheave showing through the middle
    R4(ctx, x - 0.55, yHook - 0.5, 1.1, 1.0, yel); R4(ctx, x - 0.55, yHook - 0.5, 1.1, 0.16, chain); R4(ctx, x - 0.55, yHook + 0.34, 1.1, 0.16, chain);
    if (s > 9) { R4(ctx, x - 0.55, yHook - 0.34, 0.12, 0.68, yelD); R4(ctx, x + 0.43, yHook - 0.34, 0.12, 0.68, yelD); circ(ctx, x, yHook, 0.27, steel); }
    circ(ctx, x, yHook, s > 9 ? 0.11 : 0.2, chain);
  };
  P.add({ x0: x - p.w, x1: x + p.w, layer: 2, draw(ctx, env) {
    if (p.cleared) return;   // dragged off the road
    const s = env.s, w = p.w, x0 = p.x - w / 2, y0 = p.y, rows = [[0, 0.02, 1], [0.04, 0.5, 0.94], [0.02, 0.98, 0.9]];
    for (let i = 0; i < rows.length; i++) {
      const lx = x0 + rows[i][0] * w + (p.landed ? (i - 1) * 0.5 : 0), ly = y0 + rows[i][1] * (p.landed ? 0.8 : 1), lw = w * rows[i][2];
      R4(ctx, lx, ly, lw, 0.5, i % 2 ? bark2 : bark);
      if (s > 5) { R4(ctx, lx, ly + 0.36, lw, 0.1, barkL); R4(ctx, lx, ly, lw, 0.09, barkD); }
      if (s > 12) { ctx.fillStyle = barkD; ctx.beginPath(); for (let k = 0; k < marks.length; k++) { const m = marks[k]; if (m[1] !== i) continue; ctx.rect(lx + 0.2 + m[0] * (lw - 0.9), ly + 0.1 + m[3] * 0.6, m[2], 0.028); } ctx.fill(); }
      ctx.fillStyle = cut; ctx.beginPath(); ctx.ellipse(lx + 0.06, ly + 0.25, 0.1, 0.25, 0, 0, TAU); ctx.ellipse(lx + lw - 0.06, ly + 0.25, 0.1, 0.25, 0, 0, TAU); ctx.fill();
      if (s > 12) { ctx.strokeStyle = cutD; ctx.lineWidth = Math.max(0.02, env.px * 0.5); ctx.beginPath(); ctx.ellipse(lx + 0.06, ly + 0.25, 0.05, 0.14, 0, 0, TAU); ctx.moveTo(lx + lw - 0.01, ly + 0.25); ctx.ellipse(lx + lw - 0.06, ly + 0.25, 0.05, 0.14, 0, 0, TAU); ctx.stroke(); }
    }
    if (!p.landed) { R4(ctx, x0 + w * 0.2, y0 - 0.04, 0.16, p.h + 0.08, chain); R4(ctx, x0 + w * 0.8 - 0.16, y0 - 0.04, 0.16, p.h + 0.08, chain); if (s > 9) { R4(ctx, x0 + w * 0.2 - 0.05, y0 + p.h * 0.45, 0.26, 0.2, steel); R4(ctx, x0 + w * 0.8 - 0.21, y0 + p.h * 0.45, 0.26, 0.2, steel); } }
  } });
  ob.logs = p;
  return ob;
};

// The collectible, drawn a little larger so it can still be found at 600 m.
K.farDuck = function (S, P, x, y, k) {
  k = k || 1.5;
  return K.thing(S, P, 'duck', x, y, { r: 0.26 * k, drawFn(ctx, env, S2, ob) {
    if (!ob.alive) return;
    const X = ob.x, Y = ob.y;
    circ(ctx, X, Y, 0.2 * k, '#f7d038'); circ(ctx, X + 0.14 * k, Y + 0.2 * k, 0.13 * k, '#f7d038');
    if (env.s * k > 14) { ctx.fillStyle = '#e2b620'; ctx.beginPath(); ctx.ellipse(X - 0.04 * k, Y - 0.02 * k, 0.12 * k, 0.075 * k, 0.35, 0, TAU); ctx.fill(); poly(ctx, [X - 0.17 * k, Y + 0.06 * k, X - 0.3 * k, Y + 0.17 * k, X - 0.12 * k, Y + 0.14 * k], '#f7d038'); circ(ctx, X + 0.1 * k, Y + 0.25 * k, 0.04 * k, '#fbe684'); }
    poly(ctx, [X + 0.24 * k, Y + 0.22 * k, X + 0.4 * k, Y + 0.17 * k, X + 0.24 * k, Y + 0.13 * k], '#f08a24'); circ(ctx, X + 0.17 * k, Y + 0.24 * k, 0.025 * k, '#1b1b1b');
  } });
};

// ---- new vehicles ---------------------------------------------------------------------------
// A cable-car cabin. Passengers stand; they are seen from the knees up through
// three big windows. `y` is the cabin floor: give the vehicle a yFn that
// follows the cable (H.cable.carY).
// From the cable down: a rocker beam with four sheaves riding the rope, the grip, a hanger
// arm on a pivot, the roof with its vent, the cabin with gasketed windows and sliding doors.
CARS.gondola = { len: 4.4, h: 2.5, body: 0.4, cab: [-0.5, 0.5], win: [[-0.44, -0.17], [-0.135, 0.135], [0.17, 0.44]], seats: [-0.305, 0, 0.305], wheel: 0, hang: 2.3,
  draw(ctx, env, S, P, x, y, dir, colHex, st) {
    const c = CARS.gondola, L = c.len, base = colHex || '#c8372d', T = (hex, self) => S.tone(hex, P, self), s = env.s;
    const col = T(base), dk = T(darken(base, 0.35)), lt = T(lighten(base, 0.2)), cream = T('#efe6cf'), steel = T('#2a2e36'), steel2 = T('#69727c'), gasket = T('#1d2026');
    const gl = T(S.pal.dark > 0.5 ? '#f3dc9a' : '#bfd6e4', true), top = c.h + c.hang;
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    // running gear: sheaves on the rope, the rocker beam under it, side plates
    ctx.fillStyle = steel; ctx.beginPath(); for (const wx of [-0.42, 0.06, 0.84, 1.32]) { ctx.moveTo(wx + 0.19, top + 0.17); ctx.arc(wx, top + 0.17, 0.19, 0, TAU); } ctx.fill();
    if (s > 12) { ctx.fillStyle = steel2; ctx.beginPath(); for (const wx of [-0.42, 0.06, 0.84, 1.32]) { ctx.moveTo(wx + 0.07, top + 0.17); ctx.arc(wx, top + 0.17, 0.07, 0, TAU); } ctx.fill(); }
    R4(ctx, -0.62, top - 0.42, 2.14, 0.26, steel);
    poly(ctx, [-0.5, top - 0.2, 0.14, top - 0.2, 0.06, top + 0.2, -0.42, top + 0.2], steel); poly(ctx, [0.76, top - 0.2, 1.4, top - 0.2, 1.32, top + 0.2, 0.84, top + 0.2], steel);
    // hanger arm, tapering down from the pivot to the roof
    poly(ctx, [0.34, top - 0.36, 0.66, top - 0.36, 0.13, c.h + 0.14, -0.13, c.h + 0.14], steel);
    circ(ctx, 0.5, top - 0.3, 0.17, steel2); if (s > 12) circ(ctx, 0.5, top - 0.3, 0.07, steel);
    R4(ctx, -0.42, c.h + 0.1, 0.84, 0.16, steel);
    // cabin
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-L / 2 + 0.3, 0); ctx.lineTo(L / 2 - 0.3, 0); ctx.quadraticCurveTo(L / 2, 0, L / 2, 0.35); ctx.lineTo(L / 2, c.h - 0.3); ctx.quadraticCurveTo(L / 2, c.h, L / 2 - 0.3, c.h);
    ctx.lineTo(-L / 2 + 0.3, c.h); ctx.quadraticCurveTo(-L / 2, c.h, -L / 2, c.h - 0.3); ctx.lineTo(-L / 2, 0.35); ctx.quadraticCurveTo(-L / 2, 0, -L / 2 + 0.3, 0); ctx.fill();
    R4(ctx, -L / 2 + 0.2, c.h, L - 0.4, 0.16, dk);
    if (s > 6) { R4(ctx, -L / 2 + 0.34, c.h - 0.1, L - 0.68, 0.06, lt); R4(ctx, -L / 2 + 0.3, 0, L - 0.6, 0.1, dk); R4(ctx, -1.5, c.h + 0.16, 0.7, 0.1, steel); R4(ctx, 0.8, c.h + 0.16, 0.7, 0.1, steel); }
    R4(ctx, -L / 2, 0.22, L, 0.14, cream);
    for (let i = 0; i < c.win.length; i++) {
      const w0 = c.win[i][0] * L, w1 = c.win[i][1] * L, broken = st && st.glass && st.glass[i], wy = c.body + 0.06, wh = c.h - c.body - 0.2;
      if (s > 6) R4(ctx, w0 - 0.05, wy - 0.05, w1 - w0 + 0.1, wh + 0.1, gasket);
      R4(ctx, w0, wy, w1 - w0, wh, broken ? T('#8fa6b6') : gl);
      if (!broken) { ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(w0, wy, (w1 - w0) * 0.22, wh); }
      else if (s > 6) { ctx.strokeStyle = 'rgba(240,248,255,0.8)'; ctx.lineWidth = Math.max(0.02, env.px * 0.6); ctx.beginPath(); const mx = (w0 + w1) / 2, my = wy + wh * 0.55; for (let k = 0; k < 6; k++) { const an = k * 1.05 + i; ctx.moveTo(mx, my); ctx.lineTo(clamp(mx + Math.cos(an) * 0.7, w0, w1), clamp(my + Math.sin(an) * 0.9, wy, wy + wh)); } ctx.stroke(); }
    }
    if (s > 9) { // door seams between the windows, grab handles, a lamp at each end
      ctx.fillStyle = dk; ctx.fillRect(-0.672, 0.4, 0.035, c.h - 0.5); ctx.fillRect(0.672 - 0.035, 0.4, 0.035, c.h - 0.5);
      ctx.fillStyle = cream; ctx.fillRect(-0.72, 1.1, 0.03, 0.4); ctx.fillRect(0.69, 1.1, 0.03, 0.4);
      R4(ctx, L / 2 - 0.1, 0.5, 0.1, 0.16, S.pal.dark > 0.1 ? '#fff3c4' : T('#e8e4d0')); R4(ctx, -L / 2, 0.5, 0.1, 0.16, T('#a8322a'));
    }
    ctx.restore();
  } };

// A light helicopter. `st.rotor` (0 to 1) spins the blades. `y` is the bottom
// of the skids, so a yFn can lift it off the pad.
// Skids on cross tubes with a step, a teardrop cabin with a glazed nose and a door, the engine
// cowl and exhaust behind the mast, a tail boom with stabiliser, fin and tail rotor, lights.
// The blades droop at rest; turning, they become a blurred disc with the blades ghosting through it.
CARS.chopper = { len: 10.4, h: 3.1, body: 1.25, cab: [0.06, 0.46], win: [[0.13, 0.43]], seats: [0.34, 0.2], wheel: 0,
  draw(ctx, env, S, P, x, y, dir, colHex, st) {
    const base = colHex || '#e4e0d4', T = (hex, self) => S.tone(hex, P, self), s = env.s;
    const col = T(base), dk = T(darken(base, 0.3)), sh = T(darken(base, 0.14)), lt = T(lighten(base, 0.35)), steel = T('#20242b'), steel2 = T('#5d6670'), stripe = T((st && st.stripe) || '#b3312b');
    const gl = T('#bfd6e4', true), spin = (st && st.rotor) || 0, t = env.t;
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    // skids: runner with an upturned toe, two cross tubes, a step
    line(ctx, -0.8, 0.06, 4.0, 0.06, steel, 0.12, env); line(ctx, 4.0, 0.06, 4.4, 0.32, steel, 0.12, env);
    line(ctx, 0.3, 0.06, 0.6, 0.95, steel, 0.09, env); line(ctx, 2.9, 0.06, 2.7, 0.95, steel, 0.09, env);
    if (s > 7) R4(ctx, 1.5, 0.5, 0.9, 0.07, steel);
    // tail boom, stabiliser and fin
    poly(ctx, [0.6, 1.9, -4.9, 2.25, -4.9, 2.55, 0.6, 2.75], col);
    if (s > 5) { poly(ctx, [0.6, 1.9, -4.9, 2.25, -4.9, 2.34, 0.6, 2.12], sh); R4(ctx, -3.6, 2.36, 1.1, 0.11, dk); }
    poly(ctx, [-4.5, 2.3, -5.2, 3.6, -4.75, 3.6, -3.9, 2.4], col); poly(ctx, [-4.6, 2.3, -5.0, 1.45, -4.6, 1.45, -4.2, 2.3], dk);
    if (s > 5) poly(ctx, [-4.86, 3.0, -5.2, 3.6, -4.75, 3.6, -4.48, 3.0], stripe);
    // engine cowl and exhaust behind the mast
    poly(ctx, [0.1, 2.7, 0.5, 3.28, 2.9, 3.28, 3.3, 3.0, 0.4, 2.6], dk);
    if (s > 7) { R4(ctx, 0.0, 2.86, 0.5, 0.16, steel); ctx.fillStyle = steel; for (let k = 0; k < 4; k++) ctx.fillRect(0.9 + k * 0.28, 3.04, 0.16, 0.05); }
    // body: a teardrop with a glass nose, a shaded belly
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-0.3, 0.9); ctx.quadraticCurveTo(-0.6, 2.9, 1.2, 3.02); ctx.lineTo(3.3, 3.02); ctx.quadraticCurveTo(5.0, 2.7, 5.15, 1.7); ctx.quadraticCurveTo(5.1, 0.8, 3.6, 0.75); ctx.closePath(); ctx.fill();
    ctx.fillStyle = sh; ctx.beginPath(); ctx.moveTo(-0.3, 0.9); ctx.lineTo(3.6, 0.75); ctx.quadraticCurveTo(4.9, 0.8, 5.1, 1.35); ctx.lineTo(-0.36, 1.3); ctx.closePath(); ctx.fill();
    R4(ctx, -0.2, 1.55, 5.2, 0.16, stripe);
    if (s > 6) R4(ctx, -0.2, 1.42, 5.25, 0.06, stripe);
    const broken = st && st.glass && st.glass[0];
    ctx.fillStyle = broken ? T('#8fa6b6') : gl; ctx.beginPath(); ctx.moveTo(1.35, 1.31); ctx.lineTo(4.47, 1.31); ctx.quadraticCurveTo(4.6, 2.5, 3.5, 2.96); ctx.lineTo(1.35, 2.96); ctx.closePath(); ctx.fill();
    if (!broken && s > 5) { ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.moveTo(3.0, 2.96); ctx.lineTo(3.5, 2.96); ctx.quadraticCurveTo(4.3, 2.6, 4.45, 1.9); ctx.lineTo(4.1, 1.9); ctx.quadraticCurveTo(3.9, 2.6, 3.0, 2.96); ctx.fill(); }
    else if (broken && s > 6) { ctx.strokeStyle = 'rgba(240,248,255,0.8)'; ctx.lineWidth = Math.max(0.02, env.px * 0.6); ctx.beginPath(); for (let k = 0; k < 6; k++) { ctx.moveTo(2.9, 2.1); ctx.lineTo(2.9 + Math.cos(k * 1.05) * 1.1, clamp(2.1 + Math.sin(k * 1.05) * 0.9, 1.31, 2.96)); } ctx.stroke(); }
    R4(ctx, 2.75, 1.31, 0.09, 1.65, dk);
    if (s > 7) { // door frame and handle, panel line, lights
      ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.03, env.px * 0.6); ctx.beginPath(); ctx.moveTo(1.3, 0.95); ctx.lineTo(1.3, 2.98); ctx.moveTo(2.8, 0.9); ctx.lineTo(2.8, 1.31); ctx.moveTo(0.55, 1.0); ctx.lineTo(0.55, 2.8); ctx.stroke();
      R4(ctx, 2.45, 1.12, 0.22, 0.06, steel);
      circ(ctx, 4.95, 1.2, 0.09, S.pal.dark > 0.1 ? '#fff3c4' : lt);
    }
    if (s > 4) { circ(ctx, 3.9, 0.82, Math.max(0.07, env.px * 0.8), dir > 0 ? '#3fd06a' : '#ff4a3d'); if (spin > 0.05 && Math.sin(t * 6) > 0.55) circ(ctx, -4.97, 3.66, Math.max(0.1, env.px), '#ff3b30'); }
    // rotor mast and blades
    R4(ctx, 1.9, 3.0, 0.5, 0.45, steel);
    if (s > 7) { R4(ctx, 1.78, 3.26, 0.74, 0.07, steel2); R4(ctx, 2.0, 3.45, 0.3, 0.14, steel2); }
    if (spin > 0.25) {
      const fl = 0.2 + 0.1 * Math.sin(t * 31);
      ctx.fillStyle = 'rgba(20,24,30,' + fl.toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(2.15, 3.52, 5.6, 0.2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(235,240,245,' + (0.1 + 0.08 * Math.sin(t * 23)).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(2.15, 3.56, 5.3, 0.07, 0, 0, TAU); ctx.fill();
      const ph = t * (9 + 22 * spin), a = Math.abs(Math.cos(ph)), b = Math.abs(Math.sin(ph));
      line(ctx, 2.15 - 5.6 * a, 3.52, 2.15 + 5.6 * a, 3.52, steel, 0.07, env);
      ctx.globalAlpha = 0.45; line(ctx, 2.15 - 5.6 * b, 3.5, 2.15 + 5.6 * b, 3.5, steel, 0.06, env); ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(20,24,30,0.3)'; ctx.beginPath(); ctx.arc(-4.95, 2.75, 0.85, 0, TAU); ctx.fill();
      if (s > 5) { ctx.strokeStyle = 'rgba(20,24,30,0.4)'; ctx.lineWidth = Math.max(0.04, env.px * 0.7); ctx.beginPath(); ctx.arc(-4.95, 2.75, 0.85, 0, TAU); ctx.stroke(); }
    } else {
      // at rest (or just starting to turn): two long blades that sag toward their tips
      const a = spin > 0 ? Math.cos(t * 9 * spin * 4) : 0.92, sag = (1 - spin * 4) * 0.3 * Math.abs(a);
      ctx.fillStyle = steel; ctx.beginPath(); ctx.moveTo(2.15, 3.58); ctx.lineTo(2.15 - 5.6 * a, 3.52 - sag); ctx.lineTo(2.15 - 5.6 * a, 3.45 - sag); ctx.lineTo(2.15, 3.44); ctx.lineTo(2.15 + 5.6 * a, 3.45 - sag); ctx.lineTo(2.15 + 5.6 * a, 3.52 - sag); ctx.closePath(); ctx.fill();
      line(ctx, -4.95, 1.95, -4.95, 3.55, steel, 0.08, env);
    }
    circ(ctx, 2.15, 3.52, 0.16, steel);
    circ(ctx, -4.95, 2.75, 0.13, steel);
    ctx.restore();
  } };

// An SUV with a bright box on the roof, so one car in a convoy can be told
// from another at long range.
CARS.suvbox = Object.assign({}, CARS.suv, {
  draw(ctx, env, S, P, x, y, dir, colHex, st) {
    const c = CARS.suv;
    drawCar(ctx, env, S, P, 'suv', x, y, dir, colHex, st);
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    const hex = (st && st.boxCol) || '#e8761e', bc = S.tone(hex, P), bd = S.tone(darken(hex, 0.25), P), bl = S.tone(lighten(hex, 0.3), P), rail = S.tone('#14161a', P);
    // roof bars and their feet, then the box: a darker lower shell, a bright lid, a highlight along the top
    R4(ctx, -1.75, c.h, 0.1, 0.2, rail); R4(ctx, 0.35, c.h, 0.1, 0.2, rail);
    if (env.s > 7) R4(ctx, -1.95, c.h + 0.1, 2.65, 0.06, rail);
    ctx.fillStyle = bc; ctx.beginPath(); ctx.moveTo(-2.0, c.h + 0.18); ctx.lineTo(0.75, c.h + 0.18); ctx.quadraticCurveTo(1.0, c.h + 0.3, 0.6, c.h + 0.62); ctx.lineTo(-1.8, c.h + 0.62); ctx.quadraticCurveTo(-2.1, c.h + 0.5, -2.0, c.h + 0.18); ctx.fill();
    if (env.s > 5) {
      ctx.fillStyle = bd; ctx.beginPath(); ctx.moveTo(-2.0, c.h + 0.18); ctx.lineTo(0.75, c.h + 0.18); ctx.quadraticCurveTo(0.9, c.h + 0.25, 0.86, c.h + 0.34); ctx.lineTo(-2.03, c.h + 0.34); ctx.closePath(); ctx.fill();
      R4(ctx, -1.7, c.h + 0.53, 2.1, 0.045, bl);
      if (env.s > 12) R4(ctx, -0.72, c.h + 0.28, 0.16, 0.09, rail);
    }
    ctx.restore();
  } });

// The valley is built from the pieces above through this private list, so it
// keeps working even if a later scene file reuses one of the K names.
const VLY = { peaks: K.alpPeaks, hill: K.forestHill, flag: K.bigFlag, sock: K.alpWindsock, plume: K.plume, chalet: K.chalet, seat: K.highSeat, dish: K.dishMast, logs: K.logLoad, duck: K.farDuck };

// ---- the valley -------------------------------------------------------------------------------
// o.z      distance to the plane the mission is about
// o.focus  which plane that is: 'deck' (default), 'road' or 'cable'
// o.eye    height of the main shooting position above the lodge yard
// o.time   'day' | 'dawn' | 'snow'      o.weather  defaults to snow for 'snow'
// o.top    upper edge of the scope's travel (metres, on the mission plane)
SCN.valley = function (o) {
  o = o || {};
  const time = o.time || 'day', snowy = time === 'snow', sd = o.seed || 3;
  const E = o.eye === undefined ? 45 : o.eye, focus = o.focus || 'deck', zR = o.z || 450;
  const zD = focus === 'road' ? zR + 70 : focus === 'cable' ? zR - 45 : zR;
  const roadY = -12, bankY = -16.5, deckY = 3.4;
  const lay = (th, z) => E + th * z;                       // height that sits at angle th on a plane at z
  const onRef = (y, z) => E + (y - E) * (zR / z);          // the same line of sight, read on the mission plane
  const span = (o.span || 94) * (zR / zD);
  // the backdrop, as angles above the pines behind the lodge
  const a1 = (24 - E) / (zD + 62), a2 = a1 + 0.022, a3 = a2 + 0.019, a4 = a3 + 0.017, a5 = a4 + 0.027, a6 = a5 + 0.024;
  const zH2 = zD + 270, zH3 = zD + 760, zH4 = zD + 1750, zP1 = zD + 3700, zP2 = zD + 7600;
  const S = makeScene({ time, weather: o.weather || (snowy ? 'snow' : 'clear'), seed: sd, refZ: zR, fog: o.fog, exits: [-112, 112], sun: o.sun || (time === 'dawn' ? [-58, (a6 + 0.016) * 1000] : [58, (a6 + 0.05) * 1000]),
    bounds: { x0: -span, x1: span, y0: onRef(bankY, zD - 95) - 0.02 * zR, y1: o.top === undefined ? lay(a6 + 0.03, zR) : o.top }, ambience: snowy ? 'snow' : 'wild', groundMat: snowy ? 'snow' : 'dirt' });
  const H = { S, z: zR, zD, eye: E, deckY, roadY, kit: VLY };
  const meadow = snowy ? '#e9eef3' : time === 'dawn' ? '#6f8f5a' : '#7fa860';
  const sunD = S.sky.sun[0] >= 0 ? 1 : -1, dimK = S.pal.dark > 0.1 || snowy;   // dimK: dull enough for lamps to show

  // ---- peaks and hills, far to near ----
  // The two ranges of peaks stand a good way clear of the forested hills, each range hazier than the
  // one in front. The far hills carry a crag with a waterfall and high meadows with a hay hut and cattle.
  VLY.peaks(S, zP2, { seed: sd + 11, base: lay(a4 - 0.05, zP2), top: lay(a6 + 0.03, zP2), col: '#6c7a96', snowLine: 0.5, haze: 0.56, mistLo: 0.4, mistHi: 0.52, hazeTop: 0.6 });
  VLY.peaks(S, zP1, { seed: sd + 5, base: lay(a3 - 0.05, zP1), top: lay(a5 + 0.02, zP1), col: '#4b5870', snowLine: 0.66, haze: 0.38, mistLo: 0.5, mistHi: 0.6, hazeTop: 0.72 });
  VLY.hill(S, zH4, { seed: sd + 23, top: lay(a4, zH4), amp: 0.02 * zH4, rough: 620, th: 20, rows: 2, gap: 0.5, rowDrop: 0.7, col: '#3d6a68', treeCol: '#3a6664', treeCol2: '#44736f', dip: { x: 60, w: 480, d: 0.011 * zH4 }, more: 1, crags: [[-0.07 * zH4, 0.034 * zH4, 0.03 * zH4, true], [0.2 * zH4, 0.026 * zH4, 0.02 * zH4]], glades: [[0.085 * zH4, 0.135 * zH4, 2, true, 3]], mist: [lay(a3 - 0.002, zH4), lay(a3 + 0.012, zH4), 0.7] });
  VLY.hill(S, zH3, { seed: sd + 17, top: lay(a3, zH3), amp: 0.022 * zH3, rough: 360, th: 17, rows: 2, gap: 0.46, rowDrop: 0.7, col: '#315a52', treeCol: '#2d554d', treeCol2: '#376358', dip: { x: -80, w: 260, d: 0.012 * zH3 }, more: 1, crags: [[-0.2 * zH3, 0.036 * zH3, 0.03 * zH3]], glades: [[0.045 * zH3, 0.105 * zH3, 2, true, 4]], mist: [lay(a2 - 0.002, zH3), lay(a2 + 0.012, zH3), 0.62] });
  VLY.hill(S, zH2, { seed: sd + 9, top: lay(a2, zH2), amp: 0.024 * zH2, rough: 230, th: 15, rows: 3, gap: 0.42, rowDrop: 0.6, col: '#274a3e', treeCol: '#234539', treeCol2: '#2c5443', dip: { x: 40, w: 170, d: 0.012 * zH2 }, more: 1, sway: true, glades: [[-0.2 * zH2, -0.125 * zH2, 2, true, 4, 0.3]], mist: [lay(a1 - 0.004, zH2), lay(a1 + 0.012, zH2), 0.5] });
  // the rise right behind the lodge: the cable car runs up over it
  const PH1 = VLY.hill(S, zD + 62, { name: 'rise', seed: sd + 3, top: 11, amp: 7, rough: 90, th: 12.5, rows: 3, gap: 0.4, col: '#1f3b32', treeCol: '#1b362d', treeCol2: '#25493a', sway: true, clear: (x, r) => r > 0 && Math.abs(((x + 300) % 60) - 30) > 27.5 });
  H.PH1 = PH1;
  { // choughs wheeling over the valley, far too small and too high to be anything else
    const R = makeRng(sd * 29 + 3), birds = [], ink = S.tone('#20242b', PH1); for (let i = 0; i < 5; i++) birds.push([R.r(-150, 150), lay(R.r(a2, a6), zD + 62), R.r(14, 34), R.r(0.12, 0.2), R.r(0, TAU)]);
    PH1.add({ x0: -400, x1: 400, layer: 0, draw(ctx, env) {
      if (env.s < 2) return;
      ctx.strokeStyle = ink; ctx.lineWidth = Math.max(0.09, env.px * 0.9); ctx.beginPath();
      for (let i = 0; i < birds.length; i++) {
        const b = birds[i], an = env.t * b[3] + b[4], x = b[0] + Math.cos(an) * b[2] + alpDrift(env) * 0.05, y = b[1] + Math.sin(an) * b[2] * 0.22, f = 0.35 + 0.3 * Math.sin(env.t * 2.1 + i * 2), w = 0.75;
        if (x < env.x0 - 2 || x > env.x1 + 2) continue;
        ctx.moveTo(x - w, y + f * w * 0.5); ctx.quadraticCurveTo(x - w * 0.45, y + f * w, x, y); ctx.quadraticCurveTo(x + w * 0.45, y + f * w, x + w, y + f * w * 0.5);
      }
      ctx.stroke();
    } });
  }

  // ---- the cable car line ----
  // Lattice pylons on concrete feet, each with a ladder up to a working platform and a cross-arm
  // carrying the sheaves. The two track ropes run dead straight, because the cars ride them; the
  // lighter haul rope below hangs slack from pylon to pylon and stirs a little.
  const PC = S.plane(zD + 45, 'cable'); H.PC = PC;
  PC.groundY = 1; PC.groundMat = S.groundMat;
  {
    const xa = -118, ya = 12, xb = 118, yb = 50, yAt = (x) => lerp(ya, yb, (x - xa) / (xb - xa)), pyl = o.pylons || [-60, 0, 60];
    const steel = S.tone('#5d6670', PC), steelL = S.tone('#8a959f', PC), rope = S.tone('#1a1c20', PC), dk = S.tone('#2f353d', PC), plate = S.tone('#b9b39c', PC), snowC = S.tone('#f4f7fa', PC);
    // every support the ropes pass over: the pylons of the line, and one more beyond each end
    const sup = pyl.slice(); sup.unshift(Math.min(-122, pyl[0] - 62)); sup.push(Math.max(122, pyl[pyl.length - 1] + 62));
    const far = 210;
    PC.add({ x0: -far, x1: far, layer: 0, draw(ctx, env) {
      const s = env.s, px1 = env.px;
      for (let i = 0; i < sup.length; i++) {
        const px = sup[i], ty = yAt(px) + 0.5, g = 1; if (px + 4 < env.x0 || px - 4 > env.x1) continue;
        line(ctx, px - 2.1, g, px - 0.45, ty, steel, 0.28, env); line(ctx, px + 2.1, g, px + 0.45, ty, steel, 0.28, env);
        if (s > 9) { line(ctx, px - 2.1 + sunD * 0.08, g, px - 0.45 + sunD * 0.08, ty, steelL, 0.07, null); line(ctx, px + 2.1 + sunD * 0.08, g, px + 0.45 + sunD * 0.08, ty, steelL, 0.07, null); }
        if (s > 1.6) { // cross bracing with a girt at every level
          ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.1, px1 * 0.7); ctx.beginPath(); const n = Math.max(4, Math.round((ty - g) / 3.2));
          for (let k = 0; k < n; k++) { const u0 = k / n, u1 = (k + 1) / n, w0 = lerp(2.1, 0.45, u0), w1 = lerp(2.1, 0.45, u1), y0 = lerp(g, ty, u0), y1 = lerp(g, ty, u1); ctx.moveTo(px - w0, y0); ctx.lineTo(px + w1, y1); ctx.moveTo(px + w0, y0); ctx.lineTo(px - w1, y1); if (k && s > 4) { ctx.moveTo(px - w0, y0); ctx.lineTo(px + w0, y0); } }
          ctx.stroke();
        }
        if (s > 5) { // the ladder, the platform under the head and its rail
          ctx.strokeStyle = dk; ctx.lineWidth = Math.max(0.05, px1 * 0.6); ctx.beginPath();
          ctx.moveTo(px - 0.2, g); ctx.lineTo(px - 0.2, ty - 1.9); ctx.moveTo(px + 0.2, g); ctx.lineTo(px + 0.2, ty - 1.9);
          if (s > 10) for (let yy = g + 0.4; yy < ty - 1.9; yy += 0.4) { ctx.moveTo(px - 0.2, yy); ctx.lineTo(px + 0.2, yy); }
          ctx.moveTo(px - 1.25, ty - 1.9); ctx.lineTo(px - 1.25, ty - 1.0); ctx.lineTo(px + 1.25, ty - 1.0); ctx.lineTo(px + 1.25, ty - 1.9);
          ctx.stroke();
          R4(ctx, px - 1.35, ty - 2.02, 2.7, 0.13, dk);
          if (s > 9) R4(ctx, px - 0.4, g + 2.3, 0.8, 0.55, plate);
        }
        // the head: cross-arm, the big deflection wheels, a train of small sheaves under each rope, a spike on top
        R4(ctx, px - 2.6, ty - 0.2, 5.2, 0.5, dk); circ(ctx, px - 1.9, ty + 0.25, 0.42, dk); circ(ctx, px + 1.9, ty + 0.25, 0.42, dk);
        if (s > 7) {
          ctx.fillStyle = steelL; ctx.beginPath(); for (const d of [-1.9, 1.9]) { ctx.moveTo(px + d + 0.15, ty + 0.25); ctx.arc(px + d, ty + 0.25, 0.15, 0, TAU); } ctx.fill();
          ctx.fillStyle = steel; ctx.beginPath(); for (const d of [-2.45, -1.35, -0.8, 0.8, 1.35, 2.45]) { const yy = yAt(px + d) - 0.16; ctx.moveTo(px + d + 0.15, yy); ctx.arc(px + d, yy, 0.15, 0, TAU); } ctx.fill();
        }
        if (s > 3) line(ctx, px, ty + 0.3, px, ty + 1.7, dk, 0.05, env);
        if (snowy) R4(ctx, px - 2.6, ty + 0.3, 5.2, 0.14, snowC);
        else if (dimK && s > 3 && Math.sin(env.t * 2.2 + i) > 0.3) circ(ctx, px, ty + 1.75, Math.max(0.12, px1), '#ff5a4d');
      }
      const xl = Math.max(-far, env.x0 - 2), xr = Math.min(far, env.x1 + 2); if (xr <= xl) return;
      ctx.strokeStyle = rope; ctx.lineWidth = Math.max(0.09, px1 * 0.9); ctx.beginPath(); ctx.moveTo(xl, yAt(xl)); ctx.lineTo(xr, yAt(xr)); ctx.stroke();
      ctx.lineWidth = Math.max(0.05, px1 * 0.6); ctx.beginPath(); ctx.moveTo(xl, yAt(xl) + 0.75); ctx.lineTo(xr, yAt(xr) + 0.75);
      if (s > 1.4) { // the haul rope, sagging between supports and swinging gently
        const a = alpGale(env);
        for (let i = -1; i < sup.length; i++) {
          const A = i < 0 ? -far : sup[i], Bx = i + 1 < sup.length ? sup[i + 1] : far; if (Bx < xl || A > xr) continue;
          const sag = (Bx - A) * 0.013 * (1 + 0.1 * Math.sin(env.t * 1.7 + i * 1.9) + 0.12 * a * Math.sin(env.t * 2.9 + i * 0.7));
          ctx.moveTo(A, yAt(A) - 0.3); ctx.quadraticCurveTo((A + Bx) / 2, yAt((A + Bx) / 2) - 0.3 - sag * 2, Bx, yAt(Bx) - 0.3);
        }
      }
      ctx.stroke();
    } });
    H.cable = { yAt, carY: (x) => yAt(x) - CARS.gondola.h - CARS.gondola.hang, pylons: pyl, xa, xb };
  }

  // ---- big pines beside the lodge, and the lodge itself ----
  const PT = S.plane(zD + 16, 'trees'); H.PT = PT; PT.groundY = 0; PT.groundMat = S.groundMat;
  (o.pines || [[-50, 19], [-56.5, 24], [-73, 21], [-80, 26], [-88, 20], [6, 17], [68, 23], [75, 18], [84, 25], [91, 20]]).forEach((t) => K.pine(S, PT, t[0], t[1], { snow: snowy, col: '#1f3d33' }));
  const PL = S.plane(zD + 6, 'lodge'); H.PL = PL; PL.groundY = 0; PL.groundMat = S.groundMat;
  const dx0 = -36.5, dx1 = 7.5, stairW = 6.2;
  const B = VLY.chalet(S, PL, Object.assign({ x: -34, w: 32, id: 'lodge', seed: sd * 7 + 2, deck: [dx0, dx1] }, o.lodge || {})); H.lodge = B;
  { // stone chimney on the right-hand slope of the roof: coursed stone, a capstone, two clay pots
    const cxx = B.cx + 8.5, cy0 = B.ridge - 8.5 * (6.2 / 16) - 0.4, st = S.tone('#8d8a80', PL), st2 = S.tone('#6f6c64', PL), st3 = S.tone('#a19e93', PL), pot = S.tone('#8a4b33', PL), soot = S.tone('#3a3632', PL), lead = S.tone('#5b6168', PL);
    PL.add({ x0: cxx - 2, x1: cxx + 2, layer: 1, draw(ctx, env) {
      const s = env.s, shx = sunD > 0 ? cxx - 0.85 : cxx + 0.35;
      R4(ctx, cxx - 0.85, cy0, 1.7, 3.6, st); R4(ctx, shx, cy0, 0.5, 3.6, st2);
      if (s > 7) {
        ctx.fillStyle = st2; for (let k = 1; k < 8; k++) ctx.fillRect(cxx - 0.85, cy0 + k * 0.44, 1.7, Math.max(0.035, env.px * 0.6));
        ctx.fillStyle = st3; for (let k = 0; k < 8; k++) ctx.fillRect(cxx - 0.7 + ((k * 7) % 5) * 0.22, cy0 + k * 0.44 + 0.08, 0.42, 0.28);
      }
      poly(ctx, [cxx - 1.1, cy0 + 0.9, cxx + 1.1, cy0 + 0.1, cxx + 1.1, cy0 - 0.3, cxx - 1.1, cy0 + 0.5], lead);   // flashing where it meets the roof
      R4(ctx, cxx - 1.05, cy0 + 3.4, 2.1, 0.4, st2);
      if (s > 4) { R4(ctx, cxx - 0.62, cy0 + 3.8, 0.46, 0.5, pot); R4(ctx, cxx + 0.16, cy0 + 3.8, 0.46, 0.5, pot); R4(ctx, cxx - 0.66, cy0 + 4.2, 0.54, 0.12, soot); R4(ctx, cxx + 0.12, cy0 + 4.2, 0.54, 0.12, soot); }
      if (snowy) R4(ctx, cxx - 1.05, cy0 + 3.8, 2.1, 0.22, S.tone('#f1f5f8', PL));
    } });
    PL.solid(cxx - 0.85, cy0, 1.7, 3.8, 'hard');
    if (o.smoke !== false) VLY.plume(S, PL, cxx, cy0 + 3.9, { layer: 1 });
    H.chimney = { x: cxx, y: cy0 + 3.8 };
  }

  // ---- the yard and the deck (the main plane) ----
  const PD = S.plane(zD, 'deck'); H.PD = PD;
  K.ground(S, PD, { col: meadow, edge: snowy ? '#ffffff' : '#9cc078' });
  H.deckX0 = dx0; H.deckX1 = dx1;
  const padX = 49, doorX = B.winX(B.door), towerX = o.towerX === undefined ? -64 : o.towerX, gateX = o.gateX === undefined ? -62 : o.gateX;
  {
    const T = (hex, self) => S.tone(hex, PD, self);
    const wood = T('#7a5234'), wood2 = T('#5a3c26'), wood3 = T('#8f6744'), rail = T('#3e2b1d'), pathC = T(snowy ? '#d5dde5' : '#b9b09a'), pathL = T(snowy ? '#e3e9ee' : '#c9c1ad'), pathD = T(snowy ? '#b9c3cc' : '#8f8873'), worn = T(snowy ? '#d9e0e7' : darken(meadow, 0.13));
    const stoneC = T('#8d8a80'), stoneD = T('#6f6c64'), boxC = T('#5a3c26'), leaf = T('#4f7f45'), fl1 = T('#b765c4'), fl2 = T('#e79ac0');
    const conc = T(snowy ? '#c9d2da' : '#8f9499'), concD = T(snowy ? '#aab4be' : '#6f757b'), concL = T(snowy ? '#d7dee5' : '#9da2a7'), paint = T('#f4f1e6'), lampC = T('#2a2e36');
    // the lawn: grass everywhere except on the paths and the pad
    const offGrass = (x, y) => (y > -1.75 && y < -0.3 && x > -58 && x < 70) || (Math.pow((x - padX) / 11.4, 2) + Math.pow((y + 1.5) / 1.8, 2) < 1) || (y > -0.6 && Math.abs(x - doorX) < 2.3);
    const turf = alpTurf(S, PD, { seed: sd * 5 + 41, x0: -150, x1: 150, yAt: () => 0, depth: 9.5, top: 0.3, col: meadow, skip: offGrass });
    const R = makeRng(sd * 5 + 3), D = makeRng(sd * 5 + 77), edge = [], peb = [], rocks = [];
    for (let x = -44; x <= 68.01; x += 4) edge.push([x, -0.55 + D.r(-0.07, 0.07), -1.5 + D.r(-0.07, 0.07)]);
    for (let i = 0; i < 150; i++) peb.push([D.r(-44, 68), D.r(-1.45, -0.6), D.r(0.03, 0.06), D.chance(0.5) ? 0 : 1]);
    peb.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < 9; i++) { const x = D.r(-140, 140), y = D.r(-8, -2.4); if (!offGrass(x, y) && Math.abs(x - padX) > 14) rocks.push([x, y, D.r(0.35, 0.8)]); }
    PD.add({ x0: -4000, x1: 4000, layer: 0, draw(ctx, env) { // paths, paving and the meadow's own texture
      const s = env.s;
      turf(ctx, env);
      // a trodden line out to the hunting tower
      ctx.strokeStyle = worn; ctx.lineWidth = 0.55; ctx.beginPath(); ctx.moveTo(-43, -1.0); ctx.quadraticCurveTo((towerX - 43) / 2, -1.5, towerX + 7, -0.5); ctx.stroke();
      // the gravel path along the front of the lodge
      ctx.fillStyle = pathC; ctx.beginPath(); ctx.moveTo(edge[0][0], edge[0][1]); for (let i = 1; i < edge.length; i++) ctx.lineTo(edge[i][0], edge[i][1]); for (let i = edge.length - 1; i >= 0; i--) ctx.lineTo(edge[i][0], edge[i][2]); ctx.closePath(); ctx.fill();
      if (s > 3) { R4(ctx, -43, -1.16, 110, 0.3, pathL); R4(ctx, -44, -1.55, 112, 0.09, pathD); }
      // flagstones from the door and from the foot of the stair down to the path
      poly(ctx, [doorX - 1.6, 0, doorX + 1.6, 0, doorX + 2.0, -0.6, doorX - 2.0, -0.6], pathL); poly(ctx, [dx1 + stairW - 1.5, 0, dx1 + stairW + 1.3, 0, dx1 + stairW + 1.9, -0.6, dx1 + stairW - 2.1, -0.6], pathL);
      if (s > 8) { ctx.fillStyle = pathD; for (const q of [doorX, dx1 + stairW - 0.1]) { ctx.fillRect(q - 1.9, -0.32, 3.8, 0.035); for (let k = -1; k <= 1; k++) ctx.fillRect(q + k * 1.05 - 0.02, -0.6, 0.04, 0.6); } }
      if (s > 14) { for (let c = 0; c < 2; c++) { ctx.fillStyle = c ? pathL : pathD; ctx.beginPath(); for (let i = vlyFrom(peb, env.x0 - 1); i < peb.length && peb[i][0] < env.x1 + 1; i++) { const p = peb[i]; if (p[3] !== c) continue; ctx.moveTo(p[0] + p[2], p[1]); ctx.arc(p[0], p[1], p[2], 0, TAU); } ctx.fill(); } }
      // a few stones lying in the grass
      if (s > 2.5) for (let i = 0; i < rocks.length; i++) { const r = rocks[i]; if (r[0] < env.x0 - 2 || r[0] > env.x1 + 2) continue; ctx.fillStyle = stoneD; ctx.beginPath(); ctx.ellipse(r[0], r[1], r[2], r[2] * 0.42, 0, 0, TAU); ctx.fill(); ctx.fillStyle = stoneC; ctx.beginPath(); ctx.ellipse(r[0] + sunD * r[2] * 0.12, r[1] + r[2] * 0.12, r[2] * 0.8, r[2] * 0.3, 0, 0, TAU); ctx.fill(); }
    } });
    PD.add({ x0: dx0 - 1, x1: dx1 + stairW + 1, layer: 0, draw(ctx, env) {
      const s = env.s;
      // posts on stone pads, with braces up to the deck beam
      for (let px = dx0 + 0.6; px <= dx1 - 0.3; px += 6.1) {
        R4(ctx, px - 0.34, 0, 0.68, 0.2, stoneC); R4(ctx, px - 0.16, 0.2, 0.32, deckY - 0.5, wood2);
        if (s > 12) R4(ctx, sunD > 0 ? px + 0.07 : px - 0.16, 0.2, 0.09, deckY - 0.5, wood);
        line(ctx, px, deckY - 1.5, px + 1.2, deckY - 0.32, wood2, 0.12, env); line(ctx, px, deckY - 1.5, px - 1.2, deckY - 0.32, wood2, 0.12, env);
      }
      // the deck: joist ends under a fascia board, flower boxes hung along it between the posts
      R4(ctx, dx0, deckY - 0.34, dx1 - dx0, 0.34, wood); R4(ctx, dx0, deckY - 0.34, dx1 - dx0, 0.09, wood2);
      if (s > 8) { ctx.fillStyle = wood2; ctx.beginPath(); for (let px = Math.max(dx0 + 0.3, Math.ceil((env.x0 - dx0) / 0.8) * 0.8 + dx0); px < Math.min(dx1, env.x1); px += 0.8) ctx.rect(px, deckY - 0.5, 0.14, 0.16); ctx.fill(); R4(ctx, dx0, deckY - 0.07, dx1 - dx0, 0.07, wood3); }
      if (s > 3.5 && !snowy) {
        for (let px = dx0 + 0.6 + 3.05; px < dx1 - 1; px += 6.1) {
          if (px + 1.4 < env.x0 || px - 1.4 > env.x1) continue;
          R4(ctx, px - 1.2, deckY - 0.62, 2.4, 0.26, boxC);
          if (s > 8) { ctx.fillStyle = leaf; ctx.beginPath(); for (let k = 0; k < 8; k++) { const fx = px - 1.1 + k * 0.315; ctx.moveTo(fx + 0.16, deckY - 0.36); ctx.arc(fx, deckY - 0.36, 0.16, 0, TAU); } ctx.fill(); }
          for (let c = 0; c < 2; c++) { ctx.fillStyle = c ? fl2 : fl1; ctx.beginPath(); for (let k = c; k < 10; k += 2) { const fx = px - 1.1 + k * 0.245, fy = deckY - 0.3 + (k % 3) * 0.035, r = Math.max(0.09, env.px * 0.6); ctx.moveTo(fx + r, fy); ctx.arc(fx, fy, r, 0, TAU); } ctx.fill(); }
        }
      }
      // the stair down to the yard: treads on a stringer
      const n = 9; for (let i = 0; i < n; i++) R4(ctx, dx1 + (i * stairW) / n, 0, stairW / n + 0.02, deckY * (1 - (i + 1) / n) + 0.02, i % 2 ? wood : wood2);
      if (s > 6) { ctx.fillStyle = wood3; for (let i = 0; i < n - 1; i++) ctx.fillRect(dx1 + (i * stairW) / n, deckY * (1 - (i + 1) / n) - 0.05, stairW / n + 0.02, 0.07); }
    } });
    PD.add({ x0: dx0 - 1, x1: dx1 + stairW + 1, layer: 2, draw(ctx, env) { // railing, in front of whoever stands there
      const s = env.s;
      ctx.strokeStyle = rail; ctx.lineWidth = Math.max(0.09, env.px * 0.9);
      ctx.beginPath(); ctx.moveTo(dx0, deckY + 1.02); ctx.lineTo(dx1, deckY + 1.02); ctx.lineTo(dx1 + stairW, 1.02); ctx.moveTo(dx0, deckY); ctx.lineTo(dx0, deckY + 1.02); ctx.stroke();
      if (s > 3.2) {
        ctx.lineWidth = Math.max(0.035, env.px * 0.55); ctx.beginPath();
        for (let px = Math.max(dx0 + 0.5, Math.ceil((env.x0 - dx0) / 0.5) * 0.5 + dx0); px < Math.min(dx1, env.x1 + 0.5); px += 0.5) { ctx.moveTo(px, deckY); ctx.lineTo(px, deckY + 1.02); }
        if (s > 6) { ctx.moveTo(dx0, deckY + 0.13); ctx.lineTo(dx1, deckY + 0.13); for (let i = 1; i < 9; i++) { const px = dx1 + (i * stairW) / 9, py = deckY * (1 - i / 9); ctx.moveTo(px, py); ctx.lineTo(px, py + 1.02); } }
        ctx.stroke();
        if (s > 16) { // each baluster is turned: a small bead half way up
          ctx.fillStyle = rail; ctx.beginPath();
          for (let px = Math.max(dx0 + 0.5, Math.ceil((env.x0 - dx0) / 0.5) * 0.5 + dx0); px < Math.min(dx1, env.x1 + 0.5); px += 0.5) { ctx.moveTo(px, deckY + 0.66); ctx.lineTo(px + 0.045, deckY + 0.57); ctx.lineTo(px, deckY + 0.48); ctx.lineTo(px - 0.045, deckY + 0.57); ctx.closePath(); }
          ctx.fill();
        }
      }
      ctx.lineWidth = Math.max(0.12, env.px); ctx.beginPath(); for (let px = dx0 + 0.6; px <= dx1 + 0.1; px += 6.1) { ctx.moveTo(px, deckY); ctx.lineTo(px, deckY + 1.08); } ctx.stroke();
      if (s > 9) { ctx.fillStyle = rail; for (let px = dx0 + 0.6; px <= dx1 + 0.1; px += 6.1) ctx.fillRect(px - 0.11, deckY + 1.06, 0.22, 0.08); }
    } });
    PD.solid(dx0, deckY - 0.34, dx1 - dx0, 0.34, 'wood');
    H.stairTop = dx1; H.stairFoot = dx1 + stairW;
    H.stairY = (x) => deckY * clamp((dx1 + stairW - x) / stairW, 0, 1);
    if (o.tables !== false) { K.table(S, PD, -26, { y: deckY }); K.table(S, PD, 2.6, { y: deckY, umbrella: '#b3312b' }); }
    // firewood stacked by the stair
    K.box(S, PD, 15.5, 0, 5.2, 1.7, '#8a6a45', { ribs: 0.36, band: 0.14, mat: 'wood' }); H.woodpile = { x: 18.1, y: 1.7 };
    // flag
    if (o.flag !== false) H.flag = VLY.flag(S, PD, o.flagX === undefined ? 27 : o.flagX, 0, 13, o.flagCol || '#b3312b');
    // helipad: a painted disc on the ground, lights, and a windsock
    H.pad = { x: padX, x0: padX - 10, x1: padX + 10 };
    PD.add({ x0: padX - 12, x1: padX + 12, layer: 0, draw(ctx, env) {
      const s = env.s;
      ctx.fillStyle = concD; ctx.beginPath(); ctx.ellipse(padX, -1.6, 10.7, 1.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = conc; ctx.beginPath(); ctx.ellipse(padX, -1.5, 10.5, 1.42, 0, 0, TAU); ctx.fill();
      if (s > 4) {
        ctx.fillStyle = concL; ctx.beginPath(); ctx.ellipse(padX - sunD * 0.6, -1.42, 7.2, 0.84, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = concD; ctx.lineWidth = Math.max(0.05, env.px * 0.6); ctx.beginPath(); ctx.moveTo(padX - 10.3, -1.5); ctx.lineTo(padX + 10.3, -1.5); ctx.moveTo(padX - 3.5, -0.16); ctx.lineTo(padX - 3.5, -2.84); ctx.moveTo(padX + 3.5, -0.16); ctx.lineTo(padX + 3.5, -2.84); ctx.stroke();
      }
      ctx.strokeStyle = paint; ctx.lineWidth = Math.max(0.16, env.px); ctx.beginPath(); ctx.ellipse(padX, -1.5, 8.6, 1.08, 0, 0, TAU); ctx.stroke();
      R4(ctx, padX - 2.1, -2.05, 0.75, 1.1, paint); R4(ctx, padX + 1.35, -2.05, 0.75, 1.1, paint); R4(ctx, padX - 2.1, -1.62, 4.2, 0.24, paint);
      if (s > 5) { // low marker lights round the rim
        ctx.fillStyle = dimK ? '#7dffa8' : T('#4f9a68'); ctx.beginPath();
        for (let k = 0; k < 10; k++) { const an = (k + 0.5) / 10 * TAU, lx = padX + Math.cos(an) * 10.1, ly = -1.5 + Math.sin(an) * 1.34, r = Math.max(0.09, env.px * 0.8); ctx.moveTo(lx + r, ly); ctx.arc(lx, ly, r, 0, TAU); }
        ctx.fill();
      }
      for (const lx of [padX - 10.4, padX + 10.4]) { R4(ctx, lx - 0.07, -1.5, 0.14, 1.9, lampC); circ(ctx, lx, 0.45, Math.max(0.16, env.px * 1.2), Math.sin(env.t * 2.4) > 0 ? '#ff5a4d' : '#7d2a25'); }
    } });
    if (o.sock !== false) H.sock = VLY.sock(S, PD, padX + 14.5, 0, 7.2);
    // the hunting tower, at the edge of the trees on the left
    H.tower = VLY.seat(S, PD, towerX, { id: 'hide', h: 6.5, side: 1 });
    // seeds and fluff riding the wind across the valley at the wind's own speed: the truest tell of all.
    // A scattering for the wide view, and a finer one that only shows once the scope is wound in.
    if (!snowy) {
      const sr = makeRng(sd * 13 + 59), fluff = [], fine = []; for (let i = 0; i < 30; i++) fluff.push([sr.r(0, 320), sr.r(-7, 17), sr.r(0, TAU), sr.r(0.75, 1.25)]);
      for (let i = 0; i < 2; i++) fine.push([sr.f(), sr.f(), sr.r(0, TAU), sr.r(0.8, 1.2)]);
      PD.add({ x0: -4000, x1: 4000, layer: 0, draw(ctx, env) {
        const aw = Math.abs(env.wind); if (aw < 0.5) return;
        const dr = alpDrift(env), dir = env.wind >= 0 ? 1 : -1, al = Math.min(0.75, 0.2 + aw * 0.11), tail = dir * Math.min(0.9, aw * 0.05), r = Math.max(0.035, env.px * 0.75);
        ctx.strokeStyle = 'rgba(255,255,255,' + al.toFixed(3) + ')'; ctx.lineWidth = r * 2; ctx.lineCap = 'round'; ctx.beginPath();
        if (env.s <= 20) for (let i = 0; i < fluff.length; i++) { const f = fluff[i], x = alpWrap(f[0] + dr * f[3], -160, 320); if (x < env.x0 || x > env.x1) continue; const y = f[1] + Math.sin(env.t * 0.9 + f[2]) * 0.5; ctx.moveTo(x, y); ctx.lineTo(x - tail, y + tail * 0.06); }
        else { // a repeating tile of fluff, so there is always a little in view however far in the scope is wound
          const tw = env.s < 34 ? 26 : env.s < 60 ? 14 : 9, thh = tw * 0.55, ix0 = Math.floor(env.x0 / tw), ix1 = Math.floor(env.x1 / tw), iy0 = Math.floor(env.y0 / thh), iy1 = Math.floor(env.y1 / thh);
          for (let ix = ix0; ix <= ix1; ix++) for (let iy = iy0; iy <= iy1; iy++) for (let i = 0; i < fine.length; i++) { const f = fine[i], x = ix * tw + alpWrap(f[0] * tw + dr * f[3] + iy * 5.3, 0, tw), y = iy * thh + f[1] * thh + Math.sin(env.t * 0.9 + f[2] + ix) * 0.3; ctx.moveTo(x, y); ctx.lineTo(x - tail * 0.6, y + tail * 0.04); }
        }
        ctx.stroke(); ctx.lineCap = 'butt';
      } });
    }
  }

  // ---- the slope down to the road ----
  // An alpine meadow: a rail fence along the lip of the yard, boulders, a footpath winding down to
  // the road, a brook that runs down through the grass on the left, a hay barn out on the right.
  const PSL = VLY.hill(S, zD - 35, { name: 'slope', seed: sd + 29, top: -2.6, amp: 2.4, rough: 70, th: 4.2, rows: 2, gap: 2.6, density: 0.5, rowDrop: 1.6, maxH: 4.6, col: darken(meadow, 0.08), treeCol: '#28503d', treeCol2: '#2f5a45', x0: -700, x1: 700, meadow: true, sway: true, meadowDepth: 14.5 });
  H.PSL = PSL;
  {
    const T = (hex, self) => S.tone(hex, PSL, self), post = T('#5a4634'), postL = T('#7a644c'), R = makeRng(sd * 3 + 11), D = makeRng(sd * 3 + 97), rocks = []; for (let i = 0; i < 26; i++) rocks.push([R.r(-150, 150), R.r(1.5, 9), R.r(0.5, 1.5)]);
    const rockC = T(snowy ? '#aab4bf' : '#8b8f8c'), rockD = T(snowy ? '#8894a0' : '#676b69'), rockL = T(snowy ? '#f4f7fa' : '#a5a9a4'), pathC = T(snowy ? '#cfd8e0' : '#a9a487'), water = T(snowy ? '#c9d9e6' : '#8fc3dc', true), foam = T('#f2f8fb', true), bankC = T(snowy ? '#b9c3cc' : darken(meadow, 0.3));
    const barn = T('#6a4b34'), barnD = T('#4a3424'), barnR = T(snowy ? '#eef2f6' : '#33291f'), hay = T('#d2b662');
    const hA = PSL.heightAt;
    // footpath: a few easy bends from the foot of the stair down to the road
    const xg = (gateX - 3.4) * (zD - 35) / (zD - 70), trail = [[27, 0.2], [13, 3.4], [24, 6.6], [8, 9.8], [15, 12.8], [0, 16.5]].map((q) => [xg + q[0], q[1]]);
    // the brook: a wandering ribbon, with stones along it and a little white water where it steps down
    const bx = -98, brook = []; for (let k = 0; k <= 12; k++) { const d = k * 1.4; brook.push([bx + Math.sin(k * 1.3) * 1.6 + k * 0.5, d, 0.3 + k * 0.035]); }
    const bstones = []; for (let k = 1; k < 12; k++) bstones.push([brook[k][0] + (k % 2 ? 1 : -1) * (brook[k][2] + D.r(0.2, 0.5)), brook[k][1] + D.r(-0.3, 0.3), D.r(0.2, 0.42)]);
    const ribbon = (ctx, top, pad) => { // the brook as one smooth band, `pad` wider on each side
      const n = brook.length, e = (k, sg) => brook[k][0] + sg * (brook[k][2] + pad); ctx.beginPath(); ctx.moveTo(e(0, -1), top - brook[0][1]);
      for (let k = 1; k < n - 1; k++) ctx.quadraticCurveTo(e(k, -1), top - brook[k][1], (e(k, -1) + e(k + 1, -1)) / 2, top - (brook[k][1] + brook[k + 1][1]) / 2);
      ctx.lineTo(e(n - 1, -1), top - brook[n - 1][1]); ctx.lineTo(e(n - 1, 1), top - brook[n - 1][1]);
      for (let k = n - 2; k > 0; k--) ctx.quadraticCurveTo(e(k, 1), top - brook[k][1], (e(k, 1) + e(k - 1, 1)) / 2, top - (brook[k][1] + brook[k - 1][1]) / 2);
      ctx.lineTo(e(0, 1), top - brook[0][1]); ctx.closePath(); ctx.fill();
    };
    const hx = 97, hy = () => hA(hx) - 7.2;
    PSL.add({ x0: -400, x1: 400, layer: 0, draw(ctx, env) {
      const s = env.s;
      // footpath
      if (s > 1.5 && env.x0 < xg + 32 && env.x1 > xg - 4) {
        ctx.strokeStyle = pathC; ctx.lineWidth = Math.max(0.55, env.px * 1.1); ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(trail[0][0], hA(trail[0][0]) - trail[0][1]);
        for (let i = 1; i < trail.length; i++) { const p = trail[i - 1], q = trail[i]; ctx.quadraticCurveTo(q[0] + (q[0] > p[0] ? 2.5 : -2.5), hA(q[0]) - (p[1] + q[1]) / 2 - 1.2, q[0], hA(q[0]) - q[1]); }
        ctx.stroke(); ctx.lineJoin = 'miter';
      }
      // brook
      if (s > 1.5 && env.x0 < bx + 16 && env.x1 > bx - 8) {
        const top = hA(bx);
        ctx.fillStyle = bankC; ribbon(ctx, top, 0.2); ctx.fillStyle = water; ribbon(ctx, top, 0);
        if (s > 5) {
          ctx.fillStyle = foam; ctx.beginPath(); for (let k = 0; k < 9; k++) { const u = ((env.t * 0.35 + k / 9) % 1) * 12, i0 = Math.floor(u), f = u - i0, a = brook[i0], b = brook[Math.min(12, i0 + 1)]; ctx.rect(lerp(a[0], b[0], f) + ((k % 3) - 1) * a[2] * 0.5 - 0.06, top - lerp(a[1], b[1], f) - 0.22, 0.12, 0.44); } ctx.fill();
          ctx.fillStyle = rockD; ctx.beginPath(); for (let k = 0; k < bstones.length; k++) { const q = bstones[k]; ctx.moveTo(q[0] + q[2], top - q[1]); ctx.ellipse(q[0], top - q[1], q[2], q[2] * 0.6, 0, 0, TAU); } ctx.fill();
          ctx.fillStyle = rockL; ctx.beginPath(); for (let k = 0; k < bstones.length; k++) { const q = bstones[k]; ctx.moveTo(q[0] + q[2] * 0.7, top - q[1] + q[2] * 0.15); ctx.ellipse(q[0] + sunD * q[2] * 0.1, top - q[1] + q[2] * 0.15, q[2] * 0.7, q[2] * 0.36, 0, 0, TAU); } ctx.fill();
        }
      }
      // hay barn, well off to the right
      if (s > 1.2 && env.x1 > hx - 6 && env.x0 < hx + 6) {
        const y = hy();
        ctx.fillStyle = bankC; ctx.beginPath(); ctx.ellipse(hx - sunD * 0.8, y, 4.2, 0.5, 0, 0, TAU); ctx.fill();
        R4(ctx, hx - 2.9, y, 5.8, 0.5, rockC); R4(ctx, hx - 2.8, y + 0.5, 5.6, 2.4, barn);
        if (s > 5) { ctx.fillStyle = barnD; for (let k = 1; k < 6; k++) ctx.fillRect(hx - 2.8, y + 0.5 + k * 0.4, 5.6, Math.max(0.04, env.px * 0.6)); R4(ctx, hx - 0.9, y + 0.5, 1.8, 1.7, barnD); R4(ctx, hx - 0.75, y + 0.5, 1.5, 1.2, hay); }
        poly(ctx, [hx - 3.6, y + 2.8, hx + 3.6, y + 2.8, hx + 0.2, y + 4.5, hx - 0.2, y + 4.5], barnR);
        if (s > 8 && !snowy) { ctx.fillStyle = rockC; ctx.beginPath(); for (const d of [-2.2, -1.0, 1.1, 2.3]) { const yy = y + 2.95 + (1 - Math.abs(d) / 3.6) * 1.55; ctx.moveTo(hx + d + 0.22, yy); ctx.ellipse(hx + d, yy, 0.22, 0.13, 0, 0, TAU); } ctx.fill(); }
      }
      // a rail fence along the lip of the yard
      ctx.strokeStyle = post; ctx.lineWidth = Math.max(0.1, env.px * 0.8); ctx.beginPath();
      const a = Math.floor((env.x0 - 4) / 4) * 4;
      for (let x = a; x < env.x1 + 4; x += 4) { const y = hA(x), y2 = hA(x + 4); ctx.moveTo(x, y - 0.2); ctx.lineTo(x, y + 1.1); ctx.moveTo(x, y + 0.9); ctx.lineTo(x + 4, y2 + 0.9); ctx.moveTo(x, y + 0.45); ctx.lineTo(x + 4, y2 + 0.45); }
      ctx.stroke();
      if (s > 10) { ctx.strokeStyle = postL; ctx.lineWidth = 0.035; ctx.beginPath(); for (let x = a; x < env.x1 + 4; x += 4) { const y = hA(x), y2 = hA(x + 4); ctx.moveTo(x, y + 0.94); ctx.lineTo(x + 4, y2 + 0.94); ctx.moveTo(x + sunD * 0.03, y - 0.1); ctx.lineTo(x + sunD * 0.03, y + 1.1); } ctx.stroke(); }
      // boulders: a dark foot, a body, a pale top where the light falls
      for (let k = 0; k < 3; k++) {
        if (k === 2 && s < 5) break;
        ctx.fillStyle = k === 0 ? rockD : k === 1 ? rockC : rockL; ctx.beginPath();
        for (let i = 0; i < rocks.length; i++) { const r = rocks[i]; if (r[0] < env.x0 - 3 || r[0] > env.x1 + 3) continue; const y = hA(r[0]) - r[1]; if (k === 0) { ctx.moveTo(r[0] + r[2] * 1.15, y); ctx.ellipse(r[0], y, r[2] * 1.15, r[2] * 0.22, 0, 0, TAU); } else if (k === 1) { ctx.moveTo(r[0] + r[2], y); ctx.ellipse(r[0], y, r[2], r[2] * 0.55, 0, 0, Math.PI); } else { ctx.moveTo(r[0] + sunD * r[2] * 0.2 + r[2] * 0.6, y + r[2] * 0.2); ctx.ellipse(r[0] + sunD * r[2] * 0.2, y + r[2] * 0.2, r[2] * 0.6, r[2] * 0.3, 0, 0, Math.PI); } }
        ctx.fill();
      }
    } });
  }

  // ---- the mountain road ----
  // Worn tarmac with wheel tracks, patches and cracks, painted edge lines, a gravel shoulder,
  // snow poles along the far verge, and the gate: a boarded hut, stone posts and a counterweighted boom.
  const PR = S.plane(zD - 70, 'road'); H.PR = PR;
  K.ground(S, PR, { y: roadY, col: snowy ? '#dfe6ec' : darken(meadow, 0.16), noEdge: true });
  H.gate = { x: gateX };
  {
    const T = (hex, self) => S.tone(hex, PR, self), tarHex = snowy ? '#8f9aa5' : '#4a4f57';
    const tar = T(tarHex), tar2 = T(snowy ? '#a8b2bc' : '#5a6068'), tarD = T(darken(tarHex, 0.16)), tarL = T(lighten(tarHex, 0.09)), paint = T('#e9e2c4'), poleA = T('#e2572b'), poleB = T('#1d2026'), bank = T(snowy ? '#f4f7fa' : '#93b274'), grav = T(snowy ? '#c3ccd4' : '#8b8778');
    const hut = T('#6d5a45'), hutD = T('#4f4133'), hutL = T('#836e56'), hutR = T(snowy ? '#eef2f6' : '#3d302a'), hutE = T('#2a211d'), red = T('#c8372d'), white = T('#f1ede2'), stoneC = T('#8d8a80'), stoneD = T('#6f6c64'), steel = T('#2a2e36'), glassC = T(S.pal.glass), winLit = T('#ffd98a', true);
    const D = makeRng(sd * 7 + 131), patch = [], crack = [], drains = [];
    for (let i = 0; i < 26; i++) patch.push([D.r(-170, 170), roadY - D.r(1.2, 4.9), D.r(1.6, 5), D.r(0.5, 1.3), D.chance(0.5) ? 0 : 1]);
    patch.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < 30; i++) { const x = D.r(-170, 170), y = roadY - D.r(0.2, 4.9), c = [x, y]; for (let k = 1; k < 5; k++) c.push(x + k * D.r(0.5, 1.1), y + D.r(-0.35, 0.35)); crack.push(c); }
    crack.sort((a, b) => a[0] - b[0]);
    for (let i = -3; i <= 3; i++) drains.push(i * 46 + 9);
    PR.add({ x0: -4000, x1: 4000, layer: 0, draw(ctx, env) {
      const s = env.s, xa = env.x0 - 2, w = env.x1 - env.x0 + 4;
      R4(ctx, xa, roadY - 5.6, w, 6.5, tar); R4(ctx, xa, roadY + 0.72, w, 0.22, bank);
      if (s > 2.5) { // the lanes are worn darker where the wheels run; old repairs show paler or darker
        ctx.fillStyle = tarD; for (const yy of [roadY - 0.2, roadY - 1.55, roadY - 3.3, roadY - 4.65]) ctx.fillRect(xa, yy, w, 0.4);
        for (let c = 0; c < 2; c++) { ctx.fillStyle = c ? tarL : tarD; ctx.beginPath(); for (let i = vlyFrom(patch, env.x0 - 6); i < patch.length && patch[i][0] < env.x1 + 1; i++) { const p = patch[i]; if (p[4] === c) ctx.rect(p[0], p[1], p[2], p[3]); } ctx.fill(); }
      }
      if (s > 8) {
        ctx.strokeStyle = tarD; ctx.lineWidth = Math.max(0.03, env.px * 0.6); ctx.beginPath();
        for (let i = vlyFrom(crack, env.x0 - 6); i < crack.length && crack[i][0] < env.x1 + 1; i++) { const c = crack[i]; ctx.moveTo(c[0], c[1]); for (let k = 2; k < c.length; k += 2) ctx.lineTo(c[k], c[k + 1]); }
        ctx.stroke();
        ctx.fillStyle = steel; for (let i = 0; i < drains.length; i++) ctx.fillRect(drains[i], roadY + 0.3, 0.9, 0.2);
      }
      // gravel shoulders, edge lines and the centre line
      R4(ctx, xa, roadY - 5.6, w, 0.35, tar2); R4(ctx, xa, roadY + 0.58, w, 0.16, grav);
      ctx.fillStyle = paint;
      if (s > 2.5) { ctx.fillRect(xa, roadY + 0.38, w, Math.max(0.1, env.px * 0.7)); ctx.fillRect(xa, roadY - 5.12, w, Math.max(0.1, env.px * 0.7)); }
      const a = Math.floor(env.x0 / 9) * 9; for (let x = a; x < env.x1; x += 9) ctx.fillRect(x, roadY - 2.6, 3.6, Math.max(0.2, env.px));
      // marker poles along the far verge
      const b = Math.floor(env.x0 / 14) * 14; for (let x = b; x < env.x1 + 14; x += 14) { R4(ctx, x - 0.07, roadY + 0.9, 0.14, 1.5, poleA); R4(ctx, x - 0.07, roadY + 1.9, 0.14, 0.3, poleB); if (snowy) R4(ctx, x - 0.12, roadY + 2.4, 0.24, 0.1, white); }
      // the gate: a hut, two stone posts and a striped boom (raised)
      if (env.x1 > gateX - 8 && env.x0 < gateX + 9) {
        R4(ctx, gateX - 5.2, roadY + 0.9, 3.4, 2.7, hut);
        if (s > 6) { ctx.fillStyle = hutD; for (let xx = gateX - 5.2 + 0.34; xx < gateX - 1.8; xx += 0.34) ctx.fillRect(xx, roadY + 0.9, Math.max(0.03, env.px * 0.5), 2.7); R4(ctx, gateX - 5.2, roadY + 0.9, 3.4, 0.3, stoneD); R4(ctx, gateX - 3.3, roadY + 1.2, 1.1, 2.0, hutD); R4(ctx, gateX - 3.2, roadY + 1.2, 0.9, 1.9, hutL); R4(ctx, gateX - 2.52, roadY + 2.1, 0.1, 0.1, steel); }
        R4(ctx, gateX - 4.72, roadY + 1.88, 1.34, 1.24, hutE); R4(ctx, gateX - 4.6, roadY + 2.0, 1.1, 1.0, dimK ? winLit : glassC);
        if (s > 8) { R4(ctx, gateX - 4.08, roadY + 2.0, 0.06, 1.0, hutE); R4(ctx, gateX - 4.6, roadY + 2.47, 1.1, 0.06, hutE); }
        poly(ctx, [gateX - 5.6, roadY + 3.6, gateX - 1.4, roadY + 3.6, gateX - 1.9, roadY + 4.25, gateX - 5.1, roadY + 4.25], hutR);
        if (s > 5) { R4(ctx, gateX - 5.6, roadY + 3.52, 4.2, 0.1, hutE); R4(ctx, gateX - 2.6, roadY + 4.25, 0.22, 0.6, steel); }
        R4(ctx, gateX - 0.5, roadY + 0.2, 1.0, 2.5, stoneC); R4(ctx, gateX - 0.65, roadY + 2.6, 1.3, 0.28, stoneD);
        if (s > 6) { ctx.fillStyle = stoneD; for (let k = 1; k < 5; k++) ctx.fillRect(gateX - 0.5, roadY + 0.2 + k * 0.5, 1.0, Math.max(0.03, env.px * 0.5)); R4(ctx, gateX + (sunD > 0 ? -0.5 : 0.22), roadY + 0.2, 0.28, 2.4, stoneD); }
        if (snowy) { R4(ctx, gateX - 0.65, roadY + 2.88, 1.3, 0.16, white); }
        ctx.save(); ctx.translate(gateX, roadY + 2.0); ctx.rotate(o.gateShut ? 0.02 : 1.05);
        R4(ctx, -1.1, -0.2, 0.9, 0.4, steel);   // counterweight
        for (let i = 0; i < 6; i++) R4(ctx, 0.2 + i * 1.05, -0.11, 1.05, 0.22, i % 2 ? white : red);
        ctx.restore();
        circ(ctx, gateX, roadY + 2.0, 0.17, steel);
        if (dimK && s > 3 && !env.nv) { // the hut window throws a little warmth
          const gx = gateX - 4.05, gy = roadY + 2.5; ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(gx, gy, 0.3, gx, gy, 2.6); g.addColorStop(0, 'rgba(255,205,130,0.22)'); g.addColorStop(1, 'rgba(255,205,130,0)'); ctx.fillStyle = g; ctx.fillRect(gx - 2.6, gy - 2.6, 5.2, 5.2); ctx.globalCompositeOperation = 'source-over';
        }
      }
    } });
    PR.solid(gateX - 5.2, roadY + 0.9, 3.4, 2.7, 'wood'); PR.solid(gateX - 0.5, roadY, 1.0, 2.7, 'hard');
  }

  // ---- the bank on the near side of the road ----
  const PN = VLY.hill(S, zD - 95, { name: 'bank', seed: sd + 37, top: bankY, amp: 1.6, rough: 60, th: 4.8, rows: 2, gap: 1.7, density: 0.62, rowDrop: 1.3, maxH: 5.2, col: snowy ? '#e4eaef' : darken(meadow, 0.24), treeCol: '#234a39', treeCol2: '#2c5843', x0: -700, x1: 700, meadow: true, sway: true, meadowDepth: 11 });
  H.PN = PN;

  // ---- pine tops on the shooter's own slope, right at the bottom of the view ----
  // The nearest trees of all, so they show the wind best: their tops lean with it and nod.
  if (o.near !== false) {
    const zF = Math.max(60, zR * 0.3), PF = S.plane(zF, 'near'); H.PF = PF;
    const aB = (S.bounds.y0 - E) / zR, tipY = lay(aB + 0.012, zF), col = S.tone('#16302a', PF), col2 = S.tone('#1d3a31', PF), lit = S.tone('#2a4a3c', PF), cap = S.tone('#f1f5f8', PF), R = makeRng(sd * 19 + 5), D = makeRng(sd * 19 + 71), TT = [];
    for (let x = -zF * 0.5; x < zF * 0.5; x += R.r(2.4, 5.5)) { const h = R.r(11, 19); TT.push([x, tipY - h - R.r(0, 6), h, D.r(0, TAU)]); }
    PF.add({ x0: -zF, x1: zF, layer: 2, draw(ctx, env) {
      R4(ctx, env.x0 - 2, tipY - 420, env.x1 - env.x0 + 4, 420 - 9.5, col);
      const a = alpGale(env), dir = env.wind >= 0 ? 1 : -1, lean = dir * a * 0.045, osc = 0.005 + 0.02 * a, wt = env.t * (1.1 + a * 2.2), i0 = vlyFrom(TT, env.x0 - 6);
      for (let k = 0; k < 2; k++) {
        ctx.fillStyle = k ? col2 : col; ctx.beginPath(); for (let i = i0 + ((i0 + k) % 2); i < TT.length && TT[i][0] < env.x1 + 6; i += 2) { const t = TT[i]; alpSpruce(ctx, t[0], t[1], t[2], t[2] * 0.22, 7, t[2] * (lean + osc * Math.sin(wt + t[3])), 0); } ctx.fill();
      }
      ctx.fillStyle = lit; ctx.beginPath(); for (let i = i0; i < TT.length && TT[i][0] < env.x1 + 6; i++) { const t = TT[i]; alpSpruceLit(ctx, t[0], t[1], t[2], t[2] * 0.22, 7, t[2] * (lean + osc * Math.sin(wt + t[3])), 0, sunD); } ctx.fill();
      if (snowy) { ctx.fillStyle = cap; ctx.beginPath(); for (let i = i0; i < TT.length && TT[i][0] < env.x1 + 6; i++) { const t = TT[i]; alpSpruceSnow(ctx, t[0], t[1], t[2], t[2] * 0.22, 7, t[2] * (lean + osc * Math.sin(wt + t[3])), 0); } ctx.fill(); }
    } });
  }

  // ---- placements ----
  H.deck = (x, extra) => Object.assign({ plane: PD, x, y: deckY, zone: 'deck', room: null, behind: false }, extra || {});
  H.yard = (x, extra) => Object.assign({ plane: PD, x, y: 0, zone: 'yard', room: null, behind: false }, extra || {});
  H.road = (x, extra) => Object.assign({ plane: PR, x, y: roadY, zone: 'road', room: null, behind: false }, extra || {});
  H.inLodge = (f, c, dx, extra) => { const op = B.win(f, c); return Object.assign({ plane: PL, x: B.winX(c) + (dx || 0), y: B.floorY(f), room: op.room, zone: op.room, behind: true }, extra || {}); };
  // A tall pine planted part of the way across the valley so that, from the
  // given eye position, it hides the spot (x, y) on the deck plane. From any
  // other position it hides something else, or nothing.
  H.screenPine = (eye, x, y, oo) => {
    oo = oo || {}; const f = oo.f || 0.55, ez = eye[2] || 0, zt = ez + (zD - ez) * f;
    let PS = H.PScreen && H.PScreen.z === zt ? H.PScreen : null;
    if (!PS) { PS = H.PScreen = S.plane(zt, 'screen'); }
    const tx = eye[0] + (x - eye[0]) * f, ty = eye[1] + (y - eye[1]) * f, h = oo.h || 30, by = ty + (oo.above === undefined ? 14 : oo.above) * f - h, w = h * (oo.wide || 0.24), hex = oo.col || '#1c382f', col = S.tone(hex, PS), lit = S.tone(mix(lighten(hex, 0.1), '#9fb86a', 0.1), PS), dkc = S.tone(darken(hex, 0.25), PS), cap = S.tone('#f1f5f8', PS);
    // The outline is exactly the old one, because the branches really do stop a bullet (see the solids
    // below). Only the inside is new: a lighter sunny side and a line of shade under each tier.
    PS.add({ x0: tx - w - 1, x1: tx + w + 1, layer: 2, draw(ctx, env) {
      const y0 = by + h * 0.12, hh = h * 0.88;
      ctx.fillStyle = col; ctx.beginPath(); vlyPine(ctx, tx, y0, hh, w); ctx.fill(); ctx.fillRect(tx - h * 0.018, by - 60, h * 0.036, 60 + h * 0.14);
      if (env.s * h > 60) {
        ctx.fillStyle = lit; ctx.beginPath(); ctx.moveTo(tx, y0 + hh); ctx.lineTo(tx + sunD * w * 0.42, y0 + hh * 0.62); ctx.lineTo(tx + sunD * w * 0.2, y0 + hh * 0.62); ctx.lineTo(tx + sunD * w * 0.72, y0 + hh * 0.33); ctx.lineTo(tx + sunD * w * 0.36, y0 + hh * 0.33); ctx.lineTo(tx + sunD * w, y0); ctx.lineTo(tx + sunD * w * 0.38, y0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = dkc; ctx.beginPath(); for (const q of [[0.62, 0.42, 0.2], [0.33, 0.72, 0.36]]) { ctx.moveTo(tx - w * q[1], y0 + hh * q[0]); ctx.lineTo(tx + w * q[1], y0 + hh * q[0]); ctx.lineTo(tx + w * q[2], y0 + hh * (q[0] + 0.035)); ctx.lineTo(tx - w * q[2], y0 + hh * (q[0] + 0.035)); ctx.closePath(); } ctx.fill();
      }
      if (snowy) { ctx.fillStyle = cap; ctx.beginPath(); ctx.moveTo(tx, by + h); ctx.lineTo(tx - w * 0.4, by + h * 0.69); ctx.lineTo(tx + w * 0.4, by + h * 0.69); ctx.closePath(); ctx.fill(); } } });
    // the branches stop a bullet as well as the eye (heavy rounds go through)
    PS.solid(tx - w * 0.95, by + h * 0.12, w * 1.9, h * 0.3, 'wood'); PS.solid(tx - w * 0.68, by + h * 0.42, w * 1.36, h * 0.25, 'wood'); PS.solid(tx - w * 0.3, by + h * 0.67, w * 0.6, h * 0.2, 'wood'); PS.solid(tx - h * 0.018, by - 60, h * 0.036, 60 + h * 0.14, 'wood');
    return { x: tx, top: by + h, w, plane: PS };
  };
  return H;
};

// ---- thin cover, hung in front of what it hides -----------------------------------------------
// Used by the three armour-piercing contracts (c3m8, c4m8, c5m8). A bullet tests the people on a
// plane before the walls on that same plane, so anything that is meant to stand between a round
// and a person must sit on a plane of its own, a little nearer the shooter. K.coverPlane makes
// one just in front of plane PB. Everything on it is given in PB's own coordinates and scaled
// about the shooter's eye, so from that position it lines up exactly with what is behind it.
//   C.x(x), C.y(y)       PB coordinates to cover-plane coordinates
//   C.solid(x,y,w,h,mat) a solid, given in PB coordinates
//   C.add(x0,x1,layer,draw)  draw(ctx, env) works in PB coordinates; env.s and env.px are PB's
K.coverPlane = function (S, PB, z, eye) {
  const P = S.plane(z, PB.name + ' cover'), ez = eye[2] || 0, k = (z - ez) / (PB.z - ez), ox = eye[0] * (1 - k), oy = eye[1] * (1 - k);
  const C = { P, PB, k, ox, oy };
  C.x = (x) => ox + x * k; C.y = (y) => oy + y * k;
  C.solid = (x, y, w, h, mat) => P.solid(C.x(x), C.y(y), w * k, h * k, mat);
  const e2 = {};
  C.add = (x0, x1, layer, draw) => P.add({ x0: C.x(x0), x1: C.x(x1), layer, draw(ctx, env) {
    Object.assign(e2, env);
    e2.s = env.s * k; e2.px = env.px / k; e2.x0 = (env.x0 - ox) / k; e2.x1 = (env.x1 - ox) / k; e2.y0 = (env.y0 - oy) / k; e2.y1 = (env.y1 - oy) / k;
    e2.text = (c2, str, x, y, size, col, align, glow) => env.text(c2, str, C.x(x), C.y(y), size * k, col, align, glow);
    ctx.save(); ctx.transform(k, 0, 0, k, ox, oy); draw(ctx, e2); ctx.restore();
  } });
  return C;
};

// Breath on a cold morning: a small white puff from a person's mouth every few seconds,
// drifting off with the wind. It shows where somebody's head is, even behind boards.
function covBreath(ctx, env, a, t, k) {
  if (!a || a.dead || a.gone || a.hidden) return;
  const per = 3.1 + (a.seed % 1) * 0.6, u = ((t + a.seed * 2.3) % per) / 1.7;
  if (u >= 1) return;
  const J = actorJoints(a), hx = a.x + J.head[0] + (a.face || 1) * 0.16, hy = a.y + J.head[1] - 0.04, dr = env.wind * 0.16 * u + (a.face || 1) * 0.12 * u;
  ctx.fillStyle = '#f4f6f8';
  for (let i = 0; i < 3; i++) {
    const v = clamp(u * 1.3 - i * 0.15, 0, 1); if (v <= 0) continue;
    ctx.globalAlpha = (1 - v) * 0.6 * (k || 1); ctx.beginPath(); ctx.arc(hx + dr + i * 0.05, hy + v * 0.2 + i * 0.03, 0.05 + v * 0.13, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---- the hunting tower, boarded in (c3m8) ------------------------------------------------------
// After the lookout in the open tower was shot, the lodge nailed old fence boards across the
// front of it, leaving a slot under the eaves for air. The boards are 'wood': ordinary rounds
// stop in them, armour-piercing ones go through. Whoever is inside stands on the deck plane
// behind them as an ordinary person in the open, so a round that gets through finds them
// wherever they are. Through the gaps between the boards they show in thin stripes, and on a
// cold morning their breath comes out through the cracks.
//   H        the valley handles (uses H.tower, H.PD, H.zD)
//   o.eye    the shooting position, [x, y, z]
//   o.sim()  returns the running simulation, or null (for breath and the binoculars)
//   o.breath ids of the people whose breath shows; o.glass the id of the man with binoculars
// Returns { C, inside(dx, extra) }: inside() is a placement on the tower floor, zone 'boards'.
K.boardedSeat = function (S, H, o) {
  o = o || {};
  const T = H.tower, fl = T.floor, w = T.w, x0 = T.x - w / 2 - 0.08, x1 = T.x + w / 2 + 0.08, yP = fl - 0.28, yB = fl + 0.95, yTop = fl + 1.86;
  const C = K.coverPlane(S, H.PD, H.zD - 0.9, o.eye || [0, H.eye, 0]), P = C.P, PB = H.PD;
  const tn = (hex) => S.tone(hex, PB);
  const wood = tn('#7d5d3c'), woodL = tn('#93714b'), dark = tn('#4d3929'), darker = tn('#3a2b1f'), nail = tn('#2a2e36');
  const old = ['#7b7066', '#857a6c', '#6f665d', '#8a7f72'].map(tn), oldD = tn('#4a433d'), oldL = tn('#a19583'), rust = tn('#6a4832'), lens = tn('#15171b');
  // the boards: grey old fence planks of uneven width, nailed on in a hurry, the odd one askew
  const D = makeRng(Math.floor(-T.x * 13) + 4041), boards = [];
  for (let y = yB + 0.02; y < yTop - 0.06;) { const h = Math.min(yTop - y, D.r(0.15, 0.2)); boards.push({ y, h: h - 0.055, l: x0 - D.r(0.02, 0.16), r: x1 + D.r(0.0, 0.18), tilt: D.chance(0.3) ? D.r(-0.03, 0.03) : 0, c: D.i(0, 3), knot: D.r(0.15, 0.85), n1: D.r(0.08, 0.2), n2: D.r(0.08, 0.2) }); y += h; }
  C.add(x0 - 1, x1 + 1, 2, (ctx, env) => {
    if (yTop + 0.6 < env.y0 || yP > env.y1) return;
    const s = env.s, fine = s > 12;
    // the old parapet, exactly where it was, so nobody inside shows through it
    R4(ctx, T.x - w / 2 - 0.35, fl - 0.28, w + 0.7, 0.28, dark);
    R4(ctx, T.x - w / 2, fl, w, 0.95, wood);
    if (s > 3) { ctx.fillStyle = dark; ctx.beginPath(); for (let xx = T.x - w / 2 + 0.45; xx < T.x + w / 2; xx += 0.45) ctx.rect(xx, fl, Math.max(0.04, env.px * 0.6), 0.95); ctx.fill(); }
    if (fine) { ctx.fillStyle = woodL; ctx.beginPath(); for (let kk = 0; kk < 8; kk += 3) ctx.rect(T.x - w / 2 + kk * 0.45 + 0.06, fl, 0.33, 0.95); ctx.globalAlpha = 0.6; ctx.fill(); ctx.globalAlpha = 1; }
    R4(ctx, T.x - w / 2 - 0.1, fl + 0.9, w + 0.2, 0.12, dark);
    // the corner posts the boards are nailed to
    R4(ctx, T.x - w / 2 - 0.07, fl, 0.14, 2.3, darker); R4(ctx, T.x + w / 2 - 0.07, fl, 0.14, 2.3, darker);
    // the boards themselves, with daylight between them
    for (let i = 0; i < boards.length; i++) {
      const b = boards[i];
      ctx.save(); if (b.tilt) { ctx.translate(T.x, b.y + b.h / 2); ctx.rotate(b.tilt); ctx.translate(-T.x, -(b.y + b.h / 2)); }
      ctx.fillStyle = old[b.c]; ctx.fillRect(b.l, b.y, b.r - b.l, b.h);
      if (s > 5) {
        ctx.fillStyle = oldD; ctx.fillRect(b.l, b.y, b.r - b.l, Math.max(0.018, env.px * 0.7));                                   // shade under the board above
        ctx.fillStyle = oldL; ctx.fillRect(b.l, b.y + b.h - Math.max(0.015, env.px * 0.6), b.r - b.l, Math.max(0.015, env.px * 0.6)); // lit top edge
      }
      if (fine) {
        // grain, a knot, and the nails into the corner posts (one weeping rust)
        ctx.strokeStyle = oldD; ctx.lineWidth = Math.max(0.008, env.px * 0.5); ctx.globalAlpha = 0.5; ctx.beginPath();
        for (let g = 1; g < 3; g++) { const gy = b.y + (b.h * g) / 3 + Math.sin(g + i) * 0.01; ctx.moveTo(b.l + 0.1, gy); ctx.quadraticCurveTo(T.x, gy + 0.012 * (g % 2 ? 1 : -1), b.r - 0.1, gy); }
        ctx.stroke(); ctx.globalAlpha = 1;
        ctx.fillStyle = oldD; ctx.beginPath(); ctx.ellipse(lerp(b.l, b.r, b.knot), b.y + b.h * 0.5, 0.05, 0.025, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = nail; ctx.beginPath(); for (const nx of [T.x - w / 2, T.x + w / 2]) { ctx.rect(nx - 0.02, b.y + b.h * 0.3, 0.035, 0.035); ctx.rect(nx - 0.02, b.y + b.h * 0.62, 0.035, 0.035); } ctx.fill();
        if (i % 3 === 1) { ctx.fillStyle = rust; ctx.globalAlpha = 0.45; ctx.fillRect(T.x + w / 2 - 0.02, b.y + b.h * 0.05, 0.03, b.h * 0.28); ctx.globalAlpha = 1; }
      }
      ctx.restore();
    }
    // breath through the cracks, and the binoculars pushed into a gap when he looks out
    const sim = o.sim && o.sim(); if (!sim) return;
    if (o.glass) {
      const a = sim.byId[o.glass];
      if (a && !a.dead && !a.gone && a.zone === 'boards' && a.anim === 'look' && a.goal === null) {
        const J = actorJoints(a), ex = a.x + J.head[0] + a.face * 0.05, ey = a.y + J.head[1] + 0.03, gl = Math.pow(Math.max(0, Math.sin(env.t * 1.3 + a.seed)), 10);
        ctx.fillStyle = lens; ctx.beginPath(); ctx.ellipse(ex, ey, 0.16, 0.065, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#c9d6e2'; ctx.beginPath(); ctx.arc(ex - 0.07, ey, 0.038, 0, TAU); ctx.arc(ex + 0.07, ey, 0.038, 0, TAU); ctx.fill();
        if (gl > 0.02) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = gl; ctx.fillStyle = '#fff6dc'; ctx.beginPath(); ctx.arc(ex - 0.07, ey, 0.09, 0, TAU); ctx.arc(ex + 0.07, ey, 0.09, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      }
    }
    (o.breath || []).forEach((id) => { const a = sim.byId[id]; if (a && a.zone === 'boards') covBreath(ctx, env, a, env.t, 1); });
  });
  // boards and parapet stop a round; only armour-piercing rounds go through. The slot
  // under the eaves is left open, as it is.
  C.solid(x0 - 0.1, yP, x1 - x0 + 0.2, yTop - yP, 'wood');
  return { C, x0, x1, yTop, inside: (dx, extra) => Object.assign({ plane: PB, x: T.x + (dx || 0), y: fl, zone: 'boards', room: null, behind: false }, extra || {}) };
};
