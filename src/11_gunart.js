// ---------------------------------------------------------------------------
// Rifle artwork, drawn in code. Each rifle is built from the parts actually
// fitted (scope, muzzle, barrel, stock, support, magazine) and painted with
// the chosen skin. Units are roughly centimetres; the muzzle points right.
// ---------------------------------------------------------------------------
const RAR = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
const RAR_COL = ['#a9b4c0', '#5fd38a', '#6fb6ff', '#c58bff', '#ffb84a'];

// kind: how the skin is painted. Zones: furn = stock and handguard, metal =
// barrel and action, acc = scope, magazine and small parts.
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
  // uncommon: woods and simple camouflage
  { id: 'walnut', name: 'Oiled Walnut', r: 1, furn: { pat: 'wood', a: '#6b4026', b: '#4a2a17' }, metal: '#1d2024', acc: '#131518' },
  { id: 'birch', name: 'Birch Laminate', r: 1, furn: { pat: 'laminate', a: '#c9a36b', b: '#8a6238' }, metal: '#2b2e33', acc: '#17191c' },
  { id: 'woodland', name: 'Woodland', r: 1, furn: { pat: 'camo', cols: ['#4a5d3a', '#2e3a26', '#6b5a3c', '#1d2219'] }, metal: { pat: 'camo', cols: ['#4a5d3a', '#2e3a26', '#6b5a3c', '#1d2219'] }, acc: '#1a1c1a' },
  { id: 'desert', name: 'Dune', r: 1, furn: { pat: 'camo', cols: ['#c8b083', '#a88d5f', '#8a7350', '#ddcba4'] }, metal: { pat: 'camo', cols: ['#c8b083', '#a88d5f', '#8a7350', '#ddcba4'] }, acc: '#3b352b' },
  { id: 'snowcam', name: 'Whiteout', r: 1, furn: { pat: 'camo', cols: ['#eef2f5', '#cfd8df', '#9aa7b3', '#ffffff'] }, metal: { pat: 'camo', cols: ['#eef2f5', '#cfd8df', '#9aa7b3', '#ffffff'] }, acc: '#59626b' },
  { id: 'urban', name: 'Concrete', r: 1, furn: { pat: 'camo', cols: ['#6f767e', '#4a5058', '#9aa1a8', '#2b2f35'] }, metal: { pat: 'camo', cols: ['#6f767e', '#4a5058', '#9aa1a8', '#2b2f35'] }, acc: '#17191c' },
  { id: 'twotone', name: 'Signal Orange', r: 1, furn: '#e07b2a', metal: '#1c1e22', acc: '#101114' },
  { id: 'teal', name: 'Tidewater', r: 1, furn: '#2a9d8f', metal: '#20242a', acc: '#121418' },
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
  // epic
  { id: 'damascus', name: 'Damascus', r: 3, furn: { pat: 'wood', a: '#3a2418', b: '#1f120b' }, metal: { pat: 'damascus', a: '#8d98a3', b: '#3d454e' }, acc: { pat: 'damascus', a: '#8d98a3', b: '#3d454e' } },
  { id: 'circuit', name: 'Motherboard', r: 3, furn: { pat: 'circuit', a: '#0f3d2a', b: '#52e0a0' }, metal: '#151a18', acc: '#52e0a0' },
  { id: 'galaxy', name: 'Dark Sky', r: 3, furn: { pat: 'galaxy' }, metal: { pat: 'galaxy' }, acc: '#1a1430' },
  { id: 'sunset', name: 'Port Calder Sunset', r: 3, furn: { grad: ['#2a2a5c', '#b0447a', '#f2925a'] }, metal: { grad: ['#1a1a3c', '#70305a', '#b2603a'] }, acc: '#15152c' },
  { id: 'ivory', name: 'Ivory and Brass', r: 3, furn: '#efe6cf', metal: { grad: ['#d9b65a', '#a8822f', '#e8cc7a'] }, acc: '#a8822f', line: '#7a5c1c' },
  { id: 'frost', name: 'Black Ice', r: 3, furn: { pat: 'frost', a: '#0e1a26', b: '#9fd8ff' }, metal: { pat: 'frost', a: '#0b141d', b: '#6fb6ff' }, acc: '#08111a' },
  // legendary
  { id: 'midas', name: 'Midas', r: 4, furn: { pat: 'filigree', a: '#d9aa2e', b: '#fff0b0' }, metal: { grad: ['#fff2b8', '#d9aa2e', '#8a6412', '#f4d568'] }, acc: { grad: ['#fff2b8', '#d9aa2e', '#8a6412'] }, line: '#5a3f08', shimmer: '#fff8d8' },
  { id: 'kintsugi', name: 'Kintsugi', r: 4, furn: { pat: 'cracks', a: '#121316', b: '#f0c14a' }, metal: { pat: 'cracks', a: '#0c0d10', b: '#f0c14a' }, acc: '#0a0b0d', shimmer: '#ffe9a8' },
  { id: 'aurora', name: 'Aurora', r: 4, furn: { anim: 'aurora' }, metal: { anim: 'aurora' }, acc: '#0b1420', shimmer: '#d8fff0' },
  { id: 'obsidian', name: 'Magma', r: 4, furn: { pat: 'cracks', a: '#161012', b: '#ff5a1f' }, metal: { pat: 'cracks', a: '#0f0b0c', b: '#ff8a3a' }, acc: '#1a0f0c', glow: '#ff5a1f', shimmer: '#ffd0a0' },
  { id: 'blueprint', name: 'Blueprint', r: 4, furn: { pat: 'grid', a: '#1c4fa0', b: '#cfe3ff' }, metal: { pat: 'grid', a: '#173f82', b: '#cfe3ff' }, acc: '#123368', line: '#eaf2ff', shimmer: '#ffffff' },
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

