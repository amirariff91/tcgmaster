import { fetchSnkrdunkPrice } from './lib/price-engine/snkrdunk';

async function run() {
  console.log("Testing Snkrdunk fetch for Manga Shanks (OP01-120):");
  // Exact URL to bypass searching
  const res = await fetchSnkrdunkPrice('https://snkrdunk.com/en/trading-cards/116972');
  console.log(res);
  process.exit(0);
}
run();
