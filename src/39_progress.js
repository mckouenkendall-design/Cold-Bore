// ---------------------------------------------------------------------------
// Progress and rewards. Everything is earned by playing: credits, rank,
// rifles, parts, skins. There is nothing to buy with real money anywhere.
// ---------------------------------------------------------------------------
// Skins that never come out of a cache. Each one is a trophy.
[
  { id: 'duckie', name: 'Bath Time', r: 4, ex: 'Find every hidden rubber duck', furn: '#f7d038', metal: '#f08a24', acc: '#1b1b1b', shimmer: '#fffbd0' },
  { id: 'ghost', name: 'Brickworks Ghost', r: 4, ex: 'Earn three stars on every mission', furn: { grad: ['#cfd8e2', '#8fa0b4', '#e8eef5'] }, metal: { grad: ['#5d6a7a', '#aab8c8', '#4a5462'] }, acc: '#3a424e', line: 'rgba(255,255,255,0.35)', shimmer: '#ffffff' },
  { id: 'brass', name: 'Marksman\'s Brass', r: 4, ex: 'Complete every mission challenge', furn: { pat: 'wood', a: '#2a1a10', b: '#120a05' }, metal: { grad: ['#f3d47a', '#b88a2a', '#7a5a14', '#e6c25a'] }, acc: { grad: ['#b88a2a', '#f3d47a'] }, line: '#4a3408', shimmer: '#fff3c4' },
  { id: 'harrow', name: 'Harrow Ridge', r: 4, ex: 'Finish the story', furn: { pat: 'camo', cols: ['#f4f7fa', '#d9e2ea', '#b7c4d0', '#ffffff'] }, metal: '#c8372d', acc: '#2a2e36', shimmer: '#ffffff' },
  { id: 'kestrelr', name: 'Kestrel', r: 4, ex: 'Reach rank 60', furn: { grad: ['#2a1a10', '#6a3a1a', '#c9773a'] }, metal: { grad: ['#3a3f47', '#c9ced6', '#2a2e36'] }, acc: '#ffaa3c', line: 'rgba(255,190,110,0.5)', shimmer: '#ffd9a0' },
].forEach((s) => { SKINS.push(s); SKIN_BY_ID[s.id] = s; });

// Chance in a hundred of each rarity (Common to Legendary) per kind of cache.
// Field and sealed caches are earned by playing. Any kind can also be bought with
// credits earned in missions; the vault cache is only sold, and is how a full
// collection gets finished. There is no real money anywhere in this game.
const CACHE_ODDS = { field: [50, 30, 14, 5, 1], sealed: [14, 30, 32, 17, 7], vault: [0, 8, 32, 38, 22] };
const CACHE_PRICE = { field: 1500, sealed: 4500, vault: 9000 };
const CACHE_NAME = { field: 'Field cache', sealed: 'Sealed cache', vault: 'Vault cache' };
const DUPE_CR = [120, 260, 650, 1600, 4200];
const DUCK_MILESTONES = [5, 10, 20, 30];

const Progress = CB.Progress = {};

