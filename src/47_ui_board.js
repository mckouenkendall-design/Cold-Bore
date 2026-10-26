// ---------------------------------------------------------------------------
// Contracts as a case board. Each contract is a photo of its target pinned to a dark board, with
// red string running from each to the next. A finished one is struck through with a red cross and
// stamped with its stars, challenge medal and duck; one not open yet is a redacted file. A big
// NEXT button goes straight to the next contract. When a chapter ends, its board comes up with
// every target crossed out, the chapter's totals and the choice you made, before its last page.
// ---------------------------------------------------------------------------

// A file photo of a contract's target(s), standing, on a dark backdrop: drawn once per size and kept.
UI.tphotos = {};
UI.targetPhoto = function (M, w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = M.id + '/' + w + 'x' + h + '/' + JSON.stringify(Save.data.flags || {});
  if (UI.tphotos[key]) return UI.tphotos[key];
  const dpr = Math.min(2, window.devicePixelRatio || 1), cv = document.createElement('canvas');
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const x = cv.getContext('2d'); x.scale(dpr, dpr);
  let sim = null, T = [];
  try {
    sim = new Sim(M, buildStats('halden'), 0, { flags: Save.data.flags, shotSeed: 1 });
    let ids = (sim.rules.kill || []).slice(); if (!ids.length) ids = sim.actors.filter((a) => a.role === 'target').map((a) => a.id);
    T = ids.map((id) => sim.byId[id]).filter((a) => a && a.plane).slice(0, 3);
    if (!T.length && sim.rules.destroy && sim.rules.destroy.length) T = [];
  } catch (e) { sim = null; }
  // the backdrop takes a little of the place's light: warm at dusk, blue at night, pale by day
  const tm = sim ? sim.S.time : 'day', top = { night: '#2a3550', dusk: '#5a4a52', dawn: '#5a5a6a', day: '#6a7a8a', overcast: '#5f6a75', snow: '#8a96a4' }[tm] || '#55606e';
  const bg = x.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, top); bg.addColorStop(1, '#14191f'); x.fillStyle = bg; x.fillRect(0, 0, w, h);
  const gl = x.createRadialGradient(w * 0.6, h * 0.25, 2, w * 0.6, h * 0.25, h); gl.addColorStop(0, 'rgba(255,236,200,0.28)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gl; x.fillRect(0, 0, w, h);
  if (T.length) {
    const k = (h * 0.82) / 2.05, step = w / T.length;
    T.forEach((A, i) => {
      const C = Object.assign(Object.create(Object.getPrototypeOf(A)), A, { inVeh: null, hidden: false, gone: false, dead: false, anim: 'stand', animCur: 'stand', animFrom: null, faceS: undefined, face: 1, seat: undefined, y: A.inVeh ? 0 : A.y });
      x.save(); x.translate(step * (i + 0.5), h * 0.96); x.scale(k, -k); x.translate(-C.x, -C.y);
      try { drawFigure(x, C, { px: 1 / k, t: 1, ink: '#13161b', light: 1, rim: 'rgba(255,240,215,0.5)', wind: 0 }); } catch (e) { /* drawn without */ }
      x.restore();
    });
  } else if (sim && sim.rules.destroy && sim.rules.destroy.length) { // a job against a thing: a crosshair over a box
    x.strokeStyle = 'rgba(255,255,255,0.5)'; x.lineWidth = 1.5; const cx = w / 2, cy = h * 0.5, r = Math.min(w, h) * 0.26;
    x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.moveTo(cx - r * 1.4, cy); x.lineTo(cx + r * 1.4, cy); x.moveTo(cx, cy - r * 1.4); x.lineTo(cx, cy + r * 1.4); x.stroke();
    x.fillStyle = '#c0392b'; x.fillRect(cx - r * 0.45, cy - r * 0.35, r * 0.9, r * 0.7);
  }
  const R = makeRng(hashStr(M.id)); x.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 160; i++) x.fillRect(R.f() * w, R.f() * h, 1, 1);
  UI.tphotos[key] = cv;
  return cv;
};

// The stars, as an ink stamp.
function boardStars(n) { let s = ''; for (let i = 0; i < 3; i++) s += '<i class="' + (i < n ? 'on' : '') + '">' + ICON.star + '</i>'; return s; }

