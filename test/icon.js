// Draws the home-screen icon from src/icon.svg into the PNG sizes phones ask for and saves them
// as data URIs in src/icons.json, which build.js puts in the page (an iPhone wants a 180 x 180
// apple-touch-icon; Android and the web app manifest want 192 and 512). Run it again after
// changing src/icon.svg, then node build.js.
// It also saves shots/icon_sizes.png: the icon at 180, 60 and 40 px with the rounded corners a
// phone gives it, on a dark and a light home screen, to check that it still reads when small.
// usage: node test/icon.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
(async () => {
  const svg = fs.readFileSync(path.join(root, 'src', 'icon.svg'), 'utf8');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const out = await page.evaluate(async (svg) => {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const draw = (S) => {
      const c = document.createElement('canvas'); c.width = c.height = S;
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
      x.drawImage(img, 0, 0, S, S); // full bleed and square: the phone rounds the corners itself
      return c.toDataURL('image/png');
    };
    return { touch180: draw(180), icon192: draw(192), icon512: draw(512) };
  }, svg);
  // squeeze the files down to a 256-colour palette when sharp is installed: the page carries them
  // inside itself, so every kilobyte is loaded on every visit
  let sharp = null; try { sharp = require('sharp'); } catch (e) { console.log('sharp is not installed: the PNGs are kept as drawn'); }
  if (sharp) {
    for (const k of Object.keys(out)) {
      const buf = await sharp(Buffer.from(out[k].split(',')[1], 'base64')).png({ palette: true, quality: 95, effort: 10, compressionLevel: 9 }).toBuffer();
      out[k] = 'data:image/png;base64,' + buf.toString('base64');
    }
  }
  fs.writeFileSync(path.join(root, 'src', 'icons.json'), JSON.stringify(out, null, 1) + '\n');
  Object.keys(out).forEach((k) => console.log(k, Math.round(out[k].length / 1024) + ' KB as a data URI'));
  // the check picture
  fs.mkdirSync(path.join(root, 'shots'), { recursive: true });
  await page.setViewportSize({ width: 720, height: 300 });
  const tile = (bg, ink) => `<div style="display:flex;align-items:flex-end;gap:36px;padding:26px 30px;background:${bg}">` +
    [180, 60, 40].map((s) => `<figure style="margin:0;text-align:center;font:600 12px -apple-system,Arial,sans-serif;color:${ink}"><img src="${out.touch180}" width="${s}" height="${s}" style="display:block;border-radius:${s * 0.225}px"><figcaption style="margin-top:6px">${s} px</figcaption></figure>`).join('') + '</div>';
  await page.setContent(`<body style="margin:0;display:flex">${tile('#1e2a3a', '#dfe6ee')}${tile('#d8dde4', '#2a3340')}</body>`);
  await page.waitForTimeout(100);
  const box = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
  await page.setViewportSize({ width: box.w, height: box.h });
  await page.screenshot({ path: path.join(root, 'shots', 'icon_sizes.png') });
  console.log('saved src/icons.json and shots/icon_sizes.png');
  await browser.close();
})();
