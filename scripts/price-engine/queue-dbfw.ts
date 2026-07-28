import { fileURLToPath } from 'node:url';
import { fetchCardrushPrice } from '../../lib/price-engine/cardrush';
import { fetchPriceChartingPrice } from '../../lib/price-engine/pricecharting';
import { assertIdentity } from '../../lib/price-engine/identity';
import {
  SOURCE_CURRENCY,
  type PriceObservation,
} from '../../lib/price-engine/write-path';
import { runScrapeLoop, type WorkerCard, type WorkerConfig } from '../../lib/price-engine/worker';
import { normalizeGrade } from '../../lib/pricing/grades';

export const fetchCard = async (card: WorkerCard): Promise<{
  observations: PriceObservation[];
  cardUpdates?: Record<string, unknown>;
}> => {
  const observations: PriceObservation[] = [];
  const cardUpdates: Record<string, unknown> = {};

  console.log('[DBFW] Fetching from Cardrush...');
  const cardrushResult = await fetchCardrushPrice(card.cardrush_url || card.number);
  if (cardrushResult !== null) {
    observations.push({
      source: 'cardrush',
      grade: normalizeGrade('raw'),
      priceUsd: cardrushResult.price,
      priceNative: null,
      currency: SOURCE_CURRENCY.cardrush,
      evidence: cardrushResult.evidence,
    });
    console.log(`[DBFW] Cardrush: $${cardrushResult.price}`);

    const identity = assertIdentity({ number: card.number, name: card.name }, cardrushResult.evidence);
    if (identity.ok && cardrushResult.url && cardrushResult.url !== card.cardrush_url) {
      cardUpdates.cardrush_url = cardrushResult.url;
    }
  }

  console.log('[DBFW] Fetching from PriceCharting...');
  const priceChartingResult = await fetchPriceChartingPrice(`${card.number} japanese`);
  if (priceChartingResult !== null) {
    observations.push({
      source: 'pricecharting',
      grade: normalizeGrade('raw'),
      priceUsd: priceChartingResult.price,
      priceNative: priceChartingResult.price,
      currency: SOURCE_CURRENCY.pricecharting,
      evidence: priceChartingResult.evidence,
    });
    console.log(`[DBFW] PriceCharting: $${priceChartingResult.price}`);

    if (priceChartingResult.gradedPrice) {
      observations.push({
        source: 'pricecharting',
        grade: normalizeGrade('psa10'),
        priceUsd: priceChartingResult.gradedPrice,
        priceNative: priceChartingResult.gradedPrice,
        currency: SOURCE_CURRENCY.pricecharting,
        evidence: priceChartingResult.evidence,
      });
      console.log(`[DBFW] PriceCharting PSA 10: $${priceChartingResult.gradedPrice}`);
    }
  }

  return { observations, cardUpdates };
};

export const workerConfig: WorkerConfig = {
  label: 'DBFW',
  queueFilter: (q) => q.ilike('slug', 'dbfw-%'),
  fetchCard,
  sleepMs: process.env.SAFE_MODE === '1' ? 40000 : 17000,
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void runScrapeLoop(workerConfig);
}
