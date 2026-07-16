import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://mquqwlxqrsvfflsgfhmi.supabase.co', 'sb_publishable_BtBRGcZWKeCUsmL_WsR67w_HbEK6CbH');

async function check() {
  const { data, error } = await supabase.from('cards').select('id, name').limit(5);
  console.log('Cards:', data?.length, error);
}
check();
