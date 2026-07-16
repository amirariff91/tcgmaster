import * as cheerio from 'cheerio';
async function run() {
  const searchUrl = 'https://www.cardrush-db.jp/product-list?keyword=FB01-129';
  const response = await fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await response.text();
  const $ = cheerio.load(html);
  
  $('.item_data').each((i, el) => {
    const title = $(el).find('.name').text().trim() || $(el).find('a').text().trim();
    console.log('[' + i + ']', title);
  });
}
run();
