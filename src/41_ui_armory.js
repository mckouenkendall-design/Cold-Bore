// ---------------------------------------------------------------------------
// Menus, part 2: the armory, the workbench, the part and skin pickers, the
// collection, caches and the range.
// ---------------------------------------------------------------------------
const STAT_LABELS = [['reach', 'Reach'], ['flat', 'Flat shooting'], ['wind', 'Holds in wind'], ['steady', 'Steadiness'], ['exact', 'Accuracy'], ['calm', 'Low recoil'], ['rate', 'Rate of fire'], ['quiet', 'Quietness']];
const ACTION_NAME = { bolt: 'Bolt action', semi: 'Semi-automatic', single: 'Single shot', charge: 'Coil, charges before firing' };

// A rifle the shop has opened that you have not looked at yet.
function uiGunNew(g) { const d = Save.data; return !d.guns[g.id] && !g.special && gateOpen(g) && !(d.seenGuns || {})[g.id]; }
UI.armory = function () {
  const d = Save.data;
  if (d.newArmory) { d.newArmory = false; Save.write(); }
  let nNew = 0, nCan = 0;
  const cards = GUNS.map((g) => {
    const own = !!d.guns[g.id], cfg = own ? gunCfg(g.id) : defaultConfig(g.id), st = buildStats(g.id, cfg), open = gateOpen(g), fresh = uiGunNew(g), can = !own && !g.special && open && d.credits >= g.price;
    if (fresh) nNew++; if (can) nCan++;
    let tag;
    if (own) tag = d.equipped === g.id ? '<span class="tag eq">In use</span>' : '<span class="tag own">Owned</span>';
    else if (g.special) tag = '<span class="tag lock">' + ICON.lock + ' Story</span>';
    else if (!open) tag = '<span class="tag lock">' + ICON.lock + ' Rank ' + gateRank(g).n + '</span>';
    else tag = '<span class="tag buy ' + (can ? 'can' : '') + '">' + (can ? ICON.check : '') + fmtCr(g.price) + ' cr</span>';
    const mb = own && CB.Mastery ? CB.Mastery.badge(g.id) : '';
    return `<button class="acard ${own ? 'own' : ''} ${d.equipped === g.id ? 'eq' : ''} ${!own && (g.special || !open) ? 'shut' : ''} ${fresh ? 'fresh' : ''} ${can ? 'can' : ''}" data-a="gun" data-id="${g.id}">
      <span class="ac-pic plate"><canvas data-gun="${g.id}" data-lazy ${uiCfgAttr(cfg)}></canvas>${tag}${fresh ? '<em class="newtag">New</em>' : ''}${mb}</span>
      <span class="ac-t"><b>${esc(g.name)}</b><i>${esc(g.calName)}  ·  ${ACTION_NAME[g.action].split(',')[0]}  ·  ${st.eff} m</i></span></button>`;
  }).join('');
  const lead = nNew ? `<b>${nNew === 1 ? 'One rifle is' : nNew + ' rifles are'} new at Pip's.</b> ` : '';
  UI.render(UI.shell('<div class="hd"><div class="eyebrow">Pip\'s bench</div><h2>Armory</h2></div><button class="btn ghost sm gr-in" data-a="gunroom">' + ICON.room + '<span>Gun room</span></button>',
    `<div class="scroll"><p class="dim lead">${lead}Sixteen rifles, each its own way to shoot: how steady it sits, how fast the bullet flies, how far it falls, how loud it is.${nCan ? ' A tick on the price means you can buy it now.' : ''} Tap one to look closer and change its parts.</p><div class="alist">${cards}</div></div>`),
    UI.shellHandlers({ gun(ds) { UI.backTo = null; UI.bench(ds.id); } }), 'is-armory');
};

function partName(slot, cfg) { if (slot === 'scope') return (SCOPE_BY_ID[cfg.scope] || {}).name; if (slot === 'skin') return (SKIN_BY_ID[cfg.skin || 'factory'] || SKINS[0]).name; return (PART_BY_ID[cfg[slot]] || {}).name; }
// The part in a slot that actually counts: a part that does not fit this rifle is ignored by buildStats, so show the factory one.
function uiFitted(gunId, cfg, slot) { const p = PART_BY_ID[cfg[slot]]; return p && partFits(p, GUN_BY_ID[gunId]) ? p.id : defaultConfig(gunId)[slot]; }
// How far a bullet gets through things, as steps (the same thresholds the bullets follow in a mission).
function uiPenStep(pen) { return pen >= 3 ? 4 : pen >= 1.4 ? 3 : pen >= 1 ? 2 : pen >= 0.2 ? 1 : 0; }
const UI_PEN_UP = ['', 'Gets through glass', 'Clean through glass', 'Goes through thin cover', 'Goes through a wall'];
const UI_PEN_DOWN = ['', 'Glass stops it', 'Glass knocks it off line', 'No longer through thin cover', 'No longer through walls'];
// A short note on which rifles a part was made for, if it is not a general part.
function uiFitNote(p, g) {
  if (p.guns) { if (p.guns.length === 1) return 'Made for this rifle'; if (p.guns.length > 3) return 'Fits ' + p.guns.length + ' rifles'; const n = p.guns.map((id) => id.charAt(0).toUpperCase() + id.slice(1)); return 'Made for the ' + n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1]; }
  if (p.cals) return 'Made for ' + g.calName;
  return '';
}
function statDeltas(a, b) {
  const out = [];
  STAT_LABELS.forEach(([k, label]) => { const dv = Math.round((b[k] - a[k]) * 100); if (Math.abs(dv) >= 2) out.push({ label, dv }); });
  out.sort((x, y) => Math.abs(y.dv) - Math.abs(x.dv));
  return out.slice(0, 4);
}
// What a rifle could have fitted in one slot.
function uiSlotOptions(slot, g) { return slot === 'scope' ? SCOPES.filter((sc) => scopeFits(sc, g)) : PARTS.filter((p) => p.slot === slot && partFits(p, g)); }
function uiScopeFacts(p) { return (p.zoom[0] === p.zoom[1] ? p.zoom[0] + 'x fixed' : p.zoom[0] + ' to ' + p.zoom[1] + 'x') + (p.turret ? '  ·  zero dial' : '') + (p.lrf ? '  ·  rangefinder' : '') + (p.nv ? '  ·  night vision' : '') + (p.smart ? '  ·  aim computer' : ''); }

// The eight stat bars, each with its number out of 100. Given a second set (to), each bar shows
// the change as a ghost: green for what it would gain, red for what it would lose.
UI.statBarsHtml = function (bars, to) {
  return STAT_LABELS.map(([k, label]) => {
    const a = Math.round(bars[k] * 100);
    if (!to) return `<div class="sbar"><span>${label}<em>${a}</em></span><i><i style="width:${a}%"></i></i></div>`;
    const b = Math.round(to[k] * 100), lo = Math.min(a, b), dv = b - a;
    return `<div class="sbar ${dv > 0 ? 'up' : dv < 0 ? 'down' : ''}"><span>${label}<em>${dv ? a + ' &rarr; ' + b : a}</em></span><i><i style="width:${lo}%"></i>${dv ? `<i class="gh ${dv > 0 ? 'up' : 'down'}" style="left:${lo}%;width:${Math.abs(dv)}%"></i>` : ''}</i></div>`;
  }).join('');
};

