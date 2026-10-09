// Builds the single self-contained page from the files in src/.
// Run:  node build.js
//   index.html          the game, ready for GitHub Pages (open it directly too)
//   dist/cold-bore.html the same game as a page fragment for hosts that add
//                       their own <html> wrapper
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, 'src');
const files = fs.readdirSync(src).filter((f) => f.endsWith('.js')).sort();
// A build stamp shown on the title screen and in Settings, so it is easy to tell which copy is running.
const BUILD = new Date().toLocaleString('en-US', { timeZone: 'America/Detroit', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
let js = '(function(){\n"use strict";\nconst BUILD = ' + JSON.stringify(BUILD) + ';\n';
for (const f of files) js += '\n// ===== ' + f + ' =====\n' + fs.readFileSync(path.join(src, f), 'utf8') + '\n';
js += '\n})();\n';
const css = fs.readFileSync(path.join(src, 'style.css'), 'utf8');

// The app icon, so "Add to Home Screen" shows the reticle and not a letter. src/icon.svg is the
// drawing; src/icons.json holds it as PNGs (made by node test/icon.js). Everything goes in as data
// URIs so the page stays one file: the SVG as the browser tab icon, the 180 px PNG for an iPhone,
// and a web app manifest (name, colours, full screen, sideways) carrying the 192 and 512 px PNGs.
const BG = '#07090d';
const svg = fs.readFileSync(path.join(src, 'icon.svg'), 'utf8').replace(/\n/g, '');
const png = JSON.parse(fs.readFileSync(path.join(src, 'icons.json'), 'utf8'));
const manifest = {
  name: 'Cold Bore', short_name: 'Cold Bore', description: 'A stick-figure sniper game. One shot, the right moment.',
  display: 'standalone', orientation: 'landscape', background_color: BG, theme_color: BG,
  icons: [{ src: png.icon192, sizes: '192x192', type: 'image/png' }, { src: png.icon512, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }],
};
const iconTags = (mark) => [
  '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,' + encodeURIComponent(svg) + '"' + mark + '>',
  '<link rel="icon" type="image/png" sizes="192x192" href="' + png.icon192 + '"' + mark + '>',
  '<link rel="apple-touch-icon" sizes="180x180" href="' + png.touch180 + '"' + mark + '>',
  '<link rel="manifest" href="data:application/manifest+json,' + encodeURIComponent(JSON.stringify(manifest)) + '"' + mark + '>',
].join('\n');

let html = fs.readFileSync(path.join(src, 'index.template.html'), 'utf8');
html = html.replace('<!--__ICONS__-->', () => iconTags('')).replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);
fs.writeFileSync(path.join(__dirname, 'index.html'), html);

// fragment build: the host supplies doctype, head and body, and pads the page for phone notches itself.
// The icon tags and home-screen metas still go at the top, with a line of script that moves them
// into the host's <head> (browsers only look for icons there). A host page that sets its own icon,
// or shows the game inside a frame, will still show its own icon on the home screen.
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
const fragCss = css + '\n:root { --sat: 0px; --sab: 0px; }\nhtml, body { height: 100%; }\nbody { position: relative; inset: auto; }\n';
const fragHead = '<meta name="apple-mobile-web-app-capable" content="yes" data-cb-head>\n<meta name="mobile-web-app-capable" content="yes" data-cb-head>\n' +
  '<meta name="apple-mobile-web-app-title" content="Cold Bore" data-cb-head>\n<meta name="theme-color" content="' + BG + '" data-cb-head>\n' + iconTags(' data-cb-head') + '\n' +
  '<script>(function () { var h = document.head; if (h) Array.prototype.forEach.call(document.querySelectorAll("[data-cb-head]"), function (e) { if (e.parentNode !== h) h.appendChild(e); }); })();</script>\n';
const frag = '<title>Cold Bore</title>\n' + fragHead + '<style>\n' + fragCss + '</style>\n' + body.trim() + '\n<script>\n' + js + '</script>\n';
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'cold-bore.html'), frag);
console.log('built index.html', (html.length / 1024).toFixed(0) + ' KB from', files.length, 'source files');
