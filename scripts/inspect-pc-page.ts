import { connect } from 'puppeteer-real-browser';

async function inspectSearch() {
  const url = 'https://www.pricecharting.com/game/one-piece-japanese-the-new-emperor/shanks-alternate-art-manga-op09-004';
  
  const { browser, page } = await connect({
    headless: 'auto',
    turnstile: true,
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 4000));
    console.log("Current page URL:", page.url());
    
    // Look for links in games_table
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#games_table td.title a')).map(a => ({
        text: a.textContent?.trim(),
        href: (a as HTMLAnchorElement).href
      }));
    });
    console.log("Links found:", JSON.stringify(links, null, 2));
  } finally {
    await browser.close();
  }
}
inspectSearch();
