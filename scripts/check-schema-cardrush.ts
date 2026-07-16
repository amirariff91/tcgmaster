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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY! || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);

async function run() {
  const { data, error } = await supabase.from('cards').select('cardrush_url').limit(1);
  if (error) console.log("Error:", error);
  else console.log("Success! Data:", data);
}
run();
