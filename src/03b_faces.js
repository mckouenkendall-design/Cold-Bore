// ---------------------------------------------------------------------------
// Faces, for people big enough in the scope to have one (FIG_FINE, about 110 px
// tall and up). Bold and graphic, in the style of the figures: two pale eyes on
// the black head, a lid that tells you the mood, a pupil that tells you where
// they are looking, a brow, and a mouth. Picture only.
//   calm        easy lids, looking ahead, a slow blink every few seconds
//   suspicious  narrowed eyes darting about, one brow up
//   alarmed     a guard: wide eyes, brows down hard, staring straight out at you
//   panicking   eyes wide open with small pupils, brows up, mouth open in a yell,
//               looking back over the shoulder as they run
//   wounded     screwed up with pain, teeth set
//   dead        lids half down over a blank stare, mouth slack
// The face is drawn on a ball: a feature sits at an angle round the head from
// the middle of the face, so the same numbers give the side view, the three
// quarter view of somebody turning and the front view.
// ---------------------------------------------------------------------------

// The expression: lid (how far the upper lid is down, 0 to 1), low (the lower lid up), brow (tilt:
// positive is down at the inner end, cross; negative is up at the inner end, worried), lift (brows
// raised), pup (pupil size), open (mouth), curve (mouth: up at the corners is positive), teeth.
const FACE_MOODS = {
  calm: { lid: 0.28, low: 0.04, brow: 0, lift: 0, pup: 1, open: 0, curve: 0.05, teeth: 0 },
  susp: { lid: 0.48, low: 0.16, brow: 0.22, lift: 0.1, pup: 1, open: 0, curve: -0.25, teeth: 0, odd: 1 },
  alarm: { lid: 0.06, low: 0, brow: 0.42, lift: -0.05, pup: 0.9, open: 0.25, curve: -0.4, teeth: 0 },
  panic: { lid: 0, low: 0, brow: -0.45, lift: 0.35, pup: 0.6, open: 0.9, curve: -0.5, teeth: 0 },
  hurt: { lid: 0.62, low: 0.24, brow: -0.4, lift: 0.1, pup: 0.9, open: 0.35, curve: -0.6, teeth: 1 },
  dead: { lid: 0.6, low: 0.05, brow: -0.1, lift: 0, pup: 0, open: 0.45, curve: -0.2, teeth: 0 },
};
// what someone is feeling right now, from what the game says about them
function faceMood(A) {
  if (A.dead) return 'dead';
  const s = A.state;
  if (s === 'panic' || s === 'flee') return 'panic';
  if (A.wounded && (A.t - (A._woundT || -9) < 6 || A.anim === 'walk' || A.anim === 'run')) return 'hurt';
  if (s === 'alarm' || s === 'alert') return 'alarm';
  if (s === 'susp' || A.distractUntil) return 'susp';
  return 'calm';
}
// where the eyes point: gx toward the way they face (1) or away (-1), 0 straight out of the picture at you;
// gy up. Guards on alert stare straight out at the scope.
const FACE_GAZE = [0, 0];
function faceGaze(A, mood, t, sd) {
  let gx = 0.6, gy = 0.05 * Math.sin(t * 0.37 + sd);
  if (mood === 'susp') { const k = Math.floor(t * 2.2 + sd); gx = Math.sin(k * 2.7 + sd) * 0.9; gy = 0.25 + 0.3 * Math.sin(k * 1.9); }
  else if (mood === 'alarm') { gx = 0.05; gy = 0.05; }
  else if (mood === 'panic') { gx = A.anim === 'run' || A.anim === 'panic' ? -0.75 + 0.2 * Math.sin(t * 5) : Math.sin(t * 3.1 + sd) * 0.8; gy = 0.1; }
  else if (mood === 'hurt') { gx = 0.3; gy = -0.35; }
  else if (A.anim === 'phone' || A.anim === 'sitphone' || A.anim === 'type' || A.anim === 'work' || A.anim === 'sweep') { gx = 0.7; gy = -0.6; } // down at what they are doing
  else if (A.anim === 'look') { gx = 0.9; gy = 0.1; }
  else { const k = Math.floor(t * 0.4 + sd); if (Math.sin(k * 3.3 + sd * 2) > 0.6) { gx = Math.sin(k * 1.7) * 0.8; gy = 0.15; } } // now and then a glance about
  FACE_GAZE[0] = gx; FACE_GAZE[1] = gy;
  return FACE_GAZE;
}

