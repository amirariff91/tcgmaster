import { connect } from 'puppeteer-real-browser';

async function testOne() {
  const url = 'https://www.pricecharting.com/game/one-piece-japanese-the-new-emperor/shanks-alternate-art-manga-op09-004';
  console.log(`Testing URL: ${url}`);
  
  const { browser, page } = await connect({
    headless: 'auto',
    turnstile: true,
    disableXvfb: false,
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 6000));
    
    const pageTitle = await page.title();
    console.log(`Page title: ${pageTitle}`);

    const result = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.tab-frame, table, [class*="completed-auctions"]')).map(el => ({
        tag: el.tagName,
        className: el.className,
        id: el.id
      }));
      const trCount = document.querySelectorAll('tr').length;
      const jsPriceCount = document.querySelectorAll('.js-price').length;
      return { tabs, trCount, jsPriceCount };
    });

    console.log('Result from page:', JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
    process.exit(0);
  }
}

testOne();
