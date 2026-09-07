import { dbQuery } from "../lib/db/client";
import { resolveAndSyncSet } from "./resolve-and-sync-sets";

async function main() {
  console.log("================================================================");
  console.log("Starting Stage 2: Scarlet & Violet Standard Era Price Sync");
  console.log("================================================================\n");

  const svSets = await dbQuery<{ id: string; name: string; slug: string; missing_count: string; total_cards: string }>(`
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
        s.slug LIKE 'pokemon-sv%' 
        OR s.name ILIKE '%prismatic%'
        OR s.name ILIKE '%surging%'
        OR s.name ILIKE '%stellar%'
        OR s.name ILIKE '%shrouded%'
        OR s.name ILIKE '%twilight%'
        OR s.name ILIKE '%temporal%'
        OR s.name ILIKE '%paldean%'
        OR s.name ILIKE '%paldea%'
        OR s.name ILIKE '%paradox%'
        OR s.name ILIKE '%obsidian%'
        OR s.name ILIKE '%151%'
        OR s.name ILIKE '%scarlet & violet%'
      )
      AND c.slug NOT LIKE '%-ja'
    GROUP BY s.id, s.name, s.slug, s.release_date
    HAVING COUNT(c.id) FILTER (WHERE c.tcg_player_id IS NULL) > 0
    ORDER BY COUNT(c.id) FILTER (WHERE c.tcg_player_id IS NULL) DESC
  `);

  console.log(`Found ${svSets.length} Scarlet & Violet sets with unmapped cards:`);
  console.table(svSets.map(s => ({
    name: s.name,
    slug: s.slug,
    missing: s.missing_count,
    total: s.total_cards
  })));

  for (let i = 0; i < svSets.length; i++) {
    const s = svSets[i];
    console.log(`\n>>> [${i + 1}/${svSets.length}] Syncing: ${s.name} (${s.missing_count} cards missing)...`);
    await resolveAndSyncSet(s.id, s.name, true);
  }

  console.log("\n================================================================");
  console.log("Stage 2: All Scarlet & Violet sets successfully synced!");
  console.log("================================================================");
}

main().catch(console.error);
