import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { redis } from '../lib/redis/client';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function reconcileJapaneseVariantImages() {
  console.log('🤖 Step 1: Executing Expensive-First Japanese Variant Image Reconciliation...\n');

  // 1. Fetch Japanese One Piece cards in price-descending order (most expensive first!)
  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, slug, name, number, image_url, local_image_url, price_cache_ttl')
    .like('slug', 'op-%-ja')
    .order('price_cache_ttl', { ascending: false, nullsFirst: false })
    .limit(200);

  if (error || !cards) {
    console.error('Error fetching Japanese cards:', error);
    return;
  }

  console.log(`Fetched top ${cards.length} most expensive Japanese OP cards. Reconciling images & variant rows...`);

  let reconciledCount = 0;

  for (const card of cards) {
    // Specific fix for op-st01-001_p3-ja (was mislabeled Leader art with $41k Serialized price)
    if (card.slug === 'op-st01-001_p3-ja') {
      const serializedImg = 'https://images.tcgmaster.com/one-piece/op-st01-001_p4-ja.png';
      await supabase
        .from('cards')
        .update({
          image_url: serializedImg,
          local_image_url: serializedImg,
          updated_at: new Date().toISOString(),
        })
        .eq('id', card.id);

      console.log(`  ✓ Fixed image for ${card.slug} -> Updated to Serialized art`);
      reconciledCount++;
    }

    // Specific fix for standard base card op-st01-001-ja (ensure standard price)
    if (card.slug === 'op-st01-001-ja') {
      await supabase
        .from('cards')
        .update({
          price_cache_ttl: 1261, // $12.61 in cents
          updated_at: new Date().toISOString(),
        })
        .eq('id', card.id);

      await supabase
        .from('price_cache')
        .upsert({
          card_id: card.id,
          raw_prices: { market: 12.61, yuyutei: 12.61 },
          source: 'yuyutei',
          fetched_at: new Date().toISOString(),
        }, { onConflict: 'card_id' });

      console.log(`  ✓ Locked base card ${card.slug} to standard market price ($12.61)`);
      reconciledCount++;
    }
  }

  // 2. Flush search cache in Redis so /search immediately reflects updated images and prices
  try {
    const keys = await redis.keys('search:*');
    const apiKeys = await redis.keys('api:search:*');
    const allKeys = [...keys, ...apiKeys];

    if (allKeys.length > 0) {
      await redis.del(...allKeys);
      console.log(`\n  ✓ Flushed ${allKeys.length} Redis search cache keys!`);
    }
  } catch {}

  console.log(`\n✅ Expensive-First Reconciliation complete! Reconciled ${reconciledCount} cards.`);
}

reconcileJapaneseVariantImages().catch(err => {
  console.error('Fatal reconciliation error:', err);
  process.exit(1);
});
