// ---------------------------------------------------------------------------
// Range drills: four short tests on the Range, each scored against bronze, silver and gold.
//   Timed plates   five plates at 300 m against the clock (a miss adds three seconds)
//   Wind ladder    plates at 200, 350 and 500 m in a steady wind, in as few rounds as you can
//   Moving steel   a plate sliding on a rail at 250 m, five hits against the clock
//   Cold bore      one round at 450 m: the big plate is bronze, the middle silver, the small gold
// The first gold on each pays 2,500 credits and a sealed cache; gold on all four pays the Hot Steel
// reticle tint. Best scores and medals are kept in Save.data.drills[id] = { best, medal, paid }.
// A drill is a practice mission (nothing else is paid), so the Range's results go to
// UI.drillResult instead of the usual results screen.
// ---------------------------------------------------------------------------
const DRILLS = [
  { id: 'plates', name: 'Timed plates', how: 'Five steel plates at 300 m. Knock them all down against the clock. A miss adds 3 seconds.', unit: ' s', need: [40, 25, 16], limit: 75 },
  { id: 'ladder', name: 'Wind ladder', how: 'A plate at 200, 350 and 500 m in a steady 5 m/s wind from the left. Clear all three in as few rounds as you can.', unit: ' rounds', need: [9, 6, 3], limit: 120 },
  { id: 'mover', name: 'Moving steel', how: 'A plate on a rail at 250 m, sliding back and forth. Hit it five times. A miss adds 3 seconds.', unit: ' s', need: [60, 38, 24], limit: 90 },
  { id: 'cold', name: 'Cold bore', how: 'One round from a cold barrel at 450 m, in a light wind. Three plates: the big one is bronze, the middle one silver, the small one gold. Choose.', unit: '', need: [1, 2, 3], higher: true },
];
const DRILL_BY_ID = {}; DRILLS.forEach((D) => { DRILL_BY_ID[D.id] = D; });
const DRILL_GOLD = { cr: 2500, cache: 'sealed' };
COS_TINTS.push({ id: 'steel', name: 'Hot Steel', col: 'rgba(255,112,40,0.96)', sw: '#ff7028', how: 'Gold on all four Range drills' }); COS_TINT_BY_ID.steel = COS_TINTS[COS_TINTS.length - 1];
CB.DRILLS = DRILLS;

