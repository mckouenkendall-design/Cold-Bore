// ---------------------------------------------------------------------------
// Chapter 6: HARROW RIDGE. The snowbound proving ground where it began.
// Very long shots: the bullet is in the air for one to two seconds, falls by
// several times a man's height and is pushed sideways by the wind. Most loud
// rifles are out of earshot at these ranges. The .50 is not.
//
// Flags read here (missing means false): sparedReyes and savedBrandt decide
// who walks with Varga and who speaks on the radio, sparedMarlow adds
// Marlow's voice in c6m5, sparedRook changes the finale. Flags set here:
// sparedRook (c6m5) and arrestedAurel (c6m6).
// ---------------------------------------------------------------------------
const C6 = {
  dist: (sim) => sim.S.refZ - sim.eye0.z,
  // would this rifle be heard down there if nothing covered it?
  heard: (sim, st) => !st.quiet && st.noise >= sim.S.refZ - sim.eye0.z,
  // seconds from pressing the trigger to the bullet arriving at d metres
  tof: (st, d) => Bal.dope(st, st.zeroAng, d, 0).tof + (st.action === 'charge' ? 0.85 : 0),
  // will the wind stay as it is for the next `sec` seconds?
  steady(sim, sec, tol) { const w = sim.wind(); for (let u = 0.2; u <= sec + 0.01; u += 0.2) if (Math.abs(sim.wind(sim.t + u) - w) > tol) return false; return true; },
  // how far the wind may shift during the flight before this rifle misses a man at d metres
  windTol: (st, d) => clamp(0.085 / Math.max(0.02, (Math.abs(Bal.dope(st, st.zeroAng, d, 1).driftMil) * d) / 1000), 0.06, 0.3),
  ready: (s) => s.sh.cycleT <= 0 && s.sh.reloadT <= 0 && s.sh.ammo > 0 && s.sh.chargeT <= 0,
  // Make someone break off for a moment (a wave, a flinch) and then carry on
  // exactly where they were.
  interrupt(sim, a, steps) {
    if (!a || a.dead || a.gone || a.state !== 'calm' || a.inVeh || a.threat) return false;
    const sv = { routine: a.routine, pc: a.pc, wait: a.wait, goal: a.goal, anim: a.idle, face: a.face };
    const resume = ['call', (s, b) => { b.routine = sv.routine; b.pc = Math.max(0, sv.pc - (sv.goal !== null ? 1 : 0)); }];
    a.routine = steps.concat(sv.goal === null && sv.wait > 0 ? [['wait', sv.wait, sv.anim, sv.face], resume] : [['anim', sv.anim], ['face', sv.face], resume]);
    a.pc = 0; a.wait = 0; a.goal = null;
    return true;
  },
  duck: (H, P, x, y) => K.thing(H.S, P, 'duck', x, y, { r: 0.5, drawFn: K.bigDuck }),
  // bot steps: one careful shot at a person, and a second try if the first missed
  shot: (id) => [['hold'], ['shoot', id, 'torso'], ['fn', (s) => s.holdBreath(false)]],
  again: (id) => [['until', (s) => !s.alive(id) || C6.ready(s), 9], ['fn', (s) => { if (s.alive(id)) s.holdBreath(true); }], ['shoot', id, 'torso'], ['fn', (s) => s.holdBreath(false)]],
  // Aurel's men all wear red hats. Everybody else up here does not.
  red: (extra) => Object.assign({ hat: 'beanie', hatCol: COL.red, coat: '#1f2329' }, extra || {}),
  varga: { hair: 'bun', hairCol: '#2a2019', glasses: true, coat: COL.tan, long: true, bag: 'paper' },
  reyes: { hat: 'hardhat', hatCol: '#e2b33c', vest: '#e07b2a', vestStripe: '#f1ede2' },
  brandt: { hair: 'long', hairCol: '#8a3b24', coat: COL.teal, scarf: COL.yellow, bag: 'case' },
  mech: { hat: 'cap', hatCol: '#e07b2a', coat: COL.navy },
  marshal: { hat: 'hardhat', hatCol: '#f1ede2', vest: '#d8e03a', vestStripe: '#8d949a', phones: '#c8372d' },
  // a pilot who stays at the controls when the shooting starts (the stock reaction would drive the helicopter off along the ground)
  pilot: (failText) => ({ id: 'pilot', role: 'civ', look: { hat: 'helmet', hatCol: '#e9edf1' }, flee: [['wait', 999]], failText }),
  ally: (f) => !!(f.sparedReyes || f.savedBrandt),
  // c6m6: the pilot stops waiting for the wind (after a round lands near him, or an alarm)
  hurry(sim, text) {
    if (sim.hurried || sim.winAt || sim.failInfo) return;
    const v = sim.byId.heli, R = v.routine; sim.hurried = true;
    if (!R.length || sim.did('leaving')) return;
    R[1][1] = Math.min(R[1][1], 1.5); R[6][1] = Math.min(R[6][1], 5);
    if (sim.did('hover')) v.wait = Math.min(v.wait, 4.2); else if (sim.did('boarded') && !sim.did('lifting')) v.wait = Math.min(v.wait, 1.5);
    sim.msg('Pip', text);
  },
  // Varga and whoever is still alive to walk with her
  party(f) {
    const p = [{ id: 'varga', who: 'Varga', look: C6.varga, failText: 'You shot Detective Varga. There is nobody left to finish this.', lostText: 'Detective Varga went down in the snow with the warrant still in her hand.' }];
    if (f.sparedReyes) p.push({ id: 'reyes', who: 'Reyes', look: C6.reyes, failText: 'You shot Tomas Reyes. He came up here to testify.', lostText: 'Tomas Reyes got off the docks alive and died in the snow at Harrow Ridge.' });
    if (f.savedBrandt) p.push({ id: 'brandt', who: 'Brandt', look: C6.brandt, failText: 'You shot Nadia Brandt. She came to write down what happened here.', lostText: 'Nadia Brandt came to see it for herself. You were a second too slow.' });
    return p;
  },
};

