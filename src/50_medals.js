// ---------------------------------------------------------------------------
// Medals. Ninety-nine to earn: thirty that come in bronze, silver and gold (Marksman: 25, 100
// and 300 kills) and nine that are earned once (a headshot at 600 m). Every one pays credits and
// xp, gold pays a sealed cache too, and three pay a calling card. They read what the save already
// keeps (kills, stars, ducks, skins, ranks ...) and a few counters of their own in Save.data.mstat
// (kills on the move, in the dark, contracts won without a miss ...), counted from each result.
// Everything is earned by playing.
//
//   CB.Medals.check(M, res, out, info)  at the end of a contract (Progress.apply calls it): counts
//                                       the run, then returns every medal or tier reached, each
//                                       { id, name, tier, tiers, cr, xp, cache, card, payText }.
//                                       Calling cards are given here; Progress.apply adds the
//                                       credits, xp and caches to the run's pay.
//   CB.Medals.sweep()                   outside a contract (the title screen, after opening
//                                       caches): pays whatever has been reached since, straight
//                                       into the save (rank rewards included), and returns it.
//   CB.Medals.list()                    every medal with { M, tier, have, next, need, frac }
//   CB.drawMedal(ctx, id, x, y, size, tier)   the medal, drawn (tier 0: not earned yet)
//
// For the mission screen (the HUD):
//   CB.Medals.watch(sim)                call once a frame (or after each step) during a contract.
//                                       Cheap: it only looks again when a kill or a broken pane
//                                       has been added. Returns [] or the medals this run has
//                                       just made certain (a headshot past 600 m, the 20th kill
//                                       on the move ...), each once per run. They are paid at the
//                                       end by check(), win or lose, as the toast promises.
//   CB.Medals.toast(m)                  shows one of them as a small banner at the top of the
//                                       screen for 2.6 s (a DOM element in #toast, so it costs the
//                                       canvas nothing). Also used by the menus.
// ---------------------------------------------------------------------------
const MEDAL_GROUPS = [
  { k: 'aim', name: 'Marksmanship', rib: ['#a82a24', '#f2e8da', '#5e1410'] },
  { k: 'quiet', name: 'Quiet work', rib: ['#1e2a36', '#8ea4ba', '#0c1218'] },
  { k: 'work', name: 'Contracts', rib: ['#1d4a86', '#f0c24a', '#0c2244'] },
  { k: 'kit', name: 'Collection', rib: ['#24624a', '#e6eef0', '#0e2e22'] },
  { k: 'odd', name: 'Curiosities', rib: ['#62358a', '#f0d070', '#2e1444'] },
];
const MEDAL_PAY = [null, { cr: 300, xp: 100 }, { cr: 900, xp: 250 }, { cr: 2000, xp: 500, cache: 'sealed' }];
const MEDAL_PAY_ONCE = { cr: 750, xp: 200, cache: 'field' };
const MEDAL_TIER_NAME = ['Not yet', 'Bronze', 'Silver', 'Gold'];
// the counters this file keeps for itself
function mstat(d) { if (!d.mstat) d.mstat = {}; return d.mstat; }
const msv = (k) => (d) => mstat(d)[k] || 0;
const plural = (n, one, many) => fmtCr(n) + ' ' + (n === 1 ? one : many);
const MEDALS = [
  // marksmanship
  { id: 'kills', g: 'aim', name: 'Marksman', icon: 'cross', need: [25, 100, 300], val: (d) => d.stats.kills || 0, text: (n) => plural(n, 'kill', 'kills') },
  { id: 'heads', g: 'aim', name: 'Headhunter', icon: 'head', need: [10, 50, 150], val: (d) => d.stats.heads || 0, text: (n) => plural(n, 'headshot', 'headshots') },
  { id: 'long', g: 'aim', name: 'Long Reach', icon: 'reach', need: [400, 700, 1000], val: (d) => d.stats.longest || 0, unit: ' m', text: (n) => 'A kill at ' + fmtCr(n) + ' m or more', card: [0, 0, 0, 'kilometre'] },
  { id: 'moving', g: 'aim', name: 'Lead the Target', icon: 'run', need: [5, 20, 60], val: msv('moving'), text: (n) => plural(n, 'kill', 'kills') + ' on the move' },
  { id: 'dark', g: 'aim', name: 'Night Work', icon: 'moon', need: [5, 20, 60], val: msv('dark'), text: (n) => plural(n, 'kill', 'kills') + ' in the dark' },
  { id: 'oneshot', g: 'aim', name: 'One Round', icon: 'bullet', need: [3, 10, 25], val: msv('oneshot'), text: (n) => plural(n, 'contract', 'contracts') + ' won with a single shot' },
  { id: 'flawless', g: 'aim', name: 'No Wasted Rounds', icon: 'hits', need: [3, 10, 25], val: msv('flawless'), text: (n) => plural(n, 'contract', 'contracts') + ' won without a miss' },
  { id: 'still', g: 'aim', name: 'Ice Water', icon: 'breath', need: [5, 20, 50], val: msv('nobreath'), text: (n) => plural(n, 'contract', 'contracts') + ' won without holding your breath' },
  // quiet work
  { id: 'ghost', g: 'quiet', name: 'Ghost', icon: 'ghost', need: [3, 10, 30], val: msv('clean'), text: (n) => plural(n, 'contract', 'contracts') + ' won with no alarm and nobody running', card: [0, 0, 'ghostcard', 0] },
  { id: 'precise', g: 'quiet', name: 'Economy', icon: 'par', need: [5, 20, 50], val: msv('precise'), text: (n) => plural(n, 'contract', 'contracts') + ' won in par shots or fewer' },
  { id: 'quick', g: 'quiet', name: 'Quick Work', icon: 'clock', need: [3, 10, 30], val: msv('quick'), text: (n) => plural(n, 'contract', 'contracts') + ' won inside a minute' },
  { id: 'accident', g: 'quiet', name: 'Act of God', icon: 'dice', need: [1, 5, 15], val: msv('accident'), text: (n) => plural(n, 'death', 'deaths') + ' that looked like an accident' },
  { id: 'blast', g: 'quiet', name: 'Loud Exit', icon: 'blast', need: [3, 10, 30], val: msv('blast'), text: (n) => plural(n, 'target', 'targets') + ' caught in a blast' },
  { id: 'twofer', g: 'quiet', name: 'Two for One', icon: 'two', need: [1, 5, 15], val: msv('twofer'), text: (n) => 'Two down with one round, ' + plural(n, 'time', 'times') },
  // contracts
  { id: 'wins', g: 'work', name: 'Contractor', icon: 'file', need: [10, 40, 100], val: (d) => d.stats.wins || 0, text: (n) => plural(n, 'contract', 'contracts') + ' won' },
  { id: 'stars', g: 'work', name: 'Starlight', icon: 'star', need: [30, 75, 120], val: () => Progress.totals().stars, text: (n) => plural(n, 'star', 'stars') },
  { id: 'challenges', g: 'work', name: 'Overachiever', icon: 'flag', need: [5, 20, 40], val: () => Progress.totals().ch, text: (n) => plural(n, 'challenge', 'challenges') + ' done' },
  { id: 'chapters', g: 'work', name: 'Casebook', icon: 'book', need: [2, 4, 6], val: (d) => Object.keys(d.chDone || {}).length, text: (n) => plural(n, 'chapter', 'chapters') + ' closed' },
  { id: 'paths', g: 'work', name: 'Crossroads', icon: 'fork', need: [3, 6, 10], val: (d) => Object.keys(d.outcomes || {}).reduce((a, k) => a + Object.keys(d.outcomes[k]).length, 0), text: (n) => plural(n, 'way', 'ways') + ' the story went' },
  { id: 'endings', g: 'work', name: 'Every Ending', icon: 'end', need: [1, 2, 4], val: (d) => Object.keys(d.endings || {}).length, text: (n) => plural(n, 'ending', 'endings') + ' seen' },
  { id: 'daily', g: 'work', name: 'Daily Bread', icon: 'sun', need: [3, 10, 30], val: msv('daily'), text: (n) => plural(n, 'daily contract', 'daily contracts') + ' won' },
  // collection
  { id: 'rank', g: 'kit', name: 'Rising', icon: 'chev', need: [10, 30, 60], val: () => Progress.rankNow().n + (Save.data.prestige || 0) * RANKS.length, text: (n) => 'Rank ' + n },
  { id: 'rifles', g: 'kit', name: 'Arsenal', icon: 'rifle', need: [4, 9, 16], val: (d) => Object.keys(d.guns).length, text: (n) => plural(n, 'rifle', 'rifles') + ' owned' },
  { id: 'skins', g: 'kit', name: 'Wardrobe', icon: 'gem', need: [20, 50, 90], val: (d) => SKINS.filter((s) => s.id !== 'factory' && d.skins[s.id]).length, text: (n) => plural(n, 'skin', 'skins') + ' owned' },
  { id: 'caches', g: 'kit', name: 'Unboxer', icon: 'box', need: [10, 40, 100], val: (d) => d.stats.cachesOpened || 0, text: (n) => plural(n, 'cache', 'caches') + ' opened' },
  { id: 'mastery', g: 'kit', name: 'Devotion', icon: 'wreath', need: [12, 40, 120], val: (d) => (CB.Mastery ? Object.keys(d.guns).reduce((a, id) => a + CB.Mastery.level(id), 0) : 0), text: (n) => plural(n, 'mastery level', 'mastery levels') + ', all rifles together' },
  { id: 'drills', g: 'kit', name: 'Range Rat', icon: 'plate', need: [1, 2, 4], val: (d) => Object.keys(d.drills || {}).filter((k) => (d.drills[k] || {}).medal >= 3).length, text: (n) => plural(n, 'Range drill', 'Range drills') + ' at gold' },
  // curiosities
  { id: 'glass', g: 'odd', name: 'Glazier', icon: 'glass', need: [10, 40, 100], val: msv('glass'), text: (n) => plural(n, 'pane', 'panes') + ' of glass broken' },
  { id: 'ducks', g: 'odd', name: 'Duck Hunter', icon: 'duck', need: [5, 20, MISSIONS.length], val: (d) => Object.keys(d.ducks || {}).length, text: (n) => plural(n, 'rubber duck', 'rubber ducks') + ' found', card: [0, 0, 'duck', 0] },
  { id: 'shots', g: 'odd', name: 'Trigger Time', icon: 'brass', need: [200, 1000, 3000], val: (d) => d.stats.shots || 0, text: (n) => plural(n, 'round', 'rounds') + ' fired' },
  // earned once
  { id: 'first', g: 'work', name: 'First Contract', icon: 'file', need: [1], val: msv('first'), text: () => 'Win your first contract' },
  { id: 'three', g: 'work', name: 'Three Stars', icon: 'star', need: [1], val: msv('three'), text: () => 'Three stars on one run' },
  { id: 'head600', g: 'aim', name: 'Long Head', icon: 'head', need: [1], val: msv('head600'), text: () => 'A headshot at 600 m or more' },
  { id: 'move400', g: 'aim', name: 'Running Man', icon: 'run', need: [1], val: msv('move400'), text: () => 'A kill on the move at 400 m or more' },
  { id: 'dark500', g: 'aim', name: 'Owl', icon: 'moon', need: [1], val: msv('dark500'), text: () => 'A kill in the dark at 500 m or more' },
  { id: 'k1500', g: 'aim', name: 'Fifteen Hundred', icon: 'reach', need: [1], val: msv('k1500'), text: () => 'A kill at 1,500 m or more' },
  { id: 'blink', g: 'quiet', name: 'Blink', icon: 'clock', need: [1], val: msv('blink'), text: () => 'Win a contract inside 20 seconds' },
  { id: 'setdone', g: 'kit', name: 'Matched Set', icon: 'gem', need: [1], val: (d) => Object.keys(d.sets || {}).length, text: () => 'Own every skin in a set' },
  { id: 'again', g: 'kit', name: 'Second Run', icon: 'chev', need: [1], val: (d) => d.prestige || 0, text: () => 'Start the rank track again at rank 60' },
];
const MEDAL_BY_ID = {}; MEDALS.forEach((m) => { MEDAL_BY_ID[m.id] = m; });
const Medals = CB.Medals = { MEDALS, GROUPS: MEDAL_GROUPS };
Medals.count = function () { return MEDALS.reduce((a, m) => a + m.need.length, 0); };
Medals.have = function () { const d = Save.data; return MEDALS.reduce((a, m) => a + Math.min(m.need.length, (d.medals || {})[m.id] || 0), 0); };
// What a tier pays, and the line that says so.
function medalPay(m, tier) {
  const p = Object.assign({}, m.need.length === 1 ? MEDAL_PAY_ONCE : MEDAL_PAY[tier]);
  const card = m.card && m.card[tier]; if (card) p.card = card;
  p.payText = ['+' + fmtCr(p.cr) + ' cr', '+' + p.xp + ' xp'].concat(p.cache ? [CACHE_NAME[p.cache]] : [], card ? ['Calling card: ' + COS_CARD_BY_ID[card].name] : []).join('  ·  ');
  return p;
}
Medals.pay = medalPay;
// Every tier reached and not yet recorded, recorded now. Cards are given here; the rest is returned.
function medalReach(d) {
  if (!d.medals) d.medals = {};
  const got = [];
  MEDALS.forEach((m) => {
    let v = 0; try { v = m.val(d) || 0; } catch (e) { v = 0; }
    for (let t = (d.medals[m.id] || 0) + 1; t <= m.need.length; t++) {
      if (v < m.need[t - 1]) break;
      d.medals[m.id] = t;
      const p = medalPay(m, t); if (p.card && d.cos) d.cos.cards[p.card] = 1;
      got.push(Object.assign({ id: m.id, name: m.name, tier: t, tiers: m.need.length, icon: m.icon }, p));
    }
  });
  return got;
}
// Count one finished contract into the medal counters.
function medalCount(d, M, res) {
  const c = mstat(d), inc = (k, n) => { if (n) c[k] = (c[k] || 0) + n; };
  const kills = res.kills || [], shot = kills.filter((k) => k.how === 'shot'), st = res.stats || {};
  inc('moving', shot.filter((k) => k.moving).length); inc('dark', shot.filter((k) => k.lit === false).length);
  inc('accident', kills.filter((k) => k.accident).length); inc('blast', kills.filter((k) => k.how === 'blast' && !k.accident).length);
  inc('glass', st.glass || 0); inc('twofer', medalTwofers(shot));
  if (shot.some((k) => k.part === 'head' && k.range >= 600)) c.head600 = 1;
  if (shot.some((k) => k.moving && k.range >= 400)) c.move400 = 1;
  if (shot.some((k) => k.lit === false && k.range >= 500)) c.dark500 = 1;
  if (shot.some((k) => k.range >= 1500)) c.k1500 = 1;
  if (!res.win) return;
  inc('first', c.first ? 0 : 1); if (res.stars === 3) c.three = 1;
  if (res.shots === 1) inc('oneshot', 1);
  if (res.shots >= 1 && !st.misses) inc('flawless', 1);
  if (!st.breathUsed) inc('nobreath', 1);
  if (res.clean) inc('clean', 1);
  if (res.precise) inc('precise', 1);
  if (res.time < 60) inc('quick', 1);
  if (res.time < 20) c.blink = 1;
}
// Two people dropped by one round: shot kills a hair apart in time (no rifle cycles that fast).
function medalTwofers(shot) { let n = 0; for (let i = 1; i < shot.length; i++) if (Math.abs(shot[i].t - shot[i - 1].t) < 0.12) { n++; i++; } return n; }

