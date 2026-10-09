// ---------------------------------------------------------------------------
// Chapter 5: DEAD LETTERS. The rail yard, the estate and the river bridge.
// Kestrel and Pip (and Detective Varga, if she has any reason to trust you)
// against Aurel and what is left of the Ledger.
//
// Story switches read here: sparedReyes (c2m5) and savedBrandt (c4m5).
// If either is true Varga is helping: fewer guards, and tips from her on the
// radio. If both are false she is hunting Kestrel too, and her police are
// extra people in the scene who must not be hit.
// ---------------------------------------------------------------------------
function vargaHelps(f) { return !!(f && (f.sparedReyes || f.savedBrandt)); }
const CH5_FLAGS = [{}, { sparedReyes: true }, { savedBrandt: true }, { sparedReyes: true, savedBrandt: true }];
const POLICE = { hat: 'peaked', hatCol: '#27365a', coat: '#27365a' };
const POLICE_FAIL = 'You shot a police officer. Detective Varga will never stop looking for you now.';

mission({
  id: 'c5m1', ch: 5, title: 'Dead Drop', range: 450,
  objective: 'The fixer in the pale coat. After the clerk has gone, and with nobody the wiser.',
  brief: 'Kestrel, it is Pip. Marlow has stopped answering, so you get the armourer, and I talk more. Tonight an Aurel fixer meets a frightened records clerk in Calder Yard, to buy back the papers the clerk copied. The fixer wears a pale raincoat and a flat cap. Take him after they part, once the clerk has gone round the lamp hut and cannot see. The clerk has to walk out of that yard believing it was nothing to do with him. Trains on the near line will hide them from you. Trains on the far line only make noise, bless them.',
  intel(f) {
    return ['Fixer: PALE long raincoat, grey flat cap. He arrives by car from the right.', 'The clerk must not see him fall. Wait until the clerk is past the lamp hut.',
      'A train on the NEAR line blocks your view and your bullet. A train on the FAR line is only noise cover.', 'Range about 450 m. A light wind from the left.',
      vargaHelps(f) ? 'Detective Varga is listening in. She will call it when the clerk is clear.' : 'His minder waits by the car with his back turned. A railway constable walks the far siding: leave him be.'];
  },
  wind: { v: 2.4, gust: 1.2 }, par: 1,
  rules: { kill: ['fixer'], until: 'clerk_safe', strict: true, aftermath: 2.4, strictText: 'The clerk heard it, saw it and ran. He will tell Aurel there is a rifle on the grain elevator, and he will never talk to us.' },
  vantages: [{ name: 'Grain elevator', desc: 'High over the yard, 450 m out. Trains on the near line still get in the way.', eye: [0, 30, 0] }],
  look: [9, 5],
  testFlags: CH5_FLAGS,
  setup() {
    const H = SCN.yard({ z: 450, time: 'dusk', seed: 5 });
    K.thing(H.S, H.PW, 'duck', H.tank.x - 3.5, H.tank.rim + 0.3);
    // The timetable is the puzzle. The first near-line train hides the handover
    // and its noise dies away just as the clerk leaves: a quiet gap, with the
    // fixer standing in plain view. Then the far-line train arrives (noise, and
    // nothing in the way), and then a second near-line train shuts the view.
    H.n1 = H.train({ id: 'n1', track: 'near', at: 9, dir: 1, speed: 14, col: '#3d5a80', seed: 0 });
    H.f1 = H.train({ id: 'f1', track: 'far', at: 33, dir: -1, speed: 12, col: '#7a3a2e', seed: 1 });
    H.n2 = H.train({ id: 'n2', track: 'near', at: 40.5, dir: 1, speed: 14, col: '#3f5a48', seed: 2 });
    return H;
  },
  cast(H, f) {
    const help = vargaHelps(f);
    const yardman = { hat: 'hardhat', hatCol: '#e2b33c', vest: '#e07b2a', vestStripe: '#f1ede2' };
    const c = [
      { id: 'drv', role: 'guard', look: { hat: 'cap', hatCol: '#1d2026' } },
      { id: 'fixer', role: 'target', look: { coat: '#e3dcc6', long: true, hat: 'cap', hatCol: '#8a8f96', build: 'big' }, escapeText: 'The fixer drove out of the yard with the papers on the seat beside him.',
        routine: [['walk', 5.4], ['emit', 'meet'], ['wait', 10, 'talk', -1], ['look', { bag: 'case', bagCol: '#7b5a36' }], ['wait', 1.5, 'stand', -1], ['wait', 18.5, 'phone', -1], ['emit', 'leaving'], ['walk', 16.2], ['emit', 'fixer_in'], ['veh', 'car', 1]] },
      Object.assign(H.strip(3.2), { id: 'clerk', role: 'civ', face: 1, look: { build: 'thin', glasses: true, coat: COL.brown, hair: 'short', hairCol: '#3a2a20', bag: 'case', bagCol: '#7b5a36' }, failText: 'You shot the clerk. He was the only one who knew where the copies are.',
        routine: [['waitFor', 'meet'], ['wait', 10, 'talk', 1], ['look', { bag: 'paper' }], ['emit', 'deal'], ['wait', 1.2, 'stand', 1], ['speed', 1.45], ['walk', -5.6], ['to', H.strip(-5.6, { zone: 'west' })], ['emit', 'clerk_hid'], ['walk', -30], ['emit', 'clerk_safe'], ['walk', -84], ['gone']] }),
      Object.assign(H.inBox(-1.5), { id: 'sigman', role: 'civ', face: -1, anim: 'work', look: { hat: 'peaked', hatCol: '#3a3f47', coat: '#3a3f47' }, routine: pace(H.box.x + 2, H.box.x + 6, 5, 6, 'work') }),
      Object.assign(H.siding(-24), { id: 'w1', role: 'civ', look: yardman, routine: pace(-36, -22, 6, 7, 'work') }),
      Object.assign(H.strip(-33), { id: 'w2', role: 'civ', face: -1, anim: 'work', look: Object.assign({ build: 'big' }, yardman), routine: [['wait', 999, 'work', -1]] }),
    ];
    if (!help) {
      c.push({ id: 'bg', role: 'guard', look: { hat: 'beanie', coat: '#22262d', build: 'big', gun: 'rifle' }, routine: [['wait', 999, 'guard', 1]] });
      c.push(Object.assign(H.siding(48), { id: 'cop', role: 'vip', look: POLICE, failText: POLICE_FAIL, routine: pace(38, 52, 5, 4, 'stand') }));
    }
    return c;
  },
  vehicles(H, f) {
    const out = [['out', 'fixer', -2.6, 'meet', H.PM, 0]];
    if (!vargaHelps(f)) out.push(['out', 'bg', 3.4, 'meet', H.PM, 0]);
    return [
      { id: 'car', kind: 'suv', plane: H.PM, x: 88, y: 0, dir: -1, col: '#101216', seats: vargaHelps(f) ? ['drv', 'fixer'] : ['drv', 'fixer', 'bg'],
        routine: [['wait', 3], ['drive', 18.6, 9], ['emit', 'arrived'], ['wait', 0.8]].concat(out, [['waitFor', 'fixer_in'], ['wait', 1.4], ['drive', 130, 10], ['gone']]) },
      H.n1.veh, H.f1.veh, H.n2.veh,
    ];
  },
  triggers(H, f) {
    const help = vargaHelps(f);
    const t = [H.n1.trig, H.f1.trig, H.n2.trig,
      hint(1.5, 'A train on the NEAR line hides everything behind it and stops your bullet. A train on the FAR line hides nothing, and its noise covers a shot. A signal lamp turns green before each train.', 12),
      onEv('arrived', (sim) => sim.msg('Pip', 'That is him getting out. Pale coat, flat cap. Let them talk.'), 1.5),
      onEv('deal', (sim) => sim.msg('Pip', 'Money for paper. Now let the clerk go. Round the lamp hut, and then he is blind to it.'), 0.6),
      onEv('clerk_hid', (sim) => { if (!help && sim.alive('fixer')) sim.msg('Pip', 'The clerk is round the hut. It has gone very quiet down there. Wait for the next train before you fire.'); }, 0.2),
      onEv('leaving', (sim) => { if (sim.alive('fixer')) sim.msg('Pip', 'He is walking back to the car. Lead him, or lose him behind the next train.'); }),
    ];
    if (help) {
      t.push(say(5, 'Varga', 'Varga. The yard master owes me a favour. The trains keep running tonight, and the far line is the one you want.'));
      t.push(onEv('clerk_hid', (sim) => { if (sim.alive('fixer')) sim.msg('Varga', 'The clerk is past the hut. He cannot see a thing. Now wait for your noise: the far line is green.'); }));
    } else {
      t.push(say(5, 'Pip', 'Varga has a constable walking the far siding, and it is you she wants. Keep your rounds away from him.'));
    }
    return t;
  },
  challenge: { id: 'walking', text: 'Take him on the move, as he walks back to the car', test: (sim) => sim.kills.some((k) => k.id === 'fixer' && k.moving) },
  after: 'The clerk walked out of the yard with the money, a clear conscience, and me on his arm. His name is Wendell Pike and he kept a second copy. Of course he did. He is a records clerk.',
  solve(H, st) {
    const need = st.action === 'charge' ? 2.3 : 1.3, L = CARS.freight.len / 2 + 4;
    const hidden = (s, x) => ['n1', 'n2'].some((id) => Math.abs(s.byId[id].x - x) < L);
    return [['until', (s) => { const a = s.byId.fixer, c = s.byId.clerk; return a.anim === 'phone' && a.goal === null && c.zone === 'west' && !hidden(s, a.x) && (st.quiet || (s.covered() && s.coverUntil - s.t > need)); }, 90], ['wait', 0.3], ['hold'], ['shoot', 'fixer', 'torso']];
  },
  reward: { cr: 3600, xp: 800 },
});

