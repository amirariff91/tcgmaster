import { connect } from 'puppeteer-real-browser';

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
    
    try {
      await page.waitForSelector('table.hoverable-striped', { timeout: 15000 });
      console.log('SUCCESS! Bypassed Cloudflare with puppeteer-real-browser!');
    } catch (e) {
      console.log('FAILED! Still blocked by Cloudflare or table not found.');
      const title = await page.title();
      console.log('Title:', title);
    }
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
