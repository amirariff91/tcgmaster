import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const { data } = await supabase.from('cards').select('id, name, number, snkrdunk_url').eq('slug', 'op-op09-061-ja').single();
  console.log(data);
  
  if (data) {
    await supabase.from('cards').update({
      snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/349446'
    }).eq('id', data.id);
    console.log('Fixed Snkrdunk URL');
    
    // Fix pricecharting mapping
    await supabase.from('card_source_mapping').delete().eq('card_id', data.id).eq('source', 'pricecharting');
    await supabase.from('card_source_mapping').insert({
      card_id: data.id,
      source: 'pricecharting',
      external_id: 'monkeydluffy-op09-061',
      metadata: {
        url: 'https://www.pricecharting.com/game/one-piece-japanese-emperors-in-the-new-world/monkeydluffy-op09-061',
        title: 'Monkey.D.Luffy #OP09-061'
      }
    });
    console.log('Fixed PriceCharting mapping');
  }
}
run();
