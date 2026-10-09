// ---------------------------------------------------------------------------
// Menus, part 2: the armory, the workbench, the part and skin pickers, the
// collection, caches and the range.
// ---------------------------------------------------------------------------
const STAT_LABELS = [['reach', 'Reach'], ['flat', 'Flat shooting'], ['wind', 'Holds in wind'], ['steady', 'Steadiness'], ['exact', 'Accuracy'], ['calm', 'Low recoil'], ['rate', 'Rate of fire'], ['quiet', 'Quietness']];
const ACTION_NAME = { bolt: 'Bolt action', semi: 'Semi-automatic', single: 'Single shot', charge: 'Coil, charges before firing' };

UI.armory = function () {
  const d = Save.data, rank = rankOf(d.xp).n;
  const cards = GUNS.map((g) => {
    const own = !!d.guns[g.id], cfg = own ? gunCfg(g.id) : defaultConfig(g.id), st = buildStats(g.id, cfg);
    let tag;
    if (own) tag = d.equipped === g.id ? '<span class="tag eq">In use</span>' : '<span class="tag own">Owned</span>';
    else if (g.special) tag = '<span class="tag lock">' + ICON.lock + ' Story</span>';
    else if (rank < g.rank) tag = '<span class="tag lock">' + ICON.lock + ' Rank ' + g.rank + '</span>';
    else tag = '<span class="tag buy ' + (d.credits >= g.price ? 'can' : '') + '">' + fmtCr(g.price) + ' cr</span>';
    return `<button class="acard ${own ? 'own' : ''} ${d.equipped === g.id ? 'eq' : ''} ${!own && (g.special || rank < g.rank) ? 'shut' : ''}" data-a="gun" data-id="${g.id}">
      <span class="ac-pic plate"><canvas data-gun="${g.id}" data-lazy ${uiCfgAttr(cfg)}></canvas>${tag}</span>
      <span class="ac-t"><b>${esc(g.name)}</b><i>${esc(g.calName)}  ·  ${ACTION_NAME[g.action].split(',')[0]}  ·  ${st.eff} m</i></span></button>`;
  }).join('');
  UI.render(UI.shell('<div class="hd"><div class="eyebrow">Pip\'s bench</div><h2>Armory</h2></div><button class="btn ghost sm gr-in" data-a="gunroom">' + ICON.room + '<span>Gun room</span></button>',
    `<div class="scroll"><p class="dim lead">Sixteen rifles. Each one shoots differently: how steady it sits, how fast the bullet flies, how far it falls, how loud it is. Tap one to look closer and change its parts.</p><div class="alist">${cards}</div></div>`),
    UI.shellHandlers({ gun(ds) { UI.backTo = null; UI.bench(ds.id); } }), 'is-armory');
};

function partName(slot, cfg) { if (slot === 'scope') return (SCOPE_BY_ID[cfg.scope] || {}).name; if (slot === 'skin') return (SKIN_BY_ID[cfg.skin || 'factory'] || SKINS[0]).name; return (PART_BY_ID[cfg[slot]] || {}).name; }
function statDeltas(a, b) {
  const out = [];
  STAT_LABELS.forEach(([k, label]) => { const dv = Math.round((b[k] - a[k]) * 100); if (Math.abs(dv) >= 2) out.push({ label, dv }); });
  out.sort((x, y) => Math.abs(y.dv) - Math.abs(x.dv));
  return out.slice(0, 4);
}
// What a rifle could have fitted in one slot.
function uiSlotOptions(slot, g) { return slot === 'scope' ? SCOPES.filter((sc) => scopeFits(sc, g)) : PARTS.filter((p) => p.slot === slot && partFits(p, g)); }
function uiScopeFacts(p) { return (p.zoom[0] === p.zoom[1] ? p.zoom[0] + 'x fixed' : p.zoom[0] + ' to ' + p.zoom[1] + 'x') + (p.turret ? '  ·  zero dial' : '') + (p.lrf ? '  ·  rangefinder' : '') + (p.nv ? '  ·  night vision' : '') + (p.smart ? '  ·  aim computer' : ''); }

