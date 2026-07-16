import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const badCards = [
    { bad: 'op-op05-119_p7', good: 'op-op05-119_p1' },
    { bad: 'op-op05-119_p8', good: 'op-op05-119_p1' },
    { bad: 'op-op05-119_r2', good: 'op-op05-119_p2' },
  ];
  
  // First, find the IDs for the good and bad cards
  const allSlugs = badCards.flatMap(c => [c.bad, c.good]);
  const { data: cards } = await supabase.from('cards').select('id, slug').in('slug', allSlugs);
  
  const idMap: Record<string, string> = {};
  cards?.forEach(c => idMap[c.slug] = c.id);
  
  for (const mapping of badCards) {
    const badId = idMap[mapping.bad];
    const goodId = idMap[mapping.good];
    
    if (badId && goodId) {
      // Reassign price history
      console.log(`Moving history from ${mapping.bad} to ${mapping.good}`);
      const { data, error } = await supabase.from('price_history')
        .update({ card_id: goodId })
        .eq('card_id', badId);
        
      if (error) console.error(error);
      else console.log('Done moving price history');
    }
  }
}
run();