// ---------------------------------------------------------------------------
mission({
  id: 'c6m1', ch: 6, title: 'Approach', range: 800,
  objective: 'Both yard tower sentries (red hats), between two waves.',
  speaker: 'Pip',
  brief: 'Pip here. Marlow will not be on this channel again, so you get me. Harrow Ridge: you know it, so I will skip the tour. Varga\'s people drive up the valley road tonight, and the two towers in the yard would see them coming for miles. One sentry in each, red hats. The catch: every twenty seconds they wave to each other to prove they are both awake. If one waves and nobody waves back, he reaches for the radio. So it is both of them between two waves. The snow crew is blasting drifts off the slope behind the compound. Use the noise if your rifle needs it.',
  intel: ['Two sentries in RED hats: one in the tower at each end of the yard. The tower at the back is empty. About 800 m.', 'They wave to each other every 20 seconds. Both must fall between two waves.', 'The bullet takes over a second to arrive. Fire only at a man who is standing still.', 'Blasting on the slope behind the compound covers a loud shot for a few seconds at a time.', 'Tree line: closer and out of the wind, but a pine hides most of the east tower.'],
  guide: [
    'These steps are for the Scree shelf, with a rifle that reaches 800 m. The two sentries in RED hats stand in the tower at each end of the yard.',
    'They wave to each other every 20 seconds, and the clock at the top counts down to the next wave. Both must fall between two waves.',
    'Let the first wave finish, about 11 seconds in. The right-hand (east) sentry is standing at his right-hand rail: shoot him first.',
    'Then the left-hand (west) sentry walks to his left-hand rail and stands still, about 13 seconds in. Shoot him before the clock runs out.',
    'At 800 m an ordinary rifle is not heard, so you need no blasting. Only shoot a man who is standing still: the bullet flies for over a second.',
    'HOLD reads about 8.5 up (about 7 m) and 1.6 left (about 1.3 m). On a mil-dot scope (dots along the lines, one per HOLD unit), the target sits halfway between the 8th and 9th dots below the centre and about 1.5 dots right of the upright line.',
  ],
  wind: { v: 4, gust: 1 }, par: 2,
  rules: { kill: ['w', 'e'], strict: true, strictText: 'The towers called it in. Varga\'s convoy was turned back before it reached the valley.' },
  vantages: [
    { name: 'Scree shelf', desc: '800 m. High on the open slope. Both towers in plain view, and the full crosswind.', eye: [0, 115, 0], tag: 'Clear view, harder shot' },
    { name: 'Tree line', desc: '650 m. Lower, closer and sheltered. A pine screens the east sentry unless he is at his right-hand rail.', eye: [-60, 62, 150], windMul: 0.5, look: [-30, 9], tag: 'Easier shot, fewer chances' },
  ],
  look: [-30, 8],
  setup() {
    const H = SCN.ridge({ z: 800, eye: [0, 115, 0], near: false, seed: 6 });
    C6.duck(H, H.PRr, 26.4, H.radar.roofY + 0.5);
    return H;
  },
  start(sim) { sim.nextWave = 8; sim.clock = (s) => fmtTime(Math.max(0, s.nextWave - s.t)); },
  cast(H) {
    return [
      Object.assign(H.towerW.at(1.0), { id: 'w', role: 'guard', face: 1, anim: 'guard', look: C6.red(),
        routine: [['wait', 8, 'guard', 1], ['walk', -49.1], ['wait', 5, 'look', -1], ['walk', -47.0], ['loop']] }),
      Object.assign(H.towerE.at(-1.1), { id: 'e', role: 'guard', face: -1, anim: 'guard', look: C6.red({ build: 'big' }),
        routine: [['wait', 6, 'guard', -1], ['walk', 37.25], ['wait', 7, 'look', 1], ['walk', 34.9], ['loop']] }),
      Object.assign(H.yard(-20), { id: 'g1', role: 'guard', anim: 'guard', look: { hat: 'cap', hatCol: '#2a2d33', coat: '#4a515c' }, routine: pace(-34, 26, 5, 6, 'guard') }),
      Object.assign(H.front(-30.6), { id: 'mech', role: 'civ', face: -1, anim: 'work', look: C6.mech, routine: [['wait', 999, 'work', -1]], failText: 'You shot the mechanic. He fixed trucks. That was all he did here.' }),
    ];
  },
  triggers(H) {
    return [
      // the wave: each sentry checks that the other is still there
      { at: 8, every: 20, do(sim) {
        sim.nextWave = sim.t + 20;
        if (sim.alarmT !== null || sim.winAt) return;
        const w = sim.byId.w, e = sim.byId.e;
        if (!w.dead) C6.interrupt(sim, w, [['wait', 2.6, 'wave', 1]]);
        if (!e.dead) C6.interrupt(sim, e, [['wait', 2.6, 'wave', -1]]);
        if (w.dead !== e.dead) {
          const left = w.dead ? e : w;
          sim.after(2.2, () => { if (left.dead || sim.winAt || sim.alarmT !== null) return; sim.msg('Pip', 'He waved and nobody waved back. He is going for the radio.'); sim.startle(left, 'check'); });
        }
      } },
      // blasting: three charges on the slope behind the compound, and their echo
      { at: 11, every: 20, do(sim) {
        if (sim.winAt) return;
        sim.cover(6.5, 'blasting');
        [0, 2.2, 4.3].forEach((dl, i) => sim.after(dl, () => { const x = [-38, 8, 31][i] + ((Math.round(sim.t) * 7) % 11) - 5; H.blasts.fire(sim.t, x); sim.ev.push({ k: 'crash', x, y: 6, plane: H.PV, kind: 'blast' }); }));
      } },
      hint(1.5, 'At this range the bullet flies for over a second and falls a long way. Read HOLD, aim that many marks above him, and fire only at a man who is standing still.', 9),
      hint(11.5, 'That was their wave. The clock counts down to the next one. Drop both sentries between two waves, or the one left standing calls it in.', 9),
      { at: 22, do(sim) { sim.msg('Pip', C6.heard(sim, sim.st) ? 'Your rifle carries this far, Kestrel. Fire only while the blasting rumbles, both shots.' : 'That blasting would cover a loud rifle. Yours will not carry this far anyway. Lucky you.'); } },
    ];
  },
  challenge: { id: 'heads', text: 'Two headshots at 800 metres', test: (sim) => ['w', 'e'].every((id) => sim.kills.some((k) => k.id === id && k.part === 'head')) },
  after: 'Both towers are quiet and nobody down there has looked up. The watch changes at dark, so that is how long we have. One more job before then.',
  solve(H, st, flags, sim) {
    const d = C6.dist(sim), tof = C6.tof(st, d), heard = C6.heard(sim, st), low = sim.vi === 1;
    const gap = st.action === 'charge' ? 3.5 : st.action === 'single' ? 3.0 : st.cycle + 1.3;   // seconds between two aimed shots
    const still = (id) => (s) => { const a = s.byId[id]; return !a.dead && a.goal === null && a.anim !== 'wave' && (a.state === 'susp' ? a.susp : a.state === 'calm' ? a.wait : 0) > tof + 0.7; };
    const shown = (s) => !low || s.byId.e.x > 36.9;   // from the tree line the pine hides him elsewhere
    const go = (s) => s.nextWave - s.t > gap + tof * 2 + 6 && still('e')(s) && shown(s) && s.byId.e.wait > tof + 1.2 && (!heard || (s.covered() && s.coverUntil - s.t > gap + 0.6));
    const hold = (id) => ['fn', (s) => { s.holdBreath(false); if (s.alive(id)) s.holdBreath(true); }];
    const west = (s) => s.byId.w.dead || (C6.ready(s) && still('w')(s) && (!heard || s.covered()));
    // one careful shot each, and one more try at either man if the rifle throws a round wide
    return [['until', go, 300], hold('e'), ['shoot', 'e', 'torso'], ['until', (s) => s.byId.e.dead || go(s), 300], hold('e'), ['shoot', 'e', 'torso'],
      ['until', west, 30], hold('w'), ['shoot', 'w', 'torso'], ['until', west, 30], hold('w'), ['shoot', 'w', 'torso']];
  },
  reward: { cr: 5000, xp: 1000 },
});

