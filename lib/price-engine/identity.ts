import { numberMatchesOnBoundary, parseCardNumber } from './card-number';

export interface MatchEvidence {
  externalUrl?: string;
  externalId?: string;
  externalTitle?: string;
  externalSet?: string;
  inStock?: boolean;
  matchedBy: 'search' | 'cached-url' | 'product-id' | 'dictionary';
}

export interface ExpectedIdentity {
  number: string;
  name?: string;
}

export type IdentityVerdict =
  | { ok: true }
  | { ok: false; reason: 'number-mismatch' | 'no-evidence' | 'sold-out'; detail: string };

function urlMatchesNumber(url: string, baseNumber: string): boolean {
  if (numberMatchesOnBoundary(url, baseNumber)) return true;

  // URLs use path/query separators instead of whitespace. Strip a variant suffix
  // and turn URL punctuation into spaces before using the shared token matcher.
  const searchableUrl = url
    .replace(/[-_][pr]\d+(?=$|[^a-z0-9])/gi, ' ')
    .replace(/[/?#=&.]/g, ' ');
  return numberMatchesOnBoundary(searchableUrl, baseNumber);
}

export function assertIdentity(
  expected: ExpectedIdentity,
  evidence: MatchEvidence | null | undefined,
  strict: boolean = true,
): IdentityVerdict {
  if (!evidence || Object.keys(evidence).length === 0 || !evidence.externalTitle?.trim()) {
    return { ok: false, reason: 'no-evidence', detail: 'Matched product evidence is missing its external title.' };
  }

  if (strict && evidence.inStock === false) {
    return { ok: false, reason: 'sold-out', detail: 'Matched product is marked sold out.' };
  }

  const baseNumber = parseCardNumber(expected.number).base;
  const titleMatches = numberMatchesOnBoundary(evidence.externalTitle, baseNumber);
  const urlMatches = (evidence.matchedBy === 'search' || evidence.matchedBy === 'dictionary')
    && evidence.externalUrl
    ? urlMatchesNumber(evidence.externalUrl, baseNumber)
    : false;

  if (!titleMatches && !urlMatches) {
    return {
      ok: false,
      reason: 'number-mismatch',
      detail: `Expected card number ${baseNumber} was not found as a token in the matched title or URL.`,
    };
  }

  return { ok: true };
}
