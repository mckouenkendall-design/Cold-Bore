// ---------------------------------------------------------------------------
// The shot and the hit, as seen through the scope. Picture only: nothing here
// changes the simulation (the aim, the recoil the rifle really has, anybody's
// timing). src/06_view.js hands its 'fire', 'hit', 'kill' and 'wound' events here.
//   fxShot   the rifle goes off: the picture kicks, bounces and settles over the
//            bolt cycle, and a heavy round leaves smoke drifting across the glass
//   fxHit    a round meets a person: a dark red burst sized by the calibre, a
//            little spray back toward us, flecks of their coat, a one-frame flash
//            on the figure and a short freeze of the scope picture (hit-stop).
//            With gore off it is dust and torn cloth, never blood.
// The spray out of the far side of a body is the figure's own (figMist in
// src/03_figures.js), because it has to be drawn behind the body.
// ---------------------------------------------------------------------------

// How much smoke a calibre leaves hanging in front of the scope (0 none, 1 a .50).
const HFX_SMOKE = { c300m: 0.72, c338: 0.82, c408: 0.92, c50: 1, c308: 0.3, c8mm: 0.34, c762r: 0.34, c65: 0.24, c556: 0.16 };
const HFX_STOP = 0.08; // seconds the scope picture holds still on a hit

View.prototype.fxShot = function (e, sim) {
  const V = this, rec = e.recoil || 5;
  V.flash = e.quiet ? 0.25 : 1; V.blackout = e.quiet ? 0.5 : 1;
  V.shake = Math.min(0.7, 0.12 + rec * 0.025); // a little rattle on top of the kick
  // the kick, as a share of the scope's half height: a .22 barely twitches, a .50 throws the picture
  V.kick = { t: 0, A: clamp(rec * 0.0085, 0.008, 0.2), cyc: Math.max(0.3, e.cycle || 1), lat: Math.random() < 0.5 ? -1 : 1 };
  const sm = (HFX_SMOKE[e.cal] || 0) * (e.quiet ? 0.3 : 1) * (e.sub ? 0.4 : 1);
  if (sm > 0.05) V.smoke = { t: 0, k: sm, seed: Math.random() * 100, wind: sim.wind ? sim.wind() : 0 };
};

// Where the kick has the picture right now (CSS pixels), worked out once a frame.
View.prototype.fxCam = function (dt) {
  const V = this, K = V.kick; V.kx = 0; V.ky = 0;
  if (!K) return;
  K.t += dt;
  const t = K.t, A = K.A * V.R;
  if (t > K.cyc + 0.4) { V.kick = null; return; }
  // the jolt: up and back at once, a fast bounce that dies away, a little sideways
  let y = -A * Math.exp(-t * 7.5) * Math.cos(t * 26);
  let x = A * 0.32 * K.lat * Math.exp(-t * 5.5) * Math.sin(t * 15 + 0.7);
  // then, while the bolt is worked, the picture sags a touch and comes home
  const u = clamp(t / K.cyc, 0, 1), s = Math.sin(Math.PI * u) * smooth(t / 0.2);
  y += A * 0.14 * s; x -= A * 0.07 * K.lat * s;
  V.kx = x; V.ky = y;
};

