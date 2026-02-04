/**
 * NLP Parser for Card Search
 * Lightweight parser using Compromise.js for fast, local parsing
 * Target: ~85% accuracy, <50ms latency
 */

import nlp from 'compromise';

export interface ParsedQuery {
  cardName: string | null;
  setName: string | null;
  year: number | null;
  grade: number | null;
  gradingCompany: 'psa' | 'bgs' | 'cgc' | 'sgc' | null;
  variant: string | null;
  rarity: string | null;
  isHolo: boolean;
  confidence: number;
  suggestions: string[];
  originalQuery: string;
}

// Common grading companies and their aliases
const GRADING_COMPANIES: Record<string, 'psa' | 'bgs' | 'cgc' | 'sgc'> = {
  psa: 'psa',
  'psa graded': 'psa',
  bgs: 'bgs',
  beckett: 'bgs',
  'beckett grading': 'bgs',
  cgc: 'cgc',
  sgc: 'sgc',
};

// Common Pokemon card variants
const VARIANTS: Record<string, string> = {
  '1st edition': '1st-edition',
  '1st ed': '1st-edition',
  'first edition': '1st-edition',
  shadowless: 'shadowless',
  unlimited: 'unlimited',
  'reverse holo': 'reverse-holo',
  'reverse': 'reverse-holo',
  promo: 'promo',
  error: 'error',
};

// Common rarities
const RARITIES: string[] = [
  'common',
  'uncommon',
  'rare',
  'holo rare',
  'ultra rare',
  'secret rare',
  'illustration rare',
  'special art rare',
  'hyper rare',
];

// Known set names for matching
const SET_KEYWORDS: string[] = [
  'base set',
  'jungle',
  'fossil',
  'team rocket',
  'gym heroes',
  'gym challenge',
  'neo genesis',
  'neo discovery',
  'neo revelation',
  'neo destiny',
  'legendary collection',
  'expedition',
  'aquapolis',
  'skyridge',
  'crown zenith',
  '151',
  'evolving skies',
  'celebrations',
  'shining fates',
  'hidden fates',
  'brilliant stars',
  'astral radiance',
  'lost origin',
  'silver tempest',
  'scarlet violet',
  'paldea evolved',
  'obsidian flames',
  '151 master set',
  'temporal forces',
  'twilight masquerade',
  'shrouded fable',
  'stellar crown',
  'surging sparks',
  'prismatic evolutions',
];

/**
 * Parse a search query into structured components
 */
export function parseSearchQuery(query: string): ParsedQuery {
  const originalQuery = query;
  let q = query.toLowerCase().trim();
  let confidence = 0.5; // Start at 50%
  const suggestions: string[] = [];

  // Initialize result
  const result: ParsedQuery = {
    cardName: null,
    setName: null,
    year: null,
    grade: null,
    gradingCompany: null,
    variant: null,
    rarity: null,
    isHolo: false,
    confidence: 0,
    suggestions: [],
    originalQuery,
  };

  // Extract grading company and grade (e.g., "PSA 10", "BGS 9.5")
  const gradeMatch = q.match(/\b(psa|bgs|cgc|sgc|beckett)\s*(\d+(?:\.\d+)?)\b/i);
  if (gradeMatch) {
    result.gradingCompany = GRADING_COMPANIES[gradeMatch[1].toLowerCase()] || null;
    result.grade = parseFloat(gradeMatch[2]);
    q = q.replace(gradeMatch[0], ' ');
    confidence += 0.15;
  }

  // Extract just grading company without grade
  if (!result.gradingCompany) {
    for (const [key, value] of Object.entries(GRADING_COMPANIES)) {
      if (q.includes(key)) {
        result.gradingCompany = value;
        q = q.replace(new RegExp(`\\b${key}\\b`, 'gi'), ' ');
        confidence += 0.1;
        break;
      }
    }
  }

  // Extract year (1990-2030)
  const yearMatch = q.match(/\b(19\d{2}|20[0-3]\d)\b/);
  if (yearMatch) {
    result.year = parseInt(yearMatch[1], 10);
    q = q.replace(yearMatch[0], ' ');
    confidence += 0.1;
  }

  // Extract variants
  for (const [key, value] of Object.entries(VARIANTS)) {
    if (q.includes(key)) {
      result.variant = value;
      q = q.replace(new RegExp(key, 'gi'), ' ');
      confidence += 0.1;
      break;
    }
  }

  // Check for holo
  if (q.includes('holo') && !result.variant?.includes('reverse')) {
    result.isHolo = true;
    q = q.replace(/\bholo\b/gi, ' ');
    confidence += 0.05;
  }

  // Extract rarity
  for (const rarity of RARITIES) {
    if (q.includes(rarity)) {
      result.rarity = rarity;
      q = q.replace(new RegExp(rarity, 'gi'), ' ');
      confidence += 0.05;
      break;
    }
  }

  // Extract set name
  for (const setName of SET_KEYWORDS) {
    if (q.includes(setName)) {
      result.setName = setName;
      q = q.replace(new RegExp(setName, 'gi'), ' ');
      confidence += 0.15;
      break;
    }
  }

  // Clean up remaining query for card name
  q = q
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s'-]/g, '')
    .trim();

  // Use Compromise to extract proper nouns (likely card names)
  const doc = nlp(q);
  const nouns = doc.nouns().out('array');
  const properNouns = doc.match('#ProperNoun+').out('array');

  // The remaining text is likely the card name
  if (q.length > 0) {
    // Prioritize proper nouns
    if (properNouns.length > 0) {
      result.cardName = properNouns.join(' ');
      confidence += 0.2;
    } else if (nouns.length > 0) {
      result.cardName = nouns.join(' ');
      confidence += 0.15;
    } else {
      result.cardName = q;
      confidence += 0.1;
    }
  }

  // Generate suggestions for low confidence
  if (confidence < 0.6) {
    if (!result.gradingCompany && result.grade) {
      suggestions.push('Did you mean PSA ' + result.grade + '?');
    }
    if (!result.setName && result.year) {
      suggestions.push(`Looking for cards from ${result.year}?`);
    }
  }

  // Cap confidence at 1.0
  result.confidence = Math.min(confidence, 1.0);
  result.suggestions = suggestions;

  return result;
}

