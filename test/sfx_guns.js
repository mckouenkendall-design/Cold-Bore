// The rifle sound test. Nobody here can listen, so every rifle is measured instead.
// Every rifle is fired with every muzzle option that fits it (bare, each flash hider, brake and
// compensator, each suppressor), plus the loads that change how it sounds (subsonic, supersonic
// in a built-in can, reduced magnum), through the game's own sound code into an offline audio
// context in headless Chromium, and each shot is measured:
//   loud    how loud it feels: the loudest 50 ms, weighted the way the ear weights loudness (dBFS)
//   peak    the loudest sample (1.0 = full scale; nothing may reach it)
//   low     how much of its energy is below 150 Hz (dB of the whole): the weight of it
//   bright  the "average pitch" of its first 0.3 s (spectral centroid, Hz)
//   decay   how long until it has died 40 dB under its loudest moment (ms), echoes and all
// and every pair of shots is compared on a map of loudness by pitch and time (24 bands, 10 ms
// steps for the first 0.3 s, 50 ms steps after): diff = the average difference in dB between the
// two maps, sim = how alike they are (100 = identical, 0 = 12 dB apart on average).
// It fails if two set-ups sound nearly the same (see MIN below for exactly what that means
// and why), if any shot is quieter than the floor (12 dB under the loudest rifle), if anything
// clips, or if a heavier calibre does not measure heavier (more low end, longer decay).
// WAVs of every shot (report and action) go to shots/sfx/guns/, with summary.json.
// usage: NODE_PATH=/opt/npm-tools/node_modules node test/sfx_guns.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'shots', 'sfx', 'guns');
const FLOOR = 12;   // dB: no shot may be quieter than the loudest rifle by more than this

