'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown, ArrowRight, Sparkles, Search, Shield } from 'lucide-react';
import { SearchBar } from '@/components/search/search-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarketMovers, type MarketMover } from '@/components/home/market-movers';
import { CategoryCards, type Category } from '@/components/home/category-cards';
import { CardThumbnail } from '@/components/card/card-image';
import { formatPrice, formatDate } from '@/lib/utils';

// Pokemon TCG Base Set hires images (no auth required)
const POKE_IMG = (n: number) => `https://images.pokemontcg.io/base1/${n}_hires.png`;

const marketMovers: { gainers: MarketMover[]; losers: MarketMover[] } = {
  gainers: [
    {
      id: '1',
      name: 'Charizard',
      set: 'Base Set',
      grade: 'PSA 10',
      price: 42000,
      change: 15.2,
      image: POKE_IMG(4),
      slug: 'pokemon/base-set/charizard',
    },
    {
      id: '2',
      name: 'Michael Jordan Rookie',
      set: '1986 Fleer',
      grade: 'PSA 9',
      price: 85000,
      change: 12.8,
      image: null,
      slug: 'sports-basketball/1986-fleer/michael-jordan-rookie',
    },
    {
      id: '3',
      name: 'Pikachu Illustrator',
      set: 'Promo',
      grade: 'PSA 9',
      price: 375000,
      change: 8.5,
      image: POKE_IMG(58),
      slug: 'pokemon/promo/pikachu-illustrator',
    },
  ],
  losers: [
    {
      id: '4',
      name: 'Blastoise',
      set: 'Base Set',
      grade: 'PSA 10',
      price: 8500,
      change: -7.3,
      image: POKE_IMG(2),
      slug: 'pokemon/base-set/blastoise',
    },
    {
      id: '5',
      name: 'Mewtwo',
      set: 'Base Set',
      grade: 'PSA 9',
      price: 1200,
      change: -5.1,
      image: POKE_IMG(10),
      slug: 'pokemon/base-set/mewtwo',
    },
  ],
};

const trendingCards = [
  { id: '1', name: 'Charizard', set: 'Base Set', searches: 12500, slug: 'pokemon/base-set/charizard' },
  { id: '2', name: 'Lugia', set: 'Neo Genesis', searches: 8200, slug: 'pokemon/neo-genesis/lugia' },
  { id: '3', name: 'LeBron James RC', set: '2003 Topps Chrome', searches: 7800, slug: 'sports-basketball/2003-topps-chrome/lebron-james-rc' },
  { id: '4', name: 'Venusaur', set: 'Base Set', searches: 5600, slug: 'pokemon/base-set/venusaur' },
  { id: '5', name: 'Umbreon', set: 'Neo Discovery', searches: 4900, slug: 'pokemon/neo-discovery/umbreon' },
];

// Generate mock notable sales with dynamic dates
const generateNotableSales = () => {
  const today = new Date();
  return [
    {
      id: '1',
      name: 'Charizard 1st Edition',
      set: 'Base Set',
      grade: 'PSA 10',
      price: 420000,
      daysAgo: 2,
      source: 'PWCC',
      slug: 'pokemon/base-set/charizard',
    },
    {
      id: '2',
      name: 'Mickey Mantle',
      set: '1952 Topps',
      grade: 'PSA 9',
      price: 2880000,
      daysAgo: 5,
      source: 'Heritage',
      slug: 'sports-baseball/1952-topps/mickey-mantle',
    },
    {
      id: '3',
      name: 'Michael Jordan Rookie',
      set: '1986 Fleer',
      grade: 'BGS 10',
      price: 738000,
      daysAgo: 7,
      source: 'Goldin',
      slug: 'sports-basketball/1986-fleer/michael-jordan-rookie',
    },
  ].map((sale) => {
    const date = new Date(today);
    date.setDate(date.getDate() - sale.daysAgo);
    return {
      ...sale,
      date: date.toISOString().split('T')[0],
    };
  });
};

const notableSales = generateNotableSales();

