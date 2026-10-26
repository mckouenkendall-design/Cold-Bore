// ---------------------------------------------------------------------------
// More calling cards (the list and the first twenty are in 39_progress.js and 45_ui_art.js).
// Twelve on the rank track between the old ones, eight for medals, four on Pip's shelf. Most move.
// Each draws itself into a w x h box (a wide banner) with t in seconds.
// ---------------------------------------------------------------------------
[
  { id: 'scopeview', name: 'Through the Glass', how: 'Rank 2', rank: 2 },
  { id: 'tracer', name: 'Tracer Fire', how: 'Rank 6', rank: 6 },
  { id: 'monsoon', name: 'Monsoon Glass', how: 'Rank 10', rank: 10 },
  { id: 'ballistic', name: 'Drop Chart', how: 'Rank 15', rank: 15 },
  { id: 'wolfmoon', name: 'Wolf Moon', how: 'Rank 19', rank: 19 },
  { id: 'dunes', name: 'Heat Haze', how: 'Rank 25', rank: 25 },
  { id: 'ghillie', name: 'In the Ferns', how: 'Rank 30', rank: 30 },
  { id: 'skyline', name: 'Rooftop Ranger', how: 'Rank 35', rank: 35 },
  { id: 'spotter', name: 'Spotter and Shooter', how: 'Rank 40', rank: 40 },
  { id: 'cartridge', name: 'The Round', how: 'Rank 45', rank: 45 },
  { id: 'redline', name: 'Flatline', how: 'Rank 50', rank: 50 },
  { id: 'blackout', name: 'Night Optics', how: 'Rank 55', rank: 55 },
  { id: 'skullcard', name: 'Headhunter', how: 'Medal: Headhunter, second tier', medal: ['heads', 1] },
  { id: 'owl', name: 'Owl Eyes', how: 'Medal: Night Work, second tier', medal: ['dark', 1] },
  { id: 'shattered', name: 'Shattered', how: 'Medal: Glazier, second tier', medal: ['glass', 1] },
  { id: 'brassrain', name: 'Brass Rain', how: 'Medal: Trigger Time, second tier', medal: ['shots', 1] },
  { id: 'allroads', name: 'Every Road', how: 'Medal: Every Ending, top tier', medal: ['endings', 2] },
  { id: 'icewater', name: 'Ice Water', how: 'Medal: Ice Water, second tier', medal: ['still', 1] },
  { id: 'doubletap', name: 'One Line, Two Men', how: 'Medal: Two for One, second tier', medal: ['twofer', 1] },
  { id: 'actofgod', name: 'Act of God', how: 'Medal: Act of God, second tier', medal: ['accident', 1] },
  { id: 'shelfkoi', name: 'Koi Pond', how: 'Pip\'s shelf' },
  { id: 'shelfvapor', name: 'Night Drive', how: 'Pip\'s shelf' },
  { id: 'shelfcamo', name: 'Field Stencil', how: 'Pip\'s shelf' },
  { id: 'shelfgold', name: 'Gold Reserve', how: 'Pip\'s shelf' },
].forEach((c) => {
  COS_CARDS.push({ id: c.id, name: c.name, how: c.how }); COS_CARD_BY_ID[c.id] = COS_CARDS[COS_CARDS.length - 1];
  if (c.rank && !RANK_CARD[c.rank] && !RANK_TINT[c.rank]) RANK_CARD[c.rank] = c.id;
  if (c.medal) { const m = MEDAL_BY_ID[c.medal[0]]; if (m) { m.card = m.card || {}; if (!m.card[c.medal[1]]) m.card[c.medal[1]] = c.id; } }
});
// A medal tier reached before its card existed still pays the card (called when the looks open).
CB.cardsCatchUp = function () {
  const d = Save.data; if (!d || !d.cos) return;
  MEDALS.forEach((m) => { if (!m.card) return; const got = (d.medals || {})[m.id] || 0; for (const k in m.card) if (got > +k) d.cos.cards[m.card[k]] = 1; });
  for (const k in RANK_CARD) if (+k <= (d.rankPaid || 1) || d.prestige) d.cos.cards[RANK_CARD[k]] = 1; // ranks already paid out before these cards existed
};

