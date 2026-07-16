import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const sql = `
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS tcgplayer_url TEXT;
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS snkrdunk_url TEXT;
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS yuyutei_url TEXT;
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS cardrush_url TEXT;
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS ebay_url TEXT;
  `;
  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.log("RPC failed, trying psql or standard query directly...", error);
  } else {
    console.log("Schema updated with URL columns!");
  }
}
run();
