// ---------------------------------------------------------------------------
// Rifle artwork, drawn in code. Each rifle is built from the parts actually
// fitted (scope, muzzle, barrel, stock, support, magazine) and painted with
// the chosen skin. Units are roughly centimetres; the muzzle points right.
// ---------------------------------------------------------------------------
const RAR = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
const RAR_COL = ['#a9b4c0', '#5fd38a', '#6fb6ff', '#c58bff', '#ffb84a'];

// How a skin is written.
//   furn  = stock and handguard, metal = barrel and action, acc = scope,
//           magazine and small parts. Each one is a "paint" (see below).
//   line    colour of the outline around every piece (optional)
//   lineW   width of that outline, for neon outlines (optional, default 0.28)
//   rubber  colour of the butt pad, vent slots and scope mounts (optional)
//   lens    three colours for the scope glass, top to bottom (optional)
//   shimmer colour of a band of light that sweeps along the rifle (optional)
//   glow    colour of a soft halo around the whole rifle (optional)
// A paint is one of:
//   '#rrggbb'                       a flat colour
//   { grad: [colours] }             a blend along the length of the rifle
//   { pat: kind, ... }              a repeating texture (kinds are in PAT_KINDS)
//   { anim: kind, ... }             a moving paint (kinds are in ANIM_PAINTS and ANIM_GRADS)
// Any paint written as an object can also carry:
//   over: paint                     a second coat drawn on top (give its texture a: 'none' for a clear background)
//   s, rot, off                     texture size multiplier, turn in degrees, shift in texture pixels
//   drift: [x, y]                   texture pixels per second, makes any texture move
//   alpha, blend                    how strongly and how a coat is laid on ('lighter' adds light)
//   pulse: [low, high, perSecond]   the coat fades in and out
//   flash: [every, lasts]           the coat flickers on now and then (lightning)
const SKINS = [
  { id: 'factory', name: 'Factory finish', r: 0, kind: 'factory', desc: 'As it left the bench.' },
  // common: plain colours
  { id: 'matte', name: 'Matte Black', r: 0, furn: '#23262b', metal: '#17191d', acc: '#101216' },
  { id: 'earth', name: 'Flat Earth', r: 0, furn: '#a08a63', metal: '#2a2c2f', acc: '#1b1d20' },
  { id: 'ranger', name: 'Ranger Green', r: 0, furn: '#55603f', metal: '#24272a', acc: '#17191b' },
  { id: 'wolf', name: 'Wolf Grey', r: 0, furn: '#7b838c', metal: '#2a2e33', acc: '#1a1c20' },
  { id: 'bone', name: 'Bone', r: 0, furn: '#ddd5c0', metal: '#3a3d42', acc: '#24262a' },
  { id: 'brick', name: 'Brickworks Red', r: 0, furn: '#8d3a2c', metal: '#23252a', acc: '#15171a' },
  { id: 'navy', name: 'Harbour Navy', r: 0, furn: '#27365a', metal: '#1c1f25', acc: '#111317' },
  { id: 'rust', name: 'Rust Belt', r: 0, furn: '#9a5a30', metal: '#3a3531', acc: '#221f1d' },
  // common, second batch: coated metal, anodised sheen, two-tone and worn finishes
  { id: 'bronze', name: 'Smoked Bronze', r: 0, furn: '#1f2023', metal: { grad: ['#8a6c4c', '#a5845c', '#7a5e40'] }, acc: '#5e4a35' },
  { id: 'stainless', name: 'Satin Stainless', r: 0, furn: '#1c1e21', metal: { grad: ['#c9cdd2', '#8f959c', '#dde1e5', '#9aa0a7'] }, acc: '#2c2f33' },
  { id: 'plum', name: 'Plum Anodised', r: 0, furn: '#4f2c66', metal: { grad: ['#8a4fb0', '#5a2a7a', '#a068c8', '#63308a'] }, acc: '#241630' },
  { id: 'rose', name: 'Dusty Rose', r: 0, furn: '#c98f9b', metal: '#3a3337', acc: '#241f22' },
  { id: 'glacier', name: 'Glacier Blue', r: 0, furn: '#9cc7dc', metal: '#2c3743', acc: '#1a2029' },
  { id: 'mustard', name: 'Field Mustard', r: 0, furn: '#c9a227', metal: '#2b2925', acc: '#191815' },
  { id: 'racing', name: 'Racing Green', r: 0, furn: '#17402f', metal: '#1f2326', acc: '#b89355' },
  { id: 'trail', name: 'Trailhead', r: 0, furn: '#5e4129', metal: '#5c6846', acc: '#b99a68' },
  { id: 'benchworn', name: 'Bench Worn', r: 0, furn: { pat: 'worn', a: '#34383d', b: '#aab0b6' }, metal: { pat: 'worn', a: '#25282c', b: '#b9bec4' }, acc: '#17191c' },
  { id: 'mint', name: 'Mint Condition', r: 0, furn: '#9fdcc0', metal: '#e9edeb', acc: '#33443d' },
  // uncommon: woods and simple camouflage
  { id: 'walnut', name: 'Oiled Walnut', r: 1, furn: { pat: 'wood', a: '#6b4026', b: '#4a2a17' }, metal: '#1d2024', acc: '#131518' },
  { id: 'birch', name: 'Birch Laminate', r: 1, furn: { pat: 'laminate', a: '#c9a36b', b: '#8a6238' }, metal: '#2b2e33', acc: '#17191c' },
  { id: 'woodland', name: 'Woodland', r: 1, furn: { pat: 'camo', cols: ['#4a5d3a', '#2e3a26', '#6b5a3c', '#1d2219'] }, metal: { pat: 'camo', cols: ['#4a5d3a', '#2e3a26', '#6b5a3c', '#1d2219'] }, acc: '#1a1c1a' },
  { id: 'desert', name: 'Dune', r: 1, furn: { pat: 'camo', cols: ['#c8b083', '#a88d5f', '#8a7350', '#ddcba4'] }, metal: { pat: 'camo', cols: ['#c8b083', '#a88d5f', '#8a7350', '#ddcba4'] }, acc: '#3b352b' },
  { id: 'snowcam', name: 'Whiteout', r: 1, furn: { pat: 'camo', cols: ['#eef2f5', '#cfd8df', '#9aa7b3', '#ffffff'] }, metal: { pat: 'camo', cols: ['#eef2f5', '#cfd8df', '#9aa7b3', '#ffffff'] }, acc: '#59626b' },
  { id: 'urban', name: 'Concrete', r: 1, furn: { pat: 'camo', cols: ['#6f767e', '#4a5058', '#9aa1a8', '#2b2f35'] }, metal: { pat: 'camo', cols: ['#6f767e', '#4a5058', '#9aa1a8', '#2b2f35'] }, acc: '#17191c' },
  { id: 'twotone', name: 'Signal Orange', r: 1, furn: '#e07b2a', metal: '#1c1e22', acc: '#101114' },
  { id: 'teal', name: 'Tidewater', r: 1, furn: '#2a9d8f', metal: '#20242a', acc: '#121418' },
  // uncommon, second batch: new woods and laminates, simple camouflage, textured finishes
  { id: 'maple', name: 'Flame Maple', r: 1, furn: { pat: 'maple', a: '#d9a650', b: '#7a4a14', c: '#f6dc9a' }, metal: '#1f2227', acc: '#14161a' },
  { id: 'ebony', name: 'Ebony and Steel', r: 1, furn: { pat: 'wood', a: '#2b2420', b: '#0c0a09' }, metal: { pat: 'brushed', a: '#a4abb3', b: '#6c737b', c: '#e3e7ea' }, acc: '#1a1c1f' },
  { id: 'midlam', name: 'Midnight Laminate', r: 1, furn: { pat: 'ply', cols: ['#2f55b0', '#141826', '#4a78d8', '#0d1018'] }, metal: '#1b1e25', acc: '#101218' },
  { id: 'autumn', name: 'Autumn Ply', r: 1, furn: { pat: 'ply', cols: ['#c8862f', '#7a3a1a', '#e2b45a', '#3a2212'] }, metal: '#2c2622', acc: '#1a1614' },
  { id: 'burl', name: 'Burl Walnut', r: 1, furn: { pat: 'burl', a: '#8a5527', b: '#2f1708' }, metal: '#2a2420', acc: '#171310' },
  { id: 'stipple', name: 'Grip Stipple', r: 1, furn: { pat: 'stipple', a: '#4b5340', b: '#262b20' }, metal: { pat: 'parker', a: '#43474a', b: '#2b2e31', c: '#62676b' }, acc: '#1d201c' },
  { id: 'robin', name: 'Robin Egg', r: 1, furn: { pat: 'speckle', a: '#7fc6cc', cols: ['#3a2c20', '#5a4634', '#f4f1e8'] }, metal: '#2a2e33', acc: '#3a2c20' },
  { id: 'refurb', name: 'Arsenal Refurb', r: 1, furn: { pat: 'laminate', a: '#b0492a', b: '#7c2c16' }, metal: { pat: 'parker', a: '#565c54', b: '#3a3f39', c: '#767d73' }, acc: '#2a2d29' },
  { id: 'brush', name: 'Brushstroke', r: 1, furn: { pat: 'brush', cols: ['#b9a877', '#3f5230', '#6a3f24', '#26301d'] }, metal: { pat: 'brush', cols: ['#b9a877', '#3f5230', '#6a3f24', '#26301d'] }, acc: '#26301d' },
  { id: 'frog', name: 'Pond Skipper', r: 1, furn: { pat: 'spots', cols: ['#8ba57c', '#35552f', '#6b4a2a', '#e6dca8'] }, metal: '#262b24', acc: '#35552f' },
  { id: 'rattle', name: 'Rattle Can', r: 1, furn: { pat: 'rattle', a: '#5f6a44', cols: ['#cbb88a', '#3a2e20', '#8c7c54'] }, metal: { pat: 'rattle', a: '#5f6a44', cols: ['#cbb88a', '#3a2e20', '#8c7c54'] }, acc: '#2a2f20' },
  { id: 'blaze', name: 'Hunter\'s Blaze', r: 1, furn: { pat: 'camo', cols: ['#f07a1c', '#c4500c', '#2a1a10', '#ffa64a'] }, metal: '#1f1c1a', acc: '#141210' },
  // rare: patterns
  { id: 'digital', name: 'Pixel Storm', r: 2, furn: { pat: 'digital', cols: ['#3b4a5c', '#232c38', '#6d7f93', '#141a22'] }, metal: { pat: 'digital', cols: ['#3b4a5c', '#232c38', '#6d7f93', '#141a22'] }, acc: '#0f1217' },
  { id: 'tiger', name: 'Tiger Stripe', r: 2, furn: { pat: 'tiger', a: '#b98a3a', b: '#1f1a12' }, metal: { pat: 'tiger', a: '#6b5a2e', b: '#15120c' }, acc: '#15120c' },
  { id: 'carbon', name: 'Carbon Weave', r: 2, furn: { pat: 'carbon', a: '#2b2f35', b: '#14161a' }, metal: { pat: 'carbon', a: '#2b2f35', b: '#14161a' }, acc: '#0d0e11' },
  { id: 'hex', name: 'Hive', r: 2, furn: { pat: 'hex', a: '#e2b33c', b: '#2a2414' }, metal: '#1c1c1e', acc: '#121214' },
  { id: 'topo', name: 'Contour', r: 2, furn: { pat: 'topo', a: '#1f3a35', b: '#7fd6b8' }, metal: { pat: 'topo', a: '#182826', b: '#4f9a84' }, acc: '#101816' },
  { id: 'hazard', name: 'Hazard', r: 2, furn: { pat: 'stripes', a: '#f2c318', b: '#18181a' }, metal: '#232326', acc: '#f2c318' },
  { id: 'splat', name: 'Paint Shop', r: 2, furn: { pat: 'splat', base: '#e9e4d6', cols: ['#e0413a', '#2f6db5', '#f2c318', '#3f8f4f'] }, metal: '#26282c', acc: '#16181b' },
  { id: 'zebra', name: 'Savannah', r: 2, furn: { pat: 'tiger', a: '#efe9da', b: '#121214' }, metal: '#1a1b1e', acc: '#0f1012' },
  { id: 'plaid', name: 'Lumberjack', r: 2, furn: { pat: 'plaid', a: '#a8312b', b: '#1c1c1e' }, metal: '#2a2c30', acc: '#18191c' },
  // rare, second batch: new kinds of pattern
  { id: 'terrain', name: 'Mixed Terrain', r: 2, furn: { pat: 'terrain', cols: ['#a39669', '#c9bf93', '#73804c', '#4d3b26', '#39492b', '#e0d8b6'] }, metal: { pat: 'terrain', cols: ['#a39669', '#c9bf93', '#73804c', '#4d3b26', '#39492b', '#e0d8b6'] }, acc: '#2e3222' },
  { id: 'scalemail', name: 'Scale Mail', r: 2, furn: { pat: 'scales', cols: ['#6c7256', '#a3a682', '#2c3122'], line: '#171a11' }, metal: { pat: 'scales', cols: ['#4b5040', '#74785f', '#1f2219'], line: '#0f110b' }, acc: '#1a1c14' },
  { id: 'diamond', name: 'Diamondback', r: 2, furn: { pat: 'snake', a: '#b99a68', b: '#3f2c18', c: '#ead9b0', s: 1.3 }, metal: '#2b2620', acc: '#3f2c18' },
  { id: 'splinter', name: 'Nordic Splinter', r: 2, furn: { pat: 'splinter', cols: ['#a3aeb1', '#56656d', '#27333b', '#dfe5e7'] }, metal: { pat: 'splinter', cols: ['#a3aeb1', '#56656d', '#27333b', '#dfe5e7'] }, acc: '#1c2329' },
  { id: 'fleck', name: 'Forest Fleck', r: 2, furn: { pat: 'fleck', cols: ['#6b7a45', '#2f4226', '#7d5a34', '#161b13', '#b2aa78'] }, metal: { pat: 'fleck', cols: ['#6b7a45', '#2f4226', '#7d5a34', '#161b13', '#b2aa78'] }, acc: '#161b13' },
  { id: 'cards', name: 'Full House', r: 2, furn: { pat: 'cards', a: '#f1ead8', b: '#c0212b', c: '#17171a' }, metal: '#1a1a1d', acc: '#c0212b' },
  { id: 'hound', name: 'Houndstooth', r: 2, furn: { pat: 'hound', a: '#e9e2d0', b: '#1c2a4a' }, metal: '#2a2d33', acc: '#141a2a' },
  { id: 'bandana', name: 'Bandana', r: 2, furn: { pat: 'paisley', a: '#b3202a', b: '#f4efe6', c: '#16161a' }, metal: '#1c1c1f', acc: '#16161a' },
  { id: 'leopard', name: 'Spotted Cat', r: 2, furn: { pat: 'leopard', a: '#dba95a', b: '#24170c', c: '#a96a26' }, metal: '#2a2118', acc: '#1c150e' },
  { id: 'giraffe', name: 'Tall Order', r: 2, furn: { pat: 'giraffe', a: '#8f5324', b: '#f1e3bf' }, metal: '#3b2c1d', acc: '#241a10' },
  { id: 'graffiti', name: 'Back Alley', r: 2, furn: { pat: 'graffiti', a: '#8f9499' }, metal: '#232427', acc: '#f2d21a' },
  { id: 'dazzle', name: 'Razzle Dazzle', r: 2, furn: { pat: 'dazzle', cols: ['#e6eaed', '#15171a', '#6f8799', '#2f4a66'] }, metal: { pat: 'dazzle', cols: ['#e6eaed', '#15171a', '#6f8799', '#2f4a66'] }, acc: '#15171a' },
  { id: 'koi', name: 'Koi Pond', r: 2, furn: { pat: 'koi', a: '#1d4c86', b: '#bfe0f5', c: '#f2702a', d: '#fff6ea' }, metal: '#16283c', acc: '#f2702a' },
  // epic
  { id: 'damascus', name: 'Damascus', r: 3, furn: { pat: 'wood', a: '#3a2418', b: '#1f120b' }, metal: { pat: 'damascus', a: '#8d98a3', b: '#3d454e' }, acc: { pat: 'damascus', a: '#8d98a3', b: '#3d454e' } },
  { id: 'circuit', name: 'Motherboard', r: 3, furn: { pat: 'circuit', a: '#0f3d2a', b: '#52e0a0' }, metal: '#151a18', acc: '#52e0a0' },
  { id: 'galaxy', name: 'Dark Sky', r: 3, furn: { pat: 'galaxy' }, metal: { pat: 'galaxy' }, acc: '#1a1430' },
  { id: 'sunset', name: 'Port Calder Sunset', r: 3, furn: { grad: ['#2a2a5c', '#b0447a', '#f2925a'] }, metal: { grad: ['#1a1a3c', '#70305a', '#b2603a'] }, acc: '#15152c' },
  { id: 'ivory', name: 'Ivory and Brass', r: 3, furn: '#efe6cf', metal: { grad: ['#d9b65a', '#a8822f', '#e8cc7a'] }, acc: '#a8822f', line: '#7a5c1c' },
  { id: 'frost', name: 'Black Ice', r: 3, furn: { pat: 'frost', a: '#0e1a26', b: '#9fd8ff' }, metal: { pat: 'frost', a: '#0b141d', b: '#6fb6ff' }, acc: '#08111a' },
  // epic, second batch: every zone gets its own treatment
  { id: 'casehard', name: 'Case Hardened', r: 3, furn: { pat: 'wood', a: '#5a3319', b: '#2c160a' }, metal: { pat: 'casehard' }, acc: { pat: 'casehard', s: 0.8 }, line: 'rgba(10,10,30,0.6)' },
  { id: 'oilslick', name: 'Oil Slick', r: 3, furn: { pat: 'stipple', a: '#1b1c20', b: '#0c0d10' }, metal: { grad: ['#3344dd', '#8f3fe3', '#e2488f', '#f28b3a', '#e9d44a', '#49d18b', '#3a9de9', '#7b50e2'], over: { pat: 'brushed', a: 'none', b: '#1a1030', c: '#ffffff', alpha: 0.5 } }, acc: { grad: ['#49d18b', '#3a9de9', '#7b50e2', '#e2488f', '#f28b3a'], over: { pat: 'brushed', a: 'none', b: '#1a1030', c: '#ffffff', alpha: 0.5 } }, rubber: '#15161a' },
  { id: 'jade', name: 'Imperial Jade', r: 3, furn: { pat: 'jade', a: '#2f9a6c', b: '#a8e6c4', c: '#12573a' }, metal: { grad: ['#f0d88a', '#b88f33', '#f6e3a1', '#9a7526'], over: { pat: 'scroll', a: 'none', b: '#5c3f0a', s: 0.75 } }, acc: { pat: 'jade', a: '#17603f', b: '#58b98c', c: '#0a3823' }, line: '#3a2a08' },
  { id: 'verdigris', name: 'Verdigris', r: 3, furn: { pat: 'stipple', a: '#3c2a1f', b: '#21160f' }, metal: { pat: 'patina', a: '#b46a3a', b: '#3fb7a4' }, acc: { grad: ['#d99a68', '#8f5029', '#e3ad7c', '#a05e33'] }, line: '#1c110a' },
  { id: 'neon', name: 'Neon Grid', r: 3, furn: { pat: 'neongrid', a: '#0b0618', b: '#ff3df0', c: '#22e6ff' }, metal: { grad: ['#1a0b3a', '#42106a', '#0b1a4a'], over: { pat: 'neongrid', a: 'none', b: '#22e6ff', c: '#ffffff', s: 0.55 } }, acc: '#150a26', line: '#ff5cf4', lineW: 0.42, rubber: '#22e6ff', lens: ['#ff9df8', '#5a1a8a', '#22e6ff'] },
  { id: 'engraved', name: 'Engraver\'s Proof', r: 3, furn: { col: '#131418', over: { pat: 'scroll', a: 'none', b: '#c9ced4' } }, metal: { grad: ['#e6e9ec', '#a9b0b8', '#f4f6f8', '#9aa1a9'], over: { pat: 'scroll', a: 'none', b: '#2c3138', s: 0.75 } }, acc: { grad: ['#c9ced4', '#8d949c', '#e6e9ec'] }, line: '#22262b' },
  { id: 'marble', name: 'Marble Hall', r: 3, furn: { pat: 'marble', a: '#efebe5', b: '#6f727a', c: '#c9a24a' }, metal: { pat: 'marble', a: '#17181c', b: '#9a9da5', c: '#e0b23a' }, acc: { grad: ['#f0d88a', '#b88f33', '#f6e3a1'] }, line: '#3a3320' },
  { id: 'pearl', name: 'Mother of Pearl', r: 3, furn: { pat: 'pearl' }, metal: { grad: ['#eef1f5', '#aeb6c1', '#f8fafc', '#9aa3ae'] }, acc: { grad: ['#e9c9c0', '#c99a94', '#f3ddd6'] }, line: 'rgba(60,50,90,0.5)' },
  { id: 'sakura', name: 'Cherry Blossom', r: 3, furn: { pat: 'sakura', a: '#1b2150' }, metal: { grad: ['#14121c', '#33203c', '#14121c'], over: { pat: 'sakura', a: 'none', sparse: 1 } }, acc: '#f2a7c3', line: 'rgba(8,8,24,0.65)' },
  { id: 'deco', name: 'Jazz Age', r: 3, furn: { pat: 'deco', a: '#4a0f1e', b: '#e2b84a' }, metal: { grad: ['#f0d88a', '#b88f33', '#f6e3a1', '#9a7526'], over: { pat: 'deco', a: 'none', b: '#6a4a10', s: 0.6 } }, acc: { pat: 'deco', a: '#16080d', b: '#c9a03c', s: 0.6 }, line: '#2a1606' },
  { id: 'stained', name: 'Cathedral Glass', r: 3, furn: { pat: 'stained', cols: ['#d1342f', '#2f62c9', '#e8b72e', '#2f9a5a', '#7a3fb5', '#e8742e', '#2fb0c4'] }, metal: { pat: 'parker', a: '#34373c', b: '#1f2125', c: '#4d5157' }, acc: { grad: ['#f0d88a', '#b88f33', '#f6e3a1'] }, line: '#0c0c0e', lineW: 0.36 },
  // legendary
  { id: 'midas', name: 'Midas', r: 4, furn: { pat: 'filigree', a: '#d9aa2e', b: '#fff0b0' }, metal: { grad: ['#fff2b8', '#d9aa2e', '#8a6412', '#f4d568'] }, acc: { grad: ['#fff2b8', '#d9aa2e', '#8a6412'] }, line: '#5a3f08', shimmer: '#fff8d8' },
  { id: 'kintsugi', name: 'Kintsugi', r: 4, furn: { pat: 'cracks', a: '#121316', b: '#f0c14a' }, metal: { pat: 'cracks', a: '#0c0d10', b: '#f0c14a' }, acc: '#0a0b0d', shimmer: '#ffe9a8' },
  { id: 'aurora', name: 'Aurora', r: 4, furn: { anim: 'aurora' }, metal: { anim: 'aurora' }, acc: '#0b1420', shimmer: '#d8fff0' },
  { id: 'obsidian', name: 'Magma', r: 4, furn: { pat: 'cracks', a: '#161012', b: '#ff5a1f' }, metal: { pat: 'cracks', a: '#0f0b0c', b: '#ff8a3a' }, acc: '#1a0f0c', glow: '#ff5a1f', shimmer: '#ffd0a0' },
  { id: 'blueprint', name: 'Blueprint', r: 4, furn: { pat: 'grid', a: '#1c4fa0', b: '#cfe3ff' }, metal: { pat: 'grid', a: '#173f82', b: '#cfe3ff' }, acc: '#123368', line: '#eaf2ff', shimmer: '#ffffff' },
  // legendary, second batch: every one of these moves
  { id: 'eruption', name: 'Eruption', r: 4, furn: { anim: 'lava' }, metal: { anim: 'lava', cool: 1 }, acc: '#1a0d0a', line: 'rgba(20,4,0,0.7)', glow: '#ff6a1f', shimmer: '#ffe2a8', lens: ['#fff0a8', '#ff7a1a', '#7a1404'] },
  { id: 'prism', name: 'Prism Foil', r: 4, furn: { anim: 'holo', over: { pat: 'prism', a: 'none' } }, metal: { anim: 'holo', lit: 80, sat: 70, cycles: 5, over: { pat: 'prism', a: 'none', s: 0.5 } }, acc: '#f1f3f8', line: 'rgba(40,30,80,0.55)', rubber: '#2a2c36', shimmer: '#ffffff' },
  { id: 'coderain', name: 'Falling Code', r: 4, furn: { anim: 'coderain' }, metal: { anim: 'coderain', dim: 1 }, acc: '#04140b', line: '#1c8a47', rubber: '#020a05', glow: '#2bff7a', lens: ['#c8ffd8', '#0e6a30', '#2bff7a'] },
  { id: 'livewire', name: 'Live Wire', r: 4, furn: { anim: 'veins' }, metal: { anim: 'veins', seed: 'v7', a: '#0b0911' }, acc: '#0c0a12', line: 'rgba(210,120,255,0.35)', glow: '#c04dff', shimmer: '#f1d6ff', lens: ['#f3d6ff', '#6a1aa8', '#ff5ce0'] },
  { id: 'deepfield', name: 'Deep Field', r: 4, furn: { anim: 'starfield' }, metal: { anim: 'starfield', far: 1 }, acc: '#0a1024', line: 'rgba(150,190,255,0.4)', shimmer: '#cfe6ff' },
  { id: 'quicksilver', name: 'Quicksilver', r: 4, furn: { anim: 'chrome' }, metal: { anim: 'chrome', fast: 1 }, acc: '#15181c', line: 'rgba(0,0,0,0.7)', shimmer: '#ffffff' },
  { id: 'thunder', name: 'Thunderhead', r: 4, furn: { anim: 'storm' }, metal: { anim: 'storm', dark: 1 }, acc: '#0d0f18', line: 'rgba(170,160,255,0.35)', glow: '#8f7dff', shimmer: '#f2ecff' },
  { id: 'lagoon', name: 'Lagoon', r: 4, furn: { anim: 'caustic' }, metal: { anim: 'caustic', deep: 1 }, acc: '#efe2b8', line: 'rgba(0,40,60,0.6)', shimmer: '#eaffff' },
];
const SKIN_BY_ID = {}; SKINS.forEach((s) => { SKIN_BY_ID[s.id] = s; });

