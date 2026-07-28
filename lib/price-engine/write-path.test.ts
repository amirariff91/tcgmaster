import { describe, expect, it } from 'vitest';
import {
  selectHeadline,
  shapeGradedPrices,
  type PriceObservation,
} from './write-path';

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
  };
}

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