// ---------------------------------------------------------------------------
mission({
  id: 'c6m2', ch: 6, title: 'Blackout', range: 900,
  objective: 'Break the roof dish and the generator when no guard is near.',
  speaker: 'Pip',
  brief: 'The towers are empty and the light is going. Two things keep that compound alive after dark. The yellow generator in the open shed behind the bunkers, and the dish on the command bunker roof. Kill both and Aurel cannot see and cannot call for help. Order matters. Take the dish first and you have about twenty-five seconds before the radio room notices it is dead. Take the generator first and you have six, because lights going out are hard to miss. A guard walks past each one. If he is close when it breaks, he will know. Pick your moment between them.',
  intel: ['The DISH is on the roof of the big bunker. The GENERATOR is yellow, in the open shed behind and to the left. About 900 m.', 'A guard within about ten metres when one breaks will see it and raise the alarm.', 'Dish first: 25 seconds to finish. Generator first: 6 seconds.', 'While the generator runs, its noise covers a loud rifle.'],
  guide: [
    'You need a rifle that reaches 900 m. Break two things with no alarm: the dish on the roof of the big bunker, and the yellow generator in the open shed behind it, to the left.',
    'Dish first: you then have 25 seconds for the generator, and the clock shows it. Generator first leaves you only 6.',
    'Shoot the dish once the guard on the bunker roof has walked away to the left end of the roof, about 15 seconds in.',
    'Then wait for the big guard behind the bunkers to walk far to the left, past the generator (about 26 seconds in), and shoot the generator.',
    'HOLD reads about 8.1 up for the dish and 8.7 for the generator (7 to 8 m) and 1.5 left (about 1.4 m). The wind blows left to right; on a mil-dot scope the target sits about 8 dots below the centre and 1.5 dots right of the upright line.',
  ],
  wind: { v: 5, gust: 1.2 }, par: 2,
  rules: { destroy: ['dish', 'gen'], strict: true, strictText: 'The alarm went up with the job half done. Aurel had time to call the port for more men.' },
  alarmX: -2,
  vantages: [{ name: 'Scree shelf', desc: '900 m. High above the valley as the light goes.', eye: [0, 126, 0] }],
  look: [2, 7],
  setup() {
    const H = SCN.ridge({ z: 900, eye: [0, 126, 0], time: 'dusk', weather: 'clear', lamps: true, seed: 9 });
    const S = H.S;
    const seen = (sim, x, P, r) => sim.actors.forEach((a) => { if (a.role === 'guard' && !a.dead && !a.gone && (a.state === 'calm' || a.state === 'susp') && Math.hypot(a.x - x, a.plane.z - P.z) <= r) sim.startle(a, 'saw'); });
    H.dish.onHit = (sim) => seen(sim, H.dish.x, H.PM, 10);
    H.gen.onHit = (sim) => { S.power = false; S.objects.forEach((l) => { if (l.kind === 'lamp') l.on = false; }); sim.coverUntil = Math.min(sim.coverUntil, sim.t); seen(sim, H.gen.x, H.PB, 12); };
    C6.duck(H, H.PB, -17.5, H.b1.roofY + 0.4);
    return H;
  },
  cast(H) {
    return [
      Object.assign(H.cmd.on(12), { id: 'r1', role: 'guard', face: 1, anim: 'guard', look: C6.red(),
        routine: [['wait', 6, 'guard', 1], ['walk', -5], ['wait', 9, 'look', -1], ['walk', 12], ['loop']] }),
      Object.assign(H.back(-12), { id: 'g1', role: 'guard', face: -1, anim: 'guard', look: C6.red({ build: 'big' }),
        routine: [['walk', -52], ['wait', 6, 'guard', -1], ['walk', -8], ['wait', 6, 'guard', 1], ['loop']] }),
      Object.assign(H.yard(-19.5), { id: 'g2', role: 'guard', face: 1, anim: 'smoke', look: { hat: 'cap', hatCol: '#2a2d33', coat: '#4a515c' }, routine: [['wait', 999, 'smoke', 1]] }),
    ];
  },
  triggers(H) {
    const late = (sim, text) => { if (!sim.winAt) sim.fail('alarm', text, 1.2); };
    const count = (sim, sec) => { sim.deadline = sim.t + sec; sim.clock = (s) => (s.winAt ? '0:00' : fmtTime(Math.max(0, s.deadline - s.t))); };
    return [
      { at: 0.1, every: 4, do(sim) { if (H.gen.alive && !sim.winAt) sim.cover(4.6, 'generator'); } },
      onEv('obj:dish', (sim) => {
        if (!H.gen.alive) return;
        sim.msg('Pip', 'Dish is down. They check in with the port twice a minute. About twenty-five seconds, Kestrel.'); count(sim, 25);
        sim.after(25, () => { if (H.gen.alive) late(sim, 'The radio room found the dish dead while the lights still burned. They sounded the siren and Aurel sent for more men by road.'); });
      }),
      onEv('obj:gen', (sim) => {
        if (!H.dish.alive) return;
        sim.msg('Pip', 'Lights out and the dish is still up. The radio room is calling it in right now. Six seconds!'); count(sim, 6);
        sim.after(6, () => { if (H.dish.alive) late(sim, 'The lights went out and the radio still worked. The call for help reached the port before you reached the dish.'); });
      }),
      hint(1.5, 'Two things to break: the dish on the roof of the big bunker, and the yellow generator in the open shed behind it. A guard who is close when one breaks will see it. Wait until he has walked away.', 10),
      say(13, 'Pip', 'Dish first gives you time to breathe. Then watch the man who walks past the generator, and take it when he is at the far end of his beat.'),
    ];
  },
  challenge: { id: 'dark', text: 'Generator first, then the dish inside six seconds, with no alarm', test: (sim, res) => res.clean && sim.emitted['obj:gen'] < sim.emitted['obj:dish'] },
  after: 'Dark and deaf. Whatever Aurel does next, he does it alone. Varga goes in at first light.',
  solve(H, st) {
    const tf = C6.tof(st, 945) + 0.5;
    const clear = (id, x, r) => (s) => { const a = s.byId[id]; return a.dead || Math.abs(a.x - x) > r + 1 + 1.3 * tf; };
    return [['until', clear('r1', H.dish.x, 10), 200], ['shootObj', 'dish'], ['until', (s) => C6.ready(s) && clear('g1', H.gen.x, 12)(s), 60], ['shootObj', 'gen']];
  },
  reward: { cr: 5600, xp: 1080 },
});

