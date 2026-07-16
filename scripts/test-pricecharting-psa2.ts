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
  
  console.log("URL after navigation:", page.url());
  const html = await page.content();
  const $ = cheerio.load(html);
  
  if ($('table#games_table tbody tr').length > 0) {
    console.log("Found search results table.");
    $('table#games_table tbody tr').first().find('td').each((_, el) => {
       console.log("Column class:", $(el).attr('class'), "Text:", $(el).text().trim().replace(/\s+/g, ' '));
    });
  } else {
    console.log("Product page layout?");
    $('.price-box, td, th').each((_, el) => {
       const text = $(el).text().trim().replace(/\s+/g, ' ');
       if (text.includes('$')) console.log("Class:", $(el).attr('class'), "Text:", text);
    });
  }
  
  await browser.close();
}
run();
