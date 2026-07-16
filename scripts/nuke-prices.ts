import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  console.log("Deleting all price_cache...");
  const { error } = await supabase.from('price_cache').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log("Deleted", error);
}

run();
