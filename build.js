// Builds the single self-contained page from the files in src/.
// Run:  node build.js
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
console.log('built index.html', (html.length / 1024).toFixed(0) + ' KB from', files.length, 'source files');
