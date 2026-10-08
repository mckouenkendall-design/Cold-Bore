// ---------------------------------------------------------------------------
// Part artwork, drawn in code: a detailed side view of every scope and every
// part, plus the view through each scope. Same look as the rifles in
// 11_gunart.js (flat fills, light from above, thin dark outline), with more
// detail because these are shown large. Units are roughly centimetres and the
// muzzle end points right, the same as the rifle art, so skin patterns come
// out at the same size they have on the rifle.
//
//   drawPartArt(ctx, slot, id, x, y, w, h, o)    one part, fitted in a box
//   drawReticleThumb(ctx, scopeId, cx, cy, r, o)  the glass of one scope
// ---------------------------------------------------------------------------
const paFONT = 'ui-monospace,"SF Mono",Menlo,Consolas,monospace';
const paNO = {};
let paBuf = null; // scratch canvas for pictures that fade out or are greyed

// ---- the drawing kit -------------------------------------------------------
// A drawer adds shapes to a kit. The kit measures them, then paints them all
// fitted to the box. Every shape gets a fill, a light-and-shade pass and an
// outline, exactly as the rifle pieces do.
function paKit(env) {
  this.env = env; this.ops = [];
  this.x0 = 1e9; this.y0 = 1e9; this.x1 = -1e9; this.y1 = -1e9;
  this.fr = null; this.buf = false; this.s = 1; this.k = 1; this.fc = {};
  this.lineCol = (!env.fac && env.skin.line) ? env.skin.line : 'rgba(0,0,0,0.62)';
  this.Z = { furn: env.paints.furn, metal: env.paints.metal, acc: env.paints.acc, rubber: '#0d0e10', bag: '#b9a27e', glass: '#27384a', carbon: { pat: 'carbon', a: '#30353c', b: '#15171b' } };
}
paKit.prototype.ext = function (x0, y0, x1, y1) {
  if (x0 < this.x0) this.x0 = x0; if (y0 < this.y0) this.y0 = y0; if (x1 > this.x1) this.x1 = x1; if (y1 > this.y1) this.y1 = y1;
};
paKit.prototype.frame = function (x0, y0, x1, y1) { this.fr = [x0, y0, x1, y1]; };
// A frame of a set size centred on what was drawn, so siblings keep one scale and each sits in the
// middle. keep (0..1) is how strictly: below 1 a small sibling is allowed to grow a little.
paKit.prototype.frameSize = function (w, h, keep) {
  const cx = (this.x0 + this.x1) / 2, cy = (this.y0 + this.y1) / 2, k = keep === undefined ? 1 : keep;
  const f = Math.max((this.x1 - this.x0) / w, (this.y1 - this.y0) / h, 0.01), g = Math.min(1, f + (1 - f) * k);
  this.fr = [cx - (w * g) / 2, cy - (h * g) / 2, cx + (w * g) / 2, cy + (h * g) / 2];
};
paKit.prototype.add = function (fn) { this.ops.push(fn); };
paKit.prototype.px = function (n) { return (n * this.k) / this.s; };
paKit.prototype.fillOf = function (c, zone) {
  let p = zone;
  if (typeof p === 'string' && this.Z[p] !== undefined) p = this.Z[p];
  if (typeof p === 'string') return p;
  const key = typeof zone === 'string' ? zone : JSON.stringify(zone);
  if (this.fc[key]) return this.fc[key];
  const f = zoneFill(c, p, { x0: this.x0, x1: this.x1 }, this.env.time);
  this.fc[key] = f; return f;
};
paKit.prototype.shade = function (c, type, bb, k) {
  k = k === undefined ? 1 : k;
  const W = (a) => 'rgba(255,255,255,' + (a * k).toFixed(3) + ')', B = (a) => 'rgba(0,0,0,' + Math.min(1, a * k).toFixed(3) + ')';
  let g;
  if (type === 'cylv') { // an upright cylinder, lit from the left
    g = c.createLinearGradient(bb[0], 0, bb[2], 0);
    g.addColorStop(0, B(0.3)); g.addColorStop(0.2, W(0.27)); g.addColorStop(0.42, W(0.03)); g.addColorStop(0.75, B(0.22)); g.addColorStop(1, B(0.5));
    return g;
  }
  g = c.createLinearGradient(0, bb[1], 0, bb[3]);
  if (type === 'cyl') { // a lying cylinder: bright band near the top, dark belly, a little bounce light
    g.addColorStop(0, W(0.1)); g.addColorStop(0.17, W(0.36)); g.addColorStop(0.36, W(0.05)); g.addColorStop(0.62, B(0.14)); g.addColorStop(0.9, B(0.5)); g.addColorStop(1, B(0.34));
  } else if (type === 'soft') {
    g.addColorStop(0, W(0.14)); g.addColorStop(0.35, W(0.02)); g.addColorStop(1, B(0.3));
  } else {
    g.addColorStop(0, W(0.22)); g.addColorStop(0.25, W(0.04)); g.addColorStop(0.7, B(0.06)); g.addColorStop(1, B(0.4));
  }
  return g;
};
// fill + tint + shade + outline for the current path
paKit.prototype.paint = function (c, zone, bb, o) {
  o = o || paNO;
  const eo = o.eo ? 'evenodd' : 'nonzero';
  if (o.alpha !== undefined) c.globalAlpha = o.alpha;
  if (zone) { c.fillStyle = this.fillOf(c, zone); c.fill(eo); }
  if (o.tint) { c.fillStyle = o.tint; c.fill(eo); }
  const sh = o.sh === undefined ? (zone === 'rubber' ? 'soft' : 'flat') : o.sh;
  if (sh) { c.fillStyle = this.shade(c, sh, bb, o.k); c.fill(eo); }
  if (o.line !== false) { c.strokeStyle = o.lc || this.lineCol; c.lineWidth = this.px(o.lw || 1); c.stroke(); }
  if (o.alpha !== undefined) c.globalAlpha = 1;
};
paKit.prototype.shape = function (zone, bb, pathFn, o) {
  this.ext(bb[0], bb[1], bb[2], bb[3]);
  this.ops.push((c, K) => { c.beginPath(); pathFn(c); K.paint(c, zone, bb, o); });
};
function paBB(pts) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < pts.length; i += 2) { const x = pts[i], y = pts[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}
function paPolyPath(c, pts) { c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); }
// a polygon with rounded corners; r is one radius or one per corner
function paRPath(c, pts, r) {
  const n = pts.length / 2, lx = pts[2 * n - 2], ly = pts[2 * n - 1];
  c.moveTo((lx + pts[0]) / 2, (ly + pts[1]) / 2);
  for (let i = 0; i < n; i++) {
    const x = pts[2 * i], y = pts[2 * i + 1], j = (i + 1) % n, ri = typeof r === 'number' ? r : (r[i] || 0);
    if (ri > 0) c.arcTo(x, y, pts[2 * j], pts[2 * j + 1], ri); else c.lineTo(x, y);
  }
  c.closePath();
}
function paRectPath(c, x, y, w, h, r) {
  r = Math.min(r || 0, w / 2, h / 2);
  if (r <= 0) { c.rect(x, y, w, h); return; }
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
paKit.prototype.poly = function (zone, pts, o) { this.shape(zone, paBB(pts), (c) => { paPolyPath(c, pts); if (o && o.hole) paPolyPath(c, o.hole); }, o && o.hole ? Object.assign({ eo: true }, o) : o); };
// o.hole: one polygon cut out. o.holes: several, each [x, y, w, h, radius] or a list of polygon points.
paKit.prototype.rpoly = function (zone, pts, r, o) {
  const cut = o && (o.hole || o.holes);
  this.shape(zone, paBB(pts), (c) => {
    paRPath(c, pts, r);
    if (o && o.hole) paRPath(c, o.hole, o.hr || 0.3);
    if (o && o.holes) o.holes.forEach((h) => { if (h.length === 5) paRectPath(c, h[0], h[1], h[2], h[3], h[4]); else paRPath(c, h, o.hr || 0.3); });
  }, cut ? Object.assign({ eo: true }, o) : o);
};
paKit.prototype.rect = function (zone, x, y, w, h, r, o) { this.shape(zone, [x, y, x + w, y + h], (c) => paRectPath(c, x, y, w, h, r), o); };
paKit.prototype.ell = function (zone, x, y, rx, ry, o) { this.shape(zone, [x - rx, y - ry, x + rx, y + ry], (c) => c.ellipse(x, y, rx, ry, 0, 0, TAU), o); };
paKit.prototype.circ = function (zone, x, y, r, o) { this.ell(zone, x, y, r, r, o); };
// a lying cylinder or cone from x0 to x1 around the centre line y
paKit.prototype.tube = function (zone, x0, x1, y, r0, r1, o) {
  this.poly(zone, [x0, y - r0, x1, y - r1, x1, y + r1, x0, y + r0], Object.assign({ sh: 'cyl' }, o || paNO));
};
// a stroked line with a width in drawing units (legs, straps, wires)
paKit.prototype.line = function (col, pts, w, o) {
  o = o || paNO;
  const bb = paBB(pts); this.ext(bb[0] - w / 2, bb[1] - w / 2, bb[2] + w / 2, bb[3] + w / 2);
  this.ops.push((c) => {
    c.save(); c.lineCap = o.cap || 'round'; c.lineJoin = 'round'; c.strokeStyle = col; c.lineWidth = w;
    if (o.dash) c.setLineDash(o.dash);
    if (o.alpha !== undefined) c.globalAlpha = o.alpha;
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    if (o.curve) { for (let i = 2; i < pts.length - 2; i += 2) c.quadraticCurveTo(pts[i], pts[i + 1], (pts[i] + pts[i + 2]) / 2, (pts[i + 1] + pts[i + 3]) / 2); c.lineTo(pts[pts.length - 2], pts[pts.length - 1]); }
    else for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    if (o.close) c.closePath();
    c.stroke(); c.restore();
  });
};
// a hairline with a width in screen pixels (engraving, joints, highlights)
paKit.prototype.hair = function (col, pts, wpx, o) {
  o = o || paNO;
  this.ops.push((c, K) => {
    c.save(); c.lineCap = o.cap || 'butt'; c.strokeStyle = col; c.lineWidth = K.px(wpx || 0.8);
    if (o.dash) c.setLineDash(o.dash);
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    if (o.curve) { for (let i = 2; i < pts.length - 2; i += 2) c.quadraticCurveTo(pts[i], pts[i + 1], (pts[i] + pts[i + 2]) / 2, (pts[i + 1] + pts[i + 3]) / 2); c.lineTo(pts[pts.length - 2], pts[pts.length - 1]); }
    else for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.stroke(); c.restore();
  });
};
paKit.prototype.hi = function (pts, wpx, a) { this.hair('rgba(255,255,255,' + (a === undefined ? 0.3 : a) + ')', pts, wpx || 0.9, { cap: 'round' }); };
paKit.prototype.lo = function (pts, wpx, a) { this.hair('rgba(0,0,0,' + (a === undefined ? 0.5 : a) + ')', pts, wpx || 0.8); };
// small engraved text; skipped when it would be too small to read
paKit.prototype.text = function (s, x, y, size, col, o) {
  o = o || paNO;
  this.ops.push((c, K) => {
    if (size * K.s < (o.min || 4.2)) return;
    c.save(); c.font = (o.wt || '700') + ' ' + size + 'px ' + paFONT; c.textAlign = o.al || 'center'; c.textBaseline = o.base || 'middle';
    c.fillStyle = col || 'rgba(235,238,242,0.8)';
    if (o.rot) { c.translate(x, y); c.rotate(o.rot); c.fillText(s, 0, 0); } else c.fillText(s, x, y);
    c.restore();
  });
};
// a screw head or bolt, seen end on
paKit.prototype.screw = function (x, y, r, col, hex) {
  this.ops.push((c, K) => {
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = col || '#30343a'; c.fill();
    const g = c.createLinearGradient(0, y - r, 0, y + r); g.addColorStop(0, 'rgba(255,255,255,0.4)'); g.addColorStop(0.5, 'rgba(255,255,255,0.02)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
    c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(0,0,0,0.75)'; c.lineWidth = K.px(0.7); c.stroke();
    if (r * K.s < 1.6) return;
    c.beginPath();
    if (hex) { for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3; c.lineTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55); } c.closePath(); c.fillStyle = 'rgba(0,0,0,0.6)'; c.fill(); }
    else { c.moveTo(x - r * 0.7, y - r * 0.3); c.lineTo(x + r * 0.7, y + r * 0.3); c.strokeStyle = 'rgba(0,0,0,0.8)'; c.lineWidth = K.px(0.9); c.stroke(); }
  });
};
// straight ridges inside a rectangle (grip rings, heat fins)
paKit.prototype.ridges = function (x, y, w, h, step, a, across) {
  this.ops.push((c, K) => {
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.lineWidth = K.px(0.75);
    const span = across ? h : w, st = Math.max(step, 2.3 / K.s);
    if (st * 1.5 > span) { c.restore(); return; }
    for (let pass = 0; pass < 2; pass++) {
      c.strokeStyle = pass ? 'rgba(255,255,255,' + (a === undefined ? 0.4 : a) * 0.28 + ')' : 'rgba(0,0,0,' + (a === undefined ? 0.4 : a) + ')';
      c.beginPath();
      if (across) for (let i = y + st * (0.5 + pass * 0.5); i < y + h; i += st) { c.moveTo(x, i); c.lineTo(x + w, i); }
      else for (let i = x + st * (0.5 + pass * 0.5); i < x + w; i += st) { c.moveTo(i, y); c.lineTo(i, y + h); }
      c.stroke();
    }
    c.restore();
  });
};
// diamond knurling or chequering inside a polygon
paKit.prototype.hatch = function (pts, step, a, col) {
  const bb = paBB(pts);
  this.ops.push((c, K) => {
    c.save(); c.beginPath(); paPolyPath(c, pts); c.clip(); c.lineWidth = K.px(0.7); c.strokeStyle = col || 'rgba(0,0,0,' + (a === undefined ? 0.42 : a) + ')';
    const h = bb[3] - bb[1], st = Math.max(step, 2.6 / K.s); c.beginPath();
    for (let i = bb[0] - h; i < bb[2] + h; i += st) { c.moveTo(i, bb[1]); c.lineTo(i + h, bb[3]); c.moveTo(i + h, bb[1]); c.lineTo(i, bb[3]); }
    c.stroke(); c.restore();
  });
};
// a row of dashes along a line: stitching
paKit.prototype.stitch = function (pts, col, wpx, curve) {
  this.ops.push((c, K) => {
    c.save(); c.strokeStyle = col || 'rgba(240,230,205,0.7)'; c.lineWidth = K.px(wpx || 1); c.lineCap = 'round'; c.setLineDash([K.px(2.6), K.px(2.2)]);
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    if (curve) { for (let i = 2; i < pts.length - 2; i += 2) c.quadraticCurveTo(pts[i], pts[i + 1], (pts[i] + pts[i + 2]) / 2, (pts[i + 1] + pts[i + 3]) / 2); c.lineTo(pts[pts.length - 2], pts[pts.length - 1]); }
    else for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.stroke(); c.restore();
  });
};
// a coil spring seen from the side, between two points
paKit.prototype.spring = function (xa, ya, xb, yb, n, amp, col, w) {
  const pts = [xa, ya], dx = xb - xa, dy = yb - ya, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, s = i % 2 ? -1 : 1; pts.push(xa + dx * t + nx * amp * s, ya + dy * t + ny * amp * s); }
  pts.push(xb, yb);
  this.line('rgba(0,0,0,0.55)', pts, w * 1.7, { cap: 'butt' });
  this.line(col || '#9aa2ab', pts, w, { cap: 'butt' });
};
// fade the picture out to nothing between xa (solid) and xb (gone): the part carries on out of view
paKit.prototype.fadeX = function (xa, xb, y0, y1) {
  this.buf = true;
  this.ops.push((c, K) => {
    if (!K.inBuf) return;
    c.save(); c.globalCompositeOperation = 'destination-out';
    const g = c.createLinearGradient(xa, 0, xb, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = g; const ya = y0 === undefined ? -400 : y0, yb = y1 === undefined ? 400 : y1;
    if (xb > xa) c.fillRect(xa, ya, 400, yb - ya); else c.fillRect(xb - 400, ya, xa - xb + 400, yb - ya);
    c.restore();
  });
};
// the four corners of a thick, possibly tapering, bar between two points
function paQuad(x0, y0, x1, y1, w0, w1) {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  w1 = w1 === undefined ? w0 : w1;
  return [x0 + (nx * w0) / 2, y0 + (ny * w0) / 2, x1 + (nx * w1) / 2, y1 + (ny * w1) / 2, x1 - (nx * w1) / 2, y1 - (ny * w1) / 2, x0 - (nx * w0) / 2, y0 - (ny * w0) / 2];
}

// Paint a finished kit into the box.
function paRender(ctx, K, x, y, w, h, o) {
  const f = K.fr || [K.x0, K.y0, K.x1, K.y1];
  const bw = Math.max(0.01, f[2] - f[0]), bh = Math.max(0.01, f[3] - f[1]);
  const s = Math.min(w / bw, h / bh) * (o.fit || 0.92);
  K.s = s; K.k = clamp(Math.min(w, h * 1.5) / 110, 0.7, 1.7); K.fc = {};
  const ox = x + w / 2 - ((f[0] + f[2]) / 2) * s, oy = y + h / 2 - ((f[1] + f[3]) / 2) * s;
  const dim = clamp(o.dim || 0, 0, 1);
  const run = (c) => {
    c.save(); c.translate(ox, oy); c.scale(s, s); c.lineJoin = 'round'; c.lineCap = 'butt';
    for (let i = 0; i < K.ops.length; i++) K.ops[i](c, K);
    c.restore();
  };
  const m = ctx.getTransform ? ctx.getTransform() : null;
  const straight = m && Math.abs(m.b) < 1e-6 && Math.abs(m.c) < 1e-6 && m.a > 0 && m.d > 0;
  if ((K.buf || dim > 0) && straight) {
    // draw into a scratch canvas at the true pixel size, then lay that down
    const px0 = Math.floor(m.a * x + m.e) - 1, py0 = Math.floor(m.d * y + m.f) - 1;
    const pw = Math.ceil(m.a * w) + 3, ph = Math.ceil(m.d * h) + 3;
    if (!paBuf) paBuf = document.createElement('canvas');
    if (paBuf.width < pw || paBuf.height < ph) { paBuf.width = Math.max(paBuf.width, pw); paBuf.height = Math.max(paBuf.height, ph); }
    const b = paBuf.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0); b.globalAlpha = 1; b.globalCompositeOperation = 'source-over'; b.clearRect(0, 0, pw, ph);
    b.setTransform(m.a, 0, 0, m.d, m.e - px0, m.f - py0);
    K.inBuf = true; run(b); K.inBuf = false;
    if (dim > 0) { // locked: wash the colour out towards a flat blue-grey
      b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'source-atop'; b.fillStyle = 'rgba(122,132,146,' + (0.66 * dim).toFixed(3) + ')'; b.fillRect(0, 0, pw, ph); b.globalCompositeOperation = 'source-over';
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha *= 1 - 0.3 * dim; ctx.drawImage(paBuf, 0, 0, pw, ph, px0, py0, pw, ph); ctx.restore();
  } else {
    K.inBuf = false;
    if (dim > 0) { ctx.save(); ctx.globalAlpha *= 1 - 0.55 * dim; run(ctx); ctx.restore(); } else run(ctx);
  }
  return { scale: s };
}

// Colours and facts about the rifle a part belongs to.
function paEnv(o) {
  o = o || paNO;
  const gunId = GUN_BY_ID[o.gunId] ? o.gunId : 'fenwick';
  const g = GUN_BY_ID[gunId], A = GUN_ART[gunId] || GUN_ART.fenwick;
  const cfg = Object.assign(defaultConfig(gunId), o.cfg || {});
  const skin = SKIN_BY_ID[cfg.skin || 'factory'] || SKIN_BY_ID.factory, fac = skin.kind === 'factory';
  const paints = { furn: fac ? A.furn : skin.furn, metal: fac ? A.metal : skin.metal, acc: fac ? A.acc : (skin.acc || A.acc) };
  return { gunId, g, A, cfg, skin, fac, paints, time: o.time || 0 };
}

// ===========================================================================
// SCOPES
// ===========================================================================
// L length, tr main tube radius, ob objective radius, oc eyepiece radius,
// col the scope's own finish (used with the factory skin), mm objective size.
const paSC = {
  hunter: { L: 31, tr: 1.3, ob: 2.35, oc: 2.0, col: '#1c2026', tur: 'cap', mm: 40 },
  zf4: { L: 22, tr: 1.1, ob: 1.45, oc: 1.5, col: '#3b424b' },
  ranger: { L: 33, tr: 1.5, ob: 2.75, oc: 2.15, col: '#2b312c', tur: 'mid', mm: 44, ao: true },
  bdc: { L: 32, tr: 1.5, ob: 2.6, oc: 2.15, col: '#26292e', tur: 'bdc', mm: 42 },
  pso: { L: 24, tr: 1.7, ob: 2.3, oc: 2.2, col: '#464d55' },
  tac: { L: 36, tr: 1.75, ob: 3.15, oc: 2.3, col: '#1d2025', tur: 'tall', mount: 'one', mm: 50, caps: true },
  night: { L: 27, tr: 2.6, ob: 3.3, oc: 2.3, col: '#30392b' },
  lrf: { L: 36, tr: 1.75, ob: 3.1, oc: 2.3, col: '#282c33', tur: 'tall', mount: 'one', mm: 50, pod: true },
  tree: { L: 38, tr: 1.8, ob: 3.3, oc: 2.35, col: '#23272d', tur: 'lock', mount: 'one', mm: 56, shade: 3.4, lever: true, comb: true },
  comp: { L: 42, tr: 1.8, ob: 3.6, oc: 2.35, col: '#525961', tur: 'target', mm: 60, shade: 8.5, wheel: true, high: true },
  oracle: { L: 33, tr: 2.6, ob: 3.2, oc: 2.6, col: '#252b34' },
};
const paLENS = ['#a9e0ff', '#2b4d70', '#7e58c8'];

// the front glass, seen a little from the front so the coatings show
function paLens(K, x, y, r, cols, comb) {
  cols = cols || paLENS;
  K.ext(x - r * 0.3, y - r, x + r * 0.3, y + r);
  K.add((c, k) => {
    c.beginPath(); c.ellipse(x, y, r * 0.3, r, 0, 0, TAU); c.fillStyle = '#08090b'; c.fill(); c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = k.px(1); c.stroke();
    c.beginPath(); c.ellipse(x, y, r * 0.265, r * 0.9, 0, 0, TAU); c.strokeStyle = 'rgba(255,255,255,0.16)'; c.lineWidth = k.px(0.8); c.stroke();
    const g = c.createLinearGradient(x, y - r, x, y + r); g.addColorStop(0, cols[0]); g.addColorStop(0.5, cols[1]); g.addColorStop(1, cols[2]);
    c.beginPath(); c.ellipse(x, y, r * 0.3 * 0.8, r * 0.8, 0, 0, TAU); c.fillStyle = g; c.fill();
    if (comb && r * k.s > 9) { // honeycomb anti-glare screen
      c.save(); c.clip(); c.strokeStyle = 'rgba(0,0,0,0.75)'; c.lineWidth = k.px(0.9); c.beginPath();
      const st = r * 0.3;
      for (let i = -4; i <= 4; i++) { c.moveTo(x - r, y + i * st); c.lineTo(x + r, y + i * st); }
      for (let i = -2; i <= 2; i++) { c.moveTo(x + i * st * 0.34, y - r); c.lineTo(x + i * st * 0.34, y + r); }
      c.stroke(); c.restore();
    }
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = k.px(1.2); c.lineCap = 'round';
    c.beginPath(); c.ellipse(x, y, r * 0.3 * 0.55, r * 0.58, 0, Math.PI * 1.08, Math.PI * 1.42); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = k.px(0.9);
    c.beginPath(); c.ellipse(x, y, r * 0.3 * 0.5, r * 0.5, 0, Math.PI * 0.15, Math.PI * 0.4); c.stroke();
    c.lineCap = 'butt';
  });
}

// an adjustment knob standing on the scope, built upward from y as a stack of rings
function paStack(K, x, y, segs, B) {
  let yy = y;
  segs.forEach((sg) => {
    const w = sg.w, h = sg.h, x0 = x - w / 2, y0 = yy - h;
    if (sg.dome) K.rpoly(sg.col || B, [x0, yy, x0, y0, x0 + w, y0, x0 + w, yy], [0, Math.min(0.6, h * 0.4), Math.min(0.6, h * 0.4), 0], { sh: 'cylv', tint: sg.tint });
    else K.rect(sg.col || B, x0, y0, w, h, Math.min(0.12, h * 0.3), { sh: 'cylv', tint: sg.tint });
    if (sg.kn === 'v') K.ridges(x0 + 0.05, y0 + h * 0.1, w - 0.1, h * (sg.dome ? 0.55 : 0.8) + (sg.dome ? h * 0.3 : 0), sg.step || 0.2, 0.5);
    if (sg.kn === 'x') K.hatch([x0 + 0.05, y0 + 0.08, x0 + w - 0.05, y0 + 0.08, x0 + w - 0.05, yy - 0.08, x0 + 0.05, yy - 0.08], sg.step || 0.24, 0.5);
    if (sg.ticks) { const n = sg.ticks; for (let i = 0; i <= n; i++) { const tx = x0 + 0.12 + ((w - 0.24) * i) / n, big = i % (sg.major || 5) === 0; K.hair(sg.numCol || 'rgba(235,238,242,0.8)', [tx, yy - 0.03, tx, yy - (big ? h * 0.38 : h * 0.2)], big ? 0.9 : 0.6); } }
    if (sg.nums) { const n = sg.nums.length, sz = sg.sz || Math.min(h * 0.62, (w / n) * 0.9); sg.nums.forEach((s, i) => K.text(s, x0 + (w * (i + 0.5)) / n, y0 + h * (sg.ticks ? 0.36 : 0.52), sz, sg.numCol)); }
    yy = y0;
  });
  return yy;
}
const paTUR = {
  cap: [{ w: 2.9, h: 0.42 }, { w: 2.5, h: 1.55, dome: true, kn: 'v' }],
  mid: [{ w: 3.1, h: 0.45 }, { w: 2.8, h: 0.95, nums: ['0', '1', '2'], ticks: 10, tint: 'rgba(255,255,255,0.05)' }, { w: 3.05, h: 1.15, kn: 'v' }, { w: 2.2, h: 0.24 }],
  tall: [{ w: 3.6, h: 0.42 }, { w: 3.25, h: 1.25, nums: ['0', '1', '2', '3'], ticks: 16, major: 4, tint: 'rgba(255,255,255,0.06)' }, { w: 3.3, h: 0.2, col: '#b8322c' }, { w: 3.7, h: 1.45, kn: 'x' }, { w: 2.9, h: 0.3 }],
  lock: [{ w: 3.7, h: 0.45 }, { w: 3.35, h: 1.3, nums: ['8', '9', '0', '1'], ticks: 16, major: 4, tint: 'rgba(255,255,255,0.06)' }, { w: 3.8, h: 1.25, kn: 'v', step: 0.3 }, { w: 3.1, h: 0.5, col: '#2aa79b' }, { w: 2.3, h: 0.3 }],
  target: [{ w: 3.0, h: 0.4 }, { w: 2.6, h: 1.35, nums: ['0', '5', '10'], ticks: 20, tint: 'rgba(255,255,255,0.1)' }, { w: 2.6, h: 0.95, nums: ['1', '2', '3'], tint: 'rgba(255,255,255,0.04)', sz: 0.55 }, { w: 3.4, h: 1.7, kn: 'v', step: 0.17 }, { w: 2.5, h: 0.35 }],
  bdc: [{ w: 3.4, h: 0.38 }, { w: 4.1, h: 1.4, nums: ['2', '3', '4', '5', '6'], numCol: '#f2c84a', ticks: 15, major: 3, tint: 'rgba(0,0,0,0.12)' }, { w: 3.2, h: 0.5, kn: 'v' }],
  drum: [{ w: 2.2, h: 0.3 }, { w: 2.8, h: 1.2, nums: ['1', '2', '3', '4'], ticks: 12, major: 3, tint: 'rgba(255,255,255,0.05)' }, { w: 1.5, h: 0.3 }],
  pso: [{ w: 3.4, h: 0.4 }, { w: 3.9, h: 1.55, nums: ['2', '4', '6', '8'], ticks: 16, major: 4, tint: 'rgba(255,255,255,0.05)' }, { w: 3.9, h: 0.5, kn: 'v' }, { w: 2.4, h: 0.3 }],
};
// a knob facing the viewer
function paDial(K, x, y, r, B, o) {
  o = o || paNO;
  K.circ(o.col || B, x, y, r, { tint: o.tint });
  K.add((c, k) => {
    c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = k.px(0.7); c.beginPath();
    const n = o.n || 28; for (let i = 0; i < n; i++) { const a = (i / n) * TAU; c.moveTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82); c.lineTo(x + Math.cos(a) * r * 0.99, y + Math.sin(a) * r * 0.99); }
    c.stroke();
  });
  K.circ(o.col || B, x, y, r * 0.76, { tint: 'rgba(255,255,255,0.06)' });
  if (o.marks) K.add((c, k) => {
    c.strokeStyle = o.markCol || 'rgba(235,238,242,0.8)'; c.lineWidth = k.px(0.7); c.beginPath();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU - Math.PI / 2, l = i % 3 === 0 ? 0.5 : 0.62; c.moveTo(x + Math.cos(a) * r * l, y + Math.sin(a) * r * l); c.lineTo(x + Math.cos(a) * r * 0.72, y + Math.sin(a) * r * 0.72); }
    c.stroke();
  });
  K.screw(x, y, r * (o.hub || 0.26), null, true);
}
// rings and base. First pass (front false) draws the feet behind the tube, second the bands around it.
function paMount(K, D, r1, r2, tr, front) {
  const mc = '#191b20', yb = tr + (D.high ? 3.1 : 2.3), rw = 1.7, rr = tr + 0.42, one = D.mount === 'one';
  if (!front) {
    [r1, r2].forEach((x) => K.poly(mc, [x - rw / 2, tr * 0.4, x + rw / 2, tr * 0.4, x + rw / 2 + 0.4, yb + 0.2, x - rw / 2 - 0.4, yb + 0.2]));
    if (one) {
      K.rect(mc, r1 - 2, yb - 1.1, r2 - r1 + 4, 1.5, 0.3);
      for (let x = r1 + 1.8; x < r2 - 2.6; x += 2.3) K.rect('#08090b', x, yb - 0.75, 1.5, 0.7, 0.3, { sh: null, lc: 'rgba(255,255,255,0.08)' });
      K.rect(mc, r1 - 2.3, yb + 0.3, r2 - r1 + 4.6, 1.3, 0.25, { tint: 'rgba(255,255,255,0.03)' });
      [r1 - 1.1, (r1 + r2) / 2, r2 + 1.1].forEach((x) => K.screw(x, yb + 0.95, 0.42, '#3a3f46', true));
    } else {
      [r1, r2].forEach((x) => { K.rect(mc, x - 1.55, yb + 0.1, 3.1, 1.4, 0.25); K.screw(x, yb + 0.8, 0.44, '#3a3f46', true); });
    }
  } else {
    [r1, r2].forEach((x) => {
      K.rect(mc, x - rw / 2, -rr, rw, rr * 2, 0.4, { sh: 'cyl' });
      K.lo([x - rw / 2, 0.05, x + rw / 2, 0.05], 0.9, 0.7);
      K.screw(x - 0.38, -rr * 0.52, 0.2, '#3a3f46', true); K.screw(x + 0.38, -rr * 0.52, 0.2, '#3a3f46', true);
      K.screw(x - 0.38, rr * 0.56, 0.2, '#3a3f46', true); K.screw(x + 0.38, rr * 0.56, 0.2, '#3a3f46', true);
    });
  }
}

