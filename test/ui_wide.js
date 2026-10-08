// Every screen outside a mission, on a phone held sideways, with real touch input.
//
// Two passes: 844 x 390 (a current phone) and 667 x 375 (an older, smaller one), both with fake
// notch insets of 50 px left and right and 21 px at the bottom, set the way test/snap.js does.
// Each screen is put up, photographed into shots/wide_<pass>_<name>.png and checked:
//   - nothing makes the page scroll sideways, and nothing visible pokes out past the screen
//   - nothing you can tap sits outside the safe area (a surface that covers the whole screen,
//     like a story card, is fine: you can tap it anywhere)
//   - the screen's main button is fully visible without scrolling
//   - everything you can tap is at least 40 px in both directions
// Then a few real journeys are driven with touch taps: start a contract from the title and back
// out through the notebook, buy a rifle, buy and fit a part, change skin, buy and open a cache,
// flip a setting and see it saved.
//
// usage: node test/ui_wide.js            both sideways passes, all checks
//        node test/ui_wide.js desktop    1440 x 900 with a mouse: pictures and page errors only
//        node test/ui_wide.js upright    390 x 844 with touch: pictures and page errors only
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const PASSES = {
  wide: { name: 'w844', w: 844, h: 390, touch: true, ins: [50, 50, 21], strict: true },
  small: { name: 'w667', w: 667, h: 375, touch: true, ins: [50, 50, 21], strict: true },
  desktop: { name: 'desk', w: 1440, h: 900, touch: false, ins: null, strict: false },
  upright: { name: 'tall', w: 390, h: 844, touch: true, ins: [0, 0, 20], strict: false },
};

