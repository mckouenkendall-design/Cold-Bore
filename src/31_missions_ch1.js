// ---------------------------------------------------------------------------
// Chapter 1: COLD START. Port Calder, the Brickworks district.
// The Calloway crew's street business, taken apart one job at a time.
// ---------------------------------------------------------------------------
mission({
  id: 'c1m1', ch: 1, title: 'Rent Day', range: 160,
  objective: 'Find the collector with the red hat band. One shot.',
  brief: 'Welcome back to work, Kestrel. An easy one to start. A collector for the Calloway crew walks Brickworks every Friday, taking "rent" from shopkeepers who never agreed to a landlord. Tonight is his last round. He wears a hat with a red band and never lets go of his case. Take him when nobody is looking his way. Hit anyone else and the contract is void.',
  intel: ['Grey coat, dark hat with a RED band, brown case.', 'He stops for a cigarette outside the deli.', 'Range about 160 m. No wind to speak of.'],
  wind: { v: 0.4, gust: 0.4 }, par: 1, rules: { kill: ['t'] },
  vantages: [{ name: 'Tannery roof', desc: 'Straight across the street. Clear view.', eye: [0, 16, 0] }],
  look: [10, 3],
  setup() { const H = SCN.street({ z: 155, time: 'dusk', seed: 3 }); K.thing(H.S, H.PB, 'duck', H.b2.x + 4.2, H.b2.roofY + 1.15); return H; },
  cast(H) {
    return [
      Object.assign(H.street(44), { id: 't', role: 'target', face: -1, look: { hat: 'fedora', hatCol: '#22252b', hatBand: COL.red, coat: COL.grey, long: true, bag: 'case' },
        routine: [['walk', 14], ['wait', 9, 'smoke'], ['walk', -8], ['wait', 5, 'phone'], ['walk', -30], ['wait', 3], ['walk', -48], ['gone']], escapeText: 'He finished his round and went home. He will be more careful next Friday.' }),
      Object.assign(H.street(-12), { id: 'c1', role: 'civ', look: { hat: 'fedora', hatCol: '#5a4634', coat: COL.tan, bag: 'paper' }, anim: 'stand', routine: [['wait', 14, 'stand'], ['walk', -46], ['gone']] }),
      Object.assign(H.street(25), { id: 'c2', role: 'civ', look: { hair: 'long', dress: COL.wine, bag: 'shopping' }, face: -1, routine: [['wait', 4, 'phone'], ['walk', 46], ['gone']] }),
    ];
  },
  triggers() { return [
    hint(1, () => (Game.touch ? 'Drag anywhere to move the scope. Slide ZOOM up to look closer. Find the man with the red hat band.' : 'Move the mouse to aim. Scroll the wheel to zoom in. Find the man with the red hat band.')),
    hint(13, () => (Game.touch ? 'The crosshair drifts as you breathe. Tap HOLD BREATH to steady it for a few seconds, then FIRE.' : 'The crosshair drifts as you breathe. Hold SHIFT to steady it for a few seconds, then click to fire.')),
    say(24, 'Marlow', 'If someone sees him fall, you lose the clean rating. Pick a moment when he is alone.'),
  ]; },
  challenge: { id: 'head', text: 'Finish it with a headshot', test: (sim) => sim.kills.some((k) => k.id === 't' && k.part === 'head') },
  solve: [['wait', 18], ['shoot', 't', 'head']],
  reward: { cr: 500, xp: 150 },
});

