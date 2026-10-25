// ---------------------------------------------------------------------------
// What the scope tells you about your own shots and about being seen, drawn
// over the picture after the scene (never inside it):
// - the callout under the crosshair for a round the kill camera did not follow:
//   "HEADSHOT 412 m", "MISS 0.6 mil high, 0.3 left", "STOPPED BY BODY ARMOUR";
// - the moment somebody gives the game away, a red ring on them (or an arrow
//   at the edge of the picture pointing to them) with what they noticed.
// Display only: none of this changes the mission.
// ---------------------------------------------------------------------------
const CALL_OBJ = { lamp: 'LAMP OUT', bulb: 'LIGHT OUT', hook: 'HOOK SNAPPED', rope: 'ROPE CUT', barrel: 'DRUM HIT', tank: 'TANK HIT', fuse: 'FUSE BOX OUT', bell: 'BELL RUNG', horn: 'HORN', bottle: 'BOTTLE BROKEN', can: 'CAN HIT', pot: 'POT BROKEN', cctv: 'CAMERA OUT', valve: 'VALVE OPEN', radio: 'RADIO OUT', dish: 'DISH OUT', lock: 'LOCK SHOT OFF', flare: 'FLARE LIT', glint: 'SCOPE BROKEN', armour: 'GLASS HELD' };

// Show the callout for every round that has come to rest since the last frame.
Game.watchRounds = function () {
  const G = Game, sim = G.sim; if (!sim) return;
  for (let i = sim.bullets.length - 1; i >= 0; i--) {
    const b = sim.bullets[i];
    if (b.alive || b._told) continue;
    b._told = true;
    if (b.cine || sim.t - b.endT > 0.5) continue; // the kill camera showed this one (or it is old news)
    const c = G.roundOutcome(sim, b);
    if (c) G.callout(c.head, c.sub, c.kind);
  }
};
// What one round did, in a few words.
Game.roundOutcome = function (sim, b) {
  const hits = b.hits || [];
  const fmtD = (d) => Math.round(d) + ' m';
  if (hits.length) {
    const lethal = hits.filter((h) => h.lethal), first = lethal[0] || hits[0];
    if (lethal.length >= 2) return { head: lethal.length === 2 ? 'TWO WITH ONE ROUND' : lethal.length + ' WITH ONE ROUND', sub: fmtD(first.d), kind: 'c-hit' };
    if (!first.lethal) return { head: 'HIT, NOT DOWN', sub: 'a ' + (first.part === 'leg' ? 'leg' : 'arm') + ': they felt that', kind: 'c-bad' };
    const bad = first.role === 'civ' || first.role === 'vip' || first.role === 'hostage';
    return { head: bad ? 'WRONG PERSON' : first.part === 'head' ? 'HEADSHOT' : 'HIT', sub: fmtD(first.d), kind: bad ? 'bad' : 'hit' };
  }
  if (b.vest) return { head: 'STOPPED BY BODY ARMOUR', sub: 'the vest took it', kind: 'c-bad' };
  if (b.obj && b.obj.kind !== 'duck') return { head: CALL_OBJ[b.obj.kind] || 'HIT', sub: fmtD(b.obj.plane.z - b.oz), kind: 'c-obj' };
  if (b.obj) return null; // the duck has its own banner
  return Game.missBy(sim, b);
};
// Where a round that hit nobody went, against the person (or thing) it passed closest to, in the
// player's own terms: mils high or low, left or right, at that person's distance.
Game.missBy = function (sim, b) {
  const tr = b.trail; if (!tr || tr.length < 2) return { head: 'MISS', sub: '', kind: 'c-miss' };
  const at = (z) => { // where the round was at depth z (straight on past its end, if it stopped short)
    for (let i = 1; i < tr.length; i++) if (tr[i][2] >= z) { const p = tr[i - 1], q = tr[i], f = clamp((z - p[2]) / Math.max(1e-6, q[2] - p[2]), 0, 1); return { x: lerp(p[0], q[0], f), y: lerp(p[1], q[1], f), short: false }; }
    const p = tr[Math.max(0, tr.length - 2)], q = tr[tr.length - 1], f = (z - q[2]) / Math.max(1e-6, q[2] - p[2]);
    return { x: q[0] + (q[0] - p[0]) * f, y: q[1] + (q[1] - p[1]) * f, short: true };
  };
  let best = null;
  const consider = (x, y, z, isPerson, label) => {
    const p = at(z), d = Math.hypot(p.x - x, p.y - y);
    if (d < (isPerson ? 3 : 1.5) && (!best || d - (isPerson ? 0.4 : 0) < best.score)) best = { x, y, z, p, d, score: d - (isPerson ? 0.4 : 0), label };
  };
  sim.actors.forEach((a) => {
    if (a.gone || a.hidden || (a.dead && sim.t - a.deathAtT > 1.5) || !a.plane) return;
    const h = sim.partPoint(a, 'head'), t = sim.partPoint(a, 'torso'), p = at(t.z);
    const near = Math.hypot(p.x - h.x, p.y - h.y) < Math.hypot(p.x - t.x, p.y - t.y) ? h : t;
    consider(near.x, near.y, near.z, true);
  });
  sim.S.objects.forEach((o) => { if (o.alive !== false && o.plane && o.r > 0 && o.kind !== 'duck' && CALL_OBJ[o.kind]) consider(o.x, o.y, o.plane.z, false); });
  if (!best) return { head: 'MISS', sub: 'nowhere near anyone', kind: 'c-miss' };
  const e = { x: b.ox, y: b.oy, z: b.oz }, d = best.z - e.z;
  if (best.p.short && tr[tr.length - 1][2] < best.z - 1) return { head: 'BLOCKED', sub: 'something stopped it short of ' + (best.label || 'them') + ' at ' + Math.round(tr[tr.length - 1][2] - b.oz) + ' m', kind: 'c-miss' };
  const up = ((best.p.y - best.y) / d) * 1000, rt = ((best.p.x - best.x) / d) * 1000;
  const parts = [];
  if (Math.abs(up) >= 0.1) parts.push(fmt(Math.abs(up), 1) + ' mil ' + (up > 0 ? 'high' : 'low'));
  if (Math.abs(rt) >= 0.1) parts.push(fmt(Math.abs(rt), 1) + ' ' + (parts.length ? '' : 'mil ') + (rt > 0 ? 'right' : 'left'));
  return { head: 'MISS', sub: parts.length ? parts.join(', ') : 'a hair off', kind: 'c-miss' };
};
Game.callout = function (head, sub, kind) {
  const c = Game.hud.call;
  c.className = 'h-call ' + (kind || '') ; void c.offsetWidth; c.className = 'h-call show ' + (kind || '');
  c.firstChild.textContent = head; c.lastChild.textContent = sub || '';
  c.lastChild.style.display = sub ? '' : 'none';
  clearTimeout(c._t); c._t = setTimeout(() => { c.classList.remove('show'); }, kind === 'c-miss' ? 2600 : 2000);
};

