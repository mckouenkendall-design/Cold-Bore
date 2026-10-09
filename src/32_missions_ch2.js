// ---------------------------------------------------------------------------
// Chapter 2: HARBOUR LIGHTS. The Port Calder docks.
// Maeve Calloway's smuggling business, a dock worker called Tomas Reyes, and
// the first time the wind matters.
// ---------------------------------------------------------------------------

// Tomas Reyes looks the same every time you see him.
const REYES_LOOK = { hat: 'hardhat', hatCol: '#e2b33c', vest: '#e07b2a', vestStripe: '#f1ede2', beard: '#3a2a20' };

// Test-bot helpers. Could anyone who is calm see this person fall right now?
function dkSeen(sim, id) {
  const v = sim.byId[id]; if (!v) return false;
  return sim.actors.some((o) => o !== v && !o.dead && !o.gone && !o.inVeh && !o.hidden && o.role !== 'hostage' && (o.state === 'calm' || o.state === 'susp') && sim.canSee(o, v.x, v.y, v.zone));
}
// (An eyewitness to the final kill is handled by the engine itself now, so this
// returns no extra triggers. Kept so the mission lists below read the same.)
function dkEyes() { return []; }
// Is a loud shot covered for long enough to get it away? (A quiet rifle never needs it.)
function dkCov(st, lead) {
  const need = lead === undefined ? (st.action === 'charge' ? 1.4 : 0.5) : lead;
  return (s) => st.quiet || (s.covered() && s.coverUntil - s.t > need);
}

mission({
  id: 'c2m1', ch: 2, title: 'Tide Tables', range: 260,
  objective: 'The harbour clerk: WHITE hard hat and a clipboard. Hold into the wind.',
  brief: 'The Calloways\' street money is gone, so the family is leaning on the docks. Maeve Calloway runs them, and she runs them on information. A clerk in the harbour office sells her the customs schedule: which sheds get searched, and when. He walks the quay at dusk in a white hard hat with a clipboard under his arm. Other men wear white hats. Another man carries a clipboard. You want the one with both. One more thing. You are across open water now and the wind off the sea will move your bullet. Read it before you fire.',
  intel: ['Clerk: WHITE hard hat, clipboard, dark blue coat, glasses.', 'The foreman also wears a white hat. The tally man also carries a clipboard. Neither is him.', 'He ends his round alone on the pier, on the telephone.', 'Range about 260 m. Wind 4 m/s, blowing left to right.'],
  wind: { v: 4, gust: 0.7 }, par: 1, rules: { kill: ['t'] },
  vantages: [{ name: 'Fish market roof', desc: 'Across the basin, level with the crane cab. Open to the wind.', eye: [0, 21, 0] }],
  look: [-24, 4],
  setup() { const H = SCN.docks({ z: 255, time: 'dusk', seed: 4 }); K.thing(H.S, H.PQ, 'duck', -6.4, 9.38); return H; },
  cast(H) {
    const vest = { vest: '#e07b2a', vestStripe: '#f1ede2' };
    return [
      Object.assign(H.quay(-30.5), { id: 't', role: 'target', face: 1, look: { hat: 'hardhat', hatCol: '#ece8dc', coat: COL.navy, bag: 'clip', glasses: true }, speed: 1.3,
        routine: [['wait', 4, 'stand', 1], ['walk', -15.6], ['wait', 5, 'talk', 1], ['walk', 2.2], ['wait', 5, 'work', 1], ['walk', 34], ['wait', 12, 'phone', 1], ['walk', 12], ['wait', 4, 'work', -1], ['walk', -68], ['gone']],
        escapeText: 'He finished his round and went home with the schedule in his pocket. Maeve has it by now.' }),
      Object.assign(H.quay(-14), { id: 'c1', role: 'civ', face: -1, look: Object.assign({ hat: 'hardhat', hatCol: '#ece8dc', build: 'big' }, vest), routine: [['wait', 999, 'point', -1]], failText: 'That was the foreman. A white hat, but no clipboard. The contract is void.' }),
      Object.assign(H.quay(-18.5), { id: 'c2', role: 'civ', face: 1, look: Object.assign({ hat: 'hardhat', hatCol: '#e2b33c' }, vest), routine: [['wait', 999, 'work', 1]] }),
      Object.assign(H.quay(7.6), { id: 'c3', role: 'civ', face: -1, look: { hat: 'hardhat', hatCol: '#e2b33c', bag: 'clip', coat: COL.olive }, routine: [['wait', 9, 'work', -1], ['walk', 4.4], ['wait', 7, 'work', -1], ['walk', 7.6], ['loop']], failText: 'That was the tally man. A clipboard, but a yellow hat. The contract is void.' }),
      Object.assign(H.onContainers(8), { id: 'c4', role: 'civ', face: 1, look: { hat: 'hardhat', hatCol: '#e07b2a', vest: '#e2b33c' }, routine: pace(6.2, 10, 4, 4, 'work') }),
      Object.assign(H.quay(-40), { id: 'c5', role: 'civ', face: 1, look: Object.assign({ hat: 'hardhat', hatCol: '#e07b2a', bag: 'box' }, vest), routine: [['walk', -22], ['wait', 5, 'work', 1], ['walk', -40], ['wait', 5, 'work', -1], ['loop']] }),
      Object.assign(H.inOffice(), { id: 'c6', role: 'civ', face: -1, anim: 'type', look: { hair: 'white', glasses: true, coat: COL.brown }, routine: [['wait', 999, 'type', -1]] }),
    ];
  },
  triggers() { return [
    hint(1.5, 'Across open water the wind pushes a bullet sideways. Tonight it blows from left to right: the WIND box, the red pennant and the wind sock on the pier all show it.', 11),
    hint(14, 'Now read the HOLD box. The up arrow is how far the bullet drops. The side arrow is how far to move your aim to beat the wind. It points left, so aim that far to the LEFT of him: into the wind.', 13),
    hint(29, 'A hold of 0.5 is small: about half the width of his head. Put the crosshair just off his left side, the side the wind comes from, and let the wind carry the bullet onto him.', 13),
    say(44, 'Marlow', 'He makes his call from the pier, well away from the others. Nobody out there to see him fall.'),
  ].concat(dkEyes(['t'])); },
  challenge: { id: 'head', text: 'A headshot through the crosswind', test: (sim) => sim.kills.some((k) => k.id === 't' && k.part === 'head') },
  after: 'The schedule stops reaching Maeve tonight, and she will know why by morning. That was clean shooting across a wind. You will need more of it.',
  solve: [['until', (s) => s.byId.t.anim === 'phone' && s.byId.t.goal === null && s.byId.t.x > 30], ['wait', 1.2], ['shoot', 't', 'torso']],
  reward: { cr: 1100, xp: 260 },
});