// ---- the workbench ---------------------------------------------------------------------------
// The rifle on the left with its numbers and the one button that matters; on the right a tile for
// every slot, each showing a side view of what is fitted there.
UI.bench = function (gunId) {
  const d = Save.data, g = GUN_BY_ID[gunId], own = !!d.guns[gunId], cfg = own ? gunCfg(gunId) : defaultConfig(gunId);
  const st = buildStats(gunId, cfg), bars = statBars(st), rank = rankOf(d.xp).n, cfgA = uiCfgAttr(cfg);
  const barsHtml = STAT_LABELS.map(([k, label]) => `<div class="sbar"><span>${label}</span><i><i style="width:${Math.round(bars[k] * 100)}%"></i></i></div>`).join('');
  const facts = `<div class="facts"><div><b>${Math.round(st.v0)}</b><i>m/s at the muzzle</i></div><div><b>${st.mag}</b><i>${st.mag === 1 ? 'round' : 'rounds'}</i></div><div><b>${fmt(st.cycle, 1)} s</b><i>between shots</i></div><div><b>${fmt(st.zoomMin, 0)}-${fmt(st.zoomMax, 0)}x</b><i>zoom</i></div><div><b>${st.silent ? 'Silent' : st.quiet ? 'Quiet' : 'Loud'}</b><i>${st.silent ? 'nobody hears it' : st.quiet ? 'bullet crack only' : 'heard to ' + Math.round(st.noise) + ' m'}</i></div><div><b>${st.pen >= 3 ? 'Walls' : st.pen >= 1.4 ? 'Thin cover' : st.pen >= 0.2 ? 'Glass' : 'Nothing'}</b><i>${st.pen >= 3 ? 'goes through one' : st.pen >= 1.4 ? 'and glass, cleanly' : st.pen >= 1 ? 'goes through cleanly' : st.pen >= 0.2 ? 'through, knocked off line' : 'glass stops it'}</i></div></div>`;
  let action;
  if (own) action = d.equipped === gunId ? '<div class="inuse">' + ICON.check + ' This is the rifle you carry</div>' : '<button class="btn pri wide" data-a="equip" data-snd="equip">Carry this rifle</button>';
  else if (g.special) action = '<div class="lockmsg">' + ICON.lock + ' Not for sale. The story will put it in your hands.</div>';
  else if (rank < g.rank) action = '<div class="lockmsg">' + ICON.lock + ' Needs rank ' + g.rank + ' (' + RANKS[g.rank - 1].name + '). You are rank ' + rank + '.</div>';
  else action = '<button class="btn pri wide ' + (d.credits >= g.price ? '' : 'off') + '" data-a="buy" data-snd="buy">Buy for ' + fmtCr(g.price) + ' credits' + (d.credits >= g.price ? '' : ' (you have ' + fmtCr(d.credits) + ')') + '</button>';
  const tile = (s) => {
    const fixed = uiSlotOptions(s.id, g).length <= 1, isScope = s.id === 'scope', id = isScope ? st.scope.id : cfg[s.id];
    const inner = `<span class="sl-pic plate"><canvas data-part-slot="${s.id}" data-part-id="${id}" data-gun="${gunId}" ${cfgA}></canvas></span>
      ${isScope ? `<canvas class="glass" data-glass="${id}" data-gun="${gunId}" ${cfgA}></canvas>` : ''}
      <span class="sl-t"><span>${s.name}</span><b>${esc((isScope ? st.scope.name : partName(s.id, cfg)) || 'Standard')}</b>${isScope ? '<i>' + uiScopeFacts(st.scope) + '</i>' : ''}</span>`;
    if (!own) return `<div class="slot fixed ${isScope ? 'scope' : ''}">${inner}</div>`;
    return `<button class="slot ${fixed ? 'fixed' : ''} ${isScope ? 'scope' : ''}" data-a="slot" data-slot="${s.id}" ${fixed ? 'data-quiet="1"' : ''}>${inner}${fixed ? '<em>Fixed</em>' : ''}</button>`;
  };
  const skinTile = own ? `<button class="slot skin" data-a="slot" data-slot="skin"><span class="sl-pic"><canvas data-swatch="${cfg.skin || 'factory'}" data-gun="${gunId}" data-live="1"></canvas></span><span class="sl-t"><span>Skin</span><b>${esc(partName('skin', cfg))}</b><i>For looks only</i></span></button>` : '';
  UI.render(`<div class="scr bench">
    <div class="bar"><button class="ib" data-a="back" data-snd="back">${ICON.back}</button><div class="bar-t"><div class="eyebrow">${esc(g.maker)}</div><h2>${esc(g.name)}</h2></div><div class="cr"><b>${fmtCr(d.credits)}</b><small>credits</small></div></div>
    <div class="split">
      <div class="side">
        <div class="stage plate"><canvas data-gun="${gunId}" data-live="1" ${cfgA}></canvas></div>
        <div class="gsub">${esc(g.calName)}  ·  ${ACTION_NAME[g.action]}  ·  good to ${st.eff} m</div>
        <div class="bars">${barsHtml}</div>
        <div class="cta">${action}</div>
      </div>
      <div class="main scroll">
        <div class="eyebrow">${own ? 'Tap a part to change it' : 'What it comes with'}</div>
        <div class="slots">${SLOTS.map(tile).join('')}${skinTile}</div>
        <p class="blurb">${esc(g.blurb)}</p>
        ${facts}
        <button class="btn ghost wide" data-a="dope">Drop and wind table for this rifle</button>
      </div>
    </div></div>`, {
    back() { if (UI.backTo) { const f = UI.backTo; UI.backTo = null; f(); } else { UI.tab = 'armory'; UI.hub(); } },
    equip() { d.equipped = gunId; Save.write(); UI.keepScroll(); UI.bench(gunId); UI.toast(g.name + ' is now your rifle.'); },
    buy() { const err = Progress.buy('gun', gunId); if (err) { Sfx.ui('deny'); UI.toast(err, 'bad'); return; } d.equipped = gunId; Save.write(); UI.toast('Bought: ' + g.name, 'good'); UI.bench(gunId); },
    slot(ds) { if (ds.slot === 'skin') UI.skinPicker(gunId); else UI.partPicker(gunId, ds.slot); },
    dope() { UI.dope(st); },
  }, 'is-bench');
};

