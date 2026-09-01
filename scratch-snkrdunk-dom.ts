import { getSharedBrowser } from './lib/price-engine/browser';
import * as cheerio from 'cheerio';
async function run() {
  const browser = await getSharedBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('https://snkrdunk.com/en/trading-cards/159664?slide=right&query_id=1d219cb2-4a65-4c8f-9827-33d622a03269', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  const html = await page.content();
  const $ = cheerio.load(html);
  
  console.log("=== SIZE LIST ===");
  $('.size-modal__item, .product-detail__size, .size-list__item, li').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text.includes('US $')) {
      console.log(text);
    }
  });

  console.log("=== RECENT TRANSACTIONS ===");
  $('.tile-grid.compact li').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.toLowerCase().includes('sold')) {
      console.log(text);
    }
  });
  
  await browser.close();
}
run();
