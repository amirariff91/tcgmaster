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

// Mock data - would come from API in production
const marketMovers: { gainers: MarketMover[]; losers: MarketMover[] } = {
  gainers: [
    {
      id: '1',
      name: 'Charizard',
      set: 'Base Set',
      grade: 'PSA 10',
      price: 42000,
      change: 15.2,
      image: null, // Will show letter avatar
      slug: 'pokemon/base-set/charizard-holo',
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
      image: null,
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
      image: null,
      slug: 'pokemon/base-set/blastoise-holo',
    },
    {
      id: '5',
      name: 'Mewtwo',
      set: 'Base Set',
      grade: 'PSA 9',
      price: 1200,
      change: -5.1,
      image: null,
      slug: 'pokemon/base-set/mewtwo-holo',
    },
  ],
};

const trendingCards = [
  { id: '1', name: 'Charizard', set: 'Base Set', searches: 12500, slug: 'pokemon/base-set/charizard-holo' },
  { id: '2', name: 'Lugia', set: 'Neo Genesis', searches: 8200, slug: 'pokemon/neo-genesis/lugia-holo' },
  { id: '3', name: 'LeBron James RC', set: '2003 Topps Chrome', searches: 7800, slug: 'sports-basketball/2003-topps-chrome/lebron-james-rc' },
  { id: '4', name: 'Venusaur', set: 'Base Set', searches: 5600, slug: 'pokemon/base-set/venusaur-holo' },
  { id: '5', name: 'Umbreon', set: 'Neo Discovery', searches: 4900, slug: 'pokemon/neo-discovery/umbreon-holo' },
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
      slug: 'pokemon/base-set/charizard-holo',
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
    gradient: 'from-blue-500 to-indigo-500',
    icon: TrendingUp,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-zinc-50 to-white">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        <div className="container relative py-16 md:py-24 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-4">
              <Sparkles className="mr-1 h-3 w-3" />
              Graded card prices updated in real-time
            </Badge>
            <h1 className="mb-6 text-4xl font-bold tracking-tight text-zinc-900 md:text-5xl lg:text-6xl">
              The Ultimate TCG Price Intelligence Platform
            </h1>
            <p className="mb-8 text-lg text-zinc-600 md:text-xl">
              Track prices, manage your collection, and make smarter investment decisions with
              real-time data for Pokemon and sports cards.
            </p>
            <div className="mx-auto max-w-2xl">
              <SearchBar
                size="lg"
                placeholder="Search cards, sets, or enter PSA/BGS cert number..."
              />
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-zinc-500">
              <span className="flex items-center gap-1">
                <Search className="h-4 w-4" />
                100,000+ cards tracked
              </span>
              <span className="flex items-center gap-1">
                <Shield className="h-4 w-4" />
                PSA & BGS cert lookup
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Categories with mosaic backgrounds */}
      <CategoryCards categories={categories} />

      {/* Market Movers with lazy-loaded thumbnails */}
      <MarketMovers gainers={marketMovers.gainers} losers={marketMovers.losers} />

      {/* Trending & Notable Sales */}
      <section className="container py-12 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Trending */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Trending Searches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {trendingCards.map((card, index) => (
                  <Link
                    key={card.id}
                    href={`/${card.slug}`}
                    className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-zinc-50"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-600">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-zinc-900">{card.name}</p>
                      <p className="text-sm text-zinc-500">{card.set}</p>
                    </div>
                    <span className="text-sm text-zinc-400">
                      {card.searches.toLocaleString()} searches
                    </span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Notable Sales */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                Recent Notable Sales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {notableSales.map((sale) => (
                  <Link
                    key={sale.id}
                    href={`/${sale.slug}`}
                    className="flex items-center gap-4 rounded-lg p-2 transition-colors hover:bg-zinc-50"
                  >
                    <CardThumbnail
                      src={null}
                      alt={sale.name}
                      name={sale.name}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-900">
                        {sale.name}
                      </p>
                      <p className="truncate text-sm text-zinc-500">
                        {sale.set} - {sale.grade}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-zinc-900">
                        {formatPrice(sale.price)}
                      </p>
                      <p className="text-xs text-zinc-400">{sale.source}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-16 lg:py-20">
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-center text-white md:p-12">
          <h2 className="mb-4 text-3xl font-bold">Start Tracking Your Collection</h2>
          <p className="mb-8 text-lg text-white/80">
            Create a free account to track your portfolio, set price alerts, and earn achievements.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-zinc-100">
                Create Free Account
              </Button>
            </Link>
            <Link href="/cert">
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
              >
                Try Cert Lookup
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
