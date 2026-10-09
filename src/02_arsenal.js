// ---------------------------------------------------------------------------
// The arsenal: rifles, parts, ammunition. Every number here changes how the
// rifle actually behaves in the scope. Nothing is a reskin.
//
//   v0       muzzle speed in metres per second (faster = less lead, less drop)
//   k        drag (bigger = sheds speed sooner, drops more, drifts more in wind)
//   disp     how tight the rifle groups, in mils (smaller = more exact)
//   sway     how much the crosshair wanders, in mils
//   recoil   how far the scope jumps when fired, in mils
//   cycle    seconds before the next shot is ready
//   noise    distance in metres at which an unsuppressed shot causes panic
//   pen      punch: 1 goes clean through glass, 1.4 through thin cover,
//            3 through a wall
//   eff      the range the rifle is honestly good to
// ---------------------------------------------------------------------------
const GUNS = [
  {
    id: 'fenwick', name: 'Fenwick 77', maker: 'Fenwick & Sons', cal: 'c308', calName: '.308',
    action: 'bolt', mag: 4, reload: 3.2, cycle: 1.45, v0: 790, k: 0.00076, disp: 0.16, sway: 0.95, recoil: 9,
    handling: 0.55, noise: 520, supp: true, eff: 600, pen: 0.6, zero: 100, scope: 'hunter',
    price: 0, rank: 1,
    blurb: 'A walnut deer rifle with a few thousand rounds through it. Honest, forgiving, a little slow on the bolt. It came with you from the army and it still shoots straighter than most people talk.',
  },
  {
    id: 'ratter', name: 'Tarn Ratter', maker: 'Tarn Arms', cal: 'c22', calName: '.22 rimfire',
    action: 'semi', mag: 10, reload: 2.2, cycle: 0.32, v0: 328, k: 0.0011, disp: 0.22, sway: 1.05, recoil: 1.6,
    handling: 0.9, noise: 0, supp: 'integral', eff: 170, pen: 0, zero: 50, scope: 'hunter',
    price: 900, rank: 1,
    blurb: 'A farm gun for barn rats, with a moderator built into the barrel. The bullet is slower than sound, so nobody hears a thing. It drops like a thrown stone, the wind bullies it, and it will not get through window glass. Inside 150 metres it is a ghost.',
  },
  {
    id: 'kessler', name: 'Kessler 98', maker: 'Kessler Werke', cal: 'c8mm', calName: '8 mm',
    action: 'bolt', mag: 5, reload: 3.6, cycle: 1.7, v0: 760, k: 0.00084, disp: 0.24, sway: 1.1, recoil: 12,
    handling: 0.45, noise: 600, supp: false, eff: 500, pen: 0.7, zero: 100, scope: 'zf4', scopeLock: true,
    price: 1400, rank: 2,
    blurb: 'Eighty years old and still angry. A fixed four-power scope with an old post sight, a stiff bolt, and a kick like a dropped anvil. The muzzle was never cut for a suppressor.',
  },
  {
    id: 'lark', name: 'Lark DMR-5', maker: 'Lark Defense', cal: 'c556', calName: '5.56',
    action: 'semi', mag: 20, reload: 2.4, cycle: 0.26, v0: 930, k: 0.00118, disp: 0.2, sway: 0.9, recoil: 3.2,
    handling: 0.85, noise: 460, supp: true, eff: 520, pen: 0.3, zero: 100, scope: 'ranger',
    price: 2600, rank: 2,
    blurb: 'Light, fast and flat. Follow-up shots are almost instant and the scope barely moves. The small bullet runs out of breath past 400 metres and a stiff breeze pushes it around.',
  },
  {
    id: 'whisper', name: 'Vesper Whisper', maker: 'Vesper Works', cal: 'c300s', calName: '.300 subsonic',
    action: 'bolt', mag: 5, reload: 3.0, cycle: 1.25, v0: 312, k: 0.00042, disp: 0.15, sway: 0.85, recoil: 4.5,
    handling: 0.65, noise: 0, supp: 'integral', eff: 260, pen: 0.5, zero: 100, scope: 'ranger',
    price: 4200, rank: 3,
    blurb: 'The whole barrel is a suppressor. It throws a heavy bullet slower than sound, so there is no bang and no crack. The bullet flies like a mortar: learn the drop or stay close.',
  },
  {
    id: 'orlov', name: 'Orlov SVK', maker: 'Orlov Arsenal', cal: 'c762r', calName: '7.62 rimmed',
    action: 'semi', mag: 10, reload: 2.8, cycle: 0.42, v0: 830, k: 0.00078, disp: 0.3, sway: 1.0, recoil: 7.5,
    handling: 0.7, noise: 560, supp: true, eff: 700, pen: 0.7, zero: 100, scope: 'pso',
    price: 4800, rank: 3,
    blurb: 'A long, thin battle rifle from across the border. Ten quick shots of full-power rifle. It is not a tack driver, and its strange scope has a ladder for judging distance that rewards learning.',
  },
  {
    id: 'halden', name: 'Halden Patrol', maker: 'Halden Precision', cal: 'c308', calName: '.308',
    action: 'bolt', mag: 5, reload: 3.0, cycle: 1.2, v0: 805, k: 0.00072, disp: 0.09, sway: 0.68, recoil: 7,
    handling: 0.5, noise: 520, supp: true, eff: 850, pen: 0.6, zero: 100, scope: 'ranger',
    price: 6500, rank: 4,
    blurb: 'The police marksman rifle. A heavy barrel in a stiff chassis: it sits still and puts every bullet where the last one went. Not exciting. Extremely reliable.',
  },
  {
    id: 'hush', name: 'Hush VSK-9', maker: 'Orlov Arsenal', cal: 'c9s', calName: '9 mm heavy subsonic',
    action: 'semi', mag: 10, reload: 2.5, cycle: 0.3, v0: 292, k: 0.00055, disp: 0.28, sway: 0.92, recoil: 3.6,
    handling: 0.88, noise: 0, supp: 'integral', eff: 300, pen: 0.9, zero: 100, scope: 'pso',
    price: 7800, rank: 4,
    blurb: 'Silent and semi-automatic. Ten heavy slugs as fast as you can press, and none of them make a sound. The arc is steep and the reach is short. For several targets close together, nothing else comes near it.',
  },
  {
    id: 'marrow', name: 'Marrow Scout 6.5', maker: 'Marrow Rifle Co.', cal: 'c65', calName: '6.5 mm',
    action: 'bolt', mag: 5, reload: 2.8, cycle: 1.05, v0: 835, k: 0.0005, disp: 0.1, sway: 0.82, recoil: 5.5,
    handling: 0.75, noise: 500, supp: true, eff: 950, pen: 0.6, zero: 100, scope: 'ranger',
    price: 9200, rank: 5,
    blurb: 'A slim mountain rifle firing a long needle of a bullet. It cuts through wind better than rifles twice its size and kicks like a polite handshake. Light, so it wanders a little more.',
  },
  {
    id: 'corvid', name: 'Corvid SR-10', maker: 'Corvid Systems', cal: 'c308', calName: '.308',
    action: 'semi', mag: 10, reload: 2.6, cycle: 0.36, v0: 795, k: 0.00074, disp: 0.14, sway: 0.8, recoil: 6.2,
    handling: 0.7, noise: 540, supp: true, eff: 750, pen: 0.6, zero: 100, scope: 'tac',
    price: 11500, rank: 5,
    blurb: 'A semi-automatic .308 built for suppressors. Bolt-rifle accuracy with a second shot ready before the first one lands.',
  },
  {
    id: 'ibex', name: 'Ibex Takedown', maker: 'Marrow Rifle Co.', cal: 'c65', calName: '6.5 mm',
    action: 'single', mag: 1, reload: 2.1, cycle: 0.4, v0: 850, k: 0.00049, disp: 0.06, sway: 0.74, recoil: 5.8,
    handling: 0.8, noise: 500, supp: true, eff: 1000, pen: 0.6, zero: 100, scope: 'tac',
    price: 12500, rank: 6,
    blurb: 'It comes apart into a briefcase and goes together in ninety seconds. One round in the chamber, and that is all. The most exact rifle in the rack, for people who do not plan to need a second shot.',
  },
  {
    id: 'vantage', name: 'Vantage 300 Magnum', maker: 'Halden Precision', cal: 'c300m', calName: '.300 magnum',
    action: 'bolt', mag: 4, reload: 3.2, cycle: 1.3, v0: 905, k: 0.00057, disp: 0.1, sway: 0.75, recoil: 12.5,
    handling: 0.5, noise: 700, supp: true, eff: 1150, pen: 0.9, zero: 100, scope: 'tac',
    price: 15000, rank: 6,
    blurb: 'A magnum: more powder, more speed, more everything. The bullet arrives sooner and falls less. The price is a hard shove in the shoulder and a scope that takes a moment to come back down.',
  },
  {
    id: 'northwind', name: 'Northwind 338', maker: 'Northwind Armory', cal: 'c338', calName: '.338',
    action: 'bolt', mag: 5, reload: 3.4, cycle: 1.4, v0: 890, k: 0.00043, disp: 0.08, sway: 0.62, recoil: 14,
    handling: 0.4, noise: 820, supp: true, eff: 1400, pen: 1.2, zero: 100, scope: 'tac',
    price: 21000, rank: 7,
    blurb: 'Built for shots measured in kilometres. Heavy enough to sit like a rock, and the big bullet shrugs off wind. Goes clean through glass. Slow to swing, slow to cycle.',
  },
  {
    id: 'anvil', name: 'Bishop Anvil .50', maker: 'Bishop Heavy', cal: 'c50', calName: '.50',
    action: 'bolt', mag: 5, reload: 4.2, cycle: 1.9, v0: 855, k: 0.00035, disp: 0.12, sway: 0.5, recoil: 24,
    handling: 0.25, noise: 1300, supp: false, eff: 1600, pen: 3, zero: 100, scope: 'tac',
    price: 28000, rank: 8,
    blurb: 'An anti-materiel rifle. It goes through walls, engine blocks and most arguments. Everyone within a kilometre will know you fired, and the scope leaves the county for a full second afterwards.',
  },
  {
    id: 'aria', name: 'Longbow Aria .408', maker: 'Longbow Extreme', cal: 'c408', calName: '.408',
    action: 'bolt', mag: 7, reload: 3.6, cycle: 1.5, v0: 935, k: 0.00032, disp: 0.05, sway: 0.56, recoil: 13,
    handling: 0.35, noise: 880, supp: true, eff: 1900, pen: 1.5, zero: 100, scope: 'tree',
    price: 34000, rank: 9,
    blurb: 'The flattest, calmest long-range rifle ever made. A solid-copper bullet that is still supersonic at two kilometres. If you can see it and you can read the wind, the Aria can reach it.',
  },
  {
    id: 'stormglass', name: 'Stormglass X1', maker: 'Aurel Dynamics', cal: 'crail', calName: 'coil slug',
    action: 'charge', mag: 3, reload: 4.5, cycle: 2.4, v0: 2600, k: 0.00022, disp: 0.05, sway: 0.7, recoil: 5,
    handling: 0.45, noise: 950, supp: false, eff: 2200, pen: 3.2, zero: 300, scope: 'tac',
    price: 0, rank: 1, special: 'story',
    blurb: 'A prototype that was never supposed to leave the Aurel lab. Magnets instead of powder. The slug barely drops and barely needs lead. It needs two seconds to charge and cracks like lightning.',
  },
];

