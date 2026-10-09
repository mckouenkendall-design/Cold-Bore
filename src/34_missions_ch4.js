// ---------------------------------------------------------------------------
// Chapter 4: GLASS TOWERS. Downtown Port Calder at night.
// The Calloways are gone, and the Ledger's targets stop looking like
// criminals. By the end of the chapter Kestrel knows who the client is.
// Helpers in this file are prefixed "c4".
// ---------------------------------------------------------------------------

// Something inside a room has been shot through closed glass: break that pane
// and let the room hear it, exactly as a round aimed at a person would.
function c4Pane(sim, P, x, y) {
  for (let i = 0; i < P.openings.length; i++) {
    const op = P.openings[i];
    if (!op.glass || op.broken || x < op.x || x > op.x + op.w || y < op.y || y > op.y + op.h) continue;
    op.broken = true; sim.stats.glass++;
    sim.ev.push({ k: 'glass', x, y, plane: P, op }); sim.noise(x, y, P, 'glass', 9); sim.emit('glass:' + op.room);
  }
}
// Give someone new orders, but only if they are still calm: a guard who is
// already reaching for his radio must not be talked out of it by a script.
function c4Route(sim, id, routine) { const a = sim.byId[id]; if (a && !a.dead && !a.gone && (a.state === 'calm' || a.state === 'susp')) sim.setRoutine(a, routine); }
// People walking past under the towers. Nobody new wanders in once the job is
// done, so a late arrival cannot stumble into the aftermath.
function c4Walkers(H, o) { const tr = passersBy(H, o), go = tr.do; tr.do = (sim) => { if (!sim.winAt) go(sim); }; return tr; }
// Noise cover for a loud rifle, with enough of it left for the shot to leave the barrel.
function c4Cov(st, lead) { return (s) => st.quiet || (s.covered() && s.coverUntil - s.t > (lead || 0.6) + (st.action === 'charge' ? 0.9 : 0)); }
// A rifle that can be trusted to hit a chest through closed glass first time.
function c4Straight(st) { return st.pen >= 1 || (st.pen >= 0.5 && st.disp <= 0.2); }

// ---------------------------------------------------------------------------
mission({
  id: 'c4m1', ch: 4, title: 'Night Shift', range: 300, needs: { glass: true },
  objective: 'The accountant on the seventh floor: grey waistcoat, glasses. The glass does not open.',
  brief: 'Downtown, Kestrel. The Calloways are finished on the docks and in the hills, but their money still moves, and the man who moves it works late on the seventh floor of the Aurel building. An accountant. The client calls him the Calloways\' inside man. Grey waistcoat, glasses, a green lamp on his desk. His is the lit floor directly under the window cleaners\' cradle. These towers are sealed glass, and glass bends a bullet, so aim for the chest. A colleague goes home soon and a cleaner comes through after. Take him in the gap between them.',
  intel: ['Target: grey waistcoat, glasses, the desk with the GREEN lamp. Seventh floor, just under the cradle.', 'Closed glass knocks a bullet a few centimetres off line. Chest, not head. Armour-piercing rounds fly straight.', 'The bay crossed with yellow tape has no glass in it. He walks past it on his way to the water cooler.', 'A pane you break yourself is just as clear afterwards, but everyone on that floor looks up when it goes.', 'The helicopter covers a loud shot.'],
  wind: { v: 1.4, gust: 0.8 }, par: 2, rules: { kill: ['t'] },
  vantages: [{ name: 'Customs House roof', desc: 'Across the avenue, level with the seventh floor.', eye: [0, 27, 0] }],
  look: [-12, 26.5],
  setup() {
    const H = SCN.towers({ focus: 'office', range: 300, seed: 41, eyeY: 27, cradle: { floor: 8, x: -17.71 },
      A: { lit: { 7: true, 8: false }, wins: { '7,2': { open: true } }, lamps: { '7,4': '#3fae6a' },
        bays: { '7,0': 'shelf-', '7,1': 'cooler-', '7,2': 'none', '7,3': 'plant+', '7,4': 'deskL', '7,5': 'board', '7,6': 'deskL', '5,2': 'deskR', '5,5': 'sofa' } } });
    K.thing(H.S, H.PS, 'duck', 12, 2.9);
    return H;
  },
  cast(H) {
    const A = H.A, at = (f, x, e) => H.office('A', f, x, e), desk = A.winX(4), cool = A.winX(1) + 0.15, lift = -0.3;
    const round = [['walk', cool], ['look', { bag: 'cup' }], ['wait', 7, 'drink'], ['look', { bag: null }], ['walk', desk], ['wait', 13, 'type']];
    return [
      Object.assign(at(7, desk), { id: 't', role: 'target', face: -1, anim: 'type', look: { vest: '#8d949c', glasses: true, hair: 'short', hairCol: '#3a2a20', tie: COL.blue },
        routine: [['face', -1], ['wait', 13, 'type']].concat(round, round, round, [['walk', lift], ['gone']]), escapeText: 'He shut down his desk and took the lift. Whatever he was working on is filed by now.' }),
      Object.assign(at(7, A.winX(6)), { id: 'c1', role: 'civ', face: -1, anim: 'type', look: { coat: COL.navy, hair: 'short', hairCol: '#7a5a3a', tie: COL.red }, routine: [['face', -1], ['wait', 15, 'type'], ['walk', lift], ['gone']] }),
      Object.assign(at(7, lift), { id: 'k1', role: 'civ', hidden: true, look: { hat: 'cap', hatCol: '#3f6fb0', vest: '#3f6fb0', h: 0.96 },
        routine: [['wait', 30], ['show'], ['walk', -5.2], ['wait', 5, 'sweep', -1], ['walk', -13.6], ['wait', 5, 'sweep', -1], ['walk', -19.2], ['wait', 5, 'sweep', -1], ['walk', -24.6], ['wait', 4, 'sweep', -1], ['walk', lift], ['gone']] }),
      Object.assign(at(5, A.winX(2)), { id: 'c2', role: 'civ', face: 1, anim: 'type', look: { hair: 'bun', dress: COL.teal }, routine: [['wait', 999, 'type', 1]] }),
      Object.assign(at(5, -6), { id: 'k2', role: 'civ', look: { hat: 'cap', hatCol: '#3f6fb0', vest: '#3f6fb0', build: 'big' }, routine: [['wait', 6, 'sweep', -1], ['walk', -12], ['wait', 6, 'sweep', -1], ['walk', -22], ['wait', 6, 'sweep', 1], ['walk', -6], ['loop']] }),
      Object.assign(at(10, A.winX(5)), { id: 'c3', role: 'civ', look: { coat: '#2a2f38', hair: 'white', tie: COL.wine }, routine: pace(A.winX(4), A.winX(6) - 0.4, 7, 6, 'phone') }),
      Object.assign(at(0, A.winX(3) + 0.4), { id: 'c4', role: 'civ', face: 1, anim: 'sit', look: { hat: 'peaked', hatCol: '#27365a', coat: '#27365a' }, routine: [['wait', 999, 'sit', 1]] }),
    ];
  },
  vehicles(H) { H._heli = H.heli({ first: 4, period: 34 }); return [H._heli.veh]; },
  triggers(H) { return [
    H._heli.trig,
    c4Walkers(H, { every: 11, first: 3 }),
    hint(1.5, 'These windows do not open. Glass knocks an ordinary bullet a few centimetres off line, so aim for the middle of his chest. Count two rounds: one may be needed for the glass.'),
    say(14, 'Marlow', 'The colleague is leaving. A cleaner starts on that floor in about fifteen seconds. Find the gap.'),
    hint(34, 'The cleaner will see a man fall, and breaking glass makes anyone near it look round. Wait until he has left the floor.'),
  ]; },
  challenge: { id: 'head', text: 'A headshot, with no alarm and nobody the wiser', test: (sim, res) => res.clean && sim.kills.some((k) => k.id === 't' && k.part === 'head') },
  after: 'Clean work. He was the last man who could read the Calloway books. Do not trouble yourself over why his desk was in an Aurel office. Money sits where it likes.',
  solve(H, st) {
    const A = H.A, cool = A.winX(1) + 0.15;
    const alone = (s) => !s.actors.some((a) => a.id !== 't' && !a.dead && !a.gone && !a.hidden && a.room === 'A:f7');
    const atCooler = (s) => { const t = s.byId.t; return t.goal === null && Math.abs(t.x - cool) < 0.2 && t.wait > 1.5 && t.state === 'calm'; };
    if (c4Straight(st)) return [['until', (s) => alone(s) && atCooler(s)], ['shoot', 't', 'torso']];
    // weak or loose rifles: break the pane by the cooler first, under the helicopter, then take him through the hole
    const cov = c4Cov(st);
    return [['until', (s) => cov(s) && s.byId.t.goal === null && s.byId.t.x > -12], ['shootPt', () => ({ x: A.winX(1) - 1.25, y: A.floorY(7) + 2.3, z: A.P.z })],
      ['until', (s) => alone(s) && atCooler(s)], ['shoot', 't', 'torso']];
  },
  reward: { cr: 2600, xp: 600 },
});

