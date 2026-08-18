import { describe, expect, it, vi } from 'vitest';
import { markForReverification, upsertMapping, type SourceMapping } from './mapping';

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
  const returnedRow = {
    card_id: 'card-1',
    source: 'tcgplayer',
    external_id: existing?.externalId ?? '544575',
    external_url: existing?.externalUrl ?? null,
    external_title: existing?.externalTitle ?? 'Uta OP-EB01-041',
    external_set: existing?.externalSet ?? null,
    confidence: existing?.confidence ?? 'derived',
    matched_by: existing?.matchedBy ?? 'dictionary',
    evidence: existing?.evidence ?? null,
    verified_at: existing?.verifiedAt ?? null,
  };
  const query = vi.fn(async (text: string) => {
    if (text.includes('SELECT *') && text.includes('card_source_mapping')) {
      return existing ? [returnedRow] : [];
    }
    if (text.includes('INSERT INTO card_source_mapping')) {
      return [returnedRow];
    }
    return [];
  });
  return { db: query as never, query };
}

describe('upsertMapping', () => {
  it('does not downgrade a confirmed mapping with a derived write', async () => {
    const { db, query } = stubDb(mapping('confirmed'));
    const result = await upsertMapping(db, mapping('derived'));
    expect(result.written).toBe(false);
    expect(result.mapping.confidence).toBe('confirmed');
    expect(query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO card_source_mapping'), expect.anything());
  });

  it('writes a derived mapping when nothing confirmed exists', async () => {
    const { db, query } = stubDb(null);
    const result = await upsertMapping(db, mapping('derived'));
    expect(result.written).toBe(true);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO card_source_mapping'), expect.anything());
  });

  it('force overrides the downgrade guard', async () => {
    const { db, query } = stubDb(mapping('confirmed'));
    const result = await upsertMapping(db, mapping('rejected'), { force: true });
    expect(result.written).toBe(true);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO card_source_mapping'), expect.anything());
  });

  it('confirmed writes skip the existence pre-read', async () => {
    const { db, query } = stubDb(null);
    const result = await upsertMapping(db, mapping('confirmed'));
    expect(result.written).toBe(true);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO card_source_mapping'), expect.anything());
  });
});

describe('markForReverification', () => {
  it('marks the existing mapping in evidence while clearing verification', async () => {
    const query = vi.fn(async (text: string) => {
      if (text.includes('SELECT *')) {
        return [{
          card_id: 'card-1',
          source: 'tcgplayer',
          external_id: '544575',
          external_url: null,
          external_title: 'Uta OP-EB01-041',
          external_set: 'one-piece-card-game',
          confidence: 'confirmed',
          matched_by: 'manual',
          evidence: { seededFrom: 'dictionary' },
          verified_at: '2026-07-28T00:00:00.000Z',
        }];
      }
      return [];
    });

    await markForReverification(query as never, 'card-1', 'tcgplayer');

    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE card_source_mapping'), expect.arrayContaining([
      'card-1',
      'tcgplayer',
      JSON.stringify({ reverify: true }),
    ]));
  });
});
