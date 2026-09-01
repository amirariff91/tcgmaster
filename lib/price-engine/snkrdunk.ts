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
      const match = rawQuery.match(/\/trading-cards\/(\d+)/);
      if (!match) return null;
      
      const productId = match[1];
      const productCode = `SW---${productId}`;
      const HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      };

      // Fetch Product Details for Title
      const prodRes = await fetch(`https://snkrdunk.com/en/v1/products/${productCode}`, { headers: HEADERS });
      const prodData = await prodRes.json() as any;
      const externalTitle = prodData?.product?.name || 'Snkrdunk Card';

      // Fetch Used Listings for Prices
      const listingsRes = await fetch(`https://snkrdunk.com/en/v1/products/${productCode}/used-listings?perPage=50&page=1&sortType=latest&isOnlyOnSale=false`, { headers: HEADERS });
      const listingsData = await listingsRes.json() as any;
      const listings = Array.isArray(listingsData?.usedListings) ? listingsData.usedListings : [];

      const gradedPrices: Record<string, number> = {};
      const seenSoldGrades = new Set<string>();

      for (const listing of listings) {
        if (typeof listing !== 'object' || listing === null) continue;
        const condition = listing.condition || 'A';
        const price = Number(listing.priceAmount);
        if (isNaN(price) || price <= 0) continue;

        let parsedGrade = 'raw';
        if (!['B', 'C', 'D', 'S', 'A'].includes(condition)) {
           let company, numeric;
           const gradeMatchFull = condition.match(/^(PSA|BGS|CGC|TAG|AGS|ARS).*?\s+([0-9]+\.?[0-9]*\+?)$/i);
           const gradeMatchPartial = condition.match(/^(PSA)\s*([0-9]+\.?[0-9]*)/i);

           if (gradeMatchFull) {
             company = gradeMatchFull[1].toLowerCase();
             numeric = gradeMatchFull[2].replace('+', '').replace('.', '');
             parsedGrade = `${company}${numeric}`;
           } else if (gradeMatchPartial) {
             company = gradeMatchPartial[1].toLowerCase();
             numeric = gradeMatchPartial[2].replace('+', '').replace('.', '');
             parsedGrade = `${company}${numeric}`;
           } else {
             // Basic fallback
             if (condition.includes('PSA 10')) parsedGrade = 'psa10';
             else if (condition.includes('PSA 9')) parsedGrade = 'psa9';
             else if (condition.includes('BGS 10')) parsedGrade = 'bgs10';
           }
        } else if (['B', 'C', 'D'].includes(condition)) {
           continue; // Skip lower grades
        }

        if (listing.isSold) {
          if (!seenSoldGrades.has(parsedGrade)) {
            seenSoldGrades.add(parsedGrade);
            gradedPrices[parsedGrade] = price;
          }
        } else {
          // If not sold, it's an Ask price. We only save it if we haven't seen a Sold price AND haven't saved a lower Ask price yet.
          if (!seenSoldGrades.has(parsedGrade)) {
            if (!gradedPrices[parsedGrade] || price < gradedPrices[parsedGrade]) {
              gradedPrices[parsedGrade] = price;
            }
          }
        }
      }

      let headlinePrice: number | undefined;
      if (gradedPrices['raw']) {
        headlinePrice = gradedPrices['raw'];
        delete gradedPrices['raw'];
      } else {
        // Fallback to whichever is available if raw isn't
        headlinePrice = Object.values(gradedPrices)[0];
      }

      if (headlinePrice !== undefined || Object.keys(gradedPrices).length > 0) {
        return {
          price: headlinePrice || 0,
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
