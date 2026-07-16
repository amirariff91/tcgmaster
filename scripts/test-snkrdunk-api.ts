async function run() {
  const query = 'OP01-120';
  console.log(`Searching SNKRDUNK internal API for: ${query}`);
  
  try {
    // Try a few common SNKRDUNK internal API endpoints
    const urls = [
      `https://snkrdunk.com/v1/search?keyword=${query}`,
      `https://snkrdunk.com/api/v1/search?keyword=${query}`,
      `https://snkrdunk.com/v1/products?keyword=${query}`,
    ];
    
    for (const url of urls) {
      console.log(`\nTrying ${url}...`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      console.log(`Status: ${response.status}`);
      if (response.ok) {
        const text = await response.text();
        console.log(`Data: ${text.substring(0, 200)}`);
      }
    }
  } catch (err) {}
}

run();
