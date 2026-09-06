import { connect } from 'puppeteer-real-browser';
import * as cheerio from 'cheerio';

const SETS_TO_SCAN = [
  { prefix: 'op10', url: 'https://www.pricecharting.com/console/one-piece-japanese-royal-bloodline' },
  { prefix: 'op11', url: 'https://www.pricecharting.com/console/one-piece-japanese-a-fist-of-divine-speed' },
  { prefix: 'op13', url: 'https://www.pricecharting.com/console/one-piece-japanese-carrying-on-his-will' },
  { prefix: 'op16', url: 'https://www.pricecharting.com/console/one-piece-japanese-the-time-of-battle' },
  { prefix: 'prb01', url: 'https://www.pricecharting.com/console/one-piece-japanese-premium-booster' }
];

async function scanSets() {
  const { browser, page } = await connect({ headless: 'auto', turnstile: true });

  try {
    for (const set of SETS_TO_SCAN) {
      console.log(`\n========================================`);
      console.log(`Scanning ${set.prefix}: ${set.url}`);
      await page.goto(set.url, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 4000));

      const html = await page.content();
      const $ = cheerio.load(html);

      $('table#games_table tbody tr').each((_, el) => {
        const title = $(el).find('td.title a').text().trim();
        const href = $(el).find('td.title a').attr('href');
        if (title.toLowerCase().includes('manga')) {
          console.log(`Found Manga: "${title}" -> https://www.pricecharting.com${href}`);
        }
      });
    }
  } finally {
    await browser.close();
  }
}
scanSets();
