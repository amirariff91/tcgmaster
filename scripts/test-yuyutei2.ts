import { fetchJapanesePrice } from './price-engine/yuyutei';
async function run() {
  const price = await fetchJapanesePrice('OP01-120');
  console.log(`Extracted price: $${price}`);
}
run();
