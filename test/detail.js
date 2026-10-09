// Pictures of the scenery for checking art detail, on a phone held sideways (844 x 390 at 2x).
// The in-mission display is hidden so only the scope picture is seen.
// usage: node test/detail.js <page.html> <outPrefix> "<mission>@<seconds>@<target>@<zoom>[@vantage],..."
// target is an actor id, "o:<objectId>", "x;y" (metres on the main plane) or "x;y;z" (on the plane nearest z).
// Each picture is saved as shots/<outPrefix>_<n>.png.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [html, prefix, spec] = process.argv.slice(2);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message, (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.goto('file://' + path.resolve(html) + '?test');
  await page.waitForTimeout(400);
  await page.addStyleTag({ content: '#hud, .hud, #coach { display: none !important; }' });
  let i = 0, cur = '';
  for (const part of spec.split(',')) {
    const [mid, t, target, zoom, vant] = part.split('@');
    const info = await page.evaluate(({ mid, t, target, zoom, vant, fresh, scope }) => {
      const G = CB.Game; G.noAutoPause = true;
      if (fresh || !G.sim) G.start(mid, { gun: 'halden', cfg: CB.defaultConfig('halden'), shotSeed: 1, vantage: +(vant || 0) });
      const s = G.sim; G.paused = true;
      while (s.t < +t && s.state === 'play') s.step(1 / 60);
      s.ev.length = 0;
      let p;
      if (target.startsWith('o:')) { const o = s.S.objects.find((q) => q.id === target.slice(2)); p = { x: o.x, y: o.y, z: o.plane.z }; }
      else if (target.includes(';')) { const q = target.split(';').map(Number); p = { x: q[0], y: q[1], z: q.length > 2 ? q[2] : s.S.refZ }; }
      else {
        // an actor id; "T" (or an id that is not there) is the first person the mission says to kill
        const a = s.byId[target] || s.actors.find((q) => (s.rules.kill.indexOf(q.id) >= 0 || q.role === 'target') && !q.gone) || s.actors[0];
        p = { x: a.x, y: a.y + 1.1, z: a.plane.z };
      }
      const e = s.eye0, d = p.z - e.z;
      s.sh.ax = ((p.x - e.x) / d) * 1000; s.sh.ay = ((p.y - e.y) / d) * 1000; s.sh.swx = s.sh.swy = 0; s.sh.zoom = s.sh.zoomT = +zoom;
      G.view.updateReadout(s, 1);
      // no reticle and no dark scope edge, so the whole picture can be judged (SCOPE=1 keeps them)
      if (!scope) { G.view.noReticle = true; G.view.RR = 4000; }
      for (let k = 0; k < 4; k++) G.view.draw(s, 0.016, 0);   // a few frames so cached light stamps settle
      return 'state ' + s.state + ' t=' + s.t.toFixed(1);
    }, { mid, t, target, zoom, vant, fresh: mid + (vant || '') !== cur, scope: !!process.env.SCOPE });
    cur = mid + (vant || '');
    const f = path.join(__dirname, '..', 'shots', `${prefix}_${i++}.png`);
    await page.screenshot({ path: f });
    console.log(part, '->', info, f);
  }
  await browser.close();
})();
