import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import { resolve } from 'path';

const envContent = fs.readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  if (line.includes('=')) {
    const [key, ...values] = line.split('=');
    if (!process.env[key]) {
      process.env[key] = values.join('=').trim().replace(/(^"|"$)/g, '');
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY! || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching all cards...');
  
  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, number, name, tcgplayer_url, snkrdunk_url, yuyutei_url, cardrush_url');

  if (error || !cards) {
    console.error('Error fetching cards:', error);
    return;
  }

  console.log(`Found ${cards.length} cards. Updating missing URLs...`);

  let count = 0;
  for (const card of cards) {
    if (!card.number) continue;
    
    // Basic formatting for One Piece (e.g. OP01-120)
    const formattedNumber = card.number.toUpperCase();
    
    // Snkrdunk URL
    const snkrdunkUrl = card.snkrdunk_url || `https://snkrdunk.com/en/search/result?keyword=${formattedNumber}`;
    // Yuyutei URL
    const yuyuteiUrl = card.yuyutei_url || `https://yuyu-tei.jp/sell/opc/s/search?search_word=${formattedNumber}`;
    // Cardrush URL
    const cardrushUrl = card.cardrush_url || `https://www.cardrush-onepiece.jp/product-list?keyword=${formattedNumber}`;
    // TCGPlayer search URL fallback
    const tcgplayerUrl = card.tcgplayer_url || `https://www.tcgplayer.com/search/all/product?q=${formattedNumber}&view=grid`;

    if (!card.snkrdunk_url || !card.yuyutei_url || !card.cardrush_url || !card.tcgplayer_url) {
      await supabase
        .from('cards')
        .update({
          snkrdunk_url: snkrdunkUrl,
          yuyutei_url: yuyuteiUrl,
          cardrush_url: cardrushUrl,
          tcgplayer_url: tcgplayerUrl,
        })
        .eq('id', card.id);
        
      count++;
      if (count % 10 === 0) console.log(`Updated ${count} cards...`);
    }
  }

  console.log(`Successfully mapped URLs for ${count} cards!`);
}

run().catch(console.error);
