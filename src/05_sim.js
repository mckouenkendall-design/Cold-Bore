// ---------------------------------------------------------------------------
// The mission simulation. No drawing and no sound in here: it only decides
// what happens. The scope view and the audio engine listen to the events it
// emits. Keeping it separate means the automated tests can play every mission
// thousands of times faster than a person could.
// ---------------------------------------------------------------------------
const WALK = 1.3, RUN = 4.3;

function Sim(M, st, vantageIdx, opts) {
  opts = opts || {};
  const sim = this;
  sim.M = M; sim.st = st; sim.opts = opts;
  sim.flags = opts.flags || {};
  const built = M.setup(K, sim.flags);
  const S = sim.S = built.S; sim.A = built;
  sim.t = 0; sim.ev = []; sim.state = 'play';
  sim.rng = makeRng(hashStr(M.id) + 17);
  sim.shotRng = makeRng(opts.shotSeed === undefined ? (Date.now() & 0xffffff) : opts.shotSeed);
  sim.vantages = M.vantages || [{ name: 'Rooftop', eye: [0, 22, 0] }];
  sim.vi = clamp(vantageIdx || 0, 0, sim.vantages.length - 1);
  const V = sim.vantage = sim.vantages[sim.vi];
  sim.eye0 = { x: V.eye[0], y: V.eye[1], z: V.eye[2] || 0 };
  const W = M.wind || {};
  sim.windBase = (W.v || 0) * (V.windMul === undefined ? 1 : V.windMul); sim.windGust = (W.gust || 0) * (V.windMul === undefined ? 1 : V.windMul);
  sim.rules = Object.assign({ kill: [], destroy: [], protect: [], civFail: true }, M.rules || {});
  sim.actors = []; sim.byId = {}; sim.vehicles = []; sim.bullets = []; sim.kills = []; sim.steam = []; sim.timers = [];
  sim.emitted = {}; sim.msgs = [];
  sim.alarmT = null; sim.coverUntil = -1; sim.coverName = '';
  sim.stats = { shots: 0, hits: 0, heads: 0, misses: 0, panics: 0, breathUsed: false, longest: 0, accident: 0, wounded: 0, glass: 0, objects: 0, duck: false, collateral: 0, firstShotT: null, maxLead: 0 };
  sim.failInfo = null; sim.winAt = null; sim.endAt = null;

  // camera limits for this position, worked out from the scene size
  const b = S.bounds, zr = S.refZ - sim.eye0.z;
  sim.lim = { x0: ((b.x0 - sim.eye0.x) / zr) * 1000, x1: ((b.x1 - sim.eye0.x) / zr) * 1000, y0: ((b.y0 - sim.eye0.y) / zr) * 1000, y1: ((b.y1 - sim.eye0.y) / zr) * 1000 };

  // shooter
  const start = V.look || M.look || [0, 8];
  sim.sh = {
    ax: ((start[0] - sim.eye0.x) / zr) * 1000, ay: ((start[1] - sim.eye0.y) / zr) * 1000, zoom: st.zoomMin, zoomT: st.zoomMin,
    swx: 0, swy: 0, recx: 0, recy: 0, recvx: 0, recvy: 0, offx: 0, offy: 0, move: 0,
    breath: st.breath, holding: false, holdK: 0, exhausted: 0,
    ammo: st.mag, reserve: (M.rules && M.rules.reserve !== undefined) ? M.rules.reserve : st.mag * 3 + (st.mag === 1 ? 9 : 0), cycleT: 0, cycleLen: 0, reloadT: 0, reloadLen: 0, chargeT: 0,
    zeroR: st.zero, zeroAng: st.zeroAng, heart: 0, lastFire: -99, sx: 0, sy: 0, pvx: 0, pvy: 0,
  };
  if (st.scope.turret && M.range && !opts.noAutoZero) { /* player dials it themselves */ }

  // cast
  const cast = M.cast ? M.cast(built, sim.flags) : [];
  cast.forEach((d) => sim.addActor(d));
  (M.vehicles ? M.vehicles(built, sim.flags) : []).forEach((d) => sim.addVehicle(d));
  sim.triggers = (M.triggers ? M.triggers(built, sim.flags) : []).map((t) => Object.assign({ done: false }, t));
  S.objects.forEach((o) => { if (o.kind === 'cctv') o.seenT = 0; });
  if (M.start) M.start(sim, built);
  // A round that misses everything is only followed (and drawn) a little way past the
  // deepest thing in the scene that matters. Beyond that it is out of sight.
  let fz = S.refZ;
  S.planes.forEach((P) => { if (P.solids.length || P.openings.length) fz = Math.max(fz, P.z); });
  sim.actors.forEach((a) => { if (a.plane) fz = Math.max(fz, a.plane.z); });
  S.objects.forEach((o) => { if (o.plane) fz = Math.max(fz, o.plane.z); });
  sim.farStop = fz + 45;
}

Sim.prototype.addActor = function (d) {
  const sim = this;
  const a = Object.assign({
    role: 'civ', look: {}, x: 0, y: 0, face: 1, anim: 'stand', routine: [], pc: 0, state: 'calm', speed: 1,
    t: sim.rng.r(0, 10), ph: sim.rng.r(0, 6), seed: sim.rng.r(0, 10), wait: 0, goal: null, hidden: false, dead: false, gone: false,
    behind: false, room: null, zone: 'street', susp: 0, suspN: 0, react: 0, stack: [], bubble: null, bubbleT: 0, vx: 0,
  }, d);
  if (d.at) Object.assign(a, d.at);
  a.look = Object.assign({}, d.look || {});
  a.idle = a.anim; a.animCur = a.anim; a.animFrom = null; a.animAt = -9; a.faceS = a.face;
  a.routine = (d.routine || []).slice();
  sim.actors.push(a); sim.byId[a.id] = a;
  return a;
};
Sim.prototype.addVehicle = function (d) {
  const v = Object.assign({ kind: 'sedan', x: 0, y: 0, dir: 1, v: 0, col: '#30343c', routine: [], pc: 0, wait: 0, seats: [], st: { glass: [], flat: [], moving: false }, gone: false, goal: null, maxV: 0 }, d);
  v.def = CARS[v.kind];
  this.vehicles.push(v); this.byId[v.id] = v;
  v.seats.forEach((aid, i) => { const a = this.byId[aid]; if (a) { a.inVeh = v; a.seat = i; a.anim = 'drive'; a.plane = v.plane; a.zone = 'veh:' + v.id; } });
  return v;
};

Sim.prototype.emit = function (name) { this.emitted[name] = this.t; this.ev.push({ k: 'emit', name }); };
Sim.prototype.did = function (name) { return this.emitted[name] !== undefined; };
Sim.prototype.msg = function (who, text, dur) { const m = { who, text, t: this.t, dur: dur || Math.max(4, text.length * 0.07) }; this.msgs.push(m); this.ev.push({ k: 'msg', who, text, dur: m.dur }); };
Sim.prototype.after = function (sec, fn) { this.timers.push({ t: this.t + sec, fn }); };
Sim.prototype.cover = function (sec, name) { this.coverUntil = Math.max(this.coverUntil, this.t + sec); this.coverName = name || 'noise'; if (name === 'thunder') this.flashT = this.t; this.ev.push({ k: 'cover', name: this.coverName, dur: sec }); };
Sim.prototype.covered = function () { return this.t < this.coverUntil; };
Sim.prototype.wind = function (t) {
  t = t === undefined ? this.t : t;
  return this.windBase + this.windGust * (0.65 * vnoise(t * 0.11, 31) + 0.35 * vnoise(t * 0.37, 57));
};
Sim.prototype.setRoutine = function (id, routine, keepState) {
  const a = typeof id === 'string' ? this.byId[id] : id; if (!a || a.dead) return;
  a.routine = routine.slice(); a.pc = 0; a.wait = 0; a.goal = null; a.stack = []; a.waitFor = null;
  if (!keepState) a.state = 'calm';
};
Sim.prototype.alive = function (id) { const a = this.byId[id]; return !!a && !a.dead; };
Sim.prototype.fail = function (code, text, delay) {
  if (this.failInfo || this.state !== 'play') return;
  this.failInfo = { code, text }; this.endAt = this.t + (delay === undefined ? 1.6 : delay);
  this.ev.push({ k: 'failing', code });
};

// Where the shooter's eye is. It shifts very slightly as the rifle swings,
// which is what makes the near and far layers slide against each other.
Sim.prototype.eye = function () {
  const sh = this.sh;
  return { x: this.eye0.x + sh.ax * 0.011, y: this.eye0.y + sh.ay * 0.004, z: this.eye0.z };
};
Sim.prototype.aimNow = function () {
  const sh = this.sh;
  return { x: sh.ax + sh.swx + sh.recx + sh.offx, y: sh.ay + sh.swy + sh.recy + sh.offy };
};

