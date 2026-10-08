const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto('file://' + require("path").join(__dirname, "..", "index.html") + '?test');
  await page.waitForTimeout(600);
  const r = await page.evaluate(process.argv[2]);
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
