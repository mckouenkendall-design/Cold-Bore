// Screenshot menu screens with a made-up save. usage: node test/ui.js name "<js>" [w] [h] [waitMs]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [name, script, w = '390', h = '844', wait = '500'] = process.argv.slice(2);
  const browser = await chromium.launch();
  const mobile = +w < 700;
  const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html') + '?test');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const d = CB.Save.data; d.seen.prologue = 1; for (let i = 1; i <= 6; i++) d.seen['ch' + i] = 1;
    d.credits = 23450; d.xp = 6200;
    ['halden', 'ratter', 'lark', 'orlov', 'marrow', 'stormglass'].forEach((g) => CB.Progress.grantGun(g));
    d.parts.mz_supl = 1; d.parts.sp_bipod = 1; d.parts.am_match = 1; d.scopes.tac = 1; d.scopes.bdc = 1;
    ['walnut', 'matte', 'woodland', 'tiger', 'carbon', 'galaxy', 'midas', 'aurora', 'kintsugi', 'hex', 'sunset'].forEach((s) => { d.skins[s] = 1; });
    d.guns.halden.cfg.skin = 'kintsugi'; d.guns.halden.cfg.muzzle = 'mz_supl'; d.guns.halden.cfg.support = 'sp_bipod'; d.equipped = 'halden';
    d.caches = ['field', 'sealed', 'field'];
    CB.MISSIONS.slice(0, 17).forEach((m, i) => { d.missions[m.id] = { done: true, stars: 1 + (i % 3), ch: i % 2 === 0, plays: 1 }; if (i % 3 === 0) d.ducks[m.id] = 1; });
    d.stats.longest = 612; d.stats.shots = 143; d.stats.heads = 21; d.stats.wins = 30;
    CB.UI.attractStop();
  });
  const r = await page.evaluate(script);
  if (r !== undefined) console.log('eval:', JSON.stringify(r));
  await page.waitForTimeout(+wait);
  await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'ui_' + name + '.png') });
  if (errs.length) console.log(errs.join('\n')); else console.log('ok', name);
  await browser.close();
})();
