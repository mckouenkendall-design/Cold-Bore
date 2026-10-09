// Contact sheets of the people, so the figure art can be checked by eye at every size and
// in every light. Nothing here plays a mission: figures are drawn straight onto a canvas.
//   usage: node test/figs.js [sheet,sheet,...|all] [dpr]
//   sheets: anims hats bags looks sizes light death walk turn bench
// Pictures go in shots/figs_<sheet>.png. "bench" prints how long a figure takes to draw.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// ---- runs in the page ------------------------------------------------------
function pageMain(name) {
  const mix = CB.util.mix, fig = CB.fig;
  const palOf = (want) => {
    for (const M of CB.MISSIONS) {
      const gun = (CB.GUNS.find((g) => !CB.gunAllowed(M, CB.buildStats(g.id, CB.Test.cfgFor(M, g.id)))) || CB.GUNS[0]).id;
      const sim = new CB.Sim(M, CB.buildStats(gun, CB.Test.cfgFor(M, gun)), 0, { flags: (M.testFlags || [{}])[0], shotSeed: 1 });
      if (sim.S.time === want) return sim.S.pal;
    }
    return null;
  };
  const PAL = window.__pal || (window.__pal = { day: palOf('day'), night: palOf('night'), dusk: palOf('dusk'), snow: palOf('snow') || palOf('overcast') });
  // The same recipe as figEnv in src/06_view.js.
  const envFor = (kind, px, o) => {
    o = o || {};
    const night = /^night|^nv/.test(kind), nv = /^nv/.test(kind), pal = night ? PAL.night : kind === 'dusk' ? PAL.dusk : kind === 'snow' ? PAL.snow : PAL.day;
    const light = kind === 'night-lit' ? 1 : kind === 'night-half' ? 0.4 : kind === 'night-dark' ? 0 : kind === 'nv' ? 0 : kind === 'nv-lit' ? 1 : 1, k = 1 - light;
    const wind = o.wind || 0;
    const e = { px, ink: pal.ink, rim: pal.rim, smoke: 'rgba(220,225,232,0.35)', windDrift: wind * 0.08, wind, light, lampDx: night && light > 0 ? (o.lampDx === undefined ? -2.5 : o.lampDx) : 0, lampH: 5, lampCol: pal.lit, night, nv, t: o.t || 0, pal, haze: 0, gore: o.gore !== false, weather: o.weather || 'clear' };
    if (night) {
      e.dark = true; e.dim = (nv ? 0.25 : 0.72) * k; e.ink = mix(pal.ink, '#04060a', k);
      e.rim = nv ? 'rgba(190,255,200,' + (0.75 + 0.15 * k).toFixed(2) + ')' : 'rgba(' + Math.round(170 - 50 * k) + ',' + Math.round(190 - 50 * k) + ',' + Math.round(225 - 50 * k) + ',' + (0.42 - 0.18 * k).toFixed(2) + ')';
    } else if (nv) e.rim = 'rgba(190,255,200,0.75)';
    return e;
  };
  const BG = { day: ['#b7b1a4', '#8f8a80'], dusk: ['#6d6470', '#4b4652'], snow: ['#cfd8e0', '#eef2f6'], 'night-lit': ['#39414f', '#2a3040'], 'night-half': ['#232a38', '#1b2130'], 'night-dark': ['#141a26', '#10151f'], nv: ['#141a26', '#10151f'], 'nv-lit': ['#39414f', '#2a3040'] };
  const COL = { red: '#c8372d', blue: '#2f6db5', green: '#3f8f4f', yellow: '#e2b33c', white: '#ece8dc', grey: '#7a8088', orange: '#e07b2a', brown: '#7b5a36', black: '#1d2026', teal: '#2a9d8f', navy: '#27365a', cream: '#e8dcc0', tan: '#b89a6a', olive: '#5d6b3a', wine: '#7a2438', sky: '#7fb6e6', pink: '#e07a9a' };
  let uid = 0;
  const actor = (o) => Object.assign({ id: 'a' + (uid++), x: 0, y: 0, face: 1, anim: 'stand', t: 3.7, ph: 1.1, seed: 4.2, look: {}, state: 'calm', goal: null }, o || {});
  // cells: { label, a (actor), env kind, h (pixels tall), w (cell width), eo (env options), post }
  const cells = [];
  const add = (label, a, kind, h, o) => cells.push(Object.assign({ label, a, kind: kind || 'day', h: h || 200 }, o || {}));
  const ANIMS = ['stand', 'walk', 'run', 'panic', 'phone', 'smoke', 'drink', 'talk', 'sit', 'type', 'sitphone', 'sitdrink', 'lean', 'guard', 'aim', 'aimrifle', 'look', 'wave', 'point', 'kneel', 'cower', 'work', 'sweep', 'arms', 'hands', 'drive', 'sleep'];
  const HATS = ['fedora', 'cap', 'beanie', 'hardhat', 'tophat', 'beret', 'hood', 'peaked', 'sun', 'helmet'];
  const BAGS = ['backpack', 'case', 'duffel', 'shopping', 'umbrella', 'cane', 'clip', 'cup', 'box', 'paper', 'flowers', 'guitar', 'balloon'];
  const LOOKS = [
    ['collector', { hat: 'fedora', hatCol: '#22252b', hatBand: COL.red, coat: COL.grey, long: true, bag: 'case' }],
    ['bagman', { hat: 'cap', hatCol: '#3f6fb0', bag: 'duffel', bagCol: '#5d7a4a', coat: '#39404a' }],
    ['red umbrella', { bag: 'umbrella', bagCol: COL.red, coat: '#2f3640' }],
    ['raincoat', { coat: '#d8b52a', long: true, hat: 'hood', hatCol: '#d8b52a' }],
    ['clerk', { hat: 'hardhat', hatCol: '#ece8dc', vest: '#e07b2a', vestStripe: '#f1ede2', bag: 'clip', build: 'big' }],
    ['docker', { hat: 'hardhat', hatCol: '#e2b33c', vest: '#e07b2a', vestStripe: '#f1ede2' }],
    ['dutch', { build: 'big', beard: '#9a9fa6', coat: '#15171b', long: true, scarf: COL.red, h: 1.08 }],
    ['white suit', { coat: COL.cream, long: true, hat: 'sun', hatCol: '#efe6cf', hatBand: '#22252b', bag: 'cane' }],
    ['august', { hair: 'white', coat: '#3f8f4f', long: true, bag: 'cane', h: 0.97 }],
    ['suit', { coat: '#2a2f38', glasses: 'shades', hair: 'white', tie: COL.red }],
    ['wine dress', { hair: 'long', dress: COL.wine, bag: 'shopping' }],
    ['sun dress', { hat: 'sun', hatCol: '#e8dcc0', hatBand: COL.red, dress: COL.yellow }],
    ['bun teal', { hair: 'bun', dress: COL.teal, bag: 'cup' }],
    ['officer', { hat: 'peaked', hatCol: '#27365a', coat: '#27365a', gun: 'rifle' }],
    ['gunman', { mask: '#16181d', coat: '#2a2d33', hat: 'beanie', hatCol: '#16181d', gun: 'rifle' }],
    ['blue vest', { hat: 'cap', hatCol: '#3f6fb0', vest: '#3f6fb0' }],
    ['waistcoat', { vest: '#8d949c', glasses: true, hair: 'short', hairCol: '#3a2a20', tie: COL.blue }],
    ['ear defenders', { hat: 'hardhat', hatCol: COL.orange, vest: COL.yellow, phones: '#c8372d' }],
    ['aurel', { hair: 'white', coat: '#15171b', long: true, scarf: COL.red, bag: 'case', h: 1.06 }],
    ['brandt', { hair: 'long', hairCol: '#8a3b24', coat: COL.teal, scarf: COL.yellow, bag: 'case' }],
    ['busker', { hair: 'bun', hairCol: '#2a2019', coat: '#c98a2b', glasses: true, bag: 'guitar', bagCol: '#20242c', h: 0.96 }],
    ['cook', { hat: 'tophat', hatCol: '#f4f1e6', coat: '#f4f1e6', long: true, bag: 'cup' }],
    ['plain', {}],
    ['hiker', { hat: 'beanie', bag: 'backpack' }],
    ['mohawk', { hair: 'mohawk', coat: COL.olive }],
    ['pilot', { hat: 'helmet', hatCol: '#ece8dc', vest: COL.orange }],
    ['smock', { smock: '#d9d4c6', hat: 'beret', hatCol: '#7a2438' }],
    ['beard cap', { hat: 'cap', hatCol: '#4a5a3a', coat: '#55653c', beard: '#5a4634' }],
  ];
  const lookOf = (n) => Object.assign({}, LOOKS.find((l) => l[0] === n)[1]);
  const dead = (o) => actor(Object.assign({ dead: true, deathPose: 'stand', deathAt: 3.7, deathPh: 1.1, deathHow: 'shot', deathPart: 'torso', deathDir: 0, deathKind: 'back' }, o));

  if (name === 'anims' || name === 'anims2') {
    const half = Math.ceil(ANIMS.length / 2), list = name === 'anims' ? ANIMS.slice(0, half) : ANIMS.slice(half);
    const lk = [{}, { coat: COL.tan, hair: 'short' }, { hair: 'long', dress: COL.wine }, { hat: 'cap', hatCol: '#3f6fb0', vest: '#3f6fb0' }, { coat: '#39404a', long: true, hat: 'fedora', hatCol: '#22252b' }];
    list.forEach((an, i) => add(an, actor({ anim: an, look: Object.assign(an === 'aimrifle' || an === 'guard' ? { gun: 'rifle' } : {}, lk[i % lk.length]), face: i % 4 === 3 ? -1 : 1, seed: 1 + i * 0.7, t: 2.3 + i * 0.61, ph: 0.8 + i }), 'day', 190));
  } else if (name === 'hats' || name === 'hats2') {
    (name === 'hats' ? HATS.slice(0, 5) : HATS.slice(5)).forEach((h) => { const L = { hat: h, hatCol: h === 'hardhat' ? '#e2b33c' : h === 'sun' ? '#e8dcc0' : h === 'tophat' ? '#22252b' : h === 'helmet' ? '#ece8dc' : h === 'cap' ? '#3f6fb0' : h === 'beret' ? '#7a2438' : h === 'hood' ? '#d8b52a' : h === 'peaked' ? '#27365a' : h === 'beanie' ? '#5a2a2a' : '#5a4634', coat: h === 'hood' ? '#d8b52a' : '#4a505a' }; if (h === 'fedora' || h === 'tophat' || h === 'sun') L.hatBand = COL.red;
      const o = { crop: 0.42, w: 186, rowKey: h };
      add(h, actor({ look: L }), 'day', 300, o); add(h + ' left', actor({ look: L, face: -1 }), 'day', 300, o); add(h + ' turn .4', actor({ look: L, faceS: 0.4 }), 'day', 300, o); add(h + ' turn -.4, night', actor({ look: L, faceS: -0.4, face: -1 }), 'night-lit', 300, o); });
  } else if (name === 'heads' || name === 'heads2') {
    const HEADS = [['long', {}], ['bun', {}], ['mohawk', {}], ['short', {}], ['white', {}], ['short', { beard: true }], ['white', { beard: '#e8e8e2', glasses: true }], [null, { glasses: 'shades' }], [null, { mask: '#16181d' }], [null, { phones: COL.red }], ['long', { hairCol: '#c2452d', glasses: true }], [null, {}]];
    (name === 'heads' ? HEADS.slice(0, 6) : HEADS.slice(6)).forEach(([hr, x], i) => { const L = Object.assign({ coat: i % 2 ? COL.navy : null }, x); if (hr) L.hair = hr;
      const o = { crop: 0.42, w: 186, rowKey: i };
      add((hr || 'none') + ' ' + Object.keys(x).join(','), actor({ look: L }), 'day', 300, o); add('left', actor({ look: L, face: -1 }), 'day', 300, o); add('turn .4', actor({ look: L, faceS: 0.4 }), 'day', 300, o); add('turn -.4, night', actor({ look: L, faceS: -0.4, face: -1 }), 'night-lit', 300, o); });
  } else if (name === 'bags' || name === 'bags2') {
    const list = name === 'bags' ? BAGS.slice(0, 7) : BAGS.slice(7);
    list.forEach((b) => { const L = { bag: b, coat: '#4a515c' }; if (b === 'duffel') L.bagCol = '#5d7a4a';
      const tall = b === 'umbrella' || b === 'balloon' ? { tall: 1.75 } : {};
      add(b, actor({ look: L }), 'day', 200, tall); add(b + ' walk left', actor({ look: L, face: -1, anim: 'walk', ph: 2.2 }), 'day', 200, tall); add(b + ' turn .4', actor({ look: L, faceS: 0.4 }), 'day', 200, tall); add(b + ' night', actor({ look: L, anim: 'walk', ph: 0.4 }), 'night-lit', 200, Object.assign({ eo: { weather: 'rain' } }, tall)); });
  } else if (name === 'looks' || name === 'looks2') {
    const half = Math.ceil(LOOKS.length / 2), list = name === 'looks' ? LOOKS.slice(0, half) : LOOKS.slice(half);
    list.forEach(([n, L], i) => { const tall = L.bag === 'umbrella' ? { tall: 1.75 } : {}; add(n, actor({ look: Object.assign({}, L), anim: i % 2 ? 'walk' : 'stand', ph: 0.9 + i * 0.8, face: i % 3 === 2 ? -1 : 1, seed: i * 1.3 }), 'day', 200, tall); });
  } else if (/^big/.test(name)) {
    // a few people very large, to check the small detail. big:<look>,<look>... picks them
    const want = name.indexOf(':') > 0 ? name.split(':')[1].split('+') : ['collector', 'bagman', 'dutch'];
    want.forEach((n, i) => { const parts = n.split('@'), L = lookOf(parts[0]); add(n, actor({ look: L, anim: parts[1] || 'stand', ph: 0.9, face: parts[2] === 'L' ? -1 : 1 }), parts[3] || 'day', 520, { w: 380, tall: L.bag === 'umbrella' || L.bag === 'balloon' ? 1.75 : 1.2 }); });
  } else if (name === 'sizes' || name === 'sizes2') {
    const SZ = ['collector', 'bagman', 'red umbrella', 'raincoat', 'clerk', 'dutch', 'white suit', 'wine dress', 'officer', 'plain', 'august', 'busker'];
    (name === 'sizes' ? SZ.slice(0, 6) : SZ.slice(6)).forEach((n, i) => {
      [10, 13, 15, 20, 30, 44, 46, 60, 100].forEach((h) => add(h === 10 ? n : String(h), actor({ look: lookOf(n), anim: i % 2 ? 'walk' : 'stand', ph: 1 + i, face: i % 3 === 1 ? -1 : 1 }), i % 4 === 3 ? 'night-lit' : 'day', h, { w: Math.max(34, h * 1.1), rowKey: n, tall: lookOf(n).bag === 'umbrella' ? 1.75 : 1.25 }));
    });
  } else if (name === 'light' || name === 'light2') {
    (name === 'light' ? ['collector', 'bagman', 'red umbrella', 'raincoat'] : ['clerk', 'dutch', 'plain', 'wine dress']).forEach((n) => {
      ['day', 'night-lit', 'night-half', 'night-dark', 'nv', 'nv-lit'].forEach((k) => add(n + ' ' + k, actor({ look: lookOf(n), anim: 'walk', ph: 0.7 }), k, 170, { w: 122, tall: lookOf(n).bag === 'umbrella' ? 1.75 : 1.25, rowKey: n }));
    });
  } else if (name === 'lamp') {
    // one person walking away from a lamp: the light must fall off evenly, and the bright edge and shadow must turn with it
    [-6, -3.5, -1.5, 0, 1.5, 3.5, 6].forEach((dx) => { ['bagman', 'collector'].forEach((n) => { const d = Math.abs(dx), l = 1 - CB.util.smooth((d - 9 * 0.3) / 9); const kind = 'night-lit';
      cells.push({ label: (dx === -6 ? n + ' ' : '') + 'lamp ' + dx, a: actor({ look: lookOf(n), anim: 'walk', ph: 0.7 }), kind, h: 200, w: 104, eo: { lampDx: dx }, lightOver: l, rowKey: n }); }); });
    cells.sort((a, b) => (a.rowKey < b.rowKey ? -1 : a.rowKey > b.rowKey ? 1 : 0));
  } else if (/^death/.test(name)) {
    const T = [0.08, 0.2, 0.34, 0.5, 0.75, 6];
    const ROWS = [
      ['back, gore', { deathKind: 'back', look: lookOf('collector') }, true],
      ['back, no gore', { deathKind: 'back', look: lookOf('collector') }, false],
      ['front, gore, head', { deathKind: 'front', deathPart: 'head', look: lookOf('bagman') }, true],
      ['front, no gore', { deathKind: 'front', look: lookOf('bagman') }, false],
      ['slump, gore', { deathKind: 'slump', deathPose: 'type', look: lookOf('suit') }, true],
      ['slump, no gore', { deathKind: 'slump', deathPose: 'sit', look: lookOf('suit') }, false],
      ['dir +1 facing right (from behind)', { deathKind: 'back', deathDir: 1, face: 1, deathPose: 'walk', look: lookOf('dutch') }, true],
      ['dir +1 facing left (from front)', { deathKind: 'front', deathDir: 1, face: -1, deathPart: 'head', look: lookOf('wine dress') }, true],
      ['blast', { deathKind: 'back', deathHow: 'blast', look: lookOf('docker') }, true],
      ['accident', { deathKind: 'front', deathHow: 'accident', look: lookOf('white suit') }, true],
      ['umbrella, night', { deathKind: 'back', deathDir: -1, look: lookOf('red umbrella') }, true, 'night-lit'],
      ['kneel slump', { deathKind: 'slump', deathPose: 'kneel', look: lookOf('gunman') }, true],
    ];
    const k = +(name.slice(5) || 1) - 1;
    ROWS.slice(k * 3, k * 3 + 3).forEach(([n, o, gore, kind]) => T.forEach((t, i) => add(i ? 't=' + t : n, dead(Object.assign({ deadT: t }, o, { look: Object.assign({}, o.look) })), kind || 'day', 110, { w: 250, eo: { gore }, rowKey: n + (i < 3 ? 'a' : 'b'), tall: 1.3, wide: true })));
  } else if (name === 'walk') {
    [['bagman', 'walk'], ['collector', 'walk'], ['dutch', 'walk'], ['wine dress', 'walk'], ['bagman', 'run'], ['aurel', 'run'], ['plain', 'panic']].forEach(([n, an]) => { for (let i = 0; i < 8; i++) add(i ? '' : n + ' ' + an, actor({ look: lookOf(n), anim: an, ph: (i / 8) * Math.PI * 2, face: n === 'dutch' ? -1 : 1 }), 'day', 150, { w: 90, rowKey: n + an }); });
  } else if (name === 'turn') {
    ['collector', 'bagman', 'wine dress', 'hiker', 'busker', 'officer', 'clerk'].forEach((n) => [1, 0.7, 0.4, 0.22, -0.22, -0.4, -0.7, -1].forEach((fs, i) => add(i ? String(fs) : n, actor({ look: lookOf(n), faceS: fs, face: fs < 0 ? -1 : 1, anim: n === 'officer' ? 'guard' : 'stand' }), 'day', 170, { w: 90, rowKey: n })));
  }

  if (name === 'ops') {
    // Count what the canvas is asked to do for one figure. Unlike a stopwatch this does not change
    // when the machine is busy: "paint" is fills plus strokes (the costly part), "path" is path commands.
    const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 800; const real = cv.getContext('2d');
    const n = { paint: 0, path: 0, state: 0 };
    const PAINT = { fill: 1, stroke: 1, fillRect: 1, strokeRect: 1 }, PATH = { moveTo: 1, lineTo: 1, arc: 1, ellipse: 1, quadraticCurveTo: 1, bezierCurveTo: 1, rect: 1, closePath: 1 }, STATE = { save: 1, restore: 1, translate: 1, rotate: 1, scale: 1 };
    const ctx = new Proxy(real, { get(o, k) { const v = o[k]; if (typeof v !== 'function') return v; return function () { if (PAINT[k]) n.paint++; else if (PATH[k]) n.path++; else if (STATE[k]) n.state++; return v.apply(o, arguments); }; }, set(o, k, v) { o[k] = v; return true; } });
    const out = {};
    [10, 20, 40, 60, 110, 220].forEach((h) => {
      const s = h / 1.8, as = LOOKS.slice(0, 15).map(([nm, L], i) => actor({ look: Object.assign({}, L), anim: i % 3 ? 'walk' : 'stand', ph: i, x: (120 + (i % 5) * 230) / s, y: (20 + Math.floor(i / 5) * 262) / s }));
      const e = envFor('night-lit', 1 / s);
      real.setTransform(s, 0, 0, -s, 0, 800); n.paint = n.path = n.state = 0;
      as.forEach((a) => fig.drawFigure(ctx, a, e));
      out[h + 'px'] = Math.round(n.paint / as.length) + ' paint, ' + Math.round(n.path / as.length) + ' path';
    });
    return { bench: out, what: 'canvas calls per figure, by height on screen' };
  }
  if (name === 'bench') {
    // how long does one figure take? Many draws onto a real canvas, in milliseconds per figure.
    const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 800; const ctx = cv.getContext('2d');
    const out = {};
    [[10, 'far'], [20, 'mid'], [40, 'mid'], [60, 'full'], [110, 'fine'], [220, 'fine']].forEach(([h, tier]) => {
      const s = h / 1.8, as = LOOKS.slice(0, 15).map(([n, L], i) => actor({ look: Object.assign({}, L), anim: i % 3 ? 'walk' : 'stand', ph: i, x: (120 + (i % 5) * 230) / s, y: (20 + Math.floor(i / 5) * 262) / s }));
      const e = envFor('night-lit', 1 / s), N = 25;
      ctx.setTransform(s, 0, 0, -s, 0, 800);
      for (let k = 0; k < 20; k++) as.forEach((a) => fig.drawFigure(ctx, a, e));
      ctx.getImageData(0, 0, 1, 1);
      let best = 1e9, tt = 0; // the best of several short runs: other work on the machine only ever makes a run slower
      for (let rep = 0; rep < 9; rep++) {
        const t0 = performance.now();
        for (let k = 0; k < N; k++) { tt += 1 / 60; e.t = tt; as.forEach((a) => { a.t += 1 / 60; a.ph += 0.07; fig.drawFigure(ctx, a, e); }); }
        ctx.getImageData(0, 0, 1, 1);
        best = Math.min(best, performance.now() - t0);
      }
      out[h + 'px'] = Math.round((best / N / as.length) * 1000);
    });
    return { bench: out };
  }

  // lay the cells out in rows on a canvas of fixed width
  const W = 780, pad = 6;
  let x = pad, y = pad, rowH = 0, lastKey = null;
  cells.forEach((c) => {
    c.w = c.w || Math.max(120, c.h * (c.wide ? 2 : 0.72)); c.ch = c.h * (c.crop ? c.crop + 0.08 : (c.tall || 1.25)) + 26;
    if (x + c.w > W - pad || (c.rowKey !== undefined && lastKey !== null && c.rowKey !== lastKey)) { x = pad; y += rowH + pad; rowH = 0; }
    c.x = x; c.y = y; x += c.w + pad; rowH = Math.max(rowH, c.ch); lastKey = c.rowKey === undefined ? null : c.rowKey;
  });
  const H = y + rowH + pad, dpr = window.devicePixelRatio || 1;
  let cv = document.getElementById('figsheet'); if (cv) cv.remove();
  document.body.innerHTML = ''; document.body.style.cssText = 'margin:0;background:#20242b;overflow:auto;position:static;';
  cv = document.createElement('canvas'); cv.id = 'figsheet'; cv.width = W * dpr; cv.height = H * dpr; cv.style.cssText = 'width:' + W + 'px;height:' + H + 'px;display:block;';
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#20242b'; ctx.fillRect(0, 0, W, H);
  cells.forEach((c) => {
    const bg = BG[c.kind] || BG.day, s = c.h / (1.8 * ((c.a.look && c.a.look.h) || 1)), gy = c.y + c.ch - 22;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save(); ctx.beginPath(); ctx.rect(c.x, c.y, c.w, c.ch); ctx.clip();
    ctx.fillStyle = bg[0]; ctx.fillRect(c.x, c.y, c.w, c.ch); ctx.fillStyle = bg[1]; ctx.fillRect(c.x, gy, c.w, c.ch);
    const e = envFor(c.kind, 1 / s, c.eo);
    if (c.lightOver !== undefined) { const l = c.lightOver, k = 1 - l; e.light = l; e.dim = 0.72 * k; e.ink = mix(PAL.night.ink, '#04060a', k); e.rim = 'rgba(' + Math.round(170 - 50 * k) + ',' + Math.round(190 - 50 * k) + ',' + Math.round(225 - 50 * k) + ',' + (0.42 - 0.18 * k).toFixed(2) + ')'; }
    const ox = c.x + c.w * (c.wide ? 0.5 : 0.5) - (c.a.face < 0 ? -1 : 1) * (c.wide ? 0 : c.h * 0.04), oy = c.crop ? gy + c.h * (1 - c.crop) : gy;
    ctx.setTransform(dpr * s, 0, 0, -dpr * s, dpr * ox, dpr * oy);
    try { fig.drawFigure(ctx, c.a, e); } catch (err) { window.__figErr = (window.__figErr || '') + c.label + ': ' + err.message + '\n' + (err.stack || '').split('\n').slice(1, 3).join('\n') + '\n'; }
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (c.label) { ctx.fillStyle = c.kind === 'day' || c.kind === 'snow' ? '#15181d' : '#c8d0da'; ctx.font = '10px sans-serif'; ctx.fillText(c.label, c.x + 3, c.y + 11); }
  });
  return { w: W, h: H, n: cells.length, err: window.__figErr || '' };
}

