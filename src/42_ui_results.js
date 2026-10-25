// ---------------------------------------------------------------------------
// Menus, part 3: results, the in-mission notebook, settings and the ending.
// ---------------------------------------------------------------------------
const ALARM_WHY = { shot: 'your shot was heard', guard: 'a guard raised the alarm', witness: 'a bystander saw it happen', camera: 'a camera caught it', target: 'the target saw trouble and called it in', explosion: 'the blast woke everyone', vehicle: 'the car\'s occupants raised the alarm', susp: 'a guard had been spooked too many times' };
const FAIL_TIP = {
  civ: 'When two people look alike, wait. They will do something that tells them apart.',
  escaped: 'They only show themselves for so long. Decide earlier, or look for something in the scene that would hold them in place.',
  alarm: 'This one had to stay silent from start to finish. A quieter rifle, a louder moment to hide the shot in, or a darker place to do it.',
  time: 'The clock is part of the puzzle. Find the target first, then worry about the perfect moment.',
  ammo: 'Make each round count. The range is a good place to learn a rifle before trusting it on a contract.',
  protect: 'Check who is standing behind and beside the person you are aiming at before you fire.',
  lost: 'Each gunman gives a few seconds of warning. Deal with whoever will fire first.',
  nokill: 'Wait until the area is clear, or find a way to draw people away first.',
  messy: 'Look for something heavy overhead and something holding it up.',
  spare: 'Read the brief again: not everyone in the scope is yours to take.',
  guard: 'The guards were off limits on this contract. Wait for them to look away instead.',
};

