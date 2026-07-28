import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { waitForSourceRateLimit } from './rate-limiter';
import { parseCardNumber } from './card-number';
import type { MatchEvidence } from './identity';

// JPY to USD conversion rate — update periodically (check xe.com). ~157 as of mid-2026.
const JPY_TO_USD = 157;

export interface JapanesePriceResult {
  price: number;
  url: string;
  evidence: MatchEvidence;
}

export async function fetchJapanesePrice(query: string, setName?: string): Promise<JapanesePriceResult | null> {
  try {
    void setName;
    await waitForSourceRateLimit('yuyutei');

    let rawQuery = query;
    const isUrl = rawQuery.startsWith('http');
    const isVariant = !isUrl && parseCardNumber(rawQuery).suffix !== null;

    if (isVariant && !isUrl) {
      console.log(`[Yuyutei] Refusing to guess variant for query: ${rawQuery}`);
      return null;
    }

    // If we're passed an exact Yuyutei product URL, go straight to it!
    if (isUrl && rawQuery.includes('/sell/opc/card/')) {
      const response = await fetch(rawQuery, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
        }
      });
      if (!response.ok) return null;
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      const priceText = $('.lhs.mt-0').text() || $('body').text().replace(/\s+/g, ' ');
      const match = priceText.match(/([0-9,]+)\s*円/);
      if (match) {
        const priceJpy = parseInt(match[1].replace(/,/g, ''), 10);
        const pageText = $('body').text().replace(/\s+/g, ' ');
        const soldOut = $('.soldout, .sold-out, .sold_out, [class*="soldout"], [class*="sold-out"]').length > 0
          || /売り切れ|在庫なし|SOLD\s*OUT/i.test(pageText);
        const externalTitle = $('h1').first().text().trim()
          || $('.card-product-name, .product-name, .card-name, .item-name').first().text().trim();
        return {
          price: parseFloat((priceJpy / JPY_TO_USD).toFixed(2)),
          url: rawQuery,
          evidence: {
            externalUrl: rawQuery,
            externalTitle,
            inStock: soldOut ? false : undefined,
            matchedBy: 'cached-url',
          },
        };
      }
      return null;
    }

    // Otherwise, do a search query
    if (rawQuery.startsWith('http')) {
      try {
        const urlObj = new URL(rawQuery);
        const searchWord = urlObj.searchParams.get('search_word');
        if (searchWord) {
          rawQuery = searchWord;
        }
      } catch {}
    }

    // Determine the variant based on the query suffix
    const parsedQuery = parseCardNumber(rawQuery);
    const baseQuery = parsedQuery.base;
    const suffix = parsedQuery.suffix ?? '';

    const searchUrl = `https://yuyu-tei.jp/sell/opc/s/search?search_word=${encodeURIComponent(baseQuery)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      }
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Yuyutei lists products in .card-product
    let selectedProduct: Element | null = null;
    let selectedUrl = '';
    
    $('.card-product').each((_, el) => {
      if (selectedProduct) return;
      
      const text = $(el).text().trim();
      
      if (suffix === 'p2' || suffix === 'p3' || suffix === 'p4') {
        // High tier parallels: Manga, SP, TR, Flagship, Serial
        if (text.includes('スーパーパラレル') || text.includes('スペシャル') || text.includes('コミック') || text.includes('トレジャー') || text.includes('フラッグシップ') || text.includes('シリアル')) {
          selectedProduct = el;
        }
      } else if (suffix === 'p7' || suffix === 'p8') {
        // OP-11 SP (Special)
        if (text.includes('スペシャル') || text.includes('手配書')) {
           if (suffix === 'p8') {
              if (text.includes('ゴールド') || text.includes('金')) selectedProduct = el;
           } else {
              if (!text.includes('ゴールド') && !text.includes('金')) selectedProduct = el;
           }
        }
      } else if (suffix === 'p6') {
        // Silver SP (p6 = 銀パラレル) and Gold SP (p7 = 金パラレル)
        if (text.includes('銀パラレル') || (text.includes('銀') && text.includes('パラレル'))) selectedProduct = el;
      } else if (suffix === 'p1' || suffix.startsWith('p')) {
        // Normal Parallel
        if (text.includes('パラレル') && !text.includes('スーパーパラレル') && !text.includes('(PRB)') && !text.includes('スペシャル') && !text.includes('トレジャー') && !text.includes('手配書')) {
          selectedProduct = el;
        }
      } else if (suffix.startsWith('r')) {
        // Reprint (PRB-01)
        if (text.includes('(PRB)')) {
           if (suffix === 'r2' && text.includes('スーパーパラレル')) selectedProduct = el;
           else if (suffix === 'r1' && !text.includes('スーパーパラレル')) selectedProduct = el;
           else selectedProduct = el;
        }
      } else {
        // Base version
        if (!text.includes('パラレル') && !text.includes('(PRB)')) {
          // Note: Base can have (刻印あり) or (刻印なし) which is fine, we just take the first one
          selectedProduct = el;
        }
      }
      
      if (selectedProduct) {
        const link = $(el).find('a').attr('href');
        if (link) {
          selectedUrl = link.startsWith('http') ? link : 'https://yuyu-tei.jp' + link;
        }
      }
    });

    if (!selectedProduct) return null;
    
    const priceText = $(selectedProduct).text().replace(/\s+/g, ' ');
    
    // Extract numbers before '円'
    const match = priceText.match(/([0-9,]+)\s*円/);
    if (match) {
      const priceJpy = parseInt(match[1].replace(/,/g, ''), 10);
      // Convert JPY to USD roughly for the database (150 JPY = 1 USD)
      const rowText = $(selectedProduct).text().replace(/\s+/g, ' ');
      const rowHtml = $(selectedProduct).html() ?? '';
      const soldOut = /soldout|sold-out|売り切れ|在庫なし|SOLD\s*OUT/i.test(`${rowHtml} ${rowText}`);
      const externalTitle = $(selectedProduct).find('.name').text().trim()
        || $(selectedProduct).find('a').first().text().trim()
        || rowText;
      return {
        price: parseFloat((priceJpy / JPY_TO_USD).toFixed(2)),
        url: selectedUrl || searchUrl,
        evidence: {
          externalUrl: selectedUrl || searchUrl,
          externalTitle,
          inStock: soldOut ? false : undefined,
          matchedBy: 'search',
        },
      };
    }
    
  } catch (err) {
    console.error(`Yuyutei fetch error for ${query}:`, err);
  }
  return null;
}