// A guided run (the coach showed every step) earns no medals, as it earns no caches: they wait for
// a run of your own (or, for records the save keeps anyway, the next title screen).
Medals.check = function (M, res, out, info) {
  const d = Save.data; if (!M || M.practice || !res || (info && info.guided)) return [];
  medalCount(d, M, res);
  return medalReach(d);
};
Medals.sweep = function () {
  const d = Save.data; if (!d) return [];
  const got = medalReach(d); if (!got.length) return got;
  const r0 = Progress.rankNow().n;
  got.forEach((m) => { d.credits += m.cr || 0; d.xp += m.xp || 0; if (m.cache) d.caches.push(m.cache); });
  // xp earned here passes ranks too: hand over their rewards as the results screen would
  const r1 = Progress.rankNow().n;
  for (let n = r0 + 1; n <= r1; n++) if (n > (d.rankPaid || 1)) Progress.payRank(n);
  Save.write();
  return got;
};
Medals.list = function () {
  const d = Save.data;
  return MEDALS.map((m) => {
    let v = 0; try { v = m.val(d) || 0; } catch (e) { v = 0; }
    const tier = Math.min(m.need.length, (d.medals || {})[m.id] || 0), need = m.need[tier] || null;
    return { M: m, tier, have: v, need, frac: need ? clamp(m.need.length === 1 ? 0 : v / need, 0, 1) : 1, pay: need ? medalPay(m, tier + 1) : null };
  });
};

