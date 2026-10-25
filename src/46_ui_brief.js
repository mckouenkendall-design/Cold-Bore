// ---------------------------------------------------------------------------
// The briefing, as a dossier. On the left, an intel photo: the place through a scope with the
// target marked, chips for distance, wind, light and guards over it, then your rifle and the
// button. On the right, the target card: a close-up of whoever you are looking for, drawn by the
// same code that draws them in the mission (03_figures.js), with what to look for as short
// points; then the handler's message cut into short lines, the rest a tap away.
// ---------------------------------------------------------------------------

// A copy of the mission, run on until the first target is in view, for the photos and counts.
// Kept for the mission and position being looked at; a copy is a nicety and never changes the run.
UI.briefSims = {};
UI.briefSim = function (M, v) {
  const key = M.id + '/' + (v || 0) + '/' + JSON.stringify(Save.data.flags || {});
  if (UI.briefSims[key]) return UI.briefSims[key];
  let out = null;
  try {
    const sim = new Sim(M, buildStats('halden'), v || 0, { flags: Save.data.flags, shotSeed: 1 });
    sim.S.objects.forEach((o) => { if (o.kind === 'duck') o.alive = false; });
    // whoever the contract is about: the people to kill, or failing that the people marked as targets
    let ids = (sim.rules.kill || []).slice();
    if (!ids.length) ids = sim.actors.filter((a) => a.role === 'target').map((a) => a.id);
    const b = sim.S.bounds;
    const look = () => ids.map((id) => sim.byId[id]).filter((a) => a && !a.dead && !a.gone && !a.hidden && a.plane && a.x > b.x0 + 2 && a.x < b.x1 - 2);
    for (let i = 0; i < 24; i++) sim.step(1 / 15);
    let seen = look();
    for (let i = 0; i < 420 && !seen.length && sim.state === 'play'; i++) { sim.step(1 / 15); if (i % 3 === 0) seen = look(); }
    const all = ids.map((id) => sim.byId[id]).filter((a) => a && a.plane);
    // something to wreck rather than someone
    const objs = (sim.rules.destroy || []).map((id) => sim.S.objects.find((o) => o.id === id)).filter((o) => o && o.plane);
    out = { sim, targets: seen.length ? seen : all, objs, ids, guards: sim.actors.filter((a) => a.role === 'guard').length, light: timeLabel(sim.S), dist: Math.round(sim.S.refZ - sim.eye0.z) };
  } catch (e) { out = null; }
  UI.briefSims = {}; UI.briefSims[key] = out; // one at a time: a whole mission is not small
  return out;
};

// The copied mission seen through a scope at a point (pt: x, y, z, and h, w of the thing there),
// span metres across. Draws into x (w x h) and returns where the thing ended up in the picture.
function briefScope(x, w, h, B, pt, span) {
  const sim = B.sim, off = document.createElement('canvas'), V = new View(off), dpr = Math.min(2, window.devicePixelRatio || 1);
  V.layout(w, h, dpr, 'plain');
  const e = sim.eye(), dz = Math.max(1, pt.z - e.z);
  sim.sh.ax = ((pt.x - e.x) / dz) * 1000; sim.sh.ay = ((pt.y + pt.h * 0.5 - e.y) / dz) * 1000;
  sim.sh.zoom = sim.sh.zoomT = clamp((FOV_AT_1X / (((span / dz) * 1000) * 0.5)) * ((V.R * 2) / w), 1.2, 30);
  sim.sh.swx = sim.sh.swy = 0;
  V.draw(sim, 0.016, 0);
  x.drawImage(off, 0, 0, off.width, off.height, 0, 0, w, h);
  const top = V.project(sim, pt.x, pt.y + pt.h, pt.z), bot = V.project(sim, pt.x, pt.y, pt.z);
  return { x: top[0], y0: top[1], y1: bot[1], hw: Math.max(10, pt.w * 0.5 * top[2]) };
}
// A dashed red box with a tag on it.
function briefBox(x, box, label) {
  if (!box) return;
  const bw = box.hw * 2, bh = Math.max(24, box.y1 - box.y0), bx = box.x - bw / 2, by = box.y0;
  x.strokeStyle = '#ff4a3d'; x.lineWidth = 2; x.setLineDash([5, 3]); x.strokeRect(bx, by, bw, bh); x.setLineDash([]);
  x.fillStyle = '#ff4a3d'; x.fillRect(bx, by - 13, 44, 13); x.fillStyle = '#fff'; x.font = '800 9px ' + GR_HEAD; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(label, bx + 4, by - 6.5);
}