// Called by figHead in head space (origin the middle of the head, face toward +x when G.f is 1).
// part: 'eyes' or 'mouth' (the mouth goes on after a beard and before a mask).
function figFace(c, G, part) {
  const A = G.A, L = G.L, hr = FIG.headR, f = G.f, px = G.px;
  const mood = A._mood || 'calm', M = FACE_MOODS[mood], t = G.t, sd = G.seed;
  // which way the face points: phi is 0 looking straight at you, +-90 degrees side on. While somebody
  // turns, G.f runs through 0; seen from the front (G.back false) or from behind (no face at all).
  if (G.back) return;
  const phi = Math.asin(clamp(f, -1, 1));
  const at = (a) => Math.sin(phi + a), vis = (a) => Math.cos(phi + a);
  if (part === 'eyes') {
    // a blink every few seconds (never for the dead), and the lids of this mood
    const per = 2.8 + ((sd * 7.3) % 2.6), bt = (t + sd * 1.7) % per, blink = !A.dead && bt < 0.13 ? Math.sin(Math.PI * bt / 0.13) : 0;
    const lid = Math.min(1, M.lid + (1 - M.lid) * blink), low = M.low;
    const g = faceGaze(A, mood, t, sd), ey = G.hat === 'beanie' ? -0.014 : 0.016, rx0 = 0.035, ry = 0.04;
    const white = figC(mix('#efeadf', G.ink, 0.06)), sides = [-0.43, 0.43];
    // the eyes that can be seen, nearest last
    const E = FIG_TMP; let n = 0;
    for (let i = 0; i < 2; i++) { const a = sides[i] * Math.sign(f || 1), v = vis(a); if (v < 0.12) continue; E[n * 3] = hr * 0.93 * at(a); E[n * 3 + 1] = Math.max(0.55, v); E[n * 3 + 2] = a; n++; }
    if (!n) return;
    const open = mood === 'hurt' ? 0 : 1 - lid - low;
    // the whites
    if (open > 0.04) {
      c.fillStyle = white; c.beginPath();
      for (let i = 0; i < n; i++) { const x = E[i * 3], rx = rx0 * E[i * 3 + 1]; c.moveTo(x + rx, ey); c.ellipse(x, ey, rx, ry, 0, 0, TAU); }
      c.fill();
      // the lids: the head's own black over the top (tilted with the brow) and a little from below
      c.fillStyle = G.ink; c.beginPath();
      for (let i = 0; i < n; i++) {
        const x = E[i * 3], rx = rx0 * E[i * 3 + 1] + 0.004, a = E[i * 3 + 2], inner = -Math.sign(a); // +1: the inner corner is toward +x
        const tilt = (M.brow * 0.5 + (M.odd && i === n - 1 ? -0.25 : 0)) * ry, yl = ey + ry - 2 * ry * lid; // the lid line, lower at the inner corner when cross
        c.moveTo(x - rx, ey + ry + 0.01); c.lineTo(x + rx, ey + ry + 0.01); c.lineTo(x + rx, yl - tilt * inner); c.lineTo(x - rx, yl + tilt * inner); c.closePath();
        if (low > 0) { const yb = ey - ry + 2 * ry * low; c.moveTo(x - rx, ey - ry - 0.01); c.lineTo(x + rx, ey - ry - 0.01); c.lineTo(x + rx, yb); c.lineTo(x - rx, yb); c.closePath(); }
      }
      c.fill();
      // the pupils (none in a dead stare): toward where they look, foreshortened with the eye
      if (M.pup > 0) {
        const pr = 0.016 * M.pup, ylo = ey - ry + 2 * ry * low + pr * 0.6, yhi = ey + ry - 2 * ry * lid - pr * 0.4;
        c.beginPath();
        for (let i = 0; i < n; i++) {
          // ahead (gx 1) is toward the face side of the eye; straight out at you (gx 0) is its middle
          const x = E[i * 3], rx = rx0 * E[i * 3 + 1], cx = x + rx * 0.58 * g[0] * Math.sin(phi), py = clamp(ey + g[1] * ry * 0.5, ylo, Math.max(ylo, yhi));
          c.moveTo(cx + pr, py); c.arc(cx, py, pr, 0, TAU);
        }
        c.fill();
        // a catch light, close up
        if (G.hi && px < 0.006) { c.fillStyle = white; c.beginPath(); for (let i = 0; i < n; i++) { const x = E[i * 3]; c.moveTo(x + 0.006, ey + ry * 0.35); c.arc(x + 0.002 * Math.sign(f || 1), ey + ry * 0.35, 0.005, 0, TAU); } c.globalAlpha = 0.6; c.fill(); c.globalAlpha = 1; }
      }
    } else if (mood === 'hurt') { // screwed shut: a pale chevron each side, pointing in
      c.strokeStyle = white; c.lineWidth = Math.max(0.011, px * 0.9); c.beginPath();
      for (let i = 0; i < n; i++) { const x = E[i * 3], rx = rx0 * E[i * 3 + 1], a = E[i * 3 + 2], inner = -Math.sign(a); c.moveTo(x - inner * rx, ey + ry * 0.45); c.lineTo(x + inner * rx * 0.7, ey); c.lineTo(x - inner * rx, ey - ry * 0.4); }
      c.stroke();
    } else { // shut: a lash line
      c.strokeStyle = white; c.lineWidth = Math.max(0.008, px * 0.7); c.beginPath();
      for (let i = 0; i < n; i++) { const x = E[i * 3], rx = rx0 * E[i * 3 + 1]; c.moveTo(x - rx, ey - ry * 0.2); c.quadraticCurveTo(x, ey - ry * 0.55, x + rx, ey - ry * 0.2); }
      c.globalAlpha = 0.55; c.stroke(); c.globalAlpha = 1;
    }
    // the brows: a short bold stroke over each eye in the hair's colour (or a grey), tilted by the mood
    const bc = L.hair && L.hair !== 'mohawk' ? figC(L.hair === 'white' ? '#cfcfc8' : L.hairCol || (L.hair === 'long' ? '#6b4a2b' : L.hair === 'bun' ? '#3a2a20' : '#7a5a3a')) : figC(mix(G.ink, '#9aa1aa', 0.42));
    if (G.hat !== 'helmet') {
      c.strokeStyle = bc; c.lineWidth = Math.max(0.016, px * 1.1); c.lineCap = 'round'; c.beginPath();
      for (let i = 0; i < n; i++) {
        const x = E[i * 3], rx = rx0 * E[i * 3 + 1] * 1.15, a = E[i * 3 + 2], inner = -Math.sign(a), y = ey + ry + 0.028 + M.lift * 0.03 + (M.odd && i === n - 1 ? 0.018 : 0);
        const tilt = M.brow * 0.032 * (M.odd && i === n - 1 ? -0.5 : 1);
        c.moveTo(x - rx, y + tilt * inner); c.lineTo(x + rx, y - tilt * inner);
      }
      c.stroke();
    }
    return;
  }
  // ---- the mouth: corners round the face either side of its middle, low down
  const my = -0.088, a0 = -0.26, a1 = 0.26;
  let x0 = hr * 0.9 * at(a0), x1 = hr * 0.9 * at(a1);
  const v0 = vis(a0), v1 = vis(a1); if (v0 < 0 && v1 < 0) return;
  // side on, the mouth runs in from the edge of the face (at least a short way, so it never shrinks to a dot)
  const sg = Math.sign(f || 1), edge = sg * hr * 0.99;
  if (v0 < 0) x0 = edge; if (v1 < 0) x1 = edge;
  if (Math.abs(x1 - x0) < 0.04) { const far = Math.abs(x0) > Math.abs(x1) ? x0 : x1; x0 = far; x1 = far - sg * 0.04; }
  const sp = A.anim === 'talk' ? figSpeaking(A, t) : A.anim === 'phone' || A.anim === 'sitphone' || G.radio ? 1 : 0; // (talking, not listening)
  const talk = sp > 0 ? sp * Math.max(0, Math.sin(t * 11 + sd) * Math.sin(t * 2.3 + sd * 3)) : 0;
  const open = Math.max(M.open, talk * 0.55), w = Math.abs(x1 - x0), mx = (x0 + x1) / 2, cv = M.curve * 0.02;
  const lip = figC(mix(G.ink, '#c9ccd1', 0.45));
  if (open > 0.12 && w > 0.012) {
    const h = 0.012 + 0.05 * open;
    c.fillStyle = figC('#2a0d10'); c.beginPath(); c.ellipse(mx, my - h * 0.35, w * 0.5, h * 0.6, 0, 0, TAU); c.fill();
    if (M.teeth) { c.fillStyle = figC('#e6e1d4'); c.fillRect(mx - w * 0.38, my - h * 0.1, w * 0.76, Math.min(0.012, h * 0.3)); }
    c.strokeStyle = lip; c.lineWidth = Math.max(0.007, px * 0.6); c.beginPath(); c.ellipse(mx, my - h * 0.35, w * 0.5, h * 0.6, 0, 0, TAU); c.stroke();
  } else {
    c.strokeStyle = lip; c.lineWidth = Math.max(0.011, px * 0.8); c.lineCap = 'round'; c.beginPath();
    c.moveTo(x0, my - cv * 0.0); c.quadraticCurveTo(mx, my - cv * 1.8, x1, my); c.stroke();
  }
}
