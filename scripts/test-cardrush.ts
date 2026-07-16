import * as cheerio from 'cheerio';

async function run() {
  const url = 'https://www.cardrush-db.jp/product/6429';
  const res = await fetch(url, { headers: { 'User-Agent': 'curl/8.4.0' } });
  const html = await res.text();
  const $ = cheerio.load(html);
  
  console.log("Title:", $('h1, .name').text().trim().replace(/\s+/g, ' '));
  console.log("Price:", $('.price, .figure').text().trim().replace(/\s+/g, ' '));
}
run();