mission({
  id: 'c5m2', ch: 5, title: 'House Guests', range: 500,
  objective: 'The head of security: black suit, white hair, red tie. No camera may see him fall.',
  brief: 'Aurel\'s lawyer is giving a garden party, and the man who runs Aurel\'s guards is working it: Coll Madrigan, head of security. He planned the night they came for me, so forgive me if I am not neutral. His men all wear black suits and dark glasses, and so does he. I will find you something better than that. He walks the grounds and checks every camera himself. A camera that sees him fall will bring the whole house down on us, so blind one first, or find the place they do not look. The band is loud. Use it.',
  intel(f) {
    return ['Security wear BLACK suits and dark glasses. Madrigan is one of them: WHITE hair, RED tie.', 'A camera that sees a body raises the alarm. Shoot the camera first, while the band is playing.',
      'One camera, on the corner of the glasshouse, covers the rose walk on the right. He goes there alone.', 'Range about 500 m. Wind 4 m/s from the left: watch the bunting.',
      f && f.savedBrandt ? 'Nadia Brandt is a guest (red hair, teal dress). She has offered to point him out. Do not hit her.' : vargaHelps(f) ? 'Detective Varga knows him by sight and will describe him.' : 'A police constable is on the drive, hired for the day. He is not one of theirs.'];
  },
  wind: { v: 4, gust: 1.5 }, par: 2, rules: { kill: ['hs'] },
  vantages: [
    { name: 'Chapel tower', desc: '500 m. Near enough that any rifle is heard in the garden. Fire while the band is playing.', eye: [0, 46, 0], tag: 'Shorter shot' },
    { name: 'Quarry lip', desc: '640 m, and higher. Too far for an ordinary rifle to be heard properly: they look around, they do not run. More wind.', eye: [40, 74, -140], windMul: 1.35, tag: 'Longer shot, quieter' },
  ],
  look: [12, 3],
  testFlags: CH5_FLAGS,
  setup() {
    const H = SCN.estate({ z: 500, time: 'day', seed: 7, party: true, cars: [['sedan', -59, 1, '#7a2e2e'], ['limo', -51.5, 1, '#15171b'], ['suv', -44, -1, '#d9dde2']] });
    K.thing(H.S, H.PG, 'duck', -40.4, 0.68); // on the diving board
    return H;
  },
  cast(H, f) {
    const help = vargaHelps(f), suit = '#16181d';
    const camCheck = (sim, a) => { if (H.cams.east.alive) return; a.routine = a.routine.slice(); a.routine[a.pc] = ['wait', 12, 'look', 1]; sim.bubble(a, '?', 2.5); };
    const c = [
      Object.assign(H.lawn(12), { id: 'hs', role: 'target', face: -1, speed: 1.15, look: { coat: suit, glasses: 'shades', hair: 'white', tie: COL.red }, escapeText: 'Madrigan was in a car and out of the gate before you could work the bolt. He will not walk a garden again.',
        routine: [['wait', 6, 'talk', -1], ['walk', 24], ['wait', 2.5, 'phone', 1], ['walk', 30.6], ['to', { zone: 'east' }], ['walk', 41.5], ['call', camCheck], ['wait', 6, 'look', 1],
          ['walk', 30.6], ['to', { zone: 'terrace' }], ['walk', 24], ['wait', 2, 'stand', -1], ['walk', -13], ['wait', 4, 'look', -1], ['walk', 12], ['wait', 4, 'talk', -1], ['loop', 1]] }),
      Object.assign(H.lawn(8.6), { id: 'sec1', role: 'guard', face: 1, anim: 'arms', look: { coat: suit, glasses: 'shades', hair: 'short', hairCol: '#5a3a22', tie: COL.red }, routine: [['wait', 999, 'arms', 1]] }),
      Object.assign(H.lawn(-34), { id: 'sec2', role: 'guard', look: { coat: suit, glasses: 'shades', hair: 'white', tie: COL.blue }, routine: pace(-36, -19, 5, 5, 'arms') }),
      Object.assign(H.inHut(), { id: 'gateman', role: 'guard', anim: 'stand', face: -1, look: { hat: 'peaked', hatCol: '#3a3f47', coat: '#3a3f47' }, routine: [['wait', 999, 'stand', -1]] }),
      // the host and his guests
      Object.assign(H.lawn(2.6), { id: 'host', role: 'civ', face: 1, anim: 'talk', look: { coat: COL.cream, hair: 'white', tie: COL.red, bag: 'cup', build: 'big' }, failText: 'You shot the host. Aurel\'s lawyer was the one man at that party the papers would have named.', routine: [['wait', 999, 'talk', 1]] }),
      Object.assign(H.lawn(4.1), { id: 'gu1', role: 'civ', face: -1, anim: 'drink', look: { hair: 'long', hairCol: '#2a2019', dress: COL.wine, bag: 'cup' }, routine: [['wait', 999, 'drink', -1]] }),
      Object.assign(H.lawn(-2.2), { id: 'gu2', role: 'civ', face: 1, anim: 'drink', look: { hat: 'sun', hatCol: '#efe6cf', dress: COL.sky, bag: 'cup' }, routine: [['wait', 999, 'drink', 1]] }),
      Object.assign(H.lawn(13.2), { id: 'gu3', role: 'civ', face: 1, anim: 'sitdrink', look: { coat: COL.tan, hair: 'short', bag: 'cup' }, routine: [['wait', 999, 'sitdrink', 1]] }),
      Object.assign(H.lawn(14.8), { id: 'gu4', role: 'civ', face: -1, anim: 'sit', look: { hair: 'bun', dress: COL.pink }, routine: [['wait', 999, 'sit', -1]] }),
      Object.assign(H.lawn(-29.2), { id: 'gu5', role: 'civ', face: -1, anim: 'sitdrink', look: { hat: 'sun', hatCol: '#e8dcc0', hatBand: COL.red, dress: COL.yellow, bag: 'cup' }, routine: [['wait', 999, 'sitdrink', -1]] }),
      Object.assign(H.lawn(-30.8), { id: 'gu6', role: 'civ', face: 1, anim: 'sitphone', look: { coat: COL.navy, glasses: true }, routine: [['wait', 999, 'sitphone', 1]] }),
      Object.assign(H.lawn(-21.5), { id: 'gu7', role: 'civ', face: -1, anim: 'stand', look: { hair: 'long', dress: COL.teal, hairCol: '#e0c070', bag: 'cup' }, routine: pace(-26, -20.5, 6, 5, 'drink') }),
      Object.assign(H.lawn(-3.6), { id: 'wt1', role: 'civ', look: { coat: '#f1ede2', hair: 'short', bag: 'box', bagCol: '#c9ced3' }, routine: [['wait', 3, 'work', 1], ['walk', 19.5], ['wait', 3, 'work', 1], ['walk', -3.6], ['loop']] }),
      // the band, by the loggia
      Object.assign(H.lawn(-12.6), { id: 'bd1', role: 'civ', face: 1, anim: 'work', look: { hat: 'fedora', hatCol: '#22252b', bag: 'guitar', coat: '#22252b' }, routine: [['wait', 999, 'work', 1]] }),
      Object.assign(H.lawn(-11.0), { id: 'bd2', role: 'civ', face: 1, anim: 'talk', look: { hat: 'beret', hatCol: '#7a2438', coat: '#22252b' }, routine: [['wait', 999, 'talk', 1]] }),
      Object.assign(H.lawn(-9.5), { id: 'bd3', role: 'civ', face: -1, anim: 'work', look: { hair: 'long', dress: '#22252b', bag: 'guitar', bagCol: '#7b5a36' }, routine: [['wait', 999, 'work', -1]] }),
    ];
    if (f && f.savedBrandt) c.push(Object.assign(H.lawn(15.6), { id: 'brandt', role: 'vip', face: -1, anim: 'drink', look: { hair: 'long', hairCol: '#c2452d', dress: COL.teal, bag: 'cup' }, failText: 'You shot Nadia Brandt. She came to that party to help you.',
      routine: [['wait', 2.8, 'drink', -1], ['wait', 3.4, 'point', -1], ['walk', 20.1], ['wait', 999, 'sitdrink', 1]] }));
    if (!help) {
      c.push(Object.assign(H.drive(30), { id: 'sec3', role: 'guard', look: { coat: suit, glasses: 'shades', build: 'big' }, routine: pace(17, 33, 5, 5, 'arms') }));
      c.push(Object.assign(H.drive(-6), { id: 'cop', role: 'vip', look: POLICE, failText: POLICE_FAIL, routine: pace(-16, -2, 6, 6, 'stand') }));
    }
    return c;
  },
  onAlarm(sim) { sim.msg('Pip', 'They are shutting the gates and he is running for a car. That was our one visit.'); },
  triggers(H, f) {
    const t = [{ at: 3, every: 22, do(sim) { sim.cover(15, 'band'); } },
      hint(1.5, 'Cameras watch the pool, the terrace, the rose walk and the gate. If one sees a body, the alarm goes up. A camera is a small thing to hit: wait for the music, then shoot it out.', 11),
      say(13, 'Pip', 'He checks the rose walk himself, over on the right. One camera covers it, on the corner of the glasshouse.')];
    if (f && f.savedBrandt) { t.push(say(2, 'Pip', 'Brandt got herself invited. Red hair, teal dress. She says she will point him out, which is not my idea of subtle.')); t.push(say(6.6, 'Pip', 'There. White hair, red tie, walking away from her. That is Madrigan.')); }
    else if (vargaHelps(f)) t.push(say(2.5, 'Varga', 'Varga. His name is Coll Madrigan. White hair, red tie, and he never stands still. I have wanted him for six years.'));
    else { t.push(say(2, 'Pip', 'Black suit and dark glasses means security, and I count four. Give me a minute to find his photograph.')); t.push(say(9, 'Pip', 'Found it. White hair.')); t.push(say(16, 'Pip', 'And a red tie. The host has both of those, but the host is in cream. Not him.')); }
    return t;
  },
  challenge: { id: 'arch', text: 'Take him under the rose arch, where no camera looks, and leave every camera working', test: (sim, res) => res.clean && !sim.S.objects.some((o) => o.kind === 'cctv' && !o.alive) },
  after: 'Madrigan is gone, and by tea time so were half his guards. Nobody wants to be the one left holding the rota. The lawyer is telling people it was a heart attack, which tells you what he thinks of his own cameras.',
  solve(H, st, f, sim) {
    const far = sim.S.refZ - sim.eye0.z > st.noise, need = st.action === 'charge' ? 2.1 : 1.2;
    return [['until', (s) => st.quiet || far || (s.covered() && s.coverUntil - s.t > need), 60], ['hold'], ['shootObj', 'cam_east'],
      ['until', (s) => { const a = s.byId.hs; return a.zone === 'east' && a.goal === null && a.anim === 'look' && a.wait > 2.6 && a.state === 'calm' && clearShot(s, 'hs'); }, 240], ['hold'], ['shoot', 'hs', 'torso'],
      // the loosest rifles can miss a man at 500 m: if he bolts, try once more as he runs
      ['until', (s) => s.byId.hs.dead || s.byId.hs.state === 'flee', 3], ['shoot', 'hs', 'torso', { miss: true }], ['shoot', 'hs', 'torso', { miss: true }]];
  },
  reward: { cr: 3800, xp: 830 },
});

