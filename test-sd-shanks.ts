import { fetchSnkrdunkPrice } from './lib/price-engine/snkrdunk';
async function run() {
  const result = await fetchSnkrdunkPrice('https://snkrdunk.com/en/trading-cards/93520'); // OP01-120 Shanks Base
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
run();
