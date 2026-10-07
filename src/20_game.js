// ---------------------------------------------------------------------------
// The game loop, the in-mission display, and the controls.
// ---------------------------------------------------------------------------
const Game = CB.Game = {
  state: 'menu', sim: null, view: null, mission: null, last: 0, scale: 1, slowUntil: 0, touch: false, mode: 'portrait',
  aimPtr: null, pinch: null, keys: {}, locked: false, paused: false, endShown: false, hud: {},
};

Game.init = function () {
  const G = Game;
  G.cv = document.getElementById('cv');
  G.view = new View(G.cv);
  G.stage = document.getElementById('stage');
  G.touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  document.body.classList.toggle('touch', G.touch);
  G.buildHud();
  window.addEventListener('resize', G.resize);
  window.addEventListener('orientationchange', () => setTimeout(G.resize, 250));
  G.resize();
  G.bindInput();
  requestAnimationFrame(G.loop);
};

Game.resize = function () {
  const G = Game, W = window.innerWidth, H = window.innerHeight;
  G.W = W; G.H = H;
  G.mode = H >= W * 1.05 ? 'portrait' : 'landscape';
  document.body.classList.toggle('portrait', G.mode === 'portrait');
  document.body.classList.toggle('landscape', G.mode !== 'portrait');
  const dpr = Math.min(window.devicePixelRatio || 1, Save.data && Save.data.settings.lowRes ? 1.25 : 2);
  G.view.layout(W, H, dpr, G.mode);
  G.placeHud();
};

// ---- in-mission display ---------------------------------------------------------
Game.buildHud = function () {
  const G = Game, h = G.hud, root = document.getElementById('hud');
  root.innerHTML = '';
  const mk = (cls, html, parent) => { const e = el('div', cls, html); (parent || root).appendChild(e); return e; };
  h.top = mk('h-top');
  h.pause = mk('h-btn h-pause', '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 4h14v2H5zM5 9h14v2H5zM5 14h9v2H5zM5 19h12v2H5z" fill="currentColor"/></svg>', h.top);
  h.obj = mk('h-obj', '', h.top);
  h.timer = mk('h-timer', '', h.top);
  h.pills = mk('h-pills');
  h.cover = mk('pill pill-cover', 'NOISE COVER', h.pills);
  h.alarm = mk('pill pill-alarm', 'ALARM', h.pills);
  h.strip = mk('h-strip');
  h.sRange = mk('cell', '<i>RANGE</i><b>--</b>', h.strip);
  h.sWind = mk('cell', '<i>WIND</i><b>--</b>', h.strip);
  h.sHold = mk('cell cell-hold', '<i>HOLD (MILS)</i><b>--</b>', h.strip);
  h.sZero = mk('cell cell-zero', '<i>ZERO</i><span class="zbtn zminus">&minus;</span><b>100</b><span class="zbtn zplus">+</span>', h.strip);
  h.sZoom = mk('cell', '<i>ZOOM</i><b>3.0x</b>', h.strip);
  h.msg = mk('h-msg');
  h.zoom = mk('h-zoom', '<div class="zt"><div class="zf"></div><div class="zk"></div></div><span class="zl">ZOOM</span>');
  h.fire = mk('h-ctl h-fire', '<span>FIRE</span>');
  h.breath = mk('h-ctl h-breath', '<svg class="ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" class="bg"/><circle cx="50" cy="50" r="46" class="fg"/></svg><span>HOLD<br>BREATH</span>');
  h.reload = mk('h-ctl h-reload', '<span>RELOAD</span>');
  h.ammo = mk('h-ammo');
  h.keys = mk('h-keys', '<b>Mouse</b> aim &nbsp; <b>Click</b> fire &nbsp; <b>Wheel</b> zoom &nbsp; <b>Shift</b> hold breath &nbsp; <b>R</b> reload &nbsp; <b>Q / E</b> zero &nbsp; <b>Esc</b> notebook');
  h.fade = mk('h-fade');
  h.banner = mk('h-banner');
};
Game.placeHud = function () {
  const G = Game, h = G.hud, V = G.view, W = G.W, Hh = G.H;
  if (!h.top) return;
  const P = (e, o) => { for (const k in o) e.style[k] = typeof o[k] === 'number' ? o[k] + 'px' : o[k]; };
  if (G.mode === 'portrait') {
    const sb = V.cy + V.R; // bottom of the scope
    P(h.strip, { left: 8, right: 8, top: sb + 14, width: 'auto', bottom: 'auto' });
    P(h.pills, { left: 0, right: 0, top: V.cy - V.R - 4, width: 'auto' });
    P(h.msg, { left: 12, right: 12, top: sb + 64, width: 'auto', bottom: 'auto' });
    const zt = Math.max(sb + 172, Hh - 226);
    P(h.zoom, { left: 14, top: zt, height: Math.max(120, Hh - zt - 22), bottom: 'auto', right: 'auto' });
    P(h.fire, { right: 20, bottom: 34, width: 118, height: 118, left: 'auto', top: 'auto' });
    P(h.breath, { right: 150, bottom: 26, width: 86, height: 86, left: 'auto', top: 'auto' });
    P(h.reload, { right: 34, bottom: 168, width: 66, height: 66, left: 'auto', top: 'auto' });
    P(h.ammo, { right: 112, bottom: 180, left: 'auto', top: 'auto' });
  } else {
    const side = Math.max(120, V.cx - V.R - 20);
    P(h.strip, { left: 10, top: 'auto', bottom: 10, width: Math.min(side - 4, 230), right: 'auto' });
    P(h.pills, { left: V.cx - 150, width: 300, right: 'auto', top: 6 });
    P(h.msg, { right: 10, top: 56, width: Math.min(side - 4, 280), left: 'auto', bottom: 'auto' });
    P(h.zoom, { left: 18, top: Math.max(120, Hh * 0.2), height: Math.min(190, Hh * 0.42), bottom: 'auto', right: 'auto' });
    P(h.fire, { right: 22, bottom: 22, width: 112, height: 112, left: 'auto', top: 'auto' });
    P(h.breath, { right: 150, bottom: 16, width: 80, height: 80, left: 'auto', top: 'auto' });
    P(h.reload, { right: 40, bottom: 150, width: 62, height: 62, left: 'auto', top: 'auto' });
    P(h.ammo, { right: 116, bottom: 160, left: 'auto', top: 'auto' });
  }
};

