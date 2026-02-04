import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowRight, Search, TrendingUp, Sparkles } from 'lucide-react';
import { SearchBar } from '@/components/search/search-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatPrice, formatPriceChange } from '@/lib/utils';

// Mock game data
const gamesData: Record<string, {
  name: string;
  display_name: string;
  description: string;
  total_cards: number;
  total_sets: number;
}> = {
  pokemon: {
    name: 'Pokemon',
    display_name: 'Pokemon',
    description: 'Explore prices for Pokemon TCG cards from Base Set to modern expansions.',
    total_cards: 15000,
    total_sets: 120,
  },
  'sports-basketball': {
    name: 'Basketball',
    display_name: 'Basketball Cards',
    description: 'Track prices for basketball cards including Topps, Fleer, and Panini.',
    total_cards: 25000,
    total_sets: 200,
  },
  'sports-baseball': {
    name: 'Baseball',
    display_name: 'Baseball Cards',
    description: 'Price guide for baseball cards from vintage Topps to modern releases.',
    total_cards: 50000,
    total_sets: 350,
  },
};

// Mock sets data
const mockSets = [
  {
    id: '1',
    name: 'Base Set',
    slug: 'base-set',
    release_date: '1999-01-09',
    card_count: 102,
    image_url: null,
    avg_price: 850,
    trending: true,
  },
  {
    id: '2',
    name: 'Jungle',
    slug: 'jungle',
    release_date: '1999-06-16',
    card_count: 64,
    image_url: null,
    avg_price: 320,
    trending: false,
  },
  {
    id: '3',
    name: 'Fossil',
    slug: 'fossil',
    release_date: '1999-10-10',
    card_count: 62,
    image_url: null,
    avg_price: 280,
    trending: false,
  },
  {
    id: '4',
    name: 'Base Set 2',
    slug: 'base-set-2',
    release_date: '2000-02-24',
    card_count: 130,
    image_url: null,
    avg_price: 180,
    trending: false,
  },
  {
    id: '5',
    name: 'Team Rocket',
    slug: 'team-rocket',
    release_date: '2000-04-24',
    card_count: 83,
    image_url: null,
    avg_price: 350,
    trending: true,
  },
  {
    id: '6',
    name: 'Neo Genesis',
    slug: 'neo-genesis',
    release_date: '2000-12-16',
    card_count: 111,
    image_url: null,
    avg_price: 620,
    trending: true,
  },
];

const mockTopCards = [
  {
    id: '1',
    name: 'Charizard',
    set: 'Base Set',
    slug: 'charizard-holo',
    set_slug: 'base-set',
    price: 42000,
    change: 5.2,
  },
  {
    id: '2',
    name: 'Lugia',
    set: 'Neo Genesis',
    slug: 'lugia-holo',
    set_slug: 'neo-genesis',
    price: 12500,
    change: 8.3,
  },
  {
    id: '3',
    name: 'Blastoise',
    set: 'Base Set',
    slug: 'blastoise-holo',
    set_slug: 'base-set',
    price: 8500,
    change: -2.1,
  },
];

interface PageProps {
  params: Promise<{
    game: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { game } = await params;
  const gameData = gamesData[game];

  if (!gameData) {
    return { title: 'Not Found' };
  }

  return {
    title: `${gameData.display_name} Price Guide`,
    description: gameData.description,
  };
}

export default async function GamePage({ params }: PageProps) {
  const { game } = await params;
  const gameData = gamesData[game];

  if (!gameData) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-zinc-200 bg-gradient-to-b from-zinc-50 to-white">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-4">
              {gameData.total_cards.toLocaleString()}+ cards tracked
            </Badge>
            <h1 className="mb-4 text-4xl font-bold tracking-tight text-zinc-900 md:text-5xl">
              {gameData.display_name} Price Guide
            </h1>
            <p className="mb-8 text-lg text-zinc-600">
              {gameData.description}
            </p>
            <div className="mx-auto max-w-xl">
              <SearchBar
                size="lg"
                placeholder={`Search ${gameData.name} cards...`}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-12 lg:grid-cols-3">
          {/* Sets List */}
          <div className="lg:col-span-2">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-zinc-900">
                Sets
              </h2>
              <span className="text-sm text-zinc-500">
                {gameData.total_sets} sets
              </span>
            </div>

            <div className="space-y-3">
              {mockSets.map((set) => (
                <Link
                  key={set.id}
                  href={`/${game}/${set.slug}`}
                  className="group flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-300 hover:shadow-md"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-zinc-100">
                    <span className="text-2xl font-bold text-zinc-400">
                      {set.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-zinc-900 group-hover:text-blue-600">
                        {set.name}
                      </h3>
                      {set.trending && (
                        <Badge variant="warning" className="gap-1">
                          <Sparkles className="h-3 w-3" />
                          Hot
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-zinc-500">
                      {set.card_count} cards | Released {set.release_date?.slice(0, 4)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-zinc-900">
                      {formatPrice(set.avg_price)}
                    </p>
                    <p className="text-sm text-zinc-500">avg. price</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-zinc-400 transition-transform group-hover:translate-x-1" />
                </Link>
              ))}
            </div>

            <div className="mt-6 text-center">
              <Button variant="outline">
                View All Sets
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Top Cards */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  Top Cards
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {mockTopCards.map((card, index) => (
                  <Link
                    key={card.id}
                    href={`/${game}/${card.set_slug}/${card.slug}`}
                    className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-zinc-50"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-500">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-zinc-900">
                        {card.name}
                      </p>
                      <p className="text-sm text-zinc-500">{card.set}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-zinc-900">
                        {formatPrice(card.price)}
                      </p>
                      <p
                        className={`text-sm ${
                          card.change >= 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {formatPriceChange(card.change)}
                      </p>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Total Cards</dt>
                    <dd className="font-semibold text-zinc-900">
                      {gameData.total_cards.toLocaleString()}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Total Sets</dt>
                    <dd className="font-semibold text-zinc-900">
                      {gameData.total_sets}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Price Updates</dt>
                    <dd className="font-semibold text-zinc-900">
                      Real-time
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* CTA */}
            <Card className="border-2 border-dashed">
              <CardContent className="pt-6 text-center">
                <Search className="mx-auto h-8 w-8 text-zinc-400" />
                <h3 className="mt-2 font-semibold text-zinc-900">
                  Can&apos;t find a card?
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Use our search to find any card in our database.
                </p>
                <Link href={`/search?game=${game}`}>
                  <Button className="mt-4" size="sm">
                    Advanced Search
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