// Small helper: send someone to look at a spot, then back to what they were doing.
function sendOver(sim, a, x, wait, anim) {
  if (!a || a.dead || a.gone || a.state !== 'calm' || a.stack.length || a.inVeh) return false;
  a.stack.push({ routine: a.routine, pc: a.pc, wait: a.wait, goal: a.goal, anim: a.anim, x: a.x });
  a.routine = [['walk', x], ['wait', wait, anim || 'stand'], ['walk', a.x], ['back']]; a.pc = 0; a.wait = 0; a.goal = null;
  return true;
}

mission({
  id: 'c5m3', ch: 5, title: 'The Quartermaster', range: 420,
  objective: 'Sink the armoury boat by her fuel drums. Nobody dies.',
  brief: 'The Ledger keeps its rifles on a boat, because a boat can be somewhere else by morning. I stocked her for six years, so I know where the fuel sits: two red drums at the stern. Put a round in them and she goes to the bottom with every gun they own. But nobody dies tonight, Kestrel. That crew used to bring me tea. Get them off her first. There is a cargo net hanging from the quay crane, and nothing empties a boat like a loud accident. The trains on the bridge will hide your shot.',
  intel(f) {
    return ['Target: the RED fuel drums at the stern (right-hand end) of the boat. Range about 420 m.', 'The blast reaches about 8 m. Anyone that close dies, and then we have failed.',
      'Shoot the yellow hook above the cargo net and the crew will come to look. Make sure nobody is under it.', 'A train crossing the bridge covers a loud shot. Any alarm and they cast off.',
      vargaHelps(f) ? 'Varga is holding river traffic at the lock. Two crew aboard.' : 'A police launch patrols past the stern. It must be well clear when the fuel goes. Three crew aboard.'];
  },
  wind: { v: -2.6, gust: 1.2 }, par: 2,
  rules: { destroy: ['fuel'], noKills: true, boomQuiet: true, strict: true, time: 95, aftermath: 4,
    timeText: 'They cast off on time, with the whole armoury aboard. She could be anywhere on the river by morning.',
    strictText: 'They heard that. The lines were off and the engine running before you could fire again.',
    noKillsText: 'Somebody died. That crew were not the enemy, and Pip will not forgive this one.' },
  vantages: [{ name: 'Flour mill hoist', desc: 'On the left bank, looking up river at the quay. 420 m.', eye: [-74, 30, 0] }],
  look: [-58, 5],
  testFlags: CH5_FLAGS,
  setup() {
    const H = SCN.bridge({ zb: 600, refZ: 420, time: 'night', seed: 9, jetty: true, bounds: { x0: -126, x1: -22, y0: -5, y1: 36 }, exits: [-150, -150] });
    H.hook = K.hang(H.S, H.PJ, -88, 12.5, 'net', { id: 'hook', top: H.QY + 17, floor: H.jettyY });
    K.box(H.S, H.PJ, -86.2, H.jettyY, 1.6, 1.0, '#8a6a45', { mat: 'wood' }); K.box(H.S, H.PJ, -84.4, H.jettyY, 1.3, 0.8, '#5d6b4a', { mat: 'wood' });
    H.PL = H.S.plane(H.zb - 186, 'river lane');
    K.thing(H.S, H.PJ, 'duck', -93.4, H.jettyY + 0.98); // on a mooring post
    // the hook block is yellow, and stays readable at night under the jib lamp
    const drawHook = H.hook.draw;
    H.hook.draw = function (ctx, env) { drawHook(ctx, env); if (H.hook.alive) { R4(ctx, H.hook.x - 0.24, H.hook.y - 0.26, 0.48, 0.52, '#e8b53a'); R4(ctx, H.hook.x - 0.11, H.hook.y - 0.13, 0.22, 0.26, '#20242b'); } };
    H.tr = H.train({ id: 'tr', at: 5, every: 27, dir: 1, speed: 18, near: 130 });
    // the night watchman's chair on the quay (he sat on thin air before): drawn behind him, so it hides nothing
    { const q = H.quay(-112), wood = H.S.tone('#6b5440', q.plane), woodD = H.S.tone('#4a3a2c', q.plane), x = q.x, y = q.y;
      q.plane.add({ x0: x - 1, x1: x + 1, layer: 0, draw(ctx, env) {
        if (env.s < 2.5) return;
        const lw = Math.max(0.035, env.px);
        ctx.strokeStyle = woodD; ctx.lineWidth = lw; ctx.beginPath();
        ctx.moveTo(x - 0.24, y); ctx.lineTo(x - 0.22, y + 0.46); ctx.moveTo(x + 0.2, y); ctx.lineTo(x + 0.18, y + 0.46); // legs
        ctx.moveTo(x - 0.24, y + 0.44); ctx.lineTo(x - 0.4, y + 1.0); ctx.stroke();                             // the back, leaning
        R4(ctx, x - 0.28, y + 0.42, 0.52, 0.06, wood); // seat
        if (env.s > 8) { ctx.strokeStyle = wood; ctx.lineWidth = Math.max(0.05, env.px); ctx.beginPath(); ctx.moveTo(x - 0.3, y + 0.72); ctx.lineTo(x - 0.38, y + 0.95); ctx.stroke(); }
      } }); }
    return H;
  },
  cast(H, f) {
    const crewFail = 'That crew were not the enemy. Nobody was supposed to die tonight.';
    const c = [
      Object.assign(H.jetty(-50.4), { id: 'wm', role: 'guard', face: -1, anim: 'smoke', speed: 1.4, look: { hat: 'beanie', hatCol: '#2a333a', coat: '#3a2f2a', build: 'big' }, failText: crewFail, routine: [['wait', 999, 'smoke', -1]] }),
      Object.assign(H.jetty(-54.2), { id: 'qm', role: 'guard', face: 1, anim: 'work', speed: 1.4, look: { hat: 'peaked', hatCol: '#27365a', coat: '#27365a', bag: 'clip' }, failText: crewFail, routine: [['wait', 999, 'work', 1]] }),
    ];
    if (!vargaHelps(f)) {
      c.push(Object.assign(H.jetty(-57), { id: 'dh', role: 'guard', speed: 1.4, look: { hat: 'cap', hatCol: '#5a4634', vest: '#5d6b4a', bag: 'box' }, failText: crewFail, routine: pace(-57, -87.4, 3, 4, 'work') }));
      c.push({ id: 'pol', role: 'vip', look: POLICE, failText: 'The police launch was alongside when the fuel went up. A constable is dead, and Varga will never stop looking for you now.' });
    }
    c.push(Object.assign(H.quay(-112), { id: 'nw', role: 'civ', face: 1, anim: 'sit', look: { hat: 'cap', coat: COL.olive }, failText: 'You shot the night watchman on the quay. He had nothing to do with any of it.', routine: [['wait', 999, 'sleep', 1]] }));
    return c;
  },
  vehicles(H, f) {
    const v = [H.tr.veh];
    if (!vargaHelps(f)) v.push({ id: 'launch', kind: 'plaunch', plane: H.PL, x: -22, y: 0, dir: -1, col: '#27365a', seats: ['pol'], routine: [['drive', -92, 4.5], ['wait', 5], ['drive', -22, 4.5], ['wait', 5], ['loop']] });
    return v;
  },
  triggers(H, f) {
    const crew = (sim) => ['wm', 'qm', 'dh'].map((id) => sim.byId[id]).filter((a) => a && !a.dead);
    return [H.tr.trig,
      hint(1.5, 'Nobody may die here. Get the crew away from the boat first: shoot the yellow hook above the cargo net (when nobody is under it) and they will all come to look. Then the red drums.', 12),
      onEv('crash:hook_p', (sim) => { crew(sim).forEach((a, i) => { if (sendOver(sim, a, -85.6 + i * 1.5, 9, 'stand')) sim.bubble(a, '?', 2); }); sim.msg('Pip', 'There they go, every one of them. Give them a few steps more, then the drums.'); }, 0.3),
      // tea: each of them takes up a mug for it (and puts down whatever he was carrying), then picks his things up again
      { at: 46, do(sim) { if (H.boat.fuel.alive && crew(sim).filter((a, i) => { if (!sendOver(sim, a, -84 + i * 1.6, 9, 'drink')) return false; a.routine.splice(1, 0, ['look', { bag: 'cup' }]); a.routine.splice(3, 0, ['look', { bag: a.look.bag || null }]); return true; }).length) sim.msg('Pip', 'Tea. They always did stop for tea. Is anybody left aboard?'); } },
      onEv('obj:fuel', (sim) => { crew(sim).forEach((a) => sim.setRoutine(a, [['wait', 99, 'stand', 1]])); sim.msg('Pip', 'Down she goes. Look at them. Not a scratch.'); }),
      vargaHelps(f) ? say(4, 'Varga', 'Varga. I am holding the river at the lock for you. Nothing will pass that quay tonight.') : say(4, 'Pip', 'Varga has a police launch on the river tonight. If it is beside the boat when the fuel goes, we have killed a constable.'),
    ];
  },
  challenge: { id: 'oneshot', text: 'One shot. Wait for the moment they all step ashore on their own', test: (sim) => sim.stats.shots === 1 },
  after: 'Forty rifles, a crate of things I am not supposed to know about, and my good kettle, all on the bottom of the Calder. The crew stood on the quay and watched her go. I may send them a card.',
  solve(H, st) {
    const need = st.action === 'charge' ? 2.2 : 1.3, fx = H.boat.fuel.x;
    const crew = (s) => ['wm', 'qm', 'dh'].map((id) => s.byId[id]).filter((a) => a && !a.dead);
    const cov = (s) => st.quiet || (s.covered() && s.coverUntil - s.t > need);
    const netClear = (s) => crew(s).every((a) => Math.abs(a.x + 88) > 7);
    const safe = (s) => crew(s).every((a) => Math.abs(a.x - fx) > 11) && (!s.byId.launch || Math.abs(s.byId.launch.x - fx) > 17);
    return [['until', (s) => cov(s) && netClear(s), 80], ['hold'], ['shootObj', 'hook'], ['until', (s) => s.did('crash:hook_p') && safe(s), 60], ['wait', 0.2], ['hold'], ['shootObj', 'fuel']];
  },
  reward: { cr: 4000, xp: 860 },
});

