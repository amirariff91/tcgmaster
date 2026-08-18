import { describe, expect, it } from 'vitest';
import { checkSelfConsistency, type ConsistencyInput } from './guards';

const input: ConsistencyInput = {
  cardId: 'card-1',
  source: 'tcgplayer',
  grade: 'raw',
  priceUsd: 750,
};

function dbWithHistory(prices: number[]) {
  return async () => prices.map((price) => ({ price }));
}

describe('checkSelfConsistency', () => {
  it('rejects a price that is more than eight times the trailing median', async () => {
    const verdict = await checkSelfConsistency(
      dbWithHistory([0.05, 0.05, 0.05]) as never,
      input,
      [],
    );

    expect(verdict).toEqual({ ok: false, median: 0.05, ratio: 15000 });
  });

  it('passes a legitimate three-times move without corroboration (single-source reality)', async () => {
    const db = dbWithHistory([100, 100, 100]);

    await expect(checkSelfConsistency(db as never, { ...input, priceUsd: 300 }, [])).resolves.toEqual({ ok: true });
  });

  it('lets corroboration rescue a move beyond the eight-times boundary', async () => {
    const db = dbWithHistory([100, 100, 100]);

    await expect(checkSelfConsistency(db as never, { ...input, priceUsd: 1000 }, [])).resolves.toEqual({
      ok: false,
      median: 100,
      ratio: 10,
    });
    await expect(checkSelfConsistency(db as never, { ...input, priceUsd: 1000 }, [900])).resolves.toEqual({ ok: true });
  });

  it('passes when there are fewer than three history rows', async () => {
    await expect(checkSelfConsistency(dbWithHistory([0.05, 0.05]) as never, input, [])).resolves.toEqual({ ok: true });
  });
});