// ---------------------------------------------------------------------------
mission({
  id: 'c4m2', ch: 4, title: 'Power Cut', range: 350, needs: { glass: true },
  objective: 'Cut the power to the top lit floor, then find the white-haired man in the dark. No alarm.',
  brief: 'Same building, two floors up. The top lit floor is a records room, and the man who runs it has been copying Calloway files for whoever pays. That is what the client tells me. Tall, thin, white hair. The floor has two cameras and a guard, and if the security desk sees a body the tower locks down, which the client would find inconvenient. So take the lights first. The junction box is on the concrete core, level with his floor. In the dark he walks to the corner window to telephone. You will see the phone.',
  intel: ['Target: tall, thin, WHITE hair. Second desk from the left on the top lit floor.', 'Two ceiling cameras (red lights) and a guard. Any alarm fails the job, even after he is down.', 'Junction box: the grey box with a yellow bolt on the concrete core, beside his floor. It kills the lights and the cameras.', 'In the dark he stands at the far left window with his phone. The analyst who checks her phone stays in her chair.', 'Fire inside the helicopter noise. A night-vision scope makes the dark easy.'],
  wind: { v: -1.8, gust: 1.0 }, par: 3,
  rules: { kill: ['t'], strict: true, aftermath: 4, strictText: 'The alarm went up and the tower locked down, floor by floor. The client will not be pleased, and neither am I.' },
  vantages: [{ name: 'Exchange roof', desc: 'Level with the ninth floor, square on to the glass.', eye: [0, 34, 0] }],
  look: [-14, 33.5],
  setup() {
    const H = SCN.towers({ focus: 'office', range: 350, seed: 44, eyeY: 34, cradle: { floor: 11, x: -6.57 },
      A: { lit: { 9: true, 10: false, 7: false, 5: true, 6: [[0, 2, false], [3, 6, true]], 3: false, 2: true },
        bays: { '9,0': 'plant-', '9,1': 'deskL', '9,2': 'shelf+', '9,3': 'deskR', '9,4': 'shelf-', '9,5': 'deskL', '9,6': 'board' } } });
    const A = H.A, S = H.S, fy = A.floorY(9);
    K.thing(S, H.PA, 'fuse', H.coreX, fy + 1.7, { id: 'fuse', cuts: ['A:f9'], killsCams: true });
    const cam = (id, x, dir) => K.thing(S, H.PA, 'cctv', x, fy + 2.72, { id, zone: 'A:f9', range: 11.5, dir, onHit(sim, ob) { c4Pane(sim, H.PA, ob.x, ob.y); } });
    cam('cam1', A.winX(1) + 1.0, 1); cam('cam2', A.winX(5) - 1.0, -1);
    K.thing(S, H.PF, 'duck', -32.3, 26.15);
    return H;
  },
  cast(H) {
    const A = H.A, at = (f, x, e) => H.office('A', f, x, e);
    return [
      Object.assign(at(9, A.winX(1)), { id: 't', role: 'target', face: -1, anim: 'type', look: { h: 1.09, build: 'thin', hair: 'white', coat: '#39404a' },
        routine: [['face', -1], ['wait', 150, 'type'], ['walk', -0.3], ['gone']], escapeText: 'He left the floor with the lift and the keys to the records room. Whatever was on those shelves stays there.' }),
      Object.assign(at(9, A.winX(3)), { id: 'c1', role: 'civ', face: 1, anim: 'type', look: { hair: 'bun', hairCol: '#3a2a20', dress: COL.teal }, routine: [['face', 1], ['wait', 999, 'type']] }),
      Object.assign(at(9, A.winX(5)), { id: 'c2', role: 'civ', face: -1, anim: 'type', look: { hair: 'short', hairCol: '#2a2019', coat: COL.tan, glasses: true }, routine: [['face', -1], ['wait', 999, 'type']] }),
      Object.assign(at(9, -8), { id: 'g', role: 'guard', face: -1, look: { hat: 'peaked', hatCol: '#27365a', coat: '#27365a', build: 'big' },
        routine: [['walk', -24.6], ['wait', 4, 'guard', 1], ['walk', -3.6], ['wait', 4, 'guard', -1], ['loop']] }),
      Object.assign(at(5, A.winX(4)), { id: 'c3', role: 'civ', face: -1, anim: 'type', look: { hair: 'short', coat: COL.olive }, routine: [['wait', 999, 'type', -1]] }),
      Object.assign(at(6, A.winX(5)), { id: 'c4', role: 'civ', look: { hair: 'long', dress: COL.wine }, routine: pace(A.winX(3) + 0.5, A.winX(6) - 0.5, 8, 6, 'phone') }),
      Object.assign(at(2, -20), { id: 'k1', role: 'civ', look: { hat: 'cap', hatCol: '#3f6fb0', vest: '#3f6fb0' }, routine: [['wait', 6, 'sweep', 1], ['walk', -9], ['wait', 6, 'sweep', 1], ['walk', -20], ['loop']] }),
    ];
  },
  vehicles(H) { H._heli = H.heli({ first: 5, period: 30 }); return [H._heli.veh]; },
  // an alarm is fatal here even in the seconds after he falls: that is what the cameras are for
  onAlarm(sim) { sim.fail('alarm', 'The cameras saw him go down. The tower locked itself, floor by floor, with the client\'s people inside. Lights first, Kestrel.', 1.2); },
  triggers(H) {
    const A = H.A;
    return [
      H._heli.trig,
      c4Walkers(H, { every: 12, first: 2 }),
      hint(1.5, 'Shoot him in the light and the cameras raise the alarm. Shoot the junction box on the concrete core first: the floor goes dark and the cameras die with it.'),
      say(9, 'Marlow', 'The helicopter is your noise. Box first, then the man. He will not stay at the window for long.'),
      onEv('obj:fuse', (sim) => {
        sim.msg('Marlow', 'Lights are out. He is going to the corner window to phone it in. Look for the screen.');
        c4Route(sim, 't', [['wait', 1.2, 'stand'], ['walk', A.winX(0)], ['face', -1], ['wait', 15, 'phone'], ['walk', -0.3], ['gone']]);
        c4Route(sim, 'c1', [['face', 1], ['wait', 99, 'sit']]);
        c4Route(sim, 'c2', [['face', -1], ['wait', 2.5, 'sit'], ['wait', 99, 'sitphone']]);
        c4Route(sim, 'g', [['walk', -3.4], ['face', 1], ['wait', 99, 'guard']]);
        ['t', 'c1', 'c2', 'g'].forEach((id) => { const a = sim.byId[id]; if (a && !a.dead) sim.bubble(a, '?', 2); });
      }),
    ];
  },
  challenge: { id: 'walking', text: 'Drop him in the dark while he is still walking to the window', test: (sim) => sim.did('obj:fuse') && sim.kills.some((k) => k.id === 't' && k.moving && k.t > sim.emitted['obj:fuse']) },
  after: 'The tower never noticed. For the record, Kestrel, what was on those shelves is no concern of ours. The client was quite firm about that.',
  solve(H, st) {
    const A = H.A, cov = c4Cov(st, 2.2 + st.cycle), corner = A.winX(0);
    const there = (s) => { const t = s.byId.t; return t.goal === null && Math.abs(t.x - corner) < 0.2 && t.anim === 'phone'; };
    const script = [['until', (s) => cov(s) && s.byId.g.x > -16]];
    // rifles that cannot be trusted through glass open the corner pane before the lights go
    if (!c4Straight(st)) script.push(['shootPt', () => ({ x: corner - 1.2, y: A.floorY(9) + 2.3, z: A.P.z })]);
    return script.concat([['shootObj', 'fuse'], ['until', there], ['wait', 0.5], ['shoot', 't', 'torso']]);
  },
  reward: { cr: 2800, xp: 630 },
});

