// ---------------------------------------------------------------------------
// The spotting scope: a wide binocular view for finding people and working
// out who is who, without the rifle. Tap a person to TAG them (up to four).
// A tagged person keeps an outline in their own colour in the rifle scope too,
// a sight cone showing where they can see (red when they could see whoever is
// under your crosshair fall, where they stand now), and, in the binoculars, a checklist of
// the brief's description against what they are wearing: "red hat band: yes,
// case: no".
// All of it is drawn over the picture from here, and none of it changes the
// mission: it only reads the simulation (Sim.canSee answers the cone).
// ---------------------------------------------------------------------------
const SPOT_ZOOM = 1.7;
const TAG_COLS = ['#5fe0ff', '#ff6fd8', '#b6f25a', '#ffd84a'];
const BAG_NAME = { case: 'case', duffel: 'duffel bag', clip: 'clipboard', umbrella: 'umbrella', cane: 'cane', backpack: 'backpack', shopping: 'shopping bag', cup: 'cup', box: 'box', paper: 'paper bag', flowers: 'flowers', guitar: 'guitar case' };

const Spotter = CB.Spotter = {};

// ---- what the brief says the target looks like ----------------------------------------------
// The features of a target's look that the briefing, objective or intel actually mention, each
// with a test another person can be checked against. Colours are compared by their plain name
// ("red", "grey"), the way the brief puts them.
Spotter.clues = function (M, a, flags) {
  const L = a.look || {}, txt = (['objective', 'brief', 'intel'].map((k) => { const v = M[k]; const s = typeof v === 'function' ? v(flags || {}) : v; return Array.isArray(s) ? s.join(' ') : s || ''; }).join(' ')).toLowerCase();
  const has = (...w) => w.some((x) => txt.indexOf(x) >= 0);
  const cn = (c) => colourName(c || '#2c2f36'), out = [];
  const add = (label, test) => out.push({ label, test });
  if (L.hat && HAT_NAME[L.hat]) {
    const noun = HAT_NAME[L.hat], words = { hat: ['hat'], cap: ['cap'], beanie: ['beanie', 'hat'], 'hard hat': ['hard hat', 'hardhat', 'helmet'], 'top hat': ['top hat', 'white hat', 'hat'], hood: ['hood', 'raincoat'], 'straw hat': ['straw', 'hat'], 'peaked cap': ['cap', 'police'], helmet: ['helmet'], beret: ['beret'] }[noun] || [noun];
    if (has(...words)) add(cn(L.hatCol) + ' ' + noun, (q) => q.hat === L.hat && cn(q.hatCol) === cn(L.hatCol));
  }
  if (L.hatBand && has('band')) add(cn(L.hatBand) + ' hat band', (q) => !!q.hatBand && cn(q.hatBand) === cn(L.hatBand));
  if (L.coat && has('coat', 'jacket', 'raincoat', 'suit', 'oilskin')) add(cn(L.coat) + (L.long ? ' long coat' : ' coat'), (q) => !!q.coat && cn(q.coat) === cn(L.coat) && !!q.long === !!L.long);
  if (L.dress && has('dress', 'skirt')) add(cn(L.dress) + ' dress', (q) => !!q.dress && cn(q.dress) === cn(L.dress));
  if (L.bag && BAG_NAME[L.bag] && has(BAG_NAME[L.bag].split(' ')[0])) add((L.bag === 'umbrella' || L.bag === 'duffel' ? cn(L.bagCol) + ' ' : '') + BAG_NAME[L.bag], (q) => q.bag === L.bag && (L.bag !== 'umbrella' && L.bag !== 'duffel' || cn(q.bagCol) === cn(L.bagCol)));
  if (L.glasses && has('glasses', 'shades')) add(L.glasses === 'shades' ? 'dark glasses' : 'glasses', (q) => !!q.glasses && (q.glasses === 'shades') === (L.glasses === 'shades'));
  if (L.hair === 'white' && has('white hair')) add('white hair', (q) => q.hair === 'white');
  if (L.beard && has('beard')) add('beard', (q) => !!q.beard);
  if (L.scarf && has('scarf')) add(cn(L.scarf) + ' scarf', (q) => !!q.scarf && cn(q.scarf) === cn(L.scarf));
  if (L.tie && has('tie')) add(cn(L.tie) + ' tie', (q) => !!q.tie && cn(q.tie) === cn(L.tie));
  if (L.vest && has('vest')) add(cn(L.vest) + ' vest', (q) => !!q.vest && cn(q.vest) === cn(L.vest));
  if (L.build === 'big' && has('big', 'heavy')) add('big build', (q) => q.build === 'big');
  if (L.phones && has('ear defender', 'headphone')) add('ear defenders', (q) => !!q.phones);
  return out;
};
// How a tagged person measures up: against whichever target they match best.
Spotter.check = function (sim, a) {
  const ids = sim.rules.kill || [], L = a.look || {};
  let best = null;
  ids.forEach((id) => {
    const t = sim.byId[id]; if (!t) return;
    const cl = Spotter.clues(sim.M, t, sim.flags); if (!cl.length) return;
    const rows = cl.map((c) => ({ label: c.label, ok: !!c.test(L) })), n = rows.filter((r) => r.ok).length;
    if (!best || n / rows.length > best.n / best.rows.length) best = { rows, n, of: id };
  });
  return best;
};

