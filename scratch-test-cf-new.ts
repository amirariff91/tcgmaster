import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new', // new headless mode is much stealthier
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  // DON'T override user agent. Let stealth plugin handle it or use default!
  
  const url = 'https://www.pricecharting.com/game/one-piece-japanese-romance-dawn/shanks-alternate-art-manga-op01-120';
  console.log('Testing CF bypass on URL:', url);
  
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  
  try {
    await page.waitForSelector('table.hoverable-striped', { timeout: 10000 });
    console.log('SUCCESS! Found the table with headless: new');
  } catch (e) {
    console.log('FAILED! Still blocked by Cloudflare or table not found.');
    const title = await page.title();
    console.log('Title:', title);
  }
  
  await browser.close();
  process.exit(0);
}

main();
