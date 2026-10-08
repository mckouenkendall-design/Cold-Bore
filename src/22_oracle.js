// ---------------------------------------------------------------------------
// The shot oracle. A second copy of the mission runs in step with the real one,
// fed the same aim and the same trigger pulls. The moment a round leaves the
// barrel the copy is run ahead until that round lands, which tells the game,
// before the player has seen anything, exactly what the shot is going to do:
// who it hits, where, when, and whether that finishes the contract. That is
// what lets the kill camera start at the muzzle instead of as a replay.
//
// Running ahead leaves the copy in the future, so it is thrown away and a
// fresh one is rebuilt from a small log of what the player did. The mission
// simulation costs a few millionths of a second per step, so rebuilding a
// whole minute of play takes a few frames, spread out so nothing stutters.
// ---------------------------------------------------------------------------
function Oracle(M, st, vi, opts) {
  this.mk = () => new Sim(M, st, vi, opts);
  this.s = this.mk(); this.synced = true; this.n = 0;
  this.dts = []; this.aim = []; this.fires = [];
  this.rb = null; this.last = null; this.inStep = false; this.nb = 0; this.real = null; this.misses = 0;
}

// Hook a live simulation. From here on its step() and fire() also feed the copy.
Oracle.prototype.attach = function (sim) {
  const O = this; O.real = sim; O.nb = sim.bullets.length;
  const step0 = sim.step, fire0 = sim.fire;
  sim.fire = function () { if (!O.inStep) O.noteFire(); return fire0.call(sim); };
  sim.step = function (dt) {
    if (sim.state !== 'play') return step0.call(sim, dt);
    O.pre(dt); O.inStep = true; step0.call(sim, dt); O.inStep = false; O.post(dt);
  };
  return O;
};
Oracle.prototype.noteFire = function () {
  const O = this, sim = O.real, sh = sim.sh;
  if (sim.state !== 'play' || sh.reloadT > 0 || sh.cycleT > 0 || sh.chargeT > 0 || sh.ammo <= 0) return; // nothing will leave the barrel
  O.fires.push({ n: O.n, sh: Object.assign({}, sh), pre: false });
  if (O.synced) { Object.assign(O.s.sh, sh); O.s.fire(); }
};
Oracle.prototype.pre = function (dt) {
  const O = this, sh = O.real.sh;
  O.dts.push(dt); O.aim.push(sh.ax, sh.ay, sh.zoom);
  // a charging rifle lets go inside this step: remember exactly where it was pointing
  if (sh.chargeT > 0 && sh.chargeT <= dt + 1e-9) O.fires.push({ n: O.n, sh: Object.assign({}, sh), pre: true });
  if (O.synced) Object.assign(O.s.sh, sh);
};
Oracle.prototype.post = function (dt) {
  const O = this, sim = O.real;
  O.n++;
  if (O.synced) { O.s.step(dt); O.s.ev.length = 0; }
  if (sim.bullets.length > O.nb) {
    const i = sim.bullets.length - 1; O.nb = sim.bullets.length;
    if (O.synced && O.s.bullets.length === sim.bullets.length) O.last = O.predict(i, dt);
    else { O.last = null; O.misses++; }
  }
};

// Run the copy ahead until bullet i has landed. Returns what will happen.
Oracle.prototype.predict = function (i, dt) {
  const O = this, s = O.s, b = s.bullets[i];
  if (!b) return null;
  const win0 = !!s.winAt, fail0 = !!s.failInfo;
  const path = [[b.t0, b.ox, b.oy, b.oz], [s.t, b.x, b.y, b.z]], kills = [], hits = [];
  s.ev.length = 0;
  let guard = 0;
  while (b.alive && s.state === 'play' && guard++ < 1400) {
    const pt = s.t, px = b.x, py = b.y, pz = b.z, vx = b.vx, vy = b.vy, vz = b.vz;
    s.step(dt);
    for (let k = 0; k < s.ev.length; k++) {
      const e = s.ev[k];
      if (e.k === 'hit') hits.push({ x: e.x, y: e.y, z: e.plane.z, part: e.part });
      else if (e.k === 'kill' && e.how === 'shot') {
        const z = e.plane.z, a = s.byId[e.id];
        let h = null; for (let q = hits.length - 1; q >= 0; q--) if (hits[q].z === z) { h = hits[q]; break; }
        const tf = clamp((z - pz) / Math.max(1, vz), 0, dt);
        // where the round goes in: the recorded hit if there is one, otherwise the bullet's own line at that distance
        const hx = h ? h.x : px + vx * tf, hy = h ? h.y : py + vy * tf;
        kills.push({ id: e.id, part: e.part, x: hx, y: hy, z, t: pt + tf, vx, vy, vz, ax: a ? a.x : hx, ay: a ? a.y : hy - 1, inVeh: !!(a && a.inVeh), behind: !!(a && a.behind) });
      }
    }
    s.ev.length = 0;
    path.push([s.t, b.x, b.y, b.z]);
  }
  const out = { i, t0: b.t0, path, kills, win: !win0 && !!s.winAt && !s.failInfo, fail: !fail0 && !!s.failInfo, stopped: !b.alive, tEnd: s.t };
  // the copy now lives in the future: build a new one from the log
  O.synced = false; O.rb = { s: O.mk(), n: 0, fi: 0 };
  return out;
};

// Bring the replacement copy up to date, spending at most `ms` milliseconds.
Oracle.prototype.catchUp = function (ms) {
  const O = this, rb = O.rb; if (!rb) return;
  const s = rb.s, t0 = performance.now(); let c = 0;
  const fire = (n) => { while (rb.fi < O.fires.length && O.fires[rb.fi].n === n) { const f = O.fires[rb.fi++]; Object.assign(s.sh, f.sh); if (!f.pre) s.fire(); } };
  while (rb.n < O.n) {
    const n = rb.n;
    s.sh.ax = O.aim[n * 3]; s.sh.ay = O.aim[n * 3 + 1]; s.sh.zoom = O.aim[n * 3 + 2];
    fire(n);
    s.step(O.dts[n]); s.ev.length = 0; rb.n++;
    if ((++c & 63) === 0 && performance.now() - t0 > ms) return;
  }
  fire(O.n);
  O.s = s; O.rb = null; O.synced = true; O.nb = O.real.bullets.length;
};

CB.Oracle = Oracle;
