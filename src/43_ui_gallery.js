// ---------------------------------------------------------------------------
// Menus, part 4: the gun room.
//
// A gunsmith's room at night. The rifle you have killed most with stands in a lit
// glass case where you walk in; the rest hang on wall racks, grouped by kind, each
// with its fitted parts and skin and a brass nameplate. Rifles you do not own yet
// leave a chalk outline and a price tag, so the room reads as a collection to
// finish. Swipe (or use the arrows) to walk along the wall. Tap a rifle to open its
// bench. It is only a showcase: nothing in here is bought or upgraded, ever.
//
// Each stretch of wall is its own pair of canvases. The still room (wall, racks,
// lamps, plates, and every rifle whose skin does not move) is drawn once. Only what
// moves is drawn again, about thirty times a second and only while it is on screen:
// dust in the spotlight, and rifles with skins that shimmer or glow.
// ---------------------------------------------------------------------------
// Four racks of four, by kind. Two rows of two on a sideways phone keeps every rifle about
// 300 px long with room under it for a bipod and a nameplate.
const GR_RACKS = [
  { name: 'Field rifles', sub: 'Wood and steel. Where every marksman starts.', guns: ['fenwick', 'kessler', 'marrow', 'ibex'] },
  { name: 'Marksman rifles', sub: 'Accurate, and ready for a second shot.', guns: ['lark', 'orlov', 'halden', 'corvid'] },
  { name: 'Long range', sub: 'For shots measured in kilometres.', guns: ['vantage', 'northwind', 'anvil', 'aria'] },
  { name: 'Special rounds', sub: 'Rimfire, subsonic and magnets. Each built for one job.', guns: ['ratter', 'whisper', 'hush', 'stormglass'] },
];
const GR_SERIF = 'Georgia, "Iowan Old Style", "Times New Roman", serif';
const GR_HEAD = '"Avenir Next Condensed", "DIN Condensed", "Roboto Condensed", "Arial Narrow", Arial, sans-serif';

// The racks, with any rifle the list above does not know about put on the rack for its kind.
function grRacks() {
  const racks = GR_RACKS.map((r) => ({ name: r.name, sub: r.sub, guns: r.guns.filter((id) => GUN_BY_ID[id]) }));
  GUNS.forEach((g) => {
    if (racks.some((r) => r.guns.indexOf(g.id) >= 0)) return;
    racks[g.supp === 'integral' || g.action === 'charge' ? 3 : g.eff >= 1100 ? 2 : g.action === 'semi' ? 1 : 0].guns.push(g.id);
  });
  return racks.filter((r) => r.guns.length);
}
function grRound(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function grText(ctx, s, x, y, font, col, align, glint) {
  ctx.font = font; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
  if (glint) { ctx.fillStyle = glint; ctx.fillText(s, x, y + 0.9); } // the light catching the lower edge of an engraved letter
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
// fit text into a width by stepping the size down
function grFitFont(ctx, s, maxW, size, tmpl) { let f = size; ctx.font = tmpl.replace('%', f); while (f > 7 && ctx.measureText(s).width > maxW) { f -= 0.5; ctx.font = tmpl.replace('%', f); } return tmpl.replace('%', f); }
// A brass plate with engraved lines: [{ s, font }]
function grBrass(ctx, x, y, w, h, lines) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#ecd08a'); g.addColorStop(0.45, '#c39a48'); g.addColorStop(1, '#8e6b2a');
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; grRound(ctx, x + 1.5, y + 2.5, w, h, 3); ctx.fill();
  ctx.fillStyle = g; grRound(ctx, x, y, w, h, 3); ctx.fill();
  ctx.strokeStyle = '#5c4418'; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,245,210,0.55)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x + 3, y + 1.2); ctx.lineTo(x + w - 3, y + 1.2); ctx.stroke();
  ctx.fillStyle = '#6b5020'; [x + 5, x + w - 5].forEach((sx) => { ctx.beginPath(); ctx.arc(sx, y + h / 2, 1.6, 0, TAU); ctx.fill(); });
  const n = lines.length, lh = h / (n + 0.6);
  lines.forEach((L, i) => { const f = grFitFont(ctx, L.s, w - 18, L.size, L.font); grText(ctx, L.s, x + w / 2, y + lh * (i + 0.8), f, '#3a2a0d', 'center', 'rgba(255,240,200,0.5)'); });
}
// A warm pool of lamp light on the wall.
function grPool(ctx, x, y, rx, ry, a) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, 'rgba(255,190,120,' + a + ')'); g.addColorStop(0.45, 'rgba(255,165,90,' + a * 0.45 + ')'); g.addColorStop(1, 'rgba(255,150,80,0)');
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

