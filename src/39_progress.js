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
  if (!d.stats.guns[id]) d.stats.guns[id] = { kills: 0, heads: 0, shots: 0, longest: 0 };
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
  if (CB.debug) return true;
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
  }
  const rank0 = rankOf(d.xp).n;
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
    rec.done = true; rec.stars = Math.max(rec.stars, res.stars);
    if (!rec.best || res.stars > rec.best.stars || (res.stars === rec.best.stars && res.time < rec.best.time)) rec.best = { stars: res.stars, time: Math.round(res.time * 10) / 10, shots: res.shots, gun: info && info.gun };
    if (res.outcome && res.outcome.set) { Object.assign(d.flags, res.outcome.set); rec.outcome = res.outcome.id; }
    if (!wasDone && Progress.chapterDone(M.ch)) { out.chapterDone = true; add('Chapter complete', 600 * M.ch, 150 * M.ch); out.caches.push('sealed'); }
    if (out.chapterDone && M.ch === 2 && !d.scopes.ranger) { // the mountains need a scope with marks on it
      d.scopes.ranger = 1; out.unlocked.push({ kind: 'scope', id: 'ranger', text: 'Ranger 4-12x Mil-Dot scope, a gift from Pip' });
      Object.keys(d.guns).forEach((gid) => { const c = d.guns[gid].cfg; if (c.scope === 'hunter' && scopeFits(SCOPE_BY_ID.ranger, GUN_BY_ID[gid])) c.scope = 'ranger'; });
    }
    if (M.id === 'c4m6' && Progress.grantGun('stormglass')) out.unlocked.push({ kind: 'gun', id: 'stormglass', text: 'Stormglass X1 prototype' });
    const last = MISSIONS[MISSIONS.length - 1];
    if (M.id === last.id) { out.storyEnd = true; d.seen.ending = (d.seen.ending || 0) + 1; if (Progress.grantSkin('harrow')) out.unlocked.push({ kind: 'skin', id: 'harrow', text: 'Skin: Harrow Ridge' }); }
    d.stats.kills += res.kills.filter((k) => k.how === 'shot').length; d.stats.heads += res.stats.heads; d.stats.longest = Math.max(d.stats.longest, Math.round(res.stats.longest));
  }
  // the duck counts even on a failed run: you found it
  if (res.stats && res.stats.duck && !d.ducks[M.id]) {
    d.ducks[M.id] = 1; out.duckNew = true; out.cr += 150; out.lines.push({ label: 'Rubber duck', cr: 150, xp: 0 });
    const n = Object.keys(d.ducks).length;
    if (DUCK_MILESTONES.indexOf(n) >= 0) { out.caches.push('sealed'); out.lines.push({ label: n + ' ducks found', cr: 0, xp: 0, note: 'Sealed cache' }); }
    if (n >= MISSIONS.length && Progress.grantSkin('duckie')) out.unlocked.push({ kind: 'skin', id: 'duckie', text: 'Skin: Bath Time' });
  }
  d.credits += out.cr; d.xp += out.xp;
  const rank1 = rankOf(d.xp);
  if (rank1.n > rank0) { out.rankUp = rank1; for (let i = rank0; i < rank1.n; i++) out.caches.push('sealed'); }
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
  Save.write();
  return { tier, skin, dupe, cr };
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
  const d = Save.data, rank = rankOf(d.xp).n;
  const item = kind === 'gun' ? GUN_BY_ID[id] : kind === 'scope' ? SCOPE_BY_ID[id] : PART_BY_ID[id];
  if (!item) return 'Unknown item.';
  if (item.special) return 'This one cannot be bought.';
  if (rank < item.rank) return 'Needs rank ' + item.rank + ' (' + RANKS[item.rank - 1].name + ').';
  if (d.credits < item.price) return 'Not enough credits.';
  d.credits -= item.price;
  if (kind === 'gun') Progress.grantGun(id); else if (kind === 'scope') d.scopes[id] = 1; else d.parts[id] = 1;
  Save.write();
  return null;
};
