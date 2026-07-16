'use client';

import Link from 'next/link';
import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import { formatPriceChange } from '@/lib/utils';
import { useCurrencyContext } from '@/lib/currency-context';
import { cn } from '@/lib/utils';

export interface MarketMover {
  id: string;
  name: string;
  set: string;
  grade: string;
  price: number;
  change: number;
  image: string | null;
  slug: string;
  volume?: number;
  confidence?: 'High' | 'Medium' | 'Thin';
  source?: string;
  lastSale?: string;
}

interface MarketMoversProps {
  gainers: MarketMover[];
  losers: MarketMover[];
}

export function MarketMovers({ gainers, losers }: MarketMoversProps) {
  const rows = [...gainers, ...losers].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const { format } = useCurrencyContext();

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">Today&apos;s movement</p>
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Prices with volume and confidence.
          </h2>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-transparent shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
        <div className="hidden grid-cols-[3rem_1.6fr_0.8fr_0.8fr_0.7fr_0.8fr_0.8fr] gap-4 border-b border-white/10 bg-white/5 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400 md:grid">
          <span>#</span>
          <span>Card</span>
          <span>Grade</span>
          <span className="text-right">Last comp</span>
          <span className="text-right">24h</span>
          <span className="text-right">Volume</span>
          <span className="text-right">Confidence</span>
        </div>

        <div className="divide-y divide-white/10">
          {rows.map((card, index) => {
            const isPositive = card.change >= 0;
            return (
              <div
                key={card.id}
                className="grid gap-3 px-5 py-4 transition-colors md:grid-cols-[3rem_1.6fr_0.8fr_0.8fr_0.7fr_0.8fr_0.8fr] md:items-center md:gap-4"
              >
                <span className="font-mono text-sm text-zinc-500">{String(index + 1).padStart(2, '0')}</span>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10">
                    <span className="font-serif text-sm font-bold text-white">
                      {card.set.substring(0, 3)}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-zinc-200">{card.name}</div>
                    <div className="text-xs text-zinc-500">{card.set}</div>
                  </div>
                </div>
                <div className="text-sm text-zinc-400">
                  {card.grade}
                </div>
                <div className="text-right font-medium text-white">
                  {format(card.price)}
                </div>
                <div
                  className={cn(
                    'flex items-center justify-end gap-1 text-sm font-medium',
                    isPositive ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  {isPositive ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  {formatPriceChange(card.change)}
                </div>
                <div className="text-right text-sm text-zinc-400">
                  {card.volume ? card.volume.toLocaleString() : '-'}
                </div>
                <div className="flex items-center justify-end">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-medium border",
                    card.confidence === 'High' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                    card.confidence === 'Medium' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                    "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                  )}>
                    {card.confidence || 'Thin'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-white/10 bg-white/5 px-5 py-3 text-xs leading-5 text-zinc-400">
          Movement combines completed-sale comps with active listing pressure. Thin-volume items are marked before they distort the market view.
        </div>
      </div>
    </section>
  );
}

export default MarketMovers;