// Runs in the page: looks at whatever is on screen and returns a list of problems.
function auditInPage(primary) {
  const W = window.innerWidth, H = window.innerHeight, cs = getComputedStyle(document.documentElement);
  const px = (k) => parseFloat(cs.getPropertyValue(k)) || 0;
  const safe = { l: px('--sal'), t: px('--sat'), r: W - px('--sar'), b: H - px('--sab') };
  const out = [], E = 0.75;
  const label = (e) => (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '') + (e.dataset && e.dataset.a ? '[data-a=' + e.dataset.a + ']' : '') + ' "' + (e.innerText || '').trim().slice(0, 24).replace(/\s+/g, ' ') + '"');
  if (document.documentElement.scrollWidth > W) out.push('the page scrolls sideways: ' + document.documentElement.scrollWidth + ' > ' + W);
  const over = document.getElementById('overlay'), top = over.classList.contains('show') ? over : document.getElementById('ui');
  // what is left of a box once every scrolling or clipping parent has cut it down
  const visible = (e) => {
    const r = e.getBoundingClientRect(); let v = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.display === 'none' || s.visibility === 'hidden') return null;
      if (s.overflowX !== 'visible' || s.overflowY !== 'visible') { const q = p.getBoundingClientRect(); v = { l: Math.max(v.l, q.left), t: Math.max(v.t, q.top), r: Math.min(v.r, q.right), b: Math.min(v.b, q.bottom) }; }
    }
    v = { l: Math.max(v.l, 0), t: Math.max(v.t, 0), r: Math.min(v.r, W), b: Math.min(v.b, H) };
    return v.r - v.l < 1 || v.b - v.t < 1 ? null : v;
  };
  // sideways scrolling inside any box
  top.querySelectorAll('*').forEach((e) => {
    const s = getComputedStyle(e);
    if ((s.overflowX === 'auto' || s.overflowX === 'scroll' || s.overflowY === 'auto' || s.overflowY === 'scroll') && e.scrollWidth > e.clientWidth + 1) out.push('scrolls sideways inside ' + label(e) + ': ' + e.scrollWidth + ' > ' + e.clientWidth);
  });
  // things you can tap
  const seen = new Set();
  top.querySelectorAll('[data-a], button, a, input, textarea, summary').forEach((e) => {
    if (seen.has(e)) return; seen.add(e);
    const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || s.pointerEvents === 'none') return;
    const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return;
    const v = visible(e); if (!v) return;
    if (r.width < 40 - E || r.height < 40 - E) out.push('too small to tap (' + r.width.toFixed(0) + ' x ' + r.height.toFixed(0) + '): ' + label(e));
    const covers = r.left <= safe.l && r.right >= safe.r && r.top <= safe.t && r.bottom >= safe.b;
    if (!covers && (v.l < safe.l - E || v.r > safe.r + E || v.t < safe.t - E || v.b > safe.b + E)) out.push('outside the safe area (' + [v.l, v.t, v.r, v.b].map((n) => n.toFixed(0)).join(',') + '): ' + label(e));
    // a finger has to be able to reach it: something else lying on top of it is a layout fault
    const pts = [[0.5, 0.5], [0.25, 0.5], [0.75, 0.5], [0.5, 0.25], [0.5, 0.75]];
    let hit = null; const reach = pts.some((p) => { hit = document.elementFromPoint(v.l + (v.r - v.l) * p[0], v.t + (v.b - v.t) * p[1]); return hit && (hit === e || e.contains(hit)); });
    if (!reach) out.push('covered by ' + (hit ? label(hit) : 'nothing') + ': ' + label(e));
  });
  // words: nothing spills out of its box sideways, and nothing is sliced off top or bottom
  top.querySelectorAll('*').forEach((e) => {
    const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim());
    const s = getComputedStyle(e); if (s.display === 'inline' || s.display === 'none') return;
    if (own && e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0 && visible(e)) {
      if (s.overflowX === 'visible') out.push('words spill out of their box (' + e.scrollWidth + ' > ' + e.clientWidth + '): ' + label(e));
      else if (s.textOverflow === 'ellipsis') out.push('NOTE cut short with dots: ' + label(e));
    }
    if (own) { const r = e.getBoundingClientRect(), v = visible(e); if (v && v.r - v.l < Math.min(r.right, W) - Math.max(r.left, 0) - 1) out.push('words cut off at the side by a box around them: ' + label(e)); }
    if (s.overflowY === 'hidden' && e.scrollHeight > e.clientHeight + 2 && e.innerText && e.innerText.trim() && visible(e) && e.tagName !== 'TEXTAREA') out.push('content sliced off (' + e.scrollHeight + ' > ' + e.clientHeight + '): ' + label(e));
  });
  // text must not run under the island either
  top.querySelectorAll('h1, h2, h3, p, li, b, td').forEach((e) => {
    if (!e.innerText || !e.innerText.trim()) return;
    const v = visible(e); if (!v) return;
    if (v.l < safe.l - E || v.r > safe.r + E) out.push('text outside the safe area (' + v.l.toFixed(0) + '..' + v.r.toFixed(0) + '): ' + label(e));
  });
  // the main button
  if (primary) {
    const e = top.querySelector(primary);
    if (!e) out.push('main button missing: ' + primary);
    else {
      const r = e.getBoundingClientRect(), v = visible(e);
      const covers = r.left <= safe.l && r.right >= safe.r && r.top <= safe.t && r.bottom >= safe.b;
      if (!v) out.push('main button not on screen: ' + primary);
      else if (!covers && (v.r - v.l < r.width - E || v.b - v.t < r.height - E || r.left < safe.l - E || r.right > safe.r + E || r.top < safe.t - E || r.bottom > safe.b + E)) out.push('main button needs scrolling or is cut off (' + [r.left, r.top, r.right, r.bottom].map((n) => n.toFixed(0)).join(',') + '): ' + primary);
      else { const hit = document.elementFromPoint((v.l + v.r) / 2, (v.t + v.b) / 2); if (!hit || !(hit === e || e.contains(hit))) out.push('main button is covered by ' + (hit ? label(hit) : 'nothing') + ': ' + primary); }
    }
  }
  return out;
}

