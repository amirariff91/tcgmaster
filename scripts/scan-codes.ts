import { connect } from 'puppeteer-real-browser';
import * as cheerio from 'cheerio';

const QUERIES = [
  'EB01-006',
  'OP05-074',
  'OP04-083',
  'OP05-069',
  'OP11-118'
];

async function scanCodes() {
  const { browser, page } = await connect({ headless: 'auto', turnstile: true });

  try {
    for (const q of QUERIES) {
      console.log(`\n========================================`);
      console.log(`Searching for exact code: "${q}"...`);
      const url = `https://www.pricecharting.com/search-products?type=prices&q=${encodeURIComponent(q)}`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 3000));

      const html = await page.content();
      const $ = cheerio.load(html);

      $('table#games_table tbody tr').each((_, el) => {
        const title = $(el).find('td.title a').text().trim().replace(/\s+/g, ' ');
        const set = $(el).find('td.console a').text().trim().replace(/\s+/g, ' ');
        const href = $(el).find('td.title a').attr('href');
        if (set.toLowerCase().includes('japanese') || title.toLowerCase().includes('manga')) {
          console.log(`  - [${set}] ${title} -> https://www.pricecharting.com${href}`);
        }
      });
    }
  } finally {
    await browser.close();
  }
}
scanCodes();
