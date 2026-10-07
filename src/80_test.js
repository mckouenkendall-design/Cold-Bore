// ---------------------------------------------------------------------------
// The test bot. It plays missions through the same simulation the player
// uses, at high speed and without drawing, following each mission's "solve"
// script. It proves a mission can be finished and that a given rifle can do it.
// It never runs during normal play.
// ---------------------------------------------------------------------------
const Test = CB.Test = {};

// Fit whatever the mission demands (a suppressor, subsonic ammo) if the rifle
// can take it, the same way a player would in the loadout screen.
Test.cfgFor = function (M, gunId, base) {
  const g = GUN_BY_ID[gunId], cfg = Object.assign(defaultConfig(gunId), base || {}), need = M.needs || {};
  if ((need.quiet || need.silent) && g.supp === true && cfg.muzzle === 'mz_none') cfg.muzzle = 'mz_supl';
  if (need.silent && g.supp === true && partFits(PART_BY_ID.am_sub, g)) cfg.ammo = 'am_sub';
  return cfg;
};

Test.run = function (missionId, gunId, o) {
  o = o || {};
  const M = MISSION_BY_ID[missionId];
  const cfg = Test.cfgFor(M, gunId, o.cfg);
  const st = buildStats(gunId, cfg);
  const why = gunAllowed(M, st);
  if (why && !o.force) return { skipped: true, why };
  const flags = o.flags || {};
  const sim = new Sim(M, st, o.vantage || 0, { flags, shotSeed: o.seed === undefined ? 1 : o.seed });
  const log = [];
  let script = typeof M.solve === 'function' ? M.solve(sim.A, st, flags, sim) : M.solve;
  if (o.script) script = o.script;
  script = (script || []).map((c) => c.slice());
  let pc = 0, waitUntil = 0, cur = null, pendingShot = null;
  const dt = 1 / 60, maxT = o.maxT || 400;
  sim.setZoom(st.zoomMax);
  const aimAt = (pt, lead) => {
    const sol = sim.aimFor(pt.x, pt.y, pt.z, lead);
    const sh = sim.sh;
    sh.ax = clamp(sol.ax - (sh.swx + sh.recx + sh.offx), sim.lim.x0 - 30, sim.lim.x1 + 30);
    sh.ay = clamp(sol.ay - (sh.swy + sh.recy + sh.offy), sim.lim.y0 - 30, sim.lim.y1 + 30);
    return sol;
  };
  const objById = (id) => sim.S.objects.find((ob) => ob.id === id);
  while (sim.state === 'play' && sim.t < maxT) {
    // run script commands that are ready
    let guard = 0;
    while (guard++ < 20 && sim.state === 'play') {
      if (!cur) { cur = script[pc++]; if (!cur) break; cur._t0 = sim.t; }
      const c = cur, k = c[0];
      if (k === 'wait') { if (sim.t - c._t0 >= c[1]) { cur = null; continue; } break; }
      if (k === 'until') { if (c[1](sim, sim.A)) { cur = null; continue; } if (sim.t - c._t0 > (c[2] || 120)) { log.push('until timed out at step ' + (pc - 1)); cur = null; continue; } break; }
      if (k === 'cover') { if (st.quiet || sim.covered()) { cur = null; continue; } if (sim.t - c._t0 > (c[1] || 90)) { log.push('no cover came'); cur = null; continue; } break; }
      if (k === 'fn') { c[1](sim, sim.A); cur = null; continue; }
      if (k === 'hold') { sim.holdBreath(true); cur = null; continue; }
      if (k === 'dial') { const steps = Math.round((c[1] - sim.sh.zeroR) / 25); for (let i = 0; i < Math.abs(steps); i++) sim.dial(sign(steps)); cur = null; continue; }
      if (k === 'shoot' || k === 'shootObj' || k === 'shootAt' || k === 'shootPt') {
        if (c._fired) { // wait for the round to land (unless told not to)
          const b = c._bullet;
          if ((c[3] && c[3].nowait) || !b || !b.alive) {
            if (k === 'shoot' && !(c[3] && c[3].nowait)) { const a = sim.byId[c[1]]; if (a && !a.dead && !(c[3] && c[3].miss)) log.push('shot at ' + c[1] + ' did not kill (t=' + sim.t.toFixed(1) + ')'); }
            if (k === 'shootObj') { const ob = objById(c[1]); if (ob && ob.alive && ob.kind !== 'bell' && ob.kind !== 'horn' && !sim.did('obj:' + c[1])) log.push('shot at object ' + c[1] + ' missed'); }
            cur = null; continue;
          }
          break;
        }
        // line up, wait for the rifle to be ready and settled, then fire
        let pt, lead = null;
        if (k === 'shoot') {
          const a = sim.byId[c[1]];
          if (!a || a.dead || a.gone) { log.push('target ' + c[1] + ' not available (t=' + sim.t.toFixed(1) + ')'); cur = null; continue; }
          if (a.hidden) { if (sim.t - c._t0 > 60) { log.push('target ' + c[1] + ' stayed hidden'); cur = null; continue; } break; }
          pt = sim.partPoint(a, c[2] || 'torso');
          const vx = a.inVeh ? a.inVeh.v * a.inVeh.dir * (a.inVeh.goal !== null ? 1 : 0) : (a.goal !== null ? a.vx : 0);
          lead = { vx, extra: st.action === 'charge' ? (c._charging ? Math.max(0, sim.sh.chargeT) : 0.85) : 0 };
        } else if (k === 'shootObj') {
          const ob = objById(c[1]); if (!ob) { log.push('no object ' + c[1]); cur = null; continue; }
          pt = { x: ob.x, y: ob.y, z: ob.plane.z };
        } else if (k === 'shootPt') { pt = c[1](sim, sim.A); if (!pt) { if (sim.t - c._t0 > 60) { log.push('shootPt never had a point'); cur = null; continue; } break; } if (pt.vx) lead = { vx: pt.vx, extra: st.action === 'charge' ? (c._charging ? Math.max(0, sim.sh.chargeT) : 0.85) : 0 };
        } else pt = { x: c[1], y: c[2], z: c[3].z || c[3] };
        aimAt(pt, lead);
        const sh = sim.sh;
        if (!sim.canFire() || Math.abs(sh.recy) > 0.05 || Math.abs(sh.recvy) > 0.6 || sim.t - c._t0 < 0.25) break;
        if (st.action === 'charge') { if (!c._charging) { c._charging = true; sim.fire(); } break; }
        const n0 = sim.bullets.length;
        if (sim.fire()) { c._fired = true; c._bullet = sim.bullets[n0]; }
        break;
      }
      log.push('unknown script step ' + k); cur = null;
    }
    // a charging rifle fires on its own; keep the aim solved until it does
    if (cur && cur._charging && !cur._fired) {
      const n = sim.bullets.length; sim.step(dt);
      if (sim.bullets.length > n) { cur._fired = true; cur._bullet = sim.bullets[n]; }
      sim.ev.length = 0; continue;
    }
    sim.step(dt);
    sim.ev.length = 0;
  }
  const res = sim.result || { win: false, fail: { code: 'timeout', text: 'test ran out of time' }, stars: 0 };
  return { ok: !!res.win, stars: res.stars, clean: res.clean, precise: res.precise, challenge: res.challenge, fail: res.fail ? res.fail.code + ': ' + res.fail.text : null, t: +sim.t.toFixed(1), shots: sim.stats.shots, log, outcome: res.outcome ? res.outcome.id : null, alarmBy: sim.alarmBy || null };
};

