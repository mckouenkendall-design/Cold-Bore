// ---------------------------------------------------------------------------
// Sounds made from real recordings (src/10a_samples.js), shaped per rifle and per part.
//
// The owner picked the recordings (Pixabay) and how each is used:
//   shot_m24          the base sniper shot: every .308-class rifle, and (a little higher, tighter
//                     and shorter) the lighter rifles
//   shot_ar15         a real 5.56 single shot: the Lark, and other people's carbines
//   shot_barrett50    the heavy shot: the .50, and blended under the magnums
//   shot_suppressed   the suppressed shot (two takes, played in turn)
//   bolt_m24          a bolt worked: five clicks, laid out over each rifle's own cycle time
//   reload_*          magazine out, magazine in, charging handle: laid out over each rifle's own
//                     reload time, so the last sound lands exactly as the reload finishes
//   hit_body          a round going into a person (the owner: "it sounds bloody, gory")
//   ricochet_metal    a round striking metal; pitched and cut for stone, wood and body armour
//   glass, explosion, thunder (close, mid, three far), rain
//
// Every rifle still sounds different, with every muzzle device and suppressor: the recording is
// the core, and on top of it each rifle has its own pitch (from its calibre, barrel and voice),
// its own tone (two resonances and a tilt), its own stock knock, barrel ring and thump, and each
// device its own change (a brake's ports and side blast, a flash hider's prongs, a can's ring and
// tock). The place still adds its echoes. Any recording that is missing (not decoded yet, or a
// browser that cannot decode MP3) falls back to the sound made in code (src/10b_sfxgen.js).
// ---------------------------------------------------------------------------
const SGsyn = { report: SG.report, action: SG.action, reload: SG.reload, confirm: SG.confirm, impact: SG.impact, boom: SG.boom, thunder: SG.thunder };

// ---- the kit ---------------------------------------------------------------------
const recA = (name) => (Sfx.recOk || Sfx.recBuf[name] ? Sfx.recArr(name) : null);
// The mechanical recordings carry a faint hiss between the clicks. Cut into pieces and spread out,
// that hiss would stop and start, so it is gated away first: anything more than `below` dB under
// the loudest moment fades to nothing, smoothly. Kept once per recording.
const recGated = new Map();
function recG(name, below) {
  const x = recA(name); if (!x) return null;
  const hit = recGated.get(name); if (hit && hit.src === x) return hit.y;
  const sr = SG.sr, w = Math.max(1, Math.round(sr * 0.004)), n = x.length, y = new Float32Array(n);
  let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(x[i]));
  const thr = pk * Math.pow(10, -(below || 40) / 20), att = 1 - Math.exp(-1 / (sr * 0.001)), rel = 1 - Math.exp(-1 / (sr * 0.03));
  let env = 0, g = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(x[Math.min(n - 1, i + w)]); // look a little ahead so a click's front is never cut
    env += (a - env) * (a > env ? att : rel);
    const want = env >= thr ? 1 : Math.pow(env / thr, 2);
    g += (want - g) * (want > g ? 0.05 : 0.0008);
    y[i] = x[i] * g;
  }
  recGated.set(name, { src: x, y });
  return y;
}
const recM = (name) => ((Sfx.REC && Sfx.REC[name] && Sfx.REC[name].m) || {});
// a copy of x from t0 to t1 seconds, with short fades so a cut never clicks
function recCut(x, t0, t1, fin, fout) {
  const sr = SG.sr, i0 = Math.max(0, Math.round(t0 * sr)), i1 = Math.min(x.length, t1 === undefined ? x.length : Math.round(t1 * sr));
  const y = new Float32Array(Math.max(1, i1 - i0)); y.set(x.subarray(i0, i1));
  const a = Math.min(y.length >> 1, Math.round((fin === undefined ? 0.002 : fin) * sr)), b = Math.min(y.length >> 1, Math.round((fout === undefined ? 0.01 : fout) * sr));
  for (let i = 0; i < a; i++) y[i] *= i / a;
  for (let i = 0; i < b; i++) y[y.length - 1 - i] *= i / b;
  return y;
}
// played faster (r > 1: higher and shorter) or slower (r < 1: lower and longer)
function recRate(x, r) {
  if (Math.abs(r - 1) < 0.0005) return new Float32Array(x);
  let src = x;
  if (r > 1.02) { src = new Float32Array(x); sgFilt(src, ['lp', (SG.sr * 0.45) / r, 0.7], SG.sr); }
  const n = Math.max(1, Math.floor((src.length - 1) / r)), y = new Float32Array(n);
  for (let i = 0; i < n; i++) { const p = i * r, k = p | 0, f = p - k; y[i] = src[k] + (src[k + 1] - src[k]) * f; }
  return y;
}
// shape a shot over time: g0 for its first `a` seconds (the blast), g1 through `b` (its body), g2 after `c` (its tail)
function recShape(x, a, b, c, g0, g1, g2) {
  const sr = SG.sr, A = a * sr, Bn = b * sr, C = c * sr, m = (A + Bn) / 2, n = x.length;
  for (let i = 0; i < n; i++) {
    let g;
    if (i < A) g = g0; else if (i < Bn) { const u = (i - A) / (Bn - A); g = g0 + (g1 - g0) * u; }
    else if (i < C) { const u = (i - Bn) / (C - Bn); g = g1 + (g2 - g1) * u; } else g = g2;
    x[i] *= g;
  }
  return x;
}
const recFilt = (x, F) => { (F || []).forEach((f) => sgFilt(x, f, SG.sr)); return x; };

