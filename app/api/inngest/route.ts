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
    // Price scraping is owned by the PM2 queue-*.ts workers (scrapers app), not
    // Inngest. The old scrapePricesJob/syncPrices functions were deleted with the
    // price_cache table they wrote to.
  ],
});
