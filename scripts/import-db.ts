import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'] });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function insertAll(table: string, data: any[]) {
  console.log(`Importing ${data.length} rows into ${table}...`);
  const chunkSize = 500;
  
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk);
    if (error) {
      console.error(`Error inserting chunk into ${table}:`, error);
    } else {
      console.log(`Inserted chunk ${i} to ${i + chunk.length}`);
    }
  }
}

async function run() {
  const dumpDir = path.join(process.cwd(), 'database-dumps');
  if (!fs.existsSync(dumpDir)) {
    console.error('database-dumps folder not found! Please ensure export-db.ts was run successfully.');
    process.exit(1);
  }

  // Import order is critical for foreign keys: sets -> cards -> mappings
  const tables = ['sets', 'cards', 'mappings'];

  for (const table of tables) {
    const filePath = path.join(dumpDir, `${table}.json`);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      await insertAll(table, data);
    } else {
      console.warn(`File ${filePath} not found. Skipping ${table}...`);
    }
  }

  console.log('Database import complete!');
}

run();
