import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY; // Service role key

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Starting Safe DBFW Japanese Seed Script...');

  // 1. Fetch all DBFW English cards
  const { data: engCards, error: fetchError } = await supabase
    .from('cards')
    .select('*')
    .ilike('slug', 'dbfw-%')
    .not('slug', 'ilike', '%-ja'); 

  if (fetchError || !engCards) {
    console.error('Failed to fetch DBFW English cards', fetchError);
    return;
  }

  console.log(`Found ${engCards.length} English DBFW cards to process.`);

  let processed = 0;
  let inserted = 0;
  for (const engCard of engCards) {
    processed++;
    const jaSlug = `${engCard.slug}-ja`;

    // 2. Check if Japanese variant already exists
    const { data: existingJaCard } = await supabase
      .from('cards')
      .select('id')
      .eq('slug', jaSlug)
      .single();

    if (existingJaCard) {
      continue;
    }

    console.log(`[${processed}/${engCards.length}] Creating Japanese variant for ${engCard.number}...`);
    
    // 3. Insert the Japanese card variant (NO images fetched to prevent rate limits)
    const newCardData = {
      set_id: engCard.set_id,
      name: engCard.name,
      slug: jaSlug,
      number: engCard.number,
      rarity: engCard.rarity,
      tcg_player_id: null,    // MUST BE NULL for Japanese
      image_url: null,        // Skipping images for now
      local_image_url: null,  // Skipping images for now
      description: engCard.description,
      lore: engCard.lore,
      price_cache_ttl: null,
      last_price_fetch: null  // Set to null so the price scraper picks it up immediately
    };

    const { data: insertedCard, error: insertError } = await supabase
      .from('cards')
      .insert(newCardData)
      .select('id')
      .single();

    if (insertError || !insertedCard) {
      console.error(`  Error inserting Japanese variant for ${engCard.number}:`, insertError);
    } else {
      inserted++;
    }
  }

  console.log(`DBFW Japanese Safe Seed Complete! Inserted ${inserted} new Japanese variants.`);
}

run();