UI.contracts = function () {
  const d = Save.data;
  // open on the furthest chapter reached the first time
  if (!UI._chSet) { UI._chSet = true; for (let n = 6; n >= 1; n--) if (Progress.chapterOpen(n)) { UI.chapter = n; break; } }
  const n = UI.chapter, c = CHAPTER_BY_N[n], list = MISSIONS.filter((m) => m.ch === n), open = Progress.chapterOpen(n);
  if (open && !d.seen['ch' + n]) return UI.chapterIntro(n, () => UI.contracts());
  const st = list.reduce((s, m) => s + ((d.missions[m.id] && d.missions[m.id].stars) || 0), 0);
  const nch = list.filter((m) => d.missions[m.id] && d.missions[m.id].ch).length, ndk = list.filter((m) => d.ducks[m.id]).length;
  const chips = CHAPTERS.map((k) => { const o = Progress.chapterOpen(k.n); return `<button class="chip ${k.n === n ? 'on' : ''} ${o ? '' : 'locked'}" data-a="chap" data-n="${k.n}" title="${esc(k.title)}"><b>${ROMAN[k.n]}</b>${o ? '' : ICON.lock}</button>`; }).join('');
  const next = open ? list.find((m) => Progress.missionOpen(m) && !(d.missions[m.id] && d.missions[m.id].done)) : null;
  const closed = open && Progress.chapterDone(n);
  const cards = open ? list.map((m, i) => {
    const rec = d.missions[m.id] || { stars: 0 }, ok = Progress.missionOpen(m), done = !!rec.done, rot = ((hashStr(m.id) % 7) - 3) * 0.55;
    const isChoice = m.outcomes && m.outcomes.some((o) => o.set);
    if (!ok) {
      return `<button class="mrow card redacted" data-a="mission" data-id="${m.id}" data-snd="deny" style="--rot:${rot.toFixed(2)}deg"><span class="pin"></span>
        <span class="mth"><span class="rbars"><i></i><i></i><i></i><i></i></span><span class="rstamp">Classified</span><span class="num">${i + 1}</span></span>
        <span class="mb"><span class="mt"><b><span class="blk">${'&#9608;'.repeat(Math.max(4, Math.min(9, m.title.length - 2)))}</span></b><i>Finish the one before it</i></span></span></button>`;
    }
    return `<button class="mrow card ${done ? 'done' : ''} ${next === m ? 'next' : ''}" data-a="mission" data-id="${m.id}" style="--rot:${rot.toFixed(2)}deg"><span class="pin"></span>
      <span class="mth"><canvas data-tphoto="${m.id}" data-lazy></canvas>${done ? '<span class="xout"></span>' : ''}<span class="num">${i + 1}</span>${isChoice ? '<span class="choicetag">A choice</span>' : ''}</span>
      <span class="mb"><span class="mt"><b>${esc(m.title)}</b><i>${m.range} m${UI.isDaily && UI.isDaily(m) ? '  ·  <em class="dly">Daily x2</em>' : ''}</i></span>
        <span class="stamps">${done ? `<span class="sstars stars">${boardStars(rec.stars || 0)}</span>` : ''}<i class="medal ${rec.ch ? 'on' : ''}" title="Challenge">${ICON.medal}</i><i class="duck ${d.ducks[m.id] ? 'on' : ''}" title="Rubber duck">${ICON.duck}</i></span></span></button>`;
  }).join('') : `<div class="empty">${ICON.lock}<p>Finish chapter ${ROMAN[n - 1]} to open this one.</p></div>`;
  const nextBtn = next ? `<button class="btn pri big nextbtn" data-a="mission" data-id="${next.id}" data-snd="go"><span><i>Next contract</i>${esc(next.title)}</span><b>&rsaquo;</b></button>`
    : closed ? `<div class="closedtag"><span class="cstamp">Closed</span><span>${st} of ${list.length * 3} stars  ·  ${nch} challenges  ·  ${ndk} ducks</span></div>` : '';
  UI.render(UI.shell(`<div class="chips">${chips}</div>`, `
    <div class="scroll board">
      <div class="chhead"><div class="ch-t"><div class="eyebrow">Chapter ${ROMAN[n]}  ·  ${esc(c.place)}</div><h2>${esc(c.title)}</h2>
        <div class="chmeta"><span>${starsHtml(0, 'one on')} ${st} / ${list.length * 3}</span>${open ? '<button class="lnk" data-a="story">Chapter opening</button>' : ''}${closed && c.outro ? '<button class="lnk" data-a="outro">How it ended</button>' : ''}</div></div>
        ${nextBtn}</div>
      <div class="mlist">${open ? '<canvas class="strings"></canvas>' : ''}${cards}</div>
      ${d.seen.ending && n === 6 ? '<button class="btn ghost wide" data-a="epi">Read the ending again</button>' : ''}
    </div>`), UI.shellHandlers({
    chap(ds) { UI.chapter = +ds.n; UI.contracts(); },
    story() { UI.chapterIntro(n, () => UI.contracts()); },
    outro() { UI.cards([{ h: c.title, p: c.outro }], () => UI.contracts(), 'End of chapter ' + ROMAN[n], [STORY_ART.outro[n]]); },
    epi() { UI.epilogue(() => UI.contracts()); },
    mission(ds) { const M = MISSION_BY_ID[ds.id]; if (!Progress.missionOpen(M)) { UI.toast('Finish the contract before it first.'); return; } UI.brief(M); },
  }), 'is-contracts');
  UI.boardStrings(UI.root.querySelector('.mlist'));
};