// Bot helper: shoot, and keep shooting (up to four rounds) if a round misses.
// At 600 m and more the loosest rifles do not hit a man every time.
// It holds its breath for the first one, as a careful player would.
function twice(id, part) { const one = ['shoot', id, part || 'torso']; return [['hold'], one, one.slice(), one.slice(), one.slice()]; }
// Gunmen in a stand-off do not run when a round clips an arm or a leg. They
// flinch, lose a second or two of their aim, and carry on. (Left alone, the
// simulation would have them bolt and fire wildly at once.)
function standFast(ids) {
  const last = {};
  return { at: 0, every: 0.001, do(sim) { ids.forEach((id) => { const a = sim.byId[id]; if (!a || a.dead || a.gone) return;
    if (a.state !== 'alert') { a.state = 'alert'; a.react = 0; if (a.threat && last[id] !== undefined) a.threat.t = Math.max(a.threat.t, last[id] + 1.5); }
    last[id] = a.threat ? a.threat.t : undefined; }); } };
}
// True if nobody else is standing in the line of fire to this person.
function clearShot(sim, id) {
  const a = sim.byId[id]; if (!a) return false;
  const e = sim.eye0, ty = a.y + 1.2;
  return !sim.actors.some((b) => { if (b === a || b.dead || b.gone || b.hidden || b.inVeh || b.plane.z >= a.plane.z + 12) return false; const u = (b.plane.z - e.z) / (a.plane.z - e.z), x = e.x + (a.x - e.x) * u, y = e.y + (ty - e.y) * u; return Math.abs(x - b.x) < 1.1 && y > b.y - 0.4 && y < b.y + 2.4; });
}

mission({
  id: 'c5m4', ch: 5, title: 'Bridge Toll', range: 700,
  objective: 'Stop the prison van. Drop the escorts before they reach him.',
  brief(f) {
    return 'Aurel\'s people picked up ' + (f && f.sparedReyes ? 'Tomas Reyes this afternoon, the docker you let walk' : 'Wendell Pike this afternoon, our records clerk') + '. They are taking him over the Calder bridge in a prison van, and men who cross that bridge with Aurel do not come back. The convoy has to stop at the toll. Stop the van for good: a tyre will do it. Then the escorts get out, and they have orders about witnesses. Drop them before they reach the back doors. The evening freight is crossing underneath, so nobody will hear you. Mind the barred window. He is behind it.';
  },
  intel(f) {
    return ['The van is the GREY one with the barred window. The prisoner is behind that window.', 'It stops at the toll booth for a few seconds. A flat tyre keeps it there.',
      'Each escort who gets out walks to the back of the van and takes aim. That is your countdown.', 'Range about 700 m, wind 5 m/s. The bullet takes more than a second to arrive.',
      vargaHelps(f) ? 'Varga pulled the rear escort car over at the last junction. One car in front, one gunman.' : 'Two escort cars, one gunman in each. A traffic constable stands at the toll: he is only doing his job.'];
  },
  wind: { v: 5, gust: 1 }, par: (f) => (vargaHelps(f) ? 4 : 5), // the shots needed, plus two: this is 700 m in a crosswind, against a clock
  rules: { protect: ['pris'], time: 75, aftermath: 4.5, timeText: 'Aurel\'s second car reached the bridge. You were out of time.',
    done(sim) { const v = sim.byId.van; return !!v.stopped && ['g1', 'g3'].every((id) => { const a = sim.byId[id]; return !a || a.dead || a.gone; }); } },
  vantages: [{ name: 'Grain pier', desc: 'Down river, level with the towers. 700 m to the road deck.', eye: [0, 46, 0] }],
  look: [-30, 23],
  testFlags: CH5_FLAGS,
  setup() {
    const H = SCN.bridge({ zb: 705, refZ: 705, time: 'overcast', weather: 'rain', seed: 9, toll: 34, bounds: { x0: -112, x1: 112, y0: 2, y1: 74 } });
    H.vanRef = { v: null }; K.vanBars(H.S, H.PR, H.vanRef);
    K.thing(H.S, H.PRn, 'duck', -62.5, H.D + 10.6); // on a ledge of the left tower
    H.frt = H.train({ id: 'frt', kind: 'freight', at: 1, dir: -1, speed: 7.5, near: 150, col: '#3f5a48', seed: 3 });
    K.parked(H.S, H.PRf, 'sedan', -36, -1, '#b9a15a', { y: H.D, layer: 0 });
    return H;
  },
  cast(H, f) {
    const esc = { coat: '#1b1e24', hat: 'beanie', hatCol: '#1b1e24', build: 'big', gun: 'rifle' };
    const c = [
      { id: 'd1', role: 'guard', look: { hat: 'cap', hatCol: '#1d2026' } },
      { id: 'g1', role: 'hostile', calmOnAlarm: true, look: esc },
      { id: 'dv', role: 'guard', look: { hat: 'peaked', hatCol: '#3a3f47' } },
      { id: 'pris', role: 'hostage', look: f && f.sparedReyes ? { hat: 'beanie', hatCol: '#3a6ea5', vest: '#e07b2a' } : { build: 'thin', glasses: true, coat: COL.brown, hair: 'short', hairCol: '#3a2a20' },
        failText: f && f.sparedReyes ? 'You hit Reyes. He was behind the barred window, exactly where you were told.' : 'You hit the clerk. He was behind the barred window, exactly where you were told.',
        lostText: 'They opened the back doors before you were ready. He is gone.' },
      Object.assign(H.tollAt(), { id: 'toll', role: 'civ', face: -1, anim: 'work', look: { hat: 'peaked', hatCol: '#5a4634', coat: '#5a4634' }, routine: [['wait', 999, 'work', -1]] }),
      { id: 'mot', role: 'civ', plane: H.PRf, x: -32.6, y: H.D, zone: 'far kerb', face: -1, anim: 'phone', look: { coat: COL.tan, hair: 'short' }, routine: [['wait', 999, 'phone', -1]] },
    ];
    if (!vargaHelps(f)) {
      c.push({ id: 'd3', role: 'guard', look: { hat: 'cap', hatCol: '#2a2d33' } });
      c.push({ id: 'g3', role: 'hostile', calmOnAlarm: true, look: Object.assign({}, esc, { hatCol: '#5a2a2a' }) });
      c.push(Object.assign(H.deck(47.5), { id: 'cop', role: 'vip', face: -1, anim: 'stand', look: POLICE, failText: POLICE_FAIL, routine: [['wait', 999, 'stand', -1]] }));
    }
    return c;
  },
  vehicles(H, f) {
    const v = [
      { id: 'lead', kind: 'suv', plane: H.PR, x: -168, y: H.D, dir: 1, col: '#15171b', seats: ['d1', 'g1'], routine: [['wait', 1.5], ['drive', 26, 9], ['emit', 'at_toll'], ['waitFor', 'barrier_up'], ['drive', 250, 9], ['gone']] },
      { id: 'van', kind: 'pvan', plane: H.PR, x: -178.5, y: H.D, dir: 1, col: '#5c6672', seats: ['dv', 'pris'], routine: [['wait', 1.5], ['drive', 15.5, 9], ['waitFor', 'barrier_up'], ['wait', 0.7], ['drive', 250, 9], ['gone']] },
      H.frt.veh,
    ];
    if (!vargaHelps(f)) v.push({ id: 'tail', kind: 'suv', plane: H.PR, x: -189, y: H.D, dir: 1, col: '#22252b', seats: ['d3', 'g3'], routine: [['wait', 1.5], ['drive', 5, 9], ['waitFor', 'barrier_up'], ['wait', 1.4], ['drive', 250, 9], ['gone']] });
    return v;
  },
  triggers(H, f) {
    const halt = (sim) => { ['lead', 'tail'].forEach((id) => { const v = sim.byId[id]; if (!v || v.gone || v.flatTire) return; v.routine = [['brake']]; v.pc = 0; v.goal = null; v.wait = 0; v.waitFor = null; }); };
    const dismount = (sim) => {
      const vx = sim.byId.van.x;
      const out = (id, veh, dx) => { const a = sim.byId[id], v = sim.byId[veh]; if (!a || a.dead || !v || v.gone || a.inVeh !== v) return null; a.inVeh = null; a.hidden = false; v.seats[a.seat] = null; sim.place(a, H.deck(v.x + dx)); a.anim = a.idle = 'stand'; a.state = 'alert'; return a; };
      const g1 = out('g1', 'lead', -3.4), g3 = out('g3', 'tail', 3.4);
      if (g1) sim.setRoutine(g1, [['speed', 1.2], ['walk', vx - 4.4], ['wait', 0.6, 'aimrifle', 1], ['threat', 'pris', 8]], true);
      if (g3) sim.setRoutine(g3, [['walk', vx - 6.0], ['wait', 9, 'guard', 1], ['threat', 'pris', 8]], true);
      if (g1 || g3) sim.msg('Pip', 'They are out and heading for the back doors. Each one who gets there is a countdown.');
    };
    const t = [H.frt.trig, standFast(['g1', 'g3']),
      { at: 0, do(sim) { H.vanRef.v = sim.byId.van; } },
      hint(1.5, 'The convoy comes from the left and stops at the toll on the right. Wait for the freight train: its noise is your cover. Then flatten a tyre on the grey van.', 11),
      onEv('at_toll', (sim) => { if (!sim.byId.van.flatTire) { H.barrier.up = true; sim.emit('barrier_up'); sim.msg('Pip', 'The barrier is up. They are moving.'); } }, 5.5),
      onEv('flat:van', halt), onEv('crash:van', halt), onEv('stopped:van', dismount, 1.0),
      onEv('gone:van', (sim) => sim.fail('escaped', 'The van reached the far bank with him still inside it.', 0.6)),
      { when: (sim) => !!sim.winAt, do(sim) { const p = sim.byId.pris, v = sim.byId.van; if (p.dead) return; p.inVeh = null; p.hidden = false; v.seats[1] = null; sim.place(p, H.deck(v.x - 4.6)); p.anim = p.idle = 'stand'; sim.setRoutine(p, [['wait', 0.8, 'hands', -1], ['run', v.x - 70], ['gone']]);
        sim.msg(vargaHelps(f) ? 'Varga' : 'Pip', vargaHelps(f) ? 'I see him. He is running to my car. That was well done, whoever you are today.' : 'He is out and running. I have the van waiting at the bank. Come home.'); } },
    ];
    if (vargaHelps(f)) t.push(say(4, 'Varga', 'Varga. I pulled their rear car over at the junction. I am half a minute behind the van. Stop it on the bridge.'));
    else t.push(say(4, 'Pip', 'Two escort cars and a traffic constable at the toll. Varga would arrest us both for this. Hit nothing in a police cap.'));
    return t;
  },
  challenge: { id: 'rolling', text: 'Stop the van while it is still rolling, before the toll', test: (sim) => sim.emitted['flat:van'] !== undefined && (sim.emitted.at_toll === undefined || sim.emitted['flat:van'] < sim.emitted.at_toll) },
  after: (f) => (f && f.sparedReyes ? 'Reyes says he is done being rescued by people he cannot see. He also says thank you. He has agreed to stand up in court, if there is still a court when this is over.' : 'Pike has not stopped shaking, but he has not stopped talking either. Aurel keeps the originals in a records office by the bridge. We passed it on the way home.'),
  solve(H, st, f) {
    const cov = (s) => st.quiet || (s.covered() && s.coverUntil - s.t > 3);
    const wheel = (s) => { const v = s.byId.van; if (v.goal !== null || v.x < 0) return null; return { x: v.x + v.dir * 0.31 * v.def.len, y: v.y + v.def.wheel, z: v.plane.z }; };
    const set = (id) => (s) => { const a = s.byId[id]; return !a || a.dead || a.gone || (!a.inVeh && a.goal === null && (a.anim === 'guard' || !!a.threat) && clearShot(s, id)); };
    const steps = [['until', (s) => cov(s) && s.did('at_toll'), 70], ['until', (s) => !!wheel(s), 20], ['hold'], ['shootPt', wheel]];
    if (!vargaHelps(f)) { steps.push(['until', set('g3'), 25]); steps.push.apply(steps, twice('g3')); }
    steps.push(['until', set('g1'), 25]); steps.push.apply(steps, twice('g1'));
    return steps;
  },
  reward: { cr: 4300, xp: 900 },
});

