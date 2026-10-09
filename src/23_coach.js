// ---------------------------------------------------------------------------
// The coach for a guided run.
//
// Every mission carries a script for the test bot (`solve`) that proves it can be
// finished with three stars. The coach reads that same script against the live
// mission and turns each step into something a player can follow: wait (and why),
// hold your breath, set the zero dial, reload, and for a shot a bracket on what to
// hit, a mark exactly where the bot would put the crosshair, and FIRE NOW at the
// moment the bot would fire.
//
// It only ever looks. It never steps the world on, never draws a random number and
// never changes anything in the simulation, so a guided run plays out exactly the
// way an ordinary run would. (test/guided.js checks this, and plays every mission
// by following nothing but what the coach shows.)
// ---------------------------------------------------------------------------
const COACH_SHOT = { shoot: 1, shootObj: 1, shootAt: 1, shootPt: 1 };
// plain names for the things a script tells you to shoot
const COACH_OBJ = { lamp: 'the lamp', bulb: 'the light', hook: 'the hook', rope: 'the rope', barrel: 'the drum', tank: 'the fuel tank', fuse: 'the fuse box', bell: 'the bell', horn: 'the horn', bottle: 'the bottle', can: 'the can', pot: 'the pot', cctv: 'the camera', valve: 'the valve', radio: 'the radio', dish: 'the dish', lock: 'the lock', flare: 'the flare' };
// words that say a line of the written walkthrough is about waiting, or about shooting
const COACH_WAITW = /\b(wait|waits|until|when|once|watch|let|after|before)\b/i;
const COACH_SHOOTW = /\b(shoot|fire|aim|hit|drop him|drop her|squeeze|put a round|put the cross)\b/i;

function Coach(sim) {
  const C = this, M = sim.M;
  C.sim = sim; C.M = M;
  // the script, built the way the test bot builds it
  const script = typeof M.solve === 'function' ? M.solve(sim.A, sim.st, sim.flags, sim) : M.solve;
  C.script = (script || []).map((c) => c.slice());
  C.pc = 0; C.cur = null; C.out = null;
  const g = typeof M.guide === 'function' ? M.guide(sim.flags) : M.guide;
  C.guide = Array.isArray(g) && g.length ? g : null;
  // Which shot each step leads up to. A second try at the same person or thing is not a
  // new shot, so "shot 2 of 2" means two different things to hit, not two rounds.
  const seen = {}; let n = 0;
  C.seg = C.script.map((c) => {
    if (!COACH_SHOT[c[0]]) return n;
    const key = Coach.keyOf(c);
    if (seen[key] === undefined) seen[key] = n++;
    return seen[key];
  });
  C.nSeg = Math.max(1, n);
  C.seg = C.seg.map((s) => Math.min(s, C.nSeg - 1));
}
Coach.keyOf = function (c) { return c[0] === 'shoot' ? 'a:' + c[1] : c[0] === 'shootObj' ? 'o:' + c[1] : 'p:' + c[0] + (typeof c[1] === 'number' ? c[1] + ',' + c[2] : ''); };

Coach.prototype.objById = function (id) { const L = this.sim.S.objects; for (let i = 0; i < L.length; i++) if (L[i].id === id) return L[i]; return null; };
Coach.prototype.next = function () { this.cur = null; };

// What would a script step that runs a bit of code ("fn") do? It is run against a stand-in
// that reads the real mission but only notes down a reload or a held breath instead of doing
// it. The player is then asked to do that.
Coach.prototype.peekFn = function (fn) {
  const sim = this.sim, want = { reload: false, hold: null }, look = Object.create(sim);
  look.reload = function () { want.reload = true; return true; };
  look.holdBreath = function (on) { want.hold = !!on; return want.hold; };
  try { fn(look, sim.A); } catch (e) { /* a step the coach cannot read is skipped */ }
  return want;
};