mission({
  id: 'c2m2', ch: 2, title: 'Dead Weight', range: 240,
  objective: 'Two smugglers under the crane. One hook could take both. Spare the docker.',
  brief: 'Maeve\'s people are checking a shipment under the quay crane tonight. Two of them: a tall man in a flat cap and a heavy man in a red beanie. Every half minute the freighter behind them tests her horn. They cannot hear each other over it, so they meet under the hanging cargo net and compare lists until it stops. That is your moment twice over. The horn hides a shot, and a net full of engine parts hides the cause. A docker keeps wandering under the net to check the slings. He has done nothing. A guard walks the quay. Him I leave to you.',
  intel: ['Smugglers: FLAT CAP with a long grey coat, and RED BEANIE, heavy build.', 'Shoot the yellow hook block above the net. The net takes about a second to fall.', 'The horn sounds for six seconds, every half minute. A loud shot is safe inside it.', 'The docker in the orange vest is innocent. If he is under the net, wait.', 'Two separate shots also work, if neither man sees the other fall.'],
  wind: { v: -2.4, gust: 1.0 }, par: 2, rules: { kill: ['t1', 't2'] },
  vantages: [{ name: 'Ice house roof', desc: 'Across the basin, looking slightly down on the crane.', eye: [0, 20, 0] }],
  look: [4, 5],
  setup() {
    const H = SCN.docks({ z: 235, time: 'night', seed: 7, crane: { x: -8, reach: 12, load: 'net', hookY: 9.6 }, lamps: [-31, -10, 9.5], lampReach: 9.5, stacks: [[-26.4, 2], [-20.1, 1], [6.4, 2], [12.7, 3]] });
    H.hook.prop.w = 3.4;                                  // a wide net: two men fit under it, just
    K.box(H.S, H.PQ, 1.7, 0, 1.3, 0.9, '#8a6a45', { solid: false }); K.box(H.S, H.PQ, 5.1, 0, 1.5, 1.1, '#7b5a36', { solid: false }); K.box(H.S, H.PQ, 5.3, 1.1, 1.1, 0.7, '#9a7a52', { solid: false });
    K.box(H.S, H.PQ, -3.9, 0, 1.4, 1.0, '#7b5a36', { solid: false }); K.box(H.S, H.PQ, 13.6, 0, 1.6, 1.2, '#8a6a45', { solid: false });
    K.thing(H.S, H.PQ, 'duck', H.end + 3.0, 3.62);
    return H;
  },
  cast(H) {
    const cyc = (w, a, b, f) => { const r = []; for (let i = 0; i < 3; i++) r.push(['wait', w, 'work', -f], ['walk', b], ['wait', 6.8, 'talk', f], ['walk', a]); r.push(['wait', 4, 'work', -f], ['walk', -68], ['gone']); return r; };
    return [
      Object.assign(H.quay(-3), { id: 't1', role: 'target', face: -1, look: { hat: 'cap', hatCol: '#2a2d33', coat: COL.grey, long: true, h: 1.05, build: 'thin' }, routine: cyc(13.82, -3, 3.0, 1), escapeText: 'They finished the count and the shipment went out on the tide.' }),
      Object.assign(H.quay(13), { id: 't2', role: 'target', face: 1, look: { hat: 'beanie', hatCol: COL.red, coat: '#3a2f2a', build: 'big' }, routine: cyc(12.13, 13, 4.6, -1), escapeText: 'They finished the count and the shipment went out on the tide.' }),
      Object.assign(H.quay(8.6), { id: 'c1', role: 'civ', face: -1, look: { hat: 'hardhat', hatCol: '#e2b33c', vest: '#e07b2a', vestStripe: '#f1ede2' }, failText: 'The docker was under the net too. He was only checking the slings.',
        routine: [['wait', 10, 'work', -1], ['walk', 5.7], ['wait', 10, 'work', -1], ['walk', 8.6], ['wait', 33.4, 'work', -1], ['loop']] }),
      Object.assign(H.quay(18), { id: 'g', role: 'guard', face: -1, look: { hat: 'peaked', hatCol: '#27365a', coat: '#27365a', gun: 'rifle' }, routine: [['walk', -26], ['wait', 5, 'guard', 1], ['walk', 18], ['wait', 5, 'guard', -1], ['loop']] }),
      Object.assign(H.onContainers(15), { id: 'c2', role: 'civ', face: -1, look: { hat: 'hardhat', hatCol: '#e07b2a', coat: COL.olive }, routine: pace(13.4, 17.6, 5, 5, 'work') }),
      Object.assign(H.onShip(-14), { id: 'c3', role: 'civ', face: 1, curious: false, look: { hat: 'beanie', hatCol: '#27365a', coat: '#39404a' }, routine: [['wait', 999, 'smoke', 1]] }),
    ];
  },
  triggers(H) { return [
    { at: 16.5, every: 30, do(sim) { H.horn(sim, 6); } },
    hint(1.5, 'The ship\'s horn hides a loud shot, the way thunder did. The net takes a second to fall, so fire early in the horn, while both men are standing under it and nobody else is.', 11),
    { at: 27, do(sim) { if (sim.alive('t1') && sim.alive('t2') && sim.alarmT === null) sim.msg('Marlow', 'The docker was in there with them. Let it go. The horn comes round again.'); } },
    { at: 76, do(sim) { if (sim.alive('t1') && sim.alive('t2') && sim.alarmT === null) sim.msg('Marlow', 'They are nearly done. This is the last time they meet.'); } },
  ].concat(dkEyes(['t1', 't2'])); },
  challenge: { id: 'onehook', text: 'One shot: both smugglers under the net, and nobody else', test: (sim) => sim.stats.shots === 1 && sim.kills.length === 2 && sim.kills.every((k) => k.accident) },
  after: 'A snapped hook and a net of engine parts. The harbour board will blame the crane. Maeve will not, but she cannot prove a thing.',
  solve(H, st) {
    const need = 1.5 + (235 / st.v0) * 1.25 + (st.action === 'charge' ? 0.9 : 0), cov = dkCov(st);
    const under = (a) => a.goal === null && Math.abs(a.x - 4) < 1.9 && a.wait > need;
    const clear = (a) => a.dead || a.gone || Math.abs(a.x - 4) > 2.3 + (a.goal !== null ? 1.4 * need : 0);
    return [['until', (s) => under(s.byId.t1) && under(s.byId.t2) && clear(s.byId.c1) && clear(s.byId.g) && cov(s)], ['shootObj', 'hook']];
  },
  reward: { cr: 1250, xp: 280 },
});

