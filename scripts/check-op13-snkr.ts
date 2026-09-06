import { connect } from 'puppeteer-real-browser';
import * as cheerio from 'cheerio';

const URLS = [
  'https://snkrdunk.com/en/trading-cards/676002',
  'https://snkrdunk.com/en/trading-cards/676003',
  'https://snkrdunk.com/en/trading-cards/676004',
  'https://snkrdunk.com/en/trading-cards/676005',
  'https://snkrdunk.com/en/trading-cards/676006',
  'https://snkrdunk.com/en/trading-cards/676007'
];

async function checkAll() {
  const { browser, page } = await connect({ headless: 'auto', turnstile: true });
  try {
    for (const url of URLS) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 2500));
      const html = await page.content();
      const $ = cheerio.load(html);
      console.log(`${url.split('/').pop()} -> ${$('h1').text().trim()}`);
    }
  } finally {
    await browser.close();
  }
}
checkAll().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