// Every mission with every rifle it allows, and every shooting position.
Test.matrix = function (o) {
  o = o || {};
  const out = { runs: 0, fails: [], notClean: [], skipped: 0, perMission: {} };
  MISSIONS.forEach((M) => {
    if (o.only && o.only.indexOf(M.id) < 0) return;
    const variants = M.testFlags || [{}];
    const pm = out.perMission[M.id] = { ok: 0, fail: 0, guns: [], skipped: [] };
    variants.forEach((flags) => {
      GUNS.forEach((g) => {
        const nv = (M.vantages || [0]).length;
        for (let v = 0; v < nv; v++) {
          if (v > 0 && g.id !== (o.vantageGun || 'halden') && g.id !== 'fenwick') continue;
          const r = Test.run(M.id, g.id, { vantage: v, flags, seed: o.seed });
          if (r.skipped) { if (v === 0 && pm.skipped.indexOf(g.id) < 0) pm.skipped.push(g.id); out.skipped++; continue; }
          out.runs++;
          if (r.ok) { pm.ok++; if (pm.guns.indexOf(g.id) < 0) pm.guns.push(g.id); if (r.stars < 3 && !M.loudOk) out.notClean.push({ m: M.id, gun: g.id, v, stars: r.stars, clean: r.clean, precise: r.precise, shots: r.shots, alarmBy: r.alarmBy }); }
          else { pm.fail++; out.fails.push({ m: M.id, gun: g.id, v, flags, fail: r.fail, log: r.log, t: r.t }); }
        }
      });
    });
  });
  return out;
};

// Debug sheet: every rifle drawn in a grid (used when checking the artwork).
Test.gunSheet = function (cfgOver, skins) {
  const c = document.createElement('canvas'), dpr = 2, cols = 2, cw = 600, ch = 150;
  c.width = cols * cw * dpr; c.height = Math.ceil(GUNS.length / cols) * ch * dpr;
  c.style.cssText = 'position:fixed;left:0;top:0;z-index:99;width:' + cols * cw + 'px;background:#141a22';
  const x = c.getContext('2d'); x.scale(dpr, dpr); x.fillStyle = '#141a22'; x.fillRect(0, 0, 4000, 4000);
  GUNS.forEach((g, i) => {
    const cfg = Object.assign(defaultConfig(g.id), cfgOver || {}); if (skins) cfg.skin = skins[i % skins.length];
    ['muzzle', 'barrel', 'stock', 'support', 'mag'].forEach((s) => { const p = PART_BY_ID[cfg[s]]; if (p && !partFits(p, g)) cfg[s] = defaultConfig(g.id)[s]; });
    if (!scopeFits(SCOPE_BY_ID[cfg.scope], g)) cfg.scope = g.scope;
    const cx = (i % cols) * cw + cw / 2, cy = Math.floor(i / cols) * ch + ch / 2;
    drawGun(x, g.id, cfg, cx, cy, cw - 30, ch - 16, { time: 1.2 });
    x.fillStyle = '#8e9aa8'; x.font = '12px sans-serif'; x.fillText(g.name + (skins ? '  /  ' + SKIN_BY_ID[cfg.skin].name : ''), (i % cols) * cw + 8, Math.floor(i / cols) * ch + 14);
  });
  document.body.appendChild(c);
  return GUNS.length;
};
