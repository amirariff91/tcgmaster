import { fileURLToPath } from 'node:url';
import { fetchPriceChartingPrice } from '../../lib/price-engine/pricecharting';
import { fetchEnglishPrice } from '../../lib/price-engine/tcgcsv';
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

  console.log('[English OP] Fetching from TCGPlayer...');
  const tcgPlayerResult = await fetchEnglishPrice(card.number, card.sets?.name ?? undefined, card.tcg_player_id ?? undefined);
  if (tcgPlayerResult !== null) {
    observations.push({
      source: 'tcgplayer',
      grade: normalizeGrade('raw'),
      priceUsd: tcgPlayerResult.price,
      priceNative: tcgPlayerResult.price,
      currency: SOURCE_CURRENCY.tcgplayer,
      evidence: tcgPlayerResult.evidence,
    });
    console.log(`[English OP] TCGPlayer: $${tcgPlayerResult.price}`);

    const identity = assertIdentity({ number: card.number, name: card.name }, tcgPlayerResult.evidence);
    if (identity.ok) {
      cardUpdates.tcg_player_id = String(tcgPlayerResult.tcgProductId);

      if (tcgPlayerResult.tcgProductName) {
        const printRunInfo = card.print_run_info && typeof card.print_run_info === 'object'
          ? { ...(card.print_run_info as Record<string, unknown>) }
          : {};
        printRunInfo.tcgplayer_card_name = tcgPlayerResult.tcgProductName;
        cardUpdates.print_run_info = printRunInfo;
      }
    }
  }

  console.log('[English OP] Fetching from PriceCharting...');
  const priceChartingResult = await fetchPriceChartingPrice(card.number);
  if (priceChartingResult !== null) {
    observations.push({
      source: 'pricecharting',
      grade: normalizeGrade('raw'),
      priceUsd: priceChartingResult.price,
      priceNative: priceChartingResult.price,
      currency: SOURCE_CURRENCY.pricecharting,
      evidence: priceChartingResult.evidence,
    });
    console.log(`[English OP] PriceCharting: $${priceChartingResult.price}`);

    if (priceChartingResult.gradedPrice) {
      observations.push({
        source: 'pricecharting',
        grade: normalizeGrade('psa10'),
        priceUsd: priceChartingResult.gradedPrice,
        priceNative: priceChartingResult.gradedPrice,
        currency: SOURCE_CURRENCY.pricecharting,
        evidence: priceChartingResult.evidence,
      });
      console.log(`[English OP] PriceCharting PSA 10: $${priceChartingResult.gradedPrice}`);
    }
  }

  return { observations, cardUpdates };
};

export const workerConfig: WorkerConfig = {
  label: 'English OP',
  queueFilter: (q) => q.ilike('slug', 'op-%').not('slug', 'ilike', '%-ja'),
  fetchCard,
  sleepMs: process.env.SAFE_MODE === '1' ? 40000 : 17000,
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void runScrapeLoop(workerConfig);
}
