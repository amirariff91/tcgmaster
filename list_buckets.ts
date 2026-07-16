import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function check() {
  const { data, error } = await supabase.storage.listBuckets();
  console.log(data, error);
}
check();
