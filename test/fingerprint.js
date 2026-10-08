// Gameplay fingerprint. Art work must never change what a mission IS: where the walls,
// windows, lamps, objects and people are, and which rooms are lit. This script reduces all
// of that to one number per mission. `node test/fingerprint.js save` records the numbers;
// `node test/fingerprint.js` compares against the record and lists any mission that changed.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const save = process.argv[2] === 'save', file = path.join(__dirname, 'fingerprint.json');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html') + '?test');
  await page.waitForTimeout(500);
  const got = await page.evaluate(() => {
    const out = {}, r3 = (v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);
    const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
    CB.MISSIONS.forEach((M) => {
      const variants = M.testFlags || [{}], nv = (M.vantages || [0]).length;
      variants.forEach((flags, fi) => { for (let v = 0; v < nv; v++) {
        const gun = (CB.GUNS.find((g) => !CB.gunAllowed(M, CB.buildStats(g.id, CB.Test.cfgFor(M, g.id)))) || CB.GUNS[0]).id;
        const sim = new CB.Sim(M, CB.buildStats(gun, CB.Test.cfgFor(M, gun)), v, { flags, shotSeed: 1 }), S = sim.S, parts = [];
        const pz = new Map(); S.planes.forEach((P, i) => pz.set(P, i));
        S.planes.forEach((P) => {
          parts.push('P', r3(P.z), P.groundY === undefined ? '-' : r3(P.groundY), P.groundMat || '-', P.groundFn ? [-40, -10, 0, 10, 40].map((x) => r3(P.groundFn(x))).join('/') : '-');
          P.solids.forEach((s) => parts.push('s', r3(s.x), r3(s.y), r3(s.w), r3(s.h), s.mat));
          P.openings.forEach((o) => parts.push('o', r3(o.x), r3(o.y), r3(o.w), r3(o.h), o.room, o.glass ? 1 : 0, o.through ? 1 : 0, o.roof ? 1 : 0));
        });
        Object.keys(S.rooms).sort().forEach((k) => parts.push('r', k, S.rooms[k].lit ? 1 : 0));
        S.objects.forEach((o) => parts.push('ob', o.id, o.kind, r3(o.x), r3(o.y), r3(o.r), r3(o.w || 0), r3(o.h || 0), o.zone || '-', pz.get(o.plane), o.reach || '-', o.pass ? 1 : 0, o.alive ? 1 : 0));
        S.props.forEach((p) => parts.push('pr', p.id || '-', p.kind, r3(p.x), r3(p.y), r3(p.w), r3(p.h), r3(p.floor), pz.get(p.plane)));
        sim.actors.forEach((a) => parts.push('a', a.id, a.role, r3(a.x), r3(a.y), pz.get(a.plane), a.zone, a.room || '-', a.behind ? 1 : 0, a.anim, a.face));
        sim.vehicles.forEach((c) => parts.push('v', c.id, c.kind, r3(c.x), r3(c.y), c.dir, pz.get(c.plane), [c.def.len, c.def.h, c.def.body, c.def.wheel, JSON.stringify(c.def.win), JSON.stringify(c.def.cab), JSON.stringify(c.def.seats), c.def.solid ? 1 : 0].join('/')));
        parts.push('m', r3(S.refZ), JSON.stringify(S.bounds), JSON.stringify(S.exits), JSON.stringify(S.darkZones), JSON.stringify(S.litZones), S.time, S.weather, r3(S.seeMul || 1), r3(sim.farStop), JSON.stringify(sim.lim));
        // and what the bot makes of it: result, time and shots with the first rifle allowed
        const run = CB.Test.run(M.id, gun, { vantage: v, flags });
        parts.push('run', run.ok ? 1 : 0, run.stars, run.t, run.shots);
        out[M.id + (variants.length > 1 ? '#' + fi : '') + (nv > 1 ? '@' + v : '')] = hash(parts.join('|'));
      } });
    });
    return out;
  });
  if (errs.length) { console.log(errs.join('\n')); process.exit(1); }
  if (save) { fs.writeFileSync(file, JSON.stringify(got, null, 1)); console.log('saved', Object.keys(got).length, 'fingerprints'); }
  else {
    const want = JSON.parse(fs.readFileSync(file, 'utf8')), bad = [];
    for (const k in want) if (want[k] !== got[k]) bad.push(k);
    for (const k in got) if (!(k in want)) bad.push(k + ' (new)');
    console.log(bad.length ? 'CHANGED: ' + bad.join(', ') : 'all ' + Object.keys(got).length + ' fingerprints match');
    process.exitCode = bad.length ? 1 : 0;
  }
  await browser.close();
})();
