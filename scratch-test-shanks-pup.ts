import { getSharedBrowser } from './lib/price-engine/browser';

async function verifyUrl(url: string): Promise<boolean> {
  let page;
  try {
    const browser = await getSharedBrowser();
    page = await browser.newPage();
    const res = await page.goto(url, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    console.log("Title:", title);
    return title.toLowerCase().includes("shanks");
  } catch (e) {
    return false;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

async function main() {
  const url = 'https://www.pricecharting.com/game/one-piece-japanese-romance-dawn/shanks-alternate-art-manga-op01-120';
  console.log('Testing Shanks:', url);
  const exists = await verifyUrl(url);
  console.log('Exists?', exists);
  process.exit(0);
}
main();