mission({
  id: 'c2m3', ch: 2, title: 'Fog Signal', range: 220,
  objective: 'Drop both gunmen on the pier. Do not hit the docker.',
  brief: 'A different kind of job this morning. Maeve\'s people caught a docker named Tomas Reyes looking in the wrong crate. Two of them are walking him out along the pier to shoot him where the tide will tidy up. The client would rather he lived: a witness against the Calloways is worth more than a body. So for once you are saving someone. Drop both gunmen before the one in the flat cap finishes his count. There is fog on the water, and a ship somewhere in it sounding her horn. Use both. Do not hit Reyes.',
  intel: ['Reyes: YELLOW hard hat, orange vest. He walks in front. He must live.', 'Flat cap and long coat: he does the shooting. Red beanie: he keeps watch behind, and glances back now and then.', 'In this fog nobody sees further than a dozen metres.', 'The ship\'s horn sounds every fourteen seconds and covers a loud shot.', 'An old man is fishing from a skiff by the pier. Leave him be.'],
  wind: { v: -2, gust: 0.8 }, par: 2, rules: { kill: ['g1', 'g2'], protect: ['reyes'] },
  vantages: [{ name: 'Net loft window', desc: 'Across the basin, above the fog on the water.', eye: [0, 19, 0] }],
  look: [20, 3],
  setup() {
    const H = SCN.docks({ z: 215, time: 'dawn', weather: 'fog', fog: 5, seeMul: 0.5, glow: true, seed: 9, pier: 34, pierLamps: [34], bounds: { x0: -52, x1: 62, y0: -7, y1: 30 }, skiff: { x: 26.5 }, anchored: false,
      pal: { skyTop: '#7d8b9c', skyBot: '#e6d2c0', fog: '#cfc8c2' } });
    K.thing(H.S, H.PQ, 'duck', 10, 5.84);
    return H;
  },
  cast(H) {
    const rush = [['threat', 'reyes', 3]];
    return [
      Object.assign(H.pier(18), { id: 'reyes', role: 'hostage', face: 1, look: Object.assign({}, REYES_LOOK), routine: [['walk', 52], ['wait', 1.6, 'hands', -1], ['wait', 999, 'kneel', 1]],
        failText: 'You hit Tomas Reyes. He was the one you were sent to save.', lostText: 'They shot Tomas Reyes on the end of the pier. You were there to stop that.' }),
      Object.assign(H.pier(15.8), { id: 'g1', role: 'target', face: 1, look: { hat: 'cap', hatCol: '#2a2d33', coat: '#39404a', long: true }, flee: rush,
        routine: [['walk', 49.8], ['say', 'On your knees.', 2.2], ['wait', 2.5, 'point', 1], ['emit', 'count'], ['threat', 'reyes', 13]] }),
      Object.assign(H.pier(11), { id: 'g2', role: 'target', face: 1, look: { hat: 'beanie', hatCol: COL.red, coat: '#3a2f2a', build: 'big', gun: 'rifle' }, flee: rush,
        routine: [['walk', 40], ['wait', 9, 'guard', -1], ['wait', 3, 'guard', 1], ['loop', 1]] }),
      Object.assign({}, H.skiff, { id: 'c1', role: 'civ', face: 1, anim: 'sit', look: { hat: 'sun', hatCol: '#7a6a4a', coat: COL.olive, beard: '#d9d9d2' }, flee: [['wait', 999, 'cower']], routine: [['wait', 999, 'sit', 1]] }),
      Object.assign(H.quay(-20), { id: 'c2', role: 'civ', face: 1, look: { hat: 'hardhat', hatCol: '#e07b2a', vest: '#e2b33c', bag: 'box' }, routine: [['walk', -6], ['wait', 6, 'work', 1], ['walk', -30], ['wait', 6, 'work', -1], ['loop']] }),
    ];
  },
  // show the gunman's count where a mission clock would be
  tick(sim) {
    let t = null;
    ['g1', 'g2'].forEach((id) => { const a = sim.byId[id]; if (a && !a.dead && a.threat) t = t === null ? a.threat.t : Math.min(t, a.threat.t); });
    sim.clock = t === null ? null : () => fmtTime(Math.ceil(t));
  },
  triggers(H) { return [
    { at: 6, every: 14, do(sim) { sim.cover(4.5, 'ship horn'); } },
    say(2, 'Marlow', 'Three men on the pier. Reyes is the one in front, yellow hat. The other two are yours.'),
    onEv('count', (sim) => { sim.msg('Marlow', 'He is giving him a count. You have until the end of it.'); sim.msg('hint', 'The clock at the top is the gunman\'s count. At zero he fires. If either gunman is startled he will not wait for it.', 9); }),
    { when: (sim) => sim.byId.g1.dead && sim.byId.g2.dead, do(sim) { sim.setRoutine('reyes', [['wait', 1.3, 'stand', -1], ['run', -68], ['gone']]); } },
  ].concat(dkEyes(['g1', 'g2'])); },
  challenge: { id: 'heads', text: 'Both gunmen with headshots', test: (sim) => ['g1', 'g2'].every((id) => sim.kills.some((k) => k.id === id && k.part === 'head')) },
  after: 'The docker is called Tomas Reyes. He ran the length of the pier and did not look back. Remember the name. I have a feeling we will hear it again.',
  solve(H, st) {
    const cov = dkCov(st);
    return [['until', (s) => s.did('count')], ['until', (s) => { const g = s.byId.g2; return cov(s) && g.goal === null && g.face === -1 && g.wait > 5; }, 20], ['shoot', 'g1', 'torso'], ['shoot', 'g2', 'torso']];
  },
  reward: { cr: 1400, xp: 300 },
});