// the ordinary shape: eyepiece, zoom ring, tube with a turret saddle, bell, objective
function paScopeStd(K, id, D, B) {
  const L = D.L, tr = D.tr, ob = D.ob, oc = D.oc, sc = SCOPE_BY_ID[id] || paNO;
  const xe = 5.0, xp0 = 6.4, xp1 = 8.9, xB = L - 11.5, xO = L - 6.5;
  const sw = 4.5, tx = (xp1 + xB) / 2 + 0.2, ts = tr * 1.24, pr = tr * 1.36;
  const r1 = (xp1 + tx - sw / 2) / 2 + 0.1, r2 = (xB + tx + sw / 2) / 2 - 0.1;
  paMount(K, D, r1, r2, tr, false);
  if (D.pod) { // laser rangefinder: emitter and receiver in a pod over the front of the tube
    const px0 = tx + 2.7, px1 = xO + 0.9, py0 = -tr - 3.5, py1 = -tr + 0.3;
    K.rpoly(B, [px0, py1, px0, py0 + 0.6, px0 + 0.8, py0, px1 - 0.4, py0, px1, py0 + 0.5, px1, py1], 0.3, { tint: 'rgba(255,255,255,0.07)' });
    K.rect(B, px0 - 0.9, py0 + 0.85, 1.1, 1.7, 0.3, { sh: 'cyl', tint: 'rgba(0,0,0,0.25)' }); K.ridges(px0 - 0.85, py0 + 0.9, 0.9, 1.6, 0.26, 0.5, true);
    K.rpoly('#c8322c', [px0 + 2.2, py0 + 0.05, px0 + 2.4, py0 - 0.55, px0 + 4.0, py0 - 0.55, px0 + 4.2, py0 + 0.05], 0.25, { sh: 'soft' });
    K.rect('#08090b', px0 + 1.2, py0 + 1.1, px1 - px0 - 2.6, 0.9, 0.3, { sh: null, lc: 'rgba(255,255,255,0.1)' });
    K.text('300', px0 + 2.5, py0 + 1.56, 0.62, 'rgba(120,200,255,0.9)'); K.hair('rgba(120,200,255,0.55)', [px0 + 3.7, py0 + 1.56, px1 - 1.9, py0 + 1.56], 0.9, { dash: [0.3, 0.3] });
    K.screw(px1 - 0.8, py0 + 2.9, 0.22); K.screw(px0 + 0.6, py0 + 2.9, 0.22);
    paLens(K, px1 + 0.02, py0 + 1.05, 0.72, ['#bfe6ff', '#1f5fae', '#2a3f8a']);
    paLens(K, px1 + 0.02, py0 + 2.55, 0.6, ['#ffb0a0', '#7a1f1f', '#3a0d12']);
  }
  if (D.shade) {
    K.tube(B, L - 0.2, L + D.shade, 0, ob * 0.985, ob * 0.985, { tint: 'rgba(0,0,0,0.2)' });
    K.lo([L + 0.9, -ob * 0.96, L + 0.9, ob * 0.96], 0.8, 0.45); K.ridges(L - 0.1, -ob * 0.985, 0.9, ob * 1.97, 0.22, 0.4);
  }
  K.tube(B, xp1 - 0.3, xB + 0.1, 0, tr, tr);
  K.tube(B, xB, xO, 0, tr, ob);
  K.tube(B, xO, L, 0, ob, ob);
  K.lo([xO, -ob * 0.97, xO, ob * 0.97], 0.8, 0.4); K.lo([xB, -tr * 0.97, xB, tr * 0.97], 0.8, 0.35);
  K.lo([L - 1.1, -ob * 0.97, L - 1.1, ob * 0.97], 0.8, 0.4);
  if (D.mm) K.text((sc.zoom ? sc.zoom[0] + '-' + sc.zoom[1] : '') + 'x' + D.mm, (xO + L) / 2 - 0.4, ob * 0.42, Math.min(0.72, ob * 0.26), 'rgba(235,238,242,0.55)');
  if (id === 'hunter') { K.rect('#d0a94e', xO + 0.5, -ob, 0.3, ob * 2, 0, { sh: 'cyl', line: false }); K.rect('#d0a94e', L - 0.75, -ob, 0.18, ob * 2, 0, { sh: 'cyl', line: false }); }
  if (id === 'bdc') K.rect('#a8763a', xO + 0.45, -ob, 0.5, ob * 2, 0, { sh: 'cyl', line: false });
  if (id === 'tree') K.rect('#2aa79b', xO + 0.5, -ob, 0.32, ob * 2, 0, { sh: 'cyl', line: false });
  if (D.ao) { // adjustable objective: a knurled ring with distance marks
    K.rect(B, L - 3.3, -ob * 1.05, 2.5, ob * 2.1, 0.2, { sh: 'cyl', tint: 'rgba(0,0,0,0.2)' }); K.ridges(L - 3.2, -ob * 1.05, 2.3, ob * 2.1, 0.3, 0.45);
    K.rect(B, L - 3.3, -0.55, 2.5, 1.1, 0, { sh: null, line: false, tint: 'rgba(0,0,0,0.25)' });
    ['50', '100', '300'].forEach((s, i) => K.text(s, L - 2.9 + i * 0.85, 0, 0.46, 'rgba(235,238,242,0.8)', { rot: -Math.PI / 2 }));
  }
  // eyepiece
  K.tube(B, xe - 0.05, xp0 + 0.05, 0, oc, pr * 0.96);
  K.rect(B, 0.9, -oc, xe - 0.9, oc * 2, 0.25, { sh: 'cyl' });
  K.rect('rubber', -0.15, -oc * 1.04, 1.35, oc * 2.08, 0.5, { sh: 'cyl', k: 0.6 });
  K.lo([2.0, -oc * 0.97, 2.0, oc * 0.97], 0.8, 0.4); K.ridges(1.25, -oc, 0.7, oc * 2, 0.2, 0.3);
  // zoom ring
  K.rect(B, xp0, -pr, xp1 - xp0, pr * 2, 0.22, { sh: 'cyl', tint: id === 'bdc' ? 'rgba(168,118,58,0.55)' : 'rgba(0,0,0,0.22)' });
  K.ridges(xp0 + 0.12, -pr, xp1 - xp0 - 0.24, pr * 2, 0.36, 0.5);
  if (D.lever) { K.rpoly(B, [xp0 + 0.7, -pr + 0.1, xp0 + 0.9, -pr - 1.5, xp0 + 1.7, -pr - 1.5, xp0 + 1.9, -pr + 0.1], 0.3, { sh: 'cylv' }); K.ridges(xp0 + 0.9, -pr - 1.4, 0.8, 0.9, 0.22, 0.5, true); }
  if (sc.zoom) { K.text(String(sc.zoom[1]), xp1 + 0.55, -tr * 0.42, 0.6, 'rgba(235,238,242,0.75)'); K.add((c) => { c.fillStyle = '#e8eaee'; c.beginPath(); c.arc(xp1 + 0.55, tr * 0.25, 0.13, 0, TAU); c.fill(); }); }
  // saddle and knobs
  K.rect(B, tx - sw / 2, -ts, sw, ts * 2, 0.55, { sh: 'cyl' });
  const top = paStack(K, tx, -ts + 0.05, paTUR[D.tur] || paTUR.cap, B);
  if (D.tur === 'lock') { K.rpoly('#2aa79b', [tx + 1.5, top + 0.75, tx + 2.5, top + 0.55, tx + 2.6, top + 0.95, tx + 1.5, top + 1.1], 0.12, { sh: 'soft' }); }
  if (D.tur !== 'cap' && D.tur !== 'bdc') { K.add((c) => { c.fillStyle = '#e8eaee'; c.beginPath(); c.moveTo(tx, -ts - 0.02); c.lineTo(tx - 0.22, -ts + 0.42); c.lineTo(tx + 0.22, -ts + 0.42); c.closePath(); c.fill(); }); }
  paMount(K, D, r1, r2, tr, true);
  if (D.wheel) { // competition side wheel for fine focus: big, spoked, marked in metres
    const wr = 3.25, wy = 0.25;
    K.shape(B, [tx - wr, wy - wr, tx + wr, wy + wr], (c) => { c.arc(tx, wy, wr, 0, TAU); c.moveTo(tx + wr * 0.76, wy); c.arc(tx, wy, wr * 0.76, 0, TAU, true); }, { tint: 'rgba(0,0,0,0.15)' });
    K.add((c, k) => { c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = k.px(0.7); c.beginPath(); for (let i = 0; i < 56; i++) { const a = (i / 56) * TAU; c.moveTo(tx + Math.cos(a) * wr * 0.9, wy + Math.sin(a) * wr * 0.9); c.lineTo(tx + Math.cos(a) * wr, wy + Math.sin(a) * wr); } c.stroke();
      c.strokeStyle = 'rgba(240,242,245,0.85)'; c.beginPath(); for (let i = 0; i < 9; i++) { const a = -2.6 + i * 0.26; c.moveTo(tx + Math.cos(a) * wr * 0.79, wy + Math.sin(a) * wr * 0.79); c.lineTo(tx + Math.cos(a) * wr * (i % 2 ? 0.84 : 0.88), wy + Math.sin(a) * wr * (i % 2 ? 0.84 : 0.88)); } c.stroke(); });
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + 0.3; K.line('#3d434a', [tx + Math.cos(a) * wr * 0.2, wy + Math.sin(a) * wr * 0.2, tx + Math.cos(a) * wr * 0.78, wy + Math.sin(a) * wr * 0.78], 0.5, { cap: 'butt' }); }
    K.circ(B, tx, wy, wr * 0.3, { tint: 'rgba(255,255,255,0.06)' }); K.screw(tx, wy, wr * 0.12, null, true);
  } else if (D.tur === 'cap') {
    K.circ(B, tx, 0.1, tr * 0.86); K.circ(B, tx, 0.1, tr * 0.6, { tint: 'rgba(255,255,255,0.05)' }); K.lo([tx - tr * 0.3, 0.1, tx + tr * 0.3, 0.1], 1, 0.6);
  } else paDial(K, tx, 0.1, tr * (D.tur === 'bdc' ? 0.9 : 1.0), B, { marks: true });
  // front glass and lens caps
  const lx = L + (D.shade || 0);
  K.ell(B, lx, 0, ob * 0.3, ob, { sh: 'cyl' });
  paLens(K, lx, 0, ob * 0.93, id === 'comp' ? ['#c8f0ff', '#3a6c8c', '#3fb37a'] : id === 'bdc' ? ['#b9ffd9', '#285a55', '#c26ad0'] : null, D.comb);
  if (D.caps) {
    K.ell('rubber', lx + 0.25, -ob - ob * 0.98, ob * 0.3, ob * 1.0, { sh: 'cyl', k: 0.7 }); K.ell('#15171a', lx + 0.3, -ob - ob * 0.98, ob * 0.22, ob * 0.8, { sh: 'soft' });
    K.rect('rubber', lx - 0.5, -ob - 0.25, 0.9, 0.5, 0.15);
    K.ell('rubber', 0.1, -oc - oc * 0.96, oc * 0.3, oc * 0.98, { sh: 'cyl', k: 0.7 }); K.ell('#15171a', 0.05, -oc - oc * 0.96, oc * 0.2, oc * 0.78, { sh: 'soft' });
    K.rect('rubber', -0.1, -oc - 0.25, 0.9, 0.5, 0.15);
  }
}

// the old fixed four-power: a thin steel tube, a range drum and worn bluing
function paScopeZF4(K, D, B, env) {
  const tr = D.tr, R = makeRng(77);
  K.line('#6b4526', [0.6, 1.2, 4, 4.6, 12, 5.6, 20, 4.4, 22.4, 1.4], 0.5, { curve: true });
  K.stitch([0.6, 1.2, 4, 4.6, 12, 5.6, 20, 4.4, 22.4, 1.4], 'rgba(235,215,170,0.55)', 0.7, true);
  K.rect('#8a6a3a', 11.2, 4.75, 1.3, 1.1, 0.2); K.rect('#0a0b0d', 11.55, 5.05, 0.6, 0.5, 0.1, { sh: null, line: false });
  const mc = '#2c3138';
  // turret mount at the front, claw at the back
  K.poly(mc, [14.4, 0.4, 16.6, 0.4, 17.4, 3.2, 13.6, 3.2]); K.rect(mc, 13, 3.0, 5, 1.2, 0.3); K.circ(mc, 15.5, 3.6, 0.5, { tint: 'rgba(255,255,255,0.1)' });
  K.poly(mc, [5.6, 0.4, 7.4, 0.4, 7.9, 3.2, 5.1, 3.2]); K.rect(mc, 4.2, 3.0, 4.6, 1.2, 0.3); K.screw(6.5, 3.6, 0.48, '#5b636c');
  K.line('#22262b', [8.6, 3.5, 10.4, 3.1], 0.42); K.circ('#3a4048', 10.5, 3.05, 0.4);
  K.tube(B, 3.4, 17.6, 0, tr, tr);
  K.tube(B, 2.5, 3.6, 0, D.oc, tr); K.rect(B, 0, -D.oc, 2.6, D.oc * 2, 0.25, { sh: 'cyl' });
  K.ridges(0.25, -D.oc, 0.9, D.oc * 2, 0.2, 0.45); K.lo([1.4, -D.oc * 0.96, 1.4, D.oc * 0.96], 0.8, 0.45);
  K.tube(B, 17.3, 18.3, 0, tr, D.ob); K.rect(B, 18.2, -D.ob, 3.8, D.ob * 2, 0.15, { sh: 'cyl' });
  K.tube(B, 20.2, 24.4, 0, D.ob + 0.16, D.ob + 0.16, { tint: 'rgba(0,0,0,0.22)' }); K.ridges(20.3, -D.ob - 0.16, 0.9, D.ob * 2 + 0.32, 0.2, 0.45);
  // worn bluing and scratches
  K.add((c, k) => {
    c.save(); c.beginPath(); c.rect(0, -D.ob - 0.2, 24.4, D.ob * 2 + 0.4); c.clip();
    for (let i = 0; i < 9; i++) { c.fillStyle = 'rgba(190,200,210,' + R.r(0.05, 0.13).toFixed(3) + ')'; c.beginPath(); c.ellipse(R.r(1, 23), R.r(-1, 0.6), R.r(0.6, 2.2), R.r(0.15, 0.4), 0, 0, TAU); c.fill(); }
    c.strokeStyle = 'rgba(220,226,232,0.22)'; c.lineWidth = k.px(0.6); c.beginPath();
    for (let i = 0; i < 14; i++) { const sx = R.r(0.5, 23), sy = R.r(-1.2, 1.2), l = R.r(0.5, 2.2); c.moveTo(sx, sy); c.lineTo(sx + l, sy + R.r(-0.15, 0.15)); }
    c.stroke(); c.restore();
  });
  K.rect(B, 8.9, -tr * 1.3, 3.4, tr * 2.6, 0.35, { sh: 'cyl' });
  paStack(K, 10.6, -tr * 1.3 + 0.05, paTUR.drum, B); K.screw(10.6, -tr * 1.3 - 1.63, 0.45, '#5b636c');
  K.screw(10.6, 0.1, 0.55, '#59616a');
  // rings
  [6.5, 15.5].forEach((x) => { K.rect(mc, x - 0.75, -tr - 0.38, 1.5, tr * 2 + 0.76, 0.35, { sh: 'cyl' }); K.lo([x - 0.75, 0.05, x + 0.75, 0.05], 0.9, 0.7); K.screw(x, -tr - 0.02, 0.2, '#5b636c'); K.hi([x - 0.6, -tr - 0.3, x + 0.6, -tr - 0.3], 1, 0.35); });
  K.ell(B, 24.4, 0, (D.ob + 0.16) * 0.3, D.ob + 0.16, { sh: 'cyl' });
  paLens(K, 24.4, 0, (D.ob + 0.16) * 0.92, ['#e6eef4', '#5d7386', '#c9b98a']);
}

// the eastern military scope: rubber eyecup, two big drums, sliding hood and its own side clamp
function paScopePSO(K, D, B, env) {
  const tr = D.tr, mc = env.fac ? '#353b42' : B;
  K.rpoly(mc, [5.2, 0.6, 17, 0.6, 16.4, 3.9, 14.6, 5.9, 6.6, 5.9, 5.4, 4.2], 0.5, { tint: 'rgba(0,0,0,0.12)' });
  K.rect('#08090b', 7.2, 3.0, 2.6, 1.6, 0.5, { sh: null, lc: 'rgba(255,255,255,0.1)' }); K.rect('#08090b', 11.2, 3.0, 3.2, 1.6, 0.5, { sh: null, lc: 'rgba(255,255,255,0.1)' });
  K.rect('#22262b', 6, 5.5, 9.4, 1.25, 0.25); K.screw(7.3, 6.1, 0.34, '#5b636c'); K.screw(14.2, 6.1, 0.34, '#5b636c');
  K.line('#1b1e22', [10.6, 6.0, 5.4, 7.2, 3.6, 7.0], 0.55); K.circ('#2b3036', 3.5, 7.0, 0.55);
  K.tube(B, 3.6, 17.6, 0, tr, tr);
  K.tube(B, 17.4, 19.4, 0, tr, D.ob); K.tube(B, 19.3, 22.2, 0, D.ob, D.ob);
  K.tube(B, 21, 25.6, 0, D.ob + 0.18, D.ob + 0.18, { tint: 'rgba(0,0,0,0.2)' }); K.ridges(21.1, -D.ob - 0.18, 1.3, D.ob * 2 + 0.36, 0.26, 0.5);
  K.lo([24.8, -D.ob - 0.1, 24.8, D.ob + 0.1], 0.8, 0.4);
  K.tube(B, 1.6, 3.8, 0, D.oc, tr); K.rect(B, 0.2, -D.oc, 1.6, D.oc * 2, 0.2, { sh: 'cyl' });
  // rubber eyecup: three bellows and a shield wing
  K.rpoly('rubber', [0.9, -D.oc - 0.1, -1.4, -D.oc - 0.35, -3.3, -D.oc - 0.95, -4.0, -D.oc + 0.3, -4.0, D.oc - 0.2, -3.3, D.oc + 0.5, -1.4, D.oc + 0.3, 0.9, D.oc + 0.1], 0.5, { sh: 'cyl', k: 0.7 });
  [-0.5, -1.6, -2.7].forEach((x) => K.hair('rgba(255,255,255,0.12)', [x, -D.oc - 0.2, x, D.oc + 0.2], 0.9));
  [0.0, -1.1, -2.2].forEach((x) => K.lo([x, -D.oc - 0.1, x, D.oc + 0.1], 0.9, 0.7));
  // lamp housing and switch
  K.rect(B, 14.2, 1.1, 2.2, 2.6, 0.45, { sh: 'cylv', tint: 'rgba(0,0,0,0.15)' }); K.ridges(14.25, 2.9, 2.1, 0.7, 0.2, 0.5, true);
  K.line('#c9ced3', [16.5, 1.5, 17.5, 0.9], 0.28); K.circ('#c8322c', 17.6, 0.85, 0.3, { sh: 'soft' });
  K.rect(B, 8.2, -tr * 1.22, 5.2, tr * 2.44, 0.5, { sh: 'cyl' });
  paStack(K, 10.8, -tr * 1.22 + 0.05, paTUR.pso, B);
  paDial(K, 10.8, 0.15, tr * 1.08, B, { marks: true, markCol: '#e3574a', n: 32 });
  K.text('0', 10.8, -tr * 0.66, 0.55, 'rgba(235,238,242,0.8)');
  // hammered enamel
  K.add((c) => { const R = makeRng(31); c.fillStyle = 'rgba(255,255,255,0.07)'; for (let i = 0; i < 60; i++) { c.beginPath(); c.arc(R.r(3.6, 24.5), R.r(-tr * 0.9, tr * 0.9), R.r(0.05, 0.12), 0, TAU); c.fill(); } });
  K.ell(B, 25.6, 0, (D.ob + 0.18) * 0.3, D.ob + 0.18, { sh: 'cyl' });
  paLens(K, 25.6, 0, (D.ob + 0.18) * 0.92, ['#ffe6a8', '#7a5a2a', '#d0762e']);
}

