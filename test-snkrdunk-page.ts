import { getSharedBrowser } from './lib/price-engine/browser';

async function run() {
  const browser = await getSharedBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  console.log("Navigating to product page...");
  await page.goto('https://snkrdunk.com/en/products/OP01-120_p2', { waitUntil: 'networkidle2', timeout: 30000 });
  
  const content = await page.evaluate(() => {
    // Find recent sales
    const sales: any[] = [];
    document.querySelectorAll('.sale-list__item').forEach(el => {
       sales.push(el.textContent);
    });
    return {
      bodyText: document.body.innerText.substring(0, 1000),
      sales
    };
  });
  
  console.log("Extracted:", content);
  
  await page.close();
  process.exit(0);
}
run();
