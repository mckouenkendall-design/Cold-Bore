// The gun room, on a phone held sideways (844 x 390 with notch insets) and upright (390 x 844).
// Three saves: a fresh one (one rifle), five rifles with a few kills, and all sixteen with parts,
// moving skins and kills. Every stretch of wall is photographed into shots/gunroom_*.png and checked:
//   - no page errors, nothing makes the page scroll sideways
//   - every rifle on a rack is drawn at least 285 px long sideways on the 844 phone (300 is the
//     aim; the older 667 phone gets the same share of its narrower screen), 300 px upright
//   - every rifle has something to tap that is at least 44 px tall and inside the safe area
//   - the rifle in the glass case is the one with the most kills (the carried one on a fresh save)
//   - a swipe walks along the wall, a tap opens the bench, and back comes back to the same wall
// usage: node test/gunroom.js
const { chromium } = require('playwright');
const path = require('path');

const SAVES = {
  fresh: null,
  five(d) {
    ['halden', 'ratter', 'lark', 'marrow'].forEach((g) => CB.Progress.grantGun(g));
    d.credits = 9000; d.xp = 2600; d.equipped = 'halden';
    d.stats.guns = { fenwick: { kills: 6, heads: 1, shots: 9, longest: 281 }, halden: { kills: 14, heads: 5, shots: 17, longest: 612 }, lark: { kills: 3, heads: 0, shots: 6, longest: 240 } };
    d.guns.lark.cfg.skin = 'plum'; d.guns.halden.cfg.muzzle = 'mz_supl';
  },
  all(d) {
    CB.GUNS.forEach((g) => CB.Progress.grantGun(g.id));
    d.credits = 99000; d.xp = 30000; d.equipped = 'aria';
    const moving = CB.SKINS.filter((s) => s.r === 4 || s.shimmer || s.glow).map((s) => s.id), flat = ['ranger', 'navy', 'bone', 'stainless', 'rust', 'glacier'];
    d.stats.guns = {};
    CB.GUNS.forEach((g, i) => {
      const c = d.guns[g.id].cfg;
      if (i % 3 === 0) c.skin = moving[i % moving.length]; else if (i % 3 === 1) c.skin = flat[i % flat.length];
      // parts, by the same rules the bench uses to say what fits
      if (g.supp === true && i % 2 === 0) c.muzzle = i % 4 === 0 ? 'mz_supl' : 'mz_suph';
      c.support = ['sp_bipod', 'sp_none', 'sp_tripod', 'sp_bag'][i % 4];
      c.stock = ['st_cheek', 'st_std', 'st_chassis', 'st_skel'][(i + 1) % 4];
      if (g.supp !== 'integral' && g.action !== 'charge' && i % 3 === 2) c.barrel = 'br_heavy';
      if (g.action !== 'single' && g.action !== 'charge' && i % 2 === 1) c.mag = 'mg_ext';
      d.stats.guns[g.id] = { kills: (i * 7) % 23, heads: i % 4, shots: 10 + i, longest: 200 + i * 60 };
    });
    d.stats.guns.northwind.kills = 41; d.stats.longest = 1310;
  },
};

