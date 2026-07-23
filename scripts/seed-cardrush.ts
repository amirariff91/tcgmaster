import { createClient } from '@supabase/supabase-js';
import { storeCardImage } from '../lib/images/r2';
import { fetchCardrushData } from './price-engine/cardrush';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY; // Service role key

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadImage(url: string, path: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Failed to download image ${url}`);
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    return await storeCardImage({ key: path, body: buffer, contentType: 'image/jpeg', supabase, bucket: 'card-images' });
  } catch (error) {
    console.error('Exception uploading image:', error);
    return null;
  }
}

async function run() {
  console.log('Starting DBFW Cardrush Seed Script...');

  // 1. Fetch all DBFW English cards
  const { data: engCards, error: fetchError } = await supabase
    .from('cards')
    .select('*')
    .ilike('slug', 'dbfw-%')
    .not('slug', 'ilike', '%-ja'); // Exclude already Japanese ones if any exist

  if (fetchError || !engCards) {
    console.error('Failed to fetch DBFW English cards', fetchError);
    return;
  }

  console.log(`Found ${engCards.length} English DBFW cards to process.`);

  let processed = 0;
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
      console.log(`[${processed}/${engCards.length}] Skipping ${engCard.number} - already exists.`);
      continue;
    }

    console.log(`[${processed}/${engCards.length}] Fetching Cardrush data for ${engCard.number}...`);
    
    // 3. Scrape Cardrush
    const cardrushData = await fetchCardrushData(engCard.number);
    
    if (!cardrushData.imageUrl && !cardrushData.priceUsd) {
      console.log(`  No data found on Cardrush for ${engCard.number}.`);
      continue;
    }

    // 4. Upload image to Supabase if we got one
    let localImageUrl: string | null = null;
    if (cardrushData.imageUrl) {
      console.log(`  Downloading image from Cardrush...`);
      // Infer set code from slug e.g. dbfw-fb01-001 -> fb01
      const setCodeMatch = engCard.slug.match(/dbfw-([^-]+)-/);
      const setCode = setCodeMatch ? setCodeMatch[1] : 'promo';
      const imagePath = `dbfw/${setCode}/${jaSlug}.jpg`;
      localImageUrl = await uploadImage(cardrushData.imageUrl, imagePath);
    }

    // 5. Insert the Japanese card variant
    const newCardData = {
      set_id: engCard.set_id, // Perfect translation mapping!
      name: engCard.name,     // Perfect translation mapping!
      slug: jaSlug,
      number: engCard.number,
      rarity: engCard.rarity,
      tcg_player_id: null,    // MUST BE NULL for Japanese
      image_url: localImageUrl || cardrushData.imageUrl || null,
      local_image_url: localImageUrl || null,
      description: engCard.description,
      lore: engCard.lore,
      price_cache_ttl: cardrushData.priceUsd ? Math.round(cardrushData.priceUsd * 100) : null,
      last_price_fetch: new Date().toISOString()
    };

    const { data: insertedCard, error: insertError } = await supabase
      .from('cards')
      .insert(newCardData)
      .select('id')
      .single();

    if (insertError || !insertedCard) {
      console.error(`  Error inserting Japanese variant for ${engCard.number}:`, insertError);
    } else {
      console.log(`  Successfully inserted Japanese variant: ${jaSlug}`);
      
      // Seed initial price into price_history
      if (cardrushData.priceUsd) {
        await supabase.from('price_history').insert({
          card_id: insertedCard.id,
          price: cardrushData.priceUsd,
          source: 'cardrush',
        });
      }
    }
    
    // Polite delay for Cardrush servers
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('DBFW Cardrush Seed Complete!');
}

run();