// ---- scopes ---------------------------------------------------------------
const SCOPES = [
  { id: 'hunter', name: 'Fieldmaster 3-9x', zoom: [3, 9], ret: 'duplex', price: 0, rank: 1,
    desc: 'A plain hunting scope. Thick posts, fine centre, no markings. You hold over by feel.' },
  { id: 'zf4', name: 'ZF Fixed 4x', zoom: [4, 4], ret: 'post', price: 0, rank: 1, only: 'kessler',
    desc: 'The Kessler\'s original glass. Fixed at four power with a pointed post. The tip is your aiming point.' },
  { id: 'ranger', name: 'Ranger 4-12x Mil-Dot', zoom: [4, 12], ret: 'mildot', price: 600, rank: 2,
    desc: 'Dots along the crosshair, each exactly one mil apart. Count dots to hold for drop and wind.' },
  { id: 'bdc', name: 'Pathfinder 3-12x BDC', zoom: [3, 12], ret: 'bdc', bdc: true, price: 1500, rank: 3,
    desc: 'Marks below the crosshair labelled in hundreds of metres, matched to whatever rifle and ammo it sits on. Put the 4 on a target at 400 metres.' },
  { id: 'pso', name: 'PSO-K 4-9x', zoom: [4, 9], ret: 'pso', bdc: true, price: 1200, rank: 3,
    desc: 'Chevrons for holdover and a curved ladder for judging distance: fit a standing man between the base line and the curve and read the number.' },
  { id: 'tac', name: 'Halden TAC 5-20x', zoom: [5, 20], ret: 'milhash', turret: true, price: 3200, rank: 4,
    desc: 'Fine hash marks every half mil, numbered. Adds a zero dial: set it to the target\'s distance and aim dead on.' },
  { id: 'night', name: 'Nightjar NV 3-10x', zoom: [3, 10], ret: 'mildot', nv: true, price: 4200, rank: 4,
    desc: 'Night vision. Turns a dark scene into green daylight, so unlit targets stand out. Washes out near bright lamps.' },
  { id: 'lrf', name: 'Corvus LRF 4-16x', zoom: [4, 16], ret: 'milhash', lrf: true, turret: true, price: 5200, rank: 5,
    desc: 'A built-in laser rangefinder. The exact distance to whatever is under the crosshair is printed in the glass. Tap MARK with the crosshair on a target and its distance stays locked, so the numbers stay right when you aim high.' },
  { id: 'tree', name: 'Kestrel Tree 6-24x', zoom: [6, 24], ret: 'tree', turret: true, price: 7500, rank: 6,
    desc: 'A grid of dots spreading out below the crosshair like a pine tree, for holding drop and wind at the same time.' },
  { id: 'comp', name: 'Meridian 8-32x', zoom: [8, 32], ret: 'fine', turret: true, price: 11000, rank: 7,
    desc: 'Competition glass. Enormous magnification and a hair-thin reticle marked every fifth of a mil. Narrow view: easy to get lost in.' },
  { id: 'oracle', name: 'Oracle 5-25x Smart', zoom: [5, 25], ret: 'milhash', lrf: true, smart: true, turret: true, price: 18000, rank: 8,
    desc: 'A ballistic computer in a scope. It measures range and wind and draws a small amber diamond where the bullet will land. Put the diamond on the target. Tap MARK on a target to lock its distance: the diamond stays right for it however you move the scope.' },
];

