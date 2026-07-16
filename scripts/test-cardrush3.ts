import * as cheerio from 'cheerio';

async function run() {
  const url = 'https://www.cardrush-db.jp/product/148';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const $ = cheerio.load(html);
  
  console.log("Price:", $('.figure').text().trim().replace(/\s+/g, ' '));
}
run();
