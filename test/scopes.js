// One picture of every scope's reticle on the same scene. usage: node test/scopes.js
const { chromium } = require('playwright');
const path = require('path');
const { execSync } = require('child_process');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message, (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html') + '?test');
  await page.waitForTimeout(300);
  const scopes = ['hunter', 'zf4', 'ranger', 'bdc', 'pso', 'tac', 'night', 'lrf', 'tree', 'comp', 'oracle'];
  const files = [];
  for (const sc of scopes) {
    await page.evaluate((sc) => {
      const G = CB.Game; G.noAutoPause = true; CB.UI.attractStop();
      const gun = sc === 'zf4' ? 'kessler' : 'halden', mid = sc === 'night' ? 'c1m2' : 'c3m1';
      G.start(mid, { gun, cfg: Object.assign(CB.defaultConfig(gun), { scope: sc }), shotSeed: 1 });
      const s = G.sim; G.paused = true;
      while (s.t < 8) s.step(1 / 60); s.ev.length = 0;
      const t = s.byId.t || s.actors[0], e = s.eye0, d = t.plane.z - e.z;
      s.sh.ax = ((t.x - e.x) / d) * 1000; s.sh.ay = ((t.y + 3.2 - e.y) / d) * 1000; s.sh.swx = s.sh.swy = 0;
      s.sh.zoom = s.sh.zoomT = Math.min(s.st.zoomMax, Math.max(s.st.zoomMin, 9));
      G.view.updateReadout(s, 1); G.view.draw(s, 0.016, 0); G.updateHud(0.016);
    }, sc);
    await page.waitForTimeout(1300);
    const f = path.join(__dirname, '..', 'shots', 'scope_' + sc + '.png');
    await page.screenshot({ path: f, clip: { x: 0, y: 50, width: 390, height: 450 } });
    files.push(f);
  }
  await browser.close();
  execSync(`python3 -c "
from PIL import Image
fs='${files.join(',')}'.split(',')
ims=[Image.open(f) for f in fs]
w,h=ims[0].size; w//=2; h//=2
cols=4; rows=(len(ims)+cols-1)//cols
s=Image.new('RGB',(w*cols,h*rows))
for i,im in enumerate(ims): s.paste(im.resize((w,h)),((i%cols)*w,(i//cols)*h))
s.save('${path.join(__dirname, '..', 'shots', 'scopes_sheet.png')}')
"`);
  console.log('done');
})();
