import * as cheerio from 'cheerio';

async function run() {
  const query = 'OP01-120';
  console.log(`Searching SNKRDUNK for: ${query}`);
  
  try {
    const searchUrl = `https://snkrdunk.com/en/search/result?keyword=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch SNKRDUNK: ${response.status} ${response.statusText}`);
      return;
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // SNKRDUNK search results list items
    const firstResult = $('a[href*="/products/"]').first();
    if (!firstResult.length) {
      console.log('No results found.');
      return;
    }
    
    const url = 'https://snkrdunk.com' + firstResult.attr('href');
    const name = firstResult.find('p').first().text();
    const priceText = firstResult.find('.price').text() || firstResult.find('.product-card-price').text() || firstResult.text(); // I'll just print out the raw text of the result card
    
    console.log(`Found result!`);
    console.log(`URL: ${url}`);
    console.log(`Raw Card Text: ${firstResult.text().substring(0, 150).replace(/\s+/g, ' ')}`);
    
    // Now fetch the actual product page
    console.log(`\nFetching product page: ${url}`);
    const productResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    
    const productHtml = await productResponse.text();
    const $p = cheerio.load(productHtml);
    
    // Find the latest transaction price
    const salesList = $p('.history-list li, .latest-transaction-list li').first().text();
    console.log(`First Sale Row Text: ${salesList.replace(/\s+/g, ' ')}`);
    
  } catch (err) {
    console.error("Error scraping:", err);
  }
}

run();