// One line of the written walkthrough for the shot the player is working towards. The
// walkthrough is split into as many runs of lines as there are shots, in order; a wait shows
// the first line in its run that talks about waiting, a shot the last that talks about shooting.
Coach.prototype.guideLine = function (seg, kind) {
  const G = this.guide; if (!G) return null;
  const N = this.nSeg, s = clamp(seg, 0, N - 1);
  const a = Math.floor((s * G.length) / N), b = Math.max(a + 1, Math.floor(((s + 1) * G.length) / N));
  const chunk = G.slice(a, Math.min(b, G.length));
  if (!chunk.length) return null;
  if (kind === 'shoot') { for (let i = chunk.length - 1; i >= 0; i--) if (COACH_SHOOTW.test(chunk[i])) return chunk[i]; return null; }
  for (let i = 0; i < chunk.length; i++) if (COACH_WAITW.test(chunk[i])) return chunk[i];
  return chunk[0];
};

// Where a script step wants the round to go, right now, or null if there is nothing to hit.
Coach.prototype.targetOf = function (c) {
  const sim = this.sim, k = c[0];
  if (k === 'shoot') {
    const a = sim.byId[c[1]]; if (!a || a.dead || a.gone) return null;
    return { kind: 'person', a, hidden: !!a.hidden, label: 'TARGET' };
  }
  if (k === 'shootObj') {
    const ob = this.objById(c[1]); if (!ob || ob.gone) return null;
    if (ob.alive === false && !ob.rehit && ob.kind !== 'bell' && ob.kind !== 'horn') return null;
    return { kind: 'object', ob, label: 'SHOOT THIS', name: COACH_OBJ[ob.kind] || 'the marked spot' };
  }
  if (k === 'shootAt') return { kind: 'point', p: { x: c[1], y: c[2], z: c[3].z || c[3] }, label: 'SHOOT HERE' };
  if (k === 'shootPt') {
    let p = null; try { p = c[1](sim, sim.A); } catch (e) { p = null; }
    return p ? { kind: 'point', p, label: 'SHOOT HERE' } : null;
  }
  return null;
};
// A box around a target in metres on its own plane: { x0, x1, y0, y1, z }.
Coach.prototype.boxOf = function (T) {
  if (T.kind === 'person') {
    const a = T.a, J = actorJoints(a);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const k in J) { const p = J[k]; if (!Array.isArray(p)) continue; x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    if (x0 > x1) { x0 = -0.3; x1 = 0.3; y0 = 0; y1 = 1.8; }
    return { x0: a.x + x0 - 0.22, x1: a.x + x1 + 0.22, y0: a.y + y0 - 0.12, y1: a.y + y1 + 0.3, z: a.plane.z };
  }
  if (T.kind === 'object') {
    const ob = T.ob, hw = ob.w ? ob.w / 2 : ob.r || 0.3, hh = ob.h ? ob.h / 2 : ob.r || 0.3, pad = 0.12;
    return { x0: ob.x - hw - pad, x1: ob.x + hw + pad, y0: ob.y - hh - pad, y1: ob.y + hh + pad, z: ob.plane.z };
  }
  const p = T.p; return { x0: p.x - 0.35, x1: p.x + 0.35, y0: p.y - 0.35, y1: p.y + 0.35, z: p.z };
};
// The first thing the script will ask the player to shoot, from the current step onwards.
Coach.prototype.nextTarget = function () {
  const from = this.cur ? this.cur.i : this.pc;
  for (let i = from; i < this.script.length; i++) {
    const c = this.script[i]; if (!COACH_SHOT[c[0]]) continue;
    const T = this.targetOf(c); if (T) return T;
  }
  return null;
};

