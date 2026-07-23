import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('https://snkrdunk.com/en/trading-cards/265720', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  const html = await page.content();
  const $ = cheerio.load(html);
  
  console.log("=== US $ MATCHES ===");
  $('*').each((_, el) => {
    // Only text nodes
    const text = $(el).clone().children().remove().end().text().trim();
    if (text.includes('US $') || text.toLowerCase().includes('psa')) {
      console.log('Element:', el.tagName, 'Class:', $(el).attr('class'), 'Text:', text);
    }
  });
  
  await browser.close();
}
main();
