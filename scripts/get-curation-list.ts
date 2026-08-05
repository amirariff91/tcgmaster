import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: ['.env.local', '.env'] });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, slug, name, number, snkrdunk_url, curation_status, rarity')
    .like('slug', 'op-%')
    .like('slug', '%-ja')
    .like('number', '%\\_p%');

  if (error) {
    console.error(error);
    return;
  }

  // Get mappings to see if pricecharting is missing
  const { data: mappings } = await supabase
    .from('card_source_mapping')
    .select('card_id, source')
    .in('card_id', cards.map(c => c.id));
    
  const mappedPC = new Set(mappings?.filter(m => m.source === 'pricecharting').map(m => m.card_id));

  const curationList = cards.filter(c => c.curation_status === 'pending' || !c.snkrdunk_url || !mappedPC.has(c.id));
  
  console.log(`Total variants: ${cards.length}`);
  console.log(`Needs curation: ${curationList.length}`);
  
  // Just dump the first 50 to see
  console.log(curationList.slice(0, 10).map(c => `${c.slug} (${c.name})`));
}

run();
