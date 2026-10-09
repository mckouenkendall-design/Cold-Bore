// ---------------------------------------------------------------------------
// Sound. Everything is made in code: there are no audio files.
//
// A sound is made one of two ways:
//   - worked out ahead of time, sample by sample, by the generator (src/10b_sfxgen.js) into a
//     buffer, which is then simply played: every rifle's report and action (each rifle with each
//     muzzle device, suppressor and load sounds different), reloads, hits, impacts, explosions,
//     thunder, the alarm, the interface. The rifle a mission is played with is worked out as the
//     mission starts, the rest the first time it is needed (or ahead, when the mission will want it).
//   - built live from Web Audio nodes when it has to follow the game while it plays: the kill
//     camera (it follows the film's speed), ambience and music, rain, breathing, the heartbeat.
//
// How it is wired, from the sources to the speaker:
//   sfx (everything in the world, the player's rifle included) ------------------------> master
//   music, ambience -> glue (a gentle compressor) -> bgDuck (dips under each shot) -----> master
//   master (the kill camera turns it down) -> lp (the slow motion muffle) -> limiter
//   near (the kill confirm, the kill camera, the interface: never muffled) -> limiter
//   limiter -> safety clipper -> speaker
// The generator brings every sound it makes to a set loudness and rounds off its peaks, so
// nothing leaves it clipped. The limiter holds stacked moments under full scale and the safety
// clipper rounds off anything that still gets through.
// ---------------------------------------------------------------------------
const Sfx = CB.Sfx = { ac: null, ok: false, tension: 0, mode: 'off', amb: null, nextBeat: 0, beat: 0, events: [], ducked: false, heartT: 0, kcS: null, snapUntil: 0, cache: new Map(), jobs: [], guns: [], gunNow: null, loc: null };

// The kill camera's slowed muzzle blast, when it has no rifle report to slow down:
// crack = high snap, boom = low punch, bf = thump pitch (Hz), len = body length (s), tail = echo, p = pitch
const CAL_SND = {
  c22: { crack: 0.45, boom: 0.22, bf: 400, len: 0.09, tail: 0.25, p: 1.6 },
  c556: { crack: 0.95, boom: 0.5, bf: 300, len: 0.13, tail: 0.5, p: 1.3 },
  c308: { crack: 1.0, boom: 0.85, bf: 205, len: 0.2, tail: 0.75, p: 1.0 },
  c762r: { crack: 1.0, boom: 0.9, bf: 185, len: 0.22, tail: 0.8, p: 0.95 },
  c8mm: { crack: 0.85, boom: 1.0, bf: 165, len: 0.27, tail: 0.9, p: 0.86 },
  c65: { crack: 1.05, boom: 0.72, bf: 235, len: 0.18, tail: 0.7, p: 1.1 },
  c300m: { crack: 1.1, boom: 1.1, bf: 155, len: 0.28, tail: 1.0, p: 0.9 },
  c338: { crack: 1.1, boom: 1.25, bf: 135, len: 0.33, tail: 1.15, p: 0.8 },
  c408: { crack: 1.15, boom: 1.3, bf: 125, len: 0.35, tail: 1.2, p: 0.76 },
  c50: { crack: 1.2, boom: 1.65, bf: 92, len: 0.48, tail: 1.5, p: 0.6 },
  c300s: { crack: 0.3, boom: 0.3, bf: 210, len: 0.1, tail: 0.2, p: 0.9 },
  c9s: { crack: 0.3, boom: 0.3, bf: 250, len: 0.09, tail: 0.2, p: 1.1 },
  crail: { crack: 1.3, boom: 0.9, bf: 120, len: 0.25, tail: 1.3, p: 1.2 },
};
Sfx.CAL = CAL_SND;

Sfx.unlock = function () {
  const X = Sfx;
  if (X.ac) { if (X.ac.state === 'suspended') X.ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try { X.build(new AC()); } catch (e) { X.ok = false; }
  if (X.ok && X.pendingMode) { const m = X.pendingMode; X.pendingMode = null; X.setMode(m.mode, m.amb); }
  if (X.ok && X.pendingSim) { const s = X.pendingSim; X.pendingSim = null; X.prepare(s); }
};
// Build the whole sound system on an audio context. The game passes its live one; the sound
// tests pass an offline one so they can record the sounds to files.
// opt.raw leaves out the limiter and the safety clipper, so a test can see what they catch.
Sfx.build = function (ac, opt) {
  const X = Sfx; opt = opt || {};
  X.ac = ac; X.ok = false; X.kcS = null; X.snapUntil = 0; X.beds = []; X.cache = new Map(); X.jobs = []; X.guns = []; X.gunNow = null;
  SG.sr = ac.sampleRate;
  // the limiter: a fast, hard compressor just under full scale
  X.lim = ac.createDynamicsCompressor(); X.lim.threshold.value = -2.5; X.lim.knee.value = 0; X.lim.ratio.value = 20; X.lim.attack.value = 0.001; X.lim.release.value = 0.12;
  // the safety clipper: straight through up to 0.8, then rounds off smoothly so nothing passes 0.99.
  // A wave shaper only reads inputs between -1 and 1, so the signal is scaled down by 4 going in
  // and the curve is drawn for four times the range.
  X.clipIn = ac.createGain(); X.clipIn.gain.value = 0.25;
  X.clip = ac.createWaveShaper();
  const n = 4097, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = ((i / (n - 1)) * 2 - 1) * 4, a = Math.abs(x); curve[i] = Math.sign(x) * (a <= 0.8 ? a : 0.8 + 0.19 * Math.tanh((a - 0.8) / 0.19)); }
  X.clip.curve = curve;
  X.out = opt.raw ? ac.destination : X.lim;
  if (!opt.raw) { X.lim.connect(X.clipIn); X.clipIn.connect(X.clip); X.clip.connect(ac.destination); }
  X.lp = ac.createBiquadFilter(); X.lp.type = 'lowpass'; X.lp.frequency.value = 19000;
  X.master = ac.createGain(); X.master.gain.value = 0.9;
  X.master.connect(X.lp); X.lp.connect(X.out);
  X.sfx = ac.createGain(); X.sfx.connect(X.master);
  // music and ambience are glued together and dip under each shot, so the shot hits harder
  X.mus = ac.createGain(); X.ambG = ac.createGain();
  X.glue = ac.createDynamicsCompressor(); X.glue.threshold.value = -20; X.glue.knee.value = 10; X.glue.ratio.value = 3; X.glue.attack.value = 0.01; X.glue.release.value = 0.25;
  X.bgDuck = ac.createGain();
  X.mus.connect(X.glue); X.ambG.connect(X.glue); X.glue.connect(X.bgDuck); X.bgDuck.connect(X.master);
  X.comp = X.glue;
  // the near bus: sounds that happen "to you" (the kill confirm, the kill camera) skip the muffle
  X.near = ac.createGain(); X.near.connect(X.out);
  // noise sources, a different stream in each ear so anything made from them is wide
  const mk = (secs, brown) => { const b = ac.createBuffer(2, Math.floor(ac.sampleRate * secs), ac.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; } } return b; };
  X.white = mk(2, false); X.brown = mk(3, true);
  // a slow, uneven wobble between 0.15 and 1, held in little steps: it roughens the tearing sound in the kill camera
  { const sr = ac.sampleRate, b = ac.createBuffer(1, Math.floor(sr * 2), sr), d = b.getChannelData(0); let v = 0.5, goal = 1, left = 0;
    for (let i = 0; i < d.length; i++) { if (left-- <= 0) { goal = 0.15 + Math.random() * 0.85; left = Math.floor(sr * (0.018 + Math.random() * 0.05)); } v += (goal - v) * 0.004; d[i] = v; }
    X.rough = b; }
  // echo spaces for live sounds: a city bounces sound back in slaps, open country rolls
  const ir = (secs, slaps, dark) => { const b = ac.createBuffer(2, Math.floor(ac.sampleRate * secs), ac.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < d.length; i++) { const t = i / d.length; let v = (Math.random() * 2 - 1) * Math.pow(1 - t, dark ? 2.4 : 3.4); lp += (v - lp) * (dark ? 0.12 + 0.3 * (1 - t) : 0.5); d[i] = lp; } for (let s = 0; s < slaps; s++) { const at = Math.floor((0.05 + Math.random() * 0.4) * ac.sampleRate), len = Math.floor(0.03 * ac.sampleRate), g = 0.9 - s * 0.12; for (let i = 0; i < len && at + i < d.length; i++) d[at + i] += (Math.random() * 2 - 1) * g * (1 - i / len); } } return b; };
  X.verbCity = ac.createConvolver(); X.verbCity.buffer = ir(1.7, 5, false);
  X.verbOpen = ac.createConvolver(); X.verbOpen.buffer = ir(3.4, 1, true);
  X.verbG = ac.createGain(); X.verbG.gain.value = 0.5; X.verbCity.connect(X.verbG); X.verbOpen.connect(X.verbG); X.verbG.connect(X.sfx);
  X.verb = X.verbCity;
  // the kill camera's own space: big and dark, so slowed impacts bloom
  X.kcVerb = ac.createConvolver(); X.kcVerb.buffer = ir(2.6, 0, true);
  X.kcVerbG = ac.createGain(); X.kcVerbG.gain.value = 0.5; X.kcVerb.connect(X.kcVerbG); X.kcVerbG.connect(X.near);
  X.ok = true; X.setVolumes(true);
};
Sfx.setVolumes = function (now) {
  const X = Sfx; if (!X.ok) return;
  const s = Save.data.settings, k = X.ducked ? 0.35 : 1, t = X.ac.currentTime;
  const set = (p, v, tc) => { if (now) p.value = v; else p.setTargetAtTime(v, t, tc); };
  set(X.sfx.gain, s.sfx * k, 0.05); set(X.mus.gain, s.music * 0.8 * k, 0.1); set(X.ambG.gain, s.sfx * 0.75 * k, 0.1); set(X.near.gain, s.sfx * k, 0.05);
};
Sfx.duck = function (on) { Sfx.ducked = on; Sfx.setVolumes(); };
// Stop an automation where it is right now, so a new move starts from the current value.
Sfx.hold = function (p, t) { if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else { const v = p.value; p.cancelScheduledValues(t); p.setValueAtTime(v, t); } };

// ---- building blocks (live) --------------------------------------------------------
// A burst of filtered noise.
Sfx.noise = function (o) {
  const X = Sfx; if (!X.ok) return;
  const ac = X.ac, t = ac.currentTime + (o.at || 0), src = ac.createBufferSource();
  src.buffer = o.brown ? X.brown : X.white; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.f || 1000, t); if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + (o.sweep || o.dur));
  f.Q.value = o.q || 0.7;
  const g = ac.createGain(), pk = Math.max(0.0001, o.gain || 0.3);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pk, t + (o.att || 0.002)); g.gain.exponentialRampToValueAtTime(0.0001, t + (o.att || 0.002) + o.dur);
  src.connect(f); f.connect(g); g.connect(o.dest || X.sfx);
  if (o.verb) { const s = ac.createGain(); s.gain.value = o.verb; g.connect(s); s.connect(o.vbus || X.verb); }
  src.start(t, Math.random() * 1.5); src._end = t + (o.att || 0.002) + o.dur + 0.05; src.stop(src._end);
  return src;
};
// A pitched tone that can slide.
Sfx.tone = function (o) {
  const X = Sfx; if (!X.ok) return;
  const ac = X.ac, t = ac.currentTime + (o.at || 0), osc = ac.createOscillator();
  osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t); if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(10, o.f1), t + (o.sweep || o.dur));
  const g = ac.createGain(), pk = Math.max(0.0001, o.gain || 0.2);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pk, t + (o.att || 0.003)); g.gain.exponentialRampToValueAtTime(0.0001, t + (o.att || 0.003) + o.dur);
  let out = g;
  if (o.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); out = f; }
  osc.connect(g); out.connect(o.dest || X.sfx);
  if (o.verb) { const s = ac.createGain(); s.gain.value = o.verb; out.connect(s); s.connect(o.vbus || X.verb); }
  osc.start(t); osc._end = t + (o.att || 0.003) + o.dur + 0.05; osc.stop(osc._end);
  return osc;
};
Sfx.click = function (at, f, gain, dest) { Sfx.noise({ at, type: 'highpass', f: f || 3200, dur: 0.012, gain: gain || 0.2, dest }); Sfx.tone({ at, f: (f || 3200) * 0.7, dur: 0.025, gain: (gain || 0.2) * 0.5, type: 'square', lp: 6000, dest }); };
Sfx.slide = function (at, f0, f1, dur, gain) { Sfx.noise({ at, type: 'bandpass', f: f0, f1, q: 2.2, dur, att: 0.012, gain: gain || 0.16 }); };