Game.updateHud = function (dt) {
  const G = Game, h = G.hud, sim = G.sim, sh = sim.sh, st = sim.st, V = G.view, A = Save.data.settings.assist;
  const set = (e, s) => { if (e._s !== s) { e._s = s; e.innerHTML = s; } };
  const r = V.rangeInfo, canRange = A !== 'veteran' || st.scope.lrf;
  set(h.sRange.lastChild, canRange ? (r && r.d ? Math.round(r.d) + ' m' : 'sky') : 'by eye');
  const w = sim.wind(), aw = Math.abs(w);
  set(h.sWind.lastChild, A === 'veteran' && !st.scope.smart ? 'read it' : (aw < 0.25 ? 'calm' : '<span class="warr">' + (w > 0 ? '&rarr;' : '&larr;') + '</span> ' + fmt(aw, 1) + ' m/s'));
  let hold = '--';
  if ((A !== 'veteran' || st.scope.smart) && V.hold && V.hold.ok && r && r.d) {
    const up = V.hold.up, rt = V.hold.right;
    const us = Math.abs(up) < 0.15 ? 'dead on' : (up > 0 ? '&uarr;' : '&darr;') + fmt(Math.abs(up), 1);
    const ws = Math.abs(rt) < 0.15 ? '' : ' &nbsp;' + (rt > 0 ? '&rarr;' : '&larr;') + fmt(Math.abs(rt), 1);
    hold = us + ws;
  } else if (V.hold && !V.hold.ok) hold = 'out of reach';
  set(h.sHold.lastChild, hold);
  set(h.sZero.querySelector('b'), sh.zeroR + ' m');
  set(h.sZoom.lastChild, fmt(sh.zoom, 1) + 'x');
  // zoom slider
  const zu = st.zoomMax > st.zoomMin ? (Math.log(sh.zoomT / st.zoomMin) / Math.log(st.zoomMax / st.zoomMin)) : 0;
  h.zoom.querySelector('.zk').style.bottom = (zu * 100) + '%'; h.zoom.querySelector('.zf').style.height = (zu * 100) + '%';
  // breath ring
  const fg = h.breath.querySelector('.fg'), frac = clamp(sh.breath / st.breath, 0, 1);
  fg.style.strokeDashoffset = String(289 * (1 - frac));
  h.breath.classList.toggle('on', sh.holding); h.breath.classList.toggle('spent', sh.exhausted > 0 || (!sh.holding && frac < 0.2));
  // fire button state
  const ready = sim.canFire();
  h.fire.classList.toggle('wait', !ready); h.fire.classList.toggle('charge', sh.chargeT > 0);
  const cyc = sh.reloadT > 0 ? 1 - sh.reloadT / sh.reloadLen : sh.cycleT > 0 ? 1 - sh.cycleT / sh.cycleLen : 1;
  h.fire.style.setProperty('--p', String(clamp(cyc, 0, 1)));
  set(h.fire.firstChild, sh.reloadT > 0 ? 'RELOADING' : sh.ammo <= 0 ? 'EMPTY' : sh.chargeT > 0 ? 'CHARGING' : 'FIRE');
  h.reload.classList.toggle('need', sh.ammo <= 0 && sh.reserve > 0 && sh.reloadT <= 0);
  h.reload.classList.toggle('off', sh.ammo >= st.mag || sh.reserve <= 0);
  // ammo pips
  const key = sh.ammo + '/' + st.mag + '/' + sh.reserve;
  if (h.ammo._k !== key) { h.ammo._k = key; let s = ''; const n = Math.min(st.mag, 12); for (let i = 0; i < n; i++) s += '<i class="' + (i < Math.round((sh.ammo / st.mag) * n) ? 'r' : 'e') + '"></i>'; h.ammo.innerHTML = '<div class="pips">' + s + '</div><span>' + sh.ammo + ' <em>+' + sh.reserve + '</em></span>'; }
  // pills, timer
  h.cover.classList.toggle('show', sim.covered()); if (sim.covered()) set(h.cover, 'NOISE COVER: ' + String(sim.coverName).toUpperCase());
  h.alarm.classList.toggle('show', sim.alarmT !== null);
  const R = sim.rules;
  if (R.time) { const left = R.time - sim.t; set(h.timer, fmtTime(left)); h.timer.classList.toggle('low', left < 15); h.timer.style.display = ''; } else if (sim.clock) { set(h.timer, sim.clock(sim)); h.timer.style.display = ''; } else h.timer.style.display = 'none';
  // radio messages fade out
  const now = sim.t;
  for (let i = h.msg.children.length - 1; i >= 0; i--) { const c = h.msg.children[i]; if (now > c._until) c.classList.add('out'); if (now > c._until + 0.6) h.msg.removeChild(c); }
};
Game.pushMsg = function (who, text, dur) {
  const G = Game, h = G.hud;
  const hintMsg = who === 'hint';
  if (hintMsg) { for (let i = h.msg.children.length - 1; i >= 0; i--) if (h.msg.children[i].classList.contains('hintbox')) h.msg.removeChild(h.msg.children[i]); const c = el('div', 'hintbox', text); c._until = G.sim.t + (dur || 9); h.msg.insertBefore(c, h.msg.firstChild); while (h.msg.children.length > 2) h.msg.removeChild(h.msg.lastChild); return; }
  const c = el('div', 'radio', '<b>' + esc(who) + '</b><span>' + text + '</span>');
  c._until = G.sim.t + (dur || 5);
  h.msg.appendChild(c);
  while (h.msg.children.length > 2) h.msg.removeChild(h.msg.firstChild);
};
Game.banner = function (text, cls) { const b = Game.hud.banner; b.className = 'h-banner show ' + (cls || ''); b.innerHTML = text; clearTimeout(b._t); b._t = setTimeout(() => { b.className = 'h-banner'; }, 1700); };