// ---- looks earned along the way (for looks only: nothing here changes how a rifle shoots) ----
// Calling cards: the banner behind your name on the title screen, the results and the dossier.
// Each is drawn in code (CB.callingCard in 45_ui_art.js).
const COS_CARDS = [
  { id: 'plain', name: 'Field Grey', how: 'Yours from the start' },
  { id: 'brickworks', name: 'Brickworks Rain', how: 'Rank 4' },
  { id: 'harbour', name: 'Harbour Lights', how: 'Rank 8' },
  { id: 'ashlock', name: 'Ashlock Peaks', how: 'Rank 13' },
  { id: 'towers', name: 'Glass Towers', how: 'Rank 17' },
  { id: 'ridge', name: 'Harrow Snow', how: 'Rank 22' },
  { id: 'moon', name: 'Night Glass', how: 'Rank 28' },
  { id: 'kestrel', name: 'Hover', how: 'Rank 33' },
  { id: 'storm', name: 'Storm Front', how: 'Rank 38' },
  { id: 'brass', name: 'Spent Brass', how: 'Rank 43' },
  { id: 'coil', name: 'Coil Gun', how: 'Rank 48' },
  { id: 'aurora', name: 'Northern Light', how: 'Rank 53' },
  { id: 'coldbore', name: 'One Round', how: 'Rank 60' },
  { id: 'duck', name: 'Bath Time', how: 'Medal: find 20 rubber ducks' },
  { id: 'ghostcard', name: 'Nobody Heard', how: 'Medal: Ghost, ten times' },
  { id: 'kilometre', name: 'One Kilometre', how: 'Medal: a kill past 1,000 m' },
  { id: 'prestige', name: 'Second Run', how: 'Start the rank track again' },
  { id: 'shelfmap', name: 'Port Calder Map', how: 'Pip\'s shelf' },
  { id: 'shelfneon', name: 'Neon Rain', how: 'Pip\'s shelf' },
  { id: 'shelfsunset', name: 'Last Ferry', how: 'Pip\'s shelf' },
];
const COS_CARD_BY_ID = {}; COS_CARDS.forEach((c) => { COS_CARD_BY_ID[c.id] = c; });
// Reticle tints: the colour of the marks in your scope glass.
const COS_TINTS = [
  { id: 'black', name: 'Black', col: 'rgba(6,7,9,0.94)', sw: '#0b0d10', how: 'Yours from the start' },
  { id: 'amber', name: 'Amber', col: 'rgba(255,176,64,0.95)', sw: '#ffb040', how: 'Rank 5' },
  { id: 'red', name: 'Red', col: 'rgba(240,58,46,0.95)', sw: '#f03a2e', how: 'Rank 11' },
  { id: 'green', name: 'Green', col: 'rgba(80,226,120,0.95)', sw: '#50e278', how: 'Rank 20' },
  { id: 'white', name: 'White', col: 'rgba(245,248,252,0.95)', sw: '#f5f8fc', how: 'Rank 26' },
  { id: 'cyan', name: 'Ice', col: 'rgba(110,220,255,0.95)', sw: '#6edcff', how: 'Rank 32' },
  { id: 'violet', name: 'Violet', col: 'rgba(200,140,255,0.95)', sw: '#c88cff', how: 'Rank 42' },
  { id: 'gold', name: 'Gold', col: 'rgba(255,214,110,0.97)', sw: '#ffd66e', how: 'Rank 52' },
  { id: 'rose', name: 'Rose', col: 'rgba(255,128,170,0.95)', sw: '#ff80aa', how: 'Pip\'s shelf' },
  { id: 'lime', name: 'Lime', col: 'rgba(200,255,80,0.95)', sw: '#c8ff50', how: 'Pip\'s shelf' },
];
const COS_TINT_BY_ID = {}; COS_TINTS.forEach((c) => { COS_TINT_BY_ID[c.id] = c; });
// The colour the scope's marks are drawn in, for the picture code (null means the usual black).
CB.reticleInk = function () { const d = Save.data, t = d && d.cos && COS_TINT_BY_ID[d.cos.tint]; return t && t.id !== 'black' ? t.col : null; };