// A steel plate on a post. It rings, falls back when hit (unless it is a rail plate, which keeps
// ringing) and then lets bullets pass. x may move (ob.x), the post moves with it.
function drillPlate(S, P, x, y, r, id, o) {
  o = o || {};
  const ob = K.thing(S, P, 'bell', x, y, Object.assign({ id, r, lure: 0.01, drawFn(ctx, env) {
    const X = ob.x, post = S.tone('#3a3f47', P), hot = ob.ringT && env.t - ob.ringT < 0.22;
    line(ctx, X, 0, X, y - r * 0.6, post, 0.07, env);
    if (ob.down) { const k = Math.min(1, (env.t - ob.down) / 0.25); R4(ctx, X - r, y - r * 0.6 - 0.05, r * 2, Math.max(0.06, r * 2 * (1 - k * 0.92)), S.tone('#7c838c', P)); return; }
    circ(ctx, X, y, r, S.tone(hot ? '#ffffff' : (o.col || '#d9dee3'), P)); circ(ctx, X, y, r * 0.35, S.tone(o.dot || '#e0413a', P));
    if (hot) circ(ctx, X, y, r * 1.3, 'rgba(255,255,255,0.45)');
  }, onHit(sim) {
    sim.stats.dhits = (sim.stats.dhits || 0) + 1; sim.stats.dLast = sim.t;
    if (o.tier) sim.stats.dTier = Math.max(sim.stats.dTier || 0, o.tier);
    if (!o.stays) { ob.down = sim.t; ob.r = 0; }
  } }, o.extra || {}));
  return ob;
}
// The ground, the hills behind, flags and a distance board at each plane.
function drillScene(dists, opt) {
  const far = dists[dists.length - 1], ref = opt.ref || far, half = Math.max(12, ref * 0.035);
  const S = makeScene({ time: 'day', seed: 4, refZ: ref, bounds: { x0: -half, x1: half, y0: -1.5, y1: Math.max(8, ref * 0.022) }, ambience: 'wild', groundMat: 'dirt', exits: [-99, 99] });
  K.mountains(S, far + 6000, { seed: 8, h: 900, col: '#7f8da0' });
  K.hills(S, far + 900, { seed: 5, h: 120, col: '#5f8f58', trees: 0.5, rough: 380, step: 60 });
  K.hills(S, far + 28, { seed: 9, h: 7, base: 1.5, col: '#8a7a55', rough: 60, step: 6, x0: -200, x1: 200, mat: 'dirt' });
  const planes = dists.map((z) => { const P = S.plane(z, 'line'); K.ground(S, P, { col: '#76a05e', edge: '#8fb974', mat: 'dirt' }); return P; });
  const P0 = planes[planes.length - 1];
  K.flag(S, P0, -half * 0.8, 0, 5, '#e07b2a'); K.flag(S, P0, half * 0.8, 0, 5, '#e07b2a');
  return { S, planes };
}
function drillMission(D) {
  const base = { id: 'drill_' + D.id, practice: true, drill: D.id, ch: 0, title: D.name, range: 0, objective: D.how, brief: D.how, intel: [], par: 999,
    challenge: { text: '', test: () => false }, reward: { cr: 0, xp: 0 }, solve: [], look: [0, 1.6], cast() { return []; } };
  const eye = (z) => [{ name: 'Firing point', desc: '', eye: [0, 4 + z * 0.012, 0] }];
  const allDown = (sim) => sim.S.objects.filter((o) => o.kind === 'bell').every((o) => o.down);
  if (D.id === 'plates') return Object.assign(base, {
    wind: { v: 0, gust: 0 }, vantages: eye(300), rules: { done: allDown, time: D.limit, timeText: 'Out of time.', reserve: 60, aftermath: 1.2 },
    setup() { const { S, planes } = drillScene([300], {}); [-6, -3, 0, 3, 6].forEach((x, i) => drillPlate(S, planes[0], x, 1.4, 0.32, 'p' + i)); K.box(S, planes[0], 9, 0, 2.2, 1.1, '#e9e4d6', { text: '300 M', textCol: '#1d2026', solid: false }); return { S, P: planes[0] }; },
    triggers() { return [hint(0.5, 'Five plates. The clock is running. Every miss adds 3 seconds.', 6)]; },
  });
  if (D.id === 'ladder') return Object.assign(base, {
    wind: { v: 5, gust: 0 }, vantages: eye(350), rules: { done: allDown, time: D.limit, timeText: 'Out of time.', reserve: 60, aftermath: 1.2 },
    setup() {
      const { S, planes } = drillScene([200, 350, 500], { ref: 350 });
      [[-7, 200], [0, 350], [7, 500]].forEach(([x, z], i) => { const P = planes[i], sx = (x * z) / 350; drillPlate(S, P, sx, 1.4, 0.4, 'l' + i); K.box(S, P, sx + 1.6 * (z / 350), 0, 1.6 * (z / 350), 0.8 * (z / 350), '#e9e4d6', { text: z + ' M', textCol: '#1d2026', solid: false }); });
      return { S, P: planes[1] };
    },
    triggers() { return [hint(0.5, 'Wind 5 m/s from the left, steady. Three plates, near to far. Count your rounds.', 7)]; },
  });
  if (D.id === 'mover') return Object.assign(base, {
    wind: { v: 0, gust: 0 }, vantages: eye(250), rules: { done: (sim) => (sim.stats.dhits || 0) >= 5, time: D.limit, timeText: 'Out of time.', reserve: 60, aftermath: 1.2 },
    setup() {
      const { S, planes } = drillScene([250], {}); const P = planes[0];
      P.add({ x0: -7.5, x1: 7.5, layer: 0, draw(ctx, env) { line(ctx, -7.2, 0.62, 7.2, 0.62, S.tone('#2a2e36', P), 0.08, env); line(ctx, -7.2, 0, -7.2, 0.7, S.tone('#3a3f47', P), 0.1, env); line(ctx, 7.2, 0, 7.2, 0.7, S.tone('#3a3f47', P), 0.1, env); } });
      drillPlate(S, P, 0, 1.3, 0.36, 'mv', { stays: true, col: '#f2d36a' });
      K.box(S, P, 9.4, 0, 2.2, 1.1, '#e9e4d6', { text: '250 M', textCol: '#1d2026', solid: false });
      return { S, P };
    },
    // the rail plate slides back and forth, up to about 2.7 m/s in the middle
    tick(sim) { const ob = sim.S.objects.find((o) => o.id === 'mv'); if (ob) ob.x = Math.sin(sim.t * 0.45) * 6; },
    triggers() { return [hint(0.5, 'Five hits on the moving plate. Lead it: aim ahead of it in the way it is going.', 7)]; },
  });
  // cold bore: one round, then it is over
  return Object.assign(base, {
    wind: { v: 2, gust: 0.4 }, vantages: eye(450), rules: { done: (sim) => sim.stats.shots >= 1 && !sim.bullets.some((b) => b.alive) && sim.t - sim.sh.lastFire > 0.6, reserve: 0, aftermath: 1.4 },
    setup() {
      const { S, planes } = drillScene([450], {}); const P = planes[0];
      drillPlate(S, P, -4, 1.5, 0.4, 'cb', { tier: 1 }); drillPlate(S, P, 0, 1.5, 0.2, 'cs', { tier: 2 }); drillPlate(S, P, 4, 1.5, 0.1, 'cg', { tier: 3, dot: '#f0c24a' });
      K.box(S, P, 8, 0, 2.2, 1.1, '#e9e4d6', { text: '450 M', textCol: '#1d2026', solid: false });
      return { S, P };
    },
    // one round means one: once it is fired the rifle is empty
    tick(sim) { if (sim.stats.shots >= 1) { sim.sh.ammo = 0; sim.sh.reserve = 0; } },
    triggers() { return [hint(0.5, 'One round. Big plate bronze, middle silver, small gold. Take your time.', 8)]; },
  });
}
// The score of a finished run, and the medal it earns (0 for none).
function drillScore(D, res) {
  const st = res.stats || {}, hits = st.dhits || 0, miss = Math.max(0, (res.shots || 0) - hits);
  if (!res.win) return { score: null, medal: 0, miss };
  let score;
  if (D.id === 'cold') score = st.dTier || 0;
  else if (D.id === 'ladder') score = res.shots;
  else score = Math.round(((st.dLast || res.time) + 3 * miss) * 10) / 10;
  let medal = 0; D.need.forEach((n, i) => { if (D.higher ? score >= n : score <= n) medal = i + 1; });
  return { score, medal, miss };
}
CB.drillScore = drillScore; CB.drillMission = (id) => (MISSION_BY_ID['drill_' + id] = drillMission(DRILL_BY_ID[id]));
function drillFmt(D, v) { if (v === null || v === undefined) return 'none'; if (D.id === 'cold') return ['Missed', 'Bronze plate', 'Silver plate', 'Gold plate'][v] || 'Missed'; return (D.id === 'ladder' || Number.isInteger(v) ? v : fmt(v, 1)) + D.unit; }