// The close-up for the target card: the person, big, against a dark backdrop lit from one side,
// like a photo clipped into a file. Several targets stand side by side.
UI.paintTarget = function (cv, M, v) {
  const c = UI.fitCanvas(cv); if (!c) return;
  const x = c.x, w = c.w, h = c.h, B = UI.briefSim(M, v);
  const bg = x.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#4a5462'); bg.addColorStop(1, '#1d232b'); x.fillStyle = bg; x.fillRect(0, 0, w, h);
  const gl = x.createRadialGradient(w * 0.62, h * 0.3, 2, w * 0.62, h * 0.3, h * 0.9); gl.addColorStop(0, 'rgba(255,236,200,0.32)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gl; x.fillRect(0, 0, w, h);
  // a copy of each, standing still and facing right, the way a file photo would have them
  const T = B ? B.targets.slice(0, 3).map((A) => Object.assign(Object.create(Object.getPrototypeOf(A)), A, { inVeh: null, hidden: false, gone: false, dead: false, anim: 'stand', animCur: 'stand', animFrom: null, faceS: undefined, face: 1, seat: undefined, y: A.inVeh ? 0 : A.y })) : [];
  if (T.length) {
    const k = (h * 0.8) / 2.05, step = w / T.length;
    T.forEach((A, i) => {
      x.save(); x.translate(step * (i + 0.5), h * 0.95); x.scale(k, -k); x.translate(-A.x, -A.y);
      try { drawFigure(x, A, { px: 1 / k, t: B.sim.t, ink: '#13161b', light: 1, rim: 'rgba(255,240,215,0.55)', wind: 0 }); } catch (e) { /* drawn without */ }
      x.restore();
    });
  } else if (B && B.objs.length) { // something to wreck rather than someone: a close look at it through the scope
    const o = B.objs[0], r = o.r || 0.5, pt = { x: o.x, y: o.y - r, z: o.plane.z, h: r * 2, w: r * 2 + 0.3 };
    try { const box = briefScope(x, w, h, B, pt, Math.max(4, r * 7)); briefBox(x, box, 'TARGET'); } catch (e) { /* plain */ }
  } else { // nobody and nothing to show: a question mark
    x.fillStyle = 'rgba(255,255,255,0.08)'; x.font = '800 ' + Math.round(h * 0.5) + 'px ' + GR_HEAD; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', w / 2, h * 0.5);
  }
  // grain, a floor line, and the corner of a print
  const R = makeRng(5); x.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 260; i++) x.fillRect(R.f() * w, R.f() * h, 1, 1);
  x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, h * 0.95, w, h * 0.05);
  x.font = '600 9px ' + GR_BODY; x.textAlign = 'left'; x.textBaseline = 'top'; x.fillStyle = 'rgba(255,200,120,0.85)'; x.fillText((B ? B.light : '').toUpperCase(), 6, 6);
};

