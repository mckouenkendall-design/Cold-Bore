// ---------------------------------------------------------------------------
// The sound generator. Every sound that does not change while it plays (a rifle's report, its
// action, a reload, a hit, an explosion, thunder) is worked out here sample by sample, in plain
// JavaScript, into a stereo buffer. The engine (src/10_sfx.js) turns each one into an AudioBuffer
// once and then just plays it. There are still no audio files: every sample comes from code.
//
// Why work it out in code like this instead of wiring up dozens of audio nodes per shot:
//   - a phone plays one buffer per shot instead of building and tearing down a big node graph
//   - it sounds exactly the same in every browser, and a test can render and measure it
//   - every sound is seeded, so a rifle always has its own voice and a test always gets the same numbers
//
// No recordings are used. A search for recordings with an explicit CC0 or public-domain licence
// (npm, GitHub, October 2026) found nothing usable that the build machine could reach: every
// gunshot pack found lives on sites outside it (OpenGameArt, Freesound, itch.io), and the one
// CC0 set found (University of Illinois Data Bank, IDB-5664241) is 6.4 GB of hour-long field
// recordings of distant shotguns. So everything is built from these pieces:
//   noise     filtered noise with an envelope (gas, debris, rumble, hiss)
//   tone      a sine that slides in pitch, optionally driven into a soft clip (thumps, booms)
//   modes     a set of ringing frequencies, each dying at its own rate (steel, brass, wood, bone)
//   nwave     the supersonic bullet's shock wave: a jump up, a straight fall, a jump back
//   blast     the muzzle blast's pressure pulse (a Friedlander wave: the shape of a real blast)
//   echo      a filtered copy of what has been made so far, later (walls, buildings, valley sides)
// ---------------------------------------------------------------------------
const SG = Sfx.gen = { sr: 48000 };

