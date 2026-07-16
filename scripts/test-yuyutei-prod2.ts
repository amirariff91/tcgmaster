import * as cheerio from 'cheerio';

async function run() {
  const link = 'https://yuyu-tei.jp/sell/opc/card/prb01/10023';
  const prodRes = await fetch(link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const prodHtml = await prodRes.text();
  const $prod = cheerio.load(prodHtml);
  
  console.log("Price element text:", $prod('.price-box').text());
  console.log("Price lhs:", $prod('.lhs.mt-0').text());
}
run();
