// ---------------------------------------------------------------------------
// Kill cam director: a workshop for the owner to set the kill camera's angles himself.
//
// It plays one real kill (a contract, a rifle, a target and the part hit, all fixed so it plays the
// same every time) and gives the film a timeline: play, pause, slow, a frame at a time, and a slider
// to go anywhere in it. Going back re-runs the same shot off screen and fast-forwards to the moment
// (the game is deterministic, so it is the same film).
//
// Free camera (from the end of the bullet chase on: the swing, the X-ray, the fall): one finger drags
// round the body, a pinch goes in and out, two fingers slide along the round's line, a slider sets
// the lens. KEY stores the camera at this moment; the film glides between keys. Keys are kept in this
// browser, and COPY gives them as text to paste to the developer.
//
// The camera is stored round the round's own line (angle round it, height, distance, how far along
// the line it looks, lens), with times counted from the moment the round touches the skin, so a cut
// made on this kill fits every kill. Settings has "Use my kill cam cut" to play it in the game.
// ---------------------------------------------------------------------------
const Director = CB.Director = { on: false, keys: [], free: {}, mode: 'free', playing: false, rate: 1, len: 14 };
const DIR_SHOT = { m: 'c1m1', gun: 'fenwick', tid: 't', part: 'torso', at: 0.8 };
const DIR_STORE = 'coldbore.kccut.v1';
Director.load = function () { try { const j = JSON.parse(localStorage.getItem(DIR_STORE) || 'null'); if (j && Array.isArray(j.keys)) Director.keys = j.keys; } catch (e) { /* none saved */ } };
Director.save = function () { try { localStorage.setItem(DIR_STORE, JSON.stringify({ keys: Director.keys })); } catch (e) { /* storage off */ } };
Director.load();

// ---- the camera from keys ----
// Three kinds of camera, one for each part of the film, each with its own clock:
//   rifle   the trigger and the muzzle (a flat close-up): z zoom, fx where along the rifle (0 butt to
//           1 muzzle), cy height on screen (share), tilt (radians); clock: the film's time
//   flight  the chase behind the round: lat beside it, up above it, back behind it (metres), lens,
//           sx and sy where the target sits on screen (shares); clock: how far through the flight (0 to 1)
//   body    from the swing on: phi round the round's line (degrees, 0 from behind it), el up, R metres
//           away, s metres along the line, lens; clock: seconds from the round touching the skin
Director.part = function (K) { return K.stage === 0 ? 'rifle' : K.stage === 1 ? 'flight' : 'body'; };
Director.clock = function (K, part) { return part === 'rifle' ? K.T : part === 'flight' ? (K.fu || 0) : K.T - (K.Td || 0); };
Director.camAt = function (keys, part, x) {
  const L = (keys || []).filter((k) => (k.part || 'body') === part); if (!L.length) return null;
  if (x <= L[0].t) return L[0]; if (x >= L[L.length - 1].t) return L[L.length - 1];
  for (let i = 1; i < L.length; i++) if (x <= L[i].t) {
    const a = L[i - 1], b = L[i], u = smooth((x - a.t) / Math.max(1e-4, b.t - a.t)), o = {};
    for (const k in a) if (typeof a[k] === 'number') o[k] = k === 'R' ? Math.exp(lerp(Math.log(a[k]), Math.log(b[k]), u)) : lerp(a[k], b[k], u);
    return o;
  }
  return L[L.length - 1];
};
Director.rel = function (K) { return K.T - (K.Td || 0); };
// What camera a part of the film should use now, or null for the game's own.
Director.camFor = function (K, part) {
  if (Director.on) {
    if (Director.mode === 'free') return Director.free[part] || null;
    if (Director.mode === 'cut') return Director.camAt(Director.keys, part, Director.clock(K, part));
    return null;
  }
  if (Save.data && Save.data.settings && Save.data.settings.myCut && Director.keys.length) return Director.camAt(Director.keys, part, Director.clock(K, part));
  return null;
};
// Asked by the kill camera (21c_kcdirect.js) every frame from the swing on: a pose, or null for the usual camera.
Director.poseFor = function (K, V, P) {
  const cam = Director.camFor(K, 'body');
  if (!cam || !K.sw || !K.plan) return null;
  const H = K.plan.H, d = K.dir, o = kcNewOrbit(), fb = 0.55 * Math.max(V.W, V.H) * kcTune.lensX;
  o.fx = H[0] + d[0] * cam.s; o.fy = H[1] + d[1] * cam.s; o.fz = H[2] + d[2] * cam.s;
  o.phi = K.side * cam.phi * kcDeg; o.el = cam.el * kcDeg; o.R = cam.R; o.f = fb * cam.lens; o.ax = 0.5; o.ay = 0.5;
  return kcPoseFromOrbit(K, o, P);
};

