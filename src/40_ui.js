// ---------------------------------------------------------------------------
// Menus, part 1: the shell, title, story cards, contracts list and briefing.
// ---------------------------------------------------------------------------
const UI = CB.UI = { root: null, over: null, tab: 'contracts', chapter: 1, live: [], handlers: {}, oHandlers: {}, attract: null, pick: {} };

const ICON = {
  target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6" stroke="currentColor" stroke-width="1.8"/></svg>',
  rifle: '<svg viewBox="0 0 24 24"><path d="M2 14l6-1 1-2h9l4-1v2l-4 1h-5l-1 2-3 .5L8 19H5l1-4-4 1z" fill="currentColor"/><rect x="9" y="7.5" width="7" height="2" rx="1" fill="currentColor"/></svg>',
  gem: '<svg viewBox="0 0 24 24"><path d="M6 4h12l4 6-10 11L2 10z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M2 10h20M9 4l-2 6 5 11 5-11-2-6" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
  flag: '<svg viewBox="0 0 24 24"><path d="M5 21V3M5 4h12l-3 4 3 4H5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 10.5V7.5a4 4 0 018 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.7-6-3.3-6 3.3 1.3-6.7-5-4.7 6.8-.8z" fill="currentColor"/></svg>',
  medal: '<svg viewBox="0 0 24 24"><path d="M8 2h8l-2 7h-4z" fill="currentColor" opacity=".6"/><circle cx="12" cy="15" r="6" fill="currentColor"/></svg>',
  duck: '<svg viewBox="0 0 24 24"><path d="M4 15c0-3 3-4 6-4 0-3 1.5-5 4-5s4 2 4 4h3l-2 2c0 1-1 2-2 2 1 4-2 6-6 6S4 18 4 15z" fill="currentColor"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cross: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  box: '<svg viewBox="0 0 24 24"><path d="M3 8l9-5 9 5v9l-9 5-9-5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M3 8l9 5 9-5M12 13v9" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  wind: '<svg viewBox="0 0 24 24"><path d="M3 9h11a3 3 0 10-3-3M3 14h15a3 3 0 11-3 3M3 19h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};
const fmtCr = (n) => Math.round(n).toLocaleString('en-US');
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
function starsHtml(n, cls) { let s = '<span class="stars ' + (cls || '') + '">'; for (let i = 0; i < 3; i++) s += '<i class="' + (i < n ? 'on' : '') + '">' + ICON.star + '</i>'; return s + '</span>'; }
function timeLabel(S) { const t = { day: 'Day', dawn: 'Dawn', dusk: 'Dusk', night: 'Night', overcast: 'Overcast', snow: 'Snow light' }[S.time] || S.time; const w = { clear: '', rain: ', rain', storm: ', storm', snow: ', snowing', fog: ', fog' }[S.weather] || ''; return t + w; }

UI.boot = function () {
  UI.root = document.getElementById('ui'); UI.over = document.getElementById('overlay');
  const click = (map) => (e) => {
    const t = e.target.closest('[data-a]'); if (!t || t.classList.contains('off')) return;
    Sfx.unlock(); if (Sfx.mode === 'off' && Game.state !== 'mission') Sfx.menu();
    const fn = map()[t.dataset.a]; if (fn) { if (!t.dataset.quiet) Sfx.ui(t.dataset.snd || 'tap'); fn(t.dataset, t, e); }
  };
  UI.root.addEventListener('click', click(() => UI.handlers));
  UI.over.addEventListener('click', click(() => UI.oHandlers));
  UI.title();
};
// Put a screen up. `h` maps data-a names to functions.
UI.render = function (html, h, cls) {
  UI.live = [];
  UI.root.className = 'ui ' + (cls || '');
  UI.root.innerHTML = html; UI.handlers = h || {};
  UI.paintGuns(UI.root);
  const sc = UI.root.querySelector('.scroll'); if (sc && UI._keepScroll) { sc.scrollTop = UI._keepScroll; } UI._keepScroll = 0;
};
UI.keepScroll = function () { const sc = UI.root.querySelector('.scroll'); UI._keepScroll = sc ? sc.scrollTop : 0; };
UI.overlay = function (html, h, cls) { UI.over.className = 'overlay show ' + (cls || ''); UI.over.innerHTML = html; UI.oHandlers = h || {}; UI.paintGuns(UI.over); };
UI.closeOverlay = function () { UI.over.className = 'overlay'; UI.over.innerHTML = ''; UI.oHandlers = {}; UI.live = UI.live.filter((l) => document.body.contains(l.cv)); };
UI.toast = function (text, cls) {
  const t = document.getElementById('toast'); const e = el('div', 'toast ' + (cls || ''), text); t.appendChild(e);
  setTimeout(() => e.classList.add('out'), 2200); setTimeout(() => { if (e.parentNode) e.parentNode.removeChild(e); }, 2700);
};

// Draw every <canvas data-gun="id"> inside a container.
UI.paintGuns = function (root) {
  root.querySelectorAll('canvas[data-gun]').forEach((cv) => {
    const id = cv.dataset.gun, cfg = cv.dataset.cfg ? JSON.parse(cv.dataset.cfg) : gunCfg(id);
    UI.paintGun(cv, id, cfg);
    const sk = SKIN_BY_ID[cfg.skin || 'factory'];
    if (cv.dataset.live && ((sk && (sk.shimmer || (sk.furn && sk.furn.anim))) || id === 'stormglass')) UI.live.push({ cv, id, cfg });
  });
  root.querySelectorAll('canvas[data-swatch]').forEach((cv) => {
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth || 60, h = cv.clientHeight || 30;
    cv.width = w * dpr; cv.height = h * dpr; const x = cv.getContext('2d'); x.scale(dpr, dpr);
    drawSwatch(x, SKIN_BY_ID[cv.dataset.swatch], 0, 0, w, h, 1.3);
  });
};
UI.paintGun = function (cv, id, cfg, time) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth || 300, h = cv.clientHeight || 90;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
  drawGun(x, id, cfg, w / 2, h / 2, w - 8, h - 6, { time: time === undefined ? 1.3 : time });
};

