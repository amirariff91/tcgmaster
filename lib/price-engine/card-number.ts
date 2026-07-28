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

function normalizeToken(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function numberMatchesOnBoundary(text: string, baseNumber: string): boolean {
  if (!baseNumber) return false;

  const wantedNumber = normalizeToken(baseNumber);
  return text.trim().split(/\s+/).some((token) => normalizeToken(token) === wantedNumber);
}
