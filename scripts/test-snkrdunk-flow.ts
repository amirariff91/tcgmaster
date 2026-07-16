import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';

puppeteer.use(StealthPlugin());

async function run() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('https://snkrdunk.com/en/search/result?keyword=OP01-120', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  const html = await page.content();
  const $ = cheerio.load(html);
  
  const firstLink = $('.product__item-textarea').first().closest('a').attr('href');
  if (firstLink) {
    const productUrl = 'https://snkrdunk.com' + firstLink;
    console.log("Navigating to product URL:", productUrl);
    
    await page.goto(productUrl, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    
    const prodHtml = await page.content();
    const $prod = cheerio.load(prodHtml);
    
    console.log("Title:", $prod('title').text());
    
    const candidates = $prod('*:contains("US $")').filter((_, el) => $prod(el).children().length === 0);
    candidates.each((_, el) => {
      console.log("Class:", $prod(el).parent().attr('class'), "Text:", $prod(el).text());
    });
  }
  
  await browser.close();
}
run();