// Read the script against the world as it is now. Returns (and keeps in this.out) what to show:
//   kind   'wait' | 'hold' | 'dial' | 'reload' | 'shoot' | 'flight' | 'done'
//   head, text      the words for the card
//   count           seconds left on a timed wait
//   target          { kind, a | ob | p, label, box, next } what to bracket
//   aim             { x, y, z } the world point the crosshair should sit on, during a shot
//   fire            true at the moment to fire: the rifle is ready and the crosshair is on the mark
//   shot, shots     which shot this is leading up to, of how many
Coach.prototype.update = function () {
  const C = this, sim = C.sim, sh = sim.sh, st = sim.st;
  const o = C.out = { kind: 'done', head: '', text: '', count: null, target: null, aim: null, fire: false, ready: false, onMark: false, charging: false, shot: 1, shots: C.nSeg, dial: null };
  if (sim.state !== 'play') { o.head = 'DONE'; return o; }
  if (sim.winAt) { o.head = 'JOB DONE'; o.text = 'Stay on the scope while it plays out.'; o.shot = C.nSeg; return o; }
  let guard = 0;
  while (guard++ < 30) {
    if (!C.cur) {
      const c = C.script[C.pc++];
      if (!c) { o.kind = 'done'; o.head = 'NO MORE STEPS'; o.text = sim.failInfo ? 'This run is lost. Open the notebook to start over.' : 'The guide has nothing more for this run. Open the notebook to start over.'; o.shot = C.nSeg; return o; }
      C.cur = { c, i: C.pc - 1, t0: sim.t, shots0: sim.stats.shots, tries: 0 };
    }
    const S = C.cur, c = S.c, k = c[0], el = sim.t - S.t0;
    o.shot = C.seg[S.i] + 1;
    if (k === 'wait') {
      if (el >= c[1]) { C.next(); continue; }
      C.waitOut(o, S, 'pause'); o.count = c[1] - el; break;
    }
    if (k === 'until') {
      let ok = false; try { ok = !!c[1](sim, sim.A); } catch (e) { ok = true; }
      if (ok || el > (c[2] || 120)) { C.next(); continue; }
      C.waitOut(o, S, 'until'); break;
    }
    if (k === 'cover') {
      if (st.quiet || sim.covered() || el > (c[1] || 90)) { C.next(); continue; }
      C.waitOut(o, S, 'cover'); break;
    }
    if (k === 'fn') {
      const w = C.peekFn(c[1]);
      if (w.reload) { S.c = ['reload']; continue; }
      if (w.hold === true) { S.c = ['hold']; continue; }
      C.next(); continue;
    }
    if (k === 'hold') {
      if (sh.holding || sh.exhausted > 0 || sh.breath < st.breath * 0.2 || el > 4) { C.next(); continue; }
      o.kind = 'hold'; o.head = 'HOLD YOUR BREATH'; o.text = 'Press HOLD BREATH now. It steadies the crosshair for the shot.';
      o.target = C.mark(C.nextTarget(), true); break;
    }
    if (k === 'reload') {
      if (sh.reloadT > 0 || sh.ammo >= st.mag || sh.reserve <= 0 || sh.chargeT > 0 || el > 6) { C.next(); continue; }
      o.kind = 'reload'; o.head = 'RELOAD NOW'; o.text = 'Top the rifle up while nothing is happening.';
      o.target = C.mark(C.nextTarget(), true); break;
    }
    if (k === 'dial') {
      if (!st.scope.turret) { C.next(); continue; }
      if (S.dialTo === undefined) S.dialTo = clamp(sh.zeroR + Math.round((c[1] - sh.zeroR) / 25) * 25, 50, 2200);
      if (sh.zeroR === S.dialTo) { C.next(); continue; }
      o.kind = 'dial'; o.dial = S.dialTo; o.head = 'SET THE ZERO DIAL TO ' + S.dialTo + ' M';
      o.text = Game.touch ? 'Use the minus and plus beside ZERO under the scope.' : 'Press Q and E to turn the zero dial.';
      o.target = C.mark(C.nextTarget(), true); break;
    }
    if (COACH_SHOT[k]) { if (C.shotStep(o, S, el)) continue; break; }
    C.next(); // a step this coach does not know: skip it, as the bot would
  }
  return o;
};