mission({
  id: 'c2m4', ch: 2, title: 'Night Ferry', range: 300,
  objective: 'The smuggler in the stern of the launch. Not the boatman at the wheel.',
  brief: 'Maeve moves her best goods by water, a little at a time. Tonight a launch crosses the basin to the jetty with one of her couriers sitting in the stern. The man at the wheel is hired by the hour and knows nothing: leave him alone. The launch ties up under the jetty lamp for a few seconds, with a guard standing over it, and then it is gone. Out on the dark water nobody will see the courier fall, but you will have to lead a moving boat. Under the lamp he sits still, and the guard sees everything.',
  intel: ['Target: the man in the STERN, brown jacket, black beanie. The boatman wears a yellow oilskin.', 'The launch crosses left to right, then ties up at the jetty for about nine seconds.', 'A moving target: aim ahead of him. The further away, the more lead.', 'With the jetty lamp out, the guard sees no further than four metres.', 'The night ferry sounds her horn once as she clears the breakwater.'],
  wind: { v: 3, gust: 1.2 }, par: 2, rules: { kill: ['t'] },
  sight: { quay: ['veh:launch'] },
  vantages: [
    { name: 'Fish market roof', desc: '295 m. A clear view of the whole basin, the jetty and its lamp. Full crosswind.', eye: [0, 20, 0], tag: 'Harder shot, more options' },
    { name: 'Moored trawler', desc: '185 m. Low on the water, closer and out of most of the wind. A ketch\'s rigging hides the jetty lamp.', eye: [40, 7, 110], windMul: 0.5, look: [-10, -1], tag: 'Easier shot, fewer options' },
  ],
  look: [-20, 0],
  setup() {
    const H = SCN.docks({ z: 295, time: 'night', seed: 12, lamps: [-34, -12, 8], pierLamps: [36], pierReach: 6.5, ketch: { x: 37.6, top: 5.05, w: 1.9, h: 1.7, hull: [-1.2, 9.5] } });
    H.jlamp = H.S.objects.find((ob) => ob.id === 'plamp1');
    H.S.zoneLamps['veh:launch'] = [H.jlamp];              // the launch is only lit while it lies under the jetty lamp
    K.thing(H.S, H.PW, 'duck', 42.5, H.wy + 1.42);
    return H;
  },
  cast(H) {
    return [
      { id: 'bm', role: 'civ', look: { hat: 'cap', hatCol: '#27365a', coat: '#d8b52a' }, failText: 'You shot the boatman. He was hired by the hour and knew nothing.' },
      { id: 't', role: 'target', look: { hat: 'beanie', hatCol: '#16181c', coat: '#6b4a32', bag: 'duffel' }, escapeText: 'The launch slipped back into the dark with the courier aboard.' },
      Object.assign(H.pier(38.4), { id: 'g', role: 'guard', face: -1, anim: 'guard', look: { hat: 'cap', hatCol: '#2a2d33', coat: '#2a333a', build: 'big', gun: 'rifle' }, routine: [['wait', 999, 'guard', -1]] }),
      Object.assign(H.quay(-2), { id: 'c1', role: 'civ', face: 1, look: { hat: 'beanie', hatCol: '#5a4634', coat: COL.olive }, routine: [['wait', 999, 'smoke', 1]] }),
    ];
  },
  vehicles(H) {
    return [
      { id: 'launch', kind: 'launch', plane: H.PL, x: -80, y: H.laneY, dir: 1, col: '#3d4f5c', seats: ['bm', 't'], st: { glass: [true, true], flat: [], moving: false },
        routine: [['wait', 4], ['drive', 33, 4.6], ['emit', 'tied'], ['wait', 9.5], ['emit', 'cast_off'], ['drive', 140, 5.4], ['gone']] },
      { id: 'ferry', kind: 'ferry', plane: H.PCH, x: 300, y: H.wy, dir: -1, col: '#1f3350', seats: [], routine: [['drive', -460, 9], ['gone']] },
    ];
  },
  triggers(H) { return [
    hint(1.5, 'A launch is coming in from the left. To hit someone who is moving, aim ahead of him: the bullet takes time to get there. Or wait for the launch to stop.', 10),
    say(6.5, 'Marlow', 'That is the night ferry out by the lighthouse. She sounds her horn once. It is the only noise you will get.'),
    { at: 9, do(sim) { sim.cover(5.5, 'ship horn'); } },
    onEv('tied', (sim) => { const t = sim.byId.t, g = sim.byId.g; if (t && !t.dead) { t.anim = 'talk'; t.face = 1; } if (g && !g.dead && g.state === 'calm') sim.bubble(g, 'You are late.', 2.4); sim.msg('Marlow', 'Tied up. He will not be there long.'); }),
    onEv('cast_off', (sim) => { const t = sim.byId.t; if (t && !t.dead) t.anim = 'drive'; sim.msg('Marlow', 'Casting off. Lead him or lose him.'); }),
  ].concat(dkEyes(['t'])); },
  challenge: { id: 'moving', text: 'Hit him while the launch is moving', test: (sim) => sim.kills.some((k) => k.id === 't' && k.moving) },
  after: 'The boatman rowed the rest of the way home, I am told. Maeve is short one courier and whatever was in the bag.',
  solve(H, st, flags, sim) {
    if (sim && sim.vi === 1) return [['until', (s) => { const v = s.byId.launch; return v.x > -42 && v.x < -8 && v.v > 4.4; }], ['shoot', 't', 'torso']];
    return [['until', dkCov(st)], ['shootObj', 'plamp1'], ['until', (s) => s.did('tied')], ['wait', 1.4], ['shoot', 't', 'torso']];
  },
  reward: { cr: 1500, xp: 320 },
});

