// Skin sheets: every skin drawn on several differently shaped rifles, in a
// labelled grid, saved in shots/. Animated skins are drawn at two moments.
// usage: node test/skins.js [what] [gunWidth] [dpr] [perSheet] [guns]
//   what     all (default) | new | r0..r4 | swatches | tiles | a comma list of skin ids
//   gunWidth width of one rifle picture in CSS pixels (default 340, about a phone)
//   dpr      device pixel ratio (default 2)
//   perSheet skins per picture (default 9)
//   guns     comma list of rifle ids (default fenwick,lark,northwind)
// It also checks the skin list itself: counts per rarity, unique ids and names.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const [what = 'all', gw = '340', dpr = '2', per = '9', gunArg = 'fenwick,lark,northwind'] = process.argv.slice(2);
  const shots = path.join(__dirname, '..', 'shots');
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: +dpr });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html') + '?test');
  await page.waitForTimeout(300);

  // ---- the list itself ----
  const info = await page.evaluate(() => {
    const S = CB.SKINS, ids = {}, names = {}, bad = [];
    S.forEach((s) => {
      if (ids[s.id]) bad.push('duplicate id ' + s.id); ids[s.id] = 1;
      const n = s.name.toLowerCase(); if (names[n]) bad.push('duplicate name ' + s.name); names[n] = 1;
      if (!/^[a-z0-9]+$/.test(s.id)) bad.push('odd id ' + s.id);
      if (JSON.stringify(s).indexOf(String.fromCharCode(8212)) >= 0) bad.push('em dash in ' + s.id);
    });
    const cache = S.filter((s) => s.id !== 'factory' && !s.ex), per = [0, 0, 0, 0, 0];
    cache.forEach((s) => per[s.r]++);
    return { total: S.length, cache: cache.length, per, bad, list: S.filter((s) => s.id !== 'factory').map((s) => ({ id: s.id, r: s.r, ex: !!s.ex, anim: !!(s.shimmer || s.glow || JSON.stringify(s).indexOf('"anim"') >= 0) })) };
  });
  console.log('skins in total', info.total, ' cache skins', info.cache, ' per rarity', info.per.join(' / '));
  if (info.bad.length) { console.log('LIST PROBLEMS:\n' + info.bad.join('\n')); process.exitCode = 1; }

  // ---- which ones to draw ----
  const OLD = 'matte earth ranger wolf bone brick navy rust walnut birch woodland desert snowcam urban twotone teal digital tiger carbon hex topo hazard splat zebra plaid damascus circuit galaxy sunset ivory frost midas kintsugi aurora obsidian blueprint duckie ghost brass harrow'.split(' ');
  let pick = info.list;
  if (what === 'new') pick = pick.filter((s) => OLD.indexOf(s.id) < 0);
  else if (/^r[0-4]$/.test(what)) pick = pick.filter((s) => s.r === +what[1]);
  else if (what !== 'all' && what !== 'swatches' && what !== 'tiles') { const want = what.split(','); pick = want.map((id) => info.list.find((s) => s.id === id)).filter(Boolean); }
  const guns = gunArg.split(',');
  const files = [];

  if (what === 'tiles') {
    // every texture tile the skins use, drawn two by two so a seam would show
    const n = await page.evaluate(() => {
      const scratch = document.createElement('canvas').getContext('2d');
      CB.SKINS.forEach((s) => { if (s.id !== 'factory') CB.drawGun(scratch, 'fenwick', Object.assign(CB.defaultConfig('fenwick'), { skin: s.id }), 100, 50, 200, 100, { time: 1.3 }); });
      return Object.keys(CB.patCache).length;
    });
    const perSheet = 24, cols = 6, cw = 330, chh = 230;
    for (let s0 = 0, sheet = 1; s0 < n; s0 += perSheet, sheet++) {
      const rows = Math.ceil(Math.min(perSheet, n - s0) / cols);
      await page.setViewportSize({ width: cols * cw, height: rows * chh });
      await page.evaluate(({ s0, perSheet, cols, cw, chh, rows }) => {
        const old = document.getElementById('skinsheet'); if (old) old.remove();
        const c = document.createElement('canvas'); c.id = 'skinsheet'; c.width = cols * cw; c.height = rows * chh;
        c.style.cssText = 'position:fixed;left:0;top:0;z-index:999;width:' + cols * cw + 'px;height:' + rows * chh + 'px';
        const x = c.getContext('2d'); x.fillStyle = '#566270'; x.fillRect(0, 0, c.width, c.height);
        Object.keys(CB.patCache).slice(s0, s0 + perSheet).forEach((k, i) => {
          const t = CB.patCache[k], px = (i % cols) * cw + 4, py = Math.floor(i / cols) * chh + 18;
          x.save(); x.beginPath(); x.rect(px, py, cw - 8, chh - 22); x.clip();
          for (let a = 0; a * t.width < cw; a++) for (let b = 0; b * t.height < chh; b++) x.drawImage(t, px + a * t.width, py + b * t.height);
          x.restore();
          x.fillStyle = '#fff'; x.font = '10px sans-serif'; x.fillText(k.slice(0, 60), px, py - 5);
        });
        document.body.appendChild(c);
      }, { s0, perSheet, cols, cw, chh, rows });
      const f = path.join(shots, 'skins_tiles_' + sheet + '.png');
      await page.locator('#skinsheet').screenshot({ path: f }); files.push(f);
    }
  } else if (what === 'swatches') {
    // the collection grid: swatches at the size the menu draws them
    const cols = 6, cw = 118, chh = 70, rows = Math.ceil(pick.length / cols);
    await page.setViewportSize({ width: cols * cw + 10, height: rows * chh + 10 });
    await page.evaluate(({ pick, cols, cw, chh, rows, dpr }) => {
      const old = document.getElementById('skinsheet'); if (old) old.remove();
      const c = document.createElement('canvas'); c.id = 'skinsheet'; c.width = cols * cw * dpr; c.height = rows * chh * dpr;
      c.style.cssText = 'position:fixed;left:0;top:0;z-index:999;width:' + cols * cw + 'px;height:' + rows * chh + 'px';
      const x = c.getContext('2d'); x.scale(dpr, dpr); x.fillStyle = '#10151c'; x.fillRect(0, 0, cols * cw, rows * chh);
      pick.forEach((p, i) => {
        const s = CB.SKINS.find((q) => q.id === p.id), px = (i % cols) * cw + 8, py = Math.floor(i / cols) * chh + 6;
        x.save(); x.beginPath(); x.roundRect(px, py, 102, 38, 7); x.clip(); CB.drawSwatch(x, s, px, py, 102, 38, 1.3); x.restore();
        x.fillStyle = CB.RAR_COL[s.r]; x.font = '700 10px sans-serif'; x.fillText(s.name.toUpperCase().slice(0, 18), px, py + 51);
        x.fillStyle = '#6f7b88'; x.font = '9px sans-serif'; x.fillText(s.id, px, py + 61);
      });
      document.body.appendChild(c);
    }, { pick, cols, cw, chh, rows, dpr: +dpr });
    const f = path.join(shots, 'skins_swatches.png');
    await page.locator('#skinsheet').screenshot({ path: f }); files.push(f);
  } else {
    const W = +gw, GH = Math.round(W * 0.3), n = +per;
    for (let s0 = 0, sheet = 1; s0 < pick.length; s0 += n, sheet++) {
      const part = pick.slice(s0, s0 + n);
      const two = part.some((p) => p.anim);          // animated skins get two moments side by side
      const cellW = (two ? 2 : 1) * W + 16, cellH = guns.length * GH + 30, cols = two ? Math.min(2, part.length) : Math.min(3, part.length), rows = Math.ceil(part.length / cols);
      await page.setViewportSize({ width: cols * cellW, height: rows * cellH });
      await page.evaluate(({ part, guns, W, GH, cellW, cellH, cols, rows, two, dpr }) => {
        const old = document.getElementById('skinsheet'); if (old) old.remove();
        const c = document.createElement('canvas'); c.id = 'skinsheet'; c.width = cols * cellW * dpr; c.height = rows * cellH * dpr;
        c.style.cssText = 'position:fixed;left:0;top:0;z-index:999;width:' + cols * cellW + 'px;height:' + rows * cellH + 'px';
        const x = c.getContext('2d'); x.scale(dpr, dpr); x.fillStyle = '#141a22'; x.fillRect(0, 0, cols * cellW, rows * cellH);
        part.forEach((p, i) => {
          const s = CB.SKINS.find((q) => q.id === p.id), px = (i % cols) * cellW, py = Math.floor(i / cols) * cellH;
          x.strokeStyle = '#263241'; x.lineWidth = 1; x.strokeRect(px + 0.5, py + 0.5, cellW - 1, cellH - 1);
          x.save(); x.beginPath(); x.rect(px + 8, py + 6, 56, 20); x.clip(); CB.drawSwatch(x, s, px + 8, py + 6, 56, 20, 1.3); x.restore();
          x.fillStyle = CB.RAR_COL[s.r]; x.font = '700 12px sans-serif'; x.textBaseline = 'middle';
          x.fillText(s.name + '   (' + s.id + ', ' + CB.RAR[s.r] + (s.ex ? ', trophy' : '') + ')', px + 72, py + 16);
          const times = two ? [1.3, 3.1] : [1.3];
          times.forEach((t, ti) => guns.forEach((g, gi) => {
            const cfg = Object.assign(CB.defaultConfig(g), { skin: s.id });
            CB.drawGun(x, g, cfg, px + 8 + ti * W + W / 2, py + 30 + gi * GH + GH / 2, W - 10, GH - 6, { time: t });
            if (two && gi === 0) { x.fillStyle = '#5d6a78'; x.font = '10px sans-serif'; x.fillText('t = ' + t, px + 12 + ti * W, py + 38); }
          }));
        });
        document.body.appendChild(c);
      }, { part, guns, W, GH, cellW, cellH, cols, rows, two, dpr: +dpr });
      const tag = what.indexOf(',') >= 0 ? 'pick' : what;
      const f = path.join(shots, 'skins_' + tag + '_' + sheet + '.png');
      await page.locator('#skinsheet').screenshot({ path: f }); files.push(f);
    }
  }
  console.log(files.map((f) => path.relative(path.join(__dirname, '..'), f)).join('\n'));
  if (errs.length) { console.log(errs.join('\n')); process.exitCode = 1; }
  await browser.close();
})();
