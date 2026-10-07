// ---------------------------------------------------------------------------
// Stick figures: poses, drawing, and the shapes bullets are tested against.
// Local space: feet at (0,0), y up, facing +x. Units are metres.
// ---------------------------------------------------------------------------
const FIG = { hip: 0.86, torso: 0.56, headUp: 0.2, headR: 0.17, thigh: 0.44, shin: 0.44, arm: 0.29, fore: 0.29, lw: 0.085 };

// Build joint positions from a handful of angles. Angles are measured from
// "hanging straight down"; positive swings forward.
function figJoints(p) {
  const hx = p.hx || 0, hy = p.hy === undefined ? FIG.hip : p.hy;
  const lean = p.lean || 0;
  const nx = hx + Math.sin(lean) * FIG.torso, ny = hy + Math.cos(lean) * FIG.torso;
  const ht = lean * 0.6 + (p.head || 0);
  const J = {
    hip: [hx, hy], neck: [nx, ny],
    head: [nx + Math.sin(ht) * FIG.headUp, ny + Math.cos(ht) * FIG.headUp],
  };
  const sx = hx + Math.sin(lean) * (FIG.torso - 0.05), sy = hy + Math.cos(lean) * (FIG.torso - 0.05);
  J.sh = [sx, sy];
  const limb = (ox, oy, a, l1, b, l2) => {
    const mx = ox + Math.sin(a) * l1, my = oy - Math.cos(a) * l1;
    return [[mx, my], [mx + Math.sin(b) * l2, my - Math.cos(b) * l2]];
  };
  let r = limb(hx, hy, p.tL || 0, FIG.thigh, (p.tL || 0) - (p.kL || 0), FIG.shin); J.knL = r[0]; J.ftL = r[1];
  r = limb(hx, hy, p.tR || 0, FIG.thigh, (p.tR || 0) - (p.kR || 0), FIG.shin); J.knR = r[0]; J.ftR = r[1];
  r = limb(sx, sy, p.aL || 0, FIG.arm, (p.aL || 0) + (p.eL || 0), FIG.fore); J.elL = r[0]; J.haL = r[1];
  r = limb(sx, sy, p.aR || 0, FIG.arm, (p.aR || 0) + (p.eR || 0), FIG.fore); J.elR = r[0]; J.haR = r[1];
  return J;
}

