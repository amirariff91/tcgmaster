import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function calculatePrices() {
  console.log('Calculating deck prices...');
  
  // 1. Build a lookup map of the absolute cheapest price for each base card number
  console.log('Fetching all card prices to find cheapest variants...');
  const { data: allCards, error: allCardsError } = await supabase
    .from('cards')
    .select('number, price_cache_ttl')
    .not('price_cache_ttl', 'is', null);

  if (allCardsError) {
    console.error('Error fetching cards:', allCardsError);
    return;
  }

  const minPrices = new Map<string, number>();
  for (const c of (allCards || [])) {
    if (c.price_cache_ttl === null) continue;
    const baseNum = c.number.replace(/[_\-][a-zA-Z]+\d*$/i, '');
    const currentMin = minPrices.get(baseNum) ?? Infinity;
    if (c.price_cache_ttl < currentMin) {
      minPrices.set(baseNum, c.price_cache_ttl);
    }
  }
  console.log(`Built minimum price map for ${minPrices.size} base cards.`);

  let hasMore = true;
  let offset = 0;
  const limit = 50;
  let processed = 0;
  
  while (hasMore) {
    const { data: decks, error } = await supabase
      .from('decks')
      .select('id, total_price')
      .range(offset, offset + limit - 1);
      
    if (error) {
      console.error('Error fetching decks:', error);
      break;
    }
    
    if (!decks || decks.length === 0) {
      hasMore = false;
      break;
    }
    
    for (const deck of decks) {
      const { data: deckCards } = await supabase
        .from('deck_cards')
        .select('count, cards(number, price_cache_ttl)')
        .eq('deck_id', deck.id);
        
      if (!deckCards || deckCards.length === 0) continue;
      
      let totalPrice = 0;
      let hasAnyPrice = false;
      
      for (const dc of deckCards) {
        const card = dc.cards as any;
        if (!card || !card.number) continue;
        
        const baseNum = card.number.replace(/[_\-][a-zA-Z]+\d*$/i, '');
        const minPrice = minPrices.get(baseNum);
        
        if (minPrice !== undefined) {
          totalPrice += (minPrice / 100) * dc.count;
          hasAnyPrice = true;
        } else if (card.price_cache_ttl !== null && card.price_cache_ttl !== undefined) {
          totalPrice += (card.price_cache_ttl / 100) * dc.count;
          hasAnyPrice = true;
        }
      }
      
      if (hasAnyPrice) {
        await supabase
          .from('decks')
          .update({ total_price: totalPrice })
          .eq('id', deck.id);
      }
    }
    
    processed += decks.length;
    offset += limit;
  }
  
  console.log(`Finished calculating prices for ${processed} decks.`);
}

async function run() {
  while (true) {
    await calculatePrices();
    console.log('Sleeping for 60 minutes...');
    await new Promise(resolve => setTimeout(resolve, 60 * 60 * 1000));
  }
}

run();
