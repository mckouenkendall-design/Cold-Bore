// Contact sheet: one wide and one closer view of every mission in a chapter.
// usage: node test/sheet.js <chapterNumber> [gun] [seconds] [zoomWide] [zoomClose]
const { chromium } = require('playwright');
const path = require('path');
const { execSync } = require('child_process');
(async () => {
  const [ch = '2', gun = 'aria', secs = '6', zw = '6', zc = '14'] = process.argv.slice(2);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message, (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html') + '?test');
  await page.waitForTimeout(300);
  const ids = await page.evaluate((ch) => CB.MISSIONS.filter((m) => m.ch === +ch).map((m) => m.id), ch);
  const files = [];
  for (const id of ids) {
    for (const [k, zoom] of [['w', zw], ['c', zc]]) {
      const info = await page.evaluate(({ id, gun, secs, zoom, k }) => {
        const G = CB.Game; G.noAutoPause = true;
        if (k === 'w') { G.start(id, { gun, cfg: CB.defaultConfig(gun), shotSeed: 1 }); }
        const s = G.sim, M = G.mission; G.paused = true;
        while (s.t < +secs && s.state === 'play') s.step(1 / 60);
        s.ev.length = 0;
        const e = s.eye0, d = s.S.refZ - e.z;
        let px = (M.look || [0, 8])[0], py = (M.look || [0, 8])[1], pz = s.S.refZ;
        if (k === 'c') { const t = s.actors.find((a) => (s.rules.kill.indexOf(a.id) >= 0 || a.role === 'target') && !a.hidden && !a.gone) || s.actors.find((a) => !a.hidden && !a.gone); if (t) { px = t.x; py = t.y + 1.1; pz = t.plane.z; } }
        s.sh.ax = ((px - e.x) / (pz - e.z)) * 1000; s.sh.ay = ((py - e.y) / (pz - e.z)) * 1000; s.sh.swx = s.sh.swy = 0; s.sh.zoom = s.sh.zoomT = Math.min(+zoom, s.st.zoomMax);
        G.view.updateReadout(s, 1); G.view.draw(s, 0.016, 0); G.updateHud(0.016);
        return id + ' ' + k + ' ' + s.state + ' t=' + s.t.toFixed(1);
      }, { id, gun, secs, zoom, k });
      await page.waitForTimeout(k === 'w' ? 1300 : 120);
      const f = path.join(__dirname, '..', 'shots', `sheet_${id}_${k}.png`);
      await page.screenshot({ path: f, clip: { x: 0, y: 0, width: 390, height: 500 } });
      files.push(f);
    }
  }
  await browser.close();
  execSync(`python3 -c "
from PIL import Image
import sys
fs='${files.join(',')}'.split(',')
ims=[Image.open(f) for f in fs]
w,h=ims[0].size; w//=2; h//=2
cols=4; rows=(len(ims)+cols-1)//cols
s=Image.new('RGB',(w*cols,h*rows))
for i,im in enumerate(ims): s.paste(im.resize((w,h)),((i%cols)*w,(i//cols)*h))
s.save('${path.join(__dirname, '..', 'shots', 'sheet_ch' + ch + '.png')}')
"`);
  console.log('sheet for chapter', ch, ids.join(' '));
})();