// Pose for a named animation at time t (seconds). `ph` is the walk phase.
function figPose(anim, t, ph, A) {
  const b = Math.sin(t * 1.6 + (A.seed || 0)) * 0.015;
  const p = { hy: FIG.hip + b * 0.4, lean: 0, tL: 0.04, tR: -0.04, kL: 0.02, kR: 0.02, aL: 0.06, aR: -0.06, eL: 0.12, eR: 0.12 };
  const s = Math.sin(ph), c = Math.cos(ph);
  switch (anim) {
    case 'walk':
      p.tL = 0.46 * s; p.tR = -0.46 * s;
      p.kL = 0.08 + 0.6 * Math.max(0, -c); p.kR = 0.08 + 0.6 * Math.max(0, c);
      p.aL = -0.38 * s; p.aR = 0.38 * s; p.eL = 0.28; p.eR = 0.28;
      p.hy = FIG.hip - 0.035 * Math.abs(s); p.lean = 0.05;
      break;
    case 'run': case 'panic':
      p.tL = 0.85 * s; p.tR = -0.85 * s;
      p.kL = 0.2 + 1.15 * Math.max(0, -c); p.kR = 0.2 + 1.15 * Math.max(0, c);
      p.hy = FIG.hip - 0.07 * Math.abs(s) - 0.03; p.lean = 0.24;
      if (anim === 'panic') { p.aL = 2.7 + 0.3 * s; p.aR = 2.5 - 0.3 * s; p.eL = 0.5; p.eR = 0.5; p.lean = 0.16; }
      else { p.aL = -0.9 * s; p.aR = 0.9 * s; p.eL = 1.4; p.eR = 1.4; }
      break;
    case 'phone':
      p.aR = 0.35; p.eR = 2.45; p.head = 0.06;
      p.aL = 0.05 + 0.04 * Math.sin(t * 0.7);
      break;
    case 'smoke': {
      const cyc = (t + (A.seed || 0) * 3) % 5.2;
      const up = cyc < 1.4 ? smooth(cyc / 0.35) * (1 - smooth((cyc - 1.05) / 0.35)) : 0;
      p.aR = lerp(0.1, 0.5, up); p.eR = lerp(0.35, 2.3, up);
      break;
    }
    case 'drink': {
      const cyc = (t + (A.seed || 0) * 3) % 6.5;
      const up = cyc < 1.6 ? smooth(cyc / 0.4) * (1 - smooth((cyc - 1.2) / 0.4)) : 0;
      p.aR = lerp(0.35, 0.55, up); p.eR = lerp(1.2, 2.25, up); p.head = -0.12 * up;
      break;
    }
    case 'talk':
      p.aR = 0.5 + 0.2 * Math.sin(t * 3.1 + (A.seed || 0)); p.eR = 1.3 + 0.45 * Math.sin(t * 2.3);
      p.aL = 0.15; p.eL = 0.5 + 0.2 * Math.sin(t * 1.7);
      p.head = 0.05 * Math.sin(t * 1.3);
      break;
    case 'sit': case 'type': case 'sitphone': case 'sitdrink':
      p.hy = 0.5; p.tL = 1.5; p.tR = 1.42; p.kL = 1.5; p.kR = 1.42; p.lean = 0.04;
      if (anim === 'type') { p.aL = 0.75; p.eL = 0.8 + 0.06 * Math.sin(t * 9); p.aR = 0.7; p.eR = 0.85 + 0.06 * Math.cos(t * 11); p.lean = 0.12; }
      else if (anim === 'sitphone') { p.aR = 0.35; p.eR = 2.45; p.aL = 0.5; p.eL = 0.9; }
      else if (anim === 'sitdrink') { const u = (Math.sin(t * 0.9 + (A.seed || 0)) > 0.75) ? 1 : 0; p.aR = 0.5; p.eR = u ? 2.2 : 1.2; p.aL = 0.5; p.eL = 0.9; }
      else { p.aL = 0.55; p.eL = 0.9; p.aR = 0.5; p.eR = 0.95; }
      break;
    case 'lean':
      p.lean = 0.3; p.aL = 0.75; p.eL = 0.55; p.aR = 0.85; p.eR = 0.5; p.tL = -0.12; p.tR = -0.2; p.hy = FIG.hip - 0.02;
      break;
    case 'guard':
      p.aL = 0.55; p.eL = 1.15; p.aR = 0.12; p.eR = 1.55; p.tL = 0.1; p.tR = -0.1;
      break;
    case 'aim':
      p.aL = 1.45; p.eL = 0.1; p.aR = 1.5; p.eR = 0.05; p.tL = 0.22; p.tR = -0.2; p.lean = 0.06;
      break;
    case 'aimrifle':
      p.aL = 1.25; p.eL = 0.4; p.aR = 0.7; p.eR = 1.5; p.tL = 0.25; p.tR = -0.22; p.lean = 0.1;
      break;
    case 'look':
      p.aL = 0.75; p.eL = 2.2; p.aR = 0.7; p.eR = 2.25; p.head = -0.05;
      break;
    case 'wave':
      p.aR = 2.6 + 0.25 * Math.sin(t * 7); p.eR = 0.4;
      break;
    case 'point':
      p.aR = 1.5; p.eR = 0.05; p.lean = 0.06;
      break;
    case 'kneel':
      p.hy = 0.47; p.tL = 0.4; p.kL = 1.95; p.tR = 0.3; p.kR = 1.9; p.aL = -0.5; p.eL = -0.7; p.aR = -0.55; p.eR = -0.7; p.lean = 0.08; p.head = 0.25;
      break;
    case 'cower':
      p.hy = 0.5; p.tL = 1.25; p.kL = 2.3; p.tR = 1.15; p.kR = 2.25; p.lean = 0.55; p.aL = 2.5; p.eL = 0.9; p.aR = 2.4; p.eR = 1.0;
      p.hx = 0.02 * Math.sin(t * 18);
      break;
    case 'work': // hands busy at waist height (welding, fishing, counting money)
      p.lean = 0.18; p.aL = 0.7; p.eL = 0.8 + 0.1 * Math.sin(t * 5); p.aR = 0.6; p.eR = 0.9 + 0.1 * Math.cos(t * 6);
      break;
    case 'sweep':
      p.lean = 0.22; p.aL = 0.6 + 0.2 * Math.sin(t * 2.4); p.eL = 0.5; p.aR = 0.3 + 0.2 * Math.sin(t * 2.4); p.eR = 0.9;
      break;
    case 'arms': // arms crossed, bored
      p.aL = 0.35; p.eL = 1.9; p.aR = 0.3; p.eR = 1.95;
      break;
    case 'hands': // hands up, surrendering
      p.aL = 2.75; p.eL = 0.25; p.aR = 2.6; p.eR = 0.3;
      break;
    case 'drive':
      p.hy = 0.5; p.tL = 1.5; p.tR = 1.45; p.kL = 1.3; p.kR = 1.3; p.aL = 1.0; p.eL = 0.5; p.aR = 1.05; p.eR = 0.45; p.lean = -0.08;
      break;
    case 'sleep':
      p.hy = 0.5; p.tL = 1.5; p.tR = 1.42; p.kL = 1.5; p.kR = 1.42; p.lean = -0.25; p.head = 0.5; p.aL = 0.2; p.aR = 0.15;
      break;
    default: // stand
      p.aL = 0.07 + b; p.aR = -0.05 - b;
  }
  return p;
}