function pageLib() {
  const X = CB.Sfx, SG = X.gen;
  const seeded = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const fft = (re, im) => {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let len = 2; len <= n; len <<= 1) {
      const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a);
      for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr; re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } }
    }
  };
  const db = (v) => (v > 0 ? 10 * Math.log10(v) : -200);
  const LEAD = 0.5, SR = 48000;
  // 24 bands, evenly spaced in pitch from 45 Hz to 16 kHz
  const EDGES = []; for (let i = 0; i <= 24; i++) EDGES.push(45 * Math.pow(16000 / 45, i / 24));
  const bandsOf = (m, i0, N) => {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let j = 0; j < N; j++) { const v = i0 + j < m.length ? m[i0 + j] : 0; re[j] = v * (0.5 - 0.5 * Math.cos((2 * Math.PI * j) / (N - 1))); }
    fft(re, im);
    const out = new Float64Array(24);
    for (let k = 1; k < N / 2; k++) { const f = (k * SR) / N; if (f < EDGES[0] || f >= EDGES[24]) continue; let b = 0; while (f >= EDGES[b + 1]) b++; out[b] += re[k] * re[k] + im[k] * im[k]; }
    return out;
  };
  const analyze = (L, R) => {
    const n = L.length, m = new Float32Array(n);
    let peak = 0, clip = 0; for (let i = 0; i < n; i++) { m[i] = (L[i] + R[i]) * 0.5; const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > peak) peak = a; if (a >= 0.999) clip++; }
    const loud = SG.loud(L, R, SR);
    // the envelope, 10 ms steps, and the decay to -40 dB under its loudest 50 ms
    const blk = SR / 100, env = []; for (let i = 0; i + blk <= n; i += blk) { let s = 0; for (let j = i; j < i + blk; j++) s += m[j] * m[j]; env.push(s / blk); }
    const sm = env.map((v, i) => (env.slice(Math.max(0, i - 2), i + 3).reduce((a, b) => a + b, 0)) / 5);
    let top = 0, ti = 0; sm.forEach((v, i) => { if (v > top) { top = v; ti = i; } });
    let last = sm.length - 1; while (last > ti && sm[last] < top * 1e-4) last--;
    const decay = (last - ti) * 10;
    // brightness of the first 0.3 s, and the share of energy below 150 Hz (whole sound)
    let fs = 0, ps = 0, lo = 0, all = 0;
    for (let i = 0; i + 2048 <= Math.min(n, SR * 0.3 + 2048); i += 1024) { const re = new Float64Array(2048), im = new Float64Array(2048); for (let j = 0; j < 2048; j++) re[j] = m[i + j] * (0.5 - 0.5 * Math.cos((2 * Math.PI * j) / 2047)); fft(re, im); for (let k = 1; k < 1024; k++) { const p = re[k] * re[k] + im[k] * im[k], f = (k * SR) / 2048; fs += f * p; ps += p; } }
    for (let i = 0; i + 4096 <= n; i += 4096) { const re = new Float64Array(4096), im = new Float64Array(4096); for (let j = 0; j < 4096; j++) re[j] = m[i + j]; fft(re, im); for (let k = 1; k < 2048; k++) { const p = re[k] * re[k] + im[k] * im[k], f = (k * SR) / 4096; all += p; if (f < 150) lo += p; } }
    // the map: band energies every 5 ms (2048-point frames), averaged into cells of 10 ms to 0.1 s,
    // 25 ms to 0.3 s and 100 ms to 2 s; dB of energy per band, absolute, so loudness counts too
    const fr = []; for (let i = 0; i + 2048 <= Math.min(n, SR * 2.05); i += 240) fr.push([(i + 1024) / SR, bandsOf(m, i, 2048)]);
    const cells = []; for (let t = 0; t < 0.1; t += 0.01) cells.push([t, t + 0.01]); for (let t = 0.1; t < 0.3; t += 0.025) cells.push([t, t + 0.025]); for (let t = 0.3; t < 2.0; t += 0.1) cells.push([t, t + 0.1]);
    const flat = [];
    cells.forEach(([a, b]) => { const acc = new Float64Array(24); let k = 0; fr.forEach(([tc, e]) => { if (tc >= a && tc < b) { for (let j = 0; j < 24; j++) acc[j] += e[j]; k++; } }); for (let j = 0; j < 24; j++) flat.push(Math.max(-80, db(acc[j] / Math.max(1, k)))); });
    // the tail on its own (0.4 to 2 s): its level against the loudest 50 ms, and its brightness
    let te = 0, tf = 0, tp = 0;
    for (let i = Math.round(0.4 * SR); i + 2048 <= Math.min(n, 2 * SR); i += 2048) { const re = new Float64Array(2048), im = new Float64Array(2048); for (let j = 0; j < 2048; j++) { re[j] = m[i + j]; te += m[i + j] * m[i + j]; } fft(re, im); for (let k = 1; k < 1024; k++) { const p = re[k] * re[k] + im[k] * im[k]; tf += ((k * SR) / 2048) * p; tp += p; } }
    const tail = +(db(te / (1.6 * SR)) - db(top)).toFixed(1), tailBright = Math.round(tf / Math.max(1e-20, tp));
    return { peak: +peak.toFixed(3), clip, loud: +loud.toFixed(1), low: +(db(lo) - db(all)).toFixed(1), bright: Math.round(fs / Math.max(1e-20, ps)), decay, tail, tailBright, map: flat };
  };
  const wav = (L, R) => {
    const n = L.length, ab = new ArrayBuffer(44 + n * 4), v = new DataView(ab);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
    v.setUint32(24, SR, true); v.setUint32(28, SR * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) { v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
    const u8 = new Uint8Array(ab); let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  };
  // every set-up to fire: each rifle with each muzzle option that fits, then the loads that change the sound
  const combos = [];
  CB.GUNS.forEach((g) => {
    CB.PARTS.filter((p) => p.slot === 'muzzle' && CB.partFits(p, g)).forEach((p) => combos.push({ gun: g.id, cfg: { muzzle: p.id }, name: g.id + '__' + p.id }));
    const sub = CB.PARTS.find((p) => p.id === 'am_sub');
    if (CB.partFits(sub, g)) { combos.push({ gun: g.id, cfg: { ammo: 'am_sub' }, name: g.id + '__mz_none__am_sub', extra: 1 }); if (g.supp === true) combos.push({ gun: g.id, cfg: { muzzle: 'mz_supl', ammo: 'am_sub' }, name: g.id + '__mz_supl__am_sub', extra: 1 }); }
    ['am_22hv', 'am_300sup', 'am_300red'].forEach((a) => { if (CB.partFits(CB.PARTS.find((p) => p.id === a), g)) combos.push({ gun: g.id, cfg: { ammo: a }, name: g.id + '__mz_none__' + a, extra: 1 }); });
  });
  const scene = (amb) => ({ ambience: amb || 'wild', refZ: 300, groundMat: 'dirt', objects: [] });
  // render: fire the set-up into an offline context through the game's sound system. what = 'report'
  // (the shot alone, measured) or 'shot' (the report and its action, for listening); take = which take
  async function render(c, what, take, amb) {
    const secs = 6.5, ac = new OfflineAudioContext(2, Math.ceil((secs + LEAD) * SR), SR), keep = Math.random;
    Math.random = seeded(4321);
    try {
      X.build(ac);
      const st = CB.buildStats(c.gun, Object.assign(CB.defaultConfig(c.gun), c.cfg)), sim = { st, S: scene(amb) };
      const G = X.gunFor({}, sim);
      ac.suspend(LEAD).then(() => { if (what === 'shot') X.shot({ k: 'fire' }, sim); else X.play(X.rep(G, take || 0)); ac.resume(); });
      const buf = await ac.startRendering(), a0 = Math.round(LEAD * SR);
      const L = buf.getChannelData(0).subarray(a0), R = buf.getChannelData(1).subarray(a0);
      return { L, R, raw: X.cache.get(G.key + ':' + (take || 0)), spec: G.spec };
    } finally { Math.random = keep; }
  }
  window.GT = {
    combos: combos.map((c) => c.name),
    async measure(i, wantWav) {
      const c = combos[i], r = await render(c, 'report', 0), m = analyze(r.L, r.R);
      let rawPk = 0; if (r.raw) for (let ch = 0; ch < 2; ch++) { const d = r.raw.getChannelData(ch); for (let k = 0; k < d.length; k++) rawPk = Math.max(rawPk, Math.abs(d[k])); }
      const out = Object.assign({ name: c.name, gun: c.gun, cal: r.spec.cal, dev: r.spec.dev, extra: !!c.extra, sup: r.spec.sup, h: r.spec.h, rawPk: +rawPk.toFixed(3) }, m);
      if (wantWav) { const s = await render(c, 'shot', 0); out.wav = wav(s.L, s.R); }
      return out;
    },
    // a second take of the same set-up: how different two takes of one shot are, the yardstick for "nearly the same"
    async take2(i) { const r = await render(combos[i], 'report', 1); return analyze(r.L, r.R).map; },
    async place(i, amb) { const r = await render(combos[i], 'report', 0, amb); const m = analyze(r.L, r.R); const s = await render(combos[i], 'shot', 0, amb); return { decay: m.decay, tail: m.tail, tailBright: m.tailBright, loud: m.loud, wav: wav(s.L, s.R) }; },
  };
}

