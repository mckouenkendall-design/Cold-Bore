// ---------------------------------------------------------------------------
// The medal case (Collection, Medals): every medal in its group, struck in the metal of the tier
// you have reached or dark until you have one, how far you are along to the next tier and what
// it pays. At the top, the three you are closest to.
// ---------------------------------------------------------------------------
UI.medalsBody = function () {
  const L = CB.Medals.list(), have = CB.Medals.have(), all = CB.Medals.count();
  const fmtN = (x, v) => fmtCr(Math.floor(v)) + (x.M.unit || '');
  const pips = (x) => x.M.need.length === 1 ? '' : `<span class="mpips">${[1, 2, 3].map((t) => `<i class="p${t} ${x.tier >= t ? 'on' : ''}"></i>`).join('')}</span>`;
  const card = (x) => {
    const m = x.M, once = m.need.length === 1, done = !x.need, tierName = once ? (x.tier ? 'Earned' : 'Not yet') : MEDAL_TIER_NAME[x.tier];
    const what = done ? m.text(m.need[m.need.length - 1]) : m.text(x.need);
    const prog = done || once ? '' : `<span class="mbar"><i style="width:${Math.round(x.frac * 100)}%"></i></span><span class="mnum">${fmtN(x, Math.min(x.have, x.need))} of ${fmtN(x, x.need)}</span>`;
    return `<div class="mcard t${x.tier} ${once ? 'once' : ''} ${done ? 'done' : ''}"><canvas data-medal="${m.id}" data-tier="${x.tier}" data-lazy></canvas>
      <div class="mc-t"><div class="mc-h"><b>${esc(m.name)}</b>${pips(x)}<em>${tierName}</em></div><p>${esc(what)}</p>${prog}${done ? '' : `<span class="mpay">${once || x.tier === 0 ? 'Pays' : 'Next pays'} ${esc(x.pay.payText)}</span>`}</div></div>`;
  };
  const close = L.filter((x) => x.need && x.M.need.length > 1 && x.frac > 0).sort((a, b) => b.frac - a.frac).slice(0, 3);
  const groups = CB.Medals.GROUPS.map((g) => {
    const mine = L.filter((x) => x.M.g === g.k), n = mine.reduce((a, x) => a + x.tier, 0), of = mine.reduce((a, x) => a + x.M.need.length, 0);
    return `<div class="mgroup"><div class="rhead"><b>${esc(g.name)}</b><i>${n} of ${of}</i></div><div class="mgrid">${mine.map(card).join('')}</div></div>`;
  }).join('');
  return `<div class="scroll medals">
    <div class="mtop"><div class="mt-n"><b>${have}</b><small>/ ${all}</small><span>medals</span></div><span class="mt-bar"><i style="width:${Math.round((have / all) * 100)}%"></i></span>
      <p class="dim">Thirty come in bronze, silver and gold; nine are earned once. Every one pays credits and xp, gold pays a sealed cache too.</p></div>
    ${close.length ? `<div class="eyebrow">Closest to the next one</div><div class="mgrid close">${close.map(card).join('')}</div>` : ''}
    ${groups}</div>`;
};
// Pay any medal reached outside a contract (caches opened, or an older save's record) and show it.
UI.medalSweep = function () {
  if (!CB.Medals) return [];
  const got = CB.Medals.sweep();
  got.slice(0, 4).forEach((m, i) => setTimeout(() => CB.Medals.toast(m), 300 + i * 900));
  if (got.length > 4) setTimeout(() => UI.toast((got.length - 4) + ' more medals: see Collection, Medals', 'good'), 300 + 4 * 900);
  return got;
};