const categories: Category[] = [
  {
    name: 'Pokemon',
    slug: 'pokemon',
    description: 'Base Set, Neo, Modern & more',
    cardCount: '15,000+',
    gradient: 'from-yellow-400 to-orange-500',
    icon: Sparkles,
  },
  {
    name: 'Basketball',
    slug: 'sports-basketball',
    description: 'Topps, Fleer, Panini & more',
    cardCount: '25,000+',
    gradient: 'from-orange-500 to-red-500',
    icon: TrendingUp,
  },
  {
    name: 'Baseball',
    slug: 'sports-baseball',
    description: 'Topps, Bowman, vintage & more',
    cardCount: '50,000+',
    gradient: 'from-blue-500 to-indigo-600',
    icon: Shield,
  },
];

export default function HomePage() {
  const notableSalesData = notableSales;

  return (
    <main className="min-h-screen bg-zinc-50">
      {/* Hero */}
      <section className="bg-white border-b border-zinc-200">
        <div className="container py-12 md:py-20">
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="secondary" className="mb-4 text-xs font-medium">
              Graded card prices updated in real-time
            </Badge>
            <h1 className="text-4xl font-bold text-zinc-900 md:text-5xl lg:text-6xl tracking-tight">
              The Ultimate TCG Price Intelligence Platform
            </h1>
            <p className="mt-4 text-lg text-zinc-600 md:text-xl">
              Track prices, manage your collection, and make smarter investment decisions with
              real-time data for Pokemon and sports cards.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 text-sm text-zinc-500">
              <span className="flex items-center gap-1.5">
                <Search className="h-4 w-4" />
                100,000+ cards tracked
              </span>
              <span className="hidden sm:block">·</span>
              <span className="flex items-center gap-1.5">
                <Shield className="h-4 w-4" />
                PSA &amp; BGS cert lookup
              </span>
            </div>
            <div className="mt-8 max-w-xl mx-auto">
              <SearchBar placeholder="Search cards, sets, or players..." />
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container py-10">
        <CategoryCards categories={categories} />
      </section>

      {/* Market Movers */}
      <section className="container py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-zinc-900">Market Movers</h2>
          <Link
            href="/market"
            className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <MarketMovers gainers={marketMovers.gainers} losers={marketMovers.losers} />
      </section>

      {/* Trending + Recent Sales */}
      <section className="container py-10">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Trending Searches */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                Trending Searches
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-zinc-100">
                {trendingCards.map((item, i) => (
                  <li key={item.id}>
                    <Link
                      href={`/${item.slug}`}
                      className="flex items-center gap-3 px-6 py-3 hover:bg-zinc-50 transition-colors"
                    >
                      <span className="text-sm font-medium text-zinc-400 w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-zinc-900 truncate">{item.name}</p>
                        <p className="text-xs text-zinc-500">{item.set}</p>
                      </div>
                      <span className="text-xs text-zinc-400 tabular-nums">
                        {item.searches.toLocaleString()} searches
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Recent Notable Sales */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-zinc-600" />
                Recent Notable Sales
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-zinc-100">
                {notableSalesData.map((sale) => (
                  <li key={sale.id}>
                    <Link
                      href={`/${sale.slug}`}
                      className="flex items-center gap-3 px-6 py-3 hover:bg-zinc-50 transition-colors"
                    >
                      <CardThumbnail src={null} alt={sale.name} name={sale.name} className="flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-zinc-900 truncate">{sale.name}</p>
                        <p className="text-xs text-zinc-500">
                          {sale.set} · {sale.grade} · {sale.source}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-zinc-900 tabular-nums">
                          {formatPrice(sale.price)}
                        </p>
                        <p className="text-xs text-zinc-400">{formatDate(sale.date)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-10 pb-16">
        <Card className="bg-zinc-900 text-white border-0">
          <CardContent className="py-12 text-center">
            <h2 className="text-2xl font-bold md:text-3xl">Start Tracking Your Collection</h2>
            <p className="mt-3 text-zinc-400 max-w-md mx-auto">
              Create a free account to track your portfolio, set price alerts, and earn
              achievements.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" variant="default" className="bg-white text-zinc-900 hover:bg-zinc-100">
                Get Started Free
              </Button>
              <Button size="lg" variant="outline" className="border-zinc-700 text-white hover:bg-zinc-800">
                Browse Cards
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
