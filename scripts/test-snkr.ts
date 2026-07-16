import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';

puppeteer.use(StealthPlugin());

async function run() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('https://snkrdunk.com/en/search/result?keyword=EB01-033', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  const html = await page.content();
  const $ = cheerio.load(html);
  
  // Find all elements that contain "US $"
  const items = $('*').filter((i, el) => {
    const t = $(el).text();
    return t.includes('US $') && t.includes('EB01-033');
  });
  
  // print the HTML of the first reasonable wrapper
  const wrapper = items.last().parent();
  console.log(wrapper.html());
  
  await browser.close();
}
run();
