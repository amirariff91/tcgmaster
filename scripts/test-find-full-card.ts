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
  const { data, error } = await supabase
    .from('cards')
    .select(`
      name,
      slug,
      image_url,
      sets!inner (
        name,
        slug,
        games!inner (
          slug
        )
      ),
      price_history!inner (
        id
      )
    `)
    .not('image_url', 'is', null)
    .limit(5);
    
  if (error) {
    console.error(error);
  } else {
    data.forEach(d => {
       console.log(`URL: /${d.sets.games.slug}/${d.sets.slug}/${d.slug} - Name: ${d.name} (${d.price_history.length} price records)`);
    });
  }
}
run();
