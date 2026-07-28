import { describe, expect, it } from 'vitest';
import { assertIdentity } from './identity';

describe('assertIdentity', () => {
  it('accepts a title containing the expected base number', () => {
    expect(assertIdentity(
      { number: 'OP12-020_p2' },
      {
        externalTitle: 'ロロノア・ゾロ OP12-020 スーパーパラレル',
        matchedBy: 'search',
      },
    )).toEqual({ ok: true });
  });

  it('quarantines a sold-out serial promo even when its URL contains the card number', () => {
    expect(assertIdentity(
      { number: 'OP12-020_p2' },
      {
        externalTitle: 'ロロノア・ゾロ(シリアルナンバー付き/パラレル)',
        externalUrl: 'https://yuyu-tei.jp/sell/opc/card/OP12-020',
        inStock: false,
        matchedBy: 'search',
      },
    )).toEqual({ ok: false, reason: 'sold-out', detail: expect.any(String) });
  });

  it('never accepts evidence without a matched title', () => {
    expect(assertIdentity(
      { number: 'OP12-020' },
      { externalUrl: 'https://example.test/OP12-020', matchedBy: 'cached-url' },
    )).toEqual({ ok: false, reason: 'no-evidence', detail: expect.any(String) });
  });

  it('uses token boundaries instead of matching a number prefix', () => {
    expect(assertIdentity(
      { number: 'OP01-001' },
      { externalTitle: 'Monkey D. Luffy OP01-0010', matchedBy: 'search' },
    )).toEqual({ ok: false, reason: 'number-mismatch', detail: expect.any(String) });
  });

  it('treats cached URLs as hypotheses subject to the same identity check', () => {
    expect(assertIdentity(
      { number: 'OP01-001' },
      { externalTitle: 'Monkey D. Luffy OP01-002', externalUrl: 'https://example.test/OP01-001', matchedBy: 'cached-url' },
    )).toEqual({ ok: true });
  });
});
