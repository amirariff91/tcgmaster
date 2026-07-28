// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Vitest is supplied by the later test package.
import { describe, it, expect } from 'vitest';
import { gradeKeyCandidates, lookupGraded, normalizeGrade } from './grades';

describe('normalizeGrade', () => {
  it('normalizes all live spellings of PSA 10', () => {
    const inputs: Array<string | number> = ['10', 10, 'psa10', 'psa-10', 'PSA 10'];

    for (const input of inputs) {
      expect(normalizeGrade(input)).toBe('psa10');
    }
  });

  it('normalizes the 9.5 spellings', () => {
    const inputs: Array<string | number> = ['9.5', 'psa9.5', 'psa-9.5'];

    for (const input of inputs) {
      expect(normalizeGrade(input)).toBe('psa95');
    }
  });

  it('preserves raw for raw-like input', () => {
    for (const input of ['raw', '', null, undefined] as const) {
      expect(normalizeGrade(input)).toBe('raw');
    }
  });

  it('normalizes numeric input and numeric-like grades', () => {
    expect(normalizeGrade(8)).toBe('psa8');
    expect(normalizeGrade(9.5)).toBe('psa95');
    expect(normalizeGrade('6')).toBe('psa6');
  });

  it('logs once and falls back to raw for truly unrecognizable input', () => {
    const originalError = console.error;
    let errorCount = 0;
    console.error = () => {
      errorCount++;
    };

    try {
      expect(normalizeGrade('not-a-grade')).toBe('raw');
      expect(errorCount).toBe(1);
    } finally {
      console.error = originalError;
    }
  });
});

describe('gradeKeyCandidates', () => {
  it('orders the canonical spelling before legacy spellings', () => {
    expect(gradeKeyCandidates('psa10')).toEqual(['psa10', 'psa-10', '10']);
    expect(gradeKeyCandidates('psa95')).toEqual(['psa95', 'psa-9.5', '9.5']);
    expect(gradeKeyCandidates('raw')).toEqual(['raw']);
  });
});

describe('lookupGraded', () => {
  it('finds every legacy spelling for PSA 10 and 9.5', () => {
    for (const grade of ['psa10', 'psa95'] as const) {
      for (const key of gradeKeyCandidates(grade)) {
        expect(lookupGraded({ [key]: 42 }, grade)).toBe(42);
      }
    }
  });

  it('warns on a structural miss when the map has other PSA keys', () => {
    const originalError = console.error;
    let errorCount = 0;
    console.error = () => {
      errorCount++;
    };

    try {
      expect(lookupGraded({ psa10: 42 }, 'psa9')).toBeNull();
      expect(errorCount).toBe(1);
    } finally {
      console.error = originalError;
    }
  });
});
