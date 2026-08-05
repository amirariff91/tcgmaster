import { getSharedBrowser } from './lib/price-engine/browser';
import * as cheerio from 'cheerio';

async function run() {
  const query = 'OP01-120';
  const searchUrl = `https://www.pricecharting.com/search-products?q=${encodeURIComponent(query)}&type=prices`;
  const browser = await getSharedBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  
  const html = await page.content();
  const $ = cheerio.load(html);
  
  $('.box').each((_, el) => {
    const title = $(el).find('.title').text().trim().toLowerCase();
    console.log(`[DEBUG] Found title: "${title}"`);
    const link = $(el).find('.title a').attr('href');
    console.log(`[DEBUG] Link: ${link}`);
  });
  
  await page.close();
  process.exit(0);
}
run();
