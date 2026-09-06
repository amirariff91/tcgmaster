import { connect } from 'puppeteer-real-browser';
import * as cheerio from 'cheerio';

async function scanOp01Leaders() {
  const { browser, page } = await connect({ headless: 'auto', turnstile: true });
  try {
    const url = 'https://www.pricecharting.com/console/one-piece-japanese-romance-dawn';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));

    const html = await page.content();
    const $ = cheerio.load(html);

    const rows = $('table#games_table tbody tr');

    rows.each((_, el) => {
      const title = $(el).find('td.title a').text().trim();
      const href = $(el).find('td.title a').attr('href');
      const price = $(el).find('td.price.used_price span.js-price').text().trim();
      const codes = ['OP01-001', 'OP01-002', 'OP01-003', 'OP01-031', 'OP01-060', 'OP01-061', 'OP01-062', 'OP01-091'];
      if (codes.some(c => title.includes(c))) {
        console.log(`Leader Match: "${title}" | Raw: ${price} | https://www.pricecharting.com${href}`);
      }
    });
  } finally {
    await browser.close();
  }
}
scanOp01Leaders().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
