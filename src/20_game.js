// ---------------------------------------------------------------------------
// The game loop, the in-mission display, and the controls.
// ---------------------------------------------------------------------------
const Game = CB.Game = {
  state: 'menu', sim: null, view: null, mission: null, last: 0, scale: 1, touch: false, mode: 'portrait',
  aimPtr: null, pinch: null, keys: {}, locked: false, paused: false, endShown: false, hud: {},
  acc: 0, cine: false, slowT: 0, oracle: null, safe: { l: 0, r: 0, t: 0, b: 0 },
};
const SIM_STEP = 1 / 120; // the world always moves in steps of this size, which is what makes a shot predictable

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
  if (!G.resK) G.resK = 1;
  G.W = W; G.H = H;
  G.mode = H >= W * 1.05 ? 'portrait' : 'wide';
  document.body.classList.toggle('portrait', G.mode === 'portrait');
  document.body.classList.toggle('landscape', G.mode !== 'portrait');
  // how far the notch, the camera island and the home bar push in from each edge
  const cs = getComputedStyle(document.documentElement), px = (k) => parseFloat(cs.getPropertyValue(k)) || 0;
  G.safe = { l: px('--sal'), r: px('--sar'), t: px('--sat'), b: px('--sab') };
  const dpr = Math.max(0.75, Math.min(window.devicePixelRatio || 1, Save.data && Save.data.settings.lowRes ? 1.25 : 2) * G.resK);
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
  h.sWind = mk('cell', '<i>WIND M/S</i><b>--</b>', h.strip);
  h.sHold = mk('cell cell-hold', '<i>HOLD (MILS)</i><b>--</b>', h.strip);
  h.sZero = mk('cell cell-zero', '<i>ZERO</i><div class="zrow"><span class="zbtn zminus">&minus;</span><b>100</b><span class="zbtn zplus">+</span></div>', h.strip);
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
  // the coach's card on a guided run (hidden otherwise)
  h.coach = mk('h-coach', '<div class="cc-eb"></div><div class="cc-hd"></div><div class="cc-tx"></div>');
};
Game.placeHud = function () {
  const G = Game, h = G.hud, V = G.view, W = G.W, Hh = G.H;
  if (!h.top) return;
  const P = (e, o) => { for (const k in o) e.style[k] = typeof o[k] === 'number' ? o[k] + 'px' : o[k]; };
  if (G.mode === 'portrait') {
    const sb = V.cy + V.R; // bottom of the scope
    const small = Hh < 720;
    P(h.strip, { left: 8, right: 8, top: sb + 14, width: 'auto', bottom: 'auto' });
    // On a guided run the coach's card sits under the read-outs and the radio moves down below it.
    // On a short phone there is no room down there, so the card takes the objective's place at the top.
    const top = small && G.coach;
    P(h.pills, { left: 0, right: 0, top: top ? G.safe.t + 96 : V.cy - V.R + 10, width: 'auto' });
    P(h.coach, top ? { left: 58, right: 8, top: G.safe.t + 6, width: 'auto', bottom: 'auto' } : { left: 12, right: 12, top: sb + 62, width: 'auto', bottom: 'auto' });
    P(h.msg, { left: 12, right: 12, top: sb + (G.coach && !top ? 150 : 64), width: 'auto', bottom: 'auto' });
    document.body.classList.toggle('coach-top', !!top);
    const zt = Math.max(sb + 172, Hh - 226);
    P(h.zoom, { left: 14, top: zt, height: Math.max(120, Hh - zt - 22), bottom: 'auto', right: 'auto' });
    document.body.classList.toggle('short', small);
    if (small) {
      P(h.fire, { right: 16, bottom: 22, width: 100, height: 100, left: 'auto', top: 'auto' });
      P(h.breath, { right: 126, bottom: 18, width: 74, height: 74, left: 'auto', top: 'auto' });
      P(h.reload, { right: 26, bottom: 134, width: 54, height: 54, left: 'auto', top: 'auto' });
      P(h.ammo, { left: 70, bottom: 26, right: 'auto', top: 'auto' });
    } else {
      P(h.fire, { right: 20, bottom: 34, width: 118, height: 118, left: 'auto', top: 'auto' });
      P(h.breath, { right: 150, bottom: 26, width: 86, height: 86, left: 'auto', top: 'auto' });
      P(h.reload, { right: 34, bottom: 168, width: 66, height: 66, left: 'auto', top: 'auto' });
      P(h.ammo, { right: 112, bottom: 180, left: 'auto', top: 'auto' });
    }
  } else {
    // Sideways: the picture is the whole screen. Read-outs sit along the bottom between the
    // thumbs, zoom under the left thumb, fire under the right, messages top right.
    document.body.classList.remove('short'); document.body.classList.remove('coach-top');
    const sf = G.safe, L = sf.l, Rt = sf.r, B = Math.min(sf.b, 14), small = Hh < 430;
    const fire = small ? 104 : 118, br = small ? 76 : 84, rl = small ? 56 : 62;
    P(h.fire, { right: Rt + 16, bottom: B + 16, width: fire, height: fire, left: 'auto', top: 'auto' });
    P(h.breath, { right: Rt + 16 + fire + 14, bottom: B + 12, width: br, height: br, left: 'auto', top: 'auto' });
    P(h.reload, { right: Rt + 22, bottom: B + 16 + fire + 12, width: rl, height: rl, left: 'auto', top: 'auto' });
    P(h.ammo, { right: Rt + 22 + rl + 12, bottom: B + 16 + fire + 18, left: 'auto', top: 'auto' });
    P(h.zoom, { left: L + 12, top: 62, height: Math.max(110, Hh - 62 - B - 16), bottom: 'auto', right: 'auto' });
    const sl = L + 74, sr = G.touch ? Rt + 16 + fire + 14 + br + 12 : Rt + 150;
    P(h.strip, { left: sl, top: 'auto', bottom: B + (G.touch ? 8 : 30), width: Math.max(250, Math.min(470, W - sl - sr)), right: 'auto' });
    // On a guided run the coach's card takes the place of the objective line, top left beside
    // the notebook button, well clear of the middle of the picture. The pills drop below it.
    const cw = Math.max(220, Math.min(320, W * 0.36));
    P(h.coach, { left: L + 64, top: sf.t + 6, width: cw, right: 'auto', bottom: 'auto' });
    P(h.pills, { left: V.cx - 150, width: 300, right: 'auto', top: G.coach ? sf.t + 100 : 50 });
    P(h.msg, { right: Rt + 10, top: 54, width: Math.min(270, W * 0.3), left: 'auto', bottom: 'auto' });
  }
};