// The Range drills page.
UI.drillsHtml = function () {
  const d = Save.data; if (!d.drills) d.drills = {};
  const n = DRILLS.reduce((a, D) => a + ((d.drills[D.id] || {}).medal || 0), 0);
  return `<div class="drills"><p class="dim">Four short tests. Each one is scored for bronze, silver and gold. The first gold on each pays ${fmtCr(DRILL_GOLD.cr)} credits and a sealed cache; gold on all four pays a reticle tint. ${n} of 12 medals.</p>
    <div class="dgrid">${DRILLS.map((D) => { const rec = d.drills[D.id] || {}, m = rec.medal || 0;
      return `<div class="dcard t${m}"><span class="dc-pic"><canvas data-drill="${D.id}" data-lazy></canvas></span><div class="dc-t"><b>${esc(D.name)}</b><p>${esc(D.how)}</p>
        <span class="dneed">${D.need.map((v, i) => `<i class="p${i + 1} ${m > i ? 'on' : ''}">${['Bronze', 'Silver', 'Gold'][i]} ${D.id === 'cold' ? '' : drillFmt(D, v)}</i>`).join('')}</span>
        <span class="dbest">Best: ${drillFmt(D, rec.best)}${rec.paid ? '  ·  first gold paid' : ''}</span></div>
        <button class="btn pri" data-a="drill" data-id="${D.id}" data-snd="go">Start</button></div>`; }).join('')}</div></div>`;
};
UI.startDrill = function (id) { const D = DRILL_BY_ID[id]; if (!D) return; MISSION_BY_ID['drill_' + id] = drillMission(D); UI.launch('drill_' + id, {}); };
// After a drill: the score, the medal it earned, a new best, the first-gold reward; again or leave.
UI.drillResult = function (M, res, last) {
  const D = M && DRILL_BY_ID[M.drill]; if (!D) return false;
  const d = Save.data; if (!d.drills) d.drills = {};
  const rec = d.drills[D.id] || (d.drills[D.id] = { best: null, medal: 0, paid: false });
  const r = drillScore(D, res), better = r.score !== null && (rec.best === null || rec.best === undefined || (D.higher ? r.score > rec.best : r.score < rec.best));
  if (better) rec.best = r.score;
  const newMedal = r.medal > (rec.medal || 0); if (newMedal) rec.medal = r.medal;
  const rew = [];
  if (r.medal >= 3 && !rec.paid) { rec.paid = true; d.credits += DRILL_GOLD.cr; d.caches.push(DRILL_GOLD.cache); rew.push(fmtCr(DRILL_GOLD.cr) + ' credits', CACHE_NAME[DRILL_GOLD.cache]); }
  if (DRILLS.every((x) => (d.drills[x.id] || {}).medal >= 3) && !d.cos.tints.steel) { d.cos.tints.steel = 1; rew.push('Reticle tint: Hot Steel'); }
  Save.write();
  if (r.medal >= 3 && UI.medalSweep) UI.medalSweep(); // Range Rat counts golds
  const verdict = !res.win ? 'Out of time' : r.medal ? ['', 'Bronze', 'Silver', 'Gold'][r.medal] : D.id === 'cold' ? 'Missed' : 'No medal';
  UI.render(`<div class="scr drillres t${r.medal}">
    <div class="dr-l"><canvas class="dr-medal" data-medal="drills" data-tier="${r.medal}"></canvas></div>
    <div class="dr-r"><div class="eyebrow">Range drill  ·  ${esc(D.name)}</div><h1>${verdict}</h1>
      <div class="dr-score"><b>${res.win ? drillFmt(D, r.score) : 'Time ran out'}</b>${better && rec.best !== null ? '<em class="newrec">New best</em>' : '<i>Best: ' + drillFmt(D, rec.best) + '</i>'}</div>
      <p class="dim">${res.win && D.id !== 'cold' && D.id !== 'ladder' ? r.miss + (r.miss === 1 ? ' miss' : ' misses') + ', ' + res.shots + (res.shots === 1 ? ' round' : ' rounds') + '. ' : ''}${D.need.map((v, i) => ['Bronze', 'Silver', 'Gold'][i] + ' ' + drillFmt(D, v)).join('  ·  ')}</p>
      ${rew.length ? `<div class="dr-rew"><span>First gold</span>${rew.map((t) => '<b>' + esc(t) + '</b>').join('')}</div>` : ''}
      <div class="dr-btns"><button class="btn ghost" data-a="leave" data-snd="back">The Range</button><button class="btn pri" data-a="again" data-snd="go">Again</button></div></div></div>`, {
    leave() { UI.tab = 'range'; UI.rangeTab = 'drills'; UI.hub(); },
    again() { UI.startDrill(D.id); },
  }, 'is-drill');
  if (newMedal || rew.length) Sfx.rarity(Math.min(4, r.medal + 1));
  return true;
};