// ---- starting and ending a mission -------------------------------------------------
Game.start = function (missionId, opts) {
  const G = Game; opts = opts || {};
  const M = MISSION_BY_ID[missionId];
  const gunId = opts.gun || Save.data.equipped;
  const cfg = opts.cfg || (Save.data.guns[gunId] && Save.data.guns[gunId].cfg) || defaultConfig(gunId);
  const st = buildStats(gunId, cfg);
  G.mission = M; G.lastStart = { missionId, opts: Object.assign({}, opts, { gun: gunId, cfg }) };
  G.sim = new Sim(M, st, opts.vantage || 0, { flags: Save.data.flags, shotSeed: opts.shotSeed });
  G.view.fx = []; G.view.assist = Save.data.settings.assist; G.view.pax = undefined; G.view.hold = null; G.view.rangeInfo = null; G.view.bdcCache = null;
  G.scale = 1; G.paused = false; G.endShown = false; G.state = 'mission'; G.fireHeld = false;
  document.body.classList.add('in-mission');
  const h = G.hud;
  h.obj.innerHTML = '<b>' + esc(M.title) + '</b><span>' + esc(typeof M.objective === 'function' ? M.objective(Save.data.flags) : M.objective) + '</span>';
  h.msg.innerHTML = ''; h.fade.className = 'h-fade in';
  h.sZero.classList.toggle('dial', !!st.scope.turret);
  h.zoom.style.display = st.zoomMax > st.zoomMin ? '' : 'none';
  h.sHold.style.display = Save.data.settings.assist === 'veteran' && !st.scope.smart ? 'none' : '';
  setTimeout(() => { h.fade.className = 'h-fade'; }, 60);
  Sfx.missionStart(G.sim);
  G.resize();
};
Game.stop = function () {
  const G = Game;
  G.state = 'menu'; G.sim = null; document.body.classList.remove('in-mission');
  if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();
  Sfx.missionEnd();
};
Game.pause = function (on) {
  const G = Game;
  if (G.state !== 'mission' || !G.sim || G.sim.state !== 'play') return;
  G.paused = on;
  if (on) { if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock(); UI.notebook(G.sim); Sfx.duck(true); }
  else { UI.closeOverlay(); Sfx.duck(false); }
};