// The three ways c2m5 can go, as test-bot scripts. `solve` plays "spare"
// unless the flags say otherwise; test/eval.js can run any of them by name.
const C2M5_PATHS = {
  // the gunman, while he is still following and nobody is placed to see him drop
  spare: () => [['until', (s) => { const g = s.byId.gun, r = s.byId.reyes; return s.t > 20 && !g.hidden && g.goal !== null && !r.dead && Math.abs(g.x - r.x) > 4.6 && !dkSeen(s, 'gun'); }, 60], ['shoot', 'gun', 'torso']],
  // Reyes, in a dark stretch between two lamps
  shoot: () => [['until', (s) => { const r = s.byId.reyes; return s.t > 20 && r.goal !== null && !s.S.isLit('quay', r.x) && !s.S.isLit('quay', r.x - 1.7) && !dkSeen(s, 'reyes'); }, 60], ['shoot', 'reyes', 'torso']],
  // hold fire and let the Calloway man do it
  wait: () => [['until', (s) => s.did('executed:reyes'), 90]],
};
mission({
  id: 'c2m5', ch: 2, title: 'The Witness', range: 250,
  objective: 'Tomas Reyes is walking to the dock gate. Your shot, your choice. Never Varga.',
  brief: 'We have a problem, and you made it. On the pier the other morning the man you saved looked up. Tomas Reyes saw your muzzle flash, and he has worked out roughly where it came from. Tonight he is walking to the dock gate to tell Detective Varga, who is waiting for him under the lamp. He does not reach her. Yellow hard hat, orange vest: you know the man. Maeve wants him quiet as badly as we do, so you may have company on the quay. Varga is not to be touched. How it gets done, I leave to you.',
  intel: ['Reyes: YELLOW hard hat, orange vest, beard. Walking from the pier to the gate.', 'Detective Varga waits at the gate under an umbrella. She must not be harmed.', 'A Calloway gunman is on the quay as well: flat cap, long dark coat.', 'The quay lamps leave dark stretches between them. The fuse box on the office wall feeds them all.'],
  wind: { v: 2.6, gust: 1.2 }, par: 1,
  rules: { protect: ['varga'], aftermath: 4, done: (sim) => sim.byId.reyes.dead || sim.byId.gun.dead || sim.did('reyes_safe') },
  vantages: [{ name: 'Ice house roof', desc: 'Across the basin, in the rain. The whole quay from pier to gate.', eye: [0, 20, 0] }],
  look: [20, 3],
  setup() {
    const H = SCN.docks({ z: 245, time: 'night', weather: 'rain', seed: 15, gate: { x: -45 }, lamps: [-13, 11], lampReach: 7, stacks: [[-25.6, 2], [-19.3, 1], [-2.6, 2], [3.7, 3], [12.5, 1]], crane: { x: -9.5, reach: -8 } });
    K.lamp(H.S, H.PQ, -42.4, 5.6, 'quay', { id: 'glamp', reach: 7 });
    H.S.litZones.gate = true;
    K.parked(H.S, H.PQ, 'sedan', -50.6, 1, '#3a3f49', { layer: 0 });
    K.thing(H.S, H.PB, 'duck', -48.4, 5.14);
    return H;
  },
  cast(H) {
    return [
      Object.assign(H.pier(24), { id: 'reyes', role: 'target', face: -1, blind: true, look: Object.assign({}, REYES_LOOK), flee: [['run', -41.5], ['emit', 'reyes_safe'], ['wait', 999, 'talk', -1]],
        routine: [['wait', 2, 'stand', -1], ['walk', 9], ['say', 'I am on my way.', 2.6], ['wait', 4.5, 'phone', -1], ['walk', -41.5], ['emit', 'reyes_safe'], ['wait', 999, 'talk', -1]] }),
      Object.assign(H.pier(23), { id: 'gun', role: 'hostile', face: -1, hidden: true, look: { hat: 'cap', hatCol: '#22252b', coat: '#22262d', long: true, h: 1.04 },
        flee: [['call', (sim, a) => { const r = sim.byId.reyes; a.routine = !a.hidden && r && !r.dead && Math.abs(r.x - a.x) < 14 ? [['threat', 'reyes', 2.5], ['run', 70], ['gone']] : [['run', 70], ['gone']]; a.pc = 0; }]],
        routine: [['wait', 11], ['show'], ['wait', 1.5, 'stand', -1], ['walk', 17.5], ['wait', 2.3, 'stand', -1], ['walk', -60, 1.16], ['gone']] }),
      Object.assign({ plane: H.PQ, x: -45.2, y: 0, zone: 'gate', behind: false, room: null }, { id: 'varga', role: 'vip', face: 1, look: { hair: 'bun', hairCol: '#2a2019', glasses: true, coat: '#3f4652', long: true, bag: 'umbrella', bagCol: '#1d2026' }, flee: [['wait', 999, 'aim', 1]],
        routine: [['wait', 999, 'stand', 1]], failText: 'You shot Detective Varga. The Ledger has cut you loose.' }),
      Object.assign(H.quay(-12), { id: 'c1', role: 'civ', face: 1, look: { hat: 'hardhat', hatCol: '#e07b2a', coat: COL.olive }, routine: [['wait', 999, 'smoke', 1]] }),
      Object.assign(H.onContainers(-1), { id: 'c2', role: 'civ', face: 1, look: { hat: 'hardhat', hatCol: '#e2b33c', coat: COL.navy }, routine: pace(-2, 2.6, 5, 5, 'work'), failText: 'That was not Reyes. A yellow hat, but a blue coat, and nothing to do with any of this.' }),
      Object.assign(H.quay(-8), { id: 'c3', role: 'civ', face: -1, look: { hat: 'hardhat', hatCol: '#e2b33c', vest: '#2f6db5', bag: 'box' }, speed: 1.15, routine: [['walk', -68], ['gone']], failText: 'That was not Reyes. A yellow hat, but a blue vest and no beard.' }),
    ];
  },
  triggers(H) { return [
    say(1.5, 'Marlow', 'Reyes is leaving the pier now. Yellow hat, orange vest. Varga is at the far end, under the gate lamp.'),
    say(13.5, 'Marlow', 'There. Long coat, coming off the pier behind him. One of Maeve\'s. He is here for the same man you are.'),
    say(24, 'Marlow', 'Let him work or do it yourself, I do not mind which. But Reyes does not reach that gate.'),
    // the gunman catches Reyes up in the dark before the gate
    { when: (sim) => { const g = sim.byId.gun, r = sim.byId.reyes; return !g.dead && !g.hidden && !r.dead && g.state === 'calm' && r.state === 'calm' && r.x < -21 && Math.abs(g.x - r.x) < 4.3 && !sim.did('reyes_safe'); },
      do(sim) {
        sim.setRoutine('reyes', [['wait', 0.7, 'stand', 1], ['wait', 999, 'hands', 1]]);
        sim.setRoutine('gun', [['say', 'Reyes!', 1.6], ['wait', 1.3, 'aim', -1], ['emit', 'count'], ['threat', 'reyes', 6], ['wait', 0.8, 'stand', -1], ['run', 70], ['gone']]);
      } },
    onEv('count', (sim) => sim.msg('Marlow', 'He has him. A few seconds and it is done for you.')),
    onEv('dead:gun', (sim) => { const r = sim.byId.reyes; if (r && !r.dead) { sim.setRoutine('reyes', [['wait', 1.1, 'stand', 1], ['run', -41.5], ['emit', 'reyes_safe'], ['wait', 999, 'talk', -1]]); sim.msg('Marlow', 'That was the wrong man, Kestrel.'); } }),
  ].concat(dkEyes(['reyes', 'gun'])); },
  outcomes: [
    { id: 'shot', when: (sim) => sim.kills.some((k) => k.id === 'reyes' && k.how !== 'npc'), set: { sparedReyes: false },
      text: 'Tomas Reyes will not be describing anyone. Detective Varga found him on the quay with nothing left to tell her. Marlow sounded almost warm about it.' },
    { id: 'silenced', when: (sim) => sim.byId.reyes.dead, set: { sparedReyes: false },
      text: 'You held your fire and the Calloway man did the work. Reyes is dead all the same, within sight of the gate. Marlow has decided to call that patience.' },
    { id: 'spared', when: (sim) => !sim.byId.reyes.dead && sim.byId.gun.dead, set: { sparedReyes: true },
      text: 'You shot the wrong man, and you meant to. Reyes reached the gate, and Varga has her witness: a docker who saw a flash on a rooftop and not much else. Marlow has not said a word since.' },
    { id: 'ran', when: (sim) => !sim.byId.reyes.dead, set: { sparedReyes: true },
      text: 'The quay woke up, Reyes ran, and he reached the gate with the Calloway man nowhere to be seen. Varga has her witness. Marlow would like to know what exactly you were aiming at.' },
  ],
  challenge: { id: 'early', text: 'Make your choice before the pistol comes out', test: (sim) => !sim.did('count') && sim.kills.some((k) => (k.id === 'reyes' || k.id === 'gun') && k.how === 'shot') },
  after: 'Whatever you chose, the gate is behind you now. Maeve Calloway is next, and she knows somebody is coming.',
  paths: C2M5_PATHS,
  solve(H, st, flags) { return C2M5_PATHS[(flags && flags.c2m5) || 'spare'](st); },
  reward: { cr: 1600, xp: 340 },
});

