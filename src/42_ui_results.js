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

UI.results = function (M, res, last) {
  if (M.practice) { UI.tab = 'range'; UI.hub(); return; }
  const d = Save.data, recBefore = Object.assign({ stars: 0, ch: false }, d.missions[M.id] || {});
  const pay = Progress.apply(M, res, { gun: last.opts.gun });
  const i = MISSIONS.indexOf(M), next = MISSIONS[i + 1];
  const win = res.win;
  const check = (ok, text, sub) => `<div class="chk ${ok ? 'ok' : 'no'}"><i>${ok ? ICON.check : ICON.cross}</i><div><b>${text}</b>${sub ? '<span>' + sub + '</span>' : ''}</div></div>`;
  let story = '';
  if (win) {
    const txt = (res.outcome && res.outcome.text) || missionText(M, 'after');
    const t2 = typeof txt === 'function' ? txt(d.flags, res) : txt;
    if (t2) story = `<div class="say after"><b>${esc(M.ch === 6 && res.outcome ? 'Afterwards' : speakerOf(M))}</b><p>${esc(t2)}</p>${res.outcome && res.outcome.set ? '<em>This choice changes later contracts. Play it again to choose differently.</em>' : ''}</div>`;
  }
  const rewards = pay.lines.length ? `<div class="rew"><div class="eyebrow">Earned</div>${pay.lines.map((l) => `<div class="rl"><span>${esc(l.label)}</span><b>${l.note ? esc(l.note) : (l.cr ? '+' + fmtCr(l.cr) + ' cr' : '') + (l.xp ? '<i>+' + l.xp + ' xp</i>' : '')}</b></div>`).join('')}
    <div class="rl tot"><span>Total</span><b>+${fmtCr(pay.cr)} cr<i>+${pay.xp} xp</i></b></div></div>` : '';
  const extras = (pay.rankUp ? `<div class="banner up">Rank ${pay.rankUp.n}: ${esc(pay.rankUp.name)}</div>` : '')
    + pay.unlocked.map((u) => `<div class="banner got">Unlocked: ${esc(u.text)}</div>`).join('')
    + (pay.caches.length ? `<button class="cachebox has" data-a="caches" data-snd="riser"><div class="cb-ic">${ICON.box}</div><div class="cb-t"><b>${pay.caches.length} ${pay.caches.length === 1 ? 'cache' : 'caches'} earned</b><i>Tap to open ${pay.caches.length === 1 ? 'it' : 'them'} now</i></div></button>` : '');
  const clean = res.clean, cleanWhy = !clean ? (res.alarmBy ? ALARM_WHY[res.alarmBy] || 'the alarm was raised' : 'a bystander panicked') : '';
  UI.render(`<div class="scr results ${win ? 'win' : 'lose'}">
    <div class="scroll">
      <div class="rs-head"><div class="eyebrow">${esc(M.title)}</div><h1>${win ? 'Contract complete' : 'Contract failed'}</h1>
        ${win ? '<div class="bigstars">' + starsHtml(res.stars, 'big anim') + '</div>' : '<p class="why">' + esc(res.fail ? res.fail.text : '') + '</p>'}</div>
      ${win ? `<div class="chks">
        ${check(true, 'Completed')}
        ${check(clean, 'Clean', clean ? 'Nobody saw or heard a thing' : 'Not clean: ' + cleanWhy)}
        ${check(res.precise, 'Precise', res.shots + (res.shots === 1 ? ' shot' : ' shots') + ' fired, ' + res.par + ' allowed')}
        <div class="chk ch ${res.challenge || recBefore.ch ? 'ok' : 'no'}"><i>${ICON.medal}</i><div><b>Challenge${res.challenge && !recBefore.ch ? ' complete' : recBefore.ch ? ' (already done)' : ''}</b><span>${esc(M.challenge.text)}</span></div></div>
        ${pay.duckNew ? '<div class="chk ch ok"><i>' + ICON.duck + '</i><div><b>Rubber duck found</b><span>' + Object.keys(d.ducks).length + ' of ' + MISSIONS.length + '</span></div></div>' : ''}
      </div>` : `<div class="tip"><div class="eyebrow">Next time</div><p>${esc(FAIL_TIP[res.fail && res.fail.code] || 'Watch the scene for a full cycle before you commit. Most people repeat themselves.')}</p></div>${pay.duckNew ? '<div class="chks"><div class="chk ch ok"><i>' + ICON.duck + '</i><div><b>Rubber duck found</b><span>That still counts.</span></div></div></div>' : ''}`}
      ${story}
      <div class="statrow"><div><b>${fmtTime(res.time)}</b><i>time</i></div><div><b>${res.shots}</b><i>shots</i></div><div><b>${res.stats.longest ? Math.round(res.stats.longest) + ' m' : 'n/a'}</b><i>longest hit</i></div><div><b>${res.stats.heads}</b><i>headshots</i></div></div>
      ${rewards}${extras}
      <div class="pad"></div>
    </div>
    <div class="cta two">
      <button class="btn ghost" data-a="again">${win ? 'Play again' : 'Try again'}</button>
      ${win ? `<button class="btn pri" data-a="next" data-snd="go">${pay.storyEnd ? 'The ending' : next ? (pay.chapterDone ? 'Continue' : 'Next contract') : 'Contracts'}</button>` : '<button class="btn pri" data-a="hub">Contracts</button>'}
    </div></div>`, {
    again() { UI.launch(last.missionId, last.opts); },
    hub() { UI.tab = 'contracts'; UI.chapter = M.ch; UI.hub(); },
    caches() { UI.afterCache = () => { const b = UI.root.querySelector('.cachebox'); if (b) b.remove(); }; UI.openCache(); },
    next() {
      UI.tab = 'contracts';
      const go = () => { if (pay.storyEnd) UI.epilogue(() => { UI.chapter = 6; UI.hub(); }); else if (next && pay.chapterDone) { UI.chapter = next.ch; UI.hub(); } else if (next && Progress.missionOpen(next)) { UI.chapter = next.ch; UI.brief(next); } else { UI.chapter = M.ch; UI.hub(); } };
      const c = CHAPTER_BY_N[M.ch];
      if (pay.chapterDone && c.outro) UI.cards([{ h: c.title, p: c.outro }], go, 'End of chapter ' + ROMAN[M.ch]); else go();
    },
  }, 'is-results');
  if (win) for (let k = 0; k < res.stars; k++) setTimeout(() => Sfx.ui('star'), 500 + k * 380);
};