// ---- the rank track ----
// What each rank hands you. The ten clearance ranks keep the sealed cache they always paid; every
// fifth rank past Cold Bore pays a vault cache; looks come at fixed ranks; the rest alternate a
// field cache and credits. After a prestige, looks you already have are paid as credits instead.
const RANK_CARD = { 4: 'brickworks', 8: 'harbour', 13: 'ashlock', 17: 'towers', 22: 'ridge', 28: 'moon', 33: 'kestrel', 38: 'storm', 43: 'brass', 48: 'coil', 53: 'aurora', 60: 'coldbore' };
const RANK_TINT = { 5: 'amber', 11: 'red', 20: 'green', 26: 'white', 32: 'cyan', 42: 'violet', 52: 'gold' };
function rankReward(n, prestige) {
  const r = RANKS[n - 1]; if (!r || n < 2) return null;
  if (n === 60) return prestige ? { k: 'cache', tier: 'vault', text: 'Vault cache' } : { k: 'card', id: 'coldbore', text: 'Calling card: One Round, and the Kestrel trophy skin' };
  if (r.gate) return { k: 'cache', tier: 'sealed', text: 'Sealed cache' };
  if (n > 27 && n % 5 === 0) return { k: 'cache', tier: 'vault', text: 'Vault cache' };
  if (RANK_CARD[n] && !prestige) return { k: 'card', id: RANK_CARD[n], text: 'Calling card: ' + COS_CARD_BY_ID[RANK_CARD[n]].name };
  if (RANK_TINT[n] && !prestige) return { k: 'tint', id: RANK_TINT[n], text: 'Reticle tint: ' + COS_TINT_BY_ID[RANK_TINT[n]].name };
  if (n % 2) return { k: 'cache', tier: 'field', text: 'Field cache' };
  const cr = Math.round((150 + n * 25) / 50) * 50;
  return { k: 'cr', cr, text: fmtCr(cr) + ' credits' };
}
// The rank you see: counted from your last prestige.
Progress.rankXp = function () { const d = Save.data; return Math.max(0, (d.xp || 0) - (d.prestigeXp || 0)); };
Progress.rankNow = function () { return rankOf(Progress.rankXp()); };
Progress.rankNext = function () { return nextRank(Progress.rankXp()); };
// Hand over one rank's reward. Returns what it was, for the screen that shows it.
Progress.payRank = function (n, out) {
  const d = Save.data, w = rankReward(n, d.prestige || 0); if (!w) return null;
  if (w.k === 'cache') (out ? out.caches : d.caches).push(w.tier);
  else if (w.k === 'cr') { d.credits += w.cr; if (out) out.rankCr = (out.rankCr || 0) + w.cr; }
  else if (w.k === 'card') { d.cos.cards[w.id] = 1; if (n === 60) Progress.grantSkin('kestrelr'); }
  else if (w.k === 'tint') d.cos.tints[w.id] = 1;
  d.rankPaid = Math.max(d.rankPaid || 1, n);
  return w;
};
// What a new rank opens in the shop: rifles, scopes and parts whose clearance is that rank.
Progress.opensAt = function (n) {
  const r = RANKS[n - 1]; if (!r || !r.gate) return { guns: [], scopes: [], parts: [] };
  const at = (it) => !it.special && (it.rank || 1) === r.gate && r.gate > 1;
  return { guns: GUNS.filter(at), scopes: SCOPES.filter((s) => at(s) && s.price > 0), parts: PARTS.filter((p) => at(p) && p.price > 0) };
};
// Start the rank track again from rank 1: everything you own stays, the shop stays open, and the
// insignia gains a star. Only at rank 60.
Progress.canPrestige = function () { return Progress.rankNow().n >= RANKS.length; };
Progress.prestige = function () {
  const d = Save.data; if (!Progress.canPrestige()) return false;
  d.prestige = (d.prestige || 0) + 1; d.prestigeXp = d.xp; d.rankPaid = 1; d.cos.cards.prestige = 1;
  Save.write(); return true;
};

