// placeholder UI, replaced later
const UI = CB.UI = {
  tick() {}, notebook() {}, closeOverlay() {},
  results(M, res) { const d = document.getElementById('ui'); d.innerHTML = '<div style="padding:40px;color:#fff;font:16px sans-serif">' + (res.win ? 'WON' : 'LOST: ' + res.fail.text) + ' stars ' + res.stars + '</div>'; },
};
