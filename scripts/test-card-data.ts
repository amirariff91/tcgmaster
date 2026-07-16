import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = readFileSync('.env', 'utf-8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
  if (line.includes('=')) {
    const [k, ...v] = line.split('=');
    env[k.trim()] = v.join('=').trim().replace(/^['"](.*)['"]$/, '$1');
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

async function run() {
  const { data: card, error } = await supabase
    .from('cards')
    .select(`
      id,
      name,
      slug,
      image_url,
      sets!inner (
        slug,
        games!inner (
          slug
        )
      ),
      price_history (
        grade,
        price,
        recorded_at
      ),
      price_cache (
        raw_prices,
        graded_prices
      )
    `)
    .eq('slug', 'op-op01-039')
    .single();
    
  console.log('Result:', JSON.stringify(card, null, 2));
}
run();
