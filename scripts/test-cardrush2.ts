import * as cheerio from 'cheerio';

async function run() {
  const searchUrl = 'https://www.cardrush-db.jp/product-list?keyword=FB01-129';
  const res = await fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const $ = cheerio.load(html);
  
  $('.item_data').each((i, el) => {
    const title = $(el).find('.name').text().trim() || $(el).find('a').text().trim();
    const url = $(el).find('a').attr('href');
    const priceText = $(el).find('.price').text().trim() || $(el).find('.figure').text().trim();
    console.log(`Title: ${title} | URL: ${url} | Price: ${priceText}`);
  });
}
run();
