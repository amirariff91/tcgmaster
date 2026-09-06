import { connect } from 'puppeteer-real-browser';
import * as cheerio from 'cheerio';

async function checkSnkr() {
  const { browser, page } = await connect({ headless: 'auto', turnstile: true });
  try {
    const url = 'https://snkrdunk.com/en/trading-cards/676002';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));

    const html = await page.content();
    const $ = cheerio.load(html);
    console.log('Title:', $('h1').text().trim());
  } finally {
    await browser.close();
  }
}
checkSnkr().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
