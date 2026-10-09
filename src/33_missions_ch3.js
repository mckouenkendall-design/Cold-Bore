// ---------------------------------------------------------------------------
// Chapter 3: HIGH COUNTRY. The Ashlock mountains, August Calloway's lodge.
// Every shot here is 380 to 700 m. This is the chapter that teaches drop (the
// bullet falls on the way) and wind (the bullet is pushed sideways), and then
// flight time: a walking man has moved by the time the round arrives.
// ---------------------------------------------------------------------------

// ---- wording for the teaching hints ---------------------------------------------
// The hints talk about the marks on the glass, and those depend on the scope
// the player has fitted, so the sentence is built when the hint is shown.
function c3Num(m) { return fmt(Math.abs(m), 1); }
function c3Nth(m, noun) {
  const names = ['centre', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
  const lo = clamp(Math.floor(m), 0, 9), f = m - lo;
  if (f > 0.3 && f < 0.7 && lo >= 1) return 'halfway between the ' + names[lo] + ' and ' + names[lo + 1] + ' ' + noun + 's';
  return 'the ' + names[clamp(Math.round(m), 1, 10)] + ' ' + noun;
}
function c3HoldUp(sim, dist) {
  const st = sim.st, sc = st.scope, up = sim.holdFor(dist).up;
  if (sc.smart) return 'Your smart scope does the sum for you. Put the small amber diamond on his chest, not the crosshair.';
  if (sc.ret === 'bdc' || sc.ret === 'pso') return 'The marks below the centre of your scope are numbered in hundreds of metres. He is about ' + Math.round(dist / 100) * 100 + ' m away, so put the mark numbered ' + Math.round(dist / 100) + ' on his chest instead of the centre.';
  if (sc.ret === 'duplex') {
    const gap = 35 / st.zoomMax, q = clamp(Math.round((up / gap) * 4), 1, 4);
    return 'Your plain scope has no mil marks, so judge it. At full zoom the thin line below the centre is about ' + Math.round(gap) + ' mils long. Put his chest ' + ['a quarter of the way', 'halfway', 'three quarters of the way', 'all the way'][q - 1] + ' down that thin line, not on the centre.';
  }
  if (sc.ret === 'post') return 'Your old scope has no mil marks, so judge it. ' + c3Num(up) + ' mils at this range is about ' + fmt((up * dist) / 1000, 1) + ' m. Hold the tip of the post that far above his chest.';
  const noun = sc.ret === 'mildot' ? 'dot' : 'mark';
  return 'Each ' + noun + ' on the glass is one mil. Count down to ' + c3Nth(up, noun) + ' BELOW the centre and put that on his chest, not the centre itself.' + (sc.turret ? ' Or tap ZERO up to ' + Math.round(dist / 25) * 25 + ' m and aim dead on.' : '');
}
function c3HoldWind(sim, dist) {
  const st = sim.st, sc = st.scope, h = sim.holdFor(dist), side = h.right < 0 ? 'LEFT' : 'RIGHT', other = h.right < 0 ? 'right' : 'left', n = c3Num(h.right);
  if (sc.smart) return 'The amber diamond in your smart scope already allows for the wind. Keep the diamond on him and ignore the centre.';
  if (sc.ret === 'duplex' || sc.ret === 'post') return 'HOLD now shows a second number with a sideways arrow: about ' + n + '. Your scope has no marks to count, so judge it: ' + n + ' mils here is about ' + fmt((Math.abs(h.right) * dist) / 1000, 1) + ' m. Aim that far to the ' + side + ' of him, into the wind, as well as high.';
  return 'HOLD now shows a second number with a sideways arrow: about ' + n + '. Aim that many marks to the ' + side + ' of him, into the wind, as well as high. He should sit just ' + other + ' of the upright line and well below the centre.';
}

// ---- sound for the two kinds of noise cover this chapter adds --------------------
// The audio engine only knows the cover names it shipped with (thunder, train
// and so on). A chainsaw and a squall of wind are wired on here, without
// touching the engine file.
const c3SfxEvent = Sfx.onEvent;
Sfx.onEvent = function (e, sim) {
  c3SfxEvent(e, sim);
  if (!Sfx.ok || e.k !== 'cover') return;
  if (e.name === 'chainsaw') {
    Sfx.tone({ type: 'sawtooth', f: 92, f1: 128, sweep: 0.5, dur: e.dur, att: 0.25, gain: 0.07, lp: 1500, verb: 0.3 });
    Sfx.tone({ type: 'square', f: 184, f1: 250, sweep: 0.6, dur: e.dur, att: 0.3, gain: 0.02, lp: 2200 });
    Sfx.noise({ type: 'bandpass', f: 1500, q: 1.4, dur: e.dur, att: 0.3, gain: 0.07 });
  } else if (e.name === 'wind') {
    Sfx.noise({ type: 'bandpass', f: 380, f1: 900, sweep: e.dur * 0.5, q: 1.1, dur: e.dur, att: e.dur * 0.35, gain: 0.5 });
    Sfx.noise({ type: 'lowpass', f: 260, dur: e.dur, att: e.dur * 0.3, gain: 0.45, brown: true });
  }
};

// Take someone out of a vehicle and stand them on the road (used when the
// convoy is stopped).
function c3Out(sim, H, id, x) {
  const a = sim.byId[id]; if (!a || a.dead || a.gone || !a.inVeh) return null;
  const v = a.inVeh; if (v.seats[a.seat] === id) v.seats[a.seat] = null;
  a.inVeh = null; a.hidden = false; a.anim = a.idle = 'stand'; a.state = 'calm'; a.susp = 0;
  sim.place(a, H.road(x));
  return a;
}

// ---------------------------------------------------------------------------
mission({
  id: 'c3m1', ch: 3, title: 'Thin Air', range: 400,
  objective: 'Quartermaster on the upper deck: red cap, clipboard. Aim high. The bullet falls.',
  brief: 'August Calloway has gone to ground at his hunting lodge in the Ashlocks, and the family\'s money and guns went with him. We take the lodge apart from the outside in. First, his quartermaster: the man who keeps it fed and armed. Red cap, clipboard, up on the long deck counting crates. Nobody else can see that deck. This is four hundred metres, Kestrel, more than twice anything you did in the city. Up here a bullet falls a long way before it arrives. Aim where he is and you will hit the boards at his feet.',
  intel: ['RED cap and a clipboard, on the upper deck. The porter down in the yard is hired help.', 'Range 400 m. No wind today.', 'At this range a .308 lands more than a metre below the crosshair. The HOLD read-out says how far to aim high.', 'He stands still at the table and at the rail. Shoot then, not while he walks.'],
  guide: [
    'The quartermaster wears a RED cap and holds a clipboard, up on the long deck. The porter down in the yard is innocent.',
    'He stands still at the crate table right from the start, for about 16 seconds, and nobody else can see the deck. Shoot straight away.',
    'At 400 m the bullet falls a long way: HOLD reads about 3.1 up, about 1.2 m above his chest.',
    'On the plain Fenwick scope at full zoom (9x), the thin part of the line below the centre is about 4 HOLD units long. Put his chest three quarters of the way down that thin line.',
    'There is almost no wind. Hold your breath and fire once.',
  ],
  wind: { v: 0.3, gust: 0.3 }, par: 1, rules: { kill: ['t'] },
  vantages: [{ name: 'Goat ledge', desc: '400 m across the valley and 40 m above the deck. A rock to rest on.', eye: [0, 40, 0] }],
  look: [-10, 5],
  setup() {
    const H = SCN.valley({ z: 400, eye: 40, time: 'day', seed: 3 });
    H.kit.duck(H.S, H.PD, H.tower.x + 0.5, H.tower.roofY + 0.28, 1.25);
    return H;
  },
  cast(H) {
    const B = H.lodge, door = B.winX(B.door);
    return [
      Object.assign(H.deck(-10), { id: 't', role: 'target', face: 1, anim: 'work', look: { hat: 'cap', hatCol: COL.red, coat: '#3b4a5c', bag: 'clip' },
        routine: [['wait', 16, 'work', 1], ['walk', -22.1], ['wait', 11, 'stand', -1], ['walk', -10], ['wait', 13, 'work', 1], ['walk', -22.1], ['wait', 11, 'stand', -1], ['walk', -10], ['wait', 12, 'work', 1], ['walk', B.winX(4)], ['gone']],
        escapeText: 'He finished the count and went in for his lunch. The lodge is fed and armed for another week.' }),
      Object.assign(H.yard(17), { id: 'c1', role: 'civ', face: -1, look: { hat: 'beanie', hatCol: '#5a4634', coat: COL.olive, bag: 'box' },
        routine: [['wait', 3, 'work', -1], ['walk', door], ['hide'], ['look', { bag: null }], ['wait', 5], ['show'], ['walk', 17], ['look', { bag: 'box' }], ['loop']] }),
    ];
  },
  onAlarm(sim) { const t = sim.byId.t; if (t && !t.dead) t.escapeText = 'He heard the round strike and ran for the trees. The lodge knows somebody is on the mountain now.'; },
  triggers(H) {
    const d = H.z;
    return [
      hint(1.5, 'New ground, new rule. At long range the bullet FALLS on its way. Put the centre of the crosshair on the man in the red cap and the round will land at his feet.', 9),
      { at: 11, do(sim) { sim.msg('hint', 'Point the scope at him and read HOLD under the glass. The up arrow and its number (about ' + c3Num(sim.holdFor(d).up) + ' for this rifle) say how far to aim HIGH. The unit is the mil: one mil is the gap between two marks on a marked scope.', 11.5); } },
      { at: 23, do(sim) { sim.msg('hint', c3HoldUp(sim, d), 14); } },
      say(39, 'Marlow', 'He is counting crates, not looking for you. Wait until he stands still. One round.'),
    ];
  },
  challenge: { id: 'cold', text: 'A headshot with the very first round you fire', test: (sim) => sim.stats.shots === 1 && sim.kills.some((k) => k.id === 't' && k.part === 'head') },
  after: 'Four hundred metres and one round. Remember how far that bullet fell, because everything else on this mountain is further away.',
  solve: [['until', (s) => s.byId.t.goal === null && s.byId.t.wait > 3], ['shoot', 't', 'torso'], ['shoot', 't', 'torso']],   // the second shot is only taken if the first misses
  reward: { cr: 1800, xp: 420 },
});

// ---------------------------------------------------------------------------
mission({
  id: 'c3m2', ch: 3, title: 'Crosswind', range: 450,
  objective: 'The lookout in the hunting tower. Hold into the wind. Do not hit the cook.',
  brief: 'Calloway keeps a lookout in the hunting tower at the edge of the trees, with binoculars and a radio. While he is up there nothing moves on this side of the valley without the lodge knowing. Four hundred and fifty metres, and today there is a wind: five metres a second, steady, left to right. It will carry your bullet half a metre off line before it gets there. The lodge cook climbs up with his soup and stands right beside him. The cook has done nothing to anybody. Read the flag, hold into the wind, and do not make me explain a dead cook to the client.',
  intel: ['Lookout: olive jacket and binoculars, up in the hunting tower on the left.', 'Range 450 m. Wind 5 m/s, steady, blowing left to right.', 'The cook in white visits and stands on his right: downwind, where a careless shot will drift.', 'The flag beside the tower and the smoke from the chimney show the wind.'],
  guide: [
    'The lookout is in the hunting tower on the left: olive jacket, binoculars. The cook in white with a top hat brings him soup and stands beside him.',
    'Wait for the cook to climb down from the tower and walk off toward the lodge, from about 20 seconds in. After that, shoot when you are ready.',
    'Aim high for the drop: HOLD reads about 3.8 up, about 1.7 m above his chest. On the plain scope at full zoom, his chest sits right at the tip of the thick post below the centre.',
    'Aim left for the wind, which blows hard left to right: HOLD reads about 1.2 left, about half a metre (two body-widths) to his left.',
    'The flag beside the tower shows the wind. Hold your breath and fire once.',
  ],
  wind: { v: 5, gust: 0.5 }, par: 1, rules: { kill: ['t'] },
  vantages: [{ name: 'Scree shelf', desc: '450 m, a little above the tower. Open to the wind.', eye: [0, 46, 0] }],
  look: [-57, 8],
  setup() {
    const H = SCN.valley({ z: 450, eye: 46, time: 'day', seed: 5, flagX: -47 });
    H.kit.duck(H.S, H.PD, H.woodpile.x, H.woodpile.y + 0.27, 1.3);
    return H;
  },
  cast(H) {
    const T = H.tower, B = H.lodge;
    const stairTop = { plane: H.PD, x: T.stairTop, y: T.floor, zone: 'yard', room: null, behind: false };
    const watch = []; for (let i = 0; i < 10; i++) watch.push(['wait', 9, 'look', -1], ['wait', 7, 'look', 1]);
    return [
      Object.assign(T.place(-0.6), { id: 't', role: 'target', face: -1, anim: 'look', look: { hat: 'cap', hatCol: '#4a5a3a', coat: '#55653c', beard: '#5a4634' },
        routine: watch.concat([['hide'], ['gone']]), escapeText: 'His watch ended and he climbed down to sleep. The next man up there will be fresher.' }),
      Object.assign(T.place(0), { id: 'cook', role: 'civ', face: -1, anim: 'talk', yFn: T.stairY, look: { hat: 'tophat', hatCol: '#f4f1e6', coat: '#f4f1e6', long: true, bag: 'cup' },
        failText: 'That was the cook. He made soup for a living. The contract is void.',
        routine: [['wait', 15, 'talk', -1], ['to', stairTop], ['speed', 0.55], ['walk', T.stairFoot], ['speed', 1], ['walk', B.winX(B.door) - 1.5], ['hide'], ['wait', 9], ['show'], ['walk', T.stairFoot], ['speed', 0.55], ['walk', T.stairTop], ['speed', 1], ['to', T.place(0)], ['loop']] }),
    ];
  },
  onAlarm(sim) { const t = sim.byId.t; if (t && !t.dead) t.escapeText = 'The lookout dropped behind the boards and got on his radio. The whole valley knows about you now.'; },
  triggers(H) {
    const d = H.z;
    return [
      hint(1.5, 'Wind pushes a bullet sideways. The flag beside the tower and the smoke from the chimney lean the way it blows, and fly flatter the harder it blows. Today: hard, from left to right.', 10),
      { at: 12, do(sim) { sim.msg('hint', c3HoldWind(sim, d), 13); } },
      hint(26, 'Two holds at once: high for the fall, and left for the wind. The cook stands downwind of him, exactly where a lazy shot will drift.', 10),
      say(40, 'Marlow', 'The cook goes back to his kitchen in a moment. A patient shot is a clean one.'),
      onEv('dead:t', (sim) => { const c = sim.byId.cook; H.withCook = !c.dead && c.room === 'hide'; }),
    ];
  },
  challenge: { id: 'thread', text: 'Take the lookout while the cook is standing beside him', test: (sim) => !!sim.A.withCook },
  after: 'The tower is empty and the cook is back at his stove, none the wiser. Drop and wind together: up here, that is the whole trade.',
  solve(H) { const T = H.tower; return [['until', (s) => { const c = s.byId.cook; return c.room !== 'hide' && !c.hidden && c.x > T.stairFoot + 5; }], ['shoot', 't', 'torso'], ['shoot', 't', 'torso']]; },
  reward: { cr: 2000, xp: 440 },
});

// ---------------------------------------------------------------------------
mission({
  id: 'c3m3', ch: 3, title: 'The Gondola', range: 500, needs: { glass: true },
  objective: 'White hat, tan coat, riding up in the red cable car. It stops once, at the middle pylon.',
  brief: 'Lars Venn carries the Calloway payroll. Every week he rides the old cable car up to the lodge with the cash and one bodyguard, and he never sets foot on the road. So we take him in the air. Venn wears a white hat and a tan coat. The bodyguard is the big one in black. The car climbs slowly, and it stops at the middle pylon for a few seconds while the winding gear changes over. Five hundred metres: your bullet needs most of a second to arrive, and there is glass in the way. The staff ride down in the other car. Leave them out of it.',
  intel: ['Venn: WHITE hat, TAN coat, in the RED car going up. His bodyguard is the big man in black.', 'Range 500 m. Wind 2 m/s from the left.', 'The red car stops at the middle pylon for about seven seconds.', 'Cabin glass knocks a bullet a few centimetres off line. Aim for the middle of his chest.', 'The yellow car coming down carries lodge staff. The cook wears a white hat too.'],
  guide: [
    'You need a rifle that shoots through glass (the Fenwick 77 can). Venn wears a WHITE hat and a TAN coat in the RED cable car going up, and the big man in black is his bodyguard.',
    'The yellow car coming down carries staff, including a cook in a white hat. Never shoot at it.',
    'Wait for the red car to stop at the middle pylon, about 45 seconds in. It stays about 7 seconds.',
    'Aim for the middle of his chest, because the glass nudges the bullet. HOLD reads about 4.4 up and 0.7 left.',
    'That is about 2.2 m above his chest (just onto the thick post below the centre at full zoom) and about a body-width to his left, into the wind.',
    'Hold your breath and fire once while the car is still.',
  ],
  wind: { v: 2, gust: 0.8 }, par: 1, rules: { kill: ['t'] },
  vantages: [{ name: 'Avalanche fence', desc: '500 m from the cable, looking across at the middle pylon.', eye: [0, 60, 0] }],
  look: [-72, 15],
  setup() {
    // the pines beside the lodge are kept short here so the cable car is never lost behind them
    const H = SCN.valley({ z: 500, focus: 'cable', eye: 60, time: 'day', seed: 7, pines: [[-50, 13], [-56.5, 15], [-73, 14], [-80, 12], [-88, 13], [6, 14], [68, 17], [75, 15], [84, 19], [91, 16]] });
    H.PC2 = H.S.plane(H.zD + 49, 'cable2'); H.PC2.groundY = 1;
    H.kit.duck(H.S, H.PC, 62.3, H.cable.yAt(62.3) + 1.05, 1.4);
    return H;
  },
  cast() {
    const stay = [['wait', 999]];
    return [
      { id: 'bg', role: 'guard', look: { build: 'big', hat: 'beanie', hatCol: '#1d2026', coat: '#1d2026', long: true }, flee: stay },
      { id: 't', role: 'target', look: { hat: 'fedora', hatCol: '#f1ede2', hatBand: '#22252b', coat: COL.tan, long: true, bag: 'case' }, flee: stay, escapeText: 'The car reached the top station with Venn and the payroll both aboard.' },
      { id: 'maid', role: 'civ', look: { hair: 'bun', dress: COL.navy, coat: COL.navy }, flee: stay },
      { id: 'cook', role: 'civ', look: { hat: 'tophat', hatCol: '#f4f1e6', coat: '#f4f1e6', long: true }, flee: stay, failText: 'That was the cook, in the wrong car. White hat, yes. Tan coat, no.' },
    ];
  },
  vehicles(H) {
    const up = H.cable.carY, dn = (x) => H.cable.carY(x) + 0.75;
    return [
      { id: 'car2', kind: 'gondola', plane: H.PC2, x: 122, y: dn(122), dir: -1, col: '#e2b33c', seats: ['maid', null, 'cook'], yFn: dn, routine: [['drive', 18, 2.4], ['waitFor', 'going'], ['drive', -132, 2.4], ['gone']] },
      { id: 'car1', kind: 'gondola', plane: H.PC, x: -100, y: up(-100), dir: 1, col: '#c8372d', seats: ['bg', 't', null], yFn: up, routine: [['wait', 3], ['drive', 0, 2.4], ['emit', 'stopped1'], ['wait', 7], ['emit', 'going'], ['drive', 132, 2.4], ['gone']] },
    ];
  },
  // people in a cable car stand up
  start(sim) { ['bg', 't', 'maid', 'cook'].forEach((id) => { const a = sim.byId[id]; a.anim = a.idle = 'stand'; }); },
  onAlarm(sim) { sim.after(1.0, () => { const t = sim.byId.t; if (t && !t.dead && !sim.winAt) { t.hidden = true; t.escapeText = 'Venn dropped to the floor of the car and stayed there all the way to the top.'; sim.leave(t); } }); },
  triggers() {
    return [
      hint(1.5, 'The red cable car is climbing from the lower left with two men in it. You want the one in the WHITE hat and tan coat, not the big man in black.', 10),
      hint(13, 'The car is moving and your bullet takes most of a second to get there. Either aim ahead of him by about a window and a half, or wait: the car stops at the middle pylon.', 12),
      onEv('stopped1', (sim) => sim.msg('Marlow', 'Stopped at the pylon. Seven seconds. Glass will nudge the round, so put it in the middle of his chest.')),
      onEv('going', (sim) => { if (sim.alive('t')) sim.msg('Marlow', 'Moving again, and the staff car is about to pass behind it. Mind what is behind your target.'); }),
    ];
  },
  challenge: { id: 'moving', text: 'Hit him while the car is moving', test: (sim) => sim.kills.some((k) => k.id === 't' && k.moving) },
  after: 'The car reached the top station with a case of cash and nobody to sign for it. August will have to pay his men in promises now.',
  solve: [['until', (s) => s.did('stopped1')], ['wait', 0.9], ['hold'], ['shoot', 't', 'torso'], ['shoot', 't', 'torso']],
  reward: { cr: 2200, xp: 470 },
});

// ---------------------------------------------------------------------------
// The convoy stops as one when anything goes wrong at the front.
function c3Halt(sim, H, why) {
  if (H.halted !== undefined || sim.alarmT !== null) return;
  H.halted = sim.t; H.why = why;
  const lx = H.logX, order = ['lead', 'mid', 'rear'].map((id) => sim.byId[id]).filter((v) => !v.gone);
  let lim = why === 'logs' ? lx + 4.8 : -1e9, front = null;
  order.forEach((v) => {
    if (why === 'logs' && !v.wrecked && v.x < lx - 4) return;           // already past the logs: it carries on to the lodge
    const half = v.def.len / 2;
    if (!front) front = v;
    let gx;
    if (v.flatTire || v.wrecked) gx = v.x - 1.5;
    else {
      gx = Math.min(v.x - 1.5, Math.max(v.x - 7, lim + half));
      v.routine = [['drive', gx, 4], ['waitFor', 'c3go'], ['drive', -155, 6], ['gone']]; v.pc = 0; v.goal = null; v.wait = 0; v.waitFor = null;
    }
    lim = gx + half + 4.6; v.stopAt = gx;
  });
  if (!front) return;
  sim.msg('Marlow', why === 'logs' ? 'Road blocked. They have stopped. Give Hale a moment: he will get out to shout at somebody.' : 'That is a flat. They have all stopped. Give Hale a moment: he will get out to shout at somebody.');
  // two men walk forward to look at the trouble, with their backs to the cars
  const spot = why === 'logs' ? lx + 4.6 : front.stopAt - front.def.len / 2 - 0.4;
  const crew = (front.seats || []).filter((id) => id && sim.alive(id) && id !== 't');
  sim.after(2.4, () => {
    if (sim.alarmT !== null) return;
    crew.forEach((id, i) => { const seat = sim.byId[id].seat, a = c3Out(sim, H, id, front.x + 1.2 - i * 1.6); if (!a) return;
      sim.setRoutine(a, [['walk', spot + i * 1.3], ['wait', 21, i ? 'work' : 'kneel', -1], ['walk', front.x + 1.2 - i * 1.6], ['veh', front.id, seat]]); });
  });
  // the banker gets out of his own car to see what the delay is
  const tv = sim.byId.rear;
  if (tv.gone || tv.wrecked || (why === 'logs' && tv.x < lx - 4)) return;
  sim.after(5.2, () => {
    if (sim.alarmT !== null) return;
    const a = c3Out(sim, H, 't', tv.x + 0.4); if (!a) return;
    sim.setRoutine(a, [['walk', tv.x - tv.def.len / 2 - 2.3], ['wait', 15, 'phone', -1], ['walk', tv.x + 0.4], ['veh', 'rear', 1], ['emit', 'c3back']]);
  });
  sim.after(31, () => { if (sim.alarmT === null) { if (H.logs) H.logs.logs.cleared = true; sim.emit('c3go'); } });
}

mission({
  id: 'c3m4', ch: 3, title: 'Convoy', range: 550,
  objective: 'Hale is in the car with the orange roof box. Stop the convoy.',
  brief: 'August is moving his money abroad, and the man who moves it is on his way up the mountain now. Corwin Hale, the family banker. Three vehicles on the lodge road, and he rides in the back of the one with the orange box on its roof. If that convoy reaches the lodge the money is gone by morning, so it does not reach the lodge. A logging crew has left a load of timber hanging over the road. Loads fall. Stop them, and Hale will climb out to shout at someone: he always does. Five hundred and fifty metres. Their chainsaw is the only cover you will get.',
  intel: ['Three vehicles coming from the right. Hale is in the BACK of the one with the ORANGE roof box.', 'Hale: wine-red coat, glasses, briefcase. Range 550 m, wind 3 m/s from the left.', 'Logs hang over the road from a yellow hook block. A flat tyre would also stop a car.', 'The logging crew\'s chainsaw covers a loud shot while it is running.', 'A bullet takes nearly a second to get there. A car at speed needs a lead of a full car length.'],
  guide: [
    'Hale rides in the BACK of the car with the ORANGE roof box, the last of three coming from the right. He wears a wine-red coat and glasses.',
    'Your rifle is loud, so fire only while the loggers\' chainsaw runs (NOISE COVER on). It runs about 7 seconds out of every 12, starting 2 seconds in.',
    'When the second chainsaw run starts (about 14 seconds in), shoot the yellow hook block holding the logs over the road, before the first car gets there. The logs drop and block the road.',
    'About 26 seconds in Hale gets out, walks a few steps forward and stops to phone for about 15 seconds. Shoot him in the chest as the chainsaw starts again.',
    'Both shots need a big hold: HOLD reads about 5.0 up and 0.9 left, about 2.8 m high (one and a half times his height) and half a metre left. The wind blows left to right; hold your breath for each shot.',
  ],
  wind: { v: 3, gust: 1 }, par: 2,
  rules: { kill: ['t'], time: 78, timeText: 'The convoy reached the lodge. By morning the Calloway money will be out of the country.' },
  vantages: [{ name: 'Rockfall', desc: '550 m from the road, looking down on the bend below the lodge.', eye: [0, 72, 0] }],
  look: [44, -9],
  setup() {
    const H = SCN.valley({ z: 550, focus: 'road', eye: 72, time: 'day', seed: 9 });
    const S = H.S, PR = H.PR, ry = H.roadY, lx = 16; H.logX = lx;
    // the logging crew's gantry beside the road, with a bundle hanging from it
    const pole = S.tone('#5a4634', PR), dark = S.tone('#3a2c22', PR);
    PR.add({ x0: lx - 9, x1: lx + 9, layer: 0, draw(ctx, env) {
      line(ctx, lx - 7.6, ry + 0.7, lx - 6.2, ry + 11.4, pole, 0.34, env); line(ctx, lx + 7.6, ry + 0.7, lx + 6.2, ry + 11.4, pole, 0.34, env);
      R4(ctx, lx - 7, ry + 11.1, 14, 0.45, dark); line(ctx, lx - 7.3, ry + 4, lx - 4.4, ry + 11.1, pole, 0.15, env); line(ctx, lx + 7.3, ry + 4, lx + 4.4, ry + 11.1, pole, 0.15, env);
    } });
    H.logs = H.kit.logs(S, PR, lx, ry + 9.6, { id: 'logs', floor: ry, top: ry + 11.1 });
    K.box(S, PR, 31, ry + 0.75, 7.5, 1.5, '#6a4a30', { ribs: 0.5, band: 0.12, mat: 'wood' });   // cut timber stacked on the verge
    H.kit.duck(S, PR, 37.2, ry + 2.55, 1.45);
    return H;
  },
  cast(H) {
    return [
      { id: 'd1', role: 'guard', look: { hat: 'beanie', coat: '#39404a' } },
      { id: 'ga', role: 'guard', look: { hat: 'cap', hatCol: '#2a2d33', coat: '#3a2f2a', build: 'big' } },
      { id: 'd2', role: 'guard', look: { hat: 'peaked', hatCol: '#1d2026' } },
      { id: 'dec', role: 'guard', look: { hat: 'fedora', hatCol: '#22252b', coat: '#4a505a', long: true } },
      { id: 'd3', role: 'guard', look: { hat: 'peaked', hatCol: '#1d2026' } },
      { id: 't', role: 'target', look: { hair: 'short', hairCol: '#b9a070', glasses: true, coat: COL.wine, long: true, bag: 'case' }, flee: [['run', -155], ['gone']], escapeText: 'Hale got through to the lodge with the account books under his arm.' },
      Object.assign(H.road(42.5, { y: H.roadY + 0.75, zone: 'verge' }), { id: 'c1', role: 'civ', face: -1, anim: 'work', look: { hat: 'hardhat', hatCol: COL.orange, vest: COL.yellow, phones: '#c8372d' }, routine: [['wait', 999, 'work', -1]], failText: 'You shot a man who was cutting firewood. The contract is void.' }),
    ];
  },
  vehicles(H) {
    const mk = (id, kind, x, col, seats) => ({ id, kind, plane: H.PR, x, y: H.roadY, dir: -1, col, seats, routine: [['wait', 4], ['drive', -155, 6], ['gone']] });
    return [mk('lead', 'pickup', 118, '#66733f', ['d1', 'ga']), mk('mid', 'suv', 132, '#15171b', ['d2', 'dec']), mk('rear', 'suvbox', 146, '#15171b', ['d3', 't'])];
  },
  onAlarm(sim) {
    ['lead', 'mid', 'rear'].forEach((id) => { const v = sim.byId[id]; if (v.gone || v.flatTire || v.wrecked) return; v.routine = [['drive', -155, 15], ['gone']]; v.pc = 0; v.goal = null; v.wait = 0; v.waitFor = null; });
  },
  triggers(H) {
    const tr = [
      { at: 2, every: 12, do(sim) { const c = sim.byId.c1; if (sim.alarmT === null && c && !c.dead && c.state === 'calm') sim.cover(7, 'chainsaw'); } },
      say(2.5, 'Marlow', 'Three vehicles coming up from the right. Hale is in the back of the one with the orange box on its roof.'),
      hint(9, 'Cars at speed are hard to hit from here. Stop them first: shoot the yellow hook block and the logs drop across the road. Do it before the first car gets there.', 11),
      onEv('crash:logs_p', (sim) => {
        // anything under the logs when they land is finished
        ['lead', 'mid', 'rear'].forEach((id) => { const v = sim.byId[id]; if (v.gone || Math.abs(v.x - H.logX) > v.def.len / 2 + 2.5) return;
          v.wrecked = true; v.seats.forEach((sid) => { const a = sim.byId[sid]; if (a && !a.dead && a.inVeh === v) sim.killActor(a, 'torso', 'accident', null); });
          v.routine = [['brake']]; v.pc = 0; v.goal = null; v.wait = 0; v.waitFor = null; sim.emit('wrecked:' + id); });
        c3Halt(sim, H, 'logs');
      }),
      onEv('c3back', (sim) => { if (sim.alarmT === null) { if (H.logs) H.logs.logs.cleared = true; sim.emit('c3go'); } }, 2.5),
      onEv('c3go', (sim) => { if (sim.alive('t')) sim.msg('Marlow', 'They are rolling again. Through the glass now, or not at all.'); }),
    ];
    ['lead', 'mid', 'rear'].forEach((id) => tr.push(onEv('flat:' + id, (sim) => c3Halt(sim, H, 'flat'))));
    return tr;
  },
  challenge: { id: 'timber', text: 'Make it an accident: drop the logs on his car', test: (sim) => sim.kills.some((k) => k.id === 't' && k.accident) },
  after: 'Hale and his account books stay on the mountain. August can still run, but he will have to do it poor.',
  solve(H, st) {
    const lead = st.action === 'charge' ? 2.1 : 1.2;
    const cov = (s) => st.quiet || (s.covered() && s.coverUntil - s.t > lead);
    return [
      ['until', (s) => { const v = s.byId.lead; return v.x < 62 && v.x > 44 && cov(s); }, 60],
      ['shootObj', 'logs'],
      ['until', (s) => { const t = s.byId.t; return !t.inVeh && t.goal === null && t.anim === 'phone' && t.wait > 3 && cov(s); }, 50],
      ['hold'],
      ['shoot', 't', 'torso'],
      ['shoot', 't', 'torso'],
    ];
  },
  reward: { cr: 2400, xp: 500 },
});

// ---------------------------------------------------------------------------
mission({
  id: 'c3m5', ch: 3, title: 'Whiteout', range: 380,
  objective: 'The radio operator in red headphones, and the dish on the mast. No alarm before both.',
  brief: 'A storm has shut the mountain and August is nervous. He has a helicopter waiting in the valley, and one radio call brings it up to lift him out the moment the cloud breaks. So before the weather clears, the radio goes. Two things: the operator, who sits at the lit upstairs window in red headphones, and the dish on the mast at the end of the lodge. Either order. But if anyone raises the alarm before both are done, that call gets made. You will not see much. When the squalls come through you will not see anything at all, and neither will they. Nor hear.',
  intel: ['Radio operator: RED headphones, sitting at the lit upstairs window on the right.', 'The dish is on the mast at the right-hand end of the lodge.', 'Range 380 m. A squall of wind covers a loud shot, and hides the lodge while it lasts. Aim before it arrives.', 'A second man warms himself in the radio room now and then, and the deck guard looks in as he passes.', 'With the dish gone nobody can radio: a guard who finds a body has to run for help instead.'],
  guide: [
    'Two jobs, and no alarm before both: the radio operator (RED headphones, lit upstairs window on the right) and the dish on the mast at the right end of the lodge.',
    'Your rifle is loud, so fire only in a squall, when NOISE COVER shows WIND. The first comes about 9 seconds in and lasts about 6 seconds, and the snow mostly whites out your view, so aim before it arrives.',
    'Just as the first squall starts, the big man in the dark red beanie leaves the radio room for a long while. Shoot the operator in the chest then.',
    'Then swing right to the dish and shoot it before the squall ends. Operator first: if the dish breaks first, he gets up and goes for help.',
    'Same hold for both: HOLD reads about 2.9 up and 0.5 left, about 1.1 m high and about 20 cm left. On the plain scope at full zoom, the target sits three quarters of the way down the thin line below the centre.',
  ],
  wind: { v: 3.5, gust: 2.5 }, par: 2,
  rules: { kill: ['op'], destroy: ['dish'], strict: true, strictText: 'The alarm went up and the call went out. The helicopter is already on its way to lift August off the mountain.' },
  vantages: [{ name: 'Snow hole', desc: '380 m, dug in under a cornice straight across from the lodge.', eye: [0, 34, 0] }],
  look: [-8, 5],
  setup() {
    const H = SCN.valley({ z: 380, eye: 34, time: 'snow', fog: 2.1, seed: 11, pylons: [-60, 24, 84], lodge: { spans: { 1: [[5, 6, 'radio', true]] }, wins: { '1,1': { lit: true }, '0,6': { lit: true }, '2,3': { lit: true }, '1,5': { blind: 0 }, '1,6': { blind: 0 } } } });
    const S = H.S, B = H.lodge;
    S.seeMul = 0.5;
    H.dish = H.kit.dish(S, H.PL, B.x + B.w + 1.7, 0, 9.4, { id: 'dish', face: 1, extra: { onHit(sim, ob) { sim.noise(ob.x, 0, H.PD, 'crash', 9); } } });
    // lanterns: a warm glow that follows each patrolling guard through the snow
    H.PD.add({ x0: -1e4, x1: 1e4, layer: 2, draw(ctx) {
      const sim = H.sim; if (!sim) return;
      for (const id of ['g1', 'g2']) {
        const a = sim.byId[id]; if (!a || a.dead || a.gone || a.hidden) continue;
        const lx = a.x + a.face * 0.42, ly = a.y + 0.8, g = ctx.createRadialGradient(lx, ly, 0.05, lx, ly, 2.4);
        g.addColorStop(0, 'rgba(255,176,64,0.75)'); g.addColorStop(0.35, 'rgba(255,176,64,0.28)'); g.addColorStop(1, 'rgba(255,176,64,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, 2.4, 0, TAU); ctx.fill(); circ(ctx, lx, ly, 0.13, '#fff3c4');
      }
    } });
    // the squall: a white curtain right in front of the scope that thickens with the gusts
    const PV = S.plane(26, 'veil'); H.veil = { a: 0.08 };
    PV.add({ x0: -1e5, x1: 1e5, layer: 2, draw(ctx, env) {
      const a = H.veil.a; if (a < 0.01) return;
      ctx.fillStyle = 'rgba(240,244,248,' + a.toFixed(3) + ')'; ctx.fillRect(env.x0 - 1, env.y0 - 1, env.x1 - env.x0 + 2, env.y1 - env.y0 + 2);
      if (a > 0.2) { // driven snow
        const w = env.x1 - env.x0, h = env.y1 - env.y0, dir = env.wind >= 0 ? 1 : -1;
        ctx.strokeStyle = 'rgba(255,255,255,' + Math.min(0.85, a * 1.1).toFixed(3) + ')'; ctx.lineWidth = Math.max(env.px * 1.4, 0.002); ctx.beginPath();
        for (let i = 0; i < 70; i++) { const u = (i * 0.6180339 + env.t * (0.9 + (i % 5) * 0.22) * dir) % 1, v = (i * 0.3819 + env.t * 0.35) % 1, x = env.x0 + ((u + 1) % 1) * w, y = env.y1 - v * h; ctx.moveTo(x, y); ctx.lineTo(x + dir * w * 0.07, y - h * 0.018); }
        ctx.stroke();
      }
    } });
    H.kit.duck(S, H.PD, H.pad.x + 10.4, 0.95, 1.2);
    return H;
  },
  start(sim, H) { H.sim = sim; },
  tick(sim, H, dt) { const want = sim.covered() && sim.coverName === 'wind' ? 0.72 : 0.08; H.veil.a += (want - H.veil.a) * Math.min(1, dt * 1.5); },
  cast(H) {
    const B = H.lodge;
    return [
      Object.assign(H.inLodge(1, 6, -0.15), { id: 'op', role: 'target', face: -1, anim: 'type', look: { phones: COL.red, hair: 'short', coat: '#5b6875' }, routine: [['wait', 9999, 'type', -1]], escapeText: 'The operator got to the set first. The helicopter is on its way.' }),
      Object.assign(H.inLodge(1, 5, 0), { id: 'm2', role: 'guard', face: 1, anim: 'drink', look: { hat: 'beanie', hatCol: '#5a2a2a', coat: '#3a2f2a', build: 'big' },
        routine: [['wait', 9, 'drink', 1], ['hide'], ['to', H.inLodge(0, 1, 0)], ['wait', 26], ['to', H.inLodge(1, 5, 0)], ['show'], ['wait', 8, 'drink', 1], ['loop', 1]] }),
      Object.assign(H.deck(-31), { id: 'g1', role: 'guard', face: 1, anim: 'guard', look: { hat: 'hood', hatCol: '#3b4654', coat: '#3b4654', long: true }, routine: [['wait', 4, 'guard', 1], ['walk', 4], ['wait', 5, 'guard', -1], ['walk', -31], ['loop']] }),
      Object.assign(H.yard(30), { id: 'g2', role: 'guard', face: -1, anim: 'guard', look: { hat: 'hood', hatCol: '#4a3f36', coat: '#4a3f36', long: true }, routine: [['wait', 5, 'guard', -1], ['walk', -30], ['wait', 5, 'guard', 1], ['walk', 30], ['loop']] }),
    ];
  },
  triggers(H) {
    const B = H.lodge, w5 = B.winX(5), w6 = B.winX(6);
    return [
      { at: 9, every: 17, do(sim) { sim.cover(6.5, 'wind'); } },
      hint(1.5, 'Two jobs, in either order: the radio operator at the lit upstairs window (red headphones), and the dish on the mast at the right-hand end of the lodge. No alarm before both are done.', 9),
      hint(12, 'With a loud rifle, fire only while NOISE COVER shows WIND. The squall hides the lodge as well, so settle your aim on the spot before it arrives.', 11),
      say(24, 'Marlow', 'Watch the room before you fire into it. There is a second man in there some of the time, and the deck guard looks in as he goes by.'),
      // the deck guard glances through the radio room window as he passes it
      { when: (sim) => { const op = sim.byId.op, g = sim.byId.g1; return op.dead && !op.hidden && !g.dead && (g.state === 'calm' || g.state === 'susp') && Math.abs(g.x - op.x) < 3.2; }, do(sim) { sim.ev.push({ k: 'bodyfound', id: 'g1', body: 'op' }); sim.startle(sim.byId.g1, 'body'); } },
      // a dead set brings the operator to his feet: he looks out at the mast, then goes for help
      onEv('obj:dish', (sim) => {
        const op = sim.byId.op; if (op.dead) return;
        sim.msg('Marlow', 'The set has gone dead and he has noticed. He is on his feet. Finish it before he fetches someone.');
        sim.setRoutine('op', [['wait', 2.2, 'type', -1], ['look', { phones: null }], ['walk', w5 + 0.3], ['wait', 4.5, 'look', -1], ['walk', w6 + 0.9], ['call', (s) => s.raiseAlarm('target', 0.3)], ['hide']]);
      }),
    ];
  },
  challenge: { id: 'onegust', text: 'Operator and dish inside three seconds of each other', test: (sim) => { const k = sim.kills.find((q) => q.id === 'op'), d = sim.emitted['obj:dish']; return !!k && d !== undefined && Math.abs(k.t - d) <= 3; } },
  after: 'The lodge is off the air. When the cloud lifts nobody is coming for him, unless he sends a man down the mountain on foot.',
  solve(H, st) {
    const need = (st.mag === 1 ? st.cycle + st.reload : st.cycle) + 0.9 + (st.action === 'charge' ? 1.8 : 0);
    const cov = (s, n) => st.quiet || (s.covered() && s.coverUntil - s.t > n);
    return [
      ['until', (s) => { const op = s.byId.op, m = s.byId.m2, g = s.byId.g1, d = g.x - op.x;
        return cov(s, need) && m.hidden && m.wait > need + 6 && (Math.abs(d) > 9 || (Math.abs(d) > 4.6 && g.goal !== null && sign(g.goal - g.x) === sign(d))); }, 200],
      ['shoot', 'op', 'torso'],
      ['shoot', 'op', 'torso'],
      ['shootObj', 'dish'],
      ['shootPt', () => (H.dish.alive ? { x: H.dish.x, y: H.dish.y, z: H.dish.plane.z } : null)],
    ];
  },
  reward: { cr: 2500, xp: 520 },
});

// ---------------------------------------------------------------------------
mission({
  id: 'c3m6', ch: 3, title: 'First Light', range: 480,
  objective: 'Both of August\'s guards, deck and yard. Any alarm and he is gone before breakfast.',
  brief: 'Tomorrow August flies out, so today we take away the two men he trusts to stand over him. One walks the deck, one walks the yard. Both go this morning, and nobody shouts: if August hears a thing he will be over the pass by breakfast and we start again in another country. You have a choice of ground. The near ridge is a comfortable shot, but two pines stand in the way and a rifle can be heard from there. The far peak sees everything and hears nothing, and it is seven hundred metres in a crosswind. The chapel in the valley rings at first light. Use it.',
  intel: ['Deck guard: big man, dark beanie. Yard guard: grey cap. Both carry rifles.', 'Near ridge, 480 m: a shot is heard unless the chapel bells are ringing. Two pines hide the right-hand end of the deck.', 'Far peak, 700 m: too far for a .308 to be heard, and nothing in the way. More wind.', 'The two guards can see each other, deck to yard, when they face one another within about 30 m.', 'A maid shakes out a cloth at the left end of the deck now and then. She is not part of this.'],
  guide: [
    'These steps are for the Near ridge. Your targets are the deck guard (big, dark beanie) and the yard guard (grey cap), never the maid on the deck.',
    'Your rifle is heard from here, so fire only while the chapel bells ring: about 12 seconds in, for 10 seconds.',
    'Shoot the yard guard first, while he walks left across the yard. Lead him: aim about a metre ahead of him (to his left), on top of the wind hold.',
    'Then shoot the deck guard, who stands still in the middle of the deck from about 14 seconds in. Both must fall before the bells stop.',
    'HOLD reads about 4.1 up (about 2 m above the chest) and 0.8 left (about 40 cm). The wind blows left to right; for the walking yard guard, add the lead for about 2.8 left in all.',
    'The other spot, the Far peak, is too far away to be heard, so you need no bells, but it is a 700 m shot in more wind.',
  ],
  wind: { v: 4, gust: 1 }, par: 2,
  rules: { kill: ['g1', 'g2'], strict: true, strictText: 'The alarm went up. August left by the back road before the sun cleared the ridge.' },
  sight: { yard: ['deck'], deck: ['yard'] },
  vantages: [
    { name: 'Near ridge', desc: '480 m. A steady rest out of the wind. Two tall pines hide the right-hand end of the deck, and a shot can be heard from here.', eye: [0, 44, 0], windMul: 0.75, tag: 'Shorter shot' },
    { name: 'Far peak', desc: '700 m. Everything in view and too far to be heard. A very long shot, in more wind.', eye: [-55, 120, -220], windMul: 1.3, tag: 'Clear view, hard shot', look: [-16, 5] },
  ],
  look: [-16, 5],
  setup() {
    const near = [0, 44, 0];
    const H = SCN.valley({ z: 480, eye: 44, time: 'dawn', seed: 13, top: 138, lodge: { wins: { '2,3': { lit: true }, '0,1': { lit: true }, '0,6': { lit: true } } } });
    H.screen = [H.screenPine(near, 0.8, H.deckY + 1.1, { h: 31 }), H.screenPine(near, 6.4, H.deckY + 1.0, { h: 28 })];
    H.kit.duck(H.S, H.PR, H.gate.x - 3.5, H.roadY + 4.5, 1.4);
    return H;
  },
  cast(H) {
    const home = H.inLodge(1, 0, 0);
    return [
      Object.assign(H.deck(-29), { id: 'g1', role: 'guard', face: -1, anim: 'guard', look: { hat: 'beanie', hatCol: '#22252b', coat: '#2a333a', build: 'big', h: 1.05 },
        routine: [['wait', 4, 'guard', -1], ['walk', -16], ['wait', 6, 'guard', 1], ['walk', 2.5], ['wait', 6, 'guard', 1], ['walk', -16], ['wait', 6, 'guard', -1], ['walk', -29], ['loop']] }),
      Object.assign(H.yard(30), { id: 'g2', role: 'guard', face: -1, anim: 'guard', look: { hat: 'cap', hatCol: '#9aa0a8', coat: '#4a3f36' },
        routine: [['wait', 6, 'guard', -1], ['walk', -22], ['wait', 6, 'guard', 1], ['walk', 30], ['loop']] }),
      Object.assign({}, home, { id: 'maid', role: 'civ', hidden: true, face: 1, look: { hair: 'bun', dress: COL.navy, coat: '#e9e4d6' }, failText: 'You shot the maid. The contract is void, and August is awake.',
        routine: [['wait', 30], ['to', H.deck(-32)], ['show'], ['wait', 10, 'sweep', 1], ['hide'], ['to', home], ['wait', 36], ['loop', 1]] }),
    ];
  },
  triggers() {
    return [
      { at: 12, every: 40, do(sim) { sim.cover(10, 'church bells'); if (sim.t < 20) sim.msg('Marlow', 'There are the chapel bells. Ten seconds of noise, then quiet until they ring again.'); } },
      { at: 2, do(sim) { sim.msg('Marlow', sim.vi === 1 ? 'Seven hundred metres. They will not hear you from up here, but the man who is left will look around when the echo reaches him. Do not leave a body where he can see it.' : 'Two of them, one up, one down. From this ridge they will hear a rifle, so wait for the bells, and take the first where the second cannot see him fall.'); } },
      hint(7, 'The deck guard and the yard guard can see each other when they face one another. Take one while the other is far off or looking away, then the second before he finds the first.', 11),
    ];
  },
  challenge: { id: 'farpeak', text: 'Do it from the far peak', test: (sim, res) => res.vantage === 1 },
  after: 'Two men down and the house still asleep. He will wake with nobody at his door and call for the helicopter himself. Good. We will be waiting for it.',
  solve(H, st, flags, sim) {
    const dist = sim.S.refZ - sim.eye0.z, heard = !st.quiet && dist <= st.noise, far = sim.vi === 1;
    const need = (st.mag === 1 ? st.cycle + st.reload : st.cycle) + 0.8 + (st.action === 'charge' ? 1.8 : 0);
    const cov = (s) => !heard || (s.covered() && s.coverUntil - s.t > (st.action === 'charge' ? 1.4 : 0.5));
    return [
      ['until', (s) => { const a = s.byId.g1, b = s.byId.g2, m = s.byId.maid;
        return cov(s) && m.hidden && m.wait > need + 7 && Math.abs(a.x - b.x) > 35.5 && a.goal === null && a.wait > Math.min(need, 4) + 0.4 && (far || a.x < -9); }, 200],
      ['hold'], ['shoot', 'g2', 'torso'], ['shoot', 'g2', 'torso'],
      ['hold'], ['shoot', 'g1', 'torso'], ['shoot', 'g1', 'torso'],
    ];
  },
  reward: { cr: 2700, xp: 550 },
});

// ---------------------------------------------------------------------------
mission({
  id: 'c3m7', ch: 3, title: 'August', range: 600,
  objective: 'August: white hair, green coat, cane. Not the detective.',
  brief: 'This is the one the mountain was for. August Calloway has run his family for forty years and today he runs: the helicopter is on the pad and he is walking out to it. White hair, a long green coat, and a cane. He will have men in front of him and behind him, and he will not be still for long. Six hundred metres, and the wind is gusting. One more thing. Detective Varga has found the lodge. She will be at the gate with a warrant they will not let her serve. She is still honest, and she is still not part of this. Not her, Kestrel.',
  intel: ['August: WHITE hair, long GREEN coat, a cane. The valet wears green too, but he has a cap and carries the bags.', 'Range 600 m. Wind about 5 m/s from the left, gusting. Watch the flag, and watch HOLD change.', 'The rear guard watches his back. The front guard only looks round when August stops close to him.', 'Detective Varga will be at the gate, bottom left. She can see the lodge end of the yard. Do not hit her.', 'Once the rotors are turning nobody down there can hear a rifle.'],
  guide: [
    'August has WHITE hair, a long GREEN coat and a cane. The valet also wears green but has a cap and carries bags, and Varga at the gate (bottom left) must not be hit.',
    'The helicopter starts up about 10 seconds in and drowns out your rifle from then on.',
    'Wait until he stops by the flag to look back at his house, about 55 seconds in (Marlow says so). He stands there about 6 seconds, and the front guard has his back to him.',
    'Shoot him in the chest there. HOLD reads about 5.9 up and 2.3 left: about 3.5 m above his chest (twice his height) and about 1.4 m to his left.',
    'The wind blows left to right and gusts, so watch the flag and check HOLD right before you fire. Hold your breath; the bullet takes about a second to arrive.',
  ],
  wind: { v: 5, gust: 2.4 }, par: 1,
  rules: { kill: ['august'], protect: ['varga'], time: 90, timeText: 'The helicopter is over the ridge, and August Calloway is on it.' },
  sight: { gate: ['yard'] },
  vantages: [{ name: 'Eagle rock', desc: '600 m. The whole yard below you, from the lodge door to the helipad.', eye: [0, 78, 0] }],
  look: [-14, 3],
  setup() {
    const H = SCN.valley({ z: 600, eye: 78, time: 'day', seed: 17 });
    H.kit.duck(H.S, H.PL, H.chimney.x - 1.6, H.chimney.y - 3.3, 1.5);
    return H;
  },
  cast(H) {
    const door = H.lodge.winX(H.lodge.door), at = () => Object.assign(H.yard(door), { hidden: true });
    return [
      Object.assign(at(), { id: 'valet', role: 'civ', speed: 1.1, look: { hat: 'cap', hatCol: '#22252b', coat: '#3f8f4f', bag: 'duffel', bagCol: '#7b5a36' }, failText: 'That was the valet. Green coat, yes. White hair and a cane, no.',
        routine: [['wait', 3], ['show'], ['walk', 42.5], ['look', { bag: null }], ['wait', 999, 'work', 1]] }),
      Object.assign(at(), { id: 'g1', role: 'guard', look: { hat: 'beanie', hatCol: '#1d2026', coat: '#2a2f38', build: 'big' },
        routine: [['wait', 5], ['show'], ['walk', 5], ['wait', 0.6, 'guard', -1], ['waitFor', 'aug_go1'], ['walk', 39], ['wait', 9, 'guard', 1], ['wait', 999, 'guard', -1]] }),
      Object.assign(at(), { id: 'august', role: 'target', speed: 0.8, look: { hair: 'white', coat: '#3f8f4f', long: true, bag: 'cane', h: 0.97 },
        routine: [['wait', 7], ['show'], ['walk', -4], ['wait', 7, 'stand', 1], ['emit', 'aug_go1'], ['walk', 22], ['emit', 'aug_flag'], ['wait', 6.5, 'stand', -1], ['emit', 'aug_go2'], ['walk', 44.6], ['emit', 'boarded'], ['veh', 'heli', 1]],
        flee: [['run', 44.6], ['emit', 'boarded'], ['veh', 'heli', 1]], escapeText: 'The helicopter lifted off with August Calloway aboard. He will not come back to these mountains.' }),
      Object.assign(at(), { id: 'g2', role: 'guard', speed: 0.8, look: { hat: 'cap', hatCol: '#3a3f49', coat: '#4a3f36' },
        routine: [['wait', 10.4], ['show'], ['walk', -7.6], ['wait', 999, 'guard', 1]] }),
      Object.assign(H.yard(43), { id: 'pilot', role: 'civ', face: 1, anim: 'work', look: { hat: 'helmet', hatCol: '#ece8dc', vest: COL.orange }, flee: [['wait', 999, 'cower']], failText: 'You shot the pilot. He flies whoever pays. The contract is void.',
        routine: [['wait', 8.5, 'work', 1], ['veh', 'heli', 0]] }),
      Object.assign(H.road(H.gate.x + 2.6, { zone: 'gate' }), { id: 'gg', role: 'guard', face: -1, anim: 'arms', look: { hat: 'peaked', hatCol: '#27365a', coat: '#39404a' }, routine: [['wait', 999, 'arms', -1]] }),
      { id: 'varga', role: 'vip', eyes: 1.6, look: { hair: 'bun', hairCol: '#2a2019', glasses: true, coat: '#6f5f4c', long: true }, failText: 'You shot Detective Varga. The Ledger has cut you loose.',
        routine: [['wait', 1.5, 'stand', 1], ['wait', 999, 'look', 1]] },
    ];
  },
  vehicles(H) {
    return [
      { id: 'heli', kind: 'chopper', plane: H.PD, x: H.pad.x, y: 0, dir: -1, col: '#e4e0d4', seats: [null, null], yFn: () => H.lift || 0, routine: [['waitFor', 'boarded'], ['wait', 3.2], ['emit', 'liftoff'], ['wait', 4.2], ['gone']] },
      { id: 'vcar', kind: 'sedan', plane: H.PR, x: -128, y: H.roadY, dir: 1, col: '#3a3f49', seats: ['varga'], routine: [['wait', 6], ['drive', H.gate.x - 4.6, 7], ['wait', 1.4], ['out', 'varga', 3.5, 'gate', H.PR, H.roadY], ['emit', 'varga_here']] },
    ];
  },
  tick(sim, H, dt) {
    const v = sim.byId.heli; if (!v || v.gone) return;
    v.st.rotor = approach(v.st.rotor || 0, sim.t > 9 ? 1 : 0, dt * 0.22);
    if (sim.did('liftoff')) { H.liftV = (H.liftV || 0) + 2.4 * dt; H.lift = (H.lift || 0) + H.liftV * dt; }
  },
  triggers() {
    return [
      say(2, 'Marlow', 'He is leaving by helicopter. White hair, long green coat, a cane. He comes out of the door under the deck with his people around him.'),
      { at: 9.5, do(sim) { sim.cover(95, 'helicopter'); } },
      hint(12, 'A walking man moves about a metre while your bullet is in the air. Wait until he stands still, or aim one step ahead of him. And check who is watching his back.', 11),
      onEv('varga_here', (sim) => {
        sim.msg('Marlow', 'That is Detective Varga at the gate, with a warrant nobody will let her serve. Not her. The rear man is going down to deal with it.');
        sim.setRoutine('g2', [['wait', 1.6, 'phone', 1], ['walk', -45, 1], ['wait', 999, 'guard', -1]]);
      }),
      onEv('aug_go1', (sim) => { if (sim.alive('august')) sim.msg('Marlow', 'He is walking again, and the front man has turned his back on him. Nobody is watching the old man now.'); }),
      onEv('aug_flag', (sim) => { if (sim.alive('august')) sim.msg('Marlow', 'He has stopped by the flag to look at his house. Read the wind off it. He will not stop again.'); }),
      onEv('aug_go2', (sim) => { if (sim.alive('august')) sim.msg('Marlow', 'Last stretch, and the front man is watching him in. Lead him or lose him.'); }),
    ];
  },
  challenge: { id: 'onthemove', text: 'Take him while he is walking, and raise no alarm', test: (sim, res) => res.clean && sim.kills.some((k) => k.id === 'august' && k.moving) },
  after: 'Pip here, not Marlow. I went through what August dropped on that helipad before the police did. One page of his accounts, and it does not say what we were told. The Calloways were paying nobody for protection. Somebody was paying the Ledger to remove them. The name on the page is Aurel.',
  solve(H, st) {
    const tof = st.action === 'charge' ? 1.5 : 1.25;
    return [
      ['until', (s) => { const a = s.byId.august, g = s.byId.g1; return s.did('aug_flag') && a.goal === null && !a.inVeh && a.wait > tof + 0.6 && g.face === 1 && Math.abs(s.wind(s.t + tof) - s.wind()) < 0.5; }, 120],
      ['hold'],
      ['shoot', 'august', 'torso'],
      ['shoot', 'august', 'torso'],
    ];
  },
  reward: { cr: 3000, xp: 600 },
});
