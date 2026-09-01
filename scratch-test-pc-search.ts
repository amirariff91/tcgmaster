import { getSharedBrowser } from './lib/price-engine/browser';

async function main() {
  const browser = await getSharedBrowser();
  const page = await browser.newPage();
  
  const query = "manga op06-118 japanese";
  const url = `https://www.pricecharting.com/search-products?type=prices&q=${encodeURIComponent(query)}&go=Go`;
  
  console.log("Searching:", url);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  
  // if it's a direct match, PriceCharting redirects to the product page!
  const finalUrl = page.url();
  console.log("Final URL:", finalUrl);
  
  process.exit(0);
}
main();
