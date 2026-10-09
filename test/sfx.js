// The sound test (everything but the rifles' reports, which test/sfx_guns.js covers). A script
// cannot tell whether something sounds good, but it can measure it. Every sound is rendered through
// the game's own sound code into an offline audio context in headless Chromium (no speaker
// involved), then measured:
//   peak    the loudest sample (1.0 is full scale: anything at or over it would clip)
//   len     how long it lasts, until it falls 40 dB under its loudest moment (ms)
//   bright  the spectral centroid, the "average pitch" of all its energy (Hz): higher is brighter
//   loud    how loud it feels: the loudest 50 ms, weighted the way the ear weights loudness (dBFS)
//   low     how much of its energy is below 150 Hz (dB of the whole)
// It checks a set of promises, then saves WAV files in shots/sfx/ so a person can listen.
// usage: NODE_PATH=/opt/npm-tools/node_modules node test/sfx.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'shots', 'sfx');

// ---- runs inside the page ----------------------------------------------------------------
function pageLib() {
  const X = CB.Sfx, SG = X.gen;
  // the same random numbers every run, so the numbers below do not wobble
  const seeded = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const fft = (re, im) => {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let len = 2; len <= n; len <<= 1) {
      const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a);
      for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr; re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } }
    }
  };
  const db = (v) => (v > 0 ? 20 * Math.log10(v) : -200);
  // Chrome's compressors start every new audio context clamped hard and take a few hundred
  // milliseconds to let go (in the game the context has been running for ages, so this never
  // shows). So every render starts with LEAD seconds of silence, and that part is cut off here.
  const LEAD = 0.5;
  const trim = (buf) => { const a = Math.round(LEAD * buf.sampleRate); return [buf.getChannelData(0).subarray(a), buf.getChannelData(1).subarray(a), buf.sampleRate]; };
  const spectrum = (L, R, sr, i0, i1) => { // centroid and share below 150 Hz between two sample indices
    let fs = 0, ps = 0, lo = 0; const N = 2048, re = new Float32Array(N), im = new Float32Array(N);
    for (let i = i0; i + N <= i1; i += N / 2) { for (let j = 0; j < N; j++) { re[j] = ((L[i + j] + R[i + j]) / 2) * (0.5 - 0.5 * Math.cos((2 * Math.PI * j) / (N - 1))); im[j] = 0; } fft(re, im); for (let k = 1; k < N / 2; k++) { const p = re[k] * re[k] + im[k] * im[k], f = (k * sr) / N; fs += f * p; ps += p; if (f < 150) lo += p; } }
    return { bright: Math.round(fs / Math.max(1e-20, ps)), low: +(10 * Math.log10((lo + 1e-20) / Math.max(1e-20, ps))).toFixed(1) };
  };
  const analyze = (buf, win) => {
    const [L, R, sr] = trim(buf), n = L.length;
    let peak = 0, sum = 0;
    for (let i = 0; i < n; i++) { const a = Math.abs(L[i]), b = Math.abs(R[i]); if (a > peak) peak = a; if (b > peak) peak = b; sum += L[i] * L[i] + R[i] * R[i]; }
    const w = Math.round(sr * 0.005), env = [];
    for (let i = 0; i + w <= n; i += w) { let s = 0; for (let j = i; j < i + w; j++) s += (L[j] * L[j] + R[j] * R[j]) / 2; env.push(Math.sqrt(s / w)); }
    const em = Math.max(...env), thr = em * Math.pow(10, -40 / 20), thr30 = em * Math.pow(10, -30 / 20);
    let first = env.findIndex((v) => v >= thr), last = env.length - 1; while (last > 0 && env[last] < thr) last--;
    const active = env.filter((v) => v >= thr30).length * 5;
    const sp = spectrum(L, R, sr, 0, n);
    const out = { peak: +peak.toFixed(3), peakDb: +db(peak).toFixed(1), len: first < 0 ? 0 : (last - first + 1) * 5, active, bright: sp.bright, low: sp.low, rmsDb: +db(Math.sqrt(sum / (2 * n))).toFixed(1), loudDb: +SG.loud(L, R, sr).toFixed(1) };
    if (win) { // inside a window: loudness (dBFS), brightness, e.g. after 'end' to prove everything stopped
      const a = Math.floor(win[0] * sr), b = Math.min(n, Math.floor(win[1] * sr)); let s = 0, pk = 0;
      for (let i = a; i < b; i++) { s += (L[i] * L[i] + R[i] * R[i]) / 2; pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); }
      out.winRmsDb = +db(Math.sqrt(s / Math.max(1, b - a))).toFixed(1); out.winPeakDb = +db(pk).toFixed(1); out.winBright = spectrum(L, R, sr, a, b).bright;
    }
    return out;
  };
  const wav = (buf) => {
    const [L, R, sr] = trim(buf), n = L.length;
    const ab = new ArrayBuffer(44 + n * 4), v = new DataView(ab);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) { v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
    const u8 = new Uint8Array(ab); let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  };

  // A kill camera film as the real one sends it (src/21_killcam.js): the true rate is 0.05 at the
  // rifle and from the swing through the X-ray, about 0.2 to 1 in the flight, and climbs from 0.06
  // toward 0.55 in the hold. Times are those of a real 155 m chest shot (test/cine2.js BEATS=1).
  const kco = (rate, extra, gore) => Object.assign({ rate, part: 'torso', cal: 'c308', power: 0.8, gore: gore !== false, quiet: false, sub: false }, extra || {});
  const film = (gore, rateOf, head) => {
    const P = head ? 'head' : 'torso', g = gore !== false, sp = (v) => (g ? v : 0);
    const L = [[0.08, 'fly', 0.05], [3.62, 'slow', 0.05, { len: 4.45 }], [4.17, 'near', 0.05], [4.67, 'enter', 0.05, { spray: sp(0.54) }]];
    if (head) L.push([4.9, 'bone', 0.05, { bone: 'skull' }]); else L.push([5.3, 'bone', 0.05, { bone: 'limb' }], [5.63, 'bone', 0.05, { bone: 'rib' }]);
    if (g) L.push([5.75, 'organ', 0.05, { organ: head ? 'brain' : 'lungL', key: !!head }]); if (g && !head) L.push([6.0, 'organ', 0.05, { organ: 'heart', key: true }]);
    L.push([6.25, 'bone', 0.05, { bone: head ? 'skull' : 'spine' }], [7.27, 'exit', 0.05, { size: head ? 1 : 0.6, spray: sp(head ? 0.9 : 0.4) }], [8.63, 'resume', 0.05], [9.8, 'fall', 0.55, { mat: 'dirt' }], [10.68, 'end', 0.55]);
    return [12.2, L.map(([t, s, r, ex]) => [t, () => X.kc(s, kco(rateOf(r), Object.assign({ part: P }, ex || {}), g))])
      .concat([[0, () => X.shot({ k: 'fire', cal: 'c308', quiet: false, action: 'bolt', cycle: 1.45 })]])
      .concat(Array.from({ length: 60 }, (_, i) => [i * 0.18, () => X.kcTick(rateOf(i * 0.18 < 1.2 || (i * 0.18 > 2.4 && i * 0.18 < 8.6) ? 0.05 : i * 0.18 < 2.4 ? 0.6 : 0.4))]))];
  };
  const beatsOnly = (rate) => [
    [0.1, () => X.kc('cover', kco(rate, { mat: 'wood' }))],
    [0.6, () => X.kc('enter', kco(rate))],
    [0.7, () => X.kc('bone', kco(rate, { bone: 'rib' }))],
    [0.8, () => X.kc('bone', kco(rate, { bone: 'spine' }))],
    [1.1, () => X.kc('exit', kco(rate, { size: 0.8 }))],
    [2.0, () => X.kc('fall', kco(rate, { mat: 'dirt' }))],
  ]; // (no 'end' here: its snap back would be counted in the length)
  const one = (secs, fn, at) => [secs, [[at || 0.02, fn]]];
  // every sound to render: [seconds, list of [time, call]]
  const S = {
    // hits on people: the confirm alone (heard at once) and the whole hit at 300 m
    confirm_head_kill: one(0.8, () => X.confirm({ part: 'head', lethal: true })),
    confirm_body_kill: one(0.8, () => X.confirm({ part: 'torso', lethal: true })),
    confirm_wound: one(0.8, () => X.confirm({ part: 'legL', lethal: false })),
    confirm_vest: one(1.2, () => X.vest(300, 300 / 343)),
    hit_head_kill_300m: one(1.8, () => X.hit({ part: 'head', lethal: true, dist: 300 }, 300 / 343, true)),
    hit_body_kill_300m: one(1.8, () => X.hit({ part: 'torso', lethal: true, dist: 300 }, 300 / 343, true)),
    hit_body_kill_300m_nogore: one(1.8, () => X.hit({ part: 'torso', lethal: true, dist: 300 }, 300 / 343, false)),
    hit_wound_300m: one(1.8, () => X.hit({ part: 'legL', lethal: false, dist: 300 }, 300 / 343, true)),
    // misses, each material at 150 m
    miss_dirt: one(1.6, () => X.impact('dirt', 150, 0.05)), miss_metal: one(1.6, () => X.impact('metal', 150, 0.05)), miss_hard: one(1.6, () => X.impact('hard', 150, 0.05)),
    miss_glass: one(1.6, () => X.impact('glass', 150, 0.05)), miss_wood: one(1.6, () => X.impact('wood', 150, 0.05)), miss_water: one(1.6, () => X.impact('water', 150, 0.05)), miss_snow: one(1.6, () => X.impact('snow', 150, 0.05)),
    // a fuel tank going up, near and far; thunder, close (twice, to hear two storms) and far
    explosion_80m: one(7, () => X.boom(80, 0.02)), explosion_400m: one(7, () => X.boom(400, 0.02)),
    thunder_close: one(8, () => X.thunder(0.02)), thunder_close_2: one(8, () => { X.thunN = 1; X.later = () => {}; X.thunder(0.02); }),
    thunder_far: one(9, () => X.thunder(0.02, true)),
    // the rifle's reference shot, for scale
    shot_c308_bare: one(3, () => X.shot({ k: 'fire', cal: 'c308', quiet: false, action: 'bolt', cycle: 1.45 })),
    // handling
    reload_bolt: one(3.6, () => X.reload(3.2, 'bolt')), reload_semi: one(3, () => X.reload(2.6, 'semi')), reload_single: one(2.6, () => X.reload(2.1, 'single')), reload_charge: one(5, () => X.reload(4.5, 'charge')),
    dry_fire: one(0.5, () => X.dry()), charge: one(1.2, () => X.onEvent({ k: 'charge', dur: 0.85 }, { S: { refZ: 200 } })),
    // the world
    alarm_siren: one(7, () => X.siren(0.02)), bell_steel: one(3.5, () => X.bell(300, 0.02, 560)), crash_car: one(2.6, () => X.onEvent({ k: 'crash' }, { S: { refZ: 150 } })),
    spark: one(1, () => X.onEvent({ k: 'spark' }, { S: { refZ: 150 } })), tyre: one(1.4, () => X.onEvent({ k: 'tyre' }, { S: { refZ: 150 } })), npc_shot: one(3, () => X.onEvent({ k: 'npcshot' }, { S: { refZ: 250 } })),
    // the interface
    ui_tap: one(0.4, () => X.ui('tap')), ui_back: one(0.4, () => X.ui('back')), ui_go: one(0.6, () => X.ui('go')), ui_deny: one(0.6, () => X.ui('deny')), ui_buy: one(0.6, () => X.ui('buy')),
    ui_equip: one(0.6, () => X.ui('equip')), ui_star: one(1.4, () => X.ui('star')), ui_tick: one(0.3, () => X.ui('tick')),
    // the kill camera
    killcam_gore: film(true, (r) => r),
    killcam_nogore: film(false, (r) => r),
    killcam_head_gore: film(true, (r) => r, true),
    killcam_film_rate1: film(true, () => 1),
    killcam_beats_slow: [3.6, beatsOnly(0.05)],
    killcam_beats_rate1: [3.6, beatsOnly(1)],
    // the bed and heartbeat on their own, to see how far under the impacts they sit
    killcam_bed_only: [3.0, [[0, () => X.kc('fly', kco(0.05))], [0.4, () => X.kc('slow', kco(0.05, { len: 4 }))]]],
    // skipped early: everything has to stop when 'end' comes, even the tear, the heartbeat and the bed
    killcam_skip: [3.2, [[0, () => X.kc('fly', kco(0.05))], [0.5, () => X.kc('near', kco(0.2))], [0.9, () => X.kc('enter', kco(0.05))], [1.0, () => X.kc('end', kco(0.25))]]],
    // six beats in the same instant: must not pile up or clip
    killcam_pileup: [3.0, [[0.2, () => { ['enter', 'bone', 'bone', 'bone', 'exit', 'cover'].forEach((s, i) => X.kc(s, kco(0.05, { bone: ['skull', 'rib', 'spine'][i % 3], mat: 'metal', size: 1 }))); }], [2.8, () => X.kc('end', kco(1))]]],
    killcam_one_enter: [3.0, [[0.2, () => X.kc('enter', kco(0.05))], [2.8, () => X.kc('end', kco(1))]]],
    // the worst case: the loudest rifle, a kill confirm, an explosion and a pile of kill camera beats all at once
    stack: [2.0, [[0.05, () => { X.shot({ k: 'fire', cal: 'c50', quiet: false, action: 'bolt', cycle: 1.9 }); X.confirm({ part: 'head', lethal: true }); X.boom(80, 0); ['enter', 'bone', 'exit', 'fall'].forEach((s) => X.kc(s, kco(0.05, { bone: 'skull', size: 1, mat: 'metal', power: 1 }))); }], [1.9, () => X.kc('end', kco(1))]]],
  };
  const WIN = { hit_body_kill_300m: [0.86, 1.6], hit_body_kill_300m_nogore: [0.86, 1.6], killcam_skip: [1.25, 3.2], killcam_gore: [4.6, 7.3], killcam_nogore: [4.6, 7.3], killcam_bed_only: [1.2, 3.0], thunder_close: [1.2, 6], thunder_far: [1, 7], thunder_close_2: [1.2, 6], explosion_80m: [0.3, 2.5] };
  const WIN0 = { thunder_close: [0, 0.3], thunder_far: [0, 0.6], thunder_close_2: [0, 0.3] }; // (a second window: the very start)

  window.SFXT = {
    names: Object.keys(S),
    async render(name, raw, keepWav, second) {
      const [secs, calls] = S[name], sr = 48000;
      const ac = new OfflineAudioContext(2, Math.ceil((secs + LEAD) * sr), sr);
      const keep = Math.random, keepLater = X.later; Math.random = seeded(1234 + name.length * 77);
      try {
        X.build(ac, { raw }); X.thunN = 0;
        const byT = new Map();
        calls.forEach(([t, fn]) => { const q = Math.round((t + LEAD) * sr / 128) * 128 / sr; if (!byT.has(q)) byT.set(q, []); byT.get(q).push(fn); });
        for (const [t, fns] of byT) ac.suspend(t).then(() => { fns.forEach((f) => f()); ac.resume(); });
        const buf = await ac.startRendering();
        const m = analyze(buf, second ? WIN0[name] : WIN[name]);
        if (keepWav) m.wav = wav(buf);
        return m;
      } finally { Math.random = keep; X.later = keepLater; }
    },
  };
}

