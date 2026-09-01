async function verifyUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    return res.status === 200;
  } catch (e) {
    return false;
  }
}

async function main() {
  const url = 'https://www.pricecharting.com/game/one-piece-japanese-romance-dawn/shanks-alternate-art-manga-op01-120';
  console.log('Testing Shanks:', url);
  const exists = await verifyUrl(url);
  console.log('Exists?', exists);
}
main();
