import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY! || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Starting purge of variant mappings...");

  // 1. Fetch all variant cards (slug contains '_')
  const { data: variantCards, error: fetchError } = await supabase
    .from('cards')
    .select('id, slug, tcg_player_id')
    .like('slug', '%_%')
    .not('tcg_player_id', 'is', null);

  if (fetchError) {
    console.error("Failed to fetch variant cards:", fetchError);
    return;
  }

  if (!variantCards || variantCards.length === 0) {
    console.log("No mapped variant cards found.");
    return;
  }

  console.log(`Found ${variantCards.length} variant cards with mappings to purge.`);

  const cardIds = variantCards.map(c => c.id);

  // 2. Clear tcg_player_id and reset price fetch times
  console.log("Clearing tcg_player_id from cards table in batches...");
  for (let i = 0; i < cardIds.length; i += 100) {
    const batch = cardIds.slice(i, i + 100);
    const { error: updateError } = await supabase
      .from('cards')
      .update({ 
        tcg_player_id: null,
        last_price_fetch: null,
        price_cache_ttl: null
      })
      .in('id', batch);

    if (updateError) {
      console.error(`Failed to clear card mappings for batch ${i}:`, updateError);
    }
  }

  // 3. Delete bad historical data and cache for these cards
  console.log("Attempting to delete corrupted price history and cache in batches...");
  let delErrorOccurred = false;
  for (let i = 0; i < cardIds.length; i += 100) {
    const batch = cardIds.slice(i, i + 100);
    
    // Clear price_cache table
    await supabase.from('price_cache').delete().in('card_id', batch);

    const { error: delError } = await supabase
      .from('price_history')
      .delete()
      .in('card_id', batch);

    if (delError) {
      delErrorOccurred = true;
      if (i === 0) {
        console.log("Could not delete from price_history (might not exist or have schema differences):", delError.message);
        break; // if it fails on the first batch, don't try the rest
      }
    }
  }
  
  if (!delErrorOccurred) {
    console.log("Successfully purged historical prices and cache for variant cards.");
  }

  console.log("Purge complete!");
}

run();