// ---- the still room ---------------------------------------------------------------------------
// Dark panelled wall, a moulding along the top, a skirting board and floor at the bottom.
function grWall(ctx, L, seed) {
  const W = L.W, H = L.H, fy = L.floorY, R = makeRng(seed);
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#16100b'); bg.addColorStop(0.7, '#1d150e'); bg.addColorStop(1, '#0f0b07');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // vertical boards, each a slightly different stain, with a little grain and a dark seam
  const bw = 36;
  for (let x = -Math.round(R.f() * bw); x < W; x += bw) {
    ctx.fillStyle = mix('#231810', '#2e2015', R.f()); ctx.fillRect(x + 1, 0, bw - 1, fy);
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 0.8; ctx.beginPath();
    for (let k = 0; k < 3; k++) { const gx = x + 6 + R.f() * (bw - 12), ph = R.f() * 6; ctx.moveTo(gx, 0); for (let y = 0; y <= fy; y += 18) ctx.lineTo(gx + Math.sin(y * 0.021 + ph) * 2.2, y); }
    ctx.stroke();
    if (R.f() < 0.35) { const ky = 30 + R.f() * (fy - 60), kx = x + 8 + R.f() * (bw - 16); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(kx, ky, 2.4, 4.5, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x, 0, 1.4, fy);
    ctx.fillStyle = 'rgba(255,214,160,0.05)'; ctx.fillRect(x + 1.4, 0, 1, fy);
  }
  // a chair rail across the wall
  const ry = L.railY;
  if (ry) { ctx.fillStyle = '#3a2717'; ctx.fillRect(0, ry, W, 7); ctx.fillStyle = 'rgba(255,220,170,0.12)'; ctx.fillRect(0, ry, W, 1.2); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, ry + 7, W, 2); }
  // skirting and floorboards
  ctx.fillStyle = '#2b1d12'; ctx.fillRect(0, fy - 12, W, 12); ctx.fillStyle = 'rgba(255,220,170,0.12)'; ctx.fillRect(0, fy - 12, W, 1.2);
  const fg = ctx.createLinearGradient(0, fy, 0, H); fg.addColorStop(0, '#22170e'); fg.addColorStop(1, '#0c0805');
  ctx.fillStyle = fg; ctx.fillRect(0, fy, W, H - fy);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 1; i < 4; i++) { const y = fy + (H - fy) * (i / 4) * (i / 4) * 1.3; if (y < H) { ctx.moveTo(0, y); ctx.lineTo(W, y); } }
  ctx.stroke();
}
// darker towards the corners: the lamps only reach so far
function grVignette(ctx, L) {
  const g = ctx.createRadialGradient(L.W / 2, L.H * 0.48, Math.min(L.W, L.H) * 0.3, L.W / 2, L.H * 0.48, Math.max(L.W, L.H) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.W, L.H);
}