// Called every frame while no mission is running.
UI.tick = function (dt) {
  UI.t = (UI.t || 0) + dt;
  if (UI.live.length) { UI._lt = (UI._lt || 0) + dt; if (UI._lt > 0.045) { UI._lt = 0; UI.live.forEach((l) => { if (document.body.contains(l.cv)) UI.paintGun(l.cv, l.id, l.cfg, UI.t); }); } }
  if (UI.attract) UI.attractStep(dt);
  if (Sfx.ok && Sfx.mode !== 'off') Sfx.pump();
  if (UI.onTick) UI.onTick(dt);
};

// ---- the scope drifting over a night street behind the title ---------------------------
UI.attractStart = function () {
  try {
    const M = MISSION_BY_ID.c1m3, st = buildStats('halden');
    const sim = new Sim(M, st, 0, { flags: {}, shotSeed: 1 });
    sim.triggers = sim.triggers.filter((t) => t.every); sim.rules = { kill: [], destroy: [], protect: [], until: 'never' };
    UI.attract = { sim, t: 0, tx: 0, ty: 0 };
    document.body.classList.add('attract');
    Game.view.layout(Game.W, Game.H, Game.view.dpr, 'attract'); Game.view.noReticle = false; Game.view.fx = []; Game.view.assist = 'veteran'; Game.view.hold = null; Game.view.rangeInfo = null;
    sim.sh.zoom = sim.sh.zoomT = 5;
  } catch (e) { UI.attract = null; }
};
UI.attractStop = function () { if (!UI.attract) return; UI.attract = null; document.body.classList.remove('attract'); Game.resize(); };
UI.attractStep = function (dt) {
  const A = UI.attract, sim = A.sim; A.t += dt;
  if (Game.view.mode !== 'attract') Game.view.layout(Game.W, Game.H, Game.view.dpr, 'attract');
  sim.step(Math.min(dt, 0.05)); sim.ev.length = 0;
  // wander: follow somebody for a while, then drift to somebody else
  if (!A.who || A.t > A.until || A.who.gone || A.who.hidden) { const c = sim.actors.filter((a) => !a.gone && !a.hidden && !a.dead); A.who = c[Math.floor(Math.random() * c.length)]; A.until = A.t + 5 + Math.random() * 5; }
  if (A.who) { const e = sim.eye0, d = A.who.plane.z - e.z; A.tx = ((A.who.x - e.x) / d) * 1000; A.ty = ((A.who.y + 1.2 - e.y) / d) * 1000; }
  sim.sh.ax += (A.tx - sim.sh.ax) * Math.min(1, dt * 0.7); sim.sh.ay += (A.ty - sim.sh.ay) * Math.min(1, dt * 0.7);
  Game.view.draw(sim, dt, dt);
};

