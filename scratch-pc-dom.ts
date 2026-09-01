import { getSharedBrowser } from './lib/price-engine/browser';
import * as cheerio from 'cheerio';

async function run() {
  const browser = await getSharedBrowser();
  const page = await browser.newPage();
  await page.goto('https://www.pricecharting.com/game/one-piece-japanese-wings-of-the-captain/roronoa-zoro-alternate-art-manga-op06-118', { waitUntil: 'networkidle2' });
  
  const html = await page.content();
  const $ = cheerio.load(html);
  
  console.log("Found tables:", $('table.hoverable-striped').length);
  $('table.hoverable-striped').each((i, el) => {
    console.log(`Table ${i}:`, $(el).attr('id'), 'Rows:', $(el).find('tbody tr').length);
  });
  
  console.log("Load more buttons:", $('.load-more').length);
  $('.load-more').each((i, el) => {
    console.log(`Load More ${i}:`, $(el).prop('outerHTML'));
  });
  
  await browser.close();
  process.exit(0);
}
run();
