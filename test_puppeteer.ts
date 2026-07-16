import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';

puppeteer.use(StealthPlugin());

async function run() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  await page.goto('https://www.dbs-cardgame.com/fw/jp/cardlist/?search=true&category=428001&txt=FB01-136', { waitUntil: 'networkidle2' });
  
  const html = await page.content();
  fs.writeFileSync('cardlist_out.html', html);
  await browser.close();
}
run();
