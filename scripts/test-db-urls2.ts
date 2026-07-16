import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import { resolve } from 'path';

const envContent = fs.readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  if (line.includes('=')) {
    const [key, ...values] = line.split('=');
    if (!process.env[key]) {
      process.env[key] = values.join('=').trim().replace(/(^"|"$)/g, '');
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY! || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: cards } = await supabase
    .from('cards')
    .select('number, snkrdunk_url, yuyutei_url')
    .not('snkrdunk_url', 'is', null)
    .limit(10);
  
  console.log(cards);
}

test();
