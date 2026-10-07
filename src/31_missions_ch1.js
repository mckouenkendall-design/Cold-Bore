// ---------------------------------------------------------------------------
// Chapter 1: COLD START. Port Calder, the Brickworks district.
// ---------------------------------------------------------------------------
mission({
  id: 'c1m1', ch: 1, title: 'Rent Day', range: 160,
  objective: 'Find the collector with the red hat band. One shot.',
  brief: 'Welcome back to work, Kestrel. Easy one to start. A collector for the Calloway crew works Brickworks every Friday, taking "rent" from shopkeepers who never agreed to a landlord. Tonight is his last round. He wears a hat with a red band and never lets go of his case. Wait until he is alone under a street lamp or nobody is looking his way. Do not hit anyone else.',
  intel: ['Grey coat, dark hat with a RED band, brown case.', 'He stops for a cigarette outside the deli.', 'Range about 160 m. No wind to speak of.'],
  wind: { v: 0.4, gust: 0.4 }, par: 1, rules: { kill: ['t'] },
  vantages: [{ name: 'Tannery roof', desc: 'Straight across the street. Clear view.', eye: [0, 16, 0] }],
  look: [10, 3],
  setup(K2) { return SCN.street({ z: 155, time: 'dusk', seed: 3 }); },
  cast(H) {
    return [
      Object.assign(H.street(44), { id: 't', role: 'target', face: -1, look: { hat: 'fedora', hatCol: '#22252b', hatBand: COL.red, coat: COL.grey, long: true, bag: 'case' },
        routine: [['walk', 14], ['wait', 9, 'smoke'], ['walk', -8], ['wait', 5, 'phone'], ['walk', -30], ['wait', 3], ['walk', -48], ['gone']] }),
      Object.assign(H.street(-12), { id: 'c1', role: 'civ', look: { hat: 'fedora', hatCol: '#5a4634', coat: COL.tan, bag: 'paper' }, anim: 'stand', routine: [['wait', 14, 'stand'], ['walk', -46], ['gone']] }),
      Object.assign(H.street(25), { id: 'c2', role: 'civ', look: { hair: 'long', dress: COL.wine, bag: 'shopping' }, face: -1, routine: [['wait', 4, 'phone'], ['walk', 46], ['gone']] }),
    ];
  },
  triggers(H) { return [hint(1, 'Drag to move the scope. Slide ZOOM up to look closer. Find the man with the red hat band.'), hint(13, 'The crosshair drifts as you breathe. Tap HOLD BREATH to steady it, then FIRE.')]; },
  challenge: { id: 'head', text: 'Finish it with a headshot', test: (sim) => sim.kills.some((k) => k.id === 't' && k.part === 'head') },
  solve: [['wait', 18], ['shoot', 't', 'head']],
  reward: { cr: 500, xp: 150 },
});