// ---- parts ----------------------------------------------------------------
// mod keys: swayMul recoilMul v0Mul kMul dispMul cycleMul reloadMul noiseMul
//           handAdd breathAdd magMul panMul penAdd jerkMul effMul, plus flags.
//   penMax  the most punch a load can have, whatever else is fitted (a soft
//           point that opens up and stays in the body)
//   effMul  changes the honest range of the rifle (a much faster load)
// Which rifles a part fits:
//   guns: [...]   only these rifles (parts made for one rifle or one family)
//   cals: [...]   only these calibres
//   not: [...]    every rifle the general rules allow, except these
// The factory parts (price 0) fit everything and change nothing.
const PARTS = [
  // muzzle
  { id: 'mz_none', slot: 'muzzle', name: 'Bare muzzle', price: 0, rank: 1, mod: {}, desc: 'Nothing fitted. Loud and simple.' },
  { id: 'mz_flash', slot: 'muzzle', name: 'Birdcage flash hider', price: 250, rank: 1, mod: { recoilMul: 0.92 }, not: ['kessler', 'anvil'],
    desc: 'Takes a little of the jump out of the shot. Still loud.' },
  { id: 'mz_brake', slot: 'muzzle', name: 'Tanker brake', price: 700, rank: 2, mod: { recoilMul: 0.62, noiseMul: 1.25 }, not: ['kessler', 'anvil'],
    desc: 'Vents gas sideways. The scope stays nearly on target. Even louder than bare.' },
  { id: 'mz_supl', slot: 'muzzle', name: 'Featherweight suppressor', price: 1100, rank: 2, mod: { quiet: true, crack: 34, v0Mul: 0.99, recoilMul: 0.9 }, needsSupp: true,
    desc: 'Kills the bang. People near the target still hear the bullet crack past unless it is slower than sound.' },
  { id: 'mz_suph', slot: 'muzzle', name: 'Monolith suppressor', price: 3600, rank: 5, mod: { quiet: true, crack: 20, swayMul: 0.94, recoilMul: 0.8, handAdd: -0.1 }, needsSupp: true,
    desc: 'A long, heavy can. Quieter, steadier, less recoil. Makes the rifle slower to swing.' },
  { id: 'mz_comp', slot: 'muzzle', name: 'Three-port compensator', price: 600, rank: 2, mod: { recoilMul: 0.76, noiseMul: 1.12, handAdd: 0.03 }, guns: ['lark', 'orlov', 'corvid'],
    desc: 'Ports cut in the top push the muzzle back down as each shot goes, so the scope settles sooner for the next one. Louder than bare, not as loud as a brake.' },
  { id: 'mz_ol_can', slot: 'muzzle', name: 'Orlov service can', price: 750, rank: 3, mod: { quiet: true, crack: 34, recoilMul: 0.86, dispMul: 1.15, handAdd: -0.06 }, guns: ['orlov'],
    desc: 'The factory\'s own suppressor: long, cheap and a little loose on its mount. Kills the bang and softens the kick, but the groups open up and the rifle swings slower.' },
  { id: 'mz_rad', slot: 'muzzle', name: 'Radial brake', price: 2600, rank: 7, mod: { recoilMul: 0.55, noiseMul: 1.35, handAdd: -0.03 }, guns: ['vantage', 'northwind', 'aria'],
    desc: 'Rings of small holes all the way round, made for the big magnums. The scope hardly moves when it fires, so you see your own hit. Louder than anything else you can screw on.' },
  { id: 'mz_av_hammer', slot: 'muzzle', name: 'Hammerhead brake', price: 2200, rank: 8, mod: { recoilMul: 0.68, noiseMul: 1.15, handAdd: -0.04 }, guns: ['anvil'],
    desc: 'Two big chambers that throw the blast out sideways. The scope comes back to the target far sooner than with the factory brake. Even louder, and heavier on the nose.' },
  { id: 'mz_av_cone', slot: 'muzzle', name: 'Blast cone', price: 2600, rank: 8, mod: { noiseMul: 0.72, recoilMul: 1.15 }, guns: ['anvil'],
    desc: 'A forward cone that sends the blast down range instead of out to the sides. The panic does not spread as far, though the shot is still heard a long way off. Without a brake it kicks even harder.' },
  { id: 'mz_rt_long', slot: 'muzzle', name: 'Long moderator', price: 600, rank: 1, mod: { swayMul: 0.92, dispMul: 0.85, handAdd: -0.1 }, guns: ['ratter'],
    desc: 'A longer built-in moderator. The extra weight at the front calms the barrel: steadier and tighter groups, but slower to swing. Still silent.' },
  { id: 'mz_wh_short', slot: 'muzzle', name: 'Shorty can', price: 1100, rank: 3, mod: { handAdd: 0.14, swayMul: 1.06, recoilMul: 1.12 }, guns: ['whisper'],
    desc: 'A cut-down built-in suppressor. The rifle is shorter and much quicker to bring onto a target. Less weight up front means more wobble and more kick. Still silent.' },
  { id: 'mz_hs_short', slot: 'muzzle', name: 'Short can', price: 1200, rank: 4, mod: { handAdd: 0.12, panMul: 1.08, swayMul: 1.07 }, guns: ['hush'],
    desc: 'A shorter suppressor for close work. Quick to swing from one target to the next. A little less steady. Still silent.' },
  { id: 'mz_sg_damper', slot: 'muzzle', name: 'Field damper', price: 2400, rank: 5, mod: { noiseMul: 0.7, v0Mul: 0.94, handAdd: -0.06 }, guns: ['stormglass'],
    desc: 'A ring of magnets at the end of the rails that soaks up the lightning crack. Heard over a much smaller area. It also drags on the slug a little, and it is heavy.' },
  // barrel
  { id: 'br_std', slot: 'barrel', name: 'Factory barrel', price: 0, rank: 1, mod: {}, desc: 'What it left the factory with.' },
  { id: 'br_short', slot: 'barrel', name: 'Carbine barrel', price: 500, rank: 2, mod: { v0Mul: 0.94, handAdd: 0.15, swayMul: 1.05, noiseMul: 1.1 }, not: ['kessler'],
    desc: 'Shorter. Quicker to swing and settle, but the bullet leaves slower and drops more.' },
  { id: 'br_heavy', slot: 'barrel', name: 'Bull barrel', price: 1600, rank: 3, mod: { swayMul: 0.88, dispMul: 0.75, v0Mul: 1.02, handAdd: -0.12 }, not: ['kessler'],
    desc: 'Thick and stiff. Tighter groups, steadier hold, a touch more speed. Heavy to move.' },
  { id: 'br_carbon', slot: 'barrel', name: 'Carbon-wrapped barrel', price: 5200, rank: 6, mod: { swayMul: 0.93, dispMul: 0.7, v0Mul: 1.03, handAdd: 0.08 }, not: ['kessler'],
    desc: 'Bull-barrel accuracy at half the weight. The expensive answer.' },
  { id: 'br_k_select', slot: 'barrel', name: 'Selected marksman barrel', price: 1100, rank: 2, mod: { dispMul: 0.72 }, guns: ['kessler'],
    desc: 'In the old armoury the straightest-shooting barrels were set aside for marksmen and marked with a ring. This is one of them. Tighter groups and nothing else. There are very few left.' },
  { id: 'br_long', slot: 'barrel', name: 'Long-range barrel', price: 3800, rank: 7, mod: { v0Mul: 1.04, handAdd: -0.14, swayMul: 1.03, noiseMul: 0.92 }, guns: ['vantage', 'northwind', 'aria'],
    desc: 'Ten centimetres more barrel for a magnum. The bullet leaves faster, so less drop and less wind at long range, and the bang is a little softer. Long, and slow to swing.' },
  { id: 'br_flute', slot: 'barrel', name: 'Fluted mountain barrel', price: 2400, rank: 5, mod: { handAdd: 0.12, dispMul: 0.86, swayMul: 1.04 }, guns: ['marrow', 'ibex'],
    desc: 'Grooves milled down its length take the weight out and keep it stiff. Tighter groups and quicker to settle, but a lighter rifle wanders a little more.' },
  { id: 'cl_dense', slot: 'barrel', name: 'Dense-wound coils', price: 4200, rank: 6, mod: { dispMul: 0.7, v0Mul: 1.06, recoilMul: 1.3, cycleMul: 1.12 }, guns: ['stormglass'],
    desc: 'More windings on every coil, so each slug is pushed harder and straighter. Tighter groups and even flatter. Each shot drains more, so it kicks harder and takes longer to be ready again.' },
  // stock
  { id: 'st_std', slot: 'stock', name: 'Factory stock', price: 0, rank: 1, mod: {}, desc: 'Does the job.' },
  { id: 'st_skel', slot: 'stock', name: 'Skeleton stock', price: 550, rank: 2, mod: { handAdd: 0.2, recoilMul: 1.12 }, not: ['kessler', 'orlov', 'hush'],
    desc: 'Cut down to a frame. Fast to settle after you move. Kicks more.' },
  { id: 'st_cheek', slot: 'stock', name: 'Marksman stock', price: 1300, rank: 3, mod: { breathAdd: 1.6, swayMul: 0.93 },
    desc: 'A raised cheek rest lets you relax into the rifle. You can hold your breath noticeably longer.' },
  { id: 'st_chassis', slot: 'stock', name: 'Precision chassis', price: 3400, rank: 5, mod: { swayMul: 0.8, recoilMul: 0.88, handAdd: -0.05 }, not: ['kessler', 'orlov', 'hush'],
    desc: 'A rigid aluminium frame with everything adjustable. Much steadier.' },
  { id: 'st_k_pad', slot: 'stock', name: 'Laced cheek pad', price: 500, rank: 2, mod: { breathAdd: 1.1, swayMul: 0.96 }, guns: ['kessler'],
    desc: 'A leather pad laced onto the stock, the way the old marksmen did it. Your cheek sits higher behind the scope, so you can hold your breath a little longer.' },
  { id: 'st_thumb', slot: 'stock', name: 'Thumbhole stock', price: 1500, rank: 3, mod: { swayMul: 0.9, recoilMul: 0.94, handAdd: -0.08, breathAdd: 0.4 }, guns: ['fenwick', 'whisper', 'marrow'],
    desc: 'A deep stock with a hole for your thumb, so your hand sits upright. Steadier and softer to shoot, and a little more breath. Heavier to swing.' },
  { id: 'st_ol_poly', slot: 'stock', name: 'Orlov polymer stock', price: 1000, rank: 3, mod: { breathAdd: 0.9, recoilMul: 0.9, swayMul: 0.96, handAdd: -0.03 }, guns: ['orlov'],
    desc: 'The later black stock, with a cheek riser and a rubber butt. Softer to shoot and you can hold your breath longer. A little heavier than the wood.' },
  { id: 'st_ol_fold', slot: 'stock', name: 'Orlov folding stock', price: 800, rank: 3, mod: { handAdd: 0.16, panMul: 1.08, swayMul: 1.08, breathAdd: -0.5 }, guns: ['orlov', 'hush'],
    desc: 'A steel tube stock that folds along the side. The rifle comes up and swings fast, but there is little to rest your cheek on: more wobble and a shorter breath.' },
  // support
  { id: 'sp_none', slot: 'support', name: 'Rest on the pack', price: 0, rank: 1, mod: {}, desc: 'Your rucksack under the fore-end. Free.' },
  { id: 'sp_bag', slot: 'support', name: 'Sand sock', price: 300, rank: 1, mod: { swayMul: 0.86 },
    desc: 'A small bag of sand under the stock. Cheap, and it helps more than it should.' },
  { id: 'sp_bipod', slot: 'support', name: 'Folding bipod', price: 1400, rank: 3, mod: { swayMul: 0.64, panMul: 0.85, handAdd: -0.1 }, not: ['kessler'],
    desc: 'Two legs under the barrel. A big gain in steadiness. A little slower to swing.' },
  { id: 'sp_tripod', slot: 'support', name: 'Crow\'s-nest tripod', price: 4800, rank: 6, mod: { swayMul: 0.48, panMul: 0.7, handAdd: -0.22 }, not: ['kessler'],
    desc: 'The rifle clamps into a carbon tripod. Rock steady. Slow to swing, and it takes a moment to settle after a move.' },
  { id: 'sp_sling', slot: 'support', name: 'Leather sling', price: 350, rank: 1, mod: { swayMul: 0.91, handAdd: 0.06 }, guns: ['fenwick', 'ratter', 'kessler', 'whisper', 'orlov', 'marrow'],
    desc: 'Loop it round your arm and pull it tight. Steadier than nothing, and because it moves with you, you settle quickly after a swing.' },
  { id: 'sp_sticks', slot: 'support', name: 'Shooting sticks', price: 750, rank: 2, mod: { swayMul: 0.74, panMul: 0.94, handAdd: -0.04 }, not: ['anvil'],
    desc: 'Two crossed poles with the rifle in the fork. A good step up from a sand sock. Swinging far means shuffling the sticks.' },
  { id: 'sp_rearbag', slot: 'support', name: 'Rear squeeze bag', price: 1100, rank: 4, mod: { swayMul: 0.8, breathAdd: 0.6, panMul: 0.92 }, guns: ['halden', 'vantage'],
    desc: 'A bag with two ears under the back of the stock. Squeeze it to raise the crosshair a hair. Steadier, and a calmer hold means a longer breath. Not as steady as a bipod.' },
  { id: 'sp_hs_grip', slot: 'support', name: 'Forward grip', price: 600, rank: 4, mod: { swayMul: 0.88, handAdd: 0.1, panMul: 1.05 }, guns: ['hush'],
    desc: 'An upright grip under the fore-end. Steadier than holding the wood, and the rifle swings and settles quickly. For close, fast work.' },
  { id: 'sp_av_mono', slot: 'support', name: 'Bipod and rear monopod', price: 3200, rank: 8, mod: { swayMul: 0.52, panMul: 0.78, handAdd: -0.16 }, guns: ['anvil'],
    desc: 'A heavy bipod in front and a screw-down leg under the butt. Nearly as steady as a tripod and quicker to move, but still slow.' },
  // ammo
  { id: 'am_ball', slot: 'ammo', name: 'Standard ball', price: 0, rank: 1, mod: {}, desc: 'Ordinary full-power ammunition.' },
  { id: 'am_match', slot: 'ammo', name: 'Match grade', price: 800, rank: 2, mod: { dispMul: 0.6, kMul: 0.93 },
    desc: 'Hand-weighed. Tighter groups and it holds its speed a little better.' },
  { id: 'am_sub', slot: 'ammo', name: 'Subsonic', price: 900, rank: 3, mod: { sub: true }, cals: ['c308', 'c762r', 'c65', 'c556', 'c8mm'],
    desc: 'Loaded slower than sound. With a suppressor it is completely silent. The drop is enormous: think lobbing, not shooting.' },
  { id: 'am_ap', slot: 'ammo', name: 'Armour piercing', price: 1500, rank: 4, mod: { penAdd: 0.8, kMul: 1.04 }, not: ['ratter'],
    desc: 'A hardened core. Goes straight through window glass without being knocked off line, and through thin cover like car doors and wooden fences.' },
  { id: 'am_heavy', slot: 'ammo', name: 'Low-drag heavy', price: 1900, rank: 5, mod: { v0Mul: 0.95, kMul: 0.78 },
    desc: 'A longer, heavier bullet. Leaves slower but keeps its speed. Much less wind drift at long range.' },
  { id: 'am_tracer', slot: 'ammo', name: 'Tracer', price: 400, rank: 1, mod: { tracer: true },
    desc: 'Burns bright all the way to the target so you can watch the arc. The best teacher for learning drop and wind.' },
  { id: 'am_hmatch', slot: 'ammo', name: 'Heavy match', price: 1500, rank: 4, mod: { dispMul: 0.66, kMul: 0.86, v0Mul: 0.95, recoilMul: 1.08 }, cals: ['c308', 'c65'],
    desc: 'A heavier bullet loaded with match care. Nearly as tight as match grade and better in the wind, but it leaves slower and pushes harder.' },
  { id: 'am_77', slot: 'ammo', name: 'Heavy 5.56 match', price: 800, rank: 2, mod: { kMul: 0.8, v0Mul: 0.93, recoilMul: 1.12, dispMul: 0.9 }, cals: ['c556'],
    desc: 'The heaviest bullet the little cartridge can take. It keeps its speed much further out and the wind bothers it less. Slower off the muzzle, with a sharper kick.' },
  { id: 'am_7n1', slot: 'ammo', name: 'Steel-core sniper load', price: 900, rank: 3, mod: { dispMul: 0.7, penAdd: 0.2, kMul: 0.97 }, cals: ['c762r'],
    desc: 'The Orlov\'s own marksman ammunition, with a steel core. Tighter groups, and a little more punch through glass. Not as tight as match grade.' },
  { id: 'am_22hv', slot: 'ammo', name: 'Hyper-velocity .22', price: 300, rank: 1, mod: { v0Mul: 1.36, kMul: 1.08, penAdd: 0.2, effMul: 1.3 }, cals: ['c22'],
    desc: 'A light bullet driven faster than sound. Much flatter, a longer reach, and it gets through window glass, though knocked off line. The cost: people near the target hear the bullet crack.' },
  { id: 'am_300sup', slot: 'ammo', name: 'Supersonic .300', price: 1400, rank: 3, mod: { v0Mul: 2.3, kMul: 1.6, recoilMul: 1.5, penAdd: 0.1, effMul: 1.8 }, cals: ['c300s'],
    desc: 'A light bullet at full speed instead of the heavy slow one. More than twice as fast, so the drop shrinks and the reach nearly doubles. No longer silent: the bullet cracks past people near the target.' },
  { id: 'am_300red', slot: 'ammo', name: 'Reduced magnum load', price: 900, rank: 6, mod: { v0Mul: 0.88, recoilMul: 0.65, noiseMul: 0.85 }, cals: ['c300m'],
    desc: 'Less powder in the big case. Much kinder on the shoulder and not as loud, so the scope comes back quickly. It shoots like an ordinary rifle: more drop and more wind.' },
  { id: 'am_slap', slot: 'ammo', name: 'Saboted penetrator', price: 2400, rank: 8, mod: { v0Mul: 1.22, kMul: 0.92, dispMul: 1.7, recoilMul: 0.92 }, cals: ['c50'],
    desc: 'A thin tungsten dart in a plastic sleeve (a sabot) that falls away at the muzzle. Very fast and very flat, but the sleeve does not always let go cleanly: groups are much wider.' },
  { id: 'am_sp', slot: 'ammo', name: 'Bonded soft point', price: 900, rank: 7, mod: { penAdd: -0.15, penMax: 1.1, kMul: 1.05 }, cals: ['c338', 'c408'],
    desc: 'Opens up inside the target and stays there, so it never goes on into someone standing behind. The price: it no longer gets through car doors or fences, and it drops a touch more.' },
  { id: 'am_sg_hollow', slot: 'ammo', name: 'Hollow slug', price: 1800, rank: 5, mod: { penMax: 1.1, recoilMul: 0.7, cycleMul: 0.85 }, guns: ['stormglass'],
    desc: 'A lighter slug with a hollow core. It needs less charge, so it is ready sooner and kicks less. It no longer goes through walls, cover or people.' },
  // trigger
  { id: 'tr_std', slot: 'trigger', name: 'Factory trigger', price: 0, rank: 1, mod: {}, desc: 'A firm pull that nudges the rifle a hair as it breaks.' },
  { id: 'tr_match', slot: 'trigger', name: 'Two-stage match trigger', price: 1700, rank: 4, mod: { jerkMul: 0.3 }, not: ['kessler'],
    desc: 'Breaks like a glass rod. The shot goes where the crosshair was, not where your finger pulled it.' },
  { id: 'tr_set', slot: 'trigger', name: 'Double set trigger', price: 900, rank: 2, mod: { jerkMul: 0.18, cycleMul: 1.12 }, guns: ['kessler'],
    desc: 'Pull the back trigger to set the front one, which then goes off at a touch. A very clean shot, but setting it costs a moment every time.' },
  // action
  { id: 'ac_std', slot: 'action', name: 'Factory action', price: 0, rank: 1, mod: {}, desc: 'Unmodified.' },
  { id: 'ac_slick', slot: 'action', name: 'Polished action', price: 1200, rank: 3, mod: { cycleMul: 0.72, reloadMul: 0.88 }, not: ['kessler'],
    desc: 'Hand-polished rails and a lighter spring. The next round is ready sooner.' },
  { id: 'ac_k_bent', slot: 'action', name: 'Turned-down bolt', price: 450, rank: 2, mod: { cycleMul: 0.84 }, guns: ['kessler'],
    desc: 'The bolt handle bent down out of the way of the scope, as was done for the marksmen. Your hand finds it sooner, so the next round is ready a little sooner.' },
  { id: 'ac_gas', slot: 'action', name: 'Adjustable gas block', price: 900, rank: 3, mod: { recoilMul: 0.84, cycleMul: 1.15 }, guns: ['lark', 'orlov', 'hush', 'corvid'],
    desc: 'Turns down the gas that works the action, so it cycles more gently. Less kick, but a slower follow-up shot.' },
  { id: 'ac_ib_breech', slot: 'action', name: 'Quick-load breech', price: 2200, rank: 6, mod: { reloadMul: 0.72, handAdd: -0.05 }, guns: ['ibex'],
    desc: 'A sprung lever that throws the empty case clear and opens the breech wide. Loading the next round is much quicker. The extra steel makes it a little heavier.' },
  { id: 'cp_fast', slot: 'action', name: 'Fast-charge capacitors', price: 3400, rank: 5, mod: { cycleMul: 0.68, recoilMul: 1.1, handAdd: -0.05 }, guns: ['stormglass'],
    desc: 'Bigger capacitors (the parts that store the charge) that refill much faster. The next slug is ready far sooner. They discharge harder and weigh more.' },
  // magazine
  { id: 'mg_std', slot: 'mag', name: 'Factory magazine', price: 0, rank: 1, mod: {}, desc: 'Standard capacity.' },
  { id: 'mg_ext', slot: 'mag', name: 'Extended magazine', price: 900, rank: 3, mod: { magMul: 1.6 }, needsMag: true, not: ['kessler'],
    desc: 'More rounds before you have to reload.' },
  { id: 'mg_quick', slot: 'mag', name: 'Speed-pull magazine', price: 700, rank: 2, mod: { reloadMul: 0.7 }, needsMag: true, not: ['kessler'],
    desc: 'A loop on the base for a faster change.' },
  { id: 'mg_k_clip', slot: 'mag', name: 'Stripper clips', price: 250, rank: 2, mod: { reloadMul: 0.62 }, guns: ['kessler'],
    desc: 'Five rounds on a steel strip, pushed down into the rifle with one thumb instead of one at a time. Much quicker to reload.' },
  { id: 'mg_k_trench', slot: 'mag', name: 'Trench magazine', price: 900, rank: 3, mod: { magMul: 4, reloadMul: 1.6, handAdd: -0.12, swayMul: 1.04 }, guns: ['kessler'],
    desc: 'A big drum from the old trenches that holds twenty. Bulky: the rifle is heavier and slower to swing, and filling it takes an age.' },
  { id: 'mg_drum', slot: 'mag', name: 'Drum magazine', price: 1600, rank: 4, mod: { magMul: 2.5, reloadMul: 1.35, handAdd: -0.12, swayMul: 1.05 }, guns: ['lark', 'corvid'],
    desc: 'A round drum that holds two and a half times as many. Heavy under the rifle: slower to swing, more wobble, and slow to change.' },
  { id: 'mg_ol_20', slot: 'mag', name: 'Orlov 20-round box', price: 1000, rank: 3, mod: { magMul: 2, reloadMul: 1.1, handAdd: -0.05 }, guns: ['orlov', 'hush'],
    desc: 'A long steel box that holds twice as many. Heavier than the factory one and a touch slower to change.' },
];

