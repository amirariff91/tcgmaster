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
  | { ok: false; reason: 'number-mismatch' | 'variant-mismatch' | 'no-evidence' | 'sold-out'; detail: string };

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

  // Direct product-id match: e.g. TCGPlayer verified product pages where product title is card name without number
  const cleanExpectedName = (expected.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const cleanExtTitle = evidence.externalTitle.trim().toLowerCase().replace(/\s+/g, ' ');
  const isDirectProductMatch = evidence.matchedBy === 'product-id' && Boolean(
    cleanExpectedName && (
      cleanExtTitle === cleanExpectedName
      || cleanExtTitle.includes(cleanExpectedName)
      || cleanExpectedName.includes(cleanExtTitle)
    )
  );

  if (!titleMatches && !urlMatches && !isDirectProductMatch) {
    return {
      ok: false,
      reason: 'number-mismatch',
      detail: `Expected card number ${baseNumber} was not found as a token in the matched title or URL.`,
    };
  }

  // Variant disambiguation: Ensure base cards don't absorb variant/alt art listings,
  // and variant cards don't absorb base listings.
  const suffix = parseCardNumber(expected.number).suffix;
  const isVariant = Boolean(suffix && /^(p\d+|r\d+|alt|sp)$/i.test(suffix));
  const textToCheck = `${evidence.externalTitle} ${evidence.externalUrl || ''}`.toLowerCase();
  const isVariantListing = /parallel|alt(ernate)?\s*art|manga|comic|wanted\s*poster|special\s*card|パラレル|コミックパラレル|シリアル/i.test(textToCheck);

  if (!isVariant && isVariantListing) {
    return {
      ok: false,
      reason: 'variant-mismatch',
      detail: `Base card ${expected.number} rejected variant external listing: "${evidence.externalTitle}"`,
    };
  }

  if (isVariant && !isVariantListing && (evidence.matchedBy === 'search' || evidence.matchedBy === 'dictionary')) {
    return {
      ok: false,
      reason: 'variant-mismatch',
      detail: `Variant card ${expected.number} rejected non-variant external listing: "${evidence.externalTitle}"`,
    };
  }

  return { ok: true };
}