// ---- the workbench ---------------------------------------------------------------------------
// The rifle on the left with its numbers and the one button that matters; on the right a tile for
// every slot, each showing a side view of what is fitted there.
UI.bench = function (gunId) {
  const d = Save.data, g = GUN_BY_ID[gunId], own = !!d.guns[gunId], cfg = own ? gunCfg(gunId) : defaultConfig(gunId);
  const st = buildStats(gunId, cfg), bars = statBars(st), rank = Progress.rankNow().n, cfgA = uiCfgAttr(cfg);
  if (gateOpen(g) && !(d.seenGuns || {})[gunId]) { if (!d.seenGuns) d.seenGuns = {}; d.seenGuns[gunId] = 1; Save.write(); }
  const barsHtml = UI.statBarsHtml(bars);
  const facts = `<div class="facts"><div><b>${Math.round(st.v0)}</b><i>m/s at the muzzle</i></div><div><b>${st.mag}</b><i>${st.mag === 1 ? 'round' : 'rounds'}</i></div><div><b>${fmt(st.cycle, 1)} s</b><i>between shots</i></div><div><b>${fmt(st.zoomMin, 0)}-${fmt(st.zoomMax, 0)}x</b><i>zoom</i></div><div><b>${st.silent ? 'Silent' : st.quiet ? 'Quiet' : 'Loud'}</b><i>${st.silent ? 'nobody hears it' : st.quiet ? 'bullet crack only' : 'heard to ' + Math.round(st.noise) + ' m'}</i></div><div><b>${st.pen >= 3 ? 'Walls' : st.pen >= 1.4 ? 'Thin cover' : st.pen >= 0.2 ? 'Glass' : 'Nothing'}</b><i>${st.pen >= 3 ? 'goes through one' : st.pen >= 1.4 ? 'and glass, cleanly' : st.pen >= 1 ? 'goes through cleanly' : st.pen >= 0.2 ? 'through, knocked off line' : 'glass stops it'}</i></div></div>`;
  let action;
  if (own) action = d.equipped === gunId ? '<div class="inuse">' + ICON.check + ' This is the rifle you carry</div>' : '<button class="btn pri wide" data-a="equip" data-snd="equip">Carry this rifle</button>';
  else if (g.special) action = '<div class="lockmsg">' + ICON.lock + ' Not for sale. The story will put it in your hands.</div>';
  else if (!gateOpen(g)) action = '<div class="lockmsg">' + ICON.lock + ' Needs rank ' + gateRank(g).n + ' (' + gateRank(g).name + '). You are rank ' + rank + '.</div>';
  else action = '<button class="btn pri wide ' + (d.credits >= g.price ? '' : 'off') + '" data-a="buy" data-snd="buy">Buy for ' + fmtCr(g.price) + ' credits' + (d.credits >= g.price ? '' : ' (you have ' + fmtCr(d.credits) + ')') + '</button>';
  const tile = (s) => {
    const fixed = uiSlotOptions(s.id, g).length <= 1, isScope = s.id === 'scope', id = isScope ? st.scope.id : uiFitted(gunId, cfg, s.id);
    const inner = `<span class="sl-pic plate"><canvas data-part-slot="${s.id}" data-part-id="${id}" data-gun="${gunId}" ${cfgA}></canvas></span>
      ${isScope ? `<canvas class="glass" data-glass="${id}" data-gun="${gunId}" ${cfgA}></canvas>` : ''}
      <span class="sl-t"><span>${s.name}</span><b>${esc((isScope ? st.scope.name : (PART_BY_ID[id] || {}).name) || 'Standard')}</b>${isScope ? '<i>' + uiScopeFacts(st.scope) + '</i>' : ''}</span>`;
    if (!own) return `<div class="slot fixed ${isScope ? 'scope' : ''}">${inner}</div>`;
    return `<button class="slot ${fixed ? 'fixed' : ''} ${isScope ? 'scope' : ''}" data-a="slot" data-slot="${s.id}" ${fixed ? 'data-quiet="1"' : ''}>${inner}${fixed ? '<em>Fixed</em>' : ''}</button>`;
  };
  const skinTile = own ? `<button class="slot skin" data-a="slot" data-slot="skin"><span class="sl-pic"><canvas data-swatch="${cfg.skin || 'factory'}" data-gun="${gunId}" data-live="1"></canvas></span><span class="sl-t"><span>Skin</span><b>${esc(partName('skin', cfg))}</b><i>For looks only</i></span></button>` : '';
  UI.render(`<div class="scr bench">
    <div class="bar"><button class="ib" data-a="back" data-snd="back">${ICON.back}</button><div class="bar-t"><div class="eyebrow">${esc(g.maker)}</div><h2>${esc(g.name)}</h2></div><div class="cr"><b>${fmtCr(d.credits)}</b><small>credits</small></div></div>
    <div class="split">
      <div class="side">
        <div class="stage plate"><canvas data-gun="${gunId}" data-live="1" ${cfgA}></canvas>${own ? CB.Mastery.badge(gunId) : ''}</div>
        <div class="gsub">${esc(g.calName)}  ·  ${ACTION_NAME[g.action]}  ·  good to ${st.eff} m</div>
        <div class="bars">${barsHtml}</div>
        <div class="cta">${action}</div>
      </div>
      <div class="main scroll">
        <div class="eyebrow">${own ? 'Tap a part to change it' : 'What it comes with'}</div>
        <div class="slots">${SLOTS.map(tile).join('')}${skinTile}</div>
        ${own ? CB.Mastery.panel(gunId) : ''}
        <p class="blurb">${esc(g.blurb)}</p>
        ${facts}
        <button class="btn ghost wide" data-a="dope">Drop and wind table for this rifle</button>
      </div>
    </div></div>`, {
    back() { if (UI.backTo) { const f = UI.backTo; UI.backTo = null; f(); } else { UI.tab = 'armory'; UI.hub(); } },
    equip() { d.equipped = gunId; Save.write(); UI.keepScroll(); UI.bench(gunId); UI.toast(g.name + ' is now your rifle.'); },
    buy() { const err = Progress.buy('gun', gunId); if (err) { Sfx.ui('deny'); UI.toast(err, 'bad'); return; } d.equipped = gunId; Save.write(); UI.bench(gunId); UI.unbox(gunId, 'Bought from Pip', true); },
    slot(ds) { if (ds.slot === 'skin') UI.skinPicker(gunId); else UI.partPicker(gunId, ds.slot); },
    dope() { UI.dope(st); },
  }, 'is-bench');
};

