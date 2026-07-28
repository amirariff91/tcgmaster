import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import {
  checkAlerts,
  sendAlertDigests,
  calculateTrending,
  scrapePopulationData,
  scrapeCardPopulation,
  fetchCardImage,
  batchFetchImages,
  scheduledPokemonImageFetch,
  retryFailedImageFetches,
  syncLimitlessTournaments,
} from '@/inngest/functions';

// Create an API that serves Inngest functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    checkAlerts,
    sendAlertDigests,
    calculateTrending,
    scrapePopulationData,
    scrapeCardPopulation,
    syncLimitlessTournaments,
    // Image fetchers: exported but never registered, so their crons never fired.
    fetchCardImage,
    batchFetchImages,
    scheduledPokemonImageFetch,
    retryFailedImageFetches,
    // NOT registered: scrapePricesJob (inngest/functions/scrape-prices.ts).
    // Its '* * * * *' cron scrapes the same `cards` rows as the PM2 queue-*.ts
    // workers, so enabling it would double-scrape and raise ban risk. Register it
    // only once the PM2-vs-Inngest split is decided.
  ],
});