// ---- running the shot ----
Director.film = function () { const G = Game, KC = CB.KillCam; return G.cine && KC && KC.active ? KC : null; };
// Start the shot from the beginning and run it up to the moment the film begins (nothing drawn).
Director.restart = function () {
  const S = DIR_SHOT, G = Game;
  Director.quiet(true);
  UI.launch(S.m, { gun: S.gun, cfg: defaultConfig(S.gun), shotSeed: 1 });
  G.endShown = true; // (no results screen when the contract is won: the director stays on the film)
  const s = G.sim; let guard = 0;
  while (s.state === 'play' && s.t < S.at && guard++ < 2000) G.simStep();
  s.rules.kill.forEach((id) => { if (id !== S.tid) { const a = s.byId[id]; if (a) { a.dead = true; a.hidden = true; a.state = 'dead'; } } });
  s.rules.kill = [S.tid]; s.rules.destroy = []; s.rules.until = null; s.rules.done = null; s.rules.protect = []; s.rules.civFail = false;
  if (G.oracle) { const r = G.oracle.s.rules; r.kill = [S.tid]; r.destroy = []; r.until = null; r.done = null; r.protect = []; r.civFail = false; G.oracle.catchUp(1e6); }
  const t = s.byId[S.tid], p = s.partPoint(t, S.part), sol = s.aimFor(p.x, p.y, p.z, { vx: t.goal !== null ? t.vx : 0 });
  s.setZoom(s.st.zoomMax); s.sh.zoom = s.st.zoomMax;
  s.sh.ax = sol.ax - (s.sh.swx + s.sh.recx + s.sh.offx); s.sh.ay = sol.ay - (s.sh.swy + s.sh.recy + s.sh.offy);
  G.fire();
  // step the world until the kill camera takes the picture
  guard = 0;
  while (!G.cine && G.sim && G.sim.state === 'play' && guard++ < 600) {
    G.simStep();
    if (G.oracle) { G.oracle.catchUp(2.5); if (G.oracle.last) { const pr = G.oracle.last; G.oracle.last = null; if (G.startCine(pr)) break; } }
  }
  Director.quiet(false);
  return !!Director.film();
};
// One step of the film (as the game loop does it), drawn or not.
Director.step = function (dt, draw) {
  const G = Game, KC = Director.film(); if (!KC) return false;
  const until = KC.advance(dt); let guard = 0;
  while (G.sim && G.sim.state === 'play' && G.sim.t + SIM_STEP <= until + 1e-9 && guard++ < 60) G.simStep();
  G.pumpEvents();
  if (KC.done) { Director.ended = true; return false; }
  if (draw) KC.draw(dt);
  return true;
};
// Go to film time T (seconds from the film's start).
Director.seek = function (T) {
  let KC = Director.film();
  if (!KC || Director.ended || T < KC.T - 1e-6) { Director.ended = false; if (!Director.restart()) return; KC = Director.film(); }
  Director.quiet(true);
  let guard = 0; while (KC.T < T - 1e-6 && guard++ < 3000) { if (!Director.step(1 / 60, false)) break; }
  Director.quiet(false);
  if (Director.film()) Director.film().draw(0);
};
// While stepping without drawing, the sound and the kill camera's sound beats stay quiet.
Director.quiet = function (on) {
  const X = CB.Sfx; if (!X) return;
  if (on) { if (!Director._kc) { Director._kc = X.kc; Director._tick = X.tick; X.kc = () => {}; X.tick = () => {}; } }
  else if (Director._kc && !Director.playing) { /* stays quiet: the director is silent unless playing */ }
};
// Measure how long the film runs, once.
Director.measure = function () {
  Director.restart(); let KC = Director.film(), guard = 0;
  while (KC && guard++ < 4000 && Director.step(1 / 60, false)) KC = Director.film();
  Director.len = Math.max(4, (KC ? KC.T : 12));
  Director.ended = true;
};