// ---- choosing a part ---------------------------------------------------------------------------
// One card per option: its picture, what it is, what it changes against what is fitted now, and
// what it costs. Scope cards also show the view through the glass, bottom right.
UI.partPicker = function (gunId, slot) {
  const d = Save.data, g = GUN_BY_ID[gunId], cfg = gunCfg(gunId);
  const isScope = slot === 'scope';
  const opts = uiSlotOptions(slot, g);
  if (opts.length <= 1) { UI.toast('Nothing else fits here on this rifle.'); return; }
  const st0 = buildStats(gunId, cfg), base = statBars(st0), cfgA = uiCfgAttr(cfg);
  const facts = uiPartFacts;
  const rows = opts.map((p) => {
    const own = isScope ? ownsScope(p.id) : ownsPart(p.id), cur = (isScope ? st0.scope.id : uiFitted(gunId, cfg, slot)) === p.id, locked = !own && !gateOpen(p);
    const c2 = Object.assign({}, cfg); c2[slot] = p.id;
    const st2 = cur ? null : buildStats(gunId, c2), dl = cur ? [] : statDeltas(base, statBars(st2));
    let extra = cur ? '' : facts(st0, st2);
    const note = isScope ? '' : uiFitNote(p, g);
    if (isScope) extra += `<span class="dchip n">${p.zoom[0] === p.zoom[1] ? p.zoom[0] + 'x fixed' : p.zoom[0] + '-' + p.zoom[1] + 'x'}</span>` + (p.turret ? '<span class="dchip n">zero dial</span>' : '') + (p.lrf ? '<span class="dchip n">rangefinder</span>' : '') + (p.nv ? '<span class="dchip n">night vision</span>' : '') + (p.smart ? '<span class="dchip n">aim computer</span>' : '');
    const chips = (note ? `<span class="dchip fitfor">${note}</span>` : '') + dl.map((x) => `<span class="dchip ${x.dv > 0 ? 'up' : 'down'}">${x.label} ${x.dv > 0 ? '+' : ''}${x.dv}</span>`).join('') + extra;
    let btn;
    if (cur) btn = '<span class="st fitted">Fitted</span>';
    else if (own) btn = '<span class="st fit">Owned  ·  fit</span>';
    else if (locked) btn = '<span class="st lock">' + ICON.lock + ' Rank ' + gateRank(p).n + '</span>';
    else btn = '<span class="st buy ' + (d.credits >= p.price ? 'can' : '') + '">' + (d.credits >= p.price ? 'Try  ·  ' : '') + fmtCr(p.price) + ' cr</span>';
    return `<button class="prow ${cur ? 'on' : ''} ${locked ? 'locked' : ''} ${isScope ? 'scope' : ''}" data-a="pick" data-id="${p.id}">
      <span class="pr-pic plate"><canvas data-lazy data-part-slot="${slot}" data-part-id="${p.id}" data-gun="${gunId}" ${cfgA} ${locked ? 'data-dim="0.85"' : ''}></canvas></span>
      <span class="pr-b"><span class="pr-t"><b>${esc(p.name)}</b>${btn}</span><span class="pr-d">${esc(p.desc)}</span><span class="chipsrow">${chips || (cur ? '<span class="dchip">On the rifle now</span>' : '')}</span></span>
      ${isScope ? `<canvas class="glass" data-lazy data-glass="${p.id}" data-gun="${gunId}" ${cfgA}></canvas>` : ''}
    </button>`;
  }).join('');
  const title = (SLOTS.find((s) => s.id === slot) || {}).name;
  UI.overlay(`<div class="sheet tall picker"><div class="sh-head"><div class="sh-t"><div class="eyebrow">${esc(g.name)}  ·  try one on before you buy it</div><h3>${esc(title)}</h3></div><div class="cr"><b>${fmtCr(d.credits)}</b><small>credits</small></div><button class="x" data-a="close">${ICON.cross}</button></div><div class="sh-body"><div class="pgrid ${isScope ? 'scopes' : ''}">${rows}</div></div></div>`, {
    close() { UI.closeOverlay(); },
    pick(ds) {
      const id = ds.id, own = isScope ? ownsScope(id) : ownsPart(id);
      if ((isScope ? st0.scope.id : uiFitted(gunId, cfg, slot)) === id) return;
      if (!own) { const b = UI.over.querySelector('.sh-body'); UI._pickScroll = b ? b.scrollTop : 0; UI.partPreview(gunId, slot, id); return; }
      Sfx.ui('equip');
      cfg[slot] = id; d.guns[gunId].cfg = cfg; Save.write();
      UI.closeOverlay(); UI.keepScroll(); UI.bench(gunId);
    },
  });
  if (UI._pickScroll) { const b = UI.over.querySelector('.sh-body'); if (b) b.scrollTop = UI._pickScroll; UI._pickScroll = 0; }
};
// A part you do not own, tried on the rifle: the rifle wearing it, every bar with its change shown
// as a ghost, what else it changes, and only then the price and a button to buy it.
UI.partPreview = function (gunId, slot, id) {
  const d = Save.data, g = GUN_BY_ID[gunId], cfg = gunCfg(gunId), isScope = slot === 'scope', p = isScope ? SCOPE_BY_ID[id] : PART_BY_ID[id];
  const c2 = Object.assign({}, cfg); c2[slot] = id;
  const st0 = buildStats(gunId, cfg), st2 = buildStats(gunId, c2), b0 = statBars(st0), b2 = statBars(st2);
  const locked = !gateOpen(p), can = !locked && d.credits >= p.price, title = (SLOTS.find((s) => s.id === slot) || {}).name;
  const note = isScope ? uiScopeFacts(p) : uiFitNote(p, g);
  let act;
  if (locked) act = `<div class="lockmsg">${ICON.lock} Needs rank ${gateRank(p).n} (${esc(gateRank(p).name)}).</div>`;
  else act = `<button class="btn pri wide ${can ? '' : 'off'}" data-a="buy" data-snd="buy">${can ? 'Buy and fit  ·  ' + fmtCr(p.price) + ' cr' : 'Not enough credits: ' + fmtCr(p.price - d.credits) + ' short'}</button>`;
  UI.overlay(`<div class="sheet tall picker preview"><div class="sh-head"><button class="ib" data-a="back" data-snd="back" aria-label="Back to the list">${ICON.back}</button><div class="sh-t"><div class="eyebrow">${esc(g.name)}  ·  trying a ${esc(title.toLowerCase())}</div><h3>${esc(p.name)}</h3></div><div class="cr"><b>${fmtCr(d.credits)}</b><small>credits</small></div></div>
    <div class="sh-body split">
      <div class="side">
        <div class="stage plate"><canvas data-gun="${gunId}" data-live="1" ${uiCfgAttr(c2)}></canvas><span class="pv-tag">Trying it on</span></div>
        <div class="pv-part"><span class="pv-pic plate"><canvas data-part-slot="${slot}" data-part-id="${id}" data-gun="${gunId}" ${uiCfgAttr(c2)}></canvas></span><span class="pv-t">${note ? '<i>' + esc(note) + '</i>' : ''}<b>${fmtCr(p.price)} credits</b></span>${isScope ? `<canvas class="glass" data-glass="${id}" data-gun="${gunId}" ${uiCfgAttr(c2)}></canvas>` : ''}</div>
        <div class="cta col">${act}<button class="btn ghost wide" data-a="back" data-snd="back">Back to the list</button></div>
      </div>
      <div class="main scroll">
        <p class="pv-d">${esc(p.desc)}</p>
        <div class="bars pv-bars">${UI.statBarsHtml(b0, b2)}</div>
        <div class="chipsrow pv-chips">${uiPartFacts(st0, st2) || '<span class="dchip">No other change</span>'}</div>
      </div>
    </div></div>`, {
    back() { UI.partPicker(gunId, slot); },
    buy() {
      const err = Progress.buy(isScope ? 'scope' : 'part', id); if (err) { Sfx.ui('deny'); UI.toast(err, 'bad'); return; }
      const c = gunCfg(gunId); c[slot] = id; d.guns[gunId].cfg = c; Save.write();
      UI.toast('Bought and fitted: ' + p.name, 'good');
      UI.closeOverlay(); UI.keepScroll(); UI.bench(gunId);
    },
  });
};
// What the eight bars do not show: magazine size, reload time, breath, how the rifle handles,
// what it gets through, how far it is heard. As chips, green for better and red for worse.
function uiPartFacts(a, b) {
  const o = [], dm = b.mag - a.mag, dr = b.reload - a.reload, db = b.breath - a.breath, dh = b.handling - a.handling;
  if (dm) o.push([(dm > 0 ? '+' : '') + dm + ' rounds', dm > 0]);
  if (Math.abs(dr) >= 0.05) o.push(['Reload ' + (dr > 0 ? '+' : '') + fmt(dr, 1) + ' s', dr < 0]);
  const dc = b.cycle - a.cycle; // the rate bar cannot show this for the slowest rifles, so say it in seconds
  if (Math.abs(dc) >= 0.04 && Math.abs(statBars(b).rate - statBars(a).rate) < 0.02) o.push(['Next shot ' + (dc > 0 ? '+' : '') + fmt(dc, 2) + ' s', dc < 0]);
  if (Math.abs(db) >= 0.1) o.push(['Hold breath ' + (db > 0 ? '+' : '') + fmt(db, 1) + ' s', db > 0]);
  if (Math.abs(dh) >= 0.03) o.push([dh > 0 ? 'Settles faster' : 'Settles slower', dh > 0]);
  if (Math.abs(b.pan - a.pan) >= 0.02) o.push([b.pan < a.pan ? 'Slower to swing' : 'Quicker to swing', b.pan > a.pan]);
  if (b.jerk < a.jerk - 0.005) o.push(['Cleaner trigger pull', true]); else if (b.jerk > a.jerk + 0.005) o.push(['Rougher trigger pull', false]);
  if (b.tracer !== a.tracer) o.push([b.tracer ? 'You see the bullet fly' : 'No glowing bullet', b.tracer]);
  // what it gets through: glass, cover, walls, people, body armour
  const pa = uiPenStep(a.pen), pb = uiPenStep(b.pen);
  if (pb > pa) o.push([UI_PEN_UP[pb], true]); else if (pb < pa) o.push([UI_PEN_DOWN[pa], false]);
  if ((a.pen >= 1.2) !== (b.pen >= 1.2)) o.push([b.pen >= 1.2 ? 'Goes on through people' : 'Stays in the body', null]);
  if ((a.pen >= 0.5) !== (b.pen >= 0.5)) o.push([b.pen >= 0.5 ? 'Beats body armour' : 'Body armour stops it', b.pen >= 0.5]);
  if (a.silent && !b.silent) o.push(['No longer silent', false]); else if (!a.silent && b.silent) o.push(['Silent', true]);
  if (!a.quiet && !b.quiet && Math.abs(b.noise - a.noise) >= 30) o.push(['Heard to ' + fmtCr(Math.round(b.noise / 10) * 10) + ' m', b.noise < a.noise]); // how far away the shot causes panic
  if (b.eff !== a.eff) o.push(['Reach ' + (b.eff > a.eff ? '+' : '') + (b.eff - a.eff) + ' m', b.eff > a.eff]);
  return o.map((x) => `<span class="dchip ${x[1] === null ? 'n' : x[1] ? 'up' : 'down'}">${x[0]}</span>`).join('');
}

