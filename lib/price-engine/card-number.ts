export interface ParsedCardNumber {
  base: string;
  suffix: string | null;
}

const CARD_NUMBER = /^([A-Za-z0-9]+-\d+)(?:[-_](.+))?$/;

export function parseCardNumber(raw: string): ParsedCardNumber {
  const match = raw.trim().match(CARD_NUMBER);

  if (!match) {
    return { base: raw, suffix: null };
  }

  return {
    base: match[1],
    suffix: match[2] ? match[2].toLowerCase() : null,
  };
}

// Boundary = any non-alphanumeric character or the string edge. Splitting on whitespace
// is not enough: CJK shop titles glue the number to other glyphs (「【L☆】{FB03-078}」),
// and a substring test would let OP01-001 match inside OP01-0010 — the original
// PriceCharting bug class this matcher exists to prevent.
export function numberMatchesOnBoundary(text: string, baseNumber: string): boolean {
  if (!baseNumber || !text) return false;

  const escaped = baseNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const boundary = new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, 'i');
  return boundary.test(text);
}