(async () => {
  const browser = await chromium.launch();
  const errs = [], log = [];
  const ok = (c, what) => { log.push((c ? 'PASS ' : 'FAIL ') + what); if (!c) errs.push('FAIL ' + what); };
  for (const shape of [{ name: 'w844', w: 844, h: 390, ins: [50, 50, 21] }, { name: 'w667', w: 667, h: 375, ins: [50, 50, 21] }, { name: 'tall', w: 390, h: 844, ins: [0, 0, 20] }]) {
    for (const key of Object.keys(SAVES)) {
      const ctx = await browser.newContext({ viewport: { width: shape.w, height: shape.h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errs.push('PAGEERROR ' + shape.name + ' ' + key + ': ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
      const cdp = await ctx.newCDPSession(page);
      let tid = 1;
      const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
      const tap = async (x, y) => { const id = tid++; await touch('touchStart', [{ x, y, id }]); await page.waitForTimeout(40); await touch('touchEnd', []); await page.waitForTimeout(80); };
      const swipe = async (x0, x1, y) => { const id = tid++; await touch('touchStart', [{ x: x0, y, id }]); for (let k = 1; k <= 8; k++) { await page.waitForTimeout(16); await touch('touchMove', [{ x: x0 + (x1 - x0) * k / 8, y, id }]); } await touch('touchEnd', []); await page.waitForTimeout(500); };
      await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
      await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ok */ } });
      await page.reload(); await page.waitForTimeout(400);
      await page.addStyleTag({ content: `:root{--sal:${shape.ins[0]}px;--sar:${shape.ins[1]}px;--sab:${shape.ins[2]}px}` });
      await page.evaluate((src) => { CB.Game.resize(); const d = CB.Save.data; d.seen.prologue = 1; d.seen.ch1 = 1; if (src) (new Function('d', 'CB', src))(d, CB); CB.Save.write(); CB.UI.attractStop(); CB.UI.hub(); }, SAVES[key] ? '(' + SAVES[key].toString().replace(/^[a-z]+\(d\)/, 'function (d)') + ')(d)' : '');
      await page.waitForTimeout(300);
      // in through the rail
      const entry = await page.locator('.tabb.room').first().boundingBox();
      ok(!!entry, shape.name + ' ' + key + ': the gun room is on the rail');
      if (entry) await tap(entry.x + entry.width / 2, entry.y + entry.height / 2);
      await page.waitForTimeout(500);
      const info = await page.evaluate(() => {
        const G = CB.UI.gr; if (!G) return null;
        const d = CB.Save.data, sf = CB.Game.safe, W = innerWidth, H = innerHeight;
        const out = { n: G.secs.length, fav: G.fav, favKills: (d.stats.guns[G.fav] || {}).kills || 0, most: 0, carried: d.equipped, short: [], badHit: [], scroll: document.documentElement.scrollWidth > W };
        Object.keys(d.guns).forEach((id) => { out.most = Math.max(out.most, (d.stats.guns[id] || {}).kills || 0); });
        G.secs.forEach((S) => { if (S.kind !== 'rack') return; S.guns.forEach(() => {}); });
        // how long each rifle is drawn: the same sum drawGun does
        G.secs.forEach((S, i) => {
          if (S.kind !== 'rack') return;
          const lay = CB.UI.grSlotsFor(G, S);
          lay.forEach((s) => { const cfg = d.guns[s.id] ? d.guns[s.id].cfg : CB.defaultConfig(s.id), g = CB.gunShapes(s.id, cfg), span = g.x1 - g.x0, sc = Math.min(s.bw / span, s.bh / (cfg.support === 'sp_tripod' ? 43 : 32)) * 0.96; if (span * sc < (W > H ? Math.round(285 * W / 844) : 300)) out.short.push(s.id + ' ' + Math.round(span * sc) + 'px'); });
        });
        document.querySelectorAll('.gr-hit').forEach((b) => { const r = b.getBoundingClientRect(), sec = b.parentElement, off = sec.getBoundingClientRect().left; const x0 = r.left - off, x1 = r.right - off; if (r.height < 44 || r.width < 44 || x0 < sf.l - 1 || x1 > W - sf.r + 1 || r.bottom > H - sf.b + 1) out.badHit.push(b.dataset.id + ' ' + [x0, r.top, x1, r.bottom].map(Math.round).join(',')); });
        return out;
      });
      ok(!!info, shape.name + ' ' + key + ': the room opens');
      if (!info) { await ctx.close(); continue; }
      ok(!info.scroll, shape.name + ' ' + key + ': nothing scrolls sideways');
      ok(info.short.length === 0, shape.name + ' ' + key + ': every rifle is drawn long enough' + (info.short.length ? ' (' + info.short.join(', ') + ')' : ''));
      ok(info.badHit.length === 0, shape.name + ' ' + key + ': every rifle can be tapped' + (info.badHit.length ? ' (' + info.badHit.join('; ') + ')' : ''));
      ok(info.most ? info.favKills === info.most : info.fav === info.carried, shape.name + ' ' + key + ': the case holds ' + info.fav + (info.most ? ' with the most kills (' + info.favKills + ')' : ', the carried rifle'));
      // photograph every stretch of wall, walking along it with swipes
      for (let i = 0; i < info.n; i++) {
        await page.waitForTimeout(450);
        await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'gunroom_' + shape.name + '_' + key + '_' + i + '.png') });
        if (i < info.n - 1) { await swipe(shape.w * 0.75, shape.w * 0.2, shape.h * 0.6); ok(await page.evaluate((k) => CB.UI.gr.sec === k, i + 1), shape.name + ' ' + key + ': a swipe walks to wall ' + (i + 1)); }
      }
      // tap a rifle, check its bench opens, and come back
      const target = await page.evaluate(() => { const G = CB.UI.gr, b = G.secEls[G.sec].querySelector('.gr-hit'); if (!b) return null; const r = b.getBoundingClientRect(); return { id: b.dataset.id, x: r.left + r.width / 2, y: r.top + r.height / 2, sec: G.sec }; });
      if (target) {
        await tap(target.x, target.y); await page.waitForTimeout(400);
        ok(await page.locator('.scr.bench').count() === 1, shape.name + ' ' + key + ': tapping ' + target.id + ' opens its bench');
        const back = await page.locator('.bench [data-a="back"]').first().boundingBox();
        if (back) await tap(back.x + back.width / 2, back.y + back.height / 2);
        await page.waitForTimeout(500);
        ok(await page.evaluate((k) => !!CB.UI.gr && CB.UI.gr.sec === k, target.sec), shape.name + ' ' + key + ': back from the bench returns to the same wall');
      }
      // and out again
      const bk = await page.locator('.gr-bar [data-a="back"]').first().boundingBox();
      if (bk) await tap(bk.x + bk.width / 2, bk.y + bk.height / 2);
      await page.waitForTimeout(300);
      ok(await page.evaluate(() => !document.querySelector('.gunroom') && CB.UI.onTick === null), shape.name + ' ' + key + ': back leaves the room and stops its drawing');
      await ctx.close();
    }
  }
  await browser.close();
  console.log(log.join('\n'));
  if (errs.length) { console.log('\n' + errs.join('\n')); process.exit(1); }
  console.log('\nall gun room checks passed');
})();
