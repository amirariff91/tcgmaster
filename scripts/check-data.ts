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
  const { data, error } = await supabase.from('price_history').select('source, recorded_at');

  if (error || !data) {
    console.error(error);
    return;
  }

  const counts: Record<string, number> = {};
  const earliest: Record<string, string> = {};

  for (const row of data) {
    counts[row.source] = (counts[row.source] || 0) + 1;
    if (!earliest[row.source] || new Date(row.recorded_at) < new Date(earliest[row.source])) {
      earliest[row.source] = row.recorded_at;
    }
  }

  console.log("Total records:", data.length);
  console.log("Counts per source:");
  for (const [source, count] of Object.entries(counts)) {
     const earliestDate = new Date(earliest[source]);
     const now = new Date();
     const diffDays = Math.ceil(Math.abs(now.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24));
     console.log(`- ${source}: ${count} records (Earliest: ${diffDays} days ago)`);
  }
}
run();