// ---- skins -------------------------------------------------------------------------------------
// Six shelves: the five rarities that come out of caches, and the trophies that are earned.
const UI_SKIN_GROUPS = [
  { k: 'c', name: 'Common', cls: 'r0', has: (s) => !s.ex && s.r === 0 }, { k: 'u', name: 'Uncommon', cls: 'r1', has: (s) => !s.ex && s.r === 1 },
  { k: 'r', name: 'Rare', cls: 'r2', has: (s) => !s.ex && s.r === 2 }, { k: 'e', name: 'Epic', cls: 'r3', has: (s) => !s.ex && s.r === 3 },
  { k: 'l', name: 'Legendary', cls: 'r4', has: (s) => !s.ex && s.r === 4 }, { k: 'm', name: 'Mastery', cls: 'rm', has: (s) => !!s.mastery },
  { k: 't', name: 'Trophy', cls: 'rt', has: (s) => !!s.ex && !s.mastery },
];
// A skin only one rifle can wear (mastery), and whether it fits a given rifle.
function uiSkinFits(s, gunId) { return !s.only || s.only === gunId; }
function uiSkinGroup(s) { for (let i = 0; i < UI_SKIN_GROUPS.length; i++) if (UI_SKIN_GROUPS[i].has(s)) return UI_SKIN_GROUPS[i]; return UI_SKIN_GROUPS[0]; }
// How to get a skin you do not have yet, in one or two plain sentences.
function uiSkinHow(s) {
  if (s.mastery) return 'A mastery skin: only the ' + GUN_BY_ID[s.only].name + ' can wear it, and it never comes out of a cache. To earn it, ' + s.ex.charAt(0).toLowerCase() + s.ex.slice(1) + '.';
  if (s.ex) return 'A trophy: it never comes out of a cache. To earn it, ' + s.ex.charAt(0).toLowerCase() + s.ex.slice(1) + '.';
  const odds = ['field', 'sealed', 'vault'].filter((k) => CACHE_ODDS[k][s.r] > 0).map((k) => CACHE_NAME[k].toLowerCase() + ' ' + CACHE_ODDS[k][s.r] + '%');
  return 'Comes out of caches. The chance that a cache holds ' + (s.r === 1 || s.r === 3 ? 'an ' : 'a ') + RAR[s.r].toLowerCase() + ' skin: ' + odds.join(', ') + '.';
}
// A locked skin shown on the rifle: its real colours, pattern and movement under a light grey veil, with a lock.
function uiLockedStage(gunId, cfg, s) {
  return `<div class="stage plate locked"><canvas data-gun="${gunId}" data-live="1" ${uiCfgAttr(Object.assign({}, cfg, { skin: s.id }))}></canvas><span class="veil"></span><span class="lk">${ICON.lock}</span>${uiLookBtn(s.id)}</div>`;
}
// The button in a stage's corner that opens the full-screen look at a skin.
function uiLookBtn(id) { return `<button class="lookbtn" data-a="inspect" data-id="${id}" aria-label="Look closer">${ICON.look}</button>`; }
// The set a skin belongs to, how much of it you own, and what finishing it pays.
function uiSkinSetLine(s) {
  const d = Save.data;
  return Progress.setOf(s.id).map((S) => {
    const n = S.skins.filter((id) => d.skins[id]).length, done = d.sets && d.sets[S.id];
    return `<div class="sk-set ${done ? 'done' : ''}"><span>Set</span><b>${esc(S.name)}</b><i>${n} of ${S.skins.length}${done ? '  ·  complete' : ''}</i>${done ? '' : '<em>All of them pay ' + fmtCr(S.cr) + ' cr and a ' + esc(CACHE_NAME[S.cache].toLowerCase()) + '</em>'}</div>`;
  }).join('');
}
// What a skin is, in the line above its name.
function uiSkinKind(s) { return s.id === 'factory' ? 'Standard' : s.mastery ? 'Mastery' : s.ex ? 'Trophy' : uiSkinGroup(s).name; }

// The shelves, with a row of counters on top that also work as filters. Every skin is shown: the ones
// not owned yet keep their real look under a grey veil with a lock, and tapping one says how to get it.
//   o.all   the collection (every skin in its usual order) or the workbench (owned skins first)
//   o.gun   the rifle the skins are being chosen for, if any
//   o.cur   the skin to mark as chosen
//   o.peek  a locked skin being looked at
UI.skinShelves = function (o) {
  const d = Save.data, f = UI.skinFilter, seen = d.skinSeen || {};
  const fits = (s) => o.all || !o.gun || uiSkinFits(s, o.gun); // choosing for one rifle: only the mastery skins that rifle can wear
  const tiles = UI_SKIN_GROUPS.map((g) => {
    const all = SKINS.filter((s) => s.id !== 'factory' && g.has(s) && fits(s)), own = all.filter((s) => d.skins[s.id]).length;
    return `<button class="rtile ${g.cls} ${f === g.k ? 'on' : ''} ${own >= all.length ? 'full' : ''}" data-a="filter" data-k="${g.k}"><span>${g.name}</span><b>${own}<small>/${all.length}</small></b></button>`;
  }).join('');
  // each skin is shown on a rifle: the one it is being chosen for, or yours, or (mastery) its own
  const rifleFor = (s) => s.only || o.gun || d.equipped;
  const cell = (s) => {
    const g = uiSkinGroup(s), own = !!d.skins[s.id] || s.id === 'factory', on = o.cur === s.id ? 'on' : o.peek === s.id ? 'peek' : '';
    const sub = s.mastery ? GUN_BY_ID[s.only].name : s.ex ? 'Trophy' : g.name;
    if (!own) return `<button class="skcell ${g.cls} locked ${on}" data-a="skin" data-id="${s.id}"><span class="skpic"><canvas data-swatch="${s.id}" data-rifle data-lazy data-gun="${rifleFor(s)}"></canvas><span class="veil"></span><span class="lk">${ICON.lock}</span></span><b>${esc(s.name)}</b><i>${esc(sub)}  ·  locked</i></button>`;
    const fresh = s.id !== 'factory' && !seen[s.id];
    return `<button class="skcell ${g.cls} own ${on}" data-a="skin" data-id="${s.id}"><span class="skpic"><canvas data-swatch="${s.id}" data-rifle data-lazy data-gun="${rifleFor(s)}" ${fresh ? 'data-fresh' : ''}></canvas></span><b>${esc(s.name)}</b><i>${s.id === 'factory' ? 'Standard' : esc(sub)}</i>${fresh ? '<em class="new">New</em>' : ''}</button>`;
  };
  const shelves = UI_SKIN_GROUPS.filter((g) => !f || f === g.k).map((g) => {
    const all = SKINS.filter((s) => g.has(s) && (s.id !== 'factory' || !o.all) && fits(s)), mine = (s) => d.skins[s.id] || s.id === 'factory';
    const list = o.all ? all : all.filter(mine).concat(all.filter((s) => !mine(s)));
    const total = all.filter((s) => s.id !== 'factory').length, own = all.filter((s) => s.id !== 'factory' && d.skins[s.id]).length;
    if (!list.length) return '';
    return `<div class="rgroup ${g.cls}"><div class="rhead"><b>${g.name}</b><i>${own} of ${total}</i></div><div class="skgrid">${list.map(cell).join('')}</div></div>`;
  }).join('');
  return `<div class="rtiles">${tiles}</div><p class="dim rhint">${f ? 'Showing one kind. Tap it again to see them all.' : 'Tap a kind above to show only those.'}</p>${shelves}`;
};

