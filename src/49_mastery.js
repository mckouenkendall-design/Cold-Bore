// ---------------------------------------------------------------------------
// Rifle mastery. Every rifle keeps its own record (Progress.gunStats: kills, headshots, longest
// kill, contracts won with it). Four ladders of three steps each turn that record into a mastery
// level from 0 to 12: kills, headshots, a long shot (a share of the rifle's own reach, so a .22
// and a .50 both have something to reach for) and contracts won. Every step pays xp; levels 4, 8
// and 12 give a skin only that rifle can wear (Engraved, Gilded, Master: see 11_gunart.js).
// The level shows as a badge in the armory, on the workbench and on the gun room's nameplates.
//
//   CB.Mastery.level(gunId)        0..12
//   CB.Mastery.ladders(gunId)      [{ k, label, have, steps: [{ need, done, text }] }]
//   CB.Mastery.check(gunId)        pays any steps reached since the last check (Progress.apply
//                                  calls it); returns { ups: [{ text, xp }], skins: [ids] }
//   CB.Mastery.badge(gunId)        a small badge (HTML) for a rifle's picture, or ''
// ---------------------------------------------------------------------------
const MASTERY_LADDERS = [
  { k: 'kills', label: 'Kills', needs: [5, 15, 40], unit: '' },
  { k: 'heads', label: 'Headshots', needs: [3, 10, 25], unit: '' },
  { k: 'long', label: 'Long kill', fr: [0.5, 0.7, 0.85], unit: ' m' },
  { k: 'wins', label: 'Contracts won', needs: [3, 10, 25], unit: '' },
];
const MASTERY_XP = [100, 200, 300];
const MASTERY_COL = ['#9aa7b6', '#dfe6ee', '#ffd36e', '#ff8a4a']; // steel, then silver, gold and a master's amber at levels 4, 8 and 12
const MASTERY_TIER = [{ lv: 4, n: 1, name: 'Engraved' }, { lv: 8, n: 2, name: 'Gilded' }, { lv: 12, n: 3, name: 'Master' }];
const Mastery = CB.Mastery = {};
Mastery.reach = function (gunId) { try { return Math.round(buildStats(gunId, defaultConfig(gunId)).eff / 10) * 10; } catch (e) { return 600; } };
Mastery.ladders = function (gunId) {
  const s = Progress.gunStats(gunId), reach = Mastery.reach(gunId);
  return MASTERY_LADDERS.map((L) => {
    const have = L.k === 'long' ? s.longest || 0 : s[L.k] || 0;
    const needs = L.fr ? L.fr.map((f) => Math.round((reach * f) / 10) * 10) : L.needs;
    return { k: L.k, label: L.label, have, unit: L.unit, steps: needs.map((need) => ({ need, done: have >= need, text: L.k === 'long' ? 'A kill at ' + need + ' m or more' : need + ' ' + L.label.toLowerCase() })) };
  });
};
Mastery.level = function (gunId) { return Mastery.ladders(gunId).reduce((n, L) => n + L.steps.filter((s) => s.done).length, 0); };
Mastery.tier = function (lv) { let t = 0; MASTERY_TIER.forEach((T) => { if (lv >= T.lv) t = T.n; }); return t; };
Mastery.check = function (gunId) {
  const d = Save.data, out = { ups: [], skins: [] }; if (!gunId || !GUN_BY_ID[gunId]) return out;
  if (!d.mastery) d.mastery = {};
  const paid = d.mastery[gunId] || {}, g = GUN_BY_ID[gunId];
  Mastery.ladders(gunId).forEach((L) => L.steps.forEach((s, i) => {
    const key = L.k + i; if (!s.done || paid[key]) return;
    paid[key] = 1; out.ups.push({ text: g.name + ': ' + s.text, xp: MASTERY_XP[i], pay: '+' + MASTERY_XP[i] + ' xp' });
  }));
  d.mastery[gunId] = paid;
  const lv = Mastery.level(gunId);
  MASTERY_TIER.forEach((T) => { const id = 'm' + T.n + gunId; if (lv >= T.lv && SKIN_BY_ID[id] && Progress.grantSkin(id)) { out.skins.push(id); out.ups.push({ text: g.name + ' mastery level ' + T.lv + ': the ' + SKIN_BY_ID[id].name + ' skin', xp: 0, pay: 'New skin' }); } });
  return out;
};
Mastery.badge = function (gunId) {
  const lv = Mastery.level(gunId); if (!lv) return '';
  return `<em class="mbadge t${Mastery.tier(lv)}" title="Mastery level ${lv}">${ICON.star}<span>${lv}</span></em>`;
};
// The mastery panel on the workbench: the level, the four ladders, the three skins.
Mastery.panel = function (gunId) {
  const lv = Mastery.level(gunId), L = Mastery.ladders(gunId), next = MASTERY_TIER.find((T) => lv < T.lv), d = Save.data;
  const skins = MASTERY_TIER.map((T) => { const s = SKIN_BY_ID['m' + T.n + gunId]; if (!s) return ''; const own = !!d.skins[s.id]; return `<span class="mskin ${own ? 'own' : ''}"><span class="ms-pic bed"><canvas data-gun="${gunId}" data-lazy ${uiCfgAttr(Object.assign({}, gunCfg(gunId), { skin: s.id }))}></canvas>${own ? '' : '<span class="lk">' + ICON.lock + '</span>'}</span><b>${esc(T.name)}</b><i>${own ? 'Yours' : 'Level ' + T.lv}</i></span>`; }).join('');
  return `<div class="mastery"><div class="ms-h"><em class="mbadge big t${Mastery.tier(lv)}">${ICON.star}<span>${lv}</span></em><div><div class="eyebrow">Rifle mastery  ·  level ${lv} of 12</div><p class="dim">${next ? 'Level ' + next.lv + ' gives the ' + esc(next.name) + ' skin, worn only by this rifle.' : 'Mastered. Every skin this rifle can earn is yours.'} Each step also pays xp.</p></div></div>
    <div class="ladders">${L.map((x) => `<div class="lad"><span class="ld-t"><b>${esc(x.label)}</b><i>${x.k === 'long' ? (x.have ? x.have + ' m' : 'none yet') : x.have}</i></span><span class="ld-steps">${x.steps.map((s) => `<i class="${s.done ? 'on' : ''}" title="${esc(s.text)}">${s.need}${x.unit}</i>`).join('')}</span></div>`).join('')}</div>
    <div class="mskins">${skins}</div></div>`;
};