// ---- the rifle's report -----------------------------------------------------------------
// Which recordings a calibre is built from: a = the main one and its rate, b = a second one
// blended under it (the magnums get the .50's weight under the base shot), and how much of it.
const REC_CAL = {
  c556: { a: 'shot_ar15', ra: 1.0, tail: 0.7, low: -1.5 },
  c65: { a: 'shot_m24', ra: 1.07, short: 0.85, tail: 0.9 },
  c308: { a: 'shot_m24', ra: 1.0, tail: 0.9 },
  c762r: { a: 'shot_m24', ra: 1.03, tail: 0.9 },
  c8mm: { a: 'shot_m24', ra: 0.92, tail: 0.92 },
  c300m: { a: 'shot_m24', ra: 0.92, b: 'shot_barrett50', rb: 1.2, mb: 0.3, tail: 1.25 },
  c338: { a: 'shot_m24', ra: 0.89, b: 'shot_barrett50', rb: 1.14, mb: 0.5, tail: 1.4 },
  c408: { a: 'shot_m24', ra: 0.86, b: 'shot_barrett50', rb: 1.03, mb: 0.75, tail: 1.7 },
  c50: { a: 'shot_barrett50', ra: 1.0, tail: 2.0 },
  c22: { a: 'shot_m24', ra: 1.3, short: 0.5 },
};
// The place the shot is heard in colours the recording's own tail: a city keeps it bright and
// cuts it shorter (the street's slaps take over), a harbour dulls it over the water, a valley rolls
// it on darker, a snowy ridge swallows its top and lets the low end go on longest.
const REC_LOC = { city: { tail: 0.7, lp: 7000 }, harbour: { tail: 0.9, lp: 3600 }, valley: { tail: 1.05, lp: 1900 }, ridge: { tail: 1.15, lp: 1050 }, indoor: { tail: 0.45, lp: 9000 } };
function recTail(x, from, lp, g) {
  const sr = SG.sr, f = new Float32Array(x); sgFilt(f, ['lp', lp, 0.6], sr); sgFilt(f, ['lp', lp, 0.6], sr);
  const a = Math.round(from * sr), b = Math.round((from + 0.15) * sr);
  for (let i = a; i < x.length; i++) { const u = i >= b ? 1 : (i - a) / (b - a); x[i] = (x[i] * (1 - u) + f[i] * u) * (1 + (g - 1) * u); }
  return x;
}
// The rifles that share the base shot each get their own pitch, spread so no two sit close:
// the Kessler's long old barrel lowest, the Marrow's thin light barrel highest.
const REC_GUN = { kessler: 0.86, corvid: 0.93, fenwick: 0.97, halden: 1.0, orlov: 1.075, ibex: 1.16, marrow: 1.23 };
// Suppressors, by the generator's device name. The owner: the start of the suppressed shot is where its snap and intensity are, so it is never
// filtered or squashed; a can only changes the pitch and how long the tail goes on. take = which
// of the two recorded takes (the second, his favourite, has a little more low body; the first is
// sharper), r = pitch, stretch = how far the tail (after the first 40 ms) is drawn out.
// Each rifle's own pitch through a can, spread so no two sit close.
const REC_SUPP_GUN = { aria: 0.8, northwind: 0.845, kessler: 0.89, vantage: 0.93, corvid: 0.97, fenwick: 1.01, halden: 1.06, orlov: 1.11, lark: 1.16, ibex: 1.21, marrow: 1.27 };
// the pitch a suppressed shot is played at (for the tests too: two cans on two rifles can share
// a recording and differ mainly in pitch, which a coarse comparison of their sound cannot see)
function recSuppPitch(S) { const K = REC_CAN[S.dev] || REC_CAN.supl, gr = REC_SUPP_GUN[S.gid] || (1 + 0.2 * (0.55 - S.h)); return clamp(K.r * gr * (S.sup ? 1 : 0.9), 0.6, 1.45); }
SG.recSuppPitch = (S) => (S.D && S.D.supp ? recSuppPitch(S) : 0);
const REC_CAN = {
  supl: { take: 'shot_suppressed_alt', r: 1.05, stretch: 0.9 },     // Featherweight: small, sharp, short
  suph: { take: 'shot_suppressed', r: 0.9, stretch: 1.3 },          // Monolith: big, deep, long
  olcan: { take: 'shot_suppressed', r: 0.98, stretch: 1.1 },        // the Orlov's cheap can (rattles)
  int: { take: 'shot_suppressed', r: 0.95, stretch: 1.0 },          // built in
  intLong: { take: 'shot_suppressed', r: 0.87, stretch: 1.35 },     // built in, long
  intShort: { take: 'shot_suppressed', r: 1.1, stretch: 0.95 },     // built in, short
};
function recReport(S, seed) {
  if (S.coil) return null;
  const D = S.D, supp = !!D.supp, C = REC_CAL[S.cal] || REC_CAL.c308;
  const coreA = recA(supp ? (seed % 2 ? 'shot_suppressed' : 'shot_suppressed_alt') : C.a);
  if (!coreA) return null;
  const rnd = sgRng(seed * 977 + 13), jit = (a) => 1 + (rnd() * 2 - 1) * a, nx = () => (rnd() * 4294967296) >>> 0;
  const h = S.h, V = S.V, dv = (k, d) => sgDv(D, k, d), rt = sgRt(S);
  // the rifle's own pitch: its voice, and a short barrel barks a touch higher
  const voice = (1 + clamp((V.tone - 2000) / 1500, -1, 1) * 0.09 + (22 - V.bl) * 0.005) * jit(0.006);
  const tB = { single: 0.0045, bolt: 0.0035 }[S.action] || 0.003;
  const tone = [['pk', V.tone, 1.6, 5], ['pk', V.tone2, 2, 3.5], ['hs', 3000, 0.7, (V.tilt || 0) * 1.1]];
  let core;
  if (supp) {
    // the recording as it is, pitched for the can, the calibre and the rifle; only its tail drawn out or tightened
    const K = REC_CAN[S.dev] || REC_CAN.supl, take = recA(K.take) || coreA;
    const r = recSuppPitch(S) * jit(0.004);
    core = recRate(take, r);
    const st = K.stretch * (S.sup ? 1 : 1.25) * (1 + 0.2 * (h - 0.55)) * Math.pow(V.bl / 22, 0.6);
    if (Math.abs(st - 1) > 0.01) {
      const a = Math.round(0.04 * SG.sr), xf = Math.round(0.015 * SG.sr), tl = recRate(core.subarray(a), 1 / st), y = new Float32Array(a + tl.length);
      y.set(core.subarray(0, Math.min(core.length, a + xf)));
      for (let i = 0; i < tl.length; i++) { const u = i < xf ? i / xf : 1; y[a + i] = y[a + i] * (1 - u) + tl[i] * u; }
      core = y;
    }
    // the rifle's own colour, in the tail only (from 40 ms on): the snap in front is left alone
    const col = recFilt(new Float32Array(core), tone), a = Math.round(0.04 * SG.sr), xf = Math.round(0.02 * SG.sr);
    for (let i = a; i < core.length; i++) { const u = i < a + xf ? (i - a) / xf : 1; core[i] = core[i] * (1 - u) + col[i] * u; }
  } else {
    const gr = REC_GUN[S.gid];
    core = recRate(coreA, (gr ? gr * (1 + (22 / V.bl - 22 / (SG_GUN[S.gid] || V).bl) * 0.12) * jit(0.006) : C.ra * voice));
    if (C.b) { // a magnum: the base shot with the .50's weight blended under it
      const bx = recA(C.b);
      if (bx) {
        const y = recRate(bx, C.rb * voice), mix = new Float32Array(Math.max(core.length, y.length));
        for (let i = 0; i < mix.length; i++) mix[i] = (i < core.length ? core[i] * (1 - C.mb * 0.5) : 0) + (i < y.length ? y[i] * C.mb : 0);
        core = mix;
      }
    }
    const F = tone.slice();
    F.push(['ls', 220, 0.7, C.low !== undefined ? C.low : (h - 0.45) * 9]);           // heavier rounds: more weight
    if (D.sizzle > 1) F.push(['hs', 5500, 0.7, Math.min(6, (D.sizzle - 1) * 5)]);     // a device's hiss of gas at the very top
    if (D.prongs) F.push(['pk', 4200, 1.2, 3]);                                         // a flash hider's prongs colour the blast
    if (D.lp) F.push(['lp', D.lp * 1.8, 0.7]);
    if (D.mid) F.push(['pk', (D.midF || 1900) * (D.fixF ? 1 : Math.pow(V.tone / 2000, 0.6)), 0.9, D.mid]);
    if (D.low) F.push(['pk', 520, 1.0, D.low]);
    if (S.soft) F.push(['lp', 5000, 0.7]);
    recFilt(core, F);
    const bark = Math.pow(22 / V.bl, 0.5) * (S.soft ? 0.72 : 1);
    recShape(core, 0.02, 0.07, 0.3, Math.pow(dv('blast'), 0.8) * Math.pow(bark, 0.6), Math.pow(dv('body'), 0.8), clamp(dv('tail'), 0.6, 1.4) * (C.short || 1) * (C.tail || 1));
    // a heavy round's roll goes on longer and lower: its tail (not its blast) is drawn out
    const ts = 1 - 0.3 * Math.max(0, h - 0.6);
    if (ts < 0.995) { const a = Math.round(0.25 * SG.sr), xf = Math.round(0.03 * SG.sr), tl = recRate(core.subarray(a), ts), y = new Float32Array(a + tl.length); y.set(core.subarray(0, a + xf)); for (let i = 0; i < tl.length; i++) { const u = i < xf ? i / xf : 1; y[a + i] = y[a + i] * (1 - u) + tl[i] * u; } core = y; }
    if (C.short) { const keep = Math.round(core.length * C.short), f = Math.round(0.25 * SG.sr); for (let i = 0; i < f && keep - f + i < core.length; i++) core[keep - f + i] *= 1 - i / f; core = core.subarray(0, keep); }
  }
  const PL = REC_LOC[S.loc] || REC_LOC.valley;
  recTail(core, supp ? 0.12 : 0.2, PL.lp * (supp ? 1.3 : 1), PL.tail);
  const B = sgBuf(Math.max(sgLen(S, rt), core.length / SG.sr + 0.15));
  // the striker or hammer falling, just ahead of the shot
  const r0 = V.ring;
  if (!supp) sgModes(B, { at: 0, modes: [[r0[0] * 0.61, 0.006, 1], [r0[1] * 0.58, 0.004, 0.7], [r0[2] * 0.66, 0.0025, 0.5]], gain: 0.04, seed: nx() });
  // the recording, the heart of it
  sgMix(B, tB, core, null, 1, 0);
  // a brake's or compensator's ports: the front of the blast again, a fraction of a millisecond later
  if (!supp && D.ports) { const fr = recCut(core, 0, 0.015, 0.0002, 0.004); D.ports.forEach((d) => sgMix(B, tB + d, fr, null, (D.g2 || 0.55) * 0.55, 0)); }
  // the Anvil's hammerhead brake: a chesty second blast a few milliseconds behind the first
  if (S.dev === 'hammer') sgMix(B, tB + 0.012, recFilt(recCut(core, 0, 0.06, 0.0005, 0.025), [['lp', 2200, 0.7]]), null, 0.7, 0);
  // weight you feel, so a phone speaker still thumps (lighter than when it was all code)
  const lowK = S.low || 1, f0 = (118 - 72 * h) * jit(0.03) / Math.sqrt(lowK);
  if (!supp) sgTone(B, { at: tB, f: f0, f1: f0 * 0.45, glide: 0.05 + 0.07 * h, att: 0.0025, tau: (0.06 + 0.2 * h) * lowK, dur: (0.06 + 0.2 * h) * 6 * lowK, gain: (0.12 + 0.12 * h + 0.15 * h * h * h) * dv('sub') * lowK, drive: 1.6 });
  // the barrel's ring and the stock's knock: each rifle's own
  const rK = V.ringT * (1.3 - V.bw);
  if (!supp) sgModes(B, { at: tB, modes: V.ring.map((f, i) => [f * jit(0.01), [0.075, 0.048, 0.03][i] * rK, [1, 0.65, 0.4][i]]), gain: 0.05 * (1.2 - 0.7 * V.bw) * dv('ring'), seed: nx() });
  if (!supp) sgKnock(B, tB + 0.0008, V, 0.13 * dv('knock'), nx());
  // the device's own sound
  if (D.prongs) { const pf = Math.pow(V.tone2 / 4500, 0.35); sgModes(B, { at: tB + 0.0002, modes: [[5320 * pf * jit(0.02), 0.11, 1], [6680 * pf * jit(0.02), 0.08, 0.8], [8140 * pf * jit(0.02), 0.06, 0.6], [10300 * pf, 0.035, 0.4]], gain: 0.3, seed: nx() }); }
  if (D.chuff) sgNoise(B, { at: tB + 0.0003, filt: [['bp', 3200 * jit(0.04), 1.3]], att: 0.0004, tau: 0.016, dur: 0.09, gain: 0.9, width: 0.2, seed: nx() });
  if (D.side) [-0.75, 0.75].forEach((pan, i) => sgNoise(B, { at: tB + 0.0003 + i * 0.0004, filt: [['bp', V.tone * 0.9 * jit(0.05), 1.6]], att: 0.0006, tau: 0.022 + 0.02 * h, dur: 0.15, gain: 0.35, pan, width: 0.1, seed: nx() }));
  if (D.zing) { sgNoise(B, { at: tB + 0.0002, filt: [['bp', 6800 * jit(0.04), 2.2]], att: 0.0008, tau: 0.011, dur: 0.07, gain: 0.55, width: 0.6, seed: nx() }); sgModes(B, { at: tB + 0.0003, modes: [[4650 * jit(0.02), 0.04, 1], [7230, 0.03, 0.7], [9810, 0.02, 0.5]], gain: 0.06, seed: nx() }); }
  if (supp) {
    if (D.rattle) [0.009, 0.019, 0.031, 0.046].forEach((d, i) => sgModes(B, { at: tB + d * jit(0.1), modes: [[2930 * jit(0.03), 0.012, 1], [4870, 0.008, 0.6]], gain: 0.1 * (1 - i * 0.2), seed: nx() }));
  }
  // a semi-automatic's action, inside the shot: the real carrier slam (the charging handle's
  // recording, cut short and pitched to the rifle); the Lark's own recording already has its action
  const M = SG_SEMI[V.mech];
  if (M && !(S.cal === 'c556' && !supp)) {
    const ch = recG('reload_charge', 34);
    if (ch) {
      const sl = recM('reload_charge').slap || 0.063, rr = { ar: 1.08, ar10: 0.97, svd: 0.88, vss: 1.0, rimfire: 1.3 }[V.mech] || 1;
      const slam = recRate(recCut(ch, Math.max(0, sl - 0.012), sl + 0.11, 0.002, 0.03), rr);
      sgMix(B, tB + M.hits[M.hits.length > 2 ? 1 : 0][0] - 0.012 / rr, slam, null, (supp ? 0.42 : 0.28) * (V.mech === 'svd' ? 1.6 : 1), 0.15);
    }
    sgBrass(B, tB + M.brass, S.ground, false, nx());
  }
  // the place: its echoes (the recording brings its own tail, so the made one is kept light)
  const S2 = Object.assign({}, S, { D: Object.assign({}, D, { tail: dv('tail') * (0.2 + 1.3 * h * h * h), slap: dv('slap') * 0.85, far: dv('far') * (0.25 + 1.0 * h * h) }) });
  sgPlace(B, S2, tB, rt, rnd);
  // a suppressed shot is never pushed into the soft clip: its sharp front is the point of it
  return sgFinish(B, supp ? { loud: S.loud + (S.dev.indexOf('int') === 0 ? 1.5 : 0.5), peakMax: 1.0, knee: 0.97, span: 0.6 } : { loud: S.loud + (S.dev === 'hammer' ? 1 : 0), peakMax: 2.2, span: 0.6 });
}
SG.report = function (S, seed) { return recReport(S, seed) || SGsyn.report(S, seed); };