Game.updateHud = function (dt) {
  const G = Game, h = G.hud, sim = G.sim, sh = sim.sh, st = sim.st, V = G.view, A = Save.data.settings.assist;
  const set = (e, s) => { if (e._s !== s) { e._s = s; e.innerHTML = s; } };
  const r = V.rangeInfo, canRange = A !== 'veteran' || st.scope.lrf;
  set(h.sRange.lastChild, canRange ? (r && r.d ? Math.round(r.d) + (r.d >= 1000 ? 'm' : ' m') : 'sky') : 'by eye');
  const w = sim.wind(), aw = Math.abs(w);
  set(h.sWind.lastChild, A === 'veteran' && !st.scope.smart ? 'read it' : (aw < 0.25 ? 'calm' : '<span class="warr">' + (w > 0 ? '&rarr;' : '&larr;') + '</span> ' + fmt(aw, 1)));
  let hold = '--';
  if ((A !== 'veteran' || st.scope.smart) && V.hold && V.hold.ok && r && r.d) {
    const up = V.hold.up, rt = V.hold.right;
    const us = Math.abs(up) < 0.15 ? 'dead on' : (up > 0 ? '&uarr;' : '&darr;') + fmt(Math.abs(up), 1);
    const ws = Math.abs(rt) < 0.15 ? '' : ' ' + (rt > 0 ? '&rarr;' : '&larr;') + fmt(Math.abs(rt), 1);
    hold = us + ws;
  } else if (V.hold && !V.hold.ok) hold = 'out of reach';
  set(h.sHold.lastChild, hold);
  set(h.sZero.querySelector('b'), st.scope.turret ? String(sh.zeroR) : sh.zeroR + ' m');
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
  set(h.fire.firstChild, sh.reloadT > 0 ? 'RELOADING' : sh.ammo <= 0 ? 'EMPTY' : sh.chargeT > 0 ? 'CHARGING' : G.coach && G.coach.out && G.coach.out.fire ? 'FIRE<br>NOW' : 'FIRE');
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
  if (G.coach) G.coachHud(set);
};
// The coach's card, and a glow on whichever button it is asking for.
Game.coachHud = function (set) {
  const h = Game.hud, o = Game.coach.out; if (!o) return;
  const k = o.kind;
  set(h.coach.children[0], 'Guided run  &middot;  shot ' + Math.min(o.shot, o.shots) + ' of ' + o.shots);
  set(h.coach.children[1], esc(o.head) + (o.count !== null ? ' <em>' + Math.ceil(o.count) + '</em>' : ''));
  set(h.coach.children[2], esc(o.text || ''));
  const cls = 'h-coach k-' + k + (o.fire ? ' fire' : '') + (o.text ? '' : ' notext');
  if (h.coach.className !== cls) h.coach.className = cls;
  h.fire.classList.toggle('go', !!o.fire);
  h.breath.classList.toggle('go', k === 'hold');
  h.reload.classList.toggle('go', k === 'reload');
  h.sZero.classList.toggle('go', k === 'dial');
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
  const simOpts = { flags: Save.data.flags, shotSeed: opts.shotSeed === undefined ? (Date.now() & 0xffffff) : opts.shotSeed };
  G.sim = new Sim(M, st, opts.vantage || 0, simOpts);
  // a shadow copy of the mission that can be run ahead to see where a shot will land
  G.oracle = null;
  if (Save.data.settings.killcam && CB.KillCam) { try { G.oracle = new Oracle(M, st, opts.vantage || 0, simOpts).attach(G.sim); } catch (e) { G.oracle = null; } }
  // a guided run: the coach reads the mission's own three-star script and shows each step
  G.coach = null;
  if (opts.guided) { try { G.coach = new Coach(G.sim); } catch (e) { G.coach = null; if (window.console) console.error(e); } }
  document.body.classList.toggle('guided', !!G.coach);
  G.hud.coach.className = 'h-coach'; ['fire', 'breath', 'reload', 'sZero'].forEach((k) => G.hud[k].classList.remove('go'));
  G.acc = 0; G.cine = false; G.slowT = 0; G.gunId = gunId; G.cfg = cfg; document.body.classList.remove('cine');
  G.view.fx = []; G.view.assist = Save.data.settings.assist; G.view.pax = undefined; G.view.hold = null; G.view.pip = null; G.view.rangeInfo = null; G.view.bdcCache = null;
  G.scale = 1; G.paused = false; G.endShown = false; G.state = 'mission'; G.fireHeld = false; G.view.gore = Save.data.settings.gore !== false;
  document.body.classList.add('in-mission');
  const h = G.hud;
  h.obj.innerHTML = '<b>' + esc(M.title) + '</b><span>' + esc(typeof M.objective === 'function' ? M.objective(Save.data.flags) : M.objective) + '</span>';
  h.msg.innerHTML = ''; h.fade.className = 'h-fade in';
  h.sZero.classList.toggle('dial', !!st.scope.turret); h.strip.classList.toggle('has-dial', !!st.scope.turret);
  h.zoom.style.display = st.zoomMax > st.zoomMin ? '' : 'none';
  h.sHold.style.display = Save.data.settings.assist === 'veteran' && !st.scope.smart ? 'none' : '';
  setTimeout(() => { h.fade.className = 'h-fade'; }, 60);
  Sfx.missionStart(G.sim);
  G.slowN = 0; G.frames = 0;
  // keep the screen awake while a mission is running, where the browser allows it
  if (navigator.wakeLock && !G.wake) { try { navigator.wakeLock.request('screen').then((w) => { G.wake = w; w.addEventListener('release', () => { G.wake = null; }); }, () => {}); } catch (e) { /* fine */ } }
  G.resize();
};
Game.stop = function () {
  const G = Game;
  G.state = 'menu'; G.sim = null; G.oracle = null; G.coach = null; G.cine = false; document.body.classList.remove('in-mission'); document.body.classList.remove('cine'); document.body.classList.remove('guided');
  if (CB.KillCam && CB.KillCam.active) CB.KillCam.stop();
  if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();
  Sfx.missionEnd();
  if (G.wake) { try { G.wake.release(); } catch (e) { /* fine */ } G.wake = null; }
};
Game.pause = function (on) {
  const G = Game;
  if (G.state !== 'mission' || !G.sim || G.sim.state !== 'play') return;
  if (on && G.cine) { if (CB.KillCam.skip) CB.KillCam.skip(); return; } // never open the notebook over the kill camera
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
  // if the phone is struggling, quietly draw at a lower resolution rather than stutter
  G.slowN = (G.slowN || 0) * 0.98 + (dt > 0.03 ? 1 : 0); G.frames = (G.frames || 0) + 1;
  if (G.slowN > 30 && G.frames > 120 && G.resK > 0.55 && !Game.noAutoPause) { G.resK *= 0.8; G.slowN = 0; G.frames = 0; G.resize(); }
  const KC = CB.KillCam;
  // ---- the kill camera has the picture: it sets the pace, the world follows ----
  if (G.cine && KC && KC.active) {
    const until = KC.advance(dt); let guard = 0;
    while (sim.state === 'play' && sim.t + SIM_STEP <= until + 1e-9 && guard++ < 60) sim.step(SIM_STEP);
    G.pumpEvents();
    if (G.state !== 'mission' || !G.sim) return;
    KC.draw(dt);
    Sfx.tick(sim, dt, clamp(KC.rate === undefined ? 0.2 : KC.rate, 0.05, 1));
    if (KC.done) { KC.stop(); G.cine = false; document.body.classList.remove('cine'); G.scale = 0.22; G.slowT = 0.9; G.view.pax = undefined; }
    return;
  }
  // A brief slow motion as the last target drops (used when the kill camera did not run).
  if (G.slowT > 0) G.slowT -= dt;
  const want = G.slowT > 0 ? 0.3 : 1;
  G.scale += (want - G.scale) * Math.min(1, dt * (want < G.scale ? 14 : 3.2));
  if (Math.abs(G.scale - 1) < 0.01 && want === 1) G.scale = 1;
  if (sim.state === 'play') {
    // keyboard nudging for fine aim on a computer
    const k = G.keys, nud = (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0), nudY = (k.ArrowUp ? 1 : 0) - (k.ArrowDown ? 1 : 0);
    if (nud || nudY) sim.moveAim(nud * dt * 60 / sim.sh.zoom, nudY * dt * 60 / sim.sh.zoom);
    G.acc = Math.min(G.acc + dt * G.scale, 0.1);
    while (G.acc >= SIM_STEP && sim.state === 'play') {
      sim.step(SIM_STEP); G.acc -= SIM_STEP;
      if (G.oracle && G.oracle.last) { // a round has just left the barrel and we know how it ends
        const pr = G.oracle.last; G.oracle.last = null;
        if (G.startCine(pr)) break;
      }
    }
    if (G.oracle) G.oracle.catchUp(2.5);
  }
  G.pumpEvents();
  if (G.state !== 'mission' || !G.sim) return;
  if (G.cine) { KC.draw(0); return; }
  G.view.updateReadout(sim, dt);
  if (G.coach) G.coach.update(); // after the world has moved on, before the picture is drawn
  G.view.draw(sim, dt, dt * G.scale);
  if (G.coach) G.coach.draw(G.view, G.view.rt);
  G.updateHud(dt);
  Sfx.tick(sim, dt, G.scale);
};
// hand what happened in the world to the picture and the sound
Game.pumpEvents = function () {
  const G = Game, sim = G.sim;
  if (!sim.ev.length) return;
  const evs = sim.ev; sim.ev = [];
  for (let i = 0; i < evs.length; i++) {
    const e = evs[i];
    G.view.onEvent(e, sim); Sfx.onEvent(e, sim);
    if (CB.KillCam && CB.KillCam.active && CB.KillCam.onEvent) CB.KillCam.onEvent(e, sim);
    if (e.k === 'msg') G.pushMsg(e.who, e.text, e.dur);
    else if (e.k === 'winning' && !G.cine && sim.kills.length && sim.kills[sim.kills.length - 1].how === 'shot' && sim.t - sim.kills[sim.kills.length - 1].t < 0.1) G.slowT = 0.75;
    else if (e.k === 'alarm') G.banner('ALARM RAISED', 'bad');
    else if (e.k === 'duck') G.banner('RUBBER DUCK FOUND', 'good');
    else if (e.k === 'nobreath') G.hud.breath.classList.add('shake'), setTimeout(() => G.hud.breath.classList.remove('shake'), 300);
    else if (e.k === 'end') G.finish();
  }
};
// Start the kill camera for a shot the oracle says will finish the contract with a hit on a person.
Game.startCine = function (pr) {
  const G = Game, sim = G.sim, KC = CB.KillCam, set = Save.data.settings;
  if (!pr || !KC || !set.killcam || !pr.win || !pr.kills.length || G.cine) return false;
  const k = pr.kills[pr.kills.length - 1], a = sim.byId[k.id], b = sim.bullets[pr.i];
  if (!a || !b) return false;
  let ok = false;
  try { ok = KC.start({ sim, view: G.view, gunId: G.gunId, cfg: G.cfg, bullet: b, path: pr.path, t0: pr.t0, tHit: k.t, hit: k, actor: a, kills: pr.kills, gore: set.gore !== false, step: SIM_STEP }) !== false; } catch (e) { ok = false; if (window.console) console.error(e); }
  if (!ok) return false;
  G.cine = true; G.acc = 0; document.body.classList.add('cine');
  return true;
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
  const G = Game, sim = G.sim; if (!sim || sim.state !== 'play' || G.paused || G.cine) return;
  const ppm = G.view.ppm(sim.sh.zoom), sens = Save.data.settings.sens;
  // slow finger = fine control, fast finger = cover ground
  const acc = clamp(0.5 + speed / 700, 0.5, 1.7);
  const inv = Save.data.settings.invert ? -1 : 1;
  sim.moveAim(-(dxPx / ppm) * sens * acc * inv, (dyPx / ppm) * sens * acc * inv);
};
Game.fire = function () { const G = Game; if (G.sim && G.state === 'mission' && !G.paused && !G.cine) { Sfx.unlock(); if (G.sim.fire() && navigator.vibrate) { try { navigator.vibrate(G.sim.st.quiet ? 15 : 35); } catch (e) { /* not supported */ } } } };
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
    if (G.cine) { if (CB.KillCam && CB.KillCam.skip) CB.KillCam.skip(); e.preventDefault(); return; }
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
  // a quick tap on a radio message or a hint closes it early (a drag that starts there still aims)
  let tap = null;
  h.msg.addEventListener('pointerdown', (e) => { const box = e.target.closest && e.target.closest('.radio,.hintbox'); tap = box ? { box, x: e.clientX, y: e.clientY, t: e.timeStamp } : null; });
  h.msg.addEventListener('pointerup', (e) => {
    const T = tap; tap = null;
    if (!T || !G.sim || Math.hypot(e.clientX - T.x, e.clientY - T.y) > 12 || e.timeStamp - T.t > 450) return;
    if (T.box._until > G.sim.t) T.box._until = G.sim.t; // fades out over half a second, then goes
  });
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
    if (G.cine) { if ((e.key === ' ' || e.key === 'Enter') && CB.KillCam.skip) CB.KillCam.skip(); e.preventDefault(); return; }
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