// One mission's record. c3paid and chPaid say whether the three-star cache and the challenge cache
// have been handed out: a guided run can earn the stars and the challenge but not their caches, so
// those stay to be earned on a run without the guide. Saves from before guided runs paid a cache
// the moment a mission reached three stars or its challenge was done, so those count as paid.
Progress.rec = function (id) {
  const m = Save.data.missions; if (!m[id]) m[id] = { done: false, stars: 0, ch: false, plays: 0, best: null, c3paid: false, chPaid: false };
  const r = m[id];
  if (r.c3paid === undefined) r.c3paid = r.stars >= 3;
  if (r.chPaid === undefined) r.chPaid = !!r.ch;
  return r;
};
// Kills, headshots, shots and the longest kill for each rifle. The gun room uses them to pick the
// rifle that goes in the glass case.
Progress.gunStats = function (id) {
  const d = Save.data; if (!d.stats.guns) d.stats.guns = {};
  if (!d.stats.guns[id]) d.stats.guns[id] = { kills: 0, heads: 0, shots: 0, longest: 0, wins: 0 };
  if (d.stats.guns[id].wins === undefined) d.stats.guns[id].wins = 0;
  return d.stats.guns[id];
};
// The rifle with the most kills. Before any kill has been recorded, the one you carry.
Progress.favourite = function () {
  const d = Save.data, G = d.stats.guns || {};
  let best = null, n = 0;
  Object.keys(d.guns).forEach((id) => { const k = (G[id] && G[id].kills) || 0; if (k > n || (k === n && k > 0 && id === d.equipped)) { best = id; n = k; } });
  return best || (d.guns[d.equipped] ? d.equipped : Object.keys(d.guns)[0]);
};
Progress.missionOpen = function (M) {
  if (CB.debug || Save.data.tester) return true; // tester mode (temporary): every contract open
  const i = MISSIONS.indexOf(M);
  if (i <= 0) return true;
  // a contract already finished stays open, even if a newer one has since been slotted in before it
  return !!Progress.rec(MISSIONS[i - 1].id).done || !!(Save.data.missions[M.id] && Save.data.missions[M.id].done);
};
Progress.chapterOpen = function (n) { const first = MISSIONS.find((m) => m.ch === n); return !!first && Progress.missionOpen(first); };
Progress.chapterDone = function (n) { return MISSIONS.filter((m) => m.ch === n).every((m) => Progress.rec(m.id).done); };
Progress.totals = function () {
  const d = Save.data; let stars = 0, done = 0, ch = 0;
  MISSIONS.forEach((m) => { const r = d.missions[m.id]; if (r) { stars += r.stars; if (r.done) done++; if (r.ch) ch++; } });
  const ducks = Object.keys(d.ducks).length;
  const pool = SKINS.filter((s) => s.id !== 'factory');
  return { stars, starsMax: MISSIONS.length * 3, done, missions: MISSIONS.length, ch, ducks, guns: Object.keys(d.guns).length, gunsMax: GUNS.length,
    skins: pool.filter((s) => d.skins[s.id]).length, skinsMax: pool.length,
    parts: PARTS.filter((p) => p.price > 0 && d.parts[p.id]).length + SCOPES.filter((s) => s.price > 0 && d.scopes[s.id]).length, partsMax: PARTS.filter((p) => p.price > 0).length + SCOPES.filter((s) => s.price > 0).length };
};

Progress.grantGun = function (id) {
  const d = Save.data; if (d.guns[id]) return false;
  d.guns[id] = { cfg: defaultConfig(id) };
  const sc = SCOPE_BY_ID[GUN_BY_ID[id].scope]; if (sc && !sc.only) d.scopes[sc.id] = 1;
  return true;
};
Progress.grantSkin = function (id) { const d = Save.data; if (d.skins[id]) return false; d.skins[id] = 1; return true; };