// ---- the loop ------------------------------------------------------------------------
Game.loop = function (ts) {
  const G = Game;
  requestAnimationFrame(G.loop);
  let dt = Math.min(0.05, (ts - G.last) / 1000 || 0.016); G.last = ts;
  if (G.state !== 'mission' || !G.sim) { UI.tick && UI.tick(dt); return; }
  const sim = G.sim;
  if (G.paused) { return; }
  // slow motion while a long shot is in the air
  let want = 1;
  if (Save.data.settings.slowmo) {
    const flying = sim.bullets.find((b) => b.alive);
    if (flying && (sim.S.refZ - sim.eye0.z) / sim.st.v0 > 0.42 && sim.t - flying.t0 > 0.12) want = 0.34;
    if (sim.t < G.slowUntil) want = Math.min(want, 0.3);
    if (sim.winAt && sim.t < sim.winAt - 1.6) want = Math.min(want, 0.45);
  }
  G.scale += (want - G.scale) * Math.min(1, dt * (want < G.scale ? 14 : 5));
  const sdt = dt * G.scale;
  if (sim.state === 'play') {
    // keyboard nudging for fine aim on a computer
    const k = G.keys, nud = (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0), nudY = (k.ArrowUp ? 1 : 0) - (k.ArrowDown ? 1 : 0);
    if (nud || nudY) sim.moveAim(nud * dt * 60 / sim.sh.zoom, nudY * dt * 60 / sim.sh.zoom);
    let left = sdt; while (left > 1e-5) { const s = Math.min(left, 1 / 120); sim.step(s); left -= s; }
  }
  // hand events to the picture and the sound
  if (sim.ev.length) {
    const evs = sim.ev; sim.ev = [];
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      G.view.onEvent(e, sim); Sfx.onEvent(e, sim);
      if (e.k === 'msg') G.pushMsg(e.who, e.text, e.dur);
      else if (e.k === 'kill' && e.how === 'shot' && Save.data.settings.slowmo) G.slowUntil = sim.t + 0.5;
      else if (e.k === 'alarm') G.banner('ALARM RAISED', 'bad');
      else if (e.k === 'duck') G.banner('RUBBER DUCK FOUND', 'good');
      else if (e.k === 'nobreath') G.hud.breath.classList.add('shake'), setTimeout(() => G.hud.breath.classList.remove('shake'), 300);
      else if (e.k === 'end') G.finish();
    }
  }
  G.view.updateReadout(sim, dt);
  G.view.draw(sim, dt, sdt);
  G.updateHud(dt);
  Sfx.tick(sim, dt, G.scale);
};
Game.finish = function () {
  const G = Game, sim = G.sim;
  if (G.endShown) return; G.endShown = true;
  if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();
  G.hud.fade.className = 'h-fade out';
  Sfx.result(sim.result.win);
  setTimeout(() => { const res = sim.result, M = G.mission, last = G.lastStart; G.stop(); UI.results(M, res, last); }, 1100);
};

