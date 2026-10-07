// ---------------------------------------------------------------------------
// Menus, part 2: the armory, the workbench, the collection and caches.
// ---------------------------------------------------------------------------
const STAT_LABELS = [['reach', 'Reach'], ['flat', 'Flat shooting'], ['wind', 'Holds in wind'], ['steady', 'Steadiness'], ['exact', 'Accuracy'], ['calm', 'Low recoil'], ['rate', 'Rate of fire'], ['quiet', 'Quietness']];
const ACTION_NAME = { bolt: 'Bolt action', semi: 'Semi-automatic', single: 'Single shot', charge: 'Coil, charges before firing' };

UI.armory = function () {
  const d = Save.data, rank = rankOf(d.xp).n;
  const cards = GUNS.map((g) => {
    const own = !!d.guns[g.id], st = buildStats(g.id, own ? gunCfg(g.id) : defaultConfig(g.id));
    let tag;
    if (own) tag = d.equipped === g.id ? '<span class="tag eq">In use</span>' : '<span class="tag own">Owned</span>';
    else if (g.special) tag = '<span class="tag lock">' + ICON.lock + ' Story</span>';
    else if (rank < g.rank) tag = '<span class="tag lock">' + ICON.lock + ' Rank ' + g.rank + '</span>';
    else tag = '<span class="tag buy ' + (d.credits >= g.price ? 'can' : '') + '">' + fmtCr(g.price) + ' cr</span>';
    return `<button class="acard ${own ? 'own' : ''}" data-a="gun" data-id="${g.id}">
      <canvas data-gun="${g.id}" ${own ? '' : 'data-cfg=\'' + JSON.stringify(defaultConfig(g.id)) + '\''}></canvas>
      <div class="ac-b"><div><b>${esc(g.name)}</b><i>${esc(g.calName)}  ·  ${ACTION_NAME[g.action].split(',')[0]}  ·  ${st.eff} m</i></div>${tag}</div></button>`;
  }).join('');
  UI.render(UI.shell(`<div class="scroll"><div class="chhead"><div class="eyebrow">Pip's bench</div><h2>Armory</h2><p class="dim">Sixteen rifles. Each one shoots differently: how steady it sits, how fast the bullet flies, how far it falls, how loud it is. Tap one to look closer.</p></div><div class="alist">${cards}</div><div class="pad"></div></div>`),
    UI.shellHandlers({ gun(ds) { UI.backTo = null; UI.bench(ds.id); } }));
};

function partName(slot, cfg) { if (slot === 'scope') return (SCOPE_BY_ID[cfg.scope] || {}).name; if (slot === 'skin') return (SKIN_BY_ID[cfg.skin || 'factory'] || SKINS[0]).name; return (PART_BY_ID[cfg[slot]] || {}).name; }
function statDeltas(a, b) {
  const out = [];
  STAT_LABELS.forEach(([k, label]) => { const dv = Math.round((b[k] - a[k]) * 100); if (Math.abs(dv) >= 2) out.push({ label, dv }); });
  out.sort((x, y) => Math.abs(y.dv) - Math.abs(x.dv));
  return out.slice(0, 4);
}