// ---- buffers -------------------------------------------------------------------------
// A generator buffer as an AudioBuffer (getChannelData().set works on every Safari).
Sfx.toBuf = function (B) {
  const b = Sfx.ac.createBuffer(2, B.n, B.sr);
  b.getChannelData(0).set(B.L); b.getChannelData(1).set(B.R);
  if (B.at) b._at = B.at;
  return b;
};
// The buffer for a key, worked out now if it is not ready yet.
Sfx.get = function (key, make) {
  const X = Sfx; if (!X.ok) return null;
  let b = X.cache.get(key);
  if (b === undefined) { let B = null; try { B = make(); } catch (e) { if (window.console) console.error(e); } b = B ? X.toBuf(B) : null; X.cache.set(key, b); }
  return b;
};
// Work a buffer out a little later, a piece at a time between frames, so a mission's start does
// not stall: by the time the sound is wanted it is usually ready.
Sfx.later = function (key, make) {
  const X = Sfx; if (!X.ok || X.cache.has(key) || X.jobs.some((j) => j[0] === key)) return;
  X.jobs.push([key, make]);
  if (!X.jobT) X.jobT = setTimeout(X.work, 30);
};
Sfx.work = function () {
  const X = Sfx; X.jobT = 0;
  const j = X.jobs.shift(); if (!j || !X.ok) return;
  X.get(j[0], j[1]);
  if (X.jobs.length) X.jobT = setTimeout(X.work, 12);
};
// Play a buffer. o: at (s from now), gain, rate (below 1 is slower, lower and longer), dest,
// lp (Hz: dull it), hp (Hz: thin out its deepest part), pan, verb (echo send), fadeAt/fade (start fading out at, over fade s).
Sfx.play = function (buf, o) {
  const X = Sfx; if (!X.ok || !buf) return null; o = o || {};
  const ac = X.ac, t = ac.currentTime + Math.max(0, o.at || 0), s = ac.createBufferSource();
  s.buffer = buf; if (o.rate) s.playbackRate.value = o.rate;
  let node = s;
  if (o.lp && o.lp < 17500) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = 0.6; node.connect(f); node = f; }
  if (o.hp) { const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.hp; f.Q.value = 0.7; node.connect(f); node = f; }
  const g = ac.createGain(), gv = o.gain === undefined ? 1 : o.gain; g.gain.value = gv; node.connect(g);
  if (o.fadeAt !== undefined) { g.gain.setValueAtTime(gv, t + o.fadeAt); g.gain.setTargetAtTime(0.0001, t + o.fadeAt, (o.fade || 0.5) / 3); }
  let end = g;
  if (o.pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); g.connect(p); end = p; }
  end.connect(o.dest || X.sfx);
  if (o.verb) { const v = ac.createGain(); v.gain.value = o.verb; end.connect(v); v.connect(o.vbus || X.verb); }
  s.start(t); s._end = t + buf.duration / (o.rate || 1) + 0.05;
  return s;
};
// How far off things sound: quieter (far) and duller (farLp) with distance.
Sfx.far = function (dist) { return clamp(170 / Math.max(60, dist), 0.14, 1); };
Sfx.farLp = function (dist) { return clamp(17000 * Math.pow(140 / Math.max(140, dist), 0.9), 1200, 17000); };
// Something heard from down range: late by the sound's travel, quieter and duller the further off.
Sfx.playFar = function (buf, dist, at, gain, verb) {
  return Sfx.play(buf, { at, gain: Sfx.far(dist) * (gain === undefined ? 1 : gain), lp: Sfx.farLp(dist), verb: verb === undefined ? 0.2 : verb });
};
// Dip the music and ambience under a loud moment (depth 0..1), coming back over about half a second.
Sfx.dip = function (depth, hold) {
  const X = Sfx; if (!X.ok) return;
  const t = X.ac.currentTime, p = X.bgDuck.gain;
  Sfx.hold(p, t); p.setTargetAtTime(Math.max(0.05, 1 - depth), t, 0.006); p.setTargetAtTime(1, t + (hold || 0.12), 0.35);
};

// ---- the rifle -----------------------------------------------------------------------------
// Which suppressor is fitted. 'light' = Featherweight, 'heavy' = Monolith, 'int' = built into
// the rifle (Whisper, Hush, Ratter). (Kept for older callers; the rifle's own parts decide now.)
Sfx.canOf = function (e, sim) {
  const st = sim && sim.st;
  if (e.can) return e.can;
  if (!st) return 'light';
  if (st.gun && st.gun.supp === 'integral') return 'int';
  return st.cfg && st.cfg.muzzle === 'mz_suph' ? 'heavy' : 'light';
};
// The rifle a shot comes from, as the generator sees it: from a mission the whole rifle is known
// (its stats, with every part fitted); an older-style call only gives a calibre and a few flags,
// and gets that calibre's plain voice. Each set-up is worked out once and kept.
Sfx.gunFor = function (e, sim) {
  const X = Sfx, st = sim && sim.st ? sim.st : { cal: e.cal || 'c308', quiet: !!e.quiet, sub: !!e.sub, action: e.action || 'bolt', cycle: e.cycle || 1.4, can: e.can };
  const S = sim && sim.S, loc = sim ? SG.locOf(S) : (X.loc || 'valley'), spec = SG.spec(st, loc, S ? S.refZ : 0, S ? S.groundMat : 'dirt');
  const key = 'gun:' + spec.key;
  let G = X.guns.find((g) => g.key === key);
  if (!G) {
    G = { key, spec, n: 0, last: null };
    X.guns.push(G);
    if (X.guns.length > 3) { const old = X.guns.shift(); Array.from(X.cache.keys()).forEach((k) => { if (k.indexOf(old.key) === 0) X.cache.delete(k); }); }
  }
  return G;
};
Sfx.rep = function (G, k) { return Sfx.get(G.key + ':' + k, () => SG.report(G.spec, k + 1)); };
// Get a mission's sounds ready as it starts, a piece at a time between frames (the rifle's report
// first, ready about a tenth of a second in, long before the fade-in is over), and whatever the
// mission will want (an explosion, thunder). A shot fired before its report is ready makes it there and then.
Sfx.prepare = function (sim) {
  const X = Sfx; if (!sim || !sim.st) return;
  if (!X.ok) { X.pendingSim = sim; return; }
  const S = sim.S, G = X.gunFor({}, sim); X.loc = SG.locOf(S); X.gunNow = G;
  X.later(G.key + ':0', () => SG.report(G.spec, 1));
  X.later(G.key + ':1', () => SG.report(G.spec, 2));
  X.later(G.key + ':act', () => SG.action(G.spec, 1));
  X.later(G.key + ':rel:' + sim.st.reload.toFixed(2), () => SG.reload(G.spec, sim.st.reload, 1));
  ['body', 'head', 'wound'].forEach((k) => X.later('confirm:' + k + ':0', () => SG.confirm(k, 1)));
  X.later('imp:flesh:0', () => SG.impact('flesh', 1)); X.later('imp:' + X.impMat(S.groundMat) + ':0', () => SG.impact(X.impMat(S.groundMat), 1));
  if ((S.objects || []).some((o) => o.kind === 'barrel' || o.kind === 'tank')) X.later('boom:' + X.loc + ':0', () => SG.boom(X.loc, 1));
  // thunder: in a storm, or when the mission brings it in as cover (its triggers call sim.cover(.., 'thunder'))
  const thunder = (sim.triggers || []).some((t) => typeof t.do === 'function' && String(t.do).indexOf("'thunder'") >= 0);
  if (thunder || S.weather === 'storm') X.later('thunder:close:0', () => SG.thunder('close', 1));
  if (S.weather === 'storm') X.later('thunder:far:0', () => SG.thunder('far', 1));
};
// A shot. The report (two takes of it, played in turn, each a hair different in pitch and level
// so no two shots are exactly alike), a semi-automatic's action already inside it, a bolt worked
// after it. The music and ambience dip under it.
Sfx.shot = function (e, sim) {
  const X = Sfx; if (!X.ok) return;
  const G = X.gunFor(e, sim), k = G.n++ % 2;
  let rep = X.cache.get(G.key + ':' + k);
  if (!rep) rep = X.cache.get(G.key + ':' + (1 - k)) || X.rep(G, k); // never wait for the second take
  X.later(G.key + ':1', () => SG.report(G.spec, 2));
  X.gunNow = G; G.last = rep;
  X.play(rep, { rate: 1 + (Math.random() * 2 - 1) * 0.012, gain: 1 - Math.random() * 0.08 });
  X.dip(G.spec.D.supp ? 0.35 : 0.6, G.spec.D.supp ? 0.08 : 0.15);
  const act = X.get(G.key + ':act', () => SG.action(G.spec, 1));
  if (act) X.play(act, { at: act._at || 0 });
};
// (kept for older callers: a suppressed shot of this calibre, with this can)
Sfx.suppressed = function (e, can) { Sfx.shot(Object.assign({}, e, { quiet: true, can: can || e.can || 'light' })); };
Sfx.brass = function (at, ground) { // an empty case landing
  const X = Sfx, g = ground || (X.gunNow ? X.gunNow.spec.ground : 'hard'), v = (Math.random() * 3) | 0;
  X.play(X.get('brass:' + g + ':' + v, () => SG.brass(g, false, v + 1)), { at: at || 0 });
};
Sfx.reload = function (dur, action) {
  const X = Sfx; if (!X.ok) return;
  let G = X.gunNow;
  if (!G || (action && G.spec.action !== action)) G = X.gunFor({ cal: action === 'charge' ? 'crail' : 'c308', action: action || 'bolt', cycle: 1.4 });
  X.play(X.get(G.key + ':rel:' + (+dur).toFixed(2), () => SG.reload(G.spec, +dur || 2.5, 1)));
};
Sfx.dry = function () { const X = Sfx; X.play(X.get('dry', () => SG.dry(5))); };
Sfx.breath = function (on, gasp) {
  if (on) { Sfx.noise({ type: 'bandpass', f: 700, f1: 1500, q: 1.2, dur: 0.38, att: 0.2, gain: 0.08 }); Sfx.noise({ type: 'lowpass', f: 500, dur: 0.4, att: 0.2, gain: 0.04 }); }
  else { Sfx.noise({ type: 'bandpass', f: gasp ? 1500 : 1100, f1: 420, q: 1.0, dur: gasp ? 0.75 : 0.5, att: 0.05, gain: gasp ? 0.18 : 0.08 }); if (gasp) Sfx.noise({ type: 'lowpass', f: 600, dur: 0.6, att: 0.04, gain: 0.07 }); }
};
Sfx.heart = function (strength) { // while holding breath: deep, with a triangle copy a phone can play
  Sfx.tone({ f: 62, f1: 40, dur: 0.09, gain: 0.3 * strength }); Sfx.tone({ at: 0.15, f: 54, f1: 36, dur: 0.11, gain: 0.22 * strength });
  Sfx.tone({ type: 'triangle', f: 124, f1: 80, dur: 0.06, gain: 0.08 * strength, lp: 400 }); Sfx.tone({ at: 0.15, type: 'triangle', f: 108, f1: 72, dur: 0.07, gain: 0.06 * strength, lp: 400 });
};