// A small picture of each drill, for its card.
function drawDrill(c, id, w, h) {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9fb6c8'); g.addColorStop(0.55, '#c9d6c0'); g.addColorStop(0.56, '#76a05e'); g.addColorStop(1, '#5a8448');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(95,143,88,0.9)'; c.beginPath(); c.moveTo(0, h * 0.56); for (let x = 0; x <= w; x += w / 8) c.lineTo(x, h * (0.46 + 0.05 * Math.sin(x * 0.11))); c.lineTo(w, h * 0.56); c.closePath(); c.fill();
  const plate = (x, y, r, col, dot) => { c.strokeStyle = '#3a3f47'; c.lineWidth = Math.max(1, r * 0.25); c.beginPath(); c.moveTo(x, y + r); c.lineTo(x, h * 0.62); c.stroke(); c.fillStyle = col || '#e6eaee'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.fillStyle = dot || '#e0413a'; c.beginPath(); c.arc(x, y, r * 0.35, 0, TAU); c.fill(); };
  const gy = h * 0.42;
  if (id === 'plates') for (let i = 0; i < 5; i++) plate(w * (0.18 + i * 0.16), gy, h * 0.09);
  else if (id === 'ladder') { plate(w * 0.2, h * 0.36, h * 0.14); plate(w * 0.5, h * 0.4, h * 0.09); plate(w * 0.8, h * 0.43, h * 0.06); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1.5; for (let i = 0; i < 3; i++) { const y = h * (0.12 + i * 0.08); c.beginPath(); c.moveTo(w * 0.08, y); c.quadraticCurveTo(w * 0.3, y - 4, w * 0.5, y); c.stroke(); } }
  else if (id === 'mover') { c.strokeStyle = '#2a2e36'; c.lineWidth = 2; c.beginPath(); c.moveTo(w * 0.12, h * 0.58); c.lineTo(w * 0.88, h * 0.58); c.stroke(); plate(w * 0.58, gy, h * 0.11, '#f2d36a'); c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(w * 0.3, gy); c.lineTo(w * 0.44, gy); c.moveTo(w * 0.4, gy - 4); c.lineTo(w * 0.44, gy); c.lineTo(w * 0.4, gy + 4); c.stroke(); }
  else { plate(w * 0.26, gy, h * 0.14, '#d99a62'); plate(w * 0.52, gy, h * 0.08, '#dfe6ee'); plate(w * 0.74, gy, h * 0.045, '#ffd36e', '#8a5e0e'); }
}
CB.drawDrill = drawDrill;
