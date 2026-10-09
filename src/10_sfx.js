// ---------------------------------------------------------------------------
// Sound. Everything is generated in code with the Web Audio API: there are no
// audio files. Gunshots are built from layers (a sharp crack, a chest thump,
// a filtered body and an echo tail) and every calibre has its own recipe.
//
// How the sound is wired, from the sources to the speaker:
//   sfx, music, ambience -> master -> lp (the slow motion muffle) -> glue
//   near (kill confirm and kill camera, never muffled)            -> glue
//   glue (a gentle compressor) -> limiter -> safety clipper -> speaker
// The limiter holds loud moments under full scale and the safety clipper
// rounds off anything that still gets through, so stacked sounds never clip.
// ---------------------------------------------------------------------------
const Sfx = CB.Sfx = { ac: null, ok: false, tension: 0, mode: 'off', amb: null, nextBeat: 0, beat: 0, events: [], ducked: false, heartT: 0, kcS: null, snapUntil: 0 };

// crack = high snap, boom = low punch, bf = thump pitch (Hz), len = body
// length (s), tail = echo amount, p = overall pitch
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
};
// Build the whole sound system on an audio context. The game passes its live one; the
// sound test (test/sfx.js) passes an offline one so it can record the sounds to files.
// opt.raw leaves out the limiter and the safety clipper, so a test can see what they catch.
Sfx.build = function (ac, opt) {
  const X = Sfx; opt = opt || {};
  X.ac = ac; X.ok = false; X.kcS = null; X.snapUntil = 0; X.beds = [];
  X.comp = ac.createDynamicsCompressor(); X.comp.threshold.value = -14; X.comp.knee.value = 12; X.comp.ratio.value = 6; X.comp.attack.value = 0.002; X.comp.release.value = 0.2;
  // the limiter: a fast, hard compressor just under full scale
  X.lim = ac.createDynamicsCompressor(); X.lim.threshold.value = -3; X.lim.knee.value = 0; X.lim.ratio.value = 20; X.lim.attack.value = 0.001; X.lim.release.value = 0.12;
  // the safety clipper: straight through up to 0.8, then rounds off smoothly so nothing passes 0.99.
  // A wave shaper only reads inputs between -1 and 1, so the signal is scaled down by 4 going in
  // and the curve is drawn for four times the range.
  X.clipIn = ac.createGain(); X.clipIn.gain.value = 0.25;
  X.clip = ac.createWaveShaper();
  const n = 4097, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = ((i / (n - 1)) * 2 - 1) * 4, a = Math.abs(x); curve[i] = Math.sign(x) * (a <= 0.8 ? a : 0.8 + 0.19 * Math.tanh((a - 0.8) / 0.19)); }
  X.clip.curve = curve;
  if (opt.raw) X.comp.connect(ac.destination);
  else { X.comp.connect(X.lim); X.lim.connect(X.clipIn); X.clipIn.connect(X.clip); X.clip.connect(ac.destination); }
  X.lp = ac.createBiquadFilter(); X.lp.type = 'lowpass'; X.lp.frequency.value = 19000;
  X.master = ac.createGain(); X.master.gain.value = 0.9;
  X.master.connect(X.lp); X.lp.connect(X.comp);
  X.sfx = ac.createGain(); X.mus = ac.createGain(); X.ambG = ac.createGain();
  X.sfx.connect(X.master); X.mus.connect(X.master); X.ambG.connect(X.master);
  // the near bus: sounds that happen "to you" (the kill confirm, the kill camera) skip the muffle
  X.near = ac.createGain(); X.near.connect(X.comp);
  // noise sources
  const mk = (secs, brown) => { const b = ac.createBuffer(1, Math.floor(ac.sampleRate * secs), ac.sampleRate), d = b.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; } return b; };
  X.white = mk(2, false); X.brown = mk(3, true);
  // a slow, uneven wobble between 0.15 and 1, held in little steps: it roughens the tearing sound in the kill camera
  { const sr = ac.sampleRate, b = ac.createBuffer(1, Math.floor(sr * 2), sr), d = b.getChannelData(0); let v = 0.5, goal = 1, left = 0;
    for (let i = 0; i < d.length; i++) { if (left-- <= 0) { goal = 0.15 + Math.random() * 0.85; left = Math.floor(sr * (0.018 + Math.random() * 0.05)); } v += (goal - v) * 0.004; d[i] = v; }
    X.rough = b; }
  // echo spaces: a city bounces sound back in slaps, open country rolls
  const ir = (secs, slaps, dark) => { const b = ac.createBuffer(2, Math.floor(ac.sampleRate * secs), ac.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < d.length; i++) { const t = i / d.length; let v = (Math.random() * 2 - 1) * Math.pow(1 - t, dark ? 2.4 : 3.4); lp += (v - lp) * (dark ? 0.12 + 0.3 * (1 - t) : 0.5); d[i] = lp; } for (let s = 0; s < slaps; s++) { const at = Math.floor((0.05 + Math.random() * 0.4) * ac.sampleRate), len = Math.floor(0.03 * ac.sampleRate), g = 0.9 - s * 0.12; for (let i = 0; i < len && at + i < d.length; i++) d[at + i] += (Math.random() * 2 - 1) * g * (1 - i / len); } } return b; };
  X.verbCity = ac.createConvolver(); X.verbCity.buffer = ir(1.7, 5, false);
  X.verbOpen = ac.createConvolver(); X.verbOpen.buffer = ir(3.4, 1, true);
  X.verbG = ac.createGain(); X.verbG.gain.value = 0.5; X.verbCity.connect(X.verbG); X.verbOpen.connect(X.verbG); X.verbG.connect(X.sfx);
  X.verb = X.verbCity;
  // the kill camera's own space: big and dark, so slowed impacts bloom
  X.kcVerb = ac.createConvolver(); X.kcVerb.buffer = ir(2.2, 0, true);
  X.kcVerbG = ac.createGain(); X.kcVerbG.gain.value = 0.45; X.kcVerb.connect(X.kcVerbG); X.kcVerbG.connect(X.near);
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

// ---- building blocks -----------------------------------------------------------
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

