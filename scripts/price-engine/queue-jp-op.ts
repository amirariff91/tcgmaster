import { fileURLToPath } from 'node:url';
import { fetchPriceChartingPrice } from '../../lib/price-engine/pricecharting';
import { fetchJapanesePrice } from '../../lib/price-engine/yuyutei';
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

  console.log('[Japanese OP] Fetching from Yuyutei...');
  const yuyuteiResult = await fetchJapanesePrice(card.yuyutei_url || card.number);
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

    const identity = assertIdentity({ number: card.number, name: card.name }, yuyuteiResult.evidence);
    if (identity.ok && yuyuteiResult.url && yuyuteiResult.url !== card.yuyutei_url) {
      cardUpdates.yuyutei_url = yuyuteiResult.url;
    }
  }

  console.log('[Japanese OP] Fetching from PriceCharting...');
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
    console.log(`[Japanese OP] PriceCharting: $${priceChartingResult.price}`);

    if (priceChartingResult.gradedPrice) {
      observations.push({
        source: 'pricecharting',
        grade: normalizeGrade('psa10'),
        priceUsd: priceChartingResult.gradedPrice,
        priceNative: priceChartingResult.gradedPrice,
        currency: SOURCE_CURRENCY.pricecharting,
        evidence: priceChartingResult.evidence,
      });
      console.log(`[Japanese OP] PriceCharting PSA 10: $${priceChartingResult.gradedPrice}`);
    }
  }

  return { observations, cardUpdates };
};

export const workerConfig: WorkerConfig = {
  label: 'Japanese OP',
  queueFilter: (q) => q.ilike('slug', 'op-%').ilike('slug', '%-ja'),
  fetchCard,
  sleepMs: process.env.SAFE_MODE === '1' ? 40000 : 17000,
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void runScrapeLoop(workerConfig);
}