// ---- things happening down range (they arrive late) ---------------------------------------
// the generator's material for a ground or surface
Sfx.impMat = function (mat) { return { flesh: 'flesh', head: 'head', metal: 'metal', hard: 'hard', concrete: 'hard', stone: 'hard', wall: 'hard', glass: 'glass', water: 'water', wood: 'wood', interior: 'wood', snow: 'snow' }[mat] || 'dirt'; };
// three takes of each, so a run of hits does not repeat
Sfx.imp = function (mat, wet) { const X = Sfx, m = X.impMat(mat), v = (Math.random() * 3) | 0; return X.get('imp:' + m + (wet ? 'W' : '') + ':' + v, () => SG.impact(m, v + 1, wet)); };
Sfx.impact = function (mat, dist, at) {
  const X = Sfx; if (!X.ok) return;
  X.playFar(X.imp(mat), dist, at, 1.1);
};
// A round hitting a person. Two parts:
//   the confirm: close and punchy, right as the round lands, so the player feels it at once.
//     A head kill is a sharp crack, a skull's tock and a bright ting over a punch; a body kill a
//     deep heavy thwack and a big low thoom; a hit that does not kill a dull, short "tuk".
//   the real impact: the smack itself, arriving only when its sound has travelled back, and
//     duller and quieter the further away it was. With gore on it is wet.
// `at` is the delay for the sound to travel back. The confirm goes on the near bus, so the
// slow motion muffle never dulls it.
Sfx.hit = function (e, at, gore) {
  const X = Sfx; if (!X.ok) return;
  X.playFar(X.imp(e.part === 'head' ? 'head' : 'flesh', !!gore), e.dist || 150, at, 1.2);
  X.confirm(e);
};
Sfx.confirm = function (e) {
  const X = Sfx; if (!X.ok) return;
  const kind = !e.lethal ? 'wound' : e.part === 'head' ? 'head' : 'body', v = (Math.random() * 2) | 0;
  X.play(X.get('confirm:' + kind + ':' + v, () => SG.confirm(kind, v + 1)), { dest: X.near });
};
// Body armour stops the round: a hard "TANK" on the plate, not a kill.
Sfx.vest = function (dist, at) {
  const X = Sfx; if (!X.ok) return;
  X.play(X.get('confirm:vest:0', () => SG.confirm('vest', 1)), { dest: X.near });
  X.playFar(X.imp('metal'), dist, at, 0.8);
};
Sfx.glass = function (dist, at) { Sfx.playFar(Sfx.imp('glass'), dist, at, 1.1); };
// A tank or drum going up: big however far, and felt as well as heard.
Sfx.boom = function (dist, at) {
  const X = Sfx; if (!X.ok) return;
  const loc = X.loc || 'valley', v = X.cache.has('boom:' + loc + ':0') && Math.random() < 0.5 ? 1 : 0;
  X.play(X.get('boom:' + loc + ':' + v, () => SG.boom(loc, v + 1)), { at, gain: clamp(260 / Math.max(80, dist), 0.45, 1), lp: clamp(17000 * Math.pow(200 / Math.max(200, dist), 0.8), 2500, 17000) });
  X.later('boom:' + loc + ':' + (1 - v), () => SG.boom(loc, 2 - v));
  setTimeout(() => X.dip(0.75, 0.6), Math.max(0, at * 1000));
};
Sfx.bell = function (dist, at, f) {
  const X = Sfx; if (!X.ok) return;
  f = Math.round(f || 520);
  X.playFar(X.get('bell:' + f, () => SG.bell(f, f)), dist, at, 1.2, 0.5);
};
Sfx.voice = function (dist, at) { // a short alarmed shout, far off
  const g = Sfx.far(dist) * 0.6, f = 420 + Math.random() * 260;
  Sfx.tone({ at, type: 'sawtooth', f, f1: f * 1.5, sweep: 0.12, dur: 0.38, att: 0.03, gain: 0.08 * g, lp: 1500, verb: 0.6 });
  Sfx.tone({ at: at + 0.12, type: 'sawtooth', f: f * 1.5, f1: f * 0.8, dur: 0.3, att: 0.03, gain: 0.06 * g, lp: 1300, verb: 0.6 });
  Sfx.noise({ at, type: 'bandpass', f: 2600, q: 2, dur: 0.3, att: 0.03, gain: 0.02 * g });
};
// the alarm: a wailing siren across the scene
Sfx.siren = function (at) { const X = Sfx; X.play(X.get('siren', () => SG.siren(6.5)), { at, gain: 0.9, lp: 6000, verb: 0.6 }); };
// Thunder over the mission. Close (it covers a shot) unless told it is far. Two takes of each,
// taken in turn and each played a little faster or slower, so no two storms roll the same.
Sfx.thunder = function (at, far) {
  const X = Sfx; if (!X.ok) return;
  const kind = far ? 'far' : 'close', v = (X.thunN = (X.thunN || 0) + 1) % 2, key = (i) => 'thunder:' + kind + ':' + i;
  const b = X.cache.get(key(v)) || X.cache.get(key(1 - v)) || X.get(key(0), () => SG.thunder(kind, 1));
  X.later(key(1), () => SG.thunder(kind, 2));
  X.play(b, { at, rate: 0.92 + Math.random() * 0.16, gain: far ? 0.75 : 1 });
  if (!far) setTimeout(() => X.dip(0.5, 0.3), Math.max(0, at * 1000));
};
Sfx.train = function (dur) {
  Sfx.noise({ type: 'lowpass', f: 380, dur: dur, att: dur * 0.25, gain: 0.5, brown: true });
  Sfx.noise({ type: 'bandpass', f: 1800, q: 0.6, dur: dur, att: dur * 0.3, gain: 0.09 });
  for (let t = 0.4; t < dur; t += 0.52) { Sfx.tone({ at: t, f: 95, f1: 60, dur: 0.07, gain: 0.25 }); Sfx.tone({ at: t + 0.11, f: 90, f1: 58, dur: 0.07, gain: 0.2 }); Sfx.noise({ at: t, type: 'bandpass', f: 1300, q: 1.5, dur: 0.05, gain: 0.08 }); }
  Sfx.tone({ at: dur * 0.12, type: 'sawtooth', f: 330, dur: 1.1, att: 0.08, gain: 0.07, lp: 1100, verb: 0.9 }); Sfx.tone({ at: dur * 0.12, type: 'sawtooth', f: 415, dur: 1.1, att: 0.08, gain: 0.06, lp: 1100, verb: 0.9 });
};
Sfx.fireworks = function (dur) {
  for (let t = 0.1; t < dur; t += 0.5 + Math.random() * 0.8) { Sfx.noise({ at: t, type: 'bandpass', f: 900, f1: 2600, q: 3, dur: 0.5, att: 0.3, gain: 0.05 }); Sfx.noise({ at: t + 0.55, type: 'lowpass', f: 1400, f1: 200, dur: 0.5, gain: 0.5, verb: 1.0 }); Sfx.tone({ at: t + 0.55, f: 90, f1: 40, dur: 0.3, gain: 0.25 }); for (let j = 0; j < 5; j++) Sfx.noise({ at: t + 0.7 + Math.random() * 0.5, type: 'highpass', f: 3500, dur: 0.04, gain: 0.08 }); }
};
Sfx.rattle = function (dur) { for (let t = 0; t < dur; t += 0.085) { Sfx.noise({ at: t, type: 'lowpass', f: 1500, dur: 0.045, gain: 0.3 }); Sfx.tone({ at: t, f: 90, dur: 0.04, gain: 0.2 }); } };
Sfx.horn = function (f, dur, at, g) { Sfx.tone({ at, type: 'sawtooth', f, dur, att: 0.12, gain: g || 0.12, lp: 700, verb: 1.0 }); Sfx.tone({ at, type: 'sawtooth', f: f * 1.26, dur, att: 0.12, gain: (g || 0.12) * 0.7, lp: 700, verb: 1.0 }); };
Sfx.jet = function (dur) { Sfx.noise({ type: 'bandpass', f: 500, f1: 2400, sweep: dur * 0.5, q: 0.7, dur, att: dur * 0.45, gain: 0.5 }); Sfx.noise({ type: 'lowpass', f: 300, dur, att: dur * 0.4, gain: 0.5, brown: true }); };
// a helicopter: the rotor's beat (blade slap, about five a second) over a turbine whine
Sfx.heli = function (dur) {
  const X = Sfx; if (!X.ok) return;
  const ac = X.ac, t = ac.currentTime, len = Math.min(dur, 120);
  const src = ac.createBufferSource(); src.buffer = X.brown; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520;
  const g = ac.createGain(); g.gain.value = 0;
  const am = ac.createGain(); am.gain.value = 0.35;
  const l = ac.createOscillator(); l.type = 'square'; l.frequency.value = 5.2; const lg = ac.createGain(); lg.gain.value = 0.3; l.connect(lg); lg.connect(am.gain);
  src.connect(f); f.connect(am); am.connect(g); g.connect(X.sfx);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + Math.min(6, len * 0.4)); g.gain.setValueAtTime(0.7, t + len - 2); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.start(t, Math.random()); l.start(t); src.stop(t + len + 0.1); l.stop(t + len + 0.1);
  Sfx.tone({ type: 'sawtooth', f: 1850, f1: 2100, dur: len, att: len * 0.4, gain: 0.006, lp: 3000 });
};

// ---- interface sounds -----------------------------------------------------------
Sfx.ui = function (kind) {
  const X = Sfx; if (!X.ok) return;
  const k = ['tap', 'back', 'go', 'deny', 'buy', 'equip', 'star', 'page', 'riser', 'radio', 'tick'].indexOf(kind) >= 0 ? kind : 'tap';
  X.play(X.get('ui:' + k, () => SG.ui(k)), { dest: X.near, gain: k === 'star' ? 1 : 0.9 });
};
Sfx.rarity = function (r) { // a little chord that gets grander with rarity
  const base = [392, 440, 494, 523, 587][r] || 392, n = 2 + r;
  for (let i = 0; i < n; i++) Sfx.tone({ at: i * 0.07, f: base * [1, 1.25, 1.5, 2, 2.5, 3][i], dur: 0.5 + r * 0.25, gain: 0.07, type: i % 2 ? 'triangle' : 'sine', verb: 0.5 + r * 0.15 });
  Sfx.tone({ f: 70, f1: 45, dur: 0.3 + r * 0.1, gain: 0.15 + r * 0.04 });
  if (r >= 3) Sfx.noise({ type: 'highpass', f: 6000, dur: 0.9, att: 0.05, gain: 0.04, verb: 0.8 });
};
Sfx.result = function (win) {
  Sfx.tension = 0;
  if (win) [220, 277.2, 329.6, 440, 554.4].forEach((f, i) => Sfx.tone({ at: 0.25 + i * 0.11, f, dur: 1.6, gain: 0.07, type: 'triangle', verb: 0.9, dest: Sfx.mus }));
  else { Sfx.tone({ at: 0.2, f: 146.8, f1: 138.6, dur: 1.8, gain: 0.12, type: 'sawtooth', lp: 500, verb: 0.9, dest: Sfx.mus }); Sfx.tone({ at: 0.2, f: 103.8, f1: 98, dur: 1.8, gain: 0.12, type: 'sawtooth', lp: 500, verb: 0.9, dest: Sfx.mus }); }
};