mission({
  id: 'c2m6', ch: 2, title: 'Powder Room', range: 280,
  objective: 'Blow the fuel on the supply barge. Nobody is to be hurt. No alarm.',
  brief: 'No bodies tonight. Maeve keeps her boats running from a supply barge moored at the pier: fuel in a white tank and a row of red drums, at the right-hand end. Burn it and her launches stay tied up for a month. The client wants no dead crewmen in the papers, so nobody dies. A guard stands beside the fuel and smokes, which tells you what kind of guard he is. The engineer walks back there now and then. Get them both clear, then put one round in the tank. If the alarm goes up first they will tow the barge away.',
  intel: ['The white tank beside the red drums. One hit sets off the lot.', 'The blast reaches about seven metres each way, on the barge and on the pier above it.', 'Ring the bell on the buoy and anyone in earshot walks over to look. A broken bottle does the same from closer in.', 'The freighter sounds her horn every 25 seconds. A loud rifle should ring the bell inside it.', 'The engineer wears red ear defenders. He will not hear the bell.'],
  wind: { v: 4, gust: 1.3 }, par: 2,
  rules: { destroy: ['fuel'], noKills: true, strict: true, boomQuiet: true,
    strictText: 'The alarm went up. They cut the lines and towed the barge out with the fuel still aboard.', noKillsText: 'Somebody was standing too close. This one was meant to cost Maeve fuel, not men.' },
  vantages: [{ name: 'Fish market roof', desc: 'Across the basin, looking down onto the barge deck.', eye: [0, 22, 0] }],
  look: [30, 1],
  setup() {
    const H = SCN.docks({ z: 275, time: 'night', seed: 18, barge: { x: 10 }, bell: { x: 9.3, lure: 24 }, lamps: [-34, -12, 8], pierLamps: [38], stacks: [[-25.6, 2], [-19.3, 3], [-13, 1], [4.5, 1], [10.8, 2]] });
    const D = H.bargeAt.y, S = H.S, P = H.PL;
    K.lamp(S, P, 27.6, 4.4, 'barge', { y: D, id: 'blamp', reach: 9.5 }); K.lamp(S, P, 15.4, 3.4, 'barge', { y: D, id: 'hlamp', reach: 6, arm: 0.6 });
    K.thing(S, P, 'tank', 34, D + 1.5, { id: 'fuel', blast: 5.5 });
    [31.4, 32.3, 36.6].forEach((bx, i) => K.thing(S, P, 'barrel', bx, D + 0.62, { id: 'drum' + (i + 1) }));
    K.thing(S, P, 'bottle', 23.2, D + 2.1, { id: 'bottle', lure: 11, lureY: D });
    const sign = S.tone('#e9e4d6', P, true), red = S.tone('#c8372d', P, true);
    P.add({ x0: 37, x1: 40, layer: 0, draw(ctx, env) { line(ctx, 38.6, D, 38.6, D + 2.2, S.tone('#2a2e36', P), 0.07, env); R4(ctx, 37.7, D + 1.5, 1.8, 0.8, sign); env.text(ctx, 'NO SMOKING', 38.6, D + 1.78, 0.26, red, 'center'); } });
    K.thing(S, P, 'duck', 12.2, D + 2.96);
    return H;
  },
  cast(H) {
    return [
      Object.assign(H.barge(30.2), { id: 'g', role: 'guard', face: -1, anim: 'smoke', look: { hat: 'beanie', hatCol: '#2a2d33', coat: '#39404a', build: 'big' }, routine: [['wait', 999, 'smoke', -1]] }),
      Object.assign(H.barge(32.6), { id: 'd1', role: 'civ', face: 1, deaf: true, curious: false, failText: 'The engineer was at the fuel when it went up. Nobody was meant to die tonight.', look: { hat: 'hardhat', hatCol: '#d9d2c0', phones: '#c8372d', coat: '#2f5f8a', bag: 'box' },
        routine: [['wait', 12, 'work', 1], ['walk', 14.2], ['wait', 9, 'work', 1], ['walk', 32.6], ['wait', 5, 'work', 1], ['loop', 1]] }),
      Object.assign(H.pier(25.4), { id: 'd2', role: 'civ', face: -1, failText: 'The deckhand on the pier was too close. Nobody was meant to die tonight.', look: { hat: 'cap', hatCol: '#5a4634', coat: COL.olive }, routine: pace(23.6, 25.4, 6, 6, 'work') }),
      Object.assign(H.quay(-6), { id: 'c1', role: 'civ', face: 1, look: { hat: 'hardhat', hatCol: '#e2b33c', vest: '#e07b2a', vestStripe: '#f1ede2' }, routine: [['walk', -20], ['wait', 7, 'work', -1], ['walk', -6], ['wait', 7, 'work', 1], ['loop']] }),
    ];
  },
  triggers(H) { return [
    { at: 8, every: 25, do(sim) { H.horn(sim, 5.5); } },
    hint(1.5, 'Nobody may be hurt. The guard stands beside the fuel, so give him a reason to leave: shoot the bell on the buoy and whoever hears it walks over to look.', 11),
    say(5, 'Marlow', 'The engineer in the red ear defenders hears nothing. He will leave when he is ready, and he will be back. Wait for him.'),
    onEv('obj:fuel', (sim) => sim.msg('Marlow', 'That will be seen from the mountains. Nobody under it. Good.'), 0.6),
  ]; },
  challenge: { id: 'bottle', text: 'Draw the guard off with the bottle, not the bell', test: (sim) => sim.did('obj:bottle') && !sim.did('obj:bell') },
  after: 'Maeve\'s launches are tied up dry and she is out a month of fuel. Not one man hurt. The client sends his compliments, which is rare.',
  solve(H, st) {
    const cov = dkCov(st), away = (a) => a.dead || a.gone || Math.abs(a.x - 34) > 8.6;
    return [['until', (s) => cov(s) && s.byId.g.state === 'calm'], ['shootObj', 'bell'], ['until', (s) => ['g', 'd1', 'd2'].every((id) => away(s.byId[id])) && s.byId.d1.goal !== 32.6, 40], ['shootObj', 'fuel']];
  },
  reward: { cr: 1700, xp: 360 },
});

