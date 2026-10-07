// ---------------------------------------------------------------------------
// Sound. Everything is generated in code with the Web Audio API: there are no
// audio files. Gunshots are built from layers (a sharp crack, a chest thump,
// a filtered body and an echo tail) and every calibre has its own recipe.
// ---------------------------------------------------------------------------
const Sfx = CB.Sfx = { ac: null, ok: false, tension: 0, mode: 'off', amb: null, nextBeat: 0, beat: 0, events: [], ducked: false, heartT: 0 };

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

Sfx.unlock = function () {
  const X = Sfx;
  if (X.ac) { if (X.ac.state === 'suspended') X.ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    const ac = X.ac = new AC();
    X.comp = ac.createDynamicsCompressor(); X.comp.threshold.value = -14; X.comp.knee.value = 12; X.comp.ratio.value = 6; X.comp.attack.value = 0.002; X.comp.release.value = 0.2;
    X.lp = ac.createBiquadFilter(); X.lp.type = 'lowpass'; X.lp.frequency.value = 19000;
    X.master = ac.createGain(); X.master.gain.value = 0.9;
    X.master.connect(X.lp); X.lp.connect(X.comp); X.comp.connect(ac.destination);
    X.sfx = ac.createGain(); X.mus = ac.createGain(); X.ambG = ac.createGain();
    X.sfx.connect(X.master); X.mus.connect(X.master); X.ambG.connect(X.master);
    // noise sources
    const mk = (secs, brown) => { const b = ac.createBuffer(1, Math.floor(ac.sampleRate * secs), ac.sampleRate), d = b.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; } return b; };
    X.white = mk(2, false); X.brown = mk(3, true);
    // echo spaces: a city bounces sound back in slaps, open country rolls
    const ir = (secs, slaps, dark) => { const b = ac.createBuffer(2, Math.floor(ac.sampleRate * secs), ac.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < d.length; i++) { const t = i / d.length; let v = (Math.random() * 2 - 1) * Math.pow(1 - t, dark ? 2.4 : 3.4); lp += (v - lp) * (dark ? 0.12 + 0.3 * (1 - t) : 0.5); d[i] = lp; } for (let s = 0; s < slaps; s++) { const at = Math.floor((0.05 + Math.random() * 0.4) * ac.sampleRate), len = Math.floor(0.03 * ac.sampleRate), g = 0.9 - s * 0.12; for (let i = 0; i < len && at + i < d.length; i++) d[at + i] += (Math.random() * 2 - 1) * g * (1 - i / len); } } return b; };
    X.verbCity = ac.createConvolver(); X.verbCity.buffer = ir(1.7, 5, false);
    X.verbOpen = ac.createConvolver(); X.verbOpen.buffer = ir(3.4, 1, true);
    X.verbG = ac.createGain(); X.verbG.gain.value = 0.5; X.verbCity.connect(X.verbG); X.verbOpen.connect(X.verbG); X.verbG.connect(X.sfx);
    X.verb = X.verbCity;
    X.ok = true; X.setVolumes();
    if (X.pendingMode) { const m = X.pendingMode; X.pendingMode = null; X.setMode(m.mode, m.amb); }
  } catch (e) { X.ok = false; }
};
Sfx.setVolumes = function () {
  const X = Sfx; if (!X.ok) return;
  const s = Save.data.settings, k = X.ducked ? 0.35 : 1, t = X.ac.currentTime;
  X.sfx.gain.setTargetAtTime(s.sfx * k, t, 0.05); X.mus.gain.setTargetAtTime(s.music * 0.8 * k, t, 0.1); X.ambG.gain.setTargetAtTime(s.sfx * 0.75 * k, t, 0.1);
};
Sfx.duck = function (on) { Sfx.ducked = on; Sfx.setVolumes(); };

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
  if (o.verb) { const s = ac.createGain(); s.gain.value = o.verb; g.connect(s); s.connect(X.verb); }
  src.start(t, Math.random() * 1.5); src.stop(t + (o.att || 0.002) + o.dur + 0.05);
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
  if (o.verb) { const s = ac.createGain(); s.gain.value = o.verb; out.connect(s); s.connect(X.verb); }
  osc.start(t); osc.stop(t + (o.att || 0.003) + o.dur + 0.05);
};
Sfx.click = function (at, f, gain) { Sfx.noise({ at, type: 'highpass', f: f || 3200, dur: 0.012, gain: gain || 0.2 }); Sfx.tone({ at, f: (f || 3200) * 0.7, dur: 0.025, gain: (gain || 0.2) * 0.5, type: 'square', lp: 6000 }); };
Sfx.slide = function (at, f0, f1, dur, gain) { Sfx.noise({ at, type: 'bandpass', f: f0, f1, q: 2.2, dur, att: 0.012, gain: gain || 0.16 }); };

