import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';

puppeteer.use(StealthPlugin());

async function run() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('https://snkrdunk.com/en/search/result?keyword=OP01-120', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3000));
  const html = await page.content();
  const $ = cheerio.load(html);
  
  console.log("Items found:", $('.product__item-textarea').length);
  $('.product__item-textarea').each((_, el) => {
    console.log("Name:", $(el).find('.product__item-name').text().trim());
    console.log("Price:", $(el).find('.product__item-price').text().trim());
  });
  
  await browser.close();
}
run();
