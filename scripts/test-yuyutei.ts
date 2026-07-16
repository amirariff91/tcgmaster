import * as cheerio from 'cheerio';

async function run() {
  const query = 'OP01-120';
  console.log(`Searching YuyuTei for: ${query}`);
  
  try {
    const searchUrl = `https://yuyu-tei.jp/sell/opc/s/search?search_word=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Yuyutei lists products in .card-product
    const firstProduct = $('.card-product').first();
    if (!firstProduct.length) {
      console.log('No results found on Yuyutei.');
      return;
    }
    
    const name = firstProduct.find('h4').text().trim();
    const priceText = firstProduct.find('.price').text().trim();
    
    console.log(`Found: ${name}`);
    console.log(`Price: ${priceText}`);
    
  } catch (err) {
    console.error(err);
  }
}
run();