UI.epilogue = function (done) {
  const e = epilogue(Save.data.flags);
  const cards = e.lines.map((p, i) => ({ h: i === 0 ? e.title : '', p }));
  cards.push({ h: 'Cold Bore', p: 'Thank you for playing. There are other endings: five choices decide this one, and any of them can be made differently by playing that contract again. The rubber ducks are still out there too.' });
  UI.cards(cards, done, 'Epilogue');
};

// ---- the notebook (pause) ----------------------------------------------------------------------
UI.notebook = function (sim) {
  const M = sim.M, st = sim.st, V = sim.vantage;
  const intel = missionText(M, 'intel') || [];
  const dist = Math.round(sim.S.refZ - sim.eye0.z);
  UI.overlay(`<div class="sheet tall nb"><div class="sh-head"><h3>Notebook</h3><button class="x" data-a="resume">${ICON.cross}</button></div><div class="sh-body">
    <div class="obj"><div class="eyebrow">${esc(M.title)}</div><p>${esc(missionText(M, 'objective'))}</p></div>
    ${intel.length ? '<div class="intel"><div class="eyebrow">What we know</div><ul>' + intel.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul></div>' : ''}
    ${M.brief ? '<details><summary>Read the full brief again</summary><p class="dim">' + esc(missionText(M, 'brief')) + '</p></details>' : ''}
    <div class="eyebrow pad-t">${esc(st.name)} from ${esc(V.name)}, about ${dist} m</div>
    ${UI.dopeTable(st, Math.max(dist * 1.5, 300), dist)}
    <p class="dim">Hold up = how many mils to aim above the target. Wind = how far a 5 m/s crosswind moves the bullet; aim that far into the wind. ${st.scope.turret ? 'Your scope has a zero dial: set it to the distance and the hold becomes zero.' : ''}</p>
    <button class="btn ghost wide" data-a="how">Controls and how to play</button>
  </div>
  <div class="sh-foot"><button class="btn ghost" data-a="leave" data-snd="back">${M.practice ? 'Leave' : 'Give up'}</button><button class="btn ghost" data-a="restart">Start over</button><button class="btn pri" data-a="resume" data-snd="go">Resume</button></div></div>`, {
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
  const sld = (key, label, min, max, step, sub) => `<div class="setrow col"><div><b>${label}</b>${sub ? '<i>' + sub + '</i>' : ''}</div><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}"></div>`;
  const help = [['full', 'Full help', 'An amber marker in the scope shows where the bullet will land. Put the marker on the target.'], ['notes', 'Spotter\'s notes', 'You are told the range, the wind and how far to hold. You do the aiming. Recommended.'], ['veteran', 'Veteran', 'No range, no wind number, no hold. Read flags, smoke and the scope marks yourself. Pays 25% more.']];
  const body = `<div class="scroll">
    <div class="chhead"><div class="eyebrow">Make it yours</div><h2>Settings</h2></div>
    <div class="setgroup"><div class="eyebrow">Aiming</div>
      ${sld('sens', 'Drag speed', 0.25, 1.4, 0.05, 'How far the scope moves when you drag. Lower is finer.')}
      ${tog('invert', 'Reverse the drag', 'Off: the view follows your finger. On: the crosshair follows your finger.')}
      <div class="setrow col"><div><b>Help while aiming</b></div><div class="opts">${help.map((h) => `<button class="opt ${s.assist === h[0] ? 'on' : ''}" data-a="assist" data-v="${h[0]}"><b>${h[1]}</b><i>${h[2]}</i></button>`).join('')}</div></div>
      ${tog('slowmo', 'Slow motion on long shots', 'Time slows while a far shot is in the air.')}
    </div>
    <div class="setgroup"><div class="eyebrow">Sound</div>${sld('sfx', 'Effects', 0, 1, 0.05)}${sld('music', 'Music', 0, 1, 0.05)}</div>
    <div class="setgroup"><div class="eyebrow">Picture</div>${tog('lowRes', 'Lighter graphics', 'Draws at a lower resolution. Try this if the scope feels choppy on your phone.')}</div>
    <div class="setgroup"><div class="eyebrow">Your progress</div>
      <button class="setrow" data-a="how"><div><b>How to play</b></div><span class="arrow">&rsaquo;</span></button>
      <button class="setrow" data-a="export"><div><b>Back up or move your save</b><i>Copy a code you can paste into this game on another phone or browser.</i></div><span class="arrow">&rsaquo;</span></button>
      <button class="setrow danger" data-a="reset"><div><b>Erase everything and start again</b></div><span class="arrow">&rsaquo;</span></button>
    </div>
    <p class="fine">Cold Bore. No ads, no purchases, no accounts. Progress is stored only in this browser on this device${Save.ok ? '' : ' (this browser is currently refusing to store it, so it will be lost when the tab closes)'}. On a phone, use your browser's "Add to Home Screen" to play it full screen like an app. Sound is generated live, so there is nothing to download.</p>
    <div class="pad"></div></div>`;
  const h = {
    tog(ds) { s[ds.k] = !s[ds.k]; Save.write(); if (ds.k === 'lowRes') Game.resize(); UI.keepScroll(); UI.settings(fromTitle); },
    assist(ds) { s.assist = ds.v; Save.write(); UI.keepScroll(); UI.settings(fromTitle); },
    how() { UI.howTo(); },
    back() { UI.title(); },
    export() {
      UI.overlay(`<div class="sheet tall"><div class="sh-head"><h3>Back up or move your save</h3><button class="x" data-a="close">${ICON.cross}</button></div><div class="sh-body">
        <p class="dim">This is your whole save as a code. Copy it and keep it somewhere, or paste a code from another device below and press Load.</p>
        <textarea id="savetxt" readonly>${Save.exportText()}</textarea><button class="btn ghost wide" data-a="copy">Copy the code</button>
        <textarea id="loadtxt" placeholder="Paste a save code here"></textarea><button class="btn pri wide" data-a="load">Load this code (replaces current progress)</button></div></div>`, {
        close() { UI.closeOverlay(); },
        copy() { const t = document.getElementById('savetxt'); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* older browsers */ } if (navigator.clipboard) navigator.clipboard.writeText(t.value).then(() => UI.toast('Copied.', 'good'), () => UI.toast(ok ? 'Copied.' : 'Select the text and copy it by hand.')); else UI.toast(ok ? 'Copied.' : 'Select the text and copy it by hand.'); },
        load() { const ok = Save.importText(document.getElementById('loadtxt').value); if (ok) { UI.closeOverlay(); UI.toast('Save loaded.', 'good'); Sfx.setVolumes(); UI._chSet = false; UI.settings(fromTitle); } else { Sfx.ui('deny'); UI.toast('That code does not look right.', 'bad'); } },
      });
    },
    reset() {
      UI.overlay(`<div class="sheet"><div class="sh-head"><h3>Erase everything?</h3><button class="x" data-a="close">${ICON.cross}</button></div><div class="sh-body"><p>This deletes every rifle, part, skin, star and choice on this device. It cannot be undone.</p><div class="nb-btns"><button class="btn ghost" data-a="close">Keep my progress</button><button class="btn danger" data-a="yes">Erase it all</button></div></div></div>`, {
        close() { UI.closeOverlay(); },
        yes() { Save.reset(); UI.closeOverlay(); UI._chSet = false; UI.chapter = 1; UI.tab = 'contracts'; Sfx.setVolumes(); UI.title(); UI.toast('Progress erased.'); },
      });
    },
  };
  if (fromTitle) UI.render(`<div class="scr"><div class="bar"><button class="ib" data-a="back" data-snd="back">${ICON.back}</button><div><h2>Settings</h2></div></div>${body}</div>`, h, 'is-settings');
  else UI.render(UI.shell(body), UI.shellHandlers(h));
  UI.root.querySelectorAll('input[type=range]').forEach((inp) => {
    inp.addEventListener('input', () => { s[inp.dataset.k] = +inp.value; Sfx.setVolumes(); });
    inp.addEventListener('change', () => { Save.write(); if (inp.dataset.k === 'sfx') Sfx.ui('tap'); });
  });
};
