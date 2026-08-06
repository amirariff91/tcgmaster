import { assertIdentity, type MatchEvidence } from './identity';
import type { QualifierMeaning } from './mapping';
import type { PriceChartingCandidate } from './pricecharting';

export function extractQualifiers(title: string): string[] {
  const qualifiers: string[] = [];
  const bracketed = /\[([^\]]*)\]/g;
  let match: RegExpExecArray | null;

  while ((match = bracketed.exec(title)) !== null) {
    qualifiers.push(match[1].trim().toLowerCase());
  }

  return qualifiers;
}

export interface CandidateCard {
  number: string;
  slug: string;
  name?: string;
}

export interface CandidateClassification {
  action: 'accept' | 'reject' | 'skip';
  reason: string;
  externalSet?: string;
}

interface ClassifyCandidateInput {
  card: CandidateCard;
  evidence: MatchEvidence;
  qualifierMap: Map<string, QualifierMeaning>;
  source: string;
}

export interface PriceChartingSelection {
  action: 'accept' | 'reject' | 'skip' | 'nomatch';
  reason: string;
  candidate?: PriceChartingCandidate;
  classification?: CandidateClassification;
  unknownQualifierReasons: string[];
}

function priceChartingPath(externalUrl: string): string | null {
  try {
    return new URL(externalUrl).pathname;
  } catch {
    return null;
  }
}

function externalSetFromPriceChartingPath(pathname: string): string | undefined {
  const match = pathname.match(/\/game\/([^/]+)/i);
  if (!match) return undefined;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function classifyCandidate({
  card,
  evidence,
  qualifierMap,
  source,
}: ClassifyCandidateInput): CandidateClassification {
  const identity = assertIdentity({ number: card.number, name: card.name }, evidence);
  if (!identity.ok && identity.reason !== 'sold-out') {
    return {
      action: 'skip',
      reason: `${identity.reason}:${identity.detail}`,
    };
  }

  const isVariantCard = card.slug.includes('_p') && card.slug.toLowerCase().endsWith('-ja');
  const isBaseCard = !card.slug.includes('_p') && card.slug.toLowerCase().endsWith('-ja');

  const VARIANT_KEYWORDS = [
    'alternate art', 'manga', 'parallel', 'super parallel', 'sp', 'special',
    'wanted', 'serialized', 'serial number', 'serial prize', 'anniversary',
    'top 8', 'flagship', 'winner', 'championship', 'tournament', 'premium',
    'スーパーパラレル'
  ];

  if (isVariantCard) {
    const title = (evidence.externalTitle ?? '').toLowerCase();
    const url = (evidence.externalUrl ?? '').toLowerCase();
    const combinedText = `${title} ${url}`;

    const hasVariantKeyword = VARIANT_KEYWORDS.some(kw => combinedText.includes(kw));
    if (!hasVariantKeyword) {
      return { action: 'skip', reason: 'variant-keyword-missing' };
    }
  }

  if (isBaseCard) {
    const title = (evidence.externalTitle ?? '').toLowerCase();
    const url = (evidence.externalUrl ?? '').toLowerCase();
    const combinedText = `${title} ${url}`;

    const hasVariantKeyword = VARIANT_KEYWORDS.some(kw => combinedText.includes(kw));
    if (hasVariantKeyword) {
      return { action: 'reject', reason: 'base-card-cannot-have-variant-keyword' };
    }
  }

  if (source === 'pricecharting') {
    const pathname = evidence.externalUrl ? priceChartingPath(evidence.externalUrl) : null;
    const isJapaneseCard = card.slug.toLowerCase().endsWith('-ja');
    const isJapanesePath = pathname?.toLowerCase().includes('japanese') ?? false;

    if (!pathname || isJapaneseCard !== isJapanesePath) {
      return { action: 'skip', reason: 'language-mismatch' };
    }

    const catalogue = externalSetFromPriceChartingPath(pathname)?.toLowerCase();
    const gamePrefix = card.slug.toLowerCase().split('-')[0];
    const gameMatches = gamePrefix === 'op'
      ? Boolean(catalogue?.startsWith('one-piece'))
      : gamePrefix === 'dbfw'
        ? Boolean(catalogue?.includes('dragon-ball') || catalogue?.includes('fusion-world'))
        : true;

    if (!gameMatches) {
      return { action: 'skip', reason: 'game-mismatch' };
    }
  }

  const qualifiers = extractQualifiers(evidence.externalTitle ?? '');
  for (const qualifier of qualifiers) {
    if (!qualifierMap.has(qualifier)) {
      return { action: 'skip', reason: `unknown-qualifier:${qualifier}` };
    }
  }

  for (const qualifier of qualifiers) {
    if (qualifierMap.get(qualifier) === 'distinct_printing') {
      return { action: 'reject', reason: `distinct-printing:${qualifier}` };
    }
  }

  if (source === 'pricecharting') {
    const pathname = evidence.externalUrl ? priceChartingPath(evidence.externalUrl) : null;
    return {
      action: 'accept',
      reason: 'accepted',
      externalSet: pathname ? externalSetFromPriceChartingPath(pathname) : undefined,
    };
  }

  return { action: 'accept', reason: 'accepted' };
}

export function selectPriceChartingCandidate({
  card,
  candidates,
  qualifierMap,
}: {
  card: CandidateCard;
  candidates: PriceChartingCandidate[];
  qualifierMap: Map<string, QualifierMeaning>;
}): PriceChartingSelection {
  const classified = candidates.map((candidate) => {
    const classification = classifyCandidate({
      card,
      evidence: {
        externalTitle: candidate.title,
        externalUrl: candidate.url,
        matchedBy: 'search',
      },
      qualifierMap,
      source: 'pricecharting',
    });
    return { candidate, classification };
  });

  const acceptedList = classified.filter(({ classification }) => classification.action === 'accept');

  if (acceptedList.length > 1) {
    const isVariantCard = card.slug.includes('_p') && card.slug.toLowerCase().endsWith('-ja');
    if (isVariantCard) {
      return {
        action: 'nomatch',
        reason: 'ambiguous-variant',
        unknownQualifierReasons: [],
      };
    }
  }

  if (acceptedList.length === 1) {
    const accepted = acceptedList[0];
    return {
      action: 'accept',
      reason: accepted.classification.reason,
      candidate: accepted.candidate,
      classification: accepted.classification,
      unknownQualifierReasons: [],
    };
  }

  const rejected = classified.find(({ classification }) => classification.action === 'reject');
  if (rejected) {
    return {
      action: 'reject',
      reason: rejected.classification.reason,
      candidate: rejected.candidate,
      classification: rejected.classification,
      unknownQualifierReasons: [],
    };
  }

  const unknownQualifierReasons = classified
    .map(({ classification }) => classification.reason)
    .filter((reason) => reason.startsWith('unknown-qualifier:'));
  if (unknownQualifierReasons.length > 0) {
    return {
      action: 'skip',
      reason: unknownQualifierReasons[0],
      unknownQualifierReasons,
    };
  }

  return {
    action: 'nomatch',
    reason: 'no-identity-match',
    unknownQualifierReasons: [],
  };
}
