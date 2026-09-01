async function run() {
  const url = 'https://snkrdunk.com/en/v1/products/SW---159664/used-listings?perPage=50&page=1&sortType=latest&isOnlyOnSale=false';
  const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    'Accept': 'application/json'
  };
  const res = await fetch(url, { headers: HEADERS });
  console.log('Status:', res.status);
  const data = await res.json();
  const listings = data.usedListings || [];
  console.log('Listings count:', listings.length);
  const sold = listings.filter((l: any) => l.isSold).length;
  console.log('Sold count:', sold);
}
run();
