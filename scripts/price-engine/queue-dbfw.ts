import { fileURLToPath } from 'node:url';
import { fetchCardrushByAnchor } from '../../lib/price-engine/cardrush';
import { fetchPriceChartingByAnchor } from '../../lib/price-engine/pricecharting';
import type { SourceMapping } from '../../lib/price-engine/mapping';
import {
  SOURCE_CURRENCY,
  type PriceObservation,
} from '../../lib/price-engine/write-path';
import { runScrapeLoop, type WorkerCard, type WorkerConfig } from '../../lib/price-engine/worker';
import { normalizeGrade } from '../../lib/pricing/grades';

export const fetchCard = async (card: WorkerCard, mappings: SourceMapping[]): Promise<{
  observations: PriceObservation[];
  cardUpdates?: Record<string, unknown>;
}> => {
  const observations: PriceObservation[] = [];
  const cardUpdates: Record<string, unknown> = {};

  const cardrushMapping = mappings.find((mapping) => mapping.source === 'cardrush');
  if (!cardrushMapping?.externalUrl) {
    console.log('[DBFW] cardrush: no mapping, skipped');
  } else {
    console.log(`[DBFW] Fetching from Cardrush anchor ${cardrushMapping.externalUrl}...`);
    const cardrushResult = await fetchCardrushByAnchor(cardrushMapping.externalUrl);
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
    }
  }

  const priceChartingMapping = mappings.find((mapping) => mapping.source === 'pricecharting');
  if (!priceChartingMapping?.externalUrl) {
    console.log('[DBFW] pricecharting: no mapping, skipped');
  } else {
    console.log(`[DBFW] Fetching from PriceCharting anchor ${priceChartingMapping.externalUrl}...`);
    const priceChartingResult = await fetchPriceChartingByAnchor(priceChartingMapping.externalUrl);
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

      if (priceChartingResult.gradedPrices) {
        for (const [gradeKey, gradedPriceValue] of Object.entries(priceChartingResult.gradedPrices)) {
          observations.push({
            source: 'pricecharting',
            grade: normalizeGrade(gradeKey),
            priceUsd: gradedPriceValue,
            priceNative: gradedPriceValue,
            currency: SOURCE_CURRENCY.pricecharting,
            evidence: priceChartingResult.evidence,
          });
          console.log(`[DBFW] PriceCharting ${gradeKey.toUpperCase()}: $${gradedPriceValue}`);
        }
      }
    }
  }

  return { observations, cardUpdates };
};

export const workerConfig: WorkerConfig = {
  label: 'DBFW',
  queueFilter: (q) => q.ilike('slug', 'dbfw-%').ilike('slug', '%-ja'),
  sources: ['cardrush', 'pricecharting'],
  fetchCard,
  sleepMs: process.env.SAFE_MODE === '1' ? 40000 : 17000,
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void runScrapeLoop(workerConfig);
}