// ---- shooter ---------------------------------------------------------------
Sim.prototype.moveAim = function (dx, dy) {
  const sh = this.sh, st = this.st;
  sh.ax = clamp(sh.ax + dx * st.pan, this.lim.x0, this.lim.x1);
  sh.ay = clamp(sh.ay + dy * st.pan, this.lim.y0, this.lim.y1);
  sh.move = Math.min(2.2, sh.move + Math.hypot(dx, dy) * 0.035 * (1.25 - st.handling));
};
Sim.prototype.setZoom = function (z) { this.sh.zoomT = clamp(z, this.st.zoomMin, this.st.zoomMax); };
Sim.prototype.holdBreath = function (on) {
  const sh = this.sh;
  if (on) { if (sh.exhausted > 0 || sh.breath < this.st.breath * 0.2) { this.ev.push({ k: 'nobreath' }); return false; } if (!sh.holding) { sh.holding = true; this.stats.breathUsed = true; this.ev.push({ k: 'breath', on: true }); } }
  else if (sh.holding) { sh.holding = false; this.ev.push({ k: 'breath', on: false }); }
  return sh.holding;
};
Sim.prototype.dial = function (step) {
  const sh = this.sh, st = this.st;
  if (!st.scope.turret) return false;
  const nr = clamp(Math.round((sh.zeroR + step * 25) / 25) * 25, 50, 2200);
  if (nr === sh.zeroR) return false;
  sh.zeroR = nr; sh.zeroAng = Bal.zeroAngle(st, nr); this.ev.push({ k: 'click' });
  return true;
};
Sim.prototype.reload = function () {
  const sh = this.sh, st = this.st;
  if (sh.reloadT > 0 || sh.ammo >= st.mag || sh.reserve <= 0 || sh.chargeT > 0) return false;
  sh.reloadT = sh.reloadLen = st.reload; this.ev.push({ k: 'reload', dur: st.reload, action: st.action });
  return true;
};
Sim.prototype.canFire = function () { const sh = this.sh; return this.state === 'play' && sh.cycleT <= 0 && sh.reloadT <= 0 && sh.ammo > 0 && sh.chargeT <= 0; };
Sim.prototype.fire = function () {
  const sim = this, sh = sim.sh, st = sim.st;
  if (sim.state !== 'play') return false;
  if (sh.reloadT > 0 || sh.cycleT > 0 || sh.chargeT > 0) return false;
  if (sh.ammo <= 0) { sim.ev.push({ k: 'dry' }); if (sh.reserve > 0) sim.reload(); return false; }
  if (st.action === 'charge') { sh.chargeT = 0.85; sim.ev.push({ k: 'charge', dur: 0.85 }); return true; }
  sim._shoot();
  return true;
};
Sim.prototype._shoot = function () {
  const sim = this, sh = sim.sh, st = sim.st, R = sim.shotRng;
  const aim = sim.aimNow(), eye = sim.eye();
  const ja = R.f() * TAU, jm = st.jerk * (sh.holding ? 0.55 : 1) * R.f();
  const ax = aim.x + R.gauss() * st.disp * 0.5 + Math.cos(ja) * jm, ay = aim.y + sh.zeroAng + R.gauss() * st.disp * 0.5 + Math.sin(ja) * jm;
  const b = Bal.launch(st.v0, ax, ay);
  b.x += eye.x; b.y += eye.y; b.z += eye.z;
  b.alive = true; b.t0 = sim.t; b.trail = [[b.x, b.y, b.z]]; b.id = ++sim.stats.shots; b.walls = 0; b.aim = { x: aim.x, y: aim.y }; b.ox = eye.x; b.oy = eye.y; b.oz = eye.z;
  sim.bullets.push(b);
  if (sim.stats.firstShotT === null) sim.stats.firstShotT = sim.t;
  sh.ammo--; sh.lastFire = sim.t;
  sh.cycleT = sh.cycleLen = st.cycle;
  // recoil: a sharp kick up and slightly sideways that springs back
  const kick = st.recoil * (0.9 + R.f() * 0.2);
  sh.recvy += kick * 17; sh.recvx += kick * 17 * (R.f() - 0.5) * 0.5;
  sh.ax = clamp(sh.ax + (R.f() - 0.5) * kick * 0.05, sim.lim.x0, sim.lim.x1); sh.ay = clamp(sh.ay + (R.f() - 0.3) * kick * 0.04, sim.lim.y0, sim.lim.y1);
  sh.move = Math.min(2.2, sh.move + kick * 0.05);
  if (sh.holding) sim.holdBreath(false);
  const covered = sim.covered();
  const loud = !st.quiet && !covered;
  sim.ev.push({ k: 'fire', loud, quiet: st.quiet, covered, cal: st.cal, sub: st.subsonic, action: st.action, cycle: st.cycle, recoil: kick, last: sh.ammo === 0 });
  if (loud) {
    const dist = S_dist(sim), delay = dist / SOUND;
    sim.after(delay, () => sim.noiseAll('shot', dist));
  }
  return b;
};
function S_dist(sim) { return sim.S.refZ - sim.eye0.z; }

Sim.prototype.stepShooter = function (dt) {
  const sim = this, sh = sim.sh, st = sim.st, t = sim.t;
  // zoom eases toward its target
  sh.zoom += (sh.zoomT - sh.zoom) * Math.min(1, dt * 9);
  // breath
  if (sh.holding) {
    sh.breath -= dt;
    if (sh.breath <= 0) { sh.breath = 0; sh.holding = false; sh.exhausted = 2.6; sim.ev.push({ k: 'breath', on: false, gasp: true }); }
  } else sh.breath = Math.min(st.breath, sh.breath + dt * 0.85);
  if (sh.exhausted > 0) sh.exhausted -= dt;
  sh.holdK = approach(sh.holdK, sh.holding ? 1 : 0, dt * (sh.holding ? 3.2 : 2.2));
  sh.move *= Math.exp(-dt * (1.1 + 3.2 * st.handling));
  sh.heart = approach(sh.heart, sim.alarmT !== null ? 1 : 0, dt * 0.4);
  // sway = slow breathing drift + faster muscle tremor + a pulse
  const low = sh.holding ? clamp(1 - sh.breath / (st.breath * 0.28), 0, 1) : 0; // lungs burning
  const breathAmp = lerp(1, 0.04, sh.holdK), tremAmp = lerp(1, 0.38 + low * 1.3, sh.holdK);
  const amp = st.sway * (1 + sh.move * 1.3) * (1 + sh.heart * 0.35) * (sh.exhausted > 0 ? 1.75 : 1);
  const bx = Math.sin(t * 0.83 + 1.1) * 0.42, by = Math.sin(t * 1.66);
  const tx = vnoise(t * 2.1, 3) * 0.5 + vnoise(t * 5.7, 11) * 0.22, ty = vnoise(t * 2.4, 5) * 0.5 + vnoise(t * 6.3, 13) * 0.22;
  const beat = Math.pow(Math.max(0, Math.sin(t * (6.0 + sh.heart * 3 + low * 2))), 12) * (0.1 + low * 0.25 + sh.heart * 0.1);
  sh.swx = amp * (bx * breathAmp + tx * tremAmp);
  sh.swy = amp * (by * breathAmp + ty * tremAmp + beat);
  // recoil spring
  const w = 11 - Math.min(5, st.recoil * 0.2), z = 0.62;
  sh.recvx += (-w * w * sh.recx - 2 * z * w * sh.recvx) * dt; sh.recvy += (-w * w * sh.recy - 2 * z * w * sh.recvy) * dt;
  sh.recx += sh.recvx * dt; sh.recy += sh.recvy * dt;
  // working the action nudges the rifle
  let ox = 0, oy = 0;
  if (sh.cycleT > 0) {
    sh.cycleT -= dt;
    if (st.action === 'bolt') { const u = 1 - clamp(sh.cycleT / sh.cycleLen, 0, 1); const e = Math.sin(clamp((u - 0.18) / 0.72, 0, 1) * Math.PI); ox = e * 1.6 * Math.sin(u * 9); oy = e * (2.2 + st.recoil * 0.08); }
    if (sh.cycleT <= 0 && sh.ammo <= 0 && sh.reserve > 0 && sh.reloadT <= 0) sim.reload();
  }
  if (sh.reloadT > 0) {
    sh.reloadT -= dt; const u = 1 - clamp(sh.reloadT / sh.reloadLen, 0, 1), e = Math.sin(u * Math.PI);
    oy -= e * 14; ox += e * 5 * Math.sin(u * 5);
    if (sh.reloadT <= 0) { const need = st.mag - sh.ammo, take = Math.min(need, sh.reserve); sh.ammo += take; sh.reserve -= take; sim.ev.push({ k: 'reloaded' }); }
  }
  sh.offx = ox; sh.offy = oy;
  if (sh.chargeT > 0) { sh.chargeT -= dt; if (sh.chargeT <= 0) { sh.chargeT = 0; sim._shoot(); } }
};