// ---- the rifle ---------------------------------------------------------------
// Which suppressor is fitted. 'light' = Featherweight, 'heavy' = Monolith, 'int' = built into
// the rifle (Whisper, Hush, Ratter). The fire event does not say, so read it off the rifle.
Sfx.canOf = function (e, sim) {
  const st = sim && sim.st;
  if (e.can) return e.can;
  if (!st) return 'light';
  if (st.gun && st.gun.supp === 'integral') return 'int';
  return st.cfg && st.cfg.muzzle === 'mz_suph' ? 'heavy' : 'light';
};
// lvl = loudness, f = the main snap's pitch, dec = how fast it dies (s), ring = the can's own
// metallic ring, thock = the hollow "tock" of gas in the can, low = how much low end is left
const CAN_SND = {
  light: { lvl: 1.0, f: 2700, dec: 0.022, ring: [3150, 4450], ringG: 0.05, thock: 1050, low: 0.12, sub: 0.8 },
  heavy: { lvl: 0.7, f: 2050, dec: 0.016, ring: [2250, 3350], ringG: 0.032, thock: 820, low: 0.1, sub: 0.55 },
  int: { lvl: 0.62, f: 1800, dec: 0.015, ring: [1950, 2950], ringG: 0.026, thock: 720, low: 0.08, sub: 0.6 },
};
// A suppressed shot. Not a "pfft": the can takes the boom away but leaves a sharp, short
// "thwack" with very little low end and almost no tail. A round faster than sound still makes
// its own crack in the air, and that comes from the bullet's path, a moment later and ringing
// off things down range. Slower than sound, all that is left is a "thup" and the action.
Sfx.suppressed = function (e, can, c) {
  const C = CAN_SND[can] || CAN_SND.light, p = c.p;
  if (!e.sub) {
    const L = C.lvl * clamp(0.62 + 0.3 * c.boom, 0.6, 1.1);
    Sfx.noise({ type: 'bandpass', f: C.f * p, q: 0.6, att: 0.0004, dur: C.dec, gain: 0.62 * L });            // the thwack
    Sfx.noise({ type: 'bandpass', f: 5000, q: 0.8, att: 0.0003, dur: 0.005, gain: 0.45 * L });              // its leading edge
    Sfx.noise({ type: 'bandpass', f: C.thock * p, q: 1.4, att: 0.0008, dur: 0.03, gain: 0.2 * L });          // gas in the can
    Sfx.tone({ f: C.ring[0] * p, dur: 0.03, gain: C.ringG * L }); Sfx.tone({ f: C.ring[1] * p, dur: 0.02, gain: C.ringG * 0.7 * L }); // the can rings
    Sfx.tone({ f: 150 * p, f1: 75, dur: 0.035, gain: C.low * L });                                           // a little low end
    Sfx.noise({ at: 0.004, type: 'bandpass', f: 1500, q: 0.6, att: 0.004, dur: 0.07, gain: 0.05 * L, verb: 0.18 }); // a short tail
    // the bullet's own crack: a hard snap from its path, then a rip that runs away down range
    const cr = clamp(0.55 + 0.4 * c.crack, 0.6, 1.1);
    Sfx.noise({ at: 0.006, type: 'bandpass', f: 3600, q: 0.7, att: 0.0002, dur: 0.007, gain: 0.7 * cr });
    Sfx.noise({ at: 0.009, type: 'bandpass', f: 4300, f1: 1400, q: 0.8, att: 0.002, dur: 0.12, gain: 0.07 * cr, verb: 0.35 });
  } else {
    // subsonic: a soft "thup", a puff of gas and the tick of the firing pin. A .22 is tinier still.
    const L = C.sub * (e.cal === 'c22' ? 0.55 : 1);
    Sfx.noise({ type: 'bandpass', f: 620 * p, q: 0.9, att: 0.0008, dur: 0.028, gain: 0.25 * L, verb: 0.06 });
    Sfx.noise({ type: 'lowpass', f: 1700, att: 0.001, dur: 0.04, gain: 0.08 * L });
    Sfx.noise({ type: 'bandpass', f: 4800, q: 0.9, att: 0.0003, dur: 0.003, gain: 0.1 * L });
    Sfx.tone({ f: 125 * p, f1: 70, dur: 0.04, gain: 0.08 * L });
  }
};
Sfx.shot = function (e, sim) {
  const X = Sfx; if (!X.ok) return;
  const c = CAL_SND[e.cal] || CAL_SND.c308, p = c.p;
  Sfx.click(0, 4200, e.quiet ? 0.07 : 0.12); // the firing pin
  if (e.quiet) {
    Sfx.suppressed(e, Sfx.canOf(e, sim), c);
  } else if (e.cal === 'crail') {
    Sfx.tone({ type: 'sawtooth', f: 3400, f1: 180, dur: 0.22, gain: 0.3, lp: 5000, verb: 0.6 });
    Sfx.noise({ type: 'highpass', f: 2400, dur: 0.07, gain: 0.8, verb: 0.5 });
    Sfx.tone({ f: 110, f1: 40, dur: 0.3, gain: 0.6 });
    Sfx.noise({ at: 0.02, type: 'bandpass', f: 700, q: 0.6, dur: 0.35, gain: 0.4, verb: 1.3 });
  } else {
    Sfx.noise({ type: 'highpass', f: 1700 * p, dur: 0.05, gain: 0.85 * c.crack });                                  // crack
    Sfx.noise({ type: 'lowpass', f: c.bf * 7, f1: c.bf * 1.4, dur: c.len, gain: 0.8 * c.boom });                      // body
    Sfx.tone({ f: c.bf, f1: 38, dur: c.len * 0.8, gain: 0.75 * c.boom });                                             // thump
    Sfx.noise({ at: 0.015, type: 'bandpass', f: 650 * p, q: 0.5, dur: 0.3 + c.len, att: 0.01, gain: 0.34, verb: c.tail }); // echo tail
    Sfx.noise({ at: 0.22 + c.len * 0.5, type: 'lowpass', f: 500, dur: 0.9 * c.tail, att: 0.12, gain: 0.07 * c.tail, brown: true }); // far roll
  }
  // the action. With a suppressor the shot is quiet enough that the steel is clearly heard.
  const cyc = e.cycle, q = e.quiet ? (e.sub ? 1.1 : 1.3) : 1;
  if (e.action === 'bolt') {
    Sfx.click(cyc * 0.2, 2600, 0.14 * q); Sfx.slide(cyc * 0.3, 2200, 800, cyc * 0.14, 0.14 * q); Sfx.click(cyc * 0.45, 1900, 0.18 * q);
    Sfx.brass(cyc * 0.5); Sfx.slide(cyc * 0.58, 800, 2300, cyc * 0.14, 0.14 * q); Sfx.click(cyc * 0.76, 1500, 0.2 * q);
  } else if (e.action === 'semi') {
    if (e.quiet) { // the carrier slams back and forward right after the shot: "thwack-clack"
      const k = e.sub ? 0.7 : 1;
      Sfx.click(0.014, 2500, 0.22 * k); Sfx.click(0.05, 1750, 0.26 * k); Sfx.tone({ at: 0.05, f: 2900, dur: 0.035, gain: 0.035 * k }); Sfx.brass(0.07);
    } else { Sfx.click(0.035, 2300, 0.16); Sfx.click(0.075, 1700, 0.13); Sfx.brass(0.09); }
  } else if (e.action === 'single') { Sfx.click(0.25, 2000, 0.1 * q); }
};
Sfx.brass = function (at) { // the empty case ringing on the floor
  const f = 3800 + Math.random() * 900;
  Sfx.tone({ at: at + 0.22, f, dur: 0.12, gain: 0.035 }); Sfx.tone({ at: at + 0.22, f: f * 1.48, dur: 0.09, gain: 0.02 });
  Sfx.tone({ at: at + 0.4, f: f * 1.05, dur: 0.07, gain: 0.02 }); Sfx.tone({ at: at + 0.5, f: f * 0.97, dur: 0.05, gain: 0.012 });
};
Sfx.reload = function (dur, action) {
  if (action === 'single') { Sfx.click(dur * 0.12, 2200, 0.16); Sfx.slide(dur * 0.2, 1800, 900, 0.1); Sfx.brass(dur * 0.22); Sfx.click(dur * 0.55, 1400, 0.1); Sfx.slide(dur * 0.78, 900, 2000, 0.1); Sfx.click(dur * 0.9, 1600, 0.2); return; }
  if (action === 'charge') { Sfx.click(dur * 0.15, 1800, 0.18); Sfx.tone({ at: dur * 0.2, f: 300, f1: 90, dur: 0.4, gain: 0.1, type: 'sawtooth', lp: 900 }); Sfx.click(dur * 0.6, 1300, 0.2); Sfx.tone({ at: dur * 0.65, f: 200, f1: 900, dur: dur * 0.3, gain: 0.07, type: 'triangle' }); return; }
  Sfx.click(dur * 0.12, 2400, 0.16); Sfx.slide(dur * 0.15, 1500, 700, 0.12, 0.14);                 // mag out
  Sfx.tone({ at: dur * 0.5, f: 190, f1: 110, dur: 0.07, gain: 0.2 }); Sfx.click(dur * 0.52, 1500, 0.2); // mag in
  Sfx.slide(dur * 0.74, 2100, 800, 0.11, 0.16); Sfx.slide(dur * 0.84, 800, 2300, 0.09, 0.16); Sfx.click(dur * 0.92, 1500, 0.22); // rack
};
Sfx.breath = function (on, gasp) {
  if (on) Sfx.noise({ type: 'bandpass', f: 700, f1: 1500, q: 1.2, dur: 0.38, att: 0.2, gain: 0.07 });
  else Sfx.noise({ type: 'bandpass', f: gasp ? 1500 : 1100, f1: 420, q: 1.0, dur: gasp ? 0.75 : 0.5, att: 0.05, gain: gasp ? 0.16 : 0.07 });
};
Sfx.heart = function (strength) {
  Sfx.tone({ f: 62, f1: 40, dur: 0.09, gain: 0.3 * strength }); Sfx.tone({ at: 0.15, f: 54, f1: 36, dur: 0.11, gain: 0.22 * strength });
};