mission({
  id: 'c2m7', ch: 2, title: 'Maeve', range: 320,
  objective: 'Maeve Calloway: white hair AND a long red coat. Guests and crew are not targets.',
  brief: 'Last one on the water. Maeve Calloway is giving a party aboard her yacht, the Silver Tide, before she sails on the tide. White hair and a long red coat, and she is the only one aboard with both. The saloon is full of guests who have done nothing worse than accept an invitation. Her bodyguards never look away from her while there is light to see by. There is a storm coming in: thunder for your shot, and a hard gusting wind against it. She takes her telephone calls alone on the top deck. Do not let her sail.',
  intel: ['Maeve: WHITE hair and a long RED coat. One guest has white hair. Another wears red. Neither is her.', 'Lightning, then about two and a half seconds of thunder, roughly every ten seconds.', 'Each deck has its own lamp. In the dark a bodyguard sees four metres and no more.', 'The crane is swinging a crate aboard over the aft deck. She will want to look at it.', 'Wind 5 m/s and gusting. Read HOLD just before you fire.'],
  wind: { v: -5, gust: 2.5 }, par: 2, rules: { kill: ['maeve'] },
  vantages: [
    { name: 'Harbour master\'s tower', desc: '320 m. High above the basin with everything in view, and nothing between you and the wind.', eye: [0, 26, 0], tag: 'Harder shot, more options' },
    { name: 'Net loft window', desc: '235 m. Low and sheltered: half the wind. A schooner\'s mast hides the hook of the crane.', eye: [-30, 9, 85], windMul: 0.5, tag: 'Easier shot, fewer options' },
  ],
  look: [14, 3],
  setup() {
    const H = SCN.docks({ z: 315, time: 'night', weather: 'storm', seed: 21, end: -6, pier: 52, bounds: { x0: -48, x1: 56, y0: -7, y1: 30 }, yacht: { x: 4 }, shipX: -86, lamps: [-38, -18], pierLamps: [0], pierReach: 6,
      crane: { x: -11, reach: 17.5, load: false }, stacks: [[-26.4, 2], [-20.1, 3]], ketch: { x: 1.25, top: 9.15, w: 1.9, h: 1.7, off: -0.7, hull: [-12, 1.6] }, mastX: -38, sock: false, shed: false });
    const S = H.S, P = H.PL, Y = H.yacht;
    H.hook = K.hookLight(S, K.hang(S, P, 6.5, 9.4, 'crate', { id: 'hook', top: H.crane.tipY, floor: Y.deckY, col: '#8f7a55' }));
    const ink = S.tone('#20242b', P);
    P.add({ x0: -4, x1: 16, layer: 2, draw(ctx, env) { const p = H.hook.prop; env.text(ctx, 'AUREL', p.x, p.y + 0.62, 0.5, ink, 'center'); } });
    K.lamp(S, P, 9.2, 2.5, 'aft', { y: Y.deckY, id: 'aftlamp', reach: 7, arm: 0.5 });
    K.lamp(S, P, 22.2, 2.15, 'sun', { y: Y.sunY, id: 'sunlamp', reach: 9, arm: -0.7 });
    K.thing(S, P, 'duck', 25.2, Y.sunY + 2.97);
    return H;
  },
  cast(H) {
    const Y = H.yacht, s0 = Y.stairs[0], s1 = Y.stairs[1];
    const up = (x) => Y.deckY + clamp((x - s0) / (s1 - s0), 0, 1) * (Y.sunY - Y.deckY);
    return [
      // (she leaves her glass in the saloon when she goes out on deck, and picks one up again when she comes back in)
      Object.assign(H.saloon(21), { id: 'maeve', role: 'target', face: 1, anim: 'drink', look: { hair: 'white', coat: COL.red, long: true, h: 0.97, bag: 'cup' },
        routine: [['wait', 5, 'drink', 1], ['walk', 17.6], ['wait', 5, 'talk', -1], ['walk', 16.3], ['look', { bag: null }], ['to', H.deck(14.6)], ['walk', 6.0], ['emit', 'at_crate'], ['wait', 7, 'point', -1],
          ['walk', s0], ['call', (sim, a) => { a.yFn = up; }], ['walk', s1], ['call', (sim, a) => { a.yFn = null; sim.place(a, H.sun(s1)); }], ['walk', 20.4], ['emit', 'on_call'], ['wait', 17, 'phone', 1],
          ['walk', s1], ['call', (sim, a) => { sim.place(a, H.deck(s1)); a.yFn = up; }], ['walk', s0], ['call', (sim, a) => { a.yFn = null; }], ['walk', 14.6], ['to', H.saloon(16.3)], ['look', { bag: 'cup' }], ['walk', 21], ['wait', 9, 'drink', 1], ['emit', 'sailing'], ['hide'], ['gone']],
        escapeText: 'She went below and the Silver Tide sailed on the tide, with Maeve Calloway aboard.' }),
      Object.assign(H.sun(15.5), { id: 'g1', role: 'guard', face: 1, anim: 'guard', look: { coat: '#1d2026', build: 'big', glasses: 'shades', h: 1.05, gun: 'rifle' }, routine: [['wait', 999, 'guard', 1]] }),
      Object.assign(H.deck(11), { id: 'g2', role: 'guard', face: -1, anim: 'arms', look: { coat: '#1d2026', hat: 'cap', hatCol: '#1d2026' }, routine: [['wait', 999, 'arms', -1]] }),
      Object.assign(H.deck(9.8), { id: 'dk', role: 'civ', face: -1, look: { hat: 'cap', hatCol: '#e9e6dd', coat: '#27365a' }, failText: 'The deckhand was under the crate with her. He only works there.',
        routine: [['wait', 4, 'work', -1], ['walk', 7.4], ['wait', 17.3, 'work', -1], ['walk', 9.8], ['wait', 999, 'stand', -1]] }),
      Object.assign(H.saloon(24.6), { id: 'c1', role: 'civ', face: -1, anim: 'drink', look: { hair: 'white', dress: COL.navy, bag: 'cup' }, routine: pace(23.6, 25.4, 6, 7, 'drink'), failText: 'White hair, but a blue dress. That was a guest, not Maeve Calloway.' }),
      Object.assign(H.saloon(19.6), { id: 'c2', role: 'civ', face: 1, anim: 'talk', look: { hair: 'bun', hairCol: '#2a2019', dress: COL.red }, routine: [['wait', 999, 'talk', 1]], failText: 'A red dress, but dark hair. That was a guest, not Maeve Calloway.' }),
      Object.assign(H.saloon(22.4), { id: 'c3', role: 'civ', face: -1, anim: 'drink', look: { hair: 'white', beard: '#e8e8e2', coat: '#22252b', tie: COL.wine, bag: 'cup' }, routine: [['wait', 999, 'drink', -1]] }),
      Object.assign(H.saloon(17.2), { id: 'c4', role: 'civ', face: 1, look: { hair: 'short', coat: '#ece8dc', bag: 'cup' }, routine: pace(17.0, 25.8, 5, 5, 'stand'), speed: 0.8 }),
      Object.assign(H.pier(-1.5), { id: 'c5', role: 'civ', face: 1, look: { hat: 'peaked', hatCol: '#27365a', coat: '#27365a' }, routine: [['wait', 999, 'stand', 1]] }),
      Object.assign(H.fore(33), { id: 'c6', role: 'civ', face: 1, look: { hat: 'cap', hatCol: '#e9e6dd', coat: '#27365a' }, routine: pace(30, 36, 6, 6, 'work') }),
    ];
  },
  triggers(H) { return [
    { at: 2.5, every: 10.5, do(sim) { sim.cover(2.7, 'thunder'); } },
    say(2, 'Marlow', 'She is in the saloon, behind glass and among her guests. Not there. Wait for her to come out.'),
    onEv('at_crate', (sim) => sim.msg('Marlow', 'The crate with the name on it is not our business, Kestrel. Eyes on the woman.'), 1.2),
    onEv('on_call', (sim) => sim.msg('Marlow', 'Top deck, on the telephone. Her man is watching her from the head of the steps.')),
    onEv('sailing', (sim) => sim.msg('Marlow', 'They are singling up the lines.')),
  ].concat(dkEyes(['maeve'])); },
  challenge: { id: 'crate', text: 'Let the crate do it: no bullet in her and no alarm', test: (sim, res) => res.clean && sim.kills.some((k) => k.id === 'maeve' && k.accident) },
  after: 'Maeve Calloway is gone, and old August has run for his lodge in the Ashlocks. Who is Aurel? I could not tell you, Kestrel. Pack for the cold.',
  solve(H, st) {
    const cov = dkCov(st);
    return [['until', (s) => s.t > 20 && cov(s)], ['shootObj', 'sunlamp'], ['until', (s) => s.did('on_call')], ['wait', 1.3], ['shoot', 'maeve', 'torso']];
  },
  reward: { cr: 2000, xp: 400 },
});
