import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY; // Service role key

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Based on the apitcg/dragon-ball-fusion-tcg-data repo
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

function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadImage(url: string, path: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Failed to download image ${url}`);
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const { data, error } = await supabase.storage
      .from('card-images')
      .upload(path, buffer, {
        upsert: true,
        contentType: 'image/webp'
      });
      
    if (error) {
      console.error('Error uploading image to storage:', error.message);
      return null;
    }
    
    const { data: publicUrlData } = supabase.storage
      .from('card-images')
      .getPublicUrl(path);
      
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Exception uploading image:', error);
    return null;
  }
}

async function syncLanguage(gameId: string, languageCode: 'en' | 'ja') {
  console.log(`\n=== SYNCING DBFW ${languageCode.toUpperCase()} SETS ===`);
  
  for (const setInfo of DBFW_SETS) {
    console.log(`\n=== Processing Set: ${setInfo.name} (${languageCode}) ===`);
    
    // Insert or Get Set
    let { data: set, error: setError } = await supabase
      .from('sets')
      .select('id')
      .eq('slug', setInfo.slug)
      .single();
      
    if (!set) {
      const { data: newSet, error: insertSetError } = await supabase
        .from('sets')
        .insert({
          game_id: gameId,
          name: `${setInfo.name} [${setInfo.id.toUpperCase()}]`,
          slug: setInfo.slug,
          card_count: setInfo.count,
          priority: 10
        })
        .select('id')
        .single();
        
      if (insertSetError) {
        console.error('Failed to insert set:', insertSetError);
        continue;
      }
      set = newSet;
    }
    
    // Fetch Cards JSON
    const DBFW_URL = `https://raw.githubusercontent.com/apitcg/dragon-ball-fusion-tcg-data/main/cards/${languageCode}/${setInfo.id}.json`;
    console.log(`Downloading DBFW ${setInfo.id} JSON data from ${DBFW_URL}...`);
    
    try {
      const res = await fetch(DBFW_URL);
      if (!res.ok) {
        console.error(`Failed to fetch JSON data for ${setInfo.id}: ${res.status}`);
        continue;
      }
      
      const cards = await res.json();
      console.log(`Found ${cards.length} cards in JSON.`);
      
      let processed = 0;
      for (const card of cards) {
        const code = card.code || card.id;
        if (!code) continue;
        
        console.log(`[${processed + 1}/${cards.length}] Processing ${code} - ${card.name}...`);
        
        const cardSlug = languageCode === 'ja' ? `dbfw-${code.toLowerCase()}-ja` : `dbfw-${code.toLowerCase()}`;
        
        // Check if card exists by SLUG since we have language variants
        const { data: existingCard } = await supabase
          .from('cards')
          .select('id, local_image_url')
          .eq('slug', cardSlug)
          .single();
          
        let localImageUrl = existingCard?.local_image_url;
        
        // Upload image if needed
        if (!localImageUrl && card.images?.large) {
          const storagePath = `dbfw/${setInfo.id}/${cardSlug}.webp`;
          localImageUrl = await uploadImage(card.images.large, storagePath);
        }
        
        let finalName = decodeHtmlEntities(card.name);
        if (languageCode === 'ja') {
          const engSlug = `dbfw-${code.toLowerCase()}`;
          const { data: engCard } = await supabase
            .from('cards')
            .select('name')
            .eq('slug', engSlug)
            .single();
            
          if (engCard && engCard.name) {
            finalName = engCard.name;
          }
        }

        const cardData = {
          set_id: set.id,
          name: finalName,
          slug: cardSlug,
          number: code,
          rarity: card.rarity,
          image_url: localImageUrl || card.images?.large || null,
          local_image_url: localImageUrl || null,
        };
        
        if (existingCard) {
          await supabase.from('cards').update(cardData).eq('id', existingCard.id);
        } else {
          await supabase.from('cards').insert(cardData);
        }
        
        processed++;
        await delay(50); // polite delay
      }
    } catch (e) {
      console.error(`Error processing set ${setInfo.id}:`, e);
    }
  }
}

async function run() {
  console.log('Starting DBFW Full Sync Script...');
  
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('id')
    .eq('slug', 'dbfw')
    .single();
    
  if (gameError || !game) {
    console.error('Failed to find DBFW game in database. Did you run the seed script?');
    process.exit(1);
  }
  
  await syncLanguage(game.id, 'en');
  await syncLanguage(game.id, 'ja');
  
  console.log('\nDBFW Full Sync Complete!');
}

run().catch(console.error);
