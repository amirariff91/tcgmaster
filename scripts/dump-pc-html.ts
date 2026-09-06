import { connect } from 'puppeteer-real-browser';
import * as fs from 'fs';

async function dumpHtml() {
  const url = 'https://www.pricecharting.com/game/one-piece-japanese-the-new-emperor/shanks-alternate-art-manga-op09-004';
  
  const { browser, page } = await connect({
    headless: 'auto',
    turnstile: true,
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 5000));
    console.log("Navigated to:", page.url());
    
    const html = await page.content();
    fs.writeFileSync('/tmp/pc_shanks.html', html);
    console.log("Dumped HTML, size:", html.length);
  } finally {
    await browser.close();
  }
}
dumpHtml();