// ---- noise and awareness -------------------------------------------------------
Sim.prototype.noiseAll = function (kind, dist) {
  // an unsuppressed shot heard across the whole scene
  const sim = this, st = sim.st;
  if (sim.state !== 'play' && !sim.winAt) return;
  const alarmR = st.noise, suspR = st.noise * 1.7;
  if (dist <= alarmR) {
    sim.ev.push({ k: 'heard', loud: true });
    if (sim.winAt) { // the job is already done by the time the bang arrives: people scatter, but it no longer matters
      // Anyone who actually SAW it happen still counts as a witness; only people who merely heard the bang are let off.
      sim.heardAfter = true; const p0 = sim.stats.panics;
      sim.actors.forEach((a) => { if (a.dead || a.gone || a.sawKill || (a.state !== 'calm' && a.state !== 'susp')) return; sim.startle(a, 'shot'); a.react = 99; });
      sim.stats.panics = p0; return;
    }
    sim.actors.forEach((a) => { if (a.dead || a.gone) return; sim.startle(a, 'shot'); });
    sim.raiseAlarm('shot', 0.4);
  } else if (dist <= suspR) {
    sim.actors.forEach((a) => { if (!a.dead && !a.gone) sim.suspect(a, 3.5); });
  }
};
Sim.prototype.noise = function (x, y, plane, kind, radius, srcActor) {
  const sim = this;
  sim.actors.forEach((a) => {
    if (a.dead || a.gone || a === srcActor || a.inVeh) return;
    let r = radius; if (a.room && sim.S.rooms[a.room] && kind !== 'boom' && kind !== 'npcshot') r *= 0.6;
    const d = Math.hypot(a.x - x, (a.y - y) * 0.7);
    if (d > r) return;
    if (kind === 'scream' || kind === 'boom' || kind === 'npcshot') sim.startle(a, kind);
    else if (kind === 'impact') { if (d < 3.2) sim.startle(a, 'impact'); else sim.suspect(a, 3); }
    else if (kind === 'lure') sim.investigate(a, x);
    else if (kind === 'crash') { if (a.role === 'guard' || a.role === 'civ') sim.investigate(a, x, 6); else sim.suspect(a, 4); }
    else sim.suspect(a, kind === 'crack' ? 3.5 : 2.5);
  });
};
Sim.prototype.bubble = function (a, s, dur) { a.bubble = s; a.bubbleT = this.t + (dur || 1.8); };
Sim.prototype.suspect = function (a, dur) {
  if (a.dead || a.gone || a.state === 'panic' || a.state === 'alarm' || a.state === 'flee' || a.state === 'alert' || a.deaf) return;
  a.suspN++;
  if (a.role === 'guard' && a.suspN >= 3) { this.startle(a, 'susp'); return; }
  a.state = 'susp'; a.susp = Math.max(a.susp, dur); this.bubble(a, '?', dur);
};
Sim.prototype.investigate = function (a, x, wait) {
  if (a.dead || a.gone || a.state !== 'calm' && a.state !== 'susp') return;
  if (a.curious === false || a.room || a.inVeh || a.role === 'hostage') { this.suspect(a, 3); return; }
  if (a.stack.length) return;
  a.stack.push({ routine: a.routine, pc: a.pc, wait: a.wait, goal: a.goal, anim: a.anim, x: a.x });
  a.routine = [['wait', 0.7, 'stand'], ['walk', x + (a.x < x ? -1.2 : 1.2)], ['wait', wait || 4.5, 'stand'], ['walk', a.x], ['back']];
  a.pc = 0; a.wait = 0; a.goal = null; a.state = 'calm'; this.bubble(a, '?', 2);
  this.ev.push({ k: 'lured', id: a.id });
};
// Something frightening happened right in front of this person.
Sim.prototype.startle = function (a, why) {
  const sim = this;
  if (a.dead || a.gone || a.state === 'panic' || a.state === 'alarm' || a.state === 'flee' || a.state === 'alert') return;
  if (a.role === 'hostage') { a.anim = 'cower'; return; }
  a.goal = null; a.wait = 0; a.stack = []; a.waitFor = null;
  sim.bubble(a, '!', 2.5);
  if (a.role === 'guard') {
    a.state = 'alarm'; a.react = a.reactT || (sim.radioDown ? 5.5 : 1.7); a.anim = 'aimrifle';
    sim.ev.push({ k: 'spotted', id: a.id, role: a.role });
  } else if (a.role === 'civ' || a.role === 'vip') {
    a.state = 'panic'; a.react = 0.9; sim.stats.panics++;
    sim.ev.push({ k: 'scream', id: a.id });
    sim.after(0.5, () => { if (!a.dead) sim.noise(a.x, a.y, a.plane, 'scream', 16, a); });
    sim.beginFlee(a);
  } else { // targets and hostiles run for it and call it in
    a.state = 'flee'; a.react = 1.0;
    sim.ev.push({ k: 'spotted', id: a.id, role: a.role });
    sim.beginFlee(a);
  }
};
Sim.prototype.beginFlee = function (a) {
  const sim = this;
  if (a.threat) a.threat.t = Math.min(a.threat.t, 1.2);
  if (a.flee) { a.routine = a.flee.slice(); a.pc = 0; return; }
  if (a.inVeh) { const v = a.inVeh; if (v.seats[0] === a.id || true) { v.maxV = Math.max(v.maxV, 16); v.routine = [['drive', v.dir > 0 ? 400 : -400, 17], ['gone']]; v.pc = 0; v.wait = 0; v.goal = null; } return; }
  if (a.room || a.behind) { a.routine = [['wait', a.role === 'civ' ? 0.3 : 1.1, a.role === 'civ' ? 'cower' : 'run'], a.role === 'civ' ? ['wait', 999, 'cower'] : ['duck']]; a.pc = 0; return; }
  let ex = sim.S.exits[0], best = 1e9;
  sim.S.exits.forEach((e) => { const d = Math.abs(e - a.x); if (d < best) { best = d; ex = e; } });
  a.routine = [['run', ex], ['gone']]; a.pc = 0;
};
Sim.prototype.raiseAlarm = function (by, delay) {
  const sim = this;
  if (sim.alarmT !== null || sim.alarmPending) return;
  sim.alarmPending = true;
  sim.after(delay || 0, () => {
    if (sim.alarmT !== null) return;
    if (sim.winAt && (by === 'explosion' || by === 'shot' || by === 'vehicle')) { sim.alarmPending = false; sim.lateAlarm = by; return; }
    sim.alarmT = sim.t; sim.alarmBy = by;
    sim.ev.push({ k: 'alarm', by });
    sim.emit('alarm');
    sim.actors.forEach((a) => {
      if (a.dead || a.gone) return;
      if (a.role === 'guard') { if (a.state !== 'alarm') { a.state = 'alert'; a.anim = 'aimrifle'; a.goal = null; a.routine = [['wait', 999, 'aimrifle']]; a.pc = 0; a.wait = 0; a.stack = []; } }
      else if (a.role === 'target' || a.role === 'hostile') { if (a.state !== 'flee' && a.calmOnAlarm !== true) { a.state = 'flee'; a.goal = null; a.wait = 0; a.stack = []; sim.bubble(a, '!', 2); sim.beginFlee(a); } }
      else if (a.role === 'civ' && a.state !== 'panic') { a.state = 'panic'; a.goal = null; a.wait = 0; a.stack = []; sim.beginFlee(a); }
    });
    if (sim.rules.strict && !sim.winAt) sim.fail('alarm', sim.rules.strictText || 'The alarm went up. The job needed to stay quiet.', 1.4);
    if (sim.M.onAlarm) sim.M.onAlarm(sim, sim.A);
  });
};