mission({
  id: 'c1m2', ch: 1, title: 'Lights Out', range: 160,
  objective: 'The bagman in the blue cap. Take him where the lookouts cannot see.',
  brief: 'The collector\'s money went to a bagman who walks it across Brickworks after dark. Blue cap, green duffel. Two Calloway lookouts stand under the street lamps at either end, and a man who drops in the light will be seen. The dark stretches between the lamps are a different story. If your rifle is quiet, you can also make your own dark.',
  intel: ['Blue cap, green duffel bag.', 'Lookouts under the first and last lamp. They see about 30 m, but only into the light.', 'He stops for a smoke in the dark between lamps.'],
  wind: { v: -0.6, gust: 0.5 }, par: 2, rules: { kill: ['t'] },
  vantages: [{ name: 'Tannery roof', desc: 'Straight across the street.', eye: [0, 16, 0] }],
  look: [14, 3],
  setup() {
    const H = SCN.street({ z: 152, time: 'night', seed: 5, lamps: [-24, 0, 24], lampReach: 7, cars: [['sedan', -35, 1, '#3a3f49'], ['van', 36, -1, '#6b6f76']] });
    K.thing(H.S, H.PS, 'duck', -39.2, 0.25);
    return H;
  },
  cast(H) {
    return [
      Object.assign(H.street(47), { id: 't', role: 'target', face: -1, look: { hat: 'cap', hatCol: '#3f6fb0', bag: 'duffel', bagCol: '#5d7a4a', coat: '#39404a' },
        routine: [['walk', 12.5], ['wait', 8, 'smoke'], ['walk', 1.5], ['wait', 7, 'phone'], ['walk', -12], ['wait', 7, 'smoke'], ['walk', -47], ['gone']], escapeText: 'The money made it across. The Calloways will not use that route again.' }),
      Object.assign(H.street(-25.5), { id: 'g1', role: 'guard', face: 1, anim: 'arms', look: { hat: 'beanie', coat: '#3a2f2a', build: 'big' }, routine: [['wait', 999, 'arms', 1]] }),
      Object.assign(H.street(27.5), { id: 'g2', role: 'guard', face: -1, anim: 'arms', look: { hat: 'beanie', hatCol: '#5a2a2a', coat: '#2a333a' }, routine: [['wait', 999, 'arms', -1]] }),
      Object.assign(H.street(-46), { id: 'c1', role: 'civ', look: { hair: 'short', bag: 'duffel', bagCol: '#8a5a3a', coat: COL.tan }, routine: stroll(47), speed: 1.15 }),
    ];
  },
  triggers() { return [
    hint(1.5, 'At night a body in lamp light is seen from far away. In the dark between lamps it is not. Wait for him to stop in the dark.'),
    say(20, 'Marlow', 'A quiet rifle could put a lamp out first. A loud one would wake the street.'),
  ]; },
  challenge: { id: 'lamp', text: 'Shoot out a lamp first, then take him without an alarm', test: (sim, res) => res.clean && sim.S.objects.some((o) => o.kind === 'lamp' && !o.alive) },
  solve: [['until', (s) => s.byId.t.anim === 'smoke' && s.byId.t.goal === null && s.byId.t.x > 10], ['wait', 1], ['shoot', 't', 'torso']],
  reward: { cr: 600, xp: 170 },
});

mission({
  id: 'c1m3', ch: 1, title: 'Thunder', range: 160,
  objective: 'Yellow raincoat on the roof, red umbrella on the street. Neither may warn the other.',
  brief: 'The Calloways moved their dice game and posted two spotters to watch for trouble. One on the roof in a yellow raincoat, one at the laundry door under a red umbrella. If either hears a shot, the game scatters and we start again. There is a storm over the harbour. Thunder is loud, and it is yours to use: fire inside it and nobody hears a thing.',
  intel: ['Roof spotter: YELLOW raincoat, binoculars.', 'Street spotter: RED umbrella, by the laundry.', 'Lightning first, then about two seconds of thunder. Watch for the NOISE COVER light.', 'People with other umbrellas are just people.'],
  wind: { v: 2.2, gust: 1.2 }, par: 2, rules: { kill: ['t1', 't2'] },
  vantages: [{ name: 'Tannery roof', desc: 'Straight across. Wet, but level.', eye: [0, 18, 0] }],
  look: [-10, 8],
  setup() { const H = SCN.street({ z: 150, time: 'night', weather: 'rain', seed: 8 }); K.thing(H.S, H.PB, 'duck', H.b5.winX(2), H.b5.floorY(4) + 1.15, { }); return H; },
  cast(H) {
    return [
      Object.assign(H.onRoof(H.b3, -3), { id: 't1', role: 'target', look: { coat: '#d8b52a', long: true, hat: 'hood', hatCol: '#d8b52a' }, anim: 'look',
        routine: [['wait', 6, 'look', -1], ['walk', 6], ['wait', 6, 'look', 1], ['walk', -4], ['loop']], escapeText: 'The roof spotter ducked out of sight and the game scattered.' }),
      Object.assign(H.street(-16), { id: 't2', role: 'target', face: 1, look: { bag: 'umbrella', bagCol: COL.red, coat: '#2f3640' }, routine: [['wait', 999, 'smoke', 1]], escapeText: 'The street spotter ran and the game scattered.' }),
    ];
  },
  triggers(H) {
    let n = 0;
    return [
      { at: 5, every: 11, do(sim) { sim.cover(2.7, 'thunder'); } },
      { at: 2, every: 13, do(sim) { if (sim.alarmT !== null) return; const R = sim.rng, dir = n % 2 ? 1 : -1; sim.addActor(Object.assign(H.street(dir > 0 ? -47 : 47), { id: 'u' + (n++), role: 'civ', look: Object.assign(rndLook(R), { bag: 'umbrella', bagCol: R.pick([COL.blue, COL.black, COL.green, COL.purple, COL.cream]) }), routine: stroll(dir > 0 ? 47 : -47), speed: R.r(0.95, 1.2) })); } },
      hint(1.5, 'An unsuppressed shot is heard by everyone. When lightning flashes, the thunder that follows covers your shot. Fire while NOISE COVER is lit.'),
    ];
  },
  challenge: { id: 'roll', text: 'Both spotters inside three seconds', test: (sim) => { const a = sim.kills.find((k) => k.id === 't1'), b = sim.kills.find((k) => k.id === 't2'); return !!a && !!b && Math.abs(a.t - b.t) <= 3; } },
  solve(H, st) {
    const lead = st.action === 'charge' ? 1.9 : 1.2;
    const cov = (s) => st.quiet || (s.covered() && s.coverUntil - s.t > lead);
    const clear = (s) => !s.actors.some((a) => a.role === 'civ' && !a.gone && !a.dead && Math.abs(a.x - s.byId.t2.x) < 28);
    return [['until', cov], ['shoot', 't1', 'torso'], ['wait', 0.5], ['until', (s) => cov(s) && clear(s)], ['shoot', 't2', 'torso']];
  },
  reward: { cr: 750, xp: 190 },
});