// ---- the kit ---------------------------------------------------------------------
function sgRng(seed) { let a = (seed >>> 0) || 0x9e3779b9; return function () { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function sgHash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const sgDb = (db) => Math.pow(10, db / 20);
// a stereo buffer: { sr, n, L, R }
function sgBuf(secs, sr) { sr = sr || SG.sr; const n = Math.max(16, Math.ceil(secs * sr)); return { sr, n, L: new Float32Array(n), R: new Float32Array(n) }; }
// filter coefficients (the usual "audio cookbook" biquads): lp, hp, bp (0 dB at the centre), pk, ls, hs
function sgCoef(type, f, q, sr, db) {
  f = Math.min(Math.max(f, 12), sr * 0.45); q = q || 0.707;
  const w = (2 * Math.PI * f) / sr, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else if (type === 'pk') { const A = Math.pow(10, (db || 0) / 40); b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; }
  else { // shelves
    const A = Math.pow(10, (db || 0) / 40), s2 = 2 * Math.sqrt(A) * al;
    if (type === 'hs') { b0 = A * ((A + 1) + (A - 1) * cw + s2); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - s2); a0 = (A + 1) - (A - 1) * cw + s2; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - s2; }
    else { b0 = A * ((A + 1) - (A - 1) * cw + s2); b1 = 2 * A * ((A - 1) - (A + 1) * cw); b2 = A * ((A + 1) - (A - 1) * cw - s2); a0 = (A + 1) + (A - 1) * cw + s2; a1 = -2 * ((A - 1) + (A + 1) * cw); a2 = (A + 1) + (A - 1) * cw - s2; }
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
// Run one filter over an array in place. A filter is [type, f, q, db, f1, glide]: with f1 the
// frequency slides from f to f1, getting most of the way there in `glide` seconds.
function sgFilt(x, F, sr) {
  const type = F[0], f0 = F[1], q = F[2], db = F[3], f1 = F[4], gl = F[5] || 0.05, n = x.length;
  let c = sgCoef(type, f0, q, sr, db), z1 = 0, z2 = 0;
  const moving = f1 && f1 !== f0, BL = 32, k = moving ? 1 - Math.exp(-BL / (gl * sr)) : 0;
  let f = f0;
  for (let i = 0; i < n; i += BL) {
    if (moving && i > 0) { f += (f1 - f) * k; c = sgCoef(type, f, q, sr, db); }
    const b0 = c[0], b1 = c[1], b2 = c[2], a1 = c[3], a2 = c[4], e = Math.min(n, i + BL);
    for (let j = i; j < e; j++) { const v = x[j], y = b0 * v + z1; z1 = b1 * v - a1 * y + z2; z2 = b2 * v - a2 * y; x[j] = y; }
  }
  return x;
}
// The envelope every layer uses: a rise over att seconds, an optional hold, then an exponential
// fall (tau = the time to drop to about a third), faded to silence at the very end.
function sgEnv(n, sr, att, hold, tau, curve) {
  const e = new Float32Array(n), na = Math.min(n, Math.max(1, Math.round(att * sr))), nh = Math.min(n, na + Math.round((hold || 0) * sr)), dk = Math.exp(-1 / (tau * sr)), fade = Math.min(n >> 2, Math.round(0.004 * sr));
  let i = 0;
  if (curve) for (; i < na; i++) e[i] = Math.pow(i / na, curve);
  else for (; i < na; i++) e[i] = i / na;
  for (; i < nh; i++) e[i] = 1;
  for (let v = 1; i < n; i++) { e[i] = v; v *= dk; }
  for (let j = 0; j < fade; j++) e[n - 1 - j] *= j / fade;
  return e;
}
// slow random movement between 1 - d and 1 + d, `rate` changes a second (the rolling in thunder and echoes)
function sgRoll(n, sr, rate, d, rnd) {
  const out = new Float32Array(n), step = Math.max(1, Math.round(sr / Math.max(0.5, rate)));
  let a = rnd() * 2 - 1, b = rnd() * 2 - 1;
  for (let i = 0; i < n; i++) { const u = (i % step) / step; if (i > 0 && i % step === 0) { a = b; b = rnd() * 2 - 1; } const s = u * u * (3 - 2 * u); out[i] = Math.max(0, 1 + d * (a + (b - a) * s)); }
  return out;
}
// mix a mono or stereo layer into the buffer at time `at`, with gain and pan (-1 left .. 1 right)
function sgMix(B, at, l, r, gain, pan) {
  const i0 = Math.round(at * B.sr); if (i0 >= B.n) return;
  const p = clamp(pan || 0, -1, 1), gl = gain * Math.cos((p + 1) * Math.PI / 4) * Math.SQRT2, gr = gain * Math.sin((p + 1) * Math.PI / 4) * Math.SQRT2;
  r = r || l;
  const m = Math.min(l.length, B.n - i0), L = B.L, R = B.R;
  if (i0 >= 0) { for (let i = 0; i < m; i++) { L[i0 + i] += l[i] * gl; R[i0 + i] += r[i] * gr; } }
  else { for (let i = -i0; i < l.length && i + i0 < B.n; i++) { L[i0 + i] += l[i] * gl; R[i0 + i] += r[i] * gr; } }
}
// filtered noise. o: at, dur (time to fall 60 dB after the hold), att, hold, tau, gain, pan, width
// (0 = the same in both ears, 1 = completely different), brown, filt: [filter, ...], roll: [rate, depth], seed
function sgNoise(B, o) {
  const sr = B.sr, att = o.att || 0.0004, tau = o.tau || o.dur / 6.9, n = Math.ceil((att + (o.hold || 0) + (o.dur || tau * 6.9)) * sr);
  if (n <= 0 || o.gain <= 0) return;
  const rnd = sgRng(o.seed), w = o.width === undefined ? 0.4 : o.width, cw = Math.sqrt(1 - w), uw = Math.sqrt(w);
  const l = new Float32Array(n), r = new Float32Array(n);
  let bl = 0, br = 0, s = (rnd() * 4294967295) >>> 0 || 1;
  const K = 1 / 2147483648;
  for (let i = 0; i < n; i++) { // (xorshift: three random numbers a sample, cheaply)
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5; const c = (s | 0) * K;
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5; const a = (s | 0) * K;
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5; const b = (s | 0) * K;
    let vl = c * cw + a * uw, vr = c * cw + b * uw;
    if (o.brown) { bl = (bl + 0.02 * vl) / 1.02; br = (br + 0.02 * vr) / 1.02; vl = bl * 3.5; vr = br * 3.5; }
    l[i] = vl; r[i] = vr;
  }
  (o.filt || []).forEach((F) => { sgFilt(l, F, sr); sgFilt(r, F, sr); });
  const e = sgEnv(n, sr, att, o.hold, tau, o.curve), ro = o.roll ? sgRoll(n, sr, o.roll[0], o.roll[1], rnd) : null;
  for (let i = 0; i < n; i++) { const v = ro ? e[i] * ro[i] : e[i]; l[i] *= v; r[i] *= v; }
  sgMix(B, o.at || 0, l, r, o.gain, o.pan);
}
// A sine that slides from f to f1 (most of the way in `glide` s), driven into a soft clip when
// drive > 0 so it grows harmonics a phone speaker can play. o: at, f, f1, glide, att, hold, tau or dur, gain, drive, pan, filt
function sgTone(B, o) {
  const sr = B.sr, att = o.att || 0.002, tau = o.tau || o.dur / 6.9, n = Math.ceil((att + (o.hold || 0) + (o.dur || tau * 6.9)) * sr);
  if (n <= 0 || o.gain <= 0) return;
  const x = new Float32Array(n), f0 = o.f, f1 = o.f1 === undefined ? o.f : o.f1, gd = Math.exp(-1 / ((o.glide || tau) * sr)), dr = o.drive || 0, dn = dr > 0 ? Math.tanh(dr) : 1, w = (2 * Math.PI) / sr;
  let ph = o.phase || 0, gv = 1;
  const e = sgEnv(n, sr, att, o.hold, tau, o.curve);
  for (let i = 0; i < n; i++) {
    ph += w * (f1 + (f0 - f1) * gv); gv *= gd;
    let v = Math.sin(ph);
    if (dr > 0) v = Math.tanh(v * dr) / dn;
    x[i] = v * e[i];
  }
  (o.filt || []).forEach((F) => sgFilt(x, F, sr));
  sgMix(B, o.at || 0, x, null, o.gain, o.pan);
}
// Ringing frequencies, struck: each [f, tau, amp]. A little detuning between the ears makes it wide.
function sgModes(B, o) {
  const sr = B.sr, ms = o.modes; if (!ms || !ms.length || o.gain <= 0) return;
  let longest = 0; ms.forEach((m) => { longest = Math.max(longest, m[1]); });
  const n = Math.ceil(longest * 6.5 * sr), l = new Float32Array(n), r = new Float32Array(n), att = Math.max(1, Math.round((o.att || 0.0002) * sr)), rnd = sgRng(o.seed), sp = o.spread === undefined ? 0.002 : o.spread;
  ms.forEach((m) => {
    const f = m[0], a = m[2], p0 = rnd() * 6.283;
    if (f > sr * 0.45) return;
    // each ear's ring is a point turning round a circle and shrinking toward the middle (cheap: no sine per sample)
    const dk = Math.exp(-1 / (m[1] * sr)), wl = (2 * Math.PI * f * (1 - sp)) / sr, wr = (2 * Math.PI * f * (1 + sp)) / sr;
    const cl = Math.cos(wl) * dk, sl = Math.sin(wl) * dk, cr = Math.cos(wr) * dk, sr2 = Math.sin(wr) * dk;
    let xl = Math.cos(p0) * a, yl = Math.sin(p0) * a, xr = xl, yr = yl;
    const nm = Math.min(n, Math.ceil(m[1] * 6.5 * sr));
    for (let i = 0; i < nm; i++) {
      const g = i < att ? i / att : 1;
      l[i] += yl * g; r[i] += yr * g;
      const tl = xl * cl - yl * sl; yl = xl * sl + yl * cl; xl = tl;
      const tr = xr * cr - yr * sr2; yr = xr * sr2 + yr * cr; xr = tr;
    }
  });
  (o.filt || []).forEach((F) => { sgFilt(l, F, sr); sgFilt(r, F, sr); });
  sgMix(B, o.at || 0, l, r, o.gain, o.pan);
}
// The supersonic bullet's shock wave: an "N" (a jump up to +1, a straight fall to -1, a jump back),
// with a second, weaker one a moment later off the ground. len is the N's length in seconds.
function sgNwave(B, o) {
  const sr = B.sr, len = o.len, rise = Math.max(1, Math.round((o.rise || 0.00003) * sr)), nN = Math.max(4, Math.round(len * sr)), n = nN + rise * 2 + 2;
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    if (i < rise) v = 0.5 - 0.5 * Math.cos((Math.PI * i) / rise);
    else if (i < rise + nN) v = 1 - (2 * (i - rise)) / nN;
    else if (i < rise * 2 + nN) { const u = (i - rise - nN) / rise; v = -1 + (0.5 - 0.5 * Math.cos(Math.PI * u)); }
    x[i] = v;
  }
  (o.filt || []).forEach((F) => sgFilt(x, F, sr));
  sgMix(B, o.at || 0, x, null, o.gain, o.pan);
  if (o.bounce) sgMix(B, (o.at || 0) + o.bounce, x, null, o.gain * (o.bounceG || 0.55), -(o.pan || 0) * 0.5);
}
// The muzzle blast: a sharp rise, then a fall through zero into a longer, shallower suck back.
// T = how long the push lasts (s). Big charges push longer, which puts the blast's weight lower.
function sgBlast(B, o) {
  const sr = B.sr, T = o.T, b = o.b || 1.6, n = Math.ceil(T * 9 * sr), rise = Math.max(2, Math.round((o.rise || 0.00012) * sr));
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / sr / T; let v = (1 - t) * Math.exp(-b * t); if (i < rise) v *= 0.5 - 0.5 * Math.cos((Math.PI * i) / rise); x[i] = v; }
  (o.filt || []).forEach((F) => sgFilt(x, F, sr));
  (o.at2 || [0]).forEach((d, k) => sgMix(B, (o.at || 0) + d, x, null, o.gain * (k ? (o.g2 || 0.6) : 1), o.pan));
}
// a filtered copy of `src` (a mono array) later on: an echo off something
function sgEcho(B, src, o) {
  const x = new Float32Array(src);
  (o.filt || []).forEach((F) => sgFilt(x, F, B.sr));
  sgMix(B, o.at, x, null, o.gain, o.pan);
}
// the mono mix of what is in the buffer so far, from `from` for `len` seconds
// (faded out over its second half, so an echo made from it dies away instead of stopping dead)
function sgTake(B, from, len) {
  const i0 = Math.round(from * B.sr), n = Math.max(0, Math.min(B.n - i0, Math.round(len * B.sr))), x = new Float32Array(n), h = n >> 1;
  for (let i = 0; i < n; i++) { const w = i < h ? 1 : 0.5 + 0.5 * Math.cos((Math.PI * (i - h)) / (n - h)); x[i] = (B.L[i0 + i] + B.R[i0 + i]) * 0.5 * w; }
  return x;
}
SG._noise = sgNoise; SG._tone = sgTone; SG._modes = sgModes; SG._echo = sgEcho; SG._buf = sgBuf; // (for tests)

// ---- loudness, and finishing a sound ----------------------------------------------------
// Loudness the way it is felt: the sound is weighted the way the ear weights it (less of the
// very low end, a little more of the top: the "K" weighting used to measure broadcast loudness),
// then the loudest 50 ms is found. Returns decibels (0 = a full-scale sine).
function sgLoud(L, R, sr, win, span) {
  if (span) { const m = Math.min(L.length, Math.round(span * sr)); L = L.subarray(0, m); R = (R || L).subarray(0, m); }
  const n = L.length, a = new Float32Array(L), b = new Float32Array(R || L);
  const K1 = ['hs', 1500, 0.707, 4], K2 = ['hp', 38, 0.5];
  sgFilt(a, K1, sr); sgFilt(a, K2, sr); sgFilt(b, K1, sr); sgFilt(b, K2, sr);
  const blk = Math.round(sr * 0.01), nb = Math.floor(n / blk), w = Math.max(1, Math.round((win || 0.05) / 0.01)), ms = new Float64Array(nb);
  for (let k = 0; k < nb; k++) { let s = 0; for (let i = k * blk; i < (k + 1) * blk; i++) s += a[i] * a[i] + b[i] * b[i]; ms[k] = s / (2 * blk); }
  let best = 0; for (let k = 0; k + w <= nb; k++) { let s = 0; for (let j = k; j < k + w; j++) s += ms[j]; best = Math.max(best, s / w); }
  return 10 * Math.log10(best + 1e-20) + 3.01; // + 3 dB so a full-scale sine reads 0
}
SG.loud = sgLoud;
// Bring a sound to its loudness (dB as above) and round off its loudest peaks so nothing can clip:
// up to `knee` it passes untouched, above that it bends smoothly toward `ceil`, never past it.
function sgFinish(B, o) {
  o = o || {};
  const sr = B.sr;
  sgFilt(B.L, ['hp', o.hp || 22, 0.6], sr); sgFilt(B.R, ['hp', o.hp || 22, 0.6], sr);
  // peakMax: how far over full scale its peaks may be driven into the soft clip (so a sound made
  // mostly of one sharp crack is not turned into a square wave chasing its loudness)
  let g = o.gain || 1;
  if (o.loud !== undefined) g = sgDb(o.loud - sgLoud(B.L, B.R, sr, o.win, o.span));
  if (o.peakMax) { let pk = 0; for (let i = 0; i < B.n; i++) { const a = Math.abs(B.L[i]), b = Math.abs(B.R[i]); if (a > pk) pk = a; if (b > pk) pk = b; } if (pk * g > o.peakMax) g = o.peakMax / pk; }
  B.gain = g;
  if (g !== 1) for (let i = 0; i < B.n; i++) { B.L[i] *= g; B.R[i] *= g; }
  const ceil = o.ceil || 0.97, kn = (o.knee || 0.6) * ceil, room = ceil - kn;
  const sat = (v) => { const a = v < 0 ? -v : v; if (a <= kn) return v; const y = kn + room * Math.tanh((a - kn) / room); return v < 0 ? -y : y; };
  for (let i = 0; i < B.n; i++) { B.L[i] = sat(B.L[i]); B.R[i] = sat(B.R[i]); }
  // trim the silence off the end (keep 20 ms of it)
  let last = B.n - 1; const thr = 0.0004;
  while (last > 0 && Math.abs(B.L[last]) < thr && Math.abs(B.R[last]) < thr) last--;
  const keep = Math.min(B.n, last + Math.round(0.02 * sr));
  if (keep < B.n) { B.L = B.L.slice(0, keep); B.R = B.R.slice(0, keep); B.n = keep; }
  const fade = Math.min(B.n >> 2, Math.round(0.01 * sr));
  for (let i = 0; i < fade; i++) { const g = i / fade, j = B.n - 1 - i; B.L[j] *= g; B.R[j] *= g; }
  return B;
}
SG.finish = sgFinish;

// ---- rifles -------------------------------------------------------------------------
// Calibres: h = how heavy it is, 0 (a .22) to 1 (a .50); it sets the blast's length, the boom's
// pitch, the thump's depth and how long it all rolls on. gas = the powder burnt (the size of
// the blast), d = the bullet's width in millimetres (a wider bullet's crack is longer and fuller).
const SG_CAL = {
  c22: { h: 0, gas: 0.12, d: 5.7 },
  c9s: { h: 0.22, gas: 0.45, d: 9.0 },
  c300s: { h: 0.25, gas: 0.5, d: 7.8 },
  c556: { h: 0.38, gas: 1.6, d: 5.7 },
  c65: { h: 0.5, gas: 2.7, d: 6.7 },
  c308: { h: 0.55, gas: 3.0, d: 7.8 },
  c762r: { h: 0.57, gas: 3.2, d: 7.9 },
  c8mm: { h: 0.62, gas: 3.4, d: 8.2 },
  c300m: { h: 0.72, gas: 4.9, d: 7.8 },
  c338: { h: 0.8, gas: 6.0, d: 8.6 },
  c408: { h: 0.86, gas: 8.0, d: 10.4, low: 1.1 },
  c50: { h: 1, gas: 15, d: 12.9, low: 1.4 },
  crail: { h: 0.8, gas: 0, d: 6.0 },
};
SG.CAL = SG_CAL;
// Each rifle's own voice, on top of its calibre:
//   bl     barrel length in inches: a short barrel lets the gas out at higher pressure, so it is
//          louder and sharper; a long one is a touch softer and lower
//   bw     barrel weight, 0 thin to 1 heavy: a thin barrel rings, a heavy one hardly at all
//   ring   the barrel and receiver's own ringing frequencies (Hz)
//   stock  what the stock is made of, and knock the pitch of its thump into your shoulder
//   tone   the rifle's own voice: the two pitches its blast rings at (tone, the body of it, and tone2,
//          its presence), from its barrel length, crown and action; tilt, how bright (dB above 3 kHz)
//          or dark it is. No two rifles share a pair of these
//   mech   how the action sounds as it fires and cycles; canF tunes a built-in suppressor
const SG_GUN = {
  fenwick: { bl: 22, bw: 0.3, ring: [1830, 4170, 7350], stock: 'wood', knock: 238, tone: 1300, tone2: 3200, tilt: -1, mech: 'bolt' },
  ratter: { bl: 18, bw: 0.2, ring: [2650, 5900, 9100], stock: 'wood', knock: 318, tone: 2900, tone2: 5500, tilt: 1, mech: 'rimfire', canF: 1.42 },
  kessler: { bl: 23.6, bw: 0.4, ring: [1450, 3620, 6480], stock: 'wood', knock: 205, tone: 1000, tone2: 5500, tilt: -3.5, mech: 'mauser' },
  lark: { bl: 18, bw: 0.5, ring: [2210, 5080, 8300], stock: 'poly', knock: 520, tone: 2900, tone2: 7000, tilt: 3, mech: 'ar' },
  whisper: { bl: 16, bw: 0.5, ring: [1680, 3940, 6900], stock: 'poly', knock: 465, tone: 1300, tone2: 4200, tilt: 0, mech: 'bolt-s', canF: 0.92 },
  orlov: { bl: 24.4, bw: 0.25, ring: [1560, 3480, 6100], stock: 'wood', knock: 262, tone: 1700, tone2: 4200, tilt: 0, mech: 'svd' },
  halden: { bl: 20, bw: 0.85, ring: [2050, 4730, 8800], stock: 'chassis', knock: 880, tone: 2900, tone2: 4200, tilt: 2.5, mech: 'bolt-t' },
  hush: { bl: 8, bw: 0.4, ring: [1980, 4420, 7600], stock: 'skel', knock: 640, tone: 2200, tone2: 4200, tilt: 1, mech: 'vss', canF: 1.08 },
  marrow: { bl: 20, bw: 0.1, ring: [2420, 5560, 9600], stock: 'carbon', knock: 760, tone: 3700, tone2: 5500, tilt: 2, mech: 'bolt-l' },
  corvid: { bl: 20, bw: 0.6, ring: [1910, 4380, 7900], stock: 'chassis', knock: 820, tone: 2200, tone2: 3200, tilt: -0.5, mech: 'ar10' },
  ibex: { bl: 24, bw: 0.15, ring: [2350, 5390, 8870], stock: 'takedown', knock: 420, tone: 1700, tone2: 7000, tilt: 0.5, mech: 'single' },
  vantage: { bl: 26, bw: 0.7, ring: [1380, 3260, 6200], stock: 'chassis', knock: 700, tone: 2200, tone2: 6300, tilt: 1.5, mech: 'bolt-m' },
  northwind: { bl: 27, bw: 0.8, ring: [1240, 2980, 5600], stock: 'chassis', knock: 650, tone: 1500, tone2: 5500, tilt: 1.5, mech: 'bolt-mh' },
  anvil: { bl: 29, bw: 1, ring: [820, 2150, 4300], stock: 'steel', knock: 330, tone: 760, tone2: 2400, tilt: -1.5, mech: 'bolt-50', brake: true },
  aria: { bl: 29, bw: 0.9, ring: [1090, 2620, 5100], stock: 'chassis', knock: 585, tone: 1000, tone2: 3600, tilt: -2.5, mech: 'bolt-x' },
  stormglass: { bl: 30, bw: 0.6, ring: [3100, 7400, 11200], stock: 'poly', knock: 450, tone: 2400, tone2: 6000, tilt: 0, mech: 'coil' },
};
SG.GUN = SG_GUN;
// a rifle the generator has no voice for (the old sound test only gives a calibre)
function sgVoiceFor(cal, action) {
  const h = (SG_CAL[cal] || SG_CAL.c308).h;
  return { bl: 22, bw: 0.5, ring: [1700 + 600 * (1 - h), 4000, 7000], stock: 'wood', knock: 300, tone: 2600 - 1500 * h, tone2: 5000, tilt: 0, mech: { single: 'single', semi: 'ar', charge: 'coil' }[action] || 'bolt', canF: 1 };
}
// How each muzzle device changes the rifle's own sound. Each number multiplies a layer of the
// bare rifle (missing = unchanged):
//   blast, T, lp   the muzzle blast's push, its length, and the top left in it (Hz)
//   ports          extra pushes a moment later, one for each pair of side holes (seconds after)
//   gas, fc, tau   the hiss of escaping gas: how loud, its pitch, how long; sizzle = its very top
//   mid, low       a lift (dB) in the middle (a brake throwing gas at you) or low middle (a big chamber)
//   crack, whip    the bullet's own crack and the whip of it going away: no suppressor touches these
//   body, sub      the boom and the low thump you feel; ring = the barrel's ring; knock = the stock's thump
//   slap, tail, far  the echoes off nearby things, the rolling tail, the echo back from down range
//   can, canT, tock, rattle  a suppressor's own sound: its tube ringing, the hollow "tock" of
//                  the gas inside it, and (a cheap loose one) a rattle on its mount
//   loud           the loudness it ends up at, in dB against the bare rifle
const SG_DEV = {
  none: {},
  flash: { blast: 0.94, gas: 0.92, fc: 1.35, body: 0.8, prongs: 1, loud: 0.4, sizzle: 1.4 },
  comp: { blast: 1.12, gas: 1.3, fc: 1.12, sizzle: 1.6, ports: [0.0001, 0.0002, 0.0003], g2: 0.5, chuff: 1, slap: 1.15, mid: 8, midF: 3200, fixF: 1, loud: 1.6, body: 0.9 },
  brake: { blast: 1.3, gas: 1.75, fc: 1.0, tau: 1.5, sizzle: 1.3, ports: [0.00024, 0.00052], g2: 0.75, mid: 7, midF: 1450, side: 1, slap: 1.5, tail: 1.2, loud: 1.5 },
  fbrake: { blast: 1.2, gas: 1.25, fc: 1.1, tau: 1.35, sizzle: 1.3, ports: [0.00021, 0.00042], mid: 1.5, slap: 1.35, tail: 1.12, loud: 0 },
  rad: { blast: 1.38, gas: 1.6, fc: 1.7, tau: 1.2, sizzle: 5, ports: [0.00006, 0.00012, 0.00019, 0.00025, 0.00033, 0.0004, 0.00048], g2: 0.42, mid: 8, midF: 3600, zing: 1, slap: 1.65, tail: 1.25, loud: 2.0 },
  hammer: { blast: 1.32, gas: 1.55, fc: 0.82, tau: 1.7, sizzle: 1.15, ports: [0.0007], g2: 0.95, body: 1.2, low: 6, slap: 1.6, tail: 1.3, loud: 1.4 },
  cone: { blast: 0.62, lp: 2300, gas: 0.42, fc: 0.78, sizzle: 0.25, body: 1.15, sub: 1.12, slap: 0.65, far: 1.8, knock: 1.3, loud: -1.4 },
  damper: { crack: 0.32, whip: 0.45, hum: 1, loud: -2.5 },
  supl: { supp: 1, can: [3150, 4480, 6930], canT: 0.045, canG: 1.1, tock: 1080, tockT: 0.018, tockG: 0.45, blast: 0.46, T: 1.9, lp: 2700, gas: 0.36, fc: 0.72, sizzle: 0.16, crack: 1.2, whip: 2.1, body: 0.55, bodyLp: 0.55, sub: 0.8, ring: 0.6, slap: 0.42, tail: 0.3, far: 0.4, loud: -3.0 },
  suph: { supp: 1, can: [2240, 3370, 5260], canT: 0.09, canG: 0.85, tock: 640, tockT: 0.06, tockG: 0.8, blast: 0.16, T: 3.2, lp: 700, gas: 0.06, fc: 0.4, sizzle: 0.02, crack: 1.2, whip: 2.1, body: 0.52, bodyLp: 0.4, sub: 0.9, ring: 0.5, slap: 0.36, tail: 0.25, far: 0.32, loud: -5.0 },
  olcan: { supp: 1, can: [2180, 3270, 5130], canT: 0.085, canG: 1.3, tock: 900, rattle: 1, blast: 0.4, T: 3.0, lp: 1300, gas: 0.15, fc: 0.5, sizzle: 0.07, crack: 1.2, whip: 2.1, body: 0.85, bodyLp: 0.75, sub: 1.0, ring: 0.7, slap: 0.48, tail: 0.34, far: 0.45, loud: -3.0 },
  int: { supp: 1, can: [1960, 2950, 4600], canT: 0.06, canG: 0.85, tock: 720, tockT: 0.04, blast: 0.24, T: 2.6, lp: 1000, gas: 0.1, fc: 0.45, sizzle: 0.04, crack: 1.2, whip: 2.1, body: 0.55, bodyLp: 0.5, sub: 0.82, ring: 0.55, slap: 0.4, tail: 0.28, far: 0.36, loud: -4.0 },
  intLong: { supp: 1, can: [1280, 1980, 3130], canT: 0.11, canG: 0.72, tock: 500, blast: 0.14, T: 3.2, lp: 700, gas: 0.07, fc: 0.38, sizzle: 0.02, crack: 1.2, whip: 2.1, body: 0.8, bodyLp: 0.42, sub: 1.1, ring: 0.45, slap: 0.34, tail: 0.24, far: 0.3, loud: -5.0, tockT: 0.07, tockG: 1.3 },
  intShort: { supp: 1, can: [2870, 4310, 6620], canT: 0.04, canG: 1.25, tock: 1050, tockT: 0.018, blast: 0.55, T: 1.8, lp: 2600, gas: 0.28, fc: 0.7, sizzle: 0.16, crack: 1.2, whip: 2.1, body: 0.66, bodyLp: 0.68, sub: 0.85, ring: 0.75, slap: 0.52, tail: 0.36, far: 0.46, loud: -1.0 },
};
SG.DEV = SG_DEV;
// Where the shot is heard. slaps: the first echoes off nearby things [delay s, gain, top Hz, pan];
// walls: big, late returns off valley sides and far slopes (smeared, dark); tail: the diffuse
// roll that follows (rise s, rt = how long it rolls, its colour from f0 to f1 Hz, roll = its
// unevenness [changes a second, depth]); ret = how strong the echo back from the target area is.
const SG_LOC = {
  city: { slaps: [[0.029, 0.44, 5200, -0.6], [0.046, 0.38, 4800, 0.7], [0.081, 0.34, 4200, -0.3], [0.118, 0.3, 3800, 0.55], [0.171, 0.24, 3300, -0.8], [0.236, 0.2, 2800, 0.25], [0.322, 0.15, 2400, -0.4], [0.43, 0.1, 2000, 0.6]], tail: { g: 0.2, rise: 0.035, rt: 1.8, f0: 2700, f1: 620, roll: [7, 0.3] }, ret: 0.16 },
  harbour: { slaps: [[0.058, 0.36, 3600, -0.5], [0.133, 0.33, 3000, 0.6], [0.251, 0.22, 2400, -0.2]], walls: [[0.62, 0.16, 1300, 0.5], [0.87, 0.12, 1100, -0.4]], tail: { g: 0.2, rise: 0.08, rt: 2.7, f0: 1650, f1: 380, roll: [3.2, 0.4] }, ret: 0.2 },
  valley: { slaps: [[0.017, 0.3, 3300, 0.3], [0.041, 0.16, 2600, -0.4]], walls: [[0.47, 0.34, 950, -0.6], [0.91, 0.28, 720, 0.5], [1.44, 0.2, 540, -0.2]], tail: { g: 0.22, rise: 0.12, rt: 3.7, f0: 1150, f1: 200, roll: [2.2, 0.55] }, ret: 0.26 },
  ridge: { slaps: [[0.011, 0.18, 2500, 0]], walls: [[1.33, 0.3, 580, 0.4], [2.08, 0.2, 430, -0.5]], tail: { g: 0.16, rise: 0.2, rt: 4.4, f0: 780, f1: 150, roll: [1.4, 0.6] }, ret: 0.3 },
  indoor: { slaps: [[0.0041, 0.62, 6000, -0.7], [0.0068, 0.56, 5500, 0.7], [0.0104, 0.5, 5000, -0.4], [0.0143, 0.46, 4500, 0.5], [0.0189, 0.4, 4000, -0.2], [0.0262, 0.35, 3500, 0.3], [0.035, 0.28, 3000, -0.5]], tail: { g: 0.4, rise: 0.008, rt: 0.6, f0: 3200, f1: 900, roll: [0, 0] }, ret: 0 },
};
SG.LOC = SG_LOC;
// the place a scene sounds like
SG.locOf = function (S) {
  if (!S) return 'valley';
  if (S.indoor) return 'indoor';
  return { city: 'city', harbour: 'harbour', snow: 'ridge', wild: 'valley' }[S.ambience] || 'valley';
};

// Everything that decides how one rifle, as fitted, sounds. st is the rifle's stats (buildStats)
// or, from old callers, just { cal, quiet, sub, action, can }. Returns a plain object; its `key`
// names the sound, so two set-ups with the same key are the same sound.
SG.spec = function (st, loc, refZ, ground) {
  const gid = (st.gun && st.gun.id) || st.id || null, cfg = st.cfg || {}, C = SG_CAL[st.cal] || SG_CAL.c308;
  const V0 = SG_GUN[gid] || sgVoiceFor(st.cal, st.action), V = Object.assign({ ringT: 1, canF: 1 }, V0);
  const integral = st.gun ? st.gun.supp === 'integral' : st.can === 'int';
  const mz = cfg.muzzle || 'mz_none';
  let dev;
  if (st.quiet) {
    if (integral) dev = { mz_rt_long: 'intLong', mz_wh_short: 'intShort', mz_hs_short: 'intShort' }[mz] || 'int';
    else if (st.can) dev = { light: 'supl', heavy: 'suph', int: 'int' }[st.can] || 'supl';
    else dev = { mz_suph: 'suph', mz_ol_can: 'olcan' }[mz] || 'supl';
  } else dev = { mz_flash: 'flash', mz_brake: 'brake', mz_comp: 'comp', mz_rad: 'rad', mz_av_hammer: 'hammer', mz_av_cone: 'cone', mz_sg_damper: 'damper' }[mz] || (V.brake ? 'fbrake' : 'none');
  // barrels and loads change the voice a little
  const br = cfg.barrel, am = cfg.ammo;
  let gas = C.gas, crackK = 1, loud = 0, soft = 0;
  if (br === 'br_short') { V.bl *= 0.78; loud += 0.7; }
  if (br === 'br_long') { V.bl *= 1.14; loud -= 0.5; }
  if (br === 'br_heavy') V.bw = Math.min(1, V.bw + 0.35);
  if (br === 'br_carbon') { V.bw = Math.min(1, V.bw + 0.2); V.ringT = 0.5; }
  if (br === 'br_flute') V.ring = V.ring.map((f) => f * 1.07);
  if (am === 'am_300red') { gas *= 0.7; loud -= 2.5; soft = 1; }
  if (am === 'am_heavy' || am === 'am_hmatch' || am === 'am_77') crackK = 0.85;
  if (am === 'am_slap') crackK = 1.3;
  if (am === 'am_sg_hollow') crackK = 0.8;
  const v0 = st.v0 || (st.sub ? 300 : 800), sup = st.subsonic !== undefined ? !st.subsonic : !st.sub;
  if (!sup && !SG_DEV[dev].supp && !integral) { soft = 1; loud -= 1.2; } // a subsonic load with no suppressor: less powder, no crack, duller
  let D = SG_DEV[dev]; const h = C.h;
  if (soft) D = Object.assign({}, D, { body: sgDv(D, 'body') * 0.85, sub: sgDv(D, 'sub') * 0.75, tail: sgDv(D, 'tail') * 0.7, slap: sgDv(D, 'slap') * 0.8 }); // a reduced load: less of everything
  if (sup && integral) { gas *= 1.25; loud += 1; }                         // a supersonic load in a built-in can
  loud += -7 - 4 * (1 - h) + (D.loud || 0) + (!sup ? (D.supp ? -1.5 : -0.8) : 0);
  if (st.cal === 'crail') loud = -6.8 + (D.loud || 0);
  const L = SG_LOC[loc] ? loc : 'valley';
  const far = refZ ? Math.round(clamp((2 * refZ) / SOUND, 0.4, 3.2) * 10) / 10 : 0;
  const S = { gid: gid || 'cal', cal: st.cal, h, low: C.low || 1, gas, d: C.d, mach: v0 / SOUND, sup, V, dev, D, loc: L, far, ground: ground || 'dirt', crackK, loud, soft, coil: st.cal === 'crail', dense: br === 'cl_dense', action: st.action || 'bolt', cycle: st.cycle || 1.4 };
  S.key = [S.gid, st.cal, dev, br || '-', am || '-', sup ? 'S' : 'u', L, far, S.ground, S.action, (+S.cycle).toFixed(2)].join('|');
  return S;
};

// ---- the report ------------------------------------------------------------------------
// A powder rifle's shot, as the shooter hears it, layer by layer (times after the trigger breaks):
//   the striker or hammer falling, a few milliseconds before anything else
//   the bullet's crack (only faster than sound) and the whip of it tearing away down range
//   the muzzle blast: its push, the gas hissing out after it, and its very top
//   the boom: the body of the shot, low and wide, ringing at the calibre's own pitch
//   the thump you feel: a deep sine sliding down, driven so a phone speaker still plays it
//   the barrel ringing and the stock's knock into the shoulder (each rifle has its own)
//   the device: a brake's ports, a flash hider's prongs, a suppressor's tube and the gas in it
//   a semi-automatic's action slamming back and forward, in the shot itself
//   the place: the first echoes off nearby things, the big late returns, the rolling tail, and
//   the echo back from the target area
function sgDv(D, k, d) { return D[k] === undefined ? (d === undefined ? 1 : d) : D[k]; }
SG.report = function (S, seed) {
  if (S.coil) return SG.coil(S, seed);
  const rnd = sgRng(seed * 977 + 13), jit = (a) => 1 + (rnd() * 2 - 1) * a, nx = () => (rnd() * 4294967296) >>> 0;
  const h = S.h, V = S.V, D = S.D, dv = (k, d) => sgDv(D, k, d), supp = !!D.supp, rt = sgRt(S);
  const B = sgBuf(sgLen(S, rt)), tB = { single: 0.0045, bolt: 0.0035 }[S.action] || 0.003;
  const bark = Math.pow(22 / V.bl, 0.5) * (S.soft ? 0.72 : 1);             // short barrels bark; a reduced load does not
  // the striker or hammer falling
  const r0 = V.ring;
  sgModes(B, { at: 0, modes: [[r0[0] * 0.61, 0.006, 1], [r0[1] * 0.58, 0.004, 0.7], [r0[2] * 0.66, 0.0025, 0.5]], gain: supp ? 0.09 : 0.05, seed: nx() });
  sgNoise(B, { at: 0, filt: [['hp', 3000, 0.7]], att: 0.0002, tau: 0.0012, dur: 0.008, gain: supp ? 0.1 : 0.06, seed: nx() });
  // the bullet's crack, and the whip of it going away
  if (S.sup) {
    // (from behind the rifle the blast drowns most of the crack; through a suppressor the crack is what is left)
    const ck = S.crackK * dv('crack') * clamp(Math.sqrt(Math.max(0, S.mach - 1)), 0.35, 1.25) * (supp ? 1 : 0.55);
    const nl = (0.00019 + 0.00026 * (S.d - 5.7) / 7.2) * jit(0.05);
    sgNwave(B, { at: tB + 0.00022, len: nl, gain: 0.95 * ck, bounce: 0.0011 * jit(0.2), bounceG: 0.5, filt: [['hp', 350, 0.7]] });
    sgNoise(B, { at: tB + 0.0005, filt: [['bp', 5600 * jit(0.06), 1.3, 0, 1900, 0.045]], att: 0.0006, tau: 0.016 + 0.012 * h, dur: 0.11 + 0.06 * h, gain: 0.2 * dv('whip') * ck, width: 0.5, seed: nx() });
    sgNoise(B, { at: tB + 0.0003, filt: [['hp', 2400, 0.7], ['lp', 9000, 0.7]], att: 0.0002, tau: 0.0035, dur: 0.02, gain: 0.32 * ck * (supp ? 1.4 : 1), width: 0.2, seed: nx() });
  }
  // the muzzle blast
  const T = (0.00055 + 0.0016 * h) * Math.pow(V.bl / 22, 0.2) * dv('T') * jit(0.04), gK = Math.pow(S.gas / 3, 0.18);
  const tilt = ['hs', 3000, 0.7, V.tilt || 0];
  sgBlast(B, { at: tB, T, b: 1.5, gain: 1.05 * dv('blast') * bark * gK, at2: D.ports ? [0].concat(D.ports) : null, g2: D.g2 || 0.55, filt: [['lp', D.lp || 9500, 0.7], ['pk', V.tone, 2.5, 10], ['pk', V.tone2, 3, 8], tilt].concat(D.chuff ? [['pk', 3200, 1.5, 6]] : []) });
  const fcG = (2500 - 950 * h) * Math.pow(22 / V.bl, 0.3) * dv('fc') * (S.soft ? 0.8 : 1) * jit(0.05);
  sgNoise(B, { at: tB, filt: [['bp', fcG, 0.55], ['pk', V.tone, 2, 12], ['pk', V.tone2, 2.5, 9], tilt], att: 0.0003, tau: (0.011 + 0.03 * h) * dv('tau'), dur: (0.08 + 0.2 * h) * dv('tau'), gain: 0.85 * dv('gas') * bark, width: 0.3, seed: nx() });
  sgNoise(B, { at: tB, filt: [['hp', 4600, 0.7]], att: 0.0002, tau: 0.004 + 0.005 * h, dur: 0.04, gain: 0.34 * dv('sizzle') * bark, width: 0.35, seed: nx() });
  // the boom (heavy calibres get disproportionately more of the deep part)
  const bf = (250 - 160 * h) * jit(0.04), fcB = (2300 - 1450 * h) * dv('bodyLp'), tauB = 0.045 + 0.17 * h;
  const bFilt = [['lp', fcB, 0.8, 0, fcB * 0.3, tauB * 2], ['pk', bf, 1.3, 8], ['pk', V.tone * 0.45, 1.5, 7]];
  if (D.mid) bFilt.push(['pk', (D.midF || 1900) * (D.fixF ? 1 : Math.pow(V.tone / 2000, 0.6)), 0.9, D.mid]);
  if (D.low) bFilt.push(['pk', 520, 1.0, D.low]);
  sgNoise(B, { at: tB, filt: bFilt, att: 0.0012, tau: tauB, dur: tauB * 6, gain: 0.85 * dv('body'), width: 0.3, seed: nx() });
  const lowK = S.low || 1;
  sgNoise(B, { at: tB + 0.001, brown: true, filt: [['lp', 380 - 190 * h, 0.7]], att: 0.004, tau: tauB * 1.6 * lowK, dur: tauB * 8 * lowK, gain: 0.55 * dv('body') * (0.5 + 0.9 * h * h) * lowK, width: 0.6, seed: nx() });
  // the thump you feel
  const f0 = (118 - 72 * h) * jit(0.03) / Math.sqrt(lowK);
  sgTone(B, { at: tB, f: f0, f1: f0 * 0.45, glide: 0.05 + 0.07 * h, att: 0.0025, tau: (0.06 + 0.2 * h) * lowK, dur: (0.06 + 0.2 * h) * 6 * lowK, gain: (0.25 + 0.25 * h + 0.3 * h * h * h) * dv('sub') * lowK, drive: 1.6 });
  sgTone(B, { at: tB, f: f0 * 3, f1: f0 * 1.4, glide: 0.03, att: 0.0015, tau: 0.03 + 0.04 * h, dur: 0.25 + 0.2 * h, gain: 0.17 * dv('sub'), drive: 2.4 });
  // the barrel's ring and the stock's knock (louder against a suppressed shot, as they really are)
  const rK = V.ringT * (1.3 - V.bw);
  sgModes(B, { at: tB, modes: V.ring.map((f, i) => [f * jit(0.01), [0.075, 0.048, 0.03][i] * rK, [1, 0.65, 0.4][i]]), gain: 0.1 * (1.2 - 0.7 * V.bw) * dv('ring'), seed: nx() });
  sgKnock(B, tB + 0.0008, V, 0.22 * dv('knock') * (supp ? 1.5 : 1), nx());
  // the device's own sound
  if (D.prongs) { const pf = Math.pow(V.tone2 / 4500, 0.35); sgModes(B, { at: tB + 0.0002, modes: [[5320 * pf * jit(0.02), 0.11, 1], [6680 * pf * jit(0.02), 0.08, 0.8], [8140 * pf * jit(0.02), 0.06, 0.6], [10300 * pf, 0.035, 0.4]], gain: 0.22, seed: nx() }); } // the prongs ring, pitched by the gas through them
  if (D.chuff) sgNoise(B, { at: tB + 0.0003, filt: [['bp', 3200 * jit(0.04), 1.3]], att: 0.0004, tau: 0.016, dur: 0.09, gain: 1.8, width: 0.2, seed: nx() });
  // a tanker brake throws two fat jets of gas out of its sides: a chunky "whump" either side of you
  if (D.side) [-0.75, 0.75].forEach((pan, i) => sgNoise(B, { at: tB + 0.0003 + i * 0.0004, filt: [['bp', V.tone * 0.9 * jit(0.05), 1.6]], att: 0.0006, tau: 0.022 + 0.02 * h, dur: 0.15, gain: 0.55, pan, width: 0.1, seed: nx() }));
  // a radial brake's rings of small holes: a hard, high zing
  if (D.zing) { sgNoise(B, { at: tB + 0.0002, filt: [['bp', 6800 * jit(0.04), 2.2]], att: 0.0008, tau: 0.011, dur: 0.07, gain: 0.9, width: 0.6, seed: nx() }); sgModes(B, { at: tB + 0.0003, modes: [[4650 * jit(0.02), 0.04, 1], [7230, 0.03, 0.7], [9810, 0.02, 0.5]], gain: 0.1, seed: nx() }); }
  if (D.hum) { sgTone(B, { at: tB, f: 100, att: 0.004, tau: 0.25, dur: 1.2, gain: 0.16, drive: 3 }); sgTone(B, { at: tB, f: 50, att: 0.004, tau: 0.3, dur: 1.4, gain: 0.2, drive: 1.5 }); }
  if (supp) {
    const cf = V.canF * (1 + 0.12 * (0.55 - h)) * jit(0.015);
    sgModes(B, { at: tB + 0.0006, modes: D.can.map((f, i) => [f * cf, D.canT * [1, 0.75, 0.5][i], [1, 0.7, 0.45][i]]), gain: 0.085 * D.canG, seed: nx() });
    sgNoise(B, { at: tB + 0.0008, filt: [['bp', D.tock * cf, 4.5]], att: 0.0008, tau: D.tockT || 0.03, dur: (D.tockT || 0.03) * 6, gain: D.tockG || 0.5, width: 0.15, seed: nx() });
    sgNoise(B, { at: tB + 0.0005, filt: [['lp', 1400 * cf, 0.7], ['pk', V.tone * 0.6, 1.4, 5]], att: 0.001, tau: (0.02 + 0.015 * h) * (S.sup ? 1 : 1.4), dur: 0.14 * (S.sup ? 1 : 1.4), gain: 0.45 * (S.sup ? 1 : 1.6), width: 0.2, seed: nx() }); // the gas puffing out (longer and fuller when there is no crack over it)
    // a cheap can loose on its mount: it rattles as the gas slams through it, and buzzes
    if (D.rattle) {
      [0.009, 0.019, 0.031, 0.046].forEach((d, i) => sgModes(B, { at: tB + d * jit(0.1), modes: [[2930 * jit(0.03), 0.012, 1], [4870, 0.008, 0.6]], gain: 0.13 * (1 - i * 0.2), seed: nx() }));
      sgNoise(B, { at: tB + 0.003, filt: [['bp', 1150, 2.5]], att: 0.002, tau: 0.03, dur: 0.12, roll: [140, 0.9], gain: 0.35, width: 0.2, seed: nx() });
    }
  }
  // a semi-automatic's action, in the shot itself
  sgCarrier(B, tB, S, supp ? 1.6 : 1.3, nx);
  sgPlace(B, S, tB, rt, rnd);
  return sgFinish(B, { loud: S.loud, peakMax: D.ports ? 2.7 : 2.2, span: 0.6 });
};
// How long a shot's tail rolls on, and how long its buffer has to be.
function sgRt(S) { const tl = SG_LOC[S.loc].tail; return tl.rt * (0.62 + 0.55 * S.h) * Math.sqrt(S.low || 1) * (S.D.supp ? 0.8 : 1); }
function sgLen(S, rt) { const loc = SG_LOC[S.loc]; return Math.max(0.9, Math.min(5.2, Math.max(0.12 + rt * 0.9 + (loc.walls ? loc.walls[loc.walls.length - 1][0] * 0.6 : 0), S.far ? S.far + 0.6 : 0))); }
// The place: echoes of what has been made so far off the things around the shooter, the big
// late returns, the rolling tail and the echo back from the target area.
function sgPlace(B, S, tB, rt, rnd) {
  const loc = SG_LOC[S.loc], tl = loc.tail, D = S.D, dv = (k) => sgDv(D, k), h = S.h, supp = !!D.supp, jit = (a) => 1 + (rnd() * 2 - 1) * a;
  const nx = () => (rnd() * 4294967296) >>> 0;
  const dry = sgTake(B, 0, 0.07), slapK = dv('slap');
  loc.slaps.forEach((s, i) => sgEcho(B, dry, { at: s[0] * jit(0.07), gain: s[1] * slapK * (0.75 + 0.35 * h), pan: s[3], filt: [['lp', s[2] * (supp ? 1.1 : 1), 0.7], ['hp', 140 + i * 30, 0.7]] }));
  // a big return off a far slope: the shot's front, dark and blurred, then a smear of rumble behind it
  const ret = (at, g, top, pan) => {
    sgEcho(B, dry, { at, gain: g * 0.7, pan, filt: [['lp', top, 0.7], ['hp', 90, 0.6]] });
    sgNoise(B, { at: at + 0.004, att: 0.02 + 0.02 * h, tau: 0.1 + 0.12 * h, dur: 0.5 + 0.6 * h, filt: [['lp', top * 0.8, 0.7], ['hp', 60, 0.6]], gain: g * 1.6, roll: [9, 0.5], width: 0.7, pan, seed: nx() });
  };
  if (loc.walls) loc.walls.forEach((w) => ret(w[0] * jit(0.05), w[1] * dv('tail') * (0.7 + 0.45 * h), w[2], w[3]));
  sgNoise(B, { at: tB + 0.004, att: tl.rise, tau: rt / 6.9, dur: rt, filt: [['lp', tl.f0, 0.6, 0, tl.f1, rt * 0.35], ['hp', 60, 0.6]], gain: tl.g * 4.5 * dv('tail') * (0.7 + 0.5 * h), roll: tl.roll[0] ? tl.roll : null, width: 0.92, seed: nx() });
  sgNoise(B, { at: tB + 0.01, att: tl.rise * 1.5, tau: rt / 5, dur: rt * 1.2, brown: true, filt: [['lp', tl.f1 * 1.6, 0.6], ['hp', 40, 0.6]], gain: tl.g * 1.5 * dv('tail') * (0.5 + 0.8 * h), roll: [Math.max(1, tl.roll[0] * 0.6), 0.5], width: 0.9, seed: nx() });
  if (S.far && loc.ret) ret(S.far, loc.ret * 0.55 * dv('far') * (0.6 + 0.6 * h), 820, (rnd() - 0.5) * 0.5);
}
// the stock's thump into the shoulder, by what it is made of
function sgKnock(B, at, V, g, seed) {
  const k = V.knock;
  const M = {
    wood: [[k, 0.032, 1], [k * 2.31, 0.018, 0.5], [k * 3.72, 0.01, 0.25]],
    poly: [[k, 0.02, 1], [k * 1.93, 0.013, 0.6], [k * 3.1, 0.008, 0.3]],
    chassis: [[k, 0.06, 0.8], [k * 2.76, 0.04, 0.6], [k * 5.4, 0.025, 0.4]],
    carbon: [[k, 0.024, 1], [k * 3.13, 0.016, 0.45]],
    steel: [[k, 0.11, 1], [k * 2.44, 0.07, 0.55], [k * 4.63, 0.04, 0.3]],
    takedown: [[k, 0.03, 1], [k * 2.05, 0.02, 0.6], [k * 4.4, 0.012, 0.35]],
    skel: [[k, 0.04, 0.9], [k * 2.2, 0.03, 0.6], [k * 4.9, 0.018, 0.35]],
  }[V.stock] || [[k, 0.03, 1]];
  sgModes(B, { at, modes: M, gain: g, seed });
  sgNoise(B, { at, filt: [['lp', V.stock === 'wood' ? 600 : 900, 0.8]], att: 0.0008, tau: 0.012, dur: 0.06, gain: g * 0.9, width: 0.1, seed: seed + 1 });
  if (V.stock === 'takedown') [0.006, 0.014].forEach((d) => sgModes(B, { at: at + d, modes: [[k * 4.4, 0.012, 1], [k * 7.1, 0.007, 0.5]], gain: g * 0.6, seed: seed + 2 })); // the joint rattles
}

// ---- steel moving on steel ---------------------------------------------------------------
// One part slamming into another: a sharp click on top and a short ring under it (f = the
// part's lowest ring, g = how hard, t = how long it rings), with a dull thud when it is heavy.
function sgClack(B, at, f, g, t, seed, thud) {
  sgNoise(B, { at, filt: [['hp', Math.min(6500, f * 1.7), 0.7]], att: 0.0001, tau: 0.0012, dur: 0.01, gain: g * 0.9, width: 0.2, seed });
  sgModes(B, { at, modes: [[f, t, 1], [f * 2.41, t * 0.62, 0.62], [f * 4.13, t * 0.4, 0.4], [f * 6.27, t * 0.28, 0.25]], gain: g * 0.5, seed: seed + 1 });
  if (thud) sgNoise(B, { at, filt: [['lp', 650, 0.8]], att: 0.0006, tau: 0.01, dur: 0.05, gain: g * thud, width: 0.1, seed: seed + 2 });
}
// Steel sliding along steel: a hiss that rises and falls in pitch with the stroke, rippling
// as the lugs and cuts pass each other.
function sgScrape(B, at, dur, f0, f1, g, seed, rip) {
  sgNoise(B, { at, att: dur * 0.3, hold: dur * 0.35, tau: dur * 0.12, dur: dur * 0.6, curve: 1.5, filt: [['bp', f0, 2.2, 0, f1, dur * 0.7], ['hp', 500, 0.7]], gain: g, roll: [rip || 45, 0.7], width: 0.3, seed });
}
// An empty case landing: a bright clink and a bounce or two on something hard, a dull tap on dirt or snow.
function sgBrass(B, at, ground, big, seed) {
  const rnd = sgRng(seed), soft = ground === 'dirt' || ground === 'snow', f = (big ? 1900 : 3700) * (0.92 + rnd() * 0.16);
  [[0, 1], [0.085 + rnd() * 0.03, 0.45], [0.14 + rnd() * 0.04, 0.22]].forEach((b, i) => {
    if (soft && i > 1) return;
    sgModes(B, { at: at + b[0], modes: [[f, soft ? 0.008 : 0.06, 1], [f * 1.53, soft ? 0.005 : 0.04, 0.6], [f * 2.31, soft ? 0.003 : 0.025, 0.4]], gain: 0.08 * b[1] * (soft ? 0.7 : 1) * (big ? 1.4 : 1), seed: seed + i });
    if (soft) sgNoise(B, { at: at + b[0], filt: [['lp', 1500, 0.7]], tau: 0.01, dur: 0.05, gain: 0.06 * b[1], seed: seed + 9 });
  });
}
SG.brass = function (ground, big, seed) { const B = sgBuf(0.5); sgBrass(B, 0.002, ground, big, seed || 1); return sgFinish(B, { gain: 1.6, ceil: 0.9 }); };
// A semi-automatic's action inside the shot: each hit [after the blast s, ring Hz, how hard,
// ring length, thud], an AR's buffer spring twanging, gas hissing out of the ejection port
// (heard with a suppressor), and the case landing.
const SG_SEMI = {
  ar: { hits: [[0.006, 2850, 0.16, 0.012], [0.028, 1520, 0.24, 0.025, 0.4], [0.064, 2120, 0.28, 0.02, 0.3]], spring: [1040, 0.09], brass: 0.42 },
  ar10: { hits: [[0.007, 2350, 0.18, 0.014], [0.034, 1260, 0.28, 0.03, 0.5], [0.079, 1820, 0.3, 0.024, 0.35]], spring: [830, 0.11], brass: 0.46 },
  svd: { hits: [[0.004, 900, 0.18, 0.02, 0.8], [0.031, 1660, 0.26, 0.022, 0.3], [0.068, 1920, 0.27, 0.02, 0.3], [0.081, 3400, 0.08, 0.01]], brass: 0.45 },
  vss: { hits: [[0.036, 1410, 0.3, 0.03, 0.5], [0.088, 1760, 0.3, 0.025, 0.35]], brass: 0.4 },
  rimfire: { hits: [[0.003, 3650, 0.16, 0.008], [0.016, 2620, 0.24, 0.012, 0.2]], brass: 0.36, small: 1 },
};
function sgCarrier(B, tB, S, k, nx) {
  const M = SG_SEMI[S.V.mech]; if (!M) return;
  M.hits.forEach((h) => sgClack(B, tB + h[0], h[1], h[2] * k, h[3], nx(), h[4]));
  if (M.spring) sgTone(B, { at: tB + M.hits[1][0], f: M.spring[0] * 1.06, f1: M.spring[0], glide: 0.02, att: 0.001, tau: M.spring[1] / 3, dur: M.spring[1] * 2, gain: 0.05 * k, drive: 0.8 });
  if (S.D.supp) sgNoise(B, { at: tB + M.hits[M.hits.length > 2 ? 1 : 0][0], filt: [['bp', 2600, 0.8]], att: 0.001, tau: 0.012, dur: 0.07, gain: 0.22 * k, width: 0.3, seed: nx() });
  sgBrass(B, tB + M.brass, S.ground, false, nx());
}
// Working a bolt after the shot (play it from B.at seconds after the shot): lift, draw back,
// the case flicked out and landing, push forward, close and turn down. Each kind has its own
// pitches, weight and length of throw; a Mauser cocks as it closes, so its push grinds.
const SG_BOLT = {
  bolt: { lift: 2380, scrape: [2100, 850], lock: 1520, g: 1, ring: 1, thr: 1 },
  'bolt-s': { lift: 2550, scrape: [2300, 950], lock: 1650, g: 0.9, ring: 0.9, thr: 0.85 },
  mauser: { lift: 1880, scrape: [1750, 700], lock: 1240, g: 1.35, ring: 1.2, thr: 1.1, cock: 1 },
  'bolt-t': { lift: 2650, scrape: [2400, 1000], lock: 1720, g: 1.05, ring: 1.3, thr: 0.95 },
  'bolt-l': { lift: 2950, scrape: [2600, 1150], lock: 1930, g: 0.75, ring: 0.8, thr: 0.9 },
  'bolt-m': { lift: 2200, scrape: [1950, 800], lock: 1420, g: 1.2, ring: 1.15, thr: 1.12 },
  'bolt-mh': { lift: 2080, scrape: [1850, 760], lock: 1350, g: 1.25, ring: 1.2, thr: 1.15 },
  'bolt-x': { lift: 1980, scrape: [1800, 720], lock: 1300, g: 1.3, ring: 1.25, thr: 1.18 },
  'bolt-50': { lift: 1480, scrape: [1350, 520], lock: 940, g: 1.7, ring: 1.6, thr: 1.3, big: 1 },
};
function sgBoltWork(B, t0, M, c, ground, rnd, open, close) {
  const nx = () => (rnd() * 4294967296) >>> 0, j = (a) => 1 + (rnd() * 2 - 1) * a, g = M.g, sc = Math.min(0.22, 0.14 * c * M.thr);
  let t = t0;
  if (open) {
    sgClack(B, t, M.lift * j(0.03), 0.24 * g, 0.014 * M.ring, nx(), 0.3);                       // lift
    sgScrape(B, t + 0.03, sc, M.scrape[0], M.scrape[1], 0.2 * g, nx(), 38);                       // draw back
    sgClack(B, t + 0.03 + sc, 3100 * j(0.05), 0.13, 0.01, nx());                                  // the case flicked out
    sgBrass(B, t + 0.03 + sc + 0.3, ground, !!M.big, nx());
    t += 0.03 + sc + 0.12 * c;
  }
  if (close) {
    sgScrape(B, t, sc * (M.cock ? 1.2 : 1), M.scrape[1], M.scrape[0], (M.cock ? 0.3 : 0.2) * g, nx(), M.cock ? 26 : 42); // push forward
    if (M.cock) sgNoise(B, { at: t + sc * 0.5, filt: [['bp', 900, 1.5]], att: sc * 0.4, tau: sc * 0.2, dur: sc * 0.5, gain: 0.12, seed: nx() });
    sgClack(B, t + sc * (M.cock ? 1.2 : 1), M.lock * 1.3 * j(0.03), 0.22 * g, 0.012 * M.ring, nx());    // the round into the chamber
    sgClack(B, t + sc * (M.cock ? 1.2 : 1) + 0.045 * c, M.lock * j(0.03), 0.34 * g, 0.022 * M.ring, nx(), 0.6); // handle down
    t += sc + 0.05 * c + 0.05;
  }
  return t;
}
// The action after a shot, as its own sound, with B.at = when it starts after the shot.
// A bolt is worked; a coil gun's capacitors recharge with a rising whine; others have nothing here.
SG.action = function (S, seed) {
  const rnd = sgRng(seed * 31 + 7), c = S.cycle, M = SG_BOLT[S.V.mech];
  if (S.coil) {
    const B = sgBuf(c * 0.85 + 0.3);
    sgTone(B, { at: 0, f: 140, f1: 2600, glide: c * 0.4, att: c * 0.6, hold: c * 0.1, tau: 0.04, dur: 0.3, gain: 0.06, drive: 1.4, filt: [['lp', 4000, 0.7]] });
    sgTone(B, { at: 0, f: 70, f1: 300, glide: c * 0.5, att: c * 0.6, hold: c * 0.1, tau: 0.05, dur: 0.3, gain: 0.08 });
    sgClack(B, c * 0.78, 2900, 0.12, 0.03, (rnd() * 1e9) | 0);                                      // "ready"
    sgTone(B, { at: c * 0.78, f: 1760, att: 0.002, tau: 0.03, dur: 0.12, gain: 0.04 });
    B.at = c * 0.12; return sgFinish(B, { gain: 1.4, ceil: 0.9 });
  }
  if (!M) return null;
  const t0 = 0.17 * c, B = sgBuf(c * 0.9 + 0.6);
  sgBoltWork(B, 0.005, M, c, S.ground, rnd, true, true);
  B.at = t0 - 0.005;
  return sgFinish(B, { gain: 1.5, ceil: 0.9 });
};
// Reloading, laid out over `dur` seconds (the rifle's real reload time). Each kind of rifle loads its own way.
SG.reload = function (S, dur, seed) {
  const rnd = sgRng(seed * 131 + 3), nx = () => (rnd() * 4294967296) >>> 0, B = sgBuf(dur + 0.5), mech = S.V.mech, M = SG_BOLT[mech], gr = S.ground;
  const magOut = (t, f, g) => { sgClack(B, t, f, 0.2 * g, 0.012, nx()); sgScrape(B, t + 0.02, 0.12, 1500, 650, 0.14 * g, nx(), 30); };
  const magIn = (t, f, g) => { sgScrape(B, t - 0.1, 0.1, 700, 1400, 0.12 * g, nx(), 30); sgClack(B, t, f * 0.7, 0.3 * g, 0.02, nx(), 0.7); sgClack(B, t + 0.04, f, 0.22 * g, 0.012, nx()); };
  if (S.coil) {
    magOut(dur * 0.15, 2100, 1); magIn(dur * 0.5, 2300, 1);
    sgTone(B, { at: dur * 0.6, f: 90, f1: 1900, glide: dur * 0.18, att: dur * 0.3, hold: 0.05, tau: 0.04, dur: 0.25, gain: 0.07, drive: 1.2 });
    sgClack(B, dur * 0.93, 2900, 0.14, 0.03, nx()); sgTone(B, { at: dur * 0.93, f: 1760, att: 0.002, tau: 0.03, dur: 0.12, gain: 0.05 });
  } else if (mech === 'single') {
    sgClack(B, dur * 0.1, 1300, 0.34, 0.025, nx(), 0.6);                                          // the lever throws the breech open
    sgTone(B, { at: dur * 0.1 + 0.02, f: 1650, f1: 1500, glide: 0.03, att: 0.001, tau: 0.04, dur: 0.18, gain: 0.05 }); // its spring
    sgClack(B, dur * 0.17, 3400, 0.14, 0.01, nx()); sgBrass(B, dur * 0.17 + 0.32, gr, false, nx());
    sgScrape(B, dur * 0.5, 0.14, 900, 2100, 0.15, nx(), 30); sgClack(B, dur * 0.57, 1900, 0.2, 0.015, nx()); // a round slid in and seated
    sgClack(B, dur * 0.82, 1250, 0.4, 0.03, nx(), 0.8);                                           // shut
  } else if (mech === 'mauser') {
    sgBoltWork(B, dur * 0.06, M, 1.5, gr, rnd, true, false);
    sgClack(B, dur * 0.3, 2600, 0.16, 0.012, nx());                                               // the clip into its guide
    for (let i = 0; i < 5; i++) sgClack(B, dur * (0.36 + i * 0.045), 2100 + i * 60, 0.15, 0.01, nx(), 0.2); // five rounds thumbed down
    sgClack(B, dur * 0.62, 3300, 0.1, 0.05, nx());                                                // the empty clip flicks away
    sgBoltWork(B, dur * 0.76, M, 1.5, gr, rnd, false, true);
  } else if (mech === 'ar' || mech === 'ar10') {
    magOut(dur * 0.12, 2400, 1); magIn(dur * 0.55, 2000, 1.1);
    sgClack(B, dur * 0.86, mech === 'ar' ? 1750 : 1500, 0.42, 0.03, nx(), 0.6);                    // the bolt catch let go: slam
    sgTone(B, { at: dur * 0.86, f: SG_SEMI[mech].spring[0], att: 0.001, tau: 0.04, dur: 0.2, gain: 0.04 });
  } else if (mech === 'svd' || mech === 'vss') {
    magOut(dur * 0.14, 2200, 1);
    sgClack(B, dur * 0.47, 1800, 0.2, 0.012, nx()); sgClack(B, dur * 0.53, 1300, 0.34, 0.02, nx(), 0.7); // hooked in front, rocked back
    sgScrape(B, dur * 0.72, 0.12, 1900, 800, 0.2, nx(), 40); sgClack(B, dur * 0.86, 1600, 0.4, 0.025, nx(), 0.5); // the handle drawn and let go
  } else if (mech === 'rimfire') {
    magOut(dur * 0.15, 3000, 0.7); magIn(dur * 0.52, 2700, 0.7);
    sgScrape(B, dur * 0.76, 0.08, 2600, 1200, 0.12, nx(), 50); sgClack(B, dur * 0.85, 2400, 0.26, 0.012, nx());
  } else {
    sgBoltWork(B, dur * 0.06, M || SG_BOLT.bolt, 1.4, gr, rnd, true, false);
    magOut(dur * 0.3, 2300, 1); magIn(dur * 0.6, 2000, 1);
    sgBoltWork(B, dur * 0.8, M || SG_BOLT.bolt, 1.4, gr, rnd, false, true);
  }
  return sgFinish(B, { gain: 1.5, ceil: 0.9 });
};
// the trigger on an empty chamber
SG.dry = function (seed) { const B = sgBuf(0.25); sgClack(B, 0.002, 1750, 0.5, 0.02, seed || 5, 0.4); sgClack(B, 0.004, 3300, 0.2, 0.008, (seed || 5) + 9); return sgFinish(B, { gain: 1.2 }); };
// the coil gun charging (dur s), ending as it fires
SG.charge = function (dur) {
  const B = sgBuf(dur + 0.05);
  sgTone(B, { at: 0, f: 180, f1: 3200, glide: dur * 0.55, att: dur * 0.95, tau: 0.01, dur: 0.05, gain: 0.12, drive: 1.6, filt: [['lp', 6000, 0.7]] });
  sgTone(B, { at: 0, f: 60, f1: 240, glide: dur * 0.6, att: dur * 0.9, tau: 0.02, dur: 0.06, gain: 0.16 });
  sgNoise(B, { at: dur * 0.3, filt: [['bp', 5200, 2]], att: dur * 0.65, tau: 0.01, dur: 0.05, gain: 0.05, roll: [80, 0.9], seed: 77 });
  return sgFinish(B, { gain: 1.4, ceil: 0.9 });
};

// ---- the coil gun --------------------------------------------------------------------------
// The Stormglass has no powder. Its shot is the capacitors dumping (a sharp electric snap with a
// fizz of sparks), the coils firing one after another down the rails (a fast mechanical "trrack"
// over a deep magnetic thump), a slug at seven times the speed of sound (an enormous crack and a
// long tearing whip), the rails ringing, the capacitors' whine dropping away, and air rushing
// back into the slug's path. The field damper soaks up most of the crack and hums as it does.
SG.coil = function (S, seed) {
  const rnd = sgRng(seed * 577 + 3), nx = () => (rnd() * 4294967296) >>> 0, damp = !!S.D.hum, rt = sgRt(S), k = S.dense ? 1.15 : 1, ck = S.crackK * (damp ? 0.32 : 1);
  const B = sgBuf(sgLen(S, rt));
  sgNoise(B, { at: 0, filt: [['hp', 3200, 0.7]], att: 0.0001, tau: 0.002, dur: 0.012, gain: 0.7 * k, seed: nx() });
  for (let i = 0; i < 14; i++) sgNoise(B, { at: rnd() * 0.012, filt: [['bp', 4000 + rnd() * 6000, 3]], att: 0.00005, tau: 0.0006, dur: 0.004, gain: (0.25 + rnd() * 0.25) * k, width: 0.8, seed: nx() });
  sgTone(B, { at: 0.001, f: 150, f1: 38, glide: 0.04, att: 0.0015, tau: 0.16, dur: 1, gain: 0.95 * (damp ? 1.2 : 1) * k, drive: 2.2 });
  sgTone(B, { at: 0.001, f: 420, f1: 160, glide: 0.03, att: 0.001, tau: 0.05, dur: 0.3, gain: 0.25 * k, drive: 2 });
  for (let i = 0; i < 6; i++) sgClack(B, 0.0008 + i * 0.0016, 640 * (1 + i * 0.13), 0.17 * k, 0.05, nx());
  sgNwave(B, { at: 0.012, len: 0.0004, gain: 1.3 * ck, bounce: 0.0013, filt: [['hp', 300, 0.7]] });
  sgNoise(B, { at: 0.012, filt: [['bp', 9000, 1.1, 0, 1100, 0.12]], att: 0.0005, tau: 0.05, dur: 0.35, gain: 0.34 * (damp ? 0.45 : 1), width: 0.5, seed: nx() });
  sgModes(B, { at: 0.002, modes: [[3100, 0.22, 1], [7400, 0.14, 0.6], [11200, 0.08, 0.4], [1530, 0.3, 0.7]], gain: 0.07, seed: nx() });
  sgTone(B, { at: 0.004, f: 3400, f1: 380, glide: 0.09, att: 0.001, tau: 0.12, dur: 0.6, gain: 0.08, drive: 1.2 });
  sgNoise(B, { at: 0.02, filt: [['hp', 1800, 0.7], ['lp', 7000, 0.7]], att: 0.01, tau: 0.12, dur: 0.6, roll: [60, 0.8], gain: 0.16, width: 0.7, seed: nx() });
  if (damp) { sgTone(B, { at: 0.002, f: 100, att: 0.004, tau: 0.25, dur: 1.2, gain: 0.2, drive: 3 }); sgTone(B, { at: 0.002, f: 50, att: 0.004, tau: 0.3, dur: 1.4, gain: 0.22, drive: 1.5 }); }
  sgPlace(B, S, 0.002, rt, rnd);
  return sgFinish(B, { loud: S.loud, peakMax: 2.2, span: 0.6 });
};

// ---- hitting people -----------------------------------------------------------------------
// The confirm: heard the instant the round lands, close and punchy, so the player feels the hit
// whatever the distance. Every confirm is an impact on top (the crack of the strike), meat under
// it (a wet, heavy thwack), a punch you feel (a falling sine, driven so a phone plays it) and a
// confirmation layer (a short bright "ting" and a low "thoom" for a kill, so it reads at once).
//   head    sharp crack, the hollow tock of the skull giving way, a bright ting
//   body    a deep heavy thwack, a big low thoom, a darker ting
//   wound   a dull short "tuk" with no confirmation: it did not finish them
//   vest    body armour: the round slams into a steel plate, "TANK", ringing, a fizz of spall
SG.confirm = function (kind, seed) {
  const rnd = sgRng((seed || 1) * 7 + 101), nx = () => (rnd() * 4294967296) >>> 0, j = (a) => 1 + (rnd() * 2 - 1) * a, B = sgBuf(0.9);
  if (kind === 'head') {
    sgNoise(B, { filt: [['hp', 3000, 0.7]], att: 0.0002, tau: 0.0025, dur: 0.02, gain: 0.9, width: 0.2, seed: nx() });            // crack
    sgNoise(B, { filt: [['bp', 2200 * j(0.04), 3.5, 0, 1400, 0.02]], att: 0.0004, tau: 0.009, dur: 0.06, gain: 1.2, seed: nx() });  // bone snap
    sgModes(B, { at: 0.001, modes: [[1050 * j(0.03), 0.018, 1], [2380, 0.01, 0.5]], gain: 0.35, seed: nx() });                       // the skull's hollow tock
    sgNoise(B, { at: 0.002, filt: [['lp', 1600, 0.8, 0, 300, 0.03], ['pk', 420, 1.4, 6]], att: 0.0008, tau: 0.022, dur: 0.14, gain: 1.0, width: 0.25, seed: nx() }); // meat
    sgTone(B, { at: 0.001, f: 175, f1: 62, glide: 0.035, att: 0.0015, tau: 0.05, dur: 0.3, gain: 0.55, drive: 2.2 });              // punch
    sgTone(B, { at: 0.002, f: 95, f1: 42, glide: 0.06, att: 0.002, tau: 0.09, dur: 0.5, gain: 0.5, drive: 1.2 });                   // thoom
    sgModes(B, { at: 0.004, modes: [[2630 * j(0.01), 0.07, 1], [5290, 0.045, 0.5], [7950, 0.025, 0.25]], gain: 0.09, seed: nx() });   // ting
    sgNoise(B, { at: 0.006, filt: [['hp', 5000, 0.7]], att: 0.003, tau: 0.04, dur: 0.2, gain: 0.08, width: 0.9, seed: nx() });        // air after
  } else if (kind === 'body') {
    sgNoise(B, { filt: [['hp', 2600, 0.7]], att: 0.0002, tau: 0.0015, dur: 0.012, gain: 0.5, width: 0.2, seed: nx() });
    sgNoise(B, { at: 0.001, filt: [['lp', 900, 0.8, 0, 160, 0.04], ['pk', 180, 1.2, 7]], att: 0.0008, tau: 0.035, dur: 0.22, gain: 1.4, width: 0.25, seed: nx() }); // the heavy thwack
    sgNoise(B, { at: 0.002, filt: [['bp', 700, 2.5, 0, 300, 0.05]], att: 0.001, tau: 0.03, dur: 0.15, gain: 0.5, seed: nx() });        // wet weight
    sgTone(B, { at: 0.001, f: 140, f1: 58, glide: 0.04, att: 0.0015, tau: 0.06, dur: 0.35, gain: 0.6, drive: 2.2 });
    sgTone(B, { at: 0.002, f: 86, f1: 36, glide: 0.07, att: 0.002, tau: 0.12, dur: 0.6, gain: 0.7, drive: 1.3 });
    sgNoise(B, { at: 0.01, brown: true, filt: [['lp', 260, 0.7]], att: 0.01, tau: 0.12, dur: 0.6, gain: 0.5, width: 0.8, seed: nx() });
    sgModes(B, { at: 0.005, modes: [[1890 * j(0.01), 0.06, 1], [3790, 0.04, 0.45]], gain: 0.07, seed: nx() });
  } else if (kind === 'vest') {
    sgNoise(B, { filt: [['hp', 3200, 0.7]], att: 0.0001, tau: 0.0015, dur: 0.012, gain: 0.9, seed: nx() });
    sgModes(B, { at: 0.0005, modes: [[1650 * j(0.02), 0.16, 1], [2480 * j(0.02), 0.12, 0.7], [3910, 0.08, 0.5], [5620, 0.05, 0.35], [940, 0.1, 0.4]], gain: 0.32, seed: nx() });
    sgTone(B, { at: 0.001, f: 160, f1: 90, glide: 0.03, att: 0.001, tau: 0.04, dur: 0.25, gain: 0.45, drive: 2 });
    sgNoise(B, { at: 0.002, filt: [['bp', 5200, 1.2]], att: 0.002, tau: 0.04, dur: 0.25, gain: 0.18, roll: [70, 0.8], width: 0.8, seed: nx() }); // spall fizz
  } else { // wound
    sgNoise(B, { filt: [['bp', 820 * j(0.05), 1.2]], att: 0.0006, tau: 0.012, dur: 0.07, gain: 0.8, seed: nx() });
    sgNoise(B, { at: 0.001, filt: [['lp', 700, 0.8]], att: 0.001, tau: 0.018, dur: 0.1, gain: 0.7, seed: nx() });
    sgTone(B, { at: 0.001, f: 175, f1: 110, glide: 0.03, att: 0.0015, tau: 0.02, dur: 0.12, gain: 0.35, drive: 1.5 });
  }
  return sgFinish(B, { loud: { head: -9, body: -8.5, vest: -10, wound: -15 }[kind] || -12, peakMax: 2 });
};
// The impact itself, as heard where it lands (the engine delays it by the sound's travel and
// dulls it with distance). mat: flesh, head (each with a wet version for gore), dirt, metal, hard
// (stone, concrete), glass, wood, water, snow.
SG.impact = function (mat, seed, wet) {
  const rnd = sgRng((seed || 1) * 13 + sgHash(mat)), nx = () => (rnd() * 4294967296) >>> 0, j = (a) => 1 + (rnd() * 2 - 1) * a;
  const B = sgBuf(mat === 'glass' || mat === 'metal' || mat === 'hard' ? 1.3 : 0.8);
  if (mat === 'flesh' || mat === 'head') {
    const hd = mat === 'head';
    sgNoise(B, { filt: [['bp', hd ? 1900 : 1100, 1.4]], att: 0.0003, tau: 0.006, dur: 0.04, gain: hd ? 0.9 : 0.6, seed: nx() });
    sgNoise(B, { at: 0.001, filt: [['lp', 800, 0.8, 0, 180, 0.04]], att: 0.0008, tau: 0.03, dur: 0.18, gain: 1.2, seed: nx() });
    sgTone(B, { at: 0.001, f: 135, f1: 60, glide: 0.04, att: 0.0015, tau: 0.05, dur: 0.3, gain: 0.55, drive: 1.6 });
    if (wet) { sgNoise(B, { at: 0.005, filt: [['bp', 950, 3.5, 0, 380, 0.05]], att: 0.002, tau: 0.04, dur: 0.2, gain: 1.0, seed: nx() }); for (let i = 0; i < 7; i++) sgNoise(B, { at: 0.08 + rnd() * 0.4, filt: [['bp', 1400 + rnd() * 1800, 6]], att: 0.0006, tau: 0.004, dur: 0.02, gain: 0.16 + rnd() * 0.1, width: 0.8, seed: nx() }); }
  } else if (mat === 'metal') { // a hard "pank" with a ricochet whining away
    const f = 1700 + rnd() * 1500;
    sgNoise(B, { filt: [['hp', 3000, 0.7]], att: 0.0001, tau: 0.002, dur: 0.015, gain: 0.9, seed: nx() });
    sgModes(B, { at: 0.0005, modes: [[f, 0.22, 1], [f * 1.52, 0.12, 0.5], [f * 2.33, 0.07, 0.3], [f * 0.53, 0.15, 0.4]], gain: 0.3, seed: nx() });
    if (rnd() < 0.75) { const w = 3400 + rnd() * 1800; sgTone(B, { at: 0.01, f: w, f1: w * 0.38, glide: 0.25, att: 0.01, tau: 0.13, dur: 0.6, gain: 0.12, filt: [['hp', 900, 0.7]] }); sgNoise(B, { at: 0.01, filt: [['bp', w * 0.8, 6, 0, w * 0.35, 0.25]], att: 0.01, tau: 0.12, dur: 0.5, gain: 0.2, width: 0.6, seed: nx() }); }
  } else if (mat === 'hard') { // stone or concrete: a sharp chip, grit, sometimes a whine
    sgNoise(B, { filt: [['hp', 2200, 0.7]], att: 0.0001, tau: 0.003, dur: 0.02, gain: 1, seed: nx() });
    sgNoise(B, { at: 0.001, filt: [['lp', 1500, 0.8, 0, 300, 0.05]], att: 0.0006, tau: 0.02, dur: 0.15, gain: 0.8, seed: nx() });
    for (let i = 0; i < 9; i++) sgNoise(B, { at: 0.01 + rnd() * 0.35, filt: [['bp', 2500 + rnd() * 4000, 3]], att: 0.0003, tau: 0.002, dur: 0.012, gain: 0.15 + rnd() * 0.15, width: 0.9, pan: rnd() * 2 - 1, seed: nx() });
    if (rnd() < 0.45) { const w = 2800 + rnd() * 1500; sgTone(B, { at: 0.015, f: w, f1: w * 0.4, glide: 0.3, att: 0.015, tau: 0.15, dur: 0.6, gain: 0.08 }); }
  } else if (mat === 'glass') { // the pane bursting, then pieces tinkling down
    sgNoise(B, { filt: [['hp', 3800, 0.7]], att: 0.0002, tau: 0.03, dur: 0.25, gain: 0.8, width: 0.7, seed: nx() });
    sgTone(B, { at: 0.001, f: 420, f1: 220, glide: 0.02, att: 0.001, tau: 0.02, dur: 0.1, gain: 0.25 });
    for (let i = 0; i < 18; i++) { const f = 2500 + rnd() * 5500; sgModes(B, { at: 0.02 + Math.pow(rnd(), 1.5) * 0.9, modes: [[f, 0.03 + rnd() * 0.05, 1], [f * 1.7, 0.02, 0.4]], gain: 0.05 + rnd() * 0.06, pan: rnd() * 2 - 1, seed: nx() }); }
    sgNoise(B, { at: 0.15, filt: [['hp', 3000, 0.7]], att: 0.1, tau: 0.15, dur: 0.6, roll: [30, 0.9], gain: 0.12, width: 0.9, seed: nx() });
  } else if (mat === 'wood') { // a hollow "thock" and splinters
    sgModes(B, { modes: [[310 * j(0.05), 0.03, 1], [720 * j(0.05), 0.02, 0.6], [1380, 0.012, 0.4]], gain: 0.5, seed: nx() });
    sgNoise(B, { filt: [['bp', 1100, 1.1]], att: 0.0003, tau: 0.008, dur: 0.05, gain: 0.8, seed: nx() });
    for (let i = 0; i < 7; i++) sgNoise(B, { at: rnd() * 0.12, filt: [['bp', 2200 + rnd() * 3000, 5]], att: 0.0003, tau: 0.003, dur: 0.015, gain: 0.15 + rnd() * 0.12, width: 0.8, seed: nx() });
  } else if (mat === 'water') { // a hard slap, a splash, bubbles
    sgNoise(B, { filt: [['bp', 1500, 0.8, 0, 500, 0.1]], att: 0.002, tau: 0.08, dur: 0.45, gain: 0.8, width: 0.6, seed: nx() });
    sgNoise(B, { filt: [['hp', 2500, 0.7]], att: 0.0003, tau: 0.004, dur: 0.02, gain: 0.5, seed: nx() });
    for (let i = 0; i < 6; i++) { const f = 500 + rnd() * 900; sgTone(B, { at: 0.06 + rnd() * 0.35, f, f1: f * 1.8, glide: 0.02, att: 0.002, tau: 0.012, dur: 0.06, gain: 0.08 + rnd() * 0.06 }); }
  } else if (mat === 'snow') { // a soft thump and a crunch
    sgNoise(B, { filt: [['lp', 1800, 0.7, 0, 400, 0.04]], att: 0.001, tau: 0.03, dur: 0.15, gain: 0.8, seed: nx() });
    for (let i = 0; i < 4; i++) sgNoise(B, { at: rnd() * 0.06, filt: [['bp', 1800 + rnd() * 1500, 2]], att: 0.0005, tau: 0.006, dur: 0.02, gain: 0.15, seed: nx() });
  } else { // dirt: a thud, a spray of grit falling back
    sgNoise(B, { filt: [['lp', 1100, 0.8, 0, 250, 0.05]], att: 0.0006, tau: 0.03, dur: 0.18, gain: 1, seed: nx() });
    sgTone(B, { at: 0.001, f: 110, f1: 55, glide: 0.04, att: 0.0015, tau: 0.04, dur: 0.25, gain: 0.35, drive: 1.4 });
    for (let i = 0; i < 12; i++) sgNoise(B, { at: 0.05 + rnd() * 0.45, filt: [['bp', 1500 + rnd() * 3000, 2.5]], att: 0.0006, tau: 0.004, dur: 0.02, gain: 0.06 + rnd() * 0.08, width: 0.9, pan: rnd() * 2 - 1, seed: nx() });
  }
  return sgFinish(B, { loud: { flesh: -11, head: -11, glass: -12, metal: -12, water: -13, snow: -15 }[mat] || -12, peakMax: 2 });
};

// ---- explosions ---------------------------------------------------------------------------
// A gas tank or fuel drum going up, as heard from where the shooter lies: the blast's crack (a
// long, heavy pressure pulse, so it slams rather than clicks), the low boom and the thump in the
// chest, the fireball roaring as the fuel catches, debris (metal, glass, dirt) raining down for
// a few seconds, and a long rolling tail with the echoes of the place it is in.
SG.boom = function (loc, seed) {
  const rnd = sgRng((seed || 1) * 389 + 5), nx = () => (rnd() * 4294967296) >>> 0, L = SG_LOC[loc] || SG_LOC.valley, B = sgBuf(6.5);
  sgBlast(B, { at: 0, T: 0.007, b: 1.2, gain: 1.1, filt: [['lp', 5000, 0.7]] });
  sgNwave(B, { at: 0.0005, len: 0.0016, gain: 0.5, filt: [['hp', 200, 0.7]] });
  sgNoise(B, { filt: [['hp', 3500, 0.7]], att: 0.0002, tau: 0.01, dur: 0.08, gain: 0.5, width: 0.4, seed: nx() });
  sgNoise(B, { filt: [['lp', 3000, 0.7, 0, 220, 0.25], ['pk', 120, 1, 6]], att: 0.002, tau: 0.22, dur: 1.5, gain: 1.1, width: 0.5, seed: nx() });      // the blast body
  sgTone(B, { f: 62, f1: 24, glide: 0.25, att: 0.004, tau: 0.45, dur: 2.6, gain: 0.9, drive: 2.2 });                                                    // the boom
  sgTone(B, { f: 160, f1: 60, glide: 0.08, att: 0.002, tau: 0.12, dur: 0.7, gain: 0.35, drive: 2.5 });                                                  // (for a phone)
  sgNoise(B, { at: 0.005, brown: true, filt: [['lp', 320, 0.7]], att: 0.01, tau: 0.6, dur: 3, gain: 1.2, width: 0.7, seed: nx() });                       // the chest thump rolling on
  sgNoise(B, { at: 0.06, filt: [['bp', 600, 0.7, 0, 260, 1.2]], att: 0.12, tau: 0.6, dur: 3, roll: [9, 0.7], gain: 0.5, width: 0.8, seed: nx() });        // the fireball roaring
  for (let i = 0; i < 46; i++) { // debris coming down, thick at first then sparser
    const t = 0.12 + Math.pow(rnd(), 1.8) * 3.2, r = rnd(), pan = rnd() * 2 - 1, g = (0.25 + rnd() * 0.5) * Math.max(0.25, 1 - t / 3.5);
    if (r < 0.35) { const f = 500 + rnd() * 2600; sgModes(B, { at: t, modes: [[f, 0.06 + rnd() * 0.1, 1], [f * (1.4 + rnd() * 0.8), 0.04, 0.5]], gain: 0.07 * g, pan, seed: nx() }); }
    else if (r < 0.48) { const f = 3000 + rnd() * 4000; sgModes(B, { at: t, modes: [[f, 0.03, 1], [f * 1.6, 0.02, 0.4]], gain: 0.04 * g, pan, seed: nx() }); }
    else sgNoise(B, { at: t, filt: [['lp', 500 + rnd() * 1800, 0.8]], att: 0.0008, tau: 0.01 + rnd() * 0.02, dur: 0.12, gain: 0.25 * g, pan, seed: nx() });
  }
  // the place: its first echoes, big late returns, and a long roll
  const dry = sgTake(B, 0, 0.12);
  L.slaps.forEach((s) => sgEcho(B, dry, { at: s[0] * 1.6, gain: s[1] * 0.7, pan: s[3], filt: [['lp', s[2] * 0.6, 0.7]] }));
  (L.walls || [[0.7, 0.3, 700, 0.4], [1.3, 0.22, 500, -0.4]]).forEach((w) => { sgEcho(B, dry, { at: w[0] * 1.2, gain: w[1] * 0.9, pan: w[3], filt: [['lp', w[2], 0.7]] }); sgNoise(B, { at: w[0] * 1.2, brown: true, filt: [['lp', w[2] * 0.6, 0.7]], att: 0.05, tau: 0.35, dur: 1.6, gain: w[1] * 1.6, pan: w[3], roll: [4, 0.5], seed: nx() }); });
  sgNoise(B, { at: 0.1, brown: true, filt: [['lp', 420, 0.6, 0, 110, 2.5]], att: 0.35, tau: 1.3, dur: 6, roll: [1.6, 0.6], gain: 1.0, width: 0.95, seed: nx() });
  return sgFinish(B, { loud: -4.5, peakMax: 2.6, span: 1 });
};

// ---- thunder ---------------------------------------------------------------------------------
// close: lightning striking near. A tearing crack (a rip of hundreds of sharp little shocks, fast
// at first then spreading out), the main boom a moment later, then a deep rumble that rolls on in
// uneven peals for five or six seconds. far: no crack, only the rumble, deeper and softer, in
// several swells. Each seed makes a different storm.
SG.thunder = function (kind, seed) {
  const rnd = sgRng((seed || 1) * 1009 + (kind === 'far' ? 7 : 3)), nx = () => (rnd() * 4294967296) >>> 0, close = kind !== 'far';
  const B = sgBuf(close ? 7.5 : 9);
  let t0 = 0;
  if (close) {
    // the tear: shocks fired along a path that runs away from us, so they come thick then thin
    const nT = 260 + Math.floor(rnd() * 120), span = 0.28 + rnd() * 0.2;
    for (let i = 0; i < nT; i++) {
      const u = i / nT, t = span * Math.pow(u, 1.7) + rnd() * 0.004, g = (0.25 + 0.75 * rnd()) * Math.pow(1 - u, 0.6);
      sgNwave(B, { at: t, len: 0.00012 + rnd() * 0.0005, gain: 1.0 * g, pan: rnd() * 1.4 - 0.7, filt: [['hp', 500 + rnd() * 900, 0.7]] });
    }
    sgNoise(B, { filt: [['hp', 1200, 0.7], ['lp', 9000, 0.7]], att: 0.002, hold: span * 0.4, tau: span * 0.35, dur: span * 1.5, roll: [130, 0.95], gain: 0.95, width: 0.8, seed: nx() });
    sgNoise(B, { at: 0.01, filt: [['bp', 2400, 0.8, 0, 700, span]], att: 0.005, hold: span * 0.3, tau: span * 0.4, dur: span * 2, roll: [45, 0.9], gain: 0.8, width: 0.8, seed: nx() });
    t0 = 0.1 + rnd() * 0.08;
    sgBlast(B, { at: t0, T: 0.018 + rnd() * 0.008, b: 1.1, gain: 1.0, filt: [['lp', 1800, 0.7]] });                                     // the main boom
    sgTone(B, { at: t0, f: 58, f1: 26, glide: 0.3, att: 0.006, tau: 0.55, dur: 3, gain: 0.8, drive: 2 });
    sgNoise(B, { at: t0, filt: [['lp', 1600, 0.7, 0, 200, 0.4]], att: 0.004, tau: 0.25, dur: 1.4, gain: 0.9, width: 0.6, seed: nx() });
  }
  // the rumble: peals of low noise, each with its own start, length, pitch and side
  const nP = close ? 5 + Math.floor(rnd() * 3) : 4 + Math.floor(rnd() * 3), spanP = close ? 4.5 : 6.5;
  for (let i = 0; i < nP; i++) {
    const t = t0 + (close ? 0.15 : 0.2) + Math.pow(i / nP, 1.2) * spanP * (0.8 + rnd() * 0.3), g = (close ? 1.1 : 0.9) * (0.5 + rnd() * 0.5) * (1 - 0.55 * (i / nP)), f = (close ? 380 : 260) * (0.6 + rnd() * 0.7);
    sgNoise(B, { at: t, brown: true, filt: [['lp', f, 0.7, 0, f * 0.6, 1.5], ['hp', 28, 0.6]], att: 0.15 + rnd() * 0.45, tau: 0.35 + rnd() * 0.5, dur: 2.5, roll: [2 + rnd() * 4, 0.7], gain: g, pan: rnd() * 1.2 - 0.6, width: 0.9, seed: nx() });
    if (rnd() < 0.6) sgNoise(B, { at: t + 0.05, filt: [['bp', 500 + rnd() * 700, 1.2], ['lp', close ? 6000 : 1100, 0.7]], att: 0.08, tau: 0.15 + rnd() * 0.2, dur: 1, roll: [18, 0.85], gain: g * (close ? 0.18 : 0.08), pan: rnd() * 1.2 - 0.6, width: 0.9, seed: nx() }); // a crackle inside the peal
  }
  sgTone(B, { at: t0 + 0.2, f: 42, f1: 30, glide: 1, att: 0.4, tau: 1.2, dur: 5, gain: close ? 0.35 : 0.3, drive: 1.5 });
  return sgFinish(B, { loud: close ? -5.5 : -13, peakMax: 2.4, span: 3 });
};

// ---- other things in the world ---------------------------------------------------------------
// a car crash or a dropped piano: the crunch, glass, a heavy thud, bits settling (piano adds a chord)
SG.crash = function (piano, seed) {
  const rnd = sgRng((seed || 1) * 71 + 9), nx = () => (rnd() * 4294967296) >>> 0, B = sgBuf(2.6);
  sgNoise(B, { filt: [['lp', 2400, 0.7, 0, 300, 0.25]], att: 0.002, tau: 0.12, dur: 0.8, gain: 1, width: 0.6, seed: nx() });
  sgTone(B, { f: 85, f1: 38, glide: 0.08, att: 0.002, tau: 0.12, dur: 0.7, gain: 0.7, drive: 2 });
  for (let i = 0; i < 10; i++) { const f = 300 + rnd() * 1800; sgModes(B, { at: rnd() * 0.3, modes: [[f, 0.08 + rnd() * 0.15, 1], [f * (1.3 + rnd()), 0.06, 0.6]], gain: 0.08, pan: rnd() * 2 - 1, seed: nx() }); }
  for (let i = 0; i < 12; i++) { const f = 3000 + rnd() * 4000; sgModes(B, { at: 0.03 + rnd() * 0.6, modes: [[f, 0.03, 1]], gain: 0.04, pan: rnd() * 2 - 1, seed: nx() }); }
  if (piano) [220, 277, 311, 415, 466, 587].forEach((f, i) => sgModes(B, { at: i * 0.012, modes: [[f, 0.6, 1], [f * 2.003, 0.4, 0.4], [f * 3.01, 0.25, 0.2]], gain: 0.08, seed: nx() }));
  return sgFinish(B, { loud: -9, peakMax: 2 });
};
// someone else's gun, far off (a carbine)
SG.npcShot = function (loc, seed) {
  const st = { cal: 'c556', quiet: false, sub: false, action: 'semi', cycle: 0.1 };
  return SG.report(SG.spec(st, loc), seed || 3);
};
// An alarm siren: a horn sweeping up and down (a wail), rich enough in harmonics to cut through.
SG.siren = function (secs) {
  const B = sgBuf(secs), sr = B.sr, n = B.n, x = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / sr, f = 640 + 360 * (0.5 - 0.5 * Math.cos(t * 2 * Math.PI / 2.4)); ph += (2 * Math.PI * f) / sr; const s = Math.sin(ph), v = Math.tanh(3 * (s + 0.35 * Math.sin(2 * ph) + 0.2 * Math.sin(3 * ph))); x[i] = v * Math.min(1, t / 0.3, (secs - t) / 0.4); }
  sgFilt(x, ['bp', 1300, 0.8], sr); sgFilt(x, ['pk', 2600, 2, 6], sr);
  sgMix(B, 0, x, null, 1, 0);
  return sgFinish(B, { loud: -14, peakMax: 1.5 });
};
// a struck bell or steel gong: f is its strike note (a real bell's partials, not whole multiples)
SG.bell = function (f, seed) {
  const B = sgBuf(3.2), rnd = sgRng(seed || 4);
  sgModes(B, { modes: [[f * 0.5, 2.4, 0.5], [f, 1.8, 1], [f * 1.19, 1.3, 0.55], [f * 1.5, 1.1, 0.45], [f * 2.0, 0.8, 0.5], [f * 2.52, 0.55, 0.3], [f * 3.1, 0.4, 0.25], [f * 4.07, 0.25, 0.18]], gain: 0.2, seed: (rnd() * 1e9) | 0, spread: 0.003 });
  sgNoise(B, { filt: [['hp', 2500, 0.7]], att: 0.0002, tau: 0.003, dur: 0.02, gain: 0.4, seed: 3 });
  return sgFinish(B, { loud: -12, peakMax: 1.5 });
};
// electricity: a lamp or a box arcing out
SG.zap = function (seed) {
  const rnd = sgRng((seed || 1) * 17), B = sgBuf(0.8);
  for (let i = 0; i < 30; i++) sgNoise(B, { at: Math.pow(rnd(), 1.3) * 0.35, filt: [['hp', 2000 + rnd() * 3000, 0.7]], att: 0.0001, tau: 0.0015, dur: 0.008, gain: 0.3 + rnd() * 0.5, pan: rnd() * 1.4 - 0.7, seed: (rnd() * 1e9) | 0 });
  sgTone(B, { f: 120, att: 0.002, hold: 0.25, tau: 0.04, dur: 0.15, gain: 0.25, drive: 6 });
  sgNoise(B, { filt: [['hp', 4000, 0.7]], att: 0.0002, tau: 0.006, dur: 0.04, gain: 0.6, seed: 9 });
  return sgFinish(B, { loud: -13, peakMax: 1.8 });
};
// a tyre blowing out: a hard pop and the air rushing out
SG.tyre = function () {
  const B = sgBuf(1.2);
  sgBlast(B, { T: 0.0025, gain: 1, filt: [['lp', 6000, 0.7]] });
  sgNoise(B, { filt: [['hp', 1500, 0.7]], att: 0.0004, tau: 0.008, dur: 0.05, gain: 0.6, seed: 3 });
  sgNoise(B, { at: 0.01, filt: [['bp', 3000, 0.7, 0, 1200, 0.6]], att: 0.02, tau: 0.25, dur: 1.1, gain: 0.35, width: 0.6, seed: 4 });
  return sgFinish(B, { loud: -11, peakMax: 2 });
};
// a rope or cable parting: a crack and a twang
SG.snap = function () {
  const B = sgBuf(0.8);
  sgNoise(B, { filt: [['hp', 2000, 0.7]], att: 0.0001, tau: 0.003, dur: 0.02, gain: 0.8, seed: 5 });
  sgTone(B, { f: 900, f1: 210, glide: 0.06, att: 0.001, tau: 0.08, dur: 0.5, gain: 0.25, drive: 2.5 });
  return sgFinish(B, { loud: -13, peakMax: 1.8 });
};
// steam bursting from a broken valve, then hissing on (the engine holds the hiss for its length)
SG.steam = function (secs) {
  const B = sgBuf(secs);
  sgBlast(B, { T: 0.004, gain: 0.8, filt: [['lp', 3000, 0.7]] });
  sgNoise(B, { filt: [['hp', 1800, 0.7], ['pk', 4200, 1, 5]], att: 0.01, hold: secs - 1.2, tau: 0.25, dur: 1, roll: [12, 0.25], gain: 0.5, width: 0.8, seed: 6 });
  return sgFinish(B, { loud: -14, peakMax: 1.5 });
};
// a flare lighting: a pop and a fierce fizz
SG.flare = function (secs) {
  const B = sgBuf(secs);
  sgNoise(B, { filt: [['hp', 1200, 0.7]], att: 0.0003, tau: 0.01, dur: 0.06, gain: 0.7, seed: 7 });
  sgNoise(B, { at: 0.02, filt: [['bp', 2600, 0.6]], att: 0.08, hold: secs - 1, tau: 0.2, dur: 0.8, roll: [25, 0.4], gain: 0.4, width: 0.7, seed: 8 });
  return sgFinish(B, { loud: -16, peakMax: 1.5 });
};
// The interface. Short, crisp and tactile, in the same family as the rifles' own clicks.
SG.ui = function (kind) {
  const B = sgBuf(kind === 'riser' ? 1.1 : kind === 'star' ? 1.2 : 0.5);
  if (kind === 'tap') { sgClack(B, 0.001, 2300, 0.35, 0.01, 11); sgTone(B, { f: 1320, att: 0.001, tau: 0.012, dur: 0.06, gain: 0.08 }); }
  else if (kind === 'back') { sgClack(B, 0.001, 1500, 0.35, 0.012, 12); sgTone(B, { f: 880, f1: 660, glide: 0.03, att: 0.001, tau: 0.02, dur: 0.1, gain: 0.08 }); }
  else if (kind === 'go') { sgClack(B, 0.001, 1900, 0.4, 0.015, 13, 0.4); sgClack(B, 0.07, 1300, 0.5, 0.02, 14, 0.6); sgTone(B, { at: 0.07, f: 110, f1: 60, glide: 0.05, att: 0.002, tau: 0.06, dur: 0.3, gain: 0.35, drive: 1.6 }); }
  else if (kind === 'deny') { sgTone(B, { f: 140, att: 0.002, tau: 0.04, dur: 0.12, gain: 0.3, drive: 4 }); sgTone(B, { at: 0.11, f: 110, att: 0.002, tau: 0.05, dur: 0.16, gain: 0.3, drive: 4 }); }
  else if (kind === 'buy') { sgClack(B, 0.001, 2600, 0.3, 0.01, 15); sgModes(B, { at: 0.04, modes: [[1318, 0.12, 1], [2637, 0.06, 0.3]], gain: 0.12, seed: 16 }); sgModes(B, { at: 0.11, modes: [[1760, 0.22, 1], [3520, 0.1, 0.3]], gain: 0.12, seed: 17 }); }
  else if (kind === 'equip') { sgClack(B, 0.001, 1900, 0.4, 0.014, 18); sgScrape(B, 0.03, 0.08, 900, 2200, 0.15, 19, 50); sgClack(B, 0.12, 1400, 0.5, 0.02, 20, 0.5); }
  else if (kind === 'star') { sgTone(B, { f: 70, f1: 45, glide: 0.08, att: 0.002, tau: 0.1, dur: 0.5, gain: 0.35, drive: 1.5 }); sgModes(B, { at: 0.002, modes: [[880, 0.35, 1], [1320, 0.3, 0.6], [2640, 0.15, 0.3]], gain: 0.1, seed: 21 }); sgNoise(B, { filt: [['hp', 5000, 0.7]], att: 0.002, tau: 0.08, dur: 0.4, gain: 0.08, width: 0.9, seed: 22 }); }
  else if (kind === 'page') sgNoise(B, { filt: [['bp', 2400, 0.8, 0, 900, 0.08]], att: 0.02, tau: 0.03, dur: 0.12, gain: 0.4, width: 0.6, seed: 23 });
  else if (kind === 'riser') { sgNoise(B, { filt: [['bp', 300, 2, 0, 4000, 0.5]], att: 0.8, tau: 0.03, dur: 0.15, curve: 2, gain: 0.5, width: 0.7, seed: 24 }); sgTone(B, { f: 60, f1: 120, glide: 0.5, att: 0.8, tau: 0.04, dur: 0.15, gain: 0.3, curve: 2 }); }
  else if (kind === 'radio') { sgNoise(B, { filt: [['bp', 2200, 1.5]], att: 0.001, tau: 0.03, dur: 0.12, roll: [60, 0.8], gain: 0.25, seed: 25 }); sgTone(B, { at: 0.005, f: 1250, att: 0.001, tau: 0.02, dur: 0.06, gain: 0.08, drive: 3 }); sgClack(B, 0.001, 2800, 0.12, 0.006, 26); }
  else { sgClack(B, 0.001, 3600, 0.25, 0.006, 27); } // tick
  return sgFinish(B, { loud: { tap: -20, back: -20, tick: -22, page: -22, radio: -20, deny: -17, go: -16, equip: -16, buy: -17, star: -15, riser: -18 }[kind] || -20, peakMax: 1.6 });
};