Sim.prototype.canSee = function (o, x, y, zone) {
  const sim = this, S = sim.S;
  if (o.hidden || o.dead || o.gone || o.blind) return false;
  if (o.zone !== zone) { const sg = sim.M.sight && sim.M.sight[o.zone]; if (!sg || sg.indexOf(zone) < 0) return false; }
  else if (Math.abs(y - o.y) > 3.5) return false;
  const dx = x - o.x, adx = Math.abs(dx);
  const lit = S.isLit(zone, x);
  const range = lit ? (o.role === 'guard' || o.state === 'susp' ? 32 : 24) * (o.eyes || 1) * (S.seeMul || 1) : 4;
  if (adx > range) return false;
  if (adx > 2.6 && sign(dx) !== o.face && o.state !== 'susp') return false;
  for (let i = 0; i < sim.steam.length; i++) { const s = sim.steam[i]; if (s.until > sim.t && s.x > Math.min(o.x, x) - 1 && s.x < Math.max(o.x, x) + 1) return false; }
  return true;
};
Sim.prototype.perceive = function () {
  const sim = this, bodies = sim.actors.filter((a) => a.dead && !a.bodyGone && !a.hidden && sim.t - a.deathAtT > 0.25);
  if (!bodies.length) return;
  sim.actors.forEach((o) => {
    if (o.dead || o.gone || o.hidden || o.inVeh || (o.state !== 'calm' && o.state !== 'susp')) return;
    if (o.role === 'hostage') return;
    for (let i = 0; i < bodies.length; i++) {
      const bd = bodies[i];
      if (o.seen && o.seen[bd.id]) continue;
      if (!sim.canSee(o, bd.x, bd.y, bd.zone)) continue;
      (o.seen = o.seen || {})[bd.id] = true;
      bd.found = true;
      if (bd.accident) { sim.ev.push({ k: 'gawk', id: o.id }); if (o.role === 'civ' || o.role === 'guard') sim.investigate(o, bd.x, 7); else sim.suspect(o, 4); }
      else { sim.ev.push({ k: 'bodyfound', id: o.id, body: bd.id }); sim.startle(o, 'body'); }
      return;
    }
  });
  // cameras
  sim.S.objects.forEach((c) => {
    if (c.kind !== 'cctv' || !c.alive || c.tripped) return;
    for (let i = 0; i < bodies.length; i++) {
      const bd = bodies[i];
      if (bd.accident || bd.zone !== c.zone || Math.abs(bd.x - c.x) > (c.range || 14)) continue;
      c.tripped = true; sim.ev.push({ k: 'camera', id: c.id }); sim.raiseAlarm('camera', c.delay || 2.2);
    }
  });
};

// ---- people ----------------------------------------------------------------
Sim.prototype.place = function (a, p) {
  ['plane', 'room', 'behind', 'zone', 'x', 'y', 'face'].forEach((k) => { if (p[k] !== undefined) a[k] = p[k]; });
  if (p.room === undefined && p.plane) { a.room = null; }
  if (p.behind === undefined && p.plane) a.behind = !!p.room;
};
// One person, one step. The wrapper notes when the pose or the facing changes so the
// figure can ease from one to the other instead of snapping (see actorJoints).
Sim.prototype.stepActor = function (a, dt) {
  this.stepActorCore(a, dt);
  if (a.anim !== a.animCur) { a.animFrom = a.animCur; a.animCur = a.anim; a.animAt = a.t; }
  if (!a.dead) a.faceS = approach(a.faceS === undefined ? a.face : a.faceS, a.face, dt * 9);
};
Sim.prototype.stepActorCore = function (a, dt) {
  const sim = this;
  a.t += dt;
  if (a.dead) { a.deadT += dt; return; }
  if (a.gone) return;
  if (a.inVeh) { const v = a.inVeh, c = v.def; a.x = v.x + v.dir * c.seats[a.seat] * c.len; a.y = v.y + (c.body + c.h) / 2 - 1.2; a.face = v.dir; a.hidden = v.gone; if (v.gone && !a.dead) sim.leave(a); return; }
  if (a.yFn) a.y = a.yFn(a.x);
  // timers for people who have noticed something
  if (a.state === 'susp') {
    a.susp -= dt; a.anim = 'stand'; a.face = Math.sin(a.t * 3.4 + a.seed) > 0 ? 1 : -1;
    if (a.susp <= 0) { a.state = 'calm'; a.anim = a.idle; if (a.faceHome) a.face = a.faceHome; }
    return;
  }
  if (a.state === 'alarm') { // guard reaching for the radio
    a.react -= dt; a.face = Math.sin(a.t * 5) > 0 ? 1 : -1;
    if (sim.radioDown && sim.M.alarmX !== undefined && !a.room) { const dx = sim.M.alarmX - a.x; if (Math.abs(dx) > 0.6) { a.anim = 'run'; a.face = sign(dx); a.x += sign(dx) * RUN * dt; a.ph += dt * 11; } else a.react = Math.min(a.react, 0.2); }
    if (a.react <= 0) { sim.raiseAlarm('guard'); a.state = 'alert'; a.routine = [['wait', 999, 'aimrifle']]; a.pc = 0; }
    return;
  }
  if ((a.state === 'panic' || a.state === 'flee') && a.react > 0) { a.react -= dt; if (a.react <= 0) sim.raiseAlarm(a.role === 'civ' ? 'witness' : 'target'); }
  if (a.threat) {
    a.threat.t -= dt; a.anim = 'aim';
    const v = sim.byId[a.threat.id]; if (v) a.face = sign(v.x - a.x) || 1;
    if (a.threat.t <= 0) { const tid = a.threat.id; a.threat = null; if (v && !v.dead) { sim.ev.push({ k: 'npcshot', x: a.x, y: a.y }); sim.killActor(v, 'torso', 'npc', null); sim.noise(a.x, a.y, a.plane, 'npcshot', 60, a); sim.emit('executed:' + tid); } }
    return;
  }
  // moving toward a goal
  if (a.goal !== null) {
    const sp = (a.running ? RUN : WALK) * a.speed * (a.wounded ? 0.6 : 1), dx = a.goal - a.x, stepd = sp * dt;
    a.face = sign(dx) || a.face; a.vx = a.face * sp;
    a.anim = a.running ? (a.state === 'panic' ? 'panic' : 'run') : 'walk';
    a.ph += dt * sp * (a.running ? 2.6 : 4.3);
    if (Math.abs(dx) <= stepd) { a.x = a.goal; a.goal = null; a.vx = 0; a.anim = a.idle; }
    else a.x += sign(dx) * stepd;
    return;
  }
  a.vx = 0;
  if (a.wait > 0) { a.wait -= dt; if (a.wait > 0) return; }
  if (a.waitFor) { if (sim.did(a.waitFor)) a.waitFor = null; else return; }
  // next instruction
  let guard = 0;
  while (guard++ < 12) {
    const op = a.routine[a.pc];
    if (!op) { a.anim = a.idle; return; }
    a.pc++;
    switch (op[0]) {
      case 'walk': a.goal = op[1]; a.running = false; if (op[2]) a.speed = op[2]; return;
      case 'run': a.goal = op[1]; a.running = true; return;
      case 'wait': a.wait = op[1]; if (op[2]) { a.anim = op[2]; a.idle = op[2]; } else a.anim = a.idle; if (op[3]) a.face = op[3]; return;
      case 'anim': a.anim = a.idle = op[1]; break;
      case 'face': a.face = op[1]; a.faceHome = op[1]; break;
      case 'hide': a.hidden = true; break;
      case 'show': a.hidden = false; break;
      case 'to': sim.place(a, op[1]); break;
      case 'emit': sim.emit(op[1]); break;
      case 'waitFor': a.waitFor = op[1]; if (!sim.did(op[1])) { a.anim = a.idle; return; } a.waitFor = null; break;
      case 'say': sim.bubble(a, op[1], op[2] || 2.5); break;
      case 'loop': a.pc = op[1] || 0; break;
      case 'gone': sim.leave(a); return;
      case 'duck': a.hidden = true; sim.leave(a); return;
      case 'look': Object.assign(a.look, op[1]); break;
      case 'threat': a.threat = { id: op[1], t: op[2] }; sim.ev.push({ k: 'threat', id: a.id }); return;
      case 'call': op[1](sim, a); break;
      case 'speed': a.speed = op[1]; break;
      case 'role': a.role = op[1]; break;
      case 'veh': { const v = sim.byId[op[1]]; a.inVeh = v; a.seat = op[2] || 0; v.seats[a.seat] = a.id; a.anim = 'drive'; a.plane = v.plane; a.room = null; a.behind = false; a.zone = 'veh:' + v.id; return; }
      case 'back': { const s = a.stack.pop(); if (s) { a.routine = s.routine; a.pc = Math.max(0, s.pc - (s.goal !== null ? 1 : 0)); a.wait = s.wait; a.anim = a.idle = s.anim; } break; }
      default: break;
    }
  }
};
Sim.prototype.leave = function (a) {
  const sim = this;
  if (a.gone) return;
  a.gone = true; a.hidden = true;
  sim.emit('gone:' + a.id);
  if (!a.dead && sim.rules.kill.indexOf(a.id) >= 0 && !sim.winAt && sim.rules.escapeOk !== true) sim.fail('escaped', a.escapeText || 'The target got away.', 0.8);
};