// The intel photo: the target's stretch of the scene through a scope, with a red box on the target.
UI.paintIntel = function (cv, M, v) {
  const c = UI.fitCanvas(cv); if (!c) return;
  const x = c.x, w = c.w, h = c.h, B = UI.briefSim(M, v);
  if (!B) { const s = UI.sceneShot(M, v, w, h); if (s) x.drawImage(s.cv, 0, 0, w, h); return; }
  const A = B.targets.find((a) => !a.inVeh && !a.hidden && !a.gone) || B.targets[0], o = B.objs[0];
  let box = null;
  try {
    const e = B.sim.eye();
    let pt = null, span = 34;
    if (A && A.plane) { pt = { x: A.x, y: A.y - 0.1, z: A.plane.z, h: 2.1, w: 1.1 }; span = clamp((A.plane.z - e.z) * 0.11, 18, 70); }
    else if (o) { const r = o.r || 0.5; pt = { x: o.x, y: o.y - r, z: o.plane.z, h: r * 2, w: r * 2 + 0.4 }; span = clamp((o.plane.z - e.z) * 0.1, 14, 60); }
    else pt = { x: (B.sim.S.bounds.x0 + B.sim.S.bounds.x1) / 2, y: 0, z: B.sim.S.refZ, h: 2, w: 1 };
    box = briefScope(x, w, h, B, pt, span);
    if (!A && !o) box = null;
  } catch (e) { const s = UI.sceneShot(M, v, w, h); if (s) x.drawImage(s.cv, 0, 0, w, h); }
  // the marks: a thin crosshair, corner brackets, and a red box round the target
  x.strokeStyle = 'rgba(10,12,16,0.55)'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w * 0.42, h / 2); x.moveTo(w * 0.58, h / 2); x.lineTo(w, h / 2); x.moveTo(w / 2, 0); x.lineTo(w / 2, h * 0.3); x.moveTo(w / 2, h * 0.72); x.lineTo(w / 2, h); x.stroke();
  briefBox(x, box, 'TARGET');
  x.strokeStyle = 'rgba(255,255,255,0.6)'; x.lineWidth = 2; const L = 14, m = 7;
  x.beginPath(); x.moveTo(m, m + L); x.lineTo(m, m); x.lineTo(m + L, m); x.moveTo(w - m - L, m); x.lineTo(w - m, m); x.lineTo(w - m, m + L); x.moveTo(m, h - m - L); x.lineTo(m, h - m); x.lineTo(m + L, h - m); x.moveTo(w - m - L, h - m); x.lineTo(w - m, h - m); x.lineTo(w - m, h - m - L); x.stroke();
  const vg = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)'); x.fillStyle = vg; x.fillRect(0, 0, w, h);
};