// Rotate a set of joints about a pivot (used for falling over).
function figRotate(J, ang, px, py) {
  const cs = Math.cos(ang), sn = Math.sin(ang);
  for (const k in J) {
    const v = J[k], dx = v[0] - px, dy = v[1] - py;
    J[k] = [px + dx * cs - dy * sn, py + dx * sn + dy * cs];
  }
}

// Joints for an actor right now, in the actor's local space (already
// mirrored for facing and scaled for height).
function actorJoints(A) {
  let J;
  if (A.dead) {
    const base = figPose(A.deathPose || 'stand', A.deathAt || 0, A.deathPh || 0, A);
    const u = clamp((A.deadT || 0) / 0.75, 0, 1);
    const limp = smooth(clamp(u * 1.6, 0, 1));
    if (A.deathKind === 'slump') {
      // collapse where they sit: head forward, arms hang
      base.lean = lerp(base.lean, 0.9, limp); base.head = lerp(base.head || 0, 0.7, limp);
      base.aL = lerp(base.aL, 0.6, limp); base.aR = lerp(base.aR, 0.5, limp); base.eL = lerp(base.eL, 0.1, limp); base.eR = lerp(base.eR, 0.1, limp);
      J = figJoints(base);
    } else {
      base.aL = lerp(base.aL, 2.2, limp); base.aR = lerp(base.aR, 1.2, limp); base.eL = lerp(base.eL, 0.5, limp); base.eR = lerp(base.eR, 0.3, limp);
      base.tL = lerp(base.tL, 0.3, limp); base.tR = lerp(base.tR, -0.15, limp); base.kL = lerp(base.kL, 0.5, limp); base.kR = lerp(base.kR, 0.15, limp);
      base.head = lerp(base.head || 0, -0.35, limp);
      J = figJoints(base);
      // topple: accelerating fall with a small bounce at the end
      const dir = A.deathKind === 'front' ? -1 : 1;
      let ang = u < 0.82 ? Math.pow(u / 0.82, 2.2) : 1 - 0.06 * Math.sin(((u - 0.82) / 0.18) * Math.PI);
      figRotate(J, dir * ang * (Math.PI / 2 - 0.05), 0, 0);
      for (const k in J) J[k][1] = Math.max(J[k][1], 0.045);
    }
  } else {
    J = figJoints(figPose(A.anim || 'stand', A.t || 0, A.ph || 0, A));
  }
  const sc = (A.look && A.look.h) || 1, f = A.face || 1;
  for (const k in J) { J[k][0] *= f * sc; J[k][1] *= sc; }
  J.scale = sc;
  return J;
}

// Which part of the figure, if any, is at point (px, py) in local space.
function distSeg(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - a[0]) * dx + (py - a[1]) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (a[0] + dx * t), py - (a[1] + dy * t));
}
function figHit(J, px, py) {
  const sc = J.scale || 1;
  if (Math.hypot(px - J.head[0], py - J.head[1]) <= FIG.headR * sc + 0.012) return 'head';
  if (distSeg(px, py, J.hip, J.neck) <= 0.15 * sc) return 'torso';
  const limbR = 0.07 * sc;
  if (distSeg(px, py, J.hip, J.knL) <= limbR || distSeg(px, py, J.knL, J.ftL) <= limbR ||
      distSeg(px, py, J.hip, J.knR) <= limbR || distSeg(px, py, J.knR, J.ftR) <= limbR) return 'leg';
  if (distSeg(px, py, J.sh, J.elL) <= limbR || distSeg(px, py, J.elL, J.haL) <= limbR ||
      distSeg(px, py, J.sh, J.elR) <= limbR || distSeg(px, py, J.elR, J.haR) <= limbR) return 'arm';
  return null;
}

// ---- drawing ---------------------------------------------------------------
function seg(ctx, a, b) { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }

