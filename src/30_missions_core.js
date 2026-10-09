// ---------------------------------------------------------------------------
// Mission registry and the helpers missions are written with.
// ---------------------------------------------------------------------------
const MISSIONS = [];
const MISSION_BY_ID = {};
// Missions are played in the order they are registered. A contract written
// later can name the one it comes straight after with `follows: 'c3m2'`, so
// it can sit at the end of its chapter's file and still take its place in
// the story.
function mission(def) {
  let i = MISSIONS.length;
  if (def.follows) { const j = MISSIONS.findIndex((m) => m.id === def.follows); if (j >= 0) i = j + 1; }
  MISSIONS.splice(i, 0, def); MISSION_BY_ID[def.id] = def; return def;
}

const COL = { red: '#c8372d', blue: '#2f6db5', green: '#3f8f4f', yellow: '#e2b33c', white: '#ece8dc', grey: '#7a8088', orange: '#e07b2a', purple: '#7d4fa0', pink: '#e07a9a',
  brown: '#7b5a36', black: '#1d2026', teal: '#2a9d8f', navy: '#27365a', cream: '#e8dcc0', tan: '#b89a6a', olive: '#5d6b3a', wine: '#7a2438', sky: '#7fb6e6' };

// back-and-forth patrol
function pace(x0, x1, w0, w1, anim) { return [['walk', x1], ['wait', w1 === undefined ? (w0 || 2) : w1, anim || 'stand'], ['walk', x0], ['wait', w0 || 2, anim || 'stand'], ['loop']]; }
// walk through the scene once and leave
function stroll(to) { return [['walk', to], ['gone']]; }

// A believable random passer-by. `ban` is a test that rejects looks that
// would be confused with the target.
function rndLook(R, ban) {
  const hats = [null, null, null, 'cap', 'beanie', 'fedora', 'sun', 'beret'], hairs = [null, 'short', 'short', 'long', 'bun', 'white'];
  const coats = [null, null, COL.grey, COL.navy, COL.tan, COL.olive, COL.wine, COL.teal, COL.brown, COL.cream];
  const bags = [null, null, null, 'shopping', 'backpack', 'cup', 'case', 'paper'];
  for (let i = 0; i < 30; i++) {
    const L = { h: R.r(0.92, 1.07) };
    const hat = R.pick(hats); if (hat) { L.hat = hat; L.hatCol = R.pick(['#2a2d33', '#5a4634', '#7a8088', '#27365a', '#e8dcc0', '#7a2438']); } else { const hr = R.pick(hairs); if (hr) L.hair = hr; }
    const coat = R.pick(coats); if (coat) { L.coat = coat; L.long = R.chance(0.3); } else if (R.chance(0.25)) L.dress = R.pick([COL.wine, COL.teal, COL.navy, COL.pink]);
    const bag = R.pick(bags); if (bag) L.bag = bag;
    if (R.chance(0.15)) L.glasses = true;
    if (R.chance(0.1)) L.scarf = R.pick([COL.red, COL.yellow, COL.blue, COL.green]);
    if (!ban || !ban(L)) return L;
  }
  return { h: 1 };
}
// A stream of people walking through, so the street feels alive.
// Returns a trigger; put it in the mission's trigger list.
function passersBy(H, o) {
  o = o || {};
  let n = 0;
  return { at: o.first === undefined ? 1.5 : o.first, every: o.every || 7, do(sim) {
    if (sim.alarmT !== null) return;
    const R = sim.rng, dir = R.chance(0.5) ? 1 : -1, x0 = dir > 0 ? (o.x0 || -47) : (o.x1 || 47), x1 = dir > 0 ? (o.x1 || 47) : (o.x0 || -47);
    const a = sim.addActor(Object.assign(H.street(x0), { id: 'pb' + (n++), role: 'civ', look: rndLook(R, o.ban), routine: R.chance(o.stopChance === undefined ? 0.25 : o.stopChance) ? [['walk', R.r(-20, 20)], ['wait', R.r(3, 8), R.pick(['phone', 'stand', 'smoke'])], ['walk', x1], ['gone']] : stroll(x1), speed: R.r(0.85, 1.2) }));
    if (o.plane) a.plane = o.plane;
  } };
}
// Where the door of a seat is, along the road, for a vehicle of this kind standing at x facing
// dir: walk people there before ['veh', ...] (it walks them the rest of the way if they are not).
function doorX(kind, x, dir, seat) { const c = CARS[kind]; return x + dir * c.seats[seat || 0] * c.len; }
// Radio line from a character at a given time.
function say(at, who, text, dur) { return { at, do(sim) { sim.msg(who, text, dur); } }; }
function hint(at, text, dur) { return { at, do(sim) { sim.msg('hint', typeof text === 'function' ? text() : text, dur || 10); } }; }
function onEv(ev, fn, delay) { return { on: ev, delay: delay || 0, do: fn }; }

// A train that crosses on the elevated line every so often and drowns out
// gunfire while it passes. Returns { vehicle, triggers }.
function elTrain(H, o) {
  o = o || {};
  const period = o.period || 30, first = o.first === undefined ? 10 : o.first, speed = o.speed || 17;
  const veh = { id: 'eltrain', kind: 'train', plane: H.PE, x: -160, y: H.el.y, dir: 1, col: o.col || '#56606e', routine: [] };
  const trig = { at: first, every: period, do(sim) { const v = sim.byId.eltrain; v.x = -150; v.gone = false; v.routine = [['drive', 150, speed]]; v.pc = 0; v.goal = null; v.wait = 0; sim.after(2.2, () => sim.cover(o.cover || 9, 'train')); } };
  return { veh, trig };
}

// Would this rifle have punch enough if armour-piercing rounds went in the
// Ammunition slot in place of whatever is there now?
function apReaches(st, pen) {
  const ap = PART_BY_ID.am_ap, now = PART_BY_ID[st.cfg && st.cfg.ammo];
  if (!ap || !partFits(ap, st.gun)) return false;
  const nowAdd = now && partFits(now, st.gun) ? (now.mod.penAdd || 0) : 0;
  return st.pen - nowAdd + ap.mod.penAdd >= pen;
}

// Which rifles a mission will accept. Returns null if fine, or a reason.
function gunAllowed(M, st) {
  if (M.range && st.eff < M.range) return 'Not enough reach: this job is at ' + M.range + ' m.';
  const need = M.needs || {};
  if (need.quiet && !st.quiet) return 'This job needs a suppressed rifle.';
  if (need.silent && !st.silent) return 'This job needs a silent rifle: suppressed and subsonic.';
  if (need.glass && st.pen < 0.3) return 'Too weak to shoot through window glass.';
  if (need.rof && st.cycle > need.rof) return 'Too slow between shots for this job.';
  if (need.mag && st.mag < need.mag) return 'Not enough rounds in the magazine for this job.';
  if (need.pen && st.pen < need.pen) return apReaches(st, need.pen) ? 'This job needs armour-piercing rounds. Fit them in the Ammunition slot.' : 'Not enough punch for this job, even with armour-piercing rounds.';
  if (M.allow) { const r = M.allow(st); if (r) return r; }
  return null;
}
CB.MISSIONS = MISSIONS;