// ---- small tools ----
const cbStar = (c, x, y, r, a) => { c.globalAlpha = a; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.globalAlpha = 1; };
const cbStars = (c, w, h, n, seed, t, top) => { const R = makeRng(seed); c.fillStyle = '#fff'; for (let i = 0; i < n; i++) { const x = R.f() * w, y = R.f() * h * (top || 0.6), r = R.r(0.4, 1.2), ph = R.f() * 6; cbStar(c, x, y, r, 0.35 + 0.45 * (0.5 + 0.5 * Math.sin((t || 0) * 2 + ph))); } };
const cbMan = (c, x, y, s, col, prone) => { // a stick figure in the game's own style (standing or lying behind a rifle)
  c.strokeStyle = col; c.fillStyle = col; c.lineCap = 'round'; c.lineWidth = s * 0.12;
  if (prone) { c.beginPath(); c.arc(x + s * 0.9, y - s * 0.22, s * 0.16, 0, TAU); c.fill(); c.beginPath(); c.moveTo(x + s * 0.75, y - s * 0.12); c.lineTo(x - s * 0.5, y); c.lineTo(x - s * 1.1, y + s * 0.05); c.stroke(); c.lineWidth = s * 0.07; c.beginPath(); c.moveTo(x + s * 0.5, y - s * 0.2); c.lineTo(x + s * 2.0, y - s * 0.28); c.stroke(); c.fillRect(x + s * 0.65, y - s * 0.42, s * 0.5, s * 0.12); return; }
  c.beginPath(); c.arc(x, y - s * 1.55, s * 0.18, 0, TAU); c.fill(); c.beginPath(); c.moveTo(x, y - s * 1.37); c.lineTo(x, y - s * 0.7); c.moveTo(x, y - s * 0.7); c.lineTo(x - s * 0.25, y); c.moveTo(x, y - s * 0.7); c.lineTo(x + s * 0.25, y); c.moveTo(x, y - s * 1.2); c.lineTo(x - s * 0.3, y - s * 0.85); c.moveTo(x, y - s * 1.2); c.lineTo(x + s * 0.3, y - s * 0.85); c.stroke();
};
const cbReticle = (c, x, y, r, col, lw) => { c.strokeStyle = col; c.lineWidth = lw || 1.2; c.beginPath(); c.arc(x, y, r, 0, TAU); c.moveTo(x - r * 1.3, y); c.lineTo(x - r * 0.18, y); c.moveTo(x + r * 0.18, y); c.lineTo(x + r * 1.3, y); c.moveTo(x, y - r * 1.3); c.lineTo(x, y - r * 0.18); c.moveTo(x, y + r * 0.18); c.lineTo(x, y + r * 1.3); c.stroke(); };