// ---- the bolt ---------------------------------------------------------------------------
// The recorded bolt, as five pieces (lift, draw back, the case thrown out, push forward, turn
// down), laid out over the rifle's own cycle: a quick bolt closes them up, a slow one spreads
// them out. Each kind of bolt is pitched a little differently, heavier ones lower.
const REC_BOLT = { bolt: 1.0, 'bolt-s': 1.05, mauser: 0.9, 'bolt-t': 1.03, 'bolt-l': 1.09, 'bolt-m': 0.96, 'bolt-mh': 0.94, 'bolt-x': 0.93, 'bolt-50': 0.82 };
function recBoltPieces(rate) {
  const x = recG('bolt_m24', 30); if (!x) return null;
  const m = recM('bolt_m24'), on = m.on || [0.075, 0.21, 0.408, 0.642, 0.876], cut = m.cut || [0, 0.19, 0.39, 0.62, 0.85];
  return on.map((o, i) => ({ x: recRate(recCut(x, cut[i], i + 1 < cut.length ? cut[i + 1] - 0.002 : undefined, i ? 0.003 : 0.002, i + 1 < cut.length ? 0.025 : 0.08), rate), on: (o - cut[i]) / rate, t: (o - on[0]) / rate }));
}
// lay pieces [from..to] so the first one's click lands at t0 and the gaps between clicks are stretched by k
function recLay(B, P, from, to, t0, k, gain) {
  for (let i = from; i <= to; i++) sgMix(B, t0 + (P[i].t - P[from].t) * k - P[i].on, P[i].x, null, gain, 0);
  return t0 + (P[to].t - P[from].t) * k;
}
function recAction(S, seed) {
  if (S.coil || !SG_BOLT[S.V.mech]) return null;
  const rnd = sgRng(seed * 31 + 7), rate = (REC_BOLT[S.V.mech] || 1) * (1 + (rnd() * 2 - 1) * 0.01), P = recBoltPieces(rate);
  if (!P) return null;
  const c = S.cycle, span = P[4].t - P[0].t, k = clamp((c * 0.83 - 0.16) / span, 0.7, 1.9);
  const B = sgBuf(span * k + 0.9), t0 = 0.03 + P[0].on;
  recLay(B, P, 0, 4, t0, k, 1);
  if (S.V.mech === 'mauser') sgNoise(B, { at: t0 + (P[3].t - P[0].t) * k - 0.05, filt: [['bp', 900, 1.5]], att: 0.04, tau: 0.03, dur: 0.08, gain: 0.08, seed: (rnd() * 1e9) | 0 }); // a Mauser cocks as it closes
  sgBrass(B, t0 + (P[2].t - P[0].t) * k + 0.3, S.ground, SG_BOLT[S.V.mech].big ? 1 : 0, (rnd() * 1e9) | 0);
  B.at = Math.max(0.05, 0.17 * c - t0);
  return sgFinish(B, { loud: -15, peakMax: 1.6 });
}
SG.action = function (S, seed) { return recAction(S, seed) || SGsyn.action(S, seed); };