// ---- called by the game loop while the director is open ----
Director.tick = function (dt) {
  const KC = Director.film();
  if (!KC) { Director.ui(); return; }
  if (Director.playing) { if (!Director.step(dt * Director.rate, true)) { Director.playing = false; } }
  else KC.draw(0);
  Director.ui();
};

// ---- the screen ----
Director.open = function () {
  UI.closeOverlay();
  Director.on = true; Director.mode = 'free'; Director.playing = false; Director.ended = true;
  Director.quiet(true);
  Director.measure();
  Director.seek(Math.max(0, Director.len * 0.45));
  const KC = Director.film();
  // each part's free camera starts as the game's own the first time it is touched (see grab)
  Director.free = {}; void KC;
  Director.build();
};
Director.close = function () {
  Director.on = false; Director.playing = false;
  const X = CB.Sfx; if (X && Director._kc) { X.kc = Director._kc; X.tick = Director._tick; Director._kc = null; }
  if (Director.el) { Director.el.remove(); Director.el = null; }
  Game.stop(); UI.hub();
};
Director.build = function () {
  if (Director.el) Director.el.remove();
  const el = document.createElement('div'); el.id = 'director';
  el.innerHTML = `<style>
    #director{position:fixed;inset:0;z-index:60;pointer-events:none;font:600 12px var(--mono,monospace);color:#eef}
    #director .bar{position:absolute;left:max(10px,env(safe-area-inset-left));right:max(10px,env(safe-area-inset-right));pointer-events:auto;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
    #director .top{top:max(6px,env(safe-area-inset-top))} #director .bot{bottom:max(6px,env(safe-area-inset-bottom))}
    #director button{background:rgba(10,14,20,.85);color:#eef;border:1px solid rgba(140,170,200,.45);border-radius:8px;padding:7px 10px;font:inherit;min-height:34px}
    #director button.on{background:#ffb84a;color:#111;border-color:#ffb84a} #director .t{background:rgba(10,14,20,.85);padding:7px 9px;border-radius:8px;min-width:96px;text-align:center}
    #director .tl{flex:1;position:relative;height:34px;min-width:160px} #director .tl input{width:100%;height:34px;margin:0}
    #director .km{position:absolute;top:0;width:3px;height:9px;background:#ffb84a;border-radius:2px;pointer-events:none}
    #director .lens{display:flex;align-items:center;gap:4px;background:rgba(10,14,20,.85);padding:2px 8px;border-radius:8px} #director .lens input{width:80px}
    #director .help{position:absolute;right:12px;top:52px;max-width:260px;background:rgba(10,14,20,.8);padding:8px 10px;border-radius:8px;font:500 11px system-ui,sans-serif;line-height:1.35;pointer-events:none}
    #director textarea{position:absolute;left:10%;right:10%;top:20%;height:40%;pointer-events:auto;background:#0b0e13;color:#dfe;border:1px solid #ffb84a;border-radius:8px;font:11px monospace}
  </style>
  <div class="bar top">
    <button data-d="exit">Exit</button>
    <button data-d="mode" data-v="free">Free cam</button><button data-d="mode" data-v="cut">My cut</button><button data-d="mode" data-v="game">Game's camera</button>
    <span class="lens">Lens <input type="range" min="0.5" max="2.5" step="0.05" value="1" data-d="lens"></span>
    <button data-d="key">Key</button><button data-d="del">Delete key</button><button data-d="clear">Clear all</button><button data-d="copy">Copy my cut</button>
  </div>
  <div class="help">TRIGGER: drag moves the frame along the rifle, pinch zooms, two fingers sideways tilt. CHASE: drag puts the camera beside or above the round, pinch goes further behind, two fingers sideways move where the target sits. BODY: drag circles, pinch goes in and out, two fingers slide along the bullet's line. KEY saves the camera at this moment in that part; MY CUT plays your keys. Keys: <b class="nk">0</b></div>
  <div class="bar bot">
    <button data-d="back">&#9664;&#9664;</button><button data-d="prev">-1f</button><button data-d="play">Play</button><button data-d="next">+1f</button>
    <button data-d="rate">1x</button><span class="t">0.00 s</span>
    <span class="tl"><input type="range" min="0" step="0.01" value="0" data-d="scrub"><span class="kms"></span></span>
  </div>`;
  document.body.appendChild(el); Director.el = el;
  const q = (s) => el.querySelector(s), scrub = q('[data-d=scrub]');
  scrub.max = Director.len.toFixed(2);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-d]'); if (!b) return;
    const a = b.dataset.d, KC = Director.film();
    if (a === 'exit') Director.close();
    else if (a === 'mode') { Director.mode = b.dataset.v; }
    else if (a === 'play') { if (Director.ended || !KC) Director.seek(0); Director.playing = !Director.playing; }
    else if (a === 'rate') { Director.rate = Director.rate === 1 ? 0.25 : Director.rate === 0.25 ? 0.1 : 1; b.textContent = Director.rate + 'x'; }
    else if (a === 'next') { Director.playing = false; Director.step(1 / 60, true); }
    else if (a === 'prev') { Director.playing = false; if (KC) Director.seek(Math.max(0, KC.T - 1 / 60)); }
    else if (a === 'back') { Director.playing = false; Director.seek(0); }
    else if (a === 'key' && KC) {
      const part = Director.part(KC), cam = Director.grab(KC, part), t = +Director.clock(KC, part).toFixed(4), k = Object.assign({ part, t }, cam), eps = part === 'flight' ? 0.004 : 0.02;
      Director.keys = Director.keys.filter((x) => (x.part || 'body') !== part || Math.abs(x.t - t) > eps).concat([k]).sort((x, y) => (x.part === y.part ? x.t - y.t : 0)); Director.save();
      UI.toast('Key: ' + ({ rifle: 'trigger and muzzle', flight: 'bullet chase', body: 'through the body' })[part] + ' at ' + (part === 'flight' ? Math.round(t * 100) + '% of the flight' : t.toFixed(2) + ' s'), 'good');
    } else if (a === 'del' && KC) {
      const part = Director.part(KC), t = Director.clock(KC, part); let bi = -1, bd = 1e9; Director.keys.forEach((x, i) => { if ((x.part || 'body') !== part) return; const dd = Math.abs(x.t - t); if (dd < bd) { bd = dd; bi = i; } });
      if (bi >= 0) { Director.keys.splice(bi, 1); Director.save(); UI.toast('Key removed'); }
    } else if (a === 'clear') { if (b.dataset.sure) { Director.keys = []; Director.save(); b.textContent = 'Clear all'; delete b.dataset.sure; } else { b.dataset.sure = '1'; b.textContent = 'Tap again to clear'; } }
    else if (a === 'copy') {
      const txt = 'KILLCAM CUT ' + JSON.stringify(Director.keys.map((k) => { const o = {}; for (const f in k) o[f] = typeof k[f] === 'number' ? +k[f].toFixed(4) : k[f]; return o; }));
      const show = () => { let ta = q('textarea'); if (!ta) { ta = document.createElement('textarea'); el.appendChild(ta); ta.addEventListener('click', () => ta.select()); } ta.value = txt; ta.select(); };
      try { navigator.clipboard.writeText(txt).then(() => UI.toast('Copied. Paste it in the chat.', 'good'), show); } catch (er) { show(); }
      show();
    }
  });
  scrub.addEventListener('input', () => { Director.playing = false; Director.scrubTo = +scrub.value; });
  scrub.addEventListener('change', () => { Director.seek(+scrub.value); Director.scrubTo = null; });
  q('[data-d=lens]').addEventListener('input', (e) => { const KC = Director.film(); if (!KC) return; const part = Director.part(KC), c = Director.grab(KC, part); if (part === 'rifle') c.z = +e.target.value * 2; else c.lens = +e.target.value; Director.mode = 'free'; });
  // the free camera: gestures on the picture
  const pts = new Map(); let pinch = null;
  const stage = Game.stage;
  const down = (e) => {
    if (!Director.on) return; e.stopPropagation(); e.preventDefault(); const hp = el.querySelector('.help'); if (hp) hp.style.display = 'none';
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const KC = Director.film(); if (KC && pts.size === 2) { const part = Director.part(KC), F = Director.grab(KC, part), [a, b] = [...pts.values()]; Director.mode = 'free'; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, F0: Object.assign({}, F) }; }
  };
  const move = (e) => {
    if (!Director.on || !pts.has(e.pointerId)) return; const p = pts.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    const KC = Director.film(); if (!KC) return; const part = Director.part(KC), F = Director.grab(KC, part), W = window.innerWidth; Director.mode = 'free';
    if (pts.size === 1) {
      if (part === 'body') { F.phi = F.phi - dx * 0.35; F.el = clamp(F.el + dy * 0.25, -80, 85); }
      else if (part === 'rifle') { F.fx = clamp(F.fx - dx / (W * F.z), -0.1, 1.1); F.cy = clamp(F.cy + dy / window.innerHeight, 0, 1); }
      else { const k = 0.0015 * Math.max(0.15, F.back); F.lat = clamp(F.lat - dx * k, -3, 3); F.up = clamp(F.up + dy * k, -1.5, 3); }
    } else if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, k = pinch.d / Math.max(10, d), sl = mx - pinch.mx, F0 = pinch.F0;
      if (part === 'body') { F.R = clamp(F0.R * k, 0.15, 12); F.s = clamp(F0.s + sl * -0.002 * F.R, -3, 3); }
      else if (part === 'rifle') { F.z = clamp(F0.z / k, 0.5, 6); F.tilt = clamp(F0.tilt + sl * 0.002, -0.6, 0.6); }
      else { F.back = clamp(F0.back * k, 0.05, 6); F.sx = clamp(F0.sx + sl / W, 0, 1); }
    }
  };
  const up = (e) => { if (Director.on) e.stopPropagation(); pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
  Director.gest = { down, move, up };
  stage.addEventListener('pointerdown', down, true); stage.addEventListener('pointermove', move, true); stage.addEventListener('pointerup', up, true); stage.addEventListener('pointercancel', up, true);
  stage.addEventListener('wheel', (e) => { if (!Director.on) return; e.preventDefault(); Director.free.R = clamp(Director.free.R * (e.deltaY > 0 ? 1.1 : 0.9), 0.15, 12); }, { passive: false });
};
// The free camera for a part, made from the game's own camera at this moment the first time it is touched.
Director.grab = function (K, part) {
  if (!Director.free[part]) {
    if (part === 'rifle') Director.free.rifle = Object.assign({ z: 2, fx: 0.5, cy: 0.5, tilt: 0 }, K._gameRifle || {});
    else if (part === 'flight') Director.free.flight = Object.assign({ lat: 0.3, up: 0.15, back: 0.3, lens: 1.5, sx: 0.6, sy: 0.45 }, K._gameFlight || {});
    else { const e = K.rec && K.rec.entry; Director.free.body = { phi: e ? e[0] : 84, el: e ? e[1] : 9, R: 1.2, s: 0, lens: 1 }; }
  }
  return Director.free[part];
};
// Keep the controls in step with the film.
Director.ui = function () {
  const el = Director.el; if (!el) return;
  const KC = Director.film(), T = KC ? KC.T : 0;
  el.querySelector('.t').textContent = T.toFixed(2) + ' s' + (KC ? '  ·  ' + ({ rifle: 'TRIGGER', flight: 'CHASE', body: 'BODY' })[Director.part(KC)] : '');
  const sc = el.querySelector('[data-d=scrub]'); if (Director.scrubTo === null || Director.scrubTo === undefined) sc.value = T.toFixed(2);
  el.querySelector('[data-d=play]').textContent = Director.playing ? 'Pause' : 'Play';
  el.querySelectorAll('[data-d=mode]').forEach((b) => b.classList.toggle('on', b.dataset.v === Director.mode));
  el.querySelector('.nk').textContent = Director.keys.length;
  const kms = el.querySelector('.kms'), sig = Director.keys.map((k) => k.t).join(',') + '|' + (KC ? KC.Td : 0);
  // key marks on the timeline (a chase key sits where that share of the flight falls in this film)
  const at = (k) => (k.part === 'rifle' ? k.t : k.part === 'flight' ? (KC.Ta || 0) + k.t * (KC.Tf || 0) : k.t + (KC.Td || 0));
  if (kms._sig !== sig && KC) { kms._sig = sig; kms.innerHTML = Director.keys.map((k) => '<i class="km" style="left:' + clamp((at(k) / Director.len) * 100, 0, 100).toFixed(1) + '%;background:' + ({ rifle: '#6fd0ff', flight: '#9cff7a' })[k.part] + '"></i>').join(''); }
};