// ---- being seen ------------------------------------------------------------------------------
// The first person who gives the game away is ringed in red for a few seconds, with what they
// noticed. Off the picture, an arrow at the edge points to them. (sim.seenBy has the rest.)
Game.seenFx = null;
Game.noteGiveaway = function (sim) {
  const s = sim.seenBy; if (!s) return;
  const a = s.id ? sim.byId[s.id] : null;
  Game.seenFx = { a, at: s.where, what: s.what, until: Game.view.rt + 3.4, t0: Game.view.rt };
};
Game.drawSeen = function (V) {
  const F = Game.seenFx, sim = Game.sim; if (!F || !sim) return;
  if (V.rt > F.until) { Game.seenFx = null; return; }
  const ctx = V.ctx, a = F.a, u = (V.rt - F.t0);
  let x, y, z;
  if (a && !a.gone && a.plane) { x = a.x; y = a.y + 1.0; z = a.plane.z; } else if (F.at) { x = F.at.x; y = F.at.y + 1; z = F.at.z; } else return;
  const p = V.project(sim, x, y, z), s = Math.max(14, p[2] * 1.15);
  const fade = clamp((F.until - V.rt) / 0.6, 0, 1);
  ctx.save(); ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  ctx.globalAlpha = fade;
  const col = '#ff4a3d';
  const sf0 = Game.safe || { l: 0, r: 0 };
  const inside = V.round ? Math.hypot(p[0] - V.cx, p[1] - V.cy) < V.R - 24 : p[0] > sf0.l + 120 && p[0] < V.W - sf0.r - 160 && p[1] > 60 && p[1] < V.H - 70;
  if (inside) {
    const r = s + 6 + Math.sin(u * 9) * 3;
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.stroke();
    ctx.lineWidth = 2.6; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.stroke();
    Game.label(ctx, 'SEEN: ' + F.what.toUpperCase(), p[0], p[1] - r - 12, col, 12);
  } else {
    // an arrow on the edge of the clear part of the picture (not under the zoom slider or the
    // buttons), on the line from the middle to them
    const cx = V.cx, cy = V.cy, dx = p[0] - cx, dy = p[1] - cy, ang = Math.atan2(dy, dx), sf = Game.safe || { l: 0, r: 0 };
    const ex = V.round ? V.R - 34 : (dx < 0 ? cx - (sf.l + 150) : V.W - sf.r - 190 - cx), ey = V.round ? V.R - 34 : (dy < 0 ? cy - 80 : V.H - 110 - cy);
    const k = Math.min(Math.abs(ex / (dx || 1e-6)), Math.abs(ey / (dy || 1e-6)));
    const ax = cx + dx * k, ay = cy + dy * k;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-9, -13); ctx.lineTo(-3, 0); ctx.lineTo(-9, 13); ctx.closePath();
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke(); ctx.fillStyle = col; ctx.fill();
    ctx.restore();
    Game.label(ctx, 'SEEN', ax - Math.cos(ang) * 34, ay - Math.sin(ang) * 26, col, 12);
  }
  ctx.restore();
};
// Lettering over the picture: dark edge, bright fill, readable on snow and on night water.
Game.label = function (ctx, s, x, y, col, size) {
  ctx.font = '800 ' + size + 'px "Avenir Next Condensed", "Roboto Condensed", "Arial Narrow", Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(s).width;
  ctx.fillStyle = 'rgba(8,10,14,0.82)'; ctx.fillRect(x - w / 2 - 6, y - size * 0.75, w + 12, size * 1.5);
  ctx.fillStyle = col; ctx.fillText(s, x, y + 0.5);
};
