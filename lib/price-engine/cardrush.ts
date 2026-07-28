import * as cheerio from 'cheerio';
import { waitForSourceRateLimit } from './rate-limiter';
import { parseCardNumber } from './card-number';
import type { MatchEvidence } from './identity';

// JPY to USD conversion rate — update periodically (check xe.com). ~157 as of mid-2026.
const JPY_TO_USD = 157;

export interface CardrushResult {
  priceUsd: number | null;
  imageUrl: string | null;
  url: string | null;
  evidence: MatchEvidence;
}

function emptyEvidence(matchedBy: MatchEvidence['matchedBy']): MatchEvidence {
  return { matchedBy };
}

export async function fetchCardrushData(cardNumber: string): Promise<CardrushResult> {
  try {
    await waitForSourceRateLimit('cardrush');

    // If we're passed an exact Cardrush product URL, go straight to it!
    if (cardNumber.startsWith('http') && cardNumber.includes('/product/')) {
      const response = await fetch(cardNumber, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!response.ok) return { priceUsd: null, imageUrl: null, url: null, evidence: emptyEvidence('cached-url') };
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      const priceText = $('.figure').text().trim() || $('.price').text().trim();
      const imageSrc = $('.item_img img').attr('src') || $('img').attr('src');
      const pageText = $('body').text().replace(/\s+/g, ' ');
      const externalTitle = $('h1').first().text().trim()
        || $('.card-product-name, .product-name, .item-name, .name').first().text().trim();
      const soldOut = $('.soldout, .sold-out, .sold_out, [class*="soldout"], [class*="sold-out"]').length > 0
        || /売り切れ|在庫なし|SOLD\s*OUT/i.test(pageText);
      
      if (priceText) {
        const match = priceText.match(/([0-9,]+)円/);
        if (match) {
          const jpyPrice = parseFloat(match[1].replace(/,/g, ''));
          if (!isNaN(jpyPrice)) {
            const usdPrice = Math.round((jpyPrice / JPY_TO_USD) * 100) / 100;
            const fullImg = imageSrc ? (imageSrc.startsWith('http') ? imageSrc : `https://www.cardrush-db.jp${imageSrc}`) : null;
            return {
              priceUsd: usdPrice,
              imageUrl: fullImg,
              url: cardNumber,
              evidence: {
                externalUrl: cardNumber,
                externalTitle,
                inStock: soldOut ? false : undefined,
                matchedBy: 'cached-url',
              },
            };
          }
        }
      }
      return { priceUsd: null, imageUrl: null, url: null, evidence: emptyEvidence('cached-url') };
    }

    // 1. Separate base number from suffix (e.g. FB01-129-p2 -> base: FB01-129, suffix: p2)
    const parsedCardNumber = parseCardNumber(cardNumber);
    const baseNumber = parsedCardNumber.base;
    const suffix = parsedCardNumber.suffix ?? '';
    
    const searchUrl = `https://www.cardrush-db.jp/product-list?keyword=${encodeURIComponent(baseNumber)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) return { priceUsd: null, imageUrl: null, url: null, evidence: emptyEvidence('search') };
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    let lowestPrice: number | null = null;
    let bestImage: string | null = null;
    let bestUrl: string | null = null;
    let bestEvidence: MatchEvidence | null = null;
    
    $('.item_data').each((i, el) => {
      const title = $(el).find('.name').text().trim() || $(el).find('a').text().trim();
      const url = $(el).find('a').attr('href');
      const rowHtml = $(el).html() ?? '';
      const inStock = !/soldout|sold-out|売り切れ|在庫なし|SOLD\s*OUT/i.test(`${rowHtml} ${title}`);
      
      // Filter out damaged or graded cards
      if (title.includes('〔状態') || title.includes('PSA')) {
        return; // skip
      }
      
      // Exact match check: Ensure the base number appears in the {} brackets
      if (!title.includes(`{${baseNumber}}`)) {
        return; // skip
      }
      
      // Variant matching logic
      const isSuperParallel = title.includes('スーパーパラレル') || title.includes('スペシャル') || title.includes('コミック') || title.includes('トレジャー') || title.includes('フラッグシップ') || title.includes('シリアル');
      const isRegularParallel = title.includes('パラレル') || title.includes('パラ');
      const isParallel = isSuperParallel || isRegularParallel;
      
      if (suffix === 'p2' || suffix === 'p3' || suffix === 'p4') {
        if (!isSuperParallel) return; // Enforce strict match for high-tier parallels
      } else if (suffix === 'p1' || suffix.startsWith('p') || suffix === 'alt') { // p1, alt
        if (!isRegularParallel) return;
        if (isSuperParallel) return; // skip SP/Manga if we only want p1
      } else {
        if (isParallel) return; // skip if parallel and we want base
      }

      const priceText = $(el).find('.price').text().trim() || $(el).find('.figure').text().trim();
      const imageSrc = $(el).find('img').attr('src');
      
      if (priceText) {
        // e.g. 1,880円(税込)
        const match = priceText.match(/([0-9,]+)円/);
        if (match) {
          const jpyPrice = parseFloat(match[1].replace(/,/g, ''));
          if (!isNaN(jpyPrice)) {
            // Convert JPY to USD (150 JPY = 1 USD)
            const usdPrice = Math.round((jpyPrice / JPY_TO_USD) * 100) / 100;
            
            if (lowestPrice === null || usdPrice < lowestPrice) {
              lowestPrice = usdPrice;
              if (url) {
                 bestUrl = url.startsWith('http') ? url : `https://www.cardrush-db.jp${url}`;
              }
              bestEvidence = {
                externalUrl: bestUrl ?? undefined,
                externalTitle: title,
                inStock: inStock ? undefined : false,
                matchedBy: 'search',
              };
              if (imageSrc) {
                // Ensure absolute URL
                bestImage = imageSrc.startsWith('http') ? imageSrc : `https://www.cardrush-db.jp${imageSrc}`;
              }
            }
          }
        }
      }
    });
    
    return {
      priceUsd: lowestPrice,
      imageUrl: bestImage,
      url: bestUrl,
      evidence: bestEvidence ?? emptyEvidence('search'),
    };
    
  } catch (err) {
    console.error(`Cardrush fetch error for ${cardNumber}:`, err);
  }
  return { priceUsd: null, imageUrl: null, url: null, evidence: emptyEvidence('search') };
}

export async function fetchCardrushPrice(cardNumber: string): Promise<{ price: number, url: string, evidence: MatchEvidence } | null> {
  const result = await fetchCardrushData(cardNumber);
  if (result.priceUsd !== null && result.url !== null) {
     return { price: result.priceUsd, url: result.url, evidence: result.evidence };
  }
  return null;
}