(async () => {
  const ALL = ['anims', 'anims2', 'hats', 'hats2', 'heads', 'heads2', 'bags', 'bags2', 'looks', 'looks2', 'sizes', 'sizes2', 'light', 'light2', 'lamp', 'death', 'death2', 'death3', 'death4', 'walk', 'turn'];
  const arg = process.argv[2] || 'all', dpr = +(process.argv[3] || 2);
  const sheets = arg === 'all' ? ALL.concat(['bench']) : arg.split(',');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await page.goto('file://' + (process.env.FIGS_HTML || path.join(__dirname, '..', 'index.html')) + '?test'); // FIGS_HTML: another build to compare against
  await page.waitForTimeout(400);
  await page.evaluate(() => { try { CB.UI.attractStop(); } catch (e) { /* no menu running */ } });
  fs.mkdirSync(path.join(__dirname, '..', 'shots'), { recursive: true });
  for (const s of sheets) {
    const r = await page.evaluate(pageMain, s);
    if (r.bench) { console.log((r.what || 'microseconds per figure, by height on screen') + ':', JSON.stringify(r.bench)); continue; }
    if (r.err) errs.push(s + ': ' + r.err);
    const file = path.join(__dirname, '..', 'shots', 'figs_' + s.replace(/[^a-z0-9]+/gi, '_') + '.png');
    await page.setViewportSize({ width: 800, height: Math.ceil(Math.min(4000, r.h + 10)) });
    await (await page.$('#figsheet')).screenshot({ path: file });
    console.log(s, r.n, 'figures', r.w + 'x' + r.h, '->', path.relative(process.cwd(), file));
  }
  if (errs.length) { console.log(errs.join('\n')); process.exitCode = 1; }
  await browser.close();
})();
