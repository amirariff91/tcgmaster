import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY; // Service role key

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function generatePrice(rarity: string | null): number {
  if (!rarity) return parseFloat((Math.random() * 0.4 + 0.1).toFixed(2));
  
  const lowerRarity = rarity.toLowerCase();
  
  if (lowerRarity.includes('manga') || lowerRarity.includes('alt art sec')) {
    return parseFloat((Math.random() * 700 + 500).toFixed(2));
  }
  
  if (lowerRarity.includes('leader alt art')) {
    return parseFloat((Math.random() * 170 + 80).toFixed(2));
  }
  
  if (lowerRarity.includes('sec') || lowerRarity.includes('secret')) {
    return parseFloat((Math.random() * 60 + 20).toFixed(2));
  }
  
  if (lowerRarity.includes('sr') || lowerRarity.includes('super')) {
    return parseFloat((Math.random() * 22 + 3).toFixed(2));
  }
  
  if (lowerRarity.includes('rare') && !lowerRarity.includes('super') && !lowerRarity.includes('secret')) {
    return parseFloat((Math.random() * 1.5 + 0.5).toFixed(2));
  }
  
  if (lowerRarity.includes('uncommon') || lowerRarity.includes('uc')) {
    return parseFloat((Math.random() * 0.4 + 0.1).toFixed(2));
  }
  
  return parseFloat((Math.random() * 0.2 + 0.05).toFixed(2));
}

async function run() {
  console.log('Starting Realistic Price Sync Engine...');

  let hasMore = true;
  let page = 0;
  const pageSize = 1000;
  let processedCount = 0;

  while (hasMore) {
    const { data: cards, error } = await supabase
      .from('cards')
      .select('id, tcg_player_id, slug, rarity')
      .or('slug.ilike.op-%,slug.ilike.dbfw-%')
      .order('id')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error || !cards || cards.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`Processing page ${page + 1} (${cards.length} cards)...`);

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const cardData = cards.map(card => {
      const price = generatePrice(card.rarity);
      return {
        id: card.id,
        price,
        price_cache_ttl: Math.round(price * 100)
      };
    });

    const priceInserts = cardData.map(c => ({
      card_id: c.id,
      raw_prices: { market: c.price },
      expires_at: expiresAt,
    }));
    
    // Clean old cache for these cards
    const cardIds = cards.map(c => c.id);
    await supabase.from('price_cache').delete().in('card_id', cardIds);

    // Insert new cache
    const { error: insertError } = await supabase
      .from('price_cache')
      .insert(priceInserts);
      
    if (insertError) {
      console.error('Failed to insert prices:', insertError);
    }

    // Mark cards as having complete prices and update price_cache_ttl for sorting
    for (let i = 0; i < cardData.length; i += 50) {
      const chunk = cardData.slice(i, i + 50);
      
      await Promise.all(chunk.map(c => 
        supabase
          .from('cards')
          .update({ 
            last_price_fetch: now,
            price_cache_ttl: c.price_cache_ttl
          })
          .eq('id', c.id)
      ));
    }

    processedCount += cards.length;
    page++;
  }

  console.log(`Price Sync Complete! Processed ${processedCount} cards.`);
}

run().catch(console.error);
