import { getSharedBrowser } from '../lib/price-engine/browser';

async function run() {
  const browser = await getSharedBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
  
  console.log('Navigating to CGC Pop Report...');
  await page.goto('https://www.cgccards.com/population-report/tcg/', { waitUntil: 'domcontentloaded' });
  
  await new Promise(r => setTimeout(r, 8000));
  
  console.log('Title:', await page.title());
  
  await page.screenshot({ path: '/tmp/cgc-pop.png' });
  console.log('Screenshot saved to /tmp/cgc-pop.png');
  
  console.log('Navigating to TAG Pop Report...');
  await page.goto('https://my.taggrading.com/pop-report', { waitUntil: 'domcontentloaded' });
  
  await new Promise(r => setTimeout(r, 8000));
  
  console.log('Title:', await page.title());
  
  await page.screenshot({ path: '/tmp/tag-pop.png' });
  console.log('Screenshot saved to /tmp/tag-pop.png');
  
  process.exit(0);
}
run();
