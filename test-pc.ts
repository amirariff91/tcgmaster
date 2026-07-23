import { fetchPriceChartingPrice } from './lib/price-engine/pricecharting';

async function main() {
  const res = await fetchPriceChartingPrice('OP08-084 japanese');
  console.log('PC Result:', res);
  process.exit(0);
}
main();
