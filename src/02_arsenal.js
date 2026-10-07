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
    desc: 'A built-in laser rangefinder. The exact distance to whatever is under the crosshair is printed in the glass.' },
  { id: 'tree', name: 'Kestrel Tree 6-24x', zoom: [6, 24], ret: 'tree', turret: true, price: 7500, rank: 6,
    desc: 'A grid of dots spreading out below the crosshair like a pine tree, for holding drop and wind at the same time.' },
  { id: 'comp', name: 'Meridian 8-32x', zoom: [8, 32], ret: 'fine', turret: true, price: 11000, rank: 7,
    desc: 'Competition glass. Enormous magnification and a hair-thin reticle marked every fifth of a mil. Narrow view: easy to get lost in.' },
  { id: 'oracle', name: 'Oracle 5-25x Smart', zoom: [5, 25], ret: 'milhash', lrf: true, smart: true, turret: true, price: 18000, rank: 8,
    desc: 'A ballistic computer in a scope. It measures range and wind and draws a small amber diamond where the bullet will land. Put the diamond on the target.' },
];

// ---- parts ----------------------------------------------------------------
// mod keys: swayMul recoilMul v0Mul kMul dispMul cycleMul reloadMul noiseMul
//           handAdd breathAdd magMul panMul penAdd, plus flags.
const PARTS = [
  // muzzle
  { id: 'mz_none', slot: 'muzzle', name: 'Bare muzzle', price: 0, rank: 1, mod: {}, desc: 'Nothing fitted. Loud and simple.' },
  { id: 'mz_flash', slot: 'muzzle', name: 'Birdcage flash hider', price: 250, rank: 1, mod: { recoilMul: 0.92 },
    desc: 'Takes a little of the jump out of the shot. Still loud.' },
  { id: 'mz_brake', slot: 'muzzle', name: 'Tanker brake', price: 700, rank: 2, mod: { recoilMul: 0.62, noiseMul: 1.25 },
    desc: 'Vents gas sideways. The scope stays nearly on target. Even louder than bare.' },
  { id: 'mz_supl', slot: 'muzzle', name: 'Featherweight suppressor', price: 1100, rank: 2, mod: { quiet: true, crack: 34, v0Mul: 0.99, recoilMul: 0.9 }, needsSupp: true,
    desc: 'Kills the bang. People near the target still hear the bullet crack past unless it is slower than sound.' },
  { id: 'mz_suph', slot: 'muzzle', name: 'Monolith suppressor', price: 3600, rank: 5, mod: { quiet: true, crack: 20, swayMul: 0.94, recoilMul: 0.8, handAdd: -0.1 }, needsSupp: true,
    desc: 'A long, heavy can. Quieter, steadier, less recoil. Makes the rifle slower to swing.' },
  // barrel
  { id: 'br_std', slot: 'barrel', name: 'Factory barrel', price: 0, rank: 1, mod: {}, desc: 'What it left the factory with.' },
  { id: 'br_short', slot: 'barrel', name: 'Carbine barrel', price: 500, rank: 2, mod: { v0Mul: 0.94, handAdd: 0.15, swayMul: 1.05, noiseMul: 1.1 },
    desc: 'Shorter. Quicker to swing and settle, but the bullet leaves slower and drops more.' },
  { id: 'br_heavy', slot: 'barrel', name: 'Bull barrel', price: 1600, rank: 3, mod: { swayMul: 0.88, dispMul: 0.75, v0Mul: 1.02, handAdd: -0.12 },
    desc: 'Thick and stiff. Tighter groups, steadier hold, a touch more speed. Heavy to move.' },
  { id: 'br_carbon', slot: 'barrel', name: 'Carbon-wrapped barrel', price: 5200, rank: 6, mod: { swayMul: 0.93, dispMul: 0.7, v0Mul: 1.03, handAdd: 0.08 },
    desc: 'Bull-barrel accuracy at half the weight. The expensive answer.' },
  // stock
  { id: 'st_std', slot: 'stock', name: 'Factory stock', price: 0, rank: 1, mod: {}, desc: 'Does the job.' },
  { id: 'st_skel', slot: 'stock', name: 'Skeleton stock', price: 550, rank: 2, mod: { handAdd: 0.2, recoilMul: 1.12 },
    desc: 'Cut down to a frame. Fast to settle after you move. Kicks more.' },
  { id: 'st_cheek', slot: 'stock', name: 'Marksman stock', price: 1300, rank: 3, mod: { breathAdd: 1.6, swayMul: 0.93 },
    desc: 'A raised cheek rest lets you relax into the rifle. You can hold your breath noticeably longer.' },
  { id: 'st_chassis', slot: 'stock', name: 'Precision chassis', price: 3400, rank: 5, mod: { swayMul: 0.8, recoilMul: 0.88, handAdd: -0.05 },
    desc: 'A rigid aluminium frame with everything adjustable. Much steadier.' },
  // support
  { id: 'sp_none', slot: 'support', name: 'Rest on the pack', price: 0, rank: 1, mod: {}, desc: 'Your rucksack under the fore-end. Free.' },
  { id: 'sp_bag', slot: 'support', name: 'Sand sock', price: 300, rank: 1, mod: { swayMul: 0.86 },
    desc: 'A small bag of sand under the stock. Cheap, and it helps more than it should.' },
  { id: 'sp_bipod', slot: 'support', name: 'Folding bipod', price: 1400, rank: 3, mod: { swayMul: 0.64, panMul: 0.85, handAdd: -0.1 },
    desc: 'Two legs under the barrel. A big gain in steadiness. A little slower to swing.' },
  { id: 'sp_tripod', slot: 'support', name: 'Crow\'s-nest tripod', price: 4800, rank: 6, mod: { swayMul: 0.48, panMul: 0.7, handAdd: -0.22 },
    desc: 'The rifle clamps into a carbon tripod. Rock steady. Slow to swing, and it takes a moment to settle after a move.' },
  // ammo
  { id: 'am_ball', slot: 'ammo', name: 'Standard ball', price: 0, rank: 1, mod: {}, desc: 'Ordinary full-power ammunition.' },
  { id: 'am_match', slot: 'ammo', name: 'Match grade', price: 800, rank: 2, mod: { dispMul: 0.6, kMul: 0.93 },
    desc: 'Hand-weighed. Tighter groups and it holds its speed a little better.' },
  { id: 'am_sub', slot: 'ammo', name: 'Subsonic', price: 900, rank: 3, mod: { sub: true }, cals: ['c308', 'c762r', 'c65', 'c556', 'c8mm'],
    desc: 'Loaded slower than sound. With a suppressor it is completely silent. The drop is enormous: think lobbing, not shooting.' },
  { id: 'am_ap', slot: 'ammo', name: 'Armour piercing', price: 1500, rank: 4, mod: { penAdd: 0.8, kMul: 1.04 },
    desc: 'A hardened core. Goes straight through window glass without being knocked off line, and through thin cover like car doors and wooden fences.' },
  { id: 'am_heavy', slot: 'ammo', name: 'Low-drag heavy', price: 1900, rank: 5, mod: { v0Mul: 0.95, kMul: 0.78 },
    desc: 'A longer, heavier bullet. Leaves slower but keeps its speed. Much less wind drift at long range.' },
  { id: 'am_tracer', slot: 'ammo', name: 'Tracer', price: 400, rank: 1, mod: { tracer: true },
    desc: 'Burns bright all the way to the target so you can watch the arc. The best teacher for learning drop and wind.' },
  // trigger
  { id: 'tr_std', slot: 'trigger', name: 'Factory trigger', price: 0, rank: 1, mod: {}, desc: 'A firm pull that nudges the rifle a hair as it breaks.' },
  { id: 'tr_match', slot: 'trigger', name: 'Two-stage match trigger', price: 1700, rank: 4, mod: { jerkMul: 0.3 },
    desc: 'Breaks like a glass rod. The shot goes where the crosshair was, not where your finger pulled it.' },
  // action
  { id: 'ac_std', slot: 'action', name: 'Factory action', price: 0, rank: 1, mod: {}, desc: 'Unmodified.' },
  { id: 'ac_slick', slot: 'action', name: 'Polished action', price: 1200, rank: 3, mod: { cycleMul: 0.72, reloadMul: 0.88 },
    desc: 'Hand-polished rails and a lighter spring. The next round is ready sooner.' },
  // magazine
  { id: 'mg_std', slot: 'mag', name: 'Factory magazine', price: 0, rank: 1, mod: {}, desc: 'Standard capacity.' },
  { id: 'mg_ext', slot: 'mag', name: 'Extended magazine', price: 900, rank: 3, mod: { magMul: 1.6 }, needsMag: true,
    desc: 'More rounds before you have to reload.' },
  { id: 'mg_quick', slot: 'mag', name: 'Speed-pull magazine', price: 700, rank: 2, mod: { reloadMul: 0.7 }, needsMag: true,
    desc: 'A loop on the base for a faster change.' },
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
    if (m.jerkMul) st.jerk *= m.jerkMul;
    if (m.quiet) { st.quiet = true; st.crack = m.crack; }
    if (m.tracer) st.tracer = true;
    if (m.sub) st.sub = true;
  });
  if (st.sub) {
    // Subsonic loads: slow, heavy, quiet. Also much less recoil.
    st.v0 = Math.min(st.v0, 318); st.k *= 0.55; st.recoil *= 0.5; st.eff = Math.min(st.eff, 280); st.noise *= 0.55;
  }
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

CB.GUNS = GUNS; CB.SCOPES = SCOPES; CB.PARTS = PARTS; CB.buildStats = buildStats;
