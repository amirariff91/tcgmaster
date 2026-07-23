import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getCardImageUrl } from '../lib/images/service';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES_MS = 10000; // 10 seconds to respect rate limits
const DELAY_WHEN_IDLE_MS = 60000; // 1 minute when no cards need images

async function run() {
  console.log('🤖 Image Downloader Worker Started');
  console.log(`Config: Batch Size=${BATCH_SIZE}, Delay=${DELAY_BETWEEN_BATCHES_MS}ms`);

  while (true) {
    try {
      // Find cards that have a Bandai/external image_url but NO local_image_url
      const { data: cards, error } = await supabase
        .from('cards')
        .select('id, image_url')
        .is('local_image_url', null)
        .not('image_url', 'is', null)
        // Don't try to download empty strings
        .neq('image_url', '')
        .limit(BATCH_SIZE);

      if (error) {
        console.error('❌ Error fetching cards from Supabase:', error.message);
        await sleep(DELAY_BETWEEN_BATCHES_MS);
        continue;
      }

      if (!cards || cards.length === 0) {
        console.log('✨ All cards have local images! Sleeping for 1 minute...');
        await sleep(DELAY_WHEN_IDLE_MS);
        continue;
      }

      console.log(`📦 Processing batch of ${cards.length} cards...`);

      for (const card of cards) {
        if (!card.image_url) continue;

        try {
          console.log(`-> Fetching image for card ${card.id}: ${card.image_url}`);
          // getCardImageUrl handles the download, Supabase Storage upload, and DB update!
          const result = await getCardImageUrl(card.id, card.image_url, { forceDownload: true });
          
          if (result.error) {
            console.error(`   ❌ Failed to process ${card.id}: ${result.error}`);
          } else {
            console.log(`   ✅ Success! Saved as ${result.url}`);
          }
        } catch (e) {
          console.error(`   ❌ Crash processing ${card.id}:`, e);
        }

        // Small delay between individual cards to be nice to the host server
        await sleep(1000);
      }

      // Delay before the next batch
      console.log(`⏳ Batch complete. Waiting ${DELAY_BETWEEN_BATCHES_MS / 1000}s...`);
      await sleep(DELAY_BETWEEN_BATCHES_MS);
      
    } catch (err) {
      console.error('❌ Fatal error in worker loop:', err);
      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

run();
