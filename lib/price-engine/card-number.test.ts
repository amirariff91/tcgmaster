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
