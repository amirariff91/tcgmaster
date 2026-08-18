import 'dotenv/config';
import { dbQuery } from '../lib/db/client';
import { getCardImageUrl } from '../lib/images/service';

const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES_MS = 10000; // 10 seconds to respect rate limits
const DELAY_WHEN_IDLE_MS = 60000; // 1 minute when no cards need images

async function run() {
  console.log('🤖 Image Downloader Worker Started');
  console.log(`Config: Batch Size=${BATCH_SIZE}, Delay=${DELAY_BETWEEN_BATCHES_MS}ms`);

  while (true) {
    try {
      // Find cards missing local images
      const cards = await dbQuery<{ id: string; name: string; image_url: string }>(`
        SELECT id, name, image_url
        FROM cards
        WHERE local_image_url IS NULL
          AND image_url IS NOT NULL
        LIMIT $1
      `, [BATCH_SIZE]);

      if (!cards || cards.length === 0) {
        console.log('No cards need image downloading. Idle sleeping for 1m...');
        await new Promise(resolve => setTimeout(resolve, DELAY_WHEN_IDLE_MS));
        continue;
      }

      console.log(`Processing batch of ${cards.length} cards...`);

      for (const card of cards as Array<{ id: string; name: string; image_url: string }>) {
        if (!card.image_url) continue;

        try {
          console.log(`Downloading image for ${card.name} (${card.id})...`);
          const result = await getCardImageUrl(card.id, card.image_url);

          if (result.isLocal) {
            console.log(`  ✓ Successfully stored image: ${result.url}`);
          } else if (result.error) {
            console.warn(`  ! Failed to download: ${result.error}`);
          }
        } catch (err) {
          console.error(`  ✗ Error processing ${card.name}:`, err);
        }

        // Small delay between cards
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`Batch complete. Waiting ${DELAY_BETWEEN_BATCHES_MS / 1000}s before next batch...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
    } catch (loopError) {
      console.error('Unexpected error in worker loop:', loopError);
      await new Promise(resolve => setTimeout(resolve, DELAY_WHEN_IDLE_MS));
    }
  }
}

run().catch(err => {
  console.error('Fatal worker error:', err);
  process.exit(1);
});
