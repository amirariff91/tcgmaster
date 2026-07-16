import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';

puppeteer.use(StealthPlugin());

async function run() {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  await page.goto('https://snkrdunk.com/en/trading-cards/93520', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  const html = await page.content();
  const $ = cheerio.load(html);
  
  console.log("Looking for sizes...");
  $('.size-modal__item, .product-detail__size, .size-list__item, li').each((_, el) => {
     const text = $(el).text().trim().replace(/\s+/g, ' ');
     if (text.includes('PSA') || text.includes('BGS') || text.includes('US $')) {
        console.log(`Candidate: ${text}`);
     }
  });
  
  await browser.close();
}
run();
