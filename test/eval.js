// usage: node test/eval.js "<js expression evaluated in the page>"
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message, (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html') + '?test');
  await page.waitForTimeout(300);
  const r = await page.evaluate(process.argv[2]);
  console.log(typeof r === 'string' ? r : JSON.stringify(r, null, 1));
  await browser.close();
})();
