import * as cheerio from 'cheerio';

// JPY to USD conversion rate — update periodically (check xe.com). ~157 as of mid-2026.
const JPY_TO_USD = 157;

export interface CardrushResult {
  priceUsd: number | null;
  imageUrl: string | null;
  url: string | null;
}

export async function fetchCardrushData(cardNumber: string): Promise<CardrushResult> {
  try {
    // If we're passed an exact Cardrush product URL, go straight to it!
    if (cardNumber.startsWith('http') && cardNumber.includes('/product/')) {
      const response = await fetch(cardNumber, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!response.ok) return { priceUsd: null, imageUrl: null, url: null };
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      const priceText = $('.figure').text().trim() || $('.price').text().trim();
      const imageSrc = $('.item_img img').attr('src') || $('img').attr('src');
      
      if (priceText) {
        const match = priceText.match(/([0-9,]+)円/);
        if (match) {
          const jpyPrice = parseFloat(match[1].replace(/,/g, ''));
          if (!isNaN(jpyPrice)) {
            const usdPrice = Math.round((jpyPrice / JPY_TO_USD) * 100) / 100;
            const fullImg = imageSrc ? (imageSrc.startsWith('http') ? imageSrc : `https://www.cardrush-db.jp${imageSrc}`) : null;
            return { priceUsd: usdPrice, imageUrl: fullImg, url: cardNumber };
          }
        }
      }
      return { priceUsd: null, imageUrl: null, url: null };
    }

    // 1. Separate base number from suffix (e.g. FB01-129-p2 -> base: FB01-129, suffix: p2)
    const matchBase = cardNumber.match(/^([A-Z0-9]+-[0-9]+)(?:[-_](.*))?$/);
    const baseNumber = matchBase ? matchBase[1] : cardNumber;
    const suffix = matchBase && matchBase[2] ? matchBase[2].toLowerCase() : '';
    
    const searchUrl = `https://www.cardrush-db.jp/product-list?keyword=${encodeURIComponent(baseNumber)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) return { priceUsd: null, imageUrl: null, url: null };
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    let lowestPrice: number | null = null;
    let bestImage: string | null = null;
    let bestUrl: string | null = null;
    
    $('.item_data').each((i, el) => {
      const title = $(el).find('.name').text().trim() || $(el).find('a').text().trim();
      const url = $(el).find('a').attr('href');
      
      // Filter out damaged or graded cards
      if (title.includes('〔状態') || title.includes('PSA')) {
        return; // skip
      }
      
      // Exact match check: Ensure the base number appears in the {} brackets
      if (!title.includes(`{${baseNumber}}`)) {
        return; // skip
      }
      
      // Variant matching logic
      let isSuperParallel = title.includes('スーパーパラレル') || title.includes('スペシャル') || title.includes('コミック') || title.includes('トレジャー') || title.includes('フラッグシップ') || title.includes('シリアル');
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
    };
    
  } catch (err) {
    console.error(`Cardrush fetch error for ${cardNumber}:`, err);
  }
  return { priceUsd: null, imageUrl: null, url: null };
}

export async function fetchCardrushPrice(cardNumber: string): Promise<{ price: number, url: string } | null> {
  const result = await fetchCardrushData(cardNumber);
  if (result.priceUsd !== null && result.url !== null) {
     return { price: result.priceUsd, url: result.url };
  }
  return null;
}
