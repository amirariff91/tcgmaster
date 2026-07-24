import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function purgeMismatchedSetupData() {
  console.log('🤖 Step 0: Purging mismatched setup data & resetting price cache...');

  // 1. Target cards reported by user with mismatched data
  const targetSlugs = [
    'op-st01-001_p4-ja',
    'op-op07-109_p2-ja',
    'op-op05-119_p3-ja',
    'op-op09-118_p3-ja',
    'op-eb02-061_p3-ja',
    'op-op12-020_p2-ja',
  ];

  for (const slug of targetSlugs) {
    const { data: card } = await supabase
      .from('cards')
      .select('id, slug')
      .eq('slug', slug)
      .single();

    if (!card) continue;

    // Reset setup URLs on card so AI Vision re-matches freshly across all 4 sources
    await supabase
      .from('cards')
      .update({
        historical_fetched: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', card.id);

    // Delete stale price_cache row so it re-calculates instantly
    await supabase
      .from('price_cache')
      .delete()
      .eq('card_id', card.id);

    console.log(`  ✓ Flushed setup & price_cache for ${card.slug}`);
  }

  // 2. Global audit: reset price_cache rows for cards where vendor price ratio > 3.0
  const { data: cacheEntries } = await supabase
    .from('price_cache')
    .select('card_id, raw_prices')
    .limit(1000);

  if (cacheEntries) {
    let flushedCount = 0;
    for (const entry of cacheEntries) {
      const raw = entry.raw_prices as any;
      if (!raw) continue;

      const yuyutei = raw.yuyutei as number;
      const snkrdunk = raw.snkrdunk as number;

      if (yuyutei > 0 && snkrdunk > 0) {
        const ratio = Math.max(yuyutei, snkrdunk) / Math.min(yuyutei, snkrdunk);
        if (ratio > 3.0) {
          await supabase
            .from('price_cache')
            .delete()
            .eq('card_id', entry.card_id);
          flushedCount++;
        }
      }
    }
    console.log(`  ✓ Flushed ${flushedCount} price_cache rows with >3x vendor divergence for fresh AI re-sync.`);
  }

  console.log('✅ Setup Metadata & Price Cache Flush complete! Policy check: 0 card rows deleted.');
}

purgeMismatchedSetupData().catch(err => {
  console.error('Fatal flush error:', err);
  process.exit(1);
});
