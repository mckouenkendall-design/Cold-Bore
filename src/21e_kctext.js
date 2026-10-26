// ---------------------------------------------------------------------------
// The kill camera's words (the film itself is src/21_killcam.js), sized to be read on a phone:
//   during the flight, the shot's numbers along the bottom: "412 m · 0.58 s · drop 2.9 mil ·
//     wind 4 L" (the distance counts up as the round flies; wind L is blowing from the left)
//   at the main thing the round hits, a label on a line to it: "HEART: LETHAL"; "LODGED" where a
//     round that stays in the body comes to rest
//   as the body falls, a stamp for what the shot was: HEADSHOT, HEART SHOT, SPINE SHOT, LONGEST
//     (further than any kill before it), THROUGH GLASS, THROUGH COVER, MOVING TARGET, TWO WITH ONE
// The parts are joined with a middle dot, never a long dash.
// ---------------------------------------------------------------------------
const kcFont = '"Avenir Next Condensed","DIN Condensed","Roboto Condensed","Arial Narrow",sans-serif';
const kcCapText = {
  heart: ['HEART', 'LETHAL'], brain: ['BRAIN', 'LETHAL'], spine: ['SPINE', 'SEVERED'], spineC: ['SPINE', 'SEVERED'], lungL: ['LUNG', 'COLLAPSED'], lungR: ['LUNG', 'COLLAPSED'],
  liver: ['LIVER', 'RUPTURED'], stomach: ['STOMACH', 'TORN'], kidL: ['KIDNEY', 'RUPTURED'], kidR: ['KIDNEY', 'RUPTURED'], gut: ['GUT', 'TORN'], skullIn: ['SKULL', 'FRACTURED'],
  jawIn: ['JAW', 'SHATTERED'], ribIn: ['RIBS', 'BROKEN'], shIn: ['COLLARBONE', 'BROKEN'], pelvIn: ['PELVIS', 'FRACTURED'], lodged: ['LODGED', ''],
};
// The shot's numbers and the stamps it has earned, worked out once as the film starts.
function kcTextInit(K, o) {
  const h = o.hit, p = K.path, p0 = p[0], sim = o.sim;
  const range = h.range > 0 ? h.range : Math.hypot(h.x - p0[1], h.y - p0[2], h.z - p0[3]);
  const tof = Math.max(0, o.tHit - p0[0]);
  // drop: how far below the line it left on the round arrived (in mils at the target's distance)
  let drop = (0.5 * 9.81 * tof * tof) / Math.max(1, range) * 1000;
  for (let i = 1; i < p.length; i++) {
    const q = p[i], dz = q[3] - p0[3]; if (dz < 4) continue;
    const ky = (q[2] - p0[2]) / dz, yLine = p0[2] + ky * (h.z - p0[3]);
    if (i < p.length - 1 && dz < 12) continue; // a sample a few metres out gives the line it left on
    drop = ((yLine - h.y) / Math.max(1, range)) * 1000; break;
  }
  let w = 0; try { w = sim.wind(); } catch (e) { w = 0; }
  const aw = Math.abs(w), ws = aw < 0.3 ? 'wind 0' : 'wind ' + (aw < 3 ? aw.toFixed(1) : Math.round(aw)) + (w > 0 ? ' L' : ' R');
  K.stats = { range, tof, drop, ws };
  // the stamps, most important first
  const st = [], pl = K.part, key = '';
  if (pl === 'head') st.push('HEADSHOT');
  // a new record: further than the player's longest kill so far (in the save, or earlier in this
  // mission). The very first kill of all beats nothing, so it is not called one.
  let longest = 0; try { longest = Math.max((Save.data && Save.data.stats && Save.data.stats.longest) || 0, (sim.stats && sim.stats.longest) || 0); } catch (e) { longest = 0; }
  if (range > 60 && longest > 0 && range > longest + 1) st.push('LONGEST');
  const cv = K.covers || [];
  if (cv.some((c) => c.mat === 'glass')) st.push('THROUGH GLASS'); else if (cv.length) st.push('THROUGH COVER');
  const a = o.actor; if (a && (a.anim === 'walk' || a.anim === 'run' || a.anim === 'panic' || (a.inVeh && Math.abs(a.inVeh.v || 0) > 0.5))) st.push('MOVING TARGET');
  if (o.kills && o.kills.length > 1) st.push('TWO WITH ONE');
  K.stamps = st; K.stampT0 = undefined; void key;
}
// Letters set a little apart (by the canvas itself where it can); returns the width.
function kcSpaced(ctx, text, x, y, gap, draw) {
  const ls = 'letterSpacing' in ctx;
  if (ls) ctx.letterSpacing = gap + 'px';
  const w = ctx.measureText(text).width - (ls ? gap : 0);
  if (draw) ctx.fillText(text, x, y);
  if (ls) ctx.letterSpacing = '0px';
  return w;
}
// During the flight: the shot's numbers along the bottom of the picture.
function kcStatsDraw(ctx, K, V) {
  const s = K.stats; if (!s || K.take || K.short || K.T < K.Ta - 0.1) return;
  const a = smooth((K.T - K.Ta + 0.1) / 0.3) * (1 - smooth((K.T - K.Tb - 0.25) / 0.35)); if (a < 0.01) return;
  const W = V.W, H = V.H, G = CB.Game || {}, sf = G.safe || {}, fs = W < 500 ? 14 : W < 700 ? 15 : 17, lb = kcBars(W, H);
  const u = clamp(K.fu || 0, 0, 1), dist = Math.round(s.range * (K.stage >= 2 ? 1 : smooth(u * 1.15)));
  const parts = [dist + ' m', s.tof.toFixed(2) + ' s', 'drop ' + s.drop.toFixed(1) + ' mil', s.ws];
  ctx.font = '700 ' + fs + 'px ' + kcFont; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const x0 = 16 + (sf.l || 0), y0 = H - lb - 12, gap = fs * 0.7;
  // measure, then a soft dark band behind for any sky
  let tw = 0; const ws = parts.map((p) => { const w = kcSpaced(ctx, p, 0, 0, 0.8, false); tw += w; return w; }); tw += gap * 2 * (parts.length - 1);
  ctx.globalAlpha = a * 0.45; ctx.fillStyle = '#000'; ctx.fillRect(x0 - 8, y0 - fs - 7, tw + 16, fs + 14);
  ctx.globalAlpha = a; ctx.fillStyle = '#ffb84d'; ctx.fillRect(x0 - 8, y0 - fs - 7, 3, fs + 14);
  let x = x0;
  for (let i = 0; i < parts.length; i++) {
    ctx.fillStyle = i === 0 ? '#ffffff' : '#d7dee6'; kcSpaced(ctx, parts[i], x, y0, 0.8, true); x += ws[i];
    if (i < parts.length - 1) { ctx.fillStyle = '#ffb84d'; ctx.fillText('·', x + gap - ctx.measureText('·').width / 2, y0); x += gap * 2; }
  }
  ctx.globalAlpha = 1;
}
// A label on the main thing the round broke (or where it came to rest), on a line to it.
function kcCaption(ctx, K, c, V) {
  const cp = K.cap; if (!cp || !K.fig || K.short === 2) return;
  const pl = K.plan, age = K.T - cp.t0 - 0.08, life = cp.ref === 'lodged' ? 1.6 : 1.5; if (age < 0 || age > life) return;
  const tx = kcCapText[cp.ref] || [cp.text || '', ''], fr = pl.part === 'head' ? K.fig.hd : K.fig.tor;
  kcTrack(K, cp.s, kcL0);
  if (!kcProj(c, kcL0[0], kcL0[1], kcL0[2], kcQ)) return;
  // (gone by the time the X-ray has faded back into the real scene for the fall)
  const W = V.W, H = V.H, a = smooth(age / 0.12) * (1 - smooth((age - life + 0.3) / 0.3)) * (1 - smooth((K.fallK || 0) / 0.6)), x = kcQ[0], y = kcQ[1];
  if (a < 0.01) return;
  const fs = W < 500 ? 21 : W < 700 ? 23 : 26, up = -Math.min(H * 0.2, 80), run = Math.min(W * 0.06, 34) * easeOut(age / 0.2);
  ctx.font = '800 ' + fs + 'px ' + kcFont; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const w1 = kcSpaced(ctx, tx[0] + (tx[1] ? ':' : ''), 0, 0, 2, false), w2 = tx[1] ? kcSpaced(ctx, tx[1], 0, 0, 2, false) : 0, tw = w1 + (w2 ? 9 + w2 : 0);
  // toward the emptier side, unless that runs it off the screen
  // (chosen once: the camera moves while it is up, and a label that hops from side to side is hard to read)
  let dirX = cp.dir;
  if (dirX === undefined) {
    dirX = x < W / 2 ? 1 : -1; const reach = Math.abs(up) * 0.55 + run + tw + 20;
    if (x + dirX * reach > W - 8 || x + dirX * reach < 8) dirX = -dirX;
    cp.dir = dirX;
  }
  const x1 = x + dirX * Math.abs(up) * 0.55, y1 = clamp(y + up, kcBars(W, H) + fs + 10, H);
  // kept on the screen: the elbow of the line gives way first
  const x2 = clamp(x1 + dirX * run, dirX > 0 ? 14 : tw + 14, dirX > 0 ? W - tw - 14 : W - 14);
  ctx.globalAlpha = a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x1, y1); ctx.lineTo(x2, y1); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
  const tx0 = dirX > 0 ? x2 + 6 : x2 - 6 - tw;
  ctx.globalAlpha = a * 0.5; ctx.fillStyle = '#000'; ctx.fillRect(tx0 - 6, y1 - fs - 3, tw + 12, fs + 9);
  ctx.globalAlpha = a; ctx.fillStyle = '#f1f5f4'; kcSpaced(ctx, tx[0] + (tx[1] ? ':' : ''), tx0, y1, 2, true);
  if (tx[1]) { ctx.fillStyle = '#ff5a4e'; kcSpaced(ctx, tx[1], tx0 + w1 + 9, y1, 2, true); }
  ctx.globalAlpha = 1;
}
// As the body falls: the stamp for what the shot was, knocked onto the picture, and up to two more below it.
function kcStampDraw(ctx, K, V) {
  const st = K.stamps; if (!st || !st.length || K.holdT0 === null || K.take) return;
  // it lands as the body does (but not in the first moment of the fall), or a little later if the
  // body never quite goes down; once it is there it stays put
  if (K.stampT0 === undefined) {
    // (the short cut is over too soon to wait for the landing)
    const a0 = K.holdT0 + 0.75;
    if (K.short ? K.T >= K.holdT0 + 0.4 : K.landT !== undefined ? K.T >= Math.max(a0, K.landT + 0.05) : K.T >= K.holdT0 + 1.6) K.stampT0 = K.T; else return;
  }
  const age = K.T - K.stampT0;
  const W = V.W, H = V.H, G = CB.Game || {}, sf = G.safe || {}, lb = kcBars(W, H);
  const fs = W < 500 ? 30 : W < 700 ? 34 : 40, k = 1 + 0.5 * Math.pow(1 - smooth(age / 0.14), 2), a = smooth(age / 0.08);
  const cx = W - 26 - (sf.r || 0), cy = lb + 22 + fs;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.045); ctx.scale(k, k);
  ctx.font = '800 ' + fs + 'px ' + kcFont; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const w = kcSpaced(ctx, st[0], 0, 0, 3, false), pad = 12;
  ctx.globalAlpha = a * 0.55; ctx.fillStyle = '#000'; ctx.fillRect(-w - pad * 2, -fs - pad + 2, w + pad * 2, fs + pad * 2 - 4);
  ctx.globalAlpha = a; ctx.strokeStyle = '#ff5a4e'; ctx.lineWidth = 3; ctx.strokeRect(-w - pad * 2, -fs - pad + 2, w + pad * 2, fs + pad * 2 - 4);
  ctx.lineWidth = 1; ctx.strokeRect(-w - pad * 2 + 5, -fs - pad + 7, w + pad * 2 - 10, fs + pad * 2 - 14);
  ctx.fillStyle = '#ffffff'; kcSpaced(ctx, st[0], -w - pad, -2, 3, true);
  ctx.restore();
  // the others, smaller, below it, one after another
  const fs2 = Math.round(fs * 0.5);
  ctx.font = '800 ' + fs2 + 'px ' + kcFont; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  for (let i = 1; i < Math.min(3, st.length); i++) {
    const ai = smooth((age - 0.25 - i * 0.18) / 0.12); if (ai < 0.01) continue;
    const wi = kcSpaced(ctx, st[i], 0, 0, 2, false), y = cy + fs * 0.62 + i * (fs2 + 8);
    ctx.globalAlpha = ai * 0.5; ctx.fillStyle = '#000'; ctx.fillRect(cx - wi - 10, y - fs2 - 2, wi + 12, fs2 + 7);
    ctx.globalAlpha = ai; ctx.fillStyle = '#ffb84d'; ctx.fillRect(cx - wi - 10, y - fs2 - 2, 3, fs2 + 7);
    ctx.fillStyle = '#ffffff'; kcSpaced(ctx, st[i], cx - wi - 2, y, 2, true);
  }
  ctx.globalAlpha = 1;
}
