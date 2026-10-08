// Draws the home-screen icon (a crosshair on dark slate, the same picture as the SVG favicon) and
// prints it as a PNG data URI. The result is pasted into src/index.template.html as the
// apple-touch-icon, so the icon on a phone's home screen is not a screenshot of the page.
// usage: node test/icon.js            prints the data URI
//        node test/icon.js shots/icon.png   also saves the picture so you can look at it
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const uri = await page.evaluate(() => {
    const S = 180, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), k = S / 64;
    // Flat colours only: a gradient would make the file ten times bigger for no gain at this size.
    x.fillStyle = '#1c2531'; x.fillRect(0, 0, S, S); // full bleed: the phone rounds the corners itself
    x.scale(k, k);
    x.strokeStyle = '#e9e4d6'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(32, 8); x.lineTo(32, 26); x.moveTo(32, 38); x.lineTo(32, 56); x.moveTo(8, 32); x.lineTo(26, 32); x.moveTo(38, 32); x.lineTo(56, 32); x.stroke();
    x.strokeStyle = '#ffaa3c'; x.lineWidth = 4; x.beginPath(); x.arc(32, 32, 18.5, 0, Math.PI * 2); x.stroke();
    x.fillStyle = '#ff4a3d'; x.beginPath(); x.arc(32, 32, 2.6, 0, Math.PI * 2); x.fill();
    return c.toDataURL('image/png');
  });
  if (process.argv[2]) fs.writeFileSync(process.argv[2], Buffer.from(uri.split(',')[1], 'base64'));
  console.log(uri);
  await browser.close();
})();
