import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'] });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchAll(table: string) {
  let allData: any[] = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;

  console.log(`Exporting table: ${table}...`);

  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + step - 1);

    if (error) {
      console.error(`Error fetching ${table}:`, error);
      break;
    }

    if (data && data.length > 0) {
      allData = allData.concat(data);
      from += step;
      if (data.length < step) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  return allData;
}

async function run() {
  const dumpDir = path.join(process.cwd(), 'database-dumps');
  if (!fs.existsSync(dumpDir)) {
    fs.mkdirSync(dumpDir);
  }

  const tables = ['sets', 'cards', 'mappings'];

  for (const table of tables) {
    const data = await fetchAll(table);
    const filePath = path.join(dumpDir, `${table}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Saved ${data.length} rows to ${filePath}`);
  }
  
  // Note: We skip price_history because it's too large and they can re-scrape.
  console.log('Database export complete! (price_history skipped due to size)');
}

run();
