async function run() {
  const productCode = 'SW---159664';
  const url = `https://snkrdunk.com/en/v1/products/${productCode}/used-listings?perPage=50&page=1&sortType=latest&isOnlyOnSale=false`;
  
  const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    'Accept': 'application/json',
  };
  
  const res = await fetch(url, { headers: HEADERS });
  const data = await res.json();
  
  const listings = data.usedListings || [];
  const sold = listings.filter((l: any) => l.isSold === true);
  
  console.log("SOLD LISTINGS:", sold.slice(0, 5).map((l: any) => ({
    condition: l.condition,
    price: l.priceAmount,
    currency: l.currency
  })));
}
run();