// ---- choosing a part ---------------------------------------------------------------------------
// One card per option: its picture, what it is, what it changes against what is fitted now, and
// what it costs. Scope cards also show the view through the glass, bottom right.
UI.partPicker = function (gunId, slot) {
  const d = Save.data, g = GUN_BY_ID[gunId], cfg = gunCfg(gunId), rank = rankOf(d.xp).n;
  const isScope = slot === 'scope';
  const opts = uiSlotOptions(slot, g);
  if (opts.length <= 1) { UI.toast('Nothing else fits here on this rifle.'); return; }
  const st0 = buildStats(gunId, cfg), base = statBars(st0), cfgA = uiCfgAttr(cfg);
  // what the eight bars do not show: magazine size, reload time, breath, how the rifle handles
  const facts = (a, b) => {
    const o = [], dm = b.mag - a.mag, dr = b.reload - a.reload, db = b.breath - a.breath, dh = b.handling - a.handling;
    if (dm) o.push([(dm > 0 ? '+' : '') + dm + ' rounds', dm > 0]);
    if (Math.abs(dr) >= 0.05) o.push(['Reload ' + (dr > 0 ? '+' : '') + fmt(dr, 1) + ' s', dr < 0]);
    if (Math.abs(db) >= 0.1) o.push(['Hold breath ' + (db > 0 ? '+' : '') + fmt(db, 1) + ' s', db > 0]);
    if (Math.abs(dh) >= 0.03) o.push([dh > 0 ? 'Settles faster' : 'Settles slower', dh > 0]);
    if (Math.abs(b.pan - a.pan) >= 0.02) o.push([b.pan < a.pan ? 'Slower to swing' : 'Quicker to swing', b.pan > a.pan]);
    if (b.jerk < a.jerk - 0.005) o.push(['Cleaner trigger pull', true]); else if (b.jerk > a.jerk + 0.005) o.push(['Rougher trigger pull', false]);
    if (b.tracer !== a.tracer) o.push([b.tracer ? 'You see the bullet fly' : 'No glowing bullet', b.tracer]);
    return o.map((x) => `<span class="dchip ${x[1] ? 'up' : 'down'}">${x[0]}</span>`).join('');
  };
  const rows = opts.map((p) => {
    const own = isScope ? ownsScope(p.id) : ownsPart(p.id), cur = cfg[slot] === p.id, locked = !own && rank < p.rank;
    const c2 = Object.assign({}, cfg); c2[slot] = p.id;
    const st2 = cur ? null : buildStats(gunId, c2), dl = cur ? [] : statDeltas(base, statBars(st2));
    let extra = cur ? '' : facts(st0, st2);
    if (isScope) extra += `<span class="dchip n">${p.zoom[0] === p.zoom[1] ? p.zoom[0] + 'x fixed' : p.zoom[0] + '-' + p.zoom[1] + 'x'}</span>` + (p.turret ? '<span class="dchip n">zero dial</span>' : '') + (p.lrf ? '<span class="dchip n">rangefinder</span>' : '') + (p.nv ? '<span class="dchip n">night vision</span>' : '') + (p.smart ? '<span class="dchip n">aim computer</span>' : '');
    const chips = dl.map((x) => `<span class="dchip ${x.dv > 0 ? 'up' : 'down'}">${x.label} ${x.dv > 0 ? '+' : ''}${x.dv}</span>`).join('') + extra;
    let btn;
    if (cur) btn = '<span class="st fitted">Fitted</span>';
    else if (own) btn = '<span class="st fit">Owned  ·  fit</span>';
    else if (locked) btn = '<span class="st lock">' + ICON.lock + ' Rank ' + p.rank + '</span>';
    else btn = '<span class="st buy ' + (d.credits >= p.price ? 'can' : '') + '">' + (d.credits >= p.price ? 'Buy  ·  ' : '') + fmtCr(p.price) + ' cr</span>';
    return `<button class="prow ${cur ? 'on' : ''} ${locked ? 'locked' : ''} ${isScope ? 'scope' : ''}" data-a="pick" data-id="${p.id}">
      <span class="pr-pic plate"><canvas data-lazy data-part-slot="${slot}" data-part-id="${p.id}" data-gun="${gunId}" ${cfgA} ${locked ? 'data-dim="0.85"' : ''}></canvas></span>
      <span class="pr-b"><span class="pr-t"><b>${esc(p.name)}</b>${btn}</span><span class="pr-d">${esc(p.desc)}</span><span class="chipsrow">${chips || (cur ? '<span class="dchip">On the rifle now</span>' : '')}</span></span>
      ${isScope ? `<canvas class="glass" data-lazy data-glass="${p.id}" data-gun="${gunId}" ${cfgA}></canvas>` : ''}
    </button>`;
  }).join('');
  const title = (SLOTS.find((s) => s.id === slot) || {}).name;
  UI.overlay(`<div class="sheet tall picker"><div class="sh-head"><div class="sh-t"><div class="eyebrow">${esc(g.name)}</div><h3>${esc(title)}</h3></div><div class="cr"><b>${fmtCr(d.credits)}</b><small>credits</small></div><button class="x" data-a="close">${ICON.cross}</button></div><div class="sh-body"><div class="pgrid ${isScope ? 'scopes' : ''}">${rows}</div></div></div>`, {
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

// ---- skins -------------------------------------------------------------------------------------
// Six shelves: the five rarities that come out of caches, and the trophies that are earned.
const UI_SKIN_GROUPS = [
  { k: 'c', name: 'Common', cls: 'r0', has: (s) => !s.ex && s.r === 0 }, { k: 'u', name: 'Uncommon', cls: 'r1', has: (s) => !s.ex && s.r === 1 },
  { k: 'r', name: 'Rare', cls: 'r2', has: (s) => !s.ex && s.r === 2 }, { k: 'e', name: 'Epic', cls: 'r3', has: (s) => !s.ex && s.r === 3 },
  { k: 'l', name: 'Legendary', cls: 'r4', has: (s) => !s.ex && s.r === 4 }, { k: 't', name: 'Trophy', cls: 'rt', has: (s) => !!s.ex },
];
function uiSkinGroup(s) { for (let i = 0; i < UI_SKIN_GROUPS.length; i++) if (UI_SKIN_GROUPS[i].has(s)) return UI_SKIN_GROUPS[i]; return UI_SKIN_GROUPS[0]; }
// The shelves, with a row of counters on top that also work as filters.
//   o.all   show every skin (the collection) or only the ones owned (the workbench)
//   o.gun   the rifle the skins are being chosen for, if any
//   o.cur   the skin to mark as chosen
UI.skinShelves = function (o) {
  const d = Save.data, f = UI.skinFilter, seen = d.skinSeen || {};
  const tiles = UI_SKIN_GROUPS.map((g) => {
    const all = SKINS.filter((s) => s.id !== 'factory' && g.has(s)), own = all.filter((s) => d.skins[s.id]).length;
    return `<button class="rtile ${g.cls} ${f === g.k ? 'on' : ''} ${own >= all.length ? 'full' : ''}" data-a="filter" data-k="${g.k}"><span>${g.name}</span><b>${own}<small>/${all.length}</small></b></button>`;
  }).join('');
  const cell = (s) => {
    const g = uiSkinGroup(s), own = !!d.skins[s.id] || s.id === 'factory', on = o.cur === s.id ? 'on' : '';
    if (!own) return `<button class="skcell ${g.cls} unknown ${on}" data-a="skin" data-id="${s.id}"><span class="q">?</span><b>${s.ex ? esc(s.name) : 'Not found yet'}</b><i>${s.ex ? esc(s.ex) : g.name}</i></button>`;
    const fresh = s.id !== 'factory' && !seen[s.id];
    return `<button class="skcell ${g.cls} own ${on}" data-a="skin" data-id="${s.id}"><canvas data-swatch="${s.id}" data-lazy ${o.gun ? 'data-gun="' + o.gun + '"' : ''} ${fresh ? 'data-fresh' : ''}></canvas><b>${esc(s.name)}</b><i>${s.id === 'factory' ? 'Standard' : g.name}</i>${fresh ? '<em class="new">New</em>' : ''}</button>`;
  };
  const shelves = UI_SKIN_GROUPS.filter((g) => !f || f === g.k).map((g) => {
    const all = SKINS.filter((s) => g.has(s) && (s.id !== 'factory' || !o.all)), list = o.all ? all : all.filter((s) => d.skins[s.id] || s.id === 'factory');
    const total = all.filter((s) => s.id !== 'factory').length, own = all.filter((s) => s.id !== 'factory' && d.skins[s.id]).length;
    if (!list.length && !f) return '';
    return `<div class="rgroup ${g.cls}"><div class="rhead"><b>${g.name}</b><i>${own} of ${total}</i></div>${list.length ? '<div class="skgrid">' + list.map(cell).join('') + '</div>' : '<p class="dim">' + (g.k === 't' ? 'None yet. Trophies are earned, not found in caches. The Collection screen says how.' : 'None of these yet. They come out of caches.') + '</p>'}</div>`;
  }).join('');
  return `<div class="rtiles">${tiles}</div><p class="dim rhint">${f ? 'Showing one kind. Tap it again to see them all.' : 'Tap a kind above to show only those.'}</p>${shelves}`;
};

// Choose a skin for one rifle. Tapping a skin fits it straight away.
UI.skinPicker = function (gunId) {
  const d = Save.data, g = GUN_BY_ID[gunId];
  const side = () => {
    const cfg = gunCfg(gunId), s = SKIN_BY_ID[cfg.skin || 'factory'] || SKINS[0], grp = uiSkinGroup(s), n = SKINS.filter((k) => k.id !== 'factory' && d.skins[k.id]).length;
    return `<div class="stage plate"><canvas data-gun="${gunId}" data-live="1" ${uiCfgAttr(cfg)}></canvas></div>
      <div class="sk-info ${grp.cls}"><div class="eyebrow">${s.id === 'factory' ? 'Standard' : grp.name}${uiSkinMoves(s) ? '  ·  it moves' : ''}</div><h3>${esc(s.name)}</h3>
      <p class="dim">Skins are for looks only and fit every rifle. You own ${n} of ${SKINS.length - 1}. More come out of caches, and a few are trophies.</p></div>
      <div class="cta"><button class="btn pri wide" data-a="close" data-snd="back">Done</button></div>`;
  };
  UI.overlay(`<div class="sheet tall skins"><div class="sh-head"><div class="sh-t"><div class="eyebrow">${esc(g.name)}</div><h3>Skins</h3></div><button class="x" data-a="close">${ICON.cross}</button></div>
    <div class="sh-body split"><div class="side sk-side">${side()}</div><div class="main scroll">${UI.skinShelves({ all: false, gun: gunId, cur: gunCfg(gunId).skin || 'factory' })}</div></div></div>`, {
    close() { UI.closeOverlay(); UI.flushSeen(); UI.keepScroll(); UI.bench(gunId); },
    filter(ds) { UI.skinFilter = UI.skinFilter === ds.k ? null : ds.k; UI.skinPicker(gunId); },
    skin(ds, t) {
      const cfg = gunCfg(gunId); cfg.skin = ds.id; d.guns[gunId].cfg = cfg; Save.write(); Sfx.ui('equip');
      UI.over.querySelectorAll('.skcell.on').forEach((e) => e.classList.remove('on')); t.classList.add('on');
      const box = UI.over.querySelector('.sk-side'); box.innerHTML = side(); UI.paintIn(box, 'over');
    },
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
  UI.overlay(`<div class="sheet tall"><div class="sh-head"><h3>${esc(st.name)}: drop and wind</h3><button class="x" data-a="close">${ICON.cross}</button></div><div class="sh-body twocol">
    <div><p class="dim">How far to aim above the target at each distance, in mils (the marks on the scope glass), with the rifle zeroed at ${st.zero} m. "Zeroed" means the distance at which the bullet lands exactly on the crosshair.</p>
    <p class="dim">The wind column is how far a steady 5 m/s crosswind pushes the bullet: aim that far into the wind. Half the wind, half the number.</p></div>
    <div>${UI.dopeTable(st)}</div></div></div>`, { close() { UI.closeOverlay(); } });
};

// ---- collection ---------------------------------------------------------------------------
// Three pages under one tab: the skins, the caches (open and buy), and the progress counters.
UI.collection = function () {
  const d = Save.data, t = Progress.totals(), nC = d.caches.length, sub = UI.colTab;
  const seg = `<div class="seg">${[['skins', 'Skins'], ['caches', 'Caches'], ['progress', 'Progress']].map((s) => `<button class="${sub === s[0] ? 'on' : ''}" data-a="sub" data-t="${s[0]}">${s[1]}${s[0] === 'caches' && nC ? '<em>' + nC + '</em>' : ''}</button>`).join('')}</div>`;
  let body;
  const h = {
    sub(ds) { UI.colTab = ds.t; UI.collection(); },
    open(ds) { UI.openCache(ds.t || null); },
    buycache(ds) {
      const err = Progress.buyCache(ds.t);
      if (err) { Sfx.ui('deny'); UI.toast(err, 'bad'); return; }
      Sfx.ui('buy'); UI.toast(CACHE_NAME[ds.t] + ' bought. Open it when you like.', 'good'); UI.keepScroll(); UI.collection();
    },
  };
  if (sub === 'caches') {
    const blurb = { field: 'Also earned for three-star runs and challenges.', sealed: 'Also earned for new ranks, chapters and ducks.', vault: 'Only sold here. Never holds a common skin.' };
    const cards = ['field', 'sealed', 'vault'].map((k) => {
      const have = d.caches.filter((c) => c === k).length, price = CACHE_PRICE[k], can = d.credits >= price, odds = CACHE_ODDS[k];
      return `<div class="ccard t-${k}">
        <div class="cc-h"><span class="cc-ic">${ICON.box}</span><span class="cc-t"><b>${CACHE_NAME[k]}</b><i>${blurb[k]}</i></span></div>
        <div class="odds">${odds.map((p, r) => `<div class="od r${r}"><span>${RAR[r]}</span><i><i style="width:${p}%"></i></i><b>${p}%</b></div>`).join('')}</div>
        <div class="cc-f"><button class="btn pri ${can ? '' : 'off'}" data-a="buycache" data-t="${k}" data-quiet="1">Buy  ·  ${fmtCr(price)} cr</button></div>
        <div class="cc-why ${can ? '' : 'no'}">${can ? (have ? 'You have ' + have + ' to open' : 'You have none of these') : 'Not enough credits: ' + fmtCr(price - d.credits) + ' short'}</div>
      </div>`;
    }).join('');
    body = `<div class="scroll caches">
      <div class="cachebox ${nC ? 'has' : ''}"><div class="cb-ic">${ICON.box}</div><div class="cb-t"><b>${nC ? nC + (nC === 1 ? ' cache' : ' caches') + ' to open' : 'No caches waiting'}</b><i>Each cache holds one rifle skin. Earn them by playing, or buy them here with the credits you earn in missions. There is no real money in this game.</i></div>${nC ? '<button class="btn pri" data-a="open" data-t="best" data-snd="riser">Open one</button>' : ''}</div>
      <div class="cgrid">${cards}</div>
      <p class="fine">The percentages are the chance of each kind of skin. Within a kind you get one you do not own yet, for as long as there is one left. Once you own a whole kind, a cache may give you a skin from the next kind up or down instead, or a duplicate, which is traded in for credits straight away: ${DUPE_CR.map((c, r) => RAR[r].toLowerCase() + ' ' + fmtCr(c)).join(', ')}.</p>
    </div>`;
  } else if (sub === 'progress') {
    const tile = (n, max, label) => `<div class="ptile ${n >= max ? 'full' : ''}"><b>${n}<small>/${max}</small></b><span>${label}</span><i><i style="width:${Math.round((n / max) * 100)}%"></i></i></div>`;
    body = `<div class="scroll">
      <div class="ptiles">${tile(t.stars, t.starsMax, 'Stars')}${tile(t.ch, t.missions, 'Challenges')}${tile(t.ducks, t.missions, 'Rubber ducks')}${tile(t.guns, t.gunsMax, 'Rifles')}${tile(t.parts, t.partsMax, 'Parts')}${tile(t.skins, t.skinsMax, 'Skins')}</div>
      <div class="records"><div class="eyebrow">Records</div><div class="recs"><div><b>${d.stats.longest || 0} m</b><i>longest kill</i></div><div><b>${fmtCr(d.stats.shots)}</b><i>shots fired</i></div><div><b>${d.stats.heads}</b><i>headshots</i></div><div><b>${d.stats.wins}</b><i>contracts won</i></div><div><b>${d.stats.cachesOpened || 0}</b><i>caches opened</i></div></div></div>
      <p class="fine">Trophy skins: ${SKINS.filter((s) => s.ex).map((s) => esc(s.name) + ' (' + esc(s.ex.toLowerCase()) + ')').join(', ')}.</p>
    </div>`;
  } else {
    const gunId = d.equipped, g = GUN_BY_ID[gunId];
    if (!UI.colSkin || !SKIN_BY_ID[UI.colSkin]) UI.colSkin = gunCfg(gunId).skin || 'factory';
    const side = () => {
      const cfg = gunCfg(gunId), s = SKIN_BY_ID[UI.colSkin] || SKINS[0], own = !!d.skins[s.id] || s.id === 'factory', grp = uiSkinGroup(s), on = (cfg.skin || 'factory') === s.id;
      let act;
      if (own) act = on ? '<div class="inuse">' + ICON.check + ' On your ' + esc(g.name) + ' now</div>' : '<button class="btn pri wide" data-a="fit" data-snd="equip">Put it on my rifle</button>';
      else act = s.ex ? '<div class="lockmsg">' + ICON.lock + ' Trophy: ' + esc(s.ex.toLowerCase()) + '.</div>' : '<button class="btn ghost wide" data-a="sub" data-t="caches">It comes out of a cache</button>';
      return `<div class="stage plate ${own ? '' : 'shade'}"><canvas data-gun="${gunId}" data-live="1" ${uiCfgAttr(Object.assign({}, cfg, { skin: own ? s.id : 'factory' }))}></canvas></div>
        <div class="sk-info ${grp.cls}"><div class="eyebrow">${s.id === 'factory' ? 'Standard' : grp.name}${own && uiSkinMoves(s) ? '  ·  it moves' : ''}</div><h3>${own || s.ex ? esc(s.name) : 'Not found yet'}</h3>
        <p class="dim">${own ? 'Shown on your ' + esc(g.name) + '. Skins are for looks only and fit every rifle.' : 'You do not have this one yet, so it is kept in the dark.'}</p></div>
        <div class="cta">${act}</div>`;
    };
    h.filter = (ds) => { UI.skinFilter = UI.skinFilter === ds.k ? null : ds.k; UI.collection(); };
    h.skin = (ds, el2) => {
      UI.colSkin = ds.id; UI.root.querySelectorAll('.skcell.on').forEach((e) => e.classList.remove('on')); el2.classList.add('on');
      const box = UI.root.querySelector('.sk-side'); box.innerHTML = side(); UI.paintIn(box, 'root');
    };
    h.fit = () => {
      const c = gunCfg(gunId), s = SKIN_BY_ID[UI.colSkin]; c.skin = s.id; d.guns[gunId].cfg = c; Save.write(); UI.toast(s.name + ' fitted to ' + g.name + '.', 'good');
      const box = UI.root.querySelector('.sk-side'); box.innerHTML = side(); UI.paintIn(box, 'root');
    };
    body = `${nC ? `<button class="cachestrip" data-a="open" data-t="best" data-snd="riser">${ICON.box}<b>${nC} ${nC === 1 ? 'cache' : 'caches'} to open</b><span>Open</span></button>` : ''}
      <div class="split"><div class="side sk-side">${side()}</div><div class="main scroll">${UI.skinShelves({ all: true, gun: gunId, cur: UI.colSkin })}</div></div>`;
  }
  UI.render(UI.shell(seg, body, 'col-' + sub), UI.shellHandlers(h), 'is-collection');
};

// Open one cache: the one that has waited longest, or a given kind, or ('best') the best kind you
// have, so that a vault cache you have just bought is not stuck behind a pile of field caches.
UI.openCache = function (tier) {
  const d = Save.data, how = tier;
  if (tier === 'best') tier = ['vault', 'sealed', 'field'].find((k) => d.caches.indexOf(k) >= 0);
  if (tier) { const i = d.caches.indexOf(tier); if (i > 0) { d.caches.splice(i, 1); d.caches.unshift(tier); } }
  const res = Progress.openCache();
  if (!res) { UI.closeOverlay(); UI.collection(); return; }
  const s = res.skin, gunId = d.equipped, cfg = Object.assign({}, gunCfg(gunId), { skin: s.id }), kind = CACHE_NAME[res.tier] || 'Cache';
  UI.overlay(`<div class="cacheopen r${s.r} t-${res.tier}">
    <div class="co-box"><span>${ICON.box}</span><b>${esc(kind)}</b></div>
    <div class="co-card"><div class="co-pic plate"><canvas data-gun="${gunId}" data-live="1" ${uiCfgAttr(cfg)}></canvas></div>
      <div class="co-b"><div class="co-rar">${RAR[s.r]}  ·  from a ${esc(kind.toLowerCase())}</div><h3>${esc(s.name)}</h3>
      <p>${res.dupe ? 'You already own this one. Traded in for <b>' + fmtCr(res.cr) + '</b> credits.' : 'New skin. It fits every rifle you own.'}</p>
      <div class="co-btns">${res.dupe ? '' : '<button class="btn ghost" data-a="fit" data-snd="equip">Put it on my rifle</button>'}${d.caches.length ? '<button class="btn pri" data-a="next" data-snd="riser">Open next (' + d.caches.length + ')</button>' : ''}<button class="btn ${d.caches.length ? 'ghost' : 'pri'}" data-a="done">Done</button></div></div></div></div>`, {
    fit(ds, b) { const c = gunCfg(gunId); c.skin = s.id; d.guns[gunId].cfg = c; Save.write(); UI.toast(s.name + ' fitted to ' + GUN_BY_ID[gunId].name + '.', 'good'); if (b) b.classList.add('off'); },
    next() { UI.openCache(how === 'best' ? 'best' : undefined); },
    done() { UI.closeOverlay(); if (UI.afterCache) { const f = UI.afterCache; UI.afterCache = null; f(); } else UI.collection(); },
  }, 'center');
  setTimeout(() => { const c = UI.over.querySelector('.cacheopen'); if (c) { c.classList.add('go'); UI.paintIn(c, 'over'); } Sfx.rarity(s.r); }, res.tier === 'vault' ? 900 : 650);
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
  UI.render(UI.shell('<div class="hd"><div class="eyebrow">Practice</div><h2>The Range</h2></div>', `<div class="split rangev">
    <div class="side">
      <p class="dim">Steel plates and a paper target at any distance, in any wind. No fee, no rating, no hurry. The best place to learn what a rifle does and what the marks on a scope mean.</p>
      <div class="stepper"><button class="sq" data-a="d" data-v="-100" aria-label="Closer">&minus;</button><div><span>Distance</span><b>${R.dist} m</b></div><button class="sq" data-a="d" data-v="100" aria-label="Further">+</button></div>
      <div class="stepper"><button class="sq" data-a="w" data-v="-1" aria-label="More wind from the right">&minus;</button><div><span>${R.wind === 0 ? 'Crosswind' : 'Wind from the ' + (R.wind > 0 ? 'left' : 'right')}</span><b>${R.wind === 0 ? 'Calm' : Math.abs(R.wind) + ' m/s'}</b></div><button class="sq" data-a="w" data-v="1" aria-label="More wind from the left">+</button></div>
    </div>
    <div class="main">
      <button class="gcard tallc" data-a="gun"><span class="gc-pic plate"><canvas data-gun="${d.equipped}" data-live="1"></canvas></span><span class="gc-row"><span class="gc-t"><b>${esc(g.name)}</b><i>${esc(st.scope.name)}  ·  good to ${st.eff} m</i></span><span class="chg">Change</span></span></button>
      <div class="note">${dp.reached ? 'At ' + R.dist + ' m this rifle needs a hold of about <b>' + fmt(Math.max(0, dp.dropMil), 1) + ' mils up</b>' + (R.wind ? ' and <b>' + fmt(Math.abs(dp.driftMil), 1) + ' mils into the wind</b>' : '') + '. The bullet takes ' + fmt(dp.tof, 2) + ' seconds to arrive.' : 'This rifle cannot reach ' + R.dist + ' m. Try anyway if you like.'}</div>
      <div class="cta"><button class="btn pri big wide" data-a="go" data-snd="go">Go to the range</button></div>
    </div></div>`), UI.shellHandlers({
    d(ds) { R.dist = clamp(R.dist + +ds.v, 100, 1800); UI.keepScroll(); UI.range(); },
    w(ds) { R.wind = clamp(R.wind + +ds.v, -8, 8); UI.keepScroll(); UI.range(); },
    gun() { UI.gunPicker(null); },
    go() { MISSION_BY_ID.range = rangeMission(R.dist, R.wind); UI.launch('range', {}); },
  }), 'is-range');
};
