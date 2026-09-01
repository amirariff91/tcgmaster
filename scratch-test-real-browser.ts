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
    
    const title = await page.title();
    console.log('Title:', title);
    
    const html = await page.content();
    if (html.includes('hoverable-striped') || html.includes('table')) {
       console.log('SUCCESS! HTML contains tables!');
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
