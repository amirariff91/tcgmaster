import * as cheerio from 'cheerio';
import * as fs from 'fs';

async function run() {
  const res = await fetch('https://onepiece.limitlesstcg.com/tournaments');
  const html = await res.text();
  fs.writeFileSync('limitless.html', html);
  console.log('Saved to limitless.html');
}

run();