// Muzzle smoke drifting across the glass, and the bookkeeping of the figure flash.
// Drawn after the world and before the lens, so it is part of the picture, under the reticle.
View.prototype.drawGlassFx = function (sim, cam, dt) {
  const V = this, ctx = V.ctx;
  if (V.flashing && V.flashing.length) { for (let i = V.flashing.length - 1; i >= 0; i--) { const a = V.flashing[i]; if (--a._flash <= 0) { a._flash = 0; V.flashing.splice(i, 1); } } }
  const S = V.smoke; if (!S) return;
  S.t += dt;
  const t = S.t, life = 0.9 + 0.8 * S.k; if (t > life) { V.smoke = null; return; }
  const cx = cam.cx, cy = cam.cy, R = V.R, pal = sim.S && sim.S.pal, dark = pal ? pal.dark || 0 : 0;
  const col = dark > 0.5 ? '#6f7680' : '#d5d8dc', u = t / life;
  const fade = smooth(t / 0.08) * (1 - u) * (1 - u);
  if (fade < 0.01) return;
  // a cloud rolling up from below the line of sight (the muzzle sits under the scope) and off with the wind
  const drift = clamp(S.wind * 0.09, -0.6, 0.6), blast = 1 + 0.8 * (1 - smooth(t / 0.35)); // thick at first, thinning as it spreads
  for (let i = 0; i < 8; i++) {
    const ph = S.seed + i * 2.17, sx = Math.sin(ph) * 0.5, gr = easeOut(t / (0.45 + 0.1 * i));
    const x = cx + R * (sx * 0.6 + drift * t * (0.8 + 0.1 * i) + (i - 3.5) * 0.13), y = cy + R * (1.1 - (0.6 + 0.15 * Math.cos(ph)) * gr - 0.14 * t);
    const r = R * (0.24 + 0.55 * gr) * (0.7 + 0.5 * S.k) * (0.85 + 0.25 * Math.cos(ph * 1.7));
    const a = 0.3 * S.k * fade * blast * (0.75 + 0.25 * Math.sin(ph * 3.1));
    if (a < 0.01 || r < 2) continue;
    const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
    g.addColorStop(0, rgba(col, a)); g.addColorStop(0.55, rgba(col, a * 0.55)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
};

// The hit-stop: true while the scope picture should stay as it is (the frame of the hit).
View.prototype.fxHold = function (dt) {
  const V = this;
  if (!(V.hs > 0)) return false;
  V.hs -= dt;
  if (!V.hsDrawn) { V.hsDrawn = true; return false; }
  return true;
};

// 'kill' and 'wound' come just before the 'hit' they belong to: remember who it was.
View.prototype.fxHurt = function (e, sim) { this._hurt = { id: e.id, t: sim.t }; };

View.prototype.fxHit = function (e, sim) {
  const V = this, hu = V._hurt, a = hu && Math.abs(hu.t - sim.t) < 1e-6 ? sim.byId[hu.id] : null;
  const st = sim.st || {}, C = rdCal(st.cal), gore = V.gore !== false, z = e.plane.z;
  const R = a && a.rd && a.dead ? a.rd : null;
  let b = null; for (let i = sim.bullets.length - 1; i >= 0 && !b; i--) b = sim.bullets[i];
  const v = R && R.v ? R.v : b ? [b.vx, b.vy, b.vz] : [0, 0, 800], vi = Math.hypot(v[0], v[1], v[2]) || 1;
  const pw = R ? R.power : rdPower(C.kg, vi), head = e.part === 'head', limb = !e.lethal;
  const k = (limb ? 0.55 : head ? 1.05 : 1) * (0.5 + 0.55 * C.size + 0.25 * pw);
  const rng = makeRng(((e.x * 9973) ^ (e.y * 7919) ^ (sim.t * 977)) | 0);
  // the burst: a ragged star of spikes round the hole
  const sp = []; const n = 8 + Math.round(4 * C.size);
  for (let i = 0; i < n; i++) sp.push((i + rng.r(-0.3, 0.3)) / n * TAU, rng.r(0.45, 1));
  // spray thrown back toward us (and, from a round that went through, more of it), falling as it flies
  const nd = Math.round((gore ? 7 : 5) + 16 * k * (gore ? 1 : 0.5)), drops = new Float32Array(nd * 7);
  const vx0 = v[0] / vi;
  for (let i = 0; i < nd; i++) {
    const an = rng.f() * TAU, sp2 = rng.r(0.6, 2.6) * (0.7 + 0.6 * k);
    drops.set([e.x, e.y, z - 0.05, Math.cos(an) * sp2 - vx0 * 1.5, Math.sin(an) * sp2 * 0.8 + 0.8, -rng.r(1.2, 4.5) * (0.6 + 0.6 * k), rng.r(0.006, 0.016) * (0.7 + 0.5 * k)], i * 7);
  }
  // flecks of whatever they wear where the round went in
  const L = (a && a.look) || {}, fg = a && a._fg;
  const cloth = head ? (L.hat && L.hat !== 'helmet' ? L.hatCol || '#2a2d33' : L.hair ? L.hairCol || '#4a3a2a' : '#1a1c21') : (e.part === 'leg' ? (fg && fg.legs) || '#2a2f3a' : L.coat || L.smock || L.dress || L.vest || (fg && fg.top) || '#3c424b');
  const nf = Math.round(3 + 5 * k), fl = new Float32Array(nf * 10);
  for (let i = 0; i < nf; i++) {
    const an = rng.r(-0.3, Math.PI + 0.3), s2 = rng.r(0.8, 2.6) * (0.7 + 0.4 * k);
    fl.set([e.x, e.y, z - 0.04, Math.cos(an) * s2 - vx0 * 1.2, Math.sin(an) * s2 * 0.9 + 0.5, -rng.r(0.4, 2), rng.f() * TAU, rng.r(-18, 18), rng.r(0.014, 0.03), rng.r(0.008, 0.016)], i * 10);
  }
  V.add({ k: 'hitfx', t: 0, life: 1.1, draw: hfxDraw, x: e.x, y: e.y, z: z - 0.06, R: (0.07 + 0.2 * C.size + 0.05 * pw) * (limb ? 0.65 : head ? 1.1 : 1), sp, drops, nd, fl, nf, gore, cloth: mix(cloth, '#000000', 0.08), dust: '#cfc6b6' });
  // the figure flashes for one frame, and the picture holds on it (never during the kill camera, which has its own beat)
  const G = CB.Game;
  if (!(G && (G.cine || G.coach)) && V.mode !== 'plain') {
    if (a) { a._flash = 1; (V.flashing || (V.flashing = [])).push(a); }
    V.hs = HFX_STOP; V.hsDrawn = false;
  }
  V.hitMark = e.lethal ? 1 : 0.5;
  // a wound that does not kill: note where on the body it is, for the picture (see figWounded in src/03_figures.js)
  if (a && !a.dead && !e.lethal) figNoteWound(a, e.part, e.x - a.x, e.y - a.y, sim.t);
};

// Draws one hit (ctx is in CSS pixels; the particle loop has set it up).
function hfxDraw(V, sim, ctx, f, dt) {
  const t = f.t, P = V.project(sim, f.x, f.y, f.z), s = P[2], g = 9.8 * dt;
  // ---- the burst at the hole: at full size almost at once, then gone in a quarter of a second
  if (t < 0.3) {
    const grow = 0.6 + 0.4 * easeOut(t / 0.035), a = t < 0.07 ? 1 : 1 - (t - 0.07) / 0.23, r = f.R * s * grow;
    if (r > 0.8 && a > 0.02) {
      ctx.globalAlpha = a * (f.gore ? 1 : 0.75); ctx.fillStyle = f.gore ? '#7a0a12' : f.dust;
      ctx.beginPath();
      const sp = f.sp, n = sp.length / 2;
      for (let i = 0; i < n; i++) {
        const an = sp[i * 2], l = sp[i * 2 + 1], an2 = an + Math.PI / n;
        const x1 = P[0] + Math.cos(an) * r * l, y1 = P[1] - Math.sin(an) * r * l, x2 = P[0] + Math.cos(an2) * r * 0.32, y2 = P[1] - Math.sin(an2) * r * 0.32;
        if (i === 0) ctx.moveTo(x1, y1); else ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.closePath();
      // a drop flung off the end of every long spike
      for (let i = 0; i < n; i++) { const l = sp[i * 2 + 1]; if (l < 0.78) continue; const an = sp[i * 2], d = r * (l + 0.22 + 0.5 * t), dr = r * 0.09 * l; ctx.moveTo(P[0] + Math.cos(an) * d + dr, P[1] - Math.sin(an) * d); ctx.arc(P[0] + Math.cos(an) * d, P[1] - Math.sin(an) * d, dr, 0, TAU); }
      ctx.fill();
      if (f.gore) {
        // the wet middle: a brighter splash turned against the first, and the hole
        ctx.fillStyle = '#a8121d'; ctx.beginPath();
        for (let i = 0; i < n; i += 2) { const an = sp[i * 2] + 0.2, l = sp[i * 2 + 1] * 0.55, an2 = an + Math.PI / n; const x1 = P[0] + Math.cos(an) * r * l, y1 = P[1] - Math.sin(an) * r * l; if (i === 0) ctx.moveTo(x1, y1); else ctx.lineTo(x1, y1); ctx.lineTo(P[0] + Math.cos(an2) * r * 0.22, P[1] - Math.sin(an2) * r * 0.22); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2a0205'; ctx.beginPath(); ctx.arc(P[0], P[1], r * 0.16, 0, TAU); ctx.fill();
      }
      else { ctx.globalAlpha = a * 0.45; ctx.fillStyle = '#e4ddcf'; ctx.beginPath(); ctx.arc(P[0], P[1] - r * 0.2, r * (0.7 + 0.8 * t), 0, TAU); ctx.fill(); }
    }
  }
  // ---- the spray back toward us: drops that grow as they come closer, and fall
  const D = f.drops, life = 0.55;
  if (t < life) {
    ctx.globalAlpha = 1 - (t / life) * (t / life); ctx.fillStyle = f.gore ? '#8a0e17' : '#b9b0a0';
    ctx.beginPath();
    for (let i = 0; i < f.nd; i++) {
      const o = i * 7;
      D[o] += D[o + 3] * dt; D[o + 1] += D[o + 4] * dt; D[o + 2] += D[o + 5] * dt; D[o + 4] -= g;
      const q = V.project(sim, D[o], D[o + 1], D[o + 2]), r = Math.max(0.7, D[o + 6] * q[2]);
      ctx.moveTo(q[0] + r, q[1]); ctx.arc(q[0], q[1], r, 0, TAU);
    }
    ctx.fill();
  }
  // ---- flecks of cloth, tumbling (thin when edge on), falling a little slower than drops
  const F = f.fl;
  if (t < 0.9) {
    ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.3; ctx.fillStyle = f.cloth; ctx.beginPath();
    for (let i = 0; i < f.nf; i++) {
      const o = i * 10;
      F[o + 3] *= 1 - 2.5 * dt; F[o] += F[o + 3] * dt; F[o + 1] += F[o + 4] * dt; F[o + 2] += F[o + 5] * dt; F[o + 4] -= g * 0.55; F[o + 6] += F[o + 7] * dt;
      const q = V.project(sim, F[o], F[o + 1], F[o + 2]), w = Math.max(0.8, F[o + 8] * q[2]), h = Math.max(0.5, F[o + 9] * q[2] * Math.abs(Math.cos(F[o + 6] * 0.7)));
      const c = Math.cos(F[o + 6]), sn = Math.sin(F[o + 6]);
      ctx.moveTo(q[0] + c * w - sn * h, q[1] + sn * w + c * h); ctx.lineTo(q[0] - c * w - sn * h, q[1] - sn * w + c * h);
      ctx.lineTo(q[0] - c * w + sn * h, q[1] - sn * w - c * h); ctx.lineTo(q[0] + c * w + sn * h, q[1] + sn * w - c * h); ctx.closePath();
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