UI.bench = function (gunId) {
  const d = Save.data, g = GUN_BY_ID[gunId], own = !!d.guns[gunId], cfg = own ? gunCfg(gunId) : defaultConfig(gunId);
  const st = buildStats(gunId, cfg), bars = statBars(st), rank = rankOf(d.xp).n;
  const barsHtml = STAT_LABELS.map(([k, label]) => `<div class="sbar"><span>${label}</span><i><i style="width:${Math.round(bars[k] * 100)}%"></i></i></div>`).join('');
  const facts = `<div class="facts"><div><b>${Math.round(st.v0)}</b><i>m/s at the muzzle</i></div><div><b>${st.mag}</b><i>${st.mag === 1 ? 'round' : 'rounds'}</i></div><div><b>${fmt(st.cycle, 1)} s</b><i>between shots</i></div><div><b>${fmt(st.zoomMin, 0)}-${fmt(st.zoomMax, 0)}x</b><i>zoom</i></div><div><b>${st.silent ? 'Silent' : st.quiet ? 'Quiet' : 'Loud'}</b><i>${st.silent ? 'nobody hears it' : st.quiet ? 'bullet crack only' : 'heard to ' + Math.round(st.noise) + ' m'}</i></div><div><b>${st.pen >= 3 ? 'Walls' : st.pen >= 1.4 ? 'Thin cover' : st.pen >= 0.2 ? 'Glass' : 'Nothing'}</b><i>${st.pen >= 3 ? 'goes through one' : st.pen >= 1.4 ? 'and glass, cleanly' : st.pen >= 1 ? 'goes through cleanly' : st.pen >= 0.2 ? 'through, knocked off line' : 'glass stops it'}</i></div></div>`;
  let action;
  if (own) action = d.equipped === gunId ? '<div class="inuse">' + ICON.check + ' This is the rifle you carry</div>' : '<button class="btn pri wide" data-a="equip" data-snd="equip">Carry this rifle</button>';
  else if (g.special) action = '<div class="lockmsg">' + ICON.lock + ' This rifle is not for sale. The story will put it in your hands.</div>';
  else if (rank < g.rank) action = '<div class="lockmsg">' + ICON.lock + ' Needs rank ' + g.rank + ' (' + RANKS[g.rank - 1].name + '). You are rank ' + rank + '.</div>';
  else action = '<button class="btn pri wide ' + (d.credits >= g.price ? '' : 'off') + '" data-a="buy" data-snd="buy">Buy for ' + fmtCr(g.price) + ' credits' + (d.credits >= g.price ? '' : ' (you have ' + fmtCr(d.credits) + ')') + '</button>';
  const slots = own ? '<div class="slots"><div class="eyebrow">Parts</div>' + SLOTS.map((s) => {
    const opts = s.id === 'scope' ? SCOPES.filter((sc) => scopeFits(sc, g)) : PARTS.filter((p) => p.slot === s.id && partFits(p, g));
    const fixed = opts.length <= 1;
    return `<button class="slot ${fixed ? 'fixed' : ''}" data-a="slot" data-slot="${s.id}" ${fixed ? 'data-quiet="1"' : ''}><span>${s.name}</span><b>${esc(partName(s.id, cfg) || 'Standard')}</b>${fixed ? '<em>fixed</em>' : '<em class="go">change</em>'}</button>`;
  }).join('') + `<button class="slot skin" data-a="slot" data-slot="skin"><span>Skin</span><b>${esc(partName('skin', cfg))}</b><canvas data-swatch="${cfg.skin || 'factory'}"></canvas><em class="go">change</em></button></div>` : '';
  UI.render(`<div class="scr bench">
    <div class="bar"><button class="ib" data-a="back" data-snd="back">${ICON.back}</button><div><div class="eyebrow">${esc(g.maker)}</div><h2>${esc(g.name)}</h2></div><div class="cr sm"><b>${fmtCr(d.credits)}</b><small>credits</small></div></div>
    <div class="scroll">
      <div class="stage"><canvas data-gun="${gunId}" data-live="1" data-cfg='${JSON.stringify(cfg).replace(/'/g, '&#39;')}'></canvas></div>
      <div class="gsub">${esc(g.calName)}  ·  ${ACTION_NAME[g.action]}  ·  good to ${st.eff} m</div>
      <p class="blurb">${esc(g.blurb)}</p>
      ${action}
      ${facts}
      <div class="bars">${barsHtml}</div>
      ${slots}
      <button class="btn ghost wide" data-a="dope">Drop and wind table for this rifle</button>
      <div class="pad"></div>
    </div></div>`, {
    back() { if (UI.backTo) { const f = UI.backTo; UI.backTo = null; f(); } else { UI.tab = 'armory'; UI.hub(); } },
    equip() { d.equipped = gunId; Save.write(); UI.keepScroll(); UI.bench(gunId); UI.toast(g.name + ' is now your rifle.'); },
    buy() { const err = Progress.buy('gun', gunId); if (err) { Sfx.ui('deny'); UI.toast(err, 'bad'); return; } d.equipped = gunId; Save.write(); UI.toast('Bought: ' + g.name, 'good'); UI.bench(gunId); },
    slot(ds) { if (ds.slot === 'skin') UI.skinPicker(gunId); else UI.partPicker(gunId, ds.slot); },
    dope() { UI.dope(st); },
  }, 'is-bench');
};

