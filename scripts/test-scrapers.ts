import * as cheerio from 'cheerio';
async function run() {
  const tcgr = await fetch('https://tcgrepublic.com/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
  });
  const html = await tcgr.text();
  const $ = cheerio.load(html);
  
  const forms = $('form');
  forms.each((i, el) => {
    if ($(el).attr('action') === '/product/text_search.html') {
      console.log('Method:', $(el).attr('method'));
    }
  });
}
run();
