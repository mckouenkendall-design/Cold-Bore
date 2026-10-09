// The kill camera's sound, from a real film. A shot is staged and fired through the real game
// loop (as test/cine2.js does, without the pictures), every sound beat the film sends and its speed
// every frame are written down, then the whole film is played again into an offline audio context
// on exactly that timeline, so what the player would hear is saved as a WAV and measured:
//   the level after each beat, and that the deep slow motion (from 'slow' to 'resume') never goes
//   quiet: the film's sound must hold all the way through it
//   that the slow motion is deep but not mud: its brightness and how much of it is very low
//   that nothing clips, and that everything stops once the film ends
//   that the hit (the entry) is loud: one of the loudest moments of the film, like a real shot
// usage: NODE_PATH=/opt/npm-tools/node_modules node test/sfx_film.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'shots', 'sfx');
const FILMS = [
  { tag: 'fenwick_torso_gore', m: 'c1m1', gun: 'fenwick', tid: 't', part: 'torso' },
  { tag: 'fenwick_torso_nogore', m: 'c1m1', gun: 'fenwick', tid: 't', part: 'torso', gore: false },
  { tag: 'anvil_head_gore', m: 'c1m1', gun: 'anvil', tid: 't', part: 'head' },
  { tag: 'halden_suppressed_torso', m: 'c1m1', gun: 'halden', tid: 't', part: 'torso', cfg: { muzzle: 'mz_suph' } },
];