// Factory colours per rifle and the basic layout of each one.
const GUN_ART = {
  fenwick: { type: 'classic', barrel: 54, furn: { pat: 'wood', a: '#7a4a2a', b: '#55301a' }, metal: '#1e2125', acc: '#131518' },
  ratter: { type: 'classic', barrel: 40, small: true, semi: true, mod: 12, furn: { pat: 'wood', a: '#9a6a3c', b: '#6f4724' }, metal: '#24272b', acc: '#15171a' },
  kessler: { type: 'classic', barrel: 60, military: true, furn: { pat: 'wood', a: '#5c3a22', b: '#3c2414' }, metal: '#2b2d30', acc: '#1d1e21' },
  lark: { type: 'ar', barrel: 44, hg: 30, mag: 'curved', furn: '#2a2d32', metal: '#1c1e22', acc: '#121417' },
  whisper: { type: 'classic', barrel: 20, can: 34, synth: true, furn: '#3b4047', metal: '#16181b', acc: '#0f1012' },
  orlov: { type: 'svd', barrel: 60, furn: { pat: 'laminate', a: '#8a5a30', b: '#5a361a' }, metal: '#1f2124', acc: '#151618' },
  halden: { type: 'chassis', barrel: 56, hg: 32, heavy: 1.3, furn: '#4b5158', metal: '#1d2024', acc: '#131518' },
  hush: { type: 'svd', barrel: 8, can: 36, short: true, furn: { pat: 'laminate', a: '#6b4526', b: '#472b15' }, metal: '#1a1c1f', acc: '#111214' },
  marrow: { type: 'classic', barrel: 56, synth: true, slim: true, furn: '#6a7352', metal: '#2a2d31', acc: '#17191c' },
  corvid: { type: 'ar', barrel: 50, hg: 38, mag: 'straight', big: true, furn: '#3a3f37', metal: '#1c1e21', acc: '#111315' },
  ibex: { type: 'chassis', barrel: 58, hg: 22, take: true, furn: '#8a6f4a', metal: '#26292d', acc: '#15171a' },
  vantage: { type: 'chassis', barrel: 64, hg: 36, heavy: 1.2, furn: '#2e3a4a', metal: '#1b1d21', acc: '#111316' },
  northwind: { type: 'chassis', barrel: 70, hg: 40, heavy: 1.35, big: true, furn: '#5d6b74', metal: '#202327', acc: '#131518' },
  anvil: { type: 'chassis', barrel: 78, hg: 30, heavy: 1.75, big: true, amr: true, furn: '#4a4f3c', metal: '#222427', acc: '#141517' },
  aria: { type: 'chassis', barrel: 80, hg: 44, heavy: 1.4, big: true, elr: true, furn: '#22262c', metal: '#34383e', acc: '#17191c' },
  stormglass: { type: 'rail', barrel: 62, furn: '#dfe5ea', metal: '#262a30', acc: '#14171b' },
};

// ---------------------------------------------------------------------------
// Textures. Each kind is drawn once onto a small tile that repeats, then kept.
// A tile pixel is 0.22 rifle units, so on a phone it is about one screen
// pixel: details smaller than two or three tile pixels turn to mush, and
// shapes wider than about sixty do not fit on a stock.
// ---------------------------------------------------------------------------
const _patCache = {};
function patTile(key, w, h, fn, seed) {
  if (_patCache[key]) return _patCache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); fn(x, w, h, makeRng(hashStr(seed === undefined ? key : seed)));
  _patCache[key] = c; return c;
}

// ---- helpers for drawing tiles ----
// Background, unless the paint asks for a clear one (a: 'none') so that it can be laid over another coat.
const txBg = (x, w, h, c) => { if (c && c !== 'none') { x.fillStyle = c; x.fillRect(0, 0, w, h); } };
// Draw the same thing shifted by whole tiles in every direction, so anything that crosses an edge comes back in on the other side and the tile repeats without a seam.
const txRep = (x, w, h, fn, n) => { n = n || 1; for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) { x.save(); x.translate(i * w, j * h); fn(); x.restore(); } };
// Corner points of a lumpy blob.
const txBlob = (R, cx, cy, rx, ry, n, jag, rot) => { const pts = [], c = Math.cos(rot || 0), s = Math.sin(rot || 0); for (let k = 0; k < n; k++) { const an = (k / n) * TAU, rr = 1 + R.r(-jag, jag), px = Math.cos(an) * rx * rr, py = Math.sin(an) * ry * rr; pts.push(cx + px * c - py * s, cy + px * s + py * c); } return pts; };
// Closed path through points: rounded or sharp.
const txRound = (x, pts) => { const n = pts.length / 2; x.beginPath(); for (let k = 0; k <= n; k++) { const i = (k % n) * 2, j = ((k + 1) % n) * 2, mx = (pts[i] + pts[j]) / 2, my = (pts[i + 1] + pts[j + 1]) / 2; if (k === 0) x.moveTo(mx, my); else x.quadraticCurveTo(pts[i], pts[i + 1], mx, my); } x.closePath(); };
const txSharp = (x, pts) => { x.beginPath(); x.moveTo(pts[0], pts[1]); for (let k = 2; k < pts.length; k += 2) x.lineTo(pts[k], pts[k + 1]); x.closePath(); };
// Open line through points, optionally smoothed.
const txLine = (x, pts, soft) => { x.beginPath(); x.moveTo(pts[0], pts[1]); if (soft && pts.length > 4) { for (let k = 2; k < pts.length - 2; k += 2) x.quadraticCurveTo(pts[k], pts[k + 1], (pts[k] + pts[k + 2]) / 2, (pts[k + 1] + pts[k + 3]) / 2); x.lineTo(pts[pts.length - 2], pts[pts.length - 1]); } else for (let k = 2; k < pts.length; k += 2) x.lineTo(pts[k], pts[k + 1]); };
// A line that wanders but keeps its general heading.
const txWander = (R, x0, y0, an, n, step, turn) => { const pts = [x0, y0]; let a = an, cx = x0, cy = y0; for (let k = 0; k < n; k++) { a += R.r(-turn, turn) + (an - a) * 0.25; cx += Math.cos(a) * step; cy += Math.sin(a) * step; pts.push(cx, cy); } return pts; };
// Soft clouds of colour scattered over the tile.
const txClouds = (x, w, h, R, n, cols, r0, r1, a0, a1, stretch) => { for (let i = 0; i < n; i++) { const cx = R.r(0, w), cy = R.r(0, h), r = R.r(r0, r1), col = cols[i % cols.length], al = R.r(a0, a1), sx = stretch ? R.r(1, stretch) : 1, rot = R.r(0, Math.PI); txRep(x, w, h, () => { x.translate(cx, cy); x.rotate(rot); x.scale(sx, 1); const g = x.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, rgba(col, al)); g.addColorStop(0.5, rgba(col, al * 0.7)); g.addColorStop(1, rgba(col, 0)); x.fillStyle = g; x.fillRect(-r, -r, r * 2, r * 2); }); } };
// Distance between two points on a tile that wraps round.
const txWrapDist = (ax, ay, bx, by, w, h) => { let dx = Math.abs(ax - bx), dy = Math.abs(ay - by); if (dx > w / 2) dx = w - dx; if (dy > h / 2) dy = h - dy; return Math.sqrt(dx * dx + dy * dy); };
// Blend two [r, g, b] colours.
const txMix3 = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
// Cell textures (cracked plates, giraffe hide, leaded glass, light on water).
// For every pixel find the nearest and second nearest of a scattered grid of
// points; the grid wraps at the edges so the tile repeats cleanly. shade gets
// (distance to the middle of the cell, distance to the edge of the cell, a
// random number for the cell, the cell number) and returns [r, g, b, a].
// This runs once when the tile is built, never per frame.
function cellTile(x, w, h, R, nx, ny, jit, shade) {
  const pts = [], cw = w / nx, ch = h / ny;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) pts.push([(i + 0.5 + R.r(-jit, jit)) * cw, (j + 0.5 + R.r(-jit, jit)) * ch, R.f()]);
  const img = x.createImageData(w, h), d = img.data;
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const gi = Math.floor(px / cw), gj = Math.floor(py / ch); let d1 = 1e9, d2 = 1e9, id = 0;
    for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) {
      const ii = (gi + a + nx * 2) % nx, jj = (gj + b + ny * 2) % ny, q = pts[jj * nx + ii];
      const dx = px + 0.5 - (q[0] + (gi + a - ii) * cw), dy = py + 0.5 - (q[1] + (gj + b - jj) * ch), dd = Math.sqrt(dx * dx + dy * dy);
      if (dd < d1) { d2 = d1; d1 = dd; id = jj * nx + ii; } else if (dd < d2) d2 = dd;
    }
    const c = shade(d1, (d2 - d1) / 2, pts[id][2], id), o = (py * w + px) * 4;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = c[3] === undefined ? 255 : c[3];
  }
  x.putImageData(img, 0, 0);
}
// Card suits and a paisley drop, used by the patterns below.
const txSuit = (x, kind, cx, cy, s) => {
  x.beginPath();
  if (kind === 0) { x.moveTo(cx, cy - s); x.bezierCurveTo(cx + s * 1.5, cy - s * 0.1, cx + s * 0.8, cy + s * 0.95, cx, cy + s * 0.3); x.bezierCurveTo(cx - s * 0.8, cy + s * 0.95, cx - s * 1.5, cy - s * 0.1, cx, cy - s); x.moveTo(cx, cy + s * 0.1); x.lineTo(cx + s * 0.42, cy + s); x.lineTo(cx - s * 0.42, cy + s); x.closePath(); }
  else if (kind === 1) { x.moveTo(cx, cy + s); x.bezierCurveTo(cx - s * 1.5, cy + s * 0.1, cx - s * 0.8, cy - s * 0.95, cx, cy - s * 0.3); x.bezierCurveTo(cx + s * 0.8, cy - s * 0.95, cx + s * 1.5, cy + s * 0.1, cx, cy + s); }
  else if (kind === 2) { x.moveTo(cx, cy - s); x.lineTo(cx + s * 0.75, cy); x.lineTo(cx, cy + s); x.lineTo(cx - s * 0.75, cy); x.closePath(); }
  else { x.arc(cx, cy - s * 0.45, s * 0.45, 0, TAU); x.moveTo(cx - s * 0.05, cy + s * 0.15); x.arc(cx - s * 0.5, cy + s * 0.15, s * 0.45, 0, TAU); x.moveTo(cx + s * 0.95, cy + s * 0.15); x.arc(cx + s * 0.5, cy + s * 0.15, s * 0.45, 0, TAU); x.moveTo(cx, cy); x.lineTo(cx + s * 0.4, cy + s); x.lineTo(cx - s * 0.4, cy + s); x.closePath(); }
  x.fill();
};
const txDrop = (L, W, k) => { // outline of a paisley drop: round at the bottom, tapering to a hooked tip
  const l = [], r = [];
  for (let i = 0; i <= 10; i++) { const u = i / 10, sx = W * 1.5 * u * u, sy = -L * u, tx = W * 3 * u, ty = -L, tl = Math.sqrt(tx * tx + ty * ty), hw = W * Math.pow(1 - u, 0.75) * k; l.push(sx + (ty / tl) * hw, sy - (tx / tl) * hw); r.unshift(sx - (ty / tl) * hw, sy + (tx / tl) * hw); }
  const out = l.concat(r); for (let i = 1; i < 6; i++) { const an = Math.PI * (i / 6); out.push(Math.cos(an) * W * k, Math.sin(an) * W * k); }
  return out;
};

