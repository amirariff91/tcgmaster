import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';

puppeteer.use(StealthPlugin());

async function run() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('https://snkrdunk.com/en/products/OP01-120_p2', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  const html = await page.content();
  const $ = cheerio.load(html);
  
  console.log("Title:", $('title').text());
  
  // Try to find anything with a $ sign
  const priceElements = $('*:contains("US $")').filter((_, el) => {
    return $(el).children().length === 0; // only text nodes
  });
  
  priceElements.each((_, el) => {
    console.log("Price candidate class:", $(el).parent().attr('class'), $(el).text());
  });

  await browser.close();
}
run();
