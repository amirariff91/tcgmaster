import { getSharedBrowser } from './lib/price-engine/browser';

async function main() {
  const browser = await getSharedBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('https://www.pricecharting.com/search-products?type=prices&q=OP08-084+japanese', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  const html = await page.content();
  const fs = require('fs');
  fs.writeFileSync('pc_dump_stealth.html', html);
  console.log("HTML dumped to pc_dump_stealth.html");
  
  // Clean up
  await page.close();
  process.exit(0);
}
main();
