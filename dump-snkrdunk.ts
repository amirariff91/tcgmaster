import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('https://snkrdunk.com/en/trading-cards/265720', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  const html = await page.content();
  const $ = cheerio.load(html);
  
  console.log("=== SIZE LIST ===");
  $('.size-list__item, .size-modal__item, li, [class*="size"], [class*="price"]').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text.includes('PSA 10') || text.includes('PSA10') || text.toLowerCase().includes('psa')) {
      console.log('MATCH:', text);
    }
  });
  
  await browser.close();
}
main();
