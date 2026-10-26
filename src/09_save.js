// ---------------------------------------------------------------------------
// Progress, saved on this device automatically. If the browser refuses
// storage (private tabs sometimes do) the game still runs; it just forgets
// when the tab closes.
// ---------------------------------------------------------------------------
const SAVE_KEY = 'coldbore.save.v1';
const Save = CB.Save = { data: null, ok: true };

Save.fresh = function () {
  return {
    v: 1, credits: 0, xp: 0, equipped: 'fenwick',
    guns: { fenwick: { cfg: defaultConfig('fenwick') } },
    parts: {}, scopes: { hunter: 1 }, skins: { factory: 1 }, skinSeen: {}, caches: [], scrap: 0,
    missions: {}, flags: {}, seen: {}, ducks: {},
    settings: { sens: 0.6, assist: 'notes', killcam: true, gore: true, music: 0.55, sfx: 0.9, invert: false, lowRes: false },
    stats: { shots: 0, kills: 0, heads: 0, longest: 0, plays: 0, wins: 0, cachesOpened: 0, guns: {} },
    created: Date.now(),
    // the rank track: prestige resets the rank you see (not the xp that opens the shop), rankPaid is
    // the highest rank in this run whose reward has been handed out
    prestige: 0, prestigeXp: 0, rankPaid: 1,
    // looks earned along the way: calling cards (the banner behind your name) and reticle tints
    cos: { cards: { plain: 1 }, card: 'plain', tints: { black: 1 }, tint: 'black' },
    // medals reached (id: tier) and the counters behind the ones no other record keeps (50_medals.js)
    medals: {}, mstat: {}, outcomes: {}, endings: {}, drills: {}, mastery: {}, seenGuns: { fenwick: 1 }, newArmory: false, daily: null, shelf: null, sets: {},
  };
};
Save.load = function () {
  let d = null;
  try { const raw = window.localStorage.getItem(SAVE_KEY); if (raw) d = JSON.parse(raw); } catch (e) { Save.ok = false; }
  const f = Save.fresh();
  if (d && d.v === 1) {
    Save.migrate(d);
    for (const k in f) if (d[k] === undefined) d[k] = f[k];
    for (const k in f.settings) if (d.settings[k] === undefined) d.settings[k] = f.settings[k];
    for (const k in f.stats) if (d.stats[k] === undefined) d.stats[k] = f.stats[k];
    Save.data = d;
    Save.tidy(d);
  } else Save.data = f;
  return Save.data;
};
// Some general parts were later limited to the rifles they suit (no modern brake on the
// eighty-year-old Kessler, for example). A saved rifle still wearing one goes back to the
// factory part in that slot. The part itself stays owned for the rifles it does fit.
Save.tidy = function (d) {
  if (!d || !d.guns) return;
  for (const id in d.guns) {
    const g = GUN_BY_ID[id], rec = d.guns[id];
    if (!g || !rec) continue;
    const def = defaultConfig(id), cfg = rec.cfg = Object.assign({}, def, rec.cfg || {});
    ['muzzle', 'barrel', 'stock', 'support', 'ammo', 'trigger', 'action', 'mag'].forEach((slot) => { if (!partFits(PART_BY_ID[cfg[slot]], g)) cfg[slot] = def[slot]; });
    if (!SCOPE_BY_ID[cfg.scope] || !scopeFits(SCOPE_BY_ID[cfg.scope], g)) cfg.scope = def.scope;
  }
};
// Saves from before the long rank track had ten ranks, each paid with a sealed cache. Their xp is
// kept as it is (it is what opens rifles and parts in the shop, and the same xp opens the same
// things now), they land on the new rank that xp is worth, and the rewards on the track up to
// there count as handed out, except the looks (calling cards, reticle tints), which are given now.
// Rifles they already own count as seen, so the armory does not call them all new.
Save.migrate = function (d) {
  if (d.rankPaid === undefined) {
    const n = rankOf(d.xp || 0).n;
    d.rankPaid = n;
    d.cos = d.cos || { cards: { plain: 1 }, card: 'plain', tints: { black: 1 }, tint: 'black' };
    if (typeof rankReward === 'function') for (let r = 2; r <= n; r++) { const w = rankReward(r, 0); if (w && (w.k === 'card' || w.k === 'tint')) d.cos[w.k === 'card' ? 'cards' : 'tints'][w.id] = 1; }
  }
  if (!d.seenGuns) { d.seenGuns = {}; GUNS.forEach((g) => { if (d.guns && d.guns[g.id] || (d.xp || 0) >= gateRank(g).xp) d.seenGuns[g.id] = 1; }); }
  // older saves kept only the last way each choice went: that one counts as seen
  if (!d.outcomes) { d.outcomes = {}; for (const id in (d.missions || {})) { const o = d.missions[id].outcome; if (o) { d.outcomes[id] = {}; d.outcomes[id][o] = 1; } } }
  if (!d.endings) { d.endings = {}; if (d.seen && d.seen.ending && typeof epilogue === 'function') d.endings[epilogue(d.flags || {}).title] = 1; }
  if (d.cos && !d.cos.tints) d.cos.tints = { black: 1 };
};
Save.write = function () {
  try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(Save.data)); Save.ok = true; } catch (e) { Save.ok = false; }
};
Save.reset = function () { Save.data = Save.fresh(); Save.write(); };
Save.exportText = function () { try { return btoa(unescape(encodeURIComponent(JSON.stringify(Save.data)))); } catch (e) { return ''; } };
Save.importText = function (txt) {
  try { const d = JSON.parse(decodeURIComponent(escape(atob(txt.trim())))); if (d && d.v === 1 && d.guns) { Save.data = d; Save.load.call(null); Save.data = d; const f = Save.fresh(); for (const k in f) if (d[k] === undefined) d[k] = f[k]; Save.write(); return true; } } catch (e) { /* bad text */ }
  return false;
};