// Every kind of texture: [tile width, tile height, how to draw it].
// The draw function gets (context, width, height, random numbers, the paint).
const PAT_KINDS = {
  // ---- the original set (kept exactly as it was) ----
  wood: [160, 48, (x, w, h, R, p) => { x.fillStyle = p.a; x.fillRect(0, 0, w, h); x.strokeStyle = p.b; for (let i = 0; i < 16; i++) { x.globalAlpha = R.r(0.25, 0.8); x.lineWidth = R.r(0.6, 2.2); const y = R.r(0, h); x.beginPath(); x.moveTo(-5, y); x.bezierCurveTo(w * 0.3, y + R.r(-5, 5), w * 0.6, y + R.r(-5, 5), w + 5, y); x.stroke(); } x.globalAlpha = 0.5; x.fillStyle = p.b; for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(R.r(0, w), R.r(0, h), R.r(5, 12), R.r(1.5, 3), 0, 0, TAU); x.fill(); } }],
  laminate: [80, 48, (x, w, h, R, p) => { for (let y = 0; y < h; y += 4) { x.fillStyle = (y / 4) % 2 ? p.a : p.b; x.fillRect(0, y, w, 4); } x.strokeStyle = 'rgba(0,0,0,0.2)'; for (let i = 0; i < 9; i++) { const y = R.r(0, h); x.beginPath(); x.moveTo(0, y); x.lineTo(w, y + R.r(-2, 2)); x.stroke(); } }],
  camo: [96, 96, (x, w, h, R, p) => { x.fillStyle = p.cols[0]; x.fillRect(0, 0, w, h); for (let i = 0; i < 26; i++) { x.fillStyle = p.cols[1 + (i % (p.cols.length - 1))]; const cx = R.r(0, w), cy = R.r(0, h); for (let ox = -w; ox <= w; ox += w) for (let oy = -h; oy <= h; oy += h) { x.beginPath(); for (let k = 0; k < 7; k++) { const an = (k / 7) * TAU, rr = R.r(6, 16); x.lineTo(cx + ox + Math.cos(an) * rr * 1.5, cy + oy + Math.sin(an) * rr * 0.8); } x.closePath(); x.fill(); } } }],
  digital: [96, 96, (x, w, h, R, p) => { x.fillStyle = p.cols[0]; x.fillRect(0, 0, w, h); for (let i = 0; i < 150; i++) { x.fillStyle = p.cols[R.i(1, p.cols.length - 1)]; const s = 6; x.fillRect(R.i(0, w / s) * s, R.i(0, h / s) * s, s * R.i(1, 3), s * R.i(1, 2)); } }],
  tiger: [96, 64, (x, w, h, R, p) => { x.fillStyle = p.a; x.fillRect(0, 0, w, h); x.fillStyle = p.b; for (let i = 0; i < 9; i++) { const bx = (i / 9) * w + R.r(-3, 3); x.beginPath(); x.moveTo(bx, -2); x.bezierCurveTo(bx + R.r(4, 12), h * 0.3, bx - R.r(4, 12), h * 0.6, bx + R.r(-3, 6), h + 2); x.lineTo(bx + R.r(3, 7), h + 2); x.bezierCurveTo(bx - R.r(0, 8), h * 0.6, bx + R.r(8, 16), h * 0.3, bx + R.r(2, 6), -2); x.closePath(); x.fill(); } }],
  carbon: [16, 16, (x, w, h, R, p) => { x.fillStyle = p.b; x.fillRect(0, 0, 16, 16); x.fillStyle = p.a; x.fillRect(0, 0, 8, 8); x.fillRect(8, 8, 8, 8); x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(0, 0, 8, 3); x.fillRect(8, 8, 8, 3); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 6, 8, 2); x.fillRect(8, 14, 8, 2); }],
  hex: [42, 48, (x, w, h, R, p) => { x.fillStyle = p.b; x.fillRect(0, 0, w, h); x.strokeStyle = p.a; x.lineWidth = 2.2; const hx = (cx, cy) => { x.beginPath(); for (let k = 0; k < 6; k++) { const an = (k / 6) * TAU + Math.PI / 6; x.lineTo(cx + Math.cos(an) * 13, cy + Math.sin(an) * 13); } x.closePath(); x.stroke(); }; hx(0, 0); hx(w, 0); hx(0, h); hx(w, h); hx(w / 2, h / 2); }],
  topo: [96, 96, (x, w, h, R, p) => { x.fillStyle = p.a; x.fillRect(0, 0, w, h); x.strokeStyle = p.b; x.lineWidth = 1.1; for (let c = 0; c < 4; c++) { const cx = R.r(0, w), cy = R.r(0, h); for (let r = 5; r < 42; r += 7) for (let ox = -w; ox <= w; ox += w) for (let oy = -h; oy <= h; oy += h) { x.globalAlpha = 0.75; x.beginPath(); x.ellipse(cx + ox, cy + oy, r * 1.3, r * 0.8, c, 0, TAU); x.stroke(); } } }],
  stripes: [40, 40, (x, w, h, R, p) => { x.fillStyle = p.a; x.fillRect(0, 0, 40, 40); x.fillStyle = p.b; x.beginPath(); x.moveTo(0, 40); x.lineTo(20, 40); x.lineTo(40, 20); x.lineTo(40, 0); x.closePath(); x.fill(); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, 20); x.lineTo(20, 0); x.closePath(); x.fill(); }],
  splat: [96, 96, (x, w, h, R, p) => { x.fillStyle = p.base; x.fillRect(0, 0, w, h); for (let i = 0; i < 22; i++) { x.fillStyle = R.pick(p.cols); const cx = R.r(0, w), cy = R.r(0, h), r = R.r(3, 11); for (let ox = -w; ox <= w; ox += w) for (let oy = -h; oy <= h; oy += h) { x.beginPath(); x.arc(cx + ox, cy + oy, r, 0, TAU); x.fill(); for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(cx + ox + R.r(-r, r) * 2, cy + oy + R.r(-r, r) * 2, r * 0.22, 0, TAU); x.fill(); } } } }],
  plaid: [48, 48, (x, w, h, R, p) => { x.fillStyle = p.a; x.fillRect(0, 0, 48, 48); x.fillStyle = p.b; x.globalAlpha = 0.55; x.fillRect(0, 0, 24, 48); x.fillRect(0, 0, 48, 24); x.globalAlpha = 0.35; x.fillStyle = '#fff'; x.fillRect(34, 0, 3, 48); x.fillRect(0, 34, 48, 3); }],
  damascus: [96, 96, (x, w, h, R, p) => { x.fillStyle = p.b; x.fillRect(0, 0, w, h); x.strokeStyle = p.a; for (let y = -10; y < h + 10; y += 5) { x.lineWidth = R.r(1, 2.6); x.beginPath(); for (let xx = 0; xx <= w; xx += 4) { const yy = y + Math.sin((xx / w) * TAU * 2 + y * 0.35) * 6 + Math.sin((xx / w) * TAU * 5 + y) * 2; if (xx === 0) x.moveTo(xx, yy); else x.lineTo(xx, yy); } x.stroke(); } }],
  circuit: [96, 96, (x, w, h, R, p) => { x.fillStyle = p.a; x.fillRect(0, 0, w, h); x.strokeStyle = p.b; x.fillStyle = p.b; x.lineWidth = 1.4; for (let i = 0; i < 16; i++) { let cx = R.i(0, 11) * 8 + 4, cy = R.i(0, 11) * 8 + 4; x.beginPath(); x.moveTo(cx, cy); for (let k = 0; k < 3; k++) { if (R.chance(0.5)) cx += R.pick([-16, 16, 24]); else cy += R.pick([-16, 16, 24]); x.lineTo(cx, cy); } x.stroke(); x.beginPath(); x.arc(cx, cy, 2.2, 0, TAU); x.fill(); } }],
  galaxy: [128, 96, (x, w, h, R) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#0b0820'); g.addColorStop(0.5, '#2a1650'); g.addColorStop(1, '#0b0820'); x.fillStyle = g; x.fillRect(0, 0, w, h); for (let i = 0; i < 5; i++) { const gg = x.createRadialGradient(R.r(0, w), R.r(0, h), 0, R.r(0, w), R.r(0, h), 40); gg.addColorStop(0, R.pick(['rgba(180,80,220,0.35)', 'rgba(60,140,255,0.3)', 'rgba(255,120,160,0.25)'])); gg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gg; x.fillRect(0, 0, w, h); } x.fillStyle = '#fff'; for (let i = 0; i < 70; i++) { x.globalAlpha = R.r(0.3, 1); x.fillRect(R.r(0, w), R.r(0, h), R.r(0.5, 1.6), R.r(0.5, 1.6)); } }],
  frost: [96, 96, (x, w, h, R, p) => { x.fillStyle = p.a; x.fillRect(0, 0, w, h); x.strokeStyle = p.b; x.lineWidth = 0.9; for (let i = 0; i < 9; i++) { const cx = R.r(0, w), cy = R.r(0, h); x.globalAlpha = R.r(0.3, 0.8); for (let k = 0; k < 6; k++) { const an = (k / 6) * TAU + i, l = R.r(8, 20); x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(an) * l, cy + Math.sin(an) * l); x.stroke(); x.beginPath(); x.moveTo(cx + Math.cos(an) * l * 0.6, cy + Math.sin(an) * l * 0.6); x.lineTo(cx + Math.cos(an + 0.6) * l * 0.85, cy + Math.sin(an + 0.6) * l * 0.85); x.stroke(); } } }],
  filigree: [64, 64, (x, w, h, R, p) => { x.fillStyle = p.a; x.fillRect(0, 0, w, h); x.strokeStyle = p.b; x.lineWidth = 1.3; x.globalAlpha = 0.8; for (const q of [[16, 16, 1], [48, 48, 1], [48, 16, -1], [16, 48, -1]]) { x.beginPath(); for (let a = 0; a < TAU * 1.6; a += 0.2) { const r = 1.5 + a * 1.7; x.lineTo(q[0] + Math.cos(a * q[2]) * r, q[1] + Math.sin(a * q[2]) * r); } x.stroke(); } }],
  cracks: [128, 96, (x, w, h, R, p) => { x.fillStyle = p.a; x.fillRect(0, 0, w, h); x.strokeStyle = p.b; x.shadowColor = p.b; x.shadowBlur = 3; for (let i = 0; i < 9; i++) { let cx = R.r(0, w), cy = R.r(0, h); x.lineWidth = R.r(0.8, 2.2); x.beginPath(); x.moveTo(cx, cy); for (let k = 0; k < 7; k++) { cx += R.r(-18, 18); cy += R.r(-14, 14); x.lineTo(cx, cy); } x.stroke(); } }],
  grid: [40, 40, (x, w, h, R, p) => { x.fillStyle = p.a; x.fillRect(0, 0, 40, 40); x.strokeStyle = p.b; x.globalAlpha = 0.5; x.lineWidth = 0.7; for (let i = 0; i <= 40; i += 10) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 40); x.moveTo(0, i); x.lineTo(40, i); x.stroke(); } x.globalAlpha = 0.9; x.lineWidth = 1.2; x.strokeRect(0, 0, 40, 40); }],

  // ---- finishes (common and uncommon) ----
  // Worn finish: bare metal showing through as scuffs, scratches and rubbed patches.
  worn: [128, 64, (x, w, h, R, p) => {
    txBg(x, w, h, p.a); txClouds(x, w, h, R, 6, [p.b], 7, 15, 0.1, 0.24, 2.4);
    x.lineCap = 'round';
    for (let i = 0; i < 46; i++) { const cx = R.r(0, w), cy = R.r(0, h), l = R.r(3, 20), an = R.r(-0.3, 0.3) + (R.chance(0.12) ? 1.1 : 0), lw = R.r(0.6, 1.4), al = R.r(0.3, 0.9); txRep(x, w, h, () => { x.globalAlpha = al; x.strokeStyle = p.b; x.lineWidth = lw; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(an) * l, cy + Math.sin(an) * l); x.stroke(); }); }
    for (let i = 0; i < 30; i++) { const cx = R.r(0, w), cy = R.r(0, h), r = R.r(0.6, 1.3); txRep(x, w, h, () => { x.fillStyle = 'rgba(0,0,0,0.4)'; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill(); }); }
  }],
  // Brushed metal: fine lines along the grain. a is the base, b the dark lines, c the light ones.
  brushed: [128, 32, (x, w, h, R, p) => {
    txBg(x, w, h, p.a);
    for (let y = 0; y < h; y++) { x.globalAlpha = R.r(0.05, 0.55); x.fillStyle = R.chance(0.5) ? p.b : (p.c || '#ffffff'); x.fillRect(0, y, w, 1); }
    for (let i = 0; i < 44; i++) { const cx = R.r(0, w), y = R.i(0, h - 1), l = R.r(10, 60), al = R.r(0.15, 0.55), c = R.chance(0.5) ? p.b : (p.c || '#ffffff'); txRep(x, w, h, () => { x.globalAlpha = al; x.fillStyle = c; x.fillRect(cx, y, l, 1); }); }
  }],
  // Parkerised: a flat grainy coat.
  parker: [64, 64, (x, w, h, R, p) => { txBg(x, w, h, p.a); for (let i = 0; i < 620; i++) { x.globalAlpha = R.r(0.2, 0.7); x.fillStyle = R.chance(0.55) ? p.b : (p.c || p.a); x.fillRect(R.i(0, w - 1), R.i(0, h - 1), R.chance(0.25) ? 2 : 1, 1); } }],
  // Stippling: rows of small raised bumps for grip.
  stipple: [16, 16, (x, w, h, R, p) => { txBg(x, w, h, p.a); for (const q of [[4, 4], [12, 12]]) { x.fillStyle = p.b; x.beginPath(); x.arc(q[0], q[1], 2.5, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,255,255,0.2)'; x.beginPath(); x.arc(q[0] - 0.7, q[1] - 0.8, 1.1, 0, TAU); x.fill(); } }],
  // Speckle: flecks of paint flicked over a plain coat.
  speckle: [96, 96, (x, w, h, R, p) => { txBg(x, w, h, p.a); for (let i = 0; i < 150; i++) { const cx = R.r(0, w), cy = R.r(0, h), r = R.chance(0.16) ? R.r(1.8, 3) : R.r(0.7, 1.5), c = R.pick(p.cols), al = R.r(0.6, 1), rot = R.r(0, 3); txRep(x, w, h, () => { x.globalAlpha = al; x.fillStyle = c; x.beginPath(); x.ellipse(cx, cy, r, r * 0.75, rot, 0, TAU); x.fill(); }); } }],
  // Flame maple: pale wood with soft bands running across the grain.
  maple: [96, 48, (x, w, h, R, p) => {
    txBg(x, w, h, p.a);
    for (let i = 0; i < 12; i++) { const bx = (i / 12) * w + R.r(-2.5, 2.5), k1 = R.r(-6, 6), k2 = R.r(-6, 6), lw = R.r(2, 4.6), al = R.r(0.28, 0.6), lite = i % 3 === 1; txRep(x, w, h, () => { x.globalAlpha = lite ? al * 0.8 : al; x.strokeStyle = lite ? p.c : p.b; x.lineWidth = lw; x.beginPath(); x.moveTo(bx, -1); x.bezierCurveTo(bx + k1, h * 0.33, bx + k2, h * 0.66, bx, h + 1); x.stroke(); }); }
    for (let i = 0; i < 14; i++) { const y = R.r(0, h), k1 = R.r(-3, 3), k2 = R.r(-3, 3), al = R.r(0.15, 0.4); txRep(x, w, h, () => { x.globalAlpha = al; x.strokeStyle = p.b; x.lineWidth = 0.7; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(w * 0.3, y + k1, w * 0.7, y + k2, w, y); x.stroke(); }); }
  }],
  // Plywood laminate in several colours with wavy glue lines.
  ply: [96, 48, (x, w, h, R, p) => {
    const n = 12, bh = h / n, ph = [], am = [];
    for (let k = 0; k < n; k++) { ph.push(R.r(0, TAU)); am.push(R.r(0.5, 1.9)); }
    const edge = (k, xx) => { const kk = ((k % n) + n) % n; return k * bh + Math.sin((xx / w) * TAU * (1 + (kk % 2)) + ph[kk]) * am[kk]; };
    txBg(x, w, h, p.cols[0]);
    for (let k = -1; k <= n; k++) { x.fillStyle = p.cols[(((k % n) + n) % n) % p.cols.length]; x.beginPath(); for (let xx = 0; xx <= w; xx += 4) x.lineTo(xx, edge(k, xx) - 0.3); for (let xx = w; xx >= 0; xx -= 4) x.lineTo(xx, edge(k + 1, xx) + 0.3); x.closePath(); x.fill(); }
    for (let i = 0; i < 20; i++) { const cx = R.r(0, w), y = R.r(0, h), l = R.r(10, 40), al = R.r(0.1, 0.3); txRep(x, w, h, () => { x.globalAlpha = al; x.fillStyle = '#000'; x.fillRect(cx, y, l, 0.7); }); }
  }],
  // Burl: swirling grain full of small eyes.
  burl: [96, 96, (x, w, h, R, p) => {
    txBg(x, w, h, p.a); txClouds(x, w, h, R, 10, [p.b], 9, 20, 0.2, 0.5, 1.8);
    x.strokeStyle = p.b; x.fillStyle = p.b; x.lineCap = 'round';
    for (let i = 0; i < 30; i++) { const cx = R.r(0, w), cy = R.r(0, h), l = R.r(12, 30), an = R.r(-0.6, 0.6), k = R.r(-9, 9), lw = R.r(0.7, 1.6), al = R.r(0.3, 0.65), ca = Math.cos(an), sa = Math.sin(an); txRep(x, w, h, () => { x.globalAlpha = al; x.lineWidth = lw; x.beginPath(); x.moveTo(cx, cy); x.quadraticCurveTo(cx + ca * l / 2 - sa * k, cy + sa * l / 2 + ca * k, cx + ca * l, cy + sa * l); x.stroke(); }); }
    for (let i = 0; i < 17; i++) { const cx = R.r(0, w), cy = R.r(0, h), r = R.r(2.4, 5.5), rot = R.r(0, Math.PI), sq = R.r(0.55, 0.9), al = R.r(0.5, 0.9); txRep(x, w, h, () => { for (let q = 0; q < 3; q++) { x.globalAlpha = al * (1 - q * 0.25); x.lineWidth = 1.2 - q * 0.2; x.beginPath(); x.ellipse(cx, cy, r * (1 + q * 0.6), r * sq * (1 + q * 0.6), rot, 0, TAU); x.stroke(); } x.globalAlpha = al; x.beginPath(); x.ellipse(cx, cy, r * 0.4, r * 0.32, rot, 0, TAU); x.fill(); }); }
  }],

  // ---- camouflage ----
  // Brushstroke: dry swipes of a wide brush over a plain base.
  brush: [128, 96, (x, w, h, R, p) => {
    txBg(x, w, h, p.cols[0]); x.lineCap = 'round';
    for (let i = 0; i < 22; i++) { const c = p.cols[1 + (i % (p.cols.length - 1))], cx = R.r(0, w), cy = R.r(0, h), an = R.r(-0.5, 0.1), l = R.r(22, 44), n = R.i(4, 7), st = []; for (let q = 0; q < n; q++) st.push([R.r(-5, 5), R.r(-7, 7), R.r(-3, 3), R.r(1.8, 3.2)]);
      txRep(x, w, h, () => { x.translate(cx, cy); x.rotate(an); x.strokeStyle = c; for (let q = 0; q < n; q++) { x.lineWidth = st[q][3]; const yy = (q - n / 2) * 2.4; x.beginPath(); x.moveTo(-l / 2 + st[q][0], yy); x.quadraticCurveTo(0, yy + st[q][2], l / 2 + st[q][1], yy + st[q][2] * 0.3); x.stroke(); } }); }
  }],
  // Spots: rounded blobs with smaller spots dropped on and around them.
  spots: [96, 96, (x, w, h, R, p) => {
    txBg(x, w, h, p.cols[0]);
    for (let i = 0; i < 18; i++) { const c = p.cols[1 + (i % 2)], pts = txBlob(R, ((i * 0.618) % 1) * w + R.r(-5, 5), ((i * 0.382 + 0.1) % 1) * h + R.r(-5, 5), R.r(7, 12), R.r(5, 9), 8, 0.22, R.r(0, 3)); txRep(x, w, h, () => { x.fillStyle = c; txRound(x, pts); x.fill(); }); }
    for (let i = 0; i < 26; i++) { const c = p.cols[i % 3 === 0 ? 3 : 1 + (i % 2)], cx = R.r(0, w), cy = R.r(0, h), r = R.r(1.8, 3.6); txRep(x, w, h, () => { x.fillStyle = c; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill(); }); }
  }],
  // Rattle can: spray paint through a net, soft stripes with the net left behind in the base colour.
  rattle: [96, 96, (x, w, h, R, p) => {
    txBg(x, w, h, p.a);
    for (let i = 0; i < 10; i++) { const c = p.cols[i % p.cols.length], cx = R.r(0, w), cy = R.r(0, h), r = R.r(9, 17), rot = R.r(-1, -0.3), al = R.r(0.8, 1); txRep(x, w, h, () => { x.translate(cx, cy); x.rotate(rot); x.scale(2.6, 1); const g = x.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, rgba(c, al)); g.addColorStop(0.6, rgba(c, al)); g.addColorStop(1, rgba(c, 0)); x.fillStyle = g; x.fillRect(-r, -r, r * 2, r * 2); }); }
    x.strokeStyle = rgba(p.a, 0.7); x.lineWidth = 1.3; x.beginPath(); for (let k = -96; k <= 96; k += 12) { x.moveTo(k, 0); x.lineTo(k + 96, 96); x.moveTo(k + 96, 0); x.lineTo(k, 96); } x.stroke();
  }],
  // Mixed terrain: soft fades between the main tones with stretched hard-edged blobs on top.
  terrain: [128, 96, (x, w, h, R, p) => {
    const c = p.cols; txBg(x, w, h, c[0]); txClouds(x, w, h, R, 10, [c[1], c[2]], 14, 28, 0.6, 0.95, 2.2);
    for (let i = 0; i < 34; i++) { const col = c[3 + (i % (c.length - 3))], big = i < 13, pts = txBlob(R, R.r(0, w), R.r(0, h), big ? R.r(8, 16) : R.r(3, 6), big ? R.r(3, 6) : R.r(1.5, 3), 9, 0.32, R.r(-0.4, 0.4)); txRep(x, w, h, () => { x.fillStyle = col; txRound(x, pts); x.fill(); }); }
  }],
  // Scales: a soft two-tone fade under a net of reptile scales.
  scales: [96, 72, (x, w, h, R, p) => {
    const c = p.cols; txBg(x, w, h, c[0]); txClouds(x, w, h, R, 11, [c[1], c[2]], 12, 24, 0.6, 0.95, 1.8);
    const rnd = []; for (let i = 0; i < 64; i++) rnd.push(R.f());
    for (let j = -1; j <= 8; j++) for (let i = -1; i <= 8; i++) { const cx = i * 12 + (j & 1 ? 6 : 0), cy = j * 9, v = rnd[((j + 8) % 8) * 8 + ((i + 8) % 8)];
      x.beginPath(); x.moveTo(cx, cy - 6); x.lineTo(cx + 6, cy - 3); x.lineTo(cx + 6, cy + 3); x.lineTo(cx, cy + 6); x.lineTo(cx - 6, cy + 3); x.lineTo(cx - 6, cy - 3); x.closePath();
      if (v < 0.22) { x.fillStyle = rgba(c[2], 0.55); x.fill(); } else if (v > 0.84) { x.fillStyle = rgba(c[1], 0.4); x.fill(); }
      x.strokeStyle = p.line || '#000'; x.globalAlpha = 0.7; x.lineWidth = 1.1; x.stroke();
      x.strokeStyle = '#fff'; x.globalAlpha = 0.16; x.lineWidth = 0.8; x.beginPath(); x.moveTo(cx - 5, cy - 2); x.lineTo(cx, cy - 4.6); x.lineTo(cx + 5, cy - 2); x.stroke(); x.globalAlpha = 1; }
  }],
  // Splinter: long sharp shards.
  splinter: [128, 96, (x, w, h, R, p) => {
    const c = p.cols; txBg(x, w, h, c[0]);
    for (let i = 0; i < 28; i++) { const col = c[1 + (i % (c.length - 1))], cx = R.r(0, w), cy = R.r(0, h), an = R.r(-0.5, 0.5) + (R.chance(0.3) ? R.r(0.6, 1.2) : 0), l = R.r(14, 34), wd = R.r(4, 11), k = R.r(-0.6, 0.6), ca = Math.cos(an), sa = Math.sin(an);
      const pts = [cx - ca * l, cy - sa * l, cx + ca * l * k - sa * wd, cy + sa * l * k + ca * wd, cx + ca * l, cy + sa * l]; if (R.chance(0.5)) pts.push(cx - ca * l * k * 0.5 + sa * wd * 0.6, cy - sa * l * k * 0.5 - ca * wd * 0.6);
      txRep(x, w, h, () => { x.fillStyle = col; txSharp(x, pts); x.fill(); }); }
  }],
  // Fleck: clusters of dots in several colours.
  fleck: [96, 96, (x, w, h, R, p) => {
    const c = p.cols; txBg(x, w, h, c[0]);
    for (let L = 1; L < c.length; L++) for (let i = 0; i < 9; i++) { const cx = R.r(0, w), cy = R.r(0, h), n = R.i(9, 17), sp = R.r(4, 8), dots = []; for (let q = 0; q < n; q++) dots.push([cx + R.gauss() * sp * 1.3, cy + R.gauss() * sp * 0.8, R.r(1.5, 3.3)]);
      txRep(x, w, h, () => { x.fillStyle = c[L]; dots.forEach((d) => { x.beginPath(); x.arc(d[0], d[1], d[2], 0, TAU); x.fill(); }); }); }
  }],
  // Dazzle: bold stripes at clashing angles, as painted on old warships.
  dazzle: [128, 96, (x, w, h, R, p) => {
    const c = p.cols; txBg(x, w, h, c[2]);
    for (let i = 0; i < 17; i++) { const cx = R.r(0, w), cy = R.r(0, h), pts = txBlob(R, 0, 0, R.r(16, 30), R.r(12, 22), R.i(3, 5), 0.25, R.r(0, TAU)), an = R.r(0, Math.PI), sw = R.r(4.5, 8), solid = i % 5 === 4;
      txRep(x, w, h, () => { x.translate(cx, cy); txSharp(x, pts); if (solid) { x.fillStyle = c[3]; x.fill(); return; } x.fillStyle = c[0]; x.fill(); x.clip(); x.rotate(an); x.fillStyle = c[1]; for (let s = -44; s < 44; s += sw * 2) x.fillRect(s, -44, sw, 88); }); }
  }],

  // ---- animals ----
  // Diamondback: a row of dark diamonds with pale borders under a fine net of scales.
  snake: [64, 48, (x, w, h, R, p) => {
    txBg(x, w, h, p.a);
    const dia = (cx, cy, rx, ry, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(cx - rx, cy); x.lineTo(cx, cy - ry); x.lineTo(cx + rx, cy); x.lineTo(cx, cy + ry); x.closePath(); x.fill(); };
    txRep(x, w, h, () => { dia(32, 24, 26, 19.5, p.c); dia(32, 24, 22.5, 16.5, p.b); dia(32, 24, 12, 8.5, mix(p.a, p.b, 0.3)); dia(32, 24, 4, 2.8, p.b); dia(0, 0, 8, 5.5, p.b); dia(0, 24, 5, 3.5, p.b); });
    for (const q of [['rgba(0,0,0,0.42)', 0], ['rgba(255,255,255,0.14)', 1]]) { x.strokeStyle = q[0]; x.lineWidth = 0.8; x.beginPath(); for (let k = -48; k <= 96; k += 6) { x.moveTo(0, k + q[1]); x.lineTo(64, k + 48 + q[1]); x.moveTo(0, k + q[1]); x.lineTo(64, k - 48 + q[1]); } x.stroke(); }
  }],
  // Leopard: broken dark rings round a darker centre, with small solid spots between.
  leopard: [96, 96, (x, w, h, R, p) => {
    txBg(x, w, h, p.a); txClouds(x, w, h, R, 8, [p.c], 12, 22, 0.25, 0.5, 1.6);
    const ros = []; for (let t = 0; ros.length < 17 && t < 700; t++) { const cx = R.r(0, w), cy = R.r(0, h), r = R.r(4.6, 7.4); if (ros.every((q) => txWrapDist(q[0], q[1], cx, cy, w, h) > q[2] + r + 3.5)) ros.push([cx, cy, r]); }
    x.lineCap = 'round';
    ros.forEach((q) => { const segs = [], n = R.i(2, 4), sq = R.r(0.72, 1), rot = R.r(0, Math.PI); let a0 = R.r(0, TAU); for (let k = 0; k < n; k++) { const len = (TAU / n) * R.r(0.5, 0.72); segs.push([a0, a0 + len, R.r(1.9, 3)]); a0 += TAU / n; }
      txRep(x, w, h, () => { x.translate(q[0], q[1]); x.rotate(rot); x.scale(1, sq); x.fillStyle = p.c; x.beginPath(); x.arc(0, 0, q[2] * 0.85, 0, TAU); x.fill(); x.strokeStyle = p.b; segs.forEach((s) => { x.lineWidth = s[2]; x.beginPath(); x.arc(0, 0, q[2], s[0], s[1]); x.stroke(); }); }); });
    for (let i = 0, t = 0; i < 16 && t < 500; t++) { const cx = R.r(0, w), cy = R.r(0, h), r = R.r(1.2, 2.2); if (!ros.every((q) => txWrapDist(q[0], q[1], cx, cy, w, h) > q[2] + r + 2.5)) continue; i++; txRep(x, w, h, () => { x.fillStyle = p.b; x.beginPath(); x.ellipse(cx, cy, r * 1.3, r, i, 0, TAU); x.fill(); }); }
  }],
  // Giraffe: big uneven patches with pale lines between them.
  giraffe: [120, 96, (x, w, h, R, p) => {
    const A = rgbOf(p.a), B = rgbOf(p.b), D = txMix3(A, [0, 0, 0], 0.35);
    cellTile(x, w, h, R, 5, 4, 0.36, (dm, de, v) => { if (de < 1.5) return B; const c = txMix3(txMix3(A, D, v * 0.7), B, 0.12 * clamp(1 - (de - 1.5) / 4, 0, 1)); return de < 2.4 ? txMix3(B, c, (de - 1.5) / 0.9) : c; });
  }],
  // Koi pond: wave scales with fish swimming over them.
  koi: [96, 72, (x, w, h, R, p) => {
    txBg(x, w, h, p.a);
    for (let j = -3; j <= 14; j++) for (let i = -1; i <= 4; i++) { const cx = i * 24 + (j & 1 ? 12 : 0), cy = j * 6 + 6; x.fillStyle = p.a; x.beginPath(); x.arc(cx, cy, 12, 0, TAU); x.fill(); x.strokeStyle = p.b; for (const q of [[11.3, 1.3, 0.85], [7.8, 0.9, 0.5], [4.4, 0.9, 0.35]]) { x.globalAlpha = q[2]; x.lineWidth = q[1]; x.beginPath(); x.arc(cx, cy, q[0], 0, TAU); x.stroke(); } x.globalAlpha = 1; }
    for (let i = 0; i < 3; i++) { const cx = [18, 66, 50][i] + R.r(-4, 4), cy = [16, 30, 60][i] + R.r(-3, 3), an = R.r(-0.5, 0.5) + (i === 1 ? Math.PI : 0), s = R.r(1.3, 1.55);
      txRep(x, w, h, () => { x.translate(cx, cy); x.rotate(an); x.scale(s, s); x.fillStyle = p.d; x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = 0.6;
        x.beginPath(); x.moveTo(-9, 0); x.quadraticCurveTo(-15, -6, -20, -5.5); x.quadraticCurveTo(-15.5, 0, -20, 5.5); x.quadraticCurveTo(-15, 6, -9, 0); x.fill(); x.stroke();
        x.beginPath(); x.ellipse(1, -4.4, 3.6, 1.7, -0.5, 0, TAU); x.fill(); x.beginPath(); x.ellipse(1, 4.4, 3.6, 1.7, 0.5, 0, TAU); x.fill();
        x.beginPath(); x.moveTo(-10, 0); x.bezierCurveTo(-4, -5.6, 6, -5.2, 11.5, 0); x.bezierCurveTo(6, 5.2, -4, 5.6, -10, 0); x.fill(); x.stroke();
        x.save(); x.clip(); x.fillStyle = p.c; x.beginPath(); x.arc(5.5, -1.5, 4.2, 0, TAU); x.arc(-3.5, 2.2, 3.6, 0, TAU); x.arc(-8.5, -1, 2.2, 0, TAU); x.fill(); x.restore();
        x.fillStyle = '#111'; x.beginPath(); x.arc(9, -1.7, 0.8, 0, TAU); x.fill(); }); }
  }],

  // ---- cloth, cards and walls ----
  // Houndstooth: worked out the way the cloth is woven (four dark, four light threads, each over two and under two).
  hound: [24, 24, (x, w, h, R, p) => { txBg(x, w, h, p.a); x.fillStyle = p.b; for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) if (((i + j) % 4) < 2 ? i < 4 : j < 4) x.fillRect(i * 3, j * 3, 3, 3); }],
  // Bandana: paisley drops with dotted edges, small flowers between them.
  paisley: [128, 96, (x, w, h, R, p) => {
    txBg(x, w, h, p.a);
    const drops = []; for (let t = 0; drops.length < 7 && t < 3000; t++) { const cx = R.r(0, w), cy = R.r(0, h); if (drops.every((q) => txWrapDist(q[0], q[1], cx, cy, w, h) > 33)) drops.push([cx, cy, R.r(0, TAU), R.chance(0.5) ? 1 : -1]); }
    const o1 = txDrop(21, 7.6, 1), o2 = txDrop(21, 7.6, 0.66), o3 = txDrop(21, 7.6, 0.34), o0 = txDrop(21, 7.6, 1.4);
    drops.forEach((q) => txRep(x, w, h, () => { x.translate(q[0], q[1]); x.rotate(q[2]); x.scale(q[3], 1); x.translate(-3, 6);
      x.fillStyle = p.b; for (let k = 0; k < o0.length; k += 2) { x.beginPath(); x.arc(o0[k], o0[k + 1] - 1.4, 1.2, 0, TAU); x.fill(); }
      txRound(x, o1); x.fill(); x.fillStyle = p.a; txRound(x, o2); x.fill(); x.fillStyle = p.c; txRound(x, o3); x.fill(); x.fillStyle = p.b; x.beginPath(); x.arc(0, 0.5, 1.4, 0, TAU); x.fill(); }));
    const fl = []; for (let i = 0, t = 0; i < 16 && t < 2000; t++) { const cx = R.r(0, w), cy = R.r(0, h); if (!drops.every((q) => txWrapDist(q[0], q[1], cx, cy, w, h) > 20) || !fl.every((q) => txWrapDist(q[0], q[1], cx, cy, w, h) > 9)) continue; fl.push([cx, cy]); i++; const rot = R.r(0, 1.5), blk = i % 3 === 0;
      txRep(x, w, h, () => { x.fillStyle = blk ? p.c : p.b; for (let k = 0; k < 4; k++) { const an = rot + k * Math.PI / 2; x.beginPath(); x.arc(cx + Math.cos(an) * 2.7, cy + Math.sin(an) * 2.7, 1.5, 0, TAU); x.fill(); } x.fillStyle = blk ? p.b : p.c; x.beginPath(); x.arc(cx, cy, 1, 0, TAU); x.fill(); }); }
  }],
  // Card suits on a card-white base.
  cards: [64, 64, (x, w, h, R, p) => {
    txBg(x, w, h, p.a);
    txRep(x, w, h, () => { x.fillStyle = p.c; txSuit(x, 0, 16, 16, 7.5); txSuit(x, 3, 32, 48, 7.5); x.fillStyle = p.b; txSuit(x, 1, 48, 16, 7.5); txSuit(x, 2, 0, 48, 7.5); });
    x.fillStyle = rgba(p.c, 0.35); for (const q of [[0, 16], [32, 16], [16, 48], [48, 48], [16, 32], [48, 32], [0, 0], [32, 0], [32, 32], [0, 32]]) txRep(x, w, h, () => { x.beginPath(); x.arc(q[0], q[1], 1.1, 0, TAU); x.fill(); });
  }],
  // Graffiti: a block wall covered in fat spray squiggles, arrows, stars and drips. No letters, nothing that reads as a word.
  graffiti: [160, 96, (x, w, h, R, p) => {
    txBg(x, w, h, p.a);
    x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = 1; x.beginPath(); for (let y = 0; y < h; y += 16) { x.moveTo(0, y + 0.5); x.lineTo(w, y + 0.5); for (let xx = (y / 16) % 2 ? 20 : 0; xx < w; xx += 40) { x.moveTo(xx + 0.5, y); x.lineTo(xx + 0.5, y + 16); } } x.stroke();
    const C = p.cols || ['#ff3d8a', '#22d3ee', '#f2d21a', '#7ddc3a', '#ff7a1a', '#f6f6f6', '#8a4dff'];
    x.lineCap = 'round'; x.lineJoin = 'round';
    const tag = (pts, col, lw, soft) => txRep(x, w, h, () => { for (let pass = 0; pass < 2; pass++) { x.strokeStyle = pass ? col : '#101012'; x.lineWidth = pass ? lw : lw + 2.4; txLine(x, pts, soft); x.stroke(); } });
    for (let i = 0; i < 11; i++) { const cx = R.r(0, w), cy = R.r(0, h), r = R.r(9, 17), c = C[(i + 3) % C.length]; txRep(x, w, h, () => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, rgba(c, 0.85)); g.addColorStop(0.5, rgba(c, 0.6)); g.addColorStop(1, rgba(c, 0)); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); }); }
    for (let i = 0; i < 14; i++) { let cx = ((i * 0.618) % 1) * w + R.r(-6, 6), cy = ((i + 0.5) / 14) * h + R.r(-4, 4); const pts = [cx, cy], n = R.i(4, 7), dir = R.chance(0.5) ? 1 : -1; for (let k = 0; k < n; k++) { cx += dir * R.r(5, 10); cy += (k % 2 ? 1 : -1) * R.r(8, 17); pts.push(cx, cy); } tag(pts, C[i % C.length], R.r(2.8, 4.4), true); }
    for (let i = 0; i < 4; i++) { const cx = R.r(0, w), cy = R.r(0, h), an = R.r(0, TAU), l = R.r(10, 16), ca = Math.cos(an), sa = Math.sin(an), tx = cx + ca * l, ty = cy + sa * l; tag([cx, cy, tx, ty], C[(i + 2) % C.length], 2.4); tag([tx - ca * 5 - sa * 4, ty - sa * 5 + ca * 4, tx, ty, tx - ca * 5 + sa * 4, ty - sa * 5 - ca * 4], C[(i + 2) % C.length], 2.4); }
    for (let i = 0; i < 8; i++) { const cx = R.r(0, w), cy = R.r(0, h), r = R.r(4.5, 7.5), rot = R.r(0, 1), c = C[(i + 4) % C.length], pts = []; for (let k = 0; k < 10; k++) { const an = rot + (k / 10) * TAU, rr = k % 2 ? r * 0.45 : r; pts.push(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr); } txRep(x, w, h, () => { txSharp(x, pts); x.fillStyle = c; x.strokeStyle = '#101012'; x.lineWidth = 1.6; x.stroke(); x.fill(); }); }
    for (let i = 0; i < 9; i++) { const cx = R.r(0, w), cy = R.r(0, h), l = R.r(6, 16), c = C[i % C.length]; txRep(x, w, h, () => { x.strokeStyle = c; x.lineWidth = 1.5; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx, cy + l); x.stroke(); x.fillStyle = c; x.beginPath(); x.arc(cx, cy + l, 1.4, 0, TAU); x.fill(); }); }
  }],

  // ---- fine materials (epic) ----
  // Case hardening: mottled blues, purples and straw yellows from the heat treatment.
  casehard: [128, 96, (x, w, h, R, p) => {
    txBg(x, w, h, '#77808a');
    const C = p.cols || ['#2450b4', '#6a3aa6', '#cda44a', '#262b78', '#b56c3a', '#93a6ba', '#3a82c4', '#dcc67c'];
    txClouds(x, w, h, R, 38, C, 6, 16, 0.6, 1, 2.6);
    for (let i = 0; i < 26; i++) { const pts = txBlob(R, R.r(0, w), R.r(0, h), R.r(4, 13), R.r(2.5, 7), 8, 0.3, R.r(0, 3)), c = C[i % C.length], lw = R.r(0.7, 1.5), al = R.r(0.35, 0.7); txRep(x, w, h, () => { x.globalAlpha = al; x.strokeStyle = c; x.lineWidth = lw; txRound(x, pts); x.stroke(); }); }
  }],
  // Jade: cloudy green stone with fine veins.
  jade: [128, 96, (x, w, h, R, p) => {
    txBg(x, w, h, p.a); txClouds(x, w, h, R, 14, [p.b, p.c], 11, 28, 0.35, 0.75, 2.2); txClouds(x, w, h, R, 6, ['#ffffff'], 5, 12, 0.15, 0.35, 2.6);
    for (let i = 0; i < 12; i++) { const pts = txWander(R, R.r(0, w), R.r(0, h), R.r(0, TAU), R.i(5, 10), 6, 0.7), c = i % 3 ? p.b : p.c, al = R.r(0.3, 0.65), lw = R.r(0.6, 1.2); txRep(x, w, h, () => { x.globalAlpha = al; x.strokeStyle = c; x.lineWidth = lw; txLine(x, pts, true); x.stroke(); }); }
  }],
  // Copper going green: blooms of verdigris over brown copper.
  patina: [128, 96, (x, w, h, R, p) => {
    txBg(x, w, h, p.a);
    for (let y = 0; y < h; y++) { x.globalAlpha = R.r(0.03, 0.2); x.fillStyle = R.chance(0.5) ? '#3a1c0c' : '#f0b78a'; x.fillRect(0, y, w, 1); } x.globalAlpha = 1;
    txClouds(x, w, h, R, 7, ['#3a1e10'], 9, 20, 0.3, 0.55, 2);
    const lite = mix(p.b, '#ffffff', 0.5);
    for (let i = 0; i < 22; i++) { const cx = R.r(0, w), cy = R.r(0, h), rx = R.r(7, 17), ry = R.r(4, 10), rot = R.r(0, 3), pts = txBlob(R, cx, cy, rx, ry, 10, 0.35, rot), inner = txBlob(R, cx + R.r(-2, 2), cy + R.r(-1, 1), rx * 0.5, ry * 0.5, 8, 0.4, rot), dots = []; for (let q = 0; q < 30; q++) dots.push([cx + R.gauss() * rx * 0.3, cy + R.gauss() * ry * 0.3, R.r(0.6, 1.7)]);
      txRep(x, w, h, () => { x.fillStyle = p.b; x.globalAlpha = 0.92; txRound(x, pts); x.fill(); dots.forEach((d) => { x.beginPath(); x.arc(d[0], d[1], d[2], 0, TAU); x.fill(); }); x.globalAlpha = 0.6; x.fillStyle = lite; txRound(x, inner); x.fill(); }); }
  }],
  // Neon grid: glowing lines on the dark, a few cells lit.
  neongrid: [64, 64, (x, w, h, R, p) => {
    txBg(x, w, h, p.a);
    if (p.a !== 'none') for (let i = 0; i < 5; i++) { x.fillStyle = rgba(i % 2 ? p.b : (p.c || p.b), 0.22); x.fillRect(R.i(0, 3) * 16, R.i(0, 3) * 16, 16, 16); }
    const lines = (col, lw, al) => { x.strokeStyle = col; x.globalAlpha = al; x.lineWidth = lw; x.beginPath(); for (let k = 0; k <= 64; k += 16) { x.moveTo(k, 0); x.lineTo(k, 64); x.moveTo(0, k); x.lineTo(64, k); } x.stroke(); };
    lines(p.b, 5.5, 0.1); lines(p.b, 3, 0.25); lines(p.b, 1.3, 1); lines('#ffffff', 0.5, 0.6);
    x.globalAlpha = 1; x.fillStyle = p.c || '#ffffff'; for (let j = 0; j <= 64; j += 16) for (let i = 0; i <= 64; i += 16) { x.beginPath(); x.arc(i, j, 1.6, 0, TAU); x.fill(); }
  }],
  // Engraving: a running vine of scrolls and leaves, as cut into a fine action. Clear background by default so it can go over any metal.
  scroll: [96, 80, (x, w, h, R, p) => {
    txBg(x, w, h, p.a); x.strokeStyle = p.b; x.fillStyle = p.b; x.lineCap = 'round'; x.lineJoin = 'round';
    const leaf = (bx, by, an, L) => { const dx = Math.cos(an), dy = Math.sin(an); x.beginPath(); x.moveTo(bx, by); x.quadraticCurveTo(bx + dx * L * 0.5 - dy * L * 0.4, by + dy * L * 0.5 + dx * L * 0.4, bx + dx * L, by + dy * L); x.quadraticCurveTo(bx + dx * L * 0.5 + dy * L * 0.4, by + dy * L * 0.5 - dx * L * 0.4, bx, by); x.fill(); };
    const vine = (c, sx) => {
      x.lineWidth = 1.5; x.beginPath(); for (let xx = -4; xx <= 100; xx += 4) x.lineTo(xx + sx, c + 8 * Math.sin((xx / 96) * TAU)); x.stroke();
      for (const q of [[24, c - 3, -1], [72, c + 3, 1]]) { // each curl: middle x, middle y, which way it winds
        const d = q[2]; let ex = 0, ey = 0;
        x.lineWidth = 1.4; x.beginPath(); for (let k = 0; k <= 40; k++) { const u = k / 40, th = -d * Math.PI / 2 + d * u * 1.75 * TAU, r = 11 - 9.4 * u; ex = q[0] + sx + Math.cos(th) * r; ey = q[1] + Math.sin(th) * r; x.lineTo(ex, ey); } x.stroke();
        x.beginPath(); x.arc(ex, ey, 1.7, 0, TAU); x.fill();
        leaf(q[0] + sx - 7, c - d * 7, -d * Math.PI / 2 - 0.7, 7); leaf(q[0] + sx + 7, c - d * 7, -d * Math.PI / 2 + 0.7, 7); leaf(q[0] + sx, c - d * 8, -d * Math.PI / 2, 5);
      }
      leaf(sx, c, 0.48 + 1.0, 7); leaf(sx, c, 0.48 - 1.0, 7); leaf(48 + sx, c, -0.48 + 1.0, 7); leaf(48 + sx, c, -0.48 - 1.0, 7);
    };
    txRep(x, w, h, () => { vine(20, 0); vine(60, 48); });
    x.globalAlpha = 0.45; for (let i = 0; i < 70; i++) { x.beginPath(); x.arc(R.r(1, w - 1), R.r(1, h - 1), 0.55, 0, TAU); x.fill(); }
  }],
  // Marble: pale clouds and wandering veins. c is an optional second vein colour.
  marble: [128, 96, (x, w, h, R, p) => {
    txBg(x, w, h, p.a); txClouds(x, w, h, R, 10, [p.b], 14, 30, 0.08, 0.24, 2.4);
    const vein = (col, n, wide) => { for (let i = 0; i < n; i++) { const pts = txWander(R, R.r(0, w), R.r(0, h), R.r(-1.0, -0.25) + (R.chance(0.5) ? Math.PI : 0), R.i(9, 13), 6.5, 0.6), lw = R.r(0.8, 1.7) * wide, fork = Math.floor(pts.length / 4) * 2, twig = txWander(R, pts[fork], pts[fork + 1], R.r(0.3, 1.2), R.i(3, 6), 5, 0.6);
      txRep(x, w, h, () => { x.strokeStyle = col; x.globalAlpha = 0.16; x.lineWidth = lw * 4.5; txLine(x, pts, true); x.stroke(); x.globalAlpha = 0.9; x.lineWidth = lw; x.stroke(); x.globalAlpha = 0.7; x.lineWidth = lw * 0.6; txLine(x, twig, true); x.stroke(); }, 2); } };
    vein(p.b, 9, 1.15); if (p.c) vein(p.c, 4, 0.9);
  }],
  // Mother of pearl: soft pastel clouds with fine pale growth lines.
  pearl: [128, 96, (x, w, h, R) => {
    txBg(x, w, h, '#f4f0ea');
    txClouds(x, w, h, R, 34, ['#f3a9cc', '#93e6d6', '#c3aef6', '#f6e59a', '#98ccfb', '#ffffff'], 8, 20, 0.55, 0.95, 2.6);
    for (let i = 0; i < 16; i++) { const y0 = R.r(0, h), A = R.r(1.5, 5), n = R.i(1, 3), ph = R.r(0, TAU), dark = i % 4 === 0; txRep(x, w, h, () => { x.strokeStyle = dark ? 'rgba(110,100,160,0.3)' : 'rgba(255,255,255,0.65)'; x.lineWidth = 0.8; x.beginPath(); for (let xx = 0; xx <= w; xx += 4) x.lineTo(xx, y0 + Math.sin((xx / w) * TAU * n + ph) * A); x.stroke(); }); }
  }],
  // Cherry blossom: branches, five-petal flowers and loose petals. sparse: 1 gives loose petals only.
  sakura: [128, 96, (x, w, h, R, p) => {
    txBg(x, w, h, p.a);
    const pink = p.b || '#f7bcd3', deep = p.c || '#e0709a';
    if (!p.sparse) { x.lineCap = 'round'; for (let i = 0; i < 3; i++) { const pts = txWander(R, R.r(0, w), R.r(0, h), R.r(-0.4, 0.4) + (i % 2 ? Math.PI : 0), 10, 8, 0.5), twig = txWander(R, pts[8], pts[9], R.r(0.6, 1.3) * (i % 2 ? 1 : -1), 4, 6, 0.4); txRep(x, w, h, () => { x.strokeStyle = p.d || '#4a2c24'; x.lineWidth = 2.2; txLine(x, pts, true); x.stroke(); x.lineWidth = 1.3; txLine(x, twig, true); x.stroke(); }, 2); } }
    const placed = [];
    if (!p.sparse) for (let t = 0; placed.length < 11 && t < 600; t++) { const cx = R.r(0, w), cy = R.r(0, h), r = R.r(4.6, 7.2); if (!placed.every((q) => txWrapDist(q[0], q[1], cx, cy, w, h) > q[2] + r + 2)) continue; placed.push([cx, cy, r]); const rot = R.r(0, TAU);
      txRep(x, w, h, () => { x.fillStyle = pink; for (let k = 0; k < 5; k++) { const an = rot + (k / 5) * TAU; x.beginPath(); x.ellipse(cx + Math.cos(an) * r * 0.56, cy + Math.sin(an) * r * 0.56, r * 0.5, r * 0.36, an, 0, TAU); x.fill(); } x.fillStyle = deep; x.beginPath(); x.arc(cx, cy, r * 0.3, 0, TAU); x.fill(); x.fillStyle = '#ffe9a0'; x.beginPath(); x.arc(cx, cy, r * 0.13, 0, TAU); x.fill(); }); }
    for (let i = 0; i < (p.sparse ? 18 : 14); i++) { const cx = R.r(0, w), cy = R.r(0, h), rot = R.r(0, Math.PI), r = R.r(1.8, 2.8), c = i % 3 ? pink : deep; txRep(x, w, h, () => { x.fillStyle = c; x.globalAlpha = 0.95; x.beginPath(); x.ellipse(cx, cy, r, r * 0.55, rot, 0, TAU); x.fill(); }); }
  }],
  // Art deco fans: rows of scallops with rays.
  deco: [32, 32, (x, w, h, R, p) => {
    txBg(x, w, h, p.a); x.strokeStyle = p.b; x.lineCap = 'butt';
    for (let j = -1; j <= 2; j++) for (let i = -1; i <= 2; i++) { const cx = i * 32 + (j & 1 ? 16 : 0), cy = j * 16 + 16;
      x.lineWidth = 1.6; x.beginPath(); x.arc(cx, cy, 15.1, Math.PI, TAU); x.stroke();
      x.lineWidth = 0.9; x.beginPath(); x.arc(cx, cy, 10.4, Math.PI, TAU); x.stroke(); x.beginPath(); x.arc(cx, cy, 5.4, Math.PI, TAU); x.stroke();
      x.beginPath(); for (let k = 1; k <= 5; k++) { const an = Math.PI + k * (Math.PI / 6); x.moveTo(cx + Math.cos(an) * 5.4, cy + Math.sin(an) * 5.4); x.lineTo(cx + Math.cos(an) * 14.6, cy + Math.sin(an) * 14.6); } x.stroke(); }
  }],
  // Stained glass: jewel-coloured panes held in dark lead.
  stained: [96, 96, (x, w, h, R, p) => {
    const C = p.cols.map(rgbOf), lead = [14, 14, 17];
    cellTile(x, w, h, R, 5, 5, 0.4, (dm, de, v, id) => { if (de < 1.1) return lead; const c0 = C[(id * 4 + Math.floor(v * 2)) % C.length], lit = clamp(1 - dm / 13, 0, 1), c = txMix3(txMix3(c0, [0, 0, 0], 0.3), txMix3(c0, [255, 255, 255], 0.35), lit); return de < 1.9 ? txMix3(lead, c, (de - 1.1) / 0.8) : c; });
  }],

  // ---- tiles for the moving paints (legendary) ----
  // Lava: plates of dark crust with molten seams, and a few plates melted right through. cool: 1 gives mostly rock.
  lavat: [128, 96, (x, w, h, R, p) => {
    const hot = [255, 240, 170], org = [255, 128, 22], red = [176, 30, 8], crust = p.cool ? [22, 16, 18] : [46, 16, 10], k = p.cool ? 0.32 : 0.55;
    cellTile(x, w, h, R, 6, 5, 0.4, (dm, de, v) => {
      if (!p.cool && v < 0.2) { const t = clamp(dm / 12, 0, 1); return txMix3(hot, org, t); }
      const dark = txMix3(crust, [0, 0, 0], v * 0.45);
      if (de < 1.1 * k) return hot; if (de < 3 * k) return txMix3(hot, org, (de - 1.1 * k) / (1.9 * k)); if (de < 6 * k) return txMix3(org, red, (de - 3 * k) / (3 * k)); if (de < 10 * k) return txMix3(red, dark, (de - 6 * k) / (4 * k)); return dark;
    });
  }],
  // Code rain: columns of invented glyphs, bright at the leading end and fading behind. thin: 1 leaves gaps for a second coat.
  code: [128, 192, (x, w, h, R, p) => {
    txBg(x, w, h, p.a); x.lineCap = 'round';
    const rows = h / 8, col = p.b || '#2fe86a', head = p.c || '#e6ffe9';
    for (let i = 0; i < w / 8; i++) {
      const skip = p.thin && R.chance(0.5), hd = R.i(0, rows - 1), len = R.i(9, 16), hd2 = (hd + R.i(12, 16)) % rows, len2 = R.i(5, 9);
      for (let j = 0; j < rows; j++) {
        const k1 = (hd - j + rows) % rows, k2 = (hd2 - j + rows) % rows, b = Math.max(k1 < len ? 1 - k1 / len : 0, k2 < len2 ? 1 - k2 / len2 : 0), lead = k1 === 0 || k2 === 0;
        const n = R.i(2, 4), segs = []; for (let q = 0; q < n; q++) { const ax = R.i(0, 2) * 2.4, ay = R.i(0, 3) * 1.9, flat = R.chance(0.5); segs.push([ax, ay, flat ? R.i(0, 2) * 2.4 : ax, flat ? ay : R.i(0, 3) * 1.9]); }
        if (skip || b <= 0) continue;
        const gx = i * 8 + 1.6, gy = j * 8 + 1.2; x.strokeStyle = lead ? head : col; x.globalAlpha = lead ? 1 : 0.34 + b * 0.66; x.lineWidth = lead ? 1.6 : 1.3;
        x.beginPath(); segs.forEach((s) => { x.moveTo(gx + s[0], gy + s[1]); x.lineTo(gx + s[2], gy + s[3]); }); x.stroke();
      }
    }
  }],
  // Energy veins: a branching network. glow: 1 adds a halo and a white-hot core.
  veins: [128, 96, (x, w, h, R, p) => {
    txBg(x, w, h, p.a);
    const paths = [], grow = (x0, y0, an, n, lw) => { const pts = [x0, y0]; let cx = x0, cy = y0, a = an; for (let k = 0; k < n; k++) { a += R.r(-0.7, 0.7); const st = R.r(5, 9); cx += Math.cos(a) * st; cy += Math.sin(a) * st; pts.push(cx, cy); if (lw > 0.75 && R.chance(0.32)) grow(cx, cy, a + R.pick([-1, 1]) * R.r(0.6, 1.2), R.i(2, 5), lw * 0.62); } paths.push({ pts, lw }); };
    for (let i = 0; i < 7; i++) grow(((i * 0.618) % 1) * w + R.r(-8, 8), ((i * 0.382 + 0.15) % 1) * h + R.r(-6, 6), R.r(0, TAU), R.i(6, 9), R.r(1.3, 2));
    x.lineCap = 'round'; x.lineJoin = 'round';
    const pass = (mul, add, al, col) => paths.forEach((q) => txRep(x, w, h, () => { x.globalAlpha = al; x.strokeStyle = col; x.lineWidth = q.lw * mul + add; txLine(x, q.pts, true); x.stroke(); }));
    if (p.glow) { pass(1, 7, 0.09, p.b); pass(1, 3.4, 0.2, p.b); }
    pass(1, 0, 1, p.b);
    if (p.glow) { pass(0.4, 0, 0.9, '#ffffff'); paths.forEach((q) => { if (q.lw > 1.2) txRep(x, w, h, () => { x.globalAlpha = 0.9; x.fillStyle = '#ffffff'; x.beginPath(); x.arc(q.pts[0], q.pts[1], 1.5, 0, TAU); x.fill(); }); }); }
  }],
  // Stars. n = how many, big = share that get a flare, neb = colours for faint clouds behind them.
  stars: [128, 96, (x, w, h, R, p) => {
    txBg(x, w, h, p.a);
    if (p.neb) txClouds(x, w, h, R, 8, p.neb, 16, 34, 0.25, 0.55, 2);
    for (let i = 0, n = p.n || 60; i < n; i++) { const cx = R.r(0, w), cy = R.r(0, h), big = R.chance(p.big || 0), r = big ? R.r(1.2, 1.9) : R.r(0.55, 1.05), col = R.pick(p.cols || ['#ffffff', '#cfe2ff', '#fff1c9']), al = big ? 1 : R.r(0.45, 1);
      txRep(x, w, h, () => { x.fillStyle = col; if (big) { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r * 4.5); g.addColorStop(0, rgba(col, 0.5)); g.addColorStop(1, rgba(col, 0)); x.fillStyle = g; x.fillRect(cx - r * 5, cy - r * 5, r * 10, r * 10); x.strokeStyle = col; x.lineWidth = 0.7; x.globalAlpha = 0.8; x.beginPath(); x.moveTo(cx - r * 4.5, cy); x.lineTo(cx + r * 4.5, cy); x.moveTo(cx, cy - r * 4.5); x.lineTo(cx, cy + r * 4.5); x.stroke(); x.fillStyle = '#ffffff'; } x.globalAlpha = al; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill(); }); }
  }],
  // Liquid chrome: bands of sky and ground bent as if seen in a wobbling mirror. hi: 1 gives the bright streaks only.
  chromet: [128, 96, (x, w, h, R, p) => {
    const img = x.createImageData(w, h), d = img.data, ramp = [[0, [16, 21, 27]], [0.18, [74, 85, 96]], [0.4, [201, 211, 220]], [0.5, [255, 255, 255]], [0.54, [226, 240, 255]], [0.6, [120, 162, 200]], [0.76, [42, 58, 76]], [0.9, [12, 16, 22]], [1, [16, 21, 27]]];
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const u = px / w, v = py / h, o = (py * w + px) * 4;
      const f = p.hi ? v * 2 + 0.3 * Math.sin(TAU * (u * 2 + 0.4 * Math.sin(TAU * v))) + 0.15 * Math.sin(TAU * (u - 2 * v)) : v * 3 + 0.33 * Math.sin(TAU * (u + 0.5 * Math.sin(TAU * v))) + 0.2 * Math.sin(TAU * (2 * u - v)) + 0.08 * Math.sin(TAU * (3 * u + 2 * v));
      const t = f - Math.floor(f);
      if (p.hi) { const e = (t - 0.5) / 0.07; d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = 255 * Math.exp(-e * e); continue; }
      let k = 0; while (ramp[k + 1][0] < t) k++;
      const c = txMix3(ramp[k][1], ramp[k + 1][1], (t - ramp[k][0]) / (ramp[k + 1][0] - ramp[k][0])); d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
  }],
  // Storm clouds: billows lit from above.
  clouds: [160, 96, (x, w, h, R, p) => {
    txBg(x, w, h, p.a);
    for (let i = 0; i < 30; i++) { const cx = R.r(0, w), cy = R.r(0, h), n = R.i(4, 7), puffs = []; for (let q = 0; q < n; q++) puffs.push([R.r(-18, 18), R.r(-5, 5), R.r(6, 12)]);
      txRep(x, w, h, () => puffs.forEach((q) => { const px = cx + q[0], py = cy + q[1], g = x.createRadialGradient(px, py - q[2] * 0.4, 0, px, py, q[2]); g.addColorStop(0, rgba(p.b, 0.6)); g.addColorStop(0.55, rgba(p.c, 0.4)); g.addColorStop(1, rgba(p.c, 0)); x.fillStyle = g; x.beginPath(); x.arc(px, py, q[2], 0, TAU); x.fill(); })); }
  }],
  // Rain: thin slanting streaks.
  rain: [64, 64, (x, w, h, R, p) => { txBg(x, w, h, p.a); x.strokeStyle = p.b; x.lineCap = 'round'; x.lineWidth = 0.9; for (let i = 0; i < 26; i++) { const cx = R.r(0, w), cy = R.r(0, h), l = R.r(5, 12), al = R.r(0.25, 0.75); txRep(x, w, h, () => { x.globalAlpha = al; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx - l * 0.28, cy + l); x.stroke(); }); } }],
  // Lightning: forked bolts running along the rifle.
  bolts: [160, 96, (x, w, h, R, p) => {
    txBg(x, w, h, p.a);
    const paths = [], bolt = (x0, y0, len, lw, dy) => { const pts = [x0, y0]; let cx = x0, cy = y0; for (let k = 0, n = Math.ceil(len / 7); k < n; k++) { cx += R.r(4, 10); cy += R.r(-6, 6) + dy; pts.push(cx, cy); if (lw > 1 && R.chance(0.3)) bolt(cx, cy, len * 0.35, lw * 0.5, R.pick([-2.5, 2.5])); } paths.push({ pts, lw }); };
    bolt(R.r(0, 30), R.r(18, 34), 150, 1.9, 0); bolt(R.r(70, 100), R.r(60, 78), 120, 1.5, 0);
    x.lineCap = 'round'; x.lineJoin = 'round';
    const pass = (mul, add, al, col) => paths.forEach((q) => txRep(x, w, h, () => { x.globalAlpha = al; x.strokeStyle = col; x.lineWidth = q.lw * mul + add; txLine(x, q.pts); x.stroke(); }));
    pass(1, 9, 0.1, p.b); pass(1, 4, 0.25, p.b); pass(1, 1, 0.9, p.b); pass(0.7, 0, 1, '#ffffff');
  }],
  // Light on shallow water: a bright net of ripples. With a: 'none' only the net is drawn.
  caustic: [128, 96, (x, w, h, R, p) => {
    const clear = !p.a || p.a === 'none', A = clear ? [255, 255, 255] : rgbOf(p.a), B = rgbOf(p.b || '#ffffff'), D = txMix3(A, [0, 20, 60], 0.35);
    cellTile(x, w, h, R, 5, 4, 0.42, (dm, de) => { const l = clamp(Math.exp(-(de * de) / 2.6) + 0.3 * Math.exp(-de / 4), 0, 1); if (clear) return [B[0], B[1], B[2], 255 * l]; return txMix3(txMix3(A, D, clamp(dm / 18, 0, 1)), B, l); });
  }],
  // Foil facets: a mosaic of faint light and dark triangles, to lay over a rainbow.
  prism: [64, 64, (x, w, h, R, p) => {
    txBg(x, w, h, p.a);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const x0 = i * 16, y0 = j * 16, x1 = x0 + 16, y1 = y0 + 16, tris = R.chance(0.5) ? [[x0, y0, x1, y0, x0, y1], [x1, y0, x1, y1, x0, y1]] : [[x0, y0, x1, y0, x1, y1], [x0, y0, x1, y1, x0, y1]];
      tris.forEach((t) => { const v = R.r(-1, 1); x.fillStyle = v > 0 ? 'rgba(255,255,255,' + (v * 0.42).toFixed(3) + ')' : 'rgba(30,10,80,' + (-v * 0.24).toFixed(3) + ')'; x.beginPath(); x.moveTo(t[0], t[1]); x.lineTo(t[2], t[3]); x.lineTo(t[4], t[5]); x.closePath(); x.fill(); }); }
  }],
};