(async () => {
  execSync('node build.js', { cwd: ROOT, stdio: 'ignore' });
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const fails = [], check = (ok, what) => { console.log((ok ? 'ok    ' : 'FAIL  ') + what); if (!ok) fails.push(what); };
  for (const F of FILMS) {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
    await page.goto('file://' + path.join(ROOT, 'index.html') + '?test');
    await page.waitForTimeout(500);
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
    await page.evaluate((F) => {
      CB.Save.data.settings.gore = F.gore !== false; CB.Save.data.settings.killcam = true;
      try { CB.Sfx.unlock(); } catch (e) { /* no sound */ }
      CB.UI.launch(F.m, { gun: F.gun, cfg: Object.assign(CB.defaultConfig(F.gun), F.cfg || {}), shotSeed: 1 });
    }, F);
    await page.waitForTimeout(800);
    // play to the moment, aim, fire, and write down every beat and the film's speed every frame
    const log = await page.evaluate((F) => {
      const G = CB.Game, KC = CB.KillCam, X = CB.Sfx;
      let ts = G.last || performance.now(); const frame = () => { ts += 1000 / 60; G.loop(ts); };
      const s = G.sim; let guard = 0;
      while (G.sim === s && s.state === 'play' && guard++ < 6000 && s.t < 0.8) frame();
      s.rules.kill.forEach((id) => { if (id !== F.tid) { const a = s.byId[id]; if (a && !a.dead) { a.dead = true; a.hidden = true; a.state = 'dead'; a.deadT = 9; a.deathAtT = -9; if (G.oracle) { const b = G.oracle.s.byId[id]; if (b) { b.dead = true; b.hidden = true; b.state = 'dead'; b.deadT = 9; b.deathAtT = -9; } } } } });
      s.rules.destroy = []; s.rules.until = null; s.rules.done = null; s.rules.protect = []; s.rules.civFail = false;
      if (G.oracle) { const r = G.oracle.s.rules; r.destroy = []; r.until = null; r.done = null; r.protect = []; r.civFail = false; G.oracle.catchUp(1e6); }
      const t = s.byId[F.tid], p = s.partPoint(t, F.part), vx = t.goal !== null ? t.vx : 0, sol = s.aimFor(p.x, p.y, p.z, { vx });
      s.setZoom(s.st.zoomMax); s.sh.zoom = s.st.zoomMax;
      s.sh.ax = sol.ax - (s.sh.swx + s.sh.recx + s.sh.offx); s.sh.ay = sol.ay - (s.sh.swy + s.sh.recy + s.sh.offy);
      const beats = [], rates = []; let fireAt = null;
      const kc0 = X.kc; X.kc = function (st, o) { beats.push([KC.active ? KC.T : 0, st, Object.assign({}, o || {})]); return kc0.call(this, st, o); };
      const ev0 = X.onEvent; X.onEvent = function (e, sm) { if (e.k === 'fire' && fireAt === null) fireAt = KC.active ? KC.T : 0; return ev0.call(this, e, sm); };
      G.fire();
      let started = false;
      for (let i = 0; i < 1500; i++) { frame(); if (G.cine && KC.active) { started = true; if (i % 2 === 0) rates.push([KC.T, KC.rate]); } else if (started) break; }
      X.kc = kc0; X.onEvent = ev0;
      return { beats, rates, fireAt, st: { id: s.st.id }, started, scene: { ambience: s.S.ambience, refZ: s.S.refZ, groundMat: s.S.groundMat, weather: s.S.weather } };
    }, F);
    if (!log.started) { check(false, F.tag + ': the film ran'); await ctx.close(); continue; }
    // play it again into an offline context, on the same timeline
    const R = await page.evaluate(async ({ log, F }) => {
      const X = CB.Sfx, SR = 48000, LEAD = 0.5, end = log.beats.find((b) => b[1] === 'end'), len = (end ? end[0] : log.rates[log.rates.length - 1][0]) + 2.5;
      const ac = new OfflineAudioContext(2, Math.ceil((len + LEAD) * SR), SR);
      const seeded = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
      const keep = Math.random; Math.random = seeded(77);
      try {
        X.build(ac);
        const st = CB.buildStats(F.gun, Object.assign(CB.defaultConfig(F.gun), F.cfg || {})), sim = { st, S: Object.assign({ objects: [] }, log.scene) };
        X.simRef = sim; CB.KillCam.active = true;
        const at = new Map(), add = (t, fn) => { const q = Math.round((t + LEAD) * SR / 128) * 128 / SR; if (!at.has(q)) at.set(q, []); at.get(q).push(fn); };
        add(log.fireAt || 0, () => X.shot({ k: 'fire' }, sim));
        log.rates.forEach(([t, r]) => add(t, () => { X.lp.frequency.setTargetAtTime(r < 0.8 ? 1500 + 17000 * r * r : 19000, ac.currentTime, 0.08); X.kcTick(r); }));
        log.beats.forEach(([t, st2, o]) => add(t, () => { if (st2 === 'end') CB.KillCam.active = false; X.kc(st2, o); }));
        for (const [t, fns] of at) ac.suspend(t).then(() => { fns.forEach((f) => f()); ac.resume(); });
        const buf = await ac.startRendering(), a0 = Math.round(LEAD * SR);
        const L = buf.getChannelData(0).subarray(a0), Rr = buf.getChannelData(1).subarray(a0), n = L.length;
        const db = (v) => (v > 0 ? 10 * Math.log10(v) : -200);
        let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(Rr[i]));
        const rms = (t0, t1) => { const a = Math.max(0, Math.round(t0 * SR)), b = Math.min(n, Math.round(t1 * SR)); let s = 0; for (let i = a; i < b; i++) s += (L[i] * L[i] + Rr[i] * Rr[i]) / 2; return db(s / Math.max(1, b - a)); };
        const T = (name) => { const b = log.beats.find((x) => x[1] === name); return b ? b[0] : null; };
        const slow = T('slow'), resume = T('resume'), fin = T('end');
        let quietest = 0; if (slow !== null && resume !== null) { quietest = 200; for (let t = slow; t + 0.2 <= resume; t += 0.05) quietest = Math.min(quietest, rms(t, t + 0.2)); }
        // brightness and very-low share of the slow motion
        const spec = (t0, t1) => { const a = Math.round(t0 * SR), b = Math.round(t1 * SR); let fs = 0, ps = 0, lo = 0; for (let i = a; i + 4096 <= b; i += 2048) { const re = new Float64Array(4096), im = new Float64Array(4096); for (let j = 0; j < 4096; j++) re[j] = (L[i + j] + Rr[i + j]) * 0.5 * (0.5 - 0.5 * Math.cos(2 * Math.PI * j / 4095)); /* fft */ const N = 4096; for (let q = 1, w = 0; q < N; q++) { let bit = N >> 1; for (; w & bit; bit >>= 1) w ^= bit; w ^= bit; if (q < w) { let tt = re[q]; re[q] = re[w]; re[w] = tt; } } for (let ln = 2; ln <= N; ln <<= 1) { const ang = -2 * Math.PI / ln, wr = Math.cos(ang), wi = Math.sin(ang); for (let q = 0; q < N; q += ln) { let cr = 1, ci = 0; for (let k = 0; k < ln / 2; k++) { const ur = re[q + k], ui = im[q + k], vr = re[q + k + ln / 2] * cr - im[q + k + ln / 2] * ci, vi = re[q + k + ln / 2] * ci + im[q + k + ln / 2] * cr; re[q + k] = ur + vr; im[q + k] = ui + vi; re[q + k + ln / 2] = ur - vr; im[q + k + ln / 2] = ui - vi; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } } } for (let k = 1; k < N / 2; k++) { const p = re[k] * re[k] + im[k] * im[k], f = k * SR / N; fs += f * p; ps += p; if (f < 80) lo += p; } } return { bright: Math.round(fs / Math.max(1e-20, ps)), low: +(db(lo) - db(ps)).toFixed(1) }; };
        const sl = slow !== null && resume !== null ? spec(slow, resume) : { bright: 0, low: 0 };
        // each beat's level: the loudest 50 ms in the 0.4 s after it, weighted the way the ear hears loudness
        const kl = (t0, t1) => { const a = Math.max(0, Math.round(t0 * SR)), b = Math.min(n, Math.round(t1 * SR)); return CB.Sfx.gen.loud(L.slice(a, b), Rr.slice(a, b), SR); };
        const beatLv = log.beats.filter((b) => b[1] !== 'end').map(([t, st2]) => [+t.toFixed(2), st2, +kl(t, t + 0.4).toFixed(1)]);
        const after = fin !== null ? rms(fin + 0.35, Math.min(len, fin + 2)) : 0;
        // the WAV
        const ab = new ArrayBuffer(44 + n * 4), v = new DataView(ab), str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
        str(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, SR, true); v.setUint32(28, SR * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 4, true);
        for (let i = 0; i < n; i++) { v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, Rr[i])) * 32767, true); }
        const u8 = new Uint8Array(ab); let s64 = ''; for (let i = 0; i < u8.length; i += 0x8000) s64 += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        return { peak: +peak.toFixed(3), quietest: +quietest.toFixed(1), slowLen: resume !== null && slow !== null ? +(resume - slow).toFixed(2) : 0, sl, beatLv, after: +after.toFixed(1), loudest: Math.max(...beatLv.map((b) => b[2])), wav: btoa(s64) };
      } finally { Math.random = keep; CB.KillCam.active = false; }
    }, { log, F });
    fs.writeFileSync(path.join(OUT, 'killcam_film_' + F.tag + '.wav'), Buffer.from(R.wav, 'base64'));
    console.log(F.tag + ': beats [film s, beat, dB: loudest 50 ms in the next 0.4 s] ' + R.beatLv.map((b) => b.join(' ')).join(' | '));
    check(R.peak < 1, F.tag + ': nothing clips (peak ' + R.peak + ')');
    check(R.quietest > -38, F.tag + ': the deep slow motion holds for all ' + R.slowLen + ' s of it, never under -38 dBFS (quietest 0.2 s: ' + R.quietest + ' dBFS)');
    check(R.sl.bright > 180 && R.sl.low < -3, F.tag + ': the slow motion is deep but not mud: brightness ' + R.sl.bright + ' Hz, below 80 Hz ' + R.sl.low + ' dB of it');
    const ent = R.beatLv.find((b) => b[1] === 'enter');
    check(ent && ent[2] > -13 && ent[2] >= R.loudest - 4, F.tag + ': the hit is loud: entry ' + (ent ? ent[2] : '?') + ' dB, loudest beat ' + R.loudest + ' dB (loudest 50 ms, ear-weighted)');
    check(R.after < -55, F.tag + ': everything stops after the film (' + R.after + ' dBFS from 0.35 s after the end)');
    check(!errs.length, F.tag + ': no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }
  await browser.close();
  console.log('WAV files: ' + path.relative(ROOT, OUT) + '/killcam_film_*.wav');
  if (fails.length) { console.log(fails.length + ' FAILED'); process.exitCode = 1; }
})();