// ---- title -------------------------------------------------------------------------------
UI.title = function () {
  const has = Object.keys(Save.data.missions).length > 0 || Save.data.seen.prologue;
  if (!UI.attract) UI.attractStart();
  UI.render(`
    <div class="scr title">
      <div class="t-shade"></div>
      <div class="t-mid">
        <div class="eyebrow">A long-range story in six chapters</div>
        <h1 class="logo">COLD<span class="ret"></span>BORE</h1>
        <p class="t-tag">The first shot from a cold barrel.<br>The one you do not get back.</p>
      </div>
      <div class="t-bot">
        <button class="btn pri big" data-a="play" data-snd="go">${has ? 'Continue' : 'Begin'}</button>
        <div class="t-links"><a data-a="how">How to play</a><a data-a="settings">Settings</a></div>
        <div class="t-note">No ads. Nothing to buy. Everything is earned by playing.<br>Progress saves on this device${Save.ok ? '' : ' (this browser is blocking saves)'}.</div>
      </div>
    </div>`, {
    play() { UI.attractStop(); if (!Save.data.seen.prologue) UI.prologue(); else UI.hub(); },
    how() { UI.howTo(); },
    settings() { UI.settings(true); },
  }, 'is-title');
};

UI.cards = function (cards, done, kicker) {
  let i = 0;
  const show = () => {
    const c = cards[i];
    UI.render(`<div class="scr story" data-a="next" data-quiet="1">
      <div class="st-in"><div class="eyebrow">${esc(kicker || '')}</div>${c.h ? '<h2>' + esc(c.h) + '</h2>' : ''}<p>${esc(c.p)}</p></div>
      <div class="st-foot"><span>${i + 1} / ${cards.length}</span><span class="tap">Tap to continue</span></div></div>`, {
      next() { Sfx.ui('page'); i++; if (i >= cards.length) done(); else show(); },
    }, 'is-story');
  };
  show();
};
UI.prologue = function () { UI.cards(PROLOGUE, () => { Save.data.seen.prologue = 1; Save.write(); UI.chapter = 1; UI.chapterIntro(1, () => UI.hub()); }, 'Cold Bore'); };
UI.chapterIntro = function (n, done) {
  const c = CHAPTER_BY_N[n];
  const cards = c.intro.map((p, i) => ({ h: i === 0 ? c.title : '', p }));
  Save.data.seen['ch' + n] = 1; Save.write();
  UI.cards(cards, done, 'Chapter ' + ROMAN[n] + '  ·  ' + c.place);
};

