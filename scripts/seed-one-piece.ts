import { createClient } from '@supabase/supabase-js';
import { storeCardImage } from '../lib/images/r2';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY; // Service role key

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const TRANSLATIONS: Record<string, string> = {
  "ファミリーデッキセット": "Family Deck Set",
  "限定商品収録カード": "Limited Product Cards",
  "プロモーションカード": "Promotion Cards",
  "ST-31 : 赤 モンキー・D・ルフィ": "ST-31 : Red Monkey.D.Luffy",
  "ST-32 : 緑 ロロノア・ゾロ": "ST-32 : Green Roronoa Zoro",
  "ST-33 : 青 クザン": "ST-33 : Blue Kuzan",
  "ST-34 : 紫 シャーロット・カタクリ": "ST-34 : Purple Charlotte Katakuri",
  "ST-35 : 赤黒 サボ": "ST-35 : Red/Black Sabo",
  "ST-36 : 黄 ユースタス・キッド": "ST-36 : Yellow Eustass Kid",
  "OP-14 : 蒼海の七傑": "OP-14 : The Azure Sea's Seven",
  "OP-15 : 神の島の冒険": "OP-15 : Adventure on God's Island",
};

function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function formatSetName(rawTitle: string): string {
  const match = rawTitle.match(/\[(.*?)\]|【(.*?)】/);
  let code = match ? (match[1] || match[2]) : null;
  
  let name = rawTitle.replace(/\[.*?\]|【.*?】/, '').trim();
  name = name.replace(/^(BOOSTER PACK|EXTRA BOOSTER|PREMIUM BOOSTER|STARTER DECK(?: EX)?|ULTRA DECK)\s*-?/i, '');
  name = name.replace(/^(ブースターパック|エクストラブースター|プレミアムブースター|スタートデッキ|アルティメットデッキ)\s*/, '');
  name = name.replace(/^-+|-+$/g, '').trim();
  
  if (!name) {
     name = rawTitle.replace(/\[.*?\]|【.*?】/, '').trim();
  }
  
  let finalName = code ? `${code} : ${name}` : name;
  
  // Remove trailing BOOSTER PACK if it ended up like OP15-EB04 : BOOSTER PACK
  if (finalName.includes("BOOSTER PACK")) {
    finalName = finalName.replace("BOOSTER PACK", "").replace(" : ", "").trim();
  }
  
  if (TRANSLATIONS[finalName]) {
    finalName = TRANSLATIONS[finalName];
  }
  
  return finalName;
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
    
    // R2 (preferred) or Supabase Storage fallback — same object key on both.
    return await storeCardImage({ key: path, body: buffer, contentType: 'image/png', supabase, bucket: 'card-images' });
  } catch (error) {
    console.error('Exception uploading image:', error);
    return null;
  }
}

