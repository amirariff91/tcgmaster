export type CanonicalGrade = 'raw' | 'psa7' | 'psa8' | 'psa9' | 'psa95' | 'psa10';

export const GRADE_OPTIONS: { value: CanonicalGrade; label: string }[] = [
  { value: 'raw', label: 'Raw' },
  { value: 'psa7', label: 'PSA 7' },
  { value: 'psa8', label: 'PSA 8' },
  { value: 'psa9', label: 'PSA 9' },
  { value: 'psa10', label: 'PSA 10' },
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

    const psaMatch = value.match(/^psa[\s-]?(\d+(?:\.\d+)?)$/);
    if (psaMatch) {
      const normalized = numericGradeToken(psaMatch[1]);
      if (normalized) return normalized;
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
    default: {
      const numericGrade = runtimeGrade.replace(/^psa/, '');
      const legacyNumericGrade = numericGrade === '95' ? '9.5' : numericGrade;
      return [g, `psa-${legacyNumericGrade}`, legacyNumericGrade];
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

  if (Object.keys(map).some((key) => key.startsWith('psa'))) {
    console.error('Structural grade lookup miss:', { grade: g, candidates });
  }

  return null;
}
