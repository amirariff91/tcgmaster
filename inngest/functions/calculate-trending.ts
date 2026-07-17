/**
 * Trending Score Calculation Job
 */

import { inngest } from '../client';
import { updateAllTrendingScores } from '@/lib/pricing/trending';

// Calculate trending scores every 15 minutes
export const calculateTrending = inngest.createFunction(
  {
    id: 'calculate-trending',
    name: 'Calculate Trending Scores',
    // A run currently takes longer than the 15-minute cron interval (measured at 24m+
    // over ~11.6k cards), so without this the scheduler stacks overlapping runs that
    // each re-query the same rows. One at a time: a late run is better than a pile-up.
    concurrency: { limit: 1 },
  },
  { cron: '*/15 * * * *' }, // Every 15 minutes
  async ({ step }) => {
    const result = await step.run('update-trending-scores', async () => {
      return updateAllTrendingScores();
    });

    return result;
  }
);
