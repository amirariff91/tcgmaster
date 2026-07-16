import * as cheerio from 'cheerio';
const response = await fetch('https://www.cardrush-db.jp/product-list?keyword=FB03-066', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
});
const html = await response.text();
const $ = cheerio.load(html);
$('.item_data').each((i, el) => console.log($(el).find('a').text().trim().split('\n')[0]));