// Draw an actor. ctx is already in the plane's metre space with y up.
// env: { ink, rim, px (metres per screen pixel), dark (0..1), nv }
function drawFigure(ctx, A, env) {
  const J = actorJoints(A);
  const L = A.look || {};
  const sc = J.scale, f = A.face || 1;
  const lw = FIG.lw * sc * (L.build === 'big' ? 1.3 : L.build === 'thin' ? 0.85 : 1);
  const minw = env.px * 1.1;
  const ink = env.ink, rim = env.rim;
  ctx.save();
  ctx.translate(A.x, A.y);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  const body = () => {
    ctx.beginPath();
    seg(ctx, J.sh, J.elL); seg(ctx, J.elL, J.haL);
    seg(ctx, J.hip, J.knL); seg(ctx, J.knL, J.ftL);
    seg(ctx, J.hip, J.neck);
    seg(ctx, J.hip, J.knR); seg(ctx, J.knR, J.ftR);
    seg(ctx, J.sh, J.elR); seg(ctx, J.elR, J.haR);
  };
  // pale outline first so the figure reads against any background
  if (rim) {
    ctx.strokeStyle = rim; ctx.fillStyle = rim;
    ctx.lineWidth = Math.max(lw + 0.045, minw + env.px * 1.6);
    body(); ctx.stroke();
    ctx.beginPath(); ctx.arc(J.head[0], J.head[1], FIG.headR * sc + Math.max(0.022, env.px * 0.8), 0, TAU); ctx.fill();
  }
  // carried on the back
  if (L.bag === 'backpack') {
    ctx.fillStyle = L.bagCol || '#5d6b4a';
    const bx = lerp(J.hip[0], J.neck[0], 0.62) - f * 0.17 * sc, by = lerp(J.hip[1], J.neck[1], 0.62);
    ctx.beginPath(); ctx.ellipse(bx, by, 0.13 * sc, 0.22 * sc, 0, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = ink; ctx.fillStyle = ink;
  ctx.lineWidth = Math.max(lw, minw);
  body(); ctx.stroke();

  // clothing over the torso
  if (L.dress) {
    ctx.fillStyle = L.dress;
    ctx.beginPath();
    ctx.moveTo(J.neck[0] - 0.1 * sc, J.neck[1] - 0.08 * sc); ctx.lineTo(J.neck[0] + 0.1 * sc, J.neck[1] - 0.08 * sc);
    ctx.lineTo(J.hip[0] + 0.3 * sc, J.hip[1] - 0.38 * sc); ctx.lineTo(J.hip[0] - 0.3 * sc, J.hip[1] - 0.38 * sc);
    ctx.closePath(); ctx.fill();
  }
  if (L.coat) {
    ctx.strokeStyle = L.coat; ctx.lineWidth = Math.max(lw * 2.5, minw * 2); ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(lerp(J.hip[0], J.neck[0], 0.94), lerp(J.hip[1], J.neck[1], 0.94));
    const lowx = J.hip[0] - (J.neck[0] - J.hip[0]) * (L.long ? 0.55 : 0.05), lowy = J.hip[1] - (J.neck[1] - J.hip[1]) * (L.long ? 0.55 : 0.05);
    ctx.lineTo(lowx, lowy); ctx.stroke(); ctx.lineCap = 'round';
    // sleeves
    ctx.lineWidth = Math.max(lw * 1.35, minw * 1.3);
    ctx.beginPath(); seg(ctx, J.sh, J.elR); seg(ctx, J.elR, [lerp(J.elR[0], J.haR[0], 0.7), lerp(J.elR[1], J.haR[1], 0.7)]);
    seg(ctx, J.sh, J.elL); seg(ctx, J.elL, [lerp(J.elL[0], J.haL[0], 0.7), lerp(J.elL[1], J.haL[1], 0.7)]); ctx.stroke();
  }
  if (L.vest) {
    ctx.strokeStyle = L.vest; ctx.lineWidth = Math.max(lw * 2.4, minw * 2); ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(lerp(J.hip[0], J.neck[0], 0.92), lerp(J.hip[1], J.neck[1], 0.92));
    ctx.lineTo(lerp(J.hip[0], J.neck[0], 0.3), lerp(J.hip[1], J.neck[1], 0.3)); ctx.stroke();
    if (L.vestStripe) {
      ctx.strokeStyle = L.vestStripe; ctx.lineWidth = Math.max(lw * 0.5, minw * 0.6);
      ctx.beginPath(); ctx.moveTo(J.neck[0] - 0.1 * sc, lerp(J.hip[1], J.neck[1], 0.6)); ctx.lineTo(J.neck[0] + 0.1 * sc, lerp(J.hip[1], J.neck[1], 0.6)); ctx.stroke();
    }
    ctx.lineCap = 'round';
  }
  if (L.tie) {
    ctx.fillStyle = L.tie;
    const tx = J.neck[0] + f * 0.03 * sc, ty = J.neck[1] - 0.03 * sc;
    ctx.beginPath();
    ctx.moveTo(tx - 0.035 * sc, ty); ctx.lineTo(tx + 0.035 * sc, ty);
    ctx.lineTo(tx + f * 0.02 * sc + 0.05 * sc, ty - 0.27 * sc); ctx.lineTo(tx + f * 0.02 * sc, ty - 0.34 * sc); ctx.lineTo(tx + f * 0.02 * sc - 0.05 * sc, ty - 0.27 * sc);
    ctx.closePath(); ctx.fill();
  }
  if (L.scarf) {
    ctx.strokeStyle = L.scarf; ctx.lineWidth = Math.max(lw * 1.5, minw * 1.3);
    ctx.beginPath(); ctx.moveTo(J.neck[0] - 0.08 * sc, J.neck[1] + 0.02); ctx.lineTo(J.neck[0] + 0.08 * sc, J.neck[1] + 0.02);
    ctx.moveTo(J.neck[0] - f * 0.06 * sc, J.neck[1]); ctx.lineTo(J.neck[0] - f * 0.2 * sc, J.neck[1] - 0.3 * sc); ctx.stroke();
  }

  // head
  const hx = J.head[0], hy = J.head[1], hr = FIG.headR * sc;
  ctx.fillStyle = ink;
  ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU); ctx.fill();
  if (L.hair === 'long') {
    ctx.fillStyle = L.hairCol || '#6b4a2b';
    ctx.beginPath(); ctx.arc(hx - f * 0.03 * sc, hy + 0.01, hr * 1.12, f > 0 ? Math.PI * 0.35 : -Math.PI * 0.45, f > 0 ? Math.PI * 1.45 : Math.PI * 0.65); ctx.lineTo(hx - f * 0.16 * sc, hy - 0.32 * sc); ctx.closePath(); ctx.fill();
  } else if (L.hair === 'bun') {
    ctx.fillStyle = L.hairCol || '#3a2a20';
    ctx.beginPath(); ctx.arc(hx - f * 0.13 * sc, hy + 0.14 * sc, 0.08 * sc, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(hx, hy + 0.02, hr * 1.06, 0.15, Math.PI - 0.15); ctx.fill();
  } else if (L.hair === 'mohawk') {
    ctx.fillStyle = L.hairCol || '#e0413a';
    ctx.beginPath(); ctx.ellipse(hx, hy + hr * 0.95, hr * 0.85, hr * 0.42, 0, 0, TAU); ctx.fill();
  } else if (L.hair === 'short') {
    ctx.fillStyle = L.hairCol || '#7a5a3a';
    ctx.beginPath(); ctx.arc(hx, hy + 0.015, hr * 1.05, 0.25, Math.PI - 0.25); ctx.closePath(); ctx.fill();
  } else if (L.hair === 'white') {
    ctx.fillStyle = '#e8e8e2';
    ctx.beginPath(); ctx.arc(hx - f * 0.02, hy + 0.015, hr * 1.05, 0.1, Math.PI - 0.1); ctx.closePath(); ctx.fill();
  }
  if (L.beard) {
    ctx.fillStyle = L.beard === true ? '#8a8f96' : L.beard;
    ctx.beginPath(); ctx.arc(hx + f * 0.03 * sc, hy - 0.03 * sc, hr * 0.98, f > 0 ? -1.9 : -2.9, f > 0 ? -0.2 : -1.2); ctx.closePath(); ctx.fill();
  }
  if (L.glasses) {
    ctx.strokeStyle = L.glasses === 'shades' ? '#f2f4f7' : '#cfd6de'; ctx.lineWidth = Math.max(0.022 * sc, minw * 0.7);
    ctx.beginPath();
    if (L.glasses === 'shades') { ctx.moveTo(hx - f * 0.02 * sc, hy + 0.03 * sc); ctx.lineTo(hx + f * 0.17 * sc, hy + 0.03 * sc); ctx.lineWidth = Math.max(0.05 * sc, minw); }
    else { ctx.arc(hx + f * 0.1 * sc, hy + 0.02 * sc, 0.045 * sc, 0, TAU); ctx.moveTo(hx + f * 0.05 * sc, hy + 0.02 * sc); ctx.lineTo(hx - f * 0.12 * sc, hy + 0.04 * sc); }
    ctx.stroke();
  }
  if (L.mask) {
    ctx.fillStyle = L.mask; ctx.beginPath(); ctx.arc(hx, hy, hr * 1.02, Math.PI + 0.25, TAU - 0.25); ctx.closePath(); ctx.fill();
  }
  if (L.phones) {
    ctx.strokeStyle = L.phones; ctx.lineWidth = Math.max(0.04 * sc, minw);
    ctx.beginPath(); ctx.arc(hx, hy, hr * 1.12, 0.3, Math.PI - 0.3); ctx.stroke();
    ctx.fillStyle = L.phones; ctx.beginPath(); ctx.arc(hx - f * 0.02, hy, 0.07 * sc, 0, TAU); ctx.fill();
  }
  // hats
  const hat = L.hat, hc = L.hatCol || '#2a2d33';
  if (hat) {
    ctx.fillStyle = hc; ctx.strokeStyle = hc;
    const top = hy + hr * 0.62;
    if (hat === 'fedora') {
      ctx.lineWidth = Math.max(0.045 * sc, minw); ctx.beginPath(); ctx.moveTo(hx - 0.3 * sc, top); ctx.lineTo(hx + 0.3 * sc, top); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx - 0.17 * sc, top); ctx.lineTo(hx - 0.15 * sc, top + 0.17 * sc); ctx.quadraticCurveTo(hx, top + 0.21 * sc, hx + 0.15 * sc, top + 0.17 * sc); ctx.lineTo(hx + 0.17 * sc, top); ctx.closePath(); ctx.fill();
      if (L.hatBand) { ctx.fillStyle = L.hatBand; ctx.fillRect(hx - 0.168 * sc, top + 0.015 * sc, 0.336 * sc, 0.045 * sc); }
    } else if (hat === 'cap') {
      ctx.beginPath(); ctx.arc(hx, top - 0.03 * sc, hr * 1.04, 0, Math.PI); ctx.closePath(); ctx.fill();
      ctx.lineWidth = Math.max(0.045 * sc, minw); ctx.beginPath(); ctx.moveTo(hx, top - 0.02 * sc); ctx.lineTo(hx + f * 0.3 * sc, top - 0.04 * sc); ctx.stroke();
    } else if (hat === 'beanie') {
      ctx.beginPath(); ctx.arc(hx, hy + 0.03 * sc, hr * 1.08, 0.05, Math.PI - 0.05); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(hx, hy + hr * 1.12, 0.045 * sc, 0, TAU); ctx.fill();
    } else if (hat === 'hardhat') {
      ctx.beginPath(); ctx.arc(hx, top - 0.05 * sc, hr * 1.1, 0, Math.PI); ctx.closePath(); ctx.fill();
      ctx.lineWidth = Math.max(0.04 * sc, minw); ctx.beginPath(); ctx.moveTo(hx - 0.22 * sc, top - 0.05 * sc); ctx.lineTo(hx + 0.24 * sc, top - 0.05 * sc); ctx.stroke();
    } else if (hat === 'tophat') {
      ctx.lineWidth = Math.max(0.045 * sc, minw); ctx.beginPath(); ctx.moveTo(hx - 0.26 * sc, top); ctx.lineTo(hx + 0.26 * sc, top); ctx.stroke();
      ctx.fillRect(hx - 0.15 * sc, top, 0.3 * sc, 0.3 * sc);
      if (L.hatBand) { ctx.fillStyle = L.hatBand; ctx.fillRect(hx - 0.15 * sc, top + 0.02 * sc, 0.3 * sc, 0.05 * sc); }
    } else if (hat === 'beret') {
      ctx.beginPath(); ctx.ellipse(hx - f * 0.04 * sc, top + 0.02 * sc, 0.21 * sc, 0.08 * sc, -f * 0.2, 0, TAU); ctx.fill();
    } else if (hat === 'hood') {
      ctx.beginPath(); ctx.arc(hx - f * 0.03 * sc, hy, hr * 1.2, f > 0 ? 0.6 : -0.5, f > 0 ? Math.PI + 0.5 : Math.PI - 0.6 + Math.PI * 0, f < 0); ctx.closePath(); ctx.fill();
    } else if (hat === 'peaked') { // officer / chauffeur cap
      ctx.fillRect(hx - 0.17 * sc, top - 0.02 * sc, 0.34 * sc, 0.1 * sc);
      ctx.beginPath(); ctx.ellipse(hx, top + 0.09 * sc, 0.2 * sc, 0.05 * sc, 0, 0, TAU); ctx.fill();
      ctx.lineWidth = Math.max(0.04 * sc, minw); ctx.beginPath(); ctx.moveTo(hx, top - 0.02 * sc); ctx.lineTo(hx + f * 0.27 * sc, top - 0.05 * sc); ctx.stroke();
    } else if (hat === 'sun') {
      ctx.lineWidth = Math.max(0.04 * sc, minw); ctx.beginPath(); ctx.moveTo(hx - 0.38 * sc, top - 0.02 * sc); ctx.lineTo(hx + 0.38 * sc, top - 0.02 * sc); ctx.stroke();
      ctx.beginPath(); ctx.arc(hx, top - 0.02 * sc, hr * 0.95, 0, Math.PI); ctx.closePath(); ctx.fill();
      if (L.hatBand) { ctx.fillStyle = L.hatBand; ctx.fillRect(hx - 0.155 * sc, top - 0.01 * sc, 0.31 * sc, 0.04 * sc); }
    } else if (hat === 'helmet') {
      ctx.beginPath(); ctx.arc(hx, hy + 0.02 * sc, hr * 1.16, -0.15, Math.PI + 0.15); ctx.closePath(); ctx.fill();
    }
  }

  // things in the hands
  const hand = J.haR, bag = L.bag;
  if (bag === 'case') {
    ctx.fillStyle = L.bagCol || '#7b5a36';
    ctx.fillRect(hand[0] - 0.2 * sc, hand[1] - 0.3 * sc, 0.4 * sc, 0.26 * sc);
    ctx.strokeStyle = L.bagCol || '#7b5a36'; ctx.lineWidth = Math.max(0.025, minw * 0.7);
    ctx.beginPath(); ctx.moveTo(hand[0] - 0.06, hand[1] - 0.04); ctx.lineTo(hand[0] - 0.06, hand[1] + 0.01); ctx.lineTo(hand[0] + 0.06, hand[1] + 0.01); ctx.lineTo(hand[0] + 0.06, hand[1] - 0.04); ctx.stroke();
  } else if (bag === 'duffel') {
    ctx.fillStyle = L.bagCol || '#3f4a5c';
    ctx.beginPath(); ctx.ellipse(hand[0], hand[1] - 0.2 * sc, 0.34 * sc, 0.16 * sc, 0, 0, TAU); ctx.fill();
  } else if (bag === 'shopping') {
    ctx.fillStyle = L.bagCol || '#e9e2d0';
    ctx.beginPath(); ctx.moveTo(hand[0] - 0.13, hand[1] - 0.05); ctx.lineTo(hand[0] + 0.13, hand[1] - 0.05); ctx.lineTo(hand[0] + 0.16, hand[1] - 0.4); ctx.lineTo(hand[0] - 0.16, hand[1] - 0.4); ctx.closePath(); ctx.fill();
  } else if (bag === 'umbrella') {
    const ux = J.haR[0], uy = J.haR[1];
    ctx.strokeStyle = '#22252b'; ctx.lineWidth = Math.max(0.03, minw * 0.8);
    ctx.beginPath(); ctx.moveTo(ux, uy - 0.05); ctx.lineTo(ux, 2.25 * sc); ctx.stroke();
    ctx.fillStyle = L.bagCol || '#c0392b';
    ctx.beginPath(); ctx.arc(ux, 2.2 * sc, 0.62 * sc, 0, Math.PI); ctx.closePath(); ctx.fill();
  } else if (bag === 'cane') {
    ctx.strokeStyle = L.bagCol || '#d8d2c4'; ctx.lineWidth = Math.max(0.035, minw * 0.8);
    ctx.beginPath(); ctx.moveTo(hand[0], hand[1] + 0.03); ctx.lineTo(hand[0] + f * 0.12, 0.02); ctx.stroke();
  } else if (bag === 'clip') {
    ctx.fillStyle = L.bagCol || '#e7e2d4';
    ctx.fillRect(J.haL[0] - 0.1, J.haL[1] - 0.05, 0.2, 0.28);
  } else if (bag === 'cup') {
    ctx.fillStyle = L.bagCol || '#f1ede2';
    ctx.fillRect(hand[0] - 0.04, hand[1] - 0.02, 0.08, 0.13);
  } else if (bag === 'box') {
    ctx.fillStyle = L.bagCol || '#b08a52';
    const mx = (J.haL[0] + J.haR[0]) / 2, my = (J.haL[1] + J.haR[1]) / 2;
    ctx.fillRect(mx - 0.24, my - 0.08, 0.48, 0.36);
  } else if (bag === 'paper') {
    ctx.fillStyle = '#e9e6dc';
    const mx = (J.haL[0] + J.haR[0]) / 2, my = (J.haL[1] + J.haR[1]) / 2;
    ctx.fillRect(mx - 0.2, my - 0.04, 0.4, 0.3);
  } else if (bag === 'flowers') {
    ctx.fillStyle = '#4c9a56'; ctx.fillRect(hand[0] - 0.03, hand[1], 0.06, 0.25);
    ctx.fillStyle = L.bagCol || '#e85d75'; ctx.beginPath(); ctx.arc(hand[0], hand[1] + 0.3, 0.13, 0, TAU); ctx.fill();
  } else if (bag === 'guitar') {
    ctx.fillStyle = L.bagCol || '#1d2026';
    ctx.save(); ctx.translate(lerp(J.hip[0], J.neck[0], 0.5) - f * 0.16, lerp(J.hip[1], J.neck[1], 0.6)); ctx.rotate(f * 0.25);
    ctx.fillRect(-0.09, -0.1, 0.18, 0.95); ctx.beginPath(); ctx.ellipse(0, -0.25, 0.2, 0.28, 0, 0, TAU); ctx.fill(); ctx.restore();
  } else if (bag === 'balloon') {
    ctx.strokeStyle = '#d7dbe0'; ctx.lineWidth = Math.max(0.012, minw * 0.5);
    const sway = Math.sin((A.t || 0) * 1.3) * 0.12;
    ctx.beginPath(); ctx.moveTo(hand[0], hand[1]); ctx.lineTo(hand[0] + sway, 2.75); ctx.stroke();
    ctx.fillStyle = L.bagCol || '#e0413a'; ctx.beginPath(); ctx.ellipse(hand[0] + sway, 2.98, 0.2, 0.25, 0, 0, TAU); ctx.fill();
  }
  if (L.gun === 'rifle' || A.anim === 'guard' || A.anim === 'aimrifle') {
    if (!A.dead) {
      ctx.strokeStyle = '#0b0c0f'; ctx.lineWidth = Math.max(0.05, minw);
      const a = J.haR, b2 = J.haL;
      const dx = b2[0] - a[0], dy = b2[1] - a[1], l = Math.hypot(dx, dy) || 1;
      ctx.beginPath(); ctx.moveTo(a[0] - (dx / l) * 0.28, a[1] - (dy / l) * 0.28); ctx.lineTo(b2[0] + (dx / l) * 0.42, b2[1] + (dy / l) * 0.42); ctx.stroke();
      if (rim) { ctx.strokeStyle = rim; ctx.lineWidth = Math.max(0.012, env.px * 0.6); ctx.beginPath(); ctx.moveTo(a[0] - (dx / l) * 0.28, a[1] - (dy / l) * 0.28 + 0.035); ctx.lineTo(b2[0] + (dx / l) * 0.42, b2[1] + (dy / l) * 0.42 + 0.035); ctx.stroke(); }
    }
  } else if (A.anim === 'aim' && !A.dead) {
    ctx.fillStyle = '#0b0c0f';
    ctx.fillRect(Math.min(hand[0], hand[0] + f * 0.2), hand[1] - 0.01, 0.2, 0.07);
    ctx.fillRect(hand[0] - 0.03, hand[1] - 0.1, 0.06, 0.1);
  } else if (A.anim === 'look' && !A.dead) {
    ctx.fillStyle = '#0b0c0f'; ctx.fillRect(hx + (f > 0 ? 0.1 : -0.3) * sc, hy - 0.04, 0.2 * sc, 0.1 * sc);
  } else if (A.anim === 'sweep' && !A.dead) {
    ctx.strokeStyle = '#b58d55'; ctx.lineWidth = Math.max(0.03, minw * 0.8);
    ctx.beginPath(); ctx.moveTo(J.haR[0] - f * 0.1, J.haR[1] + 0.3); ctx.lineTo(J.haL[0] + f * 0.35, 0.05); ctx.stroke();
  }
  // cigarette smoke
  if ((A.anim === 'smoke') && !A.dead) {
    const base = (A.t || 0) + (A.seed || 0) * 3;
    ctx.fillStyle = env.smoke || 'rgba(220,225,232,0.35)';
    for (let i = 0; i < 4; i++) {
      const u = ((base * 0.35 + i * 0.25) % 1);
      ctx.globalAlpha = (1 - u) * 0.5;
      ctx.beginPath(); ctx.arc(hx + f * 0.2 + Math.sin(u * 5 + i) * 0.12 + (env.windDrift || 0) * u, hy + 0.1 + u * 0.9, 0.05 + u * 0.14, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

CB.fig = { drawFigure, actorJoints, figHit, figPose, figJoints };
