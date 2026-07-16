import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

// Returns both raw and PSA 10 graded prices
export async function fetchPriceChartingPrice(query: string): Promise<{ price: number; gradedPrice?: number } | null> {
  let browser;
  try {
    let suffix = '';
    let baseQuery = query;
    if (query.includes('_')) {
      [baseQuery, suffix] = query.split('_');
    }

    const searchUrl = `https://www.pricecharting.com/search-products?type=prices&q=${encodeURIComponent(baseQuery)}`;
    
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 1000));
    
    const html = await page.content();
    const $ = cheerio.load(html);
    
    let selectedResult: any = null;
    const results = $('table#games_table tbody tr');
    
    results.each((_, el) => {
      if (selectedResult) return;
      const title = $(el).find('td.title a').text().trim().toLowerCase();
      
      // Attempt to match variation
      if (suffix === 'p2' || suffix === 'p3' || suffix === 'p4') {
        if (title.includes('manga') || title.includes('comic') || title.includes('sp') || title.includes('flagship') || title.includes('serial') || title.includes('treasure')) selectedResult = el;
      } else if (suffix === 'p1' || suffix.startsWith('p')) {
        if (title.includes('parallel') && !title.includes('manga') && !title.includes('comic') && !title.includes('flagship') && !title.includes('serial') && !title.includes('treasure')) selectedResult = el;
      } else if (suffix.startsWith('r')) {
        if (title.includes('the best')) selectedResult = el;
      } else {
        if (!title.includes('parallel') && !title.includes('manga') && !title.includes('the best') && !title.includes('flagship') && !title.includes('serial') && !title.includes('treasure')) selectedResult = el;
      }
    });

    if (!selectedResult) return null;
    
    let rawPrice: number | undefined;
    let gradedPrice: number | undefined;

    // Extract Ungraded / Raw Price
    const priceText = $(selectedResult).find('td.price.used_price span.js-price').text();
    if (priceText) {
      const match = priceText.match(/([0-9.,]+)/);
      if (match) {
        const p = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(p) && p > 0) rawPrice = p;
      }
    }

    // Extract PSA 10 (Grade 10) Price
    const psaText = $(selectedResult).find('td.price.grade10_price span.js-price').text();
    if (psaText) {
      const match = psaText.match(/([0-9.,]+)/);
      if (match) {
        const p = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(p) && p > 0) gradedPrice = p;
      }
    }

    if (rawPrice !== undefined) {
      return { price: rawPrice, gradedPrice };
    }

  } catch (err) {
    console.error(`PriceCharting fetch error for ${query}:`, err);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
  return null;
}
