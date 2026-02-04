'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatNumber, getGradingCompanyDisplay } from '@/lib/utils';
import { useCurrencyContext } from '@/lib/currency-context';
import { Badge } from '@/components/ui/badge';
import type { PriceLadderEntry } from '@/types';

interface PriceLadderProps {
  entries: PriceLadderEntry[];
  cardSlug: string;
  gameSlug: string;
  setSlug: string;
  activeGrade?: string;
  className?: string;
}

export function PriceLadder({
  entries,
  cardSlug,
  gameSlug,
  setSlug,
  activeGrade,
  className,
}: PriceLadderProps) {
  const { format } = useCurrencyContext();
  const maxPrice = Math.max(...entries.map((e) => e.price));

  // Sort entries: Raw first, then by grade ascending
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.grade === 'raw') return -1;
    if (b.grade === 'raw') return 1;
    return parseFloat(a.grade) - parseFloat(b.grade);
  });

  return (
    <div className={cn('space-y-2', className)}>
      <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
        Price Ladder
      </h3>
      <div className="space-y-1">
        {sortedEntries.map((entry) => {
          const gradeKey = entry.grade === 'raw'
            ? 'raw'
            : `${entry.grading_company}-${entry.grade}`;
          const isActive = activeGrade === gradeKey;
          const barWidth = (entry.price / maxPrice) * 100;

          const href = entry.grade === 'raw'
            ? `/${gameSlug}/${setSlug}/${cardSlug}`
            : `/${gameSlug}/${setSlug}/${cardSlug}/${entry.grading_company}-${entry.grade}`;

          return (
            <Link
              key={gradeKey}
              href={href}
              className={cn(
                'group flex items-center gap-3 rounded-lg p-2 transition-colors',
                isActive
                  ? 'bg-zinc-100'
                  : 'hover:bg-zinc-50'
              )}
            >
              <div className="w-20 shrink-0">
                {entry.grade === 'raw' ? (
                  <Badge variant="secondary">Raw</Badge>
                ) : (
                  <Badge variant="grade">
                    {getGradingCompanyDisplay(entry.grading_company!)} {entry.grade}
                  </Badge>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="relative h-6 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-full transition-all',
                      entry.grade === 'raw'
                        ? 'bg-zinc-400'
                        : entry.grade === '10'
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                        : parseFloat(entry.grade) >= 9
                        ? 'bg-gradient-to-r from-green-500 to-green-400'
                        : parseFloat(entry.grade) >= 8
                        ? 'bg-gradient-to-r from-lime-500 to-lime-400'
                        : parseFloat(entry.grade) >= 7
                        ? 'bg-gradient-to-r from-yellow-500 to-yellow-400'
                        : 'bg-gradient-to-r from-orange-500 to-orange-400'
                    )}
                    style={{ width: `${Math.max(barWidth, 5)}%` }}
                  />
                </div>
              </div>

              <div className="w-28 text-right">
                <span className="font-bold text-zinc-900">
                  {format(entry.price)}
                </span>
              </div>

              {entry.population !== null && (
                <div className="w-20 text-right text-sm text-zinc-500">
                  Pop: {formatNumber(entry.population)}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

interface CompactPriceLadderProps {
  entries: PriceLadderEntry[];
  className?: string;
}

export function CompactPriceLadder({ entries, className }: CompactPriceLadderProps) {
  const { format } = useCurrencyContext();
  // Show just Raw, PSA 9, and PSA 10 for compact view
  const keyGrades = ['raw', '9', '10'];
  const filteredEntries = entries.filter(
    (e) => e.grade === 'raw' || (e.grading_company === 'psa' && keyGrades.includes(e.grade))
  );

  return (
    <div className={cn('flex items-center gap-4', className)}>
      {filteredEntries.map((entry) => (
        <div key={`${entry.grade}-${entry.grading_company}`} className="text-center">
          <div className="text-xs text-zinc-500">
            {entry.grade === 'raw' ? 'Raw' : `PSA ${entry.grade}`}
          </div>
          <div className="font-semibold text-zinc-900">
            {format(entry.price)}
          </div>
        </div>
      ))}
    </div>
  );
}
