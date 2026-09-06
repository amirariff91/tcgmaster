import * as fs from 'fs';
import * as cheerio from 'cheerio';

const html = fs.readFileSync('/tmp/pc_shanks.html', 'utf-8');
const $ = cheerio.load(html);

console.log("Search table rows:", $('table#games_table tbody tr').length);
$('table#games_table tbody tr').each((i, el) => {
  const title = $(el).find('td.title a').text().trim();
  const href = $(el).find('td.title a').attr('href');
  const consoleName = $(el).find('td.console a').text().trim();
  console.log(`[${i}] Title: "${title}" | Set: "${consoleName}" | Link: ${href}`);
});
