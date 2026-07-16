'use client';

import type * as React from 'react';
import Link from 'next/link';
import { ArrowRight, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Category {
  name: string;
  slug: string;
  description: string;
  cardCount: string;
  gradient?: string;
  icon?: React.ComponentType<{ className?: string }>;
  change?: string;
  topMover?: string;
  signal?: string;
}

interface CategoryCardsProps {
  categories: Category[];
}

export function CategoryCards({ categories }: CategoryCardsProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">Markets covered</p>
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Market lanes, not directory tiles.
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-zinc-400">
          Each lane shows coverage, demand, and movement context so collectors know where the market is active.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1329]/80 backdrop-blur-sm shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
        {categories.map((category, index) => (
          <CategoryLane key={category.slug} category={category} index={index} />
        ))}
      </div>
    </section>
  );
}

interface CategoryLaneProps {
  category: Category;
  index: number;
}

function CategoryLane({ category, index }: CategoryLaneProps) {
  const isPositive = !category.change?.startsWith('-');

  return (
    <div
      className={cn(
        'group grid gap-4 px-5 py-5 transition-colors md:grid-cols-[1.3fr_0.8fr_0.8fr_auto] md:items-center md:px-6',
        index !== 0 && 'border-t border-white/10'
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-orange-400">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">{category.name}</h3>
          <p className="text-sm text-zinc-400">{category.description}</p>
        </div>
      </div>

      <Metric label="Indexed" value={`${category.cardCount} cards`} />
      <Metric
        label="7d signal"
        value={category.change || 'Active'}
        className={isPositive ? 'text-emerald-400' : 'text-red-400'}
      />

      <div className="flex items-center justify-between gap-4 md:justify-end">
        <div className="text-left md:text-right">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Top mover</p>
          <p className="text-sm font-medium text-orange-400">{category.topMover || category.signal || 'Live comps'}</p>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className={cn('mt-1 font-mono text-sm font-semibold tabular-nums text-white', className)}>{value}</p>
    </div>
  );
}

export default CategoryCards;
