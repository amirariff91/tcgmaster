import * as cheerio from 'cheerio';
const response = await fetch('https://www.cardrush-pokemon.jp/phone/product-list?keyword=OP01-120', {
  headers: { 'User-Agent': 'Mozilla/5.0' }
}); // Wait, cardrush pokemon is wrong url. Let me use snkrdunk API instead.