// ---------------------------------------------------------------------------
mission({
  id: 'c4m3', ch: 4, title: 'The Reception', range: 320,
  objective: 'Find the guest who fits all three clues and take him without the party noticing.',
  brief: 'A party on the roof of the Meridian. Aurel Group is entertaining investors, and somewhere among the glasses is a man selling Calloway shipping routes to the highest bidder. So the client says. I have no photograph, only pieces. A grey suit. White hair. A brown case he will not put down. More than one guest fits two of the three. Later he steps to the right-hand end of the rail to telephone. There are fireworks over the harbour tonight: when they start, every head on that roof turns the same way. Be ready.',
  intel: ['All three must match: GREY suit, WHITE hair, brown CASE in his hand.', 'The host wears a white jacket and a red scarf. The target speaks to him, then goes to the right-hand end of the rail to phone.', 'A man who falls in the light among a dozen guests is seen, unless they are all looking at the sky.', 'Fireworks cover a loud shot. The terrace lamps, and the fuse box by the lift door, can be shot out.'],
  wind: { v: 3.0, gust: 1.3 }, par: 2, rules: { kill: ['t'] },
  vantages: [
    { name: 'Exchange roof', desc: '320 m, square on. The whole terrace in view, and the whole of the wind.', eye: [0, 36, 0], tag: 'See everything' },
    { name: 'Fish market clock', desc: '260 m, from the side and out of the wind. The Aurel tower hides the left half of the terrace: you will not see who he talks to.', eye: [-110, 36, 60], windMul: 0.4, look: [24, 34], tag: 'Easier shot, less to go on' },
  ],
  look: [18, 34],
  setup() {
    const H = SCN.towers({ focus: 'terrace', range: 320, seed: 47, eyeY: 36, cradle: { floor: 5, x: -21.43 }, A: { lit: { 7: false, 4: true, 8: true, 5: false } } });
    K.thing(H.S, H.PB, 'fuse', H.coreB.x + 2.7, H.B.roofY + 1.55, { id: 'tfuse', cuts: ['B:roof'] });
    K.thing(H.S, H.PB, 'duck', H.coreB.x + 0.9, H.coreB.h + 0.75);
    return H;
  },
  cast(H) {
    const grey = '#8d96a1', black = '#1f2630';
    const g = (x, id, look, face, anim, routine) => Object.assign(H.terrace(x), { id, role: 'civ', look, face, anim, rest: [['face', face], ['wait', 999, anim]], routine: routine || [['face', face], ['wait', 999, anim]] });
    const list = [
      Object.assign(H.terrace(23.6), { id: 't', role: 'target', face: 1, look: { coat: grey, hair: 'white', bag: 'case', tie: COL.navy },
        routine: [['wait', 11, 'stand', 1], ['walk', 17.4], ['wait', 11, 'talk', 1], ['walk', 26.4], ['face', 1], ['wait', 48, 'phone'], ['walk', 17.4], ['wait', 8, 'talk', 1], ['walk', 27.9], ['gone']],
        escapeText: 'He finished his call, shook the host by the hand and took the lift down with his case.' }),
      g(18.4, 'host', { coat: '#f6f3ea', hair: 'white', scarf: COL.red }, -1, 'talk'),
      // the three who fit two clues out of three
      g(16.4, 'd1', { coat: grey, hair: 'short', hairCol: '#5a3d24', bag: 'case', glasses: true, tie: COL.wine }, 1, 'stand', [['wait', 5, 'talk', 1], ['walk', 24.2], ['wait', 18, 'stand', 1], ['walk', 14.7], ['face', -1], ['wait', 999, 'stand']]),
      g(15.5, 'd2', { coat: grey, hair: 'white', bag: 'cup', tie: COL.green }, 1, 'drink', [['wait', 13, 'drink', 1], ['walk', 25.4], ['wait', 8, 'smoke', 1], ['walk', 15.5], ['face', 1], ['wait', 999, 'drink']]),
      g(21.7, 'd3', { coat: black, hair: 'white', bag: 'case', tie: COL.red }, -1, 'talk'),
      g(20.75, 'w3', { dress: COL.wine, hair: 'white' }, 1, 'talk'),
      g(12.9, 'w1', { dress: COL.teal, hair: 'bun', hairCol: '#3a2a20', bag: 'cup' }, 1, 'drink'),
      g(13.8, 'm1', { coat: COL.tan, hair: 'short', hairCol: '#2a2019' }, -1, 'talk'),
      g(19.2, 'w2', { dress: COL.pink, hair: 'long', hairCol: '#d9b36a' }, 1, 'talk'),
      g(19.95, 'm2', { coat: COL.navy, glasses: true, bag: 'cup', tie: COL.yellow }, -1, 'drink'),
      g(17.3, 'm3', { coat: black, build: 'big', beard: '#3a2a20', hair: 'short', hairCol: '#3a2a20', h: 1.06 }, 1, 'stand', [['wait', 10, 'stand', 1], ['walk', 14.6], ['face', 1], ['wait', 999, 'stand']]),
      g(10.0, 'bar', { vest: '#1d2026', hair: 'short', hairCol: '#2a2019' }, 1, 'work'),
      g(13.4, 'wtr', { vest: '#1d2026', hair: 'bun', bag: 'paper' }, 1, 'stand', [['walk', 20.9], ['wait', 4, 'stand', -1], ['walk', 13.4], ['wait', 4, 'stand', 1], ['loop']]),
    ];
    list.forEach((a) => { if (a.id === 'wtr') a.rest = a.routine; else if (a.id === 'd1') a.rest = [['walk', 14.7], ['face', -1], ['wait', 999, 'stand']]; else if (a.id === 'd2') a.rest = [['walk', 15.5], ['face', 1], ['wait', 999, 'drink']]; else if (a.id === 'm3') a.rest = [['walk', 14.6], ['face', 1], ['wait', 999, 'stand']]; });
    return list.concat([
      Object.assign(H.office('A', 4, -14), { id: 'k1', role: 'civ', look: { hat: 'cap', hatCol: '#3f6fb0', vest: '#3f6fb0' }, routine: [['wait', 6, 'sweep', 1], ['walk', -6], ['wait', 6, 'sweep', -1], ['walk', -20], ['loop']] }),
    ]);
  },
  triggers(H) {
    const DUR = 22, watch = ['stand', 'stand', 'point', 'stand', 'wave', 'drink'];
    return [
      c4Walkers(H, { every: 12, first: 2 }),
      hint(1.5, 'Three clues: grey suit, white hair, brown case. Check every guest against all three. Several fit two.'),
      say(30, 'Marlow', 'Fireworks in a few seconds. Every head on that roof will turn to the left. His will not: he will be on the telephone.'),
      { at: 42, do(sim) {
        H.fireworks(sim, DUR);
        let n = 0;
        sim.actors.forEach((a) => {
          if (a.zone !== 'B:roof' || a.dead || a.gone) return;
          a.deaf = true;                                          // nobody hears a bullet crack through that
          if (a.id === 't' || !a.rest || a.state !== 'calm') return;
          sim.setRoutine(a, [['wait', DUR + 0.6, watch[(n++) % watch.length], -1]].concat(a.rest));
        });
        sim.after(DUR, () => sim.actors.forEach((a) => { a.deaf = false; }));
      } },
    ];
  },
  challenge: { id: 'early', text: 'Take him before the first firework goes up, and still nobody the wiser', test: (sim, res) => res.clean && sim.kills.some((k) => k.id === 't' && k.t < 42) },
  after: 'Nobody saw a thing until the last rocket came down. The client is pleased. The client, I notice, was also the host. I would not dwell on that.',
  solve(H) {
    return [['until', (s) => { const t = s.byId.t; return !!H.fw && s.t > H.fw.t0 + 1.5 && s.t < H.fw.until - 2 && t.goal === null && Math.abs(t.x - 26.4) < 0.2; }], ['shoot', 't', 'torso']];
  },
  reward: { cr: 3000, xp: 660 },
});

