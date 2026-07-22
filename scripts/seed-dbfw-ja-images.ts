import { createClient } from '@supabase/supabase-js';
import { storeCardImage } from '../lib/images/r2';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY; // Service role key

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const DBFW_SETS = [
  { id: 'fb01', name: 'Awakened Pulse', slug: 'dbfw-fb01', count: 163 },
  { id: 'fb02', name: 'Blazing Aura', slug: 'dbfw-fb02', count: 164 },
  { id: 'fb03', name: 'Raging Roar', slug: 'dbfw-fb03', count: 164 },
  { id: 'fb04', name: 'Ultra Limit', slug: 'dbfw-fb04', count: 165 },
  { id: 'fs01', name: 'Starter Deck: Son Goku', slug: 'dbfw-fs01', count: 16 },
  { id: 'fs02', name: 'Starter Deck: Vegeta', slug: 'dbfw-fs02', count: 16 },
  { id: 'fs03', name: 'Starter Deck: Broly', slug: 'dbfw-fs03', count: 16 },
  { id: 'fs04', name: 'Starter Deck: Frieza', slug: 'dbfw-fs04', count: 16 },
  { id: 'fs05', name: 'Starter Deck: Bardock', slug: 'dbfw-fs05', count: 16 },
  { id: 'promotion', name: 'Promotional Cards', slug: 'dbfw-promo', count: 50 },
];

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadImage(url: string, path: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  [X] Failed to download image from ${url}`);
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    return await storeCardImage({ key: path, body: buffer, contentType: 'image/webp', supabase, bucket: 'card-images' });
  } catch (error) {
    console.error('  [X] Exception uploading image:', error);
    return null;
  }
}

async function run() {
  console.log('Starting DBFW Japanese Image Backfill Script...');

  for (const setInfo of DBFW_SETS) {
    console.log(`\n======================================================`);
    console.log(`Processing Set: ${setInfo.name} (${setInfo.id})`);
    console.log(`======================================================`);
    
    const DBFW_URL = `https://raw.githubusercontent.com/apitcg/dragon-ball-fusion-tcg-data/main/cards/en/${setInfo.id}.json`;
    console.log(`Downloading English JSON data from ${DBFW_URL}...`);
    
    try {
      const res = await fetch(DBFW_URL);
      if (!res.ok) {
        console.error(`Failed to fetch JSON data for ${setInfo.id}: ${res.status}`);
        continue;
      }
      
      const cards = await res.json();
      console.log(`Found ${cards.length} cards in JSON.\n`);
      
      let processed = 0;
      let success = 0;

      for (const card of cards) {
        processed++;
        const code = card.code || card.id;
        if (!code) continue;
        
        // Japanese slug
        const jaSlug = `dbfw-${code.toLowerCase()}-ja`;
        
        // Check if we have this Japanese card in the database
        const { data: existingCard } = await supabase
          .from('cards')
          .select('id, image_url, local_image_url')
          .eq('slug', jaSlug)
          .single();
          
        if (!existingCard) {
          // Card doesn't exist in DB (e.g. promo not yet scraped), skip
          continue;
        }

        // Get the English image URL from the JSON
        let originalImgUrl = card.images?.large || card.images?.small;
        if (!originalImgUrl) {
          console.log(`[${processed}/${cards.length}] ${jaSlug} - No image found in JSON.`);
          continue;
        }
        
        // ** THE MAGIC FIX ** 
        // Replace '/en/' with '/jp/' to fetch the official Japanese image!
        const jpImgUrl = originalImgUrl.replace('/en/', '/jp/');
        
        console.log(`[${processed}/${cards.length}] Uploading: ${jaSlug}`);
        console.log(`  Source: ${jpImgUrl}`);
        
        const storagePath = `dbfw/${setInfo.id}/${jaSlug}.webp`;
        const localImageUrl = await uploadImage(jpImgUrl, storagePath);
        
        if (localImageUrl) {
          // Update the database with the new, high-quality Japanese image
          const { error: updateError } = await supabase
            .from('cards')
            .update({
              image_url: localImageUrl,
              local_image_url: localImageUrl,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingCard.id);
            
          if (updateError) {
            console.error(`  [X] Failed to update DB for ${jaSlug}:`, updateError);
          } else {
            success++;
            console.log(`  [OK] Saved to DB!`);
          }
        }
        
        await delay(100); // 100ms throttle to prevent overwhelming Supabase
      }
      
      console.log(`\nFinished ${setInfo.id}: successfully uploaded ${success} images.`);
      
    } catch (err) {
      console.error(`Error processing set ${setInfo.id}:`, err);
    }
  }

  console.log('\nAll done! Japanese DBFW cards should now have ultra-high quality official images.');
}

run().catch(console.error);
