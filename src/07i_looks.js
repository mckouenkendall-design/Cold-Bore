// ---------------------------------------------------------------------------
// Each mission's own look. Missions at one location share a scene and often a time of day,
// so on their own they would all look alike: eight navy nights downtown, five at the docks,
// eight copies of one chalet and its meadow. A look gives a mission its own place and moment
// (moonlit blue, sodium orange, neon on wet streets, golden hour, autumn, first light) by
// changing only how things are drawn:
//   pal       palette colours (never dark, litChance, star or fogD: see KX_PAL_COLOURS)
//   lampCol   the colour of the street lamps' light (sodium, white LED), on people too
//   sky       for 06b_sky.js: top, mid, bot, glow colours; heaps, cirrus, deck (how much of each
//             kind of cloud, 0 to 1); moon (phase 0 new .. 0.5 full .. 1 new); stars (how many
//             the town's glow leaves); milky (a Milky Way); rays; cloudCols; drift (cloud speed)
//   grade     a colour wash over the finished picture (06c_air.js): { top, bot, a, warm, glow }
//   wet       the ground still wet from rain (puddles that mirror the lights)
//   dress     which dressing variant a location uses (autumn, frost, flowers, neon...)
// S.time, S.weather and everything a mission is made of stay exactly as they were.
// ---------------------------------------------------------------------------
const LOOKS = {
  // ---- chapter 1: Brickworks, one street ----
  c1m1: { name: 'amber dusk', pal: { skyTop: '#2b2a5c', skyBot: '#f59a52', fog: '#c08670', amb: '#3e2c4e' }, sky: { mid: '#8a4e72', heaps: 0.5, cirrus: 0.9 }, grade: { bot: '#ff9a4a', a: 0.1, glow: 0.18 } },
  c1m2: { name: 'moonlit blue', pal: { skyTop: '#040a1e', skyBot: '#1d3462', fog: '#17284e', amb: '#0a1632', water: '#10224a' }, lampCol: '#ffb860', sky: { moon: 0.5, stars: 0.7, heaps: 0.25, cirrus: 0.5, cloudCols: { lit: '#8a9cc6', body: '#22304f' } }, grade: { top: '#2a4a9a', a: 0.12 } },
  c1m3: { name: 'thunder on wet brick', pal: { skyTop: '#06080f', skyBot: '#1e2234', fog: '#181c2a', amb: '#0a0c16' }, lampCol: '#ffd590', sky: { stars: 0 }, wet: 1, grade: { top: '#3a4a7a', a: 0.1 } },
  c1m4: { name: 'spring morning', pal: { skyTop: '#2a78d4', skyBot: '#c4e2f6' }, sky: { heaps: 0.85, cirrus: 0.5 }, grade: { warm: 0.06, a: 0.08 } },
  c1m5: { name: 'violet smog', pal: { skyTop: '#1d1a46', skyBot: '#d4807c', fog: '#9e6c82', amb: '#2e2448' }, sky: { mid: '#5e3e78', heaps: 0.25, cirrus: 1, rays: true }, grade: { bot: '#c86a9a', a: 0.1, glow: 0.12 } },
  c1m6: { name: 'sodium orange', pal: { skyTop: '#0b0a14', skyBot: '#3e2c2c', fog: '#2c2228', amb: '#160f16' }, lampCol: '#ffaa50', sky: { mid: '#1a1420', heaps: 0.5, stars: 0.25, cityGlow: 1.6, cloudCols: { lit: '#4a3a3a', body: '#2a2026', shade: '#1c161c', under: '#5a3826' } }, grade: { bot: '#ff8a30', a: 0.1 } },
  c1m7: { name: 'frosty and clear', pal: { skyTop: '#01040c', skyBot: '#0e1c36', fog: '#0c1830', amb: '#040a18' }, lampCol: '#e6eeff', sky: { moon: 0.18, stars: 1.3, heaps: 0, cirrus: 0.3 }, grade: { top: '#4a6aaa', a: 0.1 }, dress: 'frost' },
  // ---- chapter 2: the docks ----
  c2m1: { name: 'golden harbour', pal: { skyTop: '#2a2f60', skyBot: '#ffa448', fog: '#c88a66', amb: '#4a2e3c', sun: '#ffd27a', water: '#5a5a84' }, sky: { mid: '#a05a62', heaps: 0.45, cirrus: 1 }, grade: { bot: '#ffa040', a: 0.12, glow: 0.22 } },
  c2m2: { name: 'sodium docks under low cloud', pal: { skyTop: '#0c0a12', skyBot: '#3a2a2a', fog: '#2a2026', amb: '#150e14', water: '#1a1418' }, lampCol: '#ffa64c', sky: { heaps: 0, deck: 0.7, stars: 0, cityGlow: 1.8, cloudCols: { lit: '#4a3632', body: '#2c2024', shade: '#1e161a', under: '#6a4026' } }, grade: { bot: '#ff8a30', a: 0.12 } },
  c2m3: { name: 'first light in fog', pal: { skyTop: '#6a6e8c', skyBot: '#efd2c4', fog: '#dcc8c0', amb: '#7a6a80' }, sky: { mid: '#b8a2b0', heaps: 0, cirrus: 0 }, grade: { top: '#f0c8c8', a: 0.08 } },
  c2m4: { name: 'full moon on the water', pal: { skyTop: '#030a1e', skyBot: '#1e3666', fog: '#182a50', amb: '#0a1834', water: '#12264e' }, sky: { moon: 0.5, stars: 0.8, heaps: 0.3, cirrus: 0.6, cloudCols: { lit: '#9aaad0', body: '#24324f' } }, grade: { top: '#3a5aaa', a: 0.12 } },
  c2m5: { name: 'neon in the rain', pal: { skyTop: '#07061a', skyBot: '#2a1a44', fog: '#22183c', amb: '#120a26', water: '#1a1230' }, lampCol: '#dce6ff', sky: { stars: 0 }, wet: 1, grade: { top: '#8a3aaa', bot: '#2aa0c0', a: 0.11 } },
  c2m6: { name: 'dark of the moon', pal: { skyTop: '#010208', skyBot: '#0a142a', fog: '#0a1428', amb: '#03070f', water: '#08101e' }, lampCol: '#c8f0d8', sky: { moon: 0.04, stars: 1.4, milky: 0.8, heaps: 0, cirrus: 0.2 }, grade: { top: '#1a3a5a', a: 0.1 } },
  c2m7: { name: 'storm', pal: { skyTop: '#05070c', skyBot: '#1a2030', fog: '#141a26', amb: '#080a12' }, sky: { stars: 0 }, wet: 1, grade: { top: '#2a3a5a', a: 0.12 } },
  // ---- chapter 3: the valley ----
  c3m1: { name: 'high summer', pal: { skyTop: '#246fce', skyBot: '#bfe0f6' }, sky: { heaps: 0.75, cirrus: 0.6 }, grade: { a: 0.06, warm: 0.04 }, dress: 'summer' },
  c3m2: { name: 'wind and broken cloud', pal: { skyTop: '#3478c4', skyBot: '#cddfe8', fog: '#c2d2dc' }, sky: { heaps: 1, cirrus: 0.4, drift: 3.5 }, grade: { a: 0.06 }, dress: 'windy' },
  c3m8: { name: 'cold first light', pal: { skyTop: '#2e4a7c', skyBot: '#ead2c6', fog: '#c9c4cc', amb: '#56688a' }, sky: { mid: '#8a8aaa', heaps: 0.3, cirrus: 0.8 }, grade: { top: '#8aa0d0', a: 0.08 }, dress: 'frost' },
  c3m3: { name: 'autumn', pal: { skyTop: '#3a82cc', skyBot: '#d8e6ee', grass: '#8f8a46', amb: '#ffe0b0', ambT: 0.06 }, sky: { heaps: 0.6, cirrus: 0.7 }, grade: { warm: 0.1, a: 0.08 }, dress: 'autumn' },
  c3m4: { name: 'late afternoon gold', pal: { skyTop: '#3a7cc8', skyBot: '#f0e2c4', fog: '#e0d2b8', amb: '#ffd29a', ambT: 0.1 }, sky: { heaps: 0.5, cirrus: 0.9, glow: '#fff0d0' }, grade: { warm: 0.14, a: 0.1, glow: 0.12 }, dress: 'hay' },
  c3m5: { name: 'whiteout', sky: { deck: 1 }, grade: { top: '#c8d8ea', a: 0.06 } },
  c3m6: { name: 'alpenglow', pal: { skyTop: '#384a84', skyBot: '#f6b2a4', fog: '#dcb4b2', amb: '#6e5a7c' }, sky: { mid: '#a07aa0', heaps: 0.35, cirrus: 1 }, grade: { bot: '#ff9a8a', a: 0.1, glow: 0.1 }, dress: 'dew' },
  c3m7: { name: 'hot August afternoon', pal: { skyTop: '#4688c6', skyBot: '#e6ecee', fog: '#d6dcdc', grass: '#8a9e48', amb: '#fff0d0', ambT: 0.06 }, sky: { heaps: 0.4, cirrus: 0.3, glow: '#f6f2e6' }, grade: { warm: 0.1, a: 0.08 }, dress: 'hay', heat: 1 },
  // ---- chapter 4: downtown at night ----
  c4m1: { name: 'blue hour offices', pal: { skyTop: '#060c22', skyBot: '#1e3a6a', fog: '#18305a', amb: '#08142c' }, lampCol: '#e4ecff', sky: { mid: '#102044', stars: 0.3, heaps: 0.3, cityGlow: 0.8, glow: '#2a4a80' }, grade: { top: '#3a6ad0', a: 0.1 } },
  c4m2: { name: 'power cut under the moon', pal: { skyTop: '#02040c', skyBot: '#101c34', fog: '#0e1a30', amb: '#050a16' }, sky: { moon: 0.55, stars: 1.1, milky: 0.4, heaps: 0.2, cityGlow: 0.2, cloudCols: { lit: '#8a9ac0' } }, grade: { top: '#2a4a8a', a: 0.1 } },
  c4m3: { name: 'party neon', pal: { skyTop: '#0c0620', skyBot: '#3a1a4a', fog: '#2a183c', amb: '#140a24' }, lampCol: '#ffd0e8', sky: { mid: '#1e0e32', stars: 0.2, heaps: 0.35, cityGlow: 1.2, cloudCols: { under: '#5a2a5a', body: '#24142e' } }, grade: { top: '#b04ab0', bot: '#4a2ad0', a: 0.1 }, dress: 'neon' },
  c4m4: { name: 'sodium haze over the site', pal: { skyTop: '#0e0a10', skyBot: '#46302a', fog: '#3a2a26', amb: '#1a1210' }, lampCol: '#ffa64a', sky: { mid: '#22161a', stars: 0.1, heaps: 0, deck: 0.5, cityGlow: 2, cloudCols: { lit: '#5a3e30', body: '#2e2020', shade: '#20161a', under: '#7a4a2a' } }, grade: { bot: '#ff9030', a: 0.12 } },
  c4m5: { name: 'after the rain', pal: { skyTop: '#040812', skyBot: '#1a2638', fog: '#16202e', amb: '#080e18' }, lampCol: '#ffd9a0', sky: { stars: 0.4, heaps: 0.55, cityGlow: 1, cloudCols: { under: '#3a3440' } }, wet: 0.8, grade: { top: '#3a5a8a', a: 0.08 } },
  c4m6: { name: 'green mist', pal: { skyTop: '#03080a', skyBot: '#12302e', fog: '#12302c', amb: '#051412' }, lampCol: '#c8ffe0', sky: { mid: '#081a1c', stars: 0.15, heaps: 0, deck: 0.45, cityGlow: 1.2, cloudCols: { lit: '#3a5a52', body: '#16282a', shade: '#0e1c1e', under: '#2a4a40' } }, grade: { top: '#2a8a7a', a: 0.1 } },
  c4m7: { name: 'neon storm', pal: { skyTop: '#06051a', skyBot: '#24183e', fog: '#1e1636', amb: '#100a22' }, lampCol: '#d8e4ff', sky: { stars: 0 }, wet: 1, grade: { top: '#7a3ab0', bot: '#2a8ac0', a: 0.12 }, dress: 'neon' },
  c4m8: { name: 'before dawn', pal: { skyTop: '#0a0c26', skyBot: '#4a2e4a', fog: '#2e2240', amb: '#140e24' }, lampCol: '#ffd090', sky: { mid: '#1e1a40', glow: '#a05a50', stars: 0.6, moon: 0.92, heaps: 0.2, cirrus: 0.8, cloudCols: { lit: '#c08070', body: '#2e2440', under: '#3a2a3a' } }, grade: { bot: '#ff7a5a', a: 0.08 } },
  // ---- chapter 5 ----
  c5m1: { name: 'industrial sunset', pal: { skyTop: '#2a1e44', skyBot: '#f0884a', fog: '#b0705e', amb: '#3a2440' }, sky: { mid: '#9a4a5e', heaps: 0.3, cirrus: 1 }, grade: { bot: '#ff8a3a', a: 0.12, glow: 0.18 } },
  c5m2: { name: 'golden afternoon', pal: { skyTop: '#2f70c4', skyBot: '#ece2c8', fog: '#d8d2bc', amb: '#ffd8a0', ambT: 0.06 }, sky: { heaps: 0.55, cirrus: 0.7, glow: '#fff4dc' }, grade: { top: '#3f6fb8', bot: '#ffb060', warm: 0.05, a: 0.09, glow: 0.1 }, heat: 0.6 },
  c5m3: { name: 'moonlit river', pal: { skyTop: '#030a1c', skyBot: '#1a3060', fog: '#16284c', amb: '#0a1632', water: '#10224a' }, sky: { moon: 0.45, stars: 0.9, milky: 0.35, heaps: 0.25, cirrus: 0.5, cloudCols: { lit: '#8a9cc6' } }, grade: { top: '#3a5aaa', a: 0.1 } },
  c5m4: { name: 'grey rain', sky: { deck: 1 }, wet: 1, grade: { top: '#9aa8b8', a: 0.06 } },
  c5m5: { name: 'storm over the house', pal: { skyTop: '#04060c', skyBot: '#161c2a', fog: '#121824', amb: '#06080e' }, sky: { stars: 0 }, wet: 1, grade: { top: '#2a3a5a', a: 0.12 } },
  c5m6: { name: 'pink dusk', pal: { skyTop: '#2a2a5c', skyBot: '#f29aa0', fog: '#c08a9a', amb: '#3a2c52' }, sky: { mid: '#8a5a8e', heaps: 0.5, cirrus: 0.9 }, grade: { bot: '#ff8aa0', a: 0.1, glow: 0.14 } },
  c5m7: { name: 'red sunset', pal: { skyTop: '#1a1838', skyBot: '#e2603c', fog: '#aa5c58', amb: '#3a2236' }, sky: { mid: '#7a3450', heaps: 0.35, cirrus: 1 }, grade: { bot: '#ff5a30', a: 0.12, glow: 0.2 } },
  c5m8: { name: 'sodium yard', pal: { skyTop: '#0a0a12', skyBot: '#34282a', fog: '#2a2024', amb: '#140e12' }, lampCol: '#ffaa50', sky: { stars: 0.3, heaps: 0.3, cityGlow: 1.6, cloudCols: { under: '#5a3826', body: '#261c22' } }, grade: { bot: '#ff9030', a: 0.1 } },
  // ---- chapter 6: the ridge ----
  c6m1: { name: 'high and bright', pal: { amb: '#fff4e4', ambT: 0.1 }, sky: { heaps: 0.25, cirrus: 0.6 }, grade: { top: '#9ab8e0', a: 0.06 } },
  c6m2: { name: 'alpenglow dusk', pal: { skyTop: '#26285a', skyBot: '#f49478', fog: '#bf8a8a', amb: '#3a2c50' }, sky: { mid: '#7a5080', heaps: 0.3, cirrus: 1, milky: 0 }, grade: { bot: '#ff8a7a', a: 0.1, glow: 0.16 } },
  c6m3: { name: 'first sun on the snow', pal: { skyTop: '#3a4c80', skyBot: '#f6d0a8', fog: '#e0c8b4', amb: '#ffc8a0', ambT: 0.2 }, sky: { mid: '#8a86aa', heaps: 0.2, cirrus: 1 }, grade: { top: '#9aaee0', bot: '#ffb0a0', a: 0.08 } },
  c6m4: { name: 'blizzard', pal: { amb: '#a8b0ba', ambT: 0.26, fog: '#d0d6dc' }, sky: { deck: 1 }, grade: { top: '#c0d4ea', a: 0.08 } },
  c6m5: { name: 'deep blue cold', pal: { skyTop: '#1a5ab8', skyBot: '#b8d4ee', amb: '#9ab8e8', ambT: 0.24, fog: '#c8dcf0' }, sky: { heaps: 0.15, cirrus: 0.9 }, grade: { top: '#6a9ae0', a: 0.08 } },
  c6m6: { name: 'violet snow at dusk', pal: { skyTop: '#22224e', skyBot: '#c48aa4', fog: '#a88aa8', amb: '#2e2a4e' }, sky: { mid: '#5a4a7a', deck: 0.6 }, grade: { top: '#6a5ab0', bot: '#ff9ab0', a: 0.1 } },
};

// The mission whose scene is being built right now (set while its setup runs).
const LK = { id: null };
// A look for the scene being built: the mission's own, or a plain one for anything else (the Range).
function lkLookFor(time, weather) {
  const L = (LK.id && LOOKS[LK.id]) || null;
  return Object.assign({ id: LK.id || time + weather }, L || {});
}
// Every mission's setup is wrapped as it is registered, so the scene it builds knows whose it is.
// The setup itself runs exactly as before, with the same arguments, and returns the same thing.
{
  const lkMission = mission;
  mission = function (def) {
    if (def && typeof def.setup === 'function' && !def.setup.lkWrapped) {
      const setup = def.setup, id = def.id;
      def.setup = function () { const prev = LK.id; LK.id = id; try { return setup.apply(this, arguments); } finally { LK.id = prev; } };
      def.setup.lkWrapped = true;
    }
    return lkMission(def);
  };
}
