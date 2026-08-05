import { getSharedBrowser } from './lib/price-engine/browser';

async function run() {
  const browser = await getSharedBrowser();
  const page = await browser.newPage();
  await page.goto('https://snkrdunk.com/en/search/result?keyword=OP01-120', { waitUntil: 'networkidle2' });
  const html = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('li'));
    const tcgTab = tabs.find(t => t.textContent?.includes('Streetwear & TCG'));
    return tcgTab ? tcgTab.innerHTML : null;
  });
  console.log(html);
  await page.close();
  process.exit(0);
}
run();