// Choose a skin for one rifle. Tapping a skin you own fits it straight away; tapping a locked one shows it
// on the rifle under the veil and says how to get it.
UI.skinPicker = function (gunId) {
  const d = Save.data, g = GUN_BY_ID[gunId];
  let peek = null;
  const side = () => {
    const cfg = gunCfg(gunId), can = SKINS.filter((k) => k.id !== 'factory' && uiSkinFits(k, gunId)), n = can.filter((k) => d.skins[k.id]).length, done = '<div class="cta"><button class="btn pri wide" data-a="close" data-snd="back">Done</button></div>';
    if (peek) {
      const s = SKIN_BY_ID[peek], grp = uiSkinGroup(s);
      return `${uiLockedStage(gunId, cfg, s)}
        <div class="sk-info ${grp.cls}"><div class="eyebrow">${uiSkinKind(s)}  ·  locked${uiSkinMoves(s) ? '  ·  it moves' : ''}</div><h3>${esc(s.name)}</h3>
        <p class="dim">${esc(uiSkinHow(s))} Until then it cannot be fitted.</p>${uiSkinSetLine(s)}</div>${done}`;
    }
    const s = SKIN_BY_ID[cfg.skin || 'factory'] || SKINS[0], grp = uiSkinGroup(s);
    return `<div class="stage plate"><canvas data-gun="${gunId}" data-live="1" ${uiCfgAttr(cfg)}></canvas>${uiLookBtn(s.id)}</div>
      <div class="sk-info ${grp.cls}"><div class="eyebrow">${uiSkinKind(s)}${uiSkinMoves(s) ? '  ·  it moves' : ''}</div><h3>${esc(s.name)}</h3>
      <p class="dim">${s.mastery ? 'Earned by mastering this rifle, and only it can wear it.' : 'For looks only. This rifle can wear ' + can.length + ' skins and you own ' + n + '.'}</p>${uiSkinSetLine(s)}</div>${done}`;
  };
  UI.overlay(`<div class="sheet tall skins"><div class="sh-head"><div class="sh-t"><div class="eyebrow">${esc(g.name)}</div><h3>Skins</h3></div><button class="x" data-a="close">${ICON.cross}</button></div>
    <div class="sh-body split"><div class="side sk-side">${side()}</div><div class="main scroll">${UI.skinShelves({ all: false, gun: gunId, cur: gunCfg(gunId).skin || 'factory' })}</div></div></div>`, {
    close() { UI.closeOverlay(); UI.flushSeen(); UI.keepScroll(); UI.bench(gunId); },
    filter(ds) { UI.skinFilter = UI.skinFilter === ds.k ? null : ds.k; UI.skinPicker(gunId); },
    inspect(ds) { const sc = UI.over.querySelector('.main.scroll'), top = sc ? sc.scrollTop : 0; UI.inspectSkin(ds.id, gunId, () => { UI.skinPicker(gunId); const s2 = UI.over.querySelector('.main.scroll'); if (s2) s2.scrollTop = top; }); },
    skin(ds, t) {
      const own = !!d.skins[ds.id] || ds.id === 'factory';
      UI.over.querySelectorAll('.skcell.peek').forEach((e) => e.classList.remove('peek'));
      if (own) {
        const cfg = gunCfg(gunId); cfg.skin = ds.id; d.guns[gunId].cfg = cfg; Save.write(); Sfx.ui('equip'); peek = null;
        UI.over.querySelectorAll('.skcell.on').forEach((e) => e.classList.remove('on')); t.classList.add('on');
      } else { peek = ds.id; t.classList.add('peek'); }
      const box = UI.over.querySelector('.sk-side'); box.innerHTML = side(); UI.paintIn(box, 'over');
      if (!own && document.body.classList.contains('portrait')) box.scrollIntoView({ block: 'start', behavior: 'smooth' }); // upright, the rifle is above the shelves: bring it into view
    },
  });
};

