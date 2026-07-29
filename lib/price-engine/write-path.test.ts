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
  const db = {
    from(table: string) {
      const query = {
        select() {
          options.events?.push(`${table}.select`);
          return query;
        },
        eq() {
          return query;
        },
        order() {
          return query;
        },
        gte() {
          return Promise.resolve({ data: [], error: null });
        },
        limit() {
          return Promise.resolve({ data: [], error: null });
        },
        maybeSingle() {
          options.events?.push(`${table}.maybeSingle`);
          return Promise.resolve({
            data: table === 'card_price_current' ? options.currentPrice ?? null : null,
            error: null,
          });
        },
        insert(rows: unknown) {
          options.events?.push(`${table}.insert`);
          inserts[table] ??= [];
          inserts[table].push(rows);
          return Promise.resolve({ error: null });
        },
        upsert(rows: unknown) {
          options.events?.push(`${table}.upsert`);
          upserts[table] ??= [];
          upserts[table].push(rows);
          return Promise.resolve({ error: null });
        },
        delete() {
          options.events?.push(`${table}.delete`);
          deletes[table] = (deletes[table] ?? 0) + 1;
          return query;
        },
        update(payload: unknown) {
          options.events?.push(`${table}.update`);
          updates[table] ??= [];
          updates[table].push(payload);
          return query;
        },
      };
      return query;
    },
  };
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
    ['retail_sell', 'yuyutei'],
    ['sold_guide', 'pricecharting'],
    ['lowest_listing', 'cardrush'],
  ] as const)('selects %s when it is the first available kind', (kind, source) => {
    expect(selectHeadline([
      observation('snkrdunk', 1),
      observation(source, 2.5),
    ])).toEqual({ cents: 250, source, kind, grade: 'raw' });
  });

  it('never selects a marketplace ask', () => {
    expect(selectHeadline([observation('snkrdunk', 12)])).toBeNull();
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
  ])('writes normally when %s', async (_label, storedTitle, fetchedTitle) => {
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
    const db = {
      from(table: string) {
        const query = {
          select() {
            return query;
          },
          eq() {
            return query;
          },
          order() {
            return query;
          },
          gte() {
            return Promise.resolve({ data: [], error: null });
          },
          limit() {
            return Promise.resolve({ data: [], error: null });
          },
          maybeSingle() {
            return Promise.resolve({ data: null, error: null });
          },
          insert(rows: unknown) {
            inserts[table] ??= [];
            inserts[table].push(rows);
            return Promise.resolve({ error: null });
          },
          upsert() {
            return Promise.resolve({ error: null });
          },
          delete() {
            return query;
          },
          update() {
            return query;
          },
        };
        return query;
      },
    };

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
    const db = {
      from(table: string) {
        const query = {
          select() {
            return query;
          },
          eq() {
            return query;
          },
          order() {
            return query;
          },
          gte() {
            return Promise.resolve({ data: recentRows, error: null });
          },
          limit() {
            return Promise.resolve({ data: [], error: null });
          },
          maybeSingle() {
            return Promise.resolve({ data: null, error: null });
          },
          insert(rows: unknown) {
            if (table === 'price_history') historyInserts.push(rows);
            return Promise.resolve({ error: null });
          },
          upsert() {
            return Promise.resolve({ error: null });
          },
          delete() {
            return query;
          },
          update() {
            return query;
          },
        };
        return query;
      },
    };
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
    const db = {
      from(table: string) {
        let selectedColumns = '';
        const query = {
          select(columns?: string) {
            selectedColumns = columns ?? '';
            return query;
          },
          eq() {
            return query;
          },
          order() {
            return query;
          },
          gte() {
            return Promise.resolve({ data: [], error: null });
          },
          limit() {
            const data = table === 'price_history' && selectedColumns === 'price'
              ? [{ price: 100 }, { price: 100 }, { price: 100 }]
              : [];
            return Promise.resolve({ data, error: null });
          },
          maybeSingle() {
            return Promise.resolve({ data: null, error: null });
          },
          insert(rows: unknown) {
            if (table === 'price_quarantine') quarantineInserts.push(rows);
            return Promise.resolve({ error: null });
          },
          upsert() {
            return Promise.resolve({ error: null });
          },
          delete() {
            return query;
          },
          update() {
            return query;
          },
        };
        return query;
      },
    };

    const result = await persistObservations(
      db as never,
      { id: 'card-1', slug: 'op-01-001', number: 'OP01-001', name: 'Card' },
      [
        observation('tcgplayer', 1000),
        {
          ...observation('yuyutei', 900),
          evidence: {
            externalTitle: 'Card yuyutei OP01-001',
            inStock: false,
            matchedBy: 'search',
          },
        },
      ],
    );

    expect(result.quarantined).toBe(2);
    expect(quarantineInserts[0]).toEqual([
      expect.objectContaining({ source: 'tcgplayer', reason: 'ratio-vs-median' }),
      expect.objectContaining({ source: 'yuyutei', reason: 'sold-out' }),
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
