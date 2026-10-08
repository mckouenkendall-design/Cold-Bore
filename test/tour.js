// Screenshot a mission at chosen moments. The sim is fast-forwarded to each time and the
// scope pointed at a chosen actor/object/point.  usage: node test/tour.js <mission> <gun> "<t:target:zoom,...>" [vantage] [w] [h]
// target is an actor id, "o:<objectId>", or "x;y" in metres on the main plane.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [mid, gun = 'fenwick', spec = '5@t@6', vant = '0', w = '390', h = '844'] = process.argv.slice(2);
  const browser = await chromium.launch();
  const mobile = +w < 700 || !!process.env.TOUCH;
  const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message, (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html') + `?m=${mid}&gun=${gun}&v=${vant}&test`);
  await page.waitForTimeout(500);
  let i = 0;
  for (const part of spec.split(',')) {
    const [t, target, zoom] = part.split('@');
    const info = await page.evaluate(({ t, target, zoom }) => {
      const G = CB.Game, s = G.sim; if (!s) return 'no sim (state ' + G.state + ')';
      G.paused = true;
      while (s.t < +t && s.state === 'play') s.step(1 / 60);
      s.ev.length = 0;
      let p;
      if (target.startsWith('o:')) { const o = s.S.objects.find((q) => q.id === target.slice(2)); p = { x: o.x, y: o.y, z: o.plane.z }; }
      else if (target.includes(';')) { const [x, y] = target.split(';').map(Number); p = { x, y, z: s.S.refZ }; }
      else { const a = s.byId[target]; p = a.def ? { x: a.x, y: a.y + 1, z: a.plane.z } : { x: a.x, y: a.y + 1.1, z: a.plane.z }; }
      const e = s.eye0; const d = p.z - e.z;
      s.sh.ax = ((p.x - e.x) / d) * 1000; s.sh.ay = ((p.y - e.y) / d) * 1000; s.sh.swx = s.sh.swy = 0;
      s.sh.ax -= s.sh.ax * 0.011 / d * 1000 * 0; s.sh.zoom = s.sh.zoomT = +zoom;
      G.view.updateReadout(s, 1); G.view.draw(s, 0.016, 0); G.updateHud(0.016);
      return 'state ' + s.state + ' t=' + s.t.toFixed(1) + (s.failInfo ? ' FAIL ' + s.failInfo.text : '');
    }, { t, target, zoom });
    console.log(part, '->', info);
    await page.screenshot({ path: path.join(__dirname, '..', 'shots', `${mid}_${i++}.png`), clip: { x: 0, y: 0, width: +w, height: Math.min(+h, 520) } });
  }
  await browser.close();
})();
