// ---------------------------------------------------------------------------
// What changes every day: the daily contract (marked on the case board, the briefing and the
// title) and Pip's shelf (on the Caches page). Both turn over at midnight. See 39_progress.js.
// ---------------------------------------------------------------------------
UI.isDaily = function (M) { const dl = Progress.daily(); return !!(dl && M && dl.id === M.id && !dl.paid); };
UI.dailyTag = function (M) { return UI.isDaily(M) ? '  ·  <em class="dly">Daily: double fee</em>' : ''; };
UI.dailyPay = function (M) { const dl = Progress.daily(); return UI.isDaily(M) ? ` <b class="dly">Today it is the daily contract: win it again for ${fmtCr(dl.cr)} credits and ${dl.xp} xp more.</b>` : ''; };
// One line for the title card and the board.
UI.dailyLine = function () {
  const dl = Progress.daily(); if (!dl) return '';
  return dl.paid ? 'Daily done. A new one at midnight.' : 'Daily, double fee: ' + esc(dl.M.title);
};

// Pip's shelf, at the top of the Caches page.
UI.shelfHtml = function () {
  const d = Save.data, S = Progress.shelf(); if (!S.items.length) return '';
  const cell = (it, i) => {
    const sold = !!S.sold[i] || Progress.shelfOwned(it), can = !sold && d.credits >= it.price;
    let pic, name, kind;
    if (it.k === 'skin') { const s = SKIN_BY_ID[it.id], g = uiSkinGroup(s); pic = `<span class="sh-pic bed"><canvas data-swatch="${s.id}" data-rifle data-gun="${d.equipped}" data-lazy></canvas></span>`; name = s.name; kind = `<i class="${g.cls}">${RAR[s.r]} skin</i>`; }
    else if (it.k === 'card') { pic = `<span class="sh-pic"><canvas data-card="${it.id}" data-lazy></canvas></span>`; name = COS_CARD_BY_ID[it.id].name; kind = '<i>Calling card</i>'; }
    else { pic = `<span class="sh-pic tint"><canvas data-tint="${it.id}" data-lazy></canvas></span>`; name = COS_TINT_BY_ID[it.id].name; kind = '<i>Reticle tint</i>'; }
    const cls = it.k === 'skin' ? uiSkinGroup(SKIN_BY_ID[it.id]).cls : 'rt';
    return `<div class="shelfi ${cls} ${sold ? 'sold' : ''}">${pic}<b>${esc(name)}</b>${kind}
      ${sold ? `<span class="sh-sold">${ICON.check} Yours</span>` : `<button class="btn ${can ? 'pri' : 'ghost off'}" data-a="buyshelf" data-i="${i}" data-quiet="1">${fmtCr(it.price)} cr</button>`}</div>`;
  };
  return `<div class="shelf"><div class="sh-hd"><div><div class="eyebrow">Pip's shelf</div><p class="dim">Fixed prices, no luck involved. New stock in ${Progress.hoursLeft()} h.</p></div></div>
    <div class="shelfrow">${S.items.map(cell).join('')}</div></div>`;
};
// The handler the Caches page adds for the shelf's buttons.
UI.shelfBuy = function (ds) {
  const S = Progress.shelf(), it = S.items[+ds.i], err = Progress.buyShelf(+ds.i);
  if (err) { Sfx.ui('deny'); UI.toast(err, 'bad'); return; }
  Sfx.ui('buy');
  const name = it.k === 'skin' ? SKIN_BY_ID[it.id].name : it.k === 'card' ? 'Calling card: ' + COS_CARD_BY_ID[it.id].name : 'Reticle tint: ' + COS_TINT_BY_ID[it.id].name;
  UI.toast(name + ' is yours.' + (it.k === 'skin' ? ' Fit it from the Skins page or the workbench.' : ' Choose it in the Dossier, under Looks.'), 'good');
  (Progress.lastSets || []).forEach((s, i) => setTimeout(() => UI.toast('Set complete: ' + s.name + '. +' + fmtCr(s.cr) + ' cr and a ' + CACHE_NAME[s.cache].toLowerCase() + '.', 'good'), 900 + i * 900));
  UI.keepScroll(); UI.collection();
};
