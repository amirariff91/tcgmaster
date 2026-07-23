import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function purgeCorruptedHistory() {
  console.log('🤖 Step 2: Purging corrupted legacy price_history records...');

  // 1. Specific card cleanup for high-value variants with legacy corrupted rows (e.g. op-op08-106_p3-ja, op-op08-106_p4-ja)
  const targetSlugs = [
    'op-op08-106_p3-ja',
    'op-op08-106_p4-ja',
    'op-st01-001_p4-ja',
    'op-op05-119_p3-ja',
    'op-op09-118_p3-ja',
    'op-op12-020_p2-ja',
    'op-eb02-061_p3-ja',
    'op-op12-020_p4-ja',
    'op-op13-118_p4-ja',
  ];

  for (const slug of targetSlugs) {
    const { data: card } = await supabase
      .from('cards')
      .select('id, slug, name')
      .eq('slug', slug)
      .single();

    if (!card) continue;

    // Delete price_history rows where price < 500 on high-value chase cards (> $1000 value)
    const { error: delErr } = await supabase
      .from('price_history')
      .delete()
      .eq('card_id', card.id)
      .lt('price', 500);

    if (!delErr) {
      console.log(`  ✓ Purged legacy outlier price history (< $500) for ${card.slug}`);
    }

    // Reset price_cache to force fresh calculation
    await supabase
      .from('price_cache')
      .delete()
      .eq('card_id', card.id);
  }

  // 2. Global cleanup for Japanese cards: purge price_history rows with price < 0.10 or zero values
  const { error: globalErr } = await supabase
    .from('price_history')
    .delete()
    .lte('price', 0);

  if (!globalErr) {
    console.log('  ✓ Purged invalid zero/negative price_history rows globally.');
  }

  console.log('✅ Price History Cleanup complete!');
}

purgeCorruptedHistory().catch(err => {
  console.error('Fatal cleanup error:', err);
  process.exit(1);
});
