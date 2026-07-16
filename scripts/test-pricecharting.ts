import * as cheerio from 'cheerio';
async function run() {
  const url = 'https://www.pricecharting.com/search-products?type=prices&q=EB01-033';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  console.log("Status:", res.status);
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const items = $('table#games_table tbody tr');
  console.log("Found items:", items.length);
  if (items.length > 0) {
    console.log("First item HTML:", items.first().html()?.substring(0, 200));
  }
}
run();
