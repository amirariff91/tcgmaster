import * as cheerio from 'cheerio';
async function test() {
  const fs = require('fs');
  const child_process = require('child_process');
  const html = child_process.execSync('curl -s "https://tcgrepublic.com/product/text_search.html?q=OP01-120"').toString();
  const $ = cheerio.load(html);
  
  $('a').each((_, el) => {
    const text = $(el).find('.product_thumbnail_caption span').text().trim().toLowerCase();
    const priceText = $(el).find('.price_with_unit_offscreen').text();
    if (text) console.log(`Title: ${text}, Price: ${priceText}`);
  });
}
test();
