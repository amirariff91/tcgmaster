import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { getSharedBrowser } from './browser';
import { waitForSourceRateLimit } from './rate-limiter';
import type { MatchEvidence } from './identity';

// Return an object that can contain both raw and graded prices
export interface SnkrdunkPriceResult {
  price: number;
  gradedPrices?: Record<string, number>;
  url: string;
  evidence: MatchEvidence;
}

export async function fetchSnkrdunkPrice(query: string, setName?: string): Promise<SnkrdunkPriceResult | null> {
  let page;
  try {
    void setName;
    await waitForSourceRateLimit('snkrdunk');

    let rawQuery = query;
    const isUrl = rawQuery.startsWith('http');
    const isVariant = rawQuery.includes('_');

    if (isVariant && !isUrl) {
      console.log(`[SnkrDunk] Refusing to guess variant for query: ${rawQuery}`);
      return null;
    }

    // If we're passed an exact SNKRDUNK product URL, go straight to it!
    if (isUrl && rawQuery.includes('/trading-cards/')) {
      const browser = await getSharedBrowser();
      page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(rawQuery, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 2000));

      const html = await page.content();
      const $ = cheerio.load(html);

      // Look for graded prices in size lists
      const gradedPrices: Record<string, number> = {};
      $('.size-modal__item, .product-detail__size, .size-list__item, li').each((_, el) => {
         const text = $(el).text().trim().replace(/\s+/g, ' ');
         if (!text.includes('US $')) return;

         const match = text.match(/US\s*\$([0-9.,]+)/);
         if (!match) return;
         const p = parseFloat(match[1].replace(/,/g, ''));
         if (isNaN(p) || p <= 0) return;

         // Dynamically parse grades (e.g. "PSA 10", "BGS 9.5", "ARS 10+", "CGC 10")
         let gradeKey: string | null = null;
         const lowerText = text.toLowerCase();
         if (lowerText.includes('psa 10')) gradeKey = 'psa10';
         else if (lowerText.includes('psa 9')) gradeKey = 'psa9';
         else if (lowerText.includes('psa 8')) gradeKey = 'psa8';
         else if (lowerText.includes('bgs 10')) gradeKey = 'bgs10';
         else if (lowerText.includes('bgs 9.5')) gradeKey = 'bgs95';
         else if (lowerText.includes('bgs 9')) gradeKey = 'bgs9';
         else if (lowerText.includes('cgc 10')) gradeKey = 'cgc10';
         else if (lowerText.includes('cgc 9.5')) gradeKey = 'cgc95';
         else if (lowerText.includes('cgc 9')) gradeKey = 'cgc9';
         else if (lowerText.includes('ars 10+')) gradeKey = 'ars10plus';
         else if (lowerText.includes('ars 10')) gradeKey = 'ars10';
         else if (lowerText.includes('ars 9')) gradeKey = 'ars9';

         if (gradeKey && !gradedPrices[gradeKey]) {
           gradedPrices[gradeKey] = p;
         }
      });

      const priceText = $('.product-detail__textarea').text() || $('body').text();
      const match = priceText.match(/US\s*\$([0-9.,]+)/);
      let price: number | undefined;
      if (match) {
        const p = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(p) && p > 0) price = p;
      }

      if (price !== undefined || Object.keys(gradedPrices).length > 0) {
        const externalTitle = $('h1').first().text().trim()
          || $('.product-detail__name, .product-name, .product-title').first().text().trim();
        return {
          price: price || 0, // Fallback to 0 if only graded prices exist, since price is required in SnkrdunkPriceResult
          ...(Object.keys(gradedPrices).length > 0 ? { gradedPrices } : {}),
          url: rawQuery,
          evidence: {
            externalUrl: rawQuery,
            externalTitle,
            matchedBy: 'cached-url',
          },
        };
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
      } catch {}
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

    let selectedResult: Element | null = null;
    let selectedUrl = '';
    let selectedTitle = '';
    const results = $('.product__item-textarea');

    results.each((_, el) => {
      if (selectedResult) return;
      const rawTitle = $(el).find('.product__item-name').text().trim();
      const text = rawTitle.toLowerCase();

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
      } else if (suffix === 'p6') {
        if (text.includes('silver')) selectedResult = el;
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
        selectedTitle = rawTitle;
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
          return {
            price,
            url: selectedUrl || searchUrl,
            evidence: {
              externalUrl: selectedUrl || searchUrl,
              externalTitle: selectedTitle,
              matchedBy: 'search',
            },
          };
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