// Work out and bank the rewards for a finished mission. Returns a summary
// for the results screen. info: { gun, guided }. A guided run (the coach showed
// every step) still completes the contract and earns stars, credits and xp, but
// not the three-star cache or the challenge cache; those wait for a run of your own.
Progress.apply = function (M, res, info) {
  const d = Save.data, rec = Progress.rec(M.id), guided = !!(info && info.guided);
  const out = { cr: 0, xp: 0, lines: [], caches: [], unlocked: [], rankUp: null, firstClear: false, newStars: 0, chNew: false, duckNew: false, chapterDone: false, storyEnd: false, guided, held: [] };
  rec.plays++; d.stats.plays++; d.stats.shots += res.shots || 0;
  if (M.practice) { Save.write(); return out; }
  // what each rifle has done, win or lose
  if (info && info.gun && GUN_BY_ID[info.gun]) {
    const g = Progress.gunStats(info.gun);
    g.shots += res.shots || 0;
    (res.kills || []).forEach((k) => {
      if (k.how === 'npc') return; // somebody else's doing
      g.kills++;
      if (k.how === 'shot') { if (k.part === 'head') g.heads++; g.longest = Math.max(g.longest, Math.round(k.range || 0)); }
    });
    if (res.win && !guided) g.wins++;
  }
  const rank0 = Progress.rankNow().n;
  // what the records were before this run, for the "new record" badges on the results
  out.xpFrom = Progress.rankXp();
  out.before = { longest: d.stats.longest || 0, time: rec.best ? rec.best.time : null, stars: rec.stars || 0, score: rec.score || 0 };
  if (res.score && res.score.total) { out.scoreNew = res.score.total > (rec.score || 0) && (rec.score || 0) > 0; if (!rec.score || res.score.total > rec.score) rec.score = res.score.total; }
  if (res.win) {
    d.stats.wins++;
    const base = M.reward.cr, bx = M.reward.xp;
    const add = (label, cr, xp) => { cr = Math.round(cr); xp = Math.round(xp || 0); if (!cr && !xp) return; out.cr += cr; out.xp += xp; out.lines.push({ label, cr, xp }); };
    if (!rec.done) { out.firstClear = true; add('Contract fee', base, bx); } else add('Repeat fee', base * 0.2, bx * 0.1);
    const ns = Math.max(0, res.stars - Math.max(1, rec.stars));
    if (ns > 0) { out.newStars = ns; add(ns === 2 ? 'Clean and precise' : (res.stars === 3 && rec.stars === 2 ? 'Third star' : 'Second star'), base * 0.3 * ns, bx * 0.2 * ns); }
    if (res.challenge && !rec.ch) { out.chNew = true; rec.ch = true; add('Challenge', base * 0.5, bx * 0.25); }
    if (res.challenge && !rec.chPaid) { if (guided) out.held.push('challenge'); else { rec.chPaid = true; out.caches.push('field'); } }
    if (res.stars === 3 && !rec.c3paid) { if (guided) out.held.push('stars'); else { rec.c3paid = true; out.caches.push('field'); } }
    if (d.settings.assist === 'veteran') add('Veteran bonus', out.cr * 0.25, 0);
    const wasDone = Progress.chapterDone(M.ch);
    // Contracts added in an update slot in with `follows`. A save that had already finished every
    // original contract in this chapter was paid the chapter bonus then, so finishing the new one
    // completes the chapter again without paying it twice.
    const origDone = MISSIONS.filter((m) => m.ch === M.ch && !m.follows).every((m) => Progress.rec(m.id).done);
    if (!d.chDone) d.chDone = {};
    rec.done = true; rec.stars = Math.max(rec.stars, res.stars);
    if (!rec.best || res.stars > rec.best.stars || (res.stars === rec.best.stars && res.time < rec.best.time)) rec.best = { stars: res.stars, time: Math.round(res.time * 10) / 10, shots: res.shots, gun: info && info.gun };
    if (res.outcome && res.outcome.set) { Object.assign(d.flags, res.outcome.set); rec.outcome = res.outcome.id; }
    // every way each choice has gone, not only the last, for the dossier
    if (res.outcome && res.outcome.id) { if (!d.outcomes) d.outcomes = {}; if (!d.outcomes[M.id]) d.outcomes[M.id] = {}; out.outcomeNew = !d.outcomes[M.id][res.outcome.id]; d.outcomes[M.id][res.outcome.id] = 1; }
    if (!wasDone && Progress.chapterDone(M.ch)) {
      out.chapterDone = true;
      if (!d.chDone[M.ch] && !(origDone && M.follows)) { add('Chapter complete', 600 * M.ch, 150 * M.ch); out.caches.push('sealed'); }
    }
    if (Progress.chapterDone(M.ch)) d.chDone[M.ch] = true;
    if (out.chapterDone && M.ch === 2 && !d.scopes.ranger) { // the mountains need a scope with marks on it
      d.scopes.ranger = 1; out.unlocked.push({ kind: 'scope', id: 'ranger', text: 'Ranger 4-12x Mil-Dot scope, a gift from Pip' });
      Object.keys(d.guns).forEach((gid) => { const c = d.guns[gid].cfg; if (c.scope === 'hunter' && scopeFits(SCOPE_BY_ID.ranger, GUN_BY_ID[gid])) c.scope = 'ranger'; });
    }
    if (M.id === 'c4m6' && Progress.grantGun('stormglass')) out.unlocked.push({ kind: 'gun', id: 'stormglass', text: 'Stormglass X1 prototype' });
    const last = MISSIONS[MISSIONS.length - 1];
    if (M.id === last.id) {
      out.storyEnd = true; d.seen.ending = (d.seen.ending || 0) + 1; if (Progress.grantSkin('harrow')) out.unlocked.push({ kind: 'skin', id: 'harrow', text: 'Skin: Harrow Ridge' });
      const e = epilogue(d.flags); if (!d.endings) d.endings = {}; out.endingNew = !d.endings[e.title]; d.endings[e.title] = 1;
    }
    d.stats.kills += res.kills.filter((k) => k.how === 'shot').length; d.stats.heads += res.stats.heads; d.stats.longest = Math.max(d.stats.longest, Math.round(res.stats.longest));
  }
  // the duck counts even on a failed run: you found it
  if (res.stats && res.stats.duck && !d.ducks[M.id]) {
    d.ducks[M.id] = 1; out.duckNew = true; out.cr += 150; out.lines.push({ label: 'Rubber duck', cr: 150, xp: 0 });
    const n = Object.keys(d.ducks).length;
    if (DUCK_MILESTONES.indexOf(n) >= 0) { out.caches.push('sealed'); out.lines.push({ label: n + ' ducks found', cr: 0, xp: 0, note: 'Sealed cache' }); }
    if (n >= MISSIONS.length && Progress.grantSkin('duckie')) out.unlocked.push({ kind: 'skin', id: 'duckie', text: 'Skin: Bath Time' });
  }
  // rifle mastery (49_mastery.js) and medals (50_medals.js): steps and medals reached on this run
  out.mastery = { ups: [], skins: [] }; out.medals = [];
  if (CB.Mastery && info && info.gun) {
    out.mastery = CB.Mastery.check(info.gun);
    out.mastery.ups.forEach((u) => { if (u.xp) { out.xp += u.xp; out.lines.push({ label: 'Mastery: ' + u.text.replace(/^[^:]*: /, ''), cr: 0, xp: u.xp }); } });
  }
  if (CB.Medals) {
    out.medals = CB.Medals.check(M, res, out, info || {});
    out.medals.forEach((m) => { out.cr += m.cr || 0; out.xp += m.xp || 0; if (m.cache) out.caches.push(m.cache); out.lines.push({ label: 'Medal: ' + m.name + (m.tiers > 1 ? ' ' + ROMAN[m.tier] : ''), cr: m.cr || 0, xp: m.xp || 0, note: m.cache && !m.cr && !m.xp ? CACHE_NAME[m.cache] : '' }); });
  }
  d.credits += out.cr; d.xp += out.xp;
  // the rank track: every rank passed hands over its reward (once per run through the track)
  const rank1 = Progress.rankNow();
  out.rankUps = [];
  if (rank1.n > rank0) {
    out.rankUp = rank1; out.rankFrom = rank0;
    for (let n = rank0 + 1; n <= rank1.n; n++) {
      const opens = Progress.opensAt(n), w = n > (d.rankPaid || 1) ? Progress.payRank(n, out) : null;
      out.rankUps.push({ n, w, opens });
      if (opens.guns.length || opens.parts.length || opens.scopes.length) d.newArmory = true;
    }
  }
  const t = Progress.totals();
  if (t.stars >= t.starsMax && Progress.grantSkin('ghost')) out.unlocked.push({ kind: 'skin', id: 'ghost', text: 'Skin: Brickworks Ghost' });
  if (t.ch >= MISSIONS.length && Progress.grantSkin('brass')) out.unlocked.push({ kind: 'skin', id: 'brass', text: 'Skin: Marksman\'s Brass' });
  out.caches.forEach((c) => d.caches.push(c));
  Save.write();
  return out;
};