// ---- hub shell -----------------------------------------------------------------------------
UI.shell = function (body, cls) {
  const d = Save.data, r = rankOf(d.xp), nx = nextRank(d.xp);
  const pct = nx ? ((d.xp - r.xp) / (nx.xp - r.xp)) * 100 : 100;
  const tab = (id, icon, label, badge) => `<button class="tabb ${UI.tab === id ? 'on' : ''}" data-a="tab" data-tab="${id}">${ICON[icon]}<span>${label}</span>${badge ? '<em>' + badge + '</em>' : ''}</button>`;
  return `<div class="scr hub ${cls || ''}">
    <div class="top">
      <div class="rank" data-a="rankinfo"><b>${r.n}</b><div><span>${esc(r.name)}</span><i class="xp"><i style="width:${pct.toFixed(0)}%"></i></i></div></div>
      <div class="cr"><b>${fmtCr(d.credits)}</b><small>credits</small></div>
    </div>
    ${body}
    <nav class="tabs">
      ${tab('contracts', 'target', 'Contracts')}${tab('armory', 'rifle', 'Armory')}${tab('collection', 'gem', 'Collection', d.caches.length || '')}${tab('range', 'flag', 'Range')}${tab('settings', 'gear', 'Settings')}
    </nav></div>`;
};
UI.shellHandlers = function (h) {
  return Object.assign({
    tab(ds) { UI.tab = ds.tab; UI.hub(); },
    rankinfo() { UI.rankInfo(); },
  }, h || {});
};
UI.hub = function () {
  UI.attractStop(); Sfx.menu();
  if (UI.tab === 'armory') return UI.armory();
  if (UI.tab === 'collection') return UI.collection();
  if (UI.tab === 'range') return UI.range();
  if (UI.tab === 'settings') return UI.settings(false);
  return UI.contracts();
};
UI.rankInfo = function () {
  const d = Save.data, r = rankOf(d.xp), nx = nextRank(d.xp);
  UI.overlay(`<div class="sheet"><div class="sh-head"><h3>Rank</h3><button class="x" data-a="close">${ICON.cross}</button></div>
    <div class="sh-body"><p class="dim">Experience comes from finishing contracts, earning stars and completing challenges. Higher ranks unlock rifles and parts in the armory. Each new rank also brings a sealed cache.</p>
    <div class="ranks">${RANKS.map((k) => `<div class="rk ${k.n === r.n ? 'cur' : k.n < r.n ? 'had' : ''}"><b>${k.n}</b><span>${esc(k.name)}</span><i>${fmtCr(k.xp)} xp</i></div>`).join('')}</div>
    <p class="dim">You have ${fmtCr(d.xp)} xp${nx ? ', ' + fmtCr(nx.xp - d.xp) + ' to go until ' + esc(nx.name) : ''}.</p></div></div>`, { close() { UI.closeOverlay(); } });
};

// ---- contracts -------------------------------------------------------------------------------
UI.contracts = function () {
  const d = Save.data;
  // open on the furthest chapter reached the first time
  if (!UI._chSet) { UI._chSet = true; for (let n = 6; n >= 1; n--) if (Progress.chapterOpen(n)) { UI.chapter = n; break; } }
  const n = UI.chapter, c = CHAPTER_BY_N[n], list = MISSIONS.filter((m) => m.ch === n), open = Progress.chapterOpen(n);
  if (open && !d.seen['ch' + n]) return UI.chapterIntro(n, () => UI.contracts());
  const st = list.reduce((s, m) => s + ((d.missions[m.id] && d.missions[m.id].stars) || 0), 0);
  const chips = CHAPTERS.map((k) => { const o = Progress.chapterOpen(k.n); return `<button class="chip ${k.n === n ? 'on' : ''} ${o ? '' : 'locked'}" data-a="chap" data-n="${k.n}"><b>${ROMAN[k.n]}</b>${o ? esc(k.title) : ICON.lock}</button>`; }).join('');
  const rows = open ? list.map((m, i) => {
    const rec = d.missions[m.id] || { stars: 0 }, ok = Progress.missionOpen(m);
    return `<button class="mrow ${ok ? '' : 'locked'} ${rec.done ? 'done' : ''}" data-a="mission" data-id="${m.id}" ${ok ? '' : 'data-snd="deny"'}>
      <span class="num">${i + 1}</span>
      <span class="mt"><b>${ok ? esc(m.title) : 'Locked'}</b><i>${ok ? m.range + ' m' + (m.outcomes && m.outcomes.some((o) => o.set) ? '  ·  a choice' : '') : 'Finish the contract before it'}</i></span>
      <span class="mmeta">${ok ? starsHtml(rec.stars || 0) : ICON.lock}<span class="tags"><i class="medal ${rec.ch ? 'on' : ''}" title="Challenge">${ICON.medal}</i><i class="duck ${d.ducks[m.id] ? 'on' : ''}" title="Rubber duck">${ICON.duck}</i></span></span>
    </button>`;
  }).join('') : `<div class="empty">${ICON.lock}<p>Finish chapter ${ROMAN[n - 1]} to open this one.</p></div>`;
  UI.render(UI.shell(`
    <div class="chips">${chips}</div>
    <div class="scroll">
      <div class="chhead"><div class="eyebrow">Chapter ${ROMAN[n]}  ·  ${esc(c.place)}</div><h2>${esc(c.title)}</h2>
        <div class="chmeta"><span>${starsHtml(0, 'one on')} ${st} / ${list.length * 3}</span>${open ? '<a data-a="story">Read the chapter opening</a>' : ''}</div></div>
      <div class="mlist">${rows}</div>
      ${open && Progress.chapterDone(n) && c.outro ? '<div class="outro"><div class="eyebrow">Afterwards</div><p>' + esc(c.outro) + '</p></div>' : ''}
      ${d.seen.ending && n === 6 ? '<button class="btn ghost wide" data-a="epi">Read the ending again</button>' : ''}
    </div>`), UI.shellHandlers({
    chap(ds) { UI.chapter = +ds.n; UI.contracts(); },
    story() { UI.chapterIntro(n, () => UI.contracts()); },
    epi() { UI.epilogue(() => UI.contracts()); },
    mission(ds) { const M = MISSION_BY_ID[ds.id]; if (!Progress.missionOpen(M)) { UI.toast('Finish the contract before it first.'); return; } UI.brief(M); },
  }));
};

