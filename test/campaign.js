// Plays the whole campaign in order on a fresh save, the way a careful but
// thrifty player would: it only ever uses rifles it could really own at that
// point, and it walks through the real results screens and story cards.
// usage: node test/campaign.js [thrifty|spender]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const mode = process.argv[2] || 'thrifty';
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html') + '?test');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ok */ } });
  await page.reload(); await page.waitForTimeout(500);
  const out = await page.evaluate((mode) => {
    const log = [], d = CB.Save.data, UI = CB.UI, P = CB.Progress;
    UI.attractStop(); d.seen.prologue = 1;
    const click = (a) => { const e = document.querySelector('#ui [data-a="' + a + '"], #overlay [data-a="' + a + '"]'); if (!e) return false; e.click(); return true; };
    const drain = () => { let n = 0; while (document.querySelector('.story') && n++ < 30) click('next'); while (document.querySelector('.cacheopen') && n++ < 80) { if (!click('next')) click('done'); } };
    for (const M of CB.MISSIONS) {
      if (!P.missionOpen(M)) { log.push('LOCKED ' + M.id); break; }
      // choose a rifle: an allowed one already owned, else buy the cheapest allowed one that money and rank permit
      const allowed = (gid) => { const cfg = CB.Test.cfgFor(M, gid, d.guns[gid] ? d.guns[gid].cfg : null); const st = CB.buildStats(gid, cfg); const needPart = cfg.muzzle !== 'mz_none' && cfg.muzzle !== (d.guns[gid] ? d.guns[gid].cfg.muzzle : 'mz_none'); return { ok: !CB.gunAllowed(M, st), cfg, needPart: needPart ? cfg.muzzle : null }; };
      let pick = null;
      const owned = Object.keys(d.guns);
      for (const gid of owned) { const a = allowed(gid); if (a.ok && (!a.needPart || d.parts[a.needPart] || mode === 'spender')) { pick = { gid, cfg: a.cfg, needPart: a.needPart }; } }
      if (!pick || mode === 'spender') {
        const rank = CB.Test.rank(), shop = CB.GUNS.filter((g) => !d.guns[g.id] && !g.special && g.rank <= rank && g.price <= d.credits).sort((a, b) => a.price - b.price);
        for (const g of (mode === 'spender' ? shop.reverse() : shop)) { const a = allowed(g.id); if (a.ok) { const err = P.buy('gun', g.id); if (!err) { pick = { gid: g.id, cfg: a.cfg, needPart: a.needPart }; log.push('  bought ' + g.id + ' before ' + M.id); break; } } }
      }
      if (!pick) { log.push('NO RIFLE for ' + M.id + ' (credits ' + d.credits + ', rank ' + CB.Test.rank() + ', owned ' + owned.join(',') + ')'); break; }
      if (pick.needPart && !d.parts[pick.needPart]) { const err = P.buy('part', pick.needPart); if (err) { log.push('CANNOT AFFORD ' + pick.needPart + ' for ' + M.id + ': ' + err); break; } }
      d.guns[pick.gid].cfg = Object.assign(d.guns[pick.gid].cfg, { muzzle: pick.cfg.muzzle, ammo: pick.cfg.ammo });
      d.equipped = pick.gid;
      const r = CB.Test.run(M.id, pick.gid, { cfg: d.guns[pick.gid].cfg, flags: d.flags, raw: true });
      if (!r.ok) { log.push('LOST ' + M.id + ' with ' + pick.gid + ': ' + r.fail + ' | ' + r.log.join('; ')); break; }
      if (mode === 'thrifty') { r.res.stars = 1; r.res.clean = false; r.res.challenge = false; r.res.stats.duck = false; }
      UI.brief(M);
      UI.results(M, r.res, { missionId: M.id, opts: { gun: pick.gid } });
      const head = (document.querySelector('.results h1') || {}).innerText;
      if (!/complete/i.test(head || '')) { log.push('RESULTS SCREEN WRONG for ' + M.id + ': ' + head); break; }
      if (document.querySelector('.cachebox')) { click('caches'); drain(); }
      click('next'); drain();
      log.push(M.id + ' ' + pick.gid + ' stars ' + r.res.stars + ' cr ' + d.credits + ' xp ' + d.xp + ' rank ' + CB.Test.rank() + (r.outcome ? ' outcome ' + r.outcome : '') + ' screen:' + (document.querySelector('.brief h2, .chhead h2') || {}).innerText);
    }
    return { log, flags: d.flags, guns: Object.keys(d.guns), credits: d.credits, xp: d.xp, done: Object.keys(d.missions).filter((k) => d.missions[k].done).length, skins: Object.keys(d.skins).length, ending: d.seen.ending, epi: CB.Test.epi() };
  }, mode);
  console.log(out.log.join('\n'));
  console.log(JSON.stringify({ done: out.done, flags: out.flags, guns: out.guns, credits: out.credits, xp: out.xp, skins: out.skins, ending: out.ending, epilogue: out.epi }, null, 1));
  if (errs.length) { console.log(errs.join('\n')); process.exitCode = 1; }
  if (out.done !== 41) process.exitCode = 1;
  await browser.close();
})();
