// Contact sheets of the part artwork (src/12_partart.js), saved in shots/.
// usage: node test/parts.js [section] [guns] [skin] [tileW] [tileH]
//   section: all | scopes | glass | muzzle | barrel | stock | support | ammo | trigger | action | mag | small | dim | xl
//   guns:    comma list of rifle ids (default fenwick,northwind,lark)
//   skin:    a skin id to paint with (default factory)
// "all" writes one sheet per section.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const [section = 'all', gunsArg = '', skin = 'factory', tw = '190', th = '118'] = process.argv.slice(2);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html') + '?test');
  await page.waitForTimeout(400);
  const out = path.join(__dirname, '..', 'shots');
  fs.mkdirSync(out, { recursive: true });
  const SLOTS = ['muzzle', 'barrel', 'stock', 'support', 'ammo', 'trigger', 'action', 'mag'];
  if (section === 'check' || section === 'all') {
    // every rifle x every part and scope x several skins, bright and greyed: nothing may throw, and
    // nothing may draw outside its box
    const r = await page.evaluate(() => {
      const cv = document.createElement('canvas'); cv.width = 520; cv.height = 360;
      const c = cv.getContext('2d'), bad = [], skins = ['factory', 'midas', 'aurora', 'woodland', 'hazard', 'damascus'];
      let n = 0, spill = 0; const t0 = performance.now();
      const outside = () => { // any paint outside the 200x120 box at (160,120), with a 3 pixel allowance?
        const d = c.getImageData(0, 0, 520, 360).data;
        for (let y = 0; y < 360; y += 2) for (let x = 0; x < 520; x += 2) { if (x >= 157 && x <= 363 && y >= 117 && y <= 243) continue; if (d[(y * 520 + x) * 4 + 3] > 24) return true; }
        return false;
      };
      CB.GUNS.forEach((g, gi) => {
        const items = CB.SCOPES.map((s) => ['scope', s.id]).concat(CB.PARTS.map((p) => [p.slot, p.id]));
        items.forEach(([slot, id], ii) => {
          const skin = skins[(gi + ii) % skins.length];
          [0, 1].forEach((dim) => {
            try { c.clearRect(0, 0, 520, 360); CB.drawPartArt(c, slot, id, 160, 120, 200, 120, { gunId: g.id, cfg: Object.assign(CB.defaultConfig(g.id), { skin }), time: 2.1, dim }); n++; if (outside()) { spill++; if (bad.length < 12) bad.push('SPILL ' + g.id + ' ' + id + ' ' + skin + ' dim ' + dim); } }
            catch (e) { bad.push(g.id + ' ' + slot + ' ' + id + ' ' + skin + ': ' + e.message); }
          });
        });
        CB.SCOPES.forEach((s) => { try { c.clearRect(0, 0, 520, 360); CB.drawReticleThumb(c, s.id, 260, 180, 60, { gunId: g.id, time: 2.1 }); n++; if ((() => { const d = c.getImageData(0, 0, 520, 360).data; for (let y = 0; y < 360; y += 2) for (let x = 0; x < 520; x += 2) if (Math.hypot(x - 260, y - 180) > 62 && d[(y * 520 + x) * 4 + 3] > 24) return true; return false; })()) { spill++; bad.push('SPILL glass ' + s.id); } } catch (e) { bad.push(g.id + ' glass ' + s.id + ': ' + e.message); } });
      });
      // odd input must be ignored quietly
      try { CB.drawPartArt(c, 'scope', 'nope', 0, 0, 100, 60); CB.drawPartArt(c, 'bogus', 'mz_none', 0, 0, 100, 60, {}); CB.drawPartArt(c, 'ammo', 'am_ball', 0, 0, 0, 0, {}); CB.drawPartArt(c, 'stock', 'st_std', 0, 0, 80, 50, { gunId: 'nope' }); CB.drawReticleThumb(c, 'nope', 50, 50, 20); CB.drawReticleThumb(c, 'tac', 50, 50, 0); }
      catch (e) { bad.push('odd input: ' + e.message); }
      return { n, spill, bad, ms: (performance.now() - t0) / n };
    });
    console.log('check: ' + r.n + ' drawings, ' + r.spill + ' outside their box, ' + r.bad.length + ' problems, ' + r.ms.toFixed(2) + ' ms each (including the pixel check)');
    if (r.bad.length) { console.log('  ' + r.bad.join('\n  ')); process.exitCode = 1; }
    if (section === 'check') { await browser.close(); return; }
  }
  const list = section === 'all' ? ['scopes', 'glass'].concat(SLOTS, ['small', 'dim']) : [section];
  for (const sec of list) {
    const res = await page.evaluate(({ sec, gunsArg, skin, tw, th, SLOTS }) => {
      const DPR = 2, BG = ['#2a3442', '#3a4758'], TW = +tw, TH = +th, PAD = 10, LBL = 15;
      const guns = gunsArg ? gunsArg.split(',') : ['fenwick', 'northwind', 'lark'];
      const cells = []; // { x, y, w, h, label, draw(ctx, x, y, w, h) }
      let cy = PAD, maxW = 0;
      const row = (title, items) => {
        cells.push({ title, x: PAD, y: cy }); cy += 18;
        let cx = PAD, rh = 0;
        items.forEach((it) => { if (cx + it.w > 2300) { cx = PAD; cy += rh + LBL + PAD; rh = 0; } cells.push(Object.assign({ x: cx, y: cy }, it)); cx += it.w + PAD; rh = Math.max(rh, it.h); maxW = Math.max(maxW, cx); });
        cy += rh + LBL + PAD;
      };
      const cfgFor = (g, extra) => Object.assign(CB.defaultConfig(g), { skin }, extra || {});
      const part = (slot, id, g, w, h, extra) => ({ w, h, label: id + (g ? ' / ' + g : ''), draw: (c, x, y) => CB.drawPartArt(c, slot, id, x, y, w, h, Object.assign({ gunId: g, cfg: cfgFor(g), time: 1.3 }, extra || {})) });
      const glass = (id, g, r, extra) => ({ w: r * 2, h: r * 2, label: id + (extra && extra.zoom ? ' ' + extra.zoom + 'x' : ''), draw: (c, x, y) => CB.drawReticleThumb(c, id, x + r, y + r, r, Object.assign({ gunId: g, time: 1.3 }, extra || {})) });
      const fits = (slot, g) => CB.PARTS.filter((p) => p.slot === slot);
      if (sec === 'scopes') {
        CB.SCOPES.forEach((s) => row(s.id + '  ' + s.name, [part('scope', s.id, 'halden', 260, 150), glass(s.id, 'halden', 75), part('scope', s.id, 'halden', TW, TH), glass(s.id, 'halden', 48), part('scope', s.id, 'halden', 96, 60), glass(s.id, 'halden', 28), part('scope', s.id, 'halden', 130, 60, { cfg: cfgFor('halden', { skin: 'desert' }) }), part('scope', s.id, 'halden', 130, 60, { cfg: cfgFor('halden', { skin: 'midas' }) })]));
      } else if (sec === 'glass') {
        CB.SCOPES.forEach((s) => row(s.id + ' at low, default and high zoom; real reticle then the built-in copy; then other rifles', [
          glass(s.id, 'halden', 95, { zoom: s.zoom[0] }), glass(s.id, 'halden', 95), glass(s.id, 'halden', 95, { zoom: s.zoom[1] }),
          glass(s.id, 'halden', 95, { own: true }), glass(s.id, 'ratter', 60), glass(s.id, 'aria', 60), glass(s.id, 'halden', 40), glass(s.id, 'halden', 24)]));
      } else if (sec === 'xl') {
        for (let i = 0; i < CB.SCOPES.length; i += 3) row('scopes, large', CB.SCOPES.slice(i, i + 3).map((s) => part('scope', s.id, guns[0], 520, 250)));
        SLOTS.forEach((slot) => row(slot + ' on ' + guns[0] + ', large', fits(slot).slice(0, 6).map((p) => part(slot, p.id, guns[0], 360, 224))));
      } else if (sec === 'small') {
        row('scopes at 96x60', CB.SCOPES.map((s) => part('scope', s.id, 'fenwick', 96, 60)));
        SLOTS.forEach((slot) => guns.slice(0, 2).forEach((g) => row(slot + ' on ' + g + ' at 96x60', fits(slot, g).map((p) => part(slot, p.id, g, 96, 60)))));
      } else if (sec === 'dim') {
        row('locked (dim 1) and half', CB.SCOPES.slice(0, 6).map((s) => part('scope', s.id, 'fenwick', 150, 90, { dim: 1 })).concat(CB.SCOPES.slice(0, 3).map((s) => part('scope', s.id, 'fenwick', 150, 90, { dim: 0.5 }))));
        SLOTS.forEach((slot) => row(slot + ' dim', fits(slot, 'fenwick').map((p) => part(slot, p.id, 'fenwick', 150, 90, { dim: 1 }))));
      } else {
        guns.forEach((g) => row(sec + ' on ' + g + ' (' + CB.GUNS.find((q) => q.id === g).calName + ')', fits(sec, g).map((p) => part(sec, p.id, g, TW, TH))));
      }
      const W = Math.max(maxW, 600), H = cy;
      const cv = document.createElement('canvas'); cv.width = W * DPR; cv.height = H * DPR;
      const c = cv.getContext('2d'); c.scale(DPR, DPR);
      const bg = c.createLinearGradient(0, 0, W, 0); bg.addColorStop(0, BG[0]); bg.addColorStop(1, BG[1]); c.fillStyle = bg; c.fillRect(0, 0, W, H);
      const errs = [];
      cells.forEach((q) => {
        if (q.title) { c.fillStyle = '#e9e4d6'; c.font = '600 12px sans-serif'; c.textBaseline = 'top'; c.fillText(q.title, q.x, q.y); return; }
        c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 1; c.strokeRect(q.x - 0.5, q.y - 0.5, q.w + 1, q.h + 1);
        try { c.save(); q.draw(c, q.x, q.y); c.restore(); } catch (e) { c.restore(); errs.push(q.label + ': ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')); c.fillStyle = '#ff5a4a'; c.fillRect(q.x, q.y, q.w, q.h); }
        c.fillStyle = 'rgba(233,228,214,0.75)'; c.font = '10px sans-serif'; c.textBaseline = 'top'; c.fillText(q.label, q.x, q.y + q.h + 3, q.w + PAD - 2);
      });
      return { url: cv.toDataURL('image/png'), errs, W, H };
    }, { sec, gunsArg, skin, tw, th, SLOTS });
    const name = 'parts_' + sec + (skin !== 'factory' ? '_' + skin : '') + (gunsArg ? '_' + gunsArg.replace(/,/g, '-') : '') + '.png';
    fs.writeFileSync(path.join(out, name), Buffer.from(res.url.split(',')[1], 'base64'));
    console.log(sec, res.W + 'x' + res.H, '->', 'shots/' + name, res.errs.length ? '\n  ' + res.errs.slice(0, 8).join('\n  ') : '');
    if (res.errs.length) process.exitCode = 1;
  }
  if (errs.length) { console.log(errs.join('\n')); process.exitCode = 1; }
  await browser.close();
})();
