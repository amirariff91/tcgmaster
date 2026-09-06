async function main() {
  const res = await fetch("https://snkrdunk.com/en/v1/brands/onepiece/streetwears?perPage=20&page=1&department=tradingCard&keyword=OP05-119", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Accept": "application/json"
    }
  });
  const data = await res.json();
  for (const it of (data.streetwears || [])) {
    console.log(it.id, "|", it.productNumber, "|", it.name, "| minPrice:", it.minPrice);
  }
}

main().catch(console.error);
