/**
 * Dual-Engine 1-Year Historical Price Sync for English One Piece
 *
 * Ingests:
 *  1. 52-week annual history points from TCGPlayer Infinite API.
 *  2. Up to 30 most recent completed order transactions from TCGPlayer marketplace.
 *  3. Updates card_price_current headline and price_history accurately.
 */

import 'dotenv/config';
import { pool } from '../lib/db/client';
import { syncDualEngineSales } from './sync-tcgplayer-dual-engine';

async function main() {
  console.log('==================================================================');
  console.log('Starting Dual-Engine 1-Year History Ingestion for English One Piece');
  console.log('==================================================================');

  // Query all English One Piece cards mapped to TCGPlayer
  const cardsRes = await pool.query(`
    SELECT c.id, c.name, c.number, c.slug, c.tcg_player_id, s.name as set_name
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    JOIN games g ON g.id = s.game_id
    WHERE g.slug = 'one-piece'
      AND c.slug NOT LIKE '%-ja%'
      AND c.tcg_player_id IS NOT NULL
    ORDER BY s.release_date DESC NULLS LAST, c.number ASC;
  `);

  const cards = cardsRes.rows;
  console.log(`Found ${cards.length} English One Piece cards ready for 1-year history ingestion.\n`);

  let successCount = 0;
  let totalHistoryPoints = 0;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    process.stdout.write(`[${i + 1}/${cards.length}] ${card.set_name} - ${card.name} (#${card.number})... `);

    try {
      const result = await syncDualEngineSales(card.id, card.tcg_player_id);
      if (result.finalPrice) {
        successCount++;
        totalHistoryPoints += result.insertedHistoryCount;
        console.log(`$${result.finalPrice.toFixed(2)} (${result.insertedHistoryCount} history points)`);
      } else {
        console.log(`No active sales`);
      }
    } catch (err: any) {
      console.log(`Error: ${err.message}`);
    }

    // Polite rate limiting (150ms between requests)
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  console.log('\n==================================================================');
  console.log('English One Piece 1-Year History Sync Completed!');
  console.log(`- Cards priced: ${successCount} / ${cards.length}`);
  console.log(`- Historical price points inserted: ${totalHistoryPoints}`);
  console.log('==================================================================');
  process.exit(0);
}

if (import.meta.main) {
  main().catch(err => {
    console.error('Fatal error in English One Piece dual-engine sync:', err);
    process.exit(1);
  });
}
