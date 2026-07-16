import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function run() {
  const { data, error } = await supabase
    .from('cards')
    .select(`
      slug,
      name,
      sets:set_id (
        slug,
        name
      )
    `)
    .eq('slug', 'op-st14-016');
    
  console.log('Result:', JSON.stringify(data, null, 2));
  console.log('Error:', error);
}
run();
