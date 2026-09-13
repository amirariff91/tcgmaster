import * as cheerio from 'cheerio';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface TcgRepublicResult {
  price: number;
  currency: 'USD';
  evidence: {
    matchedBy: 'tcgrepublic-search';
    externalUrl: string;
    externalTitle: string;
  };
}

/**
 * Fetch live prices from TCG Republic for Japanese One Piece and Pokémon cards
 * Handles variants (_p1 Alt Art, _p2 Manga, _r1 Reprint) cleanly with boundary matching
 */
export async function fetchTcgRepublicPrice(cardNumber: string, cardName?: string): Promise<TcgRepublicResult | null> {
  if (!cardNumber) return null;

  try {
    let suffix = '';
    let baseQuery = cardNumber.trim().toUpperCase();
    if (baseQuery.includes('_')) {
      [baseQuery, suffix] = baseQuery.split('_');
    } else if (baseQuery.includes('-P')) {
      const parts = baseQuery.split('-P');
      baseQuery = parts[0];
      suffix = 'p' + parts[1];
    }

    const searchUrl = `https://tcgrepublic.com/product/text_search.html?q=${encodeURIComponent(baseQuery)}`;

    // TCG Republic blocks default fetch headers; curl reliably executes fast
    const { stdout: html } = await execAsync(`curl -s -m 12 "${searchUrl}"`, { maxBuffer: 10 * 1024 * 1024 });
    if (!html) return null;

    const $ = cheerio.load(html);
    let selectedTitle = '';
    let selectedPrice: number | null = null;
    let selectedUrl = searchUrl;

    $('div.product_item, a.product_item_wrap, a').each((_, el) => {
      if (selectedPrice !== null) return;

      const title = $(el).find('.product_thumbnail_caption span, .product_name, .product_item_name').text().trim();
      const priceText = $(el).find('.price_with_unit_offscreen').first().text().trim();
      if (!title || !priceText) return;

      const titleLower = title.toLowerCase();
      const baseLower = baseQuery.toLowerCase();
      if (!titleLower.includes(baseLower)) return;

      const parsedPrice = parseFloat(priceText.replace(/,/g, ''));
      if (isNaN(parsedPrice) || parsedPrice <= 0) return;

      const isManga = titleLower.includes('manga') || titleLower.includes('comic') || titleLower.includes('flagship') || titleLower.includes('serial');
      const isParallel = titleLower.includes('parallel') || titleLower.includes('alternate art') || titleLower.includes('alt art') || titleLower.includes('sp ') || titleLower.includes('wanted poster');
      const isReprint = titleLower.includes('the best') || titleLower.includes('reprint');

      if (suffix === 'p2' || suffix === 'p3' || suffix === 'p4') {
        if (isManga) {
          selectedPrice = parsedPrice;
          selectedTitle = title;
          selectedUrl = $(el).attr('href') ? `https://tcgrepublic.com${$(el).attr('href')}` : searchUrl;
        }
      } else if (suffix === 'p1' || suffix.startsWith('p')) {
        if (isParallel && !isManga) {
          selectedPrice = parsedPrice;
          selectedTitle = title;
          selectedUrl = $(el).attr('href') ? `https://tcgrepublic.com${$(el).attr('href')}` : searchUrl;
        }
      } else if (suffix.startsWith('r')) {
        if (isReprint) {
          selectedPrice = parsedPrice;
          selectedTitle = title;
          selectedUrl = $(el).attr('href') ? `https://tcgrepublic.com${$(el).attr('href')}` : searchUrl;
        }
      } else {
        // Base card: must reject any variant keywords
        if (!isParallel && !isManga && !isReprint) {
          selectedPrice = parsedPrice;
          selectedTitle = title;
          selectedUrl = $(el).attr('href') ? `https://tcgrepublic.com${$(el).attr('href')}` : searchUrl;
        }
      }
    });

    if (selectedPrice !== null && selectedPrice > 0) {
      return {
        price: selectedPrice,
        currency: 'USD',
        evidence: {
          matchedBy: 'tcgrepublic-search',
          externalUrl: selectedUrl,
          externalTitle: selectedTitle,
        },
      };
    }
  } catch (err: any) {
    console.warn(`[TCGRepublic] Error fetching price for ${cardNumber}:`, err.message);
  }

  return null;
}