const _patCache = {};
function patTile(key, w, h, fn) {
  if (_patCache[key]) return _patCache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); fn(x, w, h, makeRng(hashStr(key)));
  _patCache[key] = c; return c;
}
// Build a repeating texture for a paint definition.
function paintTile(p) {
  const key = JSON.stringify(p);
  const T = 96;
  switch (p.pat) {
    case 'wood': return patTile(key, 160, 48, (x, w, h, R) => { x.fillStyle = p.a; x.fillRect(0, 0, w, h); x.strokeStyle = p.b; for (let i = 0; i < 16; i++) { x.globalAlpha = R.r(0.25, 0.8); x.lineWidth = R.r(0.6, 2.2); const y = R.r(0, h); x.beginPath(); x.moveTo(-5, y); x.bezierCurveTo(w * 0.3, y + R.r(-5, 5), w * 0.6, y + R.r(-5, 5), w + 5, y); x.stroke(); } x.globalAlpha = 0.5; x.fillStyle = p.b; for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(R.r(0, w), R.r(0, h), R.r(5, 12), R.r(1.5, 3), 0, 0, TAU); x.fill(); } });
    case 'laminate': return patTile(key, 80, 48, (x, w, h, R) => { for (let y = 0; y < h; y += 4) { x.fillStyle = (y / 4) % 2 ? p.a : p.b; x.fillRect(0, y, w, 4); } x.strokeStyle = 'rgba(0,0,0,0.2)'; for (let i = 0; i < 9; i++) { const y = R.r(0, h); x.beginPath(); x.moveTo(0, y); x.lineTo(w, y + R.r(-2, 2)); x.stroke(); } });
    case 'camo': return patTile(key, T, T, (x, w, h, R) => { x.fillStyle = p.cols[0]; x.fillRect(0, 0, w, h); for (let i = 0; i < 26; i++) { x.fillStyle = p.cols[1 + (i % (p.cols.length - 1))]; const cx = R.r(0, w), cy = R.r(0, h); for (let ox = -w; ox <= w; ox += w) for (let oy = -h; oy <= h; oy += h) { x.beginPath(); for (let k = 0; k < 7; k++) { const an = (k / 7) * TAU, rr = R.r(6, 16); x.lineTo(cx + ox + Math.cos(an) * rr * 1.5, cy + oy + Math.sin(an) * rr * 0.8); } x.closePath(); x.fill(); } } });
    case 'digital': return patTile(key, T, T, (x, w, h, R) => { x.fillStyle = p.cols[0]; x.fillRect(0, 0, w, h); for (let i = 0; i < 150; i++) { x.fillStyle = p.cols[R.i(1, p.cols.length - 1)]; const s = 6; x.fillRect(R.i(0, w / s) * s, R.i(0, h / s) * s, s * R.i(1, 3), s * R.i(1, 2)); } });
    case 'tiger': return patTile(key, T, 64, (x, w, h, R) => { x.fillStyle = p.a; x.fillRect(0, 0, w, h); x.fillStyle = p.b; for (let i = 0; i < 9; i++) { const bx = (i / 9) * w + R.r(-3, 3); x.beginPath(); x.moveTo(bx, -2); x.bezierCurveTo(bx + R.r(4, 12), h * 0.3, bx - R.r(4, 12), h * 0.6, bx + R.r(-3, 6), h + 2); x.lineTo(bx + R.r(3, 7), h + 2); x.bezierCurveTo(bx - R.r(0, 8), h * 0.6, bx + R.r(8, 16), h * 0.3, bx + R.r(2, 6), -2); x.closePath(); x.fill(); } });
    case 'carbon': return patTile(key, 16, 16, (x) => { x.fillStyle = p.b; x.fillRect(0, 0, 16, 16); x.fillStyle = p.a; x.fillRect(0, 0, 8, 8); x.fillRect(8, 8, 8, 8); x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(0, 0, 8, 3); x.fillRect(8, 8, 8, 3); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 6, 8, 2); x.fillRect(8, 14, 8, 2); });
    case 'hex': return patTile(key, 42, 48, (x, w, h) => { x.fillStyle = p.b; x.fillRect(0, 0, w, h); x.strokeStyle = p.a; x.lineWidth = 2.2; const hx = (cx, cy) => { x.beginPath(); for (let k = 0; k < 6; k++) { const an = (k / 6) * TAU + Math.PI / 6; x.lineTo(cx + Math.cos(an) * 13, cy + Math.sin(an) * 13); } x.closePath(); x.stroke(); }; hx(0, 0); hx(w, 0); hx(0, h); hx(w, h); hx(w / 2, h / 2); });
    case 'topo': return patTile(key, T, T, (x, w, h, R) => { x.fillStyle = p.a; x.fillRect(0, 0, w, h); x.strokeStyle = p.b; x.lineWidth = 1.1; for (let c = 0; c < 4; c++) { const cx = R.r(0, w), cy = R.r(0, h); for (let r = 5; r < 42; r += 7) for (let ox = -w; ox <= w; ox += w) for (let oy = -h; oy <= h; oy += h) { x.globalAlpha = 0.75; x.beginPath(); x.ellipse(cx + ox, cy + oy, r * 1.3, r * 0.8, c, 0, TAU); x.stroke(); } } });
    case 'stripes': return patTile(key, 40, 40, (x) => { x.fillStyle = p.a; x.fillRect(0, 0, 40, 40); x.fillStyle = p.b; x.beginPath(); x.moveTo(0, 40); x.lineTo(20, 40); x.lineTo(40, 20); x.lineTo(40, 0); x.closePath(); x.fill(); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, 20); x.lineTo(20, 0); x.closePath(); x.fill(); });
    case 'splat': return patTile(key, T, T, (x, w, h, R) => { x.fillStyle = p.base; x.fillRect(0, 0, w, h); for (let i = 0; i < 22; i++) { x.fillStyle = R.pick(p.cols); const cx = R.r(0, w), cy = R.r(0, h), r = R.r(3, 11); for (let ox = -w; ox <= w; ox += w) for (let oy = -h; oy <= h; oy += h) { x.beginPath(); x.arc(cx + ox, cy + oy, r, 0, TAU); x.fill(); for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(cx + ox + R.r(-r, r) * 2, cy + oy + R.r(-r, r) * 2, r * 0.22, 0, TAU); x.fill(); } } } });
    case 'plaid': return patTile(key, 48, 48, (x) => { x.fillStyle = p.a; x.fillRect(0, 0, 48, 48); x.fillStyle = p.b; x.globalAlpha = 0.55; x.fillRect(0, 0, 24, 48); x.fillRect(0, 0, 48, 24); x.globalAlpha = 0.35; x.fillStyle = '#fff'; x.fillRect(34, 0, 3, 48); x.fillRect(0, 34, 48, 3); });
    case 'damascus': return patTile(key, T, T, (x, w, h, R) => { x.fillStyle = p.b; x.fillRect(0, 0, w, h); x.strokeStyle = p.a; for (let y = -10; y < h + 10; y += 5) { x.lineWidth = R.r(1, 2.6); x.beginPath(); for (let xx = 0; xx <= w; xx += 4) { const yy = y + Math.sin((xx / w) * TAU * 2 + y * 0.35) * 6 + Math.sin((xx / w) * TAU * 5 + y) * 2; if (xx === 0) x.moveTo(xx, yy); else x.lineTo(xx, yy); } x.stroke(); } });
    case 'circuit': return patTile(key, T, T, (x, w, h, R) => { x.fillStyle = p.a; x.fillRect(0, 0, w, h); x.strokeStyle = p.b; x.fillStyle = p.b; x.lineWidth = 1.4; for (let i = 0; i < 16; i++) { let cx = R.i(0, 11) * 8 + 4, cy = R.i(0, 11) * 8 + 4; x.beginPath(); x.moveTo(cx, cy); for (let k = 0; k < 3; k++) { if (R.chance(0.5)) cx += R.pick([-16, 16, 24]); else cy += R.pick([-16, 16, 24]); x.lineTo(cx, cy); } x.stroke(); x.beginPath(); x.arc(cx, cy, 2.2, 0, TAU); x.fill(); } });
    case 'galaxy': return patTile(key, 128, 96, (x, w, h, R) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#0b0820'); g.addColorStop(0.5, '#2a1650'); g.addColorStop(1, '#0b0820'); x.fillStyle = g; x.fillRect(0, 0, w, h); for (let i = 0; i < 5; i++) { const gg = x.createRadialGradient(R.r(0, w), R.r(0, h), 0, R.r(0, w), R.r(0, h), 40); gg.addColorStop(0, R.pick(['rgba(180,80,220,0.35)', 'rgba(60,140,255,0.3)', 'rgba(255,120,160,0.25)'])); gg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gg; x.fillRect(0, 0, w, h); } x.fillStyle = '#fff'; for (let i = 0; i < 70; i++) { x.globalAlpha = R.r(0.3, 1); x.fillRect(R.r(0, w), R.r(0, h), R.r(0.5, 1.6), R.r(0.5, 1.6)); } });
    case 'frost': return patTile(key, T, T, (x, w, h, R) => { x.fillStyle = p.a; x.fillRect(0, 0, w, h); x.strokeStyle = p.b; x.lineWidth = 0.9; for (let i = 0; i < 9; i++) { const cx = R.r(0, w), cy = R.r(0, h); x.globalAlpha = R.r(0.3, 0.8); for (let k = 0; k < 6; k++) { const an = (k / 6) * TAU + i, l = R.r(8, 20); x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(an) * l, cy + Math.sin(an) * l); x.stroke(); x.beginPath(); x.moveTo(cx + Math.cos(an) * l * 0.6, cy + Math.sin(an) * l * 0.6); x.lineTo(cx + Math.cos(an + 0.6) * l * 0.85, cy + Math.sin(an + 0.6) * l * 0.85); x.stroke(); } } });
    case 'filigree': return patTile(key, 64, 64, (x, w, h) => { x.fillStyle = p.a; x.fillRect(0, 0, w, h); x.strokeStyle = p.b; x.lineWidth = 1.3; x.globalAlpha = 0.8; for (const q of [[16, 16, 1], [48, 48, 1], [48, 16, -1], [16, 48, -1]]) { x.beginPath(); for (let a = 0; a < TAU * 1.6; a += 0.2) { const r = 1.5 + a * 1.7; x.lineTo(q[0] + Math.cos(a * q[2]) * r, q[1] + Math.sin(a * q[2]) * r); } x.stroke(); } });
    case 'cracks': return patTile(key, 128, 96, (x, w, h, R) => { x.fillStyle = p.a; x.fillRect(0, 0, w, h); x.strokeStyle = p.b; x.shadowColor = p.b; x.shadowBlur = 3; for (let i = 0; i < 9; i++) { let cx = R.r(0, w), cy = R.r(0, h); x.lineWidth = R.r(0.8, 2.2); x.beginPath(); x.moveTo(cx, cy); for (let k = 0; k < 7; k++) { cx += R.r(-18, 18); cy += R.r(-14, 14); x.lineTo(cx, cy); } x.stroke(); } });
    case 'grid': return patTile(key, 40, 40, (x) => { x.fillStyle = p.a; x.fillRect(0, 0, 40, 40); x.strokeStyle = p.b; x.globalAlpha = 0.5; x.lineWidth = 0.7; for (let i = 0; i <= 40; i += 10) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 40); x.moveTo(0, i); x.lineTo(40, i); x.stroke(); } x.globalAlpha = 0.9; x.lineWidth = 1.2; x.strokeRect(0, 0, 40, 40); });
    default: return null;
  }
}

