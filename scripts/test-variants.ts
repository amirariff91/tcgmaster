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
  const { data: set } = await supabase.from('sets').select('id, name').eq('slug', 'op-prb-01').single();
  console.log('Set:', set);
  
  const { data: cards } = await supabase.from('cards').select('id, name, number, rarity, slug').eq('set_id', set?.id).limit(10);
  console.log('Cards in PRB-01:', cards);
  
  // also check if any card ends with _p1 or similar in op-op01
  const { data: altCards } = await supabase.from('cards').select('id, name, number, rarity, slug').ilike('slug', 'op-op01-120%');
  console.log('All OP01-120 variants:', altCards);
}

run();
