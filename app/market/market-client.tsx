'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTopGainers, getTopLosers, mockSets, type MockCard } from '@/lib/mock-data';
import { useCurrencyContext } from '@/lib/currency-context';
import { trackMarketViewed } from '@/lib/analytics';

type Period = '24h' | '7d' | '30d';

const ITEMS_PER_PAGE = 10;

export function MarketClient() {
  const [period, setPeriod] = useState<Period>('24h');
  const [gainersPage, setGainersPage] = useState(1);
  const [losersPage, setLosersPage] = useState(1);

  const { format } = useCurrencyContext();

  // Track page view
  useEffect(() => {
    trackMarketViewed(period);
  }, [period]);

  // Get data for current period
  const gainers = useMemo(() => getTopGainers(period, 50), [period]);
  const losers = useMemo(() => getTopLosers(period, 50), [period]);

  // Paginate data
  const paginatedGainers = gainers.slice(
    (gainersPage - 1) * ITEMS_PER_PAGE,
    gainersPage * ITEMS_PER_PAGE
  );
  const paginatedLosers = losers.slice(
    (losersPage - 1) * ITEMS_PER_PAGE,
    losersPage * ITEMS_PER_PAGE
  );

  const totalGainersPages = Math.ceil(gainers.length / ITEMS_PER_PAGE);
  const totalLosersPages = Math.ceil(losers.length / ITEMS_PER_PAGE);

  // Reset pages when period changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGainersPage(1);
    setLosersPage(1);
  }, [period]);

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  };

  // Get set slug from card
  const getCardUrl = (card: MockCard & { setName: string; game: string }) => {
    // Find the set that contains this card
    const set = Object.values(mockSets).find((s) =>
      s.cards.some((c) => c.id === card.id)
    );
    if (!set) return '#';
    return `/${set.gameSlug}/${set.slug}/${card.slug}`;
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900">Market Movers</h1>
          <p className="text-zinc-500 mt-2">
            Track the biggest price movements across all trading cards.
          </p>
        </div>

        {/* Period Tabs */}
        <div className="flex gap-2 mb-8">
          {(['24h', '7d', '30d'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium',
                'transition-colors duration-150',
                period === p
                  ? 'bg-zinc-900 text-white'
                  : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
              )}
            >
              {p === '24h' ? '24 Hours' : p === '7d' ? '7 Days' : '30 Days'}
            </button>
          ))}
        </div>

        {/* Market Data Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Gainers */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              <h2 className="text-lg font-semibold text-zinc-900">Top Gainers</h2>
            </div>

            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <div className="divide-y divide-zinc-100">
                {paginatedGainers.map((card, index) => (
                  <Link
                    key={card.id}
                    href={getCardUrl(card)}
                    className={cn(
                      'flex items-center gap-4 p-4',
                      'hover:bg-zinc-50 transition-colors'
                    )}
                  >
                    <span className="text-sm text-zinc-400 w-6">
                      {(gainersPage - 1) * ITEMS_PER_PAGE + index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-zinc-900 truncate">{card.name}</p>
                      <p className="text-sm text-zinc-500 truncate">
                        {card.setName} &middot; {card.game}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-zinc-900">
                        {format(card.prices.raw)}
                      </p>
                      <p className="text-sm font-medium text-emerald-600">
                        {formatChange(card.change24h)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              <div className="px-4 py-3 border-t border-zinc-100 flex items-center justify-between">
                <span className="text-sm text-zinc-500">
                  Page {gainersPage} of {totalGainersPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setGainersPage((p) => Math.max(1, p - 1))}
                    disabled={gainersPage === 1}
                    className={cn(
                      'p-1.5 rounded-lg',
                      'hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setGainersPage((p) => Math.min(totalGainersPages, p + 1))}
                    disabled={gainersPage === totalGainersPages}
                    className={cn(
                      'p-1.5 rounded-lg',
                      'hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Losers */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-semibold text-zinc-900">Top Losers</h2>
            </div>

            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <div className="divide-y divide-zinc-100">
                {paginatedLosers.map((card, index) => (
                  <Link
                    key={card.id}
                    href={getCardUrl(card)}
                    className={cn(
                      'flex items-center gap-4 p-4',
                      'hover:bg-zinc-50 transition-colors'
                    )}
                  >
                    <span className="text-sm text-zinc-400 w-6">
                      {(losersPage - 1) * ITEMS_PER_PAGE + index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-zinc-900 truncate">{card.name}</p>
                      <p className="text-sm text-zinc-500 truncate">
                        {card.setName} &middot; {card.game}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-zinc-900">
                        {format(card.prices.raw)}
                      </p>
                      <p className="text-sm font-medium text-red-600">
                        {formatChange(card.change24h)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              <div className="px-4 py-3 border-t border-zinc-100 flex items-center justify-between">
                <span className="text-sm text-zinc-500">
                  Page {losersPage} of {totalLosersPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLosersPage((p) => Math.max(1, p - 1))}
                    disabled={losersPage === 1}
                    className={cn(
                      'p-1.5 rounded-lg',
                      'hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setLosersPage((p) => Math.min(totalLosersPages, p + 1))}
                    disabled={losersPage === totalLosersPages}
                    className={cn(
                      'p-1.5 rounded-lg',
                      'hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
