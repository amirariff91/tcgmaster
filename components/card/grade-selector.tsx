'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { getGradingCompanyDisplay } from '@/lib/utils';
import type { GradingCompanySlug, Grade } from '@/types';

interface GradeSelectorProps {
  grades: Array<{
    grade: Grade | 'raw';
    grading_company: GradingCompanySlug | null;
    hasData: boolean;
  }>;
  activeGrade: string;
  cardSlug: string;
  gameSlug: string;
  setSlug: string;
  className?: string;
}

export function GradeSelector({
  grades,
  activeGrade,
  cardSlug,
  gameSlug,
  setSlug,
  className,
}: GradeSelectorProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {grades.map((item) => {
        const gradeKey = item.grade === 'raw'
          ? 'raw'
          : `${item.grading_company}-${item.grade}`;
        const isActive = activeGrade === gradeKey;
        const href = item.grade === 'raw'
          ? `/${gameSlug}/${setSlug}/${cardSlug}`
          : `/${gameSlug}/${setSlug}/${cardSlug}/${item.grading_company}-${item.grade}`;

        return (
          <Link
            key={gradeKey}
            href={href}
            className={cn(
              'inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-all min-h-[44px]',
              isActive
                ? 'bg-zinc-900 text-white'
                : item.hasData
                ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                : 'bg-zinc-50 text-zinc-400'
            )}
          >
            {item.grade === 'raw' ? (
              'Raw'
            ) : (
              <>
                {getGradingCompanyDisplay(item.grading_company!)} {item.grade}
              </>
            )}
          </Link>
        );
      })}
    </div>
  );
}

interface GradeTabsProps {
  companies: GradingCompanySlug[];
  activeCompany: GradingCompanySlug;
  onCompanyChange: (company: GradingCompanySlug) => void;
  className?: string;
}

export function GradeTabs({ companies, activeCompany, onCompanyChange, className }: GradeTabsProps) {
  return (
    <div className={cn('flex gap-1 rounded-lg bg-zinc-100 p-1', className)}>
      {companies.map((company) => (
        <button
          key={company}
          onClick={() => onCompanyChange(company)}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-medium transition-all',
            activeCompany === company
              ? 'bg-white text-zinc-900 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-700'
          )}
        >
          {getGradingCompanyDisplay(company)}
        </button>
      ))}
    </div>
  );
}
