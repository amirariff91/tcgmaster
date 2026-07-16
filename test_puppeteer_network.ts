import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function run() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('api') || url.includes('json') || response.headers()['content-type']?.includes('application/json')) {
      console.log('JSON API:', url);
    }
  });

  await page.goto('https://www.dbs-cardgame.com/fw/jp/cardlist/?search=true&category=428001&txt=FB01-136', { waitUntil: 'networkidle0' });
  
  await browser.close();
}
run();