mission({
  id: 'c1m4', ch: 1, title: 'Piano Movers', range: 150,
  objective: 'The landlord in the white suit. It has to look like an accident.',
  brief: 'Emil Voss owns half of Brickworks and rents the other half from the Calloways. He burned a building for the insurance with a family still inside it. The client wants him gone, and wants no questions. No bullet holes. He is having a piano hoisted into his new office today, and he likes to stand underneath and shout at the men. Hooks fail all the time.',
  intel: ['White suit, straw hat, cane.', 'Shoot the yellow hook block above the piano. It takes over a second to fall.', 'The movers are innocent. If one is underneath, wait.', 'The road crew\'s jackhammer will cover a loud shot.'],
  wind: { v: 1.0, gust: 0.8 }, par: 1,
  rules: { kill: ['t'], accidentOnly: true, accidentText: 'A man in a white suit with a bullet in him is a murder inquiry. It had to look like an accident.' },
  vantages: [{ name: 'Print works roof', desc: 'Across the street, a little above the hoist.', eye: [0, 17, 0] }],
  look: [0, 9],
  setup() {
    const H = SCN.street({ z: 140, time: 'day', seed: 11, cars: [['truck', -27, 1, '#c9482b'], ['sedan', 33, -1, '#3f5a48']] });
    K.box(H.S, H.PB, -2, H.b3.roofY + 0.9, 4, 0.55, '#2a2e36', { solid: false });
    H.hook = K.hang(H.S, H.PS, 0, 12.5, 'piano', { id: 'hook', top: H.b3.roofY + 1.2, floor: 0 });
    K.thing(H.S, H.PR, 'duck', -27, 3.25);
    return H;
  },
  cast(H) {
    return [
      Object.assign(H.street(6.5), { id: 't', role: 'target', face: -1, look: { coat: COL.cream, long: true, hat: 'sun', hatCol: '#efe6cf', hatBand: '#22252b', bag: 'cane' },
        routine: [['wait', 5, 'talk', -1], ['walk', 0.4], ['wait', 4.6, 'point', -1], ['walk', 6.5], ['wait', 1, 'stand', -1], ['loop']] }),
      Object.assign(H.street(-5), { id: 'm1', role: 'civ', face: 1, look: { hat: 'hardhat', hatCol: '#e2b33c', vest: '#e07b2a', vestStripe: '#f1ede2' }, routine: [['wait', 999, 'work', 1]] }),
      Object.assign(H.street(-12), { id: 'm2', role: 'civ', face: 1, look: { hat: 'hardhat', hatCol: '#e2b33c', vest: '#e07b2a', vestStripe: '#f1ede2', build: 'big' },
        routine: [['wait', 4, 'work'], ['walk', -0.8], ['wait', 3, 'look', 1], ['walk', -12], ['loop']] }),
      Object.assign(H.street(10.5), { id: 'c1', role: 'civ', face: -1, look: { hat: 'hardhat', hatCol: '#ece8dc', bag: 'clip', coat: COL.navy }, routine: [['wait', 999, 'stand', -1]] }),
      Object.assign(H.street(25), { id: 'c2', role: 'civ', face: 1, look: { hat: 'hardhat', hatCol: '#e07b2a', vest: '#e2b33c', phones: '#c8372d' }, routine: [['wait', 999, 'work', 1]] }),
    ];
  },
  triggers() { return [
    { at: 3, every: 12, do(sim) { sim.cover(8, 'jackhammer'); } },
    hint(1.5, 'Some things in the scene can be shot to make something else happen. Wait until only the man in white is under the piano, then shoot the yellow hook block.'),
  ]; },
  challenge: { id: 'nobreath', text: 'Hit the hook without holding your breath', test: (sim) => !sim.stats.breathUsed },
  solve(H, st) {
    const need = st.action === 'charge' ? 3.4 : 2.5;
    return [['until', (s) => { const t = s.byId.t, m = s.byId.m2; return t.goal === null && Math.abs(t.x - 0.4) < 0.3 && t.wait > need && Math.abs(m.x) > 6 && (st.quiet || (s.covered() && s.coverUntil - s.t > need - 1)); }], ['shootObj', 'hook']];
  },
  reward: { cr: 800, xp: 200 },
});