// ---- the kill camera -----------------------------------------------------------------
// The kill camera calls Sfx.kc(stage, o) once for each beat of its film (src/21_killcam.js, kcSay,
// has the list and when each comes): fly, cover, slow, near, enter, bone, organ, exit, resume,
// fall, end. Every o carries rate (how fast the world's clock is running, 1 = real time: 0.05 at
// the rifle and from the swing through the X-ray, about 0.2 to 1 in the flight, 0.06 climbing to
// 0.55 in the hold), part, cal, power (0..1) and gore, plus what the beat adds (mat, bone, organ,
// key, size, spray, len).
//
// Slow time is heard as lower and longer. Taken literally, 0.05 would be twenty times slower and
// far too low for a phone to play, so the film's rate is first turned into a "heard" rate h: 0.24
// at the slowest, 1 at real time. Pitches are multiplied by about its square root (an octave down
// at the slowest) and lengths by its power -0.6 (about 2.4 times as long). Sharp layers (cracks,
// splinters) drop less so they stay sharp, and anything low keeps a floor and a copy an octave or
// two up, so a phone speaker still plays it.
//
// Under the whole film: a low bed that grows as time slows, and a heartbeat. 'fly' slows the
// rifle's own report right down. 'slow' drops the world into the deep slow motion (a falling rush,
// a sub drop, a faint ringing in the ears) and it holds there for o.len seconds; 'enter' is the
// hit itself, the player's own kill confirm slowed an octave down under a stretched slap and punch,
// then a tearing that lasts until the round comes out; 'resume' rushes the world back up as the
// clock climbs toward 0.55 over about a second. A shot through the heart stops the heartbeat. Wet
// layers are only added with gore on, and grow with the spray the film reports. Beats that arrive
// on top of each other are spread a few hundredths of a second apart and turned down, so they never
// pile up into mush. On 'end' everything here fades out in a few hundredths of a second and the
// world snaps back.
function kcPT(rate) {
  const r = clamp(+rate || 1, 0.05, 1), h = 0.24 + 0.76 * Math.pow((r - 0.05) / 0.95, 0.75);
  return { r, h, p: Math.sqrt(h), p2: Math.pow(h, 0.25), t: Math.pow(h, -0.6) };
}
const kcBedLvl = (r) => 0.02 + 0.12 * Math.pow(1 - clamp(r, 0, 1), 1.5);
const kcBedCut = (r) => 170 + 1300 * r * r;
const kcSubCal = { c300s: 1, c9s: 1, c22: 1 };
Sfx.kc = function (stage, o) {
  const X = Sfx; if (!X.ok) return;
  try { X.kcBeat(stage, o || {}); } catch (e) { /* sound is optional: it must never break the film */ }
};
Sfx.kcOpen = function () {
  const X = Sfx, ac = X.ac;
  if (X.kcS && X.kcS.on) X.kcClose(false);
  const out = ac.createGain(); out.gain.value = 0.82; out.connect(X.near); // about as loud as a real shot at its peak
  Sfx.hold(X.kcVerbG.gain, ac.currentTime); X.kcVerbG.gain.setTargetAtTime(0.5, ac.currentTime, 0.01); // open the echo
  X.kcS = { on: true, t0: ac.currentTime, last: ac.currentTime, film: false, out, srcs: [], recent: [], next: 0, gore: true, bed: null, bedR: -1, wh: null, whR: -1, near: false, tear: null, hb: null, ring: null, slowLen: 4 };
  return X.kcS;
};
// remember a sound source so 'end' can stop it (sources that have finished are forgotten)
Sfx.kcKeep = function (S, s) {
  if (!s) return s;
  if (S.srcs.length > 40) { const now = Sfx.ac.currentTime; S.srcs = S.srcs.filter((x) => x._end === undefined || x._end > now); }
  S.srcs.push(s); return s;
};
Sfx.kcClose = function (snap) {
  const X = Sfx, S = X.kcS; if (!X.ok || !S || !S.on) return;
  const now = X.ac.currentTime;
  S.on = false; S.bed = S.wh = S.tear = S.ring = null; if (S.hb) S.hb.stop = true;
  Sfx.hold(S.out.gain, now); S.out.gain.setTargetAtTime(0, now, 0.012);
  Sfx.hold(X.kcVerbG.gain, now); X.kcVerbG.gain.setTargetAtTime(0, now, 0.015); // and its echo, which would ring on
  S.srcs.forEach((s) => { try { s.stop(now + 0.1); } catch (e) { /* already stopped */ } });
  S.srcs = [];
  const out = S.out; setTimeout(() => { try { out.disconnect(); } catch (e) { /* already gone */ } }, 600);
  // the world comes back
  Sfx.hold(X.master.gain, now); X.master.gain.setTargetAtTime(0.9, now, snap ? 0.02 : 0.1);
  if (snap) {
    X.snapUntil = now + 1.4; Sfx.hold(X.lp.frequency, now); X.lp.frequency.setTargetAtTime(19000, now, 0.015);
    // a crisp whip back into real time: a quick rising rush that stops dead on a click
    Sfx.noise({ type: 'bandpass', f: 700, f1: 5200, sweep: 0.06, q: 1.1, att: 0.055, dur: 0.012, gain: 0.09, dest: X.near });
    Sfx.noise({ at: 0.058, type: 'highpass', f: 5200, att: 0.0003, dur: 0.006, gain: 0.11, dest: X.near });
  }
};
// follow the film's speed: the bed is loud and dark when time is slow, nearly gone at real time,
// the round's whoosh brightens as the flight speeds up and deepens as it slows again, and the
// heartbeat is kept going a beat or two ahead
Sfx.kcTick = function (scale) {
  const X = Sfx, S = X.kcS; if (!S || !S.on) return;
  const now = X.ac.currentTime;
  if (CB.KillCam && !CB.KillCam.active) { // the film ended without saying so
    if (S.film && now - S.t0 > 0.25) X.kcClose(true);
    else if (!S.film && now - S.last > 4) X.kcClose(false); // a stray beat on its own: let it ring out first
    return;
  }
  if (S.bed && Math.abs(scale - S.bedR) > 0.02) { S.bedR = scale; S.bed.g.gain.setTargetAtTime(kcBedLvl(scale), now, 0.15); S.bed.f.frequency.setTargetAtTime(kcBedCut(scale), now, 0.15); }
  if (S.wh && !S.near && Math.abs(scale - S.whR) > 0.02) { S.whR = scale; S.wh.f.frequency.setTargetAtTime(700 * kcPT(scale).p, now, 0.2); }
  kcHeartRun(S, now);
};
// a new beat: how long to wait so it does not land on the last one, and how much to turn it down
function kcSlot(S, now) {
  S.recent = S.recent.filter((x) => now - x < 0.16);
  const n = S.recent.length, at = Math.min(0.09, Math.max(0, (S.next || 0) - now));
  S.recent.push(now); S.next = now + at + 0.024;
  return { at, k: 1 / Math.sqrt(1 + 0.6 * n), lite: n >= 3 };
}
// The bed: what slowed time sounds like under everything. A dark rumble, a band of pressure in the
// low middle (where a phone can play it, so it is never mud), a held sub tone and a triangle an
// octave up.
function kcBed(S, P) {
  const X = Sfx, ac = X.ac, now = ac.currentTime;
  const src = ac.createBufferSource(); src.buffer = X.brown; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kcBedCut(P.r); f.Q.value = 0.9;
  const bg = ac.createGain(); bg.gain.value = 0.5;
  const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 50; hp.Q.value = 0.6;
  const w = ac.createBufferSource(); w.buffer = X.white; w.loop = true;
  const wf = ac.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 340; wf.Q.value = 0.8;
  const wl = ac.createBiquadFilter(); wl.type = 'lowpass'; wl.frequency.value = 900; wl.Q.value = 0.6;
  const wg = ac.createGain(); wg.gain.value = 1.7;
  const sub = ac.createOscillator(); sub.frequency.value = 41;
  const tri = ac.createOscillator(); tri.type = 'triangle'; tri.frequency.value = 82;
  const sg = ac.createGain(); sg.gain.value = 0.12; const tg = ac.createGain(); tg.gain.value = 0.05;
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.setTargetAtTime(kcBedLvl(P.r), now, 0.12);
  src.connect(hp); hp.connect(f); f.connect(bg); bg.connect(g); w.connect(wf); wf.connect(wl); wl.connect(wg); wg.connect(g); sub.connect(sg); sg.connect(g); tri.connect(tg); tg.connect(g); g.connect(S.out);
  src.start(now, Math.random() * 2); w.start(now, Math.random() * 1.5); sub.start(now); tri.start(now);
  Sfx.kcKeep(S, src); Sfx.kcKeep(S, w); Sfx.kcKeep(S, sub); Sfx.kcKeep(S, tri);
  S.bed = { f, g }; S.bedR = P.r;
}
// The heartbeat: one oscillator whose loudness and pitch are moved for each "lub-dub", kept a
// couple of beats ahead. It slows in the deep slow motion, quickens as time comes back, and stops
// for good when the round goes through the heart.
function kcHeartStart(S, t0) {
  const ac = Sfx.ac, o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
  o.type = 'triangle'; lp.type = 'lowpass'; lp.frequency.value = 420; g.gain.value = 0.0001;
  const o2 = ac.createOscillator(), g2 = ac.createGain(); o2.type = 'triangle'; g2.gain.value = 0.45;
  o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(S.out);
  o.start(t0); o2.start(t0); Sfx.kcKeep(S, o); Sfx.kcKeep(S, o2);
  S.hb = { o, o2, g, next: t0, period: 1.05, stop: false };
  kcHeartRun(S, ac.currentTime);
}
function kcHeartRun(S, now) {
  const H = S.hb; if (!H || H.stop) return;
  while (H.next < now + 1.6) {
    const t = Math.max(H.next, now + 0.01);
    [[0, 0.34, 66, 42, 0.13], [0.19, 0.25, 58, 38, 0.15]].forEach((b) => {
      const s = t + b[0];
      H.g.gain.setValueAtTime(0.0001, s); H.g.gain.exponentialRampToValueAtTime(b[1], s + 0.012); H.g.gain.exponentialRampToValueAtTime(0.0001, s + b[4]);
      H.o.frequency.setValueAtTime(b[2], s); H.o.frequency.exponentialRampToValueAtTime(b[3], s + b[4]);
      H.o2.frequency.setValueAtTime(b[2] * 2, s); H.o2.frequency.exponentialRampToValueAtTime(b[3] * 2, s + b[4]);
    });
    H.next = t + H.period;
  }
}
function kcHeartStop(S, t) {
  const H = S.hb; if (!H || H.stop) return; H.stop = true;
  H.g.gain.cancelScheduledValues(t); H.g.gain.setValueAtTime(0.0001, t);
  try { H.o.stop(t + 0.05); H.o2.stop(t + 0.05); } catch (e) { /* already stopped */ }
}
// a faint ringing in the ears while time is deep in slow motion
function kcRing(S, len) {
  const ac = Sfx.ac, now = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), am = ac.createOscillator(), ag = ac.createGain();
  o.frequency.value = 3550 + Math.random() * 300; am.frequency.value = 0.7; ag.gain.value = 0.004;
  g.gain.setValueAtTime(0.0001, now); g.gain.setTargetAtTime(0.009, now + 0.25, 0.25); g.gain.setTargetAtTime(0.0001, now + Math.max(0.8, len - 0.6), 0.4);
  am.connect(ag); ag.connect(g.gain); o.connect(g); g.connect(S.out);
  o.start(now); am.start(now); o._end = am._end = now + len + 1.5; o.stop(o._end); am.stop(am._end);
  Sfx.kcKeep(S, o); Sfx.kcKeep(S, am);
  S.ring = { g };
}
function kcRingStop(S, t) { const R = S.ring; if (!R) return; S.ring = null; Sfx.hold(R.g.gain, t); R.g.gain.setTargetAtTime(0.0001, t, 0.12); }
// the round in the air: band-limited noise that pulses with its spin and grows as it nears
function kcWhoosh(S, P) {
  const X = Sfx, ac = X.ac, now = ac.currentTime;
  const src = ac.createBufferSource(); src.buffer = X.white; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.3; f.frequency.setValueAtTime(260 * P.p, now); f.frequency.setTargetAtTime(700 * P.p, now, 1.2);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.setTargetAtTime(0.04, now + 0.3, 0.8);
  const am = ac.createGain(); am.gain.value = 0.7;
  const lfo = ac.createOscillator(); lfo.frequency.value = 9 * P.p; const lg = ac.createGain(); lg.gain.value = 0.3;
  lfo.connect(lg); lg.connect(am.gain);
  src.connect(f); f.connect(g); g.connect(am); am.connect(S.out);
  src.start(now, Math.random()); lfo.start(now);
  Sfx.kcKeep(S, src); Sfx.kcKeep(S, lfo);
  S.wh = { src, lfo, f, g };
}
function kcCutWhoosh(S, t) {
  const w = S.wh; if (!w) return; S.wh = null;
  Sfx.hold(w.g.gain, t); w.g.gain.setTargetAtTime(0.0001, t, 0.01);
  try { w.src.stop(t + 0.12); w.lfo.stop(t + 0.12); } catch (e) { /* already stopped */ }
}
// passing through: a low, uneven tearing that lasts until the round comes out (or as long as
// the slow motion has left, at most)
function kcTear(S, P, k, wet, at) {
  const X = Sfx, ac = X.ac, t = ac.currentTime + at, len = clamp((S.slowLen || 4) - 1.6, 1.2, 3.2);
  if (S.tear) kcStopTear(S, t);
  const b = ac.createBufferSource(); b.buffer = X.brown; b.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = Math.max(190, 420 * P.p); f.Q.value = 1.1;
  const b2 = ac.createBufferSource(); b2.buffer = X.white; b2.loop = true;
  const f3 = ac.createBiquadFilter(); f3.type = 'bandpass'; f3.frequency.value = 680 * P.p2; f3.Q.value = 1.6;
  const g3 = ac.createGain(); g3.gain.value = 0.55;
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((0.6 + 0.4 * wet) * k, t + 0.03 * P.t); g.gain.setTargetAtTime(0.0001, t + len, 0.15);
  const am = ac.createGain(); am.gain.value = 0;
  const r = ac.createBufferSource(); r.buffer = X.rough; r.loop = true; r.playbackRate.value = 1.3 * P.p;
  r.connect(am.gain); b.connect(f); f.connect(g); b2.connect(f3); f3.connect(g3); g3.connect(g); g.connect(am); am.connect(S.out);
  const srcs = [b, r, b2];
  if (wet > 0) { // a wet sizzle riding on the tear
    const w = ac.createBufferSource(); w.buffer = X.white; w.loop = true;
    const f2 = ac.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 850 * P.p2; f2.Q.value = 2.4;
    const g2 = ac.createGain(); g2.gain.value = 0.24 * wet;
    w.connect(f2); f2.connect(g2); g2.connect(g); srcs.push(w);
  }
  srcs.forEach((s) => { s.start(t, Math.random()); s._end = t + len + 0.8; s.stop(s._end); Sfx.kcKeep(S, s); });
  S.tear = { g, srcs };
}
function kcStopTear(S, t) {
  const T = S.tear; if (!T) return; S.tear = null;
  Sfx.hold(T.g.gain, t); T.g.gain.setTargetAtTime(0.0001, t, 0.03);
  T.srcs.forEach((s) => { try { s.stop(t + 0.25); } catch (e) { /* already stopped */ } });
}
Sfx.kcBeat = function (stage, o) {
  const X = Sfx, ac = X.ac, now = ac.currentTime, P = kcPT(o.rate);
  if (stage === 'end') { X.kcClose(true); return; }
  let S = X.kcS;
  if (stage === 'fly' || !S || !S.on) S = X.kcOpen(); // a beat without 'fly' still sounds, just without the bed
  S.gore = o.gore !== false; S.last = now;
  const gore = S.gore, pw = clamp(o.power === undefined ? 0.7 : +o.power, 0, 1), T = P.t, p = P.p, p2 = P.p2;
  // how wet: nothing with gore off, more the more blood the film shows coming out
  const wet = !gore ? 0 : o.spray === undefined ? 0.7 : 0.3 + 0.7 * clamp(+o.spray || 0, 0, 1);
  let at = 0, kk = 1, lite = false;
  if (stage !== 'fly' && stage !== 'near' && stage !== 'slow' && stage !== 'resume') { const sl = kcSlot(S, now); at = sl.at; kk = sl.k; lite = sl.lite; }
  const k = kk * (0.65 + 0.35 * pw);
  const n = (q) => { q.at = (q.at || 0) + at; q.dest = S.out; q.vbus = X.kcVerb; return X.kcKeep(S, Sfx.noise(q)); };
  const t = (q) => { q.at = (q.at || 0) + at; q.dest = S.out; q.vbus = X.kcVerb; return X.kcKeep(S, Sfx.tone(q)); };
  const rnd = Math.random;
  if (S.bed && Math.abs(P.r - S.bedR) > 0.02) { S.bedR = P.r; S.bed.g.gain.setTargetAtTime(kcBedLvl(P.r), now, 0.15); S.bed.f.frequency.setTargetAtTime(kcBedCut(P.r), now, 0.15); }
  kcHeartRun(S, now);
  switch (stage) {
    case 'fly': {
      const st = X.simRef && X.simRef.st;
      S.quiet = o.quiet !== undefined ? !!o.quiet : st ? !!st.quiet : false;
      S.sub = o.sub !== undefined ? !!o.sub : st ? !!st.subsonic : !!kcSubCal[o.cal];
      S.film = true;
      // the world drops away
      Sfx.hold(X.master.gain, now); X.master.gain.setTargetAtTime(0.42, now, 0.12);
      kcBed(S, P); kcHeartStart(S, now + 0.45);
      // the rifle's own report, slowed right down: the same shot, an octave and more lower and three times as long
      const mk = (S.quiet ? (S.sub ? 0.55 : 0.75) : 1) * (0.7 + 0.3 * pw), G = X.gunNow, rep = G && G.last;
      if (rep) X.kcKeep(S, X.play(rep, { dest: S.out, rate: 0.36, gain: 0.62 * mk, lp: 5000, fadeAt: 1.4, fade: 1.6, verb: 0.25, vbus: X.kcVerb }));
      else {
        const c = CAL_SND[o.cal] || CAL_SND.c308;
        t({ f: Math.max(34, c.bf * p * 0.6), f1: 26, dur: 0.9 * T, att: 0.012, gain: 0.42 * mk });
        n({ type: 'lowpass', f: 1700 * p, f1: 140, dur: 0.75 * T, att: 0.015, gain: 0.3 * mk, verb: 0.5 });
      }
      t({ type: 'triangle', f: Math.max(70, 190 * p), f1: 48, dur: 0.35 * T, gain: 0.14 * mk, lp: 700 });       // its body (heard on a phone)
      if (!S.sub) n({ type: 'bandpass', f: (S.quiet ? 2100 : 2600) * p2, q: 0.8, att: 0.001, dur: 0.05 * T, gain: 0.26 }); // the crack, stretched
      kcWhoosh(S, P);
      break;
    }
    case 'slow': {
      // the deep slow motion: the world falls away (a rush dropping in pitch, a sub dropping under
      // it), the ears start to ring, and the heart slows; it holds until 'resume'
      S.slowLen = clamp(+o.len || 4, 1.5, 8); S.slowT = now;
      n({ type: 'bandpass', f: 2600, f1: 170, sweep: 0.7, q: 1.1, att: 0.03, dur: 0.8, gain: 0.17, verb: 0.4 });
      t({ f: 96, f1: 31, sweep: 0.65, att: 0.008, dur: 1.2, gain: 0.18 });
      t({ type: 'triangle', f: 192, f1: 90, sweep: 0.55, att: 0.008, dur: 0.7, gain: 0.2, lp: 900 });
      n({ type: 'bandpass', f: 640, f1: 190, sweep: 0.5, q: 0.9, att: 0.01, dur: 0.75, gain: 0.14, verb: 0.4 });
      kcRing(S, S.slowLen);
      if (S.hb) S.hb.period = 1.35;
      if (S.wh) { const w = S.wh; Sfx.hold(w.f.frequency, now); w.f.frequency.setTargetAtTime(420, now, 0.3); }
      break;
    }
    case 'near': {
      if (!S.wh) kcWhoosh(S, P);
      const w = S.wh; S.near = true;
      Sfx.hold(w.g.gain, now); w.g.gain.setTargetAtTime(0.19 * k, now, 0.17);
      Sfx.hold(w.f.frequency, now); w.f.frequency.setTargetAtTime(1500 * p2, now, 0.22);
      w.lfo.frequency.setTargetAtTime(15 * p, now, 0.2);
      t({ f: Math.max(36, 80 * p), f1: 40, att: 0.4, dur: 0.12, gain: 0.09 * k });                              // the air pushed ahead of it
      n({ type: 'bandpass', f: 380 * p2, f1: 700 * p2, sweep: 0.45, q: 1.2, att: 0.42, dur: 0.08, gain: 0.08 * k });
      if (!S.sub) n({ type: 'bandpass', f: 3600 * p2, f1: 5200 * p2, sweep: 0.45, q: 2, att: 0.45, dur: 0.05, gain: 0.05 * k }); // its shock wave hissing
      break;
    }
    case 'cover': {
      if (S.wh) { const w = S.wh; Sfx.hold(w.g.gain, now); w.g.gain.setTargetAtTime(0.02, now + at, 0.008); w.g.gain.setTargetAtTime(0.12 * k, now + at + 0.06 * T, 0.12); }
      const m = o.mat || 'wall';
      if (m === 'wood') {
        n({ type: 'bandpass', f: 1300 * p2, q: 1.8, att: 0.0006, dur: 0.05 * T, gain: 0.4 * k });             // the crack
        t({ f: Math.max(120, 240 * p), f1: Math.max(80, 150 * p), dur: 0.09 * T, gain: 0.32 * k });            // a hollow knock
        if (!lite) for (let i = 0; i < 5; i++) n({ at: (0.01 + rnd() * 0.17) * T, type: 'bandpass', f: (2200 + rnd() * 3000) * p2, q: 5, att: 0.0005, dur: 0.012 * T, gain: (0.06 + rnd() * 0.06) * k }); // splinters
        n({ at: 0.01, type: 'lowpass', f: 900 * p, att: 0.02, dur: 0.25 * T, gain: 0.07 * k, verb: 0.3 });    // chips and dust
      } else if (m === 'metal') {
        n({ type: 'highpass', f: 3500 * p2, att: 0.0003, dur: 0.008, gain: 0.38 * k });
        [[1, 0.2, 0.7], [2.76, 0.12, 0.45], [5.4, 0.06, 0.25]].forEach((h) => t({ f: 520 * p * h[0], dur: h[2] * T, gain: h[1] * k, verb: 0.4 })); // the clang
        n({ type: 'bandpass', f: 2400 * p2, f1: 900 * p2, q: 3, dur: 0.15 * T, gain: 0.08 * k });             // tearing through the sheet
      } else if (m === 'glass') {
        n({ type: 'highpass', f: 3800 * p2, att: 0.0004, dur: 0.22 * T, gain: 0.34 * k, verb: 0.3 });         // the burst
        t({ f: Math.max(160, 420 * p), f1: Math.max(100, 220 * p), dur: 0.05 * T, gain: 0.12 * k });          // the pane flexing
        const nT = lite ? 3 : 7; for (let i = 0; i < nT; i++) t({ at: (0.02 + rnd() * 0.5) * T, f: (2500 + rnd() * 4500) * p2, dur: (0.04 + rnd() * 0.08) * T, gain: 0.05 * k }); // pieces
      } else { // a wall: brick, block or plaster
        n({ type: 'lowpass', f: 1600 * p, f1: 250 * p, att: 0.0008, dur: 0.14 * T, gain: 0.47 * k });          // crunch
        t({ f: Math.max(60, 120 * p), f1: 50, dur: 0.18 * T, gain: 0.32 * k });                                // thud
        t({ type: 'triangle', f: Math.max(120, 220 * p), f1: 90, dur: 0.1 * T, gain: 0.12 * k, lp: 900 });     // (heard on a phone)
        if (!lite) for (let i = 0; i < 4; i++) n({ at: (0.005 + rnd() * 0.1) * T, type: 'highpass', f: 2500 * p2, att: 0.0004, dur: 0.008 * T, gain: 0.08 * k }); // grit
        n({ at: 0.03 * T, type: 'bandpass', f: 1800 * p2, q: 0.8, att: 0.05 * T, dur: 0.35 * T, gain: 0.05 * k }); // dust trickling down
      }
      break;
    }
    case 'enter': {
      kcCutWhoosh(S, now + at);
      const head = o.part === 'head';
      // the player's own kill confirm, slowed: the same hit heard in the scope, a fifth down
      const cb = X.get('confirm:' + (head ? 'head' : 'body') + ':0', () => SG.confirm(head ? 'head' : 'body', 1));
      X.kcKeep(S, X.play(cb, { at, dest: S.out, rate: Math.max(0.62, p), hp: 110, gain: 1.3 * k, verb: 0.35, vbus: X.kcVerb }));
      n({ type: 'bandpass', f: (head ? 2100 : 1500) * p2, q: 1.1, att: 0.0005, dur: 0.035 * T, gain: (head ? 0.5 : 0.46) * k }); // the slap of skin
      n({ type: 'lowpass', f: 1100 * p, f1: 140, att: 0.001, dur: 0.14 * T, gain: (head ? 0.34 : 0.44) * k });                  // the punch
      t({ f: Math.max(46, 105 * p), f1: 34, dur: 0.3 * T, gain: 0.2 * k });                                                     // deep impact
      t({ type: 'triangle', f: Math.max(120, 230 * p), f1: 90, dur: 0.16 * T, gain: 0.28 * k, lp: 1000 });                     // (heard on a phone)
      n({ type: 'bandpass', f: 520 * p2, f1: 240 * p2, q: 1.1, att: 0.002, dur: 0.24 * T, gain: 0.38 * k });                    // the body taking it
      if (wet > 0) {
        n({ at: 0.004, type: 'bandpass', f: 1100 * p2, f1: 320 * p2, sweep: 0.12 * T, q: 4.5, att: 0.002, dur: 0.16 * T, gain: 0.26 * k * wet }); // squelch
        if (!lite) n({ at: 0.04 * T, type: 'bandpass', f: 700 * p2, f1: 250 * p2, q: 5, att: 0.003, dur: 0.12 * T, gain: 0.15 * k * wet });
        n({ at: 0.01, type: 'bandpass', f: 2600 * p2, f1: 1400 * p2, q: 0.9, att: 0.006, dur: 0.22 * T, gain: 0.07 * k * wet }); // blood blown back out of the hole
      }
      kcTear(S, P, k, wet, at);
      break;
    }
    case 'bone': {
      const b = o.bone || 'rib';
      if (b === 'skull') {
        n({ type: 'highpass', f: 3800 * p2, att: 0.0003, dur: 0.012 * T, gain: 0.46 * k });                   // crack
        n({ type: 'bandpass', f: 1050 * p2, q: 7, att: 0.0005, dur: 0.06 * T, gain: 0.36 * k });              // the hollow "tock" of the skull
        if (!lite) [0.012, 0.027, 0.045].forEach((d, i) => n({ at: d * T, type: 'highpass', f: 2600 * p2, att: 0.0003, dur: 0.008 * T, gain: (0.17 - i * 0.03) * k })); // it gives way in pieces
        t({ f: Math.max(120, 300 * p), f1: Math.max(70, 120 * p), dur: 0.08 * T, gain: 0.22 * k });
      } else if (b === 'spine') {
        n({ type: 'bandpass', f: 1700 * p2, q: 2, att: 0.0005, dur: 0.025 * T, gain: 0.44 * k });
        if (!lite) [0.02, 0.05].forEach((d) => n({ at: d * T, type: 'highpass', f: 2200 * p2, att: 0.0004, dur: 0.01 * T, gain: 0.15 * k }));
        t({ f: Math.max(60, 160 * p), f1: 45, dur: 0.15 * T, gain: 0.22 * k });
        t({ type: 'triangle', f: Math.max(110, 260 * p), f1: 90, dur: 0.08 * T, gain: 0.12 * k, lp: 1000 });
      } else if (b === 'limb') {
        n({ type: 'bandpass', f: 2000 * p2, q: 3, att: 0.0005, dur: 0.02 * T, gain: 0.38 * k });
        t({ f: Math.max(120, 350 * p), f1: Math.max(80, 160 * p), dur: 0.06 * T, gain: 0.16 * k });
      } else { // ribs: a crunchy little run of cracks
        [0, 0.018, 0.04].forEach((d, i) => { if (!lite || i === 0) n({ at: d * T, type: 'bandpass', f: (2400 - i * 250) * p2, q: 2.5, att: 0.0004, dur: 0.015 * T, gain: [0.34, 0.24, 0.17][i] * k }); });
        t({ f: Math.max(140, 420 * p), f1: Math.max(90, 200 * p), dur: 0.04 * T, gain: 0.13 * k });
      }
      if (wet > 0 && !lite) n({ at: 0.01 * T, type: 'bandpass', f: 800 * p2, q: 3, att: 0.002, dur: 0.06 * T, gain: 0.1 * k * wet }); // wet crunch
      break;
    }
    case 'organ': {
      // only with gore on: the film does not send it otherwise
      if (!gore) break;
      const id = o.organ || 'gut', key = !!o.key, g = k * (key ? 1.2 : 0.75);
      if (id === 'heart') {
        t({ f: Math.max(40, 82 * p), f1: 30, att: 0.004, dur: 0.55 * T, gain: 0.26 * g });                    // it bursts: a deep thump
        t({ type: 'triangle', f: Math.max(110, 170 * p), f1: 80, dur: 0.28 * T, gain: 0.24 * g, lp: 1000 });
        n({ type: 'bandpass', f: 650 * p2, f1: 210 * p2, sweep: 0.2 * T, q: 3.2, att: 0.004, dur: 0.35 * T, gain: 0.3 * g }); // the squelch
        n({ at: 0.03 * T, type: 'lowpass', f: 900 * p, f1: 180, att: 0.01, dur: 0.4 * T, gain: 0.16 * g, brown: true });
        kcHeartStop(S, now + at + 0.04);                                                                       // and the heartbeat stops
      } else if (id === 'lungL' || id === 'lungR') { // air forced out, wet
        n({ type: 'bandpass', f: 1300 * p2, f1: 520 * p2, sweep: 0.3 * T, q: 1.5, att: 0.015, dur: 0.5 * T, gain: 0.15 * g, verb: 0.3 });
        n({ type: 'bandpass', f: 820 * p2, q: 4, att: 0.003, dur: 0.12 * T, gain: 0.18 * g });
      } else if (id === 'brain') { // a wet crunch
        n({ type: 'bandpass', f: 1500 * p2, q: 3, att: 0.0008, dur: 0.05 * T, gain: 0.24 * g });
        n({ at: 0.006, type: 'bandpass', f: 900 * p2, f1: 300 * p2, q: 4, att: 0.003, dur: 0.22 * T, gain: 0.26 * g });
      } else if (id === 'liver') { // dense and heavy
        n({ type: 'bandpass', f: 380 * p2, f1: 160 * p2, q: 4, att: 0.003, dur: 0.3 * T, gain: 0.32 * g });
        t({ f: Math.max(50, 120 * p), f1: 45, dur: 0.18 * T, gain: 0.16 * g });
      } else { // stomach, gut, kidneys: a wet burble
        n({ type: 'bandpass', f: 760 * p2, f1: 260 * p2, q: 4, att: 0.003, dur: 0.24 * T, gain: 0.26 * g });
        if (!lite) for (let i = 0; i < 3; i++) n({ at: (0.05 + rnd() * 0.25) * T, type: 'bandpass', f: (500 + rnd() * 500) * p2, q: 6, att: 0.002, dur: 0.05 * T, gain: 0.08 * g });
      }
      if (key) { t({ f: Math.max(34, 58 * p), f1: 26, att: 0.01, dur: 0.7 * T, gain: 0.14 * k, verb: 0.5 }); n({ type: 'bandpass', f: 260, f1: 150, q: 0.9, att: 0.01, dur: 0.6 * T, gain: 0.2 * k, verb: 0.6 }); } // the moment the film names it
      break;
    }
    case 'exit': {
      const sz = clamp(o.size === undefined ? 0.6 : +o.size, 0, 1);
      kcStopTear(S, now + at);
      t({ f: Math.max(60, 150 * p), f1: 45, dur: 0.1 * T, gain: (0.3 + 0.22 * sz) * k });                      // the round breaking out
      n({ type: 'bandpass', f: 900 * p2, f1: 400 * p2, q: 1, att: 0.002, dur: 0.12 * T, gain: (0.22 + 0.2 * sz) * k });  // a punch out of the far side
      t({ type: 'triangle', f: Math.max(110, 260 * p), f1: 90, dur: 0.07 * T, gain: (0.08 + 0.06 * sz) * k, lp: 900 });
      n({ type: 'bandpass', f: 1800 * p2, f1: 900 * p2, q: 0.7, att: 0.01 * T, dur: (0.25 + 0.35 * sz) * T, gain: (0.12 + 0.18 * sz) * k * (0.5 + 0.5 * (wet || 0.4)), verb: 0.25 }); // the spray, a hiss
      if (wet > 0) {
        n({ type: 'bandpass', f: 700 * p2, f1: 300 * p2, q: 3, att: 0.003, dur: 0.2 * T, gain: (0.16 + 0.12 * sz) * k * wet }); // wet burst
        const nd = lite ? 2 : 3 + Math.round(7 * sz * wet);
        for (let i = 0; i < nd; i++) n({ at: (0.15 + rnd() * 0.85) * T, type: 'bandpass', f: (1400 + rnd() * 2000) * p2, q: 6, att: 0.0008, dur: 0.012 * T, gain: (0.03 + rnd() * 0.035) * k }); // drops landing
      } else n({ type: 'lowpass', f: 1200 * p, att: 0.004, dur: 0.2 * T, gain: 0.13 * k });               // a dry puff
      break;
    }
    case 'resume': {
      // time rushing back: a rise in pitch and a swell over about a second, the ringing gone
      kcRingStop(S, now);
      if (S.hb) S.hb.period = 0.85;
      n({ type: 'bandpass', f: 200, f1: 3600, sweep: 1.0, q: 1.0, att: 0.85, dur: 0.12, gain: 0.2 });
      t({ f: 34, f1: 82, sweep: 0.9, att: 0.8, dur: 0.15, gain: 0.12 });
      t({ type: 'triangle', f: 90, f1: 220, sweep: 0.9, att: 0.8, dur: 0.12, gain: 0.1, lp: 1000 });
      break;
    }
    case 'fall': {
      const m = o.mat || 'dirt';
      const body = (a, s) => {
        t({ at: a, f: Math.max(40, 95 * p), f1: 34, dur: 0.22 * T * s, gain: 0.44 * kk * s });
        t({ at: a, type: 'triangle', f: Math.max(100, 190 * p), f1: 70, dur: 0.12 * T * s, gain: 0.17 * kk * s, lp: 800 });
        n({ at: a, type: 'lowpass', f: 700 * p, f1: 140, att: 0.002, dur: 0.16 * T * s, gain: 0.38 * kk * s });
      };
      body(0, 1); if (!lite) body(0.13 * T, 0.55); // then a smaller bump as the limbs and head come down
      if (m === 'water') {
        n({ type: 'bandpass', f: 1400 * p2, f1: 450 * p2, q: 0.9, att: 0.02 * T, dur: 0.45 * T, gain: 0.3 * kk, verb: 0.3 });
        t({ f: Math.max(60, 120 * p), f1: 50, dur: 0.2 * T, gain: 0.12 * kk });
      } else if (m === 'snow') {
        n({ type: 'lowpass', f: 2200 * p2, f1: 600 * p2, att: 0.003, dur: 0.12 * T, gain: 0.18 * kk });
        if (!lite) for (let i = 0; i < 3; i++) n({ at: rnd() * 0.08 * T, type: 'highpass', f: 1800 * p2, att: 0.0005, dur: 0.008 * T, gain: 0.04 * kk });
      } else if (m === 'wood') {
        t({ f: Math.max(110, 190 * p), dur: 0.12 * T, gain: 0.12 * kk }); t({ f: Math.max(160, 290 * p), dur: 0.09 * T, gain: 0.08 * kk });
        n({ type: 'bandpass', f: 900 * p2, q: 1.2, att: 0.0006, dur: 0.025 * T, gain: 0.16 * kk });
      } else if (m === 'metal') {
        n({ type: 'bandpass', f: 1300 * p2, q: 1, att: 0.0006, dur: 0.03 * T, gain: 0.2 * kk });
        t({ f: 380 * p, dur: 0.4 * T, gain: 0.07 * kk, verb: 0.4 }); t({ f: 1030 * p, dur: 0.3 * T, gain: 0.04 * kk, verb: 0.4 });
      } else if (m === 'hard' || m === 'wall' || m === 'concrete' || m === 'stone') {
        n({ type: 'bandpass', f: 1300 * p2, q: 1, att: 0.0006, dur: 0.03 * T, gain: 0.22 * kk, verb: 0.2 });   // a flat slap on stone
      } else { // dirt, grass and anything soft: a dusty thump with a little grit
        n({ type: 'lowpass', f: 1100 * p, f1: 250 * p, att: 0.002, dur: 0.18 * T, gain: 0.2 * kk });
        if (!lite) for (let i = 0; i < 3; i++) n({ at: rnd() * 0.1 * T, type: 'bandpass', f: 2200 * p2, q: 3, att: 0.0005, dur: 0.01 * T, gain: 0.03 * kk });
      }
      break;
    }
    default: break;
  }
};

