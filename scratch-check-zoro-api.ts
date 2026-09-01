async function run() {
  const HEADERS = {
    'User-Agent': 'Mozilla/5.0',
    'Accept': 'application/json',
  };
  const res = await fetch(`https://snkrdunk.com/en/v1/products/SW---159664/used-listings?perPage=50&page=1&sortType=latest&isOnlyOnSale=false`, { headers: HEADERS });
  const data = await res.json() as any;
  const listings = Array.isArray(data?.usedListings) ? data.usedListings : [];
  
  for (const l of listings) {
    if (Number(l.priceAmount) < 500) {
      console.log(`Found low price: ${l.priceAmount} ${l.currency || ''}, condition: ${l.condition}, sold: ${l.isSold}`);
    }
  }
}
run();