// ---- reloads ------------------------------------------------------------------------------
// Laid out over the rifle's real reload time `dur`, so the last sound (the charging handle let
// go, or the bolt closing) lands right as the reload finishes and the rifle can fire again.
function recReload(S, dur, seed) {
  if (S.coil) return null;
  const out = recG('reload_magout', 34), inn = recG('reload_magin', 34), chg = recG('reload_charge', 34);
  if (!out || !inn || !chg) return null;
  const rnd = sgRng(seed * 131 + 3), mech = S.V.mech, B = sgBuf(dur + 0.9);
  const mo = recM('reload_magout').click || 0.189, mi = recM('reload_magin').seat || 0.483, ms = recM('reload_charge').slap || 0.063;
  const end = Math.max(0.6, dur - 0.08);
  const put = (x, mark, at, r, g) => { const y = recRate(x, r); sgMix(B, at - mark / r, y, null, g, 0); };
  const pr = { ar: 1.0, ar10: 0.95, svd: 0.9, vss: 0.98, rimfire: 1.2 }[mech];
  if (pr) { // a magazine rifle with a charging handle
    const tOut = Math.min(0.2, end * 0.12), tIn = clamp(end * 0.55, tOut + 0.4, end - 0.35);
    put(out, mo, tOut + mo / pr, pr, 0.9);
    put(inn, mi, tIn, pr, 1);
    put(chg, ms, end, pr * (1 + (rnd() * 2 - 1) * 0.01), 1);
  } else { // a bolt rifle (and the Ibex's single shot): open, load, close
    const rate = (REC_BOLT[mech] || 1), P = recBoltPieces(rate); if (!P) return null;
    const openEnd = recLay(B, P, 0, 2, 0.03 + P[0].on, 0.9, 0.9);
    const close0 = end - (P[4].t - P[3].t);
    if (mech === 'single') { // the breech thrown open, one round slid in, shut
      put(recCut(inn, 0.08, 0.32, 0.003, 0.03), 0.14, clamp(end * 0.55, openEnd + 0.2, close0 - 0.15), 1.25, 0.7);
    } else if (mech === 'mauser') { // a stripper clip: in, five rounds thumbed down, the clip flicked away
      const t = clamp(end * 0.38, openEnd + 0.15, close0 - 0.6);
      put(recCut(inn, 0.1, 0.3, 0.003, 0.03), 0.122, t, 1.1, 0.8);
      const thumb = recCut(inn, mi - 0.03, mi + 0.07, 0.002, 0.03);
      for (let i = 0; i < 5; i++) put(thumb, 0.03, t + 0.12 + i * Math.min(0.09, (close0 - t - 0.3) / 6), 1.3 + i * 0.03, 0.32);
    } else { // a detachable box magazine
      const tOut = clamp(openEnd + 0.22, 0, close0 - 0.8), tIn = clamp(end * 0.6, tOut + 0.4, close0 - 0.2);
      put(out, mo, tOut, rate, 0.75);
      put(inn, mi, tIn, rate, 0.9);
    }
    recLay(B, P, 3, 4, close0, 1, 1);
  }
  return sgFinish(B, { loud: -15, peakMax: 1.6 });
}
SG.reload = function (S, dur, seed) { return recReload(S, dur, seed) || SGsyn.reload(S, dur, seed); };

