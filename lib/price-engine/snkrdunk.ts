import * as cheerio from 'cheerio';
import { getSharedBrowser } from './browser';
import { waitForSourceRateLimit } from './rate-limiter';

// Return an object that can contain both raw and graded prices
export async function fetchSnkrdunkPrice(query: string, setName?: string): Promise<{ price: number; gradedPrice?: number; url: string } | null> {
  let page;
  try {
    await waitForSourceRateLimit('snkrdunk');

    let rawQuery = query;

    // If we're passed an exact SNKRDUNK product URL, go straight to it!
    if (rawQuery.startsWith('http') && rawQuery.includes('/trading-cards/')) {
      const browser = await getSharedBrowser();
      page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(rawQuery, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 2000));
      
      const html = await page.content();
      const $ = cheerio.load(html);
      
      // Look for PSA 10 price in size lists
      let gradedPrice: number | undefined;
      $('.size-modal__item, .product-detail__size, .size-list__item, li').each((_, el) => {
         const text = $(el).text().trim().replace(/\s+/g, ' ');
         if (text.includes('PSA 10') && text.includes('US $')) {
            const match = text.match(/US\s*\$([0-9.,]+)/);
            if (match) {
               const p = parseFloat(match[1].replace(/,/g, ''));
               if (!isNaN(p) && p > 0) gradedPrice = p;
            }
         }
      });
      
      let priceText = $('.product-detail__textarea').text() || $('body').text();
      const match = priceText.match(/US\s*\$([0-9.,]+)/);
      if (match) {
        const price = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(price) && price > 0) {
          return { price, gradedPrice, url: rawQuery };
        }
      }
      return null;
    }

    // Otherwise, we are doing a search query.
    if (rawQuery.startsWith('http')) {
      try {
        const urlObj = new URL(rawQuery);
        const keyword = urlObj.searchParams.get('keyword');
        if (keyword) {
          rawQuery = keyword;
        }
      } catch (e) {}
    }

    let suffix = '';
    let baseQuery = rawQuery;
    if (rawQuery.includes('_')) {
      [baseQuery, suffix] = rawQuery.split('_');
    }

    const searchUrl = `https://snkrdunk.com/en/search/result?keyword=${encodeURIComponent(baseQuery)}`;
    
    const browser = await getSharedBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    
    const html = await page.content();
    const $ = cheerio.load(html);
    
    let selectedResult: any = null;
    let selectedUrl = '';
    const results = $('.product__item-textarea');
    
    results.each((_, el) => {
      if (selectedResult) return;
      const text = $(el).find('.product__item-name').text().trim().toLowerCase();
      
      // Exclude English/Chinese/Korean cards
      if (text.includes('[en]') || text.includes('[cn]') || text.includes('[kr]')) return;
      
      const isParallel = text.includes('parallel') || text.includes('-p') || text.includes('alt art');
      const isReprint = text.includes('prb') || text.includes('the best');
      const isManga = text.includes('manga') || text.includes('comic') || text.includes('serial') || text.includes('treasure') || text.includes('flagship');
      
      if (suffix === 'p2' || suffix === 'p3' || suffix === 'p4') {
        if (isManga) selectedResult = el;
      } else if (suffix === 'p7' || suffix === 'p8') {
        if (text.includes('sp') || text.includes('wanted poster')) {
          if (suffix === 'p8') {
             if (text.includes('gold')) selectedResult = el;
          } else {
             if (!text.includes('gold')) selectedResult = el;
          }
        }
      } else if (suffix === 'p6' || suffix === 'p7') {
        if (suffix === 'p6') {
          if (text.includes('silver')) selectedResult = el;
        } else {
          if (text.includes('gold')) selectedResult = el;
        }
      } else if (suffix === 'p1' || suffix.startsWith('p') || suffix === 'alt') {
        if (isParallel && !isManga && !text.includes('sp') && !text.includes('wanted poster')) {
          selectedResult = el;
        }
      } else if (suffix.startsWith('r')) {
        if (isReprint) {
           if (suffix === 'r2' && isManga) selectedResult = el;
           else if (suffix === 'r1' && !isManga) selectedResult = el;
           else selectedResult = el;
        }
      } else {
        if (!isParallel && !isManga && !isReprint && !text.includes('sp') && !text.includes('wanted poster')) {
          selectedResult = el;
        }
      }
      
      if (selectedResult) {
        const link = $(el).closest('a').attr('href');
        if (link) selectedUrl = 'https://snkrdunk.com' + link;
      }
    });

    if (!selectedResult) return null;
    
    const priceText = $(selectedResult).find('.product__item-price').text();
    if (priceText) {
      const match = priceText.match(/([0-9.,]+)/);
      if (match) {
        const price = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(price) && price > 0) {
          return { price, url: selectedUrl || searchUrl };
        }
      }
    }
  } catch (err) {
    console.error(`Snkrdunk fetch error for ${query}:`, err);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
  return null;
}
