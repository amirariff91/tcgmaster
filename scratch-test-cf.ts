import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function main() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
  
  const url = 'https://www.pricecharting.com/game/one-piece-japanese-romance-dawn/shanks-alternate-art-manga-op01-120';
  console.log('Testing CF bypass on URL:', url);
  
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  
  try {
    await page.waitForSelector('table.hoverable-striped', { timeout: 10000 });
    console.log('SUCCESS! Found the table with headless: false');
  } catch (e) {
    console.log('FAILED! Still blocked by Cloudflare or table not found.');
    const title = await page.title();
    console.log('Title:', title);
  }
  
  await browser.close();
  process.exit(0);
}

main();