// ---- controls ---------------------------------------------------------------------------
Game.aimDelta = function (dxPx, dyPx, speed) {
  const G = Game, sim = G.sim; if (!sim || sim.state !== 'play' || G.paused) return;
  const ppm = G.view.ppm(sim.sh.zoom), sens = Save.data.settings.sens;
  // slow finger = fine control, fast finger = cover ground
  const acc = clamp(0.5 + speed / 700, 0.5, 1.7);
  const inv = Save.data.settings.invert ? -1 : 1;
  sim.moveAim(-(dxPx / ppm) * sens * acc * inv, (dyPx / ppm) * sens * acc * inv);
};
Game.fire = function () { const G = Game; if (G.sim && G.state === 'mission' && !G.paused) { Sfx.unlock(); G.sim.fire(); } };
Game.zoomBy = function (f) { const s = Game.sim; if (s) s.setZoom(s.sh.zoomT * f); };
Game.zoomTo = function (u) { const s = Game.sim; if (s) s.setZoom(s.st.zoomMin * Math.pow(s.st.zoomMax / s.st.zoomMin, clamp(u, 0, 1))); };

Game.bindInput = function () {
  const G = Game, h = G.hud, stage = G.stage;
  const ptrs = new Map();
  stage.addEventListener('contextmenu', (e) => e.preventDefault());
  const onCtl = (t) => t.closest && t.closest('.h-ctl,.h-zoom,.h-btn,.zbtn,.ui,.overlay');
  stage.addEventListener('pointerdown', (e) => {
    if (G.state !== 'mission' || G.paused) return;
    Sfx.unlock();
    if (onCtl(e.target)) return;
    if (e.pointerType === 'mouse') {
      if (e.button === 0) { if (!G.locked && stage.requestPointerLock && !G.touch) { try { stage.requestPointerLock(); } catch (er) { /* fine */ } G.mouseAim = true; if (G.clickArms) { G.clickArms = false; return; } } G.fire(); }
      else if (e.button === 2) G.sim.holdBreath(!G.sim.sh.holding);
      return;
    }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp });
    if (ptrs.size === 2) { const a = [...ptrs.values()]; G.pinch = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), z: G.sim.sh.zoomT }; }
    e.preventDefault();
  });
  stage.addEventListener('pointermove', (e) => {
    if (G.state !== 'mission' || G.paused) return;
    if (e.pointerType === 'mouse') {
      if (G.locked || (e.buttons === 0 && G.mouseAim)) G.aimDelta(-e.movementX * 1.1, -e.movementY * 1.1, 500);
      return;
    }
    const p = ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y, dtm = Math.max(1, e.timeStamp - p.t);
    p.x = e.clientX; p.y = e.clientY; p.t = e.timeStamp;
    if (ptrs.size >= 2 && G.pinch) { const a = [...ptrs.values()]; const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); G.sim.setZoom(G.pinch.z * Math.pow(d / Math.max(20, G.pinch.d), 1.3)); return; }
    G.aimDelta(dx, dy, (Math.hypot(dx, dy) / dtm) * 1000);
    e.preventDefault();
  });
  const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) G.pinch = null; };
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
  document.addEventListener('pointerlockchange', () => { G.locked = document.pointerLockElement === stage; if (!G.locked && G.state === 'mission' && !G.paused && G.sim && G.sim.state === 'play' && G.wasLocked) G.pause(true); G.wasLocked = G.locked; });
  stage.addEventListener('wheel', (e) => { if (G.state !== 'mission' || G.paused) return; e.preventDefault(); G.zoomBy(e.deltaY < 0 ? 1.14 : 1 / 1.14); }, { passive: false });

  // buttons: press, not release, so the shot breaks the instant you touch
  const press = (elm, fn, rel) => {
    elm.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Sfx.unlock(); elm.classList.add('down'); fn(e); });
    const r = (e) => { elm.classList.remove('down'); if (rel) rel(e); };
    elm.addEventListener('pointerup', r); elm.addEventListener('pointercancel', r); elm.addEventListener('pointerleave', r);
  };
  press(h.fire, () => G.fire());
  press(h.breath, () => { if (G.sim) G.sim.holdBreath(!G.sim.sh.holding); });
  press(h.reload, () => { if (G.sim) G.sim.reload(); });
  press(h.pause, () => G.pause(true));
  press(h.sZero.querySelector('.zminus'), () => { if (G.sim) G.sim.dial(-1); });
  press(h.sZero.querySelector('.zplus'), () => { if (G.sim) G.sim.dial(1); });
  // zoom slider: drag up for more magnification
  const zt = h.zoom;
  const zset = (e) => { const r = zt.querySelector('.zt').getBoundingClientRect(); G.zoomTo(1 - (e.clientY - r.top) / r.height); };
  zt.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); zt.setPointerCapture(e.pointerId); zt._d = true; zset(e); });
  zt.addEventListener('pointermove', (e) => { if (zt._d) zset(e); });
  const zr = () => { zt._d = false; }; zt.addEventListener('pointerup', zr); zt.addEventListener('pointercancel', zr);

  window.addEventListener('keydown', (e) => {
    G.keys[e.key] = true;
    if (G.state !== 'mission') return;
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { G.pause(!G.paused); e.preventDefault(); return; }
    if (G.paused || !G.sim) return;
    if (e.key === 'Shift') { if (!e.repeat) G.sim.holdBreath(true); }
    else if (e.key === 'r' || e.key === 'R') G.sim.reload();
    else if (e.key === ' ') { if (!e.repeat) G.fire(); e.preventDefault(); }
    else if (e.key === 'q' || e.key === 'Q' || e.key === '[') G.sim.dial(e.ctrlKey ? -4 : -1);
    else if (e.key === 'e' || e.key === 'E' || e.key === ']') G.sim.dial(e.ctrlKey ? 4 : 1);
    else if (e.key === '=' || e.key === '+') G.zoomBy(1.15);
    else if (e.key === '-' || e.key === '_') G.zoomBy(1 / 1.15);
  });
  window.addEventListener('keyup', (e) => { G.keys[e.key] = false; if (e.key === 'Shift' && G.sim && G.state === 'mission') G.sim.holdBreath(false); });
  window.addEventListener('blur', () => { G.keys = {}; if (G.state === 'mission' && !G.paused && G.sim && G.sim.state === 'play' && !Game.noAutoPause) G.pause(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'mission' && !G.paused && G.sim && G.sim.state === 'play' && !Game.noAutoPause) G.pause(true); });
};
