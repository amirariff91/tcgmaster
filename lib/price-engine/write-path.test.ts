import { beforeEach, describe, expect, it, vi } from 'vitest';
import { markForReverification, upsertMapping, type SourceMapping } from './mapping';
import {
  persistObservations,
  selectHeadline,
  shapeCurrentRow,
  shapeGradedPrices,
  type PriceObservation,
} from './write-path';

vi.mock('./mapping', () => ({
  markForReverification: vi.fn(),
  upsertMapping: vi.fn(),
}));

function observation(
  source: PriceObservation['source'],
  priceUsd: number,
  grade: PriceObservation['grade'] = 'raw',
): PriceObservation {
  return {
    source,
    priceUsd,
    priceNative: null,
    currency: source === 'yuyutei' || source === 'cardrush' ? 'JPY' : 'USD',
    grade,
    evidence: {
      externalTitle: `Card ${source} OP01-001`,
      matchedBy: 'search',
    },
  };
}

function mapping(
  source: SourceMapping['source'],
  externalTitle: string | null,
  externalSet: string | null = null,
): SourceMapping {
  return {
    cardId: 'card-1',
    source,
    externalId: source === 'tcgplayer' ? '123' : null,
    externalUrl: source === 'tcgplayer' ? null : `https://example.test/${source}`,
    externalTitle,
    externalSet,
    confidence: 'confirmed',
    matchedBy: 'manual',
    evidence: null,
    verifiedAt: new Date().toISOString(),
  };
}

interface PersistenceOptions {
  currentPrice?: {
    source_prices: Record<string, unknown>;
    graded_prices: Record<string, unknown>;
  };
  events?: string[];
}