// ---------------------------------------------------------------------------
mission({
  id: 'c4m4', ch: 4, title: 'Scaffold', range: 400,
  objective: 'Corbin Hale: white hard hat, long tan coat. An accident only, and no worker hurt.',
  brief: 'Corbin Hale builds towers. The file says Calloway money poured the foundations of this one, and the file is all I have been given. He also outbid the client for the lot next door, which I am told is beside the point. He walks his site every night: white hard hat, long tan coat. The client wants an accident, and there is a girder hanging from the crane. Hale never stands under it. The night crew go home alive, every one of them. A jackhammer is working, on and off. Use it.',
  intel: ['Hale: WHITE hard hat, long TAN coat, clipboard. The site engineer also has a white hat, but wears an orange vest.', 'Shoot the yellow hook block and the girder takes about two seconds to land. No bullet may touch Hale.', 'He never stops under the load. A tin of rivets stands on the blue drum beneath it: knock it over and he will come to look.', 'A labourer carries boxes under the girder. Wait until he is clear.', 'Wind is about 4 m/s from the left. Fire while the jackhammer is running.'],
  wind: { v: 4.0, gust: 1.5 }, par: 2,
  rules: { kill: ['t'], accidentOnly: true, accidentText: 'A developer with a bullet in him is a murder inquiry, and the client\'s name is on the lot next door. It had to be an accident.' },
  vantages: [{ name: 'Grain elevator', desc: 'High over the avenue, looking down into the yard.', eye: [0, 28, 0] }],
  look: [28, 6],
  setup() {
    const H = SCN.towers({ focus: 'site', range: 400, seed: 52, eyeY: 28, site: { upperLit: true }, A: { lit: { 5: false, 6: true, 9: [[0, 2, true], [3, 6, false]] } } });
    const S = H.S, PC = H.PC;
    K.box(S, PC, 26.0, 0, 0.62, 0.92, '#3f6fb0', { solid: false, band: 0.1 });
    K.thing(S, PC, 'can', 26.31, 1.1, { id: 'tin', r: 0.26, lure: 11, lureY: 0, drawFn(ctx, env, S2, ob) { if (!ob.alive) return; R4(ctx, ob.x - 0.17, ob.y - 0.18, 0.34, 0.36, S.tone('#c9ced3', PC, true)); R4(ctx, ob.x - 0.17, ob.y + 0.06, 0.34, 0.07, S.tone('#c8372d', PC, true)); } });
    K.thing(S, PC, 'duck', H.siteKit.craneX + 6.6, H.siteKit.jibY + 0.47);
    return H;
  },
  cast(H) {
    const K0 = H.siteKit, door = K0.cabX + 1.0, hi = { hat: 'hardhat', hatCol: '#e2b33c', vest: '#e07b2a', vestStripe: '#f1ede2' };
    const crew = 'One of the night crew is down. He had nothing to do with any of this, and the client wanted no questions.';
    const round = [['walk', 33.0], ['wait', 9, 'talk', 1], ['walk', 21.5], ['wait', 7, 'point', 1], ['walk', 33.0], ['wait', 6, 'talk', 1], ['walk', door], ['wait', 6, 'phone', -1]];
    return [
      Object.assign(H.site(door), { id: 't', role: 'target', face: -1, look: { hat: 'hardhat', hatCol: '#ece8dc', coat: COL.tan, long: true, bag: 'clip' },
        routine: [['wait', 4, 'phone', -1]].concat(round, round, [['walk', 14], ['gone']]), escapeText: 'Hale signed off the night shift and drove home. The girder goes up at first light, and the chance goes with it.' }),
      Object.assign(H.site(34.3), { id: 'f1', role: 'civ', failText: crew, face: -1, curious: false, look: { hat: 'hardhat', hatCol: '#ece8dc', vest: '#e07b2a', vestStripe: '#f1ede2', bag: 'clip', build: 'big' }, routine: [['face', -1], ['wait', 999, 'stand']] }),
      Object.assign(H.site(21.3), { id: 'w1', role: 'civ', failText: crew, face: 1, curious: false, look: Object.assign({ bag: 'box' }, hi), routine: [['wait', 3, 'work', 1], ['walk', 29.9], ['wait', 10, 'work', 1], ['walk', 21.3], ['wait', 10, 'work', 1], ['loop', 1]] }),
      Object.assign(H.site(42.6), { id: 'w2', role: 'civ', failText: crew, face: -1, curious: false, deaf: true, look: Object.assign({ phones: '#c8372d' }, hi), routine: [['wait', 999, 'work', -1]] }),
      Object.assign(H.site(33.5, 2), { id: 'w3', role: 'civ', failText: crew, face: 1, curious: false, look: hi, routine: [['wait', 8, 'work', 1], ['walk', 37.5], ['wait', 8, 'work', -1], ['walk', 33.5], ['loop']] }),
      Object.assign(H.site(29.5, 1), { id: 'w4', role: 'civ', failText: crew, face: -1, curious: false, look: Object.assign({ h: 0.95 }, hi), routine: [['wait', 999, 'work', -1]] }),
      Object.assign(H.office('A', 6, -8), { id: 'k1', role: 'civ', look: { hat: 'cap', hatCol: '#3f6fb0', vest: '#3f6fb0' }, routine: [['wait', 6, 'sweep', -1], ['walk', -12], ['wait', 6, 'sweep', 1], ['walk', -4], ['loop']] }),
    ];
  },
  triggers(H) { return [
    { at: 2, every: 11, do(sim) { sim.cover(8.5, 'jackhammer'); } },
    c4Walkers(H, { every: 13, first: 4, x1: 14 }),
    hint(1.5, 'It has to be an accident, and he never stands under the girder. Something that falls over with a clatter down there would be worth a look. Then the yellow hook.'),
    say(22, 'Marlow', 'The labourer with the boxes goes home tonight. So do the rest. Only Hale.'),
  ]; },
  challenge: { id: 'onefall', text: 'One round only: drop it on him as he walks underneath', test: (sim, res) => res.shots === 1 },
  after: 'A tragic accident, the papers will say, and the lot goes back to auction. I am told there is only one bidder left. That is not our business. I keep telling myself so.',
  solve(H, st) {
    const gx = H.siteKit.gx, charge = st.action === 'charge';
    const cov = (lead) => (s) => st.quiet || (s.covered() && s.coverUntil - s.t > lead);
    const still = (a, x, w) => a.goal === null && Math.abs(a.x - x) < 0.3 && a.wait > w && a.state === 'calm';
    // the labourer stays put for long enough that the whole business is over before he moves
    const lure = (s) => cov(7.4)(s) && still(s.byId.t, 33.0, 0.5) && still(s.byId.w1, 29.9, 4.6);
    const drop = (s) => { const t = s.byId.t, w = s.byId.w1; return cov(charge ? 1.3 : 0.5)(s) && t.goal === null && Math.abs(t.x - gx) < 2.5 && t.wait > (charge ? 3.0 : 2.6) && w.goal === null && Math.abs(w.x - gx) > 3.4; };
    return [['until', lure], ['shootObj', 'tin'], ['until', drop, 30], ['shootObj', 'hook'], ['wait', 3]];
  },
  reward: { cr: 3100, xp: 690 },
});