// ---------------------------------------------------------------------------
mission({
  id: 'c6m3', ch: 6, title: 'The Long Walk', range: 1000,
  objective: (f) => (C6.party(f).length > 1 ? 'Varga\'s party is crossing the yard. Stop each gunman in time.' : 'Varga is crossing the yard alone. Stop each gunman in time.'),
  speaker: (f) => (C6.ally(f) ? 'Varga' : 'Pip'),
  brief: (f) => (C6.ally(f)
    ? 'Detective Varga. We have not met, and I would like to keep it that way until this is done. I am going to walk across that yard to the bunker door with a warrant in my hand, in plain sight, because that is how it has to be done. ' + (f.sparedReyes && f.savedBrandt ? 'Reyes and Brandt are walking with me. They insisted.' : f.sparedReyes ? 'Tomas Reyes is walking with me. He insisted.' : 'Nadia Brandt is walking with me. She says somebody has to see it.') + ' Aurel has four men left who will try to stop us. They will stand up one at a time, near and far. I will not run and I will not look up. That part is yours.'
    : 'Varga is going in, Kestrel. Alone, on foot, across the open yard, with a warrant in her hand. She does not know you are up here, and she would arrest you if she did. Nobody is left alive who could tell her otherwise. Aurel has four men who will try to stop her. They will stand up one at a time, near and far, and each needs a few seconds to aim. She will not run. Do not let one of them finish. I cannot see the towers from down here, so use your own eyes.'),
  intel: (f) => ['Four gunmen in RED hats will stand up with rifles, one after another, between 830 and 1,110 m.', 'Each needs ten seconds or so to aim. The clock shows the one closest to firing.', 'Every range needs its own hold. Read HOLD again for each man.', 'The helicopter warming up on the pad drowns out any rifle.', C6.ally(f) ? 'Varga\'s people will call out where each gunman is.' : 'Nobody will call them out for you. Look high: roofs and towers.'],
  guide: [
    'You need a rifle that reaches 1,000 m. Keep Varga (and anyone with her) alive until she reaches the bunker door, and note that the helicopter drowns out every shot.',
    'Four gunmen in red hats kneel up one at a time with rifles, and the clock shows the one closest to firing. Each is at a different range, so read HOLD again on each man.',
    'First: on the roof of the checkpoint down by the road, about 6 seconds in (about 830 m, HOLD about 6.9 up, 1.3 left).',
    'Second: in the tower on the left, about 24 seconds in (about 1,000 m, HOLD about 9.0 up, 1.6 left).',
    'Then two at once, about 37 seconds in. Shoot the one on the low bunker roof by the tanks first, because he is quicker (HOLD about 9.6 up, 1.9 left), then the far tower at the back (HOLD about 10.5 up, 2.0 left).',
    'The wind blows left to right, so always aim left. If your scope has a zero dial (the ZERO box with + and -), you can set it to each man\'s range and aim dead on for height.',
  ],
  wind: { v: 5, gust: 1 }, par: 5,
  rules: { protect: ['varga', 'reyes', 'brandt'], until: 'inside', done: (sim) => !sim.actors.some((a) => !a.dead && a.threat) },
  vantages: [{ name: 'The cairn', desc: '1,000 m. A pile of stones on the bare shoulder of the hill, looking down into the yard.', eye: [0, 145, 0] }],
  look: [-52, 5],
  setup() {
    const H = SCN.ridge({ z: 1000, eye: [0, 145, 0], time: 'dawn', weather: 'clear', heli: 'live', seed: 6 });
    C6.duck(H, H.PA, -43.3, 4.5);
    return H;
  },
  start(sim) {
    sim.clock = (s) => { let m = 99; s.actors.forEach((a) => { if (!a.dead && a.threat) m = Math.min(m, a.threat.t); }); return m < 99 ? fmtTime(Math.ceil(m)) : '-:--'; };
  },
  tick(sim, H, dt) { H.heli.step(sim, dt); },
  cast(H, f) {
    const door = H.door;
    const walkers = C6.party(f).map((p, i) => Object.assign(H.yard(-74 - i * 2.3), { id: p.id, role: 'vip', face: 1, look: p.look, failText: p.failText, lostText: p.lostText,
      routine: [['wait', 2], ['walk', door - i * 0.4, 1.1], ['emit', 'inside'], ['hide'], ['gone']], flee: [['run', door], ['emit', 'inside'], ['hide'], ['gone']] }));
    return walkers.concat([
      C6.pilot('You shot the pilot. He was only warming up the engine.'),
      Object.assign(H.yard(9), { id: 'tech', role: 'civ', face: -1, anim: 'hands', look: { hat: 'hardhat', hatCol: '#e9edf1', coat: COL.navy }, routine: [['wait', 999, 'hands', -1]], failText: 'He had his hands up. You of all people know what that means.' }),
    ]);
  },
  vehicles(H) { return [H.heli.veh({ seats: ['pilot'] })]; },
  triggers(H, f) {
    const who = f.sparedReyes ? 'Reyes' : f.savedBrandt ? 'Brandt' : null;
    const v2 = f.sparedReyes ? 'reyes' : 'varga', v4 = f.savedBrandt ? 'brandt' : 'varga';
    const gun = (id, place, victim, sec, face) => (sim) => { if (sim.winAt || sim.failInfo) return; sim.addActor(Object.assign(place, { id, role: 'guard', face, anim: 'kneel', look: C6.red({ gun: 'rifle', build: 'big', h: 1.08 }), routine: [['wait', 0.9, 'kneel'], ['threat', victim, sec]] })); };
    const call = (sim, close, vague) => sim.msg(who || 'Pip', who ? close : vague);
    return [
      { at: 0.2, every: 6, do(sim) { if (!sim.winAt) sim.cover(6.6, 'helicopter'); } },
      { at: 6, do(sim) { gun('g1', H.post.on(-21.2), 'varga', 12, 1)(sim); call(sim, 'Behind us! On the roof of the checkpoint, down on the road!', 'Gun! Close to you, low, somewhere near the road.'); } },
      { at: 23.5, do(sim) { gun('g2', H.towerW.at(0.7), v2, 11, 1)(sim); call(sim, 'The tower on the left, right behind us!', 'Another one. High, on the left.'); } },
      { at: 36, do(sim) { gun('g3', H.towerR.at(-0.4), 'varga', 15, 1)(sim); } },
      { at: 36.6, do(sim) { gun('g4', H.b2.on(22), v4, 9.5, -1)(sim); call(sim, 'Two! Far tower at the back, and one on the low bunker roof by the tanks. The roof man is quicker!', 'Two at once, far side. One of them will be ready before the other.'); } },
      hint(1.5, 'Gunmen will stand up near and far. Each range needs a different hold, and a far bullet takes longer to arrive: it has to land before his clock runs out, not just leave the barrel.', 10),
      onEv('inside', (sim) => sim.msg(who ? 'Varga' : 'Pip', who ? 'We are at the door. Whoever you are: thank you.' : 'She is at the door. She thinks she was lucky four times.')),
    ];
  },
  challenge: { id: 'four', text: 'All four gunmen with four rounds', test: (sim) => sim.stats.shots === 4 && ['g1', 'g2', 'g3', 'g4'].every((id) => sim.kills.some((k) => k.id === id)) },
  after: (f) => (C6.ally(f) ? 'Varga is inside with her warrant. She asked who was on the hill. Nobody told her.' : 'She is inside. She thinks she got lucky four times in a row. Let her think it.'),
  solve(H, st) {
    const up = (id) => (s) => !!s.byId[id] && (!!s.byId[id].threat || s.byId[id].dead) && C6.ready(s);
    const one = (id) => [['until', up(id), 60]].concat(C6.shot(id), C6.again(id));
    return one('g1').concat(one('g2'), [['fn', (s) => { if (s.sh.ammo < 3 && s.st.mag > 1) s.reload(); }]], one('g4'), one('g3'));
  },
  testFlags: [{}, { sparedReyes: true }, { savedBrandt: true }, { sparedReyes: true, savedBrandt: true }],
  reward: { cr: 6200, xp: 1160 },
});

