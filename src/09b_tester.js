// ---------------------------------------------------------------------------
// TESTER MODE. Temporary: Kendall asked for it to try everything early, and it
// is to be removed before the game is finished. To remove it: delete this
// file, the "Tester mode" group in UI.settings (42_ui_results.js), the
// `Save.data.tester` line in Progress.missionOpen (39_progress.js) and the
// body.tester rules in style.css.
//
// Switching it on puts the real save aside, untouched, and loads a separate
// tester save in which every rifle, part, scope, skin and contract is open,
// with plenty of credits and a few caches. Switching it off brings the real
// save back exactly as it was. The two never mix, except the settings (sound,
// aiming help and so on), which follow you across so you do not set them twice.
// ---------------------------------------------------------------------------
const Tester = CB.Tester = { on: false, real: null };
const TESTER_KEY = 'coldbore.save.tester.v1', TESTER_MODE_KEY = 'coldbore.tester.on';

// Everything the tester save should have. Run on every load, so anything added
// to the game later turns up in the tester save too.
Tester.grantAll = function (d) {
  GUNS.forEach((g) => { if (!d.guns[g.id]) d.guns[g.id] = { cfg: defaultConfig(g.id) }; });
  PARTS.forEach((p) => { if (p.price > 0) d.parts[p.id] = 1; });
  SCOPES.forEach((s) => { d.scopes[s.id] = 1; });
  if (!d.skinSeen) d.skinSeen = {};
  SKINS.forEach((s) => { d.skins[s.id] = 1; if (!d.testerSeeded) d.skinSeen[s.id] = 1; });
  d.xp = Math.max(d.xp || 0, RANKS[RANKS.length - 1].xp);
  d.credits = Math.max(d.credits || 0, 1000000);
  if (!d.testerSeeded) { d.caches.push('field', 'field', 'sealed', 'sealed', 'vault', 'vault'); d.testerSeeded = 1; }
  d.tester = true;
  return d;
};
// Fill in anything an older tester save is missing, the same way Save.load does for the real one.
function testerFill(d) {
  const f = Save.fresh();
  for (const k in f) if (d[k] === undefined) d[k] = f[k];
  for (const k in f.settings) if (d.settings[k] === undefined) d.settings[k] = f.settings[k];
  for (const k in f.stats) if (d.stats[k] === undefined) d.stats[k] = f.stats[k];
  return d;
}
const testerGet = (k) => { try { return window.localStorage.getItem(k); } catch (e) { return null; } };
const testerSet = (k, v) => { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } };
const copyOf = (o) => JSON.parse(JSON.stringify(o));

// A tester save made from a copy of the real one, so stars, choices and settings look familiar.
Tester.fromReal = function () { return Tester.grantAll(testerFill(copyOf(Tester.real))); };
// carrySettings: when switching on, bring the real save's settings across.
Tester.enter = function (carrySettings) {
  let t = null;
  try { const raw = testerGet(TESTER_KEY); if (raw) t = JSON.parse(raw); } catch (e) { t = null; }
  t = t && t.v === 1 ? Tester.grantAll(testerFill(t)) : Tester.fromReal();
  if (carrySettings) Object.assign(t.settings, Tester.real.settings);
  Save.data = t; Tester.on = true;
  document.body.classList.add('tester');
};

const realLoad = Save.load, realWrite = Save.write, realReset = Save.reset;
Save.load = function () {
  realLoad();
  Tester.real = Save.data; Tester.on = false;
  document.body.classList.remove('tester');
  if (testerGet(TESTER_MODE_KEY) === '1') Tester.enter();
  return Save.data;
};
Save.write = function () {
  if (!Tester.on) return realWrite();
  Save.ok = testerSet(TESTER_KEY, JSON.stringify(Save.data));
};
// "Erase everything" in tester mode starts the tester save again; the real save is not touched.
Save.reset = function () { if (Tester.on) Tester.restart(); else realReset(); };

// Switch tester mode on or off. Returns nothing; the caller redraws the screen.
Tester.set = function (on) {
  if (on && !Tester.on) {
    realWrite();
    Tester.real = Save.data;
    testerSet(TESTER_MODE_KEY, '1');
    Tester.enter(true);
    Save.write();
  } else if (!on && Tester.on) {
    Save.write();
    const settings = Object.assign({}, Save.data.settings);
    Tester.on = false;
    testerSet(TESTER_MODE_KEY, '0');
    document.body.classList.remove('tester');
    // read the real save back from storage; if storage is refused, use the copy held in memory
    const keep = Tester.real;
    if (testerGet(SAVE_KEY) !== null || !keep) realLoad(); else Save.data = keep;
    Tester.real = Save.data;
    Save.data.settings = Object.assign(Save.data.settings, settings);
    realWrite();
  }
};
// Throw the tester save away and make a new one from the real save as it is now.
Tester.restart = function () {
  if (!Tester.on) return;
  const settings = Object.assign({}, Save.data.settings);
  Save.data = Tester.fromReal();
  Object.assign(Save.data.settings, settings);
  Save.write();
};