// ---- results: a payout you watch happen ----
// A still of the last moment fills the screen. The handler's word on it comes first, typed out
// next to their portrait. Then the verdict is stamped, each check lights in turn and its star
// slams down, the credits and xp count up and the xp bar fills. A new rank takes the whole
// screen to show what it hands you and what it opens in the shop; new records get a badge and
// any caches are left on the table to tap. A tap anywhere that is not a button jumps to the end.
//
// The verdict, the stars, the money and the two buttons sit on the left and never scroll; the
// words and the details scroll on the right. The buttons work from the first moment.
//
// The result may carry, from the mission: score { total, parts: [{ label, pts }] }, seenBy
// { who, what, where, t }, ghost (nobody heard a shot) and best (the previous best score).
// Each is shown when it is there and simply left out when it is not.
UI.results = function (M, res, last) {
  if (M.practice) { if (UI.drillResult && UI.drillResult(M, res, last)) return; UI.tab = 'range'; UI.hub(); return; }
  last = last || { missionId: M.id, opts: {} }; last.opts = last.opts || {};
  const still = UI.grabStill(last); // before anything else can draw over the picture
  const d = Save.data, recBefore = Object.assign({ stars: 0, ch: false }, d.missions[M.id] || {});
  const guided = !!last.opts.guided;
  const pay = Progress.apply(M, res, { gun: last.opts.gun, guided });
  const medals = CB.Medals ? CB.Medals.afterMission(M, res, pay, last) : [];
  const mastery = CB.Mastery ? CB.Mastery.afterMission(last.opts.gun, res, pay) : null;
  UI.shots = {}; UI.shotKeys = []; // a choice may have changed what later scenes look like
  const i = MISSIONS.indexOf(M), next = MISSIONS[i + 1];
  const win = res.win, stats = res.stats || {}, score = res.score && res.score.total ? res.score : null;
  // the handler's word on it (or, after a failure, the reason, in their voice)
  let story = '', who = speakerOf(M);
  if (win) {
    const txt = (res.outcome && res.outcome.text) || missionText(M, 'after');
    story = typeof txt === 'function' ? txt(d.flags, res) : txt;
    if (M.ch === 6 && res.outcome) who = 'Afterwards';
  } else story = res.fail ? res.fail.text : '';
  const pkey = CB.portraitKey(who) || (who === 'Afterwards' ? 'kestrel' : null);
  const check = (k, ok, text, sub, icon) => `<div class="chk pend ${ok ? 'ok' : 'no'} ${icon ? 'ch' : ''}" data-k="${k}"><i>${icon || (ok ? ICON.check : ICON.cross)}</i><div><b>${text}</b>${sub ? '<span>' + sub + '</span>' : ''}</div></div>`;
  const clean = res.clean, sb = res.seenBy;
  const cleanWhy = !clean ? (sb && sb.who ? 'seen by ' + esc(sb.who) + (sb.what ? ': ' + esc(sb.what) : '') + (sb.where ? ', ' + esc(sb.where) : '') + (sb.t !== undefined ? ' at ' + fmtTime(sb.t) : '') : res.alarmBy ? ALARM_WHY[res.alarmBy] || 'the alarm was raised' : 'a bystander panicked') : '';
  // new records
  const recs = [];
  if (win && stats.longest && pay.before.longest > 0 && Math.round(stats.longest) > pay.before.longest) recs.push({ k: 'longest', text: 'Longest kill: ' + Math.round(stats.longest) + ' m' });
  if (win && pay.before.time !== null && res.time < pay.before.time - 0.05) recs.push({ k: 'time', text: 'Fastest on this contract: ' + fmtTime(res.time) });
  const prevBest = res.best !== undefined && res.best !== null ? res.best : pay.before.score;
  if (score && prevBest > 0 && score.total > prevBest) recs.push({ k: 'score', text: 'Best score: ' + fmtCr(score.total) });
  // a guided run says plainly what it did not earn, and what is still there to be earned
  const waiting = pay.held.length ? (pay.held.length === 2 ? 'The three-star cache and the challenge cache are' : pay.held[0] === 'stars' ? 'The three-star cache is' : 'The challenge cache is') + ' still waiting for a run without the guide.' : 'Stars, credits and xp count as normal.';
  const guideNote = guided && win ? `<div class="gnote rv" data-k="extra"><b>Guided run: no ${pay.caches.length ? 'star or challenge caches' : 'caches'} this time.</b><span>${waiting}</span></div>` : '';
  const rewards = pay.lines.length ? `<div class="rew rv" data-k="extra"><div class="eyebrow">Earned</div>${pay.lines.map((l) => `<div class="rl"><span>${esc(l.label)}</span><b>${l.note ? esc(l.note) : (l.cr ? '+' + fmtCr(l.cr) + ' cr' : '') + (l.xp ? '<i>+' + l.xp + ' xp</i>' : '')}</b></div>`).join('')}
    <div class="rl tot"><span>Total</span><b>+${fmtCr(pay.cr)} cr<i>+${pay.xp} xp</i></b></div></div>` : '';
  const nC = pay.caches.length, topTier = ['vault', 'sealed', 'field'].find((k) => pay.caches.indexOf(k) >= 0) || 'field';
  const cachebox = nC ? `<button class="cachebox has crate rv" data-k="cache" data-a="caches" data-snd="riser"><span class="cb-case"><canvas data-case="${topTier}" data-live="1"></canvas></span><div class="cb-t"><b>${nC} ${nC === 1 ? 'cache' : 'caches'} earned</b><i>Left on the table for you. Tap to open ${nC === 1 ? 'it' : 'them'}.</i></div></button>` : '';
  const scoreCard = score ? `<div class="rew scorecard rv" data-k="extra"><div class="eyebrow">Score</div>${(score.parts || []).map((p) => `<div class="rl"><span>${esc(p.label)}</span><b>${p.pts > 0 ? '+' : ''}${fmtCr(p.pts)}</b></div>`).join('')}<div class="rl tot"><span>Total</span><b>${fmtCr(score.total)}</b></div></div>` : '';
  const medalRow = medals.length ? `<div class="rs-medals rv" data-k="medals"><div class="eyebrow">${medals.length === 1 ? 'Medal' : medals.length + ' medals'}</div><div class="mdrow">${medals.map((m) => `<div class="md t${m.tier}"><canvas data-medal="${m.id}" data-tier="${m.tier}"></canvas><div><b>${esc(m.name)}${m.tiers > 1 ? ' ' + ROMAN[m.tier] : ''}</b><span>${esc(m.payText)}</span></div></div>`).join('')}</div></div>` : '';
  const mastRow = mastery && mastery.ups.length ? `<div class="rs-mast rv" data-k="medals"><div class="eyebrow">Rifle mastery</div>${mastery.ups.map((u) => `<div class="rl"><span>${esc(u.text)}</span><b>${esc(u.pay || '')}</b></div>`).join('')}</div>` : '';
  const choiceNote = win && res.outcome && res.outcome.set ? `<div class="decision rv" data-k="extra"><span class="dstamp">Decision recorded</span><span>${pay.outcomeNew ? 'A new way this has gone. ' : ''}This choice changes later contracts. The dossier keeps every way it has gone; play it again to choose differently.</span></div>` : '';
  const nextLabel = pay.storyEnd ? 'The ending' : next ? (pay.chapterDone ? 'Continue' : 'Next contract') : 'Contracts';
  const R0 = rankOf(pay.xpFrom), xpTo = pay.xpFrom + pay.xp;
  const chN = MISSIONS.filter((m) => m.ch === M.ch).indexOf(M) + 1;
  UI.render(`<div class="scr results pay ${win ? 'win' : 'lose'}">
    <canvas class="rs-bg"></canvas><div class="rs-shade"></div>
    <div class="split">
      <div class="side">
        <div class="rs-head"><div class="eyebrow">${esc(M.title)}  ·  ${ROMAN[M.ch]}.${chN}${guided ? '  ·  guided run' : ''}</div>
          <div class="stamp-wrap"><div class="stamp ${win ? '' : 'bad'}"><h1><span>Contract</span> ${win ? 'complete' : 'failed'}</h1></div></div>
          ${win ? '<div class="starline"><div class="bigstars">' + starsHtml(0, 'big pay') + '</div>' + (res.ghost ? '<span class="ghostb rv" data-k="recs">Ghost<i>Nobody heard a shot</i></span>' : '') + '</div>' : `<div class="nexttime rv" data-k="tip"><div class="eyebrow">Next time</div><p>${esc(FAIL_TIP[res.fail && res.fail.code] || 'Watch the scene for a full cycle before you commit. Most people repeat themselves.')}</p></div>`}</div>
        ${win || pay.xp ? `<div class="rs-pay">
          ${score ? `<div class="rs-score"><span>Score</span><b data-to="${score.total}">0</b>${recs.some((r) => r.k === 'score') ? '<em class="newrec rv" data-k="recs">New best</em>' : ''}</div>` : ''}
          <div class="rp-row"><span class="rp-cr"><b data-to="${pay.cr}" data-pre="+" data-suf=" cr">+0 cr</b></span><span class="rp-xp"><b data-to="${pay.xp}" data-pre="+" data-suf=" xp">+0 xp</b></span></div>
          <div class="rp-rank"><canvas class="rp-ins" data-insignia="${R0.n}" data-pres="${d.prestige || 0}"></canvas><div class="rp-bar"><div class="rp-lab"><b class="rp-name">${esc(R0.name)}</b></div><div class="xpbar"><i style="width:${UI.xpPct(pay.xpFrom).toFixed(1)}%"></i></div><i class="rp-num">${UI.xpLabel(pay.xpFrom)}</i></div></div>
        </div>` : ''}
        <div class="cta two">
          <button class="btn ghost" data-a="again">${guided && win ? 'Try it yourself' : win ? 'Play again' : 'Try again'}</button>
          ${win ? `<button class="btn pri" data-a="next" data-snd="go">${nextLabel}</button>` : '<button class="btn pri" data-a="hub">Contracts</button>'}
        </div>
      </div>
      <div class="main scroll">
        ${story ? `<div class="say after radio rv" data-k="say">${pkey ? `<canvas class="sp-face" data-portrait="${pkey}" data-mood="${win ? 'talk' : 'grim'}"></canvas>` : ''}<div class="sp-t"><b>${esc(who)}</b><p class="tw">${esc(story)}</p></div></div>` : ''}
        ${recs.length ? `<div class="recrow rv" data-k="recs">${recs.map((r) => `<span class="newrec">New record<i>${esc(r.text)}</i></span>`).join('')}</div>` : ''}
        ${cachebox}
        ${win ? `<div class="chks">
          ${check('c1', true, 'Completed')}
          ${check('c2', clean, 'Clean', clean ? (res.ghost ? 'Nobody saw it, and nobody heard a shot' : 'Nobody saw or heard a thing') : 'Not clean: ' + cleanWhy)}
          ${check('c3', res.precise, 'Precise', res.shots + (res.shots === 1 ? ' shot' : ' shots') + ' fired, ' + res.par + ' allowed')}
          ${check('c4', res.challenge || recBefore.ch, 'Challenge' + (res.challenge && !recBefore.ch ? ' complete' : recBefore.ch ? ' (already done)' : ''), esc(M.challenge.text), ICON.medal)}
          ${pay.duckNew ? check('c5', true, 'Rubber duck found', Object.keys(d.ducks).length + ' of ' + MISSIONS.length, ICON.duck) : ''}
        </div>` : `${pay.duckNew ? '<div class="chks">' + check('c5', true, 'Rubber duck found', 'That still counts.', ICON.duck) + '</div>' : ''}`}
        <div class="statrow mini rv" data-k="extra"><div><b>${fmtTime(res.time)}</b><i>time</i></div><div><b>${res.shots}</b><i>shots</i></div><div><b>${stats.longest ? Math.round(stats.longest) + ' m' : 'n/a'}</b><i>longest</i></div><div><b>${stats.heads || 0}</b><i>headshots</i></div></div>
        ${choiceNote}${guideNote}${medalRow}${mastRow}
        ${pay.unlocked.map((u) => `<div class="banner got rv" data-k="extra">Unlocked: ${esc(u.text)}</div>`).join('')}
        ${scoreCard}${rewards}
      </div>
    </div></div>`, {
    // after a guided win, "Try it yourself" plays the same contract without the guide
    again() { UI.payStop(); UI.launch(last.missionId, guided && win ? Object.assign({}, last.opts, { guided: false }) : last.opts); },
    hub() { UI.payStop(); UI.tab = 'contracts'; UI.chapter = M.ch; UI.hub(); },
    caches() { UI.payEnd(true); UI.afterCache = () => { const b = UI.root.querySelector('.cachebox'); if (b) b.remove(); }; UI.openCache(); },
    next() {
      UI.payStop();
      UI.tab = 'contracts';
      const go = () => { if (pay.storyEnd) UI.epilogue(() => { UI.chapter = 6; UI.hub(); }); else if (next && pay.chapterDone) { UI.chapter = next.ch; UI.hub(); } else if (next && Progress.missionOpen(next)) { UI.chapter = next.ch; UI.brief(next); } else { UI.chapter = M.ch; UI.hub(); } };
      if (pay.chapterDone) UI.chapterEnd(M.ch, go); else go();
    },
  }, 'is-results');
  UI.paintStill(UI.root.querySelector('.rs-bg'), still, M, res, win);
  // ---- the order things happen in (seconds) ----
  const root = UI.root.querySelector('.results'), q = (s) => root.querySelector(s), all = (s) => root.querySelectorAll(s);
  const S = [];
  let t = 0.15;
  const sayEl = q('.say.after');
  const quiet = () => { const f = sayEl && sayEl.querySelector('.sp-face'); if (f && f.dataset.mood === 'talk') { f.dataset.mood = 'calm'; UI.paintJob(f._job || UI.jobFor(f), 0); } };
  if (sayEl) { S.push([t, () => { show(sayEl); Sfx.ui('radio'); UI.typeIn(sayEl.querySelector('.tw'), 85, quiet); }]); t += Math.min(1.0, 0.4 + story.length / 220); }
  S.push([t, () => { const s = q('.stamp-wrap'); s.classList.add('in'); Sfx.ui(win ? 'go' : 'deny'); }]); t += 0.45;
  if (!win) { S.push([t, () => show(q('.nexttime'))]); t += 0.3; }
  if (win) {
    const lit = [true, clean, res.precise];
    ['c1', 'c2', 'c3'].forEach((k, j) => { S.push([t, () => { lightCheck(k); if (lit[j]) { const stars = all('.bigstars .stars i'); const n = lit.slice(0, j + 1).filter(Boolean).length; const st = stars[n - 1]; if (st) { st.classList.add('on', 'slam'); Sfx.ui('star'); } } else Sfx.ui('tick'); }]); t += lit[j] ? 0.36 : 0.22; });
    S.push([t, () => lightCheck('c4')]); t += 0.14;
    if (pay.duckNew) { S.push([t, () => lightCheck('c5')]); t += 0.14; }
  } else if (pay.duckNew) { S.push([t, () => lightCheck('c5')]); t += 0.2; }
  S.push([t, () => { all('[data-to]').forEach((e) => count(e, +e.dataset.to, 0.95)); if (pay.xp) xpRun(); }]);
  t += pay.xp ? 1.15 : 0.6;
  S.push([t, () => { all('.rv[data-k="recs"], .rv[data-k="medals"]').forEach(show); if (recs.length || medals.length) Sfx.ui('buy'); }]); t += 0.25;
  S.push([t, () => { const c = q('.cachebox'); if (c) { show(c); c.classList.add('drop'); } all('.rv[data-k="extra"]').forEach(show); }]); t += 0.3;
  S.push([t, () => end()]);
  // ---- the moving parts ----
  const P = { t: 0, i: 0, S, counters: [], done: false, root, takeovers: [] };
  UI.pay = P;
  function show(e) { if (e && !e.classList.contains('in')) { e.classList.add('in'); const cvs = e.querySelectorAll('canvas'); if (cvs.length) UI.paintIn(e, 'root'); } }
  function lightCheck(k) { const e = q('.chk[data-k="' + k + '"]'); if (e) { e.classList.remove('pend'); e.classList.add('lit'); } }
  function count(e, to, dur) { P.counters.push({ e, from: 0, to, t0: P.t, dur, pre: e.dataset.pre || '', suf: e.dataset.suf || '', ticks: 0 }); }
  // the xp bar: fill, and when it reaches the end, a new insignia and on again from empty
  function xpRun() { P.xp = { from: pay.xpFrom, to: xpTo, t0: P.t, dur: 1.0, shownRank: R0.n }; }
  function xpAt(x) {
    const r = rankOf(x), lab = q('.rp-name'), num = q('.rp-num'), bar = q('.xpbar i'), ins = q('.rp-ins');
    if (!bar) return;
    if (P.xp && r.n !== P.xp.shownRank) { P.xp.shownRank = r.n; if (ins) { ins.dataset.insignia = r.n; UI.paintIn(ins.parentElement, 'root'); ins.classList.remove('bump'); void ins.offsetWidth; ins.classList.add('bump'); } if (lab) lab.textContent = r.name; q('.rp-rank').classList.add('up'); Sfx.ui('star'); }
    bar.style.width = UI.xpPct(x).toFixed(1) + '%'; if (num) num.textContent = UI.xpLabel(x);
  }
  function end() {
    if (P.done) return; P.done = true;
    while (P.i < P.S.length) P.S[P.i++][1]();
    const tw = sayEl && sayEl.querySelector('.tw'); if (tw && tw._tw) tw._tw.finish(); quiet();
    P.counters.forEach((c) => { c.e.textContent = c.pre + fmtCr(c.to) + c.suf; }); P.counters = [];
    if (P.xp) { xpAt(P.xp.to); P.xp = null; }
    // what takes the whole screen once the counting is done: a new rank, then a new rifle
    if (pay.rankUps.length) P.takeovers.push(() => UI.rankUp(pay));
    pay.unlocked.filter((u) => u.kind === 'gun').forEach((u) => P.takeovers.push(() => UI.unbox(u.id, 'A gift from Pip')));
    UI.payNext(P);
  }
  P.end = end;
  P.tick = (dt) => {
    if (UI.pay !== P || !root.isConnected) return false;
    if (P.done) return true;
    P.t += dt;
    while (P.i < P.S.length && P.S[P.i][0] <= P.t) P.S[P.i++][1]();
    P.counters = P.counters.filter((c) => { const u = clamp((P.t - c.t0) / c.dur, 0, 1), v = c.to * easeOut(u); c.e.textContent = c.pre + fmtCr(v) + c.suf; const tk = Math.floor(u * 7); if (tk > c.ticks && c.to > 0 && c.e.closest('.rp-cr')) { c.ticks = tk; Sfx.ui('tick'); } return u < 1; });
    if (P.xp) { const u = clamp((P.t - P.xp.t0) / P.xp.dur, 0, 1); xpAt(lerp(P.xp.from, P.xp.to, easeOut(u))); if (u >= 1) P.xp = null; }
    return true;
  };
  UI.anim(P.tick);
  // a tap on the picture or the words (not a button) jumps to the end
  root.addEventListener('click', (e) => { if (e.target.closest('[data-a]') || P.done) return; end(); });
};
// Stop the payout: leaving the results never leaves a takeover waiting to pop up somewhere else.
UI.payStop = function () { if (UI.pay) { UI.pay.done = true; UI.pay.takeovers = []; } UI.pay = null; };
// Jump to the end (the cache button does this, so nothing animates behind the cache).
UI.payEnd = function (quiet) { const P = UI.pay; if (!P) return; if (quiet) P.takeovers = P.takeovers || []; if (P.end && !P.done) { P.end(); if (quiet) { P.takeovers = []; UI.closeOverlay(); } } };
// Show the next full-screen moment after the payout, if any.
UI.payNext = function (P) {
  if (UI.pay !== P || !P.root.isConnected) return;
  const f = P.takeovers.shift(); if (!f) return;
  UI.afterTakeover = () => UI.payNext(P);
  f();
};
// The experience bar: how far through the current rank, and the numbers under it.
UI.xpPct = function (x) { const r = rankOf(x), n = nextRank(x); return n ? clamp(((x - r.xp) / (n.xp - r.xp)) * 100, 0, 100) : 100; };
UI.xpLabel = function (x) { const n = nextRank(x); return n ? fmtCr(Math.floor(x)) + ' / ' + fmtCr(n.xp) + ' xp' : fmtCr(Math.floor(x)) + ' xp  ·  top rank'; };
// Type a paragraph out, the rest of it already laid out (invisible), so nothing jumps.
UI.typeIn = function (p, cps, done) {
  if (!p) return;
  const full = p.dataset.full || p.textContent; p.dataset.full = full;
  let n = 0; const T = { p, full, done: false };
  p._tw = T;
  const set = () => { p.innerHTML = esc(full.slice(0, n)) + '<span class="tw-rest">' + esc(full.slice(n)) + '</span>'; };
  set();
  T.finish = () => { if (T.done) return; T.done = true; p.textContent = full; if (done) done(); };
  UI.anim((dt) => { if (T.done || !p.isConnected || p._tw !== T) return false; n = Math.min(full.length, n + Math.max(1, Math.round(dt * cps))); set(); if (n >= full.length) { T.finish(); return false; } return true; });
  return T;
};
// The last frame of the mission, copied before anything can draw over it. Only a real run
// (Game.lastStart) has one; anything else gets a picture of the scene instead.
UI.grabStill = function (last) {
  try {
    const cv = Game.cv; if (!cv || last !== Game.lastStart || !cv.width || !cv.height) return null;
    const x = cv.getContext('2d'), w = cv.width, h = cv.height, px = x.getImageData(w >> 1, h >> 1, 4, 4).data;
    let any = 0; for (let k = 3; k < px.length; k += 4) any += px[k];
    if (!any) return null;
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(cv, 0, 0); return c;
  } catch (e) { return null; }
};
// Paint the still (or a picture of the scene) behind the results: cover the screen, take some of
// the colour out, darken it, and darker again behind the words. A failure goes cold and red.
UI.paintStill = function (cv, still, M, res, win) {
  if (!cv) return;
  const c = UI.fitCanvas(cv); if (!c) return;
  const x = c.x, w = c.w, h = c.h;
  let src = still;
  if (!src) { const s = UI.sceneShot(M, res.vantage || 0, Math.min(900, w), Math.min(420, h)); src = s && s.cv; }
  if (src) {
    const k = Math.max(w / src.width, h / src.height), sw = src.width * k, sh = src.height * k;
    x.drawImage(src, (w - sw) / 2, (h - sh) / 2, sw, sh);
  } else { x.fillStyle = '#121820'; x.fillRect(0, 0, w, h); }
  x.save();
  x.globalCompositeOperation = 'saturation'; x.fillStyle = 'rgba(128,128,128,' + (win ? 0.3 : 0.75) + ')'; x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'multiply'; x.fillStyle = win ? '#d8cdb8' : '#b88a86'; x.fillRect(0, 0, w, h);
  x.restore();
  const vg = x.createRadialGradient(w * 0.66, h * 0.45, h * 0.25, w * 0.66, h * 0.5, Math.max(w, h) * 0.8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
  x.fillStyle = vg; x.fillRect(0, 0, w, h);
  // fine grain, like a photograph
  const R = makeRng(7); x.fillStyle = 'rgba(255,255,255,0.035)'; for (let i = 0; i < 900; i++) x.fillRect(R.f() * w, R.f() * h, 1, 1);
};

// ---- full-screen moments ----
// A takeover covers the screen; a tap anywhere (or its button) closes it and lets the next one in.
UI.takeover = function (html, h, cls) {
  UI.overlay(`<div class="takeover ${cls || ''}" data-a="close" data-quiet="1"><div class="tk-raybox"><div class="tk-rays"></div></div>${html}</div>`, Object.assign({
    close() { UI.closeOverlay(); const f = UI.afterTakeover; UI.afterTakeover = null; if (f) f(); },
  }, h || {}), 'tk');
};
// What a reward on the rank track looks like as a chip.
UI.rewardChip = function (w) {
  if (!w) return '';
  const ic = w.k === 'cache' ? `<canvas data-case="${w.tier}"></canvas>` : w.k === 'card' ? `<canvas data-card="${w.id}"></canvas>` : w.k === 'tint' ? `<canvas data-tint="${w.id}"></canvas>` : `<span class="crc">cr</span>`;
  return `<span class="rwchip k-${w.k}"><span class="rw-ic">${ic}</span><b>${esc(w.text)}</b></span>`;
};
// A new rank: the insignia comes down, the rewards are laid out, and what it opens in the shop.
UI.rankUp = function (pay) {
  const d = Save.data, ups = pay.rankUps, top = ups[ups.length - 1], R = RANKS[top.n - 1];
  const guns = [], parts = [], scopes = [];
  ups.forEach((u) => { guns.push.apply(guns, u.opens.guns); parts.push.apply(parts, u.opens.parts); scopes.push.apply(scopes, u.opens.scopes); });
  const rewards = ups.map((u) => u.w).filter(Boolean);
  const more = parts.length + scopes.length;
  Sfx.rarity(Math.min(4, 1 + Math.floor(R.fam / 4)));
  UI.takeover(`<div class="tk-in">
      <div class="tk-badge"><canvas data-insignia="${R.n}" data-pres="${d.prestige || 0}"></canvas></div>
      <div class="tk-t">
        <div class="eyebrow">${ups.length > 1 ? ups.length + ' ranks up' : 'Rank up'}</div>
        <h2>Rank ${R.n}</h2><h3>${esc(R.name)}</h3>
        ${rewards.length ? `<div class="tk-rew">${rewards.map(UI.rewardChip).join('')}</div>` : ''}
        ${guns.length || more ? `<div class="tk-opens"><div class="eyebrow">Now for sale at Pip's</div>
          ${guns.length ? `<div class="tk-guns">${guns.slice(0, 3).map((g) => `<div class="tk-gun"><span class="plate dark"><canvas data-gun="${g.id}"></canvas></span><b>${esc(g.name)}</b><i>${fmtCr(g.price)} cr</i></div>`).join('')}</div>` : ''}
          ${more ? `<p class="tk-more">${more === 1 ? 'One new part' : more + ' new parts and scopes'}${guns.length > 3 ? ' and ' + (guns.length - 3) + ' more rifles' : ''} on the bench.</p>` : ''}</div>` : ''}
      </div></div>
    <div class="tk-foot">Tap to continue</div>`, null, 'rankup');
};
// A new rifle out of its case: it rises into the light, with what makes it different.
UI.unbox = function (gunId, sub, onBench) {
  const d = Save.data, g = GUN_BY_ID[gunId]; if (!g) return;
  const cfg = gunCfg(gunId), st = buildStats(gunId, cfg), bars = statBars(st);
  d.seenGuns[gunId] = 1; Save.write();
  const best = STAT_LABELS.slice().sort((a, b) => bars[b[0]] - bars[a[0]]).slice(0, 4);
  Sfx.rarity(3);
  UI.takeover(`<div class="tk-in ub">
      <div class="ub-stage"><span class="ub-bed"></span><span class="ub-gun"><canvas data-gun="${gunId}" data-live="1" ${uiCfgAttr(cfg)}></canvas><span class="ub-sweep"></span></span></div>
      <div class="tk-t">
        <div class="eyebrow">${esc(sub || 'New rifle')}  ·  ${esc(g.maker)}</div>
        <h2>${esc(g.name)}</h2>
        <p class="ub-sub">${esc(g.calName)}  ·  ${ACTION_NAME[g.action].split(',')[0]}  ·  good to ${st.eff} m</p>
        <div class="bars ub-bars">${best.map(([k, label]) => `<div class="sbar"><span>${label}<em>${Math.round(bars[k] * 100)}</em></span><i><i style="width:${Math.round(bars[k] * 100)}%"></i></i></div>`).join('')}</div>
        <div class="cta two">${onBench ? `<p class="ub-note">${d.equipped === gunId ? 'It is the rifle you carry now.' : ''} Its parts are on the bench.</p><button class="btn pri" data-a="close" data-snd="go">Continue</button>` : `<button class="btn ghost" data-a="bench">Fit parts</button><button class="btn pri" data-a="close" data-snd="go">Continue</button>`}</div>
      </div></div>`, {
    bench() { UI.closeOverlay(); UI.afterTakeover = null; UI.payStop(); UI.bench(gunId); },
  }, 'unbox');
};
// The end of a chapter (see UI.chapterBoard in 40_ui.js for the board itself).
UI.chapterEnd = function (n, go) {
  if (UI.chapterBoard) return UI.chapterBoard(n, go);
  const c = CHAPTER_BY_N[n];
  if (c.outro) UI.cards([{ h: c.title, p: c.outro }], go, 'End of chapter ' + ROMAN[n]); else go();
};

UI.epilogue = function (done) {
  const e = epilogue(Save.data.flags);
  const cards = e.lines.map((p, i) => ({ h: i === 0 ? e.title : '', p }));
  cards.push({ h: 'Cold Bore', p: 'Thank you for playing. There are other endings: five choices decide this one, and any of them can be made differently by playing that contract again. The rubber ducks are still out there too.' });
  UI.cards(cards, done, 'Epilogue');
};

// ---- the notebook (pause) ----------------------------------------------------------------------
// Opened from the top left of a mission. The three buttons share the top line with the title, so
// on a short sideways screen the notes get all the height that is left.
UI.notebook = function (sim) {
  const M = sim.M, st = sim.st, V = sim.vantage;
  const intel = missionText(M, 'intel') || [];
  const dist = Math.round(sim.S.refZ - sim.eye0.z);
  UI.overlay(`<div class="sheet tall nb"><div class="sh-head"><h3>Notebook</h3></div>
  <div class="sh-foot"><button class="btn ghost" data-a="leave" data-snd="back">${M.practice ? 'Leave' : 'Give up'}</button><button class="btn ghost" data-a="restart">Start over</button><button class="btn pri" data-a="resume" data-snd="go">Resume</button></div>
  <div class="sh-body twocol">
    <div>
      <div class="obj"><div class="eyebrow">${esc(M.title)}</div><p>${esc(missionText(M, 'objective'))}</p></div>
      ${Game.coach ? UI.walkthrough(M, 'Guided run: the steps') : ''}
      ${intel.length ? '<div class="intel"><div class="eyebrow">What we know</div><ul>' + intel.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul></div>' : ''}
      ${M.brief ? '<details><summary>Read the full brief again</summary><p class="dim">' + esc(missionText(M, 'brief')) + '</p></details>' : ''}
      <button class="btn ghost wide" data-a="how">Controls and how to play</button>
    </div>
    <div>
      <div class="eyebrow">${esc(st.name)} from ${esc(V.name)}, about ${dist} m</div>
      ${UI.dopeTable(st, Math.max(dist * 1.5, 300), dist)}
      <p class="dim">Hold up = how many mils to aim above the target (one mil is one mark on the scope glass). Wind = how far a 5 m/s crosswind moves the bullet; aim that far into the wind. ${st.scope.turret ? 'Your scope has a zero dial: set it to the distance and the hold becomes zero.' : ''}</p>
    </div>
  </div></div>`, {
    resume() { Game.pause(false); if (!Game.touch && Game.stage.requestPointerLock) { try { Game.stage.requestPointerLock(); } catch (e) { /* fine */ } } },
    restart() { UI.closeOverlay(); const l = Game.lastStart; Game.stop(); UI.launch(l.missionId, l.opts); },
    leave() { UI.closeOverlay(); Game.stop(); UI.tab = M.practice ? 'range' : 'contracts'; UI.hub(); },
    how() { UI.howTo(); UI.oHandlers.close = () => UI.notebook(sim); },
  });
};

// ---- settings -----------------------------------------------------------------------------------
UI.settings = function (fromTitle) {
  const d = Save.data, s = d.settings;
  const tog = (key, label, sub) => `<button class="setrow" data-a="tog" data-k="${key}"><div><b>${label}</b>${sub ? '<i>' + sub + '</i>' : ''}</div><span class="sw ${s[key] ? 'on' : ''}"><i></i></span></button>`;
  const sld = (key, label, min, max, step, sub) => `<div class="setrow col"><div><b>${label}</b>${sub ? '<i>' + sub + '</i>' : ''}</div><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}" aria-label="${label}"></div>`;
  const help = [['full', 'Full help', 'An amber marker in the scope shows where the bullet will land. Put the marker on the target. MARK locks a target\'s distance so the marker stays right while you aim high.'], ['notes', 'Spotter\'s notes', 'You are told the range, the wind and how far to hold. You do the aiming. Recommended.'], ['veteran', 'Veteran', 'No range, no wind number, no hold. Read flags, smoke and the scope marks yourself. Pays 25% more.']];
  const body = `<div class="scroll">
    <div class="setcols">
    <div class="setgroup tester-group"><div class="eyebrow">Tester mode (temporary)</div>
      <button class="setrow" data-a="tester"><div><b>Unlock everything</b><i>${CB.Tester.on
        ? 'On. Every rifle, part, scope, skin and contract is open, with a million credits and some caches. Your real progress is set aside and comes back exactly as it was when you switch this off.'
        : 'Opens every rifle, part, scope, skin and contract, so you can try it all early. Your real progress is set aside, untouched, until you switch it off. Nothing you do while it is on counts toward it.'}</i></div><span class="sw ${CB.Tester.on ? 'on' : ''}"><i></i></span></button>
      ${CB.Tester.on ? '<button class="setrow" data-a="testerAgain"><div><b>Start the tester save again</b><i>Throws away stars and loadouts made in tester mode and makes a fresh copy of your real progress with everything unlocked.</i></div><span class="arrow">&rsaquo;</span></button>' : ''}
    </div>
    <div class="setgroup"><div class="eyebrow">Aiming</div>
      ${sld('sens', 'Drag speed', 0.25, 1.4, 0.05, 'How far the scope moves when you drag. Lower is finer.')}
      ${tog('invert', 'Reverse the drag', 'Off: the view follows your finger. On: the crosshair follows your finger.')}
      <div class="setrow col"><div><b>Help while aiming</b></div><div class="opts">${help.map((h) => `<button class="opt ${s.assist === h[0] ? 'on' : ''}" data-a="assist" data-v="${h[0]}"><b>${h[1]}</b><i>${h[2]}</i></button>`).join('')}</div></div>
    </div>
    <div class="setgroup"><div class="eyebrow">The shot</div>
      ${tog('killcam', 'Kill camera', 'On the shot that finishes a contract, follow the bullet all the way in.')}
      ${tog('gore', 'Blood and X-ray detail', 'Turn off for a clean version of the kill camera and no blood in the scope.')}
    </div>
    <div class="setgroup"><div class="eyebrow">Sound</div>${sld('sfx', 'Effects', 0, 1, 0.05)}${sld('music', 'Music', 0, 1, 0.05)}</div>
    <div class="setgroup"><div class="eyebrow">Picture</div>${tog('lowRes', 'Lighter graphics', 'Draws the picture with fewer dots, which is easier on the phone. Try this if the scope feels choppy.')}</div>
    <div class="setgroup"><div class="eyebrow">Your progress</div>
      <button class="setrow" data-a="how"><div><b>How to play</b><i>Controls, the numbers under the scope, and how to run the game full screen.</i></div><span class="arrow">&rsaquo;</span></button>
      ${CB.Tester.on ? '<p class="dim">Backing up and erasing are switched off while tester mode is on, so they can only ever touch your real save.</p>' : `<button class="setrow" data-a="export"><div><b>Back up or move your save</b><i>Copy a code you can paste into this game on another phone or browser.</i></div><span class="arrow">&rsaquo;</span></button>
      <button class="setrow danger" data-a="reset"><div><b>Erase everything and start again</b></div><span class="arrow">&rsaquo;</span></button>`}
    </div>
    </div>
    <p class="fine">Cold Bore. No ads, no real money, no accounts. Progress is stored only in this browser on this device${Save.ok ? '' : ' (this browser is currently refusing to store it, so it will be lost when the tab closes)'}. Sound is generated live, so there is nothing to download.</p>
    </div>`;
  const h = {
    tog(ds) { s[ds.k] = !s[ds.k]; Save.write(); if (ds.k === 'lowRes') Game.resize(); UI.keepScroll(); UI.settings(fromTitle); },
    assist(ds) { s.assist = ds.v; Save.write(); UI.keepScroll(); UI.settings(fromTitle); },
    // tester mode (temporary): switch saves, then forget every picture and choice the menus were holding
    tester() {
      const on = !CB.Tester.on; CB.Tester.set(on);
      UI._chSet = false; UI.chapter = 1; UI.shots = {}; UI.shotKeys = []; UI.colSkin = null; UI.shown = {}; Sfx.setVolumes();
      UI.keepScroll(); UI.settings(fromTitle);
      UI.toast(on ? 'Tester mode on: everything is unlocked.' : 'Tester mode off: your real progress is back.', 'good');
    },
    testerAgain() { CB.Tester.restart(); UI._chSet = false; UI.shots = {}; UI.shotKeys = []; UI.colSkin = null; UI.keepScroll(); UI.settings(fromTitle); UI.toast('Fresh tester save made.', 'good'); },
    how() { UI.howTo(); },
    back() { UI.title(); },
    export() {
      UI.overlay(`<div class="sheet tall"><div class="sh-head"><h3>Back up or move your save</h3><button class="x" data-a="close">${ICON.cross}</button></div><div class="sh-body twocol">
        <div><p class="dim">This is your whole save as a code. Copy it and keep it somewhere safe.</p>
        <textarea id="savetxt" readonly aria-label="Your save code">${Save.exportText()}</textarea><button class="btn ghost wide" data-a="copy">Copy the code</button></div>
        <div><p class="dim">Or paste a code from another phone or browser here. Loading it replaces the progress on this one.</p>
        <textarea id="loadtxt" placeholder="Paste a save code here" aria-label="Save code to load"></textarea><button class="btn pri wide" data-a="load">Load this code</button></div></div></div>`, {
        close() { UI.closeOverlay(); },
        copy() { const t = document.getElementById('savetxt'); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* older browsers */ } if (navigator.clipboard) navigator.clipboard.writeText(t.value).then(() => UI.toast('Copied.', 'good'), () => UI.toast(ok ? 'Copied.' : 'Select the text and copy it by hand.')); else UI.toast(ok ? 'Copied.' : 'Select the text and copy it by hand.'); },
        load() { const ok = Save.importText(document.getElementById('loadtxt').value); if (ok) { UI.closeOverlay(); UI.toast('Save loaded.', 'good'); Sfx.setVolumes(); UI._chSet = false; UI.shots = {}; UI.shotKeys = []; UI.colSkin = null; UI.settings(fromTitle); } else { Sfx.ui('deny'); UI.toast('That code does not look right.', 'bad'); } },
      });
    },
    reset() {
      UI.overlay(`<div class="sheet dlg"><div class="sh-head"><h3>Erase everything?</h3><button class="x" data-a="close">${ICON.cross}</button></div><div class="sh-body"><p>This deletes every rifle, part, skin, star and choice on this device. It cannot be undone.</p><div class="nb-btns"><button class="btn ghost" data-a="close">Keep my progress</button><button class="btn danger" data-a="yes">Erase it all</button></div></div></div>`, {
        close() { UI.closeOverlay(); },
        yes() { Save.reset(); UI.closeOverlay(); UI._chSet = false; UI.chapter = 1; UI.tab = 'contracts'; UI.shots = {}; UI.shotKeys = []; UI.colSkin = null; UI.shown = {}; Sfx.setVolumes(); UI.title(); UI.toast('Progress erased.'); },
      });
    },
  };
  const eb = `<div class="eyebrow">Make it yours <span class="bld">Build ${BUILD}</span></div>`;
  if (fromTitle) UI.render(`<div class="scr settings"><div class="bar"><button class="ib" data-a="back" data-snd="back">${ICON.back}</button><div class="bar-t">${eb}<h2>Settings</h2></div></div>${body}</div>`, h, 'is-settings');
  else UI.render(UI.shell(`<div class="hd">${eb}<h2>Settings</h2></div>`, body), UI.shellHandlers(h), 'is-settings');
  UI.root.querySelectorAll('input[type=range]').forEach((inp) => {
    inp.addEventListener('input', () => { s[inp.dataset.k] = +inp.value; Sfx.setVolumes(); });
    inp.addEventListener('change', () => { Save.write(); if (inp.dataset.k === 'sfx') Sfx.ui('tap'); });
  });
};
