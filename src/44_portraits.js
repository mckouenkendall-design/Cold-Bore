// ---------------------------------------------------------------------------
// Portraits of the people in the story, drawn in code in the game's own style: the head is the
// same dark silhouette the stick figures have (a round head, a little jaw and nose, no face),
// lit from one side, and who it is comes from the hair, the hat, the clothes and the one thing
// each of them always has: Marlow's headset, Pip's goggles, Varga's umbrella, Rook's white smock.
//
//   CB.portrait(ctx, who, x, y, size, mood)
//     ctx    a 2D canvas context, in CSS pixels (any transform already on it is respected)
//     who    'marlow', 'pip', 'varga', 'rook', 'aurel', 'reyes', 'kestrel', 'august', 'maeve',
//            'dutch', 'brandt', 'rusk', or a speaker name as missions write it ('Marlow', 'Pip',
//            'Detective Varga'); anyone else gets a plain silhouette
//     x, y   the top left corner of a size x size square; the portrait fills it, rounded corners
//            and backing included
//     mood   optional: 'calm' (the default), 'talk' (the jaw moves; pass t below to animate it),
//            'grim' (cold light) or 'alarm' (red light). Or an object:
//            { mood, t: seconds for 'talk', frame: false to leave out the backing and border }
//   It is cheap enough to call every frame: each look is drawn once per size into a small
//   canvas and then copied, and 'talk' only switches between two of those.
//
//   CB.portraitKey(who)   the id a name resolves to ('Detective Varga' gives 'varga'), or null
//   CB.portraitName(who)  how to write that person's name ('Marlow', 'Detective Varga')
//   CB.portraitCol(who)   the person's light colour, for a matching accent next to the portrait
// ---------------------------------------------------------------------------
const PORTRAITS = {
  // the handler: a voice in your ear. Dark bob, a slim headset with a boom microphone, a high collar.
  marlow: { name: 'Marlow', key: '#ffb35c', bg: '#202833', hair: 'bob', hairCol: '#2b2522', coat: '#323b47', collar: 'turtle', props: ['headset'] },
  // the armourer: curls tied up, amber goggles pushed up on her forehead, a canvas apron, a pencil.
  pip: { name: 'Pip', key: '#ffc46b', bg: '#2a2620', hair: 'puff', hairCol: '#1c1612', coat: '#5d6a46', collar: 'apron', props: ['goggles', 'pencil'] },
  // the detective: long dark hair, a tan trench coat with the collar up, a black umbrella over her, rain.
  varga: { name: 'Detective Varga', key: '#9cc8ff', bg: '#1b2430', hair: 'long', hairCol: '#2a1d16', coat: '#a88a5c', collar: 'trench', props: ['umbrella', 'rain'] },
  // the spotter: a white snow smock with the hood up and a white wrap over the lower face.
  rook: { name: 'Rook', key: '#cfe2f5', bg: '#24303c', hat: 'hood', hatCol: '#e9eef3', coat: '#e2e8ee', collar: 'smock', props: ['wrap'] },
  // the client: silver hair swept back, a dark suit, white shirt, a thin dark tie and a gold pin.
  aurel: { name: 'Caspian Aurel', key: '#ffd27a', bg: '#1d1a22', hair: 'swept', hairCol: '#c9ccd2', coat: '#1d2129', collar: 'suit', props: ['tie', 'pin'] },
  // the dock worker: a knitted hat, a short beard and a high-visibility jacket.
  reyes: { name: 'Tomas Reyes', key: '#ffb35c', bg: '#1d2630', hat: 'beanie', hatCol: '#7a3b2e', beard: '#3a2c22', coat: '#e47b1d', collar: 'hivis', props: [] },
  // you: a dark cap, a scarf, a rifle sling across the chest.
  kestrel: { name: 'Kestrel', key: '#ffaa3c', bg: '#1a2029', hat: 'cap', hatCol: '#2a2f36', coat: '#3c4636', collar: 'scarf', scarfCol: '#5b4a3a', props: ['sling'] },
  // the old man of the Calloway family: white hair, a green coat.
  august: { name: 'August Calloway', key: '#e9d6a6', bg: '#1f2620', hair: 'white', hairCol: '#e8e8e2', coat: '#3f5a3a', collar: 'coat', props: ['tie'] },
  // his daughter, who ran the docks: white hair, a red coat.
  maeve: { name: 'Maeve Calloway', key: '#ffb3a0', bg: '#2a1f22', hair: 'bob', hairCol: '#eeeeea', coat: '#b3302c', collar: 'coat', props: [] },
  // the street boss: a hat with a band, a heavy coat.
  dutch: { name: 'Dutch Pell', key: '#ffb35c', bg: '#22201c', hat: 'fedora', hatCol: '#2b2622', band: '#7a5a3a', coat: '#4a4038', collar: 'coat', props: ['cig'] },
  // the journalist: round glasses, hair tied back, a scarf.
  brandt: { name: 'Nadia Brandt', key: '#b8d8ff', bg: '#1d2430', hair: 'bun', hairCol: '#5a3a24', coat: '#4c5a6e', collar: 'scarf', scarfCol: '#c46a3a', props: ['glasses'] },
  // the councillor: grey hair, glasses, a suit.
  rusk: { name: 'Edwin Rusk', key: '#ffd27a', bg: '#1f222a', hair: 'short', hairCol: '#8f949a', coat: '#2b3340', collar: 'suit', props: ['glasses', 'tie'] },
  // anyone else on the radio
  someone: { name: '', key: '#c3ccd6', bg: '#1d242e', hair: 'short', hairCol: '#3a3430', coat: '#3a4350', collar: 'coat', props: [] },
};
const PORTRAIT_ALIAS = { kestrel: 'kestrel', you: 'kestrel', 'detective varga': 'varga', 'ines varga': 'varga', 'caspian aurel': 'aurel', 'tomas reyes': 'reyes', 'august calloway': 'august', 'maeve calloway': 'maeve', 'dutch pell': 'dutch', 'nadia brandt': 'brandt', 'edwin rusk': 'rusk', 'philippa okoro': 'pip', 'councillor rusk': 'rusk' };
const PORTRAIT_INK = '#13161b';
const portraitCache = {};
const portraitKeys = [];

