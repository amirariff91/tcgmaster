import * as cheerio from 'cheerio';
import * as fs from 'fs';

async function run() {
  const url = 'https://www.tcgplayer.com/search/all/product?q=OP01-120&view=grid';
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  const html = await response.text();
  const $ = cheerio.load(html);

  const results: any[] = [];
  $('.search-result').each((i, el) => {
    const title = $(el).find('.search-result__title').text().trim();
    const priceText = $(el).find('.search-result__market-price').text().trim() || $(el).find('.price-point__data').text().trim();
    results.push({ title, priceText });
  });

  console.log('Results length:', results.length);
  console.log(results.slice(0, 5));
  
  // If search-result class doesn't exist, let's dump all h3s or spans
  if (results.length === 0) {
     const text = $('body').text().substring(0, 500);
     console.log('No results found. Body snippet:', text);
  }
}
run();