// A tagged person in plain words, without giving away who they are: "Dark hat, grey long coat".
Spotter.desc = function (a) {
  const L = (a && a.look) || {}, cn = (c) => colourName(c || '#2c2f36'), p = [];
  if (L.hat && HAT_NAME[L.hat]) p.push(cn(L.hatCol) + ' ' + HAT_NAME[L.hat]); else if (L.hair === 'white') p.push('white hair');
  if (L.coat) p.push(cn(L.coat) + (L.long ? ' long coat' : ' coat')); else if (L.dress) p.push(cn(L.dress) + ' dress'); else if (L.vest) p.push(cn(L.vest) + ' vest');
  if (p.length < 2 && L.bag && BAG_NAME[L.bag]) p.push(BAG_NAME[L.bag]);
  const s = p.length ? p.join(', ') : 'No hat, plain clothes';
  return s[0].toUpperCase() + s.slice(1);
};
// Whoever is under the crosshair (or the middle of the binoculars) right now, if anyone: the
// person a tagged watcher's cone is checked against.
Spotter.aimed = function (sim) {
  const a = sim.aimNow(), r = sim.rangeAt(a.x, a.y);
  if (!r) return null;
  if (r.actor && !r.actor.dead) return r.actor;
  let best = null, bd = 2;
  sim.actors.forEach((q) => { if (q.dead || q.gone || q.hidden || q.plane !== r.P) return; const d = Math.abs(q.x - r.x) + (r.y < q.y - 0.3 || r.y > q.y + 2.2 ? 9 : 0); if (d < bd) { bd = d; best = q; } });
  return best;
};

// ---- the binoculars -------------------------------------------------------------------------
Spotter.reset = function () { Game.tags = []; Game.spotting = false; Game.view.noReticle = false; document.body.classList.remove('spotting'); Spotter.panelKey = ''; };
Spotter.toggle = function (on) {
  const G = Game, sim = G.sim; if (!sim || G.state !== 'mission' || G.cine || G.paused) return;
  if (on === undefined) on = !G.spotting;
  if (on === G.spotting) return;
  const sh = sim.sh;
  if (on) { G.spotZoom = sh.zoomT; if (sh.holding) sim.holdBreath(false); sh.zoom = sh.zoomT = SPOT_ZOOM; }
  else { sh.zoomT = G.spotZoom || sim.st.zoomMin; }
  G.spotting = on; G.view.noReticle = on;
  document.body.classList.toggle('spotting', on);
  Sfx.ui && Sfx.ui(on ? 'tap' : 'back');
  Spotter.panelKey = '';
};
// A tap in the binoculars: tag (or untag) whoever is under the finger. Returns true if it hit someone.
Spotter.tapAt = function (px, py) {
  const G = Game, sim = G.sim, V = G.view; if (!sim) return false;
  let best = null, bd = 1e9;
  sim.actors.forEach((a) => {
    if (a.gone || a.hidden || a.dead || !a.plane) return;
    const f = V.project(sim, a.x, a.y, a.plane.z), s = f[2], top = 1.9 * ((a.look && a.look.h) || 1);
    const hx = Math.max(12, 0.45 * s), cy = f[1] - (top / 2) * s, hy = Math.max(16, (top / 2) * s + 6);
    const dx = Math.abs(px - f[0]), dy = Math.abs(py - cy);
    if (dx > hx || dy > hy) return;
    const d = dx / hx + dy / hy; if (d < bd) { bd = d; best = a; }
  });
  if (!best) return false;
  const T = G.tags || (G.tags = []), i = T.findIndex((t) => t.id === best.id);
  if (i >= 0) T.splice(i, 1);
  else {
    if (T.length >= TAG_COLS.length) T.shift();
    const used = T.map((t) => t.col), col = TAG_COLS.find((c) => used.indexOf(c) < 0);
    T.push({ id: best.id, col, n: (G.tagN = (G.tagN || 0) + 1) });
  }
  Sfx.ui && Sfx.ui(i >= 0 ? 'back' : 'tap');
  Spotter.panelKey = '';
  return true;
};

