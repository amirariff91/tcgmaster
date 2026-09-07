import { pool } from "../lib/db/client";
import { syncDualEngineSales } from "./sync-tcgplayer-dual-engine";

async function main() {
  console.log("==================================================================");
  console.log("Starting Dual-Engine Price Sync for newly linked English Pokemon sets");
  console.log("==================================================================");

  // Fetch cards that have tcg_player_id but haven't fetched price yet
  const cardsRes = await pool.query(`
    SELECT c.id, c.name, c.number, c.slug, c.tcg_player_id, s.name as set_name
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    JOIN games g ON g.id = s.game_id
    WHERE g.slug = 'pokemon' 
      AND s.slug NOT LIKE '%-ja%'
      AND c.tcg_player_id IS NOT NULL
      AND (c.last_price_fetch IS NULL OR c.price_cache_ttl IS NULL)
    ORDER BY s.release_date DESC NULLS LAST, c.number ASC
  `);

  const cards = cardsRes.rows;
  console.log(`Found ${cards.length} English Pokemon cards ready for price ingestion.`);

  let successCount = 0;
  let historyPointsCount = 0;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    process.stdout.write(`[${i + 1}/${cards.length}] ${card.set_name} - ${card.name} (#${card.number})... `);

    try {
      const result = await syncDualEngineSales(card.id, card.tcg_player_id);
      if (result.finalPrice) {
        successCount++;
        historyPointsCount += result.insertedHistoryCount;
        console.log(`$${result.finalPrice.toFixed(2)} (${result.insertedHistoryCount} history points)`);
      } else {
        console.log(`No active sales`);
      }
    } catch (err: any) {
      console.log(`Error: ${err.message}`);
    }

    // Polite rate limiting (150ms between cards)
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  console.log("\n==================================================================");
  console.log(`Sync Completed!`);
  console.log(`- Cards priced: ${successCount} / ${cards.length}`);
  console.log(`- Historical price points inserted: ${historyPointsCount}`);
  console.log("==================================================================");
}

if (import.meta.main) {
  main().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