CB.portraitKey = function (who) {
  if (!who) return null;
  const s = String(who).trim().toLowerCase();
  if (PORTRAITS[s]) return s;
  if (PORTRAIT_ALIAS[s]) return PORTRAIT_ALIAS[s];
  for (const k in PORTRAITS) if (k !== 'someone' && s.indexOf(k) >= 0) return k; // "Varga (radio)", "Pip, on the radio"
  return null;
};
CB.portraitName = function (who) { const k = CB.portraitKey(who); return k ? PORTRAITS[k].name : String(who || ''); };
CB.portraitCol = function (who) { const k = CB.portraitKey(who); return (PORTRAITS[k] || PORTRAITS.someone).key; };

// A colour a little darker or lighter, for shading cloth.
function ptShade(hex, k) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex); if (!m) return hex;
  const n = parseInt(m[1], 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (k < 0) { r *= 1 + k; g *= 1 + k; b *= 1 + k; } else { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
  return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
}
function ptRgba(hex, a) { const m = /^#([0-9a-f]{6})$/i.exec(hex); if (!m) return 'rgba(255,255,255,' + a + ')'; const n = parseInt(m[1], 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
function ptRound(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

// Draw one portrait into a unit square (0..1 both ways, y down). The head looks to the right.
// jaw: 0 shut, 1 open (talking). light: the colour of the light on the near edge.
function ptDraw(c, P, o) {
  const key = o.light || P.key, frame = o.frame !== false, px = 1 / o.size;
  // ---- the backing: a dark card, a pool of the person's light behind the head, a vignette ----
  if (frame) {
    ptRound(c, 0, 0, 1, 1, 0.14); c.save(); c.clip();
    const bg = c.createLinearGradient(0, 0, 0, 1); bg.addColorStop(0, ptShade(P.bg, 0.08)); bg.addColorStop(1, ptShade(P.bg, -0.55));
    c.fillStyle = bg; c.fillRect(0, 0, 1, 1);
    const gl = c.createRadialGradient(0.62, 0.36, 0, 0.62, 0.36, 0.62); gl.addColorStop(0, ptRgba(key, 0.42)); gl.addColorStop(0.5, ptRgba(key, 0.12)); gl.addColorStop(1, ptRgba(key, 0));
    c.fillStyle = gl; c.fillRect(0, 0, 1, 1);
  } else { c.save(); }
  const props = P.props || [];
  // rain behind everything, and the umbrella's canopy over the head
  if (props.indexOf('rain') >= 0) {
    c.strokeStyle = ptRgba('#cfe0f5', 0.22); c.lineWidth = Math.max(px * 0.8, 0.006); c.beginPath();
    for (let i = 0; i < 16; i++) { const rx = ((i * 0.377) % 1) * 1.1 - 0.05, ry = ((i * 0.611) % 1) * 0.8 + 0.12; c.moveTo(rx, ry); c.lineTo(rx - 0.025, ry + 0.11); }
    c.stroke();
  }
  // ---- shoulders and clothes ----
  const coat = P.coat, sh = (k) => ptShade(coat, k);
  const body = () => { c.beginPath(); c.moveTo(0.04, 1.02); c.bezierCurveTo(0.06, 0.82, 0.2, 0.74, 0.4, 0.72); c.lineTo(0.62, 0.72); c.bezierCurveTo(0.82, 0.74, 0.95, 0.84, 0.98, 1.02); c.closePath(); };
  body(); const cg = c.createLinearGradient(0, 0.72, 0, 1); cg.addColorStop(0, sh(0.06)); cg.addColorStop(1, sh(-0.45)); c.fillStyle = cg; c.fill();
  // the lit edge of the near shoulder
  c.strokeStyle = ptRgba(key, 0.55); c.lineWidth = Math.max(px * 1.4, 0.012); c.beginPath(); c.moveTo(0.64, 0.725); c.bezierCurveTo(0.83, 0.75, 0.94, 0.85, 0.965, 0.98); c.stroke();
  const col = P.collar;
  if (col === 'suit') { // shirt, lapels
    c.fillStyle = '#e9ecef'; c.beginPath(); c.moveTo(0.43, 0.72); c.lineTo(0.6, 0.72); c.lineTo(0.55, 0.92); c.closePath(); c.fill();
    c.fillStyle = sh(-0.2); c.beginPath(); c.moveTo(0.41, 0.72); c.lineTo(0.5, 0.86); c.lineTo(0.44, 1.02); c.lineTo(0.3, 1.02); c.closePath(); c.moveTo(0.62, 0.72); c.lineTo(0.55, 0.88); c.lineTo(0.6, 1.02); c.lineTo(0.74, 1.02); c.closePath(); c.fill();
  } else if (col === 'turtle') {
    c.fillStyle = sh(-0.12); ptRound(c, 0.4, 0.66, 0.22, 0.1, 0.03); c.fill();
    c.strokeStyle = sh(-0.32); c.lineWidth = Math.max(px, 0.008); c.beginPath(); c.moveTo(0.41, 0.69); c.lineTo(0.61, 0.69); c.moveTo(0.41, 0.72); c.lineTo(0.61, 0.72); c.stroke();
  } else if (col === 'trench') { // a collar turned up round the neck, and the coat's front edge
    c.fillStyle = sh(0.1); c.beginPath(); c.moveTo(0.36, 0.76); c.lineTo(0.4, 0.6); c.lineTo(0.47, 0.74); c.closePath(); c.moveTo(0.66, 0.76); c.lineTo(0.63, 0.6); c.lineTo(0.56, 0.74); c.closePath(); c.fill();
    c.strokeStyle = sh(-0.35); c.lineWidth = Math.max(px, 0.008); c.beginPath(); c.moveTo(0.5, 0.76); c.lineTo(0.56, 1.02); c.stroke();
    c.fillStyle = sh(-0.3); c.beginPath(); c.arc(0.6, 0.9, 0.012, 0, TAU); c.arc(0.61, 0.97, 0.012, 0, TAU); c.fill();
  } else if (col === 'apron') { // a canvas bib over a dark shirt
    c.fillStyle = '#3a3330'; c.beginPath(); c.moveTo(0.4, 0.72); c.lineTo(0.62, 0.72); c.lineTo(0.6, 0.8); c.lineTo(0.42, 0.8); c.closePath(); c.fill();
    c.fillStyle = sh(0.08); ptRound(c, 0.36, 0.8, 0.3, 0.3, 0.02); c.fill();
    c.strokeStyle = sh(-0.3); c.lineWidth = Math.max(px, 0.008); c.beginPath(); c.moveTo(0.38, 0.8); c.lineTo(0.31, 0.73); c.moveTo(0.64, 0.8); c.lineTo(0.7, 0.73); c.stroke();
    c.fillStyle = sh(-0.18); ptRound(c, 0.43, 0.88, 0.16, 0.1, 0.01); c.fill(); // a pocket
    c.fillStyle = '#c9a25a'; c.fillRect(0.47, 0.86, 0.012, 0.04); c.fillStyle = '#9aa5b2'; c.fillRect(0.5, 0.855, 0.01, 0.045); // a pencil and a screwdriver in it
  } else if (col === 'smock') { // loose white cloth with soft folds
    c.strokeStyle = 'rgba(120,140,160,0.45)'; c.lineWidth = Math.max(px, 0.008); c.beginPath(); c.moveTo(0.3, 0.8); c.quadraticCurveTo(0.34, 0.9, 0.3, 1.0); c.moveTo(0.72, 0.8); c.quadraticCurveTo(0.68, 0.92, 0.74, 1.0); c.moveTo(0.5, 0.82); c.lineTo(0.52, 1.0); c.stroke();
  } else if (col === 'hivis') { // reflective bands
    c.fillStyle = '#e8f05a'; c.fillRect(0.12, 0.9, 0.82, 0.035); c.fillStyle = '#d7dde3'; c.fillRect(0.12, 0.915, 0.82, 0.008);
    c.fillStyle = sh(-0.25); c.beginPath(); c.moveTo(0.4, 0.72); c.lineTo(0.5, 0.82); c.lineTo(0.62, 0.72); c.closePath(); c.fill();
  } else if (col === 'scarf') {
    c.fillStyle = P.scarfCol || '#6a4a3a'; c.beginPath(); c.moveTo(0.36, 0.73); c.quadraticCurveTo(0.51, 0.8, 0.66, 0.72); c.lineTo(0.66, 0.66); c.quadraticCurveTo(0.51, 0.72, 0.38, 0.66); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0.42, 0.76); c.lineTo(0.38, 0.95); c.lineTo(0.46, 0.95); c.lineTo(0.47, 0.77); c.closePath(); c.fill();
  } else { // a plain coat collar
    c.fillStyle = sh(-0.18); c.beginPath(); c.moveTo(0.38, 0.72); c.lineTo(0.47, 0.82); c.lineTo(0.45, 0.72); c.closePath(); c.moveTo(0.64, 0.72); c.lineTo(0.55, 0.82); c.lineTo(0.57, 0.72); c.closePath(); c.fill();
  }
  if (props.indexOf('tie') >= 0) { c.fillStyle = col === 'suit' ? '#20242c' : '#5a2a2a'; c.beginPath(); c.moveTo(0.505, 0.74); c.lineTo(0.53, 0.74); c.lineTo(0.545, 0.92); c.lineTo(0.518, 0.95); c.lineTo(0.5, 0.92); c.closePath(); c.fill(); }
  if (props.indexOf('pin') >= 0) { c.fillStyle = '#ffd27a'; c.beginPath(); c.arc(0.66, 0.83, 0.014, 0, TAU); c.fill(); }
  if (props.indexOf('sling') >= 0) { c.strokeStyle = '#1f1a16'; c.lineWidth = 0.03; c.beginPath(); c.moveTo(0.3, 0.76); c.lineTo(0.78, 1.02); c.stroke(); c.strokeStyle = '#6a6f76'; c.lineWidth = Math.max(px, 0.008); c.strokeRect(0.5, 0.86, 0.04, 0.03); }

  // ---- the head: the game's dark silhouette, with a jaw and a nose so you can tell which way it looks ----
  const hx = 0.5, hy = 0.43, hr = 0.2, jaw = (o.jaw || 0) * 0.02;
  // hair that hangs behind the head
  if (P.hair === 'long') { c.fillStyle = P.hairCol; c.beginPath(); c.moveTo(hx - hr * 0.9, hy - hr * 0.3); c.quadraticCurveTo(hx - hr * 1.35, hy + hr * 1.4, hx - hr * 0.5, hy + hr * 1.75); c.lineTo(hx + hr * 0.2, hy + hr * 1.5); c.lineTo(hx + hr * 0.3, hy); c.closePath(); c.fill(); }
  if (P.hat === 'hood') { // the hood, behind and round the head
    c.fillStyle = ptShade(P.hatCol, -0.08); c.beginPath(); c.moveTo(hx + hr * 0.95, hy + hr * 1.35); c.bezierCurveTo(hx + hr * 1.45, hy - hr * 0.2, hx + hr * 0.9, hy - hr * 1.55, hx - hr * 0.15, hy - hr * 1.45);
    c.bezierCurveTo(hx - hr * 1.45, hy - hr * 1.3, hx - hr * 1.6, hy + hr * 0.5, hx - hr * 1.05, hy + hr * 1.55); c.closePath(); c.fill();
  }
  // neck
  c.fillStyle = PORTRAIT_INK; c.beginPath(); c.moveTo(hx - hr * 0.36, hy + hr * 0.62); c.quadraticCurveTo(hx - hr * 0.3, hy + hr * 1.2, hx - hr * 0.62, hy + hr * 1.55); c.lineTo(hx + hr * 0.62, hy + hr * 1.55); c.quadraticCurveTo(hx + hr * 0.3, hy + hr * 1.25, hx + hr * 0.36, hy + hr * 0.8); c.closePath(); c.fill();
  // skull, jaw, nose
  c.beginPath(); c.arc(hx, hy, hr, 0, TAU);
  c.moveTo(hx + hr * 0.3 + hr * 0.58, hy + hr * 0.46 + jaw); c.arc(hx + hr * 0.3, hy + hr * 0.46 + jaw, hr * 0.58, 0, TAU);
  c.moveTo(hx + hr * 0.86, hy + hr * 0.02); c.lineTo(hx + hr * 1.16, hy + hr * 0.28); c.lineTo(hx + hr * 0.9, hy + hr * 0.4); c.closePath();
  c.fill();
  if (jaw > 0.004) { c.fillStyle = 'rgba(0,0,0,0.6)'; c.beginPath(); c.moveTo(hx + hr * 0.95, hy + hr * 0.62); c.lineTo(hx + hr * 0.78, hy + hr * 0.62 + jaw * 0.8); c.lineTo(hx + hr * 0.95, hy + hr * 0.62 + jaw); c.closePath(); c.fill(); }
  // the light on the near edge of the head and jaw
  c.strokeStyle = ptRgba(key, 0.85); c.lineWidth = Math.max(px * 1.5, 0.014); c.lineCap = 'round';
  c.beginPath(); c.arc(hx, hy, hr - 0.008, -1.2, 0.05); c.stroke();
  c.strokeStyle = ptRgba(key, 0.45); c.beginPath(); c.arc(hx + hr * 0.3, hy + hr * 0.46 + jaw, hr * 0.58 - 0.008, -0.2, 1.1); c.stroke();
  // an ear, unless something covers it
  if (!P.hat && P.hair !== 'long' && props.indexOf('headset') < 0) { c.strokeStyle = 'rgba(120,130,145,0.35)'; c.lineWidth = Math.max(px, 0.008); c.beginPath(); c.arc(hx - hr * 0.2, hy + hr * 0.08, hr * 0.15, 1.3, 4.0); c.stroke(); }
  if (P.beard) { c.fillStyle = P.beard; c.beginPath(); c.arc(hx + hr * 0.32, hy + hr * 0.5 + jaw, hr * 0.62, 0.15, 2.6); c.quadraticCurveTo(hx + hr * 0.2, hy + hr * 0.2, hx + hr * 0.92, hy + hr * 0.66); c.closePath(); c.fill(); }
  // ---- hair on the head ----
  const hc = P.hairCol;
  if (P.hair && P.hat !== 'hood') {
    c.fillStyle = hc; c.beginPath();
    if (P.hair === 'bob') { c.moveTo(hx + hr * 0.62, hy - hr * 0.86); c.bezierCurveTo(hx + hr * 0.2, hy - hr * 1.32, hx - hr * 1.35, hy - hr * 1.0, hx - hr * 1.12, hy + hr * 0.5); c.lineTo(hx - hr * 0.98, hy + hr * 0.92); c.lineTo(hx - hr * 0.42, hy + hr * 0.86); c.quadraticCurveTo(hx - hr * 0.45, hy - hr * 0.2, hx + hr * 0.1, hy - hr * 0.4); c.quadraticCurveTo(hx + hr * 0.5, hy - hr * 0.5, hx + hr * 0.75, hy - hr * 0.45); c.closePath(); }
    else if (P.hair === 'puff') { c.arc(hx - hr * 0.35, hy - hr * 0.95, hr * 0.62, 0, TAU); c.moveTo(hx + hr * 0.6, hy - hr * 0.6); c.arc(hx, hy - hr * 0.1, hr * 1.06, -0.75, Math.PI + 0.35, true); c.closePath(); }
    else if (P.hair === 'long') { c.moveTo(hx + hr * 0.7, hy - hr * 0.78); c.bezierCurveTo(hx + hr * 0.1, hy - hr * 1.3, hx - hr * 1.3, hy - hr * 1.0, hx - hr * 1.08, hy + hr * 0.4); c.quadraticCurveTo(hx - hr * 0.6, hy - hr * 0.3, hx + hr * 0.75, hy - hr * 0.42); c.closePath(); }
    else if (P.hair === 'bun') { c.arc(hx - hr * 0.95, hy - hr * 0.35, hr * 0.36, 0, TAU); c.moveTo(hx + hr * 0.75, hy - hr * 0.45); c.arc(hx, hy, hr * 1.07, -0.55, Math.PI + 0.3, true); c.quadraticCurveTo(hx - hr * 0.3, hy - hr * 0.5, hx + hr * 0.75, hy - hr * 0.45); c.closePath(); }
    else if (P.hair === 'swept') { c.moveTo(hx + hr * 0.82, hy - hr * 0.6); c.bezierCurveTo(hx + hr * 0.4, hy - hr * 1.38, hx - hr * 1.3, hy - hr * 1.25, hx - hr * 1.1, hy + hr * 0.1); c.quadraticCurveTo(hx - hr * 0.7, hy - hr * 0.55, hx + hr * 0.82, hy - hr * 0.6); c.closePath(); }
    else { const R = hr * (P.hair === 'white' ? 1.1 : 1.07); c.moveTo(hx + hr * 0.72, hy - hr * 0.5); c.arc(hx, hy, R, -0.62, Math.PI + 0.25, true); c.quadraticCurveTo(hx - hr * 0.3, hy - hr * 0.45, hx + hr * 0.72, hy - hr * 0.5); c.closePath(); }
    c.fill();
    // a soft sheen where the light catches it, and a few strands
    c.strokeStyle = ptRgba('#ffffff', P.hair === 'white' || P.hair === 'swept' ? 0.35 : 0.16); c.lineWidth = Math.max(px, 0.009); c.beginPath();
    c.moveTo(hx + hr * 0.45, hy - hr * 0.85); c.quadraticCurveTo(hx - hr * 0.2, hy - hr * 1.0, hx - hr * 0.75, hy - hr * 0.5);
    c.moveTo(hx + hr * 0.2, hy - hr * 0.95); c.quadraticCurveTo(hx - hr * 0.5, hy - hr * 0.95, hx - hr * 0.95, hy - hr * 0.2); c.stroke();
  }
  // ---- hats ----
  if (P.hat === 'hood') { // the hood's opening frames the face
    c.strokeStyle = ptShade(P.hatCol, -0.25); c.lineWidth = 0.022; c.beginPath(); c.moveTo(hx + hr * 0.95, hy + hr * 1.25); c.bezierCurveTo(hx + hr * 1.35, hy - hr * 0.2, hx + hr * 0.85, hy - hr * 1.3, hx - hr * 0.1, hy - hr * 1.3); c.stroke();
    c.strokeStyle = ptRgba(key, 0.5); c.lineWidth = Math.max(px * 1.4, 0.012); c.beginPath(); c.moveTo(hx + hr * 0.6, hy - hr * 1.32); c.bezierCurveTo(hx + hr * 1.3, hy - hr * 1.05, hx + hr * 1.5, hy, hx + hr * 1.2, hy + hr * 1.0); c.stroke();
  } else if (P.hat === 'beanie') {
    c.fillStyle = P.hatCol; c.beginPath(); c.moveTo(hx - hr * 1.1, hy - hr * 0.15); c.bezierCurveTo(hx - hr * 1.2, hy - hr * 1.5, hx + hr * 1.1, hy - hr * 1.55, hx + hr * 1.0, hy - hr * 0.3); c.closePath(); c.fill();
    c.fillStyle = ptShade(P.hatCol, -0.2); c.beginPath(); c.moveTo(hx - hr * 1.12, hy - hr * 0.1); c.lineTo(hx + hr * 1.04, hy - hr * 0.32); c.lineTo(hx + hr * 1.0, hy - hr * 0.6); c.lineTo(hx - hr * 1.12, hy - hr * 0.42); c.closePath(); c.fill();
    c.strokeStyle = ptShade(P.hatCol, -0.3); c.lineWidth = Math.max(px, 0.007); c.beginPath(); for (let i = -4; i <= 4; i++) { const u = hx + i * hr * 0.24; c.moveTo(u, hy - hr * 0.5); c.lineTo(u + hr * 0.05, hy - hr * 1.05); } c.stroke();
  } else if (P.hat === 'cap') {
    c.fillStyle = P.hatCol; c.beginPath(); c.moveTo(hx - hr * 1.05, hy - hr * 0.2); c.bezierCurveTo(hx - hr * 1.05, hy - hr * 1.35, hx + hr * 1.0, hy - hr * 1.35, hx + hr * 0.98, hy - hr * 0.35); c.lineTo(hx + hr * 1.75, hy - hr * 0.25); c.lineTo(hx + hr * 1.7, hy - hr * 0.12); c.lineTo(hx - hr * 1.05, hy - hr * 0.1); c.closePath(); c.fill();
    c.strokeStyle = ptRgba(key, 0.5); c.lineWidth = Math.max(px, 0.009); c.beginPath(); c.moveTo(hx + hr * 0.98, hy - hr * 0.33); c.lineTo(hx + hr * 1.72, hy - hr * 0.23); c.stroke();
  } else if (P.hat === 'fedora') {
    c.fillStyle = P.hatCol; c.beginPath(); c.ellipse(hx + hr * 0.1, hy - hr * 0.42, hr * 1.75, hr * 0.2, -0.06, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(hx - hr * 0.95, hy - hr * 0.4); c.bezierCurveTo(hx - hr * 1.0, hy - hr * 1.65, hx + hr * 1.1, hy - hr * 1.7, hx + hr * 1.0, hy - hr * 0.45); c.closePath(); c.fill();
    c.fillStyle = P.band || '#7a3a2a'; c.beginPath(); c.moveTo(hx - hr * 0.97, hy - hr * 0.45); c.lineTo(hx + hr * 1.0, hy - hr * 0.5); c.lineTo(hx + hr * 1.02, hy - hr * 0.78); c.lineTo(hx - hr * 0.97, hy - hr * 0.72); c.closePath(); c.fill();
  }
  // ---- what each of them always has ----
  if (props.indexOf('headset') >= 0) {
    c.strokeStyle = '#555e69'; c.lineWidth = 0.022; c.beginPath(); c.arc(hx - hr * 0.1, hy - hr * 0.05, hr * 1.12, -2.4, -0.95); c.stroke();
    c.fillStyle = '#2a3038'; c.beginPath(); c.ellipse(hx - hr * 0.2, hy + hr * 0.06, hr * 0.3, hr * 0.38, 0.15, 0, TAU); c.fill();
    c.strokeStyle = ptRgba(key, 0.7); c.lineWidth = Math.max(px, 0.008); c.beginPath(); c.ellipse(hx - hr * 0.2, hy + hr * 0.06, hr * 0.3, hr * 0.38, 0.15, -1.2, 0.4); c.stroke();
    // the boom microphone, round in front of the mouth
    c.strokeStyle = '#3a414b'; c.lineWidth = 0.012; c.beginPath(); c.moveTo(hx - hr * 0.05, hy + hr * 0.3); c.quadraticCurveTo(hx + hr * 0.4, hy + hr * 0.95, hx + hr * 1.0, hy + hr * 0.72); c.stroke();
    c.fillStyle = '#1e2329'; c.beginPath(); c.arc(hx + hr * 1.02, hy + hr * 0.71, 0.018, 0, TAU); c.fill();
    c.fillStyle = '#ff5a4a'; c.beginPath(); c.arc(hx - hr * 0.32, hy + hr * 0.28, 0.008, 0, TAU); c.fill(); // a small red light: she is on the air
  }
  if (props.indexOf('goggles') >= 0) { // pushed up on the forehead
    c.strokeStyle = '#3a2e24'; c.lineWidth = 0.02; c.beginPath(); c.arc(hx, hy, hr * 1.02, -2.9, -0.55); c.stroke();
    const gx = hx + hr * 0.5, gy = hy - hr * 0.88;
    c.fillStyle = '#4a4038'; c.beginPath(); c.ellipse(gx, gy, hr * 0.42, hr * 0.27, -0.35, 0, TAU); c.fill();
    const lg = c.createRadialGradient(gx + 0.01, gy - 0.01, 0, gx, gy, hr * 0.3); lg.addColorStop(0, '#ffe6a8'); lg.addColorStop(0.5, '#ff9a2a'); lg.addColorStop(1, '#8a4a10');
    c.fillStyle = lg; c.beginPath(); c.ellipse(gx, gy, hr * 0.31, hr * 0.19, -0.35, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); c.ellipse(gx + hr * 0.08, gy - hr * 0.07, hr * 0.08, hr * 0.04, -0.35, 0, TAU); c.fill();
  }
  if (props.indexOf('pencil') >= 0 && !P.hat) { c.save(); c.translate(hx - hr * 0.3, hy + hr * 0.02); c.rotate(-0.5); c.fillStyle = '#e8c45a'; c.fillRect(-0.004, -0.06, 0.016, 0.1); c.fillStyle = '#f4d7b0'; c.fillRect(-0.004, 0.04, 0.016, 0.014); c.restore(); }
  if (props.indexOf('glasses') >= 0) { c.strokeStyle = '#c8d0d8'; c.lineWidth = Math.max(px * 1.2, 0.01); c.beginPath(); c.arc(hx + hr * 0.75, hy - hr * 0.02, hr * 0.2, 0, TAU); c.moveTo(hx + hr * 0.55, hy - hr * 0.02); c.lineTo(hx - hr * 0.25, hy + hr * 0.02); c.stroke(); c.fillStyle = 'rgba(160,190,220,0.25)'; c.beginPath(); c.arc(hx + hr * 0.75, hy - hr * 0.02, hr * 0.18, 0, TAU); c.fill(); }
  if (props.indexOf('wrap') >= 0) { // white cloth over the lower face, and a dark slit for the eyes
    c.fillStyle = '#e6ebf0'; c.beginPath(); c.moveTo(hx - hr * 0.95, hy + hr * 0.15); c.quadraticCurveTo(hx + hr * 0.6, hy + hr * 0.05, hx + hr * 1.2, hy + hr * 0.18); c.lineTo(hx + hr * 1.0, hy + hr * 1.05); c.quadraticCurveTo(hx, hy + hr * 1.4, hx - hr * 0.95, hy + hr * 0.95); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(110,130,150,0.55)'; c.lineWidth = Math.max(px, 0.008); c.beginPath(); c.moveTo(hx - hr * 0.6, hy + hr * 0.45); c.quadraticCurveTo(hx + hr * 0.3, hy + hr * 0.38, hx + hr * 1.05, hy + hr * 0.5); c.moveTo(hx - hr * 0.5, hy + hr * 0.75); c.quadraticCurveTo(hx + hr * 0.3, hy + hr * 0.72, hx + hr * 0.95, hy + hr * 0.82); c.stroke();
    c.fillStyle = 'rgba(207,226,245,0.9)'; c.beginPath(); c.arc(hx + hr * 0.82, hy - hr * 0.12, 0.009, 0, TAU); c.fill(); // a glint: he is watching
  }
  if (props.indexOf('cig') >= 0) { c.strokeStyle = '#e8e2d6'; c.lineWidth = 0.014; c.beginPath(); c.moveTo(hx + hr * 1.0, hy + hr * 0.62); c.lineTo(hx + hr * 1.45, hy + hr * 0.7); c.stroke(); c.fillStyle = '#ff7a2a'; c.beginPath(); c.arc(hx + hr * 1.47, hy + hr * 0.7, 0.01, 0, TAU); c.fill(); c.strokeStyle = 'rgba(220,225,230,0.25)'; c.lineWidth = 0.01; c.beginPath(); c.moveTo(hx + hr * 1.48, hy + hr * 0.66); c.bezierCurveTo(hx + hr * 1.3, hy + hr * 0.2, hx + hr * 1.7, hy - hr * 0.2, hx + hr * 1.5, hy - hr * 0.7); c.stroke(); }
  if (props.indexOf('umbrella') >= 0) { // a black umbrella over her, cut off by the top of the card
    c.fillStyle = '#121519'; c.beginPath(); c.moveTo(-0.08, 0.26); c.quadraticCurveTo(0.5, -0.12, 1.08, 0.2);
    for (let i = 6; i >= 0; i--) { const ux = -0.08 + i * (1.16 / 6), uy = 0.2 + (0.06 * (6 - i)) / 6, mx = ux + 1.16 / 12; c.quadraticCurveTo(mx, uy + 0.06, ux, uy); }
    c.closePath(); c.fill();
    c.strokeStyle = ptRgba(key, 0.55); c.lineWidth = Math.max(px * 1.4, 0.01); c.beginPath(); c.moveTo(0.1, 0.14); c.quadraticCurveTo(0.5, -0.05, 0.98, 0.12); c.stroke();
    c.strokeStyle = '#2a2f36'; c.lineWidth = 0.012; c.beginPath(); c.moveTo(0.82, 0.18); c.lineTo(0.86, 1.02); c.stroke();
    c.fillStyle = ptRgba('#cfe0f5', 0.5); for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(0.04 + i * 0.24, 0.27 + (i % 2) * 0.03, 0.007, 0, TAU); c.fill(); } // drips off the rim
  }
  c.restore();
  // ---- the frame: a dark border and a thin line of the person's light along the bottom ----
  if (frame) {
    const vg = c.createRadialGradient(0.5, 0.45, 0.35, 0.5, 0.5, 0.78); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ptRound(c, 0, 0, 1, 1, 0.14); c.fillStyle = vg; c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.14)'; c.lineWidth = Math.max(px, 0.008); ptRound(c, px * 0.5, px * 0.5, 1 - px, 1 - px, 0.14); c.stroke();
    c.fillStyle = ptRgba(key, 0.8); c.fillRect(0.2, 1 - Math.max(px * 2, 0.018), 0.6, Math.max(px * 2, 0.018));
  }
}

// What a mood does to the light.
const PT_MOOD = { alarm: '#ff5a48', grim: '#7fa6d6' };
CB.portrait = function (ctx, who, x, y, size, mood) {
  if (!ctx || !(size > 4)) return;
  const o = mood && typeof mood === 'object' ? mood : { mood };
  const k = CB.portraitKey(who) || 'someone', P = PORTRAITS[k], m = o.mood || 'calm';
  const talkOpen = m === 'talk' ? (Math.sin((o.t !== undefined ? o.t : performance.now() / 1000) * 17) > 0.15 ? 1 : 0) : 0;
  // draw each look once per size, then copy it
  let dpr = 2; try { const tr = ctx.getTransform(); dpr = Math.min(3, Math.max(1, Math.hypot(tr.a, tr.b) || 1)); } catch (e) { /* older browsers */ }
  const px = Math.max(8, Math.round(size * dpr)), id = k + '/' + m + '/' + talkOpen + '/' + (o.frame === false ? 0 : 1) + '/' + px;
  let cv = portraitCache[id];
  if (!cv) {
    cv = document.createElement('canvas'); cv.width = cv.height = px;
    const c = cv.getContext('2d'); c.scale(px, px);
    try { ptDraw(c, P, { jaw: talkOpen, light: PT_MOOD[m], frame: o.frame, size: px }); } catch (e) { /* a portrait is a nicety */ }
    portraitCache[id] = cv; portraitKeys.push(id);
    if (portraitKeys.length > 80) delete portraitCache[portraitKeys.shift()];
  }
  ctx.drawImage(cv, x, y, size, size);
};
// The stick figures, for the briefing's close-up of the target (drawn by src/03_figures.js).
CB.drawFigure = drawFigure;