// ---- briefing --------------------------------------------------------------------------------
UI.thumb = function (cv, M, vi) {
  try {
    const st = buildStats('halden');
    const sim = new Sim(M, st, vi || 0, { flags: Save.data.flags, shotSeed: 1 });
    for (let i = 0; i < 45; i++) sim.step(1 / 30);
    const V = new View(cv), w = cv.clientWidth || 360, h = cv.clientHeight || 150, dpr = Math.min(2, window.devicePixelRatio || 1);
    V.layout(w, h, dpr, 'plain');
    const b = sim.S.bounds, zr = sim.S.refZ - sim.eye0.z, spanMil = ((b.x1 - b.x0) / zr) * 1000;
    sim.sh.zoom = sim.sh.zoomT = clamp((FOV_AT_1X / (spanMil * 0.5)) * ((V.R * 2) / w), 1.5, 14);
    sim.sh.swx = sim.sh.swy = 0;
    V.draw(sim, 0.016, 0);
    return sim;
  } catch (e) { return null; /* a thumbnail is a nicety, never a blocker */ }
};
UI.brief = function (M, keep) {
  const d = Save.data, flags = d.flags, rec = d.missions[M.id] || { stars: 0 };
  if (!keep) UI.pick = { v: 0 };
  const P = UI.pick, V = M.vantages || [{ name: 'Position', desc: '' }];
  const gunId = d.equipped, cfg = gunCfg(gunId), st = buildStats(gunId, cfg), why = gunAllowed(M, st), g = GUN_BY_ID[gunId];
  const intel = missionText(M, 'intel') || [], who = speakerOf(M);
  const wind = M.wind || { v: 0 }, aw = Math.abs(wind.v || 0) * (V[P.v].windMul === undefined ? 1 : V[P.v].windMul);
  const eye = V[P.v].eye, tmpRange = Math.round(Math.hypot((M.setupRefZ || 0), 0)) || M.range;
  const par = (typeof M.par === 'function' ? M.par(flags) : M.par) || 1;
  const choice = M.outcomes && M.outcomes.some((o) => o.set);
  UI.render(`<div class="scr brief">
    <div class="bar"><button class="ib" data-a="back" data-snd="back">${ICON.back}</button><div><div class="eyebrow">Chapter ${ROMAN[M.ch]}  ·  Contract ${MISSIONS.filter((m) => m.ch === M.ch).indexOf(M) + 1}</div><h2>${esc(M.title)}</h2></div>${starsHtml(rec.stars || 0)}</div>
    <div class="scroll">
      <div class="thumb"><canvas id="thumb"></canvas><div class="th-cap"><span id="thtime"></span><span>${ICON.wind} ${aw < 0.3 ? 'Calm' : fmt(aw, 1) + ' m/s from ' + ((wind.v || 0) > 0 ? 'left' : 'right')}</span></div></div>
      <div class="say"><b>${esc(who)}</b><p>${esc(missionText(M, 'brief'))}</p></div>
      <div class="obj"><div class="eyebrow">Objective</div><p>${esc(missionText(M, 'objective'))}</p>${choice ? '<div class="choice">There is a decision to make on this one. It changes what comes later.</div>' : ''}</div>
      <div class="intel"><div class="eyebrow">What we know</div><ul>${intel.map((t) => '<li>' + esc(t) + '</li>').join('')}</ul></div>
      ${V.length > 1 ? `<div class="vant"><div class="eyebrow">Where to set up</div>${V.map((v, i) => `<button class="vcard ${i === P.v ? 'on' : ''}" data-a="vant" data-i="${i}"><b>${esc(v.name)}</b>${v.tag ? '<em>' + esc(v.tag) + '</em>' : ''}<span>${esc(v.desc || '')}</span></button>`).join('')}</div>` : `<div class="vant one"><div class="eyebrow">Position</div><p><b>${esc(V[0].name)}.</b> ${esc(V[0].desc || '')}</p></div>`}
      <div class="load"><div class="eyebrow">Your rifle</div>
        <button class="gcard ${why ? 'bad' : ''}" data-a="gun"><canvas data-gun="${gunId}"></canvas><div class="gc-t"><b>${esc(g.name)}</b><i>${esc(g.calName)}  ·  ${esc(st.scope.name)}${st.silent ? '  ·  silent' : st.quiet ? '  ·  suppressed' : '  ·  loud'}</i></div><span class="chg">Change</span></button>
        ${why ? '<div class="warn">' + ICON.cross + '<span>' + esc(why) + ' Pick another rifle or fit different parts.</span></div>' : (!st.quiet ? '<div class="note">This rifle is loud. Everyone in earshot will hear the shot unless something louder covers it.</div>' : '')}
      </div>
      <div class="goals"><div class="eyebrow">Rating</div>
        <div class="goal">${starsHtml(1, 'one on')}<span>Complete the contract</span></div>
        <div class="goal">${starsHtml(1, 'one on')}<span>Clean: no alarm, nobody sees it happen</span></div>
        <div class="goal">${starsHtml(1, 'one on')}<span>Precise: ${par === 1 ? 'one shot' : 'no more than ' + par + ' shots'}</span></div>
        <div class="goal ch ${rec.ch ? 'got' : ''}"><i>${ICON.medal}</i><span>Challenge: ${esc(M.challenge.text)}</span></div>
        <div class="goal ch ${d.ducks[M.id] ? 'got' : ''}"><i>${ICON.duck}</i><span>A rubber duck is hidden somewhere in the scene</span></div>
        <div class="pay">Pays <b>${fmtCr(M.reward.cr)}</b> credits and <b>${M.reward.xp}</b> xp the first time, more for stars and the challenge.</div>
      </div>
      <div class="pad"></div>
    </div>
    <div class="cta"><button class="btn pri big ${why ? 'off' : ''}" data-a="go" data-snd="go">${why ? 'Rifle not suitable' : 'Take the shot'}</button></div>
  </div>`, {
    back() { UI.hub(); },
    vant(ds) { P.v = +ds.i; UI.keepScroll(); UI.brief(M, true); },
    gun() { UI.gunPicker(M); },
    go() { UI.launch(M.id, { vantage: P.v }); },
  }, 'is-brief');
  const cv = document.getElementById('thumb');
  setTimeout(() => { if (!document.body.contains(cv)) return; const sm = UI.thumb(cv, M, P.v), lab = document.getElementById('thtime'); if (sm && lab) lab.textContent = timeLabel(sm.S) + '  ·  ' + Math.round(sm.S.refZ - (eye[2] || 0)) + ' m'; }, 30);
};
UI.launch = function (id, opts) {
  UI.attractStop(); UI.closeOverlay();
  Game.start(id, opts);
  // on a computer, grab the mouse straight away so the first click fires rather than aims
  if (!Game.touch) { Game.mouseAim = true; if (Game.stage.requestPointerLock) { try { Game.stage.requestPointerLock(); } catch (e) { /* fine */ } } }
};

