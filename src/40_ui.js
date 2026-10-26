// ---------------------------------------------------------------------------
// Menus, part 1: the shell, title, story cards, contracts and briefing.
//
// Every screen is laid out for a phone held sideways first (wide and short):
// navigation is a slim rail down the left, screens are two columns, and the
// one button that matters on each screen never needs scrolling to reach.
// Upright and desktop shapes are handled in style.css (body.portrait).
// ---------------------------------------------------------------------------
const UI = CB.UI = {
  root: null, over: null, tab: 'contracts', chapter: 1, live: [], handlers: {}, oHandlers: {}, attract: null, pick: {},
  io: {}, pq: [], pumping: false, shots: {}, shotKeys: [], shown: {}, colTab: 'skins', skinFilter: null, colSkin: null,
};

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
  room: '<svg viewBox="0 0 24 24"><rect x="3" y="3.5" width="18" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6 9.5h12M6 15.5h12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="8.5" cy="11.6" r="1.1" fill="currentColor"/><circle cx="15.5" cy="11.6" r="1.1" fill="currentColor"/><circle cx="8.5" cy="17.6" r="1.1" fill="currentColor"/><circle cx="15.5" cy="17.6" r="1.1" fill="currentColor"/></svg>',
  guide: '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="18.5" r="2.6" fill="currentColor"/><circle cx="18.5" cy="5.5" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 17c5-1.2 1.5-7.8 7-9.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-dasharray="2.4 2.6" stroke-linecap="round"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  guard: '<svg viewBox="0 0 24 24"><circle cx="12" cy="6.5" r="3.2" fill="currentColor"/><path d="M5 21v-4.5a7 7 0 0114 0V21z" fill="currentColor"/></svg>',
  file: '<svg viewBox="0 0 24 24"><path d="M4 5.5h6l2 2h8v12H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 12h8M8 15.5h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  turn: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="12" height="7" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.7" transform="rotate(-90 9 12.5)"/><path d="M14 5.5a7 7 0 016.5 7M20.5 12.5l-2-2.2M20.5 12.5l2.2-1.9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  look: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5l5.5 5.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M8 10.5h5M10.5 8v5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
};
const fmtCr = (n) => Math.round(n).toLocaleString('en-US');
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
function starsHtml(n, cls) { let s = '<span class="stars ' + (cls || '') + '">'; for (let i = 0; i < 3; i++) s += '<i class="' + (i < n ? 'on' : '') + '">' + ICON.star + '</i>'; return s + '</span>'; }
function timeLabel(S) { const t = { day: 'Day', dawn: 'Dawn', dusk: 'Dusk', night: 'Night', overcast: 'Overcast', snow: 'Snow light' }[S.time] || S.time; const w = { clear: '', rain: ', rain', storm: ', storm', snow: ', snowing', fog: ', fog' }[S.weather] || ''; return t + w; }
// A rifle's fitted parts as an attribute for a picture canvas.
function uiCfgAttr(cfg) { return 'data-cfg=\'' + JSON.stringify(cfg).replace(/&/g, '&amp;').replace(/'/g, '&#39;') + '\''; }
// Does this skin move (a paint that drifts, pulses or flickers, a sweep of light, a halo)?
const uiMoveCache = {};
function uiSkinMoves(s) {
  if (!s) return false;
  if (uiMoveCache[s.id] === undefined) uiMoveCache[s.id] = !!(s.shimmer || s.glow || /"(anim|drift|pulse|flash)"/.test(JSON.stringify(s)));
  return uiMoveCache[s.id];
}

// Find the two menu layers and listen for taps. Safe to call more than once: a mission started
// straight from the address bar (?m=) never shows the title, but still ends on the results screen.
UI.ensure = function () {
  if (UI.root) return;
  UI.root = document.getElementById('ui'); UI.over = document.getElementById('overlay');
  CB.grunge();
  const click = (map) => (e) => {
    const t = e.target.closest('[data-a]'); if (!t || t.classList.contains('off')) return;
    Sfx.unlock(); if (Sfx.mode === 'off' && Game.state !== 'mission') Sfx.menu();
    const fn = map()[t.dataset.a]; if (fn) { if (!t.dataset.quiet) Sfx.ui(t.dataset.snd || 'tap'); fn(t.dataset, t, e); }
  };
  UI.root.addEventListener('click', click(() => UI.handlers));
  UI.over.addEventListener('click', click(() => UI.oHandlers));
  // turning the phone or resizing the window: pictures are drawn to the size of their box, so draw them again
  let rt = 0;
  const again = () => { clearTimeout(rt); rt = setTimeout(() => { if (UI.attract) UI.attractLayout(); UI.paintGuns(UI.root); UI.paintGuns(UI.over); }, 140); };
  window.addEventListener('resize', again);
  window.addEventListener('orientationchange', () => setTimeout(again, 300));
};
UI.boot = function () { UI.ensure(); UI.title(); };

// Put a screen up. `h` maps data-a names to functions.
UI.render = function (html, h, cls) {
  UI.ensure();
  if (cls !== UI._cls) UI.flushSeen();
  UI._cls = cls;
  UI.root.className = 'ui ' + (cls || '');
  UI.root.innerHTML = html; UI.handlers = h || {};
  const sc = UI.root.querySelectorAll('.scroll, .split'), ks = UI._keepScroll;
  if (ks) for (let i = 0; i < sc.length; i++) if (ks[i]) sc[i].scrollTop = ks[i];
  UI._keepScroll = null;
  UI.paintGuns(UI.root);
};
// Remember how far each scrolling area is scrolled, so that drawing the same screen again does not jump to the top.
UI.keepScroll = function () { UI._keepScroll = Array.prototype.map.call(UI.root.querySelectorAll('.scroll, .split'), (s) => s.scrollTop); };
UI.overlay = function (html, h, cls) { UI.ensure(); UI.over.className = 'overlay show ' + (cls || ''); UI.over.innerHTML = html; UI.oHandlers = h || {}; UI.paintGuns(UI.over); };
UI.closeOverlay = function () {
  if (!UI.over) return;
  UI.over.className = 'overlay'; UI.over.innerHTML = ''; UI.oHandlers = {};
  UI.unwatch('over');
  UI.live = UI.live.filter((l) => l.where !== 'over' && l.cv.isConnected);
  UI.pq = UI.pq.filter((j) => j.where !== 'over');
};
UI.toast = function (text, cls) {
  const t = document.getElementById('toast'); const e = el('div', 'toast ' + (cls || ''), text); t.appendChild(e);
  setTimeout(() => e.classList.add('out'), 2200); setTimeout(() => { if (e.parentNode) e.parentNode.removeChild(e); }, 2700);
};

// ---- pictures ------------------------------------------------------------------------------
// Every picture in the menus is a canvas that says what it wants in its attributes:
//   <canvas data-gun="id" [data-cfg] [data-live]>                          a rifle
//   <canvas data-part-id="id" data-part-slot="slot" data-gun [data-cfg] [data-dim]>   one part, side view
//   <canvas data-glass="scopeId" data-gun [data-cfg]>                      the view through a scope
//   <canvas data-swatch="skinId" [data-gun] [data-rifle]>                  a skin swatch (data-rifle: worn by that rifle)
//   <canvas data-mthumb="missionId" [data-v]>                              a picture of a mission's scene
// Add data-lazy and it is only drawn once it has scrolled into view (a grid of ninety skins must not
// freeze the phone). Skins that move are redrawn a couple of dozen times a second, but only while
// they are on screen. UI.paintGuns draws everything inside one of the two menu layers.
UI.paintGuns = function (root) {
  if (!root) return;
  const where = root === UI.over ? 'over' : 'root';
  UI.unwatch(where);
  UI.live = UI.live.filter((l) => l.where !== where && l.cv.isConnected);
  UI.pq = UI.pq.filter((j) => j.where !== where);
  UI.paintIn(root, where);
};
// Draw the pictures inside one part of a screen without touching the rest of it.
UI.paintIn = function (box, where) {
  where = where || 'root';
  UI.live = UI.live.filter((l) => l.cv.isConnected && !box.contains(l.cv));
  const lazy = [];
  box.querySelectorAll('canvas').forEach((cv) => {
    const j = UI.jobFor(cv); if (!j) return;
    j.where = where; cv._job = j;
    if (j.lazy) lazy.push(cv);
    else if (j.kind === 'thumb' || j.kind === 'tphoto') UI.queue(j);
    else { UI.paintJob(j); j.done = true; j.vis = true; if (j.anim) UI.live.push(j); }
  });
  if (lazy.length) UI.watch(where, lazy);
};
UI.jobFor = function (cv) {
  const ds = cv.dataset, lazy = ds.lazy !== undefined;
  const cfgOf = (id) => (ds.cfg ? JSON.parse(ds.cfg) : gunCfg(id));
  if (ds.partId) return { cv, lazy, kind: 'part', slot: ds.partSlot, id: ds.partId, gun: ds.gun, cfg: cfgOf(ds.gun), dim: +ds.dim || 0 };
  if (ds.glass) return { cv, lazy, kind: 'glass', id: ds.glass, gun: ds.gun, cfg: cfgOf(ds.gun) };
  if (ds.swatch) {
    let sk = SKIN_BY_ID[ds.swatch] || SKINS[0];
    // "factory finish" is a different colour on every rifle, so show the colours of the rifle in question
    if (sk.kind === 'factory' && GUN_ART[ds.gun]) { const A = GUN_ART[ds.gun]; sk = { id: 'factory:' + ds.gun, furn: A.furn, metal: A.metal, acc: A.acc }; }
    // data-rifle: show the skin worn by a rifle (the one in data-gun) instead of three slanted panels
    const rifle = ds.rifle !== undefined && GUN_BY_ID[ds.gun] ? ds.gun : null;
    return { cv, lazy, kind: 'swatch', skin: sk, rifle, cfg: rifle ? Object.assign({}, gunCfg(rifle), { skin: SKIN_BY_ID[ds.swatch] ? ds.swatch : 'factory' }) : null, anim: uiSkinMoves(sk), seen: ds.fresh !== undefined ? ds.swatch : null };
  }
  if (ds.mthumb) return { cv, lazy, kind: 'thumb', id: ds.mthumb, v: +ds.v || 0 };
  if (ds.tphoto) return { cv, lazy, kind: 'tphoto', id: ds.tphoto };
  // drawn pictures (45_ui_art.js and 44_portraits.js); the ones that move are redrawn while on screen
  if (ds.insignia) return { cv, lazy, kind: 'insig', n: +ds.insignia, pres: +ds.pres || 0 };
  if (ds.portrait) return { cv, lazy, kind: 'portrait', who: ds.portrait, mood: ds.mood || 'calm', anim: ds.mood === 'talk' };
  if (ds.card) return { cv, lazy, kind: 'card', id: ds.card, anim: !!ds.live && CB.cardMoves(ds.card) };
  if (ds.case) return { cv, lazy, kind: 'case', tier: ds.case, open: +ds.open || 0, anim: !!ds.live };
  if (ds.medal) return { cv, lazy, kind: 'medal', id: ds.medal, tier: +ds.tier || 0 };
  if (ds.tint) return { cv, lazy, kind: 'tint', id: ds.tint };
  if (ds.drill) return { cv, lazy, kind: 'drill', id: ds.drill };
  if (ds.gun) { const cfg = cfgOf(ds.gun); return { cv, lazy, kind: 'gun', id: ds.gun, cfg, anim: !!ds.live && (uiSkinMoves(SKIN_BY_ID[cfg.skin || 'factory']) || ds.gun === 'stormglass') }; }
  return null;
};
// Size a canvas to the box the page gave it and hand back something to draw on, in CSS pixels.
UI.fitCanvas = function (cv) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return null;
  const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
  if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
  const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
  return { x, w, h };
};
UI.paintJob = function (j, time) {
  const c = UI.fitCanvas(j.cv); if (!c) return;
  const t = time === undefined ? 1.3 : time, x = c.x, w = c.w, h = c.h;
  try {
    if (j.kind === 'gun') drawGun(x, j.id, j.cfg, w / 2, h / 2, w - 10, h - 8, { time: t });
    else if (j.kind === 'part') drawPartArt(x, j.slot, j.id, 3, 3, w - 6, h - 6, { gunId: j.gun, cfg: j.cfg, time: t, dim: j.dim });
    else if (j.kind === 'glass') drawReticleThumb(x, j.id, w / 2, h / 2, Math.min(w, h) / 2 - 0.5, { gunId: j.gun, cfg: j.cfg, time: t });
    else if (j.kind === 'swatch' && j.rifle) drawGun(x, j.rifle, j.cfg, w / 2, h / 2 + 1, w - 8, h - 6, { time: t });
    else if (j.kind === 'swatch') {
      drawSwatch(x, j.skin, 0, 0, w, h, t);
      if (j.skin.shimmer && time !== undefined) { // the same band of light that sweeps along the rifle
        const u = ((t * 0.35) % 1.6) - 0.3, bx = w * u, bw = Math.max(12, w * 0.2);
        const g = x.createLinearGradient(bx - bw, 0, bx + bw, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, rgba(j.skin.shimmer, 0.55)); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.save(); x.globalCompositeOperation = 'lighter'; x.fillStyle = g; x.transform(1, 0, -0.5, 1, h * 0.25, 0); x.fillRect(bx - bw, -2, bw * 2, h + 4); x.restore();
      }
    } else if (j.kind === 'insig') { const s = Math.min(w, h); CB.insignia(x, j.n, (w - s) / 2, (h - s) / 2, s, j.pres); }
    else if (j.kind === 'portrait') { const s = Math.min(w, h); CB.portrait(x, j.cv.dataset.portrait || j.who, (w - s) / 2, (h - s) / 2, s, { mood: j.cv.dataset.mood || j.mood, t }); }
    else if (j.kind === 'card') CB.callingCard(x, j.id, 0, 0, w, h, t);
    else if (j.kind === 'case') CB.drawCase(x, j.tier, w, h, { t, open: j.open, glow: j.cv._glow || 0, rar: j.cv._rar });
    else if (j.kind === 'medal') { const s = Math.min(w, h); CB.drawMedal(x, j.id, (w - s) / 2, (h - s) / 2, s, j.tier); }
    else if (j.kind === 'tint') CB.drawTint(x, j.id, w, h);
    else if (j.kind === 'drill') CB.drawDrill(x, j.id, w, h);
    else if (j.kind === 'tphoto') { const M = MISSION_BY_ID[j.id], s = M && UI.targetPhoto(M, w, h); if (s) x.drawImage(s, 0, 0, s.width, s.height, 0, 0, w, h); }
    else if (j.kind === 'thumb') {
      const M = MISSION_BY_ID[j.id], s = M && UI.sceneShot(M, j.v, w, h);
      if (s) { x.drawImage(s.cv, 0, 0, s.cv.width, s.cv.height, 0, 0, w, h); if (j.cv.id === 'thumb') { const lab = document.getElementById('thtime'); if (lab) lab.textContent = s.label + '  ·  ' + s.dist + ' m'; } }
    }
  } catch (e) { /* a picture is a nicety, never a blocker */ }
  if (j.seen) UI.shown[j.seen] = 1;
};
UI.paintGun = function (cv, id, cfg, time) { UI.paintJob({ cv, kind: 'gun', id, cfg }, time); };
// Lazy pictures: watch them, and draw each one the first time it comes near the screen.
UI.watch = function (where, list) {
  if (typeof IntersectionObserver !== 'function') { list.forEach((cv) => { cv._job.vis = true; UI.queue(cv._job); if (cv._job.anim) UI.live.push(cv._job); }); return; }
  const seen = (ents) => {
    for (let i = 0; i < ents.length; i++) {
      const j = ents[i].target._job; if (!j) continue;
      if (ents[i].isIntersecting) { j.vis = true; if (!j.done && !j.queued) UI.queue(j); if (j.anim && UI.live.indexOf(j) < 0) UI.live.push(j); }
      else { j.vis = false; const k = UI.live.indexOf(j); if (k >= 0) UI.live.splice(k, 1); }
    }
  };
  // one watcher per scrolling box, so that pictures just below the fold are drawn a little ahead of the finger
  const boxes = new Map(), memo = new Map();
  list.forEach((cv) => {
    const par = cv.parentElement; let box = memo.get(par);
    if (box === undefined) { box = null; for (let p = par; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if (o === 'auto' || o === 'scroll') { box = p; break; } } memo.set(par, box); }
    if (!boxes.has(box)) boxes.set(box, []);
    boxes.get(box).push(cv);
  });
  if (!UI.io[where]) UI.io[where] = [];
  boxes.forEach((cvs, box) => { const io = new IntersectionObserver(seen, { root: box, rootMargin: '170px 0px' }); cvs.forEach((cv) => io.observe(cv)); UI.io[where].push(io); });
};
UI.unwatch = function (where) { (UI.io[where] || []).forEach((io) => io.disconnect()); UI.io[where] = []; };
// Pictures waiting to be drawn are done a few at a time, so a long list never holds up a frame.
UI.queue = function (j) { j.queued = true; UI.pq.push(j); if (!UI.pumping) { UI.pumping = true; setTimeout(UI.pump, 0); } };
UI.pump = function () {
  const t0 = performance.now();
  while (UI.pq.length && performance.now() - t0 < 7) {
    const j = UI.pq.shift(); j.queued = false;
    if (!j.cv.isConnected) continue;
    UI.paintJob(j); j.done = true;
    if (j.kind === 'thumb' || j.kind === 'tphoto') break; // a scene or a target photo is a big job: one per turn
  }
  if (UI.pq.length) setTimeout(UI.pump, 16); else UI.pumping = false;
};
// A picture of a mission's scene, drawn once at the size asked for and then kept.
UI.sceneShot = function (M, vi, w, h) {
  w = Math.round(w); h = Math.round(h); vi = vi || 0;
  const key = M.id + '/' + vi + '/' + w + 'x' + h;
  if (UI.shots[key]) return UI.shots[key];
  try {
    const cv = document.createElement('canvas'), st = buildStats('halden');
    const sim = new Sim(M, st, vi, { flags: Save.data.flags, shotSeed: 1 });
    for (let i = 0; i < 45; i++) sim.step(1 / 30);
    sim.S.objects.forEach((o) => { if (o.kind === 'duck') o.alive = false; }); // a picture never gives away where the rubber duck is hidden
    const V = new View(cv), dpr = Math.min(2, window.devicePixelRatio || 1);
    V.layout(w, h, dpr, 'plain');
    const b = sim.S.bounds, zr = sim.S.refZ - sim.eye0.z, spanMil = ((b.x1 - b.x0) / zr) * 1000;
    sim.sh.zoom = sim.sh.zoomT = clamp((FOV_AT_1X / (spanMil * 0.5)) * ((V.R * 2) / w), 1.5, 14);
    sim.sh.swx = sim.sh.swy = 0;
    V.draw(sim, 0.016, 0);
    const s = { cv, label: timeLabel(sim.S), dist: Math.round(zr), key };
    UI.shots[key] = s; UI.shotKeys.push(key);
    if (UI.shotKeys.length > 28) delete UI.shots[UI.shotKeys.shift()];
    return s;
  } catch (e) { return null; }
};
// Skins that have been on screen stop being "new" once you leave the screen that showed them.
UI.flushSeen = function () {
  const ids = Object.keys(UI.shown); if (!ids.length) return;
  const d = Save.data; if (!d.skinSeen) d.skinSeen = {};
  ids.forEach((id) => { if (d.skins[id]) d.skinSeen[id] = 1; });
  UI.shown = {}; Save.write();
};

// Called every frame while no mission is running.
UI.tick = function (dt) {
  UI.t = (UI.t || 0) + dt;
  if (UI.live.length) { UI._lt = (UI._lt || 0) + dt; if (UI._lt > 0.045) { UI._lt = 0; for (let i = 0; i < UI.live.length; i++) { const l = UI.live[i]; if (l.vis && l.cv.isConnected) UI.paintJob(l, UI.t); } } }
  if (UI.attract) UI.attractStep(dt);
  if (Sfx.ok && Sfx.mode !== 'off') Sfx.pump();
  if (UI.onTick) UI.onTick(dt);
  if (UI.anims.length) { const a = UI.anims; UI.anims = []; for (let i = 0; i < a.length; i++) { let keep = false; try { keep = a[i](dt) !== false; } catch (e) { keep = false; } if (keep) UI.anims.push(a[i]); } }
};
// Run fn(dt) every frame while the menus are up, until it returns false.
UI.anims = [];
UI.anim = function (fn) { UI.anims.push(fn); };

// ---- the scope drifting over a night street on the title -------------------------------
UI.attractStart = function () {
  try {
    const M = MISSION_BY_ID.c1m3, st = buildStats('halden');
    const sim = new Sim(M, st, 0, { flags: {}, shotSeed: 1 });
    sim.triggers = sim.triggers.filter((t) => t.every); sim.rules = { kill: [], destroy: [], protect: [], until: 'never' };
    UI.attract = { sim, t: 0, tx: 0, ty: 0 };
    document.body.classList.add('attract');
    UI.attractLayout(); Game.view.noReticle = false; Game.view.fx = []; Game.view.assist = 'veteran'; Game.view.hold = null; Game.view.rangeInfo = null;
    sim.sh.zoom = sim.sh.zoomT = 5;
  } catch (e) { UI.attract = null; }
};
// Where the scope sits on the title. Sideways, it is a big round glass on the right with the name
// and the buttons beside it. Upright, it sits above them. The page is told where it is so that it
// can leave a round window for it.
UI.attractLayout = function () {
  const G = Game, V = G.view, W = G.W, H = G.H;
  V.layout(W, H, V.dpr, 'attract');
  if (G.mode !== 'portrait') {
    const sf = G.safe || { l: 0, r: 0, t: 0, b: 0 };
    const room = W - sf.l - sf.r; // the scope takes what the name and the buttons can spare
    const R = Math.max(80, Math.min((H - sf.b * 0.5) * 0.5 - 22, room * 0.26, (room - 300) / 2));
    V.R = V.RR = V.hw = V.hh = R; V.cx = W - sf.r - 26 - R; V.cy = (H - sf.b * 0.5) / 2;
  }
  const st = document.getElementById('ui').style;
  st.setProperty('--scx', V.cx.toFixed(1) + 'px'); st.setProperty('--scy', V.cy.toFixed(1) + 'px'); st.setProperty('--scr', V.R.toFixed(1) + 'px');
};
UI.attractStop = function () { if (!UI.attract) return; UI.attract = null; document.body.classList.remove('attract'); Game.resize(); };
UI.attractStep = function (dt) {
  const A = UI.attract, sim = A.sim; A.t += dt;
  if (Game.view.mode !== 'attract') UI.attractLayout();
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
  UI.ensure();
  if (!UI.attract) UI.attractStart(); else UI.attractLayout();
  UI.render(`
    <div class="scr title">
      <div class="t-main">
        <div class="eyebrow">A long-range story in six chapters</div>
        <h1 class="logo">COLD<span class="ret"></span>BORE</h1>
        <p class="t-tag">The first shot from a cold barrel.<br>The one you do not get back.</p>
        <div class="t-acts">
          <button class="btn pri big" data-a="play" data-snd="go">${has ? 'Continue' : 'Begin'}</button>
          <div class="t-links"><button class="btn ghost" data-a="how">How to play</button><button class="btn ghost" data-a="settings">Settings</button></div>
        </div>
        <div class="t-note">No ads and no real money. Everything is earned by playing.<br>Progress saves on this device${Save.ok ? '' : ' (this browser is blocking saves)'}.<br><span class="bld">Build ${BUILD}</span></div>
        <div class="t-turn">${ICON.turn}<span>Made to be played with the phone held sideways. Turn it for the full picture.</span></div>
      </div>
    </div>`, {
    play() { UI.attractStop(); if (!Save.data.seen.prologue) UI.prologue(); else UI.hub(); },
    how() { UI.howTo(); },
    settings() { UI.settings(true); },
  }, 'is-title');
};

// ---- story cards ---------------------------------------------------------------------------
// Each page of the story is a moment in a film: the place it happens, seen wide and panning
// slowly behind black bars, the words typed out at the bottom beside the portrait of whoever the
// page is about. A tap finishes the typing; the next tap turns the page. Skip leaves at once.
//   cards  [{ h, p }]   art  [{ m: contract id for the place, v, who, past }] (38_story.js, STORY_ART)
UI.storyShots = {}; UI.storyKeys = [];
UI.cards = function (cards, done, kicker, art) {
  let i = 0, tw = null;
  const finish = () => { tw = null; UI.storyLeave = null; done(); };
  const show = () => {
    const c = cards[i], a = (art && art[i]) || null, who = a && a.who;
    UI.render(`<div class="scr story cine ${a ? 'has-pic' : ''} ${a && a.past ? 'past' : ''}" data-a="next" data-quiet="1">
      <div class="st-picbox"><canvas class="st-pic"></canvas></div><div class="st-grade"></div>
      <div class="st-lb top"></div><div class="st-lb bot"></div>
      <div class="st-in ${c.p.length > 330 ? 'long' : ''}">${who ? `<canvas class="st-face" data-portrait="${who}" data-mood="talk"></canvas>` : ''}<div class="st-txt"><div class="eyebrow">${esc(kicker || '')}</div>${c.h ? '<h2>' + esc(c.h) + '</h2>' : ''}<p>${esc(c.p)}</p></div></div>
      <div class="st-foot"><span>${i + 1} / ${cards.length}</span><span class="tap">Tap to continue</span></div>
      ${cards.length > 1 ? '<button class="st-skip" data-a="skip" data-snd="back">Skip</button>' : ''}</div>`, {
      next() {
        if (tw && !tw.done) { tw.finish(); return; } // the first tap finishes the words
        Sfx.ui('page'); i++; if (i >= cards.length) finish(); else show();
      },
      skip() { finish(); },
    }, 'is-story');
    const root = UI.root.querySelector('.story');
    if (a) UI.storyPicture(root.querySelector('.st-pic'), a);
    // a long page on a short screen: step the type down until it fits rather than cut it off
    const box = UI.root.querySelector('.st-in'), p = box && box.querySelector('p');
    if (p) for (let fs = parseFloat(getComputedStyle(p).fontSize), n = 0; n < 10 && box.scrollHeight > box.clientHeight + 1 && fs > 13; n++) { fs -= 1; p.style.fontSize = fs + 'px'; }
    const face = root.querySelector('.st-face');
    tw = UI.typeIn(p, 62, () => { if (face && face.isConnected) { face.dataset.mood = 'calm'; UI.paintJob(face._job || UI.jobFor(face), 0); } });
  };
  show();
};
// The place behind a story page: the contract's scene seen wide, a third wider than the screen
// so it can pan, graded once (darker, and grey and cold for the past). Kept for a few pages.
UI.storyPicture = function (cv, a) {
  const M = MISSION_BY_ID[a.m]; if (!M || !cv) return;
  const box = cv.parentElement, W = box.clientWidth, H = box.clientHeight; if (!W || !H) return;
  const w = Math.round(W * 1.3), h = Math.round(H), key = a.m + '/' + (a.v || 0) + '/' + w + 'x' + h + (a.past ? 'p' : '');
  let s = UI.storyShots[key];
  if (!s) {
    const shot = UI.sceneShot(M, a.v || 0, w, h); if (!shot) return;
    const g = document.createElement('canvas'); g.width = shot.cv.width; g.height = shot.cv.height;
    const x = g.getContext('2d'); x.drawImage(shot.cv, 0, 0);
    x.globalCompositeOperation = 'saturation'; x.fillStyle = 'rgba(128,128,128,' + (a.past ? 0.85 : 0.25) + ')'; x.fillRect(0, 0, g.width, g.height);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = a.past ? '#8fa0b4' : '#c9c2b4'; x.fillRect(0, 0, g.width, g.height);
    x.globalCompositeOperation = 'source-over';
    s = UI.storyShots[key] = g; UI.storyKeys.push(key);
    if (UI.storyKeys.length > 4) delete UI.storyShots[UI.storyKeys.shift()];
    delete UI.shots[shot.key]; // the plain picture is not needed again
  }
  cv.width = s.width; cv.height = s.height; cv.style.width = w + 'px'; cv.style.height = h + 'px';
  cv.getContext('2d').drawImage(s, 0, 0);
  cv.style.setProperty('--pan', -(w - W) + 'px');
  cv.classList.add('pan');
};
UI.prologue = function () { UI.cards(PROLOGUE, () => { Save.data.seen.prologue = 1; Save.write(); UI.chapter = 1; UI.chapterIntro(1, () => UI.hub()); }, 'Cold Bore', STORY_ART.prologue.map((a, i) => Object.assign({ past: i < 3 }, a))); };
UI.chapterIntro = function (n, done) {
  const c = CHAPTER_BY_N[n];
  const cards = c.intro.map((p, i) => ({ h: i === 0 ? c.title : '', p }));
  Save.data.seen['ch' + n] = 1; Save.write();
  UI.cards(cards, done, 'Chapter ' + ROMAN[n] + '  ·  ' + c.place, STORY_ART.intro[n]);
};

// ---- hub shell -----------------------------------------------------------------------------
// The frame around the five main screens: the rail of tabs, and a slim bar across the top with
// whatever `head` the screen wants on the left and the rank and credits on the right.
UI.shell = function (head, body, cls) {
  const d = Save.data, x = Progress.rankXp(), r = rankOf(x), pct = UI.xpPct(x);
  const tab = (id, icon, label, badge) => `<button class="tabb ${UI.tab === id ? 'on' : ''}" data-a="tab" data-tab="${id}">${ICON[icon]}<span>${label}</span>${badge ? '<em>' + badge + '</em>' : ''}</button>`;
  return `<div class="scr hub ${cls || ''}">
    <nav class="tabs">
      ${tab('contracts', 'target', 'Contracts')}${tab('armory', 'rifle', 'Armory', d.newArmory ? 'New' : '')}<button class="tabb room" data-a="gunroom">${ICON.room}<span>Gun room</span></button>${tab('collection', 'gem', 'Collection', d.caches.length || '')}${tab('dossier', 'file', 'Dossier')}${tab('range', 'flag', 'Range')}${tab('settings', 'gear', 'Settings')}
    </nav>
    <div class="hubmain">
      <div class="top">
        <div class="top-l">${head || ''}</div>
        <button class="rank" data-a="rankinfo"><canvas class="rk-ins" data-insignia="${r.n}" data-pres="${d.prestige || 0}"></canvas><span><i>${r.n}  ·  ${esc(r.name)}</i><i class="xp"><i style="width:${pct.toFixed(0)}%"></i></i></span></button>
        <div class="cr"><b>${fmtCr(d.credits)}</b><small>credits</small></div>
      </div>
      ${body}
    </div></div>`;
};
UI.shellHandlers = function (h) {
  return Object.assign({
    tab(ds) { UI.tab = ds.tab; UI.hub(); },
    gunroom() { UI.gallery(); }, // the gun room (43_ui_gallery.js), from the rail or any screen in the shell
    rankinfo() { UI.rankInfo(); },
  }, h || {});
};
UI.hub = function () {
  UI.attractStop(); Sfx.menu();
  if (UI.tab === 'armory') return UI.armory();
  if (UI.tab === 'collection') return UI.collection();
  if (UI.tab === 'range') return UI.range();
  if (UI.tab === 'settings') return UI.settings(false);
  if (UI.tab === 'dossier' && UI.dossier) return UI.dossier();
  return UI.contracts();
};
// The rank track: every rank in a row along a rail, its insignia, its xp and what it hands you.
// Where you are is lit and the view opens there. At the top, a prestige starts the track again.
UI.rankInfo = function () {
  const d = Save.data, x = Progress.rankXp(), r = rankOf(x), nx = nextRank(x), pres = d.prestige || 0;
  const node = (k) => {
    const w = rankReward(k.n, pres), got = k.n <= r.n, opens = Progress.opensAt(k.n), sale = opens.guns.length + opens.parts.length + opens.scopes.length;
    return `<div class="rn ${k.n === r.n ? 'cur' : got ? 'had' : ''} ${k.grade === 1 ? 'fam' : ''}" ${k.n === r.n ? 'id="rncur"' : ''}>
      <canvas data-insignia="${k.n}" data-pres="${pres}" data-lazy></canvas><b>${k.n}</b><span>${esc(k.name)}</span><i>${fmtCr(k.xp)} xp</i>
      ${w ? `<em class="rw k-${w.k}">${got ? ICON.check : ''}${esc(w.text.replace(/^Calling card: /, 'Card: ').replace(/^Reticle tint: /, 'Tint: '))}</em>` : '<em class="rw none">Where it starts</em>'}
      ${sale ? `<em class="rs">${opens.guns.length ? opens.guns.length + (opens.guns.length === 1 ? ' rifle' : ' rifles') : ''}${opens.guns.length && opens.parts.length + opens.scopes.length ? ', ' : ''}${opens.parts.length + opens.scopes.length ? opens.parts.length + opens.scopes.length + ' parts' : ''} for sale</em>` : ''}
    </div>`;
  };
  UI.overlay(`<div class="sheet tall rtrack"><div class="sh-head"><canvas class="rt-ins" data-insignia="${r.n}" data-pres="${pres}"></canvas><div class="sh-t"><div class="eyebrow">Rank ${r.n} of ${RANKS.length}${pres ? '  ·  prestige ' + pres : ''}</div><h3>${esc(r.name)}</h3></div>
      <div class="rt-xp"><div class="xpbar"><i style="width:${UI.xpPct(x).toFixed(1)}%"></i></div><span>${nx ? fmtCr(nx.xp - x) + ' xp to ' + esc(nx.name) : 'The top of the track'}</span></div><button class="x" data-a="close">${ICON.cross}</button></div>
    <div class="sh-body"><div class="rtrail">${RANKS.map(node).join('')}</div>
      <div class="rt-foot"><p class="dim">Experience comes from contracts, stars, challenges, medals and rifle mastery. Every rank hands you something on the way, and the ten marked with a clearance open rifles and parts at Pip's. Rank only ever counts up: the shop never closes again.</p>
      ${Progress.canPrestige() ? '<button class="btn pri" data-a="prestige">Start the track again</button>' : `<p class="dim">At rank ${RANKS.length} you can start the track again from rank 1, keeping everything you own, with a star on your insignia for each time round.</p>`}</div></div></div>`, {
    close() { UI.closeOverlay(); },
    prestige() { if (Progress.prestige()) { UI.closeOverlay(); UI.toast('Prestige ' + Save.data.prestige + '. The track starts again.', 'good'); UI.hub(); } },
  });
  const cur = document.getElementById('rncur'), box = UI.over.querySelector('.rtrack .sh-body');
  if (cur && box) box.scrollTop = Math.max(0, cur.offsetTop - box.clientHeight / 2 + cur.offsetHeight / 2);
};

// ---- contracts: see 47_ui_board.js (the case board) ----

// ---- briefing: see 46_ui_brief.js (the dossier) ----

// ---- guided runs ------------------------------------------------------------------------------
// The written walkthrough for a mission, as a numbered list (or a note that there is none yet).
UI.walkthrough = function (M, title) {
  const g = missionText(M, 'guide');
  const steps = Array.isArray(g) && g.length ? '<ol>' + g.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ol>' : '<p class="dim">No walkthrough written for this one yet.</p>';
  return `<div class="walk"><div class="eyebrow">${esc(title || 'How to three-star it')}</div>${steps}</div>`;
};
// "Show me how": the steps, the deal, and a way to start a guided run from the briefing.
UI.showHow = function (M) {
  const d = Save.data, P = UI.pick, st = buildStats(d.equipped, gunCfg(d.equipped)), why = gunAllowed(M, st);
  const V = M.vantages || [{ name: 'Position' }], vname = V.length > 1 ? V[P.v || 0].name : '';
  UI.overlay(`<div class="sheet tall showhow"><div class="sh-head"><div class="sh-t"><div class="eyebrow">${esc(M.title)}${vname ? '  ·  from the ' + esc(vname.toLowerCase()) : ''}</div><h3>Show me how</h3></div><button class="x" data-a="close">${ICON.cross}</button></div>
    <div class="sh-body split">
      <div class="side">
        <div class="deal">${ICON.guide}<div><b>Guided run: you still earn stars, credits and xp, but no caches from this run.</b><span>A coach on the screen takes you through it as it happens: when to wait, when to hold your breath, a mark showing exactly where to aim, and FIRE NOW at the right moment. The caches stay there for a run of your own.</span></div></div>
        <div class="cta col"><button class="btn pri ${why ? 'off' : ''}" data-a="guided" data-snd="go">${why ? 'Rifle not suitable' : 'Start a guided run'}</button><button class="btn ghost" data-a="close" data-snd="back">Not now</button></div>
      </div>
      <div class="main scroll">${UI.walkthrough(M)}</div>
    </div></div>`, {
    close() { UI.closeOverlay(); },
    guided() { UI.launch(M.id, { vantage: P.v || 0, guided: true }); },
  });
};
UI.launch = function (id, opts) {
  UI.attractStop(); UI.closeOverlay(); UI.flushSeen();
  Game.start(id, opts);
  // on a computer, grab the mouse straight away so the first click fires rather than aims
  if (!Game.touch) { Game.mouseAim = true; if (Game.stage.requestPointerLock) { try { Game.stage.requestPointerLock(); } catch (e) { /* fine */ } } }
};

// Choose which owned rifle to take.
UI.gunPicker = function (M) {
  const d = Save.data;
  const rows = GUNS.filter((g) => d.guns[g.id]).map((g) => {
    const st = buildStats(g.id, gunCfg(g.id)), why = M ? gunAllowed(M, st) : null;
    return `<button class="grow ${why ? 'bad' : ''} ${d.equipped === g.id ? 'on' : ''}" data-a="take" data-id="${g.id}"><span class="gc-pic plate"><canvas data-gun="${g.id}" data-lazy></canvas></span><span class="gc-t"><b>${esc(g.name)}</b><i>${why ? esc(why) : esc(g.calName) + '  ·  reach ' + st.eff + ' m  ·  ' + (st.silent ? 'silent' : st.quiet ? 'suppressed' : 'loud')}</i></span>${d.equipped === g.id ? '<span class="chg">In use</span>' : ''}</button>`;
  }).join('');
  UI.overlay(`<div class="sheet tall"><div class="sh-head"><h3>Choose a rifle</h3><button class="btn ghost sm" data-a="bench">Open the workbench</button><button class="x" data-a="close">${ICON.cross}</button></div>
    <div class="sh-body"><div class="ggrid">${rows}</div></div></div>`, {
    close() { UI.closeOverlay(); },
    take(ds) { d.equipped = ds.id; Save.write(); Sfx.ui('equip'); UI.closeOverlay(); if (M) { UI.keepScroll(); UI.brief(M, true); } else UI.hub(); },
    bench() { UI.closeOverlay(); UI.backTo = M ? () => UI.brief(M, true) : null; UI.bench(d.equipped); },
  });
};

UI.howTo = function () {
  const touch = Game.touch;
  UI.overlay(`<div class="sheet tall"><div class="sh-head"><h3>How to play</h3><button class="x" data-a="close">${ICON.cross}</button></div><div class="sh-body how">
    <p class="lead">Read the brief. Find the right person through the scope. Wait for the right moment. Take one shot.</p>
    <div class="howcols">
    <div><h4>Controls</h4>
    ${touch ? '<ul><li><b>Hold the phone sideways.</b> The picture fills the whole screen.</li><li><b>Drag anywhere</b> to move the scope. Slow drags move it finely.</li><li><b>Zoom slider</b> on the left, or pinch with two fingers.</li><li><b>Hold breath</b> steadies the crosshair for a few seconds.</li><li><b>Fire</b> fires the instant you touch it.</li><li><b>Reload</b> when the magazine is empty.</li><li><b>Mark</b> locks the distance to whatever the crosshair is on. Hold it down to clear it.</li></ul>'
      : '<ul><li><b>Mouse</b> aims. <b>Left click</b> fires. <b>Wheel</b> zooms.</li><li><b>Shift</b> holds your breath. <b>R</b> reloads.</li><li><b>Q and E</b> turn the zero dial on scopes that have one.</li><li><b>M</b> locks the distance to whatever the crosshair is on. Hold M down to clear it.</li><li><b>Arrow keys</b> nudge the aim. <b>Esc</b> opens your notebook.</li></ul>'}</div>
    <div><h4>The numbers under the scope</h4>
    <ul><li><b>Range</b>: distance to whatever the crosshair is on.</li><li><b>Marked</b>: with Full help, or with a scope that has a rangefinder, you can lock a target's distance. Put the crosshair on them and mark. RANGE then says MARKED, and RANGE, HOLD and the amber marker stay set for that distance while you aim higher to make up for the drop. If they move, mark them again. Marking the open sky clears it.</li><li><b>Wind</b>: the arrow shows which way it pushes the bullet.</li><li><b>Hold</b>: how far to aim off, in mils. One mil is one mark on the scope glass. "Up 2.9" means put the third mark below the centre on the target.</li></ul></div>
    <div><h4>Staying unseen</h4>
    <ul><li>A loud rifle is heard by everyone. Fire while something louder is happening, or fit a suppressor (a tube on the muzzle that takes away the bang).</li><li>A body in the light gets found. Darkness, timing and distance are your friends.</li><li>Some things in a scene can be shot to change it: lamps, hooks, bells, fuse boxes.</li></ul></div>
    <div><h4>Stars</h4><p>One for finishing, one for staying clean, one for not wasting shots. Every mission also has a challenge and a hidden rubber duck.</p></div>
    <div><h4>Play it full screen on a phone</h4><p>Add this page to your Home Screen: tap the <b>Share</b> button in your browser, then <b>Add to Home Screen</b>. Open the game from the new icon and it fills the whole screen, with no address bar or browser buttons in the way. Your progress is kept on the phone either way.</p></div>
    </div>
  </div></div>`, { close() { UI.closeOverlay(); } });
};
