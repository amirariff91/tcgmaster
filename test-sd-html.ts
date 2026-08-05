import { getSharedBrowser } from './lib/price-engine/browser';

async function run() {
  const browser = await getSharedBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('https://snkrdunk.com/en/trading-cards/332167?slide=right', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  const html = await page.content();
  require('fs').writeFileSync('sd-anchor-dump.html', html);
  await page.close();
  process.exit(0);
}
run();