const SLOTS = [
  { id: 'scope', name: 'Scope' }, { id: 'muzzle', name: 'Muzzle' }, { id: 'barrel', name: 'Barrel' },
  { id: 'stock', name: 'Stock' }, { id: 'support', name: 'Support' }, { id: 'ammo', name: 'Ammunition' },
  { id: 'trigger', name: 'Trigger' }, { id: 'action', name: 'Action' }, { id: 'mag', name: 'Magazine' },
];

const GUN_BY_ID = {}; GUNS.forEach((g) => { GUN_BY_ID[g.id] = g; });
const SCOPE_BY_ID = {}; SCOPES.forEach((s) => { SCOPE_BY_ID[s.id] = s; });
const PART_BY_ID = {}; PARTS.forEach((p) => { PART_BY_ID[p.id] = p; });

function defaultConfig(gunId) {
  const g = GUN_BY_ID[gunId];
  return { scope: g.scope, muzzle: 'mz_none', barrel: 'br_std', stock: 'st_std', support: 'sp_none', ammo: 'am_ball', trigger: 'tr_std', action: 'ac_std', mag: 'mg_std', skin: 'factory' };
}

// Can this part go on this rifle?
function partFits(part, gun) {
  if (!part || !gun) return false;
  if (part.guns) return part.guns.indexOf(gun.id) >= 0; // made for these rifles: the general rules below do not apply
  if (part.not && part.not.indexOf(gun.id) >= 0) return false;
  if (part.needsSupp && gun.supp !== true) return false;
  if (part.slot === 'muzzle' && gun.supp === 'integral' && part.id !== 'mz_none') return false;
  if (part.slot === 'muzzle' && gun.action === 'charge' && part.id !== 'mz_none') return false;
  if (part.slot === 'barrel' && (gun.supp === 'integral' || gun.action === 'charge') && part.id !== 'br_std') return false;
  if (part.needsMag && (gun.action === 'single' || gun.action === 'charge')) return false;
  if (part.slot === 'action' && part.id !== 'ac_std' && (gun.action === 'single' || gun.action === 'charge')) return false;
  if (part.cals && part.cals.indexOf(gun.cal) < 0) return false;
  if (part.slot === 'ammo' && gun.action === 'charge' && part.id !== 'am_ball') return false;
  if (part.id === 'am_sub' && gun.supp === 'integral') return false;
  return true;
}
function scopeFits(scope, gun) {
  if (gun.scopeLock) return scope.id === gun.scope;
  if (scope.only) return scope.only === gun.id;
  return true;
}

