import * as cheerio from 'cheerio';
import * as fs from 'fs';

const html = fs.readFileSync('scripts/cardrush_test.html', 'utf-8');
const $ = cheerio.load(html);

$('.item_data').each((i, el) => {
  const title = $(el).find('.name').text().trim() || $(el).find('a').text().trim();
  const price = $(el).find('.price').text().trim() || $(el).find('.figure').text().trim();
  const image = $(el).find('img').attr('src');
  console.log({title, price, image});
});