UI.partPicker = function (gunId, slot) {
  const d = Save.data, g = GUN_BY_ID[gunId], cfg = gunCfg(gunId), rank = rankOf(d.xp).n;
  const isScope = slot === 'scope';
  const opts = isScope ? SCOPES.filter((sc) => scopeFits(sc, g)) : PARTS.filter((p) => p.slot === slot && partFits(p, g));
  if (opts.length <= 1) { UI.toast('Nothing else fits here on this rifle.'); return; }
  const base = statBars(buildStats(gunId, cfg));
  const rows = opts.map((p) => {
    const own = isScope ? ownsScope(p.id) : ownsPart(p.id), cur = cfg[slot] === p.id;
    const c2 = Object.assign({}, cfg); c2[slot] = p.id;
    const dl = cur ? [] : statDeltas(base, statBars(buildStats(gunId, c2)));
    let extra = '';
    if (isScope) extra = `<span class="dchip n">${p.zoom[0] === p.zoom[1] ? p.zoom[0] + 'x fixed' : p.zoom[0] + '-' + p.zoom[1] + 'x'}</span>` + (p.turret ? '<span class="dchip n">zero dial</span>' : '') + (p.lrf ? '<span class="dchip n">rangefinder</span>' : '') + (p.nv ? '<span class="dchip n">night vision</span>' : '') + (p.smart ? '<span class="dchip n">aim computer</span>' : '');
    const chips = dl.map((x) => `<span class="dchip ${x.dv > 0 ? 'up' : 'down'}">${x.label} ${x.dv > 0 ? '+' : ''}${x.dv}</span>`).join('') + extra;
    let btn;
    if (cur) btn = '<span class="st fitted">Fitted</span>';
    else if (own) btn = '<span class="st fit">Fit</span>';
    else if (rank < p.rank) btn = '<span class="st lock">' + ICON.lock + ' Rank ' + p.rank + '</span>';
    else btn = '<span class="st buy ' + (d.credits >= p.price ? 'can' : '') + '">' + fmtCr(p.price) + ' cr</span>';
    return `<button class="prow ${cur ? 'on' : ''}" data-a="pick" data-id="${p.id}"><div class="pr-t"><b>${esc(p.name)}</b>${btn}</div><p>${esc(p.desc)}</p><div class="chipsrow">${chips}</div></button>`;
  }).join('');
  const title = (SLOTS.find((s) => s.id === slot) || {}).name;
  UI.overlay(`<div class="sheet tall"><div class="sh-head"><h3>${esc(title)}</h3><div class="cr sm"><b>${fmtCr(d.credits)}</b><small>credits</small></div><button class="x" data-a="close">${ICON.cross}</button></div><div class="sh-body">${rows}</div></div>`, {
    close() { UI.closeOverlay(); },
    pick(ds) {
      const id = ds.id, p = isScope ? SCOPE_BY_ID[id] : PART_BY_ID[id], own = isScope ? ownsScope(id) : ownsPart(id);
      if (cfg[slot] === id) return;
      if (!own) { const err = Progress.buy(isScope ? 'scope' : 'part', id); if (err) { Sfx.ui('deny'); UI.toast(err, 'bad'); return; } Sfx.ui('buy'); UI.toast('Bought: ' + p.name, 'good'); } else Sfx.ui('equip');
      cfg[slot] = id; d.guns[gunId].cfg = cfg; Save.write();
      UI.closeOverlay(); UI.keepScroll(); UI.bench(gunId);
    },
  });
};