// ---- things happening downrange (they arrive late) ---------------------------------
Sfx.far = function (dist) { return clamp(170 / Math.max(60, dist), 0.14, 1); };
Sfx.impact = function (mat, dist, at) {
  const g = Sfx.far(dist);
  if (mat === 'flesh') { Sfx.noise({ at, type: 'lowpass', f: 520, dur: 0.07, gain: 0.5 * g }); Sfx.tone({ at, f: 130, f1: 70, dur: 0.06, gain: 0.3 * g }); }
  else if (mat === 'metal' || mat === 'hard') { const f = 1700 + Math.random() * 1500; Sfx.tone({ at, f, dur: 0.22, gain: 0.2 * g, verb: 0.4 }); Sfx.tone({ at, f: f * 1.52, dur: 0.12, gain: 0.1 * g }); Sfx.tone({ at: at + 0.02, f: 2600, f1: 800, dur: 0.4, gain: 0.05 * g, verb: 0.6 }); Sfx.noise({ at, type: 'highpass', f: 3000, dur: 0.03, gain: 0.25 * g }); }
  else if (mat === 'glass') Sfx.glass(dist, at);
  else if (mat === 'water') Sfx.noise({ at, type: 'bandpass', f: 1300, f1: 500, q: 0.8, dur: 0.35, att: 0.02, gain: 0.3 * g });
  else if (mat === 'wood') { Sfx.tone({ at, f: 330, f1: 180, dur: 0.06, gain: 0.3 * g }); Sfx.noise({ at, type: 'bandpass', f: 1100, q: 1, dur: 0.05, gain: 0.3 * g }); }
  else { Sfx.noise({ at, type: 'lowpass', f: 900, f1: 300, dur: 0.12, gain: 0.42 * g, verb: 0.3 }); Sfx.tone({ at, f: 110, f1: 60, dur: 0.08, gain: 0.2 * g }); }
};
// A round hitting a person. Two parts:
//   the confirm: close and dry, right as the round lands, so the player feels it at once.
//     A head kill is a sharp crack with a short punch under it, a body kill a deep thump,
//     and a hit that does not kill is a dull, short "tuk" with no weight behind it.
//   the real impact: the smack itself, arriving only when its sound has travelled back, and
//     duller and quieter the further away it was. With gore on it has a wet edge.
// `at` is the delay for the sound to travel back. The confirm goes on the near bus, so the
// slow motion muffle never dulls it.
Sfx.hit = function (e, at, gore) {
  const X = Sfx; if (!X.ok) return;
  const d = e.dist || 150, g = Sfx.far(d), head = e.part === 'head', clear = clamp(260 / Math.max(60, d), 0.25, 1);
  // the real impact, late
  Sfx.noise({ at, type: 'lowpass', f: 650, f1: 180, dur: 0.08, gain: 0.5 * g, verb: 0.2 });
  Sfx.tone({ at, f: 135, f1: 68, dur: 0.07, gain: 0.3 * g });
  Sfx.noise({ at, type: 'bandpass', f: head ? 1900 : 1100, q: head ? 1.6 : 1.2, dur: head ? 0.018 : 0.02, gain: (head ? 0.3 : 0.16) * g * clear });
  if (gore) Sfx.noise({ at: at + 0.006, type: 'bandpass', f: 950, f1: 380, q: 3.5, dur: 0.07, gain: 0.14 * g });
  X.confirm(e);
};
// the confirm on its own, right now
Sfx.confirm = function (e) {
  const X = Sfx; if (!X.ok) return;
  const N = X.near, head = e.part === 'head';
  if (!e.lethal) {
    Sfx.noise({ type: 'bandpass', f: 820, q: 1.2, att: 0.001, dur: 0.035, gain: 0.2, dest: N });
    Sfx.tone({ f: 175, f1: 120, dur: 0.045, gain: 0.12, dest: N });
  } else if (head) {
    Sfx.noise({ type: 'highpass', f: 3200, att: 0.0004, dur: 0.014, gain: 0.3, dest: N });                  // crack
    Sfx.noise({ type: 'bandpass', f: 2200, f1: 1500, q: 3.5, att: 0.0006, dur: 0.035, gain: 0.24, dest: N }); // bone snap
    Sfx.tone({ f: 920, f1: 520, dur: 0.05, gain: 0.09, dest: N });                                          // a dry "tock"
    Sfx.tone({ type: 'triangle', f: 160, f1: 62, dur: 0.1, gain: 0.2, dest: N });                            // punch (heard on a phone speaker)
    Sfx.tone({ f: 105, f1: 46, dur: 0.12, gain: 0.26, dest: N });                                           // weight (heard on headphones)
    Sfx.noise({ at: 0.004, type: 'highpass', f: 6000, att: 0.002, dur: 0.12, gain: 0.035, verb: 0.25, dest: N }); // a little air after
  } else {
    Sfx.noise({ type: 'highpass', f: 2600, att: 0.0004, dur: 0.006, gain: 0.12, dest: N });                  // just enough edge to feel crisp
    Sfx.tone({ f: 92, f1: 40, dur: 0.17, gain: 0.42, dest: N });                                            // the thump
    Sfx.tone({ type: 'triangle', f: 140, f1: 68, dur: 0.11, gain: 0.2, dest: N });                           // punch (heard on a phone speaker)
    Sfx.noise({ type: 'lowpass', f: 520, f1: 140, att: 0.001, dur: 0.09, gain: 0.3, dest: N });              // body
    Sfx.noise({ at: 0.01, type: 'lowpass', f: 240, att: 0.01, dur: 0.22, gain: 0.1, brown: true, verb: 0.2, dest: N }); // a low bloom
  }
};
// Body armour stops the round: a hard "tank" on the plate, not a kill.
Sfx.vest = function (dist, at) {
  const X = Sfx; if (!X.ok) return;
  const N = X.near;
  Sfx.noise({ type: 'highpass', f: 3000, att: 0.0004, dur: 0.006, gain: 0.16, dest: N });
  Sfx.tone({ f: 1650, dur: 0.07, gain: 0.06, dest: N }); Sfx.tone({ f: 2480, dur: 0.05, gain: 0.04, dest: N });
  Sfx.tone({ f: 150, f1: 110, dur: 0.04, gain: 0.08, dest: N });
  Sfx.impact('metal', dist, at);
};
Sfx.glass = function (dist, at) {
  const g = Sfx.far(dist);
  Sfx.noise({ at, type: 'highpass', f: 4500, dur: 0.28, gain: 0.3 * g, verb: 0.3 });
  for (let i = 0; i < 7; i++) Sfx.tone({ at: at + 0.02 + Math.random() * 0.3, f: 2800 + Math.random() * 4500, dur: 0.05 + Math.random() * 0.1, gain: 0.07 * g });
};
Sfx.boom = function (dist, at) {
  const g = Sfx.far(dist) * 1.2;
  Sfx.noise({ at, type: 'lowpass', f: 900, f1: 90, dur: 1.3, gain: 0.9 * g, verb: 1.2 }); Sfx.tone({ at, f: 70, f1: 28, dur: 0.9, gain: 0.8 * g });
  Sfx.noise({ at: at + 0.1, type: 'lowpass', f: 300, dur: 2.2, att: 0.2, gain: 0.25 * g, brown: true });
};
Sfx.bell = function (dist, at, f) {
  const g = Sfx.far(dist); f = f || 520;
  [1, 2.0, 2.76, 4.07, 5.4].forEach((m, i) => Sfx.tone({ at, f: f * m, dur: 2.2 / (1 + i * 0.6), gain: (0.2 * g) / (1 + i), verb: 0.5 }));
};
Sfx.voice = function (dist, at) { // a short alarmed shout, far off
  const g = Sfx.far(dist) * 0.5, f = 420 + Math.random() * 260;
  Sfx.tone({ at, type: 'sawtooth', f, f1: f * 1.5, sweep: 0.12, dur: 0.38, att: 0.03, gain: 0.07 * g, lp: 1500, verb: 0.6 });
  Sfx.tone({ at: at + 0.12, type: 'sawtooth', f: f * 1.5, f1: f * 0.8, dur: 0.3, att: 0.03, gain: 0.05 * g, lp: 1300, verb: 0.6 });
};
Sfx.siren = function (at) {
  for (let i = 0; i < 8; i++) Sfx.tone({ at: at + i * 0.42, type: 'square', f: i % 2 ? 470 : 620, dur: 0.36, att: 0.03, gain: 0.05, lp: 1400, verb: 0.7 });
};
Sfx.thunder = function (at) {
  Sfx.noise({ at, type: 'lowpass', f: 2200, f1: 120, dur: 0.6, gain: 0.55, verb: 1.3 });
  Sfx.noise({ at: at + 0.15, type: 'lowpass', f: 260, dur: 3.4, att: 0.3, gain: 0.5, brown: true, verb: 0.6 });
  Sfx.tone({ at: at + 0.05, f: 52, f1: 30, dur: 1.6, gain: 0.35 });
};
Sfx.train = function (dur) {
  Sfx.noise({ type: 'lowpass', f: 380, dur: dur, att: dur * 0.25, gain: 0.5, brown: true });
  Sfx.noise({ type: 'bandpass', f: 1800, q: 0.6, dur: dur, att: dur * 0.3, gain: 0.09 });
  for (let t = 0.4; t < dur; t += 0.52) { Sfx.tone({ at: t, f: 95, f1: 60, dur: 0.07, gain: 0.25 }); Sfx.tone({ at: t + 0.11, f: 90, f1: 58, dur: 0.07, gain: 0.2 }); }
  Sfx.tone({ at: dur * 0.12, type: 'sawtooth', f: 330, dur: 1.1, att: 0.08, gain: 0.07, lp: 1100, verb: 0.9 }); Sfx.tone({ at: dur * 0.12, type: 'sawtooth', f: 415, dur: 1.1, att: 0.08, gain: 0.06, lp: 1100, verb: 0.9 });
};
Sfx.fireworks = function (dur) {
  for (let t = 0.1; t < dur; t += 0.5 + Math.random() * 0.8) { Sfx.noise({ at: t, type: 'bandpass', f: 900, f1: 2600, q: 3, dur: 0.5, att: 0.3, gain: 0.05 }); Sfx.noise({ at: t + 0.55, type: 'lowpass', f: 1400, f1: 200, dur: 0.5, gain: 0.5, verb: 1.0 }); for (let j = 0; j < 5; j++) Sfx.noise({ at: t + 0.7 + Math.random() * 0.5, type: 'highpass', f: 3500, dur: 0.04, gain: 0.08 }); }
};
Sfx.rattle = function (dur) { for (let t = 0; t < dur; t += 0.085) { Sfx.noise({ at: t, type: 'lowpass', f: 1500, dur: 0.045, gain: 0.3 }); Sfx.tone({ at: t, f: 90, dur: 0.04, gain: 0.2 }); } };
Sfx.horn = function (f, dur, at, g) { Sfx.tone({ at, type: 'sawtooth', f, dur, att: 0.12, gain: g || 0.12, lp: 700, verb: 1.0 }); Sfx.tone({ at, type: 'sawtooth', f: f * 1.26, dur, att: 0.12, gain: (g || 0.12) * 0.7, lp: 700, verb: 1.0 }); };
Sfx.jet = function (dur) { Sfx.noise({ type: 'bandpass', f: 500, f1: 2400, sweep: dur * 0.5, q: 0.7, dur, att: dur * 0.45, gain: 0.5 }); Sfx.noise({ type: 'lowpass', f: 300, dur, att: dur * 0.4, gain: 0.5, brown: true }); };