// Turn a rifle plus its fitted parts into the final numbers the game uses.
function buildStats(gunId, cfg) {
  const g = GUN_BY_ID[gunId];
  cfg = Object.assign(defaultConfig(gunId), cfg || {});
  const st = {
    id: g.id, name: g.name, gun: g, cfg, action: g.action, cal: g.cal,
    v0: g.v0, k: g.k, disp: g.disp, sway: g.sway, recoil: g.recoil, cycle: g.cycle, reload: g.reload,
    mag: g.mag, handling: g.handling, noise: g.noise, pen: g.pen, eff: g.eff, zero: g.zero,
    breath: 4.6, pan: 1, jerk: 0.16, quiet: g.supp === 'integral', crack: g.supp === 'integral' ? 16 : 0,
    tracer: false, sub: false,
  };
  let penMax = Infinity;
  ['muzzle', 'barrel', 'stock', 'support', 'ammo', 'trigger', 'action', 'mag'].forEach((slot) => {
    const p = PART_BY_ID[cfg[slot]];
    if (!p || !partFits(p, g)) return;
    const m = p.mod;
    if (m.swayMul) st.sway *= m.swayMul;
    if (m.recoilMul) st.recoil *= m.recoilMul;
    if (m.v0Mul) st.v0 *= m.v0Mul;
    if (m.kMul) st.k *= m.kMul;
    if (m.dispMul) st.disp *= m.dispMul;
    if (m.cycleMul) st.cycle *= m.cycleMul;
    if (m.reloadMul) st.reload *= m.reloadMul;
    if (m.noiseMul) st.noise *= m.noiseMul;
    if (m.handAdd) st.handling += m.handAdd;
    if (m.breathAdd) st.breath += m.breathAdd;
    if (m.magMul) st.mag = Math.max(st.mag + 1, Math.round(st.mag * m.magMul));
    if (m.panMul) st.pan *= m.panMul;
    if (m.penAdd) st.pen += m.penAdd;
    if (m.penMax !== undefined) penMax = Math.min(penMax, m.penMax);
    if (m.effMul) st.eff = Math.round(st.eff * m.effMul);
    if (m.jerkMul) st.jerk *= m.jerkMul;
    if (m.quiet) { st.quiet = true; st.crack = m.crack; }
    if (m.tracer) st.tracer = true;
    if (m.sub) st.sub = true;
  });
  if (st.sub) {
    // Subsonic loads: slow, heavy, quiet. Also much less recoil.
    st.v0 = Math.min(st.v0, 318); st.k *= 0.55; st.recoil *= 0.5; st.eff = Math.min(st.eff, 280); st.noise *= 0.55;
  }
  if (penMax < st.pen) st.pen = penMax;
  st.handling = clamp(st.handling, 0.1, 1.2);
  st.subsonic = st.v0 < SOUND;
  st.silent = st.quiet && st.subsonic;
  if (st.quiet) st.noise = 0;
  if (st.silent) st.crack = 0;
  let sc = SCOPE_BY_ID[cfg.scope] || SCOPE_BY_ID[g.scope];
  if (!scopeFits(sc, g)) sc = SCOPE_BY_ID[g.scope];
  st.scope = sc;
  st.zoomMin = sc.zoom[0]; st.zoomMax = sc.zoom[1];
  st.zeroAng = Bal.zeroAngle(st, st.zero);
  return st;
}

// Simple 0..1 ratings for the stat bars in the armory.
function statBars(st) {
  const d500 = Bal.dope(st, st.zeroAng, 500, 4);
  return {
    reach: clamp(st.eff / 2000, 0.05, 1),
    flat: clamp(1 - (d500.reached ? d500.dropMil : 60) / 30, 0.03, 1),
    wind: clamp(1 - (d500.reached ? Math.abs(d500.driftMil) : 6) / 3.2, 0.03, 1),
    steady: clamp(1 - (st.sway - 0.2) / 1.1, 0.03, 1),
    exact: clamp(1 - st.disp / 0.34, 0.03, 1),
    calm: clamp(1 - st.recoil / 26, 0.03, 1),
    rate: clamp(1 - (st.cycle - 0.2) / 2.2, 0.03, 1),
    quiet: st.silent ? 1 : st.quiet ? 0.72 : clamp(0.45 - st.noise / 2900, 0.03, 0.45),
  };
}

CB.GUNS = GUNS; CB.SCOPES = SCOPES; CB.PARTS = PARTS; CB.buildStats = buildStats; CB.partFits = partFits; CB.scopeFits = scopeFits; CB.statBars = statBars;
