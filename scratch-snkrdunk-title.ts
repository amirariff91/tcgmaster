import * as cheerio from 'cheerio';
async function run() {
  const url = 'https://snkrdunk.com/en/trading-cards/159664?slide=right&query_id=1d219cb2-4a65-4c8f-9827-33d622a03269';
  const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  };
  const res = await fetch(url, { headers: HEADERS });
  console.log('Status:', res.status);
  const html = await res.text();
  const $ = cheerio.load(html);
  const title = $('h1').first().text().trim() || $('.product-detail__name, .product-name, .product-title').first().text().trim();
  console.log('Title:', title);
}
run();