UI.skinPicker = function (gunId) {
  const d = Save.data, cfg = gunCfg(gunId);
  const owned = SKINS.filter((s) => d.skins[s.id] || s.id === 'factory');
  const cells = owned.map((s) => `<button class="skcell r${s.r} ${cfg.skin === s.id || (!cfg.skin && s.id === 'factory') ? 'on' : ''}" data-a="pick" data-id="${s.id}"><canvas data-swatch="${s.id}"></canvas><b>${esc(s.name)}</b><i>${RAR[s.r]}</i></button>`).join('');
  const prev = Object.assign({}, cfg);
  UI.overlay(`<div class="sheet tall"><div class="sh-head"><h3>Skins</h3><button class="x" data-a="close">${ICON.cross}</button></div>
    <div class="sh-body"><div class="stage sm"><canvas id="skprev" data-gun="${gunId}" data-live="1" data-cfg='${JSON.stringify(prev).replace(/'/g, '&#39;')}'></canvas></div>
    <p class="dim">Skins are for looks only and fit every rifle. You own ${owned.length - 1} of ${SKINS.length - 1}. More come out of caches, and a few are trophies.</p>
    <div class="skgrid">${cells}</div></div></div>`, {
    close() { UI.closeOverlay(); UI.keepScroll(); UI.bench(gunId); },
    pick(ds) { cfg.skin = ds.id; d.guns[gunId].cfg = cfg; Save.write(); Sfx.ui('equip'); UI.skinPicker(gunId); },
  });
};

// Drop and wind table ("dope card") for a rifle as currently fitted.
UI.dopeRows = function (st, maxR) {
  const rows = [], top = Math.min(maxR || st.eff * 1.15, 2200), step = top <= 320 ? 25 : top <= 900 ? 50 : 100;
  for (let r = step * 2 > 100 ? 100 : 50; r <= top + 1; r += step) {
    const dp = Bal.dope(st, st.zeroAng, r, 5); if (!dp.reached) break;
    rows.push({ r, up: dp.dropMil, w: Math.abs(dp.driftMil), t: dp.tof, v: dp.v });
  }
  return rows;
};
UI.dopeTable = function (st, maxR, mark) {
  const rows = UI.dopeRows(st, maxR);
  return `<table class="dope"><tr><th>Range</th><th>Hold up</th><th>Wind 5 m/s</th><th>Flight</th></tr>${rows.map((x) => `<tr class="${mark && Math.abs(x.r - mark) <= 25 ? 'mk' : ''}"><td>${x.r} m</td><td>${Math.abs(x.up) < 0.05 ? 'zero' : (x.up > 0 ? '' : 'under ') + fmt(Math.abs(x.up), 1)}</td><td>${fmt(x.w, 1)}</td><td>${fmt(x.t, 2)} s</td></tr>`).join('')}</table>`;
};
UI.dope = function (st) {
  UI.overlay(`<div class="sheet tall"><div class="sh-head"><h3>${esc(st.name)}: drop and wind</h3><button class="x" data-a="close">${ICON.cross}</button></div><div class="sh-body">
    <p class="dim">How far to aim above the target at each distance, in mils (the marks on the scope glass), with the rifle zeroed at ${st.zero} m. The wind column is how far a steady 5 m/s crosswind pushes the bullet: aim that far into the wind. Half the wind, half the number.</p>
    ${UI.dopeTable(st)}</div></div>`, { close() { UI.closeOverlay(); } });
};