// ---------------------------------------------------------------------------
mission({
  id: 'c4m5', ch: 4, title: 'The Journalist', range: 380,
  objective: 'Marlow wants the reporter at the fourth-floor window dead. Read her wall, then decide.',
  brief: 'Nadia Brandt writes for the Calder Post. She has a story ready for tomorrow\'s edition, and the client says it is Calloway lies from the first line to the last. Fourth floor of the brick block, the big window, at her desk. She works with the window open. One shot, Kestrel, and do not waste time reading the wall behind her. If you see a man on the fire escape, he is nothing to do with you. That is everything you need. I would take it as a kindness if you did not ask me for more.',
  intel: ['Brandt: dark hair, glasses, green cardigan, typing at the big fourth-floor window. It is open: no glass.', 'The fire escape runs up past her other window.', 'Zoom in on what is pinned to her wall before you decide anything.', 'Her neighbours are at home. They are not part of this.'],
  wind: { v: 2.2, gust: 1.0 }, par: 1,
  rules: { kill: [], aftermath: 4.5, done: (sim) => sim.did('dead:brandt') || sim.did('dead:mask') || sim.did('gone:mask') },
  vantages: [
    { name: 'Cold store roof', desc: '380 m, square on. You see her window and the whole fire escape, from the pavement up.', eye: [0, 26, 0], windMul: 1.2, tag: 'See him coming' },
    { name: 'Signal gantry', desc: '295 m, low and sheltered. A gasworks sign hides the fire escape below her floor: anyone climbing it appears at her window with no warning.', eye: [-22, 15, 85], windMul: 0.5, tag: 'Easier shot, late warning' },
  ],
  look: [-36.5, 14.6],
  setup() {
    const dark = { lit: false };
    const H = SCN.towers({ focus: 'flat', range: 380, seed: 55, eyeY: 26, F: { brandt: { floor: 4, col: 2 }, spans: { 4: [[2, 3, 'brandt', true]] },
      wins: { '4,2': { open: true, door: true, w: 3.3, h: 2.35, sill: 0.4, blind: 0 }, '4,3': { open: true, door: true, sill: 0.1, h: 2.3, blind: 0 }, '3,1': { lit: true, blind: 0 }, '2,0': { lit: true, blind: 0 }, '5,0': { lit: true, blind: 0 },
        '1,3': dark, '2,3': dark, '3,3': dark, '5,3': dark, '3,2': dark, '5,2': dark, '4,1': dark, '4,0': dark, '4,4': dark } } });
    // seen from the signal gantry, this sign stands in front of the lower fire escape
    const PM = H.S.plane(232, 'gasworks');
    K.billboard(H.S, PM, -29.3, 6.4, 6.0, 7.5, 'CALDER|GAS', { base: -6, col: '#243040', textCol: '#ffb347' });
    K.thing(H.S, H.PF, 'duck', -13.05, 2.72);
    return H;
  },
  cast(H) {
    const F = H.F, fx = F.winX(3), xa = fx - 1.2, xb = fx + 1.2;
    // the stairs rise from the left end of each landing to the right end of the one above
    const stair = (f) => ['call', (sim, a) => { a.yFn = (x) => F.floorY(f) + clamp((x - xa) / (xb - xa), 0, 1) * F.fh; }];
    const landing = (f) => ['call', (sim, a) => { a.yFn = null; a.y = F.floorY(f); }];
    const climb = (f) => [['walk', xa], stair(f), ['speed', 0.75], ['walk', xb], ['speed', 1], landing(f + 1)];
    return [
      Object.assign(H.flat(4, 2, 0.8), { id: 'brandt', role: 'target', face: -1, anim: 'type', look: { hair: 'long', hairCol: '#2a2019', glasses: true, coat: '#3f7a6a' }, routine: [['face', -1], ['wait', 999, 'type']] }),
      // A professional: noise does not rattle him. If he is only winged he gives up and gets out of sight
      // (round the corner from the pavement, through the nearest window from the stairs), unless he
      // already has the pistol up, in which case he fires first.
      Object.assign(H.near(-25.5), { id: 'mask', role: 'hostile', state: 'alert', calmOnAlarm: true, hidden: true, look: { coat: '#15171b', long: true, hat: 'beanie', hatCol: '#15171b', mask: '#2a2e36' }, flee: [['run', -26.4], ['gone']],
        routine: [['wait', 13], ['show'], ['emit', 'mask_seen'], ['walk', fx + 0.9], ['wait', 1.6, 'stand', -1], ['to', H.escape(1, 0.9)], ['call', (sim, a) => { a.flee = [['wait', 0.7, 'cower'], ['gone']]; }], ['wait', 0.5, 'stand']]
          .concat(climb(1), climb(2), climb(3), [['emit', 'mask_top'], ['walk', fx + 0.45], ['wait', 2.4, 'stand', -1], ['threat', 'brandt', 7]]) }),
      Object.assign(H.flat(3, 1), { id: 'n1', role: 'civ', face: 1, look: { hair: 'white', coat: COL.wine, bag: 'cup' }, routine: [['wait', 999, 'drink', 1]] }),
      Object.assign(H.flat(2, 0), { id: 'n2', role: 'civ', look: { hair: 'short', coat: COL.olive }, routine: pace(F.winX(0) - 0.5, F.winX(0) + 0.5, 7, 6, 'phone') }),
      Object.assign(H.flat(5, 0), { id: 'n3', role: 'civ', face: 1, look: { hair: 'bun', dress: COL.navy, bag: 'cup' }, routine: [['wait', 999, 'drink', 1]] }),
      Object.assign(H.office('A', 5, -12), { id: 'k1', role: 'civ', look: { hat: 'cap', hatCol: '#3f6fb0', vest: '#3f6fb0' }, routine: [['wait', 6, 'sweep', -1], ['walk', -20], ['wait', 6, 'sweep', 1], ['walk', -12], ['loop']] }),
    ];
  },
  triggers(H) {
    const F = H.F;
    return [
      c4Walkers(H, { every: 12, first: 2 }),
      say(2, 'Marlow', 'Fourth floor, the big window. She is at her desk. One round, Kestrel.'),
      hint(7, 'This one is your decision. Zoom in on the wall behind her desk before you fire at anyone.'),
      onEv('mask_seen', (sim) => sim.msg('Marlow', 'The man by the fire escape is not your concern. Call him insurance. The client likes to be sure.'), 1.2),
      onEv('mask_top', (sim) => { if (sim.alive('brandt') && sim.alive('mask')) sim.msg('hint', 'He is at her window with a pistol. Her, him, or neither: what you do in the next few seconds is the choice.', 8); }),
      onEv('dead:mask', (sim) => {
        if (!sim.alive('brandt')) return;
        sim.msg('Marlow', 'Kestrel. That was the client\'s own man. Do you understand what you have just done?');
        const b = sim.byId.brandt;
        if (b.state !== 'calm' && b.state !== 'susp') return;
        sim.setRoutine(b, [['wait', 0.9, 'stand', 1], ['walk', F.winX(3) - 0.45], ['wait', 1.7, 'stand', 1], ['walk', F.winX(2) - 2.6], ['gone']]);
        b.state = 'alert';                                       // she has seen enough: a bang in the distance will not send her under the desk now
        sim.bubble(b, '!', 2);
      }),
      onEv('gone:mask', (sim) => { if (sim.alive('brandt') && sim.alive('mask')) sim.msg('Marlow', 'You have frightened off the client\'s own man, Kestrel. I hope you know what that makes you.'); }),
      onEv('dead:brandt', (sim) => {
        if (sim.did('executed:brandt')) { sim.msg('Marlow', 'It is done, then. Not by you. I will remember that.'); return; }
        const m = sim.byId.mask;
        if (m.dead) { sim.msg('Marlow', 'Both of them. I do not know what you think you are doing, Kestrel, but the contract is complete.'); return; }
        sim.msg('Marlow', 'Contract complete. The other gentleman can go home.');
        if (!m.gone) { m.threat = null; sim.setRoutine(m, [['wait', 99, 'stand', -1]], true); }
      }),
    ];
  },
  challenge: { id: 'early', text: 'Make your choice before he reaches her landing', test: (sim) => sim.kills.some((k) => (k.id === 'mask' || k.id === 'brandt') && k.how === 'shot' && (!sim.did('mask_top') || k.t < sim.emitted.mask_top)) },
  outcomes: [
    { id: 'saved', when: (sim) => !sim.byId.brandt.dead, set: { savedBrandt: true },
      text: 'Nadia Brandt is alive. She saw who had come up her fire escape, took the box from under her desk and went straight to Detective Varga. The wall behind her said AUREL and HARROW RIDGE. The Ledger never balanced anybody\'s books. It keeps them for Caspian Aurel.' },
    { id: 'waited', when: (sim) => sim.did('executed:brandt') && sim.stats.shots === 0, set: { savedBrandt: false },
      text: 'You held your fire and Aurel\'s man did the work for you. Marlow calls it a duplicate booking. The wall behind the desk said AUREL and HARROW RIDGE, and by morning it will be bare plaster. You know who the Ledger works for now, and you watched.' },
    { id: 'toolate', when: (sim) => sim.did('executed:brandt'), set: { savedBrandt: false },
      text: 'You fired, and it was not enough. Aurel\'s man still put one round through her window, and Nadia Brandt never finished the page. The wall behind her desk said AUREL and HARROW RIDGE. You know who the Ledger works for now. So does Marlow know which side you tried to take.' },
    { id: 'obeyed', when: () => true, set: { savedBrandt: false },
      text: 'Contract complete, says Marlow. The client had sent a man of its own up the fire escape to make sure. The wall behind her desk said AUREL and HARROW RIDGE. You read it and you fired anyway. The Ledger does not balance books. It keeps them for Caspian Aurel.' },
  ],
  after: 'AUREL, on a reporter\'s wall, in red ink. Marlow has stopped answering the radio. Pip has not: "Come by the workshop, Kestrel. There is a roof I think you ought to see."',
  solve: [['until', (s) => !!s.byId.mask.threat], ['wait', 0.8], ['shoot', 'mask', 'torso']],
  reward: { cr: 3200, xp: 720 },
});

