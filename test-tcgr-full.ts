import * as cheerio from 'cheerio';
import { fetchTcgRepublicPrice } from './scripts/price-engine/tcgrepublic';

async function test() {
  const query = 'OP01-120';
  let suffix = '';
  let baseQuery = query;
  if (query.includes('_')) {
    [baseQuery, suffix] = query.split('_');
  }

  const searchUrl = `https://tcgrepublic.com/product/text_search.html?q=${encodeURIComponent(baseQuery)}`;
  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  });
  
  if (!response.ok) { console.log('not ok'); return null; }
  
  const html = await response.text();
  const $ = cheerio.load(html);
  
  let selectedResult: any = null;
  const results = $('a');
  
  results.each((_, el) => {
    if (selectedResult) return;
    const text = $(el).find('.product_thumbnail_caption span').text().trim().toLowerCase();
    
    if (!text) return;
    console.log("Found text:", text);

    if (suffix === 'p2' || suffix === 'p3' || suffix === 'p4') {
      if (text.includes('manga') || text.includes('comic') || text.includes('sp') || text.includes('flagship') || text.includes('serial') || text.includes('treasure')) selectedResult = el;
    } else if (suffix === 'p1' || suffix.startsWith('p')) {
      if (text.includes('parallel') && !text.includes('manga') && !text.includes('comic') && !text.includes('flagship') && !text.includes('serial') && !text.includes('treasure')) selectedResult = el;
    } else if (suffix.startsWith('r')) {
      if (text.includes('the best')) selectedResult = el;
    } else {
      if (!text.includes('parallel') && !text.includes('manga') && !text.includes('the best') && !text.includes('flagship') && !text.includes('serial') && !text.includes('treasure')) selectedResult = el;
    }
    
    if (selectedResult) console.log('Selected:', text);
  });
}
test();