// ownership helpers
function ownsPart(id) { const p = PART_BY_ID[id]; return !!p && (p.price === 0 || !!Save.data.parts[id]); }
function ownsScope(id) { const s = SCOPE_BY_ID[id]; return !!s && (!!Save.data.scopes[id] || !!s.only); }
function ownsGun(id) { return !!Save.data.guns[id]; }
function gunCfg(id) { const g = Save.data.guns[id]; return g ? g.cfg : defaultConfig(id); }

// ---- rank from experience ----
// Sixty ranks in fifteen families, each family a few grades (Lookout I, II, III). The shop has ten
// clearances (the `rank` on a rifle, scope or part, 1 to 10): each opens at exactly the xp it always
// did, which is the xp of the rank named after it (clearance 5, Stalker, opens at Stalker I).
// A first run through the story earns enough for about rank 45; the rest comes from replays,
// medals and rifle mastery. At 60 you can start the track again (prestige) and keep everything.
const RANK_FAMILIES = [
  // [name, grades, clearance it opens or 0]
  ['Cold Hands', 2, 1], ['Lookout', 3, 2], ['Marksman', 3, 3], ['Sharpshooter', 3, 4], ['Stalker', 3, 5], ['Longshot', 3, 6],
  ['Ghost', 3, 7], ['Phantom', 3, 8], ['Wraith', 3, 9], ['Cold Bore', 4, 10], ['Windreader', 5, 0], ['Long Shadow', 5, 0],
  ['Ridgeline', 5, 0], ['Harrow', 5, 0], ['Stormglass', 5, 0], ['Last Light', 4, 0], ['Kestrel', 1, 0],
];
// the xp each clearance has always opened at (ranks 1 to 10 before the long track)
const CLEARANCE_XP = [0, 0, 400, 1100, 2200, 3800, 5900, 8600, 12000, 16500, 22000];
const RANKS = (function () {
  const out = [], ROM = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  let n = 0;
  RANK_FAMILIES.forEach(([name, grades, gate], fi) => {
    for (let g = 1; g <= grades; g++) { n++; out.push({ n, family: name, fam: fi, grade: g, grades, name: grades > 1 ? name + ' ' + ROM[g] : name, gate: g === 1 ? gate : 0, xp: 0 }); }
  });
  // xp: each family's first grade sits on its clearance; grades in between are spread evenly; past
  // Cold Bore (22,000) every rank costs a little more than the one before
  out.forEach((r) => { if (r.gate) r.xp = CLEARANCE_XP[r.gate]; });
  for (let i = 0; i < out.length; i++) {
    const r = out[i];
    if (r.gate) continue;
    if (r.n === 2) { r.xp = 250; continue; }
    if (r.fam < 9) { // between two clearances
      const a = out.filter((q) => q.fam === r.fam && q.gate)[0], b = out.find((q) => q.fam === r.fam + 1 && q.gate);
      r.xp = Math.round((a.xp + ((b.xp - a.xp) * (r.grade - 1)) / a.grades) / 50) * 50;
    } else r.xp = Math.round((out[i - 1].xp + 1000 + (r.n - 27) * 40) / 50) * 50;
  }
  return out;
})();
const RANK_BY_GATE = {}; RANKS.forEach((r) => { if (r.gate) RANK_BY_GATE[r.gate] = r; });
function rankOf(xp) { let r = RANKS[0]; for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].xp) r = RANKS[i]; return r; }
function nextRank(xp) { for (let i = 0; i < RANKS.length; i++) if (xp < RANKS[i].xp) return RANKS[i]; return null; }
// The rank a rifle, scope or part asks for (its clearance), and whether your xp has opened it.
// Clearance always counts all the xp you have ever earned, so a prestige never locks the shop again.
function gateRank(item) { return RANK_BY_GATE[Math.max(1, Math.min(10, (item && item.rank) || 1))]; }
function gateOpen(item) { return (Save.data.xp || 0) >= gateRank(item).xp; }
