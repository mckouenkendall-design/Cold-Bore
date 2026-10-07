// Runs the test bot across every mission and rifle inside the real page in a
// headless browser. usage: node test/matrix.js [missionId,missionId] [seed]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const only = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : null;
  const seeds = (process.argv[3] || '1').split(',').map(Number);
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html') + '?test');
  await page.waitForTimeout(400);
  let bad = 0;
  for (const seed of seeds) {
    const out = await page.evaluate(({ only, seed }) => CB.Test.matrix({ only, seed }), { only, seed });
    console.log('seed', seed, 'runs', out.runs, 'fails', out.fails.length, 'skipped combos', out.skipped);
    for (const id in out.perMission) { const p = out.perMission[id]; console.log('  ' + id.padEnd(8) + ' ok ' + String(p.ok).padStart(3) + '  fail ' + String(p.fail).padStart(2) + '  guns ' + p.guns.length + (p.skipped.length ? '  (not allowed: ' + p.skipped.join(',') + ')' : '')); }
    out.fails.forEach((f) => console.log('  FAIL', f.m, f.gun, 'v' + f.v, JSON.stringify(f.flags), f.fail, '|', f.log.join('; '), '| t=' + f.t));
    if (process.env.CLEAN) out.notClean.forEach((f) => console.log('  under 3 stars', JSON.stringify(f)));
    else console.log('  runs that won but under 3 stars:', out.notClean.length);
    bad += out.fails.length;
  }
  if (errs.length) { console.log(errs.join('\n')); bad++; }
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