// ---- ambience and music ----------------------------------------------------------
Sfx.stopBeds = function () {
  const X = Sfx; if (!X.ok) return;
  (X.beds || []).forEach((b) => { try { b.g.gain.setTargetAtTime(0, X.ac.currentTime, 0.3); b.src.stop(X.ac.currentTime + 1.2); } catch (e) { /* already stopped */ } });
  X.beds = [];
};
Sfx.bed = function (o) { // a continuous layer of filtered noise (wide: a different stream in each ear) or a held tone
  const X = Sfx, ac = X.ac, t = ac.currentTime;
  let src;
  if (o.osc) { src = ac.createOscillator(); src.type = o.osc; src.frequency.value = o.f; if (o.detune) src.detune.value = o.detune; }
  else { src = ac.createBufferSource(); src.buffer = o.brown ? X.brown : X.white; src.loop = true; }
  const f = ac.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.value = o.cut || o.f || 800; f.Q.value = o.q || 0.7;
  const g = ac.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(o.gain, t, 0.8);
  src.connect(f); f.connect(g); g.connect(o.dest || X.ambG);
  if (o.lfo) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = o.lfo; lg.gain.value = o.lfoAmt || o.gain * 0.5; l.connect(lg); lg.connect(o.lfoCut ? f.frequency : g.gain); if (o.lfoCut) lg.gain.value = o.lfoCut; l.start(t); }
  src.start(t, o.osc ? undefined : Math.random() * 1.5);
  const b = { src, g, f, base: o.gain, tag: o.tag }; X.beds.push(b); return b;
};
// mode: 'menu' | 'mission' | 'off'.  amb: city | harbour | wild | snow, plus weather
Sfx.setMode = function (mode, amb) {
  const X = Sfx;
  if (!X.ok) { X.pendingMode = { mode, amb }; return; }
  X.kcClose(false); X.stopBeds(); X.mode = mode; X.amb = amb || null; X.nextBeat = X.ac.currentTime + 0.3; X.beat = 0; X.events = [];
  if (mode === 'off') return;
  // music: a low detuned drone that the rest sits on
  X.bed({ osc: 'sawtooth', f: 55, cut: 170, q: 1.2, gain: 0.11, dest: X.mus, lfo: 0.06, lfoCut: 70 });
  X.bed({ osc: 'sawtooth', f: 55, detune: 9, cut: 150, gain: 0.09, dest: X.mus });
  X.bed({ osc: 'sine', f: 110, cut: 400, gain: 0.03, dest: X.mus, lfo: 0.11 });
  if (mode !== 'mission') return;
  const a = amb || {};
  X.verb = a.kind === 'city' ? X.verbCity : X.verbOpen;
  if (a.kind === 'city') { X.bed({ brown: true, cut: 190, gain: 0.3 }); X.bed({ type: 'bandpass', cut: 900, q: 0.3, gain: 0.012, lfo: 0.07, lfoAmt: 0.005 }); if (a.night) X.bed({ osc: 'sine', f: 120, cut: 300, gain: 0.006 }); }
  else if (a.kind === 'harbour') { X.bed({ brown: true, cut: 380, gain: 0.26, lfo: 0.19, lfoAmt: 0.12 }); X.bed({ type: 'bandpass', cut: 1400, q: 0.5, gain: 0.02, lfo: 0.23, lfoAmt: 0.014 }); X.bed({ type: 'bandpass', cut: 620, q: 1.4, gain: 0.03, lfo: 0.41, lfoAmt: 0.025 }); }
  else if (a.kind === 'snow') { X.bed({ type: 'bandpass', cut: 420, q: 3.2, gain: 0.07, lfo: 0.13, lfoCut: 160 }); X.bed({ brown: true, cut: 260, gain: 0.2, lfo: 0.09, lfoAmt: 0.1 }); }
  else { X.bed({ brown: true, cut: 300, gain: 0.14, lfo: 0.08, lfoAmt: 0.06 }); X.bed({ type: 'bandpass', cut: 3200, q: 0.6, gain: 0.006, lfo: 0.05, lfoAmt: 0.003 }); }
  X.windBed = X.bed({ type: 'bandpass', cut: 520, q: 1.6, gain: 0.0, lfo: 0.21, lfoCut: 180, tag: 'wind' });
  // rain: a soft wash that swells and fades, a low patter on the roofs, and (in tick) the single drops you can pick out
  if (a.rain) { X.bed({ type: 'bandpass', cut: 5200, q: 0.5, gain: 0.024, lfo: 0.17, lfoAmt: 0.009 }); X.bed({ type: 'bandpass', cut: 2300, q: 0.8, gain: 0.014, lfo: 0.31, lfoAmt: 0.006 }); X.bed({ brown: true, cut: 520, gain: 0.07, lfo: 0.11, lfoAmt: 0.03 }); X.dripT = 0.2; }
  X.stormT = a.storm ? 6 + Math.random() * 8 : 0;
};
Sfx.missionStart = function (sim) {
  const S = sim.S;
  Sfx.tension = 0.25; Sfx.simRef = sim;
  Sfx.setMode('mission', { kind: S.ambience, night: S.pal.dark > 0.5, rain: S.weather === 'rain' || S.weather === 'storm', storm: S.weather === 'storm', snow: S.weather === 'snow' });
  Sfx.prepare(sim);
};
Sfx.missionEnd = function () { Sfx.kcClose(false); Sfx.simRef = null; Sfx.jobs = []; };
Sfx.menu = function () { if (Sfx.mode !== 'menu') Sfx.setMode('menu'); Sfx.tension = 0.1; };