// Open one cache. Returns what was inside.
Progress.openCache = function () {
  const d = Save.data; if (!d.caches.length) return null;
  const tier = d.caches.shift(), odds = CACHE_ODDS[tier] || CACHE_ODDS.field;
  let roll = Math.random() * 100, r = 0;
  for (let i = 0; i < odds.length; i++) { if (roll < odds[i]) { r = i; break; } roll -= odds[i]; r = i; }
  const pool = SKINS.filter((s) => s.r === r && !s.ex && s.id !== 'factory');
  const fresh = pool.filter((s) => !d.skins[s.id]);
  // collectors are looked after: a new skin of that rarity if there is one left
  let skin = fresh.length ? fresh[Math.floor(Math.random() * fresh.length)] : pool[Math.floor(Math.random() * pool.length)];
  if (!fresh.length) { // everything of this rarity is owned: try a neighbouring rarity before paying out a duplicate
    for (const rr of [r + 1, r - 1, r + 2, r - 2]) { const alt = SKINS.filter((s) => s.r === rr && !s.ex && s.id !== 'factory' && !d.skins[s.id]); if (alt.length && Math.random() < 0.6) { skin = alt[Math.floor(Math.random() * alt.length)]; break; } }
  }
  const dupe = !!d.skins[skin.id]; let cr = 0;
  if (dupe) { cr = DUPE_CR[skin.r]; d.credits += cr; } else d.skins[skin.id] = 1;
  d.stats.cachesOpened++;
  const sets = dupe ? [] : Progress.checkSets();
  Save.write();
  return { tier, skin, dupe, cr, sets };
};