// Resolve a zone's paint to something the canvas can fill with.
function zoneFill(ctx, paint, bounds, time) {
  if (!paint) return '#333';
  if (typeof paint === 'string') return paint;
  if (paint.grad) { const g = ctx.createLinearGradient(bounds.x0, 0, bounds.x1, 0); paint.grad.forEach((c, i) => g.addColorStop(i / (paint.grad.length - 1), c)); return g; }
  if (paint.anim === 'aurora') { const g = ctx.createLinearGradient(bounds.x0, -14, bounds.x1, 14); const t = (time || 0) * 0.12; const cols = ['#0b2a3a', '#19d3a2', '#4a7dff', '#b05cff', '#19d3a2', '#0b2a3a']; cols.forEach((c, i) => g.addColorStop(((i / (cols.length - 1)) * 0.6 + t) % 1, c)); return g; }
  const tile = paintTile(paint);
  if (!tile) return paint.a || '#444';
  const pt = ctx.createPattern(tile, 'repeat');
  if (pt.setTransform) pt.setTransform(new DOMMatrix().scale(0.22));
  return pt;
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

function shapePath(ctx, s) {
  ctx.beginPath();
  if (s.t === 'p') { ctx.moveTo(s.pts[0], s.pts[1]); for (let i = 2; i < s.pts.length; i += 2) ctx.lineTo(s.pts[i], s.pts[i + 1]); ctx.closePath(); if (s.hole) { const h = s.hole; ctx.moveTo(h[0], h[1]); for (let i = 2; i < h.length; i += 2) ctx.lineTo(h[i], h[i + 1]); ctx.closePath(); } }
  else if (s.t === 'r') { const r = Math.min(s.r, s.w / 2, s.h / 2); ctx.moveTo(s.x + r, s.y); ctx.arcTo(s.x + s.w, s.y, s.x + s.w, s.y + s.h, r); ctx.arcTo(s.x + s.w, s.y + s.h, s.x, s.y + s.h, r); ctx.arcTo(s.x, s.y + s.h, s.x, s.y, r); ctx.arcTo(s.x, s.y, s.x + s.w, s.y, r); ctx.closePath(); }
  else if (s.t === 'c') { if (s.squash) ctx.ellipse(s.x, s.y, s.r * s.squash, s.r, 0, 0, TAU); else ctx.arc(s.x, s.y, s.r, 0, TAU); }
}

// Draw a rifle centred in the box (cx, cy, w, h).
function drawGun(ctx, gunId, cfg, cx, cy, w, h, o) {
  o = o || {};
  const G = gunShapes(gunId, cfg), A = G.art;
  const skin = SKIN_BY_ID[(cfg && cfg.skin) || 'factory'] || SKINS[0];
  const fac = skin.kind === 'factory';
  const paints = { furn: fac ? A.furn : skin.furn, metal: fac ? A.metal : skin.metal, acc: fac ? A.acc : (skin.acc || A.acc) };
  const span = G.x1 - G.x0, hasTri = cfg && cfg.support === 'sp_tripod';
  const top = -15, bot = hasTri ? 28 : 17;
  const sc = Math.min(w / span, h / (bot - top)) * (o.fit || 0.96);
  const ox = cx - ((G.x0 + G.x1) / 2) * sc, oy = cy - ((top + bot) / 2) * sc;
  ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);
  const bounds = { x0: G.x0, x1: G.x1 };
  const fills = { furn: zoneFill(ctx, paints.furn, bounds, o.time), metal: zoneFill(ctx, paints.metal, bounds, o.time), acc: zoneFill(ctx, paints.acc, bounds, o.time), rubber: '#0d0e10', bag: '#b9a27e', carbon: zoneFill(ctx, { pat: 'carbon', a: '#2b2f35', b: '#14161a' }, bounds), glass: '#27384a' };
  const lineCol = skin.line || 'rgba(0,0,0,0.55)';
  if (o.shadow !== false) { // soft ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse((G.x0 + G.x1) / 2, bot - 1.2, span * 0.46, 1.5, 0, 0, TAU); ctx.fill();
  }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const order = G.sh.filter((s) => s.under).concat(G.sh.filter((s) => !s.under));
  for (let i = 0; i < order.length; i++) {
    const s = order[i];
    if (s.t === 'l') { ctx.strokeStyle = s.col; ctx.lineWidth = s.w; ctx.beginPath(); ctx.moveTo(s.pts[0], s.pts[1]); for (let k = 2; k < s.pts.length; k += 2) ctx.lineTo(s.pts[k], s.pts[k + 1]); ctx.stroke(); continue; }
    shapePath(ctx, s);
    ctx.fillStyle = fills[s.zone] || '#333';
    if (s.zone === 'coil') { ctx.fillStyle = '#6fe3ff'; ctx.shadowColor = '#6fe3ff'; ctx.shadowBlur = 8 * (0.7 + 0.3 * Math.sin((o.time || 0) * 4 + s.x)); }
    if (s.glow && s.zone === 'glass') { ctx.fillStyle = '#ffaa3c'; ctx.shadowColor = '#ffaa3c'; ctx.shadowBlur = 6; }
    if (s.hole) ctx.fill('evenodd'); else ctx.fill();
    ctx.shadowBlur = 0;
    if (s.lens) { const lg = ctx.createLinearGradient(s.x, s.y - s.r, s.x, s.y + s.r); lg.addColorStop(0, '#8fd0ff'); lg.addColorStop(0.5, '#2a4a6a'); lg.addColorStop(1, '#b06cff'); ctx.fillStyle = lg; ctx.fill(); }
    // light from above, shade below, on every piece
    if (s.zone !== 'rubber' && s.zone !== 'coil' && !s.lens) {
      const bb = s.t === 'r' ? [s.y, s.y + s.h] : s.t === 'c' ? [s.y - s.r, s.y + s.r] : (() => { let a = 1e9, b = -1e9; for (let k = 1; k < s.pts.length; k += 2) { a = Math.min(a, s.pts[k]); b = Math.max(b, s.pts[k]); } return [a, b]; })();
      const sg = ctx.createLinearGradient(0, bb[0], 0, bb[1]);
      sg.addColorStop(0, 'rgba(255,255,255,0.20)'); sg.addColorStop(0.25, 'rgba(255,255,255,0.03)'); sg.addColorStop(0.7, 'rgba(0,0,0,0.05)'); sg.addColorStop(1, 'rgba(0,0,0,0.38)');
      ctx.fillStyle = sg; if (s.hole) ctx.fill('evenodd'); else ctx.fill();
    }
    ctx.strokeStyle = lineCol; ctx.lineWidth = 0.28; ctx.stroke();
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

// A small swatch for a skin (used in the collection grid).
function drawSwatch(ctx, skin, x, y, w, h, time) {
  const b = { x0: x, x1: x + w };
  ctx.save();
  const half = w / 2;
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const f1 = skin.kind === 'factory' ? zoneFill(ctx, { pat: 'wood', a: '#7a4a2a', b: '#55301a' }, b) : zoneFill(ctx, skin.furn, b, time), f2 = skin.kind === 'factory' ? '#1e2125' : zoneFill(ctx, skin.metal, b, time);
  ctx.fillStyle = f1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + half + h * 0.3, y); ctx.lineTo(x + half - h * 0.3, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = f2; ctx.beginPath(); ctx.moveTo(x + half + h * 0.3, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x + half - h * 0.3, y + h); ctx.closePath(); ctx.fill();
  const sg = ctx.createLinearGradient(0, y, 0, y + h); sg.addColorStop(0, 'rgba(255,255,255,0.22)'); sg.addColorStop(0.4, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = sg; ctx.fillRect(x, y, w, h);
  ctx.restore();
}

CB.drawGun = drawGun; CB.SKINS = SKINS;
