// ---------------------------------------------------------------------------
// Pictures for the menus, drawn in code: rank insignia, calling cards, the cases caches come in,
// medals. Each one is a plain drawing function on a canvas context, in CSS pixels, so the menus
// can put it in a <canvas> (see UI.jobFor) and the gun room or the results can draw it straight.
//
//   CB.insignia(ctx, n, x, y, size, prestige)   the badge for rank n (1 to 60) in a size x size
//                                               square at x, y; prestige adds stars over it
//   CB.callingCard(ctx, id, x, y, w, h, t)      a calling card (the banner behind your name),
//                                               about 4 wide to 1 high; t animates the few that move
// ---------------------------------------------------------------------------
// Metals, from plain steel at the bottom of the track to the amber of the top rank.
const IN_METAL = {
  steel: ['#e6edf4', '#9aa7b6', '#56626f'], bronze: ['#ffd29a', '#c98a45', '#6a3f18'], silver: ['#ffffff', '#c7d0da', '#6d7a88'],
  gold: ['#fff1b8', '#e3b44a', '#7a5410'], plat: ['#f2feff', '#a9dcec', '#4b7584'], amber: ['#fff0c8', '#ffaa3c', '#8a4a08'],
};
function inGrad(c, m, y0, y1) { const g = c.createLinearGradient(0, y0, 0, y1), M = IN_METAL[m]; g.addColorStop(0, M[0]); g.addColorStop(0.45, M[1]); g.addColorStop(1, M[2]); return g; }
// One chevron pointing up, its tip at (x, y), w wide and t thick.
function inChevron(c, x, y, w, t) { c.moveTo(x - w / 2, y + w * 0.42); c.lineTo(x, y); c.lineTo(x + w / 2, y + w * 0.42); c.lineTo(x + w / 2, y + w * 0.42 + t); c.lineTo(x, y + t); c.lineTo(x - w / 2, y + w * 0.42 + t); c.closePath(); }
function inStar(c, x, y, r, pts) { pts = pts || 5; for (let i = 0; i < pts * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / pts, rr = i % 2 ? r * 0.45 : r; if (i) c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); }
function inShield(c, x, y, w, h) { c.moveTo(x - w / 2, y - h / 2); c.lineTo(x + w / 2, y - h / 2); c.lineTo(x + w / 2, y + h * 0.05); c.quadraticCurveTo(x + w / 2, y + h * 0.38, x, y + h / 2); c.quadraticCurveTo(x - w / 2, y + h * 0.38, x - w / 2, y + h * 0.05); c.closePath(); }
function inHex(c, x, y, r) { for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; if (i) c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); }
// A laurel: leaves up both sides of a circle.
function inWreath(c, x, y, r, metal) {
  c.fillStyle = inGrad(c, metal, y - r, y + r);
  c.beginPath();
  for (const s of [-1, 1]) for (let i = 0; i < 7; i++) {
    const a = Math.PI / 2 + s * (0.5 + i * 0.32), lx = x + Math.cos(a) * r, ly = y + Math.sin(a) * r, rot = a + s * 1.2;
    c.moveTo(lx, ly); c.ellipse(lx, ly, r * 0.2, r * 0.085, rot, 0, TAU);
  }
  c.fill();
}
// Crossed rifles, small and simple.
function inRifles(c, x, y, w, metal) {
  c.save(); c.fillStyle = inGrad(c, metal, y - w / 2, y + w / 2);
  for (const s of [-1, 1]) { c.save(); c.translate(x, y); c.rotate(s * 0.62); c.beginPath(); c.rect(-w * 0.5, -w * 0.035, w, w * 0.07); c.rect(w * 0.18, -w * 0.035, w * 0.32, w * 0.12); c.rect(-w * 0.12, -w * 0.11, w * 0.2, w * 0.06); c.fill(); c.restore(); }
  c.restore();
}
// Grades: little pips under the badge.
function inPips(c, x, y, n, r, metal) { c.fillStyle = inGrad(c, metal, y - r, y + r); c.beginPath(); for (let i = 0; i < n; i++) { const px = x + (i - (n - 1) / 2) * r * 2.6; c.moveTo(px + r, y); c.arc(px, y, r, 0, TAU); } c.fill(); }

