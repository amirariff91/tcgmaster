import { beforeEach, describe, expect, it, vi } from 'vitest';
import { markForReverification, upsertMapping, type SourceMapping } from './mapping';
import {
  persistObservations,
  selectHeadline,
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

function persistenceDb(
  inserts: Record<string, unknown[]> = {},
  updates: Record<string, unknown[]> = {},
): never {
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
        delete() {
          return query;
        },
        update(payload: unknown) {
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

describe('persistObservations', () => {
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
    expect(inserts.price_cache?.[0]).toEqual(expect.objectContaining({
      raw_prices: { yuyutei: 10, market: 10 },
    }));
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
  });
});
