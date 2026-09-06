import { connect } from 'puppeteer-real-browser';
import * as cheerio from 'cheerio';

async function testScan() {
  const { browser, page } = await connect({ headless: 'auto', turnstile: true });
  try {
    const url = 'https://www.pricecharting.com/console/one-piece-japanese-awakening-of-the-new-era';
    console.log('Navigating to OP05 set page:', url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));

    const html = await page.content();
    const $ = cheerio.load(html);

    console.log('Page title:', $('title').text());
    const rows = $('table#games_table tbody tr');
    console.log('Total rows found in games_table:', rows.length);

    let foundSp = 0;
    rows.each((_, el) => {
      const title = $(el).find('td.title a').text().trim();
      const href = $(el).find('td.title a').attr('href');
      const price = $(el).find('td.price.used_price span.js-price').text().trim();
      const lower = title.toLowerCase();
      if (lower.includes('special') || lower.includes('[sp') || lower.includes('nami') || lower.includes('yamato') || lower.includes('uta')) {
        console.log(`Match: "${title}" | Raw: ${price} | https://www.pricecharting.com${href}`);
        foundSp++;
      }
    });
    console.log('Total potential SP / special matches in OP-05:', foundSp);
  } finally {
    await browser.close();
  }
}
testScan().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