// ---- The 9:15: the envelope ---------------------------------------------------
// The car parks in the near lane (plane PR) and the runner waits on the pavement (plane PS),
// seven metres further back. To reach the driver's window he steps off the kerb and walks round
// the nose of the car. From the roof the pavement looks higher than the road by C1M5_LIFT, so he
// changes plane at the kerb standing that much above the road, and drops to the road as he
// crosses: on screen he walks smoothly down and round, with no jump.
const C1M5_KZ = 153 / 160, C1M5_LIFT = 14.64 * (1 - C1M5_KZ); // eye height (15 m, tipped down at the car) times the depth step
const C1M5_KERB = -1.1, C1M5_KERB_R = C1M5_KERB * C1M5_KZ, C1M5_NOSE = -2.35, C1M5_DOOR = -3.63;
// Drawn in the near hand of whoever has it (H.env.who). Inside a car only the part that shows
// through that person's window is drawn, like the person.
function c1m5Envelope(ctx, env, H, P) {
  const sim = H.sim, who = H.env.who; if (!sim || !who || env.s < 2.2) return;
  const a = sim.byId[who]; if (!a || a.gone || a.hidden || a.plane !== P) return;
  const J = actorJoints(a), hx = a.x + J.haR[0], hy = a.y + J.haR[1];
  if (hx < env.x0 - 1 || hx > env.x1 + 1) return;
  ctx.save();
  const v = a.inVeh;
  if (v) {
    const c = v.def, lx = c.seats[a.seat] * c.len; let wi = -1;
    for (let w = 0; w < c.win.length; w++) if (lx >= c.win[w][0] * c.len - 0.05 && lx <= c.win[w][1] * c.len + 0.05) wi = w;
    if (wi < 0) { ctx.restore(); return; }
    ctx.beginPath(); ctx.rect(v.x + v.dir * c.win[wi][v.dir > 0 ? 0 : 1] * c.len, v.y + c.body + 0.06, (c.win[wi][1] - c.win[wi][0]) * c.len, c.h - c.body - 0.2); ctx.clip();
  }
  // it lies along the forearm, a little past the fingers
  ctx.translate(hx, hy); ctx.rotate(Math.atan2(J.haR[1] - J.elR[1], J.haR[0] - J.elR[0]));
  const S = H.S, paper = S.tone('#efe6cf', P), fold = S.tone('#9c8d70', P);
  R4(ctx, -0.04, -0.06, 0.24, 0.12, paper);
  if (env.s > 9) { ctx.strokeStyle = fold; ctx.lineWidth = Math.max(0.008, env.px * 0.7); ctx.beginPath(); ctx.moveTo(-0.04, -0.06); ctx.lineTo(0.06, 0); ctx.lineTo(-0.04, 0.06); ctx.stroke(); }
  if (env.s > 5) { ctx.fillStyle = S.tone('#13161b', P); ctx.beginPath(); ctx.arc(0, 0, 0.032, 0, TAU); ctx.fill(); } // the fingers round it
  ctx.restore();
}
// The runner has reached the driver's window (called from his routine). Who does what, and
// when, from here: the driver takes the envelope, looks at it and passes it back over his
// shoulder; the lawyer takes it, reads it and puts it away. Every beat checks that nothing has
// gone wrong first (somebody shot, the car spooked, the runner frightened off).
function c1m5Exchange(sim, H) {
  const v = sim.byId.car, drv = sim.byId.drv, t = sim.byId.t, run = sim.byId.c1, E = H.env;
  const inCar = (a) => a && !a.dead && a.inVeh === v;
  const parked = () => !v.scared && !v.flatTire && !v.crashed && !v.gone && v.goal === null;
  const pose = (a, anim) => { if (inCar(a)) a.anim = anim; };
  const beat = (dt, fn) => sim.after(dt, () => { if (parked()) fn(); else { pose(drv, 'drive'); pose(t, 'drive'); } });
  const open = () => !!(v.st.pane && v.st.pane[1] && v.st.pane[1].b === 1);
  const runnerHolds = () => E.who === 'c1' && run && !run.dead && !run.gone && run.state === 'calm' && run.anim === 'handover';
  beat(0.3, () => { if (runnerHolds() && open() && inCar(drv)) pose(drv, 'sitreach'); });
  beat(0.85, () => { if (runnerHolds() && inCar(drv) && drv.anim === 'sitreach') E.who = 'drv'; else pose(drv, 'drive'); });
  beat(1.25, () => { if (E.who === 'drv') pose(drv, 'sitread'); });
  beat(1.85, () => { if (E.who !== 'drv' || !inCar(drv)) return; if (inCar(t)) pose(drv, 'sitpass'); else { pose(drv, 'drive'); sim.after(0.3, () => { if (E.who === 'drv') E.who = null; }); } });
  beat(2.05, () => { if (E.who === 'drv' && drv.anim === 'sitpass') pose(t, 'sitreach'); });
  beat(2.55, () => { if (E.who === 'drv' && t.anim === 'sitreach' && inCar(t)) { E.who = 't'; pose(t, 'sitread'); } else pose(t, 'drive'); });
  beat(2.75, () => pose(drv, 'drive'));
  beat(4.2, () => pose(t, 'drive'));
  beat(4.55, () => { if (E.who === 't' && inCar(t)) E.who = null; }); // tucked away inside his coat
}

