import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function main() {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  const url = 'https://www.pricecharting.com/game/one-piece-japanese-romance-dawn/shanks-alternate-art-manga-op01-120';
  console.log('Testing CF bypass on URL:', url);
  
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  
  try {
    await page.waitForSelector('table.hoverable-striped', { timeout: 15000 });
    console.log('SUCCESS! Found the table with real Chrome!');
  } catch (e) {
    console.log('FAILED! Still blocked by Cloudflare.');
    const title = await page.title();
    console.log('Title:', title);
  }
  
  await browser.close();
  process.exit(0);
}

main();
