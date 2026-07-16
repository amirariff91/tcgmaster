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
  
  await page.goto('https://www.pricecharting.com/search-products?type=prices&q=OP01-120', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  const html = await page.content();
  const $ = cheerio.load(html);
  
  const firstRow = $('table#games_table tbody tr').first();
  console.log("Title:", firstRow.find('td.title a').text().trim());
  
  firstRow.find('td').each((_, el) => {
     console.log("Column class:", $(el).attr('class'), "Text:", $(el).text().trim());
  });
  
  await browser.close();
}
run();