// ---- interface sounds -----------------------------------------------------------
Sfx.ui = function (kind) {
  const X = Sfx; if (!X.ok) return;
  if (kind === 'tap') Sfx.tone({ f: 660, dur: 0.035, gain: 0.07, type: 'triangle' });
  else if (kind === 'back') Sfx.tone({ f: 440, f1: 330, dur: 0.06, gain: 0.07, type: 'triangle' });
  else if (kind === 'go') { Sfx.tone({ f: 520, dur: 0.07, gain: 0.08, type: 'triangle' }); Sfx.tone({ at: 0.07, f: 780, dur: 0.12, gain: 0.08, type: 'triangle' }); }
  else if (kind === 'deny') Sfx.tone({ f: 150, dur: 0.14, gain: 0.12, type: 'square', lp: 600 });
  else if (kind === 'buy') { Sfx.tone({ f: 1318, dur: 0.07, gain: 0.08 }); Sfx.tone({ at: 0.07, f: 1760, dur: 0.22, gain: 0.08 }); Sfx.click(0, 2600, 0.1); }
  else if (kind === 'equip') { Sfx.click(0, 1900, 0.2); Sfx.slide(0.03, 900, 2200, 0.08, 0.12); Sfx.click(0.12, 1400, 0.2); }
  else if (kind === 'star') { Sfx.tone({ f: 880, dur: 0.25, gain: 0.09, verb: 0.4 }); Sfx.tone({ f: 1320, dur: 0.3, gain: 0.06, verb: 0.4 }); }
  else if (kind === 'page') Sfx.noise({ type: 'bandpass', f: 2400, f1: 900, q: 0.8, dur: 0.12, att: 0.02, gain: 0.07 });
  else if (kind === 'riser') Sfx.noise({ type: 'bandpass', f: 300, f1: 4000, q: 2, dur: 0.9, att: 0.8, gain: 0.14 });
  else if (kind === 'radio') { Sfx.tone({ f: 1250, dur: 0.045, gain: 0.04, type: 'square', lp: 2500 }); Sfx.noise({ at: 0.04, type: 'bandpass', f: 2200, q: 1.5, dur: 0.08, gain: 0.03 }); }
  else if (kind === 'tick') Sfx.click(0, 3600, 0.09);
};
Sfx.rarity = function (r) { // a little chord that gets grander with rarity
  const base = [392, 440, 494, 523, 587][r] || 392, n = 2 + r;
  for (let i = 0; i < n; i++) Sfx.tone({ at: i * 0.07, f: base * [1, 1.25, 1.5, 2, 2.5, 3][i], dur: 0.5 + r * 0.25, gain: 0.07, type: i % 2 ? 'triangle' : 'sine', verb: 0.5 + r * 0.15 });
  if (r >= 3) Sfx.noise({ type: 'highpass', f: 6000, dur: 0.9, att: 0.05, gain: 0.04, verb: 0.8 });
};
Sfx.result = function (win) {
  Sfx.tension = 0;
  if (win) [220, 277.2, 329.6, 440, 554.4].forEach((f, i) => Sfx.tone({ at: 0.25 + i * 0.11, f, dur: 1.6, gain: 0.07, type: 'triangle', verb: 0.9, dest: Sfx.mus }));
  else { Sfx.tone({ at: 0.2, f: 146.8, f1: 138.6, dur: 1.8, gain: 0.12, type: 'sawtooth', lp: 500, verb: 0.9, dest: Sfx.mus }); Sfx.tone({ at: 0.2, f: 103.8, f1: 98, dur: 1.8, gain: 0.12, type: 'sawtooth', lp: 500, verb: 0.9, dest: Sfx.mus }); }
};