async function syncLanguage(gameId: string, language: 'english' | 'japanese') {
  const PACKS_URL = `https://raw.githubusercontent.com/buhbbl/punk-records/main/${language}/packs.json`;
  const DATA_BASE_URL = `https://raw.githubusercontent.com/buhbbl/punk-records/main/${language}/data`;
  
  console.log(`\n=== SYNCING ${language.toUpperCase()} SETS ===`);
  const packsRes = await fetch(PACKS_URL);
  if (!packsRes.ok) {
    console.error(`Failed to fetch packs.json for ${language}`);
    return;
  }
  const packs = await packsRes.json();
  const packIds = Object.keys(packs);
  console.log(`Found ${packIds.length} sets to process for ${language}.`);
  
  for (const packId of packIds) {
    const pack = packs[packId];
    // Match anything in [ ] or 【 】
    const match = pack.raw_title.match(/\[(.*?)\]|【(.*?)】/);
    const extractedCode = match ? (match[1] || match[2]) : null;
    
    // Fallback to packId if regex fails
    const setSlug = `op-${(extractedCode || packId).toLowerCase()}`;
    const setName = formatSetName(pack.raw_title);
    
    console.log(`\n=== Processing Set: ${setName} (${language}) ===`);
    
    // Insert or Get Set
    let { data: set, error: setError } = await supabase
      .from('sets')
      .select('id')
      .eq('slug', setSlug)
      .single();
      
    if (!set) {
      const { data: newSet, error: insertSetError } = await supabase
        .from('sets')
        .insert({
          game_id: gameId,
          name: setName,
          slug: setSlug,
          card_count: 0, 
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
    const setUrl = `${DATA_BASE_URL}/${packId}.json`;
    console.log(`Downloading cards for ${packId}...`);
    
    try {
      const res = await fetch(setUrl);
      if (!res.ok) {
        console.error(`Failed to fetch JSON data for ${packId}: ${res.status}`);
        continue;
      }
      
      const cards = await res.json();
      console.log(`Found ${cards.length} cards in JSON.`);
      
      let processed = 0;
      for (const card of cards) {
        const code = card.id;
        if (!code) continue;
        
        console.log(`[${processed + 1}/${cards.length}] Processing ${code} - ${card.name}...`);
        
        // Define exact slugs and IDs based on language
        const cardSlug = language === 'japanese' ? `op-${code.toLowerCase()}-ja` : `op-${code.toLowerCase()}`;
        
        // Check if card exists by slug
        const { data: existingCard } = await supabase
          .from('cards')
          .select('id, local_image_url')
          .eq('slug', cardSlug)
          .single();
          
        let localImageUrl = existingCard?.local_image_url;
        
        const imageUrl = card.img_full_url || card.img_url || card.image_url;
        
        // If image doesn't exist locally, upload it
        if (!localImageUrl && imageUrl) {
          console.log(`  Downloading image for ${code}...`);
          const imagePath = `one-piece/${cardSlug}.png`;
          localImageUrl = await uploadImage(imageUrl, imagePath);
          await new Promise(r => setTimeout(r, 500)); // Rate limit
        }
        
        let finalName = decodeHtmlEntities(card.name);
        
        // If syncing Japanese, lookup English name from database
        if (language === 'japanese') {
          const engSlug = `op-${code.toLowerCase()}`;
          const { data: engCard } = await supabase
            .from('cards')
            .select('name')
            .eq('slug', engSlug)
            .single();
            
          if (engCard && engCard.name) {
            finalName = engCard.name;
          } else {
            // Fallback: try stripping variant suffix to find base English card
            const baseCode = code.split('_')[0];
            const { data: baseCard } = await supabase
              .from('cards')
              .select('name')
              .eq('slug', `op-${baseCode.toLowerCase()}`)
              .single();
            if (baseCard && baseCard.name) {
              finalName = baseCard.name;
            }
            // If still Japanese text, it will be translated by fix-japanese-names.ts run separately
          }
        }

        const cardData = {
          set_id: set.id,
          name: finalName,
          slug: cardSlug,
          number: code,
          rarity: card.rarity || 'common',
          description: card.effects ? decodeHtmlEntities(card.effects.join('\n')) : null,
          image_url: imageUrl,
          local_image_url: localImageUrl,
          lore: card.type || null,
        };
        
        if (existingCard) {
          await supabase.from('cards').update(cardData).eq('id', existingCard.id);
        } else {
          await supabase.from('cards').insert(cardData);
        }
        
        processed++;
      }
    } catch (err) {
      console.error(`Error processing set ${packId}:`, err);
    }
  }
}

async function run() {
  console.log('Starting One Piece Full Sync Script...');
  
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('id')
    .eq('slug', 'one-piece')
    .single();
    
  if (gameError || !game) {
    console.error('Failed to find One Piece game in database.');
    process.exit(1);
  }
  
  await syncLanguage(game.id, 'english');
  await syncLanguage(game.id, 'japanese');
  
  console.log('One Piece Sync Complete!');
}

run();