// Fields that say how a coat is laid on, not what its tile looks like. Two paints that differ only in these share one tile.
const TILE_SKIP = { over: 1, drift: 1, s: 1, rot: 1, off: 1, alpha: 1, blend: 1, pulse: 1, flash: 1 };
const _tileKeys = typeof WeakMap === 'function' ? new WeakMap() : null;
function tileKey(p) {
  let k = _tileKeys && _tileKeys.get(p);
  if (!k) { k = JSON.stringify(p, (name, v) => (TILE_SKIP[name] ? undefined : v)); if (_tileKeys) _tileKeys.set(p, k); }
  return k;
}
// Build (or fetch) the repeating texture for a paint. Returns null for a paint that has none.
function paintTile(p) {
  const kind = p && PAT_KINDS[p.pat];
  if (!kind) return null;
  return patTile(tileKey(p), kind[0], kind[1], (x, w, h, R) => kind[2](x, w, h, R, p), p.seed === undefined ? undefined : p.pat + ':' + p.seed);
}

// ---- moving paints ----
// Each of these is a short recipe: one or more tiles laid over each other and
// slid along at different speeds. Nothing is redrawn per frame except the
// rifle itself; the tiles are built once.
const ANIM_PAINTS = {
  // Molten rock creeping along the rifle, with a slow heat pulse.
  lava: (p) => ({ pat: 'lavat', cool: p.cool, drift: p.cool ? [3, 0.5] : [6, 1], over: { col: '#ff7a1f', blend: 'lighter', pulse: [0, p.cool ? 0.1 : 0.2, 0.4] } }),
  // Green glyphs falling, a second sparser layer falling faster in front.
  coderain: (p) => ({ pat: 'code', a: p.a || '#03170c', b: p.dim ? '#1c9a48' : (p.b || '#2fe86a'), c: p.dim ? '#9dffb9' : '#e6ffe9', seed: p.dim ? 'r3' : 'r1', drift: [0, 30], over: { pat: 'code', a: 'none', b: p.b || '#2fe86a', c: '#c8ffd6', thin: 1, seed: 'r2', off: [4, 0], drift: [0, 52], alpha: p.dim ? 0.45 : 0.7 } }),
  // Dim veins that brighten and fade like a slow heartbeat.
  veins: (p) => ({ pat: 'veins', a: p.a || '#110c1a', b: p.dim || '#43226a', seed: p.seed || 'v1', over: { pat: 'veins', a: 'none', b: p.b || '#d470ff', glow: 1, seed: p.seed || 'v1', blend: 'lighter', pulse: [0.18, 1, 0.45] } }),
  // Three depths of stars sliding past at different speeds.
  starfield: (p) => ({ pat: 'stars', a: p.far ? '#04060f' : '#060a1c', neb: p.far ? ['#10224a', '#2a1446'] : ['#17347a', '#43206a', '#0f5262'], n: 70, drift: [2.5, 0], over: { pat: 'stars', a: 'none', n: 24, big: 0.3, seed: 's2', drift: [9, 0.6], over: { pat: 'stars', a: 'none', n: 5, big: 1, seed: 's3', cols: ['#ffffff', '#9fd0ff', '#ffd9a0'], drift: [21, -1], pulse: [0.45, 1, 0.7] } } }),
  // Mirror bands flowing one way with bright streaks flowing the other.
  chrome: (p) => ({ pat: 'chromet', drift: p.fast ? [11, -5] : [7, 4], over: { pat: 'chromet', hi: 1, drift: p.fast ? [-8, 4] : [-5, 6], blend: 'lighter', alpha: 0.5 } }),
  // Cloud drifting, rain slanting through it, and lightning now and then.
  storm: (p) => ({ pat: 'clouds', a: p.dark ? '#0d101b' : '#151a2b', b: p.dark ? '#6a7092' : '#9a9fc2', c: p.dark ? '#2a2e48' : '#3c4264', drift: [3, 0], over: { pat: 'rain', a: 'none', b: '#cfdcff', drift: [-17, 60], over: { pat: 'bolts', a: 'none', b: '#a58cff', seed: p.dark ? 'b2' : 'b1', blend: 'lighter', flash: [2.3, 0.55] } } }),
  // Two nets of light on water crossing each other.
  caustic: (p) => ({ pat: 'caustic', a: p.deep ? '#0b5f9a' : '#11a5b5', b: p.deep ? '#b8f0ff' : '#eafff6', drift: [4, 2], over: { pat: 'caustic', a: 'none', b: '#ffffff', seed: 'c2', drift: [-5, 3], blend: 'lighter', alpha: 0.6 } }),
};
// Moving paints that are a blend of colours rather than a tile.
const ANIM_GRADS = {
  aurora: (ctx, p, b, t) => { const g = ctx.createLinearGradient(b.x0, -14, b.x1, 14); t *= 0.12; const cols = ['#0b2a3a', '#19d3a2', '#4a7dff', '#b05cff', '#19d3a2', '#0b2a3a']; cols.forEach((c, i) => g.addColorStop(((i / (cols.length - 1)) * 0.6 + t) % 1, c)); return g; },
  // A slow rainbow sweeping down the rifle on a slant, like foil tilted in the light.
  holo: (ctx, p, b, t) => { const span = b.x1 - b.x0, g = ctx.createLinearGradient(b.x0, -span * 0.35, b.x1, span * 0.35), n = 30, cyc = p.cycles || 3.4, sat = p.sat || 90, lit = p.lit || 68; for (let i = 0; i <= n; i++) { const u = i / n, hue = (((u * cyc - t * (p.speed || 0.2)) % 1) + 1) % 1; g.addColorStop(u, 'hsl(' + Math.round(hue * 360) + ',' + sat + '%,' + Math.round(lit + 9 * Math.sin(u * cyc * TAU * 2.5 + t)) + '%)'); } return g; },
};
const _animCache = {};
function animPaint(p) { const k = JSON.stringify(p); return _animCache[k] || (_animCache[k] = Object.assign(ANIM_PAINTS[p.anim](p), p.over ? { over: p.over } : null)); }