// A rifle drawn on its own, so its exact outline can be used for the shadow on the wall, the
// pegs it rests on and the chalk outline of an empty slot.
function grRender(gunId, cfg, bw, bh, dpr, time) {
  const pad = 6, cv = document.createElement('canvas');
  cv.width = Math.ceil((bw + pad * 2) * dpr); cv.height = Math.ceil((bh + pad * 2) * dpr);
  const x = cv.getContext('2d', { willReadFrequently: true }); x.setTransform(dpr, 0, 0, dpr, 0, 0); // its pixels are read once, for the shape
  drawGun(x, gunId, cfg, pad + bw / 2, pad + bh / 2, bw, bh, { time, shadow: false });
  return { cv, pad, dpr, w: bw + pad * 2, h: bh + pad * 2 };
}
// The same shape in one flat colour.
function grFlat(r, col) {
  const cv = document.createElement('canvas'); cv.width = r.cv.width; cv.height = r.cv.height;
  const x = cv.getContext('2d'); x.drawImage(r.cv, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, cv.width, cv.height);
  return cv;
}
// Where the rifle's underside is at a given x (CSS px inside the render), from its pixels.
function grUnder(r, data, px) {
  const W = r.cv.width, H = r.cv.height, cx = clamp(Math.round(px * r.dpr), 0, W - 1);
  let best = -1;
  for (let dx = -3; dx <= 3; dx++) { const c = clamp(cx + dx, 0, W - 1); for (let y = H - 1; y >= 0; y--) if (data[(y * W + c) * 4 + 3] > 120) { best = Math.max(best, y); break; } }
  return best < 0 ? null : best / r.dpr;
}
// The highest and lowest drawn pixel rows (CSS px inside the render).
function grExtent(r, data) {
  const W = r.cv.width, H = r.cv.height, row = (y) => { for (let c = 0; c < W; c += 2) if (data[(y * W + c) * 4 + 3] > 90) return true; return false; };
  let t = 0, b = H - 1;
  while (t < H - 1 && !row(t)) t++;
  while (b > t && !row(b)) b--;
  return { top: t / r.dpr, bot: (b + 1) / r.dpr };
}
// A peg seen end on, sticking out of the upright, with the rifle resting on top of it.
function grPeg(ctx, x, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(x + 1.5, y + 6, 6, 3.2, 0, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(x - 1.6, y + 1.5, 0.5, x, y + 3, 6);
  g.addColorStop(0, '#c08a55'); g.addColorStop(0.6, '#7a4f2c'); g.addColorStop(1, '#3d2614');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y + 3.2, 5.6, 4.6, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.8; ctx.stroke();
}
// A walnut upright: the board the pegs stick out of.
function grUpright(ctx, x, y0, y1) {
  const w = 17, g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, '#2a190d'); g.addColorStop(0.35, '#5b3a21'); g.addColorStop(0.7, '#4a2f1a'); g.addColorStop(1, '#22150a');
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; grRound(ctx, x - w / 2 + 3, y0 + 4, w, y1 - y0, 5); ctx.fill();
  ctx.fillStyle = g; grRound(ctx, x - w / 2, y0, w, y1 - y0, 5); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.moveTo(x - 2.5, y0 + 10); ctx.lineTo(x - 2.5, y1 - 10); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,215,160,0.18)'; ctx.beginPath(); ctx.moveTo(x - 4.5, y0 + 6); ctx.lineTo(x - 4.5, y1 - 6); ctx.stroke();
  ctx.fillStyle = '#7a5226'; [y0 + 7, y1 - 7].forEach((yy) => { ctx.beginPath(); ctx.arc(x, yy, 1.7, 0, TAU); ctx.fill(); });
}
// A brass picture light over a rack: the fitting, and the warm wash it throws down the wall.
function grPictureLight(ctx, x, y, w, reach) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, y, 0, y + reach);
  g.addColorStop(0, 'rgba(255,186,110,0.24)'); g.addColorStop(0.35, 'rgba(255,170,95,0.1)'); g.addColorStop(1, 'rgba(255,160,90,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w * 0.32, y); ctx.lineTo(x + w * 0.32, y); ctx.lineTo(x + w * 0.62, y + reach); ctx.lineTo(x - w * 0.62, y + reach); ctx.closePath(); ctx.fill();
  ctx.restore();
  grPool(ctx, x, y + 4, w * 0.45, 26, 0.3);
  ctx.fillStyle = '#5c4418'; ctx.fillRect(x - 2, y - 12, 4, 10);
  const bg = ctx.createLinearGradient(0, y - 4, 0, y + 5); bg.addColorStop(0, '#f0d28a'); bg.addColorStop(1, '#7a5a20');
  ctx.fillStyle = bg; grRound(ctx, x - w * 0.3, y - 4, w * 0.6, 8, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,236,190,0.9)'; ctx.fillRect(x - w * 0.27, y + 3, w * 0.54, 1.5);
}
// A wall sconce: a small brass arm and a frosted shade, and its glow.
function grSconce(ctx, x, y) {
  grPool(ctx, x, y + 6, 120, 110, 0.32);
  ctx.fillStyle = '#6b5020'; ctx.fillRect(x - 6, y + 10, 12, 3); ctx.fillRect(x - 1.5, y, 3, 12);
  const g = ctx.createRadialGradient(x, y - 4, 1, x, y - 2, 11); g.addColorStop(0, '#fff3d6'); g.addColorStop(0.6, '#ffc77a'); g.addColorStop(1, '#b9752e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 9, y + 1); ctx.lineTo(x - 5, y - 13); ctx.lineTo(x + 5, y - 13); ctx.lineTo(x + 9, y + 1); ctx.closePath(); ctx.fill();
}
// The chalk outline of a rifle that is not here yet, and a faint mark where it would hang.
function grChalk(ctx, r, x, y) {
  const sil = grFlat(r, '#ffffff'), cv = document.createElement('canvas'); cv.width = sil.width; cv.height = sil.height;
  const c = cv.getContext('2d'), k = 1.3 * r.dpr;
  [[k, 0], [-k, 0], [0, k], [0, -k], [k * 0.7, k * 0.7], [-k * 0.7, k * 0.7], [k * 0.7, -k * 0.7], [-k * 0.7, -k * 0.7]].forEach((o) => c.drawImage(sil, o[0], o[1]));
  c.globalCompositeOperation = 'destination-out'; c.drawImage(sil, 0, 0);
  // chalk is never a clean line: knock little gaps out of it
  const R = makeRng(cv.width * 7 + cv.height); c.fillStyle = '#000';
  for (let i = 0; i < cv.width * 0.6; i++) { c.globalAlpha = 0.4 + R.f() * 0.6; c.fillRect(R.f() * cv.width, R.f() * cv.height, 1 + R.f() * 2.5 * r.dpr, 1 + R.f() * 2 * r.dpr); }
  c.globalAlpha = 1;
  ctx.save(); ctx.globalAlpha = 0.05; ctx.drawImage(sil, x, y, r.w, r.h); ctx.globalAlpha = 0.42; ctx.drawImage(cv, x, y, r.w, r.h); ctx.restore();
}
// A paper price tag tied to a peg.
function grTag(ctx, px, py, l1, l2, can) {
  const w = 74, h = 32, x = px + 10, y = py + 12, a = -0.09;
  ctx.strokeStyle = 'rgba(220,210,180,0.7)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(px, py + 2); ctx.quadraticCurveTo(px + 6, py + 12, x + 7, y + 6); ctx.stroke();
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; grRound(ctx, 2, 3, w, h, 3); ctx.fill();
  ctx.fillStyle = can ? '#e6d9b0' : '#cfc4a6'; grRound(ctx, 0, 0, w, h, 3); ctx.fill();
  ctx.fillStyle = 'rgba(80,60,30,0.25)'; ctx.fillRect(0, h - 3, w, 3);
  ctx.fillStyle = '#2a1d10'; ctx.beginPath(); ctx.arc(7, 6, 2, 0, TAU); ctx.fill();
  grText(ctx, l1, w / 2 + 4, 11, '800 10px ' + GR_HEAD, '#3b2a14');
  grText(ctx, l2, w / 2 + 4, 23, grFitFont(ctx, l2, w - 14, 11, '700 %px ' + GR_SERIF), can ? '#7a3a10' : '#3b2a14');
  ctx.restore();
}

// ---- layout -------------------------------------------------------------------------------------
// Everything is placed in CSS pixels on a stretch of wall the size of the screen.
function grLayout(W, H, sf, portrait) {
  const L = { W, H, portrait, sf };
  // upright, the arrows and dots sit at the bottom; sideways, at the top right
  L.top = sf.t + (portrait ? 62 : 56); L.bot = H - Math.max(sf.b, 6) - (portrait ? 58 : 6);
  L.left = sf.l + 14; L.right = W - sf.r - 14;
  L.floorY = portrait ? L.bot + 10 : H - Math.max(4, sf.b * 0.5);
  L.gap = 24;
  const colW = (L.right - L.left - L.gap) / 2;
  L.cols = portrait || colW < 240 ? 1 : 2;
  L.rows = portrait ? clamp(Math.floor((L.bot - L.top) / 150), 2, 4) : 2;
  return L;
}
function grSections(L) {
  const cap = L.cols * L.rows, out = [{ kind: 'case', name: 'The case' }];
  grRacks().forEach((r) => {
    const n = Math.ceil(r.guns.length / cap);
    for (let i = 0; i < n; i++) out.push({ kind: 'rack', name: r.name + (n > 1 ? ' ' + (i + 1) + ' of ' + n : ''), sub: r.sub, guns: r.guns.slice(i * cap, (i + 1) * cap) });
  });
  return out;
}
// Where each rifle on a rack goes. Rows fill left to right; each column has its own pair of uprights.
function grSlots(L, sec) {
  const n = sec.guns.length, cols = Math.min(L.cols, n), rows = Math.ceil(n / cols);
  const colW = (L.right - L.left - L.gap * (cols - 1)) / cols, rowH = Math.min((L.bot - L.top) / rows, L.portrait ? 196 : 170);
  const y0 = L.top + ((L.bot - L.top) - rowH * rows) / 2;
  const slots = sec.guns.map((id, i) => {
    const c = i % cols, r = Math.floor(i / cols), x0 = L.left + c * (colW + L.gap), sy = y0 + r * rowH;
    // the box handed to drawGun: as wide as the column allows, and tall enough that a rifle with a
    // bipod or a tripod still leaves room under it for its nameplate (33 px) inside the row
    const bw = Math.min(colW - 18, 470), bh = Math.max(60, rowH - 37);
    return { id, c, r, x0, y0: sy, w: colW, h: rowH, cx: x0 + colW / 2, cy: sy + rowH * 0.43, bw, bh };
  });
  return { slots, cols, rows, colW, rowH, top: y0 };
}
UI.grSlotsFor = function (G, S) { return grSlots(G.L, S).slots; }; // for the tests
function grCaseBox(L) {
  const w = L.portrait ? L.right - L.left : Math.min(560, (L.right - L.left) * 0.64);
  const h = L.portrait ? 190 : clamp((L.bot - L.top) * 0.5, 120, 190);
  const plinth = L.portrait ? 104 : clamp((L.bot - L.top) * 0.24, 62, 96);
  const by = L.portrait ? Math.max(L.top + 170, L.floorY - plinth - h) : L.floorY - plinth - h - 6;
  return { x: L.W / 2 - w / 2, y: by, w, h, plinth, beamTop: L.portrait ? L.top - 6 : Math.max(0, L.sf.t + 34) };
}

// ---- painting a stretch of wall ----------------------------------------------------------------
UI.grPaint = function (G, i) {
  const S = G.secs[i], L = G.L, el2 = G.secEls[i]; if (!el2 || !el2.isConnected) return;
  const cv = el2.querySelector('.gr-bg'), dpr = G.dpr;
  cv.width = Math.round(L.W * dpr); cv.height = Math.round(L.H * dpr);
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  S.anim = []; S.painted = true;
  if (S.kind === 'case') UI.grPaintCase(G, S, ctx, i); else UI.grPaintRack(G, S, ctx, i);
  S.fx = el2.querySelector('.gr-fx'); S.fx.width = cv.width; S.fx.height = cv.height;
  S.moves = S.kind === 'case' || S.anim.length > 0;
  if (S.moves) UI.grFx(G, i, G.t);
};
function grSkinMoves(id, cfg) { return uiSkinMoves(SKIN_BY_ID[cfg.skin || 'factory']) || id === 'stormglass'; }
function grNameplate(ctx, id, cx, y, maxW) {
  const g = GUN_BY_ID[id], s = (Save.data.stats.guns || {})[id] || { kills: 0, longest: 0 };
  const w = Math.min(maxW, 168), l2 = s.kills ? s.kills + (s.kills === 1 ? ' kill' : ' kills') + (s.longest ? '  ·  longest ' + s.longest + ' m' : '') : 'No kills yet';
  grBrass(ctx, cx - w / 2, y, w, 27, [{ s: g.name.toUpperCase(), size: 10.5, font: '700 %px ' + GR_SERIF }, { s: l2, size: 9.5, font: 'italic 600 %px ' + GR_SERIF }]);
}
UI.grPaintRack = function (G, S, ctx, si) {
  const L = G.L, d = Save.data, rank = rankOf(d.xp).n, fav = G.fav;
  const lay = grSlots(L, S);
  grWall(ctx, L, 31 + si * 17);
  // the racks: a picture light over each column, then its two uprights
  for (let c = 0; c < lay.cols; c++) {
    const inCol = lay.slots.filter((s) => s.c === c); if (!inCol.length) continue;
    const s0 = inCol[0], s1 = inCol[inCol.length - 1], cx = s0.cx, ux = s0.bw * 0.3;
    grPictureLight(ctx, cx, Math.max(L.sf.t + 46, lay.top - 6), s0.bw, (s1.y0 + s1.h) - lay.top + 30);
    S.ux = ux;
    [cx - ux, cx + ux].forEach((x) => grUpright(ctx, x, s0.y0 + 4, s1.y0 + s1.h - 4));
  }
  // the rifles
  lay.slots.forEach((sl) => {
    const own = !!d.guns[sl.id], cfg = own ? gunCfg(sl.id) : defaultConfig(sl.id), g = GUN_BY_ID[sl.id];
    const r = grRender(sl.id, cfg, sl.bw, sl.bh, G.dpr, 1.3), data = r.cv.getContext('2d').getImageData(0, 0, r.cv.width, r.cv.height).data;
    // the rifle and its nameplate as one block, centred in the row
    const ex = grExtent(r, data), block = ex.bot - ex.top + 6 + 27;
    const rx = sl.cx - r.w / 2, ry = sl.y0 + Math.max(2, (sl.h - block) / 2) - ex.top;
    sl.cy = ry + r.h / 2;
    const pegs = [sl.cx - S.ux, sl.cx + S.ux].map((px) => { const u = grUnder(r, data, px - rx); return { x: px, y: u === null ? sl.cy + 6 : ry + u }; });
    const plateY = Math.min(sl.y0 + sl.h - 28, ry + ex.bot + 6);
    sl.peg = pegs;
    if (own && sl.id !== fav) {
      const sh = grFlat(r, '#000');
      [[3, 5, 0.16], [5, 8, 0.14], [8, 12, 0.1]].forEach((o) => { ctx.globalAlpha = o[2]; ctx.drawImage(sh, rx + o[0], ry + o[1], r.w, r.h); });
      ctx.globalAlpha = 1;
      pegs.forEach((p) => grPeg(ctx, p.x, p.y - 1));
      if (grSkinMoves(sl.id, cfg)) S.anim.push({ id: sl.id, cfg, cx: sl.cx, cy: sl.cy, bw: sl.bw, bh: sl.bh });
      else ctx.drawImage(r.cv, rx, ry, r.w, r.h);
      grNameplate(ctx, sl.id, sl.cx, plateY, sl.w * 0.6);
    } else if (own) { // this one is in the glass case: empty pegs, a cleaner patch of wall, and a note
      ctx.save(); ctx.globalAlpha = 0.07; ctx.drawImage(grFlat(r, '#ffe2b8'), rx, ry, r.w, r.h); ctx.restore();
      pegs.forEach((p) => grPeg(ctx, p.x, p.y - 1));
      grBrass(ctx, sl.cx - 80, plateY, 160, 27, [{ s: g.name.toUpperCase(), size: 10.5, font: '700 %px ' + GR_SERIF }, { s: 'On show in the glass case', size: 9.5, font: 'italic 600 %px ' + GR_SERIF }]);
    } else {
      grChalk(ctx, r, rx, ry);
      pegs.forEach((p) => grPeg(ctx, p.x, p.y - 1));
      const special = !!g.special, can = !special && rank >= g.rank && d.credits >= g.price;
      grTag(ctx, pegs[1].x, pegs[1].y + 3, special ? 'THE STORY' : rank >= g.rank ? 'FOR SALE' : 'RANK ' + g.rank, special ? 'Not for sale' : fmtCr(g.price) + ' cr', can);
      grText(ctx, g.name.toUpperCase(), sl.cx - S.ux * 0.35, plateY + 12, '800 11.5px ' + GR_HEAD, 'rgba(230,222,200,0.4)');
    }
  });
  // an empty spot on a short rack: the rack's own plate
  if (lay.slots.length < lay.cols * lay.rows) {
    const c = lay.cols - 1, r = lay.rows - 1, x0 = L.left + c * (lay.colW + L.gap), y = lay.top + r * lay.rowH, w = Math.min(lay.colW * 0.7, 250);
    grBrass(ctx, x0 + lay.colW / 2 - w / 2, y + lay.rowH / 2 - 22, w, 44, [{ s: S.name.toUpperCase(), size: 14, font: '700 %px ' + GR_SERIF }, { s: S.sub, size: 10, font: 'italic 600 %px ' + GR_SERIF }]);
  }
  grVignette(ctx, L);
  S.slots = lay.slots;
};
UI.grPaintCase = function (G, S, ctx) {
  const L = G.L, d = Save.data, id = G.fav, cfg = gunCfg(id), g = GUN_BY_ID[id], B = grCaseBox(L), st = (d.stats.guns || {})[id] || { kills: 0, longest: 0 };
  grWall(ctx, L, 7);
  // two sconces either side, far enough out not to fight the spotlight
  if (!L.portrait) { grSconce(ctx, L.left + 52, L.top + 30); grSconce(ctx, L.right - 52, L.top + 30); }
  // the spotlight: a fitting at the ceiling and a cone of light falling on the case
  const bx = L.W / 2, y0 = B.beamTop, y1 = B.y + B.h + B.plinth;
  S.beam = { x: bx, y0: y0 + 10, y1: B.y + B.h, w0: 26, w1: B.w * 0.98 };
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const bg = ctx.createLinearGradient(0, y0, 0, y1); bg.addColorStop(0, 'rgba(255,232,190,0.26)'); bg.addColorStop(0.6, 'rgba(255,214,160,0.1)'); bg.addColorStop(1, 'rgba(255,200,140,0.03)');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(bx - 13, y0 + 10); ctx.lineTo(bx + 13, y0 + 10); ctx.lineTo(bx + B.w * 0.56, y1); ctx.lineTo(bx - B.w * 0.56, y1); ctx.closePath(); ctx.fill();
  ctx.restore();
  grPool(ctx, bx, L.floorY + 2, B.w * 0.62, 16, 0.42);
  ctx.fillStyle = '#0c0a08'; ctx.fillRect(bx - 1.5, y0 - 30, 3, 32); const fg = ctx.createLinearGradient(bx - 14, 0, bx + 14, 0); fg.addColorStop(0, '#15120e'); fg.addColorStop(0.5, '#3a332a'); fg.addColorStop(1, '#100d0a');
  ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(bx - 9, y0); ctx.lineTo(bx + 9, y0); ctx.lineTo(bx + 14, y0 + 12); ctx.lineTo(bx - 14, y0 + 12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff1d0'; ctx.beginPath(); ctx.ellipse(bx, y0 + 12, 12, 2.4, 0, 0, TAU); ctx.fill();
  // the plinth: dark wood with a brass trim and the plaque
  const px = B.x + B.w * 0.04, pw = B.w * 0.92, py = B.y + B.h;
  const pg = ctx.createLinearGradient(px, 0, px + pw, 0); pg.addColorStop(0, '#1d130b'); pg.addColorStop(0.5, '#3f2915'); pg.addColorStop(1, '#1a1009');
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(px + 6, py + 8, pw, B.plinth);
  ctx.fillStyle = pg; ctx.fillRect(px, py, pw, B.plinth);
  ctx.fillStyle = 'rgba(255,220,170,0.1)'; ctx.fillRect(px, py + 10, pw, 1); ctx.fillRect(px + 8, py + 10, 1, B.plinth - 18); ctx.fillRect(px + pw - 9, py + 10, 1, B.plinth - 18);
  const tg = ctx.createLinearGradient(0, py, 0, py + 7); tg.addColorStop(0, '#f0d28a'); tg.addColorStop(1, '#8a6626'); ctx.fillStyle = tg; ctx.fillRect(px - 4, py, pw + 8, 7);
  const kills = st.kills ? 'Most kills: ' + st.kills : 'The rifle you carry. No kills yet.';
  const plW = Math.min(pw * 0.7, 300), plH = Math.min(B.plinth - 22, 48);
  grBrass(ctx, bx - plW / 2, py + 13 + (B.plinth - 22 - plH) / 2, plW, plH, [{ s: g.name.toUpperCase(), size: 15, font: '700 %px ' + GR_SERIF }, { s: kills + (st.kills && st.longest ? '  ·  longest ' + st.longest + ' m' : ''), size: 11.5, font: 'italic 600 %px ' + GR_SERIF }]);
  // inside the case: deep red velvet, a light strip along the top, two brass cradles
  const vg = ctx.createRadialGradient(bx, B.y + B.h * 0.45, 10, bx, B.y + B.h * 0.5, B.w * 0.62);
  vg.addColorStop(0, '#6a1c22'); vg.addColorStop(0.7, '#3a0d12'); vg.addColorStop(1, '#1f060a');
  ctx.fillStyle = vg; ctx.fillRect(B.x, B.y, B.w, B.h);
  const R = makeRng(99); ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 600; i++) ctx.fillRect(B.x + R.f() * B.w, B.y + R.f() * B.h, 1, 1);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const ig = ctx.createLinearGradient(0, B.y, 0, B.y + B.h * 0.7); ig.addColorStop(0, 'rgba(255,214,170,0.3)'); ig.addColorStop(1, 'rgba(255,200,150,0)'); ctx.fillStyle = ig; ctx.fillRect(B.x, B.y, B.w, B.h * 0.7); ctx.restore();
  const bw = B.w - (L.portrait ? 30 : 54), bh = Math.min(B.h - 26, bw / 2.6), rx0 = bx, ry0 = B.y + B.h * 0.48;
  const r = grRender(id, cfg, bw, bh, G.dpr, 1.3), rx = rx0 - r.w / 2, ry = ry0 - r.h / 2;
  const data = r.cv.getContext('2d').getImageData(0, 0, r.cv.width, r.cv.height).data;
  const sh = grFlat(r, '#000'); [[4, 7, 0.22], [7, 11, 0.16]].forEach((o) => { ctx.globalAlpha = o[2]; ctx.drawImage(sh, rx + o[0], ry + o[1], r.w, r.h); }); ctx.globalAlpha = 1;
  [rx0 - bw * 0.27, rx0 + bw * 0.24].forEach((cx) => {
    const u = grUnder(r, data, cx - rx), y = u === null ? ry0 + 8 : ry + u;
    const cg = ctx.createLinearGradient(cx - 9, 0, cx + 9, 0); cg.addColorStop(0, '#7a5a20'); cg.addColorStop(0.5, '#f0d28a'); cg.addColorStop(1, '#6b4c18');
    ctx.fillStyle = cg; ctx.fillRect(cx - 2.2, y, 4.4, B.y + B.h - y - 6); ctx.beginPath(); ctx.moveTo(cx - 10, y - 5); ctx.quadraticCurveTo(cx, y + 9, cx + 10, y - 5); ctx.lineTo(cx + 7, y - 5); ctx.quadraticCurveTo(cx, y + 4, cx - 7, y - 5); ctx.closePath(); ctx.fill();
    ctx.fillRect(cx - 9, B.y + B.h - 7, 18, 4);
  });
  S.caseRifle = { id, cfg, cx: rx0, cy: ry0, bw, bh };
  S.box = B;
  if (grSkinMoves(id, cfg)) S.anim.push(S.caseRifle);
  else { ctx.drawImage(r.cv, rx, ry, r.w, r.h); UI.grGlass(ctx, B); }
  // the frame of the case
  ctx.strokeStyle = '#2a2016'; ctx.lineWidth = 4; ctx.strokeRect(B.x, B.y, B.w, B.h);
  ctx.strokeStyle = 'rgba(240,210,140,0.55)'; ctx.lineWidth = 1; ctx.strokeRect(B.x - 2, B.y - 2, B.w + 4, B.h + 4);
  ctx.fillStyle = '#2a2016'; ctx.fillRect(B.x - 6, B.y - 8, B.w + 12, 7);
  ctx.fillStyle = 'rgba(255,230,180,0.3)'; ctx.fillRect(B.x - 6, B.y - 8, B.w + 12, 1.2);
  // the collection on the wall either side (above the case when upright)
  const owned = Object.keys(d.guns).length, all = GUNS.length;
  const tk = Object.keys(d.stats.guns || {}).reduce((n, k) => n + (d.stats.guns[k].kills || 0), 0);
  const lw = L.portrait ? (L.right - L.left) * 0.42 : Math.min(118, B.x - L.left - 12), lh = 58;
  const ly = L.portrait ? L.top + 34 : B.y + 18, lx1 = L.portrait ? L.left : L.left + 4, lx2 = L.portrait ? L.right - lw : L.right - lw - 4;
  if (lw > 80) {
    grBrass(ctx, lx1, ly, lw, lh, [{ s: 'THE COLLECTION', size: 9, font: '700 %px ' + GR_HEAD }, { s: owned + ' of ' + all, size: 19, font: '700 %px ' + GR_SERIF }]);
    grBrass(ctx, lx2, ly, lw, lh, [{ s: 'ALL KILLS', size: 9, font: '700 %px ' + GR_HEAD }, { s: String(tk), size: 19, font: '700 %px ' + GR_SERIF }]);
    if (!L.portrait && d.stats.longest) grBrass(ctx, lx2, ly + lh + 12, lw, lh, [{ s: 'LONGEST SHOT', size: 9, font: '700 %px ' + GR_HEAD }, { s: d.stats.longest + ' m', size: 19, font: '700 %px ' + GR_SERIF }]);
  }
  grVignette(ctx, L);
  // dust in the beam, made once and then moved
  const DR = makeRng(5); S.dust = [];
  for (let i = 0; i < 64; i++) S.dust.push({ u: DR.r(-1, 1), v: DR.f(), sp: DR.r(0.012, 0.04), ph: DR.r(0, 6), sw: DR.r(0.02, 0.07), r: DR.r(0.5, 1.6), tw: DR.r(1, 3) });
};
// The glass: faint, with two slanted reflections and a bright top edge. Drawn over the rifle.
UI.grGlass = function (ctx, B) {
  ctx.save(); ctx.beginPath(); ctx.rect(B.x, B.y, B.w, B.h); ctx.clip();
  ctx.fillStyle = 'rgba(190,215,235,0.05)'; ctx.fillRect(B.x, B.y, B.w, B.h);
  ctx.globalCompositeOperation = 'lighter';
  [[0.12, 0.09, 0.11], [0.2, 0.035, 0.07], [0.7, 0.06, 0.06]].forEach((q) => {
    const x = B.x + B.w * q[0], w = B.w * q[1];
    ctx.fillStyle = 'rgba(220,235,255,' + q[2] + ')'; ctx.beginPath(); ctx.moveTo(x + B.h * 0.5, B.y); ctx.lineTo(x + B.h * 0.5 + w, B.y); ctx.lineTo(x + w, B.y + B.h); ctx.lineTo(x, B.y + B.h); ctx.closePath(); ctx.fill();
  });
  ctx.fillStyle = 'rgba(255,240,210,0.35)'; ctx.fillRect(B.x, B.y, B.w, 1.5);
  ctx.restore();
};

// ---- what moves ----------------------------------------------------------------------------------
UI.grFx = function (G, i, t) {
  const S = G.secs[i]; if (!S || !S.fx || !S.moves) return;
  const ctx = S.fx.getContext('2d'), dpr = G.dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, S.fx.width, S.fx.height); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  S.anim.forEach((a) => {
    drawGun(ctx, a.id, a.cfg, a.cx, a.cy, a.bw, a.bh, { time: t, shadow: false });
    if (a === S.caseRifle) UI.grGlass(ctx, S.box);
  });
  if (S.dust) {
    const B = S.beam; ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < S.dust.length; k++) {
      const p = S.dust[k], v = (p.v + t * p.sp) % 1, hw = lerp(B.w0, B.w1, v) / 2;
      const u = clamp(p.u + Math.sin(t * 0.5 + p.ph) * p.sw, -1, 1);
      const a = (1 - u * u) * smooth(v * 6) * smooth((1 - v) * 4) * (0.45 + 0.55 * Math.abs(Math.sin(t * p.tw * 0.5 + p.ph)));
      if (a < 0.03) continue;
      ctx.fillStyle = 'rgba(255,238,205,' + (a * 0.85).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(B.x + u * hw, lerp(B.y0, B.y1, v), p.r, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
};

// ---- the screen ---------------------------------------------------------------------------------
UI.gallery = function (sec) {
  UI.attractStop();
  const d = Save.data, root = UI.root || document.getElementById('ui');
  const W = window.innerWidth, H = window.innerHeight, portrait = document.body.classList.contains('portrait');
  const L = grLayout(W, H, Game.safe || { l: 0, r: 0, t: 0, b: 0 }, portrait), secs = grSections(L);
  const G = UI.gr = { L, secs, sec: clamp(sec || 0, 0, secs.length - 1), W, H, dpr: Math.min(2, window.devicePixelRatio || 1), t: 0, acc: 0, fav: Progress.favourite(), secEls: [] };
  const dots = secs.map(() => '<span class="gr-dot"><i></i></span>').join('');
  UI.render(`<div class="scr gunroom">
    <div class="gr-view"><div class="gr-strip">${secs.map((s, i) => `<div class="gr-sec" data-i="${i}"><canvas class="gr-bg"></canvas><canvas class="gr-fx"></canvas></div>`).join('')}</div></div>
    <div class="gr-bar"><button class="ib" data-a="back" data-snd="back" aria-label="Back">${ICON.back}</button><div class="bar-t"><div class="eyebrow">Gun room</div><h2 id="grname"></h2></div></div>
    <div class="gr-pager"><button class="ib gr-prev" data-a="prev" aria-label="Previous wall">${ICON.back}</button><div class="gr-dots">${dots}</div><button class="ib gr-next" data-a="next" aria-label="Next wall">${ICON.back}</button></div>
  </div>`, {
    back() { UI.onTick = null; UI.gr = null; UI.hub(); },
    prev() { UI.grGo(G.sec - 1); },
    next() { UI.grGo(G.sec + 1); },
    gun(ds) { if (performance.now() - (G.swipedAt || 0) < 350) return; const at = G.sec; UI.onTick = null; UI.backTo = () => UI.gallery(at); UI.bench(ds.id); },
  }, 'is-gunroom');
  const view = UI.root.querySelector('.gr-view'), strip = view.firstElementChild;
  G.view = view; G.strip = strip; G.secEls = Array.prototype.slice.call(strip.children);
  strip.style.width = (W * secs.length) + 'px';
  G.secEls.forEach((e) => { e.style.width = W + 'px'; e.style.height = H + 'px'; });
  // something to tap over every rifle: the bench opens
  secs.forEach((S, i) => {
    let hits = [];
    if (S.kind === 'case') { const B = grCaseBox(L); hits.push({ id: G.fav, x: B.x, y: B.y - 8, w: B.w, h: Math.min(B.h + 8 + B.plinth, H - L.sf.b - (B.y - 8)) }); }
    else grSlots(L, S).slots.forEach((s) => hits.push({ id: s.id, x: s.x0 + 4, y: s.y0 + 2, w: s.w - 8, h: s.h - 4 }));
    G.secEls[i].insertAdjacentHTML('beforeend', hits.map((h) => `<button class="gr-hit" data-a="gun" data-id="${h.id}" aria-label="${esc(GUN_BY_ID[h.id].name)}${d.guns[h.id] ? '' : ' (not owned)'}" style="left:${h.x.toFixed(1)}px;top:${h.y.toFixed(1)}px;width:${h.w.toFixed(1)}px;height:${Math.max(44, h.h).toFixed(1)}px"></button>`).join(''));
  });
  UI.grGo(G.sec, true);
  UI.grSwipe(G);
  UI.onTick = UI.grTick;
  if (!UI._grKeys) { UI._grKeys = true; window.addEventListener('keydown', (e) => { const g = UI.gr; if (!g || !g.view.isConnected || UI.over.classList.contains('show')) return; if (e.key === 'ArrowLeft') UI.grGo(g.sec - 1); else if (e.key === 'ArrowRight') UI.grGo(g.sec + 1); else if (e.key === 'Escape') { UI.onTick = null; UI.gr = null; UI.hub(); } }); }
};
// Walk to a stretch of wall.
UI.grGo = function (i, now) {
  const G = UI.gr; if (!G) return;
  const prev = G.sec; i = clamp(i, 0, G.secs.length - 1);
  if (i !== prev && !now) Sfx.ui('page');
  G.sec = i;
  G.strip.style.transition = now ? 'none' : '';
  G.strip.style.transform = 'translate3d(' + (-i * G.W) + 'px,0,0)';
  const S = G.secs[i], nm = UI.root.querySelector('#grname'); if (nm) nm.textContent = S.name;
  UI.root.querySelectorAll('.gr-dot').forEach((b, k) => b.classList.toggle('on', k === i));
  UI.root.querySelector('.gr-prev').classList.toggle('off', i === 0); UI.root.querySelector('.gr-next').classList.toggle('off', i === G.secs.length - 1);
  if (!S.painted) UI.grPaint(G, i);
  // the neighbours, a moment later, so the swipe there is ready
  clearTimeout(G.pre); G.pre = setTimeout(() => { [i + 1, i - 1].forEach((k) => { if (UI.gr === G && G.secs[k] && !G.secs[k].painted) UI.grPaint(G, k); }); }, 60);
};
UI.grSwipe = function (G) {
  const view = G.view; let drag = null;
  view.addEventListener('pointerdown', (e) => { if (e.button > 0) return; drag = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId, moved: false }; });
  view.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 9 && Math.abs(dx) > Math.abs(e.clientY - drag.y)) { drag.moved = true; G.strip.style.transition = 'none'; try { view.setPointerCapture(e.pointerId); } catch (er) { /* fine */ } const n = G.sec + (dx < 0 ? 1 : -1); if (G.secs[n] && !G.secs[n].painted) UI.grPaint(G, n); }
    if (!drag.moved) return;
    const edge = (G.sec === 0 && dx > 0) || (G.sec === G.secs.length - 1 && dx < 0);
    G.drag = -G.sec * G.W + (edge ? dx * 0.3 : dx);
    G.strip.style.transform = 'translate3d(' + G.drag + 'px,0,0)';
  });
  const up = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, v = dx / Math.max(1, e.timeStamp - drag.t);
    if (drag.moved) { G.swipedAt = performance.now(); G.drag = null; let to = G.sec; if (dx < -G.W * 0.16 || v < -0.45) to++; else if (dx > G.W * 0.16 || v > 0.45) to--; UI.grGo(to); }
    drag = null;
  };
  view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
};
// Called every frame while the room is open: move what moves on the wall that is showing.
UI.grTick = function (dt) {
  const G = UI.gr;
  if (!G || !G.view || !G.view.isConnected) { if (UI.onTick === UI.grTick) UI.onTick = null; return; }
  if (window.innerWidth !== G.W || window.innerHeight !== G.H) { if (!G.re) G.re = setTimeout(() => { if (UI.gr === G) UI.gallery(G.sec); }, 160); return; }
  G.t += dt; G.acc += dt;
  if (G.acc < 1 / 30) return;
  G.acc = 0;
  const from = G.drag !== undefined && G.drag !== null ? -G.drag / G.W : G.sec;
  [Math.floor(from), Math.ceil(from)].forEach((k, j, a) => { if (j === 1 && a[1] === a[0]) return; if (G.secs[k] && G.secs[k].painted && G.secs[k].moves) UI.grFx(G, k, G.t); });
};
