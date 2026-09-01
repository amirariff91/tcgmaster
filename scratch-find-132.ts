async function run() {
  const res = await fetch(`https://snkrdunk.com/en/v1/products/SW---159664/used-listings?perPage=200&page=1&sortType=latest&isOnlyOnSale=false`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const data = await res.json() as any;
  const listings = Array.isArray(data?.usedListings) ? data.usedListings : [];
  
  for (const l of listings) {
    if (l.priceAmount == 132) {
      console.log(`FOUND 132: condition=${l.condition}, sold=${l.isSold}, id=${l.listingUID}`);
    }
  }
}
run();