Sim.prototype.killActor = function (a, part, how, bullet) {
  const sim = this;
  if (a.dead) return;
  a.dead = true; a.deadT = 0; a.deathAtT = sim.t; a.deathPose = a.anim; a.deathAt = a.t; a.deathPh = a.ph; a.bubble = null;
  a.deathHow = how; a.deathPart = part; a.deathDir = bullet ? (bullet.vx >= 0 ? 1 : -1) : 0; // for the artwork only
  const seated = /^(sit|type|drive|sleep|kneel)/.test(a.anim) || a.inVeh;
  a.deathKind = seated ? 'slump' : (sim.rng.chance(0.5) ? 'back' : 'front');
  a.accident = how === 'accident' || (how === 'blast' && sim.rules.blastAccident);
  const wasMoving = a.goal !== null; a.threat = null; a.state = 'dead';
  const k = { id: a.id, role: a.role, part, how, t: sim.t, range: bullet ? Math.hypot(a.x - bullet.ox, a.plane.z - bullet.oz) : 0, zone: a.zone, accident: a.accident,
    moving: !!(a.inVeh && a.inVeh.v > 2) || (!a.inVeh && wasMoving), lit: sim.S.isLit(a.room && sim.S.rooms[a.room] ? a.room : a.zone, a.x) };
  sim.kills.push(k); a.goal = null;
  if (how === 'shot') { sim.stats.hits++; if (part === 'head') sim.stats.heads++; sim.stats.longest = Math.max(sim.stats.longest, k.range); }
  if (a.accident) sim.stats.accident++;
  sim.ev.push({ k: 'kill', id: a.id, part, how, x: a.x, y: a.y, plane: a.plane, role: a.role });
  sim.emit('dead:' + a.id);
  if (a.inVeh && a.seat === 0) { const v = a.inVeh; v.routine = [['brake']]; v.pc = 0; v.goal = null; v.crashed = true; sim.emit('crash:' + v.id); }
  // was that someone we were not supposed to hurt?
  const R = sim.rules;
  if (how !== 'npc') {
    if (R.protect.indexOf(a.id) >= 0 || a.role === 'hostage' || a.role === 'vip') sim.fail('protect', a.failText || 'You killed the person you were there to protect.');
    else if (a.role === 'civ' && R.civFail) sim.fail('civ', a.failText || 'You shot a bystander. The contract is void.');
    else if (R.spare && R.spare.indexOf(a.id) >= 0) sim.fail('spare', a.failText || 'That one was not to be touched.');
    else if (R.noKills && R.kill.indexOf(a.id) < 0) sim.fail('nokill', R.noKillsText || 'Nobody was supposed to die on this one.');
    else if (a.role === 'guard' && R.noGuards) sim.fail('guard', R.noGuardsText || 'The guards were off limits.');
    else if (R.accidentOnly && R.kill.indexOf(a.id) >= 0 && !a.accident) sim.fail('messy', R.accidentText || 'It had to look like an accident. A bullet hole does not.');
  } else if (R.protect.indexOf(a.id) >= 0 || a.role === 'hostage' || a.role === 'vip') {
    sim.fail('lost', a.lostText || 'You were too slow. They are gone.');
  }
  // anyone watching?
  sim.actors.forEach((o) => {
    if (o === a || o.dead || o.gone || o.inVeh || o.hidden || o.role === 'hostage') return;
    if (o.state !== 'calm' && o.state !== 'susp') return;
    if (!sim.canSee(o, a.x, a.y, a.zone)) return;
    (o.seen = o.seen || {})[a.id] = true; a.found = true;
    if (a.accident) { if (o.role === 'civ' || o.role === 'guard') sim.investigate(o, a.x, 7); else sim.suspect(o, 4); sim.ev.push({ k: 'gawk', id: o.id }); }
    else { o.sawKill = true; sim.after(0.3 + sim.rng.r(0, 0.3), () => { sim.ev.push({ k: 'bodyfound', id: o.id, body: a.id }); sim.startle(o, 'saw'); }); }
  });
};
Sim.prototype.woundActor = function (a, part, bullet) {
  const sim = this;
  sim.stats.wounded++; a.wounded = true;
  sim.ev.push({ k: 'wound', id: a.id, x: a.x, y: a.y, plane: a.plane });
  if (a.role === 'hostage') { sim.fail('protect', 'You hit the hostage.'); return; }
  if (a.role === 'civ' && sim.rules.civFail) { sim.fail('civ', 'You wounded a bystander. The contract is void.'); }
  sim.noise(a.x, a.y, a.plane, 'scream', 18, a);
  a.state = 'calm'; sim.startle(a, 'hit'); a.react = Math.min(a.react || 0.6, 0.6);
};

// ---- vehicles ----------------------------------------------------------------
Sim.prototype.stepVehicle = function (v, dt) {
  const sim = this;
  if (v.gone) return;
  if (v.yFn) v.y = v.yFn(v.x);
  if (v.goal !== null) {
    const dx = v.goal - v.x; v.dir = sign(dx) || v.dir;
    const want = v.flatTire ? 0 : v.maxV;
    v.v = approach(v.v, want, dt * (v.flatTire ? 9 : 5));
    v.st.moving = v.v > 0.3;
    const stepd = v.v * dt;
    if (v.flatTire && v.v <= 0.01) { v.goal = null; v.stopped = true; sim.emit('stopped:' + v.id); return; }
    if (Math.abs(dx) <= stepd + 0.01) { v.x = v.goal; v.goal = null; v.v = v.keepV ? v.v : 0; v.st.moving = false; }
    else v.x += sign(dx) * stepd;
    return;
  }
  if (v.wait > 0) { v.wait -= dt; if (v.wait > 0) return; }
  if (v.waitFor) { if (sim.did(v.waitFor)) v.waitFor = null; else return; }
  let guard = 0;
  while (guard++ < 8) {
    const op = v.routine[v.pc]; if (!op) return; v.pc++;
    if (op[0] === 'drive') { v.goal = op[1]; v.maxV = op[2] || 8; const nx = v.routine[v.pc]; v.keepV = nx && (nx[0] === 'drive' || nx[0] === 'gone'); return; }
    if (op[0] === 'wait') { v.wait = op[1]; v.v = 0; return; }
    if (op[0] === 'waitFor') { v.waitFor = op[1]; if (!sim.did(op[1])) return; v.waitFor = null; }
    else if (op[0] === 'emit') sim.emit(op[1]);
    else if (op[0] === 'gone') { v.gone = true; sim.emit('gone:' + v.id); v.seats.forEach((id) => { const a = sim.byId[id]; if (a && !a.dead && a.inVeh === v) sim.leave(a); }); return; }
    else if (op[0] === 'brake') { v.goal = v.x + v.dir * Math.max(2, v.v * 0.9); v.maxV = 0; v.flatTire = true; return; }
    else if (op[0] === 'out') { const a = sim.byId[op[1]]; if (a && !a.dead) { a.inVeh = null; a.hidden = false; a.anim = a.idle = 'stand'; sim.place(a, { x: v.x + (op[2] || 0), y: op[5] === undefined ? v.y : op[5], plane: op[4] || v.plane, zone: op[3] || 'street', room: null, behind: false }); v.seats[a.seat] = null; } }
    else if (op[0] === 'call') op[1](sim, v);
    else if (op[0] === 'loop') v.pc = op[1] || 0;
  }
};

// ---- bullets -----------------------------------------------------------------
Sim.prototype.groundAt = function (x, z) {
  const pl = this.S.planes;
  let g = 0, mat = this.S.groundMat, bz = 1e12;
  for (let i = 0; i < pl.length; i++) { const P = pl[i]; if (P.groundY === undefined) continue; if (P.z >= z - 0.5 && P.z < bz) { bz = P.z; g = P.groundFn ? P.groundFn(x) : P.groundY; mat = P.groundMat || mat; } }
  return { y: g, mat, found: bz < 1e11 };
};
Sim.prototype.impact = function (b, x, y, P, mat, o) {
  const sim = this;
  o = o || {};
  sim.ev.push({ k: 'impact', x, y, z: P ? P.z : b.z, plane: P, mat, tof: sim.t - b.t0, dist: (P ? P.z : b.z) - b.oz, small: o.small });
  if (P && o.decal !== false && mat !== 'water' && mat !== 'dirt') { sim.S.decals.push({ x, y, plane: P, mat }); if (sim.S.decals.length > 60) sim.S.decals.shift(); }
  if (!o.quiet) sim.noise(x, y, P, 'impact', mat === 'glass' ? 12 : 8);
  sim.crack(b, x, y, P);
};
Sim.prototype.crack = function (b, x, y, P, skip) {
  const st = this.st;
  const v = Math.hypot(b.vx, b.vy, b.vz);
  if (st.quiet && st.crack > 0 && v > SOUND) this.noise(x, y, P, 'crack', st.crack, skip);
};
Sim.prototype.stopBullet = function (b) { b.alive = false; b.endT = this.t; };

