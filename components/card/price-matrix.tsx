'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrencyContext } from '@/lib/currency-context';

interface PriceMatrixProps {
  rawPrices: {
    nearMint: number | null;
    lightlyPlayed: number | null;
    moderatelyPlayed: number | null;
    heavilyPlayed: number | null;
  };
  gradedPrices: Record<string, {
    average: number | null;
    median: number | null;
    low: number | null;
    high: number | null;
    count: number;
  }>;
  className?: string;
  defaultExpanded?: boolean;
}

const GRADE_ORDER = ['psa7', 'psa8', 'psa9', 'psa10'];
const GRADE_LABELS: Record<string, string> = {
  psa7: 'PSA 7',
  psa8: 'PSA 8',
  psa9: 'PSA 9',
  psa10: 'PSA 10',
};

const CONDITION_ORDER = ['nearMint', 'lightlyPlayed', 'moderatelyPlayed', 'heavilyPlayed'] as const;
const CONDITION_LABELS: Record<string, string> = {
  nearMint: 'Near Mint',
  lightlyPlayed: 'Lightly Played',
  moderatelyPlayed: 'Moderately Played',
  heavilyPlayed: 'Heavily Played',
};
const CONDITION_SHORT: Record<string, string> = {
  nearMint: 'NM',
  lightlyPlayed: 'LP',
  moderatelyPlayed: 'MP',
  heavilyPlayed: 'HP',
};

