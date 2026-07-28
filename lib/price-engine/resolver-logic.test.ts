import { describe, expect, it } from 'vitest';
import type { MatchEvidence } from './identity';
import {
  classifyCandidate,
  extractQualifiers,
  selectPriceChartingCandidate,
} from './resolver-logic';

const card = {
  number: 'OP-EB01-041',
  slug: 'op-op-eb01-041',
  name: 'Uta',
};

function evidence(overrides: Partial<MatchEvidence> = {}): MatchEvidence {
  return {
    externalTitle: 'Uta OP-EB01-041',
    externalUrl: 'https://www.pricecharting.com/game/one-piece-card-game/uta-op-eb01-041',
    matchedBy: 'search',
    ...overrides,
  };
}

describe('extractQualifiers', () => {
  it('extracts bracketed qualifiers as normalized tokens', () => {
    expect(extractQualifiers('Monkey D Luffy [SP Gold] OP01-003 [ Holo ]')).toEqual([
      'sp gold',
      'holo',
    ]);
  });
});

describe('classifyCandidate', () => {
  it('skips an unknown qualifier', () => {
    expect(classifyCandidate({
      card,
      evidence: evidence({ externalTitle: 'Uta [Foil] OP-EB01-041' }),
      qualifierMap: new Map(),
      source: 'pricecharting',
    })).toEqual({ action: 'skip', reason: 'unknown-qualifier:foil' });
  });

  it('rejects a distinct printing', () => {
    expect(classifyCandidate({
      card,
      evidence: evidence({ externalTitle: 'Uta [SP Gold] OP-EB01-041' }),
      qualifierMap: new Map([['sp gold', 'distinct_printing']]),
      source: 'pricecharting',
    })).toEqual({ action: 'reject', reason: 'distinct-printing:sp gold' });
  });

  it('skips a Japanese card matched to a non-Japanese PriceCharting path', () => {
    expect(classifyCandidate({
      card: { ...card, slug: 'op-op-eb01-041-ja' },
      evidence: evidence(),
      qualifierMap: new Map(),
      source: 'pricecharting',
    })).toEqual({ action: 'skip', reason: 'language-mismatch' });
  });

  it('skips an English card matched to a Japanese PriceCharting path', () => {
    expect(classifyCandidate({
      card,
      evidence: evidence({
        externalUrl: 'https://www.pricecharting.com/game/one-piece-card-game-japanese/uta-op-eb01-041',
      }),
      qualifierMap: new Map(),
      source: 'pricecharting',
    })).toEqual({ action: 'skip', reason: 'language-mismatch' });
  });

  it('accepts a base printing and derives its PriceCharting set', () => {
    expect(classifyCandidate({
      card,
      evidence: evidence({
        externalTitle: 'Uta OP-EB01-041',
        externalUrl: 'https://www.pricecharting.com/game/one-piece-card-game/uta-op-eb01-041',
      }),
      qualifierMap: new Map(),
      source: 'pricecharting',
    })).toEqual({
      action: 'accept',
      reason: 'accepted',
      externalSet: 'one-piece-card-game',
    });
  });

  it('skips a number-mismatched candidate with the identity verdict detail', () => {
    expect(classifyCandidate({
      card,
      evidence: evidence({
        externalTitle: 'Uta OP-EB01-042',
        externalUrl: 'https://www.pricecharting.com/game/one-piece-card-game/uta-op-eb01-042',
      }),
      qualifierMap: new Map(),
      source: 'pricecharting',
    })).toEqual({
      action: 'skip',
      reason: expect.stringMatching(/^number-mismatch:/),
    });
  });

  it('skips an One Piece card matched to a Dragon Ball catalogue', () => {
    expect(classifyCandidate({
      card,
      evidence: evidence({
        externalUrl: 'https://www.pricecharting.com/game/dragon-ball-super-fusion-world/uta-op-eb01-041',
      }),
      qualifierMap: new Map(),
      source: 'pricecharting',
    })).toEqual({ action: 'skip', reason: 'game-mismatch' });
  });

  it('skips a Dragon Ball card matched to an One Piece catalogue', () => {
    expect(classifyCandidate({
      card: { ...card, slug: 'dbfw-fb01-001', number: 'FB01-001' },
      evidence: evidence({
        externalTitle: 'Son Goku FB01-001',
        externalUrl: 'https://www.pricecharting.com/game/one-piece-card-game/son-goku-fb01-001',
      }),
      qualifierMap: new Map(),
      source: 'pricecharting',
    })).toEqual({ action: 'skip', reason: 'game-mismatch' });
  });

  it('treats a sold-out identity match as mappable', () => {
    expect(classifyCandidate({
      card,
      evidence: evidence({ inStock: false }),
      qualifierMap: new Map(),
      source: 'pricecharting',
    })).toEqual({
      action: 'accept',
      reason: 'accepted',
      externalSet: 'one-piece-card-game',
    });
  });

  it('selects the first accepted PriceCharting row before an earlier rejection', () => {
    const selection = selectPriceChartingCandidate({
      card,
      candidates: [
        {
          title: 'Uta [SP Gold] OP-EB01-041',
          url: 'https://www.pricecharting.com/game/one-piece-card-game/uta-sp-op-eb01-041',
        },
        {
          title: 'Uta OP-EB01-041',
          url: 'https://www.pricecharting.com/game/one-piece-card-game/uta-op-eb01-041',
        },
      ],
      qualifierMap: new Map([['sp gold', 'distinct_printing']]),
    });

    expect(selection.action).toBe('accept');
    expect(selection.candidate?.title).toBe('Uta OP-EB01-041');
  });

  it('prefers the first distinct-printing rejection when no row is accepted', () => {
    const selection = selectPriceChartingCandidate({
      card,
      candidates: [
        {
          title: 'Uta [Foil] OP-EB01-041',
          url: 'https://www.pricecharting.com/game/one-piece-card-game/uta-foil-op-eb01-041',
        },
        {
          title: 'Uta [SP Gold] OP-EB01-041',
          url: 'https://www.pricecharting.com/game/one-piece-card-game/uta-sp-op-eb01-041',
        },
      ],
      qualifierMap: new Map([['sp gold', 'distinct_printing']]),
    });

    expect(selection.action).toBe('reject');
    expect(selection.candidate?.title).toBe('Uta [SP Gold] OP-EB01-041');
  });

  it('returns the first unknown qualifier when no row is mappable', () => {
    const selection = selectPriceChartingCandidate({
      card,
      candidates: [{
        title: 'Uta [Foil] OP-EB01-041',
        url: 'https://www.pricecharting.com/game/one-piece-card-game/uta-foil-op-eb01-041',
      }],
      qualifierMap: new Map(),
    });

    expect(selection).toMatchObject({
      action: 'skip',
      reason: 'unknown-qualifier:foil',
      unknownQualifierReasons: ['unknown-qualifier:foil'],
    });
  });
});
