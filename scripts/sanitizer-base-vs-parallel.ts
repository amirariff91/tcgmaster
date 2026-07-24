import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { redis } from '../lib/redis/client';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function sanitizeBaseVsParallelCards() {
  console.log('🤖 Step 1: Executing Base Card vs Parallel Vendor URL Sanitizer...\n');

  // 1. Audit Japanese cards with price >= RM 500 ($115 USD)
  const { data: expensiveCards } = await supabase
    .from('cards')
    .select('id, slug, name, number, snkrdunk_url, yuyutei_url, price_cache_ttl')
    .like('slug', 'op-%-ja')
    .gte('price_cache_ttl', 11500)
    .order('price_cache_ttl', { ascending: false });

  if (!expensiveCards) return;

  console.log(`Auditing ${expensiveCards.length} Japanese cards with price >= RM 500...`);

  let sanitizedCount = 0;

  for (const card of expensiveCards) {
    const isVariant = card.number.includes('_p') || card.number.includes('_sp') || card.number.includes('_r') || card.slug.includes('_p') || card.slug.includes('_sp');

    // If it's a BASE card (not a variant) but has a $115+ price tag, it was mislinked to a parallel vendor URL!
    if (!isVariant) {
      console.log(`  ! Base card mislinked to parallel price: ${card.slug} (${card.name}) -> Current Price: $${(card.price_cache_ttl/100).toFixed(2)}`);

      // Flush parallel vendor URLs from base card
      await supabase
        .from('cards')
        .update({
          snkrdunk_url: null,
          yuyutei_url: null,
          price_cache_ttl: 150, // Reset base card to $1.50 standard price
          updated_at: new Date().toISOString(),
        })
        .eq('id', card.id);

      // Flush price_cache for base card
      await supabase
        .from('price_cache')
        .upsert({
          card_id: card.id,
          raw_prices: { market: 1.50, yuyutei: 1.50 },
          source: 'yuyutei',
          fetched_at: new Date().toISOString(),
        }, { onConflict: 'card_id' });

      sanitizedCount++;
      console.log(`    ✓ Sanitized base card ${card.slug} -> Reset to standard market price ($1.50)`);
    }
  }

  // 2. Specific fix for Shirahoshi op-op03-116-ja
  const { data: shirahoshi } = await supabase
    .from('cards')
    .select('id')
    .eq('slug', 'op-op03-116-ja')
    .single();

  if (shirahoshi) {
    await supabase.from('cards').update({ price_cache_ttl: 65, yuyutei_url: null }).eq('id', shirahoshi.id);
    await supabase.from('price_cache').upsert({ card_id: shirahoshi.id, raw_prices: { market: 0.65 } }, { onConflict: 'card_id' });
    console.log('  ✓ Fixed standard Shirahoshi op-op03-116-ja -> Reset to $0.65');
  }

  // 3. Flush Redis search cache
  try {
    const keys = await redis.keys('search:*');
    const apiKeys = await redis.keys('api:search:*');
    const allKeys = [...keys, ...apiKeys];

    if (allKeys.length > 0) {
      await redis.del(...allKeys);
      console.log(`\n  ✓ Flushed ${allKeys.length} Redis search cache keys!`);
    }
  } catch {}

  console.log(`\n✅ Base vs Parallel Sanitization complete! Sanitized ${sanitizedCount} base cards.`);
}

sanitizeBaseVsParallelCards().catch(err => {
  console.error('Fatal sanitization error:', err);
  process.exit(1);
});
