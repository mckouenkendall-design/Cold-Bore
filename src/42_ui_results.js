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

// The verdict, the stars and the two buttons sit on the left and never scroll; the details of the
// run and what it earned scroll on the right.
UI.results = function (M, res, last) {
  if (M.practice) { UI.tab = 'range'; UI.hub(); return; }
  const d = Save.data, recBefore = Object.assign({ stars: 0, ch: false }, d.missions[M.id] || {});
  const guided = !!last.opts.guided;
  const pay = Progress.apply(M, res, { gun: last.opts.gun, guided });
  UI.shots = {}; UI.shotKeys = []; // a choice may have changed what later scenes look like
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
  // a guided run says plainly what it did not earn, and what is still there to be earned
  const waiting = pay.held.length ? (pay.held.length === 2 ? 'The three-star cache and the challenge cache are' : pay.held[0] === 'stars' ? 'The three-star cache is' : 'The challenge cache is') + ' still waiting for a run without the guide.' : 'Stars, credits and xp count as normal.';
  const guideNote = guided && win ? `<div class="gnote"><b>Guided run: no ${pay.caches.length ? 'star or challenge caches' : 'caches'} this time.</b><span>${waiting}</span></div>` : '';
  const extras = guideNote + (pay.rankUp ? `<div class="banner up">Rank ${pay.rankUp.n}: ${esc(pay.rankUp.name)}</div>` : '')
    + pay.unlocked.map((u) => `<div class="banner got">Unlocked: ${esc(u.text)}</div>`).join('')
    + (pay.caches.length ? `<button class="cachebox has" data-a="caches" data-snd="riser"><div class="cb-ic">${ICON.box}</div><div class="cb-t"><b>${pay.caches.length} ${pay.caches.length === 1 ? 'cache' : 'caches'} earned</b><i>Tap to open ${pay.caches.length === 1 ? 'it' : 'them'} now</i></div></button>` : '');
  const clean = res.clean, cleanWhy = !clean ? (res.alarmBy ? ALARM_WHY[res.alarmBy] || 'the alarm was raised' : 'a bystander panicked') : '';
  UI.render(`<div class="scr results ${win ? 'win' : 'lose'}">
    <div class="split">
      <div class="side">
        <div class="rs-head"><div class="eyebrow">${esc(M.title)}${guided ? '  ·  guided run' : ''}</div><h1>${win ? 'Contract complete' : 'Contract failed'}</h1>
          ${win ? '<div class="bigstars">' + starsHtml(res.stars, 'big anim') + '</div>' : '<p class="why">' + esc(res.fail ? res.fail.text : '') + '</p>'}</div>
        <div class="statrow"><div><b>${fmtTime(res.time)}</b><i>time</i></div><div><b>${res.shots}</b><i>shots</i></div><div><b>${res.stats.longest ? Math.round(res.stats.longest) + ' m' : 'n/a'}</b><i>longest hit</i></div><div><b>${res.stats.heads}</b><i>headshots</i></div></div>
        ${pay.cr || pay.xp ? `<div class="rs-earn"><span>Earned</span><b>+${fmtCr(pay.cr)} cr</b><i>+${pay.xp} xp</i></div>` : ''}
        <div class="cta two">
          <button class="btn ghost" data-a="again">${guided && win ? 'Try it yourself' : win ? 'Play again' : 'Try again'}</button>
          ${win ? `<button class="btn pri" data-a="next" data-snd="go">${pay.storyEnd ? 'The ending' : next ? (pay.chapterDone ? 'Continue' : 'Next contract') : 'Contracts'}</button>` : '<button class="btn pri" data-a="hub">Contracts</button>'}
        </div>
      </div>
      <div class="main scroll">
        ${extras}
        ${win ? `<div class="chks">
          ${check(true, 'Completed')}
          ${check(clean, 'Clean', clean ? 'Nobody saw or heard a thing' : 'Not clean: ' + cleanWhy)}
          ${check(res.precise, 'Precise', res.shots + (res.shots === 1 ? ' shot' : ' shots') + ' fired, ' + res.par + ' allowed')}
          <div class="chk ch ${res.challenge || recBefore.ch ? 'ok' : 'no'}"><i>${ICON.medal}</i><div><b>Challenge${res.challenge && !recBefore.ch ? ' complete' : recBefore.ch ? ' (already done)' : ''}</b><span>${esc(M.challenge.text)}</span></div></div>
          ${pay.duckNew ? '<div class="chk ch ok"><i>' + ICON.duck + '</i><div><b>Rubber duck found</b><span>' + Object.keys(d.ducks).length + ' of ' + MISSIONS.length + '</span></div></div>' : ''}
        </div>` : `<div class="tip"><div class="eyebrow">Next time</div><p>${esc(FAIL_TIP[res.fail && res.fail.code] || 'Watch the scene for a full cycle before you commit. Most people repeat themselves.')}</p></div>${pay.duckNew ? '<div class="chks"><div class="chk ch ok"><i>' + ICON.duck + '</i><div><b>Rubber duck found</b><span>That still counts.</span></div></div></div>' : ''}`}
        ${story}
        ${rewards}
      </div>
    </div></div>`, {
    // after a guided win, "Try it yourself" plays the same contract without the guide
    again() { UI.launch(last.missionId, guided && win ? Object.assign({}, last.opts, { guided: false }) : last.opts); },
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
  const help = [['full', 'Full help', 'An amber marker in the scope shows where the bullet will land. Put the marker on the target.'], ['notes', 'Spotter\'s notes', 'You are told the range, the wind and how far to hold. You do the aiming. Recommended.'], ['veteran', 'Veteran', 'No range, no wind number, no hold. Read flags, smoke and the scope marks yourself. Pays 25% more.']];
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
  if (fromTitle) UI.render(`<div class="scr settings"><div class="bar"><button class="ib" data-a="back" data-snd="back">${ICON.back}</button><div class="bar-t"><div class="eyebrow">Make it yours</div><h2>Settings</h2></div></div>${body}</div>`, h, 'is-settings');
  else UI.render(UI.shell('<div class="hd"><div class="eyebrow">Make it yours</div><h2>Settings</h2></div>', body), UI.shellHandlers(h), 'is-settings');
  UI.root.querySelectorAll('input[type=range]').forEach((inp) => {
    inp.addEventListener('input', () => { s[inp.dataset.k] = +inp.value; Sfx.setVolumes(); });
    inp.addEventListener('change', () => { Save.write(); if (inp.dataset.k === 'sfx') Sfx.ui('tap'); });
  });
};
