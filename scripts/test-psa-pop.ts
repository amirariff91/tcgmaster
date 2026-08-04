import { getSharedBrowser } from '../lib/price-engine/browser';
import fs from 'fs';
import path from 'path';

async function run() {
  const browser = await getSharedBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
  
  const cookiePath = path.join(__dirname, '..', 'psa-cookies.json');
  if (fs.existsSync(cookiePath)) {
    console.log('Loading saved cookies...');
    const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
    await page.setCookie(...cookies);
  }
  
  console.log('Navigating to PSA Pop Search for Charizard Base Set...');
  await page.goto('https://www.psacard.com/pop/search?q=charizard%20base%20set', { waitUntil: 'domcontentloaded' });
  
  await new Promise(r => setTimeout(r, 5000));
  
  const title = await page.title();
  console.log('Title:', title);
  
  const body = await page.content();
  
  // Extract search result links
  const searchResults = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    return links.map(a => ({
      text: a.textContent?.trim(),
      href: a.getAttribute('href')
    })).filter(l => l.href && !l.href.startsWith('javascript:'));
  });
  
  console.log('Search Results (Top 100):', JSON.stringify(searchResults.slice(0, 100), null, 2));
  
  process.exit(0);
}
run();
