import * as cheerio from 'cheerio';

async function run() {
  const query = 'OP06-118';
  const url = `https://tcgrepublic.com/product/text_search.html?q=${query}`;
  console.log('Fetching:', url);
  const res = await fetch(url);
  const text = await res.text();
  const $ = cheerio.load(text);
  
  const results: any[] = [];
  $('.product-list-item').each((i, el) => {
    const title = $(el).find('.product-name').text().trim();
    const priceText = $(el).find('.product-price').text().trim();
    results.push({ title, priceText });
  });
  
  console.log(results);
}
run();