// The wait card: the walkthrough's own words when they can be matched, a plain line otherwise.
Coach.prototype.waitOut = function (o, S, why) {
  o.kind = 'wait'; o.head = 'WAIT';
  const T = this.nextTarget();
  o.target = this.mark(T, true);
  const line = this.guideLine(this.seg[S.i], 'wait');
  if (line) { o.text = line; return; }
  if (why === 'pause') o.text = 'Let it settle for a moment.';
  else if (why === 'cover') o.text = 'Wait for a loud noise to hide the shot.';
  else o.text = 'Wait for the right moment. Keep watching ' + (T ? (T.kind === 'person' ? 'the marked target' : T.name || 'the marked spot') : 'the scene') + '.';
};
// Fill in the box for a target and say whether it is the one being shot now or the next one.
Coach.prototype.mark = function (T, next) {
  if (!T) return null;
  if (T.kind === 'person' && T.hidden) return null;
  T.box = this.boxOf(T); T.next = !!next;
  return T;
};

// A shot. Returns true when the step is finished and the script should move on.
Coach.prototype.shotStep = function (o, S, el) {
  const C = this, sim = C.sim, sh = sim.sh, st = sim.st, c = S.c, k = c[0];
  // any round fired since this step began is this step's round
  if (!S.fired && sim.stats.shots > S.shots0) {
    S.fired = true; S.tf = sim.t; S.bullet = null;
    for (let i = sim.bullets.length - 1; i >= 0; i--) if (sim.bullets[i].id === S.shots0 + 1) { S.bullet = sim.bullets[i]; break; }
  }
  const T = C.targetOf(c);
  if (S.fired) {
    const b = S.bullet;
    if ((c[3] && c[3].nowait) || !b || !b.alive) {
      if (C.missed(S)) { S.fired = false; S.shots0 = sim.stats.shots; S.t0 = sim.t; S.tries++; S.again = true; return true; }
      C.next(); return true;
    }
    o.kind = 'flight'; o.head = 'ROUND ON ITS WAY'; o.text = ''; o.target = C.mark(T, false);
    return false;
  }
  if (!T && k === 'shootPt' && el <= 60) { // the bot waits for its point to exist (a car to stop, say)
    o.kind = 'wait'; o.head = 'WAIT'; o.text = 'Wait for the right moment.'; return false;
  }
  if (!T) { C.next(); return true; }  // already down, already broken, or not there
  if (T.kind === 'person' && T.hidden) {
    if (el > 60) { C.next(); return true; }
    o.kind = 'wait'; o.head = 'WAIT'; o.text = 'Wait for the target to show.'; return false;
  }
  // where the bot would aim: the same point, the same lead, the same solution
  let pt, lead = null;
  const extra = st.action === 'charge' ? (sh.chargeT > 0 ? Math.max(0, sh.chargeT) : 0.85) : 0;
  if (T.kind === 'person') {
    const a = T.a; pt = sim.partPoint(a, c[2] || 'torso');
    const vx = a.inVeh ? a.inVeh.v * a.inVeh.dir * (a.inVeh.goal !== null ? 1 : 0) : (a.goal !== null ? a.vx : 0);
    lead = { vx, extra };
  } else if (T.kind === 'object') pt = { x: T.ob.x, y: T.ob.y, z: T.ob.plane.z };
  else { pt = T.p; if (pt.vx) lead = { vx: pt.vx, extra }; }
  const sol = sim.aimFor(pt.x, pt.y, pt.z, lead), e = sim.eye(), d = pt.z - e.z;
  o.aim = { x: e.x + (sol.ax / 1000) * d, y: e.y + (sol.ay / 1000) * d, z: pt.z, ax: sol.ax, ay: sol.ay };
  // how far the crosshair is from the mark, in metres out at the target
  const now = sim.aimNow(), err = (Math.hypot(now.x - sol.ax, now.y - sol.ay) / 1000) * d;
  const part = c[2] || 'torso';
  const tol = T.kind === 'person' ? (part === 'head' ? 0.07 : 0.13) : T.kind === 'object' ? Math.max(0.06, Math.min(0.3, 0.7 * Math.min(T.ob.w ? T.ob.w / 2 : T.ob.r || 0.3, T.ob.h ? T.ob.h / 2 : T.ob.r || 0.3))) : 0.15;
  o.onMark = err <= tol;
  o.ready = sim.canFire() && Math.abs(sh.recy) <= 0.05 && Math.abs(sh.recvy) <= 0.6 && el >= 0.25;
  o.charging = sh.chargeT > 0;
  o.fire = o.ready && o.onMark;
  o.kind = 'shoot'; o.target = C.mark(T, false);
  if (o.charging) { o.head = 'KEEP IT ON THE MARK'; o.text = 'The rifle is charging. Hold the cross on the mark until it fires.'; }
  else if (o.fire) { o.head = 'FIRE NOW'; o.text = 'The cross is on the mark.'; }
  else {
    const what = T.kind === 'object' ? 'Shoot ' + T.name + ': put' : 'Put';
    if (!o.ready) { o.head = 'GET READY'; o.text = sh.reloadT > 0 ? 'Reloading. ' + what + ' the cross on the mark.' : sh.ammo <= 0 ? 'Out of rounds in the rifle. Press RELOAD.' : what + ' the cross on the mark.'; }
    else { o.head = 'LINE UP'; o.text = what + ' the cross on the mark. It already allows for drop, wind and movement.'; }
  }
  if (S.again && !o.fire) o.text = 'Missed. Take it again. ' + o.text;
  if (!o.charging && sh.zoomT < st.zoomMax * 0.8) o.text += ' Zoom in all the way.';
  return false;
};
// After a round lands: did it miss something that still needs hitting? Then the same step runs
// again, unless the script already has a second try of its own coming up next.
Coach.prototype.missed = function (S) {
  const C = this, sim = C.sim, c = S.c, k = c[0], nx = C.script[C.pc];
  if (S.tries >= 2) return false;
  if (k === 'shoot') {
    const a = sim.byId[c[1]]; if (!a || a.dead || a.gone) return false;
    return !(nx && nx[0] === 'shoot' && nx[1] === c[1]);
  }
  if (k === 'shootObj') {
    const ob = C.objById(c[1]); if (!ob) return false;
    const at = sim.emitted['obj:' + c[1]];
    if (ob.alive === false || (at !== undefined && at >= S.tf - 1e-9)) return false;
    return !(nx && ((nx[0] === 'shootObj' && nx[1] === c[1]) || nx[0] === 'shootPt'));
  }
  return false;
};