const SCALE = [220, 261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3];
const CHORDS = [[110, 164.8, 261.6], [87.3, 174.6, 261.6], [73.4, 146.8, 220], [82.4, 164.8, 246.9], [110, 164.8, 220], [98, 146.8, 233.1]];
Sfx.musicBeat = function (t0) {
  const X = Sfx, beat = X.beat++, ten = X.tension, menu = X.mode === 'menu';
  const at = Math.max(0, t0 - X.ac.currentTime);
  if (beat % 8 === 0) { // pad chord, slow swell
    const ch = CHORDS[Math.floor(beat / 8) % CHORDS.length];
    ch.forEach((f) => Sfx.tone({ at, f, type: 'triangle', dur: 7.5, att: 2.2, gain: 0.03 + 0.012 * ten, lp: 900, dest: X.mus, verb: 0.5 }));
  }
  if (ten > 0.3 || menu) { // pulse
    Sfx.tone({ at, f: 49, f1: 38, dur: 0.16, gain: menu ? 0.08 : 0.07 + 0.1 * ten, dest: X.mus });
    Sfx.tone({ at, type: 'triangle', f: 98, f1: 76, dur: 0.1, gain: (menu ? 0.03 : 0.025 + 0.03 * ten), lp: 500, dest: X.mus });
    if (ten > 0.6) Sfx.tone({ at: at + 0.5 * X.beatLen, f: 49, f1: 38, dur: 0.12, gain: 0.05 + 0.08 * ten, dest: X.mus });
  }
  if (Math.random() < (menu ? 0.5 : 0.22 + 0.2 * ten)) { // a sparse bell note
    const f = SCALE[Math.floor(Math.random() * SCALE.length)] * (Math.random() < 0.3 ? 2 : 1);
    Sfx.tone({ at: at + (Math.random() < 0.5 ? 0 : X.beatLen / 2), f, dur: 1.6, gain: 0.035, dest: X.mus, verb: 0.9 });
    Sfx.tone({ at: at + (Math.random() < 0.5 ? 0 : X.beatLen / 2), f: f * 2.01, dur: 0.5, gain: 0.012, dest: X.mus });
  }
  if (ten > 0.7) { // nervous high strings
    Sfx.tone({ at, type: 'sawtooth', f: beat % 2 ? 659.3 : 698.5, dur: X.beatLen * 0.95, att: 0.06, gain: 0.018 * ten, lp: 2200, dest: X.mus, verb: 0.6 });
  }
};
Sfx.tick = function (sim, dt, scale) {
  const X = Sfx; if (!X.ok) return;
  const ac = X.ac, sh = sim.sh;
  // tension follows the mission
  let want = 0.3;
  if (sim.alarmT !== null) want = 1; else if (sim.rules.time && sim.rules.time - sim.t < 20) want = 0.85; else if (sh.holding) want = 0.6; else if (sim.stats.shots > 0) want = 0.5;
  X.tension += (want - X.tension) * Math.min(1, dt * 0.8);
  // slow motion muffles the world (but just after the kill camera everything snaps back crisp)
  if (ac.currentTime < X.snapUntil) X.lp.frequency.setTargetAtTime(19000, ac.currentTime, 0.02);
  else X.lp.frequency.setTargetAtTime(scale < 0.8 ? 1500 + 17000 * Math.pow(scale, 2) : 19000, ac.currentTime, 0.08);
  X.kcTick(scale);
  if (X.windBed) X.windBed.g.gain.setTargetAtTime(clamp(Math.abs(sim.wind()) * 0.012 + (sim.S.weather === 'snow' ? 0.03 : 0), 0, 0.14), ac.currentTime, 0.5);
  // heartbeat while holding breath
  if (sh.holding) { X.heartT -= dt; if (X.heartT <= 0) { const low = 1 - sh.breath / sim.st.breath; X.heart(0.5 + low * 0.7); X.heartT = 0.95 - low * 0.4; } } else X.heartT = 0.2;
  // rain you can hear as drops: each one a tiny rising "plip", a few of them heavier plops
  if (X.amb && X.amb.rain) {
    X.dripT -= dt; let n = 0;
    while (X.dripT <= 0 && n++ < 4) {
      X.dripT += -Math.log(1 - Math.random() * 0.98) * 0.075; // about thirteen a second, unevenly
      const r = Math.random(), at = Math.random() * 0.05;
      if (r < 0.12) { const f = 330 + Math.random() * 260; Sfx.tone({ at, f, f1: f * 1.9, sweep: 0.05, dur: 0.07, att: 0.002, gain: 0.012 + Math.random() * 0.014, verb: 0.35 }); }
      else if (r < 0.3) Sfx.noise({ at, type: 'bandpass', f: 2600 + Math.random() * 3200, q: 5, dur: 0.018, gain: 0.02 + Math.random() * 0.03 });
      else { const f = 900 + Math.random() * 1900; Sfx.tone({ at, f, f1: f * (1.5 + Math.random() * 0.6), sweep: 0.022, dur: 0.03, att: 0.0015, gain: 0.004 + Math.random() * 0.011, verb: 0.25 }); }
    }
  }
  // a storm: thunder rolling somewhere far off now and then (the close strikes come from the mission)
  if (X.amb && X.amb.storm && scale > 0.8) { X.stormT -= dt; if (X.stormT <= 0) { X.stormT = 9 + Math.random() * 12; X.thunder(0, true); } }
  // occasional background life
  X.lifeT = (X.lifeT || 3) - dt;
  if (X.lifeT <= 0 && X.amb) {
    X.lifeT = 5 + Math.random() * 10; const a = X.amb, r = Math.random();
    if (a.kind === 'city') { if (r < 0.5) Sfx.horn(300 + Math.random() * 90, 0.3 + Math.random() * 0.4, 0, 0.018); else if (r < 0.65) { for (let i = 0; i < 6; i++) Sfx.tone({ at: i * 0.5, type: 'sine', f: i % 2 ? 700 : 900, dur: 0.45, att: 0.1, gain: 0.006, verb: 0.9 }); } else if (r < 0.8) { Sfx.tone({ f: 380, f1: 300, dur: 0.1, gain: 0.02, type: 'sawtooth', lp: 900, verb: 0.8 }); Sfx.tone({ at: 0.25, f: 390, f1: 300, dur: 0.1, gain: 0.02, type: 'sawtooth', lp: 900, verb: 0.8 }); } }
    else if (a.kind === 'harbour') { if (r < 0.45 && !a.night) { for (let i = 0; i < 3; i++) Sfx.tone({ at: i * 0.32, type: 'sawtooth', f: 1500, f1: 950, dur: 0.24, att: 0.03, gain: 0.014, lp: 2600, verb: 0.7 }); } else if (r < 0.7) Sfx.bell(500, 0, 780); else if (r < 0.8) Sfx.horn(98, 1.8, 0, 0.03); }
    else if (a.kind === 'wild' && !a.snow) { if (a.night) { for (let i = 0; i < 9; i++) Sfx.tone({ at: i * 0.075, f: 4300, dur: 0.035, gain: 0.008 }); } else if (r < 0.7) { const f = 2200 + Math.random() * 1800; for (let i = 0; i < 3; i++) Sfx.tone({ at: i * 0.13, f, f1: f * 1.3, dur: 0.08, gain: 0.012, verb: 0.5 }); } }
  }
  X.pump();
};
Sfx.pump = function () { // keep the music scheduled a little ahead
  const X = Sfx; if (!X.ok || X.mode === 'off') return;
  X.beatLen = X.mode === 'menu' ? 1.25 : 1.1 - 0.25 * X.tension;
  let guard = 0;
  while (X.nextBeat < X.ac.currentTime + 0.25 && guard++ < 4) { if (X.nextBeat < X.ac.currentTime - 0.5) X.nextBeat = X.ac.currentTime; X.musicBeat(X.nextBeat); X.nextBeat += X.beatLen; }
};