// ---- hits ------------------------------------------------------------------------------
// The confirm, right as the round lands: the recorded hit, started just before its peak so the
// loudest moment lands on the frame of the hit, with a punch under it for weight.
function recConfirm(kind, seed) {
  const rnd = sgRng((seed || 1) * 7 + 101), j = (a) => 1 + (rnd() * 2 - 1) * a, nx = () => (rnd() * 4294967296) >>> 0;
  const B = sgBuf(1.2);
  if (kind === 'vest') {
    const r = recA('ricochet_metal'); if (!r) return null;
    const on = recM('ricochet_metal').on || 0.012;
    // the steel plate: the strike, bright, and the plate ringing on ("TANK")
    sgMix(B, 0, recFilt(recRate(recCut(r, Math.max(0, on - 0.002), undefined, 0.0005, 0.08), 1.05 * j(0.02)), [['hp', 3000, 0.7], ['pk', 4800, 1.2, 5]]), null, 1, 0);
    sgModes(B, { at: 0.0005, modes: [[3480 * j(0.02), 0.25, 1], [5210 * j(0.02), 0.18, 0.7], [7320, 0.1, 0.5]], gain: 0.25, seed: nx() });
    return sgFinish(B, { loud: -10, peakMax: 2 });
  }
  const x = recA('hit_body'); if (!x) return null;
  const pk = recM('hit_body').peak || 0.036, from = Math.max(0, pk - 0.012);
  if (kind === 'head') {
    sgMix(B, 0, recRate(recCut(x, from, undefined, 0.0008, 0.1), 1.12 * j(0.02)), null, 1, 0);
    sgNoise(B, { filt: [['hp', 3000, 0.7]], att: 0.0002, tau: 0.0025, dur: 0.02, gain: 0.45, width: 0.2, seed: nx() });            // crack
    sgModes(B, { at: 0.002, modes: [[1050 * j(0.03), 0.018, 1], [2380, 0.01, 0.5]], gain: 0.2, seed: nx() });                        // the skull's tock
    sgTone(B, { at: 0.002, f: 175, f1: 62, glide: 0.035, att: 0.0015, tau: 0.05, dur: 0.3, gain: 0.35, drive: 2.2 });               // punch
    return sgFinish(B, { loud: -9, peakMax: 2 });
  }
  if (kind === 'body') {
    sgMix(B, 0, recRate(recCut(x, from, undefined, 0.0008, 0.12), 0.97 * j(0.02)), null, 1, 0);
    sgTone(B, { at: 0.002, f: 140, f1: 58, glide: 0.04, att: 0.0015, tau: 0.06, dur: 0.35, gain: 0.4, drive: 2.2 });                // punch
    sgTone(B, { at: 0.003, f: 86, f1: 36, glide: 0.07, att: 0.002, tau: 0.12, dur: 0.6, gain: 0.35, drive: 1.3 });                  // thoom
    return sgFinish(B, { loud: -8.5, peakMax: 2 });
  }
  // a hit that does not kill: short and dull
  sgMix(B, 0, recFilt(recRate(recCut(x, from, from + 0.2, 0.0008, 0.06), 0.9 * j(0.03)), [['lp', 3000, 0.7]]), null, 1, 0);
  return sgFinish(B, { loud: -15, peakMax: 2 });
}
SG.confirm = function (kind, seed) { return recConfirm(kind, seed) || SGsyn.confirm(kind, seed); };
// The impact where it lands (the engine delays it by the sound's travel and dulls it with distance).
function recImpact(mat, seed, wet) {
  const rnd = sgRng((seed || 1) * 13 + sgHash(mat)), j = (a) => 1 + (rnd() * 2 - 1) * a, nx = () => (rnd() * 4294967296) >>> 0;
  const hit = recA('hit_body'), ric = recA('ricochet_metal'), gl = recA('glass');
  const B = sgBuf(2.4);
  const loud = { flesh: -11, head: -11, glass: -12, metal: -12, snow: -15 }[mat] || -12;
  if (mat === 'flesh' || mat === 'head') {
    if (!hit) return null;
    const y = recRate(recCut(hit, 0, wet ? undefined : 0.24, 0.001, wet ? 0.12 : 0.06), (mat === 'head' ? 1.1 : 0.98) * j(0.03));
    if (!wet) recFilt(y, [['lp', 2600, 0.7]]);
    sgMix(B, 0, y, null, 1, 0);
  } else if (mat === 'metal') {
    if (!ric) return null;
    sgMix(B, 0, recRate(ric, j(0.08)), null, 1, 0);
  } else if (mat === 'hard') { // stone, concrete: the strike, short, with grit
    if (!ric || !hit) return null;
    sgMix(B, 0, recFilt(recRate(recCut(ric, 0, 0.18, 0.0005, 0.07), 0.78 * j(0.04)), [['hp', 300, 0.7]]), null, 1, 0);
    sgMix(B, 0.002, recFilt(recRate(recCut(hit, 0.02, 0.5, 0.001, 0.15), 1.15 * j(0.04)), [['lp', 5000, 0.7], ['hp', 500, 0.7]]), null, 0.55, 0);
  } else if (mat === 'wood') {
    if (!ric || !hit) return null;
    // wood: a short hollow "thock", brighter and much shorter than dirt, with splinters
    sgMix(B, 0, recFilt(recRate(recCut(ric, 0, 0.07, 0.0005, 0.04), 0.62 * j(0.04)), [['lp', 3600, 0.7], ['pk', 900, 1.5, 6]]), null, 1, 0);
    sgModes(B, { modes: [[310 * j(0.05), 0.03, 1], [720 * j(0.05), 0.02, 0.6], [1380, 0.012, 0.4]], gain: 0.35, seed: nx() });
    sgMix(B, 0.001, recFilt(recRate(recCut(hit, 0.02, 0.12, 0.001, 0.05), 0.9 * j(0.04)), [['lp', 3000, 0.7]]), null, 0.4, 0);
    for (let i = 0; i < 6; i++) sgNoise(B, { at: rnd() * 0.1, filt: [['bp', 2200 + rnd() * 3000, 5]], att: 0.0003, tau: 0.003, dur: 0.015, gain: 0.1 + rnd() * 0.08, width: 0.8, seed: nx() }); // splinters
  } else if (mat === 'glass') {
    if (!gl) return null;
    sgMix(B, 0, recRate(gl, j(0.05)), null, 1, 0);
  } else if (mat === 'snow') {
    if (!hit) return null;
    sgMix(B, 0, recFilt(recRate(recCut(hit, 0, 0.22, 0.001, 0.08), 0.7 * j(0.04)), [['lp', 1100, 0.7]]), null, 1, 0);
  } else if (mat === 'water') {
    return null; // still made in code
  } else { // dirt: the same strike, deeper and dull, dry, so a miss never sounds like a hit
    if (!hit) return null;
    sgMix(B, 0, recFilt(recRate(recCut(hit, 0, 0.36, 0.001, 0.12), 0.82 * j(0.04)), [['lp', 2100, 0.7], ['pk', 180, 1, 4]]), null, 1, 0);
  }
  return sgFinish(B, { loud, peakMax: 2 });
}
SG.impact = function (mat, seed, wet) { return recImpact(mat, seed, wet) || SGsyn.impact(mat, seed, wet); };

