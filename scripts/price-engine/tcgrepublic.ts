import * as cheerio from 'cheerio';

export async function fetchTcgRepublicPrice(query: string): Promise<number | null> {
  try {
    let suffix = '';
    let baseQuery = query;
    if (query.includes('_')) {
      [baseQuery, suffix] = query.split('_');
    }

    const searchUrl = `https://tcgrepublic.com/product/text_search.html?q=${encodeURIComponent(baseQuery)}`;
    
    // Node.js fetch gets blocked with a 404, but curl works
    const { execSync } = require('child_process');
    const html = execSync(`curl -s "${searchUrl}"`).toString();
    const $ = cheerio.load(html);
    
    let selectedResult: any = null;
    const results = $('a');
    
    results.each((_, el) => {
      if (selectedResult) return;
      const text = $(el).find('.product_thumbnail_caption span').text().trim().toLowerCase();
      const priceText = $(el).find('.price_with_unit_offscreen').text();
      
      if (!text || !priceText) return;

      if (suffix === 'p2' || suffix === 'p3' || suffix === 'p4') {
        if (text.includes('manga') || text.includes('comic') || text.includes('sp') || text.includes('flagship') || text.includes('serial') || text.includes('treasure')) selectedResult = el;
      } else if (suffix === 'p7' || suffix === 'p8') {
        if (text.includes('sp') || text.includes('wanted poster')) {
           if (suffix === 'p8') {
             if (text.includes('gold')) selectedResult = el;
           } else {
             if (!text.includes('gold')) selectedResult = el;
           }
        }
      } else if (suffix === 'p1' || suffix.startsWith('p')) {
        if (text.includes('parallel') && !text.includes('manga') && !text.includes('comic') && !text.includes('flagship') && !text.includes('serial') && !text.includes('treasure') && !text.includes('sp') && !text.includes('wanted poster')) selectedResult = el;
      } else if (suffix.startsWith('r')) {
        if (text.includes('the best') || text.includes('reprint')) {
           if (suffix === 'r2' && text.includes('manga')) selectedResult = el;
           else if (suffix === 'r1' && !text.includes('manga')) selectedResult = el;
           else selectedResult = el;
        }
      } else {
        if (!text.includes('parallel') && !text.includes('manga') && !text.includes('the best') && !text.includes('flagship') && !text.includes('serial') && !text.includes('treasure') && !text.includes('sp') && !text.includes('wanted poster')) selectedResult = el;
      }
    });

    // We removed the dangerous fallback to results.first()[0]
    
    if (!selectedResult) return null;
    
    const priceText = $(selectedResult).find('.price_with_unit_offscreen').text();
    if (priceText) {
      const price = parseFloat(priceText);
      if (!isNaN(price)) {
        return price;
      }
    }
    
  } catch (err) {
    console.error(`TCG Republic fetch error for ${query}:`, err);
  }
  return null;
}
