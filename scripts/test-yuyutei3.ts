import * as cheerio from 'cheerio';

async function run() {
  const query = 'OP01-120';
  const searchUrl = `https://yuyu-tei.jp/sell/opc/s/search?search_word=${encodeURIComponent(query)}`;
  const response = await fetch(searchUrl);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const firstProduct = $('.card-product').first();
  console.log("RAW TEXT:\n", firstProduct.text().replace(/\s+/g, ' '));
}
run();