// ---- the explosion and thunder --------------------------------------------------------------
function recBoom(loc, seed) {
  const x = recA('explosion'); if (!x) return null;
  const L = SG_LOC[loc] || SG_LOC.valley, B = sgBuf(x.length / SG.sr + 1.6), y = recRate(x, seed === 2 ? 0.93 : 1);
  sgMix(B, 0, y, null, 1, 0);
  const dry = sgTake(B, 0, 0.12);
  (L.walls || [[0.7, 0.3, 700, 0.4], [1.3, 0.22, 500, -0.4]]).forEach((w) => sgEcho(B, dry, { at: w[0] * 1.2, gain: w[1] * 0.5, pan: w[3], filt: [['lp', w[2], 0.7]] }));
  return sgFinish(B, { loud: -4.5, peakMax: 2.6, span: 1 });
}
SG.boom = function (loc, seed) { return recBoom(loc, seed) || SGsyn.boom(loc, seed); };
function recThunder(kind, seed) {
  const s = seed || 1, name = kind === 'far' ? ['thunder_far_a', 'thunder_far_b', 'thunder_far_c', 'thunder_mid'][(s - 1) % 4] : 'thunder_close';
  const x = recA(name); if (!x) return null;
  const y = recRate(x, kind === 'far' ? 1 : (s % 2 ? 1 : 0.93)), B = sgBuf(y.length / SG.sr + 0.05);
  // a stereo spread, a little different in each ear, so it rolls across the sky
  const l = new Float32Array(y), r = new Float32Array(y.length), d = Math.round(SG.sr * 0.011);
  for (let i = 0; i < y.length; i++) r[i] = y[Math.max(0, i - d)];
  sgFilt(r, ['pk', 300, 0.8, -2], SG.sr);
  sgMix(B, 0, l, r, 1, 0);
  return sgFinish(B, { loud: kind === 'far' ? (name === 'thunder_mid' ? -11 : -13) : -5.5, peakMax: 2.4, span: 3 });
}
SG.thunder = function (kind, seed) { return recThunder(kind, seed) || SGsyn.thunder(kind, seed); };

// ---- the Range's steel plates ---------------------------------------------------------------
// The ricochet's strike, a little higher, with the plate ringing on under it.
const SGsynPlate = SG.plate;
SG.plate = function (seed) {
  const r = recA('ricochet_metal'); if (!r) return SGsynPlate(seed);
  const rnd = sgRng((seed || 1) * 53), f = 780 * (0.94 + rnd() * 0.12), B = sgBuf(2.6), on = recM('ricochet_metal').on || 0.012;
  sgMix(B, 0, recRate(recCut(r, Math.max(0, on - 0.002), undefined, 0.0005, 0.1), 1.15 * (0.97 + rnd() * 0.06)), null, 1, 0);
  sgModes(B, { at: 0.0003, modes: [[f, 0.55, 1], [f * 1.59, 0.42, 0.8], [f * 2.14, 0.33, 0.6], [f * 2.65, 0.24, 0.5], [f * 3.16, 0.18, 0.35]], gain: 0.13, seed: (rnd() * 1e9) | 0, spread: 0.004 });
  return sgFinish(B, { loud: -10, peakMax: 1.8 });
};