mission({
  id: 'c1m5', ch: 1, title: 'The 9:15', range: 170, needs: { glass: true },
  objective: 'White hat, dark glasses, back seat. The car stops once and not for long.',
  brief: 'The Calloway lawyer never walks anywhere. Every evening at a quarter past nine his car pulls up on Calder Street, just past the laundry, for a few seconds. The driver winds his window down, a runner hands him an envelope, and he passes it back to his employer. That is the only time the lawyer is ever still. He sits in the back, behind glass that stays shut. White hat, dark glasses. The driver is hired help; leave him if you can. When the car pulls away the chance is gone.',
  intel: ['Target is in the BACK seat. The driver is in front.', 'The car stops for about eight seconds. Only the driver\'s window comes down.', 'The back window stays up. Glass nudges a bullet slightly off line. Aim for the middle of the head.', 'A flat tyre would also stop a car.'],
  wind: { v: -1.2, gust: 0.8 }, par: 1, rules: { kill: ['t'] },
  vantages: [{ name: 'Tannery roof', desc: 'Looking down into the car windows.', eye: [0, 15, 0] }],
  look: [-6, 2],
  setup() {
    const H = SCN.street({ z: 160, time: 'dusk', seed: 14, cars: [['sedan', 32, 1, '#2f4a6b']] });
    K.thing(H.S, H.PS, 'duck', H.lamps[3].x, H.lamps[3].y + 0.42);
    H.env = { who: 'c1' };
    [H.PS, H.PR].forEach((P) => P.add({ x0: -1e4, x1: 1e4, layer: 2, draw(ctx, env) { c1m5Envelope(ctx, env, H, P); } }));
    return H;
  },
  start(sim, H) { H.sim = sim; },
  cast(H) {
    const road = (x) => ({ plane: H.PR, x, y: C1M5_LIFT, zone: 'street', room: null, behind: false });
    return [
      { id: 'drv', role: 'guard', look: { hat: 'peaked', hatCol: '#1d2026' } },
      { id: 't', role: 'target', look: { hat: 'fedora', hatCol: '#ece8dc', hatBand: '#22252b', glasses: 'shades' }, escapeText: 'The car pulled away with him in it. Same time tomorrow, then.' },
      // the runner: to the kerb as the car comes, round its nose to the driver's door, and back
      Object.assign(H.street(2), { id: 'c1', role: 'civ', face: -1, look: { hat: 'cap', hatCol: '#7a2438', coat: '#3a3f47' },
        yFn(x) { return this.plane === H.PR ? C1M5_LIFT * smooth((x - C1M5_NOSE) / (C1M5_KERB_R - C1M5_NOSE)) : 0; },
        // (an 'anim' before a 'walk' is the pose he arrives in, so the stride eases straight into it)
        routine: [['wait', 10.4], ['walk', C1M5_KERB], ['waitFor', 'parked'], ['wait', 0.5, 'stand', -1], ['to', road(C1M5_KERB_R)], ['anim', 'handover'], ['walk', C1M5_DOOR],
          ['call', (sim) => c1m5Exchange(sim, H)], ['wait', 1.1, 'handover', -1], ['wait', 1.0, 'talk', -1],
          ['anim', 'walk'], ['walk', C1M5_KERB_R], ['to', H.street(C1M5_KERB)], ['walk', 47], ['gone']] }),
      Object.assign(H.street(-30), { id: 'c2', role: 'civ', look: { hair: 'bun', dress: COL.teal, bag: 'shopping' }, routine: stroll(47), speed: 0.9 }),
    ];
  },
  vehicles(H) {
    // the driver's window (window 1) comes down as the car stops and goes back up before it leaves
    return [{ id: 'car', kind: 'sedan', plane: H.PR, x: -78, y: 0, dir: 1, col: '#101216', seats: ['drv', 't'],
      routine: [['wait', 4], ['drive', -5, 9], ['emit', 'parked'],
        ['call', (sim, v) => { const ok = () => !v.scared && !v.flatTire && !v.crashed && !v.gone; sim.after(0.5, () => { if (ok()) carWindow(sim, v, 1, true, 1.2); }); sim.after(6.8, () => { if (ok()) carWindow(sim, v, 1, false, 1.2); }); }],
        ['wait', 8.5], ['emit', 'leaving'], ['drive', 95, 10], ['gone']] }];
  },
  triggers(H) { return [
    hint(1.5, 'A car is coming from the left. It will stop just past the laundry. The man you want is in the back seat.'),
    onEv('leaving', (sim) => sim.msg('Marlow', 'He is moving. Lead him or let him go.')),
    { on: 'stopped:car', delay: 1.4, do(sim) { const a = sim.byId.t; if (!a || a.dead) return; a.inVeh = null; a.hidden = false; sim.place(a, { plane: H.PS, x: sim.byId.car.x - 1.5, y: 0, zone: 'street', room: null, behind: false }); a.anim = a.idle = 'stand'; a.state = 'flee'; a.routine = [['run', -50], ['gone']]; a.pc = 0; sim.raiseAlarm('target', 0.3); } },
  ]; },
  challenge: { id: 'moving', text: 'Hit him while the car is moving', test: (sim) => sim.kills.some((k) => k.id === 't' && k.moving) },
  solve: [['until', (s) => s.did('parked')], ['wait', 0.7], ['shoot', 't', 'head']],
  reward: { cr: 900, xp: 220 },
});

