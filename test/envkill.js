// Accidents set up by shooting part of the scene (src/26_envkills.js).
// c1m3: the junction box under the laundry awning drops a live cable into the
// street spotter's puddle. Checks that it kills him as an accident, that the
// contract can be won that way in either order, and that nobody else dies.
// usage: NODE_PATH=... node test/envkill.js [rifles] [seeds]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const guns = (process.argv[2] || 'fenwick,whisper,stormglass').split(',');
  const seeds = (process.argv[3] || '1,2,3').split(',').map(Number);
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html') + '?test');
  await page.waitForTimeout(400);
  const out = await page.evaluate(({ guns, seeds }) => {
    const rows = [];
    for (const gun of guns) for (const seed of seeds) for (const order of ['roof first', 'cable first']) {
      const st = CB.buildStats(gun, CB.Test.cfgFor(CB.MISSION_BY_ID.c1m3, gun));
      const lead = st.action === 'charge' ? 1.9 : 1.2;
      const cov = (s) => st.quiet || (s.covered() && s.coverUntil - s.t > lead);
      const roof = [['until', cov], ['shoot', 't1', 'torso'], ['wait', 0.5]];
      const cable = [['until', cov], ['shootObj', 'junction'], ['wait', 1.6]];
      const script = order === 'roof first' ? roof.concat(cable) : cable.concat(roof);
      const r = CB.Test.run('c1m3', gun, { seed, raw: true, script, oracle: true });
      const res = r.res || {}, ks = (res.kills || []);
      rows.push({ gun, seed, order, ok: r.ok, stars: r.stars, fail: r.fail, log: r.log, t: r.t,
        t2: (ks.find((k) => k.id === 't2') || {}).accident === true, others: ks.filter((k) => k.id !== 't1' && k.id !== 't2').map((k) => k.id),
        score: res.score && res.score.parts.map((p) => p.label).join(', '), oracle: r.oracle && r.oracle.same });
    }
    return rows;
  }, { guns, seeds });
  let bad = 0;
  out.forEach((o) => {
    const good = o.ok && o.t2 && !o.others.length && o.oracle;
    if (!good) bad++;
    console.log((good ? 'ok  ' : 'BAD ') + o.gun.padEnd(9) + ' seed ' + o.seed + '  ' + o.order.padEnd(11) + '  stars ' + o.stars + '  t=' + o.t + (o.fail ? '  FAIL ' + o.fail : '') + (o.log.length ? '  | ' + o.log.join('; ') : '') + (o.others.length ? '  also killed ' + o.others.join(',') : '') + '  | ' + o.score);
  });
  if (errs.length) { console.log(errs.join('\n')); bad++; }
  console.log(bad ? bad + ' problem(s)' : 'all good');
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
