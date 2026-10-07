// Builds the single self-contained page from the files in src/.
// Run:  node build.js
//   index.html          the game, ready for GitHub Pages (open it directly too)
//   dist/cold-bore.html the same game as a page fragment for hosts that add
//                       their own <html> wrapper
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, 'src');
const files = fs.readdirSync(src).filter((f) => f.endsWith('.js')).sort();
let js = '(function(){\n"use strict";\n';
for (const f of files) js += '\n// ===== ' + f + ' =====\n' + fs.readFileSync(path.join(src, f), 'utf8') + '\n';
js += '\n})();\n';
const css = fs.readFileSync(path.join(src, 'style.css'), 'utf8');
let html = fs.readFileSync(path.join(src, 'index.template.html'), 'utf8');
html = html.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);
fs.writeFileSync(path.join(__dirname, 'index.html'), html);

// fragment build: the host supplies doctype, head and body, and pads the page for phone notches itself
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
const fragCss = css + '\n:root { --sat: 0px; --sab: 0px; }\nhtml, body { height: 100%; }\nbody { position: relative; inset: auto; }\n';
const frag = '<title>Cold Bore</title>\n<style>\n' + fragCss + '</style>\n' + body.trim() + '\n<script>\n' + js + '</script>\n';
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'cold-bore.html'), frag);
console.log('built index.html', (html.length / 1024).toFixed(0) + ' KB from', files.length, 'source files');