// ---- drawing ------------------------------------------------------------------------------
Spotter.draw = function (V) {
  const G = Game, sim = G.sim; if (!sim) return;
  const ctx = V.ctx;
  ctx.save(); ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  if (V.round) { ctx.beginPath(); ctx.arc(V.cx, V.cy, V.R, 0, TAU); ctx.clip(); }
  const T = (G.tags || []).filter((t) => { const a = sim.byId[t.id]; return a && !a.gone; });
  G.tags = T;
  Spotter.aimedNow = T.length ? Spotter.aimed(sim) : null;
  T.forEach((t) => Spotter.drawCone(ctx, V, sim, t));
  T.forEach((t) => Spotter.drawOutline(ctx, V, sim, t));
  if (G.spotting) Spotter.drawGlass(ctx, V);
  ctx.restore();
  Spotter.panel(sim);
};
// Two round eyepieces side by side: everything outside them dark, a faint rim and a centre dot.
// (the dark surround is made once per screen size on a canvas of its own: dark everywhere, with the
// two lenses cut out of it, soft at their edges)
Spotter.drawGlass = function (ctx, V) {
  const W = V.W, H = V.H, dpr = V.dpr, key = W + 'x' + H + '@' + dpr;
  const r = Math.min(H * 0.6, W * 0.3), cy = V.cy, dx = Math.min(W * 0.21, r * 0.78), c1 = V.cx - dx, c2 = V.cx + dx;
  if (Spotter.maskKey !== key) {
    const m = Spotter.mask || (Spotter.mask = document.createElement('canvas'));
    m.width = Math.round(W * dpr); m.height = Math.round(H * dpr);
    const o = m.getContext('2d'); o.setTransform(dpr, 0, 0, dpr, 0, 0);
    o.fillStyle = 'rgba(2,3,5,0.94)'; o.fillRect(0, 0, W, H);
    o.globalCompositeOperation = 'destination-out';
    [c1, c2].forEach((cx) => { const g = o.createRadialGradient(cx, cy, r * 0.9, cx, cy, r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); o.fillStyle = g; o.beginPath(); o.arc(cx, cy, r, 0, TAU); o.fill(); });
    o.globalCompositeOperation = 'source-over';
    // a gentle darkening toward the rim of each lens
    o.globalCompositeOperation = 'source-atop';
    [c1, c2].forEach((cx) => { const g = o.createRadialGradient(cx, cy, r * 0.55, cx, cy, r); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)'); o.fillStyle = g; o.fillRect(0, 0, W, H); });
    o.globalCompositeOperation = 'source-over';
    Spotter.maskKey = key;
  }
  ctx.drawImage(Spotter.mask, 0, 0, W, H);
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(150,170,190,0.3)';
  ctx.beginPath(); ctx.arc(c1, cy, r - 2, Math.PI * 0.62, Math.PI * 1.38); ctx.stroke();
  ctx.beginPath(); ctx.arc(c2, cy, r - 2, -Math.PI * 0.38, Math.PI * 0.38); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(V.cx, cy, 1.6, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(V.cx, cy, 9, 0, TAU); ctx.stroke();
};
// An outline that hugs the person: a band in the tag's colour drawn around their limbs, made on a
// small canvas of its own and laid over the picture, so the figure itself is never painted over.
Spotter.drawOutline = function (ctx, V, sim, t) {
  const a = sim.byId[t.id]; if (!a || !a.plane) return;
  const J = actorJoints(a), sc = J.scale || 1, P = (k) => V.project(sim, a.x + J[k][0], a.y + J[k][1], a.plane.z);
  const h = P('head'), s = h[2];
  if (s < 0.6) return;
  const pts = {}; ['head', 'neck', 'hip', 'knL', 'ftL', 'knR', 'ftR', 'sh', 'elL', 'haL', 'elR', 'haR'].forEach((k) => { if (J[k]) pts[k] = P(k); });
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const k in pts) { x0 = Math.min(x0, pts[k][0]); x1 = Math.max(x1, pts[k][0]); y0 = Math.min(y0, pts[k][1]); y1 = Math.max(y1, pts[k][1]); }
  const hr = FIG.headR * sc * s, limb = Math.max(2.5, 0.13 * sc * s), body = Math.max(4, 0.32 * sc * s), gap = 3, ring = 2;
  const pad = hr + gap + ring + 4;
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  if (x1 < 0 || x0 > V.W || y1 < 0 || y0 > V.H || x1 - x0 > 1400 || y1 - y0 > 1400) return;
  const dpr = V.dpr, w = Math.ceil((x1 - x0) * dpr), hh = Math.ceil((y1 - y0) * dpr);
  const c = Spotter.cv || (Spotter.cv = document.createElement('canvas'));
  if (c.width < w) c.width = w; if (c.height < hh) c.height = hh;
  const o = c.getContext('2d');
  o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, w + 2, hh + 2);
  o.setTransform(dpr, 0, 0, dpr, -x0 * dpr, -y0 * dpr);
  const shape = (grow) => {
    o.lineCap = 'round'; o.lineJoin = 'round';
    const seg = (a1, b1, wd) => { if (!pts[a1] || !pts[b1]) return; o.lineWidth = wd + grow * 2; o.beginPath(); o.moveTo(pts[a1][0], pts[a1][1]); o.lineTo(pts[b1][0], pts[b1][1]); o.stroke(); };
    seg('hip', 'neck', body); seg('hip', 'knL', limb); seg('knL', 'ftL', limb); seg('hip', 'knR', limb); seg('knR', 'ftR', limb);
    seg('sh', 'elL', limb); seg('elL', 'haL', limb); seg('sh', 'elR', limb); seg('elR', 'haR', limb); seg('neck', 'head', limb);
    o.beginPath(); o.arc(pts.head[0], pts.head[1], hr + grow, 0, TAU); o.fill();
  };
  o.globalCompositeOperation = 'source-over'; o.strokeStyle = o.fillStyle = 'rgba(0,0,0,0.65)'; shape(gap + ring + 1.5);
  o.strokeStyle = o.fillStyle = a.dead ? '#8e9aa8' : t.col; shape(gap + ring);
  o.globalCompositeOperation = 'destination-out'; o.strokeStyle = o.fillStyle = '#000'; shape(gap);
  o.globalCompositeOperation = 'source-over';
  ctx.drawImage(c, 0, 0, w, hh, x0, y0, w / dpr, hh / dpr);
  // the tag's number above the head
  const lx = h[0], ly = h[1] - hr - gap - 14;
  ctx.font = '800 11px ' + 'ui-monospace,"SF Mono",Menlo,Consolas,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lab = String(t.n) + (a.dead ? ' X' : '');
  const tw = ctx.measureText(lab).width + 10;
  ctx.fillStyle = 'rgba(8,10,14,0.85)'; ctx.fillRect(lx - tw / 2, ly - 8, tw, 16);
  ctx.fillStyle = a.dead ? '#8e9aa8' : t.col; ctx.fillText(lab, lx, ly + 0.5);
};
// Where a tagged person can see: a wedge from their eyes in the way they face, as far as they would
// notice a body (further in the light, a few metres in the dark), red when whoever is under your
// crosshair is standing where they would see him fall.
Spotter.drawCone = function (ctx, V, sim, t) {
  const a = sim.byId[t.id], S = sim.S; if (!a || a.dead || a.hidden || !a.plane || a.blind) return;
  const z = a.plane.z, eyeY = a.y + 1.6 * ((a.look && a.look.h) || 1), face = a.state === 'susp' ? (Math.sin(sim.t * 3) > 0 ? 1 : -1) : a.face || 1;
  const far = (a.role === 'guard' || a.state === 'susp' ? 32 : 24) * (a.eyes || 1) * (S.seeMul || 1);
  const zone = a.room && S.rooms[a.room] ? a.room : a.zone;
  // would this person see whoever you are aiming at fall, where they stand now?
  const T = Spotter.aimedNow, sees = !!(T && T !== a && T.zone && sim.canSee(a, T.x, T.y, T.zone));
  const col = sees ? '#ff4a3d' : t.col;
  // walk out along their line of sight a metre at a time; a dark stretch is only seen close up
  const step = 1, quads = [];
  for (let d = 0; d < far; d += step) {
    const x = a.x + face * d, lit = S.isLit(zone, x + face * step * 0.5);
    if (!lit && d > 4) continue;
    quads.push(d);
  }
  if (!quads.length) return;
  const spread = (d) => 0.5 + Math.min(3.5, d * 0.16);
  ctx.save();
  ctx.globalAlpha = sees ? 0.3 : 0.12;
  ctx.fillStyle = col;
  ctx.beginPath();
  quads.forEach((d) => {
    const xa = a.x + face * d, xb = a.x + face * Math.min(far, d + step);
    const A1 = V.project(sim, xa, eyeY + spread(d), z), A2 = V.project(sim, xb, eyeY + spread(d + step), z), B2 = V.project(sim, xb, eyeY - spread(d + step), z), B1 = V.project(sim, xa, eyeY - spread(d), z);
    ctx.moveTo(A1[0], A1[1]); ctx.lineTo(A2[0], A2[1]); ctx.lineTo(B2[0], B2[1]); ctx.lineTo(B1[0], B1[1]); ctx.closePath();
  });
  ctx.fill();
  ctx.globalAlpha = sees ? 0.9 : 0.5; ctx.strokeStyle = col; ctx.lineWidth = 1.2;
  const e0 = V.project(sim, a.x, eyeY, z), last = quads[quads.length - 1] + step, e1 = V.project(sim, a.x + face * last, eyeY + spread(last), z), e2 = V.project(sim, a.x + face * last, eyeY - spread(last), z);
  ctx.beginPath(); ctx.moveTo(e1[0], e1[1]); ctx.lineTo(e0[0], e0[1]); ctx.lineTo(e2[0], e2[1]); ctx.stroke();
  ctx.restore();
};

