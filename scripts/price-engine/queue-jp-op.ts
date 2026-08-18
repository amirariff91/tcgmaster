import { fileURLToPath } from 'node:url';
import { fetchPriceChartingByAnchor } from '../../lib/price-engine/pricecharting';
import { fetchYuyuteiByAnchor } from '../../lib/price-engine/yuyutei';
import { fetchSnkrdunkPrice } from '../../lib/price-engine/snkrdunk';
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

  const yuyuteiMapping = mappings.find((mapping) => mapping.source === 'yuyutei');
  if (!yuyuteiMapping?.externalUrl) {
    console.log('[Japanese OP] yuyutei: no mapping, skipped');
  } else {
    console.log(`[Japanese OP] Fetching from Yuyutei anchor ${yuyuteiMapping.externalUrl}...`);
    const yuyuteiResult = await fetchYuyuteiByAnchor(yuyuteiMapping.externalUrl);
    if (yuyuteiResult !== null) {
      observations.push({
        source: 'yuyutei',
        grade: normalizeGrade('raw'),
        priceUsd: yuyuteiResult.price,
        priceNative: null,
        currency: SOURCE_CURRENCY.yuyutei,
        evidence: yuyuteiResult.evidence,
      });
      console.log(`[Japanese OP] Yuyutei: ¥${Math.round(yuyuteiResult.price * 150)} (~$${yuyuteiResult.price})`);
    }
  }

  const priceChartingMapping = mappings.find((mapping) => mapping.source === 'pricecharting');
  if (!priceChartingMapping?.externalUrl) {
    console.log('[Japanese OP] pricecharting: no mapping, skipped');
  } else {
    console.log(`[Japanese OP] Fetching from PriceCharting anchor ${priceChartingMapping.externalUrl}...`);
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
      console.log(`[Japanese OP] PriceCharting: $${priceChartingResult.price}`);

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
          console.log(`[Japanese OP] PriceCharting ${gradeKey.toUpperCase()}: $${gradedPriceValue}`);
        }
      }
    }
  }

  const snkrdunkMapping = mappings.find((mapping) => mapping.source === 'snkrdunk');
  if (!snkrdunkMapping?.externalUrl) {
    console.log('[Japanese OP] snkrdunk: no mapping, skipped');
  } else {
    console.log(`[Japanese OP] Fetching from SnkrDunk anchor ${snkrdunkMapping.externalUrl}...`);
    const snkrdunkResult = await fetchSnkrdunkPrice(snkrdunkMapping.externalUrl);
    if (snkrdunkResult !== null) {
      if (snkrdunkResult.price > 0) {
        observations.push({
          source: 'snkrdunk',
          grade: normalizeGrade('raw'),
          priceUsd: snkrdunkResult.price,
          priceNative: snkrdunkResult.price,
          currency: SOURCE_CURRENCY.snkrdunk,
          evidence: snkrdunkResult.evidence,
        });
        console.log(`[Japanese OP] SnkrDunk: $${snkrdunkResult.price}`);
      }

      if (snkrdunkResult.gradedPrices) {
        for (const [gradeKey, gradedPriceValue] of Object.entries(snkrdunkResult.gradedPrices)) {
          observations.push({
            source: 'snkrdunk',
            grade: normalizeGrade(gradeKey),
            priceUsd: gradedPriceValue,
            priceNative: gradedPriceValue,
            currency: SOURCE_CURRENCY.snkrdunk,
            evidence: snkrdunkResult.evidence,
          });
          console.log(`[Japanese OP] SnkrDunk ${gradeKey.toUpperCase()}: $${gradedPriceValue}`);
        }
      }
    }
  }

  return { observations, cardUpdates };
};

export const workerConfig: WorkerConfig = {
  label: 'Japanese OP',
  queueFilter: (q) => q.ilike('slug', 'op-%').ilike('slug', '%-ja'),
  sources: ['yuyutei', 'pricecharting', 'snkrdunk'],
  fetchCard,
  sleepMs: process.env.SAFE_MODE === '1' ? 40000 : 17000,
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void runScrapeLoop(workerConfig);
}
