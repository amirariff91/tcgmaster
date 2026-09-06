async function test() {
  const code = "OP01-016";
  const url = `https://snkrdunk.com/en/v1/brands/onepiece/streetwears?perPage=20&page=1&department=tradingCard&keyword=${encodeURIComponent(code)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Accept": "application/json"
    }
  });
  const data = await res.json();
  console.log("Items for", code, ":");
  for (const it of (data.streetwears || [])) {
    console.log(`  ${it.id} | ${it.name} | $${it.minPrice}`);
  }
}

test().catch(console.error);
