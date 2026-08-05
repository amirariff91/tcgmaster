import { getSharedBrowser } from './lib/price-engine/browser';
import * as cheerio from 'cheerio';

async function run() {
  const query = 'OP01-120';
  const searchUrl = `https://snkrdunk.com/en/search/result?keyword=${encodeURIComponent(query)}&category_id=7`;
  const browser = await getSharedBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  
  const html = await page.content();
  const $ = cheerio.load(html);
  
  let selectedUrl: string | null = null;
  $('.product__item-textarea, .tile').each((_, el) => {
    const title = $(el).find('.product__item-name, .tile__name').text().trim().toLowerCase();
    console.log(`[DEBUG] Found title: "${title}"`);
    if (title.includes('[en]') || title.includes('[cn]') || title.includes('[kr]')) {
      console.log(`[DEBUG] Skipping non-JP`);
      return;
    }
    
    const isManga = title.includes('manga') || title.includes('comic') || title.includes('treasure') || title.includes('special');
    console.log(`[DEBUG] isManga: ${isManga}`);
    
    if (isManga) {
      const link = $(el).closest('a').attr('href');
      console.log(`[DEBUG] Selected Link: ${link}`);
      if (link) selectedUrl = 'https://snkrdunk.com' + link;
    }
  });
  
  console.log('Final URL:', selectedUrl);
  await page.close();
  process.exit(0);
}
run();
