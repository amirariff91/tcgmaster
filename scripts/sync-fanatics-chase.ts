/**
 * Continuous / Batch Sync for Fanatics Collect Chase & High-Value Cards
 *
 * Targets:
 *  1. One Piece Manga Alternate Arts & SPs
 *  2. Top Pokemon Grails & Alt Arts (Moonbreon, Rayquaza VMAX, Gengar, Charizard, etc.)
 *  3. Any cards with headline_cents >= $50
 *
 * Ingests completed auction comps and live Buy It Now listings into price_history and card_price_current.
 */

import 'dotenv/config';
import { dbQuery } from '../lib/db/client';
import { syncCardFanatics, type SyncCard } from './sync-fanatics-history';

async function main() {
  console.log('==================================================================');
  console.log('Starting Fanatics Collect Ingestion for Top Chase Cards');
  console.log('==================================================================');

  // Query top chase cards across Pokemon and One Piece
  const cards = await dbQuery<SyncCard>(`
    SELECT DISTINCT c.id, c.name, c.number, s.name as set_name
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    JOIN games g ON g.id = s.game_id
    LEFT JOIN card_price_current cpc ON cpc.card_id = c.id
    WHERE (
      -- 1. All One Piece Manga Rares and high-end SPs
      (g.slug = 'one-piece' AND (c.slug LIKE '%_p2%' OR c.slug LIKE '%_p3%' OR c.slug LIKE '%_p4%' OR c.rarity ILIKE '%manga%' OR c.rarity ILIKE '%sec-sp%'))
      OR
      -- 2. Pokemon Top Alt Arts and Grails
      (g.slug = 'pokemon' AND (
        c.rarity ILIKE '%Secret Rare%'
        OR c.rarity ILIKE '%Special Illustration Rare%'
        OR c.rarity ILIKE '%Illustration Rare%'
        OR c.rarity ILIKE '%Rare Shining%'
        OR c.rarity ILIKE '%Rare Holo Star%'
        OR c.name ILIKE '%Charizard%'
        OR c.name ILIKE '%Umbreon%'
        OR c.name ILIKE '%Rayquaza%'
        OR c.name ILIKE '%Gengar%'
        OR c.name ILIKE '%Lugia%'
        OR c.name ILIKE '%Giratina%'
        OR c.name ILIKE '%Pikachu%'
      ))
      OR
      -- 3. Any card priced >= $50 in current market
      (cpc.headline_cents >= 5000)
    )
    ORDER BY c.name ASC
    LIMIT 300;
  `);

  console.log(`Identified ${cards.length} high-value grail cards for Fanatics sync.\n`);

  let totalHistoryPoints = 0;
  let totalActiveListings = 0;
  let successCount = 0;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    process.stdout.write(`[${i + 1}/${cards.length}] ${card.name} #${card.number} (${card.set_name})... `);

    try {
      const res = await syncCardFanatics(card);
      if (res.historicalCount > 0 || res.activeCount > 0) {
        successCount++;
        totalHistoryPoints += res.historicalCount;
        totalActiveListings += res.activeCount;
        console.log(`✓ Added ${res.historicalCount} sales comps, ${res.activeCount} live listings`);
      } else {
        console.log(`No matching Fanatics comps`);
      }
    } catch (err: any) {
      console.log(`Error: ${err.message}`);
    }

    // Rate limiting pacing (300ms between searches)
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n==================================================================');
  console.log('Fanatics Collect Chase Sync Finished!');
  console.log(`- Cards with data: ${successCount} / ${cards.length}`);
  console.log(`- Total historical comps: ${totalHistoryPoints}`);
  console.log(`- Total live listings: ${totalActiveListings}`);
  console.log('==================================================================');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error in Fanatics sync:', err);
  process.exit(1);
});