/**
 * Build a search query from parsed components
 * Useful for "Did you mean?" suggestions
 */
export function buildQueryFromParsed(parsed: Partial<ParsedQuery>): string {
  const parts: string[] = [];

  if (parsed.year) parts.push(parsed.year.toString());
  if (parsed.cardName) parts.push(parsed.cardName);
  if (parsed.variant) parts.push(parsed.variant.replace('-', ' '));
  if (parsed.setName) parts.push(parsed.setName);
  if (parsed.gradingCompany && parsed.grade) {
    parts.push(`${parsed.gradingCompany.toUpperCase()} ${parsed.grade}`);
  }

  return parts.join(' ');
}

/**
 * Get autocomplete suggestions based on partial input
 */
export function getAutocompleteSuggestions(
  query: string,
  options?: {
    limit?: number;
    includeGrades?: boolean;
    includeSets?: boolean;
  }
): string[] {
  const limit = options?.limit ?? 5;
  const suggestions: string[] = [];
  const q = query.toLowerCase().trim();

  // Suggest grading companies
  if (options?.includeGrades !== false) {
    for (const company of Object.keys(GRADING_COMPANIES)) {
      if (company.startsWith(q)) {
        for (let grade = 10; grade >= 7; grade--) {
          suggestions.push(`${company.toUpperCase()} ${grade}`);
        }
      }
    }
  }

  // Suggest sets
  if (options?.includeSets !== false) {
    for (const setName of SET_KEYWORDS) {
      if (setName.includes(q)) {
        suggestions.push(setName);
      }
    }
  }

  // Suggest variants
  for (const variant of Object.keys(VARIANTS)) {
    if (variant.includes(q)) {
      suggestions.push(variant);
    }
  }

  return suggestions.slice(0, limit);
}

/**
 * Score how well a card matches a parsed query
 */
export function scoreCardMatch(
  card: {
    name: string;
    setName?: string;
    year?: number;
    rarity?: string;
  },
  parsed: ParsedQuery
): number {
  let score = 0;

  // Card name match (most important)
  if (parsed.cardName) {
    const nameLower = card.name.toLowerCase();
    const queryLower = parsed.cardName.toLowerCase();

    if (nameLower === queryLower) {
      score += 100;
    } else if (nameLower.includes(queryLower)) {
      score += 50;
    } else if (queryLower.split(' ').every((word) => nameLower.includes(word))) {
      score += 30;
    }
  }

  // Set name match
  if (parsed.setName && card.setName) {
    const setLower = card.setName.toLowerCase();
    if (setLower.includes(parsed.setName.toLowerCase())) {
      score += 25;
    }
  }

  // Year match
  if (parsed.year && card.year) {
    if (card.year === parsed.year) {
      score += 15;
    }
  }

  // Rarity match
  if (parsed.rarity && card.rarity) {
    if (card.rarity.toLowerCase().includes(parsed.rarity)) {
      score += 10;
    }
  }

  return score;
}
