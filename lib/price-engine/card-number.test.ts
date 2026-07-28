import { describe, expect, it } from 'vitest';
import { numberMatchesOnBoundary, parseCardNumber } from './card-number';

describe('parseCardNumber', () => {
  it('parses an underscore suffix', () => {
    expect(parseCardNumber('OP01-001_p1')).toEqual({ base: 'OP01-001', suffix: 'p1' });
  });

  it('parses a dash suffix', () => {
    expect(parseCardNumber('FB02-035-p2')).toEqual({ base: 'FB02-035', suffix: 'p2' });
  });

  it('returns an unsuffixed card number unchanged', () => {
    expect(parseCardNumber('OP01-001')).toEqual({ base: 'OP01-001', suffix: null });
  });
});

describe('numberMatchesOnBoundary', () => {
  it('matches a number as a complete token', () => {
    expect(numberMatchesOnBoundary('Tsuru OP01-001 One Piece', 'OP01-001')).toBe(true);
  });

  it('does not match a number inside a longer token', () => {
    expect(numberMatchesOnBoundary('Tsuru OP01-0010 One Piece', 'OP01-001')).toBe(false);
  });

  it('does not match a short token inside a word', () => {
    expect(numberMatchesOnBoundary('Spider parallel', 'sp')).toBe(false);
  });
});

describe('numberMatchesOnBoundary — CJK shop titles', () => {
  it('matches a number glued to CJK glyphs and braces', () => {
    expect(numberMatchesOnBoundary('魔人ブウ(パラレル)【L☆】{FB03-078}\n [マジンブウ]', 'FB03-078')).toBe(true);
  });
  it('still refuses prefix overlap', () => {
    expect(numberMatchesOnBoundary('OP01-0010 alt art', 'OP01-001')).toBe(false);
  });
  it('matches a heading plus appended number badge', () => {
    expect(numberMatchesOnBoundary('C ウソップ | 販売 | [OP02]頂上決戦 OP02-028', 'OP02-028')).toBe(true);
  });
});