// ---- the rifle ---------------------------------------------------------------
Sfx.shot = function (e) {
  const X = Sfx; if (!X.ok) return;
  const c = CAL_SND[e.cal] || CAL_SND.c308, p = c.p;
  Sfx.click(0, 4200, 0.12);
  if (e.quiet) {
    // suppressed: a soft cough, the clack of the action, maybe a far-off crack
    Sfx.noise({ type: 'bandpass', f: 1300 * p, q: 0.8, dur: 0.075, gain: 0.3 + c.boom * 0.08 });
    Sfx.noise({ type: 'lowpass', f: 420, dur: 0.11, gain: 0.26 });
    Sfx.tone({ f: 170 * p, f1: 70, dur: 0.07, gain: 0.22 });
    [2150, 3350, 5200].forEach((f, i) => Sfx.tone({ at: 0.012 + i * 0.003, f: f * p, dur: 0.03, gain: 0.05 }));
    if (!e.sub) Sfx.noise({ at: 0.07, type: 'highpass', f: 2600, dur: 0.09, gain: 0.07, verb: 0.9 });
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
  // the action
  const cyc = e.cycle;
  if (e.action === 'bolt') {
    Sfx.click(cyc * 0.2, 2600, 0.14); Sfx.slide(cyc * 0.3, 2200, 800, cyc * 0.14, 0.14); Sfx.click(cyc * 0.45, 1900, 0.18);
    Sfx.brass(cyc * 0.5); Sfx.slide(cyc * 0.58, 800, 2300, cyc * 0.14, 0.14); Sfx.click(cyc * 0.76, 1500, 0.2);
  } else if (e.action === 'semi') { Sfx.click(0.035, 2300, 0.16); Sfx.click(0.075, 1700, 0.13); Sfx.brass(0.09); }
  else if (e.action === 'single') { Sfx.click(0.25, 2000, 0.1); }
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
  X.stopBeds(); X.mode = mode; X.amb = amb || null; X.nextBeat = X.ac.currentTime + 0.3; X.beat = 0; X.events = [];
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
  if (a.rain) { X.bed({ type: 'highpass', cut: 1800, gain: 0.07 }); X.bed({ type: 'bandpass', cut: 500, q: 0.5, gain: 0.05 }); }
};
Sfx.missionStart = function (sim) {
  const S = sim.S;
  Sfx.tension = 0.25; Sfx.simRef = sim;
  Sfx.setMode('mission', { kind: S.ambience, night: S.pal.dark > 0.5, rain: S.weather === 'rain' || S.weather === 'storm', snow: S.weather === 'snow' });
};
Sfx.missionEnd = function () { Sfx.simRef = null; };
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
  // slow motion muffles the world
  X.lp.frequency.setTargetAtTime(scale < 0.8 ? 1500 + 17000 * Math.pow(scale, 2) : 19000, ac.currentTime, 0.08);
  if (X.windBed) X.windBed.g.gain.setTargetAtTime(clamp(Math.abs(sim.wind()) * 0.012 + (sim.S.weather === 'snow' ? 0.03 : 0), 0, 0.14), ac.currentTime, 0.5);
  // heartbeat while holding breath
  if (sh.holding) { X.heartT -= dt; if (X.heartT <= 0) { const low = 1 - sh.breath / sim.st.breath; X.heart(0.5 + low * 0.7); X.heartT = 0.95 - low * 0.4; } } else X.heartT = 0.2;
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
    case 'fire': X.shot(e); break;
    case 'dry': X.click(0, 2800, 0.25); break;
    case 'reload': X.reload(e.dur, e.action); break;
    case 'charge': Sfx.tone({ type: 'sawtooth', f: 180, f1: 2200, dur: e.dur, att: e.dur * 0.9, gain: 0.12, lp: 3000 }); Sfx.tone({ f: 60, f1: 240, dur: e.dur, att: e.dur * 0.8, gain: 0.1 }); break;
    case 'breath': X.breath(e.on, e.gasp); break;
    case 'click': X.ui('tick'); break;
    case 'impact': X.impact(e.mat === 'interior' ? 'wood' : e.mat, e.dist, back(e.dist)); break;
    case 'hit': X.impact('flesh', e.dist, back(e.dist)); if (e.lethal) Sfx.tone({ at: 0.02, f: 1900, dur: 0.05, gain: 0.05 }); break;
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
