import { createScraperClient } from '../../lib/price-engine/db';
import { processCardLockstep, type LockstepCard } from '../../lib/price-engine/lockstep-orchestrator';

function parseArgs() {
  const gameIdx = process.argv.indexOf('--game');
  const game = gameIdx >= 0 ? process.argv[gameIdx + 1] : undefined;

  const setIdx = process.argv.indexOf('--set');
  const set = setIdx >= 0 ? process.argv[setIdx + 1] : undefined;

  const limitIdx = process.argv.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(process.argv[limitIdx + 1], 10) : 25;

  const freshnessHoursIdx = process.argv.indexOf('--freshness-hours');
  const freshnessHours = freshnessHoursIdx >= 0 ? parseInt(process.argv[freshnessHoursIdx + 1], 10) : 24;

  const loop = process.argv.includes('--loop');

  return { game, set, limit, freshnessHours, loop };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SetSummary {
  id: string;
  name: string;
  slug: string;
  release_date: string | null;
  game_slug: string;
  total_cards: number;
  completed_cards: number;
}

/**
 * Finds the highest priority set that has uncompleted cards.
 * Order: release_date DESC NULLS LAST, name ASC
 */
async function findActiveSet(
  db: ReturnType<typeof createScraperClient>,
  gameSlug?: string,
  setSlug?: string,
  freshnessHours: number = 24
): Promise<SetSummary | null> {
  const clauses: string[] = ['1=1'];
  const params: unknown[] = [];

  if (gameSlug) {
    params.push(gameSlug);
    clauses.push(`g.slug = $${params.length}`);
  }

  if (setSlug) {
    params.push(setSlug);
    clauses.push(`s.slug = $${params.length}`);
  }

  // Interval param for freshness barrier
  params.push(`${freshnessHours} hours`);
  const intervalParam = `$${params.length}`;

  const query = `
    SELECT 
      s.id, s.name, s.slug, s.release_date, g.slug as game_slug,
      COUNT(c.id)::int as total_cards,
      COUNT(CASE WHEN c.last_price_fetch IS NOT NULL AND c.last_price_fetch > NOW() - ${intervalParam}::interval THEN 1 END)::int as completed_cards
    FROM sets s
    JOIN games g ON g.id = s.game_id
    JOIN cards c ON c.set_id = s.id
    WHERE ${clauses.join(' AND ')}
    GROUP BY s.id, s.name, s.slug, s.release_date, g.slug
    ORDER BY s.release_date DESC NULLS LAST, s.name ASC
  `;

  const rows = (await db(query, params)) as SetSummary[];
  
  // Find first set that is not 100% complete
  const active = rows.find((s) => s.completed_cards < s.total_cards);
  return active || null;
}

async function runBatch() {
  const { game, set, limit, freshnessHours, loop } = parseArgs();
  const db = createScraperClient();

  console.log('========================================================================');
  console.log('🚀 LOCKSTEP MULTI-SOURCE PRICE SCRAPER (Single-Set Locked Execution)');
  console.log(`- Filter Game:       ${game || 'ALL'}`);
  console.log(`- Filter Set:        ${set || 'AUTO (Newest incomplete set first)'}`);
  console.log(`- Batch Size:        ${limit}`);
  console.log(`- Freshness Window:  ${freshnessHours}h`);
  console.log(`- Loop Mode:         ${loop}`);
  console.log('========================================================================\n');

  do {
    // 1. Identify the current active set to lock onto
    const activeSet = await findActiveSet(db, game, set, freshnessHours);

    if (!activeSet) {
      console.log(`🎉 All sets for game [${game || 'ALL'}] are 100% complete within the ${freshnessHours}h freshness window!`);
      if (loop) {
        console.log('Sleeping 60s before checking queue again...\n');
        await sleep(60000);
        continue;
      } else {
        break;
      }
    }

    const remaining = activeSet.total_cards - activeSet.completed_cards;
    const pct = Math.round((activeSet.completed_cards / activeSet.total_cards) * 100);
    console.log(`\n🔒 [LOCKED SET] [${activeSet.game_slug.toUpperCase()}] ${activeSet.name} (${activeSet.slug})`);
    console.log(`   Release Date: ${activeSet.release_date ? new Date(activeSet.release_date).toISOString().split('T')[0] : 'N/A'}`);
    console.log(`   Progress:     ${activeSet.completed_cards}/${activeSet.total_cards} cards completed (${pct}%) — ${remaining} remaining`);
    console.log('------------------------------------------------------------------------');

    // 2. Fetch cards belonging EXCLUSIVELY to this active set that are not yet fresh
    const cardQuery = `
      SELECT 
        c.id, c.name, c.slug, c.number, c.rarity, c.tcg_player_id, c.print_run_info,
        c.yuyutei_url, c.cardrush_url, c.pricecharting_url, c.snkrdunk_url,
        s.name as set_name, s.slug as set_slug, s.release_date,
        g.slug as game_slug
      FROM cards c
      JOIN sets s ON s.id = c.set_id
      JOIN games g ON g.id = s.game_id
      WHERE s.id = $1
        AND (c.last_price_fetch IS NULL OR c.last_price_fetch <= NOW() - $2::interval)
      ORDER BY c.number ASC, c.last_price_fetch ASC NULLS FIRST
      LIMIT $3
    `;

    const cards = (await db(cardQuery, [
      activeSet.id,
      `${freshnessHours} hours`,
      limit,
    ])) as LockstepCard[];

    if (cards.length === 0) {
      console.log(`Set ${activeSet.name} reached 100% completion! Advancing to next set...\n`);
      continue;
    }

    console.log(`Processing batch of ${cards.length} cards from active set...\n`);

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const lang = card.slug.endsWith('-ja') ? 'JA' : 'EN';
      const prefix = `[${i + 1}/${cards.length}] [${card.game_slug.toUpperCase()}:${lang}] ${card.name} (#${card.number})`;
      process.stdout.write(`${prefix}... `);

      try {
        const result = await processCardLockstep(card, db);
        const timeSec = (result.durationMs / 1000).toFixed(1);
        const sourcesText = result.sourcesFound.length > 0 ? result.sourcesFound.join(', ') : 'none';
        console.log(`✅ [${timeSec}s] Sources: [${sourcesText}], Points: ${result.observationsCount}, Dual-Engine: +${result.dualEngineComps}`);
      } catch (err: any) {
        console.log(`❌ Error: ${err.message}`);
      }

      // Small polite breather between cards (500ms)
      await sleep(500);
    }

    // Brief breather between batches
    await sleep(2000);

  } while (loop);

  console.log('\n🎉 Lockstep queue runner finished!');
  process.exit(0);
}

if (import.meta.main) {
  runBatch().catch((err) => {
    console.error('Fatal error in lockstep runner:', err);
    process.exit(1);
  });
}
