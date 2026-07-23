import { fetchSnkrdunkPrice } from './lib/price-engine/snkrdunk';

async function main() {
  const url = 'https://snkrdunk.com/en/trading-cards/265745?slide=right&query_id=c683dd7b-a7d4-4647-8629-1dbe27e74f83';
  const result = await fetchSnkrdunkPrice(url);
  console.log('Result:', result);
  process.exit(0);
}
main();
