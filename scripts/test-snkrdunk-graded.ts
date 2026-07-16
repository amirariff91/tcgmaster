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
  
  await page.goto('https://snkrdunk.com/en/search/result?keyword=OP01-120%20PSA10', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  const html = await page.content();
  const $ = cheerio.load(html);
  
  $('.product__item-textarea').each((_, el) => {
      const text = $(el).find('.product__item-name').text().trim();
      const price = $(el).find('.product__item-price').text().trim();
      console.log(`[Snkrdunk] ${text} -> ${price}`);
  });
  
  await browser.close();
}
run();
