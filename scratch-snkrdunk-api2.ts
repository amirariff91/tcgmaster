async function run() {
  const productCode = 'SW---159664';
  const url = `https://snkrdunk.com/en/v1/products/${productCode}`;
  const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  };
  const res = await fetch(url, { headers: HEADERS });
  const data = await res.json();
  console.log(data.product ? data.product.name : 'Not found');
}
run();
