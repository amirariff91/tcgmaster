async function run() {
  const url = 'https://www.pricecharting.com/game/one-piece-japanese-wings-of-the-captain/roronoa-zoro-alternate-art-manga-op06-118';
  const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5'
  };
  const res = await fetch(url, { headers: HEADERS });
  console.log('Status:', res.status);
  const html = await res.text();
  console.log('HTML preview (first 500 chars):');
  console.log(html.substring(0, 500));
  
  // Check if it's Cloudflare
  if (html.includes('Cloudflare') || html.includes('Just a moment')) {
    console.log('\nResult: CLOUDFLARE BLOCKED');
  } else if (html.includes('id="used_price"')) {
    console.log('\nResult: SUCCESSFUL FETCH');
  } else {
    console.log('\nResult: UNKNOWN RESPONSE');
  }
}
run();