// Choose which owned rifle to take.
UI.gunPicker = function (M) {
  const d = Save.data;
  const rows = GUNS.filter((g) => d.guns[g.id]).map((g) => {
    const st = buildStats(g.id, gunCfg(g.id)), why = M ? gunAllowed(M, st) : null;
    return `<button class="grow ${why ? 'bad' : ''} ${d.equipped === g.id ? 'on' : ''}" data-a="take" data-id="${g.id}"><canvas data-gun="${g.id}"></canvas><div><b>${esc(g.name)}</b><i>${why ? esc(why) : esc(g.calName) + '  ·  reach ' + st.eff + ' m  ·  ' + (st.silent ? 'silent' : st.quiet ? 'suppressed' : 'loud')}</i></div></button>`;
  }).join('');
  UI.overlay(`<div class="sheet"><div class="sh-head"><h3>Choose a rifle</h3><button class="x" data-a="close">${ICON.cross}</button></div>
    <div class="sh-body">${rows}<button class="btn ghost wide" data-a="bench">Open the workbench</button></div></div>`, {
    close() { UI.closeOverlay(); },
    take(ds) { d.equipped = ds.id; Save.write(); Sfx.ui('equip'); UI.closeOverlay(); if (M) { UI.keepScroll(); UI.brief(M, true); } else UI.hub(); },
    bench() { UI.closeOverlay(); UI.backTo = M ? () => UI.brief(M, true) : null; UI.bench(d.equipped); },
  });
};