// A save with plenty in it, so the armory, pickers, collection and caches have real content.
function richSaveInPage() {
  const d = CB.Save.data; d.seen.prologue = 1; for (let i = 1; i <= 6; i++) d.seen['ch' + i] = 1;
  d.credits = 46200; d.xp = 6200;
  ['halden', 'ratter', 'lark', 'orlov', 'marrow', 'stormglass', 'kessler'].forEach((g) => CB.Progress.grantGun(g));
  d.parts.mz_supl = 1; d.parts.sp_bipod = 1; d.parts.am_match = 1; d.parts.st_cheek = 1; d.scopes.tac = 1; d.scopes.bdc = 1; d.scopes.ranger = 1;
  const S = CB.SKINS.filter((s) => s.id !== 'factory' && !s.ex);
  S.forEach((s, i) => { if (i % 3 !== 1) d.skins[s.id] = 1; });           // about two thirds of the cache skins
  CB.SKINS.filter((s) => s.r === 4 && !s.ex).forEach((s) => { d.skins[s.id] = 1; }); // every legendary, so the moving ones are all there
  d.skins.duckie = 1;
  d.skinSeen = {}; Object.keys(d.skins).forEach((k, i) => { if (i % 5) d.skinSeen[k] = 1; });
  d.guns.halden.cfg.skin = 'kintsugi'; d.guns.halden.cfg.muzzle = 'mz_supl'; d.guns.halden.cfg.support = 'sp_bipod'; d.guns.halden.cfg.scope = 'tac'; d.equipped = 'halden';
  d.caches = ['field', 'sealed', 'field', 'vault'];
  CB.MISSIONS.slice(0, 17).forEach((m, i) => { d.missions[m.id] = { done: true, stars: 1 + (i % 3), ch: i % 2 === 0, plays: 1 }; if (i % 3 === 0) d.ducks[m.id] = 1; });
  d.stats.longest = 612; d.stats.shots = 143; d.stats.heads = 21; d.stats.wins = 30; d.stats.cachesOpened = 9;
  CB.Save.write(); CB.UI._chSet = false;
}