// ---- the checklist, in the binoculars ------------------------------------------------------------
Spotter.panel = function (sim) {
  const G = Game, box = G.hud.tags; if (!box) return;
  const T = G.tags || [];
  const key = (G.spotting ? 1 : 0) + '|' + T.map((t) => t.id + (sim.byId[t.id] && sim.byId[t.id].dead ? 'd' : '')).join(',');
  if (key === Spotter.panelKey) return;
  Spotter.panelKey = key;
  if (!G.spotting) { box.innerHTML = ''; return; }
  if (!T.length) { box.innerHTML = '<div class="tg-help"><b>BINOCULARS</b><span>Tap a person to tag them. A tagged person keeps an outline and a sight cone in your scope, and is checked against the brief here.</span></div>'; return; }
  box.innerHTML = T.map((t) => {
    const a = sim.byId[t.id], ck = a && Spotter.check(sim, a);
    const head = '<div class="tg-hd"><i style="background:' + t.col + '">' + t.n + '</i><b>' + esc(Spotter.desc(a)) + '</b>' + (a && a.dead ? '<em>down</em>' : ck ? '<em>' + ck.n + ' of ' + ck.rows.length + '</em>' : '') + '</div>';
    const rows = ck ? '<div class="tg-ck">' + ck.rows.map((r) => '<span class="' + (r.ok ? 'y' : 'n') + '">' + (r.ok ? '&#10003; ' : '&#10007; ') + esc(r.label) + '</span>').join('') + '</div>' : '<div class="tg-ck"><span class="q">The brief describes nobody to check against.</span></div>';
    return '<div class="tg">' + head + rows + '</div>';
  }).join('');
};
