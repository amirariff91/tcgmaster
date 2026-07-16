import * as cheerio from 'cheerio';
async function test() {
  const searchUrl = `https://tcgrepublic.com/product/text_search.html?q=OP01-120`;
  const response = await fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await response.text();
  const $ = cheerio.load(html);
  
  $('.product-list-item').each((_, el) => {
    const text = $(el).find('.name').text().trim().toLowerCase();
    const priceText = $(el).find('.price_with_unit_offscreen').text();
    console.log(`Title: ${text}, Price: ${priceText}`);
  });
}
test();