// Who to look for, from the intel: lines written "Name: details" become a target each, the details
// cut at commas into short points. Anything else stays in the list of what we know.
function briefTargets(M, intel) {
  const out = [], rest = [];
  intel.forEach((line) => {
    const m = /^([A-Z][A-Za-z']*(?: [A-Za-z']+)?):\s+(.+)$/.exec(line);
    // (a name, not a place: "Tannery roof: close, but..." is about where to shoot from)
    if (m && out.length < 3 && m[2].length < 130 && !/\b(fit|note|tip|range|wind|seconds?|minutes?|first|then)\b/i.test(m[1]) && !/\b(roof|tower|peak|ridge|window|gate|pier|deck|road|position|bank|box)$/i.test(m[1]) && !/^Pip$/.test(m[1])) {
      const pts = m[2].replace(/\.$/, '').split(/,\s+|\.\s+/).map((s) => s.trim()).filter(Boolean).map((s) => s.charAt(0).toUpperCase() + s.slice(1));
      out.push({ name: m[1] === 'Target' ? '' : m[1], pts: pts.slice(0, 6) });
    } else rest.push(line);
  });
  if (!out.length && intel.length && intel[0].length < 110 && !/^(Fit|Range|Pip)/.test(intel[0])) { // a first line that only describes him
    const pts = intel[0].replace(/\.$/, '').split(/,\s+|\.\s+/).map((s) => s.trim()).filter(Boolean).map((s) => s.charAt(0).toUpperCase() + s.slice(1));
    if (pts.length >= 2 && pts.every((p) => p.length < 50)) { out.push({ name: '', pts }); rest.shift(); }
  }
  return { targets: out, rest: rest.length ? rest : out.length ? [] : intel };
}
// The handler's message as short lines: the first two shown, the rest behind a tap.
function briefLines(text) { return String(text || '').match(/[^.!?]+[.!?]+["']?\s*|[^.!?]+$/g) || [String(text || '')]; }

UI.brief = function (M, keep) {
  const d = Save.data, flags = d.flags, rec = d.missions[M.id] || { stars: 0 };
  if (!keep) UI.pick = { v: 0 };
  const P = UI.pick, V = M.vantages || [{ name: 'Position', desc: '' }];
  const gunId = d.equipped, cfg = gunCfg(gunId), st = buildStats(gunId, cfg), why = gunAllowed(M, st), g = GUN_BY_ID[gunId];
  const intel = missionText(M, 'intel') || [], who = speakerOf(M), pkey = CB.portraitKey(who);
  const wind = M.wind || { v: 0 }, aw = Math.abs(wind.v || 0) * (V[P.v].windMul === undefined ? 1 : V[P.v].windMul);
  const par = (typeof M.par === 'function' ? M.par(flags) : M.par) || 1;
  const choice = M.outcomes && M.outcomes.some((o) => o.set);
  const T = briefTargets(M, intel), lines = briefLines(missionText(M, 'brief'));
  const objective = missionText(M, 'objective');
  const chip = (icon, label, val, cls) => `<span class="bchip ${cls || ''}">${icon}<span><i>${label}</i><b>${val}</b></span></span>`;
  // the chips that need the copy of the mission (distance, light, guards) fill in with the photos
  const chipsFor = (B) => {
    const guards = B ? B.guards : null, dist = B ? B.dist : M.range;
    return chip(ICON.target, 'Range', dist + (dist >= 1000 ? 'm' : ' m')) + chip(ICON.wind, 'Wind m/s', aw < 0.3 ? 'Calm' : fmt(aw, 1) + ((wind.v || 0) > 0 ? '&rarr;' : '&larr;')) + chip(ICON.sun, 'Light', B ? esc(B.light.split(',')[0]) : '&nbsp;') + chip(ICON.guard, 'Guards', guards === null ? '&nbsp;' : guards ? String(guards) : 'None', guards ? 'warn' : '');
  };
  const chips = chipsFor(null);
  const tcard = `<div class="tcard"><span class="tc-photo"><canvas class="tc-fig"></canvas><span class="tc-clip"></span></span>
    <div class="tc-b"><div class="eyebrow">${T.targets.length > 1 ? 'Targets' : 'Target'}</div><p class="tc-obj">${esc(objective)}</p>
    ${T.targets.map((t) => `<div class="tc-who">${t.name ? '<b>' + esc(t.name) + '</b>' : ''}<ul>${t.pts.map((p) => '<li>' + esc(p) + '</li>').join('')}</ul></div>`).join('')}
    ${choice ? '<div class="choice">There is a decision to make on this one. It changes what comes later.</div>' : ''}</div></div>`;
  const say = `<div class="say brief-say">${pkey ? `<canvas class="sp-face" data-portrait="${pkey}"></canvas>` : ''}<div class="sp-t"><b>${esc(who)}</b>${lines.slice(0, 2).map((l) => '<p>' + esc(l.trim()) + '</p>').join('')}${lines.length > 2 ? `<details><summary>The rest of the message</summary>${lines.slice(2).map((l) => '<p>' + esc(l.trim()) + '</p>').join('')}</details>` : ''}</div></div>`;
  UI.render(`<div class="scr brief dossier">
    <div class="bar"><button class="ib" data-a="back" data-snd="back">${ICON.back}</button><div class="bar-t"><div class="eyebrow">Chapter ${ROMAN[M.ch]}  ·  Contract ${MISSIONS.filter((m) => m.ch === M.ch).indexOf(M) + 1}${UI.dailyTag ? UI.dailyTag(M) : ''}</div><h2>${esc(M.title)}</h2></div><button class="btn ghost sm howbtn" data-a="showhow">${ICON.guide}<span>Show me how</span></button>${starsHtml(rec.stars || 0)}</div>
    <div class="split">
      <div class="side">
        <div class="thumb intel-photo"><canvas class="ip-pic"></canvas><div class="bchips">${chips}</div></div>
        <div class="load">
          <button class="gcard ${why ? 'bad' : ''}" data-a="gun"><span class="gc-pic plate"><canvas data-gun="${gunId}"></canvas></span><span class="gc-row"><span class="gc-t"><b>${esc(g.name)}</b><i>${esc(g.calName)}  ·  ${esc(st.scope.name)}  ·  ${st.silent ? 'silent' : st.quiet ? 'suppressed' : 'loud'}</i></span><span class="chg">Change</span></span></button>
          ${why ? '<div class="warn">' + ICON.cross + '<span>' + esc(why) + ' Pick another rifle or fit different parts.</span></div>' : ''}
        </div>
        <div class="cta"><button class="btn pri big ${why ? 'off' : ''}" data-a="go" data-snd="go">${why ? 'Rifle not suitable' : 'Take the shot'}</button></div>
      </div>
      <div class="main scroll">
        ${tcard}
        ${say}
        ${!why && !st.quiet ? '<div class="note loud"><b>Your rifle is loud.</b> Everyone in earshot hears the shot unless something louder covers it.</div>' : ''}
        ${V.length > 1 ? `<div class="vant"><div class="eyebrow">Where to set up</div><div class="vgrid">${V.map((v, i) => `<button class="vcard ${i === P.v ? 'on' : ''}" data-a="vant" data-i="${i}"><b>${esc(v.name)}</b>${v.tag ? '<em>' + esc(v.tag) + '</em>' : ''}<span>${esc(v.desc || '')}</span></button>`).join('')}</div></div>` : `<div class="vant one"><div class="eyebrow">Position</div><p><b>${esc(V[0].name)}.</b> ${esc(V[0].desc || '')}</p></div>`}
        ${T.rest.length ? `<div class="intel"><div class="eyebrow">What else we know</div><ul>${T.rest.map((t) => '<li>' + esc(t) + '</li>').join('')}</ul></div>` : ''}
        <div class="goals"><div class="eyebrow">Rating</div>
          <div class="goal">${starsHtml(1, 'one on')}<span>Complete the contract</span></div>
          <div class="goal">${starsHtml(1, 'one on')}<span>Clean: no alarm, nobody sees it happen</span></div>
          <div class="goal">${starsHtml(1, 'one on')}<span>Precise: ${par === 1 ? 'one shot' : 'no more than ' + par + ' shots'}</span></div>
          <div class="goal ch ${rec.ch ? 'got' : ''}"><i>${ICON.medal}</i><span>Challenge: ${esc(M.challenge.text)}</span></div>
          <div class="goal ch ${d.ducks[M.id] ? 'got' : ''}"><i>${ICON.duck}</i><span>A rubber duck is hidden somewhere in the scene</span></div>
          <div class="pay">Pays <b>${fmtCr(M.reward.cr)}</b> credits and <b>${M.reward.xp}</b> xp the first time, more for stars and the challenge.${UI.dailyPay ? UI.dailyPay(M) : ''}</div>
        </div>
      </div>
    </div>
  </div>`, {
    back() { UI.hub(); },
    vant(ds) { P.v = +ds.i; UI.keepScroll(); UI.brief(M, true); },
    gun() { UI.gunPicker(M); },
    go() { UI.launch(M.id, { vantage: P.v }); },
    showhow() { UI.showHow(M); },
  }, 'is-brief');
  // the photos are drawn a moment after the page is up, so opening a briefing never waits on them
  const root = UI.root.querySelector('.brief'), paint = () => {
    if (!root.isConnected) return;
    const B = UI.briefSim(M, P.v), row = root.querySelector('.bchips'); if (row) row.innerHTML = chipsFor(B);
    UI.paintIntel(root.querySelector('.ip-pic'), M, P.v); UI.paintTarget(root.querySelector('.tc-fig'), M, P.v);
  };
  if (UI.briefSims[M.id + '/' + (P.v || 0) + '/' + JSON.stringify(Save.data.flags || {})]) paint(); else setTimeout(paint, 30);
};