mission({
  id: 'c5m5', ch: 5, title: 'Marlow', range: 550,
  objective: 'Marlow is leaving. End it, or strand her: wreck her car and her radio.',
  brief: 'Found her. The voice in your ear for three years has a face after all: grey coat, silver hair pinned up, glasses. Marlow is at the Ledger safehouse tonight, burning files in a drum on the terrace and packing a case. When the case is full she drives out, and we never see her again. You can end it. Nobody would blame you, least of all me. Or you can leave her nowhere to go. Kill the car, kill the radio, and let Varga find her sitting on the steps. Thunder is your cover. Her guards are fair game.',
  intel(f) {
    return ['Marlow: GREY long coat, silver hair in a bun, glasses. She walks between her study and the fire. The housekeeper in the kitchen is nobody.', 'To strand her: a flat tyre on the pale car, AND either the radio on her desk or the dish on the back tower.',
      'From the quarry road the chimney hides the dish. From the pylon the cypresses hide her desk.', 'Thunder covers one shot at a time. Range 550 m or more, and rain.',
      vargaHelps(f) ? 'Varga is six minutes away. One guard on the terrace.' : 'Two guards: one on the terrace, one by the car. A police car is watching from the lane outside. Leave it alone.'];
  },
  wind: { v: 3, gust: 1.8 }, par: 2,
  rules: { aftermath: 5, done(sim) { return sim.byId.marlow.dead || (!!sim.byId.mcar.flatTire && !!sim.radioDown); } },
  vantages: [
    { name: 'Quarry road', desc: '550 m, straight on. You look into the study window. The chimney hides the radio dish.', eye: [0, 44, 0], tag: 'Sees her desk' },
    { name: 'Pylon', desc: '610 m, from the left. You see the dish and the whole drive, but the cypresses hide her desk.', eye: [-85, 60, -60], look: [26, 3], tag: 'Sees the dish' },
  ],
  look: [20, 3],
  testFlags: CH5_FLAGS,
  setup(K2, f) {
    const H = SCN.estate({ z: 550, time: 'night', weather: 'rain', seed: 11, studyLit: true, hutLit: false, wins: { '0,1': { lit: true, blind: 0 } }, brazier: 27.6, screen: [11.6, 12.9, 14.2] });
    H.radio = K.thing(H.S, H.PH, 'radio', 18.78, 1.52, { id: 'radio' });
    H.PH.add({ x0: 18, x1: 21, layer: 0, draw(ctx) { R4(ctx, 18.42, 0.8, 1.66, 0.42, H.S.tone('#6b4f3a', H.PH, true)); } });
    K.thing(H.S, H.PF, 'duck', H.gate.x1 + 0.45, 3.32); // on the right-hand gate post
    if (!vargaHelps(f)) K.parked(H.S, H.PT, 'sedan', 41, -1, '#27365a', { y: 0 });
    // the study's glazed door opens as she goes out to the fire and comes back in (drawn behind the
    // people in the study, because the door is also one of its windows)
    const sd = H.house.wins['0,7'];
    K.swingDoor(H.S, H.PH, { H, x: sd.x, y: sd.y, w: sd.w, h: sd.h, hinge: -1, lit: true, col: '#f6f1e4', layer: 0, open: (sim) => K.doorBusy(sim, ['marlow'], sd.x + sd.w / 2, 1.5) });
    // the fire flares up each time Marlow drops an armful of files into the drum (H.burnT, set from her routine)
    const bz = H.brazier, BP = bz.plane;
    BP.add({ x0: bz.x - 3, x1: bz.x + 3, layer: 2, draw(ctx, env) {
      const u = (env.t - (H.burnT === undefined ? -99 : H.burnT)) / 1.8; if (u < 0 || u > 1 || !bz.alive || env.s < 2) return;
      const x = bz.x, top = bz.y - 0.1, k = 1 - u, drift = (env.wind || 0) * 0.12 * u;
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, top + 0.5, 0.05, x, top + 0.5, 1.8 * k + 0.2);
      g.addColorStop(0, 'rgba(255,190,90,' + (0.55 * k).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, top + 0.5, 1.8 * k + 0.2, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      const hh = 1.5 * Math.sqrt(k); ctx.fillStyle = H.S.tone('#ff9a2e', BP, true); ctx.beginPath(); ctx.moveTo(x - 0.26, top); ctx.quadraticCurveTo(x - 0.3, top + hh * 0.6, x + drift, top + hh); ctx.quadraticCurveTo(x + 0.3, top + hh * 0.55, x + 0.26, top); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 8; i++) { // scraps of burning paper and sparks lifting off it
        const q = ((i * 37) % 10) / 10, ex = x + Math.sin(i * 2.3) * 0.3 + drift * (1 + q), ey = top + 0.3 + u * (1.6 + 1.4 * q);
        ctx.globalAlpha = k; if (i % 2) circ(ctx, ex, ey, Math.max(0.03, env.px), H.S.tone('#ffb050', BP, true)); else R4(ctx, ex, ey, 0.08, 0.05, H.S.tone('#2a2420', BP));
      }
      ctx.globalAlpha = 1;
    } });
    return H;
  },
  start(sim, H) { H.sim = sim; },
  cast(H, f) {
    const door = H.lawn(23.75), inDoor = H.study(23.75);
    const atRadio = (sim, a) => {
      if (sim.radioDown) { sim.setRoutine(a, [['wait', 999, 'sit', 1]], true); return; }
      sim.msg('Pip', 'She is on the radio, calling for a car. Kill it now or she is gone.');
      sim.setRoutine(a, [['wait', 7, 'phone', -1], ['call', (s) => { if (!s.radioDown && !s.winAt) s.fail('escaped', 'Marlow got through on the radio. Aurel\'s people lifted her off the terrace within the hour.', 1.0); }], ['wait', 999, 'sit', 1]], true);
    };
    const toRadio = (run) => { const mv = run ? 'run' : 'walk'; return [[mv, 23.75], ['to', inDoor], [mv, 19.4], ['call', atRadio]]; };
    const atCar = (run) => (sim, a) => {
      const v = sim.byId.mcar;
      if (!v.flatTire) { sim.setRoutine(a, [['emit', 'marlow_in'], ['veh', 'mcar', 0]], true); return; }
      sim.bubble(a, '!', 2);
      sim.setRoutine(a, [['wait', 2.2, 'kneel', 1], ['to', H.lawn(33.3)]].concat(toRadio(run)), true);
    };
    const leave = (run) => { const mv = run ? 'run' : 'walk'; return [[mv, 23.75], ['to', door], [mv, 33.3], ['to', H.drive(33.3)], ['call', atCar(run)]]; };
    H.toRadio = toRadio;
    let loops = 0;
    const c = [
      Object.assign(H.study(19.4), { id: 'marlow', role: 'target', face: -1, anim: 'work', look: { coat: '#7c838c', long: true, hair: 'bun', hairCol: '#d3d7dc', glasses: true }, flee: leave(true),
        // (the files go into the fire as she reaches it; the flare is drawn from H.burnT)
        routine: [['wait', 7, 'work', -1], ['look', { bag: 'paper' }], ['walk', 23.75], ['to', door], ['walk', 26.9], ['look', { bag: null }], ['call', (sim) => { H.burnT = sim.t; }], ['wait', 5, 'work', 1], ['walk', 23.75], ['to', inDoor], ['walk', 19.4],
          ['call', (sim, a) => { if (++loops >= 3) { sim.msg('Pip', 'That is the last of the files. She has her case. She is going to the car.'); sim.setRoutine(a, [['look', { bag: 'case' }], ['wait', 1.5, 'stand', 1]].concat(leave(false))); } }], ['loop']] }),
      Object.assign(H.lawn(4), { id: 'g1', role: 'guard', look: { hat: 'beanie', coat: '#2a2f38', build: 'big', gun: 'rifle' }, routine: pace(-6, 16, 4, 4, 'guard') }),
      // the housekeeper, washing up in the kitchen. She has never heard of the Ledger.
      Object.assign(H.inWin(0, 1), { id: 'cook', role: 'civ', face: 1, anim: 'work', look: { hair: 'bun', hairCol: '#5a3a22', dress: COL.sky }, failText: 'You shot the housekeeper. She thought she worked for an insurance firm.', routine: pace(H.house.winX(1) - 0.5, H.house.winX(1) + 0.4, 6, 5, 'work') }),
    ];
    if (!vargaHelps(f)) {
      c.push(Object.assign(H.drive(38.6), { id: 'g2', role: 'guard', face: -1, anim: 'smoke', look: { hat: 'cap', hatCol: '#2a2d33', coat: '#39404a' }, routine: [['wait', 999, 'smoke', -1]] }));
      c.push({ id: 'cop', role: 'vip', plane: H.PT, x: 44.2, y: 0, zone: 'lane', face: -1, anim: 'look', look: POLICE, failText: POLICE_FAIL, routine: [['wait', 999, 'look', -1]] });
    }
    return c;
  },
  vehicles(H) {
    return [{ id: 'mcar', kind: 'sedan', plane: H.PD, x: 34, y: 0, dir: 1, col: '#c9ced3', seats: [], routine: [['waitFor', 'marlow_in'], ['wait', 1.6], ['drive', 140, 12], ['gone']] }];
  },
  triggers(H, f) {
    const t = [{ at: 4, every: 9, do(sim) { sim.cover(2.7, 'thunder'); } },
      hint(1.5, 'This one is your choice. Shoot Marlow, or leave her stranded: flatten a tyre on the pale car and break her radio (the set on her desk, or the dish on the tower). Fire inside the thunder.', 12),
      onEv('gone:mcar', (sim) => sim.fail('escaped', 'Marlow drove out of the gate with her case on the seat beside her. Nobody will find her now.', 0.6)),
      // if the tyre goes while she is already in the car, she gets out and tries the radio
      { when: (sim) => { const v = sim.byId.mcar, a = sim.byId.marlow; return !!v.flatTire && a.inVeh === v && v.v < 0.2 && !a.dead; }, do(sim) { const v = sim.byId.mcar, a = sim.byId.marlow; a.inVeh = null; a.hidden = false; v.seats[0] = null; sim.place(a, H.drive(v.x - 1.4)); a.anim = a.idle = 'stand'; sim.setRoutine(a, [['wait', 1.2, 'stand', 1], ['walk', 33.3], ['to', H.lawn(33.3)]].concat(H.toRadio(false)), true); } },
      onEv('flat:mcar', (sim) => { const g = sim.byId.g2; if (g && !g.dead && g.state === 'calm') { sim.bubble(g, '?', 2); sim.setRoutine(g, [['wait', 1], ['walk', 36.7], ['wait', 5, 'kneel', -1], ['call', (s) => s.raiseAlarm('guard', 0)]]); } }),
      { when: (sim) => !!sim.winAt && !sim.byId.marlow.dead, do(sim) { const a = sim.byId.marlow; if (!a.inVeh && a.plane !== H.PD) sim.setRoutine(a, a.behind ? [['walk', 23.75], ['to', H.lawn(23.75)], ['walk', 25.2], ['wait', 99, 'sit', 1]] : [['walk', 25.2], ['wait', 99, 'sit', 1]], true);
        sim.msg(vargaHelps(f) ? 'Varga' : 'Pip', vargaHelps(f) ? 'No car and no radio. She is not going anywhere. I am on the hill road now. Thank you.' : 'No car, no radio. I have just told the police where to find her. Varga can work out the rest.'); } },
    ];
    if (vargaHelps(f)) t.push(say(3, 'Varga', 'Varga. If she is breathing when I get there, I can put all of it in front of a judge. Her car and her radio. But it is your choice, Kestrel, not mine.'));
    else t.push(say(3, 'Pip', 'There is a police car in the lane outside the wall. Varga is watching the house too. Whatever you decide, do not hit them.'));
    return t;
  },
  onAlarm(sim) { sim.msg('Pip', 'She knows. She is running for the car.'); },
  challenge: { id: 'guards', text: 'Leave everybody alive: Marlow and her guards', test: (sim, res) => sim.kills.length === 0 },
  outcomes: [
    { id: 'spared', when: (sim) => !sim.byId.marlow.dead, set: { sparedMarlow: true }, text: 'Marlow was sitting on the terrace steps when the police cars came up the drive. She gave her real name at the gate, and she has not stopped talking since.' },
    { id: 'killed', when: () => true, set: { sparedMarlow: false }, text: 'Marlow never saw it coming, which is more than she allowed most people. Everything she knew about Aurel went with her.' },
  ],
  after: 'Three years of that voice, and it was yours to answer in the end. Now. Aurel keeps his paper in a records office by the bridge. Varga wants it, and so do I.',
  solve(H, st, f, sim) {
    const lead = st.action === 'charge' ? 1.9 : 1.2;
    const cov = (s) => st.quiet || (s.covered() && s.coverUntil - s.t > lead);
    const comms = sim.vi === 0 ? 'radio' : 'dish';
    const away = (s) => sim.vi !== 0 || !s.byId.marlow.behind; // from the front, wait until she has left the desk
    const wheel = (s) => { const v = s.byId.mcar; return { x: v.x + v.dir * 0.31 * v.def.len, y: v.y + v.def.wheel, z: v.plane.z }; };
    return [['until', (s) => cov(s) && away(s), 120], ['hold'], ['shootObj', comms], ['wait', 0.5], ['until', cov, 60], ['hold'], ['shootPt', wheel]];
  },
  reward: { cr: 4600, xp: 940 },
});