Sim.prototype.hitPlane = function (P, b, bx, by) {
  const sim = this, S = sim.S, st = sim.st;
  // 1. shootable objects
  for (let i = 0; i < S.objects.length; i++) {
    const ob = S.objects[i];
    if (ob.plane !== P || ob.r <= 0 || ob.gone) continue;
    if (!ob.alive && !ob.rehit) continue;
    const hit = ob.w ? (bx >= ob.x - ob.w / 2 && bx <= ob.x + ob.w / 2 && by >= ob.y - ob.h / 2 && by <= ob.y + ob.h / 2) : Math.hypot(bx - ob.x, by - ob.y) <= ob.r;
    if (!hit) continue;
    sim.hitObject(ob, b, bx, by);
    if (!ob.pass) { sim.stopBullet(b); return true; }
  }
  // 2. people standing in the open
  for (let i = 0; i < sim.actors.length; i++) {
    const a = sim.actors[i];
    if (a.plane !== P || a.dead || a.gone || a.hidden || a.behind || a.inVeh) continue;
    if (Math.abs(bx - a.x) > 1.3 || by < a.y - 0.2 || by > a.y + 2.4) continue;
    const part = figHit(actorJoints(a), bx - a.x, by - a.y);
    if (part && sim.hitActor(a, part, b, bx, by)) return true;
  }
  // 3. vehicles
  for (let i = 0; i < sim.vehicles.length; i++) {
    const v = sim.vehicles[i];
    if (v.plane !== P || v.gone) continue;
    const c = v.def, lx = (bx - v.x) * v.dir, ly = by - v.y;
    if (lx < -c.len / 2 - 0.1 || lx > c.len / 2 + 0.2 || ly < 0 || ly > c.h) continue;
    if (c.solid) { sim.impact(b, bx, by, P, 'metal', { quiet: true }); sim.stopBullet(b); return true; }
    // tyres
    for (let w = 0; w < 2 && c.wheel; w++) {
      const wx = (w ? 0.31 : -0.31) * c.len;
      if (Math.hypot(lx - wx, ly - c.wheel) <= c.wheel + 0.03) {
        if (!v.st.flat[w]) { v.st.flat[w] = true; v.flatTire = true; sim.ev.push({ k: 'tyre', x: bx, y: by, plane: P }); sim.emit('flat:' + v.id); if (v.goal === null) { v.stopped = true; sim.emit('stopped:' + v.id); } v.routine = []; }
        sim.impact(b, bx, by, P, 'metal', { decal: false, quiet: true }); sim.stopBullet(b); return true;
      }
    }
    let inWin = -1;
    for (let w = 0; w < c.win.length; w++) if (lx >= c.win[w][0] * c.len && lx <= c.win[w][1] * c.len && ly >= c.body + 0.06 && ly <= c.h - 0.14) inWin = w;
    const inBody = ly <= c.body || (lx >= c.cab[0] * c.len && lx <= c.cab[1] * c.len) || (c.box && lx >= c.box[0] * c.len && lx <= c.box[1] * c.len);
    if (inWin < 0 && !inBody) continue;
    let ox = 0, oy = 0;
    if (inWin >= 0) {
      if (!v.st.glass[inWin]) {
        v.st.glass[inWin] = true; sim.stats.glass++; sim.ev.push({ k: 'glass', x: bx, y: by, plane: P });
        if (st.pen < 0.2) { sim.scareVehicle(v); sim.stopBullet(b); return true; }
        if (st.pen < 1) { const an = sim.shotRng.f() * TAU, m = (1 - st.pen) * 0.16; ox = Math.cos(an) * m; oy = Math.sin(an) * m; }
      }
    } else if (st.pen < 1.4) { sim.impact(b, bx, by, P, 'metal', { quiet: true }); sim.scareVehicle(v); sim.stopBullet(b); return true; }
    let got = false;
    for (let s = 0; s < v.seats.length; s++) {
      const a = sim.byId[v.seats[s]]; if (!a || a.dead || a.inVeh !== v) continue;
      const part = figHit(actorJoints(a), bx + ox - a.x, by + oy - a.y);
      if (part === 'head' || part === 'torso' || part === 'arm') { sim.killActor(a, part === 'arm' ? 'torso' : part, 'shot', b); sim.crack(b, bx, by, P, a); got = true; break; }
    }
    sim.scareVehicle(v);
    if (got) { if (st.pen < 1.2) { sim.stopBullet(b); return true; } sim.stats.collateral++; }
    else if (inWin < 0) sim.impact(b, bx, by, P, 'metal', { quiet: true, small: true });
    return false;
  }
  // 4. loads that have already fallen
  for (let i = 0; i < S.props.length; i++) {
    const p = S.props[i];
    if (p.plane !== P || p.gone) continue;
    if (bx >= p.x - p.w / 2 && bx <= p.x + p.w / 2 && by >= p.y && by <= p.y + p.h) { sim.impact(b, bx, by, P, 'wood'); sim.stopBullet(b); return true; }
  }
  // 5. windows and gaps
  for (let i = 0; i < P.openings.length; i++) {
    const op = P.openings[i];
    if (bx < op.x || bx > op.x + op.w || by < op.y || by > op.y + op.h) continue;
    let ox = 0, oy = 0;
    if (op.glass && !op.broken) {
      op.broken = true; sim.stats.glass++;
      sim.ev.push({ k: 'glass', x: bx, y: by, plane: P, op });
      sim.noise(bx, by, P, 'glass', 9);
      sim.emit('glass:' + op.room);
      if (st.pen < 0.2) { sim.crack(b, bx, by, P); sim.stopBullet(b); return true; }
      if (st.pen < 1) { const an = sim.shotRng.f() * TAU, m = (1 - st.pen) * 0.16; ox = Math.cos(an) * m; oy = Math.sin(an) * m; }
    }
    for (let j = 0; j < sim.actors.length; j++) {
      const a = sim.actors[j];
      if (a.plane !== P || a.dead || a.gone || a.hidden || !a.behind || a.room !== op.room || a.inVeh) continue;
      if (Math.abs(bx - a.x) > 1.3) continue;
      const part = figHit(actorJoints(a), bx + ox - a.x, by + oy - a.y);
      if (part && sim.hitActor(a, part, b, bx, by)) return true;
    }
    if (op.through) return false;
    sim.impact(b, bx + ox, by + oy, P, 'interior', { decal: false, quiet: !S.rooms[op.room], small: true });
    // people in the room notice a round coming through
    sim.actors.forEach((a) => { if (!a.dead && !a.gone && a.room === op.room && a.behind) { if (Math.abs(a.x - bx) < 2.5) sim.startle(a, 'impact'); else sim.suspect(a, 3); } });
    sim.stopBullet(b); return true;
  }
  // 6. walls and cover
  for (let i = 0; i < P.solids.length; i++) {
    const s = P.solids[i];
    if (bx < s.x || bx > s.x + s.w || by < s.y || by > s.y + s.h) continue;
    const m = s.mat;
    if (m === 'leaf' || m === 'grid') continue;
    if (m === 'glasswall') { sim.ev.push({ k: 'glass', x: bx, y: by, plane: P }); continue; }
    if ((m === 'thin' || m === 'wood') && st.pen >= 1.4) { sim.impact(b, bx, by, P, m, { small: true }); continue; }
    if (m === 'wall' && st.pen >= 3 && b.walls < 1) { b.walls++; sim.impact(b, bx, by, P, 'wall', { small: true }); continue; }
    sim.impact(b, bx, by, P, m === 'thin' ? 'metal' : m === 'hard' ? 'metal' : m);
    sim.stopBullet(b); return true;
  }
  return false;
};
Sim.prototype.scareVehicle = function (v) {
  const sim = this;
  if (v.scared) return; v.scared = true;
  sim.after(0.35, () => {
    if (sim.winAt) return;
    let any = false; v.seats.forEach((id) => { const a = sim.byId[id]; if (a && !a.dead && a.inVeh === v) any = true; });
    if (!any) return;
    const drv = sim.byId[v.seats[0]];
    if (drv && !drv.dead && !v.flatTire) { v.routine = [['drive', v.dir > 0 ? 500 : -500, 18], ['gone']]; v.pc = 0; v.goal = null; v.wait = 0; v.waitFor = null; }
    sim.raiseAlarm('vehicle', 0.6);
  });
};
Sim.prototype.hitActor = function (a, part, b, bx, by) {
  const sim = this, st = sim.st;
  if (a.vest && part === 'torso' && st.pen < 0.5) { sim.ev.push({ k: 'vest', x: bx, y: by, plane: a.plane }); sim.woundActor(a, part, b); sim.stopBullet(b); return true; }
  if (part === 'head' || part === 'torso') sim.killActor(a, part, 'shot', b);
  else sim.woundActor(a, part, b);
  sim.ev.push({ k: 'hit', x: bx, y: by, plane: a.plane, part, tof: sim.t - b.t0, dist: a.plane.z - b.oz, lethal: part === 'head' || part === 'torso' });
  sim.crack(b, bx, by, a.plane, a);
  if (st.pen >= 1.2 && (part === 'head' || part === 'torso')) { b.vx *= 0.9; b.vz *= 0.9; b.passed = (b.passed || 0) + 1; if (b.passed > 1) sim.stats.collateral++; return false; }
  sim.stopBullet(b); return true;
};
Sim.prototype.hitObject = function (ob, b, bx, by) {
  const sim = this, S = sim.S, P = ob.plane;
  sim.stats.objects++;
  const k = ob.kind;
  sim.ev.push({ k: 'objhit', kind: k, id: ob.id, x: bx, y: by, plane: P, tof: sim.t - b.t0, dist: P.z - b.oz });
  sim.crack(b, bx, by, P);
  if (k === 'lamp' || k === 'bulb') {
    if (!ob.alive) return;
    ob.alive = false; if (k === 'bulb' && ob.room) S.room(ob.room, false);
    sim.ev.push({ k: 'lampout', x: ob.x, y: ob.y, plane: P }); sim.noise(ob.x, ob.y, P, 'pop', ob.popR === undefined ? 9 : ob.popR);
  } else if (k === 'hook' || k === 'rope') {
    if (!ob.alive) return; ob.alive = false;
    if (ob.prop) { ob.prop.falling = true; sim.ev.push({ k: 'snap', x: ob.x, y: ob.y, plane: P }); }
  } else if (k === 'barrel' || k === 'tank') {
    if (!ob.alive) return; ob.alive = false; sim.explode(ob);
  } else if (k === 'fuse') {
    if (!ob.alive) return; ob.alive = false;
    (ob.cuts || []).forEach((c) => { if (S.rooms[c]) S.rooms[c].lit = false; S.objects.forEach((l) => { if ((l.kind === 'lamp' || l.kind === 'bulb') && (l.id === c || l.zone === c)) { l.on = false; if (l.kind === 'bulb' && l.room) S.room(l.room, false); } }); });
    if (ob.killsCams) S.objects.forEach((c) => { if (c.kind === 'cctv') c.alive = false; });
    sim.ev.push({ k: 'zap', x: ob.x, y: ob.y, plane: P }); sim.noise(ob.x, ob.y, P, 'pop', 7);
  } else if (k === 'bell' || k === 'horn') {
    ob.ringT = sim.t; sim.ev.push({ k: 'ring', kind: k, x: ob.x, y: ob.y, plane: P }); sim.noise(ob.x, ob.lureY === undefined ? ob.y : ob.lureY, P, 'lure', ob.lure || 24);
    if (ob.cover) sim.cover(ob.cover, k);
  } else if (k === 'bottle' || k === 'can' || k === 'pot') {
    if (!ob.alive) return; ob.alive = false; sim.ev.push({ k: k === 'can' ? 'clank' : 'smash', x: ob.x, y: ob.y, plane: P });
    sim.noise(ob.x, ob.lureY === undefined ? ob.y : ob.lureY, P, 'lure', ob.lure || 11);
  } else if (k === 'cctv') { ob.alive = false; sim.ev.push({ k: 'spark', x: ob.x, y: ob.y, plane: P });
  } else if (k === 'duck') { if (ob.alive) { ob.alive = false; sim.stats.duck = true; sim.ev.push({ k: 'duck', x: ob.x, y: ob.y, plane: P }); }
  } else if (k === 'valve') { if (ob.alive) { ob.alive = false; sim.steam.push({ x: ob.x, y: ob.y, plane: P, until: sim.t + (ob.dur || 14), from: sim.t }); sim.ev.push({ k: 'steam', x: ob.x, y: ob.y, plane: P }); if (ob.cover) sim.cover(ob.dur || 14, 'steam'); }
  } else if (k === 'radio' || k === 'dish') { if (ob.alive) { ob.alive = false; sim.radioDown = true; sim.ev.push({ k: 'spark', x: ob.x, y: ob.y, plane: P }); }
  } else if (k === 'lock') { if (ob.alive) { ob.alive = false; sim.ev.push({ k: 'clank', x: ob.x, y: ob.y, plane: P }); }
  } else if (k === 'flare') { if (ob.alive) { ob.alive = false; sim.ev.push({ k: 'flare', x: ob.x, y: ob.y, plane: P }); sim.actors.forEach((a) => { if (!a.dead && !a.gone && !a.room && Math.abs(a.x - ob.x) < (ob.lure || 30) && (a.state === 'calm')) { a.state = 'susp'; a.susp = 0.1; a.distractUntil = sim.t + 7; a.distractX = ob.x; } }); }
  } else if (ob.breakable) { if (ob.alive) { ob.alive = false; sim.ev.push({ k: 'spark', x: ob.x, y: ob.y, plane: P }); }
  } else { sim.impact(b, bx, by, P, ob.mat || 'metal', { quiet: true }); }
  if (ob.alive === false || k === 'bell' || k === 'horn') sim.emit('obj:' + ob.id);
  if (ob.onHit) ob.onHit(sim, ob);
};
Sim.prototype.explode = function (ob) {
  const sim = this, R = ob.blast || (ob.kind === 'tank' ? 7.5 : 4.2);
  sim.ev.push({ k: 'boom', x: ob.x, y: ob.y, plane: ob.plane, r: R });
  sim.actors.forEach((a) => {
    if (a.dead || a.gone || a.hidden) return;
    if (a.plane !== ob.plane && Math.abs(a.plane.z - ob.plane.z) > 8) return;
    if (Math.hypot(a.x - ob.x, a.y + 0.9 - ob.y) <= R) sim.killActor(a, 'torso', 'blast', null);
  });
  sim.vehicles.forEach((v) => { if (!v.gone && Math.abs(v.plane.z - ob.plane.z) < 8 && Math.abs(v.x - ob.x) < R + 1.5) { v.routine = [['brake']]; v.pc = 0; v.goal = null; v.flatTire = true; v.seats.forEach((id) => { const a = sim.byId[id]; if (a && !a.dead) sim.killActor(a, 'torso', 'blast', null); }); sim.emit('wrecked:' + v.id); } });
  sim.S.objects.forEach((o2) => { if (o2 !== ob && o2.alive && (o2.kind === 'barrel' || o2.kind === 'tank') && Math.abs(o2.plane.z - ob.plane.z) < 8 && Math.hypot(o2.x - ob.x, o2.y - ob.y) < R + 2) sim.after(0.25, () => { if (o2.alive) { o2.alive = false; sim.explode(o2); sim.emit('obj:' + o2.id); } }); });
  if (sim.rules.boomQuiet) sim.noise(ob.x, ob.y, ob.plane, 'crash', 40);
  else { sim.noise(ob.x, ob.y, ob.plane, 'boom', 70); sim.raiseAlarm('explosion', 0.8); }
};

