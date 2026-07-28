import { fileURLToPath } from 'node:url';
import { fetchPriceChartingByAnchor } from '../../lib/price-engine/pricecharting';
import { fetchTcgplayerByAnchor } from '../../lib/price-engine/tcgcsv';
import { assertIdentity } from '../../lib/price-engine/identity';
import type { SourceMapping } from '../../lib/price-engine/mapping';
import {
  SOURCE_CURRENCY,
  type PriceObservation,
} from '../../lib/price-engine/write-path';
import { runScrapeLoop, type WorkerCard, type WorkerConfig } from '../../lib/price-engine/worker';
import { normalizeGrade } from '../../lib/pricing/grades';

const DBFW_CATEGORY_ID = 80;

export const fetchCard = async (card: WorkerCard, mappings: SourceMapping[]): Promise<{
  observations: PriceObservation[];
  cardUpdates?: Record<string, unknown>;
}> => {
  const observations: PriceObservation[] = [];
  const cardUpdates: Record<string, unknown> = {};

  const tcgPlayerMapping = mappings.find((mapping) => mapping.source === 'tcgplayer');
  if (!tcgPlayerMapping?.externalId) {
    console.log('[English DBFW] tcgplayer: no mapping, skipped');
  } else {
    console.log(`[English DBFW] Fetching from TCGPlayer anchor ${tcgPlayerMapping.externalId}...`);
    const tcgPlayerResult = await fetchTcgplayerByAnchor(tcgPlayerMapping.externalId, DBFW_CATEGORY_ID);
    if (tcgPlayerResult !== null) {
      observations.push({
        source: 'tcgplayer',
        grade: normalizeGrade('raw'),
        priceUsd: tcgPlayerResult.price,
        priceNative: tcgPlayerResult.price,
        currency: SOURCE_CURRENCY.tcgplayer,
        evidence: tcgPlayerResult.evidence,
      });
      console.log(`[English DBFW] TCGPlayer: $${tcgPlayerResult.price}`);

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
  }

  const priceChartingMapping = mappings.find((mapping) => mapping.source === 'pricecharting');
  if (!priceChartingMapping?.externalUrl) {
    console.log('[English DBFW] pricecharting: no mapping, skipped');
  } else {
    console.log(`[English DBFW] Fetching from PriceCharting anchor ${priceChartingMapping.externalUrl}...`);
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
      console.log(`[English DBFW] PriceCharting: $${priceChartingResult.price}`);

      if (priceChartingResult.gradedPrice) {
        observations.push({
          source: 'pricecharting',
          grade: normalizeGrade('psa10'),
          priceUsd: priceChartingResult.gradedPrice,
          priceNative: priceChartingResult.gradedPrice,
          currency: SOURCE_CURRENCY.pricecharting,
          evidence: priceChartingResult.evidence,
        });
        console.log(`[English DBFW] PriceCharting PSA 10: $${priceChartingResult.gradedPrice}`);
      }
    }
  }

  return { observations, cardUpdates };
};

export const workerConfig: WorkerConfig = {
  label: 'English DBFW',
  queueFilter: (q) => q.ilike('slug', 'dbfw-%').not('slug', 'ilike', '%-ja'),
  sources: ['tcgplayer', 'pricecharting'],
  fetchCard,
  sleepMs: process.env.SAFE_MODE === '1' ? 40000 : 17000,
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void runScrapeLoop(workerConfig);
}