// A skin up close, on the whole screen: the rifle large on a lit bed in the light of its kind, drifting
// slowly along its length. Drag to look along it; tap to go from the whole rifle to close up and back.
// back() is called when it closes (the screen it came from draws itself again).
UI.inspectSkin = function (skinId, gunId, back) {
  const d = Save.data, s = SKIN_BY_ID[skinId] || SKINS[0], gid = s.only || gunId, grp = uiSkinGroup(s), own = !!d.skins[s.id] || s.id === 'factory';
  const cfg = Object.assign({}, gunCfg(gid), { skin: s.id });
  UI.overlay(`<div class="inspect ${grp.cls} ${own ? 'own' : 'locked'}">
    <span class="ins-glow"></span><canvas class="ins-cv"></canvas>
    <div class="ins-top"><div class="ins-t"><div class="eyebrow">${uiSkinKind(s)}${own ? '' : '  ·  not yours yet'}${uiSkinMoves(s) ? '  ·  it moves' : ''}</div><h2>${esc(s.name)}</h2><i>${esc(GUN_BY_ID[gid].name)}</i></div><button class="x" data-a="close" aria-label="Close">${ICON.cross}</button></div>
    <div class="ins-foot"><div class="ins-how">${own ? '<p class="dim">Drag to look along it. Tap to go close.</p>' : '<p class="dim">' + esc(uiSkinHow(s)) + '</p>'}${uiSkinSetLine(s)}</div><button class="btn pri" data-a="close" data-snd="back">Done</button></div>
  </div>`, { close() { UI.closeOverlay(); if (back) back(); } }, 'tk');
  const root = UI.over.querySelector('.inspect'), cv = root.querySelector('.ins-cv');
  const Z = { z: 1, to: 1, u: 0.5, auto: true, idle: 0, t: 0, down: null };
  const span = (w) => w * 0.84 * Z.z - w * 0.84; // how far the rifle can slide when it is larger than the screen
  cv.addEventListener('pointerdown', (e) => { Z.down = { x: e.clientX, u: Z.u, moved: 0 }; Z.auto = false; try { cv.setPointerCapture(e.pointerId); } catch (er) { /* fine */ } });
  cv.addEventListener('pointermove', (e) => {
    if (!Z.down) return; const dx = e.clientX - Z.down.x, sp = span(cv.clientWidth);
    Z.down.moved = Math.max(Z.down.moved, Math.abs(dx)); if (sp > 1) Z.u = clamp(Z.down.u - dx / sp, 0, 1);
  });
  const up = () => { if (!Z.down) return; if (Z.down.moved < 8) Z.to = Z.to > 1.5 ? 1 : 2.6; Z.down = null; Z.idle = 0; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  UI.anim((dt) => {
    if (!root.isConnected) return false;
    Z.t += dt; Z.z += (Z.to - Z.z) * Math.min(1, dt * 7);
    if (!Z.down && !Z.auto) { Z.idle += dt; if (Z.idle > 3) Z.auto = true; }
    if (!Z.went && Z.t > 1.4) { Z.went = true; if (Z.auto) Z.to = 2.6; } // after a look at the whole rifle, it goes close by itself once
    if (Z.auto) Z.u += (0.5 + 0.48 * Math.sin(Z.t * 0.32) - Z.u) * Math.min(1, dt * 1.5);
    const c = UI.fitCanvas(cv); if (!c) return true;
    const L = c.w * 0.84 * Z.z, cx = c.w / 2 + (0.5 - Z.u) * span(c.w);
    drawGun(c.x, gid, cfg, cx, c.h * 0.5, L, c.h * 0.62 * Z.z, { time: UI.t });
    return true;
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
// Four pages under one tab: the skins, the caches (open and buy), the medal case, and the progress counters.
UI.collection = function () {
  const d = Save.data, t = Progress.totals(), nC = d.caches.length, sub = UI.colTab;
  const seg = `<div class="seg">${[['skins', 'Skins'], ['caches', 'Caches'], ['medals', 'Medals'], ['progress', 'Progress']].map((s) => `<button class="${sub === s[0] ? 'on' : ''}" data-a="sub" data-t="${s[0]}">${s[1]}${s[0] === 'caches' && nC ? '<em>' + nC + '</em>' : ''}</button>`).join('')}</div>`;
  let body;
  const h = {
    sub(ds) { UI.colTab = ds.t; UI.collection(); },
    open(ds) { UI.openCache(ds.t || null); },
    buycache(ds) {
      const err = Progress.buyCache(ds.t);
      if (err) { Sfx.ui('deny'); UI.toast(err, 'bad'); return; }
      Sfx.ui('buy'); UI.toast(CACHE_NAME[ds.t] + ' bought. Open it when you like.', 'good'); UI.keepScroll(); UI.collection();
    },
    buyshelf(ds) { UI.shelfBuy(ds); },
  };
  if (sub === 'caches') {
    const blurb = { field: 'Also earned for three-star runs and challenges.', sealed: 'Also earned for new ranks, chapters and ducks.', vault: 'Only sold here. Never holds a common skin.' };
    const cards = ['field', 'sealed', 'vault'].map((k) => {
      const have = d.caches.filter((c) => c === k).length, price = CACHE_PRICE[k], can = d.credits >= price, odds = CACHE_ODDS[k];
      return `<div class="ccard t-${k}">
        <div class="cc-h"><span class="cc-ic">${ICON.box}</span><span class="cc-t"><b>${CACHE_NAME[k]}</b><i>${blurb[k]}</i></span></div>
        <div class="odds">${odds.map((p, r) => `<div class="od r${r}"><span>${RAR[r]}</span><i><i style="width:${p}%"></i></i><b>${p}%</b></div>`).join('')}</div>
        <div class="cc-f">${have ? `<button class="btn pri" data-a="open" data-t="${k}" data-snd="riser">Open  ·  ${have}</button>` : ''}<button class="btn ${have ? 'ghost' : 'pri'} ${can ? '' : 'off'}" data-a="buycache" data-t="${k}" data-quiet="1">Buy  ·  ${fmtCr(price)} cr</button></div>
        <div class="cc-why ${can ? '' : 'no'}">${can ? (have ? 'You have ' + have + ' to open' : 'You have none of these') : 'Not enough credits: ' + fmtCr(price - d.credits) + ' short'}</div>
      </div>`;
    }).join('');
    body = `<div class="scroll caches">
      <div class="cachebox ${nC ? 'has' : ''}"><div class="cb-ic">${ICON.box}</div><div class="cb-t"><b>${nC ? nC + (nC === 1 ? ' cache' : ' caches') + ' to open' : 'No caches waiting'}</b><i>Each cache holds one rifle skin. Earn them by playing, or buy them here with the credits you earn in missions. There is no real money in this game.</i></div>${nC ? '<button class="btn pri" data-a="open" data-t="best" data-snd="riser">Open one</button>' : ''}</div>
      <div class="cgrid">${cards}</div>
      ${UI.shelfHtml ? UI.shelfHtml() : ''}
      <p class="fine">The percentages are the chance of each kind of skin. Within a kind you get one you do not own yet, for as long as there is one left. Once you own a whole kind, a cache may give you a skin from the next kind up or down instead, or a duplicate, which is traded in for credits straight away: ${DUPE_CR.map((c, r) => RAR[r].toLowerCase() + ' ' + fmtCr(c)).join(', ')}.</p>
    </div>`;
  } else if (sub === 'medals' && UI.medalsBody) {
    if (UI.medalSweep) UI.medalSweep(); // anything reached and not yet paid is paid as the case opens
    body = UI.medalsBody();
  } else if (sub === 'progress') {
    const tile = (n, max, label) => `<div class="ptile ${n >= max ? 'full' : ''}"><b>${n}<small>/${max}</small></b><span>${label}</span><i><i style="width:${Math.round((n / max) * 100)}%"></i></i></div>`;
    body = `<div class="scroll">
      <div class="ptiles">${tile(t.stars, t.starsMax, 'Stars')}${tile(t.ch, t.missions, 'Challenges')}${tile(t.ducks, t.missions, 'Rubber ducks')}${tile(t.guns, t.gunsMax, 'Rifles')}${tile(t.parts, t.partsMax, 'Parts')}${tile(t.skins, t.skinsMax, 'Skins')}</div>
      <div class="records"><div class="eyebrow">Records</div><div class="recs"><div><b>${d.stats.longest || 0} m</b><i>longest kill</i></div><div><b>${fmtCr(d.stats.shots)}</b><i>shots fired</i></div><div><b>${d.stats.heads}</b><i>headshots</i></div><div><b>${d.stats.wins}</b><i>contracts won</i></div><div><b>${d.stats.cachesOpened || 0}</b><i>caches opened</i></div></div></div>
      <div class="eyebrow sets-h">Skin sets  ·  own every skin in a set and it pays once</div>
      <div class="sets">${SKIN_SETS.map((S) => { const n = S.skins.filter((id) => d.skins[id]).length, done = d.sets && d.sets[S.id];
        return `<div class="set ${done ? 'done' : ''}"><div class="set-h"><b>${esc(S.name)}</b><i>${n} of ${S.skins.length}</i></div><div class="set-sw">${S.skins.map((id) => `<span class="${d.skins[id] ? 'have' : ''}" title="${esc(SKIN_BY_ID[id].name)}"><canvas data-swatch="${id}" data-lazy></canvas></span>`).join('')}</div><div class="set-rw">${done ? ICON.check + ' Paid: ' : 'Pays '}${fmtCr(S.cr)} cr and a ${esc(CACHE_NAME[S.cache].toLowerCase())}</div></div>`; }).join('')}</div>
      <p class="fine">Trophy skins: ${SKINS.filter((s) => s.ex && !s.mastery).map((s) => esc(s.name) + ' (' + esc(s.ex.toLowerCase()) + ')').join(', ')}. Mastery skins: three for every rifle (Engraved, Gilded and Master), earned by using that rifle, and only it can wear them.</p>
    </div>`;
  } else {
    const gunId = d.equipped, g = GUN_BY_ID[gunId];
    if (!UI.colSkin || !SKIN_BY_ID[UI.colSkin]) UI.colSkin = gunCfg(gunId).skin || 'factory';
    const side = () => {
      const s = SKIN_BY_ID[UI.colSkin] || SKINS[0], gid = s.only && d.guns[s.only] ? s.only : gunId, gg = GUN_BY_ID[gid]; // a mastery skin is shown on its own rifle
      const cfg = gunCfg(gid), own = !!d.skins[s.id] || s.id === 'factory', grp = uiSkinGroup(s), on = (cfg.skin || 'factory') === s.id;
      let act;
      if (own) act = on ? '<div class="inuse">' + ICON.check + ' On your ' + esc(gg.name) + ' now</div>' : '<button class="btn pri wide" data-a="fit" data-snd="equip">' + (gid === gunId ? 'Put it on my rifle' : 'Put it on my ' + esc(gg.name)) + '</button>';
      else act = s.ex ? '<div class="lockmsg">' + ICON.lock + ' ' + (s.mastery ? 'Mastery' : 'Trophy') + ': ' + esc(s.ex.charAt(0).toLowerCase() + s.ex.slice(1)) + '.</div>' : '<button class="btn ghost wide" data-a="sub" data-t="caches">See the caches</button>';
      const stage = own ? `<div class="stage plate"><canvas data-gun="${gid}" data-live="1" ${uiCfgAttr(Object.assign({}, cfg, { skin: s.id }))}></canvas>${uiLookBtn(s.id)}</div>` : uiLockedStage(gid, cfg, s);
      return `${stage}
        <div class="sk-info ${grp.cls}"><div class="eyebrow">${uiSkinKind(s)}${own ? '' : '  ·  locked'}${uiSkinMoves(s) ? '  ·  it moves' : ''}</div><h3>${esc(s.name)}</h3>
        <p class="dim">${own ? (s.mastery ? 'Earned by mastering the ' + esc(gg.name) + '. Only it can wear this.' : 'Shown on your ' + esc(gg.name) + '. Skins are for looks only and fit every rifle.') : esc(uiSkinHow(s))}</p>${uiSkinSetLine(s)}</div>
        <div class="cta">${act}</div>`;
    };
    h.inspect = (ds) => UI.inspectSkin(ds.id, gunId, () => UI.closeOverlay());
    h.filter = (ds) => { UI.skinFilter = UI.skinFilter === ds.k ? null : ds.k; UI.collection(); };
    h.skin = (ds, el2) => {
      UI.colSkin = ds.id; UI.root.querySelectorAll('.skcell.on').forEach((e) => e.classList.remove('on')); el2.classList.add('on');
      const box = UI.root.querySelector('.sk-side'); box.innerHTML = side(); UI.paintIn(box, 'root');
      if (document.body.classList.contains('portrait')) box.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };
    h.fit = () => {
      const s = SKIN_BY_ID[UI.colSkin], gid = s.only && d.guns[s.only] ? s.only : gunId;
      if (!uiSkinFits(s, gid)) return;
      const c = gunCfg(gid); c.skin = s.id; d.guns[gid].cfg = c; Save.write(); UI.toast(s.name + ' fitted to ' + GUN_BY_ID[gid].name + '.', 'good');
      const box = UI.root.querySelector('.sk-side'); box.innerHTML = side(); UI.paintIn(box, 'root');
    };
    body = `${nC ? `<button class="cachestrip" data-a="open" data-t="best" data-snd="riser">${ICON.box}<b>${nC} ${nC === 1 ? 'cache' : 'caches'} to open</b><span>Open</span></button>` : ''}
      <div class="split"><div class="side sk-side">${side()}</div><div class="main scroll">${UI.skinShelves({ all: true, gun: gunId, cur: UI.colSkin })}</div></div>`;
  }
  UI.render(UI.shell(seg, body, 'col-' + sub), UI.shellHandlers(h), 'is-collection');
};

// Open one cache: the one that has waited longest, or a given kind, or ('best') the best kind you
// have, so that a vault cache you have just bought is not stuck behind a pile of field caches.
//
// The case drops onto a lit table. Tap its two latches: light leaks out of the seam in the colour
// of what is inside, and it can step up a rarity (or two, for a legendary) before the lid lifts.
// Then the rifle rises out wearing the skin, with a sweep of light, and a stamp says NEW, or
// DUPLICATE with the credits it trades in for counting up. Legendary gets an extra beat. What is
// inside is decided (and saved) the moment the case is opened, so leaving early loses nothing.
UI.openCache = function (tier) {
  const d = Save.data, how = tier;
  if (tier === 'best') tier = ['vault', 'sealed', 'field'].find((k) => d.caches.indexOf(k) >= 0);
  if (tier) { const i = d.caches.indexOf(tier); if (i > 0) { d.caches.splice(i, 1); d.caches.unshift(tier); } }
  const res = Progress.openCache();
  if (!res) { UI.closeOverlay(); UI.collection(); return; }
  const s = res.skin, gunId = d.equipped, cfg = Object.assign({}, gunCfg(gunId), { skin: s.id }), kind = CACHE_NAME[res.tier] || 'Cache', left = d.caches.length;
  // the light that leaks out first: one rarity lower for anything rare or better (two for legendary), half the time for uncommon
  const steps = []; { let r0 = s.r >= 4 ? 2 : s.r >= 2 ? s.r - 1 : s.r === 1 && Math.random() < 0.5 ? 0 : s.r; while (r0 <= s.r) steps.push(r0++); }
  UI.overlay(`<div class="cacheopen r${s.r} t-${res.tier}">
    <div class="co-stage">
      <canvas class="co-case"></canvas>
      <button class="latch" data-a="latch" data-i="0" aria-label="Open the left latch"></button><button class="latch" data-a="latch" data-i="1" aria-label="Open the right latch"></button>
      <div class="co-rise"><span class="co-gun"><canvas data-gun="${gunId}" data-live="1" ${uiCfgAttr(cfg)}></canvas><span class="ub-sweep"></span></span></div>
      <div class="co-stamp ${res.dupe ? 'dupe' : 'new'}">${res.dupe ? 'Duplicate' : 'New'}</div>
      <div class="co-leg">Legendary</div><div class="co-flash"></div>
    </div>
    <div class="co-bar">
      <div class="co-info"><div class="co-rar">${RAR[s.r]}  ·  ${s.ex ? 'trophy' : 'from a ' + esc(kind.toLowerCase())}</div><h3>${esc(s.name)}</h3>
        <p>${res.dupe ? 'You already own this one. Traded in for <b class="co-cr" data-to="' + res.cr + '">0</b> credits.' : 'New skin. It fits every rifle you own' + (uiSkinMoves(s) ? ', and it moves.' : '.') + Progress.setOf(s.id).map((S) => ' ' + esc(S.name) + ' set: ' + S.skins.filter((id) => d.skins[id]).length + ' of ' + S.skins.length + '.').join('')}</p>
        ${(res.sets || []).map((S) => `<div class="co-set">${ICON.check}<b>Set complete: ${esc(S.name)}</b><i>+${fmtCr(S.cr)} cr and a ${esc(CACHE_NAME[S.cache].toLowerCase())}</i></div>`).join('')}</div>
      <div class="co-pre"><span class="co-hint">${esc(kind)}  ·  tap both latches</span><button class="btn ghost" data-a="skip">Skip</button></div>
      <div class="co-btns">${res.dupe ? '' : '<button class="btn ghost" data-a="fit" data-snd="equip">Put it on my rifle</button>'}${left ? '<button class="btn pri" data-a="next" data-snd="riser">' + (how && how !== 'best' && d.caches.indexOf(how) >= 0 ? 'Open another (' + d.caches.filter((c) => c === how).length + ')' : 'Open next (' + left + ')') + '</button>' : ''}${left > 1 ? '<button class="btn ghost" data-a="all" data-snd="riser">Open all</button>' : ''}<button class="btn ${left ? 'ghost' : 'pri'}" data-a="done">Done</button></div>
    </div></div>`, {
    latch(ds) { latch(+ds.i); },
    skip() { reveal(true); },
    fit(ds, b) { const c = gunCfg(gunId); c.skin = s.id; d.guns[gunId].cfg = c; Save.write(); UI.toast(s.name + ' fitted to ' + GUN_BY_ID[gunId].name + '.', 'good'); if (b) b.classList.add('off'); },
    // the next one of the same kind you chose, while you have any (then the best one left)
    next() { UI.openCache(how && how !== 'best' && d.caches.indexOf(how) >= 0 ? how : 'best'); },
    all() { UI.openAll([res]); },
    done() { UI.closeOverlay(); if (UI.medalSweep) UI.medalSweep(); if (UI.afterCache) { const f = UI.afterCache; UI.afterCache = null; f(); } else UI.collection(); },
  }, 'center tk');
  const root = UI.over.querySelector('.cacheopen'), cv = root.querySelector('.co-case');
  root.style.setProperty('--sc', CB.RAR_GLOW[steps[0]]);
  // the state the case is drawn from, moved along by the loop below
  const C = { t: 0, lift: 0, latch: [0, 0], want: [0, 0], glow: 0, glowTo: 0, rar: steps[0], open: 0, opening: false, stage: 'drop', done: false };
  cv._state = C;
  const place = () => { // the latch buttons sit over the latches as drawn
    const w = cv.clientWidth, h = cv.clientHeight, L = CB.caseLatches(w, h), btns = root.querySelectorAll('.latch');
    L.forEach((p, i) => { btns[i].style.left = (cv.offsetLeft + p.x - 30) + 'px'; btns[i].style.top = (cv.offsetTop + p.y - 30) + 'px'; });
  };
  place();
  const draw = () => {
    const c = UI.fitCanvas(cv); if (!c) return;
    CB.drawCase(c.x, res.tier, c.w, c.h, { t: C.t, lift: C.lift, latch: C.latch, glow: C.glow, rar: C.rar, open: C.open, hint: C.stage === 'latch' });
  };
  function latch(i) {
    if (C.stage !== 'latch' || C.want[i]) return;
    C.want[i] = 1; Sfx.ui('equip');
    const n = C.want[0] + C.want[1];
    C.glowTo = n === 1 ? 0.4 : 0.85;
    root.querySelectorAll('.latch')[i].classList.add('off');
    if (n === 2) { C.stage = 'leak'; C.stepAt = C.t + 0.45; C.si = 0; root.querySelector('.co-hint').textContent = 'Something is in there'; }
  }
  // the lid lifts, the rifle rises, the stamp lands; quick=true for Skip
  function reveal(quick) {
    if (C.done) return; C.done = true;
    C.rar = s.r; C.glow = 1; C.latch = [1, 1]; C.want = [1, 1]; C.lift = 1; C.opening = true; if (quick) C.open = 1;
    root.style.removeProperty('--sc'); root.classList.add('open'); if (s.r >= 4) root.classList.add('legend');
    Sfx.rarity(s.r);
    const after = () => {
      if (!root.isConnected) return;
      root.classList.add('shown'); UI.paintIn(root.querySelector('.co-rise'), 'over');
      const cr = root.querySelector('.co-cr');
      if (cr) { const to = +cr.dataset.to; let k = 0; UI.anim((dt) => { if (!cr.isConnected) return false; k = Math.min(1, k + dt / 0.8); cr.textContent = fmtCr(to * easeOut(k)); return k < 1; }); }
    };
    if (quick) after(); else setTimeout(after, s.r >= 4 ? 900 : 380);
  }
  UI.anim((dt) => {
    if (!cv.isConnected) return false;
    C.t += dt;
    if (C.stage === 'drop') { C.lift = Math.min(1, C.lift + dt / 0.45); if (C.lift >= 1) { C.stage = 'latch'; Sfx.ui('go'); root.classList.add('ready'); } }
    for (let i = 0; i < 2; i++) C.latch[i] = approach(C.latch[i], C.want[i], dt / 0.14);
    C.glow = approach(C.glow, C.glowTo, dt * 1.6);
    if (C.stage === 'leak' && C.t >= C.stepAt) {
      // step the colour up towards what is really inside, one rarity at a time, then open
      if (C.si < steps.length - 1) { C.si++; C.rar = steps[C.si]; C.glow = 1.35; C.glowTo = 1; C.stepAt = C.t + 0.5; Sfx.ui('star'); root.style.setProperty('--sc', CB.RAR_GLOW[C.rar]); root.classList.remove('stepped'); void root.offsetWidth; root.classList.add('stepped'); }
      else { C.stage = 'open'; reveal(false); }
    }
    if (C.opening) C.open = Math.min(1, C.open + dt / 0.45);
    draw();
    return true;
  });
  draw();
};
// Open every cache that is left, and lay out what came out of them all.
UI.openAll = function (first) {
  const d = Save.data, got = (first || []).slice();
  let r; while ((r = Progress.openCache())) got.push(r);
  const gunId = d.equipped, nNew = got.filter((x) => !x.dupe).length, cr = got.reduce((a, x) => a + (x.cr || 0), 0);
  got.sort((a, b) => b.skin.r - a.skin.r);
  Sfx.rarity(got.length ? got[0].skin.r : 0);
  UI.overlay(`<div class="sheet tall openall"><div class="sh-head"><div class="sh-t"><div class="eyebrow">${got.length} caches opened</div><h3>${nNew} new ${nNew === 1 ? 'skin' : 'skins'}${cr ? '  ·  +' + fmtCr(cr) + ' credits' : ''}</h3></div><button class="x" data-a="done">${ICON.cross}</button></div>
    <div class="sh-body">${got.reduce((a, x) => a.concat(x.sets || []), []).map((S) => `<div class="co-set">${ICON.check}<b>Set complete: ${esc(S.name)}</b><i>+${fmtCr(S.cr)} cr and a ${esc(CACHE_NAME[S.cache].toLowerCase())}</i></div>`).join('')}<div class="oagrid">${got.map((x, i) => `<div class="oa r${x.skin.r} ${x.dupe ? 'dupe' : 'new'}" style="animation-delay:${Math.min(i, 20) * 0.06}s"><span class="oa-pic bed"><canvas data-gun="${gunId}" data-lazy ${uiCfgAttr(Object.assign({}, gunCfg(gunId), { skin: x.skin.id }))}></canvas></span><b>${esc(x.skin.name)}</b><i>${RAR[x.skin.r]}</i><em>${x.dupe ? '+' + fmtCr(x.cr) + ' cr' : 'New'}</em></div>`).join('')}</div>
    <div class="cta"><button class="btn pri" data-a="done">Done</button></div></div></div>`, {
    done() { UI.closeOverlay(); if (UI.medalSweep) UI.medalSweep(); if (UI.afterCache) { const f = UI.afterCache; UI.afterCache = null; f(); } else UI.collection(); },
  });
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
  // two pages: free practice, and the scored drills (53_drills.js)
  const nMed = UI.drillsHtml ? (CB.DRILLS || []).reduce((a, D) => a + (((d.drills || {})[D.id] || {}).medal || 0), 0) : 0;
  const seg = UI.drillsHtml ? `<div class="seg">${[['free', 'Free practice'], ['drills', 'Drills']].map((s) => `<button class="${(UI.rangeTab || 'free') === s[0] ? 'on' : ''}" data-a="rsub" data-t="${s[0]}">${s[1]}${s[0] === 'drills' ? '<em class="dm">' + nMed + '/12</em>' : ''}</button>`).join('')}</div>` : '<div class="hd"><div class="eyebrow">Practice</div><h2>The Range</h2></div>';
  if (UI.rangeTab === 'drills' && UI.drillsHtml) {
    UI.render(UI.shell(seg, `<div class="scroll">${UI.drillsHtml()}</div>`), UI.shellHandlers({ rsub(ds) { UI.rangeTab = ds.t; UI.range(); }, drill(ds) { UI.startDrill(ds.id); } }), 'is-range');
    return;
  }
  UI.render(UI.shell(seg, `<div class="split rangev">
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
    rsub(ds) { UI.rangeTab = ds.t; UI.range(); },
    go() { MISSION_BY_ID.range = rangeMission(R.dist, R.wind); UI.launch('range', {}); },
  }), 'is-range');
};
