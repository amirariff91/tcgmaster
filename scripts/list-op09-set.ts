import { connect } from 'puppeteer-real-browser';
import * as cheerio from 'cheerio';

async function listSet() {
  const url = 'https://www.pricecharting.com/console/one-piece-japanese-emperors-in-the-new-world';
  console.log(`Loading set: ${url}`);
  
  const { browser, page } = await connect({
    headless: 'auto',
    turnstile: true,
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 4000));
    
    const html = await page.content();
    const $ = cheerio.load(html);
    
    console.log("Total rows in set page:", $('table#games_table tbody tr').length);
    $('table#games_table tbody tr').each((_, el) => {
      const title = $(el).find('td.title a').text().trim();
      const href = $(el).find('td.title a').attr('href');
      if (title.toLowerCase().includes('manga') || title.toLowerCase().includes('roger') || title.toLowerCase().includes('luffy') || title.toLowerCase().includes('shanks') || title.toLowerCase().includes('teach') || title.toLowerCase().includes('buggy')) {
        console.log(`- ${title} -> https://www.pricecharting.com${href}`);
      }
    });
  } finally {
    await browser.close();
  }
}
listSet();
