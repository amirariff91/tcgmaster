import * as cheerio from 'cheerio';
import { getSharedBrowser } from './lib/price-engine/browser';

async function run() {
  const searchUrl = `https://snkrdunk.com/en/search/result?keyword=OP01-120`;
  const browser = await getSharedBrowser();
  const page = await browser.newPage();
  await page.goto(searchUrl, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  const html = await page.content();
  const $ = cheerio.load(html);
  
  $('.product__item-textarea').each((_, el) => {
    const title = $(el).find('.product__item-name').text().trim();
    console.log(`FOUND TITLE: ${title}`);
  });
  
  await page.close();
  process.exit(0);
}
run();
