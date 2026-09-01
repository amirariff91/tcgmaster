/**
 * Population Data Scraping Job
 */

import { inngest } from '../client';
import { dbQuery } from '@/lib/db/client';
import { scrapePopulation } from '@/lib/scrapers/gemrate';

// Scrape population data weekly
export const scrapePopulationData = inngest.createFunction(
  {
    id: 'scrape-population',
    name: 'Scrape Population Data',
  },
  { cron: '0 3 * * 0' }, // Weekly on Sunday at 3 AM
  async ({ step }) => {
    // Get high-value cards that need population updates
    const cards = await step.run('fetch-cards', async () => {
      return await dbQuery(
        `SELECT c.id, c.name, s.name AS set_name
         FROM cards c
         JOIN sets s ON s.id = c.set_id
         ORDER BY c.created_at DESC
         LIMIT 100`,
      ) as Array<{ id: string; name: string; set_name: string }>;
    });

    if (cards.length === 0) {
      return { scraped: 0, message: 'No cards to scrape' };
    }

    let scraped = 0;
    const errors: string[] = [];

    // Scrape in small batches with delays
    for (let i = 0; i < cards.length; i += 5) {
      const batch = cards.slice(i, i + 5);

      await step.run(`scrape-batch-${i}`, async () => {
        for (const card of batch) {
          try {
            const setName = card.set_name || '';

            const result = await scrapePopulation(card.name, setName, 'psa');
            if (result) {
              scraped++;
            }
          } catch (err) {
            errors.push(`${card.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
      });

      // Longer delay between batches to avoid rate limiting
      if (i + 5 < cards.length) {
        await step.sleep('rate-limit', '5s');
      }
    }

    return {
      scraped,
      errors: errors.slice(0, 10),
      message: `Scraped ${scraped} population reports`,
    };
  }
);

// Scrape population for a specific card (on-demand)
export const scrapeCardPopulation = inngest.createFunction(
  {
    id: 'scrape-card-population',
    name: 'Scrape Card Population',
  },
  { event: 'cards/scrape-population' },
  async ({ event, step }) => {
    const { cardId, cardName, setName, gradingCompany } = event.data;

    const result = await step.run('scrape-population', async () => {
      return scrapePopulation(
        cardName,
        setName,
        gradingCompany || 'psa'
      );
    });

    return {
      cardId,
      success: !!result,
      populations: result?.populations || [],
    };
  }
);
