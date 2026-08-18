export type CanonicalGrade = 'raw' | 'psa7' | 'psa8' | 'psa9' | 'psa95' | 'psa10' | 'bgs9' | 'bgs95' | 'bgs10' | 'cgc9' | 'cgc95' | 'cgc10' | 'ars9' | 'ars10' | 'ars10plus';

export const GRADE_OPTIONS: { value: CanonicalGrade; label: string }[] = [
  { value: 'raw', label: 'Raw' },
  { value: 'psa7', label: 'PSA 7' },
  { value: 'psa8', label: 'PSA 8' },
  { value: 'psa9', label: 'PSA 9' },
  { value: 'psa10', label: 'PSA 10' },
  { value: 'bgs9', label: 'BGS 9' },
  { value: 'bgs95', label: 'BGS 9.5' },
  { value: 'bgs10', label: 'BGS 10' },
  { value: 'cgc9', label: 'CGC 9' },
  { value: 'cgc95', label: 'CGC 9.5' },
  { value: 'cgc10', label: 'CGC 10' },
  { value: 'ars9', label: 'ARS 9' },
  { value: 'ars10', label: 'ARS 10' },
  { value: 'ars10plus', label: 'ARS 10+' },
];

function numericGradeToken(value: string | number): CanonicalGrade | null {
  const text = typeof value === 'number' ? String(value) : value;

  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;

  const numericValue = Number(text);
  if (!Number.isFinite(numericValue)) return null;

  const normalized = String(numericValue).replace('.', '');
  return `psa${normalized}` as CanonicalGrade;
}

export function normalizeGrade(input: string | number | null | undefined): CanonicalGrade {
  if (input === null || input === undefined) return 'raw';

  if (typeof input === 'string') {
    const value = input.trim().toLowerCase();
    if (!value || value === 'raw') return 'raw';

    // Match ARS 10+ explicitly
    const arsPlusMatch = value.match(/^ars[\s-]?10\+$/);
    if (arsPlusMatch) {
      return 'ars10plus';
    }

    const psaMatch = value.match(/^(psa|bgs|cgc|ars)[\s-]?(\d+(?:\.\d+)?)$/);
    if (psaMatch) {
      const company = psaMatch[1];
      const numericPart = numericGradeToken(psaMatch[2]);
      if (numericPart) {
        return `${company}${numericPart.replace('psa', '')}` as CanonicalGrade;
      }
    }

    const normalized = numericGradeToken(value);
    if (normalized) return normalized;
  } else if (typeof input === 'number') {
    const normalized = numericGradeToken(input);
    if (normalized) return normalized;
  }

  console.error('Unrecognized grade input; falling back to raw:', input);
  return 'raw';
}

export function gradeKeyCandidates(g: CanonicalGrade): string[] {
  const runtimeGrade = g as string;

  switch (g) {
    case 'raw':
      return ['raw'];
    case 'psa7':
      return ['psa7', 'psa-7', '7'];
    case 'psa8':
      return ['psa8', 'psa-8', '8'];
    case 'psa9':
      return ['psa9', 'psa-9', '9'];
    case 'psa95':
      return ['psa95', 'psa-9.5', '9.5'];
    case 'psa10':
      return ['psa10', 'psa-10', '10'];
    case 'bgs9':
      return ['bgs9', 'bgs-9'];
    case 'bgs95':
      return ['bgs95', 'bgs-9.5'];
    case 'bgs10':
      return ['bgs10', 'bgs-10'];
    case 'cgc9':
      return ['cgc9', 'cgc-9'];
    case 'cgc95':
      return ['cgc95', 'cgc-9.5'];
    case 'cgc10':
      return ['cgc10', 'cgc-10'];
    case 'ars9':
      return ['ars9', 'ars-9'];
    case 'ars10':
      return ['ars10', 'ars-10'];
    case 'ars10plus':
      return ['ars10plus', 'ars10+', 'ars-10+', 'ars-10plus'];
    default: {
      const numericGrade = runtimeGrade.replace(/^(psa|bgs|cgc|ars)/, '');
      const company = runtimeGrade.match(/^(psa|bgs|cgc|ars)/)?.[1] || 'psa';
      const legacyNumericGrade = numericGrade === '95' ? '9.5' : numericGrade;
      return [g, `${company}-${legacyNumericGrade}`, legacyNumericGrade];
    }
  }
}

export function lookupGraded<T>(map: Record<string, T> | null | undefined, g: CanonicalGrade): T | null {
  if (!map) return null;

  const candidates = gradeKeyCandidates(g);
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(map, candidate)) {
      return map[candidate] ?? null;
    }
  }

  if (Object.keys(map).some((key) => /^(psa|bgs|cgc|ars)/.test(key))) {
    console.error('Structural grade lookup miss:', { grade: g, candidates });
  }

  return null;
}
