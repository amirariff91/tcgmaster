import { fetchJapanesePrice } from './lib/price-engine/yuyutei';
import { fetchSnkrdunkPrice } from './lib/price-engine/snkrdunk';

async function run() {
  console.log("Testing Variant Scraping Logic...");

  console.log("--- Base SEC (OP01-120) ---");
  const yyBase = await fetchJapanesePrice('OP01-120');
  const sdBase = await fetchSnkrdunkPrice('OP01-120');
  console.log(`Base -> Yuyutei: $${yyBase} | Snkrdunk: $${sdBase}`);

  console.log("--- Manga SEC (OP01-120_p2) ---");
  const yyManga = await fetchJapanesePrice('OP01-120_p2');
  const sdManga = await fetchSnkrdunkPrice('OP01-120_p2');
  console.log(`Manga -> Yuyutei: $${yyManga} | Snkrdunk: $${sdManga}`);

  console.log("--- PRB Reprint (OP01-120_r1) ---");
  const yyReprint = await fetchJapanesePrice('OP01-120_r1');
  const sdReprint = await fetchSnkrdunkPrice('OP01-120_r1');
  console.log(`PRB -> Yuyutei: $${yyReprint} | Snkrdunk: $${sdReprint}`);
}

run();
