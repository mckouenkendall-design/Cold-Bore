// The sound test. A script cannot tell whether something sounds good, but it can measure it.
// Every sound is rendered through the game's own sound code into an offline audio context in
// headless Chromium (no speaker involved), then measured:
//   peak    the loudest sample (1.0 is full scale: anything at or over it would clip)
//   len     how long it lasts, until it falls 40 dB under its loudest moment (ms)
//   bright  a rough brightness number: the spectral centroid, the "average pitch" of all its
//           energy (Hz). Higher means brighter and sharper, lower means duller and deeper.
// It checks a few promises, then saves WAV files in shots/sfx/ so a person can listen.
// usage: NODE_PATH=/opt/npm-tools/node_modules node test/sfx.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'shots', 'sfx');

// ---- runs inside the page ----------------------------------------------------------------
function pageLib() {
  const X = CB.Sfx;
  // the same random numbers every run, so the numbers below do not wobble
  const seeded = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  // the suppressed shot exactly as it was before this change, for comparison
  const oldSupp = (e) => {
    const c = X.CAL[e.cal] || X.CAL.c308, p = c.p;
    X.click(0, 4200, 0.12);
    X.noise({ type: 'bandpass', f: 1300 * p, q: 0.8, dur: 0.075, gain: 0.3 + c.boom * 0.08 });
    X.noise({ type: 'lowpass', f: 420, dur: 0.11, gain: 0.26 });
    X.tone({ f: 170 * p, f1: 70, dur: 0.07, gain: 0.22 });
    [2150, 3350, 5200].forEach((f, i) => X.tone({ at: 0.012 + i * 0.003, f: f * p, dur: 0.03, gain: 0.05 }));
    if (!e.sub) X.noise({ at: 0.07, type: 'highpass', f: 2600, dur: 0.09, gain: 0.07, verb: 0.9 });
    const cyc = e.cycle;
    if (e.action === 'bolt') {
      X.click(cyc * 0.2, 2600, 0.14); X.slide(cyc * 0.3, 2200, 800, cyc * 0.14, 0.14); X.click(cyc * 0.45, 1900, 0.18);
      X.brass(cyc * 0.5); X.slide(cyc * 0.58, 800, 2300, cyc * 0.14, 0.14); X.click(cyc * 0.76, 1500, 0.2);
    } else if (e.action === 'semi') { X.click(0.035, 2300, 0.16); X.click(0.075, 1700, 0.13); X.brass(0.09); }
  };
  // the old kill confirm (before this change): the far smack plus a tiny tone when lethal
  const oldHit = (e, at) => { X.impact('flesh', e.dist, at); if (e.lethal) X.tone({ at: 0.02, f: 1900, dur: 0.05, gain: 0.05 }); };

  // a radix-2 FFT, in place
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
  const analyze = (buf, win) => {
    const [L, R, sr] = trim(buf), n = L.length;
    let peak = 0, sum = 0;
    for (let i = 0; i < n; i++) { const a = Math.abs(L[i]), b = Math.abs(R[i]); if (a > peak) peak = a; if (b > peak) peak = b; sum += L[i] * L[i] + R[i] * R[i]; }
    // 5 ms loudness steps
    const w = Math.round(sr * 0.005), env = [];
    for (let i = 0; i + w <= n; i += w) { let s = 0; for (let j = i; j < i + w; j++) s += (L[j] * L[j] + R[j] * R[j]) / 2; env.push(Math.sqrt(s / w)); }
    const em = Math.max(...env), thr = em * Math.pow(10, -40 / 20), thr30 = em * Math.pow(10, -30 / 20);
    let first = env.findIndex((v) => v >= thr), last = env.length - 1; while (last > 0 && env[last] < thr) last--;
    const active = env.filter((v) => v >= thr30).length * 5;
    let loud = 0; for (let i = 0; i + 10 <= env.length; i++) { let s = 0; for (let j = i; j < i + 10; j++) s += env[j] * env[j]; loud = Math.max(loud, Math.sqrt(s / 10)); }
    // brightness: the centroid of all the energy, frame by frame
    const N = 2048, hop = 1024, re = new Float32Array(N), im = new Float32Array(N), pow = new Float64Array(N / 2);
    for (let i = 0; i + N <= n; i += hop) {
      for (let j = 0; j < N; j++) { const hw = 0.5 - 0.5 * Math.cos((2 * Math.PI * j) / (N - 1)); re[j] = ((L[i + j] + R[i + j]) / 2) * hw; im[j] = 0; }
      fft(re, im);
      for (let k = 1; k < N / 2; k++) pow[k] += re[k] * re[k] + im[k] * im[k];
    }
    let fs = 0, ps = 0; for (let k = 1; k < N / 2; k++) { const f = (k * sr) / N; fs += f * pow[k]; ps += pow[k]; }
    const out = { peak: +peak.toFixed(3), peakDb: +db(peak).toFixed(1), len: first < 0 ? 0 : (last - first + 1) * 5, active, bright: Math.round(fs / Math.max(1e-20, ps)), rmsDb: +db(Math.sqrt(sum / (2 * n))).toFixed(1), loudDb: +db(loud).toFixed(1) };
    if (win) { // loudness (dBFS) inside a window, e.g. after 'end' to prove everything stopped
      const a = Math.floor(win[0] * sr), b = Math.min(n, Math.floor(win[1] * sr)); let s = 0, pk = 0;
      for (let i = a; i < b; i++) { s += (L[i] * L[i] + R[i] * R[i]) / 2; pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); }
      out.winRmsDb = +db(Math.sqrt(s / Math.max(1, b - a))).toFixed(1); out.winPeakDb = +db(pk).toFixed(1);
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

  // the kill camera beats, with what a real film sends
  const kco = (rate, extra, gore) => Object.assign({ rate, part: 'torso', cal: 'c308', power: 0.8, gore: gore !== false, quiet: false, sub: false }, extra || {});
  const seq = (gore, rateOf) => [
    [0, () => X.kc('fly', kco(rateOf(0.12), null, gore))],
    [2.2, () => X.kc('near', kco(rateOf(0.2), null, gore))],
    [2.75, () => X.kc('enter', kco(rateOf(0.1), null, gore))],
    [2.85, () => X.kc('bone', kco(rateOf(0.1), { bone: 'rib' }, gore))],
    [2.98, () => X.kc('bone', kco(rateOf(0.1), { bone: 'spine' }, gore))],
    [3.3, () => X.kc('exit', kco(rateOf(0.12), { size: 0.8 }, gore))],
    [4.4, () => X.kc('fall', kco(rateOf(0.2), { mat: 'dirt' }, gore))],
    [5.6, () => X.kc('end', kco(rateOf(0.3), null, gore))],
  ];
  const beatsOnly = (rate) => [
    [0.1, () => X.kc('cover', kco(rate, { mat: 'wood' }))],
    [0.6, () => X.kc('enter', kco(rate))],
    [0.7, () => X.kc('bone', kco(rate, { bone: 'rib' }))],
    [0.8, () => X.kc('bone', kco(rate, { bone: 'spine' }))],
    [1.1, () => X.kc('exit', kco(rate, { size: 0.8 }))],
    [2.0, () => X.kc('fall', kco(rate, { mat: 'dirt' }))],
  ]; // (no 'end' here: its snap back would be counted in the length)
  const shot = (o) => Object.assign({ k: 'fire', quiet: true, sub: false, cal: 'c308', action: 'none', cycle: 1.45 }, o);

  // every sound to render: [seconds, list of [time, call]]
  const S = {
    supp_old_c308_report: [0.8, [[0, () => oldSupp(shot({}))]]],
    supp_light_c308_report: [0.8, [[0, () => X.shot(shot({ can: 'light' }))]]],
    supp_heavy_c308_report: [0.8, [[0, () => X.shot(shot({ can: 'heavy' }))]]],
    supp_int_c300s_report: [0.8, [[0, () => X.shot(shot({ can: 'int', cal: 'c300s', sub: true }))]]],
    supp_heavy_c308_sub_report: [0.8, [[0, () => X.shot(shot({ can: 'heavy', sub: true }))]]],
    shot_loud_c308_report: [0.8, [[0, () => X.shot(shot({ quiet: false }))]]],
    supp_old_c308_bolt: [2.4, [[0, () => oldSupp(shot({ action: 'bolt' }))]]],
    supp_light_c308_bolt: [2.4, [[0, () => X.shot(shot({ can: 'light', action: 'bolt' }))]]],
    supp_heavy_c308_bolt: [2.4, [[0, () => X.shot(shot({ can: 'heavy', action: 'bolt' }))]]],
    supp_heavy_c308_subsonic_bolt: [2.4, [[0, () => X.shot(shot({ can: 'heavy', sub: true, action: 'bolt' }))]]],
    supp_light_c556_semi_lark: [1.2, [[0, () => X.shot(shot({ can: 'light', cal: 'c556', action: 'semi', cycle: 0.26 }))]]],
    supp_int_c300s_whisper: [2.2, [[0, () => X.shot(shot({ can: 'int', cal: 'c300s', sub: true, action: 'bolt', cycle: 1.25 }))]]],
    supp_int_c9s_hush: [1.2, [[0, () => X.shot(shot({ can: 'int', cal: 'c9s', sub: true, action: 'semi', cycle: 0.3 }))]]],
    supp_int_c22_ratter: [1.2, [[0, () => X.shot(shot({ can: 'int', cal: 'c22', sub: true, action: 'semi', cycle: 0.32 }))]]],
    shot_loud_c308_reference: [2.4, [[0, () => X.shot(shot({ quiet: false, action: 'bolt' }))]]],
    confirm_head_kill: [0.6, [[0.05, () => X.confirm({ part: 'head', lethal: true })]]],
    confirm_body_kill: [0.6, [[0.05, () => X.confirm({ part: 'torso', lethal: true })]]],
    confirm_wound: [0.6, [[0.05, () => X.confirm({ part: 'legL', lethal: false })]]],
    hit_old_head_300m: [1.6, [[0.05, () => oldHit({ part: 'head', lethal: true, dist: 300 }, 300 / 343)]]],
    hit_head_kill_300m: [1.6, [[0.05, () => X.hit({ part: 'head', lethal: true, dist: 300 }, 300 / 343, true)]]],
    hit_body_kill_300m: [1.6, [[0.05, () => X.hit({ part: 'torso', lethal: true, dist: 300 }, 300 / 343, true)]]],
    hit_wound_300m: [1.6, [[0.05, () => X.hit({ part: 'legL', lethal: false, dist: 300 }, 300 / 343, true)]]],
    killcam_gore: [6.4, seq(true, (r) => r)],
    killcam_nogore: [6.4, seq(false, (r) => r)],
    killcam_head_glass: [6.4, [
      [0, () => X.kc('fly', kco(0.12, { cal: 'c338', part: 'head' }))], [2.2, () => X.kc('near', kco(0.2, { part: 'head' }))],
      [2.45, () => X.kc('cover', kco(0.15, { mat: 'glass', part: 'head' }))], [2.8, () => X.kc('enter', kco(0.1, { part: 'head' }))],
      [2.86, () => X.kc('bone', kco(0.1, { bone: 'skull', part: 'head' }))], [3.1, () => X.kc('exit', kco(0.12, { size: 1, part: 'head' }))],
      [4.3, () => X.kc('fall', kco(0.2, { mat: 'hard', part: 'head' }))], [5.6, () => X.kc('end', kco(0.3))]]],
    killcam_seq_rate01: [6.4, seq(true, () => 0.1)],
    killcam_seq_rate1: [6.4, seq(true, () => 1)],
    killcam_beats_rate01: [7.6, beatsOnly(0.1)],
    killcam_beats_rate1: [7.6, beatsOnly(1)],
    // the bed and heartbeat on their own, to see how far under the impacts they sit
    killcam_bed_only: [3.0, [[0, () => X.kc('fly', kco(0.1))]]],
    // skipped early: everything has to stop when 'end' comes, even the tear, the heartbeat and the bed
    killcam_skip: [3.2, [[0, () => X.kc('fly', kco(0.12))], [0.5, () => X.kc('near', kco(0.2))], [0.9, () => X.kc('enter', kco(0.1))], [1.0, () => X.kc('end', kco(0.3))]]],
    // six beats in the same instant: must not pile up or clip
    killcam_pileup: [3.0, [[0.2, () => { ['enter', 'bone', 'bone', 'bone', 'exit', 'cover'].forEach((s, i) => X.kc(s, kco(0.1, { bone: ['skull', 'rib', 'spine'][i % 3], mat: 'metal', size: 1 }))); }], [2.8, () => X.kc('end', kco(1))]]],
    killcam_one_enter: [3.0, [[0.2, () => X.kc('enter', kco(0.1))], [2.8, () => X.kc('end', kco(1))]]],
    // the worst case: the loudest rifle, a kill confirm and a pile of kill camera beats all at once
    stack: [2.0, [[0.05, () => { X.shot(shot({ quiet: false, cal: 'c50', action: 'bolt', cycle: 1.9 })); X.confirm({ part: 'head', lethal: true }); X.boom(80, 0); ['enter', 'bone', 'exit', 'fall'].forEach((s) => X.kc(s, kco(0.1, { bone: 'skull', size: 1, mat: 'metal', power: 1 }))); }], [1.9, () => X.kc('end', kco(1))]]],
  };
  const WIN = { killcam_skip: [1.25, 3.2], killcam_gore: [2.7, 4.3], killcam_nogore: [2.7, 4.3], killcam_bed_only: [1.5, 3.0] };

  window.SFXT = {
    names: Object.keys(S),
    async render(name, raw, keepWav) {
      const [secs, calls] = S[name], sr = 48000;
      const ac = new OfflineAudioContext(2, Math.ceil((secs + LEAD) * sr), sr);
      const keep = Math.random; Math.random = seeded(1234 + name.length * 77);
      try {
        X.build(ac, { raw });
        const byT = new Map();
        calls.forEach(([t, fn]) => { const q = Math.round((t + LEAD) * sr / 128) * 128 / sr; if (!byT.has(q)) byT.set(q, []); byT.get(q).push(fn); });
        for (const [t, fns] of byT) ac.suspend(t).then(() => { fns.forEach((f) => f()); ac.resume(); });
        const buf = await ac.startRendering();
        const m = analyze(buf, WIN[name]);
        if (keepWav) m.wav = wav(buf);
        return m;
      } finally { Math.random = keep; }
    },
  };
}

(async () => {
  execSync('node build.js', { cwd: ROOT, stdio: 'ignore' });
  fs.mkdirSync(OUT, { recursive: true });
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
    raw[n] = await page.evaluate((n) => SFXT.render(n, true, false), n); // without the limiter and safety clipper
  }

  // ---- the numbers ----
  const pad = (s, w) => String(s).padEnd(w);
  console.log(pad('sound', 32) + pad('peak', 8) + pad('peak dB', 9) + pad('no-lim', 8) + pad('len ms', 8) + pad('bright Hz', 10) + pad('loud dB', 9) + 'rms dB');
  for (const n of names) { const r = R[n]; console.log(pad(n, 32) + pad(r.peak, 8) + pad(r.peakDb, 9) + pad(raw[n].peak, 8) + pad(r.len, 8) + pad(r.bright, 10) + pad(r.loudDb, 9) + r.rmsDb); }
  console.log('(no-lim = the peak with the limiter and safety clipper taken out, to show what they catch;');
  console.log(' loud = the loudest 50 ms, a rough stand-in for how loud it feels)');

  // ---- the promises ----
  const fails = [], check = (ok, what) => { console.log((ok ? 'ok    ' : 'FAIL  ') + what); if (!ok) fails.push(what); };
  check(names.every((n) => R[n].peak < 1), 'nothing clips: every peak is under full scale (worst ' + Math.max(...names.map((n) => R[n].peak)) + ')');
  const o = R.supp_old_c308_report, l = R.supp_light_c308_report, h = R.supp_heavy_c308_report;
  check(l.len < o.len && h.len < o.len, `suppressed shot is shorter: old ${o.len} ms, Featherweight ${l.len} ms, Monolith ${h.len} ms`);
  check(l.bright > o.bright && h.bright > o.bright, `suppressed shot is brighter: old ${o.bright} Hz, Featherweight ${l.bright} Hz, Monolith ${h.bright} Hz`);
  const lr = R.shot_loud_c308_report;
  check(l.loudDb < lr.loudDb - 6, `suppressed is clearly quieter than no suppressor: ${l.loudDb} vs ${lr.loudDb} dB (loudest 50 ms)`);
  check(h.loudDb < l.loudDb, `Monolith is quieter than Featherweight: ${h.loudDb} vs ${l.loudDb} dB (loudest 50 ms)`);
  const wr = R.supp_int_c300s_report, sr = R.supp_heavy_c308_sub_report;
  check(wr.loudDb < l.loudDb - 6, `subsonic Whisper is much quieter than a supersonic can: ${wr.loudDb} vs ${l.loudDb} dB`);
  check(sr.loudDb < h.loudDb - 6, `subsonic ammo in a Monolith is much quieter than supersonic: ${sr.loudDb} vs ${h.loudDb} dB`);
  const ch = R.confirm_head_kill, cb = R.confirm_body_kill, cw = R.confirm_wound;
  check(ch.bright > cb.bright, `head confirm is brighter than body confirm: ${ch.bright} vs ${cb.bright} Hz`);
  check(cw.rmsDb < cb.rmsDb - 4 && cw.len < cb.len, `a wound sounds different from a kill: ${cw.rmsDb} dB, ${cw.len} ms vs body kill ${cb.rmsDb} dB, ${cb.len} ms`);
  const b01 = R.killcam_beats_rate01, b1 = R.killcam_beats_rate1;
  check(b01.bright < b1.bright && b01.len > b1.len, `kill camera beats at rate 0.1 are lower and longer than at rate 1: ${b01.bright} vs ${b1.bright} Hz, ${b01.len} vs ${b1.len} ms`);
  const s01 = R.killcam_seq_rate01, s1 = R.killcam_seq_rate1;
  check(s01.bright < s1.bright && s01.active > s1.active, `whole kill camera film at rate 0.1 is lower and fuller than at rate 1: ${s01.bright} vs ${s1.bright} Hz, ${s01.active} vs ${s1.active} ms above -30 dB`);
  check(R.killcam_skip.winRmsDb < -60, `after a skip everything stops: ${R.killcam_skip.winRmsDb} dB RMS (peak ${R.killcam_skip.winPeakDb} dB) from 0.25 s after 'end'`);
  check(R.killcam_pileup.peak < 1 && raw.killcam_pileup.peak < raw.killcam_one_enter.peak * 2.2, `six beats at once do not pile up: peak ${raw.killcam_pileup.peak} vs ${raw.killcam_one_enter.peak} for one beat (before the limiter)`);
  check(R.killcam_gore.winRmsDb > R.killcam_nogore.winRmsDb, `gore off drops the wet layers: ${R.killcam_nogore.winRmsDb} vs ${R.killcam_gore.winRmsDb} dB RMS from entry to exit`);
  check(R.killcam_bed_only.winRmsDb < R.killcam_gore.loudDb - 12, `the bed sits well under the impacts: bed ${R.killcam_bed_only.winRmsDb} dB RMS, loudest impact ${R.killcam_gore.loudDb} dB`);

  // ---- the real thing: a live audio context on a real page, every call, nothing may throw ----
  const live = await page.evaluate(async () => {
    const X = CB.Sfx, wait = (ms) => new Promise((r) => setTimeout(r, ms));
    X.ac = null; X.ok = false; X.unlock();
    if (!X.ok) return 'no live audio context';
    ['light', 'heavy', 'int'].forEach((can) => { X.shot({ quiet: true, sub: false, cal: 'c308', action: 'bolt', cycle: 1.4, can }); X.shot({ quiet: true, sub: true, cal: 'c9s', action: 'semi', cycle: 0.3, can }); });
    X.hit({ part: 'head', lethal: true, dist: 200 }, 0.5, true); X.hit({ part: 'armR', lethal: false, dist: 200 }, 0.5, false); X.vest(200, 0.5);
    X.kc('end', {}); X.kc('bone', { rate: 0.1 }); X.kc('end', {}); X.kc('end', {});
    const base = { rate: 0.1, part: 'torso', cal: 'c308', power: 0.5, gore: true };
    for (const s of ['fly', 'near', 'cover', 'enter', 'bone', 'exit', 'fall']) { X.kc(s, Object.assign({}, base, { mat: s === 'cover' ? 'nonsense' : undefined, bone: 'unknown' })); await wait(20); }
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
