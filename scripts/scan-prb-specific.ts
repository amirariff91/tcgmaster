import { connect } from 'puppeteer-real-browser';
import * as cheerio from 'cheerio';

const PRB_CARDS = [
  'Sogeking PRB01',
  'Sabo PRB01',
  'Eustass Kid PRB01',
  'Trafalgar Law PRB01',
  'Chopper PRB01',
  'Trafalgar Law OP10',
  'Luffy OP11'
];

async function scanPRB() {
  const { browser, page } = await connect({ headless: 'auto', turnstile: true });

  try {
    for (const q of PRB_CARDS) {
      console.log(`\nSearching for: "${q}"...`);
      const url = `https://www.pricecharting.com/search-products?type=prices&q=${encodeURIComponent(q)}`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 3000));

      const html = await page.content();
      const $ = cheerio.load(html);

      $('table#games_table tbody tr').each((_, el) => {
        const title = $(el).find('td.title a').text().trim().replace(/\s+/g, ' ');
        const set = $(el).find('td.console a').text().trim().replace(/\s+/g, ' ');
        const href = $(el).find('td.title a').attr('href');
        console.log(`  - [${set}] ${title} -> https://www.pricecharting.com${href}`);
      });
    }
  } finally {
    await browser.close();
  }
}
scanPRB();