function persistenceDb(
  inserts: Record<string, unknown[]> = {},
  updates: Record<string, unknown[]> = {},
  upserts: Record<string, unknown[]> = {},
  deletes: Record<string, number> = {},
  options: PersistenceOptions = {},
): never {
  const db = vi.fn(async (text: string, params: readonly unknown[] = []) => {
    if (text.includes('SELECT source_prices, graded_prices')) {
      options.events?.push('card_price_current.maybeSingle');
      return options.currentPrice ? [options.currentPrice] : [];
    }

    if (text.includes('SELECT price') && text.includes('FROM price_history')) {
      return [];
    }

    if (text.includes('SELECT source, grade, price') && text.includes('FROM price_history')) {
      return [];
    }

    if (text.includes('INSERT INTO price_quarantine')) {
      options.events?.push('price_quarantine.insert');
      inserts.price_quarantine ??= [];
      inserts.price_quarantine.push(JSON.parse(String(params[0])));
      return [];
    }

    if (text.includes('INSERT INTO price_history')) {
      options.events?.push('price_history.insert');
      inserts.price_history ??= [];
      inserts.price_history.push(JSON.parse(String(params[0])));
      return [];
    }

    if (text.includes('INSERT INTO card_price_current')) {
      options.events?.push('card_price_current.upsert');
      upserts.card_price_current ??= [];
      upserts.card_price_current.push({
        card_id: params[0],
        source_prices: JSON.parse(String(params[1])),
        graded_prices: JSON.parse(String(params[2])),
        headline_cents: params[3],
        headline_source: params[4],
        headline_kind: params[5],
        headline_currency: params[6],
        headline_grade: params[7],
        computed_at: params[8],
      });
      return [];
    }

    if (text.includes('UPDATE cards')) {
      options.events?.push('cards.update');
      const payload: Record<string, unknown> = { last_price_fetch: params[params.length - 1] };
      if (text.includes('tcg_player_id =')) payload.tcg_player_id = params[1];
      if (text.includes('print_run_info =')) payload.print_run_info = params[text.includes('tcg_player_id =') ? 2 : 1];
      updates.cards ??= [];
      updates.cards.push(payload);
      return [];
    }

    return [];
  });
  return db as never;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('selectHeadline', () => {
  it('prefers market over every other supported kind', () => {
    expect(selectHeadline([
      observation('pricecharting', 3),
      observation('yuyutei', 2),
      observation('tcgplayer', 5),
    ])).toEqual({ cents: 500, source: 'tcgplayer', kind: 'market', grade: 'raw' });
  });

  it.each([
    ['retail_sell', 'yuyutei', 'lowest_listing', 'cardrush'],
    ['sold_guide', 'pricecharting', 'lowest_listing', 'cardrush'],
  ] as const)('selects %s over %s', (kind: string, source: string, lowerKind: string, lowerSource: string) => {
    expect(selectHeadline([
      observation(lowerSource as PriceObservation['source'], 1),
      observation(source as PriceObservation['source'], 2.5),
    ])).toEqual({ cents: 250, source, kind, grade: 'raw' });
  });

  it('selects lowest_listing when higher kinds are not available', () => {
    const source = 'cardrush';
    const kind = 'lowest_listing';
    expect(selectHeadline([observation(source, 12)])).toEqual({
      cents: 1200, source, kind, grade: 'raw'
    });
  });

  it('breaks same-kind ties by taking the lowest price', () => {
    expect(selectHeadline([
      observation('tcgplayer', 12),
      observation('tcgplayer', 8.75),
    ])).toEqual({ cents: 875, source: 'tcgplayer', kind: 'market', grade: 'raw' });
  });

  it('returns null when there are no raw observations', () => {
    expect(selectHeadline([observation('tcgplayer', 12, 'psa10')])).toBeNull();
  });
});

describe('shapeGradedPrices', () => {
  it('uses canonical grade keys and means each grade', () => {
    expect(shapeGradedPrices([
      observation('tcgplayer', 10, 'psa10'),
      observation('pricecharting', 14, 'psa10'),
      observation('yuyutei', 8, 'psa9'),
    ])).toEqual({
      psa10: {
        average: 12,
        sources: { tcgplayer: 10, pricecharting: 14 },
      },
      psa9: {
        average: 8,
        sources: { yuyutei: 8 },
      },
    });
  });
});

describe('shapeCurrentRow', () => {
  it('shapes multiple raw sources and graded prices with headline metadata', () => {
    const recordedAt = '2026-07-28T18:00:00.000Z';
    const observations = [
      observation('tcgplayer', 10),
      observation('yuyutei', 12),
      observation('pricecharting', 14, 'psa10'),
    ];

    expect(shapeCurrentRow(
      'card-1',
      observations,
      { cents: 1000, source: 'tcgplayer', kind: 'market', grade: 'raw' },
      recordedAt,
    )).toEqual({
      card_id: 'card-1',
      source_prices: {
        tcgplayer: {
          usd: 10,
          native: null,
          currency: 'USD',
          kind: 'market',
          recorded_at: recordedAt,
        },
        yuyutei: {
          usd: 12,
          native: null,
          currency: 'JPY',
          kind: 'retail_sell',
          recorded_at: recordedAt,
        },
      },
      graded_prices: {
        psa10: { average: 14, sources: { pricecharting: 14 } },
      },
      headline_cents: 1000,
      headline_source: 'tcgplayer',
      headline_kind: 'market',
      headline_currency: 'USD',
      headline_grade: 'raw',
      computed_at: recordedAt,
    });
  });

  it('shapes graded-only observations with null headline fields', () => {
    expect(shapeCurrentRow(
      'card-1',
      [observation('tcgplayer', 14, 'psa10')],
      null,
      '2026-07-28T18:00:00.000Z',
    )).toEqual({
      card_id: 'card-1',
      source_prices: {},
      graded_prices: {
        psa10: { average: 14, sources: { tcgplayer: 14 } },
      },
      headline_cents: null,
      headline_source: null,
      headline_kind: null,
      headline_currency: null,
      headline_grade: null,
      computed_at: '2026-07-28T18:00:00.000Z',
    });
  });

  it('shapes an empty accepted observation set', () => {
    expect(shapeCurrentRow('card-1', [], null, '2026-07-28T18:00:00.000Z')).toEqual({
      card_id: 'card-1',
      source_prices: {},
      graded_prices: {},
      headline_cents: null,
      headline_source: null,
      headline_kind: null,
      headline_currency: null,
      headline_grade: null,
      computed_at: '2026-07-28T18:00:00.000Z',
    });
  });
});

describe('persistObservations', () => {
  it('upserts current prices, including null headline fields without raw observations', async () => {
    const inserts: Record<string, unknown[]> = {};
    const upserts: Record<string, unknown[]> = {};
    const deletes: Record<string, number> = {};

    await persistObservations(
      persistenceDb(inserts, {}, upserts, deletes),
      { id: 'card-1', slug: 'op-01-001', number: 'OP01-001', name: 'Card' },
      [observation('tcgplayer', 14, 'psa10')],
    );

    expect(upserts.card_price_current).toHaveLength(1);
    expect(upserts.card_price_current?.[0]).toEqual(expect.objectContaining({
      card_id: 'card-1',
      source_prices: {},
      graded_prices: { psa10: { average: 14, sources: { tcgplayer: 14 } } },
      headline_cents: null,
      headline_source: null,
      headline_kind: null,
      headline_currency: null,
      headline_grade: null,
      computed_at: expect.any(String),
    }));
    // Regression guard: price_cache was dropped by 20260728190000_drop_price_cache.sql.
    // The write path must never resurrect it.
    expect(inserts.price_cache).toBeUndefined();
    expect(deletes.price_cache).toBeUndefined();
  });

  it('merges source prices from the existing row and recomputes the merged headline', async () => {
    const upserts: Record<string, unknown[]> = {};

    await persistObservations(
      persistenceDb({}, {}, upserts, {}, {
        currentPrice: {
          source_prices: {
            tcgplayer: {
              usd: 5,
              native: 5,
              currency: 'USD',
              kind: 'market',
              recorded_at: '2026-07-28T17:00:00.000Z',
            },
          },
          graded_prices: {},
        },
      }),
      { id: 'card-1', slug: 'op-01-001', number: 'OP01-001', name: 'Card' },
      [observation('yuyutei', 4)],
    );

    expect(upserts.card_price_current?.[0]).toEqual(expect.objectContaining({
      source_prices: expect.objectContaining({
        tcgplayer: expect.objectContaining({ usd: 5 }),
        yuyutei: expect.objectContaining({ usd: 4 }),
      }),
      headline_cents: 500,
      headline_source: 'tcgplayer',
      headline_kind: 'market',
      headline_currency: 'USD',
      headline_grade: 'raw',
    }));
  });

  it('lets a fresh observation overwrite the existing entry for the same source', async () => {
    const upserts: Record<string, unknown[]> = {};

    await persistObservations(
      persistenceDb({}, {}, upserts, {}, {
        currentPrice: {
          source_prices: {
            yuyutei: {
              usd: 5,
              native: 500,
              currency: 'JPY',
              kind: 'retail_sell',
              recorded_at: '2026-07-28T17:00:00.000Z',
            },
          },
          graded_prices: {},
        },
      }),
      { id: 'card-1', slug: 'op-01-001', number: 'OP01-001', name: 'Card' },
      [observation('yuyutei', 4)],
    );

    const row = upserts.card_price_current?.[0] as { source_prices: Record<string, { usd: number }> };
    expect(row.source_prices).toHaveProperty('yuyutei.usd', 4);
  });

  it('merges graded sources and recomputes the average for touched grades', async () => {
    const upserts: Record<string, unknown[]> = {};

    await persistObservations(
      persistenceDb({}, {}, upserts, {}, {
        currentPrice: {
          source_prices: {},
          graded_prices: {
            psa10: { average: 10, sources: { tcgplayer: 10 } },
          },
        },
      }),
      { id: 'card-1', slug: 'op-01-001', number: 'OP01-001', name: 'Card' },
      [observation('pricecharting', 14, 'psa10')],
    );

    expect(upserts.card_price_current?.[0]).toEqual(expect.objectContaining({
      graded_prices: {
        psa10: {
          average: 12,
          sources: { tcgplayer: 10, pricecharting: 14 },
        },
      },
    }));
  });

  it('publishes card_price_current only after history has been inserted', async () => {
    const events: string[] = [];

    await persistObservations(
      persistenceDb({}, {}, {}, {}, { events }),
      { id: 'card-1', slug: 'op-01-001', number: 'OP01-001', name: 'Card' },
      [observation('tcgplayer', 5)],
    );

    expect(events.indexOf('price_history.insert')).toBeGreaterThanOrEqual(0);
    expect(events.indexOf('price_history.insert')).toBeLessThan(events.indexOf('card_price_current.upsert'));
  });

  it('upserts unchanged existing data with a recomputed headline when no observations are accepted', async () => {
    const inserts: Record<string, unknown[]> = {};
    const upserts: Record<string, unknown[]> = {};

    const result = await persistObservations(
      persistenceDb(inserts, {}, upserts, {}, {
        currentPrice: {
          source_prices: {
            tcgplayer: {
              usd: 5,
              native: 5,
              currency: 'USD',
              kind: 'market',
              recorded_at: '2026-07-28T17:00:00.000Z',
            },
          },
          graded_prices: {},
        },
      }),
      { id: 'card-1', slug: 'op-01-001', number: 'OP01-001', name: 'Card' },
      [{
        ...observation('tcgplayer', 9),
        evidence: { externalTitle: 'Wrong OP01-0010', matchedBy: 'search' },
      }],
    );

    expect(result.written).toBe(0);
    expect(upserts.card_price_current?.[0]).toEqual(expect.objectContaining({
      source_prices: {
        tcgplayer: expect.objectContaining({ usd: 5 }),
      },
      headline_cents: 500,
      headline_source: 'tcgplayer',
      headline_kind: 'market',
      headline_currency: 'USD',
      headline_grade: 'raw',
    }));
    expect(inserts.price_history).toBeUndefined();
  });

  it('quarantines title drift and marks the mapping for reverification', async () => {
    const inserts: Record<string, unknown[]> = {};
    const result = await persistObservations(
      persistenceDb(inserts),
      { id: 'card-1', slug: 'op-01-001', number: 'OP01-001', name: 'Card' },
      [
        {
          ...observation('tcgplayer', 7.5),
          evidence: {
            externalTitle: 'Card tcgplayer OP01-001',
            externalSet: 'Different Set',
            matchedBy: 'product-id',
          },
        },
      ],
      {},
      [mapping('tcgplayer', 'Monkey D. Luffy OP01-001', 'Stored Set')],
    );

    expect(result.written).toBe(0);
    expect(result.quarantined).toBe(1);
    expect(inserts.price_quarantine?.[0]).toEqual([
      expect.objectContaining({ source: 'tcgplayer', reason: 'title-drift' }),
    ]);
    expect(markForReverification).toHaveBeenCalledWith(expect.anything(), 'card-1', 'tcgplayer');
  });

  it.each([
    ['stored title differs from fetched title', 'Monkey D. Luffy OP01-001', 'OP01-001'],
    ['fetched title differs from stored title', 'OP01-001', 'Monkey D. Luffy OP01-001'],
  ])('writes normally when %s', async (_label: string, storedTitle: string, fetchedTitle: string) => {
    const inserts: Record<string, unknown[]> = {};
    const result = await persistObservations(
      persistenceDb(inserts),
      { id: 'card-1', slug: 'op-01-001', number: 'OP01-001', name: 'Card' },
      [{
        ...observation('tcgplayer', 7.5),
        evidence: { externalTitle: fetchedTitle, externalSet: ' OP01 ', matchedBy: 'product-id' },
      }],
      {},
      [mapping('tcgplayer', storedTitle, 'op01')],
    );

    expect(result.written).toBe(1);
    expect(result.quarantined).toBe(0);
    expect(inserts.price_quarantine).toBeUndefined();
    expect(markForReverification).not.toHaveBeenCalled();
  });

  it('backfills missing mapping evidence after an accepted observation', async () => {
    const inserts: Record<string, unknown[]> = {};
    const existing = mapping('tcgplayer', null);

    await persistObservations(
      persistenceDb(inserts),
      { id: 'card-1', slug: 'op-01-001', number: 'OP01-001', name: 'Card' },
      [{
        ...observation('tcgplayer', 7.5),
        evidence: {
          externalTitle: 'Fetched Card OP01-001',
          externalSet: 'Fetched Set',
          matchedBy: 'product-id',
        },
      }],
      {},
      [existing],
    );

    expect(upsertMapping).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        externalTitle: 'Fetched Card OP01-001',
        externalSet: 'Fetched Set',
        confidence: existing.confidence,
        matchedBy: existing.matchedBy,
        verifiedAt: expect.any(String),
      }),
      { force: true },
    );
  });

  it('excludes quarantined observations from history, raw prices, and the headline', async () => {
    const inserts: Record<string, unknown[]> = {};
    const db = vi.fn(async (text: string, params: readonly unknown[] = []) => {
      if (text.includes('SELECT price') && text.includes('FROM price_history')) return [];
      if (text.includes('SELECT source, grade, price') && text.includes('FROM price_history')) return [];
      if (text.includes('INSERT INTO price_quarantine')) {
        inserts.price_quarantine = [JSON.parse(String(params[0]))];
        return [];
      }
      if (text.includes('INSERT INTO price_history')) {
        inserts.price_history = [JSON.parse(String(params[0]))];
        return [];
      }
      return [];
    });

    const result = await persistObservations(
      db as never,
      { id: 'card-1', slug: 'op-01-001', number: 'OP01-001', name: 'Card' },
      [
        {
          ...observation('tcgplayer', 750),
          evidence: { externalTitle: 'Wrong OP01-0010', matchedBy: 'search' },
        },
        observation('yuyutei', 10),
      ],
    );

    expect(result.written).toBe(1);
    expect(result.quarantined).toBe(1);
    expect(result.headline).toEqual({ cents: 1000, source: 'yuyutei', kind: 'retail_sell', grade: 'raw' });
    expect(inserts.price_history).toHaveLength(1);
    expect(inserts.price_history?.[0]).toEqual([
      expect.objectContaining({ source: 'yuyutei', price: 10 }),
    ]);
    expect(inserts.price_quarantine).toHaveLength(1);
    expect(inserts.price_quarantine?.[0]).toEqual([
      expect.objectContaining({ source: 'tcgplayer', price: 750, reason: 'number-mismatch' }),
    ]);
  });

  it('suppresses identical observations already written in the last 15 minutes', async () => {
    const historyInserts: unknown[] = [];
    let recentRows: unknown[] = [];
    const db = vi.fn(async (text: string, params: readonly unknown[] = []) => {
      if (text.includes('SELECT price') && text.includes('FROM price_history')) return [];
      if (text.includes('SELECT source, grade, price') && text.includes('FROM price_history')) return recentRows;
      if (text.includes('INSERT INTO price_history')) {
        historyInserts.push(JSON.parse(String(params[0])));
        return [];
      }
      return [];
    });
    const card = { id: 'card-1', slug: 'op-01-001', number: 'OP01-001', name: 'Card' };
    const observations = [observation('tcgplayer', 10)];

    await persistObservations(db as never, card, observations);
    recentRows = [{ source: 'tcgplayer', grade: 'raw', price: 10 }];
    const retry = await persistObservations(db as never, card, observations);

    expect(historyInserts).toHaveLength(1);
    expect(retry.historyRows).toBe(0);
  });

  it('does not let a sold-out corroborator rescue an outlier', async () => {
    const quarantineInserts: unknown[] = [];
    const db = vi.fn(async (text: string, params: readonly unknown[] = []) => {
      if (text.includes('SELECT price') && text.includes('FROM price_history')) {
        return [{ price: 100 }, { price: 100 }, { price: 100 }];
      }
      if (text.includes('SELECT source, grade, price') && text.includes('FROM price_history')) return [];
      if (text.includes('INSERT INTO price_quarantine')) {
        quarantineInserts.push(JSON.parse(String(params[0])));
        return [];
      }
      return [];
    });

    const result = await persistObservations(
      db as never,
      { id: 'card-1', slug: 'op-01-001', number: 'OP01-001', name: 'Card' },
      [
        observation('tcgplayer', 1000),
        {
          ...observation('cardrush', 900),
          evidence: {
            externalTitle: 'Card cardrush OP01-001',
            inStock: false,
            matchedBy: 'search',
          },
        },
      ],
    );

    expect(result.quarantined).toBe(2);
    expect(quarantineInserts[0]).toEqual([
      expect.objectContaining({ source: 'tcgplayer', reason: 'ratio-vs-median' }),
      expect.objectContaining({ source: 'cardrush', reason: 'sold-out' }),
    ]);
  });

  it('does not apply TCGPlayer card updates when that source is quarantined', async () => {
    const inserts: Record<string, unknown[]> = {};
    const updates: Record<string, unknown[]> = {};

    await persistObservations(
      persistenceDb(inserts, updates),
      { id: 'card-1', slug: 'op-01-001', number: 'OP01-001', name: 'Card' },
      [{
        ...observation('tcgplayer', 7.5),
        evidence: { externalTitle: 'Wrong OP01-0010', matchedBy: 'search' },
      }],
      { tcg_player_id: 'new-id', print_run_info: { source: 'tcgplayer' } },
    );

    expect(updates.cards?.[0]).not.toHaveProperty('tcg_player_id');
    expect(updates.cards?.[0]).not.toHaveProperty('print_run_info');
    expect(updates.cards?.[0]).not.toHaveProperty('price_cache_ttl');
  });
});