CB.insignia = function (c, n, x, y, size, prestige) {
  const R = RANKS[Math.max(1, Math.min(RANKS.length, n || 1)) - 1], fam = R.fam, g = R.grade;
  c.save(); c.translate(x, y); c.scale(size / 100, size / 100);
  c.lineJoin = 'round';
  const metal = fam <= 2 ? 'steel' : fam <= 5 ? 'bronze' : fam <= 8 ? 'silver' : fam <= 13 ? 'gold' : fam <= 15 ? 'plat' : 'amber';
  // a soft glow behind the higher ranks
  if (fam >= 9) { const gl = c.createRadialGradient(50, 50, 4, 50, 50, 52); gl.addColorStop(0, fam >= 16 ? 'rgba(255,170,60,0.55)' : fam >= 14 ? 'rgba(150,230,255,0.35)' : 'rgba(255,214,110,0.3)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gl; c.fillRect(0, 0, 100, 100); }
  const outline = () => { c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 2.2; c.stroke(); };
  const fillM = (m, y0, y1) => { c.fillStyle = inGrad(c, m || metal, y0, y1); c.fill(); outline(); };
  if (fam === 0) { // Cold Hands: plain bars on a dark tab, where everyone starts
    c.beginPath(); ptRound(c, 24, 18, 52, 64, 8); fillM('steel', 18, 82);
    c.beginPath(); ptRound(c, 29, 23, 42, 54, 5); c.fillStyle = '#1c232c'; c.fill();
    c.beginPath(); for (let i = 0; i < g; i++) c.rect(36, 50 + (i - (g - 1) / 2) * 14 - 4, 28, 8); c.fillStyle = inGrad(c, 'steel', 36, 64); c.fill();
  } else if (fam <= 3) { // chevrons, one more for each grade; a rocker from Marksman, a ring from Sharpshooter
    const k = g, top = fam >= 2 ? 22 : 30, step = 13;
    c.beginPath(); for (let i = 0; i < k; i++) inChevron(c, 50, top + i * step, 62, 8.5); fillM(null, top, top + k * step + 28);
    if (fam >= 2) { c.beginPath(); c.moveTo(22, 70); c.quadraticCurveTo(50, 92, 78, 70); c.lineTo(78, 78); c.quadraticCurveTo(50, 100, 22, 78); c.closePath(); fillM(null, 70, 96); }
    if (fam === 3) { c.beginPath(); c.arc(50, 14, 8, 0, TAU); c.moveTo(56, 14); c.arc(50, 14, 4.5, 0, TAU, true); fillM(null, 6, 22); c.beginPath(); c.rect(48.8, 3, 2.4, 22); c.rect(39, 12.8, 22, 2.4); c.fillStyle = '#2a1a0a'; c.fill(); }
  } else if (fam === 4) { // Stalker: a bronze diamond with bars across it
    c.beginPath(); c.moveTo(50, 6); c.lineTo(92, 50); c.lineTo(50, 94); c.lineTo(8, 50); c.closePath(); fillM(null, 6, 94);
    c.beginPath(); c.moveTo(50, 15); c.lineTo(83, 50); c.lineTo(50, 85); c.lineTo(17, 50); c.closePath(); c.fillStyle = '#231a12'; c.fill();
    c.beginPath(); for (let i = 0; i < g; i++) { const y = 50 + (i - (g - 1) / 2) * 13; c.rect(32 + Math.abs(y - 50) * 0.5, y - 4, 36 - Math.abs(y - 50), 8); } c.fillStyle = inGrad(c, metal, 30, 70); c.fill();
  } else if (fam === 5) { // Longshot: chevrons over crossed rifles
    inRifles(c, 50, 64, 74, metal);
    c.beginPath(); for (let i = 0; i < g; i++) inChevron(c, 50, 10 + i * 11, 54, 8); fillM(null, 10, 60);
  } else if (fam <= 8) { // a hexagon or shield plate with chevrons on it
    c.beginPath(); if (fam === 8) inShield(c, 50, 50, 70, 82); else inHex(c, 50, 50, 42); fillM(null, 8, 92);
    c.beginPath(); if (fam === 8) inShield(c, 50, 50, 56, 68); else inHex(c, 50, 50, 34); c.fillStyle = '#1b222c'; c.fill();
    c.beginPath(); if (fam === 7) for (let i = 0; i < g; i++) c.rect(32, 40 + i * 10 - (g - 1) * 5, 36, 6); else for (let i = 0; i < g; i++) inChevron(c, 50, 30 + i * 11, 40, 6); c.fillStyle = inGrad(c, metal, 26, 70); c.fill();
  } else if (fam <= 11) { // a gold shield: crossed rifles (Cold Bore), wind lines (Windreader), a star (Long Shadow)
    c.beginPath(); inShield(c, 50, 46, 74, 84); fillM(null, 4, 88);
    c.beginPath(); inShield(c, 50, 46, 60, 70); c.fillStyle = fam === 9 ? '#202833' : fam === 10 ? '#1b2a33' : '#24202e'; c.fill();
    if (fam === 9) inRifles(c, 50, 42, 50, metal);
    else if (fam === 10) { c.strokeStyle = inGrad(c, metal, 26, 60); c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(30, 32); c.lineTo(62, 32); c.quadraticCurveTo(72, 32, 70, 24); c.moveTo(30, 44); c.lineTo(70, 44); c.moveTo(30, 56); c.lineTo(58, 56); c.quadraticCurveTo(68, 56, 66, 64); c.stroke(); }
    else { c.beginPath(); inStar(c, 50, 42, 21); c.fillStyle = inGrad(c, metal, 20, 64); c.fill(); }
    inPips(c, 50, 97, g, 3.4, metal);
  } else if (fam <= 15) { // a wreath round a disc: a ridge, crossed rifles, a coil, a rising sun
    inWreath(c, 50, 48, 42, metal);
    c.beginPath(); c.arc(50, 48, 30, 0, TAU); fillM(null, 18, 78);
    c.beginPath(); c.arc(50, 48, 25, 0, TAU); c.fillStyle = fam === 14 ? '#13232c' : '#1d222b'; c.fill();
    c.save(); c.beginPath(); c.arc(50, 48, 25, 0, TAU); c.clip();
    if (fam === 12) { c.beginPath(); c.moveTo(22, 66); c.lineTo(40, 40); c.lineTo(48, 50); c.lineTo(58, 34); c.lineTo(80, 66); c.closePath(); c.fillStyle = inGrad(c, metal, 34, 66); c.fill(); c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(58, 34); c.lineTo(52, 43); c.lineTo(58, 41); c.lineTo(63, 42); c.closePath(); c.fill(); }
    else if (fam === 13) inRifles(c, 50, 48, 44, metal);
    else if (fam === 14) { c.strokeStyle = inGrad(c, metal, 28, 68); c.lineWidth = 3; c.beginPath(); for (let i = 0; i < 6; i++) { c.moveTo(34 + i * 6.4, 34); c.lineTo(34 + i * 6.4, 62); } c.stroke(); c.lineWidth = 4; c.beginPath(); c.moveTo(28, 48); c.lineTo(72, 48); c.stroke(); c.fillStyle = 'rgba(150,230,255,0.9)'; c.beginPath(); c.arc(74, 48, 3, 0, TAU); c.fill(); }
    else { c.fillStyle = inGrad(c, metal, 30, 66); c.beginPath(); c.arc(50, 64, 12, Math.PI, TAU); c.fill(); c.strokeStyle = c.fillStyle; c.lineWidth = 3; c.beginPath(); for (let i = 0; i < 7; i++) { const a = Math.PI + (i + 0.5) * (Math.PI / 7); c.moveTo(50 + Math.cos(a) * 16, 64 + Math.sin(a) * 16); c.lineTo(50 + Math.cos(a) * 24, 64 + Math.sin(a) * 24); } c.stroke(); }
    c.restore();
    inPips(c, 50, 95, g, 3.2, metal);
  } else { // the top rank: a kestrel with its wings spread, hovering
    c.beginPath(); c.arc(50, 50, 40, 0, TAU); fillM('amber', 10, 90);
    c.beginPath(); c.arc(50, 50, 34, 0, TAU); c.fillStyle = '#1a1410'; c.fill();
    c.beginPath(); c.moveTo(50, 36); c.quadraticCurveTo(36, 28, 16, 38); c.quadraticCurveTo(32, 40, 40, 48); c.quadraticCurveTo(44, 54, 46, 66); c.lineTo(50, 74); c.lineTo(54, 66); c.quadraticCurveTo(56, 54, 60, 48); c.quadraticCurveTo(68, 40, 84, 38); c.quadraticCurveTo(64, 28, 50, 36); c.closePath();
    c.fillStyle = inGrad(c, 'amber', 28, 74); c.fill();
    c.beginPath(); c.arc(50, 34, 4.5, 0, TAU); c.fill();
  }
  // prestige: a star for each run through the track, in an arc over the top
  if (prestige > 0) {
    const k = Math.min(5, prestige);
    c.beginPath(); for (let i = 0; i < k; i++) { const a = -Math.PI / 2 + (i - (k - 1) / 2) * 0.42; inStar(c, 50 + Math.cos(a) * 52, 52 + Math.sin(a) * 52, 6.5); }
    c.fillStyle = '#ffd66e'; c.fill(); c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 1.4; c.stroke();
    if (prestige > 5) { c.font = '800 13px ' + GR_HEAD; c.textAlign = 'center'; c.fillStyle = '#ffd66e'; c.fillText(String(prestige), 92, 14); }
  }
  c.restore();
};

// ---- calling cards ----
// Each is a small scene in the game's flat style, about four wide to one high.
function ccSky(c, w, h, a, b) { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, 0, w, h); }
function ccRidge(c, w, h, base, amp, seed, col) { const R = makeRng(seed); c.fillStyle = col; c.beginPath(); c.moveTo(0, h); let y = base; for (let x = 0; x <= w + 10; x += 10) { y = clamp(y + (R.f() - 0.5) * amp, base - amp * 1.5, base + amp); c.lineTo(x, y); } c.lineTo(w, h); c.closePath(); c.fill(); }
function ccBuildings(c, w, h, seed, col, lit, tall) { const R = makeRng(seed); let x = -4; while (x < w) { const bw = 14 + R.f() * 26, bh = h * (0.25 + R.f() * (tall || 0.45)); c.fillStyle = col; c.fillRect(x, h - bh, bw, bh); if (lit) { c.fillStyle = lit; for (let wy = h - bh + 5; wy < h - 4; wy += 7) for (let wx = x + 3; wx < x + bw - 4; wx += 6) if (R.f() < 0.28) c.fillRect(wx, wy, 3, 3.5); } x += bw + 1 + R.f() * 4; } }
const CC_DRAW = {
  plain(c, w, h) { ccSky(c, w, h, '#3a4554', '#1e2631'); c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 1; c.beginPath(); for (let x = -h; x < w; x += 9) { c.moveTo(x, h); c.lineTo(x + h, 0); } c.stroke(); },
  brickworks(c, w, h, t) { ccSky(c, w, h, '#2b3340', '#141a22'); ccBuildings(c, w, h, 3, '#3a2a26', 'rgba(255,200,120,0.75)'); c.strokeStyle = 'rgba(190,210,235,0.28)'; c.lineWidth = 1; c.beginPath(); const o = ((t || 0) * 60) % 20; for (let i = 0; i < 40; i++) { const x = ((i * 37) % w), y = ((i * 23 + o * 3) % (h + 20)) - 10; c.moveTo(x, y); c.lineTo(x - 3, y + 9); } c.stroke(); },
  harbour(c, w, h) { ccSky(c, w, h, '#4a3a4a', '#1a1c28'); c.fillStyle = '#ffb35c'; c.beginPath(); c.arc(w * 0.72, h * 0.45, h * 0.16, 0, TAU); c.fill(); c.fillStyle = '#141820'; c.fillRect(0, h * 0.7, w, h * 0.3);
    c.strokeStyle = '#141820'; c.lineWidth = 3; c.beginPath(); for (const cx of [w * 0.2, w * 0.45]) { c.moveTo(cx, h * 0.72); c.lineTo(cx, h * 0.2); c.lineTo(cx + w * 0.16, h * 0.2); c.moveTo(cx, h * 0.3); c.lineTo(cx - w * 0.05, h * 0.2); } c.stroke();
    c.fillStyle = 'rgba(255,179,92,0.5)'; for (let i = 0; i < 6; i++) c.fillRect(w * 0.62 + i * 6, h * 0.78 + i * 3, 14 - i, 1.5); },
  ashlock(c, w, h) { ccSky(c, w, h, '#9fc0dc', '#e8eef2'); ccRidge(c, w, h, h * 0.45, 26, 4, '#7f8da0'); ccRidge(c, w, h, h * 0.65, 18, 9, '#4f6f58'); ccRidge(c, w, h, h * 0.85, 10, 2, '#2f4a3a'); },
  towers(c, w, h) { ccSky(c, w, h, '#101830', '#283050'); ccBuildings(c, w, h, 11, '#0c1020', 'rgba(150,200,255,0.8)', 0.75); c.fillStyle = 'rgba(255,80,160,0.7)'; c.fillRect(w * 0.6, h * 0.5, 20, 3); },
  ridge(c, w, h) { ccSky(c, w, h, '#c8d4e0', '#f4f7fa'); ccRidge(c, w, h, h * 0.5, 22, 21, '#dfe6ee'); ccRidge(c, w, h, h * 0.72, 12, 5, '#ffffff'); c.fillStyle = '#3a404a'; c.fillRect(w * 0.7, h * 0.48, 3, h * 0.24); c.fillRect(w * 0.68, h * 0.46, 12, 4); },
  moon(c, w, h) { ccSky(c, w, h, '#0a0f1c', '#18233a'); const mx = w * 0.62, my = h * 0.5, r = h * 0.36; const g = c.createRadialGradient(mx - r * 0.3, my - r * 0.3, 0, mx, my, r); g.addColorStop(0, '#fbf6e4'); g.addColorStop(1, '#bdb6a0'); c.fillStyle = g; c.beginPath(); c.arc(mx, my, r, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(10,12,16,0.9)'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(mx - r * 1.4, my); c.lineTo(mx - 4, my); c.moveTo(mx + 4, my); c.lineTo(mx + r * 1.4, my); c.moveTo(mx, my - r * 1.2); c.lineTo(mx, my - 4); c.moveTo(mx, my + 4); c.lineTo(mx, my + r * 1.2); c.stroke(); c.fillStyle = '#fff'; for (let i = 0; i < 18; i++) c.fillRect((i * 53) % w, (i * 29) % (h * 0.8), 1.2, 1.2); },
  kestrel(c, w, h) { ccSky(c, w, h, '#f0b070', '#6a4a6a'); ccRidge(c, w, h, h * 0.8, 10, 14, '#3a2a3a'); c.fillStyle = '#1a1214'; c.save(); c.translate(w * 0.5, h * 0.42); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-14, -8, -34, -2); c.quadraticCurveTo(-18, 0, -8, 6); c.lineTo(-3, 18); c.lineTo(3, 18); c.lineTo(8, 6); c.quadraticCurveTo(18, 0, 34, -2); c.quadraticCurveTo(14, -8, 0, 0); c.fill(); c.beginPath(); c.arc(0, -3, 3, 0, TAU); c.fill(); c.restore(); },
  storm(c, w, h, t) { ccSky(c, w, h, '#1a1f2a', '#2a3444'); c.fillStyle = '#0c1018'; c.fillRect(0, h * 0.8, w, h * 0.2); const f = (Math.sin((t || 0) * 2.3) > 0.93) ? 1 : 0.55; c.strokeStyle = 'rgba(220,235,255,' + f + ')'; c.lineWidth = 2; c.beginPath(); c.moveTo(w * 0.62, 0); c.lineTo(w * 0.58, h * 0.35); c.lineTo(w * 0.64, h * 0.38); c.lineTo(w * 0.57, h * 0.8); c.stroke(); },
  brass(c, w, h) { ccSky(c, w, h, '#2a221a', '#120e0a'); for (let i = 0; i < 9; i++) { const x = 18 + i * (w - 30) / 8, y = h * (0.35 + ((i * 7) % 5) * 0.08), a = -0.4 + ((i * 13) % 7) * 0.12; c.save(); c.translate(x, y); c.rotate(a); const g = c.createLinearGradient(0, -5, 0, 5); g.addColorStop(0, '#fff1b8'); g.addColorStop(0.5, '#d9a441'); g.addColorStop(1, '#6a4a10'); c.fillStyle = g; c.fillRect(-12, -4.5, 24, 9); c.fillStyle = '#b8862a'; c.fillRect(-14, -5, 3, 10); c.restore(); } },
  coil(c, w, h, t) { ccSky(c, w, h, '#06141a', '#0e2630'); c.strokeStyle = '#2a4a56'; c.lineWidth = 4; c.beginPath(); for (let i = 0; i < 14; i++) { c.moveTo(w * 0.15 + i * 16, h * 0.3); c.lineTo(w * 0.15 + i * 16, h * 0.7); } c.stroke(); const p = ((t || 0) * 0.8) % 1; const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(Math.max(0, p - 0.1), 'rgba(120,230,255,0)'); g.addColorStop(p, 'rgba(160,240,255,0.9)'); g.addColorStop(Math.min(1, p + 0.02), 'rgba(120,230,255,0)'); c.fillStyle = g; c.fillRect(0, h * 0.46, w, 4); },
  aurora(c, w, h, t) { ccSky(c, w, h, '#06121a', '#14263a'); const tt = t || 0; for (let k = 0; k < 3; k++) { c.fillStyle = ['rgba(90,255,170,0.22)', 'rgba(120,200,255,0.18)', 'rgba(200,120,255,0.14)'][k]; c.beginPath(); c.moveTo(0, h * 0.2); for (let x = 0; x <= w; x += 8) c.lineTo(x, h * (0.25 + k * 0.08) + Math.sin(x * 0.03 + tt * 0.7 + k) * 8); c.lineTo(w, h * 0.7); c.lineTo(0, h * 0.7); c.closePath(); c.fill(); } ccRidge(c, w, h, h * 0.8, 8, 31, '#0a121a'); },
  coldbore(c, w, h) { ccSky(c, w, h, '#16120e', '#050506'); const x = w * 0.5; const g = c.createLinearGradient(x - 6, 0, x + 6, 0); g.addColorStop(0, '#7a5410'); g.addColorStop(0.5, '#fff1b8'); g.addColorStop(1, '#7a5410'); c.fillStyle = g; c.fillRect(x - 5, h * 0.3, 10, h * 0.5); const g2 = c.createLinearGradient(x - 4, 0, x + 4, 0); g2.addColorStop(0, '#5a3a20'); g2.addColorStop(0.5, '#e0a070'); g2.addColorStop(1, '#5a3a20'); c.fillStyle = g2; c.beginPath(); c.moveTo(x - 4, h * 0.3); c.quadraticCurveTo(x - 4, h * 0.12, x, h * 0.06); c.quadraticCurveTo(x + 4, h * 0.12, x + 4, h * 0.3); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,170,60,0.18)'; c.beginPath(); c.ellipse(x, h * 0.82, 40, 4, 0, 0, TAU); c.fill(); },
  duck(c, w, h) { ccSky(c, w, h, '#7ec8e8', '#4aa0c8'); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(0, h * 0.72, w, 2); c.fillStyle = '#f7d038'; c.beginPath(); c.ellipse(w * 0.5, h * 0.62, 22, 11, 0, 0, TAU); c.arc(w * 0.5 + 14, h * 0.4, 9, 0, TAU); c.fill(); c.fillStyle = '#f08a24'; c.beginPath(); c.moveTo(w * 0.5 + 22, h * 0.4); c.lineTo(w * 0.5 + 30, h * 0.44); c.lineTo(w * 0.5 + 22, h * 0.46); c.fill(); c.fillStyle = '#1b1b1b'; c.beginPath(); c.arc(w * 0.5 + 16, h * 0.37, 1.6, 0, TAU); c.fill(); },
  ghostcard(c, w, h) { ccSky(c, w, h, '#1a1f26', '#0a0c10'); c.fillStyle = 'rgba(220,230,240,0.08)'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(w * (0.2 + i * 0.15), h * 0.55, 10 + i * 2, 0, TAU); c.fill(); } c.font = '800 ' + Math.round(h * 0.34) + 'px ' + GR_HEAD; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(230,236,244,0.16)'; c.fillText('SHHH', w * 0.5, h * 0.52); },
  kilometre(c, w, h) { ccSky(c, w, h, '#dfe8f0', '#b8c8d8'); ccRidge(c, w, h, h * 0.62, 14, 41, '#8fa0b4'); c.strokeStyle = 'rgba(255,140,40,0.9)'; c.setLineDash([4, 4]); c.lineWidth = 1.6; c.beginPath(); c.moveTo(8, h * 0.8); c.quadraticCurveTo(w * 0.5, h * 0.05, w - 10, h * 0.5); c.stroke(); c.setLineDash([]); c.font = '800 ' + Math.round(h * 0.26) + 'px ' + GR_HEAD; c.textAlign = 'left'; c.fillStyle = '#2a3440'; c.fillText('1000 M', 10, h * 0.32); },
  prestige(c, w, h) { ccSky(c, w, h, '#2a1e10', '#0e0a06'); c.strokeStyle = 'rgba(255,214,110,0.25)'; c.lineWidth = 1; for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; c.beginPath(); c.moveTo(w * 0.5, h * 0.5); c.lineTo(w * 0.5 + Math.cos(a) * w, h * 0.5 + Math.sin(a) * w); c.stroke(); } c.fillStyle = '#ffd66e'; c.beginPath(); inStar(c, w * 0.5, h * 0.5, h * 0.3); c.fill(); },
  shelfmap(c, w, h) { ccSky(c, w, h, '#d8cfb4', '#c2b894'); c.strokeStyle = 'rgba(80,60,40,0.45)'; c.lineWidth = 1; c.beginPath(); for (let i = 1; i < 8; i++) { c.moveTo(i * w / 8, 0); c.lineTo(i * w / 8, h); } for (let j = 1; j < 3; j++) { c.moveTo(0, j * h / 3); c.lineTo(w, j * h / 3); } c.stroke(); c.fillStyle = '#7fa8c0'; c.beginPath(); c.moveTo(0, h * 0.6); c.quadraticCurveTo(w * 0.4, h * 0.4, w * 0.6, h); c.lineTo(0, h); c.fill(); c.strokeStyle = '#c0392b'; c.lineWidth = 2; c.beginPath(); c.arc(w * 0.7, h * 0.4, 6, 0, TAU); c.moveTo(w * 0.7 - 9, h * 0.4); c.lineTo(w * 0.7 + 9, h * 0.4); c.stroke(); },
  shelfneon(c, w, h, t) { ccSky(c, w, h, '#120a1e', '#20103a'); ccBuildings(c, w, h, 17, '#0a0614', null, 0.55); const on = Math.sin((t || 0) * 6) > -0.8; c.font = '800 ' + Math.round(h * 0.3) + 'px ' + GR_HEAD; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = on ? '#ff5ac8' : '#5a2a4a'; c.fillText('OPEN LATE', w * 0.5, h * 0.4); },
  shelfsunset(c, w, h) { ccSky(c, w, h, '#ff9a5a', '#7a3a6a'); c.fillStyle = '#ffd68a'; c.beginPath(); c.arc(w * 0.5, h * 0.72, h * 0.22, Math.PI, TAU); c.fill(); c.fillStyle = '#3a2440'; c.fillRect(0, h * 0.72, w, h * 0.28); c.fillStyle = '#1a1020'; c.beginPath(); c.moveTo(w * 0.25, h * 0.72); c.lineTo(w * 0.29, h * 0.62); c.lineTo(w * 0.38, h * 0.62); c.lineTo(w * 0.4, h * 0.72); c.fill(); c.fillRect(w * 0.32, h * 0.52, 3, 10); },
};
CB.callingCard = function (c, id, x, y, w, h, t) {
  c.save(); c.translate(x, y);
  ptRound(c, 0, 0, w, h, Math.min(10, h * 0.16)); c.clip();
  try { (CC_DRAW[id] || CC_DRAW.plain)(c, w, h, t || 0); } catch (e) { CC_DRAW.plain(c, w, h); }
  // a dark band at the bottom for a name to sit on, and a fine edge
  const g = c.createLinearGradient(0, h * 0.5, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.restore();
  c.save(); c.strokeStyle = 'rgba(255,255,255,0.16)'; c.lineWidth = 1; ptRound(c, x + 0.5, y + 0.5, w - 1, h - 1, Math.min(10, h * 0.16)); c.stroke(); c.restore();
};
// ---- the cases caches come in ----
//   CB.drawCase(ctx, tier, w, h, o)  a case for 'field', 'sealed' or 'vault', filling a w x h box.
//   o: t (seconds), latch: [left, right] each 0 shut to 1 open, glow: 0..1 light leaking from the
//   seams, rar: the rarity whose colour leaks (0..4), open: 0 shut to 1 lid fully up, lift: 0..1
//   the case dropping in (it falls from above and lands)
const CASE_LOOK = {
  field: { body: ['#5a6740', '#3d4729', '#2b331d'], trim: '#8a8f7a', metal: ['#c9ccc4', '#8a8f86', '#4a4f48'], label: 'FIELD', labCol: 'rgba(230,226,200,0.75)' },
  sealed: { body: ['#2d3138', '#1a1d22', '#0e1013'], trim: '#ffaa3c', metal: ['#e9edf2', '#9aa3ae', '#4d5560'], label: 'SEALED', labCol: '#ffb84e' },
  vault: { body: ['#8b95a2', '#5d6774', '#363d47'], trim: '#c58bff', metal: ['#f4f6f9', '#b4bcc6', '#5d6672'], label: 'VAULT', labCol: '#e0c4ff' },
};
const RAR_GLOW = CB.RAR_GLOW = ['#dfe6ee', '#5fd38a', '#6fb6ff', '#c58bff', '#ffb84a'];
// How wide a case can be drawn in a w x h box and still have its lid, handle and shadow inside it.
function caseWidth(w, h) { return Math.max(10, Math.min(w * 0.86, (h * 0.86 - 4) / 0.74)); }
function caseGrad(c, cols, y0, y1) { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, cols[0]); g.addColorStop(0.5, cols[1]); g.addColorStop(1, cols[2]); return g; }
CB.drawCase = function (c, tier, w, h, o) {
  o = o || {};
  const L = CASE_LOOK[tier] || CASE_LOOK.field, t = o.t || 0, open = clamp(o.open || 0, 0, 1), glow = clamp(o.glow || 0, 0, 1.5);
  const gc = RAR_GLOW[o.rar === undefined ? 0 : o.rar] || RAR_GLOW[0];
  const cw = caseWidth(w, h), bh = cw * 0.36, lh = cw * 0.15, dep = cw * 0.12;
  const drop = o.lift === undefined ? 0 : (1 - easeOut(o.lift)) * -h * 0.9;
  const cx = w / 2, yb = h * 0.86 + drop, x0 = cx - cw / 2, x1 = cx + cw / 2, ys = yb - bh; // ys: the seam between lid and body
  c.save();
  // shadow on the table, and the light from above
  const sh = c.createRadialGradient(cx, h * 0.88, 0, cx, h * 0.88, cw * 0.62); sh.addColorStop(0, 'rgba(0,0,0,0.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  c.save(); c.translate(0, h * 0.88); c.scale(1, 0.18); c.translate(0, -h * 0.88); c.fillStyle = sh; c.fillRect(0, h * 0.88 - cw, w, cw * 2); c.restore();
  // ---- the body: top face (only seen when the lid is up), front face ----
  if (open > 0.02) {
    // inside: dark foam, lit from within
    c.fillStyle = '#0c0e11'; c.beginPath(); c.moveTo(x0 + dep * 0.6, ys - dep); c.lineTo(x1 - dep * 0.6, ys - dep); c.lineTo(x1, ys); c.lineTo(x0, ys); c.closePath(); c.fill();
    const ig = c.createLinearGradient(0, ys - dep, 0, ys); ig.addColorStop(0, ptRgba(gc, 0.25 + 0.5 * open)); ig.addColorStop(1, ptRgba(gc, 0.05)); c.fillStyle = ig; c.fill();
  }
  c.fillStyle = caseGrad(c, L.body, ys, yb); ptRound(c, x0, ys, cw, bh, cw * 0.03); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 1.2; c.stroke();
  // tier details on the front
  if (tier === 'field') { // planks and stencil
    c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = 1; c.beginPath(); for (let i = 1; i < 3; i++) { c.moveTo(x0 + 3, ys + (bh * i) / 3); c.lineTo(x1 - 3, ys + (bh * i) / 3); } c.stroke();
    c.fillStyle = caseGrad(c, L.metal, ys, yb); for (const ex of [x0, x1 - cw * 0.07]) { c.fillRect(ex, ys + 1, cw * 0.07, bh * 0.22); c.fillRect(ex, yb - bh * 0.22, cw * 0.07, bh * 0.22); }
    c.strokeStyle = '#2a2016'; c.lineWidth = Math.max(2, cw * 0.018); c.beginPath(); c.arc(x0 - cw * 0.005, ys + bh * 0.5, bh * 0.16, Math.PI * 0.5, Math.PI * 1.5); c.moveTo(x1 + cw * 0.005, ys + bh * 0.34); c.arc(x1 + cw * 0.005, ys + bh * 0.5, bh * 0.16, -Math.PI * 0.5, Math.PI * 0.5); c.stroke();
  } else if (tier === 'sealed') { // moulded ribs and an amber line
    c.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 5; i++) c.fillRect(x0 + cw * (0.08 + i * 0.2), ys + bh * 0.18, cw * 0.06, bh * 0.66);
    c.fillStyle = L.trim; c.fillRect(x0 + cw * 0.04, yb - bh * 0.14, cw * 0.92, Math.max(1.5, bh * 0.025));
  } else { // brushed steel, rivets, a violet light strip, a dial
    c.fillStyle = 'rgba(255,255,255,0.06)'; for (let i = 0; i < 14; i++) c.fillRect(x0 + 2, ys + 3 + i * (bh / 14), cw - 4, 0.6);
    c.fillStyle = '#2a3038'; for (const ex of [x0 + cw * 0.04, x1 - cw * 0.04]) for (const ey of [ys + bh * 0.16, yb - bh * 0.16]) { c.beginPath(); c.arc(ex, ey, Math.max(1.4, cw * 0.012), 0, TAU); c.fill(); }
    const pulse = 0.55 + 0.45 * Math.sin(t * 2.6);
    c.fillStyle = ptRgba(L.trim, 0.5 + 0.4 * pulse); c.fillRect(x0 + cw * 0.08, yb - bh * 0.12, cw * 0.84, Math.max(1.5, bh * 0.03));
    c.save(); c.globalCompositeOperation = 'lighter'; const vg = c.createLinearGradient(0, yb - bh * 0.3, 0, yb); vg.addColorStop(0, ptRgba(L.trim, 0)); vg.addColorStop(1, ptRgba(L.trim, 0.18 * pulse)); c.fillStyle = vg; c.fillRect(x0, yb - bh * 0.3, cw, bh * 0.3); c.restore();
    const dx = cx, dy = ys + bh * 0.5, dr = bh * 0.2; c.fillStyle = caseGrad(c, L.metal, dy - dr, dy + dr); c.beginPath(); c.arc(dx, dy, dr, 0, TAU); c.fill(); c.strokeStyle = '#2a3038'; c.lineWidth = 1; c.stroke();
    c.beginPath(); for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + t * 0.2; c.moveTo(dx + Math.cos(a) * dr * 0.7, dy + Math.sin(a) * dr * 0.7); c.lineTo(dx + Math.cos(a) * dr * 0.9, dy + Math.sin(a) * dr * 0.9); } c.stroke();
    c.fillStyle = '#2a3038'; c.beginPath(); c.arc(dx, dy, dr * 0.35, 0, TAU); c.fill();
  }
  if (tier !== 'vault') { // the name, stencilled or printed
    c.font = '800 ' + Math.max(8, Math.round(bh * 0.2)) + 'px ' + GR_HEAD; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = L.labCol;
    c.fillText(L.label, cx, ys + bh * 0.52);
    if (tier === 'sealed') { c.strokeStyle = L.labCol; c.lineWidth = 1; const tw = c.measureText(L.label).width; c.strokeRect(cx - tw / 2 - 6, ys + bh * 0.52 - bh * 0.15, tw + 12, bh * 0.3); }
  }
  // ---- light leaking from the seam ----
  if (glow > 0.01 && open < 0.98) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const k = Math.min(1, glow), fl = 0.85 + 0.15 * Math.sin(t * 23);
    const sg = c.createLinearGradient(0, ys - bh * 0.5, 0, ys + bh * 0.5); sg.addColorStop(0, ptRgba(gc, 0)); sg.addColorStop(0.5, ptRgba(gc, 0.55 * k * fl)); sg.addColorStop(1, ptRgba(gc, 0));
    c.fillStyle = sg; c.fillRect(x0 - cw * 0.05, ys - bh * 0.5, cw * 1.1, bh);
    c.fillStyle = ptRgba('#ffffff', 0.85 * k); c.fillRect(x0 + 2, ys - 1, cw - 4, 2);
    if (glow > 0.5) { // rays through the gaps
      const rk = (glow - 0.5) * 2; c.fillStyle = ptRgba(gc, 0.18 * rk * fl);
      for (let i = 0; i < 7; i++) { const rx = x0 + cw * (0.1 + i * 0.13), sp = cw * 0.06; c.beginPath(); c.moveTo(rx - 3, ys); c.lineTo(rx + 3, ys); c.lineTo(rx + sp + (i - 3) * cw * 0.04, ys - h * 0.6); c.lineTo(rx - sp + (i - 3) * cw * 0.04, ys - h * 0.6); c.closePath(); c.fill(); }
    }
    c.restore();
  }
  // ---- the lid: shut, or swinging up and back ----
  const lidTop = ys - lh;
  if (open < 0.02) {
    c.fillStyle = caseGrad(c, L.body, lidTop - dep, ys); c.beginPath(); c.moveTo(x0 + dep * 0.6, lidTop - dep); c.lineTo(x1 - dep * 0.6, lidTop - dep); c.lineTo(x1, lidTop); c.lineTo(x0, lidTop); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 1; c.stroke();
    c.fillStyle = caseGrad(c, L.body, lidTop, ys); ptRound(c, x0, lidTop, cw, lh, cw * 0.025); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 1.2; c.stroke();
    // a handle on top
    c.strokeStyle = tier === 'field' ? '#2a2016' : '#1a1d22'; c.lineWidth = Math.max(2.5, cw * 0.022); c.beginPath(); c.moveTo(cx - cw * 0.12, lidTop - dep * 0.45); c.quadraticCurveTo(cx, lidTop - dep * 1.4, cx + cw * 0.12, lidTop - dep * 0.45); c.stroke();
    if (tier === 'sealed') { c.fillStyle = L.trim; c.fillRect(x0 + cw * 0.04, lidTop + lh * 0.25, cw * 0.92, Math.max(1.2, lh * 0.06)); }
    // a highlight along the top edge
    c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0 + 4, lidTop + 1.2); c.lineTo(x1 - 4, lidTop + 1.2); c.stroke();
  } else {
    // the lid rises and tips back: its underside shows, lit by what is inside
    const a = open, rise = lh + dep * 1.6 * a, top = ys - rise - lh * (1 - a) - cw * 0.16 * a;
    c.fillStyle = '#121418'; c.beginPath(); c.moveTo(x0 + dep * 0.6 * (1 - a), top); c.lineTo(x1 - dep * 0.6 * (1 - a), top); c.lineTo(x1 - dep * 0.6, ys - dep); c.lineTo(x0 + dep * 0.6, ys - dep); c.closePath(); c.fill();
    const lg = c.createLinearGradient(0, top, 0, ys - dep); lg.addColorStop(0, ptRgba(gc, 0.05)); lg.addColorStop(1, ptRgba(gc, 0.45 * a)); c.fillStyle = lg; c.fill();
    c.fillStyle = caseGrad(c, L.body, top - lh * 0.4, top); c.fillRect(x0 + dep * 0.6 * (1 - a), top - lh * 0.35 * (1 - a * 0.5), cw - dep * 1.2 * (1 - a), lh * 0.35 * (1 - a * 0.5));
  }
  // ---- latches ----
  const la = o.latch || [0, 0];
  [x0 + cw * 0.22, x1 - cw * 0.22].forEach((lx, i) => {
    const u = clamp(la[i] || 0, 0, 1), lw = cw * 0.085, lhh = lh * 0.9;
    c.save(); c.translate(lx, ys);
    if (open > 0.02) { c.restore(); return; }
    // the hinge on the body, and the clasp, which swings down from the lid when opened
    c.fillStyle = caseGrad(c, L.metal, -lhh, lhh); c.fillRect(-lw * 0.6, bh * 0.02, lw * 1.2, lhh * 0.32);
    c.scale(1, 1 - 2 * u); // flips down
    c.fillStyle = caseGrad(c, L.metal, -lhh, 0); ptRound(c, -lw / 2, -lhh, lw, lhh * 1.18, lw * 0.15); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 1; c.stroke();
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-lw * 0.28, -lhh * 0.72, lw * 0.56, lhh * 0.16);
    c.restore();
    if (u < 0.5 && o.hint) { // a soft ring inviting a tap
      const p = (t * 1.3) % 1; c.strokeStyle = 'rgba(255,214,140,' + (0.7 * (1 - p)) + ')'; c.lineWidth = 2; c.beginPath(); c.arc(lx, ys - lhh * 0.35, lw * (0.8 + p * 0.9), 0, TAU); c.stroke();
    }
  });
  c.restore();
};
// Where the two latches are on a case drawn by CB.drawCase in a w x h box (for the buttons over them).
CB.caseLatches = function (w, h) { const cw = caseWidth(w, h), bh = cw * 0.36, lh = cw * 0.15, cx = w / 2, ys = h * 0.86 - bh; return [{ x: cx - cw / 2 + cw * 0.22, y: ys - lh * 0.3 }, { x: cx + cw / 2 - cw * 0.22, y: ys - lh * 0.3 }]; };
CB.caseTop = function (w, h) { const cw = caseWidth(w, h), bh = cw * 0.36; return { y: h * 0.86 - bh, cw }; };
// A reticle tint: a crosshair in that colour over a small round view of a hillside.
CB.drawTint = function (c, id, w, h) {
  const T = COS_TINT_BY_ID[id] || COS_TINTS[0], r = Math.min(w, h) / 2 - 1, cx = w / 2, cy = h / 2;
  c.save(); c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.clip();
  const g = c.createLinearGradient(0, cy - r, 0, cy + r); g.addColorStop(0, '#9fbfd8'); g.addColorStop(0.55, '#d8e4ea'); g.addColorStop(0.56, '#7a9a62'); g.addColorStop(1, '#4a6a3a'); c.fillStyle = g; c.fillRect(cx - r, cy - r, r * 2, r * 2);
  const vg = c.createRadialGradient(cx, cy, r * 0.5, cx, cy, r); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)'); c.fillStyle = vg; c.fillRect(cx - r, cy - r, r * 2, r * 2);
  c.strokeStyle = T.col; c.fillStyle = T.col; const lw = Math.max(1, r * 0.06);
  c.lineWidth = lw; c.beginPath(); c.moveTo(cx - r, cy); c.lineTo(cx - r * 0.12, cy); c.moveTo(cx + r * 0.12, cy); c.lineTo(cx + r, cy); c.moveTo(cx, cy - r); c.lineTo(cx, cy - r * 0.12); c.moveTo(cx, cy + r * 0.12); c.lineTo(cx, cy + r); c.stroke();
  c.beginPath(); for (let i = 1; i <= 3; i++) { const d = i * r * 0.25; c.moveTo(cx + d, cy - r * 0.07); c.lineTo(cx + d, cy + r * 0.07); c.moveTo(cx - d, cy - r * 0.07); c.lineTo(cx - d, cy + r * 0.07); c.moveTo(cx - r * 0.07, cy + d); c.lineTo(cx + r * 0.07, cy + d); } c.lineWidth = lw * 0.7; c.stroke();
  c.beginPath(); c.arc(cx, cy, lw * 0.9, 0, TAU); c.fill();
  c.restore();
  c.strokeStyle = 'rgba(0,0,0,0.8)'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
};
// The worn look of a rubber stamp: a mask with flecks and scratches taken out, made once and
// handed to the page as --grunge.
CB.grunge = function () {
  if (CB._grunge) return; CB._grunge = true;
  try {
    const cv = document.createElement('canvas'); cv.width = 440; cv.height = 180;
    const c = cv.getContext('2d'), R = makeRng(91);
    c.fillStyle = '#fff'; c.fillRect(0, 0, 440, 180);
    c.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 1400; i++) { c.fillStyle = 'rgba(0,0,0,' + (0.25 + R.f() * 0.75).toFixed(2) + ')'; const r = R.f() < 0.9 ? 0.6 + R.f() * 1.6 : 2 + R.f() * 4; c.beginPath(); c.arc(R.f() * 440, R.f() * 180, r, 0, TAU); c.fill(); }
    c.strokeStyle = 'rgba(0,0,0,0.6)'; for (let i = 0; i < 26; i++) { c.lineWidth = 0.6 + R.f() * 1.4; c.beginPath(); const x = R.f() * 440, y = R.f() * 180; c.moveTo(x, y); c.lineTo(x + (R.f() - 0.5) * 90, y + (R.f() - 0.5) * 20); c.stroke(); }
    document.documentElement.style.setProperty('--grunge', 'url(' + cv.toDataURL('image/png') + ')');
  } catch (e) { /* the stamp is just clean then */ }
};
CB.cardMoves = function (id) { return id === 'brickworks' || id === 'storm' || id === 'coil' || id === 'aurora' || id === 'shelfneon'; };