// ---- during a contract ----
// What this run has made certain so far: the once-only medals, and tiers of the counters that
// count win or lose (kills on the move, in the dark, accidents, blasts, glass).
Medals.watch = function (sim) {
  if (!sim || !Save.data || (sim.M && sim.M.practice)) return [];
  const W = sim._medals || (sim._medals = { nk: -1, ng: -1, said: {} }), d = Save.data;
  const nk = sim.kills ? sim.kills.length : 0, ng = sim.stats ? sim.stats.glass : 0;
  if (nk === W.nk && ng === W.ng) return [];
  W.nk = nk; W.ng = ng;
  const shot = (sim.kills || []).filter((k) => k.how === 'shot'), c = mstat(d), out = [], tell = (id, tier) => {
    const key = id + tier, m = MEDAL_BY_ID[id]; if (W.said[key] || ((d.medals || {})[id] || 0) >= tier) return;
    W.said[key] = 1; out.push(Object.assign({ id, name: m.name, tier, tiers: m.need.length, icon: m.icon }, medalPay(m, tier)));
  };
  if (!c.head600 && shot.some((k) => k.part === 'head' && k.range >= 600)) tell('head600', 1);
  if (!c.move400 && shot.some((k) => k.moving && k.range >= 400)) tell('move400', 1);
  if (!c.dark500 && shot.some((k) => k.lit === false && k.range >= 500)) tell('dark500', 1);
  if (!c.k1500 && shot.some((k) => k.range >= 1500)) tell('k1500', 1);
  const run = { moving: shot.filter((k) => k.moving).length, dark: shot.filter((k) => k.lit === false).length, accident: sim.kills.filter((k) => k.accident).length, blast: sim.kills.filter((k) => k.how === 'blast' && !k.accident).length, glass: ng || 0 };
  Object.keys(run).forEach((id) => { const m = MEDAL_BY_ID[id], v = (c[id] || 0) + run[id]; m.need.forEach((n, i) => { if (v >= n) tell(id, i + 1); }); });
  return out;
};
// A small banner with the medal on it.
Medals.toast = function (m) {
  const box = document.getElementById('toast'); if (!box || !m) return;
  const e = document.createElement('div'); e.className = 'toast mtoast';
  e.innerHTML = `<canvas width="88" height="88"></canvas><span><i>Medal${m.tiers > 1 ? '  ·  ' + MEDAL_TIER_NAME[m.tier] : ''}</i><b>${esc(m.name)}</b><em>${esc(m.payText || '')}</em></span>`;
  box.appendChild(e);
  try { const x = e.querySelector('canvas').getContext('2d'); x.scale(2, 2); drawMedal(x, m.id, 0, 0, 44, m.tiers === 1 ? 1 : m.tier); } catch (er) { /* a picture is a nicety */ }
  setTimeout(() => e.classList.add('out'), 2600); setTimeout(() => { if (e.parentNode) e.parentNode.removeChild(e); }, 3100);
};

