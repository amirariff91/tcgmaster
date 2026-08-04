const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/one-piece/op-op-05/op-op05-119_p2-ja');
  // Wait for network idle and specific elements
  await page.waitForLoadState('networkidle');
  // Click GRADED tab if it exists
  try {
    await page.click('button:has-text("GRADED")');
    await page.waitForTimeout(1000);
  } catch (e) {
    console.log("Could not find GRADED tab");
  }
  await page.screenshot({ path: '/Users/ioi/.gemini/antigravity-ide/brain/01a7487c-ad14-4ecb-b2bc-1436baa740e6/luffy_graded_tab.png', fullPage: true });
  await browser.close();
})();