// ---------------------------------------------------------------------------
mission({
  id: 'c4m6', ch: 4, title: 'Proof of Concept', range: 450,
  objective: 'Valve, breaker, capacitors, in that order. Nobody dies.',
  brief: 'Kestrel, I can see where you have set up, and it is not a contract. Whatever Okoro has told you about that roof, the people on it are clients showing a product to buyers. That is all. The Ledger removes criminals. It always has. You know that better than anyone. Pack the rifle, go home, and tomorrow there is work for you, good work, as if tonight never happened. Nobody up there needs to die. On that, at least, we agree. Fire one round at that roof and I can no longer protect you.',
  intel: ['Pip: "Wreck the rig and hurt nobody. Three things, and the order matters."', '1. The red VALVE wheel on the pipe. Steam for about fifteen seconds: loud, and nobody sees through it. Not while the guard is standing beside it.', '2. The BREAKER box with the yellow bolt. A camera on the stair hut watches it, so only while the steam is up. The roof goes dark.', '3. The CAPACITOR bank, glowing blue. Only once the power is off. Live, it arcs, and they will know.', 'Their test shots crack like thunder. Put your first round inside one.'],
  wind: { v: 3.0, gust: 1.4 }, par: 3,
  rules: { destroy: ['valve', 'breaker', 'caps'], noKills: true, strict: true, time: 80, aftermath: 3.4,
    timeText: 'The demonstration ran to the end and the buyers signed. Aurel has its rifle, and a factory to follow.',
    strictText: 'The alarm went up and the roof filled with guards. The rig was carried downstairs in one piece.',
    noKillsText: 'Nobody on that roof was meant to die. Pip wanted a broken machine, not a body for Aurel to show the newspapers.' },
  vantages: [{ name: 'Harbour crane', desc: 'The driver\'s cab, a little above the roof of the Aurel tower.', eye: [0, 47, 0] }],
  look: [-14, 45],
  setup() {
    const H = SCN.towers({ focus: 'roof', range: 450, seed: 58, eyeY: 47, demo: true, cradle: { floor: 6, x: -6.57 }, A: { lit: { 5: false, 7: true, 3: false, 10: false, 11: true } } });
    const D = H.demo;
    D.cam.onHit = () => { D.camShot = true; };
    D.valve.onHit = (sim) => {
      sim.actors.forEach((a) => {
        if (a.zone !== 'A:roof' || a.dead) return;
        if (a.role === 'guard' && Math.abs(a.x - D.valveX) < 3.5) sim.startle(a, 'impact');      // he was standing right beside it
        a.deaf = true;                                                                           // escaping steam is very loud
      });
      sim.after(16, () => sim.actors.forEach((a) => { a.deaf = false; }));
      sim.msg('Pip', 'Steam. You have about fifteen seconds. Breaker box next, the yellow bolt.');
    };
    D.fuse.onHit = (sim) => {
      if (!sim.steam.some((s) => s.until > sim.t) && !D.camShot) { sim.fail('order', 'The camera on the stair hut watched the breaker box die, and security was on the roof before the lights had finished flickering. Steam first, then the box.'); return; }
      D.caps.live = false;
      sim.msg('Pip', 'Dark and dead. Now the capacitor bank. It cannot bite any more.');
      c4Route(sim, 'g1', [['walk', -6.6], ['face', -1], ['wait', 99, 'guard']]);
      sim.actors.forEach((a) => { if (a.zone === 'A:roof' && !a.dead) sim.bubble(a, '?', 2.2); });
    };
    D.caps.onHit = (sim, ob) => {
      if (ob.live) { sim.fail('order', 'The capacitor bank was still live. It went off like a flashbulb and every guard on the roof looked straight down your barrel. Power off first.'); return; }
      sim.msg('Pip', 'That is their whole evening in pieces. Going in for the rifle now.');
    };
    K.thing(H.S, H.PCR, 'duck', H.cradleKit.x + 0.9, H.cradleKit.y + 0.3);
    return H;
  },
  cast(H) {
    const r = (x, e) => H.roof('A', x, e), lab = { coat: '#ece8dc', long: true, hat: 'hardhat', hatCol: '#ece8dc' };
    return [
      Object.assign(r(-25.4), { id: 'e1', role: 'civ', face: 1, look: lab, routine: [['wait', 999, 'work', 1]] }),
      Object.assign(r(-23.4), { id: 'e2', role: 'civ', face: -1, look: Object.assign({ bag: 'clip', glasses: true }, lab), routine: [['wait', 999, 'stand', -1]] }),
      Object.assign(r(-21.9), { id: 'pres', role: 'civ', face: 1, look: { coat: '#1f2630', long: true, hair: 'white', tie: COL.sky }, routine: [['wait', 999, 'talk', 1]] }),
      Object.assign(r(-17.3), { id: 'b1', role: 'civ', face: -1, look: { coat: COL.navy, hair: 'short', bag: 'case' }, routine: [['wait', 999, 'stand', -1]] }),
      Object.assign(r(-13.7), { id: 'b2', role: 'civ', face: -1, look: { dress: COL.wine, hair: 'bun', bag: 'cup' }, routine: [['wait', 999, 'drink', -1]] }),
      Object.assign(r(-12.6), { id: 'b3', role: 'civ', face: -1, look: { coat: COL.olive, hat: 'fedora', hatCol: '#2a2d33', build: 'big' }, routine: [['wait', 999, 'arms', -1]] }),
      Object.assign(r(-5.6), { id: 'g1', role: 'guard', face: -1, look: { hat: 'cap', hatCol: '#1d2026', coat: '#1d2026', build: 'big' }, routine: [['wait', 6, 'guard', -1], ['walk', -16.3], ['wait', 6, 'guard', -1], ['walk', -5.6], ['loop']] }),
      Object.assign(r(-3.3), { id: 'g2', role: 'guard', face: -1, look: { hat: 'cap', hatCol: '#1d2026', coat: '#1d2026' }, routine: [['wait', 999, 'arms', -1]] }),
      Object.assign(H.office('A', 7, -14), { id: 'k1', role: 'civ', look: { hat: 'cap', hatCol: '#3f6fb0', vest: '#3f6fb0' }, routine: [['wait', 6, 'sweep', 1], ['walk', -6], ['wait', 6, 'sweep', -1], ['walk', -20], ['loop']] }),
    ];
  },
  triggers(H) {
    const D = H.demo;
    return [
      { at: 5, every: 9, do(sim) { if (!D.caps.alive || !D.fuse.alive) return; D.fireT = sim.t; sim.cover(2.6, 'thunder'); sim.coverName = 'test shot'; } },
      say(1.5, 'Marlow', 'Stand down, Kestrel. I will not ask twice.'),
      say(6.5, 'Pip', 'Ignore her. Hear that crack? That is their rifle, and it is louder than yours. Valve, then breaker, then capacitors.'),
      hint(11, 'Order matters. The red valve first, while the patrolling guard is well away from it and a test shot covers the noise. Then the breaker box inside the steam. The blue capacitor bank last.', 12),
      say(42, 'Pip', 'Half your time is gone. The guard walks past that valve like clockwork. Go when he is at either end.'),
    ];
  },
  challenge: { id: 'fast', text: 'Finish with at least 50 seconds still on the clock', test: (sim, res) => res.time <= 30 + 3.4 },
  after: 'Pip: "While every eye on that roof was watering, I walked out of the service lift with a long case and a clipboard. Nobody stops a clipboard. The Stormglass prototype is in your locker, Kestrel. It is yours now. Marlow knows it was us. Good."',
  solve(H, st) {
    const D = H.demo, cov = c4Cov(st, 0.45);
    // the patrolling guard is well clear of the valve and either standing there for a while yet or walking away from it
    const clear = (s) => { const g = s.byId.g1, d = Math.abs(g.x - D.valveX); return d > 4.3 && (g.goal === null ? g.wait > 1.7 : (g.goal - g.x) * (g.x - D.valveX) > 0); };
    return [['until', (s) => cov(s) && clear(s)], ['shootObj', 'valve'], ['shootObj', 'breaker'], ['shootObj', 'caps']];
  },
  reward: { cr: 3500, xp: 760 },
});