// night vision: a boxy intensifier housing, a big rubber-armoured front lens and an infra-red lamp
function paScopeNight(K, D, B, env) {
  const mc = '#191b20';
  K.rect(mc, 7, 2.9, 11, 1.9, 0.3); K.rect(mc, 6.3, 4.5, 12.4, 1.3, 0.25, { tint: 'rgba(255,255,255,0.03)' });
  K.screw(8.2, 5.15, 0.42, '#3a3f46', true); K.screw(16.6, 5.15, 0.42, '#3a3f46', true);
  K.rpoly('#2a2d33', [10.5, 5.0, 14.6, 5.0, 15.2, 6.3, 10.9, 6.6], 0.3); // throw lever
  // infra-red lamp on a bracket
  K.rect(B, 12.4, -3.6, 2.4, 0.8, 0.2, { tint: 'rgba(0,0,0,0.2)' });
  K.tube(B, 10.4, 17.0, -4.45, 0.95, 0.95); K.tube(B, 16.6, 18.8, -4.45, 1.3, 1.3, { tint: 'rgba(0,0,0,0.15)' }); K.ridges(16.7, -5.75, 1.9, 2.6, 0.24, 0.45);
  K.rect('rubber', 9.7, -5.2, 0.9, 1.5, 0.3, { sh: 'cyl' });
  K.ell(B, 18.8, -4.45, 0.39, 1.3, { sh: 'cyl' }); paLens(K, 18.8, -4.45, 1.18, ['#ff9a8a', '#6a1418', '#2a0608']);
  // battery tube
  K.rect(B, 5.6, -4.45, 3.4, 1.5, 0.4, { sh: 'cyl' }); K.rect(B, 4.9, -4.55, 1.0, 1.7, 0.3, { sh: 'cyl', tint: 'rgba(0,0,0,0.25)' }); K.ridges(4.95, -4.5, 0.9, 1.6, 0.25, 0.5, true);
  // eyecup and eyepiece
  K.rpoly('rubber', [2.0, -2.3, -1.4, -2.9, -2.5, -2.3, -2.5, 2.3, -1.4, 2.9, 2.0, 2.3], 0.6, { sh: 'cyl', k: 0.7 });
  [-0.2, -1.1].forEach((x) => K.lo([x, -2.5, x, 2.5], 0.9, 0.7));
  K.rect(B, 1.7, -D.oc, 3.2, D.oc * 2, 0.3, { sh: 'cyl' }); K.ridges(2.3, -D.oc, 1.2, D.oc * 2, 0.24, 0.45);
  // housing
  K.rpoly(B, [5.0, -3.1, 16.8, -3.1, 17.7, -2.4, 17.7, 2.5, 16.8, 3.1, 5.0, 3.1, 4.3, 2.4, 4.3, -2.4], 0.5);
  K.rect(B, 5.4, -2.5, 3.6, 5.0, 0.3, { sh: null, tint: 'rgba(0,0,0,0.18)', lc: 'rgba(0,0,0,0.4)' }); K.ridges(5.5, -2.4, 3.4, 4.8, 0.5, 0.5);
  K.hi([5.2, -2.95, 16.6, -2.95], 1, 0.22);
  K.rect('#08090b', 9.6, -2.3, 2.6, 1.3, 0.25, { sh: null, lc: 'rgba(255,255,255,0.1)' }); [0, 1, 2, 3].forEach((i) => K.rect(i < 3 ? '#78ff96' : '#1f4a2c', 10.0 + i * 0.5, -1.25 - i * 0.2, 0.32, 0.35 + i * 0.2, 0, { sh: null, line: false }));
  K.rpoly('#15171a', [9.7, 0.9, 10.9, 0.9, 10.9, 2.1, 9.7, 2.1], 0.3, { sh: 'soft' }); K.rpoly('#15171a', [11.3, 0.9, 12.5, 0.9, 12.5, 2.1, 11.3, 2.1], 0.3, { sh: 'soft' });
  K.hair('rgba(255,255,255,0.5)', [10.0, 1.5, 10.6, 1.5], 0.8); K.hair('rgba(255,255,255,0.5)', [11.6, 1.5, 12.2, 1.5], 0.8); K.hair('rgba(255,255,255,0.5)', [11.9, 1.2, 11.9, 1.8], 0.8);
  paDial(K, 15, 0.2, 1.55, B, { marks: true, n: 24, tint: 'rgba(0,0,0,0.15)' });
  K.add((c) => { const p = 0.75 + 0.25 * Math.sin((env.time || 0) * 3); const g = c.createRadialGradient(13.2, -1.65, 0, 13.2, -1.65, 0.75); g.addColorStop(0, 'rgba(110,255,140,' + (0.7 * p).toFixed(3) + ')'); g.addColorStop(1, 'rgba(110,255,140,0)'); c.fillStyle = g; c.beginPath(); c.arc(13.2, -1.65, 0.75, 0, TAU); c.fill(); c.fillStyle = '#b8ffc4'; c.beginPath(); c.arc(13.2, -1.65, 0.22, 0, TAU); c.fill(); });
  K.screw(5.0, -2.6, 0.2); K.screw(5.0, 2.6, 0.2); K.screw(17.0, -2.3, 0.2); K.screw(17.0, 2.3, 0.2);
  // objective
  K.tube(B, 17.5, 19.1, 0, 2.5, D.ob);
  K.rect('#14171a', 19, -D.ob, 6.6, D.ob * 2, 0.3, { sh: 'cyl' }); K.ridges(19.4, -D.ob, 5.8, D.ob * 2, 0.75, 0.6);
  K.rect(B, 25.3, -D.ob - 0.08, 1.7, D.ob * 2 + 0.16, 0.2, { sh: 'cyl' });
  K.ell(B, 27, 0, (D.ob + 0.08) * 0.3, D.ob + 0.08, { sh: 'cyl' });
  paLens(K, 27, 0, (D.ob + 0.08) * 0.93, ['#c9ffc0', '#1f5a3a', '#e2c14a']);
}

// the smart scope: a ballistic computer with a lit display, buttons, a rangefinder and a wind sensor
function paScopeOracle(K, D, B, env) {
  const mc = '#191b20', t = env.time || 0, amb = '#ffaa3c';
  K.rect(mc, 9.5, 2.9, 12, 1.9, 0.3); K.rect(mc, 8.8, 4.5, 13.4, 1.3, 0.25, { tint: 'rgba(255,255,255,0.03)' });
  [10.4, 15.5, 20.6].forEach((x) => K.screw(x, 5.15, 0.42, '#3a3f46', true));
  // wind sensor mast with three cups
  K.line('#2a2f36', [18.4, -3.4, 18.4, -6.3], 0.3, { cap: 'butt' });
  const sp = t * 5;
  [0, 2.1, 4.2].forEach((a) => { const cxp = 18.4 + Math.cos(a + sp) * 0.95; K.line('#2a2f36', [18.4, -6.3, cxp, -6.3], 0.16); K.ell('#3a4048', cxp, -6.3, 0.34, 0.3); });
  K.circ('#3a4048', 18.4, -6.3, 0.22);
  // rangefinder module on top
  K.rpoly(B, [19.6, -3.3, 19.6, -4.5, 20.2, -4.9, 24.0, -4.9, 24.0, -3.3], 0.25, { tint: 'rgba(255,255,255,0.07)' });
  paLens(K, 24.0, -4.1, 0.7, ['#bfe6ff', '#1f5fae', '#2a3f8a']);
  // eyepiece
  K.tube(B, 4.8, 6.8, 0, D.oc, 2.2);
  K.rect(B, 0.9, -D.oc, 4.0, D.oc * 2, 0.25, { sh: 'cyl' }); K.rect('rubber', -0.15, -D.oc * 1.04, 1.35, D.oc * 2.08, 0.5, { sh: 'cyl', k: 0.6 });
  K.ridges(2.4, -D.oc, 1.4, D.oc * 2, 0.26, 0.45);
  // objective
  K.tube(B, 22.2, 26.5, 0, 2.5, D.ob); K.tube(B, 26.4, 33, 0, D.ob, D.ob);
  K.rect(amb, 27.3, -D.ob, 0.3, D.ob * 2, 0, { sh: 'cyl', line: false }); K.lo([31.8, -D.ob * 0.97, 31.8, D.ob * 0.97], 0.8, 0.4);
  K.text('5-25x56', 29.6, D.ob * 0.42, 0.7, 'rgba(235,238,242,0.5)');
  // computer housing
  K.rpoly(B, [6.5, -2.2, 9, -3.5, 20.6, -3.5, 22.6, -2.6, 22.6, 2.6, 21, 3.1, 8, 3.1, 6.5, 2.2], 0.35);
  K.hi([9.2, -3.36, 20.4, -3.36], 1, 0.22); K.lo([16.3, -3.3, 16.3, 3.0], 0.8, 0.4);
  // display
  K.rpoly('#06080a', [9.2, -2.7, 15.6, -2.7, 15.6, 1.2, 9.2, 1.2], 0.3, { sh: null, lc: 'rgba(255,255,255,0.14)' });
  K.add((c, k) => {
    const g = c.createRadialGradient(12.4, -0.8, 0, 12.4, -0.8, 3.6); g.addColorStop(0, 'rgba(255,170,60,0.22)'); g.addColorStop(1, 'rgba(255,170,60,0)');
    c.save(); c.beginPath(); c.rect(9.3, -2.6, 6.2, 3.7); c.clip(); c.fillStyle = g; c.fillRect(9.2, -2.7, 6.4, 3.9);
    c.strokeStyle = amb; c.fillStyle = amb; c.lineWidth = k.px(0.9);
    c.beginPath(); c.moveTo(10.0, -0.9); c.lineTo(12.6, -0.9); c.moveTo(11.3, -2.2); c.lineTo(11.3, 0.4); c.stroke();
    c.beginPath(); c.moveTo(11.8, -0.3); c.lineTo(12.15, 0.05); c.lineTo(11.8, 0.4); c.lineTo(11.45, 0.05); c.closePath(); c.stroke();
    for (let i = 0; i < 4; i++) { const hgt = 0.35 + 0.25 * i + 0.12 * Math.sin(t * 3 + i); c.fillRect(13.3 + i * 0.5, 0.75 - hgt, 0.32, hgt); }
    c.restore();
  });
  K.text('300', 14.2, -1.9, 0.78, amb); K.text('m', 15.15, -1.3, 0.5, amb);
  // buttons, port cover, light
  [17.5, 19.2, 20.9].forEach((x, i) => { K.circ('#15171a', x, -1.7, 0.62, { sh: 'soft' }); K.circ(i === 1 ? '#3a3f46' : '#2a2e34', x, -1.7, 0.4, { sh: 'soft' }); });
  K.rpoly('#15171a', [17, 0.1, 21.6, 0.1, 21.6, 1.7, 17, 1.7], 0.3, { sh: 'soft' }); K.screw(17.5, 0.9, 0.2); K.screw(21.1, 0.9, 0.2);
  K.add((c) => { const p = 0.7 + 0.3 * Math.sin(t * 2.4); const g = c.createRadialGradient(8.2, 2.1, 0, 8.2, 2.1, 0.8); g.addColorStop(0, 'rgba(255,170,60,' + (0.75 * p).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,170,60,0)'); c.fillStyle = g; c.beginPath(); c.arc(8.2, 2.1, 0.8, 0, TAU); c.fill(); c.fillStyle = '#ffd9a0'; c.beginPath(); c.arc(8.2, 2.1, 0.2, 0, TAU); c.fill(); });
  [7.2, 21.9].forEach((x) => { K.screw(x, -1.9, 0.2); K.screw(x, 1.9, 0.2); });
  K.ell(B, 33, 0, D.ob * 0.3, D.ob, { sh: 'cyl' });
  paLens(K, 33, 0, D.ob * 0.93, ['#ffd9a0', '#3a3550', '#8a5cd8']);
}

function paScope(K, id, env) {
  const D = paSC[id] || paSC.hunter, B = env.fac ? D.col : 'acc';
  if (id === 'zf4') paScopeZF4(K, D, B, env);
  else if (id === 'pso') paScopePSO(K, D, B, env);
  else if (id === 'night') paScopeNight(K, D, B, env);
  else if (id === 'oracle') paScopeOracle(K, D, B, env);
  else paScopeStd(K, paSC[id] ? id : 'hunter', D, B);
}

// ===========================================================================
// CARTRIDGES (used by the ammunition and magazine pictures)
// ===========================================================================
// Real dimensions in millimetres: cl case length, br base radius, rim rim radius,
// sx/sr where the shoulder starts and its radius, nx/nr where the neck starts and
// its radius, bul bullet radius, oal overall length of a standard round.
const paCAL = {
  c22: { cl: 15.6, br: 2.85, rim: 3.55, bul: 2.85, oal: 25.4, rf: true },
  c556: { cl: 44.7, br: 4.8, rim: 4.8, sx: 36.5, sr: 4.5, nx: 39.6, nr: 3.2, bul: 2.85, oal: 57.4 },
  c300s: { cl: 34.7, br: 4.8, rim: 4.8, sx: 26.5, sr: 4.55, nx: 28.6, nr: 4.25, bul: 3.9, oal: 57, fat: true },
  c9s: { cl: 39, br: 5.7, rim: 5.7, sx: 30.2, sr: 5.2, nx: 32.4, nr: 4.95, bul: 4.62, oal: 56, fat: true },
  c308: { cl: 51.2, br: 5.95, rim: 5.95, sx: 39.6, sr: 5.75, nx: 43.4, nr: 4.35, bul: 3.91, oal: 71 },
  c762r: { cl: 53.7, br: 6.2, rim: 7.2, sx: 39.2, sr: 5.8, nx: 44.4, nr: 4.25, bul: 3.95, oal: 77, rimmed: true },
  c8mm: { cl: 57, br: 5.95, rim: 5.95, sx: 46.2, sr: 5.5, nx: 50, nr: 4.55, bul: 4.1, oal: 82 },
  c65: { cl: 48.8, br: 5.95, rim: 5.95, sx: 37.6, sr: 5.85, nx: 41.2, nr: 3.75, bul: 3.35, oal: 72 },
  c300m: { cl: 66.5, br: 6.5, rim: 6.75, sx: 55, sr: 6.25, nx: 59.6, nr: 4.3, bul: 3.91, oal: 85, belt: true },
  c338: { cl: 69.2, br: 7.45, rim: 7.45, sx: 54.9, sr: 6.9, nx: 60.9, nr: 4.75, bul: 4.3, oal: 93.5 },
  c408: { cl: 77, br: 8.1, rim: 8.1, sx: 61, sr: 7.6, nx: 67, nr: 5.55, bul: 5.2, oal: 115, solid: true },
  c50: { cl: 99, br: 10.2, rim: 10.2, sx: 76, sr: 9.05, nx: 83, nr: 7.1, bul: 6.5, oal: 138 },
};
// How each load looks. og: how much of the showing bullet is the curved nose, mp: flat on the tip,
// len: extra length, tip/tipF: a painted tip and how far back it runs.
const paBUL = {
  am_ball: { cas: '#c9a04a', bul: '#b9713f', og: 0.74, mp: 0.14, cann: true },
  am_match: { cas: '#c4cad0', bul: '#c07a44', og: 0.84, mp: 0.26, hp: true },
  am_sub: { cas: '#c9a04a', bul: '#8a9098', og: 0.56, mp: 0.16, round: true, len: 0.18, tip: '#3f78d0', tipF: 0.36 },
  am_ap: { cas: '#c9a04a', bul: '#b9713f', og: 0.74, mp: 0.14, tip: '#141518', tipF: 0.46, seal: '#b8322c', cann: true },
  am_heavy: { cas: '#c9a04a', bul: '#a55f3a', og: 0.88, mp: 0.07, len: 0.24, bands: 3, tip: '#e3e6ea', tipF: 0.17 },
  am_tracer: { cas: '#c9a04a', bul: '#b9713f', og: 0.74, mp: 0.14, tip: '#ff4a2a', tipF: 0.42, glow: true, cann: true },
};
// One cartridge lying along x with the bullet to the right. s is drawing units per millimetre.
function paRound(K, C, type, ox, oy, s, env, quiet) {
  const T = paBUL[type] || paBUL.am_ball, X = (mm) => ox + mm * s, b = C.bul * s;
  const expo = C.oal - C.cl, tip = C.oal + expo * (T.len || 0), show = tip - C.cl;
  const og = show * (C.rf ? Math.max(T.og, 0.7) : T.og), xs = tip - og, mp = C.rf ? Math.max(T.mp, 0.3) : T.mp, round = T.round || C.rf;
  const bulPath = (c) => {
    c.moveTo(X(C.cl - 1.5), oy - b); c.lineTo(X(xs), oy - b);
    if (round) c.bezierCurveTo(X(xs + og * 0.62), oy - b, X(tip), oy - b * 0.86, X(tip), oy - b * mp);
    else c.quadraticCurveTo(X(xs + og * 0.5), oy - b * 0.97, X(tip), oy - b * mp);
    c.lineTo(X(tip), oy + b * mp);
    if (round) c.bezierCurveTo(X(tip), oy + b * 0.86, X(xs + og * 0.62), oy + b, X(xs), oy + b);
    else c.quadraticCurveTo(X(xs + og * 0.5), oy + b * 0.97, X(xs), oy + b);
    c.lineTo(X(C.cl - 1.5), oy + b); c.closePath();
  };
  const bb = [X(C.cl - 1.5), oy - b, X(tip), oy + b];
  if (T.glow && !quiet) K.add((c) => { // a tracer's tip, faintly alight
    const p = 0.75 + 0.25 * Math.sin((env.time || 0) * 5), gr = b * 4.2, g = c.createRadialGradient(X(tip - og * 0.2), oy, 0, X(tip - og * 0.2), oy, gr);
    g.addColorStop(0, 'rgba(255,120,50,' + (0.5 * p).toFixed(3) + ')'); g.addColorStop(0.4, 'rgba(255,80,30,' + (0.2 * p).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,80,30,0)');
    c.fillStyle = g; c.beginPath(); c.arc(X(tip - og * 0.2), oy, gr, 0, TAU); c.fill();
  });
  const solid = C.solid && type !== 'am_sub';
  K.shape(solid && type === 'am_ball' ? '#b06a3c' : T.bul, bb, bulPath, { sh: 'cyl' });
  if (T.tip) K.add((c, k) => {
    c.save(); c.beginPath(); bulPath(c); c.clip();
    const tx = X(tip - og * T.tipF); c.fillStyle = T.tip; c.fillRect(tx, oy - b, X(tip) - tx + 1, b * 2);
    c.fillStyle = k.shade(c, 'cyl', bb, 1); c.fillRect(tx, oy - b, X(tip) - tx + 1, b * 2);
    c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = k.px(0.7); c.beginPath(); c.moveTo(tx, oy - b); c.lineTo(tx, oy + b); c.stroke();
    c.restore();
  });
  const bands = T.bands || (solid ? 2 : 0);
  for (let i = 0; i < bands; i++) { const gx = X(xs - 1.2 - i * (xs - C.cl - 1.5) / (bands + 0.6)); K.lo([gx, oy - b * 0.96, gx, oy + b * 0.96], 1, 0.45); K.hi([gx + b * 0.12, oy - b * 0.8, gx + b * 0.12, oy - b * 0.2], 0.8, 0.25); }
  if (T.cann && !C.rf && !solid) K.ridges(X(C.cl + 0.8), oy - b, Math.max(0.9 * s, b * 0.22), b * 2, b * 0.22, 0.4, true);
  if (T.hp) K.ell('#1a0f08', X(tip) - b * mp * 0.05, oy, b * mp * 0.22, b * mp * 0.7, { sh: null, line: false });
  // the case
  const rt = clamp(C.br * 0.2, 0.7, 2), up = [];
  if (C.rf) up.push(0, C.rim * 0.86, 0.3, C.rim, 1.0, C.rim, 1.0, C.br, C.cl, C.br);
  else {
    up.push(0, C.rim * 0.9, rt * 0.35, C.rim, rt, C.rim);
    if (C.rimmed) up.push(rt, C.br);
    else { up.push(rt, C.br * 0.83, rt * 2.1, C.br * 0.83, rt * 2.8, C.br); if (C.belt) up.push(rt * 2.8, C.br + 0.42, rt * 2.8 + 3.4, C.br + 0.42, rt * 2.8 + 3.4, C.br); }
    up.push(C.sx, C.sr, C.nx, C.nr, C.cl, C.nr);
  }
  const pts = [];
  for (let i = 0; i < up.length; i += 2) pts.push(X(up[i]), oy - up[i + 1] * s);
  for (let i = up.length - 2; i >= 0; i -= 2) pts.push(X(up[i]), oy + up[i + 1] * s);
  K.poly(T.cas, pts, { sh: 'cyl' });
  if (!C.rf) {
    K.add((c) => { // the heat mark left on the neck and shoulder when the brass was annealed
      c.save(); c.beginPath(); paPolyPath(c, pts); c.clip();
      const g = c.createLinearGradient(X(C.sx - 5), 0, X(C.cl), 0); g.addColorStop(0, 'rgba(120,70,150,0)'); g.addColorStop(0.5, 'rgba(120,70,150,0.2)'); g.addColorStop(1, 'rgba(60,90,160,0.16)');
      c.fillStyle = g; c.fillRect(X(C.sx - 5), oy - C.br * s, (C.cl - C.sx + 5) * s, C.br * 2 * s); c.restore();
    });
    K.lo([X(C.sx), oy - C.sr * s * 0.97, X(C.sx), oy + C.sr * s * 0.97], 0.7, 0.22);
    K.lo([X(C.nx), oy - C.nr * s * 0.97, X(C.nx), oy + C.nr * s * 0.97], 0.7, 0.22);
  }
  if (T.seal) K.rect(T.seal, X(C.cl - 0.9), oy - (C.nr || C.br) * s, 1.1 * s, (C.nr || C.br) * 2 * s, 0, { sh: 'cyl', line: false });
  K.hi([X(rt * 3), oy - C.br * s * 0.62, X((C.sx || C.cl) - 2), oy - (C.sr || C.br) * s * 0.62], 1, 0.3);
}
// the Stormglass slug: a finned tungsten dart with copper driving bands
function paSlug(K, ox, oy, s, env) {
  const X = (u) => ox + u * s, t = env.time || 0;
  K.add((c) => { const p = 0.7 + 0.3 * Math.sin(t * 4 + oy), g = c.createRadialGradient(0, 0, 0, 0, 0, 7 * s); g.addColorStop(0, 'rgba(111,227,255,' + (0.26 * p).toFixed(3) + ')'); g.addColorStop(1, 'rgba(111,227,255,0)'); c.save(); c.translate(X(6), oy); c.scale(1, 0.4); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 7 * s, 0, TAU); c.fill(); c.restore(); });
  K.poly('#4b525a', [X(0), oy - 1.5 * s, X(2.6), oy - 0.5 * s, X(2.6), oy + 0.5 * s, X(0), oy + 1.5 * s, X(0.6), oy]);
  K.poly('#30353b', [X(0.1), oy - 0.16 * s, X(2.4), oy - 0.16 * s, X(2.4), oy + 0.16 * s, X(0.1), oy + 0.16 * s], { sh: null });
  K.tube('#7b838c', X(1.6), X(9.4), oy, 0.5 * s, 0.5 * s);
  K.shape('#8a929b', [X(9.3), oy - 0.5 * s, X(13), oy + 0.5 * s], (c) => { c.moveTo(X(9.3), oy - 0.5 * s); c.quadraticCurveTo(X(11.4), oy - 0.46 * s, X(13), oy); c.quadraticCurveTo(X(11.4), oy + 0.46 * s, X(9.3), oy + 0.5 * s); c.closePath(); }, { sh: 'cyl' });
  [3.2, 5.2, 7.2].forEach((u) => { K.tube('#c07a44', X(u), X(u + 0.9), oy, 0.74 * s, 0.74 * s); K.hi([X(u + 0.1), oy - 0.5 * s, X(u + 0.8), oy - 0.5 * s], 0.8, 0.4); });
  K.tube('#e6e9ec', X(8.4), X(9.3), oy, 0.95 * s, 0.7 * s);
}

// ===========================================================================
// AMMUNITION
// ===========================================================================
function paAmmo(K, id, env) {
  const C = paCAL[env.g.cal];
  if (!C) { // the coil gun
    paSlug(K, 0, -2.2, 1, env); paSlug(K, 1.4, 2.2, 1, env);
    K.frame(-1.5, -5, 16, 5); return;
  }
  const s = 0.1, d = C.rim * 2 * 1.22 * s, off = C.oal * 0.08 * s;
  paRound(K, C, id, 0, -d, s, env); paRound(K, C, id, off, 0, s, env); paRound(K, C, id, 0, d, s, env);
  // small calibres are shown smaller than big ones, though not as much smaller as they really are
  const q = clamp(Math.pow(C.oal / 138, 0.3), 0.6, 1), W = C.oal * 1.13 * s + off, H = d * 2 + C.rim * 2 * s;
  K.frame(W / 2 - (W / q) / 2, -(H / q) / 2 - (C.rf ? 0 : 0), W / 2 + (W / q) / 2, (H / q) / 2);
}

// ===========================================================================
// MUZZLE
// ===========================================================================
function paBarrelDims(env, bp) {
  const A = env.A; bp = bp || env.cfg.barrel;
  const stiff = bp === 'br_heavy' || bp === 'br_carbon';
  const bR = (A.slim ? 0.8 : 1) * (A.heavy || 1) * (bp === 'br_heavy' ? 1.4 : bp === 'br_carbon' ? 1.32 : 1) * 1.05;
  const C = paCAL[env.g.cal];
  return { r0: bR * 1.25, r1: stiff ? bR * 1.2 : bR * 0.88, len: A.barrel * (bp === 'br_short' ? 0.8 : 1), bore: C ? C.bul / 10 : 0.4, zone: bp === 'br_carbon' ? 'carbon' : 'metal', stiff, bp };
}
// the short calibre mark engraved on metal: '.308', '8 mm', '7.62'
function paCalMark(g) { const q = g.calName.split(' '); return q[1] === 'mm' ? q[0] + ' mm' : q[0]; }
// the end face of a tube, seen a little from the front, with the hole in it
function paFace(K, x, y, r, bore, zone, tint) {
  K.ell(zone, x, y, r * 0.3, r, { sh: 'cyl', tint: tint || 'rgba(255,255,255,0.1)' });
  if (r * 0.74 > bore * 1.4) K.ell(null, x, y, r * 0.3 * 0.74, r * 0.74, { sh: null, lc: 'rgba(0,0,0,0.3)' });
  if (bore) K.ell('#040405', x + r * 0.015, y, bore * 0.3, bore, { sh: null, lc: 'rgba(255,255,255,0.2)' });
}
// a glowing coil block of the Stormglass
function paCoil(K, x, y, w, h, t) {
  K.add((c) => {
    const p = 0.7 + 0.3 * Math.sin(t * 4 + x), g = c.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, w * 1.1);
    g.addColorStop(0, 'rgba(111,227,255,' + (0.45 * p).toFixed(3) + ')'); g.addColorStop(1, 'rgba(111,227,255,0)'); c.fillStyle = g; c.fillRect(x - w, y - h * 1.5, w * 3, h * 4);
  });
  K.rect('#6fe3ff', x, y, w, h, Math.min(w, h) * 0.18, { sh: 'soft', lc: 'rgba(0,40,60,0.7)' });
  K.ridges(x + w * 0.06, y, w * 0.88, h, w / 9, 0.35);
}
function paMuzzle(K, id, env) {
  const A = env.A, g = env.g, B = paBarrelDims(env), r = B.r1, bore = B.bore, t = env.time || 0;
  if (A.type === 'rail') { // twin rails, the last drive coil and the muzzle bracket
    K.rect('metal', -10, -3.9, 12.4, 2, 0.3); K.rect('metal', -10, 1.9, 12.4, 2, 0.3);
    for (let x = -9.4; x < 1; x += 1.3) { K.rect('#08090b', x, -3.45, 0.7, 0.5, 0.15, { sh: null, line: false }); K.rect('#08090b', x, 2.95, 0.7, 0.5, 0.15, { sh: null, line: false }); }
    K.rect('metal', -8.2, -2.3, 0.9, 4.6, 0.2, { tint: 'rgba(255,255,255,0.08)' }); K.rect('metal', -2.6, -2.3, 0.9, 4.6, 0.2, { tint: 'rgba(255,255,255,0.08)' });
    paCoil(K, -7.3, -1.5, 4.7, 3.0, t);
    K.rpoly('metal', [1.6, -4.6, 4.8, -4.6, 4.8, 4.6, 1.6, 4.6], 0.6);
    K.rect('#040405', 2.4, -1.5, 1.6, 3.0, 0.5, { sh: null, lc: 'rgba(111,227,255,0.6)' });
    K.screw(3.2, -3.5, 0.35, null, true); K.screw(3.2, 3.5, 0.35, null, true);
    K.frame(-9.2, -5.4, 7.2, 5.4); K.fadeX(-5.6, -9);
    return;
  }
  if (A.can || A.mod) { // a built-in suppressor: the front of the can is the muzzle
    const cr = A.can ? 2.15 : 1.55;
    K.tube('metal', -10, -1.6, 0, cr, cr);
    for (let x = -8.4; x < -2; x += A.can ? 2.6 : 1.9) { K.lo([x, -cr * 0.98, x, cr * 0.98], 0.9, 0.4); K.hi([x + 0.14, -cr * 0.9, x + 0.14, cr * 0.2], 0.8, 0.12); }
    K.rect('metal', -1.8, -cr * 1.04, 1.9, cr * 2.08, 0.25, { sh: 'cyl', tint: 'rgba(0,0,0,0.2)' }); K.ridges(-1.7, -cr * 1.04, 1.7, cr * 2.08, 0.3, 0.45, true);
    if (A.mod) for (let x = -8; x < -2.4; x += 1.1) K.ell('#040405', x, -cr * 0.2, 0.2, 0.2, { sh: null, line: false });
    paFace(K, 0.1, 0, cr * 1.04, bore * 1.25, 'metal');
    K.frame(-11.6, -4.2, 4.8, 4.2); K.fadeX(-6.4, -10);
    return;
  }
  const sup = id === 'mz_supl' || id === 'mz_suph', k = A.amr ? 1.5 : 1, thread = g.supp === true, x0 = -7.4;
  // the end of the barrel
  if (B.zone === 'carbon') { K.tube('carbon', x0, -3.4, 0, r * 1.02, r * 1.02); K.tube('metal', -3.5, thread ? -1.9 : 0, 0, r, r); K.lo([-3.5, -r, -3.5, r], 0.9, 0.5); }
  else K.tube('metal', x0, thread ? -1.9 : 0, 0, r * 1.03, r);
  if (thread) { K.tube('metal', -2.0, 0, 0, r * 0.76, r * 0.76, { tint: 'rgba(255,255,255,0.1)' }); K.ridges(-1.95, -r * 0.76, 1.9, r * 1.52, 0.21, 0.6); }
  if (A.military) { // front sight: band, ramp, blade and its guard ears
    const sy = -r * 1.22;
    K.rect('metal', -6.2, -r * 1.24, 1.9, r * 2.48, 0.2, { sh: 'cyl' });
    K.poly('metal', [-6.4, sy, -3.9, sy, -4.3, sy - 0.8, -6.0, sy - 0.8]);
    K.poly('#0b0c0e', [-5.45, sy - 0.8, -5.25, sy - 2.2, -5.05, sy - 2.2, -4.85, sy - 0.8], { sh: null });
    K.rpoly('metal', [-6.2, sy - 0.7, -6.4, sy - 2.5, -5.9, sy - 2.7, -5.7, sy - 0.7], 0.15, { tint: 'rgba(255,255,255,0.05)' });
    K.rpoly('metal', [-4.6, sy - 0.7, -4.4, sy - 2.7, -3.9, sy - 2.5, -4.1, sy - 0.7], 0.15, { tint: 'rgba(255,255,255,0.05)' });
  }
  if (id === 'mz_flash') {
    const R1 = r * 1.4;
    K.rect('#8d949c', -2.3, -r * 1.22, 0.45, r * 2.44, 0.08, { sh: 'cyl' });
    K.rpoly('acc', [-1.9, -R1, 4.8, -R1, 4.8, R1, -1.9, R1], [0.15, 0.55, 0.55, 0.15], { sh: 'cyl' });
    K.rect('acc', -1.6, -R1 * 0.6, 1.4, R1 * 1.2, 0.1, { sh: null, tint: 'rgba(0,0,0,0.28)', lc: 'rgba(0,0,0,0.5)' });
    K.rect('#040405', 0.6, -R1 * 0.34, 3.3, R1 * 0.46, R1 * 0.22, { sh: null, lc: 'rgba(255,255,255,0.14)' });
    K.rect('#040405', 0.6, -R1 * 0.9, 3.3, R1 * 0.22, R1 * 0.11, { sh: null, lc: 'rgba(255,255,255,0.1)' });
    K.rect('#040405', 0.6, R1 * 0.5, 3.3, R1 * 0.12, R1 * 0.06, { sh: null, line: false, alpha: 0.5 });
    K.hi([0.9, R1 * 0.1, 3.6, R1 * 0.1], 0.8, 0.22);
    paFace(K, 4.85, 0, R1 * 0.96, bore * 1.7, 'acc');
  } else if (id === 'mz_brake') {
    const H = r * 2.1 * k, x1 = 8.2 * k;
    K.rect('#7d848c', -2.3, -r * 1.3, 1.2, r * 2.6, 0.1, { sh: 'cyl' }); K.lo([-2.3, -r * 0.45, -1.1, -r * 0.45], 0.8, 0.5); K.lo([-2.3, r * 0.45, -1.1, r * 0.45], 0.8, 0.5);
    K.rpoly('acc', [-1.2, -r * 1.15, 0, -H, x1, -H, x1, H, 0, H, -1.2, r * 1.15], 0.28);
    for (let i = 0; i < 3; i++) {
      const px = (0.75 + i * 2.5) * k;
      K.rect('#040405', px, -H * 0.7, 1.55 * k, H * 1.4, 0.4 * k, { sh: null, lc: 'rgba(255,255,255,0.14)' });
      K.rect('acc', px + 0.25 * k, -bore * 1.15, 1.05 * k, bore * 2.3, 0, { sh: 'cyl', line: false, tint: 'rgba(0,0,0,0.5)' });
      K.hi([px + 1.5 * k, -H * 0.55, px + 1.5 * k, H * 0.4], 0.9, 0.2);
      K.rect('#040405', px + 0.3 * k, -H - 0.02, 0.9 * k, 0.32 * k, 0.1, { sh: null, line: false });
    }
    K.rect('acc', x1 - 0.4 * k, -H, 0.4 * k, H * 2, 0, { sh: null, line: false, tint: 'rgba(255,255,255,0.08)' });
    K.screw(-0.1, -H * 0.7, 0.2 * k, null, true); K.screw(-0.1, H * 0.7, 0.2 * k, null, true);
  } else if (id === 'mz_supl') { // light titanium can with heat colours
    K.tube('acc', -2.1, 1.2, 0, 1.5, 1.5, { tint: 'rgba(0,0,0,0.2)' }); K.ridges(-2.0, -1.5, 3.0, 3.0, 0.3, 0.45);
    K.rect('acc', 1.0, -1.78, 15.2, 3.56, 0.55, { sh: 'cyl', tint: env.fac ? 'rgba(170,182,198,0.3)' : 'rgba(255,255,255,0.06)' });
    K.add((c) => { c.save(); c.beginPath(); paRectPath(c, 1.0, -1.78, 15.2, 3.56, 0.55); c.clip(); const gh = c.createLinearGradient(8.5, 0, 16.2, 0); gh.addColorStop(0, 'rgba(90,120,255,0)'); gh.addColorStop(0.45, 'rgba(96,110,235,0.3)'); gh.addColorStop(0.75, 'rgba(190,110,200,0.28)'); gh.addColorStop(1, 'rgba(240,180,90,0.34)'); c.fillStyle = gh; c.fillRect(8.5, -1.8, 7.8, 3.6); c.restore(); });
    [3.1, 14.2].forEach((x) => { K.lo([x, -1.72, x, 1.72], 0.9, 0.45); K.hi([x + 0.14, -1.6, x + 0.14, 0.2], 0.8, 0.16); });
    K.text(paCalMark(g), 8.6, 0.55, 0.85, 'rgba(240,242,245,0.5)');
    paFace(K, 16.2, 0, 1.62, bore * 1.2, 'acc', 'rgba(255,255,255,0.14)');
  } else if (id === 'mz_suph') { // long heavy can: locking collar, fluted body, notched end cap
    K.tube('acc', -2.2, 1.6, 0, 1.85, 1.85, { tint: 'rgba(0,0,0,0.25)' }); K.ridges(-2.1, -1.85, 1.6, 3.7, 0.4, 0.5);
    K.rect('#b8322c', -0.3, -1.85, 0.3, 3.7, 0, { sh: 'cyl', line: false });
    K.rpoly('#2a2d33', [0.3, -2.0, 1.5, -2.6, 2.1, -2.2, 1.2, -1.7], 0.15);
    K.rect('acc', 1.4, -2.3, 21.2, 4.6, 0.5, { sh: 'cyl', tint: 'rgba(0,0,0,0.22)' });
    [-1.42, -0.2, 1.02].forEach((y) => { K.rect('#000', 3.6, y, 15.6, 0.44, 0.22, { sh: null, line: false, alpha: 0.5 }); K.hi([3.9, y + 0.52, 18.9, y + 0.52], 0.8, 0.14); });
    K.lo([2.9, -2.25, 2.9, 2.25], 0.9, 0.45); K.lo([20.0, -2.25, 20.0, 2.25], 0.9, 0.45);
    K.rect('acc', 22.2, -2.42, 2.3, 4.84, 0.35, { sh: 'cyl', tint: 'rgba(0,0,0,0.3)' }); K.ridges(22.4, -2.42, 1.9, 4.84, 0.62, 0.55, true);
    K.text(paCalMark(g), 21.1, 0, 0.78, 'rgba(240,242,245,0.42)', { rot: -Math.PI / 2 });
    paFace(K, 24.5, 0, 2.3, bore * 1.25, 'acc');
  } else if (A.type === 'svd') { // the factory fitting: a long cone with five slots
    K.tube('metal', -2.4, -1.2, 0, r * 1.3, r * 1.3); K.tube('metal', -1.3, 6.4, 0, r * 1.08, r * 1.5);
    [-0.62, -0.08, 0.5].forEach((f, i) => K.rect('#040405', 0.2, r * f, 4.9, r * (i === 1 ? 0.3 : 0.2), r * 0.1, { sh: null, lc: 'rgba(255,255,255,0.1)' }));
    paFace(K, 6.4, 0, r * 1.5, bore * 1.9, 'metal');
  } else if (A.amr) { // the factory arrowhead brake
    const H = r * 2.1 * k;
    K.rpoly('metal', [-2.2, -r * 1.2, -0.8, -H, 3.4, -H, 9.6, -r * 1.35, 9.6, r * 1.35, 3.4, H, -0.8, H, -2.2, r * 1.2], 0.3);
    K.poly('#040405', [0.2, -H * 0.72, 2.6, -H * 0.72, 4.2, -r * 0.2, 4.2, r * 0.2, 2.6, H * 0.72, 0.2, H * 0.72, 1.8, r * 0.2, 1.8, -r * 0.2], { sh: null, lc: 'rgba(255,255,255,0.14)' });
    K.poly('#040405', [4.6, -H * 0.5, 6.2, -H * 0.42, 7.8, -r * 0.2, 7.8, r * 0.2, 6.2, H * 0.42, 4.6, H * 0.5, 6.0, r * 0.2, 6.0, -r * 0.2], { sh: null, lc: 'rgba(255,255,255,0.14)' });
    K.screw(-1.2, 0, 0.3, null, true);
  } else { // nothing fitted: the crown of the barrel
    const fr = thread ? r * 0.76 : r;
    paFace(K, 0.02, 0, fr, bore, 'metal', 'rgba(255,255,255,0.16)');
    if (!thread) K.lo([-0.5, -r * 0.98, -0.5, r * 0.98], 0.8, 0.3);
  }
  // siblings share one scale; each is centred on what it shows
  const xl = sup ? -6.4 : -7.2, Wm = sup ? 32.5 : Math.max(16.4, 8.2 * k + 8.6), W = sup ? Wm : (Wm + (K.x1 - xl) + 2.4) / 2, mid = (xl + K.x1) / 2;
  const Hs = sup ? 4.6 : Math.max(r * 2.1 * k + 0.9, 4.2) * (W / Wm);
  K.frame(mid - W / 2, -Hs, mid + W / 2, Hs); K.fadeX(xl + 3.4, xl);
}

