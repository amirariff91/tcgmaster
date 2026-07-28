import { describe, expect, it, vi } from 'vitest';
import { upsertMapping, type SourceMapping } from './mapping';

function mapping(confidence: SourceMapping['confidence']): SourceMapping {
  return {
    cardId: 'card-1',
    source: 'tcgplayer',
    externalId: '544575',
    externalUrl: null,
    externalTitle: 'Uta OP-EB01-041',
    externalSet: null,
    confidence,
    matchedBy: 'dictionary',
    evidence: null,
    verifiedAt: null,
  };
}

function stubDb(existing: SourceMapping | null) {
  const upsert = vi.fn().mockReturnValue({
    select: () => ({
      single: async () => ({
        data: {
          card_id: 'card-1',
          source: 'tcgplayer',
          external_id: '544575',
          external_url: null,
          external_title: 'Uta OP-EB01-041',
          external_set: null,
          confidence: 'derived',
          matched_by: 'dictionary',
          evidence: null,
          verified_at: null,
        },
        error: null,
      }),
    }),
  });
  const maybeSingle = async () => ({
    data: existing && {
      card_id: existing.cardId,
      source: existing.source,
      external_id: existing.externalId,
      external_url: existing.externalUrl,
      external_title: existing.externalTitle,
      external_set: existing.externalSet,
      confidence: existing.confidence,
      matched_by: existing.matchedBy,
      evidence: existing.evidence,
      verified_at: existing.verifiedAt,
    },
    error: null,
  });
  const db = {
    from: () => ({
      upsert,
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }),
    }),
  };
  return { db: db as never, upsert };
}

describe('upsertMapping', () => {
  it('does not downgrade a confirmed mapping with a derived write', async () => {
    const { db, upsert } = stubDb(mapping('confirmed'));
    const result = await upsertMapping(db, mapping('derived'));
    expect(result.written).toBe(false);
    expect(result.mapping.confidence).toBe('confirmed');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('writes a derived mapping when nothing confirmed exists', async () => {
    const { db, upsert } = stubDb(mapping('derived'));
    const result = await upsertMapping(db, mapping('derived'));
    expect(result.written).toBe(true);
    expect(upsert).toHaveBeenCalledOnce();
  });

  it('force overrides the downgrade guard', async () => {
    const { db, upsert } = stubDb(mapping('confirmed'));
    const result = await upsertMapping(db, mapping('rejected'), { force: true });
    expect(result.written).toBe(true);
    expect(upsert).toHaveBeenCalledOnce();
  });

  it('confirmed writes skip the existence pre-read', async () => {
    const { db, upsert } = stubDb(mapping('derived'));
    const result = await upsertMapping(db, mapping('confirmed'));
    expect(result.written).toBe(true);
    expect(upsert).toHaveBeenCalledOnce();
  });
});