mission({
  id: 'c5m6', ch: 5, title: 'Paper Trail', range: 600,
  objective(f) { return vargaHelps(f) ? 'Keep Varga and her officer alive until the boxes are in the car.' : 'Keep both officers alive until the boxes are in the car.'; },
  brief(f) {
    return 'Everything Aurel ever signed is in a records office by the bridge, and ' + (vargaHelps(f) ? 'Varga is walking in through the front door with a warrant and one officer' : 'two of Varga\'s officers are walking in through the front door with a warrant. She does not know you are here, and she would arrest you if she did') + '. Aurel\'s people know. Gunmen will show themselves on the balconies, the roofs, in a window, one after another, and each will take a few seconds to aim. That is your few seconds. The cathedral rings a full peal at six, so nobody will hear you. Anyone in a police cap is police. Keep them alive until the boxes are in the car.';
  },
  intel(f) {
    return ['The records office is the tall grey building. The car is parked to its right.', 'A gunman who has raised his weapon fires after about six seconds.',
      'They come one at a time at first. Two more will wait for the door to open again.', 'Range about 600 m, wind 4 m/s from the right.',
      vargaHelps(f) ? 'Varga will call out where she sees them. Four gunmen expected.' : 'Nobody is calling them out for you. Five gunmen, and a police marksman on the mill roof who is NOT one of them.'];
  },
  wind: { v: -4, gust: 0.9 }, par: (f) => (vargaHelps(f) ? 6 : 7), // one round each, plus two spare
  rules: { protect: ['v1', 'v2'], until: 'safe', aftermath: 3 },
  vantages: [{ name: 'Sail loft', desc: 'Down the quay on the same bank, looking along the street. 600 m.', eye: [146, 40, 0] }],
  look: [134, 9],
  testFlags: CH5_FLAGS,
  setup() {
    const H = SCN.bridge({ zb: 660, refZ: 600, time: 'dusk', seed: 9, churchX: 172, bounds: { x0: 96, x1: 204, y0: 2, y1: 52 }, exits: [92, 240],
      row: { cafe: { wins: { '2,1': { open: true, blind: 0, lit: true } } }, rec: { wins: { '0,2': { lit: true }, '0,4': { lit: true } } }, mill: { wins: { '2,2': { open: true, blind: 0, lit: true }, '4,4': { blind: 0, lit: true } } } } });
    K.table(H.S, H.PSt, 188, { y: H.QY, umbrella: '#b33a3a' }); K.table(H.S, H.PSt, 192, { y: H.QY, umbrella: '#e8dcc0' });
    K.thing(H.S, H.PO, 'duck', H.b.ten.x + 16 * 0.3 + 1.25, H.b.ten.roofY + 0.9 + 5.05); // on the tenement water tank
    // the office's glazed doors open for the officers going in, and again when they come out with the boxes
    const R = H.b.rec, dop = R.wins['0,3'];
    K.swingDoor(H.S, H.PO, { H, x: dop.x, y: H.QY, w: dop.w, h: dop.y + dop.h - H.QY, hinge: 0, lit: true, col: '#3b2c26', open: (sim) => K.doorBusy(sim, ['v1', 'v2'], R.winX(3) + 0.45, 1.4) });
    return H;
  },
  start(sim, H) { H.sim = sim; },
  cast(H, f) {
    const help = vargaHelps(f), R = H.b.rec, doorX = R.winX(3);
    const gun = (o) => Object.assign({ role: 'hostile', state: 'alert', calmOnAlarm: true, hidden: true, look: { mask: '#16181d', coat: '#2a2d33', hat: 'beanie', hatCol: '#16181d', gun: 'rifle' } }, o);
    const walkIn = (id, x0, look, fail, lost, lag) => Object.assign(H.street(x0), { id, role: 'hostage', face: -1, speed: 1.2, look, failText: fail, lostText: lost,
      routine: [['wait', 2.5 + lag], ['walk', doorX + lag], ['emit', 'in_' + id], ['hide'], ['wait', 20 - lag * 2], ['look', { bag: 'box' }], ['show'], ['emit', 'out'], ['wait', lag], ['walk', 151 + lag * 2], ['emit', id === 'v1' ? 'safe' : 'safe2'], ['veh', 'pcar', id === 'v1' ? 0 : 1]] });
    const c = [
      walkIn('v1', 160, help ? { hair: 'bun', hairCol: '#2a2019', glasses: true, coat: '#4a4f58', long: true } : POLICE, help ? 'You shot Detective Varga.' : POLICE_FAIL, help ? 'Varga is down. You were one shot too slow.' : 'An officer is down. You were one shot too slow.', 0),
      walkIn('v2', 162, POLICE, POLICE_FAIL, 'An officer is down. You were one shot too slow.', 0.9),
      // the gunmen, in the order they show themselves
      gun(Object.assign(H.onBal(H.bal.ten2, 154.2), { id: 'gA', routine: [['wait', 6], ['show'], ['emit', 'show_gA'], ['walk', 156.6], ['wait', 0.5, 'aim', 1], ['threat', 'v1', 6.5]] })),
      gun(Object.assign(H.onRoof(H.b.chand, 104.5), { id: 'gB', routine: [['wait', 13.5], ['show'], ['emit', 'show_gB'], ['walk', 108], ['wait', 0.5, 'aim', 1], ['threat', 'v2', 6]] })),
      gun(Object.assign(H.onBal(H.bal.rec3, 136.6), { id: 'gC', routine: [['wait', 29], ['show'], ['emit', 'show_gC'], ['walk', 139.2], ['wait', 1, 'guard', -1], ['waitFor', 'out'], ['wait', 0.6, 'aim', -1], ['threat', 'v1', 5.5]] })),
      gun(Object.assign(H.inWin(H.b.cafe, 2, 1, -0.9), { id: 'gE', routine: [['waitFor', 'out'], ['wait', 4.2], ['show'], ['emit', 'show_gE'], ['walk', H.b.cafe.winX(1)], ['wait', 0.6, 'aim', -1], ['threat', 'v1', 6]] })),
      // bystanders: all of them more than a scream away from where the gunmen stand
      Object.assign(H.inWin(H.b.mill, 2, 2), { id: 'res', role: 'civ', face: -1, anim: 'work', look: { hair: 'white', dress: COL.wine }, routine: [['wait', 999, 'work', -1]] }),
      Object.assign(H.street(187.2), { id: 'cf1', role: 'civ', face: -1, anim: 'sitdrink', look: { hat: 'beret', hatCol: '#27365a', coat: COL.tan, bag: 'cup' }, routine: [['wait', 999, 'sitdrink', -1]] }),
      Object.assign(H.street(192.8), { id: 'cf2', role: 'civ', face: 1, anim: 'sitphone', look: { hair: 'long', dress: COL.teal }, routine: [['wait', 999, 'sitphone', 1]] }),
      Object.assign(H.inWin(H.b.mill, 4, 4), { id: 'nb', role: 'civ', anim: 'phone', look: { hair: 'short', coat: COL.olive }, routine: pace(H.b.mill.winX(4) - 0.5, H.b.mill.winX(4) + 0.5, 7, 6, 'phone') }),
      Object.assign(H.street(110), { id: 'paper', role: 'civ', face: -1, speed: 1.25, look: { hat: 'cap', hatCol: '#5a4634', coat: COL.grey, bag: 'paper' }, routine: [['walk', 90], ['gone']] }),
    ];
    if (!help) {
      c.push(gun(Object.assign(H.street(111.2), { id: 'gD', routine: [['wait', 34], ['show'], ['emit', 'show_gD'], ['walk', 113.4], ['wait', 1, 'guard', 1], ['waitFor', 'out'], ['wait', 1.2, 'aim', 1], ['threat', 'v2', 7]] })));
      c.push(Object.assign(H.onRoof(H.b.mill, 189), { id: 'pm', role: 'vip', face: -1, anim: 'aimrifle', look: POLICE, failText: 'That was a police marksman, in a police cap, on a police job. ' + POLICE_FAIL, routine: [['wait', 999, 'aimrifle', -1]] }));
    }
    return c;
  },
  vehicles(H) {
    return [{ id: 'pcar', kind: 'sedan', plane: H.PSt, x: 153.5, y: H.QY, dir: 1, col: '#27365a', seats: [], routine: [['waitFor', 'safe2'], ['wait', 1.2], ['drive', 250, 9], ['gone']] }];
  },
  triggers(H, f) {
    const help = vargaHelps(f), who = help ? 'Varga' : 'Pip';
    const t = [{ at: 1, do(sim) { H.bell.ring = true; sim.cover(120, 'church bells'); } }, standFast(['gA', 'gB', 'gC', 'gD', 'gE']),
      hint(1.5, 'The bells cover every shot, so do not wait for quiet: wait for a face. A gunman steps out, raises his weapon, and fires about six seconds later. Find him first.', 11),
      onEv('show_gA', (sim) => sim.msg(who, help ? 'Balcony! Brown building, right of the office, second floor.' : 'Movement on a balcony, right of the office. That is one.')),
      onEv('show_gB', (sim) => sim.msg(who, help ? 'On the roof, far left, above the chandler.' : 'Another one. High up, I think. I cannot see where.')),
      onEv('in_v1', (sim) => sim.msg('Pip', 'They are inside. Twenty seconds for the boxes. Watch the building: somebody will be waiting when that door opens.'), 1),
      onEv('show_gC', (sim) => { if (help) sim.msg('Pip', 'Above the front door, third floor. He is waiting for them to come out.'); }, 1.5),
      onEv('out', (sim) => sim.msg(who, help ? 'Coming out now. Cover the door.' : 'The door is opening. Here they come.')),
      onEv('show_gE', (sim) => sim.msg(who, help ? 'Window over the cafe!' : 'One more, somewhere on the right!')),
    ];
    if (!help) t.push(say(8.5, 'Pip', 'The man with the rifle on the mill roof is police. Peaked cap. Leave him exactly where he is.'));
    return t;
  },
  challenge: { id: 'early', text: 'Deal with everyone who is lying in wait before the office door opens again', test: (sim) => ['gC', 'gD'].every((id) => !sim.byId[id] || sim.kills.some((k) => k.id === id && k.t < sim.emitted.out)) },
  after: (f) => (vargaHelps(f) ? 'Eleven boxes. Varga sat in the car with one on her knee and read for an hour without looking up. Then she said one word, and the word was Harrow.' : 'Eleven boxes, and Varga still thinks her own marksman saved her officers. Let her. The page that matters has one word at the top of it, and the word is Harrow.'),
  solve(H, st, f) {
    const ids = vargaHelps(f) ? ['gA', 'gB', 'gC', 'gE'] : ['gA', 'gB', 'gC', 'gD', 'gE'], steps = [];
    ids.forEach((id) => { steps.push(['until', (s) => { const a = s.byId[id]; return !!a && !a.hidden && a.goal === null && clearShot(s, id); }, 90], ['wait', 0.3]); steps.push.apply(steps, twice(id)); });
    return steps;
  },
  reward: { cr: 4800, xp: 960 },
});