// Red string from each pin to the next, sagging a little. Drawn again whenever the board is laid out.
UI.boardStrings = function (box) {
  if (!box) return;
  const cv = box.querySelector('.strings'); if (!cv) return;
  const draw = () => {
    if (!cv.isConnected) return;
    const pins = Array.prototype.map.call(box.querySelectorAll('.pin'), (p) => { const r = p.getBoundingClientRect(), b = box.getBoundingClientRect(); return { x: r.left + r.width / 2 - b.left, y: r.top + r.height / 2 - b.top + box.scrollTop, done: p.parentElement.classList.contains('done'), red: p.parentElement.classList.contains('redacted') }; });
    cv.style.width = box.scrollWidth + 'px'; cv.style.height = box.scrollHeight + 'px';
    const c = UI.fitCanvas(cv); if (!c) return;
    const x = c.x; x.lineCap = 'round';
    for (let i = 0; i + 1 < pins.length; i++) {
      const a = pins[i], b = pins[i + 1], sag = Math.min(34, 10 + Math.hypot(b.x - a.x, b.y - a.y) * 0.08);
      x.strokeStyle = 'rgba(0,0,0,0.45)'; x.lineWidth = 2.6; x.setLineDash(b.red ? [6, 5] : []);
      x.beginPath(); x.moveTo(a.x + 1, a.y + 2); x.quadraticCurveTo((a.x + b.x) / 2 + 1, Math.max(a.y, b.y) + sag + 2, b.x + 1, b.y + 2); x.stroke();
      x.strokeStyle = a.done && b.done ? '#d8382c' : b.red ? 'rgba(190,60,50,0.45)' : '#b8342a'; x.lineWidth = 1.7;
      x.beginPath(); x.moveTo(a.x, a.y); x.quadraticCurveTo((a.x + b.x) / 2, Math.max(a.y, b.y) + sag, b.x, b.y); x.stroke();
    }
    x.setLineDash([]);
  };
  draw(); setTimeout(draw, 60);
  if (!UI._strRz) { UI._strRz = true; window.addEventListener('resize', () => setTimeout(() => UI.boardStrings(UI.root && UI.root.querySelector('.board .mlist')), 200)); }
};

// The end of a chapter: the board with every target crossed out one after another, a CLOSED stamp,
// the chapter's totals and the choice made in it. Continue goes on to the chapter's last page.
UI.chapterBoard = function (n, go) {
  const d = Save.data, c = CHAPTER_BY_N[n], list = MISSIONS.filter((m) => m.ch === n);
  const st = list.reduce((s, m) => s + ((d.missions[m.id] && d.missions[m.id].stars) || 0), 0);
  const nch = list.filter((m) => d.missions[m.id] && d.missions[m.id].ch).length, ndk = list.filter((m) => d.ducks[m.id]).length;
  const cr = list.reduce((s, m) => s + m.reward.cr, 0);
  const dec = DECISIONS.filter((k) => MISSION_BY_ID[k.m] && MISSION_BY_ID[k.m].ch === n);
  const decHtml = dec.map((k) => { const o = (d.missions[k.m] || {}).outcome, yes = !!d.flags[k.flag]; return `<div class="ce-dec"><canvas data-portrait="${k.who}"></canvas><div><b>${esc(o && k.ways[o] ? k.ways[o] : yes ? k.yes : k.no)}</b><span>${esc(yes ? k.yes : k.no)}. It changes what comes later.</span></div></div>`; }).join('');
  const cards = list.map((m, i) => `<div class="mrow card done ce" style="--rot:${(((hashStr(m.id) % 7) - 3) * 0.55).toFixed(2)}deg;--d:${(0.25 + i * 0.22).toFixed(2)}s"><span class="pin"></span><span class="mth"><canvas data-tphoto="${m.id}"></canvas><span class="xout"></span><span class="num">${i + 1}</span></span><span class="mb"><span class="stamps"><span class="sstars stars">${boardStars((d.missions[m.id] || {}).stars || 0)}</span></span></span></div>`).join('');
  const tStamp = 0.25 + list.length * 0.22 + 0.2;
  UI.render(`<div class="scr chend">
    <div class="ce-board board"><div class="mlist"><canvas class="strings"></canvas>${cards}</div></div>
    <div class="ce-side">
      <div class="eyebrow">Chapter ${ROMAN[n]}  ·  ${esc(c.place)}</div><h2>${esc(c.title)}</h2>
      <div class="ce-stamp" style="animation-delay:${tStamp.toFixed(2)}s">Closed</div>
      <div class="ce-tot"><div><b>${st}<small>/${list.length * 3}</small></b><i>stars</i></div><div><b>${nch}<small>/${list.length}</small></b><i>challenges</i></div><div><b>${ndk}<small>/${list.length}</small></b><i>ducks</i></div><div><b>${fmtCr(cr)}</b><i>in fees</i></div></div>
      ${decHtml ? '<div class="eyebrow ce-de">The choice you made</div>' + decHtml : ''}
      <div class="cta"><button class="btn pri big wide" data-a="next" data-snd="go">Continue</button></div>
    </div></div>`, {
    next() { const f = () => go(); if (c.outro) UI.cards([{ h: c.title, p: c.outro }], f, 'End of chapter ' + ROMAN[n], [STORY_ART.outro[n]]); else f(); },
  }, 'is-chend');
  UI.boardStrings(UI.root.querySelector('.chend .mlist'));
};
