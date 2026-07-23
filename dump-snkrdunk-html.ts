import puppeteer from 'puppeteer';

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('https://snkrdunk.com/en/trading-cards/265720', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  const html = await page.content();
  const fs = require('fs');
  fs.writeFileSync('snkrdunk_dump.html', html);
  console.log("HTML dumped to snkrdunk_dump.html");
  
  await browser.close();
}
main();
