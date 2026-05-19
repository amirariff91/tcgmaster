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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Today&apos;s movement</p>
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-stone-950 md:text-4xl">
            Prices with volume and confidence.
          </h2>
        </div>
        <Link
          href="/market"
          className="inline-flex items-center gap-2 text-sm font-medium text-stone-700 transition-colors hover:text-stone-950"
        >
          View full market desk <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(41,37,36,0.06)]">
        <div className="hidden grid-cols-[3rem_1.6fr_0.8fr_0.8fr_0.7fr_0.8fr_0.8fr] gap-4 border-b border-stone-200 bg-stone-100/80 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500 md:grid">
          <span>#</span>
          <span>Card</span>
          <span>Grade</span>
          <span className="text-right">Last comp</span>
          <span className="text-right">24h</span>
          <span className="text-right">Volume</span>
          <span className="text-right">Confidence</span>
        </div>

        <div className="divide-y divide-stone-200">
          {rows.map((card, index) => {
            const isPositive = card.change >= 0;
            return (
              <Link
                key={card.id}
                href={`/${card.slug}`}
                className="grid gap-3 px-5 py-4 transition-colors hover:bg-amber-50/50 md:grid-cols-[3rem_1.6fr_0.8fr_0.8fr_0.7fr_0.8fr_0.8fr] md:items-center md:gap-4"
              >
                <span className="font-mono text-sm text-stone-400">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <p className="font-semibold text-stone-950">{card.name}</p>
                  <p className="text-sm text-stone-600">{card.set}</p>
                  <p className="mt-1 text-xs text-stone-500 md:hidden">
                    {card.grade} · {card.source || 'Tracked comps'} · {card.confidence || 'High'} confidence
                  </p>
                </div>
                <span className="hidden text-sm font-medium text-stone-700 md:block">{card.grade}</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-stone-950 md:text-right">
                  {format(card.price)}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 font-mono text-sm font-semibold tabular-nums md:justify-end',
                    isPositive ? 'text-emerald-700' : 'text-red-700'
                  )}
                >
                  {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {formatPriceChange(card.change)}
                </span>
                <span className="hidden font-mono text-sm tabular-nums text-stone-700 md:block md:text-right">
                  {card.volume || 0} comps
                </span>
                <span className="hidden text-sm text-stone-700 md:block md:text-right">
                  {card.confidence || 'High'}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="border-t border-stone-200 bg-stone-50 px-5 py-3 text-xs leading-5 text-stone-600">
          Movement combines completed-sale comps with active listing pressure. Thin-volume items are marked before they distort the market view.
        </div>
      </div>
    </section>
  );
}

export default MarketMovers;
