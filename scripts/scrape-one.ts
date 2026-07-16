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

import { fetchSnkrdunkPrice } from './price-engine/snkrdunk';
import { fetchJapanesePrice as fetchYuyuteiPrice } from './price-engine/yuyutei';

async function run() {
  const { data: card } = await supabase
    .from('cards')
    .select('id, number, tcgplayer_url, snkrdunk_url, cardrush_url, yuyutei_url, ebay_url')
    .eq('slug', 'op-op01-039')
    .single();

  if (!card) {
    console.error('Card not found');
    return;
  }

  console.log('Found card:', card.number);
  console.log('Scraping Yuyutei...');
  const yuyutei = await fetchYuyuteiPrice(card.yuyutei_url || card.number);
  console.log('Yuyutei Result:', yuyutei);

  console.log('Scraping Snkrdunk...');
  const snkrdunk = await fetchSnkrdunkPrice(card.snkrdunk_url || card.number);
  console.log('Snkrdunk Result:', snkrdunk);
  
  const prices = [];
  if (yuyutei && yuyutei.price) prices.push({ source: 'yuyutei', price: yuyutei.price });
  if (snkrdunk && snkrdunk.price) prices.push({ source: 'snkrdunk', price: snkrdunk.price });

  for (const p of prices) {
    await supabase.from('price_history').insert({
      card_id: card.id,
      price: p.price,
      source: p.source,
      grade: 'raw',
      confidence: 'medium'
    });
    console.log(`Inserted ${p.source} price: ${p.price}`);
  }
  
  console.log('Done!');
}

run();
