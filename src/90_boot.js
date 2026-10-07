// ---------------------------------------------------------------------------
// Start-up.
// ---------------------------------------------------------------------------
CB.boot = function () {
  Save.load();
  Game.init();
  const q = new URLSearchParams(location.search);
  CB.debug = q.has('debug');
  if (q.has('test')) { Game.noAutoPause = true; }
  if (q.get('m') && MISSION_BY_ID[q.get('m')]) {
    Game.noAutoPause = true;
    const gun = q.get('gun') || 'fenwick';
    Game.start(q.get('m'), { gun, cfg: defaultConfig(gun), vantage: +(q.get('v') || 0), shotSeed: 1 });
  } else if (UI.boot) UI.boot();
};
window.CB = CB;
CB.Game = Game; CB.Save = Save; CB.MISSION_BY_ID = MISSION_BY_ID; CB.buildStats = buildStats; CB.defaultConfig = defaultConfig; CB.gunAllowed = gunAllowed; CB.Bal = Bal;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', CB.boot); else CB.boot();
