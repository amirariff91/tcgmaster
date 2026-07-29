import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCard as fetchDbfwCard } from '../../scripts/price-engine/queue-dbfw';
import { fetchCard as fetchEnglishDbfwCard } from '../../scripts/price-engine/queue-english-dbfw';
import { fetchCard as fetchEnglishOpCard } from '../../scripts/price-engine/queue-english-op';
import { fetchCard as fetchJapaneseOpCard } from '../../scripts/price-engine/queue-jp-op';
import { fetchCardrushByAnchor } from './cardrush';
import { fetchPriceChartingByAnchor } from './pricecharting';
import { fetchTcgplayerByAnchor } from './tcgcsv';
import { fetchYuyuteiByAnchor } from './yuyutei';
import type { SourceMapping } from './mapping';
import type { WorkerCard } from './worker';

vi.mock('./cardrush', () => ({
  fetchCardrushByAnchor: vi.fn(),
}));
vi.mock('./pricecharting', () => ({
  fetchPriceChartingByAnchor: vi.fn(),
}));
vi.mock('./tcgcsv', () => ({
  fetchTcgplayerByAnchor: vi.fn(),
}));
vi.mock('./yuyutei', () => ({
  fetchYuyuteiByAnchor: vi.fn(),
}));

const card: WorkerCard = {
  id: 'card-1',
  slug: 'op-01-001',
  number: 'OP01-001',
  name: 'Card',
};

function sourceMapping(source: SourceMapping['source'], anchor: string): SourceMapping {
  return {
    cardId: card.id,
    source,
    externalId: source === 'tcgplayer' ? anchor : null,
    externalUrl: source === 'tcgplayer' ? null : anchor,
    externalTitle: `Card ${card.number}`,
    externalSet: null,
    confidence: 'confirmed',
    matchedBy: 'manual',
    evidence: null,
    verifiedAt: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('price queue fetchCard anchor flow', () => {
  it('uses a TCGPlayer product ID for English OP', async () => {
    vi.mocked(fetchTcgplayerByAnchor).mockResolvedValue({
      price: 5,
      tcgProductId: 123,
      tcgProductName: 'Card',
      evidence: { externalTitle: `Card ${card.number}`, matchedBy: 'product-id' },
    });

    const result = await fetchEnglishOpCard(card, [sourceMapping('tcgplayer', '123')]);

    expect(fetchTcgplayerByAnchor).toHaveBeenCalledWith('123');
    expect(fetchPriceChartingByAnchor).not.toHaveBeenCalled();
    expect(result.observations).toHaveLength(1);
  });

  it('uses a TCGPlayer product ID for English DBFW', async () => {
    vi.mocked(fetchTcgplayerByAnchor).mockResolvedValue({
      price: 5,
      tcgProductId: 123,
      tcgProductName: 'Card',
      evidence: { externalTitle: `Card ${card.number}`, matchedBy: 'product-id' },
    });

    const result = await fetchEnglishDbfwCard(card, [sourceMapping('tcgplayer', '123')]);

    expect(fetchTcgplayerByAnchor).toHaveBeenCalledWith('123', 80);
    expect(result.observations).toHaveLength(1);
  });

  it('uses a Yuyutei URL for Japanese OP', async () => {
    vi.mocked(fetchYuyuteiByAnchor).mockResolvedValue({
      price: 4,
      url: 'https://yuyu-tei.jp/sell/opc/card/123',
      evidence: {
        externalTitle: `Card ${card.number}`,
        matchedBy: 'cached-url',
      },
    });

    const result = await fetchJapaneseOpCard(card, [
      sourceMapping('yuyutei', 'https://yuyu-tei.jp/sell/opc/card/123'),
    ]);

    expect(fetchYuyuteiByAnchor).toHaveBeenCalledWith('https://yuyu-tei.jp/sell/opc/card/123');
    expect(fetchPriceChartingByAnchor).not.toHaveBeenCalled();
    expect(result.observations).toHaveLength(1);
  });

  it('uses a Cardrush URL for Japanese DBFW', async () => {
    vi.mocked(fetchCardrushByAnchor).mockResolvedValue({
      price: 4,
      url: 'https://www.cardrush-db.jp/product/123',
      evidence: {
        externalTitle: `Card ${card.number}`,
        matchedBy: 'cached-url',
      },
    });

    const result = await fetchDbfwCard(card, [
      sourceMapping('cardrush', 'https://www.cardrush-db.jp/product/123'),
    ]);

    expect(fetchCardrushByAnchor).toHaveBeenCalledWith('https://www.cardrush-db.jp/product/123');
    expect(fetchPriceChartingByAnchor).not.toHaveBeenCalled();
    expect(result.observations).toHaveLength(1);
  });

  it('does not fetch an unmapped source', async () => {
    const [englishOp, englishDbfw, japaneseOp, dbfw] = await Promise.all([
      fetchEnglishOpCard(card, []),
      fetchEnglishDbfwCard(card, []),
      fetchJapaneseOpCard(card, []),
      fetchDbfwCard(card, []),
    ]);

    expect(englishOp.observations).toHaveLength(0);
    expect(englishDbfw.observations).toHaveLength(0);
    expect(japaneseOp.observations).toHaveLength(0);
    expect(dbfw.observations).toHaveLength(0);
    expect(fetchCardrushByAnchor).not.toHaveBeenCalled();
    expect(fetchPriceChartingByAnchor).not.toHaveBeenCalled();
    expect(fetchTcgplayerByAnchor).not.toHaveBeenCalled();
    expect(fetchYuyuteiByAnchor).not.toHaveBeenCalled();
  });
});
