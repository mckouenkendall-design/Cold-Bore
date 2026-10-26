// ---------------------------------------------------------------------------
// The dossier: who you are and what you chose. At the top, your calling card with your insignia
// and rank, and the looks you have earned (calling cards and reticle tints) to choose from. Then
// the five decisions as branches: the way each one stands now is lit, every other way you have
// seen it go is shown, and the ways you have not seen are a question mark. Each has a link to
// play that contract again. Then the four endings, found or not.
// ---------------------------------------------------------------------------
UI.dossier = function () {
  const d = Save.data, x = Progress.rankXp(), r = rankOf(x), outs = d.outcomes || {}, ends = d.endings || {};
  const card = (d.cos && d.cos.card) || 'plain', nEnd = ENDINGS.filter((e) => ends[e.title]).length;
  const row = (k) => {
    const M = MISSION_BY_ID[k.m], rec = d.missions[k.m] || {}, seen = outs[k.m] || {}, played = !!rec.done, cur = played ? !!d.flags[k.flag] : null;
    const waysFor = (yes) => (M.outcomes || []).filter((o) => o.set && !!o.set[k.flag] === yes).map((o) => o.id);
    const branch = (yes) => {
      const ids = waysFor(yes), got = ids.filter((id) => seen[id]), lit = cur === yes;
      const label = got.length || lit ? (yes ? k.yes : k.no) : '?';
      return `<div class="br ${yes ? 'yes' : 'no'} ${lit ? 'lit' : ''} ${got.length ? 'seen' : 'unseen'}"><b>${esc(label)}</b>
        <span>${ids.map((id) => seen[id] ? '<i class="w got">' + esc(k.ways[id] || id) + '</i>' : '<i class="w">?</i>').join('')}</span></div>`;
    };
    return `<div class="dec ${played ? '' : 'unplayed'}">
      <div class="dq"><canvas data-portrait="${k.who}" data-lazy></canvas><div><div class="eyebrow">Chapter ${ROMAN[M.ch]}  ·  ${esc(M.title)}</div><p>${played ? esc(k.q) : 'A decision you have not reached yet.'}</p></div></div>
      <div class="brs">${branch(true)}${branch(false)}</div>
      ${played ? `<button class="btn ghost sm replay" data-a="replay" data-id="${k.m}">Play it again</button>` : `<span class="nreach">${ICON.lock}</span>`}
    </div>`;
  };
  const ending = (e) => `<div class="end ${ends[e.title] ? 'got' : ''}"><b>${ends[e.title] ? esc(e.title) : '?'}</b><span>${ends[e.title] ? 'Found' : 'Not found yet'}  ·  ${esc(e.how)}</span></div>`;
  const body = `<div class="scroll dossier-pg">
    <div class="who">
      <span class="who-card"><canvas data-card="${card}" data-live="1"></canvas><span class="who-in"><canvas data-insignia="${r.n}" data-pres="${d.prestige || 0}"></canvas><span><i>Kestrel</i><b>Rank ${r.n}  ·  ${esc(r.name)}</b><em>${d.stats.wins} contracts  ·  longest ${d.stats.longest || 0} m  ·  ${d.stats.heads} headshots</em></span></span></span>
      <button class="btn ghost looks" data-a="looks">Calling card and reticle</button>
    </div>
    <div class="eyebrow dsec">Five decisions  ·  your choices change what comes later</div>
    <div class="decs">${DECISIONS.map(row).join('')}</div>
    <div class="eyebrow dsec">Endings  ·  ${nEnd} of ${ENDINGS.length} found</div>
    <div class="ends">${ENDINGS.map(ending).join('')}</div>
    <p class="fine">The ending is decided by how many of the five you spared. Every way a decision has gone is kept here; playing a contract again changes the choice that counts.${d.seen.ending ? '' : ' Finish the story to see your first ending.'}</p>
  </div>`;
  UI.render(UI.shell('<div class="hd"><div class="eyebrow">Your file</div><h2>Dossier</h2></div>', body), UI.shellHandlers({
    replay(ds) { UI.tab = 'contracts'; UI.chapter = MISSION_BY_ID[ds.id].ch; UI.brief(MISSION_BY_ID[ds.id]); },
    looks() { UI.looks(); },
  }), 'is-dossier');
};

// The reticle tint in the scope: View.drawReticle (06_view.js) asks CB.reticleInk() for its ink.

// Choose a calling card and a reticle tint. Locked ones say how to earn them.
UI.looks = function () {
  const d = Save.data, own = (k, id) => !!d.tester || !!(d.cos[k] || {})[id];
  const cards = COS_CARDS.map((c) => `<button class="lk-card ${d.cos.card === c.id ? 'on' : ''} ${own('cards', c.id) ? '' : 'locked'}" data-a="card" data-id="${c.id}"><canvas data-card="${c.id}" data-lazy></canvas><b>${esc(c.name)}</b><i>${own('cards', c.id) ? (d.cos.card === c.id ? 'In use' : 'Yours') : esc(c.how)}</i></button>`).join('');
  const tints = COS_TINTS.map((c) => `<button class="lk-tint ${d.cos.tint === c.id ? 'on' : ''} ${own('tints', c.id) ? '' : 'locked'}" data-a="tint" data-id="${c.id}"><canvas data-tint="${c.id}" data-lazy></canvas><b>${esc(c.name)}</b><i>${own('tints', c.id) ? (d.cos.tint === c.id ? 'In use' : 'Yours') : esc(c.how)}</i></button>`).join('');
  const nC = COS_CARDS.filter((c) => own('cards', c.id)).length, nT = COS_TINTS.filter((c) => own('tints', c.id)).length;
  UI.overlay(`<div class="sheet tall looksheet"><div class="sh-head"><div class="sh-t"><div class="eyebrow">For looks only</div><h3>Calling card and reticle</h3></div><button class="x" data-a="close">${ICON.cross}</button></div>
    <div class="sh-body"><div class="eyebrow">Calling cards  ·  ${nC} of ${COS_CARDS.length}</div><div class="lkgrid">${cards}</div>
    <div class="eyebrow">Reticle tints  ·  ${nT} of ${COS_TINTS.length}</div><p class="dim">The colour of the marks in your scope glass.</p><div class="lkgrid tints">${tints}</div></div></div>`, {
    close() { UI.closeOverlay(); if (UI.tab === 'dossier') UI.dossier(); },
    card(ds) { if (!own('cards', ds.id)) { Sfx.ui('deny'); UI.toast(COS_CARD_BY_ID[ds.id].how + '.'); return; } d.cos.card = ds.id; Save.write(); Sfx.ui('equip'); const b = UI.over.querySelector('.sh-body'), s = b.scrollTop; UI.looks(); UI.over.querySelector('.sh-body').scrollTop = s; },
    tint(ds) { if (!own('tints', ds.id)) { Sfx.ui('deny'); UI.toast(COS_TINT_BY_ID[ds.id].how + '.'); return; } d.cos.tint = ds.id; Save.write(); Sfx.ui('equip'); const b = UI.over.querySelector('.sh-body'), s = b.scrollTop; UI.looks(); UI.over.querySelector('.sh-body').scrollTop = s; },
  });
};
