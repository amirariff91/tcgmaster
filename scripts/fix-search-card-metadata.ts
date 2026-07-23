import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixCardMetadata() {
  console.log('🤖 Fixing card names and images for search page accuracy...');

  // 1. Fix Carrot name for OP07-109_p2-ja
  await supabase
    .from('cards')
    .update({ name: 'Carrot (Alternate Art)', updated_at: new Date().toISOString() })
    .eq('slug', 'op-op07-109_p2-ja');
  console.log('  ✓ Updated op-op07-109_p2-ja name -> Carrot (Alternate Art)');

  // 2. Ensure price_cache uses Raw price as primary market price for search results
  const { data: JapaneseCards } = await supabase
    .from('cards')
    .select('id, slug')
    .like('slug', 'op-%-ja');

  if (JapaneseCards) {
    for (const card of JapaneseCards) {
      const { data: cache } = await supabase
        .from('price_cache')
        .select('raw_prices, graded_prices')
        .eq('card_id', card.id)
        .single();

      if (cache) {
        const raw = cache.raw_prices as any;
        const rawVal = raw?.nearMint ?? raw?.market ?? raw?.yuyutei ?? raw?.snkrdunk ?? raw?.tcgplayer ?? raw?.cardrush ?? null;
        if (rawVal && rawVal > 0) {
          // Update price_cache_ttl column (stored in cents) to raw price
          await supabase
            .from('cards')
            .update({ price_cache_ttl: Math.round(rawVal * 100) })
            .eq('id', card.id);
        }
      }
    }
    console.log(`  ✓ Updated price_cache_ttl cents column for ${JapaneseCards.length} Japanese cards to prioritize Raw prices.`);
  }

  console.log('✅ Metadata & Price TTL alignment complete!');
}

fixCardMetadata().catch(console.error);