// ---- skin sets: own every skin in a set and it pays out once ----
const SKIN_SETS = [
  { id: 'workshop', name: 'Pip\'s Workshop', skins: ['matte', 'earth', 'wolf', 'stainless', 'benchworn', 'mint'], cr: 1000, cache: 'field' },
  { id: 'woods', name: 'Woodworker', skins: ['walnut', 'birch', 'maple', 'ebony', 'burl', 'autumn', 'midlam'], cr: 1500, cache: 'sealed' },
  { id: 'camo', name: 'Field Camouflage', skins: ['woodland', 'desert', 'snowcam', 'urban', 'digital', 'splinter', 'fleck', 'terrain'], cr: 2000, cache: 'sealed' },
  { id: 'wild', name: 'Wild Things', skins: ['tiger', 'zebra', 'leopard', 'giraffe', 'koi', 'frog', 'diamond'], cr: 2500, cache: 'sealed' },
  { id: 'city', name: 'Port Calder', skins: ['brick', 'navy', 'graffiti', 'hazard', 'sunset', 'rust'], cr: 3000, cache: 'sealed' },
  { id: 'cloth', name: 'The Tailor', skins: ['bandana', 'plaid', 'hound', 'scalemail', 'cards'], cr: 3000, cache: 'sealed' },
  { id: 'smith', name: 'The Smith\'s Bench', skins: ['damascus', 'casehard', 'pearl', 'verdigris', 'ivory'], cr: 4000, cache: 'vault' },
  { id: 'night', name: 'Night Shift', skins: ['galaxy', 'frost', 'neon', 'oilslick', 'circuit'], cr: 4000, cache: 'vault' },
  { id: 'legends', name: 'Hall of Legends', skins: ['midas', 'kintsugi', 'aurora', 'obsidian', 'blueprint'], cr: 8000, cache: 'vault' },
  { id: 'elements', name: 'The Elements', skins: ['eruption', 'lagoon', 'thunder', 'deepfield', 'livewire'], cr: 8000, cache: 'vault' },
].map((s) => Object.assign(s, { skins: s.skins.filter((id) => SKIN_BY_ID[id]) }));
CB.SKIN_SETS = SKIN_SETS;
Progress.setOf = function (skinId) { return SKIN_SETS.filter((s) => s.skins.indexOf(skinId) >= 0); };
// Pay any set that has just been completed. Returns them (the reward is already in the save).
Progress.checkSets = function () {
  const d = Save.data, out = []; if (!d.sets) d.sets = {};
  SKIN_SETS.forEach((s) => { if (d.sets[s.id] || !s.skins.length || !s.skins.every((id) => d.skins[id])) return; d.sets[s.id] = 1; d.credits += s.cr; if (s.cache) d.caches.push(s.cache); out.push(s); });
  return out;
};

// Buy a cache with credits. Returns null if it worked, or a short reason if not.
Progress.buyCache = function (tier) {
  const d = Save.data, price = CACHE_PRICE[tier];
  if (!price) return 'Unknown cache.';
  if (d.credits < price) return 'Not enough credits.';
  d.credits -= price; d.caches.push(tier); Save.write();
  return null;
};

Progress.buy = function (kind, id) {
  const d = Save.data;
  const item = kind === 'gun' ? GUN_BY_ID[id] : kind === 'scope' ? SCOPE_BY_ID[id] : PART_BY_ID[id];
  if (!item) return 'Unknown item.';
  if (item.special) return 'This one cannot be bought.';
  if (!gateOpen(item)) { const g = gateRank(item); return 'Needs rank ' + g.n + ' (' + g.name + ').'; }
  if (d.credits < item.price) return 'Not enough credits.';
  d.credits -= item.price;
  if (kind === 'gun') Progress.grantGun(id); else if (kind === 'scope') d.scopes[id] = 1; else d.parts[id] = 1;
  Save.write();
  return null;
};
