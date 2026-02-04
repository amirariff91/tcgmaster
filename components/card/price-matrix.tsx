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

// Grade display order
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
  lightlyPlayed: 'Light Play',
  moderatelyPlayed: 'Moderate',
  heavilyPlayed: 'Heavy Play',
};

export function PriceMatrix({
  rawPrices,
  gradedPrices,
  className,
  defaultExpanded = false,
}: PriceMatrixProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const { format } = useCurrencyContext();

  // Get the key prices for summary row
  const nmPrice = rawPrices.nearMint;
  const psa9Price = gradedPrices.psa9?.average;
  const psa10Price = gradedPrices.psa10?.average;

  // Check which grades have data
  const availableGrades = GRADE_ORDER.filter((grade) => gradedPrices[grade]?.average);

  return (
    <div className={cn('rounded-lg border border-zinc-200', className)}>
      {/* Summary Row - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 transition-colors"
      >
        <div className="flex items-center gap-6">
          {nmPrice !== null && (
            <div className="text-left">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Raw NM</p>
              <p className="text-lg font-bold text-zinc-900">
                {format(nmPrice)}
              </p>
            </div>
          )}

          {psa9Price !== null && (
            <div className="text-left border-l border-zinc-200 pl-6">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">PSA 9</p>
              <p className="text-lg font-bold text-zinc-900">
                {format(psa9Price)}
              </p>
            </div>
          )}

          {psa10Price !== null && (
            <div className="text-left border-l border-zinc-200 pl-6">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">PSA 10</p>
              <p className="text-lg font-bold text-emerald-600">
                {format(psa10Price)}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-zinc-500">
          <span className="text-sm">{isExpanded ? 'Less' : 'More'}</span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </button>

      {/* Expanded Matrix - Condition x Grade */}
      {isExpanded && (
        <div className="border-t border-zinc-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50">
                <th className="px-4 py-3 text-left font-semibold text-zinc-500">
                  Condition
                </th>
                <th className="px-4 py-3 text-right font-semibold text-zinc-500">
                  Raw
                </th>
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

                // Skip conditions that have no data
                if (rawPrice === null && !availableGrades.some((g) => gradedPrices[g]?.average)) {
                  return null;
                }

                // Determine which graded prices are valid for this condition
                // Lower conditions can't achieve higher grades
                const validGradesForCondition = availableGrades.filter((grade) => {
                  const gradeNum = parseInt(grade.replace('psa', ''), 10);
                  // Near Mint can get any grade
                  // Light Play typically can't get PSA 10
                  // Moderate can't get PSA 9+
                  // Heavy can't get PSA 8+
                  if (condition === 'nearMint') return true;
                  if (condition === 'lightlyPlayed') return gradeNum <= 9;
                  if (condition === 'moderatelyPlayed') return gradeNum <= 8;
                  return gradeNum <= 7;
                });

                return (
                  <tr
                    key={condition}
                    className={cn(
                      'hover:bg-zinc-50',
                      index % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50'
                    )}
                  >
                    <td className="px-4 py-3 font-medium text-zinc-700">
                      {CONDITION_LABELS[condition]}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {rawPrice !== null ? (
                        <span className="font-semibold text-zinc-900">
                          {format(rawPrice)}
                        </span>
                      ) : (
                        <span className="text-zinc-300">-</span>
                      )}
                    </td>
                    {availableGrades.map((grade) => {
                      const gradePrice = gradedPrices[grade]?.average;
                      const isValidForCondition = validGradesForCondition.includes(grade);

                      return (
                        <td key={grade} className="px-4 py-3 text-right">
                          {isValidForCondition && gradePrice !== null ? (
                            <span className={cn(
                              'font-semibold',
                              grade === 'psa10'
                                ? 'text-emerald-600'
                                : 'text-zinc-900'
                            )}>
                              {format(gradePrice)}
                            </span>
                          ) : (
                            <span className="text-zinc-300">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Sales count footer */}
          <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-2">
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <span>Recent sales:</span>
              {availableGrades.map((grade) => {
                const count = gradedPrices[grade]?.count || 0;
                return (
                  <span key={grade}>
                    {GRADE_LABELS[grade]}: {count}
                  </span>
                );
              })}
            </div>
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

export function CompactPriceMatrix({
  rawPrice,
  psa9Price,
  psa10Price,
  className,
}: CompactPriceMatrixProps) {
  const { format } = useCurrencyContext();

  return (
    <div className={cn('flex items-center gap-3 text-sm', className)}>
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
