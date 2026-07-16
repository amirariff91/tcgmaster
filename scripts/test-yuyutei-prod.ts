import * as cheerio from 'cheerio';

async function run() {
  const searchUrl = 'https://yuyu-tei.jp/sell/opc/s/search?search_word=OP01-120';
  const res = await fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const firstProd = $('.card-product').first();
  let link = firstProd.find('a').attr('href');
  if (link && !link.startsWith('http')) link = 'https://yuyu-tei.jp' + link;
  
  console.log("Found link:", link);
  
  if (link) {
    const prodRes = await fetch(link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const prodHtml = await prodRes.text();
    const $prod = cheerio.load(prodHtml);
    
    // Yuyutei price on product page
    const priceText = $prod('strong.price, .price, .sell-price').text();
    console.log("Price text on product page:", priceText);
    
    $prod('*:contains("円")').each((_, el) => {
      if ($prod(el).children().length === 0) {
        console.log("Candidate class:", $prod(el).parent().attr('class'), "Text:", $prod(el).text());
      }
    });
  }
}
run();
