import { connect } from 'puppeteer-real-browser';
import * as cheerio from 'cheerio';

async function main() {
  const url = 'https://www.pricecharting.com/game/one-piece-japanese-romance-dawn/shanks-alternate-art-manga-op01-120';
  console.log('Testing CF bypass on URL:', url);
  
  let browserInstance;
  try {
    const { browser, page } = await connect({
      headless: 'auto',
      turnstile: true,
      customConfig: {},
      disableXvfb: false,
    });
    
    browserInstance = browser;
    
    console.log('Browser launched. Loading URL...');
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    console.log('Waiting for network idle...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const html = await page.content();
    const $ = cheerio.load(html);
    
    const tables = $('table.hoverable-striped');
    console.log('Found tables:', tables.length);
    
    const title = await page.title();
    console.log('Title:', title);
    
  } catch (error: any) {
    console.error('Error:', error);
  } finally {
    if (browserInstance) {
      await browserInstance.close();
    }
    process.exit(0);
  }
}

main();
