// ---------------------------------------------------------------------------
// COLD BORE - shared helpers
// ---------------------------------------------------------------------------
const CB = {};
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const sign = (v) => (v < 0 ? -1 : 1);
const approach = (v, target, rate) => (v < target ? Math.min(target, v + rate) : Math.max(target, v - rate));

// Small fast seeded random number generator so every mission plays the same
// way every time (important for fair retries and for automated testing).
function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  const f = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    f,
    r: (lo, hi) => lo + (hi - lo) * f(),
    i: (lo, hi) => Math.floor(lo + (hi - lo + 1) * f()),
    pick: (arr) => arr[Math.floor(f() * arr.length)],
    chance: (p) => f() < p,
    gauss: () => { // roughly normal, mean 0 sd 1
      let s = 0; for (let i = 0; i < 6; i++) s += f();
      return (s - 3) / 0.7071;
    },
  };
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Smooth 1D noise in -1..1, used for scope tremor and wind gusts.
function vnoise(t, seed) {
  const i = Math.floor(t), f = t - i;
  const h = (n) => {
    let x = Math.imul((n + seed * 7919) | 0, 374761393);
    x = (x ^ (x >>> 13)) | 0; x = Math.imul(x, 1274126177);
    return (((x ^ (x >>> 16)) >>> 0) / 2147483648) - 1;
  };
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u);
}

// ---- colour helpers --------------------------------------------------------
const _rgbCache = new Map();
function rgbOf(hex) {
  let c = _rgbCache.get(hex);
  if (c) return c;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  _rgbCache.set(hex, c);
  return c;
}
const _mixCache = new Map();
function mix(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const q = Math.round(t * 32);
  const key = a + b + q;
  let v = _mixCache.get(key);
  if (v) return v;
  const A = rgbOf(a), B = rgbOf(b), k = q / 32;
  const to = (x) => { const s = Math.round(x).toString(16); return s.length < 2 ? '0' + s : s; };
  v = '#' + to(lerp(A[0], B[0], k)) + to(lerp(A[1], B[1], k)) + to(lerp(A[2], B[2], k));
  if (_mixCache.size > 6000) _mixCache.clear();
  _mixCache.set(key, v);
  return v;
}
function rgba(hex, a) {
  const c = rgbOf(hex);
  return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
}
const lighten = (hex, t) => mix(hex, '#ffffff', t);
const darken = (hex, t) => mix(hex, '#000000', t);

function fmt(n, d) { return Number(n).toFixed(d === undefined ? 1 : d); }
function fmtTime(s) {
  s = Math.max(0, s);
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return m + ':' + (r < 10 ? '0' : '') + r;
}
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

CB.util = { clamp, lerp, smooth, makeRng, hashStr, vnoise, mix, rgba };