(async () => {
  execSync('node build.js', { cwd: ROOT, stdio: 'ignore' });
  fs.mkdirSync(OUT, { recursive: true });
  fs.readdirSync(OUT).forEach((f) => { if (f.endsWith('.wav')) fs.unlinkSync(path.join(OUT, f)); });
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await page.goto('file://' + path.join(ROOT, 'index.html') + '?test');
  await page.waitForTimeout(300);
  await page.evaluate(() => { if (CB.UI && CB.UI.attractStop) CB.UI.attractStop(); });
  await page.evaluate(pageLib);
  const names = await page.evaluate(() => GT.combos);
  const R = [];
  for (let i = 0; i < names.length; i++) {
    const r = await page.evaluate((i) => GT.measure(i, true), i);
    fs.writeFileSync(path.join(OUT, r.name + '.wav'), Buffer.from(r.wav, 'base64')); delete r.wav;
    R.push(r);
  }
  // the yardstick: two takes of the same shot, for a few rifles
  const ctrl = [];
  for (const nm of ['fenwick__mz_none', 'anvil__mz_none', 'lark__mz_supl', 'ratter__mz_none', 'stormglass__mz_none']) {
    const i = names.indexOf(nm); if (i < 0) continue;
    const m2 = await page.evaluate((i) => GT.take2(i), i);
    ctrl.push([nm, m2, R[i].map]);
  }
  // the same rifle in every kind of place
  const places = {};
  for (const amb of ['city', 'harbour', 'wild', 'snow']) {
    const p = await page.evaluate(({ i, amb }) => GT.place(i, amb), { i: names.indexOf('fenwick__mz_none'), amb });
    fs.writeFileSync(path.join(OUT, 'place_' + amb + '_fenwick.wav'), Buffer.from(p.wav, 'base64')); delete p.wav; places[amb] = p;
  }
  await browser.close();

  // ---- comparisons ----
  // The average difference in dB between two maps, each cell weighted by how loud it is to the ear
  // (its level with the usual "A" hearing curve applied, so the deep end, which ears and phones hear
  // least, counts less; a cell 20 dB under the loudest counts a tenth as much), since the loud part is
  // what you hear. The hearing curve only changes how much a cell counts, not its difference.
  const AW = []; for (let i = 0; i < 24; i++) { const f = 45 * Math.pow(16000 / 45, (i + 0.5) / 24), f2 = f * f, ra = (148693636 * f2 * f2) / ((f2 + 424.36) * Math.sqrt((f2 + 11599.29) * (f2 + 544496.41)) * (f2 + 148693636)); AW.push(20 * Math.log10(ra) + 2.0); }
  const diff = (a, b) => { let top = -200; for (let k = 0; k < a.length; k++) top = Math.max(top, Math.max(a[k], b[k]) + AW[k % 24]); let s = 0, w = 0; for (let k = 0; k < a.length; k++) { const wk = Math.pow(10, (Math.max(a[k], b[k]) + AW[k % 24] - top) / 20); s += wk * Math.abs(a[k] - b[k]); w += wk; } return w ? s / w : 0; };
  const sim = (d) => Math.max(0, Math.round(100 * (1 - d / 12)));
  const ctrlD = ctrl.map(([nm, a, b]) => [nm, diff(a, b)]);
  const yard = Math.max(...ctrlD.map((c) => c[1]));
  // Every set-up is compared on its first take (the same random seed for all), so the difference is
  // only what the rifle and its parts change. Two set-ups are "nearly the same" when their maps are
  // under 2 dB apart on average, unless something is clearly different on its own: an average over
  // the whole map waters down a difference that sits in a few pitches (a compensator's +8 dB at
  // 3 kHz), so between 1.5 and 2 dB a pair still counts as different if its loudness differs by
  // 1.5 dB or more, its brightness by 15% or more, or its low end by 1.5 dB or more. Under 1.5 dB
  // it is always nearly the same.
  const MIN = 2.0, HARD = 1.5;
  const byName = {}; R.forEach((r) => { byName[r.name] = r; });
  const apart = (a, b) => { const x = byName[a], y = byName[b]; return Math.abs(x.loud - y.loud) >= 1.5 || Math.abs(x.bright / y.bright - 1) >= 0.15 || Math.abs(x.low - y.low) >= 1.5; };
  const why = (a, b) => { const x = byName[a], y = byName[b]; return 'loud ' + Math.abs(x.loud - y.loud).toFixed(1) + ' dB, bright ' + Math.round(100 * Math.abs(x.bright / y.bright - 1)) + '%, low ' + Math.abs(x.low - y.low).toFixed(1) + ' dB'; };
  const pairs = [];
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) pairs.push([R[i].name, R[j].name, diff(R[i].map, R[j].map)]);
  pairs.sort((a, b) => a[2] - b[2]);

  // ---- the table ----
  const pad = (s, w) => String(s).padEnd(w), lp = (s, w) => String(s).padStart(w);
  const loudest = Math.max(...R.map((r) => r.loud));
  const nearest = {}; pairs.forEach(([a, b, d]) => { if (!(a in nearest) || d < nearest[a][1]) nearest[a] = [b, d]; if (!(b in nearest) || d < nearest[b][1]) nearest[b] = [a, d]; });
  console.log(pad('rifle and muzzle (load)', 34) + pad('device', 9) + lp('loud', 6) + lp('vs top', 7) + lp('peak', 6) + lp('low', 6) + lp('bright', 7) + lp('decay', 6) + '   closest other set-up (diff dB, sim)');
  for (const r of R) { const nb = nearest[r.name]; console.log(pad(r.name, 34) + pad(r.dev, 9) + lp(r.loud, 6) + lp((r.loud - loudest).toFixed(1), 7) + lp(r.peak, 6) + lp(r.low, 6) + lp(r.bright, 7) + lp(r.decay, 6) + '   ' + nb[0] + ' (' + nb[1].toFixed(1) + ', ' + sim(nb[1]) + ')'); }
  console.log('(loud: dBFS, loudest 50 ms, ear-weighted; vs top: against the loudest rifle; low: dB of the energy below 150 Hz;');
  console.log(' bright: Hz, first 0.3 s; decay: ms to 40 dB down; diff: average dB apart on a pitch-and-time map; sim: 100 = identical)');
  console.log('for scale: two takes of one shot (another seed, every layer nudged a few per cent) differ by ' + ctrlD.map(([n, d]) => n + ' ' + d.toFixed(2)).join(', ') + ' dB');
  console.log('"nearly the same" = under ' + MIN.toFixed(1) + ' dB apart, compared on the same take');
  console.log('closest pairs: ' + pairs.slice(0, 8).map(([a, b, d]) => a + ' / ' + b + ' ' + d.toFixed(2) + ' dB (sim ' + sim(d) + ')').join('; '));


  // ---- the promises ----
  const fails = [], check = (ok, what) => { console.log((ok ? 'ok    ' : 'FAIL  ') + what); if (!ok) fails.push(what); };
  const grey = pairs.filter((p) => p[2] < MIN && p[2] >= HARD && apart(p[0], p[1]));
  const close = pairs.filter((p) => p[2] < HARD || (p[2] < MIN && !apart(p[0], p[1])));
  if (grey.length) console.log('under ' + MIN + ' dB on the map but clearly different on their own: ' + grey.map((p) => p[0] + ' / ' + p[1] + ' ' + p[2].toFixed(2) + ' (' + why(p[0], p[1]) + ')').join('; '));
  check(!close.length, 'no two set-ups sound nearly the same: closest ' + pairs[0][0] + ' / ' + pairs[0][1] + ' ' + pairs[0][2].toFixed(2) + ' dB apart (two takes of one shot: up to ' + yard.toFixed(2) + ' dB)' + (close.length ? '; too close: ' + close.slice(0, 6).map((p) => p[0] + '/' + p[1] + ' ' + p[2].toFixed(2) + ' (' + why(p[0], p[1]) + ')').join(', ') : ''));
  const quiet = R.filter((r) => r.loud < loudest - FLOOR);
  check(!quiet.length, 'no shot is quiet: quietest ' + R.slice().sort((a, b) => a.loud - b.loud)[0].name + ' at ' + (Math.min(...R.map((r) => r.loud)) - loudest).toFixed(1) + ' dB against the loudest (floor -' + FLOOR + ')' + (quiet.length ? ': ' + quiet.map((r) => r.name).join(', ') : ''));
  check(R.every((r) => r.peak < 1 && !r.clip && r.rawPk <= 0.98), 'nothing clips: worst peak ' + Math.max(...R.map((r) => r.peak)) + ' through the game, ' + Math.max(...R.map((r) => r.rawPk)) + ' as made');
  // heavier calibres measure heavier: bare muzzle, full-power load, by weight class
  const tiers = [['5.56', ['c556']], ['6.5 to 8 mm', ['c65', 'c308', 'c762r', 'c8mm']], ['magnum', ['c300m', 'c338']], ['.408', ['c408']], ['.50', ['c50']]];
  const bare = R.filter((r) => !r.extra && (r.dev === 'none' || r.dev === 'fbrake') && r.cal !== 'crail');
  const tm = tiers.map(([nm, cals]) => { const rs = bare.filter((r) => cals.indexOf(r.cal) >= 0); return [nm, rs.reduce((s, r) => s + r.low, 0) / rs.length, rs.reduce((s, r) => s + r.decay, 0) / rs.length]; });
  check(tm.every((t, i) => i === 0 || (t[1] > tm[i - 1][1] && t[2] > tm[i - 1][2])), 'heavier calibres measure heavier (low end dB, decay ms): ' + tm.map((t) => t[0] + ' ' + t[1].toFixed(1) + ' / ' + Math.round(t[2])).join(', '));
  const fifty = bare.find((r) => r.cal === 'c50');
  check(bare.every((r) => r === fifty || (r.low < fifty.low && r.decay < fifty.decay)), 'the .50 has more low end and a longer decay than every other bare rifle');
  // suppressors take loudness off; brakes add it (to the shooter)
  const byGun = {}; R.forEach((r) => { (byGun[r.gun] = byGun[r.gun] || []).push(r); });
  const badSupp = [], badBrake = [];
  for (const g in byGun) {
    const b = byGun[g].find((r) => r.name === g + '__mz_none'); if (!b || b.dev !== 'none') continue;
    byGun[g].forEach((r) => { if (!r.extra && ['supl', 'suph', 'olcan'].indexOf(r.dev) >= 0 && r.loud > b.loud - 2) badSupp.push(r.name); if (!r.extra && ['brake', 'rad'].indexOf(r.dev) >= 0 && r.loud < b.loud) badBrake.push(r.name); });
  }
  check(!badSupp.length, 'every suppressor is at least 2 dB quieter than the same rifle bare' + (badSupp.length ? ': not ' + badSupp.join(', ') : ''));
  check(!badBrake.length, 'every brake is louder than the same rifle bare' + (badBrake.length ? ': not ' + badBrake.join(', ') : ''));
  const pk = Object.keys(places), plOk = pk.every((a, i) => pk.every((b, j) => j <= i || Math.abs(places[a].tail - places[b].tail) >= 1 || Math.abs(places[a].tailBright / places[b].tailBright - 1) >= 0.1));
  check(plOk, 'every place has its own tail (level against the shot, dB / brightness, Hz): ' + pk.map((k) => k + ' ' + places[k].tail + ' / ' + places[k].tailBright).join(', '));
  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 5).join(' | ') : ''));
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({ shots: R.map((r) => { const o = Object.assign({}, r); delete o.map; o.closest = nearest[r.name]; return o; }), yardstick: ctrlD, minDiff: MIN, closestPairs: pairs.slice(0, 40), places }, null, 1));
  console.log(R.length + ' set-ups, ' + pairs.length + ' pairs. WAV files in ' + path.relative(ROOT, OUT) + '/');
  if (fails.length) { console.log(fails.length + ' FAILED'); process.exitCode = 1; }
})();