mission({
  id: 'c1m6', ch: 1, title: 'The Counting House', range: 160,
  objective: 'The bookkeeper in the green eyeshade, third floor. His guard must not raise the alarm.',
  brief: 'Every dollar the Calloways take in Brickworks is counted in one room, by one man, who keeps the only honest set of books in the city. Third floor of the grey building, the lit room. He wears a green eyeshade and never leaves his desk for long. There is a guard in the room with him who steps out to the balcony to smoke. A guard who is outside cannot see what happens inside. You have a choice of where to set up.',
  intel: ['Bookkeeper: GREEN eyeshade, glasses, sits at the middle window (it is open).', 'The guard smokes on the balcony for about ten seconds at a time.', 'Tannery roof: close, but a billboard hides the balcony.', 'Water tower: sees everything, but it is 80 m further and catches the wind.'],
  wind: { v: 2.4, gust: 1.2 }, par: 1, rules: { kill: ['t'] },
  vantages: [
    { name: 'Tannery roof', desc: '150 m. Steady and close. A billboard blocks your view of the balcony.', eye: [0, 16, 0], windMul: 0.5, tag: 'Easier shot' },
    { name: 'Water tower', desc: '235 m. Clear view of the room and the balcony. Exposed to the crosswind.', eye: [-60, 24, -80], windMul: 1.5, tag: 'Harder shot, more options' },
  ],
  look: [1, 11],
  setup() {
    const row = [
      { w: 17, floors: 5, wall: '#8a5444', tank: 0.7 },
      { w: 15, floors: 4, wall: '#a0876e', shop: { sign: 'LAUNDRY', awning: '#3b6ea5' }, antenna: 0.3 },
      { w: 19, floors: 6, wall: '#6d727c', hut: 0.15, door: 2, spans: { 3: [[1, 3, 'count', true]] }, wins: { '3,1': { blind: 0 }, '3,2': { blind: 0, open: true }, '3,3': { blind: 0 }, '3,4': { lit: false, blind: 0, door: true, sill: 0.1, h: 2.3 }, '3,0': { lit: false } } },
      { w: 14, floors: 4, wall: '#94614c', shop: { sign: 'DELI', awning: '#b33a3a', door: true } },
      { w: 16, floors: 5, wall: '#7c6a5a', tank: 0.3 },
    ];
    const H = SCN.street({ z: 150, time: 'night', seed: 17, row });
    H.bal = K.balcony(H.S, H.PB, H.b3, 3, 4);
    K.box(H.S, H.PF, -2, -6, 13, 8, '#343a44', { band: 0.5 });
    K.billboard(H.S, H.PF, 3.2, 11.2, 4.8, 3.9, 'CALDER|COLA', { base: 2, col: '#e9dcc0', textCol: '#b3312b' });
    K.thing(H.S, H.PF, 'duck', 5.6, 15.4);
    H.room = (x) => ({ plane: H.PB, x, y: H.b3.floorY(3), room: 'b3:count', zone: 'b3:count', behind: true });
    H.out = (x) => ({ plane: H.PB, x, y: H.b3.floorY(3), room: null, zone: H.bal.zone, behind: false });
    return H;
  },
  cast(H) {
    const B = H.b3;
    return [
      Object.assign(H.room(B.winX(2)), { id: 't', role: 'target', face: -1, anim: 'type', look: { hat: 'cap', hatCol: '#2f9a55', glasses: true },
        routine: [['wait', 15, 'type', -1], ['walk', B.winX(1)], ['wait', 4, 'work', -1], ['walk', B.winX(2)], ['loop']], escapeText: 'The bookkeeper went under the desk and the books went into the furnace.' }),
      Object.assign(H.room(B.winX(3) - 0.5), { id: 'g', role: 'guard', face: -1, anim: 'guard', look: { coat: '#3a2f2a', build: 'big', hat: 'beanie' },
        routine: [['walk', B.winX(1) - 0.8], ['wait', 3, 'guard', 1], ['walk', B.winX(3)], ['wait', 2, 'guard', -1], ['walk', B.winX(3) + 1.4], ['to', H.out(B.winX(4) - 1.0)], ['walk', B.winX(4) + 0.3], ['wait', 10.5, 'smoke', 1], ['walk', B.winX(4) - 1.0], ['to', H.room(B.winX(3) + 1.4)], ['loop']] }),
      Object.assign(H.inWin(H.b2, 2, 1), { id: 'c1', role: 'civ', anim: 'phone', look: { hair: 'long', dress: COL.wine }, routine: [['wait', 999, 'phone']] }),
      Object.assign(H.inWin(H.b5, 3, 2), { id: 'c2', role: 'civ', anim: 'drink', look: { hair: 'short', coat: COL.olive }, routine: pace(H.b5.winX(2) - 1.2, H.b5.winX(2) + 0.4, 6, 5, 'drink') }),
      Object.assign(H.street(-45), { id: 'c3', role: 'civ', look: { hat: 'beanie', bag: 'backpack' }, routine: stroll(47) }),
    ];
  },
  onAlarm(sim) { sim.msg('Marlow', 'They are burning the books. That was the job.'); },
  triggers() { return [
    hint(1.5, 'The guard and the bookkeeper share a room. Wait until the guard steps out to the balcony, then take the bookkeeper through the open middle window.'),
  ]; },
  challenge: { id: 'both', text: 'Guard and bookkeeper, with no alarm (try the water tower)', test: (sim, res) => res.clean && sim.kills.some((k) => k.id === 'g') },
  solve: [['until', (s) => s.byId.g.zone !== 'b3:count' && s.byId.g.anim === 'smoke' && s.byId.t.anim === 'type' && s.byId.t.goal === null], ['wait', 0.6], ['shoot', 't', 'head']],
  reward: { cr: 1000, xp: 240 },
});