mission({
  id: 'c5m7', ch: 5, title: 'Counter-Fire', range: 800,
  objective: 'Find the real scope among the mirrors. One round through the glass.',
  brief: 'Aurel is running. His helicopter is lifting off the east bank right now, and Varga\'s people went across the bridge to stop it. They did not get far. Somebody very good is shooting at them from somewhere on that bridge, and he has hung mirrors all over it so that you cannot tell which glint is his glass. Find the real one and put a round through the scope. Not the man. The scope. A mirror blinks all day long. A lens only shows when the man behind it settles to fire. He needs four shots to find his range. Do not give him the fourth.',
  intel(f) {
    return ['The mirrors blink quickly and steadily. The real scope gives one long, slow flare about two seconds before each shot.', 'His first three shots walk in toward the police cars. The fourth will not miss.',
      'Range about 800 m, wind 6 m/s and gusting. Hold for both.', 'The helicopter drowns out your shot. Do not waste it on a mirror.',
      vargaHelps(f) ? 'Varga is pinned behind the cars with her officers. She will tell you what she can see.' : 'Varga\'s officers are pinned behind the cars. Nobody down there knows you are helping.'];
  },
  wind: { v: 6, gust: 2.5 }, par: 1,
  rules: { destroy: ['rook'], protect: ['off1', 'off2', 'off3', 'varga'], time: 36.5, aftermath: 3.4, timeText: 'His fourth shot did not miss.' },
  vantages: [{ name: 'Gasworks stack', desc: 'Down river and high up. 800 m to the bridge, with the wind across you.', eye: [0, 52, 0] }],
  look: [0, 26],
  testFlags: [{}, { sparedReyes: true }, { savedBrandt: true }],
  setup(K2, f) {
    const H = SCN.bridge({ zb: 800, refZ: 800, time: 'dusk', seed: 9, bounds: { x0: -118, x1: 118, y0: 4, y1: 78 } });
    const shots = [9, 18, 27, 36];
    H.shots = shots;
    const flare = (t) => { for (let i = 0; i < shots.length; i++) { const d = shots[i] - t; if (d > 0.35 && d < 2.35) return Math.sin(((2.35 - d) / 2.0) * Math.PI); } return 0; };
    const mirror = (sim, ob) => { sim.msg('Pip', 'That was a mirror. He hung those for you. Look for the slow one.'); };
    H.rook = K.lens(H.S, H.PRn, 63.3, 56.78, { id: 'rook', look: 'rook', face: -1, flashFn: flare, onHit(sim, ob) { ob.deadT = sim.t; sim.msg('Pip', 'Glass! You broke his scope. He is pulling back. He is gone.'); } });
    K.lens(H.S, H.PRn, -60.4, 54.4, { id: 'm1', look: 'mirror', rate: 0.83, phase: 0.1, onHit: mirror });
    K.lens(H.S, H.PRn, -24, H.cableY(-24) - 0.6, { id: 'm2', look: 'mirror', rate: 1.3, phase: 0.5, onHit: mirror });
    K.lens(H.S, H.PRn, 60.7, H.D + 8.4, { id: 'm3', look: 'mirror', rate: 0.61, phase: 0.7, onHit: mirror });
    K.lens(H.S, H.PO, 105.2, H.b.chand.roofY + 0.9 + 4.0, { id: 'm4', look: 'mirror', rate: 1.05, phase: 0.3, onHit: mirror });
    if (!vargaHelps(f)) K.lens(H.S, H.PRn, 63.5, 43.4, { id: 'm5', look: 'mirror', rate: 0.72, phase: 0.9, onHit: mirror });
    K.parked(H.S, H.PR, 'sedan', -7, 1, '#27365a', { y: H.D, layer: 0 }); K.parked(H.S, H.PR, 'sedan', 3.5, -1, '#27365a', { y: H.D, layer: 0 });
    K.parked(H.S, H.PR, 'van', -34, 1, '#d9dde2', { y: H.D, layer: 0 }); K.parked(H.S, H.PR, 'sedan', -45, 1, '#7a2e2e', { y: H.D, layer: 0 });
    H.PAir = H.S.plane(H.zb + 70, 'air');
    K.thing(H.S, H.PRn, 'duck', 66.6, 6.32); // on the stone pier of the right-hand tower
    return H;
  },
  cast(H, f) {
    const pinned = (id, x, anim, face, look, fail) => Object.assign(H.deck(x), { id, role: 'hostage', face, anim, look, failText: fail, lostText: 'His fourth shot did not miss. One of Varga\'s people is down, and Aurel is in the air.', routine: [['wait', 999, anim, face]] });
    const c = [
      pinned('off1', -9.6, 'kneel', 1, POLICE, POLICE_FAIL), pinned('off2', -4.2, 'cower', 1, POLICE, POLICE_FAIL), pinned('off3', 6.2, 'kneel', 1, POLICE, POLICE_FAIL),
      Object.assign(H.deck(-36.5), { id: 'cv1', role: 'civ', face: 1, anim: 'cower', look: { coat: COL.tan, hair: 'short' }, curious: false, routine: [['wait', 999, 'cower', 1]] }),
      Object.assign(H.deck(-47.4), { id: 'cv2', role: 'civ', face: 1, anim: 'cower', look: { hair: 'long', dress: COL.wine }, curious: false, routine: [['wait', 999, 'cower', 1]] }),
    ];
    if (vargaHelps(f)) c.push(pinned('varga', 0.9, 'kneel', 1, { hair: 'bun', hairCol: '#2a2019', glasses: true, coat: '#4a4f58', long: true }, 'You shot Detective Varga.'));
    return c;
  },
  vehicles(H) {
    return [{ id: 'heli', kind: 'bheli', plane: H.PAir, x: 150, y: 30, dir: -1, col: '#1d2026', routine: [['wait', 1.5], ['drive', -330, 9], ['gone']], yFn: (x) => 30 + clamp((150 - x) * 0.17, 0, 70), st: { glass: [], flat: [], moving: true } }];
  },
  triggers(H, f) {
    const hits = [[4.4, 1.25, 'glass'], [8.2, 0.12, 'hard'], [-5.8, 0.75, 'metal']];
    const t = [{ at: 0.5, do(sim) { sim.cover(90, 'helicopter'); } },
      hint(1.5, 'Several lights are flashing on the bridge. All but one are mirrors, and they blink quickly and evenly. A real scope flares once, slowly, just before it fires. Watch, then shoot the flare itself.', 12),
      say(11, 'Pip', 'That shot came from high up. Did you see the flare before it? The mirrors never stop. The scope only shows when he means it.'),
      say(28.5, 'Pip', 'That one was a hand away from them. He has the range. The next one is the last.'),
    ];
    H.shots.forEach((at, i) => t.push({ at, do(sim) {
      const L = H.rook; if (!L.alive || sim.winAt || sim.failInfo) return;
      L.flashT = sim.t; sim.ev.push({ k: 'npcshot', x: L.x - 1, y: L.y - 1.4 }); sim.emit('rook_shot' + (i + 1));
      sim.after(0.2, () => {
        if (i < 3) { const q = hits[i]; sim.ev.push({ k: 'impact', x: q[0], y: H.D + q[1], z: H.PR.z, plane: H.PR, mat: q[2] === 'glass' ? 'metal' : q[2], tof: 0.2, dist: 800 }); if (q[2] === 'glass') sim.ev.push({ k: 'glass', x: q[0], y: H.D + q[1], plane: H.PR }); }
        else { const v = sim.byId.off2; if (v && !v.dead) { sim.killActor(v, 'torso', 'npc', null); sim.emit('executed:off2'); } }
      });
    } }));
    if (vargaHelps(f)) { t.push(say(4, 'Varga', 'Varga. We are pinned behind the cars and I cannot see him. If that is you out there, Kestrel, find him.')); t.push(say(19.5, 'Varga', 'It is coming from the right-hand tower as you look at it. High. That is all I have.')); }
    else t.push(say(4, 'Pip', 'Varga\'s officers are behind the cars on the deck. They do not know you are there. Find him anyway.'));
    return t;
  },
  challenge: { id: 'second', text: 'Break his scope before he fires a second time', test: (sim) => sim.emitted['obj:rook'] !== undefined && sim.emitted['obj:rook'] < 18 },
  after: 'You have not said a word since. Three shots walked in, low, then left, then true, with one slow breath between each. You told me once that only one man ever shot like that, and that he died at Harrow Ridge. Kestrel. Rook did not die at Harrow Ridge.',
  solve: [['until', (s) => s.did('rook_shot1'), 30], ['wait', 0.6], ['hold'], ['shootObj', 'rook']],
  reward: { cr: 5200, xp: 1000 },
});