// ---- wiring: simulation events to sounds ---------------------------------------------
Sfx.onEvent = function (e, sim) {
  const X = Sfx; if (!X.ok) return;
  const sc = Math.max(0.25, Game.scale || 1);
  const back = (d) => (d / SOUND) / sc; // time for the sound to travel back to you
  const Z = sim.S.refZ, here = (b, gain, verb) => X.playFar(b, Z, back(Z), gain, verb);
  switch (e.k) {
    case 'fire': X.shot(e, sim); break;
    case 'dry': X.dry(); break;
    case 'reload': X.reload(e.dur, e.action); break;
    case 'charge': X.play(X.get('charge:' + (+e.dur).toFixed(2), () => SG.charge(+e.dur || 0.85))); break;
    case 'breath': X.breath(e.on, e.gasp); break;
    case 'click': X.ui('tick'); break;
    case 'impact': X.impact(e.mat === 'interior' ? 'wood' : e.mat, e.dist, back(e.dist)); break;
    case 'hit': if (!(X.kcS && X.kcS.on)) X.hit(e, back(e.dist), Save.data.settings.gore !== false); break; // the kill camera makes its own
    case 'vest': X.vest(Z, back(Z)); break;
    case 'glass': X.glass(Z, back(Z)); break;
    case 'objhit': X.impact('metal', e.dist, back(e.dist)); break;
    case 'boom': X.boom(Z, back(Z)); break;
    case 'crash': here(X.get('crash:' + (e.kind === 'piano' ? 'p' : 'c'), () => SG.crash(e.kind === 'piano', 1)), 1.3, 0.5); break;
    case 'snap': here(X.get('snap', () => SG.snap()), 1.2); break;
    case 'scream': case 'bodyfound': X.voice(Z, back(Z)); break;
    case 'spotted': // a sting: a low hit and a tense stab
      Sfx.tone({ type: 'sawtooth', f: 311, dur: 0.5, att: 0.02, gain: 0.045, lp: 1600, dest: X.mus, verb: 0.6 }); Sfx.tone({ type: 'sawtooth', f: 330, dur: 0.5, att: 0.02, gain: 0.045, lp: 1600, dest: X.mus, verb: 0.6 });
      Sfx.tone({ f: 65, f1: 42, dur: 0.4, gain: 0.25, dest: X.mus }); Sfx.noise({ type: 'bandpass', f: 400, f1: 3000, sweep: 0.3, q: 1.5, att: 0.25, dur: 0.06, gain: 0.05, dest: X.mus });
      break;
    case 'alarm': X.siren(back(Z)); break;
    case 'lampout': case 'zap': case 'spark': here(X.get('zap:' + ((Math.random() * 2) | 0), () => SG.zap(1 + ((Math.random() * 2) | 0))), 1.3, 0.3); if (e.k === 'lampout') X.glass(Z * 1.4, back(Z)); break;
    case 'ring': // a steel target on the range pings; a real bell or horn rings
      if (sim.M && sim.M.range !== undefined && e.kind === 'bell') { const v = (Math.random() * 2) | 0; X.playFar(X.get('plate:' + v, () => SG.plate(v + 1)), Z, back(Z), 1.3, 0.3); } else X.bell(Z, back(Z), e.kind === 'horn' ? 300 : 560);
      break;
    case 'smash': X.glass(Z, back(Z)); break;
    case 'clank': X.impact('metal', Z, back(Z)); break;
    case 'tyre': here(X.get('tyre', () => SG.tyre()), 1.3, 0.3); break;
    case 'steam': here(X.get('steam', () => SG.steam(5)), 1.2, 0.2); break;
    case 'npcshot': here(X.get('npcshot:' + (X.loc || 'valley'), () => SG.npcShot(X.loc || 'valley', 3)), 0.85, 0.4); break;
    case 'duck': Sfx.tone({ at: back(Z), f: 1100, f1: 1900, dur: 0.09, gain: 0.12, type: 'square', lp: 3000 }); Sfx.tone({ at: back(Z) + 0.1, f: 1900, f1: 900, dur: 0.14, gain: 0.1, type: 'square', lp: 3000 }); X.ui('star'); break;
    case 'msg': if (e.who !== 'hint') X.ui('radio'); break;
    case 'flare': here(X.get('flare', () => SG.flare(5)), 1.2, 0.2); break;
    case 'cover': {
      const n = e.name;
      if (n === 'thunder') X.thunder(0.35);
      else if (n === 'train') X.train(e.dur + 1.5);
      else if (n === 'fireworks') X.fireworks(e.dur);
      else if (n === 'jackhammer' || n === 'drill') X.rattle(e.dur);
      else if (n === 'ship horn') X.horn(92, e.dur, 0, 0.2);
      else if (n === 'church bells') { for (let t = 0; t < e.dur && t < 60; t += 1.3) X.bell(130, t, 300); }
      else if (n === 'helicopter') X.heli(e.dur + 1);
      else if (n === 'jet') X.jet(e.dur + 1);
      else if (n === 'car alarm') { for (let t = 0; t < e.dur; t += 0.5) { Sfx.tone({ at: t, type: 'square', f: 1400, f1: 900, dur: 0.24, gain: 0.03, lp: 2600, verb: 0.6 }); Sfx.tone({ at: t + 0.25, type: 'square', f: 1000, f1: 1500, dur: 0.22, gain: 0.025, lp: 2600, verb: 0.6 }); } }
      else if (n === 'blasting') { const loc = X.loc || 'valley'; for (let t = 0.2; t < e.dur; t += 1.4 + Math.random()) X.play(X.get('boom:' + loc + ':0', () => SG.boom(loc, 1)), { at: t, gain: 0.55, lp: 1800, rate: 0.85 + Math.random() * 0.2 }); }
      else if (n === 'generator') { Sfx.noise({ type: 'lowpass', f: 240, dur: e.dur, att: 0.3, gain: 0.22, brown: true }); for (let t = 0; t < Math.min(e.dur, 40); t += 0.11) Sfx.tone({ at: t, f: 74, dur: 0.06, gain: 0.07 }); }
      else if (n === 'test shot') { Sfx.tone({ type: 'sawtooth', f: 200, f1: 2600, dur: Math.max(0.6, e.dur * 0.6), att: e.dur * 0.5, gain: 0.08, lp: 3000 }); X.thunder(e.dur * 0.62); }
      else if (n === 'band' || n === 'music') { for (let t = 0; t < e.dur; t += 0.5) { Sfx.tone({ at: t, f: 60, f1: 42, dur: 0.14, gain: 0.3 }); if ((t * 2) % 2 >= 1) Sfx.noise({ at: t, type: 'highpass', f: 2000, dur: 0.08, gain: 0.12 }); } }
      break;
    }
    default: break;
  }
};
