import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({path:'.env.local'});
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { error } = await supabase.rpc('query', { query: "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE tablename = 'price_history';" });
  console.log(error);
}
run();
