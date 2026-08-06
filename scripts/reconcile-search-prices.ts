import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function reconcileSearchPrices() {
  console.log('🤖 Reconciling corrupted price_cache_ttl values to ensure they are strictly raw prices...');

  // Find all cards where price_cache_ttl is set
  let processed = 0;
  let fixed = 0;
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: cards, error } = await supabase
      .from('cards')
      .select('id, slug, name, price_cache_ttl')
      .not('price_cache_ttl', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error || !cards || cards.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`Processing batch ${page + 1} (${cards.length} cards)...`);

    for (const card of cards) {
      processed++;

      // Get the absolute latest RAW price for this card
      const { data: rawHistory } = await supabase
        .from('price_history')
        .select('price')
        .eq('card_id', card.id)
        .eq('grade', 'raw')
        .order('recorded_at', { ascending: false })
        .limit(1);

      if (rawHistory && rawHistory.length > 0) {
        const rawPrice = rawHistory[0].price;
        const targetTtl = Math.round(rawPrice * 100);

        if (card.price_cache_ttl !== targetTtl) {
          console.log(`[FIX] ${card.slug} (${card.name}): Updating price_cache_ttl from ${card.price_cache_ttl} to ${targetTtl} (Raw Price: $${rawPrice})`);

          await supabase
            .from('cards')
            .update({ price_cache_ttl: targetTtl })
            .eq('id', card.id);

          fixed++;
        }
      } else {
        // If it has NO raw prices at all in history, but has a price_cache_ttl, we should probably clear it out
        // to strictly enforce RAW prices only on the search page.
        if (card.price_cache_ttl !== null) {
          console.log(`[CLEAR] ${card.slug} (${card.name}): Clearing price_cache_ttl (was ${card.price_cache_ttl}) because NO raw history exists.`);
          await supabase
            .from('cards')
            .update({ price_cache_ttl: null })
            .eq('id', card.id);
          fixed++;
        }
      }
    }
    page++;
  }

  console.log(`\n✅ Reconciliation Complete! Processed ${processed} cards, fixed ${fixed} corrupted prices.`);
}

reconcileSearchPrices().catch(console.error);
