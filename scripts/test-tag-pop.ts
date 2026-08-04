import { getSharedBrowser } from '../lib/price-engine/browser';

async function run() {
  const browser = await getSharedBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0');
  
  console.log('Navigating to TAG Pop Report...');
  await page.goto('https://my.taggrading.com/pop-report', { waitUntil: 'domcontentloaded' });
  
  await new Promise(r => setTimeout(r, 8000));
  
  const body = await page.content();
  console.log('Body length:', body.length);
  
  // Search for search inputs
  const hasInput = body.includes('<input');
  console.log('Has input field:', hasInput);
  
  await page.screenshot({ path: '/tmp/tag-pop-search.png' });
  
  process.exit(0);
}
run();
