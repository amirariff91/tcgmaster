import { createScraperClient, type PgQuery } from './db';
import { getMappingsForCard, type SourceMapping, upsertMapping } from './mapping';
import { revalidateCardPage } from './revalidate';
import { syncDualEngineSales } from '../../scripts/sync-tcgplayer-dual-engine';
import {
  persistObservations,
  SOURCE_CURRENCY,
  type CardRef,
  type PriceObservation,
  type PriceSource,
} from './write-path';
import { normalizeGrade } from '../pricing/grades';
import { fetchPriceChartingByAnchor } from './pricecharting';
import { fetchYuyuteiByAnchor } from './yuyutei';
import { fetchSnkrdunkPrice } from './snkrdunk';
import { fetchCardrushByAnchor } from './cardrush';
import { fetchTcgplayerByAnchor } from './tcgcsv';
import { altClient } from './alt/client';
import { fanaticsClient } from './fanatics';
import { assertIdentity } from './identity';

export interface LockstepCard {
  id: string;
  name: string;
  slug: string;
  number: string;
  rarity?: string | null;
  tcg_player_id?: string | null;
  print_run_info?: unknown;
  yuyutei_url?: string | null;
  cardrush_url?: string | null;
  pricecharting_url?: string | null;
  snkrdunk_url?: string | null;
  set_name?: string | null;
  set_slug?: string | null;
  release_date?: string | null;
  game_slug: string;
}

export interface LockstepCardResult {
  cardSlug: string;
  success: boolean;
  observationsCount: number;
  sourcesFound: string[];
  dualEngineComps: number;
  durationMs: number;
  error?: string;
}

const SOURCE_TIMEOUT_MS = 25000;

function withTimeout<T>(promise: Promise<T>, ms: number, sourceName: string): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => {
        console.warn(`[Lockstep] Source ${sourceName} timed out after ${ms / 1000}s`);
        resolve(null);
      }, ms);
    }),
  ]);
}

/**
 * Builds confirmed mappings from URLs present on the cards table
 */
function synthesizeCardAnchors(card: LockstepCard, existingMappings: SourceMapping[]): SourceMapping[] {
  const mappings: SourceMapping[] = [...existingMappings];
  const sourceUrlFallbacks: Array<{ source: PriceSource; url: string | null | undefined }> = [
    { source: 'pricecharting', url: card.pricecharting_url },
    { source: 'snkrdunk', url: card.snkrdunk_url },
    { source: 'yuyutei', url: card.yuyutei_url },
    { source: 'cardrush', url: card.cardrush_url },
  ];

  for (const { source, url } of sourceUrlFallbacks) {
    if (!url) continue;
    const existingIdx = mappings.findIndex((m) => m.source === source);
    if (existingIdx === -1) {
      mappings.push({
        cardId: card.id,
        source,
        externalId: null,
        externalUrl: url,
        externalTitle: card.name,
        externalSet: card.set_name ?? null,
        confidence: 'confirmed',
        matchedBy: 'url',
        evidence: { origin: 'cards-table-anchor' },
        verifiedAt: new Date().toISOString(),
      });
    } else if (mappings[existingIdx].confidence !== 'confirmed') {
      mappings[existingIdx] = {
        ...mappings[existingIdx],
        externalUrl: url,
        confidence: 'confirmed',
        matchedBy: 'url',
      };
    }
  }

  // TCGPlayer anchor from card.tcg_player_id
  if (card.tcg_player_id) {
    const existingTcgIdx = mappings.findIndex((m) => m.source === 'tcgplayer');
    if (existingTcgIdx === -1) {
      mappings.push({
        cardId: card.id,
        source: 'tcgplayer',
        externalId: String(card.tcg_player_id),
        externalUrl: `https://www.tcgplayer.com/product/${card.tcg_player_id}`,
        externalTitle: card.name,
        externalSet: card.set_name ?? null,
        confidence: 'confirmed',
        matchedBy: 'product-id',
        evidence: { origin: 'cards-table-tcg-id' },
        verifiedAt: new Date().toISOString(),
      });
    }
  }

  return mappings;
}