Sim.prototype.stepBullet = function (b, dt) {
  const sim = this, S = sim.S, st = sim.st, planes = S.planes;
  let left = dt;
  const farZ = planes.length ? planes[0].z + 60 : 3000;
  while (left > 0 && b.alive) {
    const sp = Math.max(40, Math.abs(b.vz));
    const h = Math.min(left, 1 / 500, 2.5 / sp);
    const x0 = b.x, y0 = b.y, z0 = b.z;
    Bal.step(b, h, st.k, sim.wind(), 0);
    left -= h;
    // crossed any planes this step? (near to far)
    for (let i = planes.length - 1; i >= 0 && b.alive; i--) {
      const P = planes[i];
      if (P.z <= z0 || P.z > b.z) continue;
      const f = (P.z - z0) / (b.z - z0);
      const bx = lerp(x0, b.x, f), by = lerp(y0, b.y, f);
      if (sim.hitPlane(P, b, bx, by)) { b.x = bx; b.y = by; b.z = P.z; }
    }
    if (!b.alive) break;
    const g = sim.groundAt(b.x, b.z);
    if (b.y < g.y && g.found) {
      const f = clamp((y0 - g.y) / Math.max(1e-6, y0 - b.y), 0, 1);
      b.x = lerp(x0, b.x, f); b.z = lerp(z0, b.z, f); b.y = g.y;
      let P = null, bz = 1e12; planes.forEach((p) => { if (p.z >= b.z - 0.5 && p.z < bz) { bz = p.z; P = p; } });
      sim.ev.push({ k: 'impact', x: b.x, y: b.y, z: b.z, plane: null, mat: g.mat === 'water' ? 'water' : (g.mat || 'dirt'), tof: sim.t - b.t0, dist: b.z - b.oz, ground: true });
      // a round kicking up dirt near someone gets noticed
      sim.actors.forEach((a) => { if (a.dead || a.gone || a.inVeh || a.room) return; if (Math.abs(a.plane.z - b.z) > 14) return; const d = Math.abs(a.x - b.x); if (d < 3) sim.startle(a, 'impact'); else if (d < 9) sim.suspect(a, 3); });
      sim.stopBullet(b); sim.stats.misses++;
      break;
    }
    if (b.z > farZ || b.vz < 30 || sim.t - b.t0 > 9) { sim.stopBullet(b); sim.ev.push({ k: 'lost' }); }
  }
  if (b.trail.length < 400) b.trail.push([b.x, b.y, b.z]);
};

