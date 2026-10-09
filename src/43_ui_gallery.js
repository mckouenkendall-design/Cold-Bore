// ---------------------------------------------------------------------------
// Menus, part 4: the gun room.
//
// An armoury at night: blue-black steel, cool white LED light and the game's amber for the
// small lit details. The rifle you have killed most with stands in a glass vitrine on a steel
// plinth under a spotlight, where you walk in; the rest hang on lit pegboard panels, grouped
// by kind, each with its fitted parts and skin and an engraved plate. Rifles you do not own
// yet leave an etched outline and a tag on a ball chain, so the room reads as a collection to
// finish. Swipe (or use the arrows) to walk along the wall. Tap a rifle to open its bench. It
// is only a showcase: nothing in here is bought or upgraded, ever.
//
// Each stretch of wall is its own pair of canvases. The still room (wall, panels, lights,
// plates, and every rifle whose skin does not move) is drawn once. Only what moves is drawn
// again, about thirty times a second and only while it is on screen: dust in the spotlight,
// and rifles with skins that shimmer or glow.
// ---------------------------------------------------------------------------
// Four racks of four, by kind. Two rows of two on a sideways phone keeps every rifle about
// 300 px long with room under it for a bipod and a nameplate.
const GR_RACKS = [
  { name: 'Field rifles', sub: 'Simple, sturdy and accurate. Where every marksman starts.', guns: ['fenwick', 'kessler', 'marrow', 'ibex'] },
  { name: 'Marksman rifles', sub: 'Accurate, and ready for a second shot.', guns: ['lark', 'orlov', 'halden', 'corvid'] },
  { name: 'Long range', sub: 'For shots measured in kilometres.', guns: ['vantage', 'northwind', 'anvil', 'aria'] },
  { name: 'Special rounds', sub: 'Rimfire, subsonic and magnets. Each built for one job.', guns: ['ratter', 'whisper', 'hush', 'stormglass'] },
];
const GR_HEAD = '"Avenir Next Condensed", "DIN Condensed", "Roboto Condensed", "Arial Narrow", Arial, sans-serif';
const GR_BODY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
// The light in here: cool white from the LEDs and the spotlight, amber for the accent strips.
const grLed = (a) => 'rgba(226,236,250,' + a + ')';
const grAmb = (a) => 'rgba(255,170,60,' + a + ')';

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
function grText(ctx, s, x, y, font, col, align, under) {
  ctx.font = font; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
  if (under) { ctx.fillStyle = under; ctx.fillText(s, x, y + 0.9); } // the shadow in the bottom of an engraved letter
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
// fit text into a width by stepping the size down
function grFitFont(ctx, s, maxW, size, tmpl) { let f = size; ctx.font = tmpl.replace('%', f); while (f > 7 && ctx.measureText(s).width > maxW) { f -= 0.5; ctx.font = tmpl.replace('%', f); } return tmpl.replace('%', f); }
// A soft oval of light, added on top of what is there.
function grGlow(ctx, x, y, rx, ry, col, a) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, col(a)); g.addColorStop(0.45, col(a * 0.4)); g.addColorStop(1, col(0));
  ctx.fillStyle = g; ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}
// A socket-head bolt, seen face on.
function grBolt(ctx, x, y, r) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.arc(x + 0.5, y + 0.8, r + 0.5, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.5, 0.2, x, y, r);
  g.addColorStop(0, '#7d8895'); g.addColorStop(1, '#232a33');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.beginPath(); ctx.arc(x, y, r * 0.42, 0, TAU); ctx.fill();
}
// An engraved plate of black anodised aluminium: [{ s, size, font, col }]. Its left edge carries a
// thin amber line, like the tags in the rest of the game.
function grPlate(ctx, x, y, w, h, lines, accent) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; grRound(ctx, x + 1, y + 2.5, w, h, 3); ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#29313b'); g.addColorStop(0.5, '#1a2028'); g.addColorStop(1, '#12171d');
  ctx.fillStyle = g; grRound(ctx, x, y, w, h, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(x + 3, y + 0.9, w - 6, 0.8);
  if (accent !== false) { ctx.fillStyle = accent || '#ffaa3c'; ctx.fillRect(x + 4, y + 4, 2, h - 8); }
  const n = lines.length, lh = h / (n + 0.6);
  lines.forEach((L, i) => { const f = grFitFont(ctx, L.s, w - 22, L.size, L.font); grText(ctx, L.s, x + w / 2 + 2, y + lh * (i + 0.8), f, L.col || '#eceff2', 'center', 'rgba(0,0,0,0.85)'); });
}
// A lit readout on the wall: a dark glass panel, a label and a big amber number.
function grStat(ctx, x, y, w, h, label, value) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
  ctx.fillStyle = '#0e1217'; grRound(ctx, x, y, w, h, 4); ctx.fill(); ctx.restore();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#1b222b'); g.addColorStop(1, '#0d1116');
  ctx.fillStyle = g; grRound(ctx, x, y, w, h, 4); ctx.fill();
  ctx.strokeStyle = 'rgba(160,180,205,0.18)'; ctx.lineWidth = 1; ctx.stroke();
  // an amber light along the top edge
  ctx.fillStyle = '#ffb24d'; ctx.fillRect(x + 7, y, w - 14, 1.6);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const lg = ctx.createLinearGradient(0, y, 0, y + h * 0.55); lg.addColorStop(0, grAmb(0.16)); lg.addColorStop(1, grAmb(0));
  ctx.fillStyle = lg; ctx.fillRect(x + 1, y + 1, w - 2, h * 0.55); ctx.restore();
  grText(ctx, label, x + w / 2, y + h * 0.32, grFitFont(ctx, label, w - 14, 10, '700 %px ' + GR_HEAD), '#93a0ae');
  ctx.save(); ctx.shadowColor = grAmb(0.6); ctx.shadowBlur = 10;
  grText(ctx, value, x + w / 2, y + h * 0.67, grFitFont(ctx, value, w - 14, 23, '800 %px ' + GR_HEAD), '#ffb84d');
  ctx.restore();
}

