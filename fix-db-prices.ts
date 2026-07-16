import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  console.log("Renaming sets...");
  await supabase.from('sets').update({ name: 'Promo' }).eq('name', 'Promotion Cards');
  await supabase.from('sets').update({ name: 'Promo' }).ilike('name', 'Limited Product%');
  
  console.log("Fetching high-end cards...");
  const { data: cards } = await supabase.from('cards').select('id, slug').or('slug.ilike.%_p2%,slug.ilike.%_p3%,slug.ilike.%_p4%');
  
  if (cards) {
    console.log(`Found ${cards.length} high-end cards. Wiping price history and resetting fetch date...`);
    
    // Process in batches
    for (let i = 0; i < cards.length; i += 50) {
      const batch = cards.slice(i, i + 50).map(c => c.id);
      
      await supabase.from('price_history').delete().in('card_id', batch);
      await supabase.from('cards').update({ 
        last_price_fetch: '1970-01-01T00:00:00Z',
        price_cache_ttl: null 
      }).in('id', batch);
      
      console.log(`Processed batch ${i / 50 + 1}`);
    }
    console.log("Done resetting high-end cards.");
  }
}

run();
