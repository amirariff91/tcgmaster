import puppeteer from 'puppeteer';

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('https://snkrdunk.com/en/trading-cards/265745?slide=right&query_id=c683dd7b-a7d4-4647-8629-1dbe27e74f83', { waitUntil: 'networkidle2' });
  
  const labels = await page.$$('label.condition-btn');
  for (const label of labels) {
    const text = await label.evaluate(el => el.textContent?.trim());
    console.log('Found label:', text);
    if (text === 'PSA 10') {
      await label.click();
      await new Promise(r => setTimeout(r, 1000));
      const priceText = await page.$eval('.product-detail__price', el => el.textContent);
      console.log('PSA 10 Price Text:', priceText);
      break;
    }
  }
  
  await browser.close();
}
main();