// ---- the kill camera -----------------------------------------------------------------
// The kill camera calls Sfx.kc(stage, o) once for each beat of its film:
//   'fly'    the round leaves the muzzle      'near'  about half a second before the target
//   'cover'  through cover (o.mat: wood, metal, glass, wall)
//   'enter'  into the body                    'bone'  hits bone (o.bone: skull, rib, spine, limb)
//   'exit'   out the far side (o.size 0..1)   'fall'  the body lands (o.mat: the ground)
//   'end'    the film is over or was skipped
// Every o carries rate (how fast time runs, 1 = real time), part, cal, power (0..1) and gore.
//
// Slow time is heard as lower and longer: pitches are multiplied by about rate^0.35 and lengths
// by about rate^-0.45 (at rate 0.1 that is under half the pitch and nearly three times as long).
// Sharp layers such as cracks and splinters drop less, so they stay sharp. A low bed and a slow
// heartbeat run under the whole film, while the world outside is muffled and pushed back.
// Wet layers are only added with gore on. Beats that arrive on top of each other are spread a
// few hundredths of a second apart and turned down, so they never pile up into mush.
// On 'end' everything here fades out in a few hundredths of a second and the world snaps back.
function kcPT(rate) { const r = clamp(+rate || 1, 0.05, 1); return { r, p: Math.pow(r, 0.35), p2: Math.pow(r, 0.18), t: Math.min(3.2, Math.pow(r, -0.45)) }; }
const kcBedLvl = (r) => 0.015 + 0.11 * Math.pow(1 - clamp(r, 0, 1), 1.5);
const kcBedCut = (r) => 110 + 1200 * r * r;
const kcSubCal = { c300s: 1, c9s: 1, c22: 1 };
Sfx.kc = function (stage, o) {
  const X = Sfx; if (!X.ok) return;
  try { X.kcBeat(stage, o || {}); } catch (e) { /* sound is optional: it must never break the film */ }
};
Sfx.kcOpen = function () {
  const X = Sfx, ac = X.ac;
  if (X.kcS && X.kcS.on) X.kcClose(false);
  const out = ac.createGain(); out.gain.value = 0.62; out.connect(X.near); // about as loud as a real shot at its peak
  Sfx.hold(X.kcVerbG.gain, ac.currentTime); X.kcVerbG.gain.setTargetAtTime(0.45, ac.currentTime, 0.01); // open the echo
  X.kcS = { on: true, t0: ac.currentTime, last: ac.currentTime, film: false, out, srcs: [], recent: [], next: 0, gore: true, bed: null, bedR: -1, wh: null, whR: -1, near: false, tear: null };
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
  S.on = false; S.bed = S.wh = S.tear = null;
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
    Sfx.noise({ type: 'bandpass', f: 700, f1: 5200, sweep: 0.06, q: 1.1, att: 0.055, dur: 0.012, gain: 0.08, dest: X.near });
    Sfx.noise({ at: 0.058, type: 'highpass', f: 5200, att: 0.0003, dur: 0.006, gain: 0.1, dest: X.near });
  }
};
// follow the film's speed: the bed is loud and dark when time is slow, nearly gone at real time,
// and the round's whoosh brightens as the flight speeds up and deepens as it slows again
Sfx.kcTick = function (scale) {
  const X = Sfx, S = X.kcS; if (!S || !S.on) return;
  const now = X.ac.currentTime;
  if (CB.KillCam && !CB.KillCam.active) { // the film ended without saying so
    if (S.film && now - S.t0 > 0.25) X.kcClose(true);
    else if (!S.film && now - S.last > 4) X.kcClose(false); // a stray beat on its own: let it ring out first
    return;
  }
  if (S.bed && Math.abs(scale - S.bedR) > 0.02) { S.bedR = scale; S.bed.g.gain.setTargetAtTime(kcBedLvl(scale), now, 0.15); S.bed.f.frequency.setTargetAtTime(kcBedCut(scale), now, 0.15); }
  if (S.wh && !S.near && Math.abs(scale - S.whR) > 0.02) { S.whR = scale; S.wh.f.frequency.setTargetAtTime(700 * Math.pow(clamp(scale, 0.05, 1), 0.35), now, 0.2); }
};
// a new beat: how long to wait so it does not land on the last one, and how much to turn it down
function kcSlot(S, now) {
  S.recent = S.recent.filter((x) => now - x < 0.16);
  const n = S.recent.length, at = Math.min(0.09, Math.max(0, (S.next || 0) - now));
  S.recent.push(now); S.next = now + at + 0.024;
  return { at, k: 1 / Math.sqrt(1 + 0.6 * n), lite: n >= 3 };
}
// the low bed: a rumble of brown noise and a held sub tone
function kcBed(S, P) {
  const X = Sfx, ac = X.ac, now = ac.currentTime;
  const src = ac.createBufferSource(); src.buffer = X.brown; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kcBedCut(P.r); f.Q.value = 0.9;
  const sub = ac.createOscillator(); sub.frequency.value = 41;
  const sg = ac.createGain(); sg.gain.value = 0.35;
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.setTargetAtTime(kcBedLvl(P.r), now, 0.12);
  src.connect(f); f.connect(g); sub.connect(sg); sg.connect(g); g.connect(S.out);
  src.start(now, Math.random() * 2); sub.start(now);
  Sfx.kcKeep(S, src); Sfx.kcKeep(S, sub);
  S.bed = { f, g }; S.bedR = P.r;
}
// a slow heartbeat (one oscillator, its loudness and pitch moved for each "lub-dub")
function kcHeart(S, t0, n) {
  const ac = Sfx.ac, o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
  o.type = 'triangle'; lp.type = 'lowpass'; lp.frequency.value = 320; g.gain.value = 0.0001;
  o.connect(lp); lp.connect(g); g.connect(S.out);
  for (let i = 0; i < n; i++) {
    const t = t0 + i * 1.08;
    [[0, 0.42, 66, 42, 0.12], [0.18, 0.3, 58, 38, 0.14]].forEach((b) => {
      const s = t + b[0];
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(b[1], s + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, s + b[4]);
      o.frequency.setValueAtTime(b[2], s); o.frequency.exponentialRampToValueAtTime(b[3], s + b[4]);
    });
  }
  o.start(t0); o._end = t0 + n * 1.08 + 0.4; o.stop(o._end); Sfx.kcKeep(S, o);
}
// the round in the air: band-limited noise that pulses with its spin and grows as it nears
function kcWhoosh(S, P) {
  const X = Sfx, ac = X.ac, now = ac.currentTime;
  const src = ac.createBufferSource(); src.buffer = X.white; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.3; f.frequency.setValueAtTime(260 * P.p, now); f.frequency.setTargetAtTime(700 * P.p, now, 1.2);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.setTargetAtTime(0.035, now + 0.3, 0.8);
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
// passing through: a low, uneven tearing that lasts until the round comes out (or 1.6 s at most)
function kcTear(S, P, k, gore, at) {
  const X = Sfx, ac = X.ac, t = ac.currentTime + at, len = 1.6;
  if (S.tear) kcStopTear(S, t);
  const b = ac.createBufferSource(); b.buffer = X.brown; b.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = Math.max(90, 260 * P.p); f.Q.value = 1.2;
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((gore ? 0.9 : 0.6) * k, t + 0.03 * P.t); g.gain.setTargetAtTime(0.0001, t + len, 0.15);
  const am = ac.createGain(); am.gain.value = 0;
  const r = ac.createBufferSource(); r.buffer = X.rough; r.loop = true; r.playbackRate.value = 1.3 * P.p;
  r.connect(am.gain); b.connect(f); f.connect(g); g.connect(am); am.connect(S.out);
  const srcs = [b, r];
  if (gore) { // a wet sizzle riding on the tear
    const w = ac.createBufferSource(); w.buffer = X.white; w.loop = true;
    const f2 = ac.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 850 * P.p2; f2.Q.value = 2.4;
    const g2 = ac.createGain(); g2.gain.value = 0.22;
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
  let at = 0, kk = 1, lite = false;
  if (stage !== 'fly' && stage !== 'near') { const sl = kcSlot(S, now); at = sl.at; kk = sl.k; lite = sl.lite; }
  const k = kk * (0.65 + 0.35 * pw);
  const n = (q) => { q.at = (q.at || 0) + at; q.dest = S.out; q.vbus = X.kcVerb; return X.kcKeep(S, Sfx.noise(q)); };
  const t = (q) => { q.at = (q.at || 0) + at; q.dest = S.out; q.vbus = X.kcVerb; return X.kcKeep(S, Sfx.tone(q)); };
  const rnd = Math.random;
  if (S.bed && Math.abs(P.r - S.bedR) > 0.02) { S.bedR = P.r; S.bed.g.gain.setTargetAtTime(kcBedLvl(P.r), now, 0.15); S.bed.f.frequency.setTargetAtTime(kcBedCut(P.r), now, 0.15); }
  switch (stage) {
    case 'fly': {
      const st = X.simRef && X.simRef.st;
      S.quiet = o.quiet !== undefined ? !!o.quiet : st ? !!st.quiet : false;
      S.sub = o.sub !== undefined ? !!o.sub : st ? !!st.subsonic : !!kcSubCal[o.cal];
      S.film = true;
      // the world drops away
      Sfx.hold(X.master.gain, now); X.master.gain.setTargetAtTime(0.42, now, 0.12);
      kcBed(S, P); kcHeart(S, now + 0.45, 9);
      // the round leaving the muzzle, slowed right down
      const c = CAL_SND[o.cal] || CAL_SND.c308, mk = (S.quiet ? (S.sub ? 0.3 : 0.5) : 1) * (0.7 + 0.3 * pw);
      t({ f: Math.max(34, c.bf * p * 0.6), f1: 26, dur: 0.9 * T, att: 0.012, gain: 0.42 * mk });              // the boom
      t({ type: 'triangle', f: Math.max(70, c.bf * p), f1: 48, dur: 0.35 * T, gain: 0.16 * mk, lp: 700 });      // its body (heard on a phone)
      n({ type: 'lowpass', f: 1700 * p, f1: 140, dur: 0.75 * T, att: 0.015, gain: 0.3 * mk, verb: 0.5 });      // the blast rolling out
      n({ type: 'bandpass', f: (S.quiet ? 1900 : 2600) * p2, q: 0.8, att: 0.001, dur: 0.045 * T, gain: 0.24 * (S.quiet ? 0.8 : 1) }); // the crack, stretched
      kcWhoosh(S, P);
      break;
    }
    case 'near': {
      if (!S.wh) kcWhoosh(S, P);
      const w = S.wh; S.near = true;
      Sfx.hold(w.g.gain, now); w.g.gain.setTargetAtTime(0.17 * k, now, 0.17);
      Sfx.hold(w.f.frequency, now); w.f.frequency.setTargetAtTime(1500 * p2, now, 0.22);
      w.lfo.frequency.setTargetAtTime(15 * p, now, 0.2);
      t({ f: Math.max(36, 80 * p), f1: 40, att: 0.4, dur: 0.12, gain: 0.14 * k });                              // the air pushed ahead of it
      if (!S.sub) n({ type: 'bandpass', f: 3600 * p2, f1: 5200 * p2, sweep: 0.45, q: 2, att: 0.45, dur: 0.05, gain: 0.05 * k }); // its shock wave hissing
      break;
    }
    case 'cover': {
      if (S.wh) { const w = S.wh; Sfx.hold(w.g.gain, now); w.g.gain.setTargetAtTime(0.02, now + at, 0.008); w.g.gain.setTargetAtTime(0.12 * k, now + at + 0.06 * T, 0.12); }
      const m = o.mat || 'wall';
      if (m === 'wood') {
        n({ type: 'bandpass', f: 1300 * p2, q: 1.8, att: 0.0006, dur: 0.05 * T, gain: 0.38 * k });             // the crack
        t({ f: Math.max(120, 240 * p), f1: Math.max(80, 150 * p), dur: 0.09 * T, gain: 0.3 * k });            // a hollow knock
        if (!lite) for (let i = 0; i < 5; i++) n({ at: (0.01 + rnd() * 0.17) * T, type: 'bandpass', f: (2200 + rnd() * 3000) * p2, q: 5, att: 0.0005, dur: 0.012 * T, gain: (0.06 + rnd() * 0.06) * k }); // splinters
        n({ at: 0.01, type: 'lowpass', f: 900 * p, att: 0.02, dur: 0.25 * T, gain: 0.06 * k, verb: 0.3 });    // chips and dust
      } else if (m === 'metal') {
        n({ type: 'highpass', f: 3500 * p2, att: 0.0003, dur: 0.008, gain: 0.36 * k });
        [[1, 0.2, 0.7], [2.76, 0.12, 0.45], [5.4, 0.06, 0.25]].forEach((h) => t({ f: 520 * p * h[0], dur: h[2] * T, gain: h[1] * k, verb: 0.4 })); // the clang
        n({ type: 'bandpass', f: 2400 * p2, f1: 900 * p2, q: 3, dur: 0.15 * T, gain: 0.08 * k });             // tearing through the sheet
      } else if (m === 'glass') {
        n({ type: 'highpass', f: 3800 * p2, att: 0.0004, dur: 0.22 * T, gain: 0.32 * k, verb: 0.3 });         // the burst
        t({ f: Math.max(160, 420 * p), f1: Math.max(100, 220 * p), dur: 0.05 * T, gain: 0.12 * k });          // the pane flexing
        const nT = lite ? 3 : 7; for (let i = 0; i < nT; i++) t({ at: (0.02 + rnd() * 0.5) * T, f: (2500 + rnd() * 4500) * p2, dur: (0.04 + rnd() * 0.08) * T, gain: 0.05 * k }); // pieces
      } else { // a wall: brick, block or plaster
        n({ type: 'lowpass', f: 1600 * p, f1: 250 * p, att: 0.0008, dur: 0.14 * T, gain: 0.45 * k });          // crunch
        t({ f: Math.max(60, 120 * p), f1: 50, dur: 0.18 * T, gain: 0.3 * k });                                // thud
        t({ type: 'triangle', f: Math.max(120, 220 * p), f1: 90, dur: 0.1 * T, gain: 0.12 * k, lp: 900 });     // (heard on a phone)
        if (!lite) for (let i = 0; i < 4; i++) n({ at: (0.005 + rnd() * 0.1) * T, type: 'highpass', f: 2500 * p2, att: 0.0004, dur: 0.008 * T, gain: 0.08 * k }); // grit
        n({ at: 0.03 * T, type: 'bandpass', f: 1800 * p2, q: 0.8, att: 0.05 * T, dur: 0.35 * T, gain: 0.05 * k }); // dust trickling down
      }
      break;
    }
    case 'enter': {
      kcCutWhoosh(S, now + at);
      const head = o.part === 'head';
      n({ type: 'bandpass', f: (head ? 2100 : 1500) * p2, q: 1.1, att: 0.0005, dur: 0.03 * T, gain: (head ? 0.36 : 0.32) * k }); // the slap of skin
      n({ type: 'lowpass', f: 1100 * p, f1: 140, att: 0.001, dur: 0.14 * T, gain: (head ? 0.32 : 0.42) * k });                  // the punch
      t({ f: Math.max(40, 105 * p), f1: 30, dur: 0.3 * T, gain: 0.5 * k });                                                     // deep impact
      t({ type: 'triangle', f: Math.max(110, 230 * p), f1: 80, dur: 0.14 * T, gain: 0.2 * k, lp: 900 });                       // (heard on a phone)
      if (gore) {
        n({ at: 0.004, type: 'bandpass', f: 1100 * p2, f1: 320 * p2, sweep: 0.12 * T, q: 4.5, att: 0.002, dur: 0.16 * T, gain: 0.24 * k }); // squelch
        if (!lite) n({ at: 0.04 * T, type: 'bandpass', f: 700 * p2, f1: 250 * p2, q: 5, att: 0.003, dur: 0.12 * T, gain: 0.14 * k });
      }
      kcTear(S, P, k, gore, at);
      break;
    }
    case 'bone': {
      const b = o.bone || 'rib';
      if (b === 'skull') {
        n({ type: 'highpass', f: 3800 * p2, att: 0.0003, dur: 0.012 * T, gain: 0.44 * k });                   // crack
        n({ type: 'bandpass', f: 1050 * p2, q: 7, att: 0.0005, dur: 0.06 * T, gain: 0.34 * k });              // the hollow "tock" of the skull
        if (!lite) [0.012, 0.027, 0.045].forEach((d, i) => n({ at: d * T, type: 'highpass', f: 2600 * p2, att: 0.0003, dur: 0.008 * T, gain: (0.16 - i * 0.03) * k })); // it gives way in pieces
        t({ f: Math.max(120, 300 * p), f1: Math.max(70, 120 * p), dur: 0.08 * T, gain: 0.2 * k });
      } else if (b === 'spine') {
        n({ type: 'bandpass', f: 1700 * p2, q: 2, att: 0.0005, dur: 0.025 * T, gain: 0.42 * k });
        if (!lite) [0.02, 0.05].forEach((d) => n({ at: d * T, type: 'highpass', f: 2200 * p2, att: 0.0004, dur: 0.01 * T, gain: 0.14 * k }));
        t({ f: Math.max(60, 160 * p), f1: 45, dur: 0.15 * T, gain: 0.32 * k });
        t({ type: 'triangle', f: Math.max(110, 260 * p), f1: 90, dur: 0.08 * T, gain: 0.12 * k, lp: 1000 });
      } else if (b === 'limb') {
        n({ type: 'bandpass', f: 2000 * p2, q: 3, att: 0.0005, dur: 0.02 * T, gain: 0.36 * k });
        t({ f: Math.max(120, 350 * p), f1: Math.max(80, 160 * p), dur: 0.06 * T, gain: 0.15 * k });
      } else { // ribs: a crunchy little run of cracks
        [0, 0.018, 0.04].forEach((d, i) => { if (!lite || i === 0) n({ at: d * T, type: 'bandpass', f: (2400 - i * 250) * p2, q: 2.5, att: 0.0004, dur: 0.015 * T, gain: [0.32, 0.23, 0.16][i] * k }); });
        t({ f: Math.max(140, 420 * p), f1: Math.max(90, 200 * p), dur: 0.04 * T, gain: 0.12 * k });
      }
      if (gore && !lite) n({ at: 0.01 * T, type: 'bandpass', f: 800 * p2, q: 3, att: 0.002, dur: 0.06 * T, gain: 0.1 * k }); // wet crunch
      break;
    }
    case 'exit': {
      const sz = clamp(o.size === undefined ? 0.6 : +o.size, 0, 1);
      kcStopTear(S, now + at);
      t({ f: Math.max(60, 150 * p), f1: 45, dur: 0.09 * T, gain: (0.24 + 0.16 * sz) * k });                    // the round breaking out
      n({ type: 'bandpass', f: 1800 * p2, f1: 900 * p2, q: 0.7, att: 0.01 * T, dur: (0.25 + 0.35 * sz) * T, gain: (0.12 + 0.18 * sz) * k, verb: 0.25 }); // the spray, a hiss
      if (gore) {
        n({ type: 'bandpass', f: 700 * p2, f1: 300 * p2, q: 3, att: 0.003, dur: 0.18 * T, gain: (0.15 + 0.1 * sz) * k }); // wet burst
        const nd = lite ? 2 : 3 + Math.round(5 * sz);
        for (let i = 0; i < nd; i++) n({ at: (0.15 + rnd() * 0.75) * T, type: 'bandpass', f: (1400 + rnd() * 2000) * p2, q: 6, att: 0.0008, dur: 0.012 * T, gain: (0.03 + rnd() * 0.035) * k }); // drops landing
      } else n({ type: 'lowpass', f: 1200 * p, att: 0.004, dur: 0.2 * T, gain: 0.12 * k });               // a dry puff
      break;
    }
    case 'fall': {
      const m = o.mat || 'dirt';
      const body = (a, s) => {
        t({ at: a, f: Math.max(40, 95 * p), f1: 34, dur: 0.22 * T * s, gain: 0.42 * kk * s });
        t({ at: a, type: 'triangle', f: Math.max(100, 190 * p), f1: 70, dur: 0.12 * T * s, gain: 0.16 * kk * s, lp: 800 });
        n({ at: a, type: 'lowpass', f: 700 * p, f1: 140, att: 0.002, dur: 0.16 * T * s, gain: 0.36 * kk * s });
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
Sfx.bed = function (o) { // a continuous layer of filtered noise or a held tone
  const X = Sfx, ac = X.ac, t = ac.currentTime;
  let src;
  if (o.osc) { src = ac.createOscillator(); src.type = o.osc; src.frequency.value = o.f; if (o.detune) src.detune.value = o.detune; }
  else { src = ac.createBufferSource(); src.buffer = o.brown ? X.brown : X.white; src.loop = true; }
  const f = ac.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.value = o.cut || o.f || 800; f.Q.value = o.q || 0.7;
  const g = ac.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(o.gain, t, 0.8);
  src.connect(f); f.connect(g); g.connect(o.dest || X.ambG);
  if (o.lfo) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = o.lfo; lg.gain.value = o.lfoAmt || o.gain * 0.5; l.connect(lg); lg.connect(o.lfoCut ? f.frequency : g.gain); if (o.lfoCut) lg.gain.value = o.lfoCut; l.start(t); }
  src.start(t);
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
  if (a.kind === 'city') { X.bed({ brown: true, cut: 190, gain: 0.3 }); X.bed({ type: 'bandpass', cut: 900, q: 0.3, gain: 0.012 }); if (a.night) X.bed({ osc: 'sine', f: 120, cut: 300, gain: 0.006 }); }
  else if (a.kind === 'harbour') { X.bed({ brown: true, cut: 380, gain: 0.26, lfo: 0.19, lfoAmt: 0.12 }); X.bed({ type: 'bandpass', cut: 1400, q: 0.5, gain: 0.02, lfo: 0.23, lfoAmt: 0.014 }); }
  else if (a.kind === 'snow') { X.bed({ type: 'bandpass', cut: 420, q: 3.2, gain: 0.07, lfo: 0.13, lfoCut: 160 }); X.bed({ brown: true, cut: 260, gain: 0.2, lfo: 0.09, lfoAmt: 0.1 }); }
  else { X.bed({ brown: true, cut: 300, gain: 0.14, lfo: 0.08, lfoAmt: 0.06 }); }
  X.windBed = X.bed({ type: 'bandpass', cut: 520, q: 1.6, gain: 0.0, lfo: 0.21, lfoCut: 180, tag: 'wind' });
  // rain: a soft wash that swells and fades, a low patter on the roofs, and (in tick) the single drops you can pick out
  if (a.rain) { X.bed({ type: 'bandpass', cut: 5200, q: 0.5, gain: 0.024, lfo: 0.17, lfoAmt: 0.009 }); X.bed({ type: 'bandpass', cut: 2300, q: 0.8, gain: 0.014, lfo: 0.31, lfoAmt: 0.006 }); X.bed({ brown: true, cut: 520, gain: 0.07, lfo: 0.11, lfoAmt: 0.03 }); X.dripT = 0.2; }
};
Sfx.missionStart = function (sim) {
  const S = sim.S;
  Sfx.tension = 0.25; Sfx.simRef = sim;
  Sfx.setMode('mission', { kind: S.ambience, night: S.pal.dark > 0.5, rain: S.weather === 'rain' || S.weather === 'storm', snow: S.weather === 'snow' });
};
Sfx.missionEnd = function () { Sfx.kcClose(false); Sfx.simRef = null; };
Sfx.menu = function () { if (Sfx.mode !== 'menu') Sfx.setMode('menu'); Sfx.tension = 0.1; };

const SCALE = [220, 261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3];
const CHORDS = [[110, 164.8, 261.6], [87.3, 174.6, 261.6], [73.4, 146.8, 220], [82.4, 164.8, 246.9], [110, 164.8, 220], [98, 146.8, 233.1]];
Sfx.musicBeat = function (t0) {
  const X = Sfx, beat = X.beat++, ten = X.tension, menu = X.mode === 'menu';
  const at = Math.max(0, t0 - X.ac.currentTime);
  if (beat % 8 === 0) { // pad chord, slow swell
    const ch = CHORDS[Math.floor(beat / 8) % CHORDS.length];
    ch.forEach((f, i) => Sfx.tone({ at, f: f * (i === 2 ? 1 : 1), type: 'triangle', dur: 7.5, att: 2.2, gain: 0.03 + 0.012 * ten, lp: 900, dest: X.mus, verb: 0.5 }));
  }
  if (ten > 0.3 || menu) { // pulse
    Sfx.tone({ at, f: 49, f1: 38, dur: 0.16, gain: menu ? 0.08 : 0.07 + 0.1 * ten, dest: X.mus });
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
  switch (e.k) {
    case 'fire': X.shot(e, sim); break;
    case 'dry': X.click(0, 2800, 0.25); break;
    case 'reload': X.reload(e.dur, e.action); break;
    case 'charge': Sfx.tone({ type: 'sawtooth', f: 180, f1: 2200, dur: e.dur, att: e.dur * 0.9, gain: 0.12, lp: 3000 }); Sfx.tone({ f: 60, f1: 240, dur: e.dur, att: e.dur * 0.8, gain: 0.1 }); break;
    case 'breath': X.breath(e.on, e.gasp); break;
    case 'click': X.ui('tick'); break;
    case 'impact': X.impact(e.mat === 'interior' ? 'wood' : e.mat, e.dist, back(e.dist)); break;
    case 'hit': if (!(X.kcS && X.kcS.on)) X.hit(e, back(e.dist), Save.data.settings.gore !== false); break; // the kill camera makes its own
    case 'vest': X.vest(sim.S.refZ, back(sim.S.refZ)); break;
    case 'glass': X.glass(sim.S.refZ, back(sim.S.refZ)); break;
    case 'objhit': X.impact('metal', e.dist, back(e.dist)); break;
    case 'boom': X.boom(sim.S.refZ, back(sim.S.refZ)); break;
    case 'crash': { const at = back(sim.S.refZ), g = Sfx.far(sim.S.refZ); Sfx.noise({ at, type: 'lowpass', f: 1200, f1: 200, dur: 0.6, gain: 0.7 * g, verb: 0.8 }); Sfx.tone({ at, f: 80, f1: 40, dur: 0.35, gain: 0.5 * g }); if (e.kind === 'piano') [220, 277, 311, 415, 466, 587].forEach((f, i) => Sfx.tone({ at: at + i * 0.012, f, dur: 1.6, gain: 0.07 * g, type: 'triangle', verb: 0.9 })); break; }
    case 'snap': Sfx.tone({ at: back(sim.S.refZ), f: 900, f1: 200, dur: 0.12, gain: 0.12, type: 'sawtooth', lp: 2000 }); break;
    case 'scream': case 'bodyfound': X.voice(sim.S.refZ, back(sim.S.refZ)); break;
    case 'spotted': Sfx.tone({ type: 'sawtooth', f: 311, dur: 0.5, att: 0.02, gain: 0.04, lp: 1600, dest: X.mus, verb: 0.6 }); Sfx.tone({ type: 'sawtooth', f: 330, dur: 0.5, att: 0.02, gain: 0.04, lp: 1600, dest: X.mus, verb: 0.6 }); break;
    case 'alarm': X.siren(back(sim.S.refZ)); break;
    case 'lampout': case 'zap': case 'spark': { const at = back(sim.S.refZ), g = Sfx.far(sim.S.refZ); Sfx.glass(sim.S.refZ * 1.6, at); for (let i = 0; i < 4; i++) Sfx.noise({ at: at + i * 0.04, type: 'highpass', f: 3500, dur: 0.02, gain: 0.2 * g }); break; }
    case 'ring': X.bell(sim.S.refZ, back(sim.S.refZ), e.kind === 'horn' ? 300 : 560); break;
    case 'smash': X.glass(sim.S.refZ, back(sim.S.refZ)); break;
    case 'clank': X.impact('metal', sim.S.refZ, back(sim.S.refZ)); break;
    case 'tyre': Sfx.noise({ at: back(sim.S.refZ), type: 'highpass', f: 2500, f1: 900, dur: 0.6, gain: 0.12 }); break;
    case 'steam': Sfx.noise({ at: back(sim.S.refZ), type: 'highpass', f: 2000, dur: 3.5, att: 0.1, gain: 0.07 }); break;
    case 'npcshot': { const at = back(sim.S.refZ), g = Sfx.far(sim.S.refZ); Sfx.noise({ at, type: 'highpass', f: 1500, dur: 0.05, gain: 0.5 * g, verb: 0.8 }); Sfx.noise({ at, type: 'lowpass', f: 900, dur: 0.12, gain: 0.5 * g, verb: 0.8 }); break; }
    case 'duck': Sfx.tone({ at: back(sim.S.refZ), f: 1100, f1: 1900, dur: 0.09, gain: 0.12, type: 'square', lp: 3000 }); Sfx.tone({ at: back(sim.S.refZ) + 0.1, f: 1900, f1: 900, dur: 0.14, gain: 0.1, type: 'square', lp: 3000 }); X.ui('star'); break;
    case 'msg': if (e.who !== 'hint') X.ui('radio'); break;
    case 'flare': Sfx.noise({ at: back(sim.S.refZ), type: 'bandpass', f: 2600, q: 0.6, dur: 5, att: 0.1, gain: 0.05 }); break;
    case 'cover': {
      const n = e.name;
      if (n === 'thunder') X.thunder(0.35);
      else if (n === 'train') X.train(e.dur + 1.5);
      else if (n === 'fireworks') X.fireworks(e.dur);
      else if (n === 'jackhammer' || n === 'drill') X.rattle(e.dur);
      else if (n === 'ship horn') X.horn(92, e.dur, 0, 0.2);
      else if (n === 'church bells') { for (let t = 0; t < e.dur; t += 1.3) X.bell(130, t, 300); }
      else if (n === 'jet' || n === 'helicopter') X.jet(e.dur + 1);
      else if (n === 'car alarm') { for (let t = 0; t < e.dur; t += 0.5) Sfx.tone({ at: t, type: 'square', f: 1400, f1: 900, dur: 0.24, gain: 0.03, lp: 2600, verb: 0.6 }); }
      else if (n === 'blasting') { for (let t = 0.2; t < e.dur; t += 1.4 + Math.random()) { Sfx.noise({ at: t, type: 'lowpass', f: 700, f1: 80, dur: 1.1, gain: 0.5, verb: 1.2 }); Sfx.tone({ at: t, f: 60, f1: 28, dur: 0.8, gain: 0.45 }); } }
      else if (n === 'generator') { Sfx.noise({ type: 'lowpass', f: 240, dur: e.dur, att: 0.3, gain: 0.22, brown: true }); for (let t = 0; t < Math.min(e.dur, 40); t += 0.11) Sfx.tone({ at: t, f: 74, dur: 0.06, gain: 0.07 }); }
      else if (n === 'test shot') { Sfx.tone({ type: 'sawtooth', f: 200, f1: 2600, dur: Math.max(0.6, e.dur * 0.6), att: e.dur * 0.5, gain: 0.08, lp: 3000 }); Sfx.noise({ at: e.dur * 0.62, type: 'highpass', f: 2000, dur: 0.1, gain: 0.5, verb: 1 }); Sfx.tone({ at: e.dur * 0.62, f: 110, f1: 40, dur: 0.4, gain: 0.5 }); }
      else if (n === 'band' || n === 'music') { for (let t = 0; t < e.dur; t += 0.5) { Sfx.tone({ at: t, f: 60, f1: 42, dur: 0.14, gain: 0.3 }); if ((t * 2) % 2 >= 1) Sfx.noise({ at: t, type: 'highpass', f: 2000, dur: 0.08, gain: 0.12 }); } }
      break;
    }
    default: break;
  }
};