// ===========================================================================
// BARREL
// ===========================================================================
// One barrel drawn through a mapping T: the whole thing for the main view, or a
// magnified stretch of it for a detail bubble. u runs from the breech (0) to the muzzle.
function paBarrelBody(K, env, B, T) {
  const A = env.A, g = env.g, bp = B.bp, L = B.len, r0 = B.r0, r1 = B.r1, yc = T.y, z = T.z, rz = T.rz;
  const X = (u) => T.ox + (u - T.u0) * z, R = (rr) => rr * rz, vis = (u) => u > T.from && u < T.to;
  const seg = (zone, ua, ub, ra, rb, o) => {
    if (ub <= T.from || ua >= T.to) return;
    if (ua < T.from) { ra += ((rb - ra) * (T.from - ua)) / (ub - ua); ua = T.from; }
    if (ub > T.to) { rb = ra + ((rb - ra) * (T.to - ua)) / (ub - ua); ub = T.to; }
    K.tube(zone, X(ua), X(ub), yc, R(ra), R(rb), o);
  };
  const ring = (u, rr, a) => { if (vis(u)) K.lo([X(u), yc - R(rr) * 0.97, X(u), yc + R(rr) * 0.97], 0.8, a || 0.4); };
  const threads = (ua, ub, rr) => { ua = Math.max(ua, T.from); ub = Math.min(ub, T.to); if (ub > ua) K.ridges(X(ua), yc - R(rr), X(ub) - X(ua), R(rr) * 2, 0.22 * z, 0.6); };
  const thread = g.supp === true, end = thread ? L - 1.9 : L, sh = Math.min(8, L * 0.15);
  // threaded tenon that screws into the receiver
  seg('metal', -2.6, 0.1, r0 * 0.72, r0 * 0.72, { tint: 'rgba(255,255,255,0.1)' }); threads(-2.5, 0, r0 * 0.72);
  if (A.can) { // a short barrel inside a full-length suppressor
    seg('metal', 0, A.barrel, r0, r0 * 0.9); ring(sh, r0, 0.3);
    const cr = 2.15 * 0.8, c0 = A.barrel - 0.5, c1 = A.barrel + A.can;
    seg('metal', c0, c1, cr, cr, { tint: 'rgba(0,0,0,0.12)' });
    for (let u = c0 + 3; u < c1 - 2; u += 5) { ring(u, cr, 0.4); if (vis(u)) K.hi([X(u) + 0.15 * z, yc - R(cr) * 0.9, X(u) + 0.15 * z, yc + R(cr) * 0.1], 0.8, 0.12); }
    seg('metal', c1 - 1.8, c1, cr * 1.04, cr * 1.04, { tint: 'rgba(0,0,0,0.25)' });
    if (vis(c1 - 1)) K.ridges(X(c1 - 1.7), yc - R(cr * 1.04), 1.6 * z, R(cr * 1.04) * 2, 0.3 * rz, 0.45, true);
    if (vis(c1 - 0.1)) paFace(K, X(c1), yc, R(cr * 1.04), R(B.bore * 1.2), 'metal');
    if (T.full) K.text(paCalMark(g), X(sh * 0.5), yc + R(r0) * 0.12, Math.min(R(r0) * 0.5, 1.2), 'rgba(235,238,242,0.5)');
    return c1;
  }
  if (bp === 'br_carbon') {
    seg('metal', 0, sh, r0, r0); seg('metal', sh, sh + 2, r0, r1 * 1.04);
    seg('carbon', sh + 2, L - 4.6, r1 * 1.04, r1 * 1.04);
    seg('metal', L - 4.7, end, r1, r1, { tint: 'rgba(255,255,255,0.05)' }); ring(L - 4.7, r1, 0.5); ring(sh + 2, r1, 0.5);
  } else if (A.military) { // stepped military profile
    seg('metal', 0, 9, r0, r0); seg('metal', 9, 22, r0 * 0.86, r0 * 0.8); seg('metal', 22, end, r0 * 0.74, r1); ring(9, r0); ring(22, r0 * 0.8);
  } else {
    const rc = B.stiff ? r1 : r1 * 0.75 + r0 * 0.25;
    seg('metal', 0, sh, r0, r0); seg('metal', sh, sh + 5, r0, rc); seg('metal', sh + 5, end, rc, r1); ring(sh, r0, 0.3);
  }
  if (A.take) { seg('acc', 0, 2.6, r0 * 1.22, r0 * 1.22); if (vis(1.3)) K.ridges(X(0.15), yc - R(r0 * 1.22), 2.3 * z, R(r0 * 1.22) * 2, 0.3 * z, 0.5); }
  // flutes on heavy barrels
  if (((A.heavy || 1) > 1.25 && bp !== 'br_carbon') || bp === 'br_heavy') {
    const fa = Math.max(sh + 8, T.from), fb = Math.min(L - 6, T.to);
    if (fb > fa + 1) [-0.56, -0.02, 0.5].forEach((f) => { const h = R(r1) * 0.2; K.rect('#000', X(fa), yc + R(r1) * f - h / 2, X(fb) - X(fa), h, h / 2, { sh: null, line: false, alpha: 0.48 }); K.hi([X(fa) + h, yc + R(r1) * f + h * 0.7, X(fb) - h, yc + R(r1) * f + h * 0.7], 0.8, 0.14); });
  }
  if (thread) { seg('metal', L - 2.0, L, r1 * 0.76, r1 * 0.76, { tint: 'rgba(255,255,255,0.1)' }); threads(L - 1.95, L - 0.05, r1 * 0.76); }
  const rAt = (u) => r1 + (r0 - r1) * clamp(1 - (u - sh) / (L - sh), 0, 1) * (B.stiff ? 0.1 : 0.4);
  if (A.type === 'ar') { // gas block and the thin gas tube running back over the barrel
    const gb = L * 0.62, gy = yc - R(rAt(gb)) - 0.75 * rz, ga = Math.max(0.4, T.from), gz = Math.min(gb + 0.6, T.to);
    if (gz > ga) K.tube('#8a9098', X(ga), X(gz), gy, 0.26 * rz, 0.26 * rz);
    seg('metal', gb, gb + 2.8, rAt(gb) * 1.55, rAt(gb) * 1.55, { tint: 'rgba(0,0,0,0.15)' });
    if (vis(gb + 1.4)) { K.screw(X(gb + 0.8), yc + R(rAt(gb)) * 1.1, 0.24 * z); K.screw(X(gb + 2.0), yc + R(rAt(gb)) * 1.1, 0.24 * z); }
  }
  if (A.type === 'svd') { // gas block with its piston tube, and the front sight tower
    const gb = L * 0.42, fs = L - 13, ga = Math.max(gb - 12, T.from), gz = Math.min(gb + 0.4, T.to);
    if (gz > ga) K.tube('metal', X(ga), X(gz), yc - R(rAt(gb)) - 1.0 * rz, 0.55 * rz, 0.55 * rz, { tint: 'rgba(255,255,255,0.05)' });
    seg('metal', gb, gb + 2.6, rAt(gb) * 1.7, rAt(gb) * 1.7);
    if (vis(fs) && vis(fs + 1.9)) {
      K.rect('metal', X(fs), yc - R(r1) * 1.35, 1.9 * z, R(r1) * 2.7, 0.2 * z, { sh: 'cyl' });
      K.poly('metal', [X(fs + 0.2), yc - R(r1) * 1.3, X(fs + 1.7), yc - R(r1) * 1.3, X(fs + 1.4), yc - R(r1) * 1.3 - 2.3 * rz, X(fs + 0.5), yc - R(r1) * 1.3 - 2.3 * rz]);
      K.rect('#0b0c0e', X(fs + 0.85), yc - R(r1) * 1.3 - 3.2 * rz, 0.22 * z, 1.0 * rz, 0, { sh: null, line: false });
    }
  }
  if (A.military) {
    if (vis(10) && vis(15.5)) { K.rect('metal', X(10), yc - R(r0) * 0.86 - 0.9 * rz, 5.5 * z, 1.0 * rz, 0.2, {}); K.poly('#15171a', [X(10.4), yc - R(r0) * 0.86 - 0.9 * rz, X(15), yc - R(r0) * 0.86 - 0.9 * rz, X(15), yc - R(r0) * 0.86 - 1.7 * rz], { sh: null }); }
    const fs = L - 5.2;
    if (vis(fs) && vis(fs + 2.4)) {
      K.rect('metal', X(fs), yc - R(r1) * 1.3, 2.4 * z, R(r1) * 2.6, 0.2 * z, { sh: 'cyl' });
      K.poly('metal', [X(fs + 0.2), yc - R(r1) * 1.25, X(fs + 2.2), yc - R(r1) * 1.25, X(fs + 1.9), yc - R(r1) * 1.25 - 0.8 * rz, X(fs + 0.5), yc - R(r1) * 1.25 - 0.8 * rz]);
      K.poly('#0b0c0e', [X(fs + 0.95), yc - R(r1) * 1.25 - 0.8 * rz, X(fs + 1.15), yc - R(r1) * 1.25 - 2.0 * rz, X(fs + 1.3), yc - R(r1) * 1.25 - 2.0 * rz, X(fs + 1.5), yc - R(r1) * 1.25 - 0.8 * rz], { sh: null });
    }
  }
  if (T.full) K.text(paCalMark(g), X(sh * 0.5), yc + R(r0) * 0.12, Math.min(R(r0) * 0.5, 1.2), 'rgba(235,238,242,0.5)');
  else if (T.tu) K.text(paCalMark(g), X(T.tu), yc + R(r0) * 0.1, R(r0) * 0.4, 'rgba(235,238,242,0.62)');
  if (A.mod) { // rimfire moderator sleeve over the last part of the barrel
    const mr = 1.55 * 0.9;
    seg('metal', L - A.mod, L, mr, mr, { tint: 'rgba(0,0,0,0.15)' }); ring(L - A.mod + 0.2, mr, 0.5);
    for (let u = L - A.mod + 1.6; u < L - 2; u += 1.5) if (vis(u)) K.ell('#040405', X(u), yc - R(mr) * 0.25, 0.2 * z, 0.2 * rz, { sh: null, line: false });
    seg('metal', L - 1.7, L, mr * 1.05, mr * 1.05, { tint: 'rgba(0,0,0,0.25)' });
    if (vis(L - 0.1)) paFace(K, X(L), yc, R(mr * 1.05), R(B.bore * 1.3), 'metal');
    return L;
  }
  if (vis(L - 0.1)) paFace(K, X(L) + 0.02 * z, yc, R(thread ? r1 * 0.76 : r1), R(B.bore), 'metal', 'rgba(255,255,255,0.16)');
  return L;
}
// the Stormglass: twin rails with drive coils between them
function paRailBody(K, env, Lf, T) {
  const X = (u) => T.ox + (u - T.u0) * T.z, z = T.z, oy = T.y, a = Math.max(0, T.from), b = Math.min(Lf, T.to), t = env.time || 0;
  K.rect('metal', X(a), oy - 3.5 * z, (b - a) * z, 2 * z, 0.4 * z); K.rect('metal', X(a), oy + 1.3 * z, (b - a) * z, 2 * z, 0.4 * z);
  for (let u = 6; u < Lf - 6; u += 9) {
    if (u + 6 < T.from || u - 1 > T.to) continue;
    paCoil(K, X(u), oy - 1.5 * z, 5 * z, 2.8 * z, t);
    K.rect('metal', X(u - 0.6), oy - 1.9 * z, 0.9 * z, 3.6 * z, 0.2 * z, { tint: 'rgba(255,255,255,0.08)' }); K.rect('metal', X(u + 4.7), oy - 1.9 * z, 0.9 * z, 3.6 * z, 0.2 * z, { tint: 'rgba(255,255,255,0.08)' });
  }
  if (T.from < 2) { K.rpoly('metal', [X(-2.4), oy - 4.3 * z, X(1.4), oy - 4.3 * z, X(1.4), oy + 4.1 * z, X(-2.4), oy + 4.1 * z], 0.5 * z, { tint: 'rgba(0,0,0,0.15)' }); K.screw(X(-0.5), oy - 3.1 * z, 0.45 * z, null, true); K.screw(X(-0.5), oy + 2.9 * z, 0.45 * z, null, true); }
  if (T.to > Lf - 2) {
    K.rpoly('metal', [X(Lf - 2), oy - 4.1 * z, X(Lf + 1), oy - 4.1 * z, X(Lf + 1), oy + 3.9 * z, X(Lf - 2), oy + 3.9 * z], 0.6 * z);
    K.rect('#040405', X(Lf - 1.2), oy - 1.4 * z, 1.4 * z, 2.6 * z, 0.4 * z, { sh: null, lc: 'rgba(111,227,255,0.6)' });
  }
}
// a round detail bubble: a magnified look at one stretch of the part, joined to it by a thin line
function paBubble(K, cx, cy, Rl, ax, ay, drawFn) {
  const dx = ax - cx, dy = ay - cy, dl = Math.hypot(dx, dy) || 1;
  K.hair('rgba(200,214,228,0.5)', [ax, ay, cx + (dx / dl) * Rl, cy + (dy / dl) * Rl], 0.9);
  K.add((c) => { c.fillStyle = 'rgba(200,214,228,0.75)'; c.beginPath(); c.arc(ax, ay, 0.28, 0, TAU); c.fill(); });
  K.ext(cx - Rl, cy - Rl, cx + Rl, cy + Rl);
  K.add((c) => { c.save(); c.beginPath(); c.arc(cx, cy, Rl, 0, TAU); const g = c.createLinearGradient(0, cy - Rl, 0, cy + Rl); g.addColorStop(0, 'rgba(178,196,214,0.3)'); g.addColorStop(1, 'rgba(120,140,162,0.16)'); c.fillStyle = g; c.fill(); c.clip(); });
  drawFn();
  K.add((c, k) => {
    c.restore();
    c.strokeStyle = 'rgba(200,214,228,0.6)'; c.lineWidth = k.px(1.3); c.beginPath(); c.arc(cx, cy, Rl, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = k.px(1.1); c.lineCap = 'round'; c.beginPath(); c.arc(cx, cy, Rl * 0.86, Math.PI * 1.1, Math.PI * 1.4); c.stroke(); c.lineCap = 'butt';
  });
}
// The whole barrel across the top, with two detail bubbles underneath: the breech and the muzzle.
function paBarrel(K, id, env) {
  const A = env.A;
  if (A.can || A.mod || A.type === 'rail') id = 'br_std'; // nothing else fits these
  const Lf = A.barrel + (A.can || 0), Rl = Lf * 0.2;
  if (A.type === 'rail') {
    paRailBody(K, env, Lf, { ox: 0, u0: 0, y: 0, z: 1, from: -99, to: 999 });
    const yL = 4.6 + 1.6 + Rl, zl = (Rl * 0.52) / 4.2, c1 = Lf - Rl + 1.6, c0 = Rl - 2.6;
    paBubble(K, c1, yL, Rl, Lf - 0.5, 4.2, () => paRailBody(K, env, Lf, { ox: c1, u0: Lf - (Rl / zl) * 0.6, y: yL, z: zl, from: Lf - (Rl / zl) * 1.7, to: 999 }));
    paBubble(K, c0, yL, Rl, 8.5, 2.2, () => paRailBody(K, env, Lf, { ox: c0, u0: 6.5, y: yL, z: zl, from: -99, to: 6.5 + (Rl / zl) * 1.2 }));
    K.frame(-3.4, -5, Lf + 3.2, yL + Rl + 0.6);
    return;
  }
  const B = paBarrelDims(env, id), ex = 1.6, total = B.len + (A.can || 0);
  const top = paBarrelBody(K, env, B, { ox: 0, u0: 0, y: 0, z: 1, rz: ex, from: -99, to: 999, full: true });
  if (id === 'br_short') { // dashed ghost of the factory length
    const F = paBarrelDims(env, 'br_std');
    K.hair('rgba(255,255,255,0.3)', [top + 1, -F.r1 * ex, A.barrel, -F.r1 * ex, A.barrel, F.r1 * ex, top + 1, F.r1 * ex], 0.9, { dash: [0.9, 0.7] });
  }
  const canR = A.can ? 2.15 * 0.8 : A.mod ? 1.55 * 0.95 : 0, hTop = Math.max(B.r0, canR) * ex;
  const up = A.military || A.type === 'svd' ? 3.6 : A.type === 'ar' ? 2.2 : 0.8;
  const yL = hTop + 1.6 + Rl, c1 = Lf - Rl + 1.6, c0 = Rl - 2.6;
  const zm = (Rl * 0.4) / Math.max(B.r1, canR), zb = (Rl * 0.4) / B.r0;
  paBubble(K, c1, yL, Rl, total - 0.6, Math.max(B.r1, canR) * ex + 0.25, () => paBarrelBody(K, env, B, { ox: c1, u0: total - (Rl / zm) * 0.52, y: yL, z: zm, rz: zm, from: total - (Rl / zm) * 1.7, to: 999 }));
  paBubble(K, c0, yL, Rl, 1.2, B.r0 * ex + 0.25, () => paBarrelBody(K, env, B, { ox: c0, u0: (Rl / zb) * 0.3, y: yL, z: zb, rz: zb, from: -99, to: (Rl / zb) * 1.45, tu: (Rl / zb) * 0.52 }));
  K.frame(-3.4, -hTop - up, Lf + 3.2, yL + Rl + 0.6);
}

// ===========================================================================
// SUPPORT
// ===========================================================================
function paSupport(K, id, env) {
  if (id === 'sp_bag') { // a work sock filled with sand and tied off
    const tan = 'bag', dk = '#8d7652';
    const body = [-10, -1.6, -7.4, -3.3, 1.5, -3.6, 6.6, -2.9, 9, -1.9, 9, 1.9, 7, 2.6, 3.6, 3.3, 1.8, 4.7, -1.6, 4.5, -2.6, 3.3, -7.4, 3.3, -10, 1.6];
    K.poly(dk, [9, -1.7, 12.6, -3.4, 13.4, -1.1, 13.2, 1.4, 12.4, 3.4, 9, 1.7], { sh: 'soft' });
    K.add((c, k) => { c.save(); c.beginPath(); paPolyPath(c, [9, -1.7, 12.6, -3.4, 13.4, -1.1, 13.2, 1.4, 12.4, 3.4, 9, 1.7]); c.clip(); c.strokeStyle = 'rgba(0,0,0,0.32)'; c.lineWidth = k.px(0.8); c.beginPath(); for (let i = -5; i <= 5; i++) { c.moveTo(9, i * 0.32); c.lineTo(13.6, i * 0.66); } c.stroke(); c.fillStyle = '#b8322c'; c.fillRect(11.6, -4, 0.55, 8); c.restore(); });
    K.rpoly(tan, body, [1.6, 1.6, 1.2, 1.2, 0.8, 0.8, 0.8, 0.7, 1.0, 1.1, 0.6, 1.6, 1.6], { sh: 'soft' });
    K.add((c, k) => { // darker toe and heel, a knitted weave, creases at the tie
      c.save(); c.beginPath(); paRPath(c, body, [1.6, 1.6, 1.2, 1.2, 0.8, 0.8, 0.8, 0.7, 1.0, 1.1, 0.6, 1.6, 1.6]); c.clip();
      c.fillStyle = 'rgba(96,74,44,0.5)'; c.beginPath(); c.ellipse(-10.4, 0, 3.3, 4.4, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(0.2, 5.0, 2.7, 2.3, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(70,52,28,0.14)'; c.lineWidth = k.px(0.7); c.beginPath(); for (let i = -14; i < 14; i += 0.55) { c.moveTo(i, -4); c.lineTo(i + 3, 5); c.moveTo(i + 3, -4); c.lineTo(i, 5); } c.stroke();
      c.strokeStyle = 'rgba(60,44,24,0.38)'; c.lineWidth = k.px(0.9); c.beginPath(); [[-1.4, 0.2], [-0.5, 0.9], [0.5, 1.3], [1.3, 0.5]].forEach((q) => { c.moveTo(8.9, q[0]); c.quadraticCurveTo(7.2, q[0] * 1.2, 5.4, q[0] * 1.6 + q[1] * 0.3); }); c.stroke();
      const g = c.createLinearGradient(0, -3.6, 0, -1.2); g.addColorStop(0, 'rgba(255,255,255,0.2)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(-10, -3.7, 19, 2.6);
      c.restore();
    });
    K.stitch([-6.6, -0.6, -2, -1.2, 3, -0.9, 6.4, -0.5], 'rgba(250,240,215,0.6)', 0.9, true);
    K.rpoly('#7b5a37', [-5.6, 0.6, -3.2, 0.5, -3.1, 2.3, -5.5, 2.4], 0.2, { sh: 'soft' }); K.stitch([-5.3, 0.9, -3.5, 0.8, -3.4, 2.0, -5.2, 2.1, -5.3, 0.9], 'rgba(240,225,190,0.7)', 0.7);
    [8.6, 9.0, 9.4].forEach((x) => K.line('#4a3622', [x, -2.05, x + 0.1, 2.05], 0.3, { cap: 'round' }));
    K.line('#4a3622', [9.1, 1.9, 9.8, 3.6, 8.6, 4.6, 8.2, 3.2, 9.1, 1.9], 0.22, { curve: true }); K.line('#4a3622', [9.1, 1.9, 10.6, 3.2, 11.2, 4.6], 0.22, { curve: true });
    K.add((c) => { const R = makeRng(5); c.fillStyle = '#d8c59a'; for (let i = 0; i < 16; i++) { c.beginPath(); c.arc(R.r(11.4, 14.2), 4.9 - R.r(0, 0.5) * R.f(), R.r(0.07, 0.15), 0, TAU); c.fill(); } });
    K.frame(-11, -5.4, 14.6, 5.9);
    return;
  }
  if (id === 'sp_bipod') {
    const dk = '#1c1f24', md = '#2d3138', lt = '#555c65';
    const leg = (sx, fx) => {
      const tx = sx * 1.7, ty = -5.6, mx = sx * 4.6, my = 2.2, bx = sx * fx, by = 9.4;
      K.poly(lt, paQuad(mx - sx * 0.6, my - 1.6, bx, by, 0.85, 0.8), { sh: 'cylv' });
      for (let i = 1; i <= 5; i++) { const f = i / 6.2; const qx = mx + (bx - mx) * f, qy = my + (by - my) * f; K.lo([qx - 0.42, qy - sx * 0.14, qx + 0.42, qy + sx * 0.14], 0.9, 0.55); }
      K.poly(dk, paQuad(tx, ty, mx, my, 1.5, 1.4), { sh: 'cylv' });
      K.poly(md, paQuad(mx - sx * 0.32, my - 0.9, mx + sx * 0.34, my + 0.9, 1.9, 1.9), { sh: 'cylv' });
      K.hatch(paQuad(mx - sx * 0.32, my - 0.9, mx + sx * 0.34, my + 0.9, 1.9, 1.9), 0.3, 0.5);
      K.spring(sx * 2.9, -5.0, sx * 5.3, 0.6, 11, 0.36, '#9aa2ab', 0.16);
      K.rpoly('rubber', paQuad(bx - sx * 0.25, by - 0.7, bx + sx * 0.5, by + 1.3, 1.5, 2.0), 0.4, { sh: 'soft' });
      K.lo([bx - 0.5, by + 0.5, bx + 0.9 * sx + 0.3, by + 0.3], 0.9, 0.6);
      K.screw(sx * 5.6, 0.9, 0.3, '#8d949c');
    };
    // rail clamp
    K.rect(md, -3.6, -9.6, 7.2, 1.3, 0.25); K.rect('#08090b', -2.2, -9.62, 1.2, 0.55, 0.1, { sh: null, line: false }); K.rect('#08090b', 1.0, -9.62, 1.2, 0.55, 0.1, { sh: null, line: false });
    K.rect(dk, -3.2, -8.4, 6.4, 1.2, 0.25);
    K.rect(md, 3.2, -9.0, 1.9, 1.2, 0.2, { sh: 'cyl' }); K.circ(md, 5.6, -8.4, 1.05); K.add((c, k) => { c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = k.px(0.7); c.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; c.moveTo(5.6 + Math.cos(a) * 0.8, -8.4 + Math.sin(a) * 0.8); c.lineTo(5.6 + Math.cos(a) * 1.04, -8.4 + Math.sin(a) * 1.04); } c.stroke(); });
    K.screw(5.6, -8.4, 0.3, '#8d949c', true);
    leg(-1, 8.2); leg(1, 8.2);
    // pivot block
    K.rpoly(md, [-2.9, -7.3, 2.9, -7.3, 3.5, -4.6, -3.5, -4.6], 0.45);
    K.screw(-1.9, -5.8, 0.5, '#8d949c'); K.screw(1.9, -5.8, 0.5, '#8d949c');
    K.rect('#08090b', -0.8, -6.7, 1.6, 1.3, 0.3, { sh: null, lc: 'rgba(255,255,255,0.1)' });
    K.frame(-10.5, -10, 10.5, 11.2);
    return;
  }
  if (id === 'sp_tripod') {
    const dk = '#1c1f24', md = '#2d3138';
    const leg = (hx, bx, by, shade) => {
      const j1 = 0.42, j2 = 0.72, P = (f) => [hx + (bx - hx) * f, -6.6 + (by + 6.6) * f];
      const a = P(0), b = P(j1), c2 = P(j2), d = P(1);
      K.poly('carbon', paQuad(c2[0], c2[1], d[0], d[1], 0.8, 0.75), { sh: 'cylv', tint: shade });
      K.poly('carbon', paQuad(b[0], b[1], c2[0], c2[1], 1.1, 1.05), { sh: 'cylv', tint: shade });
      K.poly('carbon', paQuad(a[0], a[1], b[0], b[1], 1.45, 1.4), { sh: 'cylv', tint: shade });
      [[b, 1.9], [c2, 1.5]].forEach((q) => { const dx = (bx - hx) * 0.035, dy = (by + 6.6) * 0.035, qd = paQuad(q[0][0] - dx, q[0][1] - dy, q[0][0] + dx, q[0][1] + dy, q[1], q[1]); K.poly('rubber', qd, { sh: 'cylv' }); K.hatch(qd, 0.28, 0.6, 'rgba(255,255,255,0.14)'); });
      K.rpoly('rubber', [d[0] - 0.9, d[1] - 0.5, d[0] + 0.9, d[1] - 0.5, d[0] + 1.2, d[1] + 1.0, d[0] - 1.2, d[1] + 1.0], 0.4, { sh: 'soft' });
    };
    leg(0.5, 2.4, 14.6, 'rgba(0,0,0,0.3)');
    leg(-1.6, -11.5, 14.4); leg(1.6, 11.5, 14.4);
    K.line('#3a3f46', [-5.6, 2.4, 0.9, 3.4, 5.6, 2.4], 0.3);
    // hub, ball head and the rifle clamp
    K.rpoly(md, [-3.0, -8.2, 3.0, -8.2, 3.6, -5.6, -3.6, -5.6], 0.5); K.screw(-2.2, -6.8, 0.42, '#8d949c'); K.screw(2.2, -6.8, 0.42, '#8d949c');
    K.rect(dk, -2.1, -10.2, 4.2, 2.2, 0.4, { sh: 'cylv' });
    K.line(md, [2.0, -9.2, 4.6, -9.9], 0.42); K.circ('#b8322c', 4.9, -10.0, 0.5, { sh: 'soft' });
    K.circ('#9aa2ab', 0, -11.1, 1.75); K.add((c) => { c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(-0.6, -11.8, 0.55, 0.32, -0.5, 0, TAU); c.fill(); });
    K.rect(dk, -0.8, -13.5, 1.6, 1.2, 0.2, { sh: 'cylv' });
    K.rect(md, -5.6, -14.6, 11.2, 1.3, 0.3);
    K.rpoly(md, [-5.6, -14.4, -5.6, -18.2, -4.2, -18.2, -4.2, -14.4], [0, 0.5, 0.3, 0]); K.rpoly(md, [4.2, -14.4, 4.2, -18.2, 5.6, -18.2, 5.6, -14.4], [0, 0.3, 0.5, 0]);
    K.rect('rubber', -4.3, -17.8, 0.55, 3.1, 0.2); K.rect('rubber', 3.75, -17.8, 0.55, 3.1, 0.2);
    K.ridges(-4.3, -17.7, 0.55, 2.9, 0.4, 0.5, true); K.ridges(3.75, -17.7, 0.55, 2.9, 0.4, 0.5, true);
    K.rect(md, 5.5, -16.9, 1.6, 0.8, 0.15, { sh: 'cyl' }); paDial(K, 8.0, -16.5, 1.25, md, { n: 18 });
    K.frame(-13.2, -18.8, 13.2, 16.2);
    return;
  }
  // nothing fitted: the rucksack you rest the fore-end on, lying on its back
  const can = '#636e4b', can2 = '#566042', strap = '#2c3223', lea = '#7b5a37', bk = '#1a1c1f';
  K.line(strap, [-10.4, 5.2, -12.6, 8.2, -8, 8.6, -2.4, 7.4, 1.6, 6], 1.2, { curve: true });
  K.stitch([-10.6, 5.4, -12.3, 8.0, -8, 8.4, -2.6, 7.2], 'rgba(200,205,170,0.4)', 0.7, true);
  K.rpoly(can, [-12.6, -3.4, -10, -5.4, 8.4, -6.2, 12.4, -3.8, 13.2, 3.6, 11.6, 6.2, -11.2, 6.2, -13.4, 3.4], 2.2, { sh: 'soft' });
  K.add((c, k) => { // canvas weave and a sag where the rifle rests
    c.save(); c.beginPath(); paRPath(c, [-12.6, -3.4, -10, -5.4, 8.4, -6.2, 12.4, -3.8, 13.2, 3.6, 11.6, 6.2, -11.2, 6.2, -13.4, 3.4], 2.2); c.clip();
    c.strokeStyle = 'rgba(0,0,0,0.07)'; c.lineWidth = k.px(0.7); c.beginPath(); for (let i = -14; i < 14; i += 0.5) { c.moveTo(i, -7); c.lineTo(i, 7); } for (let j = -7; j < 7; j += 0.5) { c.moveTo(-14, j); c.lineTo(14, j); } c.stroke();
    const g = c.createRadialGradient(-2, -7.5, 0.5, -2, -7.5, 5.5); g.addColorStop(0, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(-9, -8, 14, 6);
    c.restore();
  });
  // webbing rows with their bar tacks
  [1.4, 3.2, 5.0].forEach((y) => { K.rect(can2, -5.4, y - 0.42, 10.6, 0.84, 0.1, { sh: null, lc: 'rgba(0,0,0,0.35)' }); for (let x = -3.9; x < 5; x += 1.5) K.lo([x, y - 0.42, x, y + 0.42], 0.9, 0.5); });
  // top pocket
  K.rpoly(can2, [-8.6, -7.6, 3.0, -8.4, 4.8, -6.0, 4.4, -4.6, -9.4, -4.0, -10, -5.6], 1.2, { sh: 'soft' });
  K.hair('rgba(0,0,0,0.4)', [-9.2, -5.5, -3, -6.3, 4.2, -6.1], 0.9, { curve: true }); K.stitch([-9.0, -5.1, -3, -5.9, 4.0, -5.7], 'rgba(205,210,175,0.5)', 0.7, true);
  K.circ('#9aa2ab', -2.6, -5.0, 0.36);
  // the lid, strapped down
  K.rpoly(can2, [7.6, -6.6, 12.8, -4.6, 14.2, 2.6, 12.4, 6.5, 8.6, 6.5, 9.4, 0], 1.6, { sh: 'soft', tint: 'rgba(0,0,0,0.1)' });
  K.stitch([8.8, -5.4, 12.2, -4, 13.4, 2.4, 11.9, 5.8], 'rgba(205,210,175,0.45)', 0.7, true);
  [[-7.4, -0.3], [6.0, 0.3]].forEach((q) => {
    K.poly(strap, paQuad(q[0], -4.6 + q[1], q[0] + 0.2, 6.2, 1.0), { sh: 'soft' });
    K.rect(bk, q[0] - 0.75, 0.2, 1.7, 1.5, 0.25); K.rect('#3b4046', q[0] - 0.4, 0.55, 1.0, 0.8, 0.1, { sh: null, line: false });
    K.rpoly(lea, [q[0] - 0.65, 4.6, q[0] + 0.85, 4.6, q[0] + 0.85, 6.1, q[0] - 0.65, 6.1], 0.2, { sh: 'soft' }); K.screw(q[0] + 0.1, 5.35, 0.22, '#c9a24a');
  });
  K.line(strap, [10.2, -1.4, 5.0, -1.0, 2.2, -0.9], 0.9, { cap: 'butt' }); K.rect(bk, 4.4, -1.8, 1.7, 1.6, 0.25); K.rect('#3b4046', 4.75, -1.4, 1.0, 0.8, 0.1, { sh: null, line: false });
  K.line(strap, [-13, -1.2, -15.0, -0.4, -14.9, 1.6, -13.2, 2.0], 0.6, { curve: true });
  K.stitch([-11.6, -3.9, -9.6, -5.0, 0, -5.4], 'rgba(205,210,175,0.35)', 0.7, true);
  K.frame(-15.6, -8.8, 14.6, 9.2);
}

// ===========================================================================
// STOCK
// ===========================================================================
// rubber recoil pad on the back of a stock; x is its front face
function paPad(K, x, y0, y1, w, spacer) {
  K.rpoly('rubber', [x - w, y0, x + 0.05, y0, x + 0.05, y1, x - w, y1], [w * 0.6, 0, 0, w * 0.6], { sh: 'soft' });
  for (let y = y0 + 0.8; y < y1 - 0.5; y += 0.78) K.hair('rgba(255,255,255,0.14)', [x - w * 0.82, y, x - w * 0.2, y], 0.9);
  if (spacer) K.rect(spacer, x, y0 + 0.1, 0.24, y1 - y0 - 0.2, 0, { sh: null, line: false });
}
// a raised cheek rest: body from (x0..x1) sitting on yb and rising h, with a padded top
function paCheek(K, x0, x1, yb, h, o) {
  o = o || paNO;
  if (o.posts) [x0 + (x1 - x0) * 0.25, x0 + (x1 - x0) * 0.72].forEach((x) => { K.rect('#9aa2ab', x - 0.4, yb - 0.5, 0.8, o.posts + 0.6, 0.1, { sh: 'cylv' }); K.ridges(x - 0.4, yb - 0.3, 0.8, o.posts, 0.3, 0.4, true); });
  K.rpoly('acc', [x0 - 0.5, yb, x0 + 0.5, yb - h, x1 - 0.6, yb - h - 0.35, x1 + 0.5, yb - 0.3], 0.7);
  K.rpoly('#141619', [x0 + 0.3, yb - h * 0.52, x0 + 0.65, yb - h + 0.02, x1 - 0.7, yb - h - 0.33, x1 - 0.1, yb - h * 0.6], 0.5, { sh: 'soft', line: false });
  K.stitch([x0 + 0.9, yb - h * 0.66, x1 - 0.8, yb - h * 0.74], 'rgba(235,225,200,0.6)', 0.8);
  if (o.screws) { K.screw(x0 + 1.6, yb - h * 0.26, 0.3, '#8d949c', true); K.screw(x1 - 1.6, yb - h * 0.3, 0.3, '#8d949c', true); }
}
// an adjusting wheel on the side of a stock
function paWheel(K, x, y, r) {
  K.circ('#2d3138', x, y, r);
  K.add((c, k) => { c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = k.px(0.7); c.beginPath(); for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; c.moveTo(x + Math.cos(a) * r * 0.74, y + Math.sin(a) * r * 0.74); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.stroke(); });
  K.circ('#8d949c', x, y, r * 0.46); K.screw(x, y, r * 0.2, null, true);
}
// a screw-down rear leg under the butt
function paMonopod(K, x, y, len) {
  K.rect('metal', x - 1.0, y - 0.3, 2.0, 1.2, 0.2);
  K.rect('#9aa2ab', x - 0.38, y + 0.8, 0.76, len - 1.5, 0.1, { sh: 'cylv' }); K.ridges(x - 0.38, y + 0.9, 0.76, len - 1.8, 0.26, 0.45, true);
  K.rect('#2d3138', x - 1.05, y + 1.5, 2.1, 1.25, 0.25, { sh: 'cylv' }); K.ridges(x - 1.0, y + 1.55, 2.0, 1.15, 0.24, 0.55);
  K.rpoly('rubber', [x - 1.2, y + len - 0.9, x + 1.2, y + len - 0.9, x + 1.5, y + len, x - 1.5, y + len], 0.3);
}
// moulded grip texture: a scatter of small pits inside a polygon
function paStipple(K, pts, n, seed, a) {
  K.add((c) => {
    c.save(); c.beginPath(); paPolyPath(c, pts); c.clip();
    const bb = paBB(pts), R = makeRng(seed || 3); c.fillStyle = 'rgba(0,0,0,' + (a || 0.34) + ')';
    for (let i = 0; i < n; i++) { c.beginPath(); c.arc(R.r(bb[0], bb[2]), R.r(bb[1], bb[3]), R.r(0.07, 0.15), 0, TAU); c.fill(); }
    c.restore();
  });
}
// one-piece sporting or service stock; the fore-end runs on out of view
function paStockClassic(K, id, env) {
  const A = env.A, s = A.small ? 0.86 : 1, synth = !!A.synth, mil = !!A.military;
  const skel = id === 'st_skel', chas = id === 'st_chassis', cheek = id === 'st_cheek';
  const bx = -36.4 * s, cut = 20, belly = (x) => 10 * s + ((x + 34 * s) * (4.4 - 10 * s)) / (34 * s - 15);
  let pts, rr; const holes = [];
  if (skel) {
    pts = [cut, -2.1, 0, -2.4, -6, -1.6, -13, -3.2, -34 * s, -2.6, -36 * s, -2.0, bx, 9.2 * s, -33.5 * s, 9.4 * s, -30 * s, 1.2, -14, 1.0, -9, 7.2, -4.5, 6.6, -2, 2.6, 1, 2.3, cut, 2.4];
    rr = [0, 0.3, 3, 3, 0.8, 0.5, 0.5, 0.6, 1.4, 1.2, 1, 1, 1, 0.3, 0];
    const xa = -30 * s + 1.6, xb = -15.4, w = (xb - xa - 1.6) / 3;
    for (let i = 0; i < 3; i++) holes.push([xa + i * (w + 0.8), -1.75, w, 1.7, 0.6]);
  } else {
    pts = [cut, -2.1, 0, -2.4, -6, -1.6, -13, -3.6, -34 * s, -2.4, -36 * s, -2.0, bx, 9.6 * s, -34 * s, 10 * s, -15, 4.4, -8, 6.2, -4, 5.4, -2, 2.6, 1, 2.3, cut, 2.4];
    rr = [0, 0.3, 3, 3, 0.8, 0.5, 0.5, 0.8, 4, 1.2, 1, 1, 0.3, 0];
    if (chas) { holes.push([-31.4 * s, 0.1, 7.2 * s, 4.4 * s, 0.9], [-22.6 * s, 0.1, 5.2 * s, 2.7 * s, 0.8]); }
    else if (mil) holes.push([-30, 2.2, 3.6, 1.1, 0.5]);
  }
  if (chas) { // screw-out butt pad on two rods, and a rear leg
    [0.6, 6.4 * s].forEach((y) => K.rect('#9aa2ab', bx - 1.6, y, 2.4, 0.6, 0.1, { sh: 'cyl' }));
    paMonopod(K, -29.3 * s, belly(-29.3 * s) - 0.2, 4.8);
  }
  K.rpoly('furn', pts, rr, { holes });
  holes.forEach((h) => K.shape(null, [h[0], h[1], h[0] + h[2], h[1] + h[3]], (c) => paRectPath(c, h[0], h[1], h[2], h[3], h[4]), { sh: null, lc: 'rgba(255,255,255,0.14)' }));
  K.rect('#000', 0.6, -2.42, cut - 0.6, 0.5, 0, { sh: null, line: false, alpha: 0.42 }); // the channel the action sits in
  const grip = skel ? [-10.4, 2.0, -4.7, 2.4, -5.2, 6.1, -8.7, 6.6] : [-11.4, 3.0, -4.7, 2.3, -4.9, 4.9, -8.2, 5.7, -12.2, 4.5], fore = [4, 0.1, 14, 0.2, 14, 1.9, 4, 1.8];
  if (chas) paStipple(K, grip, 90, 7, 0.28);
  else if (synth) { paStipple(K, grip, 110, 7, 0.3); paStipple(K, fore, 120, 9, 0.3); }
  else { K.hatch(grip, 0.42, 0.5); K.hatch(fore, 0.42, 0.5); K.shape(null, paBB(grip), (c) => paPolyPath(c, grip), { sh: null, lc: 'rgba(0,0,0,0.45)' }); K.shape(null, paBB(fore), (c) => paPolyPath(c, fore), { sh: null, lc: 'rgba(0,0,0,0.45)' }); }
  K.hi([-13.5, skel ? -2.95 : -3.3, -33 * s, skel ? -2.4 : -2.15], 1, 0.22);
  if (!skel && !chas) {
    if (synth) [2.2, 3.4, 4.6].forEach((y) => { K.lo([-31 * s, y, -31 * s + 9 - (y - 2.2) * 1.2, y - 0.3], 1, 0.3); K.hi([-31 * s, y + 0.16, -31 * s + 9 - (y - 2.2) * 1.2, y - 0.14], 0.8, 0.1); });
    else if (!mil) K.poly('#15171a', [-8.3, 5.85, -4.2, 5.1, -3.9, 5.6, -8.1, 6.45], { sh: 'soft' }); // grip cap
  }
  if (chas) paPad(K, bx - 1.5, -2.0, 9.6 * s, 1.5);
  else if (mil) { // steel butt plate, unit disc, sling slot, finger groove
    K.rpoly('metal', [bx - 0.55, -2.1, bx + 0.25, -2.1, bx + 0.25, 9.7 * s, bx - 0.55, 9.7 * s], 0.25, { tint: 'rgba(255,255,255,0.08)' });
    K.rect('metal', bx + 0.2, -2.55, 3.0, 0.5, 0.2, { tint: 'rgba(255,255,255,0.08)' }); K.screw(bx + 2.2, -2.3, 0.2);
    if (!skel && !chas) { K.circ('#8d949c', -21.5, 2.3, 1.05); K.screw(-21.5, 2.3, 0.3, '#5b636c'); K.shape(null, [-30, 2.2, -26.4, 3.3], (c) => paRectPath(c, -30, 2.2, 3.6, 1.1, 0.5), { sh: null, lc: '#8d949c', lw: 1.4 }); }
    K.rect('#000', 3, -0.75, 14, 0.7, 0.35, { sh: null, line: false, alpha: 0.3 });
  } else paPad(K, bx + 0.1, -2.05, (skel ? 9.25 : 9.65) * s, 1.5, !synth && !A.small ? 'rgba(226,220,200,0.8)' : null);
  if (!mil && !chas) { const sx = -27 * s, sy = skel ? 1.25 : belly(sx); if (!skel) { K.circ('#8d949c', sx, sy + 0.2, 0.42); K.shape(null, [sx - 0.8, sy + 0.4, sx + 0.8, sy + 2], (c) => c.ellipse(sx, sy + 1.2, 0.62, 0.8, 0, 0, TAU), { sh: null, lc: '#9aa2ab', lw: 1.5 }); } }
  if (cheek) { paCheek(K, -27.4, -11.6, -3.0, 2.9, { posts: 0.9 }); paWheel(K, -23.6, -0.4, 1.0); paWheel(K, -15.6, -0.9, 1.0); }
  if (chas) {
    paCheek(K, -27.4, -12.6, -3.0, 2.4, { posts: 0.9, screws: true }); paWheel(K, bx + 3.4, 5.6 * s, 1.1);
    [-11.5, -5.2].forEach((x) => K.screw(x, -0.2, 0.34, '#8d949c', true)); K.screw(-18, 0.9, 0.34, '#8d949c', true);
    K.rect('metal', 3.4, 2.3, cut - 3.4, 0.95, 0.2); for (let x = 4.2; x < cut - 1; x += 1.5) K.rect('#08090b', x, 2.55, 0.8, 0.45, 0.1, { sh: null, line: false });
  }
  K.fadeX(9.5, 16.4);
  K.frame(bx - 3.2, -6.8, 16.4, 10 * s + 5);
}
// skeleton stock of a chassis rifle: folding hinge, top beam, butt carrier, lower strut and grip
function paStockChassis(K, id, env) {
  const A = env.A, s = A.big ? 1.12 : 1, skel = id === 'st_skel', chas = id === 'st_chassis', cheek = id === 'st_cheek';
  const mono = chas || A.amr || A.elr, yT = -4.2 * s, bh = skel ? 1.5 : 2.4, bx = -31 * s, off = chas ? 1.6 : 0;
  K.rpoly('metal', [-0.4, yT - 1.2, 9, yT - 1.2, 9, 1.4, -3.2, 1.4, -3.2, yT + 4.6, -0.4, yT + 4.6], 0.4, { tint: 'rgba(255,255,255,0.03)' });
  K.lo([0.2, -1.2, 9, -1.2], 0.9, 0.3); K.screw(1.4, 0.2, 0.3, '#59616a', true);
  // grip
  const grip = [-2.6, 0.9, 3.3, 0.9, 1.1, 10.5 * s, -5.5, 10.5 * s];
  K.rpoly('furn', grip, [0.3, 1.4, 0.9, 1.3]);
  paStipple(K, [-2.9, 2.6, 2.4, 2.6, 0.9, 9.6 * s, -4.9, 9.6 * s], 160, 4);
  K.lo([-5.2, 10.5 * s - 0.9, 1.2, 10.5 * s - 0.9], 0.9, 0.4); K.screw(-1.4, 10.5 * s - 0.45, 0.24);
  if (mono) paMonopod(K, -26.3 * s, 8.2 * s, 4.8);
  // lower strut
  if (skel) { K.poly('#3a3f46', paQuad(-28.8 * s, 7.5 * s, -3.8, 0.9, 0.75), { sh: 'flat' }); K.hi([-28 * s, 7.0 * s, -5, 0.9], 0.8, 0.2); }
  else {
    K.rpoly('furn', [-28.9 * s, 6.3 * s, -28.9 * s, 8.5 * s, -3.8, 1.8, -3.8, 0.1], 0.3);
    if (chas) for (let i = 0; i < 7; i++) { const f = 0.12 + i * 0.11, x = -28.9 * s + (28.9 * s - 3.8) * f, y = 8.5 * s + (1.8 - 8.5 * s) * f; K.poly('#08090b', paQuad(x, y - 0.12, x + 1.0, y - 0.12 - (8.5 * s - 1.8) / (28.9 * s - 3.8), 0.5), { sh: null, line: false }); }
    else { K.screw(-22 * s, 5.7 * s, 0.34, '#8d949c', true); K.circ('#08090b', -12, 3.0 + (s - 1) * 2, 0.55, { sh: null, lc: 'rgba(255,255,255,0.2)' }); }
  }
  // butt carrier and pad
  if (chas) [-3.2 * s, 5.2 * s].forEach((y) => { K.rect('#9aa2ab', bx - off, y, off + 0.5, 0.6, 0.1, { sh: 'cyl' }); });
  K.rpoly('furn', [bx, -5.2 * s, bx + 2.5 * s, -5.2 * s, bx + 2.5 * s, 8.5 * s, bx, 8.5 * s], 0.5, skel ? { holes: [[bx + 0.7, 0.4, 2.5 * s - 1.4, 5.6 * s, 0.4]] } : null);
  if (!skel) { K.screw(bx + 1.25 * s, -3.6 * s, 0.3, '#8d949c', true); K.screw(bx + 1.25 * s, 3.2 * s, 0.3, '#8d949c', true); }
  paPad(K, bx - off + 0.1, -5.4 * s, 8.7 * s, 1.7);
  if (chas) paWheel(K, bx + 1.25 * s, 0.6 * s, 1.15);
  // top beam
  const slots = [];
  if (!skel) for (let i = 0; i < 3; i++) slots.push([bx + 3.6 * s + i * 7.6 * s, yT + 0.75, 5.6 * s, bh - 1.5, 0.4]);
  K.rpoly('furn', [bx + 1, yT, -2.2, yT, -2.2, yT + bh, bx + 1, yT + bh], 0.5, { holes: slots });
  slots.forEach((h) => K.shape(null, [h[0], h[1], h[0] + h[2], h[1] + h[3]], (c) => paRectPath(c, h[0], h[1], h[2], h[3], h[4]), { sh: null, lc: 'rgba(255,255,255,0.14)' }));
  if (skel) for (let x = bx + 4; x < -5; x += 1.6) K.lo([x, yT + 0.3, x, yT + bh - 0.3], 0.8, 0.28);
  // hinge block
  K.rect('metal', -3, yT - 0.2, 3.5, 5.3, 0.5); K.circ('#8d949c', -1.25, yT + 1.1, 0.55); K.screw(-1.25, yT + 1.1, 0.22, '#5b636c');
  K.rect('#15171a', -2.3, yT + 2.9, 2.1, 1.1, 0.3, { sh: 'soft' }); K.lo([-3, yT + 2.4, 0.5, yT + 2.4], 0.8, 0.4);
  // cheek rest
  if (cheek) { paCheek(K, -22 * s, -9 * s, yT + 0.2, 3.5 * s, { posts: 1.2 }); paWheel(K, -19 * s, yT + 1.2, 0.95); paWheel(K, -12 * s, yT + 1.2, 0.95); }
  else if (skel) { K.rpoly('acc', [-21 * s, yT + 0.1, -20.4 * s, yT - 1.5 * s, -10.6 * s, yT - 1.7 * s, -10 * s, yT + 0.1], 0.5); }
  else paCheek(K, -22 * s, -9 * s, yT + 0.2, 2.3 * s, { screws: chas });
  K.fadeX(3.4, 7.2);
  K.frame(bx - 3.8, -8.6 * s, 7.2, 13.6 * s);
}
// stock on a buffer tube, for the self-loading rifles
function paStockAR(K, id, env) {
  const A = env.A, s = A.big ? 1.12 : 1, skel = id === 'st_skel', chas = id === 'st_chassis', cheek = id === 'st_cheek';
  const ty = -4.6 * s, th = 2.3, bx = -27 * s;
  if (chas) paMonopod(K, -23.4 * s, 5.8 * s, 4.8);
  // buffer tube, with the stops for the sliding stock along its underside
  K.rect('metal', -22 * s, ty, 23.4 * s, th, 0.9, { sh: 'cyl' });
  K.rect('metal', -21 * s, ty + th - 0.25, 19 * s, 0.75, 0.2, { tint: 'rgba(0,0,0,0.2)' });
  for (let x = -20 * s; x < -3.5; x += 2.6 * s) K.ell('#040405', x, ty + th + 0.14, 0.42, 0.2, { sh: null, line: false });
  // castle nut and end plate
  K.rect('metal', -3.2, ty - 0.4, 2.2, th + 0.8, 0.2, { sh: 'cyl', tint: 'rgba(255,255,255,0.06)' }); K.ridges(-3.1, ty - 0.4, 2.0, th + 0.8, 0.7, 0.6, true);
  K.rpoly('metal', [-1.0, ty - 0.7, -0.2, ty - 0.7, -0.2, ty + th + 2.6, -1.0, ty + th + 2.6], 0.25, { tint: 'rgba(0,0,0,0.15)' });
  K.shape(null, [-1.4, ty + th + 0.9, 0.2, ty + th + 2.4], (c) => c.ellipse(-0.6, ty + th + 1.7, 0.42, 0.55, 0, 0, TAU), { sh: null, lc: '#040405', lw: 1.6 });
  K.rect('metal', -0.2, ty + 0.25, 1.6, th - 0.5, 0.1, { sh: 'cyl', tint: 'rgba(255,255,255,0.1)' }); K.ridges(-0.15, ty + 0.25, 1.5, th - 0.5, 0.22, 0.6);
  if (skel) { // a bare sleeve and a hooked butt
    const pts = [bx, -5.4 * s, -10, -5.4 * s, -10, -1.8 * s, -24 * s, -1.4 * s, -24.5 * s, 5.8 * s, bx, 5.8 * s];
    K.rpoly('furn', pts, [0.6, 0.5, 0.5, 1.2, 0.5, 0.6]);
    K.lo([-10.6, -5.2 * s, -10.6, -1.9 * s], 0.9, 0.4); K.screw(-12, -3.5 * s, 0.34, '#8d949c', true);
    for (let x = -22 * s; x < -14; x += 1.5) K.lo([x, -4.9 * s, x, -2.0 * s], 0.8, 0.22);
  } else {
    const pts = [bx, -5.6 * s, -9, -5.6 * s, -9, -1.4 * s, -14, -1.0 * s, -23 * s, 6 * s, bx, 6 * s];
    K.rpoly('furn', pts, [0.7, 0.6, 0.5, 2.2, 0.9, 0.7], { holes: [[-25.4 * s, 1.0 * s, 1.5, 3.0 * s, 0.6]] });
    K.shape(null, [-25.4 * s, s, -25.4 * s + 1.5, 4 * s], (c) => paRectPath(c, -25.4 * s, 1.0 * s, 1.5, 3.0 * s, 0.6), { sh: null, lc: 'rgba(255,255,255,0.14)' });
    K.rpoly('#15171a', [-19.6, -0.2 * s, -12.2, -0.9 * s, -12.5, 0.1 * s, -18.4, 1.6 * s], 0.3, { sh: 'soft' }); K.ridges(-17.6, -0.4 * s, 3.6, 1.4 * s, 0.4, 0.4);
    for (let i = 0; i < 4; i++) K.lo([-23.5 * s + i * 1.3, -5.0 * s, -23.5 * s + i * 1.3, -2.4 * s], 0.9, 0.3);
    K.circ('#08090b', -12.2, -3.5 * s, 0.6, { sh: null, lc: 'rgba(255,255,255,0.2)' });
    K.lo([-9.6, -5.5 * s, -9.6, -1.5 * s], 0.9, 0.35);
  }
  paPad(K, bx + 0.1, -5.7 * s, 6.1 * s, 1.6);
  if (cheek) { paCheek(K, -22 * s, -22 * s + 11.4, -5.5 * s, 2.5 * s, { screws: true }); }
  if (chas) { paCheek(K, -22 * s, -22 * s + 11.4, -5.5 * s, 1.8 * s, { posts: 0.6 }); paWheel(K, -19.4 * s, -3.4 * s, 1.0); paWheel(K, -24.6 * s, -3.4 * s + 0.1, 0.9); }
  K.frame(bx - 2.6, -8.6 * s, 2.4, 6 * s + 5.2);
}
// thumbhole stock of laminated wood, for the Orlov pattern
function paStockSVD(K, id, env) {
  const skel = id === 'st_skel', chas = id === 'st_chassis', cheek = id === 'st_cheek';
  const pts = [0, -2.2, -9, -1.4, -34, -3.4, -36, -3.0, -36.4, 8.2, -33, 8.6, -13, 3.8, -8.5, 9.6, -3.6, 9.0, -1.2, 1.6];
  const hole = skel ? [-29.4, -0.8, -13.6, -0.3, -14.6, 3.0, -30.6, 5.8] : [-27, 0.2, -15, 0.4, -16, 2.6, -28, 4.6];
  if (chas) paMonopod(K, -30.3, 8.0, 4.6);
  K.rect('metal', -0.4, -2.5, 1.5, 4.2, 0.3, { tint: 'rgba(255,255,255,0.1)' }); K.screw(0.5, -0.5, 0.3, '#5b636c');
  K.rpoly('furn', pts, [0.4, 3, 0.8, 0.5, 0.5, 0.8, 2.2, 1.3, 1.3, 0.8], { hole, hr: 1.2 });
  K.shape(null, paBB(hole), (c) => paRPath(c, hole, 1.2), { sh: null, lc: 'rgba(255,255,255,0.16)' });
  K.hi([-10, -1.25, -33.6, -3.15], 1, 0.2);
  paStipple(K, [-10.6, 4.4, -3.4, 2.4, -4.2, 8.6, -8.4, 9.0], 130, 6, 0.4);
  [[-31.5, 6.2], [-11.5, 0.9]].forEach((q) => { K.circ('#c9a24a', q[0], q[1], 0.62); K.screw(q[0], q[1], 0.3, '#8a6a2a'); });
  // steel butt plate with a thin rubber face, and the sling loop
  K.rpoly('metal', [-36.9, -3.1, -36.1, -3.1, -36.1, 8.5, -36.9, 8.5], 0.25, { tint: 'rgba(255,255,255,0.08)' });
  paPad(K, -36.8, -3.1, 8.5, 1.0);
  K.rect('metal', -30.6, 7.2, 2.4, 0.6, 0.2); K.shape(null, [-30.4, 7.6, -28.4, 9.6], (c) => c.ellipse(-29.4, 8.7, 0.8, 0.95, 0, 0, TAU), { sh: null, lc: '#9aa2ab', lw: 1.5 });
  if (cheek) { // the clip-on leather cheek pad with its two straps
    [-26.4, -18].forEach((x) => { K.poly('#5a3a20', paQuad(x, -3.2, x - 0.5, 6.6 - (x + 26.4) * 0.34, 1.0), { sh: 'soft' }); K.rect('#c9a24a', x - 0.85, 1.0 - (x + 26.4) * 0.05, 1.3, 1.1, 0.2); K.rect('#3a2414', x - 0.5, 1.28 - (x + 26.4) * 0.05, 0.6, 0.55, 0.1, { sh: null, line: false }); });
    K.rpoly('#7a4e2a', [-30, -3.2, -29.2, -6.2, -15.2, -5.9, -14, -3.0], 1.0, { sh: 'soft' });
    K.stitch([-29.0, -3.9, -28.6, -5.6, -15.6, -5.3, -14.9, -3.7], 'rgba(240,220,180,0.7)', 0.8); K.hi([-28.4, -5.9, -16, -5.6], 1, 0.25);
  }
  if (chas) { paCheek(K, -29.4, -14.6, -3.1, 2.7, { posts: 0.8, screws: true }); paWheel(K, -33.2, 2.6, 1.05); K.screw(-20, -1.6, 0.34, '#8d949c', true); }
  K.frame(-39.4, -6.8, 2.8, 13);
}
// the Stormglass body: a moulded shell with a lit seam
function paStockRail(K, id, env) {
  const skel = id === 'st_skel', chas = id === 'st_chassis', cheek = id === 'st_cheek', t = env.time || 0, cut = 10;
  const pts = [cut, -6.5, -8, -6.5, -34, -4.5, -37, -3.5, -37, 8, -32, 8.5, -22, 1.5, -8, 2, -6, 9.5, -1, 9.5, 2, 2, cut, 2.2];
  if (chas) paMonopod(K, -33, 8.0, 4.6);
  K.rpoly('furn', pts, [0, 1.2, 1, 0.8, 0.8, 0.8, 1.6, 1, 1, 1, 1, 0], skel ? { holes: [[-33.5, -1.6, -24, -2.2, -25, 0.6, -33.5, 5.6]], hr: 0.8 } : null);
  if (skel) K.shape(null, [-33.5, -2.2, -24, 5.6], (c) => paRPath(c, [-33.5, -1.6, -24, -2.2, -25, 0.6, -33.5, 5.6], 0.8), { sh: null, lc: 'rgba(255,255,255,0.18)' });
  K.lo([-8, -6.3, -8.6, 1.8], 0.9, 0.3); K.lo([-21, -5.3, -21.6, 1.3], 0.9, 0.3); K.lo([-33.5, -4.2, cut, -4.4], 0.9, 0.25);
  K.add((c, k) => { const p = 0.7 + 0.3 * Math.sin(t * 3); c.strokeStyle = 'rgba(111,227,255,' + (0.3 * p).toFixed(3) + ')'; c.lineWidth = k.px(4); c.lineCap = 'round'; c.beginPath(); c.moveTo(-19.5, -1.4); c.lineTo(-9.6, -1.9); c.stroke(); c.strokeStyle = '#8fecff'; c.lineWidth = k.px(1.4); c.stroke(); c.lineCap = 'butt'; });
  for (let x = -6; x < 6; x += 1.5) K.rect('#08090b', x, -2.6, 0.8, 2.2, 0.3, { sh: null, line: false, alpha: 0.75 });
  paStipple(K, [-6.4, 3.4, 0.6, 3.4, -1.4, 9.0, -5.8, 9.0], 110, 11, 0.3);
  K.screw(-30, -2.9, 0.34, '#8d949c', true); K.screw(-11, 0.3, 0.34, '#8d949c', true);
  paPad(K, -36.9, -3.5, 8.0, 1.4);
  if (cheek) { paCheek(K, -29, -14, -5.0, 2.6, { posts: 0.7 }); paWheel(K, -25.5, -2.8, 0.95); }
  if (chas) { paCheek(K, -29, -15, -5.0, 2.0, { screws: true }); paWheel(K, -34.4, 2.2, 1.05); }
  K.fadeX(2.4, 7.4);
  K.frame(-39.6, -8.2, 7.4, 13);
}
function paStock(K, id, env) {
  const t = env.A.type;
  if (t === 'ar') paStockAR(K, id, env);
  else if (t === 'chassis') paStockChassis(K, id, env);
  else if (t === 'svd') paStockSVD(K, id, env);
  else if (t === 'rail') paStockRail(K, id, env);
  else paStockClassic(K, id, env);
}

// ===========================================================================
// TRIGGER
// ===========================================================================
// the blade your finger pulls: curved (factory) or flat and skeletonised (match)
function paBlade(K, x, y, len, col, flat) {
  if (flat) {
    K.rpoly(col, [x - 0.8, y, x + 0.8, y, x + 0.62, y + len, x - 0.62, y + len], [0, 0, 0.4, 0.4], { holes: [[x - 0.3, y + len * 0.2, 0.6, len * 0.24, 0.25], [x - 0.3, y + len * 0.52, 0.6, len * 0.3, 0.25]] });
    K.rect(col, x + 0.5, y + len * 0.26, 0.5, len * 0.7, 0.2, { tint: 'rgba(0,0,0,0.22)' }); K.ridges(x + 0.5, y + len * 0.3, 0.5, len * 0.62, 0.32, 0.5, true);
  } else {
    K.shape(col, [x - 1.5, y, x + 1.1, y + len], (c) => { c.moveTo(x - 1.2, y); c.lineTo(x + 0.95, y); c.bezierCurveTo(x + 0.3, y + len * 0.3, x - 0.1, y + len * 0.62, x + 1.05, y + len * 0.93); c.lineTo(x + 0.35, y + len); c.bezierCurveTo(x - 1.5, y + len * 0.7, x - 1.3, y + len * 0.3, x - 1.2, y); c.closePath(); });
    K.hair('rgba(255,255,255,0.22)', [x + 0.55, y + len * 0.18, x + 0.2, y + len * 0.42, x + 0.3, y + len * 0.7], 0.9, { curve: true });
  }
}
function paTrigger(K, id, env) {
  const g = env.g, match = id === 'tr_match', semi = g.action === 'semi', coil = g.action === 'charge';
  const gold = '#d6a12a', red = '#c8322c', steel = '#9aa2ab', dk = '#2c3036', t = env.time || 0;
  if (semi) { // hammer, trigger and disconnector on their two pins
    if (match) { // a drop-in cassette holding the lot
      K.rpoly('#aab2ba', [-5.0, -1.9, 3.9, -1.9, 3.9, 1.5, -5.0, 1.5], 0.4, { holes: [[-3.9, -1.0, 2.2, 1.5, 0.4]] });
      K.shape(null, [-3.9, -1, -1.7, 0.5], (c) => paRectPath(c, -3.9, -1.0, 2.2, 1.5, 0.4), { sh: null, lc: 'rgba(0,0,0,0.4)' });
      K.hi([-4.7, -1.72, 3.6, -1.72], 1, 0.4);
    }
    const hc = match ? '#c9ced4' : '#373c43';
    K.line('rgba(0,0,0,0.6)', [2.6, 0.2, 4.9, 0.9], 0.34, { cap: 'round' }); K.line(steel, [2.6, 0.2, 4.9, 0.9], 0.18, { cap: 'round' });
    K.shape(hc, [-0.8, -5.6, 3.8, 0.4], (c) => { paRPath(c, [1.1, 0.3, 3.3, 0.3, 3.7, -1.2, 2.5, -4.6, 0.7, -5.5, -0.7, -4.9, 0.1, -3.9, 1.0, -3.4, 1.1, -1.4], [0.4, 0.4, 0.5, 0.6, 0.5, 0.3, 0.3, 0.4, 0.5]); if (match) { c.moveTo(2.7, -2.2); c.arc(2.2, -2.2, 0.5, 0, TAU); c.moveTo(2.1, -3.6); c.arc(1.7, -3.6, 0.4, 0, TAU); } }, { eo: match });
    K.circ(steel, 2.2, -0.5, 0.62); K.screw(2.2, -0.5, 0.3, '#5b636c');
    K.shape(null, [1.1, -1.6, 3.3, 0.6], (c) => c.arc(2.2, -0.5, 0.95, Math.PI * 0.2, Math.PI * 1.6), { sh: null, lc: steel, lw: 1.5 });
    // trigger body with its tail, disconnector on top
    const tc = match ? red : '#2a2e34';
    K.rpoly(match ? '#c9ced4' : '#3d424a', [-4.4, -1.3, -0.7, -1.9, -0.2, -2.9, -1.0, -3.0, -1.4, -2.3, -4.4, -1.8], 0.2);
    K.rpoly(match ? '#8f979f' : '#2a2e34', [-4.6, -0.7, -0.4, -1.2, 1.0, -0.4, 1.0, 0.9, -4.2, 0.9], 0.3);
    paBlade(K, -1.5, 0.8, 4.6, tc, match);
    K.circ(steel, -1.1, 0.0, 0.55); K.screw(-1.1, 0.0, 0.26, '#5b636c');
    K.spring(-3.9, 0.4, -3.9, -0.9, 4, 0.3, steel, 0.15);
    if (match) { [[-4.3, -1.45], [3.3, -1.45], [3.3, 1.05]].forEach((q) => K.screw(q[0], q[1], 0.3, gold, true)); K.screw(-3.2, 1.05, 0.3, gold, true); for (let i = 0; i < 5; i++) K.lo([-0.2 + i * 0.5, 1.0, -0.2 + i * 0.5, 1.4], 0.8, 0.5); }
    K.frame(-6.2, -6.2, 6.4, 6.2);
    return;
  }
  // a boxed trigger unit, as fitted under a bolt action
  const hc = match ? '#aab2ba' : dk;
  if (coil) { // the coil gun fires through a switch: two leads run off to the capacitors
    K.line('#1c8fb0', [3.6, -2.6, 6.2, -3.4, 7.6, -1.6, 9, -2.2], 0.3, { curve: true }); K.line('#d0872a', [3.6, -1.6, 6.0, -1.0, 7.4, -0.2, 9, -0.9], 0.3, { curve: true });
    K.add((c) => { const p = 0.7 + 0.3 * Math.sin(t * 4), gg = c.createRadialGradient(2.9, -2.1, 0, 2.9, -2.1, 1.3); gg.addColorStop(0, 'rgba(111,227,255,' + (0.6 * p).toFixed(3) + ')'); gg.addColorStop(1, 'rgba(111,227,255,0)'); c.fillStyle = gg; c.fillRect(1.4, -3.6, 3, 3); });
  }
  K.rpoly(match ? steel : '#59616a', [-3.9, -3.3, -3.3, -5.0, -1.7, -5.0, -1.4, -3.3], 0.3); // sear
  K.rpoly(hc, [-4.6, -3.5, 4.4, -3.5, 4.4, -0.3, 2.9, 1.3, -3.4, 1.3, -4.6, 0.2], 0.45);
  K.hi([-4.3, -3.32, 4.1, -3.32], 1, match ? 0.45 : 0.2);
  K.rect('#08090b', match ? -1.0 : -0.2, -2.6, match ? 3.9 : 3.0, 1.8, 0.35, { sh: null, lc: 'rgba(255,255,255,0.12)' });
  if (match) { // two sears and a roller: the first stage takes up, the second breaks
    K.rpoly(steel, [-0.7, -1.0, 0.9, -2.3, 1.3, -1.9, -0.2, -0.9], 0.15); K.rpoly('#c9ced4', [1.2, -2.3, 2.6, -1.4, 2.3, -0.95, 1.0, -1.7], 0.15);
    K.circ('#e3e6ea', 1.15, -1.75, 0.34); K.screw(1.15, -1.75, 0.14, '#8d949c');
    K.spring(-3.6, -1.9, -1.4, -1.9, 7, 0.3, '#6fb6ff', 0.13);
    [[-3.6, -2.9], [3.7, -2.9], [3.7, -0.9]].forEach((q) => K.screw(q[0], q[1], 0.32, gold, true)); K.screw(-3.9, -0.2, 0.3, gold, true);
    for (let i = 0; i < 6; i++) K.lo([-3.0 + i * 0.36, 0.5, -3.0 + i * 0.36, i % 5 === 0 ? 1.05 : 0.85], 0.8, 0.5);
    K.rect(gold, 2.0, 0.9, 0.5, 1.5, 0.1, { sh: 'cylv' }); K.ridges(2.0, 1.0, 0.5, 1.3, 0.25, 0.5, true);
  } else {
    K.spring(0.1, -1.7, 2.5, -1.7, 7, 0.42, steel, 0.2);
    K.circ('#59616a', -3.2, -2.5, 0.48); K.screw(-3.2, -2.5, 0.22, '#30343a'); K.circ('#59616a', 3.5, -2.5, 0.48); K.screw(3.5, -2.5, 0.22, '#30343a');
    K.screw(-2.4, 0.3, 0.3, '#59616a');
  }
  // safety catch
  K.rpoly(match ? steel : '#3d424a', [2.2, -3.4, 2.6, -4.6, 4.3, -4.9, 4.6, -4.2, 3.4, -3.4], 0.25); K.circ(red, 3.9, -4.4, 0.24, { sh: null, line: false });
  paBlade(K, -0.6, 1.2, 4.8, match ? red : '#22262b', match);
  K.frame(coil ? -6 : -6.6, -5.8, coil ? 9.4 : 6.6, 6.6);
}

// ===========================================================================
// ACTION
// ===========================================================================
// a four-point glint on polished steel
function paGlint(K, x, y, r) {
  K.add((c) => { c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, rr = i % 2 ? r * 0.18 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); });
}
function paAction(K, id, env) {
  const g = env.g, A = env.A, slick = id === 'ac_slick', steel = '#9aa2ab', t = env.time || 0;
  if (g.action === 'charge') { // the Stormglass: a capacitor bank and its switching block
    K.rpoly('metal', [-9, -3.6, 9, -3.6, 9, 3.8, -9, 3.8], 0.6);
    K.rect('#c07a44', -8, -3.0, 11.6, 0.7, 0.2, { sh: 'cyl' });
    for (let i = 0; i < 4; i++) {
      const x = -7.6 + i * 2.9;
      K.rect('#2f6db5', x, -2.3, 2.4, 5.2, 0.4, { sh: 'cylv' }); K.rect('#c9ced4', x, -2.3, 2.4, 0.7, 0.3, { sh: 'cylv' }); K.rect('#e9edf2', x + 1.6, -1.5, 0.4, 4.2, 0, { sh: null, line: false, alpha: 0.7 });
      K.lo([x + 0.1, 2.3, x + 2.3, 2.3], 0.9, 0.4); K.rect('#c07a44', x + 0.9, -3.0, 0.6, 0.8, 0, { sh: null, line: false });
    }
    K.rect('#191b20', 4.4, -2.6, 3.8, 5.4, 0.4); K.ridges(4.6, -2.4, 3.4, 3.0, 0.5, 0.6);
    K.add((c) => { const p = 0.65 + 0.35 * Math.sin(t * 4), gg = c.createRadialGradient(6.3, 1.7, 0, 6.3, 1.7, 1.9); gg.addColorStop(0, 'rgba(111,227,255,' + (0.7 * p).toFixed(3) + ')'); gg.addColorStop(1, 'rgba(111,227,255,0)'); c.fillStyle = gg; c.fillRect(4.4, -0.2, 3.8, 3.8); });
    K.rect('#6fe3ff', 5.0, 1.3, 2.6, 0.8, 0.3, { sh: 'soft', lc: 'rgba(0,40,60,0.7)' });
    [-8.3, 8.3].forEach((x) => { K.screw(x, -3.0, 0.3, null, true); K.screw(x, 3.2, 0.3, null, true); });
    K.line('#1c8fb0', [9, -1.2, 10.6, -1.6, 11.6, -0.6], 0.34, { curve: true }); K.line('#d0872a', [9, 0.6, 10.4, 1.2, 11.6, 0.8], 0.34, { curve: true });
    K.frame(-10.4, -6.4, 12.4, 6.6);
    return;
  }
  if (g.action === 'single') { // a falling block worked by an under-lever, with the one round on its way in
    const C = paCAL[g.cal] || paCAL.c65, dk = '#2a2e34';
    paRound(K, C, env.cfg.ammo, 0.6, -2.6, 0.1, env, true);
    const lev = [-0.6, 3.4, -1.8, 5.4, -5.6, 6.2, -8.4, 5.2, -8.0, 3.8, -5.4, 3.3, -2.6, 3.5];
    K.line('rgba(0,0,0,0.75)', lev, 1.05, { curve: true }); K.line('#59616a', lev, 0.72, { curve: true }); K.hair('rgba(255,255,255,0.25)', lev, 0.8, { curve: true });
    K.rpoly('metal', [-4.6, -1.4, 2.6, -1.4, 2.6, 4.0, -4.6, 4.0], 0.5, { tint: 'rgba(255,255,255,0.05)' });
    K.rpoly(dk, [-2.2, -3.6, 0.2, -3.6, 0.2, 3.0, -2.2, 3.0], [0.5, 0.2, 0.3, 0.3]); K.hi([-1.9, -3.4, -0.1, -3.4], 1, 0.35);
    K.rect('#08090b', -1.9, -3.0, 1.8, 0.5, 0.2, { sh: null, line: false, alpha: 0.6 });
    K.circ(steel, -1.0, -2.0, 0.5); K.screw(-1.0, -2.0, 0.16, '#30343a'); K.rect(steel, 0.1, -1.6, 0.7, 0.9, 0.1);
    K.rpoly(dk, [-4.4, -1.6, -3.4, -4.2, -2.6, -4.4, -2.4, -3.6, -3.0, -3.2, -3.0, -1.2], 0.3); K.ridges(-3.5, -4.3, 1.0, 0.6, 0.2, 0.6);
    K.circ(steel, -0.8, 2.9, 0.6); K.screw(-0.8, 2.9, 0.28, '#5b636c'); K.screw(-3.8, 3.2, 0.3, '#5b636c'); K.screw(1.8, -0.6, 0.3, '#5b636c');
    K.frame(-9.8, -5.6, 8.4, 7.2);
    return;
  }
  if (g.action === 'semi') { // bolt carrier, with its return spring and buffer underneath
    const cc = slick ? '#c9ced4' : '#3a3e45', bc = slick ? '#e3e6ea' : '#8d949c';
    K.tube(bc, 4.8, 6.7, 0, 0.85, 0.85); K.rect(bc, 6.5, -1.08, 1.05, 2.16, 0.12, { sh: 'cyl' }); K.ridges(6.5, -1.08, 1.05, 2.16, 0.36, 0.6, true);
    K.ell(bc, 7.55, 0, 0.26, 0.86, { sh: 'cyl' }); K.ell('#040405', 7.57, 0, 0.07, 0.2, { sh: null, line: false });
    K.tube(cc, 4.4, 6.5, -1.95, 0.4, 0.4); K.ell('#040405', 6.5, -1.95, 0.1, 0.26, { sh: null, line: false });
    K.rpoly(cc, [-0.6, -2.5, 4.8, -2.5, 4.8, -1.1, -0.6, -1.1], 0.3); K.screw(0.9, -1.85, 0.3, slick ? '#8d949c' : '#59616a', true); K.screw(2.9, -1.85, 0.3, slick ? '#8d949c' : '#59616a', true);
    K.rpoly(cc, [-8, -1.3, 5, -1.3, 5, 1.3, -3.4, 1.3, -3.9, 0.9, -8, 0.9], 0.3, { sh: 'cyl', holes: slick ? [[-7.2, -0.75, 2.6, 1.0, 0.45], [-3.6, -0.75, 1.6, 1.0, 0.45]] : null });
    if (slick) [[-7.2, 2.6], [-3.6, 1.6]].forEach((q) => K.shape(null, [q[0], -0.75, q[0] + q[1], 0.25], (c) => paRectPath(c, q[0], -0.75, q[1], 1.0, 0.45), { sh: null, lc: 'rgba(0,0,0,0.45)' }));
    K.rect('#08090b', -1.2, -0.5, 3.0, 1.0, 0.3, { sh: null, lc: 'rgba(255,255,255,0.12)', alpha: slick ? 0.85 : 1 });
    K.rect(bc, 2.3, -0.8, 1.2, 1.1, 0.25); K.lo([2.9, -0.7, 2.9, 0.2], 0.9, 0.5);
    K.ridges(-3.2, 0.35, 2.6, 0.85, 0.3, 0.55); K.screw(-6.0, 0.25, 0.26, slick ? '#8d949c' : '#59616a');
    // buffer and spring
    K.rect('rubber', -8.7, 3.55, 1.0, 1.3, 0.35); K.rect(slick ? '#c9ced4' : '#59616a', -8, 3.3, 4.0, 1.8, 0.5, { sh: 'cyl' }); K.lo([-6.6, 3.4, -6.6, 5.0], 0.9, 0.4); K.lo([-5.2, 3.4, -5.2, 5.0], 0.9, 0.4);
    K.spring(-4.0, 4.2, 7.6, 4.2, slick ? 13 : 19, 0.85, slick ? '#6fb6ff' : '#8d949c', slick ? 0.16 : 0.24);
    if (slick) { paGlint(K, -5.6, -1.0, 0.7); paGlint(K, 3.9, -2.3, 0.55); paGlint(K, 6.0, -0.6, 0.45); }
    K.frame(-9.8, -3.6, 8.6, 6.2);
    return;
  }
  // a turn-bolt, with its striker and spring laid out underneath
  const bc = slick ? '#c9ced4' : '#272b31', hc = slick ? '#dfe3e8' : '#30343b';
  K.rect(steel, -12.3, -0.5, 1.6, 1.0, 0.2, { sh: 'cyl' }); if (slick) K.rect('#c8322c', -11.3, -0.5, 0.3, 1.0, 0, { sh: null, line: false });
  K.rpoly(bc, [-11.2, -1.25, -7.3, -1.35, -7.3, 1.35, -11.2, 1.25], [0.7, 0, 0, 0.7], { sh: 'cyl' });
  if (A.military) { K.rpoly(bc, [-10.6, -1.2, -10.0, -2.8, -8.6, -2.8, -8.3, -1.2], 0.35, { tint: 'rgba(255,255,255,0.05)' }); K.ridges(-9.9, -2.7, 1.2, 0.7, 0.24, 0.5); }
  K.tube(bc, -7.5, 6.2, 0, 1.1, 1.1);
  if (slick) K.add((c, k) => { // engine turning and spiral flutes
    c.save(); c.beginPath(); c.rect(-7.4, -1.1, 13.5, 2.2); c.clip();
    c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = k.px(0.8); for (let x = -7; x < 6.2; x += 0.62) { c.beginPath(); c.arc(x, -0.45, 0.45, 0, TAU); c.stroke(); c.beginPath(); c.arc(x + 0.31, 0.45, 0.45, 0, TAU); c.stroke(); }
    c.fillStyle = 'rgba(0,0,0,0.3)'; for (let x = -2.6; x < 4.8; x += 2.3) { c.beginPath(); c.moveTo(x, -1.1); c.lineTo(x + 0.55, -1.1); c.lineTo(x + 1.75, 1.1); c.lineTo(x + 1.2, 1.1); c.closePath(); c.fill(); }
    c.restore();
  });
  else K.add((c, k) => { const R = makeRng(21); c.save(); c.beginPath(); c.rect(-7.4, -1.1, 13.5, 2.2); c.clip(); c.strokeStyle = 'rgba(200,208,216,0.16)'; c.lineWidth = k.px(0.7); c.beginPath(); for (let i = 0; i < 16; i++) { const x = R.r(-7, 5.4), y = R.r(-0.9, 0.9), l = R.r(0.5, 2); c.moveTo(x, y); c.lineTo(x + l, y + R.r(-0.08, 0.08)); } c.stroke(); c.restore(); });
  K.rect(steel, 3.4, 0.36, 4.5, 0.44, 0.1, { tint: slick ? 'rgba(255,255,255,0.2)' : null }); K.lo([7.3, 0.36, 7.3, 0.8], 0.9, 0.6);
  K.ell('#040405', 4.4, -0.42, 0.22, 0.22, { sh: null, line: false }); K.ell('#040405', 5.3, -0.42, 0.22, 0.22, { sh: null, line: false });
  K.tube(hc, 6.0, 7.2, 0, 0.94, 0.94); K.rect(hc, 6.9, -1.8, 1.35, 1.25, 0.15, { sh: 'cyl' }); K.rect(hc, 6.9, 0.55, 1.35, 1.25, 0.15, { sh: 'cyl' });
  K.ell(hc, 8.25, 0, 0.28, 0.94, { sh: 'cyl' }); K.ell('#040405', 8.27, 0, 0.06, 0.18, { sh: null, line: false });
  K.rect(bc, -5.7, -1.25, 1.8, 2.5, 0.3, { sh: 'cyl' });
  if (slick) { // skeleton handle and a big fluted knob
    K.shape(hc, [-7.8, 0.4, -4.2, 5.4], (c) => { paPolyPath(c, paQuad(-4.8, 0.6, -6.9, 5.2, 1.1, 0.85)); paPolyPath(c, paQuad(-5.3, 1.8, -6.3, 4.0, 0.42, 0.34)); }, { eo: true });
    K.rpoly(hc, paQuad(-6.75, 4.7, -7.9, 7.5, 2.0, 2.3), 0.6, { sh: 'cylv' }); for (let i = 0; i < 5; i++) K.lo([-7.6 + i * 0.4, 5.3 + i * 0.1, -8.3 + i * 0.4, 7.2 + i * 0.1], 0.9, 0.4);
  } else { K.poly(bc, paQuad(-4.8, 0.6, -6.9, 5.2, 0.95, 0.75)); K.circ(bc, -7.2, 6.1, 1.25, { tint: 'rgba(255,255,255,0.04)' }); K.add((c) => { c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.ellipse(-7.6, 5.6, 0.4, 0.24, -0.5, 0, TAU); c.fill(); }); }
  // striker
  K.tube(steel, -3.2, 6.4, 4.7, 0.26, 0.26); K.poly(steel, [6.4, 4.44, 7.9, 4.6, 7.9, 4.8, 6.4, 4.96], { sh: 'cyl' }); K.rect(steel, -3.6, 4.0, 1.0, 1.4, 0.2, { sh: 'cyl' }); K.rect(steel, 4.9, 4.2, 0.6, 1.0, 0.15, { sh: 'cyl' });
  K.spring(-2.5, 4.7, 4.9, 4.7, slick ? 11 : 17, 0.72, slick ? '#6fb6ff' : '#8d949c', slick ? 0.15 : 0.25);
  if (slick) { paGlint(K, -3.2, -0.75, 0.75); paGlint(K, 7.4, -1.5, 0.55); paGlint(K, -8.0, 5.4, 0.6); }
  K.frame(-13.2, -3.4, 9.2, 8.2);
}

// ===========================================================================
// MAGAZINE
// ===========================================================================
// A box magazine with a window cut in its side: the rounds, the follower and the spring show.
//   P: w length along the rounds, h depth, lean how far the bottom sits forward of the top,
//      n rounds shown, zone, ribs, fol follower colour
function paMagBox(K, id, env, P) {
  const C = paCAL[env.g.cal] || paCAL.c308, ext = id === 'mg_ext', quick = id === 'mg_quick';
  const w = P.w, h = P.h * (ext ? P.ext || 1.42 : 1), lean = P.lean * (ext ? 1.5 : 1), pw = P.pw === undefined ? 1.5 : P.pw;
  const sm = (w * 0.84) / C.oal, rr = C.rim * sm, pitch = rr * 2 * (P.single ? 1.03 : 0.9);
  const sx = (v) => lean * Math.pow(Math.max(0, v), pw);            // forward shift at depth v (0..1)
  const edge = (u, v0, v1) => { const o = []; for (let i = 0; i <= 6; i++) { const v = v0 + ((v1 - v0) * i) / 6; o.push(u * w + sx(v), v * h); } return o; };
  const quad = (u0, u1, v0, v1) => { const a = edge(u0, v0, v1), b = edge(u1, v1, v0); return a.concat(b); };
  const zone = P.zone || 'acc', n = P.n + (ext ? P.extN || 2 : 0);
  // the round waiting at the lips
  paRound(K, C, env.cfg.ammo, w * 0.06, -rr * 0.3, sm, env, true);
  // body
  const body = quad(0, 1, 0, 1);
  K.poly(zone, body, { sh: 'flat' });
  K.rpoly(zone, [0, 0.2, 0, -rr * 1.25, w * 0.4, -rr * 1.25, w * 0.5, 0.2], [0, 0.3, 0.5, 0], {}); K.hi([0.2, -rr * 1.1, w * 0.36, -rr * 1.1], 0.9, 0.3);
  // the window and what is inside it
  const win = quad(0.12, 0.9, 0.07, 0.86);
  K.poly('#0a0b0d', win, { sh: null, lc: 'rgba(0,0,0,0.6)' });
  K.add((c) => { c.save(); c.beginPath(); paPolyPath(c, win); c.clip(); });
  const type = env.cfg.ammo;
  let y = 0.07 * h + rr * 1.05;
  for (let i = 0; i < n && y < h * 0.62; i++, y += pitch) paRound(K, C, type, w * 0.1 + sx(y / h) + (P.single ? 0 : (i % 2 ? rr * 0.25 : -rr * 0.1)), y, sm, env, true);
  const fy = y - pitch + rr * 1.15, fv = fy / h, fcol = P.fol || '#d08a2a';
  K.poly(fcol, [w * 0.13 + sx(fv), fy, w * 0.89 + sx(fv), fy - rr * 0.25, w * 0.89 + sx(fv + 0.08), fy + rr * 0.9, w * 0.5 + sx(fv + 0.1), fy + rr * 1.5, w * 0.13 + sx(fv + 0.1), fy + rr * 1.3], { sh: 'soft' });
  const sp = [], sy0 = fy + rr * 1.3, sy1 = h * 0.86, turns = Math.max(3, Math.round((sy1 - sy0) / (w * 0.14)));
  for (let i = 0; i <= turns; i++) { const yy = sy0 + ((sy1 - sy0) * i) / turns, xx = (i % 2 ? 0.8 : 0.2) * w + sx(yy / h); sp.push(xx, yy); }
  if (sp.length >= 4) { K.line('rgba(0,0,0,0.6)', sp, w * 0.05, { cap: 'round' }); K.line('#a9b1ba', sp, w * 0.028, { cap: 'round' }); }
  K.add((c) => c.restore());
  K.poly(null, win, { sh: null, lc: 'rgba(255,255,255,0.2)' });
  K.add((c) => { c.save(); c.beginPath(); paPolyPath(c, win); c.clip(); c.fillStyle = 'rgba(190,215,240,0.07)'; c.beginPath(); c.moveTo(w * 0.12, 0); c.lineTo(w * 0.5, 0); c.lineTo(w * 0.2 + lean, h); c.lineTo(lean - w * 0.2, h); c.closePath(); c.fill(); c.restore(); });
  // pressed ribs, witness marks down the spine
  if (P.ribs === 'h') for (let v = 0.2; v < 0.85; v += 0.16) { K.lo([0.012 * w + sx(v), v * h, 0.11 * w + sx(v), v * h], 1, 0.4); K.lo([0.91 * w + sx(v), v * h, 0.99 * w + sx(v), v * h], 1, 0.4); }
  else { K.hair('rgba(255,255,255,0.12)', edge(0.06, 0.05, 0.9), 0.9); K.hair('rgba(0,0,0,0.4)', edge(0.95, 0.05, 0.9), 0.9); }
  const cap = Math.round(env.g.mag * (ext ? 1.6 : 1));
  K.text(String(Math.max(cap, env.g.mag + (ext ? 1 : 0))), w * 0.5 + sx(0.93), h * 0.93, Math.min(h * 0.07, w * 0.14), 'rgba(235,238,242,0.55)');
  K.rect('#08090b', w * 0.02 + sx(0.3), h * 0.28, w * 0.07, h * 0.05, 0.05, { sh: null, line: false });
  // floor plate
  const bx0 = sx(1) - w * 0.04, bw = w * 1.08;
  if (ext) { // a deeper extension with its two screws
    K.rpoly(zone, [bx0, h - 0.1, bx0 + bw, h - 0.1, bx0 + bw + lean * 0.05, h + w * 0.2, bx0 + lean * 0.05, h + w * 0.2], 0.25, { tint: 'rgba(255,255,255,0.08)' });
    K.screw(bx0 + bw * 0.2, h + w * 0.09, w * 0.035, '#8d949c', true); K.screw(bx0 + bw * 0.8, h + w * 0.09, w * 0.035, '#8d949c', true);
    K.lo([bx0, h + w * 0.035, bx0 + bw, h + w * 0.035], 0.9, 0.4);
  } else K.rpoly(zone, [bx0, h - 0.1, bx0 + bw, h - 0.1, bx0 + bw, h + w * 0.09, bx0, h + w * 0.09], 0.2, { tint: 'rgba(0,0,0,0.2)' });
  if (quick) { // a pull loop and a rubber grip on the base
    const by = h + w * 0.09, cxp = bx0 + bw * 0.5;
    K.rect('rubber', bx0 - w * 0.02, by - w * 0.02, bw + w * 0.04, w * 0.11, 0.3); K.ridges(bx0, by, bw, w * 0.08, w * 0.07, 0.3);
    const loop = [cxp - w * 0.2, by + w * 0.05, cxp - w * 0.32, by + w * 0.3, cxp - w * 0.14, by + w * 0.47, cxp + w * 0.14, by + w * 0.47, cxp + w * 0.32, by + w * 0.3, cxp + w * 0.2, by + w * 0.05];
    K.line('rgba(0,0,0,0.7)', loop, w * 0.12, { curve: true, cap: 'butt' }); K.line('#e0aa2e', loop, w * 0.078, { curve: true, cap: 'butt' });
    K.stitch(loop, 'rgba(90,60,0,0.6)', 0.8, true);
  }
  return { w, h, lean, rr };
}
function paMag(K, id, env) {
  const A = env.A, g = env.g, C = paCAL[g.cal];
  if (A.type === 'rail') { // slug cassette
    K.rpoly('acc', [-0.5, -0.4, 9.5, -0.4, 9.5, 7.4, -0.5, 7.4], 0.7);
    [1.2, 3.2, 5.2].forEach((x) => K.rect('#d6a12a', x, -0.9, 1.3, 0.6, 0.1, { sh: 'cyl' }));
    K.rect('#06080a', 0.6, 0.7, 7.8, 5.2, 0.5, { sh: null, lc: 'rgba(111,227,255,0.45)' });
    K.add((c) => { c.save(); c.beginPath(); c.rect(0.7, 0.8, 7.6, 5.0); c.clip(); });
    [1.7, 3.3, 4.9].forEach((y) => paSlug(K, 1.0, y, 0.52, env));
    K.add((c) => c.restore());
    [1.6, 2.6, 3.6].forEach((x, i) => K.circ(i < 2 ? '#6fe3ff' : '#1d3c46', x, 6.7, 0.26, { sh: null, lc: 'rgba(0,0,0,0.6)' }));
    K.rect('#191b20', 6.2, 6.3, 2.4, 0.8, 0.2); K.screw(9.0, 0.2, 0.2); K.screw(9.0, 6.9, 0.2); K.screw(0, 0.2, 0.2);
    K.frame(-3, -2.6, 12, 9.4);
    return;
  }
  if (g.action === 'single' || !C) { // no magazine at all: a loading tray that holds the one round
    const CC = C || paCAL.c65;
    paRound(K, CC, env.cfg.ammo, 0.4, -0.75, 0.1, env, true);
    K.rpoly('acc', [-0.8, -0.2, 8.6, -0.2, 8.2, 1.6, 6.0, 2.2, 0.2, 2.2, -0.8, 1.2], 0.4);
    K.rpoly('acc', [-0.8, 0.2, -0.8, -1.5, 0.3, -1.5, 0.5, 0.2], [0, 0.3, 0.3, 0], {}); K.rpoly('#9aa2ab', [5.0, 0.1, 5.3, -1.25, 5.9, -1.25, 6.2, 0.1], 0.2);
    K.screw(1.6, 1.1, 0.26, '#8d949c', true); K.screw(6.4, 1.1, 0.26, '#8d949c', true); K.text('1', 4, 1.15, 0.9, 'rgba(235,238,242,0.55)');
    K.frame(-3.4, -3.8, 11, 4.4);
    return;
  }
  const type = A.type;
  let P, R;
  if (type === 'ar') P = A.mag === 'curved' ? { w: 6.2, h: 10, lean: 2.3, pw: 1.6, n: 4, extN: 2, ext: 1.4, ribs: 'h', fol: '#3fa66b' } : { w: 7.4, h: 8.6, lean: 0.6, n: 3, extN: 1, ext: 1.4, ribs: 'h', fol: '#d08a2a' };
  else if (type === 'svd') P = { w: 7.8, h: 8.6, lean: 2.4, pw: 1.4, n: 3, extN: 1, ext: 1.4, ribs: 'h', fol: '#8d949c' };
  else if (type === 'chassis') P = { w: 8.4, h: 8.5, lean: -0.8, pw: 1, n: 3, extN: 1, ext: 1.45, fol: '#d08a2a' };
  else if (A.semi) P = { w: 3.4, h: 7.4, lean: 0.9, pw: 1, n: 6, extN: 3, ext: 1.4, single: true, fol: '#c8322c' };
  else P = { w: 9, h: 4.4, lean: 0, n: 2, extN: 1, ext: 1.6, zone: 'metal', fol: '#9aa2ab', internal: true };
  R = paMagBox(K, id, env, P);
  // beside it, every round it holds, so the capacity can be counted at a glance
  const capOf = (ext) => (ext ? Math.max(g.mag + 1, Math.round(g.mag * 1.6)) : g.mag);
  const sm = (P.w * 0.84) / C.oal, rr = C.rim * sm, pit = rr * 2.16, full = P.h * P.ext, lm = P.lean * 1.5;
  const rowsMax = Math.max(3, Math.floor((full + rr * 1.4) / pit)), colW = C.oal * sm * 1.16;
  const now = capOf(id === 'mg_ext'), cols = Math.ceil(now / rowsMax), rows = Math.ceil(now / cols), colsMax = Math.ceil(capOf(true) / rowsMax);
  const x0 = (P.internal ? 11.6 : P.w + Math.max(0, lm) + P.w * 0.2) + 0.4;
  for (let i = 0; i < now; i++) { const col = Math.floor(i / rows), row = i % rows; paRound(K, C, env.cfg.ammo, x0 + col * colW + (row % 2 ? colW * 0.05 : 0), -rr * 0.2 + row * pit, sm, env, true); }
  if (P.internal) { // the hinged floor plate under a hunting rifle, with its latch
    K.rpoly('metal', [-2.6, R.h - 0.15, 10.8, R.h - 0.15, 10.4, R.h + 0.9, -2.2, R.h + 0.9], 0.3, { tint: 'rgba(255,255,255,0.05)' });
    K.circ('#8d949c', 9.8, R.h + 0.38, 0.34); K.screw(9.8, R.h + 0.38, 0.14, '#30343a');
    K.rpoly('#2a2e34', [-2.0, R.h + 0.3, -0.9, R.h + 0.3, -1.1, R.h + 1.7, -1.9, R.h + 1.7], 0.2); K.hi([-2.0, R.h - 0.02, 10.2, R.h - 0.02], 0.9, 0.2);
    K.frameSize(x0 + colsMax * colW + 3.4, full + 4.6, 0.5);
    return;
  }
  K.frameSize(Math.abs(lm) + x0 + colsMax * colW + 2, full + P.w * 0.62 + R.rr * 2.2, 0.5);
}

// ===========================================================================
// THE PUBLIC FUNCTIONS
// ===========================================================================
const paDRAW = { scope: paScope, muzzle: paMuzzle, barrel: paBarrel, stock: paStock, support: paSupport, ammo: paAmmo, trigger: paTrigger, action: paAction, mag: paMag };

// A detailed 2D side view of one part, centred and fitted inside the box (x, y, w, h) in the
// canvas's current units, on a transparent background. The muzzle end points right.
//   slot: 'scope' | 'muzzle' | 'barrel' | 'stock' | 'support' | 'ammo' | 'trigger' | 'action' | 'mag'
//   id:   a SCOPES id for slot 'scope', otherwise a PARTS id
//   o:    { gunId, cfg, time, dim, fit }
//         gunId, cfg  the rifle the part is (or would be) fitted to. They decide the shape of the
//                     stock, the size of the cartridges, what "factory" means, and the skin colours.
//         time        seconds, for the few things that glow or pulse
//         dim         0..1, greys the picture out for locked items
//         fit         how much of the box to fill (default 0.92)
// Returns { scale } or, for an id it does not know, null with nothing drawn.
function drawPartArt(ctx, slot, id, x, y, w, h, o) {
  o = o || paNO;
  if (!(w > 0) || !(h > 0)) return null;
  const part = PART_BY_ID[id];
  if (part) slot = part.slot; else if (SCOPE_BY_ID[id]) slot = 'scope'; else return null;
  const env = paEnv(o), K = new paKit(env);
  const fn = paDRAW[slot];
  if (!fn) return null;
  fn(K, id, env);
  if (!K.ops.length) return null;
  return paRender(ctx, K, x, y, w, h, o);
}

// ===========================================================================
// THE VIEW THROUGH A SCOPE
// ===========================================================================
// A sensible zoom to show each reticle at: enough to see what its marks are.
function paThumbZoom(sc) {
  const a = sc.zoom[0], b = sc.zoom[1], t = { duplex: 0.25, fine: 0.87 }[sc.ret];
  return a + (b - a) * (t === undefined ? 0.6 : t);
}
// Passes drawing through to the real canvas, but keeps hairlines and dots
// from vanishing when the reticle is drawn much smaller than in the game.
function paThinCtx(ctx, k) {
  const minW = (w) => Math.max(w, (0.62 + 0.11 * Math.min(w, 6)) / k);
  return new Proxy(ctx, {
    get(t, p) {
      if (p === 'fillText') return (s, x, y) => { const m = /([\d.]+)px/.exec(t.font); if (m && +m[1] * k < 4.6) return; t.fillText(s, x, y); };
      if (p === 'arc') return (x, y, r, a0, a1, cc) => t.arc(x, y, r < 5 ? Math.max(r, (0.45 + 0.12 * r) / k) : r, a0, a1, cc);
      const v = t[p];
      return typeof v === 'function' ? v.bind(t) : v;
    },
    set(t, p, v) { t[p] = p === 'lineWidth' ? minW(v) : v; return true; },
  });
}
// The same marks as View.drawReticle, kept here as a fallback in case the real
// one cannot be called. (The real one is used whenever it works.)
function paReticleOwn(ctx, sc, R, ppm, marks) {
  const cx = 0, cy = 0, type = sc.ret, nvc = sc.nv;
  const col = nvc ? 'rgba(10,30,14,0.95)' : 'rgba(6,7,9,0.94)';
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = 'butt';
  const L = (x1, y1, x2, y2, w) => { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(cx + x1, cy + y1); ctx.lineTo(cx + x2, cy + y2); ctx.stroke(); };
  const thin = clamp(ppm * 0.035, 0.9, 1.6);
  const font = (px) => { ctx.font = '600 ' + px + 'px ' + paFONT; };
  if (type === 'duplex') {
    const gapR = R * 0.2;
    L(-R, 0, -gapR, 0, 4); L(gapR, 0, R, 0, 4); L(0, gapR, 0, R, 4); L(0, -R, 0, -gapR, 4);
    L(-gapR, 0, -3, 0, 1.1); L(3, 0, gapR, 0, 1.1); L(0, 3, 0, gapR, 1.1); L(0, -gapR, 0, -3, 1.1);
    ctx.beginPath(); ctx.arc(cx, cy, 1, 0, TAU); ctx.fill();
  } else if (type === 'post') {
    L(-R, 0, -R * 0.16, 0, 5.5); L(R * 0.16, 0, R, 0, 5.5);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 5, cy + 16); ctx.lineTo(cx + 5, cy + R); ctx.lineTo(cx - 5, cy + R); ctx.lineTo(cx - 5, cy + 16); ctx.closePath(); ctx.fill();
  } else if (type === 'pso') {
    const chev = (y, sz, w) => { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(cx - sz, cy + y + sz); ctx.lineTo(cx, cy + y); ctx.lineTo(cx + sz, cy + y + sz); ctx.stroke(); };
    chev(0, Math.max(5, ppm * 0.7), 1.5);
    font(clamp(ppm * 0.9, 8, 12)); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    marks.forEach((m) => { const y = m.mil * ppm; if (y > R * 0.93) return; chev(y, Math.max(3.5, ppm * 0.45), 1.2); if (ppm > 7) ctx.fillText(m.label, cx + Math.max(8, ppm * 1.1), cy + y + 3); });
    for (let i = 1; i <= 10; i++) { const x = i * ppm; if (x > R * 0.9) break; const h = i % 5 === 0 ? 6 : 3.5; L(x, -h, x, h, 1.1); L(-x, -h, -x, h, 1.1); }
    const bx = -10 * ppm, byy = 9 * ppm;
    if (Math.hypot(bx * 0.6, byy) < R * 0.95) {
      L(-10.4 * ppm, byy, -1.6 * ppm, byy, 1.1);
      ctx.lineWidth = 1.1; ctx.beginPath();
      for (let r = 200; r <= 1000; r += 25) { const x = cx + (-10 + (r - 200) / 100) * ppm, y = cy + byy - (1800 / r) * ppm; if (r === 200) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
      if (ppm > 6) { ctx.textAlign = 'center'; ctx.textBaseline = 'top'; for (let r = 200; r <= 1000; r += 200) ctx.fillText(String(r / 100), cx + (-10 + (r - 200) / 100) * ppm, cy + byy + 3); }
    }
  } else {
    const maxMil = R / ppm;
    L(-R, 0, -4, 0, thin); L(4, 0, R, 0, thin); L(0, 4, 0, R, thin); L(0, -R, 0, -4, thin);
    ctx.beginPath(); ctx.arc(cx, cy, 1.1, 0, TAU); ctx.fill();
    if (type === 'mildot') {
      const dr = clamp(ppm * 0.11, 1.4, 4);
      for (let i = 1; i <= 12; i++) { const d = i * ppm; if (d > R * 0.95) break;
        if (i <= 5) { ctx.beginPath(); ctx.arc(cx + d, cy, dr, 0, TAU); ctx.moveTo(cx - d + dr, cy); ctx.arc(cx - d, cy, dr, 0, TAU); ctx.moveTo(cx + dr, cy - d); ctx.arc(cx, cy - d, dr, 0, TAU); ctx.fill(); }
        ctx.beginPath(); ctx.arc(cx, cy + d, dr, 0, TAU); ctx.fill();
        if (ppm > 11) L(-3, d - ppm / 2, 3, d - ppm / 2, 1);
        if (i % 5 === 0 && ppm > 6) { font(clamp(ppm * 0.8, 8, 12)); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(String(i), cx + 8, cy + d); }
      }
      const post = Math.max(6, Math.min(maxMil, 6)) * ppm;
      if (post < R) { L(-R, 0, -post, 0, 3.5); L(post, 0, R, 0, 3.5); L(0, -R, 0, -post, 3.5); }
    } else if (type === 'bdc') {
      font(clamp(ppm * 0.9, 9, 13)); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      marks.forEach((m) => { const y = m.mil * ppm; if (y > R * 0.93) return; const w = clamp(ppm * 1.2, 7, 22) * (m.r % 200 === 0 || m.r < 200 ? 1 : 0.65); L(-w, y, w, y, 1.4); ctx.beginPath(); ctx.arc(cx, cy + y, 1.6, 0, TAU); ctx.fill(); if (ppm > 5) ctx.fillText(m.label, cx + w + 5, cy + y + 0.5); });
      for (let i = 1; i <= 8; i++) { const x = i * ppm; if (x > R * 0.9) break; L(x, -3.5, x, 3.5, 1); L(-x, -3.5, -x, 3.5, 1); }
      L(-R, 0, -R * 0.55, 0, 3.5); L(R * 0.55, 0, R, 0, 3.5); L(0, -R, 0, -R * 0.55, 3.5);
    } else {
      const step = type === 'fine' && ppm > 28 ? 0.2 : ppm > 9 ? 0.5 : 1;
      const numEvery = ppm > 24 ? 1 : 2;
      font(clamp(ppm * 0.55, 8, 12));
      const lim = Math.min(maxMil * 0.95, 24);
      for (let m = step; m <= lim + 1e-6; m += step) {
        const d = m * ppm, whole = Math.abs(m - Math.round(m)) < 1e-6, half = Math.abs(m * 2 - Math.round(m * 2)) < 1e-6;
        const h = whole ? clamp(ppm * 0.3, 3, 9) : half ? clamp(ppm * 0.17, 2, 5) : clamp(ppm * 0.09, 1.5, 3);
        L(-h, d, h, d, thin);
        if (m <= Math.min(lim, 12)) { L(d, -h, d, h, thin); L(-d, -h, -d, h, thin); }
        if (m <= Math.min(lim, 6)) L(-h, -d, h, -d, thin);
        if (whole && Math.round(m) % numEvery === 0 && ppm > 9) { ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(String(Math.round(m)), cx - h - 4, cy + d + 0.5); if (m <= 12 && Math.round(m) % 2 === 0) { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(String(Math.round(m)), cx + d, cy - h - 2); ctx.fillText(String(Math.round(m)), cx - d, cy - h - 2); } }
      }
      if (type === 'tree' && ppm > 8.5) {
        const dr = clamp(ppm * 0.07, 1.1, 2.4), rstep = ppm < 15 ? 2 : 1;
        for (let r = rstep; r <= lim; r += rstep) { const wmax = Math.min(1 + Math.floor(r * 0.6), 8); for (let c = 1; c <= wmax; c++) { ctx.beginPath(); ctx.arc(cx + c * ppm, cy + r * ppm, dr, 0, TAU); ctx.arc(cx - c * ppm, cy + r * ppm, dr, 0, TAU); ctx.fill(); if (ppm > 16 && c <= wmax) { ctx.beginPath(); ctx.arc(cx + (c - 0.5) * ppm, cy + r * ppm, dr * 0.7, 0, TAU); ctx.arc(cx - (c - 0.5) * ppm, cy + r * ppm, dr * 0.7, 0, TAU); ctx.fill(); } } }
      }
    }
  }
}
// the quiet scene behind the reticle: sky, far hills, a field and one standing figure for scale.
// The figure is 1.8 m tall at the sample distance and stands where the bullet would land (fx, fy).
function paThumbScene(ctx, R, ppm, nv, dist, fx, fy) {
  const h = (1800 / dist) * ppm, top = fy - h * 0.3, feet = top + h, hz = clamp(feet - h * 0.42, -R * 0.2, R * 0.35);
  let g = ctx.createLinearGradient(0, -R, 0, hz);
  if (nv) { g.addColorStop(0, '#39424c'); g.addColorStop(1, '#5b6772'); } else { g.addColorStop(0, '#b9cfe0'); g.addColorStop(0.7, '#dfe8ec'); g.addColorStop(1, '#eef0ea'); }
  ctx.fillStyle = g; ctx.fillRect(-R, -R, R * 2, R + hz + 1);
  if (nv) { ctx.fillStyle = '#e8eef2'; [[-0.5, -0.62, 1.6], [0.3, -0.75, 1.2], [0.62, -0.4, 1.4], [-0.2, -0.45, 1], [-0.72, -0.3, 1.1], [0.1, -0.3, 0.9]].forEach((q) => { ctx.beginPath(); ctx.arc(q[0] * R, q[1] * R, q[2] * Math.max(1, R * 0.006), 0, TAU); ctx.fill(); }); }
  ctx.fillStyle = nv ? '#4a565c' : '#aebdc0'; ctx.beginPath(); ctx.moveTo(-R, hz);
  for (let x = -R; x <= R; x += R / 16) ctx.lineTo(x, hz - R * 0.05 - (Math.sin(x * 0.011 + 1) * 0.5 + 0.5) * R * 0.1 - (Math.sin(x * 0.031) * 0.5 + 0.5) * R * 0.035);
  ctx.lineTo(R, hz); ctx.closePath(); ctx.fill();
  ctx.fillStyle = nv ? '#3d484a' : '#93a79a'; ctx.beginPath(); ctx.moveTo(-R, hz);
  for (let x = -R; x <= R; x += R / 20) ctx.lineTo(x, hz - R * 0.012 - (Math.sin(x * 0.023 + 4) * 0.5 + 0.5) * R * 0.045);
  ctx.lineTo(R, hz); ctx.closePath(); ctx.fill();
  g = ctx.createLinearGradient(0, hz, 0, R);
  if (nv) { g.addColorStop(0, '#a3ad9f'); g.addColorStop(0.5, '#88938a'); g.addColorStop(1, '#6a756e'); } else { g.addColorStop(0, '#a7b392'); g.addColorStop(0.5, '#8f9d7c'); g.addColorStop(1, '#75836a'); }
  ctx.fillStyle = g; ctx.fillRect(-R, hz, R * 2, R - hz + 1);
  const fc = nv ? '#f2f7f2' : '#262a31', lw = Math.max(1.2, h * 0.07), hr = h * 0.075;
  ctx.fillStyle = nv ? 'rgba(0,0,0,0.3)' : 'rgba(40,50,40,0.25)'; ctx.beginPath(); ctx.ellipse(fx, feet, h * 0.2, h * 0.025, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = fc; ctx.fillStyle = fc; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.arc(fx, top + hr, hr, 0, TAU); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(fx, top + hr * 2); ctx.lineTo(fx, feet - h * 0.46);
  ctx.moveTo(fx, feet - h * 0.46); ctx.lineTo(fx - h * 0.085, feet); ctx.moveTo(fx, feet - h * 0.46); ctx.lineTo(fx + h * 0.085, feet);
  ctx.moveTo(fx, top + h * 0.2); ctx.lineTo(fx - h * 0.1, top + h * 0.47); ctx.moveTo(fx, top + h * 0.2); ctx.lineTo(fx + h * 0.1, top + h * 0.47);
  ctx.stroke(); ctx.lineCap = 'butt';
}

// The view through a scope: its real reticle over a quiet scene, in a round glass with a dark rim.
// Everything stays inside radius r: the glass itself is the inner 90 percent, the rim is the rest.
//   o: { zoom, time, gunId, cfg, dist }   zoom defaults to one that shows the marks well
function drawReticleThumb(ctx, scopeId, cx, cy, r, o) {
  o = o || paNO;
  if (!(r > 0)) return;
  const sc = SCOPE_BY_ID[scopeId] || SCOPES[0];
  const gunId = GUN_BY_ID[o.gunId] ? o.gunId : 'fenwick';
  const zoom = clamp(o.zoom || paThumbZoom(sc), sc.zoom[0], sc.zoom[1]), t = o.time || 0;
  const rg = r * 0.9, Rr = 190, k = rg / Rr, ppm = (Rr * 2) / (FOV_AT_1X / zoom);
  const st = buildStats(gunId, Object.assign({}, o.cfg || paNO, { scope: sc.id }));
  st.scope = sc; // show this scope's glass even on a rifle that cannot mount it
  let dist = o.dist || (st.eff < 350 ? 125 : 300);
  if (!o.dist) { // at high zoom, stand the figure further off so it still fits in the glass
    const need = (1800 * ppm) / (0.56 * Rr), far = Math.max(dist, Math.floor((st.eff * 0.95) / 50) * 50);
    if (need > dist) dist = Math.min(far, Math.ceil(need / 100) * 100);
  }
  // where the bullet lands at that distance. With a zero dial you dial the distance and aim dead on;
  // without one the target sits below the crosshair at the right mark. The smart scope also reads wind.
  const dp = Bal.dope(st, st.zeroAng, dist, sc.smart ? 4 : 0);
  const dial = sc.turret && !sc.smart, ok = dp.reached && Math.abs(dp.dropMil) < 60;
  const fx = ok ? dp.driftMil * ppm : 0, fy = ok && !dial ? clamp(dp.dropMil * ppm, -Rr * 0.5, Rr * 0.6) : 0;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, rg, 0, TAU); ctx.clip();
  ctx.translate(cx, cy); ctx.scale(k, k);
  paThumbScene(ctx, Rr + 2, ppm, sc.nv, dist, fx, fy);
  if (sc.nv) { // green daylight with a little grain, as the tube shows it
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#5dff86'; ctx.fillRect(-Rr - 2, -Rr - 2, Rr * 2 + 4, Rr * 2 + 4);
    ctx.globalCompositeOperation = 'source-over';
    const sl = Math.max(3, 1.6 / k); ctx.fillStyle = 'rgba(0,0,0,0.13)';
    for (let y = -Rr + ((t * 40) % sl); y < Rr; y += sl) ctx.fillRect(-Rr, y, Rr * 2, sl / 3);
    const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, Rr); gl.addColorStop(0, 'rgba(190,255,200,0.16)'); gl.addColorStop(1, 'rgba(190,255,200,0)'); ctx.fillStyle = gl; ctx.fillRect(-Rr, -Rr, Rr * 2, Rr * 2);
  }
  // soft dark edge and the thin colour fringe of real glass
  const vg = ctx.createRadialGradient(0, 0, Rr * 0.62, 0, 0, Rr);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(0.82, 'rgba(0,0,0,0.28)'); vg.addColorStop(1, 'rgba(0,0,0,0.92)');
  ctx.fillStyle = vg; ctx.fillRect(-Rr - 2, -Rr - 2, Rr * 2 + 4, Rr * 2 + 4);
  ctx.strokeStyle = 'rgba(90,150,255,0.16)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, Rr - 4, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,170,90,0.10)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, Rr - 8, 0, TAU); ctx.stroke();
  // the reticle: the game's own drawing code, scaled down
  const pc = paThinCtx(ctx, k);
  let done = false;
  if (!o.own && typeof View === 'function' && View.prototype.drawReticle) {
    ctx.save();
    try {
      const V = { ctx: pc, R: Rr, rangeInfo: null, hold: null, holdT: 0, assist: 'notes', hitMark: 0, pulse: 0, rt: t, mode: 'thumb', bdcCache: null, bdcMarks: View.prototype.bdcMarks };
      View.prototype.drawReticle.call(V, { st, sh: { zeroR: st.zero, zeroAng: st.zeroAng, zoom }, t }, 0, 0, ppm);
      done = true;
    } catch (e) { done = false; }
    ctx.restore();
  }
  if (!done) {
    const marks = [], ranges = st.eff <= 320 ? [75, 100, 125, 150, 175, 200, 250, 300] : [200, 300, 400, 500, 600, 700, 800, 900, 1000];
    ranges.forEach((rr) => { if (rr <= st.zero + 5 || rr > st.eff * 1.15) return; const d = Bal.dope(st, st.zeroAng, rr, 0); if (d.reached && d.dropMil > 0.15 && d.dropMil < 60) marks.push({ r: rr, mil: d.dropMil, label: rr % 100 === 0 ? String(rr / 100) : String(rr) }); });
    ctx.save(); paReticleOwn(pc, sc, Rr, ppm, marks); ctx.restore();
  }
  ctx.restore();
  // electronics, drawn at a size that stays readable in a small glass
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, rg, 0, TAU); ctx.clip();
  const lit = sc.nv ? 'rgba(220,255,225,0.97)' : 'rgba(255,170,60,0.98)';
  if (sc.smart && ok) { // the amber diamond sits where the bullet will land
    const px = cx + fx * k, py = cy + fy * k, dr = Math.max(6 * k, 2.3);
    ctx.strokeStyle = 'rgba(20,14,6,0.55)'; ctx.lineWidth = Math.max(1.6 * k, 0.9) + 1.2; ctx.lineJoin = 'miter';
    ctx.beginPath(); ctx.moveTo(px, py - dr); ctx.lineTo(px + dr, py); ctx.lineTo(px, py + dr); ctx.lineTo(px - dr, py); ctx.closePath(); ctx.stroke();
    ctx.strokeStyle = lit; ctx.lineWidth = Math.max(1.6 * k, 0.9); ctx.stroke();
    ctx.fillStyle = lit; ctx.beginPath(); ctx.arc(px, py, Math.max(1.3 * k, 0.6), 0, TAU); ctx.fill();
  }
  if (sc.lrf || sc.smart) { // sample range read-out
    const fs = clamp(rg * 0.15, 6.5, 15), ty = cy - rg * 0.64, txt = Math.round(dist) + ' m';
    ctx.font = '700 ' + fs.toFixed(1) + 'px ' + paFONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(20,14,6,0.34)'; ctx.lineWidth = Math.max(1.2, fs * 0.14); ctx.strokeText(txt, cx, ty);
    ctx.fillStyle = lit; ctx.fillText(txt, cx, ty);
  }
  ctx.restore();
  // glass shine
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, rg, 0, TAU); ctx.clip();
  let g = ctx.createLinearGradient(cx - rg, cy - rg, cx + rg * 0.2, cy + rg * 0.3);
  g.addColorStop(0, 'rgba(255,255,255,0.20)'); g.addColorStop(0.45, 'rgba(255,255,255,0.03)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rg, Math.PI * 0.95, Math.PI * 1.75); ctx.arc(cx + rg * 0.34, cy + rg * 0.42, rg * 1.12, Math.PI * 1.52, Math.PI * 1.12, true); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = Math.max(0.8, rg * 0.018); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy, rg * 0.9, Math.PI * 1.12, Math.PI * 1.36); ctx.stroke();
  ctx.restore();
  // dark rim
  const rw = r - rg, rm = (r + rg) / 2;
  ctx.save();
  g = ctx.createRadialGradient(cx, cy, rg - rw * 0.3, cx, cy, r);
  g.addColorStop(0, '#000'); g.addColorStop(0.3, '#06070a'); g.addColorStop(0.55, '#2a3038'); g.addColorStop(0.8, '#101317'); g.addColorStop(1, '#050608');
  ctx.strokeStyle = g; ctx.lineWidth = rw + 0.6; ctx.beginPath(); ctx.arc(cx, cy, rm, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(150,165,180,0.5)'; ctx.lineWidth = Math.max(0.7, rw * 0.14); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy, rm + rw * 0.08, Math.PI * 1.08, Math.PI * 1.7); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = Math.max(0.6, rw * 0.1); ctx.beginPath(); ctx.arc(cx, cy, r - ctx.lineWidth / 2, 0, TAU); ctx.stroke();
  ctx.restore();
}

CB.drawPartArt = drawPartArt; CB.drawReticleThumb = drawReticleThumb; CB.drawGlass = drawReticleThumb;
