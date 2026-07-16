import * as cheerio from 'cheerio';
const response = await fetch('https://yuyu-tei.jp/sell/opc/s/search?search_word=OP01-120', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
});
const html = await response.text();
const $ = cheerio.load(html);
$('.card-product .name').each((i, el) => console.log($(el).text().trim().replace(/\s+/g, ' ')));
