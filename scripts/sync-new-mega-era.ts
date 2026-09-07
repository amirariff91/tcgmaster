import { dbQuery } from "../lib/db/client";
import { resolveAndSyncSet } from "./resolve-and-sync-sets";

async function main() {
  console.log("================================================================");
  console.log("Starting Stage 1: The New MEGA Era (2025 - 2026) Price Sync");
  console.log("================================================================\n");

  // Priority list of New Mega Era sets (English & Japanese)
  const megaSets = await dbQuery<{ id: string; name: string; slug: string; missing_count: string; total_cards: string }>(`
    SELECT 
      s.id,
      s.name,
      s.slug,
      COUNT(c.id) FILTER (WHERE c.tcg_player_id IS NULL) as missing_count,
      COUNT(c.id) as total_cards
    FROM sets s
    JOIN cards c ON c.set_id = s.id
    WHERE s.game_id = '18653911-4af3-4697-8fab-93b9c73aa97d'
      AND (
        s.slug LIKE 'pokemon-me%' 
        OR s.slug LIKE 'pokemon-m1%' 
        OR s.slug LIKE 'pokemon-m2%' 
        OR s.slug LIKE 'pokemon-m3%' 
        OR s.slug LIKE 'pokemon-m4%' 
        OR s.slug LIKE 'pokemon-m5%' 
        OR s.slug LIKE 'pokemon-m6%' 
        OR s.slug = 'pokemon-m-p-ja'
        OR s.slug = 'pokemon-mc-ja'
      )
    GROUP BY s.id, s.name, s.slug, s.release_date
    HAVING COUNT(c.id) FILTER (WHERE c.tcg_player_id IS NULL) > 0
    ORDER BY s.release_date ASC
  `);

  console.log(`Found ${megaSets.length} New Mega Era sets with unmapped cards:`);
  console.table(megaSets.map(s => ({
    name: s.name,
    slug: s.slug,
    missing: s.missing_count,
    total: s.total_cards
  })));

  for (let i = 0; i < megaSets.length; i++) {
    const s = megaSets[i];
    console.log(`\n>>> [${i + 1}/${megaSets.length}] Syncing: ${s.name} (${s.missing_count} cards missing)...`);
    await resolveAndSyncSet(s.id, s.name, true);
  }

  console.log("\n================================================================");
  console.log("Stage 1: All New Mega Era sets successfully synced!");
  console.log("================================================================");
}

main().catch(console.error);
