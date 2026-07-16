import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const ids = [
    '320c47b7-6f0c-4bd9-91c7-beb6188291eb',
    'fda063a1-7e8d-4a79-a418-e57ef30d12e2',
    'c4320972-e781-4e47-88fe-80df40ef2293',
    'a7a21cb3-facb-42bd-a779-1da7a699bf82'
  ];
  const { data, error } = await supabase.from('prices').select('*').in('card_id', ids).order('timestamp', { ascending: false }).limit(20);
  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
}
run();