// ---- falling loads -------------------------------------------------------------
Sim.prototype.stepProps = function (dt) {
  const sim = this;
  sim.S.props.forEach((p) => {
    if (!p.falling || p.landed) return;
    p.vy -= GRAV * dt; p.y += p.vy * dt;
    if (p.y <= p.floor) {
      p.y = p.floor; p.landed = true; p.falling = false; p.tilt = (sim.rng.f() - 0.5) * 0.2;
      sim.ev.push({ k: 'crash', x: p.x, y: p.y, plane: p.plane, kind: p.kind });
      sim.actors.forEach((a) => {
        if (a.dead || a.gone || a.hidden || a.inVeh) return;
        if (Math.abs(a.plane.z - p.plane.z) > 6) return;
        if (Math.abs(a.x - p.x) <= p.w / 2 + 0.35 && Math.abs(a.y - p.floor) < 1.2) sim.killActor(a, 'torso', 'accident', null);
      });
      sim.noise(p.x, p.y, p.plane, 'crash', 28);
      sim.emit('crash:' + p.id);
    }
  });
};

// ---- the main step ---------------------------------------------------------------
Sim.prototype.step = function (dt) {
  const sim = this;
  if (sim.state !== 'play') return;
  sim.t += dt;
  for (let i = sim.timers.length - 1; i >= 0; i--) if (sim.timers[i].t <= sim.t) { const fn = sim.timers[i].fn; sim.timers.splice(i, 1); fn(); }
  sim.stepShooter(dt);
  for (let i = 0; i < sim.actors.length; i++) sim.stepActor(sim.actors[i], dt);
  for (let i = 0; i < sim.vehicles.length; i++) sim.stepVehicle(sim.vehicles[i], dt);
  for (let i = 0; i < sim.bullets.length; i++) if (sim.bullets[i].alive) sim.stepBullet(sim.bullets[i], dt);
  sim.stepProps(dt);
  // people distracted by a flare look at it
  sim.actors.forEach((a) => { if (a.distractUntil && !a.dead) { if (a.distractUntil > sim.t && (a.state === 'calm' || a.state === 'susp')) { a.state = 'susp'; a.susp = 0.2; a.face = sign(a.distractX - a.x) || 1; a.goal = null; } else a.distractUntil = 0; } });
  sim._pc = (sim._pc || 0) + dt;
  if (sim._pc > 0.15) { sim._pc = 0; sim.perceive(); }
  // scripted events
  for (let i = 0; i < sim.triggers.length; i++) {
    const tr = sim.triggers[i];
    if (tr.done) continue;
    let go = false;
    if (tr.at !== undefined) go = sim.t >= tr.at;
    else if (tr.on) go = sim.did(tr.on) && (tr.delay ? sim.t >= sim.emitted[tr.on] + tr.delay : true);
    else if (tr.when) go = !!tr.when(sim, sim.A);
    if (go) { if (tr.every) { tr.at = sim.t + tr.every; } else tr.done = true; tr.do(sim, sim.A); }
  }
  if (sim.M.tick) sim.M.tick(sim, sim.A, dt);
  sim.judge();
};

Sim.prototype.objectivesDone = function () {
  const sim = this, R = sim.rules;
  for (let i = 0; i < R.kill.length; i++) { const a = sim.byId[R.kill[i]]; if (!a || !a.dead) return false; }
  for (let i = 0; i < R.destroy.length; i++) { const o = sim.S.objects.find((ob) => ob.id === R.destroy[i]); if (!o || o.alive) return false; }
  if (R.until && !sim.did(R.until)) return false;
  if (R.done && !R.done(sim, sim.A)) return false;
  return true;
};
Sim.prototype.judge = function () {
  const sim = this, R = sim.rules, sh = sim.sh;
  if (R.time && sim.t >= R.time && !sim.winAt && !sim.failInfo) sim.fail('time', R.timeText || 'Out of time. The window closed.', 0.6);
  if (!sim.winAt && !sim.failInfo && sim.objectivesDone()) { sim.winAt = sim.t + (R.aftermath === undefined ? 2.8 : R.aftermath); sim.ev.push({ k: 'winning' }); }
  if (!sim.winAt && !sim.failInfo && sh.ammo <= 0 && sh.reserve <= 0 && !sim.bullets.some((b) => b.alive) && sim.t - sh.lastFire > 2.5 && !R.until) {
    sim.fail('ammo', 'Out of ammunition.', 0.5);
  }
  if (sim.failInfo && sim.t >= sim.endAt) { sim.state = 'lost'; sim.result = sim.summarise(false); sim.ev.push({ k: 'end', win: false }); return; }
  if (sim.winAt && !sim.failInfo && sim.t >= sim.winAt) { sim.state = 'won'; sim.result = sim.summarise(true); sim.ev.push({ k: 'end', win: true }); }
};
Sim.prototype.summarise = function (win) {
  const sim = this, M = sim.M;
  const clean = sim.alarmT === null && sim.stats.panics === 0;
  const par = (typeof M.par === 'function' ? M.par(sim.flags) : M.par) || Math.max(1, sim.rules.kill.length + sim.rules.destroy.length);
  const precise = sim.stats.shots <= par;
  const res = { win, fail: sim.failInfo, clean, precise, par, shots: sim.stats.shots, time: sim.t, stats: sim.stats, kills: sim.kills, stars: win ? 1 + (clean ? 1 : 0) + (precise ? 1 : 0) : 0, vantage: sim.vi, alarmBy: sim.alarmBy };
  res.challenge = !!(win && M.challenge && M.challenge.test(sim, res));
  res.outcome = null;
  if (win && M.outcomes) for (let i = 0; i < M.outcomes.length; i++) if (M.outcomes[i].when(sim, res)) { res.outcome = M.outcomes[i]; break; }
  return res;
};

// ---- helpers for the scope read-outs and for the test bot -----------------------
// Distance to whatever is under a given aim point (a straight line of sight).
Sim.prototype.rangeAt = function (ax, ay) {
  const sim = this, S = sim.S, e = sim.eye(), planes = S.planes;
  for (let i = planes.length - 1; i >= 0; i--) {
    const P = planes[i], d = P.z - e.z; if (d <= 1) continue;
    const x = e.x + (ax / 1000) * d, y = e.y + (ay / 1000) * d;
    if (P.groundY !== undefined) { const gy = P.groundFn ? P.groundFn(x) : P.groundY; if (y < gy) { const dd = ay < 0 ? Math.min(d, ((gy - e.y) / ay) * 1000) : d; return { d: P.groundFn ? d : Math.max(1, dd), x, y: gy, P, ground: true }; } }
    for (let j = 0; j < sim.actors.length; j++) { const a = sim.actors[j]; if (a.plane === P && !a.gone && !a.hidden && Math.abs(x - a.x) < 0.4 && y > a.y && y < a.y + 1.9) return { d, x, y, P, actor: a }; }
    for (let j = 0; j < sim.vehicles.length; j++) { const v = sim.vehicles[j]; if (v.plane === P && !v.gone && Math.abs(x - v.x) < v.def.len / 2 && y > v.y && y < v.y + v.def.h) return { d, x, y, P }; }
    for (let j = 0; j < S.objects.length; j++) { const o = S.objects[j]; if (o.plane === P && o.r > 0 && Math.hypot(x - o.x, y - o.y) < o.r + 0.2) return { d, x, y, P }; }
    for (let j = 0; j < P.openings.length; j++) { const op = P.openings[j]; if (!op.through && x >= op.x && x <= op.x + op.w && y >= op.y && y <= op.y + op.h) return { d, x, y, P }; }
    for (let j = 0; j < P.solids.length; j++) { const s = P.solids[j]; if (s.mat !== 'leaf' && s.mat !== 'grid' && x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return { d, x, y, P }; }
  }
  return null;
};
// The correction for a shot at the thing under the crosshair, given the
// current wind and zero. up > 0 means hold high; right > 0 means hold right.
Sim.prototype.holdFor = function (d, dy) {
  const sim = this, st = sim.st, w = sim.wind();
  const dp = Bal.dope(st, sim.sh.zeroAng, d, w);
  return { up: dp.dropMil, right: -dp.driftMil, tof: dp.tof, ok: dp.reached };
};
// Exact aim needed to hit a world point right now (used by the test bot and
// by the smart scope).
Sim.prototype.aimFor = function (px, py, pz, lead) {
  const sim = this, st = sim.st;
  let ax = sim.sh.ax, ay = sim.sh.ay, sol = null;
  for (let i = 0; i < 4; i++) {
    const ex = sim.eye0.x + ax * 0.011, ey = sim.eye0.y + ay * 0.004, ez = sim.eye0.z;
    let tx = px, ty = py;
    if (lead && sol) { tx += lead.vx * (sol.tof + (lead.extra || 0)); }
    sol = Bal.solve(st, sim.sh.zeroAng, tx - ex, ty - ey, pz - ez, sim.wind(), 0);
    ax = sol.ax; ay = sol.ay;
  }
  return sol;
};
Sim.prototype.partPoint = function (a, part) {
  const J = actorJoints(a);
  let p;
  if (part === 'head') p = J.head;
  else p = [lerp(J.hip[0], J.neck[0], 0.62), lerp(J.hip[1], J.neck[1], 0.62)];
  return { x: a.x + p[0], y: a.y + p[1], z: a.plane.z };
};

CB.Sim = Sim;
