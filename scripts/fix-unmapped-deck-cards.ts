import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function main() {
  console.log('Fetching unmapped deck cards...');
  let hasMore = true;
  let offset = 0;
  const limit = 1000;
  
  let mappedCount = 0;
  
  while (hasMore) {
    const { data: deckCards, error } = await supabase
      .from('deck_cards')
      .select('id, deck_id, raw_card_id_string, raw_card_name')
      .is('card_id', null)
      .range(offset, offset + limit - 1);
      
    if (error) {
      console.error('Error fetching deck_cards:', error);
      break;
    }
    
    if (!deckCards || deckCards.length === 0) {
      hasMore = false;
      break;
    }
    
    console.log(`Processing batch of ${deckCards.length} unmapped cards... (offset: ${offset})`);
    
    for (const dc of deckCards) {
      const numberToSearch = dc.raw_card_name || dc.raw_card_id_string;
      if (!numberToSearch) continue;
      
      const { data: matchedCards } = await supabase
        .from('cards')
        .select('id, rarity')
        .ilike('number', `${numberToSearch}%`)
        .limit(1);
        
      if (matchedCards && matchedCards.length > 0) {
        const cardId = matchedCards[0].id;
        const rarity = matchedCards[0].rarity;
        
        await supabase
          .from('deck_cards')
          .update({ card_id: cardId })
          .eq('id', dc.id);
          
        mappedCount++;
        
        if (rarity === 'Leader' || rarity === 'L') {
          await supabase
            .from('decks')
            .update({ leader_card_id: cardId })
            .eq('id', dc.deck_id);
          console.log(`Found Leader for deck ${dc.deck_id}: ${cardId}`);
        }
      }
    }
    
    offset += limit;
  }
  
  console.log(`Finished mapping. Successfully mapped ${mappedCount} cards.`);
}
main();