export function PriceMatrix({
  rawPrices,
  gradedPrices,
  className,
  defaultExpanded = false,
}: PriceMatrixProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const { format } = useCurrencyContext();

  const nmPrice = rawPrices.nearMint;
  const psa9Price = gradedPrices.psa9?.average;
  const psa10Price = gradedPrices.psa10?.average;

  const availableGrades = GRADE_ORDER.filter((grade) => gradedPrices[grade]?.average);
  const hasRawPrices = Object.values(rawPrices).some(p => p !== null);

  return (
    <div className={cn('rounded-lg border border-zinc-200 bg-white', className)}>
      {/* Summary Row — always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 transition-colors rounded-lg"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          {nmPrice !== null && (
            <div className="text-left min-w-0">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Raw NM</p>
              <p className="text-base sm:text-lg font-bold text-zinc-900 tabular-nums">
                {format(nmPrice)}
              </p>
            </div>
          )}
          {psa9Price !== null && (
            <div className="text-left border-l border-zinc-200 pl-3 sm:pl-6 min-w-0">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">PSA 9</p>
              <p className="text-base sm:text-lg font-bold text-zinc-900 tabular-nums">
                {format(psa9Price)}
              </p>
            </div>
          )}
          {psa10Price !== null && (
            <div className="text-left border-l border-zinc-200 pl-3 sm:pl-6 min-w-0">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">PSA 10</p>
              <p className="text-base sm:text-lg font-bold text-emerald-600 tabular-nums">
                {format(psa10Price)}
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2 text-zinc-500 flex-shrink-0 ml-2">
          <span className="text-xs sm:text-sm hidden xs:inline">
            {isExpanded ? 'Less' : 'All grades'}
          </span>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-zinc-200">

          {/* ── MOBILE: two stacked sections ── */}
          <div className="md:hidden divide-y divide-zinc-100">

            {/* Raw prices by condition */}
            {hasRawPrices && (
              <div className="p-4">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                  Raw (Ungraded)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {CONDITION_ORDER.map((cond) => {
                    const price = rawPrices[cond];
                    if (price === null) return null;
                    return (
                      <div key={cond} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2">
                        <span className="text-sm text-zinc-500">{CONDITION_SHORT[cond]}</span>
                        <span className="text-sm font-semibold text-zinc-900 tabular-nums">
                          {format(price)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Graded prices */}
            {availableGrades.length > 0 && (
              <div className="p-4">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                  Graded (PSA)
                </p>
                <div className="space-y-2">
                  {availableGrades.map((grade) => {
                    const d = gradedPrices[grade];
                    if (!d?.average) return null;
                    return (
                      <div key={grade} className="rounded-lg bg-zinc-50 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            'text-sm font-semibold',
                            grade === 'psa10' ? 'text-emerald-700' : 'text-zinc-700'
                          )}>
                            {GRADE_LABELS[grade]}
                          </span>
                          <span className={cn(
                            'text-sm font-bold tabular-nums',
                            grade === 'psa10' ? 'text-emerald-600' : 'text-zinc-900'
                          )}>
                            {format(d.average)}
                          </span>
                        </div>
                        {(d.low || d.high || d.count > 0) && (
                          <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                            {d.low && <span>Low: {format(d.low)}</span>}
                            {d.high && <span>High: {format(d.high)}</span>}
                            {d.count > 0 && <span>{d.count} sales</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── DESKTOP: full conditions × grades table ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50">
                  <th className="px-4 py-3 text-left font-semibold text-zinc-500">Condition</th>
                  <th className="px-4 py-3 text-right font-semibold text-zinc-500">Raw</th>
                  {availableGrades.map((grade) => (
                    <th key={grade} className="px-4 py-3 text-right font-semibold text-zinc-500">
                      {GRADE_LABELS[grade]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {CONDITION_ORDER.map((condition, index) => {
                  const rawPrice = rawPrices[condition];
                  const validGradesForCondition = availableGrades.filter((grade) => {
                    const gradeNum = parseInt(grade.replace('psa', ''), 10);
                    if (condition === 'nearMint') return true;
                    if (condition === 'lightlyPlayed') return gradeNum <= 9;
                    if (condition === 'moderatelyPlayed') return gradeNum <= 8;
                    return gradeNum <= 7;
                  });

                  return (
                    <tr
                      key={condition}
                      className={cn('hover:bg-zinc-50', index % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50')}
                    >
                      <td className="px-4 py-3 font-medium text-zinc-700">
                        {CONDITION_LABELS[condition]}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {rawPrice !== null ? (
                          <span className="font-semibold text-zinc-900">{format(rawPrice)}</span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      {availableGrades.map((grade) => {
                        const gradePrice = gradedPrices[grade]?.average;
                        const isValid = validGradesForCondition.includes(grade);
                        return (
                          <td key={grade} className="px-4 py-3 text-right">
                            {isValid && gradePrice !== null ? (
                              <span className={cn('font-semibold', grade === 'psa10' ? 'text-emerald-600' : 'text-zinc-900')}>
                                {format(gradePrice)}
                              </span>
                            ) : (
                              <span className="text-zinc-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Footer: sales counts */}
            {availableGrades.some(g => gradedPrices[g]?.count > 0) && (
              <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-2">
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span>Recent sales:</span>
                  {availableGrades.map((grade) => {
                    const count = gradedPrices[grade]?.count || 0;
                    return count > 0 ? (
                      <span key={grade}>{GRADE_LABELS[grade]}: {count}</span>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Compact version for card previews
interface CompactPriceMatrixProps {
  rawPrice: number | null;
  psa9Price: number | null;
  psa10Price: number | null;
  className?: string;
}

export function CompactPriceMatrix({ rawPrice, psa9Price, psa10Price, className }: CompactPriceMatrixProps) {
  const { format } = useCurrencyContext();

  return (
    <div className={cn('flex items-center gap-3 text-sm flex-wrap', className)}>
      {rawPrice !== null && (
        <div>
          <span className="text-zinc-500">Raw: </span>
          <span className="font-semibold">{format(rawPrice)}</span>
        </div>
      )}
      {psa9Price !== null && (
        <div className="border-l border-zinc-200 pl-3">
          <span className="text-zinc-500">PSA 9: </span>
          <span className="font-semibold">{format(psa9Price)}</span>
        </div>
      )}
      {psa10Price !== null && (
        <div className="border-l border-zinc-200 pl-3">
          <span className="text-zinc-500">PSA 10: </span>
          <span className="font-semibold text-emerald-600">{format(psa10Price)}</span>
        </div>
      )}
    </div>
  );
}