// ---- the still room ---------------------------------------------------------------------------
// Sheets of blue-black steel, bolted at the seams and brushed sideways; a kick plate at the foot
// with an amber LED strip that washes the wall above it, and a dark floor that shines.
function grWall(ctx, L, seed) {
  const W = L.W, H = L.H, fy = L.floorY, R = makeRng(seed), top = fy - 12;
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#10151c'); bg.addColorStop(0.7, '#0c1016'); bg.addColorStop(1, '#07090d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const sw = clamp(W / 3.4, 120, 240);
  for (let x = -Math.round(R.f() * sw * 0.6); x < W; x += sw) {
    ctx.fillStyle = R.f() < 0.5 ? 'rgba(255,255,255,' + (0.008 + R.f() * 0.016).toFixed(3) + ')' : 'rgba(0,0,0,' + (0.04 + R.f() * 0.08).toFixed(3) + ')';
    ctx.fillRect(x, 0, sw, top);
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(x - 1, 0, 2.2, top);
    ctx.fillStyle = 'rgba(200,215,235,0.08)'; ctx.fillRect(x + 1.2, 0, 1, top);
    for (let y = 30; y < top - 16; y += 60) { grBolt(ctx, x - 7, y, 1.5); grBolt(ctx, x + 8, y, 1.5); }
  }
  // brushed grain
  for (let i = 0, n = Math.round(W * 0.3); i < n; i++) {
    ctx.fillStyle = R.f() < 0.5 ? 'rgba(255,255,255,0.022)' : 'rgba(0,0,0,0.16)';
    ctx.fillRect(R.f() * W - 40, R.f() * top, 30 + R.f() * 140, 0.6);
  }
  // the amber strip and the light it throws up the wall
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const cg = ctx.createLinearGradient(0, top - 48, 0, top); cg.addColorStop(0, grAmb(0)); cg.addColorStop(1, grAmb(0.1));
  ctx.fillStyle = cg; ctx.fillRect(0, top - 48, W, 48);
  ctx.restore();
  const kg = ctx.createLinearGradient(0, top, 0, fy); kg.addColorStop(0, '#1a2028'); kg.addColorStop(1, '#07090c');
  ctx.fillStyle = kg; ctx.fillRect(0, top, W, 12);
  ctx.fillStyle = '#ffc77e'; ctx.fillRect(0, top - 1.4, W, 1.4);
  ctx.fillStyle = grAmb(0.4); ctx.fillRect(0, top - 3, W, 1.6);
  if (fy < H) {
    const fg = ctx.createLinearGradient(0, fy, 0, H); fg.addColorStop(0, '#0e1218'); fg.addColorStop(1, '#030405');
    ctx.fillStyle = fg; ctx.fillRect(0, fy, W, H - fy);
    ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, fy, W, 1);
    // the strip again, upside down in the polished floor
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const rh = Math.min(46, H - fy), rg = ctx.createLinearGradient(0, fy, 0, fy + rh); rg.addColorStop(0, grAmb(0.12)); rg.addColorStop(1, grAmb(0));
    ctx.fillStyle = rg; ctx.fillRect(0, fy + 1, W, rh);
    ctx.restore();
  }
}
// darker towards the corners: the lights only reach so far
function grVignette(ctx, L) {
  const g = ctx.createRadialGradient(L.W / 2, L.H * 0.48, Math.min(L.W, L.H) * 0.3, L.W / 2, L.H * 0.48, Math.max(L.W, L.H) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.W, L.H);
}
// A pegboard panel, the kind armouries hang rifles on: perforated steel in a brushed frame,
// standing a little off the wall, lit from the LED bar along its top.
function grPegboard(ctx, x, y, w, h) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 7;
  ctx.fillStyle = '#1b2027'; ctx.fillRect(x, y, w, h); ctx.restore();
  const fg = ctx.createLinearGradient(0, y, 0, y + h); fg.addColorStop(0, '#68737f'); fg.addColorStop(0.06, '#3f4853'); fg.addColorStop(1, '#1f252c');
  ctx.fillStyle = fg; ctx.fillRect(x, y, w, h);
  const f = 4, ix = x + f, iy = y + f, iw = w - f * 2, ih = h - f * 2;
  const bg = ctx.createLinearGradient(0, iy, 0, iy + ih); bg.addColorStop(0, '#343d48'); bg.addColorStop(0.55, '#29313a'); bg.addColorStop(1, '#20262e');
  ctx.fillStyle = bg; ctx.fillRect(ix, iy, iw, ih);
  // the light from the bar: a hot band just under it, then a wash fading down the board; and the
  // two LED strips down the sides of the frame, grazing the board from the edges
  ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
  grGlow(ctx, x + w / 2, iy, iw * 0.72, Math.min(ih * 0.95, iw * 1.1), grLed, 0.2);
  grGlow(ctx, x + w / 2, iy, iw * 0.55, 30, grLed, 0.16);
  ctx.globalCompositeOperation = 'lighter';
  [[ix, 1], [ix + iw, -1]].forEach((e) => {
    const sg = ctx.createLinearGradient(e[0], 0, e[0] + e[1] * 34, 0); sg.addColorStop(0, grLed(0.12)); sg.addColorStop(1, grLed(0));
    ctx.fillStyle = sg; ctx.fillRect(e[1] > 0 ? e[0] : e[0] - 34, iy, 34, ih);
  });
  ctx.restore();
  // the holes: dark, with the lower lip of each catching the light
  const sp = 13, ox = ix + 6.5 + ((iw - 13) % sp) / 2, oy = iy + 8;
  ctx.fillStyle = 'rgba(3,5,8,0.62)'; ctx.beginPath();
  for (let hy = oy; hy < iy + ih - 5; hy += sp) for (let hx = ox; hx < ix + iw - 5; hx += sp) { ctx.moveTo(hx + 1.55, hy); ctx.arc(hx, hy, 1.55, 0, TAU); }
  ctx.fill();
  ctx.fillStyle = grLed(0.1); ctx.beginPath();
  for (let hy = oy; hy < iy + ih - 5; hy += sp) for (let hx = ox; hx < ix + iw - 5; hx += sp) ctx.rect(hx - 1.1, hy + 1.35, 2.2, 0.7);
  ctx.fill();
  // edges: a bright top on the frame, a shadow where the board sits inside it
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(ix, iy, iw, 1.2); ctx.fillRect(ix, iy, 1, ih);
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(ix, iy + ih - 1, iw, 1);
  ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  [x + f / 2, x + w - f / 2].forEach((sx) => {
    const lg = ctx.createLinearGradient(0, y + 8, 0, y + h - 8); lg.addColorStop(0, grLed(0.95)); lg.addColorStop(0.6, grLed(0.7)); lg.addColorStop(1, grLed(0.45));
    ctx.fillStyle = lg; ctx.fillRect(sx - 0.7, y + 8, 1.4, h - 16);
  });
  [[ix + 5, iy + 5], [ix + iw - 5, iy + 5], [ix + 5, iy + ih - 5], [ix + iw - 5, iy + ih - 5]].forEach((p) => grBolt(ctx, p[0], p[1], 1.6));
}
// An LED light bar along the top of a panel: a slim black housing, the lit strip under it, and
// the glow it spills.
function grLedBar(ctx, cx, y, w) {
  const x = cx - w / 2;
  grGlow(ctx, cx, y + 3, w * 0.6, 22, grLed, 0.5);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; grRound(ctx, x + 1, y - 2, w, 8, 3); ctx.fill();
  const hg = ctx.createLinearGradient(0, y - 4, 0, y + 4); hg.addColorStop(0, '#4a535e'); hg.addColorStop(0.5, '#1a1f26'); hg.addColorStop(1, '#0b0e12');
  ctx.fillStyle = hg; grRound(ctx, x, y - 4, w, 8, 3); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x + 3, y - 3.4, w - 6, 0.8);
  ctx.fillStyle = '#f4f8ff'; ctx.fillRect(x + 5, y + 2.2, w - 10, 1.8);
}
// A rubber-dipped hook out of the pegboard, seen end on, with the rifle resting on it.
function grHook(ctx, x, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(x + 1.8, y + 6.5, 6.4, 3.6, 0, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(x - 1.8, y + 1.4, 0.4, x, y + 3, 6);
  g.addColorStop(0, '#59626d'); g.addColorStop(0.55, '#1b1f25'); g.addColorStop(1, '#08090b');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y + 3.2, 5.4, 4.6, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = grAmb(0.9); ctx.lineWidth = 1.1; ctx.stroke();
}
// The outline of a rifle, etched into the board where it hangs: steel grey and cut a shade darker
// for one that is not here yet, amber for the one that is out in the glass case.
function grEtched(ctx, r, x, y, col, a, cut) {
  const sil = grFlat(r, '#ffffff'), cv = document.createElement('canvas'); cv.width = sil.width; cv.height = sil.height;
  const c = cv.getContext('2d'), k = 1.15 * r.dpr;
  [[k, 0], [-k, 0], [0, k], [0, -k], [k * 0.7, k * 0.7], [-k * 0.7, k * 0.7], [k * 0.7, -k * 0.7], [-k * 0.7, -k * 0.7]].forEach((o) => c.drawImage(sil, o[0], o[1]));
  c.globalCompositeOperation = 'destination-out'; c.drawImage(sil, 0, 0);
  c.globalCompositeOperation = 'source-in'; c.fillStyle = col; c.fillRect(0, 0, cv.width, cv.height);
  ctx.save();
  if (cut) { ctx.globalAlpha = cut; ctx.drawImage(grFlat(r, '#05070a'), x, y, r.w, r.h); }
  ctx.globalAlpha = a; ctx.drawImage(cv, x, y, r.w, r.h);
  ctx.restore();
}
// A dog tag on a ball chain, hung from the hook: what it takes to get this rifle. Its price is
// amber, and so is its edge, when you could buy it now. It swings in from the panel's edge (maxX).
function grDogTag(ctx, px, py, l1, l2, can, maxX) {
  const w = 68, h = 32, x = Math.min(px - 16, maxX - w - 4), y = py + 15, a = 0.08;
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; grRound(ctx, 2, 3.5, w, h, 9); ctx.fill();
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#47515d'); g.addColorStop(0.45, '#272e37'); g.addColorStop(1, '#191e25');
  ctx.fillStyle = g; grRound(ctx, 0, 0, w, h, 9); ctx.fill();
  ctx.strokeStyle = can ? grAmb(0.95) : 'rgba(196,210,226,0.6)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; grRound(ctx, 2.5, 2.5, w - 5, h - 5, 7); ctx.stroke();
  ctx.fillStyle = '#06080b'; ctx.beginPath(); ctx.arc(8, 8, 2.3, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(205,216,230,0.55)'; ctx.lineWidth = 0.8; ctx.stroke();
  grText(ctx, l1, w / 2 + 4, 11, grFitFont(ctx, l1, w - 18, 10, '800 %px ' + GR_HEAD), '#c7d1dc', 'center', 'rgba(0,0,0,0.9)');
  grText(ctx, l2, w / 2 + 4, 22.5, grFitFont(ctx, l2, w - 16, 12, '800 %px ' + GR_HEAD), can ? '#ffb84d' : '#e6eaee', 'center', 'rgba(0,0,0,0.9)');
  ctx.restore();
  // the chain: little steel balls from the hook down to the hole
  const hx = x + 8 * Math.cos(a) - 8 * Math.sin(a), hy = y + 8 * Math.sin(a) + 8 * Math.cos(a), qx = px - 5, qy = (py + hy) / 2 + 4;
  const n = Math.max(4, Math.round(Math.hypot(hx - px, hy - py) / 2.4));
  for (let i = 0; i <= n; i++) {
    const t = i / n, mx = (1 - t) * (1 - t) * px + 2 * (1 - t) * t * qx + t * t * hx, my = (1 - t) * (1 - t) * (py + 3) + 2 * (1 - t) * t * qy + t * t * hy;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.arc(mx + 0.5, my + 0.7, 1.05, 0, TAU); ctx.fill();
    ctx.fillStyle = '#a9b4c0'; ctx.beginPath(); ctx.arc(mx, my, 0.95, 0, TAU); ctx.fill();
  }
}
// A small padlock with its status light: the case is locked.
function grLock(ctx, x, y) {
  ctx.strokeStyle = '#8994a1'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y - 3, 3.4, Math.PI, 0); ctx.lineTo(x + 3.4, y); ctx.moveTo(x - 3.4, y - 3); ctx.lineTo(x - 3.4, y); ctx.stroke();
  const g = ctx.createLinearGradient(0, y - 1, 0, y + 7); g.addColorStop(0, '#9aa5b2'); g.addColorStop(1, '#4b5561');
  ctx.fillStyle = g; grRound(ctx, x - 5.2, y - 0.5, 10.4, 8, 1.5); ctx.fill();
  ctx.fillStyle = '#12161b'; ctx.beginPath(); ctx.arc(x, y + 2.6, 1.2, 0, TAU); ctx.fill(); ctx.fillRect(x - 0.5, y + 2.6, 1, 2.6);
  grGlow(ctx, x, y + 15, 9, 9, grAmb, 0.55);
  ctx.fillStyle = '#ffd08a'; ctx.beginPath(); ctx.arc(x, y + 15, 1.6, 0, TAU); ctx.fill();
}

// A rifle drawn on its own, so its exact outline can be used for the shadow on the wall, the
// hooks it rests on and the etched outline of an empty slot.
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
  grPlate(ctx, cx - w / 2, y, w, 27, [{ s: g.name.toUpperCase(), size: 12, font: '800 %px ' + GR_HEAD }, { s: l2, size: 9.5, font: '600 %px ' + GR_BODY, col: '#9eabb9' }]);
}
UI.grPaintRack = function (G, S, ctx, si) {
  const L = G.L, d = Save.data, rank = rankOf(d.xp).n, fav = G.fav;
  const lay = grSlots(L, S);
  grWall(ctx, L, 31 + si * 17);
  // the panels: one pegboard for each column, with its LED bar along the top
  for (let c = 0; c < lay.cols; c++) {
    const inCol = lay.slots.filter((s) => s.c === c); if (!inCol.length) continue;
    const s0 = inCol[0], s1 = inCol[inCol.length - 1], cx = s0.cx, ly = Math.max(L.sf.t + 46, lay.top - 6);
    const py = ly + 1, pb = Math.min(s1.y0 + s1.h + 4, L.floorY - 16);
    grPegboard(ctx, s0.x0 + 2, py, s0.w - 4, pb - py);
    grLedBar(ctx, cx, ly, Math.min(s0.w - 40, s0.bw * 0.78));
    S.ux = s0.bw * 0.3;
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
      [[3, 5, 0.2], [5, 8, 0.16], [8, 12, 0.12]].forEach((o) => { ctx.globalAlpha = o[2]; ctx.drawImage(sh, rx + o[0], ry + o[1], r.w, r.h); });
      ctx.globalAlpha = 1;
      pegs.forEach((p) => grHook(ctx, p.x, p.y - 1));
      if (grSkinMoves(sl.id, cfg)) S.anim.push({ id: sl.id, cfg, cx: sl.cx, cy: sl.cy, bw: sl.bw, bh: sl.bh });
      else ctx.drawImage(r.cv, rx, ry, r.w, r.h);
      grNameplate(ctx, sl.id, sl.cx, plateY, sl.w * 0.6);
    } else if (own) { // this one is in the glass case: empty hooks, its outline in amber, and a note
      grEtched(ctx, r, rx, ry, '#ffaa3c', 0.4, 0);
      pegs.forEach((p) => grHook(ctx, p.x, p.y - 1));
      grPlate(ctx, sl.cx - 80, plateY, 160, 27, [{ s: g.name.toUpperCase(), size: 12, font: '800 %px ' + GR_HEAD }, { s: 'On show in the glass case', size: 9.5, font: '600 %px ' + GR_BODY, col: '#ffb84d' }]);
    } else {
      grEtched(ctx, r, rx, ry, '#c4d4e6', 0.55, 0.28);
      pegs.forEach((p) => grHook(ctx, p.x, p.y - 1));
      const special = !!g.special, can = !special && rank >= g.rank && d.credits >= g.price;
      grDogTag(ctx, pegs[1].x, pegs[1].y + 3, special ? 'THE STORY' : 'RANK ' + g.rank, special ? 'Not for sale' : fmtCr(g.price) + ' cr', can, sl.x0 + sl.w - 8);
      grText(ctx, g.name.toUpperCase(), sl.cx - S.ux * 0.35, plateY + 12, '800 12px ' + GR_HEAD, 'rgba(206,220,236,0.5)');
    }
  });
  // an empty spot on a short rack: the rack's own plate
  if (lay.slots.length < lay.cols * lay.rows) {
    const c = lay.cols - 1, r = lay.rows - 1, x0 = L.left + c * (lay.colW + L.gap), y = lay.top + r * lay.rowH, w = Math.min(lay.colW * 0.7, 250);
    grPlate(ctx, x0 + lay.colW / 2 - w / 2, y + lay.rowH / 2 - 22, w, 44, [{ s: S.name.toUpperCase(), size: 15, font: '800 %px ' + GR_HEAD }, { s: S.sub, size: 10, font: '600 %px ' + GR_BODY, col: '#9eabb9' }]);
  }
  grVignette(ctx, L);
  S.slots = lay.slots;
};
UI.grPaintCase = function (G, S, ctx) {
  const L = G.L, d = Save.data, id = G.fav, cfg = gunCfg(id), g = GUN_BY_ID[id], B = grCaseBox(L), st = (d.stats.guns || {})[id] || { kills: 0, longest: 0 };
  grWall(ctx, L, 7);
  // the spotlight: a cone of cool light from the ceiling onto the case, with haze hanging in it
  const bx = L.W / 2, y0 = B.beamTop, y1 = B.y + B.h + B.plinth;
  const lid = clamp(B.h * 0.045, 5, 8);
  S.beam = { x: bx, y0: y0 + 14, y1: B.y - lid, w0: 22, w1: lerp(22, B.w * 1.16, (B.y - lid - y0 - 14) / (y1 - y0 - 14)) }; // the dust stays out of the sealed case
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath(); ctx.moveTo(bx - 11, y0 + 14); ctx.lineTo(bx + 11, y0 + 14); ctx.lineTo(bx + B.w * 0.58, y1); ctx.lineTo(bx - B.w * 0.58, y1); ctx.closePath();
  const bg = ctx.createLinearGradient(0, y0, 0, y1); bg.addColorStop(0, grLed(0.24)); bg.addColorStop(0.55, grLed(0.085)); bg.addColorStop(1, grLed(0.035));
  ctx.fillStyle = bg; ctx.fill(); ctx.clip();
  const HR = makeRng(23);
  for (let k = 0; k < 10; k++) {
    const v = HR.f(), yy = lerp(y0 + 30, y1, v), hw = lerp(11, B.w * 0.58, (yy - y0) / (y1 - y0)), xx = bx + HR.r(-0.75, 0.75) * hw, rr = Math.max(20, hw * HR.r(0.45, 0.9));
    const hg = ctx.createRadialGradient(xx, yy, 0, xx, yy, rr); hg.addColorStop(0, grLed(0.05)); hg.addColorStop(1, grLed(0));
    ctx.fillStyle = hg; ctx.fillRect(xx - rr, yy - rr, rr * 2, rr * 2);
  }
  ctx.restore();
  grGlow(ctx, bx, L.floorY + 3, B.w * 0.64, 14, grLed, 0.32);
  // the plinth: a block of matte black steel with a lit ledge, an amber strip under the ledge, the
  // engraved plate, and a lock
  const px = B.x + B.w * 0.04, pw = B.w * 0.92, py = B.y + B.h, ph = B.plinth;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#0b0e12'; ctx.fillRect(px, py, pw, ph); ctx.restore();
  const pg = ctx.createLinearGradient(px, 0, px + pw, 0); pg.addColorStop(0, '#0a0d11'); pg.addColorStop(0.5, '#1d242d'); pg.addColorStop(1, '#090c10');
  ctx.fillStyle = pg; ctx.fillRect(px, py, pw, ph);
  const pv = ctx.createLinearGradient(0, py, 0, py + ph); pv.addColorStop(0, 'rgba(0,0,0,0)'); pv.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = pv; ctx.fillRect(px, py, pw, ph);
  [px + 10, px + pw - 11].forEach((x) => { ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x, py + 16, 1, ph - 24); ctx.fillStyle = grLed(0.07); ctx.fillRect(x + 1, py + 16, 1, ph - 24); });
  const lg = ctx.createLinearGradient(0, py, 0, py + 8); lg.addColorStop(0, '#76818e'); lg.addColorStop(0.3, '#3b444f'); lg.addColorStop(1, '#151a20');
  ctx.fillStyle = lg; ctx.fillRect(px - 5, py, pw + 10, 8);
  ctx.fillStyle = grLed(0.6); ctx.fillRect(px - 5, py, pw + 10, 1);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const ag = ctx.createLinearGradient(0, py + 8, 0, py + 26); ag.addColorStop(0, grAmb(0.2)); ag.addColorStop(1, grAmb(0));
  ctx.fillStyle = ag; ctx.fillRect(px, py + 8, pw, 18); ctx.restore();
  ctx.fillStyle = '#ffc77e'; ctx.fillRect(px + 2, py + 8, pw - 4, 1.3);
  const kills = st.kills ? 'Most kills: ' + st.kills : 'The rifle you carry. No kills yet.';
  const plW = Math.min(pw * 0.62, 290), plH = Math.min(ph - 24, 46), plY = py + 15 + (ph - 24 - plH) / 2;
  grPlate(ctx, bx - plW / 2, plY, plW, plH, [{ s: g.name.toUpperCase(), size: 17, font: '800 %px ' + GR_HEAD }, { s: kills + (st.kills && st.longest ? '  ·  longest ' + st.longest + ' m' : ''), size: 11.5, font: '600 %px ' + GR_BODY, col: '#ffb84d' }]);
  if ((pw - plW) / 2 > 34) grLock(ctx, bx + plW / 2 + (pw - plW) / 4, plY + plH / 2 - 8);
  // inside the case: a dark backdrop lit up behind the rifle (so black metal stands out against
  // it), a floor seen a little from above, and a downlight in the lid
  const fh = clamp(B.h * 0.1, 9, 16), fl = B.y + B.h - fh;
  const vg = ctx.createLinearGradient(0, B.y, 0, fl); vg.addColorStop(0, '#151b23'); vg.addColorStop(1, '#0b0f14');
  ctx.fillStyle = vg; ctx.fillRect(B.x, B.y, B.w, B.h);
  ctx.save(); ctx.beginPath(); ctx.rect(B.x, B.y, B.w, B.h); ctx.clip();
  const R = makeRng(99);
  for (let k = 0; k < 500; k++) { ctx.fillStyle = R.f() < 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.025)'; ctx.fillRect(B.x + R.f() * B.w, B.y + R.f() * B.h, 1, 1); }
  grGlow(ctx, bx, B.y + B.h * 0.46, B.w * 0.5, B.h * 0.55, grLed, 0.26);
  const ff = ctx.createLinearGradient(0, fl, 0, B.y + B.h); ff.addColorStop(0, '#1b222a'); ff.addColorStop(1, '#2b333d');
  ctx.fillStyle = ff; ctx.fillRect(B.x, fl, B.w, fh);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(B.x, fl, B.w, 1);
  grGlow(ctx, bx, fl + fh * 0.55, B.w * 0.42, fh * 0.6, grLed, 0.16);
  ctx.globalCompositeOperation = 'lighter';
  const ig = ctx.createLinearGradient(0, B.y, 0, B.y + B.h * 0.6); ig.addColorStop(0, grLed(0.2)); ig.addColorStop(1, grLed(0));
  ctx.fillStyle = ig; ctx.fillRect(B.x, B.y, B.w, B.h * 0.6);
  ctx.restore();
  // the rifle on two steel posts with rubber cradles
  const bw = B.w - (L.portrait ? 30 : 54), bh = Math.min(B.h - 26, bw / 2.6), rx0 = bx, ry0 = B.y + B.h * 0.46;
  const r = grRender(id, cfg, bw, bh, G.dpr, 1.3), rx = rx0 - r.w / 2, ry = ry0 - r.h / 2;
  const data = r.cv.getContext('2d').getImageData(0, 0, r.cv.width, r.cv.height).data;
  [rx0 - bw * 0.27, rx0 + bw * 0.24].forEach((cx) => {
    const u = grUnder(r, data, cx - rx), y = u === null ? ry0 + 8 : ry + u, fy = fl + fh * 0.55;
    ctx.fillStyle = grLed(0.08); ctx.fillRect(cx - 1.8, fy + 2, 3.6, fh * 0.4); // the post, faintly, in the polished floor
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.ellipse(cx + 1, fy + 1, 9.5, 2.8, 0, 0, TAU); ctx.fill();
    const dg = ctx.createLinearGradient(cx - 8, 0, cx + 8, 0); dg.addColorStop(0, '#3a434d'); dg.addColorStop(0.45, '#aeb8c4'); dg.addColorStop(1, '#2a3139');
    ctx.fillStyle = dg; ctx.beginPath(); ctx.ellipse(cx, fy - 0.5, 8, 2.3, 0, 0, TAU); ctx.fill();
    const cg = ctx.createLinearGradient(cx - 2, 0, cx + 2, 0); cg.addColorStop(0, '#4b5560'); cg.addColorStop(0.45, '#e4eaf1'); cg.addColorStop(1, '#38414b');
    ctx.fillStyle = cg; ctx.fillRect(cx - 1.8, y + 2, 3.6, fy - y - 2);
    ctx.fillStyle = '#14171c'; ctx.beginPath(); ctx.moveTo(cx - 10, y - 5); ctx.quadraticCurveTo(cx, y + 10, cx + 10, y - 5); ctx.lineTo(cx + 7, y - 5); ctx.quadraticCurveTo(cx, y + 4, cx - 7, y - 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffaa3c'; ctx.fillRect(cx - 2.6, y + 3.4, 5.2, 1.4);
  });
  const sh = grFlat(r, '#000'); [[4, 7, 0.26], [7, 11, 0.18]].forEach((o) => { ctx.globalAlpha = o[2]; ctx.drawImage(sh, rx + o[0], ry + o[1], r.w, r.h); }); ctx.globalAlpha = 1;
  S.caseRifle = { id, cfg, cx: rx0, cy: ry0, bw, bh };
  S.box = B;
  const moves = grSkinMoves(id, cfg);
  if (moves) S.anim.push(S.caseRifle); else ctx.drawImage(r.cv, rx, ry, r.w, r.h);
  // an amber strip along the front of the case floor, lighting the rifle from below
  ctx.save(); ctx.beginPath(); ctx.rect(B.x, B.y, B.w, B.h); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
  const ug = ctx.createLinearGradient(0, B.y + B.h - 4, 0, B.y + B.h - 30); ug.addColorStop(0, grAmb(0.16)); ug.addColorStop(1, grAmb(0));
  ctx.fillStyle = ug; ctx.fillRect(B.x, B.y + B.h - 30, B.w, 26); ctx.restore();
  ctx.fillStyle = '#ffc77e'; ctx.fillRect(B.x + 6, B.y + B.h - 5.5, B.w - 12, 1.3);
  if (!moves) UI.grGlass(ctx, B);
  // the glass box: edges with the faint green of thick glass, a lid catching the spotlight, and a
  // black channel it stands in
  ctx.beginPath(); ctx.moveTo(B.x, B.y); ctx.lineTo(B.x + lid * 1.6, B.y - lid); ctx.lineTo(B.x + B.w - lid * 1.6, B.y - lid); ctx.lineTo(B.x + B.w, B.y); ctx.closePath();
  ctx.fillStyle = 'rgba(190,225,235,0.08)'; ctx.fill(); ctx.strokeStyle = 'rgba(190,235,230,0.38)'; ctx.lineWidth = 1; ctx.stroke();
  grGlow(ctx, bx, B.y - lid * 0.5, Math.min(110, B.w * 0.26), lid * 0.9, grLed, 0.5);
  [B.x, B.x + B.w].forEach((x) => {
    const eg = ctx.createLinearGradient(0, B.y, 0, B.y + B.h); eg.addColorStop(0, 'rgba(200,245,238,0.6)'); eg.addColorStop(1, 'rgba(170,225,220,0.22)');
    ctx.fillStyle = eg; ctx.fillRect(x - 1, B.y, 2, B.h);
    ctx.fillStyle = 'rgba(170,225,220,0.1)'; ctx.fillRect(x + (x === B.x ? 2 : -4), B.y, 2, B.h);
  });
  ctx.fillStyle = 'rgba(235,248,255,0.55)'; ctx.fillRect(B.x, B.y - 0.5, B.w, 1.2);
  const chg = ctx.createLinearGradient(0, B.y + B.h - 3, 0, B.y + B.h + 3); chg.addColorStop(0, '#4b5560'); chg.addColorStop(0.35, '#151a20'); chg.addColorStop(1, '#07090c');
  ctx.fillStyle = chg; ctx.fillRect(B.x - 3, B.y + B.h - 3, B.w + 6, 6);
  // the light fitting: a black can on a stem from the ceiling, its lens glowing
  ctx.fillStyle = '#05070a'; ctx.fillRect(bx - 1.5, Math.max(0, y0 - 40), 3, y0 - Math.max(0, y0 - 40));
  const fg = ctx.createLinearGradient(bx - 12, 0, bx + 12, 0); fg.addColorStop(0, '#0b0e12'); fg.addColorStop(0.4, '#48525d'); fg.addColorStop(1, '#0a0d10');
  ctx.fillStyle = fg; grRound(ctx, bx - 11, y0 - 8, 22, 22, 3); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; [y0 - 3, y0 + 2].forEach((yy) => ctx.fillRect(bx - 11, yy, 22, 1));
  grGlow(ctx, bx, y0 + 14, 40, 16, grLed, 0.6);
  ctx.fillStyle = '#f5f9ff'; ctx.beginPath(); ctx.ellipse(bx, y0 + 14, 10, 2.4, 0, 0, TAU); ctx.fill();
  // the collection on readouts either side (above the case when upright)
  const owned = Object.keys(d.guns).length, all = GUNS.length;
  const tk = Object.keys(d.stats.guns || {}).reduce((n, k) => n + (d.stats.guns[k].kills || 0), 0);
  const lw = L.portrait ? (L.right - L.left) * 0.42 : Math.min(118, B.x - L.left - 12), lh = 58;
  const ly = L.portrait ? L.top + 34 : B.y + 18, lx1 = L.portrait ? L.left : L.left + 4, lx2 = L.portrait ? L.right - lw : L.right - lw - 4;
  if (lw > 80) {
    grStat(ctx, lx1, ly, lw, lh, 'THE COLLECTION', owned + ' of ' + all);
    grStat(ctx, lx2, ly, lw, lh, 'ALL KILLS', String(tk));
    if (!L.portrait && d.stats.longest) grStat(ctx, lx2, ly + lh + 12, lw, lh, 'LONGEST SHOT', d.stats.longest + ' m');
  }
  grVignette(ctx, L);
  // dust in the beam, made once and then moved
  const DR = makeRng(5); S.dust = [];
  for (let i = 0, n = clamp(Math.round((S.beam.y1 - S.beam.y0) / 4), 24, 64); i < n; i++) S.dust.push({ u: DR.r(-1, 1), v: DR.f(), sp: DR.r(0.012, 0.04), ph: DR.r(0, 6), sw: DR.r(0.02, 0.07), r: DR.r(0.5, 1.6), tw: DR.r(1, 3) });
};
// The front glass: a faint tint, slanted reflections, a sheen in the top corner and a bright top
// edge. Drawn over the rifle.
UI.grGlass = function (ctx, B) {
  ctx.save(); ctx.beginPath(); ctx.rect(B.x, B.y, B.w, B.h); ctx.clip();
  ctx.fillStyle = 'rgba(170,205,225,0.045)'; ctx.fillRect(B.x, B.y, B.w, B.h);
  ctx.globalCompositeOperation = 'lighter';
  [[0.1, 0.1, 0.075], [0.215, 0.032, 0.06], [0.71, 0.065, 0.05]].forEach((q) => {
    const x = B.x + B.w * q[0], w = B.w * q[1];
    ctx.fillStyle = 'rgba(215,232,250,' + q[2] + ')'; ctx.beginPath(); ctx.moveTo(x + B.h * 0.5, B.y); ctx.lineTo(x + B.h * 0.5 + w, B.y); ctx.lineTo(x + w, B.y + B.h); ctx.lineTo(x, B.y + B.h); ctx.closePath(); ctx.fill();
  });
  const sg = ctx.createLinearGradient(B.x, B.y, B.x + B.w * 0.35, B.y + B.h * 0.7); sg.addColorStop(0, 'rgba(215,232,250,0.07)'); sg.addColorStop(1, 'rgba(215,232,250,0)');
  ctx.fillStyle = sg; ctx.fillRect(B.x, B.y, B.w, B.h);
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
      ctx.fillStyle = 'rgba(228,238,252,' + (a * 0.85).toFixed(3) + ')';
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