/**
 * Synchronously orchestrates all scrapers for ONE single card.
 * Gathers daily prices, graded prices, and historical comps in parallel.
 */
export async function processCardLockstep(
  card: LockstepCard,
  db: PgQuery = createScraperClient()
): Promise<LockstepCardResult> {
  const startTime = Date.now();
  const cardRef: CardRef = {
    id: card.id,
    slug: card.slug,
    name: card.name,
    number: card.number,
  };

  const isVariant = /[-_][pr]\d+$/i.test(card.number || card.slug);
  const isJapanese = card.slug.endsWith('-ja') || (card.game_slug === 'one-piece' && card.slug.includes('-ja'));

  // 1. Gather all existing and synthesized mappings
  const storedMappings = await getMappingsForCard(db, card.id);
  const mappings = synthesizeCardAnchors(card, storedMappings);

  const observations: PriceObservation[] = [];
  const cardUpdates: Record<string, unknown> = {};
  const successfulSources: string[] = [];
  let dualEngineComps = 0;

  // 2. Prepare parallel scraper promises for this specific card
  const scraperTasks: Array<Promise<void>> = [];

  // A. Yuyutei (Japanese cards)
  const yuyuteiMapping = mappings.find((m) => m.source === 'yuyutei');
  if (yuyuteiMapping?.externalUrl && (!isVariant || yuyuteiMapping.confidence === 'confirmed')) {
    scraperTasks.push(
      (async () => {
        const res = await withTimeout(fetchYuyuteiByAnchor(yuyuteiMapping.externalUrl!), SOURCE_TIMEOUT_MS, 'yuyutei');
        if (res) {
          observations.push({
            source: 'yuyutei',
            grade: normalizeGrade('raw'),
            priceUsd: res.price,
            priceNative: null,
            currency: SOURCE_CURRENCY.yuyutei,
            evidence: res.evidence,
          });
          successfulSources.push('yuyutei');
        }
      })()
    );
  }

  // B. PriceCharting (All games)
  const pcMapping = mappings.find((m) => m.source === 'pricecharting');
  if (pcMapping?.externalUrl && (!isVariant || pcMapping.confidence === 'confirmed')) {
    scraperTasks.push(
      (async () => {
        const res = await withTimeout(fetchPriceChartingByAnchor(pcMapping.externalUrl!), SOURCE_TIMEOUT_MS, 'pricecharting');
        if (res) {
          observations.push({
            source: 'pricecharting',
            grade: normalizeGrade('raw'),
            priceUsd: res.price,
            priceNative: res.price,
            currency: SOURCE_CURRENCY.pricecharting,
            evidence: res.evidence,
          });
          successfulSources.push('pricecharting');

          if (res.gradedPrices) {
            for (const [gradeKey, gradedVal] of Object.entries(res.gradedPrices)) {
              if (gradedVal > 0) {
                observations.push({
                  source: 'pricecharting',
                  grade: normalizeGrade(gradeKey),
                  priceUsd: gradedVal,
                  priceNative: gradedVal,
                  currency: SOURCE_CURRENCY.pricecharting,
                  evidence: res.evidence,
                });
              }
            }
          }
        }
      })()
    );
  }

  // C. Snkrdunk (Japanese cards)
  const snkrMapping = mappings.find((m) => m.source === 'snkrdunk');
  if (snkrMapping?.externalUrl && snkrMapping.confidence === 'confirmed') {
    scraperTasks.push(
      (async () => {
        const res = await withTimeout(fetchSnkrdunkPrice(snkrMapping.externalUrl!), SOURCE_TIMEOUT_MS, 'snkrdunk');
        if (res) {
          if (res.price > 0) {
            observations.push({
              source: 'snkrdunk',
              grade: normalizeGrade('raw'),
              priceUsd: res.price,
              priceNative: res.price,
              currency: SOURCE_CURRENCY.snkrdunk,
              evidence: res.evidence,
            });
            successfulSources.push('snkrdunk');
          }
          if (res.gradedPrices) {
            for (const [gradeKey, gradedVal] of Object.entries(res.gradedPrices)) {
              if (gradedVal > 0) {
                observations.push({
                  source: 'snkrdunk',
                  grade: normalizeGrade(gradeKey),
                  priceUsd: gradedVal,
                  priceNative: gradedVal,
                  currency: SOURCE_CURRENCY.snkrdunk,
                  evidence: res.evidence,
                });
              }
            }
          }

          // Ingest 6-Month Snkrdunk Historical Completed Sales
          if (res.historicalSales && res.historicalSales.length > 0) {
            for (const sale of res.historicalSales) {
              try {
                await db(
                  `INSERT INTO price_history (card_id, source, grade, price, price_native, currency, price_kind, recorded_at)
                   VALUES ($1, 'snkrdunk', $2, $3, $3, 'USD', 'sold_guide', $4::timestamptz)
                   ON CONFLICT DO NOTHING`,
                  [card.id, normalizeGrade(sale.grade), sale.price, sale.recordedAt]
                );
              } catch {}
            }
            dualEngineComps += res.historicalSales.length;
          }
        }
      })()
    );
  }

  // D. Cardrush (DBFW & Japanese sets)
  const cardrushMapping = mappings.find((m) => m.source === 'cardrush');
  if (cardrushMapping?.externalUrl && cardrushMapping.confidence === 'confirmed') {
    scraperTasks.push(
      (async () => {
        const res = await withTimeout(fetchCardrushByAnchor(cardrushMapping.externalUrl!), SOURCE_TIMEOUT_MS, 'cardrush');
        if (res) {
          observations.push({
            source: 'cardrush',
            grade: normalizeGrade('raw'),
            priceUsd: res.price,
            priceNative: null,
            currency: SOURCE_CURRENCY.cardrush,
            evidence: res.evidence,
          });
          successfulSources.push('cardrush');
        }
      })()
    );
  }

  // E. TCGPlayer English/Global daily & historical sync
  const tcgMapping = mappings.find((m) => m.source === 'tcgplayer');
  const tcgProductId = tcgMapping?.externalId || card.tcg_player_id;
  if (tcgProductId) {
    scraperTasks.push(
      (async () => {
        try {
          // Tell dual engine to skip direct write so orchestrator can arbitrate all sources together
          const deRes = await syncDualEngineSales(card.id, tcgProductId, { skipCurrentPriceUpdate: true });
          if (deRes.finalPrice && deRes.finalPrice > 0) {
            observations.push({
              source: 'tcgplayer',
              grade: normalizeGrade('raw'),
              priceUsd: deRes.finalPrice,
              priceNative: deRes.finalPrice,
              currency: SOURCE_CURRENCY.tcgplayer,
              evidence: {
                matchedBy: 'product-id',
                externalId: String(tcgProductId),
                externalTitle: card.name,
              },
            });
            successfulSources.push('tcgplayer');
            dualEngineComps += deRes.insertedHistoryCount;
          }
        } catch (err: any) {
          console.warn(`[Lockstep] TCGPlayer error for ${card.slug}:`, err.message);
        }
      })()
    );
  }

  // F. ALT (alt.xyz) Graded Multi-Year Sales Comps
  const altMapping = mappings.find((m) => m.source === 'alt');
  if (altMapping?.externalId || (altMapping?.externalUrl && altMapping.externalUrl.includes('alt.xyz/itm/'))) {
    scraperTasks.push(
      (async () => {
        const assetId = altMapping.externalId || altMapping.externalUrl!.split('/itm/')[1].split('?')[0];
        try {
          const txs = await altClient.fetchMarketTransactions(assetId, 30);
          if (txs.length > 0) {
            let altComps = 0;
            const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

            for (const tx of txs) {
              const p = typeof tx.price === 'number' ? tx.price : parseFloat(tx.price);
              if (isNaN(p) || p <= 0) continue;

              const txDate = new Date(tx.date);
              if (txDate < sixMonthsAgo) continue;

              const company = (tx.attributes?.gradingCompany || 'PSA').toLowerCase();
              const num = (tx.attributes?.gradeNumber || '10').replace(/\.0$/, '');
              const canonicalGrade = normalizeGrade(`${company}${num}`);

              await db(
                `INSERT INTO price_history (card_id, source, grade, price, price_native, currency, price_kind, recorded_at)
                 VALUES ($1, 'alt', $2, $3, $3, 'USD', 'sold_guide', $4::timestamptz)
                 ON CONFLICT DO NOTHING`,
                [card.id, canonicalGrade, p, `${tx.date}T12:00:00Z`]
              );
              altComps++;
            }

            if (altComps > 0) {
              successfulSources.push('alt');
              dualEngineComps += altComps;
            }
          }
        } catch (err: any) {
          console.warn(`[Lockstep] ALT fetch error for ${card.slug}:`, err.message);
        }
      })()
    );
  }

  // G. Fanatics Collect Graded Sales Comps (For Pokemon / One Piece cards)
  const isHighValueOrGrail = card.game_slug === 'pokemon' || isVariant || /manga|special|secret|sr|sec/i.test(card.rarity || card.name);
  if (isHighValueOrGrail) {
    scraperTasks.push(
      (async () => {
        try {
          const baseNum = card.number.split('_')[0].trim();
          const cleanCardName = card.name.replace(/\(.*\)/g, '').replace(/ ex| vstar| vmax| gx/gi, '').trim();
          const searchRes = await withTimeout(
            fanaticsClient.search({
              query: `${cleanCardName} ${baseNum}`.replace(/[#\/]/g, ' ').trim(),
              status: 'Sold',
              hitsPerPage: 20,
            }),
            15000,
            'fanatics'
          );

          if (searchRes && searchRes.hits.length > 0) {
            const sixMonthsAgo = Math.floor((Date.now() - 180 * 24 * 60 * 60 * 1000) / 1000);
            let fanaticsComps = 0;

            for (const hit of searchRes.hits) {
              if (!hit.soldDate || hit.soldDate < sixMonthsAgo || !hit.currentPrice || hit.currentPrice <= 0) continue;
              // Validate exact card number match in title
              const titleLower = hit.title.toLowerCase();
              if (!titleLower.includes(cleanCardName.toLowerCase())) continue;

              const rawGradeString = `${hit.gradingService || ''} ${hit.grade || ''}`.trim() || 'raw';
              const canonicalGrade = normalizeGrade(rawGradeString);

              await db(
                `INSERT INTO price_history (card_id, source, grade, price, price_native, currency, price_kind, recorded_at)
                 VALUES ($1, 'fanatics', $2, $3, $3, 'USD', 'sold_guide', $4::timestamptz)
                 ON CONFLICT DO NOTHING`,
                [card.id, canonicalGrade, hit.currentPrice, new Date(hit.soldDate * 1000).toISOString()]
              );
              fanaticsComps++;
            }

            if (fanaticsComps > 0) {
              successfulSources.push('fanatics');
              dualEngineComps += fanaticsComps;
            }
          }
        } catch (err: any) {
          // Non-critical background enrichment
        }
      })()
    );
  }

  // 3. BARRIER WAIT: Wait for all scrapers to complete for this card
  await Promise.allSettled(scraperTasks);

  // 4. Unified Persistence: Save daily observations and sync headline
  if (observations.length > 0) {
    await persistObservations(db, cardRef, observations, cardUpdates, mappings);
  } else {
    // Update last_price_fetch so card moves forward even if empty
    await db(`UPDATE cards SET last_price_fetch = NOW() WHERE id = $1`, [card.id]);
  }

  // 5. Update cards.price_cache_ttl from current headline cents
  const currentRes = await db<{ headline_cents: number | null }>(
    `SELECT headline_cents FROM card_price_current WHERE card_id = $1`,
    [card.id]
  );
  if (currentRes[0]?.headline_cents) {
    await db(`UPDATE cards SET price_cache_ttl = $1 WHERE id = $2`, [currentRes[0].headline_cents, card.id]);
  }

  // 6. Revalidate frontend cache
  await revalidateCardPage(card.id, `[Lockstep] ${card.slug}`);

  const durationMs = Date.now() - startTime;
  return {
    cardSlug: card.slug,
    success: true,
    observationsCount: observations.length,
    sourcesFound: successfulSources,
    dualEngineComps,
    durationMs,
  };
}