// ---------------------------------------------------------------------------
mission({
  id: 'c4m7', ch: 4, title: 'Burned', range: 350, needs: { glass: true },
  objective: 'Keep Pip alive from her workshop door to her pickup. Six gunmen, one after another.',
  brief: 'This is the last time I will brief you, Kestrel, so I will be plain. You fired on a client. The Ledger cannot carry that, and it cannot carry Okoro either. A team is already outside her workshop. I am telling you because you were the best I ever ran, and because it changes nothing. You are three hundred and fifty metres away and they are standing at her door. Six men. I chose them myself. If you want to spend your last night on a gunsmith, I will not stop you. I am only telling you the odds.',
  intel: ['Pip has to reach her red pickup at the right-hand end of the near pavement. If she falls, it is over.', 'The gunmen show themselves one at a time, then two together. Each needs a few seconds to aim: watch for the raised pistol.', 'Pip calls out where they are. One is behind closed glass: aim for the chest.', 'Car alarms are sounding all along the street. They cover every shot.', 'Reload in the quiet moments.'],
  wind: { v: -2.0, gust: 1.2 }, par: 7,
  rules: { kill: ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'], protect: ['pip'], until: 'pip_safe' },
  vantages: [{ name: 'Customs House roof', desc: 'The whole street below you, from the brick block to the building site.', eye: [0, 30, 0] }],
  look: [-30, 3],
  testFlags: [{}, { savedBrandt: true }],
  setup() {
    const dark = { lit: false, blind: 0 };
    const H = SCN.towers({ focus: 'near', range: 350, seed: 61, weather: 'rain', eyeY: 30, cradle: { floor: 9, x: -21.43 }, cars: [['van', -6, -1, '#c9ced3'], ['sedan', -35, 1, '#3a3f49']],
      A: { lit: { 2: true, 3: false, 5: false, 7: false, 9: true }, bays: { '2,2': 'deskL', '2,3': 'none', '2,4': 'shelf+', '2,6': 'plant+' } },
      F: { shop: { lit: true }, wins: { '2,1': { lit: true, blind: 0 }, '1,3': dark, '2,3': dark, '3,3': dark, '1,2': dark, '1,4': dark } } });
    K.thing(H.S, H.PC, 'duck', H.siteKit.cabX + 4.9, 3.0);
    return H;
  },
  cast(H) {
    const A = H.A, F = H.F, door = F.x + F.w - 1.35;
    const team = { coat: '#15171b', hat: 'beanie', hatCol: '#15171b', mask: '#2a2e36' };
    const gm = (place, id, cue, toX, secs, look) => Object.assign(place, { id, role: 'hostile', state: 'alert', calmOnAlarm: true, hidden: true, look: Object.assign({}, team, look || {}),
      routine: [['waitFor', cue], ['show'], ['walk', toX], ['threat', 'pip', secs]] });
    const duck = (cue, id) => [['emit', cue], ['wait', 0.3, 'cower', 1], ['waitFor', 'dead:' + id]];
    return [
      Object.assign(H.near(door), { id: 'pip', role: 'vip', state: 'alert', hidden: true, face: 1, look: { hair: 'bun', hairCol: '#2a2019', coat: '#c98a2b', glasses: true, bag: 'guitar', bagCol: '#20242c', h: 0.96 },
        failText: 'That was Pip. She was the only one left on your side.', lostText: 'They got to Pip before you got to them. The workshop is dark and the channel is silent.',
        routine: [['wait', 6.5], ['show']].concat(duck('cue1', 'g1'), [['run', -14.3]], duck('cue2', 'g2'), [['run', -0.9]], duck('cue3', 'g3'), [['run', 7.9]], duck('cue4', 'g4'),
          [['emit', 'lull'], ['wait', 8, 'kneel', 1], ['run', 20.5]], duck('cue5', 'g5'), [['waitFor', 'dead:g6'], ['run', 28.5], ['emit', 'pip_in'], ['veh', 'pipcar', 0]]) }),
      gm(H.escape(2, 1.2), 'g1', 'cue1', F.winX(3) - 0.5, 9),
      gm(H.office('A', 2, A.winX(3) + 1.3), 'g2', 'cue2', A.winX(3), 10, { build: 'big' }),
      gm(H.terrace(11.9), 'g3', 'cue3', 13.6, 10),
      gm(H.road(-4.6), 'g4', 'cue4', -1.7, 9, { long: true }),
      gm(H.site(30.0), 'g5', 'cue5', 24.6, 11),
      gm(H.site(31.2), 'g6', 'cue5', 26.5, 11, { build: 'big' }),
      // people caught in the middle of it
      Object.assign(H.road(0.5), { id: 'by1', role: 'civ', state: 'panic', face: -1, anim: 'cower', look: { coat: COL.tan, hair: 'short', bag: 'shopping' }, routine: [['wait', 999, 'cower']] }),
      Object.assign(H.office('A', 2, A.winX(6)), { id: 'cl', role: 'civ', state: 'panic', anim: 'cower', look: { hat: 'cap', hatCol: '#3f6fb0', vest: '#3f6fb0' }, routine: [['wait', 999, 'cower']] }),
      Object.assign(H.flat(2, 1), { id: 'n1', role: 'civ', face: 1, look: { hair: 'white', coat: COL.wine }, routine: [['wait', 999, 'phone', 1]] }),
      Object.assign(H.office('A', 9, -12), { id: 'k1', role: 'civ', look: { coat: COL.navy, hair: 'short' }, routine: pace(-18, -8, 7, 6, 'phone') }),
    ];
  },
  vehicles(H) {
    return [{ id: 'pipcar', kind: 'pickup', plane: H.PF, x: 30, y: 0, dir: 1, col: '#9a3a2a', seats: [], routine: [['waitFor', 'pip_in'], ['wait', 1.0], ['emit', 'pip_safe'], ['drive', 120, 13], ['gone']] }];
  },
  triggers(H) {
    const pip = (cue, text) => onEv(cue, (sim) => sim.msg('Pip', text));
    return [
      say(1.2, 'Marlow', 'Kestrel. I wanted you to hear the end of it from me.'),
      { at: 4.2, every: 9, do(sim) { if (!sim.did('pip_safe')) sim.cover(10, 'car alarm'); } },
      say(4.4, 'Pip', 'Kestrel? They are out front. I have set off every car alarm on the street, so nobody will hear you. I am coming out.'),
      pip('cue1', 'Fire escape! Right above my door!'),
      pip('cue2', 'The Aurel tower, second floor, behind the glass!'),
      pip('cue3', 'Up on the hotel roof, by the bar!'),
      pip('cue4', 'Behind the white van! Mind the man on the ground, he is nobody.'),
      onEv('lull', (sim) => { sim.msg('Marlow', 'Four of mine, Kestrel. I trained you too well. This is the last time you will hear my voice. Whoever comes for you next will not telephone first.', 8); sim.msg('hint', 'A quiet moment. Reload.', 6); }),
      pip('cue5', 'Two more, at the building site, right under the crane!'),
      pip('pip_in', 'I am in. The long case is on the seat beside me. Go.'),
    ];
  },
  challenge: { id: 'girder', text: 'One hook, two men: finish the last pair with the girder', test: (sim) => sim.kills.filter((k) => (k.id === 'g5' || k.id === 'g6') && k.accident).length === 2 },
  after: (flags) => 'Marlow kept her word: the line is dead and the Ledger wants you the same way. Pip is driving, the Stormglass is in the back, and the people who used to pay you are hunting you. ' + (flags.savedBrandt ? 'Brandt\'s story runs in the morning. Detective Varga will have read it by noon.' : 'Nobody else knows the truth. Not yet.'),
  solve() {
    const up = (id) => (s) => { const a = s.byId[id]; return !a.hidden && !!a.threat; };
    const one = (id) => [['until', up(id)], ['shoot', id, 'torso'], ['shoot', id, 'torso'], ['shoot', id, 'torso']];
    const pair = [['shoot', 'g5', 'torso'], ['shoot', 'g6', 'torso']];
    return [].concat(one('g1'), one('g2'), one('g3'), one('g4'), [['fn', (s) => { s.reload(); }], ['until', up('g5')]], pair, pair, pair);
  },
  reward: { cr: 4000, xp: 800 },
});

// ---------------------------------------------------------------------------
// Wrong Way Round. Between The Reception and Scaffold. The second contract that
// needs armour-piercing rounds: the target sits in a car whose glass is armoured
// and whose doors are not, so the shot goes through the rear door, under the
// window he can be seen through.
mission({
  id: 'c4m8', ch: 4, title: 'Wrong Way Round', range: 330, follows: 'c4m3', needs: { pen: 1.4 },
  objective: 'Councillor Rusk, in the back of the long black car. Not the glass. The door.',
  brief: 'Councillor Edwin Rusk chairs the harbour board. The client says he signed every Calloway import licence for ten years. The board also votes on the Aurel bid for the port next week, which I am told is a coincidence. Rusk has had threats, so he had his car armoured, and the man who did it worked the wrong way round: glass that would stop a train, and doors you could open with a tin opener. Tonight he has come to the Aurel building to say no in person, and he will not get out. They have to come down to him. Not through the window, Kestrel. Through the door.',
  intel: ['Fit ARMOUR-PIERCING rounds. The doors are thin steel, but ordinary rounds still stop in them.', 'The windows are armoured glass. Nothing you own goes through it, and a round on the glass tells him everything.',
    'Rusk sits in the BACK, behind his driver: white hair, glasses, reading under a little lamp. His chest is just below the window, behind the door.', 'A man from Aurel comes down to talk at the car. He stands at the kerb, close enough to see it happen. Wait until he goes back in.', 'Range 330 m. Wind about 2 m/s from the left.'],
  guide: ['Fit armour-piercing rounds in the Ammunition slot before you start.', 'Watch the long black car pull up outside the Aurel doors. Rusk is in the back seat.', 'Wait for the Aurel man at the kerb to finish talking and go back inside.',
    'Do not shoot the glass. Aim at the rear door, a hand below the window and straight under his head.', 'Fire one round while the car stands still. He leaves in under a minute.'],
  wind: { v: 2, gust: 0.8 }, par: 1, rules: { kill: ['t'] },
  sight: { kerb: ['veh:car'] },
  vantages: [{ name: 'Customs House roof', desc: 'Across the avenue, looking down on the kerb outside the Aurel doors.', eye: [0, 22, 0] }],
  look: [-12, 1.5],
  setup() {
    // the kerb on his side of the street has been cleared for him; the only parked cars are well up to the left
    const H = SCN.towers({ focus: 'road', range: 330, seed: 64, eyeY: 22, cars: [['sedan', -41, 1, '#3a3f49'], ['van', -52, -1, '#c9ced3']],
      A: { lit: { 1: true, 2: false, 6: true, 9: [[0, 2, true], [3, 6, false]] } } });
    H.S.litZones['veh:car'] = true;   // he reads under a lamp in the back, so he can be seen
    H.armour = K.armourGlass(H.S, H.PR, 'car', 'limo', { lamp: 0, onHit(sim) {
      const t = sim.byId.t; if (!t || t.dead || sim.winAt) return;
      sim.msg('Marlow', 'The glass held, and he heard it. That car is leaving.');
      sim.startle(t, 'impact');
    } });
    K.thing(H.S, H.PS, 'duck', 10.2, 2.86);   // on the roof of the bus shelter
    return H;
  },
  start(sim, H) { H.armour.follow(sim); },
  tick(sim, H) { H.armour.follow(sim); },
  cast(H) {
    return [
      { id: 'drv', role: 'civ', look: { hat: 'peaked', hatCol: '#1d2026', coat: '#1d2026' }, failText: 'That was his driver. He drove the car; he did not sign anything. The contract is void.' },
      { id: 't', role: 'target', look: { hair: 'white', glasses: true, coat: '#3a3f49', tie: COL.wine, bag: 'paper' },
        escapeText: 'The car pulled away from the kerb with Rusk still reading in the back. The board meets next week with its chairman.' },
      Object.assign(H.street(-9.5, { zone: 'kerb' }), { id: 'aide', role: 'civ', hidden: true, face: -1, look: { coat: '#8d96a1', hair: 'short', hairCol: '#2a2019', bag: 'case', tie: COL.navy },
        failText: 'You shot the man from Aurel. He was the client\'s own lawyer. The contract is void, and so is a good deal else.',
        routine: [['wait', 13.5], ['show'], ['walk', -18.6], ['wait', 16, 'talk', -1], ['walk', -9.5], ['hide'], ['wait', 999]] }),
      Object.assign(H.street(-6.6, { zone: 'doors' }), { id: 'door', role: 'guard', face: -1, anim: 'arms', look: { hat: 'peaked', hatCol: '#27365a', coat: '#27365a', build: 'big' }, routine: [['wait', 999, 'arms', -1]] }),
    ];
  },
  vehicles(H) {
    return [{ id: 'car', kind: 'limo', plane: H.PR, x: 95, y: 0, dir: -1, col: '#111317', seats: ['drv', null, 't'],
      routine: [['wait', 1.5], ['drive', -20, 9], ['emit', 'parked'], ['wait', 46], ['emit', 'leaving'], ['drive', -150, 9], ['gone']] }];
  },
  triggers(H) {
    return [
      c4Walkers(H, { every: 12, first: 3 }),
      hint(1.5, 'The long black car coming from the right is his. Its glass stops anything you own, and a round on the glass warns him. The doors are thin steel: put armour-piercing rounds through the rear door, just below the window, under his head.', 13),
      onEv('parked', (sim) => sim.msg('Marlow', 'He is parked. The Aurel man will be down to talk to him in a moment. He stands close enough to see.')),
      onEv('leaving', (sim) => { if (sim.alive('t')) sim.msg('Marlow', 'He has said his no. The car is pulling out.'); }),
      { when: (sim) => { const a = sim.byId.aide; return a.hidden && sim.t > 20; }, do(sim) { if (sim.alive('t')) sim.msg('Marlow', 'The Aurel man has gone back inside. It is just Rusk and his driver now.'); } },
    ];
  },
  challenge: { id: 'rolling', text: 'Take him before the car has stopped at the kerb', test: (sim) => sim.kills.some((k) => k.id === 't' && k.how === 'shot' && k.moving) },
  after: 'A councillor dead in his own armoured car. The papers will call it a Calloway grudge, and the harbour board will vote on the Aurel bid without him. The flowers from Aurel reached his house before the police did. I am told that is efficiency.',
  solve() {
    return [['until', (s) => { const a = s.byId.aide, v = s.byId.car; return a.hidden && s.t > 20 && v.goal === null && !v.gone && s.alive('t'); }, 90], ['hold'], ['shoot', 't', 'torso'], ['shoot', 't', 'torso']];   // the second shot only if the first misses
  },
  reward: { cr: 2900, xp: 650 },
});
