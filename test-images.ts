import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function check() {
  const { count: total } = await supabase.from('cards').select('*', { count: 'exact', head: true });
  const { count: withLocal } = await supabase.from('cards').select('*', { count: 'exact', head: true }).not('local_image_url', 'is', null);
  console.log(`Total Cards: ${total}`);
  console.log(`With Local Images: ${withLocal}`);
}

check();