// ---- collection ---------------------------------------------------------------------------
UI.collection = function () {
  const d = Save.data, t = Progress.totals();
  const tile = (n, max, label) => `<div class="ptile ${n >= max ? 'full' : ''}"><b>${n}<small>/${max}</small></b><span>${label}</span><i><i style="width:${Math.round((n / max) * 100)}%"></i></i></div>`;
  const groups = [4, 3, 2, 1, 0].map((r) => {
    const list = SKINS.filter((s) => s.r === r && s.id !== 'factory');
    return `<div class="rgroup r${r}"><div class="rhead"><b>${RAR[r]}</b><i>${list.filter((s) => d.skins[s.id]).length} / ${list.length}</i></div><div class="skgrid">${list.map((s) => d.skins[s.id]
      ? `<div class="skcell r${s.r} on-own"><canvas data-swatch="${s.id}"></canvas><b>${esc(s.name)}</b>${s.ex ? '<i>Trophy</i>' : ''}</div>`
      : `<div class="skcell r${s.r} unknown"><div class="q">?</div><b>${s.ex ? esc(s.name) : 'Not found yet'}</b>${s.ex ? '<i>' + esc(s.ex) + '</i>' : ''}</div>`).join('')}</div></div>`;
  }).join('');
  const nC = d.caches.length, sealed = d.caches.filter((c) => c === 'sealed').length;
  UI.render(UI.shell(`<div class="scroll">
    <div class="chhead"><div class="eyebrow">Everything you have earned</div><h2>Collection</h2></div>
    <div class="cachebox ${nC ? 'has' : ''}"><div class="cb-ic">${ICON.box}</div><div class="cb-t"><b>${nC ? nC + (nC === 1 ? ' cache' : ' caches') + ' to open' : 'No caches waiting'}</b><i>${nC ? (sealed ? sealed + ' sealed (better odds). ' : '') + 'Each one holds a rifle skin.' : 'Earn them with three-star runs, challenges, new ranks, finished chapters and ducks.'}</i></div>${nC ? '<button class="btn pri" data-a="open" data-snd="riser">Open</button>' : ''}</div>
    <div class="ptiles">${tile(t.stars, t.starsMax, 'Stars')}${tile(t.ch, t.missions, 'Challenges')}${tile(t.ducks, t.missions, 'Rubber ducks')}${tile(t.guns, t.gunsMax, 'Rifles')}${tile(t.parts, t.partsMax, 'Parts')}${tile(t.skins, t.skinsMax, 'Skins')}</div>
    <div class="records"><div class="eyebrow">Records</div><div class="recs"><div><b>${d.stats.longest || 0} m</b><i>longest kill</i></div><div><b>${fmtCr(d.stats.shots)}</b><i>shots fired</i></div><div><b>${d.stats.heads}</b><i>headshots</i></div><div><b>${d.stats.wins}</b><i>contracts won</i></div></div></div>
    <div class="eyebrow pad-t">Skins</div>${groups}
    <div class="pad"></div></div>`), UI.shellHandlers({ open() { UI.openCache(); } }));
};

UI.openCache = function () {
  const res = Progress.openCache();
  if (!res) { UI.closeOverlay(); UI.collection(); return; }
  const s = res.skin, d = Save.data, gunId = d.equipped, cfg = Object.assign({}, gunCfg(gunId), { skin: s.id });
  UI.overlay(`<div class="cacheopen r${s.r}">
    <div class="co-box">${ICON.box}</div>
    <div class="co-card"><div class="co-rar">${RAR[s.r]}</div><canvas data-gun="${gunId}" data-live="1" data-cfg='${JSON.stringify(cfg).replace(/'/g, '&#39;')}'></canvas><h3>${esc(s.name)}</h3>
      <p>${res.dupe ? 'You already own this one. Traded in for <b>' + fmtCr(res.cr) + '</b> credits.' : 'New skin. It fits every rifle you own.'}</p>
      <div class="co-btns">${res.dupe ? '' : '<button class="btn ghost" data-a="fit" data-snd="equip">Put it on my rifle</button>'}${d.caches.length ? '<button class="btn pri" data-a="next" data-snd="riser">Open next (' + d.caches.length + ')</button>' : ''}<button class="btn ${d.caches.length ? 'ghost' : 'pri'}" data-a="done">Done</button></div></div></div>`, {
    fit() { const c = gunCfg(gunId); c.skin = s.id; d.guns[gunId].cfg = c; Save.write(); UI.toast(s.name + ' fitted to ' + GUN_BY_ID[gunId].name + '.', 'good'); },
    next() { UI.openCache(); },
    done() { UI.closeOverlay(); if (UI.afterCache) { const f = UI.afterCache; UI.afterCache = null; f(); } else UI.collection(); },
  }, 'center');
  setTimeout(() => { const c = UI.over.querySelector('.cacheopen'); if (c) c.classList.add('go'); Sfx.rarity(s.r); }, 650);
};

