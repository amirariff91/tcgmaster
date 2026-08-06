import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function uploadImage(url: string, path: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, error } = await supabase.storage
      .from('card-images')
      .upload(path, buffer, { upsert: true, contentType: url.endsWith('.webp') ? 'image/webp' : 'image/png' });

    if (error) {
      console.error('Error uploading image to storage:', error.message);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('card-images')
      .getPublicUrl(path);

    return publicUrlData.publicUrl;
  } catch (error) {
    return null;
  }
}

async function syncGame(gameSlug: string, dotggGameId: string) {
  console.log(`\n=== SYNCING DOTGG CARDS FOR ${gameSlug.toUpperCase()} ===`);
  const { data: game } = await supabase.from('games').select('id').eq('slug', gameSlug).single();
  if (!game) {
    console.error(`Game ${gameSlug} not found!`);
    return;
  }

  const res = await fetch(`https://api.dotgg.gg/cgfw/getcards?game=${dotggGameId}`);
  if (!res.ok) {
    console.error(`Failed to fetch cards for ${dotggGameId}`);
    return;
  }
  const cards = await res.json();
  console.log(`Found ${cards.length} cards from dotgg.`);

  // First, gather unique sets
  const uniqueSets = new Map<string, string>(); // set code -> raw string
  for (const c of cards) {
    if (!c.wheretoget) continue;
    // e.g. "BOOSTER PACK -DUAL EVOLUTION- [FB09]" or "STARTER DECK -Zoro- [ST-01]"
    const match = c.wheretoget.match(/\[(.*?)\]/);
    if (match) {
      uniqueSets.set(match[1].toLowerCase(), c.wheretoget);
    }
  }

  const setMap = new Map<string, string>(); // set code -> uuid
  for (const [setCode, rawName] of uniqueSets.entries()) {
    const setSlug = `${gameSlug}-${setCode}`;
    let name = rawName.replace(/\[.*?\]/, '').replace(/^(BOOSTER PACK|EXTRA BOOSTER|STARTER DECK)\s*-?/i, '').trim();
    name = `${setCode.toUpperCase()} : ${name}`;

    let { data: set } = await supabase.from('sets').select('id').eq('slug', setSlug).single();
    if (!set) {
      const { data: newSet } = await supabase.from('sets').insert({
        game_id: game.id,
        name,
        slug: setSlug,
        card_count: 0,
        priority: 10
      }).select('id').single();
      set = newSet;
      console.log(`Created new set: ${name}`);
    }
    if (set) setMap.set(setCode, set.id);
  }

  // Fallback set for promos or unknown
  let { data: promoSet } = await supabase.from('sets').select('id').eq('slug', `${gameSlug}-promo`).single();
  if (!promoSet) {
    const { data: newSet } = await supabase.from('sets').insert({
      game_id: game.id,
      name: 'Promotional Cards',
      slug: `${gameSlug}-promo`,
      card_count: 0,
      priority: 10
    }).select('id').single();
    promoSet = newSet;
  }

  let processed = 0;
  for (const c of cards) {
    const rawNumber = c.id; // e.g. "FB09-068_p1"
    const number = c.id_normal || c.id; // "FB09-068"
    if (!rawNumber) continue;

    const cardSlug = `${gameSlug}-${rawNumber.toLowerCase()}`;
    const { data: existing } = await supabase.from('cards').select('id, local_image_url').eq('slug', cardSlug).single();

    let localImageUrl = existing?.local_image_url;
    if (!localImageUrl && c.image) {
      const ext = c.image.endsWith('.webp') ? 'webp' : 'png';
      const path = `${gameSlug}/dotgg/${cardSlug}.${ext}`;
      localImageUrl = await uploadImage(c.image, path);
    }

    let setId = promoSet.id;
    if (c.wheretoget) {
      const match = c.wheretoget.match(/\[(.*?)\]/);
      if (match && setMap.has(match[1].toLowerCase())) {
        setId = setMap.get(match[1].toLowerCase())!;
      }
    }

    const payload = {
      set_id: setId,
      name: c.name || number,
      slug: cardSlug,
      number: rawNumber,
      rarity: c.rarity || '',
      image_url: c.image || null,
      local_image_url: localImageUrl || null
    };

    if (existing) {
      await supabase.from('cards').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('cards').insert(payload);
    }

    processed++;
    if (processed % 100 === 0) console.log(`Processed ${processed}/${cards.length} ${gameSlug} cards`);
  }
}

async function run() {
  await syncGame('dbfw', 'dragonball');
  await syncGame('one-piece', 'onepiece');
  console.log('Dotgg Seed Sync Complete!');
}
run();
