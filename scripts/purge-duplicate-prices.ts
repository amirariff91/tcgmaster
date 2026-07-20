import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  console.log("Starting safe duplicate price purge...");

  let page = 0;
  const pageSize = 5000;
  let hasMore = true;
  let totalDeleted = 0;

  // We will maintain the seen set across pages to ensure we catch all duplicates even if they cross page boundaries
  const seen = new Set<string>();

  while (hasMore) {
    console.log(`Fetching price history page ${page + 1}...`);
    // Order by card_id and recorded_at to group them
    const { data, error } = await supabase
      .from('price_history')
      .select('id, card_id, source, grade, recorded_at')
      .order('card_id')
      .order('recorded_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error("Failed to load price history", error);
      return;
    }

    if (data && data.length > 0) {
      const toDelete: string[] = [];

      for (const entry of data) {
        // Create a unique key: card_id + source + grade + YYYY-MM-DD
        const dateString = entry.recorded_at.split('T')[0];
        const uniqueKey = `${entry.card_id}_${entry.source}_${entry.grade}_${dateString}`;

        if (seen.has(uniqueKey)) {
          // It's a duplicate, mark for deletion
          toDelete.push(entry.id);
        } else {
          // Keep the first one we see (which is the newest due to descending sort)
          seen.add(uniqueKey);
        }
      }

      if (toDelete.length > 0) {
        console.log(`Found ${toDelete.length} duplicates in page ${page + 1}. Deleting...`);
        // Delete in batches of 1000
        for (let i = 0; i < toDelete.length; i += 1000) {
          const batch = toDelete.slice(i, i + 1000);
          const { error: delError } = await supabase
            .from('price_history')
            .delete()
            .in('id', batch);
          
          if (delError) {
            console.error(`Failed to delete batch:`, delError);
          } else {
            totalDeleted += batch.length;
          }
        }
      }

      page++;
    } else {
      hasMore = false;
    }
  }

  console.log(`\nDuplicate Purge Complete!`);
  console.log(`Total duplicate entries safely removed: ${totalDeleted}`);
}

run().catch(console.error);
