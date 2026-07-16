import * as cheerio from 'cheerio';

async function run() {
  try {
    const searchUrl = `https://snkrdunk.com/en/search/result?keyword=OP01-120`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    const html = await response.text();
    console.log(html.substring(0, 1000));
    
    // Check what links actually exist on the page
    const $ = cheerio.load(html);
    const links = $('a').map((i, el) => $(el).attr('href')).get();
    console.log(links.filter(l => l && l.includes('products')));
  } catch (err) {}
}
run();
