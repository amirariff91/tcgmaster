import { fetchSnkrdunkPrice } from './lib/price-engine/snkrdunk';

async function main() {
  const url = 'https://snkrdunk.com/en/trading-cards/265720?slide=right&query_id=4cb67750-7a57-4ad7-9f9a-a89cdf956e5c';
  const result = await fetchSnkrdunkPrice(url);
  console.log('Result:', result);
  process.exit(0);
}
main();
