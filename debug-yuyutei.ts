import * as cheerio from 'cheerio';

async function run() {
  const searchUrl = `https://yuyu-tei.jp/sell/opc/s/search?search_word=OP01-120`;
  const response = await fetch(searchUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  
  const html = await response.text();
  const $ = cheerio.load(html);
  
  $('.card-product').each((i, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    console.log(`[${i}]`, text);
  });
}
run();
