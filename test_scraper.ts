import * as cheerio from 'cheerio';
import { getSharedBrowser } from './lib/price-engine/browser';

async function run() {
  const browser = await getSharedBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  const searchUrl = `https://snkrdunk.com/en/search/result?keyword=OP01-070`;
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  
  const html = await page.content();
  const $ = cheerio.load(html);
  
  console.log($('a[href*="trading-cards"]').first().html());
  
  await browser.close();
  process.exit(0);
}

run();
