import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

async function run() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('https://snkrdunk.com/en/search/result?keyword=OP01-120', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  const html = await page.content();
  const $ = cheerio.load(html);
  $('.product__item-textarea').each((_, el) => {
    const text = $(el).find('.product__item-name').text().trim();
    const priceText = $(el).find('.product__item-price').text().trim();
    console.log(text, priceText);
  });
  await browser.close();
}
run();
