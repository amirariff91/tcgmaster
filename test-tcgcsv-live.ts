import { fetchEnglishPrice } from './scripts/price-engine/tcgcsv';

async function run() {
  console.log("Testing TCGCSV Live Fetching...");

  // We pass 'Romance Dawn' as the set name to help it match OP01
  console.log("--- Base SEC (OP01-120) ---");
  const base = await fetchEnglishPrice('OP01-120', 'Romance Dawn');
  console.log(`Base Price: $${base}`);

  console.log("--- Manga SEC (OP01-120_p2) ---");
  const manga = await fetchEnglishPrice('OP01-120_p2', 'Romance Dawn');
  console.log(`Manga Price: $${manga}`);

  console.log("--- PRB Reprint (OP01-120_r1) ---");
  const prb = await fetchEnglishPrice('OP01-120_r1', 'ONE PIECE CARD THE BEST');
  console.log(`PRB Price: $${prb}`);
}

run();