// ---- the range ------------------------------------------------------------------------------
UI.rangeCfg = { dist: 300, wind: 0 };
function rangeMission(dist, wind) {
  return {
    id: 'range', practice: true, ch: 0, title: 'The Range', range: 0,
    objective: 'Steel and paper at ' + dist + ' m. Nothing here shoots back or runs away.',
    brief: 'Take as long as you like. Watch where each round lands, then adjust.', intel: ['Open the notebook (top left) to leave.'],
    wind: { v: wind, gust: Math.abs(wind) > 0.5 ? 0.7 : 0 }, par: 999, rules: { until: 'never', reserve: 9999 },
    vantages: [{ name: 'Firing point', desc: '', eye: [0, 4 + dist * 0.012, 0] }], look: [0, 1.6],
    setup() {
      const half = Math.max(11, dist * 0.035);
      const S = makeScene({ time: 'day', seed: 4, refZ: dist, bounds: { x0: -half, x1: half, y0: -1.5, y1: Math.max(8, dist * 0.022) }, ambience: 'wild', groundMat: 'dirt', exits: [-99, 99] });
      K.mountains(S, dist + 6000, { seed: 8, h: 900, col: '#7f8da0' });
      K.hills(S, dist + 900, { seed: 5, h: 120, col: '#5f8f58', trees: 0.5, rough: 380, step: 60 });
      const PBm = K.hills(S, dist + 28, { seed: 9, h: 7, base: 1.5, col: '#8a7a55', rough: 60, step: 6, x0: -200, x1: 200, mat: 'dirt' });
      const P = S.plane(dist, 'line'); K.ground(S, P, { col: '#76a05e', edge: '#8fb974', mat: 'dirt' });
      const steel = '#c9ced3', post = '#3a3f47';
      const gong = (x, r, id) => { const ob = K.thing(S, P, 'bell', x, 1.5, { id, r, lure: 0.01, drawFn(ctx, env) {
        line(ctx, x - r - 0.25, 0, x - r - 0.25, 2.1, S.tone(post, P), 0.07, env); line(ctx, x + r + 0.25, 0, x + r + 0.25, 2.1, S.tone(post, P), 0.07, env); line(ctx, x - r - 0.3, 2.1, x + r + 0.3, 2.1, S.tone(post, P), 0.07, env);
        const sw = ob.ringT ? Math.sin((env.t - ob.ringT) * 14) * 0.18 * Math.max(0, 1 - (env.t - ob.ringT) / 1.6) : 0;
        line(ctx, x - r * 0.5, 2.1, x - r * 0.5 + sw, 1.5 + r * 0.8, S.tone(post, P), 0.03, env); line(ctx, x + r * 0.5, 2.1, x + r * 0.5 + sw, 1.5 + r * 0.8, S.tone(post, P), 0.03, env);
        circ(ctx, x + sw, 1.5, r, S.tone(steel, P)); circ(ctx, x + sw, 1.5, r * 0.45, S.tone('#e0413a', P));
        if (ob.ringT && env.t - ob.ringT < 0.25) circ(ctx, x + sw, 1.5, r * 1.25, 'rgba(255,255,255,0.5)');
      } }); return ob; };
      gong(-5.5, 0.22, 'g1'); gong(-2.6, 0.4, 'g2');
      // paper board that keeps its holes
      P.add({ x0: 0.6, x1: 3.4, layer: 0, draw(ctx, env) { line(ctx, 1.0, 0, 1.0, 0.7, S.tone(post, P), 0.08, env); line(ctx, 3.0, 0, 3.0, 0.7, S.tone(post, P), 0.08, env); R4(ctx, 0.8, 0.6, 2.4, 2.4, S.tone('#efe9da', P)); ctx.strokeStyle = S.tone('#1d2026', P); ctx.lineWidth = Math.max(0.03, env.px * 0.7); for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(2, 1.8, i * 0.27, 0, TAU); ctx.stroke(); } circ(ctx, 2, 1.8, 0.1, S.tone('#e0413a', P)); } });
      P.solid(0.8, 0.6, 2.4, 2.4, 'wood');
      // steel figure
      const fx = 5.6; const fig = K.thing(S, P, 'bell', fx, 1.05, { id: 'g3', w: 0.5, h: 1.3, r: 0.6, lure: 0.01, drawFn(ctx, env) { const hit = fig.ringT && env.t - fig.ringT < 0.3; const c = S.tone(hit ? '#ffffff' : '#2a2e36', P); line(ctx, fx, 0, fx, 0.5, S.tone(post, P), 0.08, env); R4(ctx, fx - 0.25, 0.4, 0.5, 0.95, c); circ(ctx, fx, 1.55, 0.17, c); } });
      K.flag(S, P, -9.5, 0, 5, '#e07b2a'); K.flag(S, P, 9.5, 0, 5, '#e07b2a');
      K.box(S, P, 7.4, 0, 2.2, 1.1, '#e9e4d6', { text: dist + ' M', textCol: '#1d2026', solid: false });
      return { S, P };
    },
    cast() { return []; }, triggers() { return [hint(1, 'Small gong, big gong, paper, steel figure. The paper keeps its holes so you can see your group. Read HOLD, aim off by that much, and watch where the round lands.', 14)]; },
    challenge: { text: '', test: () => false }, reward: { cr: 0, xp: 0 }, solve: [],
  };
}
UI.range = function () {
  const d = Save.data, R = UI.rangeCfg, g = GUN_BY_ID[d.equipped], st = buildStats(d.equipped, gunCfg(d.equipped));
  const dp = Bal.dope(st, st.zeroAng, R.dist, Math.abs(R.wind));
  UI.render(UI.shell(`<div class="scroll">
    <div class="chhead"><div class="eyebrow">Practice</div><h2>The Range</h2><p class="dim">Steel plates and a paper target at any distance, in any wind. No fee, no rating, no hurry. The best place to learn what a rifle does and what the marks on a scope mean.</p></div>
    <div class="stepper"><span>Distance</span><div><button class="sq" data-a="d" data-v="-100">&minus;</button><b>${R.dist} m</b><button class="sq" data-a="d" data-v="100">+</button></div></div>
    <div class="stepper"><span>Crosswind</span><div><button class="sq" data-a="w" data-v="-1">&minus;</button><b>${R.wind === 0 ? 'Calm' : Math.abs(R.wind) + ' m/s ' + (R.wind > 0 ? 'from left' : 'from right')}</b><button class="sq" data-a="w" data-v="1">+</button></div></div>
    <button class="gcard" data-a="gun"><canvas data-gun="${d.equipped}"></canvas><div class="gc-t"><b>${esc(g.name)}</b><i>${esc(st.scope.name)}  ·  good to ${st.eff} m</i></div><span class="chg">Change</span></button>
    <div class="note">${dp.reached ? 'At ' + R.dist + ' m this rifle needs a hold of about <b>' + fmt(Math.max(0, dp.dropMil), 1) + ' mils up</b>' + (R.wind ? ' and <b>' + fmt(Math.abs(dp.driftMil), 1) + ' mils into the wind</b>' : '') + '. The bullet takes ' + fmt(dp.tof, 2) + ' seconds to arrive.' : 'This rifle cannot reach ' + R.dist + ' m. Try anyway if you like.'}</div>
    <button class="btn pri big wide" data-a="go" data-snd="go">Go to the range</button>
    <div class="pad"></div></div>`), UI.shellHandlers({
    d(ds) { R.dist = clamp(R.dist + +ds.v, 100, 1800); UI.keepScroll(); UI.range(); },
    w(ds) { R.wind = clamp(R.wind + +ds.v, -8, 8); UI.keepScroll(); UI.range(); },
    gun() { UI.gunPicker(null); },
    go() { MISSION_BY_ID.range = rangeMission(R.dist, R.wind); UI.launch('range', {}); },
  }));
};