// ---- the picture ----
const MEDAL_FIN = [
  ['#5a6270', '#3a414c', '#20252c', '#4a525e'], // not earned yet
  ['#f6caa0', '#c47a3e', '#6e3c1a', '#e0a46a'], // bronze
  ['#ffffff', '#c9d2dc', '#6c7784', '#e8edf2'], // silver
  ['#fff6c8', '#f0c24a', '#8a5e0e', '#ffdc80'], // gold
];
const MEDAL_FIN_ONCE = ['#efe8ff', '#9d88ea', '#3e2f7e', '#c9baff']; // the ones earned once: violet enamel
const _medalArt = new Map();
function drawMedal(ctx, id, x, y, s, tier) {
  const m = MEDAL_BY_ID[id]; if (!m) return;
  const px = Math.max(16, Math.round(s * 2)), key = id + '/' + tier + '/' + px;
  let cv = _medalArt.get(key);
  if (!cv) {
    cv = document.createElement('canvas'); cv.width = cv.height = px;
    medalArt(cv.getContext('2d'), m, tier, px);
    if (_medalArt.size > 400) _medalArt.clear();
    _medalArt.set(key, cv);
  }
  ctx.drawImage(cv, 0, 0, px, px, x, y, s, s);
}
CB.drawMedal = drawMedal;
function medalArt(c, m, tier, s) {
  const G = MEDAL_GROUPS.find((g) => g.k === m.g) || MEDAL_GROUPS[0], once = m.need.length === 1;
  const F = tier <= 0 ? MEDAL_FIN[0] : once ? MEDAL_FIN_ONCE : MEDAL_FIN[Math.min(3, tier)], dull = tier <= 0;
  const cx = s / 2, cy = s * 0.61, r = s * 0.34, rw = s * 0.36, rt = s * 0.02, rb = cy - r * 0.55;
  c.lineJoin = 'round'; c.lineCap = 'round';
  // the ribbon: a band narrowing to the clasp, striped in the colours of its group
  c.save();
  c.beginPath(); c.moveTo(cx - rw / 2, rt); c.lineTo(cx + rw / 2, rt); c.lineTo(cx + rw * 0.3, rb); c.lineTo(cx - rw * 0.3, rb); c.closePath(); c.clip();
  c.fillStyle = dull ? '#2c323b' : G.rib[0]; c.fillRect(0, 0, s, s);
  if (!dull) { c.fillStyle = G.rib[1]; c.fillRect(cx - rw * 0.08, 0, rw * 0.16, s); c.fillRect(cx - rw * 0.4, 0, rw * 0.05, s); c.fillRect(cx + rw * 0.35, 0, rw * 0.05, s); }
  if (!dull && tier >= 2 && !once) { c.fillStyle = G.rib[2]; c.fillRect(cx - rw * 0.2, 0, rw * 0.04, s); c.fillRect(cx + rw * 0.16, 0, rw * 0.04, s); }
  if (!dull && tier >= 3 && !once) { c.fillStyle = '#f0c24a'; c.fillRect(cx - rw * 0.29, 0, rw * 0.03, s); c.fillRect(cx + rw * 0.26, 0, rw * 0.03, s); }
  const sh = c.createLinearGradient(0, rt, 0, rb); sh.addColorStop(0, 'rgba(0,0,0,0.35)'); sh.addColorStop(0.3, 'rgba(255,255,255,0.08)'); sh.addColorStop(1, 'rgba(0,0,0,0.3)');
  c.fillStyle = sh; c.fillRect(0, 0, s, s);
  c.restore();
  // the clasp
  const cl = c.createLinearGradient(0, rb - s * 0.035, 0, rb + s * 0.035); cl.addColorStop(0, F[0]); cl.addColorStop(0.5, F[1]); cl.addColorStop(1, F[2]);
  c.fillStyle = cl; ptRound(c, cx - rw * 0.34, rb - s * 0.03, rw * 0.68, s * 0.06, s * 0.015); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = Math.max(1, s * 0.008); c.stroke();
  // the disc: a raised rim, then the field, then the picture cut into it
  c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.arc(cx + s * 0.012, cy + s * 0.02, r, 0, TAU); c.fill();
  const g1 = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r); g1.addColorStop(0, F[0]); g1.addColorStop(0.35, F[1]); g1.addColorStop(0.75, F[2]); g1.addColorStop(1, F[3]);
  c.fillStyle = g1; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
  if (once && !dull) { // eight points behind an enamel disc, for the ones earned once
    c.fillStyle = g1; c.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU - Math.PI / 2, rr = i % 2 ? r * 0.9 : r * 1.12; c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = Math.max(1, s * 0.008); c.stroke();
  }
  const g2 = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r); g2.addColorStop(0, F[2]); g2.addColorStop(0.45, F[1]); g2.addColorStop(1, F[0]);
  c.fillStyle = g2; c.beginPath(); c.arc(cx, cy, r * 0.8, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = Math.max(1, s * 0.01); c.beginPath(); c.arc(cx, cy, r * 0.8, 0, TAU); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(cx, cy, r - s * 0.006, Math.PI * 1.05, Math.PI * 1.7); c.stroke();
  // the picture, struck in: a light edge below right, the dark cut above left
  const k = r * 0.5, lw = 0.15;
  c.medalBg = F[1]; // what a hole in the picture (an eye, a bullet's groove) is filled with
  const glyph = (dx, dy, col, a) => { c.save(); c.translate(cx + dx, cy + dy); c.scale(k, k); c.globalAlpha = a; c.strokeStyle = col; c.fillStyle = col; c.lineWidth = lw; try { (MEDAL_ICON[m.icon] || MEDAL_ICON.star)(c); } catch (e) { /* fine */ } c.restore(); };
  glyph(s * 0.008, s * 0.01, F[0], dull ? 0.25 : 0.7);
  glyph(0, 0, F[2], dull ? 0.55 : 0.95);
  if (tier >= 3 && !once) { // a glint on gold
    c.fillStyle = 'rgba(255,255,240,0.9)';
    [[cx - r * 0.62, cy - r * 0.58, 1], [cx + r * 0.7, cy + r * 0.3, 0.6]].forEach(([gx, gy, q]) => { const a = s * 0.05 * q; c.beginPath(); c.moveTo(gx, gy - a); c.lineTo(gx + a * 0.22, gy - a * 0.22); c.lineTo(gx + a, gy); c.lineTo(gx + a * 0.22, gy + a * 0.22); c.lineTo(gx, gy + a); c.lineTo(gx - a * 0.22, gy + a * 0.22); c.lineTo(gx - a, gy); c.lineTo(gx - a * 0.22, gy - a * 0.22); c.closePath(); c.fill(); });
  }
}
// The pictures on the medals, drawn in a box from -1 to 1 with a stroke already set.
const MEDAL_ICON = {
  cross(c) { c.beginPath(); c.arc(0, 0, 0.72, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(0, -1); c.lineTo(0, -0.25); c.moveTo(0, 0.25); c.lineTo(0, 1); c.moveTo(-1, 0); c.lineTo(-0.25, 0); c.moveTo(0.25, 0); c.lineTo(1, 0); c.stroke(); c.beginPath(); c.arc(0, 0, 0.08, 0, TAU); c.fill(); },
  head(c) { c.beginPath(); c.arc(0, -0.35, 0.38, 0, TAU); c.fill(); c.beginPath(); c.moveTo(-0.7, 0.95); c.quadraticCurveTo(-0.7, 0.15, 0, 0.12); c.quadraticCurveTo(0.7, 0.15, 0.7, 0.95); c.closePath(); c.fill(); c.lineWidth = 0.1; c.beginPath(); c.arc(0, -0.35, 0.62, 0, TAU); c.stroke(); },
  reach(c) { c.beginPath(); c.moveTo(-0.95, 0.3); c.lineTo(0.95, 0.3); c.moveTo(0.6, 0); c.lineTo(0.95, 0.3); c.lineTo(0.6, 0.6); c.stroke(); for (let i = 0; i < 5; i++) { const x = -0.8 + i * 0.35; c.beginPath(); c.moveTo(x, 0.3); c.lineTo(x, i % 2 ? 0.1 : -0.05); c.stroke(); } c.beginPath(); c.arc(-0.55, -0.45, 0.22, 0, TAU); c.stroke(); },
  run(c) { c.beginPath(); c.arc(0.2, -0.72, 0.2, 0, TAU); c.fill(); c.beginPath(); c.moveTo(0.1, -0.45); c.lineTo(-0.1, 0.15); c.lineTo(0.35, 0.5); c.lineTo(0.25, 0.95); c.moveTo(-0.1, 0.15); c.lineTo(-0.45, 0.45); c.lineTo(-0.8, 0.4); c.moveTo(0.05, -0.3); c.lineTo(0.5, -0.05); c.lineTo(0.75, -0.25); c.moveTo(0.05, -0.3); c.lineTo(-0.35, -0.2); c.lineTo(-0.55, 0.05); c.stroke(); },
  moon(c) { c.beginPath(); c.arc(0, 0, 0.75, 0.6, TAU - 0.6); c.arc(0.42, -0.1, 0.55, TAU - 1.3, 1.3, true); c.closePath(); c.fill(); c.beginPath(); c.arc(0.55, -0.6, 0.06, 0, TAU); c.arc(0.75, 0.2, 0.05, 0, TAU); c.fill(); },
  bullet(c) { c.beginPath(); c.moveTo(-0.28, 0.9); c.lineTo(-0.28, -0.15); c.quadraticCurveTo(-0.26, -0.75, 0, -0.98); c.quadraticCurveTo(0.26, -0.75, 0.28, -0.15); c.lineTo(0.28, 0.9); c.closePath(); c.fill(); c.fillStyle = c.medalBg; c.fillRect(-0.4, -0.12, 0.8, 0.07); },
  hits(c) { c.beginPath(); c.arc(0, 0, 0.85, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 0, 0.5, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 0, 0.18, 0, TAU); c.fill(); },
  breath(c) { for (let i = 0; i < 3; i++) { const y = -0.55 + i * 0.5; c.beginPath(); c.moveTo(-0.9, y); c.bezierCurveTo(-0.45, y - 0.3, -0.15, y + 0.3, 0.3, y); c.quadraticCurveTo(0.65, y - 0.2, 0.85, y - 0.05); c.stroke(); } },
  ghost(c) { c.beginPath(); c.moveTo(-0.65, 0.9); c.lineTo(-0.65, -0.15); c.arc(0, -0.15, 0.65, Math.PI, 0); c.lineTo(0.65, 0.9); for (let i = 0; i < 3; i++) { const x0 = 0.65 - i * 0.433; c.quadraticCurveTo(x0 - 0.11, 0.6, x0 - 0.216, 0.85); c.quadraticCurveTo(x0 - 0.33, 0.6, x0 - 0.433, 0.9); } c.closePath(); c.fill(); c.fillStyle = c.medalBg; c.beginPath(); c.ellipse(-0.25, -0.15, 0.11, 0.16, 0, 0, TAU); c.moveTo(0.36, -0.15); c.ellipse(0.25, -0.15, 0.11, 0.16, 0, 0, TAU); c.fill(); },
  par(c) { MEDAL_ICON.bullet(c); c.lineWidth = 0.16; c.beginPath(); c.moveTo(0.4, 0.35); c.lineTo(0.6, 0.6); c.lineTo(0.98, 0.05); c.stroke(); },
  clock(c) { c.beginPath(); c.arc(0, 0.08, 0.78, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(0, 0.08); c.lineTo(0, -0.42); c.moveTo(0, 0.08); c.lineTo(0.35, 0.3); c.moveTo(-0.2, -0.95); c.lineTo(0.2, -0.95); c.stroke(); },
  dice(c) { ptRound(c, -0.75, -0.75, 1.5, 1.5, 0.28); c.stroke(); [[-0.38, -0.38], [0.38, 0.38], [0, 0], [0.38, -0.38], [-0.38, 0.38]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 0.13, 0, TAU); c.fill(); }); },
  blast(c) { c.beginPath(); for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU, rr = i % 2 ? 0.42 : 0.95 - (i % 4) * 0.08; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill(); },
  two(c) { [-0.42, 0.42].forEach((x) => { c.beginPath(); c.arc(x, -0.4, 0.24, 0, TAU); c.fill(); c.beginPath(); c.moveTo(x - 0.4, 0.8); c.quadraticCurveTo(x - 0.4, -0.08, x, -0.1); c.quadraticCurveTo(x + 0.4, -0.08, x + 0.4, 0.8); c.closePath(); c.fill(); }); c.lineWidth = 0.1; c.beginPath(); c.moveTo(-1, -0.35); c.lineTo(1, -0.45); c.stroke(); },
  file(c) { c.beginPath(); c.moveTo(-0.85, -0.55); c.lineTo(-0.3, -0.55); c.lineTo(-0.15, -0.72); c.lineTo(0.85, -0.72); c.lineTo(0.85, 0.75); c.lineTo(-0.85, 0.75); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(-0.5, -0.1); c.lineTo(0.5, -0.1); c.moveTo(-0.5, 0.25); c.lineTo(0.3, 0.25); c.stroke(); },
  star(c) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2, rr = i % 2 ? 0.4 : 0.95; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill(); },
  flag(c) { c.beginPath(); c.moveTo(-0.6, 0.95); c.lineTo(-0.6, -0.9); c.stroke(); c.beginPath(); c.moveTo(-0.6, -0.85); c.quadraticCurveTo(-0.1, -1.05, 0.2, -0.75); c.quadraticCurveTo(0.5, -0.5, 0.85, -0.7); c.lineTo(0.85, 0.05); c.quadraticCurveTo(0.5, 0.25, 0.2, 0); c.quadraticCurveTo(-0.1, -0.25, -0.6, -0.05); c.closePath(); c.fill(); },
  book(c) { c.beginPath(); c.moveTo(0, -0.55); c.quadraticCurveTo(-0.45, -0.8, -0.95, -0.6); c.lineTo(-0.95, 0.7); c.quadraticCurveTo(-0.45, 0.5, 0, 0.75); c.quadraticCurveTo(0.45, 0.5, 0.95, 0.7); c.lineTo(0.95, -0.6); c.quadraticCurveTo(0.45, -0.8, 0, -0.55); c.lineTo(0, 0.75); c.stroke(); },
  fork(c) { c.beginPath(); c.moveTo(0, 0.95); c.lineTo(0, 0.1); c.quadraticCurveTo(0, -0.3, -0.6, -0.55); c.moveTo(0, 0.1); c.quadraticCurveTo(0, -0.3, 0.6, -0.55); c.stroke(); c.beginPath(); c.moveTo(-0.85, -0.75); c.lineTo(-0.4, -0.85); c.lineTo(-0.6, -0.45); c.closePath(); c.moveTo(0.85, -0.75); c.lineTo(0.4, -0.85); c.lineTo(0.6, -0.45); c.closePath(); c.fill(); },
  end(c) { c.beginPath(); c.arc(0, 0.25, 0.55, Math.PI, 0); c.closePath(); c.fill(); c.beginPath(); c.moveTo(-0.95, 0.4); c.lineTo(0.95, 0.4); c.moveTo(-0.6, 0.7); c.lineTo(0.6, 0.7); c.stroke(); for (let i = 0; i < 5; i++) { const a = Math.PI + (i + 0.5) * (Math.PI / 5); c.beginPath(); c.moveTo(Math.cos(a) * 0.7, 0.25 + Math.sin(a) * 0.7); c.lineTo(Math.cos(a) * 0.92, 0.25 + Math.sin(a) * 0.92); c.stroke(); } },
  sun(c) { c.beginPath(); c.arc(0, 0, 0.42, 0, TAU); c.fill(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; c.beginPath(); c.moveTo(Math.cos(a) * 0.62, Math.sin(a) * 0.62); c.lineTo(Math.cos(a) * 0.92, Math.sin(a) * 0.92); c.stroke(); } },
  chev(c) { c.lineWidth = 0.2; for (let i = 0; i < 3; i++) { const y = -0.55 + i * 0.45; c.beginPath(); c.moveTo(-0.75, y + 0.3); c.lineTo(0, y - 0.1); c.lineTo(0.75, y + 0.3); c.stroke(); } },
  rifle(c) { c.save(); c.rotate(-0.35); c.beginPath(); c.moveTo(-1, 0.18); c.lineTo(-0.35, 0.05); c.lineTo(-0.25, -0.1); c.lineTo(1, -0.1); c.lineTo(1, 0); c.lineTo(0, 0.05); c.lineTo(-0.1, 0.3); c.lineTo(-0.3, 0.3); c.lineTo(-0.35, 0.2); c.lineTo(-1, 0.45); c.closePath(); c.fill(); c.fillRect(-0.15, -0.32, 0.5, 0.14); c.restore(); },
  gem(c) { c.beginPath(); c.moveTo(-0.55, -0.6); c.lineTo(0.55, -0.6); c.lineTo(0.9, -0.15); c.lineTo(0, 0.9); c.lineTo(-0.9, -0.15); c.closePath(); c.stroke(); c.lineWidth = 0.08; c.beginPath(); c.moveTo(-0.9, -0.15); c.lineTo(0.9, -0.15); c.moveTo(-0.2, -0.6); c.lineTo(-0.35, -0.15); c.lineTo(0, 0.9); c.lineTo(0.35, -0.15); c.lineTo(0.2, -0.6); c.stroke(); },
  box(c) { c.beginPath(); c.moveTo(0, -0.85); c.lineTo(0.85, -0.4); c.lineTo(0.85, 0.5); c.lineTo(0, 0.95); c.lineTo(-0.85, 0.5); c.lineTo(-0.85, -0.4); c.closePath(); c.moveTo(-0.85, -0.4); c.lineTo(0, 0.05); c.lineTo(0.85, -0.4); c.moveTo(0, 0.05); c.lineTo(0, 0.95); c.stroke(); },
  // two branches of leaves round a small star
  wreath(c) {
    for (const sd of [-1, 1]) {
      c.beginPath(); for (let i = 0; i <= 12; i++) { const a = Math.PI / 2 - sd * (0.3 + i * 0.17); c.lineTo(Math.cos(a) * 0.82, 0.05 + Math.sin(a) * 0.82); } c.stroke();
      for (let i = 1; i < 6; i++) { const a = Math.PI / 2 - sd * (0.3 + i * 0.38); c.beginPath(); c.ellipse(Math.cos(a) * 0.82, 0.05 + Math.sin(a) * 0.82, 0.09, 0.2, a, 0, TAU); c.fill(); }
    }
    c.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2, rr = i % 2 ? 0.18 : 0.44; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr - 0.05); } c.closePath(); c.fill();
  },
  plate(c) { c.beginPath(); c.arc(0, -0.25, 0.6, 0, TAU); c.fill(); c.fillRect(-0.08, 0.3, 0.16, 0.65); c.fillRect(-0.55, 0.85, 1.1, 0.12); c.fillStyle = c.medalBg; c.beginPath(); c.arc(0.12, -0.3, 0.13, 0, TAU); c.fill(); },
  glass(c) { c.strokeRect(-0.75, -0.85, 1.5, 1.7); c.lineWidth = 0.08; c.beginPath(); c.moveTo(0.1, -0.1); c.lineTo(-0.75, -0.4); c.moveTo(0.1, -0.1); c.lineTo(-0.3, -0.85); c.moveTo(0.1, -0.1); c.lineTo(0.75, -0.55); c.moveTo(0.1, -0.1); c.lineTo(0.45, 0.85); c.moveTo(0.1, -0.1); c.lineTo(-0.75, 0.5); c.stroke(); },
  duck(c) { c.beginPath(); c.ellipse(-0.1, 0.35, 0.75, 0.45, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(0.35, -0.35, 0.36, 0, TAU); c.fill(); c.beginPath(); c.moveTo(0.65, -0.4); c.lineTo(1, -0.28); c.lineTo(0.65, -0.18); c.closePath(); c.fill(); },
  brass(c) { [-0.5, 0, 0.5].forEach((x, i) => { c.save(); c.translate(x, 0.1 - (i % 2) * 0.15); c.rotate((i - 1) * 0.3); c.fillRect(-0.15, -0.55, 0.3, 1.15); c.fillRect(-0.19, 0.55, 0.38, 0.08); c.restore(); }); },
};
