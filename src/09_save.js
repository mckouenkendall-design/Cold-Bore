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
    stats: { shots: 0, kills: 0, heads: 0, longest: 0, plays: 0, wins: 0, cachesOpened: 0 },
    created: Date.now(),
  };
};
Save.load = function () {
  let d = null;
  try { const raw = window.localStorage.getItem(SAVE_KEY); if (raw) d = JSON.parse(raw); } catch (e) { Save.ok = false; }
  const f = Save.fresh();
  if (d && d.v === 1) {
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

// rank from experience
const RANKS = [
  { n: 1, name: 'Cold Hands', xp: 0 }, { n: 2, name: 'Lookout', xp: 400 }, { n: 3, name: 'Marksman', xp: 1100 },
  { n: 4, name: 'Sharpshooter', xp: 2200 }, { n: 5, name: 'Stalker', xp: 3800 }, { n: 6, name: 'Longshot', xp: 5900 },
  { n: 7, name: 'Ghost', xp: 8600 }, { n: 8, name: 'Phantom', xp: 12000 }, { n: 9, name: 'Wraith', xp: 16500 }, { n: 10, name: 'Cold Bore', xp: 22000 },
];
function rankOf(xp) { let r = RANKS[0]; for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].xp) r = RANKS[i]; return r; }
function nextRank(xp) { for (let i = 0; i < RANKS.length; i++) if (xp < RANKS[i].xp) return RANKS[i]; return null; }