// ---- drawing over the scope picture ---------------------------------------------------------
// A bracket on what to hit (or an arrow at the edge pointing to it), and during a shot the mark
// for the crosshair. Drawn after the picture, in screen pixels.
Coach.prototype.draw = function (V, rt) {
  const o = this.out; if (!o) return;
  const ctx = V.ctx, sim = this.sim;
  ctx.save(); ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  if (V.round) { ctx.beginPath(); ctx.arc(V.cx, V.cy, V.R, 0, TAU); ctx.clip(); }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const go = o.fire, col = go ? '#5fd38a' : '#ffaa3c';
  let low = -1e9; // the bottom of the bracket on screen, so a label under the mark can clear it
  if (o.target && o.target.box) low = this.drawBracket(ctx, V, o.target, o.target.next ? '#ffcf8a' : col, rt);
  if (o.aim && o.kind === 'shoot') {
    const p = V.project(sim, o.aim.x, o.aim.y, o.aim.z), mx = p[0], my = p[1];
    const cx = V.cam ? V.cam.cx : V.cx, cy = V.cam ? V.cam.cy : V.cy, dist = Math.hypot(mx - cx, my - cy);
    // a faint line from the crosshair to the mark when they are apart
    if (dist > 24 && this.onScreen(V, mx, my, 0)) {
      ctx.setLineDash([5, 6]); ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(col, 0.55);
      ctx.beginPath(); ctx.moveTo(cx + ((mx - cx) / dist) * 14, cy + ((my - cy) / dist) * 14); ctx.lineTo(mx - ((mx - cx) / dist) * 12, my - ((my - cy) / dist) * 12); ctx.stroke(); ctx.setLineDash([]);
    }
    // the mark: a ring and a dot, dark underneath so it reads on snow and on night water alike
    ctx.lineWidth = 4.5; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.arc(mx, my, 9, 0, TAU); ctx.stroke();
    ctx.lineWidth = 2.4; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(mx, my, 9, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.arc(mx, my, 3.2, 0, TAU); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(mx, my, 2, 0, TAU); ctx.fill();
    if (go) { // a ring swelling out from the mark
      const u = (rt * 1.8) % 1;
      ctx.globalAlpha = 1 - u; ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(mx, my, 10 + u * 16, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    }
    const lab = go ? 'FIRE NOW' : o.charging ? 'KEEP STILL' : '';
    if (lab) { const ly = Math.max(my + 30, low + 16); this.label(ctx, lab, mx, ly < V.H - 60 ? ly : my + 30, col, 16); }
  }
  ctx.restore();
};
// The part of the picture that is not under the controls. Sideways, the zoom slider runs down the
// left and the fire, breath and reload buttons fill the bottom right, so a bracket out there would
// be hidden: those count as off the picture and get an arrow instead.
Coach.prototype.clear = function (V) {
  const sf = Game.safe || { l: 0, r: 0 };
  return { x0: sf.l + 70, x1: V.W - sf.r - 150, y0: 56, y1: V.H - 52 };
};
Coach.prototype.onScreen = function (V, x, y, pad) {
  if (V.round) return Math.hypot(x - V.cx, y - V.cy) < V.R - pad;
  const c = this.clear(V);
  return x > c.x0 + pad && x < c.x1 - pad && y > c.y0 + pad && y < c.y1 - pad;
};
Coach.prototype.label = function (ctx, s, x, y, col, size) {
  ctx.font = '800 ' + size + 'px "Avenir Next Condensed", "Roboto Condensed", "Arial Narrow", Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(s, x, y);
  ctx.fillStyle = col; ctx.fillText(s, x, y);
};
Coach.prototype.drawBracket = function (ctx, V, T, col, rt) {
  const B = T.box, sim = this.sim;
  const a = V.project(sim, B.x0, B.y1, B.z), b = V.project(sim, B.x1, B.y0, B.z);
  let x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
  const mcx = (x0 + x1) / 2, mcy = (y0 + y1) / 2;
  if (x1 - x0 < 22) { x0 = mcx - 11; x1 = mcx + 11; }
  if (y1 - y0 < 22) { y0 = mcy - 11; y1 = mcy + 11; }
  if (!this.onScreen(V, mcx, mcy, 10)) { this.drawArrow(ctx, V, mcx, mcy, col, T.next ? 'NEXT' : T.label); return -1e9; }
  const L = Math.min(11, (x1 - x0) / 3, (y1 - y0) / 3);
  const corners = (w, c) => {
    ctx.lineWidth = w; ctx.strokeStyle = c; ctx.beginPath();
    ctx.moveTo(x0, y0 + L); ctx.lineTo(x0, y0); ctx.lineTo(x0 + L, y0);
    ctx.moveTo(x1 - L, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + L);
    ctx.moveTo(x1, y1 - L); ctx.lineTo(x1, y1); ctx.lineTo(x1 - L, y1);
    ctx.moveTo(x0 + L, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - L);
    ctx.stroke();
  };
  if (T.next) ctx.globalAlpha = 0.6 + 0.3 * Math.sin(rt * 4);
  corners(4.5, 'rgba(0,0,0,0.5)'); corners(2.2, col);
  ctx.globalAlpha = 1;
  this.label(ctx, T.next ? 'NEXT' : T.label, mcx, y0 - 10, col, 11.5);
  return y1;
};
// The target is off the picture: an arrow at the edge, pointing the way to swing the scope.
Coach.prototype.drawArrow = function (ctx, V, tx, ty, col, lab) {
  const cx = V.cx, cy = V.cy, dx = tx - cx, dy = ty - cy, ang = Math.atan2(dy, dx);
  let px, py;
  if (V.round) { const r = V.R - 30; px = cx + Math.cos(ang) * r; py = cy + Math.sin(ang) * r; }
  else { // on the edge of the clear part of the picture, along the line from the centre to the target
    const c = this.clear(V), ex = dx > 0 ? c.x1 - 26 - cx : cx - c.x0 - 26, ey = dy > 0 ? c.y1 - 26 - cy : cy - c.y0 - 26;
    const k = Math.min(Math.abs(ex / (dx || 1e-6)), Math.abs(ey / (dy || 1e-6)));
    px = cx + dx * k; py = cy + dy * k;
  }
  ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -11); ctx.lineTo(-3, 0); ctx.lineTo(-8, 11); ctx.closePath();
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke(); ctx.fillStyle = col; ctx.fill();
  ctx.restore();
  this.label(ctx, lab, px - Math.cos(ang) * 30, py - Math.sin(ang) * 22, col, 11.5);
};

// ---- for the tests: play a mission by doing only what the coach shows -----------------------
// Aims at the coach's mark (as a point out in the world), fires only on FIRE NOW, holds breath,
// turns the dial and reloads when told to. Nothing else.
Coach.play = function (missionId, gunId, o) {
  o = o || {};
  const M = MISSION_BY_ID[missionId];
  const cfg = CB.Test.cfgFor(M, gunId, o.cfg), st = buildStats(gunId, cfg);
  const why = gunAllowed(M, st);
  if (why && !o.force) return { skipped: true, why };
  const flags = o.flags || {};
  const sim = new Sim(M, st, o.vantage || 0, { flags, shotSeed: o.seed === undefined ? 1 : o.seed });
  const coach = new Coach(sim), dt = o.dt || 1 / 60, maxT = o.maxT || 400;
  sim.setZoom(st.zoomMax);
  const aimAt = (p) => { // put the crosshair on a world point, as a player would with a finger
    const sh = sim.sh;
    for (let i = 0; i < 3; i++) {
      const e = sim.eye(), d = p.z - e.z;
      const ax = ((p.x - e.x) / d) * 1000, ay = ((p.y - e.y) / d) * 1000;
      sh.ax = clamp(ax - (sh.swx + sh.recx + sh.offx), sim.lim.x0 - 30, sim.lim.x1 + 30);
      sh.ay = clamp(ay - (sh.swy + sh.recy + sh.offy), sim.lim.y0 - 30, sim.lim.y1 + 30);
    }
  };
  let fires = 0;
  const kinds = {};
  while (sim.state === 'play' && sim.t < maxT) {
    for (let g = 0; g < 8; g++) {
      let c = coach.update(), acted = false;
      kinds[c.kind] = (kinds[c.kind] || 0) + 1;
      if (c.kind === 'hold' && !sim.sh.holding) { sim.holdBreath(true); acted = true; }
      else if (c.kind === 'dial' && sim.sh.zeroR !== c.dial) { if (sim.dial(sign(c.dial - sim.sh.zeroR))) acted = true; }
      else if (c.kind === 'reload') { if (sim.reload()) acted = true; }
      if (c.aim) { aimAt(c.aim); c = coach.update(); if (c.aim) { aimAt(c.aim); c = coach.update(); } }
      if (c.fire) { if (sim.fire()) { fires++; acted = true; } }
      if (!acted) break;
    }
    sim.step(dt); sim.ev.length = 0;
  }
  const res = sim.result || { win: false, fail: { code: 'timeout', text: 'ran out of time' }, stars: 0 };
  return { ok: !!res.win, stars: res.stars, clean: res.clean, precise: res.precise, shots: sim.stats.shots, par: res.par, t: +sim.t.toFixed(1), fail: res.fail ? res.fail.code + ': ' + res.fail.text : null, alarmBy: sim.alarmBy || null, fires, kinds, steps: coach.script.length, guide: !!coach.guide };
};

CB.Coach = Coach;