Object.assign(CC_DRAW, {
  // a dusk street seen through the scope, the far figure wobbling in the mirage
  scopeview(c, w, h, t) {
    ccSky(c, w, h, '#f09a5a', '#5a2e4a'); ccBuildings(c, w, h, 31, '#2a1a2a', 'rgba(255,210,140,0.7)', 0.5);
    const cx = w * 0.62, cy = h * 0.55, r = h * 0.62, wob = Math.sin(t * 3) * 1.2;
    cbMan(c, cx + wob, cy + h * 0.28, h * 0.22, '#120c12');
    c.save(); c.fillStyle = '#05060a'; c.beginPath(); c.rect(0, 0, w, h); c.arc(cx, cy, r, 0, TAU, true); c.fill('evenodd');
    const vg = c.createRadialGradient(cx, cy, r * 0.6, cx, cy, r); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.7)'); c.fillStyle = vg; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill(); c.restore();
    cbReticle(c, cx, cy, r * 0.12, 'rgba(10,10,14,0.95)', 1.4); c.fillStyle = 'rgba(10,10,14,0.9)'; for (let i = 1; i <= 4; i++) { c.fillRect(cx - 1, cy + r * 0.12 + i * r * 0.1, 2, 2); c.fillRect(cx - r * 0.12 - i * r * 0.1, cy - 1, 2, 2); }
  },
  // red tracers arcing over a dark valley, a new one every second or so
  tracer(c, w, h, t) {
    ccSky(c, w, h, '#0c0e1a', '#1c1a26'); ccRidge(c, w, h, h * 0.7, 12, 7, '#0a0a10'); ccRidge(c, w, h, h * 0.82, 9, 9, '#050508');
    c.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const u = ((t * 0.9 + k * 0.37) % 1.4) / 1.4, x0 = w * 0.06, y0 = h * 0.8, x1 = w * 0.95, y1 = h * (0.45 + 0.1 * k), px = (q) => lerp(x0, x1, q), py = (q) => lerp(y0, y1, q) - Math.sin(q * Math.PI) * h * 0.35;
      for (let j = 0; j < 8; j++) { const q = u - j * 0.012; if (q < 0 || q > 1) continue; c.strokeStyle = 'rgba(255,' + (90 + j * 10) + ',60,' + (0.9 - j * 0.1) + ')'; c.lineWidth = 2.6 - j * 0.25; c.beginPath(); c.moveTo(px(q), py(q)); c.lineTo(px(q - 0.012), py(q - 0.012)); c.stroke(); }
      if (u < 1) { const g = c.createRadialGradient(px(u), py(u), 0, px(u), py(u), 12); g.addColorStop(0, 'rgba(255,140,90,0.55)'); g.addColorStop(1, 'rgba(255,80,40,0)'); c.fillStyle = g; c.fillRect(px(u) - 12, py(u) - 12, 24, 24); }
    }
    c.fillStyle = 'rgba(160,150,170,0.08)'; for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(w * (0.15 + i * 0.22), h * 0.78, 40, 8, 0, 0, TAU); c.fill(); }
  },
  // rain on a window, a blurred neon street behind it, drops running down
  monsoon(c, w, h, t) {
    ccSky(c, w, h, '#0e1622', '#1a1030'); const R = makeRng(41);
    for (let i = 0; i < 14; i++) { const x = R.f() * w, y = h * R.r(0.3, 0.9), r = R.r(10, 26), col = R.pick(['255,60,140', '60,200,255', '255,190,60', '160,90,255']); const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + col + ',0.55)'); g.addColorStop(1, 'rgba(' + col + ',0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
    c.fillStyle = 'rgba(200,220,255,0.06)'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { const x = R.f() * w, sp = R.r(8, 30), y = ((R.f() * h + t * sp) % (h + 20)) - 10, r = R.r(1.2, 2.6);
      c.strokeStyle = 'rgba(210,230,255,0.25)'; c.lineWidth = r * 0.6; c.beginPath(); c.moveTo(x, y - sp * 0.9); c.lineTo(x, y); c.stroke();
      c.fillStyle = 'rgba(220,235,255,0.55)'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, TAU); c.fill(); }
  },
  // a range card: grid, the bullet's curve dropping, the marks, a cut-away round
  ballistic(c, w, h) {
    ccSky(c, w, h, '#123a6a', '#0c2a52'); c.strokeStyle = 'rgba(200,225,255,0.14)'; c.lineWidth = 1;
    for (let x = 0; x < w; x += 12) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 12) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.strokeStyle = 'rgba(220,235,255,0.9)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(w * 0.06, h * 0.3); for (let i = 0; i <= 30; i++) { const u = i / 30; c.lineTo(w * (0.06 + 0.88 * u), h * (0.3 + 0.5 * u * u)); } c.stroke();
    c.setLineDash([3, 4]); c.beginPath(); c.moveTo(w * 0.06, h * 0.3); c.lineTo(w * 0.94, h * 0.3); c.stroke(); c.setLineDash([]);
    c.fillStyle = 'rgba(220,235,255,0.85)'; c.font = '700 ' + Math.round(h * 0.11) + 'px monospace';
    [[0.3, '300'], [0.55, '600'], [0.8, '900']].forEach((q) => { const u = (q[0] - 0.06) / 0.88, y = h * (0.3 + 0.5 * u * u); c.beginPath(); c.arc(w * q[0], y, 2.5, 0, TAU); c.fill(); c.fillText(q[1] + ' m', w * q[0] + 5, y - 5); });
    const bx = w * 0.12, by = h * 0.72, L = w * 0.16, R2 = h * 0.07; c.fillStyle = '#d9b25a'; c.fillRect(bx, by - R2, L * 0.6, R2 * 2); c.fillStyle = '#b8743a'; c.beginPath(); c.moveTo(bx + L * 0.6, by - R2 * 0.85); c.quadraticCurveTo(bx + L, by - R2 * 0.3, bx + L * 1.05, by); c.quadraticCurveTo(bx + L, by + R2 * 0.3, bx + L * 0.6, by + R2 * 0.85); c.fill();
  },
  // a huge low moon, a lone figure on the ridge in front of it, stars that twinkle
  wolfmoon(c, w, h, t) {
    ccSky(c, w, h, '#060a1a', '#1a2440'); cbStars(c, w, h, 40, 19, t);
    const mx = w * 0.66, my = h * 0.58, mr = h * 0.42; const g = c.createRadialGradient(mx, my, mr * 0.9, mx, my, mr * 1.8); g.addColorStop(0, 'rgba(230,230,210,0.35)'); g.addColorStop(1, 'rgba(230,230,210,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ecebdc'; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill(); c.fillStyle = 'rgba(160,160,150,0.35)'; [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.12], [-0.05, 0.35, 0.1], [0.35, -0.35, 0.08]].forEach((q) => { c.beginPath(); c.arc(mx + q[0] * mr, my + q[1] * mr, q[2] * mr, 0, TAU); c.fill(); });
    ccRidge(c, w, h, h * 0.86, 6, 23, '#05060c'); cbMan(c, mx - mr * 0.2, h * 0.86, h * 0.2, '#05060c'); c.strokeStyle = '#05060c'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(mx - mr * 0.2 - h * 0.04, h * 0.86 - h * 0.3); c.lineTo(mx - mr * 0.2 + h * 0.06, h * 0.86 - h * 0.05); c.stroke();
  },
  // a desert at noon, the air above the sand rippling, a figure far off
  dunes(c, w, h, t) {
    ccSky(c, w, h, '#f4e4c0', '#e8c890'); c.fillStyle = 'rgba(255,255,240,0.85)'; c.beginPath(); c.arc(w * 0.2, h * 0.22, h * 0.1, 0, TAU); c.fill();
    for (let k = 0; k < 3; k++) { c.fillStyle = ['#d8a868', '#c89050', '#b07a40'][k]; c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w; x += 6) c.lineTo(x, h * (0.55 + k * 0.13) + Math.sin(x * 0.02 + k * 2) * h * 0.06); c.lineTo(w, h); c.fill(); }
    cbMan(c, w * 0.72, h * 0.6, h * 0.08, '#3a2a1a');
    c.fillStyle = 'rgba(255,250,235,0.18)'; for (let y = h * 0.45; y < h * 0.7; y += 3) { const dx = Math.sin(y * 0.4 + t * 6) * 2; c.fillRect(dx, y, w, 1); }
  },
  // forest floor up close: ferns, and among them a lens that catches the light now and then
  ghillie(c, w, h, t) {
    ccSky(c, w, h, '#2a3a1e', '#141c0e'); const R = makeRng(30);
    for (let i = 0; i < 26; i++) { const x = R.f() * w, y = h * R.r(0.3, 1.1), L = R.r(20, 50), a = R.r(-2.2, -0.9), col = R.pick(['#3e5a26', '#4e6e30', '#2e4a1c', '#5a7a36']); c.strokeStyle = col; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x, y); const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L; c.quadraticCurveTo(x + Math.cos(a + 0.4) * L * 0.6, y + Math.sin(a + 0.4) * L * 0.6, ex, ey); c.stroke();
      for (let j = 1; j < 9; j++) { const u = j / 9, px = lerp(x, ex, u), py = lerp(y, ey, u), ll = L * 0.25 * (1 - u); c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(a - 1.2) * ll, py + Math.sin(a - 1.2) * ll); c.moveTo(px, py); c.lineTo(px + Math.cos(a + 1.2) * ll, py + Math.sin(a + 1.2) * ll); c.stroke(); } }
    const lx = w * 0.58, ly = h * 0.55; c.fillStyle = '#0a0c08'; c.beginPath(); c.ellipse(lx, ly, h * 0.09, h * 0.07, 0, 0, TAU); c.fill(); c.fillStyle = '#1a3a5a'; c.beginPath(); c.ellipse(lx, ly, h * 0.06, h * 0.05, 0, 0, TAU); c.fill();
    const gl = Math.max(0, Math.sin(t * 1.3)) ** 8; if (gl > 0.01) { c.strokeStyle = 'rgba(255,255,240,' + gl + ')'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(lx - h * 0.3 * gl, ly); c.lineTo(lx + h * 0.3 * gl, ly); c.moveTo(lx, ly - h * 0.18 * gl); c.lineTo(lx, ly + h * 0.18 * gl); c.stroke(); c.fillStyle = 'rgba(255,255,240,' + gl + ')'; c.beginPath(); c.arc(lx - h * 0.015, ly - h * 0.015, h * 0.02, 0, TAU); c.fill(); }
  },
  // a city at night from a roof: aircraft lights blinking, a red laser dot crossing the windows
  skyline(c, w, h, t) {
    ccSky(c, w, h, '#0a0e22', '#24183a'); cbStars(c, w, h, 20, 35, t, 0.4); ccBuildings(c, w, h, 35, '#0c0c18', 'rgba(255,220,150,0.65)', 0.7);
    for (let i = 0; i < 3; i++) { const on = Math.sin(t * 3 + i * 2) > 0.6; if (on) { c.fillStyle = '#ff3a3a'; c.beginPath(); c.arc(w * (0.2 + i * 0.3), h * (0.25 + (i % 2) * 0.1), 2, 0, TAU); c.fill(); } }
    const lx = w * (0.15 + 0.7 * (0.5 + 0.5 * Math.sin(t * 0.6))), ly = h * (0.55 + 0.1 * Math.sin(t * 1.1)); const g = c.createRadialGradient(lx, ly, 0, lx, ly, 8); g.addColorStop(0, 'rgba(255,40,40,1)'); g.addColorStop(1, 'rgba(255,40,40,0)'); c.fillStyle = g; c.fillRect(lx - 8, ly - 8, 16, 16);
    c.fillStyle = '#05050a'; c.fillRect(0, h * 0.86, w, h * 0.14); cbMan(c, w * 0.1, h * 0.86, h * 0.12, '#05050a', true);
  },
  // two men lying on a ridge at sunrise: the shooter and the spotter beside him
  spotter(c, w, h) {
    ccSky(c, w, h, '#ffb070', '#3a3a6a'); c.fillStyle = 'rgba(255,230,180,0.9)'; c.beginPath(); c.arc(w * 0.75, h * 0.72, h * 0.18, Math.PI, TAU); c.fill();
    ccRidge(c, w, h, h * 0.68, 8, 40, '#4a3a5a'); c.fillStyle = '#140e18'; c.beginPath(); c.moveTo(0, h); c.lineTo(0, h * 0.78); c.quadraticCurveTo(w * 0.4, h * 0.7, w * 0.7, h * 0.8); c.lineTo(w, h * 0.86); c.lineTo(w, h); c.fill();
    cbMan(c, w * 0.32, h * 0.76, h * 0.13, '#140e18', true); cbMan(c, w * 0.18, h * 0.79, h * 0.12, '#140e18', true); c.fillStyle = '#140e18'; c.fillRect(w * 0.18 + h * 0.1, h * 0.79 - h * 0.08, h * 0.12, h * 0.05);
  },
  // one round, side on and huge, with light running along the brass
  cartridge(c, w, h, t) {
    ccSky(c, w, h, '#1a140e', '#0a0806'); const y = h * 0.5, x0 = w * 0.1, L = w * 0.8, R2 = h * 0.18;
    const g = c.createLinearGradient(0, y - R2, 0, y + R2); g.addColorStop(0, '#fff0b8'); g.addColorStop(0.3, '#e0b048'); g.addColorStop(0.7, '#8a6418'); g.addColorStop(1, '#4a340a');
    c.fillStyle = g; c.fillRect(x0, y - R2, L * 0.62, R2 * 2); c.beginPath(); c.moveTo(x0 + L * 0.62, y - R2); c.lineTo(x0 + L * 0.7, y - R2 * 0.6); c.lineTo(x0 + L * 0.7, y + R2 * 0.6); c.lineTo(x0 + L * 0.62, y + R2); c.fill();
    const g2 = c.createLinearGradient(0, y - R2, 0, y + R2); g2.addColorStop(0, '#f0a878'); g2.addColorStop(0.4, '#b8643a'); g2.addColorStop(1, '#4a2410'); c.fillStyle = g2; c.beginPath(); c.moveTo(x0 + L * 0.7, y - R2 * 0.6); c.quadraticCurveTo(x0 + L * 0.95, y - R2 * 0.3, x0 + L, y); c.quadraticCurveTo(x0 + L * 0.95, y + R2 * 0.3, x0 + L * 0.7, y + R2 * 0.6); c.fill();
    c.fillStyle = '#6a4a10'; c.fillRect(x0, y - R2 * 1.05, L * 0.03, R2 * 2.1); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x0 + L * 0.05, y - R2, 1.5, R2 * 2);
    const u = ((t * 0.3) % 1.4) - 0.2, bx = x0 + L * u, sg = c.createLinearGradient(bx - 20, 0, bx + 20, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,250,220,0.55)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    c.save(); c.beginPath(); c.rect(x0, y - R2, L, R2 * 2); c.clip(); c.globalCompositeOperation = 'lighter'; c.fillStyle = sg; c.fillRect(bx - 20, 0, 40, h); c.restore();
  },
  // a heart monitor whose beat runs out to a flat line under the crosshair
  redline(c, w, h, t) {
    ccSky(c, w, h, '#06100c', '#020604'); c.strokeStyle = 'rgba(40,255,140,0.08)'; c.lineWidth = 1; for (let x = 0; x < w; x += 10) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 10) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    const head = ((t * 0.35) % 1.25) * w, y0 = h * 0.55; c.strokeStyle = '#3cff96'; c.lineWidth = 1.8; c.shadowColor = '#3cff96'; c.shadowBlur = 6; c.beginPath();
    for (let x = 0; x <= Math.min(w, head); x += 2) { const u = x / w, beat = u < 0.6 ? ((x % 60) > 20 && (x % 60) < 34 ? [0, -0.35, 0.5, -0.15, 0][Math.floor(((x % 60) - 20) / 3)] || 0 : 0) : 0; c.lineTo(x, y0 + beat * h); } c.stroke(); c.shadowBlur = 0;
    cbReticle(c, w * 0.8, y0, h * 0.14, 'rgba(255,80,70,0.9)', 1.3);
  },
  // the world in night-vision green: grain, a scan line, a figure lit by the IR
  blackout(c, w, h, t) {
    ccSky(c, w, h, '#0a2a10', '#04140a'); ccBuildings(c, w, h, 55, '#062010', 'rgba(140,255,140,0.35)', 0.6); cbMan(c, w * 0.6, h * 0.92, h * 0.25, '#b0ffb0');
    const R = makeRng(Math.floor(t * 20)); c.fillStyle = 'rgba(180,255,180,0.12)'; for (let i = 0; i < 160; i++) c.fillRect(R.f() * w, R.f() * h, 1, 1);
    const sy = ((t * 30) % (h + 20)) - 10; c.fillStyle = 'rgba(180,255,180,0.08)'; c.fillRect(0, sy, w, 6);
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.beginPath(); c.rect(0, 0, w, h); c.ellipse(w * 0.5, h * 0.5, w * 0.48, h * 0.62, 0, 0, TAU, true); c.fill('evenodd');
  },
  // a skull in gold lines with a crosshair over its brow
  skullcard(c, w, h) {
    ccSky(c, w, h, '#1a1414', '#080606'); const x = w * 0.5, y = h * 0.48, s = h * 0.32;
    c.strokeStyle = '#e0b84a'; c.lineWidth = 1.6; for (let i = 0; i < 12; i++) { c.beginPath(); c.moveTo(x + Math.cos((i / 12) * TAU) * s * 1.5, y + Math.sin((i / 12) * TAU) * s * 1.5); c.lineTo(x + Math.cos((i / 12) * TAU) * s * 2.6, y + Math.sin((i / 12) * TAU) * s * 2.6); c.stroke(); }
    c.fillStyle = '#efe6d0'; c.beginPath(); c.arc(x, y - s * 0.15, s, Math.PI * 0.95, Math.PI * 2.05); c.lineTo(x + s * 0.7, y + s * 0.55); c.lineTo(x - s * 0.7, y + s * 0.55); c.closePath(); c.fill(); c.fillRect(x - s * 0.45, y + s * 0.5, s * 0.9, s * 0.35);
    c.fillStyle = '#120c0c'; c.beginPath(); c.ellipse(x - s * 0.38, y + s * 0.05, s * 0.24, s * 0.28, 0, 0, TAU); c.ellipse(x + s * 0.38, y + s * 0.05, s * 0.24, s * 0.28, 0, 0, TAU); c.fill(); c.beginPath(); c.moveTo(x, y + s * 0.3); c.lineTo(x - s * 0.1, y + s * 0.48); c.lineTo(x + s * 0.1, y + s * 0.48); c.fill();
    for (let i = -2; i <= 2; i++) c.fillRect(x + i * s * 0.17 - 0.8, y + s * 0.55, 1.6, s * 0.28);
    cbReticle(c, x, y - s * 0.55, s * 0.28, '#ff4a3a', 1.6);
  },
  // an owl on a branch against the moon, its eyes catching the light
  owl(c, w, h, t) {
    ccSky(c, w, h, '#0a1020', '#18223a'); cbStars(c, w, h, 24, 77, t); c.fillStyle = '#e8e6d4'; c.beginPath(); c.arc(w * 0.3, h * 0.42, h * 0.3, 0, TAU); c.fill();
    c.strokeStyle = '#05070c'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, h * 0.82); c.quadraticCurveTo(w * 0.5, h * 0.74, w, h * 0.9); c.stroke();
    const ox = w * 0.62, oy = h * 0.55, s = h * 0.24; c.fillStyle = '#05070c'; c.beginPath(); c.ellipse(ox, oy, s * 0.55, s * 0.8, 0, 0, TAU); c.fill(); c.beginPath(); c.moveTo(ox - s * 0.5, oy - s * 0.6); c.lineTo(ox - s * 0.35, oy - s * 1.05); c.lineTo(ox - s * 0.1, oy - s * 0.7); c.moveTo(ox + s * 0.5, oy - s * 0.6); c.lineTo(ox + s * 0.35, oy - s * 1.05); c.lineTo(ox + s * 0.1, oy - s * 0.7); c.fill();
    const blink = (t % 4) < 0.15 ? 0.15 : 1; c.fillStyle = '#ffcc33'; [-1, 1].forEach((d) => { c.beginPath(); c.ellipse(ox + d * s * 0.22, oy - s * 0.35, s * 0.15, s * 0.15 * blink, 0, 0, TAU); c.fill(); }); c.fillStyle = '#000'; [-1, 1].forEach((d) => { c.beginPath(); c.ellipse(ox + d * s * 0.22, oy - s * 0.35, s * 0.06, s * 0.06 * blink, 0, 0, TAU); c.fill(); });
  },
  // a window pane holed by a round, cracks running out in rings and spokes, light splitting in them
  shattered(c, w, h) {
    ccSky(c, w, h, '#3a5a7a', '#14243a'); const x = w * 0.55, y = h * 0.5, R = makeRng(88);
    c.strokeStyle = 'rgba(230,245,255,0.75)'; c.lineWidth = 1;
    const spokes = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + R.r(-0.15, 0.15), L = R.r(w * 0.25, w * 0.6); spokes.push(a); c.beginPath(); c.moveTo(x, y); let px = x, py = y; for (let k = 1; k <= 6; k++) { px = x + Math.cos(a + R.r(-0.05, 0.05)) * L * k / 6; py = y + Math.sin(a + R.r(-0.05, 0.05)) * L * k / 6; c.lineTo(px, py); } c.stroke(); }
    for (let r = 1; r <= 4; r++) { c.beginPath(); spokes.forEach((a, i) => { const rr = r * h * 0.12 * R.r(0.85, 1.15), px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; if (i) c.lineTo(px, py); else c.moveTo(px, py); }); c.closePath(); c.globalAlpha = 0.6 - r * 0.1; c.stroke(); } c.globalAlpha = 1;
    ['#ff8080', '#80ff80', '#8080ff'].forEach((col, i) => { c.strokeStyle = col; c.globalAlpha = 0.25; c.beginPath(); c.moveTo(x + i, y); c.lineTo(x + w * 0.4 + i, y - h * 0.2); c.stroke(); }); c.globalAlpha = 1;
    c.fillStyle = '#05080c'; c.beginPath(); c.arc(x, y, 3.5, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(x, y, 6, 0, TAU); c.stroke();
  },
  // empty cases tumbling down in slow motion, catching the light as they turn
  brassrain(c, w, h, t) {
    ccSky(c, w, h, '#1a1612', '#0a0806'); const R = makeRng(14);
    for (let i = 0; i < 16; i++) { const x = R.f() * w, sp = R.r(10, 22), y = ((R.f() * (h + 40) + t * sp) % (h + 40)) - 20, a = t * R.r(0.8, 2) + R.f() * 6, L = R.r(10, 16);
      c.save(); c.translate(x, y); c.rotate(a); const g = c.createLinearGradient(0, -3, 0, 3); g.addColorStop(0, '#fff0b0'); g.addColorStop(0.5, '#d4a23a'); g.addColorStop(1, '#6a4a10'); c.fillStyle = g; c.fillRect(-L / 2, -2.6, L, 5.2); c.fillStyle = '#8a6418'; c.fillRect(-L / 2, -3, 1.6, 6); c.fillStyle = '#1a1208'; c.fillRect(L / 2 - 1, -1.6, 1, 3.2); c.restore(); }
  },
  // a road forking four ways under a storm, a signpost with blank arms
  allroads(c, w, h, t) {
    ccSky(c, w, h, '#2a2e3a', '#4a4a50'); if (Math.sin(t * 1.7) > 0.96) { c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(0, 0, w, h); }
    c.fillStyle = '#2a2a24'; c.fillRect(0, h * 0.7, w, h * 0.3); c.fillStyle = '#6a6458';
    [-0.9, -0.3, 0.3, 0.9].forEach((d) => { c.beginPath(); c.moveTo(w * 0.5 - 6, h); c.lineTo(w * 0.5 + 6, h); c.lineTo(w * 0.5 + d * w * 0.4 + 2, h * 0.7); c.lineTo(w * 0.5 + d * w * 0.4 - 2, h * 0.7); c.fill(); });
    c.fillStyle = '#1a140e'; c.fillRect(w * 0.5 - 1.5, h * 0.25, 3, h * 0.55); [[-1, 0.3], [1, 0.38], [-1, 0.46], [1, 0.54]].forEach((q) => { c.save(); c.translate(w * 0.5, h * q[1]); c.rotate(q[0] * 0.08); c.fillRect(q[0] > 0 ? 0 : -h * 0.3, -3, h * 0.3, 6); c.restore(); });
  },
  // a frozen lake, breath fog drifting, the crosshair steady on a far figure
  icewater(c, w, h, t) {
    ccSky(c, w, h, '#b8d0e4', '#e8f0f6'); ccRidge(c, w, h, h * 0.5, 10, 61, '#8aa0b8'); c.fillStyle = '#d8e8f4'; c.fillRect(0, h * 0.62, w, h * 0.38);
    c.strokeStyle = 'rgba(120,150,180,0.35)'; c.lineWidth = 1; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(w * i * 0.18, h * 0.7); c.lineTo(w * (i * 0.18 + 0.1), h * 0.95); c.stroke(); }
    cbMan(c, w * 0.7, h * 0.64, h * 0.1, '#2a3440'); cbReticle(c, w * 0.7, h * 0.56, h * 0.12, 'rgba(20,24,30,0.9)', 1.3);
    const f = 0.5 + 0.5 * Math.sin(t * 0.8); const g = c.createRadialGradient(w * 0.15, h * 0.6, 0, w * 0.15, h * 0.6, h * 0.5); g.addColorStop(0, 'rgba(255,255,255,' + (0.5 * f) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  },
  // two men in a line, one round's dotted path through both
  doubletap(c, w, h) {
    ccSky(c, w, h, '#2a2236', '#120e18'); ccBuildings(c, w, h, 12, '#0c0a12', null, 0.4);
    cbMan(c, w * 0.55, h * 0.9, h * 0.32, '#e8e0f0'); cbMan(c, w * 0.75, h * 0.9, h * 0.32, '#e8e0f0');
    c.strokeStyle = '#ff5a4a'; c.lineWidth = 1.6; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(0, h * 0.42); c.lineTo(w, h * 0.42); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#ff5a4a'; [0.55, 0.75].forEach((u) => { c.beginPath(); c.arc(w * u, h * 0.42, 3, 0, TAU); c.fill(); });
  },
  // lightning striking a crane over the harbour, the sky flashing white
  actofgod(c, w, h, t) {
    const fl = (t % 3.2) < 0.18; ccSky(c, w, h, fl ? '#8a8ab0' : '#141826', fl ? '#c0c0e0' : '#262c40');
    c.fillStyle = '#05070c'; c.fillRect(0, h * 0.85, w, h * 0.15); c.fillRect(w * 0.6, h * 0.25, 4, h * 0.6); c.fillRect(w * 0.42, h * 0.25, w * 0.32, 3); c.strokeStyle = '#05070c'; c.lineWidth = 1; c.beginPath(); c.moveTo(w * 0.47, h * 0.26); c.lineTo(w * 0.47, h * 0.5); c.stroke();
    if (fl) { c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.shadowColor = '#b0b0ff'; c.shadowBlur = 10; c.beginPath(); let x = w * 0.66, y = 0; c.moveTo(x, y); const R = makeRng(Math.floor(t / 3.2)); while (y < h * 0.25) { x += R.r(-8, 8); y += R.r(4, 9); c.lineTo(x, y); } c.lineTo(w * 0.61, h * 0.25); c.stroke(); c.shadowBlur = 0; }
  },
  // koi circling in a dark pond, ripples spreading
  shelfkoi(c, w, h, t) {
    ccSky(c, w, h, '#0c2a3a', '#06141e');
    for (let r = 0; r < 3; r++) { const rr = ((t * 12 + r * 25) % 75); c.strokeStyle = 'rgba(160,220,240,' + (0.35 * (1 - rr / 75)) + ')'; c.lineWidth = 1; c.beginPath(); c.ellipse(w * 0.3, h * 0.4, rr, rr * 0.4, 0, 0, TAU); c.stroke(); }
    [['#ff7a2a', 0], ['#f4f0e8', 2.1], ['#e83a2a', 4.2]].forEach((q, i) => { const a = t * 0.5 + q[1], fx = w * 0.5 + Math.cos(a) * w * 0.3, fy = h * 0.5 + Math.sin(a) * h * 0.28;
      c.save(); c.translate(fx, fy); c.rotate(a + Math.PI / 2); c.fillStyle = q[0]; c.beginPath(); c.ellipse(0, 0, 12, 5, 0, 0, TAU); c.fill(); c.beginPath(); c.moveTo(-10, 0); c.lineTo(-18, -5 + Math.sin(t * 8 + i) * 2); c.lineTo(-18, 5 + Math.sin(t * 8 + i) * 2); c.fill(); if (i !== 1) { c.fillStyle = '#f4f0e8'; c.beginPath(); c.arc(3, -1, 2.4, 0, TAU); c.fill(); } c.restore(); });
    c.fillStyle = 'rgba(60,140,80,0.8)'; [[0.85, 0.25], [0.12, 0.8]].forEach((q) => { c.beginPath(); c.arc(w * q[0], h * q[1], 12, 0.3, TAU); c.lineTo(w * q[0], h * q[1]); c.fill(); });
  },
  // a night drive: a striped sun setting behind a scrolling neon grid
  shelfvapor(c, w, h, t) {
    ccSky(c, w, h, '#12082a', '#3a1048'); const sx = w * 0.5, sy = h * 0.62, sr = h * 0.42; const g = c.createLinearGradient(0, sy - sr, 0, sy); g.addColorStop(0, '#ffd23a'); g.addColorStop(1, '#ff3a8a'); c.fillStyle = g;
    c.save(); c.beginPath(); c.arc(sx, sy, sr, Math.PI, TAU); c.clip(); c.fillRect(sx - sr, sy - sr, sr * 2, sr); c.fillStyle = '#2a0c3a'; for (let i = 0; i < 6; i++) c.fillRect(sx - sr, sy - sr * 0.45 + i * sr * 0.09, sr * 2, i * 0.8 + 1); c.restore();
    c.fillStyle = '#0c0418'; c.fillRect(0, sy, w, h - sy); c.strokeStyle = '#ff3af0'; c.lineWidth = 1;
    for (let i = -10; i <= 10; i++) { c.beginPath(); c.moveTo(sx + i * 6, sy); c.lineTo(sx + i * w * 0.12, h); c.stroke(); }
    for (let k = 0; k < 7; k++) { const u = ((k + (t * 0.8) % 1) / 7), y = sy + (h - sy) * u * u; c.globalAlpha = u; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } c.globalAlpha = 1;
  },
  // woodland camouflage with a sprayed stencil of a crosshair and the rifle's name
  shelfcamo(c, w, h) {
    ccSky(c, w, h, '#5a6a3a', '#4a5a30'); const R = makeRng(5); ['#3a4a26', '#6a5a3a', '#1e2416'].forEach((col) => { c.fillStyle = col; for (let i = 0; i < 9; i++) { const x = R.f() * w, y = R.f() * h; c.beginPath(); c.ellipse(x, y, R.r(14, 30), R.r(6, 14), R.r(-0.4, 0.4), 0, TAU); c.fill(); } });
    c.fillStyle = 'rgba(230,225,200,0.85)'; c.font = '900 ' + Math.round(h * 0.26) + 'px ' + '"Arial Black","Helvetica Neue",Arial,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('COLD BORE', w * 0.58, h * 0.5);
    cbReticle(c, w * 0.14, h * 0.5, h * 0.2, 'rgba(230,225,200,0.85)', 2.2);
  },
  // stacked gold bars, a glint running along the top one
  shelfgold(c, w, h, t) {
    ccSky(c, w, h, '#1a140a', '#0a0804'); const bw = w * 0.2, bh = h * 0.16;
    const bar = (x, y) => { const g = c.createLinearGradient(0, y, 0, y + bh); g.addColorStop(0, '#fff2b0'); g.addColorStop(0.4, '#e0b040'); g.addColorStop(1, '#7a5410'); c.fillStyle = g; c.beginPath(); c.moveTo(x + bw * 0.12, y); c.lineTo(x + bw * 0.88, y); c.lineTo(x + bw, y + bh); c.lineTo(x, y + bh); c.fill(); c.strokeStyle = 'rgba(80,50,8,0.6)'; c.lineWidth = 1; c.stroke(); };
    for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - r; i++) bar(w * 0.2 + i * bw * 1.02 + r * bw * 0.51, h * 0.78 - (r + 1) * bh);
    const u = ((t * 0.4) % 1.5) - 0.25, gx = w * 0.2 + bw * 1.02 + u * bw; const sg = c.createLinearGradient(gx - 10, 0, gx + 10, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,240,0.7)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    c.globalCompositeOperation = 'lighter'; c.fillStyle = sg; c.fillRect(gx - 10, h * 0.78 - 3 * bh, 20, bh); c.globalCompositeOperation = 'source-over';
  },
});
{ const old = CB.cardMoves, moving = { scopeview: 1, tracer: 1, monsoon: 1, wolfmoon: 1, dunes: 1, ghillie: 1, skyline: 1, cartridge: 1, redline: 1, blackout: 1, owl: 1, brassrain: 1, allroads: 1, icewater: 1, actofgod: 1, shelfkoi: 1, shelfvapor: 1, shelfgold: 1 };
  CB.cardMoves = function (id) { return !!moving[id] || old(id); }; }
