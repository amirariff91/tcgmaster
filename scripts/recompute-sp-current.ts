import { dbQuery } from "../lib/db/client";
import { selectHeadline, type PriceObservation } from "../lib/price-engine/write-path";
import { normalizeGrade } from "../lib/pricing/grades";

async function recomputeCurrentForCards(slugs: string[]) {
  for (const slug of slugs) {
    const cards = await dbQuery<any>('SELECT id, slug, name FROM cards WHERE slug = $1', [slug]);
    if (cards.length === 0) continue;
    const card = cards[0];

    // Get the latest row in history per (source, grade)
    const latestHistory = await dbQuery<any>(
      `SELECT source, price::double precision as priceusd, price_native::double precision as pricenative,
              currency, grade, price_kind, recorded_at
       FROM (
         SELECT *, ROW_NUMBER() OVER(PARTITION BY source, grade ORDER BY recorded_at DESC) as rn
         FROM price_history
         WHERE card_id = $1
       ) t WHERE rn = 1`,
      [card.id]
    );

    const newSourcePrices: Record<string, any> = {};
    const newGradedPrices: Record<string, any> = {};

    const syntheticObservations = latestHistory.map(row => {
      const isGraded = row.grade !== 'raw';
      
      if (!isGraded) {
        newSourcePrices[row.source] = {
          usd: row.priceusd,
          native: row.pricenative,
          currency: row.currency,
          kind: row.price_kind,
          recorded_at: row.recorded_at
        };
      } else {
        const gKey = row.grade === '10' ? 'psa10' : row.grade === '9' ? 'psa9' : row.grade;
        if (!newGradedPrices[gKey]) newGradedPrices[gKey] = { average: 0, sources: {} };
        newGradedPrices[gKey].sources[row.source] = row.priceusd;
      }
      
      return {
        source: row.source,
        grade: normalizeGrade(row.grade),
        priceUsd: row.priceusd,
        priceNative: row.pricenative,
        currency: row.currency,
        evidence: { externalUrl: '', matchedBy: 'cached-url' },
        recordedAt: row.recorded_at
      };
    }) as PriceObservation[];

    // Calculate graded averages
    for (const grade of Object.keys(newGradedPrices)) {
      const values = Object.values(newGradedPrices[grade].sources) as number[];
      if (values.length > 0) {
        newGradedPrices[grade].average = values.reduce((a, b) => a + b, 0) / values.length;
      }
    }

    const headline = selectHeadline(syntheticObservations);
    const headline_cents = headline ? headline.cents : null;
    const headline_source = headline ? headline.source : null;
    const headline_kind = headline ? headline.kind : null;
    const headline_currency = headline ? 'USD' : null;
    const headline_grade = headline ? headline.grade : null;

    await dbQuery(
      `INSERT INTO card_price_current (
         card_id, source_prices, graded_prices, headline_cents, headline_source, headline_kind, headline_currency, headline_grade, computed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (card_id) DO UPDATE SET
         source_prices = EXCLUDED.source_prices,
         graded_prices = EXCLUDED.graded_prices,
         headline_cents = EXCLUDED.headline_cents,
         headline_source = EXCLUDED.headline_source,
         headline_kind = EXCLUDED.headline_kind,
         headline_currency = EXCLUDED.headline_currency,
         headline_grade = EXCLUDED.headline_grade,
         computed_at = NOW()`,
      [card.id, JSON.stringify(newSourcePrices), JSON.stringify(newGradedPrices), headline_cents, headline_source, headline_kind, headline_currency, headline_grade]
    );

    console.log(`✅ [Recomputed] ${card.slug} (${card.name}): Headline = $${headline_cents ? (headline_cents / 100).toFixed(2) : 'null'} (${headline_source})`);
  }
}

async function main() {
  const slugs = [
    'op-op09-004_p2-ja', 'op-op09-051_p2-ja', 'op-op09-093_p2-ja', 'op-op09-118_p2-ja', 'op-op09-119_p2-ja',
    'op-op10-119_p2-ja', 'op-op11-118_p2-ja', 'op-op13-118_p2-ja', 'op-op13-120_p2-ja', 'op-op16-065_p2-ja',
    'op-op03-122_r1-ja', 'op-op04-083_r1-ja', 'op-op05-074_r2-ja', 'op-op05-069_r1-ja', 'op-eb01-006_r1-ja'
  ];
  await recomputeCurrentForCards(slugs);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
