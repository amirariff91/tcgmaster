import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';

puppeteer.use(StealthPlugin());

async function run() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('https://www.ebay.com/sch/i.html?_nkw=one+piece+card+EB01-033+luffy', { waitUntil: 'networkidle2' });
  
  const html = await page.content();
  const $ = cheerio.load(html);
  
  const titles = $('.s-item__title').map((i, el) => $(el).text()).get();
  console.log('Found titles:', titles.length);
  if (titles.length > 0) console.log(titles.slice(0, 3));
  
  await browser.close();
}
run();
