import { assertIdentity, type MatchEvidence } from './identity';
import type { QualifierMeaning } from './mapping';

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
  if (!identity.ok) {
    return {
      action: 'skip',
      reason: `${identity.reason}:${identity.detail}`,
    };
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
    const isJapaneseCard = card.slug.toLowerCase().endsWith('-ja');
    const isJapanesePath = pathname?.toLowerCase().includes('japanese') ?? false;

    if (!pathname || isJapaneseCard !== isJapanesePath) {
      return { action: 'skip', reason: 'language-mismatch' };
    }

    return {
      action: 'accept',
      reason: 'accepted',
      externalSet: externalSetFromPriceChartingPath(pathname),
    };
  }

  return { action: 'accept', reason: 'accepted' };
}