// How strongly a coat is laid on at a given moment.
function paintAlpha(p, time) {
  if (typeof p === 'string') return 1;
  let a = p.alpha === undefined ? 1 : p.alpha; const t = time || 0;
  if (p.pulse) a *= p.pulse[0] + (p.pulse[1] - p.pulse[0]) * (0.5 + 0.5 * Math.sin(TAU * p.pulse[2] * t));
  if (p.flash) { const per = p.flash[0], dur = p.flash[1], k = Math.floor(t / per), u = (t - k * per - 1.1 - (k ? 0.25 * per * ((hashStr('f' + k) % 100) / 100) : 0)) / dur; a *= u < 0 || u > 1 ? 0 : (u > 0.45 && u < 0.6 ? 0.2 : 1 - u * 0.6); }
  return a;
}
// One coat of paint as something the canvas can fill with.
function paintFill(ctx, p, bounds, time) {
  if (typeof p === 'string') return p;
  if (p.col) return p.col;
  if (p.grad) { const g = ctx.createLinearGradient(bounds.x0, 0, bounds.x1, 0); p.grad.forEach((c, i) => g.addColorStop(i / (p.grad.length - 1), c)); return g; }
  if (p.anim && ANIM_GRADS[p.anim]) return ANIM_GRADS[p.anim](ctx, p, bounds, time || 0);
  const tile = paintTile(p);
  if (!tile) return p.a || '#444';
  const pt = ctx.createPattern(tile, 'repeat');
  if (pt.setTransform) {
    const m = new DOMMatrix(), t = time || 0;
    if (p.rot) m.rotateSelf(p.rot);
    m.scaleSelf(0.22 * (p.s || 1));
    let dx = (p.off ? p.off[0] : 0) + (p.drift ? p.drift[0] * t : 0), dy = (p.off ? p.off[1] : 0) + (p.drift ? p.drift[1] * t : 0);
    if (p.flash) { const k = Math.floor(t / p.flash[0]); dx += hashStr('x' + k) % tile.width; dy += hashStr('y' + k) % tile.height; } // a different bolt each time
    if (dx || dy) m.translateSelf(((dx % tile.width) + tile.width) % tile.width, ((dy % tile.height) + tile.height) % tile.height);
    pt.setTransform(m);
  }
  return pt;
}
// Resolve a zone's paint to something the canvas can fill with. For a paint
// with several coats this is the bottom coat; zoneLayers gives all of them.
function zoneFill(ctx, paint, bounds, time) {
  if (!paint) return '#333';
  if (typeof paint === 'string') return paint;
  if (paint.anim && ANIM_PAINTS[paint.anim]) paint = animPaint(paint);
  return paintFill(ctx, paint, bounds, time);
}
// Every coat of a zone's paint, bottom first: [{ fill, alpha, blend }].
function zoneLayers(ctx, paint, bounds, time) {
  const out = [];
  for (let p = paint, n = 0; p && n < 5; n++) {
    if (typeof p === 'object' && p.anim && ANIM_PAINTS[p.anim]) p = animPaint(p);
    const alpha = paintAlpha(p, time);
    if (alpha > 0.004 || !out.length) out.push({ fill: paintFill(ctx, p, bounds, time), alpha, blend: (typeof p === 'object' && p.blend) || 'source-over' });
    p = typeof p === 'object' ? p.over : null;
  }
  if (!out.length) out.push({ fill: '#333', alpha: 1, blend: 'source-over' });
  return out;
}
// Fill the current path with every coat.
function fillLayers(ctx, layers, rule) {
  for (let i = 0; i < layers.length; i++) { const L = layers[i]; ctx.globalAlpha = L.alpha; ctx.globalCompositeOperation = L.blend; ctx.fillStyle = L.fill; if (rule) ctx.fill(rule); else ctx.fill(); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

// Collect the shapes for a rifle with a given set of parts.
function gunShapes(gunId, cfg) {
  const A = GUN_ART[gunId] || GUN_ART.fenwick, g = GUN_BY_ID[gunId];
  cfg = cfg || defaultConfig(gunId);
  const sh = [];
  const P = (zone, pts, o) => sh.push(Object.assign({ t: 'p', zone, pts }, o || {}));
  const Rc = (zone, x, y, w, h, r, o) => sh.push(Object.assign({ t: 'r', zone, x, y, w, h, r: r || 0 }, o || {}));
  const C = (zone, x, y, r, o) => sh.push(Object.assign({ t: 'c', zone, x, y, r }, o || {}));
  const Ln = (col, pts, w) => sh.push({ t: 'l', col, pts, w: w || 0.35 });
  const big = A.big ? 1.12 : A.small ? 0.86 : 1;
  const stock = cfg.stock, barrelPart = cfg.barrel, muzzle = cfg.muzzle, support = cfg.support, magPart = cfg.mag;
  let bLen = A.barrel * (barrelPart === 'br_short' ? 0.8 : 1);
  let bR = (A.slim ? 0.8 : 1) * (A.heavy || 1) * (barrelPart === 'br_heavy' ? 1.4 : barrelPart === 'br_carbon' ? 1.32 : 1) * 1.05;
  const by = -3.4; // barrel centre line
  let rx1 = 24, hgEnd = 24, stockBack = -36;

  if (A.type === 'rail') {
    // Stormglass: twin rails with coils between, capacitor under, angular stock
    P('furn', [0, -6.5, -8, -6.5, -34, -4.5, -37, -3.5, -37, 8, -32, 8.5, -22, 1.5, -8, 2, -6, 9.5, -1, 9.5, 2, 2, 22, 2.5, 22, -6.5]);
    Rc('metal', 20, -7, bLen, 2, 0.4); Rc('metal', 20, -2.2, bLen, 2, 0.4);
    for (let x = 26; x < 20 + bLen - 6; x += 9) { Rc('coil', x, -5, 5, 2.8, 0.5, { glow: true }); Rc('metal', x - 0.6, -5.4, 0.9, 3.6, 0.2); Rc('metal', x + 4.7, -5.4, 0.9, 3.6, 0.2); }
    Rc('metal', 20 + bLen - 2, -7.6, 3, 8, 0.6);
    P('metal', [6, 2.3, 30, 2.3, 28, 7, 8, 7]); Rc('coil', 11, 3.4, 14, 1.2, 0.5, { glow: true });
    Rc('rubber', -38.2, -3.5, 1.4, 11.5, 0.5);
    P('metal', [-1, 2, 7, 2, 7, 5, 5, 6, 1, 6]);
    rx1 = 20; hgEnd = 44;
  } else if (A.type === 'classic') {
    const s = big;
    const pg = stock === 'st_chassis';
    // the one-piece stock
    const fore = Math.min(44, 24 + bLen * 0.38) * s;
    let pts = [fore, -2.0, 24, -2.2, 0, -2.4, -6, -1.6, -13, -3.6, -34 * s, -2.4, -36 * s, -2.0, -36.4 * s, 9.6 * s, -34 * s, 10 * s, -15, 4.4, -8, 6.2, -4, 5.4, -2, 2.6, 1, 2.3, 14, 2.5, 24, 2.3, fore, 0.9, fore + 1.2, -0.5];
    if (stock === 'st_skel') pts = [fore, -2.0, 24, -2.2, 0, -2.4, -6, -1.6, -13, -3.2, -34 * s, -2.6, -36 * s, -2.0, -36.4 * s, 9.2 * s, -33.5 * s, 9.4 * s, -30 * s, 1.2, -14, 1.0, -9, 7.2, -4.5, 6.6, -2, 2.6, 1, 2.3, 14, 2.5, 24, 2.3, fore, 0.9, fore + 1.2, -0.5];
    P('furn', pts);
    if (stock === 'st_cheek') P('acc', [-27, -5.6, -12, -6.0, -11, -3.4, -28, -2.9]);
    if (pg) { Rc('metal', -30 * s, 9.6 * s, 1.3, 4.5, 0.4); Rc('metal', 4, 2.4, fore - 6, 0.9, 0.3); P('acc', [-27, -5.2, -13, -5.6, -12, -3.4, -28, -2.9]); }
    Rc('rubber', -37.8 * s, -2.1, 1.6, 11.9 * s, 0.6);
    stockBack = -37.8 * s;
    // action
    Rc('metal', -1, -5.2, 26, 3.4, 1.5);
    if (A.military) { Rc('metal', 21, -6.3, 5, 1.4, 0.3); P('furn', [fore + 1, -2.0, fore + 14, -2.4, fore + 14, -0.9, fore + 1, 0.2]); Rc('metal', fore + 13, -4.9, 1.6, 4.4, 0.3); Rc('metal', fore + 5, -4.6, 1.2, 4, 0.3); }
    // trigger guard and floorplate
    Ln('#0c0d0f', [1.5, 2.4, 2.4, 5.4, 8.6, 5.4, 9.6, 2.4], 0.7); Ln('#0c0d0f', [5.6, 2.5, 5.0, 4.4], 0.6);
    if (A.semi) { Rc('metal', 10, 2.3, 7, 1.3, 0.4); C('acc', 14, -3.4, 0.7); }
    else Rc('metal', 10.5, 2.3, 9, 0.8, 0.3);
    if (!A.semi) { Ln('#101114', [4.5, -3.8, 2.4, 0.2], 1.0); C('metal', 2.2, 0.7, 1.15); }
    hgEnd = fore;
  } else if (A.type === 'chassis') {
    const s = big, hg = (A.hg || 32) * s;
    Rc('metal', 0, -5.6 * s, 26, 6.6 * s, 0.8);
    Rc('acc', 1, -6.5 * s, 24, 1.0, 0.2); // top rail
    // forend tube with slots
    Rc('furn', 26, -6.0 * s, hg, 5.4 * s, 0.9);
    for (let x = 30; x < 26 + hg - 5; x += 6.5) Rc('rubber', x, -3.9 * s, 4, 1.1 * s, 0.5);
    hgEnd = 26 + hg;
    // grip
    P('furn', [-2.5, 1, 3.2, 1, 1, 10.5 * s, -5.5, 10.5 * s]);
    // adjustable stock
    const thin = stock === 'st_skel';
    Rc('metal', -3, -4.2 * s, 3.4, 5, 0.5);
    Rc('furn', -31 * s, -4.2 * s, 28.5 * s, thin ? 1.5 : 2.4, 0.5);
    Rc('acc', -22 * s, (stock === 'st_cheek' ? -7.8 : -6.6) * s, 13 * s, (stock === 'st_cheek' ? 3.8 : 2.6) * s, 0.7);
    P('furn', [-31 * s, -5.2 * s, -28.6 * s, -5.2 * s, -28.6 * s, 8.4 * s, -31 * s, 8.4 * s]);
    if (!thin) P('furn', [-28.8 * s, 6.5 * s, -28.8 * s, 8.3 * s, -4, 1.6, -4, 0.2]); else Ln('#15171a', [-28.8 * s, 7.5 * s, -4, 0.8], 0.9);
    if (stock === 'st_chassis' || A.amr || A.elr) { Rc('metal', -27 * s, 8.3 * s, 1.4, 4.6, 0.4); Rc('rubber', -27.6 * s, 12.6 * s, 2.6, 0.9, 0.3); }
    Rc('rubber', -32.6 * s, -5.4 * s, 1.7, 14 * s, 0.6);
    stockBack = -32.6 * s;
    Ln('#0c0d0f', [2.5, 1.0, 3.2, 4.4, 8.8, 4.4, 9.8, 1.0], 0.7); Ln('#0c0d0f', [6, 1.2, 5.4, 3.4], 0.6);
    if (!A.take) { Ln('#101114', [20, -3.2, 17.6, 1.2], 1.0 * s); C('metal', 17.4, 1.8, 1.2 * s); }
    else { Ln('#101114', [8, -3.2, 6.6, -0.2], 0.9); C('metal', 6.4, 0.3, 1.0); Rc('acc', 24.5, -6.4, 2.2, 7.6, 0.5); }
    if (A.amr) { P('metal', [4, -6.5 * s, 8, -10.5 * s, 18, -10.5 * s, 22, -6.5 * s, 20.5, -6.5 * s, 17, -9.3 * s, 9, -9.3 * s, 5.5, -6.5 * s]); }
    // magazine
    if (!A.take) { const ml = (magPart === 'mg_ext' ? 12.5 : 8.5) * s; P('acc', [10, 1, 18.5, 1, 17.6, 1 + ml, 9.4, 1 + ml]); if (magPart === 'mg_quick') Ln('#d6a12a', [11.5, 1 + ml, 13.5, 3.4 + ml, 15.5, 1 + ml], 0.7); }
    rx1 = 26;
  } else if (A.type === 'ar') {
    const s = big, hg = (A.hg || 30) * s;
    Rc('metal', 0, -5.8 * s, 21, 4.6 * s, 0.6); Rc('acc', 1, -6.6 * s, 19.5 + hg, 0.9, 0.2);
    P('metal', [0, -1.3 * s, 21, -1.3 * s, 21, 1.4 * s, 16, 2.6 * s, 2, 2.6 * s, 0, 1.2 * s]);
    Rc('rubber', 8.5, -4.6 * s, 6, 1.6 * s, 0.4); C('rubber', 18.6, -0.2, 0.7);
    Rc('furn', 21, -5.9 * s, hg, 5.2 * s, 0.9);
    for (let x = 24.5; x < 21 + hg - 5; x += 6) Rc('rubber', x, -3.9 * s, 3.8, 1.0 * s, 0.5);
    hgEnd = 21 + hg;
    P('furn', [-1.5, 2.4 * s, 3.4, 2.4 * s, 0.8, 11 * s, -5, 11 * s]);
    // buffer tube and stock
    Rc('metal', -22 * s, -4.6 * s, 22.5 * s, 2.3, 1.0);
    const thin = stock === 'st_skel';
    P('furn', thin ? [-27 * s, -5.4 * s, -10, -5.4 * s, -10, -1.8 * s, -24 * s, -1.4 * s, -24.5 * s, 5.8 * s, -27 * s, 5.8 * s] : [-27 * s, -5.6 * s, -9, -5.6 * s, -9, -1.4 * s, -14, -1.0 * s, -23 * s, 6 * s, -27 * s, 6 * s]);
    if (stock === 'st_cheek') Rc('acc', -22 * s, -7.6 * s, 11, 2.2, 0.6);
    if (stock === 'st_chassis') { Rc('metal', -24 * s, 6 * s, 1.3, 4.6, 0.4); Rc('acc', -22 * s, -7.2 * s, 11, 1.8, 0.6); }
    Rc('rubber', -28.4 * s, -5.7 * s, 1.6, 11.8 * s, 0.6);
    stockBack = -28.4 * s;
    Ln('#0c0d0f', [3.4, 2.7 * s, 4.2, 5.6 * s, 9, 5.6 * s, 9.4, 2.7 * s], 0.7); Ln('#0c0d0f', [6.6, 2.8 * s, 6.1, 4.6 * s], 0.6);
    const ml = (magPart === 'mg_ext' ? 14 : 10) * s;
    if (A.mag === 'curved') P('acc', [10, 2.5 * s, 16, 2.5 * s, 18.2, 2.5 * s + ml, 12.4, 2.5 * s + ml + 0.8]);
    else P('acc', [10, 2.5 * s, 17, 2.5 * s, 17.6, 2.5 * s + ml * 0.85, 10.8, 2.5 * s + ml * 0.85]);
    if (magPart === 'mg_quick') Ln('#d6a12a', [12.5, 2.5 * s + ml, 14.5, 5 * s + ml, 16.5, 2.5 * s + ml], 0.7);
    rx1 = 21;
  } else if (A.type === 'svd') {
    // thumbhole wooden stock with a cut-out
    const sk = stock === 'st_skel';
    P('furn', [0, -2.2, -9, -1.4, -34, -3.4, -36, -3.0, -36.4, 8.2, -33, 8.6, -13, 3.8, -8.5, 9.6, -3.6, 9.0, -1.2, 1.6], { hole: sk ? [-29, -0.6, -14, -0.2, -15, 2.8, -30, 5.4] : [-27, 0.2, -15, 0.4, -16, 2.6, -28, 4.6] });
    if (stock === 'st_cheek' || stock === 'st_chassis') P('acc', [-29, -6.0, -15, -5.6, -14, -3.0, -30, -3.3]);
    if (stock === 'st_chassis') Rc('metal', -31, 8.3, 1.3, 4.4, 0.4);
    Rc('rubber', -37.8, -3.1, 1.6, 11.6, 0.6);
    stockBack = -37.8;
    P('metal', [0, -5.2, 3, -6.2, 22, -6.2, 26, -5.0, 26, 1.2, 0, 1.2]);
    Ln('#0c0d0f', [3, 1.3, 3.8, 4.4, 9.2, 4.4, 10, 1.3], 0.7); Ln('#0c0d0f', [6.6, 1.4, 6.0, 3.4], 0.6);
    if (A.short) { Rc('furn', 26, -5.4, 12, 4.6, 0.8); hgEnd = 38; }
    else { Rc('furn', 26, -5.6, 24, 4.6, 0.8); for (let x = 30; x < 48; x += 4.5) Rc('rubber', x, -4.3, 2.6, 0.9, 0.4); Rc('metal', 26, -6.6, 22, 1.1, 0.5); hgEnd = 50; }
    const ml = magPart === 'mg_ext' ? 12 : 8.5;
    P('acc', [10.5, 1.2, 18, 1.2, 20.2, 1.2 + ml, 13, 1.6 + ml]);
    if (magPart === 'mg_quick') Ln('#d6a12a', [14, 1.6 + ml, 16, 4 + ml, 18.4, 1.4 + ml], 0.7);
    C('metal', 22, -2.2, 0.8);
    rx1 = 26;
  }

  // barrel
  let tip;
  if (A.type !== 'rail') {
    const bx0 = rx1 - 0.5, r0 = bR * 1.25, r1 = barrelPart === 'br_heavy' || barrelPart === 'br_carbon' ? bR * 1.2 : bR * 0.88;
    tip = bx0 + bLen;
    P(barrelPart === 'br_carbon' ? 'carbon' : 'metal', [bx0, by - r0, tip, by - r1, tip, by + r1, bx0, by + r0], { under: true });
    if ((A.heavy || 1) > 1.25 || barrelPart === 'br_heavy') for (let i = 0; i < 3; i++) Ln('rgba(0,0,0,0.35)', [hgEnd + 3, by - r1 * 0.5 + i * r1 * 0.5, tip - 4, by - r1 * 0.5 + i * r1 * 0.5], 0.3);
    if (A.type === 'svd' && !A.short) { Rc('metal', tip - 13, by - 3.8, 1.6, 5.2, 0.3); Rc('metal', 48.5, by - 2.6, 2.4, 4.2, 0.3); }
    if (A.can) { Rc('metal', tip - 0.5, by - 2.15, A.can, 4.3, 1.4); for (let x = tip + 3; x < tip + A.can - 2; x += 5) Ln('rgba(255,255,255,0.08)', [x, by - 2.1, x, by + 2.1], 0.4); tip += A.can - 0.5; }
    if (A.mod) { Rc('metal', tip - A.mod, by - 1.55, A.mod, 3.1, 1.0); }
    // muzzle device
    if (muzzle === 'mz_flash' || (A.type === 'svd' && !A.short && muzzle === 'mz_none')) { Rc('acc', tip, by - r1 * 1.25, 5, r1 * 2.5, 0.4); for (let i = 0; i < 3; i++) Ln('rgba(0,0,0,0.6)', [tip + 1.2, by - r1 * 0.7 + i * r1 * 0.7, tip + 4.4, by - r1 * 0.7 + i * r1 * 0.7], 0.3); tip += 5; }
    else if (muzzle === 'mz_brake' || (A.amr && muzzle === 'mz_none')) { const k = A.amr ? 1.5 : 1; P('acc', [tip, by - r1, tip + 2 * k, by - r1 * 2.1 * k, tip + 7 * k, by - r1 * 2.1 * k, tip + 7 * k, by + r1 * 2.1 * k, tip + 2 * k, by + r1 * 2.1 * k, tip, by + r1]); Rc('rubber', tip + 2.6 * k, by - r1 * 1.2 * k, 1.3 * k, r1 * 2.4 * k, 0.3); Rc('rubber', tip + 4.8 * k, by - r1 * 1.2 * k, 1.3 * k, r1 * 2.4 * k, 0.3); tip += 7 * k; }
    else if (muzzle === 'mz_supl') { Rc('acc', tip - 1, by - 1.75, 17, 3.5, 1.2); Ln('rgba(255,255,255,0.1)', [tip + 2, by - 1.7, tip + 2, by + 1.7], 0.4); Ln('rgba(255,255,255,0.1)', [tip + 13, by - 1.7, tip + 13, by + 1.7], 0.4); tip += 16; }
    else if (muzzle === 'mz_suph') { Rc('acc', tip - 1, by - 2.3, 25, 4.6, 1.4); for (let x = tip + 3; x < tip + 22; x += 4.5) Ln('rgba(255,255,255,0.09)', [x, by - 2.2, x, by + 2.2], 0.4); tip += 24; }
  } else tip = 20 + bLen + 1;

  // scope
  const scId = cfg.scope || g.scope, sy = (A.type === 'classic' ? -9.3 : A.type === 'rail' ? -11 : -10.6) * (A.big ? 1.06 : 1);
  const SC = { hunter: [28, 1.5, 2.5, 2.1], zf4: [22, 1.15, 1.5, 1.5], ranger: [30, 1.6, 2.9, 2.2], bdc: [30, 1.6, 2.7, 2.2], pso: [21, 1.9, 2.4, 2.3], tac: [34, 1.8, 3.3, 2.5], night: [26, 2.6, 3.4, 2.6], lrf: [34, 1.8, 3.2, 2.5], tree: [36, 1.9, 3.5, 2.6], comp: [41, 1.9, 3.9, 2.6], oracle: [31, 2.7, 3.3, 2.8] }[scId] || [28, 1.5, 2.5, 2.1];
  const sx0 = (A.type === 'classic' ? -3 : 0) + (scId === 'comp' ? -2 : 0), sL = SC[0], tr = SC[1], obj = SC[2], ocu = SC[3], sx1 = sx0 + sL;
  const boxy = scId === 'night' || scId === 'oracle';
  // mounts
  const mTop = sy + tr, mBot = A.type === 'classic' ? -5.2 : A.type === 'rail' ? -7 : (A.type === 'ar' ? -6.6 : -6.5) * (A.big ? 1.12 : 1);
  [sx0 + sL * 0.3, sx0 + sL * 0.62].forEach((mx) => Rc('rubber', mx - 1, mTop - 0.4, 2, mBot - mTop + 0.6, 0.3));
  if (boxy) {
    Rc('acc', sx0 + 2, sy - tr, sL - 8, tr * 2, 0.8);
    P('acc', [sx1 - 7, sy - tr, sx1, sy - obj, sx1, sy + obj, sx1 - 7, sy + tr]); Rc('acc', sx0, sy - ocu * 0.8, 4, ocu * 1.6, 0.8);
    if (scId === 'oracle') { Rc('rubber', sx0 + 8, sy - tr - 1.6, 9, 1.8, 0.4); C('glass', sx0 + 10.5, sy - tr - 0.7, 0.5, { glow: true }); Ln('#1a1c20', [sx0 + 18, sy - tr, sx0 + 19.5, sy - tr - 3.4], 0.4); }
    else { Rc('rubber', sx0 + 9, sy - tr - 1.3, 5, 1.5, 0.4); C('rubber', sx0 + 16, sy + tr + 0.4, 1.3); }
  } else {
    Rc('acc', sx0 + 4, sy - tr, sL - 10, tr * 2, tr * 0.5);
    P('acc', [sx0, sy - ocu, sx0 + 5, sy - ocu, sx0 + 8, sy - tr, sx0 + 8, sy + tr, sx0 + 5, sy + ocu, sx0, sy + ocu]);
    P('acc', [sx1 - 12, sy - tr, sx1 - 7, sy - obj, sx1, sy - obj, sx1, sy + obj, sx1 - 7, sy + obj, sx1 - 12, sy + tr]);
    const tx = sx0 + sL * 0.46, big2 = scId === 'tac' || scId === 'tree' || scId === 'comp' || scId === 'lrf';
    if (scId !== 'zf4') { Rc('acc', tx - 1.6, sy - tr - (big2 ? 3 : 1.8), 3.2, big2 ? 3 : 1.8, 0.4); if (big2) Ln('rgba(255,255,255,0.18)', [tx - 1.6, sy - tr - 1.5, tx + 1.6, sy - tr - 1.5], 0.25); C('acc', tx, sy, tr * 0.95); }
    if (scId === 'pso') { Rc('rubber', sx0 - 3, sy - ocu * 0.9, 3.4, ocu * 1.8, 0.8); Rc('acc', tx - 3, sy + tr, 6, 2.2, 0.4); }
    if (scId === 'lrf') { Rc('rubber', tx + 3, sy - tr - 2.6, 9, 2.4, 0.5); C('glass', tx + 11.6, sy - tr - 1.4, 0.7); }
    if (scId === 'comp') Rc('rubber', sx1, sy - obj, 6, obj * 2, 0.5);
  }
  C('glass', sx1 - 0.1, sy, obj * 0.82, { lens: true, squash: 0.3 });

  // support
  const fx = Math.min(hgEnd - 5, rx1 + 16);
  if (support === 'sp_bag') { P('bag', [stockBack + 3, 10.5, stockBack + 13, 9.6, stockBack + 14.5, 14.5, stockBack + 2, 14.8]); Ln('rgba(0,0,0,0.25)', [stockBack + 8, 10, stockBack + 8.4, 14.6], 0.3); }
  else if (support === 'sp_bipod' || (A.amr && support === 'sp_none')) { Rc('rubber', fx - 1.5, -0.8, 3, 1.6, 0.4); Ln('#17191c', [fx, 0.6, fx - 5.5, 15.5], 1.0); Ln('#17191c', [fx, 0.6, fx + 3.5, 15.8], 1.0); Ln('#2a2d31', [fx - 5.5, 15.5, fx - 7.5, 15.8], 1.3); Ln('#2a2d31', [fx + 3.5, 15.8, fx + 5.5, 15.9], 1.3); }
  else if (support === 'sp_tripod') { const hx2 = rx1 - 6; Rc('rubber', hx2 - 3.5, 2.2, 7, 2.2, 0.6); C('metal', hx2, 5.4, 1.5); Ln('#17191c', [hx2, 6, hx2 - 13, 26], 1.1); Ln('#17191c', [hx2, 6, hx2 + 12, 26], 1.1); Ln('#22252a', [hx2, 6, hx2 + 1.5, 26.5], 1.1); Ln('#17191c', [hx2 - 6.5, 16, hx2 + 6, 16], 0.5); }
  return { sh, x0: stockBack - 1, x1: tip + 1, art: A };
}

// Add one shape to the current path, so several shapes can be outlined in one go (used for the glow).
function shapeTrace(ctx, s) {
  if (s.t === 'p') { ctx.moveTo(s.pts[0], s.pts[1]); for (let i = 2; i < s.pts.length; i += 2) ctx.lineTo(s.pts[i], s.pts[i + 1]); ctx.closePath(); if (s.hole) { const h = s.hole; ctx.moveTo(h[0], h[1]); for (let i = 2; i < h.length; i += 2) ctx.lineTo(h[i], h[i + 1]); ctx.closePath(); } }
  else if (s.t === 'r') { const r = Math.min(s.r, s.w / 2, s.h / 2); ctx.moveTo(s.x + r, s.y); ctx.arcTo(s.x + s.w, s.y, s.x + s.w, s.y + s.h, r); ctx.arcTo(s.x + s.w, s.y + s.h, s.x, s.y + s.h, r); ctx.arcTo(s.x, s.y + s.h, s.x, s.y, r); ctx.arcTo(s.x, s.y, s.x + s.w, s.y, r); ctx.closePath(); }
  else if (s.t === 'c') { ctx.moveTo(s.x + (s.squash ? s.r * s.squash : s.r), s.y); if (s.squash) ctx.ellipse(s.x, s.y, s.r * s.squash, s.r, 0, 0, TAU); else ctx.arc(s.x, s.y, s.r, 0, TAU); }
}
function shapePath(ctx, s) {
  ctx.beginPath();
  if (s.t === 'p') { ctx.moveTo(s.pts[0], s.pts[1]); for (let i = 2; i < s.pts.length; i += 2) ctx.lineTo(s.pts[i], s.pts[i + 1]); ctx.closePath(); if (s.hole) { const h = s.hole; ctx.moveTo(h[0], h[1]); for (let i = 2; i < h.length; i += 2) ctx.lineTo(h[i], h[i + 1]); ctx.closePath(); } }
  else if (s.t === 'r') { const r = Math.min(s.r, s.w / 2, s.h / 2); ctx.moveTo(s.x + r, s.y); ctx.arcTo(s.x + s.w, s.y, s.x + s.w, s.y + s.h, r); ctx.arcTo(s.x + s.w, s.y + s.h, s.x, s.y + s.h, r); ctx.arcTo(s.x, s.y + s.h, s.x, s.y, r); ctx.arcTo(s.x, s.y, s.x + s.w, s.y, r); ctx.closePath(); }
  else if (s.t === 'c') { if (s.squash) ctx.ellipse(s.x, s.y, s.r * s.squash, s.r, 0, 0, TAU); else ctx.arc(s.x, s.y, s.r, 0, TAU); }
}

// The three paints of a skin as they go on a given rifle.
function skinPaints(skin, A) {
  const fac = !skin || skin.kind === 'factory';
  return { furn: fac ? A.furn : skin.furn, metal: fac ? A.metal : skin.metal, acc: fac ? A.acc : (skin.acc || A.acc) };
}

// Draw a rifle centred in the box (cx, cy, w, h).
function drawGun(ctx, gunId, cfg, cx, cy, w, h, o) {
  o = o || {};
  const G = gunShapes(gunId, cfg), A = G.art;
  const skin = SKIN_BY_ID[(cfg && cfg.skin) || 'factory'] || SKINS[0];
  const paints = skinPaints(skin, A);
  const span = G.x1 - G.x0, hasTri = cfg && cfg.support === 'sp_tripod';
  const top = -15, bot = hasTri ? 28 : 17;
  const sc = Math.min(w / span, h / (bot - top)) * (o.fit || 0.96);
  const ox = cx - ((G.x0 + G.x1) / 2) * sc, oy = cy - ((top + bot) / 2) * sc;
  ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);
  const bounds = { x0: G.x0, x1: G.x1 }, solid = (c) => [{ fill: c, alpha: 1, blend: 'source-over' }];
  const fills = { furn: zoneLayers(ctx, paints.furn, bounds, o.time), metal: zoneLayers(ctx, paints.metal, bounds, o.time), acc: zoneLayers(ctx, paints.acc, bounds, o.time), rubber: solid(skin.rubber || '#0d0e10'), bag: solid('#b9a27e'), carbon: zoneLayers(ctx, { pat: 'carbon', a: '#2b2f35', b: '#14161a' }, bounds), glass: solid('#27384a') };
  const lineCol = skin.line || 'rgba(0,0,0,0.55)', lineW = skin.lineW || 0.28, lens = skin.lens || ['#8fd0ff', '#2a4a6a', '#b06cff'];
  if (o.shadow !== false) { // soft ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse((G.x0 + G.x1) / 2, bot - 1.2, span * 0.46, 1.5, 0, 0, TAU); ctx.fill();
  }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const order = G.sh.filter((s) => s.under).concat(G.sh.filter((s) => !s.under));
  // glow: a soft halo behind the rifle, built from a few wide faint outlines (no blur needed), breathing slowly
  if (skin.glow) {
    const k = 0.78 + 0.22 * Math.sin((o.time || 0) * 2.1);
    ctx.beginPath(); for (let i = 0; i < order.length; i++) if (order[i].t !== 'l') shapeTrace(ctx, order[i]);
    ctx.strokeStyle = skin.glow;
    for (const q of [[4.8, 0.06], [2.8, 0.1], [1.3, 0.2]]) { ctx.globalAlpha = q[1] * k; ctx.lineWidth = q[0]; ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  for (let i = 0; i < order.length; i++) {
    const s = order[i];
    if (s.t === 'l') { ctx.strokeStyle = s.col; ctx.lineWidth = s.w; ctx.beginPath(); ctx.moveTo(s.pts[0], s.pts[1]); for (let k = 2; k < s.pts.length; k += 2) ctx.lineTo(s.pts[k], s.pts[k + 1]); ctx.stroke(); continue; }
    shapePath(ctx, s);
    if (s.zone === 'coil') { ctx.fillStyle = '#6fe3ff'; ctx.shadowColor = '#6fe3ff'; ctx.shadowBlur = 8 * (0.7 + 0.3 * Math.sin((o.time || 0) * 4 + s.x)); ctx.fill(); }
    else if (s.glow && s.zone === 'glass') { ctx.fillStyle = '#ffaa3c'; ctx.shadowColor = '#ffaa3c'; ctx.shadowBlur = 6; ctx.fill(); }
    else fillLayers(ctx, fills[s.zone] || solid('#333'), s.hole ? 'evenodd' : null);
    ctx.shadowBlur = 0;
    if (s.lens) { const lg = ctx.createLinearGradient(s.x, s.y - s.r, s.x, s.y + s.r); lg.addColorStop(0, lens[0]); lg.addColorStop(0.5, lens[1]); lg.addColorStop(1, lens[2]); ctx.fillStyle = lg; ctx.fill(); }
    // light from above, shade below, on every piece
    if (s.zone !== 'rubber' && s.zone !== 'coil' && !s.lens) {
      const bb = s.t === 'r' ? [s.y, s.y + s.h] : s.t === 'c' ? [s.y - s.r, s.y + s.r] : (() => { let a = 1e9, b = -1e9; for (let k = 1; k < s.pts.length; k += 2) { a = Math.min(a, s.pts[k]); b = Math.max(b, s.pts[k]); } return [a, b]; })();
      const sg = ctx.createLinearGradient(0, bb[0], 0, bb[1]);
      sg.addColorStop(0, 'rgba(255,255,255,0.20)'); sg.addColorStop(0.25, 'rgba(255,255,255,0.03)'); sg.addColorStop(0.7, 'rgba(0,0,0,0.05)'); sg.addColorStop(1, 'rgba(0,0,0,0.38)');
      ctx.fillStyle = sg; if (s.hole) ctx.fill('evenodd'); else ctx.fill();
    }
    ctx.strokeStyle = lineCol; ctx.lineWidth = lineW; ctx.stroke();
  }
  // legendary shimmer: a band of light sweeping along the rifle
  if (skin.shimmer && o.time !== undefined) {
    const u = ((o.time * 0.35) % 1.6) - 0.3, bx = G.x0 + span * u;
    ctx.save(); ctx.beginPath();
    for (let i = 0; i < order.length; i++) { const s = order[i]; if (s.t === 'l' || s.zone === 'rubber' || s.zone === 'glass') continue; if (s.t === 'p') { ctx.moveTo(s.pts[0], s.pts[1]); for (let k = 2; k < s.pts.length; k += 2) ctx.lineTo(s.pts[k], s.pts[k + 1]); ctx.closePath(); } else if (s.t === 'r') ctx.rect(s.x, s.y, s.w, s.h); else ctx.arc(s.x, s.y, s.r, 0, TAU); }
    ctx.clip();
    const g2 = ctx.createLinearGradient(bx - 9, 0, bx + 9, 0); g2.addColorStop(0, 'rgba(255,255,255,0)'); g2.addColorStop(0.5, rgba(skin.shimmer, 0.55)); g2.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g2; ctx.transform(1, 0, -0.5, 1, 0, 0); ctx.fillRect(bx - 12, -40, 40, 90);
    ctx.restore();
  }
  ctx.restore();
  return { scale: sc };
}

// A small swatch for a skin (used in the collection grid). It is drawn in
// rifle units, so a pattern shows at the size it has on a real rifle: three
// slanted panels for furniture, metal and small parts, with the skin's own
// outline colour between them.
function drawSwatch(ctx, skin, x, y, w, h, time) {
  const k = h / 12, W = w / k, H = 12, sl = H * 0.28;
  const P = skinPaints(skin, GUN_ART.fenwick), cut = [-sl, W * 0.5, W * 0.82, W + sl], zones = ['furn', 'metal', 'acc'];
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.translate(x, y); ctx.scale(k, k);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(cut[i] + sl, 0); ctx.lineTo(cut[i + 1] + sl, 0); ctx.lineTo(cut[i + 1] - sl, H); ctx.lineTo(cut[i] - sl, H); ctx.closePath();
    fillLayers(ctx, zoneLayers(ctx, P[zones[i]], { x0: Math.max(0, cut[i]), x1: Math.min(W, cut[i + 1]) }, time));
  }
  ctx.strokeStyle = (skin && skin.line) || 'rgba(0,0,0,0.55)'; ctx.lineWidth = Math.max(0.3, (skin && skin.lineW) || 0.28);
  ctx.beginPath(); for (let i = 1; i < 3; i++) { ctx.moveTo(cut[i] + sl, 0); ctx.lineTo(cut[i] - sl, H); } ctx.stroke();
  const sg = ctx.createLinearGradient(0, 0, 0, H); sg.addColorStop(0, 'rgba(255,255,255,0.22)'); sg.addColorStop(0.4, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
  if (skin && skin.glow) { const gg = ctx.createLinearGradient(0, H * 0.55, 0, H); gg.addColorStop(0, rgba(skin.glow, 0)); gg.addColorStop(1, rgba(skin.glow, 0.5)); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}

// Reachable from the page (tests, and other files that want to paint with a skin).
CB.drawGun = drawGun; CB.SKINS = SKINS; CB.SKIN_BY_ID = SKIN_BY_ID; CB.RAR = RAR; CB.RAR_COL = RAR_COL; CB.GUN_ART = GUN_ART;
CB.drawSwatch = drawSwatch; CB.gunShapes = gunShapes; CB.paintTile = paintTile; CB.zoneFill = zoneFill; CB.zoneLayers = zoneLayers; CB.fillLayers = fillLayers; CB.PAT_KINDS = PAT_KINDS; CB.patCache = _patCache;
