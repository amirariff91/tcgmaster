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
  },
  { cron: '*/15 * * * *' }, // Every 15 minutes
  async ({ step }) => {
    const result = await step.run('update-trending-scores', async () => {
      return updateAllTrendingScores();
    });

    return result;
  }
);