mission({
  id: 'c1m7', ch: 1, title: 'Dutch', range: 168,
  objective: 'Dutch Pell: the big bald man with the red scarf. Do not touch the detective.',
  brief: 'This is the one the chapter was for. Dutch Pell runs the street for the Calloways and has for twenty years. Tonight he meets a bent police sergeant under the elevated line to pay him. He comes with a bodyguard and he never stands in the light for long without one. But he takes his private calls in private. One more thing. A detective named Varga is watching the meeting from a parked car at the right-hand end of the street. She is honest, which is rare, and she is not part of this. If she is harmed, we are finished.',
  intel: ['Dutch: very big, bald, grey beard, long black coat, RED scarf.', 'He will step away into the dark to take a phone call. His phone lights his face.', 'The sergeant in the police cap is NOT a target.', 'Trains on the elevated line cover a loud shot.', 'Detective Varga is in the parked car on the right. Leave her alone.'],
  wind: { v: 1.8, gust: 1.5 }, par: 1, rules: { kill: ['dutch'], protect: ['varga'] },
  vantages: [{ name: 'Signal box roof', desc: 'Level with the tracks, looking under the elevated line.', eye: [0, 15, 0] }],
  look: [2, 3],
  setup() {
    const H = SCN.street({ z: 165, time: 'night', seed: 21, lamps: [-24, 0, 26], lampReach: 7, cars: [], el: 9.5,
      row: [{ w: 17, floors: 5, wall: '#7d4a40' }, { w: 15, floors: 4, wall: '#8f7a66', shop: { sign: 'BILLIARDS', awning: '#2f6b4a', lit: true } }, { w: 19, floors: 6, wall: '#5f646e', door: 2 }, { w: 14, floors: 4, wall: '#86584a', shop: { sign: 'PAWN', awning: '#8a6a2a', door: true, lit: false } }, { w: 16, floors: 5, wall: '#6f6052' }] });
    K.neon(H.S, H.PB, H.b2.x + 7.5, H.b2.floorY(1) + 0.9, 'OPEN LATE', '#ff5a8a', 0.8);
    K.thing(H.S, H.PE, 'duck', -14, H.el.y + 1.2);
    return H;
  },
  cast(H) {
    return [
      { id: 'drv', role: 'guard', look: { hat: 'cap' } },
      { id: 'dutch', role: 'target', look: { build: 'big', beard: '#9a9fa6', coat: '#15171b', long: true, scarf: COL.red, h: 1.08 },
        routine: [['walk', 2.2], ['wait', 11, 'talk', 1], ['walk', 13], ['wait', 9.5, 'phone', 1], ['walk', -9.5], ['emit', 'dutch_in'], ['veh', 'suv', 1]], escapeText: 'Dutch got back in the car. He will not be this careless twice.' },
      { id: 'g1', role: 'guard', look: { hat: 'beanie', coat: '#2a2f38', build: 'big' },
        routine: [['walk', -0.8], ['wait', 12, 'guard', -1], ['walk', 6], ['wait', 16, 'guard', -1], ['walk', -11.5], ['veh', 'suv', 2]] },
      Object.assign(H.street(3.8), { id: 'sgt', role: 'civ', face: -1, look: { hat: 'peaked', hatCol: '#27365a', coat: '#27365a' }, failText: 'You shot a police sergeant. Every officer in Port Calder is now looking for you.',
        routine: [['waitFor', 'arrived'], ['wait', 21.5, 'talk', -1], ['walk', -47], ['gone']] }),
      Object.assign(H.street(27.5), { id: 'g2', role: 'guard', face: -1, anim: 'arms', look: { hat: 'cap', hatCol: '#2a2d33', coat: '#39404a' }, routine: [['wait', 999, 'arms', -1]] }),
      { id: 'varga', role: 'vip', look: { hair: 'bun', hairCol: '#2a2019', glasses: true }, failText: 'You shot Detective Varga. The Ledger has cut you loose.' },
    ];
  },
  vehicles(H) {
    const t = elTrain(H, { first: 12, period: 25 });
    H._train = t;
    return [
      { id: 'suv', kind: 'suv', plane: H.PR, x: -80, y: 0, dir: 1, col: '#0e0f12', seats: ['drv', 'dutch', 'g1'],
        routine: [['wait', 5], ['drive', -12, 9], ['emit', 'arrived'], ['wait', 1.2], ['out', 'dutch', 3, 'street', H.PS, 0], ['out', 'g1', 1, 'street', H.PS, 0], ['waitFor', 'dutch_in'], ['wait', 1.6], ['drive', 95, 11], ['gone']] },
      { id: 'vcar', kind: 'sedan', plane: H.PR, x: 35, y: 0, dir: -1, col: '#3a3f49', seats: ['varga'], routine: [] },
      t.veh,
    ];
  },
  triggers(H) { return [
    H._train.trig,
    say(2, 'Marlow', 'Car coming from the left. Wait for him. Let him get comfortable.'),
    onEv('arrived', (sim) => sim.msg('Marlow', 'That is Pell. Red scarf. The man in the police cap is the sergeant. Not him.'), 3),
  ]; },
  challenge: { id: 'darkhead', text: 'A headshot in the dark, and nobody the wiser', test: (sim, res) => res.clean && sim.kills.some((k) => k.id === 'dutch' && k.part === 'head' && !k.lit) },
  solve: [['until', (s) => s.byId.dutch.anim === 'phone' && s.byId.dutch.goal === null && !s.byId.dutch.inVeh], ['wait', 1.5], ['shoot', 'dutch', 'torso']],
  reward: { cr: 1400, xp: 320 },
});