(async () => {
  const arg = process.argv[2] || '';
  const passes = arg === 'desktop' ? [PASSES.desktop] : arg === 'upright' ? [PASSES.upright] : [PASSES.wide, PASSES.small];
  const only = process.argv[3] ? process.argv[3].split(',') : null;
  const shots = path.join(__dirname, '..', 'shots'); fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const fails = [], log = [];
  for (const P of passes) {
    const ctx = await browser.newContext({ viewport: { width: P.w, height: P.h }, deviceScaleFactor: 2, hasTouch: P.touch, isMobile: P.touch });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => fails.push(P.name + ' PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
    page.on('console', (m) => { if (m.type() === 'error') fails.push(P.name + ' CONSOLE ' + m.text()); });
    const cdp = await ctx.newCDPSession(page);
    let tid = 1;
    const ev = (fn, a) => page.evaluate(fn, a);
    const wait = (ms) => page.waitForTimeout(ms);
    const insets = async () => { if (P.ins) await ev((i) => { const r = document.documentElement.style; r.setProperty('--sal', i[0] + 'px'); r.setProperty('--sar', i[1] + 'px'); r.setProperty('--sab', i[2] + 'px'); CB.Game.resize(); if (CB.UI.attract) CB.UI.attractLayout(); }, P.ins); };
    const open = async (q) => { await page.goto('file://' + path.join(__dirname, '..', 'index.html') + (q || '')); await insets(); };
    const fresh = async () => { await open(); await ev(() => { try { localStorage.clear(); } catch (e) { /* ok */ } }); await page.reload(); await insets(); await wait(700); };
    const tap = async (x, y) => {
      if (!P.touch) { await page.mouse.click(x, y); await wait(60); return; }
      const id = tid++; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id }] }); await wait(40);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(70);
    };
    // tap an element the way a finger would: it must be on screen, and nothing may be in the way
    const tapSel = async (sel) => {
      const loc = page.locator(sel).first(); if (!(await loc.count())) throw new Error(P.name + ': nothing matches ' + sel);
      await loc.scrollIntoViewIfNeeded(); await wait(80);
      const b = await loc.boundingBox(); if (!b) throw new Error(P.name + ': not visible ' + sel);
      await tap(b.x + b.width / 2, b.y + b.height / 2);
    };
    // open the notebook: the button top left with a finger, Esc on a computer (a headless mouse click
    // there is taken by the pointer lock first, which test/desktop.js covers on its own)
    const pause = async () => { if (P.touch) await tapSel('.h-pause'); else await page.keyboard.press('Escape'); };
    const ok = (c, what) => { log.push((c ? 'PASS ' : 'FAIL ') + P.name + ' ' + what); if (!c) fails.push('FAIL ' + P.name + ' ' + what); };
    // photograph and check one screen
    const look = async (name, primary, ms) => {
      if (only && only.indexOf(name) < 0) return;
      await wait(ms === undefined ? 450 : ms);
      await page.screenshot({ path: path.join(shots, 'wide_' + P.name + '_' + name + '.png') });
      const all = await ev(auditInPage, primary || null);
      const probs = all.filter((p) => p.indexOf('NOTE ') !== 0);
      all.filter((p) => p.indexOf('NOTE ') === 0).forEach((p) => log.push('     ' + P.name + ' ' + name + ': ' + p.slice(5)));
      if (P.strict) probs.forEach((p) => fails.push('FAIL ' + P.name + ' ' + name + ': ' + p));
      else probs.forEach((p) => log.push('     ' + P.name + ' ' + name + ' (not a failure in this shape): ' + p));
      log.push((probs.length && P.strict ? 'FAIL ' : 'ok   ') + P.name + ' ' + name);
    };

    // ---------------------------------------------------------------- a fresh save, by touch
    try {
    await fresh();
    await look('01_title', '[data-a="play"]', 900);
    await tapSel('[data-a="how"]'); await look('02_howto', '[data-a="close"]');
    await tapSel('#overlay [data-a="close"]');
    await tapSel('[data-a="settings"]'); await look('03_settings_from_title', '[data-a="back"]');
    await tapSel('[data-a="back"]'); await wait(200);
    await tapSel('[data-a="play"]'); await look('04_story', '.story', 700);
    ok(await page.locator('.story').count() === 1, 'the prologue card shows after Begin');
    for (let i = 0; i < 14 && (await page.locator('.story').count()); i++) { await tap(P.w / 2, P.h / 2); await wait(140); }
    ok(await page.locator('.mrow').count() === 7, 'contracts shows the seven missions of chapter one');
    await look('05_contracts_fresh', '.mrow[data-id="c1m1"]', 1500);
    await tapSel('.mrow[data-id="c1m1"]'); await look('06_brief', '[data-a="go"]', 900);
    ok(await page.locator('.brief').count() === 1, 'the briefing opens');
    await tapSel('[data-a="go"]'); await wait(1500);
    ok(await ev(() => CB.Game.state === 'mission' && !!CB.Game.sim), 'the mission starts from the briefing');
    await pause(); await wait(350);
    ok(await ev(() => CB.Game.paused) && (await page.locator('.nb').count()) === 1, 'the notebook opens and pauses the mission');
    await look('07_notebook', '.nb .sh-foot [data-a="resume"]');
    await tapSel('.nb [data-a="how"]'); await look('08_howto_in_mission', '[data-a="close"]');
    await tapSel('#overlay [data-a="close"]'); await wait(200);
    ok(await page.locator('.nb').count() === 1, 'closing How to play goes back to the notebook');
    await tapSel('.nb .sh-foot [data-a="resume"]'); await wait(300);
    ok(await ev(() => !CB.Game.paused && CB.Game.state === 'mission'), 'Resume goes back to the mission');
    await pause(); await wait(350);
    await tapSel('.nb [data-a="leave"]'); await wait(500);
    ok(await ev(() => CB.Game.state === 'menu') && (await page.locator('.mrow').count()) === 7, 'Give up leaves the mission and lands on contracts');

    // ---------------------------------------------------------------- a rich save, every screen
    await ev(richSaveInPage);
    await ev(() => { CB.UI.tab = 'contracts'; CB.UI.chapter = 2; CB.UI._chSet = true; CB.UI.hub(); });
    await look('10_contracts', '.mrow', 1800);
    await ev(() => CB.UI.rankInfo()); await look('11_rank', '[data-a="close"]');
    await ev(() => CB.UI.closeOverlay());
    const multi = await ev(() => { const m = CB.MISSIONS.find((x) => x.vantages && x.vantages.length > 1 && CB.Progress.missionOpen(x)); return m ? m.id : null; });
    if (multi) { await ev((id) => CB.UI.brief(CB.MISSION_BY_ID[id]), multi); await look('12_brief_positions', '[data-a="go"]', 900); }
    await ev(() => { const d = CB.Save.data; d.equipped = 'ratter'; const m = CB.MISSIONS.find((x) => CB.gunAllowed(x, CB.buildStats('ratter', d.guns.ratter.cfg)) && CB.Progress.missionOpen(x)); CB.UI.brief(m || CB.MISSIONS[0]); });
    await look('13_brief_wrong_rifle', '[data-a="gun"]', 900);
    await tapSel('[data-a="gun"]'); await look('14_gun_picker', '.grow');
    await tapSel('.grow[data-id="halden"]'); await wait(300);
    ok(await ev(() => CB.Save.data.equipped === 'halden'), 'picking a rifle in the briefing equips it');
    await ev(() => { CB.UI.tab = 'armory'; CB.UI.hub(); });
    await look('20_armory', '.acard', 900);
    ok(await page.locator('.acard').count() === 16, 'the armory lists sixteen rifles');
    await ev(() => CB.UI.bench('halden')); await look('21_bench', '.bench .cta > *', 700);
    await ev(() => { const s = document.querySelector('.bench .main.scroll'); s.scrollTop = 99999; }); await look('22_bench_scrolled', '.bench .cta > *', 500);
    await ev(() => CB.UI.bench('corvid')); await look('23_bench_to_buy', '[data-a="buy"]', 600);
    await ev(() => CB.UI.bench('aria')); await look('24_bench_locked', '.bench .cta > *', 600);
    await ev(() => CB.UI.bench('kessler')); await look('25_bench_fixed_scope', '.bench .cta > *', 600);
    for (const slot of ['scope', 'muzzle', 'barrel', 'stock', 'support', 'ammo', 'trigger', 'action', 'mag']) {
      await ev((s) => { CB.UI.bench('halden'); CB.UI.partPicker('halden', s); }, slot);
      await look('30_pick_' + slot, '.prow', 700);
      await ev(() => CB.UI.closeOverlay());
    }
    await ev(() => { CB.UI.bench('halden'); CB.UI.partPicker('halden', 'scope'); const b = document.querySelector('#overlay .sh-body'); b.scrollTop = 99999; }); await look('31_pick_scope_end', null, 700);
    await ev(() => { CB.UI.closeOverlay(); CB.UI.skinFilter = null; CB.UI.skinPicker('halden'); }); await look('32_skin_picker', '.skcell', 800);
    await ev(() => { CB.UI.skinFilter = 'l'; CB.UI.skinPicker('halden'); }); await look('33_skin_picker_legendary', '.skcell', 800);
    await ev(() => { CB.UI.skinFilter = null; CB.UI.closeOverlay(); CB.UI.dope(CB.buildStats('halden', CB.Save.data.guns.halden.cfg)); }); await look('34_ballistics_table', '[data-a="close"]');
    await ev(() => { CB.UI.closeOverlay(); CB.UI.tab = 'collection'; CB.UI.colTab = 'skins'; CB.UI.colSkin = null; CB.UI.hub(); });
    await look('40_collection', '.skcell', 900);
    const t0 = await ev(() => { const cells = document.querySelectorAll('.skgrid canvas'); let painted = 0; cells.forEach((c) => { if (c.width > 0 && c._job && c._job.done) painted++; }); return { cells: cells.length, painted, live: CB.UI.live.length }; });
    ok(t0.cells > 50 && t0.painted < t0.cells, 'skin pictures are drawn only as they come into view (' + t0.painted + ' of ' + t0.cells + ' drawn at first)');
    await ev(() => { CB.UI.skinFilter = 'l'; CB.UI.collection(); }); await look('41_collection_legendary', '.skcell', 900);
    const mv = await ev(async () => {
      const live = CB.UI.live.filter((l) => l.kind === 'swatch' && l.vis), n = document.querySelectorAll('.skgrid canvas').length;
      const snap = () => live.map((l) => { const x = l.cv.getContext('2d'), d = x.getImageData(0, 0, l.cv.width, l.cv.height).data; let s = 0; for (let i = 0; i < d.length; i += 97) s = (s * 31 + d[i]) >>> 0; return s; });
      const a = snap(); await new Promise((r) => setTimeout(r, 700)); const b = snap();
      return { n, live: live.length, moved: a.filter((v, i) => v !== b[i]).length };
    });
    ok(mv.live >= 3 && mv.moved === mv.live, 'every moving skin on screen is moving (' + mv.moved + ' of ' + mv.live + ', ' + mv.n + ' shown)');
    await ev(() => { CB.UI.skinFilter = null; CB.UI.collection(); const s = document.querySelector('.main.scroll'); s.scrollTop = 0; });
    await wait(500);
    const off = await ev(() => CB.UI.live.filter((l) => l.kind === 'swatch').length);
    ok(off === 0, 'moving skins that are scrolled out of view cost nothing (' + off + ' being redrawn with the legendary shelf off screen)');
    await ev(() => { CB.UI.colTab = 'caches'; CB.UI.collection(); }); await look('42_caches', '[data-a="buycache"]');
    await ev(() => { CB.Save.data.credits = 2000; CB.UI.collection(); }); await look('43_caches_poor', '[data-a="open"]');
    ok(await ev(() => { const b = [...document.querySelectorAll('[data-a="buycache"]')]; return b.length === 3 && !b[0].classList.contains('off') && b[1].classList.contains('off') && b[2].classList.contains('off') && /not enough credits/i.test(document.querySelector('.ccard.t-vault .cc-why').innerText); }), 'a cache you cannot afford has its Buy button off and says why');
    ok(await ev(() => /no real money/i.test(document.querySelector('.caches').innerText) && /credits/i.test(document.querySelector('.caches').innerText) && ['50%', '30%', '14%', '5%', '1%', '22%', '38%'].every((p) => document.querySelector('.cgrid').innerText.indexOf(p) >= 0)), 'the caches page says there is no real money and shows the odds as percentages');
    await ev(() => { CB.Save.data.credits = 46200; CB.UI.colTab = 'progress'; CB.UI.collection(); }); await look('44_progress', null);
    await ev(() => { CB.UI.colTab = 'caches'; CB.UI.collection(); CB.UI.openCache('vault'); }); await look('45_cache_shaking', null, 250);
    await look('46_cache_open', '[data-a="done"]', 1300);
    await ev(() => { CB.UI.closeOverlay(); CB.UI.tab = 'range'; CB.UI.hub(); }); await look('50_range', '[data-a="go"]', 600);
    await ev(() => { CB.UI.rangeCfg.dist = 1800; CB.UI.rangeCfg.wind = -8; CB.UI.range(); }); await look('51_range_far', '[data-a="go"]', 600);
    await ev(() => { CB.UI.rangeCfg.dist = 300; CB.UI.rangeCfg.wind = 0; CB.UI.tab = 'settings'; CB.UI.hub(); }); await look('52_settings', null);
    await ev(() => { document.querySelector('#ui .scroll').scrollTop = 99999; }); await look('53_settings_end', null, 300);
    ok(await ev(() => { const t = document.querySelector('#ui').innerText; return /kill camera/i.test(t) && /blood and x-ray detail/i.test(t) && !/slow motion/i.test(t); }), 'settings has the kill camera and blood switches and no slow motion switch');
    await ev(() => { document.querySelector('[data-a="export"]').click(); }); await look('54_save_code', '[data-a="copy"]');
    await ev(() => { CB.UI.closeOverlay(); document.querySelector('[data-a="reset"]').click(); }); await look('55_erase_confirm', '[data-a="close"]');
    await ev(() => { CB.UI.closeOverlay(); CB.UI.toast('Bought: Ranger 4-12x Mil-Dot', 'good'); CB.UI.toast('Not enough credits.', 'bad'); }); await look('56_toasts', null, 200);
    // results, with the real numbers from a run by the test bot
    const res = await ev(() => {
      const d = CB.Save.data, M = CB.MISSIONS[17], gid = 'halden';
      const cfg = CB.Test.cfgFor(M, gid, d.guns[gid].cfg), r = CB.Test.run(M.id, gid, { cfg, flags: d.flags, raw: true });
      if (!r.ok) return { err: r.fail || r.why };
      window.__res = r.res; r.res.stars = 3; r.res.clean = true; r.res.precise = true; r.res.challenge = true; r.res.stats.duck = true;
      CB.UI.results(M, r.res, { missionId: M.id, opts: { gun: gid } });
      return { ok: true, id: M.id };
    });
    if (res.ok) {
      await look('60_results_win', '[data-a="next"]', 2200);
      ok(await page.locator('.results.win').count() === 1, 'the results screen says the contract was won');
      await ev(() => { document.querySelector('.results .main.scroll').scrollTop = 99999; }); await look('61_results_win_end', '[data-a="next"]', 300);
      await ev(() => { const M = CB.MISSIONS[18], r = Object.assign({}, window.__res, { win: false, stars: 0, fail: { code: 'civ', text: 'You shot a bystander. The Ledger does not pay for mistakes, and the police do not forget them.' } }); CB.UI.results(M, r, { missionId: M.id, opts: { gun: 'halden' } }); });
      await look('62_results_lose', '[data-a="again"]', 500);
    } else fails.push('FAIL ' + P.name + ' could not make a result to show: ' + res.err);
    // the longest story page in the game, and the last one
    // story pages: a chapter opening, the epilogue, and every page of both checked for text that does not fit
    await ev(() => CB.UI.chapterIntro(3, () => CB.UI.hub()));
    await look('63_story_chapter', '.story', 800);
    await ev(() => CB.UI.epilogue(() => CB.UI.hub())); await look('64_epilogue', '.story', 800);
    const clipped = await ev(() => {
      const bad = [], page = (tag) => { const b = document.querySelector('.st-in'); if (b && b.scrollHeight > b.clientHeight + 1) bad.push(tag + ' (' + b.scrollHeight + ' > ' + b.clientHeight + ')'); };
      const walk = (tag) => { let n = 0; while (document.querySelector('.story') && n < 20) { page(tag + ' page ' + (n + 1)); document.querySelector('.story').click(); n++; } };
      CB.UI.prologue(); walk('prologue');
      for (let c = 1; c <= 6; c++) { CB.UI.chapterIntro(c, () => CB.UI.hub()); walk('chapter ' + c); }
      CB.UI.epilogue(() => CB.UI.hub()); walk('epilogue');
      return bad;
    });
    ok(clipped.length === 0, 'no story page is cut off' + (clipped.length ? ': ' + clipped.join('; ') : ''));

    // ---------------------------------------------------------------- journeys, by touch
    if (P.strict) {
      await ev(() => { const d = CB.Save.data; d.credits = 30000; delete d.guns.corvid; CB.Save.write(); CB.UI.tab = 'contracts'; CB.UI.hub(); });
      await tapSel('.tabb[data-tab="armory"]'); await wait(400);
      ok(await page.locator('.acard').count() === 16, 'the Armory tab opens the armory');
      await tapSel('.acard[data-id="corvid"]'); await wait(400);
      await tapSel('[data-a="buy"]'); await wait(400);
      ok(await ev(() => !!CB.Save.data.guns.corvid && CB.Save.data.credits === 30000 - 11500 && CB.Save.data.equipped === 'corvid'), 'buying a rifle spends the credits and puts it in your hands');
      await tapSel('.slot[data-slot="muzzle"]'); await wait(400);
      ok(await page.locator('#overlay .prow').count() >= 4, 'tapping the muzzle tile opens its part cards');
      const c0 = await ev(() => CB.Save.data.credits);
      await tapSel('#overlay .prow[data-id="mz_suph"]'); await wait(450);
      ok(await ev((c) => CB.Save.data.parts.mz_suph === 1 && CB.Save.data.guns.corvid.cfg.muzzle === 'mz_suph' && CB.Save.data.credits === c - 3600, c0), 'tapping a part you do not own buys it and fits it');
      ok(await ev(() => { const c = document.querySelector('.slot[data-slot="muzzle"] canvas'); return c && c.dataset.partId === 'mz_suph' && c.width > 100; }), 'the muzzle tile now shows a picture of the new part');
      await tapSel('.slot[data-slot="muzzle"]'); await wait(350);
      await tapSel('#overlay .prow[data-id="mz_supl"]'); await wait(450);
      ok(await ev((c) => CB.Save.data.guns.corvid.cfg.muzzle === 'mz_supl' && CB.Save.data.credits === c - 3600, c0), 'tapping a part you already own fits it without charging again');
      await tapSel('.slot[data-slot="scope"]'); await wait(450);
      ok(await ev(() => { const g = [...document.querySelectorAll('#overlay .prow canvas.glass')]; return g.length >= 8; }), 'every scope card has the view through its glass');
      await tapSel('#overlay [data-a="close"]'); await wait(250);
      await tapSel('.slot[data-slot="skin"]'); await wait(500);
      const skinId = await ev(() => { const c = [...document.querySelectorAll('#overlay .skcell.own')].find((e) => e.dataset.id !== 'factory' && !e.classList.contains('on')); return c.dataset.id; });
      await tapSel('#overlay .skcell[data-id="' + skinId + '"]'); await wait(350);
      ok(await ev((id) => CB.Save.data.guns.corvid.cfg.skin === id && JSON.parse(localStorage.getItem('coldbore.save.v1')).guns.corvid.cfg.skin === id, skinId), 'tapping a skin fits it and saves it (' + skinId + ')');
      await tapSel('#overlay .cta [data-a="close"]'); await wait(350);
      ok(await ev((id) => document.querySelector('.slot[data-slot="skin"] canvas').dataset.swatch === id && !document.getElementById('overlay').classList.contains('show'), skinId), 'Done closes the skin picker and the bench shows the new skin');
      await tapSel('.bench [data-a="back"]'); await wait(300);
      await tapSel('.tabb[data-tab="collection"]'); await wait(400);
      await tapSel('.seg [data-t="caches"]'); await wait(350);
      const b0 = await ev(() => { const d = CB.Save.data; d.caches = []; CB.UI.collection(); return { cr: d.credits, skins: Object.keys(d.skins).length }; });
      await tapSel('.ccard.t-sealed [data-a="buycache"]'); await wait(400);
      ok(await ev((b) => CB.Save.data.caches.length === 1 && CB.Save.data.caches[0] === 'sealed' && CB.Save.data.credits === b.cr - 4500, b0), 'buying a sealed cache spends 4,500 credits and adds the cache');
      await tapSel('.cachebox [data-a="open"]'); await wait(1500);
      await look('70_cache_opened_by_touch', '[data-a="done"]', 100);
      ok(await ev((b) => { const d = CB.Save.data; return d.caches.length === 0 && (Object.keys(d.skins).length === b.skins + 1 || d.credits > b.cr - 4500); }, b0), 'opening it gives a skin (or credits for one already owned)');
      await tapSel('#overlay [data-a="done"]'); await wait(300);
      ok(await ev(() => !document.getElementById('overlay').classList.contains('show')), 'Done closes the cache');
      await tapSel('.tabb[data-tab="settings"]'); await wait(350);
      const k0 = await ev(() => CB.Save.data.settings.killcam);
      await tapSel('[data-k="killcam"]'); await wait(250);
      ok(await ev((k) => CB.Save.data.settings.killcam === !k && JSON.parse(localStorage.getItem('coldbore.save.v1')).settings.killcam === !k, k0), 'flipping the kill camera switch changes the setting and saves it');
      await tapSel('[data-k="gore"]'); await wait(250);
      ok(await ev(() => CB.Save.data.settings.gore === false && JSON.parse(localStorage.getItem('coldbore.save.v1')).settings.gore === false), 'the blood switch saves too');
      await tapSel('.tabb[data-tab="range"]'); await wait(350);
      await tapSel('[data-a="d"][data-v="100"]'); await wait(200);
      ok(await ev(() => CB.UI.rangeCfg.dist === 400), 'the range distance button works');
      await tapSel('[data-a="go"]'); await wait(1400);
      ok(await ev(() => CB.Game.state === 'mission' && CB.Game.mission.practice), 'the practice range starts');
      await pause(); await wait(350);
      await tapSel('.nb [data-a="leave"]'); await wait(400);
      ok(await ev(() => CB.Game.state === 'menu' && !!document.querySelector('.rangev')), 'leaving the range lands back on the range screen');
      // a save moved to another browser as a code
      const code = await ev(() => CB.Save.exportText());
      await ev(() => { try { localStorage.clear(); } catch (e) { /* ok */ } }); await page.reload(); await insets(); await wait(500);
      ok(await ev(() => Object.keys(CB.Save.data.guns).length === 1), 'after wiping the browser the save is fresh');
      ok(await ev((c) => CB.Save.importText(c) && !!CB.Save.data.guns.corvid && CB.Save.data.settings.gore === false, code), 'a save code brings everything back');
      // a mission started straight from the address bar still reaches the notebook
      await open('?m=c1m1'); await wait(900);
      ok(await ev(() => CB.Game.state === 'mission'), 'the ?m= debug start goes straight into the mission');
      await pause(); await wait(350);
      ok(await page.locator('.nb').count() === 1, 'the notebook opens in a mission started with ?m=');
      await look('71_notebook_debug_start', '.nb .sh-foot [data-a="resume"]', 100);
    }
    } catch (e) {
      fails.push('FAIL ' + P.name + ' the walk stopped: ' + e.message.split('\n')[0]);
      await page.screenshot({ path: path.join(shots, 'wide_' + P.name + '_STOPPED.png') }).catch(() => {});
    }
    await ctx.close();
  }
  console.log(log.join('\n'));
  if (fails.length) { console.log('\n' + fails.join('\n')); console.log('\n' + fails.length + ' PROBLEMS'); process.exitCode = 1; } else console.log('\nALL WIDE-SCREEN CHECKS PASSED');
  await browser.close();
})();