(async () => {
  execSync('node build.js', { cwd: ROOT, stdio: 'ignore' });
  fs.mkdirSync(OUT, { recursive: true });
  fs.readdirSync(OUT).forEach((f) => { if (f.endsWith('.wav') && f.indexOf('killcam_film_') !== 0) fs.unlinkSync(path.join(OUT, f)); });
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await page.goto('file://' + path.join(ROOT, 'index.html') + '?test');
  await page.waitForTimeout(300);
  await page.evaluate(() => { if (CB.UI && CB.UI.attractStop) CB.UI.attractStop(); });
  await page.evaluate(pageLib);
  const names = await page.evaluate(() => SFXT.names);
  const R = {}, raw = {};
  for (const n of names) {
    const r = await page.evaluate((n) => SFXT.render(n, false, true), n);
    fs.writeFileSync(path.join(OUT, n + '.wav'), Buffer.from(r.wav, 'base64')); delete r.wav;
    R[n] = r;
    if (/^killcam_(pileup|one_enter)$|^stack$/.test(n)) raw[n] = await page.evaluate((n) => SFXT.render(n, true, false), n); // without the limiter and safety clipper
    if (/^thunder/.test(n)) R[n].start = await page.evaluate((n) => SFXT.render(n, false, false, true), n);
  }

  // ---- the numbers ----
  const pad = (s, w) => String(s).padEnd(w);
  console.log(pad('sound', 28) + pad('peak', 8) + pad('peak dB', 9) + pad('len ms', 8) + pad('bright Hz', 10) + pad('loud dB', 9) + pad('low dB', 8) + 'rms dB');
  for (const n of names) { const r = R[n]; console.log(pad(n, 28) + pad(r.peak, 8) + pad(r.peakDb, 9) + pad(r.len, 8) + pad(r.bright, 10) + pad(r.loudDb, 9) + pad(r.low, 8) + r.rmsDb); }
  console.log('(loud = the loudest 50 ms, ear-weighted, a stand-in for how loud it feels; low = share of energy under 150 Hz)');

  // ---- the promises ----
  const fails = [], check = (ok, what) => { console.log((ok ? 'ok    ' : 'FAIL  ') + what); if (!ok) fails.push(what); };
  check(names.every((n) => R[n].peak < 1), 'nothing clips: every peak is under full scale (worst ' + Math.max(...names.map((n) => R[n].peak)) + ')');
  const shot = R.shot_c308_bare, ch = R.confirm_head_kill, cb = R.confirm_body_kill, cw = R.confirm_wound, cv = R.confirm_vest;
  check(ch.loudDb > shot.loudDb - 6 && cb.loudDb > shot.loudDb - 6, `a kill confirm hits nearly as hard as the shot itself: head ${ch.loudDb}, body ${cb.loudDb} vs a bare .308 ${shot.loudDb} dB`);
  check(ch.bright > cb.bright * 1.3, `head confirm is brighter than body confirm (crack and skull): ${ch.bright} vs ${cb.bright} Hz`);
  check(cb.low > ch.low, `body confirm is heavier than head confirm: ${cb.low} vs ${ch.low} dB under 150 Hz`);
  check(cw.loudDb < cb.loudDb - 4 && cw.len < cb.len, `a wound is weaker and shorter than a kill: ${cw.loudDb} dB, ${cw.len} ms vs body kill ${cb.loudDb} dB, ${cb.len} ms`);
  check(cv.bright > cb.bright * 2 && cv.len > cb.len, `armour rings like steel (bright and long): ${cv.bright} Hz, ${cv.len} ms vs body kill ${cb.bright} Hz, ${cb.len} ms`);
  { const g = R.hit_body_kill_300m, d = R.hit_body_kill_300m_nogore; check(Math.abs(g.winBright / d.winBright - 1) >= 0.1 || g.len > d.len + 100, `gore on makes the impact (as it arrives from 300 m) wet: a squelch and drops, ${g.winBright} vs ${d.winBright} Hz, ${g.len} vs ${d.len} ms`); }
  const mats = ['dirt', 'metal', 'hard', 'glass', 'wood', 'water', 'snow'].map((m) => [m, R['miss_' + m]]), same = [];
  mats.forEach(([a, x], i) => mats.forEach(([b, y], j) => { if (j > i && Math.abs(x.bright / y.bright - 1) < 0.12 && Math.abs(x.len / y.len - 1) < 0.15) same.push(a + '/' + b); }));
  check(!same.length, 'every miss material sounds its own (brightness or length): ' + mats.map(([m, r]) => m + ' ' + r.bright + ' Hz ' + r.len + ' ms').join(', ') + (same.length ? '; too alike: ' + same.join(', ') : ''));
  check(R.miss_metal.len > R.miss_dirt.len && R.miss_glass.len > R.miss_dirt.len, `metal rings and glass tinkles on after dirt has stopped: ${R.miss_metal.len}, ${R.miss_glass.len} vs ${R.miss_dirt.len} ms`);
  const ex = R.explosion_80m, ex4 = R.explosion_400m;
  check(ex.len > 3000 && ex.loudDb >= shot.loudDb - 1 && ex.low > shot.low, `an explosion is big: ${ex.len} ms long, ${ex.loudDb} dB (a bare .308 ${shot.loudDb}), ${ex.low} dB of it under 150 Hz (the .308 ${shot.low})`);
  check(ex.winRmsDb > ex.rmsDb - 6, `it rolls on with debris and echoes: ${ex.winRmsDb} dB RMS from 0.3 to 2.5 s (whole: ${ex.rmsDb})`);
  check(ex4.loudDb < ex.loudDb && ex4.bright < ex.bright, `further off it is quieter and duller: ${ex4.loudDb} dB, ${ex4.bright} Hz vs ${ex.loudDb} dB, ${ex.bright} Hz`);
  const tc = R.thunder_close, tf = R.thunder_far, tc2 = R.thunder_close_2;
  check(tc.start.winBright > 1500 && tc.winBright < 500 && tc.len > 4000, `close lightning is a tearing crack then a deep roll: start ${tc.start.winBright} Hz, roll ${tc.winBright} Hz, ${tc.len} ms`);
  check(tf.start.winBright < 600 && tf.len > 5000 && tf.loudDb < tc.loudDb - 4, `far thunder is only a deep rumble: start ${tf.start.winBright} Hz, ${tf.len} ms, ${tf.loudDb} vs close ${tc.loudDb} dB`);
  check(Math.abs(tc2.len - tc.len) > 200 || Math.abs(tc2.bright - tc.bright) > 30, `no two storms roll the same: ${tc.len} ms ${tc.bright} Hz vs ${tc2.len} ms ${tc2.bright} Hz`);
  check(['reload_bolt', 'reload_semi', 'reload_single', 'reload_charge'].every((n) => R[n].loudDb > -30 && R[n].active > 150), 'reloads are clearly heard: ' + ['reload_bolt', 'reload_semi', 'reload_single', 'reload_charge'].map((n) => n.slice(7) + ' ' + R[n].loudDb + ' dB').join(', '));
  check(R.alarm_siren.len > 5000 && R.alarm_siren.loudDb > -26, `the alarm wails for its whole length and is loud: ${R.alarm_siren.len} ms, ${R.alarm_siren.loudDb} dB`);
  check(['tap', 'back', 'go', 'deny', 'buy', 'equip', 'tick'].every((k) => R['ui_' + k].len < 600 && R['ui_' + k].loudDb > -30), 'interface sounds are short and crisp: ' + ['tap', 'back', 'go', 'deny', 'buy', 'equip', 'tick'].map((k) => k + ' ' + R['ui_' + k].len + ' ms').join(', '));
  const b01 = R.killcam_beats_slow, b1 = R.killcam_beats_rate1;
  check(b01.bright < b1.bright && b01.len > b1.len, `kill camera beats in the slow motion are lower and longer than at real time: ${b01.bright} vs ${b1.bright} Hz, ${b01.len} vs ${b1.len} ms`);
  const s05 = R.killcam_gore, s1 = R.killcam_film_rate1;
  check(s05.active > s1.active, `the slowed film is fuller than one at real time: ${s05.active} vs ${s1.active} ms above -30 dB`);
  check(R.killcam_skip.winRmsDb < -60, `after a skip everything stops: ${R.killcam_skip.winRmsDb} dB RMS (peak ${R.killcam_skip.winPeakDb} dB) from 0.25 s after 'end'`);
  check(R.killcam_pileup.peak < 1 && raw.killcam_pileup.peak < raw.killcam_one_enter.peak * 2.2, `six beats at once do not pile up: peak ${raw.killcam_pileup.peak} vs ${raw.killcam_one_enter.peak} for one beat (before the limiter)`);
  check(R.killcam_gore.winRmsDb > R.killcam_nogore.winRmsDb, `gore off drops the wet layers: ${R.killcam_nogore.winRmsDb} vs ${R.killcam_gore.winRmsDb} dB RMS from entry to exit`);
  check(R.killcam_bed_only.winRmsDb < R.killcam_gore.loudDb - 15, `the bed sits well under the impacts: bed ${R.killcam_bed_only.winRmsDb} dB RMS, loudest impact ${R.killcam_gore.loudDb} dB`);
  check(R.killcam_bed_only.winBright > 150, `the bed is deep but not mud: ${R.killcam_bed_only.winBright} Hz`);
  check(R.stack.peak < 1, `the worst pile-up (a .50, a confirm, an explosion, kill camera beats) still does not clip: ${R.stack.peak} (${raw.stack.peak} before the limiter)`);

  // ---- the real thing: a live audio context on a real page, every call, nothing may throw ----
  const live = await page.evaluate(async () => {
    const X = CB.Sfx, wait = (ms) => new Promise((r) => setTimeout(r, ms));
    X.ac = null; X.ok = false; X.unlock();
    if (!X.ok) return 'no live audio context';
    ['light', 'heavy', 'int'].forEach((can) => { X.shot({ quiet: true, sub: false, cal: 'c308', action: 'bolt', cycle: 1.4, can }); X.shot({ quiet: true, sub: true, cal: 'c9s', action: 'semi', cycle: 0.3, can }); });
    X.suppressed({ cal: 'c556', action: 'semi', cycle: 0.26 }, 'light'); X.brass(0.1); X.reload(2.5, 'bolt');
    X.hit({ part: 'head', lethal: true, dist: 200 }, 0.5, true); X.hit({ part: 'armR', lethal: false, dist: 200 }, 0.5, false); X.vest(200, 0.5);
    ['dirt', 'metal', 'nonsense', 'interior'].forEach((m) => X.impact(m, 200, 0.1)); X.boom(100, 0.1); X.thunder(0.1); X.thunder(0.1, true);
    X.kc('end', {}); X.kc('bone', { rate: 0.05 }); X.kc('end', {}); X.kc('end', {});
    const base = { rate: 0.05, part: 'torso', cal: 'c308', power: 0.5, gore: true };
    for (const s of ['fly', 'near', 'slow', 'cover', 'enter', 'bone', 'organ', 'exit', 'resume', 'fall']) { X.kc(s, Object.assign({}, base, { mat: s === 'cover' ? 'nonsense' : undefined, bone: 'unknown', organ: 'nonsense', len: 'x', spray: 'y' })); X.kcTick(0.05); await wait(20); }
    X.kc('fly', base); X.kc('fly', base); X.kc('end', base);
    X.kc('fly', null); X.kc(undefined, undefined); X.kc('end');
    await wait(200);
    return 'ok ' + X.ac.state;
  });
  check(live.startsWith('ok'), 'a live audio context runs every call without an error (' + live + ')');
  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 5).join(' | ') : ''));
  await browser.close();
  console.log('WAV files in ' + path.relative(ROOT, OUT) + '/');
  if (fails.length) { console.log(fails.length + ' FAILED'); process.exitCode = 1; }
})();
