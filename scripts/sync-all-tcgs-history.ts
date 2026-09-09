import { pool } from "../lib/db/client";
import { syncDualEngineSales } from "./sync-tcgplayer-dual-engine";

/**
 * Universal 6-Month Historical Data Ingestion Worker
 * 
 * Ingests 26 weekly historical points + latest completed sales transactions
 * for cards across ALL TCGs (Pokemon, One Piece, Dragon Ball Fusion World, Riftbound)
 * and ALL languages (English, Japanese, regional) that currently have flat or sparse charts (<= 3 points).
 */
async function main() {
  console.log("==================================================================");
  console.log("🚀 Starting Universal 6-Month Historical Ingestion (All TCGs & All Languages)");
  console.log("==================================================================");

  // Fetch all cards with valid TCGPlayer product IDs that have <= 3 price points
  const cardsRes = await pool.query(`
    SELECT c.id, c.name, c.number, c.slug, c.tcg_player_id, 
           s.name as set_name, g.slug as game_slug,
           COALESCE(ph_stats.pts, 0) as current_points
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    JOIN games g ON g.id = s.game_id
    LEFT JOIN LATERAL (
      SELECT count(*)::int as pts 
      FROM price_history ph 
      WHERE ph.card_id = c.id
    ) ph_stats ON true
    WHERE c.tcg_player_id IS NOT NULL 
      AND (ph_stats.pts IS NULL OR ph_stats.pts <= 3)
    ORDER BY 
      CASE 
        WHEN c.slug = 'pokemon-pmcg6-061-ja' THEN 1 -- Giovanni's Machamp top priority
        WHEN g.slug = 'riftbound' THEN 2
        WHEN s.name LIKE '%PRB%' THEN 3
        WHEN c.slug LIKE '%-ja' THEN 4
        ELSE 5
      END,
      s.release_date DESC NULLS LAST,
      c.number ASC
  `);

  const cards = cardsRes.rows;
  console.log(`\n📋 Found ${cards.length} cards across all TCGs needing 6-month historical backfill.`);

  const byGame = cards.reduce((acc: Record<string, number>, c) => {
    acc[c.game_slug] = (acc[c.game_slug] || 0) + 1;
    return acc;
  }, {});
  console.log("Breakdown by Game:", byGame);

  let successCount = 0;
  let historyPointsCount = 0;
  let failedCount = 0;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const prefix = `[${i + 1}/${cards.length}] [${card.game_slug.toUpperCase()}] ${card.set_name} - ${card.name} (#${card.number})`;
    process.stdout.write(`${prefix}... `);

    try {
      const result = await syncDualEngineSales(card.id, card.tcg_player_id);
      if (result.finalPrice) {
        successCount++;
        historyPointsCount += result.insertedHistoryCount;
        console.log(`✅ $${result.finalPrice.toFixed(2)} (+${result.insertedHistoryCount} 6M points, ${result.salesCount} txs)`);
      } else {
        console.log(`⚪ No active sales comps on TCGPlayer`);
      }
    } catch (err: any) {
      failedCount++;
      console.log(`❌ Error: ${err.message}`);
    }

    // Polite rate limiting (150ms between API requests)
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  console.log("\n==================================================================");
  console.log(`🎉 Universal Sync Completed!`);
  console.log(`- Cards successfully processed: ${successCount} / ${cards.length}`);
  console.log(`- Historical price points inserted: ${historyPointsCount}`);
  console.log(`- Failed/Errors: ${failedCount}`);
  console.log("==================================================================");
}

if (import.meta.main) {
  main().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