// ---------------------------------------------------------------------------
mission({
  id: 'c6m4', ch: 6, title: 'Glint', range: 1200,
  objective: 'Three hides flash on the far ridge. One is Rook\'s scope. Break that one and no other.',
  speaker: 'Pip',
  brief: 'Pip. Aurel was not in the bunker. He is making for the helicopter, and Rook has Varga pinned behind the road blocks from the far ridge. A round every twenty seconds to keep heads down, and then he will stop playing. Three stone hides up there, the kind a marksman shoots from, and something flashes in each. Two are shaving mirrors on a cord, hung to draw fire. Break one and he will know he is hunted, and he will shoot to kill. The third flash is his scope. A mirror keeps perfect time. A man does not. One round through his glass. Leave the rest alone.',
  intel: (f) => ['Three hides on the far ridge, about 1,200 m. Each one flashes.', 'Two are MIRRORS: they flash in a steady beat. One is ROOK: his glass flashes when he moves it, and just before he fires.', 'Break a mirror and he shoots to kill. His third shot kills anyway.', 'Aim at the dark slot of the hide. Wind is strong: hold well into it.'].concat(C6.ally(f) ? ['The people behind the blocks can see the ridge too. Listen to them.'] : []),
  guide: [
    'You need a rifle that reaches 1,200 m. Three stone hides on the far ridge each flash: two are mirrors and one is Rook\'s scope.',
    'Rook is in the RIGHT-hand hide. The left and middle ones blink in a perfectly steady beat, while his flashes come at odd moments, with a long, slow flare just before each shot.',
    'Never shoot a mirror, or he fires to kill. His shots come about 11, 30 and 49 seconds in, and the third one kills.',
    'Aim at the dark slot of the right-hand hide where it flashes. HOLD reads about 10.2 up (over 12 m) and 2.0 left (about 2.3 m), or set the zero dial to 1200 and hold only for the wind.',
    'The wind is strong and gusty from the left, so wait for a steady moment and check HOLD right before you fire. One round.',
  ],
  wind: { v: 6, gust: 1.5 }, par: 1,
  rules: { destroy: ['lens'], protect: ['varga', 'reyes', 'brandt'] },
  vantages: [{ name: 'The cairn', desc: '1,200 m to the far ridge, across the whole valley, with snow in the air.', eye: [0, 150, 0] }],
  look: [2, 71],
  setup() {
    const H = SCN.ridge({ z: 860, ridge: 1200, focus: 'ridge', eye: [0, 150, 0], weather: 'snow', fog: 1.15, heli: 'parked', seed: 6 });
    const S = H.S, hd = H.hides, P = H.PRg;
    H.m1 = K.thing(S, P, 'glint', hd[0].lens[0], hd[0].lens[1], { id: 'm1', r: 0.45, rate: 0.5, phase: 0.15 });
    H.m2 = K.thing(S, P, 'glint', hd[1].lens[0], hd[1].lens[1], { id: 'm2', r: 0.45, rate: 0.3125, phase: 0.55 });
    // Rook's scope: it flashes when the mission says so, and his breath shows in the cold
    H.lens = K.thing(S, P, 'glint', hd[2].lens[0], hd[2].lens[1], { id: 'lens', r: 0.45, drawFn(ctx, env, S2, ob) {
      if (!ob.alive) return;
      const u = (env.t % 4.4) / 2.0;
      if (u < 1) { ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.55 * (1 - u) * Math.min(1, u * 6); ctx.beginPath(); ctx.arc(ob.x - 0.8 + env.wind * u * 0.3, ob.y + 0.25 + u * 1.1, 0.2 + u * 0.55, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
      const f = ob.flash; if (!f) return;
      const v = (env.t - f.t) / f.dur; if (v < 0 || v > 1) return;
      const a = Math.min(1, Math.sin(v * Math.PI) * (f.dur > 1 ? 2.2 : 1)), r = Math.max(0.5, env.px * 5) * a;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = Math.max(0.05, env.px * 1.2);
      ctx.beginPath(); ctx.moveTo(ob.x - r, ob.y); ctx.lineTo(ob.x + r, ob.y); ctx.moveTo(ob.x, ob.y - r); ctx.lineTo(ob.x, ob.y + r); ctx.stroke(); circ(ctx, ob.x, ob.y, r * 0.3, 'rgba(255,255,255,' + a + ')'); ctx.restore();
    } });
    C6.duck(H, P, -72, H.ridgeTop(-72) + 0.7);
    return H;
  },
  cast(H, f) {
    return C6.party(f).map((p, i) => Object.assign(H.front(-6.2 - i * 2.6), { id: p.id, role: 'vip', state: 'alert', face: 1, anim: 'cower', look: p.look, failText: p.failText,
      lostText: p.id === 'varga' ? 'Rook stopped playing. Detective Varga never reached the pad.' : p.lostText, routine: [['wait', 999, 'cower', 1]] }));
  },
  triggers(H, f) {
    const party = C6.party(f), victim = party[party.length - 1].id, shotAt = [11, 30, 49];
    // Rook fires: a flash and a puff of snow at his hide, then the round arrives
    const fires = (sim, kill) => {
      if (!H.lens.alive || sim.winAt || sim.failInfo) return;
      sim.rookShots = (sim.rookShots || 0) + 1;
      sim.ev.push({ k: 'npcshot', x: H.lens.x, y: H.lens.y - 1.4 });
      sim.ev.push({ k: 'impact', x: H.lens.x + 0.4, y: H.lens.y + 0.9, z: H.zr, plane: H.PRg, mat: 'snow', tof: 0, dist: H.zr, small: true });
      sim.after(0.5, () => {
        const a = sim.byId[victim]; if (!a || a.dead || sim.failInfo) return;
        if (kill) { sim.killActor(a, 'torso', 'npc', null); return; }
        sim.ev.push({ k: 'impact', x: a.x + 1.6, y: 1.25, z: H.PF.z, plane: H.PF, mat: 'hard', tof: 0, dist: H.PF.z });
        party.forEach((p) => { const b = sim.byId[p.id]; if (b && !b.dead) sim.bubble(b, '!', 1.6); });
      });
    };
    const wrong = (sim) => {
      if (!H.lens.alive || sim.winAt) return;
      sim.msg('Pip', 'That was a mirror. He saw it go.');
      H.lens.flash = { t: sim.t, dur: 1.2 };
      sim.after(1.3, () => fires(sim, true));
    };
    const tr = [
      hint(1.5, 'Three stone hides on the far ridge, and something flashes in each. Watch before you shoot. A mirror on a cord keeps perfect time. Rook does not.', 10),
      onEv('obj:m1', wrong), onEv('obj:m2', wrong),
      { at: shotAt[0] + 2.2, do(sim) { if (H.lens.alive) sim.msg('Pip', 'He is walking them in. Did you see which hide lit up just before that shot? Glass has to point at what it shoots.'); } },
      { at: shotAt[1] + 1.5, do(sim) { if (H.lens.alive) sim.msg('Pip', 'That was the second. He will not waste a third. Find him, Kestrel.'); } },
      onEv('obj:lens', (sim) => sim.msg('Pip', 'That was his glass! He cannot aim at anything now.')),
    ];
    if (f.savedBrandt) tr.push({ at: 6, do(sim) { if (H.lens.alive) sim.msg('Brandt', 'I have a long lens on that ridge. The left flash is a metronome. Nobody holds a rifle that steady.'); } });
    if (f.sparedReyes) tr.push({ at: 17, do(sim) { if (H.lens.alive) sim.msg('Reyes', 'The middle one swings. I can see it turn. That is a thing on a string, not a man.'); } });
    [2.6, 6.3, 16.2, 22.9, 24.1, 36.5, 41.2].forEach((t) => tr.push({ at: t, do() { if (H.lens.alive) H.lens.flash = { t, dur: 0.34 }; } }));
    shotAt.forEach((T, i) => {
      tr.push({ at: T - 1.7, do(sim) { if (H.lens.alive && !sim.winAt) H.lens.flash = { t: sim.t, dur: 1.5 }; } });
      tr.push({ at: T, do(sim) { fires(sim, i === 2); } });
    });
    return tr;
  },
  challenge: { id: 'first', text: 'Break the scope before Rook fires a single shot', test: (sim) => !sim.rookShots },
  after: 'His scope is in pieces and Varga is moving again. Kestrel. He is on the open channel, asking for you by name.',
  solve(H, st) {
    const tf = C6.tof(st, 1200);
    return [['wait', 3.5], ['until', (s) => C6.steady(s, tf + 0.4, 0.3), 5], ['hold'], ['shootObj', 'lens']];
  },
  testFlags: [{}, { sparedReyes: true }, { savedBrandt: true }, { sparedReyes: true, savedBrandt: true }],
  reward: { cr: 6600, xp: 1220 },
});

// ---------------------------------------------------------------------------
// The fourth choice. Every path is a win: the outcome decides sparedRook.
mission({
  id: 'c6m5', ch: 6, title: 'Rook', range: 1300,
  objective: 'Rook is standing up with his hands raised. Nobody is giving the order this time.',
  speaker: 'Pip',
  brief: 'His glass is gone and he knows who broke it. He has been on the open channel for a minute, asking for you by name. He says he is going to stand up. Kestrel, I was not here three years ago. I only know what it cost you: a man with his hands in the air, an order, and a round you put wide on purpose. This is the same ridge. Shoot him, or do not. Nobody is giving orders today, least of all me. If you only want him harmless, he will have to put that rifle down some time.',
  intel: ['Rook, on the ledge by his hide, about 1,300 m. Hands raised.', 'He will lay his rifle down beside him. A rifle can be shot too.', 'Hold your fire for twenty seconds and he walks away.', 'There is no wrong answer in the rules. Only the one you can live with.'],
  guide: [
    'This is a choice, and these steps spare Rook by breaking his rifle. You need a rifle that reaches 1,300 m.',
    'He stands up on the ledge by his hide with his hands raised, about 4 seconds in. Do not shoot him.',
    'About 10 seconds in he kneels and lays his rifle across a flat stone beside him. Shoot the rifle.',
    'HOLD reads about 11.8 up (over 15 m) and 1.4 left (about 2 m), or set the zero dial to about 1325 and hold only for the wind. The wind blows left to right.',
    'Other choices: shoot Rook, or do not fire at him for 20 seconds and he walks away. Every choice is a win, but it changes the ending.',
  ],
  wind: { v: 4, gust: 0.8 }, par: 1,
  // it ends when he is dead or has walked out of sight, so a round fired at his back still counts
  rules: { done: (sim) => !sim.alive('rook') || sim.did('gone:rook'), aftermath: 2.4 },
  vantages: [{ name: 'The cairn', desc: '1,300 m. The same stones you lay behind three years ago.', eye: [0, 160, 0] }],
  look: [36, 70],
  setup() {
    const H = SCN.ridge({ z: 940, ridge: 1320, focus: 'ridge', eye: [0, 160, 0], weather: 'clear', heli: 'parked', seed: 6 });
    const S = H.S, P = H.PRg, hd = H.hides[2], rx = hd.x + 5.1, ry = hd.y + 0.3;
    const dark = S.tone('#14171c', P), wood = S.tone('#5a4634', P), stone = S.tone('#7b8794', P), stoneD = S.tone('#4d5661', P), rim = 'rgba(255,255,255,0.75)';
    // his rifle, once he lays it across a flat stone beside him
    H.rifle = S.obj({ kind: 'rifle', id: 'rifle', plane: P, x: rx, y: ry + 0.42, w: 2.0, h: 0.9, r: 0.6, mat: 'metal', breakable: true, gone: true, layer: 2, draw(ctx, env) {
      poly(ctx, [rx - 0.8, ry, rx + 0.8, ry, rx + 0.62, ry + 0.34, rx - 0.6, ry + 0.38], stone); R4(ctx, rx - 0.8, ry, 1.6, 0.1, stoneD);
      ctx.lineCap = 'round';
      if (H.rifle.alive) {
        ctx.strokeStyle = rim; ctx.lineWidth = Math.max(0.16, env.px * 2.6); ctx.beginPath(); ctx.moveTo(rx - 0.85, ry + 0.5); ctx.lineTo(rx + 0.9, ry + 0.66); ctx.stroke();
        ctx.strokeStyle = wood; ctx.lineWidth = Math.max(0.13, env.px * 1.8); ctx.beginPath(); ctx.moveTo(rx - 0.85, ry + 0.5); ctx.lineTo(rx - 0.3, ry + 0.55); ctx.stroke();
        ctx.strokeStyle = dark; ctx.lineWidth = Math.max(0.1, env.px * 1.8); ctx.beginPath(); ctx.moveTo(rx - 0.35, ry + 0.55); ctx.lineTo(rx + 0.9, ry + 0.66); ctx.stroke();
        R4(ctx, rx - 0.2, ry + 0.62, 0.5, 0.13, dark);
      } else {
        ctx.strokeStyle = wood; ctx.lineWidth = Math.max(0.13, env.px * 1.8); ctx.beginPath(); ctx.moveTo(rx - 1.1, ry + 0.2); ctx.lineTo(rx - 0.6, ry + 0.42); ctx.stroke();
        ctx.strokeStyle = dark; ctx.lineWidth = Math.max(0.09, env.px * 1.6); ctx.beginPath(); ctx.moveTo(rx + 0.2, ry + 0.4); ctx.lineTo(rx + 1.15, ry + 0.12); ctx.stroke();
      }
      ctx.lineCap = 'butt';
    } });
    C6.duck(H, P, H.hides[0].x - 0.2, H.hides[0].y + 2.55);
    return H;
  },
  cast(H) {
    const hd = H.hides[2];
    return [Object.assign(hd.at(3.3), { id: 'rook', role: 'hostile', state: 'alert', face: -1, anim: 'kneel', look: { coat: '#eef1f4', long: true, hair: 'short', hairCol: '#8a8f96', beard: '#8a8f96', gun: 'rifle', h: 1.05 },   // a white snow smock: he shows against the rock
      routine: [['wait', 3.5, 'kneel', -1], ['emit', 'stood'], ['wait', 5.5, 'hands', -1], ['wait', 1.3, 'kneel', 1], ['call', (sim, a) => { a.look.gun = null; H.rifle.gone = false; }], ['emit', 'laid'], ['wait', 13.2, 'hands', -1],
        ['emit', 'rookleft'], ['wait', 1.2, 'stand', 1], ['walk', hd.x + 10.6], ['hide'], ['gone']] })];
  },
  tick(sim) {
    // for the challenge: is the scope on him while he stands there?
    const r = sim.byId.rook; if (!sim.did('stood') || sim.did('rookleft') || sim.did('obj:rifle') || sim.winAt || r.dead) return;
    const d = r.plane.z - sim.eye0.z, ax = ((r.x - sim.eye0.x) / d) * 1000, ay = ((r.y + 1 - sim.eye0.y) / d) * 1000;
    sim.watchN = (sim.watchN || 0) + 1; if (Math.hypot(sim.sh.ax - ax, sim.sh.ay - ay) < (175 / sim.sh.zoom) * 0.92) sim.watchOn = (sim.watchOn || 0) + 1;
  },
  triggers(H, f) {
    const hd = H.hides[2];
    return [
      say(0.8, 'Pip', 'He has stopped shooting. He says he is going to stand up, and that you will know why.', 4),
      hint(2.2, 'No order this time. You can shoot him. You can shoot the rifle once he lays it down. Or keep your finger off the trigger for twenty seconds and he walks away.', 11),
      onEv('stood', (sim) => sim.msg('Rook', 'Kestrel. Look at me. Same ridge. Hands up, the same as he was.', 4.2), 0.9),
      { at: 8.6, do(sim) { if (sim.alive('rook') && !sim.winAt) sim.msg('Rook', 'I called that target for money, and I told them you froze. You did not freeze. You were right.', 5); } },
      onEv('laid', (sim) => { if (sim.alive('rook') && !sim.winAt) sim.msg('Rook', 'There is the rifle. I am done carrying it. Your call. It always was.', 4.5); }, 2.6),
      { at: 17.6, do(sim) { if (!sim.alive('rook') || sim.winAt) return; if (f.sparedMarlow) sim.msg('Marlow', 'Kestrel. Varga has let me have her radio. The order three years ago came from Aurel himself. Rook only read it out. Do what you like with that.', 6); else sim.msg('Pip', 'Nobody is going to tell you what to do, Kestrel. Not today.', 4); } },
      // a hit anywhere takes him off that ledge
      { when: (sim) => sim.byId.rook.wounded && !sim.byId.rook.dead, do(sim) { sim.killActor(sim.byId.rook, 'torso', 'shot', null); } },
      onEv('obj:rifle', (sim) => { sim.setRoutine('rook', [['wait', 1.4, 'stand', 1], ['wait', 1.0, 'stand', -1], ['walk', hd.x + 10.6], ['hide'], ['gone']], true); sim.msg('Rook', 'Understood.', 3); }),
    ];
  },
  challenge: { id: 'watch', text: 'Keep him in your scope the whole time he is standing', test: (sim) => sim.watchN > 0 && sim.watchOn / sim.watchN > 0.9 },
  outcomes: [
    { id: 'back', when: (sim) => !sim.alive('rook') && (sim.did('rookleft') || sim.did('obj:rifle')), set: { sparedRook: false }, text: 'He had put the rifle down and turned to go. You fired anyway. Whatever that was, it was not an order.' },
    { id: 'killed', when: (sim) => !sim.alive('rook') && sim.did('stood'), set: { sparedRook: false }, text: 'Rook went down with his hands still raised. Nobody repeated the order this time. You gave it yourself.' },
    { id: 'early', when: (sim) => !sim.alive('rook'), set: { sparedRook: false }, text: 'You did not wait to hear what he had to say. Rook never stood up. Three years ago you needed a reason. Today you had one ready.' },
    { id: 'rifle', when: (sim) => sim.did('obj:rifle'), set: { sparedRook: true }, text: 'One round, through the rifle and nothing else. Rook looked at the pieces, then across the valley, and nodded once. Then he walked.' },
    { id: 'wide', when: (sim) => sim.stats.shots > (sim.stats.duck ? 1 : 0), set: { sparedRook: true }, text: 'You put it wide. On purpose, the same as last time. Rook did not flinch. He knew the difference, and so did you.' },
    { id: 'held', when: () => true, set: { sparedRook: true }, text: 'Twenty seconds, and you never fired at him. He laid the rifle down and walked away from it.' },
  ],
  after: 'Three years, and it came back to the same ridge. Now there is only Aurel, and he is running for his helicopter.',
  solve: [['until', (s) => s.did('laid')], ['wait', 1.2], ['hold'], ['shootObj', 'rifle']],
  testFlags: [{}, { sparedMarlow: true }],
  reward: { cr: 7000, xp: 1300 },
});

// ---------------------------------------------------------------------------
// The finale. Two ways to win: the outcome decides arrestedAurel.
mission({
  id: 'c6m6', ch: 6, title: 'Cold Bore', range: 1400,
  objective: 'Stop Aurel: the back seat, or the yellow tail rotor. Not the pilot.',
  speaker: 'Pip',
  brief: (f) => 'Aurel is running. His helicopter is on the pad with the rotors turning, and Varga is still two minutes away on foot. Cold bore, Kestrel: the first shot from a cold barrel, the one you do not get to practise. He sits in the back. End it there if you want it ended. Or break the tail rotor, the yellow ring, and the machine comes down in one piece with him inside it for Varga. The pilot only drives. Not him. The bullet takes two seconds, so fire while the aircraft is still. ' + (f.sparedRook ? 'And you have a spotter again, if you can stand it.' : 'He has a new bodyguard beside him. Aurel is the one furthest back.'),
  intel: (f) => ['The helicopter on the pad, about 1,400 m. Aurel boards in a few seconds. It lifts, hovers for a few seconds, and goes.', 'AUREL: white hair, in the BACK seat. The PILOT in front must not be hit.' + (f.sparedRook ? '' : ' The man in the black helmet between them is a bodyguard.'), 'The TAIL ROTOR is the yellow ring at the tail. Break it and the helicopter settles back down.', 'Two seconds of flight: fire only while it sits on the pad or hangs in the hover.', f.sparedRook ? 'Rook will call the wind. When he says it is steady, it is.' : 'The wind gusts. Watch the windsock and wait for it to hold.'],
  guide: [
    'This is a choice, and these steps take Aurel alive by breaking the yellow tail rotor. You need a rifle that reaches 1,400 m.',
    'Aurel (white hair, red scarf) boards about 8 seconds in. The helicopter lifts at about 15 seconds and hovers from about 20 seconds, for about 10 seconds.',
    'Wait for the hover, when Pip says it is the last still moment. Shoot the yellow ring at the tail, never the cockpit: the pilot is innocent.',
    'The bullet takes over 2 seconds to arrive, so only shoot while the helicopter hangs still.',
    'HOLD reads about 12.9 up (about 18 m) and 2.7 left (about 3.8 m), or set the zero dial to 1400 and hold only for the wind. The wind blows hard left to right and gusts, so check HOLD right before you fire.',
    'The other choice is to shoot Aurel in the back seat instead. Both end the story, with different endings.',
  ],
  wind: { v: 7, gust: 2 }, par: 1,
  rules: { done: (sim) => !sim.alive('aurel') || sim.did('obj:tail'), aftermath: 6 },
  vantages: [{ name: 'The cairn', desc: '1,400 m. The far end of the valley, in a rising wind, as the light goes.', eye: [0, 210, 0] }],
  look: [52, 5],
  setup() {
    const H = SCN.ridge({ z: 1400, eye: [0, 210, 0], time: 'dusk', weather: 'snow', heli: 'live', heliSpin0: 0.5, seed: 6 });
    C6.duck(H, H.PM, 36, H.towerE.floor + 3.95);
    return H;
  },
  start(sim) {
    const LIFT = 4.4, GONE = 5.5;
    sim.clock = (s) => {
      const v = s.byId.heli, R = v.routine, a = s.byId.aurel; let left;
      if (s.winAt) return '-:--';
      if (s.did('leaving')) left = s.emitted.leaving + GONE - s.t;
      else if (s.did('hover')) left = v.wait + GONE;
      else if (s.did('lifting')) left = s.emitted.lifting + LIFT - s.t + R[6][1] + GONE;
      else if (s.did('boarded')) left = v.wait + LIFT + R[6][1] + GONE;
      else left = (a.goal === null ? a.wait : 0) + Math.max(0, 56.6 - a.x) / 1.3 + R[1][1] + LIFT + R[6][1] + GONE;
      return fmtTime(Math.max(0, left));
    };
  },
  tick(sim, H, dt) {
    H.heli.step(sim, dt);
    // a round that lands without ending it: the pilot stops waiting for the wind
    sim.seenB = sim.seenB || 0;
    while (sim.seenB < sim.bullets.length && !sim.bullets[sim.seenB].alive) {
      sim.seenB++;
      if (sim.stats.duck && !sim.duckDone) { sim.duckDone = true; continue; }   // nobody minds about the duck
      if (!sim.rules.done(sim)) C6.hurry(sim, 'He felt that one. The pilot is not going to wait for the wind now.');
    }
  },
  onAlarm(sim) { C6.hurry(sim, 'They know. The pilot is not going to wait for the wind now.'); },
  cast(H, f) {
    const c = [
      C6.pilot('You shot the pilot. He flew other people where they told him to. He was not on anybody\'s list.'),
      // he stops short of the cabin for a last word (clear of the tail rotor, so a round meant for him cannot clip it), then boards
      Object.assign(H.onPad(53.0), { id: 'aurel', role: 'target', face: f.sparedRook ? 1 : -1, look: { hair: 'white', coat: '#15171b', long: true, scarf: COL.red, bag: 'case', h: 1.06 },
        routine: [['wait', 5.4, f.sparedRook ? 'talk' : 'point', f.sparedRook ? 1 : -1], ['walk', 56.6], ['emit', 'boarded'], ['veh', 'heli', 1]], flee: [['run', 56.6], ['emit', 'boarded'], ['veh', 'heli', 1]] }),
      Object.assign(H.onPad(70.5), { id: 'marshal', role: 'civ', face: -1, anim: 'wave', look: C6.marshal, routine: [['wait', 999, 'wave', -1]], failText: 'You shot the man waving the helicopter off. He was nobody. That was the point of him.' }),
      Object.assign(H.towerE.at(0.5), { id: 'te', role: 'guard', face: 1, anim: 'guard', look: C6.red(), routine: [['wait', 999, 'guard', 1]] }),
    ];
    if (!f.sparedRook) c.push(Object.assign(H.onPad(51.3), { id: 'bg', role: 'guard', face: 1, look: { hat: 'helmet', hatCol: '#101216', coat: '#2a2f38', build: 'big' },
      routine: [['wait', 5.6, 'stand', 1], ['walk', 55.2], ['waitFor', 'boarded'], ['wait', 0.5], ['veh', 'heli', 2]] }));
    return c;
  },
  vehicles(H) {
    return [H.heli.veh({ seats: ['pilot'], routine: [
      ['waitFor', 'boarded'], ['wait', 7], ['emit', 'lifting'], ['call', (sim, v) => { v.altTo = 8; v.climb = 2; }], ['wait', 4.4],
      ['emit', 'hover'], ['wait', 10], ['emit', 'leaving'], ['call', (sim, v) => { v.altTo = 70; v.climb = 4.5; }], ['drive', 430, 17], ['gone']] })];
  },
  triggers(H, f) {
    const still = (sim, need) => { const v = sim.byId.heli; return (sim.did('boarded') && !sim.did('lifting') && v.wait > need) || (sim.did('hover') && !sim.did('leaving') && v.wait > need); };
    const tr = [
      hint(1.5, 'Two ways to end it: the man in the back seat, or the yellow ring at the tail. The bullet can take two seconds to arrive, so fire only while the helicopter is still: on the pad, or in the hover.', 10),
      say(0.7, 'Pip', f.sparedRook ? 'That is Aurel by the cabin door, shouting at the pilot. White hair, red scarf.' : 'That is Aurel by the cabin door, giving his last orders. White hair, red scarf.', 4),
      onEv('boarded', (sim) => sim.msg('Pip', f.sparedRook ? 'He is in. Back seat. The pilot is in front: not him.' : 'He is in, furthest back. The black helmet beside him is the bodyguard. Pilot in front: not him.'), 0.4),
      onEv('hover', (sim) => { if (!sim.winAt) sim.msg('Pip', 'He is holding a hover to let the gust pass. This is the last still moment you get.'); }),
      { when: (sim) => sim.did('boarded') && !sim.did('lifting') && sim.byId.heli.wait < 2.3 && sim.byId.heli.wait > 0, do(sim) { if (!sim.winAt) sim.msg('Pip', 'Too late for the pad, it is about to lift. Wait for the hover.', 3.5); } },
      onEv('leaving', (sim) => { if (sim.winAt) return; sim.msg('Pip', 'He is going!', 3); sim.after(5.5, () => { if (!sim.winAt) sim.fail('time', 'The helicopter cleared the ridge with Aurel in it. By morning he was somewhere the law could not follow, with very good lawyers.', 0.6); }); }),
      // the pilot wants no part of what just happened behind him
      onEv('dead:aurel', (sim) => { const v = sim.byId.heli; if (v.seats.indexOf('aurel') < 0) return; v.routine = []; v.pc = 0; v.goal = null; v.wait = 0; v.waitFor = null; v.v = 0; v.altTo = 0; v.climb = 1.7; v.spinTo = 0.25; }),
      onEv('down:heli', (sim) => sim.msg('Pip', 'It is down. In one piece. Varga is running for it with the handcuffs out.')),
      { at: 80, do(sim) { if (!sim.winAt) sim.fail('time', 'Aurel never boarded, and never needed to. He left by the road while you watched the pad.', 0.6); } },
    ];
    if (f.sparedRook) {
      tr.push(say(4.2, 'Rook', 'Kestrel. It is Rook. I can see his windsock from here. I will call the wind. You do the rest.', 4.5));
      tr.push({ at: 9, every: 0.5, do(sim) {
        if (sim.winAt || sim.failInfo) return;
        const st = sim.st, tf = C6.tof(st, 1400);
        if (!still(sim, tf + 2.2) || sim.t - (sim.callT || -9) < 4.6) return;
        // he only says "steady" if it will hold long enough to aim, fire and for the round to get there
        if (C6.steady(sim, tf + 2.0, C6.windTol(st, 1400))) {
          const w = sim.wind(), dp = Bal.dope(st, sim.sh.zeroAng, 1400, w); sim.callT = sim.steadyT = sim.t;
          sim.msg('Rook', 'Wind steady, ' + (w > 0 ? 'left to right' : 'right to left') + ', ' + fmt(Math.abs(w), 0) + '. Hold ' + fmt(Math.abs(dp.driftMil), 1) + (dp.driftMil > 0 ? ' left' : ' right') + '. Send it.', 3.6);
        } else if (sim.t - (sim.gustT || -9) > 6) { sim.gustT = sim.t; sim.callT = sim.t - 3; sim.msg('Rook', 'Gusting. Wait for it.', 2.6); }
      } });
    }
    return tr;
  },
  challenge: { id: 'coldbore', text: 'One round fired, and it lands while the helicopter is in the air', test: (sim) => sim.stats.shots === 1 && sim.did('lifting') && (sim.did('obj:tail') ? sim.emitted['obj:tail'] > sim.emitted.lifting : sim.emitted['dead:aurel'] > sim.emitted.lifting) },
  outcomes: [
    { id: 'killed', when: (sim) => !sim.alive('aurel'), set: { arrestedAurel: false }, text: 'The round was across the valley before the sound of it. Caspian Aurel never heard a thing. The pilot shut the engine down and sat with his hands on his head until Varga reached him. No trial. No testimony. The books are balanced the way the Ledger taught you to balance them. Harrow Ridge is quiet again.' },
    { id: 'arrested', when: (sim) => sim.did('obj:tail'), set: { arrestedAurel: true }, text: 'The yellow ring came apart and the helicopter sat back down in its own snow. Varga walked Caspian Aurel out of it in handcuffs, past his own towers. He will stand in a courtroom and hear all of it read aloud. The last round you fired at Harrow Ridge hit nothing but metal. The valley is quiet again.' },
  ],
  after: 'It began on this ridge with a shot you would not take. It ends here with one you chose.',
  solve(H, st) {
    const tf = C6.tof(st, 1400);
    return [['until', (s) => s.did('hover'), 60], ['until', (s) => C6.steady(s, tf + 0.4, C6.windTol(st, 1400)) || s.byId.heli.wait < tf + 3.4, 12], ['hold'], ['shootObj', 'tail']];
  },
  testFlags: [{}, { sparedRook: true }],
  reward: { cr: 8000, xp: 1400 },
});