UI.howTo = function () {
  const touch = Game.touch;
  UI.overlay(`<div class="sheet"><div class="sh-head"><h3>How to play</h3><button class="x" data-a="close">${ICON.cross}</button></div><div class="sh-body how">
    <p>Read the brief. Find the right person through the scope. Wait for the right moment. Take one shot.</p>
    <h4>Controls</h4>
    ${touch ? '<ul><li><b>Drag anywhere</b> to move the scope. Slow drags move it finely.</li><li><b>Zoom slider</b> on the left, or pinch.</li><li><b>Hold breath</b> steadies the crosshair for a few seconds.</li><li><b>Fire</b> fires the instant you touch it.</li><li><b>Reload</b> when the magazine is empty.</li></ul>'
      : '<ul><li><b>Mouse</b> aims. <b>Left click</b> fires. <b>Wheel</b> zooms.</li><li><b>Shift</b> holds your breath. <b>R</b> reloads.</li><li><b>Q and E</b> turn the zero dial on scopes that have one.</li><li><b>Arrow keys</b> nudge the aim. <b>Esc</b> opens your notebook.</li></ul>'}
    <h4>The numbers under the scope</h4>
    <ul><li><b>Range</b>: distance to whatever the crosshair is on.</li><li><b>Wind</b>: the arrow shows which way it pushes the bullet.</li><li><b>Hold</b>: how far to aim off, in mils. One mil is one mark on the scope glass. "Up 2.9" means put the third mark below the centre on the target.</li></ul>
    <h4>Staying unseen</h4>
    <ul><li>A loud rifle is heard by everyone. Fire while something louder is happening, or fit a suppressor.</li><li>A body in the light gets found. Darkness, timing and distance are your friends.</li><li>Some things in a scene can be shot to change it: lamps, hooks, bells, fuse boxes.</li></ul>
    <h4>Stars</h4><p>One for finishing, one for staying clean, one for not wasting shots. Every mission also has a challenge and a hidden rubber duck.</p>
  </div></div>`, { close() { UI.closeOverlay(); } });
};
