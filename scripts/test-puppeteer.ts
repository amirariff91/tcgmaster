import puppeteer from 'puppeteer';
async function run() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
  
  const response = await page.goto('https://snkrdunk.com/en/search/result?keyword=EB01-033');
  console.log("Snkrdunk Status:", response?.status());
  await page.waitForSelector('a[href*="/products/"]', { timeout: 5000 }).catch(() => console.log('Timeout waiting for products'));
  
  const html = await page.content();
  const items = await page.$$('a[href*="/products/"]');
  console.log("Found Snkrdunk product items:", items.length);

  await browser.close();
}
run();
